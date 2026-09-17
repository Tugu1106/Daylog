import { ActionForm } from "@/components/action-form";
import { PageHeader } from "@/components/page-header";
import { createClient } from "@/lib/supabase/server";
import { logActivity } from "../../actions";
import { ActivityFields } from "./activity-fields";

export default async function LogActivityPage() {
  const supabase = await createClient();
  const { data: exercises } = await supabase
    .from("exercises")
    .select("id, name, category, default_duration_min")
    .eq("archived", false)
    .order("name");

  return (
    <>
      <PageHeader title="Log activity" back="/" />
      <ActionForm action={logActivity} submitLabel="Save activity">
        <ActivityFields exercises={exercises ?? []} />
      </ActionForm>
    </>
  );
}
