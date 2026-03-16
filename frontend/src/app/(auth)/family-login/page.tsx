'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth, type UserRole } from '@/contexts/AuthContext';
import { OlafLogo } from '@/components/ui/OlafLogo';
import { api } from '@/lib/api';

/**
 * Family member login page — Google-only auth.
 * Elders use /login with username instead.
 */
export default function FamilyLoginPage() {
    const router = useRouter();
    const { signInWithGoogle, setRole, user, loading: authLoading, role } = useAuth();

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // If already signed in with role set, redirect immediately
    useEffect(() => {
        if (!authLoading && user && role === 'family') {
            router.replace('/dashboard');
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

    const handleGoogle = async () => {
        setError(null);
        setLoading(true);
        try {
            await signInWithGoogle();
            await redirectAfterSignIn();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unable to sign in with Google.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="w-full max-w-[360px] md:max-w-[380px]">
            {/* Branding */}
            <div className="text-center mb-3 animate-fade-up">
                <div className="w-[56px] h-[56px] rounded-[18px] flex items-center justify-center mx-auto mb-2"
                     style={{ background: 'linear-gradient(135deg, #b2dfdb, #80cbc4)', boxShadow: '0 10px 28px rgba(128,203,196,0.25)' }}>
                    <OlafLogo size={32} className="text-teal-700" />
                </div>
                <h1 className="text-[22px] md:text-[26px] font-heading font-extrabold text-text-heading" style={{ letterSpacing: '-0.03em' }}>
                    Family sign in
                </h1>
                <p className="text-[13px] text-text-muted mt-1">
                    Sign in with your Google account to manage your loved one&apos;s OLAF
                </p>
            </div>

            {/* Card */}
            <div className="glass rounded-[20px] p-4 md:p-6 animate-fade-up-d1">
                {error && (
                    <div role="alert" className="mb-3 px-3 py-2 rounded-xl bg-red-50 border border-red-100 text-red-700 text-[12px]">
                        {error}
                    </div>
                )}

                {/* Google sign-in */}
                <button type="button" onClick={handleGoogle} disabled={loading}
                        className="w-full py-3 rounded-xl font-heading font-semibold text-[14px] md:text-[15px] text-primary-700 min-h-[48px] cursor-pointer flex items-center justify-center gap-2.5 active:scale-[0.97] transition-transform duration-150 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary-300 disabled:opacity-60"
                        style={{ background: 'rgba(255,255,255,0.9)', border: '1.5px solid #e2e8f0', boxShadow: '0 2px 10px rgba(15,23,42,0.05)' }}>
                    {loading ? 'Connecting…' : (
                        <>
                            <svg width="18" height="18" viewBox="0 0 24 24">
                                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                            </svg>
                            Continue with Google
                        </>
                    )}
                </button>
            </div>

            {/* Links */}
            <div className="text-center mt-3 space-y-1 animate-fade-up-d2">
                <p className="text-[12px] text-text-muted">
                    <Link href="/login" className="hover:text-text-secondary">Are you an elder? Sign in here →</Link>
                </p>
            </div>
        </div>
    );
}
