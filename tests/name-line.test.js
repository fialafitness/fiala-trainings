// v315, the owner's ask (17 Nov 2026): "maybe under clients name I can have their age and location ? in the way apple would do it", then, after the
// pictures, "build it" (picks: age · city · the client's day and time; the city from the phone's time zone). One grey line under a client's name, in the
// coach's view only: "34 years old · Tokyo · Tue 3:00 AM". The client's phone reports its time zone (client_set_zone); the coach's saves keep the server's copy.
import { test, assert, tick } from "./assert.js";
import { makeSupabase } from "./fake-supabase.js";
import { load } from "./load.js";
import { resetState } from "../app/state.js";
import { clientLine, zoneCity, sameClock, agoWords, validateBackup, hereZone, setsOf, loggedSets } from "../app/model.js";
const app = await load();
const { fns, maps } = app;
const $ = (id) => document.getElementById(id);
const LA = "America/Los_Angeles", NOW = Date.parse("2026-11-23T18:00:00.000Z"), TODAY = "2026-11-23";   // Monday 10 am in Los Angeles is Tuesday 3 am in Tokyo
const hoursAgo = (h, now = NOW) => new Date(now - h * 3600e3).toISOString();
const line = (c, here = LA) => clientLine(c, NOW, here, TODAY).parts.join(" · ");
const clock = (zone, now = NOW) => new Date(now).toLocaleString(undefined, { weekday: "short", hour: "numeric", minute: "2-digit", timeZone: zone });   // as the page writes it (en-US: "Tue 3:00 AM")
const settle = async () => { const until = Date.now() + 15000; do await tick(5); while ((app.get().inflight > 0 || maps.timers.size) && Date.now() < until); };

test("the line: age · city · the client's day and time, while their clock differs from this one", () => {
  const r = clientLine({ birthday: "1992-05-10", zone: { zone: "Asia/Tokyo", at: hoursAgo(0.5) } }, NOW, LA, TODAY);
  assert.deepStrictEqual(r.parts, ["34 years old", "Tokyo", clock("Asia/Tokyo")]); assert.strictEqual(r.live, true, "a clock: kept current while the page is up");
  assert.ok(/^Tue 3:00\sAM$/.test(clock("Asia/Tokyo")), "(Tuesday 3 am in Tokyo: " + clock("Asia/Tokyo") + ")");
  assert.strictEqual(line({ birthday: "1992-05-10", zone: { zone: LA, at: hoursAgo(0.5) } }), "34 years old · Los Angeles", "back home, the coach's own clock: no time");
  assert.strictEqual(line({ birthday: "1992-05-10", zone: { zone: "America/Tijuana", at: hoursAgo(0.5) } }), "34 years old · Tijuana", "another city on the same clock: no time either");
  assert.strictEqual(line({ zone: { zone: "Asia/Tokyo", at: hoursAgo(0.5) } }), "Tokyo · " + clock("Asia/Tokyo"), "no birthday saved: the age is left out");
  assert.strictEqual(line({ birthday: "1992-05-10" }), "34 years old", "no time zone reported yet: the age alone");
  assert.deepStrictEqual(clientLine({}, NOW, LA, TODAY).parts, [], "nothing known: no line");
  assert.deepStrictEqual(clientLine(null, NOW, LA, TODAY).parts, []);
  assert.strictEqual(line({ birthday: "2025-10-01" }), "1 year old"); assert.strictEqual(line({ birthday: "1992-11-23" }), "34 years old", "a birthday today counts"); assert.strictEqual(line({ birthday: "1992-11-24" }), "33 years old");
  assert.strictEqual(line({ birthday: "2030-01-01" }), "", "a birthday ahead: no age");
});

test("a report more than a day old: how long ago instead of the time, as Find My does; on the coach's own clock, nothing", () => {
  const T2 = fns.today(), N2 = Date.parse(T2 + "T12:00:00");            // noon on this computer's own day: the days below count the same on every computer, and a clock change of an hour either way never moves a report across a midnight (at 11 pm the 25-hour day of the autumn change read 3 days back as 2: the check round)
  const s = (h, zone = "Asia/Tokyo") => clientLine({ zone: { zone, at: new Date(N2 - h * 3600e3).toISOString() } }, N2, LA, T2);
  const words = (h, zone) => s(h, zone).parts.join(" · "), tk = (now) => clock("Asia/Tokyo", now);
  assert.strictEqual(words(23), "Tokyo · " + tk(N2), "23 hours: still the time");
  assert.strictEqual(words(30), "Tokyo · Yesterday");
  assert.strictEqual(words(72), "Tokyo · 3 days ago");
  assert.strictEqual(words(20 * 24), "Tokyo · 3 weeks ago");
  assert.strictEqual(words(90 * 24), "Tokyo · 3 months ago");
  assert.strictEqual(s(72).live, false, "no clock to keep current");
  assert.strictEqual(words(72, LA), "Los Angeles", "on the coach's own clock there is no time to replace");
  assert.strictEqual(agoWords(Date.parse("2026-11-21T12:00:00"), "2026-11-23"), "2 days ago");
});

test("a zone with no city is named by its offset; a zone this device does not know, or a broken report, is left out", () => {
  assert.strictEqual(zoneCity("Asia/Tokyo"), "Tokyo"); assert.strictEqual(zoneCity("America/Los_Angeles"), "Los Angeles"); assert.strictEqual(zoneCity("America/Argentina/Buenos_Aires"), "Buenos Aires");
  assert.strictEqual(zoneCity("America/Port-au-Prince"), "Port-au-Prince"); assert.strictEqual(zoneCity("Etc/GMT-9"), ""); assert.strictEqual(zoneCity("US/Pacific"), ""); assert.strictEqual(zoneCity("UTC"), "");
  assert.deepStrictEqual(["Asia/Calcutta", "Europe/Kiev", "Asia/Saigon", "America/Godthab", "America/Coral_Harbour", "Pacific/Enderbury", "America/Buenos_Aires", "Asia/Kolkata", "Europe/Kyiv"].map(zoneCity), ["Kolkata", "Kyiv", "Ho Chi Minh", "Nuuk", "Atikokan", "Kanton", "Buenos Aires", "Kolkata", "Kyiv"], "Chrome and Android's old names read as Apple writes the city (Coral Harbour is another town: Atikokan's clock)");
  assert.strictEqual(line({ zone: { zone: "Etc/GMT-9", at: hoursAgo(1) } }), "GMT+9 · " + clock("Etc/GMT-9"), "Etc/GMT-9 is nine hours ahead of UTC: GMT+9");
  assert.strictEqual(line({ birthday: "1992-05-10", zone: { zone: "Mars/Olympus_Mons", at: hoursAgo(1) } }), "34 years old");
  assert.strictEqual(line({ birthday: "1992-05-10", zone: { zone: "Asia/Tokyo", at: "not a time" } }), "34 years old");
  assert.strictEqual(line({ birthday: "1992-05-10", zone: "Asia/Tokyo" }), "34 years old", "not a report at all");
  assert.strictEqual(sameClock("Asia/Tokyo", "Asia/Seoul", NOW), true); assert.strictEqual(sameClock("Asia/Tokyo", LA, NOW), false); assert.strictEqual(sameClock("Mars/Olympus_Mons", "Mars/Olympus_Mons", NOW), false);
});

