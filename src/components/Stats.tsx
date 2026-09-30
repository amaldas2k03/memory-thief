import { useMemo } from 'react';
import { Icon } from './Icon';
import type { Stats as StatsShape } from '../game/storage';
import { liveStreak } from '../game/storage';
import { ACHIEVEMENTS } from '../game/achievements';
import { formatDuration, formatPercent } from '../game/scoring';
import type { ChangeType } from '../game/types';

type Props = {
  stats: StatsShape;
  todayKey: string;
  onBack: () => void;
  onReset: () => void;
};

const TYPE_LABEL: Record<ChangeType, string> = {
  remove: 'Removed objects',
  add: 'Added objects',
  recolor: 'Colour changes',
  move: 'Moved objects',
  resize: 'Size changes',
  rotate: 'Rotations',
  flip: 'Mirror flips',
  swap: 'Object swaps',
  text: 'Text changes',
};

function BigStat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="card px-4 py-3">
      <p className="font-display text-2xl font-bold tabular-nums text-ink">{value}</p>
      <p className="text-[0.72rem] font-semibold uppercase tracking-[0.1em] text-faint">{label}</p>
      {sub && <p className="mt-0.5 text-xs text-muted">{sub}</p>}
    </div>
  );
}

/**
 * Miss-rate bars, drawn with plain divs — no chart library.
 * Each row shows how often the player misses that kind of change.
 */
