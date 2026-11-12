// A workout's row on Today and Up next swipes to the left to its two actions, Skip and, outermost, Reschedule (Apple's rows, iOS 27.2,
// measured 8 Nov): which rows have them, where a let-go row goes (closed, open, or, armed once its edge is within 81 points of its own start,
// Reschedule itself), which way two fingers on a Mac's trackpad went, that Reschedule opens the same day picker as the workout page's "…" and
// Skip the workout page's own "Skip this workout?" sheet, and the page's measured look. The gestures themselves (a finger, a mouse, two
// fingers on a Mac's trackpad with Safari's coasting after them), the actions' look as the row moves and the sheet's own buttons run in their
// own process (row-swipe-probe.mjs), whose document and buttons keep their listeners.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test, assert } from "./assert.js";
import { load } from "./load.js";
import { TEMPLATES_ID } from "../app/model.js";
const app = await load();
const { fns, maps } = app;
const day = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return fns.localIso(d); };   // the app's local day (never UTC: after 4 pm in Los Angeles that is tomorrow)
const setup = (clientMode, extra = {}) => {
  app.reset(); app.set({ signedIn: true, clientMode, myClientId: clientMode ? "c1" : null, tab: "workouts" });
  maps.clients.set("c1", { id: "c1", name: "Jane", unit: "lb" });
  maps.trainings.set("w1", { id: "w1", clientId: "c1", title: "Legs", date: day(1), createdAt: "2026-11-01T10:00:00.000Z", completedAt: null, skippedAt: null, rows: [], ...extra });
  app.set({ view: { name: "client", id: "c1" } }); fns.render();
  return maps.trainings.get("w1");
};
const swipes = (li) => li.classList.contains("swipe-row");
const TEMPLATES = TEMPLATES_ID;   // the templates' own client

test("only a workout still to do, on Today or Up next, swipes to its Skip and Reschedule: in the client's view and in the trainer's", () => {
  let t = setup(true);
  assert.strictEqual(swipes(fns.workoutRow(t, "next", true)), true, "Up next: it swipes");
  assert.strictEqual(swipes(fns.workoutRow(t, "today", true)), true, "Today: it swipes");
  assert.strictEqual(swipes(fns.workoutRow(t, "next")), false, "a list that did not ask for it (a day's own sheet)");
  assert.strictEqual(swipes(fns.workoutRow(t, "past", true)), false, "History: no");
  t = setup(true, { completedAt: "2026-11-02T18:00:00.000Z" });
  assert.strictEqual(swipes(fns.workoutRow(t, "next", true)), false, "finished: nothing to move");
  t = setup(true, { skippedAt: "2026-11-02T18:00:00.000Z" });
  assert.strictEqual(swipes(fns.workoutRow(t, "next", true)), false, "skipped: nothing to move");
  t = setup(false);
  assert.strictEqual(swipes(fns.workoutRow(t, "next", true)), true, "the trainer's view of a client's page: it swipes too (his pick)");
  assert.strictEqual(swipes(fns.workoutRow(t, "today", true)), true);
  t = setup(false, { completedAt: "2026-11-02T18:00:00.000Z" });
  assert.strictEqual(swipes(fns.workoutRow(t, "next", true)), false, "the trainer's view, finished: nothing to move");
  for (const coach of [true, false]) { t = setup(!coach, { clientId: TEMPLATES }); assert.strictEqual(swipes(fns.workoutRow(t, "next", true)), false, "a template's workout never swipes (" + (coach ? "trainer" : "client") + ")"); }
});

// elements that keep what is put in them and the listeners they are given (the shared stand-in drops both), for as long as fn runs
function keeping(fn) {
  const make = document.createElement, lists = ["todayList", "nextList"].map((id) => document.getElementById(id)), drawn = {};
  document.createElement = (tag) => { const e = make(tag); e.kids = []; e.on = {}; e.appendChild = (c) => { e.kids.push(c); return c; }; e.append = (...k) => { e.kids.push(...k); }; e.addEventListener = (type, f) => { (e.on[type] ||= []).push(f); }; return e; };
  for (const l of lists) l.replaceChildren = (...k) => { drawn[l === lists[0] ? "today" : "next"] = k; };
  try { return fn(drawn); } finally { document.createElement = make; for (const l of lists) delete l.replaceChildren; }
}
const actsOf = (li) => { const layer = li.kids.find((k) => k.className === "swipe-acts"); return layer ? layer.kids : []; };

test("behind the row: Skip, then Reschedule outermost (the full swipe's), as Apple orders Details and Delete; each does what the workout page's does", () => {
  const t = setup(true), sheet = document.getElementById("skipSheet"), wasHidden = sheet.hidden;
  try {
    keeping(() => {
      const li = fns.workoutRow(t, "next", true), acts = actsOf(li);
      assert.deepStrictEqual(acts.map((a) => a.className), ["swipe-act sa-prev", "swipe-act sa-skip", "swipe-act sa-resched"], "Preview innermost (his pick, 10 Nov: on the same swipe), then Skip, Reschedule outermost");
      assert.ok(acts.every((a) => a.tabIndex === -1), "out of the keyboard's way: the workout page holds both");
      acts[2].on.click[0]({ stopPropagation() {} });
      assert.strictEqual(fns.datePicker() && fns.datePicker().title, "Reschedule", "Reschedule opens the days");
      fns.closeDatePicker();
      sheet.hidden = true;                                             // as the page starts it
      acts[1].on.click[0]({ stopPropagation() {} });
      assert.deepStrictEqual(fns.skipSheet(), { id: "w1", reason: "" }, "Skip asks first: the workout page's own sheet, for this workout");
      assert.strictEqual(sheet.hidden, false, "the sheet is up");
      assert.strictEqual(maps.trainings.get("w1").skippedAt, null, "and nothing is skipped before the answer");
      assert.strictEqual(app.get().asking, true, "the sheet holds the page while it asks");
      fns.closeSkip();
      assert.strictEqual(fns.skipSheet(), null);
    });
  } finally { sheet.hidden = wasHidden; }
  fns.setSkipped(true, "Sick", "w1");                                  // what the sheet's Skip workout calls with the row's workout (the button itself is pressed in row-swipe-probe.mjs)
  const w = maps.trainings.get("w1");
  assert.ok(w.skippedAt, "skipped by the row's own id, never the page's"); assert.strictEqual(w.skipReason, "Sick");
  assert.ok(maps.pendingSkip.has("w1"), "a client's skip goes through the server's own rule");
  assert.strictEqual(app.get().view.name, "client", "and the Workouts page stays where it is");
});

test("the Workouts page draws Today's and Up next's rows with their actions behind them", () => {
  setup(true); maps.trainings.set("w2", { ...maps.trainings.get("w1"), id: "w2", title: "Push", date: fns.today() });
  keeping((drawn) => {
    fns.render();
    for (const k of ["today", "next"]) {
      const li = (drawn[k] || [])[0];
      assert.ok(li && li.classList.contains("swipe-row"), k + ": its workout's row swipes");
      assert.strictEqual(actsOf(li).length, 3, k + ": Preview, Skip and Reschedule behind it");
    }
  });
});

