"use client";

import { useActionState, useState } from "react";
import { signIn, signUp } from "./actions";

export default function LoginPage() {
  const [mode, setMode] = useState<"in" | "up">("in");
  const [inState, inAction, inPending] = useActionState(signIn, undefined);
  const [upState, upAction, upPending] = useActionState(signUp, undefined);
  const state = mode === "in" ? inState : upState;
  const pending = mode === "in" ? inPending : upPending;

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-5 py-12">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight">Daylog</h1>
        <p className="mt-1 text-muted">Log pain and movement. Find what helps.</p>
      </div>

      <form action={mode === "in" ? inAction : upAction} className="card flex flex-col gap-4">
        <label className="field">
          <span className="field-label">Email</span>
          <input className="input" type="email" name="email" autoComplete="email" required />
        </label>
        <label className="field">
          <span className="field-label">Password</span>
          <input
            className="input"
            type="password"
            name="password"
            autoComplete={mode === "in" ? "current-password" : "new-password"}
            minLength={mode === "up" ? 8 : undefined}
            required
          />
        </label>

        {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
        {mode === "up" && upState?.ok && (
          <p className="text-sm text-emerald-700">Check your email to confirm your account.</p>
        )}

        <button className="btn-primary" disabled={pending}>
          {pending ? "…" : mode === "in" ? "Sign in" : "Create account"}
        </button>
      </form>

      <button
        type="button"
        onClick={() => setMode(mode === "in" ? "up" : "in")}
        className="mt-4 text-sm text-muted underline underline-offset-4"
      >
        {mode === "in" ? "First time? Create an account" : "Have an account? Sign in"}
      </button>
    </main>
  );
}
