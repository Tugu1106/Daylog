export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-[1600px] animate-pulse px-3 py-5 sm:px-5">
      <div className="mb-4 h-12 w-48 rounded-xl bg-surface-2" />
      <div className="flex gap-1 pl-8">
        {Array.from({ length: 30 }, (_, i) => (
          <div key={i} className="h-60 flex-1 rounded-md bg-surface-2/70" />
        ))}
      </div>
    </div>
  );
}
