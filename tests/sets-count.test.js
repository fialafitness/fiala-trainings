// His pick A, 14 Nov, after pictures of three ways (Apple's list, a slider, a wheel): "lets build A for the set setting ... only change how I add
// sets nothing else I love everything else about the set the way it is now". The − / + that sat on a line of their own under the set bar are gone;
// at the end of the bar is Apple's pop-up button (the number and its chevrons, as Calendar's "None"), and its list is Calendar's Repeat menu with
// 1 to 20 sets, twelve in view. "Set 1 of 5" and the bar are as they were. The count plays in its own process (sets-count-probe.mjs).
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test, assert } from "./assert.js";
const here = path.dirname(fileURLToPath(import.meta.url));
const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const src = fs.readFileSync(new URL("../app/main.js", import.meta.url), "utf8");
const r = JSON.parse(execFileSync(process.execPath, [path.join(here, "sets-count-probe.mjs")], { encoding: "utf8", timeout: 90000 }).trim().split("\n").pop());
const LIST = Array.from({ length: 20 }, (_, i) => i + 1 + (i ? " sets" : " set"));

test("the coach's set bar is as it was, \"Set 1 of 5\" and its five sets, with the count at its end: the number alone in a disc (his ask: \"circled button\"), a pop-up button for VoiceOver; no − / +", () => {
  assert.deepStrictEqual(r.closed, { sets: 5, cur: "Set 1 of 5", text: "5", label: "5 sets", popup: "menu", chevrons: 0, last: true, steps: 0, pos: 0 });
});

test("a tap opens Apple's list of 1 to 20 sets, the one in effect ticked, twelve in view and the rest a scroll away; hung from the count's right edge, over it", () => {
  assert.deepStrictEqual(r.opened, { open: true, classes: ["menu", "checks", "long", "hung"], rows: LIST, ticked: ["5 sets"], stopped: true, top: "330px", left: "125px", cap: "", scrolled: 0, focus: true }, "a tap leaves focus where it was");
});

test("a pick sets every exercise in the card and saves; more sets, or fewer with nothing logged on them, ask nothing", () => {
  assert.strictEqual(r.picked7, "7 sets");
  assert.deepStrictEqual(r.seven, { open: false, sets: [7, 7], saved: true, asked: false, text: "7", label: "7 sets", chips: 7 });
  assert.deepStrictEqual([r.ticked7, r.four], [["7 sets"], { sets: [4, 4], saved: true, asked: false }]);
  assert.deepStrictEqual(r.same, { open: false, sets: [4, 4], saved: false }, "the ticked row picked again: the list closes and nothing is saved");
  assert.deepStrictEqual(r.nothingLogged18, { sets: [2, 2], asked: false }, "eighteen to two, nothing logged");
  assert.deepStrictEqual(r.keepsLogged, { asked: false, sets: [3, 3], weights: ["50", "50", "50"] }, "logged on sets 1 to 3 only: going to three loses nothing");
});

test("a pick changes its own card only, and asks only about its own sets (a second card with weights on sets 4 and 5 stays as it is)", () => {
  assert.deepStrictEqual(r.cards, ["1", "2"]);
  assert.deepStrictEqual(r.ownCard, { asked: false, sets: ["a:3", "b:3", "c:5"] });
});

test("a double tap on the count: the list opens over it and the second tap, on its first row, picks nothing; a tap after picks; a keyboard's pick is never held (a review's catch: it picked 1 set)", () => {
  assert.deepStrictEqual(r.doubleTap, { open: true, sets: [5, 5], saved: false });
  assert.deepStrictEqual(r.afterWait, { open: false, sets: [1, 1] });
  assert.deepStrictEqual(r.keyAtOnce, { sets: [3, 3] });
});

test("fewer sets with something logged on any set that goes asks first, naming them all (the old check looked only at the first to go); Cancel keeps them, Drop drops them", () => {
  const ask = (title, many) => ({ open: true, title, text: many ? "What was logged on them goes with them." : "What was logged on it goes with it.", yes: "Drop" });
  assert.deepStrictEqual(r.askMany, ask("Drop sets 4 to 7?", true), "seven to three, a weight on set 6 only");
  assert.deepStrictEqual(r.cancelled, { open: false, sets: [7, 7], saved: false });
  assert.deepStrictEqual(r.dropped, { open: false, sets: [3, 3], saved: true, text: "3" });
  assert.deepStrictEqual(r.askTwo, ask("Drop sets 4 and 5?", true), "five to three, reps on set 5");
  assert.deepStrictEqual(r.askOne, ask("Drop set 5?", false), "five to four, all five done on one exercise");
  assert.deepStrictEqual(r.oneDropped, { sets: [4, 4], setsDone: 4, done: true });
});

test("a set added to finished exercises opens them again, as the + did", () => {
  assert.deepStrictEqual(r.reopened, { sets: [6, 6], done: [false, false], asked: false });
});

test("the list opens with the ticked row in view, in the middle where the list allows (Safari's own list, measured: reopened on 18 it opens there)", () => {
  assert.deepStrictEqual(r.at18, { ticked: ["18 sets"], scrolled: 12 + 17 * 42 - (528 - 42) / 2 });
});

