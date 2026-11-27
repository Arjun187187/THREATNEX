"""AbuseIPDB v2 Threat Intelligence Provider."""
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


class AbuseIPDBProvider(BaseThreatIntelProvider):
    provider_name = "AbuseIPDB"
    attribution_source = "AbuseIPDB IP Reputation & Abuse Database"
    supported_types: Set[IOCType] = {
        IOCType.IPV4,
        IOCType.IPV6,
    }

    CHECK_URL = "https://api.abuseipdb.com/api/v2/check"

    def __init__(self, api_key: Optional[str] = None, timeout: float = 8.0):
        self.api_key = api_key or settings.ABUSEIPDB_API_KEY
        self.timeout = timeout

    async def lookup(self, value: str, ioc_type: IOCType) -> ProviderResult:
        if not self.supports(ioc_type):
            return ProviderResult(
                provider=self.provider_name,
                supported=False,
                status=ProviderStatus.UNSUPPORTED,
                message=f"AbuseIPDB only inspects IPv4/IPv6 addresses, cannot check '{ioc_type.value}'",
                attribution=self.attribution_source,
            )

        if not self.api_key or self.api_key.strip() in ("", "None"):
            return ProviderResult(
                provider=self.provider_name,
                supported=True,
                status=ProviderStatus.UNCONFIGURED,
                message="AbuseIPDB API key is not configured in backend environment (ABUSEIPDB_API_KEY)",
                attribution=self.attribution_source,
            )

        headers = {
            "Key": self.api_key.strip(),
            "Accept": "application/json",
            "User-Agent": "ThreatNex-SOC/1.0",
        }
        params = {
            "ipAddress": value.strip(),
            "maxAgeInDays": 90,
            "verbose": True,
        }

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                resp = await client.get(self.CHECK_URL, headers=headers, params=params)

                if resp.status_code in (401, 403):
                    return ProviderResult(
                        provider=self.provider_name,
                        status=ProviderStatus.ERROR,
                        message="AbuseIPDB API key is invalid or unauthorized",
                        attribution=self.attribution_source,
                    )

                if resp.status_code == 429:
                    return ProviderResult(
                        provider=self.provider_name,
                        status=ProviderStatus.RATE_LIMITED,
                        message="AbuseIPDB API request rate limit exceeded",
                        attribution=self.attribution_source,
                    )

                resp.raise_for_status()
                data = resp.json().get("data", {})

                score = data.get("abuseConfidenceScore", 0)
                total_reports = data.get("totalReports", 0)
                distinct_users = data.get("numDistinctUsers", 0)
                is_whitelisted = data.get("isWhitelisted", False)
                country_code = data.get("countryCode")
                isp = data.get("isp")
                usage_type = data.get("usageType")
                domain = data.get("domain")
                last_reported = data.get("lastReportedAt")

                # Verdict mapping
                if is_whitelisted or score == 0:
                    verdict = "clean"
                    malicious = 0
                    suspicious = 0
                elif score >= 50:
                    verdict = "malicious"
                    malicious = total_reports
                    suspicious = 0
                elif score >= 20:
                    verdict = "suspicious"
                    malicious = 0
                    suspicious = total_reports
                else:
                    verdict = "clean"
                    malicious = 0
                    suspicious = 0

                tags = []
                if is_whitelisted:
                    tags.append("whitelisted")
                if country_code:
                    tags.append(f"geo:{country_code}")
                if usage_type:
                    tags.append(f"type:{usage_type.lower().replace(' ', '-')}")
                if score >= 50:
                    tags.append("reported-abusive")

                evidence = {
                    "abuseConfidenceScore": score,
                    "totalReports": total_reports,
                    "numDistinctUsers": distinct_users,
                    "isWhitelisted": is_whitelisted,
                    "countryCode": country_code,
                    "isp": isp,
                    "usageType": usage_type,
                    "domain": domain,
                    "lastReportedAt": last_reported,
                }

                return ProviderResult(
                    provider=self.provider_name,
                    status=ProviderStatus.SUCCESS,
                    message=f"Confidence Score: {score}%, {total_reports} reports by {distinct_users} distinct reporters",
                    attribution=self.attribution_source,
                    source_timestamp=last_reported,
                    malicious=1 if score >= 50 else 0,
                    suspicious=1 if 20 <= score < 50 else 0,
                    harmless=1 if is_whitelisted or score == 0 else 0,
                    undetected=0,
                    reputation_score=float(100 - score),  # 100 = completely clean
                    confidence_score=float(score if score > 0 else (90.0 if is_whitelisted else 50.0)),
                    verdict=verdict,
                    tags=tags,
                    evidence=evidence,
                )

        except httpx.TimeoutException:
            return ProviderResult(
                provider=self.provider_name,
                status=ProviderStatus.TIMEOUT,
                message=f"AbuseIPDB query timed out after {self.timeout}s",
                attribution=self.attribution_source,
            )
        except Exception as ex:
            logger.warning(f"AbuseIPDB lookup error: {str(ex)}")
            return ProviderResult(
                provider=self.provider_name,
                status=ProviderStatus.ERROR,
                message=f"AbuseIPDB query failed: {str(ex)}",
                attribution=self.attribution_source,
            )
