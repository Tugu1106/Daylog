// Timezone-aware day helpers. The server runs in UTC on Vercel, so every
// function takes the user's IANA timezone (synced from the browser via cookie).

export const TZ_COOKIE = "tz";
export const DEFAULT_TZ = process.env.NEXT_PUBLIC_APP_TIMEZONE || "Asia/Ulaanbaatar";

export function isValidTz(tz: string | undefined | null): tz is string {
  if (!tz) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** YYYY-MM-DD of the instant in tz. */
export function localDay(tz: string, date: Date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function zonedParts(tz: string, date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);
  const get = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
    second: get("second"),
  };
}

/** Offset of tz from UTC in minutes at the given instant. */
function tzOffsetMinutes(tz: string, date: Date) {
  const p = zonedParts(tz, date);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return Math.round((asUtc - Math.floor(date.getTime() / 1000) * 1000) / 60000);
}

/** Instant (ms) for a wall-clock time in tz. */
export function zonedToUtc(tz: string, y: number, m: number, d: number, hh = 0, mm = 0) {
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  const first = guess - tzOffsetMinutes(tz, new Date(guess)) * 60000;
  // Second pass handles DST transitions.
  return guess - tzOffsetMinutes(tz, new Date(first)) * 60000;
}

/** [start, end) of a local day, in epoch ms. */
export function dayBoundsMs(tz: string, day: string) {
  const [y, m, d] = day.split("-").map(Number);
  return { start: zonedToUtc(tz, y, m, d), end: zonedToUtc(tz, y, m, d + 1) };
}

export function dayBounds(tz: string, day: string) {
  const { start, end } = dayBoundsMs(tz, day);
  return { start: new Date(start).toISOString(), end: new Date(end).toISOString() };
}

export function addDays(day: string, n: number) {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

export function isDay(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

/** Minutes since local midnight of the instant in tz. */
export function minutesOfDay(tz: string, date: Date) {
  const p = zonedParts(tz, date);
  return p.hour * 60 + p.minute + p.second / 60;
}

export function formatTime(tz: string, value: string | number | Date) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function formatDay(day: string, opts: Intl.DateTimeFormatOptions = {}) {
  const [y, m, d] = day.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC",
    weekday: "short",
    day: "numeric",
    month: "short",
    ...opts,
  }).format(new Date(Date.UTC(y, m - 1, d)));
}

export function formatDuration(ms: number) {
  const total = Math.max(0, Math.round(ms / 60000));
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** "YYYY-MM-DDTHH:MM" wall-clock in tz (for <input type="datetime-local">). */
export function toDateTimeInput(tz: string, value: string | number) {
  const p = zonedParts(tz, new Date(value));
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;
}

/** Instant (ms) for a datetime-local value interpreted in tz, or null if invalid. */
export function fromDateTimeInput(tz: string, value: string) {
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!m) return null;
  const [, y, mo, d, hh, mm] = m.map(Number);
  return zonedToUtc(tz, y, mo, d, hh, mm);
}
