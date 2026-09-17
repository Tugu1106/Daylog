import { ActionForm } from "@/components/action-form";
import { PageHeader } from "@/components/page-header";
import { Chips, TextField } from "@/components/fields";
import { categoryMeta, EXERCISE_CATEGORIES } from "@/lib/constants";
import { createClient } from "@/lib/supabase/server";
import { createExercise, toggleExerciseArchived } from "../actions";

export default async function ExercisesPage() {
  const supabase = await createClient();
  const { data: exercises } = await supabase
    .from("exercises")
    .select("*")
    .order("archived")
    .order("name");

  return (
    <>
      <PageHeader title="Exercises" sub="Your routine — pick these when logging." />

      <details className="card mb-6">
        <summary className="cursor-pointer font-semibold">+ Add exercise</summary>
        <ActionForm action={createExercise} submitLabel="Add" className="mt-4">
          <TextField label="Name" name="name" required placeholder="e.g. McGill curl-up" />
          <Chips
            name="category"
            label="Type"
            multiple={false}
            options={EXERCISE_CATEGORIES}
            defaultValue={["stretch"]}
          />
          <TextField label="Default duration (min)" name="default_duration_min" type="number" min={1} />
          <TextField label="How to do it / cues" name="description" />
        </ActionForm>
      </details>

      {(exercises ?? []).length === 0 && (
        <p className="py-6 text-center text-sm text-muted">No exercises yet — add your routine above.</p>
      )}

      <ul className="flex flex-col gap-2">
        {(exercises ?? []).map((e) => (
          <li key={e.id} className={`card flex items-center gap-3 p-3 ${e.archived ? "opacity-50" : ""}`}>
            <span aria-hidden className="text-xl">
              {categoryMeta(e.category).emoji}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{e.name}</p>
              <p className="truncate text-xs text-muted">
                {[e.default_duration_min && `${e.default_duration_min} min`, e.description]
                  .filter(Boolean)
                  .join(" · ") || categoryMeta(e.category).label}
              </p>
            </div>
            <form action={toggleExerciseArchived}>
              <input type="hidden" name="id" value={e.id} />
              <input type="hidden" name="archived" value={String(!e.archived)} />
              <button className="text-xs text-muted">{e.archived ? "Restore" : "Archive"}</button>
            </form>
          </li>
        ))}
      </ul>
    </>
  );
}
