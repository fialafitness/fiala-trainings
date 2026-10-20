import { test, assert } from "./assert.js";
import { load } from "./load.js";
import { timedPlan, perHand, topSet, betterSet, sameSet, correctFrom, planProgress, sessionNo, planActive } from "../app/model.js";
import { monthLater, daysLater } from "../app/util.js";
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
  // every spelling of time he uses: mm:ss, 30", "max hold", "hold 30"; the exercise name never decides (a plank jack with 12 is reps)
  assert.deepStrictEqual(timedPlan("1:30"), { n: "90", unit: "sec" }); assert.deepStrictEqual(timedPlan("0:45 / side"), { n: "45", unit: "sec" }); assert.deepStrictEqual(timedPlan('30"'), { n: "30", unit: "sec" });
  assert.deepStrictEqual(timedPlan("Max hold"), { n: "", unit: "sec" }); assert.deepStrictEqual(timedPlan("hold 30"), { n: "30", unit: "sec" }); assert.strictEqual(timedPlan("as long as possible").unit, "sec");
  assert.deepStrictEqual(timedPlan("30 Seconds each side"), { n: "30", unit: "sec" }); assert.deepStrictEqual(timedPlan("2 mins"), { n: "2", unit: "min" }); assert.deepStrictEqual(timedPlan("30sec"), { n: "30", unit: "sec" });
  assert.strictEqual(timedPlan("12", "Elbow plank jack"), null); assert.strictEqual(timedPlan("60", "Plank"), null, "a bare number is reps until he writes sec"); assert.strictEqual(timedPlan("3:00:00"), null, "not a time of day");
});
test("a dumbbell or kettlebell exercise is logged per hand, everything else as loaded", () => {
  for (const [n, v] of [["Dumbbell bicep curl", "dumbbell"], ["DB bench press", "dumbbell"], ["Goblet squat (dumbell)", "dumbbell"], ["Kettlebell swing", "kettlebell"], ["KB goblet squat", "kettlebell"], ["Barbell row", null], ["Deadbug", null], ["Cable curl", null], ["", null]]) assert.strictEqual(perHand(n), v, n);
});

test("the top set of a row: heaviest then most reps; a hold: longest then heaviest; bodyweight reps count below any weight", () => {
  assert.deepStrictEqual(topSet({ weights: ["100", "105", "105"], repsDone: ["8", "6", "7"] }, false), { w: 105, rp: 7 });
  assert.deepStrictEqual(topSet({ weights: ["", "25"], repsDone: ["45", "30"] }, true), { w: null, rp: 45 });
  assert.deepStrictEqual(topSet({ weights: ["", ""], repsDone: ["10", "12"] }, false), { w: null, rp: 12 });
  assert.deepStrictEqual(topSet({ weights: ["bw", "20"], repsDone: ["15", "8"] }, false), { w: 20, rp: 8 });
  assert.strictEqual(topSet({ weights: [], repsDone: [] }, false), null); assert.strictEqual(topSet({ weights: ["", ""], repsDone: ["", ""] }, true), null);
  // a weight typed into a set that was never completed is not a lift (Aly's phantom 58 lb curl)
  assert.deepStrictEqual(topSet({ weights: ["50", "58"], repsDone: ["10", ""], setsDone: 1 }, false), { w: 50, rp: 10 });
  assert.deepStrictEqual(topSet({ weights: ["50", "58"], repsDone: ["10", ""], setsDone: 2 }, false), { w: 58, rp: null });     // completed without reps: it happened
  assert.deepStrictEqual(topSet({ weights: ["50", "58"], repsDone: ["10", "8"], setsDone: 1 }, false), { w: 58, rp: 8 });       // reps typed: a deliberate log
  assert.deepStrictEqual(topSet({ weights: ["50", "58"], repsDone: ["10", ""], setsDone: 1 }, false, 2), { w: 58, rp: null });  // the card previews the set under the finger
  assert.strictEqual(topSet({ weights: ["58"], repsDone: [""], setsDone: 0 }, false), null);
  assert.deepStrictEqual(topSet({ weights: ["58"], repsDone: [""], done: true }, false), { w: 58, rp: null });                 // an old row without a count: finished = it counts
  // correcting a wrong number: the later sets that copied it follow; a set typed differently stays; typing char by char keeps the chain
  assert.deepStrictEqual(correctFrom(["58", "58", "58", "60"], 0, "50"), ["50", "50", "50", "60"]);
  assert.deepStrictEqual(correctFrom(["58", "58"], 1, "50"), ["58", "50"]);
  assert.deepStrictEqual(correctFrom(correctFrom(["58", "58"], 0, "5"), 0, "50"), ["50", "50"]);
  assert.deepStrictEqual(correctFrom(["", "58"], 0, "50"), ["50", "58"]);                                                       // an empty box corrected: nothing was copied from it
  assert.deepStrictEqual(correctFrom([], 2, "40"), ["", "", "40"]);
  assert.ok(betterSet({ w: 225, rp: 5 }, { w: 215, rp: 4 }, false)); assert.ok(!betterSet({ w: 215, rp: 4 }, { w: 215, rp: 4 }, false), "equal is not better");
  assert.ok(betterSet({ w: null, rp: 45 }, { w: 25, rp: 30 }, true), "a longer hold beats a heavier shorter one"); assert.ok(sameSet({ w: 1, rp: 2 }, { w: 1, rp: 2 }) && !sameSet({ w: 1, rp: 2 }, null));
});

