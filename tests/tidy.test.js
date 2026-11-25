// v316, the seventeenth check round: an empty workout left behind (an accidental day tap) is tidied away, and nothing of another device's or
// another tab's work ever goes with it. Each test asserts the safe outcome, as the coach and the client would meet it. Made-up people only.
import { test, assert, tick } from "./assert.js";
import { makeSupabase } from "./fake-supabase.js";
import { load } from "./load.js";
import { TEMPLATES_ID } from "../app/model.js";
const app = await load();
const { fns, maps } = app;
const settle = async () => { const until = Date.now() + 15000; do await tick(5); while ((app.get().inflight > 0 || maps.timers.size) && Date.now() < until); };
const coachOn = (sb, extra) => { app.reset(); fns.leaveSettings(); app.set({ sb, signedIn: true, clientMode: false, backend: fns.cloudBackend, sessionEmail: "coach@x.com", view: { name: "client", id: "c1" } }); maps.clients.set("c1", { id: "c1", name: "Jane Doe", unit: "lb", ...(extra || {}) }); };
const empty = (id, createdAt, date) => ({ id, clientId: "c1", title: "", date: date || fns.today(), createdAt, completedAt: null, skippedAt: null, rows: [] });
const filled = (id, createdAt, date, done) => ({ id, clientId: "c1", title: "Legs", date: date || fns.today(), createdAt, completedAt: done ? new Date(Date.now() - 86400e3).toISOString() : null, skippedAt: null,
  rows: [{ id: "r1", label: "1", name: "Back squat", sets: 3, reps: "8", weights: done ? ["135", "135", "135"] : [], repsDone: done ? ["8", "8", "8"] : [], setsDone: done ? 3 : 0, done: !!done }] });
const flushAll = () => { for (const k of [...maps.dirty.keys()]) { const [kind, id] = k.split("/"); fns.flushOne(kind, id); } };
const deletes = (sb, id) => sb.log.filter((e) => e.op === "delete" && (!id || e.filters.some((f) => f[1] === "id" && f[2] === id))).length;
const ago = (m) => new Date(Date.now() - m * 60e3).toISOString();
const later = (d) => fns.localIso(new Date(Date.now() + d * 86400e3));
const snapLS = () => { const o = {}; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); o[k] = localStorage.getItem(k); } return o; };
const putLS = (o) => { for (const [k, v] of Object.entries(o)) localStorage.setItem(k, v); };
const stopTimers = () => { for (const tm of maps.timers.values()) clearTimeout(tm); maps.timers.clear(); };
const fill = (sb, id) => { const s = sb.tables.ft_trainings.get(id); s.data.title = "Legs"; s.data.rows = filled(id, ago(1)).rows; s.updated_at = "2026-11-23T12:00:" + String(10 + (fill.n = (fill.n || 0) + 1) % 50).padStart(2, "0") + ".000Z"; };   // filled on the coach's iPad

test("no cloud library at launch (a remembered coach, a device copy days old): Jane's page never tidies from it, and nothing is deleted at the next open with signal; a device that never signed in still tidies its own copy", async () => {
  app.reset(); localStorage.clear(); delete globalThis.supabase;
  const jane = { id: "c1", name: "Jane Doe", unit: "lb", email: "jane@x.com" }, made = new Date(Date.now() - 3.5 * 86400e3).toISOString(), day = fns.localIso(new Date(Date.now() - 2 * 86400e3));
  localStorage.setItem("fiala.trainings.v1", JSON.stringify({ clients: { c1: jane }, trainings: { W1: empty("W1", made, day) }, savedAt: Date.now() - 3 * 86400e3 }));
  localStorage.setItem("fiala.trainings.role", JSON.stringify({ email: "coach@x.com", role: "trainer" }));
  localStorage.setItem("fiala.trainings.view", JSON.stringify({ name: "client", id: "c1" }));
  app.set({ sb: null, signedIn: false, clientMode: false, myClientId: null, backend: null, offline: false, syncedOnce: false, syncedAt: 0 }); maps.clients.clear(); maps.trainings.clear();
  let first, next;
  try {
    await fns.boot(); await settle();
    first = { here: maps.trainings.has("W1"), gone: (JSON.parse(localStorage.getItem("fiala.pending.v1") || "{}").gone || []) };
    const kept = snapLS(); stopTimers(); app.reset(); putLS(kept);   // closed, and opened again with signal and the library
    const sb = makeSupabase(); sb.seed("ft_clients", "c1", jane); sb.seed("ft_trainings", "W1", filled("W1", made, day, true), { client_id: "c1" });   // filled on the Mac since, and finished by Jane: 3 sets
    let onAuth = null; sb.auth = { ...sb.auth, getSession: async () => ({ data: { session: { user: { email: "coach@x.com" } } } }), onAuthStateChange(cb) { onAuth = cb; }, signOut: async () => ({ error: null }) };
    globalThis.supabase = { createClient: () => sb };
    app.set({ sb: null, signedIn: false, clientMode: false, myClientId: null, backend: null, offline: false, syncedOnce: false, syncedAt: 0 }); maps.clients.clear(); maps.trainings.clear();
    await fns.boot(); await settle();
    next = { onServer: sb.tables.ft_trainings.has("W1"), deletes: deletes(sb, "W1") };
    localStorage.setItem("fiala.made", JSON.stringify([["MINE1", Date.now()]])); onAuth("SIGNED_OUT"); await settle();   // the session ended elsewhere (a password changed), nothing waiting: the device is wiped
    next.wiped = [localStorage.getItem("fiala.made"), maps.madeHere.has("MINE1")];
  } finally { delete globalThis.supabase; stopTimers(); app.reset(); localStorage.clear(); }
  assert.deepStrictEqual([first.here, first.gone, next.onServer, next.deletes], [true, [], true, 0], "Jane's finished workout survives");
  assert.deepStrictEqual(next.wiped, [null, false], "a session ended elsewhere takes this device's list of its own new workouts with the account");
  localStorage.setItem("fiala.trainings.v1", JSON.stringify({ clients: { c1: { id: "c1", name: "Jane Doe", unit: "lb" } }, trainings: { L1: empty("L1", ago(600)) }, savedAt: Date.now() }));
  localStorage.setItem("fiala.trainings.view", JSON.stringify({ name: "client", id: "c1" }));
  localStorage.setItem("fiala.made", JSON.stringify([["MINE2", Date.now() - 60e3], ["OLD2", Date.now() - 3 * 3600e3]]));   // made on this device a minute ago, and one 3 hours ago
  app.set({ sb: null, signedIn: false, clientMode: false, myClientId: null, backend: null, offline: false, syncedOnce: false, syncedAt: 0 }); maps.clients.clear(); maps.trainings.clear();
  let local;
  try { await fns.boot(); await settle(); local = { local: app.get().backend === fns.localBackend, here: maps.trainings.has("L1"), mine: [maps.madeHere.has("MINE2"), maps.madeHere.has("OLD2")] }; } finally { stopTimers(); app.reset(); localStorage.clear(); }
  assert.deepStrictEqual(local, { local: true, here: false, mine: [true, false] }, "a device with no account: its own copy is the app, tidied as before; the page opened counts this device's own new workouts of the last 2 hours as its own");
});

test("a copy counts as fresh from when its read began, never from a clock set back since: the iPad's clock put back 2 hours after a sync, offline an hour later, tidies nothing; an answer read before a sleep and handled on waking 3 hours later tidies nothing filled meanwhile", async () => {
  let sb = makeSupabase(); coachOn(sb); app.set({ view: { name: "clients" } }); sb.seed("ft_clients", "c1", { id: "c1", name: "Jane Doe", unit: "lb" });
  sb.seed("ft_trainings", "K1", empty("K1", ago(180)), { client_id: "c1" });
  const real = Date.now; let r;
  try {
    Date.now = () => real() + 2 * 3600e3; await fns.syncDownNow(); await settle();               // synced while the iPad's clock ran 2 hours fast
    fill(sb, "K1"); sb.setFail({ times: 100000, message: "TypeError: Failed to fetch" });           // filled on the Mac since; then no signal
    Date.now = () => real() + 3600e3;                                                              // the clock put right, an hour on
    app.set({ view: { name: "client", id: "c1" } }); fns.render(); await settle();
    const after = { here: maps.trainings.has("K1"), queued: maps.dirty.has("trainings/K1") };
    sb.setFail(null); app.set({ offline: false }); flushAll(); await settle();
    r = { ...after, serverKeeps: sb.tables.ft_trainings.has("K1") };
  } finally { Date.now = real; stopTimers(); app.reset(); localStorage.clear(); }
  assert.deepStrictEqual(r, { here: true, queued: false, serverKeeps: true }, "the clock set back");
  sb = makeSupabase(); coachOn(sb); app.set({ view: { name: "clients" } }); sb.seed("ft_clients", "c1", { id: "c1", name: "Jane Doe", unit: "lb" });
  sb.seed("ft_trainings", "Z1", empty("Z1", ago(100)), { client_id: "c1" });                      // made 100 minutes ago on the iPad: spared by the 2-hour rule
  await fns.syncDownNow(); await settle();
  const realFrom = sb.from; let release = null;
  try {
    sb.from = (table) => { const b = realFrom(table); if (table !== "ft_trainings") return b; const then0 = b.then; b.then = (res, rej) => { const snap = then0.call(b, (x) => x); return snap.then((x) => new Promise((ok) => { release = () => ok(x); })).then(res, rej); }; return b; };   // the server reads now; the page gets the answer only when released
    app.set({ view: { name: "client", id: "c1" } });
    const p = fns.syncDownNow(); for (let i = 0; i < 100 && !release; i++) await tick(5);
    fill(sb, "Z1"); Date.now = () => real() + 3 * 3600e3;                                          // filled on the iPad during 3 hours of sleep
    sb.from = realFrom; release(); await p; await settle();
    r = { here: maps.trainings.has("Z1"), serverKeeps: sb.tables.ft_trainings.has("Z1") };
  } finally { Date.now = real; sb.from = realFrom; stopTimers(); app.reset(); localStorage.clear(); }
  assert.deepStrictEqual(r, { here: true, serverKeeps: true }, "the late answer");
});

