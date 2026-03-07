'use client';

import { useCallback, useState } from 'react';
import { Stethoscope, FileText, ClipboardList, ChevronRight, LogOut, Mic } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/layout/Header';
import { PageShell } from '@/components/layout/PageShell';
import { NavigatorSession } from '@/components/navigator/NavigatorSession';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/lib/api';

const TASKS = [
    { icon: Stethoscope, title: 'Book a doctor appointment', desc: 'Find and book your next visit with your GP', templateId: 'book_appointment', task: 'Book a doctor appointment', steps: 7, bg: 'linear-gradient(135deg, #eff6ff, #dbeafe)', color: '#1a6de0' },
    { icon: FileText, title: 'Check pension status', desc: 'View your latest benefits and pension info', templateId: 'pension_check', task: 'Check pension status', steps: 5, bg: 'linear-gradient(135deg, #f0fdfa, #ccfbf1)', color: '#0d9488' },
    { icon: ClipboardList, title: 'Read medical report', desc: 'Get a plain-language summary of documents', templateId: 'read_report', task: 'Read medical report', steps: 5, bg: 'linear-gradient(135deg, #fffbeb, #fef3c7)', color: '#d97706' },
] as const;

export default function HelpPage() {
    const router = useRouter();
    const { signOut } = useAuth();
    const [session, setSession] = useState<{ sessionId: string; websocketUrl: string; task: string; totalSteps: number } | null>(null);
    const [loading, setLoading] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const start = useCallback(async (t: typeof TASKS[number]) => {
        setLoading(t.templateId); setError(null);
        try {
            const res = await api.post<{ status: string; data: { sessionId: string; websocketUrl: string } }>('/api/navigator/start', { userId: 'current', task: t.task, templateId: t.templateId });
            setSession({ sessionId: res.data.sessionId, websocketUrl: res.data.websocketUrl, task: t.task, totalSteps: t.steps });
        } catch { setError('Could not start. Please try again.'); } finally { setLoading(null); }
    }, []);

    const close = useCallback(async () => {
        if (session) { try { await api.post(`/api/navigator/stop/${session.sessionId}`); } catch {} }
        setSession(null);
    }, [session]);

    if (session) return <NavigatorSession sessionId={session.sessionId} websocketUrl={session.websocketUrl} task={session.task} totalSteps={session.totalSteps} onClose={close} />;

    return (
        <>
            <Header title="Help" subtitle="Website assistance" />
            <PageShell id="help-content">
                {error && <div role="alert" className="mb-5 px-4 py-3 rounded-2xl bg-error-50 border border-error-100 text-error-700 text-body-sm">{error}</div>}

                {/* Hero */}
                <div className="text-center mb-7 animate-fade-up">
                    <div className="w-[72px] h-[72px] rounded-[22px] mx-auto mb-4 flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #eff6ff, #f0fdfa)', border: '1.5px solid #e2e8f0' }}>
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#1a6de0" strokeWidth="1.6" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
                    </div>
                    <p className="text-[17px] text-text-muted max-w-[320px] mx-auto leading-relaxed">
                        OLAF will navigate websites for you, explaining every step in plain language.
                    </p>
                </div>

                {/* Task cards */}
                <div className="grid grid-cols-1 gap-3.5">
                    {TASKS.map((t, i) => {
                        const Icon = t.icon;
                        const isLoading = loading === t.templateId;
                        return (
                            <button key={t.templateId} type="button" onClick={() => start(t)} disabled={loading !== null}
                                    className="w-full text-left rounded-[22px] overflow-hidden transition-all duration-300 hover:-translate-y-[3px] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary-300 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0 cursor-pointer group"
                                    style={{
                                        background: 'rgba(255,255,255,0.88)', backdropFilter: 'blur(24px)', border: '1px solid rgba(255,255,255,0.7)',
                                        boxShadow: '0 4px 20px rgba(15,23,42,0.04), 0 1px 4px rgba(15,23,42,0.02), inset 0 1px 0 rgba(255,255,255,0.9)',
                                        animation: `fadeUp 0.4s ease ${i * 60}ms forwards`, opacity: 0,
                                    }}>
                                <div className="flex items-center gap-4 px-5 py-4">
                                    <div className="w-14 h-14 rounded-[18px] flex items-center justify-center flex-shrink-0 transition-transform duration-200 group-hover:scale-105"
                                         style={{ background: t.bg, color: t.color }}>
                                        {isLoading ? <div className="w-6 h-6 border-2 border-current/30 border-t-current rounded-full animate-spin" /> : <Icon className="w-6 h-6" />}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="text-[17px] font-heading font-bold text-text-heading">{t.title}</div>
                                        <div className="text-[15px] text-text-muted mt-0.5">{t.desc}</div>
                                    </div>
                                    <ChevronRight className="w-[18px] h-[18px] text-text-muted/40 flex-shrink-0 group-hover:text-primary-500 group-hover:translate-x-0.5 transition-all duration-200" />
                                </div>
                            </button>
                        );
                    })}
                </div>

                {/* Voice hint */}
                <div className="flex items-center justify-center gap-1.5 mt-7">
                    <Mic className="w-4 h-4 text-primary-400" />
                    <span className="text-[15px] text-text-muted">Or say <strong className="text-primary-700 font-bold">&ldquo;Help me with…&rdquo;</strong></span>
                </div>

                {/* Sign out */}
                <div className="mt-10 pt-6 border-t border-border/40">
                    <button type="button" onClick={async () => { await signOut(); router.replace('/login'); }}
                            className="flex items-center gap-3 w-full px-4 py-3 rounded-2xl text-body text-text-muted hover:bg-white/50 transition-colors duration-150 min-h-[48px] cursor-pointer">
                        <LogOut className="w-5 h-5" /> Sign out
                    </button>
                </div>
            </PageShell>
        </>
    );
}