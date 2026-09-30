import { Icon } from './Icon';
import type { IconName } from './Icon';
import type { Settings as SettingsShape, ThemePreference, MotionPreference } from '../game/storage';

type Props = {
  settings: SettingsShape;
  onChange: (next: Partial<SettingsShape>) => void;
  onBack: () => void;
};

/** Accessible segmented control. Rendered as radios so arrow keys work natively. */
function Segmented<T extends string>({
  legend, hint, value, options, onChange, name,
}: {
  legend: string;
  hint?: string;
  value: T;
  options: { value: T; label: string; icon?: IconName }[];
  onChange: (value: T) => void;
  name: string;
}) {
  return (
    <fieldset className="border-0 p-0">
      <legend className="mb-1 text-sm font-semibold text-ink">{legend}</legend>
      {hint && <p className="mb-2 text-xs text-muted">{hint}</p>}
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const active = option.value === value;
          return (
            <label
              key={option.value}
              className="flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border px-3.5 py-2 text-sm font-semibold transition-colors duration-200 has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[var(--c-accent)]"
              style={{
                borderColor: active ? 'var(--c-accent)' : 'var(--c-border)',
                background: active ? 'color-mix(in oklab, var(--c-accent) 16%, transparent)' : 'var(--c-surface-2)',
                color: active ? 'var(--c-accent)' : 'var(--c-text-muted)',
              }}
            >
              <input
                type="radio"
                name={name}
                value={option.value}
                checked={active}
                onChange={() => onChange(option.value)}
                className="sr-only"
              />
              {option.icon && <Icon name={option.icon} size={16} />}
              {option.label}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

function Toggle({ label, hint, checked, onChange }: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex min-h-11 cursor-pointer items-start justify-between gap-4 py-1">
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-ink">{label}</span>
        <span className="block text-xs text-muted">{hint}</span>
      </span>
      <span className="relative mt-0.5 shrink-0">
        <input
          type="checkbox"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
          className="peer sr-only"
        />
        <span
          className="block h-7 w-12 rounded-full transition-colors duration-200 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--c-accent)]"
          style={{ background: checked ? 'var(--c-accent)' : 'var(--c-border-strong)' }}
        />
        <span
          className="pointer-events-none absolute top-1 left-1 h-5 w-5 rounded-full bg-white shadow transition-transform duration-200"
          style={{ transform: checked ? 'translateX(20px)' : 'none' }}
        />
      </span>
    </label>
  );
}

const VIEW_TIMES = [4000, 6000, 8000, 10_000, 15_000, 20_000];

export function Settings({ settings, onChange, onBack }: Props) {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-14 pt-6 sm:px-6">
      <div className="mb-4 flex items-center gap-3">
        <button type="button" className="btn btn-ghost !min-h-10 !px-3" onClick={onBack}>
          <Icon name="back" size={17} />
          Menu
        </button>
        <h2 className="font-display text-xl font-bold">Settings</h2>
      </div>

      <div className="anim-fade-up card space-y-5 p-4 sm:p-5">
        <Segmented<ThemePreference>
          name="theme"
          legend="Appearance"
          hint="Follows your system setting unless you pick one."
          value={settings.theme}
          onChange={(theme) => onChange({ theme })}
          options={[
            { value: 'system', label: 'System' },
            { value: 'dark', label: 'Dark', icon: 'moon' },
            { value: 'light', label: 'Light', icon: 'sun' },
          ]}
        />

        <hr className="border-line" />

        <Segmented<MotionPreference>
          name="motion"
          legend="Motion"
          hint="Reduced motion removes the ring, shake and transition animations."
          value={settings.motion}
          onChange={(motion) => onChange({ motion })}
          options={[
            { value: 'system', label: 'System' },
            { value: 'full', label: 'Full' },
            { value: 'reduced', label: 'Reduced' },
          ]}
        />

        <hr className="border-line" />

        <Toggle
          label="Sound"
          hint="Short beeps and chimes, generated in the browser. No audio files are downloaded."
          checked={settings.sound}
          onChange={(sound) => onChange({ sound })}
        />

        <Toggle
          label="Colourblind-safe palette"
          hint="Uses a palette that stays distinguishable with red–green colour vision deficiency."
          checked={settings.colorblindSafe}
          onChange={(colorblindSafe) => onChange({ colorblindSafe })}
        />

        <hr className="border-line" />

        <fieldset className="border-0 p-0">
          <legend className="mb-1 text-sm font-semibold text-ink">Zen viewing time</legend>
          <p className="mb-2 text-xs text-muted">
            How long the scene is shown in Zen mode. Other modes use the difficulty curve.
          </p>
          <div className="flex flex-wrap gap-2">
            {VIEW_TIMES.map((ms) => {
              const active = settings.zenViewMs === ms;
              return (
                <label
                  key={ms}
                  className="flex min-h-11 min-w-14 cursor-pointer items-center justify-center rounded-xl border px-3 text-sm font-semibold transition-colors duration-200 has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[var(--c-accent)]"
                  style={{
                    borderColor: active ? 'var(--c-accent)' : 'var(--c-border)',
                    background: active ? 'color-mix(in oklab, var(--c-accent) 16%, transparent)' : 'var(--c-surface-2)',
                    color: active ? 'var(--c-accent)' : 'var(--c-text-muted)',
                  }}
                >
                  <input
                    type="radio"
                    name="zen-time"
                    checked={active}
                    onChange={() => onChange({ zenViewMs: ms })}
                    className="sr-only"
                  />
                  {ms / 1000}s
                </label>
              );
            })}
          </div>
        </fieldset>
      </div>

      <p className="mt-4 text-center text-xs text-faint">
        Settings and progress are stored in this browser only, and never leave your device.
      </p>
    </div>
  );
}
