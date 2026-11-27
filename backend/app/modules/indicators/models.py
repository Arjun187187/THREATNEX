"""Indicator of Compromise (IOC) models."""
from enum import Enum
from typing import Optional
from sqlalchemy import String, Text, Enum as SQLEnum, Float, Index
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base
from app.common.models import UUIDMixin, TimestampMixin


class IOCType(str, Enum):
    IPV4 = "ipv4"
    IPV6 = "ipv6"
    DOMAIN = "domain"
    URL = "url"
    MD5 = "md5"
    SHA1 = "sha1"
    SHA256 = "sha256"
    CVE = "cve"


class IOCSeverity(str, Enum):
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"
    INFO = "info"
    UNKNOWN = "unknown"


class Indicator(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "indicators"

    value: Mapped[str] = mapped_column(String(500), unique=True, index=True, nullable=False)
    ioc_type: Mapped[IOCType] = mapped_column(SQLEnum(IOCType), index=True, nullable=False)
    severity: Mapped[IOCSeverity] = mapped_column(SQLEnum(IOCSeverity), default=IOCSeverity.UNKNOWN, index=True, nullable=False)
    confidence: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    tags: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)  # Comma-separated tags
    is_active: Mapped[bool] = mapped_column(default=True, nullable=False)

    __table_args__ = (
        Index("ix_indicators_type_value", "ioc_type", "value"),
    )


class IOCInvestigationRecord(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "ioc_investigations"

    indicator_value: Mapped[str] = mapped_column(String(500), index=True, nullable=False)
    ioc_type: Mapped[IOCType] = mapped_column(SQLEnum(IOCType), index=True, nullable=False)
    verdict: Mapped[str] = mapped_column(String(50), default="unknown", nullable=False)
    severity: Mapped[IOCSeverity] = mapped_column(SQLEnum(IOCSeverity), default=IOCSeverity.UNKNOWN, nullable=False)
    confidence: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    total_detections: Mapped[int] = mapped_column(default=0, nullable=False)
    summary: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    raw_results_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    user_id: Mapped[Optional[str]] = mapped_column(String, nullable=True, index=True)
    indicator_id: Mapped[Optional[str]] = mapped_column(String, nullable=True, index=True)

    __table_args__ = (
        Index("ix_ioc_inv_val_type", "indicator_value", "ioc_type"),
    )
