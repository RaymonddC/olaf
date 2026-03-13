'use client';

import React from 'react';
import type { ReactNode, HTMLAttributes } from 'react';

export interface CardProps extends HTMLAttributes<HTMLElement> {
    children: ReactNode;
    padding?: 'sm' | 'md' | 'lg';
    hover?: boolean;
    accent?: string;
    variant?: 'default' | 'elevated' | 'outlined';
    as?: string;
    interactive?: boolean;
}

const PAD = { sm: 'p-4', md: 'p-5', lg: 'p-6' };

export function Card({ children, padding = 'md', hover, accent, variant: _variant, as: Tag = 'div', interactive, className = '', style: extra, ...props }: CardProps) {
    const Component = Tag as React.ElementType;
    return (
        <Component
            className={`glass rounded-[22px] ${hover || interactive ? 'hover:shadow-lg hover:-translate-y-[3px] transition-all duration-300' : ''} ${PAD[padding]} ${className}`}
            style={{ borderLeft: accent ? `4px solid ${accent}` : undefined, ...extra }}
            {...props}
        >
            {children}
        </Component>
    );
}