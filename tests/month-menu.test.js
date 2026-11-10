// His three questions, 9 Nov, answered "do what Apple would do for all 3":
// 1. a missed workout's Skip asks first, with the same "Skip this workout?" as every other Skip;
// 2. on a Mac, two fingers sideways over a month (the client page's, the day picker's) page it, as a finger does on the phone;
// 3. a right-click (two-finger click, Control-click) opens the item's own menu at the pointer: a workout row's Reschedule… and Skip…, an
//    exercise's "…" menu in the coach's view; the item wears a ring while it is open; in the field being typed in it stays the browser's.
// The gestures, menus and sheets run in their own process (month-menu-probe.mjs), whose document, pagers and sheet keep their listeners.
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test, assert } from "./assert.js";
import { load } from "./load.js";
const { fns } = await load();
const probe = path.join(path.dirname(fileURLToPath(import.meta.url)), "month-menu-probe.mjs");
const r = JSON.parse(execFileSync(process.execPath, [probe], { encoding: "utf8", timeout: 60000 }).trim().split("\n").pop());

test("a missed workout's Skip asks first (the sheet, nothing skipped yet); Skip workout files it as skipped, Cancel leaves it", () => {
  assert.deepStrictEqual({ asked: r.missed.asked, asking: r.missed.asking }, { asked: true, asking: true }, "the same question as the row's swipe and the workout page");
  assert.strictEqual(r.missed.skippedAtOnce, false, "not skipped by the tap itself");
  assert.deepStrictEqual(r.missed.after, { skipped: true, missed: false, pending: true, closed: true }, "Skip workout: skipped, no longer missed, on its way to the server");
  assert.deepStrictEqual(r.missed.keep, { skipped: false, closed: true }, "Cancel: still missed");
});

test("two fingers over the client page's month: it follows them and, past 48 px, goes on a month; less comes back", () => {
  const T = r.cal.titles;
  assert.strictEqual(r.cal.slow60.before, T.now);
  assert.strictEqual(r.cal.slow60.after, T.next, "60 px to the left, slowly: the next month");
  assert.strictEqual(r.cal.slow60.mid, -60, "the month follows the fingers 1:1");
  assert.strictEqual(r.cal.slow60.rest, 0, "and lands square");
  assert.strictEqual(r.cal.slow60.prevented, r.cal.slow60.of, "every event kept from Safari (its own swipe never starts)");
  assert.strictEqual(r.cal.slow40.after, r.cal.slow40.before, "40 px: back to the same month");
  assert.strictEqual(r.cal.slow40.mid, -40);
  assert.strictEqual(r.cal.back.mid, 60); assert.notStrictEqual(r.cal.back.after, r.cal.back.before, "the other way: the month before");
});

test("a flick and its coasting go one month, never two; a second swipe after a rest goes one more; more fingers before any rest stay one gesture", () => {
  const months = (a, b) => { const p = (s) => new Date(s + " 1").getFullYear() * 12 + new Date(s + " 1").getMonth(); return p(b) - p(a); };
  assert.strictEqual(months(r.cal.flick.before, r.cal.flick.after), 1, "one month");
  assert.strictEqual(r.cal.flick.prevented, r.cal.flick.of, "its coasting too is kept from Safari");
  assert.ok(Math.abs(r.cal.flick.mid) <= 350, "never past a whole month: " + r.cal.flick.mid);
  assert.strictEqual(months(r.cal.back.before, r.cal.back.after), -1);
  assert.strictEqual(months(r.cal.unnatural.before, r.cal.unnatural.after), 1, "natural scrolling off: a scroll to the right still brings the next month (the page's way, as Safari's own swipe)");
  assert.strictEqual(months(r.cal.twice.from, r.cal.twice.first), 1); assert.strictEqual(months(r.cal.twice.first, r.cal.twice.then), 1, "after a rest: a new gesture, a month more");
  assert.strictEqual(months(r.cal.noRest.from, r.cal.noRest.then), 1, "no rest: the same gesture, one month");
  assert.strictEqual(months(r.cal.slowFlick.before, r.cal.slowFlick.after), 1, "slowly almost all the way, then a flick: the edge comes while the fingers still speed up, and those fingers are not taken for new ones (one month, not two)");
  assert.strictEqual(r.cal.slowFlick.prevented, r.cal.slowFlick.of);
});

