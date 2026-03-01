# Gemini Live API — Research Notes

**Date:** 2026-02-28
**Purpose:** Technical research for CARIA elderly care companion
**Sources:** Google AI for Developers docs, Vertex AI docs, GitHub examples, Google Colab notebooks

---

## 1. Overview

The Gemini Live API is a **stateful, WebSocket-based API** for real-time bidirectional audio, video, and text streaming with Gemini models. It enables low-latency voice conversations with native audio understanding and generation.

**Key characteristics:**
- WebSocket protocol (not REST)
- Bidirectional: client streams audio/video in, server streams audio/text out
- Stateful sessions with context persistence
- Supports function calling during live sessions
- Voice Activity Detection (VAD) with interruption handling
- Native audio reasoning (not speech-to-text → LLM → text-to-speech pipeline)

---

## 2. WebSocket Connection Protocol

### Endpoint

```
wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent
```

API version: `v1beta`

### Authentication

Two methods:
1. **Query parameter:** `?access_token=<token>` appended to WebSocket URL
2. **HTTP header:** `Authorization: Token <token>`

For browser clients, use **ephemeral tokens** (see Section 9). Never expose raw API keys in client code.

### Connection Lifecycle

1. Client opens WebSocket connection
2. Client sends `setup` message (first message, required)
3. Bidirectional streaming begins
4. Server sends `goAway` before forced disconnection
5. Connection closes (client or server initiated)

### Message Protocol

All client messages must contain **exactly one** of these fields:

| Field | Purpose |
|---|---|
| `setup` | Session configuration (first message only) |
| `clientContent` | Text input / conversation history |
| `realtimeInput` | Audio/video/text stream chunks |
| `toolResponse` | Function call responses |

All server messages contain optional `usageMetadata` plus one of:

| Field | Purpose |
|---|---|
| `setupComplete` | Confirms session is ready |
| `serverContent` | Model output (audio/text) |
| `toolCall` | Function call requests |
| `toolCallCancellation` | Cancel pending function calls |
| `goAway` | Warning before disconnection |

---

## 3. Setup Message (Session Configuration)

The setup message is sent once immediately after WebSocket connection. It configures the entire session.

### Structure

```json
{
  "setup": {
    "model": "models/gemini-2.5-flash-native-audio-preview-12-2025",
    "generationConfig": {
      "responseModalities": ["AUDIO"],
      "speechConfig": {
        "voiceConfig": {
          "prebuiltVoiceConfig": {
            "voiceName": "Kore"
          }
        }
      },
      "enableAffectiveDialog": true
    },
    "systemInstruction": {
      "parts": [{ "text": "You are CARIA, a warm patient elderly care companion..." }]
    },
    "tools": [
      { "functionDeclarations": [...] },
      { "googleSearch": {} }
    ],
    "realtimeInputConfig": {
      "automaticActivityDetection": {
        "disabled": false,
        "startOfSpeechSensitivity": "START_SENSITIVITY_HIGH",
        "endOfSpeechSensitivity": "END_SENSITIVITY_HIGH",
        "prefixPaddingMs": 20,
        "silenceDurationMs": 100
      },
      "activityHandling": "START_OF_ACTIVITY_INTERRUPTS"
    },
    "sessionResumption": { "handle": "<previous_handle>" },
    "contextWindowCompression": {
      "slidingWindow": {}
    },
    "inputAudioTranscription": {},
    "outputAudioTranscription": {},
    "proactivity": { "proactiveAudio": true }
  }
}
```

### Key Configuration Fields

| Field | Type | Description |
|---|---|---|
| `model` | string | Required. Format: `models/{model_id}` |
| `generationConfig.responseModalities` | string[] | `["AUDIO"]` or `["TEXT"]` — one per session |
| `generationConfig.speechConfig` | object | Voice selection |
| `generationConfig.enableAffectiveDialog` | bool | Emotional expressiveness |
| `generationConfig.thinkingConfig` | object | Thinking budget for reasoning |
| `generationConfig.mediaResolution` | string | Image/video resolution hint |
| `systemInstruction` | Content | System prompt (text only) |
| `tools` | Tool[] | Function declarations, Google Search |
| `realtimeInputConfig` | object | VAD and interruption settings |
| `sessionResumption` | object | Resume from previous session |
| `contextWindowCompression` | object | Sliding window for long sessions |
| `inputAudioTranscription` | object | Transcribe user speech |
| `outputAudioTranscription` | object | Transcribe model speech |
| `proactivity` | object | Allow model to decline irrelevant prompts |

---

## 4. Audio Input/Output

### Input Audio Format

- **Encoding:** Raw 16-bit PCM, little-endian
- **Sample rate:** 16kHz (native; auto-resampled from other rates)
- **Channels:** Mono
- **MIME type:** `audio/pcm;rate=16000`
- **Chunk size:** Typically 4096 bytes per chunk

