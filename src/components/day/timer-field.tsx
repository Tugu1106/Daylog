"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { Action, ActionType } from "@/lib/database.types";
import { formatTime } from "@/lib/time";
import { painColor } from "@/components/pain-badge";

const REMIND_EVERY_MS = 5 * 60_000;

const BASE_TITLE = "Daylog";

const subscribeNothing = () => () => {};
const readPermission = (): NotificationPermission | "unsupported" =>
  "Notification" in window ? Notification.permission : "unsupported";

function clock(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** Short beep, no audio file needed. */
function beep() {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.6);
    osc.start();
    osc.stop(ctx.currentTime + 0.62);
    setTimeout(() => ctx.close(), 1000);
  } catch {
    // no audio available — the visual alert still fires
  }
}

function notify(title: string, body: string) {
  try {
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification(title, { body, tag: "daylog-timer", renotify: true } as NotificationOptions);
    }
  } catch {
    // notifications blocked — panel still turns red
  }
}

/**
 * The timer field: tap a task to start it (and end the previous one). Each task
 * can have a time limit that alerts you when it is up.
 */
export function TimerField({
  tz,
  types,
  running,
  now,
  onSwitch,
  onStop,
  onPain,
  onNotes,
}: {
  tz: string;
  types: ActionType[];
  /** The action currently running, if any. */
  running: Action | null;
  now: number;
  onSwitch: (type: ActionType) => void;
  onStop: () => void;
  onPain: (pain: number | null) => void;
  onNotes: (notes: string) => void;
}) {
  const [tick, setTick] = useState(now);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported" | null>(null);
  const browserPermission = useSyncExternalStore(subscribeNothing, readPermission, () => "default" as const);
  // Note box and pain row follow whichever action is running.
  const [ui, setUi] = useState<{ id: string | null; note: string; showPain: boolean }>({
    id: running?.id ?? null,
    note: running?.notes ?? "",
    showPain: false,
  });
  if (ui.id !== (running?.id ?? null)) {
    setUi({ id: running?.id ?? null, note: running?.notes ?? "", showPain: false });
  }
  const { note, showPain } = ui;
  const setNote = (text: string) => setUi((u) => ({ ...u, note: text }));
  const setShowPain = (v: boolean) => setUi((u) => ({ ...u, showPain: v }));
  const alerted = useRef<{ id: string; at: number } | null>(null);

  const tasks = types.filter((t) => t.timer && !t.archived);
  const runningType = running ? types.find((t) => t.id === running.type_id) : null;
  const limitMs = runningType?.limit_min ? runningType.limit_min * 60_000 : null;
  const elapsed = running ? tick - new Date(running.started_at).getTime() : 0;
  const over = limitMs !== null && elapsed >= limitMs;
  const remaining = limitMs !== null ? limitMs - elapsed : null;

  // Second-by-second clock while something runs.
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setTick(Date.now()), 1000);
    return () => clearInterval(id);
  }, [running]);

  // Alert once when the limit is passed, then every 5 minutes until you switch.
  useEffect(() => {
    if (!running || !over || !runningType) {
      if (!over) alerted.current = null;
      return;
    }
    const last = alerted.current;
    const due = !last || last.id !== running.id || tick - last.at >= REMIND_EVERY_MS;
    if (!due) return;
    alerted.current = { id: running.id, at: tick };
    const mins = Math.round(elapsed / 60000);
    beep();
    notify(`${runningType.name} — ${mins} min`, `Limit was ${runningType.limit_min} min. Time to switch.`);
  }, [over, running, runningType, tick, elapsed]);

  // Show the timer in the browser tab, so you can read it without switching back.
  useEffect(() => {
    if (!running) {
      document.title = BASE_TITLE;
      return;
    }
    const label = runningType?.emoji ? `${runningType.emoji} ${running.name}` : running.name;
    document.title = over
      ? `⏰ +${clock(-remaining!)} · ${label}`
      : `${clock(remaining ?? elapsed)} · ${label}`;
    return () => {
      document.title = BASE_TITLE;
    };
  }, [running, runningType, elapsed, remaining, over]);

  const progress = limitMs ? Math.min(1, elapsed / limitMs) : 0;
  const alerts = permission ?? browserPermission;

  return (
    <section
      data-testid="timer-field"
      className={`flex shrink-0 flex-col gap-2 rounded-3xl border p-2.5 transition ${
        over ? "animate-pulse border-[var(--pain-max)] bg-[var(--pain-max)]/10" : "border-line bg-surface"
      }`}
    >
      <div className="flex items-center gap-3">
        {running ? (
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-xl" style={{ background: `${running.color}22` }}>
              {runningType?.emoji ?? "▶"}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">
                {running.name}
                <span className="ml-2 font-normal text-muted">since {formatTime(tz, running.started_at)}</span>
              </p>
              <p className="flex items-baseline gap-2">
                <span className="text-2xl leading-tight font-semibold tabular-nums">{clock(elapsed)}</span>
                {limitMs !== null && (
                  <span className={`text-xs tabular-nums ${over ? "font-semibold text-[var(--pain-max)]" : "text-muted"}`}>
                    {over ? `${clock(-remaining!)} over ${runningType!.limit_min}m` : `${clock(remaining!)} left`}
                  </span>
                )}
              </p>
            </div>
          </div>
        ) : (
          <p className="flex-1 text-sm text-muted">Tap a task to start the timer — it logs straight to the timeline.</p>
        )}

        {running && (
          <div className="flex shrink-0 items-center gap-1.5">
            <button
              onClick={() => setShowPain(!showPain)}
              className="h-9 rounded-lg border border-line px-2.5 text-xs font-medium"
              style={running.pain !== null ? { background: painColor(running.pain), color: "#fff", borderColor: "transparent" } : undefined}
            >
              {running.pain !== null ? `pain ${running.pain}` : "+ pain"}
            </button>
            <button onClick={onStop} className="h-9 rounded-lg border border-line px-3 text-xs font-medium">
              Stop
            </button>
          </div>
        )}
      </div>

      {limitMs !== null && running && (
        <div className="h-1 overflow-hidden rounded-full bg-surface-2">
          <div
            className="h-full rounded-full transition-[width] duration-1000"
            style={{ width: `${progress * 100}%`, background: over ? "var(--pain-max)" : "var(--accent)" }}
          />
        </div>
      )}

      {showPain && running && (
        <div className="flex flex-col gap-2">
          <div className="grid grid-cols-11 gap-1">
            {Array.from({ length: 11 }, (_, n) => (
              <button
                key={n}
                onClick={() => onPain(running.pain === n ? null : n)}
                className="h-9 rounded-lg text-sm font-semibold text-white tabular-nums"
                style={{
                  background: painColor(n),
                  outline: running.pain === n ? "3px solid var(--ink)" : undefined,
                  outlineOffset: 1,
                }}
              >
                {n}
              </button>
            ))}
          </div>
          <input
            className="input py-2 text-sm"
            placeholder="Note for this activity — e.g. pain rose after 20 min"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onBlur={() => note !== (running.notes ?? "") && onNotes(note)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.currentTarget.blur();
              }
            }}
          />
        </div>
      )}

      <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
        {tasks.map((t) => {
          const active = running?.type_id === t.id;
          return (
            <button
              key={t.id}
              onClick={() => onSwitch(t)}
              className={`flex shrink-0 items-center gap-1.5 rounded-xl border px-2.5 py-2 text-sm font-medium transition active:scale-95 ${
                active ? "border-transparent text-white" : "border-line bg-surface hover:bg-surface-2"
              }`}
              style={active ? { background: t.color } : undefined}
            >
              <span>{t.emoji ?? "•"}</span>
              <span className="whitespace-nowrap">{t.name}</span>
              {t.limit_min && (
                <span className={`text-[10px] tabular-nums ${active ? "opacity-80" : "text-muted"}`}>{t.limit_min}m</span>
              )}
            </button>
          );
        })}
        {tasks.length === 0 && (
          <p className="text-xs text-muted">No timer tasks yet — mark some in Types.</p>
        )}
        {alerts === "default" && (
          <button
            onClick={() => Notification.requestPermission().then(setPermission)}
            className="ml-auto shrink-0 rounded-xl border border-line px-2.5 py-2 text-xs whitespace-nowrap text-muted"
          >
            🔔 Enable alerts
          </button>
        )}
        {alerts === "denied" && (
          <span className="ml-auto shrink-0 text-xs text-muted" title="Allow notifications in your browser settings">
            🔕 alerts blocked
          </span>
        )}
      </div>
    </section>
  );
}
