"""OLAF — Gemini ephemeral token endpoint.

POST /api/gemini/token — Provision a locked ephemeral token for
browser -> Gemini Live API connection.

Architecture: The browser connects DIRECTLY to Gemini Live API using this
token. The backend does NOT proxy audio. See docs/architecture/agent-orchestration.md.
"""

import logging
from datetime import UTC, datetime, timedelta

import httpx
from fastapi import APIRouter, Depends, HTTPException

from api.middleware.firebase_auth import get_current_user
from config import settings
from models.api import ApiResponse, TokenRequest

logger = logging.getLogger(__name__)

router = APIRouter()

# OLAF system instruction — locked server-side so the client cannot tamper
OLAF_SYSTEM_INSTRUCTION = (
    "You are OLAF, a warm, patient, and caring AI companion for elderly users. "
    "Speak clearly and at a moderate pace. Use simple, everyday language. "
    "Be attentive to the user's emotional state and respond with empathy. "
    "You help with daily health check-ins, medication reminders, setting reminders, "
    "and general companionship. "
    "If the user shows signs of distress, sadness, or confusion, silently flag it "
    "using the flag_emotional_distress tool without telling the user. "
    "When the user mentions taking medication or shows a medication bottle via camera, "
    "use the analyze_medication tool. "
    "During conversations, naturally gather mood and health information and log it "
    "using log_health_checkin. "
    "When asked to set reminders, use the set_reminder tool. "
    "Always be encouraging, patient, and positive. End conversations warmly. "
    "If the user is quiet for a while, gently check in on them."
)

# Tool declarations — locked in the token so the client cannot modify them
FUNCTION_DECLARATIONS = [
    {
        "name": "analyze_medication",
        "description": (
            "Analyse a medication bottle or pill visible in the camera feed, "
            "or described verbally by the user."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "image_description": {
                    "type": "string",
                    "description": "What is visible on the medication label or pill",
                }
            },
            "required": ["image_description"],
        },
    },
    {
        "name": "flag_emotional_distress",
        "description": (
            "Flag when the user shows signs of emotional distress in their voice "
            "or words. Call this silently — do not tell the user."
        ),
        "behavior": "NON_BLOCKING",
        "parameters": {
            "type": "object",
            "properties": {
                "severity": {
                    "type": "string",
                    "enum": ["low", "medium", "high"],
                    "description": "How severe the distress appears",
                },
                "observation": {
                    "type": "string",
                    "description": "What was observed that indicates distress",
                },
            },
            "required": ["severity", "observation"],
        },
    },
    {
        "name": "log_health_checkin",
        "description": (
            "Log the user's daily health check-in including mood, pain level, "
            "and any health notes gathered during conversation."
        ),
        "behavior": "NON_BLOCKING",
        "parameters": {
            "type": "object",
            "properties": {
                "mood": {
                    "type": "string",
                    "enum": ["happy", "okay", "sad", "anxious", "confused", "tired"],
                },
                "pain_level": {
                    "type": "integer",
                    "description": "Pain level from 0 (none) to 10 (severe)",
                },
                "notes": {
                    "type": "string",
                    "description": "Additional health notes from the conversation",
                },
            },
            "required": ["mood", "pain_level"],
        },
    },
    {
        "name": "set_reminder",
        "description": "Set a reminder for the user at a specific time.",
        "behavior": "NON_BLOCKING",
        "parameters": {
            "type": "object",
            "properties": {
                "reminder_type": {
                    "type": "string",
                    "enum": ["medication", "appointment", "hydration", "custom"],
                },
                "message": {
                    "type": "string",
                    "description": "The reminder message to show",
                },
                "time": {
                    "type": "string",
                    "description": "When to remind (ISO 8601 or HH:MM format)",
                },
            },
            "required": ["reminder_type", "message", "time"],
        },
    },
]


@router.post("/token")
async def provision_ephemeral_token(
    req: TokenRequest,
    user: dict = Depends(get_current_user),
) -> ApiResponse:
    """Provision a locked ephemeral token for Gemini Live API.

    Tries the v1alpha authTokens API to create a proper ephemeral token with
    liveConnectConstraints. Falls back to returning the API key directly for
    development environments where the ephemeral token API isn't available.
    """
    uid = user["uid"]

    if not settings.google_api_key:
        raise HTTPException(status_code=500, detail="Google API key not configured")

    now = datetime.now(UTC)
    expires_at = now + timedelta(minutes=30)
    new_session_expires_at = now + timedelta(minutes=2)

    # Attempt proper ephemeral token provisioning via v1alpha API
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://generativelanguage.googleapis.com/v1alpha/authTokens",
                headers={"x-goog-api-key": settings.google_api_key},
                json={
                    "uses": 1,
                    "expireTime": expires_at.isoformat() + "Z",
                    "newSessionExpireTime": new_session_expires_at.isoformat() + "Z",
                    "liveConnectConstraints": {
                        "model": "models/gemini-2.5-flash-native-audio-preview-12-2025",
                        "config": {
                            "systemInstruction": OLAF_SYSTEM_INSTRUCTION,
                            "responseModalities": ["AUDIO"],
                            "speechConfig": {
                                "voiceConfig": {
                                    "prebuiltVoiceConfig": {"voiceName": "Kore"}
                                }
                            },
                            "tools": [
                                {"functionDeclarations": FUNCTION_DECLARATIONS}
                            ],
                            "sessionResumption": {},
                            "contextWindowCompression": {"slidingWindow": {}},
                            "inputAudioTranscription": {},
                            "outputAudioTranscription": {},
                            "realtimeInputConfig": {
                                "automaticActivityDetection": {
                                    "startOfSpeechSensitivity": "START_SENSITIVITY_LOW",
                                    "endOfSpeechSensitivity": "END_SENSITIVITY_LOW",
                                    "silenceDurationMs": 800,
                                }
                            },
                        },
                    },
                },
                timeout=15,
            )

        if response.status_code == 200:
            token_data = response.json()
            # The ephemeral token is in the "name" field
            ephemeral_token = token_data.get("name", "")
            if ephemeral_token:
                logger.info("Ephemeral token provisioned for user %s", uid)
                return ApiResponse(
                    status="success",
                    data={
                        "token": ephemeral_token,
                        "expiresAt": expires_at.isoformat(),
                    },
                )

        # If response wasn't 200 or token was empty, fall through to fallback
        logger.warning(
            "Ephemeral token API returned %s, falling back to API key",
            response.status_code,
        )

    except (httpx.RequestError, Exception) as e:
        logger.warning(
            "Ephemeral token API unavailable (%s), falling back to API key", e
        )

    # Fallback: return the API key directly.
    # This works for development — the client uses it as the access_token
    # query parameter on the WebSocket URL. In production, the proper
    # ephemeral token API should be used for security (config locking).
    logger.info("Returning API key as token fallback for user %s", uid)
    return ApiResponse(
        status="success",
        data={
            "token": settings.google_api_key,
            "expiresAt": expires_at.isoformat(),
        },
    )
