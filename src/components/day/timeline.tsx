"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { PainEvent } from "@/lib/database.types";
import { pct, type ClippedAction, type PainPoint, type Span } from "@/lib/day";
import { formatDuration, formatTime } from "@/lib/time";
import { clampViewHours, MAX_VIEW_HOURS, MIN_VIEW_HOURS, VIEW_HOURS_PRESETS } from "@/lib/view";
import { painColor } from "@/components/pain-badge";

export type Target =
  | { kind: "action"; id: string }
  | { kind: "event"; id: string }
  | { kind: "level"; id: string };

export type ContextRequest = { x: number; y: number; at: number; target: Target | null };

const LONG_PRESS_MS = 450;
const HOUR = 3_600_000;

export function Timeline({
  tz,
  day,
  now,
  lanes,
  events,
  painPoints,
  emojiFor,
  viewHours,
  onViewHoursChange,
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
  /** How many hours fit in the visible width. */
  viewHours: number;
  onViewHoursChange: (hours: number) => void;
  onContext: (req: ContextRequest) => void;
  onOpen: (target: Target) => void;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const guideRef = useRef<HTMLDivElement>(null);
  const guideLabelRef = useRef<HTMLSpanElement>(null);
  const press = useRef<{ timer: number; x: number; y: number; fired: boolean } | null>(null);
  const lastLongPress = useRef(0);
  const viewHoursRef = useRef(viewHours);
  // Time at the center of the view; kept when the window size or screen width changes.
  const centerRef = useRef<number | null>(null);
  // Where an in-flight smooth pan is heading, so quick repeated clicks add up.
  const panTargetRef = useRef<number | null>(null);
  const [width, setWidth] = useState(0);
  const [visible, setVisible] = useState<{ from: number; to: number } | null>(null);

  const spanMs = day.endMs - day.startMs;
  const dayHours = spanMs / HOUR;
  const hours = Math.min(viewHours, dayHours);
  const pxPerHour = width ? width / hours : 0;

  useEffect(() => {
    viewHoursRef.current = viewHours;
  }, [viewHours]);

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    ro.observe(scroller);
    return () => ro.disconnect();
  }, []);

  function readVisible() {
    const s = scrollerRef.current;
    if (!s || !s.scrollWidth) return;
    const from = day.startMs + (s.scrollLeft / s.scrollWidth) * spanMs;
    const to = day.startMs + ((s.scrollLeft + s.clientWidth) / s.scrollWidth) * spanMs;
    centerRef.current = (from + to) / 2;
    if (panTargetRef.current !== null && Math.abs(panTargetRef.current - centerRef.current) < 60_000) {
      panTargetRef.current = null;
    }
    setVisible({ from, to });
  }

  /** Clamp a center time so the view stays inside the day. */
  function clampCenter(ms: number) {
    const half = (hours / 2) * HOUR;
    return Math.min(day.endMs - half, Math.max(day.startMs + half, ms));
  }

  function scrollToCenter(ms: number, behavior: ScrollBehavior = "auto") {
    const s = scrollerRef.current;
    if (!s) return;
    ms = clampCenter(ms);
    panTargetRef.current = behavior === "smooth" ? ms : null;
    const x = ((ms - day.startMs) / spanMs) * s.scrollWidth - s.clientWidth / 2;
    s.scrollTo({ left: x, behavior });
  }

  // Before paint, and whenever the window size or width changes: keep the same center.
  useLayoutEffect(() => {
    if (centerRef.current === null) {
      // First render: put "now" a bit right of center so recent past is visible.
      const focus = now !== null ? now - (hours / 6) * HOUR : (lanes.flat()[0]?.from ?? day.startMs + 12 * HOUR);
      centerRef.current = focus;
    }
    scrollToCenter(centerRef.current);
    readVisible();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewHours, width]);

  // Vertical wheel pans the timeline; Ctrl/⌘ + wheel changes the window size.
  useEffect(() => {
    const s = scrollerRef.current;
    if (!s) return;
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const presets: number[] = [...VIEW_HOURS_PRESETS];
        const cur = viewHoursRef.current;
        const next =
          e.deltaY > 0
            ? (presets.find((p) => p > cur) ?? MAX_VIEW_HOURS)
            : (presets.findLast((p) => p < cur) ?? MIN_VIEW_HOURS);
        if (next !== cur) onViewHoursChange(next);
        return;
      }
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX) && s.scrollWidth > s.clientWidth) {
        e.preventDefault();
        s.scrollLeft += e.deltaY;
      }
    };
    s.addEventListener("wheel", onWheel, { passive: false });
    return () => s.removeEventListener("wheel", onWheel);
  }, [onViewHoursChange]);

  function pan(direction: -1 | 1) {
    const base = panTargetRef.current ?? centerRef.current ?? day.startMs;
    scrollToCenter(base + direction * (hours / 2) * HOUR, "smooth");
  }

  // ← / → pan, unless you're typing or using the pain slider.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      const el = e.target as HTMLElement | null;
      if (el?.closest?.("input, textarea, select, [role=dialog], [role=menu]")) return;
      e.preventDefault();
      pan(e.key === "ArrowLeft" ? -1 : 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  function minuteAt(clientX: number) {
    const rect = innerRef.current!.getBoundingClientRect();
    const frac = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    const at = day.startMs + frac * spanMs;
    return Math.min(Math.round(at / 60000) * 60000, day.endMs - 60000);
  }

  function timeAt(clientX: number) {
    const at = minuteAt(clientX);
    return now !== null ? Math.min(at, now) : at;
  }

  function showGuide(clientX: number) {
    const guide = guideRef.current;
    const label = guideLabelRef.current;
    if (!guide || !label) return;
    const at = minuteAt(clientX);
    const future = now !== null && at > now;
    guide.style.left = `${((at - day.startMs) / spanMs) * 100}%`;
    guide.style.display = "block";
    guide.style.opacity = future ? "0.45" : "1";
    // Keep the label on screen near the edges of the visible area.
    const view = scrollerRef.current!.getBoundingClientRect();
    label.style.transform =
      clientX - view.left < 48 ? "translateX(0)" : view.right - clientX < 48 ? "translateX(-100%)" : "translateX(-50%)";
    label.textContent = future ? `${formatTime(tz, at)} · later` : formatTime(tz, at);
  }

  function hideGuide() {
    if (guideRef.current) guideRef.current.style.display = "none";
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
        showGuide(clientX);
        openAt(clientX, clientY, target);
      }, LONG_PRESS_MS);
      press.current = { timer, x: clientX, y: clientY, fired: false };
    },
    onPointerMove(e: React.PointerEvent) {
      if (e.pointerType === "mouse") showGuide(e.clientX);
      const p = press.current;
      if (p && Math.hypot(e.clientX - p.x, e.clientY - p.y) > 10) {
        clearTimeout(p.timer);
        press.current = null;
      }
    },
    onPointerLeave(e: React.PointerEvent) {
      if (e.pointerType === "mouse") hideGuide();
    },
    onPointerUp(e: React.PointerEvent) {
      if (press.current) clearTimeout(press.current.timer);
      if (e.pointerType === "touch") window.setTimeout(hideGuide, 1500);
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

  // Tick density follows how many pixels an hour gets.
  const tickMinutes = pxPerHour >= 240 ? 15 : pxPerHour >= 90 ? 30 : 60;
  const labelEvery = pxPerHour >= 120 ? tickMinutes : pxPerHour >= 30 ? 60 : pxPerHour >= 15 ? 120 : 180;
  const totalMinutes = Math.round(dayHours * 60);
  const ticks = Array.from({ length: Math.floor(totalMinutes / tickMinutes) + 1 }, (_, i) => i * tickMinutes);
  const left = (m: number) => `${((m * 60000) / spanMs) * 100}%`;

  return (
    <div className="flex h-full flex-col gap-1.5">
      <Toolbar
        tz={tz}
        visible={visible}
        viewHours={viewHours}
        isLive={now !== null}
        onPan={pan}
        onNow={() => now !== null && scrollToCenter(now - (hours / 6) * HOUR, "smooth")}
        onViewHoursChange={onViewHoursChange}
      />
      <div
        ref={scrollerRef}
        onScroll={readVisible}
        className="timeline-scroller relative min-h-0 flex-1 overflow-x-auto overflow-y-hidden rounded-3xl border border-line bg-surface"
      >
        <div
          ref={innerRef}
          className="relative flex h-full touch-pan-x flex-col overflow-x-clip select-none"
          style={{ width: `${(dayHours / hours) * 100}%` }}
          {...pointerHandlers}
        >
          {/* grid */}
          <div aria-hidden className="pointer-events-none absolute inset-0">
            {ticks.filter((m) => m > 0 && m < totalMinutes).map((m) => (
              <div
                key={m}
                className={`absolute top-6 bottom-0 border-l ${
                  m % 360 === 0 ? "border-line" : m % 60 === 0 ? "border-line/60" : "border-dashed border-line/40"
                }`}
                style={{ left: left(m) }}
              />
            ))}
          </div>

          {/* ruler */}
          <div className="relative h-6 shrink-0 border-b border-line text-[10px] text-muted tabular-nums">
            {ticks
              .filter((m) => m % labelEvery === 0 && m < totalMinutes)
              .map((m) => {
                const label = formatTime(tz, day.startMs + m * 60000);
                return (
                  <span
                    key={m}
                    className={`absolute top-1.5 pl-1 ${m % 60 === 0 ? "" : "opacity-60"}`}
                    style={{ left: left(m) }}
                  >
                    {labelEvery < 60 ? label : label.slice(0, 2)}
                  </span>
                );
              })}
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

          {/* hover guide: exact time under the cursor */}
          <div
            ref={guideRef}
            aria-hidden
            data-testid="time-guide"
            className="pointer-events-none absolute top-0 bottom-0 z-20 w-0 border-l border-dashed border-ink/70"
            style={{ display: "none" }}
          >
            <span
              ref={guideLabelRef}
              className="absolute top-0.5 left-0 rounded-md bg-ink px-1.5 py-0.5 text-[11px] font-semibold whitespace-nowrap text-paper tabular-nums shadow"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function Toolbar({
  tz,
  visible,
  viewHours,
  isLive,
  onPan,
  onNow,
  onViewHoursChange,
}: {
  tz: string;
  visible: { from: number; to: number } | null;
  viewHours: number;
  isLive: boolean;
  onPan: (direction: -1 | 1) => void;
  onNow: () => void;
  onViewHoursChange: (hours: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState(String(viewHours));
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("pointerdown", onDown, true);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onDown, true);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const btn =
    "grid h-8 min-w-8 place-items-center rounded-lg border border-line bg-surface px-2 text-sm hover:bg-surface-2";

  return (
    <div className="flex shrink-0 items-center gap-1.5">
      <button className={btn} onClick={() => onPan(-1)} aria-label="Earlier" title="Earlier (←)">
        ‹
      </button>
      {isLive && (
        <button className={`${btn} text-xs font-medium`} onClick={onNow}>
          Now
        </button>
      )}
      <button className={btn} onClick={() => onPan(1)} aria-label="Later" title="Later (→)">
        ›
      </button>
      <span data-testid="visible-range" className="ml-1 truncate text-xs text-muted tabular-nums">
        {visible && `${formatTime(tz, visible.from)} – ${formatTime(tz, visible.to)}`}
      </span>

      <div ref={boxRef} className="relative ml-auto">
        <button
          className={`${btn} text-xs font-medium`}
          onClick={() => {
            setCustom(String(viewHours));
            setOpen(!open);
          }}
          aria-expanded={open}
          title="Visible time window"
        >
          <span className="flex items-center gap-1.5">
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7v5l3 2" strokeLinecap="round" />
            </svg>
            {viewHours}h view
          </span>
        </button>

        {open && (
          <div className="absolute top-full right-0 z-40 mt-1.5 w-64 rounded-2xl border border-line bg-surface p-3 shadow-2xl">
            <p className="mb-2 text-[10px] font-semibold tracking-wider text-muted uppercase">Visible time window</p>
            <div className="grid grid-cols-4 gap-1">
              {VIEW_HOURS_PRESETS.map((h) => (
                <button
                  key={h}
                  onClick={() => {
                    onViewHoursChange(h);
                    setCustom(String(h));
                  }}
                  className={`h-9 rounded-lg text-sm font-semibold tabular-nums ${
                    h === viewHours ? "chip-on" : "bg-surface-2"
                  }`}
                >
                  {h}h
                </button>
              ))}
            </div>
            <form
              className="mt-3 flex items-center gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                const h = clampViewHours(custom);
                setCustom(String(h));
                onViewHoursChange(h);
              }}
            >
              <label className="text-xs text-muted" htmlFor="view-hours">
                Custom
              </label>
              <input
                id="view-hours"
                type="number"
                min={MIN_VIEW_HOURS}
                max={MAX_VIEW_HOURS}
                step={0.5}
                value={custom}
                onChange={(e) => setCustom(e.target.value)}
                className="input w-20 px-2 py-1.5 text-sm"
              />
              <span className="text-xs text-muted">hours</span>
              <button className="btn-primary ml-auto px-3 py-1.5 text-xs">Set</button>
            </form>
            <p className="mt-3 text-[11px] leading-snug text-muted">
              Move with ‹ ›, arrow keys, scrolling or swiping. Ctrl + scroll zooms.
            </p>
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
