"""Pydantic schemas for Investigations."""
from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel, Field, ConfigDict
from app.modules.investigations.models import InvestigationStatus, InvestigationPriority
from app.modules.indicators.schemas import IndicatorResponse


class InvestigationCreate(BaseModel):
    title: str = Field(..., min_length=3, max_length=255)
    description: Optional[str] = None
    priority: InvestigationPriority = InvestigationPriority.MEDIUM
    assigned_to: Optional[str] = None
    indicator_values: Optional[List[str]] = None


class InvestigationUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=3, max_length=255)
    description: Optional[str] = None
    status: Optional[InvestigationStatus] = None
    priority: Optional[InvestigationPriority] = None
    assigned_to: Optional[str] = None
    indicator_values: Optional[List[str]] = None


class InvestigationResponse(BaseModel):
    id: str
    title: str
    description: Optional[str] = None
    status: InvestigationStatus
    priority: InvestigationPriority
    owner_id: Optional[str] = None
    assigned_to: Optional[str] = None
    indicators: List[IndicatorResponse] = []
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)
