"use client";

import { useEffect, useState } from "react";
import type { Action, ActionType, PainEvent } from "@/lib/database.types";
import { formatDuration, fromDateTimeInput, toDateTimeInput } from "@/lib/time";
import { ScaleGrid } from "./context-menu";

function Sheet({
  title,
  onClose,
  children,
}: {
  title: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" onClick={onClose}>
      <div
        role="dialog"
        aria-modal
        className="max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-line bg-surface p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button onClick={onClose} className="text-muted" aria-label="Close">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <span className="mb-1.5 block text-xs font-semibold tracking-wider text-muted uppercase">{children}</span>;
}

export function ActionSheet({
  tz,
  action,
  emoji,
  pending,
  onClose,
  onSave,
  onDelete,
}: {
  tz: string;
  action: Action;
  emoji: string | null;
  pending: boolean;
  onClose: () => void;
  onSave: (v: {
    startedAt: number;
    endedAt: number | null;
    effort: number | null;
    pain: number | null;
    notes: string | null;
  }) => void;
  onDelete: () => void;
}) {
  const [start, setStart] = useState(toDateTimeInput(tz, action.started_at));
  const [running, setRunning] = useState(action.ended_at === null);
  const [end, setEnd] = useState(() => toDateTimeInput(tz, action.ended_at ?? Date.now()));
  const [effort, setEffort] = useState<number | null>(action.effort);
  const [pain, setPain] = useState<number | null>(action.pain);
  const [notes, setNotes] = useState(action.notes ?? "");

  const startMs = fromDateTimeInput(tz, start);
  const endMs = running ? null : fromDateTimeInput(tz, end);
  const invalid = startMs === null || (!running && (endMs === null || endMs < startMs));

  return (
    <Sheet
      onClose={onClose}
      title={
        <span className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-sm" style={{ background: action.color }} />
          {emoji} {action.name}
        </span>
      }
    >
      <div className="flex flex-col gap-4">
        <label>
          <Label>Start</Label>
          <input type="datetime-local" className="input" value={start} onChange={(e) => setStart(e.target.value)} />
        </label>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <Label>End</Label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={running} onChange={(e) => setRunning(e.target.checked)} />
              Still going
            </label>
          </div>
          {!running && (
            <input type="datetime-local" className="input" value={end} onChange={(e) => setEnd(e.target.value)} />
          )}
          {startMs !== null && endMs !== null && endMs >= startMs && (
            <p className="mt-1 text-xs text-muted">Duration {formatDuration(endMs - startMs)}</p>
          )}
          {!running && endMs !== null && startMs !== null && endMs < startMs && (
            <p className="mt-1 text-xs text-red-600">End is before start.</p>
          )}
        </div>

        <div>
          <Label>Effort {effort !== null && `· ${effort}/10`}</Label>
          <div className="grid grid-cols-10 gap-1">
            {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setEffort(effort === n ? null : n)}
                className={`h-9 rounded-lg text-sm font-semibold ${effort === n ? "chip-on" : "bg-surface-2"}`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        <div>
          <Label>Pain during this {pain !== null && `· ${pain}/10`}</Label>
          <ScaleGrid value={pain} onPick={(n) => setPain(pain === n ? null : n)} />
        </div>

        <label>
          <Label>Notes</Label>
          <textarea className="input min-h-20" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>

        <div className="flex gap-2">
          <button
            className="btn-primary flex-1"
            disabled={pending || invalid}
            onClick={() => onSave({ startedAt: startMs!, endedAt: endMs, effort, pain, notes })}
          >
            {pending ? "Saving…" : "Save"}
          </button>
          <button className="btn-ghost text-red-600" disabled={pending} onClick={onDelete}>
            Delete
          </button>
        </div>
      </div>
    </Sheet>
  );
}

export function PainEventSheet({
  tz,
  event,
  pending,
  onClose,
  onSave,
  onDelete,
}: {
  tz: string;
  event: PainEvent;
  pending: boolean;
  onClose: () => void;
  onSave: (v: { at: number; intensity: number | null; notes: string | null }) => void;
  onDelete: () => void;
}) {
  const [at, setAt] = useState(toDateTimeInput(tz, event.occurred_at));
  const [intensity, setIntensity] = useState<number | null>(event.intensity);
  const [notes, setNotes] = useState(event.notes ?? "");
  const atMs = fromDateTimeInput(tz, at);

  return (
    <Sheet
      onClose={onClose}
      title={
        <span className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full" style={{ background: event.color }} />
          {event.name}
        </span>
      }
    >
      <div className="flex flex-col gap-4">
        <label>
          <Label>When</Label>
          <input type="datetime-local" className="input" value={at} onChange={(e) => setAt(e.target.value)} />
        </label>
        <div>
          <Label>Intensity {intensity !== null && `· ${intensity}/10`}</Label>
          <ScaleGrid value={intensity} onPick={(n) => setIntensity(intensity === n ? null : n)} />
        </div>
        <label>
          <Label>Notes</Label>
          <textarea
            className="input min-h-20"
            value={notes}
            placeholder="What triggered it?"
            onChange={(e) => setNotes(e.target.value)}
          />
        </label>
        <div className="flex gap-2">
          <button
            className="btn-primary flex-1"
            disabled={pending || atMs === null}
            onClick={() => onSave({ at: atMs!, intensity, notes })}
          >
            {pending ? "Saving…" : "Save"}
          </button>
          <button className="btn-ghost text-red-600" disabled={pending} onClick={onDelete}>
            Delete
          </button>
        </div>
      </div>
    </Sheet>
  );
}

/** Manual logging: pick an action and type its start and end. */
export function NewActionSheet({
  tz,
  types,
  from,
  to,
  pending,
  onClose,
  onCreate,
}: {
  tz: string;
  types: ActionType[];
  from: number;
  to: number | null;
  pending: boolean;
  onClose: () => void;
  onCreate: (
    type: ActionType,
    from: number,
    to: number | null,
    extra: { effort: number | null; notes: string | null },
  ) => void;
}) {
  const live = types.filter((t) => !t.archived);
  const [typeId, setTypeId] = useState(live[0]?.id ?? "");
  const [start, setStart] = useState(() => toDateTimeInput(tz, from));
  const [running, setRunning] = useState(to === null);
  const [end, setEnd] = useState(() => toDateTimeInput(tz, to ?? from + 30 * 60000));
  const [effort, setEffort] = useState<number | null>(null);
  const [notes, setNotes] = useState("");

  const startMs = fromDateTimeInput(tz, start);
  const endMs = running ? null : fromDateTimeInput(tz, end);
  const type = live.find((t) => t.id === typeId);
  const badOrder = !running && startMs !== null && endMs !== null && endMs < startMs;
  const invalid = !type || startMs === null || (!running && endMs === null) || badOrder;

  return (
    <Sheet onClose={onClose} title="Log an action">
      <div className="flex flex-col gap-4">
        <div>
          <Label>What</Label>
          <div className="grid grid-cols-2 gap-1 sm:grid-cols-3">
            {live.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTypeId(t.id)}
                className={`flex items-center gap-1.5 rounded-lg border px-2 py-2 text-left text-sm ${
                  t.id === typeId ? "border-accent bg-accent/10" : "border-line"
                }`}
              >
                <span
                  className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-sm"
                  style={{ background: `${t.color}33` }}
                >
                  {t.emoji ?? "•"}
                </span>
                <span className="truncate">{t.name}</span>
              </button>
            ))}
          </div>
        </div>

        <label>
          <Label>Start</Label>
          <input type="datetime-local" className="input" value={start} onChange={(e) => setStart(e.target.value)} />
        </label>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <Label>End</Label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={running} onChange={(e) => setRunning(e.target.checked)} />
              Still going
            </label>
          </div>
          {!running && (
            <input type="datetime-local" className="input" value={end} onChange={(e) => setEnd(e.target.value)} />
          )}
          {!running && startMs !== null && endMs !== null && !badOrder && (
            <p className="mt-1 text-xs text-muted">Duration {formatDuration(endMs - startMs)}</p>
          )}
          {badOrder && <p className="mt-1 text-xs text-red-600">End is before start.</p>}
        </div>

        <div>
          <Label>Effort {effort !== null && `· ${effort}/10`}</Label>
          <div className="grid grid-cols-10 gap-1">
            {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setEffort(effort === n ? null : n)}
                className={`h-9 rounded-lg text-sm font-semibold ${effort === n ? "chip-on" : "bg-surface-2"}`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        <label>
          <Label>Notes</Label>
          <textarea className="input min-h-20" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>

        <button
          className="btn-primary"
          disabled={pending || invalid}
          onClick={() => onCreate(type!, startMs!, endMs, { effort, notes })}
        >
          {pending ? "Saving…" : "Save action"}
        </button>
      </div>
    </Sheet>
  );
}

