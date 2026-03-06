'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Users } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Alert } from '@/components/ui/Alert';
import { api } from '@/lib/api';

/**
 * Complete-profile page — shown after Google sign-in from /family-login
 * when no backend profile exists yet. Family-only: no role selector.
 */
export default function CompleteProfilePage() {
  const router = useRouter();
  const { user, setRole } = useAuth();

  const [name, setName] = useState(user?.displayName ?? '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError('Please enter your name.');
      return;
    }
    setLoading(true);
    try {
      await api.post('/api/auth/register', {
        role: 'family',
        name: name.trim(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        language: 'en',
      });
      setRole('family');
      router.replace('/setup-elder');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not complete profile. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-[400px]">
      <div className="text-center mb-8">
        <div className="w-12 h-12 rounded-full bg-primary-100 flex items-center justify-center mx-auto mb-3">
          <Users className="w-6 h-6 text-primary-700" aria-hidden="true" />
        </div>
        <h1 className="text-h2 font-heading font-bold text-text-heading">
          One last step
        </h1>
        <p className="text-body text-text-secondary mt-1">
          Confirm your name to finish setting up your family account
        </p>
      </div>

      {error && (
        <Alert
          variant="error"
          title="Could not save profile"
          description={error}
          dismissible
          onDismiss={() => setError(null)}
          className="mb-6"
        />
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <Input
          label="Your name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Sarah Thompson"
          autoComplete="name"
          required
        />

        <Button
          type="submit"
          variant="primary"
          size="xl"
          loading={loading}
          className="w-full"
        >
          Continue
        </Button>
      </form>
    </div>
  );
}
