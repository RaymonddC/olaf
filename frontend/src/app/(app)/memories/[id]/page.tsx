'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState, useCallback } from 'react';
import { ArrowLeft, Share2, ChevronLeft, ChevronRight } from 'lucide-react';

import { Header } from '@/components/layout/Header';
import { PageShell } from '@/components/layout/PageShell';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { useMemory } from '@/hooks/useApi';
import { useAuth } from '@/contexts/AuthContext';

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

function MemoryDetailSkeleton() {
  return (
    <div role="status" aria-busy={true} aria-label="Loading memory" className="space-y-6">
      <div className="aspect-[4/3] w-full bg-bg-muted rounded-2xl animate-skeleton" />
      <div className="space-y-4">
        <div className="h-8 bg-bg-muted rounded-md w-3/4 animate-skeleton" />
        <div className="h-4 bg-bg-muted rounded-md w-1/3 animate-skeleton" />
        <div className="space-y-3 pt-4">
          <div className="h-4 bg-bg-muted rounded-md w-full animate-skeleton" />
          <div className="h-4 bg-bg-muted rounded-md w-full animate-skeleton" />
          <div className="h-4 bg-bg-muted rounded-md w-5/6 animate-skeleton" />
          <div className="h-4 bg-bg-muted rounded-md w-full animate-skeleton" />
          <div className="h-4 bg-bg-muted rounded-md w-2/3 animate-skeleton" />
        </div>
      </div>
    </div>
  );
}

function ImageGallery({ urls, title }: { urls: string[]; title: string }) {
  const [current, setCurrent] = useState(0);
  const count = urls.length;

  const goNext = useCallback(() => {
    setCurrent((prev) => (prev + 1) % count);
  }, [count]);

  const goPrev = useCallback(() => {
    setCurrent((prev) => (prev - 1 + count) % count);
  }, [count]);

  if (count === 0) return null;

  if (count === 1) {
    return (
      <div className="aspect-[4/3] w-full rounded-2xl overflow-hidden bg-bg-muted relative">
        <Image
          src={urls[0]}
          alt={`Illustration for ${title}`}
          fill
          sizes="(max-width: 768px) 100vw, 768px"
          className="object-cover"
          priority
        />
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="aspect-[4/3] w-full rounded-2xl overflow-hidden bg-bg-muted relative">
        <Image
          src={urls[current]}
          alt={`Illustration ${current + 1} of ${count} for ${title}`}
          fill
          sizes="(max-width: 768px) 100vw, 768px"
          className="object-cover"
          priority
        />
      </div>

      {/* Navigation arrows */}
      <button
        onClick={goPrev}
        aria-label="Previous illustration"
        className={[
          'absolute left-3 top-1/2 -translate-y-1/2',
          'w-12 h-12 rounded-full bg-bg-surface/90 shadow-md',
          'flex items-center justify-center',
          'text-text-primary hover:bg-bg-surface',
          'transition-colors duration-150',
          'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary-300',
        ].join(' ')}
      >
        <ChevronLeft className="w-6 h-6" aria-hidden="true" />
      </button>
      <button
        onClick={goNext}
        aria-label="Next illustration"
        className={[
          'absolute right-3 top-1/2 -translate-y-1/2',
          'w-12 h-12 rounded-full bg-bg-surface/90 shadow-md',
          'flex items-center justify-center',
          'text-text-primary hover:bg-bg-surface',
          'transition-colors duration-150',
          'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary-300',
        ].join(' ')}
      >
        <ChevronRight className="w-6 h-6" aria-hidden="true" />
      </button>

      {/* Dot indicators */}
      <div className="flex items-center justify-center gap-2 mt-3" role="tablist">
        {urls.map((_, i) => (
          <button
            key={i}
            role="tab"
            aria-selected={i === current}
            aria-label={`Go to illustration ${i + 1}`}
            onClick={() => setCurrent(i)}
            className={[
              'w-3 h-3 rounded-full transition-colors duration-150',
              'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary-300',
              i === current ? 'bg-primary-700' : 'bg-bg-muted',
            ].join(' ')}
          />
        ))}
      </div>
    </div>
  );
}

export default function MemoryDetailPage() {
  const params = useParams();
  const memoryId = params.id as string;
  const { user } = useAuth();
  const userId = user?.uid ?? '';

  const { data: memory, isLoading, isError } = useMemory(memoryId, userId);

  const handleShare = useCallback(async () => {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({
          title: memory?.title ?? 'A Memory from OLAF',
          url,
        });
      } catch {
        // User cancelled or share failed — ignore
      }
    } else {
      await navigator.clipboard.writeText(url);
      // Could add a toast here
    }
  }, [memory?.title]);

  return (
    <>
      <Header
        title={memory?.title ?? 'Memory'}
        action={
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="lg"
              onClick={handleShare}
              aria-label="Share this memory"
            >
              <Share2 className="w-5 h-5" aria-hidden="true" />
              <span className="hidden sm:inline">Share</span>
            </Button>
          </div>
        }
      />

      <PageShell id="memory-detail">
        {/* Back navigation */}
        <nav aria-label="Back to memories" className="mb-6">
          <Link
            href="/memories"
            className={[
              'inline-flex items-center gap-2 text-body text-primary-700 font-medium',
              'hover:text-primary-800 transition-colors duration-150',
              'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary-300 rounded-lg',
              'min-h-[48px] px-2',
            ].join(' ')}
          >
            <ArrowLeft className="w-5 h-5" aria-hidden="true" />
            Back to Memories
          </Link>
        </nav>

        {/* Loading */}
        {isLoading && <MemoryDetailSkeleton />}

        {/* Error */}
        {isError && !isLoading && (
          <div className="text-center py-16">
            <p className="text-body text-text-secondary mb-4">
              We couldn&apos;t load this memory. It may have been removed.
            </p>
            <Link
              href="/memories"
              className={[
                'inline-flex items-center justify-center gap-2',
                'bg-primary-700 text-white font-semibold rounded-xl shadow-md',
                'px-6 py-3 text-body min-h-[48px]',
                'hover:bg-primary-800 transition-colors duration-150',
                'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary-300',
              ].join(' ')}
            >
              Back to Memories
            </Link>
          </div>
        )}

        {/* Memory content */}
        {!isLoading && !isError && memory && (
          <article className="space-y-6">
            {/* Image gallery */}
            {memory.illustrationUrls.length > 0 && (
              <ImageGallery urls={memory.illustrationUrls} title={memory.title} />
            )}

            {/* Title and date */}
            <header>
              <h2 className="text-h1 font-heading text-text-heading font-bold">
                {memory.title}
              </h2>
              <time
                dateTime={memory.createdAt}
                className="block text-body-sm text-text-muted mt-2"
              >
                {formatDate(memory.createdAt)}
              </time>
            </header>

            {/* Narrative text */}
            <div className="prose-olaf">
              {memory.narrativeText.split('\n\n').map((paragraph, i) => (
                <p
                  key={i}
                  className="text-body text-text-primary leading-relaxed mb-4"
                >
                  {paragraph}
                </p>
              ))}
            </div>

            {/* Tags */}
            {memory.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-4 border-t border-border-default">
                {memory.tags.map((tag) => (
                  <Badge
                    key={tag}
                    variant={{ kind: 'status', status: 'active' }}
                    size="sm"
                  >
                    {tag}
                  </Badge>
                ))}
              </div>
            )}
          </article>
        )}
      </PageShell>
    </>
  );
}
