// Touch and hold, the phone's right-click (his pick, 10 Nov: "do 4"): a finger held on a workout row, or on an exercise in the coach's view,
// opens the same menu its right-click and its "…" open, the way iOS 27.2 opens one (measured on its Contacts and Home Screen): the item lifts
// a little where it is from 0.1 s, at 0.4 s the page dims and the menu opens 16 under the item on its leading edge, the two moving up together
// where the menu would not fit. A release before then is a tap; 10 points of drift is a scroll or a swipe. The finger can slide onto a row and
// let go there; a tap on the lifted workout opens it; a tap anywhere else closes. The touches run in their own process (hold-menu-probe.mjs),
// whose document, window, menu, dimmed page and lifted copy keep their listeners.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test, assert } from "./assert.js";
import { load } from "./load.js";
const { fns } = await load();
const probe = path.join(path.dirname(fileURLToPath(import.meta.url)), "hold-menu-probe.mjs");
const r = JSON.parse(execFileSync(process.execPath, [probe], { encoding: "utf8", timeout: 60000 }).trim().split("\n").pop());
const ROW = ["Reschedule…", "Skip…"], EX = ["Alternate exercise…", "Add instructions…", "Delete exercise"];
const none = { open: false, menu: false, lifted: false, dim: false };
const brief = (s) => ({ open: !!(s.hold && s.hold.open), menu: s.menu, lifted: s.lifted, dim: s.dim });
const tf = (s) => { const m = /^translateY\(([-\d.e]+)px\) scale\(([\d.e]+)\)$/.exec(s || ""); return m ? { dy: +(+m[1]).toFixed(2), s: +(+m[2]).toFixed(4) } : s; };   // the lifted copy's move and scale, rounded
const css = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "index.html"), "utf8");
const src = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "app", "main.js"), "utf8");

test("held on a workout row: it lifts at 0.1 s, and at 0.4 s the page dims and its menu opens under it (the right-click's two)", () => {
  assert.deepStrictEqual(brief(r.row.at99), { ...none, lifted: false }, "0.099 s: nothing yet");
  assert.strictEqual(r.row.at101.lifted, true, "0.101 s: the row lifts");
  assert.strictEqual(r.row.at101.grown, "scale(1.035)", "growing 3.5%, as Apple's row grows by the time its menu comes (measured 3.6%)");
  assert.strictEqual(r.row.at399.menu, false, "0.399 s: no menu yet (measured: a hold of 0.35 s is still a tap)");
  assert.deepStrictEqual(brief(r.row.at401), { open: true, menu: true, lifted: true, dim: true }, "0.401 s: the menu, over the dimmed page, the row still lifted");
  assert.deepStrictEqual(r.row.at401.labels, ROW);
  assert.deepStrictEqual({ lift: r.row.at401.lift, hung: r.row.at401.hung }, { lift: true, hung: true }, "it grows from its corner, with no pointer drawn");
  assert.strictEqual(parseFloat(r.row.at401.place.left).toFixed(2), "10.56", "on the lifted row's leading edge");
  assert.strictEqual(parseFloat(r.row.at401.place.top).toFixed(2), "593.33", "16 under it");
  assert.deepStrictEqual(tf(r.row.at401.place.moved), { dy: 0, s: 1.035 }, "room below: the row stays where it is, grown");
  assert.strictEqual(r.row.at401.place.liftOff, "0px", "and its menu does not rise");
});

test("letting go after the menu came: no click on the row (the menu stays); the next tap's click is its own", () => {
  assert.strictEqual(r.row.release.kept, true, "the release is cancelled (WebKit then sends no click)");
  assert.strictEqual(r.row.release.clickEaten, true, "and a click that comes anyway goes nowhere");
  assert.strictEqual(r.row.release.secondClick, false, "only that one");
  assert.deepStrictEqual(brief(r.row.release), { open: true, menu: true, lifted: true, dim: true }, "the menu stays up, as Apple's");
  assert.strictEqual(r.row.stays.menu, true, "and is still there half a second later");
});

