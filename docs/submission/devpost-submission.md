# OLAF — Devpost Submission

**Project name:** OLAF — AI Elderly Care Companion
**Tagline:** Real-time voice companion, illustrated memory keeper, and digital navigator for elderly users — and the families who love them.

---

## Inspiration

The loneliness epidemic among older adults is one of the most quietly devastating public health crises of our time. In the United States alone, 54 million people over 65 live with chronic social isolation. The health consequences rival smoking 15 cigarettes a day. And yet the problem is not complicated to name: elderly people have less and less contact with the world as their mobility, digital literacy, and social networks shrink.

We kept coming back to one recurring situation: an elderly parent who can't figure out the government pension portal, who forgets whether she took her medication, who holds a lifetime of extraordinary stories that nobody has ever thought to ask about — and whose children, who love her deeply, are an hour away and overwhelmed with their own lives.

We wanted to build something that genuinely addressed all three of those problems at once. Not a chatbot that answers questions. A presence. Something warm, patient, and persistent — that never gets too busy, never loses its temper, never forgets.

That's OLAF.

---

## What It Does

OLAF is an AI-powered elderly care companion deployed as a Progressive Web App. It combines four specialized AI agents into a unified experience for elderly users and their families.

### For the elderly user — three screens, voice-first:

**1. Talk (Voice Companion)**
A real-time voice and vision companion powered by Gemini Live API. The user taps one large button and begins talking. OLAF listens with patience tuned specifically for elderly interaction: low voice activity detection sensitivity, 800ms silence threshold, graceful handling of repetitive questions. The companion conducts daily health check-ins, manages medication and appointment reminders, and responds with genuine warmth.

A key feature is **medication scanning**: the user holds a pill bottle to their webcam, OLAF reads the label using Gemini's multimodal input, cross-references it against the user's prescription list (stored in session state), confirms the dosage, and sets an evening reminder — all in one conversational turn.

Emotionally sensitive monitoring runs silently in the background. When OLAF detects signs of distress, loneliness, or confusion in the user's voice or words, it calls `flag_emotional_distress` as a NON_BLOCKING function call — the conversation continues naturally while the backend routes an alert to the family.

**2. Memories (Illustrated Life Journal)**
Users speak their memories to OLAF. After the conversation, a three-stage ADK SequentialAgent pipeline transforms the raw transcript: a `narrative_writer` agent reshapes the words into prose while preserving the user's voice; an `illustrator` agent generates scene prompts and calls Imagen 3 via Vertex AI; an `assembler` agent combines them into a permanent illustrated chapter stored in Cloud Storage.

The result is a warmly illustrated life storybook — with chapters like "The Day It Rained, and Then the Sun Came Out" — that family members can read, and that will persist long after memory fades.

**3. Help (Digital Navigator)**
An ADK agent backed by a server-side Playwright headless Chromium browser. The user asks for help with any website — government pension portals, medical appointment booking, insurance documents, subsidy forms — and OLAF navigates it for them. Screenshots stream to the user's screen in real time. OLAF narrates every step in plain language ("I'm clicking the blue button that says Check Status"). The agent pauses and asks for confirmation before any login or form submission. A `before_tool_callback` validates every URL for safety before the browser acts.

### For the family — dashboard:

**Family Dashboard**
Family members see a real-time summary of their elderly loved one's week: today's mood and pain level, medications taken, health log trends, memory chapter notifications, and alerts requiring attention. The AlertAgent evaluates health signals from all other agents and routes notifications intelligently — avoiding alert fatigue by grouping non-urgent items into daily reports while sending immediate push notifications (via Firebase Cloud Messaging) for genuine concerns.

---

## How We Built It

### Architecture: Hybrid (Gemini Live API Direct + Google ADK)

We made a deliberate architectural choice: the voice companion connects from the browser directly to Gemini's Live API via WebSocket, while all backend intelligence runs through Google ADK on Cloud Run. This gives us the lowest possible audio latency for the elderly user while maintaining full ADK agent orchestration for everything else.

**Frontend: Next.js 15 + TypeScript + Tailwind CSS**

The PWA is built with Next.js 15 App Router and TypeScript. The design system is built specifically for elderly users: 18px minimum text, WCAG AAA contrast ratios, 48px minimum touch targets, voice-first interactions, and a three-screen architecture (Talk, Memories, Help) that never changes layout between visits.

