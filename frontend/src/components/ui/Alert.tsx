'use client';

import { useState, type ReactNode } from 'react';
import {
  Info,
  CheckCircle,
  AlertTriangle,
  AlertCircle,
  X,
} from 'lucide-react';

export type AlertVariant = 'info' | 'success' | 'warning' | 'error';

interface AlertProps {
  variant: AlertVariant;
  title: string;
  description?: string;
  /** Optional action link/button */
  action?: ReactNode;
  /** Show a dismiss (×) button */
  dismissible?: boolean;
  /** Called when dismissed */
  onDismiss?: () => void;
  className?: string;
}

const variantConfig: Record<
  AlertVariant,
  {
    container: string;
    icon: typeof Info;
    iconColor: string;
    textColor: string;
    role: 'alert' | 'status';
    ariaLive: 'assertive' | 'polite';
  }
> = {
  info: {
    container: 'bg-info-50 border border-info-600',
    icon: Info,
    iconColor: 'text-info-700',
    textColor: 'text-info-700',
    role: 'status',
    ariaLive: 'polite',
  },
  success: {
    container: 'bg-success-50 border border-success-600',
    icon: CheckCircle,
    iconColor: 'text-success-700',
    textColor: 'text-success-700',
    role: 'status',
    ariaLive: 'polite',
  },
  warning: {
    container: 'bg-warning-50 border border-warning-600',
    icon: AlertTriangle,
    iconColor: 'text-warning-700',
    textColor: 'text-warning-700',
    role: 'alert',
    ariaLive: 'assertive',
  },
  error: {
    container: 'bg-error-50 border border-error-600',
    icon: AlertCircle,
    iconColor: 'text-error-700',
    textColor: 'text-error-700',
    role: 'alert',
    ariaLive: 'assertive',
  },
};

export function Alert({
  variant,
  title,
  description,
  action,
  dismissible = false,
  onDismiss,
  className = '',
}: AlertProps) {
  const [dismissed, setDismissed] = useState(false);
  const cfg = variantConfig[variant];
  const Icon = cfg.icon;

  if (dismissed) return null;

  const handleDismiss = () => {
    setDismissed(true);
    onDismiss?.();
  };

  return (
    <div
      role={cfg.role}
      aria-live={cfg.ariaLive}
      className={[
        'rounded-xl p-4 flex items-start gap-3',
        cfg.container,
        className,
      ].join(' ')}
    >
      <Icon
        className={`w-6 h-6 flex-shrink-0 mt-0.5 ${cfg.iconColor}`}
        aria-hidden="true"
      />

      <div className="flex-1 min-w-0">
        <p className={`text-body font-semibold ${cfg.textColor}`}>{title}</p>
        {description && (
          <p className="text-body-sm text-text-primary mt-1">{description}</p>
        )}
        {action && (
          <div className={`mt-3 text-body-sm font-semibold ${cfg.textColor}`}>
            {action}
          </div>
        )}
      </div>

      {dismissible && (
        <button
          onClick={handleDismiss}
          aria-label="Dismiss alert"
          className={[
            'ml-auto p-1 rounded-lg hover:bg-black/5',
            'min-w-[36px] min-h-[36px] flex items-center justify-center',
            'flex-shrink-0 transition-colors duration-150',
            'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary-300',
          ].join(' ')}
        >
          <X className="w-5 h-5" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
