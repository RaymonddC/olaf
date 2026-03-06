# OLAF — AI Elderly Care Companion

## Design Document

**Date:** 2026-02-27
**Target:** Gemini Live Agent Challenge (Devpost) — Deadline March 16, 2026
**Vision:** Hackathon-first, startup-ready codebase

---

## 1. Product Overview

OLAF is an AI-powered elderly care companion that combines real-time voice conversation, creative storytelling, and digital navigation to serve elderly users and their families.

Three core agents work together:

- **CompanionAgent** — Real-time voice/vision companion via Gemini Live API
- **StorytellerAgent** — Transforms health data and memories into illustrated stories
- **NavigatorAgent** — Controls a headless browser to navigate websites on behalf of users

A fourth agent, **AlertAgent**, evaluates signals from all agents and routes notifications to family members.

---

## 2. Architecture Decision: Hybrid (ADK + Direct Gemini Live API)

**Why hybrid:**

- Voice companion needs direct WebSocket to Gemini Live API for lowest latency real-time streaming
- ADK is used for agent orchestration, storyteller, navigator, and alert management
- This gives judges the ADK story while being pragmatic about real-time audio

**What this means:**

- CompanionAgent runs in the browser — WebSocket direct to Gemini Live API
- All other agents run server-side through ADK on Cloud Run
- Frontend is a Next.js PWA (web-only, no native mobile)

---

## 3. System Architecture

```
Browser (Next.js PWA)
├── Voice Companion UI ──► WebSocket ──► Gemini Live API (direct)
│   (mic + webcam via WebRTC)
│
├── Memory/Health UI    ──► REST API  ──► ADK Agent Backend (Python)
├── Navigator UI        ──► REST/WS   ──► ADK Agent Backend (Python)
└── Family Dashboard    ──► REST API  ──► ADK Agent Backend (Python)
                                              │
                                    ┌─────────┴─────────┐
                                    │                    │
                                Firestore          Cloud Storage
                             (user data,         (generated images,
                              health logs,        audio, reports)
                              conversations)
```

---

## 4. Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14+ (App Router), TypeScript, Tailwind CSS |
| Voice/Vision | Gemini Live API (WebSocket from browser) |
| Agent Backend | Python + Google ADK |
| Agents | 4 ADK agents (Companion Coordinator, Storyteller, Navigator, Alert) |
| Image Generation | Imagen 3 via Vertex AI |
| Database | Firestore |
| File Storage | Cloud Storage (images, audio, PDFs) |
| Auth | Firebase Auth (email + Google SSO) |
| Notifications | Firebase Cloud Messaging (browser push) |
| Hosting | Cloud Run (backend) + Vercel or Cloud Run (frontend) |
| Headless Browser | Playwright (server-side, for NavigatorAgent) |
| CI/CD | GitHub Actions |

---

## 5. Feature Scope (Web-Only)

### 5.1 Live Agent — CompanionAgent

Real-time voice companion via browser mic + webcam.

**Features:**

- Daily check-in conversations with adaptive pacing
- Medication scanning — hold bottle to webcam, agent reads label and confirms dosage
- Medication, appointment, hydration reminders (scheduled via backend)
- Emotional tone monitoring with family escalation
- Patient interruption handling and repetitive question tolerance
- Conversation logging for health reports

**Removed from scope (requires mobile):**

- Real-time fall detection (needs always-on camera, unreliable via webcam)

### 5.2 Creative Storyteller — StorytellerAgent

Transforms health data and spoken memories into illustrated content.

**Features:**

- Memory Journal — user speaks memories, agent creates illustrated life story chapters
- Daily Health Narrative — auto-generated illustrated summary for family
- Weekly Family Report — health metrics, mood trends, notable moments
- Legacy Storybook — compiled life stories as downloadable illustrated book with audio script

### 5.3 Digital Navigator — NavigatorAgent

Controls a server-side headless browser to help elderly users interact with websites.

