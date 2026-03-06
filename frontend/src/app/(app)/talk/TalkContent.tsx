'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Mic, MicOff, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import {
  AdkLiveClient,
  type CompanionStatus,
  type TranscriptEntry,
} from '@/lib/adk-live';
import { AudioManager } from '@/lib/audio-manager';
import { AudioVisualizer } from '@/components/companion/AudioVisualizer';
import { StatusIndicator } from '@/components/companion/StatusIndicator';
import { CameraToggle } from '@/components/companion/CameraToggle';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080';

/**
 * TalkContent — Client component for the full voice companion UI.
 *
 * Wires together AdkLiveClient (ADK bidi-streaming WebSocket),
 * AudioManager (mic/playback) into a single interactive page.
 * Tool calls now execute server-side — no REST bridge needed.
 */
export function TalkContent() {
  const { user, getToken } = useAuth();

  // ── State ────────────────────────────────────────────────────────────────
  const [status, setStatus] = useState<CompanionStatus>('idle');
  const [lastModelMessage, setLastModelMessage] = useState(
    'Tap the microphone to start talking with OLAF',
  );
  const [sessionActive, setSessionActive] = useState(false);
  const [transcripts, setTranscripts] = useState<TranscriptEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  // ── Refs (persist across renders without triggering them) ────────────────
  const clientRef = useRef<AdkLiveClient | null>(null);
  const audioRef = useRef<AudioManager | null>(null);
  const transcriptsRef = useRef<TranscriptEntry[]>([]);
  const sessionStartRef = useRef<number>(0);

  // Keep transcriptsRef in sync with state
  useEffect(() => {
    transcriptsRef.current = transcripts;
  }, [transcripts]);

  // ── Cleanup on unmount ───────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      clientRef.current?.disconnect();
      audioRef.current?.stop();
    };
  }, []);

  // ── Start voice session ──────────────────────────────────────────────────
  const startSession = useCallback(async () => {
    if (!user) return;
    setError(null);

    try {
      // Create AudioManager and start mic capture
      const audio = new AudioManager();
      audioRef.current = audio;

      // Create AdkLiveClient — connects to ADK bidi-streaming backend
      const client = new AdkLiveClient({
        apiBaseUrl: API_BASE_URL,
        getAuthToken: getToken,
        userId: user.uid,
        callbacks: {
          onStatusChange: (s) => setStatus(s),
          onAudioChunk: (base64) => audio.queuePlayback(base64),
          onTranscript: (entry) => {
            setTranscripts((prev) => [...prev, entry]);
            if (entry.role === 'model' && entry.text.trim()) {
              setLastModelMessage(entry.text);
            }
          },
          onToolCall: (name, _args) => {
            // Tools now execute server-side — just show activity in UI
            console.log('[OLAF] tool executing server-side:', name);
          },
          onInterrupted: () => {
            audio.clearPlaybackQueue();
          },
          onError: (err) => {
            console.error('[OLAF]', err);
            setError(err.message);
          },
        },
      });
      clientRef.current = client;

      // Start mic capture — audio chunks flow to AdkLiveClient
      await audio.start(
        (base64) => client.sendAudio(base64),
        (_speaking) => {
          // Playback state is already tracked via onStatusChange
        },
      );

      // Connect to ADK bidi-streaming backend
      await client.connect();

      sessionStartRef.current = Date.now();
      setSessionActive(true);
      setLastModelMessage('Hi there! How are you feeling today?');
    } catch (err) {
      console.error('[OLAF] Session start failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to start session');
      // Clean up partial state
      audioRef.current?.stop();
      audioRef.current = null;
      clientRef.current = null;
      setSessionActive(false);
    }
  }, [user, getToken]);

  // ── Stop voice session ───────────────────────────────────────────────────
  const stopSession = useCallback(async () => {
    // Disconnect ADK stream (sends {"type":"end"} to backend)
    clientRef.current?.disconnect();
    clientRef.current = null;

    // Stop audio
    await audioRef.current?.stop();
    audioRef.current = null;

    // Log the conversation to backend
    const duration = Math.round((Date.now() - sessionStartRef.current) / 1000);
    const currentTranscripts = transcriptsRef.current;

    if (user && currentTranscripts.length > 0) {
      try {
        const authToken = await getToken();
        const headers = {
          'Content-Type': 'application/json',
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        };

        // Log the conversation
        await fetch(`${API_BASE_URL}/api/companion/log-conversation`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            userId: user.uid,
            sessionDuration: duration,
            transcript: currentTranscripts,
            flags: [],
          }),
        });

        // Trigger memory creation from the conversation transcript
        const transcriptText = currentTranscripts
          .map((e) => `${e.role === 'user' ? 'User' : 'OLAF'}: ${e.text}`)
          .join('\n');

        fetch(`${API_BASE_URL}/api/storyteller/create-memory`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            userId: user.uid,
            transcript: transcriptText,
          }),
        }).catch((err) => console.error('[OLAF] Failed to create memory:', err));
      } catch (err) {
        console.error('[OLAF] Failed to log conversation:', err);
      }
    }

    setSessionActive(false);
    setStatus('idle');
    setLastModelMessage('Tap the microphone to start talking with OLAF');
    setTranscripts([]);
  }, [user, getToken]);

  // ── Toggle session ───────────────────────────────────────────────────────
  const toggleSession = useCallback(() => {
    if (sessionActive) {
      stopSession();
    } else {
      startSession();
    }
  }, [sessionActive, startSession, stopSession]);

  // ── Camera frame handler ─────────────────────────────────────────────────
  const handleCameraFrame = useCallback((jpegBase64: string) => {
    clientRef.current?.sendVideoFrame(jpegBase64);
  }, []);

  // ── Mic button state ─────────────────────────────────────────────────────
  const isConnecting = status === 'connecting';
  const micLabel = sessionActive
    ? 'End conversation'
    : 'Start talking with OLAF';

  return (
    <div className="flex flex-col items-center justify-center text-center w-full">
      {/* OLAF's last spoken message — visible for hearing-impaired users */}
      <p
        className="text-body-lg text-text-primary font-medium mb-6 max-w-md px-4 leading-relaxed"
        aria-live="polite"
      >
        {lastModelMessage}
      </p>

      {/* Voice visualizer — pulsing circle */}
      <div className="mb-4">
        <AudioVisualizer status={status} />
      </div>

      {/* Status indicator */}
      <div className="mb-8">
        <StatusIndicator status={status} />
      </div>

      {/* Error message */}
      {error && (
        <div
          role="alert"
          className="mb-6 px-4 py-3 rounded-xl bg-error-50 border border-error-600 text-error-700 text-body-sm max-w-sm"
        >
          {error}
        </div>
      )}

      {/* Control buttons — Mic + Camera */}
      <div className="flex items-center gap-4">
        {/* Primary mic button — 64px, always visible */}
        <button
          type="button"
          onClick={toggleSession}
          disabled={isConnecting || !user}
          aria-label={micLabel}
          className={[
            'relative inline-flex items-center justify-center',
            'w-16 h-16 rounded-full',
            'font-semibold text-white shadow-md',
            'transition-colors duration-150',
            'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary-300',
            sessionActive
              ? 'bg-error-700 hover:bg-red-800 active:bg-red-900'
              : 'bg-primary-700 hover:bg-primary-800 active:bg-primary-900',
            isConnecting || !user
              ? 'opacity-70 cursor-wait'
              : 'cursor-pointer',
          ].join(' ')}
        >
          {isConnecting ? (
            <Loader2
              className="w-7 h-7 animate-spin motion-reduce:animate-none"
              aria-hidden="true"
            />
          ) : sessionActive ? (
            <MicOff className="w-7 h-7" aria-hidden="true" />
          ) : (
            <Mic className="w-7 h-7" aria-hidden="true" />
          )}
        </button>

        {/* Camera toggle */}
        <CameraToggle
          sessionActive={sessionActive}
          onFrame={handleCameraFrame}
          disabled={isConnecting}
        />
      </div>

      {/* Mic button label below for clarity */}
      <p className="text-caption text-text-muted mt-3 select-none">
        {sessionActive ? 'Tap to end' : 'Tap to talk'}
      </p>
    </div>
  );
}
