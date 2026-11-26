"""Tests for Investigation cases and management."""
import pytest


@pytest.mark.asyncio
async def test_investigation_lifecycle(client):
    # Register & Login
    await client.post(
        "/api/v1/auth/register",
        json={"email": "investigator@threatnex.io", "username": "investigator", "password": "Password123!Safe"},
    )
    login_res = await client.post(
        "/api/v1/auth/login",
        json={"username_or_email": "investigator", "password": "Password123!Safe"},
    )
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Create Investigation with an attached IOC
    create_res = await client.post(
        "/api/v1/investigations/",
        json={
            "title": "Incident #4492 - Cobalt Strike Beacon Detected",
            "description": "Suspicious outbound traffic on port 443 matching Cobalt Strike profile.",
            "priority": "critical",
            "indicator_values": ["198.51.100.45", "https://malicious-command.io/beacon"],
        },
        headers=headers,
    )
    assert create_res.status_code == 201
    inv_data = create_res.json()
    assert inv_data["title"] == "Incident #4492 - Cobalt Strike Beacon Detected"
    assert inv_data["status"] == "open"
    assert inv_data["priority"] == "critical"
    assert len(inv_data["indicators"]) == 2
    inv_id = inv_data["id"]

    # 2. List investigations
    list_res = await client.get("/api/v1/investigations/", headers=headers)
    assert list_res.status_code == 200
    assert len(list_res.json()) >= 1

    # 3. Update investigation status to in_progress
    patch_res = await client.patch(
        f"/api/v1/investigations/{inv_id}",
        json={"status": "in_progress", "assigned_to": "Tier 2 SOC Team"},
        headers=headers,
    )
    assert patch_res.status_code == 200
    updated_data = patch_res.json()
    assert updated_data["status"] == "in_progress"
    assert updated_data["assigned_to"] == "Tier 2 SOC Team"
