/**
 * AdkLiveClient — connects to the ADK bidi-streaming backend WebSocket.
 *
 * Replaces the browser-direct Gemini Live API connection.
 * All tool calls now execute server-side inside the ADK runner.
 *
 * WebSocket: WSS /api/companion/stream?token=<firebase_id_token>
 *
 * Messages sent → backend:
 *   {"type": "audio", "data": "<base64 PCM 16kHz>"}
 *   {"type": "video", "data": "<base64 JPEG>"}
 *   {"type": "end"}
 *
 * Messages received ← backend:
 *   {"type": "audio",         "data": "<base64 PCM>"}
 *   {"type": "transcript",    "role": "user"|"model", "text": "..."}
 *   {"type": "tool_call",     "name": "...", "args": {...}}
 *   {"type": "turn_complete"}
 *   {"type": "interrupted"}
 *   {"type": "error",         "message": "..."}
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
  partial?: boolean;
}

export interface AdkLiveCallbacks {
  onStatusChange: (status: CompanionStatus) => void;
  onAudioChunk: (pcmBase64: string) => void;
  onTranscript: (entry: TranscriptEntry) => void;
  onToolCall: (name: string, args: Record<string, unknown>) => void;
  onInterrupted: () => void;
  onTurnComplete?: () => void;
  onReady?: () => void;
  onError: (error: Error) => void;
}

export interface AdkLiveConfig {
  /** Backend base URL, e.g. http://localhost:8080 */
  apiBaseUrl: string;
  /** Returns a Firebase ID token for auth */
  getAuthToken: () => Promise<string | null>;
  userId: string;
  callbacks: AdkLiveCallbacks;
}

const RECONNECT_DELAY_MS = 1500;
const MAX_RECONNECT_ATTEMPTS = 5;

export class AdkLiveClient {
  private ws: WebSocket | null = null;
  private config: AdkLiveConfig;
  private reconnectAttempts = 0;
  private intentionalClose = false;
  private _connected = false;

  constructor(config: AdkLiveConfig) {
    this.config = config;
  }

  get connected(): boolean {
    return this._connected;
  }

  // ── Connect ──────────────────────────────────────────────────────────────

  async connect(): Promise<void> {
    this.intentionalClose = false;
    this.config.callbacks.onStatusChange('connecting');

    const authToken = await this.config.getAuthToken();
    if (!authToken) {
      this.config.callbacks.onStatusChange('error');
      throw new Error('Not authenticated');
    }

    // Build WebSocket URL — swap http(s) for ws(s)
    const wsBase = this.config.apiBaseUrl
      .replace(/^https:/, 'wss:')
      .replace(/^http:/, 'ws:');
    const url = `${wsBase}/api/companion/stream?token=${encodeURIComponent(authToken)}`;

    return new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(url);
      this.ws = ws;

      ws.onopen = () => {
        this._connected = true;
        this.reconnectAttempts = 0;
        // Stay at 'connecting' — backend sends 'ready' when OLAF is about to speak
        resolve();
      };

      ws.onmessage = (event: MessageEvent<string>) => {
        try {
          const msg = JSON.parse(event.data) as Record<string, unknown>;
          this.handleMessage(msg);
        } catch {
          // Ignore malformed frames
        }
      };

      ws.onerror = () => {
        const err = new Error('WebSocket connection error');
        if (!this._connected) {
          // Failed during initial connect
          this.config.callbacks.onStatusChange('error');
          reject(err);
        } else {
          this._connected = false;
          this.config.callbacks.onError(err);
        }
      };

      ws.onclose = (event: CloseEvent) => {
        this._connected = false;
        if (this.intentionalClose) {
          this.config.callbacks.onStatusChange('idle');
        } else {
          // Unexpected close — report error instead of reconnecting.
          // Auto-reconnect creates a second backend session while the old
          // AudioManager is still alive, causing double audio playback.
          this.config.callbacks.onStatusChange('error');
          this.config.callbacks.onError(
            new Error('Connection lost. Please tap the button to reconnect.'),
          );
        }
        if (event.code === 4001) {
          reject(new Error(`Auth failed: ${event.reason}`));
        }
      };
    });
  }

  // ── Incoming message handler ─────────────────────────────────────────────

  private handleMessage(msg: Record<string, unknown>): void {
    const type = msg.type as string;

    switch (type) {
      case 'audio':
        this.config.callbacks.onStatusChange('speaking');
        this.config.callbacks.onAudioChunk(msg.data as string);
        break;

      case 'transcript': {
        const role = msg.role as 'user' | 'model';
        const text = msg.text as string;
        const partial = (msg.partial as boolean) ?? false;
        if (text?.trim()) {
          this.config.callbacks.onTranscript({
            role,
            text,
            partial,
            timestamp: new Date().toISOString(),
          });
        }
        break;
      }

      case 'tool_call':
        this.config.callbacks.onStatusChange('thinking');
        this.config.callbacks.onToolCall(
          msg.name as string,
          (msg.args ?? {}) as Record<string, unknown>,
        );
        break;

      case 'turn_complete':
        this.config.callbacks.onStatusChange('listening');
        this.config.callbacks.onTurnComplete?.();
        break;

      case 'interrupted':
        this.config.callbacks.onInterrupted();
        this.config.callbacks.onStatusChange('listening');
        break;

      case 'ready':
        this.config.callbacks.onStatusChange('listening');
        this.config.callbacks.onReady?.();
        break;

      case 'error':
        this.config.callbacks.onError(
          new Error((msg.message as string) ?? 'Unknown backend error'),
        );
        this.config.callbacks.onStatusChange('error');
        break;
    }
  }

  // ── Outbound messages ────────────────────────────────────────────────────

  /** Send a 16 kHz PCM audio chunk (base64-encoded). */
  sendAudio(pcmBase64: string): void {
    this.send({ type: 'audio', data: pcmBase64 });
  }

  /** Send a JPEG camera frame for medication scanning. */
  sendVideoFrame(jpegBase64: string): void {
    this.send({ type: 'video', data: jpegBase64 });
  }

  private send(msg: Record<string, unknown>): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
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

  disconnect(): void {
    this.intentionalClose = true;
    this._connected = false;
    if (this.ws) {
      // Tell backend to clean up session
      this.send({ type: 'end' });
      this.ws.close(1000, 'User ended session');
      this.ws = null;
    }
    this.config.callbacks.onStatusChange('idle');
  }
}