function MissRateChart({ stats }: { stats: StatsShape }) {
  const rows = useMemo(() => {
    return (Object.keys(TYPE_LABEL) as ChangeType[])
      .map((type) => {
        const tally = stats.byType?.[type] ?? { found: 0, missed: 0 };
        const seen = tally.found + tally.missed;
        return { type, seen, rate: seen === 0 ? 0 : tally.missed / seen };
      })
      .filter((row) => row.seen > 0)
      .sort((a, b) => b.rate - a.rate);
  }, [stats.byType]);

  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted">
        Play a few rounds and this will show which kinds of change slip past you most often.
      </p>
    );
  }

  const worst = rows[0];

  return (
    <>
      {worst.rate > 0.2 && (
        <p className="mb-3 rounded-xl border border-line bg-surface-2 px-3 py-2 text-sm text-muted">
          You miss <strong className="text-ink">{TYPE_LABEL[worst.type].toLowerCase()}</strong>{' '}
          <strong style={{ color: 'var(--c-warn)' }}>{formatPercent(worst.rate)}</strong> of the time.
        </p>
      )}
      <ul className="space-y-2.5">
        {rows.map((row) => {
          const tone = row.rate >= 0.4 ? 'var(--c-danger)' : row.rate >= 0.2 ? 'var(--c-warn)' : 'var(--c-success)';
          return (
            <li key={row.type}>
              <div className="mb-1 flex items-baseline justify-between gap-2 text-xs">
                <span className="font-semibold text-ink">{TYPE_LABEL[row.type]}</span>
                <span className="tabular-nums text-muted">
                  {formatPercent(row.rate)} missed
                  <span className="text-faint"> · {row.seen} seen</span>
                </span>
              </div>
              <div
                className="h-2.5 overflow-hidden rounded-full bg-surface-2 ring-1 ring-inset ring-line"
                role="img"
                aria-label={`${TYPE_LABEL[row.type]}: ${formatPercent(row.rate)} missed out of ${row.seen} seen`}
              >
                <div
                  className="h-full rounded-full transition-[width] duration-500"
                  style={{ width: `${Math.max(2, row.rate * 100)}%`, background: tone }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}

export function Stats({ stats, todayKey, onBack, onReset }: Props) {
  const accuracy = useMemo(() => {
    const clicks = stats.changesFound + stats.wrongClicks;
    return clicks === 0 ? 0 : stats.changesFound / clicks;
  }, [stats.changesFound, stats.wrongClicks]);

  const owned = useMemo(() => new Set(stats.achievements), [stats.achievements]);
  const streak = liveStreak(stats, todayKey);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-14 pt-6 sm:px-6">
      <div className="mb-4 flex items-center gap-3">
        <button type="button" className="btn btn-ghost !min-h-10 !px-3" onClick={onBack}>
          <Icon name="back" size={17} />
          Menu
        </button>
        <h2 className="font-display text-xl font-bold">Your record</h2>
      </div>

      {stats.roundsPlayed === 0 ? (
        <p className="card px-4 py-6 text-center text-sm text-muted">
          Nothing on file yet. Play a round and your stats will appear here.
        </p>
      ) : (
        <>
          <div className="anim-fade-up grid grid-cols-2 gap-3 sm:grid-cols-4">
            <BigStat label="Rounds" value={stats.roundsPlayed.toLocaleString()} sub={`${stats.roundsPerfect} perfect`} />
            <BigStat label="Accuracy" value={formatPercent(accuracy)} sub={`${stats.wrongClicks} wrong clicks`} />
            <BigStat
              label="Avg find"
              value={stats.findRounds > 0 ? formatDuration(stats.totalFindMs / stats.findRounds) : '—'}
            />
            <BigStat label="Total score" value={stats.totalScore.toLocaleString()} />
          </div>

          <div className="anim-fade-up mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4" style={{ animationDelay: '60ms' }}>
            <BigStat label="Best level" value={stats.bestClassicLevel ? `${stats.bestClassicLevel}` : '—'} />
            <BigStat label="Best run" value={stats.bestClassicScore ? stats.bestClassicScore.toLocaleString() : '—'} />
            <BigStat label="Speed Run" value={stats.bestSpeedRun ? `${stats.bestSpeedRun}` : '—'} sub="scenes cleared" />
            <BigStat
              label="Daily streak"
              value={`${streak}`}
              sub={stats.bestDailyStreak > 0 ? `best ${stats.bestDailyStreak}` : undefined}
            />
          </div>

          <section className="anim-fade-up card mt-4 p-4" style={{ animationDelay: '100ms' }}>
            <h3 className="font-display mb-3 text-base font-bold">What slips past you</h3>
            <MissRateChart stats={stats} />
          </section>
        </>
      )}

      <section className="anim-fade-up card mt-4 p-4" style={{ animationDelay: '140ms' }}>
        <h3 className="font-display mb-3 flex items-center gap-2 text-base font-bold">
          Achievements
          <span className="chip">{owned.size}/{ACHIEVEMENTS.length}</span>
        </h3>
        <ul className="grid gap-2 sm:grid-cols-2">
          {ACHIEVEMENTS.map((achievement) => {
            const unlocked = owned.has(achievement.id);
            return (
              <li
                key={achievement.id}
                className="flex items-start gap-3 rounded-xl border px-3 py-2.5"
                style={{
                  borderColor: unlocked ? 'color-mix(in oklab, var(--c-accent) 50%, var(--c-border))' : 'var(--c-border)',
                  background: unlocked ? 'color-mix(in oklab, var(--c-accent) 8%, transparent)' : 'transparent',
                  opacity: unlocked ? 1 : 0.62,
                }}
              >
                <span
                  className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg"
                  style={{
                    background: unlocked ? 'var(--c-accent)' : 'var(--c-surface-2)',
                    color: unlocked ? 'var(--c-on-accent)' : 'var(--c-text-faint)',
                  }}
                >
                  <Icon name={unlocked ? 'trophy' : 'target'} size={15} />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-ink">{achievement.name}</p>
                  <p className="text-xs text-muted">{achievement.description}</p>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <div className="mt-4 flex justify-end">
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => {
            if (window.confirm('Reset all stats, achievements and daily history? This cannot be undone.')) {
              onReset();
            }
          }}
        >
          <Icon name="refresh" size={17} />
          Reset all progress
        </button>
      </div>
    </div>
  );
}
