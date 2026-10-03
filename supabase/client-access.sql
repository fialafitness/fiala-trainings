-- ============================================================
-- Fiala Trainings — client accounts (step 3)
-- Paste into Supabase: SQL Editor → New query → Run. Safe to re-run.
-- A client signs in with the email on their profile (must be a confirmed
-- email). They receive their profile and trainings WITHOUT the trainer's
-- notes, and can change only the weights of their own exercise rows.
-- ============================================================

-- confirmed email of the caller, or '' (never trust an unconfirmed sign-up)
create or replace function my_email()
returns text language sql stable security definer set search_path = public as $$
  select case when u.email_confirmed_at is null then '' else lower(coalesce(u.email, '')) end
  from auth.users u where u.id = auth.uid();
$$;
revoke execute on function my_email() from public, anon;
grant execute on function my_email() to authenticated;

-- clients never read the tables directly (an older version of this file added these)
drop policy if exists client_read on ft_clients;
drop policy if exists client_read on ft_trainings;

-- one profile per email
create unique index if not exists ft_clients_email_uidx
  on ft_clients ((lower(data ->> 'email'))) where coalesce(data ->> 'email', '') <> '';

-- the server stamps every update (the trainer's saves check this stamp)
create or replace function ft_touch() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;
drop trigger if exists ft_clients_touch on ft_clients;
create trigger ft_clients_touch before update on ft_clients for each row execute function ft_touch();
drop trigger if exists ft_trainings_touch on ft_trainings;
create trigger ft_trainings_touch before update on ft_trainings for each row execute function ft_touch();

-- what a client may see: their profile without notes, their trainings without per-exercise notes
-- (paused clients get no trainings; keep this body identical to client-pause.sql)
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

-- write weights only, one exercise row at a time, own trainings only
create or replace function client_set_weights(p_training uuid, p_row text, p_weights jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_rows jsonb;
  v_new jsonb := '[]'::jsonb;
  v_found boolean := false;
  r jsonb;
begin
  if my_email() = '' then raise exception 'not signed in'; end if;
  if p_training is null or p_row is null or p_weights is null then raise exception 'missing argument'; end if;
  if jsonb_typeof(p_weights) <> 'array' or jsonb_array_length(p_weights) > 20 then raise exception 'bad weights'; end if;
  if exists (select 1 from jsonb_array_elements(p_weights) e
             where jsonb_typeof(e) not in ('string', 'number') or length(e #>> '{}') > 16) then
    raise exception 'bad weights';
  end if;
  if not exists (
    select 1 from ft_trainings t join ft_clients c on c.id = t.client_id
    where t.id = p_training and lower(coalesce(c.data ->> 'email', '')) = my_email()
  ) then raise exception 'not allowed'; end if;

  select coalesce(data -> 'rows', '[]'::jsonb) into v_rows from ft_trainings where id = p_training for update;
  for r in select * from jsonb_array_elements(v_rows) loop
    if r ->> 'id' = p_row then r := jsonb_set(r, '{weights}', p_weights); v_found := true; end if;
    v_new := v_new || jsonb_build_array(r);
  end loop;
  if not v_found then raise exception 'row not found'; end if;
  update ft_trainings set data = jsonb_set(data, '{rows}', v_new) where id = p_training;
end;
$$;
revoke execute on function client_set_weights(uuid, text, jsonb) from public, anon;
grant execute on function client_set_weights(uuid, text, jsonb) to authenticated;

select 'client access ready' as status;
