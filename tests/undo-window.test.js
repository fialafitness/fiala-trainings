// The Undo beside "✓ Finished" or "Skipped" on a workout's page (his rule, 11 Nov: "clients don't have the option to press undo in history
// for workouts older than 24 hours"): the client's view keeps it for 24 hours from the finish or the skip, never on a workout the app filed
// as missed after a week; the coach's own view keeps it always; the coach looking as the client sees the client's page. (A tap that comes
// after the 24 hours, the button still up: row-swipe-probe.mjs, whose buttons keep their listeners.)
import { test, assert } from "./assert.js";
import { load } from "./load.js";
const app = await load();
const { fns, maps } = app;
const $ = (id) => document.getElementById(id);
const HOUR = 3600e3, ago = (h) => new Date(Date.now() - h * HOUR).toISOString();
const day = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return fns.localIso(d); };   // the app's local day (never UTC)
function open(clientMode, extra = {}) {
  app.reset(); app.set({ signedIn: true, clientMode, myClientId: clientMode ? "c1" : null, tab: "workouts" });
  maps.clients.set("c1", { id: "c1", name: "Jane", unit: "lb" });
  maps.trainings.set("w1", { id: "w1", clientId: "c1", title: "Legs", date: day(-1), createdAt: "2026-11-01T10:00:00.000Z", completedAt: null, skippedAt: null, rows: [], ...extra });
  app.set({ view: { name: "training", id: "w1" } }); fns.render();
  return maps.trainings.get("w1");
}
const page = () => ({ finished: !$("finishedLine").hidden, skipped: !$("skippedLine").hidden, undoFinish: !$("unfinishBtn").hidden, undoSkip: !$("unskipBtn").hidden });
const FIN = (undo) => ({ finished: true, skipped: false, undoFinish: undo, undoSkip: undo });   // (both Undo buttons go together; only one line is up)
const SKIP = (undo) => ({ finished: false, skipped: true, undoFinish: undo, undoSkip: undo });

test("the client's view: Undo beside ✓ Finished for 24 hours after the finish, then the line alone", () => {
  open(true, { completedAt: ago(1) }); assert.deepStrictEqual(page(), FIN(true), "finished an hour ago: Undo");
  open(true, { completedAt: ago(23.9) }); assert.deepStrictEqual(page(), FIN(true), "a few minutes left: Undo");
  open(true, { completedAt: ago(24.1) }); assert.deepStrictEqual(page(), FIN(false), "past 24 hours: the line stays, the Undo is gone");
  assert.ok($("finishedText").textContent.startsWith("✓ Finished · "), "the line still says when");
  open(true, { completedAt: ago(24 * 9) }); assert.deepStrictEqual(page(), FIN(false), "a week and more: no Undo");
  open(true, { completedAt: new Date(Date.now() + 2 * HOUR).toISOString() }); assert.deepStrictEqual(page(), FIN(true), "a phone clock set behind: a finish \"from the future\" still has its Undo");
  open(true, { completedAt: "not a time" }); assert.deepStrictEqual(page(), FIN(false), "a finish with no time to count from: no Undo for the client");
  open(true, { completedAt: ago(1), skippedAt: ago(30) }); assert.deepStrictEqual(page(), FIN(true), "finished, an old skip still on it (two phones at once): its line is Finished, counted from the finish");
  open(true, { completedAt: ago(30), skippedAt: ago(1) }); assert.deepStrictEqual(page(), FIN(false), "and the other way round: still from the finish, never from the skip");
});

test("the client's view: Undo beside Skipped for 24 hours after the skip; the coach logged a past session: no Undo for the client", () => {
  open(true, { skippedAt: ago(2), skipReason: "Sick" }); assert.deepStrictEqual(page(), SKIP(true), "skipped two hours ago: Undo");
  open(true, { skippedAt: ago(25), skipReason: "Sick" }); assert.deepStrictEqual(page(), SKIP(false), "a day and an hour: no Undo");
  assert.strictEqual($("skippedText").textContent, "Skipped · Sick", "the line keeps its word and reason");
  open(true, { date: day(-3), completedAt: ago(72) }); assert.deepStrictEqual(page(), FIN(false), "a session the coach logged on its day three days back: the client cannot take it out");
});

test("a workout the app filed as missed after a week: no Undo for the client, even the hour after it was filed; the coach keeps his", () => {
  const missed = { date: day(-8), skippedAt: ago(1), missed: true };
  open(true, missed); assert.deepStrictEqual(page(), SKIP(false)); assert.strictEqual($("skippedText").textContent, "Missed");
  assert.strictEqual(fns.undoLeft(maps.trainings.get("w1")), 0);
  open(false, missed); assert.deepStrictEqual(page(), SKIP(true), "the coach's own view: Undo");
  open(true, { date: day(-8), skippedAt: ago(1), missed: false }); assert.deepStrictEqual(page(), SKIP(true), "one the client skipped (missed: false, a person decided): its 24 hours");
});

