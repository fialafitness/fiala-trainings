// His find, 13 Nov: "when I put my phone into horizontal view and then back to normal that's when the glass bar stays in the middle of the
// screen sometimes". His screenshot had the workout bar 361 points up and the header gone above the screen, both moved by the same amount:
// WebKit left its pinned layers where the page had been before the turn moved it (its bug 144913). The iOS 27.2 Simulator never showed it
// (turns at the top, at the foot, in the Client view, in a fling and back and forth fast), and a home-screen app cannot be kept upright there
// (its manifest's "orientation": "portrait" is not kept, measured). So once a turn has settled the page goes a point and back, the scroll
// WebKit answers by putting the bars where the page is. The window's events and the clock play in their own process (turn-probe.mjs).
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test, assert } from "./assert.js";
const here = path.dirname(fileURLToPath(import.meta.url));
const src = fs.readFileSync(new URL("../app/main.js", import.meta.url), "utf8");
const r = JSON.parse(execFileSync(process.execPath, [path.join(here, "turn-probe.mjs")], { encoding: "utf8", timeout: 60000 }).trim().split("\n").pop());

test("a turn to landscape and back at the foot of a workout (as iOS sizes it: landscape, upright at full height, then the clock's strip back): once the sizes have stopped for 400 ms the page goes a point up and back, ending where it was", () => {
  assert.deepStrictEqual(r.turn, { afterLand: [1468], early: [], moved: [1516], back: [1516, 1517], y: 1517 });
});

test("at the top of a page a point down and back; nothing for the keyboard (the height alone); nothing on a page that does not scroll", () => {
  assert.deepStrictEqual(r.top, { scrolls: [1, 0], y: 0 });
  assert.deepStrictEqual(r.keyboard, [], "the page is never moved for the keyboard (his rule: one scroll for the keyboard)");
  assert.deepStrictEqual(r.short, []);
});

test("the page still moving when the turn settles (a fling): the point and back wait until it has been still 200 ms; a finger taking the page between them keeps it; two turns quickly: one settle, after the last", () => {
  assert.deepStrictEqual(r.fling, { during: [], stillWaiting: [], moved: [1359], after: [1359, 1360], y: 1360 });
  assert.deepStrictEqual(r.finger, { scrolls: [1499], y: 1300 });
  assert.deepStrictEqual(r.twice, { mid: [], scrolls: [1499, 1500] });
});

test("only a turn moves it: the width is what tells a turn, never the keyboard's height", () => {
  assert.ok(/const w = window\.innerWidth; if \(w === turnW && !turnT\) return;/.test(src));
});