test("the page: the line under the name in the coach's view; never on the client's own page or a templates page", () => {
  const now = Date.now(), here = hereZone(), far = ["Pacific/Kiritimati", "Pacific/Pago_Pago"].find((z) => !sameClock(z, here, now));   // a zone whose clock differs from this computer's now
  const c = { id: "c1", name: "Jane Doe", unit: "lb", birthday: (+fns.today().slice(0, 4) - 34) + "-01-01", zone: { zone: far, at: new Date(now - 600e3).toISOString() } };   // 34 on every day of the year (a fixed birthday failed the suite from that day on: the check round)
  app.reset(); app.set({ signedIn: true, clientMode: false, view: { name: "client", id: "c1" }, tab: "workouts" }); maps.clients.set("c1", c); fns.render();
  const parts = clientLine(c, Date.now(), here, fns.today()).parts, want = parts.map((p) => p.replace(/ /g, "\u00a0").replace(/-/g, "\u2011")).join("\u00a0\u00b7 "), text = $("cSub").textContent;
  assert.strictEqual($("cSub").hidden, false, "shown"); assert.strictEqual(text, want, "age · city · their time (" + parts.join(" · ") + ")"); assert.strictEqual(parts[0], "34 years old"); assert.strictEqual(parts.length, 3);
  assert.deepStrictEqual(text.split(" ").map((x) => x.slice(-1)).slice(0, -1), ["\u00b7", "\u00b7"], "the line can wrap only after a dot: a part never splits (\"Mon 8:00\" then \"PM\" alone) and no line starts with one");
  assert.ok(text.split(" ").every((x) => !x.startsWith("\u00b7")), "no line starts with a dot");
  maps.clients.set("c1", { ...c, zone: { zone: "America/Port-au-Prince", at: new Date(now - 600e3).toISOString() } }); fns.render();
  assert.ok($("cSub").textContent.includes("Port\u2011au\u2011Prince") && !/-/.test($("cSub").textContent), "a city with hyphens never breaks at one (\"Port-au-\" then \"Prince\": the final check): no-break hyphens");
  maps.clients.set("c1", { id: "c1", name: "Jane Doe", unit: "lb" }); fns.render();
  assert.strictEqual($("cSub").hidden, true, "nothing known: no line"); assert.strictEqual($("cSub").textContent, "");
  app.reset(); app.set({ signedIn: true, clientMode: true, myClientId: "c1", view: { name: "client", id: "c1" }, tab: "workouts" }); maps.clients.set("c1", c); fns.render();
  assert.strictEqual($("cSub").hidden, true, "the client's own page: no line");
  const TID = "00000000-0000-4000-8000-0000000000f1";
  app.reset(); app.set({ signedIn: true, clientMode: false, view: { name: "client", id: TID }, tab: "workouts" }); maps.clients.set(TID, { id: TID, name: "Templates", unit: "lb", birthday: "1992-05-10" }); fns.render();
  assert.strictEqual($("cSub").hidden, true, "the templates page: no line");
  app.reset();
});

test("the client's phone reports its time zone when it syncs: when it changed, or every 30 minutes; a rule not installed yet is asked no more until a reload", async () => {
  const sb = makeSupabase(), calls = []; let me = { name: "Jane Doe", unit: "lb", email: "jane@x.com" };
  app.reset(); app.set({ sb, signedIn: true, clientMode: true, myClientId: "c1", backend: fns.clientBackend, sessionEmail: "jane@x.com", view: { name: "client", id: "c1" } }); maps.clients.set("c1", { id: "c1", ...me });
  sb.rpcs.client_my_data = async () => ({ clients: [{ id: "c1", data: me }], trainings: [] });
  sb.rpcs.client_set_zone = async (a) => { calls.push(a); return null; };
  await fns.syncDownNow(); await settle();
  assert.deepStrictEqual(calls, [{ p_client: "c1", p_zone: hereZone() }], "none on record: sent, with this phone's zone");
  me = { ...me, zone: { zone: hereZone(), at: new Date(Date.now() - 5 * 60e3).toISOString() } }; await fns.syncDownNow(); await settle();
  assert.strictEqual(calls.length, 1, "the same zone, 5 minutes old: not sent again");
  me = { ...me, zone: { zone: hereZone(), at: new Date(Date.now() - 40 * 60e3).toISOString() } }; await fns.syncDownNow(); await settle();
  assert.strictEqual(calls.length, 2, "40 minutes old: sent again, so the coach can tell it is fresh");
  me = { ...me, zone: { zone: "Mars/Olympus_Mons", at: new Date().toISOString() } }; await fns.syncDownNow(); await settle();
  assert.strictEqual(calls.length, 3, "another zone on record (the phone moved): sent");
  sb.rpcs.client_set_zone = async (a) => { calls.push(a); const e = new Error("Could not find the function"); e.code = "PGRST202"; throw e; };
  me = { ...me, zone: undefined }; await fns.syncDownNow(); await settle();
  assert.strictEqual(app.get().zoneSetMissing, true, "client-zone.sql not run: noted"); const n = calls.length;
  await fns.syncDownNow(); await settle(); assert.strictEqual(calls.length, n, "and not asked again until a reload");
  app.reset();
});

