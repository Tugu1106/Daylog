-- Two independent timers per activity on the bar, with different jobs:
--   limit_min = notify after N minutes; the activity keeps running (a nudge)
--   end_min   = end the activity after N minutes (a hard stop), and if
--               next_type_id is set, start that activity at the same instant
alter table public.action_types
  add column end_min int check (end_min > 0 and end_min <= 600),
  add column next_type_id uuid references public.action_types(id) on delete set null;

-- Following yourself would just restart the same activity forever.
alter table public.action_types
  add constraint action_types_next_not_self check (next_type_id is null or next_type_id <> id);

create index action_types_next_type_idx on public.action_types (next_type_id)
  where next_type_id is not null;