test("a workout a sync passed over while the server's copy differed is held back: a question left up over the coach's own new empty workout while he fills it on the iPad, then Cancel and Back, keeps it; an edit of it waiting for a signal likewise; with nothing changed on the server, no question at all, or the waiting edit landed since, Back still discards it", async () => {
  for (const how of ["a question up", "an edit waiting", "a question, nothing changed", "no question", "an edit waiting, landed since"]) {
    const sb = makeSupabase(); coachOn(sb); sb.seed("ft_clients", "c1", { id: "c1", name: "Jane Doe", unit: "lb" }); await fns.syncDownNow(); await settle();
    fns.addTraining("c1", null, later(3)); await settle(); const id = app.get().view.id;             // Friday tapped on the Mac: his own new empty workout, saved
    if (how.startsWith("a question")) app.set({ asking: true });                                     // Skip workout, Delete's question or Copy workout's list left up
    if (how.startsWith("an edit waiting")) { sb.setFail({ op: "update", times: 100000, message: "Failed to fetch" }); maps.trainings.get(id).date = later(4); fns.scheduleSave("trainings", id, 0); await settle(); }   // moved to Saturday on one bar of signal: it waits
    if (how === "a question up" || how === "an edit waiting") fill(sb, id);
    await fns.syncDownNow(); await settle(); await fns.syncDownNow(); await settle();                // the minute syncs
    if (how === "an edit waiting, landed since") { assert.ok(maps.heldBack.has(id), "held back while its edit waits"); sb.setFail(null); app.set({ offline: false }); flushAll(); await settle(); assert.ok(!maps.heldBack.has(id), "its save landed: this page's copy is the server's"); }
    app.set({ asking: false }); fns.go({ name: "client", id: "c1" }, true); await settle();          // Cancel, then Back
    sb.setFail(null); app.set({ offline: false }); flushAll(); await settle();
    const kept = how === "a question up" || how === "an edit waiting";
    assert.strictEqual(sb.tables.ft_trainings.has(id), kept, how);
    if (kept) { assert.strictEqual(sb.tables.ft_trainings.get(id).data.title, "Legs", how + ": the iPad's exercises with it"); await fns.syncDownNow(); await settle(); assert.deepStrictEqual([maps.heldBack.has(id), maps.trainings.get(id).rows.length], [false, 1], how + ": the next sync takes the iPad's copy, and holds it back no more"); }
    stopTimers(); app.reset(); localStorage.clear();
  }
});

test("an empty workout more than a week past is never filed as Missed (Jane's phone; the coach's page with a copy synced today but not in the last 90 s): nothing in it to miss, and the tidying can still take it", async () => {
  const day = (k) => { const d = new Date(); d.setDate(d.getDate() + k); return fns.localIso(d); };
  const out = {};
  for (const client of [true, false]) {
    stopTimers(); app.reset(); fns.missReset();
    app.set({ signedIn: true, clientMode: client, myClientId: client ? "c1" : null, tab: "workouts", sb: {}, syncedOnce: true, syncedOn: fns.today(), syncedAt: Date.now() - 5 * 60e3, backend: null });
    maps.clients.set("c1", { id: "c1", name: "Jane Doe", unit: "lb" });
    maps.trainings.set("E8", empty("E8", ago(9 * 1440), day(-8)));
    maps.trainings.set("T8", { ...empty("T8", ago(9 * 1440), day(-8)), title: "Upper body" });        // a planned one with a name: filed as before
    app.set({ view: { name: "client", id: "c1" } }); fns.render();
    const e = maps.trainings.get("E8"), t = maps.trainings.get("T8");
    out[client ? "client" : "coach"] = [!!(e && e.skippedAt), maps.pendingMiss.has("E8"), !!(t && t.skippedAt && t.missed)];
  }
  stopTimers(); app.set({ sb: null }); app.reset(); localStorage.clear();
  assert.deepStrictEqual(out, { client: [false, false, true], coach: [false, false, true] });
});

test("the coach's own empty workout stays his own after the app is opened again (iOS closed it, a reload: the device keeps the last 2 hours' list): Back once synced takes it; the pick note's Cancel after From template gives it up as Back would; a sign-out takes the list with the account", async () => {
  let sb = makeSupabase(); coachOn(sb); sb.seed("ft_clients", "c1", { id: "c1", name: "Jane Doe", unit: "lb" }); await fns.syncDownNow(); await settle();
  fns.addTraining("c1", null, later(3)); await settle(); const id = app.get().view.id;               // a day tapped by accident, saved
  assert.ok(sb.tables.ft_trainings.has(id), "saved");
  const kept = snapLS(); stopTimers(); coachOn(sb); putLS(kept); fns.loadMade();                       // the page gone (its own list with it); opened again on the device
  assert.ok(maps.madeHere.has(id), "still this device's own");
  await fns.syncDownNow(); await settle();
  fns.go({ name: "training", id }); await settle(); fns.go({ name: "client", id: "c1" }, true); await settle();   // opened on it, Back
  assert.deepStrictEqual([maps.trainings.has(id), sb.tables.ft_trainings.has(id)], [false, false], "the reopened page's Back");
  { const old = [["OLD1", Date.now() - 3 * 3600e3]]; coachOn(sb); localStorage.setItem("fiala.made", JSON.stringify(old)); fns.loadMade(); assert.ok(!maps.madeHere.has("OLD1"), "one made more than 2 hours ago is another's like any"); }
  stopTimers(); app.reset(); localStorage.clear();
  sb = makeSupabase(); coachOn(sb); sb.seed("ft_clients", "c1", { id: "c1", name: "Jane Doe", unit: "lb" }); await fns.syncDownNow(); await settle();
  fns.addTraining("c1", null, later(2)); await settle(); const t2 = app.get().view.id;
  fns.fromTemplate(maps.trainings.get(t2)); await settle();
  assert.strictEqual(app.get().view.id, TEMPLATES_ID, "on the Templates page, choosing");
  fns.cancelPick(); await settle();
  assert.deepStrictEqual([maps.trainings.has(t2), sb.tables.ft_trainings.has(t2)], [false, false], "Cancel gives the empty workout up");
  sb.seed("ft_trainings", "IPAD1", empty("IPAD1", ago(5), later(6)), { client_id: "c1" }); await fns.syncDownNow(); await settle();   // made on the iPad five minutes ago, still being filled there
  fns.go({ name: "training", id: "IPAD1" }); await settle(); fns.fromTemplate(maps.trainings.get("IPAD1")); await settle(); fns.cancelPick(); await settle();
  assert.deepStrictEqual([maps.trainings.has("IPAD1"), sb.tables.ft_trainings.has("IPAD1")], [true, true], "another device's new workout is never given up here");
  fns.addTraining("c1", null, later(5)); await settle();
  assert.ok(localStorage.getItem("fiala.made"), "kept on the device");
  sb.auth.signOut = async () => ({ error: null }); await fns.signOut(); await settle();
  assert.deepStrictEqual([localStorage.getItem("fiala.made"), maps.madeHere.size], [null, 0], "gone with the account");
  { const cs = makeSupabase(); cs.auth.signOut = async () => ({ error: null }); app.reset(); fns.leaveSettings(); app.set({ sb: cs, signedIn: true, clientMode: true, myClientId: "c1", backend: fns.clientBackend, sessionEmail: "jane@x.com", view: { name: "client", id: "c1" } }); maps.clients.set("c1", { id: "c1", name: "Jane Doe", unit: "lb", email: "jane@x.com" }); localStorage.setItem("fiala.made", JSON.stringify([["X1", Date.now()]])); await fns.signOut(); await settle(); assert.strictEqual(localStorage.getItem("fiala.made"), null, "the client's sign-out too"); }
  stopTimers(); app.reset(); localStorage.clear();
});

test("another tab's queue is read as it is now, never the storage event's own copy (the seventeenth check round: a tab Chrome froze gets every event it missed as it wakes, each with the queue as it was then; it took an old empty copy of a workout filled since and wrote it back)", async () => {
  const sb = makeSupabase(); coachOn(sb); sb.seed("ft_clients", "c1", { id: "c1", name: "Jane Doe", unit: "lb" });
  sb.seed("ft_trainings", "F1", filled("F1", ago(5)), { client_id: "c1" }); await fns.syncDownNow(); await settle();   // this window: the workout filled, as the server has it
  const old = { tab: "window-A", owner: "coach@x.com", dirty: ["trainings/F1"], recs: [["trainings/F1", empty("F1", ago(5))]], stamps: [["trainings/F1", null]] };   // the other window's queue as it was at the event: the empty copy, since sent
  const now = { tab: "window-A", owner: "coach@x.com", dirty: [], recs: [], stamps: [] };                   // its queue now: nothing to send
  localStorage.setItem("fiala.pending.v1", JSON.stringify(now)); localStorage.setItem("fiala.pending.tab", "window-A");
  fns.onStorage({ key: "fiala.pending.v1", newValue: JSON.stringify(old) }); await settle();
  assert.deepStrictEqual([maps.trainings.get("F1").rows.length, maps.dirty.has("trainings/F1"), sb.tables.ft_trainings.get("F1").data.rows.length], [1, false, 1], "nothing taken from the old copy");
  localStorage.setItem("fiala.pending.v1", JSON.stringify({ ...now, dirty: ["trainings/F1"], recs: [["trainings/F1", { ...filled("F1", ago(5)), title: "Legs, heavy" }]], stamps: [["trainings/F1", sb.tables.ft_trainings.get("F1").updated_at]] }));
  fns.onStorage({ key: "fiala.pending.v1", newValue: JSON.stringify(old) }); await settle();
  assert.strictEqual(maps.trainings.get("F1").title, "Legs, heavy", "what the other window has to send now is taken on, as before");
  stopTimers(); app.reset(); localStorage.clear();
});

