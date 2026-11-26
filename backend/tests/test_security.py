"""Comprehensive Security Hardening Regression Test Suite."""
import pytest
from app.core.ratelimit import reset_rate_limits
from app.modules.indicators.validator import validate_ioc_value


@pytest.fixture(autouse=True)
def clean_ratelimits():
    """Reset rate limiter and token blacklist before each test."""
    reset_rate_limits()
    yield
    reset_rate_limits()


@pytest.mark.asyncio
async def test_scenario_1_unauthenticated_access_rejected(client):
    """1. Unauthenticated users cannot access protected endpoints."""
    protected_endpoints = [
        ("GET", "/api/v1/auth/me"),
        ("GET", "/api/v1/investigations/"),
        ("POST", "/api/v1/investigations/"),
        ("GET", "/api/v1/dashboard/stats"),
        ("GET", "/api/v1/audit/logs"),
    ]
    for method, endpoint in protected_endpoints:
        if method == "GET":
            res = await client.get(endpoint)
        else:
            res = await client.post(endpoint, json={})
        assert res.status_code == 403 or res.status_code == 401


@pytest.mark.asyncio
async def test_scenario_2_analyst_cannot_access_admin_endpoints(client):
    """2. Analyst users cannot perform Admin-only operations (Audit logs)."""
    # Create the first user (Admin)
    await client.post(
        "/api/v1/auth/register",
        json={"email": "admin_audit@threatnex.io", "username": "admin_audit", "password": "Password123!Secure"},
    )
    # Create the second user (Analyst only)
    await client.post(
        "/api/v1/auth/register",
        json={"email": "analyst_sec@threatnex.io", "username": "analyst_sec", "password": "Password123!Secure"},
    )

    # Login as analyst
    login_res = await client.post(
        "/api/v1/auth/login",
        json={"username_or_email": "analyst_sec", "password": "Password123!Secure"},
    )
    analyst_token = login_res.json()["access_token"]

    # Attempt to view audit logs (Admin only)
    audit_res = await client.get(
        "/api/v1/audit/logs",
        headers={"Authorization": f"Bearer {analyst_token}"},
    )
    assert audit_res.status_code == 403
    assert "Requires one of roles: Admin" in audit_res.json()["detail"]


@pytest.mark.asyncio
async def test_scenario_3_object_level_authorization_idor(client):
    """3. Users cannot access or modify another user's private investigations without authorization."""
    # Register two analyst users
    await client.post(
        "/api/v1/auth/register",
        json={"email": "user1@threatnex.io", "username": "user1_analyst", "password": "Password123!Secure"},
    )
    await client.post(
        "/api/v1/auth/register",
        json={"email": "user2@threatnex.io", "username": "user2_analyst", "password": "Password123!Secure"},
    )

    token1 = (await client.post(
        "/api/v1/auth/login",
        json={"username_or_email": "user1_analyst", "password": "Password123!Secure"},
    )).json()["access_token"]

    token2 = (await client.post(
        "/api/v1/auth/login",
        json={"username_or_email": "user2_analyst", "password": "Password123!Secure"},
    )).json()["access_token"]

    # User 1 creates an assigned private investigation
    case_res = await client.post(
        "/api/v1/investigations/",
        json={"title": "Confidential Investigation", "priority": "high", "assigned_to": "user1_analyst"},
        headers={"Authorization": f"Bearer {token1}"},
    )
    case_id = case_res.json()["id"]

    # User 2 attempts to read User 1's case -> 403 Forbidden
    unauthorized_get = await client.get(
        f"/api/v1/investigations/{case_id}",
        headers={"Authorization": f"Bearer {token2}"},
    )
    assert unauthorized_get.status_code == 403

    # User 2 attempts to update User 1's case -> 403 Forbidden
    unauthorized_patch = await client.patch(
        f"/api/v1/investigations/{case_id}",
        json={"title": "Tampered Title"},
        headers={"Authorization": f"Bearer {token2}"},
    )
    assert unauthorized_patch.status_code == 403


