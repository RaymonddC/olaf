'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import type { HealthReport } from '@/hooks/useApi';

interface ReportCardProps {
  report: HealthReport;
}

const moodScoreLabels: Record<number, { label: string; color: string }> = {
  1: { label: 'Very low', color: 'text-error-700' },
  2: { label: 'Low', color: 'text-error-700' },
  3: { label: 'Below average', color: 'text-warning-700' },
  4: { label: 'Below average', color: 'text-warning-700' },
  5: { label: 'Average', color: 'text-info-700' },
  6: { label: 'Above average', color: 'text-info-700' },
  7: { label: 'Good', color: 'text-success-700' },
  8: { label: 'Very good', color: 'text-success-700' },
  9: { label: 'Excellent', color: 'text-success-700' },
  10: { label: 'Excellent', color: 'text-success-700' },
};

function getMoodLabel(trend: number[]): { label: string; color: string } {
  if (!trend.length) return { label: 'No data', color: 'text-text-muted' };
  const avg = Math.round(trend.reduce((a, b) => a + b, 0) / trend.length);
  return moodScoreLabels[avg] ?? { label: 'Average', color: 'text-info-700' };
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return '';
  }
}

export function ReportCard({ report }: ReportCardProps) {
  const [expanded, setExpanded] = useState(false);
  const mood = getMoodLabel(report.moodTrend);
  const adherencePercent = Math.round(report.medicationAdherence * 100);

  const typeBadge =
    report.type === 'daily'
      ? { kind: 'severity' as const, severity: 'low' as const }
      : { kind: 'status' as const, status: 'active' as const };

  return (
    <Card variant="elevated" as="article" className="flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <Badge variant={typeBadge} size="sm">
          {report.type === 'daily' ? 'Daily' : 'Weekly'}
        </Badge>
        <time dateTime={report.generatedAt} className="text-caption text-text-muted">
          {formatDate(report.generatedAt)}
        </time>
      </div>

      {/* Mood indicator */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-body-sm text-text-secondary">Mood:</span>
        <span className={`text-body-sm font-semibold ${mood.color}`}>{mood.label}</span>
      </div>

      {/* Medication adherence */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-body-sm text-text-secondary">Medication adherence:</span>
        <span className="text-body-sm font-semibold text-text-primary">{adherencePercent}%</span>
      </div>

      {/* Summary / Content */}
      <p
        className={`text-body text-text-primary leading-relaxed ${
          expanded ? '' : 'line-clamp-3'
        }`}
      >
        {report.content}
      </p>

      {/* Concerns & Highlights when expanded */}
      {expanded && (
        <div className="mt-4 space-y-3">
          {report.highlights.length > 0 && (
            <div>
              <p className="text-body-sm font-semibold text-success-700 mb-1">Highlights</p>
              <ul className="list-disc list-inside text-body-sm text-text-primary space-y-1">
                {report.highlights.map((h, i) => (
                  <li key={i}>{h}</li>
                ))}
              </ul>
            </div>
          )}
          {report.concerns.length > 0 && (
            <div>
              <p className="text-body-sm font-semibold text-warning-700 mb-1">Concerns</p>
              <ul className="list-disc list-inside text-body-sm text-text-primary space-y-1">
                {report.concerns.map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Expand/Collapse */}
      <button
        onClick={() => setExpanded(!expanded)}
        className={[
          'mt-3 flex items-center gap-1 text-body-sm font-semibold text-primary-700',
          'hover:text-primary-800 transition-colors duration-150',
          'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary-300 rounded-lg',
          'min-h-[48px] px-2 -mx-2',
        ].join(' ')}
        aria-expanded={expanded}
      >
        {expanded ? (
          <>
            Show less <ChevronUp className="w-5 h-5" aria-hidden="true" />
          </>
        ) : (
          <>
            Read more <ChevronDown className="w-5 h-5" aria-hidden="true" />
          </>
        )}
      </button>
    </Card>
  );
}
