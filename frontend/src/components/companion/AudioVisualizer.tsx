'use client';

import { Mic, Volume2 } from 'lucide-react';
import type { CompanionStatus } from '@/lib/gemini-live';

interface AudioVisualizerProps {
  status: CompanionStatus;
}

/**
 * Pulsing circle representing OLAF's voice companion.
 *
 * - Outer ring: animate-voice-pulse (breathing scale 1 → 1.08)
 * - Inner circle: primary-700, shows Mic when listening, Volume2 when speaking
 * - Respects prefers-reduced-motion
 *
 * Follows specs from docs/design-system/components.md
 */
export function AudioVisualizer({ status }: AudioVisualizerProps) {
  const isActive = status === 'listening' || status === 'thinking' || status === 'speaking';
  const isSpeaking = status === 'speaking';

  const Icon = isSpeaking ? Volume2 : Mic;

  const stateLabel =
    status === 'listening'
      ? 'listening'
      : status === 'thinking'
        ? 'thinking'
        : status === 'speaking'
          ? 'speaking'
          : status === 'connecting'
            ? 'connecting'
            : status === 'error'
              ? 'error'
              : 'idle';

  return (
    <div
      role="img"
      aria-label={`OLAF voice companion - ${stateLabel}`}
      className="relative flex items-center justify-center w-48 h-48 md:w-56 md:h-56"
    >
      {/* Outer pulsing ring — only animates when session is active */}
      <div
        className={[
          'absolute inset-0 rounded-full bg-primary-200',
          isActive
            ? 'animate-voice-pulse motion-reduce:animate-none'
            : '',
        ].join(' ')}
      />

      {/* Inner stable circle */}
      <div
        className={[
          'relative w-32 h-32 md:w-40 md:h-40 rounded-full',
          'bg-primary-700 text-white',
          'flex flex-col items-center justify-center gap-2',
          'shadow-lg',
          'transition-colors duration-200',
        ].join(' ')}
      >
        <Icon className="w-8 h-8" aria-hidden="true" />
        <span className="text-body-sm font-medium select-none">OLAF</span>
      </div>
    </div>
  );
}