/** Yes/no dialog for destructive things. */
export function ConfirmDialog({
  title,
  body,
  confirmLabel,
  pending,
  onConfirm,
  onClose,
}: {
  title: string;
  body: React.ReactNode;
  confirmLabel: string;
  pending: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Sheet onClose={onClose} title={title}>
      <div className="flex flex-col gap-4">
        <div className="text-sm">{body}</div>
        <div className="flex gap-2">
          <button className="btn-ghost flex-1 py-3" onClick={onClose} autoFocus>
            No, keep it
          </button>
          <button
            className="flex-1 rounded-xl bg-red-600 px-4 py-3 text-base font-semibold text-white disabled:opacity-60"
            disabled={pending}
            onClick={onConfirm}
          >
            {pending ? "…" : confirmLabel}
          </button>
        </div>
      </div>
    </Sheet>
  );
}

/** End a forgotten action at a time you type (yesterday evening, etc.). */
export function EndActionSheet({
  tz,
  action,
  emoji,
  defaultAt,
  now,
  pending,
  onClose,
  onEnd,
}: {
  tz: string;
  action: Action;
  emoji: string | null;
  defaultAt: number;
  now: number;
  pending: boolean;
  onClose: () => void;
  onEnd: (at: number) => void;
}) {
  const [value, setValue] = useState(() => toDateTimeInput(tz, defaultAt));
  const atMs = fromDateTimeInput(tz, value);
  const startMs = new Date(action.started_at).getTime();
  const tooEarly = atMs !== null && atMs < startMs;
  const future = atMs !== null && atMs > now + 60_000;

  return (
    <Sheet
      onClose={onClose}
      title={
        <span className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-sm" style={{ background: action.color }} />
          End {emoji} {action.name}
        </span>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-sm text-muted">
          Started {toDateTimeInput(tz, action.started_at).replace("T", " at ")} and still running.
        </p>
        <label>
          <Label>Ended at</Label>
          <input
            type="datetime-local"
            className="input"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            autoFocus
          />
        </label>
        {atMs !== null && !tooEarly && !future && (
          <p className="text-xs text-muted">Duration {formatDuration(atMs - startMs)}</p>
        )}
        {tooEarly && <p className="text-xs text-red-600">That is before the action started.</p>}
        {future && <p className="text-xs text-red-600">That time is in the future.</p>}
        <button
          className="btn-primary"
          disabled={pending || atMs === null || tooEarly || future}
          onClick={() => onEnd(atMs!)}
        >
          {pending ? "Saving…" : "End it"}
        </button>
      </div>
    </Sheet>
  );
}
