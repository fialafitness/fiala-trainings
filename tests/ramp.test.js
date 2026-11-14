// His ask, 13 Nov: a button of the coach's that tells the client to add weight with each set (the RP app's arrow his example: "if I mark it on
// the same symbol is gonna appear next to the reps .. and in clients view if client clicks on it ... kinda like in best and last .. window
// opens"). His picks: Apple's arrow up and to the right (↗), and "just the 3rd button", round, left of play: solid when on, an outline when off.
// When on, the arrow follows the reps in the client's line under the name and in the preview; the client's opens a bubble saying what it means.
// The coach's reps box shows no arrow (his pick the same day, "button only": in it the arrow pushed a long pyramid's last numbers out on a phone).
// His ask the same day, then his picks of 14 Nov: a second sign, "fewer reps, more weight" (a pyramid: a range such as 12-4 with it), its icon "Tiers"
// (three blocks stacked), its own round button beside the arrow's ("keep both buttons ... next to each other ... it makes adding those symbols
// faster"); one sign at a time. The client's whole phrase, the reps' words and the sign, is the button ("make the whole rep touchable").
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
const A = (sign, label, words = "4-6 reps") => ({ tag: ["BUTTON", "button"], inReps: true, alone: true, words, signLast: true, label: words + ", " + label });   // a real button: Tab reaches it, VoiceOver says button
const on = (kind) => ({ buttons: kind === "ramp" ? ["true", "false"] : ["false", "true"], lit: kind === "ramp" ? [true, false] : [false, true], boxMark: 0, tips: 1, sign: kind, phrase: A(kind, kind === "ramp" ? "add weight each set" : "fewer reps, more weight"), reps: "4-6 reps", data: kind === "ramp" ? [true, false] : [false, true], keys: [kind] });
const off = { buttons: ["false", "false"], lit: [false, false], boxMark: 0, tips: 0, sign: null, phrase: null, reps: "4-6 reps", data: [false, false], keys: [] };

test("the coach's two round buttons, the arrow's and the pyramid's: each solid (pressed) when its sign is on, an outline when off; the sign follows the reps' words in the line under the name, and the coach's reps box keeps its words whole (his pick, \"button only\")", () => {
  assert.deepStrictEqual(r.coachStart.a, on("ramp"));
  assert.deepStrictEqual(r.coachStart.b, off);
  assert.deepStrictEqual(r.coachStart.c, on("pyramid"));
  assert.deepStrictEqual(r.coachStart.d, { ...on("ramp"), data: [true, true], keys: ["ramp", "pyramid"] }, "both on: the arrow shows, its button alone lit (only a device still on v295 can add the arrow to an exercise with the pyramid: the arrow is the newer choice)");
  assert.deepStrictEqual(r.noReps, { ...on("pyramid"), phrase: A("pyramid", "fewer reps, more weight", "10 reps"), reps: "10 reps" }, "no reps written: the box's grey 10 is the phrase, with the sign (a review's catch: the case before tested a line the app never draws)");
});

test("one tap turns a sign on and saves; the other sign goes off as it comes on (one at a time); the one on, tapped again, leaves no sign and no trace; the press keeps a field's keyboard and stays the button's", () => {
  const press = { keptFocus: true, stopped: true, saved: true };
  assert.deepStrictEqual(r.pyrOn, { ...on("pyramid"), ...press });
  assert.deepStrictEqual(r.rampOverPyr, { ...on("ramp"), ...press });
  assert.deepStrictEqual(r.pyrOverRamp, { ...on("pyramid"), saved: true });
  assert.deepStrictEqual([r.pyrOff, r.rampOff], [{ ...off, saved: true }, { ...off, saved: true }], "off is no field at all, as an exercise never marked");
  assert.deepStrictEqual(r.bothArrow, off, "both on (the arrow shown), the arrow tapped: none left");
  assert.deepStrictEqual(r.bothPyr, on("pyramid"), "both on, the pyramid tapped: the pyramid alone");
});

test("the client sees the sign after the reps; a tap anywhere on the phrase, words or sign, opens Last and Best's bubble with what it means, and the card does not take the tap", () => {
  assert.deepStrictEqual(r.clientStart, { a: on("ramp"), b: off, c: on("pyramid") });
  assert.deepStrictEqual(r.clientRamp, { open: true, stopped: true, words: ["Add weight each set | Start lighter and go up a little every set"] });
  assert.deepStrictEqual(r.clientPyr, { open: true, stopped: true, words: ["Fewer reps, more weight | Each set, drop the reps and go a little heavier"] });
});

