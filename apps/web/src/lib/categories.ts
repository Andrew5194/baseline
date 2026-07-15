// Preset activity categories offered when adding a time entry. Users may also
// type their own; both flow through the same string-based category field.
export const PRESET_CATEGORIES = ['Coding', 'Work', 'Essentials', 'Health', 'Household'];

// Common life routines, surfaced as one-click presets for recurring allocations.
export const ROUTINE_PRESETS: Array<{ category: string; hours: number }> = [
  { category: 'Sleep', hours: 8 },
  { category: 'Meals', hours: 2 },
];

// Hand-picked, spread across the hue wheel so adjacent categories stay distinct.
// The first six match the seeded defaults (see DEFAULT_CATEGORIES in @baseline/db);
// the last two are kept so any legacy "Code Review"/"Break" categories keep their hue.
const PRESET_COLORS: Record<string, string> = {
  Coding: '#10b981', // emerald (green)
  Work: '#6366f1', // indigo
  Essentials: '#f59e0b', // amber (orange)
  Health: '#f43f5e', // rose
  Household: '#0ea5e9', // sky
  // Legacy defaults kept so any older categories retain their hue.
  'Deep Work': '#10b981',
  Meetings: '#6366f1',
  Learning: '#f59e0b',
  Admin: '#64748b',
  Sleep: '#0ea5e9',
  Meals: '#f97316',
  'Code Review': '#a855f7',
  Break: '#f43f5e',
};

// The unallocated remainder — a faint translucent track so it recedes behind the
// colored segments on both light and dark backgrounds.
export const FREE_COLOR = 'rgba(148, 163, 184, 0.22)'; // slate-400 @ ~22%

// Free time when recurring routines are hidden — a faint green to signal that
// free time is now the focus.
export const FREE_FOCUS_COLOR = 'rgba(16, 185, 129, 0.2)'; // emerald-500 @ ~20%
export const FREE_FOCUS_SWATCH = '#34d399'; // emerald-400

function hslToHex(h: number, s: number, l: number): string {
  const a = (s / 100) * Math.min(l / 100, 1 - l / 100);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const c = l / 100 - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(255 * c)
      .toString(16)
      .padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

function hexToHsl(hex: string): [number, number, number] {
  const m = hex.replace('#', '');
  const n = m.length === 3 ? m.split('').map((c) => c + c).join('') : m;
  const r = parseInt(n.slice(0, 2), 16) / 255;
  const g = parseInt(n.slice(2, 4), 16) / 255;
  const b = parseInt(n.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  let h = 0;
  let s = 0;
  if (d !== 0) {
    s = d / (1 - Math.abs(2 * l - 1));
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return [h, s * 100, l * 100];
}

// Shift a hex color's lightness by `deltaL` (in HSL lightness points), keeping hue
// and saturation — for tasteful, true-to-color gradient stops. Non-hex inputs pass
// through unchanged.
export function adjustLightness(hex: string, deltaL: number): string {
  if (!hex.startsWith('#')) return hex;
  const [h, s, l] = hexToHsl(hex);
  return hslToHex(h, s, Math.max(0, Math.min(100, l + deltaL)));
}

// Deterministic default for a single category not covered by a preset or override.
function hashColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return hslToHex(h % 360, 62, 55);
}

/**
 * Resolve the color for a category: user override → preset → deterministic hash.
 * Used as a per-item fallback when the full category set isn't available.
 */
export function colorForCategory(name: string, overrides?: Record<string, string>): string {
  if (overrides?.[name]) return overrides[name];
  if (PRESET_COLORS[name]) return PRESET_COLORS[name];
  return hashColor(name);
}

/**
 * Build a stable color map for a known set of categories. Presets and user
 * overrides keep their fixed colors; the remaining ("custom") categories get
 * hues evenly spaced around the wheel so they stay visually distinct — the
 * spacing tightens as the number of categories grows. Users can still override
 * any of them if two end up too close.
 */
export function buildColorMap(
  categories: string[],
  overrides: Record<string, string> = {},
): Record<string, string> {
  const map: Record<string, string> = {};
  const dynamic: string[] = [];

  for (const c of [...new Set(categories)]) {
    if (overrides[c]) map[c] = overrides[c];
    else if (PRESET_COLORS[c]) map[c] = PRESET_COLORS[c];
    else dynamic.push(c);
  }

  // Spread the unknowns evenly; sort first so colors are stable across renders.
  dynamic.sort();
  const n = dynamic.length;
  dynamic.forEach((c, i) => {
    const hue = Math.round((i * 360) / Math.max(n, 1) + 200) % 360; // start in the blues
    map[c] = hslToHex(hue, 62, 55);
  });

  return map;
}
