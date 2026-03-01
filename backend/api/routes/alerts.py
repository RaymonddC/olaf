"""CARIA — Alerts API endpoints.

GET   /api/alerts — Get alerts for a user
PATCH /api/alerts/{alertId}/acknowledge — Acknowledge an alert
"""

import logging

from fastapi import APIRouter, Depends, HTTPException, Query, status

from api.middleware.firebase_auth import get_current_user
from models.api import Alert, ApiResponse
from services.firestore_service import FirestoreService, get_firestore_service

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("")
async def get_alerts(
    user: dict = Depends(get_current_user),
    fs: FirestoreService = Depends(get_firestore_service),
    user_id: str = Query(..., alias="userId"),
    acknowledged: bool | None = Query(None),
    limit: int = Query(50, ge=1, le=200),
) -> ApiResponse:
    """Get alerts for a user (family member queries by linked elderly user)."""
    alerts = await fs.get_alerts(user_id, acknowledged=acknowledged, limit=limit)

    alert_items = [
        Alert(
            id=a.alert_id,
            user_id=a.user_id,
            type=a.type,
            severity=a.severity,
            message=a.message,
            source=a.source,
            acknowledged=a.acknowledged,
            created_at=a.created_at,
        ).model_dump(by_alias=True)
        for a in alerts
    ]

    return ApiResponse(status="success", data={"alerts": alert_items})


@router.patch("/{alert_id}/acknowledge")
async def acknowledge_alert(
    alert_id: str,
    user: dict = Depends(get_current_user),
    fs: FirestoreService = Depends(get_firestore_service),
) -> ApiResponse:
    """Acknowledge an alert."""
    uid = user["uid"]
    updated = await fs.acknowledge_alert(alert_id, acknowledged_by=uid)

    if not updated:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Alert not found",
        )

    logger.info("Alert %s acknowledged by %s", alert_id, uid)

    return ApiResponse(
        status="success",
        data={
            "id": alert_id,
            "acknowledged": True,
            "acknowledgedBy": uid,
        },
    )
