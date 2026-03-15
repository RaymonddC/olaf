"""OLAF — Storyteller API endpoints.

POST /api/storyteller/create-memory — Trigger memory chapter creation
POST /api/storyteller/create-daily-narrative — Trigger daily health narrative
POST /api/storyteller/create-weekly-report — Trigger weekly family report
GET  /api/storyteller/memories — List memory chapters
GET  /api/storyteller/memories/{memoryId} — Get single memory chapter
"""

import logging
import uuid

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, status
from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService
from google.genai import types

from api.middleware.firebase_auth import get_current_user
from config import settings
from models.api import (
    ApiResponse,
    CreateDailyNarrativeRequest,
    CreateMemoryRequest,
    CreateWeeklyReportRequest,
    MemoryChapter,
    MemoryListItem,
)
from olaf_agents.agents.storyteller import storyteller_agent
from services.firestore_service import FirestoreService, get_firestore_service

logger = logging.getLogger(__name__)

router = APIRouter()

# Shared session service for storyteller agent invocations
_session_service = InMemorySessionService()


async def _create_memory_direct(
    user_id: str,
    transcript: str,
    title_hint: str,
    task_id: str,
) -> None:
    """Create a memory chapter directly via Gemini REST API (no ADK agent).

    More reliable than the agent pipeline � generates narrative and saves
    to Firestore without depending on tool-calling behaviour.
    """
    import json

    import httpx

    from models.firestore import MemoryChapterDoc
    from services.firestore_service import get_firestore_service

    logger.info("Memory task %s: generating narrative for user %s", task_id, user_id)

    narrative_text = ""
    title = title_hint or "A Memory"
    tags: list[str] = []

    if settings.google_api_key and transcript.strip():
        prompt = (
            "You are writing a personal journal entry for an elderly person based on their "
            "conversation with their AI companion OLAF.\n\n"
            "TRANSCRIPT:\n"
            f"{transcript[:4000]}\n\n"
            "Write this as a simple, natural autobiography entry — like the person is writing "
            "about their own day in their own words. Keep it in first person.\n"
            "- Write 2-4 short paragraphs, simple and heartfelt\n"
            "- Focus on what actually happened: who they talked to, what they did, "
            "how they felt, what mattered to them\n"
            "- Keep it grounded and real — no flowery storytelling or dramatic language\n"
            "- It should read like a diary entry, not a story being told to someone\n"
            "- Include the small meaningful details: a meal they enjoyed, a memory that "
            "came up, a worry they shared, a moment that made them smile\n"
            "- The title should be simple and personal, like 'A Quiet Tuesday Morning' "
            "or 'Thinking About the Garden'\n\n"
            "Respond ONLY with JSON in this format:\n"
            '{{"title": "...", "narrative": "...", "tags": ["tag1", "tag2"]}}'
        )
        try:
            async with httpx.AsyncClient() as client:
                resp = await client.post(
                    "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
                    headers={"x-goog-api-key": settings.google_api_key},
                    json={
                        "contents": [{"parts": [{"text": prompt}]}],
                        "generationConfig": {
                            "responseMimeType": "application/json",
                            "temperature": 0.7,
                        },
                    },
                    timeout=30,
                )
            if resp.status_code == 200:
                result = resp.json()
                text = (
                    result.get("candidates", [{}])[0]
                    .get("content", {})
                    .get("parts", [{}])[0]
                    .get("text", "")
                )
                parsed = json.loads(text)
                title = parsed.get("title", title)
                narrative_text = parsed.get("narrative", "")
                tags = parsed.get("tags", [])
                logger.info("Memory task %s: narrative generated (%d chars)", task_id, len(narrative_text))
            else:
                logger.warning("Memory task %s: Gemini returned %s", task_id, resp.status_code)
        except Exception as e:
            logger.warning("Memory task %s: Gemini narrative failed: %s", task_id, e)

    # Fallback: use raw transcript as narrative
    if not narrative_text:
        narrative_text = transcript
        logger.info("Memory task %s: using raw transcript as narrative fallback", task_id)

    illustration_urls: list[str] = []

    # ── Generate scene illustration via gemini-2.5-flash-image ──────────────
    if narrative_text and narrative_text != transcript:
        try:
            # Ask Gemini for a focused scene prompt based on the narrative
            scene_prompt_text = ""
            if settings.google_api_key:
                scene_req_prompt = (
                    "Based on this personal journal entry from an elderly person, describe "
                    "a specific scene from their actual day (1-2 sentences) suitable as an "
                    "image generation prompt. Pick a real moment they described — a place "
                    "they visited, something they did, a person they saw, a meal they had. "
                    "Make it specific to THEIR day, not generic. "
                    "Do NOT include any text, words, or letters in the scene. "
                    "Respond with ONLY the scene description, nothing else.\n\n"
                    f"JOURNAL ENTRY:\n{narrative_text[:2000]}"
                )
                try:
                    async with httpx.AsyncClient() as client:
                        scene_resp = await client.post(
                            "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
                            headers={"x-goog-api-key": settings.google_api_key},
                            json={
                                "contents": [{"parts": [{"text": scene_req_prompt}]}],
                                "generationConfig": {"temperature": 0.8, "maxOutputTokens": 200},
                            },
                            timeout=15,
                        )
                    if scene_resp.status_code == 200:
                        scene_result = scene_resp.json()
                        scene_prompt_text = (
                            scene_result.get("candidates", [{}])[0]
                            .get("content", {})
                            .get("parts", [{}])[0]
                            .get("text", "")
                        ).strip()
                        logger.info("Memory task %s: scene prompt generated: %s", task_id, scene_prompt_text[:100])
                except Exception as e:
                    logger.warning("Memory task %s: scene prompt generation failed: %s", task_id, e)

            # Fallback scene prompt from title + first paragraph
            if not scene_prompt_text:
                scene_prompt_text = f"An elderly person's memory: {title}. {narrative_text[:300]}"

            # Generate scene illustration via gemini-2.5-flash-image
            from services.imagen_service import ImageGenerationError, get_imagen_service
            imagen = get_imagen_service()
            try:
                url = await imagen.generate_nano_banana_recap(
                    narrative=scene_prompt_text,
                    user_id=user_id,
                )
                illustration_urls.append(url)
                logger.info("Memory task %s: scene illustration generated: %s", task_id, url)
            except ImageGenerationError as e:
                logger.warning("Memory task %s: scene illustration failed: %s", task_id, e)
            except Exception as e:
                logger.warning("Memory task %s: scene illustration unexpected error: %s", task_id, e)

        except Exception as e:
            logger.warning("Memory task %s: illustration pipeline failed: %s", task_id, e)

    memory_id = uuid.uuid4().hex[:20]
    snippet = narrative_text[:200].rstrip()

    memory = MemoryChapterDoc(
        memory_id=memory_id,
        title=title,
        narrative_text=narrative_text,
        raw_transcript=transcript,
        snippet=snippet,
        tags=tags,
        illustration_urls=illustration_urls,
        status="complete",
    )

    try:
        fs = get_firestore_service()
        await fs.save_memory(user_id, memory)
        logger.info(
            "Memory task %s: saved memory %s for user %s (illustrations: %d)",
            task_id, memory_id, user_id, len(illustration_urls),
        )
    except Exception:
        logger.exception("Memory task %s: failed to save memory for user %s", task_id, user_id)


