"use client";

import { useActionState } from "react";
import { signIn } from "./actions";

export default function LoginPage() {
  const [state, action, pending] = useActionState(signIn, undefined);

  return (
    <main className="mx-auto flex w-full max-w-xs flex-1 flex-col justify-center px-5 py-12">
      <div className="mb-6 flex items-center gap-3">
        <svg viewBox="0 0 64 64" className="h-10 w-10" aria-hidden>
          <rect width="64" height="64" rx="14" fill="var(--accent)" />
          <path d="M14 38h9l5-14 8 24 5-10h9" fill="none" stroke="var(--paper)" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <h1 className="text-2xl font-semibold tracking-tight">Daylog</h1>
      </div>

      <form action={action} className="flex flex-col gap-3">
        <input
          className="input"
          type="password"
          name="password"
          placeholder="Password"
          aria-label="Password"
          autoComplete="current-password"
          autoFocus
          required
        />
        {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
        <button className="btn-primary" disabled={pending}>
          {pending ? "…" : "Enter"}
        </button>
      </form>
    </main>
  );
}