**Features:**

- Navigate government portals for pension/benefits info
- Book medical appointments
- Read and summarize medical reports/insurance documents
- Fill online forms for subsidies, claims, community services
- Help navigate video call apps

**Design decision:** Agent controls its own headless Playwright browser on the server. Screenshots are streamed to the user's screen. User confirms sensitive actions (login, form submit) before agent executes.

### 5.4 Alert Management — AlertAgent

Evaluates incoming signals and decides notification routing.

**Signal types:**

| Signal | Low | Medium | High |
|---|---|---|---|
| Emotional distress | Log only | Push notification to primary contact | Urgent to all contacts |
| Missed medication | Re-remind user | Notify family | Flag in weekly report |
| Health anomaly | Include in daily report | Notify family | Urgent alert |
| Inactivity (no check-in) | — | Notify after 24h | Urgent after 48h |

### 5.5 Family Dashboard

Web dashboard for family members and caregivers.

**Features:**

- Real-time alerts (emotional distress, missed medications)
- View health reports and memory journals
- Conversation history summaries
- Multi-user support (elderly user + multiple family members)
- Weekly email digest option

---

## 6. Detailed Agent Design

### 6.1 CompanionAgent (Gemini Live API — Browser Direct)

**Connection:** Browser WebSocket → Gemini Live API

**Model:** `gemini-2.5-flash-native-audio`

**Audio format:** 16-bit PCM, 16kHz, mono

**Security:** Ephemeral tokens (not raw API keys) for client-to-server connection

**System instruction (sent on WebSocket connect):**

```
You are OLAF, a warm, patient elderly care companion. Speak slowly and clearly.
The user is {user.name}, age {user.age}.
Their medications: {medications_list}.
Today's reminders: {reminders_list}.
Their recent mood pattern: {recent_mood}.

BEHAVIOR:
- Always greet by name
- If user repeats a question, answer again without frustration
- If user is silent 30+ seconds, gently prompt: "I'm still here if you need me"
- If user mentions pain, loneliness, or confusion → call flag_emotional_distress
- If user holds up a pill bottle → analyze camera feed and call analyze_medication
- At end of conversation → call log_health_checkin with summary
- Never rush. Pause between sentences. Match user's speaking pace.
- Handle interruptions gracefully — Gemini clears audio queue on interruption
```

**Function tools (via Gemini function calling):**

```python
def analyze_medication(image_description: str) -> dict:
    """User is showing a medication bottle to camera.
    Analyze visible label and compare against prescribed medications.

    Args:
        image_description: What the model sees on the bottle label

    Returns:
        dict with medication_name, dosage, match_status, guidance
    """

def flag_emotional_distress(severity: str, observation: str) -> dict:
    """Detect emotional distress in user's voice or words.

    Args:
        severity: low | medium | high
        observation: What triggered this assessment
    """

def log_health_checkin(mood: str, pain_level: int, notes: str) -> dict:
    """Log user's daily health check-in data.

    Args:
        mood: happy | okay | sad | anxious | confused | tired
        pain_level: 0-10 scale
        notes: Health observations from conversation
    """

def set_reminder(reminder_type: str, message: str, time: str) -> dict:
    """Set a reminder for the user.

    Args:
        reminder_type: medication | appointment | hydration | custom
        message: What to remind about
        time: ISO format or relative ('in 2 hours')
    """
```

### 6.2 StorytellerAgent (ADK)

**Connection:** Next.js backend → ADK Python server

**Triggers:**

- Automatic: daily cron → health narrative
- Automatic: weekly cron → family report
- User-initiated: "I want to tell a story" via companion
- Family-initiated: report request from dashboard

**Agent definition:**

```python
storyteller_agent = LlmAgent(
    model="gemini-2.5-flash",
    name="storyteller",
    description="Transforms health data and spoken memories into illustrated stories and reports",
    instruction="...",  # Full instruction below
    tools=[
        generate_illustration,
        save_memory_chapter,
        save_health_narrative,
        save_weekly_report,
        get_health_logs,
        get_conversation_summaries,
        get_user_memories,
    ]
)
```

