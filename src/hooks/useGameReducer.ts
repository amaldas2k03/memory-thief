import { useMemo, useReducer } from 'react';
import type { ChangeType, GameMode, Round } from '../game/types';
import { VIEW_W, VIEW_H } from '../game/types';
import { buildRound } from '../game/round';
import {
  difficultyForLevel, zenDifficulty, speedRunDifficulty, dailyDifficulty,
} from '../game/difficulty';
import { resolvePick } from '../game/mutations';
import { scoreRound } from '../game/scoring';
import type { RoundScore } from '../game/scoring';
import { dailyRoundSeed, DAILY_ROUNDS } from '../game/daily';
import type { RoundSummary } from '../game/storage';

export type Phase = 'memorize' | 'blank' | 'find' | 'reveal' | 'runOver';

export const BLANK_MS = 800;
export const CLASSIC_LIVES = 3;
export const SPEEDRUN_MS = 120_000;

export type ClickMarker = { id: string; x: number; y: number; kind: 'hit' | 'miss' };

export type GameState = {
  mode: GameMode;
  phase: Phase;
  round: Round;
  /** 0-based index of the round within the current run. */
  roundIndex: number;
  /** Classic level. Mirrors roundIndex + 1 in Classic, fixed elsewhere. */
  level: number;
  foundIds: string[];
  wrongClicks: number;
  markers: ClickMarker[];
  /** Bumped on every wrong click so the view can replay its shake. */
  shakeKey: number;
  score: number;
  lives: number;
  /** Wall-clock deadline for the current timed phase, or null when untimed. */
  deadline: number | null;
  phaseStartedAt: number;
  runStartedAt: number;
  /** Set when the run's global clock (Speed Run) expires. */
  runDeadline: number | null;
  lastScore: RoundScore | null;
  calledNothing: boolean;
  /** How the find phase ended, for the reveal screen's headline. */
  endReason: 'cleared' | 'timeout' | 'gaveUp' | 'calledNothing' | 'wrongCall' | null;
  /** Per-round results, used for the Daily share squares and Speed Run tally. */
  results: { perfect: boolean; solved: boolean }[];
  /** Appended on every reveal; App drains this into stats/achievements. */
  summaries: RoundSummary[];
  /**
   * Set at reveal time when the run cannot continue (out of lives, last daily
   * round, or the Speed Run clock expired). Held in state rather than recomputed
   * during render so views never have to read the clock themselves.
   */
  runComplete: boolean;
  /** Stamped when the run ends, for the elapsed-time display. */
  runEndedAt: number;
  /** Options captured at run start. */
  colorblindSafe: boolean;
  zenViewMs: number;
  dailyKey: string;
  seedBase: number;
};

export type StartOptions = {
  mode: GameMode;
  colorblindSafe: boolean;
  zenViewMs: number;
  dailyKey: string;
  /** Deterministic base seed; omit for a random run. */
  seedBase?: number;
};

type Action =
  | { type: 'start'; options: StartOptions; now: number }
  | { type: 'beginFind'; now: number }
  | { type: 'pick'; x: number; y: number; touch: boolean; now: number }
  | { type: 'callNothing'; now: number }
  | { type: 'endFind'; reason: 'timeout' | 'gaveUp'; now: number }
  | { type: 'nextRound'; now: number }
  | { type: 'endRun'; now: number };

/** Build the round for a given mode + index. */
function makeRound(state: Pick<GameState, 'mode' | 'colorblindSafe' | 'zenViewMs' | 'dailyKey' | 'seedBase'>, index: number): Round {
  const { mode, colorblindSafe, zenViewMs, dailyKey, seedBase } = state;
  switch (mode) {
    case 'daily':
      return buildRound({
        seed: dailyRoundSeed(dailyKey, index),
        difficulty: dailyDifficulty(index),
        colorblindSafe,
      });
    case 'zen':
      return buildRound({
        seed: (seedBase + index * 7919) >>> 0,
        difficulty: zenDifficulty(zenViewMs),
        colorblindSafe,
        viewMs: zenViewMs,
      });
    case 'speedrun':
      return buildRound({
        seed: (seedBase + index * 6997) >>> 0,
        difficulty: speedRunDifficulty(index),
        colorblindSafe,
      });
    case 'classic':
    default:
      return buildRound({
        seed: (seedBase + index * 104729) >>> 0,
        difficulty: difficultyForLevel(index + 1),
        colorblindSafe,
      });
  }
}