### Output Audio Format

- **Encoding:** Raw 16-bit PCM, little-endian
- **Sample rate:** 24kHz
- **Channels:** Mono

### Sending Audio (JavaScript)

```javascript
// Using the SDK
session.sendRealtimeInput({
  audio: {
    data: base64EncodedPCMData,
    mimeType: "audio/pcm;rate=16000"
  }
});

// Using raw WebSocket
ws.send(JSON.stringify({
  realtimeInput: {
    audio: {
      mimeType: "audio/pcm;rate=16000",
      data: base64EncodedChunk
    }
  }
}));
```

### Sending Audio (Python)

```python
import base64

chunk = audio_stream.read(4096)  # 16-bit PCM, 16kHz
msg = {
    "realtime_input": {
        "audio": {
            "mime_type": "audio/pcm;rate=16000",
            "data": base64.b64encode(chunk).decode("utf-8")
        }
    }
}
await ws.send(json.dumps(msg))
```

### Receiving Audio

Audio comes in `serverContent.modelTurn.parts[].inlineData`:

```javascript
// JavaScript
for (const part of message.serverContent.modelTurn.parts) {
  if (part.inlineData) {
    const pcmData = atob(part.inlineData.data);  // base64 → PCM bytes
    // Queue for playback at 24kHz
  }
}
```

```python
# Python
parts = response["serverContent"]["modelTurn"]["parts"]
for part in parts:
    if "inlineData" in part:
        pcm_data = base64.b64decode(part["inlineData"]["data"])
        # Play at 24kHz sample rate
```

### Available Voices

Native audio models support all Google TTS voices. The core prebuilt voices are:

| Voice | Character |
|---|---|
| **Puck** | Default, conversational, friendly |
| **Charon** | Deep, authoritative |
| **Kore** | Neutral, professional |
| **Fenrir** | Warm, approachable |
| **Aoede** | Melodic |
| **Leda** | Soft |
| **Orus** | Clear |
| **Zephyr** | Light |

**CARIA recommendation:** `Kore` or `Leda` — professional yet warm for elderly users.

### Audio Transcription

Both input and output transcription are available:

```javascript
const config = {
  responseModalities: [Modality.AUDIO],
  inputAudioTranscription: {},   // Transcribe user speech
  outputAudioTranscription: {}   // Transcribe model speech
};
```

Transcriptions arrive as separate server messages:
- `serverContent.inputTranscription.text` — what the user said
- `serverContent.outputTranscription.text` — what the model said

**Important for CARIA:** Enable both to log conversations for health reports and memory journal.

---

## 5. Video / Camera Input

### Frame Format

- **Encoding:** JPEG
- **Quality:** 90 (recommended)
- **Resolution:** 768x768 native (best results); other resolutions auto-scaled
- **Frame rate:** ~1 FPS recommended (higher rates waste tokens without benefit)
- **MIME type:** `image/jpeg`

### Sending Video Frames (JavaScript — Browser Webcam)

```javascript
// Capture frame from video element
const canvas = document.createElement('canvas');
const ctx = canvas.getContext('2d');
canvas.width = 768;
canvas.height = 768;

function captureAndSendFrame(videoElement) {
  ctx.drawImage(videoElement, 0, 0, 768, 768);
  canvas.toBlob((blob) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64data = reader.result.split(',')[1];
      session.sendRealtimeInput({
        video: {
          data: base64data,
          mimeType: "image/jpeg"
        }
      });
    };
    reader.readAsDataURL(blob);
  }, 'image/jpeg', 0.9);
}

// Send at ~1 FPS
setInterval(() => captureAndSendFrame(videoEl), 1000);
```

### Sending Video Frames (Python)

```python
import cv2
import base64

cap = cv2.VideoCapture(0)  # webcam
ret, frame = cap.read()
frame_resized = cv2.resize(frame, (768, 768))
_, jpeg = cv2.imencode('.jpg', frame_resized, [cv2.IMWRITE_JPEG_QUALITY, 90])
b64_data = base64.b64encode(jpeg.tobytes()).decode('utf-8')

msg = {
    "realtime_input": {
        "video": {
            "mime_type": "image/jpeg",
            "data": b64_data
        }
    }
}
await ws.send(json.dumps(msg))
```

### Raw WebSocket Format (Deprecated `mediaChunks` vs New `video` Field)

```json
// NEW (recommended) — use separate audio/video fields
{
  "realtimeInput": {
    "video": { "mimeType": "image/jpeg", "data": "<base64>" }
  }
}

// OLD (deprecated) — mediaChunks
{
  "realtimeInput": {
    "mediaChunks": [{ "mimeType": "image/jpeg", "data": "<base64>" }]
  }
}
```

