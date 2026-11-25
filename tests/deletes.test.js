// v316 (the check rounds, 19 Nov 2026): only a Delete is ever sent as a deletion (deleteRec and the `deleting` marks), across a relaunch,
// another page of the app and a restore; a record that only left the map (a wipe, a deletion elsewhere) is never sent, nor stored to be
// sent after a relaunch; the client page's tidying spares a new empty workout; two windows never send one Delete back and forth.
// Made-up people only.
import fs from "node:fs";
import { test, assert, tick } from "./assert.js";
import { makeSupabase } from "./fake-supabase.js";
import { load } from "./load.js";
import { shownAgain } from "../app/sync.js";                            // (after load.js, whose env.js stand-ins sync.js needs at import)
const app = await load();
const { fns, maps } = app;
const settle = async () => { const until = Date.now() + 15000; do await tick(5); while ((app.get().inflight > 0 || maps.timers.size) && Date.now() < until); };
const AT = "2026-11-18T08:00:00.000Z";
const coachOn = (sb, extra) => { app.reset(); fns.leaveSettings(); app.set({ sb, signedIn: true, clientMode: false, backend: fns.cloudBackend, sessionEmail: "coach@x.com", view: { name: "client", id: "c1" } }); maps.clients.set("c1", { id: "c1", name: "Jane Doe", unit: "lb", ...(extra || {}) }); };
const w = (id, extra) => ({ id, clientId: "c1", title: "Legs", date: "2026-11-20", createdAt: AT, completedAt: null, skippedAt: null, rows: [{ id: "r1", label: "1", name: "Back squat", sets: 3, reps: "10", weights: [], done: false }], ...(extra || {}) });
const empty = (id, createdAt) => ({ id, clientId: "c1", title: "", date: "2026-11-21", createdAt, completedAt: null, skippedAt: null, rows: [] });
const flushAll = () => { for (const k of [...maps.dirty.keys()]) { const [kind, id] = k.split("/"); fns.flushOne(kind, id); } };
const deletes = (sb) => sb.log.filter((e) => e.op === "delete").length;

test("a Delete made with no signal, the app closed and opened again on a device copy that still holds it: the deletion still reaches the server", async () => {
  const sb = makeSupabase(); coachOn(sb); sb.seed("ft_trainings", "w6", w("w6")); maps.trainings.set("w6", w("w6"));
  sb.setFail({ times: 1000, message: "TypeError: Failed to fetch" });
  fns.deleteRec("trainings", "w6"); await settle();
  const q = localStorage.getItem("fiala.pending.v1");
  for (const tm of maps.timers.values()) clearTimeout(tm);
  app.reset(); localStorage.setItem("fiala.pending.v1", q); sb.setFail(null);   // the app closed; opened again with signal
  app.set({ sb, signedIn: true, clientMode: false, backend: fns.cloudBackend, sessionEmail: "coach@x.com", view: { name: "clients" } });
  maps.trainings.set("w6", w("w6"));                                       // the device copy saved before the Delete
  fns.restorePending(); assert.ok(maps.deleting.has("trainings/w6"), "the Delete's mark is back with the queue's gone");
  flushAll(); await settle();
  assert.deepStrictEqual([maps.trainings.has("w6"), sb.tables.ft_trainings.has("w6")], [false, false], "the Delete stands here and lands on the server");
  app.reset(); localStorage.clear();
});

test("another page's Delete, taken on here (that page discarded), still reaches the server", async () => {
  const sb = makeSupabase(); coachOn(sb); sb.seed("ft_trainings", "w7", w("w7")); maps.trainings.set("w7", w("w7"));
  localStorage.setItem("fiala.pending.tab", "other-tab");
  localStorage.setItem("fiala.pending.v1", JSON.stringify({ tab: "other-tab", owner: "coach@x.com", dirty: ["trainings/w7"], recs: [], gone: ["trainings/w7"] }));
  fns.persistPending(); await settle();
  const disk = JSON.parse(localStorage.getItem("fiala.pending.v1") || "{}");
  assert.deepStrictEqual([maps.trainings.has("w7"), sb.tables.ft_trainings.has("w7"), (disk.gone || []).length], [false, false, 0], "deleted here and on the server, and the queue no longer says gone");
  app.reset(); localStorage.clear();
});

