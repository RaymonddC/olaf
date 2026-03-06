# OLAF — Agent Orchestration

## 1. Agent Hierarchy

```
┌─────────────────────────────────────────────────────┐
│                    Browser (PWA)                     │
│                                                     │
│  CompanionAgent ──WebSocket──► Gemini Live API      │
│       │                        (direct, not ADK)    │
│       │ REST calls on tool invocations              │
│       ▼                                             │
└───────┬─────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────┐
│              ADK Backend (Cloud Run)                 │
│                                                     │
│  ┌─────────────────────────────────┐                │
│  │      olaf_coordinator          │                │
│  │      (root_agent)               │                │
│  │                                 │                │
│  │  sub_agents:                    │                │
│  │    ├── storyteller_agent        │                │
│  │    └── navigator_agent          │                │
│  │                                 │                │
│  │  tools:                         │                │
│  │    └── AgentTool(alert_agent)   │                │
│  └─────────────────────────────────┘                │
│                                                     │
│  Custom REST/WS endpoints also trigger agents       │
│  directly via Runner (bypass coordinator)           │
└─────────────────────────────────────────────────────┘
```

## 2. Agent Definitions

### 2.1 CompanionAgent (Browser — NOT ADK)

- **Runtime:** Browser JavaScript/TypeScript
- **Connection:** Direct WebSocket to Gemini Live API
- **Model:** `gemini-2.5-flash-native-audio-preview-12-2025`
- **Purpose:** Real-time voice + vision companion
- **Tool calls:** Executed via REST to backend (`/api/companion/*`)
- **Not part of ADK hierarchy** — communicates with backend via REST

### 2.2 olaf_coordinator (Root Agent — ADK)

```python
root_agent = Agent(
    model="gemini-2.5-flash",
    name="olaf_coordinator",
    description="Routes requests to storyteller, navigator, or alert agents.",
    instruction=COORDINATOR_INSTRUCTION,
    sub_agents=[storyteller_agent, navigator_agent],  # LLM-driven delegation
    tools=[AgentTool(agent=alert_agent)],             # Explicit invocation
    before_model_callback=safety_before_model,
)
```

**Delegation strategy:**
- User asks for story/memory/report → LLM transfers to `storyteller`
- User asks to navigate website → LLM transfers to `navigator`
- System needs alert evaluation → coordinator calls `AgentTool(alert_agent)`

### 2.3 StorytellerAgent (ADK Sub-Agent)

```python
storyteller_agent = Agent(
    model="gemini-2.5-flash",
    name="storyteller",
    description="Creates illustrated stories from memories, daily health narratives, "
                "weekly family reports, and legacy storybooks.",
    instruction=STORYTELLER_INSTRUCTION,
    tools=[
        generate_illustration,
        save_memory_chapter,
        save_health_narrative,
        save_weekly_report,
        get_health_logs,
        get_conversation_summaries,
        get_user_memories,
    ],
    output_key="storyteller_result",
)
```

**Invocation paths:**
1. Via coordinator delegation (user request through `/run_sse`)
2. Directly via Runner from `/api/storyteller/*` endpoints
3. Via Cloud Scheduler cron jobs (daily narratives, weekly reports)

### 2.4 NavigatorAgent (ADK Sub-Agent)

```python
navigator_agent = Agent(
    model="gemini-2.5-flash",
    name="navigator",
    description="Navigates websites via headless browser for government portals, "
                "medical appointments, forms, and document retrieval.",
    instruction=NAVIGATOR_INSTRUCTION,
    tools=[
        navigate_to_url,
        take_screenshot,
        click_element,
        type_text,
        scroll_page,
        read_page_text,
        summarize_content,
        ask_user_confirmation,
    ],
    before_tool_callback=validate_navigation_safety,
    output_key="navigator_result",
)
```

**Invocation paths:**
1. Via coordinator delegation
2. Directly via `/api/navigator/start` endpoint (preferred — bypasses coordinator for WebSocket session setup)

### 2.5 AlertAgent (ADK — Wrapped as AgentTool)

