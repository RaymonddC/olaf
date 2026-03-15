'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState, useCallback } from 'react';
import { ArrowLeft, Share2, ChevronLeft, ChevronRight } from 'lucide-react';

import { Badge } from '@/components/ui/Badge';
import { useMemory } from '@/hooks/useApi';
import { useAuth } from '@/contexts/AuthContext';

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    const date = d.toLocaleDateString('en-US', {
      weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
    });
    const time = d.toLocaleTimeString('en-US', {
      hour: 'numeric', minute: '2-digit', hour12: true,
    });
    return `${date} · ${time}`;
  } catch { return iso; }
}

function MemoryDetailSkeleton() {
  return (
    <div role="status" aria-busy={true} aria-label="Loading memory"
         className="rounded-2xl p-6 lg:p-8 space-y-5"
         style={{ background: 'rgba(255,252,248,0.95)', border: '1px solid rgba(220,210,190,0.4)' }}>
      <div className="h-8 rounded-md w-2/3 animate-skeleton" style={{ background: 'rgba(180,165,140,0.12)' }} />
      <div className="h-5 rounded-md w-1/2 animate-skeleton" style={{ background: 'rgba(180,165,140,0.08)' }} />
      <div className="h-px" style={{ background: 'rgba(180,165,140,0.15)' }} />
      <div className="flex gap-5">
        <div className="flex-1 space-y-3">
          {[1,2,3,4,5].map(i => <div key={i} className="h-5 rounded-md animate-skeleton" style={{ width: `${70 + (i % 3) * 10}%`, background: 'rgba(180,165,140,0.08)' }} />)}
        </div>
        <div className="w-[200px] flex-shrink-0 rounded-xl animate-skeleton" style={{ aspectRatio: '4/3', background: 'rgba(180,165,140,0.1)' }} />
      </div>
    </div>
  );
}

