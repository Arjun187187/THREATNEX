"""Pydantic schemas for Indicators."""
from typing import Optional
from datetime import datetime
from pydantic import BaseModel, Field, ConfigDict
from app.modules.indicators.models import IOCType, IOCSeverity


class IOCValidationRequest(BaseModel):
    value: str = Field(..., min_length=1, max_length=1000)
    expected_type: Optional[IOCType] = None


class IOCValidationResponse(BaseModel):
    value: str
    is_valid: bool
    ioc_type: Optional[IOCType] = None
    message: str


class IndicatorCreate(BaseModel):
    value: str
    ioc_type: Optional[IOCType] = None
    severity: IOCSeverity = IOCSeverity.UNKNOWN
    confidence: float = Field(default=0.0, ge=0.0, le=100.0)
    description: Optional[str] = None
    tags: Optional[str] = None


class IndicatorResponse(BaseModel):
    id: str
    value: str
    ioc_type: IOCType
    severity: IOCSeverity
    confidence: float
    description: Optional[str] = None
    tags: Optional[str] = None
    is_active: bool
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


class IOCEnrichmentRequest(BaseModel):
    value: str = Field(..., min_length=1, max_length=1000)
    save_to_inventory: bool = Field(default=False, description="Persist IOC into threat inventory database automatically")
    expected_type: Optional[IOCType] = None


class ProviderResultSchema(BaseModel):
    provider: str
    supported: bool = True
    status: str
    message: Optional[str] = None
    attribution: str
    source_timestamp: Optional[str] = None
    malicious: int = 0
    suspicious: int = 0
    harmless: int = 0
    undetected: int = 0
    reputation_score: Optional[float] = None
    confidence_score: Optional[float] = None
    verdict: str = "unknown"
    tags: list[str] = Field(default_factory=list)
    evidence: dict = Field(default_factory=dict)


class IOCEnrichmentResponse(BaseModel):
    value: str
    normalized_value: str
    ioc_type: IOCType
    is_valid: bool
    queried_at: datetime
    overall_verdict: str
    calculated_severity: IOCSeverity
    overall_confidence: float
    total_detections: int
    summary: str
    tags: list[str] = Field(default_factory=list)
    providers: list[ProviderResultSchema] = Field(default_factory=list)
    saved_in_inventory: bool = False
    indicator_id: Optional[str] = None
    investigation_record_id: Optional[str] = None


class IOCInvestigationHistoryResponse(BaseModel):
    id: str
    indicator_value: str
    ioc_type: IOCType
    verdict: str
    severity: IOCSeverity
    confidence: float
    total_detections: int
    summary: Optional[str] = None
    user_id: Optional[str] = None
    indicator_id: Optional[str] = None
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

