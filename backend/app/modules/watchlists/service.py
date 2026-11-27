"""Threat Watchlists database service layer."""
from typing import List, Optional
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc, update
from fastapi import HTTPException, status
from app.modules.watchlists.models import Watchlist, WatchlistIndicator
from app.modules.watchlists.schemas import (
    WatchlistCreate,
    WatchlistUpdate,
    WatchlistResponse,
    WatchlistDetailResponse,
    WatchlistIndicatorCreate,
    WatchlistIndicatorResponse,
    WatchlistCheckResponse,
    WatchlistCheckMatch,
)
from app.modules.indicators.validator import validate_ioc_value


async def list_watchlists(db: AsyncSession) -> List[WatchlistResponse]:
    """Retrieve all watchlists with indicator counts and total matches."""
    stmt = select(Watchlist).order_by(desc(Watchlist.created_at))
    watchlists = (await db.execute(stmt)).scalars().all()

    results = []
    for wl in watchlists:
        ind_count = len(wl.indicators)
        total_matches = sum(ind.matches_count for ind in wl.indicators)
        results.append(
            WatchlistResponse(
                id=wl.id,
                name=wl.name,
                description=wl.description,
                category=wl.category,
                severity=wl.severity,
                owner_id=wl.owner_id,
                is_active=wl.is_active,
                indicators_count=ind_count,
                total_matches=total_matches,
                created_at=wl.created_at,
                updated_at=wl.updated_at,
            )
        )
    return results


async def create_watchlist(
    db: AsyncSession,
    data: WatchlistCreate,
    owner_id: Optional[str] = None,
) -> WatchlistResponse:
    """Create a new watchlist."""
    wl = Watchlist(
        name=data.name.strip(),
        description=data.description.strip() if data.description else None,
        category=data.category.strip(),
        severity=data.severity.strip().lower(),
        owner_id=owner_id,
        is_active=True,
    )
    db.add(wl)
    await db.commit()
    await db.refresh(wl)
    return WatchlistResponse(
        id=wl.id,
        name=wl.name,
        description=wl.description,
        category=wl.category,
        severity=wl.severity,
        owner_id=wl.owner_id,
        is_active=wl.is_active,
        indicators_count=0,
        total_matches=0,
        created_at=wl.created_at,
        updated_at=wl.updated_at,
    )


async def get_watchlist_detail(
    db: AsyncSession,
    watchlist_id: str,
) -> WatchlistDetailResponse:
    """Retrieve watchlist with full indicator collection."""
    stmt = select(Watchlist).where(Watchlist.id == watchlist_id)
    wl = (await db.execute(stmt)).scalar_one_or_none()
    if not wl:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Watchlist '{watchlist_id}' not found.",
        )

    # Check for expired indicators
    now = datetime.now(timezone.utc)
    for ind in wl.indicators:
        if ind.expires_at and ind.expires_at < now and ind.status == "active":
            ind.status = "expired"
    await db.commit()

    ind_count = len(wl.indicators)
    total_matches = sum(ind.matches_count for ind in wl.indicators)

    indicator_responses = [
        WatchlistIndicatorResponse.model_validate(ind) for ind in wl.indicators
    ]

    return WatchlistDetailResponse(
        id=wl.id,
        name=wl.name,
        description=wl.description,
        category=wl.category,
        severity=wl.severity,
        owner_id=wl.owner_id,
        is_active=wl.is_active,
        indicators_count=ind_count,
        total_matches=total_matches,
        indicators=indicator_responses,
        created_at=wl.created_at,
        updated_at=wl.updated_at,
    )


async def update_watchlist(
    db: AsyncSession,
    watchlist_id: str,
    data: WatchlistUpdate,
) -> WatchlistResponse:
    """Update watchlist metadata."""
    stmt = select(Watchlist).where(Watchlist.id == watchlist_id)
    wl = (await db.execute(stmt)).scalar_one_or_none()
    if not wl:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Watchlist '{watchlist_id}' not found.",
        )

    if data.name is not None:
        wl.name = data.name.strip()
    if data.description is not None:
        wl.description = data.description.strip()
    if data.category is not None:
        wl.category = data.category.strip()
    if data.severity is not None:
        wl.severity = data.severity.strip().lower()
    if data.is_active is not None:
        wl.is_active = data.is_active

    await db.commit()
    await db.refresh(wl)

    return WatchlistResponse(
        id=wl.id,
        name=wl.name,
        description=wl.description,
        category=wl.category,
        severity=wl.severity,
        owner_id=wl.owner_id,
        is_active=wl.is_active,
        indicators_count=len(wl.indicators),
        total_matches=sum(ind.matches_count for ind in wl.indicators),
        created_at=wl.created_at,
        updated_at=wl.updated_at,
    )


