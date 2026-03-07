'use client';

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'lg' | 'xl';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: ButtonVariant;
    size?: ButtonSize;
    loading?: boolean;
    children: ReactNode;
}

const VARIANT: Record<ButtonVariant, { bg: string; color: string; shadow: string; border: string }> = {
    primary: { bg: 'linear-gradient(135deg, #1a6de0, #1558b8)', color: '#fff', shadow: '0 6px 24px rgba(26,109,224,0.18), 0 2px 6px rgba(15,23,42,0.06)', border: 'none' },
    secondary: { bg: 'rgba(255,255,255,0.9)', color: '#1a6de0', shadow: '0 2px 12px rgba(15,23,42,0.05)', border: '1.5px solid #e2e8f0' },
    ghost: { bg: 'transparent', color: '#1a6de0', shadow: 'none', border: 'none' },
    danger: { bg: 'linear-gradient(135deg, #e11d48, #be123c)', color: '#fff', shadow: '0 6px 24px rgba(225,29,72,0.18)', border: 'none' },
};

const SIZE: Record<ButtonSize, string> = {
    lg: 'px-7 py-4 text-[17px] min-h-[56px]',
    xl: 'px-8 py-4 text-[18px] min-h-[60px]',
};

const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
    { variant = 'primary', size = 'lg', loading = false, disabled, children, className = '', style: extraStyle, ...props }, ref
) {
    const v = VARIANT[variant];
    return (
        <button ref={ref} disabled={disabled || loading} aria-busy={loading || undefined}
                className={`inline-flex items-center justify-center gap-2 cursor-pointer font-heading font-semibold rounded-2xl active:scale-[0.97] transition-transform duration-150 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary-300 disabled:opacity-60 disabled:cursor-not-allowed disabled:active:scale-100 ${SIZE[size]} ${className}`}
                style={{ background: v.bg, color: v.color, boxShadow: v.shadow, border: v.border, letterSpacing: '0.01em', backdropFilter: variant === 'secondary' ? 'blur(12px)' : undefined, ...extraStyle }}
                {...props}
        >
            {loading && <Loader2 className="w-5 h-5 animate-spin flex-shrink-0" />}
            {children}
        </button>
    );
});

Button.displayName = 'Button';
export { Button };
export type { ButtonProps };