/**
 * The thief.
 *
 * `applyMutations` takes an original scene and returns a mutated copy plus the
 * list of changes. Two invariants the rest of the game relies on:
 *   1. No two change hitboxes overlap (otherwise one click could score twice).
 *   2. Every change is actually visible — mutations that would be a no-op are
 *      rejected and another target is tried.
 */
import { Rng, clamp } from './rng';
import type {
  Scene, SceneObject, Change, ChangeType, Hitbox, ObjectKind,
} from './types';
import { objectDef, objectRadius, themeById } from './objects';
import { paletteFor, colorName, colorDistance, isRedGreenOnlySwap, luminance } from './palette';
import { findEmptySpot, makeAddition, clampToFrame, sortByDepth } from './sceneGenerator';
import type { DifficultySpec } from './difficulty';

export type MutationResult = {
  mutated: Scene;
  changes: Change[];
};

/** Hitboxes get a floor so even a tiny object stays tappable. */
function hitboxFor(obj: SceneObject): Hitbox {
  return { x: obj.x, y: obj.y, r: Math.max(26, objectRadius(obj.kind, obj.scale) * 0.95) };
}

function overlapsAny(box: Hitbox, taken: Hitbox[]): boolean {
  return taken.some((t) => {
    const minDist = (t.r + box.r) * 0.9;
    return (t.x - box.x) ** 2 + (t.y - box.y) ** 2 < minDist * minDist;
  });
}

const article = (word: string) => (/^[aeiou]/i.test(word) ? 'an' : 'a');

function describe(obj: SceneObject): string {
  return `the ${colorName(obj.color)} ${objectDef(obj.kind).label}`;
}

/**
 * Pick a replacement colour that is obviously different: far in RGB space,
 * different enough in lightness, and never a red<->green-only swap (which is
 * invisible under the most common colour-vision deficiencies).
 */
function pickContrastingColor(rng: Rng, current: string, colorblindSafe: boolean, subtlety: number): string | null {
  const palette = paletteFor(colorblindSafe);
  // Subtler levels allow a closer colour, but never closer than clearly visible.
  const minDistance = 150 - subtlety * 55;
  const candidates = palette
    .map((c) => c.hex)
    .filter((hex) => hex.toLowerCase() !== current.toLowerCase())
    .filter((hex) => colorDistance(hex, current) >= minDistance)
    .filter((hex) => !isRedGreenOnlySwap(current, hex))
    .filter((hex) => Math.abs(luminance(hex) - luminance(current)) > 0.04);
  if (candidates.length === 0) return null;
  return rng.pick(candidates);
}

type Attempt = {
  /** The mutated object, or null when the object is removed. */
  next: SceneObject | null;
  hitbox: Hitbox;
  description: string;
  /** Extra object to append to the scene (only used by 'add'). */
  extra?: SceneObject;
};