```python
alert_agent = Agent(
    model="gemini-2.5-flash",
    name="alert_manager",
    description="Evaluates signals and routes notifications to family members.",
    instruction=ALERT_INSTRUCTION,
    tools=[
        send_push_notification,
        send_email_alert,
        log_to_daily_report,
        get_user_baseline,
        get_family_contacts,
    ],
)
```

**Why AgentTool (not sub_agent):**
AlertAgent handles system-triggered signals, not user requests. Using `AgentTool` means the coordinator (or custom endpoint code) explicitly invokes it when a signal arrives, rather than relying on LLM description matching.

**Invocation paths:**
1. Via `AgentTool` from coordinator
2. Directly via Runner from companion tool endpoints (e.g., when `flag_emotional_distress` is called)

---

## 3. State Flow Between Agents

### 3.1 Session State Scoping

| Prefix | Scope | OLAF Usage |
|--------|-------|-------------|
| (none) | Session | Current conversation context, temp vars |
| `user:` | User (cross-session) | Medications, preferences, contacts, name, age |
| `app:` | Global | Feature flags, system config |
| `temp:` | Ephemeral (cleared between invocations) | Intermediate pipeline data |

### 3.2 State Initialization

When a session is created, populate user state from Firestore:

```python
session.state["user:user_id"] = user_profile.uid
session.state["user:name"] = user_profile.name
session.state["user:age"] = user_profile.age
session.state["user:medications"] = user_profile.medications
session.state["user:timezone"] = user_profile.timezone
session.state["user:family_contacts"] = family_contacts
```

### 3.3 Inter-Agent Data Flow

**Coordinator → Storyteller:**
- Coordinator sets `state["story_request"]` with task details
- Storyteller reads `{user:name}`, `{user:user_id}` from state
- Storyteller writes result to `state["storyteller_result"]` via `output_key`

**Coordinator → Navigator:**
- Coordinator sets `state["nav_task"]` with task and URL
- Navigator reads task from state, writes screenshots/results
- Navigator writes result to `state["navigator_result"]` via `output_key`

**Any Agent → AlertAgent (via AgentTool):**
- Calling agent passes signal data as the tool input text
- AlertAgent reads `{user:family_contacts}`, `{user:user_id}` from state
- AlertAgent evaluates severity and routes notification

### 3.4 Storyteller Pipeline State Flow (SequentialAgent)

For complex memory chapter creation:

```
parser (output_key="parsed_memory")
  → writer (reads {parsed_memory}, output_key="narrative")
    → illustrator (reads {narrative}, output_key="illustrations")
```

Each step saves to session state via `output_key`. The next step reads via instruction template `{variable_name}`.

---

## 4. Error Handling and Fallbacks

### 4.1 Agent-Level Error Handling

**before_model_callback (Input Safety):**
```python
def safety_before_model(callback_context, llm_request):
    """Block harmful content before it reaches the LLM."""
    last_msg = llm_request.contents[-1].parts[0].text
    if contains_blocked_pattern(last_msg):
        return LlmResponse(
            content=Content(role="model", parts=[Part(text="I can't help with that.")])
        )
    return None  # Proceed normally
```

**before_tool_callback (Navigator Safety):**
```python
def validate_navigation_safety(callback_context, tool_name, tool_args):
    """Validate URLs and actions before NavigatorAgent executes them."""
    if tool_name == "navigate_to_url":
        url = tool_args.get("url", "")
        if is_blocked_domain(url):
            return {"status": "error", "error_message": "This website is not allowed."}
    if tool_name in ["click_element", "type_text"]:
        # Log all interactions for audit trail
        log_navigator_action(callback_context, tool_name, tool_args)
    return None
```

### 4.2 Tool-Level Error Handling

All tools return standardized responses:

```python
# Success
return {"status": "success", "data": {...}}

# Error (recoverable — agent can retry or inform user)
return {"status": "error", "error_message": "Could not reach the website. Please try again."}

# Pending (long-running operation)
return {"status": "pending", "operation_id": "abc123"}
```

The LLM uses `error_message` to inform the user in natural language.

### 4.3 Fallback Patterns

**Storyteller image generation failure:**
1. Tool returns `{"status": "error", "error_message": "Image generation failed"}`
2. Agent instruction tells it: "If illustration fails, save the chapter without images and note that illustrations will be added later"
3. Memory chapter is saved with empty `illustration_urls`

