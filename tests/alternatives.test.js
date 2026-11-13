// His ask, 13 Nov: "I want to change somehow the alternate exercise ... I think the way I have it is not Apple like"; his pick the same day,
// "Pop-up on the name": Apple's pop-up button (Calendar's "Repeat  Never ⌃⌄", measured at 3x on iOS 27.2). An exercise with alternatives shows
// small up-and-down chevrons after its name (the client's) or at the end of its name field (the coach's, the name still typed in); a tap opens
// the menu over it: a tick on the exercise in effect, the alternatives under it, and for the coach, after Apple's line (Files, measured),
// Edit alternatives, which opens a small sheet (his "build it" after the pictures): Apple's red minus on each (a tap shows Delete, as the edit
// card of Contacts), Add alternative to type one and pick it from the names, two at most. The ⇄ disc is gone. The pages play in their own
// process (alternatives-probe.mjs).
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test, assert } from "./assert.js";
const here = path.dirname(fileURLToPath(import.meta.url));
const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const src = fs.readFileSync(new URL("../app/main.js", import.meta.url), "utf8");
const r = JSON.parse(execFileSync(process.execPath, [path.join(here, "alternatives-probe.mjs")], { encoding: "utf8", timeout: 90000 }).trim().split("\n").pop());
const count = (s) => html.split(s).length - 1;

test("the menu: a choice of one keeps a column for the tick on every row, the one in effect wears it (and is the current one for VoiceOver); a line parts its groups; a menu with no choice in it has no column", () => {
  assert.deepStrictEqual(r.menu, { open: true, rows: ["✓ Never", "Every day", "—", "Edit"], classes: ["menu", "checks", "hung"], left: "40px", top: "300px", tick: ["Never"], seps: ["separator"] }, "over its button, from its top and its left edge: no pointer drawn, never \"above\"");
  assert.deepStrictEqual({ rows: r.menuPlain.rows, classes: r.menuPlain.classes, tick: r.menuPlain.tick, seps: r.menuPlain.seps }, { rows: ["Copy", "—", "Delete"], classes: ["menu", "hung"], tick: [], seps: ["separator"] });
  assert.deepStrictEqual(r.menuFirstSep, ["Lead", "Next"], "a line never opens a menu");
  assert.deepStrictEqual(r.menuPick, { picked: [["Never", 0]], closed: true, stopped: true }, "a pick closes it and reaches the row with its event (a keyboard's pick: detail 0)");
});

test("the menu over a pop-up button: from the button's top, its edge at the button's (right: from its right edge); no room under it, up from the button's foot; taller than the screen, from the top margin; the home indicator's room kept", () => {
  assert.deepStrictEqual([r.menuLow.left, r.menuLow.top], ["110px", "624px"], "right-aligned: 360 - 250; at 760 a 180 menu runs past 866: its foot at the button's (804)");
  assert.strictEqual(r.menuTall.top, "8px");
  assert.strictEqual(r.menuSafe.top, "564px", "the safe area under it (34) and 8 more: its foot at the button's, 744");
  assert.strictEqual(r.menuSafe2, "534px", "past the home indicator's room though short of the screen's foot: up, its foot at the button's (714)");
});

test("the coach: the chevrons at the end of the name field where there is an alternative (a blank or the exercise's own name is none); the menu from them, its edge at theirs, its top 10 above them (the button's own top, measured); a pick swaps, saved, the one replaced among the alternatives", () => {
  assert.deepStrictEqual(r.coachChevrons, { a: { pop: true, wrap: true }, b: { pop: false, wrap: false }, c: { pop: false, wrap: false }, d: { pop: true, wrap: true }, clientPops: 0 });
  assert.deepStrictEqual(r.coachMenu, { open: true, rows: ["✓ Leg press", "Hack squat", "Goblet squat", "—", "Edit alternatives"], classes: ["menu", "checks", "hung"], left: "89px", top: "436px", tick: ["Leg press"], seps: ["separator"], stopped: true, keptFocus: true }, "339 - 250, 446 - 10; the press moves no focus (a name being typed keeps its caret), the tap goes no further");
  assert.deepStrictEqual(r.coachSwap, { name: "Goblet squat", alts: ["Hack squat", "Leg press"], named: true, saved: true, closed: true, pending: false, redrawn: true });
  assert.deepStrictEqual(r.coachMenuAfter, ["✓ Goblet squat", "Hack squat", "Leg press", "—", "Edit alternatives"]);
  assert.deepStrictEqual(r.coachCheckedPick, { name: "Goblet squat", closed: true }, "the ticked one: the menu closes, nothing changes");
});

