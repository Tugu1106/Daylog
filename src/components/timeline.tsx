import { BODY_AREAS, categoryMeta, labelFor } from "@/lib/constants";
import { formatTime } from "@/lib/time";
import type { Tables } from "@/lib/database.types";
import { deleteEntry, setNextDayPain } from "@/app/(app)/actions";
import { PainBadge } from "@/components/pain-badge";

type Pain = Tables<"pain_logs">;
type Activity = Tables<"activity_logs">;

export type TimelineItem =
  | { kind: "pain"; at: string; row: Pain }
  | { kind: "activity"; at: string; row: Activity };

export function toTimeline(pains: Pain[], activities: Activity[]): TimelineItem[] {
  return [
    ...pains.map((row) => ({ kind: "pain" as const, at: row.logged_at, row })),
    ...activities.map((row) => ({ kind: "activity" as const, at: row.started_at, row })),
  ].sort((a, b) => b.at.localeCompare(a.at));
}

function DeleteButton({ kind, id }: { kind: string; id: string }) {
  return (
    <form action={deleteEntry}>
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="id" value={id} />
      <button className="text-xs text-muted hover:text-red-600" aria-label="Delete entry">
        Delete
      </button>
    </form>
  );
}

export function Timeline({ items, empty }: { items: TimelineItem[]; empty?: string }) {
  if (items.length === 0) {
    return <p className="py-6 text-center text-sm text-muted">{empty ?? "Nothing logged yet."}</p>;
  }
  return (
    <ul className="flex flex-col gap-2">
      {items.map((item) => (
        <li key={`${item.kind}-${item.row.id}`} className="card flex gap-3 p-3">
          <span className="w-11 shrink-0 pt-0.5 text-xs tabular-nums text-muted">
            {formatTime(item.at)}
          </span>
          {item.kind === "pain" ? <PainRow row={item.row} /> : <ActivityRow row={item.row} />}
        </li>
      ))}
    </ul>
  );
}

function PainRow({ row }: { row: Pain }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 font-medium">
          <PainBadge value={row.intensity} /> Pain
        </span>
        <DeleteButton kind="pain" id={row.id} />
      </div>
      <p className="text-sm text-muted">
        {[row.body_areas.map((a) => labelFor(BODY_AREAS, a)).join(", "), row.context]
          .filter(Boolean)
          .join(" · ")}
      </p>
      {row.notes && <p className="text-sm">{row.notes}</p>}
    </div>
  );
}

function ActivityRow({ row }: { row: Activity }) {
  const meta = categoryMeta(row.category);
  const details = [
    row.duration_min != null && `${row.duration_min} min`,
    row.sets != null && row.reps != null && `${row.sets}×${row.reps}`,
    row.weight_kg != null && `${row.weight_kg} kg`,
    row.effort != null && `effort ${row.effort}/10`,
  ].filter(Boolean);
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1">
      <div className="flex items-center justify-between gap-2">
        <span className="truncate font-medium">
          <span aria-hidden className="mr-1.5">
            {meta.emoji}
          </span>
          {row.name}
        </span>
        <DeleteButton kind="activity" id={row.id} />
      </div>
      {details.length > 0 && <p className="text-sm text-muted">{details.join(" · ")}</p>}
      {(row.pain_before != null || row.pain_after != null) && (
        <p className="flex items-center gap-1.5 text-sm">
          <PainBadge value={row.pain_before} /> → <PainBadge value={row.pain_after} />
          <span className="ml-1 text-muted">next day</span>
          <NextDayPicker id={row.id} value={row.pain_next_day} />
        </p>
      )}
      {row.notes && <p className="text-sm">{row.notes}</p>}
    </div>
  );
}

function NextDayPicker({ id, value }: { id: string; value: number | null }) {
  return (
    <form action={setNextDayPain} className="inline-flex">
      <input type="hidden" name="id" value={id} />
      <select
        name="pain_next_day"
        defaultValue={value ?? ""}
        className="rounded-md border border-line bg-surface px-1 py-0.5 text-sm"
      >
        <option value="">–</option>
        {Array.from({ length: 11 }, (_, n) => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
      </select>
      <button className="ml-1 text-xs text-accent">save</button>
    </form>
  );
}
