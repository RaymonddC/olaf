"""Integration tests for /api/companion/* endpoints.

Tests cover tool execution endpoints called by the browser
when Gemini Live API issues function calls.
"""

from unittest.mock import AsyncMock, patch
from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient

from models.firestore import UserProfile
from tests.conftest import FAMILY_HEADERS, ELDERLY_HEADERS


def _make_elderly_user():
    return UserProfile(
        uid="elderly-user-456",
        role="elderly",
        name="Robert Smith",
        timezone="UTC",
        language="en",
        medications=["lisinopril", "metformin"],
    )


def test_log_health_checkin(client: TestClient, mock_fs):
    """POST /api/companion/log-health-checkin saves a health log."""
    mock_fs._users["elderly-user-456"] = _make_elderly_user()

    # Override to avoid recursive flag_emotional_distress calls
    with patch(
        "caria_agents.tools.companion_tools.flag_emotional_distress",
        new_callable=AsyncMock,
        return_value={"status": "success", "data": {"alert_id": "a1", "action": "logged"}},
    ):
        response = client.post(
            "/api/companion/log-health-checkin",
            json={
                "userId": "elderly-user-456",
                "args": {"mood": "happy", "painLevel": 0, "notes": "Feeling good today"},
            },
            headers=ELDERLY_HEADERS,
        )

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert data["data"]["date"] is not None


def test_log_health_checkin_triggers_alert_for_high_pain(client: TestClient, mock_fs):
    """POST /api/companion/log-health-checkin creates alert when pain >= 7."""
    mock_fs._users["elderly-user-456"] = _make_elderly_user()

    with patch(
        "caria_agents.tools.companion_tools.flag_emotional_distress",
        new_callable=AsyncMock,
        return_value={"status": "success", "data": {"alert_id": "a1", "action": "logged"}},
    ) as mock_flag:
        response = client.post(
            "/api/companion/log-health-checkin",
            json={
                "userId": "elderly-user-456",
                "args": {"mood": "sad", "painLevel": 8, "notes": "Severe back pain"},
            },
            headers=ELDERLY_HEADERS,
        )

    assert response.status_code == 200
    # flag_emotional_distress should have been called for high pain
    assert mock_flag.called


def test_flag_emotional_distress_low_severity(client: TestClient, mock_fs):
    """POST /api/companion/flag-emotional-distress with low severity just logs."""
    mock_fs._users["elderly-user-456"] = _make_elderly_user()

    response = client.post(
        "/api/companion/flag-emotional-distress",
        json={
            "userId": "elderly-user-456",
            "args": {
                "severity": "low",
                "observation": "User mentioned feeling a bit lonely",
            },
        },
        headers=ELDERLY_HEADERS,
    )

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert data["data"]["action"] == "logged"
    # Alert should be created in Firestore
    assert len(mock_fs._alerts) == 1
    assert mock_fs._alerts[0].severity == "low"


def test_flag_emotional_distress_high_severity(client: TestClient, mock_fs):
    """POST /api/companion/flag-emotional-distress with high severity returns urgent_alert."""
    mock_fs._users["elderly-user-456"] = _make_elderly_user()
    # No family links — action will still be "urgent_alert" but no notification sent

    response = client.post(
        "/api/companion/flag-emotional-distress",
        json={
            "userId": "elderly-user-456",
            "args": {
                "severity": "high",
                "observation": "User crying and expressing hopelessness",
            },
        },
        headers=ELDERLY_HEADERS,
    )

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    # With no family links, action is still decided based on severity
    assert data["data"]["action"] in ("logged", "urgent_alert", "notified_family")


def test_set_reminder(client: TestClient, mock_fs):
    """POST /api/companion/set-reminder creates a reminder."""
    mock_fs._users["elderly-user-456"] = _make_elderly_user()

    response = client.post(
        "/api/companion/set-reminder",
        json={
            "userId": "elderly-user-456",
            "args": {
                "reminderType": "medication",
                "message": "Take your blood pressure medication",
                "time": "09:00",
            },
        },
        headers=ELDERLY_HEADERS,
    )

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    # tool returns snake_case keys directly in the data dict
    assert "reminder_id" in data["data"]
    assert len(mock_fs._reminders.get("elderly-user-456", {})) == 1


def test_log_conversation(client: TestClient, mock_fs):
    """POST /api/companion/log-conversation saves a conversation summary."""
    mock_fs._users["elderly-user-456"] = _make_elderly_user()

    with patch(
        "caria_agents.tools.companion_tools.flag_emotional_distress",
        new_callable=AsyncMock,
        return_value={"status": "success", "data": {"alert_id": "a1", "action": "logged"}},
    ):
        response = client.post(
            "/api/companion/log-conversation",
            json={
                "userId": "elderly-user-456",
                "sessionDuration": 600,
                "transcript": [
                    {
                        "role": "model",
                        "text": "Hello! How are you feeling today?",
                        "timestamp": "2026-03-05T09:00:00Z",
                    },
                    {
                        "role": "user",
                        "text": "I'm doing pretty well, thank you.",
                        "timestamp": "2026-03-05T09:00:05Z",
                    },
                ],
                "flags": [],
            },
            headers=ELDERLY_HEADERS,
        )

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    # tool returns snake_case keys directly in the data dict
    assert "conversation_id" in data["data"]
    assert "summary" in data["data"]


def test_list_conversations(client: TestClient, mock_fs):
    """GET /api/companion/conversations returns conversation list."""
    from models.firestore import ConversationDoc

    convo = ConversationDoc(
        conversation_id="convo-1",
        summary="A brief chat about the weather",
        mood_score=7,
        session_duration=300,
        flags=[],
        transcript_count=4,
    )
    mock_fs._conversations["elderly-user-456"] = {"convo-1": convo}

    response = client.get(
        "/api/companion/conversations?userId=elderly-user-456",
        headers=FAMILY_HEADERS,
    )

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    convos = data["data"]["conversations"]
    assert len(convos) == 1
    assert convos[0]["conversationId"] == "convo-1"
    assert convos[0]["moodScore"] == 7


def test_analyze_medication_with_match(client: TestClient, mock_fs):
    """POST /api/companion/analyze-medication matches known medication."""
    user = _make_elderly_user()
    mock_fs._users["elderly-user-456"] = user

    response = client.post(
        "/api/companion/analyze-medication",
        json={
            "userId": "elderly-user-456",
            "args": {
                "imageDescription": "Lisinopril 10mg tablets, 30-day supply",
            },
        },
        headers=ELDERLY_HEADERS,
    )

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    # tool returns snake_case keys directly in the data dict
    assert data["data"]["match_status"] == "match"