test("a tap on the dimmed page closes the menu: the row settles back, then is itself; a tap on the lifted workout opens it", () => {
  assert.deepStrictEqual({ menu: r.row.dimTap.menu, dim: r.row.dimTap.dim, back: r.row.dimTap.back, lifted: r.row.dimTap.lifted, dimShown: r.row.dimTap.dimShown }, { menu: false, dim: false, back: true, lifted: true, dimShown: true }, "the menu goes, the page brightens (the dim fading out), the row goes back into its place");
  assert.strictEqual(r.row.dimTap.headerBack, false, "settling back by a class of its own: the header's .back rules (its Back button's) never blank the copy");
  assert.deepStrictEqual(brief(r.row.dimTap.after), none, "and 0.3 s on, the copy is gone");
  assert.strictEqual(r.row.dimTap.view, "client", "the tap pressed nothing under it");
  assert.deepStrictEqual({ view: r.row.liftTap.view, id: r.row.liftTap.id, menu: r.row.liftTap.menu }, { view: "training", id: "w1", menu: false }, "on the lifted row: the workout opens (measured: Contacts opens the contact)");
  assert.deepStrictEqual(r.row.noClick, { at590: true, at610: false }, "a closing tap whose click never comes still closes, at 0.6 s");
  assert.deepStrictEqual(r.row.dimPress, { pdCancelled: false, mdEaten: false }, "over the dimmed page the closing press is not cancelled, nor its mousedown eaten (a cancelled one made iOS hold the tap's click 0.4 s and give it to what lay under)");
  assert.deepStrictEqual(brief(r.row.escape), none, "Escape closes it too");
});

test("not a hold: let go at 0.3 s (a tap, its click goes through), 12 points of drift, a second finger, the page scrolling", () => {
  assert.deepStrictEqual({ kept: r.row.early.kept, clickEaten: r.row.early.clickEaten, ...brief(r.row.early) }, { kept: false, clickEaten: false, ...none }, "a tap");
  assert.deepStrictEqual(brief(r.row.drift8), { open: true, menu: true, lifted: true, dim: true }, "8.6 points of drift: still a hold (measured: 8 keep it)");
  assert.strictEqual(r.row.drift8.moveKept, false, "and before the menu a move stays the page's (a scroll can begin)");
  assert.deepStrictEqual(brief(r.row.drift12), none, "12 points: a scroll or a swipe, the lifted copy down at once (measured: 16 lose it)");
  assert.deepStrictEqual(brief(r.row.twoFingers), none, "a second finger");
  assert.deepStrictEqual(brief(r.row.scrolled), none, "the page scrolled under the finger");
});

test("no hold on the swipe's own buttons, while a bubble or menu is up, while typing, or on a row with nothing left to do", () => {
  assert.deepStrictEqual(brief(r.row.onAction), none, "the swipe's buttons");
  assert.strictEqual(r.row.underBubble.holdNone, true, "a bubble up: the touch is its dismissal");
  assert.deepStrictEqual(brief(r.row.typing), none, "the keyboard up");
  assert.deepStrictEqual(brief(r.row.finished), none, "finished meanwhile");
  assert.deepStrictEqual(brief(r.row.finishedDuring), none, "finished during the hold (a sync): no menu, and its copy is down");
  assert.deepStrictEqual(brief(r.row.typingLift), none, "typing: not even the lift");
  assert.deepStrictEqual(brief(r.row.bubbleLift), { ...none, menu: true }, "a bubble up: not even the lift (the bubble is the menu up)");
  assert.deepStrictEqual(r.row.sideways, { swipe: null, menu: true }, "the finger going sideways after the menu came: the row does not slide under it");
});

test("sliding onto a row of the menu lights it, and letting go there picks it; sliding off again picks nothing and the menu stays", () => {
  assert.deepStrictEqual({ over1: r.row.slide.over1, over2: r.row.slide.over2 }, { over1: false, over2: true }, "lit only under the finger");
  assert.deepStrictEqual(r.row.slide.movesKept, [true, true], "once the menu is up the finger's moves are its own: the page never scrolls under it (a scroll would close it)");
  assert.deepStrictEqual({ liftedAtPick: r.row.slide.liftedAtPick, dimAtPick: r.row.slide.dimAtPick }, { liftedAtPick: false, dimAtPick: true }, "picked: the copy goes at once, the page brightens over its fade");
  assert.deepStrictEqual({ kept: r.row.slide.kept, sheet: r.row.slide.sheet, asking: r.row.slide.asking, menu: r.row.slide.menu, overOff: r.row.slide.overOff }, { kept: true, sheet: true, asking: true, menu: false, overOff: true }, "Skip… picked: its question, the menu gone");
  assert.deepStrictEqual({ over: r.row.slideOff.over, off: r.row.slideOff.off, picker: r.row.slideOff.picker, menu: r.row.slideOff.menu }, { over: true, off: true, picker: false, menu: true }, "off again: nothing, and the menu stays");
});