**CARIA note:** Video is critical for medication bottle scanning. The model can read text from webcam frames when sent as JPEG at reasonable quality.

---

## 6. Voice Activity Detection (VAD) & Interruption Handling

### VAD Configuration

```javascript
const config = {
  realtimeInputConfig: {
    automaticActivityDetection: {
      disabled: false,                          // Enable automatic VAD
      startOfSpeechSensitivity: "START_SENSITIVITY_HIGH",  // HIGH or LOW
      endOfSpeechSensitivity: "END_SENSITIVITY_HIGH",      // HIGH or LOW
      prefixPaddingMs: 20,                      // ms before committing start-of-speech
      silenceDurationMs: 100                    // ms silence to detect end-of-speech
    },
    activityHandling: "START_OF_ACTIVITY_INTERRUPTS"  // or "NO_INTERRUPTION"
  }
};
```

### VAD Parameters Explained

| Parameter | Values | Description |
|---|---|---|
| `disabled` | bool | `false` = automatic VAD (default) |
| `startOfSpeechSensitivity` | `HIGH` / `LOW` | How quickly speech is detected. HIGH = more responsive |
| `endOfSpeechSensitivity` | `HIGH` / `LOW` | How quickly silence triggers end. HIGH = faster cutoff |
| `prefixPaddingMs` | int | Buffer before confirming speech started |
| `silenceDurationMs` | int | How long silence must last to end turn |
| `activityHandling` | enum | `START_OF_ACTIVITY_INTERRUPTS` (barge-in) or `NO_INTERRUPTION` |

### Interruption Handling

When VAD detects user speech while the model is speaking:

1. Server sends `serverContent` with `interrupted: true`
2. Client should **immediately clear the audio playback queue**
3. Server stops generating the current response
4. Server begins processing the user's new input

```javascript
// Handle interruption
if (message.serverContent?.interrupted) {
  audioPlaybackQueue.clear();  // Stop playing current response
  // Model will now respond to the new user input
}
```

### Manual Activity Detection

If you disable automatic VAD, send manual signals:

```javascript
// Signal speech start
session.sendRealtimeInput({ activityStart: {} });

// Signal speech end
session.sendRealtimeInput({ activityEnd: {} });

// Signal mic disabled
session.sendRealtimeInput({ audioStreamEnd: true });
```

### CARIA Recommendation for Elderly Users

- Use `START_SENSITIVITY_LOW` — elderly users may make non-speech sounds (coughing, breathing)
- Use `END_SENSITIVITY_LOW` with higher `silenceDurationMs` (500-1000ms) — elderly users pause more between words
- Use `START_OF_ACTIVITY_INTERRUPTS` — Gemini natively handles interruptions by clearing its audio queue
- The design doc's "30+ seconds silence prompt" must be handled client-side with a timer, not through VAD

---

## 7. Function Calling in Live Sessions

### Declaring Functions

```javascript
const tools = [{
  functionDeclarations: [
    {
      name: "analyze_medication",
      description: "Analyze a medication bottle visible in the camera feed",
      parameters: {
        type: "object",
        properties: {
          image_description: {
            type: "string",
            description: "What the model sees on the bottle label"
          }
        },
        required: ["image_description"]
      }
    },
    {
      name: "flag_emotional_distress",
      description: "Flag emotional distress detected in user's voice or words",
      parameters: {
        type: "object",
        properties: {
          severity: { type: "string", enum: ["low", "medium", "high"] },
          observation: { type: "string" }
        },
        required: ["severity", "observation"]
      }
    },
    {
      name: "log_health_checkin",
      description: "Log daily health check-in data",
      parameters: {
        type: "object",
        properties: {
          mood: { type: "string", enum: ["happy", "okay", "sad", "anxious", "confused", "tired"] },
          pain_level: { type: "integer", minimum: 0, maximum: 10 },
          notes: { type: "string" }
        },
        required: ["mood", "pain_level", "notes"]
      }
    },
    {
      name: "set_reminder",
      description: "Set a reminder for the user",
      parameters: {
        type: "object",
        properties: {
          reminder_type: { type: "string", enum: ["medication", "appointment", "hydration", "custom"] },
          message: { type: "string" },
          time: { type: "string" }
        },
        required: ["reminder_type", "message", "time"]
      }
    }
  ]
}];
```

### Receiving and Responding to Tool Calls

