"""Security Alerts database service layer."""
import json
import logging
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc, or_
from fastapi import HTTPException, status
from app.modules.alerts.models import SecurityAlert
from app.modules.alerts.schemas import (
    AlertCreate,
    AlertResponse,
    AlertListResponse,
    AlertStatsResponse,
    AlertResolveRequest,
    AlertEscalateRequest,
)
from app.modules.investigations.models import Investigation, InvestigationPriority, InvestigationStatus
from app.modules.indicators.validator import validate_ioc_value
from app.modules.audit.service import record_audit_log
from app.modules.auth.models import User

logger = logging.getLogger(__name__)


def _format_alert_response(alert: SecurityAlert) -> AlertResponse:
    evidence_dict = None
    if alert.raw_evidence_json:
        try:
            evidence_dict = json.loads(alert.raw_evidence_json)
        except Exception:
            evidence_dict = {}

    return AlertResponse(
        id=alert.id,
        title=alert.title,
        description=alert.description,
        indicator_value=alert.indicator_value,
        ioc_type=alert.ioc_type,
        severity=alert.severity,
        status=alert.status,
        source_rule=alert.source_rule,
        confidence=alert.confidence,
        assigned_to=alert.assigned_to,
        case_id=alert.case_id,
        raw_evidence=evidence_dict,
        acknowledged_by=alert.acknowledged_by,
        acknowledged_at=alert.acknowledged_at,
        resolved_by=alert.resolved_by,
        resolved_at=alert.resolved_at,
        resolution_notes=alert.resolution_notes,
        created_at=alert.created_at,
        updated_at=alert.updated_at,
    )


async def create_alert(
    db: AsyncSession,
    data: AlertCreate,
    created_by_user: Optional[User] = None,
) -> AlertResponse:
    """
    Creates a new security alert with intelligent deduplication.
    If an open alert exists for the same indicator and rule within 24 hours, updates it.
    """
    clean_val = data.indicator_value.strip()
    now = datetime.now(timezone.utc)
    one_day_ago = now - timedelta(days=1)

    # Deduplication check
    stmt = (
        select(SecurityAlert)
        .where(
            SecurityAlert.indicator_value == clean_val,
            SecurityAlert.source_rule == data.source_rule,
            SecurityAlert.status.in_(["open", "acknowledged"]),
            SecurityAlert.created_at >= one_day_ago,
        )
        .order_by(desc(SecurityAlert.created_at))
        .limit(1)
    )
    existing = (await db.execute(stmt)).scalars().first()

    evidence_json = json.dumps(data.raw_evidence) if data.raw_evidence else None

    if existing:
        existing.confidence = max(existing.confidence, data.confidence)
        existing.severity = data.severity.lower()
        if data.description:
            existing.description = data.description
        if evidence_json:
            existing.raw_evidence_json = evidence_json
        existing.updated_at = now
        await db.commit()
        await db.refresh(existing)
        return _format_alert_response(existing)

    detected_type = data.ioc_type
    if not detected_type:
        _, detected, _ = validate_ioc_value(clean_val)
        detected_type = detected.value if detected else "domain"

    new_alert = SecurityAlert(
        title=data.title.strip(),
        description=data.description,
        indicator_value=clean_val,
        ioc_type=detected_type.lower(),
        severity=data.severity.lower(),
        status="open",
        source_rule=data.source_rule,
        confidence=data.confidence,
        assigned_to=data.assigned_to,
        case_id=data.case_id,
        raw_evidence_json=evidence_json,
    )
    db.add(new_alert)
    await db.commit()
    await db.refresh(new_alert)

    if created_by_user:
        await record_audit_log(
            db=db,
            action="CREATE_ALERT",
            resource_type="alert",
            resource_id=new_alert.id,
            user_id=created_by_user.id,
            details=f"Generated alert {new_alert.title} for {new_alert.indicator_value}",
        )
        await db.commit()

    return _format_alert_response(new_alert)


async def list_alerts(
    db: AsyncSession,
    status_filter: Optional[str] = None,
    severity_filter: Optional[str] = None,
    search: Optional[str] = None,
    page: int = 1,
    page_size: int = 20,
) -> AlertListResponse:
    """Retrieve paginated alerts with multi-attribute filtering."""
    filters = []

    if status_filter and status_filter.lower() != "all":
        filters.append(SecurityAlert.status == status_filter.lower())
    if severity_filter and severity_filter.lower() != "all":
        filters.append(SecurityAlert.severity == severity_filter.lower())
    if search and search.strip():
        term = f"%{search.strip()}%"
        filters.append(
            or_(
                SecurityAlert.title.ilike(term),
                SecurityAlert.indicator_value.ilike(term),
                SecurityAlert.description.ilike(term),
                SecurityAlert.source_rule.ilike(term),
            )
        )

    count_stmt = select(func.count()).select_from(SecurityAlert)
    if filters:
        count_stmt = count_stmt.where(*filters)
    total = (await db.execute(count_stmt)).scalar() or 0

    offset = (page - 1) * page_size
    query_stmt = (
        select(SecurityAlert)
        .order_by(desc(SecurityAlert.created_at))
        .offset(offset)
        .limit(page_size)
    )
    if filters:
        query_stmt = query_stmt.where(*filters)

    alerts = (await db.execute(query_stmt)).scalars().all()
    items = [_format_alert_response(a) for a in alerts]
    total_pages = (total + page_size - 1) // page_size if total > 0 else 1

    return AlertListResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