test("only the coach turns a sign on or off: not the client, and not the coach looking through the client's eyes", () => {
  assert.deepStrictEqual(r.clientCannot, { data: [false, false], saved: false });
  assert.deepStrictEqual(r.previewView, { a: "ramp", b: null, c: "pyramid" }, "the coach's Client view shows the client's signs");
  assert.deepStrictEqual(r.previewCannot, { data: [false, false], saved: false });
  assert.deepStrictEqual(r.previewTip, { open: true, stopped: true, words: ["Fewer reps, more weight | Each set, drop the reps and go a little heavier"] }, "the coach in the Client view taps the phrase and reads what his client will");
  assert.match(src, /<button class="ramp-btn trainer-only" type="button" aria-pressed="false" aria-label="Add weight each set" title="Add weight each set">\$\{RAMP_ICON\}<\/button><button class="pyr-btn trainer-only" type="button" aria-pressed="false" aria-label="Fewer reps, more weight" title="Fewer reps, more weight">\$\{PYR_ICON\}<\/button>/, "the client's look hides the buttons (trainer-only); VoiceOver reads each as a switch with its name");
  assert.match(html, /body\.client \.trainer-only \{ display: none !important; \}/);
});

test("the preview shows the sign after the reps of an exercise with one on, and only there; VoiceOver hears it in words there", () => {
  const mark = (reps, kind, said) => ({ words: ["5 sets", reps + ", " + said], marks: [kind], silent: ["true"], markIn: 1, markAfterWords: true, said: [", " + said] });
  assert.deepStrictEqual(r.preview, [mark("4-6 reps", "ramp", "add weight each set"), { words: ["5 sets", "4-6 reps"], marks: [], silent: [], markIn: -1, markAfterWords: null, said: [] }, mark("12-4 reps", "pyramid", "fewer reps, more weight"), mark("4-6 reps", "ramp", "add weight each set")], "the last has both: the arrow, as on the card");
});