```javascript
// Using SDK callbacks
const session = await ai.live.connect({
  model: model,
  config: { ...config, tools },
  callbacks: {
    onmessage: async (message) => {
      // Handle tool calls
      if (message.toolCall) {
        const responses = [];
        for (const fc of message.toolCall.functionCalls) {
          // Execute the function (call your backend API)
          const result = await executeFunction(fc.name, fc.args);
          responses.push({
            id: fc.id,
            name: fc.name,
            response: result
          });
        }
        session.sendToolResponse({ functionResponses: responses });
      }

      // Handle audio output
      if (message.serverContent?.modelTurn?.parts) {
        for (const part of message.serverContent.modelTurn.parts) {
          if (part.inlineData) {
            playAudio(part.inlineData.data);
          }
        }
      }

      // Handle interruption
      if (message.serverContent?.interrupted) {
        clearAudioQueue();
      }
    }
  }
});
```

### Asynchronous (Non-Blocking) Function Calls

Functions can be declared as `NON_BLOCKING` so the model continues talking while waiting for results:

```javascript
const tools = [{
  functionDeclarations: [{
    name: "log_health_checkin",
    description: "Log daily health check-in data",
    behavior: "NON_BLOCKING",  // Model won't pause while waiting
    parameters: { ... }
  }]
}];

// When sending response, control how model uses it:
session.sendToolResponse({
  functionResponses: [{
    id: fc.id,
    name: fc.name,
    response: result,
    scheduling: "SILENT"  // "INTERRUPT" | "WHEN_IDLE" | "SILENT"
  }]
});
```

**Scheduling options:**
- `INTERRUPT` — Immediately alert user about the result
- `WHEN_IDLE` — Wait until model finishes current response
- `SILENT` — Absorb knowledge without interrupting

