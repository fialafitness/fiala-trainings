-- Exercise instructions reach the client ("See instructions" on the card).
-- Until now the server took the coach's note off every exercise before handing a client their
-- workouts, from the days when notes were the trainer's alone. The dated notes on a client's
-- profile ARE still the trainer's alone and are still held back; paused clients still get nothing.
-- Paste into Supabase: SQL Editor -> New query -> Run. Safe to run more than once.
-- client-access.sql and client-pause.sql carry the same body; keep the three identical.

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
      from ft_trainings t where t.client_id in (select id from me where coalesce(data ->> 'paused', '') <> 'true')), '[]'::jsonb)
  );
$$;
revoke execute on function client_my_data() from public, anon;
grant execute on function client_my_data() to authenticated;

select 'client-instructions.sql applied' as result;
