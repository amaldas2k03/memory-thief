import { useEffect, useMemo, useRef, useState } from 'react';
import { SceneView } from './SceneView';
import { TimerBar } from './TimerBar';
import { Icon } from './Icon';
import { RevealScreen } from './RevealScreen';
import type { GameState } from '../hooks/useGameReducer';
import { BLANK_MS, CLASSIC_LIVES } from '../hooks/useGameReducer';
import { formatDuration } from '../game/scoring';
import { playSound } from '../game/sound';
import { DAILY_ROUNDS } from '../game/daily';

type Props = {
  state: GameState;
  onAdvancePhase: () => void;
  onPick: (x: number, y: number, touch: boolean) => void;
  onCallNothing: () => void;
  onEndFind: (reason: 'timeout' | 'gaveUp') => void;
  onNextRound: () => void;
  onEndRun: () => void;
  onQuit: () => void;
  soundOn: boolean;
};

const MODE_LABEL: Record<GameState['mode'], string> = {
  classic: 'Classic',
  daily: 'Daily Challenge',
  zen: 'Zen',
  speedrun: 'Speed Run',
};

/** Small stat pill used in the HUD. */
function Stat({ icon, label, value, tone }: {
  icon: React.ComponentProps<typeof Icon>['name'];
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <div className="chip" title={label}>
      <Icon name={icon} size={15} />
      <span className="sr-only">{label}: </span>
      <span className="font-display font-bold tabular-nums" style={{ color: tone ?? 'var(--c-text)' }}>{value}</span>
    </div>
  );
}

/** Remaining lives, drawn as filled/empty heart icons. */
function Lives({ lives }: { lives: number }) {
  const safe = Math.max(0, Math.min(CLASSIC_LIVES, lives));
  return (
    <div className="chip" role="img" aria-label={`${safe} of ${CLASSIC_LIVES} lives left`}>
      {Array.from({ length: CLASSIC_LIVES }, (_, i) => (
        <Icon
          key={i}
          name="heart"
          size={15}
          filled={i < safe}
          className={i < safe ? '' : 'opacity-35'}
        />
      ))}
    </div>
  );
}

/** Live clock for the Speed Run run-wide deadline. */
function RunClock({ deadline, onExpire }: { deadline: number; onExpire: () => void }) {
  const [left, setLeft] = useState(() => Math.max(0, deadline - Date.now()));
  const firedRef = useRef(false);
  const expireRef = useRef(onExpire);
  useEffect(() => {
    expireRef.current = onExpire;
  });

  useEffect(() => {
    firedRef.current = false;
    const id = window.setInterval(() => {
      const remaining = Math.max(0, deadline - Date.now());
      setLeft(remaining);
      if (remaining <= 0 && !firedRef.current) {
        firedRef.current = true;
        expireRef.current();
      }
    }, 200);
    return () => window.clearInterval(id);
  }, [deadline]);

  return (
    <Stat
      icon="clock"
      label="Time left in run"
      value={formatDuration(left)}
      tone={left < 20_000 ? 'var(--c-danger)' : undefined}
    />
  );
}

