"""OLAF — ADK Bidi-streaming companion WebSocket endpoint.

WSS /api/companion/stream — Real-time voice + vision companion via ADK runner.

Architecture (replaces browser-direct Gemini Live API):
  Browser WebSocket
      ↓ audio blobs / video frames / text
  LiveRequestQueue
      ↓
  runner.run_live()  ←→  Gemini Live API
      ↓ audio chunks / transcripts / tool calls
  Browser WebSocket

Two concurrent async tasks per connection:
  - upstream:   browser → LiveRequestQueue
  - downstream: runner events → browser

Messages browser → backend:
  {"type": "audio", "data": "<base64 PCM 16kHz>"}
  {"type": "video", "data": "<base64 JPEG>"}
  {"type": "text",  "data": "..."}
  {"type": "end"}

Messages backend → browser:
  {"type": "audio",         "data": "<base64 PCM>"}
  {"type": "transcript",    "role": "user"|"model", "text": "..."}
  {"type": "tool_call",     "name": "...", "args": {...}}
  {"type": "turn_complete"}
  {"type": "interrupted"}
  {"type": "error",         "message": "..."}
"""

import asyncio
import base64
import json
import logging
import os
import re
from datetime import UTC, datetime

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect
from firebase_admin import auth as firebase_auth
from google.adk.agents.live_request_queue import LiveRequestQueue
from google.adk.agents.run_config import RunConfig, StreamingMode
from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService
from google.genai import types

from config import settings
from olaf_agents.agents.companion import companion_agent
from services.firestore_service import get_firestore_service

# Ensure ADK reads the correct backend from env before Runner is created.
# ADK respects GOOGLE_GENAI_USE_VERTEXAI, GOOGLE_CLOUD_PROJECT, and
# GOOGLE_CLOUD_LOCATION set in the process environment.
if settings.google_genai_use_vertexai:
    os.environ.setdefault("GOOGLE_GENAI_USE_VERTEXAI", "true")
    os.environ.setdefault("GOOGLE_CLOUD_PROJECT", settings.google_cloud_project)
    os.environ.setdefault("GOOGLE_CLOUD_LOCATION", settings.google_cloud_location)
    _backend = f"Vertex AI ({settings.google_cloud_project}/{settings.google_cloud_location})"
else:
    os.environ.setdefault("GOOGLE_GENAI_USE_VERTEXAI", "false")
    _backend = "AI Studio"

logger = logging.getLogger(__name__)
logger.info("Companion stream using backend: %s", _backend)


def _normalize(text: str) -> str:
    """Strip punctuation, collapse whitespace, lowercase for comparison."""
    return re.sub(r"\s+", " ", re.sub(r"[^\w\s]", "", text)).lower().strip()


def _is_duplicate(text1: str, text2: str) -> bool:
    """Check if two transcripts are near-duplicates using prefix matching."""
    if not text1 or not text2:
        return False
    n1, n2 = _normalize(text1), _normalize(text2)
    # Compare first 40 chars — catches duplicates even when endings differ
    prefix = min(40, len(n1), len(n2))
    if prefix < 10:
        return False
    return n1[:prefix] == n2[:prefix]

router = APIRouter()

# ── App-level singletons (created once at import time) ───────────────────────

_session_service = InMemorySessionService()

_runner = Runner(
    agent=companion_agent,
    app_name="olaf_companion",
    session_service=_session_service,
)

# ── RunConfig — shared across all sessions ────────────────────────────────────

_run_config = RunConfig(
    response_modalities=["AUDIO"],
    streaming_mode=StreamingMode.BIDI,
    input_audio_transcription=types.AudioTranscriptionConfig(),
    output_audio_transcription=types.AudioTranscriptionConfig(),
)


# ── WebSocket endpoint ────────────────────────────────────────────────────────

