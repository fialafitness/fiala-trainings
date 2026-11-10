// The client's "…" on the workout page: Reschedule moves a workout still to do to another day (from today on), and a client's move is queued
// for the server's own rule (client_move_training), as "Do it today" is.
import { test, assert } from "./assert.js";
import { load } from "./load.js";
const app = await load();
const { fns, maps } = app;
const $ = (id) => document.getElementById(id);
const day = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return fns.localIso(d); };   // the app's local day (never UTC: after 4 pm in Los Angeles that is tomorrow)
const setup = (clientMode, extra = {}) => {
  app.reset(); app.set({ signedIn: true, clientMode, myClientId: clientMode ? "c1" : null, tab: "workouts" });
  maps.clients.set("c1", { id: "c1", name: "Jane", unit: "lb" });
  maps.trainings.set("w1", { id: "w1", clientId: "c1", title: "Legs", date: day(1), createdAt: "2026-11-01T10:00:00.000Z", completedAt: null, skippedAt: null, rows: [], ...extra });
  app.set({ view: { name: "training", id: "w1" } }); fns.render();
};

test("the client sees the \"…\" on a workout still to do; not on a finished or skipped one; the coach's own view has his own (with Delete: coach-more.test.js)", () => {
  setup(true);
  assert.strictEqual(fns.canReschedule(maps.trainings.get("w1")), true);
  assert.strictEqual($("tMore").hidden, false, "the \"…\" is in the bar");
  setup(true, { completedAt: "2026-11-02T18:00:00.000Z" });
  assert.strictEqual(fns.canReschedule(maps.trainings.get("w1")), false); assert.strictEqual($("tMore").hidden, true, "finished: no \"…\"");
  setup(true, { skippedAt: "2026-11-02T18:00:00.000Z" });
  assert.strictEqual($("tMore").hidden, true, "skipped: no \"…\"");
  setup(false);
  assert.strictEqual($("tMore").hidden, false, "the coach's own view: his \"…\", Reschedule and Delete workout (his ask, 10 Nov)");
  setup(true);                                                         // the client, whose workout shows the "…": Back to the Workouts page takes it away
  app.set({ view: { name: "client", id: "c1" } }); fns.render();
  assert.strictEqual($("tMore").hidden, true, "only on the workout page");
});

test("Undo on a finished workout brings the \"…\" back at once", () => {
  setup(true, { completedAt: new Date().toISOString() });               // finished earlier (no "Nice work" screen in this run)
  assert.strictEqual($("tMore").hidden, true, "finished: no \"…\"");
  fns.setFinished(false);
  assert.strictEqual($("tMore").hidden, false, "to do again: the \"…\" is back without waiting for another redraw");
});

test("Reschedule moves the workout to the day picked, and a client's move waits for the server's own rule", () => {
  setup(true);
  assert.strictEqual(fns.applyReschedule("w1", day(4)), true);
  assert.strictEqual(maps.trainings.get("w1").date, day(4), "the new day");
  assert.ok(maps.pendingMove.has("w1"), "queued for client_move_training");
  assert.strictEqual(fns.applyReschedule("w1", day(4)), false, "the same day again changes nothing");
  assert.strictEqual(fns.applyReschedule("w1", "next week"), false, "only a real day");
  assert.strictEqual(fns.applyReschedule("w1", day(-1)), false, "never to a day already gone (days left open past midnight)");
  assert.strictEqual(maps.trainings.get("w1").date, day(4));
  assert.strictEqual(fns.applyReschedule("w1", day(0)), true, "today is fine");
});

test("a workout finished or skipped while the days are open is not moved, and the days close on the next redraw", () => {
  setup(true);
  const still = () => fns.canReschedule(maps.trainings.get("w1"));
  fns.openDatePicker({ clientId: "c1", title: "Reschedule", selected: day(1), min: fns.today(), ok: still, onPick: (d) => fns.applyReschedule("w1", d) });
  assert.ok(fns.datePicker(), "open");
  maps.trainings.get("w1").completedAt = "2026-11-08T18:00:00.000Z";     // a sync brings in the coach's finish
  assert.strictEqual(fns.applyReschedule("w1", day(4)), false, "a tap now moves nothing");
  assert.strictEqual(maps.trainings.get("w1").date, day(1), "the day it had");
  assert.ok(!maps.pendingMove.has("w1"), "nothing sent to the server's rule");
  fns.render();
  assert.strictEqual(fns.datePicker(), null, "the redraw closed the days");
  setup(true, { skippedAt: "2026-11-08T18:00:00.000Z" });
  assert.strictEqual(fns.applyReschedule("w1", day(4)), false, "skipped: not moved either");
});

