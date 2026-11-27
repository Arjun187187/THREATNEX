"""Pydantic schemas for SOC Policies and Settings."""
from typing import Optional, Dict, Any
from datetime import datetime
from pydantic import BaseModel, Field


class ScoringWeightsSchema(BaseModel):
    virustotal_weight: float = Field(default=35.0, ge=0.0, le=100.0)
    abuseipdb_weight: float = Field(default=25.0, ge=0.0, le=100.0)
    alienvault_weight: float = Field(default=20.0, ge=0.0, le=100.0)
    urlhaus_weight: float = Field(default=20.0, ge=0.0, le=100.0)


class AlertThresholdsSchema(BaseModel):
    min_confidence_to_alert: float = Field(default=75.0, ge=0.0, le=100.0)
    auto_escalate_critical: bool = True
    deduplication_window_hours: int = Field(default=24, ge=1, le=168)
    require_analyst_resolution_notes: bool = True


class RetentionPoliciesSchema(BaseModel):
    audit_log_retention_days: int = Field(default=365, ge=30, le=3650)
    feed_retention_days: int = Field(default=90, ge=7, le=730)
    closed_investigation_retention_days: int = Field(default=180, ge=30, le=3650)


class ProviderConfigurationStatus(BaseModel):
    provider_name: str
    is_configured: bool
    status_label: str  # "Configured (Active)", "Unconfigured (Missing Key)", "Unrestricted Public Feed"
    quota_tier: str


class SOCSettingsResponse(BaseModel):
    scoring_weights: ScoringWeightsSchema
    alert_thresholds: AlertThresholdsSchema
    retention_policies: RetentionPoliciesSchema
    provider_statuses: Dict[str, ProviderConfigurationStatus]
    last_updated: datetime
    updated_by: Optional[str] = None


class ScoringWeightsUpdate(BaseModel):
    virustotal_weight: float = Field(..., ge=0.0, le=100.0)
    abuseipdb_weight: float = Field(..., ge=0.0, le=100.0)
    alienvault_weight: float = Field(..., ge=0.0, le=100.0)
    urlhaus_weight: float = Field(..., ge=0.0, le=100.0)


class AlertThresholdsUpdate(BaseModel):
    min_confidence_to_alert: float = Field(..., ge=0.0, le=100.0)
    auto_escalate_critical: bool
    deduplication_window_hours: int = Field(..., ge=1, le=168)
    require_analyst_resolution_notes: bool
