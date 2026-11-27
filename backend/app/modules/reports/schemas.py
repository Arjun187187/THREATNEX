"""Pydantic schemas for Threat Reports."""
from typing import Optional, List, Dict, Any
from datetime import datetime
from pydantic import BaseModel, Field, ConfigDict


class ReportGenerateRequest(BaseModel):
    title: Optional[str] = Field(None, max_length=255)
    report_type: str = Field(default="incident_case", description="incident_case, ioc_briefing, executive_summary")
    case_id: Optional[str] = None
    investigation_id: Optional[str] = None
    indicator_value: Optional[str] = None
    include_ai_synthesis: bool = True


class ReportResponse(BaseModel):
    id: str
    title: str
    report_type: str
    reference_id: Optional[str] = None
    reference_title: Optional[str] = None
    author_id: Optional[str] = None
    executive_summary: str
    content_markdown: str
    content_json: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


class ReportListItem(BaseModel):
    id: str
    title: str
    report_type: str
    reference_id: Optional[str] = None
    reference_title: Optional[str] = None
    author_id: Optional[str] = None
    executive_summary: str
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


class ReportListResponse(BaseModel):
    items: List[ReportListItem]
    total: int
    page: int
    page_size: int
    total_pages: int
