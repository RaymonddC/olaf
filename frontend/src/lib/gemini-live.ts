/**
 * GeminiLiveClient — Uses @google/genai SDK for Gemini Live API.
 *
 * The SDK handles WebSocket auth, reconnection, and message framing.
 * The API key is fetched from the backend so it never ships in the JS bundle.
 */

import { GoogleGenAI, Modality } from '@google/genai';

export type CompanionStatus =
  | 'idle'
  | 'connecting'
  | 'listening'
  | 'thinking'
  | 'speaking'
  | 'error';

export interface TranscriptEntry {
  role: 'user' | 'model';
  text: string;
  timestamp: string;
}

export interface FunctionCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
}

export interface GeminiLiveCallbacks {
  onStatusChange: (status: CompanionStatus) => void;
  onAudioChunk: (pcmBase64: string) => void;
  onTranscript: (entry: TranscriptEntry) => void;
  onToolCall: (
    calls: FunctionCall[],
  ) => Promise<Array<{ id: string; name: string; response: unknown }>>;
  onToolCallCancellation: (ids: string[]) => void;
  onInterrupted: () => void;
  onError: (error: Error) => void;
}

export interface GeminiLiveConfig {
  tokenEndpoint: string;
  getAuthToken: () => Promise<string | null>;
  userId: string;
  callbacks: GeminiLiveCallbacks;
}

const MODEL = 'models/gemini-2.5-flash-native-audio-preview-12-2025';

const RECONNECT_DELAY_MS = 1500;
const MAX_RECONNECT_ATTEMPTS = 5;

// CARIA system instruction — warm, patient, elderly-focused companion
const SYSTEM_INSTRUCTION = [
  'You are CARIA, a warm, patient, and caring AI companion for elderly users.',
  'Speak clearly and at a moderate pace. Use simple, everyday language.',
  "Be attentive to the user's emotional state and respond with empathy.",
  'You help with daily health check-ins, medication reminders, setting reminders, and general companionship.',
  'If the user shows signs of distress, sadness, or confusion, silently flag it using the flag_emotional_distress tool without telling the user.',
  'When the user mentions taking medication or shows you a medication bottle via camera, use the analyze_medication tool.',
  'During conversations, naturally gather mood and health information and log it using log_health_checkin.',
  'When asked to set reminders, use the set_reminder tool.',
  'Always be encouraging, patient, and positive. End conversations warmly.',
  'If the user is quiet for a while, gently check in on them.',
].join(' ');

