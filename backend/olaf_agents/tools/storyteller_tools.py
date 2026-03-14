"""OLAF Storyteller — ADK tool functions.

These tools are called by the Storyteller agent during memory chapter creation,
daily narrative generation, and weekly report compilation.
"""

import logging
import uuid

from google.adk.tools.tool_context import ToolContext

from models.firestore import MemoryChapterDoc, ReportDoc
from services.firestore_service import get_firestore_service
from services.imagen_service import ImageGenerationError, get_imagen_service

logger = logging.getLogger(__name__)


def _new_id() -> str:
    return uuid.uuid4().hex[:20]


async def generate_illustration(
    prompt: str,
    style: str,
    tool_context: ToolContext,
) -> dict:
    """Generate a warm illustration for a memory scene using Imagen 3.

    Args:
        prompt: A vivid scene description for the illustration.
        style: Art style — one of 'warm watercolor', 'soft pencil sketch', 'gentle oil painting'.

    Returns:
        dict with status and illustration URL.
    """
    user_id = tool_context.state.get("user:user_id", "unknown")
    logger.info("generate_illustration called for user=%s prompt=%s", user_id, prompt[:80])

    imagen = get_imagen_service()
    try:
        url = await imagen.generate_and_store(
            prompt=prompt,
            user_id=user_id,
            style=style,
        )

        # Accumulate illustration URLs in temp state for chapter assembly
        urls = tool_context.state.get("temp:illustration_urls", [])
        if not isinstance(urls, list):
            urls = []
        urls.append(url)
        tool_context.state["temp:illustration_urls"] = urls

        return {
            "status": "success",
            "illustration_url": url,
            "message": "Illustration generated and stored successfully",
        }
    except ImageGenerationError as e:
        logger.warning("Illustration generation failed: %s", e)
        return {
            "status": "error",
            "error_message": (
                "Illustration could not be generated. "
                "Save the chapter without images — illustrations can be added later."
            ),
        }


async def save_memory_chapter(
    title: str,
    narrative_text: str,
    tags: str,
    tool_context: ToolContext,
) -> dict:
    """Save a completed memory chapter to storage.

    Args:
        title: The chapter title.
        narrative_text: The full narrative text of the memory chapter.
        tags: Comma-separated tags for the memory (e.g. 'wedding, family, 1970s').

    Returns:
        dict with status and memory_id.
    """
    user_id = tool_context.state.get("user:user_id", "unknown")
    fs = get_firestore_service()

    memory_id = _new_id()
    tag_list = [t.strip() for t in tags.split(",") if t.strip()]

    # Get illustration URLs from state if available
    illustration_urls = tool_context.state.get("temp:illustration_urls", [])

    # Build snippet from first 200 chars
    snippet = narrative_text[:200].rstrip() if narrative_text else ""

    memory = MemoryChapterDoc(
        memory_id=memory_id,
        title=title,
        narrative_text=narrative_text,
        illustration_urls=illustration_urls if isinstance(illustration_urls, list) else [],
        snippet=snippet,
        tags=tag_list,
        status="complete",
    )

    await fs.save_memory(user_id, memory)
    logger.info("Saved memory chapter %s for user %s", memory_id, user_id)

    # Clear temp illustration state
    tool_context.state["temp:illustration_urls"] = []

    return {"status": "success", "memory_id": memory_id, "title": title}


async def save_health_narrative(
    narrative: str,
    date: str,
    mood_summary: str,
    tool_context: ToolContext,
) -> dict:
    """Save a daily health narrative to the user's reports.

    Args:
        narrative: The generated health narrative text.
        date: The date this narrative covers (YYYY-MM-DD).
        mood_summary: Brief mood summary for the day.

    Returns:
        dict with status and report_id.
    """
    user_id = tool_context.state.get("user:user_id", "unknown")
    fs = get_firestore_service()

    report_id = _new_id()
    illustration_urls = tool_context.state.get("temp:illustration_urls", [])

    report = ReportDoc(
        report_id=report_id,
        type="daily",
        content=narrative,
        image_urls=illustration_urls if isinstance(illustration_urls, list) else [],
        highlights=[mood_summary] if mood_summary else [],
    )

    await fs.save_report(user_id, report)
    logger.info("Saved daily narrative %s for user %s", report_id, user_id)

    # Clear temp illustration state
    tool_context.state["temp:illustration_urls"] = []

    return {"status": "success", "report_id": report_id, "date": date}


