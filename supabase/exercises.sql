-- Fiala Trainings — your own exercises (names typed in a workout that are not in the built-in list). Paste into Supabase SQL Editor → Run. Safe to re-run.
create table if not exists ft_exercises (
  name_key text primary key,            -- name squashed: lowercase, letters and digits only
  name text not null,                   -- the name as it should appear
  created_at timestamptz not null default now()
);
alter table ft_exercises enable row level security;
drop policy if exists exercises_read on ft_exercises;
create policy exercises_read on ft_exercises for select to authenticated using (true);
drop policy if exists exercises_trainer on ft_exercises;
create policy exercises_trainer on ft_exercises for all to authenticated using (is_trainer()) with check (is_trainer());
select 'exercises ready' as status;
