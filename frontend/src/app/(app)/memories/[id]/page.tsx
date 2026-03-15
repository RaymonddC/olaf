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
    return new Date(iso).toLocaleDateString('en-US', {
      weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
    });
  } catch { return iso; }
}

function MemoryDetailSkeleton() {
  return (
    <div role="status" aria-busy={true} aria-label="Loading memory" className="space-y-6 lg:grid lg:grid-cols-2 lg:gap-10 lg:space-y-0">
      <div className="aspect-[4/3] w-full bg-bg-muted rounded-2xl animate-skeleton" />
      <div className="space-y-4">
        <div className="h-8 bg-bg-muted rounded-md w-3/4 animate-skeleton" />
        <div className="h-4 bg-bg-muted rounded-md w-1/3 animate-skeleton" />
        <div className="space-y-3 pt-4">
          {[1,2,3,4,5].map(i => <div key={i} className="h-4 bg-bg-muted rounded-md animate-skeleton" style={{ width: `${70 + (i % 3) * 10}%` }} />)}
        </div>
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
      <div className="aspect-[4/3] w-full rounded-2xl overflow-hidden bg-bg-muted relative">
        <Image
          src={urls[current]}
          alt={count > 1 ? `Illustration ${current + 1} of ${count} for ${title}` : `Illustration for ${title}`}
          fill
          sizes="(max-width: 1024px) 100vw, 50vw"
          className="object-cover"
          priority
        />
      </div>

      {count > 1 && (
        <>
          <button onClick={goPrev} aria-label="Previous illustration"
            className="absolute left-3 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full flex items-center justify-center transition-colors duration-150 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary-300"
            style={{ background: 'rgba(255,255,255,0.92)', boxShadow: '0 2px 8px rgba(15,23,42,0.10)' }}>
            <ChevronLeft className="w-6 h-6 text-text-primary" aria-hidden="true" />
          </button>
          <button onClick={goNext} aria-label="Next illustration"
            className="absolute right-3 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full flex items-center justify-center transition-colors duration-150 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary-300"
            style={{ background: 'rgba(255,255,255,0.92)', boxShadow: '0 2px 8px rgba(15,23,42,0.10)' }}>
            <ChevronRight className="w-6 h-6 text-text-primary" aria-hidden="true" />
          </button>

          <div className="flex items-center justify-center gap-2 mt-3" role="tablist">
            {urls.map((_, i) => (
              <button key={i} role="tab" aria-selected={i === current} aria-label={`Go to illustration ${i + 1}`}
                onClick={() => setCurrent(i)}
                className={`w-3 h-3 rounded-full transition-colors duration-150 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary-300 ${i === current ? 'bg-primary-700' : 'bg-bg-muted'}`}
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
      try { await navigator.share({ title: memory?.title ?? 'A Memory from OLAF', url }); } catch {}
    } else {
      await navigator.clipboard.writeText(url);
    }
  }, [memory?.title]);

  return (
    <div className="flex flex-col h-dvh">
      <header
        className="sticky top-0 z-20 flex items-center gap-3 px-5 py-3.5 min-h-[64px]"
        style={{
          background: 'rgba(240,244,248,0.8)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          borderBottom: '1px solid rgba(241,245,249,0.9)',
        }}
      >
        <Link
          href="/memories"
          className="flex items-center gap-2 text-primary-700 font-heading font-semibold text-[15px] hover:text-primary-800 transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary-300 rounded-lg px-1 min-h-[44px]"
        >
          <ArrowLeft className="w-5 h-5" aria-hidden="true" />
          <span>Memories</span>
        </Link>

        <div className="flex-1" />

        <button
          type="button"
          onClick={handleShare}
          aria-label="Share this memory"
          className="flex items-center gap-1.5 px-4 py-2 rounded-[12px] text-[14px] font-heading font-semibold transition-all focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary-300"
          style={{ background: 'rgba(26,109,224,0.08)', color: '#1a6de0' }}
        >
          <Share2 className="w-4 h-4" aria-hidden="true" />
          <span className="hidden sm:inline">Share</span>
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-5 py-6 pb-32 lg:px-12 lg:py-10 lg:pb-36">
        <div className="max-w-5xl mx-auto w-full">

          {isLoading && <MemoryDetailSkeleton />}

          {isError && !isLoading && (
            <div className="text-center py-16">
              <p className="text-[17px] text-text-secondary mb-6">We couldn&apos;t load this memory. It may have been removed.</p>
              <Link href="/memories"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-[14px] text-[15px] font-heading font-semibold text-white transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary-300"
                style={{ background: 'linear-gradient(135deg, #1a6de0, #1558b8)' }}>
                <ArrowLeft className="w-4 h-4" />
                Back to Memories
              </Link>
            </div>
          )}

          {!isLoading && !isError && memory && (
            <article>
              <div className="lg:grid lg:grid-cols-[48%_1fr] lg:gap-12 lg:items-start">
                {memory.illustrationUrls.length > 0 && (
                  <div className="mb-6 lg:mb-0 lg:sticky lg:top-6">
                    <ImageGallery urls={memory.illustrationUrls} title={memory.title} />
                  </div>
                )}
                <div className={memory.illustrationUrls.length === 0 ? 'lg:col-span-2 lg:max-w-2xl mx-auto' : ''}>

                  {/* Book-style chapter card */}
                  <div className="rounded-3xl overflow-hidden" style={{
                    background: 'rgba(255,252,245,0.92)',
                    border: '1px solid rgba(210,190,155,0.35)',
                    boxShadow: '0 4px 32px rgba(120,90,40,0.08)',
                  }}>

                    {/* Chapter header band */}
                    <div className="px-6 pt-7 pb-5 lg:px-10 lg:pt-9" style={{ borderBottom: '1px solid rgba(210,190,155,0.25)' }}>
                      <p className="text-[10px] lg:text-[11px] font-heading font-bold tracking-[0.22em] mb-3" style={{ color: '#9c7c4a' }}>
                        ✦ &nbsp; MY STORY &nbsp; ✦
                      </p>
                      <h1 className="text-[24px] lg:text-[30px] leading-tight mb-2"
                          style={{ fontFamily: 'Georgia, "Times New Roman", serif', color: '#1c1410', fontWeight: 700, letterSpacing: '-0.01em' }}>
                        {memory.title}
                      </h1>
                      <p className="text-[12px] lg:text-[13px] italic" style={{ color: '#9c7c4a' }}>
                        As remembered and told to OLAF &nbsp;·&nbsp; {formatDate(memory.createdAt)}
                      </p>
                    </div>

                    {/* Narrative body */}
                    <div className="px-6 py-7 lg:px-10 lg:py-9">
                      {memory.narrativeText.split('\n\n').filter(p => p.trim()).map((paragraph, i) => (
                        <p key={i}
                           className={`leading-[2] ${i < memory.narrativeText.split('\n\n').filter(p => p.trim()).length - 1 ? 'mb-5' : 'mb-0'}`}
                           style={{
                             fontFamily: 'Georgia, "Times New Roman", serif',
                             fontSize: i === 0 ? '17px' : '16px',
                             color: '#2c1f0f',
                             textIndent: i > 0 ? '1.6em' : undefined,
                           }}>
                          {i === 0 ? (
                            <>
                              <span
                                className="float-left font-heading font-black leading-none mr-2"
                                style={{ fontSize: '5em', lineHeight: '0.72', color: '#9c7c4a', marginTop: '4px' }}>
                                {paragraph.charAt(0)}
                              </span>
                              <span style={{ fontVariant: 'small-caps', letterSpacing: '0.06em', fontSize: '0.9em', color: '#5c3d1e' }}>
                                {paragraph.slice(1, 30)}
                              </span>
                              {paragraph.slice(30)}
                            </>
                          ) : paragraph}
                        </p>
                      ))}
                    </div>

                    {/* Closing colophon */}
                    <div className="px-6 pb-7 lg:px-10 lg:pb-9 text-center" style={{ borderTop: '1px solid rgba(210,190,155,0.25)' }}>
                      <div className="pt-5 flex items-center justify-center gap-3">
                        <div className="flex-1 h-px" style={{ background: 'linear-gradient(to right, transparent, rgba(156,124,74,0.3))' }} />
                        <p className="text-[11px] lg:text-[12px] italic" style={{ color: '#9c7c4a' }}>~ end of chapter ~</p>
                        <div className="flex-1 h-px" style={{ background: 'linear-gradient(to left, transparent, rgba(156,124,74,0.3))' }} />
                      </div>
                      {memory.tags.length > 0 && (
                        <div className="flex flex-wrap justify-center gap-2 mt-4">
                          {memory.tags.map(tag => (
                            <Badge key={tag} variant={{ kind: 'status', status: 'active' }} size="sm">{tag}</Badge>
                          ))}
                        </div>
                      )}
                    </div>

                  </div>
                </div>
              </div>
            </article>
          )}

        </div>
      </div>
    </div>
  );
}
