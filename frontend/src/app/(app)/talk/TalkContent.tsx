'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Mic, MicOff, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { AdkLiveClient, type CompanionStatus, type TranscriptEntry } from '@/lib/adk-live';
import { AudioManager } from '@/lib/audio-manager';
import { CameraToggle } from '@/components/companion/CameraToggle';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080';

const STATUS_MAP: Record<CompanionStatus, { label: string; color: string }> = {
    idle: { label: 'Tap the microphone to begin', color: '#94a3b8' },
    connecting: { label: 'Connecting...', color: '#d97706' },
    listening: { label: 'Listening...', color: '#0d9488' },
    thinking: { label: 'Thinking...', color: '#d97706' },
    speaking: { label: 'OLAF is speaking...', color: '#1a6de0' },
    error: { label: 'Connection lost', color: '#e11d48' },
};

export function TalkContent() {
    const { user, getToken } = useAuth();
    const [status, setStatus] = useState<CompanionStatus>('idle');
    const [active, setActive] = useState(false);
    const [transcripts, setTranscripts] = useState<TranscriptEntry[]>([]);
    const [error, setError] = useState<string | null>(null);

    const clientRef = useRef<AdkLiveClient | null>(null);
    const audioRef = useRef<AudioManager | null>(null);
    const transcriptsRef = useRef<TranscriptEntry[]>([]);
    const sessionStartRef = useRef(0);
    const silenceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const scrollRef = useRef<HTMLDivElement>(null);
    const latestFrameRef = useRef<string | null>(null);

    useEffect(() => { transcriptsRef.current = transcripts; }, [transcripts]);
    useEffect(() => { scrollRef.current?.scrollTo({ top: 9999, behavior: 'smooth' }); }, [transcripts]);
    useEffect(() => () => { clientRef.current?.disconnect(); audioRef.current?.stop(); if (silenceRef.current) clearTimeout(silenceRef.current); }, []);

    const resetSilence = useCallback(() => {
        if (silenceRef.current) clearTimeout(silenceRef.current);
        silenceRef.current = setTimeout(() => {
            if (clientRef.current?.connected) {
                setTranscripts(p => [...p, { role: 'model', text: "Are you still there? Take your time — I'm right here.", timestamp: new Date().toISOString() }]);
            }
        }, 30000);
    }, []);

    const startSession = useCallback(async () => {
        if (!user) return;
        setError(null);
        try {
            const audio = new AudioManager();
            audioRef.current = audio;
            const client = new AdkLiveClient({
                apiBaseUrl: API, getAuthToken: getToken, userId: user.uid,
                callbacks: {
                    onStatusChange: s => { setStatus(s); if (s === 'listening') resetSilence(); },
                    onAudioChunk: b64 => audio.queuePlayback(b64),
                    onTranscript: entry => {
                        setTranscripts(p => {
                            const last = p[p.length - 1];
                            // ADK can send partial then final for the same turn — replace if same role and text extends previous
                            if (last && last.role === entry.role && entry.text.startsWith(last.text)) {
                                return [...p.slice(0, -1), entry];
                            }
                            return [...p, entry];
                        });
                        resetSilence();
                    },
                    onToolCall: name => console.log('[OLAF] tool:', name),
                    onInterrupted: () => { audio.clearPlaybackQueue(); audio.unblockPlayback(); },
                    onTurnComplete: () => audio.unblockPlayback(),
                    onError: err => { console.error(err); setError(err.message); },
                },
            });
            clientRef.current = client;
            await audio.start(
              b64 => client.sendAudio(b64),
              undefined,
              () => setStatus('listening'),
            );
            await client.connect();
            sessionStartRef.current = Date.now();
            setActive(true);
            setTranscripts([{ role: 'model', text: "Hi there! How are you feeling today?", timestamp: new Date().toISOString() }]);
            resetSilence();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to start');
            audioRef.current?.stop(); audioRef.current = null; clientRef.current = null;
        }
    }, [user, getToken, resetSilence]);

    const stopSession = useCallback(async () => {
        if (silenceRef.current) clearTimeout(silenceRef.current);
        clientRef.current?.disconnect(); clientRef.current = null;
        await audioRef.current?.stop(); audioRef.current = null;
        const dur = Math.round((Date.now() - sessionStartRef.current) / 1000);
        const t = transcriptsRef.current;
        if (user && t.length > 0) {
            try {
                const tok = await getToken();
                const h = { 'Content-Type': 'application/json', ...(tok ? { Authorization: `Bearer ${tok}` } : {}) };
                await fetch(`${API}/api/companion/log-conversation`, { method: 'POST', headers: h, body: JSON.stringify({ userId: user.uid, sessionDuration: dur, transcript: t, flags: [] }) });
                const txt = t.map(e => `${e.role === 'user' ? 'User' : 'OLAF'}: ${e.text}`).join('\n');
                const userPhoto = latestFrameRef.current;
                fetch(`${API}/api/storyteller/create-memory`, {
                    method: 'POST', headers: h,
                    body: JSON.stringify({ userId: user.uid, transcript: txt, ...(userPhoto ? { userPhotoBase64: userPhoto } : {}) }),
                }).catch(() => {});
            } catch {}
        }
        setActive(false); setStatus('idle'); setTranscripts([]);
    }, [user, getToken]);

    const toggle = useCallback(() => { active ? stopSession() : startSession(); }, [active, startSession, stopSession]);
    const onFrame = useCallback((jpg: string) => {
        latestFrameRef.current = jpg;
        clientRef.current?.sendVideoFrame(jpg);
    }, []);

    const sc = STATUS_MAP[status];
    const isConn = status === 'connecting';

    return (
        <div className="flex flex-col h-full relative">
            {/* Transcript */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4 lg:px-12 lg:py-8 relative z-[1]">
                {!active && transcripts.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full text-center animate-fade-up">
                        {/* Orb — overflow-visible so the ring is never clipped */}
                        <div className="relative w-[140px] h-[140px] sm:w-[160px] sm:h-[160px] mb-6 overflow-visible">
                            <div className="absolute inset-0 rounded-full animate-spin-slow opacity-50"
                                 style={{ background: 'conic-gradient(from 0deg, #e8f1fd, #ccfbf1, #fef3c740, #e8f1fd)' }} />
                            <div className="absolute inset-2 rounded-full"
                                 style={{ background: 'radial-gradient(circle at 38% 32%, rgba(255,255,255,0.95), rgba(240,247,255,0.9) 60%, rgba(204,251,241,0.7))', boxShadow: '0 16px 64px rgba(26,109,224,0.15), inset 0 -4px 12px rgba(13,148,136,0.06)' }} />
                            <div className="absolute inset-0 flex items-center justify-center">
                                <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-[18px] flex items-center justify-center"
                                     style={{ background: 'linear-gradient(135deg, #1a6de0, #1558b8)', boxShadow: '0 4px 16px rgba(26,109,224,0.18)' }}>
                                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round">
                                        <circle cx="12" cy="10" r="3.5" /><path d="M6.5 19.5c0-3 2.5-5 5.5-5s5.5 2 5.5 5" />
                                    </svg>
                                </div>
                            </div>
                            <div className="absolute top-2 right-5 text-primary-500 animate-twinkle">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0L14.59 8.41L23 12L14.59 15.59L12 24L9.41 15.59L1 12L9.41 8.41Z" /></svg>
                            </div>
                            <div className="absolute bottom-4 left-3 text-accent-500 animate-twinkle-d">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0L14.59 8.41L23 12L14.59 15.59L12 24L9.41 15.59L1 12L9.41 8.41Z" /></svg>
                            </div>
                        </div>
                        <h2 className="text-[24px] sm:text-[28px] font-heading font-extrabold text-text-heading mb-2" style={{ letterSpacing: '-0.02em' }}>Talk to OLAF</h2>
                        <p className="text-[15px] sm:text-[17px] text-text-muted max-w-[280px] sm:max-w-[320px] leading-relaxed">Your companion is here to listen, support, and remember every story you share.</p>
                    </div>
                )}

                {transcripts.map((m, i) => (
                    <div key={`${m.timestamp}-${i}`}
                         className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} mb-3.5 gap-2.5`}
                         style={{ animation: `fadeUp 0.35s ease ${i * 60}ms forwards`, opacity: 0 }}>
                        {m.role === 'model' && (
                            <div className="w-9 h-9 lg:w-11 lg:h-11 rounded-[12px] flex items-center justify-center flex-shrink-0 mt-0.5"
                                 style={{ background: 'linear-gradient(135deg, #1a6de0, #1558b8)', boxShadow: '0 3px 10px rgba(26,109,224,0.15)' }}>
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round">
                                    <circle cx="12" cy="10" r="3.5" /><path d="M6.5 19.5c0-3 2.5-5 5.5-5s5.5 2 5.5 5" />
                                </svg>
                            </div>
                        )}
                        <div
                            className={`max-w-[75%] lg:max-w-[55%] px-5 py-3.5 text-[17px] lg:text-[18px] leading-relaxed ${
                                m.role === 'user'
                                    ? 'rounded-[22px_22px_6px_22px] text-white'
                                    : 'rounded-[22px_22px_22px_6px] text-text-primary'
                            }`}
                            style={m.role === 'user'
                                ? { background: 'linear-gradient(135deg, #1a6de0, #1558b8)', boxShadow: '0 4px 20px rgba(26,109,224,0.18)' }
                                : { background: 'rgba(255,255,255,0.92)', border: '1px solid rgba(241,245,249,0.9)', boxShadow: '0 2px 12px rgba(15,23,42,0.04)', backdropFilter: 'blur(16px)' }
                            }
                        >
                            {m.text}
                        </div>
                    </div>
                ))}
            </div>

            {/* Controls */}
            <div className="relative z-[2] px-5 pb-32 pt-4 text-center">
                {active && (
                    <div className="flex items-center justify-center gap-2 mb-4">
                        <span className="w-2 h-2 rounded-full animate-pulse-dot" style={{ background: sc.color }} />
                        <span className="text-[15px] lg:text-[17px] font-heading font-semibold" style={{ color: sc.color }}>{sc.label}</span>
                    </div>
                )}

                {error && <div role="alert" className="mb-4 px-4 py-3 rounded-2xl bg-error-50 border border-error-100 text-error-700 text-body-sm">{error}</div>}

                <div className="flex items-center justify-center gap-4">
                    {active && <CameraToggle sessionActive={active} onFrame={onFrame} disabled={isConn} />}

                    <div className="relative">
                        {active && (
                            <>
                                <div className="absolute inset-[-16px] rounded-full animate-ripple" style={{ border: `2px solid ${sc.color}20` }} />
                                <div className="absolute inset-[-32px] rounded-full animate-ripple-d1" style={{ border: `1.5px solid ${sc.color}12` }} />
                                <div className="absolute inset-[-48px] rounded-full animate-ripple-d2" style={{ border: `1px solid ${sc.color}08` }} />
                            </>
                        )}
                        <button type="button" onClick={toggle} disabled={isConn || !user} aria-label={active ? 'End conversation' : 'Start talking'}
                                className="relative z-[2] w-[88px] h-[88px] lg:w-[100px] lg:h-[100px] rounded-full flex items-center justify-center cursor-pointer disabled:opacity-60 disabled:cursor-wait active:scale-95 transition-transform duration-150 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary-300"
                                style={{
                                    background: active ? 'linear-gradient(135deg, #e11d48, #be123c)' : 'linear-gradient(135deg, #1a6de0, #1558b8)',
                                    border: '5px solid rgba(255,255,255,0.9)',
                                    boxShadow: active ? '0 8px 40px rgba(225,29,72,0.25)' : '0 8px 40px rgba(26,109,224,0.18)',
                                }}>
                            {isConn ? <Loader2 className="w-8 h-8 lg:w-10 lg:h-10 text-white animate-spin" /> : active ? <MicOff className="w-8 h-8 lg:w-10 lg:h-10 text-white" /> : <Mic className="w-8 h-8 lg:w-10 lg:h-10 text-white" />}
                        </button>
                    </div>

                    {active && <div className="w-12 h-12" />}
                </div>

                <p className="text-[14px] lg:text-[16px] text-text-muted mt-3.5 font-heading font-medium">
                    {active ? 'Tap to end conversation' : 'Tap the microphone to begin'}
                </p>
            </div>
        </div>
    );
}