test("the coach's saves keep the time zone the client's phone reported: the server's copy, with or without a copy read to merge against", async () => {
  const report = { zone: "Asia/Tokyo", at: "2026-11-23T17:30:00.000Z" };
  for (const read of [true, false]) {
    const sb = makeSupabase(); app.reset(); app.set({ sb, signedIn: true, clientMode: false, backend: fns.cloudBackend });
    sb.seed("ft_clients", "c1", { id: "c1", name: "Jane", unit: "lb", zone: report });
    if (read) maps.seenAt.set("clients/c1", "S0");                       // this device last saw an older copy, before the phone's report
    const local = { id: "c1", name: "Jane Doe", unit: "lb", zone: { zone: "America/Los_Angeles", at: "2026-11-01T10:00:00.000Z" } }; maps.clients.set("c1", local);
    await fns.cloudBackend.set("clients", "c1", JSON.parse(JSON.stringify(local)));
    const saved = sb.tables.ft_clients.get("c1").data;
    assert.deepStrictEqual([saved.name, saved.zone], ["Jane Doe", report], (read ? "a conflict" : "nothing read yet") + ": the coach's rename lands, the phone's report stands");
    assert.deepStrictEqual(maps.clients.get("c1").zone, report, "and the page reads it");
    await settle();
  }
  app.reset();
});

test("Chrome and Android name 19 zones by their old names: the phone reports the current one, as an iPhone does, so a client's two devices never take turns rewriting it", async () => {
  const RO = Intl.DateTimeFormat.prototype.resolvedOptions; let engine = "Asia/Calcutta";
  Intl.DateTimeFormat.prototype.resolvedOptions = function () { return { ...RO.call(this), timeZone: engine }; };   // this computer's engine, saying what Chrome 157 says in India
  try {
    assert.strictEqual(hereZone(), "Asia/Kolkata");
    engine = "Europe/Kiev"; assert.strictEqual(hereZone(), "Europe/Kyiv"); engine = "America/Coral_Harbour"; assert.strictEqual(hereZone(), "America/Atikokan");
    engine = "Asia/Tokyo"; assert.strictEqual(hereZone(), "Asia/Tokyo", "a current name stays as it is"); engine = "Etc/Unknown"; assert.strictEqual(hereZone(), "", "a name no clock can use: none");
    engine = "Asia/Calcutta";
    const sb = makeSupabase(), calls = [], me = { name: "Jane Doe", unit: "lb", email: "jane@x.com", zone: { zone: "Asia/Kolkata", at: new Date(Date.now() - 5 * 60e3).toISOString() } };   // the client's iPhone reported 5 minutes ago
    app.reset(); app.set({ sb, signedIn: true, clientMode: true, myClientId: "c1", backend: fns.clientBackend, sessionEmail: "jane@x.com", view: { name: "client", id: "c1" } }); maps.clients.set("c1", { id: "c1", ...me });
    sb.rpcs.client_my_data = async () => ({ clients: [{ id: "c1", data: me }], trainings: [] });
    sb.rpcs.client_set_zone = async (a) => { calls.push(a); return null; };
    await fns.syncDownNow(); await settle();
    assert.deepStrictEqual(calls, [], "the client's Chrome laptop in the same place: nothing sent (it sent Asia/Calcutta at every sync, and the iPhone Asia/Kolkata back)");
  } finally { Intl.DateTimeFormat.prototype.resolvedOptions = RO; app.reset(); }
});

test("a restore keeps the time zone the client's phone reported: the one here (the server's, after a conflict), never the file's; a difference in it alone is no change", async () => {
  const C = "1b4e28ba-2fa1-41d2-883f-0016d3cca427", phone = { zone: "Asia/Tokyo", at: new Date(Date.now() - 600e3).toISOString() }, old = { zone: LA, at: "2026-11-01T10:00:00.000Z" };
  const file = (rec) => ({ app: "fiala-trainings", format: 1, clients: { [C]: { id: C, ...rec } }, trainings: {} });
  for (const how of ["stamp", "conflict", "no stamp"]) {
    const sb = makeSupabase(); app.reset(); app.set({ sb, signedIn: true, clientMode: false, backend: fns.cloudBackend });
    const stamp = sb.seed("ft_clients", C, { id: C, name: "Jane", unit: "lb", zone: phone }); maps.clients.set(C, { id: C, name: "Jane", unit: "lb", zone: JSON.parse(JSON.stringify(phone)) });
    if (how !== "no stamp") maps.seenAt.set("clients/" + C, stamp);
    if (how === "stamp") { assert.strictEqual(fns.planRestore(file({ name: "Jane", unit: "lb", zone: old })).text, "", "a backup older than the phone's last report: nothing to do, nothing to say"); assert.strictEqual(fns.planRestore(file({ name: "Jane", unit: "lb" })).text, "", "nor from a backup made before v315"); }
    const plan = fns.planRestore(file({ name: "Jane D.", unit: "lb", ...(how === "conflict" ? {} : { zone: old }) }));   // a real change: the name
    assert.deepStrictEqual(plan.cs.map((c) => c.zone), [phone], how + ": the restored client carries the report here");
    let now = phone;
    if (how !== "stamp") { now = { zone: "Asia/Seoul", at: new Date().toISOString() }; const r = sb.tables.ft_clients.get(C); r.data.zone = now; r.updated_at = "2099-01-01T00:00:00Z"; }   // the phone reported again after this device last read (with no stamp the save reads the server first)
    fns.applyRestore(plan); await settle();
    const saved = sb.tables.ft_clients.get(C).data;
    assert.deepStrictEqual([saved.name, saved.zone], ["Jane D.", now], how + ": the file's name lands, the phone's report stands");
    assert.deepStrictEqual(maps.clients.get(C).zone, now, how + ": and the page reads it");
  }
  app.reset();
});

