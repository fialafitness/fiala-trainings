-- ============================================================
-- Fiala Trainings — a client's own choices about their information (v316)
-- Paste into Supabase: SQL Editor → New query → Run. Safe to run more than once.
-- The owner's decisions, 18 Nov 2026, after legal research (California, Washington, Nevada, Connecticut, the FTC, the EU):
--   * the time zone a client's phone reports (zone, client-zone.sql) reaches the coach only after the client taps Allow;
--     Don't Allow (or switching it off in Settings) deletes the one saved;
--   * health details (date of birth, sex, height, weight, Health & safety) are stored only after the client agrees in
--     the app (a client under 18: the teen, then a parent or guardian, who types their name), or after the coach switches
--     on "signed a paper form" for an in-person client (a client under 18: signed by a parent or guardian too); Don't Allow
--     deletes them; details saved before this release stay as they are (read-only) until the client answers;
--   * a client who withdraws by email or in person: the coach records it (coach_withdraw), which deletes as Don't Allow does.
-- Kept on the client's record:
--   choices.zone   = { state: 'allow' | 'deny', at, by }
--   choices.health = { state: 'agreed' | 'declined' | 'legacy' | 'paper' | 'off', at, by, parent: { name, at } | { paper: true, at } }
--                    ('off': the paper form turned off, read as never asked)
--   choices.log    = [ { kind, answer, at, got, by, parent, stale, id } ]   every answer, kept as proof (id: the phone's own name for it, so a resend is never counted twice): at = when it was given (the
--                    phone sends how long ago, so its own clock never decides), got = when it arrived; past 200 the oldest but the
--                    first give way
--   minor          = true: the coach's Under 18 switch
--   minorUntil     = the year a client turns 18, kept when a Don't Allow deletes a birthday under 18 (the year only, not the
--                    date of birth): under 18 until the end of that year, and under 13 until the end of that year less five
-- A client who agreed alone and is then known to be under 18 (the coach's switch, a birthday entered since) keeps the details
-- read-only until a parent or guardian agrees too, on the client's phone; a paper form signed alone, the same until the coach
-- records the parent's signature (the policy's promise). Their date of birth can still be put right.
-- A guard on the table (every writer: the coach's whole-record saves, an old copy on a device, a backup restore) keeps
-- choices and zone exactly as the server has them (a client written anew comes with none), keeps a time zone only after Allow,
-- keeps health details read-only while they wait for an answer, and strips them when the client has not agreed. Only the
-- rules below change choices.
-- Needs cloud.sql (is_trainer), client-access.sql (my_email) and client-zone.sql to have been run before.
-- ============================================================

-- a date written as YYYY-MM-DD, or null (a malformed one never stops a save)
create or replace function ft_date(t text) returns date language plpgsql immutable as $$
begin
  if t is null or t !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then return null; end if;
  return t::date;
exception when others then return null;
end; $$;

-- a moment as the app writes it (ISO with its offset), or null
create or replace function ft_time(t text) returns timestamptz language plpgsql stable as $$
begin
  if t is null or t = '' then return null; end if;
  return t::timestamptz;
exception when others then return null;
end; $$;

-- age in whole years on Los Angeles's day (the server's day, as client_my_data), or null with no date of birth
create or replace function ft_age(d jsonb) returns int language sql stable as $$
  select extract(year from age((now() at time zone 'America/Los_Angeles')::date, ft_date(d ->> 'birthday')))::int
$$;

-- under 18: the coach's switch, the year kept after a Don't Allow, or a birthday under 18
create or replace function ft_minor(d jsonb) returns boolean language sql stable as $$
  select coalesce(d ->> 'minor', '') = 'true'
    or (jsonb_typeof(d -> 'minorUntil') = 'number' and extract(year from (now() at time zone 'America/Los_Angeles'))::numeric <= (d ->> 'minorUntil')::numeric)
    or coalesce(ft_age(d) < 18, false)
$$;

