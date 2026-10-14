-- 4-week plans (kind 'monthly' in the data): a client whose plan is past its day gets no workouts, exactly like a paused client,
-- until the trainer extends the date. Session packages do not touch access (the trainer pauses by hand).
-- Paste into Supabase: SQL Editor -> New query -> Run. Safe to run more than once.
-- client-access.sql, client-pause.sql and client-instructions.sql carry the same body; keep them identical.

create or replace function client_my_data()
returns jsonb language sql stable security definer set search_path = public as $$
  with me as (
    select id, data from ft_clients
    where my_email() <> '' and lower(coalesce(data ->> 'email', '')) = my_email()
    order by updated_at desc limit 1
  )
  select jsonb_build_object(
    'clients', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'data', data - 'notes')) from me), '[]'::jsonb),
    'trainings', coalesce((
      select jsonb_agg(jsonb_build_object('id', t.id, 'data', t.data))
      from ft_trainings t where t.client_id in (
        select id from me
        where coalesce(data ->> 'paused', '') <> 'true'
          and (coalesce(data -> 'plan' ->> 'kind', '') <> 'monthly'                       -- a monthly plan past its day is a pause
               or coalesce(data -> 'plan' ->> 'until', '') = ''
               or (data -> 'plan' ->> 'until') >= to_char(now() at time zone 'America/Los_Angeles', 'YYYY-MM-DD')))), '[]'::jsonb)
  );
$$;
revoke execute on function client_my_data() from public, anon;
grant execute on function client_my_data() to authenticated;

select 'client-plan.sql applied' as result;
