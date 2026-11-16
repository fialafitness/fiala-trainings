// The owner's ask, 15 Nov 2026: "when client or me switch the weight unit every workout past and future converts to that unit ... so if client goes
// to Europe ... they don't have to think of converting weights but then they come back and they can see what they lifted in unit they know".
// Their picks: one switch for the client and the coach (the coach's screens follow the client's unit), one decimal. A weight is never rewritten: it keeps
// the unit it was logged in, and every screen shows it in the client's unit (v301). The pages play in their own process (units-probe.mjs).
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test, assert } from "./assert.js";
import { load } from "./load.js";
const here = path.dirname(fileURLToPath(import.meta.url));
const r = JSON.parse(execFileSync(process.execPath, [path.join(here, "units-probe.mjs")], { encoding: "utf8", timeout: 90000 }).trim().split("\n").pop());
const app = await load(); const { fns, maps } = app;

test("in Europe (Weights in kg): last time's 135 lb reads 61.2 kg in the grey number, Last time and Best, and VoiceOver says the unit", () => {
  assert.deepStrictEqual(r.fresh, { value: "", placeholder: "61.2", label: "Weight in kg", lifts: { last: "61.2 kg × 5", best: "61.2 kg × 5" }, chip: { val: "61.2", unit: "kg" } });
  assert.deepStrictEqual(r.coach, { placeholder: "61.2", lifts: { last: "61.2 kg × 5", best: "61.2 kg × 5" } }, "the coach's screens follow the same switch (the owner's pick)");
});

test("the bubble under Last time and Best says how a set in the other unit was logged, and says nothing more when it was not", () => {
  const row = (k, v) => [["wk", k], ["", v], ["wd", r.bubble[0][2][1]], ["wo", "Logged as 135 lb × 5"]];
  assert.deepStrictEqual(r.bubble, [row("Personal best", "61.2 kg × 5"), row("Last time", "61.2 kg × 5")]);
  assert.deepStrictEqual(r.home.bubble.map((x) => x[3]), [["wo", "Logged as 60 kg × 5"], ["wo", "Logged as 60 kg × 5"]], "home again: the Europe session says it was 60 kg");
  assert.ok(r.sameUnit.bubble.every((x) => x.length === 3), "never switched: no extra line");
});

test("home again (Weights in lb): the 60 kg lifted in Europe reads 132.3 lb; a client who never switched sees what they always saw", () => {
  assert.deepStrictEqual(r.home.lifts, { last: "132.3 lb × 5", best: "132.3 lb × 5" }); assert.strictEqual(r.home.placeholder, "132.3"); assert.deepStrictEqual(r.home.chip, { val: "132.3", unit: "lb" }, "\"lb\" for one or many, as Apple writes it");
  assert.deepStrictEqual(r.sameUnit.lifts, { last: "135 lb × 5", best: "135 lb × 5" }); assert.strictEqual(r.sameUnit.placeholder, "135");
});

test("a number typed in kg: a fresh exercise takes the client's unit; one begun in lb keeps lb and stores 60 kg as 132.3, which reads 60 again", () => {
  assert.deepStrictEqual(r.typedFresh, { weights: ["60", "", ""], unit: "kg" });
  assert.deepStrictEqual(r.begun, { value: "", placeholder: "61.2", chip: { val: "61.2", unit: "kg" } }, "the set before (135 lb) is the grey number, in kg, and the word after it says kg, not the exercise's lb");
  assert.deepStrictEqual(r.begunTyped, { weights: ["135", "132.3", ""], unit: "lb" }); assert.strictEqual(r.begunShown, "60");
});

test("the number shown typed back keeps what was there: 135 lb shown as 61.2 kg never becomes 134.9", () => {
  assert.deepStrictEqual(r.retyped, ["135", "132.3", ""]); assert.deepStrictEqual(r.changed, ["135", "134.5", ""], "61 kg is 134.5 lb");
  assert.deepStrictEqual(r.changedBack, ["135", "132.3", ""], "back to the number shown: what was there when the typing began");
  assert.deepStrictEqual(r.finishedRetyped, ["135", "135", "135"]);
  assert.strictEqual(r.typedAhead, "61.2"); assert.deepStrictEqual(r.typedAheadKept, ["135", "135", ""], "today's box too: 61.2 typed back over 135 lb keeps 135, never 134.9");
});

test("Complete set with the grey number left: last time's weight, kept in the client's unit so it reads 61.2 kg now and 135 lb at home", () => {
  assert.deepStrictEqual(r.untouched, { weights: ["61.23", "", ""], unit: "kg", done: 1 });
});