async def _run_storyteller(
    user_id: str,
    message_text: str,
    task_id: str,
) -> None:
    """Run the storyteller agent for daily/weekly reports."""
    runner = Runner(
        agent=storyteller_agent,
        app_name="olaf",
        session_service=_session_service,
    )
    session_id = f"storyteller-{task_id}"
    await _session_service.create_session(
        app_name="olaf",
        user_id=user_id,
        session_id=session_id,
        state={"user:user_id": user_id},
    )
    content = types.Content(role="user", parts=[types.Part(text=message_text)])
    try:
        async for event in runner.run_async(
            user_id=user_id, session_id=session_id, new_message=content
        ):
            if event.is_final_response():
                logger.info("Storyteller task %s completed for user %s", task_id, user_id)
    except Exception:
        logger.exception("Storyteller task %s failed for user %s", task_id, user_id)


@router.post("/create-memory", status_code=status.HTTP_202_ACCEPTED)
async def create_memory(
    req: CreateMemoryRequest,
    background_tasks: BackgroundTasks,
    user: dict = Depends(get_current_user),
) -> ApiResponse:
    """Trigger memory chapter creation from a conversation transcript.

    This is an async operation — returns a task ID immediately.
    The StorytellerAgent processes the transcript in the background.
    """
    task_id = uuid.uuid4().hex[:16]

    message = (
        f"Create a memory chapter from this conversation transcript:\n\n"
        f"{req.transcript}"
    )
    if req.title:
        message = f"Title suggestion: {req.title}\n\n{message}"

    background_tasks.add_task(
        _create_memory_direct,
        req.user_id,
        req.transcript,
        req.title or "",
        task_id,
    )

    logger.info("Memory creation task %s started for user %s", task_id, req.user_id)

    return ApiResponse(
        status="accepted",
        data={
            "taskId": task_id,
            "message": "Memory chapter creation started",
        },
    )


