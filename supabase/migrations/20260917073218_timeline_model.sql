-- v2: timeline model. Replaces the form-based tables (they were empty).
drop view if exists public.activity_effectiveness;
drop table if exists public.activity_logs, public.pain_logs, public.exercises, public.daily_checkins;

-- What you can do (exercise, sleep, sitting...), user-defined
create table public.action_types (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (length(name) between 1 and 60),
  category text not null default 'exercise'
    check (category in ('exercise','stretch','mobility','strength','cardio','walk','sport','therapy',
                        'sleep','rest','sitting','standing','driving','lifting','work','other')),
  emoji text,
  color text not null default '#2f5d50' check (color ~ '^#[0-9a-fA-F]{6}$'),
  archived boolean not null default false,
  sort int not null default 0,
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

-- Things you did, with start and end (end null = still running)
create table public.actions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  type_id uuid references public.action_types(id) on delete set null,
  name text not null,                 -- snapshot of the type name
  category text not null,
  color text not null default '#2f5d50',
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  effort smallint check (effort between 1 and 10),
  notes text,
  created_at timestamptz not null default now(),
  check (ended_at is null or ended_at >= started_at)
);

-- Your own pain vocabulary
create table public.pain_types (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (length(name) between 1 and 60),
  body_area text,
  description text,
  color text not null default '#c23a3a' check (color ~ '^#[0-9a-fA-F]{6}$'),
  archived boolean not null default false,
  sort int not null default 0,
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

-- Continuous pain level: each row is a reading that holds until the next one
create table public.pain_levels (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  recorded_at timestamptz not null default now(),
  level smallint not null check (level between 0 and 10),
  created_at timestamptz not null default now()
);

-- One-off pain moments (twinge, spasm...)
create table public.pain_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  type_id uuid references public.pain_types(id) on delete set null,
  name text not null,
  color text not null default '#c23a3a',
  occurred_at timestamptz not null default now(),
  intensity smallint check (intensity between 0 and 10),
  notes text,
  created_at timestamptz not null default now()
);

create index action_types_user_idx on public.action_types (user_id);
create index pain_types_user_idx on public.pain_types (user_id);
create index actions_user_start_idx on public.actions (user_id, started_at desc);
create index actions_active_idx on public.actions (user_id) where ended_at is null;
create index actions_type_idx on public.actions (type_id);
create index pain_levels_user_time_idx on public.pain_levels (user_id, recorded_at desc);
create index pain_events_user_time_idx on public.pain_events (user_id, occurred_at desc);
create index pain_events_type_idx on public.pain_events (type_id);

do $$
declare t text;
begin
  foreach t in array array['action_types','actions','pain_types','pain_levels','pain_events'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "own_select" on public.%I for select to authenticated using ((select auth.uid()) = user_id)', t);
    execute format('create policy "own_insert" on public.%I for insert to authenticated with check ((select auth.uid()) = user_id)', t);
    execute format('create policy "own_update" on public.%I for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)', t);
    execute format('create policy "own_delete" on public.%I for delete to authenticated using ((select auth.uid()) = user_id)', t);
  end loop;
end $$;

drop function if exists public.set_updated_at();

-- Starter set for a new user (only if they have no types yet)
create or replace function public.seed_default_types()
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare uid uuid := auth.uid();
begin
  if uid is null then return; end if;

  if not exists (select 1 from public.action_types where user_id = uid) then
    insert into public.action_types (user_id, name, category, emoji, color, sort) values
      (uid, 'Sleep',        'sleep',    '😴', '#5b6ee1', 1),
      (uid, 'Stretching',   'stretch',  '🧘', '#3f8f6b', 2),
      (uid, 'Strength',     'strength', '🏋️', '#2f5d50', 3),
      (uid, 'Walk',         'walk',     '🚶', '#6aa84f', 4),
      (uid, 'Run / cardio', 'cardio',   '🏃', '#e69138', 5),
      (uid, 'Desk work',    'work',     '💻', '#8a847a', 6),
      (uid, 'Sitting',      'sitting',  '🪑', '#a0785a', 7),
      (uid, 'Driving',      'driving',  '🚗', '#7f6a93', 8),
      (uid, 'Lifting',      'lifting',  '📦', '#c27c0e', 9),
      (uid, 'Lying down',   'rest',     '🛋️', '#6d9eeb', 10);
  end if;

  if not exists (select 1 from public.pain_types where user_id = uid) then
    insert into public.pain_types (user_id, name, body_area, color, sort) values
      (uid, 'Dull ache',        'lower back', '#d99a2b', 1),
      (uid, 'Sharp twinge',     'lower back', '#c23a3a', 2),
      (uid, 'Stiffness',        'lower back', '#93a53a', 3),
      (uid, 'Shooting down leg','leg',        '#a64d79', 4),
      (uid, 'Muscle spasm',     'back',       '#d8662f', 5),
      (uid, 'Burning',          'back',       '#e06666', 6);
  end if;
end $$;

revoke execute on function public.seed_default_types() from public, anon;
grant execute on function public.seed_default_types() to authenticated;
