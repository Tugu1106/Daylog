import { signOut } from "@/app/login/actions";
import { HeaderNav } from "@/components/header-nav";
import { TzSync } from "@/components/tz-sync";
import { getTz } from "@/lib/tz";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const tz = await getTz();
  return (
    <>
      <TzSync current={tz} />
      <header className="sticky top-0 z-30 h-14 border-b border-line bg-paper/90 backdrop-blur">
        <div className="mx-auto flex h-full max-w-[1600px] items-center gap-4 px-3 sm:px-5">
          <span className="flex items-center gap-2 font-semibold tracking-tight">
            <svg viewBox="0 0 64 64" className="h-6 w-6" aria-hidden>
              <rect width="64" height="64" rx="14" fill="var(--accent)" />
              <path d="M14 38h9l5-14 8 24 5-10h9" fill="none" stroke="var(--paper)" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="hidden sm:inline">Daylog</span>
          </span>
          <HeaderNav />
          <form action={signOut} className="ml-auto">
            <button className="text-sm text-muted hover:text-ink">Sign out</button>
          </form>
        </div>
      </header>
      <main className="flex flex-1 flex-col">{children}</main>
    </>
  );
}
