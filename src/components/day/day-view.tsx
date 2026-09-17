"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useOptimistic, useState, useTransition } from "react";
import type { DayData } from "@/lib/day-data";
import { clipActions, packLanes, painSeries, type PainPoint } from "@/lib/day";
import { addDays, formatDay, formatDuration, formatTime, localDay, minutesOfDay } from "@/lib/time";
import {
  addPainEvent,
  addPainLevel,
  deleteAction,
  deletePainEvent,
  deletePainLevel,
  endAction,
  startAction,
  updateAction,
  updatePainEvent,
  type Result,
} from "@/app/(app)/timeline-actions";
import { Sky } from "./sky";
import { Timeline, type ContextRequest, type Target, type Zoom } from "./timeline";
import { ContextMenu, type MenuHandlers } from "./context-menu";
import { ActionSheet, PainEventSheet } from "./sheets";
import { PainBar } from "./pain-bar";

const TICK_MS = 20_000;

export function DayView({
  data,
  tz,
  isToday,
  serverNow,
}: {
  data: DayData;
  tz: string;
  isToday: boolean;
  serverNow: number;
}) {
  const [now, setNow] = useState(serverNow);
  const [menu, setMenu] = useState<ContextRequest | null>(null);
  const [sheet, setSheet] = useState<Target | null>(null);
  const [zoom, setZoom] = useState<Zoom>("auto");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [optimisticLevels, addOptimisticLevel] = useOptimistic(
    data.levels,
    (state, p: { id: string; recorded_at: string; level: number }) =>
      [...state, p].sort((a, b) => a.recorded_at.localeCompare(b.recorded_at)),
  );

  const router = useRouter();

  // Tick the clock; when midnight passes, reload so Today starts empty.
  useEffect(() => {
    if (!isToday) return;
    const id = setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (localDay(tz, new Date(t)) !== data.day) router.refresh();
    }, TICK_MS);
    return () => clearInterval(id);
  }, [isToday, tz, data.day, router]);

  // Pick up entries logged from another device when coming back to the tab.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        setNow(Date.now());
        router.refresh();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [router]);

  useEffect(() => {
    if (!error) return;
    const id = setTimeout(() => setError(null), 4000);
    return () => clearTimeout(id);
  }, [error]);

  const span = useMemo(() => ({ startMs: data.startMs, endMs: data.endMs }), [data.startMs, data.endMs]);
  const liveNow = isToday ? now : null;
  const clipped = useMemo(() => clipActions(data.actions, span, isToday ? now : span.endMs), [data.actions, span, now, isToday]);
  const lanes = useMemo(() => packLanes(clipped, 2), [clipped]);
  const painPoints: PainPoint[] = useMemo(() => painSeries(optimisticLevels, span), [optimisticLevels, span]);
  const typeById = useMemo(() => new Map(data.actionTypes.map((t) => [t.id, t])), [data.actionTypes]);
  const emojiFor = useCallback((id: string | null) => (id ? typeById.get(id)?.emoji ?? null : null), [typeById]);
  const running = data.actions.filter((a) => a.ended_at === null);
  const currentPain = painPoints.at(-1)?.level ?? null;

  const run = useCallback((fn: () => Promise<Result>) => {
    startTransition(async () => {
      const res = await fn();
      if (res.error) setError(res.error);
    });
  }, []);

  const closeMenu = useCallback(() => setMenu(null), []);
  const closeSheet = useCallback(() => setSheet(null), []);

  function commitLevel(level: number, at: number) {
    startTransition(async () => {
      addOptimisticLevel({ id: `tmp-${at}`, recorded_at: new Date(at).toISOString(), level });
      const res = await addPainLevel({ level, at });
      if (res.error) setError(res.error);
    });
  }

  function removeTarget(t: Target) {
    if (t.kind === "action") run(() => deleteAction(t.id));
    else if (t.kind === "event") run(() => deletePainEvent(t.id));
    else if (!t.id.startsWith("tmp-")) run(() => deletePainLevel(t.id));
  }

  const handlers: MenuHandlers = {
    start: (typeId, at) => run(() => startAction({ typeId, at })),
    end: (id, at) => run(() => endAction({ id, at })),
    painLevel: (level, at) => commitLevel(level, at),
    painEvent: (typeId, at, intensity) => run(() => addPainEvent({ typeId, at, intensity })),
    edit: (t) => setSheet(t),
    remove: removeTarget,
  };

  function targetLabel(t: Target | null) {
    if (!t) return null;
    if (t.kind === "action") {
      const a = data.actions.find((x) => x.id === t.id);
      return a ? `${emojiFor(a.type_id) ?? ""} ${a.name} · ${formatTime(tz, a.started_at)}–${a.ended_at ? formatTime(tz, a.ended_at) : "now"}` : null;
    }
    if (t.kind === "event") {
      const e = data.events.find((x) => x.id === t.id);
      return e ? `${e.name} · ${formatTime(tz, e.occurred_at)}` : null;
    }
    const p = painPoints.find((x) => x.id === t.id);
    return p ? `Pain ${p.level} · ${formatTime(tz, p.at)}` : null;
  }

  function openQuickMenu(e: React.MouseEvent) {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setMenu({ x: r.left - 200, y: r.top - 420, at: Math.floor(Date.now() / 60000) * 60000, target: null });
  }

  const sheetAction = sheet?.kind === "action" ? data.actions.find((a) => a.id === sheet.id) : null;
  const sheetEvent = sheet?.kind === "event" ? data.events.find((e) => e.id === sheet.id) : null;

  const skyMinute = isToday ? minutesOfDay(tz, new Date(now)) : 13 * 60;
  const prevDay = addDays(data.day, -1);
  const nextDay = addDays(data.day, 1);

  return (
    <div className="mx-auto flex h-[calc(100dvh-3.5rem)] w-full max-w-[1600px] flex-col gap-3 px-3 pt-1 pb-3 sm:px-5">
      {/* top ~25%: sky */}
      <div className="h-[24%] min-h-40 shrink-0">
        <Sky
          minuteOfDay={skyMinute}
          live={isToday}
          clock={isToday ? formatTime(tz, now) : formatDay(data.day, { weekday: "long" })}
          dateLabel={isToday ? formatDay(data.day, { weekday: "long", month: "long" }) : String(new Date(data.startMs).getUTCFullYear())}
        >
          <div className="flex flex-wrap items-center gap-2">
            {isToday ? (
              running.length === 0 ? (
                <span className="rounded-full bg-black/15 px-3 py-1 text-xs backdrop-blur">
                  Nothing running · right-click or long-press the timeline to start
                </span>
              ) : (
                running.map((a) => (
                  <span key={a.id} className="flex items-center gap-2 rounded-full bg-black/20 py-1 pr-1 pl-3 text-sm backdrop-blur">
                    <span className="h-2 w-2 animate-pulse rounded-full" style={{ background: a.color }} />
                    {emojiFor(a.type_id)} {a.name}
                    <span className="tabular-nums opacity-80">{formatDuration(now - new Date(a.started_at).getTime())}</span>
                    <button
                      disabled={pending}
                      onClick={() => run(() => endAction({ id: a.id, at: Date.now() }))}
                      className="rounded-full bg-white/90 px-2.5 py-0.5 text-xs font-semibold text-black"
                    >
                      End
                    </button>
                  </span>
                ))
              )
            ) : (
              <>
                <Link href={`/day/${prevDay}`} className="rounded-full bg-black/15 px-3 py-1 text-xs backdrop-blur">
                  ← {formatDay(prevDay)}
                </Link>
                <Link href={`/day/${nextDay}`} className="rounded-full bg-black/15 px-3 py-1 text-xs backdrop-blur">
                  {formatDay(nextDay)} →
                </Link>
              </>
            )}
          </div>
        </Sky>
      </div>

      {/* ~60%: timeline */}
      <div className="relative min-h-0 flex-1">
        <Timeline
          tz={tz}
          day={span}
          now={liveNow}
          lanes={lanes}
          events={data.events}
          painPoints={painPoints}
          emojiFor={emojiFor}
          zoom={zoom}
          onContext={setMenu}
          onOpen={(t) => (t.kind === "level" ? setMenu(null) : setSheet(t))}
        />
        <div className="absolute top-8 right-2 z-20 flex overflow-hidden rounded-lg border border-line bg-surface/90 text-[11px] backdrop-blur">
          {(["fit", "zoom"] as const).map((z) => (
            <button
              key={z}
              onClick={() => setZoom(zoom === z ? "auto" : z)}
              className={`px-2 py-1 ${zoom === z ? "bg-accent text-(--accent-ink)" : "text-muted"}`}
            >
              {z === "fit" ? "24h" : "Zoom"}
            </button>
          ))}
        </div>
        {pending && (
          <span className="absolute right-3 bottom-2 z-20 rounded-full bg-surface px-2 py-0.5 text-[11px] text-muted shadow">
            saving…
          </span>
        )}
      </div>

      {/* bottom: pain glider */}
      {isToday ? (
        <div className="shrink-0">
          <PainBar key={painPoints.at(-1)?.id ?? "none"} current={currentPain} onCommit={(l) => commitLevel(l, Date.now())}>
            <button onClick={openQuickMenu} className="btn-primary px-3 py-2 text-sm">
              + Log
            </button>
          </PainBar>
        </div>
      ) : (
        <p className="shrink-0 text-center text-xs text-muted">
          Right-click (or long-press) the timeline to add or fix entries for this day.
        </p>
      )}

      {menu && (
        <ContextMenu
          key={`${menu.x}-${menu.y}-${menu.at}`}
          tz={tz}
          req={menu}
          now={liveNow}
          actions={data.actions}
          actionTypes={data.actionTypes}
          painTypes={data.painTypes}
          targetLabel={targetLabel(menu.target)}
          onClose={closeMenu}
          handlers={handlers}
        />
      )}

      {sheetAction && (
        <ActionSheet
          key={sheetAction.id}
          tz={tz}
          action={sheetAction}
          emoji={emojiFor(sheetAction.type_id)}
          pending={pending}
          onClose={closeSheet}
          onSave={(v) => {
            run(() => updateAction({ id: sheetAction.id, ...v }));
            closeSheet();
          }}
          onDelete={() => {
            run(() => deleteAction(sheetAction.id));
            closeSheet();
          }}
        />
      )}

      {sheetEvent && (
        <PainEventSheet
          key={sheetEvent.id}
          tz={tz}
          event={sheetEvent}
          pending={pending}
          onClose={closeSheet}
          onSave={(v) => {
            run(() => updatePainEvent({ id: sheetEvent.id, ...v }));
            closeSheet();
          }}
          onDelete={() => {
            run(() => deletePainEvent(sheetEvent.id));
            closeSheet();
          }}
        />
      )}

      {error && (
        <div role="alert" className="fixed inset-x-0 bottom-24 z-50 mx-auto w-max max-w-[90vw] rounded-full bg-red-600 px-4 py-2 text-sm text-white shadow-lg">
          {error}
        </div>
      )}
    </div>
  );
}