**CARIA recommendation:**
- `analyze_medication` → blocking (user is waiting for answer)
- `flag_emotional_distress` → `NON_BLOCKING` + `SILENT` (don't disrupt conversation)
- `log_health_checkin` → `NON_BLOCKING` + `SILENT` (background logging)
- `set_reminder` → `NON_BLOCKING` + `WHEN_IDLE` (confirm to user when natural)

### Tool Call Cancellation

If the user interrupts while a tool call is pending, the server sends:

```json
{
  "toolCallCancellation": {
    "ids": ["call_123", "call_456"]
  }
}
```

Client should cancel any in-progress function executions for those IDs.

### Supported Tools Matrix (gemini-2.5-flash-native-audio)

| Tool Type | Supported |
|---|---|
| Function calling | Yes |
| Google Search | Yes |
| Google Maps | No |
| Code execution | No |
| URL context | No |

---

## 8. Session Management

### Session Duration Limits

| Session Type | Max Duration (no compression) |
|---|---|
| Audio only | ~15 minutes |
| Audio + video | ~2 minutes |
| WebSocket connection | ~10 minutes |

**Critical:** WebSocket connections are capped at ~10 minutes regardless of session type. Must reconnect using session resumption for longer conversations.

### Context Window

| Model | Context Window |
|---|---|
| Native audio models | 128k tokens |
| Other Live API models | 32k tokens |

### Context Window Compression (for Long Sessions)

Enable sliding window compression to prevent session termination:

```javascript
const config = {
  responseModalities: [Modality.AUDIO],
  contextWindowCompression: {
    slidingWindow: {
      targetTokens: 16000  // Optional: tokens to retain after compression
    },
    triggerTokens: 100000   // Optional: compress when reaching this count
  }
};
```

Default behavior:
- Triggers at 80% of context window limit
- Retains 50% of trigger_tokens after compression
- Discards beginning of conversation context

### Session Resumption

Allows reconnecting without losing conversation state (essential for >10 min sessions):

```javascript
let lastSessionHandle = null;

const session = await ai.live.connect({
  model: model,
  config: {
    responseModalities: [Modality.AUDIO],
    sessionResumption: {
      handle: lastSessionHandle  // null for first connection
    }
  },
  callbacks: {
    onmessage: (message) => {
      // Store resumption handle whenever received
      if (message.sessionResumptionUpdate) {
        if (message.sessionResumptionUpdate.resumable &&
            message.sessionResumptionUpdate.newHandle) {
          lastSessionHandle = message.sessionResumptionUpdate.newHandle;
        }
      }
    }
  }
});
```

**Key facts:**
- Session handles are valid for **2 hours** after disconnection
- Same ephemeral token works for reconnection even with `uses: 1`
- Server sends `goAway` message before forced disconnection with `timeLeft` field

### GoAway Handling

```javascript
if (message.goAway) {
  console.log('Server disconnecting in:', message.goAway.timeLeft);
  // Initiate graceful reconnection using stored session handle
  reconnectWithHandle(lastSessionHandle);
}
```

### CARIA Long Conversation Strategy

1. Enable `contextWindowCompression` with `slidingWindow` on every session
2. Enable `sessionResumption` on every session
3. Store `lastSessionHandle` in component state
4. Listen for `goAway` messages → trigger automatic reconnection
5. On reconnect, pass the stored handle in `sessionResumption.handle`
6. This enables effectively unlimited conversation duration

---

## 9. Ephemeral Tokens

### Purpose

Short-lived tokens for browser → Gemini Live API connections. Prevents API key exposure in client-side code.

### Architecture

```
Browser → Your Backend (authenticated) → Gemini API → Ephemeral Token
                                                           ↓
Browser ← Token ← Your Backend
    ↓
Browser → Gemini Live API (WebSocket with token)
```

### Token Lifetime

| Parameter | Default | Max |
|---|---|---|
| `expireTime` | 30 minutes | 20 hours |
| `newSessionExpireTime` | 1 minute | 20 hours |
| `uses` | 1 | unlimited (0) |

### Server-Side Token Creation (Python Backend)

```python
import datetime
from google import genai

client = genai.Client(http_options={'api_version': 'v1alpha'})
now = datetime.datetime.now(tz=datetime.timezone.utc)

token = client.auth_tokens.create(
    config={
        'uses': 1,  # Single session
        'expire_time': now + datetime.timedelta(minutes=30),
        'new_session_expire_time': now + datetime.timedelta(minutes=2),
        'http_options': {'api_version': 'v1alpha'},
    }
)
# Return token.name to the client
```

### Server-Side Token Creation (Node.js Backend)

```javascript
import { GoogleGenAI } from "@google/genai";

const serverAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function createEphemeralToken() {
  const expireTime = new Date(Date.now() + 30 * 60 * 1000).toISOString();
  const newSessionExpireTime = new Date(Date.now() + 2 * 60 * 1000).toISOString();

  const token = await serverAI.authTokens.create({
    config: {
      uses: 1,
      expireTime: expireTime,
      newSessionExpireTime: newSessionExpireTime,
      httpOptions: { apiVersion: 'v1alpha' }
    }
  });

  return token.name;  // This is the ephemeral token string
}
```

### Locking Session Configuration (Security)

Lock system instructions and model on the server so the client can't override them:

```python
token = client.auth_tokens.create(
    config={
        'uses': 1,
        'expire_time': now + datetime.timedelta(minutes=30),
        'live_connect_constraints': {
            'model': 'gemini-2.5-flash-native-audio-preview-12-2025',
            'config': {
                'system_instruction': 'You are CARIA, a warm elderly care companion...',
                'session_resumption': {},
                'temperature': 0.7,
                'response_modalities': ['AUDIO'],
                'tools': [{ 'function_declarations': [...] }]
            }
        },
        'http_options': {'api_version': 'v1alpha'},
    }
)
```

**Security benefit:** Even if someone extracts the token, they can't change the system prompt, model, or tool definitions.

### Client-Side Usage (Browser)

```javascript
// Get token from your backend
const response = await fetch('/api/gemini/token', {
  headers: { Authorization: `Bearer ${userFirebaseToken}` }
});
const { token } = await response.json();

// Connect to Gemini using ephemeral token
const ai = new GoogleGenAI({ apiKey: token });

const session = await ai.live.connect({
  model: 'gemini-2.5-flash-native-audio-preview-12-2025',
  config: {
    responseModalities: [Modality.AUDIO],
    // If constraints are locked server-side, these are optional
  },
  callbacks: { ... }
});
```

### Without SDK (Raw WebSocket)

```javascript
const ws = new WebSocket(
  `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?access_token=${ephemeralToken}`
);
```

Or via header: `Authorization: Token <ephemeral_token>`

### CARIA Token Strategy

1. User logs in via Firebase Auth
2. Frontend calls `POST /api/gemini/token` (authenticated)
3. Backend validates Firebase token, creates ephemeral token with locked CARIA config
4. Frontend connects directly to Gemini Live API
5. Token expires after 30 min; frontend requests new token on reconnect
6. System instructions + tools are locked server-side (user can't tamper)

---

## 10. Available Models

### Primary Live API Model

| Model ID | Description |
|---|---|
| `gemini-2.5-flash-native-audio-preview-12-2025` | Flagship Live API model. Native audio reasoning, sub-second latency. 128k context window. |

### Vertex AI Equivalents

| Model ID | Description |
|---|---|
| `gemini-live-2.5-flash-native-audio` | Production-ready alias |
| `gemini-live-2.5-flash-preview-native-audio-09-2025` | Earlier preview |

### Firebase AI Logic Support

Supported models: `gemini-2.5-flash-native-audio-preview-12-2025`, `gemini-2.5-flash-native-audio-preview-09-2025`

### Native Audio vs Half-Cascade

- **Native audio:** Model directly understands and generates audio. Better voice quality, tone, emotion. Supports affective dialog. 128k context. Fewer tool types supported.
- **Half-cascade:** Speech-to-text → LLM → text-to-speech pipeline. More tool support but higher latency. 32k context.

**CARIA uses native audio** for the lowest latency and most natural voice interaction with elderly users.

---

## 11. Rate Limits & Pricing

### Pricing (Gemini 2.5 Flash Native Audio — Live API)

| Direction | Free Tier | Paid Tier |
|---|---|---|
| Input (text) | Free | $0.50 / 1M tokens |
| Input (audio/video) | Free | $3.00 / 1M tokens |
| Output (text) | Free | $2.00 / 1M tokens |
| Output (audio) | Free | $12.00 / 1M tokens |

### Rate Limits

| Tier | Qualification | Limits |
|---|---|---|
| Free | Eligible countries | 5-15 RPM, ~250K TPM, limited RPD |
| Tier 1 | Paid billing linked | 150-300 RPM, ~1M TPM, 1500 RPD |
| Tier 2 | >$250 spend + 30 days | Higher limits |
| Tier 3 | >$1000 spend + 30 days | Highest limits |

**Note:** Specific Live API RPM/TPM numbers are not publicly documented. Check Google AI Studio for your project's active limits.

### Cost Estimate for CARIA

A 15-minute voice session at ~16kHz PCM:
- ~30MB raw audio input → ~1.5M audio tokens input
- ~30MB audio output → ~1.5M audio tokens output
- Cost: ~$4.50 input + ~$18 output = **~$22.50 per 15-min session** (paid tier)
- **Free tier:** Sufficient for hackathon demo and development

**Optimization:** Use context window compression aggressively. Shorter, more frequent sessions rather than ultra-long ones.

---

## 12. Client-to-Server vs Server-to-Server Architecture

### Client-to-Server (Recommended for CARIA)

```
Browser → WebSocket → Gemini Live API
                ↑
    Ephemeral token from backend
```

**Pros:**
- Lowest latency (no server hop for audio/video)
- Simpler infrastructure
- Google handles WebSocket scaling

**Cons:**
- Requires ephemeral token management
- Function call execution must call your backend API from browser
- System instructions visible if not locked via token constraints

### Server-to-Server

```
Browser → WebSocket → Your Server → WebSocket → Gemini Live API
```

**Pros:**
- Full control over all data
- API key stays server-side
- Can intercept/modify all messages

**Cons:**
- Double latency (two hops)
- Must handle WebSocket scaling yourself
- More complex infrastructure

### CARIA Architecture Decision

**Client-to-server** with locked ephemeral tokens. The backend only handles:
1. Ephemeral token provisioning (locked config)
2. Function call execution endpoints (REST APIs called from browser when tool calls arrive)
3. Conversation logging (browser sends transcripts to backend after session)

---

## 13. Complete Working Example — CARIA Voice Companion

### Browser Client (TypeScript)

```typescript
import { GoogleGenAI, Modality } from '@google/genai';

interface CARIACompanionConfig {
  userId: string;
  firebaseToken: string;
  onTranscript: (who: 'user' | 'model', text: string) => void;
  onStatusChange: (status: 'connecting' | 'connected' | 'disconnected') => void;
}

class CARIACompanion {
  private session: any = null;
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private lastSessionHandle: string | null = null;
  private audioPlaybackQueue: ArrayBuffer[] = [];
  private isPlaying = false;

  constructor(private config: CARIACompanionConfig) {}

  async connect() {
    this.config.onStatusChange('connecting');

    // 1. Get ephemeral token from backend
    const tokenRes = await fetch('/api/gemini/token', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.firebaseToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ userId: this.config.userId })
    });
    const { token } = await tokenRes.json();

    // 2. Connect to Gemini Live API
    const ai = new GoogleGenAI({ apiKey: token });

    this.session = await ai.live.connect({
      model: 'gemini-2.5-flash-native-audio-preview-12-2025',
      config: {
        responseModalities: [Modality.AUDIO],
        sessionResumption: {
          handle: this.lastSessionHandle ?? undefined
        },
        contextWindowCompression: { slidingWindow: {} },
        inputAudioTranscription: {},
        outputAudioTranscription: {},
      },
      callbacks: {
        onopen: () => {
          this.config.onStatusChange('connected');
        },
        onmessage: (message: any) => this.handleMessage(message),
        onerror: (e: any) => {
          console.error('Gemini error:', e);
        },
        onclose: () => {
          this.config.onStatusChange('disconnected');
        }
      }
    });

    // 3. Start microphone capture
    await this.startMicrophone();
  }

  private async handleMessage(message: any) {
    // Session resumption
    if (message.sessionResumptionUpdate?.resumable &&
        message.sessionResumptionUpdate?.newHandle) {
      this.lastSessionHandle = message.sessionResumptionUpdate.newHandle;
    }

    // GoAway — reconnect before disconnection
    if (message.goAway) {
      console.log('Reconnecting, time left:', message.goAway.timeLeft);
      await this.reconnect();
      return;
    }

    // Tool calls — execute via backend
    if (message.toolCall) {
      await this.handleToolCalls(message.toolCall.functionCalls);
      return;
    }

    // Tool call cancellation
    if (message.toolCallCancellation) {
      // Cancel any pending function executions
      return;
    }

    // Audio output
    if (message.serverContent?.modelTurn?.parts) {
      for (const part of message.serverContent.modelTurn.parts) {
        if (part.inlineData) {
          this.queueAudioPlayback(part.inlineData.data);
        }
      }
    }

    // Interruption — clear playback
    if (message.serverContent?.interrupted) {
      this.audioPlaybackQueue = [];
      this.isPlaying = false;
    }

    // Transcriptions for logging
    if (message.serverContent?.inputTranscription?.text) {
      this.config.onTranscript('user', message.serverContent.inputTranscription.text);
    }
    if (message.serverContent?.outputTranscription?.text) {
      this.config.onTranscript('model', message.serverContent.outputTranscription.text);
    }
  }

  private async handleToolCalls(functionCalls: any[]) {
    const responses = [];
    for (const fc of functionCalls) {
      // Execute function via backend REST API
      const result = await fetch(`/api/companion/${fc.name}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.firebaseToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId: this.config.userId,
          args: fc.args
        })
      });
      const data = await result.json();
      responses.push({ id: fc.id, name: fc.name, response: data });
    }
    this.session.sendToolResponse({ functionResponses: responses });
  }

  private async startMicrophone() {
    this.mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: { sampleRate: 16000, channelCount: 1, echoCancellation: true }
    });

    this.audioContext = new AudioContext({ sampleRate: 16000 });
    const source = this.audioContext.createMediaStreamSource(this.mediaStream);
    const processor = this.audioContext.createScriptProcessor(4096, 1, 1);

    processor.onaudioprocess = (event) => {
      const pcmData = event.inputBuffer.getChannelData(0);
      const int16Data = new Int16Array(pcmData.length);
      for (let i = 0; i < pcmData.length; i++) {
        int16Data[i] = Math.max(-32768, Math.min(32767, pcmData[i] * 32768));
      }
      const base64 = btoa(String.fromCharCode(...new Uint8Array(int16Data.buffer)));
      this.session?.sendRealtimeInput({
        audio: { data: base64, mimeType: 'audio/pcm;rate=16000' }
      });
    };

    source.connect(processor);
    processor.connect(this.audioContext.destination);
  }

  // Send webcam frame for medication scanning
  async sendVideoFrame(videoElement: HTMLVideoElement) {
    const canvas = document.createElement('canvas');
    canvas.width = 768;
    canvas.height = 768;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(videoElement, 0, 0, 768, 768);

    return new Promise<void>((resolve) => {
      canvas.toBlob((blob) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = (reader.result as string).split(',')[1];
          this.session?.sendRealtimeInput({
            video: { data: base64, mimeType: 'image/jpeg' }
          });
          resolve();
        };
        reader.readAsDataURL(blob!);
      }, 'image/jpeg', 0.9);
    });
  }

  private queueAudioPlayback(base64Data: string) {
    // Decode and queue for playback at 24kHz
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    this.audioPlaybackQueue.push(bytes.buffer);
    if (!this.isPlaying) this.playNextChunk();
  }

  private async playNextChunk() {
    if (this.audioPlaybackQueue.length === 0) {
      this.isPlaying = false;
      return;
    }
    this.isPlaying = true;
    const chunk = this.audioPlaybackQueue.shift()!;
    const playbackCtx = new AudioContext({ sampleRate: 24000 });
    const buffer = playbackCtx.createBuffer(1, chunk.byteLength / 2, 24000);
    const channelData = buffer.getChannelData(0);
    const int16View = new Int16Array(chunk);
    for (let i = 0; i < int16View.length; i++) {
      channelData[i] = int16View[i] / 32768;
    }
    const source = playbackCtx.createBufferSource();
    source.buffer = buffer;
    source.connect(playbackCtx.destination);
    source.onended = () => this.playNextChunk();
    source.start();
  }

  private async reconnect() {
    this.session?.close();
    await this.connect();  // Will use lastSessionHandle for resumption
  }

  async disconnect() {
    this.session?.close();
    this.mediaStream?.getTracks().forEach(t => t.stop());
    this.audioContext?.close();
  }
}
```

### Backend Token Endpoint (Next.js API Route)

```typescript
// app/api/gemini/token/route.ts
import { GoogleGenAI } from '@google/genai';
import { verifyFirebaseToken } from '@/lib/firebase-admin';
import { getCompanionConfig } from '@/lib/companion-config';

const serverAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function POST(request: Request) {
  // Verify Firebase auth
  const authHeader = request.headers.get('Authorization');
  const firebaseToken = authHeader?.replace('Bearer ', '');
  const user = await verifyFirebaseToken(firebaseToken!);

  // Get user-specific companion configuration
  const companionConfig = await getCompanionConfig(user.uid);

  // Create ephemeral token with locked configuration
  const expireTime = new Date(Date.now() + 30 * 60 * 1000).toISOString();
  const newSessionExpireTime = new Date(Date.now() + 2 * 60 * 1000).toISOString();

  const token = await serverAI.authTokens.create({
    config: {
      uses: 1,
      expireTime,
      newSessionExpireTime,
      liveConnectConstraints: {
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        config: {
          systemInstruction: companionConfig.systemInstruction,
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Kore' }
            }
          },
          tools: companionConfig.tools,
          sessionResumption: {},
          contextWindowCompression: { slidingWindow: {} },
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          realtimeInputConfig: {
            automaticActivityDetection: {
              startOfSpeechSensitivity: 'START_SENSITIVITY_LOW',
              endOfSpeechSensitivity: 'END_SENSITIVITY_LOW',
              silenceDurationMs: 800
            }
          }
        }
      },
      httpOptions: { apiVersion: 'v1alpha' }
    }
  });

  return Response.json({ token: token.name });
}
```

---

## 14. Known Limitations & Workarounds

### Limitations

1. **Audio+video sessions: 2 min without compression** — Enable `contextWindowCompression` always
2. **WebSocket connections: ~10 min max** — Must use session resumption for longer conversations
3. **One response modality per session** — Can't switch between AUDIO and TEXT mid-session
4. **No code execution tool** in native audio model — Use function calling to delegate to backend
5. **No URL context tool** in native audio model
6. **No Google Maps tool** in native audio model
7. **Video at ~1 FPS** — Not real-time video processing, more like periodic frame analysis
8. **System instruction in ephemeral token may be ignored** — Known bug reported in forums. Test thoroughly.
9. **Token count API not supported** with Live API sessions
10. **Firebase AI Logic SDK** doesn't yet return `UsageMetadata`
11. **Vertex AI Live API models** not supported in `global` location

### Workarounds

| Limitation | Workaround |
|---|---|
| 2-min video session limit | Enable sliding window compression |
| 10-min WebSocket limit | Session resumption with automatic reconnect |
| No code execution | Function calling → backend execution |
| System instruction override | Lock via `liveConnectConstraints` in ephemeral token |
| Video frame rate | Send frames only when relevant (e.g., user says "look at this") |
| Expensive audio output | Keep responses concise via system instruction |

---

## 15. Design Doc Compatibility Analysis

### CompanionAgent Design (Section 6.1) vs Actual API

| Design Doc | API Reality | Compatible? |
|---|---|---|
| Model: `gemini-2.5-flash-native-audio` | Actual ID: `gemini-2.5-flash-native-audio-preview-12-2025` | **Update needed** — model ID is different |
| Audio: 16-bit PCM, 16kHz, mono | Confirmed | **Compatible** |
| Ephemeral tokens | Fully supported with config locking | **Compatible** |
| Function calling (4 tools) | Supported, including async/non-blocking | **Compatible** |
| Webcam for medication scanning | Supported via JPEG frames at ~1 FPS | **Compatible** — but add frame-on-demand, not continuous |
| 30s silence prompt | Must be client-side timer (VAD doesn't do this) | **Compatible** — needs client logic |
| Interruption handling | Native `START_OF_ACTIVITY_INTERRUPTS` | **Compatible** |
| Conversation logging | Input/output transcription available | **Compatible** — use transcription config |

### Recommended Design Updates

1. **Model ID correction** — Use `gemini-2.5-flash-native-audio-preview-12-2025`
2. **Add session management** — Context window compression + session resumption required for >2 min video sessions
3. **Add VAD tuning for elderly** — Lower sensitivity, higher silence duration
4. **Add non-blocking tool config** — `flag_emotional_distress` and `log_health_checkin` should be NON_BLOCKING + SILENT
5. **Video strategy** — Don't stream continuous video. Send frames on-demand when user activates camera mode for medication scanning. This avoids the 2-min video limit.
6. **Add reconnection logic** — Handle `goAway` messages and auto-reconnect with session handle
7. **Add transcription** — Enable `inputAudioTranscription` and `outputAudioTranscription` for conversation logs
8. **Token endpoint** — Add `/api/gemini/token` endpoint with locked config
9. **Affective dialog** — Enable `enableAffectiveDialog: true` for more empathetic voice quality
10. **Proactivity** — Enable `proactiveAudio: true` so model can choose not to respond to background noise
