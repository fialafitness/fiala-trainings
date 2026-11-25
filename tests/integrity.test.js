// The audit of 15 Nov 2026, its data-integrity findings: what a stale device copy, a second device or a sync under the finger
// must never do to the server's data or to the screen. Each test names the finding it guards (#1, #2, #4, #7, #9, #11, #14).
import fs from "node:fs";
import { test, assert, tick } from "./assert.js";
import { makeSupabase } from "./fake-supabase.js";
import { load } from "./load.js";
const app = await load();
const { fns, maps } = app;
const day = (n) => { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + n); return fns.localIso(d); };
const row = (id, w, r, done, extra) => ({ id, label: "1", name: "Deadlift", sets: 3, reps: "5", rest: "90 sec", tempo: "", weights: w || [], repsDone: r || [], setsDone: done || 0, done: (done || 0) >= 3, note: "", alts: [], ...(extra || {}) });
const training = (id, extra) => ({ id, clientId: "c1", title: "Pull", date: day(0), createdAt: "2026-10-01T10:00:00.000Z", completedAt: null, skippedAt: null, rows: [row("r1")], ...(extra || {}) });
const coach = (sb) => { app.reset(); app.set({ sb, signedIn: true, clientMode: false, backend: fns.cloudBackend }); maps.clients.set("c1", { id: "c1", name: "Jane", unit: "lb" }); };
const settle = async () => {
  const until = Date.now() + 15000;
  do await tick(5); while ((app.get().inflight > 0 || maps.timers.size) && Date.now() < until);
  assert.strictEqual(app.get().inflight, 0, "every save has answered"); assert.strictEqual(maps.timers.size, 0, "and none is still waiting to go");
};
const clone = (x) => JSON.parse(JSON.stringify(x));

test("(#1) the queue on the device holds each unsent record as it is now, and each one deleted here", () => {
  app.reset(); app.set({ clientMode: false });
  maps.trainings.set("A", training("A", { title: "Edited" })); maps.dirty.set("trainings/A", 1); maps.dirty.set("trainings/GONE", 1); maps.deleting.add("trainings/GONE"); maps.dirty.set("trainings/LEFT", 1);   // GONE: deleted here (deleteRec); LEFT: a record that only left the map (v316, the check rounds: never kept as a deletion)
  fns.persistPending();
  const p = JSON.parse(localStorage.getItem("fiala.pending.v1"));
  assert.deepStrictEqual(p.recs.map(([k]) => k), ["trainings/A"]); assert.strictEqual(p.recs[0][1].title, "Edited");
  assert.deepStrictEqual(p.gone, ["trainings/GONE"]);
  app.reset();
});

test("(#1) after a relaunch the queue's records win over a device copy that stopped saving; a queued record the copy lost is never taken as deleted", () => {
  app.reset(); app.set({ clientMode: false });
  maps.trainings.set("A", training("A", { title: "Old copy" }));            // the device copy, frozen before the edit
  maps.trainings.set("D", training("D"));                                    // deleted here after the copy stopped saving
  localStorage.setItem("fiala.pending.v1", JSON.stringify({ dirty: ["trainings/A", "trainings/LOST", "trainings/D"], recs: [["trainings/A", training("A", { title: "New" })]], gone: ["trainings/D"], owner: "" }));
  fns.restorePending();
  assert.strictEqual(maps.trainings.get("A").title, "New", "the queued record, not the old copy");
  assert.ok(!maps.trainings.has("D") && maps.dirty.has("trainings/D") && maps.deleting.has("trainings/D"), "deleted here: the deletion stands and still goes to the server (marked as a Delete again: v316, the check rounds)");
  assert.ok(!maps.dirty.has("trainings/LOST"), "lost by the device, never deleted here: not queued, so the server's copy comes back");
  app.reset();
});

