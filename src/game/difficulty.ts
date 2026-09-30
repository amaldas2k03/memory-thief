/** Difficulty curve: how the game tightens as the player levels up. */
import type { ChangeType } from './types';
import { clamp } from './rng';

export type DifficultySpec = {
  level: number;
  /** How many objects to place in the scene. */
  objectCount: number;
  /** How many changes the thief makes. */
  changeCount: number;
  /** Memorise-phase duration in ms. */
  viewMs: number;
  /** Find-phase duration in ms (0 = untimed). */
  findMs: number;
  /** Change types the thief may use at this level. */
  allowedTypes: ChangeType[];
  /** 0 = blatant, 1 = as subtle as the engine allows. Scales move/resize/recolor deltas. */
  subtlety: number;
  /** Probability that the thief takes the round off entirely. */
  nothingChangedChance: number;
};

/**
 * Change types unlock in tiers so early rounds teach the mechanic before the
 * subtle stuff (small moves, text edits) arrives.
 */
const TIERS: { from: number; types: ChangeType[] }[] = [
  { from: 1, types: ['remove', 'add'] },
  { from: 3, types: ['recolor', 'resize'] },
  { from: 5, types: ['move', 'swap'] },
  { from: 8, types: ['rotate', 'flip'] },
  { from: 11, types: ['text'] },
];

export function allowedTypesForLevel(level: number): ChangeType[] {
  return TIERS.filter((t) => level >= t.from).flatMap((t) => t.types);
}

export function difficultyForLevel(level: number): DifficultySpec {
  const lv = Math.max(1, Math.floor(level));
  // Objects: 9 at level 1, +~1 every level and a bit, capped so the scene stays readable.
  const objectCount = clamp(Math.round(8 + lv * 0.8), 9, 20);
  // Changes: 1 at level 1 up to 5 at level 15+.
  const changeCount = clamp(Math.floor(1 + (lv - 1) / 3.2), 1, 5);
  // Viewing time: 10s down to a floor of 4s.
  const viewMs = Math.round(clamp(10_000 - (lv - 1) * 500, 4000, 10_000));
  // Find time: 30s down to 18s, but never less time than there is work to do.
  const findMs = Math.round(clamp(30_000 - (lv - 1) * 700, 18_000, 30_000));
  const subtlety = clamp((lv - 1) / 18, 0, 1);
  // ~1 in 12 rounds from level 6 onward.
  const nothingChangedChance = lv >= 6 ? 1 / 12 : 0;

  return {
    level: lv,
    objectCount,
    changeCount,
    viewMs,
    findMs,
    allowedTypes: allowedTypesForLevel(lv),
    subtlety,
    nothingChangedChance,
  };
}

/** Zen mode: fixed gentle difficulty, no find-phase timer, player-set viewing time. */
export function zenDifficulty(viewMs: number): DifficultySpec {
  return {
    ...difficultyForLevel(5),
    viewMs,
    findMs: 0,
    nothingChangedChance: 0,
  };
}

/** Speed Run: quick, legible rounds — the 2-minute clock is the pressure, not the round. */
export function speedRunDifficulty(roundIndex: number): DifficultySpec {
  const spec = difficultyForLevel(1 + Math.floor(roundIndex * 1.5));
  return {
    ...spec,
    objectCount: clamp(spec.objectCount, 7, 13),
    changeCount: clamp(spec.changeCount, 1, 3),
    viewMs: Math.round(clamp(6000 - roundIndex * 200, 3000, 6000)),
    findMs: 0,
    nothingChangedChance: 0,
  };
}

/**
 * Daily Challenge: a fixed five-round ramp so everyone plays the same shape of
 * game. "Nothing changed" stays seed-driven rather than pinned to a fixed round,
 * otherwise players would learn that round 4 is always the free one.
 */
export function dailyDifficulty(roundIndex: number): DifficultySpec {
  const spec = difficultyForLevel([2, 5, 8, 11, 14][roundIndex] ?? 8);
  return { ...spec, nothingChangedChance: 1 / 8 };
}
