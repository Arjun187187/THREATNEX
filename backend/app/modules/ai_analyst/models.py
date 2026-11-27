"""AI Threat Analyst SQLAlchemy database models."""
from typing import Optional
from sqlalchemy import String, Text, Float, Index
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base
from app.common.models import UUIDMixin, TimestampMixin


class AIThreatAnalysis(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "ai_analyses"

    investigation_id: Mapped[Optional[str]] = mapped_column(String, index=True, nullable=True)
    indicator_value: Mapped[str] = mapped_column(String(500), index=True, nullable=False)
    ioc_type: Mapped[str] = mapped_column(String(50), index=True, nullable=False)
    model_name: Mapped[str] = mapped_column(String(100), nullable=False)
    risk_level: Mapped[str] = mapped_column(String(50), index=True, nullable=False)
    threat_classification: Mapped[str] = mapped_column(String(255), nullable=False)
    confidence_score: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    executive_summary: Mapped[str] = mapped_column(Text, nullable=False)
    full_analysis_json: Mapped[str] = mapped_column(Text, nullable=False)
    operator_id: Mapped[Optional[str]] = mapped_column(String, index=True, nullable=True)

    __table_args__ = (
        Index("ix_ai_analyses_indicator_val", "indicator_value"),
        Index("ix_ai_analyses_operator", "operator_id"),
    )
