# CARIA — Data Flow Diagrams

## 1. Voice Conversation → Health Log → Daily Report

```
┌──────────────────────────────────────────────────────────────────────┐
│ ELDERLY USER opens "Talk to CARIA"                                  │
└──────────┬───────────────────────────────────────────────────────────┘
           │
           ▼
┌──────────────────────────────────────────────────────────────────────┐
│ BROWSER                                                             │
│                                                                     │
│  1. POST /api/gemini/token (Firebase auth)                          │
│     └─► Backend validates token, returns ephemeral Gemini token     │
│         with locked config (system prompt, tools, voice, VAD)       │
│                                                                     │
│  2. WebSocket connect → Gemini Live API (with ephemeral token)      │
│     ├── Send setup message (model, sessionResumption, compression)  │
│     └── Receive setupComplete                                       │
│                                                                     │
│  3. Audio streaming loop:                                           │
│     ├── Microphone → 16kHz PCM → base64 → sendRealtimeInput        │
│     ├── Receive serverContent.modelTurn.parts[].inlineData (24kHz)  │
│     ├── Play audio through speakers                                 │
│     ├── Accumulate inputTranscription + outputTranscription          │
│     └── Handle interruptions (clear audio queue on interrupted:true)│
│                                                                     │
│  4. Tool calls (Gemini → Browser → Backend):                        │
│     ├── analyze_medication → POST /api/companion/analyze-medication │
│     ├── flag_emotional_distress → POST /api/companion/flag-*        │
│     │   └─► Backend: AlertAgent evaluates severity                  │
│     │       ├── low → log only                                      │
│     │       ├── medium → FCM push to primary contact                │
│     │       └── high → urgent push to ALL contacts                  │
│     ├── log_health_checkin → POST /api/companion/log-health-checkin │
│     │   └─► Backend: Save to Firestore users/{userId}/healthLogs/   │
│     └── set_reminder → POST /api/companion/set-reminder             │
│         └─► Backend: Save to Firestore users/{userId}/reminders/    │
│                                                                     │
│  5. Session end:                                                    │
│     └── POST /api/companion/log-conversation                        │
│         Body: { transcript, duration, flags }                       │
└──────────┬───────────────────────────────────────────────────────────┘
           │
           ▼
┌──────────────────────────────────────────────────────────────────────┐
│ BACKEND (log-conversation endpoint)                                 │
│                                                                     │
│  1. Save conversation to Firestore:                                 │
│     users/{userId}/conversations/{convoId}                          │
│     { timestamp, duration, transcript, moodScore, flags, summary }  │
│                                                                     │
│  2. If flags contain "distress" or "confusion":                     │
│     └── Invoke AlertAgent via Runner with signal data               │
│                                                                     │
│  3. Update daily health log aggregate:                              │
│     users/{userId}/healthLogs/{date}                                │
└──────────────────────────────────────────────────────────────────────┘

           ... later that evening (Cloud Scheduler cron) ...

┌──────────────────────────────────────────────────────────────────────┐
│ CLOUD SCHEDULER → POST /api/storyteller/create-daily-narrative      │
│                   Body: { userId, date: "today" }                   │
└──────────┬───────────────────────────────────────────────────────────┘
           │
           ▼
┌──────────────────────────────────────────────────────────────────────┐
│ BACKEND (StorytellerAgent via Runner)                               │
│                                                                     │
│  1. Agent reads from Firestore:                                     │
│     ├── users/{userId}/healthLogs/{date}                            │
│     ├── users/{userId}/conversations/ (today's conversations)       │
│     └── users/{userId}/reminders/ (today's reminder status)         │
│                                                                     │
│  2. Agent generates narrative text:                                 │
│     "Margaret had a good day today. She took her morning            │
│      medications on time and had a cheerful 20-minute               │
│      conversation about her garden..."                              │
│                                                                     │
│  3. Agent generates 1 illustration prompt:                          │
│     "Warm watercolor of an elderly woman smiling in a garden..."    │
│                                                                     │
│  4. Tool: generate_illustration() → Imagen 3 API                   │
│     └── Image saved to Cloud Storage via GcsArtifactService         │
│                                                                     │
│  5. Tool: save_health_narrative() → Firestore                      │
│     users/{userId}/reports/{reportId}                               │
│     { type: "daily", content, imageUrls, concerns, highlights }    │
│                                                                     │
│  6. If concerns detected → invoke AlertAgent                        │
│     └── AlertAgent routes notification to family                    │
└──────────────────────────────────────────────────────────────────────┘
           │
           ▼
┌──────────────────────────────────────────────────────────────────────┐
│ FAMILY MEMBER opens dashboard                                       │
│                                                                     │
│  GET /api/health/reports?userId={elderlyId}&type=daily              │
│  └── Sees today's narrative with illustration                       │
│                                                                     │
│  GET /api/alerts?userId={elderlyId}                                 │
│  └── Sees any alerts from the day                                   │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 2. Memory Story → Illustrated Chapter

```
┌──────────────────────────────────────────────────────────────────────┐
│ ELDERLY USER (during companion session):                            │
│ "I want to tell you about my wedding day"                           │
└──────────┬───────────────────────────────────────────────────────────┘
           │
           ▼
