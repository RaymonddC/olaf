"""OLAF — Conversations API endpoints.

GET /api/companion/conversations — List conversation summaries for a user
"""

import logging

from fastapi import APIRouter, Depends, Query

from api.middleware.firebase_auth import get_current_user
from models.api import ApiResponse
from services.firestore_service import FirestoreService, get_firestore_service

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/conversations")
async def list_conversations(
    user: dict = Depends(get_current_user),
    fs: FirestoreService = Depends(get_firestore_service),
    user_id: str = Query(..., alias="userId"),
    limit: int = Query(20, ge=1, le=100),
) -> ApiResponse:
    """List recent conversation summaries for a user."""
    convos = await fs.get_conversations(user_id, limit=limit)

    items = [
        {
            "conversationId": c.conversation_id,
            "summary": c.summary,
            "moodScore": c.mood_score,
            "sessionDuration": c.session_duration,
            "flags": c.flags,
            "transcriptCount": c.transcript_count,
            "createdAt": c.created_at.isoformat() if c.created_at else None,
        }
        for c in convos
    ]

    return ApiResponse(
        status="success",
        data={
            "conversations": items,
            "total": len(items),
        },
    )