test("a restore takes the zone here as Restore is tapped: after a sync under the question, for a client that sync brought in, for a client deleted here whose deletion is still queued, and with none here", async () => {
  const C = "1b4e28ba-2fa1-41d2-883f-0016d3cca427", dev = { zone: LA, at: new Date(Date.now() - 3 * 864e5).toISOString() }, phone = { zone: "Asia/Tokyo", at: new Date(Date.now() - 60e3).toISOString() }, old = { zone: "America/Denver", at: "2026-11-01T10:00:00.000Z" };
  const file = (rec) => ({ app: "fiala-trainings", format: 1, clients: { [C]: { id: C, ...rec } }, trainings: {} });
  const fresh = () => { const sb = makeSupabase(); app.reset(); app.set({ sb, signedIn: true, clientMode: false, backend: fns.cloudBackend }); return sb; };
  const after = (sb) => { const d = sb.tables.ft_clients.get(C).data; return [d.name, d.zone, maps.clients.get(C).zone]; };
  let sb = fresh(); sb.seed("ft_clients", C, { id: C, name: "Jane", unit: "lb", zone: dev }); await fns.syncDownNow(); await settle();
  { const r = sb.tables.ft_clients.get(C); r.data = { ...r.data, zone: phone }; r.updated_at = "2099-01-01T00:00:00Z"; }   // the phone reports: the server's stamp moves
  let plan = fns.planRestore(file({ name: "Jane D.", unit: "lb", zone: old }));
  await fns.syncDownNow(); await settle();                                // a sync answers while the question is up (the minute's timer, the window's focus back from the file picker): the report comes here with its stamp
  fns.applyRestore(plan); await settle();
  assert.deepStrictEqual(after(sb), ["Jane D.", phone, phone], "a sync under the question: the report it brought stands (the question's copy was older)");
  sb = fresh(); sb.seed("ft_clients", C, { id: C, name: "Jane", unit: "lb", zone: phone });
  plan = fns.planRestore(file({ name: "Jane D.", unit: "lb", zone: old })); await fns.syncDownNow(); await settle();   // not here as the question opens (a device's first sync still out); that sync brings the client in
  fns.applyRestore(plan); await settle();
  assert.deepStrictEqual(after(sb), ["Jane D.", phone, phone], "a client brought in under the question: the same");
  sb = fresh(); sb.seed("ft_clients", C, { id: C, name: "Jane", unit: "lb" });
  plan = fns.planRestore(file({ name: "Jane D.", unit: "lb", zone: old })); await fns.syncDownNow(); await settle(); fns.applyRestore(plan); await settle();
  assert.deepStrictEqual(after(sb), ["Jane D.", undefined, undefined], "a client brought in under the question, whose phone never reported: the file's old report is not written either");
  sb = fresh(); sb.seed("ft_clients", C, { id: C, name: "Jane", unit: "lb", zone: phone }); await fns.syncDownNow(); await settle();
  navigator.onLine = false; sb.setFail({ times: 9999, message: "Failed to fetch" });
  try { maps.clients.delete(C); fns.scheduleSave("clients", C, 0); await settle(); fns.applyRestore(fns.planRestore(file({ name: "Jane", unit: "lb" }))); await settle(); }   // deleted here with no signal (as Delete client does), restored from a backup made before v315
  finally { navigator.onLine = true; sb.setFail(null); }
  await fns.syncDownNow(); await settle();                                // the signal back
  assert.deepStrictEqual(after(sb), ["Jane", phone, phone], "deleted here, its deletion still queued, then restored: the phone's report stands");
  sb = fresh(); { const stamp = sb.seed("ft_clients", C, { id: C, name: "Jane", unit: "lb" }); maps.clients.set(C, { id: C, name: "Jane", unit: "lb" }); maps.seenAt.set("clients/" + C, stamp); }
  assert.strictEqual(fns.planRestore(file({ name: "Jane", unit: "lb", zone: old })).text, "", "no report here: the file's alone is no change");
  fns.applyRestore(fns.planRestore(file({ name: "Jane D.", unit: "lb", zone: old }))); await settle();
  assert.deepStrictEqual(after(sb), ["Jane D.", undefined, undefined], "no report here: the file's name lands, its old report does not");
  app.reset();
});

test("Delete client with the answers lost, then Restore: the client comes back with its workouts and the phone's report (a record not here keeps no stamp, so it is never taken for a deletion made elsewhere)", async () => {
  const C = "1b4e28ba-2fa1-41d2-883f-0016d3cca427", T1 = "2b4e28ba-2fa1-41d2-883f-0016d3cca427", T2 = "3b4e28ba-2fa1-41d2-883f-0016d3cca427", phone = { zone: "Asia/Tokyo", at: new Date(Date.now() - 60e3).toISOString() };
  const wk = (id, date) => ({ id, clientId: C, date, title: "Legs", rows: [{ id: "r1", name: "Squat", label: "1", sets: 3, reps: "10", weights: ["100", "100", "100"], done: true }] }), copy = (x) => JSON.parse(JSON.stringify(x));
  const sb = makeSupabase(); app.reset(); app.set({ sb, signedIn: true, clientMode: false, backend: fns.cloudBackend });
  sb.seed("ft_clients", C, { id: C, name: "Jane", unit: "lb", zone: phone }); sb.seed("ft_trainings", T1, wk(T1, "2026-11-10"), { client_id: C }); sb.seed("ft_trainings", T2, wk(T2, "2026-11-12"), { client_id: C });
  await fns.syncDownNow(); await settle();
  const backup = { app: "fiala-trainings", format: 1, clients: { [C]: copy({ ...maps.clients.get(C), zone: { zone: LA, at: "2026-11-01T10:00:00.000Z" } }) }, trainings: { [T1]: copy(maps.trainings.get(T1)), [T2]: copy(maps.trainings.get(T2)) } };   // Settings → Back up, made when the client was home
  const realFrom = sb.from;
  try {
    sb.from = (table) => { const b = realFrom(table), del = b.delete; b.delete = () => { del(); const go = b.then; b.then = (res, rej) => go(() => res({ data: null, error: { message: "network timeout" } }), rej); return b; }; return b; };   // one bar of signal: each deletion reaches the server, its answer never comes back
    for (const id of [T1, T2]) { maps.trainings.delete(id); fns.scheduleSave("trainings", id, 0); } maps.clients.delete(C); fns.scheduleSave("clients", C, 0); await settle();   // as Delete client does
    sb.from = realFrom; navigator.onLine = false; sb.setFail({ times: 99999, message: "Failed to fetch" });   // still no signal: the restore's writes wait
    assert.deepStrictEqual([sb.tables.ft_clients.has(C), sb.tables.ft_trainings.has(T1), ["clients/" + C, "trainings/" + T1].every((k) => maps.seenAt.has(k))], [false, false, true], "gone from the server, the stamps kept here (the answers were lost)");
    fns.applyRestore(fns.planRestore(backup)); await settle();
  } finally { sb.from = realFrom; navigator.onLine = true; sb.setFail(null); }
  await fns.syncDownNow(); await settle();                                // the signal back
  assert.deepStrictEqual([sb.tables.ft_clients.has(C), sb.tables.ft_trainings.has(T1), sb.tables.ft_trainings.has(T2), maps.trainings.has(T1), maps.trainings.has(T2)], [true, true, true, true, true], "the client and the workouts the same restore put back land together (the workouts were dropped as if deleted on another device: the third round)");
  assert.deepStrictEqual(sb.tables.ft_clients.get(C).data.zone, { zone: LA, at: "2026-11-01T10:00:00.000Z" }, "with the server holding no report any more, the file's is the only one left");
  app.reset();
});

