// Timeline view window: how many hours are visible at once. Stored in a cookie so
// the server renders the right width on first paint.

export const VIEW_HOURS_COOKIE = "view_hours";
export const DEFAULT_VIEW_HOURS = 12;
export const VIEW_HOURS_PRESETS = [2, 4, 6, 8, 10, 12, 16, 24] as const;
export const MIN_VIEW_HOURS = 1;
export const MAX_VIEW_HOURS = 24;

export function clampViewHours(value: unknown) {
  const n = typeof value === "string" ? Number(value) : value;
  if (typeof n !== "number" || !Number.isFinite(n)) return DEFAULT_VIEW_HOURS;
  return Math.min(MAX_VIEW_HOURS, Math.max(MIN_VIEW_HOURS, Math.round(n * 2) / 2));
}

export function saveViewHours(hours: number) {
  document.cookie = `${VIEW_HOURS_COOKIE}=${hours}; path=/; max-age=31536000; samesite=lax`;
}
