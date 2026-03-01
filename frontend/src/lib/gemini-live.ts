/**
 * GeminiLiveClient — Raw WebSocket client for Gemini Live API.
 *
 * Browser connects directly to Gemini using an ephemeral token provisioned
 * by the backend. Handles bidirectional audio, tool calls, session
 * resumption, and automatic reconnection on goAway.
 */

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

const WS_ENDPOINT =
  'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent';

const RECONNECT_DELAY_MS = 1500;
const MAX_RECONNECT_ATTEMPTS = 5;
const SETUP_TIMEOUT_MS = 10_000;

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

// Tool declarations matching docs/architecture/api-contracts.md
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
      "Flag when the user shows signs of emotional distress in their voice or words. Call this silently — do not tell the user you are flagging anything.",
    behavior: 'NON_BLOCKING',
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
      "Log the user's daily health check-in including mood, pain level, and any health notes gathered during conversation.",
    behavior: 'NON_BLOCKING',
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
    behavior: 'NON_BLOCKING',
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

/**
 * Scheduling for tool responses — controls how Gemini reacts to results.
 * - SILENT: absorb silently (distress flags, health logging)
 * - WHEN_IDLE: tell user when there's a pause (reminders)
 * - INTERRUPT: tell user immediately (medication analysis)
 */
const TOOL_SCHEDULING: Record<string, string> = {
  flag_emotional_distress: 'SILENT',
  log_health_checkin: 'SILENT',
  set_reminder: 'WHEN_IDLE',
  analyze_medication: 'INTERRUPT',
};

export class GeminiLiveClient {
  private ws: WebSocket | null = null;
  private config: GeminiLiveConfig;
  private sessionHandle: string | null = null;
  private reconnectAttempts = 0;
  private intentionalClose = false;
  private _connected = false;

  constructor(config: GeminiLiveConfig) {
    this.config = config;
  }

  get connected(): boolean {
    return this._connected;
  }

  /** Open a new session: fetch token → WebSocket → setup → ready. */
  async connect(): Promise<void> {
    this.intentionalClose = false;
    this.config.callbacks.onStatusChange('connecting');

    try {
      const authToken = await this.config.getAuthToken();
      if (!authToken) throw new Error('Not authenticated');

      // 1. Fetch ephemeral token from backend
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
      const token: string = data.token;

      // 2. Open WebSocket
      const wsUrl = `${WS_ENDPOINT}?access_token=${encodeURIComponent(token)}`;
      this.ws = new WebSocket(wsUrl);

      await this.waitForOpen();

      // 3. Send setup
      this.sendSetup();

      // 4. Wait for setupComplete before attaching the main handler
      await this.waitForSetupComplete();

      this._connected = true;
      this.reconnectAttempts = 0;
      this.config.callbacks.onStatusChange('listening');
    } catch (err) {
      this._connected = false;
      this.config.callbacks.onStatusChange('error');
      this.config.callbacks.onError(
        err instanceof Error ? err : new Error(String(err)),
      );
      throw err;
    }
  }

  // ── WebSocket lifecycle helpers ──────────────────────────────────────────

