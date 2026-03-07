'use client';

import { Bell } from 'lucide-react';
import { AlertCard } from './AlertCard';
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton';

interface Alert { id: string; type: string; severity: string; title: string; message: string; createdAt: string; acknowledged: boolean; }
interface Props { alerts: Alert[]; loading: boolean; acknowledgingId: string | null; onAcknowledge: (id: string) => void; }

export function AlertSection({ alerts, loading, acknowledgingId, onAcknowledge }: Props) {
    if (loading) return <div className="glass rounded-[22px] p-6"><LoadingSkeleton shape="text" lines={3} /></div>;
    if (alerts.length === 0) return null;

    const active = alerts.filter(a => !a.acknowledged);
    const recent = alerts.filter(a => a.acknowledged).slice(0, 2);

    return (
        <div className="glass rounded-[22px] p-6">
            <div className="flex items-center gap-2.5 mb-4">
                <div className="w-8 h-8 rounded-[10px] flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #fffbeb, #fef2f2)' }}>
                    <Bell className="w-4 h-4 text-amber-600" />
                </div>
                <h2 className="text-[18px] font-heading font-extrabold text-text-heading">
                    Alerts
                    {active.length > 0 && (
                        <span className="ml-2 inline-flex items-center justify-center w-6 h-6 rounded-full bg-error-600 text-white text-[12px] font-bold">{active.length}</span>
                    )}
                </h2>
            </div>
            <div className="space-y-3">
                {active.map(a => <AlertCard key={a.id} {...a} acknowledging={acknowledgingId === a.id} onAcknowledge={onAcknowledge} />)}
                {recent.map(a => <AlertCard key={a.id} {...a} acknowledging={false} onAcknowledge={onAcknowledge} />)}
            </div>
        </div>
    );
}