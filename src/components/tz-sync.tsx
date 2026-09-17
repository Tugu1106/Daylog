"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { TZ_COOKIE } from "@/lib/time";

/** Stores the browser timezone in a cookie so the server renders "today" correctly. */
export function TzSync({ current }: { current: string }) {
  const router = useRouter();
  useEffect(() => {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz && tz !== current) {
      document.cookie = `${TZ_COOKIE}=${encodeURIComponent(tz)}; path=/; max-age=31536000; samesite=lax`;
      router.refresh();
    }
  }, [current, router]);
  return null;
}
