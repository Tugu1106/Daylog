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

All tables have owner-only RLS. `seed_default_types()` gives a new account a starter set (called on sign-in).
Because the pain line is continuous, "pain before/after an action" can be derived for analysis later.

Times are stored in UTC; the browser's timezone is synced to a `tz` cookie so "today" is computed correctly on the server.

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
| `NEXT_PUBLIC_APP_TIMEZONE` | Fallback timezone before the browser syncs, e.g. `Asia/Ulaanbaatar` |
| `NEXT_PUBLIC_WEATHER_LAT` / `NEXT_PUBLIC_WEATHER_LON` | Optional weather location (defaults to Ulaanbaatar) |

## Database

Migrations live in `supabase/migrations/`. After changing the schema, update `src/lib/database.types.ts`
(or regenerate: `npx supabase gen types typescript --project-id ijcmrejyckhoajancfbr`).

## Deploy (Vercel)

1. Push this repo to GitHub and import it in Vercel (framework auto-detected).
2. Add the env vars above in Vercel → Settings → Environment Variables.
3. In Supabase → Authentication → URL Configuration, set **Site URL** to the Vercel URL and add
   `https://<your-app>.vercel.app/auth/callback` to **Redirect URLs**.
4. After creating your own account, disable new sign-ups (Authentication → Sign In / Providers).