┌──────────────────────────────────────────────────────────────────────┐
│ CompanionAgent (Gemini Live API):                                   │
│                                                                     │
│  1. Engages in conversation about the wedding day                   │
│  2. Asks follow-up questions: "Where was the ceremony?"             │
│  3. Records full spoken transcript via transcription API             │
│  4. At natural end of story, model generates a function call:       │
│     → Browser detects story-complete signal                         │
└──────────┬───────────────────────────────────────────────────────────┘
           │
           ▼
┌──────────────────────────────────────────────────────────────────────┐
│ BROWSER:                                                            │
│                                                                     │
│  POST /api/storyteller/create-memory                                │
│  Body: {                                                            │
│    userId: "user_123",                                              │
│    transcript: "Full conversation transcript about wedding...",     │
│    title: "My Wedding Day" (optional, can be auto-generated)        │
│  }                                                                  │
│                                                                     │
│  Response: { status: "accepted", taskId: "task_abc" }               │
│  UI shows: "CARIA is creating your story..."                        │
└──────────┬───────────────────────────────────────────────────────────┘
           │
           ▼
┌──────────────────────────────────────────────────────────────────────┐
│ BACKEND (StorytellerAgent via Runner):                              │
│                                                                     │
│  Option A — Monolithic StorytellerAgent (simpler):                  │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │  1. Parse transcript, extract key moments                      │ │
│  │  2. Reshape into narrative prose (preserve user's voice)       │ │
│  │  3. Generate 2-3 illustration prompts for key moments          │ │
│  │  4. Call generate_illustration() 2-3 times                     │ │
│  │     └── Each: Imagen 3 API → Cloud Storage → URL               │ │
│  │  5. Generate audio narration script for TTS                    │ │
│  │  6. Call save_memory_chapter()                                 │ │
│  │     └── Firestore: users/{userId}/memories/{memoryId}          │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                     │
│  Option B — SequentialAgent Pipeline (complex stories):             │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │  Step 1: parser_agent                                          │ │
│  │    Input: raw transcript                                       │ │
│  │    Output: state["parsed_memory"] = {                          │ │
│  │      key_moments: [...], characters: [...], setting: "..."     │ │
│  │    }                                                           │ │
│  │                                                                │ │
│  │  Step 2: writer_agent                                          │ │
│  │    Input: {parsed_memory} from state                           │ │
│  │    Output: state["narrative"] = {                              │ │
│  │      title: "...", body: "...", audio_script: "..."            │ │
│  │    }                                                           │ │
│  │                                                                │ │
│  │  Step 3: illustrator_agent                                     │ │
│  │    Input: {narrative} from state                               │ │
│  │    Tools: generate_illustration() × 3                          │ │
│  │    Output: state["illustrations"] = [url1, url2, url3]         │ │
│  │                                                                │ │
│  │  Step 4: compiler (tool call)                                  │ │
│  │    Input: all state data                                       │ │
│  │    Action: save_memory_chapter() → Firestore + Cloud Storage   │ │
│  └────────────────────────────────────────────────────────────────┘ │
└──────────┬───────────────────────────────────────────────────────────┘
           │
           ▼
┌──────────────────────────────────────────────────────────────────────┐
│ FIRESTORE (final stored data):                                      │
│                                                                     │
│  users/{userId}/memories/{memoryId}: {                              │
│    spokenTranscript: "Original conversation...",                    │
│    title: "My Wedding Day",                                        │
│    narrativeText: "It was a warm June morning in 1972...",          │
│    illustrationUrls: [                                              │
│      "gs://caria-artifacts/illustrations/wedding_ceremony.png",    │
│      "gs://caria-artifacts/illustrations/wedding_dance.png",       │
│      "gs://caria-artifacts/illustrations/wedding_cake.png"         │
│    ],                                                               │
│    audioScript: "Narrator script for TTS playback...",             │
│    tags: ["wedding", "family", "1972"],                            │
│    createdAt: "2026-02-28T14:30:00Z"                               │
│  }                                                                  │
└──────────┬───────────────────────────────────────────────────────────┘
           │
           ▼
┌──────────────────────────────────────────────────────────────────────┐
│ USER/FAMILY can now:                                                │
│                                                                     │
│  Elderly user:                                                      │
│  ├── View chapter in Memories tab with illustrations                │
│  ├── Listen to audio narration (TTS of audio_script)                │
│  └── Ask companion to "read me my wedding story"                    │
│                                                                     │
│  Family member:                                                     │
│  ├── View shared memories in Family Dashboard                       │
│  └── Receive notification: "Mom shared a new memory: My Wedding Day"│
└──────────────────────────────────────────────────────────────────────┘
```

---

## 3. Navigator Task → Screenshot Stream → Confirmation

```
┌──────────────────────────────────────────────────────────────────────┐
│ ELDERLY USER clicks "Help me navigate" or asks companion            │
│ "Can you help me check my pension status?"                          │
└──────────┬───────────────────────────────────────────────────────────┘
           │
           ▼
┌──────────────────────────────────────────────────────────────────────┐
│ BROWSER:                                                            │
│                                                                     │
│  POST /api/navigator/start                                          │
│  Body: {                                                            │
│    userId: "user_123",                                              │
│    task: "Check pension status",                                    │
│    templateId: "pension_check"                                      │
│  }                                                                  │
│                                                                     │
│  Response: {                                                        │
│    sessionId: "nav_abc",                                            │
│    websocketUrl: "wss://backend/api/navigator/stream/nav_abc"       │
│  }                                                                  │
│                                                                     │
│  Frontend switches to Navigator UI:                                 │
│  ┌──────────────────────────────────────────┐                       │
│  │  [Screenshot Viewer]  |  "CARIA is       │                       │
│  │  (live screenshots)   |   opening the    │                       │
│  │                       |   pension portal  │                       │
│  │                       |   for you..."     │                       │
│  └──────────────────────────────────────────┘                       │
│                                                                     │
│  WebSocket connect → wss://backend/api/navigator/stream/nav_abc     │
└──────────┬───────────────────────────────────────────────────────────┘
           │
           ▼
┌──────────────────────────────────────────────────────────────────────┐
│ BACKEND (NavigatorAgent session):                                   │
│                                                                     │
│  1. browser_service.py creates Playwright browser instance          │
│     (from warm pool if available)                                   │
│                                                                     │
│  2. NavigatorAgent invoked via Runner with task context              │
│                                                                     │
│  3. Agent navigation loop:                                          │
│                                                                     │
│  ┌─ STEP 1: navigate_to_url("https://pension.gov.example") ───────┐│
│  │  Playwright: page.goto(url)                                     ││
│  │  Tool returns: { status: "success", pageTitle: "Pension Portal"}││
│  │  → take_screenshot()                                            ││
│  │  → Screenshot sent via WebSocket:                               ││
│  │    { type: "screenshot", data: { imageBase64, pageUrl, ... } }  ││
│  │  → Narration sent via WebSocket:                                ││
│  │    { type: "narration", data: { message: "I've opened the      ││
│  │      pension portal. I can see a login button." } }             ││
│  └─────────────────────────────────────────────────────────────────┘│
│                                                                     │
│  ┌─ STEP 2: Login required → ask_user_confirmation() ─────────────┐│
│  │  Confirmation request sent via WebSocket:                       ││
│  │  {                                                              ││
│  │    type: "confirmation_required",                               ││
│  │    data: {                                                      ││
│  │      actionId: "act_001",                                       ││
│  │      actionDescription: "Enter your login credentials",        ││
│  │      actionType: "login"                                        ││
│  │    }                                                            ││
│  │  }                                                              ││
│  │                                                                 ││
│  │  Agent PAUSES, waits for user response                          ││
│  │                                                                 ││
│  │  User types credentials in browser UI →                         ││
│  │  WebSocket: { type: "user_input",                               ││
│  │              data: { fieldId: "username", value: "..." } }      ││
│  │  WebSocket: { type: "user_input",                               ││
│  │              data: { fieldId: "password", value: "..." } }      ││
│  │  WebSocket: { type: "confirmation_response",                    ││
│  │              data: { actionId: "act_001", approved: true } }    ││
│  │                                                                 ││
│  │  Agent: type_text(field="username", text="...")                  ││
│  │  Agent: type_text(field="password", text="...")                  ││
│  │  Agent: click_element("Login button")                           ││
│  │  → take_screenshot() → send via WebSocket                       ││
│  └─────────────────────────────────────────────────────────────────┘│
│                                                                     │
│  ┌─ STEP 3: Navigate to status page ──────────────────────────────┐│
│  │  Agent: click_element("Check Status link")                      ││
│  │  → take_screenshot() → WebSocket                                ││
│  │  Agent: read_page_text()                                        ││
│  │  Agent: summarize_content(raw_text, context="pension status")   ││
│  │  → Narration: "Your pension status is: Active. Next payment     ││
│  │    of $1,234 is scheduled for March 1st, 2026."                 ││
│  └─────────────────────────────────────────────────────────────────┘│
│                                                                     │
│  4. Agent completes task                                            │
│     → WebSocket: { type: "status",                                  │
│                    data: { state: "completed",                      │
│                            message: "Task complete" } }             │
│                                                                     │
│  5. Browser closes session, Playwright instance returned to pool    │
│                                                                     │
│  NOTE: Raw credentials are NEVER stored. Only the task summary      │
│  is saved to Firestore for reference.                               │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 4. Alert Signal → Notification Routing

```
┌──────────────────────────────────────────────────────────────────────┐
│ SIGNAL SOURCES                                                      │
│                                                                     │
│  CompanionAgent (via REST):                                         │
│  ├── flag_emotional_distress(severity, observation)                 │
│  ├── log_health_checkin(mood: "sad", pain: 8)                       │
│  └── log_conversation(flags: ["distress"])                          │
│                                                                     │
│  StorytellerAgent (during report generation):                       │
│  ├── Daily narrative detects medication adherence < 50%             │
│  └── Weekly report identifies 3-day low mood trend                  │
│                                                                     │
│  System (Cloud Scheduler / monitoring):                             │
│  ├── No conversation in 24h (when daily check-in enabled)           │
│  └── No conversation in 48h                                         │
└──────────┬───────────────────────────────────────────────────────────┘
           │
           ▼
┌──────────────────────────────────────────────────────────────────────┐
│ SIGNAL CLASSIFICATION (backend code, before AlertAgent):            │
│                                                                     │
│  Signal = {                                                         │
│    user_id: "user_123",                                             │
│    type: "emotional_distress" | "missed_medication" |               │
│          "health_anomaly" | "inactivity",                           │
│    severity: "low" | "medium" | "high",                             │
│    observation: "User mentioned feeling very lonely today",         │
│    source: "companion" | "storyteller" | "system"                   │
│  }                                                                  │
└──────────┬───────────────────────────────────────────────────────────┘
           │
           ▼
┌──────────────────────────────────────────────────────────────────────┐
│ AlertAgent (ADK, invoked via Runner):                               │
│                                                                     │
│  1. Read user baseline:                                             │
│     get_user_baseline(user_id)                                      │
│     → Returns: typical mood range, medication count, activity level │
│                                                                     │
│  2. Read family contacts:                                           │
│     get_family_contacts(user_id)                                    │
│     → Returns: contacts with notification preferences               │
│                                                                     │
│  3. Evaluate signal against rules:                                  │
│                                                                     │
│  ┌─ EMOTIONAL DISTRESS ───────────────────────────────────────────┐│
│  │  low    → log_to_daily_report()                                ││
│  │           "Mild emotional concern noted in conversation"       ││
│  │  medium → send_push_notification(primary_contact)              ││
│  │           "Margaret seemed lonely during today's conversation" ││
│  │  high   → send_push_notification(ALL contacts, urgent=true)   ││
│  │         + send_email_alert(ALL contacts)                       ││
│  │           "URGENT: Margaret expressed severe distress"         ││
│  └────────────────────────────────────────────────────────────────┘│
│                                                                     │
│  ┌─ MISSED MEDICATION ────────────────────────────────────────────┐│
│  │  first miss  → set_reminder(user, type="medication")           ││
│  │                "Re-remind user during next companion session"  ││
│  │  second miss → send_push_notification(primary_contact)         ││
│  │                "Margaret missed her afternoon medication"      ││
│  │  pattern     → log_to_daily_report() with elevated flag        ││
│  │                "Medication adherence declining — 3/7 missed"   ││
│  └────────────────────────────────────────────────────────────────┘│
│                                                                     │
│  ┌─ HEALTH ANOMALY ──────────────────────────────────────────────┐ │
│  │  unusual mood → log_to_daily_report()                          │ │
│  │  sudden change → send_push_notification(primary_contact)       │ │
│  │  sustained pain → send_push_notification(ALL) + email          │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                     │
│  ┌─ INACTIVITY ──────────────────────────────────────────────────┐ │
│  │  24h no conversation → send_push_notification(primary_contact) │ │
│  │                        "Margaret hasn't checked in today"      │ │
│  │  48h no conversation → send_push_notification(ALL, urgent)     │ │
│  │                      + send_email_alert(ALL)                   │ │
│  │                        "URGENT: No contact with Margaret in 2d"│ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                     │
│  4. Save alert to Firestore:                                        │
│     alerts/{alertId}: {                                             │
│       userId, type, severity, message, source,                      │
│       acknowledged: false, createdAt                                │
│     }                                                               │
└──────────┬───────────────────────────────────────────────────────────┘
           │
           ▼
┌──────────────────────────────────────────────────────────────────────┐
│ NOTIFICATION DELIVERY                                               │
│                                                                     │
│  Firebase Cloud Messaging (push):                                   │
│  ├── Family member's browser receives push notification             │
│  ├── Clicking opens Family Dashboard → Alerts tab                   │
│  └── Alert card shows: type, severity, message, time, acknowledge   │
│                                                                     │
│  Email (urgent + fallback):                                         │
│  ├── Sent via Cloud Functions or SendGrid                           │
│  ├── Contains: alert details + link to dashboard                    │
│  └── Used for HIGH severity or when push fails                      │
│                                                                     │
│  Daily/Weekly Report (batched):                                     │
│  ├── Low-severity items grouped into reports                        │
│  ├── Prevents notification fatigue                                  │
│  └── Family can review at their convenience                         │
└──────────────────────────────────────────────────────────────────────┘
           │
           ▼
┌──────────────────────────────────────────────────────────────────────┐
│ FAMILY MEMBER acknowledges alert:                                   │
│                                                                     │
│  PATCH /api/alerts/{alertId}/acknowledge                            │
│  └── Firestore update: acknowledged=true, acknowledgedBy=familyUid  │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 5. Cross-Cutting: Authentication Flow

```
┌──────────────────────────────────────────────────────────────────────┐
│ USER (elderly or family)                                            │
│                                                                     │
│  1. Open CARIA PWA → redirected to /login                           │
│                                                                     │
│  2. Sign in via Firebase Auth:                                      │
│     ├── Email/password                                              │
│     └── Google SSO (signInWithPopup)                                │
│                                                                     │
│  3. Firebase returns ID token (JWT)                                 │
│     └── Stored in client memory (not localStorage)                  │
│                                                                     │
│  4. On first login → POST /api/auth/register                        │
│     └── Backend creates user profile in Firestore                   │
│     └── Sets custom claims: { role, linked_elderly_users }          │
│                                                                     │
│  5. All subsequent API calls include:                                │
│     Authorization: Bearer <firebase_id_token>                       │
│                                                                     │
│  6. Backend middleware:                                              │
│     ├── Verifies token with firebase_admin.auth.verify_id_token()   │
│     ├── Extracts uid, role, custom claims                           │
│     └── Injects user context into request                           │
│                                                                     │
│  7. Firestore security rules use custom claims:                     │
│     ├── Elderly user: can read/write own data                       │
│     ├── Family member: can read linked elderly user's data          │
│     │   (checked via token.linked_elderly_users claim)              │
│     └── No cross-user access otherwise                              │
└──────────────────────────────────────────────────────────────────────┘
```
