/** Ties the generator and the thief together into a playable round. */
import { Rng } from './rng';
import type { Round, ThemeId } from './types';
import { generateScene } from './sceneGenerator';
import { applyMutations } from './mutations';
import type { DifficultySpec } from './difficulty';

export type BuildRoundOptions = {
  seed: number;
  difficulty: DifficultySpec;
  colorblindSafe?: boolean;
  theme?: ThemeId;
  /** Override the viewing time (Zen mode's slider). */
  viewMs?: number;
};

export function buildRound(options: BuildRoundOptions): Round {
  const { seed, difficulty, colorblindSafe = false, theme } = options;
  const original = generateScene({ seed, difficulty, colorblindSafe, theme });

  // Decide up front whether the thief takes the night off. Derived from the seed
  // so a given seed always produces the same round.
  const coin = new Rng(seed ^ 0x2f6e2b1);
  const nothingChanged = coin.chance(difficulty.nothingChangedChance);

  if (nothingChanged) {
    return {
      seed,
      level: difficulty.level,
      original,
      mutated: { ...original, id: `${original.id}m` },
      changes: [],
      nothingChanged: true,
      viewMs: options.viewMs ?? difficulty.viewMs,
      findMs: difficulty.findMs,
    };
  }

  const { mutated, changes } = applyMutations(original, difficulty, seed, colorblindSafe);

  // Extremely rare, but if the thief failed to land a single change, fall back
  // to treating it as a "nothing changed" round rather than an unwinnable one.
  return {
    seed,
    level: difficulty.level,
    original,
    mutated,
    changes,
    nothingChanged: changes.length === 0,
    viewMs: options.viewMs ?? difficulty.viewMs,
    findMs: difficulty.findMs,
  };
}
