// His ask, 13 Nov: "Make Template workouts open in preview … on top right corner Apple button edit like in the screenshot but instead of select
// it says edit ... do it exactly like Apple and that takes you to coaches view as it is now … bellow use for client purple button … we don't
// need no 3 dots button .. just edit … I want to be able to do sliding between workouts but only in that folder / slide .. for example week
// one … I can only slide back and forth a between workouts in that week". His picks the same day: Edit with the ‹ › arrows beside it; Use for
// client asks which client, then the day, then opens the new workout; choosing a template for a client, "if I click use it will take me to pick
// a date and then opens up in my coaches view … if I click just on the workouts card it opens up the preview". The sheet's buttons, the
// Templates list and the list sheet play in their own process (template-preview-probe.mjs).
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test, assert } from "./assert.js";
const here = path.dirname(fileURLToPath(import.meta.url));
const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const r = JSON.parse(execFileSync(process.execPath, [path.join(here, "template-preview-probe.mjs")], { encoding: "utf8", timeout: 60000 }).trim().split("\n").pop());
const seen = (id, title, day, extra = {}) => ({ id, title, day, bar: title, go: "Use for client", purple: true, edit: true, more: false, prev: false, next: false, ...extra });

test("a template's row opens its preview: its name as its row writes it (\"Workout 1 · Legs\"), under it the page it is on in place of a day; Edit beside the arrows and no \"…\"; Use for client at the foot, in the purple", () => {
  assert.deepStrictEqual(r.rowTap, { found: true, ...seen("t1", "Workout 1 · Legs", "Phase 1 · Week 1", { next: true }), say: "" }, "his folder's slide: the folder and the slide");
  assert.deepStrictEqual(r.plain, seen("t2", "Workout 2", "Phase 1 · Week 1", { prev: true, next: true }), "no name of its own: its number");
  assert.deepStrictEqual(r.root, seen("t5", "Workout 1", "My templates", { next: true }), "the Templates page: My templates");
  assert.deepStrictEqual(r.folder, seen("t7", "Workout 1", "Summer block"), "a folder with no slides: the folder");
  assert.deepStrictEqual(r.fat, seen("b1", "Workout 1", "Phase 1 · Base · Week 1", { next: true }), "a built-in program's week page kept from before the programs became folders: its page's name and its week");
  assert.deepStrictEqual(r.browseRow, { pick: false, kids: ["BUTTON.", "DIV.swipe-acts"] }, "the row: the card (its chevron in it) and its swipe's actions, as before");
});

test("the walk: only the templates of the page it was opened on, in the page's order (his ask: \"only in that folder / slide .. for example week one\"); the arrows dimmed at its ends; another device's change taken in", () => {
  assert.deepStrictEqual(r.walks, { b1next: ["t1", "t2", "t4"], b1prev: ["t4", "t2", "t1"], b2: ["t3"], root: ["t5", "t6"], fat: ["b1", "b2"] }, "Week 1 with what sits in the folder itself (as the page shows them), never Week 2's; Week 2 alone; My templates, never a program's; a built-in week's");
  assert.deepStrictEqual(r.near, { t1: { prev: null, next: "t2" }, t3onB1: { prev: null, next: null }, t3onB2: { prev: null, next: null } });
  assert.deepStrictEqual(r.slid, { ...seen("t2", "Workout 2", "Phase 1 · Week 1", { prev: true, next: true }), say: "Workout 2, Phase 1 · Week 1" }, "an arrow: the next of the week, VoiceOver told which and where");
  assert.deepStrictEqual(r.joined, { ...seen("t1", "Workout 1 · Legs", "Phase 1 · Week 1", { next: true }), end: "t3" }, "one moved into Week 1 on another device meanwhile: the walk reaches it");
  assert.deepStrictEqual(r.synced, seen("t2", "Workout 2 · Pull", "Phase 1 · Week 1", { prev: true, next: true }), "a sync's redraw: the template as it is now");
  assert.deepStrictEqual(r.goneOpen, { open: false, sheet: false }, "deleted on another device: the preview goes with it");
  assert.deepStrictEqual(r.midSlide, { slide: true, id: "t4", next: false, nextAfter: true, slideAfter: true, landed: "t4" }, "a redraw while a slide is under way: the arrows at once (one more added after the last), the slide lands where it was going");
});

