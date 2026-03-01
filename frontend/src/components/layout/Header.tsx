import { type ReactNode } from 'react';

interface HeaderProps {
  title: string;
  /** Optional action element (button, link, etc.) placed on the right */
  action?: ReactNode;
  className?: string;
}

/**
 * Simple top bar with page title + optional right-side action.
 * Sticky so it stays visible when scrolling.
 */
export function Header({ title, action, className = '' }: HeaderProps) {
  return (
    <header
      className={[
        'sticky top-0 z-20',
        'bg-bg-page/95 backdrop-blur-sm',
        'border-b border-border',
        'px-4 md:px-6 py-4',
        'flex items-center justify-between',
        'max-w-3xl mx-auto w-full',
        className,
      ].join(' ')}
    >
      <h1 className="text-h2 font-heading text-text-heading font-semibold truncate">
        {title}
      </h1>
      {action && <div className="flex-shrink-0 ml-4">{action}</div>}
    </header>
  );
}
