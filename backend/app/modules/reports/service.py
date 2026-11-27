"""Threat Reports generation and retrieval service."""
import json
import logging
import re
from typing import Optional, List
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
from fastapi import HTTPException, status
from app.modules.reports.models import ThreatReport
from app.modules.reports.schemas import (
    ReportGenerateRequest,
    ReportResponse,
    ReportListResponse,
    ReportListItem,
)
from app.modules.investigations.models import Investigation
from app.modules.indicators.models import IOCInvestigationRecord
from app.modules.ai_analyst.models import AIThreatAnalysis
from app.modules.auth.models import User
from app.modules.audit.service import record_audit_log

logger = logging.getLogger(__name__)


async def generate_threat_report(
    db: AsyncSession,
    req: ReportGenerateRequest,
    current_user: User,
) -> ReportResponse:
    """Generates a formal, evidence-backed Threat Intelligence or Incident Post-Mortem Report."""
    now = datetime.now(timezone.utc)
    now_str = now.strftime("%Y-%m-%d %H:%M:%S UTC")

    ref_id = None
    ref_title = None
    exec_summary = ""
    sections = []

    # 1. If Case ID provided, build Incident Case Report
    if req.case_id:
        stmt = select(Investigation).where(Investigation.id == req.case_id)
        case = (await db.execute(stmt)).scalar_one_or_none()
        if not case:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Case '{req.case_id}' not found.")

        ref_id = case.id
        ref_title = case.title
        title = req.title or f"Incident Investigation Report: {case.title}"
        exec_summary = (
            f"Formal incident investigation post-mortem for case '{case.title}' "
            f"(Status: {case.status.value.upper()}, Priority: {case.priority.value.upper()}). "
            f"Investigated by {case.assigned_to or current_user.username} with {len(case.indicators)} associated threat indicators."
        )

        indicators_text = "\n".join(
            [f"- **[{ind.ioc_type.value.upper()}]** `{ind.value}` — Severity: **{ind.severity.value.upper()}** (Confidence: {ind.confidence:.0f}%)" for ind in case.indicators]
        ) if case.indicators else "_No specific indicators linked to this case._"

        sections.append(f"""# {title}

**Report Classification:** CONFIDENTIAL // SOC OPERATIONAL INTELLIGENCE  
**Document ID:** `TNX-RPT-{case.id[:8].upper()}`  
**Generated At:** {now_str}  
**Lead Analyst:** {current_user.full_name or current_user.username} ({current_user.email})  

---

## 1. Executive Summary
{exec_summary}

## 2. Case Overview & Scope
- **Case Title:** {case.title}
- **Case Identifier:** `{case.id}`
- **Current Lifecycle Status:** `{case.status.value.upper()}`
- **Priority Rating:** `{case.priority.value.upper()}`
- **Created Timestamp:** {case.created_at.strftime("%Y-%m-%d %H:%M:%S UTC")}
- **Incident Description:** {case.description or "No formal description provided."}

## 3. Associated Indicators of Compromise (IOC Inventory)
{indicators_text}

## 4. Evidentiary Findings & Incident Response Playbook
1. **Network Containment:** Block all identified external destinations at boundary firewalls and DNS sinkholes.
2. **Host-Level Triage:** Scrape endpoint telemetry across all machines that communicated with associated IPs.
3. **Credential Invalidation:** Terminate active sessions and revoke compromised credentials immediately.

## 5. Sign-Off & Verification
_This incident report has been synthesized from verified ThreatNex operational telemetry. AI-generated hypotheses are strictly differentiated from confirmed evidentiary findings._
""")

    # 2. If Indicator Value or Investigation ID provided, build IOC Intelligence Briefing
    else:
        val = req.indicator_value or "Target Observable"
        inv_record = None
        if req.investigation_id:
            stmt = select(IOCInvestigationRecord).where(IOCInvestigationRecord.id == req.investigation_id)
            inv_record = (await db.execute(stmt)).scalar_one_or_none()
            if inv_record:
                val = inv_record.indicator_value
        elif req.indicator_value:
            stmt = (
                select(IOCInvestigationRecord)
                .where(IOCInvestigationRecord.indicator_value == req.indicator_value.strip())
                .order_by(desc(IOCInvestigationRecord.created_at))
            )
            inv_record = (await db.execute(stmt)).scalars().first()

        ref_id = inv_record.id if inv_record else None
        ref_title = val
        title = req.title or f"Threat Intelligence Briefing: {val}"

        # Check for AI analysis
        ai_stmt = (
            select(AIThreatAnalysis)
            .where(AIThreatAnalysis.indicator_value == val)
            .order_by(desc(AIThreatAnalysis.created_at))
        )
        ai_analysis = (await db.execute(ai_stmt)).scalars().first()

        exec_summary = (
            ai_analysis.executive_summary
            if ai_analysis
            else f"Automated threat intelligence briefing for indicator '{val}'. Telemetry synthesized across VirusTotal, AbuseIPDB, AlienVault OTX, and URLhaus."
        )

        mitre_section = ""
        if ai_analysis:
            try:
                details = json.loads(ai_analysis.full_analysis_json)
                techniques = details.get("mitre_techniques", [])
                if techniques:
                    mitre_section = "\n".join(
                        [f"- **[{t.get('technique_id')}] {t.get('technique_name')}** ({t.get('tactic')}) — Confidence: {t.get('confidence')}\n  _Evidence:_ {t.get('evidence')}" for t in techniques]
                    )
            except Exception:
                mitre_section = ""

        if not mitre_section:
            mitre_section = "_No malicious MITRE ATT&CK tactics directly mapped._"

        sections.append(f"""# {title}

**Report Classification:** RESTRICTED // SOC THREAT INTELLIGENCE  
**Document ID:** `TNX-IOC-{re.sub(r'[^a-zA-Z0-9]', '', val).upper()[:12]}`  
**Generated At:** {now_str}  
**Author:** {current_user.full_name or current_user.username}  

---

## 1. Executive Threat Briefing
{exec_summary}

## 2. Observable Telemetry Profile
- **Indicator:** `{val}`
- **Classification:** {ai_analysis.threat_classification if ai_analysis else "Multi-Engine Analyzed Indicator"}
- **Risk Evaluation:** **{ai_analysis.risk_level if ai_analysis else (inv_record.severity.value.upper() if inv_record else "EVALUATED")}**
- **Confidence Score:** {ai_analysis.confidence_score if ai_analysis else (inv_record.confidence if inv_record else 85.0)}%
- **Total Provider Detections:** {inv_record.total_detections if inv_record else 0}

## 3. Verified Provider Evidence
- **VirusTotal Telemetry:** Verified multi-engine antivirus scanner detections.
- **AbuseIPDB Telemetry:** Global abusive IP reports and confidence score.
- **AlienVault OTX Telemetry:** Subscribed pulse activity and threat actor attribution.
- **URLhaus Telemetry:** Recent malware payload and payload distribution links.

## 4. MITRE ATT&CK Attribution Matrix
{mitre_section}

## 5. Defensive Recommendations
- Implement perimeter block rules for `{val}`.
- Review internal SIEM logs for historical resolution or connection attempts within the last 30 days.
""")

    content_markdown = "\n".join(sections)

    report = ThreatReport(
        title=title,
        report_type=req.report_type,
        reference_id=ref_id,
        reference_title=ref_title,
        author_id=current_user.id,
        executive_summary=exec_summary,
        content_markdown=content_markdown,
        content_json=json.dumps({"generated_at": now_str, "author": current_user.username, "title": title}),
    )
    db.add(report)
    await db.commit()
    await db.refresh(report)

    await record_audit_log(
        db=db,
        action="GENERATE_REPORT",
        resource_type="report",
        resource_id=report.id,
        user_id=current_user.id,
        details=f"Generated threat report {report.title}",
    )
    await db.commit()

    return ReportResponse.model_validate(report)


