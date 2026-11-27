"""Pydantic schemas for Threat Intelligence Feed."""
from typing import Optional, List, Dict, Any
from datetime import datetime
from pydantic import BaseModel, Field, ConfigDict


class ThreatFeedItemResponse(BaseModel):
    id: str
    indicator_value: str
    ioc_type: str
    provider: str
    source_feed: Optional[str] = None
    threat_category: str
    severity: str
    confidence: float
    description: Optional[str] = None
    tags: List[str] = Field(default_factory=list)
    external_reference: Optional[str] = None
    first_seen: Optional[datetime] = None
    last_seen: Optional[datetime] = None
    raw_metadata: Optional[Dict[str, Any]] = None
    is_active: bool = True
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ThreatFeedListResponse(BaseModel):
    items: List[ThreatFeedItemResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


class FeedProviderStatus(BaseModel):
    provider: str
    status: str  # "operational", "rate_limited", "degraded", "unconfigured", "unsupported", "pending"
    last_synced_at: Optional[datetime] = None
    items_count: int = 0
    last_error: Optional[str] = None
    attribution: str
    rate_limit_info: Optional[str] = None


class FeedStatsResponse(BaseModel):
    total_items: int
    by_severity: Dict[str, int]
    by_type: Dict[str, int]
    by_provider: Dict[str, int]
    last_sync_time: Optional[datetime] = None


class FeedSyncRequest(BaseModel):
    providers: Optional[List[str]] = Field(
        None,
        description="Optional list of specific providers to sync. If omitted, syncs all configured providers.",
    )


class ProviderSyncResult(BaseModel):
    provider: str
    status: str
    items_ingested: int
    items_updated: int
    error: Optional[str] = None
    duration_ms: float


class FeedSyncResponse(BaseModel):
    status: str
    message: str
    results: List[ProviderSyncResult]
    total_ingested: int
    total_updated: int