test("the day picker for a reschedule starts at today's month and nothing before today can be picked", () => {
  setup(true);
  fns.openDatePicker({ clientId: "c1", title: "Reschedule", selected: day(-40), min: fns.today(), onPick: () => {} });
  const dp = fns.datePicker();
  assert.strictEqual(dp.months[0], fns.today().slice(0, 7), "the first month is this one");
  assert.strictEqual(dp.month, fns.today().slice(0, 7), "a workout already overdue opens on this month");
  assert.ok(dp.months.length >= 13, "a year ahead to choose from");
  fns.closeDatePicker();
  fns.openDatePicker({ clientId: "c1", title: "Move to", selected: day(0), onPick: () => {} });
  assert.ok(fns.datePicker().months[0] < fns.today().slice(0, 7), "the coach's picker still reaches back");
  fns.closeDatePicker();
});

test("five years ahead or back, the coach's Move to still holds the workout's month and this one, and opens on the workout's", () => {
  setup(false);
  const tm = fns.today().slice(0, 7), y = Number(tm.slice(0, 4)), mm = tm.slice(5, 7);
  for (const years of [5, -5, 4]) {
    const sm = (y + years) + "-" + mm;
    fns.openDatePicker({ clientId: "c1", title: "Move to", selected: sm + "-15", onPick: () => {} });
    const dp = fns.datePicker();
    assert.ok(dp.months.includes(sm) && dp.months.includes(tm), years + " years: both months are there");
    assert.strictEqual(dp.month, sm, years + " years: it opens on the workout's month");
    assert.ok(dp.months.length <= 61, "never more than five years of months");
    fns.closeDatePicker();
  }
});

test("a sync that takes the \"…\" away (the coach finished or deleted the workout) takes its menu with it; one that leaves it, does not", () => {
  setup(true);
  fns.showMenu($("tMore"), fns.moreItems(maps.trainings.get("w1")), { align: "right" });
  assert.strictEqual($("whenBg").hidden, false, "the menu is up");
  fns.render();
  assert.strictEqual($("whenBg").hidden, false, "a sync with nothing new leaves it up");
  maps.trainings.get("w1").completedAt = "2026-11-08T18:00:00.000Z"; fns.render();
  assert.strictEqual($("tMore").hidden, true); assert.strictEqual($("whenBg").hidden, true, "the finish came in: the menu went with the \"…\"");
  setup(true);
  fns.showMenu($("tMore"), fns.moreItems(maps.trainings.get("w1")), { align: "right" });
  maps.trainings.delete("w1"); fns.render();
  assert.strictEqual(app.get().view.name, "client", "deleted: back on the Workouts page"); assert.strictEqual($("whenBg").hidden, true, "and no menu left over it");
});

test("a second Enter on a menu's button replaces the menu: nothing of the first is left waiting to eat the next tap", () => {
  const live = new Set(), add = document.addEventListener, rem = document.removeEventListener;
  document.addEventListener = (type, fn) => { if (type === "pointerdown" || type === "pointerup") live.add(fn); };
  document.removeEventListener = (type, fn) => { live.delete(fn); };
  try {
    setup(true);
    fns.showMenu($("tMore"), fns.moreItems(maps.trainings.get("w1")), { align: "right" }); const once = live.size;
    fns.showMenu($("tMore"), fns.moreItems(maps.trainings.get("w1")), { align: "right" });
    assert.strictEqual(live.size, once, "one menu's worth of listeners, not two");
    maps.trainings.get("w1").skippedAt = "2026-11-08T18:00:00.000Z"; fns.render();
    assert.strictEqual(live.size, 0, "and closing it removes them all");
  } finally { document.addEventListener = add; document.removeEventListener = rem; }
});
