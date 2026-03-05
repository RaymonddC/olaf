'use client';

/**
 * Family Dashboard — Settings Page
 *
 * - Notification preferences (alerts, daily reports, weekly reports, email digest)
 * - Linked elderly user accounts with relationship display
 * - Push notification setup / teardown
 */

import { useState, useCallback, useEffect } from 'react';
import { Settings, ArrowLeft, Bell, Users, Heart } from 'lucide-react';
import Link from 'next/link';
import { Header } from '@/components/layout/Header';
import { PageShell } from '@/components/layout/PageShell';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/contexts/AuthContext';
import { useMe } from '@/hooks/useApi';
import { setupPushNotifications } from '@/lib/fcm';

// ── Types ─────────────────────────────────────────────────────────────────────

interface NotificationPrefs {
  alertsEnabled: boolean;
  dailyReportEnabled: boolean;
  weeklyReportEnabled: boolean;
  emailDigestEnabled: boolean;
}

const DEFAULT_PREFS: NotificationPrefs = {
  alertsEnabled: true,
  dailyReportEnabled: true,
  weeklyReportEnabled: true,
  emailDigestEnabled: false,
};

const PREFS_STORAGE_KEY = 'caria_notification_prefs';

function loadPrefs(): NotificationPrefs {
  if (typeof window === 'undefined') return DEFAULT_PREFS;
  try {
    const stored = localStorage.getItem(PREFS_STORAGE_KEY);
    if (stored) return { ...DEFAULT_PREFS, ...JSON.parse(stored) };
  } catch {
    // Ignore parse errors
  }
  return DEFAULT_PREFS;
}

function savePrefs(prefs: NotificationPrefs): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(prefs));
}

// ── Toggle switch ─────────────────────────────────────────────────────────────

interface ToggleProps {
  id: string;
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

function Toggle({ id, label, description, checked, onChange }: ToggleProps) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 border-b border-border last:border-0">
      <div>
        <label htmlFor={id} className="text-body font-medium text-text-primary cursor-pointer">
          {label}
        </label>
        {description && (
          <p className="text-body-sm text-text-secondary mt-0.5">{description}</p>
        )}
      </div>
      <button
        id={id}
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={[
          'relative inline-flex flex-shrink-0 h-7 w-12 rounded-full border-2 border-transparent',
          'transition-colors duration-200 cursor-pointer',
          'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary-300',
          checked ? 'bg-primary-700' : 'bg-bg-muted',
        ].join(' ')}
        aria-label={label}
      >
        <span
          className={[
            'inline-block h-5 w-5 mt-0.5 rounded-full bg-white shadow-md',
            'transform transition-transform duration-200',
            checked ? 'translate-x-5' : 'translate-x-0.5',
          ].join(' ')}
          aria-hidden="true"
        />
      </button>
    </div>
  );
}

// ── Relationship badge ────────────────────────────────────────────────────────

