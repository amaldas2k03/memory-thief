import { useState } from 'react';
import { Icon } from './Icon';
import { Logo } from './Menu';
import type { GameState } from '../hooks/useGameReducer';
import { buildShareText, copyToClipboard, dailyNumber, DAILY_ROUNDS } from '../game/daily';
import { formatDuration } from '../game/scoring';

type Props = {
  state: GameState;
  onPlayAgain: () => void;
  onMenu: () => void;
};

const MODE_TITLE: Record<GameState['mode'], string> = {
  classic: 'Run over',
  daily: 'Daily Challenge complete',
  zen: 'Session ended',
  speedrun: "Time's up",
};

export function RunOver({ state, onPlayAgain, onMenu }: Props) {
  const [copied, setCopied] = useState<'idle' | 'ok' | 'fail'>('idle');

  const elapsed = formatDuration(Math.max(0, state.runEndedAt - state.runStartedAt));
  const solved = state.results.filter((r) => r.solved).length;
  const perfect = state.results.filter((r) => r.perfect).length;
  const share = buildShareText(state.dailyKey, state.results, elapsed);

  const handleCopy = async () => {
    const ok = await copyToClipboard(share);
    setCopied(ok ? 'ok' : 'fail');
    window.setTimeout(() => setCopied('idle'), 2600);
  };

  return (
    <div className="mx-auto w-full max-w-lg px-4 pb-14 pt-8 sm:px-6">
      <div className="anim-fade-up card p-5 text-center sm:p-6">
        <div className="mb-3 flex justify-center">
          <Logo size={60} />
        </div>
        <h2 className="font-display text-2xl font-bold">{MODE_TITLE[state.mode]}</h2>

        <p className="mt-1 text-sm text-muted">
          {state.mode === 'classic' && `You reached level ${state.level}.`}
          {state.mode === 'daily' && `Memory Thief #${dailyNumber(state.dailyKey)} · ${solved}/${DAILY_ROUNDS} solved`}
          {state.mode === 'speedrun' && `${solved} scene${solved === 1 ? '' : 's'} cleared in 2 minutes.`}
          {state.mode === 'zen' && `${state.results.length} scene${state.results.length === 1 ? '' : 's'} played.`}
        </p>

        <div className="my-5 grid grid-cols-3 gap-3">
          {[
            { label: 'Score', value: state.score.toLocaleString() },
            { label: 'Solved', value: `${solved}/${state.results.length}` },
            { label: 'Perfect', value: `${perfect}` },
          ].map((item) => (
            <div key={item.label} className="rounded-xl border border-line bg-surface-2 px-2 py-3">
              <p className="font-display text-xl font-bold tabular-nums text-ink">{item.value}</p>
              <p className="text-[0.68rem] uppercase tracking-[0.1em] text-faint">{item.label}</p>
            </div>
          ))}
        </div>

        {state.mode === 'daily' && (
          <div className="mb-4">
            <p className="rounded-xl border border-line bg-surface-2 px-3 py-3 font-display text-sm font-semibold tracking-wide text-ink break-words">
              {share}
            </p>
            <button type="button" className="btn btn-primary mt-3 w-full" onClick={handleCopy}>
              <Icon name={copied === 'ok' ? 'check' : 'copy'} size={17} />
              {copied === 'ok' ? 'Copied to clipboard' : copied === 'fail' ? 'Copy failed — select the text above' : 'Copy result'}
            </button>
          </div>
        )}

        <div className="flex flex-col gap-2 sm:flex-row">
          {state.mode !== 'daily' && (
            <button type="button" className="btn btn-primary flex-1" onClick={onPlayAgain} autoFocus>
              <Icon name="refresh" size={17} />
              Play again
            </button>
          )}
          <button
            type="button"
            className="btn flex-1"
            onClick={onMenu}
            autoFocus={state.mode === 'daily'}
          >
            <Icon name="back" size={17} />
            Back to menu
          </button>
        </div>
      </div>
    </div>
  );
}