test("a workout deleted here, then restored: the backup's copy comes back whole with or without signal, never mixed with the deleted copy", async () => {
  const C = "1b4e28ba-2fa1-41d2-883f-0016d3cca427", T1 = "2b4e28ba-2fa1-41d2-883f-0016d3cca427", copy = (x) => JSON.parse(JSON.stringify(x));
  const sum = (d) => d && [d.date, d.skippedAt || null, d.skipReason || null, d.rows.map((r) => r.name + " " + r.sets + "x" + r.reps + " " + JSON.stringify(r.alts || []) + " " + (r.weights || []).length)];
  for (const how of ["signal", "no signal", "no signal, the client logging on the deleted copy"]) {
    const sb = makeSupabase(); app.reset(); app.set({ sb, signedIn: true, clientMode: false, backend: fns.cloudBackend });
    sb.seed("ft_clients", C, { id: C, name: "Jane", unit: "lb" });
    sb.seed("ft_trainings", T1, { id: T1, clientId: C, date: "2026-11-24", title: "Legs", rows: [{ id: "r1", name: "Back squat", label: "1", sets: 3, reps: "10", weights: [], done: false }, { id: "r2", name: "Leg press", label: "2", sets: 3, reps: "12", weights: [], done: false }] }, { client_id: C });
    await fns.syncDownNow(); await settle();
    const backup = { app: "fiala-trainings", format: 1, clients: {}, trainings: { [T1]: copy(maps.trainings.get(T1)) } }, want = sum(backup.trainings[T1]);
    const t = maps.trainings.get(T1); t.rows[0].name = "Front squat"; t.rows[0].alts = ["Goblet squat"]; t.rows[0].reps = "6"; t.date = "2026-11-26"; t.skippedAt = "2026-11-18T10:00:00.000Z"; t.skipReason = "Travel";
    fns.touchState(T1, "date", "skippedAt", "skipReason"); fns.scheduleSave("trainings", T1, 0); await settle();   // later the coach reworks it and skips it: all of it saves
    if (how.includes("logging")) { const r = sb.tables.ft_trainings.get(T1), x = r.data.rows[0]; x.sets = 5; x.weights = ["100", "105", "110", "115", "120"]; x.repsDone = ["10", "10", "8", "8", "6"]; x.setsDone = 5; x.done = true; r.updated_at = "2099-01-01T00:00:00Z"; }   // after this device last read it
    try {
      if (how !== "signal") { navigator.onLine = false; sb.setFail({ times: 99999, message: "Failed to fetch" }); }
      maps.trainings.delete(T1); fns.scheduleSave("trainings", T1, 0); await settle();   // Delete: with no signal it waits in the queue, the server still holding the deleted copy
      fns.applyRestore(fns.planRestore(backup)); await settle();
    } finally { navigator.onLine = true; sb.setFail(null); }
    await fns.syncDownNow(); await settle();                              // the signal back
    const saved = sb.tables.ft_trainings.get(T1).data;
    assert.deepStrictEqual(sum(saved), want, how + ": the backup's copy on the server (it came back mixed: the deleted copy's day, skip and swapped exercise, the fourth round)");
    assert.deepStrictEqual(sum(maps.trainings.get(T1)), want, how + ": and here");
    assert.ok(saved.rows.every((r) => setsOf(r) >= loggedSets(r)), how + ": no exercise holds more logged sets than it has");
  }
  app.reset();
});

test("a restored workout this device holds a stamp for but no longer has (a sign-out keeps the stamps) is written again, never taken for a deletion made on another device", async () => {
  const C = "1b4e28ba-2fa1-41d2-883f-0016d3cca427", T1 = "2b4e28ba-2fa1-41d2-883f-0016d3cca427", K = "trainings/" + T1;
  const sb = makeSupabase(); app.reset(); app.set({ sb, signedIn: true, clientMode: false, backend: fns.cloudBackend });
  sb.seed("ft_clients", C, { id: C, name: "Jane", unit: "lb" }); sb.seed("ft_trainings", T1, { id: T1, clientId: C, date: "2026-11-24", title: "Legs", rows: [{ id: "r1", name: "Back squat", label: "1", sets: 3, reps: "10", weights: [], done: false }] }, { client_id: C });
  await fns.syncDownNow(); await settle();
  const backup = { app: "fiala-trainings", format: 1, clients: {}, trainings: { [T1]: JSON.parse(JSON.stringify(maps.trainings.get(T1))) } };
  maps.trainings.delete(T1); sb.tables.ft_trainings.delete(T1);           // signed out (the records go, the stamps stay), then deleted on another device before the next sign-in here
  assert.deepStrictEqual([maps.seenAt.has(K), maps.seenDoc.has(K), maps.dirty.has(K)], [true, true, false], "a stamp and a copy read left behind, nothing queued");
  fns.applyRestore(fns.planRestore(backup)); await settle();
  assert.deepStrictEqual([sb.tables.ft_trainings.has(T1), maps.trainings.has(T1)], [true, true], "the restore lands (with the stamp it was dropped as deleted elsewhere: the fourth round)");
  app.reset();
});

