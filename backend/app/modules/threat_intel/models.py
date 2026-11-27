"""Threat Intelligence Feed SQLAlchemy database models."""
from typing import Optional
from datetime import datetime, timezone
from sqlalchemy import (
    String,
    Text,
    Float,
    Integer,
    Boolean,
    DateTime,
    Index,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base
from app.common.models import UUIDMixin, TimestampMixin


class ThreatFeedItem(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "threat_feed_items"

    indicator_value: Mapped[str] = mapped_column(String(500), index=True, nullable=False)
    ioc_type: Mapped[str] = mapped_column(String(50), index=True, nullable=False)
    provider: Mapped[str] = mapped_column(String(100), index=True, nullable=False)
    source_feed: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    threat_category: Mapped[str] = mapped_column(String(150), index=True, default="Threat Indicator", nullable=False)
    severity: Mapped[str] = mapped_column(String(50), default="high", index=True, nullable=False)
    confidence: Mapped[float] = mapped_column(Float, default=80.0, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    tags: Mapped[Optional[str]] = mapped_column(String(1000), nullable=True)
    external_reference: Mapped[Optional[str]] = mapped_column(String(1000), nullable=True)
    first_seen: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    last_seen: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True, index=True)
    raw_metadata_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    __table_args__ = (
        UniqueConstraint("provider", "indicator_value", name="uq_threat_feed_provider_indicator"),
        Index("ix_threat_feed_prov_type", "provider", "ioc_type"),
        Index("ix_threat_feed_cat_sev", "threat_category", "severity"),
    )


class FeedSyncLog(Base, UUIDMixin):
    __tablename__ = "feed_sync_logs"

    provider: Mapped[str] = mapped_column(String(100), index=True, nullable=False)
    status: Mapped[str] = mapped_column(String(50), nullable=False)  # "success", "partial", "failed", "rate_limited", "unsupported"
    items_ingested: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    items_updated: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    duration_ms: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    synced_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
        index=True,
    )

    __table_args__ = (
        Index("ix_feed_sync_prov_date", "provider", "synced_at"),
    )
