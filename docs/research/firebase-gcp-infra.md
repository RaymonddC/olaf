# Firebase & GCP Infrastructure Research for OLAF

**Date:** 2026-02-28
**Purpose:** Comprehensive research on all Firebase/GCP services needed for OLAF AI elderly care companion.

---

## Table of Contents

1. [Firebase Authentication](#1-firebase-authentication)
2. [Cloud Firestore](#2-cloud-firestore)
3. [Firestore Security Rules](#3-firestore-security-rules)
4. [Firebase Cloud Messaging (FCM)](#4-firebase-cloud-messaging-fcm)
5. [Cloud Run (Python Backend)](#5-cloud-run-python-backend)
6. [Cloud Run WebSocket Support](#6-cloud-run-websocket-support)
7. [Vertex AI Imagen](#7-vertex-ai-imagen)
8. [Cloud Storage & Signed URLs](#8-cloud-storage--signed-urls)
9. [Cloud Scheduler](#9-cloud-scheduler)
10. [Cost Estimation](#10-cost-estimation)
11. [Infrastructure Compatibility Analysis](#11-infrastructure-compatibility-analysis)
12. [Setup Checklist](#12-setup-checklist)

---

## 1. Firebase Authentication

### Overview

Firebase Auth provides backend services, SDKs, and UI libraries to authenticate users. Supports email/password, Google SSO, and many other identity providers. For OLAF, we need email/password + Google SSO for both elderly users and family members.

### Frontend Setup (Next.js)

```typescript
// lib/firebase.ts
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword } from "firebase/auth";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Google SSO
const googleProvider = new GoogleAuthProvider();
export const signInWithGoogle = () => signInWithPopup(auth, googleProvider);

// Email/password
export const signUpWithEmail = (email: string, password: string) =>
  createUserWithEmailAndPassword(auth, email, password);
export const signInWithEmail = (email: string, password: string) =>
  signInWithEmailAndPassword(auth, email, password);

// Get ID token for backend calls
export const getIdToken = async (): Promise<string> => {
  const user = auth.currentUser;
  if (!user) throw new Error("Not authenticated");
  return user.getIdToken();
};
```

### Python Backend Token Verification

The Firebase Admin SDK's `verify_id_token()` is the standard way to verify tokens on a Python backend.

```python
# auth/firebase_auth.py
import firebase_admin
from firebase_admin import auth, credentials
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

# Initialize Firebase Admin SDK
# Option 1: Explicit service account (local dev)
cred = credentials.Certificate("service-account.json")
firebase_admin.initialize_app(cred)

# Option 2: Application Default Credentials (Cloud Run — preferred)
# firebase_admin.initialize_app()
# Cloud Run automatically provides credentials via the service account

security = HTTPBearer()

async def get_current_user(
    cred: HTTPAuthorizationCredentials = Depends(security),
) -> dict:
    """FastAPI dependency that verifies Firebase ID token."""
    try:
        decoded_token = auth.verify_id_token(cred.credentials)
        return decoded_token
    except auth.InvalidIdTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token",
        )
    except auth.ExpiredIdTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired",
        )
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication failed",
        )

# Usage in FastAPI endpoints
# @app.get("/api/health-logs")
# async def get_health_logs(user: dict = Depends(get_current_user)):
#     uid = user["uid"]
#     ...
```

**Key points:**
- On Cloud Run, use Application Default Credentials (no service account file needed)
- `verify_id_token()` checks signature, expiration, audience, issuer
- Returns decoded token with `uid`, `email`, `name`, custom claims
- Set `check_revoked=True` for extra security (adds a network call to Firebase)
- The `GOOGLE_APPLICATION_CREDENTIALS` env var should point to the service account JSON in local dev

### Custom Claims for Family Roles

Firebase custom claims allow role-based access without extra DB queries:

```python
# Set custom claims when linking family member
auth.set_custom_user_claims(family_user_uid, {
    "role": "family_member",
    "linked_elderly_users": ["elderly_user_id_1", "elderly_user_id_2"],
})

# Set custom claims for elderly user
auth.set_custom_user_claims(elderly_user_uid, {
    "role": "elderly_user",
})
```

Claims are included in the ID token and can be checked in Firestore security rules.

### Firebase Auth Pricing

- **Free:** 50,000 MAU for email/password, unlimited for Google SSO
- **Blaze plan (overage):** $0.0055/MAU beyond 50K for email/password
- For hackathon demo: **$0** (well within free tier)

---

## 2. Cloud Firestore

### Data Model Fundamentals

Firestore is a NoSQL document database organized into:
- **Documents:** Key-value containers (max 1MB each)
- **Collections:** Groups of documents
- **Subcollections:** Collections nested under documents
- **References:** Pointers to documents/collections

**Key constraints:**
- Document IDs must be unique within a collection
- Max document size: 1 MiB
- Max depth of subcollections: 100 levels
- Max writes per second per document: 1
- Max field nesting: 20 levels

### OLAF Data Model Validation

The design doc's Firestore schema is well-structured. Here's the validated model with annotations:

```
users/{userId}                          ← Top-level: 1 doc per user
  profile: { name, age, timezone, ... } ← Embedded doc (good: read together)
  settings: { ... }                     ← Embedded doc (good: read together)

  conversations/{convoId}               ← Subcollection (good: query independently)
  memories/{memoryId}                   ← Subcollection (good: paginate)
  healthLogs/{date}                     ← Subcollection, date as ID (good: range queries)
  reports/{reportId}                    ← Subcollection (good: paginate)
  reminders/{reminderId}                ← Subcollection (good: query by status)

familyLinks/{linkId}                    ← Top-level collection for cross-user queries
alerts/{alertId}                        ← Top-level collection for cross-user queries
```

**Assessment:** Schema is correct for OLAF's use case. Subcollections for conversations, memories, and health logs are the right pattern — they allow independent querying and pagination without loading the entire user document.

### Firestore Python SDK (Server-Side)

```python
# db/firestore_client.py
from google.cloud import firestore

db = firestore.Client()

# Write a health log
def save_health_log(user_id: str, date: str, data: dict):
    doc_ref = db.collection("users").document(user_id) \
                .collection("healthLogs").document(date)
    doc_ref.set(data)

# Read conversations with ordering and limit
def get_recent_conversations(user_id: str, limit: int = 10):
    convos_ref = db.collection("users").document(user_id) \
                   .collection("conversations")
    docs = convos_ref.order_by("timestamp", direction=firestore.Query.DESCENDING) \
                     .limit(limit).stream()
    return [doc.to_dict() for doc in docs]

# Query family links for a user
def get_family_members(elderly_user_id: str):
    links = db.collection("familyLinks") \
              .where("elderlyUserId", "==", elderly_user_id).stream()
    return [link.to_dict() for link in links]

# Real-time listener (for alerts)
def on_new_alert(user_id: str, callback):
    query = db.collection("alerts") \
              .where("userId", "==", user_id) \
              .where("acknowledged", "==", False)
    query.on_snapshot(callback)
```

### Firestore Pricing

| Resource | Free Tier (daily) | Blaze Pay-As-You-Go |
|---|---|---|
| Document reads | 50,000/day | $0.06 per 100K reads |
| Document writes | 20,000/day | $0.18 per 100K writes |
| Document deletes | 20,000/day | $0.02 per 100K deletes |
| Stored data | 1 GiB total | $0.18/GiB/month |
| Network egress | 10 GiB/month | $0.12/GiB (after 10 GiB) |

---

## 3. Firestore Security Rules

### OLAF Security Rules Design

The key challenge is multi-tenant family access: elderly users own their data, but linked family members need read access to specific subcollections.

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Helper: Check if the requester is the document owner
    function isOwner(userId) {
      return request.auth != null && request.auth.uid == userId;
    }

    // Helper: Check if requester is a linked family member
    function isFamilyMember(elderlyUserId) {
      return request.auth != null &&
        exists(/databases/$(database)/documents/familyLinks/$(request.auth.uid + '_' + elderlyUserId));
    }

    // Helper: Check family member has specific permission
    function hasFamilyPermission(elderlyUserId, permission) {
      let link = get(/databases/$(database)/documents/familyLinks/$(request.auth.uid + '_' + elderlyUserId));
      return link != null && permission in link.data.permissions;
    }

    // Alternative: Use custom claims (faster, no extra reads)
    function isFamilyViaClaims(elderlyUserId) {
      return request.auth != null &&
        request.auth.token.role == "family_member" &&
        elderlyUserId in request.auth.token.linked_elderly_users;
    }

    // ──── User Profile & Settings ────
    match /users/{userId} {
      // Owner can read/write their own profile
      allow read, write: if isOwner(userId);
      // Family members can read profile (for display name, etc.)
      allow read: if isFamilyViaClaims(userId);

      // ──── Conversations ────
      match /conversations/{convoId} {
        allow read, write: if isOwner(userId);
        allow read: if isFamilyViaClaims(userId);
      }

      // ──── Memories ────
      match /memories/{memoryId} {
        allow read, write: if isOwner(userId);
        allow read: if isFamilyViaClaims(userId);
      }

      // ──── Health Logs ────
      match /healthLogs/{date} {
        allow read, write: if isOwner(userId);
        allow read: if isFamilyViaClaims(userId);
      }

      // ──── Reports ────
      match /reports/{reportId} {
        allow read, write: if isOwner(userId);
        allow read: if hasFamilyPermission(userId, "view_reports");
      }

      // ──── Reminders ────
      match /reminders/{reminderId} {
        allow read, write: if isOwner(userId);
      }
    }

    // ──── Family Links ────
    match /familyLinks/{linkId} {
      // Either the elderly user or the family member can read
      allow read: if request.auth != null &&
        (request.auth.uid == resource.data.elderlyUserId ||
         request.auth.uid == resource.data.familyUserId);
      // Only the elderly user (or admin/backend) can create/modify
      allow write: if request.auth != null &&
        request.auth.uid == resource.data.elderlyUserId;
    }

    // ──── Alerts ────
    match /alerts/{alertId} {
      // Owner can read their alerts
      allow read: if request.auth != null &&
        request.auth.uid == resource.data.userId;
      // Family members can read alerts for linked users
      allow read: if isFamilyViaClaims(resource.data.userId);
      // Only backend writes alerts (via Admin SDK, bypasses rules)
      allow write: if false;
    }
  }
}
```

### Design Decision: Custom Claims vs. Document Lookups

| Approach | Pros | Cons |
|---|---|---|
| Custom claims (`request.auth.token`) | No extra Firestore reads, fast | Max 1000 bytes, requires backend to update, propagates on next token refresh |
| Document lookups (`exists()`/`get()`) | Real-time, no size limit | Extra Firestore reads per rule evaluation (costs $), max 10 lookups per rule |

**Recommendation for OLAF:** Use custom claims for the primary family linkage (it's a short list of user IDs). Use document lookups only for granular permission checks (e.g., `hasFamilyPermission`). This minimizes read costs.

**Important:** Custom claims have a max size of 1000 bytes. For OLAF, storing a list of linked elderly user IDs is fine (each UID is ~28 chars, so ~35 linked users max). If a family member has more than ~35 linked users, fall back to document lookups.

---

## 4. Firebase Cloud Messaging (FCM)

### Overview

FCM delivers push notifications to web browsers. Required for OLAF's AlertAgent to notify family members of emotional distress, missed medications, and health anomalies.

### PWA Service Worker Setup

```javascript
// public/firebase-messaging-sw.js
// MUST be in the root of the public directory
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "...",
  authDomain: "...",
  projectId: "...",
  storageBucket: "...",
  messagingSenderId: "...",
  appId: "...",
});

const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
  const notificationTitle = payload.notification?.title || "OLAF Alert";
  const notificationOptions = {
    body: payload.notification?.body || "",
    icon: "/icons/olaf-icon-192.png",
    badge: "/icons/olaf-badge-72.png",
    tag: payload.data?.alertType || "general",
    data: payload.data,
    // For urgent alerts, require interaction
    requireInteraction: payload.data?.severity === "high",
    actions: [
      { action: "view", title: "View Details" },
      { action: "dismiss", title: "Dismiss" },
    ],
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
```

### Frontend FCM Integration (Next.js)

```typescript
// lib/fcm.ts
import { getMessaging, getToken, onMessage } from "firebase/messaging";
import { app } from "./firebase";

const VAPID_KEY = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;

export async function requestNotificationPermission(): Promise<string | null> {
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return null;

  const messaging = getMessaging(app);
  const token = await getToken(messaging, { vapidKey: VAPID_KEY });

  // Send token to backend for storage
  await fetch("/api/fcm/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token }),
  });

  return token;
}

export function onForegroundMessage(callback: (payload: any) => void) {
  const messaging = getMessaging(app);
  return onMessage(messaging, callback);
}
```

### Backend: Sending Notifications (Python)

```python
# notifications/fcm.py
from firebase_admin import messaging

def send_alert_notification(
    fcm_token: str,
    title: str,
    body: str,
    severity: str = "medium",
    alert_id: str = "",
    data: dict | None = None,
):
    """Send push notification via FCM."""
    message = messaging.Message(
        notification=messaging.Notification(
            title=title,
            body=body,
        ),
        data={
            "severity": severity,
            "alertId": alert_id,
            "alertType": data.get("type", "general") if data else "general",
            "click_action": f"/alerts/{alert_id}",
            **(data or {}),
        },
        token=fcm_token,
        webpush=messaging.WebpushConfig(
            notification=messaging.WebpushNotification(
                icon="/icons/olaf-icon-192.png",
                badge="/icons/olaf-badge-72.png",
                require_interaction=severity == "high",
            ),
            fcm_options=messaging.WebpushFCMOptions(
                link=f"/alerts/{alert_id}",
            ),
        ),
    )
    response = messaging.send(message)
    return response

def send_to_family(elderly_user_id: str, title: str, body: str, severity: str):
    """Send notification to all linked family members."""
    # Get all FCM tokens for family members from Firestore
    from db.firestore_client import get_family_fcm_tokens
    tokens = get_family_fcm_tokens(elderly_user_id)

    if not tokens:
        return

    message = messaging.MulticastMessage(
        notification=messaging.Notification(title=title, body=body),
        data={"severity": severity, "elderlyUserId": elderly_user_id},
        tokens=tokens,
    )
    response = messaging.send_each_for_multicast(message)
    return response
```

### VAPID Key Setup

1. Firebase Console → Project Settings → Cloud Messaging → Web Push certificates
2. Click "Generate Key Pair"
3. Copy the public key → set as `NEXT_PUBLIC_FIREBASE_VAPID_KEY`
4. The private key is managed by Firebase automatically

### FCM Pricing

- **Completely free.** No per-message costs, no limits on number of messages.
- FCM is free for all Firebase plans (Spark and Blaze).

---

## 5. Cloud Run (Python Backend)

### Deployment Configuration

Cloud Run deploys from source code or Docker containers. For OLAF, we use a Dockerfile since we need Playwright (headless browser) for NavigatorAgent.

#### Dockerfile

```dockerfile
# Dockerfile
FROM python:3.12-slim

# Install system dependencies for Playwright
RUN apt-get update && apt-get install -y \
    wget \
    gnupg \
    && rm -rf /var/lib/apt/lists/*

# Install Playwright system deps
RUN pip install playwright && playwright install --with-deps chromium

WORKDIR /app

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Cloud Run sets PORT env variable
ENV PORT=8080
EXPOSE 8080

# Run with gunicorn for production
# Use uvicorn workers for async support (FastAPI)
CMD ["gunicorn", "main:app", \
     "--bind", "0.0.0.0:8080", \
     "--worker-class", "uvicorn.workers.UvicornWorker", \
     "--workers", "1", \
     "--threads", "8", \
     "--timeout", "3600"]
```

**Note:** `--workers 1` with `--threads 8` because:
- Cloud Run handles scaling via container instances (not processes)
- Playwright needs to share browser context within a single process
- `--timeout 3600` for long-running WebSocket connections (up to 60 min)

#### requirements.txt

```
# Web framework
fastapi>=0.115.0
uvicorn>=0.32.0
gunicorn>=23.0.0

# Firebase/GCP
firebase-admin>=6.6.0
google-cloud-firestore>=2.19.0
google-cloud-storage>=2.18.0
google-cloud-aiplatform>=1.74.0
google-genai>=1.0.0

# Google ADK
google-adk>=1.0.0

# Headless browser for NavigatorAgent
playwright>=1.49.0

# WebSocket support
websockets>=13.1

# Utilities
python-dotenv>=1.0.0
httpx>=0.28.0
pydantic>=2.10.0
```

#### Deployment Commands

```bash
# Set project
gcloud config set project olaf-hackathon

# Enable required APIs
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  firestore.googleapis.com \
  storage.googleapis.com \
  aiplatform.googleapis.com \
  cloudscheduler.googleapis.com \
  fcm.googleapis.com

# Deploy from source (auto-builds container)
gcloud run deploy olaf-backend \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --memory 2Gi \
  --cpu 2 \
  --timeout 3600 \
  --concurrency 100 \
  --min-instances 0 \
  --max-instances 5 \
  --set-env-vars "GOOGLE_CLOUD_PROJECT=olaf-hackathon"

# Or deploy with pre-built image
gcloud run deploy olaf-backend \
  --image us-central1-docker.pkg.dev/olaf-hackathon/olaf/backend:latest \
  --region us-central1 \
  --allow-unauthenticated \
  --memory 2Gi \
  --cpu 2 \
  --timeout 3600
```

### Environment Variables for Cloud Run

```bash
# Set via gcloud or Cloud Console
GOOGLE_CLOUD_PROJECT=olaf-hackathon
GOOGLE_CLOUD_LOCATION=us-central1
FIREBASE_PROJECT_ID=olaf-hackathon
GCS_BUCKET_NAME=olaf-artifacts
GEMINI_API_KEY=<for ephemeral token generation>
ALLOWED_ORIGINS=https://olaf.vercel.app,http://localhost:3000
```

### IAM & Service Account

Cloud Run uses a service account for GCP API access. The default Compute Engine service account works for hackathon, but create a dedicated one for better security:

```bash
# Create service account
gcloud iam service-accounts create olaf-backend \
  --display-name "OLAF Backend Service Account"

# Grant roles
gcloud projects add-iam-policy-binding olaf-hackathon \
  --member "serviceAccount:olaf-backend@olaf-hackathon.iam.gserviceaccount.com" \
  --role "roles/datastore.user"          # Firestore

gcloud projects add-iam-policy-binding olaf-hackathon \
  --member "serviceAccount:olaf-backend@olaf-hackathon.iam.gserviceaccount.com" \
  --role "roles/storage.objectAdmin"     # Cloud Storage

gcloud projects add-iam-policy-binding olaf-hackathon \
  --member "serviceAccount:olaf-backend@olaf-hackathon.iam.gserviceaccount.com" \
  --role "roles/aiplatform.user"         # Vertex AI

gcloud projects add-iam-policy-binding olaf-hackathon \
  --member "serviceAccount:olaf-backend@olaf-hackathon.iam.gserviceaccount.com" \
  --role "roles/firebase.sdkAdminServiceAgent"  # Firebase Admin
```

---

## 6. Cloud Run WebSocket Support

### Key Finding: Cloud Run Fully Supports WebSockets

**WebSockets work on Cloud Run with no additional configuration.** This is critical for OLAF's NavigatorAgent (screenshot streaming) and potential real-time features.

### Configuration Requirements

| Setting | Recommended Value | Reason |
|---|---|---|
| Request timeout | 3600s (60 min max) | Keep WebSocket connections open for navigator sessions |
| Session affinity | Enabled | Route client to same instance during session |
| Concurrency | 100 | Support multiple concurrent WebSocket connections |
| HTTP/2 end-to-end | **Disabled** | Incompatible with WebSocket on Cloud Run |
| Min instances | 0 (hackathon) / 1 (prod) | Cold start adds ~5-10s for Playwright container |

### Important Limitations

1. **60-minute max connection lifetime.** Clients must implement automatic reconnection. For NavigatorAgent sessions, this is fine (typical session < 15 min).

2. **Billing:** A Cloud Run instance with any open WebSocket connection is considered active, so CPU is always allocated and billed as instance-based billing.

3. **Session affinity is best-effort.** WebSocket connections may occasionally route to different instances. For NavigatorAgent, this is fine since each session is self-contained.

4. **No built-in pub/sub for multi-instance sync.** If multiple instances need to share WebSocket state, use Memorystore (Redis). For OLAF hackathon, a single instance is sufficient.

### WebSocket Implementation for NavigatorAgent

```python
# api/navigator_ws.py
from fastapi import WebSocket, WebSocketDisconnect, Depends
from auth.firebase_auth import get_current_user_ws

@app.websocket("/ws/navigator/{session_id}")
async def navigator_websocket(
    websocket: WebSocket,
    session_id: str,
):
    await websocket.accept()

    # Verify Firebase token sent as first message
    auth_message = await websocket.receive_json()
    try:
        user = auth.verify_id_token(auth_message["token"])
    except Exception:
        await websocket.close(code=4001, reason="Unauthorized")
        return

    try:
        # Start Playwright browser session
        async with async_playwright() as p:
            browser = await p.chromium.launch()
            page = await browser.new_page(viewport={"width": 1280, "height": 720})

            while True:
                # Receive commands from client
                command = await websocket.receive_json()

                if command["action"] == "navigate":
                    await page.goto(command["url"])
                elif command["action"] == "click":
                    await page.click(command["selector"])
                elif command["action"] == "type":
                    await page.fill(command["selector"], command["text"])
                elif command["action"] == "scroll":
                    await page.evaluate(f"window.scrollBy(0, {command['amount']})")

                # Take screenshot and send to client
                screenshot = await page.screenshot(type="jpeg", quality=80)
                await websocket.send_bytes(screenshot)

    except WebSocketDisconnect:
        pass
    finally:
        if browser:
            await browser.close()
```

### Compatibility Verdict

**Cloud Run WebSocket support is fully compatible with OLAF's NavigatorAgent design.** The 60-minute timeout is more than sufficient for browser navigation sessions. Screenshot streaming via WebSocket is the correct approach.

---

## 7. Vertex AI Imagen

### Model Options

| Model | Quality | Speed | Cost/Image | Best For |
|---|---|---|---|---|
| `imagen-3.0-generate-002` | High | Standard | ~$0.04 | Memory illustrations, storybook |
| `imagen-3.0-fast-generate-001` | Good | Fast | ~$0.02 | Daily health narrative images |
| `imagen-4.0-generate-001` | Highest | Standard | ~$0.04 | Premium illustrations |
| `imagen-4.0-fast-generate-001` | Good | Fast | ~$0.02 | Quick previews |

**Recommendation for OLAF:** Use `imagen-3.0-generate-002` for story illustrations and `imagen-3.0-fast-generate-001` for daily health narrative images. Imagen 3 is sufficient quality and cheaper.

### Python SDK Integration

There are two SDK options. The newer `google-genai` SDK is simpler:

#### Option A: google-genai SDK (Recommended)

```python
# services/imagen.py
import os
from google import genai
from google.genai.types import GenerateImagesConfig

# Initialize with Vertex AI backend
os.environ["GOOGLE_GENAI_USE_VERTEXAI"] = "True"
os.environ["GOOGLE_CLOUD_PROJECT"] = "olaf-hackathon"
os.environ["GOOGLE_CLOUD_LOCATION"] = "us-central1"

client = genai.Client()

async def generate_illustration(
    prompt: str,
    style: str = "warm watercolor",
    aspect_ratio: str = "4:3",
) -> bytes:
    """Generate illustration using Imagen 3."""
    full_prompt = f"{prompt}, {style} style, warm colors, gentle and comforting, suitable for elderly viewers"

    response = client.models.generate_images(
        model="imagen-3.0-generate-002",
        prompt=full_prompt,
        config=GenerateImagesConfig(
            number_of_images=1,
            aspect_ratio=aspect_ratio,
            safety_filter_level="block_medium_and_above",
            person_generation="allow_adult",
            add_watermark=False,  # Disable for storybook output
        ),
    )

    if response.generated_images:
        return response.generated_images[0].image._image_bytes
    raise Exception("Image generation failed or was filtered")
```

#### Option B: Vertex AI SDK (Legacy but stable)

```python
import vertexai
from vertexai.preview.vision_models import ImageGenerationModel

vertexai.init(project="olaf-hackathon", location="us-central1")
model = ImageGenerationModel.from_pretrained("imagen-3.0-generate-002")

def generate_illustration(prompt: str, style: str = "warm watercolor") -> bytes:
    full_prompt = f"{prompt}, {style} style, warm and gentle"
    response = model.generate_images(
        prompt=full_prompt,
        number_of_images=1,
        aspect_ratio="4:3",
    )
    return response.images[0]._image_bytes
```

### Integration with StorytellerAgent

```python
# Complete pipeline: generate illustration → upload to Cloud Storage → return URL
from google.cloud import storage

async def generate_and_store_illustration(
    user_id: str,
    prompt: str,
    style: str = "warm watercolor",
) -> str:
    """Generate illustration and upload to Cloud Storage, return signed URL."""
    image_bytes = await generate_illustration(prompt, style)

    # Upload to Cloud Storage
    client = storage.Client()
    bucket = client.bucket("olaf-artifacts")
    blob_name = f"illustrations/{user_id}/{uuid4()}.png"
    blob = bucket.blob(blob_name)
    blob.upload_from_string(image_bytes, content_type="image/png")

    # Generate signed URL (valid for 7 days)
    url = blob.generate_signed_url(
        version="v4",
        expiration=timedelta(days=7),
        method="GET",
    )
    return url
```

### Key Configuration

| Parameter | Recommended Value | Reason |
|---|---|---|
| `safety_filter_level` | `block_medium_and_above` | Allow artistic content, block inappropriate |
| `person_generation` | `allow_adult` | Needed for memory illustrations with people |
| `add_watermark` | `False` | Clean output for storybooks |
| `enhance_prompt` | `True` (default) | Improves quality for short prompts |
| `aspect_ratio` | `4:3` for illustrations, `16:9` for reports | Match display context |

### Imagen Pricing Estimate for OLAF

- Memory chapter: ~3 illustrations × $0.04 = $0.12
- Daily health narrative: 1 illustration × $0.02 = $0.02
- Weekly report: 2-3 illustrations × $0.02 = $0.06
- **Monthly estimate (1 active user):** ~$4-8/month
- **Hackathon demo:** < $5 total

---

## 8. Cloud Storage & Signed URLs

### Bucket Setup

```bash
# Create bucket
gsutil mb -l us-central1 gs://olaf-artifacts

# Set CORS for browser uploads (if needed)
gsutil cors set cors.json gs://olaf-artifacts
```

```json
// cors.json
[
  {
    "origin": ["https://olaf.vercel.app", "http://localhost:3000"],
    "method": ["GET", "PUT"],
    "responseHeader": ["Content-Type"],
    "maxAgeSeconds": 3600
  }
]
```

### Signed URLs for Secure Access

Signed URLs provide time-limited access to private objects without requiring authentication. Critical for serving generated illustrations and reports to family members.

```python
# storage/signed_urls.py
from datetime import timedelta
from google.cloud import storage

def generate_download_url(blob_name: str, expiration_hours: int = 24) -> str:
    """Generate a signed URL for downloading a file."""
    client = storage.Client()
    bucket = client.bucket("olaf-artifacts")
    blob = bucket.blob(blob_name)

    url = blob.generate_signed_url(
        version="v4",
        expiration=timedelta(hours=expiration_hours),
        method="GET",
    )
    return url

def generate_upload_url(blob_name: str, content_type: str = "image/png") -> str:
    """Generate a signed URL for uploading a file directly from browser."""
    client = storage.Client()
    bucket = client.bucket("olaf-artifacts")
    blob = bucket.blob(blob_name)

    url = blob.generate_signed_url(
        version="v4",
        expiration=timedelta(minutes=15),
        method="PUT",
        content_type=content_type,
    )
    return url
```

### Storage Structure

```
olaf-artifacts/
├── illustrations/
│   └── {userId}/
│       └── {imageId}.png
├── reports/
│   └── {userId}/
│       ├── daily/{date}.pdf
│       └── weekly/{weekStart}.pdf
├── storybooks/
│   └── {userId}/
│       └── {bookId}/
│           ├── cover.png
│           ├── chapters/
│           └── audio/
└── navigator-screenshots/
    └── {sessionId}/
        └── {timestamp}.jpg    ← Ephemeral, auto-delete after 24h
```

### Lifecycle Rules

```bash
# Auto-delete navigator screenshots after 1 day
gsutil lifecycle set lifecycle.json gs://olaf-artifacts
```

```json
{
  "rule": [
    {
      "action": {"type": "Delete"},
      "condition": {
        "age": 1,
        "matchesPrefix": ["navigator-screenshots/"]
      }
    }
  ]
}
```

### Cloud Storage Pricing

| Resource | Free Tier | Blaze Pay-As-You-Go |
|---|---|---|
| Storage | 5 GB-months (US regions) | $0.020/GB/month (Standard) |
| Class A ops (writes) | 5,000/month | $0.05 per 10K |
| Class B ops (reads) | 50,000/month | $0.004 per 10K |
| Network egress | 100 GB/month | $0.12/GB (after 100 GB) |

---

## 9. Cloud Scheduler

### Overview

Cloud Scheduler is a managed cron service for triggering Cloud Run endpoints on a schedule. OLAF needs it for:

1. **Daily health narrative generation** (StorytellerAgent)
2. **Weekly family report generation** (StorytellerAgent)
3. **Inactivity checks** (AlertAgent)
4. **Medication reminder checks** (AlertAgent)

### Setup

```bash
# Daily health narrative — 8 PM daily (after typical day ends)
gcloud scheduler jobs create http daily-health-narrative \
  --schedule="0 20 * * *" \
  --uri="https://olaf-backend-xxxxx-uc.a.run.app/api/cron/daily-narrative" \
  --http-method=POST \
  --headers="Content-Type=application/json" \
  --oidc-service-account-email="olaf-backend@olaf-hackathon.iam.gserviceaccount.com" \
  --location=us-central1

# Weekly family report — Sunday 9 AM
gcloud scheduler jobs create http weekly-family-report \
  --schedule="0 9 * * 0" \
  --uri="https://olaf-backend-xxxxx-uc.a.run.app/api/cron/weekly-report" \
  --http-method=POST \
  --headers="Content-Type=application/json" \
  --oidc-service-account-email="olaf-backend@olaf-hackathon.iam.gserviceaccount.com" \
  --location=us-central1

# Inactivity check — every 6 hours
gcloud scheduler jobs create http inactivity-check \
  --schedule="0 */6 * * *" \
  --uri="https://olaf-backend-xxxxx-uc.a.run.app/api/cron/inactivity-check" \
  --http-method=POST \
  --oidc-service-account-email="olaf-backend@olaf-hackathon.iam.gserviceaccount.com" \
  --location=us-central1
```

### Backend Cron Endpoints

```python
# api/cron.py
from fastapi import APIRouter, Request, HTTPException

router = APIRouter(prefix="/api/cron")

def verify_cloud_scheduler(request: Request):
    """Verify request comes from Cloud Scheduler via OIDC token."""
    # Cloud Scheduler sends OIDC token in Authorization header
    # Verified automatically if Cloud Run requires authentication
    # For --allow-unauthenticated services, verify manually
    pass

@router.post("/daily-narrative")
async def generate_daily_narratives():
    """Triggered daily by Cloud Scheduler."""
    # Get all users with daily narrative enabled
    users = get_users_with_daily_narrative()
    for user in users:
        await trigger_storyteller_agent(
            user_id=user["id"],
            task="daily_health_narrative",
        )
    return {"status": "ok", "users_processed": len(users)}

@router.post("/weekly-report")
async def generate_weekly_reports():
    """Triggered weekly by Cloud Scheduler."""
    users = get_users_with_weekly_report()
    for user in users:
        await trigger_storyteller_agent(
            user_id=user["id"],
            task="weekly_family_report",
        )
    return {"status": "ok", "users_processed": len(users)}

@router.post("/inactivity-check")
async def check_inactivity():
    """Check for inactive users and trigger alerts."""
    from datetime import datetime, timedelta
    inactive_users = get_users_inactive_since(
        since=datetime.utcnow() - timedelta(hours=24)
    )
    for user in inactive_users:
        await trigger_alert_agent(
            user_id=user["id"],
            signal_type="inactivity",
            severity="medium",
        )
    return {"status": "ok", "inactive_users": len(inactive_users)}
```

### Cloud Scheduler Pricing

- **Free tier:** 3 jobs per billing account per month
- **Beyond free tier:** $0.10/job/month
- OLAF needs 3 jobs → **$0** (exactly within free tier)

---

## 10. Cost Estimation

### Hackathon Demo Scale (2-4 weeks, 1-5 test users)

| Service | Usage Estimate | Free Tier Covers? | Estimated Cost |
|---|---|---|---|
| **Firebase Auth** | <10 users | Yes (50K MAU free) | $0 |
| **Firestore** | ~5K reads/day, ~1K writes/day | Yes (50K reads, 20K writes free daily) | $0 |
| **Cloud Storage** | ~500 MB images/reports | Yes (5 GB free) | $0 |
| **FCM** | ~50 notifications/day | Yes (always free) | $0 |
| **Cloud Run** | ~50 hours compute | Mostly (2M requests, 360K GB-seconds free) | $0-5 |
| **Cloud Scheduler** | 3 cron jobs | Yes (3 free) | $0 |
| **Vertex AI Imagen** | ~100 images total | No free tier | ~$2-4 |
| **Vertex AI (Gemini for ADK)** | ~1000 API calls | $300 credit covers | ~$5-10 (from credit) |
| **Artifact Registry** | Container images | Yes (0.5 GB free) | $0 |
| **Cloud Build** | 10-20 builds | Yes (2,500 min free) | $0 |

**Total estimated hackathon cost: $5-15** (covered by $300 GCP free trial credit)

### Production Scale (100 active elderly users, 200 family members)

| Service | Monthly Usage | Estimated Monthly Cost |
|---|---|---|
| **Firebase Auth** | 300 MAU | $0 |
| **Firestore** | ~500K reads, ~100K writes | ~$0.50 |
| **Cloud Storage** | ~50 GB | ~$1.00 |
| **FCM** | ~10K notifications | $0 |
| **Cloud Run** | ~720 hours (1 instance) | ~$30-50 |
| **Cloud Scheduler** | 3 jobs | $0 |
| **Vertex AI Imagen** | ~3000 images | ~$90-120 |
| **Vertex AI Gemini** | ~30K API calls | ~$30-60 |

**Estimated monthly production cost: $150-230**

### Cost Optimization Tips

1. **Use Imagen 3 Fast** for daily narratives (half the cost)
2. **Cache illustrations** — same prompt = same image, don't regenerate
3. **Set Cloud Run min-instances to 0** during hackathon (no idle billing)
4. **Use Firestore offline persistence** to reduce read counts
5. **Batch Firestore writes** when saving conversation logs

---

## 11. Infrastructure Compatibility Analysis

### Assessment of Design Doc Choices

| Decision | Verdict | Notes |
|---|---|---|
| Firestore for database | **Correct** | Perfect for nested user data model, real-time listeners for alerts, subcollection queries for health logs. No need for SQL. |
| Cloud Run for backend | **Correct** | Supports WebSocket, Python/FastAPI, Playwright. Auto-scaling. 60-min timeout sufficient. |
| Cloud Run WebSocket for Navigator | **Correct** | Full WebSocket support, 60-min max connection, screenshot streaming works well. |
| Firebase Auth | **Correct** | Email + Google SSO, token verification on backend, custom claims for family roles. |
| Cloud Storage for files | **Correct** | Signed URLs for secure access, lifecycle rules for cleanup. |
| FCM for push notifications | **Correct** | Free, PWA compatible, service worker setup straightforward. |
| Imagen 3 for illustrations | **Correct** | Good quality, reasonable cost. Use Fast variant for cost savings. |
| Cloud Scheduler for crons | **Correct** | 3 free jobs covers daily narrative + weekly report + inactivity check. |

### Potential Issues Identified

#### Issue 1: Cold Start with Playwright

**Problem:** Cloud Run cold starts with a Playwright container (Chromium) can take 10-30 seconds. This delays the first NavigatorAgent request.

**Mitigations:**
- Set `min-instances: 1` during demo (keeps one warm instance)
- Show a loading animation: "OLAF is preparing to help you navigate..."
- Pre-warm: send a health check request before user initiates navigation

#### Issue 2: Cloud Run Memory for Playwright

**Problem:** Chromium headless browser uses ~300-500MB RAM. Combined with Python/ADK, the container needs at least 1.5-2 GB.

**Fix:** Already accounted for in the Dockerfile config (`--memory 2Gi`). Could increase to 4Gi if needed.

#### Issue 3: Firestore 1-Write-Per-Second Per Document

**Problem:** If CompanionAgent logs conversation data frequently (every few seconds), the single-document write limit could be an issue.

**Fix:** Already handled correctly in the design — conversation transcripts are accumulated client-side and written once at session end. Health logs are per-day documents. No issue.

#### Issue 4: Signed URL Expiration for Storybook Images

**Problem:** Signed URLs expire. If a family member bookmarks a storybook page, images will stop loading after expiration.

**Fix:** Use Firebase Storage download URLs (permanent, token-based) instead of signed URLs for long-lived content like storybook illustrations. Reserve signed URLs for temporary content (navigator screenshots).

```python
# For permanent content (storybook images)
blob.make_public()  # If acceptable
# Or use Firebase Storage download URL pattern with security rules
```

---

## 12. Setup Checklist

### Phase 1: Project Setup (Day 1)

- [ ] Create Google Cloud project (`olaf-hackathon`)
- [ ] Enable billing (use $300 free trial credit)
- [ ] Enable APIs:
  - [ ] Cloud Run
  - [ ] Cloud Build
  - [ ] Firestore
  - [ ] Cloud Storage
  - [ ] Vertex AI
  - [ ] Cloud Scheduler
  - [ ] Firebase Auth
  - [ ] FCM
- [ ] Create Firebase project (link to GCP project)
- [ ] Create Firestore database (Native mode, `nam5` multi-region)
- [ ] Create Cloud Storage bucket (`olaf-artifacts`, US region)
- [ ] Create service account with required roles

### Phase 2: Authentication (Day 1-2)

- [ ] Enable Email/Password sign-in in Firebase Console
- [ ] Enable Google sign-in in Firebase Console
- [ ] Configure authorized domains
- [ ] Generate VAPID key for FCM
- [ ] Set up Firebase Admin SDK in Python backend
- [ ] Implement `get_current_user` FastAPI dependency
- [ ] Test token verification flow end-to-end

### Phase 3: Backend Deployment (Day 2-3)

- [ ] Create Dockerfile with Playwright
- [ ] Deploy to Cloud Run (us-central1)
- [ ] Set environment variables
- [ ] Configure custom domain (optional)
- [ ] Set timeout to 3600s
- [ ] Set concurrency to 100
- [ ] Set memory to 2Gi, CPU to 2

### Phase 4: Firestore & Security (Day 2-3)

- [ ] Deploy Firestore security rules
- [ ] Create composite indexes for common queries
- [ ] Test rules with Firebase emulator
- [ ] Set up custom claims for family roles

### Phase 5: Cloud Scheduler (Day 3)

- [ ] Create daily health narrative job
- [ ] Create weekly family report job
- [ ] Create inactivity check job
- [ ] Test cron endpoints manually

### Phase 6: FCM & Notifications (Day 3)

- [ ] Create `firebase-messaging-sw.js` service worker
- [ ] Implement notification permission request UI
- [ ] Test push notification delivery
- [ ] Implement notification click handling

### Phase 7: Vertex AI Imagen (Day 8-11)

- [ ] Test Imagen 3 generation with sample prompts
- [ ] Implement `generate_illustration` tool function
- [ ] Set up Cloud Storage upload pipeline
- [ ] Test signed URL generation

---

## References

- [Firebase Auth Web Setup](https://firebase.google.com/docs/auth/web/start)
- [Firebase Auth Token Verification](https://firebase.google.com/docs/auth/admin/verify-id-tokens)
- [Firestore Data Model](https://firebase.google.com/docs/firestore/data-model)
- [Firestore Security Rules](https://firebase.google.com/docs/firestore/security/rules-structure)
- [FCM Web Client](https://firebase.google.com/docs/cloud-messaging/js/client)
- [Cloud Run Python Quickstart](https://cloud.google.com/run/docs/quickstarts/build-and-deploy/deploy-python-service)
- [Cloud Run WebSockets](https://cloud.google.com/run/docs/triggering/websockets)
- [Vertex AI Imagen](https://cloud.google.com/vertex-ai/generative-ai/docs/image/generate-images)
- [Cloud Storage Signed URLs](https://cloud.google.com/storage/docs/access-control/signed-urls)
- [Cloud Scheduler](https://cloud.google.com/scheduler/docs/schedule-run-cron-job)
- [Google Cloud Free Tier](https://cloud.google.com/free)
- [Firebase Pricing](https://firebase.google.com/pricing)
- [Firestore Pricing](https://cloud.google.com/firestore/pricing)