test("the two buttons sit together, left of play: an outline when off, the ink disc when on; the sign is the words' size and colour; the client's phrase is one button no taller than its words", () => {
  const icons = /<div class="ex-icons">(.*?)<\/div>/.exec(src); assert.ok(icons, "the discs' markup");
  const order = [...icons[1].matchAll(/<button class="([\w-]+)/g)].map((m) => m[1]); assert.deepStrictEqual(order.slice(0, 3), ["ramp-btn", "pyr-btn", "vid-btn"], "the arrow, the pyramid, then play: " + order.join(", "));
  assert.ok(html.includes("  body:not(.client) .ex-icons .ramp-btn, body:not(.client) .ex-icons .pyr-btn { background: transparent; box-shadow: inset 0 0 0 1.5px var(--card-disc); color: var(--text-secondary); }"), "off: a ring in the card's disc grey");
  assert.ok(html.includes("  body:not(.client) .ex-icons .ramp-btn.on, body:not(.client) .ex-icons .pyr-btn.on { background: var(--ink); box-shadow: none; color: var(--ink-on); }"), "on: solid, the ink disc");
  assert.ok(html.includes("  .ramp-mark { display: inline-block; width: 0.85em; height: 0.85em; margin-left: 0.3em; vertical-align: -0.08em; color: inherit; }"));
  assert.ok(html.includes("  .ramp-tip .sign { display: inline-block; width: 0.85em; height: 0.85em; margin-left: 0.3em; vertical-align: -0.08em; }"), "the client's sign as the preview's: 0.85em, a little under the words' baseline");
  assert.ok(html.includes("  .ramp-tip { display: inline; margin: 0; padding: 0; border: 0; border-radius: 4px; background: none; appearance: none; font: inherit; color: inherit; letter-spacing: inherit; text-align: inherit; cursor: pointer; -webkit-tap-highlight-color: transparent; }"), "the phrase in the line's own type, no box of its own");
  assert.ok(!html.includes(".ramp-tip::before"), "no tap area grown round a small arrow: the phrase is wide enough, and stays inside its line");
  assert.ok(html.includes("  @media (hover: none) { .ex-icons .ramp-btn:hover, .ex-icons .pyr-btn:hover { opacity: 1; } }"), "on a touch screen a tap's hover stays: a switch must not stay dimmed after it");
  assert.match(src, /const RAMP_TIP = \["Add weight each set", "Start lighter and go up a little every set"\];/);
  assert.match(src, /const PYR_TIP = \["Fewer reps, more weight", "Each set, drop the reps and go a little heavier"\];/);
  assert.ok(src.includes("const PYR_ICON = '<svg viewBox=\"0 0 16 16\" aria-hidden=\"true\" fill=\"currentColor\"><path d=\"M5.85 3.95A0.7 0.7 0 0 1 6.55 3.25"), "his pick A, Tiers: our own solid path on the arrow's grid");
});

test("the line under the name never starts with a bullet when it wraps: each bullet sits in the gap before its words and is clipped at a line's start (his screenshot, 13 Nov)", () => {
  assert.ok(html.includes("  body.client .block:not(.ahead) .row .sum { column-gap: 22px; clip-path: inset(-40px -40px -40px -6px); }"), "the gap holds the bullet; left of the line it is cut away");
  const ring = /^ {2}\.ramp-tip:focus-visible \{ outline: (\d+(?:\.\d+)?)px solid [^;]+; outline-offset: (-?\d+(?:\.\d+)?)px; \}/m.exec(html), clip = /^ {2}body\.client \.block:not\(\.ahead\) \.row \.sum \{[^}]*clip-path: inset\(\S+ \S+ \S+ (-?\d+)(?:px)?\);/m.exec(html);
  assert.ok(ring && clip, "the ring's and the clip's rules"); const room = -Number(clip[1]), reach = Number(ring[1]) + Number(ring[2]);
  assert.ok(room >= reach && room < 8, "room left of the line for the phrase's focus ring (" + reach + "), never for a bullet's dot (8 or more out at every Text Size): " + room + " (a review's catch: at 0 the ring lost its left side)");
  assert.ok(html.includes('  body.client .block:not(.ahead) .row .sum .si + .si::before { content: "\\2022"; display: inline-block; width: 22px; margin: 0 0 0 -22px; text-align: center; color: var(--text-tertiary); font-size: 0.85em; }'), "a bullet pulled back into the gap by its own width, on the words' baseline (measured on the simulator: its middle at the words' x-height middle)");
});

test("a copy of the exercise (a template used, a workout copied) keeps its sign; a backup holds it, and refuses anything but on or off", () => {
  assert.strictEqual(freshRow({ id: "a", name: "Squat", ramp: true, weights: ["100"] }).ramp, true);
  assert.strictEqual(freshRow({ id: "a", name: "Squat", pyramid: true, weights: ["100"] }).pyramid, true);
  assert.ok(!("ramp" in freshRow({ id: "a", name: "Squat" })) && !("pyramid" in freshRow({ id: "a", name: "Squat" })));
  const U = (n) => "00000000-0000-4000-8000-" + String(n).padStart(12, "0");
  const backup = (ramp) => ({ app: "fiala-trainings", format: 1, clients: { c1: { id: U(1), name: "A", unit: "lb" } },
    trainings: { t1: { id: U(2), clientId: U(1), date: "2026-11-13", title: "A", completedAt: null, skippedAt: null, rows: [{ id: "r1", name: "Squat", label: "1", sets: 3, reps: "5", ...(ramp === undefined ? {} : { ramp }) }] } } });
  for (const v of [true, false, undefined, null]) assert.doesNotThrow(() => validateBackup(backup(v), () => false), String(v));
  for (const v of ["yes", 1, {}]) assert.throws(() => validateBackup(backup(v), () => false), /bad row/, String(v));
  const backupP = (pyramid) => { const x = backup(undefined); if (pyramid !== undefined) x.trainings.t1.rows[0].pyramid = pyramid; return x; };
  for (const v of [true, false, undefined, null]) assert.doesNotThrow(() => validateBackup(backupP(v), () => false), "pyramid " + String(v));
  for (const v of ["yes", 1, {}]) assert.throws(() => validateBackup(backupP(v), () => false), /bad row/, "pyramid " + String(v));
});
