"""CARIA — Storyteller API endpoints.

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
from caria_agents.agents.storyteller import storyteller_agent
from models.api import (
    ApiResponse,
    CreateDailyNarrativeRequest,
    CreateMemoryRequest,
    CreateWeeklyReportRequest,
    MemoryChapter,
    MemoryListItem,
)
from services.firestore_service import FirestoreService, get_firestore_service

logger = logging.getLogger(__name__)

router = APIRouter()

# Shared session service for storyteller agent invocations
_session_service = InMemorySessionService()


async def _run_storyteller(
    user_id: str,
    message_text: str,
    task_id: str,
) -> None:
    """Run the storyteller agent in the background.

    Creates an ADK session, invokes the agent with the given message,
    and processes all events until completion.
    """
    runner = Runner(
        agent=storyteller_agent,
        app_name="caria",
        session_service=_session_service,
    )

    session_id = f"storyteller-{task_id}"

    # Create session with user context
    session = await _session_service.create_session(
        app_name="caria",
        user_id=user_id,
        session_id=session_id,
    )
    session.state["user:user_id"] = user_id

    content = types.Content(
        role="user",
        parts=[types.Part(text=message_text)],
    )

    try:
        async for event in runner.run_async(
            user_id=user_id,
            session_id=session_id,
            new_message=content,
        ):
            if event.is_final_response():
                logger.info(
                    "Storyteller task %s completed for user %s",
                    task_id,
                    user_id,
                )
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

    background_tasks.add_task(_run_storyteller, req.user_id, message, task_id)

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
        illustration_urls=memory.illustration_urls,
        audio_script=memory.audio_script,
        tags=memory.tags,
        created_at=memory.created_at,
    )

    return ApiResponse(
        status="success",
        data=chapter.model_dump(by_alias=True),
    )
