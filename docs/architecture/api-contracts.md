# CARIA — API Contracts

## Overview

The CARIA backend exposes two categories of endpoints:

1. **ADK Built-in** — `/run_sse`, `/run`, session management (provided by `get_fast_api_app()`)
2. **Custom CARIA** — Feature-specific REST endpoints and WebSocket connections

All custom endpoints require Firebase Authentication via `Authorization: Bearer <firebase_id_token>` header.

---

## 1. Authentication

### POST /api/auth/register

Create user profile after Firebase Auth registration.

**Request:**
```json
{
  "role": "elderly" | "family",
  "name": "string",
  "age": 75,
  "timezone": "America/New_York",
  "language": "en"
}
```

**Response (201):**
```json
{
  "status": "success",
  "data": {
    "userId": "string",
    "role": "elderly",
    "profileComplete": false
  }
}
```

### POST /api/auth/family-link

Link a family member to an elderly user.

**Request:**
```json
{
  "elderlyUserId": "string",
  "relationship": "son" | "daughter" | "spouse" | "caregiver" | "other",
  "permissions": ["view_reports", "receive_alerts", "view_conversations"]
}
```

**Response (201):**
```json
{
  "status": "success",
  "data": {
    "linkId": "string",
    "elderlyUserId": "string",
    "familyUserId": "string",
    "relationship": "son"
  }
}
```

### GET /api/auth/me

Get current user profile and linked accounts.

**Response (200):**
```json
{
  "status": "success",
  "data": {
    "userId": "string",
    "role": "elderly" | "family",
    "name": "string",
    "age": 75,
    "linkedAccounts": [
      {
        "userId": "string",
        "name": "string",
        "relationship": "son",
        "role": "family"
      }
    ]
  }
}
```

---

## 2. Ephemeral Token

### POST /api/gemini/token

Provision a locked ephemeral token for browser → Gemini Live API connection.

**Request:**
```json
{
  "userId": "string"
}
```

**Response (200):**
```json
{
  "status": "success",
  "data": {
    "token": "string",
    "expiresAt": "ISO8601"
  }
}
```

**Security:** Token is created with `liveConnectConstraints` that lock model, system instruction, tools, and voice. The client cannot override these.

---

## 3. Companion (Tool Execution Endpoints)

These endpoints are called from the browser when Gemini Live API issues function calls. The browser receives the tool call, executes it by calling these REST endpoints, then sends the result back to Gemini.

### POST /api/companion/analyze-medication

**Request:**
```json
{
  "userId": "string",
  "args": {
    "imageDescription": "string"
  }
}
```

**Response (200):**
```json
{
  "status": "success",
  "data": {
    "medicationName": "string",
    "dosage": "string",
    "matchStatus": "match" | "mismatch" | "unknown",
    "guidance": "string"
  }
}
```

### POST /api/companion/flag-emotional-distress

**Request:**
```json
{
  "userId": "string",
  "args": {
    "severity": "low" | "medium" | "high",
    "observation": "string"
  }
}
```

**Response (200):**
```json
{
  "status": "success",
  "data": {
    "alertId": "string",
    "action": "logged" | "notified_family" | "urgent_alert"
  }
}
```

### POST /api/companion/log-health-checkin

**Request:**
```json
{
  "userId": "string",
  "args": {
    "mood": "happy" | "okay" | "sad" | "anxious" | "confused" | "tired",
    "painLevel": 0,
    "notes": "string"
  }
}
```

**Response (200):**
```json
{
  "status": "success",
  "data": {
    "logId": "string",
    "date": "YYYY-MM-DD"
  }
}
```

### POST /api/companion/set-reminder

**Request:**
```json
{
  "userId": "string",
  "args": {
    "reminderType": "medication" | "appointment" | "hydration" | "custom",
    "message": "string",
    "time": "string"
  }
}
```

**Response (200):**
```json
{
  "status": "success",
  "data": {
    "reminderId": "string",
    "scheduledTime": "ISO8601"
  }
}
```

### POST /api/companion/log-conversation

Called by the browser at end of companion session with accumulated transcripts.

