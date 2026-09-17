// Option lists for the logging forms. Values are stored as-is in the database;
// categories must match the CHECK constraints in the migration.

export const ACTIVITY_CATEGORIES = [
  { value: "stretch", label: "Stretch", emoji: "🧘" },
  { value: "mobility", label: "Mobility", emoji: "🌀" },
  { value: "strength", label: "Strength", emoji: "🏋️" },
  { value: "exercise", label: "Exercise", emoji: "💪" },
  { value: "cardio", label: "Cardio", emoji: "🏃" },
  { value: "walk", label: "Walk", emoji: "🚶" },
  { value: "therapy", label: "Therapy", emoji: "💆" },
  { value: "sport", label: "Sport", emoji: "⚽" },
  { value: "sitting", label: "Sitting", emoji: "🪑" },
  { value: "standing", label: "Standing", emoji: "🧍" },
  { value: "driving", label: "Driving", emoji: "🚗" },
  { value: "lifting", label: "Lifting / carrying", emoji: "📦" },
  { value: "work", label: "Work", emoji: "💻" },
  { value: "sleep", label: "Sleep", emoji: "😴" },
  { value: "other", label: "Other", emoji: "•" },
] as const;

export const EXERCISE_CATEGORIES = ACTIVITY_CATEGORIES.filter((c) =>
  ["exercise", "stretch", "mobility", "strength", "cardio", "walk", "therapy", "other"].includes(
    c.value,
  ),
);

export const BODY_AREAS = [
  { value: "lower_back", label: "Lower back" },
  { value: "mid_back", label: "Mid back" },
  { value: "upper_back", label: "Upper back" },
  { value: "neck", label: "Neck" },
  { value: "shoulder_l", label: "L shoulder" },
  { value: "shoulder_r", label: "R shoulder" },
  { value: "glute_l", label: "L glute" },
  { value: "glute_r", label: "R glute" },
  { value: "hip_l", label: "L hip" },
  { value: "hip_r", label: "R hip" },
  { value: "leg_l", label: "L leg" },
  { value: "leg_r", label: "R leg" },
  { value: "sciatic", label: "Sciatic / radiating" },
] as const;

export const PAIN_TYPES = [
  { value: "dull", label: "Dull ache" },
  { value: "sharp", label: "Sharp" },
  { value: "stiff", label: "Stiff" },
  { value: "tight", label: "Tight" },
  { value: "burning", label: "Burning" },
  { value: "shooting", label: "Shooting" },
  { value: "numb", label: "Numb / tingling" },
  { value: "spasm", label: "Spasm" },
] as const;

export const PAIN_CONTEXTS = [
  "Woke up",
  "Sitting long",
  "Standing long",
  "Bending",
  "Lifting",
  "Walking",
  "After exercise",
  "During exercise",
  "Driving",
  "Lying down",
  "Coughing / sneezing",
  "Random",
] as const;

export function labelFor(list: readonly { value: string; label: string }[], value: string) {
  return list.find((i) => i.value === value)?.label ?? value;
}

export function categoryMeta(value: string) {
  return ACTIVITY_CATEGORIES.find((c) => c.value === value) ?? ACTIVITY_CATEGORIES.at(-1)!;
}
