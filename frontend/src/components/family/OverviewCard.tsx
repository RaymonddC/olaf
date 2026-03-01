'use client';

import { Heart, Pill, MessageSquare, Activity } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton';
import type { HealthLog } from '@/hooks/useApi';

interface OverviewCardProps {
  healthLog: HealthLog | null;
  lastConversationTime: string | null;
  loading?: boolean;
}

const moodDisplay: Record<string, { label: string; color: string }> = {
  happy: { label: 'Happy and chatty', color: 'text-success-700' },
  okay: { label: 'Feeling okay', color: 'text-info-700' },
  sad: { label: 'Feeling sad', color: 'text-warning-700' },
  anxious: { label: 'Feeling anxious', color: 'text-error-700' },
  confused: { label: 'Feeling confused', color: 'text-warning-700' },
  tired: { label: 'Feeling tired', color: 'text-text-muted' },
};

function formatConversationTime(iso: string | null): string {
  if (!iso) return 'No conversation today';
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
    return 'Unknown';
  }
}

export function OverviewCard({ healthLog, lastConversationTime, loading }: OverviewCardProps) {
  if (loading) {
    return (
      <Card variant="elevated" as="section">
        <div className="pb-4 border-b border-border mb-4">
          <LoadingSkeleton shape="heading" width="w-48" />
        </div>
        <div className="space-y-3">
          <LoadingSkeleton shape="text" />
          <LoadingSkeleton shape="text" />
          <LoadingSkeleton shape="text" />
        </div>
      </Card>
    );
  }

  const mood = healthLog?.mood
    ? moodDisplay[healthLog.mood] ?? { label: healthLog.mood, color: 'text-text-primary' }
    : { label: 'No check-in yet', color: 'text-text-muted' };

  const medsTaken = healthLog?.medicationsTaken?.filter((m) => m.confirmed).length ?? 0;
  const medsTotal = healthLog?.medicationsTaken?.length ?? 0;

  const activitySummary = healthLog?.activityNotes || 'No activity recorded today';

  return (
    <Card variant="elevated" as="section">
      <div className="pb-4 border-b border-border mb-4">
        <h2 className="text-h3 text-text-heading font-semibold">
          Today&apos;s overview
        </h2>
      </div>
      <dl className="space-y-3">
        <div className="flex items-center gap-3">
          <dt className="flex items-center gap-2 text-body text-text-secondary w-40 flex-shrink-0">
            <Heart className="w-5 h-5 text-success-600" aria-hidden="true" />
            Mood
          </dt>
          <dd className={`text-body font-medium ${mood.color}`}>
            {mood.label}
          </dd>
        </div>
        <div className="flex items-center gap-3">
          <dt className="flex items-center gap-2 text-body text-text-secondary w-40 flex-shrink-0">
            <Pill className="w-5 h-5 text-info-700" aria-hidden="true" />
            Medications
          </dt>
          <dd className="text-body font-medium text-text-primary">
            {medsTotal > 0 ? `${medsTaken} of ${medsTotal} taken` : 'None scheduled'}
          </dd>
        </div>
        <div className="flex items-center gap-3">
          <dt className="flex items-center gap-2 text-body text-text-secondary w-40 flex-shrink-0">
            <MessageSquare className="w-5 h-5 text-primary-700" aria-hidden="true" />
            Last conversation
          </dt>
          <dd className="text-body font-medium text-text-primary">
            {formatConversationTime(lastConversationTime)}
          </dd>
        </div>
        <div className="flex items-center gap-3">
          <dt className="flex items-center gap-2 text-body text-text-secondary w-40 flex-shrink-0">
            <Activity className="w-5 h-5 text-warm-600" aria-hidden="true" />
            Activity
          </dt>
          <dd className="text-body font-medium text-text-primary">
            {activitySummary}
          </dd>
        </div>
      </dl>
    </Card>
  );
}
