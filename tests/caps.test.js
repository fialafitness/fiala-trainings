// His ask, 13 Nov, beside his iPhone's Calendar widget ("FRIDAY", "TOMORROW"): "match apples thickness and letter spacing" for the words
// in full capitals, his font (Inter) and his sizes kept. Apple's capitals there are SF semibold with SF's own spacing for the size (measured
// in his screenshot at 3x: the stroke 18.1% of the capital height; SF drawn by WebKit on the simulator matched it to the pixel). Inter 600
// has the same stroke (17.9%); Inter's letter gaps match SF's with 0.035em at 11 px, 0.025em at 12 and 0.02em at 13 (TOMORROW, EXERCISE 1
// and 14 CLIENTS measured at each size, sub-pixel). Every caption in capitals follows it.
import fs from "node:fs";
import { test, assert } from "./assert.js";
const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const SPACING = { "0.6875rem": "0.035em", "0.75rem": "0.025em", "0.8125rem": "0.02em" };
const rules = [...html.matchAll(/\n {2}([^{}\n]+?)\s*\{([^{}]*text-transform:\s*uppercase[^{}]*)\}/g)].map((m) => ({ sel: m[1].trim(), body: m[2] }));

test("every caption in capitals is Inter 600, the weight of Apple's semibold capitals", () => {
  assert.ok(rules.length >= 18, "the capitals' rules found: " + rules.length);
  for (const r of rules) assert.ok(/font-weight:\s*600/.test(r.body), r.sel + ": 600");
});

test("each takes Apple's spacing for its size: 0.035em at 11 px, 0.025em at 12, 0.02em at 13 (his sizes kept)", () => {
  const groupCap = /\n\s+\.group-cap \{[^}]*font-size: 0\.8125rem;/.test(html);   // .group-cap b takes its size from .group-cap
  for (const r of rules) {
    const size = (/font-size:\s*([\d.]+rem)/.exec(r.body) || [])[1] || (r.sel === ".group-cap b" && groupCap ? "0.8125rem" : null);
    const ls = (/letter-spacing:\s*([\d.]+em)/.exec(r.body) || [])[1];
    assert.ok(size in SPACING, r.sel + ": a caption size (" + size + ")");
    assert.strictEqual(ls, SPACING[size], r.sel + " at " + size);
  }
  assert.ok(html.includes("  .plan-head #planRight { color: var(--text-tertiary); letter-spacing: 0.035em; }"), "the plan head's right side, in capitals by its parent");
  assert.ok(!/letter-spacing:\s*0\.(06|08|10?)em/.test(html), "no wide capitals left");
});
