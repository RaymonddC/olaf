'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Copy, Check } from 'lucide-react';
import { OlafLogo } from '@/components/ui/OlafLogo';
import { api } from '@/lib/api';

const RELATIONSHIPS = [
  { value: 'son', label: 'Son' },
  { value: 'daughter', label: 'Daughter' },
  { value: 'spouse', label: 'Spouse / Partner' },
  { value: 'caregiver', label: 'Caregiver' },
  { value: 'other', label: 'Other' },
] as const;

type Relationship = (typeof RELATIONSHIPS)[number]['value'];

interface CreatedAccount {
  username: string;
  tempPassword: string;
  elderUserId: string;
}

export default function SetupElderPage() {
  const router = useRouter();

  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [age, setAge] = useState('');
  const [relationship, setRelationship] = useState<Relationship>('daughter');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<CreatedAccount | null>(null);
  const [copiedUsername, setCopiedUsername] = useState(false);
  const [copiedPassword, setCopiedPassword] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!name.trim()) { setError('Please enter their name.'); return; }

    const u = username.trim().toLowerCase();
    if (u.length < 3) { setError('Username must be at least 3 characters.'); return; }
    if (!/^[a-z0-9._]+$/.test(u)) { setError('Username can only contain letters, numbers, dots, and underscores.'); return; }

    setLoading(true);
    try {
      const res = await api.post<{ status: string; data: { elderUserId: string; username: string; tempPassword: string } }>(
        '/api/auth/create-elder-account',
        {
          name: name.trim(),
          username: u,
          relationship,
          age: age ? Number(age) : undefined,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          language: 'en',
        },
      );
      setCreated({
        elderUserId: res.data.elderUserId,
        username: res.data.username,
        tempPassword: res.data.tempPassword,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create account. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const copy = (text: string, which: 'username' | 'password') => {
    navigator.clipboard.writeText(text).then(() => {
      if (which === 'username') {
        setCopiedUsername(true);
        setTimeout(() => setCopiedUsername(false), 2000);
      } else {
        setCopiedPassword(true);
        setTimeout(() => setCopiedPassword(false), 2000);
      }
    });
  };

  // ── Success screen ────────────────────────────────────────────────────────
  if (created) {
    return (
      <div className="h-dvh bg-bg-page flex flex-col items-center justify-center px-4">
        <div className="w-full max-w-[360px] md:max-w-[440px]">
          <div className="text-center mb-3">
            <div className="w-[56px] h-[56px] rounded-[18px] flex items-center justify-center mx-auto mb-2"
                 style={{ background: 'linear-gradient(135deg, #10b981, #059669)', boxShadow: '0 10px 28px rgba(16,185,129,0.22)' }}>
              <Check className="w-7 h-7 text-white" strokeWidth={1.6} />
            </div>
            <h1 className="text-[22px] md:text-[26px] font-heading font-extrabold text-text-heading" style={{ letterSpacing: '-0.03em' }}>
              Account created!
            </h1>
            <p className="text-[13px] text-text-muted mt-1">
              Use these credentials to sign in on <strong className="text-text-primary">{name.trim()}</strong>&apos;s device.
            </p>
          </div>

          <div className="glass rounded-[20px] p-4 md:p-5 space-y-3">
            {/* Username */}
            <div className="rounded-xl bg-bg-surface-alt/70 px-3 py-2.5" style={{ boxShadow: 'inset 0 1px 3px rgba(15,23,42,0.04)' }}>
              <p className="text-[11px] font-semibold text-text-muted uppercase mb-0.5" style={{ letterSpacing: '0.04em' }}>Username</p>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[15px] font-mono text-text-primary truncate">{created.username}</span>
                <button type="button" onClick={() => copy(created.username, 'username')}
                        className="flex-shrink-0 p-1.5 rounded-lg hover:bg-white/80 transition-colors cursor-pointer" aria-label="Copy username">
                  {copiedUsername ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4 text-text-muted" />}
                </button>
              </div>
            </div>

            {/* Temp password */}
            <div className="rounded-xl bg-bg-surface-alt/70 px-3 py-2.5" style={{ boxShadow: 'inset 0 1px 3px rgba(15,23,42,0.04)' }}>
              <p className="text-[11px] font-semibold text-text-muted uppercase mb-0.5" style={{ letterSpacing: '0.04em' }}>Temporary password</p>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[15px] font-mono text-text-primary tracking-widest">{created.tempPassword}</span>
                <button type="button" onClick={() => copy(created.tempPassword, 'password')}
                        className="flex-shrink-0 p-1.5 rounded-lg hover:bg-white/80 transition-colors cursor-pointer" aria-label="Copy password">
                  {copiedPassword ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4 text-text-muted" />}
                </button>
              </div>
            </div>

            {/* Warning */}
            <div className="rounded-xl bg-amber-50 border border-amber-100 px-3 py-2">
              <p className="text-[12px] text-amber-800 font-medium">Save these credentials — OLAF won&apos;t show the password again.</p>
            </div>

            {/* Submit */}
            <button type="button" onClick={() => router.replace('/dashboard')}
                    className="w-full py-2.5 rounded-xl font-heading font-semibold text-[14px] md:text-[15px] text-white min-h-[44px] cursor-pointer active:scale-[0.97] transition-transform duration-150 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary-300"
                    style={{ background: 'linear-gradient(135deg, #00897b, #00796b)', boxShadow: '0 6px 20px rgba(0,137,123,0.2)', letterSpacing: '0.01em' }}>
              Go to my dashboard
            </button>
          </div>

          <div className="text-center mt-3">
            <p className="text-[12px] text-text-muted">
              Open OLAF on their device and enter credentials above
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── Setup form ─────────────────────────────────────────────────────────────
  const inputCls = "w-full pl-3 pr-3 py-2 text-[14px] md:text-[15px] font-body text-text-primary bg-transparent border-none outline-none rounded-xl min-h-[40px] placeholder:text-text-muted/50";
  const fieldCls = "rounded-xl bg-bg-surface-alt/70 border-2 border-transparent focus-within:border-primary-400 focus-within:shadow-[0_0_0_3px_#B2DFDB] transition-all duration-200";

  return (
    <div className="h-dvh bg-bg-page flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-[360px] md:max-w-[380px]">
        {/* Branding */}
        <div className="text-center mb-2 animate-fade-up">
          <div className="w-[48px] h-[48px] rounded-[16px] flex items-center justify-center mx-auto mb-1.5"
               style={{ background: 'linear-gradient(135deg, #b2dfdb, #80cbc4)', boxShadow: '0 10px 28px rgba(128,203,196,0.25)' }}>
            <OlafLogo size={28} className="text-teal-700" />
          </div>
          <h1 className="text-[20px] md:text-[24px] font-heading font-extrabold text-text-heading" style={{ letterSpacing: '-0.03em' }}>
            Set up their account
          </h1>
          <p className="text-[12px] text-text-muted mt-0.5">
            Create an OLAF account for your loved one
          </p>
        </div>

        {/* Card */}
        <div className="glass rounded-[20px] p-4 animate-fade-up-d1">
          {error && (
            <div role="alert" className="mb-2 px-3 py-1.5 rounded-xl bg-red-50 border border-red-100 text-red-700 text-[12px]">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            {/* Name & Username row */}
            <div className="grid grid-cols-2 gap-2 mb-2">
              <div>
                <label className="block text-[11px] md:text-[12px] font-heading font-semibold text-text-secondary mb-0.5" style={{ letterSpacing: '0.01em' }}>
                  Their full name
                </label>
                <div className={fieldCls} style={{ boxShadow: 'inset 0 1px 3px rgba(15,23,42,0.04)' }}>
                  <input type="text" value={name} onChange={(e) => setName(e.target.value)}
                         placeholder="e.g. Margaret" required autoComplete="name" className={inputCls} />
                </div>
              </div>
              <div>
                <label className="block text-[11px] md:text-[12px] font-heading font-semibold text-text-secondary mb-0.5" style={{ letterSpacing: '0.01em' }}>
                  Username
                </label>
                <div className={fieldCls} style={{ boxShadow: 'inset 0 1px 3px rgba(15,23,42,0.04)' }}>
                  <input type="text" value={username} onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9._]/g, ''))}
                         placeholder="e.g. margaret.t" required autoComplete="off" className={inputCls} />
                </div>
              </div>
            </div>

            {/* Age */}
            <div className="mb-2">
              <label className="block text-[11px] md:text-[12px] font-heading font-semibold text-text-secondary mb-0.5" style={{ letterSpacing: '0.01em' }}>
                Their age (optional)
              </label>
              <div className={fieldCls} style={{ boxShadow: 'inset 0 1px 3px rgba(15,23,42,0.04)' }}>
                <input type="number" value={age} onChange={(e) => setAge(e.target.value)}
                       placeholder="e.g. 72" min="18" max="120" className={inputCls} />
              </div>
            </div>

            {/* Relationship */}
            <div className="mb-3">
              <label className="block text-[11px] md:text-[12px] font-heading font-semibold text-text-secondary mb-1" style={{ letterSpacing: '0.01em' }}>
                Your relationship
              </label>
              <div className="flex flex-wrap gap-1.5">
                {RELATIONSHIPS.map((r) => (
                  <label
                    key={r.value}
                    className={[
                      'px-3 py-1.5 rounded-full cursor-pointer',
                      'transition-colors duration-150 text-[12px] font-medium',
                      relationship === r.value
                        ? 'bg-primary-600 text-white'
                        : 'bg-bg-surface-alt/70 text-text-secondary hover:bg-white/80',
                    ].join(' ')}
                  >
                    <input
                      type="radio"
                      name="relationship"
                      value={r.value}
                      checked={relationship === r.value}
                      onChange={() => setRelationship(r.value)}
                      className="sr-only"
                    />
                    {r.label}
                  </label>
                ))}
              </div>
            </div>

            {/* Submit */}
            <button type="submit" disabled={loading}
                    className="w-full py-2.5 rounded-xl font-heading font-semibold text-[14px] md:text-[15px] text-white min-h-[44px] cursor-pointer disabled:opacity-60 disabled:cursor-wait active:scale-[0.97] transition-transform duration-150 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary-300"
                    style={{ background: 'linear-gradient(135deg, #00897b, #00796b)', boxShadow: '0 6px 20px rgba(0,137,123,0.2)', letterSpacing: '0.01em' }}>
              {loading ? 'Creating…' : 'Create their account'}
            </button>
          </form>
        </div>

        {/* Links */}
        <div className="text-center mt-2 animate-fade-up-d2">
          <button type="button" onClick={() => router.back()}
                  className="text-[12px] text-text-muted hover:text-text-secondary cursor-pointer">
            ← Back to dashboard
          </button>
        </div>
      </div>
    </div>
  );
}