test("a let-go row: armed once its edge is within 81 points of its start, it reschedules; a flick goes its own way; else past half the actions it stays open", () => {
  const w = 11.67 + 61 + 10.33 + 61 + 10.67, row = 368;                // the two actions open (measured), and a phone's card row
  assert.strictEqual(fns.rowDecide(row - 81, 0, w, row), "fire", "armed (Apple: 80% of a 402-point row, 89% of a 748-point one: 81 points short of the start)");
  assert.strictEqual(fns.rowDecide(row - 82, 0, w, row), "open", "just short of it: the row stays open");
  assert.strictEqual(fns.rowDecide(row - 81, -2, w, row), "fire", "armed when let go, even moving back");
  assert.strictEqual(fns.rowDecide(w / 2 + 1, 0, w, row), "open", "past half the actions, at rest: open");
  assert.strictEqual(fns.rowDecide(w / 2 - 1, 0, w, row), "close", "short of half: closed");
  assert.strictEqual(fns.rowDecide(20, 0.5, w, row), "open", "flicked to the left: open, however little it moved");
  assert.strictEqual(fns.rowDecide(80, -0.5, w, row), "close", "flicked back to the right: closed");
  assert.strictEqual(fns.rowDecide(w, 0.2, w, row), "open", "a slow drift is not a flick: where it is decides");
  assert.strictEqual(fns.rowArmed(w - 1, w, 200), false, "a row too narrow for the rule never arms before its actions are open");
  assert.strictEqual(fns.rowArmed(648 - 81, w, 648), true, "a wide row (a computer's window) arms by the same 81 points");
  const w3 = 11.67 + 61 + 10.33 + 61 + 10.33 + 61 + 10.67, se = 320 - 34;   // a row's three (Preview, Skip, Reschedule), open; a 320-point phone's card row
  assert.strictEqual(fns.rowArmed(w3, w3, se), false, "a 320-point phone: a row of three let go open is never armed (81 short of its start is inside its open actions)");
  assert.strictEqual(fns.rowDecide(w3 + 6, 0, w3, se), "open", "so letting go just past the open width keeps it open, never the full swipe");
  assert.strictEqual(fns.rowArmed(w3 + 49, w3, se), false); assert.strictEqual(fns.rowArmed(w3 + 50, w3, se), true, "50 points past the open width it arms (the room a row of two has there: 205 - 154.67)");
  assert.strictEqual(fns.rowArmed(se, 262, se), false, "a large Text Size there: no full swipe at all, the actions are tapped");
});

test("two fingers on a Mac's trackpad: the way they moved, natural scrolling or not", () => {
  assert.strictEqual(fns.fingerX({ deltaX: -12 }), 12, "the page scrolls left as the fingers go right (natural scrolling, a browser that does not say)");
  assert.strictEqual(fns.fingerX({ deltaX: -12, webkitDirectionInvertedFromDevice: true }), 12, "Safari says natural");
  assert.strictEqual(fns.fingerX({ deltaX: 12, webkitDirectionInvertedFromDevice: false }), 12, "Safari says not natural: the delta is the fingers' own way");
  assert.ok(fns.fingerX({ deltaX: 9 }) < 0, "fingers to the left");
});

test("Reschedule from the row opens the same day picker as the workout page's \"…\", and the day picked moves the workout", () => {
  const t = setup(true);
  assert.strictEqual(fns.rowReschedule("w1"), true);
  const dp = fns.datePicker();
  assert.ok(dp, "the days are open");
  assert.strictEqual(dp.title, "Reschedule");
  assert.strictEqual(dp.selected, t.date, "on the workout's own day");
  assert.strictEqual(typeof dp.min, "function", "from today on, asked again at every redraw (midnight)");
  assert.strictEqual(dp.min(), fns.today());
  assert.strictEqual(dp.ok(), true, "still the Workouts page, the workout still to do");
  dp.onPick(day(3));
  assert.strictEqual(maps.trainings.get("w1").date, day(3), "moved");
  assert.ok(maps.pendingMove.has("w1"), "a client's move waits for the server's own rule");
  fns.closeDatePicker();
  assert.strictEqual(fns.rowReschedule("w1"), true);
  app.set({ view: { name: "training", id: "w1" } });
  assert.strictEqual(fns.datePicker().ok(), false, "another page: the days close on the next redraw");
  fns.closeDatePicker();
  setup(true, { completedAt: "2026-11-02T18:00:00.000Z" });
  assert.strictEqual(fns.rowReschedule("w1"), false, "finished meanwhile: nothing opens");
  assert.strictEqual(fns.datePicker(), null);
});

const probe = path.join(path.dirname(fileURLToPath(import.meta.url)), "row-swipe-probe.mjs");
const g = JSON.parse(execFileSync(process.execPath, [probe], { encoding: "utf8", timeout: 30000 }).trim().split("\n").pop());

test("two fingers flick a row on a Mac: it opens and stops at its open width; Safari's coasting after the fingers reaches nothing", () => {
  assert.strictEqual(g.flick.fired, false, "no days open: the coasting is never taken for a full swipe");
  assert.strictEqual(g.flick.open, true, "the flick opens the row");
  assert.ok(g.flick.maxX <= g.flick.w + 0.01, "never past its open width: " + g.flick.maxX + " of " + g.flick.w);
  assert.ok(Math.abs(g.flick.w - (11.67 + 61 + 10.33 + 61 + 10.67)) < 0.01, "open: 11.67 + Skip + 10.33 + Reschedule + 10.67, each action as wide as its own box");
  assert.ok(Math.abs(g.widths.w - (11.67 + 61 + 10.33 + 72 + 10.67)) < 0.01, "a wider action (a larger Text Size's title) widens it");
  assert.strictEqual(g.flick.prevented, g.flick.events, "every event of the gesture, the coasting too, kept from the page");
});

test("on a trackpad a new gesture is new fingers: a scroll right after a flick scrolls (and closes the row); a row swipe after a scroll moves it", () => {
  assert.strictEqual(g.scrollAfter.prevented, 0, "the scroll 40 ms after the coasting is the page's");
  assert.strictEqual(g.scrollAfter.open, false, "and the open row closes, though still settling");
  assert.ok(g.rowAfterScroll.maxX > 0 && g.rowAfterScroll.open, "the row swiped 40 ms after a scroll's coasting moves and opens");
  assert.ok(g.slowAfterScroll.maxX > 20, "so does a slow one, a pixel at a time: judged by its travel, never one event's size");
  assert.ok(g.rightThenLeft.maxX > 0 && g.rightThenLeft.open, "to the right first (nothing of the app's), then straight to the left: the row moves");
  assert.strictEqual(g.trackpadClose.opened, true); assert.strictEqual(g.trackpadClose.afterScroll, null, "a scroll closes the open row");
  assert.strictEqual(g.trackpadClose.reopened, true); assert.strictEqual(g.trackpadClose.afterBack, null, "two fingers back the other way close it");
});