test("the client: the name is the pop-up button, its last word and the chevrons wrapping together, its subtitle under it; the menu without Edit, from where the words start; the swap waits for the sync as before; no chevrons on a finished workout; on a card still to come the tap is the card's", () => {
  const btn = (parts) => ({ tag: "BUTTON", type: "button", popup: "menu", hiddenFromReader: null, parts });
  assert.deepStrictEqual(r.clientName, { a: btn(["Leg ", "nw:press+chev"]), b: false, c: false, d: { ...btn(["nw:Lunge+chev", "sub:walking"]), popup: null }, coachPops: [true, true] }, "read by VoiceOver as a menu button where it is one (the old view hid itself from it); Lunge's card is still to come: no menu promised there");
  assert.deepStrictEqual(r.clientMenu, { open: true, rows: ["✓ Leg press", "Hack squat", "Goblet squat"], classes: ["menu", "checks", "hung"], left: "74px", top: "380px", tick: ["Leg press"], seps: [], stopped: true }, "32 + the superset letter's 42");
  assert.deepStrictEqual(r.clientSwap, { name: "Hack squat", alts: ["Leg press", "Goblet squat"], pending: "Hack squat", named: false, saved: true });
  assert.deepStrictEqual(r.clientAhead, { chev: true, opened: false, stopped: false });
  assert.deepStrictEqual(r.clientLocked, { pops: 0 }, "a finished workout: the name alone (the lock's rule, his 11 Nov)");
  assert.deepStrictEqual([r.previewPop, r.previewMenu], [true, ["✓ Leg press", "Hack squat", "Goblet squat"]], "the coach looking as the client: the client's");
});

test("Edit alternatives: the sheet over the page (the page out of reach, syncs held), focused on itself from a tap, each alternative with Apple's red minus; a minus shows Delete (one at a time; again, or a tap anywhere else, takes it back); Delete removes it, saved", () => {
  assert.deepStrictEqual(r.sheetOpen, { open: true, lead: "Your client can swap Leg press for one of these.", rows: ["Hack squat", "Goblet squat"], menuClosed: true, asking: true, inert: [true, true, true], focus: "sheet" }, "two: no row to add a third");
  assert.deepStrictEqual([r.minusOnce, r.minusTwice, r.minusOther, r.tapElsewhere], [["Hack squat [Delete] (open)", "Goblet squat"], ["Hack squat", "Goblet squat"], ["Hack squat", "Goblet squat [Delete] (open)"], ["Hack squat", "Goblet squat"]]);
  assert.deepStrictEqual(r.deleted, { rows: ["Goblet squat", "+ Add alternative"], alts: ["Goblet squat"], saved: true, named: true, open: true });
});

test("Add alternative: a field in its row, in the tap that asked (the phone's keyboard), the names that start so first and never one it has; a pick adds it; Enter adds what is typed in the list's own spelling, never the exercise itself or one it has twice; Escape or leaving it empty gives the row back", () => {
  assert.deepStrictEqual(r.adding, { rows: ["Goblet squat", "+ [] (typing)"], focus: true, how: { preventScroll: true }, attrs: { placeholder: "Exercise", max: 120, key: "done", label: "Alternative exercise" } });
  assert.ok(r.typed.n > 3 && r.typed.n <= 20 && r.typed.startsFirst && r.typed.shortestFirst && r.typed.noTaken, JSON.stringify(r.typed));
  assert.deepStrictEqual([r.typedTaken, r.typedShort], [[], 0], "Goblet squat is one already; one letter offers nothing yet");
  assert.deepStrictEqual(r.picked, { name: r.typed.first[0], keptFocus: true, rows: ["Goblet squat", r.typed.first[0]], alts: ["Goblet squat", r.typed.first[0]], saved: true, hits: 0 }, "two now: the row to add one goes");
  assert.deepStrictEqual(r.enterAlias, { alts: ["Goblet squat", "Band face pull"], rows: ["Goblet squat", "Band face pull"], prevented: true }, "\"  band   face-pull \": the catalogue's Band face pull");
  for (const k of ["enterSelf", "enterDup", "enterBlank"]) assert.deepStrictEqual(r[k], { alts: ["Goblet squat"], rows: ["Goblet squat", "+ Add alternative"] }, k);
  assert.deepStrictEqual(r.escField, { alts: ["Goblet squat"], rows: ["Goblet squat", "+ Add alternative"], open: true, stopped: true }, "Escape in the field: its row back, the sheet stays");
  assert.deepStrictEqual(r.blurEmpty, { before: ["Goblet squat", "+ []"], after: ["Goblet squat", "+ Add alternative"] }, "0.2 s after leaving it empty");
  assert.deepStrictEqual(r.blurTyped, ["Goblet squat", "+ [Sled]"], "left with words in it: kept");
  assert.deepStrictEqual(r.minusWhileAdding, ["Goblet squat [Delete] (open)", "+ Add alternative"], "a minus tapped while typing: the field goes, Delete shows");
  assert.deepStrictEqual(r.kbClosed, { capped: true, after: "" }, "closed with the keyboard up: the list's height goes with it");
  assert.deepStrictEqual([r.vvWatch, r.kbLift, r.kbTight, r.kbDown, r.vvLeft], [2, ["390px", "488px"], "132px", ["", ""], 0], "the keyboard up (374): the rows 16 above it, the list no taller than the room left (874 - 62 - 24 - 300; never under three rows); down: as it was; closed: no watch left");
});

