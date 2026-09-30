/** Seeded, deterministic pseudo-randomness. Same seed => same scene, always. */

/** mulberry32: small, fast, good-enough 32-bit PRNG. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** FNV-1a style string hash -> unsigned 32-bit int. Used for date seeds. */
export function hashString(input: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

export class Rng {
  private readonly gen: () => number;
  readonly seed: number;

  constructor(seed: number) {
    this.seed = seed;
    // Guard against seed 0, which makes the first few outputs poorly distributed.
    this.gen = mulberry32(seed === 0 ? 0x9e3779b9 : seed);
  }

  /** Float in [0, 1). */
  next(): number {
    return this.gen();
  }

  /** Float in [min, max). */
  float(min: number, max: number): number {
    return min + this.gen() * (max - min);
  }

  /** Integer in [min, max] inclusive. */
  int(min: number, max: number): number {
    if (max < min) return min;
    return Math.floor(min + this.gen() * (max - min + 1));
  }

  /** True with probability p. */
  chance(p: number): boolean {
    return this.gen() < p;
  }

  pick<T>(items: readonly T[]): T {
    return items[Math.floor(this.gen() * items.length)];
  }

  /** Pick n distinct items (or fewer if the pool is smaller). */
  pickMany<T>(items: readonly T[], n: number): T[] {
    return this.shuffle(items).slice(0, Math.max(0, Math.min(n, items.length)));
  }

  /** Fisher-Yates on a copy; the input array is never mutated. */
  shuffle<T>(items: readonly T[]): T[] {
    const out = items.slice();
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(this.gen() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }
}

/** [0, 1, ... n-1] */
export function range(n: number): number[] {
  return Array.from({ length: Math.max(0, Math.floor(n)) }, (_, i) => i);
}

/** Clamp helper used throughout placement and mutation maths. */
export function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}