test("a restore's own write lands with its answer lost, after a deletion whose answer was lost too; the client logs on the restored workout: the next send keeps those sets, as with signal (in the same session and after a relaunch)", async () => {
  const C = "1b4e28ba-2fa1-41d2-883f-0016d3cca427", T1 = "2b4e28ba-2fa1-41d2-883f-0016d3cca427", copy = (x) => JSON.parse(JSON.stringify(x));
  const lose = (sb, ops) => { const realFrom = sb.from; sb.from = (table) => { const b = realFrom(table); for (const op of ops) { const o = b[op]; b[op] = (...a) => { o(...a); const go = b.then; b.then = (res, rej) => go(() => res({ data: null, error: { message: "network timeout" } }), rej); return b; }; } return b; }; return () => { sb.from = realFrom; }; };   // one bar of signal: the request lands, its answer never comes back
  const relaunch = (sb) => { const q = localStorage.getItem("fiala.pending.v1"), dev = localStorage.getItem("fiala.trainings.v1"); for (const tm of maps.timers.values()) clearTimeout(tm); resetState(); maps.seenDoc.clear(); localStorage.clear(); if (q) localStorage.setItem("fiala.pending.v1", q); if (dev) localStorage.setItem("fiala.trainings.v1", dev); fns.localBackend.load(); fns.restorePending(); app.set({ sb, signedIn: true, clientMode: false, backend: fns.cloudBackend }); };   // only the device copy and the queue are left
  for (const reopen of [false, true]) {
    const sb = makeSupabase(); app.reset(); app.set({ sb, signedIn: true, clientMode: false, backend: fns.cloudBackend });
    sb.seed("ft_clients", C, { id: C, name: "Jane", unit: "lb" }); sb.seed("ft_trainings", T1, { id: T1, clientId: C, date: "2026-11-24", title: "Legs", rows: [{ id: "r1", name: "Back squat", label: "1", sets: 3, reps: "10", weights: [], done: false }] }, { client_id: C });
    await fns.syncDownNow(); await settle();
    const backup = { app: "fiala-trainings", format: 1, clients: {}, trainings: { [T1]: { ...copy(maps.trainings.get(T1)), title: "From the file" } } };
    let back = lose(sb, ["delete"]);
    try { maps.trainings.delete(T1); fns.scheduleSave("trainings", T1, 0); await settle(); } finally { back(); }   // Delete: it lands, its answer is lost
    const plan = fns.planRestore(copy(backup)); back = lose(sb, ["upsert", "update"]);
    try { fns.applyRestore(plan); await settle(); } finally { back(); }  // Restore: its write lands, its answer is lost
    assert.strictEqual(sb.tables.ft_trainings.get(T1).data.title, "From the file", "the restore's write is on the server");
    { const r = sb.tables.ft_trainings.get(T1), x = r.data.rows[0]; x.weights = ["135", "135", "135"]; x.repsDone = ["10", "10", "9"]; x.setsDone = 3; x.done = true; x.logSeq = (parseInt(x.logSeq, 10) || 0) + 1; r.updated_at = "2099-01-01T00:00:00Z"; }   // the client trains on it
    if (reopen) relaunch(sb);
    await fns.syncDownNow(); await settle();
    const saved = sb.tables.ft_trainings.get(T1).data;
    assert.deepStrictEqual([saved.title, saved.rows[0].weights], ["From the file", ["135", "135", "135"]], (reopen ? "after a relaunch" : "in the same session") + ": the client's sets kept (the send again went whole over them: the fifth round)");
    assert.deepStrictEqual([maps.dirty.size, maps.fromFile.size], [0, 0], "nothing left queued");
  }
  app.reset();
});

test("an earlier save still out when Restore is tapped, finding no copy on the server, leaves the restore's marker: the restore's own write goes whole, over sets logged on that earlier copy", async () => {
  const C = "1b4e28ba-2fa1-41d2-883f-0016d3cca427", T1 = "2b4e28ba-2fa1-41d2-883f-0016d3cca427", K = "trainings/" + T1, copy = (x) => JSON.parse(JSON.stringify(x));
  const sb = makeSupabase(); app.reset(); app.set({ sb, signedIn: true, clientMode: false, backend: fns.cloudBackend });
  sb.seed("ft_clients", C, { id: C, name: "Jane", unit: "lb" }); await fns.syncDownNow(); await settle();
  const file = { id: T1, clientId: C, date: "2026-11-24", title: "From the file", rows: [{ id: "r1", name: "Back squat", label: "1", sets: 3, reps: "10", weights: [], done: false }] };
  maps.trainings.set(T1, { ...copy(file), title: "Made here" }); sb.delayMs = 40; fns.scheduleSave("trainings", T1, 0); await tick(10);   // made here, never sent: its save is out, reading the server first
  fns.applyRestore(fns.planRestore({ app: "fiala-trainings", format: 1, clients: {}, trainings: { [T1]: copy(file) } }));
  const until = Date.now() + 5000; while (!sb.tables.ft_trainings.has(T1) && Date.now() < until) await tick(1);   // the earlier save landed
  assert.ok(maps.fromFile.has(K), "the marker stays through the earlier save (only the restore's own write may drop it)");
  { const r = sb.tables.ft_trainings.get(T1); r.data.rows[0].weights = ["135", "135"]; r.updated_at = "2099-01-01T00:00:00Z"; }   // the client logs on the earlier copy
  sb.delayMs = 0; await settle();
  const saved = sb.tables.ft_trainings.get(T1).data;
  assert.deepStrictEqual([saved.title, saved.rows[0].weights], ["From the file", []], "the restore's write carries the file's copy whole");
  app.reset();
});

