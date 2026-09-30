/**
 * Object library.
 *
 * Shapes are stored as plain data (not JSX) so the same definitions can be used
 * by the renderer, by hit-detection and by unit tests. Every object is drawn in
 * a local space centred on (0,0); `radius` is the hitbox radius at scale 1.
 *
 * `Paint` tokens resolve against the object's own colour:
 *   'main' = the colour, 'd1'/'d2' = progressively darker, 'l1'/'l2' = lighter,
 *   anything else is a fixed colour string (wheels, glass, eyes...).
 */
import type { ObjectKind, ThemeId, BackgroundSpec } from './types';
import { shade, tint } from './palette';

export type Paint = 'main' | 'd1' | 'd2' | 'l1' | 'l2' | (string & {});

export type Shape =
  | { t: 'rect'; x: number; y: number; w: number; h: number; rx?: number; f: Paint; s?: Paint; sw?: number }
  | { t: 'circle'; cx: number; cy: number; r: number; f: Paint; s?: Paint; sw?: number }
  | { t: 'ellipse'; cx: number; cy: number; rx: number; ry: number; f: Paint; s?: Paint; sw?: number }
  | { t: 'path'; d: string; f: Paint; s?: Paint; sw?: number; cap?: 'round' | 'butt' }
  | { t: 'poly'; p: string; f: Paint; s?: Paint; sw?: number }
  | { t: 'line'; x1: number; y1: number; x2: number; y2: number; s: Paint; sw: number }
  /** Renders the object's `text` field (signs, clocks). */
  | { t: 'label'; x: number; y: number; size: number; f: Paint; weight?: number };

export type ObjectDef = {
  kind: ObjectKind;
  /** Noun used in change descriptions. */
  label: string;
  /** Hitbox radius in local units at scale 1. */
  radius: number;
  /** Number of shape variants available. */
  variants: number;
  shapes: (variant: number) => Shape[];
  /** Candidate strings for label-bearing objects. */
  texts?: readonly string[];
  /** Rotation looks wrong on some objects (houses, plates) — cap it. */
  maxRotation?: number;
};

/** Resolve a Paint token to a concrete colour. */
export function resolvePaint(paint: Paint, color: string): string {
  switch (paint) {
    case 'main': return color;
    case 'd1': return shade(color, 0.18);
    case 'd2': return shade(color, 0.36);
    case 'l1': return tint(color, 0.22);
    case 'l2': return tint(color, 0.45);
    default: return paint;
  }
}

const BARK = '#8A5A32';
const DARK = '#2B3446';
const GLASS = '#CFE8F7';
const WHITE = '#FFFFFF';

const STAR_POINTS =
  '0,-24 5.9,-8.1 22.8,-7.4 9.5,3.1 14.1,19.4 0,10 -14.1,19.4 -9.5,3.1 -22.8,-7.4 -5.9,-8.1';
const STARFISH_POINTS =
  '0,-26 7,-9.7 24.7,-8 11.4,3.7 15.3,21 0,12 -15.3,21 -11.4,3.7 -24.7,-8 -7,-9.7';