-- under 13 (the app is for 13 and up, COPPA): a birthday under 13, or the year kept after the details went (the birth year + 18, so under 13 until the end of that year less five)
create or replace function ft_young(d jsonb) returns boolean language sql stable as $$
  select coalesce(ft_age(d) < 13, false)
    or (jsonb_typeof(d -> 'minorUntil') = 'number' and extract(year from (now() at time zone 'America/Los_Angeles'))::numeric <= (d ->> 'minorUntil')::numeric - 5)
$$;

-- agreed alone (in the app, or a paper form signed alone), and now known to be under 18: a parent or guardian still has to agree
create or replace function ft_needs_parent(d jsonb) returns boolean language sql stable as $$
  select coalesce(d #>> '{choices,health,state}', '') in ('agreed', 'paper')
    and jsonb_typeof(d #> '{choices,health,parent}') is distinct from 'object'
    and ft_minor(d)
$$;

-- the health details go; a birthday under 18 leaves the year the client turns 18 (the note that they are under 18 is not one of the health details)
create or replace function ft_drop_health(d jsonb) returns jsonb language sql stable as $$
  select (case when coalesce(ft_age(d) < 18, false) then jsonb_set(d, '{minorUntil}', to_jsonb(extract(year from ft_date(d ->> 'birthday'))::int + 18)) else d end)
    - 'birthday' - 'sex' - 'height' - 'bodyWeight' - 'heightUnit' - 'bodyUnit' - 'health'
$$;

-- one answer onto the record's log (kept as proof); past 200, the oldest after the first give way, so the record stays small and no answer is ever refused for it
create or replace function ft_log(d jsonb, e jsonb) returns jsonb language sql immutable as $$
  select jsonb_set(d, '{choices,log}', (case when jsonb_array_length(coalesce(d #> '{choices,log}', '[]'::jsonb)) >= 200 then (d #> '{choices,log}') - 1 else coalesce(d #> '{choices,log}', '[]'::jsonb) end) || jsonb_build_array(e))
$$;

-- the guard (fires before every insert or update of a client's record)
create or replace function ft_consent_guard() returns trigger language plpgsql as $$
declare
  v_state text;
  k text;
  h_keys text[] := array['birthday', 'sex', 'height', 'bodyWeight', 'heightUnit', 'bodyUnit', 'health'];
  v_mine boolean := coalesce(current_setting('ft.consent', true), '') = 'on';   -- only the rules below say 'on', for their own write
begin
  if new.data is null or jsonb_typeof(new.data) <> 'object' then return new; end if;
  if tg_op = 'UPDATE' and not v_mine then
    if old.data ? 'choices' then new.data := jsonb_set(new.data, '{choices}', old.data -> 'choices'); else new.data := new.data - 'choices'; end if;
    if old.data ? 'zone' then new.data := jsonb_set(new.data, '{zone}', old.data -> 'zone'); else new.data := new.data - 'zone'; end if;
  end if;
  if tg_op = 'INSERT' and not v_mine then new.data := new.data - 'choices' - 'zone'; end if;   -- a client written anew (a restore of one deleted): no answers come with it, so both questions are asked again
  if coalesce(new.data #>> '{choices,zone,state}', '') <> 'allow' then new.data := new.data - 'zone'; end if;   -- a time zone is kept only after Allow
  v_state := new.data #>> '{choices,health,state}';
  if tg_op = 'UPDATE' and (v_state = 'legacy'   -- saved before v316, not answered yet: exactly as stored
      or (v_state in ('agreed', 'paper') and ft_needs_parent(old.data) and ft_needs_parent(new.data) and jsonb_typeof(new.data #> '{choices,health,parent}') is distinct from 'object')) then   -- a parent still to agree, before and after this write: exactly as stored (a coach's save that lifts the wait, Under 18 off or the date of birth put right, keeps its edits: the check round)
    foreach k in array h_keys loop
      if k = 'birthday' and v_state <> 'legacy' and coalesce(old.data ->> 'minor', '') <> 'true' then continue; end if;   -- a date of birth entered by mistake can still be put right (unless the coach's Under 18 decides)
      if v_state <> 'legacy' and not (new.data ? k) then continue; end if;   -- a detail removed goes (you can remove what you entered, a parent awaited or not: the check round)
      if v_state <> 'legacy' and k = 'health' and jsonb_typeof(new.data -> 'health') = 'object' and jsonb_typeof(old.data -> 'health') = 'object' and (old.data -> 'health') @> (new.data -> 'health') then continue; end if;   -- Health & safety entries cleared, nothing added
      if old.data ? k then new.data := jsonb_set(new.data, array[k], old.data -> k); else new.data := new.data - k; end if;
    end loop;
  elsif v_state is null or v_state not in ('agreed', 'paper', 'legacy') then   -- not agreed: no health details at all (a birthday under 18 leaves the year, as every deletion: a restore of a teen deleted, the check round)
    new.data := ft_drop_health(new.data);
  end if;
  return new;
end; $$;

-- a client's answer: 'zone' (allow | deny) or 'health' (agree | decline); a client under 18 agrees with a parent's name;
-- p_age is how many seconds ago the person answered (a phone offline sends it later; by the phone's own clock, so a clock set
-- wrong never decides); p_by 'parent' is a parent's or guardian's Disagree; p_id is the phone's name for the answer (a resend
-- writes nothing); p_taken_back: a Don't Allow the same person took back with a later answer (sent ahead of it, it never uses
-- the special cases below). Answers 'ok', 'same' (nothing to write) or 'stale' (given before the answer on record: logged only)
drop function if exists client_set_choice(uuid, text, text, text);
drop function if exists client_set_choice(uuid, text, text, text, timestamptz, text);
drop function if exists client_set_choice(uuid, text, text, text, integer, text);
create or replace function client_set_choice(p_client uuid, p_kind text, p_answer text, p_parent text default null, p_age integer default null, p_by text default 'client', p_id text default null, p_taken_back boolean default false)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_data jsonb;
  v_now timestamptz := now();
  v_at timestamptz := now() - make_interval(secs => greatest(0, least(coalesce(p_age, 0), 31536000)));   -- when it was given (a year at most)
  v_parent text := nullif(btrim(coalesce(p_parent, '')), '');
  v_by text := coalesce(p_by, 'client');
  v_cur jsonb;
  v_entry jsonb;
  v_seen jsonb;
begin
  if my_email() = '' then raise exception 'not signed in'; end if;
  if p_client is null or p_kind is null or p_answer is null then raise exception 'missing argument'; end if;
  if not ((p_kind = 'zone' and p_answer in ('allow', 'deny')) or (p_kind = 'health' and p_answer in ('agree', 'decline'))) then raise exception 'bad answer'; end if;
  if v_by not in ('client', 'parent') or (v_by = 'parent' and p_answer <> 'decline') then raise exception 'bad answer'; end if;   -- a parent's own answer is a Disagree (their Agree comes with the client's, with their name)
  if v_parent is not null and length(v_parent) > 80 then raise exception 'bad name'; end if;
  if p_id is not null and length(p_id) > 64 then raise exception 'bad answer'; end if;
  -- the caller's own record only
  select c.data into v_data from ft_clients c
    where c.id = p_client and lower(coalesce(c.data ->> 'email', '')) = my_email()
    for update;
  if not found then raise exception 'not allowed'; end if;
  v_data := coalesce(v_data, '{}'::jsonb);
  if jsonb_typeof(v_data -> 'choices') is distinct from 'object' then v_data := jsonb_set(v_data, '{choices}', '{}'::jsonb); end if;
  v_cur := v_data #> array['choices', p_kind];
  if p_id is not null then   -- this very answer arrived before (a resend after a lost reply, or a second page sending it again): answered as it was, nothing written
    select e into v_seen from jsonb_array_elements(coalesce(v_data #> '{choices,log}', '[]'::jsonb)) e where e ->> 'id' = p_id limit 1;
    if v_seen is not null then return case when coalesce(v_seen ->> 'stale', '') = 'true' then 'stale' else 'same' end; end if;
  end if;
  if p_answer in ('allow', 'agree') and ft_young(v_data) then raise exception 'too young'; end if;   -- the app is for 13 and up (COPPA): no time zone and no health details from a child
  if p_answer in ('allow', 'agree') and coalesce(v_data ->> 'paused', '') = 'true' then raise exception 'paused'; end if;   -- a paused client gives nothing new (the coach paused them, as for a child found to be under 13); a withdrawal still goes
  v_entry := jsonb_build_object('kind', p_kind, 'answer', p_answer, 'at', v_at, 'got', v_now, 'by', v_by)
    || case when v_parent is not null then jsonb_build_object('parent', v_parent) else '{}'::jsonb end
    || case when p_id is not null then jsonb_build_object('id', p_id) else '{}'::jsonb end
    || case when coalesce(p_taken_back, false) then jsonb_build_object('takenBack', true) else '{}'::jsonb end;
  if p_answer = 'decline' and not coalesce(p_taken_back, false) and v_cur ->> 'state' = 'off' and ft_time(v_cur ->> 'at') > v_at then   -- a person's Don't Allow given before the coach turned the paper form off: theirs is recorded, at the form's newer date, so they are not asked again (the check round)
    v_data := jsonb_set(v_data, '{choices,health}', jsonb_build_object('state', 'declined', 'at', v_cur -> 'at', 'by', v_by));
    v_data := ft_log(v_data, v_entry);
    perform set_config('ft.consent', 'on', true);
    update ft_clients set data = v_data where id = p_client;
    return 'ok';
  end if;
  if p_answer = 'decline' and not coalesce(p_taken_back, false) and v_cur ->> 'state' = 'paper' and ft_time(v_cur ->> 'at') > v_at + interval '2 seconds'
     and not exists (select 1 from jsonb_array_elements(coalesce(v_data #> '{choices,log}', '[]'::jsonb)) e
                     where e ->> 'kind' = 'health' and e ->> 'by' in ('client', 'parent') and ft_time(e ->> 'at') > v_at + interval '2 seconds') then   -- unless the person answered again since, on another device too (a set-aside answer counts): then it is set aside below (the check round)   -- a person's Don't Allow given before the coach recorded a paper form: the form's date is when it was recorded, not signed, so the person's own answer stands (the details go; the check round)
    v_data := ft_drop_health(v_data);
    v_data := jsonb_set(v_data, '{choices,health}', jsonb_build_object('state', 'declined', 'at', v_at, 'by', v_by));
    v_data := ft_log(v_data, v_entry);
    perform set_config('ft.consent', 'on', true);
    update ft_clients set data = v_data where id = p_client;
    return 'ok';
  end if;
  if ft_time(v_cur ->> 'at') > v_at + interval '2 seconds' then   -- given before the answer on record (another device's later answer, the coach's withdrawal or paper form): kept in the log only. The newest answer wins either way: the phone sends how long ago it was given, by its own clock, so no clock set wrong decides (the check rounds: an old Don't Allow sent again by a second page deleted details agreed since)
    v_data := ft_log(v_data, v_entry || jsonb_build_object('stale', true));
    perform set_config('ft.consent', 'on', true);
    update ft_clients set data = v_data where id = p_client;
    return 'stale';
  end if;
  if v_cur ->> 'state' = (case p_answer when 'agree' then 'agreed' when 'decline' then 'declined' else p_answer end)   -- in brackets: PL/pgSQL reads an IF's condition up to its first THEN, the CASE's own
     and coalesce(v_cur ->> 'by', 'client') = v_by
     and (p_answer <> 'agree' or coalesce(v_cur #>> '{parent,name}', '') = coalesce(v_parent, ''))
     and coalesce(v_at <= ft_time(v_cur ->> 'at') + interval '2 seconds', true) then return 'same'; end if;   -- the same answer again within 2 s (a resend after a lost reply): nothing to write; the same answer given later is written with its own date (the check round: a later Don't Allow was lost)
  if p_kind = 'zone' then
    v_data := jsonb_set(v_data, '{choices,zone}', jsonb_build_object('state', p_answer, 'at', v_at, 'by', v_by));
    if p_answer = 'deny' then v_data := v_data - 'zone'; end if;   -- Don't Allow deletes the one saved
  elsif p_answer = 'agree' then
    if ft_minor(v_data) and v_parent is null then raise exception 'parent needed'; end if;
    v_data := jsonb_set(v_data, '{choices,health}', jsonb_build_object('state', 'agreed', 'at', v_at, 'by', v_by)
      || case when v_parent is not null then jsonb_build_object('parent', jsonb_build_object('name', v_parent, 'at', v_at)) else '{}'::jsonb end);
  else   -- decline (the client's Don't Allow, or a parent's Disagree): the health details go
    v_data := ft_drop_health(v_data);
    v_data := jsonb_set(v_data, '{choices,health}', jsonb_build_object('state', 'declined', 'at', v_at, 'by', v_by));
  end if;
  v_data := ft_log(v_data, v_entry);
  perform set_config('ft.consent', 'on', true);
  update ft_clients set data = v_data where id = p_client;
  return 'ok';
end; $$;
revoke execute on function client_set_choice(uuid, text, text, text, integer, text, text, boolean) from public, anon;
grant execute on function client_set_choice(uuid, text, text, text, integer, text, text, boolean) to authenticated;

-- the coach: an in-person client signed a paper form (on; a client under 18 with a parent or guardian, p_parent), or that
-- agreement no longer holds (off: the details go, and a dated answer stays, so an Agree given before it never lands as new).
-- Answers { choices, minor, minorUntil } as they are now.
drop function if exists coach_set_paper(uuid, boolean);
create or replace function coach_set_paper(p_client uuid, p_on boolean, p_parent boolean default false)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_data jsonb;
  v_now timestamptz := now();
  v_state text;
begin
  if not is_trainer() then raise exception 'not allowed'; end if;
  if p_client is null or p_on is null then raise exception 'missing argument'; end if;
  select c.data into v_data from ft_clients c where c.id = p_client for update;
  if not found then raise exception 'not allowed'; end if;
  v_data := coalesce(v_data, '{}'::jsonb);
  if jsonb_typeof(v_data -> 'choices') is distinct from 'object' then v_data := jsonb_set(v_data, '{choices}', '{}'::jsonb); end if;
  v_state := v_data #>> '{choices,health,state}';
  if p_on then
    if v_state = 'agreed' then raise exception 'agreed in the app'; end if;   -- the client's own Agree stands above a form (a card that has not caught up is told)
    if v_state = 'declined' and coalesce(v_data #>> '{choices,health,by}', 'client') in ('client', 'parent') then raise exception 'declined in the app'; end if;   -- nor over their own (or a parent's) Don't Allow: a form signed before it must not undo it (the check round)
    if ft_young(v_data) then raise exception 'too young'; end if;
    if ft_minor(v_data) and not coalesce(p_parent, false) then raise exception 'parent needed'; end if;   -- a teen's form is signed by a parent or guardian too
    v_data := jsonb_set(v_data, '{choices,health}', jsonb_build_object('state', 'paper', 'at', v_now, 'by', 'coach')
      || case when coalesce(p_parent, false) then jsonb_build_object('parent', jsonb_build_object('paper', true, 'at', v_now)) else '{}'::jsonb end);
  else
    if v_state = 'agreed' then raise exception 'agreed in the app'; end if;   -- the client's own Agree came since: the form no longer decides (Delete health details does: the check round)
    if v_state is distinct from 'paper' then raise exception 'not on paper'; end if;
    v_data := jsonb_set(ft_drop_health(v_data), '{choices,health}', jsonb_build_object('state', 'off', 'at', v_now, 'by', 'coach'));   -- the app reads 'off' as never asked
  end if;
  v_data := ft_log(v_data, jsonb_build_object('kind', 'health', 'answer', case when p_on then 'paper' else 'paper-off' end, 'at', v_now, 'got', v_now, 'by', 'coach')
    || case when p_on and coalesce(p_parent, false) then jsonb_build_object('parent', 'paper') else '{}'::jsonb end);
  perform set_config('ft.consent', 'on', true);
  update ft_clients set data = v_data where id = p_client;
  return jsonb_build_object('choices', v_data -> 'choices', 'minor', v_data -> 'minor', 'minorUntil', v_data -> 'minorUntil');
end; $$;
revoke execute on function coach_set_paper(uuid, boolean, boolean) from public, anon;
grant execute on function coach_set_paper(uuid, boolean, boolean) to authenticated;

-- the coach: a client withdrew by email or in person ('health': the details go, as Don't Allow; 'zone': sharing stops and
-- the saved time zone goes). Answers { choices, minor, minorUntil } as they are now.
create or replace function coach_withdraw(p_client uuid, p_kind text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_data jsonb;
  v_now timestamptz := now();
begin
  if not is_trainer() then raise exception 'not allowed'; end if;
  if p_client is null or p_kind is null or p_kind not in ('health', 'zone') then raise exception 'bad answer'; end if;
  select c.data into v_data from ft_clients c where c.id = p_client for update;
  if not found then raise exception 'not allowed'; end if;
  v_data := coalesce(v_data, '{}'::jsonb);
  if jsonb_typeof(v_data -> 'choices') is distinct from 'object' then v_data := jsonb_set(v_data, '{choices}', '{}'::jsonb); end if;
  if p_kind = 'zone' then
    v_data := jsonb_set(v_data, '{choices,zone}', jsonb_build_object('state', 'deny', 'at', v_now, 'by', 'coach')) - 'zone';
  else
    v_data := ft_drop_health(v_data);
    v_data := jsonb_set(v_data, '{choices,health}', jsonb_build_object('state', 'declined', 'at', v_now, 'by', 'coach'));
  end if;
  v_data := ft_log(v_data, jsonb_build_object('kind', p_kind, 'answer', case when p_kind = 'zone' then 'deny' else 'decline' end, 'at', v_now, 'got', v_now, 'by', 'coach'));
  perform set_config('ft.consent', 'on', true);
  update ft_clients set data = v_data where id = p_client;
  return jsonb_build_object('choices', v_data -> 'choices', 'minor', v_data -> 'minor', 'minorUntil', v_data -> 'minorUntil');
end; $$;
revoke execute on function coach_withdraw(uuid, text) from public, anon;
grant execute on function coach_withdraw(uuid, text) to authenticated;

-- release day (safe to run again: it only touches what has not been answered)
drop trigger if exists ft_clients_consent on ft_clients;
update ft_clients set data = data - 'zone'   -- time zones sent before the question existed
  where data ? 'zone' and coalesce(data #>> '{choices,zone,state}', '') <> 'allow';
update ft_clients set data = jsonb_set(case when jsonb_typeof(data -> 'choices') = 'object' then data else jsonb_set(data, '{choices}', '{}'::jsonb) end,
    '{choices,health}', jsonb_build_object('state', 'legacy', 'at', now()))   -- health details saved before: kept, read-only, until the client answers (a unit chosen alone is no detail)
  where (data #> '{choices,health}') is null
    and (coalesce(data ->> 'birthday', '') <> '' or coalesce(data ->> 'sex', '') <> '' or coalesce(data ->> 'height', '') <> '' or coalesce(data ->> 'bodyWeight', '') <> ''   -- an emptied field is no saved detail (before v299 a cleared date was saved as "": the check round)
         or exists (select 1 from jsonb_each(case when jsonb_typeof(data -> 'health') = 'object' then data -> 'health' else '{}'::jsonb end) h where h.value not in ('null'::jsonb, '""'::jsonb, 'false'::jsonb)));
create trigger ft_clients_consent before insert or update on ft_clients for each row execute function ft_consent_guard();
select 'consent ready' as status;