test("a row a redraw replaced before the trackpad's swipe was decided moves nothing and opens nothing; the new row under the fingers is the one that moves", () => {
  assert.strictEqual(g.detached.row, null); assert.strictEqual(g.detached.fired, false); assert.strictEqual(g.detached.fresh, false);
  assert.strictEqual(g.detached.newRowMoved, true, "the row under the event that decides, not under the first");
  assert.deepStrictEqual(g.detached.noWidth, { row: null, fired: false }, "a row with no width (its page hidden) is never taken for one already armed");
});

test("a second finger on a row on the move settles it (never left part-way); a redraw waits for a finger resting on a row", () => {
  assert.strictEqual(g.secondFinger.during, 40);
  assert.strictEqual(g.secondFinger.after, null, "40 px of a 83 px action: it closes");
  assert.strictEqual(g.redraw.moved, 100, "the swipe the resting finger then makes still holds its row");
  assert.strictEqual(g.redraw.rendersDuring, 0, "nothing redrawn under the finger");
  assert.strictEqual(g.redraw.openThen, true);
  assert.strictEqual(g.redraw.renders, 1, "the redraw comes once the row has settled");
  assert.strictEqual(g.redraw.keptOpen, true, "and keeps the open row open");
});

test("the click of a tap that only closes a row goes nowhere, a long press's too; a tap that brought no click leaves the next tap alone", () => {
  assert.strictEqual(g.eat.opened, true);
  assert.strictEqual(g.eat.ownTapEaten, true, "a tap on the open row only closes it");
  assert.strictEqual(g.eat.ownEndCancelled, true, "its touchend is cancelled: no click");
  assert.strictEqual(g.eat.pressLookOff, true, "what it touched loses iOS's leftover hover until the next touch (rs-ate)");
  assert.strictEqual(g.eat.rolledTapEaten, true, "a closing tap that rolls a little (6 and 6) is still only a closing tap");
  assert.strictEqual(g.eat.barTapEaten, false, "a tap on the top bar acts at once (Apple's Back does, with a row open: measured)");
  assert.strictEqual(g.eat.barEndCancelled, false); assert.strictEqual(g.eat.closedByBar, true, "and the row closes");
  assert.deepStrictEqual(g.tabBar, { opened: true, endCancelled: false, clickEaten: false, closed: true }, "a tap on the tab bar acts at once too (its touchend and its click go through), and the row closes");
  assert.strictEqual(g.eat.nextTapEaten, false, "a tap on a title (no click) then a tap on a workout: the workout opens");
  assert.strictEqual(g.eat.longPressEaten, true, "a long press on the open row clicks on release: it only closes the row");
  assert.strictEqual(g.eat.closedAfterLong, true);
});

test("a row caught while it settles is taken up where it is on the screen; another page or a redraw puts the row back first", () => {
  assert.strictEqual(g.regrab.caught, 62, "caught at the spring's place, not at its end");
  assert.strictEqual(g.page.was, true); assert.strictEqual(g.page.atPicture, null, "the row is back before the page's picture is taken"); assert.strictEqual(g.page.after, null);
  assert.strictEqual(g.cursor.grabbing, true); assert.strictEqual(g.cursor.after, false, "a mouse drag a redraw cut short leaves no grabbing cursor");
});

test("a full swipe: a finger's and a mouse's open the days; the click that ends a mouse drag opens nothing; a Control-click or a lost release never drags", () => {
  assert.ok(g.fullTouch.armedAt >= 287 && g.fullTouch.armedAt < 296, "armed at the row's edge 81 points from its start: " + g.fullTouch.armedAt);
  assert.strictEqual(g.fullTouch.armedBefore, true); assert.strictEqual(g.fullTouch.picker, "Reschedule"); assert.strictEqual(g.fullTouch.closed, true, "the row closes as the days open");
  assert.strictEqual(g.mouse.picker, "Reschedule"); assert.strictEqual(g.mouse.dragClickEaten, true, "a drag's click opens no workout");
  assert.strictEqual(g.mouse.elsewhereEaten, false, "a click elsewhere goes through (a Mac's way)"); assert.strictEqual(g.mouse.closedByClick, true, "and closes the open row");
  assert.strictEqual(g.mouse.ctrlRow, null, "a Control-click never starts a drag"); assert.strictEqual(g.mouse.ctrlHeld, false, "nor holds a sync's redraw"); assert.strictEqual(g.mouse.noButtonRow, null, "a move with no button ends one");
  assert.strictEqual(g.mouse.cursor, false, "no grabbing cursor left");
});

test("a tap on an action that rolls a little is that tap; a finger never moves a row and the page at once", () => {
  assert.strictEqual(g.actTap.openAtEnd, true, "the row stays open under the finger"); assert.strictEqual(g.actTap.eaten, false, "and Reschedule's click goes through");
  assert.strictEqual(g.touchGuards.kept, g.touchGuards.moves, "every move of a held row is kept from the page");
  assert.strictEqual(g.touchGuards.afterScroll, null, "the page scrolled under a held row: it settles (here closed)");
  assert.strictEqual(g.touchGuards.afterCancel, null, "WebKit took the touch: it settles");
  assert.strictEqual(g.touchGuards.afterSlant, null, "a slanted start on the open row: a scroll, it closes");
  assert.strictEqual(g.touchGuards.afterActScroll, null, "a scroll from its Reschedule closes it too");
});

test("two fingers swipe a Mac's workout page back: a flick goes, a nudge and a peek stay, a field focused or under the pointer is no bar, the one typed in keeps them only while its text can scroll back", () => {
  assert.deepStrictEqual(g.wheelBack.flick, { view: "client", kept: 54 }, "a flick goes back, all of it (its coasting too) kept from the browser");
  assert.strictEqual(g.wheelBack.nudge.view, "training", "a short nudge springs back");
  assert.strictEqual(g.wheelBack.peek.view, "training", "out and back without lifting: it stays");
  assert.strictEqual(g.wheelBack.focused.view, "client"); assert.strictEqual(g.wheelBack.focused.blurred, 1, "the field typed in is let go first, its value kept");
  assert.strictEqual(g.wheelBack.overField.view, "client", "with the pointer over a field");
  assert.deepStrictEqual(g.focusedUnder.scrolled, { view: "training", kept: 0, blurred: 0 }, "over the field being typed in, its text scrolled: they scroll it (the page stays, nothing kept from the browser, the field kept)");
  assert.deepStrictEqual(g.focusedUnder.atStart, { view: "client", kept: 54, blurred: 1 }, "its text at its start (nothing to scroll back): the page goes back, the field let go first, as Safari's own swipe does");
});

