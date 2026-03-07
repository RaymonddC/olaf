'use client';

import type { CompanionStatus } from '@/lib/adk-live';

interface AudioVisualizerProps {
  status: CompanionStatus;
  size?: 'sm' | 'md' | 'lg';
}

const SIZE_MAP = {
  sm: { outer: 'w-16 h-16', inner: 'w-10 h-10', icon: 'text-xl' },
  md: { outer: 'w-24 h-24', inner: 'w-16 h-16', icon: 'text-3xl' },
  lg: { outer: 'w-32 h-32', inner: 'w-20 h-20', icon: 'text-4xl' },
};

const STATUS_STYLES: Record<CompanionStatus, { gradient: string; ring: string; emoji: string }> = {
  idle: { gradient: 'from-primary-100 to-primary-200', ring: '', emoji: '😊' },
  connecting: { gradient: 'from-warm-100 to-warm-200', ring: 'animate-spin', emoji: '🔄' },
  listening: { gradient: 'from-accent-100 to-accent-200', ring: 'animate-breathe', emoji: '👂' },
  thinking: { gradient: 'from-warm-100 to-primary-200', ring: 'animate-gentle-pulse', emoji: '🤔' },
  speaking: { gradient: 'from-primary-200 to-accent-200', ring: 'animate-gentle-pulse', emoji: '🗣️' },
  error: { gradient: 'from-error-100 to-error-50', ring: '', emoji: '😔' },
};

export function AudioVisualizer({ status, size = 'md' }: AudioVisualizerProps) {
  const sizeConfig = SIZE_MAP[size];
  const styleConfig = STATUS_STYLES[status];

  return (
    <div className="relative flex items-center justify-center" role="status" aria-label={`OLAF is ${status}`}>
      {/* Outer pulse ring */}
      {styleConfig.ring && (
        <div
          className={`absolute ${sizeConfig.outer} rounded-full bg-gradient-to-br ${styleConfig.gradient} opacity-40 ${styleConfig.ring}`}
        />
      )}
      {/* Inner circle */}
      <div
        className={`relative ${sizeConfig.inner} rounded-full bg-gradient-to-br ${styleConfig.gradient} flex items-center justify-center shadow-md`}
      >
        <span className={sizeConfig.icon} role="img" aria-hidden="true">
          {styleConfig.emoji}
        </span>
      </div>
    </div>
  );
}
