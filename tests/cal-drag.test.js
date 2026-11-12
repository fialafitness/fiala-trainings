// His ask, 11 Nov: "Now I need when you press and hold on the workout only in calendar view .. both week and month you feel the little
// apple vibration, the name enlarges and I can hold and drag to a different day to reschedule the workout … every day behind today that
// has passed gets obviously gray so it's obvious I can't move the workout there because it's obviously not possible if I drag it all the
// way to the corner it slides to the next month. It's obviously click and hold on Mac". His picks the same day: workouts still to do and
// missed ones inside their week, in the coach's view and the client's, by Reschedule's own rules; a hold let go where it was settles back;
// held at the left or right edge, the next month (in the strip, the week) after half a second, and on while it stays there. Apple
// Calendar's month view was measured on the test iPhone (iOS 27) and on his screenshot. The page plays in its own process
// (cal-drag-probe.mjs), on a fixed day: Wednesday 11 November 2026.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test, assert } from "./assert.js";
const here = path.dirname(fileURLToPath(import.meta.url));
const r = JSON.parse(execFileSync(process.execPath, [path.join(here, "cal-drag-probe.mjs")], { encoding: "utf8", timeout: 60000 }).trim().split("\n").pop());
const html = fs.readFileSync(path.join(here, "../index.html"), "utf8"), js = fs.readFileSync(path.join(here, "../app/main.js"), "utf8");

test("held on a workout in the week strip, nothing shows for 0.4 s; then it lifts, a copy of its name over the finger in its colour, the days gone by grey and its own day filled; dragged a day on, that day is filled; let go there, it has moved (the coach's an ordinary save), nothing opens and the release clicks nothing", () => {
  assert.deepStrictEqual(r.strip.early, { lifted: false, ghost: false, body: false }, "0.39 s: nothing yet, as Calendar");
  const l = r.strip.lift;
  assert.deepStrictEqual([l.lifted, l.ghost, l.cls, l.words, l.body, l.ticks], [true, true, "plan", "Push day", true, 0], "no tick at the lift: on his iPhone none came (a web app may tick only as a touch lands or lifts)");
  assert.strictEqual(r.strip.landTicks, 1, "one tick as it lands in its new day (his pick, 12 Nov), inside the release's own touchend");
  assert.strictEqual(l.width, "85px", "1.6 of the day's 53 points, as Calendar's (92 of 57)");
  assert.deepStrictEqual(l.lit, ["2026-11-13"], "its own day filled at the lift, as Calendar's");
  assert.deepStrictEqual(l.past, ["2026-11-09", "2026-11-10"], "Monday and Tuesday gone by");
  assert.strictEqual(l.transform, "translate3d(212px,223px,0)", "centred over the finger (254), its middle 28 above it (261)");
  assert.deepStrictEqual([r.strip.over.lit, r.strip.over.key], [["2026-11-14"], "2026-11-14"]);
  assert.deepStrictEqual([r.strip.over.pre, r.strip.over.held], [false, true], "a move before the lift is the page's (a scroll); after it every move is the drag's, the page held still under it");
  assert.strictEqual(r.strip.over.transform, "translate3d(265px,223px,0)", "it follows the finger");
  assert.deepStrictEqual([r.strip.upPrevented, r.strip.clickEaten, r.strip.preview], [true, true, null], "the release clicks nothing (iOS clicks after a long press)");
  assert.deepStrictEqual([r.strip.date, r.strip.dirty, r.strip.coachDate], ["2026-11-14", true, true], "moved to Saturday, saved as the coach's own move");
  assert.deepStrictEqual(r.strip.after, { ghost: false, body: false, lit: [], on: false, chipDay: "2026-11-14" }, "down in its new day, the calendar itself again");
});

test("held and let go where it was, it settles back: nothing moves and nothing opens (his pick); a tap still opens the preview", () => {
  assert.deepStrictEqual(r.inPlace, { ticked: false, lifted: true, date: "2026-11-13", preview: null, clickEaten: true, ghost: false }, "settled back: no tick");
  assert.deepStrictEqual(r.tap, { lifted: false, preview: "a", eaten: false });
});

test("a day gone by takes nothing: no fill over it, and let go there the workout stays where it was (in the coach's view too: his rule for the drag)", () => {
  assert.deepStrictEqual(r.pastDay, { over: { lit: [], key: null }, ticked: false, date: "2026-11-13" });
});

test("a finger that wanders before the lift (a scroll, the months' slide) lifts nothing; a finished workout never lifts", () => {
  assert.deepStrictEqual(r.noLift, { wandered: false, done: false, ghost: false });
});

