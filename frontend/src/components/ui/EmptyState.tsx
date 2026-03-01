import Link from 'next/link';
import { type LucideIcon } from 'lucide-react';
import { Button } from './Button';

interface EmptyStateProps {
  /** Lucide icon displayed as decorative illustration */
  icon?: LucideIcon;
  title: string;
  message: string;
  /** Optional CTA — provide either `href` (Link) or `onClick` (Button) */
  action?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  message,
  action,
  className = '',
}: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center py-16 px-6 text-center ${className}`}
    >
      {Icon && (
        <div
          className="w-24 h-24 mb-6 text-primary-300 flex items-center justify-center"
          aria-hidden="true"
        >
          <Icon className="w-16 h-16" strokeWidth={1.5} />
        </div>
      )}

      <h2 className="text-h3 text-text-heading font-semibold mb-2">{title}</h2>

      <p className="text-body text-text-secondary max-w-sm mb-6 leading-relaxed">
        {message}
      </p>

      {action &&
        (action.href ? (
          <Link
            href={action.href}
            className={[
              'inline-flex items-center justify-center gap-2',
              'bg-primary-700 text-white font-semibold rounded-xl shadow-md',
              'px-6 py-3 text-body min-h-[48px]',
              'hover:bg-primary-800 active:bg-primary-900',
              'transition-colors duration-150',
              'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary-300',
            ].join(' ')}
          >
            {action.label}
          </Link>
        ) : (
          <Button variant="primary" size="lg" onClick={action.onClick}>
            {action.label}
          </Button>
        ))}
    </div>
  );
}