**Gemini Live API Integration (`frontend/src/lib/gemini-live.ts`)**

Our `GeminiLiveClient` class handles the full lifecycle of a Gemini Live session:

- Fetches an ephemeral token from our backend (`POST /api/gemini/token`). The token is provisioned via the `v1alpha/authTokens` API with `liveConnectConstraints` that lock the model ID (`gemini-2.5-flash-native-audio-preview-12-2025`), system instruction, tool declarations, and voice configuration server-side. This prevents any client-side tampering with OLAF's behavior.
- Opens a WebSocket to `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent`
- Sends a setup message with: `contextWindowCompression: { slidingWindow: {} }` for unlimited session duration; `sessionResumption: {}` for seamless reconnection on `goAway`; `inputAudioTranscription` and `outputAudioTranscription` for full transcript capture; VAD configured with `START_SENSITIVITY_LOW` and `END_SENSITIVITY_LOW` and `silenceDurationMs: 800` for elderly-appropriate pacing; `enableAffectiveDialog: true` for emotionally resonant voice output.
- Routes four function calls with three different scheduling behaviors: `analyze_medication` (blocking, INTERRUPT — user is waiting for the answer); `flag_emotional_distress` (NON_BLOCKING, SILENT — never disrupts the conversation); `log_health_checkin` (NON_BLOCKING, SILENT — background health logging); `set_reminder` (NON_BLOCKING, WHEN_IDLE — confirms to user at a natural pause).
- Handles `sessionResumptionUpdate` messages to store session handles, and `goAway` messages to trigger proactive reconnection before the server disconnects.
- Sends JPEG frames at ~1 FPS (768x768) during medication scans via `sendVideoFrame()`, using on-demand camera activation rather than continuous video to control context window consumption.

**Tool Execution Bridge (`frontend/src/lib/tool-handler.ts`)**

When Gemini issues a function call over the WebSocket, our `ToolHandler` class intercepts it, calls the corresponding backend REST endpoint (`/api/companion/analyze-medication`, etc.), and sends the response back to Gemini via `toolResponse`. The bridge runs all tool calls in parallel and handles cancellation via `toolCallCancellation` messages.

**Backend: Python + Google ADK (`backend/caria_agents/`)**

The backend is a FastAPI application created with ADK's `get_fast_api_app()`, which provides ADK's built-in `/run_sse` endpoint alongside our custom routes. We run it on Cloud Run with 2 vCPU, 2GB memory, and `min-instances: 1` for warm Playwright containers.

**ADK Agent Hierarchy:**

```python
root_agent = Agent(
    model="gemini-2.5-flash",
    name="caria_coordinator",
    sub_agents=[storyteller_agent, navigator_agent],  # LLM-driven delegation
    tools=[AgentTool(agent=alert_agent)],             # Explicit invocation
    before_model_callback=safety_before_model,
)
```

The AlertAgent is deliberately wrapped as an `AgentTool` rather than a `sub_agent`. This was an architectural insight from studying ADK's delegation model: `sub_agents` uses LLM description matching, which works well for user-initiated requests but unreliably for system-triggered signals. `AgentTool` gives us explicit invocation when a distress flag or health anomaly arrives.

**StorytellerAgent — SequentialAgent Pipeline (`backend/caria_agents/agents/storyteller.py`)**

For memory chapter creation, we use a three-stage `SequentialAgent`:

```python
story_pipeline = SequentialAgent(
    name="story_pipeline",
    sub_agents=[narrative_writer, illustrator, assembler],
)
```

Each agent writes its output to session state via `output_key` (`parsed_memory`, `narrative`, `illustrations`), and the next agent reads it via instruction template variables. The `illustrator` agent calls our `generate_illustration` tool, which calls Imagen 3 (`imagen-3.0-generate-002`) with a warm watercolor art direction prompt. Images are stored in Cloud Storage with permanent public URLs (not expiring signed URLs) so family members can bookmark memory chapters without them breaking.

All tool functions accept `tool_context: ToolContext` as a final parameter, which ADK injects automatically. This gives tools access to `user:` scoped session state (medications, user ID, family contacts) without requiring separate database lookups on every call.

**NavigatorAgent — Playwright on Cloud Run (`backend/services/browser_service.py`)**

