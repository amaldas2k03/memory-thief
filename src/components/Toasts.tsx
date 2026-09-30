import { useEffect } from 'react';
import { Icon } from './Icon';

export type Toast = {
  id: string;
  title: string;
  body?: string;
  tone: 'achievement' | 'info';
};

type Props = {
  toasts: Toast[];
  onDismiss: (id: string) => void;
};

const LIFETIME_MS = 4200;

function ToastCard({ toast, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
  useEffect(() => {
    const id = window.setTimeout(() => onDismiss(toast.id), LIFETIME_MS);
    return () => window.clearTimeout(id);
  }, [toast.id, onDismiss]);

  return (
    <div
      className="anim-toast card pointer-events-auto flex items-start gap-3 px-3.5 py-3"
      style={{
        borderColor: toast.tone === 'achievement'
          ? 'color-mix(in oklab, var(--c-accent) 55%, var(--c-border))'
          : 'var(--c-border)',
        boxShadow: 'var(--shadow-lift)',
      }}
    >
      <span
        className="grid h-8 w-8 shrink-0 place-items-center rounded-lg"
        style={{
          background: toast.tone === 'achievement' ? 'var(--c-accent)' : 'var(--c-surface-2)',
          color: toast.tone === 'achievement' ? 'var(--c-on-accent)' : 'var(--c-text)',
        }}
      >
        <Icon name={toast.tone === 'achievement' ? 'trophy' : 'sparkle'} size={16} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-ink">{toast.title}</p>
        {toast.body && <p className="text-xs text-muted">{toast.body}</p>}
      </div>
      <button
        type="button"
        className="-m-1 grid h-8 w-8 shrink-0 place-items-center rounded-lg text-faint transition-colors hover:text-ink"
        onClick={() => onDismiss(toast.id)}
        aria-label={`Dismiss ${toast.title}`}
      >
        <Icon name="close" size={15} />
      </button>
    </div>
  );
}

export function Toasts({ toasts, onDismiss }: Props) {
  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-3 z-[60] mx-auto flex w-full max-w-sm flex-col gap-2 px-4"
      role="status"
      aria-live="polite"
    >
      {toasts.map((toast) => (
        <ToastCard key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
}