test("Android's own long press (its contextmenu) never closes the held menu or shows over it; a mouse's right-click elsewhere closes it", () => {
  assert.deepStrictEqual({ kept: r.row.androidMenu.kept, menu: r.row.androidMenu.menu }, { kept: true, menu: true }, "after the menu came");
  assert.deepStrictEqual({ kept: r.row.androidEarly.kept, menu: r.row.androidEarly.menu }, { kept: true, menu: true }, "before it: the hold goes on");
  assert.deepStrictEqual(r.row.androidAlone, { kept: false, menu: false }, "with no hold under way it stays the browser's");
  assert.deepStrictEqual(r.row.mouseCtx, { closed: true });
});

test("the lifted copy is the item's own look: in a copy of its list or card (for the styles), a node of its own, its width, no ids", () => {
  assert.deepStrictEqual(r.row.copy, { wrap: "UL list true", row: "w swipe-row", sameNode: false, width: "368px", border: "1px solid transparent", platter: "" }, "a row not first in its list keeps its hairline's room (its words do not jump a point), on the row's own card colour");
  assert.deepStrictEqual(r.ex.washed, { platter: "linear-gradient(rgba(60, 122, 78, 0.08), rgba(60, 122, 78, 0.08)), var(--surface)", setlog: "none", altHidden: true, liveAlt: false }, "a finished card lifts in its fern wash over the page (not white); what its page hides stays hidden; its open list is not lifted with it");
  assert.strictEqual(r.ex.hold.platter, "linear-gradient(rgb(28, 28, 30), rgb(28, 28, 30)), var(--surface)", "a plain card: its own colour");
  const h = r.ex.hold;
  assert.deepStrictEqual(h.wraps, ["DIV block open", "DIV group multi"], "an exercise: in copies of its block and its group, with their states");
  assert.strictEqual(h.copied, true);
  assert.deepStrictEqual(h.fields, [{ value: "2b", disabled: true, tab: -1 }, { value: "Wide-grip dip", disabled: true, tab: -1 }, { value: "12", disabled: true, tab: -1 }], "what is typed, in fields that are switched off (iOS took the copy's for real ones: its magnifier came up)");
  assert.deepStrictEqual({ frames: h.frames, ids: h.ids, width: h.width, margin: h.margin }, { frames: 0, ids: 0, width: "347px", margin: "0" }, "a playing video is not loaded again; no id twice on the page");
});

test("held on a coach's exercise: its … menu under it, Delete exercise picked from it; never on a field or in its open video", () => {
  assert.deepStrictEqual(r.ex.hold.labels, EX);
  assert.deepStrictEqual(r.ex.hold.picked, ["remove"]);
  assert.deepStrictEqual(brief(r.ex.hold.after), none, "picked: the menu and the copy gone");
  assert.deepStrictEqual(r.ex.hold.atPick, { lifted: false, dimShown: true, dimOn: false }, "the copy at once (not over what the pick opens, or the page it glides), the dim fading out");
  assert.strictEqual(r.ex.hold.after.dimShown, false, "and 0.3 s on, the dim gone too");
  assert.deepStrictEqual(brief(r.ex.onField), none, "a field: iOS's own (its loupe and caret)");
  assert.deepStrictEqual(brief(r.ex.inPlayer), none, "its open video");
  assert.deepStrictEqual(r.ex.onMore.labels, EX, "its … held: the same menu");
});

