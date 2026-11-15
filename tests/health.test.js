// v299 (the owner's asks, 15 Nov 2026): Settings "Apple like" in both views, a client's Health details (date of birth, sex, height, body weight, each
// with its own unit switch on its wheel) and Health & safety, the client switching the client's own workout unit ("Weights in"), and the client's limits at the top of
// the coach's workout. The wheels, the pages' look and the sheet's gestures are checked on the simulator; here, what is kept and sent.
import fs from "node:fs";
import { test, assert, tick } from "./assert.js";
import { makeSupabase } from "./fake-supabase.js";
import { byId, el } from "./env.js";
import { load } from "./load.js";
import { heightAs, weightAs, heightUnitOf, bodyUnitOf, fmtHeight, fmtBodyWeight, ageOn, profileGet, profilePut, validateBackup, TEMPLATES_ID } from "../app/model.js";
const app = await load();
const { fns, maps } = app;
const $ = (id) => document.getElementById(id);
const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const src = fs.readFileSync(new URL("../app/main.js", import.meta.url), "utf8");
const sql = fs.readFileSync(new URL("../supabase/client-profile.sql", import.meta.url), "utf8");
const day = (n) => { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + n); return fns.localIso(d); };
const settle = async () => { const until = Date.now() + 15000; do await tick(5); while ((app.get().inflight > 0 || maps.timers.size) && Date.now() < until); assert.strictEqual(app.get().inflight, 0); assert.strictEqual(maps.timers.size, 0); };
const quiet = () => { for (const t of maps.timers.values()) clearTimeout(t); maps.timers.clear(); fns.setPreview(false); };
const U = "11111111-1111-4111-8111-111111111111";
const clientOn = (sb, extra) => { app.reset(); fns.leaveSettings(); app.set({ sb, signedIn: true, clientMode: true, myClientId: "c1", backend: fns.clientBackend, sessionEmail: "jane@x.com", view: { name: "client", id: "c1" } }); maps.clients.set("c1", { id: "c1", name: "Jane Doe", unit: "lb", ...(extra || {}) }); };
const coachOn = (sb, extra) => { app.reset(); fns.leaveSettings(); app.set({ sb, signedIn: true, clientMode: false, backend: fns.cloudBackend, sessionEmail: "coach@x.com", view: { name: "client", id: "c1" } }); maps.clients.set("c1", { id: "c1", name: "Jane Doe", unit: "lb", ...(extra || {}) }); };
const sent = (sb) => sb.log.filter((l) => l.rpc === "client_set_profile").map((l) => l.args);
const workout = (id, extra) => ({ id, clientId: "c1", title: "Legs", date: day(0), createdAt: "2026-11-01T10:00:00.000Z", completedAt: null, skippedAt: null, rows: [], ...(extra || {}) });
const logged = (w, unit) => ({ id: "r1", label: "1", name: "Leg press", sets: 1, reps: "12", rest: "", tempo: "", weights: [w], repsDone: ["12"], setsDone: 1, done: true, note: "", alts: [], ...(unit ? { unit } : {}) });

test("the measures: kept as entered, shown in the unit picked on their own switch, never drifting (142 lb is 64 kg and 142 lb again)", () => {
  assert.deepStrictEqual([heightAs({ v: 67, u: "in" }, "cm"), heightAs({ v: 170, u: "cm" }, "in"), heightAs({ v: 67, u: "in" }, "in"), heightAs({ v: 0, u: "in" }, "cm"), heightAs(null, "cm"), heightAs({ v: 67, u: "ft" }, "cm")], [170, 67, 67, null, null, null]);
  assert.deepStrictEqual([weightAs({ v: 142, u: "lb" }, "kg"), weightAs({ v: 64, u: "kg" }, "lb"), weightAs({ v: 142, u: "lb" }, "lb")], [64, 141, 142], "shown converted; the record keeps 142 lb");
  assert.deepStrictEqual([fmtHeight(67, "in"), fmtHeight(60, "in"), fmtHeight(170, "cm"), fmtHeight(null, "in"), fmtBodyWeight(142, "lb"), fmtBodyWeight(64, "kg")], ["5′ 7″", "5′ 0″", "170 cm", "", "142 lb", "64 kg"], "Apple's prime marks, as Fitness writes them");
  assert.deepStrictEqual([heightUnitOf({}), bodyUnitOf({}), heightUnitOf({ unit: "kg" }), bodyUnitOf({ unit: "kg" }), heightUnitOf({ heightUnit: "cm", unit: "lb" }), bodyUnitOf({ bodyWeight: { v: 70, u: "kg" } }), bodyUnitOf({ bodyUnit: "lb", bodyWeight: { v: 70, u: "kg" } })], ["in", "lb", "cm", "kg", "cm", "kg", "lb"], "each its own switch; nothing chosen: what the client lifts in");
  assert.deepStrictEqual([ageOn("1990-11-16", "2026-11-15"), ageOn("1990-11-15", "2026-11-15"), ageOn("", "2026-11-15"), ageOn("2030-01-01", "2026-11-15")], [35, 36, null, null]);
});

