// His ask, 13 Nov, beside his iPhone's Calendar widget ("FRIDAY", "TOMORROW"): "match apples thickness and letter spacing" for the words
// in full capitals, his font (Inter) and his sizes kept. Apple's capitals there are SF semibold with SF's own spacing for the size (measured
// in his screenshot at 3x: the stroke 18.1% of the capital height; SF drawn by WebKit on the simulator matched it to the pixel). Inter 600
// has the same stroke (17.9%); Inter's letter gaps match SF's with 0.035em at 11 px, 0.025em at 12, 0.02em at 13 and 14, 0.015em at 15
// (TOMORROW, EXERCISE 1 and 14 CLIENTS measured at each size, sub-pixel). Every caption in capitals follows it. His pick B the same day: the
// captions two sizes bigger (11 to 13, 12 to 14, 13 to 15), the client count beside Reorder kept at 13.
import fs from "node:fs";
import { test, assert } from "./assert.js";
const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const SPACING = { "0.6875rem": "0.035em", "0.75rem": "0.025em", "0.8125rem": "0.02em", "0.875rem": "0.02em", "0.9375rem": "0.015em" };
const rules = [...html.matchAll(/\n {2}([^{}\n]+?)\s*\{([^{}]*text-transform:\s*uppercase[^{}]*)\}/g)].map((m) => ({ sel: m[1].trim(), body: m[2] }));

test("every caption in capitals is Inter 600, the weight of Apple's semibold capitals", () => {
  assert.ok(rules.length >= 18, "the capitals' rules found: " + rules.length);
  for (const r of rules) assert.ok(/font-weight:\s*600/.test(r.body), r.sel + ": 600");
});

test("each takes Apple's spacing for its size: 0.02em at 13 and 14 px, 0.015em at 15 (the sizes of his pick B)", () => {
  for (const r of rules) {
    const size = (/font-size:\s*([\d.]+rem)/.exec(r.body) || [])[1] || null;
    const ls = (/letter-spacing:\s*([\d.]+em)/.exec(r.body) || [])[1];
    assert.ok(size in SPACING, r.sel + ": a caption size (" + size + ")");
    assert.strictEqual(ls, SPACING[size], r.sel + " at " + size);
  }
  assert.ok(html.includes("  .plan-head #planRight { color: var(--text-tertiary); letter-spacing: 0.02em; }"), "the plan head's right side, in capitals by its parent");
  assert.ok(!/letter-spacing:\s*0\.(06|08|10?)em/.test(html), "no wide capitals left");
});

test("his pick B: every caption in capitals two sizes bigger than v292's (11 to 13, 12 to 14, 13 to 15), the client count beside Reorder kept at 13", () => {
  const size = (sel) => { const r = rules.find((x) => x.sel === sel); return r ? (/font-size:\s*([\d.]+rem)/.exec(r.body) || [])[1] : null; };
  assert.deepStrictEqual([".week .wd", ".cal-wd span", ".list .wd .dow", "#whenPop .wk", ".ov-tile span"].map(size), Array(5).fill("0.8125rem"), "11 to 13");
  assert.deepStrictEqual([".list.form .cap", ".list .exdetail .edit-field .cap", ".client-note .cap", ".client-note .cap button"].map(size), Array(4).fill("0.875rem"), "12 to 14");
  assert.deepStrictEqual(["h2", ".pv-cap", ".group-cap b", "body.client .group-cap .num", ".weights .cap", ".kicker", ".tpl-stage"].map(size), Array(7).fill("0.9375rem"), "13 to 15");
  assert.strictEqual(size(".listbar .muted"), "0.8125rem", "15 CLIENTS as it was");
});
