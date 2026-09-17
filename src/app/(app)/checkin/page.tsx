import { ActionForm } from "@/components/action-form";
import { PageHeader } from "@/components/page-header";
import { PainScale, Rating, TextArea, TextField } from "@/components/fields";
import { createClient } from "@/lib/supabase/server";
import { formatDay, localDay } from "@/lib/time";
import { saveCheckin } from "../actions";

export default async function CheckinPage({ searchParams }: PageProps<"/checkin">) {
  const { day: dayParam } = await searchParams;
  const day = typeof dayParam === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dayParam) ? dayParam : localDay();

  const supabase = await createClient();
  const { data: c } = await supabase.from("daily_checkins").select("*").eq("day", day).maybeSingle();

  return (
    <>
      <PageHeader title="Daily check-in" sub={formatDay(day)} back="/" />
      <ActionForm action={saveCheckin} submitLabel={c ? "Update check-in" : "Save check-in"}>
        <input type="hidden" name="day" value={day} />
        <PainScale name="overall_pain" label="Overall back pain today" defaultValue={c?.overall_pain} optional />
        <PainScale name="morning_stiffness" label="Morning stiffness" defaultValue={c?.morning_stiffness} optional />
        <div className="grid grid-cols-2 gap-3">
          <TextField
            label="Sleep (hours)"
            name="sleep_hours"
            type="number"
            inputMode="decimal"
            step="0.5"
            min={0}
            max={24}
            defaultValue={c?.sleep_hours ?? undefined}
          />
          <TextField
            label="Sitting (hours)"
            name="sitting_hours"
            type="number"
            inputMode="decimal"
            step="0.5"
            min={0}
            max={24}
            defaultValue={c?.sitting_hours ?? undefined}
          />
        </div>
        <Rating name="sleep_quality" label="Sleep quality" low="Awful" high="Great" defaultValue={c?.sleep_quality} />
        <Rating name="stress" label="Stress" low="Calm" high="Very stressed" defaultValue={c?.stress} />
        <Rating name="mood" label="Mood" low="Low" high="Great" defaultValue={c?.mood} />
        <TextField
          label="Steps"
          name="steps"
          type="number"
          inputMode="numeric"
          min={0}
          defaultValue={c?.steps ?? undefined}
        />
        <TextArea label="Notes" name="notes" defaultValue={c?.notes ?? undefined} />
      </ActionForm>
    </>
  );
}
