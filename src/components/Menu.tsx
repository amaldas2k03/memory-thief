import { useEffect, useMemo, useState } from 'react';
import { Icon } from './Icon';
import type { IconName } from './Icon';
import type { GameMode } from '../game/types';
import type { Stats, DailyRecord } from '../game/storage';
import { liveStreak } from '../game/storage';
import { dailyNumber, msUntilNextDaily } from '../game/daily';
import { formatDuration, formatPercent } from '../game/scoring';

type Props = {
  onPlay: (mode: GameMode) => void;
  onOpenStats: () => void;
  onOpenSettings: () => void;
  onOpenHowTo: () => void;
  stats: Stats;
  todayKey: string;
  todayRecord: DailyRecord | null;
};

/** The wordmark: a magnifier whose lens doubles as a masked thief's face. */
export function Logo({ size = 64 }: { size?: number }) {
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} aria-hidden="true" className="shrink-0">
      <circle cx="32" cy="32" r="30" fill="var(--c-surface-2)" stroke="var(--c-border)" />
      <circle cx="28" cy="27" r="13.5" fill="var(--c-bg-2)" stroke="var(--c-accent)" strokeWidth="4.5" />
      <path d="M37.8 36.8 L50 49" stroke="var(--c-accent)" strokeWidth="6" strokeLinecap="round" />
      <path d="M19 25 h18" stroke="var(--c-text)" strokeWidth="4.6" strokeLinecap="round" />
      <circle cx="23.6" cy="31" r="3" fill="var(--c-text)" />
      <circle cx="32.4" cy="31" r="3" fill="var(--c-text)" />
    </svg>
  );
}

type ModeCard = {
  mode: GameMode;
  title: string;
  blurb: string;
  icon: IconName;
  accent: string;
};

const MODES: ModeCard[] = [
  { mode: 'classic', title: 'Classic', blurb: 'Endless levels, 3 lives. Gets harder every round.', icon: 'play', accent: 'var(--c-accent)' },
  { mode: 'daily', title: 'Daily Challenge', blurb: '5 rounds. The same for everyone, once a day.', icon: 'calendar', accent: 'var(--c-info)' },
  { mode: 'zen', title: 'Zen', blurb: 'No timer, no lives. Take as long as you like.', icon: 'leaf', accent: 'var(--c-success)' },
  { mode: 'speedrun', title: 'Speed Run', blurb: 'Clear as many scenes as you can in 2 minutes.', icon: 'bolt', accent: 'var(--c-warn)' },
];

/** Live "next daily in hh:mm:ss" countdown. */
function NextDailyClock() {
  const [left, setLeft] = useState(() => msUntilNextDaily());
  useEffect(() => {
    const id = window.setInterval(() => setLeft(msUntilNextDaily()), 1000);
    return () => window.clearInterval(id);
  }, []);
  const hours = Math.floor(left / 3_600_000);
  const minutes = Math.floor((left % 3_600_000) / 60_000);
  const seconds = Math.floor((left % 60_000) / 1000);
  return (
    <span className="tabular-nums">
      {hours}h {minutes.toString().padStart(2, '0')}m {seconds.toString().padStart(2, '0')}s
    </span>
  );
}

