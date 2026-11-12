// The History page and the workouts opened from it: a tap opens the workout, Back comes back to History where it was, and Back again
// to the client's page where it was. The page's scroll is stood in for (window.scrollY / scrollTo); Node has no layout.
import { test, assert } from "./assert.js";
import { load } from "./load.js";
const app = await load();
const { fns, maps } = app;
const $ = (id) => document.getElementById(id);
const tick = (ms = 10) => new Promise((r) => setTimeout(r, ms));
const setup = (clientMode = false) => {
  app.reset(); app.set({ signedIn: true, clientMode, myClientId: clientMode ? "c1" : null, view: { name: "client", id: "c1" }, tab: "workouts" });
  maps.clients.set("c1", { id: "c1", name: "Jane", unit: "lb" });
  maps.trainings.set("p1", { id: "p1", clientId: "c1", title: "Legs", date: "2026-10-01", createdAt: "2026-09-30T10:00:00.000Z", completedAt: "2026-10-01T18:00:00.000Z", skippedAt: null, rows: [] });   // no rows: the stand-in page cannot draw an exercise (finished, so never taken for an empty workout)
  maps.trainings.set("p2", { id: "p2", clientId: "c1", title: "Arms", date: "2026-10-03", createdAt: "2026-09-30T10:00:00.000Z", completedAt: "2026-10-03T18:00:00.000Z", skippedAt: null, rows: [] });
  fns.render();
};
const scroller = () => {                                            // the page's scroll as the app sets and reads it
  const s = { ys: [], put: (y) => { globalThis.scrollY = y; } }, real = globalThis.scrollTo;
  globalThis.scrollTo = (x, y) => { s.ys.push(y); globalThis.scrollY = y; };
  s.done = () => { globalThis.scrollTo = real; globalThis.scrollY = 0; fns.leaveSettings(); };   // off History, so the tests after these draw their own pages
  return s;
};
const histKey = "client/c1/////|history|", clientKey = "client/c1/////||";   // (the view's fields: name, id, program, phase, stage, and since v278 his template folder and slide)
const page = () => { try { return JSON.parse(localStorage.getItem("fiala.trainings.page")); } catch (_) { return null; } };

test("a workout tapped on History opens; Back goes to History where it was, and Back again to the client's page where it was", async () => {
  setup(); const sc = scroller();
  try {
    sc.put(420); fns.openHistoryPage(); await tick();                 // the History card, low on the client's page
    assert.deepStrictEqual([$("vHistory").hidden, $("vClient").hidden], [false, true], "History is up");
    sc.put(640); fns.openFromHistory("p1"); await tick();            // scrolled down History, a workout tapped
    const v = app.get().view;
    assert.deepStrictEqual([v.name, v.id, v.from], ["training", "p1", "history"], "the workout is the page");
    assert.deepStrictEqual([$("vTraining").hidden, $("vHistory").hidden], [false, true], "the workout shows; History is off the screen");
    assert.strictEqual(page(), null, "the device no longer has History as the page that is up (a reload opens the workout)");
    assert.strictEqual(fns.backKey(), histKey, "the swipe back has History underneath");
    assert.strictEqual($("backLabel").textContent, "History");
    assert.strictEqual(sc.ys[sc.ys.length - 1], 0, "the workout opens at its top");
    await fns.goBackNow(); await tick();
    assert.deepStrictEqual([$("vHistory").hidden, $("vTraining").hidden], [false, true], "Back: History again");
    assert.strictEqual(sc.ys[sc.ys.length - 1], 640, "where History was");
    assert.strictEqual(fns.navState().key, histKey);
    assert.deepStrictEqual(page(), { open: "history", from: false }, "a reload now reopens History");
    fns.openFromHistory("p2"); await tick();                         // the next one, straight away
    assert.deepStrictEqual([app.get().view.id, $("vTraining").hidden], ["p2", false], "another workout opens just the same");
    await fns.goBackNow(); await tick();
    assert.strictEqual($("vHistory").hidden, false, "and Back is History again");
    await fns.goBackNow(); await tick();
    assert.deepStrictEqual([$("vHistory").hidden, $("vClient").hidden], [true, false], "Back again: the client's page");
    assert.strictEqual(sc.ys[sc.ys.length - 1], 420, "where it was, at the History card");
    assert.strictEqual(fns.navState().key, clientKey);
  } finally { sc.done(); }
});

test("a workout opened from History and reopened by a reload still goes back to History; one opened from the client's page goes back there", async () => {
  setup(); const sc = scroller();
  try {
    app.set({ view: { name: "training", id: "p1", from: "history" } }); fns.render(); await tick();   // the view the device kept
    assert.strictEqual(fns.backKey(), histKey);
    await fns.goBackNow(); await tick();
    assert.deepStrictEqual([$("vHistory").hidden, app.get().view.name], [false, "client"], "History, over the client's page");
    await fns.goBackNow(); await tick();
    assert.deepStrictEqual([$("vHistory").hidden, $("vClient").hidden], [true, false], "then the client's page");
    app.set({ view: { name: "training", id: "p1" } }); fns.render(); await tick();   // opened from the client's own page
    assert.strictEqual(fns.backKey(), clientKey);
    await fns.goBackNow(); await tick();
    assert.deepStrictEqual([$("vHistory").hidden, $("vClient").hidden, app.get().view.name], [true, false, "client"], "straight to the client's page, as always");
  } finally { sc.done(); }
});

test("deleting a workout opened from History lands back on History; the client sees their History the same way", async () => {
  setup(); const sc = scroller();
  try {
    sc.put(300); fns.openHistoryPage(); sc.put(500); fns.openFromHistory("p1"); await tick();
    fns.deleteTraining("p1"); await tick();
    assert.ok(!maps.trainings.has("p1"), "gone");
    assert.deepStrictEqual([$("vHistory").hidden, $("vTraining").hidden], [false, true], "back on History");
    assert.strictEqual(sc.ys[sc.ys.length - 1], 500);
  } finally { sc.done(); }
  setup(true); const sc2 = scroller();
  try {
    fns.openHistoryPage(); fns.openFromHistory("p2"); await tick();
    assert.deepStrictEqual([app.get().view.name, $("vTraining").hidden, $("backLabel").textContent], ["training", false, "History"], "the client's workout opens");
    await fns.goBackNow(); await tick();
    assert.strictEqual($("vHistory").hidden, false, "Back: their History");
  } finally { sc2.done(); }
});