test("a save for a record that only left the map sends nothing and leaves no mark behind (a workout's note mark; a client's deleted-note mark)", async () => {
  const sb = makeSupabase(); coachOn(sb, { notes: { log: [{ id: "n1", at: AT, text: "Prefers mornings" }] } }); maps.trainings.set("w8", w("w8"));
  maps.trainings.delete("w8"); maps.trainerNoted.set("w8", new Set(["r1"])); fns.scheduleSave("trainings", "w8", 0);   // Save note on a workout page left up after its workout left the map
  maps.clients.delete("c1"); maps.deletedNotes.set("n1", "c1"); fns.scheduleSave("clients", "c1", 0);   // a note deleted on a card left up after its client left the map
  await settle();
  assert.deepStrictEqual([maps.trainerNoted.has("w8"), maps.deletedNotes.has("n1"), maps.dirty.size, deletes(sb)], [false, false, 0, 0], "nothing sent, nothing left queued, no mark left to claim the record once it is back");
  app.reset(); localStorage.clear();
});

test("a Delete's mark goes once its deletion lands", async () => {
  const sb = makeSupabase(); coachOn(sb); sb.seed("ft_trainings", "w9", w("w9")); maps.trainings.set("w9", w("w9"));
  fns.deleteRec("trainings", "w9"); await settle();
  assert.deepStrictEqual([sb.tables.ft_trainings.has("w9"), maps.deleting.has("trainings/w9"), maps.deletedHere.has("trainings/w9")], [false, false, true], "landed: the mark goes, and this page remembers it made the deletion");
  app.reset(); localStorage.clear();
});

test("the stored queue lists only a Delete, never a record that only left the map: a relaunch on a device copy that stopped saving writes nothing back", async () => {
  { const sb = makeSupabase(); coachOn(sb); sb.auth.getSession = async () => ({ data: { session: null } });   // no usable token: every save waits
    for (const id of ["w3", "w4"]) maps.trainings.set(id, w(id));
    fns.deleteRec("trainings", "w3"); maps.trainings.delete("w4"); fns.scheduleSave("trainings", "w4", 0); await settle();
    const q = JSON.parse(localStorage.getItem("fiala.pending.v1") || "{}");
    assert.deepStrictEqual([maps.dirty.has("trainings/w4"), q.dirty.includes("trainings/w4"), q.dirty.includes("trainings/w3"), q.gone], [true, false, true, ["trainings/w3"]], "w4 waits here, but the queue on the device never lists it; only the Delete is stored, as gone");
    app.reset(); localStorage.clear(); }
  { const sb = makeSupabase(); coachOn(sb);                                // W was deleted on the coach's other device: the server has none, and W left this page's map
    fns.scheduleSave("trainings", "W", 60000);                            // a save for W from a page still drawn
    for (const t of maps.timers.values()) clearTimeout(t); maps.timers.clear();   // the page is killed before it runs
    const queue = localStorage.getItem("fiala.pending.v1"), tab = localStorage.getItem("fiala.pending.tab");
    app.reset(); app.set({ sb, signedIn: true, clientMode: false, backend: fns.cloudBackend, sessionEmail: "coach@x.com" }); maps.clients.set("c1", { id: "c1", name: "Jane Doe", unit: "lb" });
    maps.trainings.set("W", w("W", { title: "Stale device copy" }));      // the device copy stopped saving before W left the map
    localStorage.setItem("fiala.pending.v1", queue); localStorage.setItem("fiala.pending.tab", tab);
    fns.restorePending(); fns.persistPending(); flushAll(); await settle();
    assert.ok(!sb.tables.ft_trainings.has("W"), "the workout deleted elsewhere is not written back (the check round: the relaunch sent the stale copy)");
    app.reset(); localStorage.clear(); }
});

test("Delete workout, leaving an empty workout, and the client page's tidying each delete on the server, not only here", async () => {
  const sb = makeSupabase(); coachOn(sb); app.set({ view: { name: "clients" } }); sb.seed("ft_clients", "c1", { id: "c1", name: "Jane Doe", unit: "lb" });
  const at = (id) => [maps.trainings.has(id), sb.tables.ft_trainings.has(id)];
  sb.seed("ft_trainings", "d2", empty("d2", AT), { client_id: "c1" }); await fns.syncDownNow(); await settle();   // on the Clients list: nothing tidied yet
  fns.go({ name: "training", id: "d2" }); fns.go({ name: "clients" }); await settle(); const d2 = at("d2");   // an empty workout left
  sb.seed("ft_trainings", "d1", w("d1"), { client_id: "c1" }); await fns.syncDownNow(); await settle();
  fns.deleteTraining("d1"); await settle(); const d1 = at("d1");          // the workout page's Delete workout
  sb.seed("ft_trainings", "d3", empty("d3", AT), { client_id: "c1" }); await fns.syncDownNow(); await settle();
  app.set({ view: { name: "client", id: "c1" } }); fns.render(); await settle();   // the client page tidies one left from before
  assert.deepStrictEqual([d1, d2, at("d3")], [[false, false], [false, false], [false, false]], "gone here and on the server");
  app.reset(); localStorage.clear();
});

