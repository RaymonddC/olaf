'use client';

/**
 * Family Dashboard — Memories Page
 *
 * Read-only view of the elderly user's memory chapters.
 * Shows illustration gallery and supports audio playback of the audio script
 * via the browser's built-in SpeechSynthesis API.
 */

import { useState, useCallback } from 'react';
import { BookOpen, ArrowLeft, Volume2, VolumeX, Image as ImageIcon } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { Header } from '@/components/layout/Header';
import { PageShell } from '@/components/layout/PageShell';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton';
import { Modal } from '@/components/ui/Modal';
import { useMe, useMemories, useMemory } from '@/hooks/useApi';
import type { MemoryListItem } from '@/hooks/useApi';

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return '';
  }
}

// ── Memory detail modal ──────────────────────────────────────────────────────

interface MemoryDetailProps {
  memoryId: string;
  userId: string;
}

function MemoryDetail({ memoryId, userId }: MemoryDetailProps) {
  const { data: chapter, isLoading } = useMemory(memoryId, userId);
  const [speaking, setSpeaking] = useState(false);
  const [activeImageIdx, setActiveImageIdx] = useState(0);

  const handleToggleSpeech = useCallback(() => {
    if (!chapter?.audioScript && !chapter?.narrativeText) return;

    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }

    const utterance = new SpeechSynthesisUtterance(
      chapter?.audioScript || chapter?.narrativeText || '',
    );
    utterance.rate = 0.85; // Slightly slower for elderly content
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(utterance);
    setSpeaking(true);
  }, [chapter, speaking]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <LoadingSkeleton shape="heading" />
        <LoadingSkeleton shape="thumbnail" />
        <LoadingSkeleton shape="text" lines={4} />
      </div>
    );
  }

  if (!chapter) return null;

  return (
    <div className="space-y-6">
      {/* Illustration gallery */}
      {chapter.illustrationUrls.length > 0 && (
        <div className="space-y-3">
          {/* Main image */}
          <div className="relative w-full aspect-[4/3] rounded-2xl overflow-hidden bg-bg-muted">
            <Image
              src={chapter.illustrationUrls[activeImageIdx]}
              alt={`Illustration ${activeImageIdx + 1} for ${chapter.title}`}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 600px"
            />
          </div>

          {/* Thumbnail strip */}
          {chapter.illustrationUrls.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {chapter.illustrationUrls.map((url, idx) => (
                <button
                  key={idx}
                  onClick={() => setActiveImageIdx(idx)}
                  className={[
                    'relative flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-colors',
                    idx === activeImageIdx ? 'border-primary-600' : 'border-transparent',
                    'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary-300',
                  ].join(' ')}
                  aria-label={`View illustration ${idx + 1}`}
                  aria-pressed={idx === activeImageIdx}
                >
                  <Image
                    src={url}
                    alt=""
                    fill
                    className="object-cover"
                    sizes="64px"
                  />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tags */}
      {chapter.tags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {chapter.tags.map((tag) => (
            <Badge key={tag} variant={{ kind: 'status', status: 'active' }} size="sm">
              {tag}
            </Badge>
          ))}
        </div>
      )}

      {/* Narrative text */}
      <div className="prose prose-lg max-w-none text-text-primary leading-relaxed">
        {chapter.narrativeText.split('\n').map((para, i) =>
          para.trim() ? (
            <p key={i} className="text-body mb-3">
              {para}
            </p>
          ) : null,
        )}
      </div>

      {/* Audio playback */}
      {'speechSynthesis' in window && (chapter.audioScript || chapter.narrativeText) && (
        <Button
          variant={speaking ? 'danger' : 'secondary'}
          size="lg"
          onClick={handleToggleSpeech}
          className="w-full"
          aria-label={speaking ? 'Stop narration' : 'Listen to story'}
        >
          {speaking ? (
            <>
              <VolumeX className="w-5 h-5" aria-hidden="true" />
              Stop narration
            </>
          ) : (
            <>
              <Volume2 className="w-5 h-5" aria-hidden="true" />
              Listen to story
            </>
          )}
        </Button>
      )}
    </div>
  );
}

// ── Memory chapter card ───────────────────────────────────────────────────────

interface MemoryCardProps {
  memory: MemoryListItem;
  onOpen: (memoryId: string) => void;
}

function MemoryChapterCard({ memory, onOpen }: MemoryCardProps) {
  return (
    <Card variant="elevated" as="article" interactive onClick={() => onOpen(memory.id)}>
      {/* Illustration thumbnail */}
      {memory.illustrationUrls.length > 0 ? (
        <div className="relative w-full aspect-[4/3] rounded-xl overflow-hidden bg-bg-muted mb-4">
          <Image
            src={memory.illustrationUrls[0]}
            alt={`Illustration for ${memory.title}`}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 320px"
          />
        </div>
      ) : (
        <div className="w-full aspect-[4/3] rounded-xl bg-bg-muted mb-4 flex items-center justify-center">
          <ImageIcon className="w-10 h-10 text-text-muted" aria-hidden="true" />
        </div>
      )}

      <h3 className="text-body font-semibold text-text-heading mb-1 line-clamp-2">
        {memory.title}
      </h3>

      {memory.snippet && (
        <p className="text-body-sm text-text-secondary line-clamp-3 mb-2">
          {memory.snippet}
        </p>
      )}

      <time dateTime={memory.createdAt} className="text-caption text-text-muted">
        {formatDate(memory.createdAt)}
      </time>
    </Card>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function FamilyMemoriesPage() {
  const { data: meData, isLoading: meLoading } = useMe();
  const profile = meData?.data;

  const elderlyAccount = profile?.linkedAccounts?.find((a) => a.role === 'elderly');
  const elderlyUserId = elderlyAccount?.userId ?? '';
  const elderlyName = elderlyAccount?.name ?? 'Your loved one';

  const { data: memoriesData, isLoading: memoriesLoading } = useMemories(elderlyUserId);
  const memories = memoriesData?.memories ?? [];

  const [selectedMemoryId, setSelectedMemoryId] = useState<string | null>(null);

  const handleOpen = useCallback((memoryId: string) => {
    setSelectedMemoryId(memoryId);
  }, []);

  const handleClose = useCallback(() => {
    // Stop any ongoing speech synthesis
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setSelectedMemoryId(null);
  }, []);

  const selectedMemory = memories.find((m) => m.id === selectedMemoryId);
  const loading = meLoading || memoriesLoading;

  return (
    <>
      <Header
        title={`${elderlyName}'s memories`}
        action={
          <Link
            href="/dashboard"
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-body-sm font-semibold text-text-secondary hover:bg-bg-surface-alt transition-colors duration-150 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary-300 min-h-[48px]"
            aria-label="Back to dashboard"
          >
            <ArrowLeft className="w-5 h-5" aria-hidden="true" />
            Dashboard
          </Link>
        }
      />

      <PageShell id="memories-content" noBottomPad>
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <LoadingSkeleton key={i} shape="card" />
            ))}
          </div>
        ) : !elderlyUserId ? (
          <EmptyState
            icon={BookOpen}
            title="No linked account"
            message="Link an elderly user account to view their memory chapters."
          />
        ) : memories.length === 0 ? (
          <EmptyState
            icon={BookOpen}
            title="No memories yet"
            message={`${elderlyName} hasn't created any memory chapters yet. They'll appear here after their first storytelling session with CARIA.`}
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {memories.map((memory) => (
              <MemoryChapterCard key={memory.id} memory={memory} onOpen={handleOpen} />
            ))}
          </div>
        )}
      </PageShell>

      {/* Memory detail modal */}
      <Modal
        open={!!selectedMemoryId}
        onClose={handleClose}
        title={selectedMemory?.title ?? 'Memory'}
      >
        {selectedMemoryId && elderlyUserId && (
          <MemoryDetail
            memoryId={selectedMemoryId}
            userId={elderlyUserId}
          />
        )}
      </Modal>
    </>
  );
}
