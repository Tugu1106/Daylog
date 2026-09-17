import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getTz, requestNow } from "@/lib/tz";
import { addDays, dayBoundsMs, formatDay, formatDuration, localDay } from "@/lib/time";
import {
  clipActions,
  minutesByName,
  packLanes,
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
import { PainBadge, painColor } from "@/components/pain-badge";
import { ScrollEnd } from "./scroll-end";

// 7d → one row of 7 · 30d → one row of 30 · 90d → three rows of 30.
const LAYOUTS = {
  7: { perRow: 7, size: "lg" },
  30: { perRow: 30, size: "md" },
  90: { perRow: 30, size: "sm" },
} as const;
type Range = keyof typeof LAYOUTS;
type Size = (typeof LAYOUTS)[Range]["size"];
const RANGES = Object.keys(LAYOUTS).map(Number) as Range[];

const SIZES: Record<Size, { header: string; strip: number; minCol: string }> = {
  lg: { header: "h-11", strip: 240, minCol: "7.5rem" },
  md: { header: "h-10", strip: 200, minCol: "1.75rem" },
  sm: { header: "h-8", strip: 96, minCol: "1.75rem" },
};

type DayInfo = {
  day: string;
  span: Span;
  until: number;
  actions: ClippedAction[];
  points: PainPoint[];
  events: PainEvent[];
  stats: ReturnType<typeof painStats>;
  empty: boolean;
};

export default async function AllDaysPage({ searchParams }: PageProps<"/days">) {
  const { range: rangeParam } = await searchParams;
  const range = RANGES.find((r) => String(r) === rangeParam) ?? 30;
  const { perRow, size } = LAYOUTS[range];

  const tz = await getTz();
  const now = await requestNow();
  const today = localDay(tz, new Date(now));
  const firstDay = addDays(today, -(range - 1));
  const rangeStart = new Date(dayBoundsMs(tz, firstDay).start).toISOString();
  const rangeEnd = new Date(dayBoundsMs(tz, today).end).toISOString();

  const supabase = await createClient();
  const [actions, levels, carry, events] = await Promise.all([
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
  ]);

  const allLevels = [...(carry.data ?? []), ...(levels.data ?? [])];

  // Oldest → newest, like a calendar.
  const days: DayInfo[] = Array.from({ length: range }, (_, i) => addDays(firstDay, i)).map((day) => {
    const { start, end } = dayBoundsMs(tz, day);
    const span = { startMs: start, endMs: end };
    const until = Math.min(end, now);
    const dayActions = clipActions(actions.data ?? [], span, now);
    const points = painSeries(allLevels, span);
    const dayEvents = (events.data ?? []).filter((e) => {
      const t = new Date(e.occurred_at).getTime();
      return t >= start && t < end;
    });
    return {
      day,
      span,
      until,
      actions: dayActions,
      points,
      events: dayEvents,
      stats: painStats(points, until),
      empty: dayActions.length === 0 && dayEvents.length === 0 && !points.some((p) => p.id !== null),
    };
  });

  const rows = Array.from({ length: Math.ceil(days.length / perRow) }, (_, r) =>
    days.slice(r * perRow, (r + 1) * perRow),
  );
  const logged = days.filter((d) => !d.empty);
  const withPain = days.filter((d) => d.stats);
  const rangeAvg = withPain.length
    ? Math.round((withPain.reduce((s, d) => s + d.stats!.avg, 0) / withPain.length) * 10) / 10
    : null;

  return (
    <div className="mx-auto w-full max-w-[1600px] px-3 py-5 sm:px-5">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">All days</h1>
          <p className="text-sm text-muted">
            {logged.length} of {range} days logged
            {rangeAvg !== null && ` · average pain ${rangeAvg}`}
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

      <Legend />

      <div className="flex flex-col gap-4">
        {rows.map((row) => (
          <section key={row[0].day}>
            {rows.length > 1 && (
              <p className="mb-0.5 pl-9 text-xs font-medium text-muted">
                {formatDay(row[0].day, { weekday: undefined })} – {formatDay(row.at(-1)!.day, { weekday: undefined })}
              </p>
            )}
            <ScrollEnd className="py-1 pr-1">
              <div className="flex gap-1.5" style={{ minWidth: "min-content" }}>
                <HourAxis size={size} />
                <div
                  className="grid flex-1 gap-1"
                  style={{ gridTemplateColumns: `repeat(${perRow}, minmax(${SIZES[size].minCol}, 1fr))` }}
                >
                  {row.map((d) => (
                    <DayColumn key={d.day} info={d} size={size} isToday={d.day === today} now={now} />
                  ))}
                </div>
              </div>
            </ScrollEnd>
          </section>
        ))}
      </div>
    </div>
  );
}

function Legend() {
  return (
    <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted">
      <span className="flex items-center gap-1.5">
        <span className="h-3 w-2 rounded-sm bg-accent" /> actions (left)
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-3 w-2 rounded-sm bg-linear-to-b from-(--pain-low) to-(--pain-max)" /> pain level (right)
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full border border-surface bg-(--pain-max)" /> pain event
      </span>
      <span>top = 00:00 · bottom = 24:00 · hover a day for its summary</span>
    </div>
  );
}

function HourAxis({ size }: { size: Size }) {
  const { header, strip } = SIZES[size];
  const marks = size === "sm" ? [0, 12, 24] : [0, 6, 12, 18, 24];
  return (
    <div className="sticky left-0 z-10 w-6 shrink-0 bg-paper pt-0.5 text-[9px] text-muted tabular-nums">
      <div className={header} />
      <div className="relative" style={{ height: strip }}>
        {marks.map((h) => (
          <span
            key={h}
            className="absolute right-0 -translate-y-1/2 leading-none"
            style={{ top: `${(h / 24) * 100}%` }}
          >
            {String(h).padStart(2, "0")}
          </span>
        ))}
      </div>
    </div>
  );
}

function summary(info: DayInfo) {
  const { actions, events, stats } = info;
  const sleep = totalMinutes(actions, (a) => a.category === "sleep");
  const active = totalMinutes(actions, (a) => ACTIVE_CATEGORIES.has(a.category));
  const sitting = totalMinutes(actions, (a) => SEDENTARY_CATEGORIES.has(a.category));
  const dur = (m: number) => (m >= 1 ? formatDuration(m * 60000) : "–");
  const title = [
    formatDay(info.day),
    stats ? `pain avg ${stats.avg} (max ${stats.max})` : "no pain readings",
    `sleep ${dur(sleep)}`,
    `active ${dur(active)}`,
    `sitting ${dur(sitting)}`,
    `${events.length} pain event${events.length === 1 ? "" : "s"}`,
    ...minutesByName(actions).map((a) => `• ${a.name} ${dur(a.minutes)}`),
  ].join("\n");
  return { sleep, active, sitting, dur, title };
}

function DayColumn({ info, size, isToday, now }: { info: DayInfo; size: Size; isToday: boolean; now: number }) {
  const { day, span, until, actions, points, events, stats, empty } = info;
  const { header, strip } = SIZES[size];
  const s = summary(info);
  const [y, m, d] = day.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const weekday = new Intl.DateTimeFormat("en-GB", { weekday: "short", timeZone: "UTC" }).format(date);
  const month = new Intl.DateTimeFormat("en-GB", { month: "short", timeZone: "UTC" }).format(date);
  const weekend = date.getUTCDay() === 0 || date.getUTCDay() === 6;
  const lanes = packLanes(actions);

  return (
    <Link
      href={isToday ? "/" : `/day/${day}`}
      title={s.title}
      className={`group flex min-w-0 flex-col rounded-lg p-0.5 transition hover:bg-surface-2 ${
        isToday ? "ring-2 ring-accent" : ""
      }`}
    >
      {/* header */}
      <div className={`${header} flex flex-col items-center justify-center leading-none`}>
        {size === "lg" ? (
          <div className="flex w-full items-center justify-between px-1">
            <div>
              <p className={`text-[11px] ${weekend ? "text-accent" : "text-muted"}`}>{weekday}</p>
              <p className="text-sm font-semibold">
                {d} {month}
              </p>
            </div>
            {stats ? <PainBadge value={Math.round(stats.avg)} /> : null}
          </div>
        ) : (
          <>
            <span className={`text-[9px] ${weekend ? "text-accent" : "text-muted"}`}>
              {d === 1 ? month : weekday.slice(0, size === "sm" ? 1 : 2)}
            </span>
            <span className={`font-semibold tabular-nums ${size === "sm" ? "text-[11px]" : "text-xs"}`}>{d}</span>
            {size === "md" && (
              <span
                className="mt-0.5 h-1.5 w-full rounded-full"
                style={{ background: stats ? painColor(Math.round(stats.avg)) : "var(--line)" }}
              />
            )}
          </>
        )}
      </div>

      {/* 24h strip: actions | pain */}
      <div
        className={`relative flex gap-px overflow-hidden rounded-md border border-line ${
          empty ? "bg-surface-2/40" : "bg-surface"
        }`}
        style={{ height: strip }}
      >
        {/* 6h guide lines */}
        {[6, 12, 18].map((h) => (
          <span
            key={h}
            aria-hidden
            className="pointer-events-none absolute inset-x-0 border-t border-line/70"
            style={{ top: `${(h / 24) * 100}%` }}
          />
        ))}

        <div className="relative flex flex-3 gap-px">
          {lanes.map((lane, i) => (
            <div key={i} className="relative flex-1">
              {lane.map((a) => (
                <span
                  key={a.id}
                  className={`absolute inset-x-0 rounded-xs ${a.active ? "opacity-70" : ""}`}
                  style={{
                    top: `${pct(a.from, span)}%`,
                    height: `max(${pct(a.to, span) - pct(a.from, span)}%, 1px)`,
                    background: a.color,
                  }}
                />
              ))}
            </div>
          ))}
        </div>

        <div className="relative flex-2">
          {points.map((p, i) => {
            const to = Math.min(points[i + 1]?.at ?? until, until);
            if (to <= p.at) return null;
            return (
              <span
                key={p.id ?? `carry-${i}`}
                className="absolute inset-x-0"
                style={{
                  top: `${pct(p.at, span)}%`,
                  height: `${pct(to, span) - pct(p.at, span)}%`,
                  background: painColor(p.level),
                  opacity: 0.35 + p.level * 0.065,
                }}
              />
            );
          })}
          {events.map((e) => (
            <span
              key={e.id}
              className="absolute left-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-surface"
              style={{ top: `${pct(new Date(e.occurred_at).getTime(), span)}%`, background: e.color }}
            />
          ))}
        </div>

        {isToday && (
          <span
            aria-hidden
            className="pointer-events-none absolute inset-x-0 border-t-2 border-(--pain-max)"
            style={{ top: `${pct(now, span)}%` }}
          />
        )}
      </div>

      {/* details (7-day view only) */}
      {size === "lg" && (
        <div className="mt-2 flex flex-col gap-1.5 px-1 text-[11px]">
          <div className="grid grid-cols-3 gap-1 text-center">
            <Metric label="Sleep" value={s.dur(s.sleep)} />
            <Metric label="Active" value={s.dur(s.active)} />
            <Metric label="Sit" value={s.dur(s.sitting)} />
          </div>
          {stats && (
            <p className="text-muted">
              pain avg <b className="text-ink">{stats.avg}</b> · max <b className="text-ink">{stats.max}</b>
            </p>
          )}
          {minutesByName(actions)
            .slice(0, 4)
            .map((a) => (
              <p key={a.name} className="flex items-center gap-1.5">
                <span className="h-2 w-2 shrink-0 rounded-sm" style={{ background: a.color }} />
                <span className="truncate">{a.name}</span>
                <span className="ml-auto text-muted tabular-nums">{s.dur(a.minutes)}</span>
              </p>
            ))}
          {events.length > 0 && (
            <p className="flex items-center gap-1.5 text-muted">
              <span className="h-2 w-2 shrink-0 rounded-full bg-(--pain-max)" />
              {events.length} pain event{events.length === 1 ? "" : "s"}
            </p>
          )}
          {empty && <p className="text-muted">Nothing logged</p>}
        </div>
      )}
    </Link>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-surface-2 px-1 py-1">
      <p className="text-[9px] tracking-wider text-muted uppercase">{label}</p>
      <p className="text-xs font-semibold tabular-nums">{value}</p>
    </div>
  );
}
