'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Mic, MicOff, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { AdkLiveClient, type CompanionStatus, type TranscriptEntry } from '@/lib/adk-live';
import { AudioManager } from '@/lib/audio-manager';
import { CameraToggle } from '@/components/companion/CameraToggle';
import { OlafLogo } from '@/components/ui/OlafLogo';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080';

const STATUS_MAP: Record<CompanionStatus, { label: string; color: string }> = {
    idle:       { label: '',                      color: '#94a3b8' },
    connecting: { label: 'Getting ready…',        color: '#d97706' },
    listening:  { label: 'Listening…',            color: '#0d9488' },
    thinking:   { label: 'OLAF is thinking…',     color: '#d97706' },
    speaking:   { label: 'OLAF is speaking…',     color: '#00897b' },
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
        // find the longest common prefix and continue typing from there
        // instead of snapping to full text
        if (displayed.length > 0 && !text.startsWith(displayed)) {
            let i = 0;
            while (i < displayed.length && i < text.length && displayed[i] === text[i]) i++;
            if (i > 0) {
                setDisplayed(text.slice(0, i));
                onDisplayed?.(text.slice(0, i));
            } else {
                setDisplayed('');
                onDisplayed?.('');
            }
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

// ── Deduplication helper ─────────────────────────────────────────────────────
// Gemini sends two transcript events per tool call (before and after). The
// second is nearly identical to the first — detect and skip it.
function isDuplicateTranscript(committed: string, newText: string): boolean {
    if (!committed || !newText) return false;
    const norm = (s: string) =>
        s.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim();
    const a = norm(committed);
    const b = norm(newText);
    if (!b || b.length < 10) return false;
    // Full new text is already a substring of committed
    if (a.includes(b)) return true;
    // 60 % suffix of new text already in committed — partial overlap
    const cutoff = Math.floor(b.length * 0.6);
    const suffix = b.slice(b.length - cutoff);
    if (suffix.length >= 10 && a.includes(suffix)) return true;
    return false;
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

    const stopRef              = useRef<() => void>(() => {});
    const userSaidByeRef       = useRef(false);
    const olafSaidByeRef       = useRef(false);
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
                    onStatusChange: s => { setStatus(s); if (s === 'listening' || s === 'speaking') resetSilence(); },
                    onAudioChunk:   b64 => audio.queuePlayback(b64),
                    onTranscript:   entry => {
                        if (entry.role === 'model') {
                            if (olafIgnoreRef.current) return; // stale events after interrupt
                            // Skip partial transcripts — they have garbled spacing
                            // Only use finished transcripts for clean typewriter display
                            if (entry.partial) return;
                            // Finished event — clean, authoritative text
                            const ts = olafTsRef.current || olafLastTsRef.current || entry.timestamp;
                            if (!olafTsRef.current && !olafLastTsRef.current) {
                                olafTsRef.current = ts;
                                olafLastTsRef.current = ts;
                                olafDisplayedRef.current = '';
                                olafCommittedRef.current = '';
                            }
                            // Check for OLAF farewell BEFORE dedup (dedup might skip the text)
                            {
                                const lower = entry.text.toLowerCase();
                                const olafFarewells = ['take care', 'lovely talking', 'nice talking',
                                    'talk again', 'talk soon', 'goodbye', 'good night',
                                    'sweet dreams', 'until next time', 'chat again'];
                                if (olafFarewells.some(f => lower.includes(f))) {
                                    olafSaidByeRef.current = true;
                                }
                            }
                            // Deduplicate — Gemini repeats itself after tool calls
                            if (isDuplicateTranscript(olafCommittedRef.current, entry.text)) {
                                console.log('[OLAF] skipping duplicate transcript:', entry.text.slice(0, 60));
                                return;
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
                            // Detect user farewell — need BOTH user + OLAF farewell to auto-end
                            const lower = entry.text.toLowerCase();
                            const farewells = ['goodbye', 'good bye', 'goodnight', 'good night',
                                'talk to you later', 'see you later', 'i need to go now',
                                'i have to go now', 'i gotta go'];
                            // "bye" as a word boundary (not inside "goodbye" or other words)
                            const byeWord = /\bbye\b/.test(lower);
                            if (byeWord || farewells.some(f => lower.includes(f))) {
                                userSaidByeRef.current = true;
                            }
                        }
                        // (OLAF farewell detection is done above, before dedup)
                        resetSilence();
                    },
                    onReady:        () => {
                        console.log('[OLAF] connection ready — unmuting mic');
                        audio.setMuted(false);
                    },
                    onToolCall:     name => console.log('[OLAF] tool:', name),
                    onToolStart:    () => { audio.blockPlayback(); },
                    onToolEnd:      () => { audio.unblockPlayback(); },
                    onClearAudio:   () => { audio.clearPlaybackQueue(); },
                    onInterrupted:  () => { trimOnInterrupt(); audio.unblockPlayback(); },
                    onTurnComplete: () => {
                        audio.unblockPlayback();
                        olafTsRef.current = '';
                        olafLastTsRef.current = '';
                        olafCommittedRef.current = '';
                        olafDisplayedRef.current = '';
                        olafIgnoreRef.current = false;

                        // End session only when BOTH user said bye AND OLAF said farewell
                        if (userSaidByeRef.current && olafSaidByeRef.current) {
                            userSaidByeRef.current = false;
                            olafSaidByeRef.current = false;
                            setTimeout(() => stopRef.current(), 2000);
                        }
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

            // Start mic capture but mute initially — give OLAF a moment to
            // deliver the greeting before background noise can interrupt.
            await audio.start(
                b64 => client.sendAudio(b64),
                undefined,
                () => { trimOnInterrupt(); setStatus('listening'); }, // client-side VAD
            );
            // Mic starts unmuted — audio must flow to put Gemini in audio mode
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
        userSaidByeRef.current = false;
        olafSaidByeRef.current = false;
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
                fetch(`${API}/api/storyteller/create-memory`, {
                    method: 'POST', headers: h,
                    body: JSON.stringify({ userId: user.uid, transcript: txt }),
                }).catch(() => {});
            } catch {}
        }
        setActive(false); setStatus('idle'); setTranscripts([]);
    }, [user, getToken]);

    void (stopRef.current = stopSession);
    const toggle  = useCallback(() => { active ? stopSession() : startSession(); }, [active, startSession, stopSession]);
    const onFrame = useCallback((jpg: string) => {
        latestFrameRef.current = jpg;
        clientRef.current?.sendVideoFrame(jpg);
    }, []);

    const sc     = STATUS_MAP[status];
    const isConn = status === 'connecting';

    const lastOlaf = [...transcripts].reverse().find(e => e.role === 'model');

    const orbSize  = active ? 100 : 120;
    const iconSize = active ? 40  : 48;

    return (
        <div className="flex flex-col h-full overflow-hidden">

            {/* ── Centre: Orb + transcript ────────────────────────────────── */}
            <div className="flex-1 min-h-0 flex flex-col items-center justify-center px-6">
                <div className="w-full max-w-[420px] lg:max-w-[520px] flex flex-col items-center gap-5 lg:gap-6">

                    {/* Orb */}
                    <div className="relative flex-shrink-0"
                         style={{ width: orbSize, height: orbSize, transition: 'width 0.5s ease, height 0.5s ease' }}>
                        <div className="absolute inset-0 rounded-full animate-spin-slow opacity-50"
                             style={{ background: 'conic-gradient(from 0deg, #e0f2f1, #ccfbf1, #fef3c740, #e0f2f1)' }} />
                        <div className="absolute inset-2 rounded-full"
                             style={{
                                 background: 'radial-gradient(circle at 38% 32%, rgba(255,255,255,0.95), rgba(240,249,248,0.9) 60%, rgba(204,251,241,0.7))',
                                 boxShadow: active
                                     ? `0 0 0 8px ${sc.color}18, 0 16px 48px rgba(0,137,123,0.15)`
                                     : '0 12px 48px rgba(0,137,123,0.10)',
                                 transition: 'box-shadow 0.5s ease',
                             }} />
                        <div className="absolute inset-0 flex items-center justify-center">
                            <div className="rounded-2xl flex items-center justify-center flex-shrink-0"
                                 style={{
                                     width: iconSize, height: iconSize,
                                     background: 'linear-gradient(135deg, #b2dfdb, #80cbc4)',
                                     boxShadow: '0 4px 12px rgba(128,203,196,0.25)',
                                     transition: 'width 0.5s ease, height 0.5s ease',
                                 }}>
                                <OlafLogo size={22} className="text-teal-700" />
                            </div>
                        </div>
                        {!active && (
                            <>
                                <div className="absolute top-1 right-3 text-primary-500 animate-twinkle">
                                    <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0L14.59 8.41L23 12L14.59 15.59L12 24L9.41 15.59L1 12L9.41 8.41Z" /></svg>
                                </div>
                                <div className="absolute bottom-3 left-2 text-accent-500 animate-twinkle-d">
                                    <svg width="8" height="8" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0L14.59 8.41L23 12L14.59 15.59L12 24L9.41 15.59L1 12L9.41 8.41Z" /></svg>
                                </div>
                            </>
                        )}
                    </div>

                    {/* Idle text */}
                    {!active && (
                        <div className="text-center">
                            <h2 className="text-[24px] lg:text-[28px] font-heading font-bold text-text-heading mb-2"
                                style={{ letterSpacing: '-0.01em' }}>
                                Talk to OLAF
                            </h2>
                            <p className="text-[16px] lg:text-[18px] text-text-muted max-w-[300px] leading-relaxed">
                                Press the button below to start talking
                            </p>
                        </div>
                    )}

                    {/* Active: status + typewriter (fixed height so orb stays put) */}
                    {active && (
                        <div className="text-center w-full overflow-hidden" style={{ minHeight: '120px' }}>
                            <p className="text-[14px] lg:text-[15px] font-heading font-semibold mb-3"
                               style={{ color: sc.color, minHeight: '20px', transition: 'color 0.4s ease' }}>
                                {sc.label}
                            </p>

                            {lastOlaf && (
                                <div className="overflow-hidden">
                                    <p className="text-[11px] font-heading font-bold tracking-[0.14em] uppercase mb-2"
                                       style={{ color: '#00897b' }}>
                                        OLAF
                                    </p>
                                    <p className="text-[15px] lg:text-[16px] leading-[1.6] font-medium max-h-[7.5em] overflow-y-auto"
                                       style={{ color: '#1e293b' }}>
                                        <TypewriterText
                                            text={lastOlaf.text}
                                            entryKey={lastOlaf.timestamp}
                                            onDisplayed={t => { olafDisplayedRef.current = t; }}
                                        />
                                    </p>
                                </div>
                            )}
                            {status === 'listening' && !lastOlaf && (
                                <p className="text-[13px] lg:text-[14px] text-text-muted text-center mt-3 animate-pulse">
                                    Go ahead, say something to OLAF!
                                </p>
                            )}
                        </div>
                    )}

                    {/* Error */}
                    {error && (
                        <div role="alert" className="px-5 py-3 rounded-2xl text-center max-w-sm"
                             style={{ background: '#fff1f2', border: '1px solid #fecdd3', color: '#be123c' }}>
                            <p className="text-[15px] font-medium">{error}</p>
                            <p className="text-[13px] mt-1 opacity-75">Please try again</p>
                        </div>
                    )}
                </div>
            </div>

            {/* ── Bottom: Controls ─────────────────────────────────────────── */}
            <div className="flex-shrink-0 flex flex-col items-center gap-2 px-6 pb-28">

                {active && <CameraToggle sessionActive={active} onFrame={onFrame} disabled={isConn} />}

                {/* Mic button */}
                <div className="relative flex-shrink-0">
                    {active && (
                        <>
                            <div className="absolute inset-[-12px] rounded-full animate-ripple" style={{ border: `2px solid ${sc.color}25` }} />
                            <div className="absolute inset-[-24px] rounded-full animate-ripple-d1" style={{ border: `1.5px solid ${sc.color}15` }} />
                        </>
                    )}
                    <button type="button" onClick={toggle} disabled={isConn || !user}
                            aria-label={active ? 'End conversation' : 'Start talking with OLAF'}
                            className="relative z-[2] rounded-full flex items-center justify-center cursor-pointer disabled:opacity-50 disabled:cursor-wait active:scale-95 transition-transform duration-150 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary-300"
                            style={{
                                width: '72px', height: '72px',
                                background: active ? 'linear-gradient(135deg, #e11d48, #be123c)' : 'linear-gradient(135deg, #00897b, #00796b)',
                                border:    '4px solid rgba(255,255,255,0.95)',
                                boxShadow: active ? '0 6px 28px rgba(225,29,72,0.28)' : '0 6px 28px rgba(0,137,123,0.20)',
                            }}>
                        {isConn
                            ? <Loader2 className="w-7 h-7 text-white animate-spin" />
                            : active
                                ? <MicOff className="w-7 h-7 text-white" />
                                : <Mic    className="w-7 h-7 text-white" />}
                    </button>
                </div>

                <p className="text-[14px] lg:text-[15px] font-heading font-semibold text-text-muted text-center">
                    {isConn  ? 'Getting ready…'   :
                     active  ? 'Tap to hang up'   :
                               'Tap to start talking'}
                </p>
            </div>

        </div>
    );
}
