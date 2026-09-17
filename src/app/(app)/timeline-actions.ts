"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type Result = { error?: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Allow a little clock skew between phone and server.
const FUTURE_SLACK_MS = 2 * 60 * 1000;

function isId(v: unknown): v is string {
  return typeof v === "string" && UUID.test(v);
}

function isInt(v: unknown, min: number, max: number): v is number {
  return typeof v === "number" && Number.isInteger(v) && v >= min && v <= max;
}

function toIso(ms: unknown) {
  if (typeof ms !== "number" || !Number.isFinite(ms)) return null;
  if (ms > Date.now() + FUTURE_SLACK_MS) return null;
  return new Date(ms).toISOString();
}

function cleanNotes(v: unknown) {
  if (typeof v !== "string") return null;
  const t = v.trim().slice(0, 2000);
  return t === "" ? null : t;
}

function done(error?: { message: string } | null): Result {
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return {};
}

const FUTURE = { error: "That time is in the future." };

// ---- actions -------------------------------------------------------------

export async function startAction(input: { typeId: string; at: number }): Promise<Result> {
  if (!isId(input.typeId)) return { error: "Unknown action type." };
  const startedAt = toIso(input.at);
  if (!startedAt) return FUTURE;

  const supabase = await createClient();
  const { data: type, error } = await supabase
    .from("action_types")
    .select("id, name, category, color")
    .eq("id", input.typeId)
    .single();
  if (error || !type) return { error: "Unknown action type." };

  const res = await supabase.from("actions").insert({
    type_id: type.id,
    name: type.name,
    category: type.category,
    color: type.color,
    started_at: startedAt,
  });
  return done(res.error);
}

export async function endAction(input: { id: string; at: number }): Promise<Result> {
  if (!isId(input.id)) return { error: "Unknown action." };
  const endedAt = toIso(input.at);
  if (!endedAt) return FUTURE;

  const supabase = await createClient();
  const { data: action } = await supabase
    .from("actions")
    .select("started_at")
    .eq("id", input.id)
    .single();
  if (!action) return { error: "Unknown action." };
  if (new Date(action.started_at).getTime() > input.at) {
    return { error: "End time is before the start." };
  }
  const res = await supabase.from("actions").update({ ended_at: endedAt }).eq("id", input.id);
  return done(res.error);
}

export async function updateAction(input: {
  id: string;
  startedAt: number;
  endedAt: number | null;
  effort: number | null;
  notes: string | null;
}): Promise<Result> {
  if (!isId(input.id)) return { error: "Unknown action." };
  const startedAt = toIso(input.startedAt);
  if (!startedAt) return FUTURE;
  let endedAt: string | null = null;
  if (input.endedAt !== null) {
    endedAt = toIso(input.endedAt);
    if (!endedAt) return FUTURE;
    if (input.endedAt < input.startedAt) return { error: "End time is before the start." };
  }
  if (input.effort !== null && !isInt(input.effort, 1, 10)) return { error: "Effort is 1–10." };

  const supabase = await createClient();
  const res = await supabase
    .from("actions")
    .update({
      started_at: startedAt,
      ended_at: endedAt,
      effort: input.effort,
      notes: cleanNotes(input.notes),
    })
    .eq("id", input.id);
  return done(res.error);
}

export async function deleteAction(id: string): Promise<Result> {
  if (!isId(id)) return { error: "Unknown action." };
  const supabase = await createClient();
  return done((await supabase.from("actions").delete().eq("id", id)).error);
}

// ---- pain ----------------------------------------------------------------

export async function addPainLevel(input: { level: number; at: number }): Promise<Result> {
  if (!isInt(input.level, 0, 10)) return { error: "Pain level is 0–10." };
  const recordedAt = toIso(input.at);
  if (!recordedAt) return FUTURE;
  const supabase = await createClient();
  const res = await supabase.from("pain_levels").insert({ level: input.level, recorded_at: recordedAt });
  return done(res.error);
}

export async function deletePainLevel(id: string): Promise<Result> {
  if (!isId(id)) return { error: "Unknown reading." };
  const supabase = await createClient();
  return done((await supabase.from("pain_levels").delete().eq("id", id)).error);
}

export async function addPainEvent(input: {
  typeId: string;
  at: number;
  intensity: number | null;
}): Promise<Result> {
  if (!isId(input.typeId)) return { error: "Unknown pain type." };
  if (input.intensity !== null && !isInt(input.intensity, 0, 10)) return { error: "Intensity is 0–10." };
  const occurredAt = toIso(input.at);
  if (!occurredAt) return FUTURE;

  const supabase = await createClient();
  const { data: type } = await supabase
    .from("pain_types")
    .select("id, name, color")
    .eq("id", input.typeId)
    .single();
  if (!type) return { error: "Unknown pain type." };

  const res = await supabase.from("pain_events").insert({
    type_id: type.id,
    name: type.name,
    color: type.color,
    occurred_at: occurredAt,
    intensity: input.intensity,
  });
  return done(res.error);
}

export async function updatePainEvent(input: {
  id: string;
  at: number;
  intensity: number | null;
  notes: string | null;
}): Promise<Result> {
  if (!isId(input.id)) return { error: "Unknown pain event." };
  if (input.intensity !== null && !isInt(input.intensity, 0, 10)) return { error: "Intensity is 0–10." };
  const occurredAt = toIso(input.at);
  if (!occurredAt) return FUTURE;
  const supabase = await createClient();
  const res = await supabase
    .from("pain_events")
    .update({ occurred_at: occurredAt, intensity: input.intensity, notes: cleanNotes(input.notes) })
    .eq("id", input.id);
  return done(res.error);
}

export async function deletePainEvent(id: string): Promise<Result> {
  if (!isId(id)) return { error: "Unknown pain event." };
  const supabase = await createClient();
  return done((await supabase.from("pain_events").delete().eq("id", id)).error);
}
