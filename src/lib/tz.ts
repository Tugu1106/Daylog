import "server-only";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { DEFAULT_TZ, isValidTz, TZ_COOKIE } from "@/lib/time";

/** The user's timezone, synced from the browser by <TzSync>. */
export async function getTz() {
  const value = (await cookies()).get(TZ_COOKIE)?.value;
  const tz = value ? decodeURIComponent(value) : null;
  return isValidTz(tz) ? tz : DEFAULT_TZ;
}

/** Request time for dynamic pages (opts the route out of prerendering). */
export async function requestNow() {
  await connection();
  return Date.now();
}
