// The 10 colors a goal can be tagged with.
export const GOAL_PALETTE = [
  '#ef4444', // red
  '#f97316', // orange
  '#f59e0b', // amber
  '#84cc16', // lime
  '#22c55e', // green
  '#10b981', // emerald
  '#06b6d4', // cyan
  '#3b82f6', // blue
  '#8b5cf6', // violet
  '#ec4899', // pink
];

// A goal's effective color: the chosen one, or a deterministic palette fallback.
export function goalColor(color: string | null | undefined, key: string): string {
  if (color) return color;
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return GOAL_PALETTE[h % GOAL_PALETTE.length];
}