@router.post("/create-daily-narrative", status_code=status.HTTP_202_ACCEPTED)
async def create_daily_narrative(
    req: CreateDailyNarrativeRequest,
    background_tasks: BackgroundTasks,
    user: dict = Depends(get_current_user),
) -> ApiResponse:
    """Trigger daily health narrative generation.

    Typically called by Cloud Scheduler cron job.
    """
    task_id = uuid.uuid4().hex[:16]

    message = (
        f"Generate a daily health narrative for date {req.date}. "
        f"Retrieve the health logs and conversation summaries for this date, "
        f"then write a warm daily summary and save it."
    )

    background_tasks.add_task(_run_storyteller, req.user_id, message, task_id)

    logger.info("Daily narrative task %s for user %s date %s", task_id, req.user_id, req.date)

    return ApiResponse(
        status="accepted",
        data={"taskId": task_id},
    )


@router.post("/create-weekly-report", status_code=status.HTTP_202_ACCEPTED)
async def create_weekly_report(
    req: CreateWeeklyReportRequest,
    background_tasks: BackgroundTasks,
    user: dict = Depends(get_current_user),
) -> ApiResponse:
    """Trigger weekly family report generation."""
    task_id = uuid.uuid4().hex[:16]

    message = (
        f"Generate a weekly family report starting from {req.week_start}. "
        f"Retrieve the full week's health logs, conversations, and any new memories. "
        f"Write a comprehensive report with trends, concerns, and highlights, "
        f"then save it."
    )

    background_tasks.add_task(_run_storyteller, req.user_id, message, task_id)

    logger.info("Weekly report task %s for user %s week %s", task_id, req.user_id, req.week_start)

    return ApiResponse(
        status="accepted",
        data={"taskId": task_id},
    )


@router.get("/memories")
async def list_memories(
    user: dict = Depends(get_current_user),
    fs: FirestoreService = Depends(get_firestore_service),
    user_id: str = Query(..., alias="userId"),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
) -> ApiResponse:
    """List memory chapters for a user."""
    memories, total = await fs.list_memories(user_id, limit=limit, offset=offset)

    items = [
        MemoryListItem(
            id=m.memory_id,
            title=m.title,
            created_at=m.created_at,
            illustration_urls=m.illustration_urls,
            snippet=m.snippet,
        ).model_dump(by_alias=True)
        for m in memories
    ]

    return ApiResponse(
        status="success",
        data={
            "memories": items,
            "total": total,
            "hasMore": (offset + limit) < total,
        },
    )


@router.get("/memories/{memory_id}")
async def get_memory(
    memory_id: str,
    user: dict = Depends(get_current_user),
    fs: FirestoreService = Depends(get_firestore_service),
    user_id: str = Query(..., alias="userId"),
) -> ApiResponse:
    """Get a single memory chapter with full content."""
    memory = await fs.get_memory(user_id, memory_id)
    if not memory:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Memory chapter not found",
        )

    chapter = MemoryChapter(
        id=memory.memory_id,
        title=memory.title,
        narrative_text=memory.narrative_text,
        raw_transcript=memory.raw_transcript,
        illustration_urls=memory.illustration_urls,
        audio_script=memory.audio_script,
        tags=memory.tags,
        created_at=memory.created_at,
    )

    return ApiResponse(
        status="success",
        data=chapter.model_dump(by_alias=True),
    )


@router.post("/debug-save-memory")
async def debug_save_memory(
    user: dict = Depends(get_current_user),
    fs: FirestoreService = Depends(get_firestore_service),
    user_id: str = Query(..., alias="userId"),
) -> ApiResponse:
    """Debug: directly save a test memory to Firestore, bypassing the agent."""
    import uuid

    from models.firestore import MemoryChapterDoc

    memory_id = uuid.uuid4().hex[:20]
    memory = MemoryChapterDoc(
        memory_id=memory_id,
        title="Test Memory",
        narrative_text="This is a test memory to verify Firestore is working.",
        snippet="This is a test memory to verify Firestore is working.",
        tags=["test"],
        status="complete",
    )
    try:
        await fs.save_memory(user_id, memory)
        logger.info("DEBUG: saved test memory %s for user %s", memory_id, user_id)
        return ApiResponse(status="success", data={"memory_id": memory_id})
    except Exception as e:
        logger.exception("DEBUG: failed to save test memory for user %s", user_id)
        return ApiResponse(status="error", data={"error": str(e)})