test("a profile field by the rule's key: health.* inside health; empty or nothing is null, a clear; false stays false", () => {
  const c = {}; profilePut(c, "health.limits", "Left knee"); profilePut(c, "sex", "female"); profilePut(c, "health.pregnant", false);
  assert.deepStrictEqual(c, { health: { limits: "Left knee", pregnant: false }, sex: "female" });
  assert.deepStrictEqual([profileGet(c, "health.limits"), profileGet(c, "sex"), profileGet(c, "health.pregnant"), profileGet(c, "health.doctor"), profileGet(c, "height"), profileGet({ health: "x" }, "health.limits")], ["Left knee", "female", false, null, null, null]);
  profilePut(c, "health.limits", ""); profilePut(c, "sex", null); profilePut({}, "health.limits", null);
  assert.deepStrictEqual(c, { health: { pregnant: false } }, "cleared, the record keeps no empty text");
  assert.deepStrictEqual([profileGet({ sex: "" }, "sex"), profileGet({ health: { limits: "" } }, "health.limits"), profileGet({ height: null }, "height")], [null, null, null], "an empty text is a clear, sent as null");
});

test("a backup takes the new fields in the shape the pages read, and refuses anything else", () => {
  const ok = (c) => { try { validateBackup({ app: "fiala-trainings", clients: { [U]: { id: U, name: "Jane", ...c } }, trainings: {} }, () => false); return true; } catch (_) { return false; } };
  assert.ok(ok({ birthday: "1990-03-14", sex: "female", height: { v: 67, u: "in" }, bodyWeight: { v: 64, u: "kg" }, heightUnit: "cm", bodyUnit: "lb", health: { limits: "Left knee", pregnant: true, emergency: "David (husband) (310) 555-0187", doctor: "" } }));
  for (const bad of [{ sex: "x" }, { height: "5'7" }, { height: { v: 67, u: "ft" } }, { bodyWeight: { v: "64", u: "kg" } }, { heightUnit: "ft" }, { bodyUnit: "st" }, { health: "text" }, { health: { pregnant: "yes" } }, { health: { emergency: { name: "D" } } }, { birthday: 1990 }]) assert.ok(!ok(bad), JSON.stringify(bad));
});

test("the client's own field goes through the client's rule, one per request, the latest value; a clear is sent as null (never left out: the rule takes three arguments)", async () => {
  const sb = makeSupabase(); clientOn(sb); const got = []; sb.rpcs.client_set_profile = async (a) => { got.push(JSON.parse(JSON.stringify(a))); return null; };
  fns.setProfile("c1", "health.limits", "Left knee"); fns.setProfile("c1", "height", { v: 67, u: "in" }); fns.setProfile("c1", "health.limits", "Left knee: no lunges");
  assert.deepStrictEqual([...maps.pendingProfile.get("c1")], ["health.limits", "height"], "queued, each key once");
  assert.deepStrictEqual(maps.clients.get("c1").health, { limits: "Left knee: no lunges" }, "the client's phone shows it at once");
  await settle();
  assert.deepStrictEqual(got, [{ p_client: "c1", p_key: "health.limits", p_value: "Left knee: no lunges" }, { p_client: "c1", p_key: "height", p_value: { v: 67, u: "in" } }]);
  assert.strictEqual(maps.pendingProfile.has("c1"), false, "nothing left waiting");
  fns.setProfile("c1", "health.limits", ""); await settle();
  assert.deepStrictEqual(sent(sb).at(-1), { p_client: "c1", p_key: "health.limits", p_value: null }); assert.ok(sent(sb).every((a) => "p_value" in a));
  assert.strictEqual(sb.log.filter((l) => l.table === "ft_clients").length, 0, "the client never writes the table");
  assert.strictEqual(fns.setProfile("c1", "health.limits", null), false, "no change, nothing sent");
});

