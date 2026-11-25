// v316, the owner's decisions (18 Nov 2026), after legal research (California, Washington, Nevada, Connecticut, the FTC, the EU): ask every client once
// before their phone's time zone reaches the coach (Don't Allow | Allow); store health details only after the client agrees in the app (a client under 18:
// the teen, then a parent or guardian, who types their name), or after the coach switches on "signed a paper form"; details saved before v316 wait,
// read-only, for the client's answer; a switch for each in the client's Settings; every answer kept by the server with its time (supabase/client-consent.sql).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { test, assert, tick } from "./assert.js";
import { makeSupabase } from "./fake-supabase.js";
import { load } from "./load.js";
import { healthState, healthShown, healthEditable, needsParent, zoneState, isMinor, tooYoung, youngRec, applyChoice, HEALTH_KEYS, TEMPLATES_ID } from "../app/model.js";
const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const sql = (f) => fs.readFileSync(new URL("../supabase/" + f, import.meta.url), "utf8");
const app = await load();
const { fns, maps } = app;
const settle = async () => { const until = Date.now() + 15000; do await tick(5); while ((app.get().inflight > 0 || maps.timers.size) && Date.now() < until); };
const AT = "2026-11-18T08:00:00.000Z";
const ON = new Date(AT).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });   // the moment on this computer's clock (Nov 17 in Hawaii): a moment is read on the reader's clock
const HEALTHY = { birthday: "1990-03-14", sex: "female", height: { v: 67, u: "in" }, bodyWeight: { v: 142, u: "lb" }, heightUnit: "in", bodyUnit: "lb", health: { limits: "Left knee", pregnant: false } };
const clientOn = (sb, extra) => { app.reset(); fns.leaveSettings(); app.set({ sb, signedIn: true, clientMode: true, myClientId: "c1", backend: fns.clientBackend, sessionEmail: "jane@x.com", view: { name: "client", id: "c1" } }); maps.clients.set("c1", { id: "c1", name: "Jane Doe", unit: "lb", email: "jane@x.com", ...(extra || {}) }); };
const coachOn = (sb, extra) => { app.reset(); fns.leaveSettings(); app.set({ sb, signedIn: true, clientMode: false, backend: fns.cloudBackend, sessionEmail: "coach@x.com", view: { name: "client", id: "c1" } }); maps.clients.set("c1", { id: "c1", name: "Jane Doe", unit: "lb", ...(extra || {}) }); };

test("the states: health details shown once agreed, on a signed paper form, or saved before v316 (read-only); changed only when agreed or on paper; the time zone only after Allow", () => {
  const st = (s) => ({ choices: { health: { state: s, at: AT } } });
  assert.deepStrictEqual(["agreed", "paper", "legacy", "declined", "weird"].map((s) => healthState(st(s))), ["agreed", "paper", "legacy", "declined", "none"]);
  assert.deepStrictEqual([healthState({}), healthState(null), healthState({ choices: "x" })], ["none", "none", "none"], "never asked");
  assert.deepStrictEqual(["agreed", "paper", "legacy", "declined"].map((s) => [healthShown(st(s)), healthEditable(st(s))]), [[true, true], [true, true], [true, false], [false, false]]);
  assert.deepStrictEqual([zoneState({ choices: { zone: { state: "allow" } } }), zoneState({ choices: { zone: { state: "deny" } } }), zoneState({})], ["allow", "deny", ""]);
  assert.deepStrictEqual([isMinor({ minor: true }, "2026-11-18"), isMinor({ birthday: "2010-01-01" }, "2026-11-18"), isMinor({ birthday: "2008-11-18" }, "2026-11-18"), isMinor({}, "2026-11-18")], [true, true, false, false], "the coach's Under 18 switch, or a birthday under 18 (18 on the day itself is an adult)");
  assert.deepStrictEqual([tooYoung("2014-01-01", "2026-11-18"), tooYoung("2013-11-18", "2026-11-18"), tooYoung("", "2026-11-18")], [true, false, false], "under 13 is refused (13 on the day itself is fine)");
});

test("an answer laid on the record as the server writes it: Don't Allow deletes the time zone; Don't Allow for health deletes every health detail; Agree records a parent's name", () => {
  const r = applyChoice({ zone: { zone: "Asia/Tokyo", at: AT } }, "zone", "deny", null, AT);
  assert.deepStrictEqual(r, { choices: { zone: { state: "deny", at: AT, by: "client" } } });
  const h = applyChoice({ ...JSON.parse(JSON.stringify(HEALTHY)), name: "Jane" }, "health", "decline", null, AT);
  assert.deepStrictEqual(h, { name: "Jane", choices: { health: { state: "declined", at: AT, by: "client" } } }, "every health detail goes: " + HEALTH_KEYS.join(", "));
  assert.deepStrictEqual(applyChoice({}, "health", "agree", "Sam Rivera", AT).choices.health, { state: "agreed", at: AT, by: "client", parent: { name: "Sam Rivera", at: AT } });
  assert.deepStrictEqual(applyChoice({ choices: { zone: { state: "allow", at: AT } } }, "health", "agree", null, AT).choices, { zone: { state: "allow", at: AT }, health: { state: "agreed", at: AT, by: "client" } }, "one answer leaves the other as it was");
  assert.deepStrictEqual(applyChoice({}, "health", "decline", null, AT, "2026-11-18", "parent").choices.health, { state: "declined", at: AT, by: "parent" }, "a parent's Disagree is recorded as the parent's (the check round)");
});

test("the client's answer: shown at once, kept on the phone, sent through client_set_choice before any health detail (the server refuses them until the Agree), a parent's name with it", async () => {
  const sb = makeSupabase(), sent = [];
  sb.rpcs.client_set_choice = async (a) => { sent.push(["choice", a]); return null; };
  sb.rpcs.client_set_profile = async (a) => { sent.push(["profile", a.p_key]); return null; };
  clientOn(sb);
  assert.strictEqual(fns.setChoice("health", "agree", "Sam Rivera"), true);
  { const h = maps.clients.get("c1").choices.health, a = maps.pendingChoices.get("c1").get("health");
    assert.deepStrictEqual(h, { state: "agreed", at: h.at, by: "client", parent: { name: "Sam Rivera", at: h.at }, id: a.id }, "shown at once, with this phone's answer id on its copy (never sent: a detail typed under it is timed by the server's log)"); }
  assert.ok(maps.pendingChoices.get("c1").has("health"), "kept on the phone until it lands");
  fns.setProfile("c1", "sex", "female");
  await settle();
  assert.deepStrictEqual(sent.map((x) => x[0]), ["choice", "profile"], "the Agree first, then the detail");
  { const a = sent[0][1]; assert.deepStrictEqual([a.p_client, a.p_kind, a.p_answer, a.p_parent, a.p_by, Number.isInteger(a.p_age) && a.p_age >= 0 && a.p_age < 60], ["c1", "health", "agree", "Sam Rivera", "client", true], "with how long ago it was given, by the phone's own clock (an older answer landing late never overrides a newer one, a clock set wrong never decides: the check rounds)"); }
  assert.ok(!maps.pendingChoices.has("c1"), "landed: off the phone's queue");
  app.reset();
});

test("health details wait while their Agree has not landed (the rule not installed yet keeps both on the phone); a refused answer is dropped", async () => {
  const sb = makeSupabase(), sent = [];
  sb.rpcs.client_set_profile = async (a) => { sent.push(a.p_key); return null; };
  clientOn(sb);
  fns.setChoice("health", "agree"); fns.setProfile("c1", "sex", "female"); await settle();   // no client_set_choice in the fake: PGRST202, as before client-consent.sql is run
  assert.strictEqual(app.get().consentMissing, true, "client-consent.sql not run: noted");
  assert.deepStrictEqual(sent, [], "the health detail waits for its Agree, never refused and lost");
  assert.ok(maps.pendingChoices.get("c1").has("health") && maps.pendingProfile.get("c1").has("sex"), "both kept on the phone");
  app.reset();
  const sb2 = makeSupabase(); clientOn(sb2);
  sb2.rpcs.client_set_choice = async () => { const e = new Error("parent needed"); e.code = "P0001"; throw e; };
  fns.setChoice("health", "agree"); await settle();
  assert.ok(!(maps.pendingChoices.get("c1") || new Map()).has("health"), "refused for good: dropped (the server's copy comes back with the next sync)");
  app.reset();
});

test("Don't Allow on the phone: the time zone or the health details go at once, and health edits still on their way go with them", async () => {
  const sb = makeSupabase(); sb.rpcs.client_set_choice = async () => new Promise(() => {});
  clientOn(sb, { ...JSON.parse(JSON.stringify(HEALTHY)), choices: { health: { state: "agreed", at: AT }, zone: { state: "allow", at: AT } }, zone: { zone: "Asia/Tokyo", at: AT } });
  maps.pendingProfile.set("c1", new Set(["sex", "unit"]));
  fns.setChoice("zone", "deny"); fns.setChoice("health", "decline");
  const c = maps.clients.get("c1");
  assert.ok(c.zone === undefined && HEALTH_KEYS.every((k) => c[k] === undefined), "gone at once from the phone");
  assert.deepStrictEqual([...maps.pendingProfile.get("c1")], ["unit"], "only Weights in stays queued (no health detail)");
  app.reset();
});

test("a sync keeps the client's answers still on their way over the server's copy", () => {
  clientOn(makeSupabase());
  maps.pendingChoices.set("c1", new Map([["zone", { answer: "allow", parent: null, at: AT }]]));
  fns.mergeDown(maps.clients, "clients", [{ id: "c1", data: { id: "c1", name: "Jane Doe", unit: "lb", email: "jane@x.com" } }], true, Date.now());
  assert.deepStrictEqual(maps.clients.get("c1").choices, { zone: { state: "allow", at: AT, by: "client" } });
  app.reset();
});

test("the coach's saves never write a client's choices: the server's copy, with or without a copy read to merge against", async () => {
  const theirs = { health: { state: "agreed", at: AT }, zone: { state: "allow", at: AT } };
  for (const read of [true, false]) {
    const sb = makeSupabase(); coachOn(sb, { choices: { health: { state: "declined", at: "2026-11-01T00:00:00.000Z" } } });
    sb.seed("ft_clients", "c1", { id: "c1", name: "Jane", unit: "lb", choices: theirs });
    if (read) maps.seenAt.set("clients/c1", "S0");
    maps.clients.get("c1").name = "Jane Doe";
    await fns.cloudBackend.set("clients", "c1", JSON.parse(JSON.stringify(maps.clients.get("c1"))));
    const saved = sb.tables.ft_clients.get("c1").data;
    assert.deepStrictEqual([saved.name, saved.choices], ["Jane Doe", theirs], (read ? "a conflict" : "nothing read yet") + ": the rename lands, the client's choices stand");
    await settle();
  }
  app.reset();
});

test("a restore keeps the client's choices here, and never brings back health details the client hasn't agreed to (saved-before ones exactly as here)", () => {
  const C = "1b4e28ba-2fa1-41d2-883f-0016d3cca427", file = (rec) => ({ app: "fiala-trainings", format: 1, clients: { [C]: { id: C, name: "Jane", unit: "lb", ...rec } }, trainings: {} });
  for (const [st, want] of [["declined", {}], ["legacy", { sex: "male" }], ["agreed", { sex: "male" }]]) {
    app.reset(); app.set({ signedIn: true, clientMode: false, backend: fns.cloudBackend });
    maps.clients.set(C, { id: C, name: "Jane", unit: "lb", sex: st === "declined" ? undefined : "male", choices: { health: { state: st, at: AT } } }); maps.seenAt.set("clients/" + C, "S1");
    const plan = fns.planRestore(file({ sex: "female", choices: { health: { state: "agreed", at: "2026-11-01T00:00:00.000Z" } } }));
    const c = plan.cs.find((x) => x.id === C) || maps.clients.get(C);   // not in the plan: the file's copy, read the way here holds it, is what is here already
    assert.deepStrictEqual([c.choices.health.state, c.sex === undefined ? {} : { sex: c.sex }], [st, want], st + ": the choices here; health details " + (st === "declined" ? "none" : "as here (the owner's pick, 19 Nov 2026: a restore never brings back what a client deleted or changed in the app)"));
  }
  app.reset();
});

test("the coach's card: who agreed and when, or why the details can't be changed; the health pages say the same; the limits note only once agreed", () => {
  const sb = makeSupabase();
  const note = (choices, extra) => { coachOn(sb, { choices, ...(extra || {}) }); return fns.cardHealthNote(maps.clients.get("c1")); };
  assert.strictEqual(note(undefined), "Waiting for Jane to agree in the app.");
  assert.strictEqual(note({ health: { state: "legacy", at: AT } }), "Jane hasn’t answered yet: asked at their next open.");
  assert.strictEqual(note({ health: { state: "declined", at: AT } }), "Jane chose not to store health details.");
  assert.strictEqual(note({ health: { state: "paper", at: AT } }), "Signed on " + ON, "the paper form's date, under the card (the final pictures)");
  assert.strictEqual(note({ health: { state: "agreed", at: AT } }), "Jane agreed in the app · " + ON);
  assert.strictEqual(note({ health: { state: "agreed", at: AT, parent: { name: "Sam Rivera", at: AT } } }), "Jane and Sam Rivera (parent) agreed · " + ON);
  coachOn(sb, { choices: { health: { state: "legacy", at: AT } } });
  assert.strictEqual(fns.healthLockLine(maps.clients.get("c1")), "Jane hasn’t answered yet: asked at their next open. You can edit these once Jane agrees.");
  clientOn(sb, { choices: { health: { state: "declined", at: AT } } });
  assert.strictEqual(fns.healthLockLine(maps.clients.get("c1")), "You chose not to store health details. Turn it on in Settings.");
  assert.ok(html.includes('id="cardPaper" role="switch"') && html.includes('id="cardMinor" role="switch"') && html.includes('<p class="list-foot" id="cardHealthNote"></p>'), "the card's two switches and its line");
  coachOn(sb, { choices: { health: { state: "agreed", at: AT } }, minor: true });
  assert.strictEqual(fns.cardHealthNote(maps.clients.get("c1")), "Waiting for a parent or guardian to agree in Jane’s app.", "marked under 18 after agreeing alone");
  assert.strictEqual(fns.healthLockLine(maps.clients.get("c1")), "Waiting for a parent or guardian to agree in Jane’s app. You can edit these once they agree.");
  clientOn(sb, { choices: { health: { state: "agreed", at: AT } }, minor: true });
  assert.strictEqual(fns.healthLockLine(maps.clients.get("c1")), "A parent or guardian also agrees before these can change. Tap a detail to ask them.");
  assert.ok(html.includes('id="meHealthSw" role="switch"') && html.includes('id="meZoneSw" role="switch"') && html.includes('<li id="meZoneRow" hidden>'), "the client's two switches and the city they share");
  app.reset();
});

