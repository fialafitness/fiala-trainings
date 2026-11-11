// His asks, 11 Nov, with Calendar's event sheet beside them: "make sure the header .. the name of the workout and date is transparent just
// like apples in the calendar .. in both light and dark view", "also exactly like in calendar view if I swipe from top of the card down it
// closes the card .. do that too exactly like apple". Measured on the test iPhone (iOS 27.2, Calendar's event sheet, 11 Nov):
// - its header is 70 points from the sheet's top, the cross 16 in; at rest it is the sheet itself; once anything scrolls under it (fully by 10
//   points) it shows it blurred about 6 points and veiled (light 64% white: #f2f2f7 became #fafaff; dark #2c2c2e at 55%: #1c1c1e became
//   #242426), to a hard edge; the event's name comes into it, 17 semibold, at once, as the big title's letters start going under that edge;
// - a finger pulls the sheet from its header, and from its content when that is at its top; a scrolled list scrolls back first and the sheet
//   stays; two fingers pull it as one; it follows after 10 points; the dim lightens with the share pulled away; the list scrolls as its own
//   (here: iOS scrolls it, nothing on it is refused, and at its top and still it does not bounce there, so a pull from it moves the sheet
//   alone; checked on the test iPhone frame by frame, a quick flick from a still finger included);
// - let go, it closes when where it would coast to (the pull plus 0.099 s of its speed) is past half its height, or past a quarter for a fast
//   flick down (1,000 points a second or more, in a touch of 50 ms or more): the 26 releases played there with fingers at known speeds, timed
//   by the page's own touch clock, are the cases below; either way by a critically damped spring of 0.357 s from the finger's own speed
//   (three releases fitted within 1.3 points).
// The fingers play in their own process (preview-swipe-probe.mjs), whose sheet, header and list keep their listeners and styles.
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test, assert } from "./assert.js";
import { load } from "./load.js";
const { fns } = await load();
const probe = path.join(path.dirname(fileURLToPath(import.meta.url)), "preview-swipe-probe.mjs");
const r = JSON.parse(execFileSync(process.execPath, [probe], { encoding: "utf8", timeout: 60000 }).trim().split("\n").pop());
const SPRING = /^transform 4\d\dms cubic-bezier\(/;                       // the measured spring: 0.357 s, ending within half a percent
const CLOSED = ["translate3d(0,630px,0)", false], BACK = ["", true];       // let go: down past the sheet's foot (600 + 30) and closed, or home
const outcome = (k) => [r[k].after.transform, r[k].settled.up];

test("the let-go, Calendar's sheet's rule: closed when where it would coast to (the pull and 0.099 s of its speed) is past half its height, or past a quarter for a fast flick down (1,000 points a second or more, in a touch of 50 ms or more); each of the 26 releases played there decides as it did", () => {
  const H = 812;                                                         // Calendar's sheet on the 402 x 874 test iPhone: from 62 to the bottom
  for (const [off, v, ms, want, what] of [
    [290, 0, 900, "back", "36%, slow"], [325, 0, 900, "back", "40%, slow"], [425, 0, 900, "close", "52%, slow"], [470, 0, 900, "close", "58%, slow"],
    [125, 1034, 145, "close", "125 at 1,034"], [155, 1034, 174, "close", "155 at 1,034"], [185, 1034, 203, "close", "185 at 1,034"], [95, 1034, 116, "back", "95 at 1,034: coasts to 197, short of a quarter"],
    [95, 2070, 58, "close", "95 at 2,070 in 58 ms"], [150, 2070, 87, "close", "150 at 2,070"], [110, 2760, 80, "close", "110 at 2,760"], [50, 1517, 58, "back", "50 at 1,517: coasts to 200, short of a quarter"],
    [60, 2070, 44, "back", "2,070 from 60 in 44 ms"], [75, 2070, 44, "back", "2,070 from 75 in 44 ms"], [100, 2760, 44, "back", "2,760 from 100 in 44 ms: too quick a touch"],
    [187, 897, 232, "back", "897 from 187"], [189, 793, 261, "back", "793 from 189"], [327, 793, 435, "back", "793 from 327: coasts to 405.5"], [373, 793, 470, "close", "793 from 373: coasts to 452"],
    [305, 517, 609, "back", "517 from 305"], [80, 690, 145, "back", "690 from 80"],
    [500, -2070, 1300, "back", "past half, flicked up at 2,070"], [470, -1034, 1300, "back", "past half, flicked up at 1,034"], [494, -897, 1300, "back", "past half, flicked up at 897: coasts to 405.2"],
    [500, -517, 1300, "close", "past half, drifting up at 517"], [590, -1034, 1300, "close", "far past half, flicked up at 1,034: coasts to 488"]])
    assert.strictEqual(fns.pvDecide(off, v, H, ms), want, what);
  assert.deepStrictEqual([fns.pvDecide(406, 0, H, 900), fns.pvDecide(407, 0, H, 900)], ["back", "close"], "exactly half stays; past it closes");
  assert.deepStrictEqual([fns.pvDecide(200, 999, H, 100), fns.pvDecide(200, 1000, H, 100)], ["back", "close"], "the flick's 1,000 points a second");
  assert.deepStrictEqual([fns.pvDecide(104, 1000, H, 100), fns.pvDecide(105, 1000, H, 100)], ["back", "close"], "a fast flick: coasting to a quarter exactly (203) stays, past it closes");
  assert.deepStrictEqual([fns.pvDecide(200, 2000, H, 49), fns.pvDecide(200, 2000, H, 50)], ["back", "close"], "50 ms from touch to lift");
  assert.strictEqual(fns.pvDecide(300, -2000, H, 100), "back", "flung back up: back");
});

test("the header: at rest the sheet itself; once the list scrolls under it, see-through, fully by 10 points; the workout's name (written in it) comes in when the big title's letters go under its edge and goes at the top; whenever the sheet goes, the header is at rest for the next one (a spring back leaves it as the list is)", () => {
  assert.deepStrictEqual(r.header, { rest: { on: "0", titled: false }, five: { on: "0.5", titled: false }, ten: { on: "1", titled: false }, under: { on: "1", titled: false }, gone: { on: "1", titled: true }, back: { on: "0", titled: false } });
  assert.strictEqual(r.barText, "Legs");
  assert.deepStrictEqual(r.reopen, { titled: true, closed: { titled: false, on: "0" }, atShow: { titled: false, on: "0" }, now: { titled: false, on: "0" }, keptOnSpringBack: { titled: true, on: "1", up: true } });
});

test("a pull from the header: nothing refused in its first 10 points, so a tap on the cross that rolls a point stays a tap and a finger that rolls up first still pulls; then the sheet follows the finger, the dim lightening with the share of the sheet pulled away", () => {
  assert.deepStrictEqual(r.follow.first, { prevented: false, up: true, transform: "", dim: "", drag: { on: false, off: 0, top: true } });
  assert.deepStrictEqual(r.follow.second, { prevented: true, up: true, transform: "translate3d(0,20px,0)", dim: "rgba(0,0,0,0.4350)", drag: { on: true, off: 20, top: true } }, "30 points down: 20 pulled, the dim 45% x (1 - 20/600)");
  assert.deepStrictEqual(r.tap, { prevented: false, up: true, transform: "", dim: "", drag: null });
  assert.deepStrictEqual([r.headerRollUp.up3, r.headerRollUp.still, r.headerRollUp.prevented.every(Boolean), r.headerRollUp.during.transform], [false, { on: false, off: 0, top: true }, true, "translate3d(0,90px,0)"]);
});

test("let go slowly: short of half, back by the spring (the dim back to full); past half, closed by the same spring carrying on down (the dim gone), the preview closed after it; the header and the band outside the list pull whatever the list's place; iOS taking the touch settles it as a lift", () => {
  const back = r.slowBack, close = r.slowClose;
  assert.ok(back.prevented.every(Boolean) && back.during.transform === "translate3d(0,180px,0)", "180 pulled, all the finger's");
  assert.deepStrictEqual([back.after.transform, back.after.dim, back.settled], ["", "rgba(0,0,0,0.45)", { up: true, transform: "", dim: "", drag: null }], "back: to its place, then nothing left on it");
  assert.match(back.after.transition, SPRING); assert.strictEqual(back.after.dimTransition, back.after.transition.replace("transform", "background-color"), "the dim on the same spring");
  assert.deepStrictEqual([close.during.transform, close.after.transform, close.after.dim, close.settled.up, close.settled.transform], ["translate3d(0,330px,0)", "translate3d(0,630px,0)", "rgba(0,0,0,0)", false, ""], "330 of 600: down past the bottom, the dim gone, then closed and reset for the next time");
  assert.match(close.after.transition, SPRING);
  for (const k of ["headerScrolled", "fromButton"]) assert.deepStrictEqual(outcome(k), CLOSED, k);
  assert.strictEqual(r.headerScrolled.during.transform, "translate3d(0,330px,0)", "the list scrolled under the header: a pull on the header still moves the sheet");
  assert.deepStrictEqual([outcome("cancel"), r.cancel.after.transition.slice(0, 10)], [BACK, "transform "], "touchcancel: back by the spring");
});

test("flicks, as Calendar's sheet decides them: a fast flick closes once it would coast past a quarter (1,000 a second from 70 does, from 40 does not), any flick that would coast past half closes, a touch of 40 ms is too quick; the speed as WebKit hands the moves over (24 to 30 ms apart, the lift on the last one's moment), from 40 ms back, never back across a rest, none after a rest of over 60 ms", () => {
  for (const k of ["flickFast", "flickPast", "flickQuick50", "simFlick", "slowLast", "restFlick", "restBefore60", "driftUp"]) assert.deepStrictEqual(outcome(k), CLOSED, k);
  for (const k of ["flickSlow", "flickNear", "flickQuick", "restBefore", "flungUp"]) assert.deepStrictEqual(outcome(k), BACK, k);
  assert.deepStrictEqual(r.flungUp.during.transform, "translate3d(0,300px,0)", "let go at exactly half, flung back up: back (measured: past half, up at 897 and faster, it comes back)");
  assert.deepStrictEqual(r.driftUp.during.transform, "translate3d(0,370px,0)", "let go past half drifting up at 500: closed (measured: 517 closed)");
});

test("the spring starts at the finger's own speed: a close carries the flick on down (its exact spring), a slow flick that comes back dips below its place first, and a short fast one dips as far as its speed takes it (up to 40 sheet-distances a second away from its place, 15 toward it)", () => {
  const e = fns.springEase(2000 / 490, 0.357, 1); assert.strictEqual(r.flickFast.after.transition, "transform " + e.ms + "ms " + e.css, "2,000 a second over the 490 to go");
  assert.match(r.flickFast.after.transition, /cubic-bezier\(0\.\d+, 0\.\d+,/, "down, the way the finger went: no turn back up first");
  assert.match(r.flickSlow.after.transition, /cubic-bezier\(0\.\d+, -0\.\d+,/, "back from a flick down: a dip below 0 at first");
  const y1 = (k) => Number(/cubic-bezier\([\d.]+, (-?[\d.]+),/.exec(r[k].after.transition)[1]);
  assert.ok(y1("flickQuick") < -1, "2,000 a second from 70 (28.6 a second away): the dip not cut short at 15");
  const e15 = fns.springEase(15, 0.357, 1);
  assert.deepStrictEqual([r.flickUpNear.during.transform, r.flickUpNear.after.transform, r.flickUpNear.after.transition, r.flickUpNear.settled.up], ["translate3d(0,30px,0)", "", "transform " + e15.ms + "ms " + e15.css, true], "30 pulled, flicked back up (960 a second at the lift: 32 sheet-distances a second toward its place): home at 15, not snapped");
  assert.ok(e15.ms > 300, "home in over 300 ms");
});

test("the list scrolls as its own and nothing on it is refused: at its top and still, a pull from it is the sheet's (iOS cannot move the list down there: it does not bounce at its top), even once iOS's own scroll has the touch, and a quick flick from a still finger closes it; scrolled, it scrolls back first and the sheet stays; up, or once the list moves, the touch is the list's (a sheet it pulled back at its place); sideways is the slide's", () => {
  assert.deepStrictEqual([r.listTop.prevented.some(Boolean), r.listTop.during.transform, r.listTop.settled.up], [false, "translate3d(0,110px,0)", true], "the list at its top: the sheet follows, nothing refused");
  for (const k of ["listScrolled", "listUp"]) assert.deepStrictEqual([r[k].prevented.some(Boolean), r[k].during.transform, r[k].during.drag], [false, "", null], k + ": the list's own scroll, untouched");
  assert.deepStrictEqual(r.listRollUp, { prevented: [false, false, false, false], waiting: { on: false, off: 0, top: true }, still: { on: false, off: 0, top: true }, drag: null }, "up 1, then 5: still waiting; 15: the list's");
  assert.deepStrictEqual(r.listRollSide, { prevented: [false, false, false], drag: null }, "a point sideways, then up 20: the list's");
  assert.deepStrictEqual([r.listRollDown.prevented, r.listRollDown.waiting, r.listRollDown.during.transform, r.listRollDown.settled.up], [[false, false, false, false, false], { on: false, off: 0, top: true }, "translate3d(0,20px,0)", true], "a point down, then on: the sheet follows from 10, nothing refused");
  assert.deepStrictEqual([r.listNative.prevented, r.listNative.during.transform, r.listNative.settled.up], [[false, false, false, false], "translate3d(0,50px,0)", true], "iOS's own scroll has the touch (its moves no longer refusable): the sheet still follows");
  assert.deepStrictEqual([r.listFlick.prevented.some(Boolean), r.listFlick.during.transform, r.listFlick.after.transform, r.listFlick.settled.up], [false, "translate3d(0,180px,0)", "translate3d(0,630px,0)", false], "still, a point of roll, then a quick flick down: closed");
  const du = r.listDownUp;
  assert.deepStrictEqual([du.prevented.some(Boolean), du.down.transform, du.back.transform, du.back.drag, du.scrolled, du.settled.up, du.topped], [false, "translate3d(0,15px,0)", "", { on: true, off: 0, top: true }, { up: true, transform: "", dim: "", drag: null }, true, false], "pulled 15, back above its start: the sheet at its place; the list moves: the touch is its own, and it bounces at both ends again");
  const tb = r.listTurnBack;
  assert.deepStrictEqual([tb.prevented.some(Boolean), tb.before.transform, tb.at.transform, tb.at.drag, tb.settled.up, tb.settled.transform], [false, "translate3d(0,11px,0)", "", null, true, ""], "pulled from the list and turned back: as iOS takes the list (its own scroll began 10 points further down than the sheet's pull), the sheet goes home");
  const e15 = fns.springEase(15, 0.357, 1); assert.strictEqual(tb.at.transition, "transform " + e15.ms + "ms " + e15.css, "home by the spring from the finger's speed (up at 440 a second: the most toward its place, 15 sheet-distances a second), never a jump");
  assert.deepStrictEqual([r.sideways.prevented, r.sideways.transform, r.sideways.drag], [true, "", { on: false, off: 0, top: true }], "sideways within 30 degrees of level: the slide to the workout beside it (preview-pager.test.js), refused at once; never a pull");
  assert.deepStrictEqual(r.diagonal, { prevented: true, up: true, transform: "translate3d(0,20px,0)", dim: "rgba(0,0,0,0.4350)", drag: { on: true, off: 20, top: true } }, "16 sideways and 30 down in one move: more down than sideways, the sheet's");
  assert.deepStrictEqual(r.headerCoast, { up: true, transform: "translate3d(0,90px,0)", dim: "rgba(0,0,0,0.3825)", drag: { on: true, off: 90, top: true } }, "a pull on the header goes on while the list under it still coasts");
});

test("the list's top as iOS takes it: no bounce there at open; once the list scrolls it bounces at both ends again, and a pull from it waits; back at its top and still (its scroll's end, or a second after it last moved), never while a finger is on the sheet, the next pull from it is the sheet's once iOS has had 100 ms; a list with nothing to scroll is the sheet's, as the header (nothing behind moves), until a redraw gives it something to scroll", () => {
  assert.deepStrictEqual(r.topLife, { atOpen: true, scrolled: false, scrolledTouch: { prevented: false, drag: null, transform: "" }, backAtZero: false, afterEnd: true, soon: null, later: { drag: { on: true, off: 10, top: true }, transform: "translate3d(0,10px,0)" } });
  assert.deepStrictEqual(r.topWait, { at999: false, at1000: true, held: false, atLift: false, lift999: false, lift1000: true });
  assert.deepStrictEqual(r.lastMove, { bounce: false, bounceEnd: true, away: false, awayEnd: true }, "a second after its LAST move at its top: a bounce's later moves, or away and back, start the second again (never mid-bounce)");
  assert.deepStrictEqual(r.endRest, { atEnd: false, later: false }, "its scroll over at its end, not its top: it still bounces there");
  assert.deepStrictEqual(r.unsettled, { prevented: [false, false, false], up: true, transform: "", dim: "", drag: null }, "back at its top but not yet still: a pull from it is the list's (it may still bounce there), and the sheet stays");
  assert.strictEqual(r.cancelTop, true, "iOS cancelling a touch counts as its lift");
  assert.strictEqual(r.reopenFingers, true, "a touch whose end never came is forgotten when the sheet opens again");
  assert.strictEqual(r.twoOnCard, true, "two fingers on one card: each finger's lift is its own (the second's lift leaves the first's listener)");
  assert.deepStrictEqual(r.listTakenFar, { far: "translate3d(0,350px,0)", at: { transform: "", drag: null, sprung: true }, settled: { up: true, transform: "", dim: "", drag: null } }, "the list moves under a pull from it past half: the sheet goes home (the finger is still down; nothing is let go)");
  const e0 = fns.springEase(0, 0.357, 1); assert.deepStrictEqual(r.listTakenLate, { transition: "transform " + e0.ms + "ms " + e0.css, transform: "", settled: { up: true, transform: "", dim: "", drag: null } }, "the list's scroll reported as the finger goes down again: home from rest, never first further away");
  assert.deepStrictEqual(r.liftOnDetached, { painted: 1, atEnd: true, during: "translate3d(0,230px,0)", closed: true, left: 0 }, "a sync's redraw took the card from under a finger scrolling the list: its lift is heard on that card, so the next pull from the list's top is the sheet's");
  const f = r.fits; assert.deepStrictEqual([f.fits, f.prevented.every(Boolean), f.during.transform, f.upPrevented, f.upDrag, f.afterGrow], [true, true, "translate3d(0,90px,0)", false, { on: false, off: 0, top: true }, false]);
  assert.deepStrictEqual(r.turn, { fits: true, turned: false, back: true }, "a turn measures it again");
});

test("two fingers pull it as one, as Calendar's sheet (measured); a finger that joins or leaves mid-pull moves nothing, the pull carries on with the fingers left; up past where it started, the sheet stays at its place", () => {
  assert.deepStrictEqual([r.twoFingers.prevented, r.twoFingers.during.transform, r.twoFingers.after.transform, r.twoFingers.settled.up], [true, "translate3d(0,190px,0)", "", true]);
  const j = r.join; assert.deepStrictEqual([j.before.transform, j.atJoin.transform, j.both.transform, j.firstUp.transform, j.firstUp.drag.on, j.secondOn.transform, j.after.transform, j.settled.up],
    ["translate3d(0,140px,0)", "translate3d(0,140px,0)", "translate3d(0,160px,0)", "translate3d(0,160px,0)", true, "translate3d(0,180px,0)", "", true]);
  assert.deepStrictEqual([r.clamp.down.transform, r.clamp.up.transform, r.clamp.up.dim, r.clamp.up.drag.off], ["translate3d(0,50px,0)", "", "", 0]);
});

test("a sync's redraw waits while a finger is on the sheet and while it springs (the card under the finger is never rebuilt), then comes: at a tap's lift, when the touch turns out to be the list's, when the sheet closes, with Reduce Motion at the let-go; a touch that never came up holds it 10 s at the most; a card a redraw took out of the page all the same still passes its finger on, and lets go of it after", () => {
  assert.deepStrictEqual(r.syncHeld, { whilePulled: 0, whileSpringing: 0, after: 1, up: true });
  assert.deepStrictEqual(r.tapFlush, { held: 0, atLift: 1, up: true });
  assert.deepStrictEqual(r.dropFlush, { held: 0, atDrop: 1, drag: null });
  assert.deepStrictEqual(r.closeFlush, { held: "stale", after: "Clients", up: false }, "closed by the pull: the page behind drawn as it is now");
  assert.deepStrictEqual(r.calmFlush, { held: 0, atLift: 1, up: true });
  assert.deepStrictEqual(r.lostLift, { after10s: 1 });
  assert.deepStrictEqual([r.detached.listening, r.detached.followed.transform, r.detached.after.transform, r.detached.settled.up, r.detached.left], [5, "translate3d(0,90px,0)", "", true, 0], "heard on the card: the pull's move, lift and cancel, and the lift and cancel for the fingers' count");
});

test("while it springs, a new finger does not catch it (it finishes); Escape while it is pulled closes it and leaves nothing on the sheet; with Reduce Motion the let-go is at once, back or closed, nothing left on it; its moves can be refused (a passive listener could not stop the rubber band)", () => {
  assert.deepStrictEqual([r.caught.drag, r.caught.after.up, r.caught.after.transform], [null, true, ""]);
  assert.deepStrictEqual([r.escape.up, r.escape.transform, r.escape.dim, r.escape.after.up], [false, "", "", false]);
  assert.deepStrictEqual([r.calmBack.after.transform, r.calmBack.after.dim, r.calmBack.after.transition, r.calmBack.after.up], ["", "", "", true]);
  assert.deepStrictEqual([r.calmClose.after.up, r.calmClose.after.transition], [false, ""]);
  assert.deepStrictEqual(r.opts, { touchstart: { passive: true }, touchmove: { passive: false }, scroll: { passive: true }, scrollend: { passive: true }, fingers: { capture: true, passive: true } });
});
