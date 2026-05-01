# OLAF — AI Elderly Care Companion

**Gemini Live Agent Challenge** | Deadline: March 16, 2026

> "For the people who deserve more than a weekly phone call."

OLAF is a voice-first AI companion for elderly users and the families who care for them. It combines real-time voice conversation, illustrated memory preservation, and family monitoring — built on Gemini Live API, Google ADK, Vertex AI Imagen 3, and Firebase.

---

## What It Does

| Feature | For whom | Description |
|---|---|---|
| **Voice Companion** | Elderly user | Real-time voice companion via Gemini Live API (ADK bidi-streaming). OLAF greets the user first, listens, and responds like a warm friend. Users can interrupt naturally at any time. |
| **Reminders** | Elderly user | Ask OLAF to set any reminder by voice. When the user says they have done it, OLAF marks it complete. Pending reminders appear on the family dashboard. |
| **Medication Check** | Elderly user | Point the camera at a medication bottle. OLAF analyses the label via vision and cross-references it with the user's known prescription list. |
| **Memory Journal** | Elderly user | Speak a memory to OLAF. An ADK pipeline transforms it into an illustrated, watercolor-style life story chapter via Vertex AI Imagen 3. |
| **Family Dashboard** | Family members | Health trends, mood calendar, pending reminders, and push notifications via Firebase Cloud Messaging. |
| **Form Navigator** | Elderly user | A separate browser-using agent (`navigator_agent`) drives a headless browser to help with government portals, medical appointments, online forms, and document retrieval. Every action passes through a safety callback (`validate_navigation_safety`) and the agent narrates each step with screenshots so the user can confirm before sensitive submissions. |
| **Alert Manager** | Internal | A dedicated `alert_manager` agent receives signals from the other agents (e.g. emotional distress flags, missed reminders) and decides notification routing — push, email, or daily report — based on user baselines and the family contact graph. |

---

## Architecture

```
  ┌──────────────────────────────────────────────────────────┐
  │              Browser (Next.js PWA — Firebase Hosting)     │
  │                                                          │
  │  ┌──────────────┐  WebSocket (wss://)  ┌──────────────┐  │
  │  │  Talk Page   │─────────────────────►│  ADK Runner  │  │
  │  │  (Companion  │  16kHz PCM + JPEG    │  (Cloud Run) │  │
  │  │  + Camera)   │◄─────────────────────│  ↕ Gemini    │  │
  │  └──────┬───────┘  audio + transcripts │  Live API    │  │
  │         │                              └──────────────┘  │
  │  ┌──────▼───────┐                   ┌──────────────┐     │
  │  │ Memories Page│                   │  Dashboard   │     │
  │  │ (StoryCards) │                   │  (Family)    │     │
  │  └──────┬───────┘                   └──────┬───────┘     │
  └─────────┼──────────────────────────────────┼─────────────┘
            │     REST API                     │
            ▼                                  ▼
  ┌──────────────────────────────────────────────────────────┐
  │              FastAPI Backend (Google Cloud Run)           │
  │                                                          │
  │  WS   /api/companion/stream  ── ADK bidi-streaming       │
  │  POST /api/companion/*       ── Tool execution           │
  │  POST /api/storyteller/*     ── Memory story pipeline    │
  │  GET  /api/health/*          ── Health logs & reports    │
  │  GET  /api/alerts/*          ── Family dashboard data    │
  │                                                          │
  │  ┌─────────────────────────────────────────────────┐    │
  │  │              Google ADK Agents                   │    │
  │  │                                                  │    │
  │  │  companion_agent (Gemini 2.5 Flash Native Audio) │    │
  │  │    Tools: set_reminder, complete_reminder,       │    │
  │  │           log_health_checkin, analyze_medication │    │
  │  │                                                  │    │
  │  │  storyteller_agent (gemini-2.5-flash)            │    │
  │  │    SequentialAgent: narrative → Imagen 3 → save  │    │
  │  └─────────────────────────────────────────────────┘    │
  │                                                          │
  │  ┌────────────────┐  ┌───────────────┐                  │
  │  │   Firestore    │  │ Cloud Storage │                  │
  │  │  user profiles │  │  illustrations│                  │
  │  │  health logs   │  │  PDFs         │                  │
  │  │  conversations │  └───────────────┘                  │
  │  │  memories      │                                      │
  │  │  reminders     │  ┌───────────────┐                  │
  │  │  alerts        │  │  Firebase FCM │                  │
  │  └────────────────┘  │  push notifs  │                  │
  │                       └───────────────┘                  │
  └──────────────────────────────────────────────────────────┘
```

