"""OLAF — Navigator session manager.

Tracks active navigation sessions, coordinates between the browser service,
WebSocket connections, and the NavigatorAgent confirmation flow.
"""

import asyncio
import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Literal, Optional

from fastapi import WebSocket

from services.browser_service import BrowserSession, get_browser_service

logger = logging.getLogger(__name__)

# Auto-close sessions after 5 minutes of inactivity
SESSION_TIMEOUT_SECONDS = 300

SessionState = Literal["navigating", "waiting_confirmation", "completed", "error"]


class NavigatorSession:
    """A single active navigation session."""

    def __init__(
        self,
        session_id: str,
        user_id: str,
        task: str,
        browser_session: BrowserSession,
        template_id: Optional[str] = None,
        start_url: Optional[str] = None,
    ):
        self.session_id = session_id
        self.user_id = user_id
        self.task = task
        self.template_id = template_id
        self.start_url = start_url
        self.browser_session = browser_session
        self.state: SessionState = "navigating"
        self.websocket: Optional[WebSocket] = None
        self.created_at = datetime.now(timezone.utc)
        self.last_activity = datetime.now(timezone.utc)
        self.step_count = 0
        self.total_steps = 0  # Estimated from template or default

        # Confirmation flow
        self._pending_confirmation: Optional[dict] = None
        self._confirmation_event = asyncio.Event()
        self._confirmation_result: Optional[bool] = None

    def touch(self) -> None:
        """Update last activity timestamp."""
        self.last_activity = datetime.now(timezone.utc)

    @property
    def is_expired(self) -> bool:
        elapsed = (datetime.now(timezone.utc) - self.last_activity).total_seconds()
        return elapsed > SESSION_TIMEOUT_SECONDS

    # ── WebSocket messaging ──────────────────────────────────────────────

    async def send_screenshot(
        self, image_base64: str, page_url: str, page_title: str
    ) -> None:
        """Send a screenshot frame to the connected WebSocket client."""
        if not self.websocket:
            return
        try:
            await self.websocket.send_json({
                "type": "screenshot",
                "data": {
                    "imageBase64": image_base64,
                    "pageUrl": page_url,
                    "pageTitle": page_title,
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                },
            })
        except Exception as exc:
            logger.warning("Failed to send screenshot for session %s: %s", self.session_id, exc)

    async def send_narration(self, message: str) -> None:
        """Send narration text (what the agent is doing) to the client."""
        if not self.websocket:
            return
        try:
            await self.websocket.send_json({
                "type": "narration",
                "data": {
                    "message": message,
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                },
            })
        except Exception as exc:
            logger.warning("Failed to send narration for session %s: %s", self.session_id, exc)

    async def send_status(self, state: SessionState, message: str) -> None:
        """Send a status update to the client."""
        self.state = state
        if not self.websocket:
            return
        try:
            await self.websocket.send_json({
                "type": "status",
                "data": {
                    "state": state,
                    "message": message,
                },
            })
        except Exception as exc:
            logger.warning("Failed to send status for session %s: %s", self.session_id, exc)

    async def request_confirmation(
        self, action_description: str, action_type: str
    ) -> dict:
        """Send a confirmation request and block until the user responds.

        Returns:
            dict with action_id and approved (bool).
        """
        action_id = uuid.uuid4().hex[:12]
        self._pending_confirmation = {
            "actionId": action_id,
            "actionDescription": action_description,
            "actionType": action_type,
        }
        self._confirmation_event.clear()
        self._confirmation_result = None
        self.state = "waiting_confirmation"

        if self.websocket:
            try:
                await self.websocket.send_json({
                    "type": "confirmation_required",
                    "data": {
                        "actionId": action_id,
                        "actionDescription": action_description,
                        "actionType": action_type,
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                    },
                })
            except Exception as exc:
                logger.warning("Failed to send confirmation request: %s", exc)
                return {"action_id": action_id, "approved": False}

        # Wait for user to respond (with timeout)
        try:
            await asyncio.wait_for(
                self._confirmation_event.wait(),
                timeout=SESSION_TIMEOUT_SECONDS,
            )
        except asyncio.TimeoutError:
            logger.warning("Confirmation timed out for session %s", self.session_id)
            self._pending_confirmation = None
            self.state = "navigating"
            return {"action_id": action_id, "approved": False}

        approved = self._confirmation_result or False
        self._pending_confirmation = None
        self.state = "navigating"
        return {"action_id": action_id, "approved": approved}

    def resolve_confirmation(self, action_id: str, approved: bool) -> bool:
        """Resolve a pending confirmation from the user.

        Returns True if the confirmation was matched and resolved.
        """
        if (
            self._pending_confirmation
            and self._pending_confirmation["actionId"] == action_id
        ):
            self._confirmation_result = approved
            self._confirmation_event.set()
            return True
        return False


class NavigatorSessionManager:
    """Manages all active navigator sessions."""

    def __init__(self) -> None:
        self._sessions: dict[str, NavigatorSession] = {}
        self._cleanup_task: Optional[asyncio.Task] = None

    @property
    def sessions(self) -> dict[str, NavigatorSession]:
        return self._sessions

    async def start_session(
        self,
        user_id: str,
        task: str,
        template_id: Optional[str] = None,
        start_url: Optional[str] = None,
    ) -> NavigatorSession:
        """Create a new navigator session with a browser instance."""
        session_id = uuid.uuid4().hex[:16]
        browser_service = get_browser_service()

        # Ensure browser is running
        await browser_service.start()
        browser_session = await browser_service.create_session(session_id)

        session = NavigatorSession(
            session_id=session_id,
            user_id=user_id,
            task=task,
            browser_session=browser_session,
            template_id=template_id,
            start_url=start_url,
        )
        self._sessions[session_id] = session

        # Start cleanup loop if not running
        if self._cleanup_task is None or self._cleanup_task.done():
            self._cleanup_task = asyncio.create_task(self._cleanup_loop())

        logger.info(
            "Navigator session %s started for user %s: %s",
            session_id, user_id, task,
        )
        return session

    def get_session(self, session_id: str) -> Optional[NavigatorSession]:
        return self._sessions.get(session_id)

    async def stop_session(self, session_id: str) -> Optional[str]:
        """Stop a session, clean up browser, return summary."""
        session = self._sessions.pop(session_id, None)
        if not session:
            return None

        await session.send_status("completed", "Navigation session ended")

        # Close the browser session
        browser_service = get_browser_service()
        await browser_service.close_session(session_id)

        summary = f"Navigation completed. Task: {session.task}"
        logger.info("Navigator session %s stopped", session_id)
        return summary

    async def _cleanup_loop(self) -> None:
        """Periodically check for expired sessions."""
        while self._sessions:
            await asyncio.sleep(30)
            expired = [
                sid for sid, sess in self._sessions.items() if sess.is_expired
            ]
            for sid in expired:
                logger.info("Auto-closing expired session %s", sid)
                await self.stop_session(sid)


# ── Singleton ────────────────────────────────────────────────────────────────

_session_manager: Optional[NavigatorSessionManager] = None


def get_session_manager() -> NavigatorSessionManager:
    """Get or create the global NavigatorSessionManager singleton."""
    global _session_manager
    if _session_manager is None:
        _session_manager = NavigatorSessionManager()
    return _session_manager
