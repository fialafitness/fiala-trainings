// The owner's asks, 14 Nov (v298), after pictures on the test phone and the owner's picks:
// - "press and hold will have one more option and that is to delete ... only coach", on a workout in Today and Up next (not the calendar),
//   and the Missed card's too (the owner's pick): Delete, last and red after a line, as Apple ends a menu with its destructive row; it asks first,
//   as the workout page's own Delete does, and the row goes from its list with the page staying where it is. The client never has it.
//   The page runs in its own process (row-delete-probe.mjs). The v298 review added: a workout finished or skipped meanwhile (a menu left
//   open, or the question up, while a sync brought it in) is never deleted, as the menu's Skip and Reschedule refuse it; and a keyboard's
//   or VoiceOver's place comes back from the closed question, as the preview's Delete and Reschedule give it back. A second review: the place
//   is its own row wherever a sync has drawn it (or the row now in its slot, as a list closes up), not always the deleted workout's. A
//   safety check, in the question every Delete asks and the Skip sheet: a person's double press no longer lands its second press on the
//   page behind, and the first button takes the keyboard's ring only after a key.
// - "change height of template folders to fit the sliding buttons better", the owner's pick A: a folder's row as tall as a template's two-line row
//   (72.5), so its sliding Delete and Move to fit, word and all.
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test, assert } from "./assert.js";
const here = path.dirname(fileURLToPath(import.meta.url));
const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const r = JSON.parse(execFileSync(process.execPath, [path.join(here, "row-delete-probe.mjs")], { encoding: "utf8", timeout: 90000 }).trim().split("\n").pop());
const DEL = { label: "Delete", danger: true, sep: true, trash: true };

test("the coach's touch and hold (and right-click) on a workout in Today, Up next and the Missed card ends in Delete: red, the trash, after a line; the Missed card's \"…\" too", () => {
  assert.deepStrictEqual(r.coach, { today: ["Reschedule", "Skip", "Preview", "Delete"], next: ["Reschedule", "Skip", "Preview", "Delete"], missed: ["Do it today", "Reschedule", "Skip", "Preview", "Delete"], item: DEL, missedItem: DEL });
  assert.deepStrictEqual(r.drawn, { missed: ["late"], today: ["now"], next: ["next"] });
});

test("Delete asks first, as the workout page's own Delete; Cancel keeps it", () => {
  assert.deepStrictEqual(r.asked, { open: true, title: "Delete this workout?", text: "It goes for good, with everything logged on it.", yes: "Delete" });
  assert.deepStrictEqual(r.cancelled, { done: false, kept: true, missed: ["late"], today: ["now"], next: ["next"], sheet: false, view: "client" });
});

test("Delete: gone for good and saved, its list drawn without it, the client's page staying where it is (no step: nothing to go back to); the Missed card's the same", () => {
  assert.deepStrictEqual(r.deleted, { done: true, kept: false, saving: true, missed: ["late"], today: [], next: ["next"], view: "client/c1", depth: 0 });
  assert.deepStrictEqual(r.missedDeleted, { done: true, kept: false, missed: [], today: [], next: ["next"] });
});

test("a sync that took the workout away while the question was up: Delete does nothing more, and nothing throws", () => {
  assert.deepStrictEqual(r.goneMeanwhile, { done: false, sheet: false });
  assert.deepStrictEqual(r.rejected, []);
});

test("a workout finished or skipped meanwhile is never deleted: a menu left open while a sync brought in the client's finish asks nothing, and a finish or skip arriving while the question is up keeps it", () => {
  assert.deepStrictEqual(r.staleMenu, { done: false, asked: false, kept: true, saving: false });
  assert.deepStrictEqual(r.finishedMeanwhile, { done: false, kept: true, saving: false, sheet: false });
  assert.deepStrictEqual(r.skippedMeanwhile, { done: false, kept: true, saving: false, sheet: false });
});

test("a keyboard's or VoiceOver's place: Cancel puts it back on its row, Delete on the row now where it was (the next missed one's \"…\"), off the closed question when none is left; a pointer's is left alone", () => {
  assert.deepStrictEqual(r.keyCancel, { done: false, asking: "question", after: "row:now", old: true });
  assert.deepStrictEqual(r.keyDelete, { done: true, asking: "question", after: "row:now2", old: false });
  assert.deepStrictEqual(r.keyDeleteLast, { done: true, asking: "question", after: "page", old: false });
  const o = r.keyDeleteMiddle.order; assert.strictEqual(o.length, 3, "three rows today: " + o);
  assert.deepStrictEqual(r.keyDeleteMiddle, { order: o, done: true, asking: "question", after: "row:" + o[2], old: false }, "the middle one deleted: the row after it, as a list moves on (not the first)");
  assert.deepStrictEqual(r.keyMissed, { done: true, after: "more:late2", drawn: ["late2"] });
  assert.deepStrictEqual(r.keyRedrawn, { done: false, asking: "question", after: "row:now", old: false }, "the list drawn again while the question was up: the row's new button");
  assert.deepStrictEqual(r.keyRefused, { done: false, asking: "question", after: "row:now2", old: false }, "the client's finish synced in (the redraw every sync ends with took the row to History): the row now in its slot");
  assert.deepStrictEqual(r.pointer, { done: true, after: "question" }, "no row's place: the focus is not put on a row (where the question left it, as after every question)");
});

