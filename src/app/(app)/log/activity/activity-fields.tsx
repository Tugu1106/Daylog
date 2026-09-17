"use client";

import { useState } from "react";
import { Chips, DateTimeField, PainScale, TextArea, TextField } from "@/components/fields";
import { ACTIVITY_CATEGORIES } from "@/lib/constants";
import type { Tables } from "@/lib/database.types";

type Exercise = Pick<Tables<"exercises">, "id" | "name" | "category" | "default_duration_min">;

export function ActivityFields({ exercises }: { exercises: Exercise[] }) {
  const [exerciseId, setExerciseId] = useState("");
  const picked = exercises.find((e) => e.id === exerciseId);
  const [showStrength, setShowStrength] = useState(false);

  return (
    <>
      {exercises.length > 0 && (
        <label className="field">
          <span className="field-label">From your exercises</span>
          <select
            name="exercise_id"
            className="input"
            value={exerciseId}
            onChange={(e) => setExerciseId(e.target.value)}
          >
            <option value="">— none / something else —</option>
            {exercises.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
        </label>
      )}

      {!picked && (
        <>
          <Chips name="category" label="Type" multiple={false} options={ACTIVITY_CATEGORIES} />
          <TextField label="Name" name="name" placeholder="e.g. Cat-cow, office chair, 5k walk" />
        </>
      )}

      <div className="grid grid-cols-2 gap-3">
        <TextField
          key={picked?.id ?? "none"}
          label="Duration (min)"
          name="duration_min"
          type="number"
          inputMode="numeric"
          min={0}
          defaultValue={picked?.default_duration_min ?? undefined}
        />
        <TextField label="Effort (1–10)" name="effort" type="number" inputMode="numeric" min={1} max={10} />
      </div>

      {showStrength ? (
        <div className="grid grid-cols-3 gap-3">
          <TextField label="Sets" name="sets" type="number" inputMode="numeric" min={0} />
          <TextField label="Reps" name="reps" type="number" inputMode="numeric" min={0} />
          <TextField label="Weight kg" name="weight_kg" type="number" inputMode="decimal" min={0} step="0.5" />
        </div>
      ) : (
        <button type="button" className="btn-ghost self-start" onClick={() => setShowStrength(true)}>
          + Sets / reps / weight
        </button>
      )}

      <PainScale name="pain_before" label="Pain before" optional />
      <PainScale name="pain_after" label="Pain after" optional hint="Log this right after — it's what Insights uses." />
      <DateTimeField name="started_at" label="Started at" />
      <TextField label="Tags (comma separated)" name="tags" placeholder="morning, gym, pt-routine" />
      <TextArea label="Notes" name="notes" />
    </>
  );
}
