'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useCallback, type KeyboardEvent } from 'react';

interface MemoryChapterCardProps {
  id: string;
  title: string;
  createdAt: string;
  illustrationUrls: string[];
  snippet: string;
  className?: string;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

export function MemoryChapterCard({
  id,
  title,
  createdAt,
  illustrationUrls,
  snippet,
  className = '',
}: MemoryChapterCardProps) {
  const router = useRouter();
  const thumbnailUrl = illustrationUrls[0] ?? null;

  const handleClick = useCallback(() => {
    router.push(`/memories/${id}`);
  }, [router, id]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleClick();
      }
    },
    [handleClick],
  );

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      aria-label={`Memory: ${title}`}
      className={[
        'bg-bg-surface rounded-2xl shadow-md overflow-hidden',
        'cursor-pointer hover:shadow-lg transition-shadow duration-200',
        'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary-300',
        className,
      ].join(' ')}
    >
      {/* Thumbnail */}
      <div className="aspect-[4/3] w-full bg-bg-muted relative overflow-hidden">
        {thumbnailUrl ? (
          <Image
            src={thumbnailUrl}
            alt={`Illustration for ${title}`}
            fill
            sizes="(max-width: 768px) 100vw, 50vw"
            className="object-cover"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <svg
              className="w-12 h-12 text-primary-300"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              aria-hidden="true"
            >
              <path d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-5">
        <h3 className="text-h4 font-semibold text-text-heading line-clamp-2">
          {title}
        </h3>

        <time
          dateTime={createdAt}
          className="block text-caption text-text-muted mt-1"
        >
          {formatDate(createdAt)}
        </time>

        {snippet && (
          <p className="text-body-sm text-text-secondary mt-2 line-clamp-3">
            {snippet}
          </p>
        )}
      </div>
    </article>
  );
}
