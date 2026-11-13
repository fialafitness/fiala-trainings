// His ask, 13 Nov: "keep it a week one but we should add the ability to slide between weeks as well right and left swipe between weeks
// maybe ? what do yo think". His pick the same day ("Build it like this"): the strip follows the finger as the month does, the month's name
// follows the week, Today beside Month on another week, leaving the client's page brings this week back, two fingers on a Mac's trackpad,
// taps and the drag to reschedule as before. The page plays in its own process (week-pager-probe.mjs), on a fixed day: Wednesday 11
// November 2026 (the strip Monday 9 to Sunday 15; next week has two workouts on its Wednesday, so it is the taller one).
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test, assert } from "./assert.js";
const here = path.dirname(fileURLToPath(import.meta.url));
const r = JSON.parse(execFileSync(process.execPath, [path.join(here, "week-pager-probe.mjs")], { encoding: "utf8", timeout: 60000 }).trim().split("\n").pop());
const html = fs.readFileSync(path.join(here, "../index.html"), "utf8"), js = fs.readFileSync(path.join(here, "../app/main.js"), "utf8");
const AT = (weekOff, days, head, today) => ({ weekOff, days, head, today, tr: "", height: "", prev: 0, next: 0 });   // the strip at rest on a week
const THIS = AT(0, "09 10 11 12 13 14 15", "November", false), NEXT = AT(1, "16 17 18 19 20 21 22", "November", true);

test("a finger takes the strip after 8 points sideways: the weeks either side drawn then, the strip following it 1:1, its height easing toward the week coming in", () => {
  const f = r.finger;
  assert.deepStrictEqual(f.early, { tr: "", prev: 0, next: 0, dragged: false }, "5 points: still a tap's, nothing drawn");
  assert.deepStrictEqual(f.taken, { tr: "translateX(calc(-100% + -20px))", prevDays: "02 03 04 05 06 07 08", nextDays: "16 17 18 19 20 21 22", sideTab: -1, sideClicks: 0, liveClicks: 1, dragged: true, height: "81px" },
    "last week and the next drawn as pictures (no keyboard place, nothing to tap); the day the finger landed on lets go of its grey; 80 easing toward 100 by 20 of 370");
  assert.deepStrictEqual(f.half, { tr: "translateX(calc(-100% + -185px))", height: "90px" }, "half way: half way between the heights");
});

test("let go past 48 points: the next week slides in, in the month's 280 ms, the month's name and Today changing as it sets off; the click of the release goes nowhere; landed, the strip is drawn anew for that week and taps open its workouts again", () => {
  const f = r.finger;
  assert.deepStrictEqual(f.letGo, { tr: "translateX(-200%)", transition: "transform 280ms cubic-bezier(0.22, 1, 0.36, 1)", height: "100px", viewTransition: "", head: "November", today: true, weekOff: 0, clickEaten: true, preview: null },
    "the next week's height, eased by the view's own transition");
  assert.deepStrictEqual(f.landed, { ...NEXT, transition: "none" });
  assert.deepStrictEqual(f.after, { preview: "b", eaten: false }, "a workout of that week tapped: its preview");
  assert.deepStrictEqual(r.short, { letGo: { tr: "translateX(-100%)", today: false }, after: THIS }, "40 points: back to this week");
  assert.deepStrictEqual(r.vertical, { mid: { tr: "", prev: 0, dragged: true }, after: THIS }, "up or down first: the page's scroll for the rest of that press");
});

test("the weeks before too; the month's name follows the week (\"Oct – Nov\" across the month's turn); Today comes back to this week, slid from the next or last week, else coming in from its side", () => {
  const w = r.weeks;
  assert.deepStrictEqual(w.last, AT(-1, "02 03 04 05 06 07 08", "November", true));
  assert.deepStrictEqual(w.atOnce, { head: "Oct – Nov", today: true }, "as the week sets off, before it lands");
  assert.deepStrictEqual(w.twoBack, AT(-2, "26 27 28 29 30 31 01", "Oct – Nov", true));
  assert.deepStrictEqual(w.fromTwo, { ...THIS, slide: "r" }, "two weeks back: this week at once, coming in from the right (it is later)");
  assert.deepStrictEqual(w.next, NEXT);
  assert.deepStrictEqual([w.fromOne.tr, w.fromOne.head, w.fromOne.today, w.fromOne.weekOff], ["translateX(0%)", "November", false, 1], "from the next week: it slides back to this one, Today gone as it sets off");
  assert.deepStrictEqual(w.fromOne.after, THIS);
  assert.deepStrictEqual(w.fromOne.heights, ["100px", "80px", ""], "its height first held where it is (from auto nothing eases), then eased to this week's, then let go: held at the week shown's own 100, not the 120 of the week after next drawn beside it (the v285 review)");
});

