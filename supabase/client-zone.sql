-- ============================================================
-- Fiala Trainings — the time zone a client's phone is in (v315)
-- Paste into Supabase: SQL Editor → New query → Run. Safe to run more than once.
-- The client's app sends its phone's time zone when it syncs: when it changed, or every 30 minutes. The coach's page shows it
-- under the client's name: "34 years old · Tokyo · Tue 3:00 AM". It is kept on the client's record as
--   zone = { "zone": "Asia/Tokyo", "at": <when it came, by the server's clock> }
-- so the coach can tell how fresh it is ("3 days ago"). Only a time zone, never a location.
-- Needs cloud.sql and client-access.sql (my_email) to have been run before, as they were.
-- ============================================================

create or replace function client_set_zone(p_client uuid, p_zone text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if my_email() = '' then raise exception 'not signed in'; end if;
  if p_client is null or p_zone is null then raise exception 'missing argument'; end if;
  if not (p_zone ~ '^[A-Za-z][A-Za-z0-9_+/-]{1,63}$') then raise exception 'bad zone'; end if;   -- a time zone's name ("Asia/Tokyo", "Etc/GMT+5"), nothing else
  -- the caller's own record only
  perform 1 from ft_clients c
    where c.id = p_client and lower(coalesce(c.data ->> 'email', '')) = my_email()
    for update;
  if not found then raise exception 'not allowed'; end if;
  update ft_clients set data = jsonb_set(coalesce(data, '{}'::jsonb), '{zone}', jsonb_build_object('zone', p_zone, 'at', now()))
    where id = p_client;
end;
$$;
revoke execute on function client_set_zone(uuid, text) from public, anon;
grant execute on function client_set_zone(uuid, text) to authenticated;
select 'zone ready' as status;
