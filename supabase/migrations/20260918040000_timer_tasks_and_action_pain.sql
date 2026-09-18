-- Pain felt during one action (the glider stays the general daily level)
alter table public.actions add column pain smallint check (pain between 0 and 10);

-- Timer tasks: one-tap activities with an optional time limit that alerts you
alter table public.action_types add column timer boolean not null default false;
alter table public.action_types add column limit_min int check (limit_min > 0 and limit_min <= 600);

create index actions_pain_idx on public.actions (user_id, pain) where pain is not null;

update public.action_types set timer = true, limit_min = case name
  when 'Sitting' then 30
  when 'Desk work' then 45
  when 'Walk' then 15
  when 'Stretching' then 10
  when 'Lying down' then 30
  else null end
where name in ('Sitting', 'Desk work', 'Walk', 'Stretching', 'Lying down', 'Strength', 'Run / cardio');

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
    insert into public.action_types (user_id, name, category, emoji, color, sort, timer, limit_min) values
      (uid, 'Sleep',        'sleep',    '😴', '#5b6ee1', 1,  false, null),
      (uid, 'Stretching',   'stretch',  '🧘', '#3f8f6b', 2,  true,  10),
      (uid, 'Strength',     'strength', '🏋️', '#2f5d50', 3,  true,  null),
      (uid, 'Walk',         'walk',     '🚶', '#6aa84f', 4,  true,  15),
      (uid, 'Run / cardio', 'cardio',   '🏃', '#e69138', 5,  true,  null),
      (uid, 'Desk work',    'work',     '💻', '#8a847a', 6,  true,  45),
      (uid, 'Sitting',      'sitting',  '🪑', '#a0785a', 7,  true,  30),
      (uid, 'Driving',      'driving',  '🚗', '#7f6a93', 8,  false, null),
      (uid, 'Lifting',      'lifting',  '📦', '#c27c0e', 9,  false, null),
      (uid, 'Lying down',   'rest',     '🛋️', '#6d9eeb', 10, true,  30);
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