test("before the client's rule is run: kept on the client's phone and shown, a sync meanwhile does not take it back; once it is there it goes", async () => {
  const sb = makeSupabase(); clientOn(sb);
  fns.setProfile("c1", "sex", "female"); fns.setProfile("c1", "health.allergies", "Latex"); await settle();
  assert.strictEqual(app.get().profileMissing, true, "the rule is missing"); assert.deepStrictEqual([...maps.pendingProfile.get("c1")], ["sex", "health.allergies"], "both kept");
  fns.mergeDown(maps.clients, "clients", [{ id: "c1", data: { id: "c1", name: "Jane Doe", unit: "lb", paused: false, health: { limits: "From the coach" } } }], true, Date.now());
  const c = maps.clients.get("c1"); assert.deepStrictEqual([c.sex, c.health], ["female", { limits: "From the coach", allergies: "Latex" }], "the client's ride on the server's copy, the coach's land");
  fns.persistPending(); maps.pendingProfile.clear(); maps.dirty.clear(); fns.restorePending();
  assert.deepStrictEqual([[...maps.pendingProfile.get("c1")], maps.dirty.has("clients/c1")], [["sex", "health.allergies"], true], "kept across a relaunch, and sent again on it");
  const got = []; sb.rpcs.client_set_profile = async (a) => { got.push(a.p_key + "=" + JSON.stringify(a.p_value)); return null; }; app.set({ profileMissing: false });
  const started = Date.now() - 1; fns.scheduleSave("clients", "c1", 0); await settle();   // a read that began before the client's change landed
  assert.deepStrictEqual(got, ['sex="female"', 'health.allergies="Latex"']); assert.strictEqual(maps.pendingProfile.has("c1"), false);
  fns.mergeDown(maps.clients, "clients", [{ id: "c1", data: { id: "c1", name: "Jane Doe", unit: "lb" } }], true, started);
  assert.strictEqual(maps.clients.get("c1").sex, "female", "a read that began before the client's change landed does not bring the old record back");
});

test("a field that landed stays even when the next one fails on the way: a read that began before it does not bring it back", async () => {
  const sb = makeSupabase(); clientOn(sb);
  sb.rpcs.client_set_profile = async (a) => { if (a.p_key === "health.allergies") { const e = new Error("Failed to fetch"); e.code = "NET"; throw e; } return null; };
  fns.setProfile("c1", "sex", "female"); fns.setProfile("c1", "health.allergies", "Latex");
  const started = Date.now() - 1; fns.scheduleSave("clients", "c1", 0); await tick(600); quiet();
  assert.deepStrictEqual([...(maps.pendingProfile.get("c1") || [])], ["health.allergies"], "the first landed, the second waits");
  fns.mergeDown(maps.clients, "clients", [{ id: "c1", data: { id: "c1", name: "Jane Doe", unit: "lb" } }], true, started);
  assert.deepStrictEqual([maps.clients.get("c1").sex, (maps.clients.get("c1").health || {}).allergies], ["female", "Latex"], "neither is taken back by the older read");
  maps.dirty.clear();
});

test("a refusal drops that field (the server's comes back), no signal keeps it, a change made while one is out goes again", async () => {
  const sb = makeSupabase(); clientOn(sb);
  sb.rpcs.client_set_profile = async (a) => { if (a.p_key === "sex") { const e = new Error("bad sex"); e.code = "P0001"; throw e; } return null; };
  fns.setProfile("c1", "sex", "female"); fns.setProfile("c1", "health.limits", "Knee"); await settle(); clearTimeout(app.get().syncTimer);
  assert.strictEqual(maps.pendingProfile.has("c1"), false, "refused for good: dropped; the other went");
  sb.rpcs.client_set_profile = async () => { const e = new Error("Failed to fetch"); e.code = "NET"; throw e; };
  fns.setProfile("c1", "health.limits", "Knee, both"); await tick(600); quiet();
  assert.deepStrictEqual([...(maps.pendingProfile.get("c1") || [])], ["health.limits"], "no signal: kept"); assert.strictEqual(app.get().profileMissing, false, "and not taken for a missing rule");
  let release; const got = []; sb.rpcs.client_set_profile = async (a) => { got.push(a.p_value); if (got.length === 1) await new Promise((r) => { release = r; }); return null; };
  fns.scheduleSave("clients", "c1", 0); await tick(20);
  fns.setProfile("c1", "health.limits", "Both knees"); release(); await settle();
  assert.deepStrictEqual(got, ["Knee, both", "Both knees"], "the answer to the older value did not acknowledge the newer one"); assert.strictEqual(maps.pendingProfile.has("c1"), false);
});

