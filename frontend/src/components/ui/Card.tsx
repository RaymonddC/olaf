'use client';

import type { ReactNode, HTMLAttributes } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
    children: ReactNode;
    padding?: 'sm' | 'md' | 'lg';
    hover?: boolean;
    accent?: string;
}

const PAD = { sm: 'p-4', md: 'p-5', lg: 'p-6' };

export function Card({ children, padding = 'md', hover, accent, className = '', style: extra, ...props }: CardProps) {
    return (
        <div
            className={`glass rounded-[22px] ${hover ? 'hover:shadow-lg hover:-translate-y-[3px] transition-all duration-300' : ''} ${PAD[padding]} ${className}`}
            style={{ borderLeft: accent ? `4px solid ${accent}` : undefined, ...extra }}
            {...props}
        >
            {children}
        </div>
    );
}