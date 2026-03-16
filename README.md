# OLAF — AI Elderly Care Companion

**Gemini Live Agent Challenge** | Deadline: March 16, 2026

> "For the people who deserve more than a weekly phone call."

OLAF is a voice-first AI companion for elderly users and the families who care for them. It combines real-time voice conversation, illustrated memory preservation, web navigation assistance, and intelligent family alerts — built on Gemini's Live API, Google ADK, Imagen 3, and a full Firebase stack.

---

## What It Does

| Feature | For whom | Description |
|---|---|---|
| **Voice Companion** | Elderly user | Real-time voice + vision companion via Gemini Live API (ADK bidi-streaming). Health check-ins, medication scanning via webcam, reminders, emotional support. |
| **Memory Journal** | Elderly user | Speak a memory to OLAF. An ADK pipeline transforms it into an illustrated, watercolor-style life story chapter via Imagen 3. |
| **Family Dashboard** | Family members | Health trends, mood calendar, pending reminders, and push notifications via Firebase Cloud Messaging. |

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

## Tech Stack

| Layer | Technology | Version |
|---|---|---|
| Frontend | Next.js (App Router) | 15 |
| Frontend language | TypeScript | 5.7 |
| Styling | Tailwind CSS | 4 |
| UI state | React Query (@tanstack) | 5 |
| Voice/Vision | Gemini Live API (WebSocket direct) | `gemini-2.5-flash-native-audio-preview-12-2025` |
| ADK agents | Google ADK + Gemini 2.5 Flash | >= 1.26 |
| Image generation | Imagen 3 via Vertex AI | `imagen-3.0-generate-002` |
| Backend framework | FastAPI (via ADK `get_fast_api_app`) | 0.115 |
| Backend language | Python | 3.13 |
| Headless browser | Playwright + Chromium | 1.49 |
| Auth | Firebase Authentication | 11 |
| Database | Cloud Firestore | — |
| File storage | Cloud Storage | — |
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
│       │   ├── (app)/             # Talk, Memories, Help (elderly UI)
│       │   └── (family)/          # Family dashboard
│       ├── components/
│       │   ├── companion/         # AudioVisualizer, CameraToggle, StatusIndicator
│       │   ├── navigator/         # ScreenshotViewer, ConfirmationPrompt
│       │   ├── memories/          # MemoryChapterCard, ReportCard
│       │   ├── family/            # AlertCard, OverviewCard, ReportsSection
│       │   ├── layout/            # BottomNav, Header, PageShell
│       │   └── ui/                # Button, Card, Modal, Toast, Input
│       ├── lib/
│       │   ├── gemini-live.ts     # GeminiLiveClient (WebSocket, session resumption)
│       │   ├── tool-handler.ts    # Tool call → REST bridge
│       │   ├── audio-manager.ts   # 16kHz PCM mic capture + playback
│       │   ├── firebase.ts        # Firebase client init
│       │   └── fcm.ts             # Push notification setup
│       ├── hooks/
│       │   └── useApi.ts          # React Query hooks for all backend endpoints
│       └── contexts/
│           └── AuthContext.tsx    # Firebase auth state
│
├── backend/                       # Python FastAPI + Google ADK
│   ├── main.py                    # App entry point (get_fast_api_app + custom routes)
│   ├── config.py                  # Pydantic settings (env vars)
│   ├── olaf_agents/              # ADK agent module (convention: exports root_agent)
│   │   ├── agent.py               # root_agent = olaf_coordinator
│   │   ├── agents/
│   │   │   ├── storyteller.py     # storyteller_agent + story_pipeline (SequentialAgent)
│   │   │   ├── navigator.py       # navigator_agent (Playwright tools)
│   │   │   └── alert.py           # alert_agent (wrapped as AgentTool)
│   │   ├── tools/
│   │   │   ├── storyteller_tools.py  # generate_illustration, save_memory_chapter, etc.
│   │   │   ├── navigator_tools.py    # navigate_to_url, click_element, take_screenshot, etc.
│   │   │   ├── alert_tools.py        # send_push_notification, evaluate_signal, etc.
│   │   │   └── companion_tools.py    # analyze_medication, log_health_checkin, etc.
│   │   ├── instructions/          # Agent system prompts
│   │   └── callbacks/
│   │       ├── safety.py          # before_model_callback (input safety guard)
│   │       └── navigator_guard.py # before_tool_callback (URL validation + audit log)
│   ├── api/
│   │   ├── routes/                # Custom FastAPI routers
│   │   │   ├── gemini_token.py    # POST /api/gemini/token (ephemeral tokens)
│   │   │   ├── companion.py       # POST /api/companion/* (tool execution)
│   │   │   ├── storyteller.py     # POST /api/storyteller/* (story creation)
│   │   │   ├── navigator.py       # WS /api/navigator/* (screenshot stream)
│   │   │   ├── health.py          # GET/POST /api/health/* (logs, reports)
│   │   │   └── alerts.py          # GET/POST /api/alerts/*
│   │   └── middleware/
│   │       └── firebase_auth.py   # Firebase ID token verification
│   ├── services/
│   │   ├── firestore_service.py   # Firestore CRUD
│   │   ├── imagen_service.py      # Vertex AI Imagen 3 + Cloud Storage upload
│   │   ├── browser_service.py     # Playwright browser pool (up to 5 sessions)
│   │   ├── navigator_session.py   # Per-session navigator state
│   │   └── fcm_service.py         # Firebase Cloud Messaging
│   ├── models/
│   │   ├── api.py                 # Pydantic request/response schemas
│   │   └── firestore.py           # Firestore document models
│   ├── tests/
│   │   ├── conftest.py
│   │   └── test_api/              # API endpoint tests (pytest-asyncio)
│   ├── Dockerfile
│   └── pyproject.toml
│
├── docs/
│   ├── architecture/              # Agent orchestration, API contracts, data flow
│   ├── design-system/             # Color tokens, component specs, Tailwind config
│   ├── plans/                     # Product design document
│   ├── research/                  # Gemini Live API, ADK, Firebase/GCP research
│   └── submission/                # Hackathon: demo script, Devpost text, prize strategy
│
├── docker-compose.yml             # Backend + Firestore emulator (local dev)
└── README.md
```

---

## Prerequisites

- **Node.js** 20+ and npm
- **Python** 3.11+
- **Docker** (optional — for Firestore emulator local dev)
- **Google Cloud project** with:
  - Firebase enabled (Auth + Firestore + Cloud Storage + Cloud Messaging)
  - Gemini API key (from [Google AI Studio](https://aistudio.google.com/apikey))
  - Vertex AI enabled (for Imagen 3 illustration generation)
  - Cloud Storage bucket created

---

## Setup — Local Development

### 1. Clone

```bash
git clone <repo-url>
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
playwright install chromium
```

### 4. Configure environment variables

**Frontend** (`frontend/.env.local`):

```bash
cp frontend/.env.example frontend/.env.local
```

Edit `frontend/.env.local`:

```env
# Firebase Web App Config
# Source: Firebase Console → Project Settings → General → Your apps → Web app
NEXT_PUBLIC_FIREBASE_API_KEY=AIza...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abcdef