test("Weights in, the client's own: the client's logged workouts keep their unit on the client's phone (no workout save), the rule gets the unit, the \"…\" ticks it", async () => {
  const sb = makeSupabase(); clientOn(sb); const got = []; sb.rpcs.client_set_profile = async (a) => { got.push([a.p_key, a.p_value]); return null; };
  maps.trainings.set("p1", workout("p1", { date: day(-3), completedAt: day(-3) + "T18:00:00.000Z", rows: [logged("135")] }));
  maps.trainings.set("w1", workout("w1"));
  app.set({ view: { name: "training", id: "w1" }, renderedTraining: null }); fns.render();
  assert.deepStrictEqual(fns.moreItems(maps.trainings.get("w1")).map((it) => [it.label, it.checked === true, !!it.sep]), [["Reschedule", false, false], ["Weights in lb", true, true], ["Weights in kg", false, false]], "after a line, lb ticked");
  fns.moreItems(maps.trainings.get("w1"))[2].onPick();
  assert.strictEqual(maps.clients.get("c1").unit, "kg"); assert.strictEqual(maps.trainings.get("p1").rows[0].unit, "lb", "135 logged before stays 135 lb");
  assert.ok(!maps.dirty.has("trainings/p1"), "the client's phone never saves a workout for this: the client's rule stamps the server's copy");
  await settle(); assert.deepStrictEqual(got, [["unit", "kg"]]);
  assert.deepStrictEqual(fns.moreItems(maps.trainings.get("w1")).filter((it) => it.checked).map((it) => it.label), ["Weights in kg"]);
  assert.strictEqual(fns.setLiftUnit("c1", "kg"), false, "picked again: nothing");
  quiet();
});

test("while the client's new unit is still on its way, a sync reads the client's workouts as the rule will stamp them (logged with no unit = the old one)", async () => {
  const sb = makeSupabase(); clientOn(sb);
  maps.trainings.set("p1", workout("p1", { date: day(-3), completedAt: day(-3) + "T18:00:00.000Z", rows: [logged("135")] }));
  fns.setLiftUnit("c1", "kg"); await settle(); assert.strictEqual(app.get().profileMissing, true, "rule missing: the unit waits");
  sb.rpcs.client_my_data = async () => ({ clients: [{ id: "c1", data: { name: "Jane Doe", unit: "lb", email: "jane@x.com" } }], trainings: [{ id: "p1", data: workout("p1", { date: day(-3), completedAt: day(-3) + "T18:00:00.000Z", rows: [logged("135")] }) }] });
  await fns.syncDownNow(); await settle();
  assert.strictEqual(maps.clients.get("c1").unit, "kg", "the client's switch stands"); assert.strictEqual(maps.trainings.get("p1").rows[0].unit, "lb", "the server's unstamped 135 reads as lb, not kg");
  quiet();
});

test("the coach's card: an ordinary save (no rule), the coach's unit change stamps the client's workouts; the client's Health & safety field by field when both wrote", async () => {
  const sb = makeSupabase(); coachOn(sb);
  maps.trainings.set("p1", workout("p1", { date: day(-3), completedAt: day(-3) + "T18:00:00.000Z", rows: [logged("100")] }));
  fns.setLiftUnit("c1", "kg");
  assert.deepStrictEqual([maps.clients.get("c1").unit, maps.trainings.get("p1").rows[0].unit, maps.dirty.has("trainings/p1"), maps.dirty.has("clients/c1")], ["kg", "lb", true, true], "100 lb stays 100 lb, saved");
  assert.strictEqual(sent(sb).length, 0); quiet();
  const sb2 = makeSupabase(); coachOn(sb2); const base = { id: "c1", name: "Jane Doe", unit: "lb", health: { limits: "Knee" } };
  const stamp = sb2.seed("ft_clients", "c1", base); fns.mergeDown(maps.clients, "clients", [{ id: "c1", data: base, updated_at: stamp }], true, Date.now());
  sb2.seed("ft_clients", "c1", { ...base, sex: "female", health: { limits: "Knee", medications: "Inhaler" } });   // the client's rule wrote meanwhile
  fns.setProfile("c1", "health.limits", "Left knee: no lunges"); maps.clients.get("c1").name = "Jane D.";
  await fns.cloudBackend.set("clients", "c1", JSON.parse(JSON.stringify(maps.clients.get("c1"))));
  const saved = sb2.tables.ft_clients.get("c1").data;
  assert.deepStrictEqual([saved.health, saved.sex, saved.name], [{ limits: "Left knee: no lunges", medications: "Inhaler" }, "female", "Jane D."], "the coach's limits and name land, the client's medications and sex stay");
  quiet();
});