test("the keyboard's place is its own row wherever it is drawn now: on another row (a right-click or a hold moves no focus), moved to another list by a sync, or a menu row after a sync drew the lists anew; Show more's list closes up onto the row that came up", () => {
  assert.deepStrictEqual(r.otherCancel, { done: false, asking: "question", after: "row:now2", old: true }, "the place on now2, the menu on now: Cancel leaves it on now2");
  assert.deepStrictEqual(r.otherDelete, { done: true, asking: "question", after: "row:now2", old: false }, "and Delete leaves it on now2, drawn anew (not now2's neighbour)");
  assert.deepStrictEqual(r.crossCancel, { done: false, asking: "question", after: "more:late", old: true }, "the place in another list stays there");
  assert.deepStrictEqual(r.crossDelete, { done: true, asking: "question", after: "more:late", old: false });
  assert.deepStrictEqual(r.movedCancel, { done: false, asking: "question", after: "row:late", old: false }, "the client's Do it today synced in while the question was up: the row found in Today (its button: a Today row has no \"…\")");
  assert.deepStrictEqual(r.menuCancel, { done: false, after: "row:now" }, "the focus still on the menu's own row (a sync drew the lists anew while it was up): this workout's row");
  assert.deepStrictEqual(r.menuDelete, { done: true, after: "row:now2" });
  assert.deepStrictEqual(r.menuMissed, { done: true, after: "more:late2" }, "the Missed card's menu: the next missed one's \"…\"");
  const m = r.showMore; assert.deepStrictEqual(m.before, ["next"], "Up next folded: the next one alone"); assert.deepStrictEqual(m.shown, ["next", "n5", "n6", "n7", "n8", "n9"], "Show more once: five more");
  assert.deepStrictEqual({ done: m.done, after: m.after, now: m.now }, { done: true, after: "row:n10", now: ["next", "n5", "n6", "n7", "n8", "n10"] }, "the last shown deleted: the one that came up into its slot, not the one above");
});

test("a question answered by a person's press eats the next click for 350 ms, so a double press's second never lands on the page behind (the workout that came up under it); a key's or a script's click arms nothing; the Skip sheet's the same", () => {
  assert.deepStrictEqual(r.eatPress, { at0: true, at200: true, at400: false }, "Cancel pressed: the next click eaten until 350 ms, not after");
  assert.strictEqual(r.eatDelete, true, "Delete pressed: the same");
  assert.strictEqual(r.eatKey, false, "a key's click (no count): nothing eaten after");
  assert.strictEqual(r.eatScript, false, "a script's click: nothing eaten after");
  assert.deepStrictEqual({ open: r.skipOpen, ...r.eatSkipKeep }, { open: true, closed: true, eaten: true }, "the Skip sheet's Keep pressed: closed, and the next click eaten");
  assert.deepStrictEqual(r.eatSkipGo, { skipped: true, eaten: true }, "its Skip workout pressed: skipped, and the next click eaten");
  assert.deepStrictEqual(r.eatSkipDim, { closed: true, eaten: true }, "its dim pressed: the same");
  assert.deepStrictEqual(r.eatAskDim, { done: false, closed: true, eaten: true }, "the question's dim pressed: kept, closed, and the next click eaten");
});

test("the question's Cancel and the Skip sheet's Skip take the keyboard's ring only after a key, never after a press (a right-click's or a hold's menu cancels its presses, and WebKit drew it for a finger)", () => {
  const ring = (v) => ({ preventScroll: true, focusVisible: v });
  assert.deepStrictEqual(r.ringKey, { cancel: ring(true), skip: ring(true) });
  assert.deepStrictEqual(r.ringPress, { cancel: ring(false), skip: ring(false) });
});

test("the client's own app: no Delete in any row's menu", () => {
  assert.deepStrictEqual(r.client, { today: ["Reschedule", "Skip", "Preview"], missed: ["Do it today", "Reschedule", "Skip", "Preview"] });
});

test("a template folder's row is as tall as a template's two-line row (the owner's pick A): the same padding and lines, so it stays so at any text size", () => {
  assert.ok(html.includes("  .list li[data-fid] > button { min-height: calc(26px + 1.55 * 1.0625rem + 1.55 * 0.8125rem); }"), "12 + 12 padding and the 2 between the lines, a 17-pt line and a 13-pt line, each 1.55 tall: 72.5");
  for (const rule of ["  .list button {\n    appearance: none; border: 0; background: none; width: 100%; text-align: left; cursor: pointer;\n    min-height: 56px; padding: 12px 20px;", "    font-size: 1.0625rem; letter-spacing: -0.01em; color: var(--text-primary); transition: opacity 300ms ease;",
    "  .list .pri { display: block; }", "  .list .sec { display: block; font-size: 0.8125rem; color: var(--text-tertiary); letter-spacing: 0; margin-top: 2px; }"]) assert.ok(html.includes(rule), "what the template's row is made of (change one, change the folder's sum): " + rule.trim().slice(0, 60));
  assert.ok(/\n {4}line-height: 1\.55;/.test(html), "the page's line height, 1.55");
});
