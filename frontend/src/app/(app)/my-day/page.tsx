'use client';

import { useMemo } from 'react';
import { Sun, Pill, Calendar, Droplets, Bell, Check, Mic } from 'lucide-react';
import Link from 'next/link';
import { Header } from '@/components/layout/Header';
import { useReminders, type Reminder } from '@/hooks/useApi';
import { useAuth } from '@/contexts/AuthContext';

const TYPE_CONFIG: Record<string, { icon: typeof Pill; label: string; color: string; bg: string }> = {
    medication: { icon: Pill, label: 'Medication', color: '#dc2626', bg: 'rgba(254,226,226,0.6)' },
    appointment: { icon: Calendar, label: 'Appointment', color: '#2563eb', bg: 'rgba(219,234,254,0.6)' },
    hydration: { icon: Droplets, label: 'Hydration', color: '#0891b2', bg: 'rgba(207,250,254,0.6)' },
    custom: { icon: Bell, label: 'Reminder', color: '#d97706', bg: 'rgba(254,243,199,0.6)' },
};

function formatTime(iso: string): string {
    try {
        return new Date(iso).toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
        });
    } catch {
        return '';
    }
}

function getGreeting(): string {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
}

function ReminderCard({ reminder }: { reminder: Reminder }) {
    const config = TYPE_CONFIG[reminder.type] ?? TYPE_CONFIG.custom;
    const Icon = config.icon;
    const isDone = reminder.status === 'acknowledged';

    return (
        <div
            className="flex items-center gap-3 rounded-xl px-4 py-3 transition-all"
            style={{
                background: isDone ? 'rgba(240,253,244,0.6)' : 'rgba(255,255,255,0.75)',
                border: isDone ? '1px solid rgba(187,247,208,0.5)' : '1px solid rgba(255,255,255,0.85)',
                opacity: isDone ? 0.65 : 1,
            }}
        >
            <div
                className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: isDone ? 'rgba(187,247,208,0.5)' : config.bg }}
            >
                {isDone ? (
                    <Check className="w-5 h-5" style={{ color: '#16a34a' }} />
                ) : (
                    <Icon className="w-5 h-5" style={{ color: config.color }} />
                )}
            </div>

            <div className="flex-1 min-w-0">
                <p
                    className="text-[15px] lg:text-[16px] font-heading font-semibold leading-snug truncate"
                    style={{
                        color: isDone ? '#6b7280' : '#1e293b',
                        textDecoration: isDone ? 'line-through' : 'none',
                    }}
                >
                    {reminder.message}
                </p>
                <span className="text-[13px] lg:text-[14px]" style={{ color: isDone ? '#9ca3af' : '#94a3b8' }}>
                    {config.label}{reminder.scheduledTime ? ` · ${formatTime(reminder.scheduledTime)}` : ''}
                </span>
            </div>

            {isDone && (
                <span className="text-[12px] lg:text-[13px] font-heading font-semibold flex-shrink-0" style={{ color: '#16a34a' }}>
                    Done
                </span>
            )}
        </div>
    );
}

function ReminderSkeleton() {
    return (
        <div role="status" aria-busy className="flex items-center gap-3 rounded-xl px-4 py-3"
             style={{ background: 'rgba(255,255,255,0.5)' }}>
            <div className="w-10 h-10 rounded-xl animate-skeleton" style={{ background: 'rgba(148,163,184,0.12)' }} />
            <div className="flex-1 space-y-2">
                <div className="h-4 rounded-md w-3/4 animate-skeleton" style={{ background: 'rgba(148,163,184,0.12)' }} />
                <div className="h-3 rounded-md w-1/3 animate-skeleton" style={{ background: 'rgba(148,163,184,0.08)' }} />
            </div>
        </div>
    );
}