test("the app closed while a restore's own write is out (it lands; the deletion before it landed with its answer lost): reopened after the client logged on it, the next send keeps the sets", async () => {
  const C = "1b4e28ba-2fa1-41d2-883f-0016d3cca427", T1 = "2b4e28ba-2fa1-41d2-883f-0016d3cca427", copy = (x) => JSON.parse(JSON.stringify(x));
  const wrap = (sb, ops, answer) => { const realFrom = sb.from; sb.from = (table) => { const b = realFrom(table); for (const op of ops) { const o = b[op]; b[op] = (...a) => { o(...a); const go = b.then; b.then = (res, rej) => go(() => answer(res), rej); return b; }; } return b; }; return () => { sb.from = realFrom; }; };   // the request lands; its answer is lost, or never comes
  const sb = makeSupabase(); app.reset(); app.set({ sb, signedIn: true, clientMode: false, backend: fns.cloudBackend });
  sb.seed("ft_clients", C, { id: C, name: "Jane", unit: "lb" }); sb.seed("ft_trainings", T1, { id: T1, clientId: C, date: "2026-11-24", title: "Legs", rows: [{ id: "r1", name: "Back squat", label: "1", sets: 3, reps: "10", weights: [], done: false }] }, { client_id: C });
  await fns.syncDownNow(); await settle();
  const backup = { app: "fiala-trainings", format: 1, clients: {}, trainings: { [T1]: { ...copy(maps.trainings.get(T1)), title: "From the file" } } };
  let back = wrap(sb, ["delete"], (res) => res({ data: null, error: { message: "network timeout" } }));
  try { maps.trainings.delete(T1); fns.scheduleSave("trainings", T1, 0); await settle(); } finally { back(); }
  app.set({ saveWait: 600000 }); back = wrap(sb, ["upsert", "update"], () => new Promise(() => {}));
  try { fns.applyRestore(fns.planRestore(copy(backup))); const until = Date.now() + 5000; while (!(sb.tables.ft_trainings.has(T1) && sb.tables.ft_trainings.get(T1).data.title === "From the file") && Date.now() < until) await tick(1); await tick(5); } finally { back(); }
  const q = localStorage.getItem("fiala.pending.v1"), dev = localStorage.getItem("fiala.trainings.v1");   // what the device holds as the page goes
  { const r = sb.tables.ft_trainings.get(T1); r.data.rows[0].weights = ["135", "135", "135"]; r.data.rows[0].done = true; r.data.rows[0].logSeq = 1; r.updated_at = "2099-01-01T00:00:00Z"; }   // the client trains on it
  for (const tm of maps.timers.values()) clearTimeout(tm);
  resetState(); maps.seenDoc.clear(); localStorage.clear(); if (q) localStorage.setItem("fiala.pending.v1", q); if (dev) localStorage.setItem("fiala.trainings.v1", dev);
  fns.localBackend.load(); fns.restorePending(); app.set({ sb, signedIn: true, clientMode: false, backend: fns.cloudBackend });   // opened again
  await fns.syncDownNow(); await settle();
  const saved = sb.tables.ft_trainings.get(T1).data;
  assert.deepStrictEqual([saved.title, saved.rows[0].weights], ["From the file", ["135", "135", "135"]], "the client's sets on the restored workout survive (the queue kept the restore's marker, and the send again went whole over them)");
  app.reset();
});

test("a workout deleted on another device, this one holding its stamp (no sync since), restored: its write finds no copy after a conflict and goes as a join, so a send again after a lost answer keeps the client's sets, and an app closed with the write out lands it on reopening", async () => {
  const C = "1b4e28ba-2fa1-41d2-883f-0016d3cca427", T1 = "2b4e28ba-2fa1-41d2-883f-0016d3cca427", K = "trainings/" + T1, copy = (x) => JSON.parse(JSON.stringify(x));
  const wrap = (sb, ops, answer) => { const realFrom = sb.from; sb.from = (table) => { const b = realFrom(table); for (const op of ops) { const o = b[op]; b[op] = (...a) => { o(...a); const go = b.then; b.then = answer === "never sent" ? () => new Promise(() => {}) : (res, rej) => go(() => answer(res), rej); return b; }; } return b; }; return () => { sb.from = realFrom; }; };
  const start = async () => { const sb = makeSupabase(); app.reset(); app.set({ sb, signedIn: true, clientMode: false, backend: fns.cloudBackend }); sb.seed("ft_clients", C, { id: C, name: "Jane", unit: "lb" }); sb.seed("ft_trainings", T1, { id: T1, clientId: C, date: "2026-11-24", title: "Legs", rows: [{ id: "r1", name: "Back squat", label: "1", sets: 3, reps: "10", weights: [], done: false }] }, { client_id: C }); await fns.syncDownNow(); await settle(); return sb; };
  let sb = await start(); let backup = { app: "fiala-trainings", format: 1, clients: {}, trainings: { [T1]: { ...copy(maps.trainings.get(T1)), title: "From the file" } } };
  sb.tables.ft_trainings.delete(T1); assert.ok(maps.seenAt.has(K), "the coach's other device deletes it; this one still holds its stamp");
  let back = wrap(sb, ["upsert"], (res) => res({ data: null, error: { message: "network timeout" } }));
  try { fns.applyRestore(fns.planRestore(copy(backup))); await settle(); } finally { back(); }   // the stamped write matches nothing, the read finds no copy; the upsert lands, its answer lost
  assert.strictEqual(sb.tables.ft_trainings.get(T1).data.title, "From the file");
  { const r = sb.tables.ft_trainings.get(T1), x = r.data.rows[0]; x.weights = ["135", "135", "135"]; x.repsDone = ["10", "10", "9"]; x.setsDone = 3; x.done = true; x.logSeq = 1; r.updated_at = "2099-01-01T00:00:00Z"; }   // the client trains on it
  await fns.syncDownNow(); await settle();
  assert.deepStrictEqual([sb.tables.ft_trainings.get(T1).data.title, sb.tables.ft_trainings.get(T1).data.rows[0].weights], ["From the file", ["135", "135", "135"]], "the client's sets kept (the send again went whole over them: the sixth round)");
  sb = await start(); backup = { app: "fiala-trainings", format: 1, clients: {}, trainings: { [T1]: { ...copy(maps.trainings.get(T1)), title: "From the file" } } };
  sb.tables.ft_trainings.delete(T1); app.set({ saveWait: 600000 }); back = wrap(sb, ["upsert"], "never sent");
  let q, dev;
  try { fns.applyRestore(fns.planRestore(copy(backup))); const until = Date.now() + 3000; while (!sb.log.some((e) => e.op === "upsert") && Date.now() < until) await tick(1); await tick(20); q = localStorage.getItem("fiala.pending.v1"); dev = localStorage.getItem("fiala.trainings.v1"); } finally { back(); }   // the app closes with the upsert out; it never lands
  for (const tm of maps.timers.values()) clearTimeout(tm);
  resetState(); maps.seenDoc.clear(); localStorage.clear(); localStorage.setItem("fiala.pending.v1", q); if (dev) localStorage.setItem("fiala.trainings.v1", dev);
  fns.localBackend.load(); fns.restorePending(); app.set({ sb, signedIn: true, clientMode: false, backend: fns.cloudBackend });   // opened again
  await fns.syncDownNow(); await settle();
  assert.deepStrictEqual([sb.tables.ft_trainings.has(T1) && sb.tables.ft_trainings.get(T1).data.title, maps.trainings.has(T1)], ["From the file", true], "the restore lands (a queue saved with the old stamp and no marker took it for a deletion made elsewhere)");
  app.reset();
});

