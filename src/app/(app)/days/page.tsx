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
import type { PainEvent } from "@/lib/database.types";
import { PainBadge, painColor } from "@/components/pain-badge";
import { ScrollEnd } from "./scroll-end";

// 7d → seven detail columns · 30d → one calendar · 90d → three month calendars.
const RANGES = [7, 30, 90] as const;
type Range = (typeof RANGES)[number];

const COLUMN = { header: "h-11", strip: 240, minCol: "7.5rem" };
/** Monday-first weekday initials. */
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

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

/** Monday = 0 … Sunday = 6 */
function weekdayIndex(day: string) {
  const [y, m, d] = day.split("-").map(Number);
  return (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
}

function dayNumber(day: string) {
  return Number(day.slice(8, 10));
}

export default async function AllDaysPage({ searchParams }: PageProps<"/days">) {
  const { range: rangeParam } = await searchParams;
  const range: Range = RANGES.find((r) => String(r) === rangeParam) ?? 30;

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

  const byDay = new Map(days.map((d) => [d.day, d]));
  const logged = days.filter((d) => !d.empty);
  const withPain = days.filter((d) => d.stats);
  const rangeAvg = withPain.length
    ? Math.round((withPain.reduce((s, d) => s + d.stats!.avg, 0) / withPain.length) * 10) / 10
    : null;

  // 90d: three cards of 30 days, oldest first.
  const chunks = range === 90 ? [0, 30, 60].map((i) => days.slice(i, i + 30)) : [];

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

      {range === 7 && <WeekColumns days={days} tz={tz} today={today} now={now} />}

      {range === 30 && (
        <div className="card p-3">
          <Calendar from={firstDay} to={today} byDay={byDay} today={today} now={now} size="lg" />
        </div>
      )}

      {range === 90 && (
        <div className="flex gap-3 overflow-x-auto pb-1 lg:grid lg:grid-cols-3 lg:overflow-visible">
          {chunks.map((chunk) => (
            <section key={chunk[0].day} className="card min-w-[17rem] flex-1 p-3">
              <h2 className="mb-2 text-sm font-semibold">
                {formatDay(chunk[0].day, { weekday: undefined })} – {formatDay(chunk.at(-1)!.day, { weekday: undefined })}
              </h2>
              <Calendar
                from={chunk[0].day}
                to={chunk.at(-1)!.day}
                byDay={byDay}
                today={today}
                now={now}
                size="sm"
              />
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function Legend() {
  return (
    <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted">
      <span className="flex items-center gap-1.5">
        <span className="h-2 w-4 rounded-sm bg-accent" /> actions across 00 → 24
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-2 w-4 rounded-sm bg-linear-to-r from-(--pain-low) to-(--pain-max)" /> pain level
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full border border-surface bg-(--pain-max)" /> pain event
      </span>
      <span>hover a day for its summary</span>
    </div>
  );
}

/** Month-style grid: seven weekday columns, one row per week. */
function Calendar({
  from,
  to,
  byDay,
  today,
  now,
  size,
}: {
  from: string;
  to: string;
  byDay: Map<string, DayInfo>;
  today: string;
  now: number;
  size: "lg" | "sm";
}) {
  const lead = weekdayIndex(from);
  const cells: (string | null)[] = Array.from({ length: lead }, () => null);
  for (let day = from; day <= to; day = addDays(day, 1)) cells.push(day);
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div>
      <div className="mb-1 grid grid-cols-7 gap-1">
        {WEEKDAYS.map((w) => (
          <span key={w} className="text-center text-[10px] font-semibold tracking-wider text-muted uppercase">
            {size === "lg" ? w : w[0]}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, i) =>
          day === null ? (
            <span key={`pad-${i}`} />
          ) : (
            <DayCell
              key={day}
              day={day}
              info={byDay.get(day)}
              isToday={day === today}
              isFuture={day > today}
              now={now}
              size={size}
            />
          ),
        )}
      </div>
    </div>
  );
}

function summary(info: DayInfo) {
  const { actions, events, stats } = info;
  const dur = (m: number) => (m >= 1 ? formatDuration(m * 60000) : "–");
  // Your own activities, longest first — no fixed categories.
  const byName = minutesByName(actions);
  const logged = totalMinutes(actions, () => true);
  const title = [
    formatDay(info.day),
    stats ? `pain avg ${stats.avg} (max ${stats.max})` : "no pain readings",
    `logged ${dur(logged)}`,
    `${events.length} pain event${events.length === 1 ? "" : "s"}`,
    ...byName.map((a) => `• ${a.name} ${dur(a.minutes)}`),
  ].join("\n");
  return { byName, logged, dur, title };
}

/** One calendar square: date, a 24h action strip and the pain bar under it. */
function DayCell({
  day,
  info,
  isToday,
  isFuture,
  now,
  size,
}: {
  day: string;
  info: DayInfo | undefined;
  isToday: boolean;
  isFuture: boolean;
  now: number;
  size: "lg" | "sm";
}) {
  const big = size === "lg";
  const shell = `flex flex-col rounded-lg border p-1 ${big ? "min-h-20" : "min-h-12"}`;

  if (!info || isFuture) {
    return (
      <div className={`${shell} border-line/60 bg-surface-2/30`}>
        <span className="text-[10px] text-muted/60 tabular-nums">{dayNumber(day)}</span>
      </div>
    );
  }

  const s = summary(info);
  const { span, actions, points, events, stats, until } = info;

  return (
    <Link
      href={isToday ? "/" : `/day/${day}`}
      title={s.title}
      className={`${shell} gap-1 transition hover:border-accent/60 hover:bg-surface-2/60 ${
        isToday ? "border-accent bg-accent/5" : "border-line"
      } ${info.empty ? "opacity-60" : ""}`}
    >
      <div className="flex items-baseline justify-between gap-1">
        <span className={`tabular-nums ${isToday ? "font-bold text-accent" : "font-semibold"} ${big ? "text-xs" : "text-[10px]"}`}>
          {dayNumber(day)}
        </span>
        {stats &&
          (big ? (
            <PainBadge value={Math.round(stats.avg)} />
          ) : (
            <span className="h-2 w-2 rounded-full" style={{ background: painColor(Math.round(stats.avg)) }} />
          ))}
      </div>

      {/* actions across the day */}
      <div className={`relative overflow-hidden rounded-sm bg-surface-2 ${big ? "h-3" : "h-1.5"}`}>
        {isToday && (
          <span
            aria-hidden
            className="absolute inset-y-0 z-10 w-px bg-(--pain-max)"
            style={{ left: `${pct(now, span)}%` }}
          />
        )}
        {packLanes(actions).slice(0, big ? 2 : 1).map((lane, i) => (
          <div key={i} className="absolute inset-x-0" style={{ top: `${i * 50}%`, height: big && actions.length ? "50%" : "100%" }}>
            {lane.map((a) => (
              <span
                key={a.id}
                className="absolute inset-y-0"
                style={{
                  left: `${pct(a.from, span)}%`,
                  width: `max(${pct(a.to, span) - pct(a.from, span)}%, 2px)`,
                  background: a.color,
                }}
              />
            ))}
          </div>
        ))}
      </div>

      {/* pain level across the day */}
      <div className={`relative overflow-hidden rounded-sm bg-surface-2 ${big ? "h-2" : "h-1"}`}>
        {points.map((p, i) => {
          const end = Math.min(points[i + 1]?.at ?? until, until);
          if (end <= p.at) return null;
          return (
            <span
              key={p.id ?? `carry-${i}`}
              className="absolute inset-y-0"
              style={{
                left: `${pct(p.at, span)}%`,
                width: `${pct(end, span) - pct(p.at, span)}%`,
                background: painColor(p.level),
              }}
            />
          );
        })}
        {events.map((e) => (
          <span
            key={e.id}
            className="absolute top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-1 ring-surface"
            style={{ left: `${pct(new Date(e.occurred_at).getTime(), span)}%`, background: e.color }}
          />
        ))}
      </div>

      {big && (
        <p className="mt-auto truncate text-[10px] text-muted">
          {info.empty
            ? "—"
            : s.byName
                .slice(0, 2)
                .map((a) => `${a.name} ${s.dur(a.minutes)}`)
                .join(" · ")}
        </p>
      )}
    </Link>
  );
}

/** The 7-day view keeps the tall per-day columns. */
function WeekColumns({ days, tz, today, now }: { days: DayInfo[]; tz: string; today: string; now: number }) {
  return (
    <ScrollEnd className="py-1 pr-1">
      <div className="flex gap-1.5" style={{ minWidth: "min-content" }}>
        <HourAxis />
        <div
          className="grid flex-1 gap-1"
          style={{ gridTemplateColumns: `repeat(7, minmax(${COLUMN.minCol}, 1fr))` }}
        >
          {days.map((d) => (
            <DayColumn key={d.day} info={d} isToday={d.day === today} now={now} tz={tz} />
          ))}
        </div>
      </div>
    </ScrollEnd>
  );
}

function HourAxis() {
  return (
    <div className="sticky left-0 z-10 w-6 shrink-0 bg-paper pt-0.5 text-[9px] text-muted tabular-nums">
      <div className={COLUMN.header} />
      <div className="relative" style={{ height: COLUMN.strip }}>
        {[0, 6, 12, 18, 24].map((h) => (
          <span key={h} className="absolute right-0 -translate-y-1/2 leading-none" style={{ top: `${(h / 24) * 100}%` }}>
            {String(h).padStart(2, "0")}
          </span>
        ))}
      </div>
    </div>
  );
}

function DayColumn({ info, isToday, now }: { info: DayInfo; isToday: boolean; now: number; tz: string }) {
  const { day, span, until, actions, points, events, stats, empty } = info;
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
      <div className={`${COLUMN.header} flex flex-col items-center justify-center leading-none`}>
        <div className="flex w-full items-center justify-between px-1">
          <div>
            <p className={`text-[11px] ${weekend ? "text-accent" : "text-muted"}`}>{weekday}</p>
            <p className="text-sm font-semibold">
              {d} {month}
            </p>
          </div>
          {stats ? <PainBadge value={Math.round(stats.avg)} /> : null}
        </div>
      </div>

      <div
        className={`relative flex gap-px overflow-hidden rounded-md border border-line ${
          empty ? "bg-surface-2/40" : "bg-surface"
        }`}
        style={{ height: COLUMN.strip }}
      >
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

      <div className="mt-2 flex flex-col gap-1.5 px-1 text-[11px]">
        <div className="grid grid-cols-2 gap-1 text-center">
          <Metric label="Logged" value={s.dur(s.logged)} />
          <Metric label="Actions" value={String(actions.length)} />
        </div>
        {stats && (
          <p className="text-muted">
            pain avg <b className="text-ink">{stats.avg}</b> · max <b className="text-ink">{stats.max}</b>
          </p>
        )}
        {s.byName
          .slice(0, 5)
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
