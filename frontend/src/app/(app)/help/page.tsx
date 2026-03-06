'use client';

import { useCallback, useState } from 'react';
import {
  Stethoscope,
  FileText,
  ClipboardList,
  ChevronRight,
} from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { PageShell } from '@/components/layout/PageShell';
import { NavigatorSession } from '@/components/navigator/NavigatorSession';
import api from '@/lib/api';

// ── Task definitions ────────────────────────────────────────────────────────

interface HelpTask {
  icon: typeof Stethoscope;
  title: string;
  description: string;
  templateId: string;
  task: string;
  estimatedSteps: number;
}

const HELP_TASKS: HelpTask[] = [
  {
    icon: Stethoscope,
    title: 'Book a doctor appointment',
    description: 'Find and book your next visit with your GP or specialist.',
    templateId: 'book_appointment',
    task: 'Book a doctor appointment',
    estimatedSteps: 7,
  },
  {
    icon: FileText,
    title: 'Check pension status',
    description: 'View your latest pension and benefits information.',
    templateId: 'pension_check',
    task: 'Check pension status',
    estimatedSteps: 5,
  },
  {
    icon: ClipboardList,
    title: 'Read medical report',
    description: 'Get a plain-language summary of your medical documents.',
    templateId: 'read_report',
    task: 'Read medical report',
    estimatedSteps: 5,
  },
];

// ── API types ───────────────────────────────────────────────────────────────

interface StartNavigatorResponse {
  status: string;
  data: {
    sessionId: string;
    websocketUrl: string;
  };
}

// ── Component ───────────────────────────────────────────────────────────────

export default function HelpPage() {
  const [activeSession, setActiveSession] = useState<{
    sessionId: string;
    websocketUrl: string;
    task: string;
    totalSteps: number;
  } | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const startNavigation = useCallback(async (helpTask: HelpTask) => {
    setLoading(helpTask.templateId);
    setError(null);

    try {
      const res = await api.post<StartNavigatorResponse>('/api/navigator/start', {
        userId: 'current',
        task: helpTask.task,
        templateId: helpTask.templateId,
      });

      setActiveSession({
        sessionId: res.data.sessionId,
        websocketUrl: res.data.websocketUrl,
        task: helpTask.task,
        totalSteps: helpTask.estimatedSteps,
      });
    } catch (err) {
      setError('Could not start navigation. Please try again.');
    } finally {
      setLoading(null);
    }
  }, []);

  const handleSessionClose = useCallback(async () => {
    if (activeSession) {
      try {
        await api.post(`/api/navigator/stop/${activeSession.sessionId}`);
      } catch {
        // Session may already be cleaned up
      }
    }
    setActiveSession(null);
  }, [activeSession]);

  // ── Active navigator session overlay ────────────────────────────────────

  if (activeSession) {
    return (
      <NavigatorSession
        sessionId={activeSession.sessionId}
        websocketUrl={activeSession.websocketUrl}
        task={activeSession.task}
        totalSteps={activeSession.totalSteps}
        onClose={handleSessionClose}
      />
    );
  }

  // ── Help page ───────────────────────────────────────────────────────────

  return (
    <>
      <Header title="How can I help?" />
      <PageShell id="help-content">
        {/* Error message */}
        {error && (
          <div
            className="bg-error-50 border border-error-200 text-error-700 rounded-xl p-4 mb-4"
            role="alert"
          >
            <p className="text-body">{error}</p>
          </div>
        )}

        {/* Task cards */}
        <div className="space-y-4">
          {HELP_TASKS.map((helpTask) => {
            const Icon = helpTask.icon;
            const isLoading = loading === helpTask.templateId;

            return (
              <button
                key={helpTask.templateId}
                type="button"
                onClick={() => startNavigation(helpTask)}
                disabled={loading !== null}
                className={[
                  'flex items-center gap-4 p-6 w-full text-left',
                  'bg-bg-surface rounded-2xl shadow-md',
                  'hover:shadow-lg transition-shadow duration-200',
                  'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary-300',
                  'min-h-[80px] group cursor-pointer',
                  'disabled:opacity-60 disabled:cursor-not-allowed',
                ].join(' ')}
                aria-label={helpTask.title}
              >
                <div
                  className="w-12 h-12 rounded-xl bg-primary-100 text-primary-700 flex items-center justify-center flex-shrink-0"
                  aria-hidden="true"
                >
                  {isLoading ? (
                    <div className="w-6 h-6 border-3 border-primary-300 border-t-primary-700 rounded-full animate-spin" />
                  ) : (
                    <Icon className="w-7 h-7" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-h3 font-semibold text-text-heading">
                    {helpTask.title}
                  </p>
                  <p className="text-body-sm text-text-secondary mt-0.5">
                    {helpTask.description}
                  </p>
                </div>

                <ChevronRight
                  className="w-6 h-6 text-text-muted flex-shrink-0 group-hover:text-primary-700 transition-colors duration-150"
                  aria-hidden="true"
                />
              </button>
            );
          })}
        </div>

        {/* Voice hint */}
        <p className="text-body text-text-secondary text-center mt-8">
          Or just say{' '}
          <span className="text-primary-700 font-medium">&ldquo;Help me with…&rdquo;</span>{' '}
          to OLAF
        </p>
      </PageShell>
    </>
  );
}
