'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, Heart, Droplets } from 'lucide-react';
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton';
import { MedicationCard } from './MedicationCard';
import type { HealthLog } from '@/hooks/useApi';

interface HealthLogsViewProps {
  logs: HealthLog[];
  loading?: boolean;
}

const moodLabels: Record<string, string> = {
  happy: 'Happy',
  okay: 'Okay',
  sad: 'Sad',
  anxious: 'Anxious',
  confused: 'Confused',
  tired: 'Tired',
};

function formatDate(dateStr: string): string {
  try {
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString('en-GB', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    });
  } catch {
    return dateStr;
  }
}

export function HealthLogsView({ logs, loading }: HealthLogsViewProps) {
  const [expanded, setExpanded] = useState(false);

  if (loading) {
    return (
      <section aria-labelledby="health-logs-heading">
        <LoadingSkeleton shape="heading" width="w-40" />
        <div className="mt-3 space-y-3">
          <LoadingSkeleton shape="card" />
          <LoadingSkeleton shape="card" />
        </div>
      </section>
    );
  }

  if (!logs.length) return null;

  // Build mood trend text from logs
  const moodTrend = logs
    .slice(-7)
    .map((l) => moodLabels[l.mood] ?? l.mood)
    .join(' → ');

  return (
    <section aria-labelledby="health-logs-heading">
      <button
        onClick={() => setExpanded(!expanded)}
        className={[
          'w-full flex items-center justify-between',
          'text-h3 text-text-heading font-semibold',
          'py-2 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary-300 rounded-xl',
          'min-h-[48px]',
        ].join(' ')}
        aria-expanded={expanded}
        aria-controls="health-logs-content"
      >
        <span id="health-logs-heading">Health logs</span>
        {expanded ? (
          <ChevronUp className="w-6 h-6 text-text-secondary" aria-hidden="true" />
        ) : (
          <ChevronDown className="w-6 h-6 text-text-secondary" aria-hidden="true" />
        )}
      </button>

      {expanded && (
        <div id="health-logs-content" className="mt-3 space-y-6">
          {/* Mood trend */}
          {moodTrend && (
            <div className="flex items-start gap-3">
              <Heart className="w-5 h-5 text-success-600 flex-shrink-0 mt-0.5" aria-hidden="true" />
              <div>
                <p className="text-body font-semibold text-text-heading">Mood trend</p>
                <p className="text-body-sm text-text-primary mt-0.5">{moodTrend}</p>
              </div>
            </div>
          )}

          {/* Per-day logs */}
          {logs.map((log) => {
            const hydrationPct =
              log.hydrationReminders.sent > 0
                ? Math.round(
                    (log.hydrationReminders.acknowledged / log.hydrationReminders.sent) * 100,
                  )
                : null;

            return (
              <div key={log.date} className="space-y-3">
                <h3 className="text-h4 text-text-heading font-semibold">
                  {formatDate(log.date)}
                </h3>

                {/* Pain level */}
                {log.painLevel > 0 && (
                  <p className="text-body-sm text-text-primary">
                    Pain level: <span className="font-semibold">{log.painLevel}/10</span>
                  </p>
                )}

                {/* Hydration */}
                {hydrationPct !== null && (
                  <div className="flex items-center gap-2 text-body-sm text-text-primary">
                    <Droplets className="w-5 h-5 text-primary-500" aria-hidden="true" />
                    <span>
                      Hydration: {log.hydrationReminders.acknowledged} of{' '}
                      {log.hydrationReminders.sent} reminders acknowledged ({hydrationPct}%)
                    </span>
                  </div>
                )}

                {/* Medications */}
                {log.medicationsTaken.length > 0 && (
                  <div className="space-y-2">
                    {log.medicationsTaken.map((med, i) => (
                      <MedicationCard
                        key={`${log.date}-${med.name}-${i}`}
                        name={med.name}
                        time={med.time}
                        status={med.confirmed ? 'taken' : 'missed'}
                      />
                    ))}
                  </div>
                )}

                {/* Activity notes */}
                {log.activityNotes && (
                  <p className="text-body-sm text-text-secondary">
                    {log.activityNotes}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