export function GameScreen({
  state, onAdvancePhase, onPick, onCallNothing, onEndFind, onNextRound, onEndRun, onQuit, soundOn,
}: Props) {
  const { phase, round } = state;
  const shakeRef = useRef<HTMLDivElement | null>(null);
  const lastShake = useRef(state.shakeKey);

  // Memorise -> blank -> find, driven by timers rather than user input.
  useEffect(() => {
    if (phase !== 'blank') return;
    const id = window.setTimeout(onAdvancePhase, BLANK_MS);
    return () => window.clearTimeout(id);
  }, [phase, onAdvancePhase]);

  // Replay the shake on a wrong click. Toggling a class needs a reflow between
  // removals, so the animation is restarted explicitly.
  useEffect(() => {
    if (state.shakeKey === lastShake.current) return;
    lastShake.current = state.shakeKey;
    const node = shakeRef.current;
    if (!node) return;
    node.classList.remove('anim-shake');
    void node.offsetWidth;
    node.classList.add('anim-shake');
  }, [state.shakeKey]);

  // Sound cues follow state changes rather than being fired from the reducer,
  // which keeps the reducer pure.
  const prevFound = useRef(0);
  const prevWrong = useRef(0);
  useEffect(() => {
    if (!soundOn) return;
    if (state.foundIds.length > prevFound.current) playSound('hit');
    if (state.wrongClicks > prevWrong.current) playSound('miss');
    prevFound.current = state.foundIds.length;
    prevWrong.current = state.wrongClicks;
  }, [state.foundIds.length, state.wrongClicks, soundOn]);

  useEffect(() => {
    if (phase === 'memorize') {
      prevFound.current = 0;
      prevWrong.current = 0;
    }
  }, [phase, state.roundIndex]);

  const remaining = round.changes.length - state.foundIds.length;

  const progressLabel = useMemo(() => {
    if (state.mode === 'daily') return `Round ${state.roundIndex + 1} of ${DAILY_ROUNDS}`;
    if (state.mode === 'classic') return `Level ${state.level}`;
    if (state.mode === 'speedrun') return `Scene ${state.roundIndex + 1}`;
    return `Scene ${state.roundIndex + 1}`;
  }, [state.mode, state.roundIndex, state.level]);

  if (phase === 'reveal') {
    return (
      <RevealScreen
        state={state}
        onNextRound={onNextRound}
        onQuit={onQuit}
        soundOn={soundOn}
      />
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 pb-8 pt-4 sm:px-6">
      {/* HUD */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <button type="button" className="btn btn-ghost !min-h-10 !px-3" onClick={onQuit}>
          <Icon name="back" size={17} />
          <span className="hidden sm:inline">Menu</span>
        </button>

        <span className="chip !border-accent-soft" style={{ color: 'var(--c-accent)' }}>
          {MODE_LABEL[state.mode]}
        </span>
        <span className="chip">{progressLabel}</span>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          {state.mode === 'classic' && <Lives lives={state.lives} />}
          {state.mode === 'speedrun' && state.runDeadline !== null && (
            <RunClock deadline={state.runDeadline} onExpire={onEndRun} />
          )}
          <Stat icon="trophy" label="Score" value={state.score.toLocaleString()} />
        </div>
      </div>

      {/* Phase banner + timer */}
      <div className="card mb-3 min-h-[86px] px-4 py-3 sm:px-5">
        {phase === 'memorize' && (
          <>
            <div className="mb-2 flex items-center gap-2">
              <Icon name="eye" size={18} className="text-accent" />
              <p className="text-sm font-semibold text-ink">
                Memorise the scene
                <span className="ml-2 font-normal text-muted">
                  {round.nothingChanged || round.changes.length === 0
                    ? 'Something may change.'
                    : `${round.changes.length} thing${round.changes.length === 1 ? '' : 's'} will change.`}
                </span>
              </p>
            </div>
            <TimerBar
              deadline={state.deadline}
              durationMs={round.viewMs}
              onExpire={onAdvancePhase}
              label="Viewing time"
            />
          </>
        )}

        {phase === 'blank' && (
          <div className="flex items-center gap-2 py-1">
            <Icon name="sparkle" size={18} className="text-accent" />
            <p className="text-sm font-semibold text-ink">The thief is working…</p>
          </div>
        )}

        {phase === 'find' && (
          <>
            <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1">
              <Icon name="target" size={18} className="text-accent" />
              <p className="text-sm font-semibold text-ink">
                {remaining > 0
                  ? `${remaining} change${remaining === 1 ? '' : 's'} to find`
                  : 'Find what changed'}
              </p>
              {state.wrongClicks > 0 && (
                <span className="text-xs font-semibold" style={{ color: 'var(--c-danger)' }}>
                  {state.wrongClicks} wrong {state.wrongClicks === 1 ? 'click' : 'clicks'}
                </span>
              )}
            </div>
            <TimerBar
              deadline={state.deadline}
              durationMs={round.findMs || 1}
              onExpire={() => onEndFind('timeout')}
              label="Time to find"
            />
          </>
        )}
      </div>

      {/*
        Scene. The wrapper's max-width is derived from the remaining viewport
        height (scene is 4:3), so the whole board always fits on screen without
        scrolling — essential when the game is "spot the difference".
      */}
      <div
        ref={shakeRef}
        className="card mx-auto overflow-hidden p-2 sm:p-3"
        style={{ maxWidth: 'min(100%, calc((100dvh - 15.5rem) * 4 / 3))' }}
      >
        {phase === 'blank' ? (
          <BlankPanel />
        ) : (
          <SceneView
            scene={phase === 'memorize' ? round.original : round.mutated}
            onPick={phase === 'find' ? onPick : undefined}
            markers={phase === 'find' ? state.markers : []}
            label={phase === 'memorize' ? 'Original scene to memorise' : 'Modified scene — find what changed'}
          />
        )}
      </div>

      {/* Find-phase controls */}
      <div className="mx-auto mt-3 flex flex-wrap items-center justify-between gap-2" style={{ maxWidth: 'min(100%, calc((100dvh - 15.5rem) * 4 / 3))' }}>
        <p className="text-xs text-faint">
          {phase === 'find'
            ? 'Tap or click each spot that changed.'
            : phase === 'memorize'
              ? 'Look closely — colours, sizes and positions all count.'
              : ''}
        </p>
        {phase === 'find' && (
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn" onClick={onCallNothing}>
              <Icon name="flag" size={17} />
              Nothing changed
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => onEndFind('gaveUp')}>
              <Icon name="help" size={17} />
              Give up
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Blank interstitial. A static noise wash rather than a plain colour, so there
 * is no perceptible "flicker" edge between the two scenes to exploit.
 */
function BlankPanel() {
  return (
    <div
      className="anim-fade relative grid aspect-[4/3] w-full place-items-center overflow-hidden rounded-xl"
      style={{ background: 'linear-gradient(160deg, var(--c-surface-2), var(--c-bg-2))' }}
      aria-live="polite"
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.16]"
        style={{
          backgroundImage:
            'repeating-linear-gradient(0deg, transparent 0 3px, rgba(255,255,255,0.5) 3px 4px), repeating-linear-gradient(90deg, transparent 0 5px, rgba(255,255,255,0.35) 5px 6px)',
        }}
      />
      <div
        className="pointer-events-none absolute inset-x-0 h-24 opacity-25"
        style={{
          background: 'linear-gradient(180deg, transparent, var(--c-accent), transparent)',
          animation: `mt-scan ${BLANK_MS}ms linear`,
        }}
      />
      <p className="font-display relative text-sm font-bold uppercase tracking-[0.3em] text-muted">
        Hold still…
      </p>
    </div>
  );
}
