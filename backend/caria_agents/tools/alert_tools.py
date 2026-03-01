"""CARIA Alert Manager — ADK tool functions.

These tools handle alert evaluation, notification routing, and escalation.
Used by the AlertAgent to notify family members about health/safety signals.
"""

import logging
import uuid
from datetime import datetime, timezone

from google.adk.tools.tool_context import ToolContext

from models.firestore import AlertDoc
from services.firestore_service import get_firestore_service
from services.fcm_service import get_fcm_service

logger = logging.getLogger(__name__)


def _new_id() -> str:
    return uuid.uuid4().hex[:20]


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


# ── Signal evaluation ────────────────────────────────────────────────────────


async def evaluate_signal(
    signal_type: str,
    severity: str,
    observation: str,
    source: str,
    tool_context: ToolContext,
) -> dict:
    """Evaluate an incoming signal and determine the appropriate action.

    Args:
        signal_type: Type — 'emotional_distress', 'missed_medication', 'health_anomaly', 'inactivity'.
        severity: Signal severity — 'low', 'medium', or 'high'.
        observation: Description of what was observed.
        source: Signal origin — 'companion', 'storyteller', 'navigator', or 'system'.

    Returns:
        dict with evaluation result including recommended action and context.
    """
    user_id = tool_context.state.get("user:user_id", "unknown")
    logger.info(
        "evaluate_signal for %s: type=%s severity=%s source=%s",
        user_id, signal_type, severity, source,
    )

    # Get baseline for comparison
    fs = get_firestore_service()
    user = await fs.get_user(user_id)
    user_name = user.name if user else "the user"

    # Determine action based on severity
    if severity == "low":
        action = "log_only"
        notify_targets = "none"
        message = f"Low-severity {signal_type.replace('_', ' ')} noted for {user_name}: {observation}"
    elif severity == "medium":
        action = "notify_primary"
        notify_targets = "primary_contact"
        message = f"{user_name} — {signal_type.replace('_', ' ')}: {observation}"
    else:  # high
        action = "notify_all_urgent"
        notify_targets = "all_contacts"
        message = f"URGENT — {user_name}: {observation}"

    return {
        "status": "success",
        "evaluation": {
            "signal_type": signal_type,
            "severity": severity,
            "recommended_action": action,
            "notify_targets": notify_targets,
            "message": message,
            "user_id": user_id,
            "user_name": user_name,
            "source": source,
        },
    }


# ── Alert creation ───────────────────────────────────────────────────────────


async def create_alert(
    signal_type: str,
    severity: str,
    message: str,
    source: str,
    tool_context: ToolContext,
) -> dict:
    """Create an alert document in Firestore and send notifications.

    Args:
        signal_type: Alert type — 'emotional_distress', 'missed_medication', 'health_anomaly', 'inactivity'.
        severity: Alert severity — 'low', 'medium', or 'high'.
        message: Alert message text.
        source: Alert origin — 'companion', 'storyteller', 'navigator', or 'system'.

    Returns:
        dict with alert_id and notification status.
    """
    user_id = tool_context.state.get("user:user_id", "unknown")
    fs = get_firestore_service()
    fcm = get_fcm_service()

    alert_id = _new_id()
    alert = AlertDoc(
        alert_id=alert_id,
        user_id=user_id,
        type=signal_type,
        severity=severity,
        message=message,
        source=source,
        created_at=_utcnow(),
    )
    await fs.create_alert(alert)
    logger.info("Alert created: %s for user %s [%s/%s]", alert_id, user_id, severity, signal_type)

    # Send notifications based on severity
    notification_result = {"status": "skipped"}
    user = await fs.get_user(user_id)
    user_name = user.name if user else "Your loved one"

    if severity == "medium":
        notification_result = await fcm.send_to_family(
            elderly_user_id=user_id,
            title=f"Alert: {signal_type.replace('_', ' ').title()}",
            body=f"{user_name} — {message}",
            notification_type="alert",
            data={"alert_id": alert_id, "severity": severity},
            urgent=False,
        )
    elif severity == "high":
        notification_result = await fcm.send_to_family(
            elderly_user_id=user_id,
            title=f"Urgent: {signal_type.replace('_', ' ').title()}",
            body=f"{user_name} — {message}",
            notification_type="alert",
            data={"alert_id": alert_id, "severity": severity},
            urgent=True,
        )

    return {
        "status": "success",
        "alert_id": alert_id,
        "type": signal_type,
        "severity": severity,
        "notification": notification_result,
    }


# ── Push notification ────────────────────────────────────────────────────────


async def send_push_notification(
    recipient_uid: str,
    title: str,
    body: str,
    severity: str,
    tool_context: ToolContext,
) -> dict:
    """Send an FCM push notification to a family member.

    Args:
        recipient_uid: The Firebase UID of the family member to notify.
        title: Notification title.
        body: Notification body text.
        severity: Alert severity — 'low', 'medium', or 'high'.

    Returns:
        dict with status and delivery details.
    """
    logger.info(
        "send_push_notification to %s: [%s] %s", recipient_uid, severity, title
    )

    fcm = get_fcm_service()
    result = await fcm.send_notification(
        user_id=recipient_uid,
        title=title,
        body=body,
        notification_type="alert",
        data={"severity": severity},
    )

    return {
        "status": result.get("status", "failed"),
        "recipient": recipient_uid,
        "channel": "push",
        "details": result,
    }


# ── Email alert ──────────────────────────────────────────────────────────────


