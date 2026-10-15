-- Fiala Trainings — built-in exercises the coach removed or renamed from the Exercises page. Paste into Supabase SQL Editor → Run. Safe to re-run.
create table if not exists ft_exercise_hidden (
  name_key text primary key,              -- the squashed built-in name ("tricepspushdown")
  hidden_at timestamptz not null default now()
);
alter table ft_exercise_hidden enable row level security;
drop policy if exists hidden_read on ft_exercise_hidden;
create policy hidden_read on ft_exercise_hidden for select to authenticated using (true);       -- clients read it too: a removed exercise stays removed in their picker
drop policy if exists hidden_trainer on ft_exercise_hidden;
create policy hidden_trainer on ft_exercise_hidden for all to authenticated using (is_trainer()) with check (is_trainer());
select 'hidden exercises ready' as status;
