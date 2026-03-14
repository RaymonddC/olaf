"""OLAF — Companion tool execution endpoints.

These endpoints are called from the browser when Gemini Live API issues
function calls. The browser receives the tool call, executes it by calling
these REST endpoints, then sends the result back to Gemini.
"""

import logging

from fastapi import APIRouter, Depends

from api.middleware.firebase_auth import get_current_user
from models.api import (
    AnalyzeMedicationRequest,
    ApiResponse,
    FlagDistressRequest,
    HealthCheckinRequest,
    LogConversationRequest,
    SetReminderRequest,
)
from olaf_agents.tools.companion_tools import (
    analyze_medication,
    flag_emotional_distress,
    log_conversation,
    log_health_checkin,
    set_reminder,
)

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/analyze-medication")
async def analyze_medication_endpoint(
    req: AnalyzeMedicationRequest,
    user: dict = Depends(get_current_user),
) -> ApiResponse:
    """Analyse a medication image/description against the user's prescription."""
    result = await analyze_medication(
        user_id=req.user_id,
        image_description=req.args.image_description,
    )
    return ApiResponse(status=result["status"], data=result.get("data"))


@router.post("/flag-emotional-distress")
async def flag_emotional_distress_endpoint(
    req: FlagDistressRequest,
    user: dict = Depends(get_current_user),
) -> ApiResponse:
    """Flag an emotional distress signal and route notification."""
    result = await flag_emotional_distress(
        user_id=req.user_id,
        severity=req.args.severity,
        observation=req.args.observation,
    )
    return ApiResponse(status=result["status"], data=result.get("data"))


@router.post("/log-health-checkin")
async def log_health_checkin_endpoint(
    req: HealthCheckinRequest,
    user: dict = Depends(get_current_user),
) -> ApiResponse:
    """Log a daily health check-in from the companion conversation."""
    result = await log_health_checkin(
        user_id=req.user_id,
        mood=req.args.mood,
        pain_level=req.args.pain_level,
        notes=req.args.notes,
    )
    return ApiResponse(status=result["status"], data=result.get("data"))


@router.post("/set-reminder")
async def set_reminder_endpoint(
    req: SetReminderRequest,
    user: dict = Depends(get_current_user),
) -> ApiResponse:
    """Set a reminder for the user."""
    result = await set_reminder(
        user_id=req.user_id,
        reminder_type=req.args.reminder_type,
        message=req.args.message,
        time_str=req.args.time,
    )
    return ApiResponse(status=result["status"], data=result.get("data"))


@router.post("/log-conversation")
async def log_conversation_endpoint(
    req: LogConversationRequest,
    user: dict = Depends(get_current_user),
) -> ApiResponse:
    """Log a companion conversation session with transcript and analysis."""
    result = await log_conversation(
        user_id=req.user_id,
        session_duration=req.session_duration,
        transcript=[t.model_dump() for t in req.transcript],
        flags=req.flags,
    )
    return ApiResponse(status=result["status"], data=result.get("data"))