test("Health details and Health & safety are pages of their own: the client's from the client's Settings, the coach's from the card; Back, a redraw and a reload keep them", async () => {
  try {
    const sb = makeSupabase(); clientOn(sb); fns.showSettings(); fns.openSub("health", "settings", {});
    assert.deepStrictEqual(fns.settingsPage(), { open: "health", from: "settings" }); assert.deepStrictEqual([$("vHealth").hidden, $("vSettings").hidden, $("backLabel").textContent], [false, true, "Settings"]);
    fns.render(); assert.deepStrictEqual([$("vHealth").hidden, $("vPassword").hidden], [false, true], "a sync's redraw keeps it (never Change password)");
    assert.strictEqual(fns.backKey(), "client/c1/////|settings|", "Back's picture is the client's Settings");
    assert.deepStrictEqual(JSON.parse(localStorage.getItem("fiala.trainings.page")), { open: "health", from: "settings" }, "a reload reopens it");
    await fns.goBackNow(); assert.deepStrictEqual([fns.settingsPage().open, $("vSettings").hidden, $("vHealth").hidden], ["settings", false, true]);
    assert.strictEqual(fns.showSub("health", "card"), false, "the client has no card"); fns.leaveSettings();
    coachOn(sb, { birthday: "1990-03-14", height: { v: 67, u: "in" }, health: { limits: "Left knee: no lunges" } }); app.set({ view: { name: "client", id: "c1" } });
    $("cardHealthVal").textContent = "stale"; $("cardSafetyVal").textContent = "stale"; fns.showClientCard();
    assert.deepStrictEqual([$("cardHealthVal").textContent.replace(/^\d+/, "N"), $("cardSafetyVal").textContent], ["N \u00b7 5\u2032 7\u2033", "Left knee"], "the card's two rows say what is there");
    fns.openSub("safety", "card", {});
    assert.deepStrictEqual([fns.settingsPage(), $("vSafety").hidden, $("backLabel").textContent, fns.backKey()], [{ open: "safety", from: "card" }, false, "Jane Doe", "client/c1/////|card|"]);
    await fns.goBackNow(); assert.deepStrictEqual([fns.settingsPage().open, $("vClientCard").hidden], ["card", false], "Back lands on the client's card");
    assert.strictEqual(fns.showSub("safety", "settings"), false, "the coach's Settings have no such row");
    fns.openSub("health", "card", {}); maps.clients.delete("c1"); fns.render();
    assert.notStrictEqual(fns.settingsPage().open, "health", "the client's record gone: off the page"); assert.strictEqual($("vHealth").hidden, true);
  } finally { fns.leaveSettings(); quiet(); }
});

test("the card's rows: Health details and Health & safety in a word, what the coach must see at a glance", () => {
  const c = { birthday: day(0).slice(0, 4) - 36 + day(0).slice(4), height: { v: 67, u: "in" }, bodyWeight: { v: 142, u: "lb" }, health: { limits: "Left knee: no deep lunges", conditions: "Asthma, exercise-induced" } };
  assert.strictEqual(fns.healthSummary(c), "36 · 5′ 7″ · 142 lb");
  assert.strictEqual(fns.healthSummary({ ...c, bodyUnit: "kg", heightUnit: "cm" }), "36 · 170 cm · 64 kg", "in the client's own units");
  assert.strictEqual(fns.safetySummary(c), "Left knee · Asthma"); assert.strictEqual(fns.safetySummary({ health: { pregnant: true } }), "Pregnant"); assert.strictEqual(fns.safetySummary({}), "");
  assert.strictEqual(fns.healthSummary({}), "", "nothing set: nothing");
  assert.strictEqual(fns.fmtBirthday("1990-03-14").replace(/ \(\d+\)$/, ""), "Mar 14, 1990"); assert.strictEqual(fns.fmtBirthday(""), "");
});

