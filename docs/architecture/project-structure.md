# OLAF — Project Structure

## Monorepo Layout

```
caria/
├── .github/
│   └── workflows/
│       └── ci.yml                    # GitHub Actions CI/CD
│
├── frontend/                         # Next.js 14+ PWA
│   ├── public/
│   │   ├── icons/                    # PWA icons
│   │   ├── sounds/                   # UI feedback sounds
│   │   └── manifest.json             # PWA manifest
│   │
│   ├── src/
│   │   ├── app/                      # Next.js App Router
│   │   │   ├── layout.tsx            # Root layout (providers, fonts)
│   │   │   ├── page.tsx              # Landing / login redirect
│   │   │   ├── globals.css           # Tailwind base + custom tokens
│   │   │   │
│   │   │   ├── (auth)/               # Auth route group (no sidebar)
│   │   │   │   ├── login/
│   │   │   │   │   └── page.tsx
│   │   │   │   └── register/
│   │   │   │       └── page.tsx
│   │   │   │
│   │   │   ├── (app)/                # Authenticated app route group
│   │   │   │   ├── layout.tsx        # App shell (nav, sidebar)
│   │   │   │   ├── talk/
│   │   │   │   │   └── page.tsx      # Voice companion (CompanionAgent UI)
│   │   │   │   ├── memories/
│   │   │   │   │   ├── page.tsx      # Memory journal list
│   │   │   │   │   └── [id]/
│   │   │   │   │       └── page.tsx  # Single memory chapter view
│   │   │   │   ├── navigate/
│   │   │   │   │   └── page.tsx      # Navigator agent UI (screenshot stream)
│   │   │   │   ├── health/
│   │   │   │   │   └── page.tsx      # Health dashboard (elderly user)
│   │   │   │   └── settings/
│   │   │   │       └── page.tsx      # User settings
│   │   │   │
│   │   │   ├── (family)/             # Family dashboard route group
│   │   │   │   ├── layout.tsx        # Family dashboard shell
│   │   │   │   └── dashboard/
│   │   │   │       ├── page.tsx      # Family overview
│   │   │   │       ├── reports/
│   │   │   │       │   └── page.tsx  # Health reports view
│   │   │   │       ├── alerts/
│   │   │   │       │   └── page.tsx  # Alert history
│   │   │   │       └── memories/
│   │   │   │           └── page.tsx  # Shared memory chapters
│   │   │   │
│   │   │   └── api/                  # Next.js API routes (BFF)
│   │   │       └── gemini/
│   │   │           └── token/
│   │   │               └── route.ts  # Ephemeral token endpoint
│   │   │
│   │   ├── components/
│   │   │   ├── ui/                   # Design system primitives
│   │   │   │   ├── button.tsx
│   │   │   │   ├── card.tsx
│   │   │   │   ├── dialog.tsx
│   │   │   │   ├── input.tsx
│   │   │   │   ├── loading.tsx
│   │   │   │   ├── toast.tsx
│   │   │   │   └── typography.tsx
│   │   │   │
│   │   │   ├── companion/            # Voice companion components
│   │   │   │   ├── companion-session.tsx    # Main session orchestrator
│   │   │   │   ├── audio-visualizer.tsx     # Waveform display
│   │   │   │   ├── transcript-panel.tsx     # Live transcript
│   │   │   │   ├── medication-scanner.tsx   # Camera activation for meds
│   │   │   │   └── session-controls.tsx     # Mic, camera, end call
│   │   │   │
│   │   │   ├── navigator/            # Web navigator components
│   │   │   │   ├── navigator-session.tsx    # Navigator orchestrator
│   │   │   │   ├── screenshot-viewer.tsx    # Live screenshot stream
│   │   │   │   ├── action-confirmation.tsx  # Confirm sensitive actions
│   │   │   │   └── task-templates.tsx       # Pre-built task shortcuts
│   │   │   │
│   │   │   ├── memories/             # Memory journal components
│   │   │   │   ├── chapter-card.tsx
│   │   │   │   ├── chapter-viewer.tsx
│   │   │   │   ├── storybook-viewer.tsx
│   │   │   │   └── illustration-gallery.tsx
│   │   │   │
│   │   │   ├── health/               # Health dashboard components
│   │   │   │   ├── mood-chart.tsx
│   │   │   │   ├── medication-tracker.tsx
│   │   │   │   ├── daily-narrative.tsx
│   │   │   │   └── reminder-list.tsx
│   │   │   │
│   │   │   ├── family/               # Family dashboard components
│   │   │   │   ├── alert-feed.tsx
│   │   │   │   ├── report-card.tsx
│   │   │   │   └── family-link-manager.tsx
│   │   │   │
│   │   │   └── layout/               # Shared layout components
│   │   │       ├── app-shell.tsx
│   │   │       ├── bottom-nav.tsx
│   │   │       ├── header.tsx
│   │   │       └── loading-screen.tsx
│   │   │
│   │   ├── hooks/                    # Custom React hooks
│   │   │   ├── use-auth.ts           # Firebase auth state
│   │   │   ├── use-companion.ts      # Gemini Live session management
│   │   │   ├── use-audio.ts          # Audio capture/playback
│   │   │   ├── use-navigator.ts      # Navigator WebSocket
│   │   │   └── use-firestore.ts      # Firestore queries
│   │   │
│   │   ├── lib/                      # Shared utilities
│   │   │   ├── firebase.ts           # Firebase client init
│   │   │   ├── firebase-admin.ts     # Firebase Admin (server-side)
│   │   │   ├── api-client.ts         # Backend API client (React Query)
│   │   │   ├── gemini-live.ts        # Gemini Live API wrapper
│   │   │   ├── audio-utils.ts        # PCM encode/decode, playback
│   │   │   ├── constants.ts          # App-wide constants
│   │   │   └── utils.ts              # General helpers
│   │   │
│   │   └── types/                    # TypeScript type definitions
│   │       ├── api.ts                # API request/response types
│   │       ├── firestore.ts          # Firestore document types
│   │       ├── companion.ts          # Companion session types
│   │       ├── navigator.ts          # Navigator session types
│   │       └── gemini.ts             # Gemini Live API message types
│   │
│   ├── .env.example
│   ├── next.config.ts
│   ├── tailwind.config.ts
│   ├── tsconfig.json
│   ├── postcss.config.mjs
│   └── package.json
│
├── backend/                          # Python ADK Agent Backend
│   ├── caria_agents/                 # ADK agent module (required convention)
│   │   ├── __init__.py               # from . import agent
│   │   ├── agent.py                  # root_agent definition
│   │   │
│   │   ├── agents/                   # Individual agent definitions
│   │   │   ├── __init__.py
│   │   │   ├── storyteller.py        # StorytellerAgent
│   │   │   ├── navigator.py          # NavigatorAgent
│   │   │   └── alert.py              # AlertAgent
│   │   │
│   │   ├── tools/                    # Tool function implementations
│   │   │   ├── __init__.py
│   │   │   ├── storyteller_tools.py  # generate_illustration, save_memory_chapter, etc.
│   │   │   ├── navigator_tools.py    # navigate_to_url, click_element, etc.
│   │   │   ├── alert_tools.py        # send_push_notification, send_email_alert, etc.
│   │   │   └── companion_tools.py    # analyze_medication, log_health_checkin (REST endpoints)
│   │   │
│   │   ├── instructions/             # Agent system prompts
│   │   │   ├── __init__.py
│   │   │   ├── coordinator.py
│   │   │   ├── storyteller.py
│   │   │   ├── navigator.py
│   │   │   └── alert.py
│   │   │
│   │   └── callbacks/                # Safety and validation callbacks
│   │       ├── __init__.py
│   │       ├── safety.py             # Input safety guards
│   │       └── navigator_guard.py    # URL validation for navigator
│   │
│   ├── api/                          # Custom FastAPI endpoints
│   │   ├── __init__.py
│   │   ├── routes/
│   │   │   ├── __init__.py
│   │   │   ├── companion.py          # /api/companion/* (tool execution endpoints)
│   │   │   ├── storyteller.py        # /api/storyteller/* (trigger story creation)
│   │   │   ├── navigator.py          # /api/navigator/* (start/manage nav sessions)
│   │   │   ├── health.py             # /api/health/* (health logs, reports)
│   │   │   ├── auth.py               # /api/auth/* (user management, family links)
│   │   │   └── gemini_token.py       # /api/gemini/token (ephemeral tokens)
│   │   ├── middleware/
│   │   │   ├── __init__.py
│   │   │   └── firebase_auth.py      # Firebase token verification middleware
│   │   └── websocket/
│   │       ├── __init__.py
│   │       └── navigator_stream.py   # WebSocket for navigator screenshots
│   │
│   ├── services/                     # Business logic layer
│   │   ├── __init__.py
│   │   ├── firestore_service.py      # Firestore CRUD operations
│   │   ├── storage_service.py        # Cloud Storage operations
│   │   ├── imagen_service.py         # Vertex AI Imagen integration
│   │   ├── notification_service.py   # FCM push notifications
│   │   ├── scheduler_service.py      # Cloud Scheduler integration
│   │   └── browser_service.py        # Playwright browser pool management
│   │
│   ├── models/                       # Python data models
│   │   ├── __init__.py
│   │   ├── user.py                   # User, FamilyLink dataclasses
│   │   ├── health.py                 # HealthLog, Medication, Reminder
│   │   ├── memory.py                 # Memory, Chapter, Report
│   │   ├── alert.py                  # Alert, Signal dataclasses
│   │   ├── navigator.py              # NavigatorTask, Screenshot
│   │   └── api.py                    # API request/response schemas
│   │
│   ├── tests/                        # Test suite
│   │   ├── __init__.py
│   │   ├── conftest.py               # Shared fixtures
│   │   ├── test_tools/               # Unit tests for tool functions
│   │   │   ├── __init__.py
│   │   │   ├── test_storyteller_tools.py
│   │   │   ├── test_navigator_tools.py
│   │   │   └── test_alert_tools.py
│   │   ├── test_api/                 # API endpoint tests
│   │   │   ├── __init__.py
│   │   │   └── test_routes.py
│   │   └── eval/                     # ADK evaluation datasets
│   │       ├── storyteller_eval.test.json
│   │       └── navigator_eval.test.json
│   │
│   ├── main.py                       # FastAPI app entry point
│   ├── pyproject.toml
│   ├── Dockerfile
│   └── .env.example
│
├── docs/
│   ├── architecture/                 # Architecture documents (this folder)
│   │   ├── project-structure.md
│   │   ├── api-contracts.md
│   │   ├── agent-orchestration.md
│   │   └── data-flow.md
│   ├── plans/
│   │   └── 2026-02-27-olaf-design.md
│   └── research/
│       ├── gemini-live-api.md
│       ├── google-adk.md
│       └── firebase-gcp-infra.md
│
├── .gitignore
├── docker-compose.yml                # Local dev: backend + Firestore emulator
└── README.md
```

