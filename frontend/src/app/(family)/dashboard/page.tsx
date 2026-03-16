'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut, Heart, ChevronLeft, ChevronRight, Bell, CheckCircle2, Clock, AlertTriangle } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/Toast';
import { useMe, useHealthLogs, useAlerts, useAcknowledgeAlert, useReminders, useConversations } from '@/hooks/useApi';
import { Button } from '@/components/ui/Button';
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
        <div className="flex flex-col h-dvh">
            <Header title="Loading..." />
            <div className="flex-1 overflow-y-auto px-5 py-5 lg:px-10 lg:py-8">
                <div className="max-w-[500px] mx-auto space-y-5"><LoadingSkeleton shape="card" /><LoadingSkeleton shape="card" /></div>
            </div>
        </div>
    );

    // ── No elder linked ───────────────────────────────────────────────────────
    if (!meLoad && profile && !eId) return (
        <div className="flex flex-col h-dvh">
            <Header title="Family Dashboard" action={
                <button onClick={async () => { await signOut(); router.replace('/login'); }} className="flex items-center gap-2 px-4 py-2 rounded-xl text-body-sm font-semibold text-text-muted hover:bg-white/50 min-h-[48px] cursor-pointer"><LogOut className="w-5 h-5" /> Sign out</button>
            } />
            <div className="flex-1 overflow-y-auto flex items-center justify-center px-6">
                <div className="text-center max-w-sm animate-fade-up">
                    <div className="w-20 h-20 rounded-[22px] mx-auto mb-5 flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #dbeafe, #ccfbf1)' }}>
                        <Heart className="w-9 h-9 text-primary-600" />
                    </div>
                    <h2 className="text-h2 font-heading font-extrabold text-text-heading mb-2">Connect to your loved one</h2>
                    <p className="text-body text-text-muted mb-6">Set up their account so you can stay connected.</p>
                    <Button variant="primary" size="xl" onClick={() => router.push('/setup-elder')}>Set up their account</Button>
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

    // ── Dashboard ─────────────────────────────────────────────────────────────
    return (
        <div className="flex flex-col h-dvh">
            <Header title={`${eName}`} subtitle={greeting()} action={
                <button onClick={async () => { await signOut(); router.replace('/login'); }} className="flex items-center gap-2 px-4 py-2 rounded-xl text-body-sm font-semibold text-text-muted hover:bg-white/50 min-h-[48px] cursor-pointer"><LogOut className="w-5 h-5" /> Sign out</button>
            } />

            <div className="flex-1 overflow-y-auto px-4 pt-4 pb-8 lg:px-10 lg:pt-6 lg:pb-10">
                <div className="max-w-[500px] mx-auto space-y-4">

                    {/* ── Today's status banner ─────────────────────────────── */}
                    <div className={`rounded-[18px] p-4 border ${hasCheckedInToday ? 'border-emerald-200 bg-emerald-50/60' : 'border-amber-200 bg-amber-50/60'}`}
                         style={{ animation: 'fadeUp 0.3s ease forwards' }}>
                        <div className="flex items-center gap-2 mb-3">
                            {hasCheckedInToday
                                ? <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                                : <AlertTriangle className="w-5 h-5 text-amber-600" />
                            }
                            <span className="text-[14px] font-heading font-bold text-text-heading">
                                {hasCheckedInToday ? 'Talked to OLAF today' : 'Hasn\'t talked to OLAF yet today'}
                            </span>
                        </div>

                        {/* Last talked — always show */}
                        <div className="flex items-center gap-2.5 bg-white/60 rounded-[14px] px-3 py-2.5 mb-2">
                            <span className="text-[20px]">💬</span>
                            <div>
                                <div className="text-[11px] font-semibold text-text-muted uppercase" style={{ letterSpacing: '0.04em' }}>Last talked</div>
                                <div className="text-[14px] font-heading font-bold text-text-heading">{lastConv ? timeAgo(lastConv) : 'Never'}</div>
                            </div>
                        </div>

                        {/* Health data — only when there's actual log data */}
                        {todayLog && (
                            <div className="grid grid-cols-3 gap-2">
                                <div className="flex items-center gap-2 bg-white/70 rounded-[14px] px-3 py-2.5">
                                    <span className="text-[20px]">{moodEmoji}</span>
                                    <div>
                                        <div className="text-[10px] font-semibold text-text-muted uppercase" style={{ letterSpacing: '0.04em' }}>Mood</div>
                                        <div className="text-[14px] font-heading font-bold text-text-heading capitalize">{todayLog.mood ?? '—'}</div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 bg-white/70 rounded-[14px] px-3 py-2.5">
                                    <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: `${painColor}18` }}>
                                        <span className="text-[13px] font-heading font-extrabold" style={{ color: painColor }}>{painLevel ?? '—'}</span>
                                    </div>
                                    <div>
                                        <div className="text-[10px] font-semibold text-text-muted uppercase" style={{ letterSpacing: '0.04em' }}>Pain</div>
                                        <div className="text-[14px] font-heading font-bold text-text-heading">{painLevel !== null ? `${painLevel}/10` : '—'}</div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 bg-white/70 rounded-[14px] px-3 py-2.5">
                                    <span className="text-[20px]">💊</span>
                                    <div>
                                        <div className="text-[10px] font-semibold text-text-muted uppercase" style={{ letterSpacing: '0.04em' }}>Meds</div>
                                        <div className="text-[14px] font-heading font-bold text-text-heading">{medsCount}</div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* ── Medication details ───────────────────────────────── */}
                    {todayLog?.medicationsTaken && todayLog.medicationsTaken.length > 0 && (
                        <div className="glass rounded-[18px] p-4" style={{ animation: 'fadeUp 0.35s ease forwards' }}>
                            <div className="flex items-center gap-2 mb-3">
                                <span className="text-[18px]">💊</span>
                                <span className="text-[15px] font-heading font-bold text-text-heading">Medications today</span>
                            </div>
                            <div className="space-y-2">
                                {todayLog.medicationsTaken.map((med, i) => (
                                    <div key={i} className="flex items-center justify-between bg-white/60 rounded-xl px-3 py-2">
                                        <div className="flex items-center gap-2">
                                            {med.confirmed
                                                ? <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                                                : <Clock className="w-4 h-4 text-text-muted" />
                                            }
                                            <span className="text-[14px] font-medium text-text-heading">{med.name}</span>
                                        </div>
                                        <span className="text-[12px] text-text-muted">{med.time}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* ── Alerts ────────────────────────────────────────────── */}
                    {!alertLoad && activeAlerts.length > 0 && (
                        <div className="glass rounded-[18px] p-4" style={{ animation: 'fadeUp 0.4s ease forwards' }}>
                            <div className="flex items-center gap-2 mb-3">
                                <div className="w-7 h-7 rounded-[9px] flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #fffbeb, #fef2f2)' }}>
                                    <Bell className="w-3.5 h-3.5 text-amber-600" />
                                </div>
                                <span className="text-[15px] font-heading font-bold text-text-heading">
                                    Alerts
                                </span>
                                <span className="ml-auto inline-flex items-center justify-center w-5 h-5 rounded-full bg-error-600 text-white text-[11px] font-bold">
                                    {activeAlerts.length}
                                </span>
                            </div>
                            <div className="space-y-2">
                                {activeAlerts.slice(0, 5).map(a => (
                                    <div key={a.id} className="flex items-start gap-3 bg-white/60 rounded-xl px-3 py-2.5">
                                        <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${a.severity === 'high' ? 'bg-red-500' : a.severity === 'medium' ? 'bg-amber-500' : 'bg-blue-400'}`} />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[13px] font-medium text-text-heading line-clamp-2">{a.title || a.message}</p>
                                            <p className="text-[11px] text-text-muted mt-0.5">{timeAgo(a.createdAt)}</p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => handleAck(a.id)}
                                            disabled={ackId === a.id}
                                            className="text-[12px] font-semibold text-primary-600 hover:text-primary-700 px-2 py-1 rounded-lg hover:bg-primary-50 transition-colors cursor-pointer disabled:opacity-50 flex-shrink-0"
                                        >
                                            {ackId === a.id ? '...' : 'Ack'}
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* ── Pending reminders / todos ────────────────────────── */}
                    {!remLoad && pendingReminders.length > 0 && (
                        <div className="glass rounded-[18px] p-4" style={{ animation: 'fadeUp 0.45s ease forwards' }}>
                            <div className="flex items-center gap-2 mb-3">
                                <span className="text-[18px]">📋</span>
                                <span className="text-[15px] font-heading font-bold text-text-heading">Pending reminders</span>
                                <span className="ml-auto text-[12px] font-semibold text-text-muted bg-white/60 px-2 py-0.5 rounded-full">
                                    {pendingReminders.length}
                                </span>
                            </div>
                            <div className="space-y-2">
                                {pendingReminders.slice(0, 6).map(r => (
                                    <div key={r.id} className="flex items-center gap-3 bg-white/60 rounded-xl px-3 py-2.5">
                                        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${r.type === 'medication' ? 'bg-emerald-400' : r.type === 'appointment' ? 'bg-blue-400' : 'bg-amber-400'}`} />
                                        <span className="text-[13px] text-text-heading flex-1 line-clamp-1">{r.message}</span>
                                        {r.scheduledTime && (
                                            <span className="text-[11px] text-text-muted flex-shrink-0">
                                                {new Date(r.scheduledTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* ── Calendar ──────────────────────────────────────────── */}
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
    );
}