test("from the keyboard or VoiceOver: into the list on the ticked row; ↑ ↓ go from row to row and stop at its ends; Escape closes and the count has focus again", () => {
  assert.deepStrictEqual(r.keys, ["5 sets", "6 sets", "5 sets", "4 sets", "1 set", "count"]);
  assert.deepStrictEqual([r.keysClosed, r.tapFocus], [true, true]);
});

test("a pick from the keyboard leaves the focus on the count, drawn anew; so does Cancel on the question; a tap's pick leaves focus alone", () => {
  assert.deepStrictEqual(r.keyPick, { sets: [6, 6], focus: true, text: "6" });
  assert.deepStrictEqual(r.keyCancel, { asked: true, sets: [6, 6], focus: true });
  assert.deepStrictEqual(r.tapPick, { sets: [3, 3], focus: false });
  assert.deepStrictEqual(r.keyFinish, { asked: false, sets: [3, 3], done: [true, true], folded: true, focus: true }, "a pick that finishes the card folds it and hides its count: the place goes to its chevron (a review's catch)");
});

test("the list scrolling inside itself stays open; the page scrolling closes it, and it listens for no scroll after", () => {
  assert.deepStrictEqual([r.ownScroll, r.pageScroll, r.scrollListeners], [true, false, { added: 1, capture: [true], left: 0 }], "a page takes a listener off only in its own phase");
});

test("after the sets' list, another menu is as it always was: not long, no cap", () => {
  assert.deepStrictEqual(r.nextMenu, { open: true, long: false, cap: "", first: "Add alternatives" });
});

test("a phone turned sideways: the list no taller than what shows, scrolling inside it; upright again, Apple's twelve rows", () => {
  assert.deepStrictEqual(r.sideways, { cap: "386px", top: "8px" }, "402 tall, 8 off each edge");
  assert.deepStrictEqual(r.upright, { cap: "" });
  assert.deepStrictEqual(r.sideways18, { cap: "386px", scrolled: 12 + 17 * 42 - (386 - 42) / 2 }, "eighteen in the middle of the shorter list");
});

test("a sync that replaced the workout while the question was up: Drop goes into the workout there now; one deleted meanwhile is left deleted", () => {
  assert.deepStrictEqual(r.synced, { now: [4, 4], title: "Synced", oldKept: [5, 5] });
  assert.deepStrictEqual(r.gone, { asked: true, threw: null, back: false });
  assert.deepStrictEqual(r.syncedOff, { sets: ["a:4", "c:5"] }, "an exercise the sync took off the card is not brought back; the other card is left alone");
  assert.deepStrictEqual(r.rejected, [], "no pick threw after its question");
});

test("a template: the same disc with its number; the change waits in its draft", () => {
  assert.deepStrictEqual(r.template, { text: "5", label: "5 sets", pos: 0 });
  assert.deepStrictEqual(r.templatePicked, { sets: [3, 3], draft: true, saved: false });
});

test("the client, and the coach's Client view, see the set bar as before, with no count to change", () => {
  assert.deepStrictEqual([r.client, r.preview], [{ count: false, cur: "Set 1 of 5" }, { count: false, cur: "Set 1 of 5" }]);
});

test("the count is a disc as tall as the set bar, in the play disc's ink; the − / + and their styles are gone; the long list has its rim on itself", () => {
  assert.ok(html.includes("  .tracker:has(> .tr-count) { flex-wrap: nowrap; }"), "one line always: the count never takes a line of its own");
  assert.ok(html.includes("  .tracker .tr-count { position: relative; display: flex; align-items: center; justify-content: center; flex: none; align-self: center; width: 48px; min-width: 48px; height: 48px; padding: 0; border: 0; border-radius: 50%; background: var(--ink); color: var(--ink-on); font-size: 1.0625rem; font-weight: 600; letter-spacing: 0; font-variant-numeric: tabular-nums; white-space: nowrap; -webkit-tap-highlight-color: transparent; }"), "48 across, as tall as the bar; white on his dark phone, black in light; 17 semibold, 99 fits");
  const hoverAt = html.indexOf("  @media (hover: none) { .tracker .tr-count:hover { opacity: 1; } }"), activeAt = html.indexOf("  .tracker .tr-count:active { opacity: 0.6; }");
  assert.ok(hoverAt > 0 && activeAt > hoverAt, "no hover dim kept on a phone, and the press dim after it so it wins");
  assert.ok(html.includes("  #whenPop.menu.long { max-height: 528px; overflow-y: auto; overscroll-behavior: contain; scrollbar-width: none; box-shadow: 0 10px 30px var(--glass-menu-shadow), 0 0 0 0.5px var(--glass-menu-edge), inset 0 0.5px 0 var(--glass-menu-rim), inset 0 -0.5px 0 var(--glass-menu-rim-b); }"), "twelve rows of 42 and its padding; the rim on the bubble itself");
  assert.ok(html.includes("  #whenPop.menu.long::after { display: none; }"), "the ring of its own scrolled away with the rows (seen on the simulator)");
  for (const gone of [".tr-steps", ".tracker .step"]) assert.ok(!html.includes(gone), gone);
  for (const gone of ["One set fewer", "One set more", '"step minus"', '"step plus"', "tr-steps"]) assert.ok(!src.includes(gone), gone);
  assert.ok(src.includes('window.addEventListener("scroll", onScroll, true)') && !src.includes('window.addEventListener("scroll", close, true)'), "a menu's own scroll keeps it");
});
