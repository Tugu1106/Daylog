// Server-side settings the app cannot run without.
export const REQUIRED_ENV = [
  "APP_PASSWORD",
  "SUPABASE_URL",
  "SUPABASE_PUBLISHABLE_KEY",
  "DAYLOG_DB_EMAIL",
  "DAYLOG_DB_PASSWORD",
] as const;

/** Names of required settings that are missing or empty. */
export function missingEnv() {
  return REQUIRED_ENV.filter((name) => !process.env[name]?.trim());
}

export function missingEnvMessage(missing: string[]) {
  return [
    "Daylog is not configured yet.",
    "",
    `Missing environment variable${missing.length === 1 ? "" : "s"}:`,
    ...missing.map((n) => `  • ${n}`),
    "",
    "Add them in Vercel → Settings → Environment Variables,",
    "then redeploy (Deployments → ⋯ → Redeploy). Values are only",
    "picked up by a new build.",
  ].join("\n");
}