// ---------- the tidying rules each alone (no test caught their undoing before) ----------
test("his own workout, saved, filled on his iPhone; an edit here waits for a signal; the copy is 2 minutes old; he leaves it: the iPhone's workout stays; a day tapped by accident, saved, then Back at once: it goes", async () => {
  let sb = makeSupabase(); coachOn(sb); sb.seed("ft_clients", "c1", { id: "c1", name: "Jane Doe", unit: "lb" }); await fns.syncDownNow(); await settle();
  fns.addTraining("c1", null, fns.today()); await settle(); let id = app.get().view.id;
  fill(sb, id); sb.setFail({ times: 100000, message: "Failed to fetch" });
  maps.trainings.get(id).date = later(5); fns.scheduleSave("trainings", id, 0); await settle();      // moved here, no signal: waits
  const real = Date.now; Date.now = () => real() + 120e3;
  try { fns.go({ name: "client", id: "c1" }); await settle(); } finally { Date.now = real; }
  sb.setFail(null); app.set({ offline: false }); flushAll(); await settle();
  assert.deepStrictEqual([sb.tables.ft_trainings.has(id), (sb.tables.ft_trainings.get(id) || { data: {} }).data.title], [true, "Legs"], "never deleted");
  stopTimers(); app.reset(); localStorage.clear();
  sb = makeSupabase(); coachOn(sb); sb.seed("ft_clients", "c1", { id: "c1", name: "Jane Doe", unit: "lb" }); await fns.syncDownNow(); await settle();
  fns.addTraining("c1", null, fns.today()); await settle(); id = app.get().view.id;
  assert.ok(sb.tables.ft_trainings.has(id), "saved");
  fns.go({ name: "client", id: "c1" }); await settle();
  assert.deepStrictEqual([maps.trainings.has(id), sb.tables.ft_trainings.has(id)], [false, false]);
  stopTimers(); app.reset(); localStorage.clear();
});
test("no signal at launch, + makes a template, left with no name: it never reaches the server; no server at all (the device-only app): an empty workout made 3 hours ago is tidied, and one left at once goes", async () => {
  const sb = makeSupabase(); app.reset(); fns.leaveSettings(); app.set({ sb, signedIn: true, clientMode: false, backend: fns.cloudBackend, sessionEmail: "coach@x.com", view: { name: "client", id: TEMPLATES_ID } });
  sb.setFail({ times: 100000, message: "Failed to fetch" });
  fns.newTemplateHere(); await settle(); const id = app.get().view.id;
  fns.go({ name: "client", id: TEMPLATES_ID }); await settle();
  sb.setFail(null); app.set({ offline: false }); flushAll(); await settle();
  assert.deepStrictEqual([id !== TEMPLATES_ID, maps.trainings.has(id), sb.tables.ft_trainings.has(id)], [true, false, false]);
  stopTimers(); app.reset(); fns.leaveSettings(); app.set({ sb: null, signedIn: false, clientMode: false, backend: fns.localBackend, view: { name: "client", id: "c1" } }); maps.clients.set("c1", { id: "c1", name: "Jane Doe", unit: "lb" });
  maps.trainings.set("old1", empty("old1", new Date(Date.now() - 3 * 3600e3).toISOString())); fns.render(); await settle();
  const tidied = !maps.trainings.has("old1");
  fns.addTraining("c1", null, fns.today()); await settle(); const mine = app.get().view.id; fns.go({ name: "client", id: "c1" }); await settle();
  assert.deepStrictEqual([tidied, maps.trainings.has(mine)], [true, false]);
  stopTimers(); app.reset(); localStorage.clear();
});
test("a known limit, pinned (the seventeenth check round): window A's Delete landed, the workout came back (restored on the iPhone) and A synced it in; window B writes its old queue again (the same Delete, A's stamp): A takes it on and sends it, as the record is here again", async () => {
  const C = "3d6f1a2b-4c5d-4e6f-8a7b-9c0d1e2f3a4b", WK = "5e7a2b3c-6d4e-4f5a-9b8c-0d1e2f3a4b5c", AT = "2026-11-18T08:00:00.000Z";
  const wk = () => ({ id: WK, clientId: C, title: "Legs", date: "2026-11-10", createdAt: AT, completedAt: null, skippedAt: null, rows: [{ id: "r1", label: "1", name: "Back squat", sets: 3, reps: "8", weights: [], done: false }] });
  const sb = makeSupabase(); app.reset(); fns.leaveSettings(); app.set({ sb, signedIn: true, clientMode: false, backend: fns.cloudBackend, sessionEmail: "coach@x.com", view: { name: "clients" } });
  sb.seed("ft_clients", C, { id: C, name: "Jane Testperson", unit: "lb" }); sb.seed("ft_trainings", WK, wk(), { client_id: C });
  await fns.syncDownNow(); await settle();
  sb.delayMs = 30; fns.deleteRec("trainings", WK);
  const aQueue = JSON.parse(localStorage.getItem("fiala.pending.v1"));    // as window A wrote it at the Delete: window B takes it on
  await settle(); sb.delayMs = 0;
  sb.seed("ft_trainings", WK, { ...wk(), title: "Legs (restored)" }, { client_id: C });   // the coach's iPhone restores it
  await fns.syncDownNow(); await settle();
  const before = deletes(sb);
  localStorage.setItem("fiala.pending.v1", JSON.stringify({ ...aQueue, tab: "window-B" })); localStorage.setItem("fiala.pending.tab", "window-B");
  fns.persistPending(); await settle();
  assert.deepStrictEqual([deletes(sb) - before, sb.tables.ft_trainings.has(WK)], [1, false], "known limit (CLAUDE.md): an old Delete a frozen window still holds undoes a restore made elsewhere since");
  stopTimers(); app.reset(); localStorage.clear();
});

// ---------- the eighteenth check round ----------
const bQueue = (rec, stamp, doc, extra = {}) => ({ deliv: [], wd: [], dirty: ["trainings/W", ...(extra.dirty || [])], weights: [], done: [], early: [], rownotes: [], profile: [], under: [], held: [], settled: [], choices: [], finish: [], skip: [], move: [], miss: [], swap: [], order: [],
  touched: extra.touched || [], named: [], noted: [], state: extra.state || [], plans: [], profTouched: [], notesGone: [], packagesGone: [], foldersGone: [], foldersTouched: [], fromFile: [],
  stamps: [["trainings/W", stamp]], docs: [["trainings/W", doc]], recs: [["trainings/W", rec]], gone: [], owner: "coach@x.com", tab: "tab-B" });   // window B's queue, as its persistPending lays it out
const writeB = (q) => { localStorage.setItem("fiala.pending.v1", JSON.stringify(q)); localStorage.setItem("fiala.pending.answers.v1", JSON.stringify({ wd: [], held: [], settled: [], choices: [], owner: "coach@x.com", tab: "tab-B" })); localStorage.setItem("fiala.pending.tab", "tab-B"); };
const storageEv = () => fns.onStorage({ key: "fiala.pending.v1", newValue: "x" });
for (const how of ["a storage event", "this window's own next edit", "Back from the workout"]) test("a copy taken from another window is that window's, not the server's (the eighteenth check round): a frozen window B wakes holding its old move of an empty workout since filled on the iPad, with the client's set; window A takes it on through " + how + ": nothing is tidied, and the server keeps the exercises and the set", async () => {
  const sb = makeSupabase(); coachOn(sb); sb.seed("ft_clients", "c1", { id: "c1", name: "Jane Doe", unit: "lb" });
  const thu = later(2), fri = later(3), w0 = { id: "W", clientId: "c1", title: "", date: thu, createdAt: ago(100), completedAt: null, skippedAt: null, rows: [] };   // made on the iPad 100 minutes ago
  const s0 = sb.seed("ft_trainings", "W", w0, { client_id: "c1" });
  let r;
  try {
    await fns.syncDownNow(); await settle();
    const doc0 = JSON.stringify(sb.tables.ft_trainings.get("W").data), bRec = { ...w0, date: fri };
    writeB(bQueue(bRec, s0, doc0, { state: [["W", ["date"]]] })); storageEv(); await settle();   // B, offline: moved to Friday; A takes it on and sends it
    const s = sb.tables.ft_trainings.get("W"); s.data = { ...s.data, title: "Legs", rows: [{ id: "r1", label: "1", name: "Back squat", sets: 3, reps: "8", weights: ["135"], repsDone: ["8"], setsDone: 1, done: false }] }; s.updated_at = "2026-10-13T00:09:59Z";   // filled on the iPad, Jane's set
    const real = Date.now; Date.now = () => real() + 31 * 60e3;
    try {
      await fns.syncDownNow(); await settle();                                       // A synced: filled
      if (how === "Back from the workout") app.set({ view: { name: "training", id: "W" } });
      writeB(bQueue(bRec, s0, doc0, { state: [["W", ["date"]]] }));                  // B wakes and writes its queue again: its old empty copy
      if (how === "this window's own next edit") { maps.clients.get("c1").phone = "3105550100"; fns.scheduleSave("clients", "c1"); } else storageEv();
      await tick(10);
      if (how === "Back from the workout") fns.go({ name: "client", id: "c1" }, true); else { app.set({ view: { name: "client", id: "c1" } }); fns.render(); }
      await settle();
      r = { serverHas: sb.tables.ft_trainings.has("W"), serverRows: sb.tables.ft_trainings.has("W") ? sb.tables.ft_trainings.get("W").data.rows.length : null, deletes: deletes(sb, "W") };
    } finally { Date.now = real; }
  } finally { stopTimers(); app.reset(); localStorage.clear(); }
  assert.deepStrictEqual([r.serverHas, r.deletes, r.serverRows], [true, 0, 1]);
});