**Instruction:**

```
You are OLAF's storyteller. You transform raw data into warm, human-readable
narratives and illustrated content.

MEMORY CHAPTER:
- Take user's spoken transcript and reshape into a coherent story
- Preserve their voice and personality — don't over-polish
- Add gentle structure (beginning, middle, end)
- Generate 2-3 illustration prompts that capture key moments
- Output: {title, narrative_text, illustration_prompts[], audio_script}

DAILY HEALTH NARRATIVE:
- Summarize health check-in data into a warm paragraph for family
- Highlight concerns (missed medications, low mood) clearly but not alarmingly
- Include positive moments
- Generate 1 illustration prompt for the day's theme

WEEKLY FAMILY REPORT:
- Aggregate 7 days into trends
- Mood graph data, medication adherence %, activity highlights
- Top 3 memorable moments from conversations
- Concerns needing family attention
- Tone: informative, warm, never clinical

LEGACY STORYBOOK:
- Compile selected memory chapters into cohesive narrative
- Generate illustration prompts for each chapter
- Create audio narration script for text-to-speech
```

**Tool functions:**

```python
def generate_illustration(prompt: str, style: str = "warm watercolor") -> dict:
    """Generate illustration using Imagen 3 via Vertex AI.

    Args:
        prompt: Scene description
        style: 'warm watercolor' | 'soft pencil sketch' | 'gentle oil painting'

    Returns:
        dict with image_url in Cloud Storage
    """

def save_memory_chapter(user_id: str, title: str, narrative: str,
                         illustration_urls: list, audio_script: str) -> dict:
    """Save completed memory chapter."""

def save_health_narrative(user_id: str, date: str, narrative: str,
                           illustration_url: str, concerns: list) -> dict:
    """Save daily health narrative."""

def save_weekly_report(user_id: str, week_start: str, report_data: dict) -> dict:
    """Save weekly family report."""

def get_health_logs(user_id: str, date_range: str) -> dict:
    """Retrieve health check-in logs. date_range: 'today' | 'week' | 'month' | 'YYYY-MM-DD:YYYY-MM-DD'"""

def get_conversation_summaries(user_id: str, date_range: str) -> dict:
    """Get summaries of companion conversations."""

def get_user_memories(user_id: str, limit: int = 10) -> dict:
    """Get user's existing memory chapters."""
```

**Memory Journal pipeline:**

```
1. User says to CompanionAgent: "I want to tell you about my wedding day"
2. CompanionAgent records full conversation transcript
3. CompanionAgent saves transcript → Firestore (raw_memories)
4. Backend triggers StorytellerAgent:
   {action: "create_memory_chapter", transcript: "...", user_id: "..."}
5. StorytellerAgent:
   a. Reshapes raw transcript into narrative prose
   b. Generates 3 illustration prompts from key moments
   c. Calls generate_illustration() 3 times
   d. Calls save_memory_chapter() with compiled result
6. Family dashboard shows new chapter notification
7. User can replay chapter with TTS narration + illustrations
```

### 6.3 NavigatorAgent (ADK + Playwright)

**Connection:** Next.js backend → ADK Python server → Playwright headless browser

**Design:** Agent controls its own headless browser on the server. Screenshots stream to user's frontend via WebSocket. User confirms sensitive actions.

**Agent definition:**

```python
navigator_agent = LlmAgent(
    model="gemini-2.5-flash",
    name="navigator",
    description="Navigates websites on behalf of elderly users via headless browser",
    instruction="...",  # Full instruction below
    tools=[
        navigate_to_url,
        take_screenshot,
        click_element,
        type_text,
        scroll_page,
        read_page_text,
        summarize_content,
        ask_user_confirmation,
    ]
)
```

