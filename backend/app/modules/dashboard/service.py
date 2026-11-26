"""Dashboard and SOC analytics schemas and service."""
from typing import Dict, Any, List
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.modules.indicators.models import Indicator, IOCType, IOCSeverity
from app.modules.investigations.models import Investigation, InvestigationStatus, InvestigationPriority


class DashboardStats(BaseModel):
    total_investigations: int
    open_investigations: int
    in_progress_investigations: int
    resolved_investigations: int
    total_indicators: int
    critical_high_indicators: int
    ioc_by_type: Dict[str, int]
    investigations_by_priority: Dict[str, int]


async def calculate_dashboard_stats(db: AsyncSession) -> DashboardStats:
    """Computes verified statistical summaries from real database entries."""
    # Investigations counts
    total_inv = (await db.execute(select(func.count(Investigation.id)))).scalar_one() or 0
    open_inv = (await db.execute(
        select(func.count(Investigation.id)).where(Investigation.status == InvestigationStatus.OPEN)
    )).scalar_one() or 0
    prog_inv = (await db.execute(
        select(func.count(Investigation.id)).where(Investigation.status == InvestigationStatus.IN_PROGRESS)
    )).scalar_one() or 0
    res_inv = (await db.execute(
        select(func.count(Investigation.id)).where(Investigation.status.in_([InvestigationStatus.RESOLVED, InvestigationStatus.CLOSED]))
    )).scalar_one() or 0

    # Indicator counts
    total_ind = (await db.execute(select(func.count(Indicator.id)))).scalar_one() or 0
    crit_high_ind = (await db.execute(
        select(func.count(Indicator.id)).where(Indicator.severity.in_([IOCSeverity.CRITICAL, IOCSeverity.HIGH]))
    )).scalar_one() or 0

    # Counts by IOC type
    ioc_types_stmt = select(Indicator.ioc_type, func.count(Indicator.id)).group_by(Indicator.ioc_type)
    ioc_type_rows = (await db.execute(ioc_types_stmt)).all()
    ioc_by_type = {t.value: count for t, count in ioc_type_rows}

    # Counts by priority
    priority_stmt = select(Investigation.priority, func.count(Investigation.id)).group_by(Investigation.priority)
    prio_rows = (await db.execute(priority_stmt)).all()
    investigations_by_priority = {p.value: count for p, count in prio_rows}

    return DashboardStats(
        total_investigations=total_inv,
        open_investigations=open_inv,
        in_progress_investigations=prog_inv,
        resolved_investigations=res_inv,
        total_indicators=total_ind,
        critical_high_indicators=crit_high_ind,
        ioc_by_type=ioc_by_type,
        investigations_by_priority=investigations_by_priority,
    )