async def save_weekly_report(
    report_content: str,
    week_start: str,
    concerns: str,
    highlights: str,
    tool_context: ToolContext,
) -> dict:
    """Save a weekly family report.

    Args:
        report_content: The full weekly report text.
        week_start: Start date of the week (YYYY-MM-DD).
        concerns: Comma-separated list of health concerns identified this week.
        highlights: Comma-separated list of positive highlights from the week.

    Returns:
        dict with status and report_id.
    """
    user_id = tool_context.state.get("user:user_id", "unknown")
    fs = get_firestore_service()

    report_id = _new_id()
    concern_list = [c.strip() for c in concerns.split(",") if c.strip()]
    highlight_list = [h.strip() for h in highlights.split(",") if h.strip()]
    illustration_urls = tool_context.state.get("temp:illustration_urls", [])

    report = ReportDoc(
        report_id=report_id,
        type="weekly",
        content=report_content,
        image_urls=illustration_urls if isinstance(illustration_urls, list) else [],
        concerns=concern_list,
        highlights=highlight_list,
    )

    await fs.save_report(user_id, report)
    logger.info("Saved weekly report %s for user %s", report_id, user_id)

    # Clear temp illustration state
    tool_context.state["temp:illustration_urls"] = []

    return {"status": "success", "report_id": report_id, "week_start": week_start}


async def get_health_logs(
    start_date: str,
    end_date: str,
    tool_context: ToolContext,
) -> dict:
    """Retrieve health logs for a date range.

    Args:
        start_date: Start date (YYYY-MM-DD).
        end_date: End date (YYYY-MM-DD).

    Returns:
        dict with status and list of health log entries.
    """
    user_id = tool_context.state.get("user:user_id", "unknown")
    fs = get_firestore_service()

    logs = await fs.get_health_logs(user_id, start_date, end_date)
    log_dicts = [log.model_dump() for log in logs]

    return {"status": "success", "logs": log_dicts, "count": len(log_dicts)}


async def get_conversation_summaries(
    limit: int,
    tool_context: ToolContext,
) -> dict:
    """Get recent conversation summaries for the user.

    Args:
        limit: Maximum number of conversations to retrieve.

    Returns:
        dict with status and list of conversation summaries.
    """
    user_id = tool_context.state.get("user:user_id", "unknown")
    fs = get_firestore_service()

    convos = await fs.get_conversations(user_id, limit=limit)
    convo_dicts = [
        {
            "conversation_id": c.conversation_id,
            "summary": c.summary,
            "mood_score": c.mood_score,
            "created_at": str(c.created_at),
        }
        for c in convos
    ]

    return {"status": "success", "conversations": convo_dicts, "count": len(convo_dicts)}


async def get_user_memories(
    limit: int,
    tool_context: ToolContext,
) -> dict:
    """Retrieve existing memory chapters for the user.

    Args:
        limit: Maximum number of memories to retrieve.

    Returns:
        dict with status and list of memory summaries.
    """
    user_id = tool_context.state.get("user:user_id", "unknown")
    fs = get_firestore_service()

    memories, total = await fs.list_memories(user_id, limit=limit)
    memory_dicts = [
        {
            "memory_id": m.memory_id,
            "title": m.title,
            "snippet": m.snippet,
            "tags": m.tags,
            "created_at": str(m.created_at),
        }
        for m in memories
    ]

    return {"status": "success", "memories": memory_dicts, "total": total}
