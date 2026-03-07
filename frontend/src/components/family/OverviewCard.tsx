'use client';

import { Heart, MessageCircle, Activity } from 'lucide-react';
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton';

interface Props {
    healthLog: { mood?: string; painLevel?: number; medicationsTaken?: string[]; notes?: string } | null;
    lastConversationTime: string | null;
    loading: boolean;
}

const MOOD: Record<string, string> = { happy:'😊', good:'🙂', okay:'😐', sad:'😢', anxious:'😟', tired:'😴', confused:'😵‍💫', pain:'😣' };

export function OverviewCard({ healthLog, lastConversationTime, loading }: Props) {
    if (loading) return <div className="glass rounded-[22px] p-6"><LoadingSkeleton shape="card" /></div>;

    const mood = healthLog?.mood?.toLowerCase() ?? '';
    const pain = healthLog?.painLevel;
    const meds = healthLog?.medicationsTaken?.length ?? 0;

    return (
        <div className="glass rounded-[22px] p-6">
            <div className="flex items-center gap-2.5 mb-5">
                <div className="w-8 h-8 rounded-[10px] flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #eff6ff, #f0fdfa)' }}>
                    <Heart className="w-4 h-4 text-primary-600" />
                </div>
                <h2 className="text-[18px] font-heading font-extrabold text-text-heading">Today&apos;s Overview</h2>
            </div>
            {!healthLog ? (
                <p className="text-body text-text-muted">No check-in yet. OLAF will ask during their next conversation.</p>
            ) : (
                <div className="grid grid-cols-2 gap-3">
                    {[
                        { emoji: MOOD[mood] || '❓', label: 'Mood', value: mood || 'Unknown', bg: '#eff6ff80' },
                        { icon: <Activity className="w-6 h-6 text-amber-600" />, label: 'Pain', value: pain != null ? `${pain}/10` : '—', bg: '#fffbeb80' },
                        { emoji: '💊', label: 'Medications', value: meds > 0 ? `${meds} taken` : 'None', bg: '#f0fdf480' },
                        { icon: <MessageCircle className="w-6 h-6 text-primary-500" />, label: 'Last talked', value: lastConversationTime ? 'Today' : 'None', bg: '#eff6ff60' },
                    ].map((c, i) => (
                        <div key={i} className="flex items-center gap-3 p-3 rounded-[16px]" style={{ background: c.bg }}>
                            {c.emoji ? <span className="text-[28px]">{c.emoji}</span> : c.icon}
                            <div>
                                <div className="text-[12px] font-semibold text-text-muted uppercase" style={{ letterSpacing: '0.04em' }}>{c.label}</div>
                                <div className="text-[17px] font-heading font-bold text-text-heading capitalize">{c.value}</div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}