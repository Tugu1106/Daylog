"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { Action, ActionType } from "@/lib/database.types";
import { formatTime } from "@/lib/time";
import { painColor } from "@/components/pain-badge";

const REMIND_EVERY_MS = 5 * 60_000;
/** How late an end timer may fire and still hand over to the next activity. */
const CATCH_UP_MS = 5 * 60_000;

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

export type TaskDraft = {
  id: string | null;
  name: string;
  emoji: string | null;
  notifyAfterMin: number | null;
  endAfterMin: number | null;
  nextTypeId: string | null;
};

/**
 * The timer field: tap a task to start it (and end the previous one). Each task
 * carries two independent timers — one that only notifies you, and one that ends
 * the activity and can start the next one by itself.
 */
export function TimerField({
  tz,
  types,
  running,
  now,
  onSwitch,
  onStop,
  onAutoEnd,
  onPain,
  onNotes,
  onSaveTask,
  onRemoveTask,
  pending,
}: {
  tz: string;
  types: ActionType[];
  /** The action currently running, if any. */
  running: Action | null;
  now: number;
  onSwitch: (type: ActionType) => void;
  onStop: () => void;
  /** An end timer ran out: end at `at`, then start `nextTypeId` if there is one. */
  onAutoEnd: (at: number, nextTypeId: string | null) => void;
  onPain: (pain: number | null) => void;
  onNotes: (notes: string) => void;
  onSaveTask: (v: TaskDraft) => void;
  onRemoveTask: (id: string) => void;
  pending: boolean;
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
  const autoEnded = useRef<string | null>(null);
  // null = closed, "new" = adding, otherwise the task being edited
  const [editing, setEditing] = useState<ActionType | "new" | null>(null);

  const tasks = types.filter((t) => t.timer && !t.archived);
  const byId = (id: string | null | undefined) => (id ? types.find((t) => t.id === id) ?? null : null);
  const runningType = running ? byId(running.type_id) : null;
  const startedMs = running ? new Date(running.started_at).getTime() : 0;
  const elapsed = running ? tick - startedMs : 0;

  // The nudge: alerts, then lets the activity run on.
  const notifyMs = runningType?.limit_min ? runningType.limit_min * 60_000 : null;
  const leftToNotify = notifyMs === null ? null : notifyMs - elapsed;
  const over = leftToNotify !== null && leftToNotify <= 0;

  // The hard stop: ends the activity, and hands over when a follow-on is set.
  const endMs = runningType?.end_min ? runningType.end_min * 60_000 : null;
  const leftToEnd = endMs === null ? null : endMs - elapsed;
  const dueAt = running && endMs !== null ? startedMs + endMs : null;
  const nextType = runningType?.next_type_id ? byId(runningType.next_type_id) : null;
  const nextLive = nextType && !nextType.archived ? nextType : null;

  // Second-by-second clock while something runs.
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setTick(Date.now()), 1000);
    return () => clearInterval(id);
  }, [running]);

  // Alert once when the notify threshold is passed, then every 5 min until you switch.
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
    notify(`${runningType.name} — ${mins} min`, `You asked to be told after ${runningType.limit_min} min.`);
  }, [over, running, runningType, tick, elapsed]);

  // End timer: stop the activity at the moment you set, and start the next one.
  useEffect(() => {
    if (!running || !runningType || dueAt === null || tick < dueAt) return;
    if (autoEnded.current === running.id) return;
    autoEnded.current = running.id;
    // The tab may have been asleep for hours. Ending at the time you set is
    // always right, but only hand over if it just happened — otherwise we would
    // log a chain of activities you never did.
    const next = Date.now() - dueAt > CATCH_UP_MS ? null : nextLive;
    beep();
    notify(
      `${runningType.name} — time's up`,
      next ? `Ended after ${runningType.end_min} min · ${next.name} is now running.` : `Ended after ${runningType.end_min} min.`,
    );
    onAutoEnd(Math.min(dueAt, Date.now()), next?.id ?? null);
  }, [running, runningType, dueAt, tick, nextLive, onAutoEnd]);

  // The big number counts down to the hard stop when there is one, otherwise to
  // the nudge (and on into minus), otherwise it just counts up.
  const bigClock =
    leftToEnd !== null
      ? clock(Math.max(0, leftToEnd))
      : leftToNotify !== null
        ? over
          ? `-${clock(-leftToNotify)}`
          : clock(leftToNotify)
        : clock(elapsed);

  // Show the timer in the browser tab, so you can read it without switching back.
  useEffect(() => {
    if (!running) {
      document.title = BASE_TITLE;
      return;
    }
    const label = runningType?.emoji ? `${runningType.emoji} ${running.name}` : running.name;
    document.title = `${over ? "⏰ " : ""}${bigClock} · ${label}`;
    return () => {
      document.title = BASE_TITLE;
    };
  }, [running, runningType, bigClock, over]);

  // The bar drains as the remaining time runs out, then sits full red.
  const progress =
    endMs !== null && leftToEnd !== null
      ? Math.max(0, leftToEnd / endMs)
      : notifyMs !== null && leftToNotify !== null
        ? over
          ? 1
          : Math.max(0, leftToNotify / notifyMs)
        : 0;
  const hasBar = endMs !== null || notifyMs !== null;
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
                <span
                  className="text-2xl leading-tight font-semibold tabular-nums"
                  style={over ? { color: "var(--pain-max)" } : undefined}
                >
                  {bigClock}
                </span>
                {runningType && (
                  <button
                    onClick={() => setEditing(runningType)}
                    className={`truncate text-xs tabular-nums ${over ? "font-semibold text-[var(--pain-max)]" : "text-muted"} underline decoration-dotted underline-offset-2`}
                    title="Change this activity's timers"
                  >
                    {clock(elapsed)} so far
                    {notifyMs !== null &&
                      (over ? ` · 🔔 past ${runningType.limit_min}m` : ` · 🔔 in ${clock(leftToNotify!)}`)}
                    {dueAt !== null && ` · ⏹ ends ${formatTime(tz, dueAt)}`}
                    {nextLive && ` → ${nextLive.emoji ?? ""} ${nextLive.name}`}
                    {notifyMs === null && endMs === null && " · no timers"}
                  </button>
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

      {hasBar && running && (
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

      {editing && (
        <TaskEditor
          key={editing === "new" ? "new" : editing.id}
          task={editing === "new" ? null : editing}
          options={types.filter((t) => !t.archived && t.id !== (editing === "new" ? null : editing.id))}
          pending={pending}
          onSave={(v) => {
            onSaveTask(v);
            setEditing(null);
          }}
          onRemove={(id) => {
            onRemoveTask(id);
            setEditing(null);
          }}
          onClose={() => setEditing(null)}
        />
      )}

      <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
        {tasks.map((t) => {
          const active = running?.type_id === t.id;
          const follows = byId(t.next_type_id);
          return (
            <button
              key={t.id}
              onClick={() => onSwitch(t)}
              onContextMenu={(e) => {
                e.preventDefault();
                setEditing(t);
              }}
              title={[
                t.limit_min && `Notifies after ${t.limit_min} min`,
                t.end_min && `Ends after ${t.end_min} min${follows ? ` and starts ${follows.name}` : ""}`,
                "right-click to edit",
              ]
                .filter(Boolean)
                .join(" · ")}
              className={`flex shrink-0 items-center gap-1.5 rounded-xl border px-2.5 py-2 text-sm font-medium transition active:scale-95 ${
                active ? "border-transparent text-white" : "border-line bg-surface hover:bg-surface-2"
              }`}
              style={active ? { background: t.color } : undefined}
            >
              <span>{t.emoji ?? "•"}</span>
              <span className="whitespace-nowrap">{t.name}</span>
              {t.limit_min && (
                <span className={`text-[10px] tabular-nums ${active ? "opacity-80" : "text-muted"}`}>🔔{t.limit_min}m</span>
              )}
              {t.end_min && (
                <span className={`text-[10px] tabular-nums ${active ? "opacity-80" : "text-muted"}`}>
                  ⏹{t.end_min}m{follows ? `→${follows.emoji ?? "▸"}` : ""}
                </span>
              )}
            </button>
          );
        })}
        <button
          onClick={() => setEditing(editing === "new" ? null : "new")}
          className="flex shrink-0 items-center gap-1 rounded-xl border border-dashed border-line px-2.5 py-2 text-sm text-muted hover:text-ink"
          title="Add an activity with its timers"
        >
          ＋ Activity
        </button>
        {tasks.length === 0 && (
          <p className="text-xs text-muted">No activities yet — add one.</p>
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

/** Add or edit an activity on the timer line, together with both of its timers. */
function TaskEditor({
  task,
  options,
  pending,
  onSave,
  onRemove,
  onClose,
}: {
  task: ActionType | null;
  /** Everything this activity is allowed to hand over to. */
  options: ActionType[];
  pending: boolean;
  onSave: (v: TaskDraft) => void;
  onRemove: (id: string) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(task?.name ?? "");
  const [emoji, setEmoji] = useState(task?.emoji ?? "");
  // Both timers are opt-in per activity: the toggle enables the minutes field.
  const [notify, setNotify] = useState(task?.limit_min != null);
  const [minutes, setMinutes] = useState(task?.limit_min ? String(task.limit_min) : "30");
  const [autoEnd, setAutoEnd] = useState(task?.end_min != null);
  const [endMinutes, setEndMinutes] = useState(task?.end_min ? String(task.end_min) : "20");
  const [next, setNext] = useState(task?.next_type_id ?? "");

  const parse = (on: boolean, raw: string) => (!on || raw.trim() === "" ? null : Number(raw));
  const bad = (on: boolean, v: number | null) => on && (v === null || !Number.isInteger(v) || v < 1 || v > 600);

  const notifyAfterMin = parse(notify, minutes);
  const endAfterMin = parse(autoEnd, endMinutes);
  const badMinutes = bad(notify, notifyAfterMin);
  const badEnd = bad(autoEnd, endAfterMin);
  const alertNeverFires =
    notify && autoEnd && !badMinutes && !badEnd && endAfterMin! <= notifyAfterMin!;
  const canSave = name.trim() !== "" && !badMinutes && !badEnd && !pending;
  const nextName = options.find((o) => o.id === next)?.name ?? null;

  return (
    <form
      className="flex flex-wrap items-end gap-2 rounded-2xl border border-line bg-surface-2/60 p-2.5"
      onSubmit={(e) => {
        e.preventDefault();
        if (canSave) {
          onSave({
            id: task?.id ?? null,
            name: name.trim(),
            emoji: emoji.trim() || null,
            notifyAfterMin,
            endAfterMin,
            nextTypeId: autoEnd && next !== "" ? next : null,
          });
        }
      }}
    >
      <label className="flex flex-col gap-1">
        <span className="text-[10px] font-semibold tracking-wider text-muted uppercase">Icon</span>
        <input
          className="input w-14 px-2 py-1.5 text-center text-sm"
          value={emoji}
          onChange={(e) => setEmoji(e.target.value)}
          placeholder="🙂"
          maxLength={8}
          aria-label="Icon"
        />
      </label>
      <label className="flex min-w-32 flex-1 flex-col gap-1">
        <span className="text-[10px] font-semibold tracking-wider text-muted uppercase">Activity</span>
        <input
          className="input py-1.5 text-sm"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Standing desk"
          maxLength={60}
          autoFocus
          aria-label="Activity name"
        />
      </label>

      <div className="flex flex-col gap-1">
        <label className="flex items-center gap-1.5 text-[10px] font-semibold tracking-wider text-muted uppercase">
          <input
            type="checkbox"
            checked={notify}
            onChange={(e) => setNotify(e.target.checked)}
            aria-label="Notify me about this activity"
          />
          🔔 Notify after
        </label>
        <span className="flex items-center gap-1">
          <input
            className={`input w-20 px-2 py-1.5 text-sm ${notify ? "" : "opacity-40"}`}
            type="number"
            min={1}
            max={600}
            value={notify ? minutes : ""}
            disabled={!notify}
            onChange={(e) => setMinutes(e.target.value)}
            placeholder="off"
            aria-label="Notify after minutes"
          />
          <span className={`text-xs text-muted ${notify ? "" : "opacity-40"}`}>min</span>
        </span>
      </div>

      <div className="flex flex-col gap-1">
        <label className="flex items-center gap-1.5 text-[10px] font-semibold tracking-wider text-muted uppercase">
          <input
            type="checkbox"
            checked={autoEnd}
            onChange={(e) => setAutoEnd(e.target.checked)}
            aria-label="End this activity by itself"
          />
          ⏹ End after
        </label>
        <span className="flex items-center gap-1">
          <input
            className={`input w-20 px-2 py-1.5 text-sm ${autoEnd ? "" : "opacity-40"}`}
            type="number"
            min={1}
            max={600}
            value={autoEnd ? endMinutes : ""}
            disabled={!autoEnd}
            onChange={(e) => setEndMinutes(e.target.value)}
            placeholder="off"
            aria-label="End after minutes"
          />
          <span className={`text-xs text-muted ${autoEnd ? "" : "opacity-40"}`}>min</span>
          <span className={`text-xs text-muted ${autoEnd ? "" : "opacity-40"}`}>→ then start</span>
          <select
            className={`input w-40 px-2 py-1.5 text-sm ${autoEnd ? "" : "opacity-40"}`}
            value={next}
            disabled={!autoEnd}
            onChange={(e) => setNext(e.target.value)}
            aria-label="Activity to start next"
          >
            <option value="">nothing</option>
            {options.map((o) => (
              <option key={o.id} value={o.id}>
                {o.emoji ? `${o.emoji} ` : ""}
                {o.name}
              </option>
            ))}
          </select>
        </span>
      </div>

      <div className="flex items-center gap-1.5">
        <button className="btn-primary px-3 py-2 text-sm" disabled={!canSave}>
          {task ? "Save" : "Add"}
        </button>
        {task && (
          <button
            type="button"
            className="btn-ghost text-xs text-muted"
            disabled={pending}
            onClick={() => onRemove(task.id)}
            title="Keeps the activity and its history, just off this line"
          >
            Remove from line
          </button>
        )}
        <button type="button" className="text-muted" onClick={onClose} aria-label="Close editor">
          ✕
        </button>
      </div>

      {(badMinutes || badEnd) && <p className="w-full text-xs text-red-600">Timers must be 1–600 minutes.</p>}
      {alertNeverFires && (
        <p className="w-full text-xs text-red-600">
          It ends at {endMinutes} min, before the alert at {minutes} min — so the alert never fires.
        </p>
      )}
      <p className="w-full text-[11px] text-muted">
        {!notify && !autoEnd
          ? "No timers — it just runs and logs until you switch."
          : [
              notify && "Notify only sends a browser alert (then every 5 min) and keeps counting.",
              autoEnd &&
                (nextName
                  ? `End stops it by itself and starts ${nextName} — needs this tab open.`
                  : "End stops it by itself — needs this tab open."),
            ]
              .filter(Boolean)
              .join(" ")}
      </p>
    </form>
  );
}
