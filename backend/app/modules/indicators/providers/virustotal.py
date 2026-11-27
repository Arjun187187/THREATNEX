"""VirusTotal v3 API Threat Intelligence Provider."""
import base64
import logging
from typing import Optional, Set
import httpx
from app.core.config import settings
from app.modules.indicators.models import IOCType
from app.modules.indicators.providers.base import (
    BaseThreatIntelProvider,
    ProviderResult,
    ProviderStatus,
)

logger = logging.getLogger(__name__)


class VirusTotalProvider(BaseThreatIntelProvider):
    provider_name = "VirusTotal"
    attribution_source = "VirusTotal v3 Enterprise / Public API"
    supported_types: Set[IOCType] = {
        IOCType.IPV4,
        IOCType.IPV6,
        IOCType.DOMAIN,
        IOCType.URL,
        IOCType.MD5,
        IOCType.SHA1,
        IOCType.SHA256,
    }

    BASE_URL = "https://www.virustotal.com/api/v3"

    def __init__(self, api_key: Optional[str] = None, timeout: float = 8.0):
        self.api_key = api_key or settings.VIRUSTOTAL_API_KEY
        self.timeout = timeout

    async def lookup(self, value: str, ioc_type: IOCType) -> ProviderResult:
        if not self.supports(ioc_type):
            return ProviderResult(
                provider=self.provider_name,
                supported=False,
                status=ProviderStatus.UNSUPPORTED,
                message=f"VirusTotal does not support IOC type '{ioc_type.value}'",
                attribution=self.attribution_source,
            )

        if not self.api_key or self.api_key.strip() in ("", "None"):
            return ProviderResult(
                provider=self.provider_name,
                supported=True,
                status=ProviderStatus.UNCONFIGURED,
                message="VirusTotal API key is not configured in backend environment (VIRUSTOTAL_API_KEY)",
                attribution=self.attribution_source,
            )

        endpoint, method = self._get_endpoint_for_type(value, ioc_type)
        if not endpoint:
            return ProviderResult(
                provider=self.provider_name,
                supported=False,
                status=ProviderStatus.UNSUPPORTED,
                message=f"Unable to route IOC type '{ioc_type.value}' in VirusTotal",
                attribution=self.attribution_source,
            )

        headers = {
            "x-apikey": self.api_key.strip(),
            "Accept": "application/json",
            "User-Agent": "ThreatNex-SOC/1.0",
        }

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                resp = await client.get(endpoint, headers=headers)

                if resp.status_code == 404:
                    return ProviderResult(
                        provider=self.provider_name,
                        status=ProviderStatus.NOT_FOUND,
                        message="Indicator not found in VirusTotal dataset (no reports or clean)",
                        attribution=self.attribution_source,
                        verdict="clean",
                    )

                if resp.status_code in (401, 403):
                    return ProviderResult(
                        provider=self.provider_name,
                        status=ProviderStatus.ERROR,
                        message="VirusTotal API key is invalid or unauthorized",
                        attribution=self.attribution_source,
                    )

                if resp.status_code == 429:
                    return ProviderResult(
                        provider=self.provider_name,
                        status=ProviderStatus.RATE_LIMITED,
                        message="VirusTotal request rate limit exceeded",
                        attribution=self.attribution_source,
                    )

                resp.raise_for_status()
                data = resp.json().get("data", {})
                attrs = data.get("attributes", {})

                stats = attrs.get("last_analysis_stats", {})
                malicious = stats.get("malicious", 0)
                suspicious = stats.get("suspicious", 0)
                harmless = stats.get("harmless", 0)
                undetected = stats.get("undetected", 0)

                reputation = attrs.get("reputation", 0)
                tags = attrs.get("tags", [])
                date_ts = attrs.get("last_analysis_date")
                source_ts = str(date_ts) if date_ts else None

                # Compute verdict
                if malicious >= 3:
                    verdict = "malicious"
                elif malicious >= 1 or suspicious >= 2:
                    verdict = "suspicious"
                elif harmless > 0 or (malicious == 0 and suspicious == 0):
                    verdict = "clean"
                else:
                    verdict = "unknown"

                confidence = min(100.0, float((malicious + suspicious + harmless + undetected) * 1.5))
                if confidence == 0 and verdict == "clean":
                    confidence = 70.0

                evidence = {
                    "last_analysis_stats": stats,
                    "reputation": reputation,
                    "as_owner": attrs.get("as_owner"),
                    "network": attrs.get("network"),
                    "categories": attrs.get("categories", {}),
                    "meaningful_name": attrs.get("meaningful_name"),
                }

                return ProviderResult(
                    provider=self.provider_name,
                    status=ProviderStatus.SUCCESS,
                    message=f"Detection: {malicious} malicious engines across {malicious + suspicious + undetected + harmless} total vendors",
                    attribution=self.attribution_source,
                    source_timestamp=source_ts,
                    malicious=malicious,
                    suspicious=suspicious,
                    harmless=harmless,
                    undetected=undetected,
                    reputation_score=float(reputation),
                    confidence_score=confidence,
                    verdict=verdict,
                    tags=tags[:10],
                    evidence=evidence,
                )

        except httpx.TimeoutException:
            return ProviderResult(
                provider=self.provider_name,
                status=ProviderStatus.TIMEOUT,
                message=f"VirusTotal query timed out after {self.timeout}s",
                attribution=self.attribution_source,
            )
        except Exception as ex:
            logger.warning(f"VirusTotal lookup error: {str(ex)}")
            return ProviderResult(
                provider=self.provider_name,
                status=ProviderStatus.ERROR,
                message=f"VirusTotal provider query failed: {str(ex)}",
                attribution=self.attribution_source,
            )

    def _get_endpoint_for_type(self, value: str, ioc_type: IOCType):
        clean_val = value.strip()
        if ioc_type in (IOCType.IPV4, IOCType.IPV6):
            return f"{self.BASE_URL}/ip_addresses/{clean_val}", "GET"
        elif ioc_type == IOCType.DOMAIN:
            return f"{self.BASE_URL}/domains/{clean_val}", "GET"
        elif ioc_type == IOCType.URL:
            # VT URL identifier is base64url encoded without trailing '=' padding
            url_id = base64.urlsafe_b64encode(clean_val.encode()).decode().strip("=")
            return f"{self.BASE_URL}/urls/{url_id}", "GET"
        elif ioc_type in (IOCType.MD5, IOCType.SHA1, IOCType.SHA256):
            return f"{self.BASE_URL}/files/{clean_val.lower()}", "GET"
        return None, None
