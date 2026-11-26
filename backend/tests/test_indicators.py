"""Unit and integration tests for IOC validation and search."""
import pytest
from app.modules.indicators.models import IOCType
from app.modules.indicators.validator import validate_ioc_value


def test_ipv4_validation():
    valid, detected_type, _ = validate_ioc_value("192.168.1.100")
    assert valid is True
    assert detected_type == IOCType.IPV4

    invalid, _, _ = validate_ioc_value("999.999.999.999")
    assert invalid is False


def test_ipv6_validation():
    valid, detected_type, _ = validate_ioc_value("2001:0db8:85a3:0000:0000:8a2e:0370:7334")
    assert valid is True
    assert detected_type == IOCType.IPV6


def test_hashes_validation():
    # MD5 (32 hex)
    v_md5, t_md5, _ = validate_ioc_value("d41d8cd98f00b204e9800998ecf8427e")
    assert v_md5 is True
    assert t_md5 == IOCType.MD5

    # SHA1 (40 hex)
    v_sha1, t_sha1, _ = validate_ioc_value("da39a3ee5e6b4b0d3255bfef95601890afd80709")
    assert v_sha1 is True
    assert t_sha1 == IOCType.SHA1

    # SHA256 (64 hex)
    v_sha256, t_sha256, _ = validate_ioc_value("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855")
    assert v_sha256 is True
    assert t_sha256 == IOCType.SHA256


def test_cve_validation():
    valid, detected_type, _ = validate_ioc_value("CVE-2024-38077")
    assert valid is True
    assert detected_type == IOCType.CVE


def test_domain_and_url_validation():
    v_dom, t_dom, _ = validate_ioc_value("evil-c2-domain.com")
    assert v_dom is True
    assert t_dom == IOCType.DOMAIN

    v_url, t_url, _ = validate_ioc_value("https://malicious-site.com/payload.exe")
    assert v_url is True
    assert t_url == IOCType.URL


@pytest.mark.asyncio
async def test_ioc_api_validation_authenticated(client):
    # Register & login
    reg_res = await client.post(
        "/api/v1/auth/register",
        json={
            "email": "analyst_ioc@threatnex.io",
            "username": "analyst_ioc",
            "password": "Password123!Secure",
        },
    )
    assert reg_res.status_code == 201

    login_res = await client.post(
        "/api/v1/auth/login",
        json={"username_or_email": "analyst_ioc", "password": "Password123!Secure"},
    )
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Test API IOC validation
    val_res = await client.post(
        "/api/v1/indicators/validate",
        json={"value": "198.51.100.24"},
        headers=headers,
    )
    assert val_res.status_code == 200
    data = val_res.json()
    assert data["is_valid"] is True
    assert data["ioc_type"] == "ipv4"