test("the coach's own view: Undo always, however long ago", () => {
  open(false, { completedAt: ago(24 * 30) }); assert.deepStrictEqual(page(), FIN(true));
  open(false, { skippedAt: ago(24 * 30) }); assert.deepStrictEqual(page(), SKIP(true));
  assert.strictEqual(fns.undoLeft(maps.trainings.get("w1")), Infinity);
});

test("the coach looking as the client sees the client's page: no Undo after 24 hours; back on Coach it is there", () => {
  try {
    open(false, { completedAt: ago(25) }); fns.setPreview(true); app.set({ renderedTraining: null }); fns.render();
    assert.strictEqual(document.body.classList.contains("client"), true, "the client's look");
    assert.deepStrictEqual(page(), FIN(false), "as the client: no Undo");
    fns.setPreview(false); app.set({ renderedTraining: null }); fns.render(); assert.deepStrictEqual(page(), FIN(true), "as the coach: Undo");
    open(false, { completedAt: ago(1) }); fns.setPreview(true); app.set({ renderedTraining: null }); fns.render(); assert.deepStrictEqual(page(), FIN(true), "as the client, within the day: Undo");
  } finally { fns.setPreview(false); }
});

test("the page left open: the Undo goes the moment its 24 hours are over (and a new paint keeps one such wait, never two)", () => {
  const real = { st: globalThis.setTimeout, ct: globalThis.clearTimeout, now: Date.now };
  let T = real.now(); const q = [];
  globalThis.setTimeout = (fn, ms) => { q.push({ fn, ms: ms || 0, off: false }); return q.length; };
  globalThis.clearTimeout = (id) => { if (q[id - 1]) q[id - 1].off = true; };
  Date.now = () => T;
  try {
    const t = open(true, { completedAt: new Date(T - 23.5 * HOUR).toISOString() });
    const waits = () => q.filter((x) => !x.off && x.ms > 1000);       // the Undo's (the page's own frames wait 0)
    assert.deepStrictEqual(page(), FIN(true));
    assert.strictEqual(waits().length, 1, "one wait"); const w = waits()[0];
    assert.ok(w.ms >= 0.5 * HOUR && w.ms <= 0.5 * HOUR + 1000, "set for the moment the day is over, a beat after: " + w.ms);
    fns.paintUndo(t); assert.strictEqual(waits().length, 1, "painted again: the old wait is let go");
    T += 0.5 * HOUR - 1000; assert.ok(fns.undoLeft(t) > 0, "a second before: still there");
    T += 1000 + 50; waits()[0].fn(); assert.deepStrictEqual(page(), FIN(false), "the moment comes: the Undo is gone, the line stays");
    assert.strictEqual(waits().length, 0, "and nothing more to wait for");
    const fresh = () => q.filter((x, i) => i >= n0 && !x.off && x.ms > 1000).length;
    let n0 = q.length; open(false, { completedAt: new Date(T - 23.5 * HOUR).toISOString() }); assert.strictEqual(fresh(), 0, "the coach's own view: no wait (his Undo stays)");
    n0 = q.length; open(true, {}); assert.strictEqual(fresh(), 0, "a workout still to do: no wait");
    n0 = q.length; open(true, { completedAt: new Date(T + 30 * 24 * HOUR).toISOString() });   // a finish stamped a month ahead of this clock (a phone's date set back)
    const far = q.slice(n0).filter((x) => !x.off && x.ms > 1000);
    assert.ok(far.length === 1 && far[0].ms <= 2147483647, "its wait is never longer than a timer holds (24.8 days: longer wraps to now, and the Undo looped every few ms, a review's catch): " + (far[0] && far[0].ms));
    far[0].fn(); assert.strictEqual(q.slice(n0).filter((x) => !x.off && x.ms > 1000).length, 1, "and when it comes, one wait again for the rest, not a loop");
  } finally { globalThis.setTimeout = real.st; globalThis.clearTimeout = real.ct; Date.now = real.now; }
});

test("the question before a skip says how long Undo lasts: the client's 24 hours; the coach's view, no time", () => {
  open(true); fns.openSkip("w1"); assert.strictEqual($("skFor").hidden, false, "the client: \"Undo is on the workout for 24 hours.\""); fns.closeSkip();
  open(false); fns.openSkip("w1"); assert.strictEqual($("skFor").hidden, true, "the coach: \"Undo is on the workout.\""); fns.closeSkip();
  try { open(false); fns.setPreview(true); app.set({ renderedTraining: null }); fns.render(); fns.openSkip("w1"); assert.strictEqual($("skFor").hidden, false, "the coach looking as the client: the client's words"); fns.closeSkip(); }
  finally { fns.setPreview(false); }
  const src = (async () => (await import("node:fs")).readFileSync(new URL("../index.html", import.meta.url), "utf8"))();
  return src.then((html) => assert.ok(html.includes('Undo is on the workout<span id="skFor" hidden> for 24 hours</span>.</p>'), "the sentence and its words for the client"));
});
