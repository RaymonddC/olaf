'use client';

import { AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton';
import { AlertCard } from './AlertCard';
import type { Alert } from '@/hooks/useApi';

interface AlertSectionProps {
  alerts: Alert[];
  loading?: boolean;
  acknowledgingId: string | null;
  onAcknowledge: (alertId: string) => void;
}

const severityOrder: Record<Alert['severity'], number> = {
  high: 0,
  medium: 1,
  low: 2,
};

export function AlertSection({
  alerts,
  loading,
  acknowledgingId,
  onAcknowledge,
}: AlertSectionProps) {
  const unacknowledged = alerts.filter((a) => !a.acknowledged);
  const sorted = [...unacknowledged].sort((a, b) => {
    const sevDiff = severityOrder[a.severity] - severityOrder[b.severity];
    if (sevDiff !== 0) return sevDiff;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  return (
    <section aria-labelledby="alerts-heading">
      <div className="flex items-center gap-2 mb-3">
        <h2
          id="alerts-heading"
          className="text-h3 text-text-heading font-semibold"
        >
          Alerts
        </h2>
        {sorted.length > 0 && (
          <Badge
            variant={{ kind: 'severity', severity: sorted[0]?.severity ?? 'low' }}
            size="sm"
          >
            {String(sorted.length)}
          </Badge>
        )}
      </div>

      {loading ? (
        <div className="space-y-3">
          <LoadingSkeleton shape="card" />
          <LoadingSkeleton shape="card" />
        </div>
      ) : sorted.length === 0 ? (
        <EmptyState
          icon={AlertTriangle}
          title="All clear"
          message="No alerts to show. That's great news!"
        />
      ) : (
        <div className="space-y-3" role="list" aria-label="Alert list">
          {sorted.map((alert) => (
            <div key={alert.id} role="listitem">
              <AlertCard
                alert={alert}
                onAcknowledge={onAcknowledge}
                acknowledging={acknowledgingId === alert.id}
              />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
