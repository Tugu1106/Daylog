export function painColor(n: number | null | undefined) {
  if (n === null || n === undefined) return "var(--muted)";
  if (n <= 2) return "var(--pain-low)";
  if (n <= 4) return "var(--pain-mid-low)";
  if (n <= 6) return "var(--pain-mid)";
  if (n <= 8) return "var(--pain-high)";
  return "var(--pain-max)";
}

export function PainBadge({ value, size = "sm" }: { value: number | null; size?: "sm" | "lg" }) {
  const cls =
    size === "lg"
      ? "h-12 min-w-12 rounded-xl text-xl"
      : "h-6 min-w-6 rounded-md text-xs";
  if (value === null) {
    return (
      <span className={`inline-grid place-items-center bg-surface-2 px-1 font-semibold text-muted ${cls}`}>
        –
      </span>
    );
  }
  return (
    <span
      className={`inline-grid place-items-center px-1 font-semibold tabular-nums text-white ${cls}`}
      style={{ background: painColor(value) }}
    >
      {value}
    </span>
  );
}
