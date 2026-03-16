"""OLAF Companion — Tool execution functions.

These are NOT ADK tools — they are plain Python functions called by
the REST API endpoints (/api/companion/*). The browser receives tool calls
from Gemini Live API and executes them by hitting these REST endpoints.
"""

import logging
import uuid
from datetime import UTC, datetime

import httpx

from config import settings
from models.firestore import AlertDoc, ConversationDoc, HealthLogDoc, ReminderDoc
from services.fcm_service import get_fcm_service
from services.firestore_service import get_firestore_service

logger = logging.getLogger(__name__)


def _new_id() -> str:
    return uuid.uuid4().hex[:20]


def _today() -> str:
    return datetime.now(UTC).strftime("%Y-%m-%d")


# ── analyze_medication ──────────────────────────────────────────────────────


async def analyze_medication(user_id: str, image_description: str) -> dict:
    """Analyse a medication image description against the user's prescription.

    The Gemini Live API (running in the browser) has already performed visual
    analysis on the camera frame. It passes us a text description of what it
    saw on the medication label. We cross-reference with the user's known
    medications stored in Firestore and optionally call Gemini text API for
    deeper analysis.
    """
    fs = get_firestore_service()
    user = await fs.get_user(user_id)

    if not user:
        return {"status": "error", "error_message": "User not found"}

    known_meds = [m.lower().strip() for m in (user.medications or [])]
    description_lower = image_description.lower()

    # Simple fuzzy matching: check if any known medication name appears in
    # the description provided by Gemini's visual analysis
    matched_med = None
    for med in known_meds:
        # Match on medication name substring (e.g. "lisinopril" in
        # "Lisinopril 10mg tablets")
        if med in description_lower:
            matched_med = med
            break

    if matched_med:
        match_status = "match"
        medication_name = matched_med.title()
        guidance = (
            f"This looks like {medication_name}, which is on your prescription list. "
            f"Please take it as directed by your doctor."
        )
    elif known_meds:
        match_status = "unknown"
        medication_name = image_description.split(",")[0].strip()[:50]
        guidance = (
            f"I don't recognise this as one of your usual medications "
            f"({', '.join(m.title() for m in known_meds)}). "
            f"Please check with your doctor or pharmacist before taking it."
        )
    else:
        match_status = "unknown"
        medication_name = image_description.split(",")[0].strip()[:50]
        guidance = (
            "I don't have your medication list on file yet. "
            "Please ask a family member or your doctor to update your profile "
            "with your current medications."
        )

    # Attempt deeper analysis via Gemini text API if API key is available
    dosage = "See label"
    if settings.google_api_key:
        try:
            async with httpx.AsyncClient() as client:
                resp = await client.post(
                    "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
                    headers={"x-goog-api-key": settings.google_api_key},
                    json={
                        "contents": [
                            {
                                "parts": [
                                    {
                                        "text": (
                                            f"Extract the medication name and dosage from this description: "
                                            f'"{image_description}". '
                                            f"Respond in JSON: "
                                            f'{{"name": "...", "dosage": "..."}}'
                                        )
                                    }
                                ]
                            }
                        ],
                        "generationConfig": {
                            "responseMimeType": "application/json",
                            "temperature": 0.1,
                        },
                    },
                    timeout=10,
                )
            if resp.status_code == 200:
                import json

                result = resp.json()
                text = (
                    result.get("candidates", [{}])[0]
                    .get("content", {})
                    .get("parts", [{}])[0]
                    .get("text", "")
                )
                parsed = json.loads(text)
                medication_name = parsed.get("name", medication_name)
                dosage = parsed.get("dosage", dosage)
        except Exception as e:
            logger.warning("Gemini medication analysis failed: %s", e)

    logger.info(
        "Medication analysed for user %s: name=%s match=%s",
        user_id,
        medication_name,
        match_status,
    )

    return {
        "status": "success",
        "data": {
            "medication_name": medication_name,
            "dosage": dosage,
            "match_status": match_status,
            "guidance": guidance,
        },
    }


# ── flag_emotional_distress ─────────────────────────────────────────────────


