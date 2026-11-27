// v327. The coach's device downloaded every client and every workout once a minute for as long as the app was on a screen (the outside audit of 20 Nov 2026, and the
// audit of 15 Nov, #21): about 450 MB on a day it stayed open, and the free plan's 5 GB a month was exceeded (the owner's Supabase usage, 26 Nov 2026). A routine tick
// (the minute's timer, the window's focus, the page back on screen) now first asks each table how many rows it holds and when the newest one changed, and reads
// everything only when an answer differs, when the last full read left a record untaken, when any code asked for a sync, or 15 minutes after the last full read.
// The stand-in server answers the count only when told to (sb.counts): every older test reads everything, as before.
import { test, assert, tick } from "./assert.js";
import { makeSupabase } from "./fake-supabase.js";
import { load } from "./load.js";
import { scheduleSync, syncDown } from "../app/sync.js";
const app = await load();
const { fns, maps } = app;
const quiet = () => { for (const tm of maps.timers.values()) clearTimeout(tm); maps.timers.clear(); clearTimeout(app.get().syncTimer); };
const settle = async () => { const until = Date.now() + 15000; do await tick(5); while ((app.get().inflight > 0 || maps.timers.size) && Date.now() < until); };
const W = (id, title) => ({ id, clientId: "c1", title: title || "Legs", date: "2026-11-27", createdAt: "2026-11-10T16:00:00.000Z", completedAt: null, skippedAt: null, rows: [{ id: "sq", label: "1", name: "Back squat", sets: 4, reps: "8", note: "x".repeat(300), weights: [], repsDone: [], setsDone: 0, done: false, alts: [] }] });
const CATS = ["ft_exercises", "ft_exercise_videos", "ft_exercise_hidden", "ft_exercise_subtitles"], BIG = ["ft_clients", "ft_trainings"];
const start = async (opts = {}) => {                                   // the coach's device, everything read once
  quiet(); app.reset(); const sb = makeSupabase(); sb.counts = opts.counts !== false;
  app.set({ sb, signedIn: true, clientMode: false, backend: fns.cloudBackend, sessionEmail: "coach@x.com", view: { name: "clients" } });
  sb.seed("ft_clients", "c1", { id: "c1", name: "Jane Testperson", unit: "lb", email: "jane@x.com" });
  for (let i = 0; i < 30; i++) sb.seed("ft_trainings", "w" + i, W("w" + i), { client_id: "c1" });
  assert.strictEqual(await fns.syncDownNow(), true); await settle();
  return sb;
};
const one = async (sb, routine) => {                                    // one sync, and what it asked the server
  const at = sb.log.length, sent = sb.bytes, synced = app.get().syncedAt; await tick(3);
  const ok = routine ? await fns.syncDownNow(true) : await fns.syncDownNow(); await settle();
  const reads = sb.log.slice(at).filter((l) => l.op === "select").map((l) => l.table);
  return { ok, big: reads.filter((x) => BIG.includes(x)).length, lists: reads.filter((x) => CATS.includes(x)).length, chars: sb.bytes - sent, fresher: app.get().syncedAt > synced };
};