test("the client page's tidying spares an empty workout made a minute ago (on the coach's other device or in another tab, still being filled)", async () => {
  const sb = makeSupabase(); coachOn(sb); app.set({ view: { name: "clients" } }); sb.seed("ft_clients", "c1", { id: "c1", name: "Jane Doe", unit: "lb" });
  const fresh = new Date(Date.now() - 60e3).toISOString(), old = new Date(Date.now() - 3 * 3600e3).toISOString();
  sb.seed("ft_trainings", "e1", empty("e1", fresh), { client_id: "c1" }); sb.seed("ft_trainings", "e2", empty("e2", old), { client_id: "c1" });
  await fns.syncDownNow(); await settle();
  app.set({ view: { name: "client", id: "c1" } }); fns.render(); await settle();
  assert.deepStrictEqual([maps.trainings.has("e1"), sb.tables.ft_trainings.has("e1"), maps.trainings.has("e2"), sb.tables.ft_trainings.has("e2")], [true, true, false, false], "the one made a minute ago stays (the check round: the tidying deleted a new workout being filled on the iPhone); the one three hours old goes");
  app.reset(); localStorage.clear();
});

test("the tidying's limits (the sixteenth check round): an empty workout made elsewhere stays 2 hours (119 minutes stays, 121 goes), one made on this page 30 minutes (29 stays, 31 goes), and one with no createdAt goes", async () => {
  const sb = makeSupabase(); coachOn(sb); app.set({ view: { name: "clients" } }); sb.seed("ft_clients", "c1", { id: "c1", name: "Jane Doe", unit: "lb" });
  const ago = (m) => new Date(Date.now() - m * 60e3).toISOString();
  sb.seed("ft_trainings", "t119", empty("t119", ago(119)), { client_id: "c1" }); sb.seed("ft_trainings", "t121", empty("t121", ago(121)), { client_id: "c1" });
  const none = empty("t0", ""); delete none.createdAt; sb.seed("ft_trainings", "t0", none, { client_id: "c1" });   // an old record with no createdAt
  await fns.syncDownNow(); await settle();
  fns.addTraining("c1", null, fns.today(), true); fns.addTraining("c1", null, fns.today(), true); await settle();   // two made on this page, saved
  const mine = [...maps.trainings.values()].filter((t) => t.clientId === "c1" && !["t119", "t121", "t0"].includes(t.id)).map((t) => t.id);
  for (const [id, m] of [[mine[0], 29], [mine[1], 31]]) { maps.trainings.get(id).createdAt = ago(m); sb.tables.ft_trainings.get(id).data.createdAt = ago(m); }
  app.set({ view: { name: "client", id: "c1" } }); fns.render(); await settle();
  const at = (id) => [maps.trainings.has(id), sb.tables.ft_trainings.has(id)];
  assert.deepStrictEqual([at("t119"), at("t121"), at("t0"), at(mine[0]), at(mine[1])], [[true, true], [false, false], [false, false], [true, true], [false, false]]);
  app.reset(); localStorage.clear();
});
test("leaving an empty workout (the sixteenth check round): this page's own goes at once, before the first sync too while it never reached the server; one made elsewhere goes only once 2 hours old and only from a copy synced a minute or so ago", async () => {
  { const sb = makeSupabase(); coachOn(sb); sb.setFail({ times: 1000, message: "Failed to fetch" });   // no signal at launch: no first sync
    fns.addTraining("c1", null, fns.today()); await settle(); const id = app.get().view.id;        // a day tapped: it opens, its save waits
    fns.go({ name: "client", id: "c1" }); await settle();                                           // Back
    sb.setFail(null); app.set({ offline: false }); flushAll(); await settle();
    assert.deepStrictEqual([id !== "c1", maps.trainings.has(id), sb.tables.ft_trainings.has(id)], [true, false, false], "discarded at Back: it never reaches the server (it stayed there for good, the round found)");
    app.reset(); localStorage.clear(); }
  const sb = makeSupabase(); coachOn(sb); app.set({ view: { name: "clients" } }); sb.seed("ft_clients", "c1", { id: "c1", name: "Jane Doe", unit: "lb" });
  const ago = (m) => new Date(Date.now() - m * 60e3).toISOString(), at = (id) => [maps.trainings.has(id), sb.tables.ft_trainings.has(id)];
  sb.seed("ft_trainings", "g5", empty("g5", ago(5)), { client_id: "c1" }); sb.seed("ft_trainings", "g180", empty("g180", ago(180)), { client_id: "c1" }); sb.seed("ft_trainings", "s180", empty("s180", ago(180)), { client_id: "c1" });
  await fns.syncDownNow(); await settle();
  for (const id of ["g5", "g180"]) { fns.go({ name: "training", id }); fns.go({ name: "clients" }); } await settle();
  assert.deepStrictEqual([at("g5"), at("g180")], [[true, true], [false, false]], "made 5 minutes ago on the other device: it may still be being filled there, so it stays; 3 hours old: it goes");
  const real = Date.now; Date.now = () => real() + 120e3;            // two minutes on, no sync since (a page woken from sleep)
  try { fns.go({ name: "training", id: "s180" }); fns.go({ name: "clients" }); await settle(); assert.deepStrictEqual(at("s180"), [true, true], "a copy two minutes old is not trusted to say it is empty");
    await fns.syncDownNow(); await settle(); fns.go({ name: "training", id: "s180" }); fns.go({ name: "clients" }); await settle(); assert.deepStrictEqual(at("s180"), [false, false], "synced again: it goes"); }
  finally { Date.now = real; }
  app.reset(); localStorage.clear();
  { const sb = makeSupabase(); coachOn(sb); sb.seed("ft_clients", "c1", { id: "c1", name: "Jane Doe", unit: "lb" }); await fns.syncDownNow(); await settle();
    fns.addTraining("c1", null, fns.today()); await settle(); const id = app.get().view.id;        // this page's own, saved
    { const s = sb.tables.ft_trainings.get(id); s.data.title = "Legs"; s.data.rows = [w(id).rows[0]]; s.updated_at = "2026-11-23T12:00:00.000Z"; }   // filled on the iPhone while this page slept on it
    const real = Date.now; Date.now = () => real() + 120e3;
    try { fns.go({ name: "client", id: "c1" }); await settle(); assert.deepStrictEqual([maps.trainings.has(id), sb.tables.ft_trainings.has(id)], [true, true], "its own, but from a copy two minutes old: it stays");
      await fns.syncDownNow(); await settle(); assert.strictEqual(maps.trainings.get(id).title, "Legs", "and the next sync shows it filled"); }
    finally { Date.now = real; }
    app.reset(); localStorage.clear(); }
});
test("a page whose copy is not fresh never tidies (the sixteenth check round): a workout empty in its copy but filled on another device since stays, here and on the server, and the next sync shows it filled", async () => {
  const sb = makeSupabase(); coachOn(sb); app.set({ view: { name: "clients" } }); sb.seed("ft_clients", "c1", { id: "c1", name: "Jane Doe", unit: "lb" });
  sb.seed("ft_trainings", "f1", empty("f1", new Date(Date.now() - 3 * 3600e3).toISOString()), { client_id: "c1" });
  await fns.syncDownNow(); await settle();
  { const s = sb.tables.ft_trainings.get("f1"); s.data.title = "Legs"; s.data.rows = [w("f1").rows[0]]; s.updated_at = "2026-11-23T12:00:00.000Z"; }   // filled on the iPhone meanwhile
  const real = Date.now; Date.now = () => real() + 30 * 60e3;        // the Mac woken half an hour later: it redraws before its sync lands
  try { app.set({ view: { name: "client", id: "c1" } }); fns.render(); await settle(); assert.deepStrictEqual([maps.trainings.has("f1"), sb.tables.ft_trainings.has("f1")], [true, true], "nothing tidied from a copy half an hour old");
    await fns.syncDownNow(); await settle(); assert.deepStrictEqual([maps.trainings.get("f1").title, sb.tables.ft_trainings.has("f1")], ["Legs", true]); }
  finally { Date.now = real; }
  app.reset(); localStorage.clear();
});
test("an empty workout stamped ahead of this clock (a clock set by hand where it was made) is spared 2 hours from when this page first saw it, never for days (the sixteenth check round)", async () => {
  const sb = makeSupabase(); coachOn(sb); app.set({ view: { name: "clients" } }); sb.seed("ft_clients", "c1", { id: "c1", name: "Jane Doe", unit: "lb" });
  sb.seed("ft_trainings", "a2d", empty("a2d", new Date(Date.now() + 2 * 86400e3).toISOString()), { client_id: "c1" });
  const real = Date.now, base = real(), at = () => [maps.trainings.has("a2d"), sb.tables.ft_trainings.has("a2d")], seen = [];
  try { for (const h of [0, 1, 3]) { Date.now = () => base + h * 3600e3; await fns.syncDownNow(); await settle(); app.set({ view: { name: "client", id: "c1" } }); fns.render(); await settle(); seen.push(at()); app.set({ view: { name: "clients" } }); } }
  finally { Date.now = real; }
  assert.deepStrictEqual(seen, [[true, true], [true, true], [false, false]], "first seen, an hour on, three hours on");
  app.reset(); localStorage.clear();
});
test("once a deleted record is back and saved, a later save for it (out of the map again) sends no deletion; a Delete tapped while a save is out still deletes", async () => {
  { const sb = makeSupabase(); coachOn(sb); sb.seed("ft_trainings", "W", w("W"), { client_id: "c1" });
    await fns.syncDownNow(); await settle();
    maps.trainings.delete("W"); maps.deleting.add("trainings/W"); maps.dirty.set("trainings/W", 1);   // Delete here, its answer lost
    maps.trainings.set("W", w("W", { title: "Back" })); fns.scheduleSave("trainings", "W", 0); await settle();   // back (a restore) and saved
    maps.trainings.delete("W");                                           // gone from the map again (deleted on the other device, synced)
    const n0 = deletes(sb); fns.scheduleSave("trainings", "W", 0); await settle();   // a save from a page still drawn, no Delete here
    assert.strictEqual(deletes(sb), n0, "no deletion sent (the check round: the old mark still sent one)");
    app.reset(); localStorage.clear(); }
  { const sb = makeSupabase(); coachOn(sb); sb.seed("ft_trainings", "W", w("W"), { client_id: "c1" });
    await fns.syncDownNow(); await settle();
    sb.delayMs = 60; maps.trainings.get("W").title = "Renamed"; fns.scheduleSave("trainings", "W", 0); await tick(20);
    fns.deleteRec("trainings", "W"); await settle(); sb.delayMs = 0;
    assert.ok(!sb.tables.ft_trainings.has("W"), "the Delete tapped while the rename was out reaches the server");
    app.reset(); localStorage.clear(); }
});