async def get_alert_by_id(db: AsyncSession, alert_id: str) -> AlertResponse:
    """Retrieve a single alert by ID."""
    stmt = select(SecurityAlert).where(SecurityAlert.id == alert_id)
    alert = (await db.execute(stmt)).scalar_one_or_none()
    if not alert:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Security alert '{alert_id}' not found.",
        )
    return _format_alert_response(alert)


async def acknowledge_alert(
    db: AsyncSession,
    alert_id: str,
    user: User,
) -> AlertResponse:
    """Marks an alert as acknowledged by the current operator."""
    stmt = select(SecurityAlert).where(SecurityAlert.id == alert_id)
    alert = (await db.execute(stmt)).scalar_one_or_none()
    if not alert:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Security alert '{alert_id}' not found.",
        )

    alert.status = "acknowledged"
    alert.acknowledged_by = user.username
    alert.acknowledged_at = datetime.now(timezone.utc)
    if not alert.assigned_to:
        alert.assigned_to = user.username

    await db.commit()
    await db.refresh(alert)
    return _format_alert_response(alert)


async def resolve_alert(
    db: AsyncSession,
    alert_id: str,
    data: AlertResolveRequest,
    user: User,
) -> AlertResponse:
    """Resolves an alert with closing resolution notes."""
    stmt = select(SecurityAlert).where(SecurityAlert.id == alert_id)
    alert = (await db.execute(stmt)).scalar_one_or_none()
    if not alert:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Security alert '{alert_id}' not found.",
        )

    alert.status = "resolved"
    alert.resolved_by = user.username
    alert.resolved_at = datetime.now(timezone.utc)
    alert.resolution_notes = data.resolution_notes.strip()

    await db.commit()
    await db.refresh(alert)
    return _format_alert_response(alert)


async def escalate_alert(
    db: AsyncSession,
    alert_id: str,
    data: AlertEscalateRequest,
    user: User,
) -> AlertResponse:
    """Escalates an alert to an investigation case."""
    stmt = select(SecurityAlert).where(SecurityAlert.id == alert_id)
    alert = (await db.execute(stmt)).scalar_one_or_none()
    if not alert:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Security alert '{alert_id}' not found.",
        )

    target_case_id = data.case_id

    if not target_case_id and data.create_new_case:
        # Spawn a new investigation case
        case_title = data.case_title or f"Incident Investigation: {alert.title}"
        pri_map = {
            "critical": InvestigationPriority.CRITICAL,
            "high": InvestigationPriority.HIGH,
            "medium": InvestigationPriority.MEDIUM,
            "low": InvestigationPriority.LOW,
        }
        new_case = Investigation(
            title=case_title[:255],
            description=f"Escalated from Alert #{alert.id} ({alert.source_rule}).\nTarget Indicator: {alert.indicator_value}\nSeverity: {alert.severity.upper()}",
            priority=pri_map.get(alert.severity.lower(), InvestigationPriority.HIGH),
            status=InvestigationStatus.OPEN,
            owner_id=user.id,
            assigned_to=user.username,
        )
        db.add(new_case)
        await db.flush()
        target_case_id = new_case.id

    alert.status = "escalated"
    alert.case_id = target_case_id
    alert.updated_at = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(alert)

    await record_audit_log(
        db=db,
        action="ESCALATE_ALERT",
        resource_type="alert",
        resource_id=alert.id,
        user_id=user.id,
        details=f"Escalated alert {alert.id} to Case {target_case_id}",
    )
    await db.commit()

    return _format_alert_response(alert)


async def get_alert_statistics(db: AsyncSession) -> AlertStatsResponse:
    """Returns alert counts grouped by status and severity."""
    total = (await db.execute(select(func.count()).select_from(SecurityAlert))).scalar() or 0

    status_rows = (await db.execute(
        select(SecurityAlert.status, func.count()).group_by(SecurityAlert.status)
    )).all()
    by_status = {r[0]: r[1] for r in status_rows}

    sev_rows = (await db.execute(
        select(SecurityAlert.severity, func.count()).group_by(SecurityAlert.severity)
    )).all()
    by_severity = {r[0]: r[1] for r in sev_rows}

    return AlertStatsResponse(
        total_alerts=total,
        by_status=by_status,
        by_severity=by_severity,
    )
