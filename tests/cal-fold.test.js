// His ask, 10 Nov: "When I have a calendar view and go to month view, when I leave the page it stays in month view … make it collapse
// back to week every time I leave the page." The month folds back into the week as the client's page is left, by any way out (a workout,
// Back to Clients, another tab, the client card, History; in the coach's view and the client's), and a reload opens on the week. It folds
// before the page's picture for the swipe back is taken and before its place is kept, so the swipe back and Back land on the week with
// the list where it was; the app's own reload for a new version folds it first too. While the page stays up (a sync's redraw, a question,
// another month) the month stays.
// The page runs in its own processes (cal-fold-probe.mjs; cal-fold-reload-probe.mjs for the reloads), whose page keeps its listeners and
// its place on a scrolled window: the month is 220 taller than the week there.
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test, assert } from "./assert.js";
const here = path.dirname(fileURLToPath(import.meta.url));
const run = (file, args = [], input) => JSON.parse(execFileSync(process.execPath, [path.join(here, file), ...args], { encoding: "utf8", timeout: 60000, input }).trim().split("\n").pop());
const r = run("cal-fold-probe.mjs");
const WEEK = { open: false, month: false, week: true, head: true, toggle: "Month", arrowUp: false };   // the strip, the month's name above it, "Month ⌄"
const MONTH = { open: true, month: true, week: false, head: false, toggle: "Week", arrowUp: true };    // the month, its own title, "Week ⌃"
const look = (s) => ({ open: s.open, month: s.month, week: s.week, head: s.head, toggle: s.toggle, arrowUp: s.arrowUp });
const PIC = (y) => [{ month: false, week: true, head: true, toggle: "Month", arrowUp: false, y }];   // the swipe back's picture: the week's whole row, and where the window was

test("a workout opened from the month at the top of the page (the usual way): the swipe back's picture is the week, and Back lands on the week", () => {
  assert.strictEqual(r.top.found, true, "today's day in the month");
  assert.deepStrictEqual({ ...look(r.top.before), y: r.top.before.y }, { ...MONTH, y: 0 });
  assert.strictEqual(r.top.left.view, "training", "the tap opened the workout");
  assert.deepStrictEqual(look(r.top.left), WEEK, "folded as it was left");
  assert.deepStrictEqual(r.top.pic, PIC(0), "the picture was taken after the fold");
  assert.deepStrictEqual({ view: r.top.back.view, ...look(r.top.back), y: r.top.back.y }, { view: "client", ...WEEK, y: 0 });
});

test("the client card opened over the month at the top: the week in its picture, and Back lands on the week (not the month)", () => {
  assert.deepStrictEqual(look(r.topCard.left), WEEK);
  assert.deepStrictEqual(r.topCard.pic, PIC(0));
  assert.deepStrictEqual({ view: r.topCard.back.view, ...look(r.topCard.back), y: r.topCard.back.y }, { view: "client", ...WEEK, y: 0 });
});

test("a workout opened from the month 600 down: the picture is the week with the list where it was, and Back lands there on the week", () => {
  assert.strictEqual(r.open.found, true);
  assert.deepStrictEqual({ ...look(r.open.before), y: r.open.before.y }, { ...MONTH, y: 600 }, "the month, 600 down");
  assert.strictEqual(r.open.left.view, "training");
  assert.deepStrictEqual(look(r.open.left), WEEK);
  assert.deepStrictEqual(r.open.pic, PIC(380), "the week, the list where it was: 600 less the 220 the month gave back");
  assert.deepStrictEqual({ view: r.open.back.view, ...look(r.open.back), y: r.open.back.y }, { view: "client", ...WEEK, y: 380 });
});

test("scrolled only into the month (100 down): the picture and Back are the week from the top", () => {
  assert.deepStrictEqual(r.shallow.pic, PIC(0));
  assert.deepStrictEqual({ ...look(r.shallow.back), y: r.shallow.back.y }, { ...WEEK, y: 0 });
});

test("Back to Clients from the month folds it: any client's page opens on the week", () => {
  assert.deepStrictEqual(look(r.toClients.before), MONTH);
  assert.strictEqual(r.toClients.left.view, "clients");
  assert.strictEqual(r.toClients.left.open, false);
  assert.deepStrictEqual(look(r.toClients.other), WEEK, "another client's page");
});