const TOOL_DECLARATIONS = [
  {
    name: 'analyze_medication',
    description:
      'Analyse a medication bottle or pill visible in the camera feed, or described verbally by the user.',
    parameters: {
      type: 'object',
      properties: {
        image_description: {
          type: 'string',
          description: 'What is visible on the medication label or pill',
        },
      },
      required: ['image_description'],
    },
  },
  {
    name: 'flag_emotional_distress',
    description:
      'Flag when the user shows signs of emotional distress. Call this silently — do not tell the user.',
    parameters: {
      type: 'object',
      properties: {
        severity: {
          type: 'string',
          enum: ['low', 'medium', 'high'],
          description: 'How severe the distress appears',
        },
        observation: {
          type: 'string',
          description: 'What was observed that indicates distress',
        },
      },
      required: ['severity', 'observation'],
    },
  },
  {
    name: 'log_health_checkin',
    description:
      "Log the user's daily health check-in including mood, pain level, and health notes.",
    parameters: {
      type: 'object',
      properties: {
        mood: {
          type: 'string',
          enum: ['happy', 'okay', 'sad', 'anxious', 'confused', 'tired'],
        },
        pain_level: {
          type: 'integer',
          description: 'Pain level from 0 (none) to 10 (severe)',
        },
        notes: {
          type: 'string',
          description: 'Additional health notes from the conversation',
        },
      },
      required: ['mood', 'pain_level'],
    },
  },
  {
    name: 'set_reminder',
    description: 'Set a reminder for the user at a specific time.',
    parameters: {
      type: 'object',
      properties: {
        reminder_type: {
          type: 'string',
          enum: ['medication', 'appointment', 'hydration', 'custom'],
        },
        message: {
          type: 'string',
          description: 'The reminder message to show',
        },
        time: {
          type: 'string',
          description: 'When to remind (ISO 8601 or HH:MM format)',
        },
      },
      required: ['reminder_type', 'message', 'time'],
    },
  },
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type LiveSession = any;

export class GeminiLiveClient {
  private session: LiveSession = null;
  private config: GeminiLiveConfig;
  private reconnectAttempts = 0;
  private intentionalClose = false;
  private _connected = false;

  constructor(config: GeminiLiveConfig) {
    this.config = config;
  }

  get connected(): boolean {
    return this._connected;
  }

  /** Open a new session: fetch API key → connect via SDK → ready. */
  async connect(): Promise<void> {
    this.intentionalClose = false;
    this.config.callbacks.onStatusChange('connecting');

    try {
      const authToken = await this.config.getAuthToken();
      if (!authToken) throw new Error('Not authenticated');

      // Fetch API key from backend
      const tokenRes = await fetch(this.config.tokenEndpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId: this.config.userId }),
      });
      if (!tokenRes.ok) {
        throw new Error(`Token request failed: ${tokenRes.status}`);
      }
      const { data } = await tokenRes.json();
      const apiKey: string = data.token;

      // Connect via SDK
      const ai = new GoogleGenAI({ apiKey });

      this.session = await ai.live.connect({
        model: MODEL,
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } },
          },
          systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
          tools: [{ functionDeclarations: TOOL_DECLARATIONS }],
        },
        callbacks: {
          onopen: () => {
            console.log('[GeminiLive] session open');
            this._connected = true;
            this.reconnectAttempts = 0;
            this.config.callbacks.onStatusChange('listening');
          },
          onmessage: (msg: Record<string, unknown>) => {
            this.handleSdkMessage(msg);
          },
          onerror: (e: ErrorEvent) => {
            console.error('[GeminiLive] error', e);
            this.config.callbacks.onError(new Error(e.message ?? 'WebSocket error'));
          },
          onclose: (e: CloseEvent) => {
            console.log('[GeminiLive] closed', e.code, e.reason);
            this._connected = false;
            if (!this.intentionalClose) {
              this.config.callbacks.onStatusChange('connecting');
              this.scheduleReconnect();
            } else {
              this.config.callbacks.onStatusChange('idle');
            }
          },
        },
      });
    } catch (err) {
      this._connected = false;
      this.config.callbacks.onStatusChange('error');
      this.config.callbacks.onError(
        err instanceof Error ? err : new Error(String(err)),
      );
      throw err;
    }
  }

  // ── Incoming message handler ─────────────────────────────────────────────

  private handleSdkMessage(msg: Record<string, unknown>): void {
    // Tool calls
    const toolCall = msg.toolCall as
      | { functionCalls: FunctionCall[] }
      | undefined;
    if (toolCall?.functionCalls) {
      this.config.callbacks.onStatusChange('thinking');
      this.config.callbacks
        .onToolCall(toolCall.functionCalls)
        .then((responses) => {
          this.session?.sendToolResponse({
            functionResponses: responses.map((r) => ({
              id: r.id,
              name: r.name,
              response: r.response,
            })),
          });
        })
        .catch((err: unknown) =>
          this.config.callbacks.onError(
            err instanceof Error ? err : new Error(String(err)),
          ),
        );
      return;
    }

    // Tool call cancellation
    const tcc = msg.toolCallCancellation as { ids: string[] } | undefined;
    if (tcc?.ids) {
      this.config.callbacks.onToolCallCancellation(tcc.ids);
      return;
    }

    // Server content
    const sc = msg.serverContent as Record<string, unknown> | undefined;
    if (sc) {
      if (sc.interrupted) {
        this.config.callbacks.onInterrupted();
        this.config.callbacks.onStatusChange('listening');
        return;
      }

      const modelTurn = sc.modelTurn as
        | { parts: Array<{ inlineData?: { mimeType: string; data: string }; text?: string }> }
        | undefined;
      if (modelTurn?.parts) {
        for (const part of modelTurn.parts) {
          if (part.inlineData?.data) {
            this.config.callbacks.onStatusChange('speaking');
            this.config.callbacks.onAudioChunk(part.inlineData.data);
          }
        }
      }

      if (sc.turnComplete) {
        this.config.callbacks.onStatusChange('listening');
      }

      const inputT = sc.inputTranscription as { text: string } | undefined;
      if (inputT?.text) {
        this.config.callbacks.onTranscript({
          role: 'user',
          text: inputT.text,
          timestamp: new Date().toISOString(),
        });
      }

      const outputT = sc.outputTranscription as { text: string } | undefined;
      if (outputT?.text) {
        this.config.callbacks.onTranscript({
          role: 'model',
          text: outputT.text,
          timestamp: new Date().toISOString(),
        });
      }
    }
  }

  // ── Outbound messages ────────────────────────────────────────────────────

  /** Send a 16 kHz PCM audio chunk (base64-encoded). */
  sendAudio(pcmBase64: string): void {
    this.session?.sendRealtimeInput({
      audio: { mimeType: 'audio/pcm;rate=16000', data: pcmBase64 },
    });
  }

  /** Send a JPEG camera frame for medication scanning. */
  sendVideoFrame(jpegBase64: string): void {
    this.session?.sendRealtimeInput({
      video: { mimeType: 'image/jpeg', data: jpegBase64 },
    });
  }

  // ── Reconnection ─────────────────────────────────────────────────────────

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      this.config.callbacks.onStatusChange('error');
      this.config.callbacks.onError(new Error('Max reconnection attempts reached'));
      return;
    }
    this.reconnectAttempts++;
    const delay = RECONNECT_DELAY_MS * this.reconnectAttempts;
    setTimeout(() => {
      if (!this.intentionalClose) {
        this.connect().catch(() => {/* already reported via callback */});
      }
    }, delay);
  }

  // ── Cleanup ──────────────────────────────────────────────────────────────

  /** Intentionally end the session. */
  disconnect(): void {
    this.intentionalClose = true;
    this._connected = false;
    this.session?.close();
    this.session = null;
    this.config.callbacks.onStatusChange('idle');
  }
}
