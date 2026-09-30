import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Menu } from './components/Menu';
import { GameScreen } from './components/GameScreen';
import { RunOver } from './components/RunOver';
import { Stats } from './components/Stats';
import { Settings } from './components/Settings';
import { HowToPlay } from './components/HowToPlay';
import { Toasts } from './components/Toasts';
import type { Toast } from './components/Toasts';
import { useGameReducer } from './hooks/useGameReducer';
import { useLocalStorage, removeStored, readStored } from './hooks/useLocalStorage';
import {
  DEFAULT_SETTINGS, DEFAULT_STATS, DEFAULT_DAILY, STORAGE_KEYS,
  applyRoundToStats, dailyCompleted, recordDaily, updateDailyStreak,
} from './game/storage';
import type { Settings as SettingsShape, Stats as StatsShape, DailyState, RoundSummary } from './game/storage';
import { evaluateAchievements, achievementById } from './game/achievements';
import { dateKey, buildShareText } from './game/daily';
import { formatDuration } from './game/scoring';
import { setSoundEnabled, playSound } from './game/sound';
import type { GameMode } from './game/types';

type Screen = 'menu' | 'game' | 'stats' | 'settings';

/** Applies the theme + motion preferences to <html> so CSS can key off them. */
function useAppearance(settings: SettingsShape) {
  useEffect(() => {
    const root = document.documentElement;

    const apply = () => {
      const prefersLight = window.matchMedia('(prefers-color-scheme: light)').matches;
      const resolved = settings.theme === 'system' ? (prefersLight ? 'light' : 'dark') : settings.theme;
      root.setAttribute('data-theme', resolved);
      root.setAttribute('data-motion', settings.motion);
    };

    apply();
    const media = window.matchMedia('(prefers-color-scheme: light)');
    // Only re-resolve on OS changes while the player is on "System".
    if (settings.theme !== 'system') return;
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [settings.theme, settings.motion]);
}

export default function App() {
  const [settings, setSettings] = useLocalStorage<SettingsShape>(STORAGE_KEYS.settings, DEFAULT_SETTINGS);
  const [stats, setStats] = useLocalStorage<StatsShape>(STORAGE_KEYS.stats, DEFAULT_STATS);
  const [daily, setDaily] = useLocalStorage<DailyState>(STORAGE_KEYS.daily, DEFAULT_DAILY);

  const [screen, setScreen] = useState<Screen>('menu');
  // Shown automatically on a player's very first visit.
  const [showHowTo, setShowHowTo] = useState(() => !readStored(STORAGE_KEYS.settings, DEFAULT_SETTINGS).seenIntro);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const { state, actions } = useGameReducer();
  useAppearance(settings);

  // Today's UTC key, refreshed if the tab is left open across midnight.
  const [todayKey, setTodayKey] = useState(() => dateKey());
  useEffect(() => {
    const id = window.setInterval(() => setTodayKey(dateKey()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    setSoundEnabled(settings.sound);
  }, [settings.sound]);

  const pushToast = useCallback((toast: Omit<Toast, 'id'>) => {
    setToasts((prev) => [...prev, { ...toast, id: `t${Date.now()}_${Math.random().toString(36).slice(2, 7)}` }].slice(-3));
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  /*
    Stats are recorded by draining `state.summaries`. The reducer stays pure and
    this effect owns every write to localStorage, so a round can never be
    counted twice even if the component re-renders.
  */
  const drainedRef = useRef(0);
  useEffect(() => {
    if (state.summaries.length <= drainedRef.current) return;
    const fresh = state.summaries.slice(drainedRef.current);
    drainedRef.current = state.summaries.length;

    setStats((prev) => {
      let next = prev;
      const unlocked: string[] = [];
      for (const summary of fresh as RoundSummary[]) {
        next = applyRoundToStats(next, summary);
        if (summary.mode === 'classic') {
          next = {
            ...next,
            bestClassicLevel: Math.max(next.bestClassicLevel, summary.level),
          };
        }
        unlocked.push(...evaluateAchievements(next, summary));
      }
      if (unlocked.length > 0) {
        next = { ...next, achievements: [...new Set([...next.achievements, ...unlocked])] };
      }
      // Toasts are queued outside the updater to keep it side-effect free.
      queueMicrotask(() => {
        for (const id of unlocked) {
          const achievement = achievementById(id);
          if (!achievement) continue;
          pushToast({ tone: 'achievement', title: `Unlocked: ${achievement.name}`, body: achievement.description });
        }
        if (unlocked.length > 0 && settings.sound) playSound('achievement');
      });
      return next;
    });
  }, [state.summaries, setStats, pushToast, settings.sound]);

  // End-of-run bookkeeping: best scores, daily record and streak.
  const recordedRunRef = useRef<string | null>(null);
  useEffect(() => {
    if (state.phase !== 'runOver') return;
    const runId = `${state.mode}:${state.runStartedAt}`;
    if (recordedRunRef.current === runId) return;
    recordedRunRef.current = runId;

    const solved = state.results.filter((r) => r.solved).length;

    setStats((prev) => {
      let next = prev;
      if (state.mode === 'classic') {
        next = { ...next, bestClassicScore: Math.max(next.bestClassicScore, state.score) };
      }
      if (state.mode === 'speedrun') {
        next = { ...next, bestSpeedRun: Math.max(next.bestSpeedRun, solved) };
      }
      if (state.mode === 'daily') {
        next = updateDailyStreak(next, state.dailyKey);
        // Streak achievements are only reachable once the streak is updated.
        const extra = evaluateAchievements(next, {
          mode: 'daily', level: state.level, totalChanges: 0, foundTypes: [], missedTypes: [],
          wrongClicks: 0, perfect: false, score: 0, findMs: 0, viewMs: 0, nothingChanged: false,
        });
        if (extra.length > 0) {
          next = { ...next, achievements: [...new Set([...next.achievements, ...extra])] };
          queueMicrotask(() => {
            for (const id of extra) {
              const achievement = achievementById(id);
              if (achievement) {
                pushToast({ tone: 'achievement', title: `Unlocked: ${achievement.name}`, body: achievement.description });
              }
            }
          });
        }
      }
      return next;
    });

    if (state.mode === 'daily') {
      const elapsed = formatDuration(Math.max(0, state.runEndedAt - state.runStartedAt));
      setDaily((prev) => recordDaily(prev, {
        key: state.dailyKey,
        solved,
        total: state.results.length,
        perfect: state.results.filter((r) => r.perfect).length,
        share: buildShareText(state.dailyKey, state.results, elapsed),
        score: state.score,
      }));
    }

    if (settings.sound) playSound('gameOver');
  }, [
    state.phase, state.mode, state.runStartedAt, state.runEndedAt, state.results, state.score,
    state.dailyKey, state.level, setStats, setDaily, settings.sound, pushToast,
  ]);

  const todayRecord = useMemo(() => dailyCompleted(daily, todayKey), [daily, todayKey]);

  const startGame = useCallback((mode: GameMode) => {
    if (mode === 'daily' && dailyCompleted(daily, todayKey)) return;
    if (settings.sound) playSound('click');
    actions.start({
      mode,
      colorblindSafe: settings.colorblindSafe,
      zenViewMs: settings.zenViewMs,
      dailyKey: todayKey,
    });
    setScreen('game');
  }, [actions, daily, settings.colorblindSafe, settings.sound, settings.zenViewMs, todayKey]);

  const closeHowTo = useCallback(() => {
    setShowHowTo(false);
    setSettings((prev) => ({ ...prev, seenIntro: true }));
  }, [setSettings]);

  const updateSettings = useCallback((patch: Partial<SettingsShape>) => {
    setSettings((prev) => ({ ...prev, ...patch }));
  }, [setSettings]);

  const resetProgress = useCallback(() => {
    removeStored(STORAGE_KEYS.stats);
    removeStored(STORAGE_KEYS.daily);
    setStats(DEFAULT_STATS);
    setDaily(DEFAULT_DAILY);
    pushToast({ tone: 'info', title: 'Progress reset', body: 'Stats, achievements and daily history cleared.' });
  }, [setStats, setDaily, pushToast]);

  return (
    <div className="min-h-full">
      <Toasts toasts={toasts} onDismiss={dismissToast} />
      {showHowTo && <HowToPlay onClose={closeHowTo} />}

      {screen === 'menu' && (
        <Menu
          onPlay={startGame}
          onOpenStats={() => setScreen('stats')}
          onOpenSettings={() => setScreen('settings')}
          onOpenHowTo={() => setShowHowTo(true)}
          stats={stats}
          todayKey={todayKey}
          todayRecord={todayRecord}
        />
      )}

      {screen === 'stats' && (
        <Stats stats={stats} todayKey={todayKey} onBack={() => setScreen('menu')} onReset={resetProgress} />
      )}

      {screen === 'settings' && (
        <Settings settings={settings} onChange={updateSettings} onBack={() => setScreen('menu')} />
      )}

      {screen === 'game' && state.phase === 'runOver' && (
        <RunOver
          state={state}
          onPlayAgain={() => startGame(state.mode)}
          onMenu={() => setScreen('menu')}
        />
      )}

      {screen === 'game' && state.phase !== 'runOver' && (
        <GameScreen
          state={state}
          onAdvancePhase={actions.advancePhase}
          onPick={actions.pick}
          onCallNothing={actions.callNothing}
          onEndFind={actions.endFind}
          onNextRound={actions.nextRound}
          onEndRun={actions.endRun}
          onQuit={() => setScreen('menu')}
          soundOn={settings.sound}
        />
      )}
    </div>
  );
}
