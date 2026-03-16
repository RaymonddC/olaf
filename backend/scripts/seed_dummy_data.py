"""Seed Firestore with dummy data for dashboard testing.

Creates:
- 1 family member (uses existing Firebase Auth from Google login)
- 1 elderly user with health logs, reminders, conversations, alerts

Usage:
    cd backend
    python scripts/seed_dummy_data.py --family-uid <YOUR_FAMILY_UID>

Get your family UID from Firebase Auth console or from the /api/auth/me response.
"""

import argparse
import os
import sys
import uuid
from datetime import UTC, datetime, timedelta

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from dotenv import load_dotenv

load_dotenv()

import firebase_admin
from firebase_admin import auth as firebase_auth
from firebase_admin import credentials, firestore


def init_firebase():
    if firebase_admin._apps:
        return
    cred_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
    private_key = os.getenv("FIREBASE_ADMIN_PRIVATE_KEY")
    if cred_path:
        cred = credentials.Certificate(cred_path)
        firebase_admin.initialize_app(cred)
    elif private_key:
        cred = credentials.Certificate(
            {
                "type": "service_account",
                "project_id": os.getenv("FIREBASE_ADMIN_PROJECT_ID", "").strip(),
                "private_key": private_key.replace("\\n", "\n"),
                "client_email": os.getenv("FIREBASE_ADMIN_CLIENT_EMAIL", "").strip(),
                "token_uri": "https://oauth2.googleapis.com/token",
            }
        )
        firebase_admin.initialize_app(cred)
    else:
        firebase_admin.initialize_app()


def gen_id():
    return uuid.uuid4().hex[:20]


