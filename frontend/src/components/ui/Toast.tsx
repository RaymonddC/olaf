'use client';

import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import { Alert, type AlertVariant } from './Alert';

// ── Types ────────────────────────────────────────────────────────────────────

interface ToastItem {
  id: string;
  variant: AlertVariant;
  title: string;
  description?: string;
}

interface ToastContextValue {
  /** Show a toast notification */
  toast: (opts: Omit<ToastItem, 'id'>) => void;
}

// ── Context ──────────────────────────────────────────────────────────────────

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}

// ── Provider ─────────────────────────────────────────────────────────────────

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback((opts: Omit<ToastItem, 'id'>) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setToasts((prev) => [...prev, { ...opts, id }]);

    // Auto-dismiss after 5s
    setTimeout(() => dismiss(id), 5000);
  }, [dismiss]);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}

      {/* Toast container */}
      <div
        aria-label="Notifications"
        aria-live="polite"
        className="fixed top-4 right-4 left-4 md:left-auto md:w-[400px] z-50 flex flex-col gap-3 pointer-events-none"
      >
        {toasts.map((t) => (
          <div key={t.id} className="animate-slide-in pointer-events-auto">
            <Alert
              variant={t.variant}
              title={t.title}
              description={t.description}
              dismissible
              onDismiss={() => dismiss(t.id)}
            />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
