import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { dayBounds, formatDay, localDay } from "@/lib/time";
import { Timeline, toTimeline } from "@/components/timeline";
import { PainBadge } from "@/components/pain-badge";

export default async function TodayPage() {
  const today = localDay();
  const { start, end } = dayBounds(today);
  const supabase = await createClient();

  const [pains, activities, checkin] = await Promise.all([
    supabase.from("pain_logs").select("*").gte("logged_at", start).lt("logged_at", end),
    supabase.from("activity_logs").select("*").gte("started_at", start).lt("started_at", end),
    supabase.from("daily_checkins").select("*").eq("day", today).maybeSingle(),
  ]);

  const items = toTimeline(pains.data ?? [], activities.data ?? []);
  const painValues = (pains.data ?? []).map((p) => p.intensity);
  const latest = pains.data?.toSorted((a, b) => b.logged_at.localeCompare(a.logged_at))[0];
  const avg = painValues.length
    ? Math.round((painValues.reduce((a, b) => a + b, 0) / painValues.length) * 10) / 10
    : null;
  const activeMinutes = (activities.data ?? [])
    .filter((a) => !["sitting", "driving", "sleep", "work", "standing"].includes(a.category))
    .reduce((sum, a) => sum + (a.duration_min ?? 0), 0);

  return (
    <div className="flex flex-col gap-6">
      <section>
        <p className="text-sm text-muted">{formatDay(today)}</p>
        <h1 className="text-2xl font-semibold tracking-tight">How&apos;s your back?</h1>
      </section>

      <section className="grid grid-cols-3 gap-2">
        <Stat label="Latest pain">
          <PainBadge value={latest?.intensity ?? null} size="lg" />
        </Stat>
        <Stat label="Avg today">
          <span className="text-2xl font-semibold tabular-nums">{avg ?? "–"}</span>
        </Stat>
        <Stat label="Active min">
          <span className="text-2xl font-semibold tabular-nums">{activeMinutes}</span>
        </Stat>
      </section>

      <section className="grid grid-cols-2 gap-2">
        <QuickLink href="/log/pain" title="Log pain" sub="How it feels now" tone="pain" />
        <QuickLink href="/log/activity" title="Log activity" sub="Exercise, sitting, walk…" />
        <Link
          href="/checkin"
          className="card col-span-2 flex items-center justify-between"
        >
          <div>
            <p className="font-semibold">Daily check-in</p>
            <p className="text-sm text-muted">
              {checkin.data ? "Done — tap to edit" : "Sleep, stiffness, stress, mood"}
            </p>
          </div>
          <span
            className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
              checkin.data ? "bg-accent text-(--accent-ink)" : "bg-surface-2 text-muted"
            }`}
          >
            {checkin.data ? "✓ Done" : "To do"}
          </span>
        </Link>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="section-title">Today</h2>
        <Timeline items={items} empty="Nothing logged today yet." />
      </section>
    </div>
  );
}

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="card flex flex-col items-start gap-2 p-3">
      <span className="text-xs text-muted">{label}</span>
      {children}
    </div>
  );
}

function QuickLink({
  href,
  title,
  sub,
  tone,
}: {
  href: string;
  title: string;
  sub: string;
  tone?: "pain";
}) {
  return (
    <Link
      href={href}
      className="card flex min-h-24 flex-col justify-between transition active:scale-[0.98]"
      style={tone === "pain" ? { borderColor: "var(--pain-high)" } : undefined}
    >
      <span className="text-2xl leading-none" aria-hidden>
        +
      </span>
      <span>
        <span className="block font-semibold">{title}</span>
        <span className="block text-xs text-muted">{sub}</span>
      </span>
    </Link>
  );
}