The `BrowserService` manages a pool of headless Chromium sessions (up to 5 concurrent). Each session uses a 1280×720 viewport and streams JPEG screenshots back to the frontend. The `validate_navigation_safety` callback (`before_tool_callback`) validates every URL before navigation, blocking unsafe schemes and known harmful domains. All click and type actions are audit-logged.

**AlertAgent — Intelligent Notification Routing**

The AlertAgent evaluates signals on a three-tier severity model (low/medium/high) and routes them appropriately: low signals are logged to the daily report; medium signals trigger a push notification to the primary family contact via Firebase Cloud Messaging; high signals alert all contacts immediately. The agent is designed to minimize notification fatigue — clustering non-urgent items rather than paging family members at midnight for minor concerns.

**Data Layer: Firestore + Cloud Storage**

User profiles, health logs, conversations, memory chapters, and reports are stored in Firestore with Firebase Auth custom claims for family access control (zero-cost permission checks in security rules, no extra reads). Generated images and PDFs are stored in Cloud Storage. Firebase Cloud Messaging handles push notifications to the family dashboard.

---

## Challenges We Ran Into

**Session limits with elderly-paced conversation.** The Gemini Live API has hard session limits — roughly 15 minutes for audio-only, 2 minutes with continuous video. Elderly users talk slowly and pause often; we needed sessions to last as long as they wanted. The solution was `contextWindowCompression: { slidingWindow: {} }` combined with `sessionResumption` — storing the session handle on `sessionResumptionUpdate` messages and reconnecting transparently on `goAway`. From Maria's perspective, the conversation never ends.

**VAD sensitivity for elderly voices.** The default voice activity detection would cut Maria off mid-sentence — elderly users breathe between words, cough, pause to think. We tuned `startOfSpeechSensitivity: START_SENSITIVITY_LOW`, `endOfSpeechSensitivity: END_SENSITIVITY_LOW`, and `silenceDurationMs: 800`. The 30-second silence prompt ("I'm still here if you need me") is implemented as a client-side timer, not via VAD, because the API doesn't support silence detection callbacks directly.

**Non-blocking tool calls without disrupting conversation.** We wanted health logging and distress flagging to happen invisibly. The `NON_BLOCKING` tool behavior combined with `SILENT` scheduling means Gemini absorbs the tool response without pausing speech or generating a verbal acknowledgment. Getting this routing exactly right — blocking for medication analysis, silent for distress flags, WHEN_IDLE for reminder confirmations — took careful iteration.

**Ephemeral token provisioning.** Securing the Gemini Live API connection without exposing raw API keys to the browser required implementing the `v1alpha/authTokens` endpoint with `liveConnectConstraints`. This locks the system instruction, model, tools, and voice configuration server-side so no client can tamper with OLAF's behavior. We also implemented a development fallback that uses the API key directly, with clear documentation about the security trade-off.

**Playwright cold starts on Cloud Run.** Chromium containers take 10–30 seconds to cold-start, which is terrifying for an elderly user who sees a blank screen. The fix was `min-instances: 1` plus a loading animation with progress narration from OLAF herself ("I'm getting ready to help you navigate..."), turning a technical delay into a human moment.

**AlertAgent delegation model.** Our initial design had AlertAgent as a `sub_agent` alongside Storyteller and Navigator. After studying ADK's delegation mechanics, we realized `sub_agents` relies on LLM description matching, which is unreliable for system-triggered signals. Switching AlertAgent to `AgentTool` gave us explicit, deterministic invocation — the coordinator calls it when a signal arrives, not when the LLM guesses it should.

---

## Accomplishments We're Proud Of

**A genuinely elderly-appropriate design system.** Every design decision was made asking: "Could Maria use this?" Minimum 18px text, WCAG AAA contrast, 48px touch targets, three screens total, voice-first interactions, nothing that moves unexpectedly. This is a real product designed for real people, not a demo skin.

**The SequentialAgent memory pipeline.** The three-stage story pipeline — transcript to prose to Imagen 3 illustrations to assembled chapter — produces genuinely beautiful output. Watching a fragmented spoken memory transform into an illustrated watercolor storybook chapter is the emotional core of the product.

**Seamless session continuity for the voice companion.** A 76-year-old user should never see "Connection lost. Please refresh." We implemented full session resumption with handle storage and automatic reconnection on `goAway`, combined with sliding window context compression. The session is effectively unlimited.

