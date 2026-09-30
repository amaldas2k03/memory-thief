/**
 * Scoring. Every function here is pure and side-effect free so it can be unit
 * tested without touching React or the DOM.
 */

export const POINTS_PER_FIND = 100;
export const WRONG_CLICK_PENALTY = 25;
export const PERFECT_ROUND_BONUS = 150;
/** Points awarded per whole second left on the find clock (perfect rounds only). */
export const TIME_BONUS_PER_SECOND = 6;
export const NOTHING_CHANGED_POINTS = 150;

export type RoundOutcome = {
  totalChanges: number;
  foundChanges: number;
  wrongClicks: number;
  /** Milliseconds left on the find timer. 0 for untimed modes. */
  remainingMs: number;
  level: number;
  /** True when the round was a "nothing changed" round and the player called it. */
  calledNothingChanged?: boolean;
};

export type RoundScore = {
  base: number;
  timeBonus: number;
  penalty: number;
  perfectBonus: number;
  /** Never below zero — a bad round costs you progress, not your whole run. */
  total: number;
  perfect: boolean;
  accuracy: number;
};

/** Level multiplier: +5% per level, so late rounds are worth chasing. */
export function levelMultiplier(level: number): number {
  return 1 + Math.max(0, Math.floor(level) - 1) * 0.05;
}

/**
 * Click accuracy for the round: correct clicks / total clicks.
 * A round with no clicks at all counts as 0 accuracy (the player did nothing).
 */
export function roundAccuracy(foundChanges: number, wrongClicks: number): number {
  const clicks = foundChanges + wrongClicks;
  if (clicks === 0) return 0;
  return foundChanges / clicks;
}

export function scoreRound(outcome: RoundOutcome): RoundScore {
  const {
    totalChanges, foundChanges, wrongClicks, remainingMs, level, calledNothingChanged,
  } = outcome;

  const multiplier = levelMultiplier(level);

  // "Nothing changed" rounds have no hitboxes, so they score as a flat reward.
  if (totalChanges === 0) {
    const base = calledNothingChanged ? NOTHING_CHANGED_POINTS : 0;
    const penalty = wrongClicks * WRONG_CLICK_PENALTY;
    const timeBonus = calledNothingChanged
      ? Math.floor(remainingMs / 1000) * TIME_BONUS_PER_SECOND
      : 0;
    const total = Math.max(0, Math.round((base + timeBonus - penalty) * multiplier));
    return {
      base,
      timeBonus,
      penalty,
      perfectBonus: 0,
      total,
      perfect: Boolean(calledNothingChanged) && wrongClicks === 0,
      accuracy: calledNothingChanged && wrongClicks === 0 ? 1 : 0,
    };
  }

  const allFound = foundChanges >= totalChanges;
  const base = foundChanges * POINTS_PER_FIND;
  const penalty = wrongClicks * WRONG_CLICK_PENALTY;
  // Time bonus only rewards clearing the round — no points for stalling.
  const timeBonus = allFound ? Math.floor(Math.max(0, remainingMs) / 1000) * TIME_BONUS_PER_SECOND : 0;
  const perfect = allFound && wrongClicks === 0;
  const perfectBonus = perfect ? PERFECT_ROUND_BONUS : 0;

  const total = Math.max(0, Math.round((base + timeBonus + perfectBonus - penalty) * multiplier));

  return {
    base,
    timeBonus,
    penalty,
    perfectBonus,
    total,
    perfect,
    accuracy: roundAccuracy(foundChanges, wrongClicks),
  };
}

/** mm:ss for the share string and the stats screen. */
export function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

/** 0.8731 -> "87%" */
export function formatPercent(fraction: number): string {
  if (!Number.isFinite(fraction)) return '0%';
  return `${Math.round(fraction * 100)}%`;
}
