'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut, ChevronLeft, ChevronRight, Bell, CheckCircle2, AlertTriangle } from 'lucide-react';
import { OlafLogo } from '@/components/ui/OlafLogo';
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/Toast';
import { useMe, useHealthLogs, useAlerts, useAcknowledgeAlert, useReminders, useConversations } from '@/hooks/useApi';
import { setupPushNotifications, onForegroundMessage } from '@/lib/fcm';

// ── Helpers ──────────────────────────────────────────────────────────────────

function greeting() {
    const h = new Date().getHours();
    return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

function timeAgo(iso: string) {
    try {
        const d = Date.now() - new Date(iso).getTime();
        const m = Math.floor(d / 60000);
        if (m < 1) return 'just now';
        if (m < 60) return `${m}m ago`;
        const h = Math.floor(m / 60);
        if (h < 24) return `${h}h ago`;
        return `${Math.floor(h / 24)}d ago`;
    } catch { return '—'; }
}

function isSameDay(a: Date, b: Date) {
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// ── Calendar component ───────────────────────────────────────────────────────

interface CalendarProps {
    year: number;
    month: number; // 0-indexed
    checkinDates: Set<string>; // ISO date strings (YYYY-MM-DD)
    onPrev: () => void;
    onNext: () => void;
}

function Calendar({ year, month, checkinDates, onPrev, onNext }: CalendarProps) {
    const today = new Date();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const cells: (number | null)[] = [];
    for (let i = 0; i < firstDay; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);

    const canGoNext = !(year === today.getFullYear() && month === today.getMonth());

    return (
        <div className="glass rounded-[22px] p-5">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <button type="button" onClick={onPrev} className="p-2 rounded-xl hover:bg-white/60 transition-colors cursor-pointer" aria-label="Previous month">
                    <ChevronLeft className="w-5 h-5 text-text-secondary" />
                </button>
                <h2 className="text-[17px] font-heading font-extrabold text-text-heading">
                    {MONTH_NAMES[month]} {year}
                </h2>
                <button type="button" onClick={onNext} disabled={!canGoNext} className="p-2 rounded-xl hover:bg-white/60 transition-colors cursor-pointer disabled:opacity-30" aria-label="Next month">
                    <ChevronRight className="w-5 h-5 text-text-secondary" />
                </button>
            </div>

            {/* Day labels */}
            <div className="grid grid-cols-7 mb-1">
                {DAY_LABELS.map(d => (
                    <div key={d} className="text-center text-[11px] font-semibold text-text-muted uppercase py-1" style={{ letterSpacing: '0.05em' }}>
                        {d}
                    </div>
                ))}
            </div>

            {/* Day cells */}
            <div className="grid grid-cols-7 gap-y-1">
                {cells.map((day, i) => {
                    if (day === null) return <div key={`empty-${i}`} />;
                    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                    const isToday = isSameDay(new Date(year, month, day), today);
                    const hasCheckin = checkinDates.has(dateStr);
                    const isPast = new Date(year, month, day) < new Date(today.getFullYear(), today.getMonth(), today.getDate());

                    return (
                        <div key={day} className="flex flex-col items-center py-1.5">
                            <div
                                className={[
                                    'w-9 h-9 rounded-full flex items-center justify-center text-[14px] font-medium transition-all',
                                    isToday ? 'font-bold' : '',
                                    isToday && hasCheckin ? 'bg-emerald-500 text-white' : '',
                                    isToday && !hasCheckin ? 'bg-primary-600 text-white' : '',
                                    !isToday && hasCheckin ? 'bg-emerald-50 text-emerald-700' : '',
                                    !isToday && !hasCheckin && isPast ? 'text-text-muted/50' : '',
                                    !isToday && !hasCheckin && !isPast ? 'text-text-muted' : '',
                                ].join(' ')}
                            >
                                {day}
                            </div>
                            {/* Dot indicator */}
                            <div className="h-1.5 mt-0.5">
                                {hasCheckin && (
                                    <div className={`w-1.5 h-1.5 rounded-full ${isToday ? 'bg-white' : 'bg-emerald-400'}`} />
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Legend */}
            <div className="flex items-center gap-4 mt-3 pt-3 border-t border-white/40">
                <div className="flex items-center gap-1.5 text-[11px] text-text-muted">
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                    Talked
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-text-muted">
                    <div className="w-2.5 h-2.5 rounded-full bg-primary-600" />
                    Today
                </div>
            </div>
        </div>
    );
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function FamilyDashboardPage() {
    const router = useRouter();
    const { user, signOut } = useAuth();
    const { toast } = useToast();
    const [ackId, setAckId] = useState<string | null>(null);

    // Calendar month state
    const today = useMemo(() => new Date(), []);
    const [calYear, setCalYear] = useState(today.getFullYear());
    const [calMonth, setCalMonth] = useState(today.getMonth());

    const { data: meData, isLoading: meLoad } = useMe();
    const profile = meData?.data;

    useEffect(() => { if (!meLoad && profile && profile.role !== 'family') router.replace('/'); }, [meLoad, profile, router]);

    const elder = profile?.linkedAccounts?.find((a) => a.role === 'elderly');
    const eId = elder?.userId ?? '';
    const eName = elder?.name ?? 'Your loved one';

    const { data: todayLogs, isLoading: logLoad } = useHealthLogs(eId, 'today');
    const { data: monthLogs, isLoading: monthLoad } = useHealthLogs(eId, 'month');
    const { data: alertsData, isLoading: alertLoad } = useAlerts(eId);
    const { data: remindersData, isLoading: remLoad } = useReminders(eId);
    const { data: convData } = useConversations(eId, 1);

    const ackMut = useAcknowledgeAlert(eId);
    const todayLog = todayLogs?.data?.logs?.[0] ?? null;
    const allLogs = monthLogs?.data?.logs ?? [];
    const alerts = alertsData?.data?.alerts ?? [];
    const activeAlerts = alerts.filter(a => !a.acknowledged);
    const reminders = remindersData?.data?.reminders ?? [];
    const pendingReminders = reminders.filter(r => r.status === 'pending');
    const lastConv = convData?.data?.conversations?.[0]?.createdAt ?? null;

    // Build set of check-in dates from month logs
    const checkinDates = useMemo(() => {
        const set = new Set<string>();
        for (const log of allLogs) {
            if (log.date) set.add(log.date.slice(0, 10)); // YYYY-MM-DD
        }
        return set;
    }, [allLogs]);

    const handleAck = useCallback((id: string) => {
        setAckId(id);
        ackMut.mutate(id, {
            onSuccess: () => { setAckId(null); toast({ variant: 'success', title: 'Alert acknowledged' }); },
            onError: () => { setAckId(null); toast({ variant: 'error', title: 'Failed to acknowledge' }); },
        });
    }, [ackMut, toast]);

    useEffect(() => {
        if (!user) return;
        setupPushNotifications().catch(() => {});
        const unsub = onForegroundMessage((p) => toast({ variant: 'warning', title: p.title, description: p.body }));
        return () => { unsub?.(); };
    }, [user, toast]);

    const prevMonth = () => {
        if (calMonth === 0) { setCalYear(y => y - 1); setCalMonth(11); }
        else setCalMonth(m => m - 1);
    };
    const nextMonth = () => {
        const now = new Date();
        if (calYear === now.getFullYear() && calMonth === now.getMonth()) return;
        if (calMonth === 11) { setCalYear(y => y + 1); setCalMonth(0); }
        else setCalMonth(m => m + 1);
    };

    // ── Loading state ─────────────────────────────────────────────────────────
    if (meLoad) return (
        <div className="h-dvh bg-bg-page flex items-center justify-center px-4">
            <div className="w-full max-w-[360px] md:max-w-[700px] space-y-5">
                <LoadingSkeleton shape="card" /><LoadingSkeleton shape="card" />
            </div>
        </div>
    );

    // ── No elder linked ───────────────────────────────────────────────────────
    if (!meLoad && profile && !eId) return (
        <div className="h-dvh bg-bg-page flex flex-col items-center justify-center px-4">
            <div className="w-full max-w-[360px] md:max-w-[380px]">
                <div className="text-center mb-3 animate-fade-up">
                    <div className="w-[56px] h-[56px] rounded-[18px] flex items-center justify-center mx-auto mb-2"
                         style={{ background: 'linear-gradient(135deg, #b2dfdb, #80cbc4)', boxShadow: '0 10px 28px rgba(128,203,196,0.25)' }}>
                        <OlafLogo size={32} className="text-teal-700" />
                    </div>
                    <h1 className="text-[22px] md:text-[26px] font-heading font-extrabold text-text-heading" style={{ letterSpacing: '-0.03em' }}>
                        Connect to your loved one
                    </h1>
                    <p className="text-[13px] text-text-muted mt-1">Set up their account so you can stay connected.</p>
                </div>
                <div className="glass rounded-[20px] p-4 md:p-5 animate-fade-up-d1">
                    <button type="button" onClick={() => router.push('/setup-elder')}
                            className="w-full py-2.5 rounded-xl font-heading font-semibold text-[14px] md:text-[15px] text-white min-h-[44px] cursor-pointer active:scale-[0.97] transition-transform duration-150 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary-300"
                            style={{ background: 'linear-gradient(135deg, #00897b, #00796b)', boxShadow: '0 6px 20px rgba(0,137,123,0.2)', letterSpacing: '0.01em' }}>
                        Set up their account
                    </button>
                </div>
                <div className="text-center mt-3 animate-fade-up-d2">
                    <button type="button" onClick={async () => { await signOut(); router.replace('/login'); }}
                            className="text-[12px] text-text-muted hover:text-text-secondary cursor-pointer">
                        Sign out
                    </button>
                </div>
            </div>
        </div>
    );

    // ── Mood helpers ──────────────────────────────────────────────────────────
    const MOOD_EMOJI: Record<string, string> = { happy: '😊', good: '🙂', okay: '😐', sad: '😢', anxious: '😟', tired: '😴', confused: '😵‍💫', pain: '😣' };
    const moodEmoji = MOOD_EMOJI[todayLog?.mood?.toLowerCase() ?? ''] || '❓';
    const painLevel = todayLog?.painLevel ?? null;
    const painColor = painLevel === null ? '#94a3b8' : painLevel <= 3 ? '#10b981' : painLevel <= 6 ? '#f59e0b' : '#ef4444';
    const medsCount = todayLog?.medicationsTaken?.length ?? 0;
    const talkedToday = !!lastConv && new Date(lastConv).toDateString() === new Date().toDateString();
    const hasCheckedInToday = talkedToday;
    const daysSinceLastConv = lastConv ? Math.floor((Date.now() - new Date(lastConv).getTime()) / (1000 * 60 * 60 * 24)) : null;
    const inactiveWarning = daysSinceLastConv !== null && daysSinceLastConv >= 3;

    // ── Dashboard ─────────────────────────────────────────────────────────────
    return (
        <div className="h-dvh bg-bg-page flex flex-col">
            {/* Top bar */}
            <div className="flex items-center justify-between px-4 pt-4 pb-2 md:px-8 md:pt-6">
                <div>
                    <h1 className="text-[20px] md:text-[24px] font-heading font-extrabold text-text-heading" style={{ letterSpacing: '-0.03em' }}>
                        {eName}
                    </h1>
                    <p className="text-[12px] md:text-[13px] text-text-muted">{greeting()}</p>
                </div>
                <button type="button" onClick={async () => { await signOut(); router.replace('/login'); }}
                        className="p-2 rounded-xl text-text-muted hover:bg-white/50 cursor-pointer" aria-label="Sign out">
                    <LogOut className="w-5 h-5" />
                </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-4 pb-6 md:px-8 md:pb-8">
                <div className="max-w-[720px] mx-auto">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">

                        {/* ── Left column ──────────────────────────────────────── */}
                        <div className="space-y-3">
                            {/* Inactivity warning */}
                            {inactiveWarning && (
                                <div className="rounded-[18px] p-3.5 border border-red-200 bg-red-50/70">
                                    <div className="flex items-start gap-2.5">
                                        <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                                            <AlertTriangle className="w-4 h-4 text-red-600" />
                                        </div>
                                        <div>
                                            <p className="text-[13px] font-heading font-bold text-red-800">
                                                {eName} hasn&apos;t used OLAF in {daysSinceLastConv} days
                                            </p>
                                            <p className="text-[12px] text-red-600 mt-0.5">
                                                Consider checking in on them to make sure everything is okay.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Today's status */}
                            <div className={`rounded-[18px] p-3.5 border ${hasCheckedInToday ? 'border-emerald-200 bg-emerald-50/60' : 'border-amber-200 bg-amber-50/60'}`}>
                                <div className="flex items-center gap-2 mb-2.5">
                                    {hasCheckedInToday
                                        ? <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                                        : <AlertTriangle className="w-4 h-4 text-amber-600" />
                                    }
                                    <span className="text-[13px] font-heading font-bold text-text-heading">
                                        {hasCheckedInToday ? 'Talked to OLAF today' : 'Hasn\'t talked to OLAF yet today'}
                                    </span>
                                </div>

                                {/* Last talked */}
                                <div className="flex items-center gap-2 bg-white/60 rounded-[12px] px-3 py-2 mb-2">
                                    <span className="text-[18px]">💬</span>
                                    <div>
                                        <div className="text-[10px] font-semibold text-text-muted uppercase" style={{ letterSpacing: '0.04em' }}>Last talked</div>
                                        <div className="text-[13px] font-heading font-bold text-text-heading">{lastConv ? timeAgo(lastConv) : 'Never'}</div>
                                    </div>
                                </div>

                                {/* Health data */}
                                {todayLog && (
                                    <div className="grid grid-cols-2 gap-1.5">
                                        <div className="flex items-center gap-1.5 bg-white/70 rounded-[12px] px-2.5 py-2">
                                            <span className="text-[18px]">{moodEmoji}</span>
                                            <div>
                                                <div className="text-[9px] font-semibold text-text-muted uppercase" style={{ letterSpacing: '0.04em' }}>Mood</div>
                                                <div className="text-[13px] font-heading font-bold text-text-heading capitalize">{todayLog.mood ?? '—'}</div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1.5 bg-white/70 rounded-[12px] px-2.5 py-2">
                                            <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: `${painColor}18` }}>
                                                <span className="text-[12px] font-heading font-extrabold" style={{ color: painColor }}>{painLevel ?? '—'}</span>
                                            </div>
                                            <div>
                                                <div className="text-[9px] font-semibold text-text-muted uppercase" style={{ letterSpacing: '0.04em' }}>Pain</div>
                                                <div className="text-[13px] font-heading font-bold text-text-heading">{painLevel !== null ? `${painLevel}/10` : '—'}</div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Alerts */}
                            {!alertLoad && activeAlerts.length > 0 && (
                                <div className="glass rounded-[18px] p-3.5">
                                    <div className="flex items-center gap-2 mb-2">
                                        <div className="w-6 h-6 rounded-[8px] flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #fffbeb, #fef2f2)' }}>
                                            <Bell className="w-3 h-3 text-amber-600" />
                                        </div>
                                        <span className="text-[13px] font-heading font-bold text-text-heading">Alerts</span>
                                        <span className="ml-auto inline-flex items-center justify-center w-5 h-5 rounded-full bg-error-600 text-white text-[10px] font-bold">
                                            {activeAlerts.length}
                                        </span>
                                    </div>
                                    <div className="space-y-1.5">
                                        {activeAlerts.slice(0, 3).map(a => (
                                            <div key={a.id} className="flex items-start gap-2 bg-white/60 rounded-xl px-2.5 py-2">
                                                <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${a.severity === 'high' ? 'bg-red-500' : a.severity === 'medium' ? 'bg-amber-500' : 'bg-blue-400'}`} />
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-[12px] font-medium text-text-heading line-clamp-1">{a.title || a.message}</p>
                                                    <p className="text-[10px] text-text-muted">{timeAgo(a.createdAt)}</p>
                                                </div>
                                                <button type="button" onClick={() => handleAck(a.id)} disabled={ackId === a.id}
                                                        className="text-[11px] font-semibold text-primary-600 hover:text-primary-700 px-1.5 py-0.5 rounded-lg hover:bg-primary-50 transition-colors cursor-pointer disabled:opacity-50 flex-shrink-0">
                                                    {ackId === a.id ? '...' : 'Ack'}
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Pending reminders */}
                            {!remLoad && pendingReminders.length > 0 && (
                                <div className="glass rounded-[18px] p-3.5">
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className="text-[16px]">📋</span>
                                        <span className="text-[13px] font-heading font-bold text-text-heading">Reminders</span>
                                        <span className="ml-auto text-[11px] font-semibold text-text-muted bg-white/60 px-1.5 py-0.5 rounded-full">
                                            {pendingReminders.length}
                                        </span>
                                    </div>
                                    <div className="space-y-1.5">
                                        {pendingReminders.slice(0, 4).map(r => (
                                            <div key={r.id} className="flex items-center gap-2 bg-white/60 rounded-xl px-2.5 py-2">
                                                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${r.type === 'medication' ? 'bg-emerald-400' : r.type === 'appointment' ? 'bg-blue-400' : 'bg-amber-400'}`} />
                                                <span className="text-[12px] text-text-heading flex-1 line-clamp-1">{r.message}</span>
                                                {r.scheduledTime && (
                                                    <span className="text-[10px] text-text-muted flex-shrink-0">
                                                        {new Date(r.scheduledTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* ── Right column: Calendar ───────────────────────────── */}
                        <div>
                            <Calendar
                                year={calYear}
                                month={calMonth}
                                checkinDates={checkinDates}
                                onPrev={prevMonth}
                                onNext={nextMonth}
                            />
                        </div>

                    </div>
                </div>
            </div>
        </div>
    );
}
