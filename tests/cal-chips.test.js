// His ask, 11 Nov: "Let's rebuild the calendar view so it looks more like Apple one … the bar need bigger Apple like shape and I want the
// words in there just like Apple calendar but obviously my font … and it's gonna be Apple gray for scheduled workouts and turned green
// after finished … if workout doesn't have name just say workout", then "the bar gets smaller when uncolapsed .. keep them same size even
// in months view", and his pick the same day: a missed workout is a red chip. Apple Calendar's month view was measured on his screenshot
// (3 px a point) and on the test iPhone, light and dark. The page itself plays in its own process (cal-chips-probe.mjs).
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test, assert } from "./assert.js";
const here = path.dirname(fileURLToPath(import.meta.url));
const r = JSON.parse(execFileSync(process.execPath, [path.join(here, "cal-chips-probe.mjs")], { encoding: "utf8", timeout: 60000 }).trim().split("\n").pop());
const html = fs.readFileSync(path.join(here, "../index.html"), "utf8"), js = fs.readFileSync(path.join(here, "../app/main.js"), "utf8");

test("each day of the client's month shows its workouts as chips with their names, as Apple Calendar's month view: grey while still to do, green once finished (on the day it was finished), red once its day is gone, \"Workout\" when it has no name, in the order they were made; three at most, else two and \"+N\"; a skipped one is not there", () => {
  const plan = (...n) => n.map((x) => "plan:" + x);
  assert.deepStrictEqual(r.month["0"].chips, plan("Workout", "B"));
  assert.deepStrictEqual(r.month["-1"].chips, ["miss:LATE"]);
  assert.deepStrictEqual(r.month["-2"].chips, ["done:DONE"]);
  assert.deepStrictEqual(r.month["-3"].chips, ["done:EARLY"], "finished ahead of its day: on the day it was finished");
  assert.deepStrictEqual([r.month["6"].chips, r.month["4"].chips, r.month["1"].chips], [[], [], []], "its own day empty once finished; a skipped one nowhere; an empty day nothing");
  assert.deepStrictEqual(r.month["2"].chips, [...plan("F1", "F2"), "+2"]);
  assert.deepStrictEqual(r.month["3"].chips, plan("T1", "T2", "T3"));
});