test("Month on another week opens that week's month (its Thursday's, as weeks are counted), the first time on a client's page too; Week again: the strip still on that week; Today hides while the month is up", () => {
  const m = r.month;
  assert.deepStrictEqual([m[3].head, m[3].month, m[3].back], ["Nov – Dec", "2026-12", AT(3, "30 01 02 03 04 05 06", "Nov – Dec", true)], "Monday 30 Nov to Sunday 6 Dec: December");
  assert.deepStrictEqual([m[2].month, m[-2].month, m[0].month], ["2026-11", "2026-10", "2026-11"]);
  assert.ok([3, 2, -2, 0].every((k) => m[k].todayHidden), "the month has its own Today");
  assert.deepStrictEqual(m[0].back, THIS);
});

test("the page left (every way out folds it): this week again, drawn at once, so the swipe back's picture and Back are this week's", () => {
  assert.deepStrictEqual(r.fold, { before: AT(2, "23 24 25 26 27 28 29", "November", true), after: THIS });
  assert.deepStrictEqual(r.leftMidway, { left: 0, back: THIS }, "left while a week slides in: this week all the same");
  assert.deepStrictEqual(r.gone, { threw: null }, "the client gone (deleted on another device) as it lands: nothing throws");
});

test("a sync's redraw under the finger leaves the strip as it is (the same buttons), and comes as the weeks land", () => {
  assert.deepStrictEqual(r.redraw, { held: { same: true, tr: "translateX(calc(-100% + -20px))" }, after: { redrawn: true, title: "Push 2", weekOff: 0 } });
});

test("a workout held on the strip is the drag's: sideways it moves the workout a day, never the weeks; a tap still opens its preview; a press as the weeks land lands them at once", () => {
  assert.deepStrictEqual(r.held, { lifted: true, during: { tr: "", prev: 0 }, weekOff: 0, date: "2026-11-12" });
  assert.deepStrictEqual(r.tap, { preview: "a", eaten: false });
  assert.deepStrictEqual(r.caught, { midway: 0, caught: { weekOff: 1, tr: "", days: "16 17 18 19 20 21 22" } });
  for (const how of ["escape", "second"]) assert.deepStrictEqual(r.calledOff[how], { off: true, during: { tr: "", prev: 0 }, weekOff: 0, date: "2026-11-13" }, how + ": the drag called off with the finger still down, the rest of that press is no swipe of the weeks (as the month's)");
  assert.deepStrictEqual(r.wheelLift, { began: true, lifted: false, weekOff: 0 }, "a workout pressed while two fingers hold the weeks never lifts");
});

test("a Mac's mouse drags the weeks as a finger does; a right press moves nothing; Reduce Motion: the week is there at once", () => {
  assert.deepStrictEqual(r.mouse, { dragged: false, left: 1, right: "", after: 1 }, "(no grey on a pressed day to let go of under a mouse)");
  assert.deepStrictEqual(r.calm, { weekOff: 1, tr: "", transition: "none", days: "16 17 18 19 20 21 22" });
});

test("two fingers on a Mac's trackpad page the weeks as the month's: a week at most, by the finger's rule; up and down, under a menu, under a finger or a held workout: nothing", () => {
  const w = r.wheel;
  assert.deepStrictEqual([w.next.weekOff, w.next.most, w.next.rest], [1, -60, ""], "60 points to the left: the next week, the strip following the fingers");
  assert.deepStrictEqual([w.short.weekOff, w.back.weekOff, w.flick.weekOff], [0, -1, 1], "40: back; to the right: last week; a flick and its coasting: one week");
  assert.ok(w.flick.most >= -370 && w.flick.most < -300, "never more than a week over");
  assert.ok(w.next.prevented > 0 && w.flick.prevented > 0, "kept from the browser (its own swipe back)");
  assert.deepStrictEqual([w.vertical.weekOff, w.vertical.prevented], [0, 0], "a scroll is the page's");
  assert.deepStrictEqual([w.underMenu.weekOff, w.underMenu.prevented], [0, 0]);
  assert.deepStrictEqual([w.fingerOn.weekOff, w.held.weekOff, w.fingerOn.most, w.held.most], [0, 0, 0, 0]);
});

