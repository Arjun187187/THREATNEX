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