test("the week strip shows the very same chips as the month, day for day (his ask: the same size when the month opens, never smaller)", () => {
  assert.strictEqual(r.weekDays, 7);
  const days = Object.keys(r.week); assert.ok(days.includes("0"), "today is in the strip");
  for (const n of days) assert.deepStrictEqual(r.week[n].chips, r.month[n].chips, "day " + n);
  assert.ok(/day-evs/.test(js) && /b\.append\(dn, dayChips\(dayWorkouts\)\)/.test(js), "one builder for both");
  assert.ok(/\.week \{ display: grid; grid-template-columns: repeat\(7, minmax\(0, 1fr\)\); gap: 0;/.test(html) && html.includes(".cal-panel .cal, .dp-track > .cal { grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 0; }"), "the strip's columns are the month's (and the day picker's), so its chips are the same size");
});

test("VoiceOver hears each day's workouts by name, finished or missed, after the date; a workout in the calendar opens its preview first (his ask, 11 Nov), the week's and the month's: the day with one workout, the chip tapped on a busy day, a busy day itself (or its \"+N\") opening the day's list whose row opens the preview; the page stays the client's", () => {
  assert.strictEqual(r.labels.today, r.todayLabel + ": Workout; B");
  assert.ok(/: LATE, missed$/.test(r.labels.late) && /: DONE, finished$/.test(r.labels.done) && !/:/.test(r.labels.empty), JSON.stringify(r.labels));
  assert.deepStrictEqual(r.tap, { view: "client", preview: "late" });
  assert.deepStrictEqual(r.tapChip, { view: "client", preview: "t2" });
  assert.deepStrictEqual(r.tapWeekChip, { view: "client", preview: "b" });
  assert.deepStrictEqual(r.tapBusy, { sheet: true, view: "client", preview: "f3" });
  assert.deepStrictEqual(r.alsoToday, { sheet: true, view: "training", preview: null, id: "f2" }, "only the calendar's: the workout page's \"Also today\" list still opens the workout itself");
});

test("the chip as measured on Apple Calendar (his screenshot, 3 px a point): 16 tall, 4 round, 2 in from the day's edges and 3 apart, the words 11 semibold on a 16 line (Inter's caps centred as Calendar's), fading over the last 12 points with no \"…\", in points not the Text Size (the grid is fixed, as Calendar's); the rest counted plain; a class of its own (the exercise page's .chip is another thing)", () => {
  assert.ok(html.includes(".day-evs { align-self: stretch; display: flex; flex-direction: column; gap: 3px; padding: 0 2px; min-height: 16px; }"));
  assert.ok(html.includes(".day-ev { display: block; height: 16px; border-radius: 4px; padding: 0 2px; overflow: hidden; white-space: nowrap; font-size: 11px; line-height: 16px; font-weight: 600; letter-spacing: 0; text-align: left; }"));
  assert.ok(html.includes(".day-ev-t { display: block; overflow: hidden; }") && html.includes(".day-ev-t.over { -webkit-mask-image: linear-gradient(to right, #000 calc(100% - 12px), transparent); mask-image: linear-gradient(to right, #000 calc(100% - 12px), transparent); }"), "the fade, prefixed and not, on words that do not fit (cal-fade.test.js)");
  assert.ok(html.includes(".day-ev-more { display: block; height: 16px; font-size: 10px; line-height: 16px; color: var(--text-tertiary); text-align: center; }"));
  assert.ok(!/className = "chips?[ "]/.test(js) && /className = "day-ev " \+/.test(js), "no clash with the exercise page's .chip");
});