for (const field of ["title", "reps"]) test("a tab behind never writes the first keystroke of an edit over the finished one (the eighteenth check round, " + field + "): it takes the front tab's newer copies of what it only took from it, and its late save sends the newest", async () => {
  const sb = makeSupabase(); coachOn(sb); sb.seed("ft_clients", "c1", { id: "c1", name: "Jane Doe", unit: "lb" });
  const w0 = { id: "W", clientId: "c1", title: "Upper body", date: fns.today(), createdAt: new Date(Date.now() - 86400e3).toISOString(), completedAt: null, skippedAt: null, rows: [{ id: "r1", label: "1", name: "Bench press", sets: 4, reps: "8", weights: [], repsDone: [], setsDone: 0, done: false }] };
  const s0 = sb.seed("ft_trainings", "W", w0, { client_id: "c1" });
  let server;
  try {
    await fns.syncDownNow(); await settle();
    const doc0 = JSON.stringify(sb.tables.ft_trainings.get("W").data), at = (v) => { const x = JSON.parse(doc0); if (field === "title") x.title = v; else x.rows[0].reps = v; return x; };
    const steps = field === "title" ? ["Upper body ", "Upper body A"] : ["1", "10"], touched = field === "title" ? [] : [["W", ["r1"]]];
    writeB(bQueue(at(steps[0]), s0, doc0, { touched })); storageEv();                 // the front tab's first keystroke: this tab takes it
    for (const tm of maps.timers.values()) clearTimeout(tm); const late = [...maps.timers.keys()]; maps.timers.clear();   // a tab behind: its timers wait
    writeB(bQueue(at(steps[1]), s0, doc0, { touched })); storageEv();                 // the second keystroke
    for (const tm of maps.timers.values()) clearTimeout(tm); maps.timers.clear();
    { const s = sb.tables.ft_trainings.get("W"); s.data = at(steps[1]); s.updated_at = "2026-10-13T00:30:00Z"; }   // the front tab's save of the finished edit lands
    { const q = bQueue(at(steps[1]), "2026-10-13T00:30:00Z", JSON.stringify(at(steps[1]))); q.dirty = []; q.recs = []; q.stamps = []; q.docs = []; writeB(q); storageEv(); }
    for (const tm of maps.timers.values()) clearTimeout(tm); maps.timers.clear();
    for (const k of late) { const [kind, id] = k.split("/"); fns.flushOne(kind, id); }   // this tab's late timer fires
    await settle();
    const d = sb.tables.ft_trainings.get("W").data; server = field === "title" ? d.title : d.rows[0].reps;
  } finally { stopTimers(); app.reset(); localStorage.clear(); }
  assert.strictEqual(server, field === "title" ? "Upper body A" : "10");
});

for (const after of [10e3, 80e3]) test("a clock set back by hand never makes an old copy fresh again (the eighteenth check round): set back 2 hours after a sync, no signal, two real hours on the device's clock reads the old sync's start + " + after / 1e3 + " s: Jane's page tidies nothing", async () => {
  const sb = makeSupabase(); coachOn(sb); app.set({ view: { name: "clients" } }); sb.seed("ft_clients", "c1", { id: "c1", name: "Jane Doe", unit: "lb" });
  const real = Date.now, t0 = real(), perf0 = performance.now.bind(performance);
  sb.seed("ft_trainings", "K", empty("K", new Date(t0 - 3 * 3600e3).toISOString(), fns.localIso(new Date(t0 + 86400e3))), { client_id: "c1" });
  let r;
  try {
    await fns.syncDownNow(); await settle();
    fill(sb, "K"); sb.setFail({ times: 1e6, message: "TypeError: Failed to fetch" });
    const realNow = real(); Date.now = () => realNow + after; performance.now = () => perf0() + 2 * 3600e3;
    app.set({ view: { name: "client", id: "c1" } }); fns.render(); await tick(30);
    sb.setFail(null); app.set({ offline: false }); flushAll(); await settle();
    r = [sb.tables.ft_trainings.has("K"), deletes(sb, "K")];
  } finally { Date.now = real; delete performance.now; stopTimers(); app.reset(); localStorage.clear(); }
  assert.deepStrictEqual(r, [true, 0]);
});

const draw = (fn) => {                                                  // the client page's three lists, as missed.test.js reads them
  const make = document.createElement, ids = ["missList", "todayList", "nextList"], lists = ids.map((id) => document.getElementById(id)), got = {};
  document.createElement = (tag) => { const e = make(tag); e.kids = []; e.on = {}; e.attrs = {}; let inner = ""; e.appendChild = (c) => { e.kids.push(c); return c; }; e.append = (...k) => { e.kids.push(...k); }; e.addEventListener = (type, f) => { (e.on[type] ||= []).push(f); }; e.setAttribute = (k, v) => { e.attrs[k] = String(v); }; Object.defineProperty(e, "innerHTML", { configurable: true, get: () => inner, set: (v) => { inner = String(v); e.firstChild = /^<span/.test(inner) ? { textContent: "" } : make("span"); } }); return e; };
  lists.forEach((l, k) => { got[ids[k]] = []; l.replaceChildren = (...kids) => { got[ids[k]] = kids; }; l.appendChild = (c) => { got[ids[k]].push(c); return c; }; });
  try { return fn(got); } finally { document.createElement = make; for (const l of lists) { delete l.replaceChildren; delete l.appendChild; } }
};
test("an empty workout whose day has gone is shown nowhere, on the client's phone or the coach's page with a copy not fresh (the eighteenth check round: past a week it stayed on the Missed card for good, and Skip all filed it in History and Attendance): not Missed, not Up next, no Skip all for it", () => {
  const day = (k) => { const d = new Date(); d.setDate(d.getDate() + k); return fns.localIso(d); };
  for (const client of [true, false]) {
    stopTimers(); app.reset(); fns.missReset();
    app.set({ signedIn: true, clientMode: client, myClientId: client ? "c1" : null, tab: "workouts", sb: {}, syncedOnce: true, syncedOn: fns.today(), syncedAt: Date.now() - 5 * 60e3, backend: null });
    maps.clients.set("c1", { id: "c1", name: "Jane Doe", unit: "lb" });
    maps.trainings.set("E10", empty("E10", ago(11 * 1440), day(-10))); maps.trainings.set("E1", empty("E1", ago(2 * 1440), day(-1)));
    maps.trainings.set("U2", { ...empty("U2", ago(9 * 1440), day(-2)), title: "Upper body" }); maps.trainings.set("N3", empty("N3", ago(60), day(3)));   // a real missed one, and an empty one ahead (still to be filled)
    app.set({ view: { name: "client", id: "c1" } });
    const got = draw((g) => { fns.render(); return g; });
    const tids = (lis) => lis.filter((li) => li.dataset && li.dataset.tid).map((li) => li.dataset.tid);
    assert.deepStrictEqual([fns.missedOf("c1").map((t) => t.id), tids(got.missList), tids(got.nextList), document.getElementById("skipAll").hidden], [["U2"], ["U2"], ["N3"], true], client ? "Jane's phone" : "the coach's page");
    assert.ok(!maps.trainings.get("E10").skippedAt && !maps.trainings.get("E1").skippedAt, "never filed");
  }
  stopTimers(); app.set({ sb: null }); app.reset(); localStorage.clear();
});

test("the device's list of its own new workouts holding anything but a list is none (the eighteenth check round: hardening, as the device copy's)", async () => {
  for (const v of ['{"k":1}', "5", '"abc"', "null", "not json"]) {
    const sb = makeSupabase(); coachOn(sb); localStorage.setItem("fiala.made", v);
    fns.loadMade(); fns.addTraining("c1", null, later(2)); await settle();
    const id = app.get().view.id;
    assert.ok(maps.trainings.has(id) && Array.isArray(JSON.parse(localStorage.getItem("fiala.made"))), v + ": the new workout made, the list written again");
    stopTimers(); app.reset(); localStorage.clear();
  }
});

