'use client';

import { AlertTriangle, Info, AlertCircle, Check, Loader2 } from 'lucide-react';

interface Props {
    id: string; type: string; severity: string; title: string; message: string;
    createdAt: string; acknowledged: boolean; acknowledging: boolean;
    onAcknowledge: (id: string) => void;
}

const SEV: Record<string, { icon: typeof AlertTriangle; color: string; bg: string }> = {
    high: { icon: AlertTriangle, color: '#e11d48', bg: '#fef2f2' },
    medium: { icon: AlertCircle, color: '#d97706', bg: '#fffbeb' },
    low: { icon: Info, color: '#1a6de0', bg: '#eff6ff' },
};

function timeAgo(iso: string) {
    try { const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000); if (m < 60) return `${m}m`; const h = Math.floor(m / 60); if (h < 24) return `${h}h`; return `${Math.floor(h / 24)}d`; } catch { return ''; }
}

export function AlertCard({ id, severity, title, message, createdAt, acknowledged, acknowledging, onAcknowledge }: Props) {
    const s = SEV[severity] || SEV.low;
    const Icon = s.icon;
    return (
        <div className={`glass rounded-[18px] p-4 ${acknowledged ? 'opacity-50' : ''}`} style={{ borderLeft: `4px solid ${s.color}`, background: s.bg + '60' }}>
            <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-[12px] flex items-center justify-center flex-shrink-0" style={{ background: s.bg, color: s.color }}>
                    <Icon className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start gap-2 mb-1">
                        <h3 className="text-[16px] font-heading font-bold text-text-heading truncate">{title}</h3>
                        <span className="text-[12px] text-text-muted flex-shrink-0">{timeAgo(createdAt)} ago</span>
                    </div>
                    <p className="text-[14px] text-text-secondary mb-3 leading-snug">{message}</p>
                    {!acknowledged && (
                        <button onClick={() => onAcknowledge(id)} disabled={acknowledging}
                                className="inline-flex items-center gap-1.5 px-4 py-[7px] rounded-[10px] text-[14px] font-heading font-semibold text-white cursor-pointer disabled:opacity-60 min-h-[36px]"
                                style={{ background: 'linear-gradient(135deg, #1a6de0, #1558b8)', boxShadow: '0 2px 8px rgba(26,109,224,0.15)' }}>
                            {acknowledging ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                            Acknowledge
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}