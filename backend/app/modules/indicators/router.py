"""Indicator REST API routes."""
from typing import List, Optional
from fastapi import APIRouter, Depends, Query, status, Request
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.modules.auth.models import User
from app.modules.indicators.schemas import (
    IOCValidationRequest,
    IOCValidationResponse,
    IndicatorCreate,
    IndicatorResponse,
    IOCEnrichmentRequest,
    IOCEnrichmentResponse,
    IOCInvestigationHistoryResponse,
)
from app.modules.indicators.service import (
    validate_indicator,
    get_or_create_indicator,
    search_indicators,
)
from app.modules.indicators.investigation_service import (
    investigate_ioc_coordinator,
    get_investigation_history,
)

router = APIRouter(prefix="/indicators", tags=["Indicators of Compromise"])


@router.post("/validate", response_model=IOCValidationResponse)
async def validate_ioc(
    payload: IOCValidationRequest,
    _: User = Depends(get_current_user),
):
    """Validate and auto-detect an IOC format (IPv4, IPv6, Domain, URL, Hashes, CVE)."""
    return await validate_indicator(payload)


@router.post("/investigate", response_model=IOCEnrichmentResponse)
async def investigate_ioc(
    payload: IOCEnrichmentRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Execute real multi-provider threat intelligence enrichment across
    VirusTotal, AbuseIPDB, AlienVault OTX, and URLhaus.
    """
    client_ip = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")
    return await investigate_ioc_coordinator(
        db=db,
        req=payload,
        current_user=current_user,
        client_ip=client_ip,
        user_agent=user_agent,
    )


@router.get("/investigations/history", response_model=List[IOCInvestigationHistoryResponse])
async def get_ioc_history(
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Retrieve historical IOC investigations and findings."""
    return await get_investigation_history(db=db, limit=limit, offset=offset)


@router.post("/", response_model=IndicatorResponse, status_code=status.HTTP_201_CREATED)
async def create_indicator(
    payload: IndicatorCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Register or update an indicator in the threat inventory."""
    return await get_or_create_indicator(db, payload)


@router.get("/search", response_model=List[IndicatorResponse])
async def search(
    q: Optional[str] = Query(default="", description="Search query for IOC value or tags"),
    limit: int = Query(default=50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Search registered indicators across the platform."""
    return await search_indicators(db, query=q or "", limit=limit)

