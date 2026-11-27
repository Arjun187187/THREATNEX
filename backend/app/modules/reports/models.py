"""Threat Reports SQLAlchemy database models."""
from typing import Optional
from sqlalchemy import (
    String,
    Text,
    Index,
)
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base
from app.common.models import UUIDMixin, TimestampMixin


class ThreatReport(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "threat_reports"

    title: Mapped[str] = mapped_column(String(255), nullable=False)
    report_type: Mapped[str] = mapped_column(String(50), index=True, default="incident_case", nullable=False)  # incident_case, ioc_briefing, executive_summary
    reference_id: Mapped[Optional[str]] = mapped_column(String, index=True, nullable=True)
    reference_title: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    author_id: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    executive_summary: Mapped[str] = mapped_column(Text, nullable=False)
    content_markdown: Mapped[str] = mapped_column(Text, nullable=False)
    content_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    __table_args__ = (
        Index("ix_threat_reports_author", "author_id"),
    )
