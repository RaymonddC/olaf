"""OLAF — Pydantic API request/response models.

Matches the contracts in docs/architecture/api-contracts.md Section 11.
Field names use snake_case in Python; camelCase aliases for JSON I/O.
"""

from datetime import datetime
from typing import Any, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field


# ── Helpers ─────────────────────────────────────────────────────────────────


def _to_camel(name: str) -> str:
    parts = name.split("_")
    return parts[0] + "".join(w.capitalize() for w in parts[1:])


class CamelModel(BaseModel):
    """Base model that serialises to camelCase JSON."""

    model_config = ConfigDict(
        alias_generator=_to_camel,
        populate_by_name=True,
    )


# ── Common ──────────────────────────────────────────────────────────────────


class ApiResponse(BaseModel):
    status: Literal["success", "error", "accepted", "pending"]
    data: Optional[Any] = None
    error_message: Optional[str] = Field(None, alias="errorMessage")

    model_config = ConfigDict(populate_by_name=True)


# ── Auth ────────────────────────────────────────────────────────────────────


class RegisterRequest(CamelModel):
    role: Literal["elderly", "family"]
    name: str
    timezone: str
    language: str
    age: Optional[int] = None


class FamilyLinkRequest(CamelModel):
    elderly_user_id: str
    relationship: Literal["son", "daughter", "spouse", "caregiver", "other"]
    permissions: list[str] = []


class LinkedAccount(CamelModel):
    user_id: str
    name: str
    relationship: str
    role: Literal["elderly", "family"]


class UserProfileResponse(CamelModel):
    user_id: str
    role: Literal["elderly", "family"]
    name: str
    age: Optional[int] = None
    linked_accounts: list[LinkedAccount] = []


# ── Ephemeral Token ────────────────────────────────────────────────────────


class TokenRequest(CamelModel):
    user_id: str


class TokenResponse(CamelModel):
    token: str
    expires_at: str


# ── Companion ───────────────────────────────────────────────────────────────


class AnalyzeMedicationArgs(BaseModel):
    image_description: str = Field(alias="imageDescription")
    model_config = ConfigDict(populate_by_name=True)


class AnalyzeMedicationRequest(CamelModel):
    user_id: str
    args: AnalyzeMedicationArgs


class AnalyzeMedicationResponse(CamelModel):
    medication_name: str
    dosage: str
    match_status: Literal["match", "mismatch", "unknown"]
    guidance: str


class FlagDistressArgs(BaseModel):
    severity: Literal["low", "medium", "high"]
    observation: str


class FlagDistressRequest(CamelModel):
    user_id: str
    args: FlagDistressArgs


class FlagDistressResponse(CamelModel):
    alert_id: str
    action: Literal["logged", "notified_family", "urgent_alert"]


class HealthCheckinArgs(BaseModel):
    mood: Literal["happy", "okay", "sad", "anxious", "confused", "tired"]
    pain_level: int = Field(alias="painLevel", ge=0, le=10)
    notes: str = ""
    model_config = ConfigDict(populate_by_name=True)


class HealthCheckinRequest(CamelModel):
    user_id: str
    args: HealthCheckinArgs


class HealthCheckinResponse(CamelModel):
    log_id: str
    date: str


class SetReminderArgs(BaseModel):
    reminder_type: Literal["medication", "appointment", "hydration", "custom"] = Field(
        alias="reminderType"
    )
    message: str
    time: str
    model_config = ConfigDict(populate_by_name=True)


class SetReminderRequest(CamelModel):
    user_id: str
    args: SetReminderArgs


class SetReminderResponse(CamelModel):
    reminder_id: str
    scheduled_time: str


class TranscriptEntry(BaseModel):
    role: Literal["user", "model"]
    text: str
    timestamp: str


class LogConversationRequest(CamelModel):
    user_id: str
    session_duration: int
    transcript: list[TranscriptEntry] = []
    flags: list[str] = []


class LogConversationResponse(CamelModel):
    conversation_id: str
    summary: str
    mood_score: int


# ── Storyteller ─────────────────────────────────────────────────────────────


class CreateMemoryRequest(CamelModel):
    user_id: str
    transcript: str
    title: Optional[str] = None


class TaskAcceptedResponse(CamelModel):
    task_id: str
    message: str = ""


class CreateDailyNarrativeRequest(CamelModel):
    user_id: str
    date: str


class CreateWeeklyReportRequest(CamelModel):
    user_id: str
    week_start: str


class MemoryListItem(CamelModel):
    id: str
    title: str
    created_at: datetime
    illustration_urls: list[str] = []
    snippet: str = ""


class MemoryListResponse(CamelModel):
    memories: list[MemoryListItem] = []
    total: int = 0
    has_more: bool = False


class MemoryChapter(CamelModel):
    id: str
    title: str
    narrative_text: str
    illustration_urls: list[str] = []
    audio_script: str = ""
    tags: list[str] = []
    created_at: datetime


# ── Navigator ───────────────────────────────────────────────────────────────


class StartNavigatorRequest(CamelModel):
    user_id: str
    task: str
    template_id: Optional[str] = None
    start_url: Optional[str] = None


class NavigatorSessionResponse(CamelModel):
    session_id: str
    websocket_url: str


class ConfirmActionRequest(BaseModel):
    action: Literal["approve", "reject"]
    action_id: str = Field(alias="actionId")
    model_config = ConfigDict(populate_by_name=True)


class ConfirmActionResponse(CamelModel):
    action_id: str
    result: Literal["approved", "rejected"]


class StopNavigatorResponse(CamelModel):
    session_id: str
    summary: str


# ── Health ──────────────────────────────────────────────────────────────────


class MedicationTaken(CamelModel):
    name: str
    time: str
    confirmed: bool


class HydrationReminders(CamelModel):
    sent: int = 0
    acknowledged: int = 0


class HealthLog(CamelModel):
    date: str
    mood: str
    mood_score: int = 0
    pain_level: int = 0
    medications_taken: list[MedicationTaken] = []
    hydration_reminders: HydrationReminders = HydrationReminders()
    activity_notes: str = ""


class HealthReport(CamelModel):
    id: str
    type: Literal["daily", "weekly"]
    content: str
    image_urls: list[str] = []
    mood_trend: list[int] = []
    medication_adherence: float = 0.0
    concerns: list[str] = []
    highlights: list[str] = []
    generated_at: datetime


class Reminder(CamelModel):
    id: str
    type: Literal["medication", "appointment", "hydration", "custom"]
    message: str
    scheduled_time: datetime
    status: Literal["pending", "sent", "acknowledged"] = "pending"
    recurring: bool = False


# ── Alerts ──────────────────────────────────────────────────────────────────


class Alert(CamelModel):
    id: str
    user_id: str
    type: Literal["emotional_distress", "missed_medication", "health_anomaly", "inactivity"]
    severity: Literal["low", "medium", "high"]
    message: str
    source: Literal["companion", "storyteller", "navigator", "system"]
    acknowledged: bool = False
    created_at: Optional[datetime] = None


class Signal(BaseModel):
    user_id: str
    type: Literal["emotional_distress", "missed_medication", "health_anomaly", "inactivity"]
    severity: Literal["low", "medium", "high"]
    observation: str
    source: Literal["companion", "storyteller", "navigator", "system"]