**Key architectural decision:** The voice companion uses ADK `runner.run_live()` with `StreamingMode.BIDI` — the backend proxies all audio between the browser and Gemini Live API. This allows server-side tool execution with user context from Firestore, while keeping audio latency low. The frontend sends 16kHz PCM audio and JPEG camera frames over WebSocket; the backend returns audio chunks and transcripts.

---

## Engineering Highlights

A few production-aware design decisions that aren't obvious from the feature list:

### Memory bank — cross-session continuity
On every WebSocket connection, the backend pulls up to 5 of the user's most recent memory chapters from Firestore and injects them into the ADK session state as a "memory bank." The companion agent's instruction references this bank, so OLAF can say things like *"Remember last week when you talked about your wedding day?"* — the model isn't stateless across sessions.

### Daily briefing — timezone-aware greeting
At session start, the backend assembles a daily briefing: the user's local time-of-day (resolved from their stored `timezone`), and any pending reminders. This is injected into session state before the first audio frame, so OLAF's opening greeting is contextually correct (*"Good Tuesday morning. You have one pending reminder: take your medicine."*) without the model needing tool calls for basic context.

### Pre-greeting trigger — workaround for Gemini Live's modality lock
Gemini Live's first response locks the response modality. If OLAF speaks before mic audio is flowing, it answers in text. The backend solves this by waiting 2 seconds (long enough for mic blobs to start streaming) and then sending a hidden `__START_SESSION__` text trigger — the model responds in audio, and the user hears OLAF greet them first.

### Duplicate suppression — handling ADK echo around tool calls
ADK's bidi/live mode hides function-call events from user code, and the model sometimes repeats itself before and after invoking a tool. The downstream task runs every model transcript (partial and finished) through prefix-based fuzzy matching against a sliding window of recent transcripts; on a hit, the backend sends a `clear_audio` signal to the frontend to halt playback and suppresses the duplicate audio chunks. Without this, users would hear the same sentence twice every time OLAF set a reminder.

### Defensive close handling
ADK raises `APIError(1000)` on normal WebSocket close. The downstream loop checks for `"1000"` in the exception message and logs it as a clean disconnect instead of an error — keeps logs readable.

### Per-agent safety callbacks
Both the companion and the navigator agent register `before_tool_callback` hooks (`safety.py`, `navigator_guard.py`) that gate destructive or sensitive actions. The navigator guard, in particular, runs before any browser action that could submit a form on a user's behalf.

---

## Tech Stack

| Layer | Technology | Version |
|---|---|---|
| Frontend | Next.js (App Router) | 15 |
| Frontend language | TypeScript | 5.7 |
| Styling | Tailwind CSS | 4 |
| UI state | React Query (@tanstack) | 5 |
| Voice/Vision | Gemini Live API via ADK bidi-streaming | `gemini-2.5-flash-native-audio-preview-09-2025` |
| ADK agents | Google ADK + Gemini 2.5 Flash | >= 1.26 |
| Image generation | Imagen 3 via Vertex AI | `imagen-3.0-generate-002` |
| Backend framework | FastAPI | 0.115 |
| Backend language | Python | 3.12 |
| Auth | Firebase Authentication | 11 |
| Database | Cloud Firestore | — |
| File storage | Cloud Storage (GCS) | — |
| Push notifications | Firebase Cloud Messaging | — |
| Hosting (backend) | Google Cloud Run | — |
| Hosting (frontend) | Firebase Hosting | — |
| CI/CD | GitHub Actions | — |

---

## Project Structure

