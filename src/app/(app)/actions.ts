"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { list, num, str, tags, when, type ActionState } from "@/lib/form";
import { localDay } from "@/lib/time";

function fail(message: string): ActionState {
  return { error: message };
}

export async function logPain(_: ActionState, fd: FormData): Promise<ActionState> {
  const intensity = num(fd, "intensity");
  if (intensity === null) return fail("Pick a pain level.");

  const supabase = await createClient();
  const { error } = await supabase.from("pain_logs").insert({
    logged_at: when(fd, "logged_at"),
    intensity,
    body_areas: list(fd, "body_areas"),
    pain_types: list(fd, "pain_types"),
    context: list(fd, "context")[0] ?? str(fd, "context_other"),
    tags: tags(fd),
    notes: str(fd, "notes"),
  });
  if (error) return fail(error.message);

  revalidatePath("/", "layout");
  redirect("/");
}

export async function logActivity(_: ActionState, fd: FormData): Promise<ActionState> {
  const exerciseId = str(fd, "exercise_id");
  const category = list(fd, "category")[0];
  let name = str(fd, "name");

  const supabase = await createClient();

  let resolvedCategory = category;
  if (exerciseId) {
    const { data: ex } = await supabase
      .from("exercises")
      .select("name, category")
      .eq("id", exerciseId)
      .single();
    if (ex) {
      name ??= ex.name;
      resolvedCategory ??= ex.category;
    }
  }
  if (!resolvedCategory) return fail("Pick what kind of activity it was.");
  name ??= resolvedCategory.charAt(0).toUpperCase() + resolvedCategory.slice(1);

  const { error } = await supabase.from("activity_logs").insert({
    started_at: when(fd, "started_at"),
    category: resolvedCategory,
    exercise_id: exerciseId,
    name,
    duration_min: num(fd, "duration_min"),
    effort: num(fd, "effort"),
    sets: num(fd, "sets"),
    reps: num(fd, "reps"),
    weight_kg: num(fd, "weight_kg"),
    pain_before: num(fd, "pain_before"),
    pain_after: num(fd, "pain_after"),
    tags: tags(fd),
    notes: str(fd, "notes"),
  });
  if (error) return fail(error.message);

  revalidatePath("/", "layout");
  redirect("/");
}

export async function saveCheckin(_: ActionState, fd: FormData): Promise<ActionState> {
  const day = str(fd, "day") ?? localDay();
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (!userId) return fail("Not signed in.");

  const { error } = await supabase.from("daily_checkins").upsert(
    {
      user_id: userId,
      day,
      overall_pain: num(fd, "overall_pain"),
      morning_stiffness: num(fd, "morning_stiffness"),
      sleep_hours: num(fd, "sleep_hours"),
      sleep_quality: num(fd, "sleep_quality"),
      stress: num(fd, "stress"),
      mood: num(fd, "mood"),
      steps: num(fd, "steps"),
      sitting_hours: num(fd, "sitting_hours"),
      notes: str(fd, "notes"),
    },
    { onConflict: "user_id,day" },
  );
  if (error) return fail(error.message);

  revalidatePath("/", "layout");
  redirect("/");
}

export async function setNextDayPain(fd: FormData) {
  const id = str(fd, "id");
  const value = num(fd, "pain_next_day");
  if (!id) return;
  const supabase = await createClient();
  await supabase.from("activity_logs").update({ pain_next_day: value }).eq("id", id);
  revalidatePath("/", "layout");
}

export async function deleteEntry(fd: FormData) {
  const id = str(fd, "id");
  const kind = str(fd, "kind");
  if (!id) return;
  const table = kind === "pain" ? "pain_logs" : kind === "activity" ? "activity_logs" : null;
  if (!table) return;
  const supabase = await createClient();
  await supabase.from(table).delete().eq("id", id);
  revalidatePath("/", "layout");
}

export async function createExercise(_: ActionState, fd: FormData): Promise<ActionState> {
  const name = str(fd, "name");
  if (!name) return fail("Name is required.");
  const supabase = await createClient();
  const { error } = await supabase.from("exercises").insert({
    name,
    category: list(fd, "category")[0] ?? "exercise",
    description: str(fd, "description"),
    default_duration_min: num(fd, "default_duration_min"),
  });
  if (error) {
    return fail(error.code === "23505" ? "You already have an exercise with that name." : error.message);
  }
  revalidatePath("/exercises");
  return { ok: true };
}

export async function toggleExerciseArchived(fd: FormData) {
  const id = str(fd, "id");
  if (!id) return;
  const supabase = await createClient();
  await supabase
    .from("exercises")
    .update({ archived: str(fd, "archived") === "true" })
    .eq("id", id);
  revalidatePath("/exercises");
}
