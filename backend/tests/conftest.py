"""Shared test fixtures for OLAF backend tests.

We mock out the google-adk and google-genai packages at the sys.modules level
before any backend module is imported.  This lets tests run without needing
those heavy dependencies installed.
"""

import sys
import types
from collections.abc import AsyncGenerator
from unittest.mock import MagicMock, patch

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from httpx import ASGITransport, AsyncClient

# ── Inject stub modules for google.adk / google.genai ─────────────────────────
# Must happen before any backend code is imported.

def _make_module(name: str) -> types.ModuleType:
    mod = types.ModuleType(name)
    sys.modules[name] = mod
    return mod


def _stub_adk() -> None:
    """Create minimal stub modules for google.adk and google.genai.

    We do NOT replace the top-level 'google' namespace package because
    firebase-admin needs google.auth which lives there. Instead we only
    inject the specific sub-packages that the backend code imports.
    """
    if "google.adk" in sys.modules:
        return  # Already stubbed

    # google.adk sub-packages — stub ALL ADK modules that backend code imports.
    # We inject these into sys.modules before any backend import so Python uses
    # the stubs instead of trying to load the real (uninstalled) package.
    adk = _make_module("google.adk")
    adk.__path__ = []

    # google.adk.runners
    adk_runners = _make_module("google.adk.runners")
    adk_runners.Runner = MagicMock()

    # google.adk.sessions
    adk_sessions = _make_module("google.adk.sessions")
    adk_sessions.InMemorySessionService = MagicMock(return_value=MagicMock())

    # google.adk.cli.fast_api
    adk_cli = _make_module("google.adk.cli")
    adk_cli.__path__ = []
    adk_cli_fast_api = _make_module("google.adk.cli.fast_api")

    def _fake_get_fast_api_app(**kwargs):
        return FastAPI()

    adk_cli_fast_api.get_fast_api_app = _fake_get_fast_api_app

    # google.adk.agents (and sub-modules)
    adk_agents = _make_module("google.adk.agents")
    adk_agents.__path__ = []
    adk_agents.Agent = MagicMock()
    adk_agents.LlmAgent = MagicMock()
    adk_agents.SequentialAgent = MagicMock()
    adk_agents_cb = _make_module("google.adk.agents.callback_context")
    adk_agents_cb.CallbackContext = MagicMock()

    # google.adk.tools (and sub-modules)
    adk_tools = _make_module("google.adk.tools")
    adk_tools.__path__ = []
    adk_tools.AgentTool = MagicMock()
    adk_tool_context = _make_module("google.adk.tools.tool_context")
    adk_tool_context.ToolContext = MagicMock()

    # google.adk.models (used by callbacks/safety.py)
    adk_models = _make_module("google.adk.models")
    adk_models.LlmRequest = MagicMock()
    adk_models.LlmResponse = MagicMock()

    # google.genai (only stub if not already present from real install)
    if "google.genai" not in sys.modules:
        genai = _make_module("google.genai")
        genai.__path__ = []
        genai_types = _make_module("google.genai.types")
        genai_types.Content = MagicMock()
        genai_types.Part = MagicMock()
        genai.types = genai_types

    # Stub google.cloud sub-packages that are NOT installed.
    # google.cloud itself exists (from firebase-admin), so only add sub-modules.

    # google.cloud.firestore — needs Client, DocumentReference, CollectionReference
    if "google.cloud.firestore" not in sys.modules:
        fs_mod = _make_module("google.cloud.firestore")
        fs_mod.Client = MagicMock()
        fs_mod.DocumentReference = MagicMock()
        fs_mod.CollectionReference = MagicMock()
        fs_mod.AsyncClient = MagicMock()

    if "google.cloud.storage" not in sys.modules:
        _make_module("google.cloud.storage")

    if "google.cloud.aiplatform" not in sys.modules:
        _make_module("google.cloud.aiplatform")

    for submod in ("vertexai", "vertexai.preview", "vertexai.preview.vision_models"):
        if submod not in sys.modules:
            _make_module(submod)


_stub_adk()

# ── Firebase mock ─────────────────────────────────────────────────────────────

MOCK_USER_TOKEN = {
    "uid": "test-user-123",
    "email": "test@example.com",
    "role": "family",
}

MOCK_ELDERLY_TOKEN = {
    "uid": "elderly-user-456",
    "email": "elderly@example.com",
    "role": "elderly",
}


def mock_verify_id_token(token: str) -> dict:
    """Mock Firebase ID token verification."""
    if token == "valid-family-token":
        return MOCK_USER_TOKEN
    if token == "valid-elderly-token":
        return MOCK_ELDERLY_TOKEN
    raise Exception("Invalid token")


# ── Firestore mock ────────────────────────────────────────────────────────────


