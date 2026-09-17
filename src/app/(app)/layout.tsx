import Link from "next/link";
import { BottomNav } from "@/components/nav";
import { signOut } from "@/app/login/actions";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <header className="mx-auto flex w-full max-w-xl items-center justify-between px-5 pt-5">
        <Link href="/" className="text-lg font-semibold tracking-tight">
          Daylog
        </Link>
        <form action={signOut}>
          <button className="text-sm text-muted">Sign out</button>
        </form>
      </header>
      <main className="mx-auto w-full max-w-xl flex-1 px-5 pt-4 pb-28">{children}</main>
      <BottomNav />
    </>
  );
}
