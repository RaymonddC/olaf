'use client';

export function MemoryCardSkeleton() {
    return (
        <div role="status" aria-busy className="glass rounded-[22px] overflow-hidden">
            <div className="flex min-h-[140px]">
                <div className="w-[110px] flex-shrink-0 animate-skeleton" style={{ background: 'linear-gradient(160deg, #dbeafe60, #ccfbf160)' }} />
                <div className="flex-1 p-4 space-y-3">
                    <div className="h-5 bg-bg-muted/50 rounded-md w-3/4 animate-skeleton" />
                    <div className="h-3 bg-bg-muted/40 rounded-md w-1/3 animate-skeleton" />
                    <div className="space-y-2 pt-1">
                        <div className="h-3.5 bg-bg-muted/40 rounded-md w-full animate-skeleton" />
                        <div className="h-3.5 bg-bg-muted/40 rounded-md w-5/6 animate-skeleton" />
                    </div>
                </div>
            </div>
        </div>
    );
}