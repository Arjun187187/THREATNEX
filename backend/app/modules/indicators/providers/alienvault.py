"""AlienVault OTX Threat Intelligence Provider."""
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


class AlienVaultOTXProvider(BaseThreatIntelProvider):
    provider_name = "AlienVault OTX"
    attribution_source = "AT&T Cybersecurity AlienVault Open Threat Exchange (OTX)"
    supported_types: Set[IOCType] = {
        IOCType.IPV4,
        IOCType.IPV6,
        IOCType.DOMAIN,
        IOCType.URL,
        IOCType.MD5,
        IOCType.SHA1,
        IOCType.SHA256,
        IOCType.CVE,
    }

    BASE_URL = "https://otx.alienvault.com/api/v1/indicators"

    def __init__(self, api_key: Optional[str] = None, timeout: float = 8.0):
        self.api_key = api_key or settings.ALIENVAULT_OTX_API_KEY
        self.timeout = timeout

    async def lookup(self, value: str, ioc_type: IOCType) -> ProviderResult:
        if not self.supports(ioc_type):
            return ProviderResult(
                provider=self.provider_name,
                supported=False,
                status=ProviderStatus.UNSUPPORTED,
                message=f"AlienVault OTX does not support IOC type '{ioc_type.value}'",
                attribution=self.attribution_source,
            )

        endpoint = self._get_endpoint(value, ioc_type)
        if not endpoint:
            return ProviderResult(
                provider=self.provider_name,
                supported=False,
                status=ProviderStatus.UNSUPPORTED,
                message=f"Unable to route IOC type '{ioc_type.value}' in AlienVault OTX",
                attribution=self.attribution_source,
            )

        headers = {
            "Accept": "application/json",
            "User-Agent": "ThreatNex-SOC/1.0",
        }
        if self.api_key and self.api_key.strip() not in ("", "None"):
            headers["X-OTX-API-KEY"] = self.api_key.strip()

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                resp = await client.get(endpoint, headers=headers)

                if resp.status_code == 404:
                    return ProviderResult(
                        provider=self.provider_name,
                        status=ProviderStatus.NOT_FOUND,
                        message="Indicator has 0 recorded pulses or telemetry in AlienVault OTX",
                        attribution=self.attribution_source,
                        verdict="clean",
                    )

                if resp.status_code == 429:
                    return ProviderResult(
                        provider=self.provider_name,
                        status=ProviderStatus.RATE_LIMITED,
                        message="AlienVault OTX request rate limit exceeded",
                        attribution=self.attribution_source,
                    )

                resp.raise_for_status()
                data = resp.json()

                pulse_info = data.get("pulse_info", {})
                pulse_count = pulse_info.get("count", 0)
                pulses = pulse_info.get("pulses", [])

                asn = data.get("asn")
                country_name = data.get("country_name")
                reputation = data.get("reputation", 0)
                epss = data.get("epss")

                # Extract pulse names, tags, adversaries, malware families
                extracted_tags = set()
                pulse_summaries = []
                adversaries = set()
                malware_families = set()

                for p in pulses[:10]:
                    p_name = p.get("name")
                    if p_name:
                        pulse_summaries.append(p_name)
                    for t in p.get("tags", []):
                        if isinstance(t, str):
                            extracted_tags.add(t.lower())
                    p_adv = p.get("adversary")
                    if p_adv:
                        adversaries.add(p_adv)
                    for m in p.get("malware_families", []):
                        if isinstance(m, dict) and m.get("display_name"):
                            malware_families.add(m.get("display_name"))
                        elif isinstance(m, str):
                            malware_families.add(m)

                # Verdict classification
                if pulse_count >= 5:
                    verdict = "malicious"
                    malicious = pulse_count
                    suspicious = 0
                elif pulse_count >= 1:
                    verdict = "suspicious"
                    malicious = 0
                    suspicious = pulse_count
                else:
                    verdict = "clean"
                    malicious = 0
                    suspicious = 0

                confidence = min(100.0, float(pulse_count * 15.0))
                if pulse_count == 0 and verdict == "clean":
                    confidence = 65.0

                evidence = {
                    "pulse_count": pulse_count,
                    "top_pulses": pulse_summaries[:5],
                    "adversaries": list(adversaries)[:5],
                    "malware_families": list(malware_families)[:5],
                    "asn": asn,
                    "country": country_name,
                    "epss": epss,
                }

                msg = (
                    f"Correlated with {pulse_count} active threat pulses in OTX community"
                    if pulse_count > 0
                    else "No active threat pulses or community reports observed in OTX"
                )

                return ProviderResult(
                    provider=self.provider_name,
                    status=ProviderStatus.SUCCESS,
                    message=msg,
                    attribution=self.attribution_source,
                    malicious=malicious,
                    suspicious=suspicious,
                    harmless=1 if pulse_count == 0 else 0,
                    undetected=0,
                    reputation_score=float(reputation),
                    confidence_score=confidence,
                    verdict=verdict,
                    tags=list(extracted_tags)[:10],
                    evidence=evidence,
                )

        except httpx.TimeoutException:
            return ProviderResult(
                provider=self.provider_name,
                status=ProviderStatus.TIMEOUT,
                message=f"AlienVault OTX query timed out after {self.timeout}s",
                attribution=self.attribution_source,
            )
        except Exception as ex:
            logger.warning(f"AlienVault OTX lookup error: {str(ex)}")
            return ProviderResult(
                provider=self.provider_name,
                status=ProviderStatus.ERROR,
                message=f"AlienVault OTX query failed: {str(ex)}",
                attribution=self.attribution_source,
            )

    def _get_endpoint(self, value: str, ioc_type: IOCType) -> Optional[str]:
        clean_val = value.strip()
        if ioc_type == IOCType.IPV4:
            return f"{self.BASE_URL}/IPv4/{clean_val}/general"
        elif ioc_type == IOCType.IPV6:
            return f"{self.BASE_URL}/IPv6/{clean_val}/general"
        elif ioc_type == IOCType.DOMAIN:
            return f"{self.BASE_URL}/domain/{clean_val}/general"
        elif ioc_type == IOCType.URL:
            return f"{self.BASE_URL}/url/{clean_val}/general"
        elif ioc_type in (IOCType.MD5, IOCType.SHA1, IOCType.SHA256):
            return f"{self.BASE_URL}/file/{clean_val.lower()}/general"
        elif ioc_type == IOCType.CVE:
            return f"{self.BASE_URL}/cve/{clean_val.upper()}/general"
        return None