test("the sheet closes by Done, by a tap on the dim (not the second tap of a double tap), by Escape (after Escape takes a Delete back), by another question, and when its exercise is gone; it leaves nothing behind and the exercise is drawn again", () => {
  assert.deepStrictEqual(r.escDelete, { rows: ["Hack squat", "Goblet squat"], open: true });
  assert.deepStrictEqual(r.escClose, { open: false, asking: false, inert: [false, false, false], keyLeft: 0, clicksLeft: 0, rowsLeft: 0 });
  assert.deepStrictEqual([r.bgEarly, r.bgLate], [true, { open: false, redrawn: false }], "nothing changed: the page is not drawn again");
  assert.deepStrictEqual([r.done, r.otherAsk, r.rowGone], [{ open: false, asking: false }, { open: false }, { open: false, asking: false }]);
});

test("after the review: Done and the dim keep a name typed and not entered; closing draws only the exercise's chevrons, not the page (an open video plays on); the minus turns in place; from the keyboard Delete and Escape keep its place; a workout gone under it closes the sheet; a script's pick is not the keyboard's", () => {
  assert.deepStrictEqual(r.doneKeeps, { alts: ["Goblet squat", "Sled push"], open: false, redrawn: false, pop: true, measured: true }, "the name boxes measured again: the chevrons' room changes a name's lines");
  assert.deepStrictEqual(r.syncAfter, { redrawn: false }, "the next sync with nothing new keeps the cards (the recheck: the old picture made it rebuild them, stopping a video)");
  assert.deepStrictEqual(r.dimKeeps, { alts: ["Goblet squat", "Sled push"], open: false });
  assert.strictEqual(r.twoNoAdd, true);
  assert.deepStrictEqual(r.inPlace, { same: true, rows: ["Hack squat [Delete] (open)", "Goblet squat"], cls: true });
  assert.deepStrictEqual(r.inPlaceBack, { same: true, cls: false, rows: ["Hack squat", "Goblet squat"] });
  assert.deepStrictEqual(r.keysDelete, { rows: ["Goblet squat", "+ Add alternative"], focus: "next minus" });
  assert.deepStrictEqual(r.keysDeleteLast, { rows: ["+ Add alternative"], focus: "add" });
  assert.deepStrictEqual(r.keysEscape, { rows: ["+ Add alternative"], focus: "add" });
  assert.deepStrictEqual([r.goneDelete, r.goneBetween], [{ open: false, asking: false }, { open: false, asking: false }], "the workout gone before the minus, or between the minus and Delete");
  assert.strictEqual(r.scriptPick, "sheet");
});

test("the client's name is a pop-up button only where its chevrons show (the review: on a card still to come, folded or finished it promised a menu to VoiceOver and stopped the keyboard); the name of a folded finished card opens the card, as a tap on it does", () => {
  assert.deepStrictEqual(r.popLive, { doneFolded: { popup: null, tab: -1 }, current: { popup: "menu", tab: "default" }, ahead: { popup: null, tab: -1 } });
  assert.deepStrictEqual(r.popOpensCard, { open: true, summary: true, still: { popup: null, tab: -1 }, menu: false, disabled: "true", others: [null, null] }, "opened as its summary its name does nothing, and says so (no hand over it either)");
});

