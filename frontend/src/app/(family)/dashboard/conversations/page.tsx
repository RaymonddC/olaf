'use client';

/**
 * Family Dashboard — Conversations Page
 *
 * Shows the list of companion conversations with:
 * - Mood score indicators (colour-coded)
 * - Duration and date
 * - Summary preview
 * - Distress flags highlighted
 */

import { useState } from 'react';
import { MessageSquare, ArrowLeft, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { Header } from '@/components/layout/Header';
import { PageShell } from '@/components/layout/PageShell';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton';
import { Modal } from '@/components/ui/Modal';
import { useMe, useConversations } from '@/hooks/useApi';
import type { Conversation } from '@/hooks/useApi';

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffDays = Math.floor(diffMs / 86_400_000);

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;

    return d.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: diffDays > 365 ? 'numeric' : undefined,
    });
  } catch {
    return '';
  }
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `${mins} min`;
  const hours = Math.floor(mins / 60);
  const remMins = mins % 60;
  return `${hours}h ${remMins}m`;
}

// ── Mood indicator ────────────────────────────────────────────────────────────

interface MoodIndicatorProps {
  score: number;
}

function MoodIndicator({ score }: MoodIndicatorProps) {
  let label: string;
  let colorClass: string;

  if (score >= 8) {
    label = 'Happy';
    colorClass = 'text-success-700 bg-success-50 border-success-600';
  } else if (score >= 6) {
    label = 'Good';
    colorClass = 'text-info-700 bg-info-50 border-info-600';
  } else if (score >= 4) {
    label = 'Fair';
    colorClass = 'text-warning-700 bg-warning-50 border-warning-600';
  } else {
    label = 'Low';
    colorClass = 'text-error-700 bg-error-50 border-error-600';
  }

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-caption font-semibold border ${colorClass}`}
      aria-label={`Mood: ${label} (${score}/10)`}
    >
      {score}/10 {label}
    </span>
  );
}

// ── Conversation card ─────────────────────────────────────────────────────────

interface ConversationCardProps {
  conversation: Conversation;
  onOpen: (c: Conversation) => void;
}

function ConversationCard({ conversation, onOpen }: ConversationCardProps) {
  const hasDistress = conversation.flags.includes('distress');

  return (
    <Card
      variant="elevated"
      as="article"
      interactive
      onClick={() => onOpen(conversation)}
      className={hasDistress ? 'border-l-4 border-error-600' : ''}
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-center gap-2 flex-wrap">
          <MoodIndicator score={conversation.moodScore} />
          {hasDistress && (
            <span
              className="inline-flex items-center gap-1 text-caption font-semibold text-error-700 bg-error-50 border border-error-600 px-2 py-0.5 rounded-md"
              aria-label="Distress flagged in this conversation"
            >
              <AlertCircle className="w-3 h-3" aria-hidden="true" />
              Distress flagged
            </span>
          )}
        </div>
        <div className="text-right flex-shrink-0">
          <time dateTime={conversation.createdAt} className="text-caption text-text-muted block">
            {formatDate(conversation.createdAt)}
          </time>
          <span className="text-caption text-text-muted">
            {formatTime(conversation.createdAt)}
          </span>
        </div>
      </div>

      <p className="text-body text-text-primary leading-relaxed line-clamp-3 mb-2">
        {conversation.summary || 'No summary available.'}
      </p>

      <div className="flex items-center gap-3 text-caption text-text-muted">
        <span>Duration: {formatDuration(conversation.sessionDuration)}</span>
        <span>·</span>
        <span>{conversation.transcriptCount} exchanges</span>
      </div>
    </Card>
  );
}

// ── Conversation detail modal ─────────────────────────────────────────────────

interface ConversationDetailProps {
  conversation: Conversation;
}

function ConversationDetail({ conversation }: ConversationDetailProps) {
  const hasDistress = conversation.flags.includes('distress');

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center">
        <MoodIndicator score={conversation.moodScore} />
        {hasDistress && (
          <span className="inline-flex items-center gap-1 text-caption font-semibold text-error-700 bg-error-50 border border-error-600 px-2 py-0.5 rounded-md">
            <AlertCircle className="w-3 h-3" aria-hidden="true" />
            Distress flagged
          </span>
        )}
      </div>

      <dl className="grid grid-cols-2 gap-3 text-body-sm">
        <div>
          <dt className="text-text-secondary">Date</dt>
          <dd className="text-text-primary font-medium">
            {formatDate(conversation.createdAt)} at {formatTime(conversation.createdAt)}
          </dd>
        </div>
        <div>
          <dt className="text-text-secondary">Duration</dt>
          <dd className="text-text-primary font-medium">
            {formatDuration(conversation.sessionDuration)}
          </dd>
        </div>
        <div>
          <dt className="text-text-secondary">Exchanges</dt>
          <dd className="text-text-primary font-medium">{conversation.transcriptCount}</dd>
        </div>
        <div>
          <dt className="text-text-secondary">Mood score</dt>
          <dd className="text-text-primary font-medium">{conversation.moodScore}/10</dd>
        </div>
      </dl>

      {conversation.summary && (
        <div>
          <p className="text-body-sm font-semibold text-text-secondary mb-1">Summary</p>
          <p className="text-body text-text-primary leading-relaxed">
            {conversation.summary}
          </p>
        </div>
      )}

      {conversation.flags.length > 0 && (
        <div>
          <p className="text-body-sm font-semibold text-text-secondary mb-1">Flags</p>
          <div className="flex flex-wrap gap-2">
            {conversation.flags.map((flag) => (
              <Badge
                key={flag}
                variant={{ kind: 'severity', severity: flag === 'distress' ? 'high' : 'medium' }}
                size="sm"
              >
                {flag}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ConversationsPage() {
  const { data: meData, isLoading: meLoading } = useMe();
  const profile = meData?.data;

  const elderlyAccount = profile?.linkedAccounts?.find((a) => a.role === 'elderly');
  const elderlyUserId = elderlyAccount?.userId ?? '';
  const elderlyName = elderlyAccount?.name ?? 'Your loved one';

  const { data: conversationsData, isLoading: convLoading } = useConversations(
    elderlyUserId,
    30,
  );

  const conversations = conversationsData?.data?.conversations ?? [];
  const [selected, setSelected] = useState<Conversation | null>(null);
  const loading = meLoading || convLoading;

  return (
    <>
      <Header
        title={`${elderlyName}'s conversations`}
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

      <PageShell id="conversations-content" noBottomPad>
        {loading ? (
          <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <LoadingSkeleton key={i} shape="card" />
            ))}
          </div>
        ) : !elderlyUserId ? (
          <EmptyState
            icon={MessageSquare}
            title="No linked account"
            message="Link an elderly user account to view their conversation history."
          />
        ) : conversations.length === 0 ? (
          <EmptyState
            icon={MessageSquare}
            title="No conversations yet"
            message={`${elderlyName} hasn't had a conversation with CARIA yet. Conversations will appear here after their first session.`}
          />
        ) : (
          <div className="space-y-4" role="list" aria-label="Conversation list">
            {conversations.map((convo) => (
              <div key={convo.conversationId} role="listitem">
                <ConversationCard conversation={convo} onOpen={setSelected} />
              </div>
            ))}
          </div>
        )}
      </PageShell>

      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected ? `Conversation – ${formatDate(selected.createdAt)}` : 'Conversation'}
      >
        {selected && <ConversationDetail conversation={selected} />}
      </Modal>
    </>
  );
}
