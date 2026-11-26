"""Indicator REST API routes."""
from typing import List
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.modules.auth.models import User
from app.modules.indicators.schemas import (
    IOCValidationRequest,
    IOCValidationResponse,
    IndicatorCreate,
    IndicatorResponse,
)
from app.modules.indicators.service import (
    validate_indicator,
    get_or_create_indicator,
    search_indicators,
)

router = APIRouter(prefix="/indicators", tags=["Indicators of Compromise"])


@router.post("/validate", response_model=IOCValidationResponse)
async def validate_ioc(
    payload: IOCValidationRequest,
    _: User = Depends(get_current_user),
):
    """Validate and auto-detect an IOC format (IPv4, IPv6, Domain, URL, Hashes, CVE)."""
    return await validate_indicator(payload)


@router.post("/", response_model=IndicatorResponse, status_code=status.HTTP_201_CREATED)
async def create_indicator(
    payload: IndicatorCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Register or get an indicator in the threat inventory."""
    return await get_or_create_indicator(db, payload)


@router.get("/search", response_model=List[IndicatorResponse])
async def search(
    q: str = Query(..., min_length=1, description="Search query for IOC value or tags"),
    limit: int = Query(default=50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Search registered indicators across the platform."""
    return await search_indicators(db, query=q, limit=limit)