def main():
    parser = argparse.ArgumentParser(description="Seed dummy data for OLAF dashboard")
    parser.add_argument("--family-uid", required=True, help="Firebase UID of the family member")
    args = parser.parse_args()

    family_uid = args.family_uid
    init_firebase()
    db = firestore.client()
    now = datetime.now(UTC)

    # ── 1. Create elderly Firebase Auth user ──────────────────────────────────
    elder_username = "grandma.margaret"
    elder_email = f"{elder_username}@olaf.app"
    elder_password = "Olaf123456"

    try:
        elder_user = firebase_auth.get_user_by_email(elder_email)
        elder_uid = elder_user.uid
        print(f"Elder user already exists: {elder_uid}")
    except firebase_auth.UserNotFoundError:
        elder_user = firebase_auth.create_user(
            email=elder_email,
            password=elder_password,
            display_name="Margaret Thompson",
        )
        elder_uid = elder_user.uid
        print(f"Created elder user: {elder_uid}")

    # ── 2. User profiles ─────────────────────────────────────────────────────
    # Family profile
    db.collection("users").document(family_uid).set(
        {
            "uid": family_uid,
            "role": "family",
            "name": "Family Member",
            "username": None,
            "age": None,
            "timezone": "Asia/Kuala_Lumpur",
            "language": "en",
            "medications": [],
            "profile_complete": True,
            "fcm_token": None,
            "created_at": now.isoformat(),
            "updated_at": now.isoformat(),
        },
        merge=True,
    )
    print("Set family profile")

    # Elder profile
    db.collection("users").document(elder_uid).set(
        {
            "uid": elder_uid,
            "role": "elderly",
            "name": "Margaret Thompson",
            "username": elder_username,
            "age": 74,
            "timezone": "Asia/Kuala_Lumpur",
            "language": "en",
            "medications": ["Metformin 500mg", "Lisinopril 10mg", "Vitamin D"],
            "profile_complete": True,
            "fcm_token": None,
            "created_at": (now - timedelta(days=30)).isoformat(),
            "updated_at": now.isoformat(),
        }
    )
    print("Set elder profile")

    # ── 3. Family link ────────────────────────────────────────────────────────
    link_id = f"{family_uid}_{elder_uid}"
    db.collection("familyLinks").document(link_id).set(
        {
            "link_id": link_id,
            "elderly_user_id": elder_uid,
            "family_user_id": family_uid,
            "family_name": "Family Member",
            "relationship": "daughter",
            "permissions": ["view_health", "view_alerts", "view_memories"],
            "created_at": (now - timedelta(days=30)).isoformat(),
        }
    )
    print("Set family link")

    # ── 4. Health logs (past 14 days) ─────────────────────────────────────────
    moods = [
        "happy", "good", "okay", "tired", "good", "happy", "okay",
        "anxious", "good", "happy", "tired", "okay", "good", "happy",
    ]
    pain_levels = [2, 1, 3, 4, 2, 1, 3, 5, 2, 1, 4, 3, 2, 1]

    for i in range(14):
        day = now - timedelta(days=13 - i)
        date_str = day.strftime("%Y-%m-%d")
        mood = moods[i % len(moods)]
        mood_scores = {"happy": 9, "good": 7, "okay": 5, "tired": 4, "anxious": 3, "sad": 2}
        pain = pain_levels[i % len(pain_levels)]

        meds_taken = []
        if i % 3 != 2:  # skip meds every 3rd day
            meds_taken = [
                {"name": "Metformin 500mg", "time": "08:00", "confirmed": True},
                {"name": "Lisinopril 10mg", "time": "08:00", "confirmed": True},
                {"name": "Vitamin D", "time": "12:00", "confirmed": i % 2 == 0},
            ]

        db.collection("users").document(elder_uid).collection("healthLogs").document(date_str).set(
            {
                "date": date_str,
                "mood": mood,
                "mood_score": mood_scores.get(mood, 5),
                "pain_level": pain,
                "medications_taken": meds_taken,
                "hydration_sent": 4,
                "hydration_acknowledged": 2 + (i % 3),
                "activity_notes": "",
                "notes": "",
                "created_at": day.isoformat(),
            }
        )
    print("Created 14 health logs")

    # ── 5. Conversations (past 10 days, skip a couple) ────────────────────────
    conv_days = [0, 1, 2, 4, 5, 7, 8, 10, 12, 13]  # days ago
    summaries = [
        "Margaret talked about her garden and how the roses are blooming.",
        "Discussed her morning walk and the neighbor's new dog.",
        "Margaret shared memories of baking with her mother.",
        "Talked about upcoming doctor appointment on Thursday.",
        "Margaret was feeling a bit tired but enjoyed talking about her grandchildren.",
        "Discussed her favorite TV show and the latest episode.",
        "Margaret mentioned some knee pain but was in good spirits.",
        "Talked about the weather and her plans for the weekend.",
        "Margaret recalled a holiday trip to the beach from years ago.",
        "Had a cheerful chat about her puzzle hobby.",
    ]

    for idx, days_ago in enumerate(conv_days):
        conv_time = now - timedelta(days=days_ago, hours=10 - idx % 3)
        conv_id = gen_id()
        db.collection("users").document(elder_uid).collection("conversations").document(conv_id).set(
            {
                "conversation_id": conv_id,
                "summary": summaries[idx],
                "mood_score": 5 + (idx % 5),
                "session_duration": 300 + (idx * 60),
                "flags": [],
                "transcript_count": 10 + idx * 3,
                "created_at": conv_time.isoformat(),
            }
        )
    print(f"Created {len(conv_days)} conversations")

    # ── 6. Reminders ──────────────────────────────────────────────────────────
    reminders = [
        {"type": "medication", "message": "Take Metformin 500mg", "status": "pending", "hour": 8},
        {"type": "medication", "message": "Take Lisinopril 10mg", "status": "pending", "hour": 8},
        {"type": "medication", "message": "Take Vitamin D", "status": "pending", "hour": 12},
        {"type": "appointment", "message": "Doctor appointment at KPJ", "status": "pending", "hour": 14},
        {"type": "hydration", "message": "Drink a glass of water", "status": "acknowledged", "hour": 10},
        {"type": "custom", "message": "Call daughter after lunch", "status": "acknowledged", "hour": 13},
    ]

    for r in reminders:
        rid = gen_id()
        sched = now.replace(hour=r["hour"], minute=0, second=0, microsecond=0)
        db.collection("users").document(elder_uid).collection("reminders").document(rid).set(
            {
                "reminder_id": rid,
                "type": r["type"],
                "message": r["message"],
                "scheduled_time": sched.isoformat(),
                "status": r["status"],
                "recurring": r["type"] == "medication",
                "recurrence_pattern": None,
                "created_at": (now - timedelta(days=1)).isoformat(),
            }
        )
    print(f"Created {len(reminders)} reminders")

    # ── 7. Alerts ─────────────────────────────────────────────────────────────
    alerts = [
        {
            "type": "missed_medication",
            "severity": "medium",
            "message": "Margaret missed her Vitamin D yesterday.",
            "source": "system",
            "acknowledged": False,
            "days_ago": 0,
        },
        {
            "type": "emotional_distress",
            "severity": "low",
            "message": "Margaret seemed a bit anxious during today's conversation.",
            "source": "companion",
            "acknowledged": False,
            "days_ago": 1,
        },
        {
            "type": "health_anomaly",
            "severity": "high",
            "message": "Pain level reported as 5/10, higher than usual average of 2.",
            "source": "companion",
            "acknowledged": False,
            "days_ago": 2,
        },
        {
            "type": "inactivity",
            "severity": "low",
            "message": "No conversation recorded on Wednesday.",
            "source": "system",
            "acknowledged": True,
            "days_ago": 5,
        },
    ]

    for a in alerts:
        aid = gen_id()
        created = now - timedelta(days=a["days_ago"])
        doc = {
            "alert_id": aid,
            "user_id": elder_uid,
            "type": a["type"],
            "severity": a["severity"],
            "message": a["message"],
            "source": a["source"],
            "acknowledged": a["acknowledged"],
            "acknowledged_by": None,
            "acknowledged_at": None,
            "created_at": created.isoformat(),
        }
        if a["acknowledged"]:
            doc["acknowledged_by"] = family_uid
            doc["acknowledged_at"] = (created + timedelta(hours=2)).isoformat()
        db.collection("alerts").document(aid).set(doc)
    print(f"Created {len(alerts)} alerts")

    # ── Done ──────────────────────────────────────────────────────────────────
    print("\n" + "=" * 50)
    print("Dummy data seeded successfully!")
    print("=" * 50)
    print("\nElder login credentials:")
    print(f"  Username: {elder_username}")
    print(f"  Password: {elder_password}")
    print(f"  Elder UID: {elder_uid}")
    print(f"  Family UID: {family_uid}")


if __name__ == "__main__":
    main()
