// v312, the owner's report (16 Nov 2026, twice with one client, screenshots of a tri-set in the coach's Client view): "for the last 4th set it didn't let me
// log neither weight and reps for first one or two exercises and only let me log in the last". Two exercises of the card kept 3 sets and the third had the 4 a
// new exercise starts with; the card showed 4 (the most any of them has), and on set 4 the first two had no boxes.
// v313, the owner's rule (17 Nov 2026): "superset will always have the same number as default .... if I have a1 and a2 with 8 sets and I add another exercise it
// will let the 8 sets ... but then I want an option in coaches view in the 3 dot button ... that will somehow lets me change the amount of sets for only that
// exercise ... clients view will then get somehow clean message that that exercise only that exercise has fewer sets ... all of my templates can stay the way
// they are". His picks after the pictures: Sets in the exercise's "…" (Default, or fewer), taken out of a superset an exercise keeps its sets, and on the
// superset's extra set an exercise done with its own says Done with a green tick (B). The card plays in card-sets-probe.mjs.
import path from "node:path";
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { test, assert } from "./assert.js";
const here = path.dirname(fileURLToPath(import.meta.url));
const r = JSON.parse(execFileSync(process.execPath, [path.join(here, "card-sets-probe.mjs")], { encoding: "utf8", timeout: 90000 }).trim().split("\n").pop());
const html = fs.readFileSync(path.join(here, "..", "index.html"), "utf8");
const done = { boxes: false, short: "Done" }, only3 = { boxes: false, short: "3 sets only" }, boxes = { boxes: true, short: null };
const mark3 = { fewer: true, own: "3 sets" }, none = { fewer: false, own: null };

test("the owner's tri-set as it is on record (A and B with 3 sets, done; C with 4, sets 1 to 3 done), on set 4, in the client's app, the coach's Client view and the coach's own look: A and B say Done (a green tick), C has its boxes; A and B carry their \"3 sets\" (the client's line, the coach's look under the name)", () => {
  for (const v of ["client", "preview", "coach"]) assert.deepStrictEqual(r[v], { cur: "Set 4 of 4", rows: [done, done, boxes], marks: [mark3, mark3, none] }, v);
});

test("a program's exercise with fewer sets on purpose (a tri-set of 4, 4 and 3) stays as it is (the owner: \"all of my templates can stay the way they are\"): Done on set 4, and Complete last set never logs a made-up 4th set", () => {
  assert.deepStrictEqual(r.planned, { c: done, button: "Complete last set →", after: ["a:4:4:done:40/10", "b:4:4:done:30/10", "c:3:3:done:/"] });
});

test("Done only for an exercise done with its own sets: one finished early (fewer done) says \"3 sets only\"; a finished workout says Done in the coach's own look (the client's look holds its unfinished card as one still to come, where the line hides); a card of 5 with an exercise of 3 says Done on sets 4 and 5; nothing threw", () => {
  assert.deepStrictEqual(r.early, only3);
  assert.deepStrictEqual(r.finished, { coach: [done, done], client: { block: ["ahead", "block"], locked: true } });
  assert.deepStrictEqual(r.fiveCard, { at4: done, at5: done, cur: "Set 5 of 5" });
  assert.deepStrictEqual(r.rejected, []);
});

test("an exercise put into a superset takes its sets (the owner's words, typed: a1 and a2 with 8, the one added gets 8; the + Add exercise's 4 picked into a superset of 3 gets 3), never fewer than it holds something on; taken out it keeps them (his answer); a number typed on the way to another joins nothing", () => {
  assert.deepStrictEqual(r.typed, ["a:8", "b:8", "n:8"]);
  assert.deepStrictEqual(r.joinedNew, [4, 3, 3, [none, none, none]], "4 before, 3 after, the card's 3 sets, nobody short");
  assert.deepStrictEqual(r.typedOn, ["a:3", "b:3", "n:4"]);
  assert.deepStrictEqual(r.joinedLogged, [["a:3", "b:3", "n:4"], ["a:3:0:open:/", "b:3:0:open:/", "n:4:4:done:30/10"]], "its 4 logged sets stay");
  assert.deepStrictEqual(r.leftKeeps, ["a:5", "b:5", "n:4"]);
  assert.deepStrictEqual(r.swap, ["2", "3", ["b:4", "p:3", "r:4", "s:4"], true], "a reorder through a shared number: the row took the bench's 4 and kept it");
});