**Instruction:**

```
You are OLAF's digital navigator. You help elderly users interact with websites.

WORKFLOW:
1. Navigate to requested URL
2. Take screenshot and analyze the page
3. Decide action (click, type, scroll)
4. Before ANY login or form submission → PAUSE and ask user
5. Execute action
6. Repeat until complete
7. Summarize results in simple language

RULES:
- NEVER enter credentials without user confirmation
- Stream every screenshot so user sees what you're doing
- Explain each step simply: "I'm clicking the blue button that says Check Status"
- If CAPTCHA → ask user to solve it
- If page looks suspicious → warn user and stop
- For medical/financial info → read, summarize in plain language, never store raw sensitive data
```

**Tool functions:**

```python
def navigate_to_url(url: str) -> dict:
    """Navigate headless browser to URL."""

def take_screenshot() -> dict:
    """Capture current browser state. Returns screenshot_url and page_analysis."""

def click_element(element_description: str, coordinates: str) -> dict:
    """Click element. Coordinates from screenshot analysis."""

def type_text(field_description: str, text: str, coordinates: str) -> dict:
    """Type into form field."""

def scroll_page(direction: str, amount: int) -> dict:
    """Scroll page. direction: up | down"""

def read_page_text() -> dict:
    """Extract all text from current page."""

def summarize_content(raw_text: str, context: str) -> dict:
    """Summarize complex text in simple language."""

def ask_user_confirmation(action_description: str) -> dict:
    """Pause and ask user to confirm sensitive action."""
```

**Pre-configured task templates:**

| Task | Starting URL | Flow |
|---|---|---|
| Check pension status | Government pension portal | Login → status page → read → summarize |
| Book medical appointment | Hospital booking site | Department → date → form → confirm |
| Read medical report | Insurance/hospital portal | Login → documents → extract → summarize |
| Fill subsidy form | Government services | Navigate → fill fields → review → submit |

### 6.4 AlertAgent (ADK)

**Connection:** Receives signals from all agents via Firestore triggers or direct API calls.

**Agent definition:**

```python
alert_agent = LlmAgent(
    model="gemini-2.5-flash",
    name="alert_manager",
    description="Evaluates signals and routes notifications to family members",
    instruction="...",  # Full instruction below
    tools=[
        send_push_notification,
        send_email_alert,
        log_to_daily_report,
        get_user_baseline,
        get_family_contacts,
    ]
)
```

**Instruction:**

```
You evaluate incoming signals from other OLAF agents and decide the response.

EMOTIONAL_DISTRESS:
- low → log only, mention in daily report
- medium → push notification to primary family contact
- high → URGENT notification to all family contacts

MISSED_MEDICATION:
- first miss → re-remind user via companion
- second miss → notify family
- pattern of misses → flag in weekly report

HEALTH_ANOMALY:
- unusual mood pattern → include in daily report
- sudden change (pain 3+ days) → notify family

INACTIVITY:
- no conversation 24h (when daily check-in enabled) → notify family
- no conversation 48h → urgent alert

RULES:
- Never alert for trivial things — notification fatigue is real
- Group non-urgent items into daily/weekly reports
- Urgent = immediate danger or significant deviation from baseline
```

---

## 7. Data Model (Firestore)