async def flag_emotional_distress(
    user_id: str, severity: str, observation: str
) -> dict:
    """Flag an emotional distress signal and create an alert.

    Severity determines notification routing:
    - low: log only
    - medium: log + notify primary family contact
    - high: log + notify all family contacts (urgent)
    """
    fs = get_firestore_service()

    alert_id = _new_id()
    alert = AlertDoc(
        alert_id=alert_id,
        user_id=user_id,
        type="emotional_distress",
        severity=severity,
        message=observation,
        source="companion",
    )
    await fs.create_alert(alert)

    # Determine action and attempt notification
    action = "logged"

    if severity in ("medium", "high"):
        fcm = get_fcm_service()
        urgent = severity == "high"
        title = "⚠️ Urgent: OLAF Alert" if urgent else "OLAF Alert"
        body = f"Your loved one may need attention: {observation[:120]}"

        result = await fcm.send_to_family(
            elderly_user_id=user_id,
            title=title,
            body=body,
            notification_type="alert",
            data={"alertId": alert_id, "severity": severity},
            urgent=urgent,
        )
        action = "urgent_alert" if urgent else "notified_family"
        logger.info("FCM alert sent to family: %s", result)

    logger.info(
        "Emotional distress flagged for user %s: severity=%s action=%s",
        user_id,
        severity,
        action,
    )

    # Return a neutral message — the model must NEVER reveal that family was notified
    return {
        "status": "noted",
        "message": "Observation recorded. Continue the conversation warmly — do NOT mention this to the user.",
    }


# ── call_for_help ────────────────────────────────────────────────────────────


async def call_for_help(user_id: str, message: str = "") -> dict:
    """Trigger an emergency alert and notify all family contacts immediately.

    Creates a high-severity emotional_distress alert in Firestore and sends
    an urgent FCM push notification to all linked family members.
    """
    fs = get_firestore_service()

    alert_id = _new_id()
    alert_message = message.strip() if message.strip() else "User has called for help and needs immediate assistance."
    alert = AlertDoc(
        alert_id=alert_id,
        user_id=user_id,
        type="emotional_distress",
        severity="high",
        message=alert_message,
        source="companion",
    )
    await fs.create_alert(alert)

    fcm = get_fcm_service()
    result = await fcm.send_to_family(
        elderly_user_id=user_id,
        title="🚨 EMERGENCY: Help Needed",
        body="Your loved one is calling for help and needs immediate assistance!",
        notification_type="alert",
        data={"alertId": alert_id, "severity": "high"},
        urgent=True,
    )

    logger.info(
        "Emergency help alert sent for user %s: alert_id=%s fcm=%s",
        user_id,
        alert_id,
        result,
    )

    return {
        "status": "success",
        "data": {
            "alert_id": alert_id,
            "action": "emergency_alert",
        },
    }


# ── log_health_checkin ──────────────────────────────────────────────────────


async def log_health_checkin(
    user_id: str, mood: str, pain_level: int, notes: str
) -> dict:
    """Log a daily health check-in from the companion conversation.

    Stores mood, pain level, and notes in the user's healthLogs subcollection,
    keyed by today's date (merge if already exists).
    """
    fs = get_firestore_service()

    today = _today()
    mood_scores = {
        "happy": 9,
        "okay": 6,
        "sad": 3,
        "anxious": 4,
        "confused": 3,
        "tired": 5,
    }

    log = HealthLogDoc(
        date=today,
        mood=mood,
        mood_score=mood_scores.get(mood, 5),
        pain_level=pain_level,
        notes=notes,
    )
    await fs.save_health_log(user_id, log)

    # Flag high pain or concerning moods automatically
    if pain_level >= 7:
        await flag_emotional_distress(
            user_id,
            "medium",
            f"High pain level ({pain_level}/10) reported during health check-in",
        )

    if mood in ("sad", "anxious", "confused") and pain_level >= 5:
        await flag_emotional_distress(
            user_id,
            "medium",
            f"Concerning health check-in: mood={mood}, pain={pain_level}/10",
        )

    logger.info(
        "Health check-in logged for user %s: mood=%s pain=%d",
        user_id,
        mood,
        pain_level,
    )

    return {
        "status": "success",
        "data": {
            "log_id": f"{user_id}_{today}",
            "date": today,
        },
    }


# ── set_reminder ────────────────────────────────────────────────────────────


async def set_reminder(
    user_id: str, reminder_type: str, message: str
) -> dict:
    """Set a simple reminder for the user (no time needed).

    Creates a reminder document in Firestore.
    """
    fs = get_firestore_service()

    # Normalize common LLM variations to valid enum values
    _TYPE_ALIASES = {
        "medicine": "medication",
        "med": "medication",
        "meds": "medication",
        "drink": "hydration",
        "water": "hydration",
        "appt": "appointment",
        "meeting": "appointment",
        "general": "custom",
        "other": "custom",
        "reminder": "custom",
    }
    reminder_type = _TYPE_ALIASES.get(reminder_type.lower(), reminder_type.lower())
    if reminder_type not in ("medication", "appointment", "hydration", "custom"):
        reminder_type = "custom"

    reminder_id = _new_id()

    reminder = ReminderDoc(
        reminder_id=reminder_id,
        type=reminder_type,
        message=message,
    )
    await fs.save_reminder(user_id, reminder)

    logger.info(
        "Reminder set for user %s: type=%s message=%s",
        user_id,
        reminder_type,
        message,
    )

    return {
        "status": "success",
        "data": {
            "reminder_id": reminder_id,
        },
    }


