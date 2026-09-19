"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type FormState = { error?: string; ok?: number } | undefined;

function str(fd: FormData, key: string, max = 200) {
  const v = fd.get(key);
  if (typeof v !== "string") return null;
  const t = v.trim().slice(0, max);
  return t === "" ? null : t;
}

function color(fd: FormData, fallback: string) {
  const v = str(fd, "color");
  return v && /^#[0-9a-fA-F]{6}$/.test(v) ? v : fallback;
}

function finish(error: { code?: string; message: string } | null): FormState {
  if (error) {
    return { error: error.code === "23505" ? "You already have one with that name." : error.message };
  }
  revalidatePath("/", "layout");
  return { ok: Date.now() };
}

// ---- actions & pain vocabulary -------------------------------------------

export async function saveActionType(_: FormState, fd: FormData): Promise<FormState> {
  const id = str(fd, "id");
  const name = str(fd, "name", 60);
  if (!name) return { error: "Name is required." };

  const row = { name, emoji: str(fd, "emoji", 8), color: color(fd, "#2f5d50") };
  const supabase = await createClient();
  const { error } = id
    ? await supabase.from("action_types").update(row).eq("id", id)
    : await supabase.from("action_types").insert({ ...row, category: "other" });
  return finish(error);
}

export async function savePainType(_: FormState, fd: FormData): Promise<FormState> {
  const id = str(fd, "id");
  const name = str(fd, "name", 60);
  if (!name) return { error: "Name is required." };

  const row = { name, color: color(fd, "#c23a3a") };
  const supabase = await createClient();
  const { error } = id
    ? await supabase.from("pain_types").update(row).eq("id", id)
    : await supabase.from("pain_types").insert(row);
  return finish(error);
}

export async function setArchived(fd: FormData) {
  const id = str(fd, "id");
  const table = str(fd, "table");
  if (!id || (table !== "action_types" && table !== "pain_types")) return;
  const supabase = await createClient();
  await supabase
    .from(table)
    .update({ archived: str(fd, "archived") === "true" })
    .eq("id", id);
  revalidatePath("/", "layout");
}

/** Deletes the type itself. Entries already logged keep their name and colour. */
export async function deleteType(fd: FormData) {
  const id = str(fd, "id");
  const table = str(fd, "table");
  if (!id || (table !== "action_types" && table !== "pain_types")) return;
  const supabase = await createClient();
  await supabase.from(table).delete().eq("id", id);
  revalidatePath("/", "layout");
}

export async function seedDefaults() {
  const supabase = await createClient();
  await supabase.rpc("seed_default_types");
  revalidatePath("/", "layout");
}

// ---- timer bar -----------------------------------------------------------

/** Notification threshold for one activity on the timer bar (empty = no alert). */
export async function saveTimerSettings(_: FormState, fd: FormData): Promise<FormState> {
  const id = str(fd, "id");
  if (!id) return { error: "Unknown activity." };
  const raw = str(fd, "limit_min");
  const minutes = raw === null ? null : Number(raw);
  if (minutes !== null && (!Number.isInteger(minutes) || minutes < 1 || minutes > 600)) {
    return { error: "Notify after 1–600 minutes." };
  }
  const supabase = await createClient();
  const { error } = await supabase.from("action_types").update({ limit_min: minutes }).eq("id", id);
  return finish(error);
}

export async function addToTimerBar(fd: FormData) {
  const id = str(fd, "id");
  if (!id) return;
  const supabase = await createClient();
  const { data } = await supabase
    .from("action_types")
    .select("sort")
    .eq("timer", true)
    .order("sort", { ascending: false })
    .limit(1);
  const sort = (data?.[0]?.sort ?? 0) + 1;
  await supabase.from("action_types").update({ timer: true, sort }).eq("id", id);
  revalidatePath("/", "layout");
}

export async function removeFromTimerBar(fd: FormData) {
  const id = str(fd, "id");
  if (!id) return;
  const supabase = await createClient();
  await supabase.from("action_types").update({ timer: false }).eq("id", id);
  revalidatePath("/", "layout");
}

/** Swap an activity with its neighbour so the bar keeps your order. */
export async function moveTimerTask(fd: FormData) {
  const id = str(fd, "id");
  const up = str(fd, "dir") === "up";
  if (!id) return;

  const supabase = await createClient();
  const { data: bar } = await supabase
    .from("action_types")
    .select("id, sort")
    .eq("timer", true)
    .order("sort")
    .order("name");
  if (!bar) return;

  const index = bar.findIndex((t) => t.id === id);
  const other = bar[up ? index - 1 : index + 1];
  if (index === -1 || !other) return;

  // Sort values can be equal after seeding, so renumber the whole bar in one pass.
  const reordered = [...bar];
  reordered[index] = other;
  reordered[up ? index - 1 : index + 1] = bar[index];
  await Promise.all(
    reordered.map((t, i) => supabase.from("action_types").update({ sort: i + 1 }).eq("id", t.id)),
  );
  revalidatePath("/", "layout");
}