test("the colours, by Apple Calendar's own recipe (measured: the colour at 25% over the page; its words the colour at half its light in light, the colour itself in dark): Apple grey (systemGray) still to do, the fern finished (the app's one finished green), the crimson missed (his pick); each defined for light and both dark blocks", () => {
  assert.strictEqual((html.match(/--chip-grey: #8e8e93;/g) || []).length, 1, "systemGray, the same in light and dark");
  for (const [k, base] of [["plan", "--chip-grey"], ["done", "--done"], ["miss", "--danger"]]) {
    assert.ok(html.includes(`--chip-${k}: color-mix(in srgb, var(${base}) 25%, var(--surface)); --chip-${k}-ink: color-mix(in srgb, var(${base}), #000 50%);`), k + " light");
    assert.strictEqual((html.match(new RegExp(`--chip-${k}-ink: var\\(${base}\\)`, "g")) || []).length, 2, k + " dark, both blocks");
  }
  assert.ok(html.includes(".day-ev.plan { background: var(--chip-plan); color: var(--chip-plan-ink); }") && html.includes(".day-ev.done { background: var(--chip-done); color: var(--chip-done-ink); }") && html.includes(".day-ev.miss { background: var(--chip-miss); color: var(--chip-miss-ink); }"));
});

test("the month's 1-point line over each week, across its days only, as Calendar's (measured: #e8e8e8 on white, #2a2a2b on black); the day picker's months alike, with the month's chips, its white today and no purple day of its own (his ask, 12 Nov: every calendar as the new one)", () => {
  assert.ok(html.includes("--cal-line: rgba(0,0,0,0.09);") && (html.match(/--cal-line: rgba\(255,255,255,0\.165\);/g) || []).length === 2);
  assert.ok(html.includes(".cal-panel .cal, .dp-track > .cal { grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 0; }"), "the picker's columns and rows as the month's");
  assert.ok(html.includes(".cal-panel .cal button, .dp-track > .cal button { min-width: 0; border-radius: 0; padding: 6px 0 6px; box-shadow: inset 0 1px 0 var(--cal-line); }"), "the line over each week, in the picker too");
  const picker = js.slice(js.indexOf("function renderDatePicker"), js.indexOf("function renderDatePicker") + 3000);
  assert.ok(picker.includes("b.append(dn, dayChips(dayWorkouts, dp.moving));") && !/dayDots|dayWords/.test(js), "the picker draws the month's chips; its old bars and counts are gone");
  assert.ok(picker.includes('b.setAttribute("aria-label", fmt.format(d) + (dayWorkouts.length ? ": " + dayNames(dayWorkouts) : ""));'), "VoiceOver hears a day's workouts by name, as in the month");
  assert.ok(!/\.sheet \.cal button\.(today|sel)/.test(html) && !/\.cal \.dots?\b/.test(html), "no purple today or chosen day of its own, and no bars left: today is the month's white circle");
  assert.ok(html.includes("  .day-ev.moving { box-shadow: inset 0 0 0 1.5px var(--brand-text); }"), "the workout being moved: its chip outlined in purple (his pick)");
  assert.strictEqual((js.match(/openDatePicker\(\{ clientId: [^,]+, moving: /g) || []).length, 6, "the six that move a workout say which (a row's Reschedule, the page's two, Move to, Use all's empty workout, which takes the first day picked, and one template's Use while choosing for it, v288); Add to a client moves none");
  assert.ok(html.includes("  .cal button.off { cursor: default; opacity: 0.35; }"), "a day it cannot go to: grey, as the days gone by in the month's drag");
});

test("a keyboard's ring on a day of the week strip is whole, as the month's: the days touch (gap 0, the month's columns) and a day's chips sit 2 in from its edges, so the ring is drawn inside the day (WebKit paints the next day's chips over a ring drawn outside it, measured)", () => {
  const rules = [...html.matchAll(/^ {2}([^{}@\n][^{}\n]*?) \{([^{}]*)\}/gm)].map((m) => ({ sels: m[1].split(",").map((s) => s.trim()), body: ";" + m[2] }));
  const last = (sel, prop) => { let v = null; for (const r of rules) if (r.sels.includes(sel)) { const m = r.body.match(new RegExp("[;\\s]" + prop + ":\\s*([^;]+);")); if (m) v = m[1].trim(); } return v; };   // the cascade's last word on it, outside @media
  const px = (v) => parseFloat(v) || 0;
  for (const [day, grid] of [[".week button:focus-visible", ".week"], [".cal button:focus-visible", ".cal-panel .cal"]]) {
    const off = px(last(day, "outline-offset")), wide = px(String(last(day, "outline")).split(" ")[0]), gap = px(last(grid, "gap")), inset = px(String(last(".day-evs", "padding")).split(" ")[1]);
    assert.ok(wide > 0 && inset > 0, day + ": a ring and an inset to measure");
    assert.ok(off + wide <= gap + inset, day + ": the ring (" + off + " out, " + wide + " wide) clear of the next day's chips, " + (gap + inset) + " from the day's edge");
    assert.ok(-off <= inset, day + ": and clear of the day's own chips, " + inset + " in");
  }
});

test("the keyboard's place: a preview opened from the calendar (Escape, the cross's Enter) gives it back to the day it came from, never to the page: through a busy day's list, whose row went with it, and after a redraw drew the day anew", () => {
  assert.deepStrictEqual(r.keys, { busy: { id: "f3", place: "day" }, redraw: { id: "done", place: "new day" } });
});

test("a finished workout's green chip opens its preview too, whose foot shows it in History (his pick, 11 Nov: \"show in history or same thing apple would say\"), as Apple's \"Show in …\": History opens, the workout's row found, scrolled into the middle and lit a moment; one still to do (or missed) says Start workout", () => {
  assert.deepStrictEqual(r.tapLate, { view: "client", preview: "late", go: "Start workout" });
  assert.deepStrictEqual(r.tapDone, { view: "client", preview: "done", go: "Show in History" });
  assert.deepStrictEqual(r.showInHistory, { history: true, view: "client", preview: null, row: true, lit: true, scrolled: true });
});
