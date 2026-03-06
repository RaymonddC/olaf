'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Mic } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Alert } from '@/components/ui/Alert';
import Link from 'next/link';

/**
 * Elder login page — simple, large text, no role choice, no Google.
 * Family members use /family-login instead.
 */
export default function ElderLoginPage() {
  const router = useRouter();
  const { signIn, setRole } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await signIn(email, password);
      // Elders always go to /talk — no role check needed
      setRole('elderly');
      router.replace('/talk');
    } catch (err) {
      setError('Could not sign in. Please check your email and password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-[360px]">
      {/* Logo */}
      <div className="text-center mb-10">
        <div className="w-20 h-20 rounded-full bg-primary-700 flex items-center justify-center mx-auto mb-4">
          <Mic className="w-10 h-10 text-white" aria-hidden="true" />
        </div>
        <h1 className="text-h1 font-heading font-bold text-text-heading">
          OLAF
        </h1>
        <p className="text-body-lg text-text-secondary mt-1">
          Your Care Companion
        </p>
      </div>

      {error && (
        <Alert
          variant="error"
          title="Could not sign in"
          description={error}
          dismissible
          onDismiss={() => setError(null)}
          className="mb-6"
        />
      )}

      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        <Input
          label="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="your@email.com"
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

      {/* Family link — small and unobtrusive */}
      <p className="text-center mt-8 text-body-sm text-text-muted">
        Are you a family member?{' '}
        <Link
          href="/family-login"
          className="text-primary-700 hover:text-primary-800 font-medium underline focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary-300 rounded"
        >
          Sign in here
        </Link>
      </p>
    </div>
  );
}
