"""Comprehensive regex and structural validation engine for IOC types."""
import re
import ipaddress
from typing import Optional, Tuple
from urllib.parse import urlparse
from app.modules.indicators.models import IOCType

# Pre-compiled high-performance regex patterns
MD5_REGEX = re.compile(r"^[a-fA-F0-9]{32}$")
SHA1_REGEX = re.compile(r"^[a-fA-F0-9]{40}$")
SHA256_REGEX = re.compile(r"^[a-fA-F0-9]{64}$")
CVE_REGEX = re.compile(r"^CVE-\d{4}-\d{4,7}$", re.IGNORECASE)
DOMAIN_REGEX = re.compile(
    r"^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,63}$"
)


def validate_ip(value: str) -> Optional[IOCType]:
    """Validates IPv4 and IPv6 addresses."""
    try:
        ip = ipaddress.ip_address(value.strip())
        if ip.version == 4:
            return IOCType.IPV4
        elif ip.version == 6:
            return IOCType.IPV6
    except ValueError:
        pass
    return None


def validate_url(value: str) -> bool:
    """Validates full URLs with scheme and netloc."""
    try:
        parsed = urlparse(value.strip())
        return bool(parsed.scheme in ("http", "https", "ftp") and parsed.netloc)
    except Exception:
        return False


def validate_ioc_value(value: str, expected_type: Optional[IOCType] = None) -> Tuple[bool, Optional[IOCType], str]:
    """
    Validates and auto-detects an Indicator of Compromise (IOC).
    Returns (is_valid, detected_or_matched_type, message).
    """
    clean_val = value.strip()
    if not clean_val:
        return False, None, "IOC value cannot be empty"

    # 1. IP Address check
    ip_type = validate_ip(clean_val)
    if ip_type:
        if expected_type and expected_type != ip_type:
            return False, ip_type, f"Expected {expected_type.value}, but detected {ip_type.value}"
        return True, ip_type, f"Valid {ip_type.value.upper()} address"

    # 2. Hash check (MD5, SHA1, SHA256)
    if MD5_REGEX.match(clean_val):
        if expected_type and expected_type != IOCType.MD5:
            return False, IOCType.MD5, f"Expected {expected_type.value}, but detected MD5"
        return True, IOCType.MD5, "Valid MD5 hash"

    if SHA1_REGEX.match(clean_val):
        if expected_type and expected_type != IOCType.SHA1:
            return False, IOCType.SHA1, f"Expected {expected_type.value}, but detected SHA1"
        return True, IOCType.SHA1, "Valid SHA1 hash"

    if SHA256_REGEX.match(clean_val):
        if expected_type and expected_type != IOCType.SHA256:
            return False, IOCType.SHA256, f"Expected {expected_type.value}, but detected SHA256"
        return True, IOCType.SHA256, "Valid SHA256 hash"

    # 3. CVE check
    if CVE_REGEX.match(clean_val):
        normalized_cve = clean_val.upper()
        if expected_type and expected_type != IOCType.CVE:
            return False, IOCType.CVE, f"Expected {expected_type.value}, but detected CVE"
        return True, IOCType.CVE, f"Valid CVE identifier: {normalized_cve}"

    # 4. URL check
    if clean_val.startswith(("http://", "https://", "ftp://")) and validate_url(clean_val):
        if expected_type and expected_type != IOCType.URL:
            return False, IOCType.URL, f"Expected {expected_type.value}, but detected URL"
        return True, IOCType.URL, "Valid URL format"

    # 5. Domain check
    if DOMAIN_REGEX.match(clean_val):
        if expected_type and expected_type != IOCType.DOMAIN:
            return False, IOCType.DOMAIN, f"Expected {expected_type.value}, but detected Domain"
        return True, IOCType.DOMAIN, "Valid domain name"

    return False, None, "Unrecognized or invalid IOC pattern"