test("(#1) a relaunch on a stale device copy deletes nothing on the server and rolls nothing back", async () => {
  const sb = makeSupabase(); coach(sb);
  sb.seed("ft_trainings", "W", training("W", { title: "Made on the Mac" }), { client_id: "c1" });   // the copy never got this one
  const stamp = sb.seed("ft_trainings", "A", training("A", { title: "v2" }), { client_id: "c1" });
  maps.trainings.set("A", training("A", { title: "v1 (old copy)" }));
  localStorage.setItem("fiala.pending.v1", JSON.stringify({ dirty: ["trainings/W", "trainings/A"], stamps: [["trainings/A", stamp]], docs: [["trainings/A", JSON.stringify(training("A", { title: "v2" }))]], recs: [["trainings/A", training("A", { title: "v3, edited offline" })]], gone: [], owner: "" }));
  fns.restorePending();
  for (const k of [...maps.dirty.keys()]) { const [kind, id] = k.split("/"); fns.flushOne(kind, id); }
  await settle();
  assert.ok(sb.tables.ft_trainings.has("W"), "the workout the copy lost is still on the server");
  assert.ok(!sb.log.some((l) => l.op === "delete"), "no delete was sent");
  assert.strictEqual(sb.tables.ft_trainings.get("A").data.title, "v3, edited offline", "the queued edit landed, never the old copy");
});

test("(#1) a queue written before this release (no records in it) still never turns a lost record into a delete", async () => {
  const sb = makeSupabase(); coach(sb);
  sb.seed("ft_trainings", "W", training("W"), { client_id: "c1" });
  localStorage.setItem("fiala.pending.v1", JSON.stringify({ dirty: ["trainings/W"], owner: "" }));
  fns.restorePending();
  assert.ok(!maps.dirty.has("trainings/W"));
  for (const k of [...maps.dirty.keys()]) { const [kind, id] = k.split("/"); fns.flushOne(kind, id); }
  await settle();
  assert.ok(sb.tables.ft_trainings.has("W") && !sb.log.some((l) => l.op === "delete"));
});

test("(#2) the coach's correction of one set lands; the sets the client logged meanwhile stay, on the server and on his screen", async () => {
  const sb = makeSupabase(); coach(sb);
  const base = training("T", { rows: [row("r1", ["100"], ["5"], 1)] });
  const stamp = sb.seed("ft_trainings", "T", base, { client_id: "c1" });
  maps.trainings.set("T", clone(base)); maps.seenAt.set("trainings/T", stamp); maps.seenDoc.set("trainings/T", JSON.stringify(base));
  const srv = sb.tables.ft_trainings.get("T"); srv.data.rows[0].weights = ["100", "105", "110"]; srv.data.rows[0].repsDone = ["5", "5", "5"]; srv.data.rows[0].setsDone = 3; srv.updated_at = "2099-01-01T00:00:00Z";   // the client logged sets 2 and 3
  maps.trainings.get("T").rows[0].weights = ["102"]; maps.trainerTouched.set("T", new Set(["r1"]));   // he corrects set 1 on his older copy
  fns.scheduleSave("trainings", "T", 0); await settle();
  const s = sb.tables.ft_trainings.get("T").data.rows[0];
  assert.deepStrictEqual(s.weights, ["102", "105", "110"]); assert.deepStrictEqual(s.repsDone, ["5", "5", "5"]); assert.strictEqual(s.setsDone, 3);
  assert.deepStrictEqual(maps.trainings.get("T").rows[0].weights, ["102", "105", "110"], "his screen shows her sets too");
});

test("(#2) a set both changed: the coach's value wins; one he changed from a value back to empty stays empty", async () => {
  const sb = makeSupabase(); coach(sb);
  const base = training("T", { rows: [row("r1", ["100", "100"], ["5", "5"], 2)] });
  const stamp = sb.seed("ft_trainings", "T", base, { client_id: "c1" });
  maps.trainings.set("T", clone(base)); maps.seenAt.set("trainings/T", stamp); maps.seenDoc.set("trainings/T", JSON.stringify(base));
  const srv = sb.tables.ft_trainings.get("T"); srv.data.rows[0].weights = ["101", "101", "101"]; srv.data.rows[0].repsDone = ["5", "5", "5"]; srv.data.rows[0].setsDone = 3; srv.updated_at = "2099-01-01T00:00:00Z";
  const t = maps.trainings.get("T"); t.rows[0].weights = ["102", ""]; maps.trainerTouched.set("T", new Set(["r1"]));
  fns.scheduleSave("trainings", "T", 0); await settle();
  assert.deepStrictEqual(sb.tables.ft_trainings.get("T").data.rows[0].weights, ["102", "", "101"]);
});

