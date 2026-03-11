'use client';

import { useState } from 'react';
import { BookOpen } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { EmptyState } from '@/components/ui/EmptyState';
import { MemoryChapterCard } from '@/components/memories/MemoryChapterCard';
import { MemoryCardSkeleton } from '@/components/memories/MemoryCardSkeleton';
import { useMemories, type MemoryListItem } from '@/hooks/useApi';
import { useAuth } from '@/contexts/AuthContext';

type Period = 'week' | 'month' | 'year';
const PERIODS: { value: Period; label: string }[] = [
    { value: 'week', label: 'This Week' },
    { value: 'month', label: 'This Month' },
    { value: 'year', label: 'This Year' },
];

function filterByPeriod(memories: MemoryListItem[], period: Period) {
    const now = new Date();
    const cutoff = new Date(now);
    if (period === 'week') cutoff.setDate(now.getDate() - 7);
    else if (period === 'month') cutoff.setMonth(now.getMonth() - 1);
    else cutoff.setFullYear(now.getFullYear() - 1);
    return memories.filter(m => new Date(m.createdAt) >= cutoff);
}

function dayLabel(iso: string): string {
    const d = new Date(iso);
    const now = new Date();
    const same = (a: Date, b: Date) =>
        a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
    if (same(d, now)) return 'Today';
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    if (same(d, yesterday)) return 'Yesterday';
    return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

function groupByDay(memories: MemoryListItem[]) {
    const groups = new Map<string, MemoryListItem[]>();
    for (const m of memories) {
        const label = dayLabel(m.createdAt);
        if (!groups.has(label)) groups.set(label, []);
        groups.get(label)!.push(m);
    }
    return Array.from(groups.entries()).map(([label, items]) => ({ label, items }));
}

export default function MemoriesPage() {
    const { user } = useAuth();
    const [period, setPeriod] = useState<Period>('month');

    const { data, isLoading, isError } = useMemories(user?.uid ?? '', 100, 0);
    const memories = data?.memories ?? [];
    const filtered = filterByPeriod(memories, period);
    const groups = groupByDay(filtered);

    function handlePeriodChange(p: Period) {
        setPeriod(p);
    }

    return (
        <div className="flex flex-col h-dvh">
            <Header title="My Memories" subtitle="Stories from your life" />

            <div className="flex-1 overflow-y-auto px-5 py-5 pb-32 lg:px-12 lg:py-8 lg:pb-36">
                <div className="max-w-4xl mx-auto w-full">

                    {/* Period filter pills */}
                    {!isLoading && !isError && memories.length > 0 && (
                        <div className="flex gap-2 mb-5">
                            {PERIODS.map((p) => (
                                <button
                                    key={p.value}
                                    type="button"
                                    onClick={() => handlePeriodChange(p.value)}
                                    className="px-5 py-2.5 rounded-[14px] text-[14px] font-heading font-semibold cursor-pointer border-none transition-all"
                                    style={{
                                        background: period === p.value ? 'rgba(26,109,224,0.12)' : 'rgba(255,255,255,0.75)',
                                        color: period === p.value ? '#1a6de0' : '#94a3b8',
                                        boxShadow: period === p.value ? '0 2px 8px rgba(26,109,224,0.10)' : '0 1px 4px rgba(15,23,42,0.04)',
                                        backdropFilter: 'blur(8px)',
                                    }}
                                >
                                    {p.label}
                                </button>
                            ))}
                        </div>
                    )}


                    {isLoading && (
                        <div className="space-y-3">
                            {[0, 1, 2, 3].map(i => <MemoryCardSkeleton key={i} />)}
                        </div>
                    )}

                    {isError && !isLoading && (
                        <EmptyState icon={BookOpen} title="Something went wrong" message="We couldn't load your memories." />
                    )}

                    {!isLoading && !isError && memories.length === 0 && (
                        <div className="flex flex-col items-center justify-center" style={{ minHeight: '50vh' }}>
                            <EmptyState
                                icon={BookOpen}
                                title="No memories yet"
                                message="Talk to OLAF and share a story — it will be beautifully preserved here."
                                action={{ label: 'Start talking', href: '/talk' }}
                            />
                        </div>
                    )}

                    {!isLoading && !isError && memories.length > 0 && filtered.length === 0 && (
                        <EmptyState
                            icon={BookOpen}
                            title={`No memories this ${period}`}
                            message="Try selecting a wider time range above."
                        />
                    )}

                    {!isLoading && !isError && groups.length > 0 && (
                        <div className="space-y-8">
                            {groups.map(({ label, items }) => (
                                <section key={label}>
                                    {/* Day header */}
                                    <div className="flex items-center gap-3 mb-4">
                                        <span className="text-[13px] lg:text-[14px] font-heading font-bold text-text-muted uppercase tracking-[0.06em] whitespace-nowrap">
                                            {label}
                                        </span>
                                        <div className="flex-1 h-px" style={{ background: 'rgba(148,163,184,0.2)' }} />
                                        <span className="text-[12px] text-text-muted font-heading">{items.length} {items.length === 1 ? 'memory' : 'memories'}</span>
                                    </div>

                                    {/* Memory cards */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 lg:gap-4">
                                        {items.map((m, i) => (
                                            <div
                                                key={m.id}
                                                style={{ animation: `fadeUp 0.45s ease ${i * 60}ms forwards`, opacity: 0 }}
                                            >
                                                <MemoryChapterCard
                                                    id={m.id}
                                                    title={m.title}
                                                    createdAt={m.createdAt}
                                                    illustrationUrls={m.illustrationUrls}
                                                    snippet={m.snippet}
                                                />
                                            </div>
                                        ))}
                                    </div>
                                </section>
                            ))}
                        </div>
                    )}

                </div>
            </div>
        </div>
    );
}
