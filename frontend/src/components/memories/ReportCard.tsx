'use client';

import { Badge } from '@/components/ui/Badge';

interface ReportCardProps {
  id: string;
  type: 'daily' | 'weekly';
  dateRange: string;
  mood: string;
  summary: string;
  className?: string;
  onClick?: () => void;
}

const moodStyles: Record<string, { label: string; colorClass: string }> = {
  happy: { label: 'Happy', colorClass: 'text-success-700' },
  okay: { label: 'Okay', colorClass: 'text-info-700' },
  stable: { label: 'Stable', colorClass: 'text-info-700' },
  sad: { label: 'Sad', colorClass: 'text-warning-700' },
  anxious: { label: 'Anxious', colorClass: 'text-error-700' },
};

export function ReportCard({
  id,
  type,
  dateRange,
  mood,
  summary,
  className = '',
  onClick,
}: ReportCardProps) {
  const moodInfo = moodStyles[mood.toLowerCase()] ?? {
    label: mood,
    colorClass: 'text-text-secondary',
  };

  return (
    <article
      className={[
        'bg-bg-surface rounded-2xl shadow-md p-6',
        onClick ? 'cursor-pointer hover:shadow-lg transition-shadow duration-200' : '',
        className,
      ].join(' ')}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <Badge
          variant={{
            kind: 'status',
            status: type === 'daily' ? 'active' : 'pending',
          }}
          size="sm"
        >
          {type === 'daily' ? 'Daily' : 'Weekly'}
        </Badge>
        <span className="text-caption text-text-muted">{dateRange}</span>
      </div>

      {/* Mood indicator */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-body-sm text-text-secondary">Mood:</span>
        <span className={`text-body-sm font-medium ${moodInfo.colorClass}`}>
          {moodInfo.label}
        </span>
      </div>

      {/* Summary */}
      <p className="text-body text-text-primary leading-relaxed">{summary}</p>
    </article>
  );
}
