"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type ActionState = { error?: string; ok?: boolean } | undefined;

function field(fd: FormData, key: string) {
  const v = fd.get(key);
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}

export async function signIn(_: ActionState, fd: FormData): Promise<ActionState> {
  const email = field(fd, "email");
  const password = field(fd, "password");
  if (!email || !password) return { error: "Email and password are required." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: error.message };
  // Gives a brand-new account its starter action & pain types (no-op otherwise).
  await supabase.rpc("seed_default_types");
  redirect("/");
}

export async function signUp(_: ActionState, fd: FormData): Promise<ActionState> {
  const email = field(fd, "email");
  const password = field(fd, "password");
  if (!email || !password) return { error: "Email and password are required." };
  if (password.length < 8) return { error: "Use at least 8 characters." };

  const origin = (await headers()).get("origin") ?? "";
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: `${origin}/auth/callback` },
  });
  if (error) return { error: error.message };
  if (data.session) {
    await supabase.rpc("seed_default_types");
    redirect("/");
  }
  return { ok: true };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
