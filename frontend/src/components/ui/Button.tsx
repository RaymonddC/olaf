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

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'bg-primary-700 text-white font-semibold rounded-xl shadow-md ' +
    'hover:bg-primary-800 active:bg-primary-900 active:shadow-sm ' +
    'disabled:bg-bg-muted disabled:text-text-muted disabled:cursor-not-allowed disabled:shadow-none',
  secondary:
    'bg-white text-primary-700 font-semibold rounded-xl border-2 border-primary-300 shadow-sm ' +
    'hover:bg-primary-50 hover:border-primary-400 active:bg-primary-100 ' +
    'disabled:bg-bg-muted disabled:text-text-muted disabled:border-border disabled:cursor-not-allowed',
  ghost:
    'bg-transparent text-primary-700 font-semibold rounded-xl ' +
    'hover:bg-primary-50 active:bg-primary-100 ' +
    'disabled:text-text-muted disabled:cursor-not-allowed',
  danger:
    'bg-error-700 text-white font-semibold rounded-xl shadow-md ' +
    'hover:bg-red-800 active:bg-red-900 ' +
    'disabled:bg-bg-muted disabled:text-text-muted disabled:cursor-not-allowed disabled:shadow-none',
};

const sizeClasses: Record<ButtonSize, string> = {
  lg: 'px-6 py-3 text-body min-h-[48px]',
  xl: 'px-8 py-4 text-body-lg min-h-[56px]',
};

const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'primary',
    size = 'lg',
    loading = false,
    disabled,
    children,
    className = '',
    ...props
  },
  ref,
) {
  const isDisabled = disabled || loading;

  return (
    <button
      ref={ref}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      aria-disabled={isDisabled || undefined}
      className={[
        'inline-flex items-center justify-center gap-2 cursor-pointer',
        'transition-colors duration-150',
        'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary-300',
        variantClasses[variant],
        sizeClasses[size],
        loading ? 'opacity-80 cursor-wait' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...props}
    >
      {loading && (
        <Loader2
          className="w-5 h-5 animate-spin flex-shrink-0"
          aria-hidden="true"
        />
      )}
      {children}
    </button>
  );
});

Button.displayName = 'Button';

export { Button };
export type { ButtonProps };
