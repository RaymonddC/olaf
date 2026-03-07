'use client';

import Image from 'next/image';
import Link from 'next/link';
import { BookOpen, Calendar } from 'lucide-react';

interface Props {
    id: string;
    title: string;
    createdAt: string;
    illustrationUrls: string[];
    snippet: string;
}

function fmtDate(iso: string) {
    try { return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); } catch { return iso; }
}

export function MemoryChapterCard({ id, title, createdAt, illustrationUrls, snippet }: Props) {
    const hasImg = illustrationUrls?.length > 0;

    return (
        <Link href={`/memories/${id}`}
              className="group block rounded-[22px] overflow-hidden transition-all duration-300 hover:-translate-y-[3px] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary-300"
              style={{
                  background: 'rgba(255,255,255,0.88)',
                  backdropFilter: 'blur(24px)',
                  border: '1px solid rgba(255,255,255,0.7)',
                  boxShadow: '0 4px 20px rgba(15,23,42,0.04), 0 1px 4px rgba(15,23,42,0.02), inset 0 1px 0 rgba(255,255,255,0.9)',
              }}
        >
            <div className="flex min-h-[140px]">
                {/* Left illustration */}
                <div className="w-[110px] flex-shrink-0 relative overflow-hidden"
                     style={{ background: hasImg ? undefined : 'linear-gradient(160deg, #dbeafe, #ccfbf1)' }}>
                    {hasImg ? (
                        <Image src={illustrationUrls[0]} alt="" fill className="object-cover transition-transform duration-500 group-hover:scale-105" sizes="110px" />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center">
                            <BookOpen className="w-9 h-9 text-primary-300" aria-hidden="true" />
                        </div>
                    )}
                </div>

                {/* Content */}
                <div className="flex-1 p-4 flex flex-col">
                    <h3 className="text-[17px] font-heading font-bold text-text-heading leading-tight mb-1 group-hover:text-primary-700 transition-colors duration-200 line-clamp-2" style={{ letterSpacing: '-0.01em' }}>
                        {title}
                    </h3>
                    <div className="flex items-center gap-1 mb-2">
                        <Calendar className="w-3.5 h-3.5 text-text-muted" aria-hidden="true" />
                        <time className="text-[13px] text-text-muted" dateTime={createdAt}>{fmtDate(createdAt)}</time>
                    </div>
                    <p className="text-[15px] text-text-secondary leading-snug flex-1 line-clamp-2">{snippet}</p>
                </div>
            </div>
        </Link>
    );
}