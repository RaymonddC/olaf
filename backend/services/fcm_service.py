"""CARIA — Firebase Cloud Messaging service.

Sends push notifications to family members via FCM.
Supports alert, daily_report, and weekly_report notification types.
"""

import logging
from typing import Optional

from google.cloud import firestore

logger = logging.getLogger(__name__)


class FCMService:
    """Firebase Cloud Messaging service for CARIA push notifications."""

    def __init__(self, db: Optional[firestore.Client] = None):
        self.db = db or firestore.Client()

    # ── Token management ─────────────────────────────────────────────────

    async def register_token(self, user_id: str, token: str, device_id: str = "") -> None:
        """Store an FCM device token for a user."""
        ref = self.db.collection("users").document(user_id)
        doc = ref.get()
        if not doc.exists:
            logger.warning("Cannot register token: user %s not found", user_id)
            return

        # Store the primary token on the user profile
        ref.update({"fcm_token": token, "updated_at": firestore.SERVER_TIMESTAMP})

        # Also store in tokens subcollection for multi-device support
        token_ref = (
            self.db.collection("users")
            .document(user_id)
            .collection("fcmTokens")
            .document(device_id or token[:20])
        )
        token_ref.set(
            {
                "token": token,
                "device_id": device_id,
                "created_at": firestore.SERVER_TIMESTAMP,
            }
        )
        logger.info("FCM token registered for user %s", user_id)

    async def unregister_token(self, user_id: str, token: str) -> None:
        """Remove an FCM device token for a user."""
        # Remove from tokens subcollection
        tokens_col = (
            self.db.collection("users")
            .document(user_id)
            .collection("fcmTokens")
        )
        docs = tokens_col.where("token", "==", token).stream()
        for doc in docs:
            doc.reference.delete()

        # If the primary token matches, clear it
        user_ref = self.db.collection("users").document(user_id)
        user_doc = user_ref.get()
        if user_doc.exists and user_doc.to_dict().get("fcm_token") == token:
            user_ref.update({"fcm_token": None})

        logger.info("FCM token unregistered for user %s", user_id)

    async def get_tokens(self, user_id: str) -> list[str]:
        """Get all FCM tokens for a user."""
        tokens_col = (
            self.db.collection("users")
            .document(user_id)
            .collection("fcmTokens")
        )
        docs = list(tokens_col.stream())
        tokens = [doc.to_dict().get("token") for doc in docs if doc.to_dict().get("token")]

        # Fallback to primary token on user profile
        if not tokens:
            user_ref = self.db.collection("users").document(user_id)
            user_doc = user_ref.get()
            if user_doc.exists:
                primary_token = user_doc.to_dict().get("fcm_token")
                if primary_token:
                    tokens = [primary_token]

        return tokens

    # ── Sending notifications ────────────────────────────────────────────

    async def send_notification(
        self,
        user_id: str,
        title: str,
        body: str,
        notification_type: str = "alert",
        data: Optional[dict] = None,
    ) -> dict:
        """Send a push notification to a user via FCM.

        Args:
            user_id: Target user's Firebase UID.
            title: Notification title.
            body: Notification body text.
            notification_type: One of 'alert', 'daily_report', 'weekly_report'.
            data: Optional additional data payload.
        """
        tokens = await self.get_tokens(user_id)
        if not tokens:
            logger.warning("No FCM tokens found for user %s", user_id)
            return {"status": "skipped", "reason": "no_tokens", "user_id": user_id}

        results = []
        for token in tokens:
            result = await self._send_to_token(token, title, body, notification_type, data)
            results.append(result)

        success_count = sum(1 for r in results if r.get("status") == "success")
        return {
            "status": "success" if success_count > 0 else "failed",
            "user_id": user_id,
            "sent": success_count,
            "total_tokens": len(tokens),
        }

    async def _send_to_token(
        self,
        token: str,
        title: str,
        body: str,
        notification_type: str,
        data: Optional[dict] = None,
    ) -> dict:
        """Send a single FCM message to a device token."""
        try:
            from firebase_admin import messaging

            message = messaging.Message(
                notification=messaging.Notification(title=title, body=body),
                token=token,
                data={
                    "type": notification_type,
                    "click_action": "/dashboard",
                    **(data or {}),
                },
                android=messaging.AndroidConfig(
                    priority="high" if notification_type == "alert" else "normal",
                    notification=messaging.AndroidNotification(
                        click_action="/dashboard",
                        channel_id="caria_alerts",
                    ),
                ),
                webpush=messaging.WebpushConfig(
                    notification=messaging.WebpushNotification(
                        title=title,
                        body=body,
                        icon="/icons/icon-192x192.png",
                    ),
                    fcm_options=messaging.WebpushFCMOptions(link="/dashboard"),
                ),
            )

            response = messaging.send(message)
            logger.info("FCM message sent: %s", response)
            return {"status": "success", "message_id": response}

        except ImportError:
            logger.warning("firebase_admin.messaging not available — notification simulated")
            return {"status": "success", "message_id": "simulated", "simulated": True}
        except Exception as e:
            logger.error("FCM send failed: %s", e)
            return {"status": "failed", "error": str(e)}

    async def send_to_family(
        self,
        elderly_user_id: str,
        title: str,
        body: str,
        notification_type: str = "alert",
        data: Optional[dict] = None,
        urgent: bool = False,
    ) -> dict:
        """Send notification to all family members linked to an elderly user.

        Args:
            elderly_user_id: The elderly user's UID.
            title: Notification title.
            body: Notification body.
            notification_type: Notification category.
            data: Additional data payload.
            urgent: If True, send to ALL contacts. If False, send to primary only.
        """
        from services.firestore_service import get_firestore_service

        fs = get_firestore_service()
        links = await fs.get_family_links_for_elderly(elderly_user_id)

        if not links:
            logger.warning("No family links found for elderly user %s", elderly_user_id)
            return {"status": "skipped", "reason": "no_family_links"}

        targets = links if urgent else links[:1]
        results = []
        for link in targets:
            result = await self.send_notification(
                user_id=link.family_user_id,
                title=title,
                body=body,
                notification_type=notification_type,
                data=data,
            )
            results.append(result)

        success_count = sum(1 for r in results if r.get("status") == "success")
        return {
            "status": "success" if success_count > 0 else "failed",
            "notified_count": success_count,
            "total_contacts": len(targets),
        }


# Singleton instance
_service: Optional[FCMService] = None


def get_fcm_service() -> FCMService:
    """Get the FCM service singleton."""
    global _service
    if _service is None:
        _service = FCMService()
    return _service
