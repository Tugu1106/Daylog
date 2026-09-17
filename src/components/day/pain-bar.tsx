"use client";

import { useEffect, useRef, useState } from "react";
import { painColor } from "@/components/pain-badge";

const COMMIT_DELAY_MS = 900;

const WORDS = ["None", "Barely", "Mild", "Mild", "Noticeable", "Distracting", "Strong", "Strong", "Severe", "Severe", "Worst"];

/**
 * The "current pain" glider. Moving it records a reading once you stop for a moment;
 * the timeline line holds that level until the next reading.
 */
export function PainBar({
  current,
  onCommit,
  children,
}: {
  current: number | null;
  onCommit: (level: number) => void;
  children?: React.ReactNode;
}) {
  const [draft, setDraft] = useState<number | null>(null);
  const timer = useRef<number | null>(null);
  const value = draft ?? current;

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  function change(n: number) {
    setDraft(n);
    if (timer.current) clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      timer.current = null;
      if (n !== current) onCommit(n);
    }, COMMIT_DELAY_MS);
  }

  const pending = draft !== null && draft !== current;

  return (
    <section className="flex items-center gap-4 rounded-3xl border border-line bg-surface px-4 py-3">
      <div className="w-20 shrink-0">
        <p className="text-[10px] font-semibold tracking-wider text-muted uppercase">Pain now</p>
        <p className="text-3xl leading-none font-semibold tabular-nums" style={{ color: painColor(value) }}>
          {value ?? "–"}
        </p>
        <p className="mt-0.5 truncate text-[11px] text-muted">
          {pending ? "saving…" : value === null ? "not set" : WORDS[value]}
        </p>
      </div>
      <div className="min-w-0 flex-1">
        <input
          type="range"
          min={0}
          max={10}
          step={1}
          value={value ?? 0}
          aria-label="Current pain level"
          onChange={(e) => change(Number(e.target.value))}
          className={`pain-range w-full ${value === null ? "opacity-60" : ""}`}
        />
        <div className="mt-1 flex justify-between px-0.5 text-[10px] text-muted tabular-nums">
          {Array.from({ length: 11 }, (_, n) => (
            <span key={n}>{n}</span>
          ))}
        </div>
      </div>
      {children && <div className="flex shrink-0 flex-col gap-1.5">{children}</div>}
    </section>
  );
}
