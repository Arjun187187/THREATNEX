"""Investigation business logic."""
from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_
from fastapi import HTTPException, status
from app.modules.investigations.models import Investigation, InvestigationStatus
from app.modules.investigations.schemas import InvestigationCreate, InvestigationUpdate
from app.modules.indicators.service import get_or_create_indicator
from app.modules.indicators.schemas import IndicatorCreate


async def create_investigation(
    db: AsyncSession,
    data: InvestigationCreate,
    owner_id: str
) -> Investigation:
    """Creates a new investigation case and attaches any provided indicators."""
    indicators = []
    if data.indicator_values:
        for val in data.indicator_values:
            val_clean = val.strip()
            if val_clean:
                ind = await get_or_create_indicator(db, IndicatorCreate(value=val_clean))
                indicators.append(ind)

    inv = Investigation(
        title=data.title,
        description=data.description,
        priority=data.priority,
        status=InvestigationStatus.OPEN,
        owner_id=owner_id,
        assigned_to=data.assigned_to,
        indicators=indicators,
    )
    db.add(inv)
    await db.commit()
    await db.refresh(inv)
    return inv


async def list_investigations(
    db: AsyncSession,
    current_user_id: str,
    user_roles: List[str],
    current_username: str,
    status_filter: Optional[InvestigationStatus] = None,
    limit: int = 50,
    offset: int = 0
) -> List[Investigation]:
    """
    Retrieves paginated investigations with strict database-level authorization.
    Admins can view all investigations.
    Analysts can ONLY view investigations they own, are assigned to, or are unassigned.
    """
    stmt = select(Investigation).order_by(Investigation.created_at.desc())

    # Strict multi-tenant / ownership filtering at SQL query level
    if "Admin" not in user_roles:
        stmt = stmt.where(
            or_(
                Investigation.owner_id == current_user_id,
                Investigation.assigned_to == current_username,
                Investigation.assigned_to.is_(None),
            )
        )

    if status_filter:
        stmt = stmt.where(Investigation.status == status_filter)

    stmt = stmt.limit(limit).offset(offset)
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def get_investigation_by_id(db: AsyncSession, inv_id: str) -> Investigation:
    """Retrieves an investigation by UUID."""
    stmt = select(Investigation).where(Investigation.id == inv_id)
    result = await db.execute(stmt)
    inv = result.scalar_one_or_none()
    if not inv:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Investigation case not found")
    return inv


async def update_investigation(
    db: AsyncSession,
    inv_id: str,
    update_data: InvestigationUpdate
) -> Investigation:
    """Updates an existing investigation case."""
    inv = await get_investigation_by_id(db, inv_id)

    if update_data.title is not None:
        inv.title = update_data.title
    if update_data.description is not None:
        inv.description = update_data.description
    if update_data.status is not None:
        inv.status = update_data.status
    if update_data.priority is not None:
        inv.priority = update_data.priority
    if update_data.assigned_to is not None:
        inv.assigned_to = update_data.assigned_to

    if update_data.indicator_values is not None:
        new_indicators = []
        for val in update_data.indicator_values:
            val_clean = val.strip()
            if val_clean:
                ind = await get_or_create_indicator(db, IndicatorCreate(value=val_clean))
                new_indicators.append(ind)
        inv.indicators = new_indicators

    await db.commit()
    await db.refresh(inv)
    return inv
