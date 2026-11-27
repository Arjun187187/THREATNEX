"""Threat Watchlists SQLAlchemy database models."""
from typing import Optional, List
from datetime import datetime
from sqlalchemy import (
    String,
    Text,
    Float,
    Integer,
    Boolean,
    DateTime,
    ForeignKey,
    Index,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base
from app.common.models import UUIDMixin, TimestampMixin


class Watchlist(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "watchlists"

    name: Mapped[str] = mapped_column(String(150), index=True, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    category: Mapped[str] = mapped_column(String(100), index=True, default="General Threat", nullable=False)
    severity: Mapped[str] = mapped_column(String(50), default="high", nullable=False)
    owner_id: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    indicators: Mapped[List["WatchlistIndicator"]] = relationship(
        "WatchlistIndicator",
        back_populates="watchlist",
        cascade="all, delete-orphan",
        lazy="selectin",
    )


class WatchlistIndicator(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "watchlist_indicators"

    watchlist_id: Mapped[str] = mapped_column(
        String, ForeignKey("watchlists.id", ondelete="CASCADE"), index=True, nullable=False
    )
    indicator_value: Mapped[str] = mapped_column(String(500), index=True, nullable=False)
    ioc_type: Mapped[str] = mapped_column(String(50), nullable=False)
    severity: Mapped[str] = mapped_column(String(50), default="high", nullable=False)
    confidence: Mapped[float] = mapped_column(Float, default=80.0, nullable=False)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(50), index=True, default="active", nullable=False)  # active, expired, retired
    expires_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    matches_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    last_matched_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    watchlist: Mapped["Watchlist"] = relationship("Watchlist", back_populates="indicators")

    __table_args__ = (
        UniqueConstraint("watchlist_id", "indicator_value", name="uq_watchlist_indicator"),
    )
