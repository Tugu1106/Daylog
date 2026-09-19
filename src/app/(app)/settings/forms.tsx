"use client";

import { useActionState, useState } from "react";
import type { ActionType, PainType } from "@/lib/database.types";
import { ACTION_CATEGORIES } from "@/lib/categories";
import {
  addToTimerBar,
  moveTimerTask,
  removeFromTimerBar,
  saveActionType,
  savePainType,
  saveTimerSettings,
  setArchived,
  type FormState,
} from "./actions";

function Status({ state, pending }: { state: FormState; pending: boolean }) {
  if (pending) return <span className="text-xs text-muted">Saving…</span>;
  if (state?.error) return <span className="text-xs text-red-600">{state.error}</span>;
  if (state?.ok) return <span className="text-xs text-emerald-700">Saved</span>;
  return null;
}

function ArchiveButton({ table, id, archived }: { table: string; id: string; archived: boolean }) {
  return (
    <form action={setArchived}>
      <input type="hidden" name="table" value={table} />
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="archived" value={String(!archived)} />
      <button className="text-xs text-muted hover:text-ink">{archived ? "Restore" : "Archive"}</button>
    </form>
  );
}

// ---- timer bar -----------------------------------------------------------

/** One activity on the timer bar: order, notification threshold, remove. */
export function TimerBarRow({ type, first, last }: { type: ActionType; first: boolean; last: boolean }) {
  const [state, action, pending] = useActionState(saveTimerSettings, undefined);
  const [notify, setNotify] = useState(type.limit_min != null);

  return (
    <div className="flex flex-wrap items-center gap-2 py-2">
      <div className="flex shrink-0 flex-col">
        {(["up", "down"] as const).map((dir) => (
          <form action={moveTimerTask} key={dir}>
            <input type="hidden" name="id" value={type.id} />
            <input type="hidden" name="dir" value={dir} />
            <button
              className="px-1 text-[10px] leading-tight text-muted hover:text-ink disabled:opacity-25"
              disabled={dir === "up" ? first : last}
              aria-label={dir === "up" ? "Move up" : "Move down"}
            >
              {dir === "up" ? "▲" : "▼"}
            </button>
          </form>
        ))}
      </div>

      <span
        className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-lg"
        style={{ background: `${type.color}22` }}
      >
        {type.emoji ?? "•"}
      </span>
      <span className="min-w-28 flex-1 truncate text-sm font-medium">{type.name}</span>

      <form action={action} className="flex items-center gap-2">
        <input type="hidden" name="id" value={type.id} />
        <label className="flex items-center gap-1.5 text-xs text-muted">
          <input
            type="checkbox"
            checked={notify}
            onChange={(e) => setNotify(e.target.checked)}
            aria-label={`Notify about ${type.name}`}
          />
          Notify after
        </label>
        <input
          name="limit_min"
          type="number"
          min={1}
          max={600}
          defaultValue={type.limit_min ?? 30}
          disabled={!notify}
          className={`input w-20 px-2 py-1.5 text-sm ${notify ? "" : "opacity-40"}`}
          aria-label={`Notify after minutes for ${type.name}`}
        />
        <span className={`text-xs text-muted ${notify ? "" : "opacity-40"}`}>min</span>
        <button className="btn-ghost text-xs" disabled={pending}>
          Save
        </button>
        <Status state={state} pending={pending} />
      </form>

      <form action={removeFromTimerBar} className="ml-auto">
        <input type="hidden" name="id" value={type.id} />
        <button className="text-xs text-muted hover:text-red-600">Remove from bar</button>
      </form>
    </div>
  );
}

export function AddToTimerBar({ options }: { options: ActionType[] }) {
  const [id, setId] = useState("");
  if (options.length === 0) {
    return <p className="py-2 text-xs text-muted">Every action is already on the bar.</p>;
  }
  return (
    <form action={addToTimerBar} className="flex flex-wrap items-center gap-2 py-2">
      <select
        name="id"
        value={id}
        onChange={(e) => setId(e.target.value)}
        className="input w-56 py-2 text-sm"
        aria-label="Action to add to the timer bar"
      >
        <option value="">Add an existing action…</option>
        {options.map((t) => (
          <option key={t.id} value={t.id}>
            {t.emoji ? `${t.emoji} ` : ""}
            {t.name}
          </option>
        ))}
      </select>
      <button className="btn-primary px-3 py-2 text-sm" disabled={!id}>
        Add to bar
      </button>
    </form>
  );
}

