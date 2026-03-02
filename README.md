# CARIA — AI Elderly Care Companion

**Gemini Live Agent Challenge** | [Devpost Submission](https://devpost.com)

CARIA is a voice-first AI companion designed for elderly users. It combines real-time voice conversation, memory storytelling, web navigation assistance, and family health monitoring — all built with accessibility as the top priority (WCAG AAA).

## Features

| Feature | Description |
|---|---|
| **Voice Companion** | Real-time voice conversation via Gemini Live API with emotion detection, health check-ins, medication reminders |
| **Memory Storyteller** | Transforms conversations into illustrated memory chapters using AI narrative writing + Imagen 3 |
| **Web Navigator** | AI-controlled headless browser that helps elderly users navigate websites with screenshot streaming |
| **Family Dashboard** | Real-time alerts, health reports, medication tracking, and push notifications for family members |

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 15, React 19, Tailwind CSS 4, Firebase Auth |
| Backend | Python 3.11+, FastAPI, Google ADK (Agent Development Kit) |
| AI | Gemini 2.5 Flash (voice + agents), Imagen 3 (illustrations) |
| Infrastructure | Firebase Auth, Cloud Firestore, Cloud Storage, FCM Push |
| Browser Automation | Playwright (headless Chromium) |

## Project Structure

```
olaf/
├── frontend/          # Next.js PWA
│   ├── src/
│   │   ├── app/       # App Router: (auth), (app), (family) route groups
│   │   ├── components/ # UI, layout, companion, memories, navigator, family
│   │   ├── contexts/  # AuthContext
│   │   ├── hooks/     # React Query hooks
│   │   ├── lib/       # API client, Firebase, Gemini Live, Audio Manager
│   │   └── types/     # TypeScript interfaces
│   └── public/        # PWA manifest, service worker
├── backend/           # FastAPI + ADK
│   ├── api/           # REST routes + WebSocket + middleware
│   ├── caria_agents/  # ADK agents: coordinator, storyteller, navigator, alert
│   ├── models/        # Pydantic models (API + Firestore)
│   ├── services/      # Firestore, Imagen, FCM, Browser, Navigator session
│   └── tests/
├── docs/              # Architecture, design system, research
└── docker-compose.yml
```

---

## Prerequisites

- **Node.js** 18+ and npm
- **Python** 3.11+
- **Docker** (optional, for Firestore emulator)
- **Google Cloud** account with:
  - Firebase project (Auth + Firestore + Storage + FCM)
  - Gemini API key or Vertex AI enabled
  - Cloud Storage bucket

---

## Quick Start

### 1. Clone and install

```bash
git clone <repo-url> && cd olaf

# Frontend
cd frontend
npm install
cd ..

# Backend
cd backend
pip install -e ".[dev]"
playwright install chromium
cd ..
```

### 2. Set up environment variables

**Frontend** — copy and fill in `frontend/.env.local`:

```bash
cp frontend/.env.example frontend/.env.local
```

```env
# Firebase Client Config (from Firebase Console → Project Settings → Web App)
NEXT_PUBLIC_FIREBASE_API_KEY=your-api-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abcdef

# Backend API URL
NEXT_PUBLIC_API_URL=http://localhost:8080
```

**Backend** — copy and fill in `backend/.env`:

```bash
cp backend/.env.example backend/.env
```

```env
# Gemini API Key (from https://aistudio.google.com/apikey)
GOOGLE_API_KEY=your-gemini-api-key

# Firebase Admin (from Firebase Console → Project Settings → Service Accounts)
# Option A: Path to service account JSON file
GOOGLE_APPLICATION_CREDENTIALS=path/to/service-account.json

# Option B: Inline credentials (for Docker/Cloud Run)
# FIREBASE_ADMIN_PROJECT_ID=your-project-id
# FIREBASE_ADMIN_CLIENT_EMAIL=firebase-adminsdk-xxx@your-project.iam.gserviceaccount.com
# FIREBASE_ADMIN_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# Cloud Storage bucket for storybook illustrations
GCS_ARTIFACTS_BUCKET=your-project-artifacts

# Defaults (change if needed)
PORT=8080
ALLOWED_ORIGINS=http://localhost:3000
LOG_LEVEL=info
SESSION_DB_URI=sqlite+aiosqlite:///./sessions.db
ENABLE_DEV_UI=false
```

### 3. Start the backend

```bash
cd backend
uvicorn main:app --host 0.0.0.0 --port 8080 --reload
```pip3 install -e ".[dev]"

The backend runs at `http://localhost:8080`. Endpoints:
- API docs: `http://localhost:8080/docs`
- Health check: `http://localhost:8080/health`
- ADK Dev UI (if enabled): `http://localhost:8080/dev-ui`

### 4. Start the frontend

```bash
cd frontend
npm run dev
```

The frontend runs at `http://localhost:3000`. Pages:
- `/login` — Sign in (elderly or family)
- `/register` — Create account
- `/talk` — Voice companion (elderly)
- `/memories` — Memory storybook (elderly)
- `/help` — Web navigation assistant (elderly)
- `/dashboard` — Family monitoring dashboard

### 5. (Alternative) Start with Docker

```bash
# Starts backend + Firestore emulator
docker compose up
```

Then start the frontend separately with `npm run dev`.

---

## Firebase Setup

### 1. Create a Firebase project

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Create a new project (enable Google Analytics if you want)
3. Enable **Authentication** → Sign-in methods → Email/Password + Google
4. Enable **Cloud Firestore** → Create database (start in test mode for development)
5. Enable **Cloud Storage** → Create bucket
6. Enable **Cloud Messaging** for push notifications

### 2. Get config values

- **Web app config**: Project Settings → General → Your apps → Web app → Config
- **Service account**: Project Settings → Service Accounts → Generate New Private Key

### 3. Firestore security rules (development)

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

---

## Development Commands

### Frontend

```bash
npm run dev          # Start dev server (localhost:3000)
npm run build        # Production build
npm run lint         # ESLint
npm run type-check   # TypeScript check
```

### Backend

```bash
uvicorn main:app --reload          # Start dev server
pytest                              # Run tests
ruff check .                        # Lint
ruff format .                       # Format
mypy .                              # Type check
```

---

## Architecture Overview

```
┌─────────────┐     WebSocket      ┌──────────────────┐
│   Browser    │◄──────────────────►│  Gemini Live API  │
│  (Next.js)   │   (voice audio)    │  (Companion)      │
│              │                    └──────────────────┘
│  Talk page   │
│  Memories    │     REST + WSS     ┌──────────────────┐
│  Help        │◄──────────────────►│  FastAPI Backend   │
│  Dashboard   │                    │                    │
└─────────────┘                    │  ┌──────────────┐ │
                                    │  │ ADK Agents   │ │
                                    │  │ - Coordinator│ │
                                    │  │ - Storyteller│ │
                                    │  │ - Navigator  │ │
                                    │  │ - Alert      │ │
                                    │  └──────────────┘ │
                                    │                    │
                                    │  ┌──────────────┐ │
                                    │  │ Services     │ │
                                    │  │ - Firestore  │ │
                                    │  │ - Imagen 3   │ │
                                    │  │ - FCM Push   │ │
                                    │  │ - Playwright │ │
                                    │  └──────────────┘ │
                                    └──────────────────┘
```

**Key design decision**: The Voice Companion connects **browser-direct** to Gemini Live API (lowest latency for real-time voice). All other agents run server-side through the ADK backend.

---

## Design System

- **WCAG AAA** target (7:1 contrast for all text)
- **18px minimum** body text
- **48px minimum** touch targets
- **Light theme only** (optimized for aging eyes)
- **Voice-first** — every action triggerable by voice
- Fonts: Figtree (headings) + Noto Sans (body)
- Colors: Calm blue (#0369A1) + Reassuring green (#15803D)

Full design system docs: `docs/design-system/`

---

## License

MIT
