'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Mic, BookOpen, Sun } from 'lucide-react';

const NAV_ITEMS = [
    { href: '/talk', icon: Mic, label: 'Talk' },
    { href: '/memories', icon: BookOpen, label: 'Memories' },
    { href: '/my-day', icon: Sun, label: 'My Day' },
] as const;

export function BottomNav() {
    const pathname = usePathname();

    return (
        <nav aria-label="Main navigation" className="fixed bottom-0 left-0 right-0 z-30 flex justify-center px-4 pointer-events-none"
             style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 24px)' }}>
            <div
                className="flex items-center justify-around w-full max-w-[420px] lg:max-w-lg py-2 lg:py-3 px-2 rounded-3xl pointer-events-auto"
                style={{
                    background: 'rgba(255,255,255,0.92)',
                    backdropFilter: 'blur(28px)',
                    WebkitBackdropFilter: 'blur(28px)',
                    border: '1px solid rgba(255,255,255,0.85)',
                    boxShadow: '0 8px 32px rgba(15,23,42,0.08), 0 1px 3px rgba(15,23,42,0.04)',
                }}
            >
                {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
                    const isActive = pathname === href || pathname.startsWith(href + '/');
                    return (
                        <Link
                            key={href}
                            href={href}
                            aria-current={isActive ? 'page' : undefined}
                            className="flex flex-col items-center gap-1 py-2.5 px-8 rounded-[18px] min-w-[76px] min-h-[54px] lg:min-h-[60px] justify-center"
                            style={{
                                background: isActive ? 'rgba(0,137,123,0.12)' : 'transparent',
                                boxShadow: isActive ? '0 2px 8px rgba(0,137,123,0.10)' : 'none',
                                transition: 'all 0.3s cubic-bezier(0.4,0,0.2,1)',
                            }}
                        >
                            <Icon
                                className="w-5 h-5"
                                strokeWidth={isActive ? 2.5 : 2}
                                color={isActive ? '#00897b' : '#94a3b8'}
                                aria-hidden="true"
                            />
                            <span
                                className="text-[12px] font-heading font-bold"
                                style={{ color: isActive ? '#00897b' : '#94a3b8' }}
                            >
                                {label}
                            </span>
                        </Link>
                    );
                })}
            </div>
        </nav>
    );
}