function randomSeed(): number {
  return Math.floor(Math.random() * 0xffffffff) >>> 0;
}

/** Fresh per-round fields, shared by `start` and `nextRound`. */
function enterMemorize(base: GameState, index: number, now: number): GameState {
  const round = makeRound(base, index);
  return {
    ...base,
    round,
    roundIndex: index,
    level: base.mode === 'classic' ? index + 1 : round.level,
    phase: 'memorize',
    foundIds: [],
    wrongClicks: 0,
    markers: [],
    lastScore: null,
    calledNothing: false,
    endReason: null,
    deadline: now + round.viewMs,
    phaseStartedAt: now,
  };
}

export function initialState(): GameState {
  const base: GameState = {
    mode: 'classic',
    phase: 'memorize',
    round: buildRound({ seed: 1, difficulty: difficultyForLevel(1) }),
    roundIndex: 0,
    level: 1,
    foundIds: [],
    wrongClicks: 0,
    markers: [],
    shakeKey: 0,
    score: 0,
    lives: CLASSIC_LIVES,
    deadline: null,
    phaseStartedAt: 0,
    runStartedAt: 0,
    runDeadline: null,
    lastScore: null,
    calledNothing: false,
    endReason: null,
    results: [],
    summaries: [],
    runComplete: false,
    runEndedAt: 0,
    colorblindSafe: false,
    zenViewMs: 10_000,
    dailyKey: '',
    seedBase: 1,
  };
  return base;
}

/** Close out the find phase: score it, record it, and decide whether the run ends. */
function resolveRound(
  state: GameState,
  now: number,
  endReason: NonNullable<GameState['endReason']>,
): GameState {
  const { round } = state;
  const totalChanges = round.changes.length;
  const foundIds = new Set(state.foundIds);
  const calledNothing = endReason === 'calledNothing';

  const remainingMs = state.deadline ? Math.max(0, state.deadline - now) : 0;
  const score = scoreRound({
    totalChanges,
    foundChanges: foundIds.size,
    wrongClicks: state.wrongClicks,
    remainingMs,
    level: state.level,
    calledNothingChanged: calledNothing,
  });

  const foundTypes: ChangeType[] = round.changes.filter((c) => foundIds.has(c.id)).map((c) => c.type);
  const missedTypes: ChangeType[] = round.changes.filter((c) => !foundIds.has(c.id)).map((c) => c.type);

  const solved = round.nothingChanged ? calledNothing : foundIds.size === totalChanges;
  const perfect = score.perfect;

  const summary: RoundSummary = {
    mode: state.mode,
    level: state.level,
    totalChanges,
    foundTypes,
    missedTypes,
    wrongClicks: state.wrongClicks,
    perfect,
    score: score.total,
    findMs: Math.max(0, now - state.phaseStartedAt),
    viewMs: round.viewMs,
    nothingChanged: round.nothingChanged,
  };

  // Classic costs a life for any round that is not fully solved.
  const losesLife = state.mode === 'classic' && !solved;
  const lives = losesLife ? state.lives - 1 : state.lives;

  const results = [...state.results, { perfect, solved }];

  const runComplete =
    (state.mode === 'classic' && lives <= 0)
    || (state.mode === 'daily' && results.length >= DAILY_ROUNDS)
    || (state.mode === 'speedrun' && state.runDeadline !== null && now >= state.runDeadline);

  return {
    ...state,
    phase: 'reveal',
    runComplete,
    runEndedAt: runComplete ? now : state.runEndedAt,
    endReason,
    calledNothing,
    lastScore: score,
    score: state.score + score.total,
    lives,
    results,
    summaries: [...state.summaries, summary],
    deadline: null,
  };
}

