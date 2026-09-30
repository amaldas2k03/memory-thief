import { describe, it, expect } from 'vitest';
import { Rng, mulberry32, hashString, range, clamp } from './rng';
import { generateScene } from './sceneGenerator';
import { applyMutations, resolvePick, findHit } from './mutations';
import { buildRound } from './round';
import { difficultyForLevel, allowedTypesForLevel } from './difficulty';
import { dateKey, dailySeed, dailyRoundSeed, dailyNumber, buildShareText } from './daily';
import {
  scoreRound, levelMultiplier, roundAccuracy, formatDuration, formatPercent,
  POINTS_PER_FIND, WRONG_CLICK_PENALTY, PERFECT_ROUND_BONUS, TIME_BONUS_PER_SECOND,
} from './scoring';
import { isRedGreenOnlySwap, colorDistance, paletteFor } from './palette';
import { OBJECTS, ALL_KINDS, THEMES, objectRadius } from './objects';
import { VIEW_W, VIEW_H } from './types';

describe('rng', () => {
  it('mulberry32 is deterministic for a given seed', () => {
    const a = mulberry32(12345);
    const b = mulberry32(12345);
    const seqA = range(20).map(() => a());
    const seqB = range(20).map(() => b());
    expect(seqA).toEqual(seqB);
  });

  it('different seeds produce different sequences', () => {
    const a = range(20).map(mulberry32(1));
    const b = range(20).map(mulberry32(2));
    expect(a).not.toEqual(b);
  });

  it('stays inside [0, 1)', () => {
    const gen = mulberry32(99);
    for (let i = 0; i < 5000; i++) {
      const v = gen();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('Rng helpers are deterministic and in range', () => {
    const make = () => new Rng(777);
    const items = ['a', 'b', 'c', 'd', 'e'];
    const runA = { i: make().int(1, 6), p: make().pick(items), s: make().shuffle(items) };
    const runB = { i: make().int(1, 6), p: make().pick(items), s: make().shuffle(items) };
    expect(runA).toEqual(runB);

    const rng = new Rng(4);
    for (let i = 0; i < 500; i++) {
      const n = rng.int(3, 9);
      expect(n).toBeGreaterThanOrEqual(3);
      expect(n).toBeLessThanOrEqual(9);
      expect(Number.isInteger(n)).toBe(true);
    }
  });

  it('shuffle does not mutate its input and keeps every element', () => {
    const input = Object.freeze([1, 2, 3, 4, 5]);
    const out = new Rng(3).shuffle(input);
    expect(input).toEqual([1, 2, 3, 4, 5]);
    expect(out.slice().sort()).toEqual([1, 2, 3, 4, 5]);
  });

  it('hashString is stable and collision-free for nearby inputs', () => {
    expect(hashString('memory-thief')).toBe(hashString('memory-thief'));
    expect(hashString('2026-09-30')).not.toBe(hashString('2026-10-01'));
  });

  it('clamp bounds correctly', () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-5, 0, 10)).toBe(0);
    expect(clamp(50, 0, 10)).toBe(10);
  });
});

describe('object library', () => {
  it('provides at least 20 object kinds, all with shapes and a hitbox radius', () => {
    expect(ALL_KINDS.length).toBeGreaterThanOrEqual(20);
    for (const kind of ALL_KINDS) {
      const def = OBJECTS[kind];
      expect(def.radius).toBeGreaterThan(0);
      expect(def.variants).toBeGreaterThanOrEqual(1);
      for (let v = 0; v < def.variants; v++) {
        expect(def.shapes(v).length).toBeGreaterThan(0);
      }
    }
  });

  it('defines at least 4 themes, each using only known kinds', () => {
    expect(THEMES.length).toBeGreaterThanOrEqual(4);
    for (const theme of THEMES) {
      expect(theme.kinds.length).toBeGreaterThan(4);
      for (const kind of theme.kinds) expect(OBJECTS[kind]).toBeDefined();
      for (const kind of theme.skyKinds) expect(theme.kinds).toContain(kind);
    }
  });
});