test("a press on the month that never comes back to it (a right-click's menu took the release, or it was let go outside) never leaves two fingers waiting on it", () => {
  const months = (a, b) => { const p = (s) => new Date(s + " 1").getFullYear() * 12 + new Date(s + " 1").getMonth(); return p(b) - p(a); };
  assert.strictEqual(months(r.cal.afterRightPress.before, r.cal.afterRightPress.after), 1, "a right-click on a day: two fingers still page");
  assert.strictEqual(months(r.cal.afterOutsideRelease.before, r.cal.afterOutsideRelease.after), 1, "a press let go outside the month: two fingers still page");
  assert.deepStrictEqual(r.dp.afterRightPress, { before: 12, after: 13 }, "the day picker: the same");
  assert.deepStrictEqual({ mid: r.cal.secondFinger.mid, on: r.cal.secondFinger.on }, { mid: -40, on: -60 }, "a second finger lifted elsewhere: the first finger's drag goes on");
  assert.notStrictEqual(r.cal.secondFinger.after, r.cal.secondFinger.before, "and its let-go past 48 px pages");
  assert.deepStrictEqual(r.dp.afterOutsideRelease, { before: 12, after: 13 });
});

test("up and down, a slant, a menu up, a finger on the months: the fingers are not the month's", () => {
  assert.strictEqual(r.cal.vertical.after, r.cal.vertical.before); assert.strictEqual(r.cal.vertical.prevented, 0, "a scroll is the page's");
  assert.strictEqual(r.cal.slanted.after, r.cal.slanted.before); assert.ok(r.cal.slanted.prevented <= 1, "a slant is a scroll (only its undecided first event was held back)");
  assert.strictEqual(r.cal.underMenu.after, r.cal.underMenu.before); assert.strictEqual(r.cal.underMenu.prevented, 0, "a menu up: the page under it is not the fingers'");
  assert.strictEqual(r.cal.fingerOn.after, r.cal.fingerOn.before, "a finger already holding the months keeps them");
  assert.deepStrictEqual({ kept: r.cal.redraw.keptMid, after: r.cal.redraw.after }, { kept: true, after: true }, "a sync's redraw waits while two fingers hold the months, then comes");
});

test("two fingers over the day picker's months: they follow, settle on the nearer month, a flick goes one month; the first month gives a little", () => {
  assert.deepStrictEqual([r.dp.slow100.before, r.dp.slow100.after], [12, 12], "100 px of 350: back");
  assert.ok(Math.abs(r.dp.slow100.far - 100 / 350) < 0.001, "followed 1:1: " + r.dp.slow100.far);
  assert.deepStrictEqual([r.dp.slow200.after, r.dp.slow200.at], [13, 13], "200 px: the next month, landed square");
  assert.strictEqual(r.dp.flick.after, 13, "a flick: one month on"); assert.strictEqual(r.dp.flick.far, 1, "never past it"); assert.strictEqual(r.dp.flick.prevented, r.dp.flick.of);
  assert.strictEqual(r.dp.back.after, 11, "the month before");
  assert.deepStrictEqual([r.dp.first.before, r.dp.first.after, r.dp.first.at], [0, 0, 0], "nothing before Reschedule's first month: it comes back");
  assert.ok(Math.abs(r.dp.first.far + 200 / 3 / 350) < 0.001, "pulled past it, it gives a third of the travel, as under a finger: " + r.dp.first.far);
  assert.strictEqual(r.dp.fingerOn.after, r.dp.fingerOn.before, "a finger on the months keeps them");
  assert.deepStrictEqual(r.dp.redraw, { keptMid: true, soon: true, letGo: true, after: true }, "a sync's redraw waits while two fingers hold the months and all through their settle (let go, the next month on its way: sampled every 10 ms until it lands), then comes");
  assert.deepStrictEqual([r.dp.slowFlick.after, r.dp.slowFlick.far], [13, 1], "slowly almost all the way, then a flick: one month, never two");
  assert.ok(r.dp.catch.lowest >= r.dp.catch.from && r.dp.catch.first > r.dp.catch.from, "caught bouncing back from past the first month, two fingers pulling on take it on from where it is: no jump back (" + JSON.stringify(r.dp.catch) + ")");
  assert.strictEqual(r.dp.catch.after, 0, "and let go, it comes back to the first month");
  assert.strictEqual(r.dp.behind.after, r.dp.behind.before, "the client page's month under the sheet does not move");
});

