"""Integration tests for /api/alerts/* endpoints."""

from fastapi.testclient import TestClient

from models.firestore import AlertDoc
from tests.conftest import FAMILY_HEADERS


def _make_alert(alert_id: str, user_id: str, severity: str = "medium", acknowledged: bool = False):
    return AlertDoc(
        alert_id=alert_id,
        user_id=user_id,
        type="emotional_distress",
        severity=severity,
        message="User appears distressed",
        source="companion",
        acknowledged=acknowledged,
    )


def test_get_alerts_returns_list(client: TestClient, mock_fs):
    """GET /api/alerts returns alerts for a user."""
    mock_fs._alerts.append(_make_alert("alert-1", "elderly-user-456"))
    mock_fs._alerts.append(_make_alert("alert-2", "elderly-user-456", severity="high"))

    response = client.get(
        "/api/alerts?userId=elderly-user-456",
        headers=FAMILY_HEADERS,
    )

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert len(data["data"]["alerts"]) == 2


def test_get_alerts_filter_acknowledged(client: TestClient, mock_fs):
    """GET /api/alerts?acknowledged=false returns only unacknowledged."""
    mock_fs._alerts.append(_make_alert("alert-1", "elderly-user-456", acknowledged=False))
    mock_fs._alerts.append(_make_alert("alert-2", "elderly-user-456", acknowledged=True))

    response = client.get(
        "/api/alerts?userId=elderly-user-456&acknowledged=false",
        headers=FAMILY_HEADERS,
    )

    assert response.status_code == 200
    data = response.json()
    alerts = data["data"]["alerts"]
    assert len(alerts) == 1
    assert alerts[0]["acknowledged"] is False


def test_get_alerts_empty(client: TestClient, mock_fs):
    """GET /api/alerts returns empty list when no alerts exist."""
    response = client.get(
        "/api/alerts?userId=elderly-user-456",
        headers=FAMILY_HEADERS,
    )
    assert response.status_code == 200
    assert response.json()["data"]["alerts"] == []


def test_acknowledge_alert(client: TestClient, mock_fs):
    """PATCH /api/alerts/{alertId}/acknowledge acknowledges an alert."""
    mock_fs._alerts.append(_make_alert("alert-1", "elderly-user-456"))

    response = client.patch(
        "/api/alerts/alert-1/acknowledge",
        headers=FAMILY_HEADERS,
    )

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert data["data"]["acknowledged"] is True
    assert data["data"]["acknowledgedBy"] == "test-user-123"


def test_acknowledge_nonexistent_alert(client: TestClient, mock_fs):
    """PATCH /api/alerts/{alertId}/acknowledge returns 404 if not found."""
    response = client.patch(
        "/api/alerts/nonexistent-alert/acknowledge",
        headers=FAMILY_HEADERS,
    )
    assert response.status_code == 404


def test_get_alerts_requires_auth(client: TestClient):
    """GET /api/alerts requires a valid auth token."""
    response = client.get("/api/alerts?userId=elderly-user-456")
    assert response.status_code == 401


def test_alerts_severity_fields(client: TestClient, mock_fs):
    """Alert response includes all expected fields per api-contracts.md."""
    mock_fs._alerts.append(
        AlertDoc(
            alert_id="alert-abc",
            user_id="elderly-user-456",
            type="missed_medication",
            severity="low",
            message="Morning medication not confirmed",
            source="system",
        )
    )

    response = client.get(
        "/api/alerts?userId=elderly-user-456",
        headers=FAMILY_HEADERS,
    )

    alert = response.json()["data"]["alerts"][0]
    assert alert["id"] == "alert-abc"
    assert alert["userId"] == "elderly-user-456"
    assert alert["type"] == "missed_medication"
    assert alert["severity"] == "low"
    assert alert["source"] == "system"
    assert alert["acknowledged"] is False
