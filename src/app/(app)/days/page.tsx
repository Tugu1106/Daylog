import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getTz, requestNow } from "@/lib/tz";
import { addDays, dayBoundsMs, formatDay, formatDuration, formatTime, localDay } from "@/lib/time";
import {
  clipActions,
  minutesByName,
  painSeries,
  painStats,
  pct,
  totalMinutes,
  type ClippedAction,
  type PainPoint,
  type Span,
} from "@/lib/day";
import { ACTIVE_CATEGORIES, SEDENTARY_CATEGORIES } from "@/lib/categories";
import type { PainEvent } from "@/lib/database.types";
import { PainBadge } from "@/components/pain-badge";

const RANGES = [7, 30, 90] as const;

export default async function AllDaysPage({ searchParams }: PageProps<"/days">) {
  const { range: rangeParam } = await searchParams;
  const range = RANGES.find((r) => String(r) === rangeParam) ?? 30;

  const tz = await getTz();
  const now = await requestNow();
  const today = localDay(tz, new Date(now));
  const firstDay = addDays(today, -(range - 1));
  const rangeStart = new Date(dayBoundsMs(tz, firstDay).start).toISOString();
  const rangeEnd = new Date(dayBoundsMs(tz, today).end).toISOString();

  const supabase = await createClient();
  const [actions, levels, carry, events, types] = await Promise.all([
    supabase
      .from("actions")
      .select("*")
      .lt("started_at", rangeEnd)
      .or(`ended_at.is.null,ended_at.gt.${rangeStart}`)
      .order("started_at"),
    supabase
      .from("pain_levels")
      .select("id, recorded_at, level")
      .gte("recorded_at", rangeStart)
      .lt("recorded_at", rangeEnd)
      .order("recorded_at"),
    supabase
      .from("pain_levels")
      .select("id, recorded_at, level")
      .lt("recorded_at", rangeStart)
      .order("recorded_at", { ascending: false })
      .limit(1),
    supabase
      .from("pain_events")
      .select("*")
      .gte("occurred_at", rangeStart)
      .lt("occurred_at", rangeEnd)
      .order("occurred_at"),
    supabase.from("action_types").select("id, emoji"),
  ]);

  const allLevels = [...(carry.data ?? []), ...(levels.data ?? [])];
  const emoji = new Map((types.data ?? []).map((t) => [t.id, t.emoji]));

  const days = Array.from({ length: range }, (_, i) => addDays(today, -i)).map((day) => {
    const { start, end } = dayBoundsMs(tz, day);
    const span = { startMs: start, endMs: end };
    const until = Math.min(end, now);
    const dayActions = clipActions(actions.data ?? [], span, now);
    const points = painSeries(allLevels, span);
    const hasOwnReadings = points.some((p) => p.id !== null);
    const dayEvents = (events.data ?? []).filter((e) => {
      const t = new Date(e.occurred_at).getTime();
      return t >= start && t < end;
    });
    return {
      day,
      span,
      actions: dayActions,
      points,
      events: dayEvents,
      stats: painStats(points, until),
      until,
      empty: dayActions.length === 0 && dayEvents.length === 0 && !hasOwnReadings,
    };
  });

  const visible = days.filter((d) => !d.empty || d.day === today);

  return (
    <div className="mx-auto w-full max-w-[1600px] px-3 py-5 sm:px-5">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">All days</h1>
          <p className="text-sm text-muted">
            {visible.length} logged day{visible.length === 1 ? "" : "s"} in the last {range} days
          </p>
        </div>
        <div className="flex gap-1 rounded-full bg-surface-2 p-1">
          {RANGES.map((r) => (
            <Link
              key={r}
              href={`/days?range=${r}`}
              className={`rounded-full px-3 py-1 text-sm ${r === range ? "bg-surface shadow-sm" : "text-muted"}`}
            >
              {r}d
            </Link>
          ))}
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {visible.map((d) => (
          <DayCard
            key={d.day}
            tz={tz}
            isToday={d.day === today}
            emojiFor={(id) => (id ? emoji.get(id) ?? null : null)}
            {...d}
          />
        ))}
      </div>
    </div>
  );
}

