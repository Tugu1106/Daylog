// Pure computations over one day's logs. Shared by the Today view and All days cards.
import type { Action, PainLevel } from "@/lib/database.types";

export type Span = { startMs: number; endMs: number };

export type ClippedAction = Action & {
  /** Visible part of the action inside the day. */
  from: number;
  to: number;
  active: boolean;
};

const ts = (iso: string) => new Date(iso).getTime();

/** Clip actions to the day; running actions extend to `now` (or the day end). */
export function clipActions(actions: Action[], day: Span, now: number): ClippedAction[] {
  const limit = Math.min(day.endMs, Math.max(now, day.startMs));
  return actions
    .map((a) => {
      const start = ts(a.started_at);
      const end = a.ended_at ? ts(a.ended_at) : Math.max(start, limit);
      return {
        ...a,
        active: a.ended_at === null,
        from: Math.max(start, day.startMs),
        to: Math.min(end, day.endMs),
      };
    })
    .filter((a) => a.to > a.from || (a.active && a.from <= day.endMs))
    .sort((a, b) => a.from - b.from);
}

/** Greedy lane packing so overlapping actions stack instead of covering each other. */
export function packLanes<T extends { from: number; to: number }>(items: T[], minLanes = 1) {
  const lanes: T[][] = [];
  const laneEnds: number[] = [];
  for (const item of items) {
    const i = laneEnds.findIndex((end) => end <= item.from);
    if (i === -1) {
      lanes.push([item]);
      laneEnds.push(item.to);
    } else {
      lanes[i].push(item);
      laneEnds[i] = item.to;
    }
  }
  while (lanes.length < minLanes) lanes.push([]);
  return lanes;
}

export type PainPoint = { at: number; level: number; id: string | null };

/**
 * Step series for the pain line inside the day. `levels` must be ascending and may
 * include one reading before the day (carried over into 00:00).
 */
export function painSeries(levels: Pick<PainLevel, "id" | "recorded_at" | "level">[], day: Span) {
  const points: PainPoint[] = [];
  let carry: number | null = null;
  for (const l of levels) {
    const at = ts(l.recorded_at);
    if (at < day.startMs) carry = l.level;
    else if (at < day.endMs) points.push({ at, level: l.level, id: l.id });
  }
  if (carry !== null) points.unshift({ at: day.startMs, level: carry, id: null });
  return points;
}

/** Time-weighted pain over the covered part of the day, plus min/max. */
export function painStats(points: PainPoint[], untilMs: number) {
  if (points.length === 0) return null;
  let area = 0;
  let span = 0;
  for (let i = 0; i < points.length; i++) {
    const end = Math.min(points[i + 1]?.at ?? untilMs, untilMs);
    const dur = Math.max(0, end - points[i].at);
    area += points[i].level * dur;
    span += dur;
  }
  const levels = points.map((p) => p.level);
  const avg = span > 0 ? area / span : levels.reduce((a, b) => a + b, 0) / levels.length;
  return {
    avg: Math.round(avg * 10) / 10,
    min: Math.min(...levels),
    max: Math.max(...levels),
    last: levels.at(-1)!,
    readings: points.filter((p) => p.id !== null).length,
  };
}

export function totalMinutes(actions: ClippedAction[], pred: (a: ClippedAction) => boolean) {
  return actions.filter(pred).reduce((sum, a) => sum + (a.to - a.from) / 60000, 0);
}

/** Minutes per action name, largest first. */
export function minutesByName(actions: ClippedAction[]) {
  const map = new Map<string, { name: string; color: string; minutes: number; count: number }>();
  for (const a of actions) {
    const cur = map.get(a.name) ?? { name: a.name, color: a.color, minutes: 0, count: 0 };
    cur.minutes += (a.to - a.from) / 60000;
    cur.count += 1;
    map.set(a.name, cur);
  }
  return [...map.values()].sort((a, b) => b.minutes - a.minutes);
}

export function pct(ms: number, day: Span) {
  return ((ms - day.startMs) / (day.endMs - day.startMs)) * 100;
}