const RELATIONSHIP_LABELS: Record<string, string> = {
  son: 'Son',
  daughter: 'Daughter',
  spouse: 'Spouse / Partner',
  caregiver: 'Caregiver',
  other: 'Family member',
};

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const { user } = useAuth();
  const { toast } = useToast();

  const { data: meData, isLoading: meLoading } = useMe();
  const profile = meData?.data;

  const linkedElderlyUsers =
    profile?.linkedAccounts?.filter((a) => a.role === 'elderly') ?? [];

  // Notification prefs (stored locally for now — could be persisted to backend)
  const [prefs, setPrefs] = useState<NotificationPrefs>(DEFAULT_PREFS);
  const [pushSetupLoading, setPushSetupLoading] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);

  // Load prefs from localStorage on mount
  useEffect(() => {
    setPrefs(loadPrefs());
    // Check if notifications are already granted
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setPushEnabled(Notification.permission === 'granted');
    }
  }, []);

  const handlePrefChange = useCallback(
    (key: keyof NotificationPrefs) => (value: boolean) => {
      const updated = { ...prefs, [key]: value };
      setPrefs(updated);
      savePrefs(updated);
      toast({ variant: 'success', title: 'Preference saved' });
    },
    [prefs, toast],
  );

  const handleEnablePush = useCallback(async () => {
    setPushSetupLoading(true);
    try {
      const token = await setupPushNotifications();
      if (token) {
        setPushEnabled(true);
        toast({
          variant: 'success',
          title: 'Push notifications enabled',
          description: "You'll receive alerts even when the app is in the background.",
        });
      } else {
        toast({
          variant: 'warning',
          title: 'Could not enable push notifications',
          description:
            'Please check your browser settings and allow notifications for this site.',
        });
      }
    } catch {
      toast({ variant: 'error', title: 'Failed to enable push notifications' });
    } finally {
      setPushSetupLoading(false);
    }
  }, [toast]);

  return (
    <>
      <Header
        title="Settings"
        action={
          <Link
            href="/dashboard"
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-body-sm font-semibold text-text-secondary hover:bg-bg-surface-alt transition-colors duration-150 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary-300 min-h-[48px]"
            aria-label="Back to dashboard"
          >
            <ArrowLeft className="w-5 h-5" aria-hidden="true" />
            Dashboard
          </Link>
        }
      />

      <PageShell id="settings-content" noBottomPad>
        <div className="space-y-6">
          {/* Push notification section */}
          <Card variant="elevated" as="section">
            <div className="flex items-center gap-2 mb-4">
              <Bell className="w-5 h-5 text-primary-700" aria-hidden="true" />
              <h2 className="text-h3 text-text-heading font-semibold">Push notifications</h2>
            </div>

            {pushEnabled ? (
              <div className="flex items-center gap-3 p-3 bg-success-50 border border-success-600 rounded-xl">
                <Bell className="w-5 h-5 text-success-700 flex-shrink-0" aria-hidden="true" />
                <p className="text-body-sm text-success-700 font-medium">
                  Push notifications are active. You&apos;ll receive real-time alerts.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-body-sm text-text-secondary">
                  Enable push notifications to receive real-time alerts when CARIA detects
                  something important.
                </p>
                <Button
                  variant="primary"
                  size="lg"
                  onClick={handleEnablePush}
                  loading={pushSetupLoading}
                  className="w-full sm:w-auto"
                >
                  <Bell className="w-5 h-5" aria-hidden="true" />
                  Enable push notifications
                </Button>
              </div>
            )}
          </Card>

          {/* Notification preferences */}
          <Card variant="elevated" as="section">
            <div className="flex items-center gap-2 mb-4">
              <Settings className="w-5 h-5 text-primary-700" aria-hidden="true" />
              <h2 className="text-h3 text-text-heading font-semibold">
                Notification preferences
              </h2>
            </div>

            <div className="space-y-0">
              <Toggle
                id="alerts-toggle"
                label="Alert notifications"
                description="Get notified immediately for distress, missed medications, or inactivity."
                checked={prefs.alertsEnabled}
                onChange={handlePrefChange('alertsEnabled')}
              />
              <Toggle
                id="daily-toggle"
                label="Daily report"
                description="Receive a daily summary of your loved one's wellbeing."
                checked={prefs.dailyReportEnabled}
                onChange={handlePrefChange('dailyReportEnabled')}
              />
              <Toggle
                id="weekly-toggle"
                label="Weekly report"
                description="Receive a comprehensive weekly health and mood report."
                checked={prefs.weeklyReportEnabled}
                onChange={handlePrefChange('weeklyReportEnabled')}
              />
              <Toggle
                id="email-toggle"
                label="Email digest"
                description="Receive a weekly email summary in addition to in-app notifications."
                checked={prefs.emailDigestEnabled}
                onChange={handlePrefChange('emailDigestEnabled')}
              />
            </div>
          </Card>

          {/* Linked elderly users */}
          <Card variant="elevated" as="section">
            <div className="flex items-center gap-2 mb-4">
              <Users className="w-5 h-5 text-primary-700" aria-hidden="true" />
              <h2 className="text-h3 text-text-heading font-semibold">Linked accounts</h2>
            </div>

            {meLoading ? (
              <div className="space-y-3">
                <LoadingSkeleton shape="text" />
                <LoadingSkeleton shape="text" />
              </div>
            ) : linkedElderlyUsers.length === 0 ? (
              <div className="flex flex-col items-center py-8 text-center">
                <Users className="w-12 h-12 text-primary-300 mb-3" aria-hidden="true" />
                <p className="text-body text-text-secondary">
                  No elderly users linked yet.
                </p>
                <p className="text-body-sm text-text-muted mt-1">
                  Ask your loved one to create an account and share their link code with you.
                </p>
              </div>
            ) : (
              <ul className="space-y-3" aria-label="Linked elderly users">
                {linkedElderlyUsers.map((account) => (
                  <li
                    key={account.userId}
                    className="flex items-center gap-3 p-3 bg-bg-muted rounded-xl"
                  >
                    <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
                      <Heart className="w-5 h-5 text-primary-700" aria-hidden="true" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-body font-semibold text-text-primary truncate">
                        {account.name}
                      </p>
                      <p className="text-body-sm text-text-secondary">
                        {RELATIONSHIP_LABELS[account.relationship] ?? account.relationship}
                      </p>
                    </div>
                    <Badge variant={{ kind: 'status', status: 'active' }} size="sm">
                      Active
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {/* Account info */}
          {profile && (
            <Card variant="outlined" as="section">
              <h2 className="text-h3 text-text-heading font-semibold mb-3">Your account</h2>
              <dl className="space-y-2 text-body-sm">
                <div className="flex gap-2">
                  <dt className="text-text-secondary w-20 flex-shrink-0">Name</dt>
                  <dd className="text-text-primary font-medium">{profile.name}</dd>
                </div>
                <div className="flex gap-2">
                  <dt className="text-text-secondary w-20 flex-shrink-0">Role</dt>
                  <dd className="text-text-primary font-medium capitalize">{profile.role}</dd>
                </div>
                {user?.email && (
                  <div className="flex gap-2">
                    <dt className="text-text-secondary w-20 flex-shrink-0">Email</dt>
                    <dd className="text-text-primary font-medium">{user.email}</dd>
                  </div>
                )}
              </dl>
            </Card>
          )}
        </div>
      </PageShell>
    </>
  );
}
