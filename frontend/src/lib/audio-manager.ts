/**
 * AudioManager — Microphone capture (16 kHz PCM) and playback (24 kHz PCM).
 *
 * Uses AudioWorklet for capture (inline Blob processor) and a queue-based
 * AudioBufferSourceNode chain for gapless playback.
 */

// ── AudioWorklet processor (runs on audio thread) ──────────────────────────

const WORKLET_CODE = `
class PCMCaptureProcessor extends AudioWorkletProcessor {
  process(inputs) {
    const input = inputs[0];
    if (input && input[0] && input[0].length > 0) {
      const float32 = input[0];
      const int16 = new Int16Array(float32.length);
      for (let i = 0; i < float32.length; i++) {
        const s = Math.max(-1, Math.min(1, float32[i]));
        int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
      }
      this.port.postMessage(int16.buffer, [int16.buffer]);
    }
    return true;
  }
}
registerProcessor('pcm-capture', PCMCaptureProcessor);
`;

// ── Helpers ────────────────────────────────────────────────────────────────

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
    binary += String.fromCharCode.apply(null, Array.from(chunk));
  }
  return btoa(binary);
}

function base64ToInt16Array(base64: string): Int16Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Int16Array(bytes.buffer);
}

// ── AudioManager class ────────────────────────────────────────────────────

// Speech is detected when the peak amplitude in a frame exceeds this value.
// Int16 range is 0–32767. 2000 ≈ ~6% of max — ignores background noise.
const VAD_THRESHOLD = 2000;
// Number of consecutive loud frames before triggering interruption.
const VAD_FRAMES_NEEDED = 4;

export class AudioManager {
  // Capture
  private inputContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private workletNode: AudioWorkletNode | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private workletUrl: string | null = null;

  // Playback
  private outputContext: AudioContext | null = null;
  private nextPlayTime = 0;
  private activeSources: AudioBufferSourceNode[] = [];
  private _isSpeaking = false;
  // When true, incoming audio chunks are dropped (user has interrupted)
  private _playbackBlocked = false;

  // Callbacks
  private onAudioChunk: ((base64: string) => void) | null = null;
  private onPlaybackStateChange: ((speaking: boolean) => void) | null = null;
  private onUserInterrupted: (() => void) | null = null;

  // Client-side VAD state
  private _vadFrameCount = 0;

  // State
  private _muted = false;
  private _started = false;

  get muted(): boolean { return this._muted; }
  get started(): boolean { return this._started; }
  get isSpeaking(): boolean { return this._isSpeaking; }

