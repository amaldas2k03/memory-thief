/** Unlockable achievements, evaluated after every round. */
import type { Stats, RoundSummary } from './storage';

export type Achievement = {
  id: string;
  name: string;
  description: string;
  /** Return true when the achievement should unlock. */
  test: (stats: Stats, summary: RoundSummary) => boolean;
};

export const ACHIEVEMENTS: readonly Achievement[] = [
  {
    id: 'first-case',
    name: 'First Case',
    description: 'Solve your first round.',
    test: (_s, r) => r.foundTypes.length > 0 || (r.nothingChanged && r.perfect),
  },
  {
    id: 'eagle-eye',
    name: 'Eagle Eye',
    description: 'Clear a perfect round with only 4 seconds of viewing time.',
    test: (_s, r) => r.perfect && r.viewMs <= 4000 && r.totalChanges > 0,
  },
  {
    id: 'quick-draw',
    name: 'Quick Draw',
    description: 'Clear a round with 2 or more changes in under 5 seconds.',
    test: (_s, r) => r.perfect && r.totalChanges >= 2 && r.findMs <= 5000,
  },
  {
    id: 'clean-sweep',
    name: 'Clean Sweep',
    description: 'Find 4 changes in one round without a single wrong click.',
    test: (_s, r) => r.perfect && r.totalChanges >= 4,
  },
  {
    id: 'not-fooled',
    name: 'Not Fooled',
    description: 'Correctly call a round where nothing changed.',
    test: (_s, r) => r.nothingChanged && r.perfect,
  },
  {
    id: 'detective',
    name: 'Detective',
    description: 'Reach level 10 in Classic.',
    test: (s) => s.bestClassicLevel >= 10,
  },
  {
    id: 'inspector',
    name: 'Chief Inspector',
    description: 'Reach level 20 in Classic.',
    test: (s) => s.bestClassicLevel >= 20,
  },
  {
    id: 'century',
    name: 'Century',
    description: 'Play 100 rounds.',
    test: (s) => s.roundsPlayed >= 100,
  },
  {
    id: 'sharp-shooter',
    name: 'Sharp Shooter',
    description: 'Finish 10 perfect rounds.',
    test: (s) => s.roundsPerfect >= 10,
  },
  {
    id: 'regular',
    name: 'Regular',
    description: 'Keep a 3-day Daily Challenge streak.',
    test: (s) => s.dailyStreak >= 3,
  },
  {
    id: 'week-watch',
    name: 'Week on Watch',
    description: 'Keep a 7-day Daily Challenge streak.',
    test: (s) => s.dailyStreak >= 7,
  },
  {
    id: 'speed-demon',
    name: 'Speed Demon',
    description: 'Clear 8 scenes in a single Speed Run.',
    test: (s) => s.bestSpeedRun >= 8,
  },
];

export function achievementById(id: string): Achievement | undefined {
  return ACHIEVEMENTS.find((a) => a.id === id);
}

/**
 * Returns the ids newly unlocked by this round. Caller is responsible for
 * merging them into stats and showing the toast.
 */
export function evaluateAchievements(stats: Stats, summary: RoundSummary): string[] {
  const owned = new Set(stats.achievements);
  return ACHIEVEMENTS.filter((a) => !owned.has(a.id) && a.test(stats, summary)).map((a) => a.id);
}