**Request:**
```json
{
  "userId": "string",
  "sessionDuration": 900,
  "transcript": [
    { "role": "user", "text": "string", "timestamp": "ISO8601" },
    { "role": "model", "text": "string", "timestamp": "ISO8601" }
  ],
  "flags": ["distress", "confusion"]
}
```

**Response (200):**
```json
{
  "status": "success",
  "data": {
    "conversationId": "string",
    "summary": "string",
    "moodScore": 7
  }
}
```

---

## 4. Storyteller

### POST /api/storyteller/create-memory

Trigger memory chapter creation from a conversation transcript.

**Request:**
```json
{
  "userId": "string",
  "transcript": "string",
  "title": "string (optional)"
}
```

**Response (202):**
```json
{
  "status": "accepted",
  "data": {
    "taskId": "string",
    "message": "Memory chapter creation started"
  }
}
```

### POST /api/storyteller/create-daily-narrative

Trigger daily health narrative generation (typically called by Cloud Scheduler).

**Request:**
```json
{
  "userId": "string",
  "date": "YYYY-MM-DD"
}
```

**Response (202):**
```json
{
  "status": "accepted",
  "data": {
    "taskId": "string"
  }
}
```

### POST /api/storyteller/create-weekly-report

Trigger weekly family report generation.

**Request:**
```json
{
  "userId": "string",
  "weekStart": "YYYY-MM-DD"
}
```

**Response (202):**
```json
{
  "status": "accepted",
  "data": {
    "taskId": "string"
  }
}
```

### GET /api/storyteller/memories?userId={userId}&limit={limit}&offset={offset}

List memory chapters.

**Response (200):**
```json
{
  "status": "success",
  "data": {
    "memories": [
      {
        "id": "string",
        "title": "string",
        "createdAt": "ISO8601",
        "illustrationUrls": ["string"],
        "snippet": "string"
      }
    ],
    "total": 42,
    "hasMore": true
  }
}
```

### GET /api/storyteller/memories/{memoryId}

Get a single memory chapter with full content.

**Response (200):**
```json
{
  "status": "success",
  "data": {
    "id": "string",
    "title": "string",
    "narrativeText": "string",
    "illustrationUrls": ["string"],
    "audioScript": "string",
    "tags": ["string"],
    "createdAt": "ISO8601"
  }
}
```

---

## 5. Navigator

### POST /api/navigator/start

Start a new navigation session with a headless browser.

**Request:**
```json
{
  "userId": "string",
  "task": "string",
  "templateId": "pension_check" | "book_appointment" | "read_report" | "fill_form" | null,
  "startUrl": "string (optional)"
}
```

**Response (200):**
```json
{
  "status": "success",
  "data": {
    "sessionId": "string",
    "websocketUrl": "wss://backend/api/navigator/stream/{sessionId}"
  }
}
```

### POST /api/navigator/confirm/{sessionId}

User confirms or rejects a sensitive action.

**Request:**
```json
{
  "action": "approve" | "reject",
  "actionId": "string"
}
```

**Response (200):**
```json
{
  "status": "success",
  "data": {
    "actionId": "string",
    "result": "approved" | "rejected"
  }
}
```

### POST /api/navigator/stop/{sessionId}

End a navigation session.

**Response (200):**
```json
{
  "status": "success",
  "data": {
    "sessionId": "string",
    "summary": "string"
  }
}
```

---

## 6. Health

### GET /api/health/logs?userId={userId}&range={today|week|month|YYYY-MM-DD:YYYY-MM-DD}

Get health logs for a date range.

**Response (200):**
```json
{
  "status": "success",
  "data": {
    "logs": [
      {
        "date": "YYYY-MM-DD",
        "mood": "happy",
        "moodScore": 8,
        "painLevel": 2,
        "medicationsTaken": [
          { "name": "string", "time": "HH:MM", "confirmed": true }
        ],
        "hydrationReminders": { "sent": 4, "acknowledged": 3 },
        "activityNotes": "string"
      }
    ]
  }
}
```

### GET /api/health/reports?userId={userId}&type={daily|weekly}&limit={limit}

