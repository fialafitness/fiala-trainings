// The coach's "…" on an exercise (his ask, 9 Nov): its alternatives, its instructions, and at the bottom, red, Delete exercise, which
// used to hide in the Alternate exercise panel. The icons are Apple's own shapes, traced from its Files and Reminders menus: a swap made
// of its arrows, its pencil, its trash, all filled. The alternatives' row says Add or Edit as the instructions' does (v291: the swap itself
// is the pop-up on the exercise's name, his pick of 13 Nov; this row opens the sheet that adds and removes them).
import { test, assert } from "./assert.js";
import { load } from "./load.js";
const { fns } = await load();

test("the exercise menu: its alternatives, instructions, and Delete exercise last and red, each with its own icon", () => {
  const MI = fns.menuIcons(), calls = [];
  const on = { swap: () => calls.push("swap"), note: () => calls.push("note"), remove: () => calls.push("remove") };
  const items = fns.exerciseMenu({ note: "" }, on);
  assert.deepStrictEqual(items.map((i) => i.label), ["Add alternatives", "Add instructions", "Delete exercise"]);
  assert.deepStrictEqual(items.map((i) => !!i.danger), [false, false, true], "only Delete is red");
  assert.deepStrictEqual(items.map((i) => i.icon), [MI.swap, MI.pencil, MI.trash]);
  items.forEach((i) => i.onPick());
  assert.deepStrictEqual(calls, ["swap", "note", "remove"], "each row does its own thing");
  assert.strictEqual(fns.exerciseMenu({ note: "Keep the elbows in" }, on)[1].label, "Edit instructions", "an exercise with instructions: Edit");
  assert.strictEqual(fns.exerciseMenu({ name: "Leg press", alts: ["Hack squat"] }, on)[0].label, "Edit alternatives", "an exercise with alternatives: Edit");
  assert.strictEqual(fns.exerciseMenu({ name: "Leg press", alts: ["Leg press", ""] }, on)[0].label, "Add alternatives", "its own name or a blank is no alternative: Add");
  let got = null; fns.exerciseMenu({ name: "Leg press", alts: [] }, { ...on, swap: (e) => { got = e; } })[0].onPick({ detail: 0 });
  assert.deepStrictEqual(got, { detail: 0 }, "the pick's own event reaches the row (a keyboard's pick, detail 0, puts the sheet's focus on its first button)");
});

test("the icons are filled shapes, sized like Apple's against the text", () => {
  const MI = fns.menuIcons();
  for (const k of ["swap", "pencil", "trash"]) {
    assert.ok(/fill="currentColor"/.test(MI[k]) && !/stroke-width/.test(MI[k]), k + ": filled, no strokes");
    assert.ok(/viewBox="[-\d.]+ [-\d.]+ ([\d.]+) \1"/.test(MI[k]), k + ": a square box, the glyph centred in it");
  }
});

test("v313: Sets, only when the row passes it (an exercise in a superset, the coach's own look): before Delete, its choice in effect under its name, and a list of its own: Default (the superset's number), a line, then fewer; each pick says which", () => {
  const MI = fns.menuIcons(), got = [];
  const on = { swap() {}, note() {}, remove() {}, sets: { most: 4, own: 3, pick: (k, e, def) => got.push([k, def]) } };
  const items = fns.exerciseMenu({ note: "" }, on), s = items[2];
  assert.deepStrictEqual(items.map((i) => i.label), ["Add alternatives", "Add instructions", "Sets", "Delete exercise"]);
  assert.deepStrictEqual([s.sub, s.icon === MI.sets, !!s.danger], ["3 sets", true, false]);
  assert.deepStrictEqual(s.kids.map((k) => [k.label, k.checked, !!k.sep]), [["Default (4 sets)", false, false], ["3 sets", true, true], ["2 sets", false, false], ["1 set", false, false]]);
  s.kids.forEach((k) => k.onPick({}));
  assert.deepStrictEqual(got, [[4, true], [3, false], [2, false], [1, false]]);
  const def = fns.exerciseMenu({ note: "" }, { ...on, sets: { most: 2, own: 2, pick() {} } })[2];
  assert.deepStrictEqual([def.sub, def.kids.map((k) => k.label + (k.checked ? " ✓" : ""))], ["Default (2 sets)", ["Default (2 sets) ✓", "1 set"]]);
  assert.ok(/fill="currentColor"/.test(MI.sets) && !/stroke-width/.test(MI.sets) && /viewBox="0 0 24 24"/.test(MI.sets), "a filled glyph in a square box, as the others");
});