```
users/
  {userId}/
    profile: {
      name, age, timezone, language,
      medications: [{name, dosage, frequency, times[]}],
      appointments: [{date, doctor, location, notes}]
    }
    settings: {
      reminderTimes: {morning, afternoon, evening},
      voiceSpeed: "slow" | "normal",
      dailyCheckinTime: "09:00",
      familyContacts: [{userId, relationship, notificationPrefs}]
    }

    conversations/
      {convoId}: {
        timestamp, duration, transcript,
        moodScore: 1-10, flags: ["distress"|"confusion"|"pain"],
        summary: string
      }

    memories/
      {memoryId}: {
        spokenTranscript, title, narrativeText,
        illustrationUrls: [], audioScript,
        createdAt, tags: []
      }

    healthLogs/
      {date}: {
        medicationsTaken: [{name, time, confirmed: bool}],
        mood: string, moodScore: 1-10,
        painLevel: 0-10,
        activityNotes: string,
        hydrationReminders: {sent: int, acknowledged: int}
      }

    reports/
      {reportId}: {
        type: "daily" | "weekly",
        content: string,
        imageUrls: [],
        moodTrend: [],
        medicationAdherence: float,
        concerns: [],
        highlights: [],
        generatedAt
      }

    reminders/
      {reminderId}: {
        type: "medication" | "appointment" | "hydration" | "custom",
        message, scheduledTime, status: "pending" | "sent" | "acknowledged",
        recurring: bool, recurrencePattern
      }

familyLinks/
  {linkId}: {
    elderlyUserId, familyUserId,
    relationship, permissions: ["view_reports"|"receive_alerts"|"view_conversations"],
    createdAt
  }

alerts/
  {alertId}: {
    userId, type, severity: "low" | "medium" | "high",
    message, source: "companion" | "storyteller" | "navigator" | "system",
    acknowledged: bool, acknowledgedBy, createdAt
  }
```

---

## 8. Agent Interconnection

```
CompanionAgent (browser → Gemini Live API)
    │
    ├── on conversation end → POST /api/conversations/log
    │   → saves transcript + mood to Firestore
    │   → triggers AlertAgent if flags detected
    │
    ├── on "tell me a story" → POST /api/storyteller/memory
    │   → ADK routes to StorytellerAgent
    │
    └── on "help me with [website]" → POST /api/navigator/task
        → ADK routes to NavigatorAgent

StorytellerAgent
    ├── reads from Firestore (health logs, conversations, memories)
    └── writes to Firestore + Cloud Storage (chapters, reports, images)

NavigatorAgent
    ├── controls headless Playwright browser on server
    ├── streams screenshots to frontend via WebSocket
    └── pauses for user confirmation at sensitive steps

AlertAgent
    ├── receives signals from all agents
    ├── sends Firebase Cloud Messaging push notifications
    └── sends email alerts for urgent situations
```

---

## 9. UX Principles for Elderly Users

- Large text (min 18px base), high contrast ratios (WCAG AAA)
- Minimal navigation — max 3 main screens: Talk, Memories, Help
- Voice-first — every action triggerable by voice
- No jargon — "Talk to OLAF" not "Initialize Voice Session"
- Forgiveness — undo everything, confirm destructive actions, repeat anything
- Always show loading states — elderly users panic at blank screens
- Big touch targets (min 48px) for tablet use
- Consistent layout — nothing moves between visits
- Audio feedback — gentle sounds for confirmations and alerts

---

## 10. Security and Privacy

