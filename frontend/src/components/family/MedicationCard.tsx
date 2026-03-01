'use client';

import { Pill, Check, Clock, X } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';

type MedicationStatus = 'upcoming' | 'taken' | 'missed';

interface MedicationCardProps {
  name: string;
  dosage?: string;
  time: string;
  status: MedicationStatus;
}

const statusConfig: Record<
  MedicationStatus,
  {
    iconBg: string;
    iconColor: string;
    icon: typeof Check;
    badgeVariant: { kind: 'status'; status: 'active' | 'inactive' | 'pending' };
    badgeLabel: string;
  }
> = {
  upcoming: {
    iconBg: 'bg-info-50',
    iconColor: 'text-info-700',
    icon: Clock,
    badgeVariant: { kind: 'status', status: 'pending' },
    badgeLabel: 'Upcoming',
  },
  taken: {
    iconBg: 'bg-success-50',
    iconColor: 'text-success-700',
    icon: Check,
    badgeVariant: { kind: 'status', status: 'active' },
    badgeLabel: 'Taken',
  },
  missed: {
    iconBg: 'bg-error-50',
    iconColor: 'text-error-700',
    icon: X,
    badgeVariant: { kind: 'status', status: 'inactive' },
    badgeLabel: 'Missed',
  },
};

export function MedicationCard({ name, dosage, time, status }: MedicationCardProps) {
  const config = statusConfig[status];
  const StatusIcon = config.icon;

  return (
    <article
      className="bg-bg-surface rounded-2xl border border-border p-5 flex items-center gap-4"
      aria-label={`${name} — ${config.badgeLabel}`}
    >
      <div
        className={`w-12 h-12 rounded-xl ${config.iconBg} ${config.iconColor} flex items-center justify-center flex-shrink-0`}
      >
        {status === 'taken' ? (
          <Check className="w-6 h-6" aria-hidden="true" />
        ) : status === 'missed' ? (
          <X className="w-6 h-6" aria-hidden="true" />
        ) : (
          <Pill className="w-6 h-6" aria-hidden="true" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-body font-semibold text-text-heading truncate">{name}</p>
        {dosage && (
          <p className="text-body-sm text-text-secondary mt-0.5">{dosage}</p>
        )}
        <p className="text-caption text-text-muted mt-1 flex items-center gap-1">
          <Clock className="w-4 h-4" aria-hidden="true" />
          <time dateTime={time}>{time}</time>
        </p>
      </div>

      <div className="flex-shrink-0">
        <Badge variant={config.badgeVariant} size="sm">
          {config.badgeLabel}
        </Badge>
      </div>
    </article>
  );
}
