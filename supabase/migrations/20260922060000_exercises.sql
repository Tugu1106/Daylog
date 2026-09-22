-- Your exercise library: what you do, with its usual sets/reps/rest
create table public.exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (length(name) between 1 and 60),
  emoji text,
  color text not null default '#2f5d50' check (color ~ '^#[0-9a-fA-F]{6}$'),
  sets smallint check (sets between 1 and 99),
  reps smallint check (reps between 1 and 999),
  weight_kg numeric(6,2) check (weight_kg >= 0),
  rest_sec int check (rest_sec between 0 and 3600),
  duration_min int check (duration_min between 1 and 600),
  notes text,
  archived boolean not null default false,
  sort int not null default 0,
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

create index exercises_user_idx on public.exercises (user_id);

alter table public.exercises enable row level security;
create policy "own_select" on public.exercises for select to authenticated using ((select auth.uid()) = user_id);
create policy "own_insert" on public.exercises for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "own_update" on public.exercises for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "own_delete" on public.exercises for delete to authenticated using ((select auth.uid()) = user_id);

-- A logged exercise is an action with the set details attached
alter table public.actions
  add column exercise_id uuid references public.exercises(id) on delete set null,
  add column sets smallint check (sets between 0 and 99),
  add column reps smallint check (reps between 0 and 999),
  add column weight_kg numeric(6,2) check (weight_kg >= 0),
  add column rest_sec int check (rest_sec between 0 and 3600);

create index actions_exercise_idx on public.actions (exercise_id) where exercise_id is not null;