# Backend API (local)
NEXT_PUBLIC_API_URL=http://localhost:8080
```

**Backend** (`backend/.env`):

```bash
cp backend/.env.example backend/.env
```

Edit `backend/.env`:

```env
# Google AI / Gemini
# Source: https://aistudio.google.com/apikey
GOOGLE_API_KEY=AIza...

# Google Cloud (for Vertex AI Imagen 3)
GOOGLE_CLOUD_PROJECT=your-project-id
GOOGLE_CLOUD_LOCATION=us-central1

# Firebase Admin
# Option A: Path to downloaded service account JSON
# Source: Firebase Console → Project Settings → Service Accounts → Generate New Private Key
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json

# Option B: Inline credentials (required for Docker / Cloud Run)
# FIREBASE_ADMIN_PROJECT_ID=your-project-id
# FIREBASE_ADMIN_CLIENT_EMAIL=firebase-adminsdk-xxx@your-project.iam.gserviceaccount.com
# FIREBASE_ADMIN_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMII...\n-----END PRIVATE KEY-----\n"

# Cloud Storage bucket (for Imagen illustrations + storybook files)
GCS_ARTIFACTS_BUCKET=your-project-artifacts

# Server config
PORT=8080
ALLOWED_ORIGINS=http://localhost:3000
LOG_LEVEL=info

# ADK session persistence (SQLite for local, change for production)
SESSION_DB_URI=sqlite+aiosqlite:///./sessions.db

# Enable ADK Dev UI at /dev-ui (useful for agent debugging)
ENABLE_DEV_UI=true
```

### 5. Firebase project setup

1. [Firebase Console](https://console.firebase.google.com) → Create project (or use existing)
2. Authentication → Sign-in methods → Enable **Email/Password** and **Google**
3. Firestore Database → Create database → Start in **test mode** for local dev
4. Storage → Create bucket (note the bucket name for `GCS_ARTIFACTS_BUCKET`)
5. Project Settings → Cloud Messaging → Copy the VAPID key (for push notifications)

**Firestore security rules (development):**

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

### 6. Start the backend

```bash
cd backend
uvicorn main:app --host 0.0.0.0 --port 8080 --reload
```

Available at `http://localhost:8080`:
- `GET /health` — Health check
- `GET /docs` — Swagger API docs (interactive)
- `GET /dev-ui` — ADK agent dev UI (if `ENABLE_DEV_UI=true`)