test("(#4) a second device's stale copy keeps the exercises removed and added on the first; its own added exercise stays", async () => {
  const sb = makeSupabase(); coach(sb);
  const squat = row("r1", [], [], 0, { name: "Squat" }), press = row("r2", [], [], 0, { name: "Leg press", label: "2" }), bridge = row("r3", [], [], 0, { name: "Glute bridge", label: "2" });
  const base = training("T", { rows: [squat, press] });
  const stamp = sb.seed("ft_trainings", "T", base, { client_id: "c1" });
  maps.trainings.set("T", clone(base)); maps.seenAt.set("trainings/T", stamp); maps.seenDoc.set("trainings/T", JSON.stringify(base));
  const srv = sb.tables.ft_trainings.get("T"); srv.data.rows = [clone(squat), clone(bridge)]; srv.updated_at = "2099-01-01T00:00:00Z";   // the Mac: Leg press out (knee pain), Glute bridge in
  const t = maps.trainings.get("T"); t.date = day(1); t.rows.push(row("r4", [], [], 0, { name: "Calf raise", label: "3" })); fns.touchState("T", "date");   // the phone, on the old copy: moved to tomorrow, and an exercise added
  fns.scheduleSave("trainings", "T", 0); await settle();
  const saved = sb.tables.ft_trainings.get("T").data;
  assert.deepStrictEqual(saved.rows.map((x) => x.id).sort(), ["r1", "r3", "r4"]); assert.strictEqual(saved.date, day(1));
  assert.deepStrictEqual(maps.trainings.get("T").rows.map((x) => x.id).sort(), ["r1", "r3", "r4"], "the phone's screen follows");
});

test("(#4) an exercise removed here stays removed, and one the other device changed comes back changed only if it is still here", async () => {
  const sb = makeSupabase(); coach(sb);
  const a = row("r1", [], [], 0, { name: "Squat" }), b = row("r2", [], [], 0, { name: "Row", label: "2" });
  const base = training("T", { rows: [a, b] });
  const stamp = sb.seed("ft_trainings", "T", base, { client_id: "c1" });
  maps.trainings.set("T", clone(base)); maps.seenAt.set("trainings/T", stamp); maps.seenDoc.set("trainings/T", JSON.stringify(base));
  const srv = sb.tables.ft_trainings.get("T"); srv.data.title = "Renamed there"; srv.updated_at = "2099-01-01T00:00:00Z";
  const t = maps.trainings.get("T"); t.rows = t.rows.filter((x) => x.id !== "r2");   // removed here
  fns.scheduleSave("trainings", "T", 0); await settle();
  const saved = sb.tables.ft_trainings.get("T").data;
  assert.deepStrictEqual(saved.rows.map((x) => x.id), ["r1"]); assert.strictEqual(saved.title, "Renamed there");
});

test("(#9) notes and packages deleted on the other device stay deleted when this device saves the client", async () => {
  const sb = makeSupabase(); coach(sb);
  const base = { id: "c1", name: "Jane", unit: "lb", notes: { log: [{ id: "n1", at: "2026-11-01T10:00:00.000Z", text: "first" }, { id: "n2", at: "2026-11-02T10:00:00.000Z", text: "second" }] }, packages: [{ id: "p1", name: "10 sessions", kind: "sessions", size: 10 }] };
  const stamp = sb.seed("ft_clients", "c1", base);
  maps.clients.set("c1", clone(base)); maps.seenAt.set("clients/c1", stamp); maps.seenDoc.set("clients/c1", JSON.stringify(base));
  const srv = sb.tables.ft_clients.get("c1"); srv.data.notes = { log: [base.notes.log[1]] }; srv.data.packages = []; srv.updated_at = "2099-01-01T00:00:00Z";   // the Mac deleted n1 and p1
  maps.clients.get("c1").seenDoneAt = "2026-11-15T10:00:00.000Z";                    // the phone, on the old copy, marks the finished workouts seen
  fns.scheduleSave("clients", "c1", 0); await settle();
  const saved = sb.tables.ft_clients.get("c1").data;
  assert.deepStrictEqual(saved.notes.log.map((x) => x.id), ["n2"]); assert.deepStrictEqual(saved.packages, []);
  assert.strictEqual(saved.seenDoneAt, "2026-11-15T10:00:00.000Z");
});