```
olaf/
├── frontend/                      # Next.js 15 PWA
│   ├── public/
│   │   ├── manifest.json          # PWA manifest
│   │   └── firebase-messaging-sw.js  # FCM service worker
│   └── src/
│       ├── app/
│       │   ├── (auth)/            # Login, register
│       │   ├── (app)/             # Talk, Memories (elderly UI)
│       │   └── (family)/          # Family dashboard
│       ├── components/
│       │   ├── companion/         # CameraToggle, StatusIndicator
│       │   ├── memories/          # MemoryChapterCard, ReportCard
│       │   ├── family/            # AlertCard, OverviewCard
│       │   ├── layout/            # BottomNav, Header
│       │   └── ui/                # Button, Card, Input
│       ├── lib/
│       │   ├── adk-live.ts        # ADK WebSocket client
│       │   ├── audio-manager.ts   # 16kHz PCM mic capture + playback
│       │   ├── firebase.ts        # Firebase client init
│       │   └── fcm.ts             # Push notification setup
│       ├── hooks/
│       │   └── useApi.ts          # React Query hooks
│       └── contexts/
│           └── AuthContext.tsx    # Firebase auth state
│
├── backend/                       # Python FastAPI + Google ADK
│   ├── main.py                    # App entry point
│   ├── config.py                  # Pydantic settings (env vars)
│   ├── olaf_agents/
│   │   ├── agents/
│   │   │   ├── companion.py       # companion_agent (ADK bidi-streaming voice + vision)
│   │   │   ├── storyteller.py     # storyteller_agent + story_pipeline (SequentialAgent)
│   │   │   ├── alert.py           # alert_manager — routes signals to family notifications
│   │   │   └── navigator.py       # navigator_agent — headless-browser form helper
│   │   ├── tools/
│   │   │   ├── companion_tools.py # 8 tools: set_reminder, complete_reminder, log_health_checkin,
│   │   │   │                      #   analyze_medication, flag_emotional_distress, call_for_help,
│   │   │   │                      #   share_update_with_family, log_conversation
│   │   │   ├── storyteller_tools.py # generate_illustration, save_memory_chapter, save_health_narrative,
│   │   │   │                      #   save_weekly_report, get_health_logs, get_conversation_summaries,
│   │   │   │                      #   get_user_memories
│   │   │   ├── alert_tools.py     # evaluate_signal, create_alert, escalate_alert, send_push_notification,
│   │   │   │                      #   send_email_alert, log_to_daily_report, get_user_baseline,
│   │   │   │                      #   get_family_contacts
│   │   │   └── navigator_tools.py # navigate_to_url, click_element, type_text, scroll_page,
│   │   │                          #   read_page_text, take_screenshot, summarize_content,
│   │   │                          #   ask_user_confirmation
│   │   ├── callbacks/             # safety.py, navigator_guard.py — pre-tool safety checks
│   │   └── instructions/          # Per-agent system prompts
│   ├── api/
│   │   └── routes/
│   │       ├── companion.py       # POST /api/companion/*
│   │       ├── companion_stream.py # WS /api/companion/stream
│   │       ├── storyteller.py     # POST /api/storyteller/*
│   │       ├── health.py          # GET/POST /api/health/*
│   │       └── alerts.py          # GET/POST /api/alerts/*
│   ├── services/
│   │   ├── firestore_service.py   # Firestore CRUD
│   │   ├── imagen_service.py      # Vertex AI Imagen 3 + Cloud Storage
│   │   └── fcm_service.py         # Firebase Cloud Messaging
│   ├── models/
│   │   ├── api.py                 # Pydantic request/response schemas
│   │   └── firestore.py           # Firestore document models
│   ├── tests/
│   │   └── test_api/              # API endpoint tests (pytest-asyncio)
│   ├── Dockerfile
│   └── pyproject.toml
│
├── docker-compose.yml             # Backend + Firestore emulator (local dev)
└── README.md
```

---

## Prerequisites