Get generated health reports.

**Response (200):**
```json
{
  "status": "success",
  "data": {
    "reports": [
      {
        "id": "string",
        "type": "daily" | "weekly",
        "content": "string",
        "imageUrls": ["string"],
        "moodTrend": [7, 8, 6, 7, 8, 9, 7],
        "medicationAdherence": 0.85,
        "concerns": ["string"],
        "highlights": ["string"],
        "generatedAt": "ISO8601"
      }
    ]
  }
}
```

### GET /api/health/reminders?userId={userId}&status={pending|sent|acknowledged}

Get reminders.

**Response (200):**
```json
{
  "status": "success",
  "data": {
    "reminders": [
      {
        "id": "string",
        "type": "medication" | "appointment" | "hydration" | "custom",
        "message": "string",
        "scheduledTime": "ISO8601",
        "status": "pending",
        "recurring": true
      }
    ]
  }
}
```

---

## 7. Alerts

### GET /api/alerts?userId={userId}&acknowledged={true|false}&limit={limit}

Get alerts for a user (family member queries by linked elderly user).

**Response (200):**
```json
{
  "status": "success",
  "data": {
    "alerts": [
      {
        "id": "string",
        "userId": "string",
        "type": "emotional_distress" | "missed_medication" | "health_anomaly" | "inactivity",
        "severity": "low" | "medium" | "high",
        "message": "string",
        "source": "companion" | "storyteller" | "navigator" | "system",
        "acknowledged": false,
        "createdAt": "ISO8601"
      }
    ]
  }
}
```

### PATCH /api/alerts/{alertId}/acknowledge

Acknowledge an alert.

**Response (200):**
```json
{
  "status": "success",
  "data": {
    "id": "string",
    "acknowledged": true,
    "acknowledgedBy": "string"
  }
}
```

---

## 8. WebSocket — Navigator Screenshot Stream

### WSS /api/navigator/stream/{sessionId}

Bidirectional WebSocket for real-time navigator interaction.

**Auth:** `?token=<firebase_id_token>` query parameter.

#### Server → Client Messages

**Screenshot update:**
```json
{
  "type": "screenshot",
  "data": {
    "imageBase64": "string",
    "pageUrl": "string",
    "pageTitle": "string",
    "timestamp": "ISO8601"
  }
}
```

**Agent narration (what the agent is doing):**
```json
{
  "type": "narration",
  "data": {
    "message": "I'm clicking the blue 'Check Status' button",
    "timestamp": "ISO8601"
  }
}
```

**Confirmation request (sensitive action):**
```json
{
  "type": "confirmation_required",
  "data": {
    "actionId": "string",
    "actionDescription": "Submit the pension inquiry form with your details",
    "actionType": "form_submit" | "login" | "payment" | "download",
    "timestamp": "ISO8601"
  }
}
```

**Session status:**
```json
{
  "type": "status",
  "data": {
    "state": "navigating" | "waiting_confirmation" | "completed" | "error",
    "message": "string"
  }
}
```

#### Client → Server Messages

**User confirmation response:**
```json
{
  "type": "confirmation_response",
  "data": {
    "actionId": "string",
    "approved": true
  }
}
```

**User text input (e.g., credentials):**
```json
{
  "type": "user_input",
  "data": {
    "fieldId": "string",
    "value": "string"
  }
}
```

**Cancel session:**
```json
{
  "type": "cancel"
}
```

---

## 9. ADK Built-in Endpoints

These are provided by `get_fast_api_app()` and used for direct agent interaction.

### POST /run_sse

Stream agent responses via Server-Sent Events.

**Request:**
```json
{
  "appName": "caria_agents",
  "userId": "string",
  "sessionId": "string",
  "newMessage": {
    "role": "user",
    "parts": [{ "text": "string" }]
  },
  "streaming": true
}
```

**Response:** SSE stream of agent events.

### POST /apps/{app}/users/{user}/sessions/{session}

Create a new ADK session.

### GET /apps/{app}/users/{user}/sessions/{session}

Get session details and state.

---

## 10. TypeScript Interfaces