  /**
   * Start microphone capture and prepare playback context.
   *
   * @param onAudioChunk - Called with base64-encoded 16 kHz PCM chunks
   * @param onPlaybackStateChange - Called when OLAF starts/stops speaking
   * @param onUserInterrupted - Called when client-side VAD detects the user speaking
   */
  async start(
    onAudioChunk: (base64: string) => void,
    onPlaybackStateChange?: (speaking: boolean) => void,
    onUserInterrupted?: () => void,
  ): Promise<void> {
    if (this._started) return;

    this.onAudioChunk = onAudioChunk;
    this.onPlaybackStateChange = onPlaybackStateChange ?? null;
    this.onUserInterrupted = onUserInterrupted ?? null;

    // Request microphone access
    this.mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        sampleRate: 16000,
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });

    // Create capture AudioContext at 16 kHz
    this.inputContext = new AudioContext({ sampleRate: 16000 });

    // Load AudioWorklet from inline Blob
    const blob = new Blob([WORKLET_CODE], { type: 'application/javascript' });
    this.workletUrl = URL.createObjectURL(blob);
    await this.inputContext.audioWorklet.addModule(this.workletUrl);

    // Wire: mic → AudioWorklet → onAudioChunk callback
    this.sourceNode = this.inputContext.createMediaStreamSource(this.mediaStream);
    this.workletNode = new AudioWorkletNode(this.inputContext, 'pcm-capture');
    this.workletNode.port.onmessage = (event: MessageEvent) => {
      if (this._muted) return;
      const pcmBuffer = event.data as ArrayBuffer;

      // ── Client-side VAD: interrupt OLAF the moment the user speaks ───────
      if (this._isSpeaking && !this._playbackBlocked) {
        const samples = new Int16Array(pcmBuffer);
        let peak = 0;
        for (let i = 0; i < samples.length; i++) {
          const abs = samples[i] < 0 ? -samples[i] : samples[i];
          if (abs > peak) peak = abs;
        }
        if (peak > VAD_THRESHOLD) {
          this._vadFrameCount++;
          if (this._vadFrameCount >= VAD_FRAMES_NEEDED) {
            this._vadFrameCount = 0;
            this._playbackBlocked = true;   // drop all incoming audio chunks
            this.clearPlaybackQueue();      // stop whatever is playing now
            this.onUserInterrupted?.();
          }
        } else {
          this._vadFrameCount = 0;
        }
      } else if (!this._isSpeaking) {
        this._vadFrameCount = 0;
      }

      const base64 = arrayBufferToBase64(pcmBuffer);
      this.onAudioChunk?.(base64);
    };
    this.sourceNode.connect(this.workletNode);
    // Connect to destination to keep the graph alive (worklet needs it)
    this.workletNode.connect(this.inputContext.destination);

    // Create playback AudioContext at 24 kHz
    this.outputContext = new AudioContext({ sampleRate: 24000 });

    this._started = true;
  }

  /** Mute the microphone (stop sending audio, but keep capture running). */
  setMuted(muted: boolean): void {
    this._muted = muted;
  }

  /**
   * Unblock playback — call when the server confirms interruption or turn is
   * complete so OLAF's next response can be heard.
   */
  unblockPlayback(): void {
    this._playbackBlocked = false;
    this._vadFrameCount = 0;
  }

  /**
   * Queue a base64-encoded 24 kHz PCM chunk from Gemini for playback.
   * Silently dropped while playback is blocked (user interrupted).
   */
  queuePlayback(pcmBase64: string): void {
    if (!this.outputContext || this._playbackBlocked) return;

    const int16 = base64ToInt16Array(pcmBase64);
    const float32 = new Float32Array(int16.length);
    for (let i = 0; i < int16.length; i++) {
      float32[i] = int16[i] / 32768;
    }

    const ctx = this.outputContext;
    const buffer = ctx.createBuffer(1, float32.length, 24000);
    buffer.getChannelData(0).set(float32);

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);

    // Schedule chunk to play exactly at the end of the previous one
    const now = ctx.currentTime;
    if (this.nextPlayTime < now + 0.02) {
      this.nextPlayTime = now + 0.02;
    }
    source.start(this.nextPlayTime);
    this.nextPlayTime += buffer.duration;

    this.activeSources.push(source);
    if (!this._isSpeaking) this.setSpeaking(true);

    source.onended = () => {
      this.activeSources = this.activeSources.filter(s => s !== source);
      if (this.activeSources.length === 0) this.setSpeaking(false);
    };
  }

  /** Stop all queued and playing audio immediately. */
  clearPlaybackQueue(): void {
    this.nextPlayTime = 0;
    for (const src of this.activeSources) {
      try { src.stop(); } catch { /* already ended */ }
    }
    this.activeSources = [];
    this.setSpeaking(false);
  }

  /** Stop capture, release microphone, and clean up audio contexts. */
  async stop(): Promise<void> {
    this._started = false;
    this._playbackBlocked = false;
    this.clearPlaybackQueue();

    if (this.workletNode) {
      this.workletNode.port.onmessage = null;
      this.workletNode.disconnect();
      this.workletNode = null;
    }
    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((t) => t.stop());
      this.mediaStream = null;
    }
    if (this.inputContext?.state !== 'closed') {
      await this.inputContext?.close().catch(() => {});
    }
    this.inputContext = null;
    if (this.outputContext?.state !== 'closed') {
      await this.outputContext?.close().catch(() => {});
    }
    this.outputContext = null;
    if (this.workletUrl) {
      URL.revokeObjectURL(this.workletUrl);
      this.workletUrl = null;
    }
  }

  // ── Private helpers ──────────────────────────────────────────────────────

  private setSpeaking(speaking: boolean): void {
    if (this._isSpeaking !== speaking) {
      this._isSpeaking = speaking;
      this.onPlaybackStateChange?.(speaking);
    }
  }
}
