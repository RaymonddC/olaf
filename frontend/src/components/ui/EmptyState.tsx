'use client';

import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';

interface Props { icon: LucideIcon; title: string; message: string; action?: { label: string; href: string }; }

export function EmptyState({ icon: Icon, title, message, action }: Props) {
    return (
        <div className="flex flex-col items-center justify-center text-center py-16 px-4 animate-fade-up">
            <div className="w-20 h-20 rounded-[22px] flex items-center justify-center mb-5" style={{ background: 'linear-gradient(135deg, #dbeafe, #ccfbf1)', border: '1.5px solid #e2e8f0' }}>
                <Icon className="w-9 h-9 text-primary-500" />
            </div>
            <h2 className="text-h3 font-heading font-extrabold text-text-heading mb-2">{title}</h2>
            <p className="text-body text-text-muted max-w-xs mb-6">{message}</p>
            {action && (
                <Link href={action.href}
                      className="inline-flex items-center gap-2 px-7 py-3 rounded-2xl text-white font-heading font-semibold min-h-[48px]"
                      style={{ background: 'linear-gradient(135deg, #1a6de0, #1558b8)', boxShadow: '0 6px 24px rgba(26,109,224,0.18)' }}>
                    {action.label}
                </Link>
            )}
        </div>
    );
}