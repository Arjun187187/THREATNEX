"""Security Alerts SQLAlchemy database models."""
from typing import Optional
from datetime import datetime
from sqlalchemy import (
    String,
    Text,
    Float,
    DateTime,
    ForeignKey,
    Index,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base
from app.common.models import UUIDMixin, TimestampMixin


class SecurityAlert(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "security_alerts"

    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    indicator_value: Mapped[str] = mapped_column(String(500), index=True, nullable=False)
    ioc_type: Mapped[str] = mapped_column(String(50), nullable=False)
    severity: Mapped[str] = mapped_column(String(50), index=True, default="high", nullable=False)  # critical, high, medium, low
    status: Mapped[str] = mapped_column(String(50), index=True, default="open", nullable=False)  # open, acknowledged, resolved, escalated
    source_rule: Mapped[str] = mapped_column(String(150), default="Automated Threat Detection", nullable=False)
    confidence: Mapped[float] = mapped_column(Float, default=80.0, nullable=False)
    assigned_to: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    case_id: Mapped[Optional[str]] = mapped_column(
        String, ForeignKey("investigations.id", ondelete="SET NULL"), index=True, nullable=True
    )
    raw_evidence_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    acknowledged_by: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    acknowledged_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    resolved_by: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    resolved_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    resolution_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    __table_args__ = (
        Index("ix_alerts_status_sev", "status", "severity"),
    )