test("on a trackpad a rest mid-drag lets go and the fingers pick it up again; a slanted start is a scroll; a mouse wheel's step and Escape close an open row", () => {
  assert.ok(g.wheelRules.afterRest > 40, "picked up again after the rest: " + g.wheelRules.afterRest);
  assert.strictEqual(g.wheelRules.slantKept, 0, "a slanted start is the page's"); assert.strictEqual(g.wheelRules.slantRow, null);
  assert.strictEqual(g.wheelRules.lineWheel, null, "a mouse wheel scrolls: the open row closes");
  assert.strictEqual(g.wheelRules.shiftWheel, null, "Shift + a mouse wheel scrolls sideways: never a swipe (Safari's own needs a trackpad's precise deltas), the open row closes");
  assert.strictEqual(g.wheelRules.escape, null, "Escape closes it");
});

const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
test("the questions' way out says Cancel, as Apple words it: Skip this workout?, and Finish (or Skip) this exercise?", () => {
  assert.ok(html.includes('<button class="btn quiet" id="skKeep" type="button">Cancel</button>'), "Skip this workout?: Cancel (was Keep it)");
  assert.ok(html.includes('<button class="btn quiet" id="esKeep" type="button">Cancel</button>'), "Finish this exercise? / Skip this exercise?: Cancel (was Keep training)");
});
const rule = (sel) => { const i = html.indexOf(sel + " {"); return i < 0 ? "" : html.slice(i, html.indexOf("}", i)); };   // a rule's (or a token block's) text, up to its first "}"
test("the page keeps Apple's measured gaps behind the row: 10.33 between the actions, 10.67 to the card's edge, titles overhanging their capsules by 5.5", () => {
  assert.match(rule(".list li.swipe-row > .swipe-acts"), /gap: 10\.33px;/);
  assert.match(rule(".list li.swipe-row > .swipe-acts"), /padding-right: 10\.67px;/);
  assert.match(rule(".swipe-act .sa-lbl"), /margin: 0 -5\.5px;/, "the action as wide as its capsule, so the gaps are the capsule's");
  assert.match(rule(".swipe-act .sa-cap"), /width: 61px; height: 37px;/);
});

