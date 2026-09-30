import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SceneView } from './SceneView';
import type { Highlight } from './SceneView';
import { Icon } from './Icon';
import type { GameState } from '../hooks/useGameReducer';
import { playSound } from '../game/sound';
import { DAILY_ROUNDS } from '../game/daily';

type Props = {
  state: GameState;
  onNextRound: () => void;
  onQuit: () => void;
  soundOn: boolean;
};

const CHANGE_LABEL: Record<string, string> = {
  remove: 'Removed',
  add: 'Added',
  recolor: 'Colour',
  move: 'Moved',
  resize: 'Resized',
  rotate: 'Rotated',
  flip: 'Flipped',
  swap: 'Swapped',
  text: 'Text',
};

/**
 * Draggable before/after comparison. The clip is done with `clip-path` on an
 * absolutely-positioned overlay so both scenes stay in the same grid cell and
 * nothing reflows while dragging.
 */
function CompareSlider({ state, highlights }: { state: GameState; highlights: Highlight[] }) {
  const [split, setSplit] = useState(50);
  const frameRef = useRef<HTMLDivElement | null>(null);
  const draggingRef = useRef(false);

  const setFromClientX = useCallback((clientX: number) => {
    const frame = frameRef.current;
    if (!frame) return;
    const rect = frame.getBoundingClientRect();
    if (rect.width === 0) return;
    setSplit(Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100)));
  }, []);

  useEffect(() => {
    const move = (event: PointerEvent) => {
      if (!draggingRef.current) return;
      event.preventDefault();
      setFromClientX(event.clientX);
    };
    const up = () => { draggingRef.current = false; };
    window.addEventListener('pointermove', move, { passive: false });
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
  }, [setFromClientX]);

  return (
    <div className="card overflow-hidden p-2 sm:p-3">
      <div
        ref={frameRef}
        className="relative select-none overflow-hidden rounded-xl"
        style={{ touchAction: 'none' }}
      >
        <SceneView scene={state.round.mutated} highlights={highlights} label="After — what the thief left behind" />

        <div
          className="pointer-events-none absolute inset-0"
          style={{ clipPath: `inset(0 ${100 - split}% 0 0)` }}
        >
          <SceneView scene={state.round.original} label="Before — the original scene" />
        </div>

        {/* Handle */}
        <div
          className="absolute inset-y-0 w-0.5 bg-white/90 shadow-[0_0_14px_rgba(0,0,0,0.5)]"
          style={{ left: `${split}%` }}
        >
          <button
            type="button"
            aria-label="Comparison slider. Use the left and right arrow keys to move it."
            className="absolute top-1/2 left-1/2 grid h-11 w-11 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize place-items-center rounded-full border-2 border-white bg-[var(--c-surface)] text-ink shadow-lg"
            onPointerDown={(event) => {
              draggingRef.current = true;
              event.currentTarget.setPointerCapture?.(event.pointerId);
            }}
            onKeyDown={(event) => {
              if (event.key === 'ArrowLeft') { setSplit((s) => Math.max(0, s - 4)); event.preventDefault(); }
              if (event.key === 'ArrowRight') { setSplit((s) => Math.min(100, s + 4)); event.preventDefault(); }
            }}
          >
            <svg width="22" height="16" viewBox="0 0 22 16" fill="none" aria-hidden="true">
              <path d="M8 3 4 8l4 5M14 3l4 5-4 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>

        <span className="pointer-events-none absolute top-2 left-2 rounded-md bg-black/60 px-2 py-1 text-[0.7rem] font-bold tracking-wide text-white">
          BEFORE
        </span>
        <span className="pointer-events-none absolute top-2 right-2 rounded-md bg-black/60 px-2 py-1 text-[0.7rem] font-bold tracking-wide text-white">
          AFTER
        </span>
      </div>
      <p className="mt-2 text-center text-xs text-faint">Drag the handle to wipe between before and after.</p>
    </div>
  );
}

/** "Replay original" overlay — shows the untouched scene for 3 seconds. */
function ReplayOverlay({ state, onClose }: { state: GameState; onClose: () => void }) {
  const [left, setLeft] = useState(3);
  useEffect(() => {
    const end = Date.now() + 3000;
    const id = window.setInterval(() => {
      const remaining = Math.ceil((end - Date.now()) / 1000);
      setLeft(Math.max(0, remaining));
      if (remaining <= 0) {
        window.clearInterval(id);
        onClose();
      }
    }, 100);
    return () => window.clearInterval(id);
  }, [onClose]);

  return (
    <div
      className="anim-fade fixed inset-0 z-50 grid place-items-center bg-black/80 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Replaying the original scene"
      onClick={onClose}
    >
      <div className="w-full max-w-3xl">
        <div className="card overflow-hidden p-2">
          <SceneView scene={state.round.original} label="The original scene" />
        </div>
        <p className="mt-3 text-center font-display text-sm font-bold text-white">
          Original scene — closing in {left}s
        </p>
      </div>
    </div>
  );
}

