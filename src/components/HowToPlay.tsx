import { useEffect, useRef } from 'react';
import { Icon } from './Icon';
import { Logo } from './Menu';

type Props = { onClose: () => void };

const STEPS = [
  {
    icon: 'eye' as const,
    title: 'Memorise',
    body: 'A scene appears for a few seconds. Take in the shapes, colours, sizes and where everything sits.',
  },
  {
    icon: 'sparkle' as const,
    title: 'The thief strikes',
    body: 'The screen goes blank for a moment. Behind it, something gets removed, moved, recoloured, resized, swapped or relabelled.',
  },
  {
    icon: 'target' as const,
    title: 'Find it',
    body: 'Tap or click each spot that changed. Wrong clicks cost points, so look before you leap.',
  },
  {
    icon: 'flag' as const,
    title: 'Or call it',
    body: 'Sometimes the thief takes the round off. If genuinely nothing changed, press "Nothing changed" to score.',
  },
];

/** Focus-trapped modal: Escape closes, Tab cycles inside. */
export function HowToPlay({ onClose }: Props) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;
      const panel = panelRef.current;
      if (!panel) return;
      const focusable = panel.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        last.focus();
        event.preventDefault();
      } else if (!event.shiftKey && document.activeElement === last) {
        first.focus();
        event.preventDefault();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div
      className="anim-fade fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="howto-title"
        className="anim-pop card my-auto w-full max-w-lg p-5 sm:p-6"
      >
        <div className="mb-4 flex items-start gap-3">
          <Logo size={48} />
          <div className="min-w-0 flex-1">
            <h2 id="howto-title" className="font-display text-xl font-bold">How to play</h2>
            <p className="text-sm text-muted">Four steps, one thief.</p>
          </div>
          <button
            ref={closeRef}
            type="button"
            className="btn btn-ghost !min-h-10 !w-10 !px-0"
            onClick={onClose}
            aria-label="Close how to play"
          >
            <Icon name="close" size={18} />
          </button>
        </div>

        <ol className="space-y-3">
          {STEPS.map((step, index) => (
            <li key={step.title} className="flex gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-surface-2 text-accent ring-1 ring-line">
                <Icon name={step.icon} size={17} />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-bold text-ink">
                  <span className="text-faint">{index + 1}. </span>
                  {step.title}
                </p>
                <p className="text-sm text-muted">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>

        <div className="mt-4 rounded-xl border border-line bg-surface-2 px-3.5 py-3">
          <p className="text-xs text-muted">
            <strong className="text-ink">Scoring:</strong> 100 points per change found, a bonus for
            every second left on the clock, 150 for a flawless round, and −25 for each wrong click.
          </p>
        </div>

        <button type="button" className="btn btn-primary mt-4 w-full" onClick={onClose}>
          Got it
        </button>
      </div>
    </div>
  );
}
