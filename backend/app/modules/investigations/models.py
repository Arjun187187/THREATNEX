"""Investigation management models."""
from enum import Enum
from typing import Optional, List
from sqlalchemy import String, Text, Enum as SQLEnum, ForeignKey, Table, Column
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base
from app.common.models import UUIDMixin, TimestampMixin
from app.modules.indicators.models import Indicator


class InvestigationStatus(str, Enum):
    OPEN = "open"
    IN_PROGRESS = "in_progress"
    RESOLVED = "resolved"
    CLOSED = "closed"


class InvestigationPriority(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


# Association table for Investigation <-> Indicator
investigation_indicators = Table(
    "investigation_indicators",
    Base.metadata,
    Column("investigation_id", String, ForeignKey("investigations.id", ondelete="CASCADE"), primary_key=True),
    Column("indicator_id", String, ForeignKey("indicators.id", ondelete="CASCADE"), primary_key=True),
)


class Investigation(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "investigations"

    title: Mapped[str] = mapped_column(String(255), index=True, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[InvestigationStatus] = mapped_column(
        SQLEnum(InvestigationStatus),
        default=InvestigationStatus.OPEN,
        index=True,
        nullable=False
    )
    priority: Mapped[InvestigationPriority] = mapped_column(
        SQLEnum(InvestigationPriority),
        default=InvestigationPriority.MEDIUM,
        index=True,
        nullable=False
    )
    owner_id: Mapped[Optional[str]] = mapped_column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    assigned_to: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)

    indicators: Mapped[List[Indicator]] = relationship(
        "Indicator",
        secondary=investigation_indicators,
        lazy="selectin"
    )