describe('scene generation', () => {
  it('produces an identical scene for the same seed', () => {
    const spec = difficultyForLevel(7);
    const a = generateScene({ seed: 424242, difficulty: spec });
    const b = generateScene({ seed: 424242, difficulty: spec });
    expect(a).toEqual(b);
  });

  it('produces different scenes for different seeds', () => {
    const spec = difficultyForLevel(7);
    const a = generateScene({ seed: 1, difficulty: spec });
    const b = generateScene({ seed: 2, difficulty: spec });
    expect(JSON.stringify(a.objects)).not.toEqual(JSON.stringify(b.objects));
  });

  it('keeps every object inside the viewBox and on-theme', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const spec = difficultyForLevel(1 + (seed % 15));
      const scene = generateScene({ seed: seed * 7919, difficulty: spec });
      const theme = THEMES.find((t) => t.id === scene.theme)!;
      expect(scene.objects.length).toBeGreaterThan(3);
      for (const obj of scene.objects) {
        expect(theme.kinds).toContain(obj.kind);
        expect(obj.x).toBeGreaterThan(0);
        expect(obj.x).toBeLessThan(VIEW_W);
        expect(obj.y).toBeGreaterThan(0);
        expect(obj.y).toBeLessThan(VIEW_H);
      }
    }
  });

  it('avoids heavy overlap between placed objects', () => {
    let tooClose = 0;
    let pairs = 0;
    for (let seed = 1; seed <= 25; seed++) {
      const scene = generateScene({ seed: seed * 31, difficulty: difficultyForLevel(10) });
      for (let i = 0; i < scene.objects.length; i++) {
        for (let j = i + 1; j < scene.objects.length; j++) {
          const a = scene.objects[i];
          const b = scene.objects[j];
          pairs++;
          const centres = Math.hypot(a.x - b.x, a.y - b.y);
          const radii = objectRadius(a.kind, a.scale) + objectRadius(b.kind, b.scale);
          // Fully concentric objects would be unfair; nothing should get that close.
          if (centres < radii * 0.35) tooClose++;
        }
      }
    }
    expect(pairs).toBeGreaterThan(100);
    expect(tooClose).toBe(0);
  });

  it('sorts objects back-to-front for depth', () => {
    const scene = generateScene({ seed: 909, difficulty: difficultyForLevel(12) });
    const ys = scene.objects.map((o) => o.y);
    expect(ys).toEqual(ys.slice().sort((a, b) => a - b));
  });
});

describe('mutations', () => {
  it('never produces overlapping change hitboxes', () => {
    let totalChanges = 0;
    for (let seed = 1; seed <= 120; seed++) {
      const spec = difficultyForLevel(1 + (seed % 20));
      const scene = generateScene({ seed: seed * 104729, difficulty: spec });
      const { changes } = applyMutations(scene, spec, seed * 104729);
      totalChanges += changes.length;
      for (let i = 0; i < changes.length; i++) {
        for (let j = i + 1; j < changes.length; j++) {
          const a = changes[i].hitbox;
          const b = changes[j].hitbox;
          const distance = Math.hypot(a.x - b.x, a.y - b.y);
          expect(distance).toBeGreaterThanOrEqual((a.r + b.r) * 0.9);
        }
      }
    }
    expect(totalChanges).toBeGreaterThan(150);
  });

  it('is deterministic for the same seed', () => {
    const spec = difficultyForLevel(9);
    const scene = generateScene({ seed: 5150, difficulty: spec });
    const a = applyMutations(scene, spec, 5150);
    const b = applyMutations(scene, spec, 5150);
    expect(a.changes).toEqual(b.changes);
    expect(a.mutated).toEqual(b.mutated);
  });

  it('actually changes the scene for every reported change', () => {
    for (let seed = 1; seed <= 60; seed++) {
      const spec = difficultyForLevel(2 + (seed % 18));
      const scene = generateScene({ seed: seed * 7907, difficulty: spec });
      const { mutated, changes } = applyMutations(scene, spec, seed * 7907);
      if (changes.length === 0) continue;
      expect(JSON.stringify(mutated.objects)).not.toEqual(JSON.stringify(scene.objects));
      for (const change of changes) {
        expect(change.description.length).toBeGreaterThan(5);
        expect(change.hitbox.r).toBeGreaterThan(0);
        expect(spec.allowedTypes).toContain(change.type);
      }
    }
  });

  it('respects the difficulty tier gate on change types', () => {
    expect(allowedTypesForLevel(1)).toEqual(['remove', 'add']);
    expect(allowedTypesForLevel(4)).toContain('recolor');
    expect(allowedTypesForLevel(4)).not.toContain('text');
    expect(allowedTypesForLevel(12)).toContain('text');
  });

  it('keeps change hitboxes inside the frame', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const spec = difficultyForLevel(1 + (seed % 20));
      const scene = generateScene({ seed: seed * 6151, difficulty: spec });
      const { changes } = applyMutations(scene, spec, seed * 6151);
      for (const c of changes) {
        expect(c.hitbox.x).toBeGreaterThan(0);
        expect(c.hitbox.x).toBeLessThan(VIEW_W);
        expect(c.hitbox.y).toBeGreaterThan(0);
        expect(c.hitbox.y).toBeLessThan(VIEW_H);
      }
    }
  });
});

