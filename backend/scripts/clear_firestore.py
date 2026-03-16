"""Delete ALL documents from ALL collections in Firestore.

Usage:
    cd backend
    python scripts/clear_firestore.py
"""

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from dotenv import load_dotenv

load_dotenv()

import firebase_admin
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


def delete_collection(coll_ref, batch_size=100):
    """Delete all documents in a collection (and subcollections)."""
    deleted = 0
    while True:
        docs = list(coll_ref.limit(batch_size).stream())
        if not docs:
            break
        for doc in docs:
            # Recursively delete subcollections
            for subcoll in doc.reference.collections():
                delete_collection(subcoll, batch_size)
            doc.reference.delete()
            deleted += 1
    return deleted


def main():
    init_firebase()
    db = firestore.client()

    collections = list(db.collections())
    if not collections:
        print("No collections found. Database is already empty.")
        return

    print(f"Found {len(collections)} top-level collections:")
    for coll in collections:
        print(f"  - {coll.id}")

    print()
    total = 0
    for coll in collections:
        count = delete_collection(coll)
        print(f"  Deleted {count} documents from '{coll.id}'")
        total += count

    print(f"\nDone. Deleted {total} documents total.")


if __name__ == "__main__":
    main()
