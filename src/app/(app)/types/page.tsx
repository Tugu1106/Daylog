import { createClient } from "@/lib/supabase/server";
import { seedDefaults } from "./actions";
import { ActionTypeRow, PainTypeRow } from "./type-forms";

export default async function TypesPage() {
  const supabase = await createClient();
  const [actionTypes, painTypes] = await Promise.all([
    supabase.from("action_types").select("*").order("archived").order("sort").order("name"),
    supabase.from("pain_types").select("*").order("archived").order("sort").order("name"),
  ]);
  const empty = !actionTypes.data?.length && !painTypes.data?.length;

  return (
    <div className="mx-auto w-full max-w-4xl px-3 py-5 sm:px-5">
      <h1 className="text-2xl font-semibold tracking-tight">Types</h1>
      <p className="mb-5 text-sm text-muted">
        What you pick from when you right-click the timeline. Archive instead of deleting to keep history.
      </p>

      {empty && (
        <form action={seedDefaults} className="card mb-5 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm">Start with a ready-made set (sleep, stretching, sitting… and common back pains)?</p>
          <button className="btn-primary px-3 py-2 text-sm">Add starter set</button>
        </form>
      )}

      <section className="card mb-5">
        <h2 className="section-title">Actions</h2>
        <div className="divide-y divide-line">
          {(actionTypes.data ?? []).map((t) => (
            <ActionTypeRow key={t.id} type={t} />
          ))}
          <ActionTypeRow />
        </div>
      </section>

      <section className="card">
        <h2 className="section-title">Pain types</h2>
        <div className="divide-y divide-line">
          {(painTypes.data ?? []).map((t) => (
            <PainTypeRow key={t.id} type={t} />
          ))}
          <PainTypeRow />
        </div>
      </section>
    </div>
  );
}
