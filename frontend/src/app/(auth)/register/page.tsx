'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Users } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Alert } from '@/components/ui/Alert';
import Link from 'next/link';
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
    <div className="w-full max-w-[400px]">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="w-12 h-12 rounded-full bg-primary-100 flex items-center justify-center mx-auto mb-3">
          <Users className="w-6 h-6 text-primary-700" aria-hidden="true" />
        </div>
        <h1 className="text-h2 font-heading font-bold text-text-heading">
          Create your family account
        </h1>
        <p className="text-body text-text-secondary mt-1">
          Monitor and support your loved one with OLAF
        </p>
      </div>

      {error && (
        <Alert
          variant="error"
          title="Registration failed"
          description={error}
          dismissible
          onDismiss={() => setError(null)}
          className="mb-6"
        />
      )}

      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <Input
          label="Full name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Sarah Thompson"
          autoComplete="name"
          error={fieldErrors.name}
          required
        />

        <Input
          label="Email address"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          autoComplete="email"
          error={fieldErrors.email}
          required
        />

        <Input
          label="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="At least 8 characters"
          autoComplete="new-password"
          error={fieldErrors.password}
          helperText="Minimum 8 characters"
          required
        />

        <Input
          label="Confirm password"
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder="Re-enter your password"
          autoComplete="new-password"
          error={fieldErrors.confirmPassword}
          required
        />

        <Button
          type="submit"
          variant="primary"
          size="xl"
          loading={loading}
          className="w-full mt-2"
        >
          Create account
        </Button>
      </form>

      <p className="text-center mt-6 text-body-sm text-text-secondary">
        Already have an account?{' '}
        <Link
          href="/family-login"
          className="text-primary-700 hover:text-primary-800 font-medium underline focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary-300 rounded"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}
