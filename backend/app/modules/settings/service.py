"""SOC Policies and Settings database service layer."""
import json
import logging
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.config import settings
from app.modules.settings.models import SOCSetting
from app.modules.settings.schemas import (
    SOCSettingsResponse,
    ScoringWeightsSchema,
    AlertThresholdsSchema,
    RetentionPoliciesSchema,
    ProviderConfigurationStatus,
    ScoringWeightsUpdate,
    AlertThresholdsUpdate,
)
from app.modules.auth.models import User
from app.modules.audit.service import record_audit_log

logger = logging.getLogger(__name__)

DEFAULT_SCORING_WEIGHTS = {
    "virustotal_weight": 35.0,
    "abuseipdb_weight": 25.0,
    "alienvault_weight": 20.0,
    "urlhaus_weight": 20.0,
}

DEFAULT_ALERT_THRESHOLDS = {
    "min_confidence_to_alert": 75.0,
    "auto_escalate_critical": True,
    "deduplication_window_hours": 24,
    "require_analyst_resolution_notes": True,
}

DEFAULT_RETENTION_POLICIES = {
    "audit_log_retention_days": 365,
    "feed_retention_days": 90,
    "closed_investigation_retention_days": 180,
}


def _get_provider_status_summary() -> dict:
    """Safely determines provider configuration states without exposing any secret keys."""
    return {
        "VirusTotal": ProviderConfigurationStatus(
            provider_name="VirusTotal v3",
            is_configured=bool(settings.VIRUSTOTAL_API_KEY and settings.VIRUSTOTAL_API_KEY.strip() not in ("", "None")),
            status_label="Configured (Active)" if settings.VIRUSTOTAL_API_KEY else "Unconfigured (Missing Key)",
            quota_tier="Standard / Public (4 req/min)",
        ),
        "AbuseIPDB": ProviderConfigurationStatus(
            provider_name="AbuseIPDB v2",
            is_configured=bool(settings.ABUSEIPDB_API_KEY and settings.ABUSEIPDB_API_KEY.strip() not in ("", "None")),
            status_label="Configured (Active)" if settings.ABUSEIPDB_API_KEY else "Unconfigured (Missing Key)",
            quota_tier="Standard Tier (1,000 req/day)",
        ),
        "AlienVault OTX": ProviderConfigurationStatus(
            provider_name="AlienVault OTX",
            is_configured=bool(settings.ALIENVAULT_OTX_API_KEY and settings.ALIENVAULT_OTX_API_KEY.strip() not in ("", "None")),
            status_label="Configured (Active)" if settings.ALIENVAULT_OTX_API_KEY else "Unconfigured (Missing Key)",
            quota_tier="Community Subscribed Pulses",
        ),
        "URLhaus": ProviderConfigurationStatus(
            provider_name="abuse.ch URLhaus",
            is_configured=bool(settings.URLHAUS_AUTH_KEY and settings.URLHAUS_AUTH_KEY.strip() not in ("", "None")),
            status_label="Configured (Auth-Key Active)" if settings.URLHAUS_AUTH_KEY else "Public Mode",
            quota_tier="Direct Real-Time Feed",
        ),
        "CISA KEV": ProviderConfigurationStatus(
            provider_name="CISA Known Exploited Vulnerabilities",
            is_configured=True,
            status_label="Unrestricted Public Feed",
            quota_tier="US-CERT Automated Catalog",
        ),
        "Google Gemini": ProviderConfigurationStatus(
            provider_name="Google Gemini AI Threat Analyst",
            is_configured=bool(settings.GEMINI_API_KEY and settings.GEMINI_API_KEY.strip() not in ("", "None")),
            status_label="Connected (gemini-flash-lite-latest)" if settings.GEMINI_API_KEY else "Unconfigured",
            quota_tier="Autonomous Threat Synthesis",
        ),
    }