const DEFS: ObjectDef[] = [
  {
    kind: 'tree', label: 'tree', radius: 42, variants: 3, maxRotation: 8,
    shapes: (v) => {
      const trunk: Shape = { t: 'rect', x: -6, y: 8, w: 12, h: 36, rx: 4, f: BARK };
      if (v === 1) {
        return [
          trunk,
          { t: 'poly', p: '0,-44 24,-6 -24,-6', f: 'main' },
          { t: 'poly', p: '0,-26 28,14 -28,14', f: 'd1' },
        ];
      }
      if (v === 2) {
        return [
          trunk,
          { t: 'ellipse', cx: 0, cy: -10, rx: 24, ry: 32, f: 'main' },
          { t: 'ellipse', cx: -8, cy: -4, rx: 13, ry: 18, f: 'l1' },
        ];
      }
      return [
        trunk,
        { t: 'circle', cx: 0, cy: -14, r: 28, f: 'main' },
        { t: 'circle', cx: -17, cy: 2, r: 19, f: 'd1' },
        { t: 'circle', cx: 17, cy: 2, r: 19, f: 'l1' },
      ];
    },
  },
  {
    kind: 'bush', label: 'bush', radius: 26, variants: 2, maxRotation: 6,
    shapes: (v) => v === 1
      ? [
          { t: 'ellipse', cx: 0, cy: 4, rx: 26, ry: 18, f: 'main' },
          { t: 'ellipse', cx: -8, cy: -2, rx: 12, ry: 11, f: 'l1' },
        ]
      : [
          { t: 'circle', cx: -13, cy: 6, r: 14, f: 'd1' },
          { t: 'circle', cx: 13, cy: 6, r: 14, f: 'd1' },
          { t: 'circle', cx: 0, cy: -4, r: 18, f: 'main' },
        ],
  },
  {
    kind: 'flower', label: 'flower', radius: 22, variants: 2,
    shapes: (v) => {
      const stem: Shape[] = [
        { t: 'path', d: 'M0 22 Q 3 6 0 -2', f: 'none', s: '#3E8E4E', sw: 4, cap: 'round' },
        { t: 'path', d: 'M0 12 Q 10 8 13 15', f: '#3E8E4E' },
      ];
      if (v === 1) {
        return [
          ...stem,
          { t: 'path', d: 'M0 -20 C 14 -20 16 -2 0 -2 C -16 -2 -14 -20 0 -20 Z', f: 'main' },
          { t: 'ellipse', cx: 0, cy: -11, rx: 5, ry: 6, f: '#FFD45E' },
        ];
      }
      const petals: Shape[] = [0, 72, 144, 216, 288].map((a) => {
        const rad = ((a - 90) * Math.PI) / 180;
        return {
          t: 'circle' as const,
          cx: Math.round(Math.cos(rad) * 100) / 10,
          cy: Math.round(Math.sin(rad) * 100) / 10 - 8,
          r: 8,
          f: 'main' as Paint,
        };
      });
      return [...stem, ...petals, { t: 'circle', cx: 0, cy: -8, r: 6, f: '#FFD45E' }];
    },
  },
  {
    kind: 'cloud', label: 'cloud', radius: 40, variants: 2, maxRotation: 0,
    shapes: (v) => v === 1
      ? [
          { t: 'ellipse', cx: 0, cy: 0, rx: 38, ry: 16, f: 'main' },
          { t: 'circle', cx: -10, cy: -8, r: 16, f: 'main' },
          { t: 'circle', cx: 12, cy: -6, r: 13, f: 'main' },
        ]
      : [
          { t: 'circle', cx: -16, cy: 2, r: 15, f: 'main' },
          { t: 'circle', cx: 2, cy: -8, r: 20, f: 'main' },
          { t: 'circle', cx: 20, cy: 3, r: 14, f: 'main' },
          { t: 'rect', x: -18, y: 2, w: 40, h: 15, rx: 7, f: 'main' },
        ],
  },
  {
    kind: 'sun', label: 'sun', radius: 34, variants: 1, maxRotation: 24,
    shapes: () => {
      const rays: Shape[] = [0, 45, 90, 135, 180, 225, 270, 315].map((a) => {
        const rad = (a * Math.PI) / 180;
        const round = (n: number) => Math.round(n * 10) / 10;
        return {
          t: 'line' as const,
          x1: round(Math.cos(rad) * 22), y1: round(Math.sin(rad) * 22),
          x2: round(Math.cos(rad) * 33), y2: round(Math.sin(rad) * 33),
          s: 'd1' as Paint, sw: 5,
        };
      });
      return [...rays, { t: 'circle', cx: 0, cy: 0, r: 20, f: 'main' }];
    },
  },
  {
    kind: 'star', label: 'star', radius: 24, variants: 1,
    shapes: () => [
      { t: 'poly', p: STAR_POINTS, f: 'main' },
      { t: 'circle', cx: -4, cy: -6, r: 3, f: 'l2' },
    ],
  },
  {
    kind: 'bird', label: 'bird', radius: 22, variants: 2,
    shapes: (v) => v === 1
      ? [{ t: 'path', d: 'M-22 2 Q -10 -14 0 0 Q 10 -14 22 2 Q 10 -4 0 6 Q -10 -4 -22 2 Z', f: 'main' }]
      : [
          { t: 'ellipse', cx: 0, cy: 2, rx: 17, ry: 12, f: 'main' },
          { t: 'poly', p: '-16,4 -30,12 -15,12', f: 'd1' },
          { t: 'circle', cx: 13, cy: -8, r: 9, f: 'l1' },
          { t: 'poly', p: '21,-8 30,-5 21,-2', f: '#F2A22C' },
          { t: 'circle', cx: 16, cy: -10, r: 2, f: DARK },
          { t: 'path', d: 'M-4 0 Q 2 12 12 6 Q 2 6 -4 0 Z', f: 'd1' },
        ],
  },
  {
    kind: 'butterfly', label: 'butterfly', radius: 22, variants: 1,
    shapes: () => [
      { t: 'ellipse', cx: -11, cy: -6, rx: 11, ry: 13, f: 'main' },
      { t: 'ellipse', cx: 11, cy: -6, rx: 11, ry: 13, f: 'main' },
      { t: 'ellipse', cx: -9, cy: 10, rx: 8, ry: 9, f: 'd1' },
      { t: 'ellipse', cx: 9, cy: 10, rx: 8, ry: 9, f: 'd1' },
      { t: 'rect', x: -2, y: -14, w: 4, h: 28, rx: 2, f: DARK },
      { t: 'path', d: 'M-2 -13 Q -8 -22 -11 -20', f: 'none', s: DARK, sw: 2 },
      { t: 'path', d: 'M2 -13 Q 8 -22 11 -20', f: 'none', s: DARK, sw: 2 },
    ],
  },
  {
    kind: 'kite', label: 'kite', radius: 28, variants: 1,
    shapes: () => [
      { t: 'poly', p: '0,-28 18,0 0,22 -18,0', f: 'main' },
      { t: 'path', d: 'M0 -28 L0 22 M-18 0 L18 0', f: 'none', s: 'd2', sw: 2 },
      { t: 'path', d: 'M0 22 Q 8 32 0 40 Q -8 48 0 56', f: 'none', s: 'd1', sw: 3 },
      { t: 'poly', p: '-6,34 6,30 -6,42', f: 'l1' },
    ],
  },
  {
    kind: 'balloon', label: 'balloon', radius: 24, variants: 1,
    shapes: () => [
      { t: 'path', d: 'M0 22 Q -14 26 -6 40', f: 'none', s: '#9AA6B8', sw: 2 },
      { t: 'ellipse', cx: 0, cy: -2, rx: 19, ry: 23, f: 'main' },
      { t: 'poly', p: '-5,20 5,20 0,27', f: 'd1' },
      { t: 'ellipse', cx: -7, cy: -10, rx: 5, ry: 7, f: 'l2' },
    ],
  },
  {
    kind: 'bench', label: 'bench', radius: 34, variants: 1, maxRotation: 6,
    shapes: () => [
      { t: 'rect', x: -26, y: -20, w: 6, h: 32, rx: 2, f: 'd1' },
      { t: 'rect', x: 20, y: -20, w: 6, h: 32, rx: 2, f: 'd1' },
      { t: 'rect', x: -30, y: -18, w: 60, h: 8, rx: 3, f: 'main' },
      { t: 'rect', x: -30, y: -6, w: 60, h: 8, rx: 3, f: 'main' },
      { t: 'rect', x: -30, y: 8, w: 60, h: 9, rx: 3, f: 'l1' },
      { t: 'rect', x: -26, y: 16, w: 6, h: 16, rx: 2, f: 'd2' },
      { t: 'rect', x: 20, y: 16, w: 6, h: 16, rx: 2, f: 'd2' },
    ],
  },
  {
    kind: 'cat', label: 'cat', radius: 28, variants: 1,
    shapes: () => [
      { t: 'path', d: 'M22 12 Q 38 8 32 -8', f: 'none', s: 'd1', sw: 6, cap: 'round' },
      { t: 'ellipse', cx: 0, cy: 10, rx: 24, ry: 15, f: 'main' },
      { t: 'poly', p: '-16,-16 -10,-32 -2,-18', f: 'd1' },
      { t: 'poly', p: '16,-16 10,-32 2,-18', f: 'd1' },
      { t: 'circle', cx: 0, cy: -10, r: 16, f: 'main' },
      { t: 'circle', cx: -6, cy: -12, r: 2.6, f: DARK },
      { t: 'circle', cx: 6, cy: -12, r: 2.6, f: DARK },
      { t: 'poly', p: '-3,-5 3,-5 0,-1', f: '#E8899B' },
    ],
  },
  {
    kind: 'dog', label: 'dog', radius: 28, variants: 1,
    shapes: () => [
      { t: 'path', d: 'M-22 4 Q -34 -4 -28 -14', f: 'none', s: 'd1', sw: 6, cap: 'round' },
      { t: 'rect', x: -14, y: 18, w: 7, h: 12, rx: 3, f: 'd1' },
      { t: 'rect', x: 6, y: 18, w: 7, h: 12, rx: 3, f: 'd1' },
      { t: 'ellipse', cx: -2, cy: 8, rx: 23, ry: 14, f: 'main' },
      { t: 'circle', cx: 16, cy: -8, r: 15, f: 'main' },
      { t: 'ellipse', cx: 6, cy: -10, rx: 6, ry: 12, f: 'd2' },
      { t: 'ellipse', cx: 26, cy: -2, rx: 8, ry: 6, f: 'l1' },
      { t: 'circle', cx: 31, cy: -3, r: 3, f: DARK },
      { t: 'circle', cx: 19, cy: -12, r: 2.4, f: DARK },
    ],
  },
  {
    kind: 'lamp', label: 'street lamp', radius: 40, variants: 1, maxRotation: 4,
    shapes: () => [
      { t: 'rect', x: -4, y: -20, w: 8, h: 62, rx: 3, f: 'd1' },
      { t: 'rect', x: -12, y: 40, w: 24, h: 6, rx: 3, f: 'd2' },
      { t: 'path', d: 'M0 -20 Q 0 -42 20 -42', f: 'none', s: 'd1', sw: 8, cap: 'round' },
      { t: 'poly', p: '10,-42 30,-42 26,-30 14,-30', f: 'main' },
      { t: 'ellipse', cx: 20, cy: -28, rx: 9, ry: 4, f: '#FFE08A' },
    ],
  },
  {
    kind: 'house', label: 'house', radius: 44, variants: 2, maxRotation: 0,
    shapes: (v) => [
      { t: 'rect', x: 8, y: -46, w: 10, h: 18, rx: 2, f: '#8F6A56' },
      { t: 'poly', p: v === 1 ? '-42,-16 0,-48 42,-16' : '-40,-14 -40,-20 0,-46 40,-20 40,-14', f: 'd2' },
      { t: 'rect', x: -34, y: -16, w: 68, h: 52, rx: 4, f: 'main' },
      { t: 'rect', x: -10, y: 8, w: 20, h: 28, rx: 3, f: 'd1' },
      { t: 'circle', cx: 5, cy: 22, r: 2, f: '#FFD45E' },
      { t: 'rect', x: -28, y: -8, w: 16, h: 14, rx: 2, f: GLASS },
      { t: 'rect', x: 12, y: -8, w: 16, h: 14, rx: 2, f: GLASS },
    ],
  },
  {
    kind: 'car', label: 'car', radius: 40, variants: 2, maxRotation: 6,
    shapes: (v) => [
      {
        t: 'path',
        d: v === 1
          ? 'M-38 12 L-34 -6 Q -30 -20 -12 -20 L14 -20 Q 28 -20 34 -6 L38 12 Q 38 20 30 20 L-30 20 Q -38 20 -38 12 Z'
          : 'M-38 12 L-36 -2 Q -32 -16 -14 -16 L10 -16 Q 26 -16 32 -2 L38 12 Q 38 20 30 20 L-30 20 Q -38 20 -38 12 Z',
        f: 'main',
      },
      { t: 'path', d: 'M-24 -4 L-20 -14 L-2 -14 L-2 -4 Z', f: GLASS },
      { t: 'path', d: 'M4 -14 L12 -14 Q 22 -14 26 -4 L4 -4 Z', f: GLASS },
      { t: 'rect', x: -38, y: 4, w: 76, h: 6, f: 'd1' },
      { t: 'circle', cx: -20, cy: 20, r: 10, f: DARK },
      { t: 'circle', cx: 20, cy: 20, r: 10, f: DARK },
      { t: 'circle', cx: -20, cy: 20, r: 4, f: '#C9D2DE' },
      { t: 'circle', cx: 20, cy: 20, r: 4, f: '#C9D2DE' },
    ],
  },
  {
    kind: 'bicycle', label: 'bicycle', radius: 34, variants: 1, maxRotation: 6,
    shapes: () => [
      { t: 'circle', cx: -20, cy: 12, r: 16, f: 'none', s: DARK, sw: 4 },
      { t: 'circle', cx: 20, cy: 12, r: 16, f: 'none', s: DARK, sw: 4 },
      { t: 'path', d: 'M-20 12 L-2 -12 L14 -12 L20 12 M-2 -12 L4 12 L-20 12', f: 'none', s: 'main', sw: 4 },
      { t: 'path', d: 'M14 -12 L20 -20 L28 -20', f: 'none', s: 'd1', sw: 3, cap: 'round' },
      { t: 'rect', x: -12, y: -18, w: 16, h: 5, rx: 2.5, f: 'd2' },
      { t: 'circle', cx: 4, cy: 12, r: 4, f: 'l1' },
    ],
  },
  {
    kind: 'sign', label: 'sign', radius: 32, variants: 2, maxRotation: 8,
    texts: ['OPEN', 'STOP', 'SALE', 'PARK', 'CAFE', 'FREE', 'EXIT', 'HELP'],
    shapes: (v) => [
      { t: 'rect', x: -3.5, y: 6, w: 7, h: 36, rx: 3, f: '#7D8798' },
      v === 1
        ? { t: 'circle', cx: 0, cy: -12, r: 26, f: 'main', s: WHITE, sw: 3 }
        : { t: 'rect', x: -32, y: -30, w: 64, h: 36, rx: 6, f: 'main', s: WHITE, sw: 3 },
      { t: 'label', x: 0, y: -12, size: 17, f: WHITE, weight: 800 },
    ],
  },
  {
    kind: 'trafficLight', label: 'traffic light', radius: 34, variants: 1, maxRotation: 4,
    shapes: () => [
      { t: 'rect', x: -4, y: 16, w: 8, h: 30, rx: 3, f: '#5A6577' },
      { t: 'rect', x: -15, y: -40, w: 30, h: 58, rx: 8, f: 'main' },
      { t: 'circle', cx: 0, cy: -27, r: 8, f: '#E64C3C' },
      { t: 'circle', cx: 0, cy: -10, r: 8, f: '#F2C037' },
      { t: 'circle', cx: 0, cy: 7, r: 8, f: '#3FB96B' },
    ],
  },
  {
    kind: 'mailbox', label: 'mailbox', radius: 28, variants: 1, maxRotation: 5,
    shapes: () => [
      { t: 'rect', x: -4, y: 8, w: 8, h: 30, rx: 3, f: '#7A5230' },
      { t: 'rect', x: 20, y: -22, w: 5, h: 18, rx: 2, f: '#E64C3C' },
      { t: 'path', d: 'M-22 8 L-22 -8 Q -22 -24 0 -24 Q 22 -24 22 -8 L22 8 Z', f: 'main' },
      { t: 'rect', x: -22, y: 2, w: 30, h: 6, rx: 2, f: 'd2' },
    ],
  },
  {
    kind: 'hydrant', label: 'fire hydrant', radius: 24, variants: 1, maxRotation: 5,
    shapes: () => [
      { t: 'rect', x: -18, y: 24, w: 36, h: 8, rx: 3, f: 'd2' },
      { t: 'path', d: 'M-14 24 L-14 -8 Q -14 -20 0 -20 Q 14 -20 14 -8 L14 24 Z', f: 'main' },
      { t: 'rect', x: -22, y: -8, w: 44, h: 9, rx: 4, f: 'd1' },
      { t: 'circle', cx: 0, cy: -22, r: 7, f: 'd1' },
      { t: 'rect', x: -6, y: -30, w: 12, h: 8, rx: 3, f: 'd2' },
    ],
  },
  {
    kind: 'clock', label: 'clock', radius: 28, variants: 2, maxRotation: 6,
    texts: ['3:00', '7:15', '9:45', '12:30', '5:20', '10:05', '1:40', '6:55'],
    shapes: (v) => v === 1
      ? [
          { t: 'rect', x: -28, y: -18, w: 56, h: 36, rx: 8, f: 'main' },
          { t: 'rect', x: -22, y: -12, w: 44, h: 24, rx: 4, f: '#1B2433' },
          { t: 'label', x: 0, y: 0, size: 16, f: '#7DF2C6', weight: 700 },
        ]
      : [
          { t: 'circle', cx: 0, cy: 0, r: 26, f: 'main' },
          { t: 'circle', cx: 0, cy: 0, r: 20, f: '#FBF6EA' },
          { t: 'label', x: 0, y: 1, size: 14, f: '#26303F', weight: 700 },
        ],
  },
  {
    kind: 'umbrella', label: 'umbrella', radius: 34, variants: 1,
    shapes: () => [
      { t: 'path', d: 'M0 4 L0 34 Q 0 44 -10 44', f: 'none', s: '#7A5230', sw: 4, cap: 'round' },
      { t: 'path', d: 'M-34 4 Q -34 -30 0 -30 Q 34 -30 34 4 Z', f: 'main' },
      { t: 'path', d: 'M-34 4 Q -28 -6 -22 4 Q -16 -6 -11 4 Q -5 -6 0 4 Q 5 -6 11 4 Q 16 -6 22 4 Q 28 -6 34 4 Z', f: 'l1' },
      { t: 'path', d: 'M-34 4 Q -34 -30 0 -30 Q 34 -30 34 4', f: 'none', s: 'd2', sw: 2 },
    ],
  },
  {
    kind: 'mug', label: 'mug', radius: 26, variants: 2,
    shapes: (v) => [
      { t: 'path', d: 'M16 -6 Q 30 -6 30 6 Q 30 18 16 18', f: 'none', s: 'd1', sw: 5 },
      { t: 'path', d: 'M-18 -18 L18 -18 L15 24 Q 14 28 10 28 L-10 28 Q -14 28 -15 24 Z', f: 'main' },
      v === 1
        ? { t: 'rect', x: -17, y: -2, w: 33, h: 9, f: 'l2' }
        : { t: 'circle', cx: 0, cy: 6, r: 7, f: 'l2' },
      { t: 'ellipse', cx: 0, cy: -18, rx: 18, ry: 5, f: 'l1' },
    ],
  },
  {
    kind: 'plate', label: 'plate', radius: 30, variants: 1, maxRotation: 0,
    shapes: () => [
      { t: 'ellipse', cx: 0, cy: 0, rx: 30, ry: 22, f: 'main' },
      { t: 'ellipse', cx: 0, cy: -1, rx: 20, ry: 14, f: 'l2' },
      { t: 'ellipse', cx: 0, cy: -1, rx: 20, ry: 14, f: 'none', s: 'd1', sw: 1.5 },
    ],
  },
  {
    kind: 'cupcake', label: 'cupcake', radius: 26, variants: 1,
    shapes: () => [
      { t: 'path', d: 'M-18 -2 L-13 24 Q -12 28 -8 28 L8 28 Q 12 28 13 24 L18 -2 Z', f: '#D9A05B' },
      { t: 'path', d: 'M-14 4 L-11 26 M-4 2 L-4 28 M6 2 L4 28 M14 4 L11 26', f: 'none', s: '#BF8442', sw: 2 },
      { t: 'path', d: 'M-19 -2 Q -19 -20 -6 -20 Q -2 -30 8 -24 Q 20 -24 19 -6 Q 19 -2 16 -2 Z', f: 'main' },
      { t: 'circle', cx: 4, cy: -28, r: 5, f: '#E64C3C' },
    ],
  },
  {
    kind: 'bottle', label: 'bottle', radius: 30, variants: 1, maxRotation: 10,
    shapes: () => [
      { t: 'path', d: 'M-6 -30 L6 -30 L6 -16 Q 16 -8 16 6 L16 28 Q 16 34 10 34 L-10 34 Q -16 34 -16 28 L-16 6 Q -16 -8 -6 -16 Z', f: 'main' },
      { t: 'rect', x: -7, y: -38, w: 14, h: 9, rx: 2, f: 'd2' },
      { t: 'rect', x: -16, y: 4, w: 32, h: 17, f: 'l2' },
      { t: 'path', d: 'M-10 -6 L-10 26', f: 'none', s: 'l1', sw: 3 },
    ],
  },
  {
    kind: 'pot', label: 'pot', radius: 30, variants: 1, maxRotation: 4,
    shapes: () => [
      { t: 'path', d: 'M-32 -10 Q -40 -10 -40 -2', f: 'none', s: 'd2', sw: 4 },
      { t: 'path', d: 'M32 -10 Q 40 -10 40 -2', f: 'none', s: 'd2', sw: 4 },
      { t: 'path', d: 'M-26 -8 L-22 24 Q -21 28 -17 28 L17 28 Q 21 28 22 24 L26 -8 Z', f: 'main' },
      { t: 'rect', x: -32, y: -14, w: 64, h: 8, rx: 4, f: 'd1' },
      { t: 'ellipse', cx: 0, cy: -16, rx: 24, ry: 6, f: 'l1' },
      { t: 'rect', x: -5, y: -26, w: 10, h: 8, rx: 4, f: 'd2' },
    ],
  },
  {
    kind: 'kettle', label: 'kettle', radius: 28, variants: 1, maxRotation: 6,
    shapes: () => [
      { t: 'path', d: 'M-16 -20 Q 0 -32 16 -20', f: 'none', s: 'd2', sw: 4 },
      { t: 'poly', p: '-20,-6 -34,-16 -32,-6 -20,2', f: 'd1' },
      { t: 'path', d: 'M-22 -14 L-18 20 Q -17 26 -10 26 L10 26 Q 17 26 18 20 L22 -14 Z', f: 'main' },
      { t: 'ellipse', cx: 0, cy: -14, rx: 22, ry: 6, f: 'l1' },
      { t: 'rect', x: -5, y: -22, w: 10, h: 8, rx: 3, f: 'd2' },
    ],
  },
  {
    kind: 'apple', label: 'apple', radius: 22, variants: 1,
    shapes: () => [
      { t: 'path', d: 'M0 -14 Q 2 -24 10 -26', f: 'none', s: '#7A5230', sw: 3, cap: 'round' },
      { t: 'path', d: 'M2 -20 Q 14 -28 18 -18 Q 8 -12 2 -20 Z', f: '#4CA35E' },
      { t: 'circle', cx: -8, cy: 2, r: 15, f: 'main' },
      { t: 'circle', cx: 8, cy: 2, r: 15, f: 'main' },
      { t: 'ellipse', cx: -9, cy: -4, rx: 4, ry: 6, f: 'l2' },
    ],
  },
  {
    kind: 'book', label: 'book', radius: 26, variants: 1, maxRotation: 12,
    shapes: () => [
      { t: 'rect', x: -20, y: -26, w: 40, h: 52, rx: 3, f: 'main' },
      { t: 'rect', x: -14, y: -24, w: 32, h: 48, rx: 2, f: '#FBF6EA' },
      { t: 'rect', x: -20, y: -26, w: 8, h: 52, rx: 3, f: 'd2' },
      { t: 'rect', x: -6, y: -14, w: 20, h: 3, f: '#C2CBD6' },
      { t: 'rect', x: -6, y: -6, w: 20, h: 3, f: '#C2CBD6' },
      { t: 'rect', x: -6, y: 2, w: 13, h: 3, f: '#C2CBD6' },
    ],
  },
  {
    kind: 'fish', label: 'fish', radius: 28, variants: 2,
    shapes: (v) => [
      { t: 'poly', p: '-16,0 -34,-14 -34,14', f: 'd1' },
      v === 1
        ? { t: 'ellipse', cx: 4, cy: 0, rx: 24, ry: 14, f: 'main' }
        : { t: 'path', d: 'M-18 0 Q -6 -18 12 -16 Q 28 -14 28 0 Q 28 14 12 16 Q -6 18 -18 0 Z', f: 'main' },
      { t: 'poly', p: '0,-12 10,-26 14,-12', f: 'd1' },
      { t: 'poly', p: '0,12 10,24 14,12', f: 'd1' },
      { t: 'circle', cx: 17, cy: -4, r: 4, f: WHITE },
      { t: 'circle', cx: 18, cy: -4, r: 2, f: DARK },
    ],
  },
  {
    kind: 'crab', label: 'crab', radius: 28, variants: 1,
    shapes: () => [
      { t: 'path', d: 'M-24 6 L-32 18 M-16 12 L-20 26 M24 6 L32 18 M16 12 L20 26', f: 'none', s: 'd1', sw: 4, cap: 'round' },
      { t: 'path', d: 'M-22 -6 Q -34 -12 -32 -22 Q -24 -24 -22 -14 Z', f: 'd1' },
      { t: 'path', d: 'M22 -6 Q 34 -12 32 -22 Q 24 -24 22 -14 Z', f: 'd1' },
      { t: 'ellipse', cx: 0, cy: 2, rx: 24, ry: 16, f: 'main' },
      { t: 'circle', cx: -8, cy: -16, r: 4, f: WHITE },
      { t: 'circle', cx: 8, cy: -16, r: 4, f: WHITE },
      { t: 'circle', cx: -8, cy: -16, r: 2, f: DARK },
      { t: 'circle', cx: 8, cy: -16, r: 2, f: DARK },
    ],
  },
  {
    kind: 'jellyfish', label: 'jellyfish', radius: 26, variants: 1,
    shapes: () => [
      { t: 'path', d: 'M-14 8 Q -16 22 -10 30 Q -4 38 -8 44', f: 'none', s: 'l1', sw: 3, cap: 'round' },
      { t: 'path', d: 'M0 8 Q -2 24 4 32 Q 10 40 4 46', f: 'none', s: 'l1', sw: 3, cap: 'round' },
      { t: 'path', d: 'M14 8 Q 18 22 12 30 Q 6 38 12 44', f: 'none', s: 'l1', sw: 3, cap: 'round' },
      { t: 'path', d: 'M-22 8 Q -22 -22 0 -22 Q 22 -22 22 8 Z', f: 'main' },
      { t: 'ellipse', cx: -8, cy: -8, rx: 5, ry: 4, f: 'l2' },
    ],
  },
  {
    kind: 'seaweed', label: 'seaweed', radius: 30, variants: 2, maxRotation: 6,
    shapes: (v) => v === 1
      ? [
          { t: 'path', d: 'M-14 38 Q -24 16 -14 -4', f: 'none', s: 'd1', sw: 6, cap: 'round' },
          { t: 'path', d: 'M0 38 Q -16 18 0 0 Q 16 -18 2 -38', f: 'none', s: 'main', sw: 8, cap: 'round' },
        ]
      : [
          { t: 'path', d: 'M16 40 Q 26 18 16 0', f: 'none', s: 'l1', sw: 6, cap: 'round' },
          { t: 'path', d: 'M-16 40 Q -24 22 -16 6', f: 'none', s: 'd1', sw: 6, cap: 'round' },
          { t: 'path', d: 'M0 40 Q 14 20 0 2 Q -14 -16 0 -36', f: 'none', s: 'main', sw: 9, cap: 'round' },
        ],
  },
  {
    kind: 'shell', label: 'shell', radius: 24, variants: 1,
    shapes: () => [
      { t: 'path', d: 'M0 20 Q -26 16 -22 -8 Q -14 -22 0 -22 Q 14 -22 22 -8 Q 26 16 0 20 Z', f: 'main' },
      { t: 'path', d: 'M0 20 L0 -22 M0 20 L-12 -16 M0 20 L12 -16 M0 20 L-20 -4 M0 20 L20 -4', f: 'none', s: 'd1', sw: 2 },
      { t: 'circle', cx: 0, cy: 19, r: 4, f: 'd2' },
    ],
  },
  {
    kind: 'starfish', label: 'starfish', radius: 26, variants: 1,
    shapes: () => [
      { t: 'poly', p: STARFISH_POINTS, f: 'main' },
      { t: 'circle', cx: 0, cy: 0, r: 3, f: 'd1' },
      { t: 'circle', cx: -7, cy: -8, r: 2.2, f: 'd1' },
      { t: 'circle', cx: 8, cy: -6, r: 2.2, f: 'd1' },
      { t: 'circle', cx: 0, cy: 9, r: 2.2, f: 'd1' },
    ],
  },
  {
    kind: 'bubble', label: 'bubble', radius: 16, variants: 1,
    shapes: () => [
      { t: 'circle', cx: 0, cy: 0, r: 14, f: 'l2', s: 'main', sw: 3 },
      { t: 'circle', cx: -5, cy: -5, r: 4, f: WHITE },
    ],
  },
  {
    kind: 'anchor', label: 'anchor', radius: 28, variants: 1, maxRotation: 12,
    shapes: () => [
      { t: 'circle', cx: 0, cy: -24, r: 8, f: 'none', s: 'main', sw: 5 },
      { t: 'rect', x: -3.5, y: -18, w: 7, h: 44, rx: 3, f: 'main' },
      { t: 'rect', x: -20, y: -12, w: 40, h: 6, rx: 3, f: 'main' },
      { t: 'path', d: 'M-24 6 Q -24 26 0 28 Q 24 26 24 6', f: 'none', s: 'main', sw: 6, cap: 'round' },
      { t: 'poly', p: '-30,2 -18,2 -24,12', f: 'main' },
      { t: 'poly', p: '30,2 18,2 24,12', f: 'main' },
    ],
  },
];