test("(#9) a note written here and a note written there both stay", async () => {
  const sb = makeSupabase(); coach(sb);
  const base = { id: "c1", name: "Jane", unit: "lb", notes: { log: [{ id: "n1", at: "2026-11-01T10:00:00.000Z", text: "first" }] } };
  const stamp = sb.seed("ft_clients", "c1", base);
  maps.clients.set("c1", clone(base)); maps.seenAt.set("clients/c1", stamp); maps.seenDoc.set("clients/c1", JSON.stringify(base));
  const srv = sb.tables.ft_clients.get("c1"); srv.data.notes = { log: [...base.notes.log, { id: "n3", at: "2026-11-03T10:00:00.000Z", text: "there" }] }; srv.updated_at = "2099-01-01T00:00:00Z";
  maps.clients.get("c1").notes = { log: [...base.notes.log, { id: "n4", at: "2026-11-04T10:00:00.000Z", text: "here" }] };
  fns.scheduleSave("clients", "c1", 0); await settle();
  assert.deepStrictEqual(sb.tables.ft_clients.get("c1").data.notes.log.map((x) => x.id).sort(), ["n1", "n3", "n4"]);
});

test("(#11) a changed sibling repaints the open workout through histVer, and never lifts the guard on the workout under a question", () => {
  app.reset(); app.set({ clientMode: false, renderedTraining: "B", asking: true });
  const a = training("A"), b = training("B"); maps.trainings.set("A", a); maps.trainings.set("B", b);
  const v0 = app.get().histVer;
  fns.mergeDown(maps.trainings, "trainings", [{ id: "A", data: training("A", { title: "Changed elsewhere" }), updated_at: "S2" }, { id: "B", data: training("B", { title: "Changed too" }), updated_at: "S2" }], true, Date.now());
  assert.strictEqual(maps.trainings.get("B"), b, "the workout under the question keeps its object, though its sibling changed first in the same answer");
  assert.strictEqual(app.get().renderedTraining, "B", "the page still knows which workout it shows");
  assert.ok(app.get().histVer > v0, "A changed: B's Last time and Best are drawn again once nothing owns the page");
  app.reset();
});

test("(#11) a server copy that differs only in key order, empty sets at the end, or an old exercise name for its new one keeps the very same object", () => {
  app.reset(); app.set({ clientMode: false, renderedTraining: "A" });
  const a = training("A"); a.rows[0].weights = ["", "", ""]; a.rows[0].name = "Alternating dumbbell bench press"; maps.trainings.set("A", a);
  const srv = training("A"); srv.rows[0].weights = []; srv.rows[0].name = "Alternating dumbbell bench-press";
  const reordered = Object.fromEntries(Object.keys(srv).reverse().map((k) => [k, srv[k]]));
  const v0 = app.get().histVer;
  fns.mergeDown(maps.trainings, "trainings", [{ id: "A", data: reordered, updated_at: "S3" }], true, Date.now());
  assert.strictEqual(maps.trainings.get("A"), a, "the same object: nothing to swap, nothing to draw again"); assert.strictEqual(app.get().histVer, v0);
  fns.mergeDown(maps.trainings, "trainings", [{ id: "A", data: training("A", { title: "Really changed" }), updated_at: "S4" }], true, Date.now());
  assert.strictEqual(maps.trainings.get("A").title, "Really changed", "a real change is still taken");
  app.reset();
});

test("(#14) Skip never stamps a workout the client finished meanwhile", () => {
  app.reset(); app.set({ clientMode: false, view: { name: "client", id: "c1" } });
  maps.clients.set("c1", { id: "c1", name: "Jane", unit: "lb" });
  maps.trainings.set("F", training("F", { completedAt: "2026-11-15T18:00:00.000Z" }));
  fns.setSkipped(true, "", "F");
  assert.ok(!maps.trainings.get("F").skippedAt); assert.ok(!maps.dirty.has("trainings/F"));
  app.reset();
});

