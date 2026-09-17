"use client";

import { useEffect, useRef } from "react";
import type { PainEvent } from "@/lib/database.types";
import { pct, type ClippedAction, type PainPoint, type Span } from "@/lib/day";
import { formatDuration, formatTime } from "@/lib/time";
import { painColor } from "@/components/pain-badge";

export type Target =
  | { kind: "action"; id: string }
  | { kind: "event"; id: string }
  | { kind: "level"; id: string };

export type ContextRequest = { x: number; y: number; at: number; target: Target | null };

export type Zoom = "auto" | "fit" | "zoom";

const LONG_PRESS_MS = 450;
const ZOOM_WIDTH = "1800px";

export function Timeline({
  tz,
  day,
  now,
  lanes,
  events,
  painPoints,
  emojiFor,
  zoom,
  onContext,
  onOpen,
}: {
  tz: string;
  day: Span;
  /** Current time for today; null for past days. */
  now: number | null;
  lanes: ClippedAction[][];
  events: PainEvent[];
  painPoints: PainPoint[];
  emojiFor: (typeId: string | null) => string | null;
  zoom: Zoom;
  onContext: (req: ContextRequest) => void;
  onOpen: (target: Target) => void;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const press = useRef<{ timer: number; x: number; y: number; fired: boolean } | null>(null);
  const lastLongPress = useRef(0);

  // Center "now" (or the first entry) when the timeline is wider than the screen.
  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller || scroller.scrollWidth <= scroller.clientWidth) return;
    const focus = now ?? lanes.flat()[0]?.from ?? day.startMs + 8 * 3600000;
    const x = (pct(focus, day) / 100) * scroller.scrollWidth;
    scroller.scrollLeft = x - scroller.clientWidth * 0.6;
    // Only on mount / zoom change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoom]);

  function timeAt(clientX: number) {
    const rect = innerRef.current!.getBoundingClientRect();
    const frac = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    let at = day.startMs + frac * (day.endMs - day.startMs);
    at = Math.round(at / 60000) * 60000;
    if (now !== null) at = Math.min(at, now);
    return Math.min(at, day.endMs - 60000);
  }

  function targetOf(el: EventTarget | null): Target | null {
    const node = (el as Element | null)?.closest?.("[data-kind]") as HTMLElement | null;
    if (!node) return null;
    return { kind: node.dataset.kind as Target["kind"], id: node.dataset.id! };
  }

  function openAt(clientX: number, clientY: number, el: EventTarget | null) {
    onContext({ x: clientX, y: clientY, at: timeAt(clientX), target: targetOf(el) });
  }

  const pointerHandlers = {
    onContextMenu(e: React.MouseEvent) {
      e.preventDefault();
      if (Date.now() - lastLongPress.current < 800) return; // already opened by long-press
      openAt(e.clientX, e.clientY, e.target);
    },
    onPointerDown(e: React.PointerEvent) {
      if (e.pointerType !== "touch") return;
      const { clientX, clientY, target } = e;
      const timer = window.setTimeout(() => {
        press.current!.fired = true;
        lastLongPress.current = Date.now();
        navigator.vibrate?.(10);
        openAt(clientX, clientY, target);
      }, LONG_PRESS_MS);
      press.current = { timer, x: clientX, y: clientY, fired: false };
    },
    onPointerMove(e: React.PointerEvent) {
      const p = press.current;
      if (p && Math.hypot(e.clientX - p.x, e.clientY - p.y) > 10) {
        clearTimeout(p.timer);
        press.current = null;
      }
    },
    onPointerUp() {
      if (press.current) clearTimeout(press.current.timer);
    },
    onPointerCancel() {
      if (press.current) clearTimeout(press.current.timer);
      press.current = null;
    },
    onClick(e: React.MouseEvent) {
      if (press.current?.fired) {
        press.current = null;
        return;
      }
      const target = targetOf(e.target);
      if (target) onOpen(target);
    },
  };

  const hours = Array.from({ length: 25 }, (_, h) => h);
  const innerWidth = zoom === "zoom" ? ZOOM_WIDTH : zoom === "fit" ? "100%" : undefined;

  return (
    <div
      ref={scrollerRef}
      className="timeline-scroller relative h-full overflow-x-auto overflow-y-hidden rounded-3xl border border-line bg-surface"
    >
      <div
        ref={innerRef}
        className={`relative flex h-full touch-pan-x flex-col select-none ${
          zoom === "auto" ? "w-[1800px] lg:w-full" : ""
        }`}
        style={innerWidth ? { width: innerWidth } : undefined}
        {...pointerHandlers}
      >
        {/* hour grid */}
        <div aria-hidden className="pointer-events-none absolute inset-0">
          {hours.map((h) => (
            <div
              key={h}
              className={`absolute top-6 bottom-0 border-l ${h % 6 === 0 ? "border-line" : "border-line/50"}`}
              style={{ left: `${(h / 24) * 100}%` }}
            />
          ))}
        </div>

        {/* ruler */}
        <div className="relative h-6 shrink-0 border-b border-line text-[10px] text-muted tabular-nums">
          {hours.slice(0, 24).map((h) => (
            <span
              key={h}
              className={`absolute top-1.5 pl-1 ${zoom === "fit" && h % 3 !== 0 ? "hidden lg:inline" : ""}`}
              style={{ left: `${(h / 24) * 100}%` }}
            >
              {String(h).padStart(2, "0")}
            </span>
          ))}
        </div>

        {/* action lanes */}
        <div className="relative flex min-h-0 flex-[2] flex-col gap-1.5 py-2">
          <LaneLabel>Actions</LaneLabel>
          {lanes.map((lane, i) => (
            <div key={i} className="relative min-h-8 flex-1" style={{ maxHeight: "3.75rem" }}>
              {lane.map((a) => (
                <ActionBlock key={a.id} tz={tz} a={a} day={day} emoji={emojiFor(a.type_id)} />
              ))}
            </div>
          ))}
        </div>

        {/* pain events */}
        <div className="relative h-9 shrink-0 border-t border-dashed border-line">
          <LaneLabel>Pain events</LaneLabel>
          {events.map((e) => (
            <button
              key={e.id}
              type="button"
              data-kind="event"
              data-id={e.id}
              title={`${formatTime(tz, e.occurred_at)} · ${e.name}${e.intensity != null ? ` · ${e.intensity}/10` : ""}`}
              className="absolute top-1/2 grid h-7 min-w-7 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 border-surface px-1 text-[11px] font-bold text-white shadow-sm"
              style={{ left: `${pct(new Date(e.occurred_at).getTime(), day)}%`, background: e.color }}
            >
              {e.intensity ?? "!"}
            </button>
          ))}
        </div>

        {/* pain level line */}
        <div className="relative min-h-24 flex-[3] border-t border-line">
          <LaneLabel>Pain level</LaneLabel>
          <PainLine points={painPoints} day={day} until={now ?? day.endMs} tz={tz} />
        </div>

        {/* now marker */}
        {now !== null && (
          <div
            aria-hidden
            className="pointer-events-none absolute top-0 bottom-0 z-10 w-0 border-l-2 border-[var(--pain-max)]"
            style={{ left: `${pct(now, day)}%` }}
          >
            <span className="absolute -top-0 -left-[5px] h-2.5 w-2.5 rounded-full bg-[var(--pain-max)]" />
          </div>
        )}
      </div>
    </div>
  );
}

function LaneLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="pointer-events-none sticky left-2 z-[1] -mb-4 block w-max px-2 text-[10px] font-semibold tracking-wider text-muted/80 uppercase">
      {children}
    </span>
  );
}

function ActionBlock({
  tz,
  a,
  day,
  emoji,
}: {
  tz: string;
  a: ClippedAction;
  day: Span;
  emoji: string | null;
}) {
  const left = pct(a.from, day);
  const width = Math.max(pct(a.to, day) - left, 0.35);
  const duration = new Date(a.ended_at ?? a.to).getTime() - new Date(a.started_at).getTime();
  const label = `${emoji ? `${emoji} ` : ""}${a.name}`;
  return (
    <button
      type="button"
      data-kind="action"
      data-id={a.id}
      title={`${label} · ${formatTime(tz, a.started_at)}–${a.active ? "now" : formatTime(tz, a.ended_at!)} · ${formatDuration(duration)}`}
      className={`absolute inset-y-0 flex items-center overflow-hidden rounded-lg px-1.5 text-left text-xs font-medium text-white shadow-sm ${
        a.active ? "action-active" : ""
      }`}
      style={{ left: `${left}%`, width: `${width}%`, backgroundColor: a.color }}
    >
      <span className="truncate">
        {label}
        <span className="ml-1 opacity-75">{formatDuration(duration)}</span>
      </span>
    </button>
  );
}

function PainLine({
  points,
  day,
  until,
  tz,
}: {
  points: PainPoint[];
  day: Span;
  until: number;
  tz: string;
}) {
  if (points.length === 0) {
    return (
      <p className="pointer-events-none absolute inset-0 grid place-items-center text-xs text-muted">
        No pain readings yet
      </p>
    );
  }
  const X = (ms: number) => pct(ms, day) * 10; // viewBox 0..1000
  const Y = (level: number) => 96 - level * 9; // viewBox 0..100, 10 → 6
  const endX = X(Math.max(until, points.at(-1)!.at));

  let d = `M ${X(points[0].at)} ${Y(points[0].level)}`;
  for (let i = 1; i < points.length; i++) {
    d += ` H ${X(points[i].at)} V ${Y(points[i].level)}`;
  }
  d += ` H ${endX}`;
  const area = `${d} V 100 H ${X(points[0].at)} Z`;

  return (
    <>
      <svg
        aria-hidden
        viewBox="0 0 1000 100"
        preserveAspectRatio="none"
        className="pointer-events-none absolute inset-x-0 top-4 bottom-1 h-[calc(100%-1.25rem)] w-full"
      >
        <defs>
          <linearGradient id="pain-grad" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor="var(--pain-low)" />
            <stop offset="35%" stopColor="var(--pain-mid-low)" />
            <stop offset="55%" stopColor="var(--pain-mid)" />
            <stop offset="75%" stopColor="var(--pain-high)" />
            <stop offset="100%" stopColor="var(--pain-max)" />
          </linearGradient>
        </defs>
        {[2, 5, 8].map((l) => (
          <line key={l} x1="0" x2="1000" y1={Y(l)} y2={Y(l)} stroke="var(--line)" strokeDasharray="4 6" vectorEffect="non-scaling-stroke" />
        ))}
        <path d={area} fill="url(#pain-grad)" opacity="0.18" />
        <path d={d} fill="none" stroke="url(#pain-grad)" strokeWidth="2.5" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
      </svg>
      <div className="absolute inset-x-0 top-4 bottom-1">
        {points
          .filter((p) => p.id !== null)
          .map((p) => (
            <button
              key={p.id}
              type="button"
              data-kind="level"
              data-id={p.id!}
              title={`${formatTime(tz, p.at)} · pain ${p.level}`}
              className="absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface"
              style={{
                left: `${pct(p.at, day)}%`,
                top: `${Y(p.level)}%`,
                background: painColor(p.level),
              }}
            />
          ))}
      </div>
    </>
  );
}
