'use client';

import { useState, useEffect, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Users, Mail, Lock, Eye, EyeOff } from 'lucide-react';
import { useAuth, type UserRole } from '@/contexts/AuthContext';
import { api } from '@/lib/api';

/**
 * Family member login page — full auth with Google, redirects based on
 * backend role. Elders use /login instead.
 */
export default function FamilyLoginPage() {
    const router = useRouter();
    const { signIn, signInWithGoogle, setRole, user, loading: authLoading, role } = useAuth();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPw, setShowPw] = useState(false);
    const [loading, setLoading] = useState(false);
    const [googleLoading, setGoogleLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!authLoading && user) {
            router.replace(role === 'family' ? '/dashboard' : '/talk');
        }
    }, [user, authLoading, role, router]);

    const redirectAfterSignIn = async () => {
        try {
            const res = await api.get<{ status: string; data: { role: UserRole; linkedAccounts?: unknown[] } }>('/api/auth/me');
            const backendRole = res.data.role;
            setRole(backendRole);
            const linkedAccounts = res.data.linkedAccounts ?? [];
            if (backendRole === 'family' && linkedAccounts.length === 0) {
                router.replace('/setup-elder');
            } else {
                router.replace('/dashboard');
            }
        } catch {
            router.replace('/complete-profile');
        }
    };

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setError(null);
        setLoading(true);
        try {
            await signIn(email, password);
            await redirectAfterSignIn();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unable to sign in. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleGoogle = async () => {
        setError(null);
        setGoogleLoading(true);
        try {
            await signInWithGoogle();
            await redirectAfterSignIn();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unable to sign in with Google.');
        } finally {
            setGoogleLoading(false);
        }
    };

    return (
        <div className="w-full max-w-[360px] md:max-w-[380px]">
            {/* Branding */}
            <div className="text-center mb-3 animate-fade-up">
                <div className="w-[56px] h-[56px] rounded-[18px] flex items-center justify-center mx-auto mb-2"
                     style={{ background: 'linear-gradient(135deg, #1a6de0, #1558b8)', boxShadow: '0 10px 28px rgba(26,109,224,0.22)' }}>
                    <Users className="w-7 h-7 text-white" strokeWidth={1.6} />
                </div>
                <h1 className="text-[22px] md:text-[26px] font-heading font-extrabold text-text-heading" style={{ letterSpacing: '-0.03em' }}>
                    Family sign in
                </h1>
            </div>

            {/* Form card */}
            <div className="glass rounded-[20px] p-4 md:p-6 animate-fade-up-d1">
                {error && (
                    <div role="alert" className="mb-3 px-3 py-2 rounded-xl bg-red-50 border border-red-100 text-red-700 text-[12px]">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit}>
                    {/* Email */}
                    <div className="mb-2.5">
                        <label htmlFor="fl-email" className="block text-[12px] md:text-[13px] font-heading font-semibold text-text-secondary mb-1" style={{ letterSpacing: '0.01em' }}>
                            Email address
                        </label>
                        <div className="relative flex items-center rounded-xl bg-bg-surface-alt/70 border-2 border-transparent focus-within:border-primary-400 focus-within:shadow-[0_0_0_3px_#E0F2FE] transition-all duration-200"
                             style={{ boxShadow: 'inset 0 1px 3px rgba(15,23,42,0.04)' }}>
                            <Mail className="absolute left-3 w-4 h-4 text-text-muted" aria-hidden="true" />
                            <input id="fl-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                                   placeholder="you@example.com" required autoComplete="email"
                                   className="w-full pl-9 pr-4 py-2.5 text-[14px] md:text-[15px] font-body text-text-primary bg-transparent border-none outline-none rounded-xl min-h-[44px] placeholder:text-text-muted/50" />
                        </div>
                    </div>

                    {/* Password */}
                    <div className="mb-3">
                        <label htmlFor="fl-pw" className="block text-[12px] md:text-[13px] font-heading font-semibold text-text-secondary mb-1" style={{ letterSpacing: '0.01em' }}>
                            Password
                        </label>
                        <div className="relative flex items-center rounded-xl bg-bg-surface-alt/70 border-2 border-transparent focus-within:border-primary-400 focus-within:shadow-[0_0_0_3px_#E0F2FE] transition-all duration-200"
                             style={{ boxShadow: 'inset 0 1px 3px rgba(15,23,42,0.04)' }}>
                            <Lock className="absolute left-3 w-4 h-4 text-text-muted" aria-hidden="true" />
                            <input id="fl-pw" type={showPw ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)}
                                   placeholder="Enter your password" required autoComplete="current-password"
                                   className="w-full pl-9 pr-11 py-2.5 text-[14px] md:text-[15px] font-body text-text-primary bg-transparent border-none outline-none rounded-xl min-h-[44px] placeholder:text-text-muted/50" />
                            <button type="button" onClick={() => setShowPw(!showPw)}
                                    className="absolute right-2 p-1.5 rounded-lg text-text-muted hover:text-text-secondary min-w-[34px] min-h-[34px] flex items-center justify-center"
                                    aria-label={showPw ? 'Hide password' : 'Show password'}>
                                {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                        </div>
                    </div>

                    {/* Submit */}
                    <button type="submit" disabled={loading || googleLoading}
                            className="w-full py-2.5 rounded-xl font-heading font-semibold text-[14px] md:text-[15px] text-white min-h-[44px] cursor-pointer disabled:opacity-60 disabled:cursor-wait active:scale-[0.97] transition-transform duration-150 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary-300"
                            style={{ background: 'linear-gradient(135deg, #1a6de0, #1558b8)', boxShadow: '0 6px 20px rgba(26,109,224,0.2)', letterSpacing: '0.01em' }}>
                        {loading ? 'Signing in…' : 'Sign in'}
                    </button>
                </form>

                {/* Divider */}
                <div className="flex items-center gap-3 my-3" aria-hidden="true">
                    <div className="flex-1 h-px bg-border" />
                    <span className="text-[11px] text-text-muted font-medium">or continue with</span>
                    <div className="flex-1 h-px bg-border" />
                </div>

                {/* Google */}
                <button type="button" onClick={handleGoogle} disabled={loading || googleLoading}
                        className="w-full py-2.5 rounded-xl font-heading font-semibold text-[13px] md:text-[14px] text-primary-700 min-h-[42px] cursor-pointer flex items-center justify-center gap-2 active:scale-[0.97] transition-transform duration-150 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary-300 disabled:opacity-60"
                        style={{ background: 'rgba(255,255,255,0.9)', border: '1.5px solid #e2e8f0', boxShadow: '0 2px 10px rgba(15,23,42,0.05)' }}>
                    {googleLoading ? 'Connecting…' : (
                        <>
                            <svg width="16" height="16" viewBox="0 0 24 24">
                                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                            </svg>
                            Google
                        </>
                    )}
                </button>
            </div>

            {/* Links */}
            <div className="text-center mt-3 space-y-1 animate-fade-up-d2">
                <p className="text-[13px] md:text-[14px] text-text-secondary">
                    New to OLAF?{' '}
                    <Link href="/register" className="text-primary-600 font-heading font-semibold hover:text-primary-700">Create account</Link>
                </p>
                <p className="text-[12px] text-text-muted">
                    <Link href="/login" className="hover:text-text-secondary">Are you an elder? Sign in here →</Link>
                </p>
            </div>
        </div>
    );
}