// the smallest tests for round 17's undos no test caught (the eighteenth check round's list): each call site of the held-back check, the pick note's Cancel, the answers' storage event, the device list's clear sites
const waitEdit = async (sb, id) => { sb.setFail({ op: "update", times: 100000, message: "Failed to fetch" }); maps.trainings.get(id).date = later(4); fns.scheduleSave("trainings", id, 0); await settle(); };
const backOn = async (sb) => { sb.setFail(null); app.set({ offline: false }); flushAll(); await settle(); };
test("an empty workout made on the iPad 3 hours ago, moved here on one bar of signal while the iPad fills it: opening Jane's page tidies nothing; opened here with a question up while the iPad fills it, then Cancel and Back: kept", async () => {
  for (const how of ["Jane's page", "a question, then Back"]) {
    const sb = makeSupabase(); coachOn(sb); app.set({ view: { name: "clients" } }); sb.seed("ft_clients", "c1", { id: "c1", name: "Jane Doe", unit: "lb" }); sb.seed("ft_trainings", "E1", empty("E1", ago(180), later(3)), { client_id: "c1" });
    await fns.syncDownNow(); await settle();
    if (how === "Jane's page") { await waitEdit(sb, "E1"); fill(sb, "E1"); await fns.syncDownNow(); await settle(); app.set({ view: { name: "client", id: "c1" } }); fns.render(); await settle(); }
    else { fns.go({ name: "training", id: "E1" }); await settle(); app.set({ asking: true }); fill(sb, "E1"); await fns.syncDownNow(); await settle(); app.set({ asking: false }); fns.go({ name: "client", id: "c1" }, true); await settle(); }
    await backOn(sb);
    const s = sb.tables.ft_trainings.get("E1"); stopTimers(); app.reset(); localStorage.clear();
    assert.deepStrictEqual([!!s, s && s.data.title], [true, "Legs"], how);
  }
});
test("the pick note's Cancel gives up only this page's own empty workout: never one the last sync held back or one filled meanwhile; one that never reached the server goes; after it nothing is being chosen and the note has gone; its button runs it", async () => {
  const out = {};
  for (const how of ["held back", "filled meanwhile", "never reached the server"]) {
    const sb = makeSupabase(); coachOn(sb); app.set({ view: { name: "clients" } }); sb.seed("ft_clients", "c1", { id: "c1", name: "Jane Doe", unit: "lb" });
    if (how === "never reached the server") sb.setFail({ times: 100000, message: "Failed to fetch" }); else { await fns.syncDownNow(); await settle(); }
    fns.addTraining("c1", null, later(2)); await settle(); const id = app.get().view.id;
    if (how === "held back") { await waitEdit(sb, id); fill(sb, id); await fns.syncDownNow(); await settle(); }
    fns.fromTemplate(maps.trainings.get(id)); await settle();
    if (how === "filled meanwhile") { fill(sb, id); await fns.syncDownNow(); await settle(); }
    assert.strictEqual(document.getElementById("pickNote").hidden, false, how + ": choosing, the note shows");
    fns.cancelPick(); await settle();
    const ch = fns.choosing(); assert.deepStrictEqual([ch.pickFor, ch.fillFor, document.getElementById("pickNote").hidden], [null, null, true], how + ": nothing chosen any more");
    await backOn(sb);
    out[how] = { here: maps.trainings.has(id), server: sb.tables.ft_trainings.has(id) };
    stopTimers(); app.reset(); localStorage.clear();
  }
  assert.deepStrictEqual(out, { "held back": { here: true, server: true }, "filled meanwhile": { here: true, server: true }, "never reached the server": { here: false, server: false } });
  const fsrc = await import("node:fs"), src = fsrc.readFileSync(new URL("../app/main.js", import.meta.url), "utf8");
  assert.ok(src.includes('$("pickCancel").addEventListener("click", cancelPick);'), "the button runs cancelPick (the stand-ins drop listeners on buttons made through innerHTML)");
});
test("the answers' storage event is read as the answers are now: a frozen tab of the client's waking to an old event with a Don't Allow since sent and followed by an Agree takes nothing (her health details stay)", async () => {
  app.reset(); localStorage.clear(); fns.leaveSettings();
  app.set({ sb: makeSupabase(), signedIn: true, clientMode: true, myClientId: "c1", backend: fns.clientBackend, sessionEmail: "jane@x.com", view: { name: "client", id: "c1" } });
  maps.clients.set("c1", { id: "c1", name: "Jane Doe", email: "jane@x.com", unit: "lb", choices: { health: { state: "agreed", at: "2026-11-23T10:05:00.000Z", by: "client", id: "ans-agree" } }, health: { allergies: "Latex" }, sex: "female" });
  const SIDE = "fiala.pending.answers.v1", old = { wd: [], held: [], settled: [], choices: [["c1", [["health", { id: "ans-decline", answer: "decline", parent: null, at: "2026-11-23T10:00:00.000Z", by: "client" }]]]], owner: "jane@x.com", tab: "tab-B" };
  localStorage.setItem(SIDE, JSON.stringify({ ...old, choices: [], settled: [["ans-decline", "ok"], ["ans-agree", "ok"]] }));   // tab B now: both sent, nothing waiting
  fns.onStorage({ key: SIDE, newValue: JSON.stringify(old) }); await tick(5);
  const c = maps.clients.get("c1"), got = { pending: maps.pendingChoices.has("c1"), state: c.choices.health.state, allergies: (c.health || {}).allergies };
  stopTimers(); app.reset(); localStorage.clear();
  assert.deepStrictEqual(got, { pending: false, state: "agreed", allergies: "Latex" });
});
async function bootWith(sb, email) {
  let onAuth = null; sb.auth = { ...sb.auth, getSession: async () => ({ data: { session: { user: { email } } } }), onAuthStateChange(cb) { onAuth = cb; }, signOut: async () => ({ error: null }) };
  globalThis.supabase = { createClient: () => sb };
  app.set({ sb: null, signedIn: false, clientMode: false, myClientId: null, backend: null, offline: false, syncedOnce: false, syncedAt: 0 }); maps.clients.clear(); maps.trainings.clear();
  await fns.boot(); await settle(); return onAuth;
}
test("the device's list of its own new workouts goes with the account: another account signing in on the device takes it; a session ended elsewhere takes this page's own too; an entry stamped ahead of the clock is not this device's own; at most 50 are kept", async () => {
  app.reset(); localStorage.clear(); let got;
  try {
    localStorage.setItem("fiala.trainings.role", JSON.stringify({ email: "coach@x.com", role: "trainer" }));
    localStorage.setItem("fiala.pending.v1", JSON.stringify({ owner: "other@x.com", tab: "old-tab", dirty: [], recs: [] }));   // the queue of the account that used the device last
    localStorage.setItem("fiala.made", JSON.stringify([["OTHER1", Date.now() - 60e3]]));
    const sb = makeSupabase(); sb.seed("ft_clients", "c1", { id: "c1", name: "Jane Doe", unit: "lb" });
    await bootWith(sb, "coach@x.com");
    got = [localStorage.getItem("fiala.made"), maps.madeHere.has("OTHER1")];
  } finally { delete globalThis.supabase; stopTimers(); app.reset(); localStorage.clear(); }
  assert.deepStrictEqual(got, [null, false], "another account");
  try {
    localStorage.setItem("fiala.trainings.role", JSON.stringify({ email: "coach@x.com", role: "trainer" }));
    const sb = makeSupabase(); sb.seed("ft_clients", "c1", { id: "c1", name: "Jane Doe", unit: "lb" });
    localStorage.setItem("fiala.made", JSON.stringify([["MINE1", Date.now() - 60e3]]));
    const onAuth = await bootWith(sb, "coach@x.com");
    assert.ok(maps.madeHere.has("MINE1"), "loaded at boot");
    onAuth("SIGNED_OUT"); await settle();
    got = [localStorage.getItem("fiala.made"), maps.madeHere.has("MINE1")];
  } finally { delete globalThis.supabase; stopTimers(); app.reset(); localStorage.clear(); }
  assert.deepStrictEqual(got, [null, false], "a session ended elsewhere");
  localStorage.setItem("fiala.made", JSON.stringify([["AHEAD1", Date.now() + 3600e3]])); fns.loadMade();
  assert.strictEqual(maps.madeHere.has("AHEAD1"), false, "stamped ahead"); app.reset(); localStorage.clear();
  const sb = makeSupabase(); coachOn(sb); sb.seed("ft_clients", "c1", { id: "c1", name: "Jane Doe", unit: "lb" }); await fns.syncDownNow(); await settle();
  localStorage.setItem("fiala.made", JSON.stringify(Array.from({ length: 60 }, (_, i) => ["OLD" + i, Date.now() - 1000 - i])));
  fns.addTraining("c1", null, later(2), true); await settle();
  assert.strictEqual(JSON.parse(localStorage.getItem("fiala.made")).length, 50, "at most 50");
  stopTimers(); app.reset(); localStorage.clear();
});
test("two tabs, the rest of the rule (the eighteenth check round): a newer copy taken while this tab's save of the older one is out goes after it, so the finished edit ends on the server; this tab's own edit, made after it took the other tab's copy, stands over that tab's later copies", async () => {
  for (const how of ["a save already out", "this tab's own edit"]) {
    const sb = makeSupabase(); coachOn(sb); sb.seed("ft_clients", "c1", { id: "c1", name: "Jane Doe", unit: "lb" });
    const w0 = { id: "W", clientId: "c1", title: "Upper body", date: fns.today(), createdAt: new Date(Date.now() - 86400e3).toISOString(), completedAt: null, skippedAt: null, rows: [] };
    const s0 = sb.seed("ft_trainings", "W", w0, { client_id: "c1" });
    let got;
    try {
      await fns.syncDownNow(); await settle();
      const doc0 = JSON.stringify(sb.tables.ft_trainings.get("W").data), at = (v) => ({ ...JSON.parse(doc0), title: v });
      writeB(bQueue(at("Upper body "), s0, doc0)); storageEv();                     // the other tab's first keystroke, taken
      if (how === "a save already out") {
        for (const tm of maps.timers.values()) clearTimeout(tm); maps.timers.clear();
        sb.delayMs = 60; const out = fns.flushOne("trainings", "W"); await tick(5);  // this tab's save of it is on its way
        writeB(bQueue(at("Upper body A"), s0, doc0)); storageEv();                  // the finished name, taken meanwhile
        { const s = sb.tables.ft_trainings.get("W"); s.data = at("Upper body A"); s.updated_at = "2026-10-13T00:30:00Z"; }   // and the other tab's own save of it lands first
        await out; sb.delayMs = 0; await settle();
        got = sb.tables.ft_trainings.get("W").data.title;
        assert.strictEqual(got, "Upper body A", how + ": the finished name ends on the server");
      } else {
        await settle();
        maps.trainings.get("W").title = "Lower body"; fns.scheduleSave("trainings", "W"); for (const tm of maps.timers.values()) clearTimeout(tm); maps.timers.clear();   // renamed here, its save waiting
        writeB(bQueue(at("Upper body A"), s0, doc0)); storageEv();                  // the other tab's later copy
        got = maps.trainings.get("W").title;
        assert.strictEqual(got, "Lower body", how + ": this tab's own edit stands");
      }
    } finally { sb.delayMs = 0; stopTimers(); app.reset(); localStorage.clear(); }
  }
});
test("the steady clock is the sync's own: a page open for an hour (its steady clock long past 90 s) still tidies right after its sync, and not once the sync is 90 s old on that clock", async () => {
  const perf0 = performance.now.bind(performance); let r;
  try {
    performance.now = () => perf0() + 60 * 60e3;                                    // the page has been open an hour
    const sb = makeSupabase(); coachOn(sb); app.set({ view: { name: "clients" } }); sb.seed("ft_clients", "c1", { id: "c1", name: "Jane Doe", unit: "lb" });
    sb.seed("ft_trainings", "OLD1", empty("OLD1", ago(180), later(2)), { client_id: "c1" }); sb.seed("ft_trainings", "OLD2", empty("OLD2", ago(180), later(3)), { client_id: "c1" });
    await fns.syncDownNow(); await settle();
    app.set({ view: { name: "client", id: "c1" } }); fns.render(); await settle();   // right after the sync: tidied
    const first = [maps.trainings.has("OLD1"), sb.tables.ft_trainings.has("OLD1")];
    performance.now = () => perf0() + 60 * 60e3 + 120e3;                            // two minutes on, on the steady clock (the wall clock not moved: a clock set back)
    sb.seed("ft_trainings", "OLD3", empty("OLD3", ago(180), later(4)), { client_id: "c1" }); maps.trainings.set("OLD3", empty("OLD3", ago(180), later(4))); maps.seenAt.set("trainings/OLD3", sb.tables.ft_trainings.get("OLD3").updated_at);   // in this page's copy, no sync since
    fns.render(); await settle();
    r = [first, maps.trainings.has("OLD3")];
  } finally { delete performance.now; stopTimers(); app.reset(); localStorage.clear(); }
  assert.deepStrictEqual(r, [[false, false], true]);
});