export const OBJECTS: Readonly<Record<ObjectKind, ObjectDef>> = Object.fromEntries(
  DEFS.map((d) => [d.kind, d]),
) as Record<ObjectKind, ObjectDef>;

export const ALL_KINDS: readonly ObjectKind[] = DEFS.map((d) => d.kind);

export function objectDef(kind: ObjectKind): ObjectDef {
  return OBJECTS[kind];
}

/** Hitbox radius for a placed object (local radius scaled, with a floor for tap comfort). */
export function objectRadius(kind: ObjectKind, scale: number): number {
  return Math.max(18, objectDef(kind).radius * scale);
}

export type ThemeDef = {
  id: ThemeId;
  name: string;
  background: BackgroundSpec;
  kinds: readonly ObjectKind[];
  /** Kinds that belong in the upper (sky/wall) band rather than on the ground. */
  skyKinds: readonly ObjectKind[];
};

export const THEMES: readonly ThemeDef[] = [
  {
    id: 'park',
    name: 'The Park',
    background: {
      skyTop: '#8FD3F4', skyBottom: '#DCF2FB', groundColor: '#7FBF5F',
      horizon: 0.52, accent: '#6BAA4E', pattern: 'grass',
    },
    kinds: ['tree', 'bush', 'flower', 'cloud', 'sun', 'bird', 'butterfly', 'kite',
      'balloon', 'bench', 'cat', 'dog', 'lamp', 'umbrella', 'sign', 'book', 'apple'],
    skyKinds: ['cloud', 'sun', 'bird', 'kite', 'balloon', 'butterfly'],
  },
  {
    id: 'kitchen',
    name: 'The Kitchen',
    background: {
      skyTop: '#F7E9D6', skyBottom: '#EFDBC1', groundColor: '#C9A27E',
      horizon: 0.4, accent: '#E8D3B5', pattern: 'tiles',
    },
    kinds: ['mug', 'plate', 'cupcake', 'bottle', 'pot', 'kettle', 'apple', 'book',
      'clock', 'flower', 'sign', 'bubble'],
    skyKinds: ['clock', 'sign'],
  },
  {
    id: 'street',
    name: 'City Street',
    background: {
      skyTop: '#9BB8DE', skyBottom: '#DEE9F6', groundColor: '#8E97A6',
      horizon: 0.55, accent: '#F2E9D0', pattern: 'road',
    },
    kinds: ['house', 'car', 'bicycle', 'sign', 'trafficLight', 'mailbox', 'hydrant',
      'clock', 'lamp', 'tree', 'cat', 'cloud', 'umbrella', 'balloon', 'bench', 'bird'],
    skyKinds: ['cloud', 'bird', 'balloon'],
  },
  {
    id: 'reef',
    name: 'The Reef',
    background: {
      skyTop: '#1E7FA8', skyBottom: '#57B9D4', groundColor: '#E4D2A6',
      horizon: 0.46, accent: '#8FDCEA', pattern: 'sand',
    },
    kinds: ['fish', 'crab', 'jellyfish', 'seaweed', 'shell', 'starfish', 'bubble',
      'bottle', 'anchor', 'star'],
    skyKinds: ['fish', 'jellyfish', 'bubble', 'star'],
  },
];

export function themeById(id: ThemeId): ThemeDef {
  return THEMES.find((t) => t.id === id) ?? THEMES[0];
}
