'use client';

import { useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { BottomNav } from '@/components/layout/BottomNav';
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton';

export default function AppLayout({ children }: { children: ReactNode }) {
    const router = useRouter();
    const { user, loading, role } = useAuth();

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
            <div className="max-w-[640px] mx-auto flex flex-col min-h-dvh">
                {children}
            </div>
            <BottomNav />
        </div>
    );
}