### 7. Start the frontend

```bash
cd frontend
npm run dev
```

Available at `http://localhost:3000`:
- `/login` — Sign in (elderly user or family member)
- `/register` — Create account
- `/talk` — Voice companion (elderly UI)
- `/memories` — Memory storybook
- `/help` — Web navigator
- `/dashboard` — Family monitoring dashboard

### 8. (Alternative) Start with Docker Compose

```bash
# Starts backend + Firestore emulator
docker compose up

# Start frontend separately
cd frontend && npm run dev
```

---

## Environment Variables Reference

### Backend (`backend/.env`)

| Variable | Required | Description |
|---|---|---|
| `GOOGLE_API_KEY` | Yes | Gemini API key from AI Studio |
| `GOOGLE_CLOUD_PROJECT` | Yes (Imagen) | GCP project ID for Vertex AI |
| `GOOGLE_CLOUD_LOCATION` | No | Vertex AI region (default: `us-central1`) |
| `GOOGLE_GENAI_USE_VERTEXAI` | No | Set `True` to use Vertex AI instead of AI Studio |
| `GOOGLE_APPLICATION_CREDENTIALS` | Yes* | Path to service account JSON |
| `FIREBASE_ADMIN_PROJECT_ID` | Yes* | Firebase project ID (inline credentials) |
| `FIREBASE_ADMIN_CLIENT_EMAIL` | Yes* | Service account email (inline credentials) |
| `FIREBASE_ADMIN_PRIVATE_KEY` | Yes* | Service account private key (inline credentials) |
| `GCS_ARTIFACTS_BUCKET` | Yes (Imagen) | Cloud Storage bucket name for illustrations |
| `PORT` | No | Server port (default: `8080`) |
| `ALLOWED_ORIGINS` | No | CORS origins, comma-separated (default: `http://localhost:3000`) |
| `LOG_LEVEL` | No | Python log level (default: `info`) |
| `SESSION_DB_URI` | No | ADK session store URI (default: SQLite) |
| `ENABLE_DEV_UI` | No | Enable ADK dev UI at `/dev-ui` (default: `false`) |

*Either `GOOGLE_APPLICATION_CREDENTIALS` OR the three `FIREBASE_ADMIN_*` vars are required.

### Frontend (`frontend/.env.local`)

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Yes | Firebase web app API key |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Yes | Firebase auth domain |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Yes | Firebase project ID |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | Yes | Firebase Storage bucket |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Yes | FCM sender ID (for push) |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Yes | Firebase app ID |
| `NEXT_PUBLIC_API_URL` | Yes | Backend base URL (default: `http://localhost:8080`) |

---

## Deployment — Google Cloud Run

### Build and push backend image

```bash
cd backend

# Build
docker build -t gcr.io/YOUR_PROJECT/olaf-backend:latest .

# Push
docker push gcr.io/YOUR_PROJECT/olaf-backend:latest
```

### Deploy backend to Cloud Run

```bash
gcloud run deploy olaf-backend \
  --image gcr.io/YOUR_PROJECT/olaf-backend:latest \
  --platform managed \
  --region us-central1 \
  --memory 2Gi \
  --cpu 2 \
  --timeout 3600 \
  --concurrency 100 \
  --no-use-http2 \
  --min-instances 1 \
  --max-instances 5 \
  --set-env-vars "GOOGLE_CLOUD_PROJECT=YOUR_PROJECT,GCS_ARTIFACTS_BUCKET=YOUR_BUCKET,ALLOWED_ORIGINS=https://your-frontend.vercel.app" \
  --set-secrets "GOOGLE_API_KEY=gemini-api-key:latest,FIREBASE_ADMIN_PRIVATE_KEY=firebase-private-key:latest"
```

Notes:
- `--no-use-http2` is required for WebSocket support (HTTP/2 end-to-end is incompatible with WebSocket in Cloud Run)
- `--min-instances 1` keeps a warm Playwright container — without this, cold starts take 10–30 seconds
- `--memory 2Gi` is required for the Playwright Chromium process
- Use Secret Manager for sensitive values (`GOOGLE_API_KEY`, `FIREBASE_ADMIN_PRIVATE_KEY`)