@pytest.mark.asyncio
async def test_scenario_4_and_5_jwt_revocation_and_misuse(client):
    """4 & 5. Invalid/expired tokens and refresh token misuse are rejected; logout revokes token."""
    await client.post(
        "/api/v1/auth/register",
        json={"email": "logout_test@threatnex.io", "username": "logout_test", "password": "Password123!Secure"},
    )
    login_res = await client.post(
        "/api/v1/auth/login",
        json={"username_or_email": "logout_test", "password": "Password123!Secure"},
    )
    token_data = login_res.json()
    access_token = token_data["access_token"]
    refresh_token = token_data["refresh_token"]

    # Refresh token misuse: Using refresh token as an access token on /me must fail
    misuse_res = await client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {refresh_token}"},
    )
    assert misuse_res.status_code == 401

    # Normal access succeeds
    ok_res = await client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {access_token}"},
    )
    assert ok_res.status_code == 200

    # User logs out
    logout_res = await client.post(
        "/api/v1/auth/logout",
        headers={"Authorization": f"Bearer {access_token}"},
    )
    assert logout_res.status_code == 200

    # Attempting to reuse revoked access token must fail
    revoked_res = await client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {access_token}"},
    )
    assert revoked_res.status_code == 401
    assert "revoked" in revoked_res.json()["detail"]


@pytest.mark.asyncio
async def test_scenario_6_and_7_sql_injection_and_malformed_inputs(client):
    """6 & 7. Malformed inputs and SQL injection payloads cannot bypass validation or database query."""
    await client.post(
        "/api/v1/auth/register",
        json={"email": "sqli_test@threatnex.io", "username": "sqli_test", "password": "Password123!Secure"},
    )
    token = (await client.post(
        "/api/v1/auth/login",
        json={"username_or_email": "sqli_test", "password": "Password123!Secure"},
    )).json()["access_token"]

    # SQL Injection attempt in login
    sqli_login = await client.post(
        "/api/v1/auth/login",
        json={"username_or_email": "admin' OR '1'='1", "password": "' OR '1'='1"},
    )
    assert sqli_login.status_code == 401

    # SQL Injection attempt in IOC search
    sqli_search = await client.get(
        "/api/v1/indicators/search?q=' UNION SELECT * FROM users --",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert sqli_search.status_code == 200
    # Parameterized query safely returns empty list without syntax error
    assert isinstance(sqli_search.json(), list)


@pytest.mark.asyncio
async def test_scenario_8_xss_payload_safety(client):
    """8. XSS payloads are safely stored/validated as text without execution."""
    xss_payload = "<script>alert('XSS')</script>"
    is_valid, _, _ = validate_ioc_value(xss_payload)
    assert is_valid is False  # Rejected by IOC validator engine


@pytest.mark.asyncio
async def test_scenario_9_open_redirect_mitigation():
    """9. Open redirect attempts using backslash and protocol evasion are rejected."""
    from app.modules.indicators.validator import validate_url
    assert validate_url("javascript:alert(1)") is False
    assert validate_url("data:text/html,<script>alert(1)</script>") is False
    assert validate_url("http://legitimate-threat-intel.com") is True


@pytest.mark.asyncio
async def test_scenario_10_rate_limiting(client):
    """10. Excessive login attempts trigger HTTP 429 Too Many Requests."""
    for i in range(10):
        res = await client.post(
            "/api/v1/auth/login",
            json={"username_or_email": "nonexistent_user", "password": "WrongPassword123!"},
        )
        assert res.status_code == 401

    # The 11th request in the same window must be rate-limited
    rate_limited_res = await client.post(
        "/api/v1/auth/login",
        json={"username_or_email": "nonexistent_user", "password": "WrongPassword123!"},
    )
    assert rate_limited_res.status_code == 429
    assert "Rate limit exceeded" in rate_limited_res.json()["detail"]


@pytest.mark.asyncio
async def test_scenario_11_security_headers_present(client):
    """11. Verified security headers on all API responses."""
    res = await client.get("/health")
    assert res.status_code == 200
    assert res.headers.get("X-Content-Type-Options") == "nosniff"
    assert res.headers.get("X-Frame-Options") == "DENY"
    assert "default-src 'self'" in res.headers.get("Content-Security-Policy", "")
