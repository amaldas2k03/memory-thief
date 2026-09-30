/**
 * Daily Challenge: a date maps to a stable seed, so every player in the world
 * gets the same five rounds on the same UTC day.
 */
import { hashString } from './rng';

export const DAILY_ROUNDS = 5;
/** Day #1 of Memory Thief. Used for the puzzle number in the share text. */
const EPOCH_UTC = Date.UTC(2025, 0, 1);

/** "2026-09-30" for the UTC day containing `date`. */
export function dateKey(date: Date = new Date()): string {
  const y = date.getUTCFullYear();
  const m = `${date.getUTCMonth() + 1}`.padStart(2, '0');
  const d = `${date.getUTCDate()}`.padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Stable seed for a UTC date. Same key in, same number out, forever. */
export function dailySeed(key: string = dateKey()): number {
  return hashString(`memory-thief::${key}`);
}

/** Per-round seed, derived from the day seed so all five rounds are fixed too. */
export function dailyRoundSeed(key: string, roundIndex: number): number {
  return hashString(`memory-thief::${key}::r${roundIndex}`);
}

/** Sequential puzzle number since the epoch (1-based), for "Memory Thief #142". */
export function dailyNumber(key: string = dateKey()): number {
  const [y, m, d] = key.split('-').map(Number);
  const dayMs = Date.UTC(y, m - 1, d);
  return Math.floor((dayMs - EPOCH_UTC) / 86_400_000) + 1;
}

/** Milliseconds until the next UTC midnight — drives the "next puzzle in" clock. */
export function msUntilNextDaily(now: Date = new Date()): number {
  const next = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
  return Math.max(0, next - now.getTime());
}

export type DailyRoundResult = {
  /** Every change found with no wrong clicks. */
  perfect: boolean;
  /** At least one change found, or "nothing changed" called correctly. */
  solved: boolean;
};

/**
 * Build the shareable result block, e.g.
 * `Memory Thief #142 🕵️ 4/5 🟩🟩🟧🟩🟩 ⏱️ 1:42`
 */
export function buildShareText(
  key: string,
  results: DailyRoundResult[],
  elapsedLabel: string,
): string {
  const squares = results
    .map((r) => (r.perfect ? '🟩' : r.solved ? '🟧' : '⬛'))
    .join('');
  const solved = results.filter((r) => r.solved).length;
  return `Memory Thief #${dailyNumber(key)} 🕵️ ${solved}/${results.length} ${squares} ⏱️ ${elapsedLabel}`;
}

/** Clipboard write with a document.execCommand fallback for older/secure-context-less browsers. */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall through to the legacy path.
  }
  try {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(area);
    return ok;
  } catch {
    return false;
  }
}