test("a missed workout inside its week lifts red and moves to today; one missed past its week (brought back, still red on the month) never lifts", () => {
  assert.deepStrictEqual([r.missed.lifted, r.missed.cls, r.missed.date], [true, "miss", "2026-11-11"]);
  assert.deepStrictEqual(r.missed.old, { shown: true, lifted: false });
});

test("held at the strip's right edge: the next week after half a second, the one after 0.9 s later; let go on a day there, it moves there and the strip comes back to this week at its own height; never back past this week", () => {
  const w = r.weekEdge;
  assert.strictEqual(w.left, 0, "the left edge of this week turns nothing: every day before it is gone by");
  assert.strictEqual(w.before, 0, "0.48 s at the edge: not yet");
  assert.deepStrictEqual(w.first, { weekOff: 1, days: "16 17 18 19 20 21 22", slide: true, minHeight: "116px" }, "the next week slides in from the right; the strip keeps its height while the drag lasts (fewer names, the same finger)");
  assert.strictEqual(w.again, 2, "and on while it stays there");
  assert.deepStrictEqual([w.key, w.date], ["2026-11-25", "2026-11-25"]);
  assert.strictEqual(w.back, true, "this week slides back in from the left");
  assert.deepStrictEqual(w.after, { weekOff: 0, days: "09 10 11 12 13 14 15", minHeight: "", slide: false }, "and the slide's class goes once it has played (else the strip would slide in each time it is shown)");
});

test("held at the month's right edge: December after half a second, the day under the finger found once it lands; let go there, it moves there; never back past this month; the month's own slide stands still under a lifted workout", () => {
  assert.strictEqual(r.monthEdge.pastM, 10, "the 1st to the 10th grey");
  assert.deepStrictEqual([r.monthEdge.back, r.monthEdge.turned, r.monthEdge.key, r.monthEdge.date, r.monthEdge.month], ["2026-11", "2026-12", "2026-12-17", "2026-12-17", "2026-12"]);
  assert.deepStrictEqual([r.monthStill.lifted, r.monthStill.tr0, r.monthStill.tr1, r.monthStill.same], [true, "translateX(-100%)", "translateX(-100%)", true], "80 points sideways under a lifted workout: the months stay where they are");
});

test("in the client's own view the move goes by the server's rule, as her Reschedule's", () => {
  assert.deepStrictEqual(r.client, { date: "2026-11-14", pending: true });
});

test("a Mac: click and hold lifts it, a drag and a release move it, the click after the release is eaten; a mouse that moves before the hold is the month's own slide; a right-click holds nothing", () => {
  assert.deepStrictEqual(r.mouse, { lifted: true, moved: "2026-11-14", clickEaten: true, wandered: false, right: false });
});

test("Escape, a second finger and the system's own cancel take it back: nothing moves", () => {
  for (const k of ["escape", "second", "cancel"]) assert.deepStrictEqual(r.cancel[k], { on: false, date: "2026-11-13", ghost: false }, k);
});

test("a sync's redraw waits while a workout is lifted (the chip stays in the page) and comes once it is down; a week turned under the finger takes its chip out of the page, its touch still drops it, and its listeners go with the drag", () => {
  assert.deepStrictEqual(r.redraw, { held: true, after: false, title: "Done 2" });
  assert.deepStrictEqual(r.detached, { gone: true, date: "2026-11-20", listening: 0 }, "aimed at Friday's column of the week turned in: the strip's days are its columns, wherever its sliding buttons are");
  assert.ok(js.includes("    if (moved) cdTick();") && js.includes('document.addEventListener("click", (e) => { if (cdTicking) return; if (performance.now() < cdEatUntil) {'), "the tick when it has moved, and its own click let through the release's eater (eaten, its switch would not flip)");
});