test("the review's findings (10 Nov): a menu that comes under a still finger picks nothing; a box that is a field is never held; a swipe that took the finger keeps it", () => {
  const u = r.row.stillUnder;
  assert.strictEqual(u.underMenu, true, "(held near the bottom, the row and its menu moved up: the menu lies under the finger)");
  assert.deepStrictEqual({ lit: u.lit, litJitter: u.litJitter, picked: u.picked, menu: u.menu, kept: u.kept }, { lit: false, litJitter: false, picked: false, menu: true, kept: true }, "letting go there, or a tremble of the finger, picks nothing: only a finger that moves after the menu came picks, and the menu stays");
  assert.strictEqual(r.row.jitterKept, true, "even a tremble that is no slide is the menu's (the page does not move)");
  assert.deepStrictEqual(r.row.slidBack, { kept: true, picked: true }, "slid away and back onto a row: that row");
  assert.deepStrictEqual({ kept: r.row.closedUnder.kept, clickEaten: r.row.closedUnder.clickEaten }, { kept: true, clickEaten: true }, "the menu closed while the finger was still down (Escape, a turn of the phone): its release still clicks nothing");
  assert.deepStrictEqual({ swipe: r.row.swipeFirst.swipe, menu: r.row.swipeFirst.menu, lifted: r.row.swipeFirst.lifted }, { swipe: true, menu: false, lifted: false }, "the row's swipe took the finger 9 points to the left just before 0.4 s: no menu, the swipe keeps the row");
  assert.deepStrictEqual(r.row.liftTapNow, { view: "training", lifted: false, dim: false }, "a tap on the lifted workout: it opens with the copy and the dim already gone");
  assert.deepStrictEqual(brief(r.ex.onChip.lift150), none, "a box that is a field (Reps, Rest, a set's Weight): not lifted at 0.15 s (a slow tap that opens its field)");
  assert.deepStrictEqual(brief(r.ex.onChip.at600), none, "nor a menu at 0.6 s");
  assert.deepStrictEqual(brief(r.ex.onTiles), none, "the tempo's tiles: the tempo field's");
});

test("where a held item and its menu go (liftPlace): under it on its leading edge; up together near the bottom; a tall card shrinks to fit", () => {
  const vw = 402, vh = 812, top0 = 16, bot0 = 50, row = { left: 17, top: 500, width: 368, height: 76 };
  const a = fns.liftPlace(row, 243, 108, vw, vh, top0, bot0, 1.035);
  assert.deepStrictEqual({ dy: a.dy, s: a.s }, { dy: 0, s: 1.035 }, "room below: it stays where it is, grown");
  assert.strictEqual(+a.left.toFixed(2), 10.56); assert.strictEqual(+a.top.toFixed(2), 593.33);
  const b = fns.liftPlace({ ...row, top: 740 }, 243, 108, vw, vh, top0, bot0, 1.035);
  assert.strictEqual(b.top + 108, vh - bot0, "near the bottom: the menu's foot on the bottom margin (measured: 17 above the home indicator)");
  assert.strictEqual(+(b.vis.bottom + 16).toFixed(6), +b.top.toFixed(6), "and the row 16 above it");
  assert.ok(b.dy < 0, "the row moved up");
  const c = fns.liftPlace({ left: 27, top: 300, width: 347, height: 900 }, 243, 160, vw, vh, top0, bot0, 1.035);
  assert.ok(c.s < 1, "a card taller than the room shrinks");
  assert.strictEqual(+c.vis.top.toFixed(6), top0, "from the top margin");
  assert.strictEqual(+(c.top + 160).toFixed(6), vh - bot0, "its menu ending on the bottom margin");
  const d = fns.liftPlace({ left: 300, top: 200, width: 90, height: 40 }, 243, 108, vw, vh, top0, bot0, 1.035);
  assert.strictEqual(d.left, vw - 243 - 8, "a menu wider than the room to its right keeps 8 from the edge");
  const e = fns.liftPlace({ left: 17, top: -40, width: 368, height: 76 }, 243, 108, vw, vh, top0, bot0, 1.035);
  assert.strictEqual(+e.vis.top.toFixed(6), top0, "an item half under the top comes down into view");
  const f = fns.liftPlace({ left: 27, top: 100, width: 600, height: 900 }, 243, 160, 874, 402, 16, 37, 1.035);   // the phone on its side (402 tall), a 900-point card: it shrinks as far as it must
  assert.ok(f.top + 160 <= 402 - 37 + 1e-9, "its menu stays on the screen");
  assert.ok(f.vis.bottom <= f.top + 1e-9, "and the card above it");
  const g = fns.liftPlace({ left: 27, top: 100, width: 600, height: 4000 }, 243, 160, 874, 402, 16, 37, 1.035);   // a card so tall it cannot shrink enough (an open video and every set, on its side)
  assert.strictEqual(+(g.top + 160).toFixed(6), 402 - 37, "the menu still ends on the bottom margin, over the card's foot if it must");
});