export function Menu({ onPlay, onOpenStats, onOpenSettings, onOpenHowTo, stats, todayKey, todayRecord }: Props) {
  const streak = liveStreak(stats, todayKey);
  const accuracy = useMemo(() => {
    const clicks = stats.changesFound + stats.wrongClicks;
    return clicks === 0 ? 0 : stats.changesFound / clicks;
  }, [stats.changesFound, stats.wrongClicks]);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-14 pt-8 sm:px-6 sm:pt-12">
      <header className="anim-fade-up mb-8 flex items-center gap-4">
        <Logo size={68} />
        <div className="min-w-0">
          <h1 className="font-display text-3xl font-bold leading-tight sm:text-4xl">
            Memory <span className="text-accent">Thief</span>
          </h1>
          <p className="mt-0.5 text-sm text-muted">
            Memorise the scene. Find what the thief changed.
          </p>
        </div>
      </header>

      <div className="anim-fade-up grid gap-3 sm:grid-cols-2" style={{ animationDelay: '60ms' }}>
        {MODES.map((card) => {
          const lockedDaily = card.mode === 'daily' && todayRecord !== null;
          return (
            <button
              key={card.mode}
              type="button"
              onClick={() => onPlay(card.mode)}
              disabled={lockedDaily}
              aria-label={lockedDaily ? `${card.title} — already played today` : `Play ${card.title}`}
              className="card group relative flex w-full flex-col items-start gap-1 p-4 text-left transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-0.5 hover:border-[var(--c-border-strong)] hover:shadow-[var(--shadow-lift)] disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:translate-y-0 disabled:hover:shadow-[var(--shadow-card)]"
            >
              <span className="mb-1 flex items-center gap-2">
                <span
                  className="grid h-9 w-9 place-items-center rounded-xl"
                  style={{ background: `color-mix(in oklab, ${card.accent} 18%, transparent)`, color: card.accent }}
                >
                  <Icon name={card.icon} size={18} filled={card.icon === 'play'} />
                </span>
                <span className="font-display text-base font-bold text-ink">{card.title}</span>
              </span>
              <span className="text-sm text-muted">{card.blurb}</span>

              {card.mode === 'daily' && (
                <span className="mt-2 flex flex-wrap items-center gap-2 text-[0.72rem] font-semibold">
                  <span className="chip">#{dailyNumber(todayKey)}</span>
                  {streak > 0 && (
                    <span className="chip" style={{ color: 'var(--c-accent)' }}>
                      <Icon name="sparkle" size={12} />
                      {streak}-day streak
                    </span>
                  )}
                  {lockedDaily && (
                    <span className="chip" style={{ color: 'var(--c-success)' }}>
                      <Icon name="check" size={12} />
                      {todayRecord.solved}/{todayRecord.total} done
                    </span>
                  )}
                </span>
              )}

              {lockedDaily && (
                <span className="mt-1 text-[0.72rem] text-faint">
                  Next puzzle in <NextDailyClock />
                </span>
              )}

              {card.mode === 'speedrun' && stats.bestSpeedRun > 0 && (
                <span className="mt-2 chip">Best: {stats.bestSpeedRun} scenes</span>
              )}
              {card.mode === 'classic' && stats.bestClassicLevel > 0 && (
                <span className="mt-2 chip">Best: level {stats.bestClassicLevel}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Quick stat strip */}
      {stats.roundsPlayed > 0 && (
        <div className="anim-fade-up mt-4 grid grid-cols-3 gap-3" style={{ animationDelay: '120ms' }}>
          {[
            { label: 'Rounds', value: stats.roundsPlayed.toLocaleString() },
            { label: 'Accuracy', value: formatPercent(accuracy) },
            {
              label: 'Avg find',
              value: stats.findRounds > 0 ? formatDuration(stats.totalFindMs / stats.findRounds) : '—',
            },
          ].map((item) => (
            <div key={item.label} className="card px-3 py-2.5 text-center">
              <p className="font-display text-lg font-bold tabular-nums text-ink">{item.value}</p>
              <p className="text-[0.7rem] uppercase tracking-[0.1em] text-faint">{item.label}</p>
            </div>
          ))}
        </div>
      )}

      <nav className="anim-fade-up mt-4 flex flex-wrap gap-2" style={{ animationDelay: '160ms' }} aria-label="More">
        <button type="button" className="btn" onClick={onOpenHowTo}>
          <Icon name="help" size={17} />
          How to play
        </button>
        <button type="button" className="btn" onClick={onOpenStats}>
          <Icon name="chart" size={17} />
          Stats
        </button>
        <button type="button" className="btn" onClick={onOpenSettings}>
          <Icon name="settings" size={17} />
          Settings
        </button>
      </nav>

      <p className="mt-8 text-center text-xs text-faint">
        No account, no ads, no downloads. Progress is saved in this browser only.
      </p>
    </div>
  );
}
