// His ask, 13 Nov: a button of the coach's that tells the client to add weight with each set (the RP app's arrow his example: "if I mark it on
// the same symbol is gonna appear next to the reps .. and in clients view if client clicks on it ... kinda like in best and last .. window
// opens"). His picks: Apple's arrow up and to the right (↗), and "just the 3rd button", round, left of play: solid when on, an outline when off.
// When on, the arrow follows the reps in the client's line under the name and in the preview; the client's opens a bubble saying what it means.
// The coach's reps box shows no arrow (his pick the same day, "button only": in it the arrow pushed a long pyramid's last numbers out on a phone).
// The pages play in their own process (ramp-probe.mjs).
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test, assert } from "./assert.js";
import { freshRow, validateBackup } from "../app/model.js";
const here = path.dirname(fileURLToPath(import.meta.url));
const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const src = fs.readFileSync(new URL("../app/main.js", import.meta.url), "utf8");
const r = JSON.parse(execFileSync(process.execPath, [path.join(here, "ramp-probe.mjs")], { encoding: "utf8", timeout: 90000 }).trim().split("\n").pop());
const on = { on: true, pressed: "true", boxMark: 0, tip: 1, tipInReps: true, tipAfterWords: true, data: true };
const off = { on: false, pressed: "false", boxMark: 0, tip: 0, tipInReps: false, tipAfterWords: false, data: "none" };

test("the coach's button: solid (pressed) on an exercise with it on, an outline on one without; on, the arrow follows the reps' words in the line under the name, and the coach's reps box keeps its words whole (his pick, \"button only\")", () => {
  assert.deepStrictEqual(r.coachStart, { a: on, b: off });
});

test("a tap turns it on and saves; another turns it off, saves, and leaves no trace on the exercise; the press keeps a field's keyboard and stays the button's", () => {
  assert.deepStrictEqual(r.coachOn, { ...on, saved: true, keptFocus: true, stopped: true });
  assert.deepStrictEqual(r.coachOff, { ...off, saved: true, keys: false }, "off is no field at all, as an exercise never marked");
});

test("the client sees the arrow after the reps; a tap on it opens Last and Best's bubble with what it means, and the card does not take the tap", () => {
  assert.deepStrictEqual(r.clientStart, { a: on, b: off, tipLabel: "Add weight each set" });
  assert.deepStrictEqual(r.clientTip, { open: true, stopped: true, words: ["Add weight each set | Start lighter and go up a little every set"] });
});

test("only the coach turns it on or off: not the client, and not the coach looking through the client's eyes", () => {
  assert.deepStrictEqual(r.clientCannot, { data: "none", saved: false });
  assert.deepStrictEqual(r.previewView, { a: 1, b: 0 }, "the coach's Client view shows the client's arrow");
  assert.deepStrictEqual(r.previewCannot, { data: "none", saved: false });
  assert.match(src, /<button class="ramp-btn trainer-only" type="button" aria-pressed="false" aria-label="Add weight each set" title="Add weight each set">\$\{RAMP_ICON\}<\/button>/, "the client's look hides the button (trainer-only); VoiceOver reads it as a switch with its name");
  assert.match(html, /body\.client \.trainer-only \{ display: none !important; \}/);
});

test("the preview shows the arrow after the reps of an exercise with it on, and only there; VoiceOver hears it in words there", () => {
  assert.deepStrictEqual(r.preview, [{ words: ["5 sets", "4-6 reps, add weight each set"], mark: 1, silent: ["true"], markIn: 1, markAfterWords: true, said: [", add weight each set"] }, { words: ["5 sets", "4-6 reps"], mark: 0, silent: [], markIn: -1, markAfterWords: null, said: [] }], "in the reps' words (the second), after them; the words hidden from the eye, read by VoiceOver");
});

test("the button is the third disc, left of play; an outline when off, the ink disc when on; the arrow is the words' size and colour, the client's with a finger's width to tap and no taller than its line", () => {
  const icons = /<div class="ex-icons">(.*?)<\/div>/.exec(src); assert.ok(icons, "the discs' markup");
  const order = [...icons[1].matchAll(/<button class="([\w-]+)/g)].map((m) => m[1]); assert.ok(order.indexOf("ramp-btn") >= 0 && order.indexOf("ramp-btn") === order.indexOf("vid-btn") - 1, "just before play: " + order.join(", "));
  assert.ok(html.includes("  body:not(.client) .ex-icons .ramp-btn { background: transparent; box-shadow: inset 0 0 0 1.5px var(--card-disc); color: var(--text-secondary); }"), "off: a ring in the card's disc grey");
  assert.ok(html.includes("  body:not(.client) .ex-icons .ramp-btn.on { background: var(--ink); box-shadow: none; color: var(--ink-on); }"), "on: solid, the ink disc");
  assert.ok(html.includes("  .ramp-mark { display: inline-block; width: 0.85em; height: 0.85em; margin-left: 0.3em; vertical-align: -0.08em; color: inherit; }"));
  assert.ok(html.includes("  .ramp-tip { position: relative; display: inline-block; width: 0.85em; height: 0.85em; margin: 0 0 0 0.3em; padding: 0; border: 0; background: none; appearance: none; vertical-align: -0.08em; color: inherit; cursor: pointer; -webkit-tap-highlight-color: transparent; }"), "the arrow's own box: 0.85em, a little under the words' baseline, and the anchor of its tap area (without position: relative the area would cover a folded card)");
  assert.ok(html.includes("  .ramp-tip::before { content: \"\"; position: absolute; inset: -0.33em -16.5px -0.3em; }"), "the client's arrow is small; its tap area is 44 points wide (0.85em + 33 px at 13 px), and stays inside its line: the name above and Instructions below keep their taps");
  assert.ok(html.includes("  @media (hover: none) { .ex-icons .ramp-btn:hover { opacity: 1; } }"), "on a touch screen a tap's hover stays: the switch must not stay dimmed after it");
  assert.match(src, /const RAMP_TIP = \["Add weight each set", "Start lighter and go up a little every set"\];/);
});

test("a copy of the exercise (a template used, a workout copied) keeps it; a backup holds it, and refuses anything but on or off", () => {
  assert.strictEqual(freshRow({ id: "a", name: "Squat", ramp: true, weights: ["100"] }).ramp, true);
  assert.ok(!("ramp" in freshRow({ id: "a", name: "Squat" })));
  const U = (n) => "00000000-0000-4000-8000-" + String(n).padStart(12, "0");
  const backup = (ramp) => ({ app: "fiala-trainings", format: 1, clients: { c1: { id: U(1), name: "A", unit: "lb" } },
    trainings: { t1: { id: U(2), clientId: U(1), date: "2026-11-13", title: "A", completedAt: null, skippedAt: null, rows: [{ id: "r1", name: "Squat", label: "1", sets: 3, reps: "5", ...(ramp === undefined ? {} : { ramp }) }] } } });
  for (const v of [true, false, undefined, null]) assert.doesNotThrow(() => validateBackup(backup(v), () => false), String(v));
  for (const v of ["yes", 1, {}]) assert.throws(() => validateBackup(backup(v), () => false), /bad row/, String(v));
});
