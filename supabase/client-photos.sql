-- ============================================================
-- Fiala Trainings — profile photos
-- Paste into Supabase: SQL Editor → New query → Run. Safe to run more than once.
-- One photo per client. The coach or the client may set it; whoever changes it last, that is the photo.
-- Creates the private "photos" folder (bucket) in Supabase Storage and who may touch what in it:
-- the coach every photo; a client only the photos in her own folder ("<her client id>/…").
-- The client record carries only which photo is current (data.photo); a client sets hers through client_set_photo.
-- Needs cloud.sql (is_trainer) and client-access.sql (my_email) to have been run before, as they were.
-- ============================================================

-- the folder: private, small JPEGs only (the app sends 256-pixel squares of about 20 KB; 128 KB is the most one may be)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', false, 131072, array['image/jpeg'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- true when the file sits in the signed-in client's own folder
create or replace function photo_is_mine(p_name text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from ft_clients c
    where my_email() <> '' and lower(coalesce(c.data ->> 'email', '')) = my_email()
      and c.id::text = split_part(p_name, '/', 1)
  );
$$;
revoke execute on function photo_is_mine(text) from public, anon;
grant execute on function photo_is_mine(text) to authenticated;

-- room in a client's folder: a handful of files (the app keeps one, two for a moment while a new one replaces the old)
create or replace function photo_room(p_name text)
returns boolean language sql stable security definer set search_path = public as $$
  select count(*) < 20 from storage.objects o
  where o.bucket_id = 'photos' and split_part(o.name, '/', 1) = split_part(p_name, '/', 1);
$$;
revoke execute on function photo_room(text) from public, anon;
grant execute on function photo_room(text) to authenticated;

-- the coach: every photo; a client: her own folder only, and only files named the way the app names them
drop policy if exists photos_trainer on storage.objects;
create policy photos_trainer on storage.objects for all to authenticated
  using (bucket_id = 'photos' and public.is_trainer())
  with check (bucket_id = 'photos' and public.is_trainer());
drop policy if exists photos_client on storage.objects;
drop policy if exists photos_client_read on storage.objects;
create policy photos_client_read on storage.objects for select to authenticated
  using (bucket_id = 'photos' and public.photo_is_mine(name));
drop policy if exists photos_client_add on storage.objects;
create policy photos_client_add on storage.objects for insert to authenticated
  with check (bucket_id = 'photos' and public.photo_is_mine(name)
              and name ~ '^[0-9a-f-]{36}/[a-z0-9]{6,32}\.jpg$' and public.photo_room(name));
drop policy if exists photos_client_change on storage.objects;
create policy photos_client_change on storage.objects for update to authenticated
  using (bucket_id = 'photos' and public.photo_is_mine(name))
  with check (bucket_id = 'photos' and public.photo_is_mine(name) and name ~ '^[0-9a-f-]{36}/[a-z0-9]{6,32}\.jpg$');
drop policy if exists photos_client_remove on storage.objects;
create policy photos_client_remove on storage.objects for delete to authenticated
  using (bucket_id = 'photos' and public.photo_is_mine(name));

-- a client marks her own photo as the current one, or clears it
create or replace function client_set_photo(p_client uuid, p_photo text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if my_email() = '' then raise exception 'not signed in'; end if;
  if p_client is null then raise exception 'missing argument'; end if;
  if p_photo is not null and p_photo !~ '^[a-z0-9]{6,32}$' then raise exception 'bad photo'; end if;
  if not exists (
    select 1 from ft_clients c where c.id = p_client and lower(coalesce(c.data ->> 'email', '')) = my_email()
  ) then raise exception 'not allowed'; end if;
  update ft_clients
    set data = case when p_photo is null then data - 'photo' else jsonb_set(data, '{photo}', to_jsonb(p_photo)) end
    where id = p_client;
end;
$$;
revoke execute on function client_set_photo(uuid, text) from public, anon;
grant execute on function client_set_photo(uuid, text) to authenticated;

select 'photos ready' as status;
