# Daylog

Personal pain & movement log. Track back pain, exercises and daily situations, then see what actually helps.

**Stack:** Next.js 16 (App Router, Server Actions, `proxy.ts`) · Supabase (Postgres + Auth + RLS) · Tailwind v4 · Vercel.

## What gets tracked

| Table | What | Key fields |
|---|---|---|
| `pain_logs` | A pain snapshot | intensity 0–10, body areas, pain type, context (what you were doing), tags, notes |
| `activity_logs` | Anything you did — exercise, stretch, walk, sitting, driving, lifting, sleep… | category, name, duration, effort, sets/reps/weight, **pain before / after / next day** |
| `exercises` | Your routine library for quick picking | name, category, default duration, cues |
| `daily_checkins` | One per day | overall pain, morning stiffness, sleep h + quality, stress, mood, steps, sitting hours |
| `activity_effectiveness` (view) | Avg pain change per activity | sessions, avg (after − before), avg next-day change |

Every table has RLS: rows are visible only to their owner.

## App

- **Today** — stats, quick log buttons, check-in status, today's timeline
- **Log pain** / **Log activity** / **Check-in** — phone-first forms
- **History** — 7/14/30/90 day timeline grouped by day; set "next day" pain on past activities
- **Insights** — 30-day pain trend + which activities lower/raise pain
- **Exercises** — manage your routine

## Local dev

```bash
cp .env.example .env.local   # fill in the publishable key
npm install
npm run dev
```

## Env vars

| Name | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://ijcmrejyckhoajancfbr.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase → Project Settings → API Keys (`sb_publishable_…`) |
| `NEXT_PUBLIC_APP_TIMEZONE` | IANA zone used for "today", e.g. `Asia/Ulaanbaatar` |

## Database

Migrations live in `supabase/migrations/`. After changing the schema, regenerate types:

```bash
npx supabase gen types typescript --project-id ijcmrejyckhoajancfbr > src/lib/database.types.ts
```

## Deploy (Vercel)

1. Push this repo to GitHub and import it in Vercel (framework auto-detected).
2. Add the three env vars above in Vercel → Settings → Environment Variables.
3. In Supabase → Authentication → URL Configuration, set **Site URL** to the Vercel URL and add
   `https://<your-app>.vercel.app/auth/callback` to **Redirect URLs**.
4. After creating your own account, disable new sign-ups (Authentication → Sign In / Providers → "Allow new users to sign up" off).