// ---- actions & pain types ------------------------------------------------

export function ActionTypeRow({ type }: { type?: ActionType }) {
  const [state, action, pending] = useActionState(saveActionType, undefined);
  const [color, setColor] = useState(type?.color ?? "#3f8f6b");
  const isNew = !type;

  return (
    <div className={`flex flex-wrap items-center gap-2 py-2 ${type?.archived ? "opacity-50" : ""}`}>
      <form action={action} className="flex flex-1 flex-wrap items-center gap-2" key={isNew ? state?.ok : undefined}>
        {type && <input type="hidden" name="id" value={type.id} />}
        <input
          type="color"
          name="color"
          value={color}
          onChange={(e) => setColor(e.target.value)}
          className="h-9 w-9 shrink-0 cursor-pointer rounded-lg border border-line bg-transparent"
          aria-label="Color"
        />
        <input
          name="emoji"
          defaultValue={type?.emoji ?? ""}
          placeholder="🙂"
          maxLength={8}
          className="input w-14 px-2 text-center"
          aria-label="Emoji"
        />
        <input
          name="name"
          defaultValue={type?.name ?? ""}
          placeholder={isNew ? "New action, e.g. McGill big 3" : ""}
          required
          maxLength={60}
          className="input min-w-40 flex-1"
          aria-label="Name"
        />
        <select name="category" defaultValue={type?.category ?? "exercise"} className="input w-32" aria-label="Category">
          {ACTION_CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
        {type?.timer && <span className="text-[11px] text-muted">on timer bar</span>}
        <button className={isNew ? "btn-primary px-3 py-2 text-sm" : "btn-ghost"} disabled={pending}>
          {isNew ? "Add" : "Save"}
        </button>
        <Status state={state} pending={pending} />
      </form>
      {type && <ArchiveButton table="action_types" id={type.id} archived={type.archived} />}
    </div>
  );
}

export function PainTypeRow({ type }: { type?: PainType }) {
  const [state, action, pending] = useActionState(savePainType, undefined);
  const [color, setColor] = useState(type?.color ?? "#d8662f");
  const isNew = !type;

  return (
    <div className={`flex flex-wrap items-center gap-2 py-2 ${type?.archived ? "opacity-50" : ""}`}>
      <form action={action} className="flex flex-1 flex-wrap items-center gap-2" key={isNew ? state?.ok : undefined}>
        {type && <input type="hidden" name="id" value={type.id} />}
        <input
          type="color"
          name="color"
          value={color}
          onChange={(e) => setColor(e.target.value)}
          className="h-9 w-9 shrink-0 cursor-pointer rounded-lg border border-line bg-transparent"
          aria-label="Color"
        />
        <input
          name="name"
          defaultValue={type?.name ?? ""}
          placeholder={isNew ? "New pain, e.g. Hip pinch" : ""}
          required
          maxLength={60}
          className="input min-w-40 flex-1"
          aria-label="Name"
        />
        <input
          name="body_area"
          defaultValue={type?.body_area ?? ""}
          placeholder="Where (lower back…)"
          maxLength={60}
          className="input w-40"
          aria-label="Body area"
        />
        <input
          name="description"
          defaultValue={type?.description ?? ""}
          placeholder="How it feels"
          maxLength={500}
          className="input min-w-40 flex-1"
          aria-label="Description"
        />
        <button className={isNew ? "btn-primary px-3 py-2 text-sm" : "btn-ghost"} disabled={pending}>
          {isNew ? "Add" : "Save"}
        </button>
        <Status state={state} pending={pending} />
      </form>
      {type && <ArchiveButton table="pain_types" id={type.id} archived={type.archived} />}
    </div>
  );
}
