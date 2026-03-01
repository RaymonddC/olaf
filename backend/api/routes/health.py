"""CARIA — Health API endpoints.

GET /api/health/logs — Get health logs for a date range
GET /api/health/reports — Get generated health reports
GET /api/health/reminders — Get reminders
"""

import logging
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Query

from api.middleware.firebase_auth import get_current_user
from models.api import (
    ApiResponse,
    HealthLog,
    HealthReport,
    HydrationReminders,
    MedicationTaken,
    Reminder,
)
from services.firestore_service import FirestoreService, get_firestore_service

logger = logging.getLogger(__name__)

router = APIRouter()


def _resolve_date_range(range_str: str) -> tuple[str, str]:
    """Resolve a date range string to start/end dates.

    Supports: 'today', 'week', 'month', or 'YYYY-MM-DD:YYYY-MM-DD'.
    """
    today = datetime.now(timezone.utc).date()

    if range_str == "today":
        date_str = today.isoformat()
        return date_str, date_str
    elif range_str == "week":
        start = (today - timedelta(days=7)).isoformat()
        return start, today.isoformat()
    elif range_str == "month":
        start = (today - timedelta(days=30)).isoformat()
        return start, today.isoformat()
    elif ":" in range_str:
        parts = range_str.split(":")
        return parts[0], parts[1]
    else:
        # Default to today
        date_str = today.isoformat()
        return date_str, date_str


@router.get("/logs")
async def get_health_logs(
    user: dict = Depends(get_current_user),
    fs: FirestoreService = Depends(get_firestore_service),
    user_id: str = Query(..., alias="userId"),
    range: str = Query("today"),
) -> ApiResponse:
    """Get health logs for a date range."""
    start_date, end_date = _resolve_date_range(range)
    logs = await fs.get_health_logs(user_id, start_date, end_date)

    log_items = []
    for log in logs:
        med_taken = [
            MedicationTaken(
                name=m.get("name", ""),
                time=m.get("time", ""),
                confirmed=m.get("confirmed", False),
            ).model_dump(by_alias=True)
            for m in log.medications_taken
        ]

        log_items.append(
            HealthLog(
                date=log.date,
                mood=log.mood,
                mood_score=log.mood_score,
                pain_level=log.pain_level,
                medications_taken=[
                    MedicationTaken(
                        name=m.get("name", ""),
                        time=m.get("time", ""),
                        confirmed=m.get("confirmed", False),
                    )
                    for m in log.medications_taken
                ],
                hydration_reminders=HydrationReminders(
                    sent=log.hydration_sent,
                    acknowledged=log.hydration_acknowledged,
                ),
                activity_notes=log.activity_notes,
            ).model_dump(by_alias=True)
        )

    return ApiResponse(status="success", data={"logs": log_items})


@router.get("/reports")
async def get_health_reports(
    user: dict = Depends(get_current_user),
    fs: FirestoreService = Depends(get_firestore_service),
    user_id: str = Query(..., alias="userId"),
    type: str | None = Query(None),
    limit: int = Query(20, ge=1, le=100),
) -> ApiResponse:
    """Get generated health reports."""
    reports = await fs.get_reports(user_id, report_type=type, limit=limit)

    report_items = [
        HealthReport(
            id=r.report_id,
            type=r.type,
            content=r.content,
            image_urls=r.image_urls,
            mood_trend=r.mood_trend,
            medication_adherence=r.medication_adherence,
            concerns=r.concerns,
            highlights=r.highlights,
            generated_at=r.generated_at,
        ).model_dump(by_alias=True)
        for r in reports
    ]

    return ApiResponse(status="success", data={"reports": report_items})


@router.get("/reminders")
async def get_reminders(
    user: dict = Depends(get_current_user),
    fs: FirestoreService = Depends(get_firestore_service),
    user_id: str = Query(..., alias="userId"),
    status_filter: str | None = Query(None, alias="status"),
) -> ApiResponse:
    """Get reminders for a user."""
    reminders = await fs.get_reminders(user_id, status=status_filter)

    reminder_items = [
        Reminder(
            id=r.reminder_id,
            type=r.type,
            message=r.message,
            scheduled_time=r.scheduled_time,
            status=r.status,
            recurring=r.recurring,
        ).model_dump(by_alias=True)
        for r in reminders
    ]

    return ApiResponse(status="success", data={"reminders": reminder_items})