/** Try to build one change of `type` against `obj`. Returns null if not possible. */
function tryMutate(
  type: ChangeType,
  obj: SceneObject,
  scene: Scene,
  rng: Rng,
  spec: DifficultySpec,
  colorblindSafe: boolean,
  taken: Hitbox[],
  index: number,
): Attempt | null {
  const def = objectDef(obj.kind);
  // Subtlety 0 => maximum delta, 1 => minimum still-fair delta.
  const lerp = (big: number, small: number) => big + (small - big) * spec.subtlety;

  switch (type) {
    case 'remove':
      return {
        next: null,
        hitbox: hitboxFor(obj),
        description: `${capitalise(describe(obj))} was removed`,
      };

    case 'add': {
      const extra = makeAddition(rng, scene, colorblindSafe, index);
      const spot = findEmptySpot(rng, scene, extra.kind, extra.scale, taken);
      if (!spot) return null;
      extra.x = spot.x;
      extra.y = spot.y;
      return {
        next: obj,
        hitbox: hitboxFor(extra),
        description: `${capitalise(article(colorName(extra.color)))} ${colorName(extra.color)} ${objectDef(extra.kind).label} appeared`,
        extra,
      };
    }

    case 'recolor': {
      const color = pickContrastingColor(rng, obj.color, colorblindSafe, spec.subtlety);
      if (!color) return null;
      const next = { ...obj, color };
      return {
        next,
        hitbox: hitboxFor(next),
        description: `The ${def.label} changed from ${colorName(obj.color)} to ${colorName(color)}`,
      };
    }

    case 'move': {
      const radius = objectRadius(obj.kind, obj.scale);
      // Far enough that the old and new hitboxes barely touch, so it reads as a move.
      const distance = lerp(radius * 2.0, radius * 1.15);
      const angle = rng.float(0, Math.PI * 2);
      const raw = clampToFrame(obj.x + Math.cos(angle) * distance, obj.y + Math.sin(angle) * distance, radius);
      const moved = Math.hypot(raw.x - obj.x, raw.y - obj.y);
      if (moved < radius * 0.9) return null; // Clamped back into itself — not a visible move.
      const next = { ...obj, x: raw.x, y: raw.y };
      const dir = describeDirection(raw.x - obj.x, raw.y - obj.y);
      return {
        next,
        hitbox: { ...hitboxFor(next), r: Math.max(30, radius * 1.05) },
        description: `${capitalise(describe(obj))} moved ${dir}`,
      };
    }

    case 'resize': {
      // At least 30% bigger or smaller, per the design brief.
      const factor = rng.chance(0.5) ? lerp(1.85, 1.32) : 1 / lerp(1.85, 1.32);
      const scale = clamp(Number((obj.scale * factor).toFixed(3)), 0.42, 1.9);
      if (Math.abs(scale / obj.scale - 1) < 0.28) return null;
      const next = { ...obj, scale };
      return {
        next,
        hitbox: { ...hitboxFor(next), r: Math.max(hitboxFor(obj).r, hitboxFor(next).r) },
        description: `${capitalise(describe(obj))} got ${scale > obj.scale ? 'bigger' : 'smaller'}`,
      };
    }

    case 'rotate': {
      if ((def.maxRotation ?? 14) === 0) return null;
      const delta = lerp(62, 28) * (rng.chance(0.5) ? 1 : -1);
      const next = { ...obj, rotation: Number((obj.rotation + delta).toFixed(1)) };
      return {
        next,
        hitbox: hitboxFor(next),
        description: `${capitalise(describe(obj))} tilted ${delta > 0 ? 'clockwise' : 'anticlockwise'}`,
      };
    }

    case 'flip': {
      // Only worth doing on objects that are visibly asymmetric.
      if (!ASYMMETRIC.has(obj.kind)) return null;
      const next = { ...obj, flipped: !obj.flipped };
      return {
        next,
        hitbox: hitboxFor(next),
        description: `${capitalise(describe(obj))} is facing the other way`,
      };
    }

    case 'swap': {
      const theme = themeById(scene.theme);
      const options = theme.kinds.filter((k) => k !== obj.kind);
      if (options.length === 0) return null;
      const kind = rng.pick(options) as ObjectKind;
      const nextDef = objectDef(kind);
      const next: SceneObject = {
        ...obj,
        kind,
        rotation: (nextDef.maxRotation ?? 14) === 0 ? 0 : obj.rotation,
        variant: nextDef.variants > 1 ? rng.int(0, nextDef.variants - 1) : 0,
        text: nextDef.texts ? rng.pick(nextDef.texts) : undefined,
      };
      return {
        next,
        hitbox: { ...hitboxFor(next), r: Math.max(hitboxFor(obj).r, hitboxFor(next).r) },
        description: `The ${def.label} became ${article(nextDef.label)} ${nextDef.label}`,
      };
    }

    case 'text': {
      if (!def.texts || !obj.text) return null;
      const options = def.texts.filter((t) => t !== obj.text);
      if (options.length === 0) return null;
      const text = rng.pick(options);
      const next = { ...obj, text };
      return {
        next,
        hitbox: hitboxFor(next),
        description: `The ${def.label} reads "${text}" instead of "${obj.text}"`,
      };
    }

    default:
      return null;
  }
}

/** Kinds where a horizontal mirror is genuinely noticeable. */
const ASYMMETRIC = new Set<ObjectKind>([
  'cat', 'dog', 'bird', 'fish', 'lamp', 'kettle', 'mug', 'mailbox', 'car', 'bicycle', 'apple', 'book',
]);

function describeDirection(dx: number, dy: number): string {
  const horizontal = Math.abs(dx) > Math.abs(dy) * 1.4;
  const vertical = Math.abs(dy) > Math.abs(dx) * 1.4;
  if (horizontal) return dx > 0 ? 'to the right' : 'to the left';
  if (vertical) return dy > 0 ? 'down' : 'up';
  return `${dy > 0 ? 'down' : 'up'} and ${dx > 0 ? 'right' : 'left'}`;
}

