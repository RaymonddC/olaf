'use client';

import type { ReactNode } from 'react';

interface PageShellProps {
    children: ReactNode;
    id?: string;
    noBottomPad?: boolean;
}

export function PageShell({ children, id, noBottomPad }: PageShellProps) {
    return (
        <main
            id={id}
            role="main"
            className={`relative z-[1] px-5 pt-5 ${noBottomPad ? 'pb-8' : 'pb-28'}`}
        >
            {children}
        </main>
    );
}