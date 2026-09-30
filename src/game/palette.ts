/** Curated object palettes + colour maths used by the renderer and the recolor mutation. */

export type PaletteColor = {
  hex: string;
  /** Human word used in change descriptions ("the blue umbrella"). */
  name: string;
  /** Coarse grouping so recolor can guarantee a visibly different family. */
  family: 'warm' | 'cool' | 'green' | 'neutral' | 'pink';
};

/** Default palette: saturated, flat-cartoon friendly. */
export const STANDARD_PALETTE: readonly PaletteColor[] = [
  { hex: '#E03A3A', name: 'red', family: 'warm' },
  { hex: '#F2801E', name: 'orange', family: 'warm' },
  { hex: '#F5B921', name: 'yellow', family: 'warm' },
  { hex: '#8FC33A', name: 'lime', family: 'green' },
  { hex: '#2FA45B', name: 'green', family: 'green' },
  { hex: '#14A3A0', name: 'teal', family: 'cool' },
  { hex: '#3B9AE1', name: 'blue', family: 'cool' },
  { hex: '#5561D6', name: 'indigo', family: 'cool' },
  { hex: '#9457D1', name: 'purple', family: 'pink' },
  { hex: '#E05A9E', name: 'pink', family: 'pink' },
  { hex: '#96613C', name: 'brown', family: 'neutral' },
  { hex: '#6B7A8F', name: 'grey', family: 'neutral' },
  { hex: '#EFE2C8', name: 'cream', family: 'neutral' },
];

/**
 * Colourblind-safe palette (Okabe-Ito derived). Hues here stay distinguishable
 * under protanopia/deuteranopia and also differ in lightness.
 */
export const CB_SAFE_PALETTE: readonly PaletteColor[] = [
  { hex: '#D55E00', name: 'vermillion', family: 'warm' },
  { hex: '#E69F00', name: 'orange', family: 'warm' },
  { hex: '#F0E442', name: 'yellow', family: 'warm' },
  { hex: '#009E73', name: 'green', family: 'green' },
  { hex: '#56B4E9', name: 'sky blue', family: 'cool' },
  { hex: '#0072B2', name: 'blue', family: 'cool' },
  { hex: '#CC79A7', name: 'pink', family: 'pink' },
  { hex: '#7B5B3A', name: 'brown', family: 'neutral' },
  { hex: '#999999', name: 'grey', family: 'neutral' },
  { hex: '#EDE6D6', name: 'cream', family: 'neutral' },
];

export function paletteFor(colorblindSafe: boolean): readonly PaletteColor[] {
  return colorblindSafe ? CB_SAFE_PALETTE : STANDARD_PALETTE;
}

/** Look up the friendly name of a hex value in either palette. */
export function colorName(hex: string): string {
  const lower = hex.toLowerCase();
  const found =
    STANDARD_PALETTE.find((c) => c.hex.toLowerCase() === lower) ??
    CB_SAFE_PALETTE.find((c) => c.hex.toLowerCase() === lower);
  return found ? found.name : 'coloured';
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
}

function rgbToHex(r: number, g: number, b: number): string {
  const to = (v: number) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0');
  return `#${to(r)}${to(g)}${to(b)}`;
}

/** Mix toward black. amount 0..1 */
export function shade(hex: string, amount: number): string {
  const [r, g, b] = hexToRgb(hex);
  return rgbToHex(r * (1 - amount), g * (1 - amount), b * (1 - amount));
}

/** Mix toward white. amount 0..1 */
export function tint(hex: string, amount: number): string {
  const [r, g, b] = hexToRgb(hex);
  return rgbToHex(r + (255 - r) * amount, g + (255 - g) * amount, b + (255 - b) * amount);
}

/** Relative luminance (WCAG), used to keep recolors perceptually distinct. */
export function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Squared RGB distance — cheap proxy for "are these obviously different?". */
export function colorDistance(a: string, b: string): number {
  const [r1, g1, b1] = hexToRgb(a);
  const [r2, g2, b2] = hexToRgb(b);
  return Math.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2);
}

/**
 * True when swapping `from` -> `to` would be a red<->green-only difference,
 * which is invisible to the most common forms of colour blindness.
 */
export function isRedGreenOnlySwap(from: string, to: string): boolean {
  const warm = ['#e03a3a', '#f2801e'];
  const green = ['#8fc33a', '#2fa45b'];
  const a = from.toLowerCase();
  const b = to.toLowerCase();
  const pair = (x: string[], y: string[]) => x.includes(a) && y.includes(b);
  if (!(pair(warm, green) || pair(green, warm))) return false;
  // If lightness differs a lot it is still readable without hue perception.
  return Math.abs(luminance(from) - luminance(to)) < 0.15;
}
