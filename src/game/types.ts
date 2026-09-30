/** Core data model shared by the scene generator, mutation engine and renderer. */

export const VIEW_W = 800;
export const VIEW_H = 600;

export type ObjectKind =
  // park / nature
  | 'tree' | 'bush' | 'flower' | 'cloud' | 'sun' | 'star' | 'bird' | 'butterfly'
  | 'kite' | 'balloon' | 'bench' | 'cat' | 'dog' | 'lamp'
  // city street
  | 'house' | 'car' | 'bicycle' | 'sign' | 'trafficLight' | 'mailbox' | 'hydrant'
  | 'clock' | 'umbrella'
  // kitchen
  | 'mug' | 'plate' | 'cupcake' | 'bottle' | 'pot' | 'kettle' | 'apple' | 'book'
  // underwater
  | 'fish' | 'crab' | 'jellyfish' | 'seaweed' | 'shell' | 'starfish' | 'bubble' | 'anchor';

export type ThemeId = 'park' | 'kitchen' | 'street' | 'reef';

export type SceneObject = {
  id: string;
  kind: ObjectKind;
  /** Centre position inside the 800x600 viewBox. */
  x: number;
  y: number;
  scale: number;
  /** Degrees. */
  rotation: number;
  /** Hex colour from the active palette. */
  color: string;
  /** Shape variant index (e.g. tree style 0/1/2). */
  variant?: number;
  /** Label for signs / clock faces. */
  text?: string;
  flipped?: boolean;
};

export type BackgroundSpec = {
  /** Vertical gradient stops for the sky/wall. */
  skyTop: string;
  skyBottom: string;
  /** Ground / counter / seabed band. */
  groundColor: string;
  /** Where the ground band starts, as a fraction of VIEW_H. */
  horizon: number;
  /** Optional decorative accent colour (stripes, tiles, light shafts). */
  accent: string;
  /** Which decorative treatment to draw on the ground band. */
  pattern: 'grass' | 'tiles' | 'road' | 'sand';
};

export type Scene = {
  id: string;
  theme: ThemeId;
  background: BackgroundSpec;
  objects: SceneObject[];
};

/** Circular hitbox in viewBox coordinates. */
export type Hitbox = { x: number; y: number; r: number };

export type ChangeType =
  | 'remove' | 'add' | 'recolor' | 'move' | 'resize' | 'rotate' | 'flip' | 'swap' | 'text';

export type Change = {
  id: string;
  type: ChangeType;
  objectId: string;
  hitbox: Hitbox;
  description: string;
};

/** A generated round: the scene shown, the scene to search, and the diffs. */
export type Round = {
  seed: number;
  level: number;
  original: Scene;
  mutated: Scene;
  changes: Change[];
  /** True when the thief took the night off — the player must say "nothing changed". */
  nothingChanged: boolean;
  viewMs: number;
  findMs: number;
};

export type GameMode = 'classic' | 'daily' | 'zen' | 'speedrun';
