'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut, Heart } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { PageShell } from '@/components/layout/PageShell';
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton';
import { OverviewCard } from '@/components/family/OverviewCard';
import { AlertSection } from '@/components/family/AlertSection';
import { ReportsSection } from '@/components/family/ReportsSection';
import { HealthLogsView } from '@/components/family/HealthLogsView';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/Toast';
import {
  useMe,
  useHealthLogs,
  useAlerts,
  useAcknowledgeAlert,
  useReports,
} from '@/hooks/useApi';
import { Button } from '@/components/ui/Button';
import { setupPushNotifications, onForegroundMessage } from '@/lib/fcm';

export default function FamilyDashboardPage() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const [acknowledgingId, setAcknowledgingId] = useState<string | null>(null);

  // Fetch current user profile to get linked elderly user
  const { data: meData, isLoading: meLoading } = useMe();
  const profile = meData?.data;

  // Redirect non-family users
  useEffect(() => {
    if (!meLoading && profile && profile.role !== 'family') {
      router.replace('/');
    }
  }, [meLoading, profile, router]);

  // Get linked elderly user (first linked account with role "elderly")
  const elderlyAccount = profile?.linkedAccounts?.find((a) => a.role === 'elderly');
  const elderlyUserId = elderlyAccount?.userId ?? '';
  const elderlyName = elderlyAccount?.name ?? 'Your loved one';

  // Fetch data for the linked elderly user
  const { data: todayLogs, isLoading: logsLoading } = useHealthLogs(elderlyUserId, 'today');
  const { data: weekLogs, isLoading: weekLogsLoading } = useHealthLogs(elderlyUserId, 'week');
  const { data: alertsData, isLoading: alertsLoading } = useAlerts(elderlyUserId);
  const { data: reportsData, isLoading: reportsLoading } = useReports(elderlyUserId);

  const acknowledgeAlert = useAcknowledgeAlert(elderlyUserId);

  const todayLog = todayLogs?.data?.logs?.[0] ?? null;
  const weeklyLogs = weekLogs?.data?.logs ?? [];
  const alerts = alertsData?.data?.alerts ?? [];
  const reports = reportsData?.data?.reports ?? [];

  // Handle alert acknowledge
  const handleAcknowledge = useCallback(
    (alertId: string) => {
      setAcknowledgingId(alertId);
      acknowledgeAlert.mutate(alertId, {
        onSuccess: () => {
          setAcknowledgingId(null);
          toast({ variant: 'success', title: 'Alert acknowledged' });
        },
        onError: () => {
          setAcknowledgingId(null);
          toast({ variant: 'error', title: 'Failed to acknowledge alert' });
        },
      });
    },
    [acknowledgeAlert, toast],
  );

  // Setup FCM push notifications
  useEffect(() => {
    if (!user) return;

    setupPushNotifications().catch(() => {
      // Non-critical — push notifications are optional
    });

    const unsubscribe = onForegroundMessage((payload) => {
      toast({
        variant: 'warning',
        title: payload.title,
        description: payload.body,
      });
    });

    return () => {
      unsubscribe?.();
    };
  }, [user, toast]);

  // Handle sign out
  const handleSignOut = useCallback(async () => {
    await signOut();
    router.replace('/login');
  }, [signOut, router]);

  // Loading state while fetching user profile
  if (meLoading) {
    return (
      <>
        <Header title="Loading..." />
        <PageShell id="dashboard-content" noBottomPad>
          <div className="space-y-6">
            <LoadingSkeleton shape="card" />
            <LoadingSkeleton shape="card" />
            <LoadingSkeleton shape="card" />
          </div>
        </PageShell>
      </>
    );
  }

  // No linked elder yet — prompt to link
  if (!meLoading && profile && !elderlyUserId) {
    return (
      <>
        <Header
          title="Family Dashboard"
          action={
            <button
              onClick={handleSignOut}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-body-sm font-semibold text-text-secondary hover:bg-bg-surface-alt transition-colors duration-150 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary-300 min-h-[48px]"
            >
              <LogOut className="w-5 h-5" aria-hidden="true" />
              Sign out
            </button>
          }
        />
        <div className="min-h-[60vh] flex items-center justify-center px-6">
          <div className="text-center max-w-sm">
            <div className="w-16 h-16 rounded-full bg-primary-100 flex items-center justify-center mx-auto mb-4">
              <Heart className="w-8 h-8 text-primary-700" aria-hidden="true" />
            </div>
            <h2 className="text-h2 font-heading font-bold text-text-heading mb-2">
              Connect to your loved one
            </h2>
            <p className="text-body text-text-secondary mb-6">
              You have not set up a loved one yet. Create their account to start monitoring their care.
            </p>
            <Button
              variant="primary"
              size="lg"
              onClick={() => router.push('/setup-elder')}
            >
              Set up their account
            </Button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Header
        title={`${elderlyName}'s care`}
        action={
          <button
            onClick={handleSignOut}
            className={[
              'flex items-center gap-2 px-4 py-2 rounded-xl',
              'text-body-sm font-semibold text-text-secondary',
              'hover:bg-bg-surface-alt transition-colors duration-150',
              'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary-300',
              'min-h-[48px]',
            ].join(' ')}
          >
            <LogOut className="w-5 h-5" aria-hidden="true" />
            Sign out
          </button>
        }
      />

      <PageShell id="dashboard-content" noBottomPad>
        <div className="space-y-8">
          {/* Today's Overview */}
          <OverviewCard
            healthLog={todayLog}
            lastConversationTime={null}
            loading={logsLoading}
          />

          {/* Alerts */}
          <AlertSection
            alerts={alerts}
            loading={alertsLoading}
            acknowledgingId={acknowledgingId}
            onAcknowledge={handleAcknowledge}
          />

          {/* Reports */}
          <ReportsSection
            reports={reports}
            loading={reportsLoading}
          />

          {/* Health Logs */}
          <HealthLogsView
            logs={weeklyLogs}
            loading={weekLogsLoading}
          />
        </div>
      </PageShell>
    </>
  );
}
