'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Mail, Lock, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

export default function LoginPage() {
    const router = useRouter();
    const { signIn } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPw, setShowPw] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

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
        <div className="relative z-[1] min-h-dvh flex items-center justify-center px-5 py-10">
            <div className="w-full max-w-[480px]">
                {/* Branding */}
                <div className="text-center mb-9 animate-fade-up">
                    <div className="relative inline-block mb-5">
                        <div
                            className="w-[88px] h-[88px] rounded-[28px] flex items-center justify-center"
                            style={{ background: 'linear-gradient(135deg, #1a6de0, #1558b8)', boxShadow: '0 16px 48px rgba(26,109,224,0.2)' }}
                        >
                            <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round">
                                <circle cx="12" cy="10" r="3.5" /><path d="M6.5 19.5c0-3 2.5-5 5.5-5s5.5 2 5.5 5" />
                            </svg>
                        </div>
                        <div className="absolute bottom-0.5 right-0.5 w-[22px] h-[22px] rounded-full bg-emerald-500 border-[3px] border-white" style={{ boxShadow: '0 2px 8px rgba(16,185,129,0.3)' }} />
                    </div>
                    <h1 className="text-[32px] font-heading font-extrabold text-text-heading mb-1.5" style={{ letterSpacing: '-0.03em' }}>
                        Welcome to OLAF
                    </h1>
                    <p className="text-[17px] text-text-muted max-w-xs mx-auto leading-relaxed">
                        Your AI care companion — always here, always patient
                    </p>
                </div>

                {/* Form card */}
                <div className="glass rounded-[22px] p-7 md:p-8 animate-fade-up-d1">
                    {error && (
                        <div role="alert" className="mb-5 px-4 py-3 rounded-2xl bg-error-50 border border-error-100 text-error-700 text-body-sm">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-0">
                        {/* Email */}
                        <div className="mb-5">
                            <label htmlFor="login-email" className="block text-[14px] font-heading font-semibold text-text-secondary mb-2" style={{ letterSpacing: '0.01em' }}>
                                Email address
                            </label>
                            <div className="relative flex items-center rounded-2xl bg-bg-surface-alt/70 border-2 border-transparent focus-within:border-primary-400 focus-within:shadow-[0_0_0_4px_#E0F2FE] transition-all duration-200"
                                 style={{ boxShadow: 'inset 0 1px 3px rgba(15,23,42,0.04)' }}>
                                <Mail className="absolute left-4 w-5 h-5 text-text-muted" aria-hidden="true" />
                                <input id="login-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="your@email.com" required autoComplete="email"
                                       className="w-full pl-12 pr-4 py-4 text-[17px] font-body text-text-primary bg-transparent border-none outline-none rounded-2xl min-h-[56px] placeholder:text-text-muted/50" />
                            </div>
                        </div>

                        {/* Password */}
                        <div className="mb-6">
                            <label htmlFor="login-pw" className="block text-[14px] font-heading font-semibold text-text-secondary mb-2" style={{ letterSpacing: '0.01em' }}>
                                Password
                            </label>
                            <div className="relative flex items-center rounded-2xl bg-bg-surface-alt/70 border-2 border-transparent focus-within:border-primary-400 focus-within:shadow-[0_0_0_4px_#E0F2FE] transition-all duration-200"
                                 style={{ boxShadow: 'inset 0 1px 3px rgba(15,23,42,0.04)' }}>
                                <Lock className="absolute left-4 w-5 h-5 text-text-muted" aria-hidden="true" />
                                <input id="login-pw" type={showPw ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter your password" required autoComplete="current-password"
                                       className="w-full pl-12 pr-14 py-4 text-[17px] font-body text-text-primary bg-transparent border-none outline-none rounded-2xl min-h-[56px] placeholder:text-text-muted/50" />
                                <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 p-2 rounded-xl text-text-muted hover:text-text-secondary min-w-[44px] min-h-[44px] flex items-center justify-center" aria-label={showPw ? 'Hide' : 'Show'}>
                                    {showPw ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                </button>
                            </div>
                        </div>

                        {/* Submit */}
                        <button type="submit" disabled={loading}
                                className="w-full py-4 rounded-2xl font-heading font-semibold text-[17px] text-white min-h-[56px] cursor-pointer disabled:opacity-60 disabled:cursor-wait active:scale-[0.97] transition-transform duration-150 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary-300"
                                style={{ background: 'linear-gradient(135deg, #1a6de0, #1558b8)', boxShadow: '0 6px 24px rgba(26,109,224,0.18), 0 2px 6px rgba(15,23,42,0.06)', letterSpacing: '0.01em' }}>
                            {loading ? 'Signing in...' : 'Sign in'}
                        </button>
                    </form>

                    {/* Divider */}
                    <div className="flex items-center gap-3.5 my-5" aria-hidden="true">
                        <div className="flex-1 h-px bg-border" /><span className="text-[13px] text-text-muted font-medium">or continue with</span><div className="flex-1 h-px bg-border" />
                    </div>

                    {/* Google */}
                    <button type="button" className="w-full py-3.5 rounded-2xl font-heading font-semibold text-[15px] text-primary-700 min-h-[48px] cursor-pointer flex items-center justify-center gap-2 active:scale-[0.97] transition-transform duration-150 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary-300"
                            style={{ background: 'rgba(255,255,255,0.9)', border: '1.5px solid #e2e8f0', boxShadow: '0 2px 12px rgba(15,23,42,0.05)', backdropFilter: 'blur(12px)' }}>
                        <svg width="18" height="18" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" /><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" /><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" /><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" /></svg>
                        Google
                    </button>
                </div>

                {/* Links */}
                <div className="text-center mt-6 space-y-2 animate-fade-up-d2">
                    <p className="text-[16px] text-text-secondary">
                        Don&apos;t have an account?{' '}
                        <Link href="/register" className="text-primary-600 font-heading font-semibold hover:text-primary-700">Sign up</Link>
                    </p>
                    <p className="text-[14px] text-text-muted">
                        <Link href="/family-login" className="hover:text-text-secondary">Family member? Open dashboard →</Link>
                    </p>
                </div>
            </div>
        </div>
    );
}