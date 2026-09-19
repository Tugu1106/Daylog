"use client";

import { useEffect, useRef } from "react";

/**
 * A failed render (usually a session refresh losing a race) retries itself once,
 * so a hiccup is invisible instead of showing an error you have to reload past.
 */
export default function DayError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const retried = useRef(false);

  useEffect(() => {
    if (retried.current) return;
    retried.current = true;
    const id = setTimeout(reset, 200);
    return () => clearTimeout(id);
  }, [reset]);

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-3 px-5 py-16 text-center">
      <p className="text-sm text-muted">Reloading…</p>
      <button onClick={reset} className="btn-primary px-4 py-2 text-sm">
        Try again
      </button>
      {error.digest && <p className="text-[11px] text-muted">ref {error.digest}</p>}
    </div>
  );
}
