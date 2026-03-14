"""Integration tests for /api/storyteller/* endpoints."""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from models.firestore import MemoryChapterDoc, UserProfile
from tests.conftest import ELDERLY_HEADERS, FAMILY_HEADERS


def _make_memory(memory_id: str) -> MemoryChapterDoc:
    return MemoryChapterDoc(
        memory_id=memory_id,
        title="My Wedding Day",
        narrative_text="It was a beautiful summer day in 1968...",
        illustration_urls=["https://storage.googleapis.com/olaf-artifacts/img/abc.jpg"],
        snippet="It was a beautiful summer day in 1968",
        tags=["wedding", "family", "1968"],
        status="complete",
    )


def test_list_memories_empty(client: TestClient, mock_fs):
    """GET /api/storyteller/memories returns empty list when no memories exist."""
    response = client.get(
        "/api/storyteller/memories?userId=elderly-user-456",
        headers=FAMILY_HEADERS,
    )

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert data["data"]["memories"] == []
    assert data["data"]["total"] == 0


def test_list_memories_with_data(client: TestClient, mock_fs):
    """GET /api/storyteller/memories returns paginated memory list."""
    mock_fs._memories["elderly-user-456"] = {
        "mem-1": _make_memory("mem-1"),
        "mem-2": _make_memory("mem-2"),
    }

    response = client.get(
        "/api/storyteller/memories?userId=elderly-user-456",
        headers=FAMILY_HEADERS,
    )

    assert response.status_code == 200
    data = response.json()
    assert data["data"]["total"] == 2
    memories = data["data"]["memories"]
    assert len(memories) == 2

    # Check camelCase response fields
    m = memories[0]
    assert "id" in m
    assert "title" in m
    assert "illustrationUrls" in m
    assert "snippet" in m
    assert "createdAt" in m


def test_get_single_memory(client: TestClient, mock_fs):
    """GET /api/storyteller/memories/{memoryId} returns full chapter."""
    memory = _make_memory("mem-1")
    mock_fs._memories["elderly-user-456"] = {"mem-1": memory}

    response = client.get(
        "/api/storyteller/memories/mem-1?userId=elderly-user-456",
        headers=FAMILY_HEADERS,
    )

    assert response.status_code == 200
    data = response.json()
    chapter = data["data"]

    assert chapter["id"] == "mem-1"
    assert chapter["title"] == "My Wedding Day"
    assert "narrativeText" in chapter
    assert "illustrationUrls" in chapter
    assert "tags" in chapter


def test_get_memory_not_found(client: TestClient, mock_fs):
    """GET /api/storyteller/memories/{memoryId} returns 404 if not found."""
    response = client.get(
        "/api/storyteller/memories/nonexistent?userId=elderly-user-456",
        headers=FAMILY_HEADERS,
    )
    assert response.status_code == 404


def test_create_memory_accepted(client: TestClient, mock_fs):
    """POST /api/storyteller/create-memory returns 202 with task ID."""
    # Mock the background task runner to avoid actual ADK invocation
    with patch(
        "api.routes.storyteller._run_storyteller",
        new_callable=AsyncMock,
    ):
        response = client.post(
            "/api/storyteller/create-memory",
            json={
                "userId": "elderly-user-456",
                "transcript": "I want to tell you about my wedding day. It was 1968...",
                "title": "My Wedding Day",
            },
            headers=ELDERLY_HEADERS,
        )

    assert response.status_code == 202
    data = response.json()
    assert data["status"] == "accepted"
    assert "taskId" in data["data"]
    assert data["data"]["message"] == "Memory chapter creation started"


def test_create_daily_narrative_accepted(client: TestClient, mock_fs):
    """POST /api/storyteller/create-daily-narrative returns 202."""
    with patch("api.routes.storyteller._run_storyteller", new_callable=AsyncMock):
        response = client.post(
            "/api/storyteller/create-daily-narrative",
            json={"userId": "elderly-user-456", "date": "2026-03-05"},
            headers=ELDERLY_HEADERS,
        )

    assert response.status_code == 202
    assert response.json()["status"] == "accepted"


def test_create_weekly_report_accepted(client: TestClient, mock_fs):
    """POST /api/storyteller/create-weekly-report returns 202."""
    with patch("api.routes.storyteller._run_storyteller", new_callable=AsyncMock):
        response = client.post(
            "/api/storyteller/create-weekly-report",
            json={"userId": "elderly-user-456", "weekStart": "2026-03-01"},
            headers=ELDERLY_HEADERS,
        )

    assert response.status_code == 202
    assert response.json()["status"] == "accepted"


def test_list_memories_pagination(client: TestClient, mock_fs):
    """GET /api/storyteller/memories respects limit and offset."""
    mock_fs._memories["elderly-user-456"] = {
        f"mem-{i}": _make_memory(f"mem-{i}") for i in range(5)
    }

    response = client.get(
        "/api/storyteller/memories?userId=elderly-user-456&limit=2&offset=0",
        headers=FAMILY_HEADERS,
    )

    data = response.json()["data"]
    assert data["total"] == 5
    assert len(data["memories"]) == 2
    assert data["hasMore"] is True
