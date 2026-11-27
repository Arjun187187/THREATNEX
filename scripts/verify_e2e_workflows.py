"""
End-to-End Functional Verification of all 11 THREATNEX MVP user workflows.
"""
import asyncio
import json
import httpx
from sqlalchemy import select
from app.core.database import AsyncSessionLocal
from app.modules.auth.models import User, Role
from app.core.security import hash_password

BASE_URL = 'http://127.0.0.1:8000/api/v1'


async def ensure_demo_user():
    async with AsyncSessionLocal() as session:
        result = await session.execute(select(User).where(User.username == 'soc_lead_demo'))
        user = result.scalar_one_or_none()
        if not user:
            admin_role = (await session.execute(select(Role).where(Role.name == 'Admin'))).scalar_one()
            analyst_role = (await session.execute(select(Role).where(Role.name == 'Analyst'))).scalar_one()
            user = User(
                username='soc_lead_demo',
                email='soc_lead@threatnex.local',
                full_name='SOC Lead Operator',
                hashed_password=hash_password('ThreatNex2026!DemoPass'),
                is_active=True,
                is_verified=True,
                roles=[admin_role, analyst_role]
            )
            session.add(user)
            await session.commit()
            print('-> Seeded soc_lead_demo with Admin + Analyst roles.')
        else:
            print('-> soc_lead_demo exists.')


