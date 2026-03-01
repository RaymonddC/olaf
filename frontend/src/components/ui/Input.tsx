'use client';

import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';
import { AlertCircle } from 'lucide-react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  /** Must always be provided — no placeholder-only labels */
  label: string;
  /** Error message displayed below the input */
  error?: string;
  /** Helper text displayed below the input (hidden when error is shown) */
  helperText?: string;
  /** Wrapping container className */
  containerClassName?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  {
    label,
    error,
    helperText,
    id,
    disabled,
    containerClassName = '',
    className = '',
    ...props
  },
  ref,
) {
  const inputId = id ?? `input-${label.toLowerCase().replace(/\s+/g, '-')}`;
  const errorId = `${inputId}-error`;
  const helperId = `${inputId}-helper`;

  const describedBy = [
    error ? errorId : null,
    !error && helperText ? helperId : null,
  ]
    .filter(Boolean)
    .join(' ') || undefined;

  return (
    <div className={containerClassName}>
      <label
        htmlFor={inputId}
        className="block text-body font-medium text-text-primary mb-2"
      >
        {label}
      </label>

      <input
        ref={ref}
        id={inputId}
        disabled={disabled}
        aria-describedby={describedBy}
        aria-invalid={error ? 'true' : undefined}
        className={[
          'w-full px-4 py-3 text-body text-text-primary',
          'bg-bg-surface border-2 rounded-lg',
          'placeholder:text-text-muted',
          'transition-colors duration-150',
          'min-h-[52px]',
          'focus:outline-none focus:ring-4',
          error
            ? 'border-error-600 focus:border-error-600 focus:ring-error-100'
            : 'border-border-strong focus:border-primary-700 focus:ring-primary-300',
          disabled
            ? 'bg-bg-muted border-border text-text-muted cursor-not-allowed'
            : '',
          className,
        ]
          .filter(Boolean)
          .join(' ')}
        {...props}
      />

      {error && (
        <p
          id={errorId}
          role="alert"
          className="mt-2 text-caption text-error-700 flex items-center gap-1.5"
        >
          <AlertCircle className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}

      {!error && helperText && (
        <p id={helperId} className="mt-2 text-caption text-text-muted">
          {helperText}
        </p>
      )}
    </div>
  );
});

Input.displayName = 'Input';

export { Input };
export type { InputProps };
