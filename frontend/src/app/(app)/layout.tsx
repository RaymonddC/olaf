'use client';

import { useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { BottomNav } from '@/components/layout/BottomNav';
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton';

/**
 * App route group layout — requires auth, shows BottomNav.
 * Redirects unauthenticated users to /login.
 */
export default function AppLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-bg-page">
        <div className="w-full max-w-sm px-6 space-y-4">
          <LoadingSkeleton shape="heading" />
          <LoadingSkeleton shape="text" lines={3} />
          <LoadingSkeleton shape="card" />
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-dvh bg-bg-page">
      {children}
      <BottomNav />
    </div>
  );
}
