-- ============================================================
-- Fiala Trainings — a client's own health details, health & safety and units (v299)
-- Paste into Supabase: SQL Editor → New query → Run. Safe to run more than once.
-- The client changes their own profile one field at a time, from Settings or a workout's "…":
--   birthday                 'YYYY-MM-DD' (Health details: Date of birth)
--   sex                      'female' | 'male' | 'other'
--   height                   { "v": whole number, "u": "in" | "cm" }   as entered on the wheel (inches in all, or cm)
--   bodyWeight               { "v": whole number, "u": "lb" | "kg" }   as entered on the wheel
--   heightUnit / bodyUnit    'in' | 'cm' / 'lb' | 'kg': the unit each one is shown in (its switch on the wheel)
--   unit                     'lb' | 'kg': the unit their workout weights are logged in ("Weights in")
--   health.limits, health.conditions, health.medications, health.allergies, health.emergency, health.doctor
--                            text, 500 characters at most (the emergency contact and the doctor are written as one line: name, relationship, phone)
--   health.pregnant          true | false
-- A null value takes the field away (Not set). The coach changes the same fields on the client's card.
-- When the workout unit changes, every logged exercise of the client's that carries no unit of its own
-- is stamped with the old one first, as the coach's card does: 100 lb never becomes 100 kg.
-- Needs cloud.sql and client-access.sql (my_email) to have been run before, as they were.
-- ============================================================

create or replace function client_set_profile(p_client uuid, p_key text, p_value jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_data jsonb;
  v_val jsonb := case when p_value is null or jsonb_typeof(p_value) = 'null' then null else p_value end;
  v_sub text;
  v_old text;
  v_new text;
  t record;
  r jsonb;
  v_rows jsonb;
  v_changed boolean;
begin
  if my_email() = '' then raise exception 'not signed in'; end if;
  if p_client is null or p_key is null then raise exception 'missing argument'; end if;

  -- what each field may hold (the app keeps to the same limits)
  if p_key = 'birthday' then
    if v_val is not null and not (jsonb_typeof(v_val) = 'string' and (v_val #>> '{}') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$') then raise exception 'bad birthday'; end if;
  elsif p_key = 'sex' then
    if v_val is not null and not (jsonb_typeof(v_val) = 'string' and (v_val #>> '{}') in ('female', 'male', 'other')) then raise exception 'bad sex'; end if;
  elsif p_key = 'height' then
    if v_val is not null and not (
      jsonb_typeof(v_val) = 'object' and jsonb_typeof(v_val -> 'v') = 'number' and (v_val ->> 'u') in ('in', 'cm')
      and (v_val ->> 'v')::numeric = floor((v_val ->> 'v')::numeric)
      and (v_val ->> 'v')::numeric between 1 and (case when v_val ->> 'u' = 'in' then 120 else 300 end)
    ) then raise exception 'bad height'; end if;
    if v_val is not null then v_val := jsonb_build_object('v', v_val -> 'v', 'u', v_val -> 'u'); end if;   -- nothing else rides along
  elsif p_key = 'bodyWeight' then
    if v_val is not null and not (
      jsonb_typeof(v_val) = 'object' and jsonb_typeof(v_val -> 'v') = 'number' and (v_val ->> 'u') in ('lb', 'kg')
      and (v_val ->> 'v')::numeric = floor((v_val ->> 'v')::numeric)
      and (v_val ->> 'v')::numeric between 1 and (case when v_val ->> 'u' = 'lb' then 1500 else 700 end)
    ) then raise exception 'bad weight'; end if;
    if v_val is not null then v_val := jsonb_build_object('v', v_val -> 'v', 'u', v_val -> 'u'); end if;
  elsif p_key = 'heightUnit' then
    if v_val is not null and not (jsonb_typeof(v_val) = 'string' and (v_val #>> '{}') in ('in', 'cm')) then raise exception 'bad unit'; end if;
  elsif p_key in ('bodyUnit', 'unit') then
    if v_val is not null and not (jsonb_typeof(v_val) = 'string' and (v_val #>> '{}') in ('lb', 'kg')) then raise exception 'bad unit'; end if;
  elsif p_key in ('health.limits', 'health.conditions', 'health.medications', 'health.allergies', 'health.emergency', 'health.doctor') then
    if v_val is not null and not (jsonb_typeof(v_val) = 'string' and length(v_val #>> '{}') <= 500) then raise exception 'bad text'; end if;
  elsif p_key = 'health.pregnant' then
    if v_val is not null and jsonb_typeof(v_val) <> 'boolean' then raise exception 'bad value'; end if;
  else
    raise exception 'bad key';
  end if;

  -- the caller's own record only
  select c.data into v_data from ft_clients c
    where c.id = p_client and lower(coalesce(c.data ->> 'email', '')) = my_email()
    for update;
  if not found then raise exception 'not allowed'; end if;
  v_data := coalesce(v_data, '{}'::jsonb);

  -- the workout unit: stamp what was logged without a unit with the old one, before it changes
  if p_key = 'unit' and v_val is not null then
    v_old := coalesce(nullif(v_data ->> 'unit', ''), 'lb');
    v_new := v_val #>> '{}';
    if v_old <> v_new then
      for t in select f.id, f.data from ft_trainings f where f.client_id = p_client for update loop
        v_rows := '[]'::jsonb;
        v_changed := false;
        for r in select * from jsonb_array_elements(coalesce(t.data -> 'rows', '[]'::jsonb)) loop
          if coalesce(r ->> 'unit', '') = '' and jsonb_typeof(r -> 'weights') = 'array' and exists (
            select 1 from jsonb_array_elements(r -> 'weights') w
            where jsonb_typeof(w) in ('string', 'number') and btrim(w #>> '{}') ~ '^[0-9]+([.,][0-9]+)?$'
          ) then
            r := jsonb_set(r, '{unit}', to_jsonb(v_old));
            v_changed := true;
          end if;
          v_rows := v_rows || jsonb_build_array(r);
        end loop;
        if v_changed then
          update ft_trainings set data = jsonb_set(data, '{rows}', v_rows) where id = t.id;
        end if;
      end loop;
    end if;
  end if;

  -- write the whole value of the one field, so a resend is harmless
  if p_key like 'health.%' then
    v_sub := substr(p_key, 8);
    if jsonb_typeof(v_data -> 'health') is distinct from 'object' then v_data := jsonb_set(v_data, '{health}', '{}'::jsonb); end if;
    if v_val is null then
      v_data := v_data #- array['health', v_sub];
    else
      v_data := jsonb_set(v_data, array['health', v_sub], v_val);
    end if;
  elsif v_val is null then
    v_data := v_data - p_key;
  else
    v_data := jsonb_set(v_data, array[p_key], v_val);
  end if;

  update ft_clients set data = v_data where id = p_client;
end;
$$;
revoke execute on function client_set_profile(uuid, text, jsonb) from public, anon;
grant execute on function client_set_profile(uuid, text, jsonb) to authenticated;

select 'client-profile.sql applied' as result;
