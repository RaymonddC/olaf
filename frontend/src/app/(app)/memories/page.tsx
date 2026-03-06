'use client';

import { useState } from 'react';
import { BookOpen } from 'lucide-react';

import { Header } from '@/components/layout/Header';
import { PageShell } from '@/components/layout/PageShell';
import { EmptyState } from '@/components/ui/EmptyState';
import { MemoryChapterCard } from '@/components/memories/MemoryChapterCard';
import { MemoryCardSkeleton } from '@/components/memories/MemoryCardSkeleton';
import { useMemories, type MemoryListItem } from '@/hooks/useApi';
import { useAuth } from '@/contexts/AuthContext';

type Period = 'week' | 'month' | 'year';

const PERIODS: { value: Period; label: string }[] = [
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
  { value: 'year', label: 'Year' },
];

function groupMemories(memories: MemoryListItem[], period: Period) {
  const groups = new Map<string, MemoryListItem[]>();
  const now = new Date();

  for (const memory of memories) {
    const date = new Date(memory.createdAt);
    let label: string;

    if (period === 'week') {
      const diffDays = Math.floor((now.getTime() - date.getTime()) / 86_400_000);
      const diffWeeks = Math.floor(diffDays / 7);
      if (diffWeeks === 0) label = 'This week';
      else if (diffWeeks === 1) label = 'Last week';
      else label = `${diffWeeks} weeks ago`;
    } else if (period === 'month') {
      label = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    } else {
      label = date.getFullYear().toString();
    }

    if (!groups.has(label)) groups.set(label, []);
    groups.get(label)!.push(memory);
  }

  return Array.from(groups.entries()).map(([label, items]) => ({ label, items }));
}

export default function MemoriesPage() {
  const { user } = useAuth();
  const userId = user?.uid ?? '';
  const [period, setPeriod] = useState<Period>('month');

  const { data, isLoading, isError } = useMemories(userId, 100, 0);
  const memories = data?.memories ?? [];
  const groups = groupMemories(memories, period);

  return (
    <>
      <Header title="My Memories" />

      <PageShell id="memories-content">
        {/* Period tabs */}
        {!isLoading && !isError && memories.length > 0 && (
          <div className="flex gap-2 mb-6">
            {PERIODS.map((p) => (
              <button
                key={p.value}
                type="button"
                onClick={() => setPeriod(p.value)}
                className={[
                  'flex-1 py-2 rounded-xl text-body-sm font-semibold transition-colors duration-150',
                  'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary-300',
                  period === p.value
                    ? 'bg-primary-700 text-white'
                    : 'bg-bg-surface border border-border text-text-secondary hover:border-border-strong',
                ].join(' ')}
              >
                {p.label}
              </button>
            ))}
          </div>
        )}

        {/* Loading */}
        {isLoading && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <MemoryCardSkeleton key={i} />
            ))}
          </div>
        )}

        {/* Error */}
        {isError && !isLoading && (
          <EmptyState
            icon={BookOpen}
            title="Something went wrong"
            message="We couldn't load your memories. Please try again."
          />
        )}

        {/* Empty */}
        {!isLoading && !isError && memories.length === 0 && (
          <EmptyState
            icon={BookOpen}
            title="No memories yet"
            message="Talk to OLAF and share a story — it will be saved here as a memory."
            action={{ label: 'Start talking', href: '/talk' }}
          />
        )}

        {/* Grouped memories */}
        {!isLoading && !isError && groups.length > 0 && (
          <div className="space-y-8">
            {groups.map(({ label, items }) => (
              <section key={label}>
                <h2 className="text-body font-semibold text-text-muted uppercase tracking-wide mb-3">
                  {label}
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                  {items.map((memory) => (
                    <MemoryChapterCard
                      key={memory.id}
                      id={memory.id}
                      title={memory.title}
                      createdAt={memory.createdAt}
                      illustrationUrls={memory.illustrationUrls}
                      snippet={memory.snippet}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </PageShell>
    </>
  );
}