class MockFirestoreService:
    """Mock FirestoreService for unit tests."""

    def __init__(self):
        self._users = {}
        self._family_links = []
        self._conversations = {}
        self._memories = {}
        self._health_logs = {}
        self._reports = {}
        self._reminders = {}
        self._alerts = []

    async def get_user(self, uid: str):
        return self._users.get(uid)

    async def create_user(self, profile):
        self._users[profile.uid] = profile
        return profile

    async def update_user(self, uid: str, data: dict):
        if uid in self._users:
            for k, v in data.items():
                setattr(self._users[uid], k, v)

    async def get_family_links_for_elderly(self, elderly_uid: str):
        return [lnk for lnk in self._family_links if lnk.elderly_user_id == elderly_uid]

    async def get_family_links_for_family(self, family_uid: str):
        return [lnk for lnk in self._family_links if lnk.family_user_id == family_uid]

    async def create_family_link(self, link):
        self._family_links.append(link)
        return link

    async def get_conversations(self, uid: str, limit: int = 20):
        return list(self._conversations.get(uid, {}).values())[:limit]

    async def save_conversation(self, uid: str, convo):
        if uid not in self._conversations:
            self._conversations[uid] = {}
        self._conversations[uid][convo.conversation_id] = convo
        return convo

    async def list_memories(self, uid: str, limit: int = 20, offset: int = 0):
        mems = list(self._memories.get(uid, {}).values())
        return mems[offset : offset + limit], len(mems)

    async def get_memory(self, uid: str, memory_id: str):
        return self._memories.get(uid, {}).get(memory_id)

    async def save_memory(self, uid: str, memory):
        if uid not in self._memories:
            self._memories[uid] = {}
        self._memories[uid][memory.memory_id] = memory
        return memory

    async def get_health_logs(self, uid: str, start_date: str, end_date: str):
        logs = list(self._health_logs.get(uid, {}).values())
        return [log for log in logs if start_date <= log.date <= end_date]

    async def get_health_log(self, uid: str, date: str):
        return self._health_logs.get(uid, {}).get(date)

    async def save_health_log(self, uid: str, log):
        if uid not in self._health_logs:
            self._health_logs[uid] = {}
        self._health_logs[uid][log.date] = log
        return log

    async def get_reports(self, uid: str, report_type=None, limit: int = 20):
        reports = list(self._reports.get(uid, {}).values())
        if report_type:
            reports = [r for r in reports if r.type == report_type]
        return reports[:limit]

    async def save_report(self, uid: str, report):
        if uid not in self._reports:
            self._reports[uid] = {}
        self._reports[uid][report.report_id] = report
        return report

    async def get_reminders(self, uid: str, status=None):
        reminders = list(self._reminders.get(uid, {}).values())
        if status:
            reminders = [r for r in reminders if r.status == status]
        return reminders

    async def save_reminder(self, uid: str, reminder):
        if uid not in self._reminders:
            self._reminders[uid] = {}
        self._reminders[uid][reminder.reminder_id] = reminder
        return reminder

    async def update_reminder(self, uid: str, reminder_id: str, data: dict):
        if uid in self._reminders and reminder_id in self._reminders[uid]:
            for k, v in data.items():
                setattr(self._reminders[uid][reminder_id], k, v)

    async def get_alerts(self, user_id: str, acknowledged=None, limit: int = 50):
        alerts = [a for a in self._alerts if a.user_id == user_id]
        if acknowledged is not None:
            alerts = [a for a in alerts if a.acknowledged == acknowledged]
        return alerts[:limit]

    async def create_alert(self, alert):
        self._alerts.append(alert)
        return alert

    async def acknowledge_alert(self, alert_id: str, acknowledged_by: str):
        for alert in self._alerts:
            if alert.alert_id == alert_id:
                alert.acknowledged = True
                alert.acknowledged_by = acknowledged_by
                return alert
        return None


# ── App fixture ───────────────────────────────────────────────────────────────


@pytest.fixture(scope="session")
def mock_firebase():
    """Patch Firebase Admin auth verification for all tests."""
    with patch("firebase_admin.auth.verify_id_token", side_effect=mock_verify_id_token):
        with patch("firebase_admin._apps", {"[DEFAULT]": MagicMock()}):
            yield


@pytest.fixture
def mock_fs():
    """Fresh MockFirestoreService for each test."""
    return MockFirestoreService()


@pytest.fixture
def app(mock_firebase, mock_fs):
    """Build a test FastAPI app with only OLAF's custom routes (no ADK app).

    We also patch `get_firestore_service` in both the FastAPI DI layer and
    inside `companion_tools` (which calls it directly, outside DI).
    """
    with patch("firebase_admin._apps", {"[DEFAULT]": MagicMock()}):
        # Import route modules (ADK stubs are already in sys.modules)
        from api.routes import alerts, auth, companion, conversations, health, storyteller
        from services.firestore_service import get_firestore_service

        test_app = FastAPI()

        test_app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
        test_app.include_router(companion.router, prefix="/api/companion", tags=["companion"])
        test_app.include_router(conversations.router, prefix="/api/companion", tags=["companion"])
        test_app.include_router(storyteller.router, prefix="/api/storyteller", tags=["storyteller"])
        test_app.include_router(health.router, prefix="/api/health", tags=["health"])
        test_app.include_router(alerts.router, prefix="/api/alerts", tags=["alerts"])

        # Override the Firestore dependency for FastAPI DI
        test_app.dependency_overrides[get_firestore_service] = lambda: mock_fs

        # Also patch companion_tools.get_firestore_service which is called directly
        # (not via FastAPI DI), and similarly for any other tool modules.
        with patch(
            "olaf_agents.tools.companion_tools.get_firestore_service",
            return_value=mock_fs,
        ):
            yield test_app

        test_app.dependency_overrides.clear()


@pytest.fixture
def client(app):
    """Synchronous test client."""
    return TestClient(app)


@pytest.fixture
async def async_client(app) -> AsyncGenerator[AsyncClient, None]:
    """Async HTTP client for async tests."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac


# ── Common auth headers ───────────────────────────────────────────────────────

FAMILY_HEADERS = {"Authorization": "Bearer valid-family-token"}
ELDERLY_HEADERS = {"Authorization": "Bearer valid-elderly-token"}
