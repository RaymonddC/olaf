'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut, Heart, Bell, Activity } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { PageShell } from '@/components/layout/PageShell';
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton';
import { OverviewCard } from '@/components/family/OverviewCard';
import { AlertSection } from '@/components/family/AlertSection';
import { ReportsSection } from '@/components/family/ReportsSection';
import { HealthLogsView } from '@/components/family/HealthLogsView';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/Toast';
import { useMe, useHealthLogs, useAlerts, useAcknowledgeAlert, useReports, useConversations } from '@/hooks/useApi';
import { Button } from '@/components/ui/Button';
import { setupPushNotifications, onForegroundMessage } from '@/lib/fcm';

function greeting() {
    const h = new Date().getHours();
    return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

export default function FamilyDashboardPage() {
    const router = useRouter();
    const { user, signOut } = useAuth();
    const { toast } = useToast();
    const [ackId, setAckId] = useState<string | null>(null);

    const { data: meData, isLoading: meLoad } = useMe();
    const profile = meData?.data;

    useEffect(() => { if (!meLoad && profile && profile.role !== 'family') router.replace('/'); }, [meLoad, profile, router]);

    const elder = profile?.linkedAccounts?.find((a) => a.role === 'elderly');
    const eId = elder?.userId ?? '';
    const eName = elder?.name ?? 'Your loved one';

    const { data: todayLogs, isLoading: logLoad } = useHealthLogs(eId, 'today');
    const { data: weekLogs, isLoading: weekLoad } = useHealthLogs(eId, 'week');
    const { data: alertsData, isLoading: alertLoad } = useAlerts(eId);
    const { data: reportsData, isLoading: repLoad } = useReports(eId);
    const { data: convData } = useConversations(eId, 1);

    const ackMut = useAcknowledgeAlert(eId);
    const todayLog = todayLogs?.data?.logs?.[0] ?? null;
    const weeklyLogs = weekLogs?.data?.logs ?? [];
    const alerts = alertsData?.data?.alerts ?? [];
    const reports = reportsData?.data?.reports ?? [];
    const lastConv = convData?.data?.conversations?.[0]?.createdAt ?? null;

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

    if (meLoad) return (
        <div className="relative z-[1] min-h-dvh">
            <Header title="Loading..." />
            <PageShell noBottomPad><div className="space-y-6"><LoadingSkeleton shape="card" /><LoadingSkeleton shape="card" /></div></PageShell>
        </div>
    );

    if (!meLoad && profile && !eId) return (
        <div className="relative z-[1] min-h-dvh">
            <Header title="Family Dashboard" action={
                <button onClick={async () => { await signOut(); router.replace('/login'); }} className="flex items-center gap-2 px-4 py-2 rounded-xl text-body-sm font-semibold text-text-muted hover:bg-white/50 min-h-[48px] cursor-pointer"><LogOut className="w-5 h-5" /> Sign out</button>
            } />
            <div className="min-h-[60vh] flex items-center justify-center px-6">
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

    return (
        <div className="relative z-[1] min-h-dvh">
            <Header title={`${eName}'s care`} subtitle={greeting()} action={
                <button onClick={async () => { await signOut(); router.replace('/login'); }} className="flex items-center gap-2 px-4 py-2 rounded-xl text-body-sm font-semibold text-text-muted hover:bg-white/50 min-h-[48px] cursor-pointer"><LogOut className="w-5 h-5" /> Sign out</button>
            } />

            <PageShell noBottomPad>
                <div className="max-w-[800px] mx-auto space-y-5">
                    {/* Status chips */}
                    <div className="flex gap-2 flex-wrap">
                        {[
                            { emoji: '😊', label: todayLog ? `Mood: ${todayLog.mood}` : 'No check-in' },
                            { icon: <Bell className="w-3.5 h-3.5" />, label: `${alerts.filter(a => !a.acknowledged).length} alerts`, dot: alerts.some(a => !a.acknowledged) },
                            { emoji: '💊', label: `${todayLog?.medicationsTaken?.length ?? 0} meds taken` },
                        ].map((c, i) => (
                            <div key={i} className="flex items-center gap-1.5 px-4 py-2 rounded-[14px] text-[14px] font-semibold text-text-secondary"
                                 style={{ background: 'rgba(255,255,255,0.8)', backdropFilter: 'blur(8px)', border: '1px solid rgba(241,245,249,0.9)', boxShadow: '0 1px 4px rgba(15,23,42,0.03)' }}>
                                {c.emoji && <span>{c.emoji}</span>}
                                {c.dot && <span className="w-[7px] h-[7px] rounded-full bg-error-500" />}
                                {c.icon}
                                {c.label}
                            </div>
                        ))}
                    </div>

                    {/* Bento grid */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
                        {[
                            { l: 'Mood', v: todayLog?.mood ?? '—', e: '😊', bg: 'linear-gradient(145deg, #eff6ff, #f0fdfa)' },
                            { l: 'Pain level', v: todayLog?.painLevel != null ? `${todayLog.painLevel}/10` : '—', e: '💪', bg: 'linear-gradient(145deg, #f0fdfa, #fffbeb)' },
                            { l: 'Medications', v: `${todayLog?.medicationsTaken?.length ?? 0} taken`, e: '💊', bg: 'linear-gradient(145deg, #fffbeb, #fef3c7)' },
                            { l: 'Last talked', v: lastConv ? timeAgo(lastConv) : '—', e: '💬', bg: 'linear-gradient(145deg, #eff6ff, #dbeafe)' },
                        ].map((c, i) => (
                            <div key={i} className="rounded-[22px] p-[18px] border border-white/50"
                                 style={{ background: c.bg, boxShadow: '0 4px 20px rgba(15,23,42,0.04), inset 0 1px 0 rgba(255,255,255,0.9)', animation: `fadeUp 0.4s ease ${i * 50}ms forwards`, opacity: 0, backdropFilter: 'blur(24px)' }}>
                                <div className="text-[30px] mb-2">{c.e}</div>
                                <div className="text-[12px] font-semibold text-text-muted uppercase" style={{ letterSpacing: '0.05em' }}>{c.l}</div>
                                <div className="text-[19px] font-heading font-extrabold text-text-heading capitalize">{c.v}</div>
                            </div>
                        ))}
                    </div>

                    <AlertSection alerts={alerts} loading={alertLoad} acknowledgingId={ackId} onAcknowledge={handleAck} />
                    <ReportsSection reports={reports} loading={repLoad} />
                    <HealthLogsView logs={weeklyLogs} loading={weekLoad} />
                </div>
            </PageShell>
        </div>
    );
}

function timeAgo(iso: string) {
    try {
        const d = Date.now() - new Date(iso).getTime();
        const m = Math.floor(d / 60000);
        if (m < 60) return `${m}m ago`;
        const h = Math.floor(m / 60);
        if (h < 24) return `${h}h ago`;
        return `${Math.floor(h / 24)}d ago`;
    } catch { return '—'; }
}