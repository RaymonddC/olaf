'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Mic } from 'lucide-react';
import { useAuth, type UserRole } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Alert } from '@/components/ui/Alert';
import Link from 'next/link';

export default function LoginPage() {
  const router = useRouter();
  const { signIn, signInWithGoogle, setRole } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRoleLocal] = useState<UserRole>('elderly');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const redirectForRole = (r: UserRole) => {
    router.replace(r === 'elderly' ? '/talk' : '/dashboard');
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await signIn(email, password);
      setRole(role);
      redirectForRole(role);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to sign in. Please try again.',
      );
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setError(null);
    setGoogleLoading(true);
    try {
      await signInWithGoogle();
      setRole(role);
      redirectForRole(role);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to sign in with Google.',
      );
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <div className="w-full max-w-[400px]">
      {/* Logo */}
      <div className="text-center mb-8">
        <div className="flex items-center justify-center gap-2 mb-2">
          <div className="w-10 h-10 rounded-full bg-primary-700 flex items-center justify-center">
            <Mic className="w-5 h-5 text-white" aria-hidden="true" />
          </div>
          <span className="text-h1 font-heading font-bold text-text-heading">
            CARIA
          </span>
        </div>
        <p className="text-body text-text-secondary">Your Care Companion</p>
      </div>

      {/* Error */}
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

      {/* Form */}
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

        <div className="text-right">
          <a
            href="#"
            className="text-body-sm text-primary-700 hover:text-primary-800 underline focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary-300 rounded"
          >
            Forgot password?
          </a>
        </div>

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
          <path
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            fill="#4285F4"
          />
          <path
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            fill="#34A853"
          />
          <path
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            fill="#FBBC05"
          />
          <path
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            fill="#EA4335"
          />
        </svg>
        Sign in with Google
      </Button>

      {/* Role selection */}
      <fieldset className="mt-6">
        <legend className="text-body font-medium text-text-primary mb-3">
          I am a:
        </legend>
        <div className="space-y-3">
          {(['elderly', 'family'] as UserRole[]).map((r) => (
            <label
              key={r}
              className={[
                'flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer',
                'transition-colors duration-150',
                role === r
                  ? 'border-primary-700 bg-primary-50'
                  : 'border-border hover:border-border-strong',
              ].join(' ')}
            >
              <input
                type="radio"
                name="role"
                value={r}
                checked={role === r}
                onChange={() => setRoleLocal(r)}
                className="w-5 h-5 accent-primary-700 flex-shrink-0"
              />
              <div>
                <span className="text-body font-medium text-text-primary capitalize block">
                  {r === 'elderly' ? 'Elder' : 'Family member'}
                </span>
                <span className="text-body-sm text-text-secondary">
                  {r === 'elderly'
                    ? 'Access the care companion and memories'
                    : 'Monitor and support your loved one'}
                </span>
              </div>
            </label>
          ))}
        </div>
      </fieldset>

      {/* Register link */}
      <p className="text-center mt-6 text-body-sm text-text-secondary">
        New to CARIA?{' '}
        <Link
          href="/register"
          className="text-primary-700 hover:text-primary-800 font-medium underline focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary-300 rounded"
        >
          Create an account
        </Link>
      </p>
    </div>
  );
}
