// The set slider, squared (his ask, 11 Nov: "it should be more squared … the squares that are not 1 of 10 can have dynamic size based on
// number of set … smallest square should not be smaller that current size of the circle"; his pick: the sets to come stay plain numbers on
// the track, no tile): the track has the Weight and Reps boxes' corner; each set is a square of 10 that shares the track with the others,
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