test("a right-click on a workout row: Reschedule… and Skip… at the pointer, the row ringed while it is open, in the client's view and the coach's", () => {
  for (const k of ["client", "coach"]) {
    const m = r.row[k];
    assert.deepStrictEqual({ press: m.pressKept, menu: m.menuKept, open: m.open, labels: m.labels }, { press: true, menu: true, open: true, labels: ["Reschedule…", "Skip…"] }, k);
  }
  assert.deepStrictEqual([r.row.client.left, r.row.client.top], ["300px", "200px"], "its corner at the pointer");
  assert.deepStrictEqual([r.row.coach.left, r.row.coach.top], ["657px", "550px"], "near the window's corner it opens to the left of the pointer and above it");
  assert.deepStrictEqual({ ring: r.row.client.ring, closed: r.row.client.closed, off: r.row.client.ringOff }, { ring: true, closed: true, off: true }, "ringed while open; Escape closes it and the ring comes off");
  assert.deepStrictEqual(r.row.coach.skip, { asking: true, sheet: true, skipped: false, closed: true, ringOff: true }, "Skip…: the menu closes and the question opens; nothing skipped yet");
  assert.deepStrictEqual(r.row.reschedule, { picker: true, title: "Reschedule" }, "Reschedule…: the days");
});

test("a right-click elsewhere: the swipe's own buttons, a finished workout, a finger's long press, inside the menu, the page", () => {
  for (const k of ["onAction", "finished"]) assert.deepStrictEqual({ press: r.row[k].pressKept, menu: r.row[k].menuKept, open: r.row[k].open }, { press: false, menu: false, open: false }, k + ": the browser's own");
  assert.deepStrictEqual(r.row.longPress, { kept: false, open: false }, "a finger's long press: never this menu");
  assert.deepStrictEqual(r.row.keyboard, { kept: true, open: true, focusIn: true, left: "124px", top: "124px", ring: true, focusBack: true }, "the keyboard's or VoiceOver's (no press before it): the menu at the row itself, focus in it, and back on the row's own button when it closes");
  assert.deepStrictEqual(r.row.chrome, { touch: { kept: false, open: false, focusIn: false }, pen: { kept: false, open: false, focusIn: false }, keyboard: { kept: true, open: true, focusIn: true }, mouse: { kept: true, open: true, focusIn: false } }, "Chrome names what opened it: a finger's or a pen's long press (however slow) never; the keyboard's with focus in it; a mouse's at the pointer");
  assert.deepStrictEqual(r.row.keyboardAfterNative, { nativeKept: false, kept: true, focusIn: true, left: "124px" }, "a right-click on the page (the browser's own menu took its release), then the keyboard's menu: still the keyboard's, at the row, focus in it");
  assert.deepStrictEqual(r.row.slowLongPress, { kept: false, open: false }, "a finger held 1.6 s (a long press set slow): still never this menu");
  assert.deepStrictEqual(r.row.slowRight, { kept: true, open: true, left: "300px", top: "200px", focusIn: false }, "the right button held 2 s and the menu after its release (Windows): a mouse's, at the pointer, focus left alone");
  assert.deepStrictEqual(r.row.selection, { during: true, after: false, left: false }, "the word a right press would select is never selected; after the menu, and under a left press, selecting works as ever");
  assert.deepStrictEqual(r.bubble, { insideKept: false, stillOpen: true, outsideKept: false, closed: true }, "a bubble of numbers keeps the browser's own menu inside it (Copy, Look Up); a right-click outside closes it");
  assert.deepStrictEqual(r.row.again, { first: true, firstOff: true, second: true, open: true }, "another row's right-click: its menu, its ring; the first's ring comes off");
  assert.deepStrictEqual(r.row.inMenu, { kept: true, open: true }, "inside the menu: nothing (no browser menu over it)");
  assert.deepStrictEqual(r.row.away, { kept: false, closed: true, ringOff: true }, "anywhere else: the menu closes, and the browser's own opens there");
});