describe('hit detection', () => {
  const changes = [
    { id: 'a', type: 'remove' as const, objectId: 'o1', hitbox: { x: 200, y: 200, r: 30 }, description: 'a' },
    { id: 'b', type: 'add' as const, objectId: 'o2', hitbox: { x: 600, y: 400, r: 30 }, description: 'b' },
  ];

  it('registers a hit inside the padded hitbox', () => {
    expect(resolvePick(200, 200, changes, new Set(), false)).toEqual({ kind: 'hit', change: changes[0] });
    // 30 radius + 10 mouse padding = 40.
    expect(resolvePick(238, 200, changes, new Set(), false).kind).toBe('hit');
    expect(resolvePick(245, 200, changes, new Set(), false).kind).toBe('miss');
  });

  it('gives touch input a larger pad than the mouse', () => {
    expect(resolvePick(248, 200, changes, new Set(), false).kind).toBe('miss');
    expect(resolvePick(248, 200, changes, new Set(), true).kind).toBe('hit');
  });

  it('treats a re-click on an already-found change as neutral', () => {
    expect(resolvePick(200, 200, changes, new Set(['a']), false)).toEqual({ kind: 'repeat' });
  });

  it('picks the nearest change when hitboxes are padded into each other', () => {
    const close = [
      { ...changes[0], id: 'near', hitbox: { x: 100, y: 100, r: 40 } },
      { ...changes[1], id: 'far', hitbox: { x: 170, y: 100, r: 40 } },
    ];
    const result = resolvePick(115, 100, close, new Set(), true);
    expect(result.kind).toBe('hit');
    expect(result.kind === 'hit' && result.change.id).toBe('near');
  });

  it('findHit stays a thin wrapper over resolvePick', () => {
    expect(findHit(200, 200, changes, new Set(), false)?.id).toBe('a');
    expect(findHit(0, 0, changes, new Set(), false)).toBeNull();
    expect(findHit(200, 200, changes, new Set(['a']), false)).toBeNull();
  });

  it('finds every real change at its own hitbox centre', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const spec = difficultyForLevel(1 + (seed % 20));
      const scene = generateScene({ seed: seed * 5171, difficulty: spec });
      const { changes: real } = applyMutations(scene, spec, seed * 5171);
      const found = new Set<string>();
      for (const change of real) {
        const result = resolvePick(change.hitbox.x, change.hitbox.y, real, found, false);
        expect(result.kind).toBe('hit');
        expect(result.kind === 'hit' && result.change.id).toBe(change.id);
        found.add(change.id);
      }
    }
  });
});