test("Edit: the template's own page in the coach's view, as a tap on its row opened it before; not in the sheet's first 350 ms (a double tap's second), a keyboard's Enter at once", () => {
  assert.deepStrictEqual(r.edit, { early: { id: "t1", view: "client" }, view: { name: "training", id: "t1" }, open: false, sheet: false });
  assert.deepStrictEqual(r.editKey, { view: { name: "training", id: "t1" } });
});

test("Use for client (his pick, 13 Nov): which client (his list's order, the last one used first next time), the day in that client's calendar, then the new workout opens in the coach's view; nothing added when he went Back, the template or the client went meanwhile, or he has no clients", () => {
  assert.deepStrictEqual(r.use.sheet, { up: true, title: "Add Workout 1 to", rows: [["c1", "", ""], ["c2", "", ""]], preview: false }, "the clients, the preview gone");
  assert.deepStrictEqual(r.use.days, { title: "Add Workout 1 to Bob", ok: true }, "Bob's days");
  assert.deepStrictEqual(r.use.bob, [["2026-12-07", "Legs", "t1", ""]], "on the day picked, by the template's name");
  assert.deepStrictEqual([r.use.view, r.use.opened, r.use.coach], ["training", ["c2", "Legs", "t1"], false], "and it opens, the coach's view (still being made)");
  assert.deepStrictEqual(r.use.again, [["c2", "", ""], ["c1", "", ""]], "Bob first the next time");
  assert.deepStrictEqual([r.useLeft, r.useGone, r.useGoneDays], [{ days: false, jane: 0 }, { days: false }, { ok: false, jane: 0 }]);
  assert.deepStrictEqual(r.noClients, { title: "Add Workout 1 to", rows: [["empty", "Add a client first."]], days: false });
});

test("choosing a template for a client (From template on their empty workout): the card opens the preview, whose purple button says Use (no Edit while choosing: the client's own copy opens to be changed once used); Use, the row's or the preview's, asks the day first (his pick, 13 Nov: \"if I click use it will take me to pick a date and then opens up in my coaches view\"), the client's days opened on the workout's own with it outlined, then it takes the template on the day picked and opens as the coach", () => {
  const w = (title, date, from, skipped = false) => ({ title, date, from, rows: 0, skipped });
  assert.deepStrictEqual(r.pickRow, { pick: true, kids: ["BUTTON.:", "BUTTON.tpl-use:Use"], swipe: false }, "the card and its Use, two buttons; no swipe while choosing");
  assert.deepStrictEqual(r.pickPreview, seen("t2", "Workout 2", "Phase 1 \u00b7 Week 1", { go: "Use", edit: false, prev: true, next: true }));
  const days = { title: "Add Workout 2 to Jane", selected: "2026-11-27", moving: "w0" };
  assert.deepStrictEqual(r.pickUse, { preview: false, days, w0: w("", "2026-11-27", null), after: { w0: w("Workout 2", "2026-11-27", "t2"), view: { name: "training", id: "w0" }, others: 1, choosing: null, coach: false } }, "the preview's Use: Jane's days on the workout's own day, nothing filled yet; then Workout 2 into it there, opened as the coach, nothing else added");
  assert.deepStrictEqual(r.rowUse, { preview: false, days, after: { w0: w("Workout 2", "2026-12-02", "t2"), view: { name: "training", id: "w0" }, others: 1, claimed: true, depth: 1 } }, "the row's Use: the same days, no preview; another day picked moves it there (claimed: a move on another device meanwhile does not pull it off), on its own step above the client's");
  assert.deepStrictEqual(r.beside, { days: { title: "Add Workout 2 to Jane", selected: r.today, moving: null }, after: { w0: w("", "2026-11-27", null, true), opened: ["2026-12-08", "Workout 2", "t2"], all: 2, depth: 1 } }, "skipped by the client meanwhile: nothing outlined, the days from today; it stays as it is and the template goes in beside it, on the day picked, and opens on the workout's step, so Back goes to the client (Use all's rule; the v288 review)");
  assert.deepStrictEqual(r.besideFull, { days: { title: "Add Workout 2 to Jane", selected: r.today, moving: null } }, "given exercises on another device meanwhile: not filled over");
  assert.deepStrictEqual(r.useGoneTpl, { ok: false, w0: w("", "2026-11-27", null) }, "the template deleted while the days are up: they close, nothing filled");
});

