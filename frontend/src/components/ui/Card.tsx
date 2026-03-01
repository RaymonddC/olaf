import { type HTMLAttributes, type ReactNode } from 'react';

export type CardVariant = 'elevated' | 'outlined';

interface CardProps extends HTMLAttributes<HTMLElement> {
  variant?: CardVariant;
  /** Use <article> (standalone) or <section> (grouped). Default: article. */
  as?: 'article' | 'section' | 'div';
  /** Optional header content — rendered above a bottom border */
  header?: ReactNode;
  /** Optional footer content — rendered below a top border */
  footer?: ReactNode;
  /** Makes card interactive (adds hover shadow + cursor-pointer) */
  interactive?: boolean;
  children: ReactNode;
}

const variantClasses: Record<CardVariant, string> = {
  elevated: 'bg-bg-surface rounded-2xl shadow-md p-6',
  outlined: 'bg-bg-surface rounded-2xl border border-border p-6',
};

export function Card({
  variant = 'elevated',
  as: Tag = 'article',
  header,
  footer,
  interactive = false,
  children,
  className = '',
  ...props
}: CardProps) {
  return (
    <Tag
      className={[
        variantClasses[variant],
        interactive
          ? 'cursor-pointer hover:shadow-lg transition-shadow duration-200 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary-300'
          : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...(interactive && !props.role ? { role: 'button', tabIndex: 0 } : {})}
      {...props}
    >
      {header && (
        <div className="pb-4 border-b border-border mb-4">{header}</div>
      )}
      {children}
      {footer && (
        <div className="pt-4 border-t border-border mt-4">{footer}</div>
      )}
    </Tag>
  );
}
