export type BadgeSeverity = 'low' | 'medium' | 'high';
export type BadgeStatus = 'active' | 'inactive' | 'pending';
export type BadgeSize = 'sm' | 'md';

type BadgeVariant =
  | { kind: 'severity'; severity: BadgeSeverity }
  | { kind: 'status'; status: BadgeStatus };

interface BadgeProps {
  variant: BadgeVariant;
  size?: BadgeSize;
  children: string;
  className?: string;
}

const severityClasses: Record<BadgeSeverity, string> = {
  low: 'bg-info-100 text-info-700 border border-info-600',
  medium: 'bg-warning-100 text-warning-700 border border-warning-600',
  high: 'bg-error-100 text-error-700 border border-error-600',
};

const statusClasses: Record<BadgeStatus, string> = {
  active: 'bg-success-100 text-success-700',
  inactive: 'bg-bg-muted text-text-muted',
  pending: 'bg-warning-100 text-warning-700',
};

const sizeClasses: Record<BadgeSize, string> = {
  sm: 'px-2 py-0.5 text-caption font-medium rounded-md',
  md: 'px-3 py-1 text-body-sm font-medium rounded-lg',
};

export function Badge({
  variant,
  size = 'md',
  children,
  className = '',
}: BadgeProps) {
  const colorClass =
    variant.kind === 'severity'
      ? severityClasses[variant.severity]
      : statusClasses[variant.status];

  return (
    <span
      className={['inline-flex items-center', colorClass, sizeClasses[size], className]
        .filter(Boolean)
        .join(' ')}
    >
      {children}
    </span>
  );
}
