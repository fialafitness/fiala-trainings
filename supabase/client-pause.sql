-- Paused clients (Details > Access > Paused): the server stops sending their workouts.
-- The app already hides everything for a paused client; this makes the server agree.
-- Safe to run more than once. client-access.sql carries the same body; keep them identical.

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
      select jsonb_agg(jsonb_build_object('id', t.id, 'data',
        jsonb_set(t.data, '{rows}', coalesce((select jsonb_agg(r - 'note') from jsonb_array_elements(coalesce(t.data -> 'rows', '[]'::jsonb)) r), '[]'::jsonb))))
      from ft_trainings t where t.client_id in (select id from me where coalesce(data ->> 'paused', '') <> 'true')), '[]'::jsonb)
  );
$$;
revoke execute on function client_my_data() from public, anon;
grant execute on function client_my_data() to authenticated;

select 'client-pause.sql applied' as result;