**Navigator timeout/crash:**
1. Playwright browser has a 60-second page load timeout
2. On timeout, tool returns error
3. Agent narrates: "The website is taking too long to load. Would you like me to try again?"
4. If browser process crashes, `browser_service.py` detects and spawns a new instance

**Alert notification failure:**
1. FCM push fails → fall back to email
2. Email fails → log to daily report with elevated priority
3. All channels fail → log critical error, try again in 5 minutes

**Gemini Live API disconnection (CompanionAgent):**
1. Client detects WebSocket close or `goAway` message
2. Client stores `lastSessionHandle` from `sessionResumptionUpdate`
3. Client requests new ephemeral token from backend
4. Client reconnects with `sessionResumption.handle`
5. Conversation continues seamlessly

### 4.4 Rate Limiting & Circuit Breaking

```python
# In tool implementation
from functools import lru_cache
import time

class RateLimiter:
    def __init__(self, max_calls: int, period: float):
        self.max_calls = max_calls
        self.period = period
        self.calls = []

    def allow(self) -> bool:
        now = time.time()
        self.calls = [c for c in self.calls if now - c < self.period]
        if len(self.calls) < self.max_calls:
            self.calls.append(now)
            return True
        return False

# Imagen: max 10 images per minute
imagen_limiter = RateLimiter(max_calls=10, period=60)
```

---

## 5. CompanionAgent ↔ Backend Communication

The CompanionAgent runs in the browser with a direct WebSocket to Gemini Live API. It communicates with the backend only for:

### 5.1 Ephemeral Token Provisioning

```
Browser → POST /api/gemini/token → Backend → Gemini API → Ephemeral Token
                                                                ↓
Browser ←────── { token } ←────── Backend
    ↓
Browser → WebSocket (wss://...?access_token=<token>) → Gemini Live API
```

### 5.2 Tool Call Execution

When Gemini issues a function call, the browser executes it via backend REST:

```
Gemini Live API → toolCall → Browser
                              │
                              ├─ analyze_medication → POST /api/companion/analyze-medication
                              ├─ flag_emotional_distress → POST /api/companion/flag-emotional-distress
                              ├─ log_health_checkin → POST /api/companion/log-health-checkin
                              └─ set_reminder → POST /api/companion/set-reminder
                              │
Browser ← response ← Backend
    │
    └─ sendToolResponse → Gemini Live API
```

### 5.3 Session Logging

At end of conversation, browser sends accumulated transcripts:

```
Browser → POST /api/companion/log-conversation → Backend
                                                   │
                                                   ├─ Save to Firestore (conversations/)
                                                   ├─ Analyze for flags
                                                   └─ Trigger AlertAgent if needed
```

### 5.4 Story/Navigator Handoff

When user says "tell me a story" or "help me with a website" during companion session:

```
CompanionAgent (browser) detects intent via function call
    │
    ├─ Story: POST /api/storyteller/create-memory
    │   → Backend triggers StorytellerAgent via Runner
    │   → Companion tells user: "I'll create a beautiful story from what you told me"
    │
    └─ Navigate: POST /api/navigator/start
        → Backend creates Playwright session
        → Returns WebSocket URL
        → Frontend switches to Navigator UI
```

---

## 6. Direct Agent Invocation (Bypassing Coordinator)

Not all agent invocations go through the coordinator. For better performance and simpler flow, some agents are triggered directly:

| Trigger | Agent | Via |
|---------|-------|----|
| User talks to companion | CompanionAgent | Browser → Gemini Live API (not ADK) |
| User requests story | StorytellerAgent | `/api/storyteller/*` → Runner |
| Daily cron | StorytellerAgent | Cloud Scheduler → `/api/storyteller/create-daily-narrative` → Runner |
| Weekly cron | StorytellerAgent | Cloud Scheduler → `/api/storyteller/create-weekly-report` → Runner |
| User starts navigation | NavigatorAgent | `/api/navigator/start` → Runner |
| Emotional distress flag | AlertAgent | `/api/companion/flag-emotional-distress` → Runner |
| General ADK chat | Coordinator | `/run_sse` → ADK routing |

The coordinator is primarily used for freeform chat interactions where the user's intent isn't pre-classified.
