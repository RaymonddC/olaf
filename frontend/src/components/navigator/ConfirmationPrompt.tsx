'use client';

import { useRef, useEffect } from 'react';
import { Button } from '@/components/ui/Button';

interface ConfirmationPromptProps {
  /** Plain-language description of the action requiring approval */
  actionDescription: string;
  /** Type of sensitive action */
  actionType: 'form_submit' | 'login' | 'payment' | 'download';
  /** Called when the user approves the action */
  onApprove: () => void;
  /** Called when the user rejects the action */
  onReject: () => void;
}

const ACTION_LABELS: Record<string, { confirm: string; cancel: string }> = {
  form_submit: { confirm: 'Yes, submit', cancel: 'No, cancel' },
  login: { confirm: 'Yes, sign in', cancel: 'No, cancel' },
  payment: { confirm: 'Yes, pay', cancel: 'No, cancel' },
  download: { confirm: 'Yes, download', cancel: 'No, cancel' },
};

export function ConfirmationPrompt({
  actionDescription,
  actionType,
  onApprove,
  onReject,
}: ConfirmationPromptProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const labels = ACTION_LABELS[actionType] ?? ACTION_LABELS.form_submit;

  // Focus cancel button by default (safe default)
  useEffect(() => {
    cancelRef.current?.focus();
  }, []);

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-describedby="confirmation-message"
      className="bg-bg-surface rounded-2xl shadow-lg p-6 max-w-[480px] w-full"
    >
      <p
        id="confirmation-message"
        className="text-body-lg text-text-primary text-center mb-6 leading-relaxed"
      >
        {actionDescription}
      </p>

      <div className="flex gap-4">
        <Button
          ref={cancelRef}
          variant="secondary"
          size="xl"
          onClick={onReject}
          className="flex-1"
        >
          {labels.cancel}
        </Button>

        <Button
          variant="primary"
          size="xl"
          onClick={onApprove}
          className="flex-1"
        >
          {labels.confirm}
        </Button>
      </div>
    </div>
  );
}
