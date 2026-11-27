"""Pydantic schemas for Security Alerts."""
from typing import Optional, List, Dict, Any
from datetime import datetime
from pydantic import BaseModel, Field, ConfigDict


class AlertCreate(BaseModel):
    title: str = Field(..., min_length=3, max_length=255)
    description: Optional[str] = None
    indicator_value: str = Field(..., min_length=1, max_length=500)
    ioc_type: Optional[str] = None
    severity: str = Field(default="high")
    source_rule: str = Field(default="Automated Threat Detection")
    confidence: float = Field(default=80.0)
    assigned_to: Optional[str] = None
    case_id: Optional[str] = None
    raw_evidence: Optional[Dict[str, Any]] = None


class AlertAcknowledgeRequest(BaseModel):
    notes: Optional[str] = None


class AlertResolveRequest(BaseModel):
    resolution_notes: str = Field(..., min_length=3, description="Analyst closing notes")


class AlertEscalateRequest(BaseModel):
    case_id: Optional[str] = Field(None, description="Existing investigation case ID if linking to an active case")
    create_new_case: bool = Field(default=True, description="Whether to spawn a new investigation case if case_id not provided")
    case_title: Optional[str] = Field(None, description="Custom title for the newly spawned investigation case")
    priority: Optional[str] = Field(default="high")


class AlertResponse(BaseModel):
    id: str
    title: str
    description: Optional[str] = None
    indicator_value: str
    ioc_type: str
    severity: str
    status: str
    source_rule: str
    confidence: float
    assigned_to: Optional[str] = None
    case_id: Optional[str] = None
    raw_evidence: Optional[Dict[str, Any]] = None
    acknowledged_by: Optional[str] = None
    acknowledged_at: Optional[datetime] = None
    resolved_by: Optional[str] = None
    resolved_at: Optional[datetime] = None
    resolution_notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


class AlertListResponse(BaseModel):
    items: List[AlertResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


class AlertStatsResponse(BaseModel):
    total_alerts: int
    by_status: Dict[str, int]
    by_severity: Dict[str, int]
