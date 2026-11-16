import { test, assert } from "./assert.js";
import { load } from "./load.js";
import { followFrom, timedPlan, distPlan, measurePlan, timeAsWeight, repairTimed, planNumber, autoSubtitle, splitName, perHand, weightIn, weightStored, sameWeightText, weightNumber, kgOf, stampUnit, toTimeUnit, topSet, betterSet, sameSet, correctFrom, planProgress, sessionNo, planActive, composeName } from "../app/model.js";
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
test("last time's hold carries into a plan in the other time unit only when it converts whole; reps never carry into a timed plan", () => {
  app.reset(); maps.clients.set("c1", { id: "c1", name: "Jane" });
  const mk = (id, n, reps, done) => maps.trainings.set(id, { id, clientId: "c1", date: day(n), createdAt: "2026-10-05T10:00:00.000Z", completedAt: null, skippedAt: null, rows: [{ id: id + "r", name: "Plank", reps, weights: [""], repsDone: done, setsDone: 1 }] });
  const last = (reps) => { mk("cur", 0, reps, [""]); return fns.lastWeights(maps.trainings.get("cur"), maps.trainings.get("cur").rows[0]).reps; };
  mk("old", -3, "45 sec", ["45"]);
  assert.deepStrictEqual(last("1 min"), [""], "45 seconds is not a whole number of minutes: nothing is suggested, the plan's number shows");
  mk("old", -3, "60 sec", ["120"]);
  assert.deepStrictEqual(last("1 min"), ["2"], "120 seconds into a minutes plan is 2");
  mk("old", -3, "2 min", ["2"]);
  assert.deepStrictEqual(last("90 sec"), ["120"], "2 minutes into a seconds plan is 120");
  mk("old", -3, "10 reps", ["10"]);
  assert.deepStrictEqual(last("30 sec"), [], "ten reps are not seconds");
});
const U = (n) => "00000000-0000-4000-8000-" + String(n).padStart(12, "0");   // the server's id columns take uuids only
test("a backup is accepted whole or refused whole", () => {
  app.reset();
  const good = { app: "fiala-trainings", clients: { c1: { id: U(1), name: "A" } }, trainings: { t1: { id: U(2), clientId: U(1), rows: [{ id: "r1" }], date: "2026-10-01" } } };
  const out = fns.validateBackup(good); assert.strictEqual(out.cs.length, 1); assert.strictEqual(out.ts.length, 1);
  for (const bad of [
    { app: "fiala-trainings", clients: { c1: { id: U(1), name: "A" } }, trainings: { t1: null } },
    { app: "other", clients: {}, trainings: {} },
    { app: "fiala-trainings", clients: {}, trainings: { t1: { id: U(2), clientId: U(9), rows: [], date: "2026-10-01" } } },
    { app: "fiala-trainings", clients: { c1: { id: U(1), name: "A" } }, trainings: { t1: { id: U(2), clientId: U(1), rows: [], date: "yesterday" } } },
    { app: "fiala-trainings", clients: { c1: { id: "c1", name: "A" } }, trainings: {} },
    [], null, "text",
  ]) assert.throws(() => fns.validateBackup(bad));
  assert.strictEqual(maps.clients.size, 0, "validation never writes");
});
test("the app's own backup shape, with a client without a name and a template, is accepted", () => {
  app.reset();
  const d = { app: "fiala-trainings", exported: "x", clients: { c1: { id: U(1) }, tpl: { id: "00000000-0000-4000-8000-0000000000f1", name: "Templates", kind: "templates" } }, trainings: { t1: { id: U(2), clientId: "00000000-0000-4000-8000-0000000000f1", rows: [], date: "2026-01-01", title: "Upper A", template: { program: "Performance Training", phase: 1, stage: 2, n: 3, phaseName: "" } } } };
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

test("seconds the old app typed as a weight move to the time column on a hold, once, and a real weight stays", () => {
  const t = { rows: [
    { reps: "45 sec", weights: ["45 sec", "1 min", "0:50", "BW"], repsDone: ["", "", "", ""] },
    { reps: "30 sec", weights: ["30 sec", "25"], repsDone: ["32", ""] },          // the time was already logged: the weight was a copy; 25 lb is a weight
    { reps: "2 min", weights: ["90 sec", "2 min"], repsDone: ["", ""] },             // 90 sec is not whole minutes: left alone
    { reps: "10", weights: ["45 sec"], repsDone: [""] },                            // not a hold: nothing moves
    { reps: "45 sec", weights: ["40 sec"] },                                        // no repsDone array yet
  ] };
  assert.strictEqual(repairTimed(t), true);
  assert.deepStrictEqual(t.rows[0].weights, ["", "", "", "BW"]); assert.deepStrictEqual(t.rows[0].repsDone, ["45", "60", "50", ""]);
  assert.deepStrictEqual(t.rows[1].weights, ["", "25"]); assert.deepStrictEqual(t.rows[1].repsDone, ["32", ""]);
  assert.deepStrictEqual(t.rows[2].weights, ["90 sec", ""]); assert.deepStrictEqual(t.rows[2].repsDone, ["", "2"]);
  assert.deepStrictEqual(t.rows[3].weights, ["45 sec"]); assert.deepStrictEqual(t.rows[3].repsDone, [""]);
  assert.deepStrictEqual(t.rows[4].weights, [""]); assert.deepStrictEqual(t.rows[4].repsDone, ["40"]);
  assert.strictEqual(repairTimed(t), false, "a second pass changes nothing");
  assert.strictEqual(repairTimed({ rows: [] }), false); assert.strictEqual(repairTimed(null), false);
  assert.strictEqual(timeAsWeight("BW"), null); assert.strictEqual(timeAsWeight("25"), null); assert.strictEqual(timeAsWeight("hold"), null); assert.deepStrictEqual(timeAsWeight("45 sec"), { n: "45", unit: "sec" });
});

test("the plan's number for an untouched set: one number as is, the highest of a range or a list, nothing for max or a bare hold", () => {
  for (const [reps, want] of [["10", "10"], ["8\u201310", "10"], ["8-12 reps", "12"], ["10 / side", "10"], ["12 each leg", "12"], ["6, 6, 4", "6"], ["12, 10, 8", "12"], ["1", "1"],
    ["45 sec", "45"], ["30-45 sec", "45"], ["1:00", "60"], ["1:30 / side", "90"], ["2 min", "2"], ["max", ""], ["AMRAP", ""], ["Max hold", ""], ["hold", ""], ["", ""], ["12.5", ""]]) assert.strictEqual(planNumber(reps), want, reps);
});

test("a long name splits into a title and a subtitle at a bracket, comma or dash; his own ending wins; nothing else splits", () => {
  assert.deepStrictEqual(splitName("TRX row (underhand, to chest)"), { title: "TRX row", sub: "underhand, to chest" });
  assert.deepStrictEqual(splitName("Cable face pull with rotation, to forehead"), { title: "Cable face pull with rotation", sub: "to forehead" });
  assert.deepStrictEqual(splitName("Dumbbell seated bent-over shrug \u2013 iso"), { title: "Dumbbell seated bent-over shrug", sub: "iso" });
  assert.deepStrictEqual(splitName("Seated overhead press from pins (low)"), { title: "Seated overhead press from pins", sub: "low" });
  assert.deepStrictEqual(splitName("Deadlift"), { title: "Deadlift", sub: "" }); assert.deepStrictEqual(splitName("Deep squat with reach"), { title: "Deep squat with reach", sub: "" });
  assert.deepStrictEqual(splitName("Bent-over row"), { title: "Bent-over row", sub: "" }, "a hyphen inside a word is not a dash");
  assert.deepStrictEqual(splitName("Cable face pull with rotation, to forehead", "with rotation, to forehead"), { title: "Cable face pull", sub: "with rotation, to forehead" }, "his own ending");
  assert.deepStrictEqual(splitName("Cable face pull with rotation, to forehead", ""), { title: "Cable face pull with rotation, to forehead", sub: "" }, "none: one line");
  assert.deepStrictEqual(splitName("Cable face pull with rotation, to forehead", "rotation"), { title: "Cable face pull with rotation, to forehead", sub: "" }, "not the end of the name: no split");
  assert.deepStrictEqual(splitName("TRX row (underhand, to chest)", "to chest"), { title: "TRX row (underhand", sub: "to chest" });
  assert.strictEqual(autoSubtitle("(low)"), ""); assert.strictEqual(autoSubtitle(""), "");
});

test("a plan in meters logs distance the way a hold logs time; min is still time, max is nothing", () => {
  assert.deepStrictEqual(distPlan("40 m"), { n: "40", unit: "m" }); assert.deepStrictEqual(distPlan("40m"), { n: "40", unit: "m" }); assert.deepStrictEqual(distPlan("20-40 meters"), { n: "20", unit: "m" }); assert.deepStrictEqual(distPlan("40 m / side"), { n: "40", unit: "m" });
  for (const reps of ["2 min", "max", "10", "AMRAP", "", "45 sec"]) assert.strictEqual(distPlan(reps), null, reps);
  assert.deepStrictEqual(measurePlan("2 min"), { n: "2", unit: "min" }); assert.deepStrictEqual(measurePlan("40 m"), { n: "40", unit: "m" }); assert.strictEqual(measurePlan("10"), null);
  assert.strictEqual(planNumber("40 m"), "40"); assert.strictEqual(planNumber("20-40 m"), "40");
});

test("a logged weight keeps its unit and reads in the client's at one decimal, never rewritten; a number typed in the other unit is kept so it reads back as typed; holds compare in seconds", () => {
  // v301: shown in the unit picked (the owner's picks: one decimal, no ".0"), words as written
  assert.strictEqual(weightIn("135", "lb", "kg"), "61.2"); assert.strictEqual(weightIn("60", "kg", "lb"), "132.3"); assert.strictEqual(weightIn("100", "kg", "lb"), "220.5"); assert.strictEqual(weightIn("2.5", "lb", "kg"), "1.1"); assert.strictEqual(weightIn("20", "kg", "lb"), "44.1");
  assert.strictEqual(weightIn("135", "lb", "lb"), "135", "its own unit: as typed"); assert.strictEqual(weightIn("61,5", "kg", "kg"), "61,5", "a comma kept"); assert.strictEqual(weightIn("61.23", "kg", "kg"), "61.2", "a kept conversion at one decimal"); assert.strictEqual(weightIn("22,25", "kg", "kg"), "22,3");
  assert.strictEqual(weightIn("BW", "lb", "kg"), "BW"); assert.strictEqual(weightIn("2x20", "lb", "kg"), "2x20 lb", "words with a number say the unit they were logged in"); assert.strictEqual(weightIn("2x20", "lb", "lb"), "2x20");
  assert.strictEqual(weightIn("60kg", "lb", "kg"), "60kg", "a unit already written"); assert.strictEqual(weightIn("25s", "lb", "kg"), "25s", "a pair of 25s ends in a word"); assert.strictEqual(weightIn("1,000", "lb", "kg"), "453.6", "a thousand with a comma is never 1.0"); assert.strictEqual(weightIn("1,000", "lb", "lb"), "1,000"); assert.strictEqual(weightNumber("1,000"), 1000);
  assert.strictEqual(weightIn("60.", "lb", "kg"), "27.2", "a point left at the end"); assert.strictEqual(weightIn("60.", "lb", "lb"), "60."); assert.strictEqual(weightIn("+20", "lb", "kg"), "+20 lb");
  for (const w of ["Band 3", "Level 8", "#3", "1:30", "no. 4"]) assert.strictEqual(weightIn(w, "lb", "kg"), w, "a numbered thing that is not a weight stays as written: " + w);
  assert.strictEqual(weightIn("", "lb", "kg"), ""); assert.strictEqual(weightIn(null, "lb", "kg"), ""); assert.strictEqual(weightIn("100", null, "kg"), "100");
  // typed in the client's unit, kept in the exercise's own: the shortest number that reads back as typed, and the same weight in its own unit
  assert.strictEqual(weightStored("60", "kg", "lb"), "132.3"); assert.strictEqual(weightStored("135", "lb", "kg"), "61.23"); assert.strictEqual(weightStored("132.3", "lb", "kg"), "60"); assert.strictEqual(weightStored("61.2", "kg", "lb"), "134.9", "61.2 kg is 134.92 lb: kept as it reads in pounds, not rounded up to 135"); assert.strictEqual(weightStored("10", "kg", "lb"), "22"); assert.strictEqual(weightStored("6.5", "lb", "kg"), "2.948", "three decimals when two do not read back"); assert.strictEqual(weightIn("1.15", "kg", "kg"), "1.2", "a half rounds up, never down by a float's hair");
  assert.strictEqual(weightStored("BW", "kg", "lb"), "BW"); assert.strictEqual(weightStored("60", "kg", "kg"), "60"); assert.strictEqual(weightStored(" 60 ", null, "lb"), " 60 ");
  assert.strictEqual(weightStored("2x10", "kg", "lb"), "2x10 kg", "words carry the unit they were typed in"); assert.strictEqual(weightIn("2x10 kg", "lb", "kg"), "2x10 kg"); assert.strictEqual(weightStored("Band 3", "kg", "lb"), "Band 3");
  assert.strictEqual(weightStored("60.", "kg", "lb"), "132.3"); assert.strictEqual(weightStored("1,000", "lb", "kg"), "453.6"); assert.strictEqual(weightStored("9999999999999", "lb", "kg"), "9999999999999 lb", "never past the server's 16 characters"); assert.strictEqual(weightStored("20+20+20+20+20", "kg", "lb"), "20+20+20+20+20", "words that would pass 16 characters with their unit stay as typed");
  assert.ok(sameWeightText("61,2", "61.2") && sameWeightText(" 135 ", "135") && !sameWeightText("61.3", "61.2") && sameWeightText("BW", "BW"), "the number shown typed back, a comma keypad too");
  for (const [from, to] of [["lb", "kg"], ["kg", "lb"]]) for (let k = 1; k <= 30000; k += 2) {   // every hundredth ending in 5 (the halves at one decimal) up to 300: read back as typed
    const v = (k / 200).toFixed(2), kept = weightStored(v, from, to);
    if (weightIn(kept, to, from) !== weightIn(v, from, from) || weightIn(kept, to, to) !== weightIn(v, from, to) || kept.length > 16) assert.fail(v + " " + from + " kept as " + kept + " reads " + weightIn(kept, to, from));
  }
  for (const [from, to, top] of [["lb", "kg", 15000], ["kg", "lb", 5000]]) for (let k = 1; k <= top; k++) {   // every tenth of a pound to 1,500 and of a kilo to 500
    const v = String(k / 10), kept = weightStored(v, from, to);
    if (weightIn(kept, to, from) !== v || weightIn(kept, to, to) !== weightIn(v, from, to) || kept.length > 16) assert.fail(v + " " + from + " kept as " + kept + " reads " + weightIn(kept, to, from) + " / " + weightIn(kept, to, to));
  }
  // switching back and forth never moves a number: nothing is rewritten, so 135 lb is 135 lb again
  assert.strictEqual(weightIn(weightIn("135", "lb", "lb"), "lb", "lb"), "135");
  const t = { rows: [{ weights: ["100", "105"] }, { weights: ["", ""] }, { weights: ["60"], unit: "kg" }, { weights: ["2x20"] }, { weights: ["BW"] }, {}] };
  assert.strictEqual(stampUnit(t, "lb"), true); assert.strictEqual(t.rows[0].unit, "lb"); assert.strictEqual(t.rows[1].unit, undefined, "nothing logged: no unit"); assert.strictEqual(t.rows[2].unit, "kg", "already stamped"); assert.strictEqual(t.rows[3].unit, undefined, "plain numbers only, as the server's rule (client-profile.sql)"); assert.strictEqual(t.rows[4].unit, undefined, "BW has no unit"); assert.strictEqual(stampUnit(t, "lb"), false);
  // sets in two units rank in kilograms, within 0.06 kg the same weight
  const lb = (w, rp) => ({ w, rp, u: "lb" }), kg = (w, rp) => ({ w, rp, u: "kg" });
  assert.ok(!betterSet(kg(61.2, 5), lb(135, 5), false), "135 lb shown as 61.2 kg and lifted for as many: not a best");
  assert.ok(betterSet(kg(61.2, 8), lb(135, 5), false), "the same weight for more reps: a best");
  assert.ok(betterSet(kg(61.3, 5), lb(135, 5), false), "0.065 kg heavier: a best"); assert.ok(betterSet(kg(45.5, 5), lb(100, 5), false), "45.5 kg is 100.3 lb");
  assert.ok(!betterSet(lb(135, 5), kg(61.2, 5), false)); assert.ok(sameSet(kg(61.2, 5), lb(135, 5)) && !sameSet(kg(61.2, 5), lb(135, 6)));
  assert.ok(!betterSet(kg(9.1, 45), lb(20, 45), true), "a hold: 9.1 kg is the 20 lb (9.07 kg)"); assert.ok(betterSet(kg(9.2, 45), lb(20, 45), true)); assert.ok(betterSet(kg(null, 46), lb(20, 45), true), "longer first");
  assert.ok(betterSet(lb(0.25, 5), lb(0, 5), false), "the smallest real step still counts");
  assert.ok(!betterSet(kg(102.06, 5), kg(102, 5), false) && sameSet(kg(102.06, 5), kg(102, 5)), "exactly 0.06 kg is the same weight, a float's hair over too");
  assert.ok(kgOf(lb(135, 5)) > kgOf(kg(61.2, 5)) && kgOf({ w: null, rp: 5 }) === -1, "the heavier of two the same keeps the title");
  assert.deepStrictEqual(toTimeUnit({ w: null, rp: 1 }, "min", "sec"), { w: null, rp: 60 }); assert.deepStrictEqual(toTimeUnit({ w: null, rp: 90 }, "sec", "min"), { w: null, rp: 1.5 }); assert.deepStrictEqual(toTimeUnit({ w: null, rp: 40 }, "m", "sec"), { w: null, rp: 40 }, "a carry is not a hold");
});
test("a backup is refused when a field a screen reads as a list or an object is something else, when ids repeat, or when a later app wrote it", () => {
  app.reset();
  const base = () => ({ app: "fiala-trainings", format: 1, clients: { c1: { id: U(1), name: "A", unit: "lb", paused: false, seenNotes: ["x"], seenDoneAt: "2026-10-01T10:00:00.000Z", packages: [{ id: "p1", name: "10 sessions", kind: "sessions", size: 10, inPerson: true }], plan: { id: "p1", kind: "sessions", size: 10, adjust: 0, startedOn: "2026-10-01" }, planHistory: [], notes: { log: [] } } },
    trainings: { t1: { id: U(2), clientId: U(1), date: "2026-10-01", title: "A", completedAt: null, skippedAt: null, missed: false, inPerson: true, rows: [{ id: "r1", name: "Squat", label: "1", sets: "3", setsDone: 2, reps: "5", rest: "", tempo: "", note: "", weights: ["100", 100, null], repsDone: ["5"], alts: ["Lunge"], unit: "lb", done: false }] } } });
  assert.doesNotThrow(() => fns.validateBackup(base(), () => false), "the app's own shape, counts as strings or numbers, nulls where the app writes nulls");
  assert.doesNotThrow(() => { const d = base(); d.clients.c1.folders = [{ id: "f1", name: "Summer", parent: null, kind: "folder", at: "2026-11-12T10:00:00.000Z" }]; d.trainings.t1.template = { program: "My templates", phase: 0, stage: 0, n: 1, folder: "f1" }; fns.validateBackup(d, () => false); }, "his template folders (12 Nov), and a template's place in one");
  const bad = [
    ["weights as an object", (d) => { d.trainings.t1.rows[0].weights = { 0: "100" }; }],
    ["alternatives as a string", (d) => { d.trainings.t1.rows[0].alts = "Lunge"; }],
    ["an alternative that is not a name", (d) => { d.trainings.t1.rows[0].alts = [{ name: "Lunge" }]; }],
    ["a name that is an object", (d) => { d.trainings.t1.rows[0].name = { first: "Squat" }; }],
    ["a weight that is an object", (d) => { d.trainings.t1.rows[0].weights = [{ kg: 100 }]; }],
    ["two rows with one id", (d) => { d.trainings.t1.rows.push({ id: "r1" }); }],
    ["a finish stamp that is a number", (d) => { d.trainings.t1.completedAt = 5; }],
    ["a flag that is a word", (d) => { d.trainings.t1.missed = "yes"; }],
    ["packages as an object", (d) => { d.clients.c1.packages = { p1: {} }; }],
    ["template folders as an object", (d) => { d.clients.c1.folders = { a: 1 }; }],
    ["a template folder that is not an object", (d) => { d.clients.c1.folders = ["Summer"]; }],
    ["a template's folder that is not a word", (d) => { d.trainings.t1.template = { program: "My templates", phase: 0, stage: 0, n: 1, folder: 7 }; }],
    ["the Programs order as a word", (d) => { d.clients.c1.rootOrder = "p:Fat Burn"; }],
    ["a Programs order key that is not a word", (d) => { d.clients.c1.rootOrder = [{ key: "p:Fat Burn" }]; }],
    ["a package without an id", (d) => { d.clients.c1.packages = [{ name: "no id" }]; }],
    ["a plan as a string", (d) => { d.clients.c1.plan = "10 sessions"; }],
    ["notes as a list", (d) => { d.clients.c1.notes = ["a"]; }],
    ["a unit the app does not know", (d) => { d.clients.c1.unit = "stone"; }],
    ["two clients with one id", (d) => { d.clients.c2 = { id: "c1", name: "twin" }; }],
    ["two workouts with one id", (d) => { d.trainings.t2 = { ...d.trainings.t1 }; }],
    ["a later format", (d) => { d.format = 2; }],
    ["a finish stamp that is not a moment", (d) => { d.trainings.t1.completedAt = "yesterday"; }],
    ["a row unit the app would rescale", (d) => { d.trainings.t1.rows[0].unit = "lbs"; }],
    ["a client order that is a word", (d) => { d.clients.c1.sort = "first"; }],
    ["a package without a name", (d) => { d.clients.c1.packages = [{ id: "p1", kind: "sessions", size: 10 }]; }],
    ["a sessions package without a size", (d) => { d.clients.c1.packages = [{ id: "p1", name: "Ten", kind: "sessions", size: null }]; }],
    ["seen notes that are not a list", (d) => { d.clients.c1.seenNotes = 5; }],
    ["an id the server cannot hold", (d) => { d.clients.c1.id = "c1"; d.trainings.t1.clientId = "c1"; }],
    ["a template program that is a number", (d) => { d.trainings.t1.template = { program: 1 }; }],
    ["a done flag that is a word", (d) => { d.trainings.t1.rows[0].done = "false"; }],
  ];
  for (const [why, b] of bad) { const d = base(); b(d); assert.throws(() => fns.validateBackup(d, () => false), Error, "should refuse: " + why); }
  const later = base(); later.format = 2; assert.throws(() => fns.validateBackup(later, () => false), /newer backup/);
  const old = base(); delete old.format; assert.doesNotThrow(() => fns.validateBackup(old, () => false), "a backup from before the format number");
});

test("a correction reaches the copied sets keystroke by keystroke; a plan's number is the first one; a weight box never reads as a time; the new client's unit is their own", () => {
  const follow = followFrom(["100", "100", "100", "90"], 0, "100"); assert.deepStrictEqual(follow, [1, 2]);
  let ws = correctFrom(["100", "100", "100", "90"], 0, "10", "100", follow); ws = correctFrom(ws, 0, "105", "100", follow);   // backspace, then a digit
  assert.deepStrictEqual(ws, ["105", "105", "105", "90"], "the chain holds through the intermediate value");
  assert.deepStrictEqual(timedPlan("10 reps, 2 sec hold at top"), null); assert.deepStrictEqual(timedPlan("12 (hold 2s at bottom)"), null); assert.deepStrictEqual(timedPlan("10 reps, 30 sec rest"), null);
  assert.deepStrictEqual(timedPlan("30 sec"), { n: "30", unit: "sec" }); assert.deepStrictEqual(timedPlan("3 x 30 sec"), { n: "30", unit: "sec" }); assert.deepStrictEqual(timedPlan("hold 30"), { n: "30", unit: "sec" }); assert.deepStrictEqual(timedPlan("max hold"), { n: "", unit: "sec" }); assert.deepStrictEqual(timedPlan("1:30"), { n: "90", unit: "sec" });
  assert.strictEqual(planNumber("8-10 @ 70%"), "10"); assert.strictEqual(planNumber("8 RPE 9"), "8"); assert.strictEqual(planNumber("6, 6, 4"), "6");
  assert.strictEqual(timeAsWeight("25s"), null, "a pair of 25s"); assert.deepStrictEqual(timeAsWeight("45 sec"), { n: "45", unit: "sec" }); assert.deepStrictEqual(timeAsWeight("1:00"), { n: "60", unit: "sec" });
  assert.ok(!("unit" in fns.freshRow({ id: "a", name: "Squat", sets: 3, reps: "5", unit: "lb", weights: ["100"] })));
  const dup = fns.mergeNotes("Knee is sore", { log: [{ id: "x", at: null, text: "Knee is sore" }, { id: "y", at: "2026-10-13T10:00:00.000Z", text: "New" }] });
  assert.deepStrictEqual(dup.log.map((n) => n.text), ["Knee is sore", "New"], "the old single note is not doubled by the other device's copy of it");
  const plan = { id: "p", kind: "sessions", size: 10, startedOn: "2026-10-01" }, day = (d) => ({ inPerson: true, completedAt: "2026-10-" + d + "T18:00:00.000Z", date: "2026-10-" + d });
  assert.strictEqual(planProgress(plan, [day("02"), { ...day("03"), skippedAt: "2026-10-03T10:00:00.000Z" }, { ...day("04"), missed: true }]).used, 1, "a finished-and-skipped record counts as the pill counts it: not at all");
});
test("a planned workout left unfiled does not take a session number from the ones ahead; 'N min M sec' is seconds", () => {
  const plan = { id: "p", kind: "sessions", size: 10, startedOn: "2026-01-01" };
  const mk = (id, date, done) => ({ id, inPerson: true, date, createdAt: "2026-01-01T00:00:00.000Z", completedAt: done ? date + "T18:00:00.000Z" : null });
  const old = mk("a", "2026-01-05", false), today = fns.localIso(new Date()), now = mk("b", today, false), list = [mk("z", "2026-01-02", true), old, now];
  assert.strictEqual(sessionNo(plan, list, now).n, 2, "the overdue one does not count ahead of today's");
  assert.deepStrictEqual(timedPlan("1 min 30 sec"), { n: "90", unit: "sec" });
});

test("composeName: the exercise's name is its two lines together, keeping a comma or dash the name already had", () => {
  assert.strictEqual(composeName("Close-grip decline bench press", "fat bar with band/chains"), "Close-grip decline bench press (fat bar with band/chains)");
  assert.strictEqual(composeName("Bench press", ""), "Bench press");
  assert.strictEqual(composeName("Bench press", "wide grip", "Bench press, wide grip"), "Bench press, wide grip");
  assert.strictEqual(composeName("Bench pres", "wide grip", "Bench press \u2013 wide grip"), "Bench pres \u2013 wide grip");
  assert.strictEqual(composeName("Row", "machine", "Row (cable)"), "Row (machine)");
  const parts = splitName(composeName("Close-grip decline bench press", "fat bar with band/chains"), null);
  assert.deepStrictEqual([parts.title, parts.sub], ["Close-grip decline bench press", "fat bar with band/chains"], "and the split gives the two lines back");
});
