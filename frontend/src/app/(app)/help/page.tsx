'use client';

import { useCallback, useState } from 'react';
import { Stethoscope, FileText, ClipboardList, ChevronRight, LogOut, Mic } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/layout/Header';
import { NavigatorSession } from '@/components/navigator/NavigatorSession';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/lib/api';

const TASKS = [
    { icon: Stethoscope, title: 'Book a doctor appointment', desc: 'Find and book your next visit with your GP', templateId: 'book_appointment', task: 'Book a doctor appointment', steps: 7, bg: 'linear-gradient(135deg, #e0f2f1, #b2dfdb)', color: '#00897b' },
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
        <div className="flex flex-col h-dvh">
            <Header title="Help" subtitle="Website assistance" action={
                <button type="button" onClick={async () => { await signOut(); router.replace('/login'); }}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-body-sm font-semibold text-text-muted hover:bg-white/50 min-h-[48px] cursor-pointer">
                    <LogOut className="w-5 h-5" /> Sign out
                </button>
            } />

            <div className="flex-1 flex flex-col justify-center overflow-y-auto px-5 py-6 pb-32 lg:px-12 lg:pb-36">
                <div className="max-w-4xl mx-auto w-full">

                    {error && (
                        <div role="alert" className="mb-4 px-4 py-3 rounded-2xl bg-error-50 border border-error-100 text-error-700 text-body-sm">
                            {error}
                        </div>
                    )}

                    {/* Hero */}
                    <div className="text-center mb-6 animate-fade-up">
                        <div className="w-[60px] h-[60px] lg:w-[72px] lg:h-[72px] rounded-[20px] mx-auto mb-3 flex items-center justify-center"
                             style={{ background: 'linear-gradient(135deg, #eff6ff, #f0fdfa)', border: '1.5px solid #e2e8f0' }}>
                            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#00897b" strokeWidth="1.6" strokeLinecap="round">
                                <circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
                            </svg>
                        </div>
                        <h2 className="text-[20px] lg:text-[24px] font-heading font-extrabold text-text-heading mb-1.5" style={{ letterSpacing: '-0.02em' }}>
                            Need a hand?
                        </h2>
                        <p className="text-[15px] lg:text-[16px] text-text-muted max-w-[320px] lg:max-w-[440px] mx-auto leading-relaxed">
                            OLAF will navigate websites for you, explaining every step in plain language.
                        </p>
                    </div>

                    {/* Task cards — 1 col mobile, 3 col on lg */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-5">
                        {TASKS.map((t, i) => {
                            const Icon = t.icon;
                            const isLoading = loading === t.templateId;
                            return (
                                <button
                                    key={t.templateId}
                                    type="button"
                                    onClick={() => start(t)}
                                    disabled={loading !== null}
                                    className="w-full text-left rounded-[22px] overflow-hidden transition-all duration-300 hover:-translate-y-[3px] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary-300 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0 cursor-pointer group"
                                    style={{
                                        background: 'rgba(255,255,255,0.88)',
                                        backdropFilter: 'blur(24px)',
                                        border: '1px solid rgba(255,255,255,0.7)',
                                        boxShadow: '0 4px 20px rgba(15,23,42,0.04), 0 1px 4px rgba(15,23,42,0.02), inset 0 1px 0 rgba(255,255,255,0.9)',
                                        animation: `fadeUp 0.4s ease ${i * 60}ms forwards`,
                                        opacity: 0,
                                    }}
                                >
                                    <div className="flex items-center gap-3.5 px-4 py-4 lg:flex-col lg:items-start lg:gap-3 lg:px-5 lg:py-5">
                                        <div className="w-12 h-12 lg:w-11 lg:h-11 rounded-[14px] flex items-center justify-center flex-shrink-0 transition-transform duration-200 group-hover:scale-105"
                                             style={{ background: t.bg, color: t.color }}>
                                            {isLoading
                                                ? <div className="w-5 h-5 border-2 border-current/30 border-t-current rounded-full animate-spin" />
                                                : <Icon className="w-5 h-5" />
                                            }
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="text-[16px] font-heading font-bold text-text-heading">{t.title}</div>
                                            <div className="text-[13px] lg:text-[14px] text-text-muted mt-0.5">{t.desc}</div>
                                        </div>
                                        <ChevronRight className="w-[16px] h-[16px] text-text-muted/40 flex-shrink-0 lg:hidden group-hover:text-primary-500 transition-all duration-200" />
                                    </div>
                                </button>
                            );
                        })}
                    </div>

                    {/* Voice hint */}
                    <div className="flex items-center justify-center gap-1.5">
                        <Mic className="w-4 h-4 text-primary-400" />
                        <span className="text-[14px] text-text-muted">
                            Or say <strong className="text-primary-700 font-bold">&ldquo;Help me with…&rdquo;</strong>
                        </span>
                    </div>

                </div>
            </div>
        </div>
    );
}