test("the client overview counts finished workouts and finds the heaviest set per exercise", () => {
  app.reset(); maps.clients.set("c1", { id: "c1", name: "Jane", unit: "lb" });
  const tr = (id, date, rows, done) => ({ id, clientId: "c1", title: "Legs", date, createdAt: date + "T10:00:00.000Z", completedAt: done ? date + "T18:00:00.000Z" : null, skippedAt: null, rows });
  const row = (name, reps, w, rp) => ({ id: name + reps, label: "1", name, reps, weights: w, repsDone: rp, setsDone: w.length });
  maps.trainings.set("a", tr("a", "2026-09-29", [row("Bench press", "5", ["230"], ["3"])], true));
  maps.trainings.set("b", tr("b", "2026-10-06", [row("Bench Press", "5", ["215"], ["4"]), row("Plank", "30 sec", ["", ""], ["30", "45"])], true));
  maps.trainings.set("c", tr("c", "2026-10-13", [row("Bench press", "5", ["240"], ["1"])], false));
  const n = fns.overviewCounts([...maps.trainings.values()], "2026-10"); assert.deepStrictEqual(n, { total: 2, month: 1 });
  const ex = fns.loggedExercises(maps.clients.get("c1"));
  const bench = [...ex.values()].find((e) => /bench/i.test(e.name)); assert.strictEqual(bench.count, 3, "spellings merge"); assert.deepStrictEqual([bench.best.w, bench.best.rp, bench.best.date], [240, 1, "2026-10-13"], "an unfinished session's set still counts as a lift");
  const plank = ex.get("plank"); assert.ok(plank.timed); assert.deepStrictEqual([plank.best.rp, plank.best.w], [45, null]);
});

test("a sessions package counts finished in-person workouts since it started, rolls into the next package, and takes the trainer's correction", () => {
  const tr = (id, date, inPerson, done, extra) => ({ id, clientId: "c1", date, createdAt: date + "T10:00:00.000Z", completedAt: done ? date + "T18:00:00.000Z" : null, skippedAt: null, inPerson, rows: [], ...(extra || {}) });
  const plan = { id: "p", name: "10 sessions", kind: "sessions", size: 10, startedOn: "2026-10-01", adjust: 0 };
  const list = [tr("a", "2026-09-28", true, true), tr("b", "2026-10-02", true, true), tr("c", "2026-10-04", false, true), tr("d", "2026-10-06", true, true), tr("e", "2026-10-08", true, false), tr("f", "2026-10-10", true, false, { skippedAt: "x" })];
  assert.deepStrictEqual(planProgress(plan, list), { used: 2, size: 10, packNo: 1, inPack: 2, left: 8, complete: false }, "before the start and solo workouts do not count; unfinished ones not yet");
  assert.deepStrictEqual(sessionNo(plan, list, list[1]), { n: 1, size: 10, packNo: 1 }); assert.deepStrictEqual(sessionNo(plan, list, list[4]), { n: 3, size: 10, packNo: 1 }, "a planned session gets the next number");
  const stale = tr("z", "2026-10-03", true, false); assert.deepStrictEqual(sessionNo(plan, [...list, stale], list[3]).n, 2, "a planned session dated earlier never shifts a finished one"); assert.deepStrictEqual(sessionNo(plan, [...list, stale], stale).n, 3, "it queues after the finished ones");
  assert.strictEqual(sessionNo(plan, list, list[2]), null, "a solo workout has no number"); assert.strictEqual(sessionNo(plan, list, list[5]), null, "a skipped one neither");
  assert.deepStrictEqual(planProgress({ ...plan, adjust: 1 }, list).inPack, 3, "a session outside the app, added by hand");
  assert.deepStrictEqual(planProgress({ ...plan, adjust: -5 }, list).used, 0, "never below zero");
  const ten = Array.from({ length: 10 }, (_, i) => tr("s" + i, "2026-10-" + String(11 + i).padStart(2, "0"), true, true));
  const full = planProgress(plan, [...list, ...ten]); assert.deepStrictEqual([full.used, full.inPack, full.complete, full.packNo], [12, 2, false, 2], "12 done: package 2, session 2");
  const exact = planProgress(plan, [...list, ...ten.slice(0, 8)]); assert.deepStrictEqual([exact.inPack, exact.complete, exact.packNo], [10, true, 1], "exactly full reads 10 of 10, complete");
  assert.strictEqual(planProgress({ ...plan, kind: "monthly" }, list), null); assert.strictEqual(planProgress(null, list), null);
});
test("a monthly plan is active until its day; everything else is always active", () => {
  assert.ok(planActive({ kind: "monthly", until: "2026-10-14" }, "2026-10-14")); assert.ok(!planActive({ kind: "monthly", until: "2026-10-13" }, "2026-10-14"));
  assert.ok(planActive({ kind: "monthly" }, "2026-10-14")); assert.ok(planActive({ kind: "sessions", size: 10 }, "2026-10-14")); assert.ok(planActive(null, "2026-10-14"));
});
test("a month later lands on the same day, or the last day of a short month", () => {
  assert.strictEqual(monthLater("2026-10-14"), "2026-11-14"); assert.strictEqual(monthLater("2026-01-31"), "2026-02-28"); assert.strictEqual(monthLater("2028-01-31"), "2028-02-29");
  assert.strictEqual(monthLater("2026-10-31"), "2026-11-30"); assert.strictEqual(monthLater("2026-12-05"), "2027-01-05");
  assert.strictEqual(daysLater("2026-10-14", 28), "2026-11-11"); assert.strictEqual(daysLater("2026-12-20", 28), "2027-01-17");
});