function reducer(state: GameState, action: Action): GameState {
  switch (action.type) {
    case 'start': {
      const { options, now } = action;
      const seedBase = options.seedBase ?? randomSeed();
      const base: GameState = {
        ...initialState(),
        mode: options.mode,
        colorblindSafe: options.colorblindSafe,
        zenViewMs: options.zenViewMs,
        dailyKey: options.dailyKey,
        seedBase,
        lives: options.mode === 'classic' ? CLASSIC_LIVES : Infinity,
        runStartedAt: now,
        runDeadline: options.mode === 'speedrun' ? now + SPEEDRUN_MS : null,
        results: [],
        summaries: [],
        runComplete: false,
        runEndedAt: 0,
        score: 0,
      };
      return enterMemorize(base, 0, now);
    }

    case 'beginFind': {
      if (state.phase !== 'memorize' && state.phase !== 'blank') return state;
      const { now } = action;
      if (state.phase === 'memorize') {
        // Memorise -> blank interstitial, so the swap can't be spotted as a flicker.
        return { ...state, phase: 'blank', deadline: now + BLANK_MS, phaseStartedAt: now };
      }
      return {
        ...state,
        phase: 'find',
        phaseStartedAt: now,
        deadline: state.round.findMs > 0 ? now + state.round.findMs : null,
      };
    }

    case 'pick': {
      if (state.phase !== 'find') return state;
      const { x, y, touch, now } = action;
      // Guard against stray coordinates from just outside the frame (a pointer
      // that ends on the card padding rather than on the scene itself).
      if (x < 0 || y < 0 || x > VIEW_W || y > VIEW_H) return state;

      const found = new Set(state.foundIds);
      const result = resolvePick(x, y, state.round.changes, found, touch);
      if (result.kind === 'repeat') return state;

      const marker: ClickMarker = {
        id: `m${now}_${state.markers.length}`,
        x,
        y,
        kind: result.kind === 'hit' ? 'hit' : 'miss',
      };
      // Keep only the most recent markers so long rounds don't accumulate nodes.
      const markers = [...state.markers, marker].slice(-14);

      if (result.kind === 'miss') {
        return { ...state, wrongClicks: state.wrongClicks + 1, markers, shakeKey: state.shakeKey + 1 };
      }

      const foundIds = [...state.foundIds, result.change.id];
      const cleared = foundIds.length >= state.round.changes.length;
      if (cleared) {
        return resolveRound({ ...state, foundIds, markers }, now, 'cleared');
      }
      return { ...state, foundIds, markers };
    }

    case 'callNothing': {
      if (state.phase !== 'find') return state;
      return resolveRound(
        state,
        action.now,
        state.round.nothingChanged ? 'calledNothing' : 'wrongCall',
      );
    }

    case 'endFind': {
      if (state.phase !== 'find') return state;
      return resolveRound(state, action.now, action.reason);
    }

    case 'nextRound': {
      if (state.phase !== 'reveal') return state;
      if (state.runComplete) return { ...state, phase: 'runOver' };
      return enterMemorize(state, state.roundIndex + 1, action.now);
    }

    case 'endRun':
      return {
        ...state,
        phase: 'runOver',
        deadline: null,
        runComplete: true,
        runEndedAt: state.runEndedAt || action.now,
      };

    default:
      return state;
  }
}

export function useGameReducer() {
  const [state, dispatch] = useReducer(reducer, undefined, initialState);

  const actions = useMemo(() => ({
    start: (options: StartOptions) => dispatch({ type: 'start', options, now: Date.now() }),
    advancePhase: () => dispatch({ type: 'beginFind', now: Date.now() }),
    pick: (x: number, y: number, touch: boolean) => dispatch({ type: 'pick', x, y, touch, now: Date.now() }),
    callNothing: () => dispatch({ type: 'callNothing', now: Date.now() }),
    endFind: (reason: 'timeout' | 'gaveUp') => dispatch({ type: 'endFind', reason, now: Date.now() }),
    nextRound: () => dispatch({ type: 'nextRound', now: Date.now() }),
    endRun: () => dispatch({ type: 'endRun', now: Date.now() }),
  }), []);

  const remainingChanges = useMemo(
    () => state.round.changes.length - state.foundIds.length,
    [state.round.changes.length, state.foundIds.length],
  );

  return { state, actions, remainingChanges };
}