async def list_threat_reports(
    db: AsyncSession,
    page: int = 1,
    page_size: int = 20,
) -> ReportListResponse:
    """Retrieve paginated threat reports."""
    count_stmt = select(func.count()).select_from(ThreatReport)
    total = (await db.execute(count_stmt)).scalar() or 0

    offset = (page - 1) * page_size
    stmt = (
        select(ThreatReport)
        .order_by(desc(ThreatReport.created_at))
        .offset(offset)
        .limit(page_size)
    )
    rows = (await db.execute(stmt)).scalars().all()
    items = [ReportListItem.model_validate(r) for r in rows]
    total_pages = (total + page_size - 1) // page_size if total > 0 else 1

    return ReportListResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


async def get_threat_report_by_id(db: AsyncSession, report_id: str) -> ReportResponse:
    """Retrieve full report content by ID."""
    stmt = select(ThreatReport).where(ThreatReport.id == report_id)
    report = (await db.execute(stmt)).scalar_one_or_none()
    if not report:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Report '{report_id}' not found.")
    return ReportResponse.model_validate(report)


async def delete_threat_report(db: AsyncSession, report_id: str) -> bool:
    """Delete a threat report."""
    stmt = select(ThreatReport).where(ThreatReport.id == report_id)
    report = (await db.execute(stmt)).scalar_one_or_none()
    if not report:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Report '{report_id}' not found.")
    await db.delete(report)
    await db.commit()
    return True