test("a keyboard's place in the sheet (the review: every action dropped it): on the Delete a minus showed, back on its minus with Escape, after a name picked on the row to add another or the name it added", () => {
  assert.strictEqual(r.keysMinus, "its Delete");
  assert.deepStrictEqual(r.keysEscDelete, { rows: ["Hack squat", "Goblet squat"], focus: "its minus", open: true });
  assert.deepStrictEqual(r.keysPick, { rows: 2, focus: "the new one's minus" });
  assert.deepStrictEqual(r.keysMinusFromField, { rows: ["Goblet squat [Delete] (open)", "+ Add alternative"], focus: "its Delete" }, "a minus pressed with the field still open: on the Delete of the row drawn anew");
  assert.deepStrictEqual(r.keysBlurRedraw, { rows: ["Goblet squat", "+ Add alternative"], focus: "its minus" }, "the empty field's own redraw keeps the minus it moved to");
  assert.deepStrictEqual(r.keysReturn, { rows: ["Goblet squat", "Sled push"], focus: "the new one's minus" }, "Return from the keyboard: on the name it added");
  assert.strictEqual(r.touchReturn, "let go", "Return on the phone's keys in a tapped sheet: the keyboard goes, no button ringed");
});

test("the menu over its button stays where it shows: up from the button's foot when the keyboard's top would cut it, never under the status bar; the number picker is left alone; a sync's copy of the workout under an open menu takes the swap", () => {
  assert.deepStrictEqual([r.overKeyboard, r.overStatus, r.overScrolled], ["264px", "70px", "170px"]);
  assert.strictEqual(r.numpick, true);
  assert.deepStrictEqual(r.syncedSwap, { name: "Hack squat", alts: ["Leg press", "Goblet squat"] });
  assert.deepStrictEqual(r.syncedGone, { name: "Leg press", alts: ["Goblet squat"] }, "the one picked no longer among them in the sync's copy: nothing swapped (the recheck: it made the exercise its own alternative)");
  assert.deepStrictEqual(r.syncedSame, { name: "Hack squat", alts: ["Leg press", "Goblet squat"] }, "the client swapped to it meanwhile: nothing to do, as the server's rule");
  assert.deepStrictEqual(r.menuOnRebuild, { before: true, after: false }, "the cards rebuilt by a sync: the menu hung from them goes");
  assert.deepStrictEqual(r.longWord, ["Dumbbell Supercalifragilisticexpialidoc", "nw:ious"], "a last word too long to keep whole with the chevrons: only its end goes with them, the rest wraps");
});

test("from the keyboard or VoiceOver: into the sheet on its first button, and back on the exercise when it closes (its chevrons, or its \"…\" when none are left)", () => {
  assert.deepStrictEqual(r.keysOpen, { focus: "alt-minus", on: true });
  assert.deepStrictEqual(r.keysBack, { focus: "chevrons" });
  assert.deepStrictEqual(r.keysBackNone, { pop: false, focus: "more", alts: [] });
});

test("the exercise's \"…\": Add alternatives with none, Edit alternatives with some; both open the same sheet", () => {
  assert.deepStrictEqual(r.moreNone, ["Add alternatives", "Add instructions", "Delete exercise"]);
  assert.deepStrictEqual(r.letGo, { blurred: true, typingLook: false }, "a field being typed in is let go first, and the typing look with it");
  assert.deepStrictEqual(r.ownName, { open: true, lead: "Your client can swap Calf raise for one of these.", rows: ["+ Add alternative"], focus: "add" }, "an alternative that is its own name is none; from the keyboard, focus on the first button");
  assert.deepStrictEqual(r.moreOpened, { open: true, lead: "Your client can swap Plank for one of these.", rows: ["+ Add alternative"], focus: "sheet" });
  assert.deepStrictEqual(r.moreAdded, { alts: ["Side plank"], rows: ["Side plank", "+ Add alternative"] });
  assert.deepStrictEqual([r.moreAfter, r.moreSome], [{ pop: true }, ["Edit alternatives", "Add instructions", "Delete exercise"]]);
});