test("the card's sets button on a superset where one exercise has fewer: the superset's own number moves and the one with fewer keeps them, unless the superset goes below them", () => {
  assert.deepStrictEqual([r.disc5, r.disc3, r.disc2], [[5, 5, 3], [3, 3, 3], [2, 2, 2]]);
});

test("Sets in the exercise's \"…\" (the coach's own look, a superset only): the choice in effect under the name, a list of its own over the dimmed menu (Default, a line, then fewer), its head closes it again; a pick sets that exercise alone and saves", () => {
  assert.deepStrictEqual(r.menuMixed, { rows: ["Add alternatives", "Add instructions", "Sets3 sets", "Delete exercise"], list: ["Sets3 sets", "Default (4 sets)", "3 sets ✓", "2 sets", "1 set"], state: { sub: true, dimmed: true, expanded: "true" }, sets: [4, 4, 4], saved: true, open: false });
  assert.deepStrictEqual(r.menuDefault, ["SetsDefault (4 sets)", "Default (4 sets) ✓", "3 sets", "2 sets", "1 set"]);
  assert.deepStrictEqual(r.menuFewer, [[2, 4, 3], "Set 1 of 4", { fewer: true, own: "2 sets" }], "the one at the superset's number given fewer: the others keep the 4");
  assert.deepStrictEqual(r.menuHead, { sub: false, dimmed: false, subopen: false, open: true });
  assert.strictEqual(r.menuKeys, "3 sets", "from the keyboard: on the choice in effect");
});

test("no Sets for an exercise on its own, in the client's app or in the coach's Client view", () => {
  for (const k of ["menuSingle", "menuClient", "menuPreview"]) assert.deepStrictEqual(r[k], ["Add alternatives", "Add instructions", "Delete exercise"], k);
});

test("fewer with something logged on a set that goes asks first, naming the sets (as the sets button does); Cancel keeps everything", () => {
  const q = { open: true, title: "Drop sets 3 and 4?", text: "What was logged on them goes with them.", yes: "Drop" };
  assert.deepStrictEqual(r.menuDrop, { q1: q, kept: ["a:4:3:open:/", "b:4:3:open:/"], q2: q, after: ["a:4:3:open:/", "b:2:2:done:/"], b: 2 });
});

test("the looks: the Done tick in the fern colour, the client's \"3 sets\" shown in the open card for a shorter exercise only, the coach's line under the name, the menu's second line and list; Add set is gone", () => {
  for (const rule of [
    ".setlog-short .short-done svg { width: 1.25rem; height: 1.25rem; flex: none; color: var(--done); }",
    ".setlog-short .short-done svg path { stroke: var(--done-ink); }",
    "body.client .block:not(.ahead) .row.fewer .sum .sum-sets { display: inline; }",
    "body.client .block:not(.ahead) .row.fewer .sum .si.sum-sets + .si::before { content: \"\\2022\"; }",
    ".block.done:not(.open) .row .own-sets { display: none; }",
    "#whenPop.menu .wopt.two { min-height: 60px; }",
    "#whenPop.subopen > :not(.msub) { opacity: 0.5; }",
    "#whenPop .msub .wopt:not(.mhead) { position: relative; padding-left: 32px; }",
    "#whenPop .msub { overflow-y: auto; overscroll-behavior: contain; touch-action: pan-y; scrollbar-width: none; }",
    "body.client .block.ahead .row .setlog-short, #rows.locked .block.peek .row .setlog-short, .block.done:not(.open) .row .setlog-short, #vTraining.tpl .setlog-short { display: none; }",
  ]) assert.ok(html.includes(rule), rule);
  assert.ok(!/add-set/.test(html) && !/add-set/.test(fs.readFileSync(path.join(here, "..", "app", "main.js"), "utf8")), "no Add set left");
});

