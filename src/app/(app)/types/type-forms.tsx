"use client";

import { useActionState, useState } from "react";
import type { ActionType, PainType } from "@/lib/database.types";
import { ACTION_CATEGORIES } from "@/lib/categories";
import { saveActionType, savePainType, setArchived, type FormState } from "./actions";

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
