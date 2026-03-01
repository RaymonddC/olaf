'use client';

import type { CompanionStatus } from '@/lib/gemini-live';

interface StatusIndicatorProps {
  status: CompanionStatus;
}

const STATUS_CONFIG: Record<
  CompanionStatus,
  { dotClass: string; label: string; animate: boolean }
> = {
  listening: {
    dotClass: 'bg-success-600',
    label: 'Listening...',
    animate: true,
  },
  thinking: {
    dotClass: 'bg-warning-600',
    label: 'Thinking...',
    animate: true,
  },
  speaking: {
    dotClass: 'bg-primary-600',
    label: 'Speaking...',
    animate: true,
  },
  idle: {
    dotClass: 'bg-bg-muted',
    label: 'Ready',
    animate: false,
  },
  connecting: {
    dotClass: 'bg-warning-600',
    label: 'Connecting...',
    animate: true,
  },
  error: {
    dotClass: 'bg-error-600',
    label: 'Connection lost',
    animate: false,
  },
};

/**
 * Visual indicator for the voice companion state.
 *
 * Shows a colored dot (optionally pulsing) and a text label.
 * Uses aria-live="polite" so screen readers announce state changes.
 *
 * Follows specs from docs/design-system/components.md
 */
export function StatusIndicator({ status }: StatusIndicatorProps) {
  const config = STATUS_CONFIG[status];

  return (
    <div aria-live="polite" className="flex items-center gap-2">
      <span
        aria-hidden="true"
        className={[
          'w-3 h-3 rounded-full',
          config.dotClass,
          config.animate
            ? 'animate-status-pulse motion-reduce:animate-none'
            : '',
        ].join(' ')}
      />
      <span className="text-body-sm text-text-secondary">{config.label}</span>
    </div>
  );
}
