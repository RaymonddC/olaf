'use client';

import { useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { BottomNav } from '@/components/layout/BottomNav';
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton';

export default function AppLayout({ children }: { children: ReactNode }) {
    const router = useRouter();
    const { user, loading, role, signOut } = useAuth();

    useEffect(() => {
        if (!loading && !user) router.replace('/login');
    }, [user, loading, router]);

    useEffect(() => {
        if (!loading && user && role === 'family') router.replace('/dashboard');
    }, [user, loading, role, router]);

    if (loading) {
        return (
            <div className="min-h-dvh flex items-center justify-center">
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
        <div className="relative z-[1] min-h-dvh">
            {/* Sign out button — fixed top-right */}
            <button
                type="button"
                onClick={signOut}
                aria-label="Sign out"
                className="fixed top-4 right-4 z-50 flex items-center gap-1.5 px-3 py-2 rounded-xl text-[13px] font-heading font-semibold text-text-muted hover:text-red-600 hover:bg-red-50 transition-colors active:scale-95"
            >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">Sign out</span>
            </button>
            {/* Content: full width on all screens, pages manage their own max-width */}
            <div className="w-full flex flex-col min-h-dvh">
                {children}
            </div>
            <BottomNav />
        </div>
    );
}
