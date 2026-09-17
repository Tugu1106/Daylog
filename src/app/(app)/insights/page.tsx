import { createClient } from "@/lib/supabase/server";
import { addDays, dayBounds, formatDay, localDay } from "@/lib/time";
import { categoryMeta } from "@/lib/constants";
import { PageHeader } from "@/components/page-header";
import { painColor } from "@/components/pain-badge";

const TREND_DAYS = 30;

export default async function InsightsPage() {
  const today = localDay();
  const firstDay = addDays(today, -(TREND_DAYS - 1));
  const supabase = await createClient();

  const [effectiveness, pains, checkins] = await Promise.all([
    supabase.from("activity_effectiveness").select("*").order("avg_pain_change", { ascending: true }),
    supabase
      .from("pain_logs")
      .select("logged_at, intensity")
      .gte("logged_at", dayBounds(firstDay).start),
    supabase.from("daily_checkins").select("day, overall_pain").gte("day", firstDay),
  ]);

  // Daily pain = check-in overall pain if present, else average of that day's pain logs.
  const logsByDay = new Map<string, number[]>();
  for (const p of pains.data ?? []) {
    const d = localDay(new Date(p.logged_at));
    logsByDay.set(d, [...(logsByDay.get(d) ?? []), p.intensity]);
  }
  const checkinByDay = new Map((checkins.data ?? []).map((c) => [c.day, c.overall_pain]));
  const trend = Array.from({ length: TREND_DAYS }, (_, i) => {
    const d = addDays(firstDay, i);
    const logs = logsByDay.get(d);
    const value =
      checkinByDay.get(d) ?? (logs ? logs.reduce((a, b) => a + b, 0) / logs.length : null);
    return { day: d, value };
  });
  const rated = (effectiveness.data ?? []).filter((r) => r.avg_pain_change !== null);
  const unrated = (effectiveness.data ?? []).filter((r) => r.avg_pain_change === null);

  return (
    <>
      <PageHeader title="Insights" sub="What moves your pain — up or down." />

      <section className="card mb-6">
        <h2 className="section-title mb-3">Daily pain · last {TREND_DAYS} days</h2>
        <div className="flex h-32 items-end gap-[3px]">
          {trend.map((t) => (
            <div
              key={t.day}
              title={`${formatDay(t.day)}: ${t.value === null ? "no data" : t.value.toFixed(1)}`}
              className="flex-1 rounded-t-sm"
              style={{
                height: t.value === null ? "3px" : `${Math.max(6, (t.value / 10) * 100)}%`,
                background: t.value === null ? "var(--line)" : painColor(Math.round(t.value)),
              }}
            />
          ))}
        </div>
        <div className="mt-2 flex justify-between text-xs text-muted">
          <span>{formatDay(firstDay)}</span>
          <span>Today</span>
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="section-title">Pain change per activity</h2>
        <p className="text-xs text-muted">
          Average of (pain after − pain before). Negative = it helps. Log pain before/after to fill
          this in.
        </p>
        {rated.length === 0 && (
          <p className="py-6 text-center text-sm text-muted">
            No activities with before/after pain yet.
          </p>
        )}
        {rated.map((r) => {
          const change = Number(r.avg_pain_change);
          const next = r.avg_next_day_change === null ? null : Number(r.avg_next_day_change);
          return (
            <div key={r.activity_key} className="card flex items-center gap-3 p-3">
              <span aria-hidden className="text-xl">
                {categoryMeta(r.category ?? "other").emoji}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{r.name}</p>
                <p className="text-xs text-muted">
                  {r.sessions} session{r.sessions === 1 ? "" : "s"}
                  {r.avg_duration_min !== null && ` · ~${r.avg_duration_min} min`}
                  {next !== null && ` · next day ${next > 0 ? "+" : ""}${next}`}
                </p>
              </div>
              <span
                className="rounded-lg px-2 py-1 text-sm font-semibold tabular-nums"
                style={{
                  color: change < 0 ? "var(--pain-low)" : change > 0 ? "var(--pain-max)" : "var(--muted)",
                  background: "var(--surface-2)",
                }}
              >
                {change > 0 ? "+" : ""}
                {change.toFixed(1)}
              </span>
            </div>
          );
        })}
        {unrated.length > 0 && (
          <p className="text-xs text-muted">
            Also logged without before/after pain: {unrated.map((r) => r.name).join(", ")}
          </p>
        )}
      </section>
    </>
  );
}