@router.websocket("/stream")
async def companion_stream(
    websocket: WebSocket,
    token: str = Query(default=""),
) -> None:
    """ADK bidi-streaming WebSocket for the OLAF voice companion.

    Auth: pass Firebase ID token as ?token=<id_token> query parameter.
    """
    # ── Auth ────────────────────────────────────────────────────────────────
    if not token:
        await websocket.close(code=4001, reason="Missing auth token")
        return

    try:
        decoded = firebase_auth.verify_id_token(token)
        user_id: str = decoded["uid"]
    except Exception as auth_exc:
        logger.error("Firebase auth failed for companion stream: %s", auth_exc)
        await websocket.close(code=4001, reason="Invalid auth token")
        return

    await websocket.accept()
    logger.info("Companion stream connected: user=%s", user_id)

    # ── Fetch memory bank — inject into session state for instruction ────────
    try:
        fs = get_firestore_service()
        memories, _ = await fs.list_memories(user_id, limit=5)
        if memories:
            lines = [
                f"- {m.title}: {(m.raw_transcript or m.narrative_text or m.snippet)[:800]}"
                for m in memories
            ]
            memory_bank = (
                "Things you know about this user from past conversations:\n"
                + "\n".join(lines)
            )
            logger.info("Memory bank loaded: %d memories for user=%s", len(memories), user_id)
        else:
            memory_bank = "No stored memories yet — this may be one of your first conversations."
            logger.info("Memory bank: no memories found for user=%s", user_id)
    except Exception as exc:
        logger.warning("Could not fetch memories for user %s: %s", user_id, exc)
        memory_bank = ""

    # ── Build daily briefing — time-of-day + pending reminders ───────────────
    try:
        import zoneinfo

        now_utc = datetime.now(UTC)

        # Use user's stored timezone if available, else fall back to UTC
        user_tz_str = "UTC"
        try:
            user_profile = await fs.get_user(user_id)
            if user_profile and user_profile.timezone:
                user_tz_str = user_profile.timezone
        except Exception:
            pass

        try:
            user_tz = zoneinfo.ZoneInfo(user_tz_str)
            now_local = now_utc.astimezone(user_tz)
        except Exception:
            now_local = now_utc

        hour = now_local.hour
        day_name = now_local.strftime("%A")

        if 5 <= hour < 12:
            time_of_day = "morning"
        elif 12 <= hour < 17:
            time_of_day = "afternoon"
        elif 17 <= hour < 21:
            time_of_day = "evening"
        else:
            time_of_day = "night"

        time_label = f"{day_name} {time_of_day}, {now_local.strftime('%I:%M %p').lstrip('0')}"

        try:
            pending_reminders = await fs.get_reminders(user_id, status="pending")
            if pending_reminders:
                reminder_parts = [
                    f"{r.message} (id: {r.reminder_id})"
                    for r in pending_reminders
                ]
                reminders_line = "Pending reminders: " + ", ".join(reminder_parts)
            else:
                reminders_line = "No pending reminders."
        except Exception as exc:
            logger.error("Could not fetch reminders for user %s: %s", user_id, exc, exc_info=True)
            reminders_line = "No pending reminders."

        daily_briefing = f"Current time: {time_label}\n{reminders_line}"
        logger.info("Daily briefing built for user=%s: %s", user_id, daily_briefing)
    except Exception as exc:
        logger.warning("Could not build daily briefing for user %s: %s", user_id, exc)
        daily_briefing = ""

    # ── ADK session — store user_id, memory_bank, and daily_briefing in state ─
    session = await _session_service.create_session(
        app_name="olaf_companion",
        user_id=user_id,
        state={"user_id": user_id, "memory_bank": memory_bank, "daily_briefing": daily_briefing},
    )

    live_request_queue = LiveRequestQueue()

    # ── Upstream task: browser → LiveRequestQueue ────────────────────────────
    async def upstream() -> None:
        try:
            while True:
                raw = await websocket.receive_text()
                msg: dict = json.loads(raw)
                msg_type = msg.get("type")

                if msg_type == "audio":
                    live_request_queue.send_realtime(
                        types.Blob(
                            data=base64.b64decode(msg["data"]),
                            mime_type="audio/pcm;rate=16000",
                        )
                    )

                elif msg_type == "video":
                    live_request_queue.send_realtime(
                        types.Blob(
                            data=base64.b64decode(msg["data"]),
                            mime_type="image/jpeg",
                        )
                    )

                elif msg_type == "text":
                    live_request_queue.send_content(
                        types.Content(
                            role="user",
                            parts=[types.Part(text=msg.get("data", ""))],
                        )
                    )

                elif msg_type == "end":
                    live_request_queue.close()
                    break

        except WebSocketDisconnect:
            live_request_queue.close()
        except Exception as exc:
            logger.error("Upstream error for user %s: %s", user_id, exc)
            live_request_queue.close()

    # ── Downstream task: runner events → browser ─────────────────────────────
    async def downstream() -> None:
        logger.info("Downstream starting for user=%s model=%s", user_id, companion_agent.model)

        # NOTE: In bidi/live mode, ADK handles tool calls internally.
        # function_call and function_response events are NOT yielded to our code.
        # The model sometimes repeats itself (before/after tool calls).
        # We detect duplicates via both partial and finished transcripts and
        # suppress audio + text for the repeat.

        last_finished_text = ""   # last completed model transcript
        suppressing = False       # True when duplicate detected

        try:
            async for event in _runner.run_live(
                user_id=user_id,
                session_id=session.id,
                live_request_queue=live_request_queue,
                run_config=_run_config,
            ):
                # ── Check output transcription FIRST (before forwarding audio)
                if getattr(event, "output_transcription", None):
                    t = event.output_transcription
                    text = (getattr(t, "text", "") or "").strip()

                    if getattr(t, "finished", False) and text:
                        if _is_duplicate(text, last_finished_text):
                            if not suppressing:
                                suppressing = True
                                await websocket.send_json({"type": "clear_audio"})
                                logger.info(
                                    "Duplicate finished, suppressing for user=%s: %s",
                                    user_id, text[:60],
                                )
                            # Skip this transcript
                        else:
                            suppressing = False
                            last_finished_text = text
                            await websocket.send_json({
                                "type": "transcript",
                                "role": "model",
                                "text": text,
                                "partial": False,
                            })
                    elif text and not suppressing:
                        # Partial transcript: check if it looks like a repeat
                        norm_partial = _normalize(text)
                        norm_last = _normalize(last_finished_text)
                        if (
                            norm_last
                            and len(norm_partial) >= 30
                            and norm_last.startswith(norm_partial)
                        ):
                            # Early duplicate detection from partial
                            suppressing = True
                            await websocket.send_json({"type": "clear_audio"})
                            logger.info(
                                "Duplicate partial detected for user=%s: %s",
                                user_id, text[:40],
                            )
                        else:
                            await websocket.send_json({
                                "type": "transcript",
                                "role": "model",
                                "text": text,
                                "partial": True,
                            })

                # ── Forward audio chunks (skip if suppressing) ────────────────
                if event.content and event.content.parts:
                    for part in event.content.parts:
                        if getattr(part, "inline_data", None) and not suppressing:
                            await websocket.send_json({
                                "type": "audio",
                                "data": base64.b64encode(
                                    part.inline_data.data
                                ).decode(),
                            })

                # ── User speech transcription: always forward, reset ──────────
                if getattr(event, "input_transcription", None):
                    t = event.input_transcription
                    if getattr(t, "text", None) and getattr(t, "finished", False):
                        suppressing = False
                        last_finished_text = ""
                        await websocket.send_json({
                            "type": "transcript",
                            "role": "user",
                            "text": t.text,
                        })

                # Turn complete — reset suppression so next turn works
                if getattr(event, "turn_complete", False):
                    suppressing = False
                    last_finished_text = ""
                    await websocket.send_json({"type": "turn_complete"})

                # Interruption (user barged in)
                if getattr(event, "interrupted", False):
                    suppressing = False
                    last_finished_text = ""
                    await websocket.send_json({"type": "interrupted"})

        except WebSocketDisconnect:
            pass
        except Exception as exc:
            # ADK raises APIError(1000) on normal WebSocket close — ignore it
            if "1000" in str(exc):
                logger.info("Live session ended normally for user %s", user_id)
            else:
                logger.error("Downstream error for user %s: %s", user_id, exc)
                try:
                    await websocket.send_json({"type": "error", "message": str(exc)})
                except Exception:
                    pass

    # ── Greeting trigger ─────────────────────────────────────────────────────
    async def send_greeting() -> None:
        # Wait for Gemini live connection (~1s) + mic audio to prime audio mode.
        # Mic audio blobs flow immediately from the browser; they reach Gemini
        # once the live connection is established. We need audio to be flowing
        # BEFORE sending the text trigger so Gemini responds in audio, not text.
        await asyncio.sleep(2)
        logger.info("Sending __START_SESSION__ trigger for user=%s", user_id)
        live_request_queue.send_content(
            types.Content(
                role="user",
                parts=[types.Part(text="__START_SESSION__")],
            )
        )
        # Signal frontend that OLAF is ready — transitions UI from "connecting"
        try:
            await websocket.send_json({"type": "ready"})
        except Exception:
            pass

    # ── Run all tasks concurrently ─────────────────────────────────────────────
    try:
        await asyncio.gather(upstream(), downstream(), send_greeting())
    finally:
        logger.info("Companion stream disconnected: user=%s", user_id)
        try:
            await websocket.close()
        except Exception:
            pass
