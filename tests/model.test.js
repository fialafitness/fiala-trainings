import { test, assert } from "./assert.js";
import { load } from "./load.js";
import { timedPlan } from "../app/model.js";
const app = await load();
const { fns, maps } = app;
const day = (n) => { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + n); return fns.localIso(d); };

test("a fresh copy of an exercise carries the plan and nothing that was logged", () => {
  const r = fns.freshRow({ id: "a", name: "Squat", sets: 4, reps: "5", weights: ["100"], repsDone: ["5"], setsDone: 1, done: true, earlyReason: "Pain", alts: ["Leg press"], note: "slow", clientNote: "ouch", clientNoteBy: "client", clientNoteAt: "2026-10-13T10:00:00.000Z" });
  assert.notStrictEqual(r.id, "a"); assert.strictEqual(r.name, "Squat"); assert.strictEqual(r.sets, 4); assert.strictEqual(r.note, "slow");
  assert.deepStrictEqual([r.weights, r.repsDone, r.setsDone, r.done], [[], [], 0, false]); assert.ok(!("earlyReason" in r)); assert.ok(!("clientNoteBy" in r) && !("clientNoteAt" in r)); assert.deepStrictEqual(r.alts, ["Leg press"]);
});
test("an empty workout is one with no exercises, no title and nothing done", () => {
  app.reset(); maps.clients.set("c1", { id: "c1", name: "Jane" });
  assert.strictEqual(fns.isEmptyWorkout({ id: "t", clientId: "c1", rows: [], title: "" }), true);
  assert.strictEqual(fns.isEmptyWorkout({ id: "t", clientId: "c1", rows: [], title: "Legs" }), false);
  assert.strictEqual(fns.isEmptyWorkout({ id: "t", clientId: "c1", rows: [{ id: "r" }], title: "" }), false);
  assert.strictEqual(fns.isEmptyWorkout({ id: "t", clientId: "c1", rows: [], title: "", completedAt: "x" }), false);
});
test("a finished workout lives on the day it was finished, a planned one on its date", () => {
  assert.strictEqual(fns.effDate({ date: "2026-10-01", completedAt: null }), "2026-10-01");
  const done = new Date(); done.setHours(9, 0, 0, 0);
  assert.strictEqual(fns.effDate({ date: "2026-10-01", completedAt: done.toISOString() }), fns.localIso(done));
  assert.strictEqual(fns.effDate({}), "");
});
test("last weights come from the most recent earlier session of the same exercise, spelled any way", () => {
  app.reset(); maps.clients.set("c1", { id: "c1", name: "Jane" });
  const mk = (id, n, name, w) => maps.trainings.set(id, { id, clientId: "c1", date: day(n), createdAt: "2026-10-0" + (5 + n % 4) + "T10:00:00.000Z", completedAt: null, skippedAt: null, rows: [{ id: id + "r", name, weights: w, repsDone: ["5"], setsDone: w.length }] });
  mk("old", -10, "Push-up", ["20"]); mk("mid", -5, "push up", ["25"]); mk("future", 3, "Push-up", ["99"]); mk("cur", 0, "Pushup", []);
  const last = fns.lastWeights(maps.trainings.get("cur"), maps.trainings.get("cur").rows[0]);
  assert.ok(last); assert.deepStrictEqual(last.weights, ["25"]);
});
test("a backup is accepted whole or refused whole", () => {
  app.reset();
  const good = { app: "fiala-trainings", clients: { c1: { id: "c1", name: "A" } }, trainings: { t1: { id: "t1", clientId: "c1", rows: [{ id: "r1" }], date: "2026-10-01" } } };
  const out = fns.validateBackup(good); assert.strictEqual(out.cs.length, 1); assert.strictEqual(out.ts.length, 1);
  for (const bad of [
    { app: "fiala-trainings", clients: { c1: { id: "c1", name: "A" } }, trainings: { t1: null } },
    { app: "other", clients: {}, trainings: {} },
    { app: "fiala-trainings", clients: {}, trainings: { t1: { id: "t1", clientId: "nobody", rows: [] } } },
    { app: "fiala-trainings", clients: { c1: { id: "c1", name: "A" } }, trainings: { t1: { id: "t1", clientId: "c1", rows: [], date: "yesterday" } } },
    [], null, "text",
  ]) assert.throws(() => fns.validateBackup(bad));
  assert.strictEqual(maps.clients.size, 0, "validation never writes");
});
test("the app's own backup shape, with a client without a name and a template, is accepted", () => {
  app.reset();
  const d = { app: "fiala-trainings", exported: "x", clients: { c1: { id: "c1" }, tpl: { id: "00000000-0000-4000-8000-0000000000f1", name: "Templates", kind: "templates" } }, trainings: { t1: { id: "t1", clientId: "00000000-0000-4000-8000-0000000000f1", rows: [], date: "2026-01-01", title: "Upper A" } } };
  assert.doesNotThrow(() => fns.validateBackup(d));
});
test("notes: the old single note shows as Earlier, saving folds it in, merges keep both sides and honour a deletion", async () => {
  const c = { id: "c1", notes: "Bad knee" };
  const e = fns.noteEntries(c); assert.strictEqual(e.length, 1); assert.strictEqual(e[0].id, "legacy"); assert.strictEqual(e[0].at, null);
  const packed = fns.packNotes([...e, { id: "n1", at: "2026-10-13T10:00:00.000Z", text: "New" }]);
  assert.strictEqual(packed.log.length, 2); assert.notStrictEqual(packed.log[0].id, "legacy");
  const theirs = { log: [{ id: "n1", at: "2026-10-13T10:00:00.000Z", text: "New" }, { id: "n2", at: "2026-10-13T11:00:00.000Z", text: "Theirs" }] };
  const merged = fns.mergeNotes(packed, theirs); assert.deepStrictEqual(merged.log.map((x) => x.text).sort(), ["Bad knee", "New", "Theirs"]);
  const { mergeNotes } = await import("../app/notes.js");
  const kept = mergeNotes(packed, theirs, new Set(["n2"])); assert.deepStrictEqual(kept.log.map((x) => x.text).sort(), ["Bad knee", "New"], "a note deleted on this device does not come back");
  assert.deepStrictEqual(fns.noteEntries({ notes: { log: [null, { id: "x", at: "nonsense", text: "T" }, { id: "y", text: 5 }] } }).map((x) => [x.id, x.at]), [["x", null]]);
});
test("a workout tagged on a note keeps its tag through pack and merge", () => {
  const list = [{ id: "n1", at: "2026-10-13T10:00:00.000Z", text: "Twinge", workout: { id: "t1", title: "Back", date: "2026-10-12" } }];
  const packed = fns.packNotes(list); assert.deepStrictEqual(packed.log[0].workout, list[0].workout);
  const again = fns.noteEntries({ notes: packed }); assert.deepStrictEqual(again[0].workout, list[0].workout);
});
test("a plan written in time is logged as time; one in reps is not", () => {
  assert.deepStrictEqual(timedPlan("30 sec"), { n: "30", unit: "sec" }); assert.deepStrictEqual(timedPlan("45s"), { n: "45", unit: "sec" });
  assert.deepStrictEqual(timedPlan("1 min"), { n: "1", unit: "min" }); assert.deepStrictEqual(timedPlan("30-45 seconds / side"), { n: "30", unit: "sec" });
  for (const reps of ["10", "6, 6, 4", "8-10 reps", "10 / side", "", "max", "AMRAP", "seconds"]) assert.strictEqual(timedPlan(reps), null, reps);
});