- Ephemeral tokens for Gemini Live API (never expose raw API keys to browser)
- Firebase Auth with email + Google SSO
- Firestore security rules — elderly user data readable only by linked family members
- Health data encrypted at rest (Firestore default)
- NavigatorAgent never stores raw credentials — user enters them directly
- No raw medical/financial data stored from navigator sessions — only summaries
- HTTPS everywhere, secure WebSocket (wss://)

---

## 11. Build Roadmap (18 Days)

| Days | Focus | Deliverable |
|---|---|---|
| 1-3 | Scaffold Next.js + ADK + Firebase + Auth + CI/CD | Boilerplate running, deployed to Cloud Run |
| 4-7 | CompanionAgent — voice + medication scan | Working voice chat + webcam medication reading |
| 8-11 | StorytellerAgent — memory journal + health reports | Speak memory → illustrated chapter pipeline |
| 12-14 | NavigatorAgent — portal navigation + form filling | Agent navigates demo government portal |
| 15-16 | Family Dashboard + AlertAgent + integration | Dashboard showing reports, alerts, conversations |
| 17 | Record demo video (4 minutes) | Compelling story-driven demo |
| 18 | Write Devpost submission + polish | Submission complete |

---

## 12. Post-Hackathon Startup Path

- React Native mobile app (wrap core logic, add camera-native features)
- Fall detection via dedicated tablet/camera device
- Partnerships with retirement homes (multi-resident dashboard)
- HIPAA compliance layer for US healthcare market
- Subscription model: Free (basic companion) → Premium (full suite)
- Multilingual support (critical for global elderly population)
- Integration with wearables (smartwatch health data feeds)

---

## Design Updates (Post-Research)

**Date:** 2026-02-28
**Source:** Google ADK documentation deep-dive (see `docs/research/google-adk.md`)

### Update 1: AlertAgent Should Use `AgentTool`, Not `sub_agents`

**Problem:** The original design places AlertAgent as a peer sub-agent alongside Storyteller and Navigator. ADK's `sub_agents` uses LLM-driven delegation — the coordinator's LLM reads each sub-agent's `description` and decides when to transfer control. This works well for user-initiated requests ("help me navigate this website") but poorly for system-triggered signals (emotional distress flags, missed medication events).

**Fix:** Wrap AlertAgent in `AgentTool` so it's invoked explicitly:

```python
root_agent = Agent(
    name="olaf_coordinator",
    sub_agents=[storyteller_agent, navigator_agent],  # LLM-driven delegation
    tools=[AgentTool(agent=alert_agent)]              # Explicit invocation
)
```

### Update 2: Add `ToolContext` to All Tool Signatures

**Problem:** The design doc's tool functions (e.g., `analyze_medication`, `log_health_checkin`) don't include `ToolContext`. ADK injects this parameter automatically when present — it provides access to session state, artifacts, and actions.

**Fix:** Add `tool_context: ToolContext` as the last parameter to any tool that needs to read user data, write state, or save artifacts:

```python
from google.adk.tools.tool_context import ToolContext

def analyze_medication(image_description: str, tool_context: ToolContext) -> dict:
    user_id = tool_context.state.get("user_id")
    medications = tool_context.state.get("medications", [])
    # ...
```

### Update 3: StorytellerAgent Can Use SequentialAgent for Pipelines

**Problem:** The design has StorytellerAgent as a single monolithic LlmAgent that handles parsing, writing, illustrating, and saving in one shot. For complex multi-step tasks (memory chapter creation), this may produce inconsistent results.

**Recommended alternative:** For the memory chapter pipeline, use a `SequentialAgent` with specialized sub-agents that pass data via `output_key`:

```python
story_pipeline = SequentialAgent(
    name="story_pipeline",
    sub_agents=[
        Agent(name="parser", output_key="parsed_memory", instruction="Parse transcript..."),
        Agent(name="writer", output_key="narrative", instruction="Write story from {parsed_memory}..."),
        Agent(name="illustrator", output_key="illustrations", instruction="Create prompts from {narrative}..."),
    ]
)
```

**Note:** Keep the monolithic StorytellerAgent for simpler tasks (daily narratives, weekly reports). Use the pipeline only for complex memory chapter creation.

### Update 4: Use `GcsArtifactService` for Generated Content

ADK has a built-in `GcsArtifactService` that stores versioned binary data in Cloud Storage. This replaces the need for manual Cloud Storage integration for illustrations, audio scripts, and PDFs:

```python
from google.adk.artifacts import GcsArtifactService

artifact_service = GcsArtifactService(bucket_name="olaf-artifacts")
```

### Update 5: Add Safety Callbacks for Navigator

ADK supports `before_tool_callback` which can intercept tool calls before execution. For NavigatorAgent, add URL validation:

```python
navigator_agent = Agent(
    name="navigator",
    before_tool_callback=validate_navigation_safety,
    # ...
)
```

### Update 6: Standardize Tool Return Format

All tool functions should return `dict` with a `status` field per ADK best practices:

```python
# Success
return {"status": "success", "data": {...}}

# Error
return {"status": "error", "error_message": "Human-readable explanation"}

# Pending (long-running)
return {"status": "pending", "operation_id": "abc123"}
```

### Update 7: Session State Scoping

ADK supports state prefixes for different scopes. Use these for OLAF:

| Prefix | Scope | OLAF Use |
|---|---|---|
| (none) | Session | Current conversation context |
| `user:` | User (cross-session) | Medications, preferences, contacts |
| `app:` | Global | Feature flags, system config |
| `temp:` | Ephemeral (cleared between invocations) | Intermediate pipeline data |

### Update 8: REST API Serving via `get_fast_api_app`

ADK provides `get_fast_api_app()` which creates a production-ready FastAPI app. Custom endpoints (e.g., `/api/storyteller/memory`, `/api/navigator/task`) can be added alongside ADK's built-in `/run_sse` endpoint:

```python
from google.adk.cli.fast_api import get_fast_api_app

app = get_fast_api_app(
    agents_dir=AGENT_DIR,
    session_service_uri="sqlite+aiosqlite:///./sessions.db",
    allow_origins=["http://localhost:3000"],
    web=False
)

# Custom OLAF endpoints
@app.post("/api/storyteller/create-memory")
async def create_memory(request: MemoryRequest):
    # Trigger storyteller via Runner
    pass
```

---

**Date:** 2026-02-28
**Source:** Gemini Live API research (see `docs/research/gemini-live-api.md`)

### Update 9: Model ID Correction

The design doc references `gemini-2.5-flash-native-audio` but the actual model ID is:

```
gemini-2.5-flash-native-audio-preview-12-2025
```

Update all CompanionAgent references to use the full preview model ID.

### Update 10: Session Management Required

The Live API has hard session limits not accounted for in the original design:

- **Audio-only sessions:** ~15 min without compression
- **Audio+video sessions:** ~2 min without compression
- **WebSocket connections:** ~10 min max regardless

**Required additions to CompanionAgent:**
- Enable `contextWindowCompression: { slidingWindow: {} }` on every session
- Enable `sessionResumption` on every session; store handles in component state
- Handle `goAway` server messages to trigger automatic reconnection
- This enables effectively unlimited conversation duration

### Update 11: VAD Tuning for Elderly Users

Add specific VAD configuration for elderly interaction:

```javascript
realtimeInputConfig: {
  automaticActivityDetection: {
    startOfSpeechSensitivity: "START_SENSITIVITY_LOW",   // Avoid triggering on coughs/breathing
    endOfSpeechSensitivity: "END_SENSITIVITY_LOW",       // Allow longer pauses between words
    silenceDurationMs: 800                                // 800ms silence before end-of-turn
  },
  activityHandling: "START_OF_ACTIVITY_INTERRUPTS"
}
```

The "30+ seconds silence prompt" must be implemented as a **client-side timer**, not through VAD.

### Update 12: Non-Blocking Tool Calls

Updated tool strategy using Live API's async function calling:

| Tool | Behavior | Scheduling | Reason |
|---|---|---|---|
| `analyze_medication` | Blocking (default) | N/A | User is waiting for answer |
| `flag_emotional_distress` | `NON_BLOCKING` | `SILENT` | Don't disrupt conversation |
| `log_health_checkin` | `NON_BLOCKING` | `SILENT` | Background logging |
| `set_reminder` | `NON_BLOCKING` | `WHEN_IDLE` | Confirm to user at natural pause |

### Update 13: Video Strategy — On-Demand, Not Continuous

Audio+video sessions burn through context quickly (2-min limit without compression). Updated strategy:

- **Default:** Audio-only mode (no video frames sent)
- **Medication scan:** User activates camera → JPEG frames at ~1 FPS (768x768, quality 90) → model analyzes → camera deactivates
- Even with compression, continuous video is expensive ($3/1M tokens for audio/video input)

### Update 14: Enable Transcription for Conversation Logging

The API natively supports speech transcription:

```javascript
inputAudioTranscription: {},   // Transcribes user speech
outputAudioTranscription: {}   // Transcribes model speech
```

Transcriptions should be accumulated client-side and sent to backend on session end for health reports and memory journal features.

### Update 15: Ephemeral Token Endpoint with Locked Config

Add backend endpoint:

```
POST /api/gemini/token
  Auth: Firebase Bearer token
  Body: { userId: string }
  Response: { token: string }
```

Token created with `liveConnectConstraints` that lock system instruction, model, tools, and voice. Prevents client tampering. Use `enableAffectiveDialog: true` for emotional voice quality and `proactiveAudio: true` to ignore background noise.

---

**Date:** 2026-02-28
**Source:** Firebase/GCP infrastructure research (see `docs/research/firebase-gcp-infra.md`)

### Update 16: Cold Start Mitigation for NavigatorAgent

**Problem:** Cloud Run cold starts with a Playwright container (Chromium installed) can take 10-30 seconds. This delays the first NavigatorAgent request significantly, which is confusing for elderly users.

**Fix:** During demo and production, set `min-instances: 1` for the Cloud Run service to keep one warm instance. Show a loading animation ("OLAF is preparing to help you navigate...") during any cold start. Optionally pre-warm with a health check before user initiates navigation.

```bash
gcloud run deploy olaf-backend --min-instances 1
```

### Update 17: Use Permanent URLs for Storybook Content

**Problem:** Cloud Storage signed URLs expire (typically 7 days). If a family member bookmarks a storybook page, illustrations stop loading after expiration.

**Fix:** For long-lived content (storybook illustrations, memory chapter images), use Firebase Storage download URLs with security rules instead of signed URLs. Reserve signed URLs for ephemeral content like navigator screenshots.

### Update 18: Cloud Run Deployment Configuration

The backend requires specific Cloud Run settings for WebSocket support and Playwright:

```bash
gcloud run deploy olaf-backend \
  --memory 2Gi \
  --cpu 2 \
  --timeout 3600 \
  --concurrency 100 \
  --no-use-http2 \       # HTTP/2 end-to-end is incompatible with WebSocket
  --min-instances 0 \    # Set to 1 for demo
  --max-instances 5
```

### Update 19: Use Custom Claims for Family Access Control

**Problem:** Firestore security rules that look up `familyLinks` documents for every access incur extra read costs and add latency.

**Fix:** Use Firebase Auth custom claims to encode the family relationship directly in the user's ID token. This allows zero-cost, instant permission checks in Firestore security rules:

```python
# Backend: Set family link as custom claim
auth.set_custom_user_claims(family_uid, {
    "role": "family_member",
    "linked_elderly_users": ["elderly_uid_1", "elderly_uid_2"],
})
```

```javascript
// Firestore rule: Check custom claim (no extra reads)
function isFamilyViaClaims(elderlyUserId) {
  return request.auth.token.role == "family_member" &&
    elderlyUserId in request.auth.token.linked_elderly_users;
}
```

**Limitation:** Custom claims max 1000 bytes. Supports ~35 linked elderly users per family member, which is more than sufficient.

### Update 20: Imagen Model Selection

Use `imagen-3.0-generate-002` for high-quality memory illustrations and `imagen-3.0-fast-generate-001` for daily health narrative images ($0.02/image vs ~$0.04/image). The google-genai SDK is the recommended integration path:

```python
from google import genai
from google.genai.types import GenerateImagesConfig

client = genai.Client()
response = client.models.generate_images(
    model="imagen-3.0-generate-002",
    prompt="...",
    config=GenerateImagesConfig(
        number_of_images=1,
        aspect_ratio="4:3",
        person_generation="allow_adult",
    ),
)
```