// ---------- the nineteenth check round ----------
// Another window of the app is laid out as its persistPending writes its queue, and its own saves land on the stand-in server through
// the same update the coach's save makes; this process is the window behind.
const QE = () => ({ deliv: [], wd: [], dirty: [], weights: [], done: [], early: [], rownotes: [], profile: [], under: [], held: [], settled: [], choices: [], finish: [], skip: [], move: [], miss: [], swap: [], order: [], touched: [], named: [], noted: [], state: [], plans: [], profTouched: [], notesGone: [], packagesGone: [], foldersGone: [], foldersTouched: [], fromFile: [], stamps: [], docs: [], recs: [], gone: [], owner: "coach@x.com", tab: "" });
const qFrom = (tab, k, rec, stamp, doc, extra = {}) => ({ ...QE(), ...extra, tab, dirty: [k], recs: [[k, rec]], stamps: [[k, stamp]], docs: [[k, doc]] });
const writeQ = (q) => { localStorage.setItem("fiala.pending.v1", JSON.stringify(q)); localStorage.setItem("fiala.pending.answers.v1", JSON.stringify({ wd: [], held: [], settled: [], choices: [], owner: q.owner, tab: q.tab })); localStorage.setItem("fiala.pending.tab", q.tab); };
const freeze = () => { const keys = [...maps.timers.keys()]; stopTimers(); return keys; };   // a frozen window: its timers wait
const wake = async (keys, order) => { if (order === "events first") storageEv(); for (const k of keys) { const [kind, id] = k.split("/"); fns.flushOne(kind, id); } if (order !== "events first") storageEv(); await settle(); };
const landOther = async (sb, table, id, data, stamp, extra = {}) => { const r = await sb.from(table).update({ id, data, ...extra }).eq("id", id).eq("updated_at", stamp).select("updated_at"); return !!(r.data && r.data[0]); };   // the other window's own save
const W0 = () => ({ id: "W", clientId: "c1", title: "Upper body", date: fns.today(), createdAt: new Date(Date.now() - 86400e3).toISOString(), completedAt: null, skippedAt: null, rows: [{ id: "r1", label: "1", name: "Bench press", sets: 4, reps: "8", weights: [], repsDone: [], setsDone: 0, done: false }] });
const endTabs = () => { stopTimers(); clearTimeout(app.get().syncTimer); app.reset(); localStorage.clear(); };
for (const order of ["events first", "timer first"]) test("a window behind takes the first keystroke of a rename typed in the other and is frozen before its own save; it wakes after the finished name landed: the finished name stays, and the coach's edit there before its next sync keeps it (the nineteenth check round, " + order + ": it wrote the old copy over the later change as it woke)", async () => {
  const sb = makeSupabase(); coachOn(sb); sb.seed("ft_clients", "c1", { id: "c1", name: "Jane Doe", unit: "lb" });
  const s0 = sb.seed("ft_trainings", "W", W0(), { client_id: "c1" });
  let got;
  try {
    await fns.syncDownNow(); await settle();
    const doc0 = JSON.stringify(sb.tables.ft_trainings.get("W").data), at = (v) => ({ ...JSON.parse(doc0), title: v });
    writeQ(qFrom("tab-B", "trainings/W", at("Upper body "), s0, doc0)); storageEv();   // B's first keystroke: taken here
    const took = maps.trainings.get("W").title, late = freeze();
    writeQ(qFrom("tab-B", "trainings/W", at("Upper body A"), s0, doc0));              // B types on: this window hears nothing now
    const landed = await landOther(sb, "ft_trainings", "W", at("Upper body A"), s0, { client_id: "c1" });
    writeQ({ ...QE(), tab: "tab-B" });                                                // B's queue after its save: nothing waiting
    await wake(late, order);
    const woke = sb.tables.ft_trainings.get("W").data.title;
    maps.trainings.get("W").date = later(2); fns.touchState("W", "date"); fns.scheduleSave("trainings", "W", 0); await settle();   // the coach moves it in this window before its next sync (Reschedule)
    got = { took, landed, woke, edited: [sb.tables.ft_trainings.get("W").data.title, sb.tables.ft_trainings.get("W").data.date] };
  } finally { endTabs(); }
  assert.deepStrictEqual(got, { took: "Upper body ", landed: true, woke: "Upper body A", edited: ["Upper body A", later(2)] });
});
test("the same on the coach's card, and with three windows (the nineteenth check round): Jane's second phone number stays; a copy relayed by a third window gives way too", async () => {
  const out = {};
  { const sb = makeSupabase(); coachOn(sb); const s0 = sb.seed("ft_clients", "c1", { id: "c1", name: "Jane Doe", unit: "lb", phone: "3105550100" });
    try {
      await fns.syncDownNow(); await settle();
      const doc0 = JSON.stringify(sb.tables.ft_clients.get("c1").data), at = (v) => ({ ...JSON.parse(doc0), phone: v });
      writeQ(qFrom("tab-B", "clients/c1", at("3105550111"), s0, doc0)); storageEv(); const late = freeze();
      writeQ(qFrom("tab-B", "clients/c1", at("3105550199"), s0, doc0)); await landOther(sb, "ft_clients", "c1", at("3105550199"), s0);
      writeQ({ ...QE(), tab: "tab-B" }); await wake(late, "events first");
      out.card = sb.tables.ft_clients.get("c1").data.phone;
      await new Promise((r) => setTimeout(r, 450)); for (const t0 = Date.now(); app.get().syncing && Date.now() - t0 < 10000;) await tick(5); await settle(); out.cardHere = maps.clients.get("c1").phone;   // the sync the wake asked for brings the server's copy here (its 300-ms timer fires before this wait ends; then its read is waited for: on a busy machine it was still out at 450 ms, the twenty-first check round)
    } finally { endTabs(); } }
  { const sb = makeSupabase(); coachOn(sb); sb.seed("ft_clients", "c1", { id: "c1", name: "Jane Doe", unit: "lb" }); const s0 = sb.seed("ft_trainings", "W", W0(), { client_id: "c1" });
    try {
      await fns.syncDownNow(); await settle();
      const doc0 = JSON.stringify(sb.tables.ft_trainings.get("W").data), at = (v) => ({ ...JSON.parse(doc0), title: v });
      writeQ(qFrom("tab-C", "trainings/W", at("Upper body "), s0, doc0)); storageEv(); const late = freeze();   // C relays B's first keystroke
      writeQ(qFrom("tab-B", "trainings/W", at("Upper body A"), s0, doc0)); storageEv(); freeze();               // B's own copy: this window took C's, so it keeps that one
      await landOther(sb, "ft_trainings", "W", at("Upper body A"), s0, { client_id: "c1" });
      writeQ({ ...QE(), tab: "tab-B" }); storageEv(); freeze();
      await wake(late, "timer first");
      out.relay = sb.tables.ft_trainings.get("W").data.title;
    } finally { endTabs(); } }
  assert.deepStrictEqual(out, { card: "3105550199", cardHere: "3105550199", relay: "Upper body A" });
});
test("the client's phone with two pages (the nineteenth check round): the page behind took set 1 and was suspended; sets 1 and 2 landed from the front page; as it wakes it sends nothing, and both sets stay", async () => {
  const sb = makeSupabase(); app.reset(); fns.leaveSettings();
  app.set({ sb, signedIn: true, clientMode: true, myClientId: "c1", backend: fns.clientBackend, sessionEmail: "jane@x.com", view: { name: "client", id: "c1" } });
  maps.clients.set("c1", { id: "c1", name: "Jane Doe", unit: "lb", email: "jane@x.com" });
  const row = (w, id = "r1") => ({ id, label: id === "r1" ? "1" : "2", name: id === "r1" ? "Back squat" : "Lunge", sets: 3, reps: "8", rest: "", tempo: "", weights: w, repsDone: w.map(() => "8"), setsDone: w.length, done: false, note: "", alts: [], logSeq: 0, unit: "lb" });
  const T = (w) => ({ id: "T", clientId: "c1", title: "Legs", date: fns.today(), createdAt: "2026-11-20T10:00:00.000Z", completedAt: null, skippedAt: null, rows: [row(w), row([], "r2")] });
  sb.seed("ft_trainings", "T", T([]), { client_id: "c1" });
  const calls = [];
  sb.rpcs.client_log_set = async (a) => {                                                         // client-log-set.sql's number rule
    const s = sb.tables.ft_trainings.get(a.p_training), r = s.data.rows.find((x) => x.id === a.p_row), held = typeof r.logSeq === "number" ? r.logSeq : null;
    calls.push([a.p_seq, (a.p_weights || []).join(",")]);
    if (a.p_seq != null && (held || 0) > a.p_seq) return held;
    r.weights = a.p_weights; r.repsDone = a.p_reps; r.setsDone = a.p_sets_done; r.done = !!a.p_done; if (a.p_seq != null) r.logSeq = a.p_seq; s.updated_at = "2026-10-13T01:00:" + String(calls.length).padStart(2, "0") + "Z"; return a.p_seq;
  };
  maps.trainings.set("T", T([]));
  const qB = (rec) => ({ ...QE(), owner: "jane@x.com", tab: "tab-B", ...(rec ? { dirty: ["trainings/T"], weights: [["T", ["r1"]]], recs: [["trainings/T", rec]] } : {}) });
  let got;
  try {
    writeQ(qB(T(["135"]))); storageEv(); const late = freeze();                                  // set 1, taken here; then suspended
    await sb.rpcs.client_log_set({ p_training: "T", p_row: "r1", p_weights: ["135"], p_reps: ["8"], p_sets_done: 1, p_done: false, p_unit: "lb", p_seq: 1 });
    writeQ(qB(T(["135", "140"])));
    await sb.rpcs.client_log_set({ p_training: "T", p_row: "r1", p_weights: ["135", "140"], p_reps: ["8", "8"], p_sets_done: 2, p_done: false, p_unit: "lb", p_seq: 2 });
    writeQ(qB(null)); calls.length = 0;
    await wake(late, "events first");
    const woke = calls.length;
    { const t = maps.trainings.get("T"), r2 = t.rows[1]; r2.weights = ["95"]; r2.repsDone = ["8"]; r2.setsDone = 1; maps.pendingWeightRows.set("T", new Set([...(maps.pendingWeightRows.get("T") || []), "r2"])); fns.scheduleSave("trainings", "T", 0); await settle(); }   // she logs the lunge on this page before its next sync: only the lunge goes
    got = [woke, calls.map((c) => c[1]), sb.tables.ft_trainings.get("T").data.rows[0].weights.join(",")];
  } finally { endTabs(); }
  assert.deepStrictEqual(got, [0, ["95"], "135,140"]);
});
test("a copy taken from another window still goes from here when that window never sent it (the nineteenth check round's fix keeps these): closed before its own save, or still listing it in its queue", async () => {
  const out = [];
  for (const how of ["closed before its save", "still listing it"]) {
    const sb = makeSupabase(); coachOn(sb); sb.seed("ft_clients", "c1", { id: "c1", name: "Jane Doe", unit: "lb" }); const s0 = sb.seed("ft_trainings", "W", W0(), { client_id: "c1" });
    try {
      await fns.syncDownNow(); await settle();
      const doc0 = JSON.stringify(sb.tables.ft_trainings.get("W").data), at = (v) => ({ ...JSON.parse(doc0), title: v });
      writeQ(qFrom("tab-B", "trainings/W", at("Push day"), s0, doc0)); storageEv(); const late = freeze();
      if (how === "still listing it") writeQ(qFrom("tab-B", "trainings/W", at("Push day"), s0, doc0, { notesGone: [] }));   // B wrote again (another record's edit), its own save still to go
      await wake(late, "timer first");
      out.push(sb.tables.ft_trainings.get("W").data.title);
    } finally { endTabs(); }
  }
  assert.deepStrictEqual(out, ["Push day", "Push day"]);
});
test("a copy taken from one window gives way to that window's later copies only: a third window waking with an older copy of it never replaces it (the nineteenth check round: no test held which window)", async () => {
  const sb = makeSupabase(); coachOn(sb); sb.seed("ft_clients", "c1", { id: "c1", name: "Jane Doe", unit: "lb" });
  const s0 = sb.seed("ft_trainings", "W", W0(), { client_id: "c1" });
  let got;
  try {
    await fns.syncDownNow(); await settle();
    const doc0 = JSON.stringify(sb.tables.ft_trainings.get("W").data), at = (v) => ({ ...JSON.parse(doc0), title: v });
    writeQ(qFrom("tab-B", "trainings/W", at("Upper body A"), s0, doc0)); storageEv(); stopTimers();   // tab B's rename, taken here; this window's save of it waits
    writeQ(qFrom("tab-C", "trainings/W", at("Upper"), s0, doc0)); storageEv();                        // tab C wakes with its own older rename
    got = maps.trainings.get("W").title;
  } finally { endTabs(); }
  assert.strictEqual(got, "Upper body A");
});
test("the tests' reset clears takenFrom (the nineteenth check round: an entry outlived app.reset(), and a later test's own queued edit gave way to a queue from the same made-up window)", async () => {
  let got;
  try {
    { const sb = makeSupabase(); coachOn(sb); sb.seed("ft_clients", "c1", { id: "c1", name: "Jane Doe", unit: "lb" }); const s0 = sb.seed("ft_trainings", "W", W0(), { client_id: "c1" }); await fns.syncDownNow(); await settle();
      const doc0 = JSON.stringify(sb.tables.ft_trainings.get("W").data); writeQ(qFrom("tab-B", "trainings/W", { ...JSON.parse(doc0), title: "B's first" }, s0, doc0)); storageEv(); await settle(); }
    endTabs();
    { const sb = makeSupabase(); coachOn(sb); sb.seed("ft_clients", "c1", { id: "c1", name: "Jane Doe", unit: "lb" }); const s0 = sb.seed("ft_trainings", "W", W0(), { client_id: "c1" }); await fns.syncDownNow(); await settle();
      const doc0 = JSON.stringify(sb.tables.ft_trainings.get("W").data);
      localStorage.setItem("fiala.pending.v1", JSON.stringify(qFrom("old-page", "trainings/W", { ...JSON.parse(doc0), title: "Mine" }, s0, doc0))); fns.restorePending(); stopTimers();   // this page's own edit, queued at a relaunch
      writeQ(qFrom("tab-B", "trainings/W", { ...JSON.parse(doc0), title: "B's older copy" }, s0, doc0)); storageEv();
      got = maps.trainings.get("W").title; }
  } finally { endTabs(); }
  assert.strictEqual(got, "Mine");
});