async def delete_watchlist(db: AsyncSession, watchlist_id: str) -> bool:
    """Delete watchlist and cascade remove all assigned indicators."""
    stmt = select(Watchlist).where(Watchlist.id == watchlist_id)
    wl = (await db.execute(stmt)).scalar_one_or_none()
    if not wl:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Watchlist '{watchlist_id}' not found.",
        )
    await db.delete(wl)
    await db.commit()
    return True


async def add_indicator(
    db: AsyncSession,
    watchlist_id: str,
    data: WatchlistIndicatorCreate,
) -> WatchlistIndicatorResponse:
    """Add a new target indicator to a watchlist."""
    stmt = select(Watchlist).where(Watchlist.id == watchlist_id)
    wl = (await db.execute(stmt)).scalar_one_or_none()
    if not wl:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Watchlist '{watchlist_id}' not found.",
        )

    val = data.indicator_value.strip()

    # Check for existing indicator in this watchlist
    check_stmt = select(WatchlistIndicator).where(
        WatchlistIndicator.watchlist_id == watchlist_id,
        WatchlistIndicator.indicator_value == val,
    )
    existing = (await db.execute(check_stmt)).scalar_one_or_none()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Indicator '{val}' is already present in this watchlist.",
        )

    # Auto-detect IOC type if not passed
    detected_type = data.ioc_type
    if not detected_type:
        _, detected, _ = validate_ioc_value(val)
        detected_type = detected.value if detected else "domain"

    new_ind = WatchlistIndicator(
        watchlist_id=watchlist_id,
        indicator_value=val,
        ioc_type=detected_type.lower(),
        severity=(data.severity or wl.severity).lower(),
        confidence=data.confidence or 80.0,
        notes=data.notes,
        status="active",
        expires_at=data.expires_at,
    )
    db.add(new_ind)
    await db.commit()
    await db.refresh(new_ind)
    return WatchlistIndicatorResponse.model_validate(new_ind)


async def remove_indicator(
    db: AsyncSession,
    watchlist_id: str,
    indicator_id: str,
) -> bool:
    """Remove an indicator from a watchlist."""
    stmt = select(WatchlistIndicator).where(
        WatchlistIndicator.watchlist_id == watchlist_id,
        WatchlistIndicator.id == indicator_id,
    )
    ind = (await db.execute(stmt)).scalar_one_or_none()
    if not ind:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Indicator not found in this watchlist.",
        )
    await db.delete(ind)
    await db.commit()
    return True


async def check_indicator_match(
    db: AsyncSession,
    indicator_value: str,
) -> WatchlistCheckResponse:
    """
    Checks an observable value across all active watchlists.
    Increments matches count and logs match time if found.
    """
    clean_val = indicator_value.strip()
    stmt = (
        select(WatchlistIndicator, Watchlist)
        .join(Watchlist, Watchlist.id == WatchlistIndicator.watchlist_id)
        .where(
            WatchlistIndicator.indicator_value == clean_val,
            WatchlistIndicator.status == "active",
            Watchlist.is_active == True,
        )
    )
    rows = (await db.execute(stmt)).all()

    matches = []
    now = datetime.now(timezone.utc)

    for ind, wl in rows:
        ind.matches_count += 1
        ind.last_matched_at = now
        matches.append(
            WatchlistCheckMatch(
                watchlist_id=wl.id,
                watchlist_name=wl.name,
                category=wl.category,
                severity=ind.severity,
                indicator_id=ind.id,
                indicator_value=ind.indicator_value,
                matches_count=ind.matches_count,
            )
        )

    if matches:
        await db.commit()

    return WatchlistCheckResponse(
        matched=len(matches) > 0,
        indicator_value=clean_val,
        matches=matches,
    )
