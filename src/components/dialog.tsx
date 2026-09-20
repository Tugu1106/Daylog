"use client";

import { useEffect } from "react";

/** Bottom sheet on a phone, centred dialog on a wider screen. Escape and the backdrop close it. */
export function Sheet({
  title,
  onClose,
  children,
}: {
  title: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" onClick={onClose}>
      <div
        role="dialog"
        aria-modal
        className="max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-line bg-surface p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button onClick={onClose} className="text-muted" aria-label="Close">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/** Yes/no dialog for anything that cannot be undone. */
export function ConfirmDialog({
  title,
  body,
  confirmLabel,
  cancelLabel = "No, keep it",
  pending,
  onConfirm,
  onClose,
}: {
  title: React.ReactNode;
  body: React.ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  pending: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Sheet onClose={onClose} title={title}>
      <div className="flex flex-col gap-4">
        <div className="text-sm">{body}</div>
        <div className="flex gap-2">
          <button className="btn-ghost flex-1 py-3" onClick={onClose} autoFocus>
            {cancelLabel}
          </button>
          <button className="btn-danger flex-1" disabled={pending} onClick={onConfirm}>
            {pending ? "…" : confirmLabel}
          </button>
        </div>
      </div>
    </Sheet>
  );
}
