import Image from 'next/image';

export type AvatarSize = 'md' | 'lg' | 'xl';
export type AvatarStatus = 'online' | 'away' | 'offline';

interface AvatarProps {
  name: string;
  src?: string;
  size?: AvatarSize;
  status?: AvatarStatus;
  className?: string;
}

const sizeClasses: Record<AvatarSize, string> = {
  md: 'w-10 h-10',
  lg: 'w-14 h-14',
  xl: 'w-20 h-20',
};

const initialsTextClass: Record<AvatarSize, string> = {
  md: 'text-body',
  lg: 'text-h3',
  xl: 'text-h2',
};

const pixelSizes: Record<AvatarSize, number> = {
  md: 40,
  lg: 56,
  xl: 80,
};

const statusColorClass: Record<AvatarStatus, string> = {
  online: 'bg-success-600',
  away: 'bg-warning-600',
  offline: 'bg-bg-muted',
};

const statusLabel: Record<AvatarStatus, string> = {
  online: 'Online',
  away: 'Away',
  offline: 'Offline',
};

function getInitials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase() ?? '')
    .join('');
}

export function Avatar({
  name,
  src,
  size = 'md',
  status,
  className = '',
}: AvatarProps) {
  const px = pixelSizes[size];

  return (
    <div
      className={`relative inline-flex flex-shrink-0 ${sizeClasses[size]} ${className}`}
    >
      {src ? (
        <Image
          src={src}
          alt={`${name}'s profile photo`}
          width={px}
          height={px}
          className="rounded-full object-cover w-full h-full"
        />
      ) : (
        <div
          aria-label={name}
          className={[
            'rounded-full w-full h-full',
            'bg-primary-200 text-primary-700',
            'flex items-center justify-center font-semibold',
            'select-none',
            initialsTextClass[size],
          ].join(' ')}
        >
          {getInitials(name)}
        </div>
      )}

      {status && (
        <span
          aria-label={`Status: ${statusLabel[status]}`}
          className={[
            'absolute bottom-0 right-0',
            'w-3.5 h-3.5 rounded-full',
            'border-2 border-bg-surface',
            statusColorClass[status],
          ].join(' ')}
        />
      )}
    </div>
  );
}
