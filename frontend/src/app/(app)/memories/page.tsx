'use client';

import Link from 'next/link';
import { useState } from 'react';
import { BookOpen } from 'lucide-react';

import { Header } from '@/components/layout/Header';
import { PageShell } from '@/components/layout/PageShell';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { MemoryChapterCard } from '@/components/memories/MemoryChapterCard';
import { MemoryCardSkeleton } from '@/components/memories/MemoryCardSkeleton';
import { useMemories } from '@/hooks/useApi';
import { useAuth } from '@/contexts/AuthContext';

const PAGE_SIZE = 20;

export default function MemoriesPage() {
  const { user } = useAuth();
  const userId = user?.uid ?? '';
  const [offset, setOffset] = useState(0);

  const { data, isLoading, isError } = useMemories(userId, PAGE_SIZE, offset);

  const memories = data?.memories ?? [];
  const total = data?.total ?? 0;
  const hasMore = data?.hasMore ?? false;
  const hasPrevious = offset > 0;

  const handleNext = () => setOffset((prev) => prev + PAGE_SIZE);
  const handlePrevious = () => setOffset((prev) => Math.max(0, prev - PAGE_SIZE));

  return (
    <>
      <Header
        title="My Memories"
        action={
          <Link
            href="/talk"
            className={[
              'inline-flex items-center justify-center gap-2',
              'bg-primary-700 text-white font-semibold rounded-xl shadow-md',
              'px-8 py-4 text-body-lg min-h-[56px]',
              'hover:bg-primary-800 active:bg-primary-900 active:shadow-sm',
              'transition-colors duration-150',
              'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary-300',
              'hidden md:inline-flex',
            ].join(' ')}
          >
            Tell a Story
          </Link>
        }
      />

      <PageShell id="memories-content">
        {/* Mobile "Tell a Story" CTA */}
        <div className="md:hidden mb-6">
          <Link
            href="/talk"
            className={[
              'flex items-center justify-center gap-2 w-full',
              'bg-primary-700 text-white font-semibold rounded-xl shadow-md',
              'px-8 py-4 text-body-lg min-h-[56px]',
              'hover:bg-primary-800 active:bg-primary-900 active:shadow-sm',
              'transition-colors duration-150',
              'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary-300',
            ].join(' ')}
          >
            Tell a Story
          </Link>
        </div>

        {/* Loading state */}
        {isLoading && (
          <div
            className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6"
            aria-label="Loading memories"
          >
            {Array.from({ length: 4 }).map((_, i) => (
              <MemoryCardSkeleton key={i} />
            ))}
          </div>
        )}

        {/* Error state */}
        {isError && !isLoading && (
          <EmptyState
            icon={BookOpen}
            title="Something went wrong"
            message="We couldn't load your memories. Please try again."
            action={{
              label: 'Try again',
              onClick: () => setOffset(0),
            }}
          />
        )}

        {/* Empty state */}
        {!isLoading && !isError && memories.length === 0 && (
          <EmptyState
            icon={BookOpen}
            title="No memories yet"
            message="Tell CARIA about your favourite memory to get started. Your stories will be beautifully illustrated and saved here."
            action={{ label: 'Tell a Story', href: '/talk' }}
          />
        )}

        {/* Memory grid */}
        {!isLoading && !isError && memories.length > 0 && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
              {memories.map((memory) => (
                <MemoryChapterCard
                  key={memory.id}
                  id={memory.id}
                  title={memory.title}
                  createdAt={memory.createdAt}
                  illustrationUrls={memory.illustrationUrls}
                  snippet={memory.snippet}
                />
              ))}
            </div>

            {/* Pagination */}
            {(hasPrevious || hasMore) && (
              <nav
                aria-label="Memory pages"
                className="flex items-center justify-center gap-4 mt-8"
              >
                <Button
                  variant="secondary"
                  size="lg"
                  disabled={!hasPrevious}
                  onClick={handlePrevious}
                  aria-label="Previous page"
                >
                  Previous
                </Button>
                <span className="text-body-sm text-text-muted">
                  {offset + 1}–{Math.min(offset + PAGE_SIZE, total)} of {total}
                </span>
                <Button
                  variant="secondary"
                  size="lg"
                  disabled={!hasMore}
                  onClick={handleNext}
                  aria-label="Next page"
                >
                  Next
                </Button>
              </nav>
            )}
          </>
        )}
      </PageShell>
    </>
  );
}