test("another tab (Progress) and back to Workouts: the week", () => {
  assert.strictEqual(r.tabs.away.open, false);
  assert.deepStrictEqual(look(r.tabs.back), WEEK);
});

test("the client card or History opened over the month 600 down: the week under it in the picture, and Back lands on the week with the list where it was", () => {
  for (const k of ["card", "history"]) {
    assert.deepStrictEqual(look(r[k].left), WEEK, k + ": folded as it was left");
    assert.deepStrictEqual(r[k].pic, PIC(380), k + ": the picture is the week");
    assert.deepStrictEqual({ view: r[k].back.view, ...look(r[k].back), y: r[k].back.y }, { view: "client", ...WEEK, y: 380 }, k + ": Back, where the list was");
  }
});

test("the client's own view: a workout opened from the month folds it the same way", () => {
  assert.strictEqual(r.client.found, true);
  assert.strictEqual(r.client.left.view, "training");
  assert.deepStrictEqual(r.client.pic, PIC(380));
  assert.deepStrictEqual({ view: r.client.back.view, ...look(r.client.back), y: r.client.back.y }, { view: "client", ...WEEK, y: 380 });
});

test("staying on the page keeps the month: a sync's redraw, the Skip question opened and closed, the next month", () => {
  assert.deepStrictEqual(look(r.stay.redraw), MONTH, "a redraw");
  assert.deepStrictEqual(look(r.stay.asking), MONTH, "the Skip question up");
  assert.deepStrictEqual(look(r.stay.closed), MONTH, "and closed");
  assert.deepStrictEqual(look(r.stay.paged), MONTH, "paged to the next month");
  const d = new Date(), n = new Date(d.getFullYear(), d.getMonth() + 1, 1, 12);   // local dates, never UTC (after 4 pm in LA, UTC is tomorrow)
  assert.strictEqual(r.stay.paged.shown, n.getFullYear() + "-" + String(n.getMonth() + 1).padStart(2, "0"), "the next month is the one shown");
});

test("the Month button still opens the month and Week closes it, and neither writes anything on the device", () => {
  assert.deepStrictEqual(look(r.toggle.open), MONTH);
  assert.deepStrictEqual(look(r.toggle.closed), WEEK);
  assert.strictEqual(r.toggle.wroteOnOpen, false, "Month: the device's storage unchanged");
  assert.strictEqual(r.toggle.wroteOnClose, false, "Week: unchanged");
});

test("a reload opens on the week: the app closed on the month, or after a workout and Back, and on a device an older version left on the month", () => {
  for (const s of ["killedOnMonth", "leftAndBack"]) {
    const a = run("cal-fold-reload-probe.mjs", ["before", s]);
    assert.deepStrictEqual(look(a.opened), MONTH, s + ": the month was open");
    if (s === "leftAndBack") { assert.strictEqual(a.found, true); assert.strictEqual(a.left.view, "training"); assert.deepStrictEqual(look(a.back), WEEK); }
    const b = run("cal-fold-reload-probe.mjs", ["after"], JSON.stringify(a.storage));
    assert.deepStrictEqual({ view: b.booted.view, tab: b.booted.tab, ...look(b.booted) }, { view: "client", tab: "workouts", ...WEEK }, s + ": the page reopens on the week");
  }
});

test("the app's own reload for a new version, with the month open 600 down: the week first, with the list where it was, so the browser's put-back lands right", () => {
  for (const p of ["visible", "hidden"]) {
    const a = run("cal-fold-reload-probe.mjs", ["release", p]);
    assert.deepStrictEqual({ ...look(a.before), y: a.before.y }, { ...MONTH, y: 600 }, p + ": the month, 600 down");
    if (p === "hidden") assert.strictEqual(a.whileUp, 0, "known while he looks: no reload under him");
    assert.strictEqual(a.reloadCount, 1, p + ": one reload");
    assert.deepStrictEqual({ ...look(a.atReload), y: a.atReload.y }, { ...WEEK, y: 380 }, p + ": as the reload is asked for: the week, the list where it was");
  }
});