## Key Architectural Decisions

### Frontend (Next.js App Router)

- **Route Groups:** `(auth)`, `(app)`, `(family)` separate layout concerns without affecting URL paths
- **BFF Pattern:** The `/api/gemini/token` route is a Next.js API route that acts as a backend-for-frontend, handling ephemeral token provisioning with Firebase auth verification
- **Component Organization:** Feature-based folders (`companion/`, `navigator/`, etc.) for discoverability
- **Hooks:** Custom hooks encapsulate Gemini Live session management, audio handling, and Firebase state

### Backend (Python ADK)

- **ADK Convention:** `caria_agents/` follows ADK's required structure — `__init__.py` imports agent module, `agent.py` exports `root_agent`
- **Separation of Concerns:**
  - `caria_agents/` — Agent definitions, tools, instructions, callbacks (ADK domain)
  - `api/` — Custom FastAPI routes, middleware, WebSocket handlers (HTTP domain)
  - `services/` — Business logic shared between agents and API routes
  - `models/` — Python dataclasses for type safety
- **Custom endpoints** live alongside ADK's built-in `/run_sse` endpoint via `get_fast_api_app()`

### Shared Types

- Frontend types: `frontend/src/types/` (TypeScript interfaces)
- Backend types: `backend/models/` (Python dataclasses)
- Kept in sync manually — both define the same API contracts documented in `api-contracts.md`
