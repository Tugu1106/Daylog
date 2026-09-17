import Link from "next/link";

export function PageHeader({ title, back, sub }: { title: string; back?: string; sub?: string }) {
  return (
    <div className="mb-5">
      {back && (
        <Link href={back} className="mb-2 inline-block text-sm text-muted">
          ← Back
        </Link>
      )}
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      {sub && <p className="mt-1 text-sm text-muted">{sub}</p>}
    </div>
  );
}
