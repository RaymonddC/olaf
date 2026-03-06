'use client';

import { FileText } from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton';
import { ReportCard } from './ReportCard';
import type { HealthReport } from '@/hooks/useApi';

interface ReportsSectionProps {
  reports: HealthReport[];
  loading?: boolean;
}

export function ReportsSection({ reports, loading }: ReportsSectionProps) {
  return (
    <section aria-labelledby="reports-heading">
      <h2
        id="reports-heading"
        className="text-h3 text-text-heading font-semibold mb-3"
      >
        Reports
      </h2>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <LoadingSkeleton shape="card" />
          <LoadingSkeleton shape="card" />
        </div>
      ) : reports.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No reports yet"
          message="Reports will appear here after the first day with OLAF."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {reports.map((report) => (
            <ReportCard key={report.id} report={report} />
          ))}
        </div>
      )}
    </section>
  );
}