- **Node.js** 20+ and npm
- **Python** 3.12+
- **Docker** (optional, for local Firestore emulator)
- **Google Cloud project** with:
  - Firebase enabled (Auth + Firestore + Cloud Storage + Cloud Messaging)
  - Gemini API key from [Google AI Studio](https://aistudio.google.com/apikey)
  - Vertex AI enabled (for Imagen 3)
  - Cloud Storage bucket created and set to public read

---

## Setup — Local Development

### 1. Clone

```bash
git clone https://github.com/RaymonddC/olaf.git
cd olaf
```

### 2. Frontend — install dependencies

```bash
cd frontend
npm install
```

### 3. Backend — install dependencies

```bash
cd backend
pip install -e ".[dev]"
```

### 4. Configure environment variables

**Frontend** (`frontend/.env.local`):

```env
NEXT_PUBLIC_FIREBASE_API_KEY=AIza...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abcdef
NEXT_PUBLIC_API_URL=http://localhost:8080
```

**Backend** (`backend/.env`):

```env
# Gemini API key from https://aistudio.google.com/apikey
GOOGLE_API_KEY=AIza...

# Google Cloud project for Vertex AI Imagen 3
GOOGLE_CLOUD_PROJECT=your-project-id
GOOGLE_CLOUD_LOCATION=us-central1

# Firebase Admin — option A: service account file
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json

# Firebase Admin — option B: inline credentials
# FIREBASE_ADMIN_PROJECT_ID=your-project-id
# FIREBASE_ADMIN_CLIENT_EMAIL=firebase-adminsdk-xxx@your-project.iam.gserviceaccount.com
# FIREBASE_ADMIN_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# Cloud Storage bucket for illustrations
GCS_ARTIFACTS_BUCKET=your-bucket-name

PORT=8080
ALLOWED_ORIGINS=http://localhost:3000
```

### 5. Firebase project setup

1. [Firebase Console](https://console.firebase.google.com) → create or select project
2. Authentication → Sign-in methods → enable **Email/Password** and **Google**
3. Firestore → create database in **test mode**
4. Storage → create bucket → set to public read (for illustration images)
5. Project Settings → Cloud Messaging → copy VAPID key

### 6. Start the backend

```bash
cd backend
uvicorn main:app --host 0.0.0.0 --port 8080 --reload
```

- `GET /health` — health check
- `GET /docs` — Swagger API docs

### 7. Start the frontend

```bash
cd frontend
npm run dev
```

Available at `http://localhost:3000`:
- `/login` — sign in
- `/talk` — voice companion (elderly UI)
- `/memories` — memory storybook
- `/dashboard` — family monitoring dashboard

### 8. (Alternative) Docker Compose

```bash
# Starts backend + Firestore emulator
docker compose up

# Start frontend separately
cd frontend && npm run dev
```

---

## Environment Variables Reference

### Backend

| Variable | Required | Description |
|---|---|---|
| `GOOGLE_API_KEY` | Yes | Gemini API key from AI Studio |
| `GOOGLE_CLOUD_PROJECT` | Yes | GCP project ID for Vertex AI |
| `GOOGLE_CLOUD_LOCATION` | No | Vertex AI region (default: `us-central1`) |
| `GOOGLE_GENAI_USE_VERTEXAI` | No | Set `True` to route through Vertex AI |
| `GOOGLE_APPLICATION_CREDENTIALS` | Yes* | Path to service account JSON |
| `FIREBASE_ADMIN_PROJECT_ID` | Yes* | Firebase project ID (inline credentials) |
| `FIREBASE_ADMIN_CLIENT_EMAIL` | Yes* | Service account email (inline credentials) |
| `FIREBASE_ADMIN_PRIVATE_KEY` | Yes* | Service account private key (inline credentials) |
| `GCS_ARTIFACTS_BUCKET` | Yes | Cloud Storage bucket for illustrations |
| `PORT` | No | Server port (default: `8080`) |
| `ALLOWED_ORIGINS` | No | CORS origins, comma-separated |

*Either `GOOGLE_APPLICATION_CREDENTIALS` OR the three `FIREBASE_ADMIN_*` vars are required.

### Frontend

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Yes | Firebase web app API key |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Yes | Firebase auth domain |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Yes | Firebase project ID |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | Yes | Firebase Storage bucket |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Yes | FCM sender ID |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Yes | Firebase app ID |
| `NEXT_PUBLIC_API_URL` | Yes | Backend base URL |

---

## Deployment

### Backend — Google Cloud Run

Automated via Cloud Build. See [`backend/cloudbuild.yaml`](backend/cloudbuild.yaml).

Manual deploy:

```bash
cd backend
docker build -t gcr.io/YOUR_PROJECT/olaf-backend:latest .
docker push gcr.io/YOUR_PROJECT/olaf-backend:latest

gcloud run deploy olaf-backend \
  --image gcr.io/YOUR_PROJECT/olaf-backend:latest \
  --platform managed \
  --region us-central1 \
  --memory 2Gi \
  --cpu 2 \
  --timeout 3600 \
  --no-use-http2 \
  --min-instances 1 \
  --set-env-vars "GOOGLE_CLOUD_PROJECT=YOUR_PROJECT,GCS_ARTIFACTS_BUCKET=YOUR_BUCKET,ALLOWED_ORIGINS=https://your-app.web.app"
```

Notes:
- `--no-use-http2` is required for WebSocket support
- `--min-instances 1` avoids cold starts on the ADK runner

### Frontend — Firebase Hosting

Deploys automatically via GitHub Actions after CI passes. See [`.github/workflows/deploy-frontend.yml`](.github/workflows/deploy-frontend.yml).

Manual deploy:

```bash
cd frontend
npm ci
npx firebase-tools experiments:enable webframeworks
npx firebase-tools deploy --only hosting
```

---

## Testing the App

The live app is available at **https://olaf-dev-7a5d4.web.app**

### Test accounts

| Role | Username / Email | Password |
|---|---|---|
| Elderly user | `olaf.demo` | `Demo1234!` |
| Family member | `demo.family@gmail.com` | `Demo1234!` |

Open both accounts in separate tabs to see the full care loop.

### Feature walkthrough

**1. Voice Companion (Talk page)**
1. Log in as the elderly user → tap **Talk to OLAF**
2. Wait for OLAF to greet you first (within 2 seconds)
3. Say "I'm feeling a bit tired today" — OLAF asks a follow-up question
4. Say "Remind me to take my medicine tonight" — OLAF sets a reminder
5. Say "I already took my medicine" — OLAF marks the reminder as done
6. Say "Bye" — OLAF gives a warm farewell without asking another question
7. Interrupt OLAF mid-sentence — it stops immediately and listens

**2. Health Check-in**
1. Tell OLAF how you feel and mention any pain level
2. OLAF calls `log_health_checkin` automatically
3. Switch to the family dashboard — mood and pain appear under today's entry

**3. Memory Journal (Memories page)**
1. Tap **Memories** → tap **New Memory**
2. Speak or type a short memory
3. The pipeline generates a narrative and a watercolor illustration via Imagen 3
4. The memory appears as an illustrated chapter card

**4. Family Dashboard**
1. Log in as the family member
2. See the elder's mood calendar, health trends, and pending reminders
3. Any alerts from the session appear under **Alerts**

---

## Development Commands

### Frontend

```bash
npm run dev          # Development server (localhost:3000)
npm run build        # Production build
npm run lint         # ESLint
npm run type-check   # TypeScript
```

### Backend

```bash
uvicorn main:app --reload    # Development server (localhost:8080)
pytest -v                    # Run all tests
ruff check .                 # Lint
ruff format .                # Format
```

---

## Gemini API Usage

| Component | Model | Usage |
|---|---|---|
| Voice Companion | `gemini-2.5-flash-native-audio-preview-09-2025` | Bidi-streaming audio + camera frames, 4 tools |
| Storyteller | `gemini-2.5-flash` | Memory narrative writing, health summaries |
| Illustration | `imagen-3.0-generate-002` | Watercolor memory illustrations via Vertex AI |
| Conversation summary | `gemini-2.5-flash` | Post-session transcript analysis and mood scoring |

---

## License

MIT

---

Built for the **Gemini Live Agent Challenge** (Devpost, deadline March 16, 2026).
