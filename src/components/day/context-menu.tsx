"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Action, ActionType, PainType } from "@/lib/database.types";
import { formatDuration, formatTime } from "@/lib/time";
import { painColor } from "@/components/pain-badge";
import type { ContextRequest } from "./timeline";

type Step = { kind: "root" } | { kind: "level" } | { kind: "intensity"; type: PainType };

export type MenuHandlers = {
  start: (typeId: string, at: number) => void;
  end: (actionId: string, at: number) => void;
  painLevel: (level: number, at: number) => void;
  painEvent: (typeId: string, at: number, intensity: number | null) => void;
  edit: (target: NonNullable<ContextRequest["target"]>) => void;
  remove: (target: NonNullable<ContextRequest["target"]>) => void;
};

export function ContextMenu({
  tz,
  req,
  now,
  actions,
  actionTypes,
  painTypes,
  targetLabel,
  onClose,
  handlers,
}: {
  tz: string;
  req: ContextRequest;
  now: number | null;
  actions: Action[];
  actionTypes: ActionType[];
  painTypes: PainType[];
  targetLabel: string | null;
  onClose: () => void;
  handlers: MenuHandlers;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [step, setStep] = useState<Step>({ kind: "root" });
  const [pos, setPos] = useState({ left: req.x, top: req.y });
  const { at, target } = req;

  // Keep the menu inside the viewport.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    const pad = 8;
    setPos({
      left: Math.max(pad, Math.min(req.x, window.innerWidth - width - pad)),
      top: Math.max(pad, Math.min(req.y, window.innerHeight - height - pad)),
    });
  }, [req.x, req.y, step]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onDown, true);
    window.addEventListener("resize", onClose);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onDown, true);
      window.removeEventListener("resize", onClose);
    };
  }, [onClose]);

  const isNow = now !== null && Math.abs(now - at) < 90_000;
  const timeLabel = isNow ? `now · ${formatTime(tz, at)}` : formatTime(tz, at);
  const running = actions.filter(
    (a) => a.ended_at === null && new Date(a.started_at).getTime() <= at && a.id !== target?.id,
  );
  const targetAction = target?.kind === "action" ? actions.find((a) => a.id === target.id) : null;
  const liveTypes = actionTypes.filter((t) => !t.archived);
  const livePain = painTypes.filter((t) => !t.archived);

  const act = (fn: () => void) => () => {
    fn();
    onClose();
  };

  return (
    <div
      ref={ref}
      role="menu"
      className="fixed z-50 max-h-[80dvh] w-72 overflow-y-auto rounded-2xl border border-line bg-surface p-2 text-sm shadow-2xl"
      style={pos}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="flex items-center justify-between px-2 pt-1 pb-2">
        <span className="font-semibold tabular-nums">{timeLabel}</span>
        {step.kind !== "root" && (
          <button className="text-xs text-muted" onClick={() => setStep({ kind: "root" })}>
            ← Back
          </button>
        )}
      </div>

      {step.kind === "root" && (
        <>
          {target && (
            <Section title={targetLabel ?? "Selected"}>
              {targetAction?.ended_at === null && new Date(targetAction.started_at).getTime() <= at && (
                <Item onClick={act(() => handlers.end(targetAction.id, at))}>
                  ■ End here ({formatDuration(at - new Date(targetAction.started_at).getTime())})
                </Item>
              )}
              {target.kind !== "level" && <Item onClick={act(() => handlers.edit(target))}>Edit…</Item>}
              <Item danger onClick={act(() => handlers.remove(target))}>
                Delete
              </Item>
            </Section>
          )}

          {running.length > 0 && (
            <Section title={`End at ${formatTime(tz, at)}`}>
              {running.map((a) => (
                <Item key={a.id} onClick={act(() => handlers.end(a.id, at))}>
                  <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: a.color }} />
                  <span className="truncate">{a.name}</span>
                  <span className="ml-auto text-xs text-muted">
                    {formatDuration(at - new Date(a.started_at).getTime())}
                  </span>
                </Item>
              ))}
            </Section>
          )}

          <Section title={`Start at ${formatTime(tz, at)}`}>
            {liveTypes.length === 0 && <p className="px-2 py-1 text-xs text-muted">No action types — add some in Types.</p>}
            <div className="grid grid-cols-2 gap-1">
              {liveTypes.map((t) => (
                <button
                  key={t.id}
                  role="menuitem"
                  onClick={act(() => handlers.start(t.id, at))}
                  className="flex items-center gap-1.5 rounded-lg px-2 py-2 text-left hover:bg-surface-2"
                >
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-sm" style={{ background: `${t.color}33` }}>
                    {t.emoji ?? "•"}
                  </span>
                  <span className="truncate">{t.name}</span>
                </button>
              ))}
            </div>
          </Section>

          <Section title="Pain">
            <Item onClick={() => setStep({ kind: "level" })}>
              <span className="h-2.5 w-6 shrink-0 rounded-full bg-gradient-to-r from-[var(--pain-low)] to-[var(--pain-max)]" />
              Set pain level…
            </Item>
            {livePain.map((t) => (
              <Item key={t.id} onClick={() => setStep({ kind: "intensity", type: t })}>
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: t.color }} />
                <span className="truncate">{t.name}</span>
                {t.body_area && <span className="ml-auto truncate text-xs text-muted">{t.body_area}</span>}
              </Item>
            ))}
          </Section>
        </>
      )}

      {step.kind === "level" && (
        <Section title="Pain level">
          <ScaleGrid onPick={(n) => act(() => handlers.painLevel(n, at))()} />
        </Section>
      )}

      {step.kind === "intensity" && (
        <Section title={`${step.type.name} — how strong?`}>
          <ScaleGrid onPick={(n) => act(() => handlers.painEvent(step.type.id, at, n))()} />
          <Item onClick={act(() => handlers.painEvent(step.type.id, at, null))}>Skip intensity</Item>
        </Section>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-line py-1.5 first-of-type:border-t-0">
      <p className="px-2 pb-1 text-[10px] font-semibold tracking-wider text-muted uppercase">{title}</p>
      {children}
    </div>
  );
}

function Item({
  children,
  onClick,
  danger,
}: {
  children: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      role="menuitem"
      onClick={onClick}
      className={`flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left hover:bg-surface-2 ${
        danger ? "text-red-600" : ""
      }`}
    >
      {children}
    </button>
  );
}

export function ScaleGrid({ onPick, value }: { onPick: (n: number) => void; value?: number | null }) {
  return (
    <div className="grid grid-cols-6 gap-1 p-1">
      {Array.from({ length: 11 }, (_, n) => (
        <button
          key={n}
          type="button"
          onClick={() => onPick(n)}
          className="h-10 rounded-lg text-sm font-semibold text-white tabular-nums transition hover:scale-105"
          style={{
            background: painColor(n),
            outline: value === n ? "3px solid var(--ink)" : undefined,
            outlineOffset: 1,
          }}
        >
          {n}
        </button>
      ))}
    </div>
  );
}