const drawWeek = (fn) => {                                              // draw's lists and the week strip
  const make = document.createElement, ids = ["missList", "todayList", "nextList", "week"], lists = ids.map((id) => document.getElementById(id)), got = {};
  document.createElement = (tag) => { const e = make(tag); e.kids = []; e.on = {}; e.attrs = {}; e.dataset = {}; let inner = ""; e.appendChild = (c) => { e.kids.push(c); return c; }; e.append = (...k) => { e.kids.push(...k); }; e.addEventListener = (type, f) => { (e.on[type] ||= []).push(f); }; e.setAttribute = (k, v) => { e.attrs[k] = String(v); }; Object.defineProperty(e, "innerHTML", { configurable: true, get: () => inner, set: (v) => { inner = String(v); e.firstChild = /^<span/.test(inner) ? { textContent: "" } : make("span"); } }); return e; };
  lists.forEach((l, k) => { got[ids[k]] = []; l.replaceChildren = (...kids) => { got[ids[k]] = kids; }; l.appendChild = (c) => { got[ids[k]].push(c); return c; }; });
  try { return fn(got); } finally { document.createElement = make; for (const l of lists) { delete l.replaceChildren; delete l.appendChild; } }
};
test("today's empty workout still shows, on Today, in both views, and the week strip gives no chip to an empty one whose day has gone (the nineteenth check round: no test held either half of the eighteenth round's filter)", () => {
  const day = (k) => { const d = new Date(); d.setDate(d.getDate() + k); return fns.localIso(d); }, out = {};
  for (const client of [true, false]) {
    stopTimers(); app.reset(); fns.missReset();
    app.set({ signedIn: true, clientMode: client, myClientId: client ? "c1" : null, tab: "workouts", sb: {}, syncedOnce: true, syncedOn: fns.today(), syncedAt: Date.now() - 5 * 60e3, backend: null });
    maps.clients.set("c1", { id: "c1", name: "Jane Doe", unit: "lb" });
    maps.trainings.set("U2", { ...empty("U2", ago(9 * 1440), day(-2)), title: "Upper body" });   // a real missed one
    maps.trainings.set("E1", empty("E1", ago(2 * 1440), day(-1)));                               // an empty one whose day has gone
    maps.trainings.set("T0", empty("T0", ago(60), day(0)));                                       // an empty one today (still to be filled)
    maps.trainings.set("N3", { ...empty("N3", ago(60), day(3)), title: "Legs" });
    app.set({ view: { name: "client", id: "c1" } });
    if (new Date().getDay() === 1) fns.setWeekOff(-1);                  // a Monday: yesterday is in last week's strip
    const got = drawWeek((g) => { fns.render(); return g; });
    const tids = (lis) => lis.filter((li) => li && li.dataset && li.dataset.tid).map((li) => li.dataset.tid);
    const label = (key) => { const b = (got.week || []).find((x) => x && x.dataset && x.dataset.day === key); return b ? b.attrs["aria-label"] || "" : null; };
    out[client ? "Jane's phone" : "the coach's page"] = { today: tids(got.todayList), yesterday: label(day(-1)) };
    fns.setWeekOff(0);
  }
  stopTimers(); app.set({ sb: null }); app.reset(); localStorage.clear();
  for (const [who, r] of Object.entries(out)) assert.ok(r.today.includes("T0") && typeof r.yesterday === "string" && !r.yesterday.includes(":"), who + ": " + JSON.stringify(r));
});
test("an empty workout whose day has gone is in no preview walk and no day's list either, in both views, nor in the monthly report (the nineteenth check round: › landed on \"Nothing added yet\" with Skip, which filed it in History for good; the Also on pill named it \"Workout\"; the report said \"Not done\" and cut Attendance)", () => {
  const d = (n) => { const x = new Date(); x.setHours(12, 0, 0, 0); x.setDate(x.getDate() + n); return fns.localIso(x); };
  const row = (id, name, x) => ({ id, label: "1", name, sets: 3, reps: "8", weights: [], repsDone: [], setsDone: 0, done: false, ...x });
  const seed = (client) => {
    stopTimers(); app.reset(); fns.leaveSettings();
    maps.clients.set("c1", { id: "c1", name: "Jane Doe", unit: "lb", email: "jane@x.com" });
    maps.trainings.set("S", { id: "S", clientId: "c1", title: "Upper body", date: d(-3), createdAt: ago(9 * 1440), completedAt: null, skippedAt: null, rows: [row("s1", "Bench press")] });   // missed
    maps.trainings.set("E", empty("E", ago(3 * 1440), d(-2)));                                    // an accidental day tap, not tidied yet
    maps.trainings.set("F", { id: "F", clientId: "c1", title: "Core", date: d(-2), createdAt: ago(9 * 1440), completedAt: new Date(d(-2) + "T18:00:00").toISOString(), skippedAt: null, rows: [row("f1", "Plank", { setsDone: 3, done: true, weights: ["", "", ""], repsDone: ["60", "60", "60"] })] });
    maps.trainings.set("N", { id: "N", clientId: "c1", title: "Legs", date: d(1), createdAt: ago(9 * 1440), completedAt: null, skippedAt: null, rows: [row("n1", "Back squat")] });
    app.set({ signedIn: true, clientMode: client, myClientId: client ? "c1" : null, sessionEmail: client ? "jane@x.com" : "coach@x.com", view: { name: "client", id: "c1" } });
  };
  const out = {};
  try {
    for (const client of [true, false]) { seed(client); out[client ? "phone" : "coach"] = [fns.previewWalk("c1"), fns.dayList("c1", d(-2)).map((t) => t.id)]; }
    seed(false); maps.trainings.delete("S"); maps.trainings.delete("N");   // the report's month: only Sunday's two
    const text = Buffer.from(fns.buildReport(d(-2).slice(0, 7), null, maps.clients.get("c1")).bytes).toString("latin1");
    out.report = [(text.match(/\(Not done\)/g) || []).length, (text.match(/\(Workout\)/g) || []).length, (text.match(/\((\d+)%\)/) || [])[1]];
  } finally { stopTimers(); app.reset(); localStorage.clear(); }
  assert.deepStrictEqual(out, { phone: [["S", "F", "N"], ["F"]], coach: [["S", "F", "N"], ["F"]], report: [0, 0, "100"] });
});