export default function MyDayPage() {
    const { user } = useAuth();
    const { data, isLoading, isError } = useReminders(user?.uid ?? '');

    const reminders = useMemo(() => {
        return (data as { data?: { reminders?: Reminder[] } })?.data?.reminders ?? [];
    }, [data]);

    const pending = reminders.filter(r => r.status !== 'acknowledged');
    const completed = reminders.filter(r => r.status === 'acknowledged');
    const greeting = getGreeting();

    return (
        <div className="flex flex-col h-dvh">
            <Header title="My Day" />

            <div className="flex-1 overflow-y-auto px-5 lg:px-10 pb-32 lg:pb-12">
                <div className="max-w-md lg:max-w-lg mx-auto w-full">

                    {/* Greeting — compact */}
                    <div className="pt-5 lg:pt-6 mb-5 rounded-xl px-4 py-3.5 lg:px-5 lg:py-4 flex items-center gap-3"
                         style={{ background: 'rgba(255,251,235,0.6)', border: '1px solid rgba(254,243,199,0.4)' }}>
                        <Sun className="w-6 h-6 flex-shrink-0" style={{ color: '#d97706' }} />
                        <div>
                            <p className="text-[17px] lg:text-[18px] font-heading font-bold" style={{ color: '#92400e' }}>
                                {greeting}
                            </p>
                            <p className="text-[13px] lg:text-[14px]" style={{ color: '#78716c' }}>
                                {pending.length === 0 && completed.length === 0
                                    ? "No reminders today"
                                    : pending.length === 0
                                        ? `All done! ${completed.length} completed`
                                        : `${pending.length} ${pending.length === 1 ? 'thing' : 'things'} to do`
                                }
                            </p>
                        </div>
                    </div>

                    {/* Loading */}
                    {isLoading && (
                        <div className="space-y-2">
                            {[0, 1, 2].map(i => <ReminderSkeleton key={i} />)}
                        </div>
                    )}

                    {/* Error */}
                    {isError && !isLoading && (
                        <div className="text-center py-8 rounded-xl" style={{ background: 'rgba(254,226,226,0.4)' }}>
                            <p className="text-[15px] lg:text-[16px] font-heading" style={{ color: '#dc2626' }}>
                                Couldn&apos;t load your reminders
                            </p>
                        </div>
                    )}

                    {/* Empty state */}
                    {!isLoading && !isError && reminders.length === 0 && (
                        <div className="text-center py-10 rounded-xl"
                             style={{ background: 'rgba(255,255,255,0.5)', border: '1px solid rgba(241,245,249,0.7)' }}>
                            <Bell className="w-8 h-8 mx-auto mb-3" style={{ color: '#94a3b8' }} />
                            <p className="text-[16px] lg:text-[17px] font-heading font-semibold mb-1 text-text-heading">
                                No reminders yet
                            </p>
                            <p className="text-[14px] lg:text-[15px] mb-5 max-w-xs mx-auto text-text-muted">
                                Tell OLAF what to remember.
                            </p>
                            <Link
                                href="/talk"
                                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-[16px] font-heading font-semibold text-white active:scale-95 transition-transform min-h-[48px]"
                                style={{ background: 'linear-gradient(135deg, #80cbc4, #4db6ac)', boxShadow: '0 4px 16px rgba(77,182,172,0.25)' }}
                            >
                                <Mic className="w-5 h-5" />
                                Talk to OLAF
                            </Link>
                        </div>
                    )}

                    {/* Pending */}
                    {!isLoading && !isError && pending.length > 0 && (
                        <div className="mb-4">
                            <p className="text-[14px] lg:text-[15px] font-heading font-bold text-text-heading mb-2">
                                To do
                            </p>
                            <div className="flex flex-col gap-2">
                                {pending.map((r, i) => (
                                    <div key={r.id} style={{ animation: `fadeUp 0.3s ease ${i * 50}ms forwards`, opacity: 0 }}>
                                        <ReminderCard reminder={r} />
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Completed */}
                    {!isLoading && !isError && completed.length > 0 && (
                        <div className="mb-4">
                            <p className="text-[14px] lg:text-[15px] font-heading font-bold mb-2" style={{ color: '#6b7280' }}>
                                Completed
                            </p>
                            <div className="flex flex-col gap-1.5">
                                {completed.map(r => (
                                    <ReminderCard key={r.id} reminder={r} />
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Voice hint */}
                    {!isLoading && !isError && reminders.length > 0 && (
                        <div className="flex items-center justify-center gap-2 py-4">
                            <Mic className="w-4 h-4" style={{ color: '#4db6ac' }} />
                            <p className="text-[13px] lg:text-[14px]" style={{ color: '#64748b' }}>
                                Tell OLAF <strong style={{ color: '#00695c' }}>&ldquo;I took my medicine&rdquo;</strong> to mark done
                            </p>
                        </div>
                    )}

                </div>
            </div>
        </div>
    );
}
