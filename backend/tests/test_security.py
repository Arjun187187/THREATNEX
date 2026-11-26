"""Comprehensive Security Regression Test Suite for Phase 1B Hardening."""
import pytest
from app.core.ratelimit import reset_local_rate_limits
from app.core.token_revocation import reset_local_revocation
from app.core.config import Settings
from app.modules.indicators.validator import validate_ioc_value


@pytest.fixture(autouse=True)
def clean_security_state():
    reset_local_rate_limits()
    reset_local_revocation()
    yield
    reset_local_rate_limits()
    reset_local_revocation()


@pytest.mark.asyncio
async def test_idor_investigations_list_and_detail(client):
    """Verify Analyst A cannot view or list Analyst B's private investigation cases."""
    # 1. Create Analyst A and Analyst B
    await client.post(
        "/api/v1/auth/register",
        json={"email": "analyst_a@threatnex.io", "username": "analyst_a", "password": "Password123!Secure"},
    )
    await client.post(
        "/api/v1/auth/register",
        json={"email": "analyst_b@threatnex.io", "username": "analyst_b", "password": "Password123!Secure"},
    )

    # 2. Login as Analyst A and create private case
    login_a = await client.post(
        "/api/v1/auth/login",
        json={"username_or_email": "analyst_a", "password": "Password123!Secure"},
    )
    token_a = login_a.json()["access_token"]
    headers_a = {"Authorization": f"Bearer {token_a}"}

    case_a = await client.post(
        "/api/v1/investigations/",
        json={"title": "Analyst A Confidential Investigation", "priority": "high", "assigned_to": "analyst_a"},
        headers=headers_a,
    )
    case_a_id = case_a.json()["id"]

    # 3. Login as Analyst B
    login_b = await client.post(
        "/api/v1/auth/login",
        json={"username_or_email": "analyst_b", "password": "Password123!Secure"},
    )
    token_b = login_b.json()["access_token"]
    headers_b = {"Authorization": f"Bearer {token_b}"}

    # Verify Analyst B LIST endpoint DOES NOT include Analyst A's private case
    list_b = await client.get("/api/v1/investigations/", headers=headers_b)
    assert list_b.status_code == 200
    b_cases = list_b.json()
    assert not any(c["id"] == case_a_id for c in b_cases)

    # Verify Analyst B DETAIL endpoint is explicitly rejected with 403 Forbidden
    detail_b = await client.get(f"/api/v1/investigations/{case_a_id}", headers=headers_b)
    assert detail_b.status_code == 403


@pytest.mark.asyncio
async def test_refresh_token_rotation_and_reuse_detection(client):
    """Verify atomic token rotation, and that replay of an old refresh token revokes the entire family."""
    reg = await client.post(
        "/api/v1/auth/register",
        json={"email": "rotate_test@threatnex.io", "username": "rotate_test", "password": "Password123!Secure"},
    )
    assert reg.status_code == 201

    login = await client.post(
        "/api/v1/auth/login",
        json={"username_or_email": "rotate_test", "password": "Password123!Secure"},
    )
    t1_refresh = login.json()["refresh_token"]

    # 1st rotation: Refresh token 1 -> issues Refresh token 2
    rotate_1 = await client.post("/api/v1/auth/refresh", json={"refresh_token": t1_refresh})
    assert rotate_1.status_code == 200
    t2_refresh = rotate_1.json()["refresh_token"]
    t2_access = rotate_1.json()["access_token"]

    # t2_access works
    me_res = await client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {t2_access}"})
    assert me_res.status_code == 200

    # ATTACK / REPLAY: Attempt to reuse t1_refresh (already rotated)
    replay_res = await client.post("/api/v1/auth/refresh", json={"refresh_token": t1_refresh})
    assert replay_res.status_code == 401
    assert "reuse detected" in replay_res.json()["detail"].lower()

    # Verify token family was revoked: t2_refresh is now also dead
    family_dead_res = await client.post("/api/v1/auth/refresh", json={"refresh_token": t2_refresh})
    assert family_dead_res.status_code == 401


@pytest.mark.asyncio
async def test_httponly_cookie_authentication_and_logout_revocation(client):
    """Verify HttpOnly cookie flow and distributed revocation on logout."""
    await client.post(
        "/api/v1/auth/register",
        json={"email": "cookie_user@threatnex.io", "username": "cookie_user", "password": "Password123!Secure"},
    )
    login_res = await client.post(
        "/api/v1/auth/login",
        json={"username_or_email": "cookie_user", "password": "Password123!Secure"},
    )
    assert login_res.status_code == 200
    assert "threatnex_access_token" in login_res.cookies
    access_cookie = login_res.cookies["threatnex_access_token"]

    # Access /me using cookie
    me_res = await client.get("/api/v1/auth/me", cookies={"threatnex_access_token": access_cookie})
    assert me_res.status_code == 200
    assert me_res.json()["username"] == "cookie_user"

    # Logout
    logout_res = await client.post("/api/v1/auth/logout", cookies={"threatnex_access_token": access_cookie})
    assert logout_res.status_code == 200

    # Cookie is revoked in revocation manager; reuse must be denied
    post_logout_me = await client.get("/api/v1/auth/me", cookies={"threatnex_access_token": access_cookie})
    assert post_logout_me.status_code == 401


def test_production_rejects_weak_or_default_secret_key():
    """Verify Settings rejects weak or default development secret keys in production."""
    with pytest.raises(ValueError) as exc:
        Settings(
            ENVIRONMENT="production",
            SECRET_KEY="threatnex-super-secret-development-key-change-in-production-min32chars"
        )
    assert "Insecure SECRET_KEY" in str(exc.value)


@pytest.mark.asyncio
async def test_proxy_ip_spoofing_defense(client):
    """Verify untrusted X-Forwarded-For headers cannot spoof client IP for rate limiting."""
    from app.core.ratelimit import get_client_ip
    from unittest.mock import MagicMock

    # Request from non-trusted proxy attempting spoofing
    mock_request = MagicMock()
    mock_request.client.host = "203.0.113.195"  # External untrusted IP
    mock_request.headers.get.return_value = "198.51.100.22"  # Spoofed victim IP

    resolved_ip = get_client_ip(mock_request)
    assert resolved_ip == "203.0.113.195"  # Must NOT trust spoofed header
