"""OLAF — Navigator API endpoints.

POST /api/navigator/start — Start a new navigation session
POST /api/navigator/confirm/{sessionId} — Confirm/reject sensitive action
POST /api/navigator/stop/{sessionId} — End a navigation session
WSS  /api/navigator/stream/{sessionId} — WebSocket screenshot stream
"""

import asyncio
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect, status

from api.middleware.firebase_auth import get_current_user
from models.api import (
    ApiResponse,
    ConfirmActionRequest,
    StartNavigatorRequest,
)
from services.navigator_session import get_session_manager

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/start")
async def start_navigator(
    req: StartNavigatorRequest,
    user: dict = Depends(get_current_user),
) -> ApiResponse:
    """Start a new navigation session with a headless browser."""
    manager = get_session_manager()

    try:
        session = await manager.start_session(
            user_id=req.user_id,
            task=req.task,
            template_id=req.template_id,
            start_url=req.start_url,
        )
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        )

    # If a template is provided, set estimated steps
    if req.template_id:
        from caria_agents.tools.navigator_templates import get_template

        template = get_template(req.template_id)
        if template:
            session.total_steps = template.estimated_steps

    logger.info(
        "Navigator session %s started for user %s: %s",
        session.session_id, req.user_id, req.task,
    )

    return ApiResponse(
        status="success",
        data={
            "sessionId": session.session_id,
            "websocketUrl": f"/api/navigator/stream/{session.session_id}",
        },
    )


@router.post("/confirm/{session_id}")
async def confirm_action(
    session_id: str,
    req: ConfirmActionRequest,
    user: dict = Depends(get_current_user),
) -> ApiResponse:
    """User confirms or rejects a sensitive action."""
    manager = get_session_manager()
    session = manager.get_session(session_id)

    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Navigation session not found",
        )

    approved = req.action == "approve"
    resolved = session.resolve_confirmation(req.action_id, approved)

    if not resolved:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No matching pending confirmation found",
        )

    result = "approved" if approved else "rejected"
    logger.info(
        "Navigator action %s %s in session %s",
        req.action_id, result, session_id,
    )

    return ApiResponse(
        status="success",
        data={
            "actionId": req.action_id,
            "result": result,
        },
    )


@router.post("/stop/{session_id}")
async def stop_navigator(
    session_id: str,
    user: dict = Depends(get_current_user),
) -> ApiResponse:
    """End a navigation session."""
    manager = get_session_manager()
    summary = await manager.stop_session(session_id)

    if summary is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Navigation session not found",
        )

    logger.info("Navigator session %s stopped", session_id)

    return ApiResponse(
        status="success",
        data={
            "sessionId": session_id,
            "summary": summary,
        },
    )


@router.websocket("/stream/{session_id}")
async def navigator_stream(
    websocket: WebSocket,
    session_id: str,
    token: str = Query(default=""),
):
    """WebSocket endpoint for real-time navigator screenshot streaming.

    Auth via ?token=<firebase_id_token> query parameter.

    Server → Client messages:
      - screenshot: { imageBase64, pageUrl, pageTitle, timestamp }
      - narration: { message, timestamp }
      - confirmation_required: { actionId, actionDescription, actionType, timestamp }
      - status: { state, message }

    Client → Server messages:
      - confirmation_response: { actionId, approved }
      - user_input: { fieldId, value }
      - cancel
    """
    # Verify auth token
    if not token:
        await websocket.close(code=4001, reason="Missing authentication token")
        return

    try:
        from firebase_admin import auth

        auth.verify_id_token(token)
    except Exception:
        await websocket.close(code=4001, reason="Invalid authentication token")
        return

    manager = get_session_manager()
    session = manager.get_session(session_id)

    if not session:
        await websocket.close(code=4004, reason="Session not found")
        return

    await websocket.accept()
    session.websocket = websocket
    logger.info("WebSocket connected for navigator session %s", session_id)

    try:
        # Send initial status
        await websocket.send_json({
            "type": "status",
            "data": {
                "state": "navigating",
                "message": "Connected to navigation session",
            },
        })

        # If there's a start URL or template, navigate to it
        if session.start_url:
            result = await session.browser_session.navigate(session.start_url)
            if result["status"] == "success":
                await session.send_screenshot(
                    image_base64=result.get("imageBase64", ""),
                    page_url=result.get("pageUrl", ""),
                    page_title=result.get("pageTitle", ""),
                )
                await session.send_narration(f"Opening {session.start_url}…")
        elif session.template_id:
            from caria_agents.tools.navigator_templates import get_template

            template = get_template(session.template_id)
            if template and template.start_url:
                result = await session.browser_session.navigate(template.start_url)
                if result["status"] == "success":
                    await session.send_screenshot(
                        image_base64=result.get("imageBase64", ""),
                        page_url=result.get("pageUrl", ""),
                        page_title=result.get("pageTitle", ""),
                    )
                    await session.send_narration(f"Opening {template.name} page…")

        # Handle incoming client messages
        while True:
            data = await websocket.receive_json()
            msg_type = data.get("type")
            session.touch()

            if msg_type == "confirmation_response":
                action_id = data.get("data", {}).get("actionId")
                approved = data.get("data", {}).get("approved", False)
                logger.info("User confirmation: action=%s approved=%s", action_id, approved)
                if action_id:
                    session.resolve_confirmation(action_id, approved)

            elif msg_type == "user_input":
                field_id = data.get("data", {}).get("fieldId")
                value = data.get("data", {}).get("value")
                logger.info("User input for field: %s", field_id)
                # Store user input in session state for the agent to consume
                if field_id and value is not None:
                    # Agent tools can read this from session state
                    pass

            elif msg_type == "cancel":
                logger.info("User cancelled navigator session %s", session_id)
                await session.send_status("completed", "Session cancelled by user")
                break

    except WebSocketDisconnect:
        logger.info("WebSocket disconnected for navigator session %s", session_id)
    except Exception as exc:
        logger.error("WebSocket error for session %s: %s", session_id, exc)
    finally:
        session.websocket = None
