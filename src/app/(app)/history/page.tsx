import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { addDays, dayBounds, formatDay, localDay } from "@/lib/time";
import { Timeline, toTimeline, type TimelineItem } from "@/components/timeline";
import { PageHeader } from "@/components/page-header";
import { PainBadge } from "@/components/pain-badge";
import type { Tables } from "@/lib/database.types";

const RANGES = [7, 14, 30, 90];

export default async function HistoryPage({ searchParams }: PageProps<"/history">) {
  const { days: daysParam } = await searchParams;
  const days = RANGES.includes(Number(daysParam)) ? Number(daysParam) : 14;

  const today = localDay();
  const firstDay = addDays(today, -(days - 1));
  const { start } = dayBounds(firstDay);
  const { end } = dayBounds(today);

  const supabase = await createClient();
  const [pains, activities, checkins] = await Promise.all([
    supabase.from("pain_logs").select("*").gte("logged_at", start).lt("logged_at", end),
    supabase.from("activity_logs").select("*").gte("started_at", start).lt("started_at", end),
    supabase.from("daily_checkins").select("*").gte("day", firstDay).lte("day", today),
  ]);

  const byDay = new Map<string, TimelineItem[]>();
  for (const item of toTimeline(pains.data ?? [], activities.data ?? [])) {
    const d = localDay(new Date(item.at));
    byDay.set(d, [...(byDay.get(d) ?? []), item]);
  }
  const checkinByDay = new Map((checkins.data ?? []).map((c) => [c.day, c]));
  const allDays = Array.from({ length: days }, (_, i) => addDays(today, -i)).filter(
    (d) => byDay.has(d) || checkinByDay.has(d),
  );

  return (
    <>
      <PageHeader title="History" />
      <div className="mb-5 flex gap-2">
        {RANGES.map((r) => (
          <Link key={r} href={`/history?days=${r}`} className={`chip ${r === days ? "chip-on" : ""}`}>
            {r}d
          </Link>
        ))}
      </div>

      {allDays.length === 0 && (
        <p className="py-10 text-center text-sm text-muted">No entries in the last {days} days.</p>
      )}

      <div className="flex flex-col gap-6">
        {allDays.map((d) => (
          <section key={d} className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between">
              <h2 className="section-title">{formatDay(d)}</h2>
              <Link href={`/checkin?day=${d}`} className="text-xs text-accent">
                {checkinByDay.has(d) ? "Edit check-in" : "Add check-in"}
              </Link>
            </div>
            {checkinByDay.has(d) && <CheckinSummary c={checkinByDay.get(d)!} />}
            {byDay.has(d) && <Timeline items={byDay.get(d)!} />}
          </section>
        ))}
      </div>
    </>
  );
}

function CheckinSummary({ c }: { c: Tables<"daily_checkins"> }) {
  const bits = [
    c.sleep_hours != null && `😴 ${c.sleep_hours}h`,
    c.sleep_quality != null && `sleep ${c.sleep_quality}/5`,
    c.stress != null && `stress ${c.stress}/5`,
    c.mood != null && `mood ${c.mood}/5`,
    c.sitting_hours != null && `🪑 ${c.sitting_hours}h`,
    c.steps != null && `👣 ${c.steps.toLocaleString()}`,
  ].filter(Boolean);
  return (
    <div className="rounded-2xl bg-surface-2 p-3 text-sm">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        {c.overall_pain != null && (
          <span className="flex items-center gap-1.5">
            <PainBadge value={c.overall_pain} /> overall
          </span>
        )}
        {c.morning_stiffness != null && (
          <span className="flex items-center gap-1.5">
            <PainBadge value={c.morning_stiffness} /> stiffness
          </span>
        )}
        {bits.map((b) => (
          <span key={String(b)} className="text-muted">
            {b}
          </span>
        ))}
      </div>
      {c.notes && <p className="mt-1">{c.notes}</p>}
    </div>
  );
}