test("a sync's redraw while the menu is up and its finger still down waits for that finger (its release stays the hold's), and comes once its click would have", () => {
  assert.deepStrictEqual(r.row.redraw, { whileDown: 0, atUp: 0, at399: 0, at401: 1 }, "rebuilt 0.4 s after the release, never under the finger (its release would reach nothing, and iOS click what lies under)");
  assert.deepStrictEqual(r.row.redrawGone, { gone: 0, listening: 3, afterUp: 1, after: 0 }, "the menu gone (Escape, a turn) with the finger still down: it still waits, and the finger is still heard on its row");
  assert.deepStrictEqual(r.row.redrawCap, { first: 0, at9_9s: 0, after10s: 1 }, "still waiting 9.9 s after the menu came (a finger resting on it); a release that never came holds nothing after 10 s");
  assert.deepStrictEqual(r.row.detached, { before: 3, moveKept: true, kept: true, clickEaten: true, down: false, after: 0, atUp: 0, at401: 1 }, "a redraw that does not wait took the row out of the page: its moves and release are heard on the row itself, the release cancelled and its click eaten, the listeners go with it, and a sync's redraw that waited comes 0.4 s on");
  assert.strictEqual(r.row.tapLets, 0, "a tap's listeners on its row go with it");
  assert.deepStrictEqual(r.row.lostRelease, { drawn: 1, listening: 0 }, "a release that never reached the app: the next lone touch lets go of it (a redraw goes through, the old listeners go)");
  assert.deepStrictEqual(r.row.closeAfterRedraw, { redrawn: 1, menu: false, lifted: false }, "the waited redraw came while the menu was up (the row rebuilt): the close takes the copy at once, it does not settle onto a row that is gone");
});

test("a second finger while the hold's finger is still down clears nothing of that finger's (only a lone touch says no earlier finger is down)", () => {
  assert.deepStrictEqual(r.row.secondFinger, { redrawnAtFinger2: 0, listening: 3, releaseCancelled: true, clickEaten: true }, "the menu up, a sync waiting, a second finger taps the dim: no redraw under the first finger, still heard on its row, its release cancelled and its click eaten");
  assert.deepStrictEqual(r.row.secondFingerGone, { releaseCancelled: true, clickEaten: true }, "the menu gone first, another finger comes and goes: the first finger's release still clicks nothing");
});

test("a touchcancel after the menu came (the system took the finger: a call, Siri, the side button) lets go as a release does, and picks nothing", () => {
  assert.deepStrictEqual(r.row.cancelOpen, { drawn: 1, listening: 0, down: false, menu: true }, "the menu up: a sync's redraw that waited comes, the row's listeners go, the menu stays");
  assert.deepStrictEqual(r.row.cancelGone, { drawn: 1, listening: 0 }, "the menu gone first (Escape): the same");
  const slid = { lit: true, litAfter: false, down: false, listening: 0, litLater: false, asking: false, menu: true };
  assert.deepStrictEqual(r.row.cancelSlid, slid, "slid onto Skip… and cancelled there (the menu still rising): nothing picked, the row unlit and not lit again by the rise's frames, the menu stays");
  assert.deepStrictEqual(r.row.cancelSlidDetached, slid, "the same with the row taken out of the page: the cancel heard on the row itself");
});

test("the menu still rising into its place under a finger that slid onto it: the row under the finger lights frame by frame, and letting go picks the row that is lit", () => {
  assert.deepStrictEqual(r.row.rise.settled, { atSlide: "Reschedule…", lit: "Skip…", under: "Skip…", picked: "Skip…" }, "the finger rests while the rows rise under it: the row now under it is lit, and that is the one picked (never a lit row and another picked)");
  assert.deepStrictEqual(r.row.rise.between, { atSlide: "Reschedule…", lit: "Reschedule…", under: "Skip…", picked: "Reschedule…" }, "let go just after the next row came under the finger, before a frame showed it: the row it saw lit");
  const riseMs = +(/liftRise\s+(\d+)ms/.exec(css) || [])[1], lpRise = +(/LP_RISE = (\d+)/.exec(src) || [])[1];
  assert.ok(riseMs > 0 && lpRise >= riseMs + 16, "the rows are followed for as long as the menu rises (liftRise), and a frame more");
});