```typescript
// types/api.ts

// === Common ===
interface ApiResponse<T> {
  status: "success" | "error" | "accepted" | "pending";
  data?: T;
  errorMessage?: string;
}

// === Auth ===
interface RegisterRequest {
  role: "elderly" | "family";
  name: string;
  age?: number;
  timezone: string;
  language: string;
}

interface FamilyLinkRequest {
  elderlyUserId: string;
  relationship: "son" | "daughter" | "spouse" | "caregiver" | "other";
  permissions: ("view_reports" | "receive_alerts" | "view_conversations")[];
}

interface UserProfile {
  userId: string;
  role: "elderly" | "family";
  name: string;
  age?: number;
  linkedAccounts: LinkedAccount[];
}

interface LinkedAccount {
  userId: string;
  name: string;
  relationship: string;
  role: "elderly" | "family";
}

// === Companion ===
interface CompanionToolRequest {
  userId: string;
  args: Record<string, unknown>;
}

interface TranscriptEntry {
  role: "user" | "model";
  text: string;
  timestamp: string;
}

interface LogConversationRequest {
  userId: string;
  sessionDuration: number;
  transcript: TranscriptEntry[];
  flags: string[];
}

// === Storyteller ===
interface CreateMemoryRequest {
  userId: string;
  transcript: string;
  title?: string;
}

interface MemoryChapter {
  id: string;
  title: string;
  narrativeText: string;
  illustrationUrls: string[];
  audioScript: string;
  tags: string[];
  createdAt: string;
}

interface MemoryListItem {
  id: string;
  title: string;
  createdAt: string;
  illustrationUrls: string[];
  snippet: string;
}

// === Navigator ===
interface StartNavigatorRequest {
  userId: string;
  task: string;
  templateId?: "pension_check" | "book_appointment" | "read_report" | "fill_form";
  startUrl?: string;
}

interface NavigatorSession {
  sessionId: string;
  websocketUrl: string;
}

interface NavigatorScreenshot {
  type: "screenshot";
  data: {
    imageBase64: string;
    pageUrl: string;
    pageTitle: string;
    timestamp: string;
  };
}

interface NavigatorNarration {
  type: "narration";
  data: {
    message: string;
    timestamp: string;
  };
}

interface NavigatorConfirmation {
  type: "confirmation_required";
  data: {
    actionId: string;
    actionDescription: string;
    actionType: "form_submit" | "login" | "payment" | "download";
    timestamp: string;
  };
}

type NavigatorServerMessage =
  | NavigatorScreenshot
  | NavigatorNarration
  | NavigatorConfirmation
  | { type: "status"; data: { state: string; message: string } };

// === Health ===
interface HealthLog {
  date: string;
  mood: string;
  moodScore: number;
  painLevel: number;
  medicationsTaken: { name: string; time: string; confirmed: boolean }[];
  hydrationReminders: { sent: number; acknowledged: number };
  activityNotes: string;
}

interface HealthReport {
  id: string;
  type: "daily" | "weekly";
  content: string;
  imageUrls: string[];
  moodTrend: number[];
  medicationAdherence: number;
  concerns: string[];
  highlights: string[];
  generatedAt: string;
}

// === Alerts ===
interface Alert {
  id: string;
  userId: string;
  type: "emotional_distress" | "missed_medication" | "health_anomaly" | "inactivity";
  severity: "low" | "medium" | "high";
  message: string;
  source: "companion" | "storyteller" | "navigator" | "system";
  acknowledged: boolean;
  createdAt: string;
}

// === Reminders ===
interface Reminder {
  id: string;
  type: "medication" | "appointment" | "hydration" | "custom";
  message: string;
  scheduledTime: string;
  status: "pending" | "sent" | "acknowledged";
  recurring: boolean;
}
```

---

## 11. Python Pydantic Models

> **Note:** We use Pydantic `BaseModel` (not dataclasses) because FastAPI uses Pydantic
> for request validation, response serialization, and OpenAPI schema generation.
> Field names use `snake_case` in Python; use `model_config = ConfigDict(alias_generator=to_camel)`
> if you need camelCase JSON output matching the TypeScript interfaces.