test("a restore that puts a deleted record back takes its Delete's mark away", async () => {
  const sb = makeSupabase(); coachOn(sb);
  const W = "3d6f4adc-4fc2-43f4-aa5f-2238f5eec649", C = "1b4e28ba-2fa1-41d2-883f-0016d3cca427";
  maps.clients.set(C, { id: C, name: "Sam", unit: "lb" }); maps.deleting.add("trainings/" + W); maps.dirty.set("trainings/" + W, 1);   // Delete here, its answer lost (no record here)
  const file = { app: "fiala-trainings", format: 1, clients: { [C]: { id: C, name: "Sam", unit: "lb" } }, trainings: { [W]: { ...w(W), clientId: C } } };
  fns.applyRestore(fns.planRestore(file));
  assert.deepStrictEqual([maps.trainings.has(W), maps.deleting.has("trainings/" + W)], [true, false], "back, and no mark left to send it as a deletion later");
  await settle(); app.reset(); localStorage.clear();
});

test("two windows on screen: a deletion this page already made on the server is not taken again from the other page's queue", async () => {
  const sb = makeSupabase(); coachOn(sb); sb.seed("ft_trainings", "W", w("W")); maps.trainings.set("W", w("W"));
  fns.deleteRec("trainings", "W"); await settle();
  assert.strictEqual(deletes(sb), 1, "deleted once");
  localStorage.setItem("fiala.pending.tab", "other-tab");                  // the other window took the Delete on before it landed here, and wrote the queue last
  localStorage.setItem("fiala.pending.v1", JSON.stringify({ tab: "other-tab", owner: "coach@x.com", dirty: ["trainings/W"], recs: [], gone: ["trainings/W"] }));
  fns.persistPending(); await settle();
  assert.deepStrictEqual([deletes(sb), maps.dirty.has("trainings/W"), maps.deleting.has("trainings/W")], [1, false, false], "not taken again (the check round: the two windows sent it back and forth without end, Saving… the whole time)");
  app.reset(); localStorage.clear();
  { const sb2 = makeSupabase(); coachOn(sb2); sb2.seed("ft_trainings", "V", w("V")); maps.trainings.set("V", w("V"));
    maps.trainings.get("V").title = "Renamed"; fns.scheduleSave("trainings", "V", 0); await settle();   // saved here once (its save landed)
    maps.trainings.delete("V");                                           // then out of this page's map with no Delete here, the server still holding it
    localStorage.setItem("fiala.pending.tab", "other-tab");               // the other page deleted it, and was discarded before sending
    localStorage.setItem("fiala.pending.v1", JSON.stringify({ tab: "other-tab", owner: "coach@x.com", dirty: ["trainings/V"], recs: [], gone: ["trainings/V"] }));
    fns.persistPending(); await settle();
    assert.ok(!sb2.tables.ft_trainings.has("V"), "a deletion this page never made is still taken on and sent (only one this page saw land is passed over)");
    app.reset(); localStorage.clear(); }
});
test("a save that carries a record clears this page's note that its deletion landed; a save that learns its record is gone takes a Delete's mark away, so a restore elsewhere is never deleted again", async () => {
  { const sb = makeSupabase(); coachOn(sb); sb.seed("ft_trainings", "W", w("W")); maps.trainings.set("W", w("W"));
    fns.deleteRec("trainings", "W"); await settle();
    assert.ok(maps.deletedHere.has("trainings/W"), "landed");
    sb.seed("ft_trainings", "W", w("W", { title: "Restored on the iPhone" })); maps.trainings.set("W", w("W", { title: "Restored on the iPhone" }));   // back (a restore on the coach's other device, synced here)
    maps.trainings.get("W").title = "Renamed here"; fns.scheduleSave("trainings", "W", 0); await settle();
    assert.strictEqual(maps.deletedHere.has("trainings/W"), false, "the record is here again and saved: the note goes");
    app.reset(); localStorage.clear(); }
  { const sb = makeSupabase(); coachOn(sb); sb.seed("ft_trainings", "W", w("W"), { client_id: "c1" });
    await fns.syncDownNow(); await settle();
    sb.tables.ft_trainings.delete("W");                                   // deleted on the coach's iPhone
    sb.delayMs = 60; maps.trainings.get("W").title = "Renamed"; fns.scheduleSave("trainings", "W", 0); await tick(20);   // a rename's save is out
    fns.deleteRec("trainings", "W"); await settle(); sb.delayMs = 0;      // Delete tapped meanwhile; the save learns W is gone
    assert.strictEqual(maps.deleting.has("trainings/W"), false, "the server said gone: the mark goes");
    sb.seed("ft_trainings", "W", w("W", { title: "Restored on the iPhone" }), { client_id: "c1" });   // a restore on the iPhone puts it back
    const n0 = deletes(sb); fns.scheduleSave("trainings", "W", 0); await settle();   // a save from a page still drawn, before the next sync
    assert.deepStrictEqual([deletes(sb) - n0, sb.tables.ft_trainings.has("W")], [0, true], "no deletion sent: the restored workout stays");
    app.reset(); localStorage.clear(); }
});