test("the row's swipe or the swipe back taking the finger lets the hold go on that very move, lifted or not; the menu up, neither starts", () => {
  assert.deepStrictEqual({ swipe: r.row.takenEarly.swipe, atTake: brief(r.row.takenEarly.atTake), at150: brief(r.row.takenEarly.at150) }, { swipe: true, atTake: none, at150: none }, "the row's swipe took it at 0.05 s: no copy lifts at 0.1 s");
  assert.deepStrictEqual({ lifted: r.row.takenLate.lifted, swipe: r.row.takenLate.swipe, now: brief(r.row.takenLate.now) }, { lifted: true, swipe: true, now: none }, "lifted, then taken: the copy is down on that move, not at 0.4 s");
  assert.deepStrictEqual({ held: r.row.backEarly.held, atTake: brief(r.row.backEarly.atTake), at150: brief(r.row.backEarly.at150) }, { held: true, atTake: none, at150: none }, "the swipe back took it at 0.05 s");
  assert.deepStrictEqual({ lifted: r.row.backLate.lifted, held: r.row.backLate.held, now: brief(r.row.backLate.now) }, { lifted: true, held: true, now: none }, "lifted, then the swipe back took it");
  assert.deepStrictEqual(r.row.backAfterMenu, { sw: null, menu: true }, "after the menu came, a slide to the right never starts the swipe back under it");
  assert.deepStrictEqual({ settling: r.row.whileSettling.settling, hold: r.row.whileSettling.hold, at150: brief(r.row.whileSettling.at150) }, { settling: true, hold: null, at150: none }, "while the pages settle from a swipe back, a touch holds nothing");
  assert.deepStrictEqual({ open: r.row.rowOpen.open, hold: r.row.rowOpen.hold, at500: brief(r.row.rowOpen.at500) }, { open: true, hold: null, at500: none }, "a row swiped open: a touch only closes it");
});

test("during the hold: the phone turned closes the menu (the copy, its item moved, goes at once); typing or a question coming stops the menu", () => {
  assert.deepStrictEqual({ menu: r.row.turned.menu, lifted: r.row.turned.lifted, dimShown: r.row.turned.dimShown }, { menu: false, lifted: false, dimShown: true }, "turned: closed, the copy gone at once (its item is elsewhere now), the dim fading");
  assert.deepStrictEqual(r.row.turned.after, { lifted: false, dimShown: false });
  assert.deepStrictEqual(brief(r.row.typedDuring), none, "typing began during the hold: no menu");
  assert.deepStrictEqual(brief(r.row.askedDuring), none, "a question came during the hold: no menu");
});

