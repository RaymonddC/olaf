'use client';

import { useState } from 'react';
import { BookOpen, Mic, Plus } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { Header } from '@/components/layout/Header';
import { PageShell } from '@/components/layout/PageShell';
import { EmptyState } from '@/components/ui/EmptyState';
import { MemoryChapterCard } from '@/components/memories/MemoryChapterCard';
import { MemoryCardSkeleton } from '@/components/memories/MemoryCardSkeleton';
import { useMemories, type MemoryListItem } from '@/hooks/useApi';
import { useAuth } from '@/contexts/AuthContext';

type Period = 'week' | 'month' | 'year';
const PERIODS: { value: Period; label: string }[] = [
    { value: 'week', label: 'This Week' },
    { value: 'month', label: 'Month' },
    { value: 'year', label: 'Year' },
];

function groupMemories(memories: MemoryListItem[], period: Period) {
    const groups = new Map<string, MemoryListItem[]>();
    const now = new Date();
    for (const m of memories) {
        const d = new Date(m.createdAt);
        let label: string;
        if (period === 'week') {
            const w = Math.floor((now.getTime() - d.getTime()) / 86_400_000 / 7);
            label = w === 0 ? 'This week' : w === 1 ? 'Last week' : `${w} weeks ago`;
        } else if (period === 'month') {
            label = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        } else {
            label = d.getFullYear().toString();
        }
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
    const groups = groupMemories(memories, period);

    return (
        <>
            <Header title="My Memories" subtitle="Stories from your life" />
            <PageShell id="memories-content">
                {/* Period pills */}
                {!isLoading && !isError && memories.length > 0 && (
                    <div className="flex gap-2 mb-6">
                        {PERIODS.map((p) => (
                            <button key={p.value} type="button" onClick={() => setPeriod(p.value)}
                                    className="px-5 py-2.5 rounded-[14px] text-[14px] font-heading font-semibold cursor-pointer border-none transition-all duration-250"
                                    style={{
                                        background: period === p.value ? 'linear-gradient(135deg, #1a6de0, #1558b8)' : 'rgba(255,255,255,0.75)',
                                        color: period === p.value ? '#fff' : '#94a3b8',
                                        boxShadow: period === p.value ? '0 4px 14px rgba(26,109,224,0.18)' : '0 1px 4px rgba(15,23,42,0.04)',
                                        backdropFilter: 'blur(8px)',
                                    }}>
                                {p.label}
                            </button>
                        ))}
                    </div>
                )}

                {isLoading && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {[0,1,2,3].map(i => <MemoryCardSkeleton key={i} />)}
                    </div>
                )}

                {isError && !isLoading && <EmptyState icon={BookOpen} title="Something went wrong" message="We couldn't load your memories." />}

                {!isLoading && !isError && memories.length === 0 && (
                    <EmptyState icon={BookOpen} title="No memories yet" message="Talk to OLAF and share a story — it will be beautifully preserved here." action={{ label: 'Start talking', href: '/talk' }} />
                )}

                {!isLoading && !isError && groups.length > 0 && (
                    <div className="space-y-8">
                        {groups.map(({ label, items }) => (
                            <section key={label}>
                                <h2 className="text-[12px] font-heading font-semibold text-text-muted uppercase tracking-[0.05em] mb-3">{label}</h2>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {items.map((m, i) => (
                                        <div key={m.id} style={{ animation: `fadeUp 0.45s ease ${i * 60}ms forwards`, opacity: 0 }}>
                                            <MemoryChapterCard id={m.id} title={m.title} createdAt={m.createdAt} illustrationUrls={m.illustrationUrls} snippet={m.snippet} />
                                        </div>
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