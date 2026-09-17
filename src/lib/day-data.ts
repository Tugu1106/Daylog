import "server-only";
import { createClient } from "@/lib/supabase/server";
import { dayBoundsMs } from "@/lib/time";

/** Everything the day timeline needs for one local day. */
export async function loadDay(tz: string, day: string) {
  const { start: startMs, end: endMs } = dayBoundsMs(tz, day);
  const start = new Date(startMs).toISOString();
  const end = new Date(endMs).toISOString();
  const supabase = await createClient();

  const [actions, levels, carry, events, actionTypes, painTypes] = await Promise.all([
    supabase
      .from("actions")
      .select("*")
      .lt("started_at", end)
      .or(`ended_at.is.null,ended_at.gt.${start}`)
      .order("started_at"),
    supabase
      .from("pain_levels")
      .select("id, recorded_at, level")
      .gte("recorded_at", start)
      .lt("recorded_at", end)
      .order("recorded_at"),
    supabase
      .from("pain_levels")
      .select("id, recorded_at, level")
      .lt("recorded_at", start)
      .order("recorded_at", { ascending: false })
      .limit(1),
    supabase
      .from("pain_events")
      .select("*")
      .gte("occurred_at", start)
      .lt("occurred_at", end)
      .order("occurred_at"),
    supabase.from("action_types").select("*").order("sort").order("name"),
    supabase.from("pain_types").select("*").order("sort").order("name"),
  ]);

  const firstError = [actions, levels, carry, events, actionTypes, painTypes].find((r) => r.error)?.error;
  if (firstError) throw new Error(firstError.message);

  return {
    day,
    startMs,
    endMs,
    actions: actions.data ?? [],
    levels: [...(carry.data ?? []), ...(levels.data ?? [])],
    events: events.data ?? [],
    actionTypes: actionTypes.data ?? [],
    painTypes: painTypes.data ?? [],
  };
}

export type DayData = Awaited<ReturnType<typeof loadDay>>;
