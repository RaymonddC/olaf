'use client';

import type { CompanionStatus } from '@/lib/adk-live';

interface StatusIndicatorProps {
  status: CompanionStatus;
}

const STATUS_MAP: Record<CompanionStatus, { text: string; dotColor: string; animate: boolean }> = {
  idle: { text: 'Ready to chat', dotColor: 'bg-text-muted', animate: false },
  connecting: { text: 'Connecting...', dotColor: 'bg-warm-500', animate: true },
  listening: { text: 'Listening...', dotColor: 'bg-accent-500', animate: true },
  thinking: { text: 'Thinking...', dotColor: 'bg-warm-500', animate: true },
  speaking: { text: 'Speaking...', dotColor: 'bg-primary-500', animate: true },
  error: { text: 'Disconnected', dotColor: 'bg-error-600', animate: false },
};

export function StatusIndicator({ status }: StatusIndicatorProps) {
  const config = STATUS_MAP[status];

  return (
    <div className="inline-flex items-center gap-2" role="status" aria-live="polite">
      <span className="relative flex h-3 w-3">
        {config.animate && (
          <span className={`absolute inset-0 rounded-full ${config.dotColor} opacity-60 animate-ping`} />
        )}
        <span className={`relative inline-flex rounded-full h-3 w-3 ${config.dotColor}`} />
      </span>
      <span className="text-body-sm text-text-secondary font-medium">{config.text}</span>
    </div>
  );
}