async def get_soc_settings(db: AsyncSession) -> SOCSettingsResponse:
    """Retrieve all current SOC policies, weights, and provider status indicators."""
    now = datetime.now(timezone.utc)

    # 1. Scoring weights
    stmt = select(SOCSetting).where(SOCSetting.key == "scoring_weights")
    row_weights = (await db.execute(stmt)).scalar_one_or_none()
    weights_dict = json.loads(row_weights.value_json) if row_weights else DEFAULT_SCORING_WEIGHTS

    # 2. Alert thresholds
    stmt_alert = select(SOCSetting).where(SOCSetting.key == "alert_thresholds")
    row_alert = (await db.execute(stmt_alert)).scalar_one_or_none()
    alerts_dict = json.loads(row_alert.value_json) if row_alert else DEFAULT_ALERT_THRESHOLDS

    # 3. Retention policies
    stmt_ret = select(SOCSetting).where(SOCSetting.key == "retention_policies")
    row_ret = (await db.execute(stmt_ret)).scalar_one_or_none()
    ret_dict = json.loads(row_ret.value_json) if row_ret else DEFAULT_RETENTION_POLICIES

    latest_updated = max([r.updated_at for r in [row_weights, row_alert, row_ret] if r] or [now])
    last_user = next((r.updated_by for r in [row_weights, row_alert, row_ret] if r and r.updated_by), "System Default")

    return SOCSettingsResponse(
        scoring_weights=ScoringWeightsSchema(**weights_dict),
        alert_thresholds=AlertThresholdsSchema(**alerts_dict),
        retention_policies=RetentionPoliciesSchema(**ret_dict),
        provider_statuses=_get_provider_status_summary(),
        last_updated=latest_updated,
        updated_by=last_user,
    )


async def update_scoring_weights(
    db: AsyncSession,
    payload: ScoringWeightsUpdate,
    user: User,
) -> SOCSettingsResponse:
    """Update multi-engine threat calculation weights."""
    now = datetime.now(timezone.utc)
    weights_json = json.dumps(payload.model_dump())

    stmt = select(SOCSetting).where(SOCSetting.key == "scoring_weights")
    setting = (await db.execute(stmt)).scalar_one_or_none()

    if setting:
        setting.value_json = weights_json
        setting.updated_by = user.username
        setting.updated_at = now
    else:
        setting = SOCSetting(
            key="scoring_weights",
            value_json=weights_json,
            description="Normalized provider threat scoring weights",
            updated_by=user.username,
            updated_at=now,
        )
        db.add(setting)

    await db.commit()
    await record_audit_log(
        db=db,
        action="UPDATE_SOC_WEIGHTS",
        resource_type="settings",
        resource_id="scoring_weights",
        user_id=user.id,
        details=f"Updated risk scoring weights by {user.username}",
    )
    await db.commit()
    return await get_soc_settings(db)


async def update_alert_thresholds(
    db: AsyncSession,
    payload: AlertThresholdsUpdate,
    user: User,
) -> SOCSettingsResponse:
    """Update automated alert creation thresholds."""
    now = datetime.now(timezone.utc)
    alerts_json = json.dumps(payload.model_dump())

    stmt = select(SOCSetting).where(SOCSetting.key == "alert_thresholds")
    setting = (await db.execute(stmt)).scalar_one_or_none()

    if setting:
        setting.value_json = alerts_json
        setting.updated_by = user.username
        setting.updated_at = now
    else:
        setting = SOCSetting(
            key="alert_thresholds",
            value_json=alerts_json,
            description="Automated alert generation and deduplication thresholds",
            updated_by=user.username,
            updated_at=now,
        )
        db.add(setting)

    await db.commit()
    await record_audit_log(
        db=db,
        action="UPDATE_ALERT_THRESHOLDS",
        resource_type="settings",
        resource_id="alert_thresholds",
        user_id=user.id,
        details=f"Updated alert thresholds by {user.username}",
    )
    await db.commit()
    return await get_soc_settings(db)
