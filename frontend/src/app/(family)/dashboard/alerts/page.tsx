'use client';

/**
 * Family Dashboard — Alerts Page
 *
 * Real-time alert list using Firestore onSnapshot for live updates.
 * Severity colour coding: high=red, medium=amber, low=blue.
 * Family members can acknowledge alerts from this page.
 */

import { useEffect, useState, useCallback } from 'react';
import { Bell, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  type Unsubscribe,
} from 'firebase/firestore';
import { Header } from '@/components/layout/Header';
import { PageShell } from '@/components/layout/PageShell';
import { AlertCard } from '@/components/family/AlertCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton';
import { Badge } from '@/components/ui/Badge';
import { useToast } from '@/components/ui/Toast';
import { useMe, useAcknowledgeAlert } from '@/hooks/useApi';
import type { Alert } from '@/hooks/useApi';

// Firestore client (for onSnapshot real-time listener)
import { getFirestore } from 'firebase/firestore';
import { app } from '@/lib/firebase';

function getFirestoreClient() {
  if (typeof window === 'undefined') return null;
  return getFirestore(app);
}

export default function AlertsPage() {
  const { toast } = useToast();

  const { data: meData, isLoading: meLoading } = useMe();
  const profile = meData?.data;

  const elderlyAccount = profile?.linkedAccounts?.find((a) => a.role === 'elderly');
  const elderlyUserId = elderlyAccount?.userId ?? '';

  // Real-time alerts via Firestore onSnapshot
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [rtLoading, setRtLoading] = useState(true);
  const [acknowledgingId, setAcknowledgingId] = useState<string | null>(null);

  const acknowledgeAlert = useAcknowledgeAlert(elderlyUserId);

  // Subscribe to live alerts when elderlyUserId is known
  useEffect(() => {
    if (!elderlyUserId) return;

    const db = getFirestoreClient();
    if (!db) return;

    const alertsQuery = query(
      collection(db, 'alerts'),
      where('user_id', '==', elderlyUserId),
      orderBy('created_at', 'desc'),
    );

    const unsubscribe: Unsubscribe = onSnapshot(
      alertsQuery,
      (snapshot) => {
        const docs: Alert[] = snapshot.docs.map((doc) => {
          const d = doc.data();
          return {
            id: doc.id,
            userId: d.user_id ?? '',
            type: d.type ?? 'health_anomaly',
            severity: d.severity ?? 'low',
            message: d.message ?? '',
            source: d.source ?? 'system',
            acknowledged: d.acknowledged ?? false,
            createdAt: d.created_at?.toDate?.()?.toISOString() ?? new Date().toISOString(),
          } as Alert;
        });
        setAlerts(docs);
        setRtLoading(false);
      },
      (err) => {
        console.error('[Alerts] onSnapshot error:', err);
        setRtLoading(false);
      },
    );

    return () => unsubscribe();
  }, [elderlyUserId]);

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

  const unacknowledged = alerts.filter((a) => !a.acknowledged);
  const acknowledged = alerts.filter((a) => a.acknowledged);

  const loading = meLoading || rtLoading;

  return (
    <>
      <Header
        title="Alerts"
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

      <PageShell id="alerts-content" noBottomPad>
        {loading ? (
          <div className="space-y-3">
            <LoadingSkeleton shape="card" />
            <LoadingSkeleton shape="card" />
            <LoadingSkeleton shape="card" />
          </div>
        ) : !elderlyUserId ? (
          <EmptyState
            icon={Bell}
            title="No linked account"
            message="Link an elderly user account to see their alerts."
          />
        ) : (
          <div className="space-y-8">
            {/* Unacknowledged section */}
            <section aria-labelledby="unack-heading">
              <div className="flex items-center gap-2 mb-3">
                <h2 id="unack-heading" className="text-h3 text-text-heading font-semibold">
                  Active alerts
                </h2>
                {unacknowledged.length > 0 && (
                  <Badge
                    variant={{
                      kind: 'severity',
                      severity:
                        unacknowledged.some((a) => a.severity === 'high')
                          ? 'high'
                          : unacknowledged.some((a) => a.severity === 'medium')
                          ? 'medium'
                          : 'low',
                    }}
                    size="sm"
                  >
                    {String(unacknowledged.length)}
                  </Badge>
                )}
              </div>

              {unacknowledged.length === 0 ? (
                <EmptyState
                  icon={Bell}
                  title="All clear"
                  message="No active alerts. That's great news!"
                />
              ) : (
                <div className="space-y-3" role="list" aria-label="Active alert list">
                  {unacknowledged
                    .sort((a, b) => {
                      const order = { high: 0, medium: 1, low: 2 };
                      return order[a.severity] - order[b.severity];
                    })
                    .map((alert) => (
                      <div key={alert.id} role="listitem">
                        <AlertCard
                          alert={alert}
                          onAcknowledge={handleAcknowledge}
                          acknowledging={acknowledgingId === alert.id}
                        />
                      </div>
                    ))}
                </div>
              )}
            </section>

            {/* Acknowledged history */}
            {acknowledged.length > 0 && (
              <section aria-labelledby="ack-heading">
                <h2
                  id="ack-heading"
                  className="text-h3 text-text-heading font-semibold mb-3"
                >
                  Acknowledged
                </h2>
                <div className="space-y-3 opacity-60" role="list" aria-label="Acknowledged alerts">
                  {acknowledged.slice(0, 10).map((alert) => (
                    <div key={alert.id} role="listitem">
                      <AlertCard
                        alert={alert}
                        onAcknowledge={handleAcknowledge}
                        acknowledging={false}
                      />
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </PageShell>
    </>
  );
}
