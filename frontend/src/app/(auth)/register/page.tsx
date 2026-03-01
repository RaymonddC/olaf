'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Mic } from 'lucide-react';
import { useAuth, type UserRole } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Alert } from '@/components/ui/Alert';
import Link from 'next/link';

export default function RegisterPage() {
  const router = useRouter();
  const { signUp, setRole } = useAuth();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [age, setAge] = useState('');
  const [timezone, setTimezone] = useState(
    Intl.DateTimeFormat().resolvedOptions().timeZone,
  );
  const [role, setRoleLocal] = useState<UserRole>('elderly');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const validate = (): boolean => {
    const errors: Record<string, string> = {};
    if (!name.trim()) errors.name = 'Please enter your full name.';
    if (!email.includes('@')) errors.email = 'Please enter a valid email address.';
    if (password.length < 8)
      errors.password = 'Password must be at least 8 characters.';
    if (password !== confirmPassword)
      errors.confirmPassword = 'Passwords do not match.';
    if (role === 'elderly' && age && (Number(age) < 18 || Number(age) > 120))
      errors.age = 'Please enter a valid age.';
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
      setRole(role);
      router.replace(role === 'elderly' ? '/talk' : '/dashboard');
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to create account. Please try again.',
      );
    } finally {
      setLoading(false);
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
        <p className="text-body text-text-secondary">Create your account</p>
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
        {/* Role selection first */}
        <fieldset>
          <legend className="text-body font-medium text-text-primary mb-3">
            I am registering as a:
          </legend>
          <div className="flex gap-3">
            {(['elderly', 'family'] as UserRole[]).map((r) => (
              <label
                key={r}
                className={[
                  'flex-1 flex items-center justify-center gap-2 p-3 rounded-xl border-2 cursor-pointer',
                  'transition-colors duration-150 text-body font-medium',
                  role === r
                    ? 'border-primary-700 bg-primary-50 text-primary-700'
                    : 'border-border text-text-secondary hover:border-border-strong',
                ].join(' ')}
              >
                <input
                  type="radio"
                  name="role"
                  value={r}
                  checked={role === r}
                  onChange={() => setRoleLocal(r)}
                  className="sr-only"
                />
                {r === 'elderly' ? 'Elder' : 'Family'}
              </label>
            ))}
          </div>
        </fieldset>

        <Input
          label="Full name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Margaret Thompson"
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

        {role === 'elderly' && (
          <Input
            label="Age (optional)"
            type="number"
            value={age}
            onChange={(e) => setAge(e.target.value)}
            placeholder="e.g. 72"
            autoComplete="age"
            error={fieldErrors.age}
            helperText="Helps CARIA personalise conversations for you"
            min="18"
            max="120"
          />
        )}

        <Input
          label="Timezone"
          type="text"
          value={timezone}
          onChange={(e) => setTimezone(e.target.value)}
          placeholder="e.g. Europe/London"
          autoComplete="off"
          helperText="Used for medication reminders and daily check-ins"
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
          href="/login"
          className="text-primary-700 hover:text-primary-800 font-medium underline focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary-300 rounded"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}
