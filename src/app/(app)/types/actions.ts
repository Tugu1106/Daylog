"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isCategory } from "@/lib/categories";

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

export async function saveActionType(_: FormState, fd: FormData): Promise<FormState> {
  const id = str(fd, "id");
  const name = str(fd, "name", 60);
  const category = str(fd, "category") ?? "other";
  if (!name) return { error: "Name is required." };
  if (!isCategory(category)) return { error: "Unknown category." };

  const row = {
    name,
    category,
    emoji: str(fd, "emoji", 8),
    color: color(fd, "#2f5d50"),
  };
  const supabase = await createClient();
  const { error } = id
    ? await supabase.from("action_types").update(row).eq("id", id)
    : await supabase.from("action_types").insert(row);
  return finish(error);
}

export async function savePainType(_: FormState, fd: FormData): Promise<FormState> {
  const id = str(fd, "id");
  const name = str(fd, "name", 60);
  if (!name) return { error: "Name is required." };

  const row = {
    name,
    body_area: str(fd, "body_area", 60),
    description: str(fd, "description", 500),
    color: color(fd, "#c23a3a"),
  };
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

export async function seedDefaults() {
  const supabase = await createClient();
  await supabase.rpc("seed_default_types");
  revalidatePath("/", "layout");
}
