// The set slider, squared (his ask, 11 Nov: "it should be more squared … the squares that are not 1 of 10 can have dynamic size based on
// number of set … smallest square should not be smaller that current size of the circle"; his pick: the sets to come stay plain numbers on
// the track, no tile; then "something more frosted glass apple like elegant for set 1/10", his pick of three: the frosted lens; then, asked
// "Are those colors Apple would use?", his pick of Apple's own, measured off its segmented control on iOS 27):
// the track has the Weight and Reps boxes' corner; each set is a square of 10 that shares the track with the others,
// never narrower than the old 40-point disc; the set you are on keeps its words' width; one done is a fern square of its share. How it
// works is unchanged (tapping a set, the scroll past the width). Measured in WebKit on the test iPhone (the widths are the browser's).
import fs from "node:fs";
import { test, assert } from "./assert.js";
const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const rule = (sel) => { const i = html.indexOf("\n  " + sel + " {"); if (i < 0) return ""; const a = html.indexOf("{", i) + 1, b = html.indexOf("}", a); return html.slice(a, b).trim(); };   // a rule's declarations, by its selector at a line's start

test("the set slider's track takes the corner of the Weight and Reps boxes under it (14), no longer a capsule; its 4-point inset stays", () => {
  const track = rule(".tracker .tr-chips"), boxes = rule(".chip");
  assert.ok(/(^|; )border-radius: var\(--r-field\);/.test(track), track);
  assert.ok(/(^|; )border-radius: var\(--r-field\);/.test(boxes), "the Weight and Reps boxes: the same corner (" + boxes.slice(0, 80) + ")");
  assert.ok(/(^|; )padding: 4px;/.test(track), "the inset the sets' corner is the track's less");
});

test("each set a square of 10 (the track's 14 less its 4 inset: the corners run parallel), the sets sharing the track's width, never narrower than the old 40-point disc; the set you are on keeps its words' width; one done is a fern square of its share; one to come is its number, no tile (his pick)", () => {
  const base = rule(".tracker .tr-chips button"), cur = rule(".tracker .tr-chips button.cur"), done = rule(".tracker .tr-chips button.done"), both = rule(".tracker .tr-chips button.cur.done");
  for (const p of ["flex: 1 0 40px;", "width: auto;", "min-width: 40px;", "height: 40px;", "border-radius: 10px;", "background: transparent;"]) assert.ok(base.includes(p), p + " in: " + base);
  assert.ok(cur.startsWith("flex: none;") && cur.includes("width: auto;") && !/border-radius/.test(cur), "the set you are on: its words' width, the square's corner: " + cur);
  assert.ok(!/width|border-radius|flex/.test(done) && done.includes("background: var(--done);"), "a set done: the shared square, in fern: " + done);
  assert.ok(both.startsWith("flex: none;") && !/border-radius/.test(both), "back on a set done: worded, squared: " + both);
  assert.ok(!/50px|50%/.test([rule(".tracker .tr-chips"), base, cur, done, both].join(" ")), "no capsule or disc left in the slider");
  assert.ok(rule(".tracker .tr-chips.fits") === "justify-content: space-evenly;", "a lone set, worded, still sits in the track's middle");
});

test("the set you are on wears Apple's own colours for a chosen segment, flat (his pick, 11 Nov, \"Are those colors Apple would use?\", measured off Apple's segmented control on iOS 27): pure white with black words in light, a medium grey with white words in dark (both dark blocks); the sets to come keep their grey numbers; back on a set done it stays a plain fern square", () => {
  const cur = rule(".tracker .tr-chips button.cur"), both = rule(".tracker .tr-chips button.cur.done"), base = rule(".tracker .tr-chips button");
  for (const p of ["background: var(--set-cur);", "color: var(--set-cur-ink);"]) assert.ok(cur.includes(p), p + " in: " + cur);
  assert.ok(!/var\(--ink\)|var\(--ink-on\)/.test(cur), "the black key gone: " + cur);
  assert.ok(!/box-shadow/.test(cur + both), "flat, as Apple's: no shadow, none to cancel: " + cur);
  assert.ok(!html.includes("--set-glass"), "the frosted lens gone");
  const darkSys = html.indexOf('\n  @media (prefers-color-scheme: dark) {\n    :root:not([data-theme="light"]) {'), darkPick = html.indexOf('\n  :root[data-theme="dark"] {'), pickEnd = html.indexOf("\n  }\n", darkPick);
  assert.ok(darkSys > 0 && darkPick > darkSys && pickEnd > darkPick, "the page's light, system-dark and chosen-dark blocks");
  const light = "\n    --set-cur: #fff; --set-cur-ink: #000;", dark = "--set-cur: #69696f; --set-cur-ink: #fff;";
  const l = html.indexOf(light), d1 = html.indexOf(dark), d2 = html.indexOf(dark, d1 + 1);
  assert.ok(l > 0 && l < darkSys && html.indexOf(light, l + 1) < 0, "light: Apple's pure white, black words, in the light block alone");
  assert.ok(d1 > darkSys && d1 < darkPick, "dark: Apple's medium grey, white words, in the system's dark block");
  assert.ok(d2 > darkPick && d2 < pickEnd && html.indexOf(dark, d2 + 1) < 0, "and in the chosen dark theme's");
  assert.strictEqual(html.split("--set-cur:").length - 1, 3, "one light value and the two dark ones, nothing else");
  assert.ok(base.includes("color: var(--text-tertiary);"), "the sets to come: their numbers stay grey (his pick: still to come, so the set you are on stands out)");
  assert.ok(both.includes("background: var(--done);") && both.includes("color: var(--done-ink);"), "back on a set done: the fern, not white or grey: " + both);
});