test("a right-click on an exercise: the menu of its \"…\" at the pointer; in the field being typed in the browser's own; in its open panel nothing", () => {
  const labels = ["Alternate exercise…", "Add instructions…", "Delete exercise"];   // an ellipsis where the pick opens another step, as Apple's menus mark it; Delete only asks
  assert.deepStrictEqual({ press: r.ex.name.pressKept, menu: r.ex.name.menuKept, open: r.ex.name.open, labels: r.ex.name.labels }, { press: true, menu: true, open: true, labels }, "on its name, not being typed in: the press focuses nothing, the menu opens");
  assert.deepStrictEqual([r.ex.name.ring, r.ex.name.ringOff], [true, true], "ringed while open");
  assert.deepStrictEqual(r.ex.noted.labels, ["Alternate exercise…", "Edit instructions…", "Delete exercise"], "on its number (no picker: the press focuses nothing); it has instructions");
  assert.strictEqual(r.ex.noted.pressKept, true);
  assert.deepStrictEqual({ press: r.ex.typing.pressKept, menu: r.ex.typing.menuKept, open: r.ex.typing.open }, { press: false, menu: false, open: false }, "the name being typed in: Cut, Copy, Paste");
  assert.deepStrictEqual({ press: r.ex.otherField.pressKept, open: r.ex.otherField.open }, { press: true, open: true }, "typing in its reps, right-clicking its name: the menu");
  assert.deepStrictEqual({ press: r.ex.panel.pressKept, open: r.ex.panel.open }, { press: false, open: false }, "inside its open panel: not the exercise");
  assert.deepStrictEqual(r.ex.keyboard, { kept: true, focusIn: true, focusBack: true }, "from the keyboard or VoiceOver: focus into the menu, and back on the exercise's \"…\" when it closes (a card takes no focus)");
  assert.deepStrictEqual({ picked: r.ex.pick.picked, closed: r.ex.pick.closed, off: r.ex.pick.ringOff }, { picked: ["remove"], closed: true, off: true }, "its last row is Delete exercise, the \"…\" menu's own");
  assert.strictEqual(r.ex.pick.pressKeepsFocus, true, "pressing a menu row moves no focus: a field still typed in keeps it until the pick lets it go");
});

test("an exercise's right-click is its \"…\" menu, only where its \"…\" is shown (the coach's view; a client's card and a folded card have none)", () => {
  const calls = [], items = [{ label: "x" }];
  const shown = fns.exerciseCtx({ offsetParent: {} }, () => { calls.push("items"); return items; }, () => calls.push("first"));
  assert.strictEqual(shown.ok(), true, "its \"…\" is on screen");
  assert.strictEqual(shown(), items); assert.deepStrictEqual(calls, ["first", "items"], "its open panel closes first, then the \"…\" menu's own items");
  assert.strictEqual(fns.exerciseCtx({ offsetParent: null }, () => items).ok(), false, "its \"…\" hidden (a client's card, a folded card): no menu of its own");
  assert.strictEqual(fns.exerciseCtx(null, () => items).ok(), false, "no \"…\" at all");
});

test("a field let go that its own redraw took off the page (an exercise's new number) still lets the typing look go, so the tab bar comes back", () => {
  assert.deepStrictEqual(r.typing, { on: true, off: true });
});

test("where a right-click's menu goes: its corner at the pointer, turned left or up at the window's edges, never past 8 px", () => {
  assert.deepStrictEqual(fns.ctxPlace(300, 200, 243, 150, 1000, 800), { left: 300, top: 200 });
  assert.deepStrictEqual(fns.ctxPlace(900, 200, 243, 150, 1000, 800), { left: 657, top: 200 }, "too near the right: to the left of the pointer");
  assert.deepStrictEqual(fns.ctxPlace(300, 700, 243, 150, 1000, 800), { left: 300, top: 550 }, "too near the bottom: above it");
  assert.deepStrictEqual(fns.ctxPlace(100, 100, 243, 150, 200, 120), { left: 8, top: 8 }, "a window smaller than the menu: from its top-left margin");
});

test("a workout row's menu: Reschedule… (the calendar) then Skip… (the skip glyph in outline, as a menu has it); the let-go rule both months share", () => {
  const m = fns.rowMenu("w1");
  assert.deepStrictEqual(m.map((x) => x.label), ["Reschedule…", "Skip…"]);
  assert.deepStrictEqual(m.map((x) => x.icon), [fns.menuIcons().calendar, fns.menuIcons().skip]);
  assert.ok(/fill="none"/.test(fns.menuIcons().skip) && /stroke-width="1.5"/.test(fns.menuIcons().skip), "drawn as the calendar beside it is: an outline of the same weight");
  assert.ok(m.every((x) => !x.danger), "nothing red: neither deletes anything");
  assert.deepStrictEqual([fns.monthLetGo("cal", -49, 350), fns.monthLetGo("cal", -48, 350), fns.monthLetGo("cal", 49, 350)], [1, 0, -1], "the client page's month: past 48 px");
  assert.deepStrictEqual([fns.monthLetGo("dp", -176, 350), fns.monthLetGo("dp", -175, 350), fns.monthLetGo("dp", 176, 350)], [1, 0, -1], "the day picker's: past half");
});
