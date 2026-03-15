'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Mic, MicOff, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { AdkLiveClient, type CompanionStatus, type TranscriptEntry } from '@/lib/adk-live';
import { AudioManager } from '@/lib/audio-manager';
import { CameraToggle } from '@/components/companion/CameraToggle';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080';

const STATUS_MAP: Record<CompanionStatus, { label: string; color: string }> = {
    idle:       { label: '',                      color: '#94a3b8' },
    connecting: { label: 'Getting ready…',        color: '#d97706' },
    listening:  { label: 'Listening…',            color: '#0d9488' },
    thinking:   { label: 'OLAF is thinking…',     color: '#d97706' },
    speaking:   { label: 'OLAF is speaking…',     color: '#1a6de0' },
    error:      { label: 'Something went wrong',  color: '#e11d48' },
};

// ── Typewriter effect ─────────────────────────────────────────────────────────
// Animates text character-by-character. Stays mounted for the whole turn
// (timestamp preserved), so it keeps typing as new partial segments arrive.

// entryKey changes when a new OLAF turn begins — resets the typewriter
// without unmounting the container (no flash/cut between turns).
function TypewriterText({
    text, entryKey, onDisplayed,
}: {
    text: string;
    entryKey: string;
    onDisplayed?: (t: string) => void;
}) {
    const [displayed, setDisplayed] = useState('');
    const prevKeyRef = useRef(entryKey);

    useEffect(() => {
        if (prevKeyRef.current !== entryKey) {
            prevKeyRef.current = entryKey;
            setDisplayed('');
            onDisplayed?.('');
            return;
        }
        // If text changed underneath (clean finished replaced noisy partial),
        // snap forward — user already heard it via audio
        if (displayed.length > 0 && !text.startsWith(displayed)) {
            setDisplayed(text);
            onDisplayed?.(text);
            return;
        }
        if (displayed.length >= text.length) {
            if (displayed !== text) { setDisplayed(text); onDisplayed?.(text); }
            return;
        }
        const next = text[displayed.length];
        const pause = (next === ',' || next === ';') ? 100
                    : (next === '.' || next === '!' || next === '?') ? 160
                    : 28 + Math.random() * 18;
        const t = setTimeout(() => {
            const next = text.slice(0, displayed.length + 1);
            setDisplayed(next);
            onDisplayed?.(next);
        }, pause);
        return () => clearTimeout(t);
    }, [text, displayed, entryKey, onDisplayed]);

    return <>{displayed}</>;
}

// ─────────────────────────────────────────────────────────────────────────────

