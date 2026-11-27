"""Threat Watchlists REST API routes."""
from typing import List
from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.modules.auth.models import User
from app.modules.watchlists.schemas import (
    WatchlistCreate,
    WatchlistUpdate,
    WatchlistResponse,
    WatchlistDetailResponse,
    WatchlistIndicatorCreate,
    WatchlistIndicatorResponse,
    WatchlistCheckRequest,
    WatchlistCheckResponse,
)
from app.modules.watchlists.service import (
    list_watchlists,
    create_watchlist,
    get_watchlist_detail,
    update_watchlist,
    delete_watchlist,
    add_indicator,
    remove_indicator,
    check_indicator_match,
)

router = APIRouter(prefix="/watchlists", tags=["Threat Watchlists"])


@router.get("/", response_model=List[WatchlistResponse], status_code=status.HTTP_200_OK)
async def get_all_watchlists(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Retrieve all high-priority threat watchlists with indicator counts."""
    return await list_watchlists(db=db)


@router.post("/", response_model=WatchlistResponse, status_code=status.HTTP_201_CREATED)
async def create_new_watchlist(
    payload: WatchlistCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new targeted threat watchlist."""
    return await create_watchlist(db=db, data=payload, owner_id=current_user.id)


@router.get("/{watchlist_id}", response_model=WatchlistDetailResponse, status_code=status.HTTP_200_OK)
async def get_watchlist(
    watchlist_id: str,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Retrieve a watchlist with all active and monitored indicators."""
    return await get_watchlist_detail(db=db, watchlist_id=watchlist_id)


@router.put("/{watchlist_id}", response_model=WatchlistResponse, status_code=status.HTTP_200_OK)
async def edit_watchlist(
    watchlist_id: str,
    payload: WatchlistUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Update watchlist details or toggle active status."""
    return await update_watchlist(db=db, watchlist_id=watchlist_id, data=payload)


@router.delete("/{watchlist_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_watchlist(
    watchlist_id: str,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Delete a threat watchlist and all associated indicators."""
    await delete_watchlist(db=db, watchlist_id=watchlist_id)


@router.post("/{watchlist_id}/indicators", response_model=WatchlistIndicatorResponse, status_code=status.HTTP_201_CREATED)
async def add_indicator_to_watchlist(
    watchlist_id: str,
    payload: WatchlistIndicatorCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Add a monitored observable (IP, domain, hash, URL) to a watchlist."""
    return await add_indicator(db=db, watchlist_id=watchlist_id, data=payload)


@router.delete("/{watchlist_id}/indicators/{indicator_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_indicator_from_watchlist(
    watchlist_id: str,
    indicator_id: str,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Remove a monitored indicator from a watchlist."""
    await remove_indicator(db=db, watchlist_id=watchlist_id, indicator_id=indicator_id)


@router.post("/check", response_model=WatchlistCheckResponse, status_code=status.HTTP_200_OK)
async def check_observable_watchlists(
    payload: WatchlistCheckRequest,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """
    Check if an observable matches any active watchlist in real-time.
    Increments match telemetry counters.
    """
    return await check_indicator_match(db=db, indicator_value=payload.indicator_value)