export function RevealScreen({ state, onNextRound, onQuit, soundOn }: Props) {
  const [replaying, setReplaying] = useState(false);
  const [compare, setCompare] = useState(false);
  const found = useMemo(() => new Set(state.foundIds), [state.foundIds]);
  const playedRef = useRef(false);

  useEffect(() => {
    if (playedRef.current || !soundOn) return;
    playedRef.current = true;
    playSound(state.lastScore?.perfect ? 'levelUp' : 'reveal');
  }, [soundOn, state.lastScore?.perfect]);

  const highlights: Highlight[] = useMemo(
    () => state.round.changes.map((change, index) => ({
      id: change.id,
      hitbox: change.hitbox,
      state: found.has(change.id) ? ('found' as const) : ('missed' as const),
      index: index + 1,
    })),
    [state.round.changes, found],
  );

  const total = state.round.changes.length;
  const foundCount = state.foundIds.length;
  const score = state.lastScore;
  const runOver = state.runComplete;

  const headline = (() => {
    if (state.round.nothingChanged) {
      return state.endReason === 'calledNothing'
        ? { title: 'Nothing changed — and you called it', tone: 'var(--c-success)' }
        : { title: 'Nothing actually changed', tone: 'var(--c-warn)' };
    }
    if (state.endReason === 'wrongCall') return { title: 'Something did change', tone: 'var(--c-danger)' };
    if (foundCount === total) {
      return score?.perfect
        ? { title: 'Perfect round', tone: 'var(--c-success)' }
        : { title: 'All changes found', tone: 'var(--c-success)' };
    }
    if (state.endReason === 'timeout') return { title: "Time's up", tone: 'var(--c-danger)' };
    if (foundCount === 0) return { title: 'The thief got away', tone: 'var(--c-danger)' };
    return { title: `Found ${foundCount} of ${total}`, tone: 'var(--c-warn)' };
  })();

  const nextLabel = runOver
    ? 'See results'
    : state.mode === 'daily'
      ? `Round ${state.roundIndex + 2} of ${DAILY_ROUNDS}`
      : 'Next scene';

  return (
    <div className="mx-auto w-full max-w-5xl px-4 pb-10 pt-4 sm:px-6">
      {replaying && <ReplayOverlay state={state} onClose={() => setReplaying(false)} />}

      <div className="anim-fade-up card mb-3 flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-5">
        <div>
          <h2 className="font-display text-lg font-bold sm:text-xl" style={{ color: headline.tone }}>
            {headline.title}
          </h2>
          <p className="text-sm text-muted">
            {total > 0 && `${foundCount}/${total} found · `}
            {state.wrongClicks} wrong {state.wrongClicks === 1 ? 'click' : 'clicks'}
          </p>
        </div>
        {score && (
          <div className="text-right">
            <p className="font-display text-2xl font-bold tabular-nums text-accent">
              +{score.total.toLocaleString()}
            </p>
            <p className="text-[0.72rem] text-faint">
              {score.base} base
              {score.timeBonus > 0 && ` · +${score.timeBonus} time`}
              {score.perfectBonus > 0 && ` · +${score.perfectBonus} perfect`}
              {score.penalty > 0 && ` · −${score.penalty} misses`}
            </p>
          </div>
        )}
      </div>

      {/* Before / after: side by side on desktop, stacked on mobile. */}
      {compare ? (
        <CompareSlider state={state} highlights={highlights} />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          <figure className="card overflow-hidden p-2 sm:p-3">
            <figcaption className="mb-2 px-1 text-[0.72rem] font-bold uppercase tracking-[0.14em] text-faint">
              Before
            </figcaption>
            <SceneView scene={state.round.original} label="The original scene" />
          </figure>
          <figure className="card overflow-hidden p-2 sm:p-3">
            <figcaption className="mb-2 px-1 text-[0.72rem] font-bold uppercase tracking-[0.14em] text-faint">
              After
            </figcaption>
            <SceneView scene={state.round.mutated} highlights={highlights} label="The modified scene with changes marked" />
          </figure>
        </div>
      )}

      {/* Change list */}
      {total > 0 ? (
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {state.round.changes.map((change, index) => {
            const wasFound = found.has(change.id);
            return (
              <li
                key={change.id}
                className="card flex items-start gap-3 px-3 py-2.5"
                style={{ borderColor: wasFound ? 'color-mix(in oklab, var(--c-success) 45%, var(--c-border))' : 'color-mix(in oklab, var(--c-warn) 45%, var(--c-border))' }}
              >
                <span
                  className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-bold"
                  style={{
                    background: wasFound ? 'var(--c-success)' : 'var(--c-warn)',
                    color: '#0b1221',
                  }}
                >
                  {index + 1}
                </span>
                <div className="min-w-0">
                  <p className="text-sm text-ink">{change.description}</p>
                  <p className="mt-0.5 flex items-center gap-1.5 text-[0.72rem] font-semibold" style={{ color: wasFound ? 'var(--c-success)' : 'var(--c-warn)' }}>
                    <Icon name={wasFound ? 'check' : 'x'} size={13} />
                    {wasFound ? 'Found' : 'Missed'}
                    <span className="text-faint">· {CHANGE_LABEL[change.type] ?? change.type}</span>
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="card mt-3 px-4 py-3 text-sm text-muted">
          The thief took this round off — nothing in the scene changed.
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button type="button" className="btn btn-primary" onClick={onNextRound} autoFocus>
          <Icon name={runOver ? 'trophy' : 'play'} size={17} filled={!runOver} />
          {nextLabel}
        </button>
        <button type="button" className="btn" onClick={() => setReplaying(true)}>
          <Icon name="eye" size={17} />
          Replay original (3s)
        </button>
        <button type="button" className="btn btn-ghost" onClick={() => setCompare((c) => !c)}>
          <Icon name="refresh" size={17} />
          {compare ? 'Side by side' : 'Comparison slider'}
        </button>
        <button type="button" className="btn btn-ghost ml-auto" onClick={onQuit}>
          <Icon name="back" size={17} />
          Menu
        </button>
      </div>
    </div>
  );
}
