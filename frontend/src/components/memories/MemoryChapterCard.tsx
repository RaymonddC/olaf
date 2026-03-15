'use client';

import Image from 'next/image';
import Link from 'next/link';
import { BookOpen } from 'lucide-react';

interface Props {
    id: string;
    title: string;
    createdAt: string;
    illustrationUrls: string[];
    snippet: string;
}

function fmtTime(iso: string) {
    try { return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }); } catch { return ''; }
}

export function MemoryChapterCard({ id, title, createdAt, illustrationUrls, snippet }: Props) {
    const hasImg = illustrationUrls?.length > 0;

    return (
        <Link href={`/memories/${id}`}
              className="group flex items-center gap-4 rounded-2xl p-4 transition-all duration-200 hover:shadow-sm active:scale-[0.98] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary-300"
              style={{
                  background: 'rgba(255,255,255,0.75)',
                  border: '1px solid rgba(255,255,255,0.85)',
              }}
        >
            {/* Thumbnail */}
            <div className="w-14 h-14 flex-shrink-0 rounded-2xl overflow-hidden relative"
                 style={{ background: hasImg ? undefined : 'linear-gradient(135deg, #e0ecff, #d5f5f0)' }}>
                {hasImg ? (
                    <Image src={illustrationUrls[0]} alt="" fill className="object-cover" sizes="56px" />
                ) : (
                    <div className="w-full h-full flex items-center justify-center">
                        <BookOpen className="w-6 h-6 text-primary-300" aria-hidden="true" />
                    </div>
                )}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
                <div className="flex items-baseline justify-between gap-3">
                    <h3 className="text-[16px] lg:text-[17px] font-heading font-semibold text-text-heading leading-snug truncate group-hover:text-primary-700 transition-colors">
                        {title}
                    </h3>
                    <span className="text-[13px] lg:text-[14px] text-text-muted flex-shrink-0 font-heading whitespace-nowrap">
                        {fmtTime(createdAt)}
                    </span>
                </div>
                <p className="text-[14px] lg:text-[15px] text-text-muted mt-1 line-clamp-2 leading-relaxed">{snippet}</p>
            </div>
        </Link>
    );
}