test("a template stays as it is (no change on its own) and shows the coach's \"3 sets\"; a change made in its \"…\" or by a join waits in its draft, as every template change does", () => {
  assert.deepStrictEqual(r.template, { before: [4, 4, 3], mark: mark3, after: [4, 4, 4], draft: true, saved: false });
  assert.deepStrictEqual(r.templateJoin, { sets: ["a:8", "b:8", "n:8"], draft: true, saved: false });
});

test("after the v313 review: a keyboard's pick comes back to the exercise's \"…\", or to the chevron of the card it finished and folded; up and down stay in the list (its head the top, never the dimmed menu); a double tap keeps the list open (its head takes no tap in its first 350 ms); a pointer's click on Sets after a keyboard's Enter keeps the keyboard's place", () => {
  assert.deepStrictEqual(r.keysBack, [[4, 4, 2], "c:more-btn"]);
  assert.deepStrictEqual(r.keysFold, [["a:4:done", "b:3:done"], "block done", "card-chev"]);
  assert.deepStrictEqual(r.arrows, ["wopt:3 sets", "wopt:2 sets", "wopt:1 set", "wopt:1 set", "wopt:2 sets", "wopt:3 sets", "wopt:Default (4 sets)", "wopt.mhead:Sets3 sets", "wopt.mhead:Sets3 sets"]);
  assert.deepStrictEqual(r.doubleTap, [true, false, true], "kept through the second tap; a later tap on its head closes it, the menu stays");
  assert.deepStrictEqual(r.mixedFocus, ["wopt:Add alternatives", "wopt:3 sets"]);
});

test("after the v313 review: an exercise finished before the set counter keeps its own sets done when given more, the added ones open; a number typed into the label and then an alternative picked joins first (the superset's sets); a right-click's menu (the Mac) has Sets too", () => {
  assert.deepStrictEqual(r.legacy, [4, 3, false]);
  assert.deepStrictEqual(r.altJoin, [true, ["a:3", "b:3", "n:3"], "Cable row"]);
  assert.deepStrictEqual(r.rightClick, { rows: ["Add alternatives", "Add instructions", "Sets3 sets", "Delete exercise"], list: ["Sets3 sets", "Default (4 sets)", "3 sets ✓", "2 sets", "1 set"], sets: [4, 4, 2], open: false });
});

test("after the second review: an exercise already begun keeps its count when it joins a superset (a finished one is not opened again, and nothing is marked done on the others), and put back it is as it was; a pointer's click on the list's head keeps the keyboard's place (back on Sets); a menu that fits neither under nor over its button (the \"…\" with Sets on a phone turned sideways) stays on the screen", async () => {
  assert.deepStrictEqual(r.begunJoin, [["a:1a:4:0:open", "b:1b:4:0:open", "x:1c:3:3:done"], ["a:1a:4:0:open", "b:1b:4:0:open", "x:2:3:3:done"]]);
  assert.deepStrictEqual(r.headPointer, ["wopt:3 sets", "wopt:Sets3 sets", false, true]);
  assert.deepStrictEqual(r.menuFits, ["202px", false], "402 tall: 202 + 192 = 394, the screen's foot less 8 (v312's rule put it at -20)");
  assert.deepStrictEqual(r.menuOverGuard, [true, false], "drawn over its own button, its rows take no tap in the first 350 ms (the final check: a double tap's second picked Do it today); a later tap picks, and the menu closes");
  assert.deepStrictEqual(r.underWayJoin, ["a:3:0:open", "b:3:0:open", "x:3:3:done"], "an exercise under way takes the superset's sets (only a finished one keeps its own: the final check)");
  const fs = await import("node:fs"), src = fs.readFileSync(new URL("../app/main.js", import.meta.url), "utf8");
  assert.ok(src.includes("const live = $(\"rows\").querySelector('.row[data-id=\"' + id + '\"]'); if (!live) return null;"), "the glide follows the row as drawn now and stops when it is gone (a pick that drew the cards again sent the page to the top)");
});
