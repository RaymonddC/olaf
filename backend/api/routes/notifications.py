"""CARIA — Notification API endpoints.

POST   /api/notifications/register-token — Store FCM device token
DELETE /api/notifications/unregister-token — Remove FCM device token
"""

import logging

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from api.middleware.firebase_auth import get_current_user
from models.api import ApiResponse
from services.fcm_service import FCMService, get_fcm_service

logger = logging.getLogger(__name__)

router = APIRouter()


class RegisterTokenRequest(BaseModel):
    token: str
    device_id: str = ""


class UnregisterTokenRequest(BaseModel):
    token: str


@router.post("/register-token")
async def register_token(
    req: RegisterTokenRequest,
    user: dict = Depends(get_current_user),
    fcm: FCMService = Depends(get_fcm_service),
) -> ApiResponse:
    """Store an FCM device token for push notifications."""
    uid = user["uid"]
    await fcm.register_token(uid, req.token, req.device_id)
    logger.info("FCM token registered for user %s", uid)
    return ApiResponse(status="success", data={"registered": True})


@router.delete("/unregister-token")
async def unregister_token(
    req: UnregisterTokenRequest,
    user: dict = Depends(get_current_user),
    fcm: FCMService = Depends(get_fcm_service),
) -> ApiResponse:
    """Remove an FCM device token."""
    uid = user["uid"]
    await fcm.unregister_token(uid, req.token)
    logger.info("FCM token unregistered for user %s", uid)
    return ApiResponse(status="success", data={"unregistered": True})