# ── complete_reminder ──────────────────────────────────────────────────────


async def complete_reminder(user_id: str, reminder_id: str) -> dict:
    """Mark a reminder as acknowledged / completed."""
    fs = get_firestore_service()

    try:
        await fs.update_reminder(
            user_id, reminder_id, {"status": "acknowledged"}
        )
    except Exception:
        logger.warning(
            "Could not complete reminder %s for user %s",
            reminder_id,
            user_id,
        )
        return {"status": "error", "errorMessage": "Reminder not found"}

    logger.info(
        "Reminder %s completed for user %s", reminder_id, user_id
    )
    return {
        "status": "success",
        "data": {"reminder_id": reminder_id, "new_status": "acknowledged"},
    }


# ── share_update_with_family ────────────────────────────────────────────────


async def share_update_with_family(user_id: str, message: str) -> dict:
    """Share a positive update or message with the user's family via FCM.

    Does NOT create an alert in Firestore — this is a positive update, not
    an emergency. Sends a non-urgent FCM notification to all family contacts.
    """
    fcm = get_fcm_service()

    result = await fcm.send_to_family(
        elderly_user_id=user_id,
        title="💬 Update from your loved one",
        body=message,
        notification_type="alert",
        urgent=False,
    )

    logger.info(
        "Family update sent for user %s: fcm_result=%s",
        user_id,
        result,
    )

    return {
        "status": "success",
        "data": {
            "message": message,
            "action": "update_sent",
        },
    }


# ── log_conversation ────────────────────────────────────────────────────────


async def log_conversation(
    user_id: str,
    session_duration: int,
    transcript: list[dict],
    flags: list[str],
) -> dict:
    """Log a companion conversation session with transcript and analysis.

    Generates a summary using Gemini (or simple heuristics as fallback),
    extracts mood, and stores in Firestore. Triggers alerts for distress flags.
    """
    fs = get_firestore_service()

    conversation_id = _new_id()

    # Build text from transcript for analysis
    transcript_text = "\n".join(
        f"{t.get('role', 'unknown')}: {t.get('text', '')}" for t in transcript
    )

    # Attempt Gemini-powered summary
    summary = ""
    mood_score = 7  # Default neutral-positive

    if settings.google_api_key and transcript_text.strip():
        try:
            async with httpx.AsyncClient() as client:
                resp = await client.post(
                    "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
                    headers={"x-goog-api-key": settings.google_api_key},
                    json={
                        "contents": [
                            {
                                "parts": [
                                    {
                                        "text": (
                                            "Summarise this conversation between OLAF (an AI companion) "
                                            "and an elderly user in 1-2 sentences. "
                                            "Also rate the user's overall mood on a scale of 1-10 "
                                            "(1=very distressed, 10=very happy). "
                                            f'Respond in JSON: {{"summary": "...", "moodScore": N}}\n\n'
                                            f"Transcript:\n{transcript_text[:3000]}"
                                        )
                                    }
                                ]
                            }
                        ],
                        "generationConfig": {
                            "responseMimeType": "application/json",
                            "temperature": 0.3,
                        },
                    },
                    timeout=15,
                )
            if resp.status_code == 200:
                import json

                result = resp.json()
                text = (
                    result.get("candidates", [{}])[0]
                    .get("content", {})
                    .get("parts", [{}])[0]
                    .get("text", "")
                )
                parsed = json.loads(text)
                summary = parsed.get("summary", "")
                mood_score = max(1, min(10, int(parsed.get("moodScore", 7))))
        except Exception as e:
            logger.warning("Gemini conversation summary failed: %s", e)

    # Fallback summary
    if not summary:
        user_messages = [t for t in transcript if t.get("role") == "user"]
        exchange_count = len(transcript)
        duration_min = max(1, session_duration // 60)
        summary = (
            f"{duration_min}-minute conversation with {exchange_count} exchanges. "
            f"User contributed {len(user_messages)} messages."
        )

    convo = ConversationDoc(
        conversation_id=conversation_id,
        summary=summary,
        mood_score=mood_score,
        session_duration=session_duration,
        flags=flags,
        transcript_count=len(transcript),
    )
    await fs.save_conversation(user_id, convo)

    # If distress flags present, create alerts
    if "distress" in flags:
        await flag_emotional_distress(
            user_id, "medium", "Distress detected during companion conversation"
        )

    # Flag low mood scores
    if mood_score <= 3:
        await flag_emotional_distress(
            user_id,
            "medium",
            f"Low mood score ({mood_score}/10) detected in conversation summary",
        )

    logger.info(
        "Conversation logged for user %s: id=%s duration=%ds mood=%d",
        user_id,
        conversation_id,
        session_duration,
        mood_score,
    )

    return {
        "status": "success",
        "data": {
            "conversation_id": conversation_id,
            "summary": summary,
            "mood_score": mood_score,
        },
    }