**Four agents with correct orchestration patterns.** Getting the ADK hierarchy right — `sub_agents` for user-initiated delegation, `AgentTool` for system signals, `SequentialAgent` for deterministic pipelines, `before_tool_callback` for safety, `ToolContext` for stateful tools — is the kind of architectural work that doesn't show up in a screenshot but determines whether a multi-agent system actually works reliably.

**The family dashboard as emotional bridge.** The family dashboard is not a monitoring tool. It's a connection. The memory chapter notification that tells Sarah her mother shared a story about her wedding day — that's the feature that makes families realize OLAF is something different.

---

## What We Learned

**The Gemini Live API is genuinely remarkable for real-time voice applications.** The latency, voice quality with affective dialog, and multimodal capabilities exceeded our expectations. The medication scan — reading a label through a webcam and cross-referencing a prescription in a single conversational turn — works better than we had any right to expect.

**ADK's agent patterns are subtle but important.** The difference between `sub_agents` and `AgentTool`, between `output_key` and explicit state writes, between `before_model_callback` and `before_tool_callback` — these distinctions matter enormously for reliability. Building OLAF taught us that multi-agent architectures require the same architectural discipline as distributed systems.

**Elderly UX is a discipline, not a checklist.** Accessible design and elderly-appropriate design overlap but are not the same. Accessibility is about disability. Elderly UX is about a different relationship with technology — one built on unfamiliarity, anxiety about mistakes, need for consistency, and a deep preference for voice over tap. Every design decision we made for Maria would make the product better for every user.

**The hardest problems are social, not technical.** The reason 54 million elderly Americans are lonely is not a technology problem. But technology can reduce friction and increase connection. The constraint we kept returning to was: does this make it easier for Maria to have a good day, and easier for Sarah to know her mother had a good day? Every feature that couldn't answer yes to both questions got cut.

---

## What's Next

**React Native mobile app.** The PWA works well, but a native app enables always-on background reminders, push notifications without browser, and better camera access for medication scanning.

**Fall detection.** With a dedicated tablet mount or always-on camera, OLAF can monitor for falls using computer vision. This requires native mobile for reliability — the PWA constraint was a deliberate hackathon scope decision.

**Multilingual support.** The global elderly population is not primarily English-speaking. Gemini's multilingual capabilities make this technically straightforward; the cultural adaptation of OLAF's personality is the interesting design challenge.

**Retirement home deployment.** A multi-resident dashboard for facility caregivers, with aggregate health trend analysis and resident comparison tools, is a natural enterprise path.

**Wearable integration.** Smartwatch heart rate and activity data fed into OLAF's health monitoring would dramatically improve the quality of daily health narratives and anomaly detection.

**HIPAA compliance layer.** For the US healthcare market, a proper HIPAA BAA with enhanced audit logging and data residency controls opens the clinical partnership channel.

---

## Built With

**AI / Machine Learning:**
- Gemini Live API (`gemini-2.5-flash-native-audio-preview-12-2025`) — real-time voice and vision companion
- Gemini 2.5 Flash (`gemini-2.5-flash`) — all ADK agents (storyteller, navigator, alert, coordinator)
- Google ADK (Agent Development Kit) >= 1.26 — multi-agent orchestration framework
- Imagen 3 (`imagen-3.0-generate-002`) — warm watercolor memory illustrations via Vertex AI

**Backend:**
- Python 3.13
- FastAPI (via ADK's `get_fast_api_app()`)
- Google ADK SequentialAgent, LlmAgent, AgentTool
- Playwright >= 1.49 (headless Chromium for NavigatorAgent)
- google-cloud-firestore
- google-cloud-storage
- firebase-admin
- google-genai >= 1.0
- httpx
- uvicorn
- pydantic-settings

**Frontend:**
- Next.js 15 (App Router)
- TypeScript
- Tailwind CSS 4
- React 19
- @google/genai 1.0
- @tanstack/react-query 5
- Firebase 11 (Auth + Cloud Messaging)
- recharts

**Infrastructure:**
- Google Cloud Run (backend — 2 vCPU, 2GB memory, min-instances 1)
- Google Cloud Firestore
- Google Cloud Storage
- Firebase Authentication
- Firebase Cloud Messaging
- Vercel or Cloud Run (frontend)
- Docker + docker-compose (local development)
- GitHub Actions (CI/CD)
