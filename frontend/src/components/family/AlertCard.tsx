'use client';

import { Info, AlertTriangle, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import type { Alert } from '@/hooks/useApi';

interface AlertCardProps {
  alert: Alert;
  onAcknowledge: (alertId: string) => void;
  acknowledging?: boolean;
}

const severityConfig = {
  low: {
    container: 'bg-info-50 border-l-4 border-info-600 rounded-xl p-5',
    icon: Info,
    iconColor: 'text-primary-900',
    textColor: 'text-primary-900',
    role: 'status' as const,
  },
  medium: {
    container: 'bg-warning-50 border-l-4 border-warning-600 rounded-xl p-5',
    icon: AlertTriangle,
    iconColor: 'text-warm-700',
    textColor: 'text-warm-700',
    role: 'status' as const,
  },
  high: {
    container: 'bg-error-50 border-l-4 border-error-600 rounded-xl p-5',
    icon: AlertCircle,
    iconColor: 'text-error-700',
    textColor: 'text-error-700',
    role: 'alert' as const,
  },
} as const;

const typeLabels: Record<Alert['type'], string> = {
  emotional_distress: 'Emotional distress',
  missed_medication: 'Missed medication',
  health_anomaly: 'Health anomaly',
  inactivity: 'Inactivity',
};

function formatTimestamp(iso: string): string {
  try {
    const date = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60_000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins === 1 ? '' : 's'} ago`;

    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;

    return date.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

export function AlertCard({ alert, onAcknowledge, acknowledging }: AlertCardProps) {
  const config = severityConfig[alert.severity];
  const Icon = config.icon;

  return (
    <div role={config.role} className={config.container}>
      <div className="flex items-start gap-3">
        <Icon
          className={`w-6 h-6 flex-shrink-0 mt-0.5 ${config.iconColor}`}
          aria-hidden="true"
        />
        <div className="flex-1 min-w-0">
          <p className={`text-body font-semibold ${config.textColor}`}>
            {typeLabels[alert.type]}
          </p>
          <p className="text-body-sm text-text-primary mt-1">
            {alert.message}
          </p>
          {alert.createdAt && (
            <time
              dateTime={alert.createdAt}
              className="text-caption text-text-muted mt-2 block"
            >
              {formatTimestamp(alert.createdAt)}
            </time>
          )}
          {!alert.acknowledged && (
            <Button
              variant="primary"
              size="lg"
              className="mt-3"
              loading={acknowledging}
              onClick={() => onAcknowledge(alert.id)}
              aria-label={`Acknowledge alert: ${alert.message}`}
            >
              Acknowledge
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
