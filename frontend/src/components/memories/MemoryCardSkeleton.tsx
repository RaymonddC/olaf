export function MemoryCardSkeleton() {
  return (
    <div
      role="status"
      aria-busy={true}
      aria-label="Loading memory"
      className="bg-bg-surface rounded-2xl shadow-md overflow-hidden"
    >
      {/* Thumbnail skeleton */}
      <div className="aspect-[4/3] w-full bg-bg-muted animate-skeleton" />

      {/* Content skeleton */}
      <div className="p-5 space-y-3">
        <div className="h-6 bg-bg-muted rounded-md w-3/4 animate-skeleton" />
        <div className="h-4 bg-bg-muted rounded-md w-1/3 animate-skeleton" />
        <div className="space-y-2">
          <div className="h-4 bg-bg-muted rounded-md w-full animate-skeleton" />
          <div className="h-4 bg-bg-muted rounded-md w-5/6 animate-skeleton" />
        </div>
      </div>
    </div>
  );
}
