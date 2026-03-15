'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Mail, Lock, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

export default function LoginPage() {
    const router = useRouter();
    const { signIn, user, loading: authLoading, role } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPw, setShowPw] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!authLoading && user) {
            router.replace(role === 'family' ? '/dashboard' : '/talk');
        }
    }, [user, authLoading, role, router]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        try {
            await signIn(email, password);
            router.replace('/talk');
        } catch (err) {
            setError(err instanceof Error ? (err.message.includes('invalid') ? 'Incorrect email or password.' : err.message) : 'Something went wrong.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="w-full max-w-[360px] md:max-w-[380px]">
            {/* Branding */}
            <div className="text-center mb-3 animate-fade-up">
                <div className="relative inline-block mb-2">
                    <div className="w-[56px] h-[56px] rounded-[18px] flex items-center justify-center"
                         style={{ background: 'linear-gradient(135deg, #1a6de0, #1558b8)', boxShadow: '0 10px 28px rgba(26,109,224,0.22)' }}>
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round">
                            <circle cx="12" cy="10" r="3.5" /><path d="M6.5 19.5c0-3 2.5-5 5.5-5s5.5 2 5.5 5" />
                        </svg>
                    </div>
                    <div className="absolute bottom-0.5 right-0.5 w-[15px] h-[15px] rounded-full bg-emerald-500 border-2 border-white" />
                </div>
                <h1 className="text-[22px] md:text-[26px] font-heading font-extrabold text-text-heading" style={{ letterSpacing: '-0.03em' }}>
                    Welcome to OLAF
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
                        <label htmlFor="login-email" className="block text-[12px] md:text-[13px] font-heading font-semibold text-text-secondary mb-1" style={{ letterSpacing: '0.01em' }}>
                            Email address
                        </label>
                        <div className="relative flex items-center rounded-xl bg-bg-surface-alt/70 border-2 border-transparent focus-within:border-primary-400 focus-within:shadow-[0_0_0_3px_#E0F2FE] transition-all duration-200"
                             style={{ boxShadow: 'inset 0 1px 3px rgba(15,23,42,0.04)' }}>
                            <Mail className="absolute left-3 w-4 h-4 text-text-muted" aria-hidden="true" />
                            <input id="login-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                                   placeholder="your@email.com" required autoComplete="email"
                                   className="w-full pl-9 pr-4 py-2.5 text-[14px] md:text-[15px] font-body text-text-primary bg-transparent border-none outline-none rounded-xl min-h-[44px] placeholder:text-text-muted/50" />
                        </div>
                    </div>

                    {/* Password */}
                    <div className="mb-3">
                        <label htmlFor="login-pw" className="block text-[12px] md:text-[13px] font-heading font-semibold text-text-secondary mb-1" style={{ letterSpacing: '0.01em' }}>
                            Password
                        </label>
                        <div className="relative flex items-center rounded-xl bg-bg-surface-alt/70 border-2 border-transparent focus-within:border-primary-400 focus-within:shadow-[0_0_0_3px_#E0F2FE] transition-all duration-200"
                             style={{ boxShadow: 'inset 0 1px 3px rgba(15,23,42,0.04)' }}>
                            <Lock className="absolute left-3 w-4 h-4 text-text-muted" aria-hidden="true" />
                            <input id="login-pw" type={showPw ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)}
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
                    <button type="submit" disabled={loading}
                            className="w-full py-2.5 rounded-xl font-heading font-semibold text-[14px] md:text-[15px] text-white min-h-[44px] cursor-pointer disabled:opacity-60 disabled:cursor-wait active:scale-[0.97] transition-transform duration-150 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary-300"
                            style={{ background: 'linear-gradient(135deg, #1a6de0, #1558b8)', boxShadow: '0 6px 20px rgba(26,109,224,0.2)', letterSpacing: '0.01em' }}>
                        {loading ? 'Signing in…' : 'Sign in'}
                    </button>
                </form>
            </div>

            {/* Links */}
            <div className="text-center mt-3 space-y-1 animate-fade-up-d2">
                <p className="text-[12px] text-text-muted">
                    <Link href="/family-login" className="hover:text-text-secondary">Family member? Sign in here →</Link>
                </p>
            </div>
        </div>
    );
}
