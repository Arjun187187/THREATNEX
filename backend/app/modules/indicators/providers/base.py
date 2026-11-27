"""Base threat intelligence provider definitions and normalized data schemas."""
from abc import ABC, abstractmethod
from enum import Enum
from typing import Dict, Any, List, Optional, Set
from pydantic import BaseModel, Field
from app.modules.indicators.models import IOCType


class ProviderStatus(str, Enum):
    SUCCESS = "success"
    CLEAN = "clean"
    NOT_FOUND = "not_found"
    UNCONFIGURED = "unconfigured"
    UNSUPPORTED = "unsupported"
    RATE_LIMITED = "rate_limited"
    TIMEOUT = "timeout"
    ERROR = "error"


class ProviderResult(BaseModel):
    provider: str
    supported: bool = True
    status: ProviderStatus
    message: Optional[str] = None
    attribution: str
    source_timestamp: Optional[str] = None

    # Normalized detection telemetry
    malicious: int = 0
    suspicious: int = 0
    harmless: int = 0
    undetected: int = 0

    reputation_score: Optional[float] = None
    confidence_score: Optional[float] = None
    verdict: str = "unknown"  # "malicious", "suspicious", "clean", "unknown"

    tags: List[str] = Field(default_factory=list)
    evidence: Dict[str, Any] = Field(default_factory=dict)


class BaseThreatIntelProvider(ABC):
    """Abstract base class for threat intelligence provider integrations."""

    provider_name: str
    attribution_source: str
    supported_types: Set[IOCType]

    def supports(self, ioc_type: IOCType) -> bool:
        """Determines if this provider supports the given IOC type."""
        return ioc_type in self.supported_types

    @abstractmethod
    async def lookup(self, value: str, ioc_type: IOCType) -> ProviderResult:
        """Asynchronously queries the provider and returns a normalized ProviderResult."""
        pass