test("the client's limits at the top of the coach's own workout: as text (the client types it), never in the client's look, the coach's Client view, a template, nor without limits; a sync's change shows", () => {
  try {
    const sb = makeSupabase(); coachOn(sb, { health: { limits: "<img src=x onerror=alert(1)>" } });
    maps.clients.set(TEMPLATES_ID, { id: TEMPLATES_ID, name: "Templates" }); maps.trainings.set("w1", workout("w1")); maps.trainings.set("tp", workout("tp", { clientId: TEMPLATES_ID, date: null }));
    $("limitsText").innerHTML = ""; app.set({ view: { name: "training", id: "w1" }, renderedTraining: null }); fns.render();
    assert.deepStrictEqual([$("limitsNote").hidden, $("limitsText").textContent, $("limitsText").innerHTML], [false, "<img src=x onerror=alert(1)>", ""], "words, never markup");
    fns.setPreview(true); fns.render(); assert.strictEqual($("limitsNote").hidden, true, "the coach's Client view: what the client sees"); fns.setPreview(false);
    maps.clients.get(TEMPLATES_ID).health = { limits: "never shown" }; app.set({ view: { name: "training", id: "tp" }, renderedTraining: null }); fns.render(); assert.strictEqual($("limitsNote").hidden, true, "a template, whatever its record holds");
    app.set({ view: { name: "training", id: "w1" }, renderedTraining: null }); maps.clients.get("c1").health = {}; fns.render(); assert.strictEqual($("limitsNote").hidden, true, "no limits, no note");
    maps.clients.set("c1", { ...maps.clients.get("c1"), health: { limits: "Left knee" } }); fns.render(); assert.deepStrictEqual([$("limitsNote").hidden, $("limitsText").textContent], [false, "Left knee"], "a sync that changed only the client's record");
    clientOn(sb, { health: { limits: "Left knee" } }); maps.trainings.set("w1", workout("w1")); app.set({ view: { name: "training", id: "w1" }, renderedTraining: null }); fns.render();
    assert.strictEqual($("limitsNote").hidden, true, "never in the client's own app"); assert.ok(/class="notice limits-note trainer-only" id="limitsNote"/.test(html), "and coach-only in the markup too");
  } finally { quiet(); }
});

test("the coach calls the client's emergency contact: the number in what was written, as the Message button reads one", () => {
  assert.strictEqual(fns.phoneIn("David Carter (husband) · (310) 555-0187"), "13105550187");
  assert.strictEqual(fns.phoneIn("+44 20 7946 0958 (sister)"), "442079460958");
  assert.strictEqual(fns.phoneIn("David, ask the front desk"), ""); assert.strictEqual(fns.phoneIn(""), "");
  assert.deepStrictEqual(["Mark Smith\n310-555-0187\n818-555-0123", "Mark Smith, husband\n(310) 555-0187\n24/7", "(310) 555-0187 (818) 555-0123", "our coach since 2010 310-555-0187", "1 (310) 555-0187"].map(fns.phoneIn), Array(5).fill("13105550187"), "one number, never digits run together from two (the v299 review's catch)");
  assert.deepStrictEqual(["Mark 555-0187", "+1 2", "call 911"].map(fns.phoneIn), ["", "", ""], "nothing callable: no call button");
});

test("the server rule: the client's own record only, every key with the app's limits, a clear by null, and the unit's stamp before it changes", () => {
  for (const s of ["create or replace function client_set_profile(p_client uuid, p_key text, p_value jsonb)", "language plpgsql security definer set search_path = public", "if my_email() = '' then raise exception 'not signed in'; end if;", "lower(coalesce(c.data ->> 'email', '')) = my_email()\n    for update;", "revoke execute on function client_set_profile(uuid, text, jsonb) from public, anon;", "grant execute on function client_set_profile(uuid, text, jsonb) to authenticated;", "select 'client-profile.sql applied' as result;", "raise exception 'bad key';"]) assert.ok(sql.includes(s), s);
  assert.ok(sql.includes("('health.limits', 'health.conditions', 'health.medications', 'health.allergies', 'health.emergency', 'health.doctor')") && sql.includes("length(v_val #>> '{}') <= 500"), "the six texts, 500 characters (the sheet's box)");
  assert.ok(html.includes('id="textField" rows="5" maxlength="500"') && /max: 500/.test(src), "the app keeps to the same 500");
  assert.ok(/between 1 and \(case when v_val ->> 'u' = 'in' then 120 else 300 end\)/.test(sql) && /between 1 and \(case when v_val ->> 'u' = 'lb' then 1500 else 700 end\)/.test(sql), "the measures' ranges");
  assert.ok(/HT = \{ in: \[12, 119\], cm: \[30, 272\] \}, WT = \{ lb: \[20, 700\], kg: \[10, 320\] \}/.test(src), "the wheels stay inside them");
  assert.ok(sql.indexOf("v_old := coalesce(nullif(v_data ->> 'unit', ''), 'lb');") < sql.indexOf("v_data := jsonb_set(v_data, array[p_key], v_val);"), "the stamp first, with the old unit");
  assert.ok(!sql.includes("function client_my_data()"), "the four copies of client_my_data stay four");
});

