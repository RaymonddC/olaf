'use client';

import type { ReactNode } from 'react';

interface HeaderProps {
    title: string;
    subtitle?: string;
    action?: ReactNode;
}

export function Header({ title, subtitle, action }: HeaderProps) {
    return (
        <header
            className="sticky top-0 z-20 flex items-center gap-3.5 px-5 py-3.5 min-h-[64px]"
            style={{
                background: 'rgba(240,244,248,0.6)',
                backdropFilter: 'blur(24px)',
                WebkitBackdropFilter: 'blur(24px)',
            }}
        >
            {/* OLAF logo mark */}
            <div className="w-9 h-9 rounded-[11px] flex items-center justify-center flex-shrink-0"
                 style={{ background: 'linear-gradient(135deg, #1a6de0, #1558b8)', boxShadow: '0 4px 16px rgba(26,109,224,0.18)' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round">
                    <circle cx="12" cy="10" r="3.5" /><path d="M6.5 19.5c0-3 2.5-5 5.5-5s5.5 2 5.5 5" />
                </svg>
            </div>
            <div className="min-w-0 flex-1">
                <h1 className="text-[19px] font-heading font-extrabold text-text-heading truncate" style={{ letterSpacing: '-0.015em' }}>
                    {title}
                </h1>
                {subtitle && <p className="text-[13px] text-text-muted truncate">{subtitle}</p>}
            </div>
            {action && <div className="flex-shrink-0 ml-2">{action}</div>}
        </header>
    );
}