test("the page draws the actions as measured: Skip's capsule grey, armed only the outermost action's icon moves and only its title goes, the tokens in light and both darks; a closing tap leaves no hover; the keyboard's ring sits inside the row", () => {
  assert.ok(html.includes(".swipe-act.sa-skip .sa-cap { background: var(--swipe-skip); }"), "Skip's capsule systemGray3, as Reminders' Details (Reschedule's the brand's)");
  assert.ok(!/sa-today|--swipe-today/.test(html), "no Today capsule on any swipe (his ask, 10 Nov: a missed workout's Do it today is in its \"…\" and touch and hold)");
  assert.ok(html.includes(".armed .swipe-act:last-child .sa-cap .mi { left: 20px; margin-left: 0; }"), "armed: the outermost action's icon (Reschedule's) goes to its capsule's leading edge");
  assert.ok(html.includes(".armed .swipe-act:last-child .sa-lbl { opacity: 0; }"), "and its title goes");
  assert.deepStrictEqual([...html.matchAll(/\.armed\b([^{]*)\{/g)].map((m) => m[1].trim()), [".swipe-act:last-child .sa-cap .mi", ".swipe-act:last-child .sa-lbl"], "only the outermost's: armed, the inner ones keep their titles (they show at 30%); these two are the armed look's only rules");
  const tokens = (sel) => rule(sel).match(/--swipe-(?:label|skip): [^;]*;/g);
  assert.deepStrictEqual(tokens(":root"), ["--swipe-label: rgba(60,60,67,0.6);", "--swipe-skip: #c7c7cc;"], "light: the titles secondary grey (measured 138,138,142), Skip systemGray3 (199,199,204)");
  for (const dark of [':root:not([data-theme="light"])', ':root[data-theme="dark"]']) assert.deepStrictEqual(tokens(dark), ["--swipe-label: rgba(235,235,245,0.6);", "--swipe-skip: #48484a;"], "dark (" + dark + "): measured 141,141,147 and 72,72,74");
  assert.strictEqual(html.split("--swipe-label:").length - 1, 3, "the titles' grey set there and nowhere else"); assert.strictEqual(html.split("--swipe-skip:").length - 1, 3, "Skip's grey set there and nowhere else");
  assert.match(html, /@media \(hover: none\) \{[^\n]*\.rs-ate:hover \{ opacity: 1 !important; \}/, "a touch screen keeps a tap's hover: what a tap that only closed a row touched shows no press (History stayed at 85%)");
  assert.match(html, /@media \(hover: none\) \{[^\n]*\.week \.rs-ate:hover, \.cal \.rs-ate:hover \{ background: transparent !important; \}/, "nor a lit day in the week or the month");
  assert.match(rule(".list li.w > button:focus-visible"), /outline-offset: -2px;/, "the keyboard's ring inside the row: the card clips what is outside it");
});

test("Skip asks first, through the sheet's own buttons: Skip workout skips the row's workout with its reason; Cancel, the backdrop and Escape skip nothing; a double tap's second tap does nothing", () => {
  const s = g.sheet, none = { shown: false, sheet: null, asking: false, skipped: false, reason: null, pending: false };
  assert.deepStrictEqual(s.go.ask, { shown: true, sheet: { id: "w1", reason: "" }, asking: true, skipped: false, reason: null, pending: false }, "the row's Skip: the sheet is up, for that workout, nothing skipped before the answer");
  assert.deepStrictEqual({ skipped: s.go.early.skipped, shown: s.go.early.shown }, { skipped: false, shown: true }, "Skip workout 340 ms after the sheet opened (the second tap of a double tap on Skip, up to 350 ms): nothing, the sheet stays");
  assert.deepStrictEqual(s.go.after, { shown: false, sheet: null, asking: false, skipped: true, reason: "Sick", pending: true, view: "client" }, "a reason, then Skip workout: that row's workout skipped with it (by the server's own rule), the sheet gone, the Workouts page where it was");
  assert.strictEqual(s.backdrop.early.shown, true, "the backdrop in the first 350 ms: nothing");
  assert.deepStrictEqual(s.backdrop.after, none, "after them the backdrop is Cancel");
  assert.deepStrictEqual(s.keep, none, "Cancel skips nothing");
  assert.deepStrictEqual(s.escape, none, "Escape is Cancel, as the other sheets take it");
  assert.deepStrictEqual(s.page.ask, { shown: true, sheet: { id: "w1", reason: "" }, asking: true }, "the workout page's own Skip workout asks, for its workout");
  assert.deepStrictEqual({ skipped: s.page.after.skipped, view: s.page.after.view }, { skipped: true, view: "training" }, "Skip workout then skips it, the page staying on it");
});

test("Skip on an open row the app draws closes the row first: the next tap, on Skip workout, is Skip workout's", () => {
  const s = g.openSkip;
  assert.strictEqual(s.opened, true, "a finger opened the row the app drew");
  assert.deepStrictEqual(s.tap, { cancelled: false, clicked: true }, "the tap on Skip is Skip's");
  assert.deepStrictEqual({ shown: s.then.shown, sheet: s.then.sheet, skipped: s.then.skipped }, { shown: true, sheet: { id: "w1", reason: "" }, skipped: false }, "its sheet, for the row's workout, nothing skipped yet");
  assert.deepStrictEqual(s.next, { cancelled: false, clicked: true }, "the next tap, on Skip workout, is Skip workout's (a row left open behind the sheet would take it only to close)");
  assert.deepStrictEqual(s.then.row, { open: false }, "the row was already closing as the sheet came up");
  assert.deepStrictEqual({ skipped: s.after.skipped, shown: s.after.shown, row: s.after.row }, { skipped: true, shown: false, row: null }, "skipped, the sheet gone, the row closed");
});

test("Reschedule on an open row the app draws closes the row first: the next tap, in the days, is the days'", () => {
  const r = g.openResched;
  assert.strictEqual(r.opened, true, "a finger opened the row the app drew");
  assert.deepStrictEqual(r.tap, { cancelled: false, clicked: true }, "the tap on Reschedule is Reschedule's");
  assert.strictEqual(r.picker, "Reschedule", "the days open, for the row's own workout (its dataset.tid)");
  assert.deepStrictEqual({ dayCancelled: r.dayCancelled, after: r.after }, { dayCancelled: false, after: null }, "a tap in the days is the days' (a row left open behind them would take it only to close)");
  assert.deepStrictEqual(r.then, { open: false }, "the row was already closing as the days came up");
  assert.deepStrictEqual({ atTap: r.armedAtTap, mid: r.armedMid }, { atTap: false, mid: false }, "a tap is no full swipe: the row closes as drawn, Reschedule's title and icon where they are");
});

test("a double tap on an open row's Reschedule: its second tap, on the days as they come up (the backdrop above them, Cancel), leaves them up and the day as it was, up to 350 ms; after them the same tap closes them", () => {
  const tapped = { cancelled: false, clicked: true };
  for (const k of ["backdrop", "cancel"]) {
    for (const gap of [120, 340]) assert.deepStrictEqual(g.dblResched[k + gap], { first: tapped, second: tapped, days: "Reschedule", dayKept: true }, k + ", " + gap + " ms after the first tap's click: the second tap reaches the days and leaves them up");
    assert.deepStrictEqual(g.dblResched[k + 360], { first: tapped, second: tapped, days: null, dayKept: true }, k + ", 360 ms after: it closes them");
  }
});

test("a double tap on an open row's Skip: its second tap, on a reason or on Cancel as the question comes up, picks no reason and closes nothing in its first 350 ms, as Skip workout, the backdrop and the days; after them the reason is picked and Cancel closes; a keyboard's Enter (detail 0) picks at once", () => {
  for (const gap of [120, 340]) assert.deepStrictEqual(g.dblSkip[gap], { reason: "", keepItLeavesItUp: true }, gap + " ms after the first tap's click: no reason picked, the question still up");
  assert.deepStrictEqual(g.dblSkip[360], { reason: "Injury", keepItLeavesItUp: false }, "360 ms after: the reason is picked, Cancel closes the question");
  assert.strictEqual(g.dblSkip.keyboard, "Sick", "a keyboard's Enter or VoiceOver (detail 0) picks a reason at once");
});

test("the two actions as a finger draws the row out, as measured on Reminders: Reschedule grows in first, then Skip; past the open width Skip fades and Reschedule stretches; armed, Skip at 30%; back out, Skip's insides ease back while Skip follows the row", () => {
  const L = g.look, W = 11.67 + 61 + 10.33 + 61 + 10.67, op = (v) => (v === "" || v == null ? 1 : Number(v));   // (no inline opacity: whole)
  const near = (v, want, msg) => assert.ok(Math.abs(Number(v) - want) < 0.01, msg + ": " + v + ", measured " + want);
  near(L[62].resched.op, 0.51, "x 62: Reschedule half grown, from half its capsule uncovered (41.17) to its whole slot (82)"); assert.strictEqual(L[62].resched.tf, "scale(0.510)", "size and opacity together");
  assert.strictEqual(L[62].skip.op, "0", "Skip not yet");
  near(L[134].skip.op, 0.51, "x 134: Skip half grown, from half its capsule uncovered (112.5) to its whole slot (154.67)");
  near(L[170].skip.op, 1 - 0.337 * (170 - W) / 30, "x 170: past the open width Skip fades with the row"); near(L[186].skip.op, 0.66, "x 186, 31 points past: Skip at 66%");
  near(L[254].skip.op, 0.53, "x 254, 99 points past: then 0.19% a point"); assert.strictEqual(L.wide420.skip, "0.3", "a wide row (not armed at 420): never under 30%");
  near(parseFloat(L[186].resched.w), 61 + 186 - W, "Reschedule stretches by the overshoot (its right edge stays)"); near(parseFloat(L[186].capW), 61 + 186 - W, "its capsule with it");
  assert.strictEqual(L[186].skip.w, "", "Skip never stretches");
  assert.strictEqual(L[286].armed, false, "not armed at 286"); assert.strictEqual(L[288].armed, true, "armed at 288 (368 - 81 = 287)");
  for (const x of [288, 330]) {
    assert.strictEqual(L[x].resched.op, "1", "x " + x + ", armed: Reschedule whole");
    for (const c of L[x].kids) near(op(L[x].skip.op) * op(c.op), 0.3, "x " + x + ", armed: Skip at 30% (itself times its insides)");
    assert.ok(L[x].kids.every((c) => c.tr === "opacity 150ms ease"), "its insides take the step to 30% over 150 ms");
  }
  assert.strictEqual(L[330].skip.op, L[288].skip.op, "armed, Skip itself holds the look it had as it armed");
  for (const x of [62, 134, 170, 186, 254, 286, 288, 330]) assert.strictEqual(L[x].skip.tr, "none", "x " + x + ": Skip itself follows the finger, no transition");
  for (const x of [286, 284, 272]) {
    const b = L.back[x];
    assert.strictEqual(b.armed, false, "back out of armed at " + x);
    near(b.skip.op, 0.72 - 0.0019 * (x - W), "back out of armed, x " + x + ": Skip follows the row"); assert.strictEqual(b.skip.tr, "none", "x " + x + ": with no transition");
    assert.ok(b.kids.every((c) => c.op === "" && c.tr === "opacity 150ms ease"), "x " + x + ": its insides back to whole, over 150 ms");
  }
  assert.deepStrictEqual(L.closed, { row: null, skip: { op: "", tr: "" }, kids: [{ op: "", tr: "" }, { op: "", tr: "" }] }, "closed: nothing left on Skip or its insides");
});

test("a larger Text Size: an action wider than its capsule grows in only once half of it (half the action) is uncovered", () => {
  assert.strictEqual(g.wide.resched58, "0", "Reschedule 97 wide (its 61 capsule centred in it): not yet at x 58 (half of it uncovered at 59.17)");
  assert.ok(Number(g.wide.resched62) > 0, "growing at x 62: " + g.wide.resched62);
  assert.strictEqual(g.wide.skip116, "0", "Skip by its own width the same way (80 wide: from 122)"); assert.ok(Number(g.wide.skip124) > 0, "growing at x 124: " + g.wide.skip124);
  assert.ok(Math.abs(Number(g.wide.resched110) - (110 - 59.17) / (118 - 59.17)) < 0.01, "Reschedule 97 wide grows until its whole slot is uncovered (118, not its capsule's 82): at x 110 " + g.wide.resched110);
  assert.strictEqual(g.wide.skip146, "0", "Skip beside it (61, it fits) not yet at x 146: half of it is uncovered at 148.5, past the wider slot"); assert.ok(Number(g.wide.skip150) > 0, "growing at x 150: " + g.wide.skip150);
});

test("a sync's redraw and a row: the open row drawn anew is simply there (no fade in from white at every sync); a row brought back to closed loses its grey; a scroll from the open row closes it before a waiting redraw", () => {
  assert.deepStrictEqual(g.redrawOpen, { greyLaidOutWith: "none", open: true }, "the new row is laid out grey with no transition, and is the open one");
  assert.deepStrictEqual(g.closedGrey, { grey: false, row: null }, "a mouse drag out and back, then two fingers to the right within its settle: closed and not grey");
  for (const how of ["slanted", "straight", "pageScrolled"]) {
    assert.strictEqual(g.waiting[how].row, null, how + ": the scroll closes the open row (the redraw waits for it)");
    assert.strictEqual(g.waiting[how].renders, 1, how + ": then the redraw that waited comes, once");
  }
});

test("on a trackpad, while Safari still coasts after a let-go: gentle moves back the other way are new fingers (the row follows them and closes); so is a swipe that speeds up again over another row", () => {
  assert.ok(g.coast.openThen && g.coast.backTo < 40, "one point at a time back to the right on the open row: it follows them, to " + g.coast.backTo);
  assert.strictEqual(g.coast.after, null, "and closes, let go short of half its actions");
  assert.ok(g.coast.speedUp.moved > 0 && g.coast.speedUp.open === "w2", "the other row moves (" + g.coast.speedUp.moved + ") and is the one open");
});

test("two fingers to the right on a Mac go back over what only a finger slides (a set track whose sets fit, the week strip); a set track that can scroll back keeps them", () => {
  assert.deepStrictEqual(g.overTrack.fits, { view: "client", kept: 54 }, "over a set track whose sets fit: back, all of it kept from the browser");
  assert.deepStrictEqual(g.overWeek, { view: "clients", kept: 54 }, "over the week strip on a client's page: back to Clients");
  assert.deepStrictEqual(g.overTrack.scrolled, { view: "training", kept: 0 }, "over a set track scrolled 120 px: its own scroll, nothing kept from the browser from the first event");
  assert.deepStrictEqual(g.overTrack.longAtStart, { view: "client", kept: 54 }, "over a long set track still at its start (nothing to scroll back): back");
});

test("a mouse on a Mac: a drag whose last move already says no button is let go there (its click opens nothing, armed it still opens the days); a click on the open row that wobbles up or down only closes it", () => {
  assert.deepStrictEqual(g.noButton, { full: { clickEaten: true, picker: "Reschedule" }, open: { clickEaten: true, open: true } }, "a full drag: its click opens no workout and the days open (armed before that move); a drag that opens the row: open, its click opens no workout");
  for (const k of ["0,6", "2,7", "4,9", "-5,12"]) assert.deepStrictEqual(g.wobble[k], { was: true, eaten: true, closed: true }, "a click on the open row moving " + k + ": it only closes, its click goes nowhere");
  assert.deepStrictEqual(g.clickNoButton, { was: true, eaten: true, closed: true }, "a click on the open row whose small move already says no button: it only closes, its click goes nowhere");
  assert.deepStrictEqual({ ...g.dragOpenRow, maxX: g.dragOpenRow.maxX >= 287 }, { was: true, maxX: true, eaten: true, picker: "Reschedule" }, "a press on the open row that drifts down, then goes sideways, still drags it, on to the days (" + g.dragOpenRow.maxX + ")");
});

test("on a trackpad a slow slanted scroll over a row stays a scroll; a row swiped just after a slanted scroll still moves", () => {
  assert.ok(g.slowSlant.kept <= 4 && g.slowSlant.row === null, "40 events of 1 across and 0.6 down: " + g.slowSlant.kept + " kept from the page (only while still undecided), the row never moving");
  assert.ok(g.slowSlant.rowAfter.moved > 0 && g.slowSlant.rowAfter.open, "a row swiped 40 ms after a scroll 35 degrees off vertical moves and opens");
});

test("a swipe back on a Mac started while typing: the typing look goes with the field, so this page's tab bar slides with the page from the first frame", () => {
  assert.strictEqual(g.typingBack.typing, true, "typing: the tab bar was hidden");
  const f = g.typingBack.first, m = f && /^translate3d\(([\d.]+)px,0,0\)$/.exec(f.dock);
  assert.deepStrictEqual({ started: !!f, typing: f && f.typing, slides: !!m && Number(m[1]) > 0, view: g.typingBack.view }, { started: true, typing: false, slides: true, view: "client" }, "from the page's first frame the typing look is off and the tab bar moves with it (" + (f && f.dock) + "); back");
});

test("a workout with nothing added yet: the client's page offers Skip workout as its row does (no Finish); skipped through the sheet, its page shows Skipped with Undo; the trainer's own page offers Skip workout too, as his row does", () => {
  const c = g.empty.client, k = g.empty.coach, skippedPage = { area: true, finishBtn: false, skipBtn: false, skippedLine: true, more: false };
  assert.deepStrictEqual(c.before, { area: true, finishBtn: false, skipBtn: true, skippedLine: false, more: true }, "the client's page: Skip workout and its \"…\", no Finish (nothing to finish)");
  assert.deepStrictEqual(c.skipped.w1, { skipped: true, reason: "Sick", pending: true }, "skipped from its row, through the sheet");
  assert.deepStrictEqual({ page: c.skipped.page, text: c.skipped.text }, { page: skippedPage, text: "Skipped · Sick" }, "its page (from History): the Skipped line with its reason and Undo, as the sheet promised");
  assert.deepStrictEqual(c.undone, { page: c.before, w1: { skipped: false, reason: null, pending: true } }, "Undo brings it back, to the page it had");
  assert.deepStrictEqual(k.toDo, { area: true, finishBtn: false, skipBtn: true, skippedLine: false, more: true }, "the trainer's own page of an empty workout still to do: Skip workout, as its row in his view now skips it (no Finish: nothing to finish), and his \"…\" (Reschedule, Delete workout)");
  assert.deepStrictEqual(k.skipped, { page: { ...skippedPage, more: true }, text: "Skipped · Sick" }, "one the client skipped: its Skipped line with Undo, and his \"…\" (Delete workout)");
});

test("the client's Undo, 24 hours from the finish or the skip: a tap within them undoes; a tap after them (the button still up from before) only takes the Undo away", () => {
  for (const k of ["finish", "skip"]) {
    const u = g.undoLate[k];
    assert.strictEqual(u.up, true, k + ": 23 hours on, the Undo is up");
    assert.deepStrictEqual(u.late, { kept: true, up: false, view: "training" }, k + ": tapped after the 24 hours: the workout stays " + (k === "finish" ? "finished" : "skipped") + ", the Undo goes, the page stays");
    assert.deepStrictEqual(u.inTime, { kept: false }, k + ": tapped within them: undone");
  }
});

test("a row taken up again while it still closes, after a touch moved another row, is that same row: taken up where it is, its actions behind it", () => {
  assert.strictEqual(g.backToFirst.caught, 30, "taken up where its closing spring has it on the screen, not from closed");
  assert.strictEqual(g.backToFirst.swipedMid, true, "its actions stay behind it while the finger drags it (its earlier close never takes them away)");
  assert.strictEqual(g.backToFirst.open, true); assert.strictEqual(g.backToFirst.swipedEnd, true, "let go open: open, with its actions");
});

test("a full swipe let go closes in its armed look: Reschedule's title stays gone and Skip's insides keep their share of 30% until the row has closed, while Skip itself fades with the closing row", () => {
  assert.strictEqual(g.fireLook.picker, "Reschedule");
  assert.strictEqual(g.fireLook.armedAtLift, true, "the lift keeps the armed look"); assert.strictEqual(g.fireLook.armedMid, true, "100 ms into the close too: the title never fades back in under the days");
  assert.ok(Number(g.fireLook.skipInside) > 0 && Number(g.fireLook.skipInside) < 1, "Skip's insides stay at their share of 30%: " + g.fireLook.skipInside);
  assert.strictEqual(g.fireLook.skipOwn, "0", "Skip itself fades with the closing row, on its spring (from 30% to nothing)");
  assert.strictEqual(g.fireLook.armedEnd, false, "closed: the row as it was drawn"); assert.strictEqual(g.fireLook.skipInsideEnd, "", "nothing left on Skip's insides");
});

test("a mouse: a release the page never heard (a menu took it) is no let-go, the drag is cancelled where it is; a move with no button and its pointerup right after it is the release", () => {
  assert.deepStrictEqual(g.lostRelease.lost, { picker: false, open: true }, "the pointer moving on 3 s later with no button: no days open, the row left open where the drag left it");
  assert.deepStrictEqual(g.lostRelease.late, { 50: "Reschedule", 90: "Reschedule", 110: null }, "its pointerup 50 or 90 ms after that move is the release; none within 100 ms: the release was lost");
  assert.deepStrictEqual(g.lostRelease.restThenLate, { picker: "Reschedule", clickEaten: true }, "a rest, then the late move and its pointerup: the release (armed: the days open), its click opening nothing");
});

test("natural scrolling turned off: two fingers to the right scroll a long set track, or the field typed in, toward its end while it can, and at its end are Safari's (its forward); two fingers to the left scroll it back, and at its start the page goes back (the field let go first)", () => {
  assert.deepStrictEqual(g.unnatural.trackAtStart, { view: "training", kept: 0 }, "a long set track at its start: its own scroll, nothing kept from the browser");
  assert.deepStrictEqual(g.unnatural.trackAtEnd, { view: "training", kept: 0 }, "at its end: nothing of the app's (that way is Safari's forward on this Mac: ViewGestureController's scrollingDeltaX < 0)");
  assert.deepStrictEqual(g.unnatural.leftAtEnd, { view: "training", kept: 0 }, "fingers to the left over the track scrolled to its end: it scrolls back, its own");
  assert.deepStrictEqual(g.unnatural.leftAtStart, { view: "client", kept: 54 }, "fingers to the left with the track at its start: back, as Safari's own back goes on this Mac");
  assert.deepStrictEqual(g.unnatural.fieldCanScroll, { view: "training", kept: 0, blurred: 0 }, "the field typed in, its text able to scroll on: its own, the field kept");
  assert.deepStrictEqual(g.unnatural.fieldAtEnd, { view: "training", kept: 0, blurred: 0 }, "its text at its end, fingers to the right: nothing of the app's (Safari's forward)");
  assert.deepStrictEqual(g.unnatural.fieldLeftCanScroll, { view: "training", kept: 0, blurred: 0 }, "fingers to the left, its text able to scroll back: its own, the field kept");
  assert.deepStrictEqual(g.unnatural.fieldLeftAtStart, { view: "client", kept: 54, blurred: 1 }, "fingers to the left, its text at its start: back, the field let go first");
});

test("a quick diagonal scroll stays a scroll though Safari's coasting leans further sideways than the fingers did: no swipe back, no row moved; clearly sideways fingers after it still go back", () => {
  assert.deepStrictEqual(g.diagonal.page, { view: "training", kept: 0 }, "the workout page: the browser's scroll, all of it");
  assert.deepStrictEqual(g.diagonal.row, { maxX: 0, kept: 0, row: null }, "over a row: no row moves");
  assert.strictEqual(g.diagonal.thenSideways.view, "client", "new fingers right after it, clearly sideways: back");
  assert.strictEqual(g.diagonal.thenSideways.kept, 54, "every move of the new fingers kept from Safari, the first included (Safari starts its own swipe only on a gesture's first event): " + g.diagonal.thenSideways.kept);
  assert.deepStrictEqual(g.diagonal.tailPage, { view: "training", kept: 7 }, "its coasting's whole pixels, lone or two in a row past the scroll's own slant (never three), stay the scroll: no swipe back; only those few events kept from Safari");
  assert.deepStrictEqual(g.diagonal.tailRow, { maxX: 0, kept: 7, row: null }, "and over a row no row moves");
  assert.deepStrictEqual(g.diagonal.slant30, { page: { view: "training", slid: false }, row: { maxX: 0, row: null } }, "WebKit's own 30-degree flick (its coasting about 2.5:1, single events up to 4.5:1): a scroll, all of it");
  assert.strictEqual(g.diagonal.uprightThenTilted.view, "client", "after an upright scroll, new fingers 2.5:1 (sideways by the 2:1 rule) are new fingers: back");
});

test("the same row swiped open, closed, then swiped again, by a finger, a mouse and two fingers, has its actions behind it every time", () => {
  assert.deepStrictEqual(g.again, { first: true, finger: true, mouse: true, wheel: true });
});

test("a full swipe let go and caught again while it closes (its workout finished meanwhile, so no days) is a row on the move again, out of its armed look", () => {
  assert.deepStrictEqual(g.fireRegrab, { armedAtLift: true, picker: false, armedAfter: false });
});

test("three quick swipes back (a workout to Clients): the second, landing while the page still settles, goes nowhere, as on iPhone; the third, while the second still glides, is new fingers: the app's own slide, its first move kept from Safari", () => {
  assert.deepStrictEqual(g.tripleBack, { views: ["training", "client", "clients"], secondSlid: false, thirdFirstKept: true });
});

test("one slow swipe begun while the page still settles goes nowhere from its start to its end, as on iPhone: no slide starts part-way through it once the page has landed", () => {
  assert.deepStrictEqual(g.slowWhileSettling, { slid: false, view: "client" });
});

test("the trainer's view of a client's page (his pick): Reschedule from a row opens the days for any day, past days too, as his date on the workout page; the day picked is his own save; Skip asks first", () => {
  setup(false);
  assert.strictEqual(fns.rowReschedule("w1"), true);
  const dp = fns.datePicker();
  assert.ok(dp, "the days are open"); assert.strictEqual(dp.title, "Reschedule"); assert.strictEqual(dp.min, null, "any day: no first day allowed");
  assert.strictEqual(dp.ok(), true, "still the client's page, the workout still to do");
  dp.onPick(day(-3));
  assert.strictEqual(maps.trainings.get("w1").date, day(-3), "moved to a past day (a session that happened, entered afterwards)");
  assert.strictEqual(maps.pendingMove.has("w1"), false, "the trainer's own save, not the client's server rule");
  fns.closeDatePicker();
  assert.strictEqual(fns.moveWorkout("w1", day(-3)), false, "the same day again: nothing to save");
  setup(false);
  assert.strictEqual(fns.rowSkip("w1"), true); assert.deepStrictEqual(fns.skipSheet(), { id: "w1", reason: "" }, "Skip asks first, the same sheet");
  fns.closeSkip(); fns.setSkipped(true, "Sick", "w1");
  assert.ok(maps.trainings.get("w1").skippedAt); assert.strictEqual(maps.pendingSkip.has("w1"), false, "the trainer's own save");
  setup(false, { completedAt: "2026-11-02T18:00:00.000Z" });
  assert.strictEqual(fns.rowReschedule("w1"), false, "finished meanwhile: no days open"); assert.strictEqual(fns.moveWorkout("w1", day(2)), false, "nor does a pick move it");
  setup(true);
  assert.strictEqual(fns.rowReschedule("w1"), true); assert.strictEqual(fns.datePicker().min(), fns.today(), "the client's still from today on"); fns.closeDatePicker();
});

test("the trainer on a Mac: on a client's page two fingers open the row the app draws and stop, its Reschedule opens the days for any day; two fingers to the right over a closed row go back to Clients", () => {
  assert.deepStrictEqual(g.coachRow, { hasActions: true, opened: { open: true, x: 154.67, kept: 54 }, tap: { cancelled: false, clicked: true }, days: { title: "Reschedule", min: null }, rightOverRow: { view: "clients", kept: 54, row: null } });
});

test("a missed workout's row swipes to every row's three (his ask, 10 Nov: \"to keep it clean\"): Preview, Skip and outermost Reschedule, drawn out as Apple's two: each grows as its own slot is uncovered, past the open width the inner ones fade alike, armed both at 30%; let go armed, Reschedule's days (never Do it today)", () => {
  const T = g.three, W3 = 11.67 + 61 + 10.33 + 61 + 10.33 + 61 + 10.67, op = (v) => (v === "" || v == null ? 1 : Number(v));
  assert.ok(!T.error, T.error);
  const near = (v, want, msg) => assert.ok(Math.abs(Number(v) - want) < 0.01, msg + ": " + v + ", want " + want);
  assert.deepStrictEqual([T.classes, T.titles], [["swipe-act sa-prev", "swipe-act sa-skip", "swipe-act sa-resched"], ["Preview", "Skip", "Reschedule"]], "the row as the app draws it: Preview innermost, Reschedule outermost");
  near(T.w, W3, "open: the row's edge, the three 10.33 apart, the outer one's end");
  const L = T.look;
  near(L[62].ops[2], 0.51, "x 62: Reschedule half grown, as the outer one of two"); assert.deepStrictEqual(L[62].ops.slice(0, 2), ["0", "0"], "the others not yet");
  near(L[134].ops[1], (134 - 112.5) / (153.33 - 112.5), "x 134: Skip half grown in its own slot (82 + 30.5 to 82 + 61 + 10.33)"); assert.strictEqual(L[134].ops[0], "0", "Preview not yet"); assert.strictEqual(L[134].ops[2], "1", "Reschedule whole");
  near(L[206].ops[0], (206 - 183.83) / (W3 - 183.83), "x 206: Preview half grown in the last slot, to the open width"); assert.strictEqual(L[206].ops[1], "1");
  for (const k of [0, 1]) near(L[256].ops[k], 1 - 0.337, "x 256, 30 points past: both inner ones at 66%, as Skip of two");
  near(parseFloat(L[256].w), 61 + 256 - W3, "Reschedule stretches by the overshoot");
  assert.strictEqual(L[290].armed, true, "armed at 290 (368 - 81 = 287)");
  for (const k of [0, 1]) for (const c of L[290].kids[k]) near(op(L[290].ops[k]) * op(c), 0.3, "armed: each inner one at 30% (itself times its insides)");
  assert.strictEqual(L[290].ops[2], "1", "Reschedule whole");
  for (const x of [62, 134, 206, 256, 290]) assert.deepStrictEqual(L[x].parts, Array(2).fill("translate3d(-" + x + "px,0,0)"), "x " + x + ": the row and its \"…\" slide together");
  assert.deepStrictEqual(T.fired, { today: false, moved: false, days: true, closed: true }, "the full swipe: Reschedule's days, nothing moved to today, the row closed");
  assert.ok(T.cleared.length === 7 && T.cleared.every((c) => c.join("") === ""), "closed: nothing left on any of the three or the inner ones' insides " + JSON.stringify(T.cleared));
});

test("a sync's redraw with a missed workout's row open: the Missed card's new row for it stays open, as Today's and Up next's do", () => {
  assert.ok(!g.missRedraw.error, g.missRedraw.error);
  assert.deepStrictEqual(g.missRedraw, { openBefore: true, open: true });
});

test("a tap on an open missed row's Reschedule opens the days and moves nothing (only Today's button and the full swipe bring it to today)", () => {
  assert.ok(!g.missResched.error, g.missResched.error);
  assert.deepStrictEqual(g.missResched, { open: true, tap: { cancelled: false, clicked: true }, days: "Reschedule", date: true, moved: false });
});

test("the rows the app draws, whole (his pick, 10 Nov: Preview on the same swipe): Preview, Skip and outermost Reschedule, a missed one the same three (his ask, 10 Nov: Do it today in its \u2026); open at their widths; a tap on Preview opens the preview as the row closes", () => {
  const R = g.real; assert.ok(!R.error, R.error);
  const tapped = { tap: { cancelled: false, clicked: true }, preview: { id: "w1" }, row: null, days: false, moved: false };   // Preview's tap alone: never the row's own action (the days, Do it today) under it
  assert.deepStrictEqual(R.next, { classes: ["swipe-act sa-prev", "swipe-act sa-skip", "swipe-act sa-resched"], titles: ["Preview", "Skip", "Reschedule"], open: true, w: 226, tap: tapped }, "a workout: three, 11.67 + 3 x 61 + 2 x 10.33 + 10.67");
  assert.deepStrictEqual(R.missed, { classes: ["swipe-act sa-prev", "swipe-act sa-skip", "swipe-act sa-resched"], titles: ["Preview", "Skip", "Reschedule"], open: true, w: 226, tap: tapped }, "a missed one: the same three (no Today capsule)");
});