test("both mark sets are cleared wherever the device's work is cleared: resetState, both sign-outs, the account switch, wipeDevice", async () => {
  maps.deleting.add("trainings/x"); maps.deletedHere.set("trainings/y", null); app.reset();
  assert.deepStrictEqual([maps.deleting.size, maps.deletedHere.size], [0, 0], "resetState");
  for (const client of [false, true]) {
    const sb = makeSupabase(); sb.auth.signOut = async () => ({ error: null });
    if (client) { app.reset(); fns.leaveSettings(); app.set({ sb, signedIn: true, clientMode: true, myClientId: "c1", backend: fns.clientBackend, sessionEmail: "jane@x.com", view: { name: "client", id: "c1" } }); maps.clients.set("c1", { id: "c1", name: "Jane Doe", unit: "lb", email: "jane@x.com" }); } else coachOn(sb);
    maps.deleting.add("trainings/stale"); maps.deletedHere.set("trainings/landed", null);
    await fns.signOut(); await settle();
    assert.deepStrictEqual([app.get().signedIn, maps.deleting.size, maps.deletedHere.size], [false, 0, 0], (client ? "the client's" : "the coach's") + " sign-out clears both");
    app.reset(); localStorage.clear();
  }
  const src = fs.readFileSync(new URL("../app/main.js", import.meta.url), "utf8");
  const at = (head) => { const i = src.indexOf(head); assert.ok(i >= 0, head); return src.slice(i, src.indexOf("\n", src.indexOf("dirty.clear();", i))); };
  for (const head of ["if (S.pendingOwner && S.pendingOwner !== S.sessionEmail) {", "const signOutClient = async () => {", "const wipeDevice = () => {", "const signOutTrainer = async () => {"])
    assert.ok(/dirty\.clear\(\); deleting\.clear\(\); deletedHere\.clear\(\);/.test(at(head)), head);
});

