"""Threat Intelligence Feed REST API routes."""
from typing import Optional, List
from fastapi import APIRouter, Depends, Query, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.modules.auth.models import User
from app.modules.threat_intel.schemas import (
    ThreatFeedItemResponse,
    ThreatFeedListResponse,
    FeedProviderStatus,
    FeedStatsResponse,
    FeedSyncRequest,
    FeedSyncResponse,
)
from app.modules.threat_intel.feed_service import (
    get_threat_feed_items,
    get_threat_feed_item_by_id,
    get_feed_provider_statuses,
    get_feed_statistics,
    sync_all_threat_feeds,
)

router = APIRouter(prefix="/threat-intel", tags=["Threat Intelligence Feed"])


@router.get("/feed", response_model=ThreatFeedListResponse, status_code=status.HTTP_200_OK)
async def list_threat_feed(
    q: Optional[str] = Query(None, description="Search indicator value, description, or tags"),
    ioc_type: Optional[str] = Query(None, description="Filter by IOC type (ipv4, domain, url, sha256, cve)"),
    provider: Optional[str] = Query(None, description="Filter by provider name"),
    severity: Optional[str] = Query(None, description="Filter by severity level (critical, high, medium, low)"),
    threat_category: Optional[str] = Query(None, description="Filter by threat category"),
    min_confidence: Optional[float] = Query(None, description="Minimum confidence score threshold"),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(25, ge=1, le=100, description="Items per page"),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """
    Retrieve real-time ingested threat intelligence feed items.
    Supports multi-attribute filtering, full-text indicator search, and pagination.
    """
    return await get_threat_feed_items(
        db=db,
        q=q,
        ioc_type=ioc_type,
        provider=provider,
        severity=severity,
        threat_category=threat_category,
        min_confidence=min_confidence,
        page=page,
        page_size=page_size,
    )


@router.get("/feed/{item_id}", response_model=ThreatFeedItemResponse, status_code=status.HTTP_200_OK)
async def get_threat_feed_detail(
    item_id: str,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Retrieve full detail for a single threat feed item by ID."""
    item = await get_threat_feed_item_by_id(db=db, item_id=item_id)
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Threat feed item '{item_id}' not found.",
        )
    return item


@router.get("/providers/status", response_model=List[FeedProviderStatus], status_code=status.HTTP_200_OK)
async def get_providers_status(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """
    Retrieve operational status, quota info, and synchronization health for all configured threat intelligence feeds.
    """
    return await get_feed_provider_statuses(db=db)


@router.get("/stats", response_model=FeedStatsResponse, status_code=status.HTTP_200_OK)
async def get_feed_stats(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Retrieve real-time threat feed statistics and breakdown across types, severities, and providers."""
    return await get_feed_statistics(db=db)


@router.post("/sync", response_model=FeedSyncResponse, status_code=status.HTTP_200_OK)
async def sync_threat_feeds(
    payload: Optional[FeedSyncRequest] = None,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """
    Synchronizes threat intelligence feeds across configured providers.
    Fetches real provider telemetry from AlienVault OTX, URLhaus, CISA KEV, AbuseIPDB, and VirusTotal.
    """
    target_providers = payload.providers if payload else None
    return await sync_all_threat_feeds(db=db, target_providers=target_providers)
