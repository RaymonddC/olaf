'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { UserPlus, User, Mail, Lock, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';

/**
 * Family member registration page.
 * Elders are set up by family members via /setup-elder — they do not register here.
 */
export default function RegisterPage() {
    const router = useRouter();
    const { signUp, setRole } = useAuth();

    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPw, setShowPw] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

    const validate = (): boolean => {
        const errors: Record<string, string> = {};
        if (!name.trim()) errors.name = 'Please enter your full name.';
        if (!email.includes('@')) errors.email = 'Please enter a valid email address.';
        if (password.length < 8) errors.password = 'Password must be at least 8 characters.';
        if (password !== confirmPassword) errors.confirmPassword = 'Passwords do not match.';
        setFieldErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setError(null);
        if (!validate()) return;
        setLoading(true);
        try {
            await signUp(email, password);
            setRole('family');
            await api.post('/api/auth/register', {
                role: 'family',
                name: name.trim(),
                timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                language: 'en',
            });
            router.replace('/link-elder');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unable to create account. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="w-full max-w-[360px] md:max-w-[380px]">
            {/* Branding */}
            <div className="text-center mb-2 animate-fade-up">
                <div className="w-[48px] h-[48px] rounded-[15px] flex items-center justify-center mx-auto mb-1.5"
                     style={{ background: 'linear-gradient(135deg, #6366f1, #4f46e5)', boxShadow: '0 8px 22px rgba(99,102,241,0.25)' }}>
                    <UserPlus className="w-6 h-6 text-white" strokeWidth={1.7} />
                </div>
                <h1 className="text-[20px] md:text-[24px] font-heading font-extrabold text-text-heading" style={{ letterSpacing: '-0.03em' }}>
                    Family account
                </h1>
                <p className="text-[12px] text-text-muted mt-0.5">For family members only — not for elders</p>
            </div>

            {/* Form card */}
            <div className="glass rounded-[20px] p-3.5 md:p-5 animate-fade-up-d1">
                {error && (
                    <div role="alert" className="mb-2.5 px-3 py-2 rounded-xl bg-red-50 border border-red-100 text-red-700 text-[12px]">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} noValidate>
                    {/* Full name */}
                    <div className="mb-2">
                        <label htmlFor="reg-name" className="block text-[11px] md:text-[12px] font-heading font-semibold text-text-secondary mb-1" style={{ letterSpacing: '0.01em' }}>
                            Full name
                        </label>
                        <div className={`relative flex items-center rounded-xl bg-bg-surface-alt/70 border-2 transition-all duration-200 focus-within:shadow-[0_0_0_3px_rgba(99,102,241,0.15)] ${fieldErrors.name ? 'border-red-300' : 'border-transparent focus-within:border-indigo-400'}`}
                             style={{ boxShadow: 'inset 0 1px 3px rgba(15,23,42,0.04)' }}>
                            <User className="absolute left-3 w-3.5 h-3.5 text-text-muted" aria-hidden="true" />
                            <input id="reg-name" type="text" value={name} onChange={(e) => setName(e.target.value)}
                                   placeholder="e.g. Sarah Thompson" required autoComplete="name"
                                   className="w-full pl-8 pr-4 py-2 text-[13px] md:text-[14px] font-body text-text-primary bg-transparent border-none outline-none rounded-xl min-h-[40px] placeholder:text-text-muted/50" />
                        </div>
                        {fieldErrors.name && <p className="mt-0.5 text-[11px] text-red-600">{fieldErrors.name}</p>}
                    </div>

                    {/* Email */}
                    <div className="mb-2">
                        <label htmlFor="reg-email" className="block text-[11px] md:text-[12px] font-heading font-semibold text-text-secondary mb-1" style={{ letterSpacing: '0.01em' }}>
                            Email address
                        </label>
                        <div className={`relative flex items-center rounded-xl bg-bg-surface-alt/70 border-2 transition-all duration-200 focus-within:shadow-[0_0_0_3px_rgba(99,102,241,0.15)] ${fieldErrors.email ? 'border-red-300' : 'border-transparent focus-within:border-indigo-400'}`}
                             style={{ boxShadow: 'inset 0 1px 3px rgba(15,23,42,0.04)' }}>
                            <Mail className="absolute left-3 w-3.5 h-3.5 text-text-muted" aria-hidden="true" />
                            <input id="reg-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                                   placeholder="you@example.com" required autoComplete="email"
                                   className="w-full pl-8 pr-4 py-2 text-[13px] md:text-[14px] font-body text-text-primary bg-transparent border-none outline-none rounded-xl min-h-[40px] placeholder:text-text-muted/50" />
                        </div>
                        {fieldErrors.email && <p className="mt-0.5 text-[11px] text-red-600">{fieldErrors.email}</p>}
                    </div>

                    {/* Password */}
                    <div className="mb-2">
                        <label htmlFor="reg-pw" className="block text-[11px] md:text-[12px] font-heading font-semibold text-text-secondary mb-1" style={{ letterSpacing: '0.01em' }}>
                            Password
                        </label>
                        <div className={`relative flex items-center rounded-xl bg-bg-surface-alt/70 border-2 transition-all duration-200 focus-within:shadow-[0_0_0_3px_rgba(99,102,241,0.15)] ${fieldErrors.password ? 'border-red-300' : 'border-transparent focus-within:border-indigo-400'}`}
                             style={{ boxShadow: 'inset 0 1px 3px rgba(15,23,42,0.04)' }}>
                            <Lock className="absolute left-3 w-3.5 h-3.5 text-text-muted" aria-hidden="true" />
                            <input id="reg-pw" type={showPw ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)}
                                   placeholder="At least 8 characters" required autoComplete="new-password"
                                   className="w-full pl-8 pr-10 py-2 text-[13px] md:text-[14px] font-body text-text-primary bg-transparent border-none outline-none rounded-xl min-h-[40px] placeholder:text-text-muted/50" />
                            <button type="button" onClick={() => setShowPw(!showPw)}
                                    className="absolute right-2 p-1 rounded-lg text-text-muted hover:text-text-secondary min-w-[30px] min-h-[30px] flex items-center justify-center"
                                    aria-label={showPw ? 'Hide password' : 'Show password'}>
                                {showPw ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                            </button>
                        </div>
                        {fieldErrors.password && <p className="mt-0.5 text-[11px] text-red-600">{fieldErrors.password}</p>}
                    </div>

                    {/* Confirm password */}
                    <div className="mb-3">
                        <label htmlFor="reg-confirm" className="block text-[11px] md:text-[12px] font-heading font-semibold text-text-secondary mb-1" style={{ letterSpacing: '0.01em' }}>
                            Confirm password
                        </label>
                        <div className={`relative flex items-center rounded-xl bg-bg-surface-alt/70 border-2 transition-all duration-200 focus-within:shadow-[0_0_0_3px_rgba(99,102,241,0.15)] ${fieldErrors.confirmPassword ? 'border-red-300' : 'border-transparent focus-within:border-indigo-400'}`}
                             style={{ boxShadow: 'inset 0 1px 3px rgba(15,23,42,0.04)' }}>
                            <Lock className="absolute left-3 w-3.5 h-3.5 text-text-muted" aria-hidden="true" />
                            <input id="reg-confirm" type={showConfirm ? 'text' : 'password'} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                                   placeholder="Re-enter your password" required autoComplete="new-password"
                                   className="w-full pl-8 pr-10 py-2 text-[13px] md:text-[14px] font-body text-text-primary bg-transparent border-none outline-none rounded-xl min-h-[40px] placeholder:text-text-muted/50" />
                            <button type="button" onClick={() => setShowConfirm(!showConfirm)}
                                    className="absolute right-2 p-1 rounded-lg text-text-muted hover:text-text-secondary min-w-[30px] min-h-[30px] flex items-center justify-center"
                                    aria-label={showConfirm ? 'Hide password' : 'Show password'}>
                                {showConfirm ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                            </button>
                        </div>
                        {fieldErrors.confirmPassword && <p className="mt-0.5 text-[11px] text-red-600">{fieldErrors.confirmPassword}</p>}
                    </div>

                    {/* Submit */}
                    <button type="submit" disabled={loading}
                            className="w-full py-2.5 rounded-xl font-heading font-semibold text-[14px] text-white min-h-[42px] cursor-pointer disabled:opacity-60 disabled:cursor-wait active:scale-[0.97] transition-transform duration-150 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-300"
                            style={{ background: 'linear-gradient(135deg, #6366f1, #4f46e5)', boxShadow: '0 6px 20px rgba(99,102,241,0.22)', letterSpacing: '0.01em' }}>
                        {loading ? 'Creating account…' : 'Create account'}
                    </button>
                </form>
            </div>

            {/* Links */}
            <div className="text-center mt-2.5 space-y-1 animate-fade-up-d2">
                <p className="text-[13px] md:text-[14px] text-text-secondary">
                    Already have an account?{' '}
                    <Link href="/family-login" className="text-indigo-600 font-heading font-semibold hover:text-indigo-700">Sign in</Link>
                </p>
                <p className="text-[12px] text-text-muted">
                    <Link href="/login" className="hover:text-text-secondary">Are you an elder? Sign in here →</Link>
                </p>
            </div>
        </div>
    );
}