describe('rounds', () => {
  it('always yields either changes or an explicit nothing-changed round', () => {
    for (let seed = 1; seed <= 100; seed++) {
      const round = buildRound({ seed: seed * 2749, difficulty: difficultyForLevel(1 + (seed % 20)) });
      if (round.nothingChanged) {
        expect(round.changes).toHaveLength(0);
      } else {
        expect(round.changes.length).toBeGreaterThan(0);
      }
      expect(round.viewMs).toBeGreaterThanOrEqual(3000);
    }
  });

  it('produces "nothing changed" rounds only at higher levels', () => {
    const lowLevel = range(80).map((i) => buildRound({ seed: i + 1, difficulty: difficultyForLevel(3) }));
    expect(lowLevel.every((r) => !r.nothingChanged || r.changes.length === 0)).toBe(true);

    const highLevel = range(200).map((i) => buildRound({ seed: i * 977 + 1, difficulty: difficultyForLevel(12) }));
    const blanks = highLevel.filter((r) => r.nothingChanged).length;
    // Target is roughly 1 in 12; allow a generous band for sampling noise.
    expect(blanks).toBeGreaterThan(4);
    expect(blanks).toBeLessThan(50);
  });
});

describe('difficulty curve', () => {
  it('tightens monotonically with level', () => {
    let prevView = Infinity;
    let prevObjects = 0;
    for (let level = 1; level <= 30; level++) {
      const spec = difficultyForLevel(level);
      expect(spec.viewMs).toBeLessThanOrEqual(prevView);
      expect(spec.objectCount).toBeGreaterThanOrEqual(prevObjects);
      expect(spec.viewMs).toBeGreaterThanOrEqual(4000);
      expect(spec.changeCount).toBeGreaterThanOrEqual(1);
      expect(spec.changeCount).toBeLessThanOrEqual(5);
      prevView = spec.viewMs;
      prevObjects = spec.objectCount;
    }
    expect(difficultyForLevel(1).viewMs).toBe(10_000);
    expect(difficultyForLevel(50).viewMs).toBe(4000);
  });
});

describe('daily challenge', () => {
  it('derives a stable seed for a given date', () => {
    expect(dailySeed('2026-09-30')).toBe(dailySeed('2026-09-30'));
    expect(dailySeed('2026-09-30')).not.toBe(dailySeed('2026-10-01'));
  });

  it('formats the UTC date key regardless of local timezone', () => {
    expect(dateKey(new Date(Date.UTC(2026, 8, 30, 23, 59)))).toBe('2026-09-30');
    expect(dateKey(new Date(Date.UTC(2026, 0, 5, 0, 0)))).toBe('2026-01-05');
  });

  it('gives each of the five rounds its own stable seed', () => {
    const seeds = range(5).map((i) => dailyRoundSeed('2026-09-30', i));
    expect(new Set(seeds).size).toBe(5);
    expect(seeds).toEqual(range(5).map((i) => dailyRoundSeed('2026-09-30', i)));
  });

  it('produces the identical round for everyone on a given day', () => {
    const a = buildRound({ seed: dailyRoundSeed('2026-09-30', 2), difficulty: difficultyForLevel(8) });
    const b = buildRound({ seed: dailyRoundSeed('2026-09-30', 2), difficulty: difficultyForLevel(8) });
    expect(a).toEqual(b);
  });

  it('numbers puzzles sequentially from the epoch', () => {
    expect(dailyNumber('2025-01-01')).toBe(1);
    expect(dailyNumber('2025-01-02')).toBe(2);
    expect(dailyNumber('2025-02-01')).toBe(32);
    expect(dailyNumber('2026-01-01')).toBe(366);
  });

  it('builds the share text in the documented shape', () => {
    const text = buildShareText('2025-05-22', [
      { perfect: true, solved: true },
      { perfect: true, solved: true },
      { perfect: false, solved: true },
      { perfect: true, solved: true },
      { perfect: false, solved: false },
    ], '1:42');
    expect(text).toBe('Memory Thief #142 🕵️ 4/5 🟩🟩🟧🟩⬛ ⏱️ 1:42');
  });
});

