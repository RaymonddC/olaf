"""OLAF Companion Agent for ADK Bidi-streaming.

This agent runs server-side through ADK's runner.run_live(), replacing the
browser-direct Gemini Live API connection. Tools are executed server-side
with user_id read from ADK session state.

Model: gemini-2.0-flash-live-001 — the stable production Live API model.
"""

from google.adk.agents import Agent
from google.adk.tools.tool_context import ToolContext

from olaf_agents.instructions.companion import COMPANION_INSTRUCTION
from olaf_agents.tools.companion_tools import (
    analyze_medication as _analyze_medication,
    flag_emotional_distress as _flag_distress,
    log_health_checkin as _log_checkin,
    set_reminder as _set_reminder,
)

_COMPANION_MODEL = "gemini-2.5-flash-native-audio-latest"


# ── ADK tool wrappers — read user_id from session state ─────────────────────

async def analyze_medication(image_description: str, tool_context: ToolContext) -> dict:
    """Analyse a medication bottle or pill visible in the camera or described verbally."""
    user_id: str = tool_context.state.get("user_id", "")
    return await _analyze_medication(user_id, image_description)


_SEVERITY_MAP = {"moderate": "medium", "severe": "high", "mild": "low", "none": "low"}


async def flag_emotional_distress(
    severity: str, observation: str, tool_context: ToolContext
) -> dict:
    """Flag emotional distress silently — do not tell the user.

    severity must be one of: low, medium, high.
    """
    user_id: str = tool_context.state.get("user_id", "")
    normalized = _SEVERITY_MAP.get(severity.lower(), severity.lower())
    if normalized not in ("low", "medium", "high"):
        normalized = "medium"
    return await _flag_distress(user_id, normalized, observation)


async def log_health_checkin(
    mood: str, pain_level: int, notes: str, tool_context: ToolContext
) -> dict:
    """Log the user's daily health check-in gathered during conversation."""
    user_id: str = tool_context.state.get("user_id", "")
    return await _log_checkin(user_id, mood, pain_level, notes)


async def set_reminder(
    reminder_type: str, message: str, time: str, tool_context: ToolContext
) -> dict:
    """Set a reminder for the user at a specific time."""
    user_id: str = tool_context.state.get("user_id", "")
    return await _set_reminder(user_id, reminder_type, message, time)


# ── Agent definition ─────────────────────────────────────────────────────────

companion_agent = Agent(
    model=_COMPANION_MODEL,
    name="olaf_companion",
    description="OLAF — warm, patient AI companion for elderly users.",
    instruction=COMPANION_INSTRUCTION,
    tools=[],  # TODO: re-add once tool support in live mode is confirmed
)
