'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { ConfirmationPrompt } from './ConfirmationPrompt';
import { ScreenshotViewer } from './ScreenshotViewer';
import { getAuthToken } from '@/lib/firebase';

// ── Types matching api-contracts.md Section 8 ───────────────────────────────

type SessionState = 'navigating' | 'waiting_confirmation' | 'completed' | 'error';

interface ScreenshotData {
  imageBase64: string;
  pageUrl: string;
  pageTitle: string;
  timestamp: string;
}

interface NarrationData {
  message: string;
  timestamp: string;
}

interface ConfirmationData {
  actionId: string;
  actionDescription: string;
  actionType: 'form_submit' | 'login' | 'payment' | 'download';
  timestamp: string;
}

interface StatusData {
  state: SessionState;
  message: string;
}

type ServerMessage =
  | { type: 'screenshot'; data: ScreenshotData }
  | { type: 'narration'; data: NarrationData }
  | { type: 'confirmation_required'; data: ConfirmationData }
  | { type: 'status'; data: StatusData };

// ── Props ───────────────────────────────────────────────────────────────────

interface NavigatorSessionProps {
  /** Active session ID */
  sessionId: string;
  /** WebSocket URL path (e.g. /api/navigator/stream/{sessionId}) */
  websocketUrl: string;
  /** Task description for display */
  task: string;
  /** Estimated total steps (from template) */
  totalSteps?: number;
  /** Called when session ends (by user cancel or completion) */
  onClose: () => void;
}

// ── Component ───────────────────────────────────────────────────────────────