test("a finished workout reads in the client's unit, set by set; a typo fixed there is kept in the exercise's own unit, the copied sets following", () => {
  assert.deepStrictEqual(r.finished, [1, 2, 3].map((n) => ({ value: "61.2", label: "Weight in kg, set " + n, unit: "kg" })));
  assert.deepStrictEqual(r.finishedTyped, { weights: ["132.3", "132.3", "132.3"], unit: "lb" });
  assert.deepStrictEqual(r.bwRow, { weights: ["22", "22", "22"], unit: "lb" }, "a Bodyweight exercise logged in lb: 10 kg kept as 22 lb, never 10 lb");
});

test("Best at a weight shown in the other unit: as many reps is not a best, more reps is", () => {
  assert.deepStrictEqual(r.sameWeight, { best: "61.2 kg × 5", gold: false }); assert.deepStrictEqual(r.moreReps, { best: "61.2 kg × 8", gold: true });
  assert.deepStrictEqual(r.lighterInLb, { best: "61.2 kg × 5", gold: false }, "today's 130 lb, in an exercise begun in lb, is 59 kg: lighter, not a best");
});

test("the Progress tab's Best reads in the client's unit, sets logged in either unit ranked together", () => {
  app.reset(); const day = (n) => { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + n); return fns.localIso(d); };
  const row = (w, rp, unit) => ({ id: "r" + w, label: "1", name: "Barbell bench press", sets: 1, reps: "5", weights: [w], repsDone: [rp], setsDone: 1, done: true, unit });
  const c = { id: "c1", name: "Jane", unit: "kg" }; maps.clients.set("c1", c);
  maps.trainings.set("p1", { id: "p1", clientId: "c1", title: "LA", date: day(-20), createdAt: "2026-11-01T10:00:00.000Z", completedAt: day(-20) + "T18:00:00.000Z", rows: [row("135", "5", "lb")] });
  maps.trainings.set("p2", { id: "p2", clientId: "c1", title: "Europe", date: day(-3), createdAt: "2026-11-02T10:00:00.000Z", completedAt: day(-3) + "T18:00:00.000Z", rows: [row("60", "5", "kg")] });
  const e = [...fns.loggedExercises(c).values()][0]; assert.strictEqual(fns.fmtSetFor(c, e), "61.2 kg × 5", "135 lb beats 60 kg");
  c.unit = "lb"; assert.strictEqual(fns.fmtSetFor(c, [...fns.loggedExercises(c).values()][0]), "135 lb × 5", "and reads 135 lb at home");
  maps.trainings.get("p2").rows[0].repsDone = ["8"]; maps.trainings.get("p2").rows[0].weights = ["61.2"];
  assert.strictEqual(fns.fmtSetFor(c, [...fns.loggedExercises(c).values()][0]), "134.9 lb × 8", "61.2 kg is 135 lb's weight: more reps wins");
  maps.trainings.get("p2").rows[0].repsDone = ["5"]; assert.strictEqual(fns.fmtSetFor(c, [...fns.loggedExercises(c).values()][0]), "135 lb × 5", "the same weight for as many: the heavier is the Best, never 134.9");
  maps.trainings.delete("p1"); maps.trainings.delete("p2"); maps.clients.delete("c1");
});

test("the bubble's \"Logged as\" line sits under the numbers and the day, grey, one line (the approved picture)", () => {
  const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
  assert.ok(html.includes("  #whenPop .wo { grid-column: 2 / -1; margin-top: -5px; font-size: 0.8125rem; color: var(--text-secondary); white-space: nowrap; }"), "the .wo rule");
});

test("the grey number typed is the same as leaving it; a comma keypad's 61,2 is the 61.2 shown", () => {
  assert.deepStrictEqual(r.greyTyped, ["135", "135", ""], "the set before, 135 lb, as it is: never 134.9");
  assert.deepStrictEqual(r.greyTypedFresh, { weights: ["61.23", "", ""], unit: "kg" }, "last time's 135 lb kept as Complete set keeps it");
  assert.deepStrictEqual(r.commaKept, ["135", "135", ""]);
});

test("words keep the unit they were logged or typed in; a band's number is not a weight", () => {
  assert.deepStrictEqual(r.wordsTyped, ["135", "2x10 kg", ""], "2x10 typed in kg into a pound exercise");
  assert.strictEqual(r.wordsGrey, "2x20 lb"); assert.deepStrictEqual(r.wordsCopied, { weights: ["2x20 lb", "", ""], unit: "kg" }, "last time's 2x20 in lb copied into a kilo exercise says so");
  assert.deepStrictEqual(r.band, ["Band 3", "Band 3", "Band 3"], "never Band 3 lb");
  assert.deepStrictEqual(r.bwPlusCopied, { weights: ["BW+10 lb", "", ""], unit: "kg" }, "BW+10 copied into a kilo exercise says lb, and the exercise has its unit");
});

test("of two sets the same within 0.06 kg, the heavier is the Best: 135 lb, not the 61.2 kg (134.9 lb) lifted after it", () => {
  assert.deepStrictEqual(r.tie, { last: "134.9 lb × 5", best: "135 lb × 5" });
});