describe('scoring', () => {
  it('awards base points per find', () => {
    const s = scoreRound({ totalChanges: 3, foundChanges: 2, wrongClicks: 0, remainingMs: 0, level: 1 });
    expect(s.base).toBe(2 * POINTS_PER_FIND);
    expect(s.perfect).toBe(false);
    expect(s.total).toBe(200);
  });

  it('adds a time bonus and perfect bonus only when the round is cleared', () => {
    const cleared = scoreRound({ totalChanges: 2, foundChanges: 2, wrongClicks: 0, remainingMs: 12_400, level: 1 });
    expect(cleared.timeBonus).toBe(12 * TIME_BONUS_PER_SECOND);
    expect(cleared.perfectBonus).toBe(PERFECT_ROUND_BONUS);
    expect(cleared.perfect).toBe(true);
    expect(cleared.total).toBe(200 + 72 + 150);

    const partial = scoreRound({ totalChanges: 2, foundChanges: 1, wrongClicks: 0, remainingMs: 12_400, level: 1 });
    expect(partial.timeBonus).toBe(0);
    expect(partial.perfectBonus).toBe(0);
  });

  it('penalises wrong clicks and cancels the perfect bonus', () => {
    const s = scoreRound({ totalChanges: 2, foundChanges: 2, wrongClicks: 3, remainingMs: 0, level: 1 });
    expect(s.penalty).toBe(3 * WRONG_CLICK_PENALTY);
    expect(s.perfect).toBe(false);
    expect(s.total).toBe(200 - 75);
  });

  it('never returns a negative total', () => {
    const s = scoreRound({ totalChanges: 3, foundChanges: 0, wrongClicks: 20, remainingMs: 0, level: 4 });
    expect(s.total).toBe(0);
  });

  it('applies the level multiplier', () => {
    expect(levelMultiplier(1)).toBe(1);
    expect(levelMultiplier(11)).toBeCloseTo(1.5, 5);
    const lv1 = scoreRound({ totalChanges: 1, foundChanges: 1, wrongClicks: 0, remainingMs: 0, level: 1 });
    const lv11 = scoreRound({ totalChanges: 1, foundChanges: 1, wrongClicks: 0, remainingMs: 0, level: 11 });
    expect(lv11.total).toBe(Math.round(lv1.total * 1.5));
  });

  it('scores nothing-changed rounds on the call, not on clicks', () => {
    const correct = scoreRound({
      totalChanges: 0, foundChanges: 0, wrongClicks: 0, remainingMs: 5000, level: 1, calledNothingChanged: true,
    });
    expect(correct.perfect).toBe(true);
    expect(correct.total).toBeGreaterThan(0);

    const missed = scoreRound({
      totalChanges: 0, foundChanges: 0, wrongClicks: 2, remainingMs: 5000, level: 1, calledNothingChanged: false,
    });
    expect(missed.total).toBe(0);
    expect(missed.perfect).toBe(false);
  });

  it('computes round accuracy', () => {
    expect(roundAccuracy(3, 1)).toBe(0.75);
    expect(roundAccuracy(0, 0)).toBe(0);
    expect(roundAccuracy(4, 0)).toBe(1);
  });

  it('formats durations and percentages', () => {
    expect(formatDuration(102_000)).toBe('1:42');
    expect(formatDuration(0)).toBe('0:00');
    expect(formatDuration(59_400)).toBe('0:59');
    expect(formatPercent(0.8731)).toBe('87%');
    expect(formatPercent(Number.NaN)).toBe('0%');
  });
});

describe('palette fairness', () => {
  it('flags red<->green-only swaps', () => {
    expect(isRedGreenOnlySwap('#E03A3A', '#2FA45B')).toBe(true);
    expect(isRedGreenOnlySwap('#E03A3A', '#3B9AE1')).toBe(false);
  });

  it('keeps the colourblind-safe palette mutually distinguishable', () => {
    const palette = paletteFor(true);
    for (let i = 0; i < palette.length; i++) {
      for (let j = i + 1; j < palette.length; j++) {
        expect(colorDistance(palette[i].hex, palette[j].hex)).toBeGreaterThan(40);
      }
    }
  });
});