test("after the menu: its copy settles back, but goes at once if the page moves under it or a new touch comes; the fading dim takes no touch", () => {
  assert.deepStrictEqual(r.row.settleScroll, { settling: true, lifted: false, dimShown: true, dimAfter: false }, "the page scrolled 0.05 s after the close: the copy at once, the dim fading on");
  assert.deepStrictEqual(r.row.settleResize, { settling: true, lifted: false, dimShown: true, dimAfter: false }, "the phone turned 0.05 s after the close: the copy at once, the dim fading on");
  assert.deepStrictEqual(r.row.settleTouch, { settling: true, lifted: false, hold: null, dimShown: true }, "a new touch during the settle: the copy at once, not over what that touch opens or scrolls; the dim fading on");
  const drawnAfter = { at250: { drawn: 0, settling: true }, at261: { drawn: 1, settling: false }, copyAtDraw: false };
  assert.deepStrictEqual(r.row.settleDraw.waited, drawnAfter, "a sync's redraw that waited for the finger, due 0.4 s after the release, waits for the settle and comes as the copy goes");
  assert.deepStrictEqual(r.row.settleDraw.during, drawnAfter, "a sync that comes during the settle: the same (the copy never slides back over a row that is no longer there)");
  assert.deepStrictEqual(r.row.scrolledShut, { menu: false, lifted: false }, "a scroll that closed the menu moved the row: its copy does not settle onto the old place");
  assert.ok(/#ctxDim:not\(\.on\)\s*\{\s*pointer-events:\s*none;/.test(css), "once its menu went the dim takes no touch: a tap, a scroll or a hold right after goes to the page");
  assert.ok(/#ctxLift\.lp-back\s*\{/.test(css) && !/#ctxLift\.back\b/.test(css), "the settling class is its own (.back is the header's Back button, whose rules blanked the copy)");
});

test("let go, then a new finger's tap 0.15 s later (no click came for the release, so its eater is armed): the tap is its own", () => {
  assert.deepStrictEqual(r.row.quickDim, { menu: false, view: "client", eaten: false }, "a tap on the dimmed page closes the menu, pressing nothing under it");
  assert.deepStrictEqual(r.row.quickLift, { view: "training" }, "a tap on the lifted workout opens it");
  assert.deepStrictEqual(r.row.quickSkip, { asking: true, sheet: true, menu: false, lifted: false }, "a tap on Skip… asks, and the copy is gone");
});

test("near the bottom the row and its menu move up together: the copy where a tap opens the workout, the menu rising with it 16 under it; a tall card shrinks", () => {
  assert.deepStrictEqual(tf(r.row.low.moved), { dy: -179.33, s: 1.035 }, "the row moved up 179 points");
  assert.strictEqual(r.row.low.top, "654px", "its menu's foot on the bottom margin");
  assert.strictEqual(parseFloat(r.row.low.liftOff).toFixed(2), "179.33", "the menu starts as far lower as the row's foot and rises with it (liftRise): never over the row");
  assert.deepStrictEqual(r.row.lowTap, { onCopy: "training", wasThere: "client" }, "a tap on the moved copy opens the workout; where the row was, a tap only closes");
  assert.deepStrictEqual(tf(r.ex.tall.moved), { dy: -223, s: 0.6911 }, "a 900-point card shrinks to fit over its menu, from the top margin");
  assert.strictEqual(r.ex.tall.top, "654px", "its menu on the bottom margin");
  assert.strictEqual(parseFloat(r.ex.tall.liftOff).toFixed(2), "377.75", "and rising with the card's foot");
  const ctxT = /#ctxLift\s*\{[^}]*transition:\s*transform\s+(\d+ms)\s+(cubic-bezier\([^)]*\))/.exec(css), rise = /#whenPop\.menu\.lift\s*\{[^}]*liftRise\s+(\d+ms)\s+(cubic-bezier\([^)]*\))/.exec(css);
  assert.ok(ctxT && rise && ctxT[1] === rise[1] && ctxT[2] === rise[2], "the menu rises on the copy's own time and curve");
  assert.ok(/@keyframes liftRise\s*\{\s*from\s*\{\s*translate:\s*0 var\(--lift-off, 0px\);\s*\}\s*to\s*\{\s*translate:\s*0 0;\s*\}\s*\}/.test(css), "from as far lower as the copy's foot, to its place");
});

test("the menu is measured at its own size, not where the last bubble left it; a finger on a held item's menu never moves the page; on the Mac a coach's card stays selectable", () => {
  assert.strictEqual(r.row.measuredAt, "0px", "measured from the screen's left (where the last bubble stood, the edge would squeeze it taller)");
  assert.ok(/#whenPop\.lift\s*\{\s*touch-action:\s*none;\s*\}/.test(css), "a second finger dragging on the menu does not scroll the page (which would close it); measured: Apple's menu does not move the page either");
  assert.ok(/@media \(any-pointer: coarse\) \{[^\n]*\n\s*body:not\(\.client\) \.row \{[^}]*user-select: none;[^}]*\}[^\n]*\n\s*body:not\(\.client\) \.row input, body:not\(\.client\) \.row textarea \{[^}]*user-select: text;[^}]*\}[^\n]*\n\s*\}/.test(css), "the coach's card is unselectable only on a touch screen (iOS decides at the touch); on the Mac its words select as ever");
  assert.ok(!/^\s*body:not\(\.client\) \.row \{ -webkit-user-select: none/m.test(css.replace(/@media \(any-pointer: coarse\) \{[\s\S]*?\n  \}\n/, "")), "and nowhere outside it");
});
