"use client";

import { useOptimistic, useState, useTransition } from "react";
import type { DayData } from "@/lib/day-data";
import type { Action, ActionType, PainEvent, PainType } from "@/lib/database.types";
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

type Level = DayData["levels"][number];
type Entries = { actions: Action[]; levels: Level[]; events: PainEvent[] };

type Op =
  | { kind: "addAction"; row: Action }
  | { kind: "patchAction"; id: string; patch: Partial<Action> }
  | { kind: "deleteAction"; id: string }
  | { kind: "addLevel"; row: Level }
  | { kind: "deleteLevel"; id: string }
  | { kind: "addEvent"; row: PainEvent }
  | { kind: "patchEvent"; id: string; patch: Partial<PainEvent> }
  | { kind: "deleteEvent"; id: string };

function reduce(state: Entries, op: Op): Entries {
  switch (op.kind) {
    case "addAction":
      return { ...state, actions: [...state.actions, op.row] };
    case "patchAction":
      return { ...state, actions: state.actions.map((a) => (a.id === op.id ? { ...a, ...op.patch } : a)) };
    case "deleteAction":
      return { ...state, actions: state.actions.filter((a) => a.id !== op.id) };
    case "addLevel":
      return {
        ...state,
        levels: [...state.levels, op.row].sort((a, b) => a.recorded_at.localeCompare(b.recorded_at)),
      };
    case "deleteLevel":
      return { ...state, levels: state.levels.filter((l) => l.id !== op.id) };
    case "addEvent":
      return { ...state, events: [...state.events, op.row] };
    case "patchEvent":
      return { ...state, events: state.events.map((e) => (e.id === op.id ? { ...e, ...op.patch } : e)) };
    case "deleteEvent":
      return { ...state, events: state.events.filter((e) => e.id !== op.id) };
  }
}

const iso = (ms: number) => new Date(ms).toISOString();

/**
 * Day entries with optimistic mutations: the screen updates instantly, the server
 * call runs in the background, and a failed call rolls the change back.
 */
export function useDayState(data: DayData) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [entries, apply] = useOptimistic<Entries, Op>(
    { actions: data.actions, levels: data.levels, events: data.events },
    reduce,
  );

  function mutate(op: Op, call: () => Promise<Result>) {
    startTransition(async () => {
      apply(op);
      const res = await call();
      if (res.error) setError(res.error);
    });
  }

  const ops = {
    startAction(type: ActionType, at: number) {
      const id = crypto.randomUUID();
      const row: Action = {
        id,
        user_id: "",
        type_id: type.id,
        name: type.name,
        category: type.category,
        color: type.color,
        started_at: iso(at),
        ended_at: null,
        effort: null,
        notes: null,
        created_at: iso(Date.now()),
      };
      mutate({ kind: "addAction", row }, () =>
        startAction({ id, typeId: type.id, name: type.name, category: type.category, color: type.color, at }),
      );
    },
    endAction(id: string, at: number) {
      mutate({ kind: "patchAction", id, patch: { ended_at: iso(at) } }, () => endAction({ id, at }));
    },
    updateAction(id: string, v: { startedAt: number; endedAt: number | null; effort: number | null; notes: string | null }) {
      mutate(
        {
          kind: "patchAction",
          id,
          patch: {
            started_at: iso(v.startedAt),
            ended_at: v.endedAt === null ? null : iso(v.endedAt),
            effort: v.effort,
            notes: v.notes,
          },
        },
        () => updateAction({ id, ...v }),
      );
    },
    deleteAction(id: string) {
      mutate({ kind: "deleteAction", id }, () => deleteAction(id));
    },
    addLevel(level: number, at: number) {
      const id = crypto.randomUUID();
      mutate({ kind: "addLevel", row: { id, level, recorded_at: iso(at) } }, () => addPainLevel({ id, level, at }));
    },
    deleteLevel(id: string) {
      mutate({ kind: "deleteLevel", id }, () => deletePainLevel(id));
    },
    addEvent(type: PainType, at: number, intensity: number | null) {
      const id = crypto.randomUUID();
      const row: PainEvent = {
        id,
        user_id: "",
        type_id: type.id,
        name: type.name,
        color: type.color,
        occurred_at: iso(at),
        intensity,
        notes: null,
        created_at: iso(Date.now()),
      };
      mutate({ kind: "addEvent", row }, () =>
        addPainEvent({ id, typeId: type.id, name: type.name, color: type.color, at, intensity }),
      );
    },
    updateEvent(id: string, v: { at: number; intensity: number | null; notes: string | null }) {
      mutate(
        { kind: "patchEvent", id, patch: { occurred_at: iso(v.at), intensity: v.intensity, notes: v.notes } },
        () => updatePainEvent({ id, ...v }),
      );
    },
    deleteEvent(id: string) {
      mutate({ kind: "deleteEvent", id }, () => deletePainEvent(id));
    },
  };

  return { entries, ops, pending, error, clearError: () => setError(null) };
}
