// His ask, 12 Nov: "when I am building a workout ... let's say I have 5 exercises and I delete 3rd one make sure the exercises renumber
// themselves .. if 3rd one deleted the 4th one becomes 3rd etc". The numbers after the deleted exercise close up, each keeping its letters
// as typed; the superset it left closes up its letters, and one left alone loses its letter; a warm-up stays W; a label of the coach's own
// words stays as typed; the per-card state follows each exercise to its number, and the deleted one's goes with it.
import fs from "node:fs";
import { test, assert } from "./assert.js";
import { load } from "./load.js";
const app = await load();
const { fns } = app;
const src = fs.readFileSync(new URL("../app/main.js", import.meta.url), "utf8");
const row = (label, name) => ({ id: "r-" + label + "-" + name, label, name, sets: 3, reps: "10", rest: "", tempo: "", weights: [], repsDone: [], setsDone: 0, done: false, note: "" });
const workout = (...rows) => ({ id: "w", clientId: "c1", title: "Legs", date: "2026-11-20", createdAt: "2026-11-01T10:00:00.000Z", completedAt: null, skippedAt: null, rows });
const del = (t, name) => { const r = t.rows.find((x) => x.name === name); t.rows = t.rows.filter((x) => x !== r); fns.renumber(t, r); return t.rows.map((x) => x.label + " " + x.name); };

test("5 exercises, the 3rd deleted: the 4th becomes the 3rd and the 5th the 4th, in their order (his ask); the first deleted moves every number up; the last deleted changes nothing else", () => {
  const t = workout(row("1", "Squat"), row("2", "Lunge"), row("3", "Leg press"), row("4", "Curl"), row("5", "Calf"));
  assert.deepStrictEqual(del(t, "Leg press"), ["1 Squat", "2 Lunge", "3 Curl", "4 Calf"]);
  assert.deepStrictEqual(del(t, "Squat"), ["1 Lunge", "2 Curl", "3 Calf"]);
  assert.deepStrictEqual(del(t, "Calf"), ["1 Lunge", "2 Curl"]);
});

test("supersets: the numbers after the deleted one close up with their letters as typed; the superset it left closes up its letters, and one left alone loses its letter", () => {
  assert.deepStrictEqual(del(workout(row("1", "A"), row("2a", "B"), row("2b", "C"), row("3", "D"), row("4a", "E"), row("4b", "F")), "A"), ["1a B", "1b C", "2 D", "3a E", "3b F"]);
  assert.deepStrictEqual(del(workout(row("1", "A"), row("2a", "B"), row("2b", "C"), row("3", "D")), "B"), ["1 A", "2 C", "3 D"], "2b alone is 2");
  assert.deepStrictEqual(del(workout(row("1", "A"), row("2a", "B"), row("2b", "C"), row("2c", "D"), row("3", "E")), "C"), ["1 A", "2a B", "2b D", "3 E"], "2a 2c become 2a 2b");
  assert.deepStrictEqual(del(workout(row("1", "A"), row("2A", "B"), row("2B", "C"), row("3", "D")), "A"), ["1A B", "1B C", "2 D"], "letters kept as typed");
});

test("a warm-up stays W (its letters closed up when one of its own goes); a label of the coach's own words stays as typed", () => {
  assert.deepStrictEqual(del(workout(row("W", "Bike"), row("1", "A"), row("2", "B"), row("3", "C")), "A"), ["W Bike", "1 B", "2 C"]);
  assert.deepStrictEqual(del(workout(row("Wa", "Bike"), row("Wb", "Row"), row("1", "A")), "Bike"), ["W Row", "1 A"]);
  assert.deepStrictEqual(del(workout(row("1", "A"), row("2", "B"), row("3", "C"), row("Finisher", "D")), "B"), ["1 A", "2 C", "Finisher D"]);
});

test("the per-card state follows each exercise to its number (a card opened, the set looked at); the deleted one's goes with it; another workout's is untouched", () => {
  const { openBlocks, setSel } = fns.cardSets();
  try {
    openBlocks.clear(); setSel.clear();
    openBlocks.add("w/3"); openBlocks.add("w/4"); setSel.set("w/5", 2); setSel.set("x/4", 1);
    del(workout(row("1", "A"), row("2", "B"), row("3", "C"), row("4", "D"), row("5", "E")), "C");
    assert.deepStrictEqual([[...openBlocks].sort(), [...setSel].sort()], [["w/3"], [["w/4", 2], ["x/4", 1]]], "4's open card is 3's now (3's own gone), 5's set is 4's");
    openBlocks.clear(); setSel.clear();
    openBlocks.add("w/3"); setSel.set("w/3", 1);                        // the deleted card was open, on its 2nd set; the next one was not
    del(workout(row("1", "A"), row("2", "B"), row("3", "C"), row("4", "D")), "C");
    assert.deepStrictEqual([[...openBlocks], [...setSel]], [[], []], "the card that takes number 3 does not inherit the deleted card's open state or set");
  } finally { openBlocks.clear(); setSel.clear(); }
});

test("Delete exercise renumbers, then saves and redraws (a template's change still waits for Save template)", () => {
  assert.ok(src.includes("t.rows = t.rows.filter((x) => x.id !== r.id); renumber(t, r); save(); S.renderedTraining = null; render();"));
});