test("the look, as measured: the chevrons 9 by 13 at 17 points on the baseline, 6.6 after the words, in Apple's secondary label (138 on white); the tick 23 from the menu's edge, the words 45; the line 1 point, 24 in, 10 clear, 8% black (8% white in the dark)", () => {
  assert.ok(src.includes('<path d="M1.1 4.5 4.5 1.2 7.9 4.5M1.1 8.83 4.5 12.13 7.9 8.83"/>') && src.includes('viewBox="0 0 9 13"'), "the chevrons, traced");
  assert.ok(src.includes('<path d="M1.15 5.45 4.33 8.9 9.85 1.1"/>') && src.includes('stroke-width="1.75"'), "the tick, traced");
  assert.ok(html.includes("  .pop-chev { display: inline-block; width: 0.53em; height: 0.765em; margin-left: 0.36em; vertical-align: baseline; overflow: visible; color: var(--pop-chev); }"));
  assert.ok(html.includes("  #whenPop.menu.checks .wopt { position: relative; padding-left: 32px; }"));
  assert.ok(html.includes("  #whenPop.menu .wopt .ck { position: absolute; left: 10.7px; top: 50%; width: 0.647em; height: 0.618em; margin-top: -0.309em; overflow: visible; }"));
  assert.ok(html.includes("  #whenPop .msep { flex: none; height: 1px; margin: 10px 12px; background: var(--menu-sep); }"));
  assert.ok(html.includes("  .row .top .name-pop:active { opacity: 0.6; }") && !html.includes(".name-pop:active .nw"), "pressed: the name dims once, its last word with it (the review: it dimmed twice)");
  assert.ok(html.includes("  .alt-sheet .list button:focus-visible, .alt-sheet .alt-field:focus-visible { outline-offset: -2px; }"), "a keyboard's ring inside its row (the review: the list clipped it)");
  assert.ok(html.includes("  .block.done.open.summary .row .top .name-pop { cursor: default; }"), "no hand over a name that does nothing");
  assert.strictEqual(count("--menu-sep: rgba(0,0,0,0.08); --pop-chev: rgba(60,60,67,0.6);"), 1, "light");
  assert.strictEqual(count("--menu-sep: rgba(255,255,255,0.08); --pop-chev: rgba(235,235,245,0.6);"), 2, "dark, both blocks");
});

test("the two dark blocks (the phone's Auto, and Dark chosen in Settings) define the same colours, token for token (the v291 review: both new dark values had gone into the first block, so Dark chosen in Settings drew the chevrons in the light's grey)", () => {
  const block = (start) => { const i = html.indexOf(start), j = html.indexOf("{", i); let d = 0; for (let k = j; k < html.length; k++) { if (html[k] === "{") d++; else if (html[k] === "}" && --d === 0) return html.slice(j, k); } return ""; };
  const tokens = (b) => Object.fromEntries([...b.replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));
  const auto = tokens(block("@media (prefers-color-scheme: dark) {")), chosen = tokens(block(':root[data-theme="dark"] {'));
  assert.ok(Object.keys(auto).length > 40, "the blocks found");
  assert.deepStrictEqual(chosen, auto);
  assert.deepStrictEqual([auto["--menu-sep"], auto["--pop-chev"]], ["rgba(255,255,255,0.08)", "rgba(235,235,245,0.6)"]);
});

test("where the chevrons go: the client's are hidden wherever the swap disc never showed (a card still to come, folded, or finished); the coach's sit 16 in from the field's edge, the words stopping 6.6 before them; the ⇄ disc and the old panel are gone", () => {
  assert.ok(html.includes("  body.client .block.ahead .name-pop .pop-chev, .block.done:not(.open) .name-pop .pop-chev, .block.done.open.summary .name-pop .pop-chev { display: none; }"));
  assert.ok(html.includes("  .block.done:not(.open) .alt-pop, .block.done.open.summary .alt-pop { display: none; }"));
  assert.ok(/\.alt-pop \{ position: absolute; top: 0; right: 0; z-index: 1; width: 44px; height: 42px; display: flex; align-items: center; justify-content: flex-end; padding: 0 16px 0 0;/.test(html));
  assert.ok(html.includes("  body:not(.client) .block:not(.done) .row .top .exwrap.has-pop .name, body:not(.client) .block.done.open:not(.summary) .row .top .exwrap.has-pop .name { padding-right: 32px !important; }"));
  const peekAuto = html.indexOf("  body.client .block.peek .row .top .name-pop { pointer-events: auto; }"), peekNone = html.indexOf("body.client .block.peek .row .top .name, body.client .block.peek .row .top input.label { pointer-events: none; }");
  assert.ok(peekNone > 0 && peekAuto > peekNone, "a card opened for a look: its name still opens the menu (after the rule that turns the name off, of the same weight)");
  for (const gone of ["alt-btn", "Swap exercise", ".alt-menu .cur", ".alt-menu .item", ".alt-menu .alt-input"]) assert.ok(!html.includes(gone) && !src.includes(gone), gone);
  assert.ok(html.includes('<div class="sheet-bg" id="altSheet" hidden><div class="sheet ask confirm-sheet pick-sheet alt-sheet" role="dialog" aria-modal="true" aria-labelledby="altTitle" tabindex="-1"><h3 id="altTitle">Alternatives</h3><p class="lead" id="altLead"></p><ul class="list" id="altRows"></ul><div class="ask-actions"><button class="btn quiet" id="altDone" type="button">Done</button></div></div></div>'));
});
