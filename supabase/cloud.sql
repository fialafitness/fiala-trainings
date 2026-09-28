-- ============================================================
-- Fiala Trainings — cloud storage (step 2)
-- Paste into Supabase: SQL Editor → New query → Run. Safe to re-run.
-- Two tables, one document each: exactly the shape the app already uses.
-- Only the trainer (fialafitness@gmail.com) can read or write.
-- ============================================================

create table if not exists trainers (
  email text primary key,
  created_at timestamptz not null default now()
);
insert into trainers (email) values ('fialafitness@gmail.com') on conflict do nothing;

create or replace function is_trainer()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from trainers where email = lower(coalesce(auth.jwt() ->> 'email', '')));
$$;

create table if not exists ft_clients (
  id uuid primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists ft_trainings (
  id uuid primary key,
  client_id uuid not null,
  data jsonb not null,
  updated_at timestamptz not null default now()
);
create index if not exists ft_trainings_client_idx on ft_trainings (client_id);

alter table trainers enable row level security;
alter table ft_clients enable row level security;
alter table ft_trainings enable row level security;

drop policy if exists trainer_all on trainers;
create policy trainer_all on trainers for all to authenticated using (is_trainer()) with check (is_trainer());
drop policy if exists trainer_all on ft_clients;
create policy trainer_all on ft_clients for all to authenticated using (is_trainer()) with check (is_trainer());
drop policy if exists trainer_all on ft_trainings;
create policy trainer_all on ft_trainings for all to authenticated using (is_trainer()) with check (is_trainer());

select 'ready' as status, (select count(*) from ft_clients) as clients, (select count(*) from ft_trainings) as trainings;
