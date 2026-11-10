// The day picker's months under the finger (Move to, Add to, Reschedule), and the "…" menu that opens it. The gestures run in their own
// process (day-picker-probe.mjs), whose picker and menu elements record their listeners before the app loads.
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test, assert } from "./assert.js";
const probe = path.join(path.dirname(fileURLToPath(import.meta.url)), "day-picker-probe.mjs");
const r = JSON.parse(execFileSync(process.execPath, [probe], { encoding: "utf8", timeout: 30000 }).trim().split("\n").pop());

test("a finger that goes up or down first never moves the months: the month shown stays the one named", () => {
  assert.strictEqual(r.open.idx, 12, "Move to opens on this month, a year in");
  assert.deepStrictEqual(r.verticalMid, r.open, "down first, then sideways: nothing moves");
  assert.deepStrictEqual(r.verticalAfter, r.open, "and nothing has moved after the lift");
  assert.deepStrictEqual(r.steep, r.open, "steeper than 45 degrees from the start: nothing moves");
});

test("sideways the months follow the finger 1:1, and let go past half they settle on the next month on a spring", () => {
  assert.ok(Math.abs(r.dragMid.at - (12 + 200 / 350)) < 0.001, "the track is where the finger took it: " + r.dragMid.at);
  assert.strictEqual(r.dragMid.month, r.open.month, "the title waits for the lift");
  assert.strictEqual(r.dragAfter.idx, r.dragAfter.from + 1, "on to the next month");
  assert.strictEqual(r.dragAfter.at, r.dragAfter.from + 1, "the track's end is that month");
  assert.ok(r.dragAfter.moving, "it gets there on a transition, not at once");
});

test("the day a finger landed on lets go of its grey once the months slide, until the next touch; a mouse keeps its hover", () => {
  assert.strictEqual(r.dragged, true, "a touch that slid: the press is let go");
  assert.strictEqual(r.draggedNextTouch, false, "the next touch may show its press again");
  assert.strictEqual(r.mouseDragged, false, "a mouse is really over the day it is on");
});

test("a slide's late click picks no day, nor does a tap that only catches months still settling; a plain tap and a keyboard's Enter do", () => {
  assert.strictEqual(r.lateClickAfterSlide, false, "the click iPhone sends a moment after a slide picks nothing");
  assert.strictEqual(r.tapClick, true, "the next plain tap picks its day"); assert.strictEqual(r.tapPicked, r.open.month + "-15");
  assert.strictEqual(r.keyboardAfterSlide, true, "Enter on a focused day is never taken for a slide's click");
  assert.strictEqual(r.tapAfterSlideNoClick, true, "a slide that brought no click: the next tap still picks its day");
  assert.strictEqual(r.catchClick, false, "a tap on settling months only stops them");
  assert.strictEqual(r.catchPress, true, "and shows no press on a day");
});

test("caught while bouncing back from past the first or the last month, the months stay where they are and give a third of the finger", () => {
  assert.strictEqual(r.catchFirst, 30, "past the first month: where it was");
  assert.strictEqual(r.catchFirstOn, 40, "30 px more of finger: 10 px more");
  assert.strictEqual(r.catchLast, -30, "past the last month: where it was");
});

test("a second finger touching and lifting mid-slide leaves the first finger's slide going", () => {
  assert.strictEqual(r.secondFinger.idx, 12, "the second finger's lift did not end the slide");
  assert.strictEqual(r.secondFinger.dragged, true, "nor brought back the press on a day");
  assert.ok(r.secondFinger.after > r.secondFinger.before, "the months still follow the first finger");
});

test("a sync's redraw waits for the months to land (a settle, an arrow's slide) and for a finger to lift, then comes", () => {
  assert.deepStrictEqual(r.redrawSettle, { kept: true, moving: true, after: true }, "the settle runs to its end, then the days are redrawn");
  assert.deepStrictEqual(r.redrawArrow, { kept: true, after: true }, "the same for the arrow's slide");
  assert.deepStrictEqual(r.redrawFinger, { kept: true, lift: true, after: true }, "and a finger on a day keeps its day until its click has come");
});

test("the second tap of a double tap (on a row's Reschedule, on the \"…\" menu's) lands on the days as they come up: in their first 350 ms it picks no day and closes nothing, as the skip sheet's; a keyboard's Enter always picks; after them a tap picks, the backdrop and Cancel close", () => {
  assert.deepStrictEqual(r.settle, { day: false, backdrop: true, cancel: true, keyboard: true, dayLater: r.open.month + "-20", backdropLater: false, cancelLater: false,
    earlyTouch: { picked: false, letGo: true }, earlyMouse: { picked: false, letGo: false } },
    "340 ms after the days opened a day is not picked and the backdrop and Cancel leave them up; Enter (detail 0) picks at once; 360 ms after, the tap picks its day and the backdrop and Cancel close; a finger's early tap lets go of its day's grey (iOS keeps a tap's hover until the next touch), a mouse's keeps its hover");
});

test("days left open past midnight: yesterday is not picked, it greys out", () => {
  assert.deepStrictEqual(r.midnight, { before: true, picked: false, open: true, redrawn: true, greyed: true });
});

test("the \"…\" from the keyboard or VoiceOver: focus goes into its menu and comes back to it when the days close; a tap leaves focus alone", () => {
  assert.deepStrictEqual(r.menu, { open: true, focusIn: true, label: "Reschedule\u2026", closed: true, picker: true, backIsMore: true, focusBack: true, tapLeavesFocus: true }, "its one row: Reschedule\u2026, an ellipsis as the days open (the same words as a row's right-click menu)");
});

test("a short flick after the finger rested still goes on a month (the speed of the last tenth of a second, as UIKit's)", () => {
  assert.strictEqual(r.flickAfterRest.to, r.flickAfterRest.from + 1);
});

test("only the month shown takes focus, and the pager never stays scrolled off its letters", () => {
  assert.deepStrictEqual(r.inert.map((v, i) => v ? null : i).filter((i) => i !== null), [12], "the other months are inert");
  assert.deepStrictEqual(r.inertAfter.map((v, i) => v ? null : i).filter((i) => i !== null), [13], "after a slide, the new month is the one");
  assert.strictEqual(r.scrollLeft, 0, "a scrolled pager is put back as the months move");
  assert.strictEqual(r.afterNext.idx, 13, "Next went on a month");
});

test("the coach's own \"…\" (his ask, 10 Nov), tapped: Reschedule\u2026 and the red Delete workout; a finish takes the open menu away and leaves only Delete; a template, Delete template; his Client view, the client's Reschedule", () => {
  assert.deepStrictEqual(r.coach, { toDo: ["Reschedule\u2026", "red Delete workout"], finishedClosed: true, finished: ["red Delete workout"], template: ["red Delete template"], preview: ["Reschedule\u2026"] });
});
