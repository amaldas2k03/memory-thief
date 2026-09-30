/** Persisted settings, lifetime stats and daily-challenge records. */
import type { ChangeType, GameMode } from './types';

export const STORAGE_KEYS = {
  settings: 'memory-thief:settings:v1',
  stats: 'memory-thief:stats:v1',
  daily: 'memory-thief:daily:v1',
} as const;

export type ThemePreference = 'system' | 'light' | 'dark';
export type MotionPreference = 'system' | 'reduced' | 'full';

export type Settings = {
  sound: boolean;
  motion: MotionPreference;
  colorblindSafe: boolean;
  theme: ThemePreference;
  /** Zen-mode viewing time in ms. */
  zenViewMs: number;
  /** Set once the player has seen the How to play modal. */
  seenIntro: boolean;
};

export const DEFAULT_SETTINGS: Settings = {
  sound: true,
  motion: 'system',
  colorblindSafe: false,
  theme: 'system',
  zenViewMs: 10_000,
  seenIntro: false,
};

export type TypeTally = { found: number; missed: number };

export type Stats = {
  roundsPlayed: number;
  roundsPerfect: number;
  changesFound: number;
  changesMissed: number;
  wrongClicks: number;
  /** Sum of find-phase durations, used for the average. */
  totalFindMs: number;
  findRounds: number;
  bestClassicLevel: number;
  bestClassicScore: number;
  bestSpeedRun: number;
  totalScore: number;
  byType: Record<ChangeType, TypeTally>;
  achievements: string[];
  /** Last completed daily, its streak and the longest streak reached. */
  lastDailyKey: string | null;
  dailyStreak: number;
  bestDailyStreak: number;
  dailiesPlayed: number;
};

const EMPTY_TALLY = (): Record<ChangeType, TypeTally> => ({
  remove: { found: 0, missed: 0 },
  add: { found: 0, missed: 0 },
  recolor: { found: 0, missed: 0 },
  move: { found: 0, missed: 0 },
  resize: { found: 0, missed: 0 },
  rotate: { found: 0, missed: 0 },
  flip: { found: 0, missed: 0 },
  swap: { found: 0, missed: 0 },
  text: { found: 0, missed: 0 },
});

export const DEFAULT_STATS: Stats = {
  roundsPlayed: 0,
  roundsPerfect: 0,
  changesFound: 0,
  changesMissed: 0,
  wrongClicks: 0,
  totalFindMs: 0,
  findRounds: 0,
  bestClassicLevel: 0,
  bestClassicScore: 0,
  bestSpeedRun: 0,
  totalScore: 0,
  byType: EMPTY_TALLY(),
  achievements: [],
  lastDailyKey: null,
  dailyStreak: 0,
  bestDailyStreak: 0,
  dailiesPlayed: 0,
};

/** One finished round, handed to the stats/achievement layer. */
export type RoundSummary = {
  mode: GameMode;
  level: number;
  totalChanges: number;
  foundTypes: ChangeType[];
  missedTypes: ChangeType[];
  wrongClicks: number;
  perfect: boolean;
  score: number;
  /** How long the find phase actually took. */
  findMs: number;
  /** Viewing time the player had, used by the "Eagle Eye" achievement. */
  viewMs: number;
  nothingChanged: boolean;
};

export function applyRoundToStats(stats: Stats, summary: RoundSummary): Stats {
  const byType: Record<ChangeType, TypeTally> = { ...EMPTY_TALLY() };
  for (const key of Object.keys(byType) as ChangeType[]) {
    byType[key] = { ...(stats.byType?.[key] ?? { found: 0, missed: 0 }) };
  }
  for (const t of summary.foundTypes) byType[t].found += 1;
  for (const t of summary.missedTypes) byType[t].missed += 1;

  return {
    ...stats,
    byType,
    roundsPlayed: stats.roundsPlayed + 1,
    roundsPerfect: stats.roundsPerfect + (summary.perfect ? 1 : 0),
    changesFound: stats.changesFound + summary.foundTypes.length,
    changesMissed: stats.changesMissed + summary.missedTypes.length,
    wrongClicks: stats.wrongClicks + summary.wrongClicks,
    totalFindMs: stats.totalFindMs + summary.findMs,
    findRounds: stats.findRounds + 1,
    totalScore: stats.totalScore + summary.score,
  };
}

export type DailyRecord = {
  /** UTC date key of the last daily played. */
  key: string;
  solved: number;
  total: number;
  perfect: number;
  share: string;
  score: number;
};

export type DailyState = {
  /** Completed dailies, newest first, capped so storage stays small. */
  history: DailyRecord[];
};

export const DEFAULT_DAILY: DailyState = { history: [] };

export function dailyCompleted(daily: DailyState, key: string): DailyRecord | null {
  return daily.history.find((h) => h.key === key) ?? null;
}

export function recordDaily(daily: DailyState, record: DailyRecord): DailyState {
  const history = [record, ...daily.history.filter((h) => h.key !== record.key)].slice(0, 60);
  return { history };
}

/** "2026-09-30" -> "2026-09-29". Used to decide whether a streak continues. */
export function previousDateKey(key: string): string {
  const [y, m, d] = key.split('-').map(Number);
  const prev = new Date(Date.UTC(y, m - 1, d - 1));
  return `${prev.getUTCFullYear()}-${`${prev.getUTCMonth() + 1}`.padStart(2, '0')}-${`${prev.getUTCDate()}`.padStart(2, '0')}`;
}

export function updateDailyStreak(stats: Stats, key: string): Stats {
  if (stats.lastDailyKey === key) return stats;
  const continues = stats.lastDailyKey === previousDateKey(key);
  const dailyStreak = continues ? stats.dailyStreak + 1 : 1;
  return {
    ...stats,
    lastDailyKey: key,
    dailyStreak,
    bestDailyStreak: Math.max(stats.bestDailyStreak, dailyStreak),
    dailiesPlayed: stats.dailiesPlayed + 1,
  };
}

/**
 * A streak is only "live" if the last daily was today or yesterday; otherwise
 * it has lapsed and should display as 0 without rewriting storage.
 */
export function liveStreak(stats: Stats, todayKey: string): number {
  if (!stats.lastDailyKey) return 0;
  if (stats.lastDailyKey === todayKey) return stats.dailyStreak;
  if (stats.lastDailyKey === previousDateKey(todayKey)) return stats.dailyStreak;
  return 0;
}
