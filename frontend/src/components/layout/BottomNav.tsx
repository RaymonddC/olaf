'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Mic, BookOpen, HelpCircle } from 'lucide-react';

interface NavItem {
  href: string;
  icon: typeof Mic;
  label: string;
}

const NAV_ITEMS: NavItem[] = [
  { href: '/talk', icon: Mic, label: 'Talk' },
  { href: '/memories', icon: BookOpen, label: 'Memories' },
  { href: '/help', icon: HelpCircle, label: 'Help' },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Main navigation"
      className={[
        'fixed bottom-0 left-0 right-0 h-20',
        'bg-bg-surface border-t border-border',
        'flex items-center justify-around px-4',
        'z-30 pb-safe',
      ].join(' ')}
    >
      {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
        const isActive = pathname === href || pathname.startsWith(href + '/');
        return (
          <Link
            key={href}
            href={href}
            aria-current={isActive ? 'page' : undefined}
            className={[
              'flex flex-col items-center gap-1 py-2 px-4',
              'min-w-[72px] min-h-[56px] justify-center',
              'rounded-xl transition-colors duration-150',
              'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary-300',
              isActive
                ? 'text-primary-700 font-medium'
                : 'text-text-muted hover:text-text-secondary',
            ].join(' ')}
          >
            <Icon
              className="w-7 h-7"
              strokeWidth={isActive ? 2.5 : 2}
              aria-hidden="true"
            />
            <span className="text-caption font-medium">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
