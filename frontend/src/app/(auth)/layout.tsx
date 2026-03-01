import { type ReactNode } from 'react';

/**
 * Auth route group layout — centered, no bottom navigation.
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-bg-page flex flex-col items-center justify-center px-4 py-8">
      {children}
    </div>
  );
}