test("the page's pieces: last week and the next on a track in a view that keeps the finger from the browser's own scroll sideways; the weeks either side unseen by VoiceOver and the keyboard; Today beside Month; the strip kept from the swipe back, one finger or two", () => {
  assert.ok(html.includes('<div data-tab="workouts" class="week-view" id="weekView"><div class="week-track" id="weekTrack"><div class="week" id="weekPrev" aria-hidden="true" inert></div><div class="week" id="week"></div><div class="week" id="weekNext" aria-hidden="true" inert></div></div></div>'));
  assert.ok(html.includes('<h2 id="weekHead"></h2><button class="cal-today" id="weekToday" type="button" hidden>Today</button><button class="cal-disc" id="calToggle"'), "Today before Month, as the month's own Today sits by its arrows");
  assert.ok(html.includes("\n  .week-view { position: relative; overflow: hidden; touch-action: pan-y; margin-bottom: 28px; transition: height 280ms ease; }"), "the month's own: sideways is the app's, up and down the page's; its height eases as the month's");
  assert.ok(html.includes("\n  .week-track { display: flex; align-items: flex-start; width: 100%; transform: translateX(-100%); will-change: transform; }") && html.includes("\n  .week-track > .week { flex: 0 0 100%; min-width: 0; margin-bottom: 0; }"), "three weeks side by side, this one in view, each its own height");
  assert.ok(html.includes("\n  @media (prefers-reduced-motion: reduce) { .week-view, .week-track { transition: none !important; } }"));
  assert.ok(html.includes("\n  .week-bar .cal-today { margin-left: auto; } .week-bar .cal-today:not([hidden]) + .cal-disc { margin-left: 4px; }"));
  assert.ok(html.includes("body.client.paused #weekView,") && html.includes("#vClient.tpl #weekView,"), "hidden with the strip on a paused client's page and on a program's");
  assert.ok(/NO_SWIPE = "#calView, #week, #weekView, /.test(js) && /NO_WHEEL_BACK = "#calView, #weekView, /.test(js), "a finger or two fingers sideways on the strip page its weeks, never the page back");
  assert.deepStrictEqual(r.wired, { twoFingers: true, page: true });
  assert.ok(html.includes("\n  .week-bar h2 { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }"), "the month's name gives way (\u2026) before Today and Month do: a 320-point phone at the largest text sizes (the v285 review)");
});

test("(the v285 review) a workout planned on another week opens: a day tapped there, + Workout, the round +; leaving the page then shows this week (the strip drawn alone: a whole redraw swept the brand-new empty workout away and dropped the coach on Clients)", () => {
  const T = { before: 1, view: "training", made: 1, open: true, weekOff: 0, days: "09 10 11 12 13 14 15" };
  assert.deepStrictEqual(r.plan.day, { ...T, date: "2026-11-16" }, "Monday 16 tapped on next week: a workout on that day");
  assert.deepStrictEqual(r.plan.button, { ...T, date: "2026-11-11" }, "+ Workout: today's, as ever");
  assert.deepStrictEqual(r.plan.plus, { ...T, date: "2026-11-11" });
  const M = { view: "training", made: 1, open: true, weekOff: 0, days: "09 10 11 12 13 14 15" };
  assert.deepStrictEqual(r.planMid, { button: M, plus: M }, "+ Workout or the round + tapped 60 ms after letting go of a swipe, the week still sliding in: it lands quietly as the page is left (the second review: a landing's whole redraw there swept the new workout away)");
});

test("(the v285 review) Month or Today tapped while a week still slides in lands it first: Month opens on the month of the week coming in, Today takes it back; a sync's redraw meanwhile leaves Today as the slide set it", () => {
  assert.deepStrictEqual(r.monthMid, { head: "Nov \u2013 Dec", opened: "2026-12", landed: { month: "2026-12", weekOff: 3 } });
  assert.deepStrictEqual(r.todayMid, { weekOff: 0, days: "09 10 11 12 13 14 15", today: false });
  assert.deepStrictEqual(r.redrawMid, { atOnce: true, during: true, landed: true, weekOff: 1 });
});

test("(the v285 review) only the finger that took the strip lets it go: a second finger lifted on it is no release", () => {
  assert.deepStrictEqual(r.second, { kept: "translateX(calc(-100% + -30px))", dragged: true, on: "translateX(calc(-100% + -120px))", weekOff: 1 }, "(nor does it bring back the grey of the day the first finger landed on)");
  assert.deepStrictEqual(r.secondCancel, { kept: "translateX(calc(-100% + -30px))", on: "translateX(calc(-100% + -120px))", weekOff: 1 }, "nor a second finger the browser cancels");
});

test("(the v285 review) a day's own fade ending under the slide (its transitionend bubbles up) is not the slide's end; the track's own transform's is", () => {
  assert.deepStrictEqual(r.bubble, { fade: { tr: "translateX(-200%)", weekOff: 0 }, own: { tr: "", weekOff: 1 } });
});

test("(the v285 review) a Mac's release lost (the button up, no pointerup): the weeks no longer follow the bare pointer and go back after 150 ms; a press on a press that never ended lets it go first, and redraws draw the strip again", () => {
  assert.deepStrictEqual(r.lost, { held: "translateX(calc(-100% + -100px))", bare: "translateX(calc(-100% + -100px))", back: { tr: "translateX(-100%)", transition: "transform 280ms cubic-bezier(0.22, 1, 0.36, 1)" }, after: { weekOff: 0, tr: "" } });
  assert.deepStrictEqual(r.lostPress, { fresh: { tr: "", weekOff: 0 }, title: "Push 3" });
  assert.deepStrictEqual(r.lostAgain, { mid: "translateX(calc(-100% + -90px))", weekOff: 1 }, "a new drag within the lost release's 150 ms: the old press's timer goes with it, and the new drag pages");
});

test("(the v285 review) another tab, or the page left, while a week still slides in: it lands first, then this week (not the week it was sliding to)", () => {
  assert.deepStrictEqual(r.tabMid, { away: 0, back: { weekOff: 0, days: "09 10 11 12 13 14 15", head: "November", today: false, tr: "", height: "", prev: 0, next: 0 } });
  assert.deepStrictEqual(r.foldMid, { folded: { weekOff: 0, days: "09 10 11 12 13 14 15", head: "November", today: false, tr: "", height: "", prev: 0, next: 0 }, after: 0 });
});

test("(the v285 review) the client gone (deleted on another device) while another week shows: leaving the page throws nothing", () => {
  assert.deepStrictEqual(r.goneFold, { threw: null, weekOff: 0 });
});

test("(the v285 review) a new week begun under a week paged to (Sunday's midnight, the page left open): that week stays the one shown, now this week (no Today); this week shown stays this week", () => {
  const { before, still, after, next, later } = r.rollover;
  assert.deepStrictEqual({ before, still, after, next, later }, { before: [1, "16 17 18 19 20 21 22"], still: "16 17 18 19 20 21 22", after: [0, "16 17 18 19 20 21 22", false], next: [1, "23 24 25 26 27 28 29", true], later: [0, "23 24 25 26 27 28 29", false] });
});

test("(the second v285 review) before any redraw after Sunday's midnight, a touch pages from what the strip shows: Today on a week that has become this week draws it anew (today on it, no Today); a swipe from this week left up brings the week after the one shown; Month on a week that has become this week opens this month", () => {
  assert.deepStrictEqual(r.rollover.today, { stale: ["30 01 02 03 04 05 06", true], after: [0, "30 01 02 03 04 05 06", false], marked: "2026-11-30" });
  assert.deepStrictEqual(r.rollover.swipe, { stale: "30 01 02 03 04 05 06", taken: ["23 24 25 26 27 28 29", "07 08 09 10 11 12 13"], after: [0, "07 08 09 10 11 12 13", false] }, "Monday 7 Dec: from 30 Nov\u20136 Dec on screen, the next is 7\u201313 Dec (this week), the last 23\u201329 Nov");
  assert.deepStrictEqual(r.rollover.month, { stale: "28 29 30 31 01 02 03", month: "2026-12", today: "2026-12" });
  assert.deepStrictEqual(r.rollover.idle, { stale: "28 29 30 31 01 02 03", after: [0, "04 05 06 07 08 09 10", false], marked: "2027-01-04" }, "and a sync's redraw of this week left up shows the new this week");
});

test("(the second v285 review) two fingers that carry the strip a whole week (a firm flick) land it at once, with nothing left to move or wait for, so a click there opens the workout under it", () => {
  assert.deepStrictEqual([r.wholeWeek.landed, r.wholeWeek.preview, r.wholeWeek.eaten], [{ weekOff: 1, tr: "", days: "16 17 18 19 20 21 22" }, "b", false]);
});
