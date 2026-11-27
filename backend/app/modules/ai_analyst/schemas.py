"""Pydantic schemas for AI Threat Analyst requests and structured responses."""
from typing import Optional, List, Dict, Any
from datetime import datetime
from pydantic import BaseModel, Field, ConfigDict


class MitreTechniqueSchema(BaseModel):
    technique_id: str = Field(..., description="MITRE ATT&CK technique identifier, e.g. T1071.001")
    technique_name: str = Field(..., description="Technique name, e.g. Web Protocols")
    tactic: str = Field(..., description="ATT&CK tactic, e.g. Command and Control")
    evidence: str = Field(..., description="Specific verified observable evidence supporting this mapping")
    confidence: str = Field(default="Medium", description="Confidence level: High, Medium, or Low")


class AIAnalysisDetailSchema(BaseModel):
    executive_summary: str
    threat_classification: str
    reasoning: str
    risk_level: str  # "CRITICAL", "HIGH", "MEDIUM", "LOW", "CLEAN", "UNKNOWN"
    confidence_score: float = Field(default=0.0, ge=0.0, le=100.0)
    provider_evidence_summary: Dict[str, str] = Field(default_factory=dict)
    confirmed_evidence: List[str] = Field(default_factory=list)
    hypotheses: List[str] = Field(default_factory=list)
    false_positive_analysis: str
    recommended_investigation_steps: List[str] = Field(default_factory=list)
    recommended_containment_actions: List[str] = Field(default_factory=list)
    mitre_techniques: List[MitreTechniqueSchema] = Field(default_factory=list)
    analyst_conclusion: str


class AIAnalysisRequest(BaseModel):
    investigation_id: Optional[str] = Field(None, description="ID of an existing IOC investigation from database")
    indicator_value: Optional[str] = Field(None, description="Observable value to analyze if not selecting by ID")
    ioc_type: Optional[str] = Field(None, description="Optional IOC format override")


class AIAnalysisResponse(BaseModel):
    id: str
    investigation_id: Optional[str] = None
    indicator_value: str
    ioc_type: str
    model_name: str
    risk_level: str
    threat_classification: str
    confidence_score: float
    executive_summary: str
    analysis_details: AIAnalysisDetailSchema
    operator_id: Optional[str] = None
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


class AIAnalysisListItem(BaseModel):
    id: str
    investigation_id: Optional[str] = None
    indicator_value: str
    ioc_type: str
    model_name: str
    risk_level: str
    threat_classification: str
    confidence_score: float
    executive_summary: str
    operator_id: Optional[str] = None
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)
