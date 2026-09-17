// Small helpers for reading FormData in Server Actions.

export type ActionState = { error?: string; ok?: boolean } | undefined;

export function str(fd: FormData, key: string) {
  const v = fd.get(key);
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t === "" ? null : t;
}

export function num(fd: FormData, key: string) {
  const v = str(fd, key);
  if (v === null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function list(fd: FormData, key: string) {
  return fd
    .getAll(key)
    .filter((v): v is string => typeof v === "string" && v.trim() !== "")
    .map((v) => v.trim());
}

/** Comma-separated free text -> unique lowercase tags. */
export function tags(fd: FormData, key = "tags") {
  const raw = str(fd, key) ?? "";
  return [...new Set(raw.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean))];
}

/** ISO timestamp from a hidden field set by <DateTimeField>, defaulting to now. */
export function when(fd: FormData, key: string) {
  const v = str(fd, key);
  const d = v ? new Date(v) : new Date();
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}
