-- Exercise catalog (user's own library for quick logging)
create table public.exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  category text not null default 'exercise'
    check (category in ('exercise','stretch','mobility','strength','cardio','walk','therapy','other')),
  description text,
  default_duration_min int check (default_duration_min > 0),
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

-- Pain snapshots
create table public.pain_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  logged_at timestamptz not null default now(),
  intensity smallint not null check (intensity between 0 and 10),
  body_areas text[] not null default '{}',
  pain_types text[] not null default '{}',
  context text,            -- what you were doing when it happened (sitting, after lifting, woke up...)
  tags text[] not null default '{}',
  notes text,
  created_at timestamptz not null default now()
);

-- Anything you did: exercise, sitting, sleep, commute, lifting...
create table public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  started_at timestamptz not null default now(),
  category text not null
    check (category in ('exercise','stretch','mobility','strength','cardio','walk','therapy',
                        'sitting','standing','driving','lifting','sleep','work','sport','other')),
  exercise_id uuid references public.exercises(id) on delete set null,
  name text not null,
  duration_min int check (duration_min >= 0),
  effort smallint check (effort between 1 and 10),      -- RPE
  sets smallint check (sets >= 0),
  reps smallint check (reps >= 0),
  weight_kg numeric(6,2) check (weight_kg >= 0),
  pain_before smallint check (pain_before between 0 and 10),
  pain_after smallint check (pain_after between 0 and 10),
  pain_next_day smallint check (pain_next_day between 0 and 10), -- delayed effect, filled in later
  tags text[] not null default '{}',
  notes text,
  created_at timestamptz not null default now()
);

-- One check-in per day
create table public.daily_checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  day date not null default current_date,
  overall_pain smallint check (overall_pain between 0 and 10),
  morning_stiffness smallint check (morning_stiffness between 0 and 10),
  sleep_hours numeric(3,1) check (sleep_hours between 0 and 24),
  sleep_quality smallint check (sleep_quality between 1 and 5),
  stress smallint check (stress between 1 and 5),
  mood smallint check (mood between 1 and 5),
  steps int check (steps >= 0),
  sitting_hours numeric(3,1) check (sitting_hours between 0 and 24),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, day)
);

create index pain_logs_user_time_idx on public.pain_logs (user_id, logged_at desc);
create index activity_logs_user_time_idx on public.activity_logs (user_id, started_at desc);
create index activity_logs_exercise_idx on public.activity_logs (exercise_id);
create index exercises_user_idx on public.exercises (user_id);

-- RLS: every row belongs to its owner only
alter table public.exercises enable row level security;
alter table public.pain_logs enable row level security;
alter table public.activity_logs enable row level security;
alter table public.daily_checkins enable row level security;

do $$
declare t text;
begin
  foreach t in array array['exercises','pain_logs','activity_logs','daily_checkins'] loop
    execute format('create policy "own_select" on public.%I for select to authenticated using ((select auth.uid()) = user_id)', t);
    execute format('create policy "own_insert" on public.%I for insert to authenticated with check ((select auth.uid()) = user_id)', t);
    execute format('create policy "own_update" on public.%I for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)', t);
    execute format('create policy "own_delete" on public.%I for delete to authenticated using ((select auth.uid()) = user_id)', t);
  end loop;
end $$;

create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end $$;

create trigger daily_checkins_updated_at before update on public.daily_checkins
  for each row execute function public.set_updated_at();

-- Analysis view: average pain change per activity
create view public.activity_effectiveness with (security_invoker = true) as
select
  user_id,
  coalesce(exercise_id::text, lower(name)) as activity_key,
  min(name) as name,
  min(category) as category,
  count(*) as sessions,
  round(avg(pain_after - pain_before)::numeric, 2) as avg_pain_change,
  round(avg(pain_next_day - pain_before)::numeric, 2) as avg_next_day_change,
  round(avg(duration_min)::numeric, 1) as avg_duration_min,
  max(started_at) as last_done
from public.activity_logs
group by user_id, coalesce(exercise_id::text, lower(name));
