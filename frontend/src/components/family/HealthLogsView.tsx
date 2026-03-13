'use client';

import { Activity } from 'lucide-react';
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton';

interface HealthLog { id?: string; date: string; mood?: string; painLevel?: number; medicationsTaken?: { name: string; time: string; confirmed: boolean }[]; }
interface Props { logs: HealthLog[]; loading: boolean; }

const MOOD: Record<string, string> = { happy:'😊', good:'🙂', okay:'😐', sad:'😢', anxious:'😟', tired:'😴', confused:'😵‍💫', pain:'😣' };

function fmtDay(iso: string) { try { return new Date(iso).toLocaleDateString('en-US', { weekday:'short' }); } catch { return iso; } }

export function HealthLogsView({ logs, loading }: Props) {
    if (loading) return <div className="glass rounded-[22px] p-6"><LoadingSkeleton shape="text" lines={5} /></div>;
    if (logs.length === 0) return null;

    return (
        <div className="glass rounded-[22px] p-6">
            <div className="flex items-center gap-2.5 mb-5">
                <div className="w-[34px] h-[34px] rounded-[12px] flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #f0fdfa, #eff6ff)' }}>
                    <Activity className="w-[17px] h-[17px] text-teal-600" />
                </div>
                <span className="text-[18px] font-heading font-extrabold text-text-heading">This Week</span>
            </div>
            <div>
                {logs.map((log, i) => {
                    const p = log.painLevel ?? 0;
                    const emoji = MOOD[log.mood?.toLowerCase() ?? ''] || '❓';
                    const grad = p <= 2 ? 'linear-gradient(90deg, #34d399, #10b981)' : p <= 4 ? 'linear-gradient(90deg, #fbbf24, #f59e0b)' : 'linear-gradient(90deg, #f87171, #ef4444)';
                    return (
                        <div key={log.id} className="flex items-center gap-3" style={{ padding: '10px 0', borderBottom: i < logs.length - 1 ? '1px solid rgba(241,245,249,0.9)' : 'none' }}>
                            <span className="w-9 text-[14px] text-text-muted font-medium">{fmtDay(log.date)}</span>
                            <span className="text-[22px] w-8 text-center">{emoji}</span>
                            <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: 'rgba(241,245,249,0.9)' }}>
                                <div className="h-full rounded-full" style={{ width: `${p * 10}%`, background: grad, transition: 'width 0.8s cubic-bezier(0.4,0,0.2,1)' }} />
                            </div>
                            <span className="text-[14px] font-heading font-bold text-text-secondary w-9 text-right">{p}/10</span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}