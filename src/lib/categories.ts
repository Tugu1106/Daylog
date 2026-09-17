// Must match the CHECK constraint on action_types.category.
export const ACTION_CATEGORIES = [
  { value: "exercise", label: "Exercise" },
  { value: "stretch", label: "Stretch" },
  { value: "mobility", label: "Mobility" },
  { value: "strength", label: "Strength" },
  { value: "cardio", label: "Cardio" },
  { value: "walk", label: "Walk" },
  { value: "sport", label: "Sport" },
  { value: "therapy", label: "Therapy" },
  { value: "sleep", label: "Sleep" },
  { value: "rest", label: "Rest" },
  { value: "sitting", label: "Sitting" },
  { value: "standing", label: "Standing" },
  { value: "driving", label: "Driving" },
  { value: "lifting", label: "Lifting" },
  { value: "work", label: "Work" },
  { value: "other", label: "Other" },
] as const;

export type ActionCategory = (typeof ACTION_CATEGORIES)[number]["value"];

/** Categories that count as "moving your body" for day summaries. */
export const ACTIVE_CATEGORIES = new Set<string>([
  "exercise",
  "stretch",
  "mobility",
  "strength",
  "cardio",
  "walk",
  "sport",
  "therapy",
]);

export const SEDENTARY_CATEGORIES = new Set<string>(["sitting", "driving", "work"]);

export function isCategory(v: string): v is ActionCategory {
  return ACTION_CATEGORIES.some((c) => c.value === v);
}
