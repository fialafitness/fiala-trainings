// The coach's exercise number is plain text on the name's first line, except while he is adding an exercise: from "+ Add exercise" until he
// leaves it, that one exercise's number is his old square (his pick, 9 Nov). Which card carries the mark, and what ends it: focus going on
// to another exercise or anywhere else, letting go of the field with nothing after it, a redraw that leaves nothing focused (Complete set),
// leaving the page; a redraw that brings focus back into that exercise (a number picked, + Add exercise focusing its name) does not.
import { test, assert, tick } from "./assert.js";
import { load } from "./load.js";
import { document } from "./env.js";
const app = await load();
const { fns, maps } = app;
const setup = (clientMode) => {
  app.reset(); app.set({ signedIn: true, clientMode, myClientId: clientMode ? "c1" : null, tab: "workouts" });
  maps.clients.set("c1", { id: "c1", name: "Jane", unit: "lb" });
  const rows = [{ id: "r1", label: "1", name: "Bench press", sets: 3, reps: "10", tempo: "", rest: "", weights: [], repsDone: [], setsDone: 0, note: "" },
    { id: "r2", label: "2", name: "", sets: 4, reps: "", tempo: "", rest: "", weights: [], repsDone: [], setsDone: 0, note: "" }];
  maps.trainings.set("w1", { id: "w1", clientId: "c1", title: "Legs", date: fns.today(), createdAt: "2026-11-01T10:00:00.000Z", completedAt: null, skippedAt: null, rows });
  app.set({ view: { name: "training", id: "w1" } });
  fns.setAdding(null);
  return maps.trainings.get("w1");
};
const inRow = (id) => { const row = { dataset: { id } }; return { closest: (s) => (s === ".row" ? row : null) }; };
const outside = { closest: () => null };
const settle = () => tick(5);   // the leave is decided a turn later, once focus has landed

test("the exercise he is adding carries the mark on its card, the others do not, and never in the client's view", () => {
  const t = setup(false);
  assert.strictEqual(fns.addingMark(t.rows[1], false), false, "nothing being added: plain numbers");
  fns.setAdding("r2");
  assert.strictEqual(fns.addingRow(), "r2");
  assert.strictEqual(fns.addingMark(t.rows[1], false), true, "the new exercise, in his view: his square");
  assert.strictEqual(fns.addingMark(t.rows[0], false), false, "an exercise he already had: a plain number");
  assert.strictEqual(fns.addingMark(t.rows[1], true), false, "the client's view (and his preview of it): always a plain number");
  fns.setAdding(null);
  assert.strictEqual(fns.addingMark(t.rows[1], false), false, "done adding: plain again");
});

test("focus going on to a field of the same exercise keeps it; to another exercise or anywhere else, he is done adding it", () => {
  setup(false); fns.setAdding("r2");
  fns.addingFocusIn({ target: inRow("r2") });
  assert.strictEqual(fns.addingRow(), "r2", "its reps, its rest, its number: still adding it");
  fns.addingFocusIn({ target: inRow("r1") });
  assert.strictEqual(fns.addingRow(), null, "another exercise's field: done");
  fns.setAdding("r2"); fns.addingFocusIn({ target: outside });
  assert.strictEqual(fns.addingRow(), null, "a field outside the exercises: done");
});

test("letting go of the field with nothing after it (Done, Enter, a click on nothing) ends it; focus landing on a field leaves it to focusin", async () => {
  setup(false);
  const before = document.activeElement;
  try {
    document.activeElement = null;
    fns.setAdding("r2"); fns.addingFocusOut({ target: inRow("r2") }); await settle();
    assert.strictEqual(fns.addingRow(), null, "the field let go, nothing focused after it: done adding");
    document.activeElement = inRow("r2");
    fns.setAdding("r2"); fns.addingFocusOut({ target: inRow("r2") }); await settle();
    assert.strictEqual(fns.addingRow(), "r2", "focus came back into the exercise (its redrawn card, or its next field): still adding it");
  } finally { document.activeElement = before; fns.setAdding(null); }
});

test("after the cards are redrawn he is still adding only if focus is back in that exercise: Complete set or a sync with nothing focused ends it", async () => {
  setup(false);
  const before = document.activeElement;
  try {
    document.activeElement = inRow("r2");
    fns.setAdding("r2"); fns.addingAfterRedraw(); await settle();
    assert.strictEqual(fns.addingRow(), "r2", "a number picked, or + Add exercise focusing its name: the redrawn card is still the one he is adding");
    document.activeElement = null;
    fns.addingAfterRedraw(); await settle();
    assert.strictEqual(fns.addingRow(), null, "Complete set redrew the cards and nothing is focused: done adding");
    document.activeElement = inRow("r1");
    fns.setAdding("r2"); fns.addingAfterRedraw(); await settle();
    assert.strictEqual(fns.addingRow(), null, "focus is in another exercise: done adding");
  } finally { document.activeElement = before; fns.setAdding(null); }
});

test("leaving the workout's page ends it, so coming back shows plain numbers", async () => {
  setup(false); fns.setAdding("r2");
  await fns.goBackNow(); await tick();
  assert.notStrictEqual(app.get ? app.get().view.name : "client", "training", "Back left the workout");
  assert.strictEqual(fns.addingRow(), null);
});
