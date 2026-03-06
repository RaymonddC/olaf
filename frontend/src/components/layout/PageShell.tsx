import { type ReactNode } from 'react';

interface PageShellProps {
  children: ReactNode;
  id?: string;
  /** Remove bottom padding for bottom nav (e.g. family pages) */
  noBottomPad?: boolean;
  className?: string;
}

/**
 * Page-level container. Sets max-width, horizontal padding, and bottom
 * padding so content is never hidden behind the fixed BottomNav.
 */
export function PageShell({
  children,
  id = 'main-content',
  noBottomPad = false,
  className = '',
}: PageShellProps) {
  return (
    <>
      <main
        id={id}
        className={[
          'w-full max-w-3xl mx-auto',
          'px-4 md:px-6',
          'pt-4 md:pt-6',
          noBottomPad ? 'pb-8' : 'pb-24',   // 96px covers 80px nav + 16px safety
          className,
        ].join(' ')}
      >
        {children}
      </main>
    </>
  );
}
