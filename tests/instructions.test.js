// His ask, 13 Nov: "unify adding instructions .. make it coherent with the way all app work with adding things". Every other row of a "…"
// that asks for words opened a sheet (New folder, Rename, Alternatives); Add instructions opened a panel floating over the card, with Clear
// (which took them off without asking) and Done. His pick the same day, after pictures: a sheet as New folder's and Rename's, Add (or Save
// when there are some) over Cancel; nothing changes until Add or Save, and the box saved empty takes them off. The client's view is as it was.
// The sheet plays in its own process (instructions-probe.mjs).
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test, assert } from "./assert.js";
const here = path.dirname(fileURLToPath(import.meta.url));
const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const src = fs.readFileSync(new URL("../app/main.js", import.meta.url), "utf8");
const r = JSON.parse(execFileSync(process.execPath, [path.join(here, "instructions-probe.mjs")], { encoding: "utf8", timeout: 90000 }).trim().split("\n").pop());
const sheet = (o) => ({ open: true, asking: true, behind: true, focus: true, ...o });

test("the \"…\" row opens a sheet as New folder's: its title, a line naming the exercise, an empty box, and Add, which waits for words", () => {
  assert.deepStrictEqual(r.menu, ["Add alternatives", "Add instructions", "Delete exercise"]);
  assert.strictEqual(r.picked, "Add instructions");
  const opened = sheet({ title: "Add instructions", lead: "Your client sees these under Leg press.", button: "Add", value: "", off: true });
  assert.deepStrictEqual(r.addOpen, opened, "the page behind out of reach, the box ready to type in (the tap that asked gives the phone's keyboard)");
  assert.deepStrictEqual(r.addArmed, opened, "still nothing to add");
  assert.deepStrictEqual([r.spacesOnly, r.spacesNotAdded], [{ off: true }, { open: true, note: "" }], "spaces alone are no words");
});

test("Add keeps the words, trimmed at their ends, a line break inside kept (the client's view shows it); nothing is saved before Add", () => {
  assert.deepStrictEqual(r.typed, { off: false, saved: false, note: "" }, "typing saves nothing");
  assert.deepStrictEqual(r.added, { open: false, note: "Feet low on the platform.\nPush through the heels.", saved: true, asking: false, behind: false, focus: false });
  assert.deepStrictEqual(r.menuAfter, ["Add alternatives", "Edit instructions", "Delete exercise"]);
});

test("the second tap of a double tap neither adds nor closes", () => {
  assert.deepStrictEqual([r.early, r.earlyDim, r.late], [{ open: true, note: "" }, { open: true }, { open: false, note: "Quick" }]);
});

test("some there: Edit instructions, the words in the box, Save; Cancel, the dim and Escape keep them as they were", () => {
  assert.strictEqual(r.picked2, "Edit instructions");
  assert.deepStrictEqual(r.editOpen, sheet({ title: "Edit instructions", lead: "Your client sees these under Curl.", button: "Save", value: "Elbows still", off: true }));
  assert.deepStrictEqual(r.editArmed, { off: false });
  const kept = { open: false, note: "Elbows still", saved: false };
  assert.deepStrictEqual(r.cancelled, { ...kept, asking: false, behind: false });
  assert.deepStrictEqual([r.dimmed, r.escaped], [kept, kept]);
  assert.deepStrictEqual(r.saved, { open: false, note: "Elbows still, slow down", saved: true });
  assert.deepStrictEqual(r.unchanged, { open: false, saved: false }, "Save with nothing changed saves nothing");
});

test("Save with the box empty takes the instructions off (no Clear that deletes without asking), and the row says Add again", () => {
  assert.deepStrictEqual([r.emptyOff, r.removed], [{ off: false }, { open: false, note: "", saved: true }]);
  assert.deepStrictEqual(r.menuRemoved, ["Add alternatives", "Add instructions", "Delete exercise"]);
});

test("Return writes a new line; Command-Return on the Mac adds; from the keyboard the place goes back to the exercise's \"…\", a tap's does not", () => {
  assert.deepStrictEqual([r.returnKey, r.commandReturn], [{ open: true, kept: false }, { open: false, note: "Hold the top" }]);
  assert.deepStrictEqual([r.keysOpen, r.keysBack, r.tapBack], [{ focus: true }, { more: true }, { more: false }]);
});