function DayCard({
  tz,
  day,
  span,
  actions,
  points,
  events,
  stats,
  until,
  isToday,
  emojiFor,
}: {
  tz: string;
  day: string;
  span: Span;
  actions: ClippedAction[];
  points: PainPoint[];
  events: PainEvent[];
  stats: ReturnType<typeof painStats>;
  until: number;
  isToday: boolean;
  emojiFor: (id: string | null) => string | null;
}) {
  const sleep = totalMinutes(actions, (a) => a.category === "sleep");
  const active = totalMinutes(actions, (a) => ACTIVE_CATEGORIES.has(a.category));
  const sedentary = totalMinutes(actions, (a) => SEDENTARY_CATEGORIES.has(a.category));
  const byName = minutesByName(actions);
  const eventCounts = new Map<string, { name: string; color: string; count: number; max: number | null }>();
  for (const e of events) {
    const cur = eventCounts.get(e.name) ?? { name: e.name, color: e.color, count: 0, max: null };
    cur.count += 1;
    if (e.intensity !== null) cur.max = Math.max(cur.max ?? 0, e.intensity);
    eventCounts.set(e.name, cur);
  }

  return (
    <Link
      href={isToday ? "/" : `/day/${day}`}
      className="card flex flex-col gap-3 transition hover:border-accent/60 hover:shadow-sm"
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-semibold">
            {formatDay(day)}
            {isToday && (
              <span className="ml-2 rounded-full bg-accent px-2 py-0.5 text-[10px] font-semibold text-(--accent-ink) uppercase">
                Today
              </span>
            )}
          </p>
          <p className="text-xs text-muted">
            {actions.length} action{actions.length === 1 ? "" : "s"} · {events.length} pain event
            {events.length === 1 ? "" : "s"}
          </p>
        </div>
        {stats && (
          <div className="flex items-center gap-2 text-right">
            <div className="text-[10px] leading-tight text-muted">
              avg
              <br />
              max {stats.max}
            </div>
            <PainBadge value={Math.round(stats.avg)} size="lg" />
          </div>
        )}
      </div>

      <MiniTimeline span={span} actions={actions} points={points} events={events} until={until} />

      <div className="grid grid-cols-3 gap-2 text-center">
        <Metric label="Sleep" minutes={sleep} />
        <Metric label="Active" minutes={active} />
        <Metric label="Sitting" minutes={sedentary} />
      </div>

      {byName.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {byName.slice(0, 6).map((a) => (
            <span key={a.name} className="flex items-center gap-1.5 rounded-full bg-surface-2 px-2 py-0.5 text-xs">
              <span className="h-2 w-2 rounded-sm" style={{ background: a.color }} />
              {a.name} {formatDuration(a.minutes * 60000)}
              {a.count > 1 && <span className="text-muted">×{a.count}</span>}
            </span>
          ))}
        </div>
      )}

      {eventCounts.size > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {[...eventCounts.values()].map((e) => (
            <span key={e.name} className="flex items-center gap-1.5 rounded-full border border-line px-2 py-0.5 text-xs">
              <span className="h-2 w-2 rounded-full" style={{ background: e.color }} />
              {e.name} ×{e.count}
              {e.max !== null && <span className="text-muted">max {e.max}</span>}
            </span>
          ))}
        </div>
      )}

      {actions.length > 0 && (
        <ul className="flex flex-col gap-0.5 border-t border-line pt-2 text-xs">
          {actions.slice(0, 8).map((a) => (
            <li key={a.id} className="flex gap-2">
              <span className="w-[5.5rem] shrink-0 text-muted tabular-nums">
                {formatTime(tz, a.from)}–{a.active ? "now" : formatTime(tz, a.to)}
              </span>
              <span className="truncate">
                {emojiFor(a.type_id)} {a.name}
              </span>
              <span className="ml-auto text-muted tabular-nums">{formatDuration(a.to - a.from)}</span>
            </li>
          ))}
          {actions.length > 8 && <li className="text-muted">+{actions.length - 8} more</li>}
        </ul>
      )}
    </Link>
  );
}

function Metric({ label, minutes }: { label: string; minutes: number }) {
  const value = minutes >= 1 ? formatDuration(minutes * 60000) : "–";
  return (
    <div className="rounded-xl bg-surface-2 px-2 py-1.5">
      <p className="text-[10px] tracking-wider text-muted uppercase">{label}</p>
      <p className="text-sm font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function MiniTimeline({
  span,
  actions,
  points,
  events,
  until,
}: {
  span: Span;
  actions: ClippedAction[];
  points: PainPoint[];
  events: PainEvent[];
  until: number;
}) {
  const X = (ms: number) => pct(ms, span) * 10;
  const Y = (l: number) => 28 - l * 2.6;
  let path = "";
  if (points.length > 0) {
    path = `M ${X(points[0].at)} ${Y(points[0].level)}`;
    for (const p of points.slice(1)) path += ` H ${X(p.at)} V ${Y(p.level)}`;
    path += ` H ${X(Math.max(until, points.at(-1)!.at))}`;
  }
  return (
    <div className="relative">
      <div className="relative h-4 overflow-hidden rounded-md bg-surface-2">
        {actions.map((a) => (
          <span
            key={a.id}
            className="absolute inset-y-0"
            style={{
              left: `${pct(a.from, span)}%`,
              width: `${Math.max(pct(a.to, span) - pct(a.from, span), 0.4)}%`,
              background: a.color,
            }}
          />
        ))}
      </div>
      <div className="relative mt-1 h-8">
        <svg viewBox="0 0 1000 30" preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-hidden>
          {[6, 12, 18].map((h) => (
            <line key={h} x1={(h / 24) * 1000} x2={(h / 24) * 1000} y1="0" y2="30" stroke="var(--line)" vectorEffect="non-scaling-stroke" />
          ))}
          {path && <path d={path} fill="none" stroke="var(--pain-high)" strokeWidth="2" vectorEffect="non-scaling-stroke" />}
        </svg>
        {events.map((e) => (
          <span
            key={e.id}
            className="absolute top-0 h-2 w-2 -translate-x-1/2 rounded-full"
            style={{ left: `${pct(new Date(e.occurred_at).getTime(), span)}%`, background: e.color }}
          />
        ))}
      </div>
      <div className="flex justify-between text-[9px] text-muted tabular-nums">
        <span>00</span>
        <span>06</span>
        <span>12</span>
        <span>18</span>
        <span>24</span>
      </div>
    </div>
  );
}
