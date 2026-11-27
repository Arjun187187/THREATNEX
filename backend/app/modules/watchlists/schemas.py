"""Pydantic schemas for Threat Watchlists."""
from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel, Field, ConfigDict


class WatchlistIndicatorCreate(BaseModel):
    indicator_value: str = Field(..., min_length=1, max_length=500)
    ioc_type: Optional[str] = Field(None, description="Auto-detected if not specified")
    severity: Optional[str] = "high"
    confidence: Optional[float] = 80.0
    notes: Optional[str] = None
    expires_at: Optional[datetime] = None


class WatchlistIndicatorResponse(BaseModel):
    id: str
    watchlist_id: str
    indicator_value: str
    ioc_type: str
    severity: str
    confidence: float
    notes: Optional[str] = None
    status: str
    expires_at: Optional[datetime] = None
    matches_count: int
    last_matched_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


class WatchlistCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=150)
    description: Optional[str] = None
    category: str = Field(default="General Threat", max_length=100)
    severity: str = Field(default="high", max_length=50)


class WatchlistUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    severity: Optional[str] = None
    is_active: Optional[bool] = None


class WatchlistResponse(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    category: str
    severity: str
    owner_id: Optional[str] = None
    is_active: bool
    indicators_count: int = 0
    total_matches: int = 0
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


class WatchlistDetailResponse(WatchlistResponse):
    indicators: List[WatchlistIndicatorResponse] = Field(default_factory=list)


class WatchlistCheckRequest(BaseModel):
    indicator_value: str


class WatchlistCheckMatch(BaseModel):
    watchlist_id: str
    watchlist_name: str
    category: str
    severity: str
    indicator_id: str
    indicator_value: str
    matches_count: int


class WatchlistCheckResponse(BaseModel):
    matched: bool
    indicator_value: str
    matches: List[WatchlistCheckMatch]