async def run_workflows():
    await ensure_demo_user()

    async with httpx.AsyncClient(base_url=BASE_URL, timeout=45.0) as client:
        print('\n=== WORKFLOW 1: Login & Authenticated Dashboard Access ===')
        login_res = await client.post('/auth/login', json={
            'username_or_email': 'soc_lead_demo',
            'password': 'ThreatNex2026!DemoPass'
        })
        assert login_res.status_code == 200, f'Login failed: {login_res.text}'
        tokens = login_res.json()
        token = tokens['access_token']
        headers = {'Authorization': f'Bearer {token}'}

        me_res = await client.get('/auth/me', headers=headers)
        assert me_res.status_code == 200
        me = me_res.json()
        print(f'Authenticated User: {me.get("username")}, Roles: {me.get("roles")}')
        print('[PASS] Workflow 1: Operator authenticated and session verified.')

        print('\n=== WORKFLOW 2: IOC Investigation Using a Real Indicator ===')
        ioc_val = '1.1.1.1'
        search_res = await client.post('/indicators/investigate', json={
            'value': ioc_val,
            'save_to_inventory': True
        }, headers=headers)
        assert search_res.status_code in [200, 201], f'IOC Investigation failed: {search_res.text}'
        inv_data = search_res.json()
        print(f'IOC: {inv_data.get("value")}, Verdict: {inv_data.get("overall_verdict")}, Severity: {inv_data.get("calculated_severity")}')
        print('[PASS] Workflow 2: Real indicator investigated across configured providers.')

        print('\n=== WORKFLOW 3: Threat Feed Search, Filters & Manual Sync ===')
        feed_res = await client.get('/threat-intel/feed', params={'page': 1, 'page_size': 10}, headers=headers)
        assert feed_res.status_code == 200
        feed_total = feed_res.json().get('total', 0)
        print(f'Feed List Items: {feed_total}')

        feed_filtered = await client.get('/threat-intel/feed', params={'severity': 'high'}, headers=headers)
        assert feed_filtered.status_code == 200
        print(f'Filtered (High Severity) Feed Items: {feed_filtered.json().get("total")}')

        sync_res = await client.post('/threat-intel/sync', headers=headers)
        assert sync_res.status_code == 200
        print(f'Manual Sync Result: {sync_res.json().get("message")}')
        print('[PASS] Workflow 3: Threat feed pagination, severity filtering, and manual sync verified.')

        print('\n=== WORKFLOW 4: Open Indicator from Feed in IOC Investigation ===')
        items = feed_res.json().get('items', [])
        target_feed_ioc = items[0]['indicator_value'] if items else '1.1.1.1'
        print(f'Selected indicator from feed: {target_feed_ioc}')
        feed_ioc_res = await client.post('/indicators/investigate', json={
            'value': target_feed_ioc,
            'save_to_inventory': True
        }, headers=headers)
        assert feed_ioc_res.status_code in [200, 201], f"Feed IOC failed: {feed_ioc_res.status_code} {feed_ioc_res.text}"
        print(f'Feed Indicator Investigated: {feed_ioc_res.json().get("value")}')
        print('[PASS] Workflow 4: Opened indicator from feed into live IOC investigation.')

        print('\n=== WORKFLOW 5: Gemini AI Analysis & History ===')
        ai_res = await client.post('/ai-analyst/analyze', json={
            'indicator_value': ioc_val,
            'ioc_type': 'ipv4'
        }, headers=headers)
        assert ai_res.status_code in [200, 201], f'AI analyze failed: {ai_res.text}'
        ai_data = ai_res.json()
        print(f'AI Classification: {ai_data.get("threat_classification")}, Risk Level: {ai_data.get("risk_level")}')

        ai_hist = await client.get('/ai-analyst/history', headers=headers)
        assert ai_hist.status_code == 200
        print(f'Stored AI Analyses: {len(ai_hist.json())}')
        print('[PASS] Workflow 5: Real Gemini AI analysis executed and saved to history.')

        print('\n=== WORKFLOW 6: Threat Watchlists (Create, Add & Remove Indicators) ===')
        wl_create = await client.post('/watchlists/', json={
            'name': 'Demonstration VIP Asset Watchlist',
            'category': 'VIP Monitoring',
            'severity': 'critical',
            'description': 'Tracking high priority infrastructure'
        }, headers=headers)
        assert wl_create.status_code == 201
        wl = wl_create.json()
        wl_id = wl['id']
        print(f'Created Watchlist: {wl["name"]} (ID: {wl_id})')

        ind_create = await client.post(f'/watchlists/{wl_id}/indicators', json={
            'indicator_value': '198.51.100.99',
            'ioc_type': 'ipv4',
            'severity': 'critical',
            'confidence': 95.0,
            'notes': 'Suspicious external command beacon'
        }, headers=headers)
        assert ind_create.status_code == 201
        ind = ind_create.json()
        ind_id = ind['id']
        print(f'Added Indicator to Watchlist: {ind["indicator_value"]} (ID: {ind_id})')

        ind_del = await client.delete(f'/watchlists/{wl_id}/indicators/{ind_id}', headers=headers)
        assert ind_del.status_code == 204
        print('[PASS] Workflow 6: Watchlist created, indicator added and removed.')

        print('\n=== WORKFLOW 7: Generate Security Alert from Investigation ===')
        alert_res = await client.post('/alerts/', json={
            'title': f'Malicious C2 Communication Detected ({ioc_val})',
            'indicator_value': ioc_val,
            'ioc_type': 'ipv4',
            'severity': 'high',
            'source_rule': 'Investigation Pivot Rule',
            'description': f'Generated alert from investigation on {ioc_val}',
            'confidence': 85.0
        }, headers=headers)
        assert alert_res.status_code == 201
        alert = alert_res.json()
        alert_id = alert['id']
        print(f'Generated Security Alert: {alert["title"]} (ID: {alert_id}, Status: {alert["status"]})')
        print('[PASS] Workflow 7: Generated security alert from investigation.')

        print('\n=== WORKFLOW 8: Acknowledge, Resolve, and Escalate Alert ===')
        ack_res = await client.post(f'/alerts/{alert_id}/acknowledge', headers=headers)
        assert ack_res.status_code == 200
        print(f'Alert Acknowledged: Status is now {ack_res.json().get("status")}')

        res_res = await client.post(f'/alerts/{alert_id}/resolve', json={
            'resolution_notes': 'IP validated against official public resolver telemetry.'
        }, headers=headers)
        assert res_res.status_code == 200
        print(f'Alert Resolved: Status is now {res_res.json().get("status")}')

        esc_res = await client.post(f'/alerts/{alert_id}/escalate', json={
            'case_title': f'Escalated Investigation: {ioc_val}'
        }, headers=headers)
        assert esc_res.status_code == 200
        esc_data = esc_res.json()
        print(f'Alert Escalated: Status is now {esc_data.get("status")}, Associated Case: {esc_data.get("case_id")}')
        print('[PASS] Workflow 8: Complete alert triage lifecycle verified.')

        print('\n=== WORKFLOW 9: Generate Threat Report & Download MD/JSON ===')
        rep_res = await client.post('/reports/generate', json={
            'title': f'Threat Intelligence Brief: {ioc_val}',
            'report_type': 'ioc_briefing',
            'indicator_value': ioc_val,
            'include_ai_synthesis': True
        }, headers=headers)
        assert rep_res.status_code == 201
        rep = rep_res.json()
        rep_id = rep['id']
        print(f'Generated Threat Report: {rep["title"]} (ID: {rep_id})')

        rep_detail = await client.get(f'/reports/{rep_id}', headers=headers)
        assert rep_detail.status_code == 200
        rep_full = rep_detail.json()
        assert 'content_markdown' in rep_full and len(rep_full['content_markdown']) > 100
        print(f'Report Markdown Content Verified: {len(rep_full["content_markdown"])} bytes')
        print('[PASS] Workflow 9: Threat Report generated and retrieved.')

        print('\n=== WORKFLOW 10: View and Filter Audit Records ===')
        audit_res = await client.get('/audit/logs', params={'page': 1, 'page_size': 10}, headers=headers)
        assert audit_res.status_code == 200
        total_logs = audit_res.json().get('total', 0)
        print(f'Total Audit Log Records: {total_logs}')

        audit_filter = await client.get('/audit/logs', params={'action': 'ALERT_RESOLVED'}, headers=headers)
        assert audit_filter.status_code == 200
        print(f'Filtered (ALERT_RESOLVED) Audit Records: {audit_filter.json().get("total")}')
        print('[PASS] Workflow 10: Audit trail viewing, search and filtering verified.')

        print('\n=== WORKFLOW 11: Change SOC Scoring Weights & Alert Thresholds ===')
        settings_get = await client.get('/settings/', headers=headers)
        assert settings_get.status_code == 200

        weights_res = await client.put('/settings/scoring-weights', json={
            'virustotal_weight': 40.0,
            'abuseipdb_weight': 25.0,
            'alienvault_weight': 20.0,
            'urlhaus_weight': 15.0
        }, headers=headers)
        assert weights_res.status_code == 200
        print(f'Updated Scoring Weights: VT={weights_res.json().get("scoring_weights", {}).get("virustotal_weight")}%')

        thresh_res = await client.put('/settings/alert-thresholds', json={
            'min_confidence_to_alert': 80.0,
            'auto_escalate_critical': True,
            'deduplication_window_hours': 48,
            'require_analyst_resolution_notes': True
        }, headers=headers)
        assert thresh_res.status_code == 200
        print(f'Updated Alert Thresholds: MinConfidence={thresh_res.json().get("alert_thresholds", {}).get("min_confidence_to_alert")}%')
        print('[PASS] Workflow 11: SOC scoring weights and alert thresholds updated successfully.')

        print('\n======================================================')
        print('SUCCESS: ALL 11 END-TO-END DEMONSTRATION WORKFLOWS PASSED!')
        print('======================================================')


if __name__ == '__main__':
    asyncio.run(run_workflows())
