"""URLhaus (abuse.ch) Threat Intelligence Provider."""
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


class URLhausProvider(BaseThreatIntelProvider):
    provider_name = "URLhaus"
    attribution_source = "abuse.ch URLhaus Malware URL & Host Database"
    supported_types: Set[IOCType] = {
        IOCType.URL,
        IOCType.DOMAIN,
        IOCType.IPV4,
        IOCType.MD5,
        IOCType.SHA256,
    }

    BASE_URL = "https://urlhaus-api.abuse.ch/v1"

    def __init__(self, auth_key: Optional[str] = None, timeout: float = 8.0):
        self.auth_key = auth_key or settings.URLHAUS_AUTH_KEY
        self.timeout = timeout

    async def lookup(self, value: str, ioc_type: IOCType) -> ProviderResult:
        if not self.supports(ioc_type):
            return ProviderResult(
                provider=self.provider_name,
                supported=False,
                status=ProviderStatus.UNSUPPORTED,
                message=f"URLhaus does not support IOC type '{ioc_type.value}'",
                attribution=self.attribution_source,
            )

        headers = {
            "User-Agent": "ThreatNex-SOC/1.0",
        }
        if self.auth_key and self.auth_key.strip() not in ("", "None"):
            headers["Auth-Key"] = self.auth_key.strip()

        endpoint, form_data = self._build_request(value, ioc_type)
        if not endpoint:
            return ProviderResult(
                provider=self.provider_name,
                supported=False,
                status=ProviderStatus.UNSUPPORTED,
                message=f"Unable to format query for URLhaus endpoint",
                attribution=self.attribution_source,
            )

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                resp = await client.post(endpoint, data=form_data, headers=headers)

                if resp.status_code in (401, 403):
                    # Check if error specifies Auth-Key requirement
                    return ProviderResult(
                        provider=self.provider_name,
                        status=ProviderStatus.UNCONFIGURED,
                        message="URLhaus requires an Auth-Key (abuse.ch API key). Set URLHAUS_AUTH_KEY in backend environment.",
                        attribution=self.attribution_source,
                    )

                if resp.status_code == 429:
                    return ProviderResult(
                        provider=self.provider_name,
                        status=ProviderStatus.RATE_LIMITED,
                        message="URLhaus API request rate limit exceeded",
                        attribution=self.attribution_source,
                    )

                resp.raise_for_status()
                data = resp.json()

                q_status = data.get("query_status")

                if q_status == "no_results":
                    return ProviderResult(
                        provider=self.provider_name,
                        status=ProviderStatus.NOT_FOUND,
                        message="No malicious URLs or payload distributions recorded in URLhaus",
                        attribution=self.attribution_source,
                        verdict="clean",
                        harmless=1,
                        confidence_score=75.0,
                    )

                if q_status != "ok":
                    return ProviderResult(
                        provider=self.provider_name,
                        status=ProviderStatus.CLEAN,
                        message=f"URLhaus query status: {q_status}",
                        attribution=self.attribution_source,
                        verdict="clean",
                    )

                # Parse threat data
                threat = data.get("threat")
                url_status = data.get("url_status")
                tags = data.get("tags") or []
                url_count = data.get("url_count", 0)
                urls = data.get("urls") or []
                date_added = data.get("date_added")

                verdict = "malicious"
                confidence = 90.0 if url_status == "online" else 80.0

                evidence = {
                    "threat": threat,
                    "url_status": url_status,
                    "url_count": url_count,
                    "date_added": date_added,
                    "sample_urls": [u.get("url") for u in urls[:3] if isinstance(u, dict)],
                }

                return ProviderResult(
                    provider=self.provider_name,
                    status=ProviderStatus.SUCCESS,
                    message=f"Threat identified: {threat or 'Malware Distribution'} (Status: {url_status or 'Recorded'})",
                    attribution=self.attribution_source,
                    source_timestamp=date_added,
                    malicious=1,
                    suspicious=0,
                    harmless=0,
                    undetected=0,
                    reputation_score=0.0,
                    confidence_score=confidence,
                    verdict=verdict,
                    tags=tags[:10],
                    evidence=evidence,
                )

        except httpx.TimeoutException:
            return ProviderResult(
                provider=self.provider_name,
                status=ProviderStatus.TIMEOUT,
                message=f"URLhaus query timed out after {self.timeout}s",
                attribution=self.attribution_source,
            )
        except Exception as ex:
            logger.warning(f"URLhaus lookup error: {str(ex)}")
            return ProviderResult(
                provider=self.provider_name,
                status=ProviderStatus.ERROR,
                message=f"URLhaus query failed: {str(ex)}",
                attribution=self.attribution_source,
            )

    def _build_request(self, value: str, ioc_type: IOCType):
        clean_val = value.strip()
        if ioc_type == IOCType.URL:
            return f"{self.BASE_URL}/url/", {"url": clean_val}
        elif ioc_type in (IOCType.DOMAIN, IOCType.IPV4):
            return f"{self.BASE_URL}/host/", {"host": clean_val}
        elif ioc_type == IOCType.MD5:
            return f"{self.BASE_URL}/payload/", {"md5_hash": clean_val.lower()}
        elif ioc_type == IOCType.SHA256:
            return f"{self.BASE_URL}/payload/", {"sha256_hash": clean_val.lower()}
        return None, None
