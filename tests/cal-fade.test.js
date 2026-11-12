// v261's own rule for the chips: "words that do not fit fade over the chip's last 12 points (no "…"), as Calendar's". The fade sat on
// every chip, so a name that fits but runs into the chip's last 12 points was faded as if cut: in WebKit, on a 320-point phone 'Upper'
// read 'Uppe' (a fifth of its last letter's ink left), on his 402-point one 'Mobility' lost its 'y', on a 430-point one the plain
// "Workout" its 't'. Now only words wider than their chip are marked to fade (main.js fitChips), measured again when the window turns
// and once Inter is in. The page plays in its own process (cal-fade-probe.mjs), with WebKit's measured widths.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test, assert } from "./assert.js";
const here = path.dirname(fileURLToPath(import.meta.url));
const r = JSON.parse(execFileSync(process.execPath, [path.join(here, "cal-fade-probe.mjs")], { encoding: "utf8", timeout: 60000 }).trim().split("\n").pop());
const html = fs.readFileSync(path.join(here, "../index.html"), "utf8");
const FADE = "linear-gradient(to right, #000 calc(100% - 12px), transparent)";
const onEvery = /\.day-ev-t \{[^}]*mask-image/.test(html), onOver = html.includes(`.day-ev-t.over { -webkit-mask-image: ${FADE}; mask-image: ${FADE}; }`);
const faded = (marks) => Object.fromEntries(Object.entries(marks || {}).map(([name, over]) => [name, onEvery || (onOver && over)]));   // what the page's CSS does to each chip's words

test("a chip's words fade only when they do not fit, in the week and the month alike: a name that fits is left whole (320 points: 'Upper' and 'Legs' whole; 'Glutes', \"Workout\", 'Full Body', 'Shoulders' faded); the window turned wider (430 points), measured again: only 'Shoulders' still faded", () => {
  const at320 = { Upper: false, Legs: false, Glutes: true, Workout: true, "Full Body": true, Shoulders: true };
  assert.deepStrictEqual(faded(r.week320), at320, "the week strip, 320 points");
  assert.deepStrictEqual(faded(r.month320), at320, "the month, 320 points");
  const at430 = { Upper: false, Legs: false, Glutes: false, Workout: false, "Full Body": false, Shoulders: true };
  assert.deepStrictEqual(faded(r.month430), at430, "the month after the window's resize to 430 points");
  assert.deepStrictEqual(faded(r.week430), at430, "the week drawn again at 430 points");
  assert.deepStrictEqual(faded(r.week402), { Upper: false, Legs: false, Glutes: false, Workout: false, "Full Body": true, Shoulders: true }, "his own 402-point phone: the plain \"Workout\", 0.38 over, is clipped unseen rather than losing its last letter to the fade (a point's grace)");
});
