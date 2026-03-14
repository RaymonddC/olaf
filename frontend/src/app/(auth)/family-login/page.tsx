'use client';

import { useState, useEffect, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Users } from 'lucide-react';
import { useAuth, type UserRole } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Alert } from '@/components/ui/Alert';
import Link from 'next/link';
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
      // No backend profile yet — send to complete-profile
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
    <div className="w-full max-w-[400px]">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="w-12 h-12 rounded-full bg-primary-100 flex items-center justify-center mx-auto mb-3">
          <Users className="w-6 h-6 text-primary-700" aria-hidden="true" />
        </div>
        <h1 className="text-h2 font-heading font-bold text-text-heading">
          Family member sign in
        </h1>
        <p className="text-body text-text-secondary mt-1">
          Monitor and support your loved one
        </p>
      </div>

      {error && (
        <Alert
          variant="error"
          title="Sign in failed"
          description={error}
          dismissible
          onDismiss={() => setError(null)}
          className="mb-6"
        />
      )}

      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <Input
          label="Email address"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          autoComplete="email"
          required
        />

        <Input
          label="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          autoComplete="current-password"
          required
        />

        <Button
          type="submit"
          variant="primary"
          size="xl"
          loading={loading}
          className="w-full"
        >
          Sign in
        </Button>
      </form>

      {/* Divider */}
      <div className="flex items-center gap-3 my-5" aria-hidden="true">
        <div className="flex-1 border-t border-border" />
        <span className="text-body-sm text-text-muted">or</span>
        <div className="flex-1 border-t border-border" />
      </div>

      {/* Google sign-in */}
      <Button
        type="button"
        variant="secondary"
        size="xl"
        loading={googleLoading}
        className="w-full"
        onClick={handleGoogle}
      >
        <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
        </svg>
        Sign in with Google
      </Button>

      <p className="text-center mt-6 text-body-sm text-text-secondary">
        New to OLAF?{' '}
        <Link
          href="/register"
          className="text-primary-700 hover:text-primary-800 font-medium underline focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary-300 rounded"
        >
          Create an account
        </Link>
      </p>

      {/* Elder link */}
      <p className="text-center mt-3 text-body-sm text-text-muted">
        Are you an elder?{' '}
        <Link
          href="/login"
          className="text-text-secondary hover:text-text-primary font-medium underline focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary-300 rounded"
        >
          Sign in here
        </Link>
      </p>
    </div>
  );
}