test("the phone's keyboard up: the sheet's foot clears it; on a small phone the box gets shorter, never under three lines; it all goes on closing", () => {
  assert.deepStrictEqual(r.liftRoomy, { pad: "352px", cap: "143px" }, "the keyboard's 336 and 16");
  assert.deepStrictEqual(r.liftTight, { cap: "114px" }, "874 - 24 - (760 - 24): the box squeezed to nothing keeps its 24 of padding, which is the box's own room (a review's catch: it was counted twice)");
  assert.deepStrictEqual(r.liftFloor, { cap: "96px" }, "three lines and the padding, at the least");
  assert.deepStrictEqual(r.liftDown, { pad: "", cap: "" });
  assert.deepStrictEqual(r.liftGone, { pad: "", cap: "", added: 1, left: 0 });
});

test("a template's change waits in its draft; an exercise gone under the sheet (a sync) is written nowhere", () => {
  assert.deepStrictEqual(r.template, { note: "Brace first", draft: true, saved: false });
  assert.deepStrictEqual(r.gone, { open: false, saved: false });
  assert.strictEqual(r.noRow, false, "no sheet for an exercise that is not there");
});

test("the sheet is New folder's: the same shell, the name field's look in five lines, Add over Cancel; the floating panel is gone", () => {
  assert.ok(html.includes('<div class="sheet-bg" id="noteSheet" hidden><div class="sheet ask confirm-sheet note-sheet" role="dialog" aria-modal="true" aria-labelledby="noteTitle"><h3 id="noteTitle">Add instructions</h3><p class="lead" id="noteLead"></p><textarea class="note-input" id="noteField" rows="5" maxlength="500" placeholder="Instructions for the client" autocomplete="off" autocapitalize="sentences" aria-labelledby="noteTitle" aria-describedby="noteLead"></textarea><div class="ask-actions"><button class="btn" id="noteOk" type="button">Add</button><button class="btn quiet" id="noteNo" type="button">Cancel</button></div></div></div>'));
  assert.ok(html.includes("  .sheet.confirm-sheet .note-input { display: block; width: 100%; box-sizing: border-box; margin: 4px 0 0; height: calc(7em + 24px); min-height: 0; padding: 12px 14px; border: 0; border-radius: var(--r-field); background: var(--field); color: var(--text-primary); font: inherit; font-size: 1.0625rem; line-height: 1.4; letter-spacing: 0; resize: none; overflow-y: auto; }"), "the name field's look (17 px, so the phone does not zoom in), five lines, a longer text scrolls");
  assert.ok(src.includes('note: (e) => { letGo(); editNote(t.id, r.id, byKeys(e)); }'), "the row opens the sheet itself, as Alternatives' row does");
  for (const gone of ["alt-menu", "note-pop", "note-field", "alt-foot", "closeOpenAlt"]) assert.ok(!html.includes(gone) && !src.includes(gone), gone);
  assert.ok(!/\b(openNote|closeNote|showNote)\b/.test(src), "the panel's own code (the client's openNotes, what she has opened, stays)");
  assert.ok(!/(^|[^\w-])\.?note-btn\b/.test(html + src), "the hidden button the row clicked");
});

test("a press that began in the box and let go on the dim (words selected with the mouse past the sheet's edge) keeps the sheet and the words; a tap on the dim closes it", () => {
  assert.deepStrictEqual(r.dragOut, { open: true, value: "Elbows still, hips down", note: "Elbows still" });
  assert.deepStrictEqual(r.tapDim, { open: false, note: "Elbows still" });
});

test("every way of closing takes away all it put up (keys, keyboard, field, buttons, dim): an earlier sheet's Command-Return never writes into another exercise, and none acts with no sheet up", () => {
  assert.deepStrictEqual(r.cleanup, { cancel: true, dim: true, escape: true, add: true, command: true });
  assert.deepStrictEqual(r.others, { a: "", b: "Curl words" }, "Leg press's cancelled words stay out of it");
  assert.deepStrictEqual(r.stray, { a: "", b: "Curl words", saved: false });
});

test("a sync that replaced the workout under a touch and hold (its redraw held back): after Add the cards are drawn again; cards that were the record's are left as they are", () => {
  assert.deepStrictEqual(r.stale, { rebuilt: true, note: "Brace first" });
  assert.deepStrictEqual(r.fresh, { kept: true, note: "Curl it" });
});
