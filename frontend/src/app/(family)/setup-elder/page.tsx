'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { UserPlus, Copy, Check, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Alert } from '@/components/ui/Alert';
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
  email: string;
  tempPassword: string;
  elderUserId: string;
}

export default function SetupElderPage() {
  const router = useRouter();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [age, setAge] = useState('');
  const [relationship, setRelationship] = useState<Relationship>('daughter');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<CreatedAccount | null>(null);
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [copiedPassword, setCopiedPassword] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!name.trim()) { setError('Please enter their name.'); return; }
    if (!email.includes('@')) { setError('Please enter a valid email address.'); return; }

    setLoading(true);
    try {
      const res = await api.post<{ status: string; data: { elderUserId: string; email: string; tempPassword: string } }>(
        '/api/auth/create-elder-account',
        {
          name: name.trim(),
          email: email.trim(),
          relationship,
          age: age ? Number(age) : undefined,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          language: 'en',
        },
      );
      setCreated({
        elderUserId: res.data.elderUserId,
        email: res.data.email,
        tempPassword: res.data.tempPassword,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create account. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const copy = (text: string, which: 'email' | 'password') => {
    navigator.clipboard.writeText(text).then(() => {
      if (which === 'email') {
        setCopiedEmail(true);
        setTimeout(() => setCopiedEmail(false), 2000);
      } else {
        setCopiedPassword(true);
        setTimeout(() => setCopiedPassword(false), 2000);
      }
    });
  };

  // ── Success screen ────────────────────────────────────────────────────────
  if (created) {
    return (
      <div className="min-h-dvh bg-bg-page flex items-center justify-center px-4">
        <div className="w-full max-w-[400px]">
          <div className="text-center mb-8">
            <div className="w-14 h-14 rounded-full bg-success-100 flex items-center justify-center mx-auto mb-4">
              <Check className="w-7 h-7 text-success-600" aria-hidden="true" />
            </div>
            <h1 className="text-h2 font-heading font-bold text-text-heading">
              Account created!
            </h1>
            <p className="text-body text-text-secondary mt-2">
              Use these credentials to sign in on{' '}
              <strong className="text-text-primary">{name.trim()}</strong>&apos;s device.
            </p>
          </div>

          <div className="space-y-4 mb-8">
            {/* Email */}
            <div className="bg-bg-surface rounded-xl border border-border p-4">
              <p className="text-caption text-text-muted mb-1">Email</p>
              <div className="flex items-center justify-between gap-3">
                <span className="text-body font-mono text-text-primary truncate">
                  {created.email}
                </span>
                <button
                  type="button"
                  onClick={() => copy(created.email, 'email')}
                  className="flex-shrink-0 p-1 rounded focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary-300"
                  aria-label="Copy email"
                >
                  {copiedEmail
                    ? <Check className="w-4 h-4 text-success-600" />
                    : <Copy className="w-4 h-4 text-text-muted" />}
                </button>
              </div>
            </div>

            {/* Temp password */}
            <div className="bg-bg-surface rounded-xl border border-border p-4">
              <p className="text-caption text-text-muted mb-1">Temporary password</p>
              <div className="flex items-center justify-between gap-3">
                <span className="text-body font-mono text-text-primary tracking-widest">
                  {created.tempPassword}
                </span>
                <button
                  type="button"
                  onClick={() => copy(created.tempPassword, 'password')}
                  className="flex-shrink-0 p-1 rounded focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary-300"
                  aria-label="Copy password"
                >
                  {copiedPassword
                    ? <Check className="w-4 h-4 text-success-600" />
                    : <Copy className="w-4 h-4 text-text-muted" />}
                </button>
              </div>
            </div>
          </div>

          <Alert
            variant="warning"
            title="Save these credentials"
            description="OLAF will not show the password again. Write it down or save it somewhere safe before continuing."
            className="mb-6"
          />

          {/* Step-by-step instructions */}
          <div className="bg-bg-surface rounded-xl border border-border p-4 mb-6 space-y-2">
            <p className="text-body-sm font-semibold text-text-heading">
              To set up their device:
            </p>
            <ol className="text-body-sm text-text-secondary space-y-1 list-decimal list-inside">
              <li>Open OLAF on their phone or tablet</li>
              <li>Go to <span className="font-mono text-text-primary">olaf.app/login</span></li>
              <li>Enter the email and password above</li>
            </ol>
          </div>

          <div className="space-y-3">
            <Button
              variant="primary"
              size="xl"
              className="w-full"
              onClick={() => router.replace('/dashboard')}
            >
              Go to my dashboard
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ── Setup form ─────────────────────────────────────────────────────────────
  return (
    <div className="min-h-dvh bg-bg-page flex items-center justify-center px-4">
      <div className="w-full max-w-[400px]">
        {/* Back */}
        <button
          type="button"
          onClick={() => router.back()}
          className="flex items-center gap-2 text-body-sm text-text-secondary mb-6 hover:text-text-primary transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>

        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-full bg-primary-100 flex items-center justify-center mx-auto mb-4">
            <UserPlus className="w-7 h-7 text-primary-700" aria-hidden="true" />
          </div>
          <h1 className="text-h2 font-heading font-bold text-text-heading">
            Set up their account
          </h1>
          <p className="text-body text-text-secondary mt-2">
            Create an OLAF account for your loved one. You will get a password to sign in on their device.
          </p>
        </div>

        {error && (
          <Alert
            variant="error"
            title="Could not create account"
            description={error}
            dismissible
            onDismiss={() => setError(null)}
            className="mb-6"
          />
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Their full name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Margaret Thompson"
            autoComplete="name"
            required
          />

          <Input
            label="Their email address"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="e.g. margaret@example.com"
            autoComplete="email"
            helperText="Used to sign in to OLAF — you can create a new one if needed"
            required
          />

          <Input
            label="Their age (optional)"
            type="number"
            value={age}
            onChange={(e) => setAge(e.target.value)}
            placeholder="e.g. 72"
            min="18"
            max="120"
            helperText="Helps OLAF personalise conversations"
          />

          {/* Relationship */}
          <fieldset>
            <legend className="text-body font-medium text-text-primary mb-3">
              Your relationship
            </legend>
            <div className="grid grid-cols-2 gap-2">
              {RELATIONSHIPS.map((r) => (
                <label
                  key={r.value}
                  className={[
                    'flex items-center justify-center p-3 rounded-xl border-2 cursor-pointer',
                    'transition-colors duration-150 text-body-sm font-medium text-center',
                    relationship === r.value
                      ? 'border-primary-700 bg-primary-50 text-primary-700'
                      : 'border-border text-text-secondary hover:border-border-strong',
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
          </fieldset>

          <Button
            type="submit"
            variant="primary"
            size="xl"
            loading={loading}
            className="w-full mt-2"
          >
            Create their account
          </Button>
        </form>
      </div>
    </div>
  );
}
