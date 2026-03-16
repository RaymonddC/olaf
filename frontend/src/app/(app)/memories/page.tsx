'use client';

import { useMemo, useState } from 'react';
import { BookOpen, ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { Header } from '@/components/layout/Header';
import { EmptyState } from '@/components/ui/EmptyState';
import { MemoryChapterCard } from '@/components/memories/MemoryChapterCard';
import { MemoryCardSkeleton } from '@/components/memories/MemoryCardSkeleton';
import { useMemories, type MemoryListItem } from '@/hooks/useApi';
import { useAuth } from '@/contexts/AuthContext';

function toDateKey(d: Date) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function sameDay(a: Date, b: Date) {
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function buildMemoryMap(memories: MemoryListItem[]) {
    const map = new Map<string, MemoryListItem[]>();
    for (const m of memories) {
        const key = toDateKey(new Date(m.createdAt));
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(m);
    }
    return map;
}

function calcStreak(memoryMap: Map<string, MemoryListItem[]>): number {
    const today = new Date();
    let d = new Date(today);
    if (!memoryMap.has(toDateKey(d))) {
        d.setDate(d.getDate() - 1);
        if (!memoryMap.has(toDateKey(d))) return 0;
    }
    let streak = 0;
    while (memoryMap.has(toDateKey(d))) {
        streak++;
        d.setDate(d.getDate() - 1);
    }
    return streak;
}

function getCalendarDays(year: number, month: number) {
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: (number | null)[] = [];
    for (let i = 0; i < firstDay; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    return cells;
}

export default function MemoriesPage() {
    const { user } = useAuth();
    const today = new Date();
    const [viewMonth, setViewMonth] = useState({ year: today.getFullYear(), month: today.getMonth() });
    const [selectedDate, setSelectedDate] = useState<string>(toDateKey(today));

    const { data, isLoading, isError } = useMemories(user?.uid ?? '', 100, 0);
    const memories = data?.memories ?? [];
    const memoryMap = useMemo(() => buildMemoryMap(memories), [memories]);
    const streak = useMemo(() => calcStreak(memoryMap), [memoryMap]);

    const cells = getCalendarDays(viewMonth.year, viewMonth.month);
    const monthLabel = new Date(viewMonth.year, viewMonth.month).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    const selectedMemories = memoryMap.get(selectedDate) ?? [];
    const isCurrentMonth = viewMonth.year === today.getFullYear() && viewMonth.month === today.getMonth();

    const selectedDateObj = new Date(selectedDate + 'T00:00:00');
    const isSelectedToday = sameDay(selectedDateObj, today);
    const selectedLabel = isSelectedToday
        ? 'Today'
        : (() => {
            const y = new Date(today);
            y.setDate(today.getDate() - 1);
            return sameDay(selectedDateObj, y)
                ? 'Yesterday'
                : selectedDateObj.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
        })();

    function prevMonth() {
        setViewMonth(v => v.month === 0 ? { year: v.year - 1, month: 11 } : { year: v.year, month: v.month - 1 });
    }
    function nextMonth() {
        setViewMonth(v => v.month === 11 ? { year: v.year + 1, month: 0 } : { year: v.year, month: v.month + 1 });
    }

    const streakText = streak === 0
        ? null
        : streak === 1
            ? "You shared a moment with OLAF today"
            : streak < 7
                ? `${streak} days of conversations with OLAF — keep it going`
                : streak < 30
                    ? `${streak} days in a row — OLAF loves hearing from you`
                    : `${streak} days together — what a beautiful journey`;

    return (
        <div className="flex flex-col h-dvh">
            <Header title="Memories" />

            <div className="flex-1 overflow-y-auto px-6 lg:px-10 pb-32 lg:pb-12">
                <div className="max-w-xl lg:max-w-2xl mx-auto w-full">

                    {/* Loading */}
                    {isLoading && (
                        <div className="pt-6 space-y-3">
                            <div className="h-6 w-3/4 rounded animate-skeleton" style={{ background: 'rgba(148,163,184,0.1)' }} />
                            <div className="h-5 w-1/3 rounded animate-skeleton" style={{ background: 'rgba(148,163,184,0.08)' }} />
                            <div className="h-56 rounded-2xl animate-skeleton mt-3" style={{ background: 'rgba(148,163,184,0.06)' }} />
                            {[0, 1].map(i => <MemoryCardSkeleton key={i} />)}
                        </div>
                    )}

                    {/* Error */}
                    {isError && !isLoading && (
                        <div className="py-10">
                            <EmptyState icon={BookOpen} title="Something went wrong" message="We couldn't load your memories." />
                        </div>
                    )}

                    {/* Empty */}
                    {!isLoading && !isError && memories.length === 0 && (
                        <div className="flex flex-col items-center justify-center" style={{ minHeight: '50vh' }}>
                            <EmptyState
                                icon={BookOpen}
                                title="No memories yet"
                                message="Talk to OLAF — your story builds here."
                                action={{ label: 'Start talking', href: '/talk' }}
                            />
                        </div>
                    )}

                    {/* Content */}
                    {!isLoading && !isError && memories.length > 0 && (
                        <>
                            {/* Greeting */}
                            <div className="pt-6 lg:pt-8 mb-6 rounded-2xl px-5 py-5 lg:px-6 lg:py-6"
                                 style={{ background: 'rgba(224,242,241,0.6)', border: '1px solid rgba(178,223,219,0.4)' }}>
                                {streakText && (
                                    <p className="text-[17px] lg:text-[20px] leading-snug font-heading font-bold" style={{ color: '#00695c' }}>
                                        {streakText}
                                    </p>
                                )}
                                <p className="text-[15px] lg:text-[16px] mt-2" style={{ color: '#64748b' }}>
                                    {memories.length} {memories.length === 1 ? 'moment' : 'moments'} remembered
                                    {memories.length >= 10 && ' — your story is growing'}
                                    {memories.length >= 50 && ' beautifully'}
                                </p>
                            </div>

                            {/* Month nav */}
                            <div className="flex items-center justify-between mb-3">
                                <button onClick={prevMonth} aria-label="Previous month"
                                    className="w-12 h-12 rounded-xl flex items-center justify-center hover:bg-black/5 transition-colors active:scale-95">
                                    <ChevronLeft className="w-7 h-7 text-text-muted" />
                                </button>
                                <span className="text-[19px] lg:text-[22px] font-heading font-bold text-text-heading">
                                    {monthLabel}
                                </span>
                                <button onClick={nextMonth} aria-label="Next month" disabled={isCurrentMonth}
                                    className="w-12 h-12 rounded-xl flex items-center justify-center hover:bg-black/5 transition-colors active:scale-95 disabled:opacity-20">
                                    <ChevronRight className="w-7 h-7 text-text-muted" />
                                </button>
                            </div>

                            {/* Weekday headers */}
                            <div className="grid grid-cols-7 mb-1">
                                {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((d, i) => (
                                    <div key={i} className="text-center text-[14px] lg:text-[15px] font-heading font-semibold text-text-muted py-2">
                                        {d}
                                    </div>
                                ))}
                            </div>

                            {/* Calendar days */}
                            <div className="grid grid-cols-7 gap-y-1 mb-8">
                                {cells.map((day, i) => {
                                    if (day === null) return <div key={`e-${i}`} />;

                                    const cellDate = new Date(viewMonth.year, viewMonth.month, day);
                                    const key = toDateKey(cellDate);
                                    const has = memoryMap.has(key);
                                    const count = memoryMap.get(key)?.length ?? 0;
                                    const isToday = sameDay(cellDate, today);
                                    const isSel = key === selectedDate;
                                    const isFuture = cellDate > today;
                                    const isPast = cellDate < today && !isToday;

                                    return (
                                        <button
                                            key={key}
                                            type="button"
                                            disabled={isFuture}
                                            onClick={() => setSelectedDate(key)}
                                            className="flex flex-col items-center justify-center py-1 disabled:opacity-15 transition-all active:scale-95"
                                        >
                                            <span
                                                className="w-12 h-12 lg:w-14 lg:h-14 rounded-full flex items-center justify-center text-[17px] lg:text-[19px] font-heading transition-all duration-200"
                                                style={{
                                                    background: isSel
                                                        ? '#3b82f6'
                                                        : has
                                                            ? 'rgba(219,234,254,0.6)'
                                                            : 'transparent',
                                                    color: isSel
                                                        ? '#fff'
                                                        : has
                                                            ? '#00695c'
                                                            : isToday
                                                                ? '#1e293b'
                                                                : isPast
                                                                    ? '#94a3b8'
                                                                    : '#64748b',
                                                    fontWeight: isSel || has || isToday ? 700 : 400,
                                                    boxShadow: isToday && !isSel
                                                        ? 'inset 0 0 0 2.5px rgba(59,130,246,0.35)'
                                                        : isSel
                                                            ? '0 3px 12px rgba(59,130,246,0.3)'
                                                            : 'none',
                                                }}
                                            >
                                                {day}
                                            </span>
                                            {has && !isSel && (
                                                <span className="flex gap-0.5 mt-1">
                                                    {Array.from({ length: Math.min(count, 3) }).map((_, di) => (
                                                        <span key={di} className="w-1.5 h-1.5 rounded-full" style={{ background: '#4db6ac' }} />
                                                    ))}
                                                </span>
                                            )}
                                            {(!has || isSel) && <span className="h-2.5 mt-1" />}
                                        </button>
                                    );
                                })}
                            </div>

                            {/* Divider */}
                            <div className="h-px mb-6" style={{ background: 'rgba(219,234,254,0.5)' }} />

                            {/* Selected day header */}
                            <div className="flex items-baseline justify-between mb-4">
                                <p className="text-[19px] lg:text-[22px] font-heading font-bold text-text-heading">
                                    {selectedLabel}
                                </p>
                                {selectedMemories.length > 0 && (
                                    <p className="text-[15px] lg:text-[17px] font-heading" style={{ color: '#64748b' }}>
                                        {selectedMemories.length} {selectedMemories.length === 1 ? 'memory' : 'memories'}
                                    </p>
                                )}
                            </div>

                            {/* Memory cards */}
                            {selectedMemories.length > 0 ? (
                                <div className="flex flex-col gap-3">
                                    {selectedMemories.map((m, i) => (
                                        <div key={m.id} style={{ animation: `fadeUp 0.3s ease ${i * 50}ms forwards`, opacity: 0 }}>
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
                            ) : (
                                <div className="text-center py-10 rounded-2xl"
                                     style={{ background: 'rgba(255,247,230,0.5)' }}>
                                    <p className="text-[18px] lg:text-[20px] mb-4 font-heading" style={{ color: '#92400e' }}>
                                        {isSelectedToday ? "You haven't talked with OLAF yet today" : 'No memories on this day'}
                                    </p>
                                    {isSelectedToday && (
                                        <Link
                                            href="/talk"
                                            className="inline-flex px-8 py-4 rounded-2xl text-[18px] lg:text-[19px] font-heading font-semibold text-white active:scale-95 transition-transform min-h-[56px] items-center"
                                            style={{ background: '#3b82f6', boxShadow: '0 2px 8px rgba(59,130,246,0.25)' }}
                                        >
                                            Talk to OLAF
                                        </Link>
                                    )}
                                </div>
                            )}
                        </>
                    )}

                </div>
            </div>
        </div>
    );
}
