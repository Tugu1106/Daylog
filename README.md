# Daylog

Personal day timeline for back pain. Log what you do (with start/end), how your pain moves, and later see what actually helps.

**Stack:** Next.js 16 (App Router, Server Actions, `proxy.ts`) · Supabase (Postgres + Auth + RLS) · Tailwind v4 · Vercel.

## Pages

- **Today** (`/`) — one screen for the whole day
  - **Sky** (top): time-of-day colors, sun/moon position, clock, weather (Open-Meteo), running actions with an **End** button
  - **Timeline** (~60%): 00–24h. Action lanes → pain events → pain level line
  - **Pain glider** (bottom): move it when your pain changes; it records a reading and the line holds that level until the next one
  - **Right-click / long-press** anywhere on the timeline: start an action at that time, end a running one, set pain level, or add a pain event. Click a block to edit start/end, effort and notes
  - At midnight the page rolls over to a fresh, empty day
- **All days** (`/days`) — a compact card per logged day: mini timeline, pain avg/max, sleep/active/sitting time, actions and pain events. Click a card to open that day's timeline (`/day/YYYY-MM-DD`) and fix entries
- **Types** (`/types`) — define your own actions (emoji, color, category) and pain types (body area, description)

## Data model

| Table | What |
|---|---|
| `action_types` | Your action vocabulary: name, category, emoji, color |
| `actions` | Things you did: `started_at`, `ended_at` (null = still running), effort, notes |
| `pain_types` | Your pain vocabulary: name, body area, description, color |
| `pain_levels` | Pain readings (0–10). Each holds until the next → a continuous line |
| `pain_events` | One-off pain moments of a given type, with intensity |

All tables have owner-only RLS. `seed_default_types()` adds the starter set on first login.
Because the pain line is continuous, "pain before/after an action" can be derived for analysis later.

Times are stored in UTC; the browser's timezone is synced to a `tz` cookie so "today" is computed correctly on the server.

## Login

Single-person app: **one password**, no accounts.

- Set it in `.env.local` → `APP_PASSWORD=...` (locally) and in Vercel → Settings → Environment Variables (deployed).
- To change it: edit the value (and redeploy on Vercel). Sessions stay logged in until you press Sign out.
- Behind the scenes the server opens a session for one internal Supabase account
  (`DAYLOG_DB_EMAIL` / `DAYLOG_DB_PASSWORD`) so database row-level security stays on. You never type those.
- Wrong passwords wait 1 second before answering, to slow down guessing.

## Local dev

```bash
# put your password in .env.local → APP_PASSWORD=
npm install
npm run dev
```

## Env vars

| Name | What |
|---|---|
| `APP_PASSWORD` | **Your login password** |
| `SUPABASE_URL` | `https://ijcmrejyckhoajancfbr.supabase.co` |
| `SUPABASE_PUBLISHABLE_KEY` | Supabase → Project Settings → API Keys (`sb_publishable_…`) |
| `DAYLOG_DB_EMAIL` / `DAYLOG_DB_PASSWORD` | Internal Supabase account that owns the data (copy from `.env.local`) |
| `NEXT_PUBLIC_APP_TIMEZONE` | Fallback timezone before the browser syncs, e.g. `Asia/Ulaanbaatar` |
| `NEXT_PUBLIC_WEATHER_LAT` / `NEXT_PUBLIC_WEATHER_LON` | Optional weather location (defaults to Ulaanbaatar) |

All Supabase values are server-only; nothing database-related is sent to the browser.

## Database

Migrations live in `supabase/migrations/`. After changing the schema, update `src/lib/database.types.ts`
(or regenerate: `npx supabase gen types typescript --project-id ijcmrejyckhoajancfbr`).

## Deploy (Vercel)

1. Push this repo to GitHub and import it in Vercel (framework auto-detected).
2. Copy every variable from `.env.local` into Vercel → Settings → Environment Variables.
3. Optional hardening: Supabase → Authentication → Sign In / Providers → turn off "Allow new users to sign up".