```python
# models/api.py

from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field


# === Common ===
class ApiResponse(BaseModel):
    status: Literal["success", "error", "accepted", "pending"]
    data: Optional[dict] = None
    error_message: Optional[str] = Field(None, alias="errorMessage")


# === Auth ===
class RegisterRequest(BaseModel):
    role: Literal["elderly", "family"]
    name: str
    timezone: str
    language: str
    age: Optional[int] = None


class FamilyLinkRequest(BaseModel):
    elderly_user_id: str = Field(alias="elderlyUserId")
    relationship: Literal["son", "daughter", "spouse", "caregiver", "other"]
    permissions: list[str] = []

    model_config = ConfigDict(populate_by_name=True)


# === Companion ===
class TranscriptEntry(BaseModel):
    role: Literal["user", "model"]
    text: str
    timestamp: str


class LogConversationRequest(BaseModel):
    user_id: str = Field(alias="userId")
    session_duration: int = Field(alias="sessionDuration")
    transcript: list[TranscriptEntry] = []
    flags: list[str] = []

    model_config = ConfigDict(populate_by_name=True)


# === Storyteller ===
class CreateMemoryRequest(BaseModel):
    user_id: str = Field(alias="userId")
    transcript: str
    title: Optional[str] = None

    model_config = ConfigDict(populate_by_name=True)


class MemoryChapter(BaseModel):
    id: str
    title: str
    narrative_text: str
    illustration_urls: list[str]
    audio_script: str
    tags: list[str]
    created_at: datetime


# === Navigator ===
class StartNavigatorRequest(BaseModel):
    user_id: str = Field(alias="userId")
    task: str
    template_id: Optional[str] = Field(None, alias="templateId")
    start_url: Optional[str] = Field(None, alias="startUrl")

    model_config = ConfigDict(populate_by_name=True)


# === Health ===
class MedicationTaken(BaseModel):
    name: str
    time: str
    confirmed: bool


class HealthLog(BaseModel):
    date: str
    mood: str
    mood_score: int
    pain_level: int
    medications_taken: list[MedicationTaken] = []
    hydration_sent: int = 0
    hydration_acknowledged: int = 0
    activity_notes: str = ""


class HealthReport(BaseModel):
    id: str
    type: Literal["daily", "weekly"]
    content: str
    image_urls: list[str]
    mood_trend: list[int]
    medication_adherence: float
    concerns: list[str]
    highlights: list[str]
    generated_at: datetime


# === Alerts ===
class Alert(BaseModel):
    id: str
    user_id: str
    type: Literal["emotional_distress", "missed_medication", "health_anomaly", "inactivity"]
    severity: Literal["low", "medium", "high"]
    message: str
    source: Literal["companion", "storyteller", "navigator", "system"]
    acknowledged: bool = False
    acknowledged_by: Optional[str] = None
    created_at: Optional[datetime] = None


class Signal(BaseModel):
    user_id: str
    type: Literal["emotional_distress", "missed_medication", "health_anomaly", "inactivity"]
    severity: Literal["low", "medium", "high"]
    observation: str
    source: Literal["companion", "storyteller", "navigator", "system"]


# === Reminders ===
class Reminder(BaseModel):
    id: str
    type: Literal["medication", "appointment", "hydration", "custom"]
    message: str
    scheduled_time: datetime
    status: Literal["pending", "sent", "acknowledged"] = "pending"
    recurring: bool = False
    recurrence_pattern: Optional[str] = None
```

---

## 12. Error Responses

All endpoints use consistent error format:

```json
{
  "status": "error",
  "errorMessage": "Human-readable description"
}
```

**HTTP Status Codes:**
| Code | Meaning |
|------|---------|
| 200 | Success |
| 201 | Created |
| 202 | Accepted (async task started) |
| 400 | Bad request (validation error) |
| 401 | Unauthorized (invalid/missing Firebase token) |
| 403 | Forbidden (no permission for this resource) |
| 404 | Not found |
| 429 | Rate limited |
| 500 | Internal server error |
