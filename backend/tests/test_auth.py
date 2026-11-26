"""Tests for Authentication, JWT, and RBAC."""
import pytest


@pytest.mark.asyncio
async def test_user_registration_and_login(client):
    # Register
    reg_response = await client.post(
        "/api/v1/auth/register",
        json={
            "email": "secops@threatnex.io",
            "username": "secops",
            "password": "SuperSecretPassword123!",
            "full_name": "Security Operations Lead",
        },
    )
    assert reg_response.status_code == 201
    user_data = reg_response.json()
    assert user_data["username"] == "secops"
    assert user_data["email"] == "secops@threatnex.io"
    assert "Admin" in user_data["roles"]

    # Login
    login_response = await client.post(
        "/api/v1/auth/login",
        json={
            "username_or_email": "secops",
            "password": "SuperSecretPassword123!",
        },
    )
    assert login_response.status_code == 200
    token_data = login_response.json()
    assert "access_token" in token_data
    assert "refresh_token" in token_data
    access_token = token_data["access_token"]

    # Access /me
    me_response = await client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {access_token}"},
    )
    assert me_response.status_code == 200
    assert me_response.json()["username"] == "secops"

    # Refresh token
    refresh_response = await client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": token_data["refresh_token"]},
    )
    assert refresh_response.status_code == 200
    assert "access_token" in refresh_response.json()


@pytest.mark.asyncio
async def test_duplicate_user_registration_fails(client):
    user_payload = {
        "email": "duplicate@threatnex.io",
        "username": "dupuser",
        "password": "StrongPassword987!",
    }
    res1 = await client.post("/api/v1/auth/register", json=user_payload)
    assert res1.status_code == 201

    res2 = await client.post("/api/v1/auth/register", json=user_payload)
    assert res2.status_code == 400
    assert "already registered" in res2.json()["detail"]
