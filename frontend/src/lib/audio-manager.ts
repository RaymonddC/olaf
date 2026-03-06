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

export class AudioManager {
  // Capture
  private inputContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private workletNode: AudioWorkletNode | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private workletUrl: string | null = null;

  // Playback
  private outputContext: AudioContext | null = null;
  private playbackQueue: Float32Array[] = [];
  private isPlaying = false;
  private currentSource: AudioBufferSourceNode | null = null;
  private _isSpeaking = false;

  // Callbacks
  private onAudioChunk: ((base64: string) => void) | null = null;
  private onPlaybackStateChange: ((speaking: boolean) => void) | null = null;

  // State
  private _muted = false;
  private _started = false;

  get muted(): boolean {
    return this._muted;
  }

  get started(): boolean {
    return this._started;
  }

  get isSpeaking(): boolean {
    return this._isSpeaking;
  }

  /**
   * Start microphone capture and prepare playback context.
   *
   * @param onAudioChunk - Called with base64-encoded 16 kHz PCM chunks
   * @param onPlaybackStateChange - Called when OLAF starts/stops speaking
   */
  async start(
    onAudioChunk: (base64: string) => void,
    onPlaybackStateChange?: (speaking: boolean) => void,
  ): Promise<void> {
    if (this._started) return;

    this.onAudioChunk = onAudioChunk;
    this.onPlaybackStateChange = onPlaybackStateChange ?? null;

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
    this.sourceNode = this.inputContext.createMediaStreamSource(
      this.mediaStream,
    );
    this.workletNode = new AudioWorkletNode(this.inputContext, 'pcm-capture');
    this.workletNode.port.onmessage = (event: MessageEvent) => {
      if (this._muted) return;
      const pcmBuffer = event.data as ArrayBuffer;
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
   * Queue a base64-encoded 24 kHz PCM chunk from Gemini for playback.
   * Chunks are played sequentially for gapless audio.
   */
  queuePlayback(pcmBase64: string): void {
    const int16 = base64ToInt16Array(pcmBase64);
    const float32 = new Float32Array(int16.length);
    for (let i = 0; i < int16.length; i++) {
      float32[i] = int16[i] / 32768;
    }
    this.playbackQueue.push(float32);

    if (!this.isPlaying) {
      this.setSpeaking(true);
      this.playNext();
    }
  }

  /** Clear the playback queue (called on interruption). */
  clearPlaybackQueue(): void {
    this.playbackQueue = [];
    if (this.currentSource) {
      try {
        this.currentSource.onended = null;
        this.currentSource.stop();
        this.currentSource.disconnect();
      } catch {
        // Already stopped
      }
      this.currentSource = null;
    }
    this.isPlaying = false;
    this.setSpeaking(false);
  }

  /** Stop capture, release microphone, and clean up audio contexts. */
  async stop(): Promise<void> {
    this._started = false;
    this.clearPlaybackQueue();

    // Disconnect capture graph
    if (this.workletNode) {
      this.workletNode.port.onmessage = null;
      this.workletNode.disconnect();
      this.workletNode = null;
    }
    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }

    // Release microphone
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((t) => t.stop());
      this.mediaStream = null;
    }

    // Close audio contexts
    if (this.inputContext?.state !== 'closed') {
      await this.inputContext?.close().catch(() => {});
    }
    this.inputContext = null;

    if (this.outputContext?.state !== 'closed') {
      await this.outputContext?.close().catch(() => {});
    }
    this.outputContext = null;

    // Revoke Blob URL
    if (this.workletUrl) {
      URL.revokeObjectURL(this.workletUrl);
      this.workletUrl = null;
    }
  }

  // ── Private playback helpers ─────────────────────────────────────────────

  private playNext(): void {
    if (this.playbackQueue.length === 0) {
      this.isPlaying = false;
      this.setSpeaking(false);
      return;
    }
    if (!this.outputContext) return;

    this.isPlaying = true;
    const samples = this.playbackQueue.shift()!;

    const buffer = this.outputContext.createBuffer(1, samples.length, 24000);
    buffer.getChannelData(0).set(samples);

    const source = this.outputContext.createBufferSource();
    source.buffer = buffer;
    source.connect(this.outputContext.destination);
    source.onended = () => this.playNext();
    source.start();

    this.currentSource = source;
  }

  private setSpeaking(speaking: boolean): void {
    if (this._isSpeaking !== speaking) {
      this._isSpeaking = speaking;
      this.onPlaybackStateChange?.(speaking);
    }
  }
}