test("the markup: Settings in cards (the photo kept on top), \"Weights in\" for the client and on the card, the two pages and their sheet in the right places", () => {
  assert.strictEqual(fns.unitLabel(), "Weights in");
  assert.ok(html.includes('<li class="client-only"><div class="srow wrap"><span>Weights in</span><div class="seg" id="meUnitSeg" role="radiogroup" aria-label="Weights in">'), "the client's");
  assert.ok(html.includes('<li><div class="srow wrap"><span>Weights in</span><div class="seg" id="unitSeg" role="radiogroup" aria-label="Weights in">'), "the card's");
  const settings = html.slice(html.indexOf('<section id="vSettings"'), html.indexOf("</section>", html.indexOf('<section id="vSettings"')));
  assert.ok(settings.indexOf('id="meHero"') < settings.indexOf('id="meHealth"') && settings.indexOf('id="meHealth"') < settings.indexOf('id="meSafety"'), "the photo first, then the client's two pages");
  assert.strictEqual((settings.match(/<ul class="list settings-list/g) || []).length, 4, "four cards");
  assert.ok(!html.includes('id="cBirthday"') && !src.includes('$("cBirthday")'), "the Birthday lives in Health details now");
  const main = html.slice(html.indexOf("<main"), html.indexOf("</main>"));
  assert.ok(main.includes('<section id="vHealth" hidden>') && main.includes('<section id="vSafety" hidden>') && !main.includes('id="textSheet"'), "pages in main, the sheet outside it (no picture holds it)");
  const train = html.slice(html.indexOf('<section id="vTraining"'), html.indexOf('<div class="rows" id="rows">'));
  assert.ok(train.includes('id="limitsNote"'), "the note sits before the cards, out of #rows (drawn anew on every rebuild)");
  for (const id of ["vHealth", "vSafety"]) assert.ok(src.includes('"' + id + '"'), id + " is hidden with every other page");
});

test("a US number reads as Apple writes it, \"(310) 555-0142\"; any other stays as typed", () => {
  assert.deepStrictEqual(["3105550142", "13105550142", "310-555-0142", "+44 20 7946 0958", "555-0142", "", null].map(fns.fmtPhone), ["(310) 555-0142", "(310) 555-0142", "(310) 555-0142", "+44 20 7946 0958", "555-0142", "", ""]);
});

test("an exercise begun in lb keeps lb after Weights in kg: last time's numbers are read in its own unit, not the new one", () => {
  const sb = makeSupabase(); clientOn(sb);
  maps.trainings.set("p1", workout("p1", { date: day(-3), completedAt: day(-3) + "T18:00:00.000Z", rows: [logged("100", "lb")] }));
  maps.trainings.set("w1", workout("w1", { rows: [{ ...logged("135", "lb"), done: false, setsDone: 1 }] }));
  maps.clients.get("c1").unit = "kg";
  assert.deepStrictEqual(fns.lastWeights(maps.trainings.get("w1"), maps.trainings.get("w1").rows[0]).weights, ["100"], "begun in lb: 100 lb, not 45.5");
  const fresh = { ...logged("", null), weights: [], repsDone: [], setsDone: 0, done: false };
  assert.deepStrictEqual(fns.lastWeights(maps.trainings.get("w1"), fresh).weights, ["45.5"], "a fresh one in the client's new unit");
  quiet();
});

test("the Health & safety sheet: Add waits for words, Save takes them (trimmed, 500 at most), Save emptied takes them away, Cancel keeps what was there", async () => {
  const H = {};
  for (const id of ["textOk", "textNo"]) { const b = el("button"); b.addEventListener = (t, fn) => { (H[id + t] ||= []).push(fn); }; b.removeEventListener = (t, fn) => { H[id + t] = (H[id + t] || []).filter((f) => f !== fn); }; byId.set(id, b); }
  const press = (id) => { for (const fn of [...(H[id + "click"] || [])]) fn({}); };
  const f = $("textField"); const saved = [];
  try {
    fns.editText({ title: "Allergies", lead: "So your coach knows what to avoid.", value: "", max: 500, onSave: (v) => saved.push(v) });
    assert.deepStrictEqual([$("textSheet").hidden, $("textTitle").textContent, $("textOk").textContent, $("textOk").disabled, app.get().asking], [false, "Allergies", "Add", true, true]);
    f.value = "   "; await tick(400); press("textOk"); assert.deepStrictEqual(saved, [], "no words: Add does nothing");
    f.value = "  Latex " + "x".repeat(600) + "  "; press("textOk");
    assert.strictEqual(saved.length, 1); assert.strictEqual(saved[0].length, 500); assert.ok(saved[0].startsWith("Latex"), "trimmed, cut to the rule's 500");
    assert.deepStrictEqual([$("textSheet").hidden, app.get().asking, (H.textOkclick || []).length], [true, false, 0], "closed, and its listeners gone");
    fns.editText({ title: "Allergies", value: "Latex", max: 500, onSave: (v) => saved.push(v) }); assert.strictEqual($("textOk").textContent, "Save");
    f.value = ""; await tick(400); press("textOk"); assert.strictEqual(saved.at(-1), "", "Save with the box emptied takes it away");
    fns.editText({ title: "Allergies", value: "Latex", max: 500, onSave: (v) => saved.push(v) }); f.value = "Nuts"; await tick(400); press("textNo");
    assert.deepStrictEqual([saved.length, $("textSheet").hidden], [2, true], "Cancel: nothing saved");
  } finally { byId.delete("textOk"); byId.delete("textNo"); app.set({ asking: false }); }
});

test("the coach's save made before the coach's first sync (a relaunch with no signal): the client's own fields stay the server's, except the ones the coach changed", async () => {
  const sb = makeSupabase(); coachOn(sb, { health: { limits: "Knee" } });
  sb.seed("ft_clients", "c1", { id: "c1", name: "Jane Doe", unit: "lb", height: { v: 67, u: "in" }, health: { limits: "Knee", medications: "Inhaler" } });   // the client wrote these on the client's phone; this device never read them
  maps.clients.get("c1").seenNotes = ["n1"]; fns.scheduleSave("clients", "c1", 0); await settle();   // a save of the coach's that touched none of the client's fields
  let saved = sb.tables.ft_clients.get("c1").data;
  assert.deepStrictEqual([saved.height, saved.health, saved.seenNotes], [{ v: 67, u: "in" }, { limits: "Knee", medications: "Inhaler" }, ["n1"]], "the client's kept, the coach's landed");
  const sb2 = makeSupabase(); coachOn(sb2, { health: { limits: "Knee" }, unit: "lb" });
  sb2.seed("ft_clients", "c1", { id: "c1", name: "Jane Doe", unit: "kg", sex: "female", health: { limits: "Knee", medications: "Inhaler" } });
  fns.setProfile("c1", "health.limits", "Left knee: no lunges"); await settle();
  saved = sb2.tables.ft_clients.get("c1").data;
  assert.deepStrictEqual([saved.health, saved.unit, saved.sex], [{ limits: "Left knee: no lunges", medications: "Inhaler" }, "kg", "female"], "the coach's limits, the client's medications, the client's unit and sex");
  assert.strictEqual(maps.profileTouched.has("c1"), false, "the coach's marks go once the save landed");
});

test("the client's workouts are read in each answer's own unit: a copy that did not change is not drawn again while the client's kg waits, and a read from before the client's switch never shows lb as kg", async () => {
  const sb = makeSupabase(); clientOn(sb); let unitNow = "lb"; const hold = { on: false, release: null };
  const old = () => workout("p1", { date: day(-3), completedAt: day(-3) + "T18:00:00.000Z", rows: [logged("135")] });
  sb.rpcs.client_my_data = async () => { const snap = { clients: [{ id: "c1", data: { name: "Jane Doe", unit: unitNow, email: "jane@x.com" } }], trainings: [{ id: "p1", data: old() }, { id: "w1", data: workout("w1") }] }; if (hold.on) await new Promise((r) => { hold.release = r; }); return snap; };
  await fns.syncDownNow(); await settle(); assert.strictEqual(maps.trainings.get("p1").rows[0].unit, "lb", "stamped with the unit read with it");
  fns.setLiftUnit("c1", "kg"); await settle(); assert.strictEqual(app.get().profileMissing, true, "the client's rule not run yet: kg waits");
  app.set({ view: { name: "training", id: "w1" }, renderedTraining: "w1" });
  await fns.syncDownNow(); await settle(); assert.strictEqual(app.get().renderedTraining, "w1", "nothing changed: the client's open workout is not drawn again under the client's finger");
  assert.strictEqual(maps.trainings.get("p1").rows[0].unit, "lb");
  hold.on = true; const late = fns.syncDownNow(); await tick(5); unitNow = "kg"; hold.on = false; hold.release(); await late; await settle();   // read before the client's rule ran (lb), answered after
  assert.strictEqual(maps.trainings.get("p1").rows[0].unit, "lb", "the older read still reads 135 as lb");
  app.set({ view: { name: "client", id: "c1" }, renderedTraining: null }); quiet();
});