test("a keyboard's or VoiceOver's place: Use for client's sheet hands it back to the template's row (Cancel), and the days give it back there; choosing, the preview's Use leaves it on the row for the days (the v288 review)", () => {
  assert.deepStrictEqual(r.focus, { sheetTookIt: true, backOnRow: true, daysBack: true, pickDaysBack: true });
});

test("another device moves the template off the page under its preview (to Week 2): the preview goes, as it goes when the template is deleted (the v288 review: its line named a page it was not on, its arrows led nowhere)", () => {
  assert.deepStrictEqual(r.movedOff, { open: false, sheet: false });
});

test("a template's touch and hold lifts its card; the lifted card tapped does what a tap on the card does: the preview (as Apple's open what they lift)", () => {
  assert.deepStrictEqual(r.lift, { has: true, id: "t1", view: "client" });
});

test("a client's workout keeps its own preview: its day, its \"…\", Start workout, no Edit", () => {
  assert.deepStrictEqual(r.client, { id: "w1", title: "Push", day: r.client.day, bar: "Push", go: "Start workout", purple: true, edit: false, more: true, prev: false, next: false });
  assert.ok(/\d/.test(r.client.day), "its day");
});

test("the page: Edit left of the arrows' capsule (the arrows in the corner, as on a workout's preview), hidden until a template's preview shows it; a word in that capsule's grey, 44 tall; choosing for a client, the row's Use its own button in the purple as text", () => {
  assert.ok(html.includes('<circle cx="18.87" cy="11" r="1.97"/></svg></button><button class="pv-edit" id="pvEdit" type="button" hidden>Edit</button><div class="pv-pager" role="group" aria-label="Workouts">'), "the markup: after the \u2026, before the arrows' pill (his ask, 13 Nov: \"on the left side of the arrows for consistency\", as a workout's \u2026 sits)");
  const rule = (sel) => { const m = html.match(new RegExp("\\n\\s*" + sel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + " \\{([^}]*)\\}")); return m ? m[1] : ""; };
  const edit = rule(".pv-edit");
  for (const d of ["height: 44px", "border-radius: 22px", "background: var(--disc-fill)", "color: var(--disc-ink)", "font-weight: 600"]) assert.ok(edit.includes(d), ".pv-edit " + d);
  assert.ok(rule(".pv-edit[hidden]").includes("display: none"), "hidden means gone (it sets display itself)");
  const use = rule(".list li.pick-row > .tpl-use");
  for (const d of ["color: var(--brand-text)", "flex: none"]) assert.ok(use.includes(d), ".tpl-use " + d);
  assert.ok(rule(".list li.pick-row > button:focus-visible").includes("outline-offset: -2px"), "each of the two buttons rings inside itself: the list's clip left two lines at their seam (the v288 review)");
  assert.ok(!/font-weight/.test(use), "in the row's own weight, as the word was in the chevron's place (v285)");
  assert.ok(rule(".list li.pick-row").includes("display: flex") && rule(".list li.pick-row > button:first-child").includes("min-width: 0"), "the card takes the room, Use at the row's end");
});