test("through boot: another account signing in after a session that ended with a Delete waiting starts with no marks; a session ended elsewhere with nothing waiting wipes both with the device", async () => {
  const bootAs = async (email, role, queue, before) => {
    app.reset(); localStorage.clear();
    const sb = makeSupabase(); let handler = null, open = null; const gate = new Promise((r) => { open = r; });
    sb.auth = { ...sb.auth, getSession: async () => { await gate; return { data: { session: { user: { email } } } }; }, onAuthStateChange(fn) { handler = fn; }, signOut: async () => ({ error: null }) };
    sb.rpcs.client_my_data = async () => ({ clients: [{ id: "c1", data: { id: "c1", name: "Jane Doe", unit: "lb", email: "jane@x.com" } }], trainings: [] });
    localStorage.setItem("fiala.trainings.role", JSON.stringify({ email, role }));
    if (queue) { localStorage.setItem("fiala.pending.v1", JSON.stringify(queue)); localStorage.setItem("fiala.pending.tab", queue.tab); }
    globalThis.supabase = { createClient: () => sb };
    app.set({ sb: null, signedIn: false, clientMode: false, myClientId: null, backend: null, offline: false });
    const booted = fns.boot(); await tick(20); if (before) before(); open(); await booted; await settle();
    return { sb, fire: (ev) => handler && handler(ev) };
  };
  try {
    let mid = null;
    await bootAs("jane@x.com", "client", { tab: "old", owner: "coach@x.com", dirty: ["trainings/W"], recs: [], gone: ["trainings/W"] }, () => { mid = [maps.deleting.has("trainings/W")]; maps.deletedHere.set("trainings/V", null); });
    assert.deepStrictEqual(mid, [true], "the stored queue marked the coach's Delete again at boot");
    assert.deepStrictEqual([app.get().sessionEmail, maps.dirty.size, maps.deleting.size, maps.deletedHere.size], ["jane@x.com", 0, 0, 0], "the coach's marks are not carried into the client's session");
  } finally { delete globalThis.supabase; app.reset(); localStorage.clear(); }
  try {
    const { fire } = await bootAs("coach@x.com", "trainer", null);
    assert.strictEqual(app.get().signedIn, true, "signed in");
    maps.deleting.add("trainings/stale"); maps.deletedHere.set("trainings/landed", null);
    assert.strictEqual(fns.idleDevice(), true, "nothing waiting");
    fire("SIGNED_OUT"); await tick(5);
    assert.deepStrictEqual([app.get().signedIn, maps.deleting.size, maps.deletedHere.size], [false, 0, 0]);
  } finally { delete globalThis.supabase; app.reset(); localStorage.clear(); }
});