function ImageGallery({ urls, title }: { urls: string[]; title: string }) {
  const [current, setCurrent] = useState(0);
  const count = urls.length;
  const goNext = useCallback(() => setCurrent(p => (p + 1) % count), [count]);
  const goPrev = useCallback(() => setCurrent(p => (p - 1 + count) % count), [count]);

  if (count === 0) return null;

  return (
    <div className="relative">
      <div className="w-full rounded-xl overflow-hidden relative"
           style={{ background: 'linear-gradient(135deg, #f5f0e8, #eee8dc)', aspectRatio: '4/3' }}>
        <Image
          src={urls[current]}
          alt={count > 1 ? `Image ${current + 1} of ${count} for ${title}` : `Image for ${title}`}
          fill
          sizes="240px"
          className="object-contain"
          priority
        />
      </div>

      {count > 1 && (
        <>
          <button onClick={goPrev} aria-label="Previous image"
            className="absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full flex items-center justify-center transition-colors active:scale-95 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary-300"
            style={{ background: 'rgba(255,255,255,0.9)', boxShadow: '0 2px 8px rgba(15,23,42,0.10)' }}>
            <ChevronLeft className="w-5 h-5 text-text-primary" aria-hidden="true" />
          </button>
          <button onClick={goNext} aria-label="Next image"
            className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full flex items-center justify-center transition-colors active:scale-95 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary-300"
            style={{ background: 'rgba(255,255,255,0.9)', boxShadow: '0 2px 8px rgba(15,23,42,0.10)' }}>
            <ChevronRight className="w-5 h-5 text-text-primary" aria-hidden="true" />
          </button>

          <div className="flex items-center justify-center gap-2 mt-2" role="tablist">
            {urls.map((_, i) => (
              <button key={i} role="tab" aria-selected={i === current} aria-label={`Go to image ${i + 1}`}
                onClick={() => setCurrent(i)}
                className={`w-2.5 h-2.5 rounded-full transition-colors duration-150 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary-300 ${i === current ? 'bg-amber-700' : 'bg-amber-200'}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default function MemoryDetailPage() {
  const params = useParams();
  const memoryId = params.id as string;
  const { user } = useAuth();
  const { data: memory, isLoading, isError } = useMemory(memoryId, user?.uid ?? '');

  const handleShare = useCallback(async () => {
    const url = window.location.href;
    if (navigator.share) {
      try { await navigator.share({ title: memory?.title ?? 'A Memory', url }); } catch {}
    } else {
      await navigator.clipboard.writeText(url);
    }
  }, [memory?.title]);

  return (
    <div className="flex flex-col h-dvh">
      <header
        className="sticky top-0 z-20 flex items-center gap-3 px-5 py-2 min-h-[60px]"
        style={{
          background: 'rgba(240,244,248,0.85)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          borderBottom: '1px solid rgba(241,245,249,0.9)',
        }}
      >
        <Link
          href="/memories"
          className="flex items-center gap-2 text-primary-700 font-heading font-semibold text-[16px] hover:text-primary-800 transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary-300 rounded-xl px-2 min-h-[48px] active:scale-95"
        >
          <ArrowLeft className="w-5 h-5" aria-hidden="true" />
          <span>Memories</span>
        </Link>

        <div className="flex-1" />

        <button
          type="button"
          onClick={handleShare}
          aria-label="Share this memory"
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[15px] font-heading font-semibold transition-all focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary-300 active:scale-95 min-h-[48px]"
          style={{ background: 'rgba(26,109,224,0.08)', color: '#1a6de0' }}
        >
          <Share2 className="w-5 h-5" aria-hidden="true" />
          <span>Share</span>
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-5 py-5 pb-32 lg:px-10 lg:py-8 lg:pb-36">
        <div className="max-w-3xl mx-auto w-full">

          {isLoading && <MemoryDetailSkeleton />}

          {isError && !isLoading && (
            <div className="text-center py-16">
              <p className="text-[17px] text-text-secondary mb-6">We couldn&apos;t load this memory.</p>
              <Link href="/memories"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-[16px] font-heading font-semibold text-white transition-colors active:scale-95 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary-300"
                style={{ background: 'linear-gradient(135deg, #1a6de0, #2563eb)' }}>
                <ArrowLeft className="w-5 h-5" />
                Back to Memories
              </Link>
            </div>
          )}

          {!isLoading && !isError && memory && (
            <article
              className="rounded-2xl overflow-hidden"
              style={{
                background: 'linear-gradient(170deg, rgba(255,253,250,0.97), rgba(255,249,240,0.95))',
                border: '1px solid rgba(220,210,190,0.4)',
                boxShadow: '0 4px 24px rgba(120,100,60,0.06), 0 1px 3px rgba(0,0,0,0.03)',
              }}
            >
              <div className="p-6 lg:p-8">
                {/* Title */}
                <h1 className="text-[22px] lg:text-[28px] font-heading font-bold leading-snug mb-2"
                    style={{ color: '#2c1f0f', letterSpacing: '-0.01em' }}>
                  {memory.title}
                </h1>

                {/* Date */}
                <p className="text-[14px] lg:text-[15px] mb-5" style={{ color: '#9c7c4a' }}>
                  {formatDate(memory.createdAt)}
                </p>

                {/* Divider */}
                <div className="h-px mb-6" style={{ background: 'linear-gradient(to right, rgba(180,165,140,0.3), rgba(180,165,140,0.1))' }} />

                {/* Narrative with image floated right */}
                <div style={{ overflow: 'hidden' }}>
                  {memory.illustrationUrls.length > 0 && (
                    <div className="float-right ml-5 mb-4 w-[160px] sm:w-[200px] lg:w-[240px]">
                      <ImageGallery urls={memory.illustrationUrls} title={memory.title} />
                    </div>
                  )}

                  <div className="space-y-4">
                    {memory.narrativeText.split('\n\n').filter((p: string) => p.trim()).map((paragraph: string, i: number) => (
                      <p key={i} className="text-[16px] lg:text-[17px] leading-[1.9]"
                         style={{ color: '#3d2e1a' }}>
                        {paragraph}
                      </p>
                    ))}
                  </div>
                </div>

                {/* Tags */}
                {memory.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-8 pt-5" style={{ borderTop: '1px solid rgba(180,165,140,0.2)' }}>
                    {memory.tags.map((tag: string) => (
                      <span key={tag} className="px-3 py-1 rounded-full text-[13px] lg:text-[14px] font-heading font-medium"
                            style={{ background: 'rgba(180,165,140,0.12)', color: '#7c6a4a' }}>
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </article>
          )}

        </div>
      </div>
    </div>
  );
}