On Cloud Run, Firebase Admin SDK uses **Application Default Credentials** automatically. You do not need to set `GOOGLE_APPLICATION_CREDENTIALS` — grant the Cloud Run service account the `Firebase Admin SDK Service Agent` role.

### Deploy frontend to Firebase Hosting

The frontend deploys automatically via GitHub Actions when you push to `main` (CI must pass first).

To deploy manually:

```bash
cd frontend
npm ci
npx firebase-tools experiments:enable webframeworks
npx firebase-tools deploy --only hosting
```

Make sure your Firebase project is set in `.firebaserc` and environment variables are available during build.

---

## Testing the App

The live app is available at **https://olaf-dev-7a5d4.web.app**

### Test accounts

| Role | Username / Email | Password |
|---|---|---|
| Elderly user | `olaf.demo` | `Demo1234!` |
| Family member | `demo.family@gmail.com` | `Demo1234!` |

> Sign in as the elderly user on one tab and the family member on another to see the full care loop.

### Feature walkthrough

**1. Voice Companion (Talk page)**
1. Log in as the elderly user → tap **Talk to OLAF**
2. Wait for OLAF to greet you first (within 2–3 seconds)
3. Say _"I'm feeling a bit tired today"_ — OLAF will ask a follow-up question
4. Say _"Remind me to take my medicine tonight"_ — OLAF sets a reminder
5. Say _"I already took my medicine"_ — OLAF marks the reminder as done
6. Say _"Bye"_ — OLAF gives a farewell without asking another question
7. **Try interrupting**: start speaking while OLAF is mid-sentence — it stops immediately

**2. Health Check-in**
1. During a Talk session, tell OLAF how you feel and mention any pain
2. OLAF will call `log_health_checkin` automatically after gathering mood/pain info
3. Switch to the family dashboard — the mood and pain level appears under today's entry

**3. Memory Journal (Memories page)**
1. Log in as elderly user → tap **Memories**
2. Tap **New Memory** → speak or type a short memory
3. The pipeline generates a narrative + Imagen 3 watercolor illustration
4. The memory appears as an illustrated chapter card

**4. Family Dashboard**
1. Log in as the family member → you see the elder's health summary
2. Check the mood calendar — dots appear on days with health logs
3. Pending reminders from the Talk session appear under **Reminders**
4. Any alerts created during the session appear under **Alerts**

---

## Development Commands

### Frontend

```bash
npm run dev          # Development server (localhost:3000, HMR)
npm run build        # Production build
npm run start        # Start production build locally
npm run lint         # ESLint
npm run type-check   # TypeScript (tsc --noEmit)
```

### Backend

```bash
uvicorn main:app --reload          # Development server (localhost:8080, hot-reload)
pytest                              # Run test suite
pytest -v tests/test_api/          # API tests only
ruff check .                        # Lint
ruff format .                       # Format
mypy .                              # Type check (strict)
```

---

## Gemini API Usage Summary

| Component | Model | Usage |
|---|---|---|
| Voice Companion (ADK bidi) | `gemini-2.5-flash-native-audio-preview-09-2025` | Bidi-streaming audio + camera frames, 4 tools: set_reminder, complete_reminder, log_health_checkin, analyze_medication |
| Storyteller (ADK) | `gemini-2.5-flash` | Memory narrative writing, daily health summaries, weekly reports |
| Illustration generation | `imagen-3.0-generate-002` | Warm watercolor memory illustrations via Vertex AI |
| Conversation summary | `gemini-2.5-flash` | Post-session transcript analysis and mood scoring |

---

## Design Principles (Elderly-First UX)

- **18px minimum** body text across all screens
- **WCAG AAA** contrast ratio target (7:1) — not AAA aspirational, AAA enforced
- **48px minimum** touch targets — designed for tablet use with imprecise finger taps
- **Three screens only** — Talk, Memories, Help — with consistent layout on every visit
- **Voice-first** — every action triggerable by voice command to OLAF
- **Always show loading states** — blank screens cause anxiety; all async operations show progress
- **No jargon** — "Talk to OLAF", not "Initialize Voice Session"
- **Forgiveness** — undo everything, confirm destructive actions, repeat anything without frustration
- **Consistent audio feedback** — gentle sounds for confirmations and alerts

---

## Hackathon Submission Files

```
docs/submission/
├── demo-script.md         # 4-minute emotional demo script
├── devpost-submission.md  # Full Devpost submission text
└── prize-strategy.md      # Targeting paragraphs for each prize category
```

---

## License

MIT

---

## Team

Built for the **Gemini Live Agent Challenge** (Devpost, deadline March 16, 2026).