test("a restore clears the coach's marks on the copy it replaces: after an edit, a deletion and a restore whose answers were all lost, the client's sets and move on the restored workout stand, as with signal", async () => {
  const C = "1b4e28ba-2fa1-41d2-883f-0016d3cca427", T1 = "2b4e28ba-2fa1-41d2-883f-0016d3cca427", copy = (x) => JSON.parse(JSON.stringify(x));
  const lose = (sb, ops) => { const realFrom = sb.from; sb.from = (table) => { const b = realFrom(table); for (const op of ops) { const o = b[op]; b[op] = (...a) => { o(...a); const go = b.then; b.then = (res, rej) => go(() => res({ data: null, error: { message: "network timeout" } }), rej); return b; }; } return b; }; return () => { sb.from = realFrom; }; };
  for (const signal of [true, false]) {
    const sb = makeSupabase(); app.reset(); app.set({ sb, signedIn: true, clientMode: false, backend: fns.cloudBackend });
    sb.seed("ft_clients", C, { id: C, name: "Jane", unit: "lb" }); sb.seed("ft_trainings", T1, { id: T1, clientId: C, date: "2026-11-24", title: "Legs", rows: [{ id: "r1", name: "Back squat", label: "1", sets: 3, reps: "10", weights: [], done: false }, { id: "r2", name: "Leg press", label: "2", sets: 3, reps: "12", weights: [], done: false }] }, { client_id: C });
    await fns.syncDownNow(); await settle();
    const backup = { app: "fiala-trainings", format: 1, clients: {}, trainings: { [T1]: copy(maps.trainings.get(T1)) } };
    let back = signal ? () => {} : lose(sb, ["update", "upsert", "delete"]);   // one bar: every request lands, no answer comes back
    try {
      { const t = maps.trainings.get(T1); t.rows[0].weights = ["100"]; if (!maps.trainerTouched.has(T1)) maps.trainerTouched.set(T1, new Set()); maps.trainerTouched.get(T1).add("r1"); fns.touchState(T1, "date"); fns.scheduleSave("trainings", T1, 0); await settle(); }   // the coach types a weight (the row and the day marked)
      maps.trainings.delete(T1); fns.scheduleSave("trainings", T1, 0); await settle();   // Delete
      back(); back = lose(sb, ["update", "upsert"]);                       // the restore's own answer lost both ways
      fns.applyRestore(fns.planRestore(copy(backup))); await settle();
    } finally { back(); }
    { const r = sb.tables.ft_trainings.get(T1); for (const x of r.data.rows) { x.weights = ["135", "135", "135"]; x.repsDone = ["10", "10", "9"]; x.setsDone = 3; x.done = true; x.logSeq = (parseInt(x.logSeq, 10) || 0) + 1; } r.data.date = "2026-11-25"; r.updated_at = "2099-01-01T00:00:00Z"; }   // the client trains on both and moves it a day
    await fns.syncDownNow(); await settle();
    const saved = sb.tables.ft_trainings.get(T1).data;
    assert.deepStrictEqual([saved.rows[0].weights, saved.rows[1].weights, saved.date], [["135", "135", "135"], ["135", "135", "135"], "2026-11-25"], (signal ? "with signal" : "one bar") + ": the client's sets and move stand (the marks of the deleted copy kept the file's row and day: the sixth round)");
  }
  app.reset();
});

test("a client deleted on another device, restored here (this device holding its stamp and copy read), the write's answer lost: the client's own change made since stands (no copy read is left to measure the file's against)", async () => {
  const C = "1b4e28ba-2fa1-41d2-883f-0016d3cca427", phone = { zone: "Asia/Tokyo", at: new Date(Date.now() - 60e3).toISOString() };
  const sb = makeSupabase(); app.reset(); app.set({ sb, signedIn: true, clientMode: false, backend: fns.cloudBackend });
  sb.seed("ft_clients", C, { id: C, name: "Jane", unit: "lb", birthday: "1990-01-01", zone: phone }); await fns.syncDownNow(); await settle();
  const backup = { app: "fiala-trainings", format: 1, clients: { [C]: { ...JSON.parse(JSON.stringify(maps.clients.get(C))), name: "Jane D.", birthday: "1985-05-05" } }, trainings: {} };
  sb.tables.ft_clients.delete(C);                                        // the coach's other device deletes the client; no sync here since
  const realFrom = sb.from;
  sb.from = (table) => { const b = realFrom(table), o = b.upsert; b.upsert = (...a) => { o(...a); const go = b.then; b.then = (res, rej) => go(() => res({ data: null, error: { message: "network timeout" } }), rej); return b; }; return b; };   // the restore's upsert lands, its answer lost
  try { fns.applyRestore(fns.planRestore(backup)); await settle(); } finally { sb.from = realFrom; }
  { const r = sb.tables.ft_clients.get(C); r.data = { ...r.data, birthday: "1992-03-03" }; r.updated_at = "2099-01-01T00:00:00Z"; }   // the client sets their birthday on the restored record
  await fns.syncDownNow(); await settle();
  const saved = sb.tables.ft_clients.get(C).data;
  assert.deepStrictEqual([saved.name, saved.birthday], ["Jane D.", "1992-03-03"], "the file's name, the client's own birthday (measured against the deleted copy, the file's went over it: the sixth round)");
  app.reset();
});

test("a backup keeps a client's reported time zone, and refuses one that is not a report", () => {
  const C = "1b4e28ba-2fa1-41d2-883f-0016d3cca427";
  const ok = (zone) => { try { validateBackup({ app: "fiala-trainings", clients: { [C]: { id: C, name: "Jane", ...(zone === undefined ? {} : { zone }) } }, trainings: {} }, () => false); return true; } catch (_) { return false; } };
  assert.ok(ok({ zone: "Asia/Tokyo", at: "2026-11-23T17:30:00+00:00" })); assert.ok(ok(undefined)); assert.ok(ok(null));
  assert.ok(!ok("Asia/Tokyo")); assert.ok(!ok({ zone: 7, at: "2026-11-23T17:30:00+00:00" })); assert.ok(!ok({ zone: "Asia/Tokyo", at: "soon" }));
});