export function TalkContent() {
    const { user, getToken } = useAuth();
    const [status, setStatus] = useState<CompanionStatus>('idle');
    const [active, setActive] = useState(false);
    const [transcripts, setTranscripts] = useState<TranscriptEntry[]>([]);
    const [error, setError] = useState<string | null>(null);

    const clientRef       = useRef<AdkLiveClient | null>(null);
    const audioRef        = useRef<AudioManager | null>(null);
    const transcriptsRef  = useRef<TranscriptEntry[]>([]);
    const sessionStartRef = useRef(0);
    const silenceRef      = useRef<ReturnType<typeof setTimeout> | null>(null);
    const latestFrameRef  = useRef<string | null>(null);

    const olafTsRef        = useRef('');    // active turn ts
    const olafLastTsRef    = useRef('');    // last entry ts — survives turn_complete
    const olafIgnoreRef    = useRef(false);
    const olafDisplayedRef = useRef('');   // what TypewriterText has typed so far
    const olafCommittedRef = useRef('');   // accumulated clean text from finished events

    useEffect(() => { transcriptsRef.current = transcripts; }, [transcripts]);
    useEffect(() => () => {
        clientRef.current?.disconnect();
        audioRef.current?.stop();
        if (silenceRef.current) clearTimeout(silenceRef.current);
    }, []);

    const resetSilence = useCallback(() => {
        if (silenceRef.current) clearTimeout(silenceRef.current);
        silenceRef.current = setTimeout(() => {
            if (clientRef.current?.connected) {
                setTranscripts(p => [...p, {
                    role: 'model',
                    text: "Are you still there? Take your time — I'm right here.",
                    timestamp: new Date().toISOString(),
                }]);
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
                    onAudioChunk:   b64 => audio.queuePlayback(b64),
                    onTranscript:   entry => {
                        if (entry.role === 'model') {
                            if (olafIgnoreRef.current) return; // stale events after interrupt
                            if (entry.partial) {
                                // First partial → create entry so typewriter starts immediately
                                if (!olafTsRef.current) {
                                    olafTsRef.current = entry.timestamp;
                                    olafLastTsRef.current = entry.timestamp;
                                    olafDisplayedRef.current = '';
                                    olafCommittedRef.current = '';
                                    setTranscripts(p => [...p, {
                                        role: 'model', text: entry.text,
                                        partial: true, timestamp: entry.timestamp,
                                    }]);
                                }
                                // Ignore subsequent partials (noisy text)
                                return;
                            }
                            // Finished event — clean, authoritative text
                            const ts = olafTsRef.current || olafLastTsRef.current || entry.timestamp;
                            if (!olafTsRef.current && !olafLastTsRef.current) {
                                olafTsRef.current = ts;
                                olafLastTsRef.current = ts;
                                olafDisplayedRef.current = '';
                                olafCommittedRef.current = '';
                            }
                            // Accumulate clean finished sub-utterances
                            const newCommitted = olafCommittedRef.current
                                ? olafCommittedRef.current.trimEnd() + ' ' + entry.text
                                : entry.text;
                            olafCommittedRef.current = newCommitted;
                            setTranscripts(p => {
                                const i = p.findIndex(e => e.role === 'model' && e.timestamp === ts);
                                if (i >= 0) {
                                    const next = [...p];
                                    next[i] = { ...p[i], text: newCommitted, partial: false };
                                    return next;
                                }
                                return [...p, { role: 'model', text: newCommitted, partial: false, timestamp: ts }];
                            });
                        } else {
                            setTranscripts(p => [...p, entry]);
                        }
                        resetSilence();
                    },
                    onToolCall:     name => console.log('[OLAF] tool:', name),
                    onInterrupted:  () => { trimOnInterrupt(); audio.unblockPlayback(); },
                    onTurnComplete: () => {
                        audio.unblockPlayback();
                        olafTsRef.current = '';
                        olafIgnoreRef.current = false;
                    },
                    onError:        err => { console.error(err); setError(err.message); },
                },
            });
            clientRef.current = client;

            // Shared trim logic — called by both client-side VAD and server interrupted
            const trimOnInterrupt = () => {
                const ts     = olafLastTsRef.current;
                const spoken = olafDisplayedRef.current.trim();
                olafTsRef.current      = '';
                olafLastTsRef.current  = '';
                olafIgnoreRef.current  = true;
                olafDisplayedRef.current  = '';
                olafCommittedRef.current  = '';
                setTranscripts(p => {
                    if (!ts) return p;
                    if (!spoken) return p.filter(e => !(e.role === 'model' && e.timestamp === ts));
                    return p.map(e =>
                        e.role === 'model' && e.timestamp === ts
                            ? { ...e, text: spoken, partial: false }
                            : e
                    );
                });
            };

            await audio.start(
                b64 => client.sendAudio(b64),
                undefined,
                () => { trimOnInterrupt(); setStatus('listening'); }, // client-side VAD
            );
            await client.connect();
            sessionStartRef.current = Date.now();
            setActive(true);
            setTranscripts([]);
            resetSilence();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to connect. Please try again.');
            audioRef.current?.stop(); audioRef.current = null; clientRef.current = null;
        }
    }, [user, getToken, resetSilence]);

    const stopSession = useCallback(async () => {
        if (silenceRef.current) clearTimeout(silenceRef.current);
        clientRef.current?.disconnect(); clientRef.current = null;
        await audioRef.current?.stop(); audioRef.current = null;
        olafTsRef.current = '';
        olafLastTsRef.current = '';
        olafIgnoreRef.current = false;
        olafDisplayedRef.current = '';
        olafCommittedRef.current = '';
        const dur = Math.round((Date.now() - sessionStartRef.current) / 1000);
        const t = transcriptsRef.current;
        if (user && t.length > 0) {
            try {
                const tok = await getToken();
                const h = { 'Content-Type': 'application/json', ...(tok ? { Authorization: `Bearer ${tok}` } : {}) };
                await fetch(`${API}/api/companion/log-conversation`, {
                    method: 'POST', headers: h,
                    body: JSON.stringify({ userId: user.uid, sessionDuration: dur, transcript: t, flags: [] }),
                });
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

    const toggle  = useCallback(() => { active ? stopSession() : startSession(); }, [active, startSession, stopSession]);
    const onFrame = useCallback((jpg: string) => {
        latestFrameRef.current = jpg;
        clientRef.current?.sendVideoFrame(jpg);
    }, []);

    const sc     = STATUS_MAP[status];
    const isConn = status === 'connecting';

    const lastOlaf = [...transcripts].reverse().find(e => e.role === 'model');

    // Orb size: slightly larger on desktop
    const orbSize  = active ? 180 : 155;
    const iconSize = active ? 64  : 56;

    return (
        <div className="flex flex-col h-full">

            {/* ── Centre content ───────────────────────────────────────────── */}
            <div className="flex-1 min-h-0 flex flex-col items-center justify-center px-6 lg:px-12 overflow-hidden">
                <div className="w-full max-w-[480px] lg:max-w-[600px] flex flex-col items-center">

                    {/* Orb */}
                    <div className="relative flex-shrink-0 mb-6 lg:mb-10"
                         style={{ width: orbSize, height: orbSize, transition: 'width 0.6s ease, height 0.6s ease' }}>
                        <div className="absolute inset-0 rounded-full animate-spin-slow opacity-50"
                             style={{ background: 'conic-gradient(from 0deg, #e8f1fd, #ccfbf1, #fef3c740, #e8f1fd)' }} />
                        <div className="absolute inset-2 rounded-full"
                             style={{
                                 background: 'radial-gradient(circle at 38% 32%, rgba(255,255,255,0.95), rgba(240,247,255,0.9) 60%, rgba(204,251,241,0.7))',
                                 boxShadow: active
                                     ? `0 0 0 10px ${sc.color}18, 0 20px 72px rgba(26,109,224,0.18)`
                                     : '0 16px 64px rgba(26,109,224,0.12)',
                                 transition: 'box-shadow 0.6s ease',
                             }} />
                        <div className="absolute inset-0 flex items-center justify-center">
                            <div className="rounded-[20px] flex items-center justify-center flex-shrink-0"
                                 style={{
                                     width: iconSize, height: iconSize,
                                     background: 'linear-gradient(135deg, #1a6de0, #1558b8)',
                                     boxShadow: '0 4px 16px rgba(26,109,224,0.25)',
                                     transition: 'width 0.6s ease, height 0.6s ease',
                                 }}>
                                <svg width={active ? 32 : 28} height={active ? 32 : 28} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round">
                                    <circle cx="12" cy="10" r="3.5" /><path d="M6.5 19.5c0-3 2.5-5 5.5-5s5.5 2 5.5 5" />
                                </svg>
                            </div>
                        </div>
                        {!active && (
                            <>
                                <div className="absolute top-2 right-5 text-primary-500 animate-twinkle">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0L14.59 8.41L23 12L14.59 15.59L12 24L9.41 15.59L1 12L9.41 8.41Z" /></svg>
                                </div>
                                <div className="absolute bottom-4 left-3 text-accent-500 animate-twinkle-d">
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0L14.59 8.41L23 12L14.59 15.59L12 24L9.41 15.59L1 12L9.41 8.41Z" /></svg>
                                </div>
                            </>
                        )}
                    </div>

                    {/* Idle text */}
                    {!active && (
                        <div className="text-center">
                            <h2 className="text-[28px] lg:text-[36px] font-heading font-bold text-text-heading mb-3"
                                style={{ letterSpacing: '-0.01em' }}>
                                Talk to OLAF
                            </h2>
                            <p className="text-[18px] lg:text-[22px] text-text-muted max-w-[340px] leading-relaxed">
                                Press the big button below to start talking
                            </p>
                        </div>
                    )}

                    {/* Active: status label + typewriter subtitle */}
                    {active && (
                        <div className="text-center w-full">
                            {/* Status label */}
                            <p className="text-[15px] lg:text-[17px] font-heading font-semibold mb-4 lg:mb-6"
                               style={{ color: sc.color, minHeight: '24px', transition: 'color 0.4s ease' }}>
                                {sc.label}
                            </p>

                            {/* OLAF subtitle — typewriter, no remount between turns */}
                            {lastOlaf && (
                                <div>
                                    <p className="text-[12px] lg:text-[13px] font-heading font-bold tracking-[0.14em] uppercase mb-3"
                                       style={{ color: '#1a6de0' }}>
                                        OLAF
                                    </p>
                                    <p className="text-[22px] lg:text-[28px] leading-[1.55] font-medium"
                                       style={{ color: '#1e293b', minHeight: '1.55em' }}>
                                        <TypewriterText
                                            text={lastOlaf.text}
                                            entryKey={lastOlaf.timestamp}
                                            onDisplayed={t => { olafDisplayedRef.current = t; }}
                                        />
                                    </p>
                                </div>
                            )}

                        </div>
                    )}

                    {/* Error */}
                    {error && (
                        <div role="alert" className="mt-6 px-6 py-4 rounded-2xl text-center max-w-sm"
                             style={{ background: '#fff1f2', border: '1px solid #fecdd3', color: '#be123c' }}>
                            <p className="text-[17px] font-medium">{error}</p>
                            <p className="text-[14px] mt-1 opacity-75">Please try again</p>
                        </div>
                    )}
                </div>
            </div>

            {/* ── Controls ─────────────────────────────────────────────────── */}
            <div className="flex-shrink-0 flex flex-col items-center gap-3 lg:gap-4 px-6 pt-2 pb-[130px] lg:pb-[120px]">

                {active && <CameraToggle sessionActive={active} onFrame={onFrame} disabled={isConn} />}

                {/* Big mic button */}
                <div className="relative flex-shrink-0">
                    {active && (
                        <>
                            <div className="absolute inset-[-16px] rounded-full animate-ripple" style={{ border: `2px solid ${sc.color}25` }} />
                            <div className="absolute inset-[-32px] rounded-full animate-ripple-d1" style={{ border: `1.5px solid ${sc.color}15` }} />
                        </>
                    )}
                    <button type="button" onClick={toggle} disabled={isConn || !user}
                            aria-label={active ? 'End conversation' : 'Start talking with OLAF'}
                            className="relative z-[2] rounded-full flex items-center justify-center cursor-pointer disabled:opacity-50 disabled:cursor-wait active:scale-95 transition-transform duration-150 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary-300"
                            style={{
                                width: '96px', height: '96px',
                                background: active ? 'linear-gradient(135deg, #e11d48, #be123c)' : 'linear-gradient(135deg, #1a6de0, #1558b8)',
                                border:    '5px solid rgba(255,255,255,0.95)',
                                boxShadow: active ? '0 8px 40px rgba(225,29,72,0.30)' : '0 8px 40px rgba(26,109,224,0.22)',
                            }}>
                        {isConn
                            ? <Loader2 className="w-9 h-9 text-white animate-spin" />
                            : active
                                ? <MicOff className="w-9 h-9 text-white" />
                                : <Mic    className="w-9 h-9 text-white" />}
                    </button>
                </div>

                {/* Button label */}
                <p className="text-[16px] lg:text-[18px] font-heading font-semibold text-text-muted text-center">
                    {isConn  ? 'Getting ready…'   :
                     active  ? 'Tap to hang up'   :
                               'Tap to start talking'}
                </p>
            </div>

        </div>
    );
}
