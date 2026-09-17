"use client";

import { useState } from "react";
import { painColor } from "@/components/pain-badge";

/** 0–10 tap scale. When `optional`, tapping the selected value clears it. */
export function PainScale({
  name,
  label,
  defaultValue = null,
  optional = false,
  hint,
}: {
  name: string;
  label: string;
  defaultValue?: number | null;
  optional?: boolean;
  hint?: string;
}) {
  const [value, setValue] = useState<number | null>(defaultValue);
  return (
    <fieldset className="field">
      <legend className="field-label">
        {label}
        {value !== null && (
          <span className="ml-2 font-semibold" style={{ color: painColor(value) }}>
            {value}/10
          </span>
        )}
        {optional && value === null && <span className="ml-2 text-muted">optional</span>}
      </legend>
      <input type="hidden" name={name} value={value ?? ""} />
      <div className="grid grid-cols-11 gap-1">
        {Array.from({ length: 11 }, (_, n) => {
          const active = value === n;
          return (
            <button
              key={n}
              type="button"
              aria-pressed={active}
              onClick={() => setValue(optional && active ? null : n)}
              className="h-11 rounded-lg text-sm font-semibold tabular-nums transition"
              style={
                active
                  ? { background: painColor(n), color: "white" }
                  : { background: "var(--surface-2)", color: "var(--ink)" }
              }
            >
              {n}
            </button>
          );
        })}
      </div>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </fieldset>
  );
}

/** Tappable chips. Multi-select emits repeated hidden inputs; single-select emits one. */
export function Chips({
  name,
  label,
  options,
  multiple = true,
  defaultValue = [],
}: {
  name: string;
  label: string;
  options: readonly { value: string; label: string; emoji?: string }[];
  multiple?: boolean;
  defaultValue?: string[];
}) {
  const [selected, setSelected] = useState<string[]>(defaultValue);
  const toggle = (v: string) =>
    setSelected((cur) =>
      multiple ? (cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v]) : cur[0] === v ? [] : [v],
    );
  return (
    <fieldset className="field">
      <legend className="field-label">{label}</legend>
      {selected.map((v) => (
        <input key={v} type="hidden" name={name} value={v} />
      ))}
      <div className="flex flex-wrap gap-2">
        {options.map((o) => {
          const active = selected.includes(o.value);
          return (
            <button
              key={o.value}
              type="button"
              aria-pressed={active}
              onClick={() => toggle(o.value)}
              className={`chip ${active ? "chip-on" : ""}`}
            >
              {o.emoji && <span aria-hidden>{o.emoji}</span>}
              {o.label}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

function toLocalInput(d: Date) {
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 16);
}

/** datetime-local in the browser's zone; submits an ISO string in a hidden input. */
export function DateTimeField({
  name,
  label = "When",
  defaultValue,
}: {
  name: string;
  label?: string;
  defaultValue?: string;
}) {
  const [local, setLocal] = useState(() => toLocalInput(defaultValue ? new Date(defaultValue) : new Date()));
  const iso = local ? new Date(local).toISOString() : "";
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <input
        type="datetime-local"
        className="input"
        value={local}
        onChange={(e) => setLocal(e.target.value)}
      />
      <input type="hidden" name={name} value={iso} />
    </label>
  );
}

export function TextField({
  label,
  className = "",
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className={`field ${className}`}>
      <span className="field-label">{label}</span>
      <input className="input" {...props} />
    </label>
  );
}

export function TextArea({
  label,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <textarea className="input min-h-20" rows={3} {...props} />
    </label>
  );
}

/** 1–5 rating (sleep quality, stress, mood). */
export function Rating({
  name,
  label,
  low,
  high,
  defaultValue = null,
}: {
  name: string;
  label: string;
  low: string;
  high: string;
  defaultValue?: number | null;
}) {
  const [value, setValue] = useState<number | null>(defaultValue);
  return (
    <fieldset className="field">
      <legend className="field-label">{label}</legend>
      <input type="hidden" name={name} value={value ?? ""} />
      <div className="grid grid-cols-5 gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            aria-pressed={value === n}
            onClick={() => setValue(value === n ? null : n)}
            className={`h-11 rounded-lg text-sm font-semibold ${value === n ? "chip-on" : "bg-surface-2"}`}
          >
            {n}
          </button>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-xs text-muted">
        <span>{low}</span>
        <span>{high}</span>
      </div>
    </fieldset>
  );
}
