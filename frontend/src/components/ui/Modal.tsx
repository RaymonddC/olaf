'use client';

import {
  useEffect,
  useRef,
  useCallback,
  type ReactNode,
  type KeyboardEvent,
} from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  /** Whether the modal is open */
  open: boolean;
  /** Called when the user requests closing (Escape, backdrop click, close button) */
  onClose: () => void;
  /** Used for aria-labelledby */
  title: string;
  children: ReactNode;
  /** Hide the default close button */
  hideCloseButton?: boolean;
}

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

export function Modal({
  open,
  onClose,
  title,
  children,
  hideCloseButton = false,
}: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const titleId = `modal-title-${title.replace(/\s+/g, '-').toLowerCase()}`;

  // Store element that triggered the modal so we can restore focus on close
  useEffect(() => {
    if (open) {
      previousFocusRef.current = document.activeElement as HTMLElement;
      // Focus first focusable element inside dialog
      requestAnimationFrame(() => {
        const first = dialogRef.current?.querySelector<HTMLElement>(FOCUSABLE);
        first?.focus();
      });
    } else {
      previousFocusRef.current?.focus();
    }
  }, [open]);

  // Trap focus inside dialog
  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== 'Tab') return;

      const focusable = Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [],
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    },
    [onClose],
  );

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onKeyDown={handleKeyDown}
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-bg-overlay"
        aria-hidden="true"
        onClick={onClose}
      />

      {/* Dialog panel */}
      <div
        ref={dialogRef}
        className="relative bg-bg-surface rounded-2xl shadow-lg w-full max-w-[480px] p-6 animate-modal-in"
      >
        {/* Close button */}
        {!hideCloseButton && (
          <button
            onClick={onClose}
            aria-label="Close dialog"
            className={[
              'absolute top-4 right-4',
              'p-2 rounded-xl text-text-secondary hover:bg-bg-surface-alt',
              'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary-300',
              'min-w-[44px] min-h-[44px] flex items-center justify-center',
              'transition-colors duration-150',
            ].join(' ')}
          >
            <X className="w-6 h-6" aria-hidden="true" />
          </button>
        )}

        <h2
          id={titleId}
          className="text-h3 text-text-heading font-semibold mb-4 pr-10"
        >
          {title}
        </h2>

        {children}
      </div>
    </div>
  );
}