test("a restore that puts a record back takes this page's note of its landed deletion away", async () => {
  const sb = makeSupabase(); coachOn(sb);
  const W = "3d6f4adc-4fc2-43f4-aa5f-2238f5eec649", C = "1b4e28ba-2fa1-41d2-883f-0016d3cca427";
  maps.clients.set(C, { id: C, name: "Sam", unit: "lb" }); maps.deletedHere.set("trainings/" + W, null);   // its Delete landed here earlier
  const file = { app: "fiala-trainings", format: 1, clients: { [C]: { id: C, name: "Sam", unit: "lb" } }, trainings: { [W]: { ...w(W), clientId: C } } };
  fns.applyRestore(fns.planRestore(file));
  assert.strictEqual(maps.deletedHere.has("trainings/" + W), false);
  await settle(); app.reset(); localStorage.clear();
});

{ const clone = (x) => JSON.parse(JSON.stringify(x));
  const C = "1b4e28ba-2fa1-41d2-883f-0016d3cca427", WK = "2c5f39cb-3fb2-42e3-994f-1127e4ddb538", WV = "9a1b2c3d-4e5f-4a6b-8c7d-0e1f2a3b4c5d", K = "trainings/" + WK;
  const coach = (sb) => { app.reset(); fns.leaveSettings(); app.set({ sb, signedIn: true, clientMode: false, backend: fns.cloudBackend, sessionEmail: "coach@x.com", view: { name: "clients" } }); };
  const row = () => ({ id: "r1", label: "1", name: "Back squat", sets: 3, reps: "8", weights: [], done: false });
  const wk = (id, extra) => ({ id, clientId: C, title: "Legs", date: "2026-11-10", createdAt: AT, completedAt: null, skippedAt: null, rows: [row()], ...(extra || {}) });
  const jane = () => ({ id: C, name: "Jane Rivera", unit: "lb" });
  const backupOf = () => clone({ app: "fiala-trainings", format: 1, exported: AT, clients: Object.fromEntries(maps.clients), trainings: Object.fromEntries(maps.trainings) });

  test("two windows: one restores a workout this window deleted, deletes it again with no signal and is closed; this window, back before a sync, still sends that new Delete", async () => {
    const sb = makeSupabase();
    coach(sb); sb.seed("ft_clients", C, jane()); sb.seed("ft_trainings", WK, wk(WK), { client_id: C }); sb.seed("ft_trainings", WV, wk(WV, { title: "Arms" }), { client_id: C });
    await fns.syncDownNow(); await settle();
    const file = backupOf(), aSeen = clone([...maps.seenAt]);
    fns.deleteRec("trainings", WK); await settle(); const aMark = maps.deletedHere.get(K);
    app.reset(); localStorage.clear(); coach(sb); await fns.syncDownNow(); await settle();           // window B
    fns.applyRestore(fns.planRestore(file)); await settle();
    sb.setFail({ times: 100000, message: "TypeError: Failed to fetch" });
    fns.deleteRec("trainings", WK); await settle();
    const bQueue = JSON.parse(localStorage.getItem("fiala.pending.v1")); bQueue.tab = "window-B";
    app.reset(); localStorage.clear(); coach(sb);                                                     // window A, as it was
    maps.clients.set(C, jane()); maps.trainings.set(WV, wk(WV, { title: "Arms" })); for (const [k, v] of aSeen) if (k !== K) maps.seenAt.set(k, v); maps.deletedHere.set(K, aMark);
    localStorage.setItem("fiala.pending.v1", JSON.stringify(bQueue)); localStorage.setItem("fiala.pending.tab", "window-B");
    shownAgain();
    maps.trainings.get(WV).title = "Arms day"; fns.scheduleSave("trainings", WV, 0); await settle();
    sb.setFail(null); await fns.syncDownNow(); await settle(); await fns.syncDownNow(); await settle();
    assert.deepStrictEqual([sb.tables.ft_trainings.has(WK), maps.trainings.has(WK)], [false, false], "B's Delete still reaches the server (the check round: this window's earlier landed Delete of the same id hid it)");
    app.reset(); localStorage.clear();
  });

  test("two windows: this window's landed Delete, re-listed by the other window that took it on, is not taken again", async () => {
    const sb = makeSupabase();
    coach(sb); sb.seed("ft_clients", C, jane()); sb.seed("ft_trainings", WK, wk(WK), { client_id: C });
    await fns.syncDownNow(); await settle();
    sb.delayMs = 30; fns.deleteRec("trainings", WK);
    const aQueue = JSON.parse(localStorage.getItem("fiala.pending.v1"));                             // as this window wrote it at the Delete: the other takes it on, with this window's stamp
    await settle(); sb.delayMs = 0;
    localStorage.setItem("fiala.pending.v1", JSON.stringify({ ...aQueue, tab: "window-B" })); localStorage.setItem("fiala.pending.tab", "window-B");
    fns.persistPending(); await settle();
    assert.deepStrictEqual([deletes(sb), maps.dirty.has(K), maps.deleting.has(K)], [1, false, false], "not taken again (the loop the fifteenth round fixed)");
    app.reset(); localStorage.clear();
  });
}