export function NavigatorSession({
  sessionId,
  websocketUrl,
  task,
  totalSteps = 0,
  onClose,
}: NavigatorSessionProps) {
  const wsRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [sessionState, setSessionState] = useState<SessionState>('navigating');
  const [statusMessage, setStatusMessage] = useState('Connecting…');

  // Screenshot state
  const [screenshot, setScreenshot] = useState<ScreenshotData | null>(null);
  const [narration, setNarration] = useState('');
  const [stepCount, setStepCount] = useState(0);

  // Confirmation state
  const [confirmation, setConfirmation] = useState<ConfirmationData | null>(null);

  // ── WebSocket connection ────────────────────────────────────────────────

  useEffect(() => {
    let ws: WebSocket | null = null;
    let cancelled = false;

    async function connect() {
      const token = await getAuthToken();
      if (cancelled || !token) return;

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = process.env.NEXT_PUBLIC_API_URL
        ? new URL(process.env.NEXT_PUBLIC_API_URL).host
        : window.location.host;
      const url = `${protocol}//${host}${websocketUrl}?token=${encodeURIComponent(token)}`;

      ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        if (cancelled) return;
        setConnected(true);
        setStatusMessage('Connected — starting navigation');
      };

      ws.onmessage = (event) => {
        if (cancelled) return;
        try {
          const msg: ServerMessage = JSON.parse(event.data);

          switch (msg.type) {
            case 'screenshot':
              setScreenshot(msg.data);
              setStepCount((prev) => prev + 1);
              break;

            case 'narration':
              setNarration(msg.data.message);
              break;

            case 'confirmation_required':
              setConfirmation(msg.data);
              setSessionState('waiting_confirmation');
              break;

            case 'status':
              setSessionState(msg.data.state);
              setStatusMessage(msg.data.message);
              if (msg.data.state === 'completed' || msg.data.state === 'error') {
                // Auto-close after brief delay so user sees final status
                setTimeout(() => {
                  if (!cancelled) onClose();
                }, 2000);
              }
              break;
          }
        } catch {
          // Ignore malformed messages
        }
      };

      ws.onclose = () => {
        if (cancelled) return;
        setConnected(false);
        setStatusMessage('Disconnected');
      };

      ws.onerror = () => {
        if (cancelled) return;
        setSessionState('error');
        setStatusMessage('Connection error');
      };
    }

    connect();

    return () => {
      cancelled = true;
      if (ws && ws.readyState <= WebSocket.OPEN) {
        ws.close();
      }
      wsRef.current = null;
    };
  }, [sessionId, websocketUrl, onClose]);

  // ── Send messages to server ─────────────────────────────────────────────

  const sendMessage = useCallback((data: unknown) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(data));
    }
  }, []);

  const handleConfirmApprove = useCallback(() => {
    if (!confirmation) return;
    sendMessage({
      type: 'confirmation_response',
      data: { actionId: confirmation.actionId, approved: true },
    });
    setConfirmation(null);
    setSessionState('navigating');
  }, [confirmation, sendMessage]);

  const handleConfirmReject = useCallback(() => {
    if (!confirmation) return;
    sendMessage({
      type: 'confirmation_response',
      data: { actionId: confirmation.actionId, approved: false },
    });
    setConfirmation(null);
    setSessionState('navigating');
  }, [confirmation, sendMessage]);

  const handleCancel = useCallback(() => {
    sendMessage({ type: 'cancel' });
    onClose();
  }, [sendMessage, onClose]);

  // ── Keyboard: Escape to cancel ──────────────────────────────────────────

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && !confirmation) {
        handleCancel();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleCancel, confirmation]);

  // ── Progress calculation ────────────────────────────────────────────────

  const progress = totalSteps > 0
    ? Math.min(Math.round((stepCount / totalSteps) * 100), 100)
    : 0;

  // ── Status bar color ────────────────────────────────────────────────────

  const statusColor: Record<SessionState, string> = {
    navigating: 'bg-primary-700',
    waiting_confirmation: 'bg-warning-700',
    completed: 'bg-success-700',
    error: 'bg-error-700',
  };

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div
      className="fixed inset-0 z-50 bg-bg-page flex flex-col"
      role="dialog"
      aria-modal="true"
      aria-label={`Navigation session: ${task}`}
    >
      {/* Top bar */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-border bg-bg-surface">
        <div className="flex items-center gap-3 min-w-0">
          {/* Status indicator dot */}
          <span
            className={`w-3 h-3 rounded-full flex-shrink-0 ${statusColor[sessionState]}`}
            aria-hidden="true"
          />
          <div className="min-w-0">
            <p className="text-body font-semibold text-text-heading truncate">
              {task}
            </p>
            <p className="text-caption text-text-secondary" aria-live="polite">
              {statusMessage}
            </p>
          </div>
        </div>

        <Button
          variant="ghost"
          size="lg"
          onClick={handleCancel}
          aria-label="Cancel navigation"
          className="flex-shrink-0"
        >
          <X className="w-6 h-6" aria-hidden="true" />
          <span className="sr-only md:not-sr-only md:ml-1">Cancel</span>
        </Button>
      </header>

      {/* Main content area */}
      <div className="flex-1 overflow-auto p-4 md:p-6 flex flex-col items-center justify-center gap-6">
        {/* Screenshot viewer */}
        <div className="w-full max-w-4xl">
          <ScreenshotViewer
            screenshotBase64={screenshot?.imageBase64 ?? ''}
            pageUrl={screenshot?.pageUrl}
            pageTitle={screenshot?.pageTitle}
            narration={narration}
            progress={progress}
            currentStep={stepCount}
            totalSteps={totalSteps}
          />
        </div>

        {/* Confirmation prompt (overlaid when waiting) */}
        {confirmation && (
          <div className="flex items-center justify-center">
            <ConfirmationPrompt
              actionDescription={confirmation.actionDescription}
              actionType={confirmation.actionType}
              onApprove={handleConfirmApprove}
              onReject={handleConfirmReject}
            />
          </div>
        )}

        {/* Connection status when not yet connected */}
        {!connected && sessionState !== 'completed' && sessionState !== 'error' && (
          <div className="text-center">
            <div className="w-8 h-8 border-4 border-primary-300 border-t-primary-700 rounded-full animate-spin mx-auto mb-3" />
            <p className="text-body text-text-secondary">
              Connecting to navigation session…
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
