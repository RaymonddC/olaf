"""Integration tests for /api/auth/* endpoints."""

from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from models.firestore import FamilyLink, UserProfile
from tests.conftest import ELDERLY_HEADERS, FAMILY_HEADERS


def test_register_creates_user(client: TestClient, mock_fs):
    """POST /api/auth/register creates a new user profile."""
    response = client.post(
        "/api/auth/register",
        json={
            "role": "family",
            "name": "Alice Smith",
            "timezone": "America/New_York",
            "language": "en",
        },
        headers=FAMILY_HEADERS,
    )

    assert response.status_code == 201
    data = response.json()
    assert data["status"] == "success"
    assert data["data"]["role"] == "family"
    assert data["data"]["userId"] == "test-user-123"


def test_register_conflict_if_exists(client: TestClient, mock_fs):
    """POST /api/auth/register returns 409 if profile already exists."""
    # Pre-populate the user
    mock_fs._users["test-user-123"] = UserProfile(
        uid="test-user-123",
        role="family",
        name="Alice Smith",
        timezone="UTC",
        language="en",
    )

    response = client.post(
        "/api/auth/register",
        json={"role": "family", "name": "Alice", "timezone": "UTC", "language": "en"},
        headers=FAMILY_HEADERS,
    )
    assert response.status_code == 409


def test_get_me_returns_profile(client: TestClient, mock_fs):
    """GET /api/auth/me returns the user's profile."""
    mock_fs._users["test-user-123"] = UserProfile(
        uid="test-user-123",
        role="family",
        name="Alice Smith",
        timezone="UTC",
        language="en",
    )

    response = client.get("/api/auth/me", headers=FAMILY_HEADERS)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert data["data"]["name"] == "Alice Smith"
    assert data["data"]["role"] == "family"
    assert "linkedAccounts" in data["data"]


def test_get_me_with_family_links(client: TestClient, mock_fs):
    """GET /api/auth/me includes linked elderly accounts."""
    mock_fs._users["test-user-123"] = UserProfile(
        uid="test-user-123",
        role="family",
        name="Alice Smith",
        timezone="UTC",
        language="en",
    )
    mock_fs._users["elderly-user-456"] = UserProfile(
        uid="elderly-user-456",
        role="elderly",
        name="Robert Smith",
        timezone="UTC",
        language="en",
    )
    mock_fs._family_links.append(
        FamilyLink(
            link_id="test-user-123_elderly-user-456",
            elderly_user_id="elderly-user-456",
            family_user_id="test-user-123",
            relationship="son",
        )
    )

    response = client.get("/api/auth/me", headers=FAMILY_HEADERS)
    assert response.status_code == 200
    data = response.json()
    accounts = data["data"]["linkedAccounts"]
    assert len(accounts) == 1
    assert accounts[0]["userId"] == "elderly-user-456"
    assert accounts[0]["role"] == "elderly"
    assert accounts[0]["relationship"] == "son"


def test_get_me_404_if_no_profile(client: TestClient, mock_fs):
    """GET /api/auth/me returns 404 if profile not found."""
    response = client.get("/api/auth/me", headers=FAMILY_HEADERS)
    assert response.status_code == 404


def test_auth_missing_token_returns_401(client: TestClient):
    """Requests without Bearer token return 401."""
    response = client.get("/api/auth/me")
    assert response.status_code == 401


def test_family_link_creates_link(client: TestClient, mock_fs):
    """POST /api/auth/family-link creates a family link."""
    mock_fs._users["test-user-123"] = UserProfile(
        uid="test-user-123",
        role="family",
        name="Alice Smith",
        timezone="UTC",
        language="en",
    )
    mock_fs._users["elderly-user-456"] = UserProfile(
        uid="elderly-user-456",
        role="elderly",
        name="Robert Smith",
        timezone="UTC",
        language="en",
    )

    response = client.post(
        "/api/auth/family-link",
        json={
            "elderlyUserId": "elderly-user-456",
            "relationship": "daughter",
            "permissions": ["view_reports", "receive_alerts"],
        },
        headers=FAMILY_HEADERS,
    )

    assert response.status_code == 201
    data = response.json()
    assert data["status"] == "success"
    assert data["data"]["relationship"] == "daughter"
    assert len(mock_fs._family_links) == 1


def test_family_link_elderly_not_found(client: TestClient, mock_fs):
    """POST /api/auth/family-link returns 404 if elderly user doesn't exist."""
    mock_fs._users["test-user-123"] = UserProfile(
        uid="test-user-123",
        role="family",
        name="Alice",
        timezone="UTC",
        language="en",
    )

    response = client.post(
        "/api/auth/family-link",
        json={"elderlyUserId": "nonexistent", "relationship": "son", "permissions": []},
        headers=FAMILY_HEADERS,
    )
    assert response.status_code == 404