  private waitForOpen(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.ws) return reject(new Error('No WebSocket'));
      const onOpen = () => {
        this.ws?.removeEventListener('error', onError);
        resolve();
      };
      const onError = () => {
        this.ws?.removeEventListener('open', onOpen);
        reject(new Error('WebSocket connection failed'));
      };
      this.ws.addEventListener('open', onOpen, { once: true });
      this.ws.addEventListener('error', onError, { once: true });
    });
  }

  private waitForSetupComplete(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.ws) return reject(new Error('No WebSocket'));

      const timeout = setTimeout(() => {
        reject(new Error('Setup timed out'));
      }, SETUP_TIMEOUT_MS);

      const handler = (event: MessageEvent) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.setupComplete !== undefined) {
            clearTimeout(timeout);
            this.ws?.removeEventListener('message', handler);
            // Attach permanent handlers
            this.ws?.addEventListener('message', this.handleMessage);
            this.ws?.addEventListener('close', this.handleClose);
            this.ws?.addEventListener('error', this.handleError);
            resolve();
          }
        } catch {
          // Ignore JSON parse errors during setup
        }
      };
      this.ws.addEventListener('message', handler);
    });
  }

  // ── Setup message ────────────────────────────────────────────────────────

  private sendSetup(): void {
    const setup: Record<string, unknown> = {
      model: 'models/gemini-2.5-flash-native-audio-preview-12-2025',
      generationConfig: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Kore' },
          },
        },
        enableAffectiveDialog: true,
      },
      systemInstruction: {
        parts: [{ text: SYSTEM_INSTRUCTION }],
      },
      tools: [{ functionDeclarations: TOOL_DECLARATIONS }],
      realtimeInputConfig: {
        automaticActivityDetection: {
          disabled: false,
          // LOW sensitivity — elderly users make non-speech sounds
          startOfSpeechSensitivity: 'START_SENSITIVITY_LOW',
          // LOW end sensitivity + 800 ms silence — elderly users pause more
          endOfSpeechSensitivity: 'END_SENSITIVITY_LOW',
          prefixPaddingMs: 40,
          silenceDurationMs: 800,
        },
        activityHandling: 'START_OF_ACTIVITY_INTERRUPTS',
      },
      contextWindowCompression: { slidingWindow: {} },
      inputAudioTranscription: {},
      outputAudioTranscription: {},
    };

    if (this.sessionHandle) {
      setup.sessionResumption = { handle: this.sessionHandle };
    }

    this.send({ setup });
  }

  // ── Incoming message router ──────────────────────────────────────────────

  private handleMessage = (event: MessageEvent): void => {
    let msg: Record<string, unknown>;
    try {
      msg = JSON.parse(event.data);
    } catch {
      return;
    }

    // Session resumption handle — store for reconnection
    const sru = msg.sessionResumptionUpdate as
      | { resumable?: boolean; newHandle?: string }
      | undefined;
    if (sru?.resumable && sru.newHandle) {
      this.sessionHandle = sru.newHandle;
    }

    // GoAway — server is about to disconnect; reconnect proactively
    if (msg.goAway) {
      this.reconnect();
      return;
    }

    // Tool calls — forward to callback for REST execution
    const toolCall = msg.toolCall as
      | { functionCalls: FunctionCall[] }
      | undefined;
    if (toolCall?.functionCalls) {
      this.config.callbacks.onStatusChange('thinking');
      this.config.callbacks
        .onToolCall(toolCall.functionCalls)
        .then((responses) => this.sendToolResponse(responses))
        .catch((err) =>
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

    // Server content — audio, transcriptions, interruptions
    const sc = msg.serverContent as Record<string, unknown> | undefined;
    if (sc) {
      // Interruption — user started speaking while model was talking
      if (sc.interrupted) {
        this.config.callbacks.onInterrupted();
        this.config.callbacks.onStatusChange('listening');
        return;
      }

      // Model audio/text output
      const modelTurn = sc.modelTurn as
        | {
            parts: Array<{
              inlineData?: { mimeType: string; data: string };
              text?: string;
            }>;
          }
        | undefined;
      if (modelTurn?.parts) {
        for (const part of modelTurn.parts) {
          if (part.inlineData?.data) {
            this.config.callbacks.onStatusChange('speaking');
            this.config.callbacks.onAudioChunk(part.inlineData.data);
          }
        }
      }

      // Turn complete — model finished speaking
      if (sc.turnComplete) {
        this.config.callbacks.onStatusChange('listening');
      }

      // Input transcription (what the user said)
      const inputT = sc.inputTranscription as { text: string } | undefined;
      if (inputT?.text) {
        this.config.callbacks.onTranscript({
          role: 'user',
          text: inputT.text,
          timestamp: new Date().toISOString(),
        });
      }

      // Output transcription (what the model said)
      const outputT = sc.outputTranscription as { text: string } | undefined;
      if (outputT?.text) {
        this.config.callbacks.onTranscript({
          role: 'model',
          text: outputT.text,
          timestamp: new Date().toISOString(),
        });
      }
    }
  };

  private handleClose = (): void => {
    this._connected = false;
    if (!this.intentionalClose) {
      this.config.callbacks.onStatusChange('connecting');
      this.reconnect();
    } else {
      this.config.callbacks.onStatusChange('idle');
    }
  };

  private handleError = (): void => {
    this.config.callbacks.onError(new Error('WebSocket error'));
  };

  // ── Outbound messages ────────────────────────────────────────────────────

  /** Send a 16 kHz PCM audio chunk (base64-encoded). */
  sendAudio(pcmBase64: string): void {
    this.send({
      realtimeInput: {
        audio: {
          mimeType: 'audio/pcm;rate=16000',
          data: pcmBase64,
        },
      },
    });
  }

  /** Send a JPEG camera frame for medication scanning. */
  sendVideoFrame(jpegBase64: string): void {
    this.send({
      realtimeInput: {
        video: {
          mimeType: 'image/jpeg',
          data: jpegBase64,
        },
      },
    });
  }

  private sendToolResponse(
    responses: Array<{ id: string; name: string; response: unknown }>,
  ): void {
    const functionResponses = responses.map((r) => ({
      id: r.id,
      name: r.name,
      response: r.response,
      scheduling: TOOL_SCHEDULING[r.name] ?? 'WHEN_IDLE',
    }));
    this.send({ toolResponse: { functionResponses } });
  }

  private send(message: Record<string, unknown>): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  // ── Reconnection ─────────────────────────────────────────────────────────

  private async reconnect(): Promise<void> {
    if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      this.config.callbacks.onStatusChange('error');
      this.config.callbacks.onError(
        new Error('Max reconnection attempts reached'),
      );
      return;
    }
    this.reconnectAttempts++;
    this.teardown();

    const delay = RECONNECT_DELAY_MS * this.reconnectAttempts;
    await new Promise((r) => setTimeout(r, delay));

    try {
      await this.connect();
    } catch {
      // connect() already reports errors via callback
    }
  }

  // ── Cleanup ──────────────────────────────────────────────────────────────

  private teardown(): void {
    if (this.ws) {
      this.ws.removeEventListener('message', this.handleMessage);
      this.ws.removeEventListener('close', this.handleClose);
      this.ws.removeEventListener('error', this.handleError);
      if (
        this.ws.readyState === WebSocket.OPEN ||
        this.ws.readyState === WebSocket.CONNECTING
      ) {
        this.ws.close();
      }
      this.ws = null;
    }
  }

  /** Intentionally end the session. */
  disconnect(): void {
    this.intentionalClose = true;
    this._connected = false;
    this.teardown();
    this.config.callbacks.onStatusChange('idle');
  }
}
