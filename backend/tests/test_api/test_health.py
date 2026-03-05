"""Integration tests for /api/health/* endpoints."""

from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient

from models.firestore import HealthLogDoc, ReportDoc, ReminderDoc
from tests.conftest import FAMILY_HEADERS, ELDERLY_HEADERS


def _today() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


def test_get_health_logs_today(client: TestClient, mock_fs):
    """GET /api/health/logs?range=today returns today's log."""
    today = _today()
    log = HealthLogDoc(date=today, mood="happy", mood_score=8, pain_level=1)
    mock_fs._health_logs["elderly-user-456"] = {today: log}

    response = client.get(
        "/api/health/logs?userId=elderly-user-456&range=today",
        headers=FAMILY_HEADERS,
    )

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    logs = data["data"]["logs"]
    assert len(logs) == 1
    assert logs[0]["mood"] == "happy"
    assert logs[0]["moodScore"] == 8


def test_get_health_logs_empty(client: TestClient, mock_fs):
    """GET /api/health/logs returns empty list when no logs for date."""
    response = client.get(
        "/api/health/logs?userId=elderly-user-456&range=today",
        headers=FAMILY_HEADERS,
    )
    assert response.status_code == 200
    assert response.json()["data"]["logs"] == []


def test_get_health_logs_requires_auth(client: TestClient):
    """GET /api/health/logs requires auth."""
    response = client.get("/api/health/logs?userId=elderly-user-456&range=today")
    assert response.status_code == 401


def test_get_health_reports(client: TestClient, mock_fs):
    """GET /api/health/reports returns reports with all fields."""
    report = ReportDoc(
        report_id="report-1",
        type="weekly",
        content="A good week overall. Mood was stable.",
        mood_trend=[7, 8, 6, 8, 9, 7, 8],
        medication_adherence=0.85,
        concerns=["Missed morning medication twice"],
        highlights=["Enjoyed gardening on Tuesday"],
    )
    mock_fs._reports["elderly-user-456"] = {"report-1": report}

    response = client.get(
        "/api/health/reports?userId=elderly-user-456",
        headers=FAMILY_HEADERS,
    )

    assert response.status_code == 200
    data = response.json()
    reports = data["data"]["reports"]
    assert len(reports) == 1

    r = reports[0]
    assert r["id"] == "report-1"
    assert r["type"] == "weekly"
    assert r["medicationAdherence"] == 0.85
    assert len(r["moodTrend"]) == 7
    assert r["concerns"] == ["Missed morning medication twice"]
    assert r["highlights"] == ["Enjoyed gardening on Tuesday"]


def test_get_health_reports_filter_by_type(client: TestClient, mock_fs):
    """GET /api/health/reports?type=daily returns only daily reports."""
    mock_fs._reports["elderly-user-456"] = {
        "daily-1": ReportDoc(report_id="daily-1", type="daily", content="Daily report"),
        "weekly-1": ReportDoc(report_id="weekly-1", type="weekly", content="Weekly report"),
    }

    response = client.get(
        "/api/health/reports?userId=elderly-user-456&type=daily",
        headers=FAMILY_HEADERS,
    )

    assert response.status_code == 200
    reports = response.json()["data"]["reports"]
    assert len(reports) == 1
    assert reports[0]["type"] == "daily"


def test_get_reminders(client: TestClient, mock_fs):
    """GET /api/health/reminders returns pending reminders."""
    reminder = ReminderDoc(
        reminder_id="rem-1",
        type="medication",
        message="Take morning pills",
        scheduled_time=datetime.now(timezone.utc),
        status="pending",
    )
    mock_fs._reminders["elderly-user-456"] = {"rem-1": reminder}

    response = client.get(
        "/api/health/reminders?userId=elderly-user-456",
        headers=FAMILY_HEADERS,
    )

    assert response.status_code == 200
    data = response.json()
    reminders = data["data"]["reminders"]
    assert len(reminders) == 1
    assert reminders[0]["type"] == "medication"
    assert reminders[0]["status"] == "pending"


def test_health_log_response_fields(client: TestClient, mock_fs):
    """Health log response includes all camelCase fields per api-contracts.md."""
    today = _today()
    log = HealthLogDoc(
        date=today,
        mood="okay",
        mood_score=6,
        pain_level=2,
        medications_taken=[{"name": "Lisinopril", "time": "09:00", "confirmed": True}],
        hydration_sent=3,
        hydration_acknowledged=2,
        activity_notes="Walked in garden",
    )
    mock_fs._health_logs["elderly-user-456"] = {today: log}

    response = client.get(
        f"/api/health/logs?userId=elderly-user-456&range={today}:{today}",
        headers=FAMILY_HEADERS,
    )

    assert response.status_code == 200
    log_data = response.json()["data"]["logs"][0]

    # Verify camelCase field names
    assert "moodScore" in log_data
    assert "painLevel" in log_data
    assert "medicationsTaken" in log_data
    assert "hydrationReminders" in log_data
    assert "activityNotes" in log_data
    assert log_data["activityNotes"] == "Walked in garden"
