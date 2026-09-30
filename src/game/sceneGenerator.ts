/**
 * Scene generation.
 *
 * Everything here is a pure function of (seed, difficulty, palette flag), so the
 * same inputs always rebuild the exact same scene — required for the Daily
 * Challenge and for "replay the original" on the reveal screen.
 */
import { Rng, clamp } from './rng';
import { VIEW_W, VIEW_H } from './types';
import type { Scene, SceneObject, ObjectKind, ThemeId } from './types';
import { THEMES, objectDef, objectRadius, themeById } from './objects';
import { paletteFor } from './palette';
import type { DifficultySpec } from './difficulty';

/** Keep objects fully inside the frame with a little breathing room. */
const MARGIN = 58;

export type GenerateOptions = {
  seed: number;
  difficulty: DifficultySpec;
  colorblindSafe?: boolean;
  /** Force a theme instead of letting the seed choose one. */
  theme?: ThemeId;
};

/**
 * Rejection sampling: try random spots, keep the first that clears every
 * already-placed object by a minimum gap. The gap shrinks over successive
 * attempts so a crowded scene still converges instead of dropping objects.
 */
function findSpot(
  rng: Rng,
  placed: SceneObject[],
  radius: number,
  band: { top: number; bottom: number },
): { x: number; y: number } | null {
  const ATTEMPTS = 140;
  for (let i = 0; i < ATTEMPTS; i++) {
    // Relax the required separation as we run out of patience.
    const relax = 1 - (i / ATTEMPTS) * 0.55;
    const x = rng.float(MARGIN, VIEW_W - MARGIN);
    const y = rng.float(band.top, band.bottom);
    let ok = true;
    for (const other of placed) {
      const otherR = objectRadius(other.kind, other.scale);
      const needed = (radius + otherR) * 0.78 * relax;
      const dx = other.x - x;
      const dy = other.y - y;
      if (dx * dx + dy * dy < needed * needed) {
        ok = false;
        break;
      }
    }
    if (ok) return { x, y };
  }
  return null;
}

/** Vertical band an object is allowed to occupy, based on theme role. */
export function bandFor(kind: ObjectKind, themeId: ThemeId): { top: number; bottom: number } {
  const theme = themeById(themeId);
  const horizonY = VIEW_H * theme.background.horizon;
  if (theme.skyKinds.includes(kind)) {
    // Sky/water-column dwellers float above the horizon.
    return { top: 70, bottom: Math.max(120, horizonY - 20) };
  }
  return { top: horizonY - 10, bottom: VIEW_H - MARGIN };
}

/** Deterministic-per-scene ids: seed + index keeps them stable across regeneration. */
function makeId(seed: number, index: number): string {
  return `o${seed.toString(36)}_${index}`;
}

/** Build one object, given a kind. Position is filled in by the caller. */
function makeObject(
  rng: Rng,
  id: string,
  kind: ObjectKind,
  colorblindSafe: boolean,
): SceneObject {
  const def = objectDef(kind);
  const palette = paletteFor(colorblindSafe);
  const maxRot = def.maxRotation ?? 14;
  return {
    id,
    kind,
    x: 0,
    y: 0,
    scale: Number(rng.float(0.78, 1.12).toFixed(3)),
    rotation: maxRot === 0 ? 0 : Number(rng.float(-maxRot, maxRot).toFixed(1)),
    color: rng.pick(palette).hex,
    variant: def.variants > 1 ? rng.int(0, def.variants - 1) : 0,
    text: def.texts ? rng.pick(def.texts) : undefined,
    flipped: rng.chance(0.3),
  };
}

/** Painter's algorithm: things lower on screen are nearer, so draw them last. */
export function sortByDepth(objects: SceneObject[]): SceneObject[] {
  return objects.slice().sort((a, b) => a.y - b.y);
}

export function generateScene(options: GenerateOptions): Scene {
  const { seed, difficulty, colorblindSafe = false } = options;
  const rng = new Rng(seed);
  const theme = options.theme ? themeById(options.theme) : rng.pick(THEMES);

  const objects: SceneObject[] = [];
  // Draw kinds with replacement but bias toward variety: shuffle the pool and
  // cycle through it, so duplicates only appear once every kind has been used.
  let pool = rng.shuffle(theme.kinds);
  let poolIndex = 0;

  for (let i = 0; i < difficulty.objectCount; i++) {
    if (poolIndex >= pool.length) {
      pool = rng.shuffle(theme.kinds);
      poolIndex = 0;
    }
    const kind = pool[poolIndex++];
    const obj = makeObject(rng, makeId(seed, i), kind, colorblindSafe);
    const spot = findSpot(rng, objects, objectRadius(kind, obj.scale), bandFor(kind, theme.id));
    if (!spot) continue; // Scene is full; better to place fewer than to overlap badly.
    obj.x = Number(spot.x.toFixed(2));
    obj.y = Number(spot.y.toFixed(2));
    objects.push(obj);
  }

  return {
    id: `s${seed.toString(36)}`,
    theme: theme.id,
    background: theme.background,
    objects: sortByDepth(objects),
  };
}

/**
 * Find a free spot for a brand-new object (used by the "add" mutation) that
 * avoids both the existing objects and any hitboxes already claimed by changes.
 */
export function findEmptySpot(
  rng: Rng,
  scene: Scene,
  kind: ObjectKind,
  scale: number,
  avoid: { x: number; y: number; r: number }[],
): { x: number; y: number } | null {
  const radius = objectRadius(kind, scale);
  const band = bandFor(kind, scene.theme);
  for (let i = 0; i < 200; i++) {
    const x = rng.float(MARGIN, VIEW_W - MARGIN);
    const y = rng.float(band.top, band.bottom);
    const clashes = scene.objects.some((o) => {
      const need = (radius + objectRadius(o.kind, o.scale)) * 0.85;
      return (o.x - x) ** 2 + (o.y - y) ** 2 < need * need;
    }) || avoid.some((a) => (a.x - x) ** 2 + (a.y - y) ** 2 < ((a.r + radius) * 1.05) ** 2);
    if (!clashes) return { x: Number(x.toFixed(2)), y: Number(y.toFixed(2)) };
  }
  return null;
}

/** Create a fresh object for the "add" mutation, matched to the scene's theme. */
export function makeAddition(
  rng: Rng,
  scene: Scene,
  colorblindSafe: boolean,
  index: number,
): SceneObject {
  const theme = themeById(scene.theme);
  const kind = rng.pick(theme.kinds);
  return makeObject(rng, `${scene.id}_add${index}`, kind, colorblindSafe);
}

/** Clamp a position so an object of this size stays inside the frame. */
export function clampToFrame(x: number, y: number, radius: number): { x: number; y: number } {
  return {
    x: clamp(x, radius * 0.6, VIEW_W - radius * 0.6),
    y: clamp(y, radius * 0.6 + 20, VIEW_H - radius * 0.6),
  };
}