test("(#7, #13, #14) source guards: sign-out is this device's alone and keeps whose edits are queued; Finish early has askFirst's guards; the preview's Delete re-reads after its question", () => {
  const src = fs.readFileSync(new URL("../app/main.js", import.meta.url), "utf8");
  assert.strictEqual(src.split('auth.signOut({ scope: "local" })').length - 1, 2, "both sign-outs"); assert.ok(!src.includes("auth.signOut()"));
  const at = src.indexOf('if (event === "SIGNED_OUT"'), handler = src.slice(at, src.indexOf("\n", at));
  assert.ok(handler.length > 40 && !handler.includes('S.pendingOwner = ""'), "a sign-out from elsewhere keeps the queue's owner");
  assert.ok(/es = \{ t, g, selKey, reason: "", at: performance\.now\(\)/.test(src) && src.includes('$("esGo").addEventListener("click", (e) => { if (!esSettled(e)) return; askEat(e); finishEarlyNow(); });'), "Finish early: armed after 350 ms, the second press eaten");
  assert.ok(src.includes('$("esKeep").focus({ preventScroll: true, focusVisible: keysLast })'), "Cancel takes the focus, as askFirst's");
  assert.ok(src.includes("st(trainings.get(id)) !== was) return;"), "the preview's Delete checks the workout again after its question");
});

test("(#19) another page's unsent work is taken on before this page writes the queue, record and queues with it; this page's own edit of the same workout stands; another account's is never taken", () => {
  const quietTimers = () => { for (const t of maps.timers.values()) clearTimeout(t); maps.timers.clear(); };
  app.reset(); app.set({ clientMode: true, sessionEmail: "jane@test" });
  maps.trainings.set("MINE", training("MINE", { title: "Mine, edited here" })); maps.dirty.set("trainings/MINE", 1);
  const theirs = training("X", { rows: [row("r1", ["100", "105"], ["5", "5"], 2)] });
  localStorage.setItem("fiala.pending.v1", JSON.stringify({ tab: "OTHER", owner: "jane@test", dirty: ["trainings/X", "trainings/MINE"], recs: [["trainings/X", theirs], ["trainings/MINE", training("MINE", { title: "Theirs" })]], weights: [["X", ["r1"]]], finish: ["X"], gone: [] }));
  localStorage.setItem("fiala.pending.tab", "OTHER");
  fns.persistPending();
  assert.deepStrictEqual(maps.trainings.get("X").rows[0].weights, ["100", "105"], "the other page's sets, taken on");
  assert.ok(maps.dirty.has("trainings/X") && maps.pendingWeightRows.get("X").has("r1") && maps.pendingFinish.has("X"), "and queued to go from here too");
  assert.strictEqual(maps.trainings.get("MINE").title, "Mine, edited here", "this page's own edit stands");
  const disk = JSON.parse(localStorage.getItem("fiala.pending.v1"));
  assert.ok(disk.dirty.includes("trainings/X") && disk.recs.some(([k]) => k === "trainings/X"), "the queue on the device keeps it");
  assert.notStrictEqual(localStorage.getItem("fiala.pending.tab"), "OTHER", "and this page wrote last");
  quietTimers(); app.reset();
  app.set({ clientMode: true, sessionEmail: "ann@test" });
  localStorage.setItem("fiala.pending.v1", JSON.stringify({ tab: "OTHER", owner: "jane@test", dirty: ["trainings/X"], recs: [["trainings/X", theirs]] })); localStorage.setItem("fiala.pending.tab", "OTHER");
  fns.persistPending();
  assert.ok(!maps.trainings.has("X") && !maps.dirty.has("trainings/X"), "another account's queue: never taken on");
  quietTimers(); app.reset();
});

test("(#19) a page that wrote the queue last never reads it back: a single tab pays nothing", () => {
  app.reset(); app.set({ clientMode: false });
  fns.persistPending();                                                     // this page writes, and is noted as the last writer
  localStorage.setItem("fiala.pending.v1", JSON.stringify({ tab: "OTHER", dirty: ["trainings/Z"], recs: [["trainings/Z", training("Z")]] }));   // the content changed under it, the note did not
  fns.persistPending();
  assert.ok(!maps.trainings.has("Z") && !maps.dirty.has("trainings/Z"));
  app.reset();
});