async def send_email_alert(
    recipient_email: str,
    subject: str,
    body: str,
    severity: str,
    tool_context: ToolContext,
) -> dict:
    """Send an email alert to a family member.

    Args:
        recipient_email: Email address of the family member.
        subject: Email subject line.
        body: Email body text.
        severity: Alert severity — 'low', 'medium', or 'high'.

    Returns:
        dict with status and delivery details.
    """
    logger.info("send_email_alert to %s: [%s] %s", recipient_email, severity, subject)

    # TODO: Integrate with email service (SendGrid, SES, or Cloud Tasks)
    return {
        "status": "success",
        "recipient": recipient_email,
        "channel": "email",
        "message": "Email alert placeholder — email service integration pending",
    }


# ── Daily report logging ────────────────────────────────────────────────────


async def log_to_daily_report(
    signal_type: str,
    severity: str,
    observation: str,
    tool_context: ToolContext,
) -> dict:
    """Log an alert signal to the user's daily health report.

    Args:
        signal_type: Type of signal — 'emotional_distress', 'missed_medication', 'health_anomaly', or 'inactivity'.
        severity: Signal severity — 'low', 'medium', or 'high'.
        observation: Description of what was observed.

    Returns:
        dict with status and alert_id.
    """
    user_id = tool_context.state.get("user:user_id", "unknown")
    source = tool_context.state.get("temp:alert_source", "system")
    fs = get_firestore_service()

    alert_id = _new_id()
    alert = AlertDoc(
        alert_id=alert_id,
        user_id=user_id,
        type=signal_type,
        severity=severity,
        message=observation,
        source=source,
        created_at=_utcnow(),
    )

    await fs.create_alert(alert)
    logger.info("Logged alert %s for user %s: [%s] %s", alert_id, user_id, severity, signal_type)

    return {"status": "success", "alert_id": alert_id, "type": signal_type, "severity": severity}


# ── User baseline ───────────────────────────────────────────────────────────


async def get_user_baseline(
    tool_context: ToolContext,
) -> dict:
    """Get the user's baseline health data for comparison.

    Returns:
        dict with status and baseline health metrics.
    """
    user_id = tool_context.state.get("user:user_id", "unknown")
    fs = get_firestore_service()

    user = await fs.get_user(user_id)
    if not user:
        return {"status": "error", "error_message": f"User {user_id} not found"}

    # Get recent health logs to establish baseline
    from datetime import timedelta
    end_date = _utcnow().strftime("%Y-%m-%d")
    start_date = (_utcnow() - timedelta(days=7)).strftime("%Y-%m-%d")
    logs = await fs.get_health_logs(user_id, start_date, end_date)

    avg_mood = 0
    avg_pain = 0
    if logs:
        avg_mood = sum(log.mood_score for log in logs) / len(logs)
        avg_pain = sum(log.pain_level for log in logs) / len(logs)

    return {
        "status": "success",
        "user_name": user.name,
        "medications": user.medications,
        "avg_mood_score_7d": round(avg_mood, 1),
        "avg_pain_level_7d": round(avg_pain, 1),
        "total_logs_7d": len(logs),
    }


# ── Family contacts ─────────────────────────────────────────────────────────


async def get_family_contacts(
    tool_context: ToolContext,
) -> dict:
    """Retrieve family member contact information and notification preferences.

    Returns:
        dict with status and list of family contacts.
    """
    user_id = tool_context.state.get("user:user_id", "unknown")
    fs = get_firestore_service()

    links = await fs.get_family_links_for_elderly(user_id)
    contacts = []
    for link in links:
        family_user = await fs.get_user(link.family_user_id)
        if family_user:
            contacts.append({
                "uid": link.family_user_id,
                "name": family_user.name,
                "relationship": link.relationship,
                "permissions": link.permissions,
                "fcm_token": family_user.fcm_token,
            })

    return {"status": "success", "contacts": contacts, "count": len(contacts)}


# ── Alert escalation ────────────────────────────────────────────────────────


async def escalate_alert(
    alert_id: str,
    tool_context: ToolContext,
) -> dict:
    """Escalate an alert — increase severity and send urgent notifications.

    Args:
        alert_id: The ID of the alert to escalate.

    Returns:
        dict with escalation status and notification results.
    """
    fs = get_firestore_service()
    fcm = get_fcm_service()

    # Find the alert
    ref = fs.db.collection("alerts").document(alert_id)
    doc = ref.get()
    if not doc.exists:
        return {"status": "error", "error_message": f"Alert {alert_id} not found"}

    alert_data = doc.to_dict()
    current_severity = alert_data.get("severity", "low")
    user_id = alert_data.get("user_id", "unknown")

    # Escalate severity
    severity_order = ["low", "medium", "high"]
    current_idx = severity_order.index(current_severity) if current_severity in severity_order else 0
    new_severity = severity_order[min(current_idx + 1, len(severity_order) - 1)]

    ref.update({
        "severity": new_severity,
        "escalated_at": _utcnow(),
    })

    # Send urgent notification to all family members
    user = await fs.get_user(user_id)
    user_name = user.name if user else "Your loved one"
    alert_type = alert_data.get("type", "unknown").replace("_", " ").title()

    notification_result = await fcm.send_to_family(
        elderly_user_id=user_id,
        title=f"Escalated: {alert_type}",
        body=f"{user_name} — {alert_data.get('message', 'Alert escalated')}",
        notification_type="alert",
        data={"alert_id": alert_id, "severity": new_severity, "escalated": "true"},
        urgent=True,
    )

    logger.info("Alert %s escalated from %s to %s", alert_id, current_severity, new_severity)

    return {
        "status": "success",
        "alert_id": alert_id,
        "previous_severity": current_severity,
        "new_severity": new_severity,
        "notification": notification_result,
    }
