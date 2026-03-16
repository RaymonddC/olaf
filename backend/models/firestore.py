"""OLAF — Firestore document models.

These represent the shape of documents stored in Firestore collections.
They are used for serialisation/deserialisation, not for API validation.
"""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class UserProfile(BaseModel):
    """Firestore: users/{uid}"""

    uid: str
    role: Literal["elderly", "family"]
    name: str
    age: int | None = None
    timezone: str = "UTC"
    language: str = "en"
    medications: list[str] = []
    profile_complete: bool = False
    fcm_token: str | None = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class FamilyLink(BaseModel):
    """Firestore: familyLinks/{linkId}"""

    link_id: str
    elderly_user_id: str
    family_user_id: str
    family_name: str = ""
    relationship: Literal["son", "daughter", "spouse", "caregiver", "other"]
    permissions: list[str] = []
    created_at: datetime = Field(default_factory=datetime.utcnow)


class ConversationDoc(BaseModel):
    """Firestore: users/{uid}/conversations/{convoId}"""

    conversation_id: str
    summary: str = ""
    mood_score: int = 0
    session_duration: int = 0
    flags: list[str] = []
    transcript_count: int = 0
    created_at: datetime = Field(default_factory=datetime.utcnow)


class MemoryChapterDoc(BaseModel):
    """Firestore: users/{uid}/memories/{memoryId}"""

    memory_id: str
    title: str
    narrative_text: str = ""
    raw_transcript: str = ""
    illustration_urls: list[str] = []
    audio_script: str = ""
    snippet: str = ""
    tags: list[str] = []
    status: Literal["pending", "processing", "complete", "failed"] = "pending"
    created_at: datetime = Field(default_factory=datetime.utcnow)


class HealthLogDoc(BaseModel):
    """Firestore: users/{uid}/healthLogs/{date}"""

    date: str  # YYYY-MM-DD
    mood: str = ""
    mood_score: int = 0
    pain_level: int = 0
    medications_taken: list[dict] = []
    hydration_sent: int = 0
    hydration_acknowledged: int = 0
    activity_notes: str = ""
    notes: str = ""
    created_at: datetime = Field(default_factory=datetime.utcnow)


class ReportDoc(BaseModel):
    """Firestore: users/{uid}/reports/{reportId}"""

    report_id: str
    type: Literal["daily", "weekly"]
    content: str = ""
    image_urls: list[str] = []
    mood_trend: list[int] = []
    medication_adherence: float = 0.0
    concerns: list[str] = []
    highlights: list[str] = []
    generated_at: datetime = Field(default_factory=datetime.utcnow)


class ReminderDoc(BaseModel):
    """Firestore: users/{uid}/reminders/{reminderId}"""

    reminder_id: str
    type: Literal["medication", "appointment", "hydration", "custom"] = "custom"
    message: str
    scheduled_time: datetime | None = None
    status: Literal["pending", "sent", "acknowledged"] = "pending"
    recurring: bool = False
    recurrence_pattern: str | None = None
    created_at: datetime = Field(default_factory=datetime.utcnow)


class AlertDoc(BaseModel):
    """Firestore: alerts/{alertId}"""

    alert_id: str
    user_id: str
    type: Literal["emotional_distress", "missed_medication", "health_anomaly", "inactivity"]
    severity: Literal["low", "medium", "high"]
    message: str
    source: Literal["companion", "storyteller", "navigator", "system"]
    acknowledged: bool = False
    acknowledged_by: str | None = None
    acknowledged_at: datetime | None = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
