export type SkeletonShape = 'text' | 'heading' | 'card' | 'avatar' | 'thumbnail';

interface LoadingSkeletonProps {
  shape?: SkeletonShape;
  /** For 'text' and 'heading' shapes, explicit width override */
  width?: string;
  /** Repeat N skeleton lines (for text shapes) */
  lines?: number;
  /** Avatar sizes */
  avatarSize?: 'md' | 'lg' | 'xl';
  className?: string;
}

const avatarSizeClasses = {
  md: 'w-10 h-10',
  lg: 'w-14 h-14',
  xl: 'w-20 h-20',
};

function SkeletonBase({ className }: { className: string }) {
  return (
    <div
      className={`bg-bg-muted animate-skeleton ${className}`}
      aria-hidden="true"
    />
  );
}

export function LoadingSkeleton({
  shape = 'text',
  width,
  lines = 1,
  avatarSize = 'md',
  className = '',
}: LoadingSkeletonProps) {
  const wrapperProps = {
    role: 'status' as const,
    'aria-busy': true,
    'aria-label': 'Loading content',
  };

  if (shape === 'avatar') {
    return (
      <div {...wrapperProps}>
        <SkeletonBase
          className={`${avatarSizeClasses[avatarSize]} rounded-full ${className}`}
        />
      </div>
    );
  }

  if (shape === 'card') {
    return (
      <div {...wrapperProps}>
        <SkeletonBase className={`h-48 rounded-2xl ${className}`} />
      </div>
    );
  }

  if (shape === 'thumbnail') {
    return (
      <div {...wrapperProps}>
        <SkeletonBase className={`aspect-[4/3] rounded-xl ${className}`} />
      </div>
    );
  }

  if (shape === 'heading') {
    return (
      <div {...wrapperProps}>
        <SkeletonBase
          className={`h-7 rounded-md ${width ?? 'w-3/4'} ${className}`}
        />
      </div>
    );
  }

  // Default: text lines
  if (lines === 1) {
    return (
      <div {...wrapperProps}>
        <SkeletonBase
          className={`h-4 rounded-md ${width ?? 'w-full'} ${className}`}
        />
      </div>
    );
  }

  return (
    <div {...wrapperProps} className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <SkeletonBase
          key={i}
          className={`h-4 rounded-md ${i === lines - 1 ? 'w-3/4' : 'w-full'}`}
        />
      ))}
    </div>
  );
}