// ---------- the twentieth check round ----------
test("the client's page behind took the front page's copy with every kind of change queued (a set, a tick, a note, a reason, a swap, an order, a finish, a skip, a move, a filing) and was suspended; the front page sent them all; as the page behind wakes and she logs the lunge there before its next sync, only the lunge goes (the twentieth check round: leaving any one of those queues behind passed every test, and a finish she had taken back was sent again)", async () => {
  const sb = makeSupabase(); app.reset(); fns.leaveSettings();
  app.set({ sb, signedIn: true, clientMode: true, myClientId: "c1", backend: fns.clientBackend, sessionEmail: "jane@x.com", view: { name: "client", id: "c1" } });
  maps.clients.set("c1", { id: "c1", name: "Jane Doe", unit: "lb", email: "jane@x.com" });
  const row = (id, x) => ({ id, label: id === "r1" ? "1" : "2", name: id === "r1" ? "Back squat" : "Lunge", sets: 3, reps: "8", rest: "", tempo: "", weights: [], repsDone: [], setsDone: 0, done: false, note: "", alts: ["Front squat"], logSeq: 0, unit: "lb", ...x });
  const T = (x, r1) => ({ id: "T", clientId: "c1", title: "Legs", date: fns.today(), createdAt: "2026-11-20T10:00:00.000Z", completedAt: null, skippedAt: null, rows: [row("r1", r1), row("r2", {})], ...x });
  sb.seed("ft_trainings", "T", T({}, {}), { client_id: "c1" });
  maps.trainings.set("T", T({}, {}));
  const calls = [];
  for (const name of ["client_log_set", "client_finish_training", "client_skip_training", "client_move_training", "client_miss_training", "client_order_rows", "client_swap_exercise", "client_set_done", "client_row_note", "client_finish_early"]) sb.rpcs[name] = async (a) => { calls.push(name + (a.p_row ? ":" + a.p_row : "")); return a.p_seq != null ? a.p_seq : null; };
  const taken = T({ completedAt: "2026-11-24T01:00:00.000Z", skippedAt: "2026-11-24T00:30:00.000Z", skipReason: "Sick", missed: true, date: later(1) }, { name: "Front squat", label: "1", weights: ["135"], repsDone: ["8"], setsDone: 1, done: true, clientNote: "knee sore", clientNoteBy: "client", earlyReason: "Discomfort" });   // what the front page had queued when this page took it (every queue at once: the list is what is held)
  const qB = (rec) => ({ ...QE(), owner: "jane@x.com", tab: "tab-B", ...(rec ? { dirty: ["trainings/T"], recs: [["trainings/T", rec]], weights: [["T", ["r1"]]], done: [["T", ["r1"]]], early: [["T", ["r1"]]], rownotes: [["T", ["r1"]]], swap: [["T", [["r1", "Front squat"]]]], finish: ["T"], skip: ["T"], move: ["T"], miss: ["T"], order: ["T"] } : {}) });
  let got;
  try {
    writeQ(qB(taken)); storageEv(); const late = freeze();                                        // taken here; then suspended
    writeQ(qB(null)); calls.length = 0;                                                            // the front page sent it all (and she undid each since): its queue lists nothing
    await wake(late, "events first");
    const woke = [...calls];
    { const t = maps.trainings.get("T"), r2 = t.rows[1]; r2.weights = ["95"]; r2.repsDone = ["8"]; r2.setsDone = 1; maps.pendingWeightRows.set("T", new Set([...(maps.pendingWeightRows.get("T") || []), "r2"])); fns.scheduleSave("trainings", "T", 0); await settle(); }   // she logs the lunge on this page before its next sync
    got = [woke, calls.slice(woke.length)];
  } finally { endTabs(); }
  assert.deepStrictEqual(got, [[], ["client_log_set:r2"]]);
});

test("a window behind takes the other window's Reschedule (its day's mark with it) and is frozen; that window's save lands, then Jane moves the workout on her phone; the window behind wakes, and the coach renames an exercise there before its next sync: her move stands (the twentieth check round: the coach's marks left behind with the copy given up passed every test)", async () => {
  const sb = makeSupabase(); coachOn(sb); sb.seed("ft_clients", "c1", { id: "c1", name: "Jane Doe", unit: "lb" });
  const s0 = sb.seed("ft_trainings", "W", { ...W0(), date: later(1) }, { client_id: "c1" });
  let got;
  try {
    await fns.syncDownNow(); await settle();
    const doc0 = JSON.stringify(sb.tables.ft_trainings.get("W").data), moved = { ...JSON.parse(doc0), date: later(3) };
    writeQ(qFrom("tab-B", "trainings/W", moved, s0, doc0, { state: [["W", ["date"]]] })); storageEv(); const late = freeze();   // B's Reschedule, taken here
    await landOther(sb, "ft_trainings", "W", moved, s0, { client_id: "c1" });                                                  // B's save lands
    { const s = sb.tables.ft_trainings.get("W"); s.data.date = later(5); s.updated_at = "2026-11-24T09:00:00.000Z"; }          // Jane moves it on her phone
    writeQ({ ...QE(), tab: "tab-B" });
    await wake(late, "events first");
    { const t = maps.trainings.get("W"); t.rows[0].name = "Incline press"; maps.trainerNamed.set("W", new Set(["r1"])); fns.scheduleSave("trainings", "W", 0); await settle(); }   // the coach renames the exercise in this window before its next sync
    const s = sb.tables.ft_trainings.get("W").data; got = [s.date, s.rows[0].name];
  } finally { endTabs(); }
  assert.deepStrictEqual(got, [later(5), "Incline press"]);
});

test("the monthly report keeps today's empty workout as planned: only one whose day has gone is left out, as the app shows today's on Today (the twentieth check round: the report's own copy of the rule, written as \"today or before\", passed every test)", () => {
  stopTimers(); app.reset(); fns.leaveSettings();
  maps.clients.set("c1", { id: "c1", name: "Jane Doe", unit: "lb", email: "jane@x.com" });
  maps.trainings.set("E0", { id: "E0", clientId: "c1", title: "", date: fns.today(), createdAt: new Date(Date.now() - 3600e3).toISOString(), completedAt: null, skippedAt: null, rows: [] });   // made for today's session, to fill there
  app.set({ signedIn: true, clientMode: false, sessionEmail: "coach@x.com", view: { name: "client", id: "c1" } });
  let text;
  try { text = Buffer.from(fns.buildReport(fns.today().slice(0, 7), null, maps.clients.get("c1")).bytes).toString("latin1"); } finally { stopTimers(); app.reset(); localStorage.clear(); }
  assert.deepStrictEqual([(text.match(/\(Planned\)/g) || []).length, text.includes("1 session still planned this month.")], [1, true]);
});
