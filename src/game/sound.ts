/**
 * Tiny Web Audio synth — no audio files, no network.
 *
 * The AudioContext is created lazily on the first sound because browsers block
 * audio until a user gesture; every call is wrapped so an unavailable or
 * suspended context can never throw into the render path.
 */

type Cue = 'hit' | 'miss' | 'reveal' | 'levelUp' | 'gameOver' | 'tick' | 'achievement' | 'click';

let ctx: AudioContext | null = null;
let enabled = true;

export function setSoundEnabled(on: boolean): void {
  enabled = on;
}

function context(): AudioContext | null {
  if (!enabled) return null;
  try {
    if (!ctx) {
      const Ctor = window.AudioContext
        ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      ctx = new Ctor();
    }
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

type ToneOptions = {
  freq: number;
  duration: number;
  type?: OscillatorType;
  gain?: number;
  /** Glide to this frequency over the tone's life. */
  sweepTo?: number;
  delay?: number;
};

function tone(audio: AudioContext, opts: ToneOptions): void {
  const { freq, duration, type = 'sine', gain = 0.12, sweepTo, delay = 0 } = opts;
  const start = audio.currentTime + delay;
  const osc = audio.createOscillator();
  const amp = audio.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  if (sweepTo !== undefined) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, sweepTo), start + duration);
  }

  // Short attack, exponential release — reads as a "chime" rather than a click.
  amp.gain.setValueAtTime(0.0001, start);
  amp.gain.exponentialRampToValueAtTime(gain, start + 0.012);
  amp.gain.exponentialRampToValueAtTime(0.0001, start + duration);

  osc.connect(amp).connect(audio.destination);
  osc.start(start);
  osc.stop(start + duration + 0.05);
}

export function playSound(cue: Cue): void {
  const audio = context();
  if (!audio) return;
  try {
    switch (cue) {
      case 'hit':
        tone(audio, { freq: 660, duration: 0.12, type: 'triangle', gain: 0.13 });
        tone(audio, { freq: 990, duration: 0.16, type: 'triangle', gain: 0.1, delay: 0.06 });
        break;
      case 'miss':
        tone(audio, { freq: 200, duration: 0.18, type: 'sawtooth', gain: 0.07, sweepTo: 110 });
        break;
      case 'click':
        tone(audio, { freq: 520, duration: 0.05, type: 'square', gain: 0.04 });
        break;
      case 'tick':
        tone(audio, { freq: 880, duration: 0.05, type: 'sine', gain: 0.05 });
        break;
      case 'reveal':
        [523, 659, 784].forEach((f, i) => {
          tone(audio, { freq: f, duration: 0.22, type: 'sine', gain: 0.1, delay: i * 0.075 });
        });
        break;
      case 'levelUp':
        [523, 659, 784, 1046].forEach((f, i) => {
          tone(audio, { freq: f, duration: 0.26, type: 'triangle', gain: 0.11, delay: i * 0.08 });
        });
        break;
      case 'achievement':
        [784, 988, 1318].forEach((f, i) => {
          tone(audio, { freq: f, duration: 0.3, type: 'sine', gain: 0.1, delay: i * 0.1 });
        });
        break;
      case 'gameOver':
        [392, 330, 262].forEach((f, i) => {
          tone(audio, { freq: f, duration: 0.34, type: 'triangle', gain: 0.1, delay: i * 0.13 });
        });
        break;
    }
  } catch {
    /* audio is a nicety — never let it break the game */
  }
}
