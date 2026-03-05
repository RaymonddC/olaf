'use client';

/**
 * Family Dashboard — Reports Page
 *
 * Shows daily narratives and weekly reports. Includes:
 * - Mood trend line chart (recharts)
 * - Medication adherence bar chart (recharts)
 * - Concerns and highlights sections
 * - Report content expansion
 */

import { useState } from 'react';
import { FileText, ArrowLeft, ChevronDown, ChevronUp } from 'lucide-react';
import Link from 'next/link';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { Header } from '@/components/layout/Header';
import { PageShell } from '@/components/layout/PageShell';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton';
import { useMe, useReports } from '@/hooks/useApi';
import type { HealthReport } from '@/hooks/useApi';

// ── Helpers ───────────────────────────────────────────────────────────────────

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

function getAdherenceColor(adherence: number): string {
  if (adherence >= 0.8) return '#22c55e';
  if (adherence >= 0.5) return '#f59e0b';
  return '#ef4444';
}

// ── Mood trend chart ──────────────────────────────────────────────────────────

interface MoodChartProps {
  trend: number[];
}

function MoodTrendChart({ trend }: MoodChartProps) {
  if (trend.length === 0) {
    return (
      <p className="text-body-sm text-text-muted text-center py-4">
        No mood data available for this report.
      </p>
    );
  }

  const data = trend.map((score, idx) => ({
    day: `Day ${idx + 1}`,
    score,
  }));

  return (
    <div>
      <p className="text-body-sm font-semibold text-text-secondary mb-2">Mood trend (1–10)</p>
      <ResponsiveContainer width="100%" height={160}>
        <LineChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            dataKey="day"
            tick={{ fontSize: 11, fill: '#6b7280' }}
            tickLine={false}
          />
          <YAxis
            domain={[0, 10]}
            tick={{ fontSize: 11, fill: '#6b7280' }}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{
              borderRadius: '8px',
              border: '1px solid #e5e7eb',
              fontSize: '13px',
            }}
            formatter={(value: number | undefined) => [value !== undefined ? `${value}/10` : 'N/A', 'Mood']}
          />
          <Line
            type="monotone"
            dataKey="score"
            stroke="#4f46e5"
            strokeWidth={2.5}
            dot={{ fill: '#4f46e5', r: 4 }}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Medication adherence bar ──────────────────────────────────────────────────

interface AdherenceBarProps {
  adherence: number;
}

function MedicationAdherenceBar({ adherence }: AdherenceBarProps) {
  const percent = Math.round(adherence * 100);
  const color = getAdherenceColor(adherence);

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <p className="text-body-sm font-semibold text-text-secondary">
          Medication adherence
        </p>
        <span
          className="text-body-sm font-bold"
          style={{ color }}
        >
          {percent}%
        </span>
      </div>
      <div className="w-full h-4 bg-bg-muted rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${percent}%`, backgroundColor: color }}
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Medication adherence: ${percent}%`}
        />
      </div>
    </div>
  );
}

// ── Report card ───────────────────────────────────────────────────────────────

interface ReportDetailCardProps {
  report: HealthReport;
}

function ReportDetailCard({ report }: ReportDetailCardProps) {
  const [expanded, setExpanded] = useState(false);
  const isWeekly = report.type === 'weekly';

  return (
    <Card variant="elevated" as="article" className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Badge
          variant={isWeekly ? { kind: 'status', status: 'active' } : { kind: 'severity', severity: 'low' }}
          size="sm"
        >
          {isWeekly ? 'Weekly report' : 'Daily narrative'}
        </Badge>
        <time dateTime={report.generatedAt} className="text-caption text-text-muted">
          {formatDate(report.generatedAt)}
        </time>
      </div>

      {/* Mood trend chart — weekly only */}
      {isWeekly && report.moodTrend.length > 0 && (
        <MoodTrendChart trend={report.moodTrend} />
      )}

      {/* Medication adherence — both types */}
      <MedicationAdherenceBar adherence={report.medicationAdherence} />

      {/* Report narrative */}
      <div>
        <p
          className={`text-body text-text-primary leading-relaxed ${
            expanded ? '' : 'line-clamp-4'
          }`}
        >
          {report.content}
        </p>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="space-y-4 border-t border-border pt-4">
          {report.highlights.length > 0 && (
            <div>
              <p className="text-body-sm font-semibold text-success-700 mb-2">Highlights</p>
              <ul className="space-y-1">
                {report.highlights.map((h, i) => (
                  <li key={i} className="text-body-sm text-text-primary flex gap-2">
                    <span className="text-success-600 mt-0.5 flex-shrink-0" aria-hidden="true">
                      ✓
                    </span>
                    {h}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {report.concerns.length > 0 && (
            <div>
              <p className="text-body-sm font-semibold text-warning-700 mb-2">Concerns</p>
              <ul className="space-y-1">
                {report.concerns.map((c, i) => (
                  <li key={i} className="text-body-sm text-text-primary flex gap-2">
                    <span className="text-warning-600 mt-0.5 flex-shrink-0" aria-hidden="true">
                      !
                    </span>
                    {c}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Expand / collapse */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-1 text-body-sm font-semibold text-primary-700 hover:text-primary-800 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary-300 rounded-lg min-h-[48px] px-2 -mx-2"
        aria-expanded={expanded}
      >
        {expanded ? (
          <>Show less <ChevronUp className="w-5 h-5" aria-hidden="true" /></>
        ) : (
          <>Read more <ChevronDown className="w-5 h-5" aria-hidden="true" /></>
        )}
      </button>
    </Card>
  );
}

// ── Filter tab ────────────────────────────────────────────────────────────────

type ReportFilter = 'all' | 'daily' | 'weekly';

interface FilterTabsProps {
  active: ReportFilter;
  onChange: (f: ReportFilter) => void;
}

function FilterTabs({ active, onChange }: FilterTabsProps) {
  const tabs: { key: ReportFilter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'daily', label: 'Daily' },
    { key: 'weekly', label: 'Weekly' },
  ];

  return (
    <div className="flex gap-2" role="tablist" aria-label="Report type filter">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          role="tab"
          aria-selected={active === tab.key}
          onClick={() => onChange(tab.key)}
          className={[
            'px-4 py-2 rounded-xl text-body-sm font-semibold transition-colors duration-150',
            'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary-300',
            'min-h-[44px]',
            active === tab.key
              ? 'bg-primary-700 text-white'
              : 'bg-bg-surface text-text-secondary hover:bg-bg-surface-alt border border-border',
          ].join(' ')}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ReportsPage() {
  const { data: meData, isLoading: meLoading } = useMe();
  const profile = meData?.data;

  const elderlyAccount = profile?.linkedAccounts?.find((a) => a.role === 'elderly');
  const elderlyUserId = elderlyAccount?.userId ?? '';
  const elderlyName = elderlyAccount?.name ?? 'Your loved one';

  const [filter, setFilter] = useState<ReportFilter>('all');

  const { data: reportsData, isLoading: reportsLoading } = useReports(
    elderlyUserId,
    filter === 'all' ? undefined : filter,
  );

  const reports = reportsData?.data?.reports ?? [];
  const loading = meLoading || reportsLoading;

  return (
    <>
      <Header
        title={`${elderlyName}'s reports`}
        action={
          <Link
            href="/dashboard"
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-body-sm font-semibold text-text-secondary hover:bg-bg-surface-alt transition-colors duration-150 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary-300 min-h-[48px]"
            aria-label="Back to dashboard"
          >
            <ArrowLeft className="w-5 h-5" aria-hidden="true" />
            Dashboard
          </Link>
        }
      />

      <PageShell id="reports-content" noBottomPad>
        <div className="space-y-6">
          {/* Filter tabs */}
          <FilterTabs active={filter} onChange={setFilter} />

          {loading ? (
            <div className="space-y-4">
              <LoadingSkeleton shape="card" />
              <LoadingSkeleton shape="card" />
            </div>
          ) : !elderlyUserId ? (
            <EmptyState
              icon={FileText}
              title="No linked account"
              message="Link an elderly user account to view their reports."
            />
          ) : reports.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="No reports yet"
              message={`Reports will appear here after ${elderlyName}'s first day using CARIA.`}
            />
          ) : (
            <div className="space-y-4">
              {reports.map((report) => (
                <ReportDetailCard key={report.id} report={report} />
              ))}
            </div>
          )}
        </div>
      </PageShell>
    </>
  );
}
