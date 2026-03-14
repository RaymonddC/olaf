"""OLAF — Firestore service layer.

Provides CRUD operations for all Firestore collections using the
subcollection pattern: users/{uid}/conversations/{id}, etc.
Uses the Firebase Admin SDK (google-cloud-firestore).
"""

import logging
import uuid
from datetime import UTC, datetime
from typing import Any

from google.cloud import firestore

from models.firestore import (
    AlertDoc,
    ConversationDoc,
    FamilyLink,
    HealthLogDoc,
    MemoryChapterDoc,
    ReminderDoc,
    ReportDoc,
    UserProfile,
)

logger = logging.getLogger(__name__)


def _utcnow() -> datetime:
    return datetime.now(UTC)


def _new_id() -> str:
    return uuid.uuid4().hex[:20]


class FirestoreService:
    """Encapsulates all Firestore CRUD operations for OLAF."""

    def __init__(self, db: firestore.Client | None = None):
        self.db = db or firestore.Client()

    # ── Helpers ─────────────────────────────────────────────────────────────

    def _user_ref(self, uid: str) -> firestore.DocumentReference:
        return self.db.collection("users").document(uid)

    def _subcollection(
        self, uid: str, collection: str
    ) -> firestore.CollectionReference:
        return self._user_ref(uid).collection(collection)

    # ── Users ───────────────────────────────────────────────────────────────

    async def create_user(self, profile: UserProfile) -> UserProfile:
        """Create a new user profile document."""
        ref = self._user_ref(profile.uid)
        ref.set(profile.model_dump())
        return profile

    async def get_user(self, uid: str) -> UserProfile | None:
        """Get a user profile by UID."""
        doc = self._user_ref(uid).get()
        if not doc.exists:
            return None
        return UserProfile(**doc.to_dict())

    async def update_user(self, uid: str, data: dict[str, Any]) -> None:
        """Partially update a user profile."""
        data["updated_at"] = _utcnow()
        self._user_ref(uid).update(data)

    # ── Family Links ────────────────────────────────────────────────────────

    async def create_family_link(self, link: FamilyLink) -> FamilyLink:
        """Create a family link document."""
        ref = self.db.collection("familyLinks").document(link.link_id)
        ref.set(link.model_dump())
        return link

    async def get_family_links_for_elderly(self, elderly_uid: str) -> list[FamilyLink]:
        """Get all family links for an elderly user."""
        docs = (
            self.db.collection("familyLinks")
            .where("elderly_user_id", "==", elderly_uid)
            .stream()
        )
        return [FamilyLink(**doc.to_dict()) for doc in docs]

    async def get_family_links_for_family(self, family_uid: str) -> list[FamilyLink]:
        """Get all family links for a family member."""
        docs = (
            self.db.collection("familyLinks")
            .where("family_user_id", "==", family_uid)
            .stream()
        )
        return [FamilyLink(**doc.to_dict()) for doc in docs]

    # ── Conversations ───────────────────────────────────────────────────────

    async def save_conversation(
        self, uid: str, convo: ConversationDoc
    ) -> ConversationDoc:
        """Save a conversation summary."""
        ref = self._subcollection(uid, "conversations").document(
            convo.conversation_id
        )
        ref.set(convo.model_dump())
        return convo

    async def get_conversations(
        self, uid: str, limit: int = 20
    ) -> list[ConversationDoc]:
        """Get recent conversations for a user."""
        docs = (
            self._subcollection(uid, "conversations")
            .order_by("created_at", direction=firestore.Query.DESCENDING)
            .limit(limit)
            .stream()
        )
        return [ConversationDoc(**doc.to_dict()) for doc in docs]

    # ── Memories ────────────────────────────────────────────────────────────

    async def save_memory(self, uid: str, memory: MemoryChapterDoc) -> MemoryChapterDoc:
        """Save a memory chapter."""
        ref = self._subcollection(uid, "memories").document(memory.memory_id)
        ref.set(memory.model_dump())
        return memory

    async def get_memory(self, uid: str, memory_id: str) -> MemoryChapterDoc | None:
        """Get a single memory chapter."""
        doc = self._subcollection(uid, "memories").document(memory_id).get()
        if not doc.exists:
            return None
        return MemoryChapterDoc(**doc.to_dict())

    async def list_memories(
        self, uid: str, limit: int = 20, offset: int = 0
    ) -> tuple[list[MemoryChapterDoc], int]:
        """List memory chapters with pagination. Returns (memories, total_count)."""
        col = self._subcollection(uid, "memories")

        # Get total count
        all_docs = list(col.stream())
        total = len(all_docs)

        # Get paginated results
        query = col.order_by(
            "created_at", direction=firestore.Query.DESCENDING
        ).offset(offset).limit(limit)
        docs = list(query.stream())
        memories = [MemoryChapterDoc(**doc.to_dict()) for doc in docs]
        return memories, total

    async def update_memory(
        self, uid: str, memory_id: str, data: dict[str, Any]
    ) -> None:
        """Partially update a memory chapter."""
        self._subcollection(uid, "memories").document(memory_id).update(data)

    # ── Health Logs ─────────────────────────────────────────────────────────

    async def save_health_log(self, uid: str, log: HealthLogDoc) -> HealthLogDoc:
        """Save a daily health log (keyed by date)."""
        ref = self._subcollection(uid, "healthLogs").document(log.date)
        ref.set(log.model_dump(), merge=True)
        return log

    async def get_health_log(self, uid: str, date: str) -> HealthLogDoc | None:
        """Get a health log for a specific date."""
        doc = self._subcollection(uid, "healthLogs").document(date).get()
        if not doc.exists:
            return None
        return HealthLogDoc(**doc.to_dict())

    async def get_health_logs(
        self, uid: str, start_date: str, end_date: str
    ) -> list[HealthLogDoc]:
        """Get health logs for a date range."""
        docs = (
            self._subcollection(uid, "healthLogs")
            .where("date", ">=", start_date)
            .where("date", "<=", end_date)
            .order_by("date")
            .stream()
        )
        return [HealthLogDoc(**doc.to_dict()) for doc in docs]

    # ── Reports ─────────────────────────────────────────────────────────────

    async def save_report(self, uid: str, report: ReportDoc) -> ReportDoc:
        """Save a health report."""
        ref = self._subcollection(uid, "reports").document(report.report_id)
        ref.set(report.model_dump())
        return report

    async def get_reports(
        self, uid: str, report_type: str | None = None, limit: int = 20
    ) -> list[ReportDoc]:
        """Get health reports, optionally filtered by type."""
        query = self._subcollection(uid, "reports")
        if report_type:
            query = query.where("type", "==", report_type)
        docs = (
            query.order_by("generated_at", direction=firestore.Query.DESCENDING)
            .limit(limit)
            .stream()
        )
        return [ReportDoc(**doc.to_dict()) for doc in docs]

    # ── Reminders ───────────────────────────────────────────────────────────

    async def save_reminder(self, uid: str, reminder: ReminderDoc) -> ReminderDoc:
        """Save a reminder."""
        ref = self._subcollection(uid, "reminders").document(reminder.reminder_id)
        ref.set(reminder.model_dump())
        return reminder

    async def get_reminders(
        self, uid: str, status: str | None = None
    ) -> list[ReminderDoc]:
        """Get reminders for a user, optionally filtered by status."""
        query = self._subcollection(uid, "reminders")
        if status:
            query = query.where("status", "==", status)
        docs = query.order_by("scheduled_time").stream()
        return [ReminderDoc(**doc.to_dict()) for doc in docs]

    async def update_reminder(
        self, uid: str, reminder_id: str, data: dict[str, Any]
    ) -> None:
        """Partially update a reminder."""
        self._subcollection(uid, "reminders").document(reminder_id).update(data)

    # ── Alerts (top-level collection) ───────────────────────────────────────

    async def create_alert(self, alert: AlertDoc) -> AlertDoc:
        """Create an alert."""
        ref = self.db.collection("alerts").document(alert.alert_id)
        ref.set(alert.model_dump())
        return alert

    async def get_alerts(
        self,
        user_id: str,
        acknowledged: bool | None = None,
        limit: int = 50,
    ) -> list[AlertDoc]:
        """Get alerts for a user."""
        query = self.db.collection("alerts").where("user_id", "==", user_id)
        if acknowledged is not None:
            query = query.where("acknowledged", "==", acknowledged)
        docs = (
            query.order_by("created_at", direction=firestore.Query.DESCENDING)
            .limit(limit)
            .stream()
        )
        return [AlertDoc(**doc.to_dict()) for doc in docs]

    async def acknowledge_alert(
        self, alert_id: str, acknowledged_by: str
    ) -> AlertDoc | None:
        """Acknowledge an alert. Returns the updated alert or None if not found."""
        ref = self.db.collection("alerts").document(alert_id)
        doc = ref.get()
        if not doc.exists:
            return None
        ref.update(
            {
                "acknowledged": True,
                "acknowledged_by": acknowledged_by,
                "acknowledged_at": _utcnow(),
            }
        )
        updated = ref.get()
        return AlertDoc(**updated.to_dict())


# Singleton instance — initialised lazily to allow Firebase Admin to init first.
_service: FirestoreService | None = None


def get_firestore_service() -> FirestoreService:
    """FastAPI dependency that returns the Firestore service singleton."""
    global _service
    if _service is None:
        _service = FirestoreService()
    return _service
