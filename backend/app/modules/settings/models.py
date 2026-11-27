"""SOC Policies and Settings SQLAlchemy database models."""
from typing import Optional
from datetime import datetime, timezone
from sqlalchemy import (
    String,
    Text,
    DateTime,
)
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base


class SOCSetting(Base):
    __tablename__ = "soc_settings"

    key: Mapped[str] = mapped_column(String(100), primary_key=True)
    value_json: Mapped[str] = mapped_column(Text, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    updated_by: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