test("the coach can't change a client's health details before they agree; the paper form goes through its own rule", async () => {
  const sb = makeSupabase(), calls = []; sb.rpcs.coach_set_paper = async (a) => { calls.push(a); return null; };
  coachOn(sb, JSON.parse(JSON.stringify({ ...HEALTHY, choices: { health: { state: "legacy", at: AT } } })));
  assert.deepStrictEqual([fns.setProfile("c1", "sex", "male"), maps.clients.get("c1").sex], [false, "female"], "read-only while it waits: nothing changes here (the server's guard keeps the stored one too; the check round: an editor left open wrote what the server silently kept)");
  app.reset();
  coachOn(sb);
  assert.ok(/coach_set_paper/.test(fs.readFileSync(new URL("../app/sync.js", import.meta.url), "utf8")) && /coachSetPaper\(id, on, /.test(fs.readFileSync(new URL("../app/main.js", import.meta.url), "utf8")), "the switch calls the paper-form rule, never a whole-record save");
  app.reset();
});

test("the server: the guard, the answers, the paper form, the coach's withdrawal, the release-day clean-up; client-zone.sql refuses without Allow; client-profile.sql refuses health details without the agreement", () => {
  const c = sql("client-consent.sql"), z = sql("client-zone.sql"), p = sql("client-profile.sql");
  assert.ok(/create trigger ft_clients_consent before insert or update on ft_clients for each row execute function ft_consent_guard\(\);/.test(c), "a guard on every writer");
  assert.ok(c.includes("v_mine boolean := coalesce(current_setting('ft.consent', true), '') = 'on';") && c.includes("if tg_op = 'UPDATE' and not v_mine then") && c.includes("new.data := jsonb_set(new.data, '{choices}', old.data -> 'choices')") && c.includes("new.data := jsonb_set(new.data, '{zone}', old.data -> 'zone')"), "only the rules change choices and the zone");
  assert.ok(c.includes("if tg_op = 'INSERT' and not v_mine then new.data := new.data - 'choices' - 'zone'; end if;"), "a client written anew (a restore of one deleted) comes with no answers (the check round)");
  assert.ok(c.includes("if coalesce(new.data #>> '{choices,zone,state}', '') <> 'allow' then new.data := new.data - 'zone'; end if;"), "a time zone is kept only after Allow, whoever writes it");
  assert.ok(c.includes("elsif v_state is null or v_state not in ('agreed', 'paper', 'legacy') then") && c.includes("if tg_op = 'UPDATE' and (v_state = 'legacy'"), "health details stripped when not agreed, read-only while they wait");
  assert.ok(c.includes("or (v_state in ('agreed', 'paper') and ft_needs_parent(old.data) and ft_needs_parent(new.data) and jsonb_typeof(new.data #> '{choices,health,parent}') is distinct from 'object')) then") && c.includes("if k = 'birthday' and v_state <> 'legacy' and coalesce(old.data ->> 'minor', '') <> 'true' then continue; end if;"), "a parent awaited: read-only, the date of birth still put right (the check round)");
  assert.ok(c.includes("select coalesce(d #>> '{choices,health,state}', '') in ('agreed', 'paper')") && c.includes("(jsonb_typeof(d -> 'minorUntil') = 'number'"), "a paper form signed alone waits for the parent too; the year kept after a Don't Allow counts until it ends");
  assert.ok(/create or replace function ft_drop_health\(d jsonb\)/.test(c) && c.includes("jsonb_set(d, '{minorUntil}', to_jsonb(extract(year from ft_date(d ->> 'birthday'))::int + 18))") && (c.match(/ft_drop_health\(v_data\)/g) || []).length === 4 && c.includes("new.data := ft_drop_health(new.data);"), "Don't Allow, the form turned off, the coach's withdrawal and the guard's own strip (a restore of a teen deleted): the details go, a teen's year stays (never the date)");
  assert.ok(/create or replace function ft_young\(d jsonb\)/.test(c) && c.includes("(d ->> 'minorUntil')::numeric - 5)") && c.includes("if p_answer in ('allow', 'agree') and ft_young(v_data) then raise exception 'too young'; end if;") && c.includes("if ft_young(v_data) then raise exception 'too young'; end if;"), "under 13, by the birthday or the year kept: no Allow, no Agree, no paper form (the check round)");
  assert.ok(c.includes("exception when others then return null;") && !/\(v_data ->> 'birthday'\)::date/.test(c), "a malformed birthday never stops a save");
  assert.ok(c.includes("drop function if exists client_set_choice(uuid, text, text, text);") && c.includes("drop function if exists client_set_choice(uuid, text, text, text, timestamptz, text);") && c.includes("drop function if exists client_set_choice(uuid, text, text, text, integer, text);") && /create or replace function client_set_choice\(p_client uuid, p_kind text, p_answer text, p_parent text default null, p_age integer default null, p_by text default 'client', p_id text default null, p_taken_back boolean default false\)\nreturns text/.test(c) && c.includes("lower(coalesce(c.data ->> 'email', '')) = my_email()") && c.includes("raise exception 'parent needed'") && c.includes("raise exception 'too young'"), "the client's own record; a minor needs a parent; under 13 refused");
  assert.ok(c.includes("v_at timestamptz := now() - make_interval(secs => greatest(0, least(coalesce(p_age, 0), 31536000)));") && c.includes("if ft_time(v_cur ->> 'at') > v_at + interval '2 seconds' then") && c.includes("return 'stale';") && c.includes("if p_answer = 'decline' and not coalesce(p_taken_back, false) and v_cur ->> 'state' = 'off' and ft_time(v_cur ->> 'at') > v_at then") && c.includes("coalesce(v_data ->> 'paused', '') = 'true' then raise exception 'paused'"), "how long ago it was given, by the phone's own clock: an Allow or Agree given before the answer on record is set aside and said so; a withdrawal always stands (the check rounds)");
  assert.ok(c.includes("and coalesce(v_at <= ft_time(v_cur ->> 'at') + interval '2 seconds', true) then return 'same'; end if;   -- the same answer again") && c.includes("and coalesce(v_cur ->> 'by', 'client') = v_by") && !c.includes("too many answers") && c.includes("then (d #> '{choices,log}') - 1 else"), "a resend writes nothing (a parent's Disagree over the client's is no resend); the log keeps its first answer and the newest, never refusing one (the check round)");
  assert.ok(c.includes("if v_by not in ('client', 'parent') or (v_by = 'parent' and p_answer <> 'decline') then raise exception 'bad answer'; end if;"), "a parent's own answer is a Disagree");
  assert.ok(c.includes("drop function if exists coach_set_paper(uuid, boolean);") && /create or replace function coach_set_paper\(p_client uuid, p_on boolean, p_parent boolean default false\)\nreturns jsonb/.test(c) && c.includes("if v_state = 'agreed' then raise exception 'agreed in the app'; end if;") && c.includes("if v_state is distinct from 'paper' then raise exception 'not on paper'; end if;") && c.includes("if ft_minor(v_data) and not coalesce(p_parent, false) then raise exception 'parent needed'; end if;") && c.includes("jsonb_build_object('state', 'off', 'at', v_now, 'by', 'coach')") && c.includes("then raise exception 'declined in the app'; end if;"), "the paper form: the coach only, never over the client's own Agree, a teen's with the parent; off leaves a dated answer (an older Agree never lands as new)");
  assert.strictEqual((c.match(/return jsonb_build_object\('choices', v_data -> 'choices', 'minor', v_data -> 'minor', 'minorUntil', v_data -> 'minorUntil'\);/g) || []).length, 2, "the coach's rules answer the choices and the under-18 note as the server now has them");
  assert.ok(/create or replace function coach_withdraw\(p_client uuid, p_kind text\)\nreturns jsonb/.test(c) && c.includes("if p_client is null or p_kind is null or p_kind not in ('health', 'zone') then raise exception 'bad answer'; end if;"), "the coach records a withdrawal told by email or in person (the check round)");
  assert.ok((c.match(/if not is_trainer\(\) then raise exception 'not allowed'; end if;/g) || []).length === 2, "both coach rules: the coach only");
  for (const sig of ["client_set_choice(uuid, text, text, text, integer, text, text, boolean)", "coach_set_paper(uuid, boolean, boolean)", "coach_withdraw(uuid, text)"]) assert.ok(c.includes("revoke execute on function " + sig + " from public, anon;") && c.includes("grant execute on function " + sig + " to authenticated;"), "grants as every rule: " + sig);
  assert.ok(c.indexOf("drop trigger if exists ft_clients_consent on ft_clients;") < c.indexOf("update ft_clients set data = data - 'zone'") && c.indexOf("'legacy'") < c.indexOf("create trigger ft_clients_consent"), "release day: zones sent before the question deleted, saved health details marked as waiting, then the guard");
  { const day = c.slice(c.indexOf("-- release day")); assert.ok(["birthday", "sex", "height", "bodyWeight"].every((k) => day.includes("coalesce(data ->> '" + k + "', '') <> ''")) && day.includes("h.value not in ('null'::jsonb, '\"\"'::jsonb, 'false'::jsonb)") && !day.includes("?| array") && !day.includes("'heightUnit'"), "release day: a unit chosen alone is no saved detail, nor an emptied field (the check rounds: a date cleared before v299 was saved as \"\" and the client was asked to keep details that weren't there)"); }
  assert.ok(c.trim().endsWith("select 'consent ready' as status;"));
  assert.ok(z.includes("if coalesce(v_choice, '') <> 'allow' then raise exception 'not allowed'; end if;") && z.includes("perform set_config('ft.consent', 'on', true);") && z.includes("if coalesce(v_paused, '') = 'true' then raise exception 'paused'; end if;"), "client-zone.sql: only after Allow, never from a paused client");
  assert.ok(p.includes("if p_key <> 'unit' and v_val is not null and coalesce(v_data ->> 'paused', '') = 'true' then raise exception 'paused'; end if;") && p.includes("if p_key <> 'unit' and v_val is not null and to_regprocedure("), "client-profile.sql: a paused client stores no new health detail; clearing one still goes, a parent awaited or not (the check round)");
  assert.ok(c.includes("if v_state <> 'legacy' and not (new.data ? k) then continue; end if;") && c.includes("(old.data -> 'health') @> (new.data -> 'health') then continue; end if;"), "the guard lets a removal through while a parent is awaited (you can remove what you entered)");
  assert.ok(c.includes("if p_answer = 'decline' and not coalesce(p_taken_back, false) and v_cur ->> 'state' = 'paper' and ft_time(v_cur ->> 'at') > v_at + interval '2 seconds'\n     and not exists (select 1 from jsonb_array_elements(coalesce(v_data #> '{choices,log}', '[]'::jsonb)) e\n                     where e ->> 'kind' = 'health' and e ->> 'by' in ('client', 'parent') and ft_time(e ->> 'at') > v_at + interval '2 seconds') then") && c.indexOf("if ft_time(v_cur ->> 'at') > v_at + interval '2 seconds' then") < c.indexOf("interval '2 seconds', true) then return 'same'; end if;"), "a person's Don't Allow beats a paper form recorded later; an identical answer given long before is logged as stale, not 'same' (the check round)");
  assert.ok(p.includes("if p_key <> 'unit' and coalesce(v_data #>> '{choices,health,state}', '') not in ('agreed', 'paper') then raise exception 'no agreement'; end if;"), "client-profile.sql: health details only once agreed");
  assert.ok(p.includes("to_regprocedure('public.ft_needs_parent(jsonb)') is not null") && p.includes("if v_np then raise exception 'parent needed'; end if;"), "client-profile.sql: refused while a parent is awaited (kept on the phone and the parent asked), never answered OK and dropped (the check round)");
});

test("under 18 found out after agreeing alone (the coach's Under 18, a birthday entered later): read-only until a parent agrees; a Don't Allow keeps the note", () => {
  const ag = (extra) => ({ choices: { health: { state: "agreed", at: AT } }, ...extra });
  assert.deepStrictEqual([needsParent(ag({ minor: true }), "2026-11-18"), needsParent(ag({ birthday: "2010-01-01" }), "2026-11-18"), needsParent(ag({}), "2026-11-18"), needsParent(ag({ minor: true, choices: { health: { state: "agreed", at: AT, parent: { name: "Sam Rivera", at: AT } } } }), "2026-11-18"), needsParent({ minor: true, choices: { health: { state: "paper", at: AT } } }, "2026-11-18"), needsParent({ minor: true, choices: { health: { state: "paper", at: AT, parent: { paper: true, at: AT } } } }, "2026-11-18")], [true, true, false, false, true, false], "agreed alone and under 18: a parent still to agree; a paper form signed alone the same, until the coach records the parent's signature (the check round)");
  assert.deepStrictEqual([healthEditable(ag({ minor: true }), "2026-11-18"), healthShown(ag({ minor: true })), healthEditable(ag({ birthday: "2008-11-18" }), "2026-11-18")], [false, true, true], "shown, not changed; 18 today is grown up");
  const rec = { id: "c1", birthday: "2011-02-02", sex: "male" }; applyChoice(rec, "health", "decline", null, AT, "2026-11-18");
  assert.deepStrictEqual([rec.minorUntil, rec.minor, rec.birthday, rec.sex, rec.choices.health.state], [2029, undefined, undefined, undefined, "declined"], "the birthday goes; the year the client turns 18 stays (never the date: the check round)");
  assert.deepStrictEqual([isMinor(rec, "2029-12-31"), isMinor(rec, "2030-01-01")], [true, false], "under 18 until that year ends, then grown up (the check round: the note never expired)");
  const grown = { id: "c2", birthday: "1990-02-02" }; applyChoice(grown, "health", "decline", null, AT, "2026-11-18"); assert.deepStrictEqual([grown.minor, grown.minorUntil], [undefined, undefined], "a grown-up gets no note");
});

test("the health question as the client meets it: Apple's tall sheet, the kinds of details and the policy's link; the teen, then a parent typing their name; the parent alone when found out later; the dim is later", () => {
  const r = JSON.parse(execFileSync(process.execPath, [path.join(path.dirname(fileURLToPath(import.meta.url)), "consent-probe.mjs")], { encoding: "utf8", timeout: 90000 }).trim().split("\n").pop());
  const KINDS = ["Date of birth, sex, height and weight", "Injuries and limits", "Conditions, medications and allergies", "Pregnancy", "Emergency contact and doctor"];
  assert.deepStrictEqual([r.adult.title, r.adult.kinds, r.adult.link, r.adult.buttons, r.adult.role, r.adult.pageInert], ["Store your health details?", KINDS, ["health-privacy.html", "Consumer Health Data Privacy Policy"], ["Don’t Allow", "Agree"], "dialog", true], "the final picture's words, its link, two equal answers, the page behind inert");
  assert.deepStrictEqual(r.adult.paras, ["To keep your training safe, your coach plans your workouts around the health details you enter or tell your coach:", "Only you and your coach can see them. In an emergency, your coach may share them with emergency services, your emergency contact or doctor to get you help.", "You can withdraw anytime: turn off Store health details in Settings, which deletes them."]);
  assert.deepStrictEqual(r.adultEarly, { open: true, pending: null }, "a double tap's second answers nothing");
  assert.deepStrictEqual(r.adultAgreed, { open: false, pending: { answer: "agree", parent: null }, state: "agreed", pageInert: false });
  assert.deepStrictEqual([r.teen2.title, r.teen2.sub, r.teen2.buttons, r.teen2.yesOff, r.teen2.field, r.teen2.still, r.teen2Pending, r.typed], ["Store Jane’s health details?", "Jane is under 18, so a parent or guardian also agrees.", ["Disagree", "Agree"], true, "Your name", true, null, false], "the parent's page comes up still, Agree waits for a name, nothing recorded until then");
  assert.deepStrictEqual(r.teenAgreed, { open: false, pending: { answer: "agree", parent: "Sam Rivera" }, parent: "Sam Rivera" }, "the name as typed, its spaces tidied");
  assert.deepStrictEqual(r.later, { open: false, pending: null, state: null, pageInert: false }, "the dim: later, nothing recorded");
  assert.deepStrictEqual([r.adult.x, r.cross], ["Not now", { open: false, pending: null }], "the close cross: not now, asked again later (the check round: a phone had no other way out)");
  assert.deepStrictEqual(r.enter, { open: true, pending: null }, "the keyboard's Return or done key puts the keyboard away and answers nothing (the check round)");
  assert.deepStrictEqual(r.parentNo, { open: false, pending: { answer: "decline", parent: null }, minorUntil: r.year + 3, by: "parent" }, "the parent's Disagree is a no, recorded as the parent's: the details go, the year the client turns 18 stays");
  assert.deepStrictEqual([r.teen2.sub, r.lateParent.sub], ["Jane is under 18, so a parent or guardian also agrees.", "Jane is under 18, so a parent or guardian also agrees. If you disagree, the health details already saved are deleted."], "the parent's page says a Disagree deletes the details only when there are some, at the top, in sight (the check rounds)");
  assert.deepStrictEqual(r.young, { sheet: false, alert: "For ages 13 and up" }, "under 13: never asked; the app is for 13 and up (the check round)");
  assert.deepStrictEqual([r.lateParent.title, r.lateParent.still, r.lateAgreed], ["Store Jane’s health details?", false, { pending: { answer: "agree", parent: "Sam Rivera" }, editable: true }], "agreed alone, marked under 18 since: the parent's page alone");
  assert.deepStrictEqual([r.keep.title, r.keep.sub, r.keep.paras[3], r.escape], ["Keep your health details?", "Health details were saved for you earlier. If you don’t allow this, they’re deleted.", "You can withdraw anytime: turn off Store health details in Settings, which deletes them.", { open: false, pending: null }], "saved before v316: Keep, the warning in the grey line at the top (in sight on a small phone: the check round), and Escape is later");
  const ON2 = new Date("2026-11-18T20:00:00.000Z").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  assert.deepStrictEqual([r.askedDel, r.delEarly], [{ title: "Delete Jane’s health details?", yes: "Delete", open: true }, { open: true, calls: [] }], "the coach's withdrawal asks first; a double tap's second answers nothing");
  assert.deepStrictEqual(r.withdrawn, { calls: ["withdraw:health"], state: "declined", by: "coach", minorUntil: 2028, note: "Health details deleted on request · " + ON2 }, "recorded through the rule, the card follows the server's answer (the check round: a withdrawal by email or in person)");
  assert.deepStrictEqual(r.zoneStopped, { calls: ["withdraw:health", "withdraw:zone"], zone: null, state: "deny" }, "Stop sharing time zone: the rule, the saved zone gone");
  assert.deepStrictEqual(r.teenPaper, { sent: [[true, true]], state: "paper", parent: true, minorSwitched: true, status: "Saved" }, "a teen's paper form goes with the parent's signature; Under 18 by the date of birth can't be switched off");
  assert.deepStrictEqual(r.staleSwitch, { pending: null, shown: "true" }, "a switch a sync left behind records nothing opposite and shows the record again (the check round)");
  assert.deepStrictEqual(r.youngSwitch, { alert: "For ages 13 and up", pending: null }, "a child turning on Share time zone is told why; nothing is queued (the check round)");
  assert.deepStrictEqual(r.heldOnce, { first: true, again: false, newMark: true, outlived: false, asked: false }, "the parent's wait: asked once when it comes, 'Not now' holds until a new one, a newer answer on record ends it (the check rounds)");
  assert.deepStrictEqual(r.heldTyping, { whileTyping: false, after: true }, "never while a box is being typed in: asked once the typing ends");
  assert.deepStrictEqual(r.rejected, []);
});

test("the check round's fixes in the rules: both days count (an 18th birthday in Tokyo before Los Angeles's); a restore never brings answers back, nor drops a known under-18 note", () => {
  assert.deepStrictEqual([isMinor({ birthday: "2008-11-19" }, ["2026-11-19", "2026-11-18"]), isMinor({ birthday: "2008-11-19" }, ["2026-11-19"]), tooYoung("2013-11-19", ["2026-11-19", "2026-11-18"])], [true, false, true], "under on either day: the phone is never less strict than the server");
  const C = "1b4e28ba-2fa1-41d2-883f-0016d3cca427", file = (rec) => ({ app: "fiala-trainings", format: 1, clients: { [C]: { id: C, name: "Jane", unit: "lb", ...rec } }, trainings: {} });
  app.reset(); app.set({ signedIn: true, clientMode: false, backend: fns.cloudBackend });
  const gone = fns.planRestore(file({ ...HEALTHY, zone: { zone: "Asia/Tokyo", at: AT }, choices: { health: { state: "agreed", at: AT }, zone: { state: "allow", at: AT } } })).cs.find((x) => x.id === C);
  assert.deepStrictEqual([gone.choices, gone.zone, gone.birthday, gone.health], [undefined, undefined, undefined, undefined], "a client not here comes back with no answers, no time zone and no health details: both questions are asked again (the server strips them from a record written anew too)");
  maps.clients.set(C, { id: C, name: "Jane", unit: "lb", minorUntil: 2029, choices: { health: { state: "declined", at: AT } } }); maps.seenAt.set("clients/" + C, "S1");
  const kept = fns.planRestore(file({ name: "Jane", choices: { health: { state: "agreed", at: "2026-11-01T00:00:00.000Z" } } })).cs.find((x) => x.id === C) || maps.clients.get(C);
  assert.deepStrictEqual([kept.minorUntil, kept.choices.health.state], [2029, "declined"], "the under-18 note here stays over an older file (the check round: a teen's parent was no longer asked)");
  app.reset();
});

test("a refused Agree ('parent needed': the coach's Under 18 had not reached the phone) leaves the details typed meanwhile on the phone, and asks again", async () => {
  const sb = makeSupabase(), sent = []; sb.rpcs.client_set_choice = async () => { const e = new Error("parent needed"); e.code = "P0001"; throw e; }; sb.rpcs.client_set_profile = async (a) => { sent.push(a.p_key); return null; };
  clientOn(sb); fns.setChoice("health", "agree"); fns.setProfile("c1", "sex", "female"); fns.setProfile("c1", "unit", "kg"); await settle();
  assert.deepStrictEqual([sent, [...(maps.pendingProfile.get("c1") || [])], maps.heldAgree.has("c1")], [["unit"], ["sex"], true], "the detail waits for the parent's Agree, never sent to be refused and lost; Weights in goes; the question comes again (kept with the queue across a relaunch)");
  app.reset();
});

test("the second check round: a Don't Allow given offline then an Agree both go, in order; an answer set aside as stale, or a detail refused for a parent, keeps the details on the phone and asks again", async () => {
  { const sb = makeSupabase(), sent = []; sb.rpcs.client_set_choice = async (a) => { sent.push(a.p_answer + ":" + a.p_by); return "ok"; }; sb.rpcs.client_set_profile = async () => null;
    clientOn(sb, { ...JSON.parse(JSON.stringify(HEALTHY)), choices: { health: { state: "agreed", at: AT } } });
    fns.setChoice("health", "decline"); fns.setChoice("health", "agree"); await settle();
    assert.deepStrictEqual(sent, ["decline:client", "agree:client"], "the withdrawal first, then the Agree (the server deletes the old details, then stores anew)"); app.reset(); }
  { const sb = makeSupabase(), sent = []; sb.rpcs.client_set_choice = async () => "stale"; sb.rpcs.client_set_profile = async (a) => { sent.push(a.p_key); return null; };
    clientOn(sb, { choices: { health: { state: "declined", at: AT, by: "coach" } } }); fns.setChoice("health", "agree"); fns.setProfile("c1", "health.allergies", "Latex"); await settle();
    assert.deepStrictEqual([sent, [...(maps.pendingProfile.get("c1") || [])], maps.heldAgree.has("c1")], [[], ["health.allergies"], false], "set aside as older than the coach's withdrawal: never sent; the next sync decides (the newer withdrawal stands: they go)"); app.reset(); }
  { const sb = makeSupabase(); sb.rpcs.client_set_profile = async () => { const e = new Error("parent needed"); e.code = "P0001"; throw e; };
    clientOn(sb, { choices: { health: { state: "agreed", at: AT } } }); fns.setProfile("c1", "health.limits", "Knee"); await settle();
    assert.deepStrictEqual([[...(maps.pendingProfile.get("c1") || [])], maps.heldAgree.has("c1")], [["health.limits"], true], "refused while a parent is awaited (the coach's Under 18 had not reached the phone): kept, the parent asked"); app.reset(); }
  { const sb = makeSupabase(); sb.rpcs.client_set_choice = async () => { const e = new Error("too young"); e.code = "P0001"; throw e; };
    clientOn(sb); fns.setChoice("health", "agree"); await settle();
    assert.strictEqual(maps.heldAgree.has("c1"), false, "too young: never asked again and again"); app.reset(); }
});

test("the second check round: the under-18 year survives a coach's save with nothing read and a restore; under 13 by the year kept", async () => {
  const sb = makeSupabase(); coachOn(sb, { choices: { health: { state: "declined", at: AT } } });
  sb.seed("ft_clients", "c1", { id: "c1", name: "Jane", unit: "lb", minorUntil: 2028, choices: { health: { state: "declined", at: AT } } });   // the teen's Don't Allow on the server: the birthday gone, the year kept
  maps.clients.get("c1").phone = "3105550123"; fns.scheduleSave("clients", "c1", 0); await settle();   // a save before this session's first read
  assert.strictEqual(sb.tables.ft_clients.get("c1").data.minorUntil, 2028, "the server's year stays (only the coach's Under 18 switch on this device clears it)");
  app.reset();
  assert.deepStrictEqual([youngRec({ minorUntil: 2032 }, "2027-06-01"), youngRec({ minorUntil: 2032 }, "2028-01-01"), youngRec({ birthday: "2014-03-02" }, "2026-11-18"), youngRec({ minorUntil: 2028 }, "2026-11-18")], [true, false, true, false], "under 13 until the end of the year less five: a child whose details went can't agree again (the check round)");
  const C = "1b4e28ba-2fa1-41d2-883f-0016d3cca427"; app.set({ signedIn: true, clientMode: false, backend: fns.cloudBackend });
  const back = fns.planRestore({ app: "fiala-trainings", format: 1, clients: { [C]: { id: C, name: "Riley", unit: "lb", birthday: (new Date().getFullYear() - 16) + "-05-01", choices: { health: { state: "agreed", at: AT, parent: { name: "Pat Park", at: AT } } } } }, trainings: {} }).cs.find((x) => x.id === C);
  assert.deepStrictEqual([back.birthday, back.choices, back.minorUntil], [undefined, undefined, new Date().getFullYear() + 2], "a teen deleted, then restored: no details and no answers, the year kept (as the server's guard keeps it)");
  app.reset();
});

test("the third check round: two pages' answers fold together (a Don't Allow never dropped); details parked behind an Agree go when a withdrawal stands", async () => {
  const { adoptQueue } = await import("../app/sync.js");
  { const sb = makeSupabase(); clientOn(sb, { choices: { health: { state: "agreed", at: AT } } });
    maps.pendingChoices.set("c1", new Map([["health", { answer: "agree", parent: null, at: "2026-11-18T09:00:10.000Z", by: "client" }]])); maps.dirty.set("clients/c1", 1);   // this page: an Agree, and its own change waiting
    adoptQueue({ tab: "other-page", dirty: [], choices: [["c1", [["health", { answer: "decline", parent: null, at: "2026-11-18T09:00:00.000Z", by: "client" }]]]] });   // the other page: an earlier Don't Allow
    const a = maps.pendingChoices.get("c1").get("health");
    assert.deepStrictEqual([a.answer, a.before && a.before.answer], ["agree", "decline"], "the Agree goes after the other page's Don't Allow, never instead of it");
    adoptQueue({ tab: "third-page", dirty: [], choices: [["c1", [["health", { answer: "decline", parent: null, at: "2026-11-18T09:05:00.000Z", by: "client" }]]]] });
    assert.deepStrictEqual(maps.pendingChoices.get("c1").get("health").answer, "decline", "a newer Don't Allow from another page stands");
    app.reset(); }
  { const sb = makeSupabase(); sb.rpcs.client_my_data = async () => ({ clients: [{ id: "c1", data: { name: "Jane Doe", unit: "lb", email: "jane@x.com", choices: { health: { state: "declined", at: AT, by: "coach" } } } }], trainings: [] });
    clientOn(sb, { choices: { health: { state: "agreed", at: AT } } }); maps.pendingProfile.set("c1", new Set(["health.limits", "unit"]));   // parked behind an Agree the coach's newer withdrawal set aside
    await fns.syncDownNow(); await settle();
    assert.deepStrictEqual([...(maps.pendingProfile.get("c1") || [])].filter((k) => k !== "unit"), [], "a withdrawal stands: the details typed before it go too, as a Don't Allow's do (the check round)");
    app.reset(); }
});

test("the fourth check round: a refused Agree comes off the phone's copy at once (its details stay parked); the same answer from two pages is the copy already sent; a paused client is asked nothing", async () => {
  { const sb = makeSupabase(), sent = []; sb.rpcs.client_set_choice = async () => { const e = new Error("parent needed"); e.code = "P0001"; throw e; }; sb.rpcs.client_set_profile = async (a) => { sent.push(a.p_key); return null; };
    clientOn(sb, { choices: { health: { state: "declined", at: AT, by: "client" } } }); fns.setChoice("health", "agree"); await settle();
    assert.deepStrictEqual(maps.clients.get("c1").choices.health.state, "declined", "the answer it replaced is back on the phone at once: nothing typed now takes it for agreed (the check round)");
    assert.strictEqual(fns.setProfile("c1", "sex", "female"), false, "so a detail typed before the next sync is refused here, never sent to be lost"); app.reset(); }
  { const { adoptQueue } = await import("../app/sync.js"); const sb = makeSupabase(); clientOn(sb);
    const agree = { answer: "agree", parent: null, at: "2026-11-18T09:00:10.000Z", by: "client" };
    maps.pendingChoices.set("c1", new Map([["health", { ...agree }]]));   // this page sent the Don't Allow already: its Agree carries none
    adoptQueue({ tab: "other-page", dirty: [], choices: [["c1", [["health", { ...agree, before: { answer: "decline", parent: null, at: "2026-11-18T09:00:00.000Z", by: "client" } }]]]] });
    assert.strictEqual(maps.pendingChoices.get("c1").get("health").before, undefined, "the other page's stale copy never sends the Don't Allow again (the check round)"); app.reset(); }
  { const sb = makeSupabase(); clientOn(sb, { paused: true }); fns.askHealth(); await tick(5);
    assert.strictEqual(maps.pendingChoices.has("c1"), false, "paused: nothing asked, nothing queued"); app.reset(); }
});

test("the fifth check round: a paused client stores nothing new but can clear; the parent's wait survives a relaunch; a detail waiting on one page survives the other page's older copy", async () => {
  { const sb = makeSupabase(); clientOn(sb, { ...JSON.parse(JSON.stringify(HEALTHY)), paused: true, choices: { health: { state: "agreed", at: AT } } });
    assert.deepStrictEqual([fns.setProfile("c1", "sex", "male"), fns.setProfile("c1", "health.limits", null)], [false, true], "paused: nothing new (the server refuses it), but a detail can still be cleared (you can remove what you entered)"); app.reset(); }
  { const sb = makeSupabase(); clientOn(sb); maps.heldAgree.set("c1", { at: AT, why: "parent" }); maps.pendingProfile.set("c1", new Set(["health.limits"])); fns.persistPending(); maps.heldAgree.clear(); fns.restorePending();
    assert.deepStrictEqual(maps.heldAgree.get("c1"), { at: AT, why: "parent" }, "kept with the queue: after a relaunch the parent is still asked and the details still wait"); app.reset(); }
  { const { adoptQueue } = await import("../app/sync.js"); const sb = makeSupabase(); clientOn(sb, { choices: { health: { state: "agreed", at: AT } }, health: { limits: "Torn ACL, left knee" } });
    maps.pendingProfile.set("c1", new Set(["health.limits"]));   // waiting here
    adoptQueue({ tab: "other-page", dirty: ["clients/c1"], recs: [["clients/c1", { id: "c1", name: "Jane Doe", unit: "lb", email: "jane@x.com", choices: { health: { state: "agreed", at: AT } } }]], choices: [] });   // the other page's older copy, without it
    assert.strictEqual((maps.clients.get("c1").health || {}).limits, "Torn ACL, left knee", "this page's waiting detail rides on the copy taken (the check round: it was sent empty)"); app.reset(); }
});

test("the sixth check round: every answer has its own id (a copy never counted twice; a withdrawal taken back skips the paper form's specials); two pages settle; the parent's wait ends with a newer answer; paused and refusal words", async () => {
  const c6 = sql("client-consent.sql");
  assert.ok(c6.includes("select e into v_seen from jsonb_array_elements(coalesce(v_data #> '{choices,log}', '[]'::jsonb)) e where e ->> 'id' = p_id limit 1;") && c6.includes("if v_seen is not null then return case when coalesce(v_seen ->> 'stale', '') = 'true' then 'stale' else 'same' end; end if;") && c6.indexOf("into v_seen") < c6.indexOf("then raise exception 'too young'; end if;") && c6.indexOf("into v_seen") < c6.indexOf("then raise exception 'paused'; end if;   -- a paused client gives nothing new") && c6.includes("p_answer = 'decline' and not coalesce(p_taken_back, false) and v_cur ->> 'state' = 'off'") && c6.includes("p_answer = 'decline' and not coalesce(p_taken_back, false) and v_cur ->> 'state' = 'paper'") && c6.includes("then jsonb_build_object('id', p_id)"), "the server: an id it has had is answered as it was ('same', or 'stale' for one set aside) before anything else; a taken-back Don't Allow skips the form's specials; the id kept in the log");
  { const sb = makeSupabase(), sent = []; sb.rpcs.client_set_choice = async (a) => { sent.push(a); return "ok"; };
    clientOn(sb, { ...JSON.parse(JSON.stringify(HEALTHY)), choices: { health: { state: "agreed", at: AT } } });
    fns.setChoice("health", "decline"); const no = maps.pendingChoices.get("c1").get("health"); fns.setChoice("health", "agree"); const yes = maps.pendingChoices.get("c1").get("health");
    assert.ok(typeof no.id === "string" && no.id.length > 0 && no.id.length <= 64 && yes.id !== no.id && yes.before.id === no.id, "each answer its own id; the Don't Allow carried before the Agree keeps its own");
    await settle();
    assert.deepStrictEqual(sent.map((a) => [a.p_answer, a.p_id, a.p_taken_back]), [["decline", no.id, true], ["agree", yes.id, false]], "both sent with their ids; the Don't Allow marked as taken back");
    assert.ok(maps.settledAnswers.has(no.id) && maps.settledAnswers.has(yes.id), "replied to: settled for every page"); app.reset(); }
  { const { adoptQueue } = await import("../app/sync.js"); const sb = makeSupabase(), sent = []; sb.rpcs.client_set_choice = async (a) => { sent.push(a.p_id); return "ok"; };
    clientOn(sb); maps.settledAnswers.set("ans-1", "ok");
    adoptQueue({ tab: "other-page", dirty: ["clients/c1"], recs: [["clients/c1", JSON.parse(JSON.stringify(maps.clients.get("c1")))]], choices: [["c1", [["zone", { id: "ans-1", answer: "allow", parent: null, at: AT, by: "client" }]]]] });
    assert.deepStrictEqual([maps.pendingChoices.has("c1"), maps.dirty.has("clients/c1")], [false, false], "an answer the server replied to is never taken again, and a copy the same as this page's is not taken (the check round: two pages took each other's copy without end, and the coach's changes never showed)");
    adoptQueue({ tab: "other-page", dirty: [], choices: [], settled: ["ans-2"] }); assert.ok(maps.settledAnswers.has("ans-2"), "the other page's settled ids are taken on");
    maps.pendingChoices.set("c1", new Map([["zone", { id: "ans-2", answer: "allow", parent: null, at: AT, by: "client" }]])); fns.scheduleSave("clients", "c1"); await settle();
    assert.deepStrictEqual([sent, maps.pendingChoices.has("c1")], [[], false], "a copy this page still held of a settled answer is dropped unsent"); app.reset(); }
  { const { adoptQueue } = await import("../app/sync.js"); const sb = makeSupabase(); clientOn(sb, { choices: { health: { state: "declined", at: "2026-11-18T09:10:00.000Z", by: "parent" } } });
    adoptQueue({ tab: "other-page", dirty: [], choices: [], held: [["c1", { at: "2026-11-18T09:00:00.000Z", why: "parent" }]] });
    assert.strictEqual(maps.heldAgree.has("c1"), false, "a parent's wait older than the answer on record (the parent's Disagree) is not taken back from another page's queue");
    maps.clients.get("c1").choices = {}; adoptQueue({ tab: "other-page", dirty: [], choices: [], held: [["c1", { at: "2026-11-18T09:00:00.000Z", why: "parent" }]] });
    assert.strictEqual(maps.heldAgree.has("c1"), true, "one still standing is"); app.reset(); }
  { const sb = makeSupabase(); sb.rpcs.client_my_data = async () => ({ clients: [{ id: "c1", data: { name: "Jane Doe", unit: "lb", email: "jane@x.com", minor: true, choices: { health: { state: "declined", at: "2026-11-18T09:10:00.000Z", by: "parent" } } } }], trainings: [] });
    clientOn(sb, { minor: true }); maps.heldAgree.set("c1", { at: "2026-11-18T09:00:00.000Z", why: "parent" }); maps.pendingProfile.set("c1", new Set(["health.limits"])); maps.clients.get("c1").health = { limits: "Knee" };
    await fns.syncDownNow(); await settle();
    assert.deepStrictEqual([maps.heldAgree.has("c1"), [...(maps.pendingProfile.get("c1") || [])]], [false, []], "a newer withdrawal on record (a parent's Disagree on another phone) ends the wait, and the details parked behind it go"); app.reset(); }
  { const sb = makeSupabase(); const line = (extra) => { clientOn(sb, extra); return fns.healthLockLine(maps.clients.get("c1")); };
    assert.strictEqual(line({ paused: true, sex: "female", choices: { health: { state: "agreed", at: AT } } }), "Your coach has paused your access, so these can’t change now. To delete them, turn off Store health details in Settings.", "paused: why every tap says Access is paused, and the one way that works");
    assert.strictEqual(line({ paused: true, minor: true, sex: "female", choices: { health: { state: "agreed", at: AT } } }), "Your coach has paused your access, so these can’t change now. To delete them, turn off Store health details in Settings.", "a paused teen waiting for a parent: no 'tap a detail to ask them'");
    assert.strictEqual(line({ paused: true, choices: { health: { state: "declined", at: AT, by: "parent" } } }), "A parent or guardian chose not to store your health details.", "paused: no Turn it on, which is refused");
    assert.strictEqual(line({ paused: true }), "Your coach has paused your access, so nothing new is stored.");
    const coach = (extra) => { coachOn(sb, extra); const c = maps.clients.get("c1"); return [fns.cardHealthNote(c), fns.healthLockLine(c)]; };
    assert.deepStrictEqual(coach({ paused: true, choices: { health: { state: "legacy", at: AT } } })[1], "Jane hasn’t answered yet: asked once their access is active again. You can edit these once Jane agrees.");
    assert.deepStrictEqual(coach({ paused: true, minor: true, choices: { health: { state: "agreed", at: AT } } }), ["Waiting for a parent or guardian to agree in Jane’s app. Access is paused, so the app doesn’t ask.", "Waiting for a parent or guardian to agree in Jane’s app. Access is paused, so the app doesn’t ask. You can edit these once they agree."]);
    assert.deepStrictEqual(coach({ paused: true })[1], "Waiting for Jane to agree in the app. Access is paused, so the app doesn’t ask.");
    coachOn(sb, { choices: { health: { state: "declined", at: AT, by: "parent" } } }); assert.strictEqual(fns.declinedWords(maps.clients.get("c1"), "Jane"), "A parent or guardian chose not to store Jane’s health details in the app. Jane can turn Store health details on in the app, and a parent or guardian agrees there too.", "the paper form refused over a parent's Disagree names the parent (the check round)");
    coachOn(sb, { choices: { health: { state: "legacy", at: AT } } }); assert.strictEqual(fns.declinedWords(maps.clients.get("c1"), "Jane"), "Jane, or a parent or guardian, chose not to store health details in the app. Ask Jane to turn Store health details on in the app.", "not known here who: both named");
    coachOn(sb, { paused: true, choices: { health: { state: "declined", at: AT, by: "client" } } }); assert.strictEqual(fns.declinedWords(maps.clients.get("c1"), "Jane"), "Jane chose not to store health details in the app.", "paused: no advice the app can't follow");
    app.reset(); }
});

test("the seventh check round: details a Don't Allow deleted never come back from another page or an earlier launch; a value already here is not taken again; an answer folded in mid-send stays; the coach's equal copy read later is a put-back; a paused client's city is the coach's", async () => {
  const { adoptQueue } = await import("../app/sync.js");
  const AGREED = { choices: { health: { state: "agreed", at: AT, by: "client" } } };
  { const sb = makeSupabase(); clientOn(sb, { ...AGREED, health: { limits: "Torn ACL" } });
    fns.setChoice("health", "decline");
    adoptQueue({ tab: "earlier-launch", dirty: ["clients/c1"], recs: [["clients/c1", { id: "c1", name: "Jane Doe", unit: "lb", email: "jane@x.com", ...AGREED, health: { limits: "Torn ACL" } }]], profile: [["c1", ["health.limits"]]], choices: [] });
    assert.deepStrictEqual([[...(maps.pendingProfile.get("c1") || [])], (maps.clients.get("c1").health || {}).limits], [[], undefined], "a detail typed before the Don't Allow is not taken back from the queue an earlier launch or another page wrote (the check round: it was stored again after a later Agree)"); app.reset(); }
  { const sb = makeSupabase(); clientOn(sb, { ...AGREED, health: { limits: "Torn ACL" } }); maps.pendingProfile.set("c1", new Set(["health.limits"]));
    const no = { id: "w1", answer: "decline", parent: null, at: "2026-11-18T09:00:00.000Z", by: "client" };
    adoptQueue({ tab: "other-page", dirty: [], choices: [["c1", [["health", { id: "a1", answer: "agree", parent: null, at: "2026-11-18T09:00:05.000Z", by: "client", before: no }]]]] });
    const c = maps.clients.get("c1");
    assert.deepStrictEqual([healthState(c), (c.health || {}).limits, [...(maps.pendingProfile.get("c1") || [])]], ["agreed", undefined, []], "an Agree carrying a newer Don't Allow: the withdrawal's effect here too, the details here and waiting go, then the Agree"); app.reset(); }
  { const sb = makeSupabase(); clientOn(sb, { ...AGREED, health: { limits: "Knee" } });
    adoptQueue({ tab: "other-page", dirty: ["clients/c1"], recs: [["clients/c1", { id: "c1", name: "Jane Doe", unit: "lb", email: "jane@x.com", ...AGREED, health: { limits: "Knee" } }]], profile: [["c1", ["health.limits"]]], choices: [] });
    assert.deepStrictEqual([maps.pendingProfile.has("c1"), maps.dirty.has("clients/c1")], [false, false], "a value already here is nothing new to send: not taken, nothing marked (the check round: two pages handed one detail back and forth)");
    adoptQueue({ tab: "other-page", dirty: ["clients/c1"], recs: [["clients/c1", { id: "c1", name: "Jane Doe", unit: "lb", email: "jane@x.com", ...AGREED, health: { limits: "Knee, left" } }]], profile: [["c1", ["health.limits"]]], choices: [] });
    assert.deepStrictEqual([[...(maps.pendingProfile.get("c1") || [])], maps.clients.get("c1").health.limits], [["health.limits"], "Knee, left"], "a new value is taken, to be sent from here too"); app.reset(); }
  { const sb = makeSupabase(), got = []; let release; sb.rpcs.client_set_choice = async (a) => { got.push(a.p_kind + ":" + a.p_answer); if (a.p_kind === "zone") await new Promise((r) => { release = r; }); return "ok"; };
    clientOn(sb); fns.setChoice("zone", "allow"); fns.scheduleSave("clients", "c1"); await tick(700);
    adoptQueue({ tab: "other-page", dirty: [], choices: [["c1", [["health", { id: "h1", answer: "agree", parent: null, at: new Date().toISOString(), by: "client" }]]]] });
    release(); await settle(); await tick(500); await settle();
    assert.deepStrictEqual(got, ["zone:allow", "health:agree"], "an answer folded in from another page while this page's send was out stays queued and goes (the check round: it was dropped with the old queue)"); app.reset(); }
  { const sb = makeSupabase(); coachOn(sb, { phone: "3105550100" });
    adoptQueue({ tab: "other-page", owner: "coach@x.com", dirty: ["clients/c1"], recs: [["clients/c1", { id: "c1", name: "Jane Doe", unit: "lb", phone: "3105550100" }]], stamps: [["clients/c1", "2026-11-18T10:00:00.000Z"]], choices: [] });
    assert.strictEqual(maps.dirty.has("clients/c1"), true, "the coach's other tab read the record later: an equal copy may be a put-back still to send, so it is taken (the check round)"); app.reset(); }
  { const sb = makeSupabase(); clientOn(sb, { paused: true, choices: { zone: { state: "allow", at: AT, by: "client" } }, zone: { zone: "America/New_York", at: AT } }); fns.paintChoices();
    assert.strictEqual(document.getElementById("meZoneVal").textContent, "New York", "paused: the city the coach still sees, the last one sent (the check round)"); app.reset(); }
});

test("the eighth check round: a detail typed under an agreement withdrawn elsewhere never goes; a correction from the page that typed it replaces the copy; the answers survive a v315 page's queue write; answers fold before details; the time zone goes only from a page on screen", async () => {
  const { adoptQueue } = await import("../app/sync.js");
  const AGREED = { choices: { health: { state: "agreed", at: AT, by: "client" } } };
  { const sb = makeSupabase(), sent = []; sb.rpcs.client_set_profile = async (a) => { sent.push(a.p_key); return null; };
    const later = "2026-11-18T09:30:00.000Z", again = "2026-11-18T10:00:00.000Z";
    sb.rpcs.client_my_data = async () => ({ clients: [{ id: "c1", data: { name: "Jane Doe", unit: "lb", email: "jane@x.com", choices: { health: { state: "agreed", at: again, by: "client" }, log: [{ kind: "health", answer: "agree", at: AT, by: "client" }, { kind: "health", answer: "decline", at: later, by: "coach" }, { kind: "health", answer: "agree", at: again, by: "client" }] } } }], trainings: [] });
    clientOn(sb, AGREED); app.set({ offline: true }); fns.setProfile("c1", "health.limits", "Asthma");   // typed with no signal, under the Agree of AT
    assert.strictEqual(maps.profileUnder.get("c1").get("health.limits").split("|")[0], AT, "each waiting detail keeps the agreement it was typed under (and, last, when it was typed by this phone's clock)");
    await fns.syncDownNow(); await settle();
    assert.deepStrictEqual([sent, maps.pendingProfile.has("c1"), (maps.clients.get("c1").health || {}).limits], [[], false, undefined], "the coach's Delete (by email) came since, then a new Agree: the detail typed before goes, never stored under the new Agree (the check round)"); app.reset(); }
  { const sb = makeSupabase(); clientOn(sb, { ...AGREED, health: {} });
    const copy = (v) => ({ tab: "page-A", dirty: ["clients/c1"], recs: [["clients/c1", { id: "c1", name: "Jane Doe", unit: "lb", email: "jane@x.com", ...AGREED, health: { limits: v } }]], profile: [["c1", ["health.limits"]]], choices: [] });
    adoptQueue(copy("Left knee: no running")); adoptQueue(copy("Left knee: no running, no jumping"));
    assert.strictEqual(maps.clients.get("c1").health.limits, "Left knee: no running, no jumping", "a correction from the page that typed the detail replaces the copy taken from it (the check round)");
    fns.setProfile("c1", "health.limits", "Typed here"); adoptQueue(copy("Left knee: no deep squats"));
    assert.strictEqual(maps.clients.get("c1").health.limits, "Typed here", "one typed on this page stands against the other page's (the two-pages known limit)"); app.reset(); }
  { const sb = makeSupabase(); clientOn(sb, AGREED); app.set({ offline: true }); fns.setChoice("health", "decline"); fns.persistPending();
    const side = JSON.parse(localStorage.getItem("fiala.pending.answers.v1"));
    assert.strictEqual(side.choices[0][1][0][1].answer, "decline", "the answers are also kept under a key no v315 page writes");
    localStorage.setItem("fiala.pending.v1", JSON.stringify({ dirty: [], tab: "a-v315-page", owner: "jane@x.com" }));   // a v315 page still open rewrote the queue without them
    maps.pendingChoices.clear(); fns.restorePending();
    assert.strictEqual(((maps.pendingChoices.get("c1") || new Map()).get("health") || {}).answer, "decline", "the next launch still has the Don't Allow (the check round: it was lost with the v315 page's write)"); app.reset(); }
  { const sb = makeSupabase(); clientOn(sb, { ...AGREED, health: { limits: "Old" } }); maps.pendingProfile.set("c1", new Set(["health.limits"]));
    const no = { id: "w2", answer: "decline", parent: null, at: "2026-11-18T09:00:00.000Z", by: "client" }, yes = { id: "a2", answer: "agree", parent: null, at: "2026-11-18T09:00:05.000Z", by: "client", before: no };
    adoptQueue({ tab: "page-A", dirty: ["clients/c1"], recs: [["clients/c1", { id: "c1", name: "Jane Doe", unit: "lb", email: "jane@x.com", choices: { health: { state: "agreed", at: yes.at, by: "client" } }, health: { allergies: "Penicillin" } }]], profile: [["c1", ["health.allergies"]]], choices: [["c1", [["health", yes]]]] });
    const c = maps.clients.get("c1");
    assert.deepStrictEqual([c.health.limits, c.health.allergies, [...maps.pendingProfile.get("c1")]], [undefined, "Penicillin", ["health.allergies"]], "the other page's Don't Allow takes effect first, then the detail it typed after its Agree is taken (the check round: it was deleted in the same pass)"); app.reset(); }
  { const sb = makeSupabase(), zones = []; let kept; sb.rpcs.client_set_zone = async (a) => { zones.push(a.p_zone); kept = { zone: a.p_zone, at: new Date().toISOString() }; return null; };   // the server keeps what it was sent (a later sync, the minute's own, sends nothing more: the check round's run under load counted two)
    sb.rpcs.client_my_data = async () => ({ clients: [{ id: "c1", data: { name: "Jane Doe", unit: "lb", email: "jane@x.com", choices: { zone: { state: "allow", at: AT, by: "client" } }, ...(kept ? { zone: kept } : {}) } }], trainings: [] });
    clientOn(sb, { choices: { zone: { state: "allow", at: AT, by: "client" } } }); const was = document.visibilityState; document.visibilityState = "hidden";
    try { await fns.syncDownNow(); await settle(); } finally { document.visibilityState = was; }
    assert.deepStrictEqual(zones, [], "a hidden page (the network back, a refusal's sync) sends no time zone: only one on screen does (the check round)");
    await fns.syncDownNow(); await settle(); assert.strictEqual(zones.length, 1, "on screen, it goes");
    await fns.syncDownNow(); await settle(); assert.strictEqual(zones.length, 1, "the next sync (the minute's own) sends it no more: the server has it"); app.reset(); }
  { const c = sql("client-consent.sql"), paper = c.slice(c.indexOf("create or replace function coach_set_paper"), c.indexOf("create or replace function coach_withdraw")), on = paper.indexOf("  if p_on then\n"), off = paper.indexOf("\n  else\n", on), refuse = paper.indexOf("raise exception 'not on paper'", off); assert.ok(on > -1 && off > on && refuse > off && paper.slice(off, refuse).includes("if v_state = 'agreed' then raise exception 'agreed in the app'; end if;"), "the form turned off over the client's own Agree says so (Delete health details does it): in the off branch itself, before 'not on paper'"); }
  { const sb = makeSupabase(); coachOn(sb, { minor: true }); const c = maps.clients.get("c1");
    assert.deepStrictEqual([fns.cardHealthNote(c), fns.healthLockLine(c)], ["Waiting for Jane and a parent or guardian to agree in the app.", "Waiting for Jane and a parent or guardian to agree in the app."], "a teen's lines name the parent too (the check round)"); app.reset(); }
});

test("the ninth check round: a withdrawal given on another page reaches a frozen one by its time; a phone clock set wrong never decides; a detail held for no signal stays unsent; a correction replaces a restored copy; the answers key goes with its queue; a zone with no city reads as an offset", async () => {
  const { adoptQueue } = await import("../app/sync.js");
  const { zoneName } = await import("../app/model.js");
  const AGREED = { choices: { health: { state: "agreed", at: AT, by: "client" } } };
  { const sb = makeSupabase(); clientOn(sb, AGREED); fns.setProfile("c1", "health.medications", "Metformin 500 mg");   // typed on this (frozen) page before the other page's Don't Allow
    adoptQueue({ tab: "page-A", dirty: [], choices: [], settled: [["no-1", "ok"], ["yes-1", "ok"]], wd: [["c1", new Date(Date.now() + 60000).toISOString()]] });   // given after the typing, by this phone's clock
    assert.deepStrictEqual([...(maps.pendingProfile.get("c1") || [])], [], "the other page's Don't Allow, heard of only by its settled id and its time: the detail typed before it goes (the check round: it was stored after the later Agree)"); app.reset(); }
  { const sb = makeSupabase(), sent = []; sb.rpcs.client_set_profile = async (a) => { sent.push(a.p_key); return null; }; sb.rpcs.client_set_choice = async () => "ok";
    clientOn(sb, { choices: { health: { state: "declined", at: AT, by: "coach" } } }); app.set({ offline: true });
    fns.setChoice("health", "agree"); const id = maps.pendingChoices.get("c1").get("health").id; fns.setProfile("c1", "health.allergies", "Penicillin");
    assert.strictEqual(String(maps.profileUnder.get("c1").get("health.allergies")).split("|")[1], id, "a detail typed under this phone's own answer keeps that answer's id");
    const serverAt = "2026-11-18T09:10:00.000Z";   // the phone's clock may say anything: the server counted the Agree back from p_age
    sb.rpcs.client_my_data = async () => ({ clients: [{ id: "c1", data: { name: "Jane Doe", unit: "lb", email: "jane@x.com", choices: { health: { state: "agreed", at: serverAt, by: "client" }, log: [{ kind: "health", answer: "decline", at: "2026-11-18T09:05:00.000Z", by: "coach" }, { kind: "health", answer: "agree", at: serverAt, by: "client", id }] } } }], trainings: [] });
    app.set({ offline: false }); await fns.syncDownNow(); await settle(); await fns.syncDownNow(); await settle();
    assert.ok(sent.includes("health.allergies"), "typed after the client's own Agree, which the log dates after the coach's Delete: kept and sent, whatever the phone's clock says (the check round)"); app.reset(); }
  { const sb = makeSupabase(); sb.rpcs.client_set_profile = async () => null; clientOn(sb, AGREED); app.set({ offline: true }); fns.setProfile("c1", "health.limits", "Knee"); await settle();
    assert.deepStrictEqual([maps.dirty.has("clients/c1"), [...(maps.pendingProfile.get("c1") || [])]], [true, ["health.limits"]], "held for no signal: the record stays marked unsent, so another page takes it and a sign-out is refused (the check round)"); app.reset(); }
  { const sb = makeSupabase(); clientOn(sb, { ...AGREED, health: { limits: "Left knee: no running" } }); maps.pendingProfile.set("c1", new Set(["health.limits"]));   // restored after a reload: not typed on this page
    adoptQueue({ tab: "page-A2", dirty: ["clients/c1"], recs: [["clients/c1", { id: "c1", name: "Jane Doe", unit: "lb", email: "jane@x.com", ...AGREED, health: { limits: "Left knee: no running, no jumping" } }]], profile: [["c1", ["health.limits"]]], choices: [] });
    assert.strictEqual(maps.clients.get("c1").health.limits, "Left knee: no running, no jumping", "a copy not typed here (restored after a reload) takes the correction (the check round)"); app.reset(); }
  { app.reset(); localStorage.setItem("fiala.pending.answers.v1", JSON.stringify({ owner: "jane@x.com", choices: [["c1", [["health", { id: "x", answer: "agree", parent: "Sam Rivera", at: AT, by: "client" }]]]] })); fns.restorePending();
    assert.strictEqual(localStorage.getItem("fiala.pending.answers.v1"), null, "with no queue (a v315 page signed out), the answers key goes too: no email or parent's name left behind (the check round)"); app.reset(); }
  assert.deepStrictEqual([zoneName("Etc/GMT+8", Date.parse(AT)), zoneName("Asia/Tokyo", Date.parse(AT))], ["GMT-8", "Tokyo"], "a zone with no city by its offset, as the line under the name writes it, never IANA's inverted sign");
});

test("the tenth check round: waiting details are timed by this phone's clock against this phone's withdrawals; a delivered detail's old copy goes; a parked detail travels to another page", async () => {
  const { adoptQueue } = await import("../app/sync.js");
  const AGREED = { choices: { health: { state: "agreed", at: AT, by: "client" } } };
  { const sb = makeSupabase(); clientOn(sb, { choices: { health: { state: "agreed", at: new Date(Date.now() - 3600e3).toISOString(), by: "client" } } });   // the copy holds the server's time of the Agree: an hour before this phone's clock (a phone set an hour ahead)
    maps.withdrawnAt.set("c1", new Date(Date.now() - 600e3).toISOString());   // this phone's Don't Allow, ten minutes ago by its own clock (then an Agree)
    app.set({ offline: true }); fns.setProfile("c1", "health.medications", "Metformin 500 mg"); fns.persistPending();
    maps.pendingProfile.clear(); fns.restorePending();
    assert.deepStrictEqual([...(maps.pendingProfile.get("c1") || [])], ["health.medications"], "typed after this phone's Don't Allow, by this phone's clock: kept at a relaunch, whatever the server's times say (the check round: it was dropped)"); app.reset(); }
  { const sb = makeSupabase(); clientOn(sb, { ...AGREED, health: { limits: "Left knee: no running" } }); maps.pendingProfile.set("c1", new Set(["health.limits"]));
    const typed = "2026-11-18T09:00:00.000Z"; maps.profileUnder.set("c1", new Map([["health.limits", AT + "||" + typed]]));   // carried from another page, not typed here
    adoptQueue({ tab: "page-B2", dirty: [], choices: [], deliv: [["c1\nhealth.limits", typed]] });
    assert.deepStrictEqual([...(maps.pendingProfile.get("c1") || [])], [], "another page delivered this very value: the carried copy goes, never resent over a later correction (the check round)"); app.reset(); }
  { const sb = makeSupabase(); clientOn(sb, { ...AGREED, health: {} });
    adoptQueue({ tab: "page-A", dirty: [], recs: [["clients/c1", { id: "c1", name: "Jane Doe", unit: "lb", email: "jane@x.com", ...AGREED, health: { allergies: "Penicillin" } }]], profile: [["c1", ["health.allergies"]]], choices: [] });
    assert.deepStrictEqual([(maps.clients.get("c1").health || {}).allergies, [...(maps.pendingProfile.get("c1") || [])]], ["Penicillin", ["health.allergies"]], "a detail parked on the other page (not marked unsent there) is taken on too (the check round: it was lost with that page)"); app.reset(); }
});

test("the eleventh check round: a sync that answers after a sign-out writes nothing back; a detail taken off the phone mid-pass is never sent; a typing time never goes back on this phone", async () => {
  { const sb = makeSupabase(); let answer; sb.rpcs.client_my_data = () => new Promise((r) => { answer = r; });
    clientOn(sb, { choices: { health: { state: "agreed", at: AT, by: "client" } } }); const p = fns.syncDownNow(); await tick(30);
    app.set({ signedIn: false }); maps.clients.clear(); localStorage.clear();   // the sign-out's wipe while the sync's request is out
    answer({ clients: [{ id: "c1", data: { name: "Jane Doe", unit: "lb", email: "jane@x.com", health: { medications: "Sertraline 50 mg" } } }], trainings: [] }); await p; await tick(20);
    assert.deepStrictEqual([maps.clients.size, localStorage.getItem("fiala.pending.v1"), localStorage.getItem("fiala.pending.answers.v1")], [0, null, null], "nothing it read comes back onto the device after the wipe (the check round: the whole copy, health details included, came back)"); app.reset(); }
  { const sb = makeSupabase(), sent = []; let release; sb.rpcs.client_set_profile = async (a) => { sent.push(a.p_key); if (sent.length === 1) await new Promise((r) => { release = r; }); return null; };
    clientOn(sb, { choices: { health: { state: "agreed", at: AT, by: "client" } } }); fns.setProfile("c1", "health.limits", "Knee"); fns.setProfile("c1", "health.allergies", "Latex"); await tick(700);
    maps.pendingProfile.get("c1").delete("health.allergies");   // taken off the phone meanwhile (a withdrawal made elsewhere, heard by the log check)
    release(); await settle();
    assert.deepStrictEqual(sent, ["health.limits"], "the pass skips a detail taken off the phone while it was out (the check round: it was sent under a new consent)"); app.reset(); }
  { const sb = makeSupabase(); clientOn(sb, { choices: { health: { state: "agreed", at: AT, by: "client" } } });
    const ahead = new Date(Date.now() + 86400e3).toISOString(); maps.withdrawnAt.set("c1", ahead);   // a Don't Allow given while the clock was set a day ahead, then put right
    fns.setProfile("c1", "health.medications", "Metformin 1000 mg");
    const typed = Date.parse(String(maps.profileUnder.get("c1").get("health.medications")).split("|")[2]);
    assert.ok(typed > Date.parse(ahead), "typed after it on this phone, so timed after it (the check round: a later detail was dropped at a relaunch)"); app.reset(); }
});

test("the twelfth check round: a page whose device still stores work is never wiped; no sheet outlives the session; the paper switch names no cause it could not read", () => {
  { const sb = makeSupabase(); clientOn(sb, { choices: { health: { state: "agreed", at: AT, by: "client" } } }); localStorage.clear();
    assert.strictEqual(fns.idleDevice(), true, "nothing waiting on any page: a session ended elsewhere wipes the device, as Sign out does");
    localStorage.setItem("fiala.pending.v1", JSON.stringify({ owner: "jane@x.com", dirty: ["trainings/mon"], choices: [], profile: [] }));
    assert.strictEqual(fns.idleDevice(), false, "another page of this device stored a workout it still has to send (a frozen tab missed that write): no wipe (the check round: the wipe removed the other page's queue)");
    localStorage.setItem("fiala.pending.v1", JSON.stringify({ owner: "jane@x.com", dirty: [], choices: [], profile: [["c1", [["health.limits", "Knee"]]]] }));
    assert.strictEqual(fns.idleDevice(), false, "a health detail stored by another page");
    localStorage.setItem("fiala.pending.v1", JSON.stringify({ owner: "jane@x.com", dirty: [], choices: [], profile: [] }));
    assert.strictEqual(fns.idleDevice(), true, "a stored queue with nothing in it is no work");
    localStorage.setItem("fiala.pending.answers.v1", JSON.stringify({ choices: [["c1", [["health", { id: "a1", answer: "agree" }]]]] }));
    assert.strictEqual(fns.idleDevice(), false, "an answer stored by another page");
    localStorage.clear(); app.reset(); }
  const src = fs.readFileSync(new URL("../app/main.js", import.meta.url), "utf8");
  const login = src.slice(src.indexOf("function showLogin(msg) {"), src.indexOf("function showLogin(msg) {") + 300);
  assert.ok(login.includes("if (es) closeFinishEarly();"), "the sign-in page takes Finish this exercise? / Skip this exercise? down (the check round: left over the sign-in after a session ended elsewhere, its button queued the workout as deleted)");
  const go = src.slice(src.indexOf("function finishEarlyNow() {"), src.indexOf("function finishEarlyNow() {") + 400);
  assert.ok(/closeFinishEarly\(\);\s*\n\s*if \(trainings\.get\(t\.id\) !== t\) \{ S\.renderedTraining = null; render\(\); return; \}/.test(go), "its answer reads the workout again: gone (a wipe, a deletion elsewhere) or replaced meanwhile, nothing is written, and the page is drawn again from the copy there now (the thirteenth round: the cards kept the old copy)");
  const rr = src.slice(src.indexOf("const ruleRefused = (c, res, what, sender) => {"), src.indexOf("const ruleBusy = new Set();"));
  assert.ok(src.includes('late && !srv && !known ? { error: { ...res.error, message: on ? "agreed in the app, unknown" : "not on paper, unknown" } } : res'), "the paper switch refused as late, with neither the sync nor the row read: the words name no cause");
  assert.ok(rr.includes('/agreed in the app, unknown/.test(m) ? who + " agreed in the app meanwhile, so nothing changed."') && rr.indexOf("/agreed in the app, unknown/") < rr.indexOf("/agreed in the app/.test(m)") && rr.indexOf("/not on paper, unknown/") < rr.indexOf("/not on paper/.test(m)"), "read before the words that name a cause (the check round: \"a parent still has to agree\" after a parent had, or \"no paper form is needed\" for a teen still waiting for one)");
  assert.ok(rr.includes('If nothing has changed on " + who + "'), "no signal: the alert names whose card (the check round: read as being about the client on screen by then)");
  assert.ok(src.includes("if (late) { ruleBusy.add(id); try {") && src.includes("} finally { ruleBusy.delete(id); } }"), "the switch takes no second tap until the late reads end (the check round: a second rule and a second alert)");
  assert.ok(src.includes("const signOutOnce = (fn) => signOutRun || (signOutRun = Promise.resolve().then(fn).finally(() => { signOutRun = null; }));") && src.includes('$("signout").addEventListener("click", () => signOutOnce(S.clientMode ? signOutClient : signOutTrainer));') && src.includes('$("signout3").addEventListener("click", () => signOutOnce(signOutClient));'), "one sign-out at a time (the check round: a second tap on a weak signal ended in a second alert)");
  assert.strictEqual((src.match(/\(navigator\.onLine \? " Try again later\." : " Try again when you/g) || []).length, 2, "both sign-outs say when you're online only when the device is offline (the check round: a server that kept refusing read as no signal)");
  assert.ok(src.includes('t restore", texts: [text], yes: "OK", one: true })') && src.includes('"Restore needs a connection. Try again when you'), "a restore's refusal is an alert that stays (the check round: the bar's words were cut short and replaced by Offline)");
});
test("the thirteenth check round: the sign-in page closes every sheet and menu; the workout page writes nothing once its workout is gone; a held-back alert never opens after the session; Sign out takes on what another page stored", () => {
  { const sb = makeSupabase(); coachOn(sb); maps.trainings.set("w1", { id: "w1", clientId: "c1", title: "Legs", date: fns.today(), createdAt: AT, completedAt: null, skippedAt: null, rows: [] });
    fns.openSkip("w1"); fns.openDatePicker({ clientId: "c1", title: "Move to", onPick: () => {} });
    assert.ok(fns.skipSheet() && fns.datePicker(), "both up");
    fns.showLogin("");
    assert.deepStrictEqual([fns.skipSheet(), fns.datePicker()], [null, null], "the sign-in page closes the Skip sheet and the day picker (the check round: left over it, they still wrote once the device had kept its copy)");
    app.reset(); }
  const src = fs.readFileSync(new URL("../app/main.js", import.meta.url), "utf8");
  const login = src.slice(src.indexOf("function showLogin(msg) {"), src.indexOf("function showLogin(msg) {") + 700);
  assert.ok(login.includes("() => popClose && popClose(), () => pv && closePreview(), () => sk && closeSkip(), () => dp && closeDatePicker()") && login.includes('document.querySelector(".crop-view .crop-cancel")') && login.includes("try { close(); } catch (_) {}"), "and every menu or bubble, the preview and photo framing, each on its own so one that fails never keeps the sign-in page from showing (the check round: a menu's Delete exercise left over it deleted the whole workout at the next sign-in)");
  assert.ok(src.includes('const save = () => { if (trainings.has(t.id)) scheduleSave("trainings", t.id); };') && (src.match(/const mark = \(\) => \{ if \(!trainings\.has\(t\.id\)\) return;/g) || []).length === 2 && src.includes("const cardRowsNow = () => { const T = trainings.get(t.id); if (!T) return null;"), "the workout page writes nothing once its workout has left the map: a save for a record not there sends nothing (only deleteRec sends a deletion)");
  assert.ok(src.includes("const esCancel = () => { const was = es; closeFinishEarly(); if (was && trainings.get(was.t.id) !== was.t) { S.renderedTraining = null; render(); } };") && (src.match(/esCancel\(\)/g) || []).length === 3, "Cancel, the dim and Escape draw the page again when its workout changed under the question (the check round: the cards kept the old copy)");
  assert.strictEqual((src.match(/setTimeout\(say, 400\) : gone\(\) \? null : askChoice\(\{ title: "Couldn/g) || []).length, 3, "a coach rule's alert held back for a sheet never opens once the session has ended");
  assert.ok((src.match(/shownAgain\(\); \$\("status"\)\.textContent = "Signing out/g) || []).length === 2 && /fetchAll, shownAgain, deleteRec \} from "\.\/sync\.js";/.test(src), "Sign out first takes on what another page of the app stored and this page missed (the check round: its finish removed that queue)");
  assert.strictEqual((src.match(/setStatus\(\); \{ const say = \(\) => \(held\(\) \|\| paOpen \|\| rowHolds\(\)\) \? setTimeout\(say, 400\) : \(!S\.signedIn \|\| S\.sessionEmail !== who\) \? null : askChoice\(\{ title: "Couldn/g) || []).length, 2, "a logout that fails is an alert that stays, as every refusal (the check round: the bar's words were replaced at once)");
  assert.ok(/err\.message === "stale" \? \(navigator\.onLine \? "The server didn/.test(src), "a restore refused for a server error while online says so (the check round: it said to try again when online)");
});
test("the fourteenth check round: only a Delete is ever sent as a deletion; a coach rule's alert belongs to the account that sent it; Sign out sends what another page stored first", async () => {
  { const sb = makeSupabase(); coachOn(sb);
    const w = (id) => ({ id, clientId: "c1", title: "Legs", date: "2026-11-20", createdAt: AT, completedAt: null, skippedAt: null, rows: [] });
    for (const id of ["w1", "w2"]) { sb.seed("ft_trainings", id, w(id)); maps.trainings.set(id, w(id)); }
    maps.trainings.delete("w1"); fns.scheduleSave("trainings", "w1", 0); await settle();   // a save for a record that left the map without a Delete (a wipe under an open page)
    assert.deepStrictEqual([sb.tables.ft_trainings.has("w1"), maps.dirty.has("trainings/w1"), sb.log.filter((e) => e.op === "delete").length], [true, false, 0], "nothing is sent for it, never its deletion (the check rounds: a menu left over the sign-in deleted a whole workout)");
    fns.deleteRec("trainings", "w2"); await settle();
    assert.strictEqual(sb.tables.ft_trainings.has("w2"), false, "a Delete still deletes on the server");
    app.reset(); localStorage.clear(); }
  { const sb = makeSupabase(); coachOn(sb); sb.auth.getSession = async () => ({ data: { session: null } });   // no usable token: every save waits (the fake's setFail never reached getSession: the fifteenth round)
    const w = (id) => ({ id, clientId: "c1", title: "Legs", date: "2026-11-20", createdAt: AT, completedAt: null, skippedAt: null, rows: [] });
    for (const id of ["w3", "w4"]) maps.trainings.set(id, w(id));
    fns.deleteRec("trainings", "w3"); maps.trainings.delete("w4"); fns.scheduleSave("trainings", "w4", 0); await settle();
    const q = JSON.parse(localStorage.getItem("fiala.pending.v1") || "{}");
    assert.deepStrictEqual([maps.dirty.has("trainings/w4"), q.gone], [true, ["trainings/w3"]], "with no usable token the queue keeps the Delete as gone, and nothing for the record that only left the map (it waits here)");
    app.reset(); localStorage.clear(); }
  { const q0 = document.querySelector; document.querySelector = () => null; document.getElementById("whenBg").hidden = true;   // (the stand-ins answer every selector: no sheet up here)
    try {
      const sb = makeSupabase(); coachOn(sb); const c = maps.clients.get("c1"), off = { error: { message: "TypeError: Failed to fetch" } };
      fns.ruleRefused(c, off, "delete the health details", "coach@x.com");
      assert.strictEqual(app.get().asking, true, "signed in: the no-signal alert opens");
      fns.showLogin("");
      assert.strictEqual(app.get().asking, false, "the sign-in page closes it");
      fns.ruleRefused(c, off, "delete the health details", "coach@x.com");
      assert.strictEqual(app.get().asking, false, "signed out: no alert (the check round: it opened over the sign-in page, naming the client)");
      app.set({ signedIn: true, sessionEmail: "jane@x.com" });
      fns.ruleRefused(c, off, "delete the health details", "coach@x.com");
      assert.strictEqual(app.get().asking, false, "another account signed in since the rule went: no alert about the coach's client");
    } finally { document.querySelector = q0; app.reset(); } }
  { const sb = makeSupabase(); sb.auth.signOut = async () => ({ error: null }); coachOn(sb);
    const t = { id: "w5", clientId: "c1", title: "Legs (typed in the other tab)", date: "2026-11-20", createdAt: AT, completedAt: null, skippedAt: null, rows: [] };
    localStorage.setItem("fiala.pending.tab", "other-tab");
    localStorage.setItem("fiala.pending.v1", JSON.stringify({ tab: "other-tab", owner: "coach@x.com", dirty: ["trainings/w5"], recs: [["trainings/w5", t]] }));
    await fns.signOut(); await settle();
    const row = sb.tables.ft_trainings.get("w5");
    assert.deepStrictEqual([row && row.data.title, localStorage.getItem("fiala.pending.v1"), app.get().signedIn], ["Legs (typed in the other tab)", null, false], "Sign out first takes on what another page stored and this page missed, sends it, then signs out (the check round: its finish removed that queue)");
    app.reset(); localStorage.clear(); }
  const src = fs.readFileSync(new URL("../app/main.js", import.meta.url), "utf8");
  assert.ok(!/trainings\.delete\([^)]*\); scheduleSave\(/.test(src) && !/clients\.delete\([^)]*\); scheduleSave\(/.test(src), "every Delete goes through deleteRec");
  assert.ok((src.match(/\|\| \(S\.sb && !S\.signedIn\)\) return;/g) || []).length === 2, "a photo picked as the sign-in page comes up opens nothing over it");
});
test("a restore never brings back what a client deleted in the app since the backup (the owner's pick, 19 Nov 2026): health details, Health & safety, the photo, an exercise's note, a cleared weight or reps", async () => {
  const sb = makeSupabase(); app.reset(); app.set({ sb, signedIn: true, clientMode: false, backend: fns.cloudBackend, sessionEmail: "coach@x.com" });
  const C = "1b4e28ba-2fa1-41d2-883f-0016d3cca427", W = "2c5f39cb-3fb2-42e3-994f-1127e4ddb538";
  const row = (extra) => ({ id: "r1", label: "1", name: "Back squat", sets: 3, reps: "8", rest: "", tempo: "", weights: ["135", "135", "135"], repsDone: ["8", "8", "8"], setsDone: 3, done: true, note: "", ...extra });
  const here = { id: C, name: "Jane", unit: "lb", choices: { health: { state: "agreed", at: AT, by: "client" } }, health: { allergies: "Latex" } };   // since the backup: medications cleared, the photo removed
  const hereW = { id: W, clientId: C, title: "Legs", date: "2026-11-10", createdAt: AT, completedAt: null, skippedAt: null, rows: [row({ weights: ["135", "", "135"], repsDone: ["8", "", "8"] })] };   // since the backup: the note deleted, set 2 cleared
  maps.clients.set(C, JSON.parse(JSON.stringify(here))); maps.trainings.set(W, JSON.parse(JSON.stringify(hereW))); maps.seenAt.set("clients/" + C, "S1"); maps.seenAt.set("trainings/" + W, "S1");
  const file = (name, title) => ({ app: "fiala-trainings", format: 1, clients: { [C]: { ...here, name, health: { allergies: "Latex", medications: "Sertraline 50 mg" }, photo: "v1" } }, trainings: { [W]: { ...hereW, title, rows: [row({ clientNote: "knee sore on the last set", clientNoteBy: "client", clientNoteAt: "2026-11-09T10:00:00.000Z" })] } } });
  const same = fns.planRestore(file("Jane", "Legs"));
  assert.deepStrictEqual([same.cs.length, same.ts.length], [0, 0], "a backup that differs only by what the client deleted since has nothing to restore");
  const plan = fns.planRestore(file("Jane Doe", "Legs (backup)")); fns.applyRestore(plan); await settle();
  const c = maps.clients.get(C), t = maps.trainings.get(W), r = t.rows[0];
  assert.deepStrictEqual([c.name, c.health, c.photo, t.title, r.weights, r.repsDone, r.clientNote], ["Jane Doe", { allergies: "Latex" }, undefined, "Legs (backup)", ["135", "", "135"], ["8", "", "8"], undefined], "the file's own changes come back; the medications, the photo, the note and set 2's weight and reps stay deleted");
  app.reset(); localStorage.clear();
});
test("the restore rule case by case (the sixteenth check round): a photo changed, a note corrected and Weights in switched here stay as here; sets marked not done stay not done; a row's number never goes down; a client not here comes back with no photo; a template comes back as the file has it; the sheet says what stays", async () => {
  const C = "1b4e28ba-2fa1-41d2-883f-0016d3cca427", N = "9b2f6c1e-5a4d-4c3b-8e7f-1a2b3c4d5e6f", W = "2c5f39cb-3fb2-42e3-994f-1127e4ddb538", TP = "7c9e6679-7425-40de-944b-e07fc1f90ae7";
  const row = (extra) => ({ id: "r1", label: "1", name: "Back squat", sets: 3, reps: "8", rest: "", tempo: "", weights: ["135", "145", "155"], repsDone: ["8", "8", "8"], setsDone: 3, done: true, note: "", ...extra });
  const begin = () => { app.reset(); app.set({ sb: makeSupabase(), signedIn: true, clientMode: false, backend: fns.cloudBackend, sessionEmail: "coach@x.com" }); };
  const put = (kind, r) => { (kind === "clients" ? maps.clients : maps.trainings).set(r.id, JSON.parse(JSON.stringify(r))); maps.seenAt.set(kind + "/" + r.id, "S1"); };
  const file = (cs, ts) => ({ app: "fiala-trainings", format: 1, clients: Object.fromEntries(cs.map((c) => [c.id, c])), trainings: Object.fromEntries(ts.map((t) => [t.id, t])) });
  begin();
  const here = { id: C, name: "Jane", unit: "kg", photo: "v2" };                    // since the backup: a new photo, Weights in switched to kilograms
  const hereW = { id: W, clientId: C, title: "Legs", date: "2026-11-10", createdAt: AT, completedAt: null, skippedAt: null, rows: [row({ repsDone: ["8", "", ""], setsDone: 1, done: false, logSeq: 7, clientNote: "knee fine now", clientNoteBy: "client", clientNoteAt: "2026-11-12T10:00:00.000Z", unit: "lb" })] };   // since the backup: sets 2 and 3 marked not done (their reps cleared), the note corrected, sets sent since (the row's number at 7); the switch to kilograms stamped the row in pounds (as setLiftUnit and client_set_profile do)
  put("clients", here); put("trainings", hereW);
  const fileC = { ...here, unit: "lb", photo: "v1" }, fileW = { ...hereW, rows: [row({ logSeq: 3, clientNote: "knee sore", clientNoteBy: "client", clientNoteAt: "2026-11-09T10:00:00.000Z" })] };
  const same = fns.planRestore(file([fileC], [fileW]));
  assert.deepStrictEqual([same.cs.length, same.ts.length, same.held], [0, 0, 2], "differing only by what the rule keeps: nothing goes in, and the app says so (Nothing to restore) rather than \"already here\"");
  assert.deepStrictEqual([fns.planRestore(file([{ ...here, zone: { zone: "Asia/Tokyo", at: AT } }], [])).held, fns.planRestore(file([{ ...here, birthday: undefined }], [{ ...hereW, rows: [row({ repsDone: ["8", "", ""], setsDone: 1, done: false, logSeq: 7 })] }])).held, fns.planRestore(file([{ ...here, sex: "", health: { allergies: "" } }], [])).held], [0, 0, 0], "an older time-zone report, a note only here, or a detail left empty in the file is nothing the rule kept out: \"already here\"");
  const plan = fns.planRestore(file([{ ...fileC, name: "Jane Doe" }, { id: N, name: "Sam Lee", unit: "lb", photo: "v9", health: { emergency: "Ann Lee 555-0100" }, birthday: "1990-02-02" }], [{ ...fileW, title: "Legs (backup)" }]));
  assert.strictEqual(plan.text, "2 clients and 1 workout from the file go into the app. 2 of them replace a copy already here, logged sets, notes and plans included. Back in the app: Sam Lee, without health details, Health & safety or photo (the app asks again). Health details, Health & safety, photos, Weights in and Under 18 stay as they are in the app now. In a client’s workout in both the backup and the app, a finish or skip taken back stays taken back, and a reason for skipping taken back or changed to another stays that way. On its exercises in both, notes stay as they are now, and weights and reps cleared, sets marked not done, exercises resumed and reasons for finishing early taken back or changed to another stay that way. Everything else stays as it is.");
  fns.applyRestore(plan);
  const c = maps.clients.get(C), n = maps.clients.get(N), t = maps.trainings.get(W), r = t.rows[0];
  assert.deepStrictEqual([c.name, c.unit, c.photo, n.name, n.photo, n.health, n.birthday], ["Jane Doe", "kg", "v2", "Sam Lee", undefined, undefined, undefined], "the file's name comes back; the photo and Weights in stay as here; a client not here comes back with none of its own details, nor its photo (its files went with it)");
  assert.deepStrictEqual([t.title, r.clientNote, r.clientNoteAt, r.weights, r.repsDone, r.setsDone, r.done, r.logSeq], ["Legs (backup)", "knee fine now", "2026-11-12T10:00:00.000Z", ["135", "145", "155"], ["8", "", ""], 1, false, 7], "the note as corrected here; sets 2 and 3 still not done, their reps empty; the row's number never back to 3");
  await settle(); app.reset(); localStorage.clear();
  begin();
  put("clients", { id: TEMPLATES_ID, name: "Templates", kind: "templates" });
  const tpl = { id: TP, clientId: TEMPLATES_ID, title: "Upper A", date: "2026-01-01", createdAt: AT, completedAt: null, skippedAt: null, rows: [row({ weights: ["", "", ""], repsDone: ["", "", ""], setsDone: 0, done: false })] };
  put("trainings", tpl);
  fns.applyRestore(fns.planRestore(file([], [{ ...tpl, rows: [row({ weights: ["95", "95", "95"], repsDone: ["", "", ""], setsDone: 0, done: false, clientNote: "kept" })] }])));
  assert.deepStrictEqual([maps.trainings.get(TP).rows[0].weights, maps.trainings.get(TP).rows[0].clientNote], [["95", "95", "95"], "kept"], "a template is the coach's own: it comes back as the file has it");
  await settle(); app.reset(); localStorage.clear();
});
test("the restore question is up while a sync changes the records (the sixteenth check round): a note the client deletes meanwhile stays deleted, a set the client logs meanwhile gets the file's value (never a blank), and an Under 18 switched off on another device meanwhile stays off", async () => {
  const C = "1b4e28ba-2fa1-41d2-883f-0016d3cca427", W = "2c5f39cb-3fb2-42e3-994f-1127e4ddb538", Y = new Date().getFullYear();
  const row = (extra) => ({ id: "r1", label: "1", name: "Back squat", sets: 3, reps: "8", rest: "", tempo: "", weights: ["135", "135", "135"], repsDone: ["8", "8", "8"], setsDone: 3, done: true, note: "", ...extra });
  app.reset(); app.set({ sb: makeSupabase(), signedIn: true, clientMode: false, backend: fns.cloudBackend, sessionEmail: "coach@x.com" });
  const here = { id: C, name: "Jane", unit: "lb", minor: true, minorUntil: Y + 2 };
  const hereW = { id: W, clientId: C, title: "Legs", date: "2026-11-10", createdAt: AT, completedAt: null, skippedAt: null, rows: [row({ weights: ["135", "", ""], repsDone: ["8", "", ""], setsDone: 1, done: false, clientNote: "knee sore", clientNoteBy: "client", clientNoteAt: "2026-11-09T10:00:00.000Z" })] };
  maps.clients.set(C, JSON.parse(JSON.stringify(here))); maps.trainings.set(W, JSON.parse(JSON.stringify(hereW))); maps.seenAt.set("clients/" + C, "S1"); maps.seenAt.set("trainings/" + W, "S1");
  const plan = fns.planRestore({ app: "fiala-trainings", format: 1, clients: { [C]: { id: C, name: "Jane Doe", unit: "lb" } }, trainings: { [W]: { ...hereW, title: "Legs (backup)", rows: [row({ clientNote: "knee sore", clientNoteBy: "client", clientNoteAt: "2026-11-09T10:00:00.000Z" })] } } });
  const now = JSON.parse(JSON.stringify(maps.trainings.get(W))), nr = now.rows[0]; delete nr.clientNote; delete nr.clientNoteBy; delete nr.clientNoteAt; nr.weights[1] = "140"; nr.repsDone[1] = "7"; nr.setsDone = 2;   // a sync under the question brings the client's changes (a new record, as mergeDown puts it)
  maps.trainings.set(W, now); maps.clients.set(C, { id: C, name: "Jane", unit: "lb" }); maps.seenAt.set("trainings/" + W, "S2"); maps.seenAt.set("clients/" + C, "S2");   // and Under 18 switched off on the coach's iPhone
  fns.applyRestore(plan);
  const c = maps.clients.get(C), r = maps.trainings.get(W).rows[0];
  assert.deepStrictEqual([c.name, c.minor, c.minorUntil, r.clientNote, r.weights, r.repsDone, r.setsDone], ["Jane Doe", undefined, undefined, undefined, ["135", "135", ""], ["8", "8", ""], 2], "held against the records as Restore is tapped, from the file's own copy: set 2 takes the file's 135 for 8 (the client's 140 for 7 is replaced, as the sheet says), set 3 stays empty");
  await settle(); app.reset(); localStorage.clear();
});
test("a restore's own write keeps what the client deleted after this device last read the record (the sixteenth check round): with no sync before the tap, with one, when the write waits for a signal, and when the coach's Delete was still queued; what the coach changed after the tap stands", async () => {
  const C = "1b4e28ba-2fa1-41d2-883f-0016d3cca427", W = "2c5f39cb-3fb2-42e3-994f-1127e4ddb538", clone = (x) => JSON.parse(JSON.stringify(x));
  const row = (extra) => ({ id: "r1", label: "1", name: "Back squat", sets: 3, reps: "8", rest: "", tempo: "", weights: ["135", "135", "135"], repsDone: ["8", "8", "8"], setsDone: 3, done: true, note: "", unit: "lb", ...extra });
  let n = 0; const bump = (s) => { s.updated_at = "2026-11-20T10:00:" + String(10 + n++).padStart(2, "0") + ".000Z"; };
  for (const variant of ["no sync", "a sync under the question", "the write waits for a signal", "the coach's edits after the tap", "the coach's Delete still queued"]) {
    const sb = makeSupabase(); app.reset(); fns.leaveSettings(); app.set({ sb, signedIn: true, clientMode: false, backend: fns.cloudBackend, sessionEmail: "coach@x.com", view: { name: "clients" } });
    const cl = { id: C, name: "Jane Roe", unit: "lb", photo: "v1abcdef", choices: { health: { state: "agreed", at: AT, by: "client" } }, health: { allergies: "Latex", medications: "Sertraline 50 mg" } };
    const hereW = { id: W, clientId: C, title: "Legs", date: "2026-11-10", createdAt: AT, completedAt: null, skippedAt: null, rows: [row({ clientNote: "knee sore", clientNoteBy: "client", clientNoteAt: AT })] };
    sb.seed("ft_clients", C, clone(cl)); sb.seed("ft_trainings", W, clone(hereW), { client_id: C });
    await fns.syncDownNow(); await settle();
    const clientDeletes = () => {                                      // on the client's phone: the note deleted, set 2 cleared, Medications cleared, the photo removed
      { const s = sb.tables.ft_trainings.get(W); delete s.data.rows[0].clientNote; delete s.data.rows[0].clientNoteBy; delete s.data.rows[0].clientNoteAt; s.data.rows[0].weights[1] = ""; s.data.rows[0].repsDone[1] = ""; bump(s); }
      { const s = sb.tables.ft_clients.get(C); delete s.data.health.medications; delete s.data.photo; bump(s); }
    };
    if (variant === "the coach's Delete still queued") { clientDeletes(); sb.setFail({ times: 1000, message: "Failed to fetch" }); fns.deleteRec("trainings", W); await settle(); }   // the coach deletes the workout with no signal, the client's changes not yet read
    const plan = fns.planRestore({ app: "fiala-trainings", format: 1, clients: { [C]: { ...clone(cl), name: "Jane R." } }, trainings: { [W]: { ...clone(hereW), title: "Legs (file)" } } });
    if (variant === "no sync") { clientDeletes(); fns.applyRestore(plan); await settle(); }
    if (variant === "a sync under the question") { clientDeletes(); await fns.syncDownNow(); await settle(); fns.applyRestore(plan); await settle(); }
    if (variant === "the write waits for a signal" || variant === "the coach's edits after the tap" || variant === "the coach's Delete still queued") {
      sb.setFail({ times: 1000, message: "Failed to fetch" }); fns.applyRestore(plan); await settle();
      if (variant === "the coach's edits after the tap") {          // still with no signal: the coach puts a new Medications on the card and a new set 2 on the workout
        fns.setProfile(C, "health.medications", "Sertraline 25 mg");
        const t = maps.trainings.get(W); t.rows[0].weights[1] = "150"; t.rows[0].repsDone[1] = "6"; if (!maps.trainerTouched.has(W)) maps.trainerTouched.set(W, new Set()); maps.trainerTouched.get(W).add("r1"); fns.scheduleSave("trainings", W, 0); await settle();
      }
      const waiting = [...maps.dirty.keys()]; sb.setFail(null); if (variant !== "the coach's Delete still queued") clientDeletes();
      app.set({ offline: false }); for (const k of waiting) { const [kind, id] = k.split("/"); fns.scheduleSave(kind, id, 0); } await settle();
    }
    const st = sb.tables.ft_trainings.get(W).data, sc = sb.tables.ft_clients.get(C).data, mine = variant === "the coach's edits after the tap";
    assert.deepStrictEqual([sc.name, st.title, st.rows[0].clientNote, st.rows[0].weights, st.rows[0].repsDone, (sc.health || {}).medications, sc.photo, sc.health.allergies], ["Jane R.", "Legs (file)", undefined, mine ? ["135", "150", "135"] : ["135", "", "135"], mine ? ["8", "6", "8"] : ["8", "", "8"], mine ? "Sertraline 25 mg" : undefined, undefined, "Latex"], variant + ": the file's own changes land; the client's deletions stay deleted" + (mine ? ", but for what the coach typed after the tap" : ""));
    assert.deepStrictEqual([maps.trainings.get(W).rows[0].clientNote, maps.clients.get(C).photo], [undefined, undefined], variant + ": the copy here shows it too");
    app.reset(); localStorage.clear();
  }
});
test("the fifteenth check round: both sign-outs clear the Delete marks; a refused logout's words follow the network; a coach rule's alert and a held sign-out refusal never open once signed out or for another account", async () => {
  const TOKEN = "sb-umurkxqswcjmubeucrzw-auth-token";
  for (const client of [false, true]) {
    const sb = makeSupabase(); sb.auth.signOut = async () => ({ error: null }); if (client) clientOn(sb); else coachOn(sb);
    maps.deleting.add("trainings/stale");                                 // a mark left on a record restored since (Delete, then Restore)
    await fns.signOut(); await settle();
    assert.deepStrictEqual([app.get().signedIn, maps.deleting.size], [false, 0], (client ? "the client's" : "the coach's") + " sign-out clears the marks");
    app.reset(); localStorage.clear();
  }
  for (const client of [false, true]) {
    const sb = makeSupabase(); sb.auth.signOut = async () => ({ error: { message: "Request timed out" } }); if (client) clientOn(sb, { choices: { zone: { state: "deny", at: AT }, health: { state: "declined", at: AT } } }); else coachOn(sb);   // (both questions answered: none comes up first)
    localStorage.setItem(TOKEN, "{}"); app.set({ offline: true }); navigator.onLine = true;
    const q0 = document.querySelector, ce = document.createElement, made = []; document.querySelector = () => null; document.getElementById("whenBg").hidden = true;
    document.createElement = (tg) => { const e = ce(tg); made.push(e); return e; };
    try { await fns.signOut(); await tick(20); } finally { document.createElement = ce; document.querySelector = q0; }
    assert.deepStrictEqual(made.filter((e) => e.className === "pa-text").map((e) => e.textContent), ["The server didn’t answer. Try again later."], (client ? "the client's" : "the coach's") + " logout alert: a network, though a sync's timeout set Offline");
    fns.showLogin(""); app.reset(); localStorage.clear();
  }
  const src = fs.readFileSync(new URL("../app/main.js", import.meta.url), "utf8");
  assert.ok((src.match(/c = clients\.get\(id\), as0 = S\.sessionEmail;/g) || []).length === 2 && (src.match(/, as0\);/g) || []).length === 2, "the paper switch and Delete health details capture the account at the tap and pass it to the alert");
  assert.strictEqual((src.match(/texts: \[navigator\.onLine \? "The server didn/g) || []).length, 2, "both logout alerts follow the network itself");
  assert.strictEqual((src.match(/setTimeout\(say, 400\) : \(S\.sb && !S\.signedIn\) \? null : askChoice\(\{ title: "Couldn/g) || []).length, 2, "a sign-out refusal held back for a sheet never opens over the sign-in page (the check round)");
});
