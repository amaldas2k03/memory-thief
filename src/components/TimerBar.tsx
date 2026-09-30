import { useEffect, useRef, useState } from 'react';

type Props = {
  /** Wall-clock timestamp when the phase ends, or null for an untimed phase. */
  deadline: number | null;
  /** Full duration of the phase, used to compute the fill fraction. */
  durationMs: number;
  onExpire?: () => void;
  label: string;
  /** Turn the bar amber then red as time runs low. */
  urgent?: boolean;
};

/**
 * Countdown bar.
 *
 * The animation runs on requestAnimationFrame inside this component only, so
 * ticking never re-renders the scene above it. `onExpire` fires exactly once.
 */
export function TimerBar({ deadline, durationMs, onExpire, label, urgent = true }: Props) {
  // Starts full and is corrected on the first animation frame, so the render
  // pass itself never reads the clock.
  const [remaining, setRemaining] = useState(durationMs);
  const firedRef = useRef(false);
  const expireRef = useRef(onExpire);
  useEffect(() => {
    expireRef.current = onExpire;
  });

  useEffect(() => {
    firedRef.current = false;
    if (deadline === null) return;
    let frame = 0;
    const tick = () => {
      const left = Math.max(0, deadline - Date.now());
      setRemaining(left);
      if (left <= 0) {
        if (!firedRef.current) {
          firedRef.current = true;
          expireRef.current?.();
        }
        return;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [deadline, durationMs]);

  const shown = deadline === null ? durationMs : remaining;
  const fraction = durationMs > 0 ? Math.max(0, Math.min(1, shown / durationMs)) : 0;
  const seconds = Math.ceil(shown / 1000);
  const low = urgent && fraction <= 0.25;
  const mid = urgent && fraction <= 0.5 && !low;
  const color = low ? 'var(--c-danger)' : mid ? 'var(--c-warn)' : 'var(--c-accent)';

  return (
    <div className="w-full">
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <span className="text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-faint">{label}</span>
        <span
          className="font-display text-sm font-bold tabular-nums"
          style={{ color: deadline === null ? 'var(--c-text-muted)' : color }}
        >
          {deadline === null ? '∞' : `${seconds}s`}
        </span>
      </div>
      <div
        className="h-2.5 w-full overflow-hidden rounded-full bg-surface-2 ring-1 ring-inset ring-line"
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={Math.round(durationMs / 1000)}
        aria-valuenow={deadline === null ? Math.round(durationMs / 1000) : seconds}
        aria-valuetext={deadline === null ? 'No time limit' : `${seconds} seconds left`}
      >
        <div
          className="h-full rounded-full"
          style={{
            width: `${fraction * 100}%`,
            background: color,
            // No CSS transition: the rAF loop already produces smooth motion,
            // and a transition would lag behind the real deadline.
            boxShadow: `0 0 12px -2px ${color}`,
          }}
        />
      </div>
    </div>
  );
}
