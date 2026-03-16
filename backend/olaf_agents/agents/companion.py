"""OLAF Companion Agent for ADK Bidi-streaming.

This agent runs server-side through ADK's runner.run_live(), replacing the
browser-direct Gemini Live API connection. Tools are executed server-side
with user_id read from ADK session state.

Model: gemini-2.5-flash-native-audio-preview-09-2025
"""

import logging

from google.adk.agents import Agent
from google.adk.tools.tool_context import ToolContext

from olaf_agents.instructions.companion import COMPANION_INSTRUCTION

logger = logging.getLogger(__name__)
from olaf_agents.tools.companion_tools import (
    analyze_medication as _analyze_medication,
)
from olaf_agents.tools.companion_tools import (
    call_for_help as _call_for_help,
)
from olaf_agents.tools.companion_tools import (
    complete_reminder as _complete_reminder,
)
from olaf_agents.tools.companion_tools import (
    log_health_checkin as _log_checkin,
)
from olaf_agents.tools.companion_tools import (
    set_reminder as _set_reminder,
)
from olaf_agents.tools.companion_tools import (
    share_update_with_family as _share_update_with_family,
)

_COMPANION_MODEL = "gemini-2.5-flash-native-audio-preview-09-2025"

# Tools whose post-execution response should be suppressed (no double speech).
# The model already spoke before calling these — no need for a second response.
SILENT_TOOLS = {
    "set_reminder",
    "complete_reminder",
    "log_health_checkin",
    "flag_emotional_distress",
    "share_update_with_family",
}


# ── ADK tool wrappers — read user_id from session state ─────────────────────

async def analyze_medication(image_description: str, tool_context: ToolContext) -> dict:
    """Analyse a medication bottle or pill visible in the camera or described verbally."""
    user_id: str = tool_context.state.get("user_id", "")
    logger.info("TOOL CALLED: analyze_medication user=%s desc=%s", user_id, image_description[:80])
    result = await _analyze_medication(user_id, image_description)
    logger.info("TOOL RESULT: analyze_medication → %s", result.get("status"))
    return result


async def log_health_checkin(
    mood: str, pain_level: int, notes: str, tool_context: ToolContext
) -> dict:
    """Log the user's daily health check-in gathered during conversation."""
    user_id: str = tool_context.state.get("user_id", "")
    logger.info("TOOL CALLED: log_health_checkin user=%s mood=%s pain=%d", user_id, mood, pain_level)
    result = await _log_checkin(user_id, mood, pain_level, notes)
    logger.info("TOOL RESULT: log_health_checkin → %s", result.get("status"))
    return result


async def set_reminder(
    reminder_type: str, message: str, tool_context: ToolContext
) -> dict:
    """Set a reminder for the user."""
    user_id: str = tool_context.state.get("user_id", "")
    logger.info("TOOL CALLED: set_reminder user=%s type=%s msg=%s", user_id, reminder_type, message)
    result = await _set_reminder(user_id, reminder_type, message)
    logger.info("TOOL RESULT: set_reminder → %s", result.get("status"))
    return result


async def complete_reminder(
    keyword: str, tool_context: ToolContext
) -> dict:
    """Mark a reminder as completed when the user says they have done it.

    Pass a keyword that matches the reminder (e.g. 'medicine', 'water', 'walk').
    """
    user_id: str = tool_context.state.get("user_id", "")
    logger.info("TOOL CALLED: complete_reminder user=%s keyword=%s", user_id, keyword)
    from services.firestore_service import get_firestore_service

    try:
        fs = get_firestore_service()
        pending = await fs.get_reminders(user_id, status="pending")

        if not pending:
            logger.info("TOOL RESULT: complete_reminder → no pending reminders")
            return {"status": "ok"}

        keyword_lower = keyword.lower()
        matched = None
        for r in pending:
            if keyword_lower in r.message.lower() or keyword_lower in r.type.lower():
                matched = r
                break
        if not matched:
            matched = pending[0]

        result = await _complete_reminder(user_id, matched.reminder_id)
        logger.info("TOOL RESULT: complete_reminder → %s (id=%s)", result.get("status"), matched.reminder_id)
        return result
    except Exception as exc:
        logger.error("TOOL ERROR: complete_reminder → %s", exc)
        return {"status": "ok"}


async def call_for_help(tool_context: ToolContext) -> dict:
    """Trigger an emergency alert and notify the user's family immediately.

    Call this without hesitation whenever the user indicates they need help,
    have fallen, are in pain, or use any emergency phrase.
    """
    user_id: str = tool_context.state.get("user_id", "")
    logger.info("TOOL CALLED: call_for_help user=%s", user_id)
    result = await _call_for_help(user_id)
    logger.info("TOOL RESULT: call_for_help → %s", result.get("status"))
    return result


async def share_update_with_family(message: str, tool_context: ToolContext) -> dict:
    """Send a positive update or message to the user's family via notification."""
    user_id: str = tool_context.state.get("user_id", "")
    logger.info("TOOL CALLED: share_update_with_family user=%s msg=%s", user_id, message[:80])
    result = await _share_update_with_family(user_id, message)
    logger.info("TOOL RESULT: share_update_with_family → %s", result.get("status"))
    return result


# ── Agent definition ─────────────────────────────────────────────────────────
# NOTE: after_tool_callback does NOT fire in live/bidi mode (ADK issue #1897).
# Post-tool duplicate suppression is handled in companion_stream.py instead.

companion_agent = Agent(
    model=_COMPANION_MODEL,
    name="olaf_companion",
    description="OLAF — warm, patient AI companion for elderly users.",
    instruction=COMPANION_INSTRUCTION,
    tools=[
        analyze_medication,
        call_for_help,
        complete_reminder,
        log_health_checkin,
        set_reminder,
        share_update_with_family,
    ],
)
