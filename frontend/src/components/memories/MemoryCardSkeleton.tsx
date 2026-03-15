'use client';

export function MemoryCardSkeleton() {
    return (
        <div role="status" aria-busy className="flex items-center gap-4 rounded-2xl p-4"
             style={{ background: 'rgba(255,255,255,0.5)' }}>
            <div className="w-14 h-14 flex-shrink-0 rounded-2xl animate-skeleton" style={{ background: 'rgba(148,163,184,0.12)' }} />
            <div className="flex-1 space-y-2.5">
                <div className="h-5 rounded-md w-2/3 animate-skeleton" style={{ background: 'rgba(148,163,184,0.12)' }} />
                <div className="h-4 rounded-md w-full animate-skeleton" style={{ background: 'rgba(148,163,184,0.08)' }} />
            </div>
        </div>
    );
}
