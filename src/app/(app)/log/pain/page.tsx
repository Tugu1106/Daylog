import { ActionForm } from "@/components/action-form";
import { Chips, DateTimeField, PainScale, TextArea, TextField } from "@/components/fields";
import { BODY_AREAS, PAIN_CONTEXTS, PAIN_TYPES } from "@/lib/constants";
import { logPain } from "../../actions";
import { PageHeader } from "@/components/page-header";

export default function LogPainPage() {
  return (
    <>
      <PageHeader title="Log pain" back="/" />
      <ActionForm action={logPain} submitLabel="Save pain">
        <PainScale name="intensity" label="Pain level" hint="0 = none · 5 = distracting · 10 = worst imaginable" />
        <Chips name="body_areas" label="Where" options={BODY_AREAS} defaultValue={["lower_back"]} />
        <Chips name="pain_types" label="Feels like" options={PAIN_TYPES} />
        <Chips
          name="context"
          label="What were you doing?"
          multiple={false}
          options={PAIN_CONTEXTS.map((c) => ({ value: c, label: c }))}
        />
        <DateTimeField name="logged_at" />
        <TextField label="Tags (comma separated)" name="tags" placeholder="flare-up, cold weather" />
        <TextArea label="Notes" name="notes" />
      </ActionForm>
    </>
  );
}