function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function applyMutations(
  scene: Scene,
  spec: DifficultySpec,
  seed: number,
  colorblindSafe = false,
): MutationResult {
  const rng = new Rng(seed ^ 0x5bf03635);
  const changes: Change[] = [];
  const taken: Hitbox[] = [];
  // Work on a keyed copy so each mutation can replace an object by id.
  const byId = new Map(scene.objects.map((o) => [o.id, { ...o }]));
  const additions: SceneObject[] = [];

  // Candidate targets, shuffled once. Objects near the frame edge are still fair
  // game; the clamping inside `move` handles them.
  const candidates = rng.shuffle(scene.objects);
  let candidateIndex = 0;
  const usedIds = new Set<string>();

  let guard = 0;
  while (changes.length < spec.changeCount && guard < 200) {
    guard += 1;

    const type = rng.pick(spec.allowedTypes) as ChangeType;

    // 'add' does not consume a target object; everything else does.
    let target: SceneObject | undefined;
    if (type !== 'add') {
      // Walk the candidate list for an unused object.
      let found: SceneObject | undefined;
      for (let i = 0; i < candidates.length; i++) {
        const c = candidates[(candidateIndex + i) % candidates.length];
        if (!usedIds.has(c.id)) {
          found = byId.get(c.id);
          candidateIndex = (candidateIndex + i + 1) % candidates.length;
          break;
        }
      }
      if (!found) break; // Every object already carries a change.
      target = found;
    } else {
      target = byId.values().next().value;
      if (!target) break;
    }

    const attempt = tryMutate(
      type,
      target,
      { ...scene, objects: [...byId.values(), ...additions] },
      rng,
      spec,
      colorblindSafe,
      taken,
      changes.length,
    );
    if (!attempt) continue;

    // Invariant 1: change hitboxes must never overlap.
    if (overlapsAny(attempt.hitbox, taken)) continue;
    // A moved/removed object must also not sit on top of another change's box.
    if (type !== 'add' && overlapsAny(hitboxFor(target), taken)) continue;

    if (attempt.extra) {
      additions.push(attempt.extra);
    } else if (attempt.next === null) {
      byId.delete(target.id);
      usedIds.add(target.id);
    } else {
      byId.set(target.id, attempt.next);
      usedIds.add(target.id);
    }

    taken.push(attempt.hitbox);
    changes.push({
      id: `c${changes.length}_${type}`,
      type,
      objectId: attempt.extra ? attempt.extra.id : target.id,
      hitbox: attempt.hitbox,
      description: attempt.description,
    });
  }

  const mutated: Scene = {
    ...scene,
    id: `${scene.id}m`,
    objects: sortByDepth([...byId.values(), ...additions]),
  };
  return { mutated, changes };
}

/** Distance from a point to a change's hitbox centre, in viewBox units. */
export function distanceToHitbox(x: number, y: number, box: Hitbox): number {
  return Math.hypot(x - box.x, y - box.y);
}

export type PickResult =
  /** Landed on an unfound change. */
  | { kind: 'hit'; change: Change }
  /** Landed on a change the player already found - no reward, no penalty. */
  | { kind: 'repeat' }
  /** Landed on unchanged scenery. */
  | { kind: 'miss' };

/**
 * Hit detection with generous padding. Touch input gets a bigger pad because a
 * fingertip is far less precise than a cursor. Re-clicking a change that is
 * already found is deliberately neutral: the player has done nothing wrong, so
 * penalising it would be unfair (and it happens a lot on touch).
 */
export function resolvePick(
  x: number,
  y: number,
  changes: Change[],
  foundIds: Set<string>,
  touch: boolean,
): PickResult {
  const pad = touch ? 22 : 10;
  let best: Change | null = null;
  let bestDistance = Infinity;
  let repeat = false;

  for (const change of changes) {
    const distance = distanceToHitbox(x, y, change.hitbox);
    if (distance > change.hitbox.r + pad) continue;
    if (foundIds.has(change.id)) {
      repeat = true;
      continue;
    }
    if (distance < bestDistance) {
      best = change;
      bestDistance = distance;
    }
  }

  if (best) return { kind: 'hit', change: best };
  return repeat ? { kind: 'repeat' } : { kind: 'miss' };
}

/** Convenience wrapper kept for tests and simple call sites. */
export function findHit(
  x: number,
  y: number,
  changes: Change[],
  foundIds: Set<string>,
  touch: boolean,
): Change | null {
  const result = resolvePick(x, y, changes, foundIds, touch);
  return result.kind === 'hit' ? result.change : null;
}