test("the look, measured on Apple Calendar (iOS 27): the copy 20 tall, its words a size up (15 for 11) and white on its solid colour, a soft shadow, over the page and under nothing; the day under it filled as Calendar's; the days gone by grey; no loupe on the strip; Reduce Motion moves it at once", () => {
  assert.ok(html.includes("#calDrag { position: fixed; left: 0; top: 0; z-index: 56; height: 20px; box-sizing: border-box; border-radius: 5px; padding: 0 6px; overflow: hidden; white-space: nowrap; font-size: 15px; line-height: 20px; font-weight: 600; letter-spacing: 0; color: #fff; pointer-events: none; transform-origin: 0 0;"));
  assert.ok(html.includes("  #calDrag.plan { background: var(--chip-grey); }\n  #calDrag.miss { background: var(--danger); }"));
  assert.ok(html.includes("    --drop-on: rgba(0,0,0,0.05);") && html.split("--drop-on: rgba(255,255,255,0.098);").length - 1 === 2, "#f2f2f2 on white, #191919 on black, in both dark blocks");
  assert.ok(html.includes("  body.cal-drag .week button.past, body.cal-drag .cal button.past { opacity: 0.35; }"));
  assert.ok(html.includes("  body.cal-drag .week button.drop-on, body.cal-drag .cal button.drop-on { background: var(--drop-on); }"));
  assert.ok(html.includes("  .week { -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; }"), "selectability is settled as the touch begins: the strip, as the month, never brings up a loupe under a held finger");
  assert.ok(/@media \(prefers-reduced-motion: reduce\) \{ \.week\.wk-in-r, \.week\.wk-in-l \{ animation: none; \} #calDrag \{ transition: none !important; \} \}/.test(html));
  assert.ok(/const CD_MS = 400, CD_SLOP = 8, CD_MSLOP = 4, CD_EDGE = 28, CD_DWELL = 500, CD_REPEAT = 900, CD_RISE = 28, CD_WIDE = 1\.6, CD_H = 20;/.test(js), "the hold, the drift, the edge, its waits, and the copy's place and size");
  assert.ok(js.includes('if (key < today()) b.classList.add("past");'), "every day gone by is marked as it is drawn");
});

test("midnight passing under a lifted workout held over today makes today a day gone by: let go there, it stays where it was (the drop asks again, as Reschedule's pick does)", () => {
  assert.deepStrictEqual(r.midnight, { key: "2026-11-11", date: "2026-11-13" });
});

test("a redraw in the moment after a drop from another week (before the strip slides back) leaves the strip on this week, at its own height", () => {
  assert.deepStrictEqual(r.landRedraw, { date: "2026-11-19", weekOff: 0, days: "09 10 11 12 13 14 15", minHeight: "" });
});

test("the edge is the calendar's rim and beyond, never a day's middle: resting on Sunday (a phone's Sunday is 53 wide) aims at Sunday, in the strip and in the month", () => {
  assert.deepStrictEqual(r.sunday, { weekOff: 0, weekDate: "2026-11-15", month: "2026-11", monthDate: "2026-11-22" });
});

test("called off with the button or the finger still on it (Escape on a Mac, a second finger), the rest of that press is no swipe of the months, and its release clicks nothing", () => {
  assert.deepStrictEqual(r.calledOff.esc, { on: false, tr: "translateX(-100%)", month: "2026-11", clickEaten: true, preview: null, date: "2026-11-13" });
  assert.deepStrictEqual(r.calledOff.two, { on: false, tr: "translateX(-100%)", month: "2026-11", upPrevented: true, clickEaten: true, preview: null, date: "2026-11-13" });
});

test("a tap a quarter of a second after a drop opens its preview: a new touch ends the drop's window", () => {
  assert.deepStrictEqual(r.tapAfter, { preview: "m", eaten: false });
});

test("the copy eases up at the lift and then follows the finger at once; let go far below the strip, nothing moves; a turned month's day under a still finger is found once it lands", () => {
  assert.deepStrictEqual([r.follow.tr0, r.follow.tr1, r.follow.keyBelow, r.follow.turnedBelow, r.follow.date], ["transform 200ms cubic-bezier(0.25, 0.1, 0.25, 1)", "none", null, 0, "2026-11-13"], "and at the right side far below the strip, nothing turns: the edge is level with the calendar");
  assert.deepStrictEqual(r.follow.month, { during: null, landed: "2026-12-20", date: "2026-12-20" });
});

test("a sync's redraw during the hold draws the chip anew, and the same workout in the same day still lifts and moves", () => {
  assert.deepStrictEqual(r.redrawHold, { gone: true, lifted: true, date: "2026-11-14" });
});

test("a Mac's release lost to the window (its last move with the button already up, no pointerup within 150 ms): back where it was", () => {
  assert.deepStrictEqual(r.lostUp, { waiting: true, on: false, date: "2026-11-13", ghost: false });
});

test("the client gone while a workout is held at the strip's edge: nothing turns and nothing throws, it goes back", () => {
  assert.deepStrictEqual(r.goneClient, { threw: null, on: false, weekOff: 0 });
});

test("Reduce Motion: the copy appears and goes at once, and the strip's weeks change with no slide", () => {
  assert.deepStrictEqual(r.calm, { tr: "none", slide: false, gone: true, date: "2026-11-18" });
});

test("on a Mac the grabbing hand stays over the whole calendar while a workout is dragged (over the month's pointing days too)", () => {
  assert.ok(html.includes("  body.cal-drag, body.cal-drag * { cursor: grabbing !important; }"));
});

test("dropped on a turned week, a quick tap on a chip there before the strip slides back: the strip still comes back to this week, at its own height", () => {
  assert.deepStrictEqual(r.tapBack, { date: "2026-11-18", weekOff: 0, days: "09 10 11 12 13 14 15", minHeight: "" });
});