test("(v327) a routine tick with nothing changed on the server asks two small questions and downloads nothing: no workouts, no clients, none of the four exercise lists; it still counts as a sync (the copy is as fresh as the answer)", async () => {
  const sb = await start(), first = sb.bytes;
  const r = await one(sb, true);
  assert.deepStrictEqual([r.ok, r.big, r.lists, r.fresher], [true, 2, 0, true], "two reads, one a table");
  assert.ok(r.chars < 200 && first > 10000, "a full read sent " + first + " characters, the tick " + r.chars);
  const again = await one(sb, true); assert.deepStrictEqual([again.ok, again.big, again.lists], [true, 2, 0], "and the next minute's the same");
  assert.strictEqual(maps.trainings.size, 30, "nothing here changed");
  quiet();
});
test("(v327) a change made on another device since the last full read: the tick's answer differs (the newest stamp moved), so it reads everything and takes the change; the tick after is small again", async () => {
  const sb = await start();
  sb.tables.ft_trainings.get("w7").data = W("w7", "Renamed on the iPad"); await sb.from("ft_trainings").update({}).eq("id", "w7");   // a write: the server stamps the row
  const r = await one(sb, true);
  assert.deepStrictEqual([r.ok, r.big > 2, r.lists], [true, true, 4], "the two questions, then both tables and the four lists");
  assert.strictEqual(maps.trainings.get("w7").title, "Renamed on the iPad");
  const next = await one(sb, true); assert.deepStrictEqual([next.big, next.lists], [2, 0], "nothing changed since: small again");
  quiet();
});
test("(v327) a workout deleted on another device (the count drops) and one added there (a new newest stamp) are each found by the next tick", async () => {
  const sb = await start();
  sb.tables.ft_trainings.delete("w3");
  const gone = await one(sb, true); assert.ok(gone.big > 2 && !maps.trainings.has("w3"), "the deletion is taken");
  sb.seed("ft_trainings", "w99", W("w99", "Added on the iPad"), { client_id: "c1" });
  const added = await one(sb, true); assert.ok(added.big > 2 && maps.trainings.has("w99"), "and the new workout");
  sb.tables.ft_trainings.delete("w5"); sb.seed("ft_trainings", "w98", W("w98"), { client_id: "c1" });   // one gone and one new: the count is the same, the newest stamp is not
  const both = await one(sb, true); assert.ok(both.big > 2 && !maps.trainings.has("w5") && maps.trainings.has("w98"), "a deletion and an addition together");
  quiet();
});
test("(v327) every sync that is asked for is a full read, as before: called by name (a rule's answer, a restore, a test), through scheduleSync from the app's own code, and the first one after any of them", async () => {
  const sb = await start();
  const named = await one(sb, false); assert.deepStrictEqual([named.big, named.lists], [2, 4], "by name: both tables and the lists, no questions first");
  const small = await one(sb, true); assert.deepStrictEqual([small.big, small.lists], [2, 0], "a tick after it: small");
  scheduleSync(); quiet();                                           // the app asks for a sync (a refusal, a copy given up); its timer is stopped here
  const asked = await one(sb, true); assert.deepStrictEqual([asked.big, asked.lists], [2, 4], "the next tick is the full read that was asked for");
  const after = await one(sb, true); assert.deepStrictEqual([after.big, after.lists], [2, 0]);
  quiet();
});
test("(v327) a sync asked for by name while a routine tick's two questions are still out is not answered by them: the tick itself goes on to read everything (a restore, a sign-in or a rule's answer waits for a read of the server, never for 'nothing changed'), and that read settles the request", async () => {
  const sb = await start(), at = sb.log.length;
  sb.delayMs = 40;                                                    // the server takes 40 ms over each answer
  const routine = syncDown(true); await tick(10);                     // the minute's tick: its two questions are out
  const asked = syncDown();                                           // the app asks for a sync meanwhile, and is handed the one in flight
  assert.strictEqual(await asked, true); assert.strictEqual(await routine, true); sb.delayMs = 0; await settle();
  const reads = sb.log.slice(at).filter((l) => l.op === "select").map((l) => l.table);
  assert.deepStrictEqual([reads.filter((x) => BIG.includes(x)).length, reads.filter((x) => CATS.includes(x)).length], [4, 4], "the two questions, then both tables and the four lists");
  const next = await one(sb, true); assert.deepStrictEqual([next.big, next.lists], [2, 0], "the read began after the request, so nothing more is owed: the next tick is small");
  quiet();
});
test("(v327) a full read whose four exercise lists did not all come in is no measure either: the list that failed is read again at the next tick, as it was every minute before (one that failed at launch would have stayed missing for up to fifteen minutes)", async () => {
  const sb = await start();
  sb.setFail({ table: "ft_exercise_videos", op: "select", times: 1, message: "Failed to fetch" });   // one list meets no signal during a full read
  const full = await one(sb, false); assert.deepStrictEqual([full.ok, full.big, full.lists], [true, 2, 4], "the workouts are in; one list is not");
  const again = await one(sb, true); assert.deepStrictEqual([again.big, again.lists], [2, 4], "the next tick reads everything, with no questions first");
  const small = await one(sb, true); assert.deepStrictEqual([small.big, small.lists], [2, 0], "all four are in now: the ticks are small");
  quiet();
});
test("(v327) a full read that had to pass a record over (it waits to send here while the server's copy is newer) is no measure: the next tick reads everything again with no questions, until nothing is left untaken", async () => {
  const sb = await start();
  sb.tables.ft_trainings.get("w2").data = W("w2", "Changed on the iPad"); await sb.from("ft_trainings").update({}).eq("id", "w2");   // the server's copy moves on
  sb.setFail({ table: "ft_trainings", op: "update", times: 99, message: "Failed to fetch" });      // and this device's own save of it meets no signal
  maps.trainings.get("w2").title = "Typed here, not sent"; fns.markDirty("trainings", "w2");
  const passed = await one(sb, false); quiet();                         // a full read: w2 is passed over (ours waits)
  assert.deepStrictEqual([passed.ok, maps.trainings.get("w2").title, maps.dirty.has("trainings/w2")], [true, "Typed here, not sent", true]);
  const tick1 = await one(sb, true); quiet(); assert.deepStrictEqual([tick1.big, tick1.lists], [2, 4], "the tick after it reads everything, with no questions first: one record's copy here is not the server's");
  const tick2 = await one(sb, true); quiet(); assert.deepStrictEqual([tick2.big, tick2.lists], [2, 4], "and so does the next, for as long as it waits");
  sb.setFail(null); maps.dirty.delete("trainings/w2"); quiet();          // the copy here is given up without a save (as one taken by another page is)
  const taken = await one(sb, true); assert.deepStrictEqual([taken.big, taken.lists, maps.trainings.get("w2").title], [2, 4, "Changed on the iPad"], "the next tick still reads everything, and takes the server's copy");
  const small = await one(sb, true); assert.deepStrictEqual([small.big, small.lists], [2, 0], "nothing is left untaken: the ticks are small");
  quiet();
});
test("(v327) the coach's own save moves the newest stamp, so the tick after it reads everything once, and the one after that is small", async () => {
  const sb = await start();
  maps.trainings.get("w1").title = "Renamed here"; fns.scheduleSave("trainings", "w1", 0); await settle();
  assert.strictEqual(sb.tables.ft_trainings.get("w1").data.title, "Renamed here", "saved");
  const r = await one(sb, true); assert.ok(r.big > 2 && r.lists === 4, "a full read after the save");
  const next = await one(sb, true); assert.deepStrictEqual([next.big, next.lists], [2, 0]);
  quiet();
});
test("(v327) fifteen minutes after the last full read a tick reads everything even with the same answers (a write that began before the newest one and ended after the read carries an older stamp: only a full read finds it)", async () => {
  const sb = await start(); const real = performance.now.bind(performance); let ahead = 0;
  try {
    performance.now = () => real() + ahead;
    ahead = 14 * 60 * 1000; const before = await one(sb, true); assert.deepStrictEqual([before.big, before.lists], [2, 0], "at 14 minutes: small");
    sb.tables.ft_trainings.get("w4").data = W("w4", "Landed late");    // on the server with its old stamp: no question can see it
    const blind = await one(sb, true); assert.strictEqual(maps.trainings.get("w4").title, "Legs", "the questions cannot see it");
    ahead = 15 * 60 * 1000 + 1000; const full = await one(sb, true); assert.deepStrictEqual([full.big, full.lists], [2, 4], "past 15 minutes: both tables and the lists, with no questions first");
    assert.strictEqual(maps.trainings.get("w4").title, "Landed late", "found by the full read");
    void blind;
  } finally { performance.now = real; quiet(); }
});
test("(v327, the review of 26 Nov 2026) the fifteen minutes run on either clock: a device that slept (its steady clock stood still) reads everything at its first tick once the wall clock is fifteen minutes on, and so does one whose clock was set back (woken hours later it asked the small questions for hours more)", async () => {
  const sb = await start(); const realNow = Date.now; let ahead = 0;
  try {
    Date.now = () => realNow() + ahead;
    ahead = 14 * 60 * 1000; const before = await one(sb, true); assert.deepStrictEqual([before.big, before.lists], [2, 0], "14 minutes on the wall clock: small");
    ahead = 2 * 60 * 60 * 1000; const woken = await one(sb, true); assert.deepStrictEqual([woken.big, woken.lists], [2, 4], "woken two hours later, the steady clock where it was: both tables and the lists, with no questions first");
    const next = await one(sb, true); assert.deepStrictEqual([next.big, next.lists], [2, 0], "small again after it");
    ahead = 60 * 60 * 1000; const back = await one(sb, true); assert.deepStrictEqual([back.big, back.lists], [2, 4], "the clock set back an hour: everything");
  } finally { Date.now = realNow; quiet(); }
});
test("(v327) a client's phone is unchanged: every tick reads her workouts through her rule and the lists, and never asks the two questions", async () => {
  quiet(); app.reset(); const sb = makeSupabase(); sb.counts = true; let calls = 0;
  sb.rpcs.client_my_data = async () => { calls++; return { clients: [{ id: "c1", data: { id: "c1", name: "Jane Testperson", unit: "lb" } }], trainings: [{ id: "w0", data: W("w0") }] }; };
  app.set({ sb, signedIn: true, clientMode: true, myClientId: "c1", backend: fns.clientBackend, sessionEmail: "jane@x.com", view: { name: "client", id: "c1" }, zoneSetMissing: true });
  await fns.syncDownNow(); await settle(); const r1 = await one(sb, true), r2 = await one(sb, true);
  assert.deepStrictEqual([calls, r1.big, r2.big, r1.lists, r2.lists], [3, 0, 0, 4, 4], "her rule and the lists at every sync; no table is asked anything");
  quiet();
});
test("(v327) no answer to the questions (no signal), or a server that cannot count: the tick goes on to the full read, which says what it always said", async () => {
  const sb = await start();
  sb.setFail({ times: 99, message: "Failed to fetch" });
  const off = await one(sb, true); assert.deepStrictEqual([off.ok, app.get().offline], [false, true], "no signal: Offline, as before");
  sb.setFail(null); app.set({ offline: false });
  const old = await start({ counts: false }); const r = await one(old, true);
  assert.deepStrictEqual([r.ok, r.lists], [true, 4], "a server with no count: everything is read");
  quiet();
});
test("(v327) a sign-out's wipe forgets the measure: the first tick of the next sign-in reads everything", async () => {
  const sb = await start();
  await fns.localBackend.wipe(); 
  const r = await one(sb, true); assert.deepStrictEqual([r.big, r.lists], [2, 4], "a full read, no questions");
  quiet(); app.reset();
});
