// His ask, 14 Nov (v297): "No fix everything and then release", after the review found that in a phone's Safari tab the swipe back from a
// workout opened by Show in History showed the client's page with the preview still up (and Start workout's already did). Measured on the
// simulator in a Safari tab, it did: WebKit takes its picture of the page being left as the next step is added, from the screen as last
// drawn, so a page left from a sheet, a menu or a picker was remembered with it on top, and History, passed through on the way, was never
// drawn at all. Now, in a phone's browser tab only, such a page is left once it has been drawn as Back brings it back (leaveClean: the
// sheet, menu or picker gone, the month folded, two frames), and Show in History draws History, its row lit, before the workout opens from
// it. The home-screen app and the Mac use the app's own pictures, and nothing there waits. The page runs in its own process
// (browser-pictures-probe.mjs), whose screen is drawn every 16 ms and whose browser files the last drawn screen as each step's picture.
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test, assert } from "./assert.js";
const here = path.dirname(fileURLToPath(import.meta.url));
const r = JSON.parse(execFileSync(process.execPath, [path.join(here, "browser-pictures-probe.mjs")], { encoding: "utf8", timeout: 120000 }).trim().split("\n").pop());
const CLEAN = (page, y = 0) => ({ page: [page], over: [], month: false, y });     // the page alone, where it was scrolled: as Back brings it back
const pic = (x) => x.pics.map((p) => p.picture);
const fresh = (x, old) => x.view.startsWith("training/") && x.view !== "training/" + old;

test("Start workout in a phone's browser tab: the preview goes and the month folds at once, and the workout opens only once the client's page has been drawn so; the browser's picture of it is the page alone", () => {
  assert.deepStrictEqual(r.startBefore, { page: ["vClient"], over: ["pvSheet"], month: true, y: 600 }, "the screen as the tap came: the preview over the client's month, 600 down");
  assert.deepStrictEqual(r.startAtOnce, { view: "client/c1", shown: ["vClient"], pushed: 0, month: false, preview: false });
  assert.deepStrictEqual({ view: r.start.view, steps: r.start.steps, pics: pic(r.start) }, { view: "training/todo", steps: ["push"], pics: [CLEAN("vClient", 380)] }, "the week, the list where it was (600 down the month is 380 down the week)");
  assert.deepStrictEqual(r.startBack, { view: "client/c1", shown: ["vClient"], y: 380, week: true }, "and Back lands on what the picture showed");
});

test("Show in History in a phone's browser tab: the client's page drawn alone (its picture), then History drawn with the workout's row lit (its picture: the swipe back from the workout shows it), then the workout; Back is History at the row, Back again the client's page", () => {
  assert.deepStrictEqual(r.histAtOnce, { view: "client/c1", shown: ["vClient"], pushed: 0 });
  assert.deepStrictEqual({ shown: r.histMid.shown, pics: pic(r.histMid) }, { shown: ["vHistory"], pics: [CLEAN("vClient")] }, "History up, two frames on: its step taken with the client's page as the picture");
  assert.deepStrictEqual({ view: r.hist.view, from: r.hist.from, steps: r.hist.steps, pics: pic(r.hist) }, { view: "training/wk", from: "history", steps: ["push", "push"], pics: [CLEAN("vClient"), { page: ["vHistory"], over: [], month: false, y: 700, lit: [] }] }, "History at the row, its light gone again before it is left: as Back lands on it");
  assert.deepStrictEqual([r.histBack1, r.histBack2], [{ view: "client/c1", shown: ["vHistory"], y: 700 }, { view: "client/c1", shown: ["vClient"] }]);
});

test("a double tap: its second tap lands on History during the beat, which takes no tap; the workout opens, and History takes taps again", () => {
  assert.deepStrictEqual(r.beatTap, { tap: "inert", view: "client/c1", shown: ["vHistory"] });
  assert.deepStrictEqual([r.beat, r.afterBeat], [{ view: "training/wk", shown: ["vTraining"], id: "wk" }, { inert: false }]);
});

test("a wait never outlives its page: Back while History waits, the page left within Start workout's two frames, or a question come up meanwhile, opens nothing, then or after", () => {
  assert.deepStrictEqual(r.histLeft, { view: "client/c1", shown: ["vClient"] });
  assert.deepStrictEqual(r.startLeft, { view: "clients", shown: ["vClients"] });
  assert.deepStrictEqual([r.startAsked, r.startAskedAfter], [{ view: "client/c1", shown: ["vClient"] }, { view: "client/c1", shown: ["vClient"] }]);
});

test("a touch and hold: the lifted row tapped opens it once the page is drawn without the dim and the menu (the simulator showed the client's page under Safari's swipe)", () => {
  assert.deepStrictEqual(r.liftUp, { over: ["whenBg", "ctxDim", "ctxLift"], vis: true }, "the menu, the dim and the lifted copy");
  assert.deepStrictEqual(r.liftAtOnce, { view: "client/c1", shown: ["vClient"], pushed: 0 });
  assert.deepStrictEqual({ view: r.lift.view, steps: r.lift.steps, pics: pic(r.lift) }, { view: "training/todo", steps: ["push"], pics: [CLEAN("vClient")] });
});

test("menus: Save as template from the workout's \"…\" and from the preview's, then the new template; each page drawn without the menu or the preview first", () => {
  assert.deepStrictEqual([r.saveMenu, r.pvSaveMenu], [["whenBg"], ["pvSheet", "whenBg"]], "each menu open, as tapped (the preview's over the preview)");
  assert.deepStrictEqual(r.saveAtOnce, { view: "training/todo", shown: ["vTraining"], pushed: 0 });
  assert.ok(fresh(r.save, "todo") && r.save.template, JSON.stringify(r.save));
  assert.deepStrictEqual([r.save.steps, pic(r.save)], [["push"], [CLEAN("vTraining")]]);
  assert.deepStrictEqual(r.pvSaveAtOnce, { view: "client/c1", shown: ["vClient"], pushed: 0, preview: false });
  assert.ok(fresh(r.pvSave, "wk"), r.pvSave.view);
  assert.deepStrictEqual([r.pvSave.steps, pic(r.pvSave)], [["push"], [CLEAN("vClient")]]);
});

test("the day picker: Copy workout's copy opens once the workout's page is drawn without the days", () => {
  assert.deepStrictEqual([r.copyDays, r.copyPicked, r.copyAtOnce], [["datePick"], true, { view: "training/todo", shown: ["vTraining"], pushed: 0 }]);
  assert.ok(fresh(r.copy, "todo") && r.copy.date, JSON.stringify(r.copy));
  assert.deepStrictEqual([r.copy.steps, pic(r.copy)], [["push"], [CLEAN("vTraining")]]);
});

test("a day's list (the workout page's Also today): Add a workout and another workout's row open once the page is drawn without the list", () => {
  assert.deepStrictEqual([r.dayList, r.addAtOnce], [["pickSheet"], { view: "training/todo", shown: ["vTraining"], pushed: 0 }]);
  assert.ok(fresh(r.add, "todo") && r.add.fresh, JSON.stringify(r.add));
  assert.deepStrictEqual([r.add.steps, pic(r.add)], [["push"], [CLEAN("vTraining")]]);
  assert.deepStrictEqual(r.rowAtOnce, { view: "training/todo", shown: ["vTraining"], pushed: 0 });
  assert.deepStrictEqual({ view: r.row.view, steps: r.row.steps, pics: pic(r.row) }, { view: "training/twin", steps: ["push"], pics: [CLEAN("vTraining")] });
});

test("the Templates pages: a preview's Edit, the + menu's New template (made only then), a preview's Use for client and a folder's Use for a client (a client, a day), each page drawn alone before it is left", () => {
  assert.deepStrictEqual(r.editAtOnce, { view: "client/00000000-0000-4000-8000-0000000000f1", shown: ["vClient"], pushed: 0, preview: false });
  assert.deepStrictEqual({ view: r.edit.view, steps: r.edit.steps, pics: pic(r.edit) }, { view: "training/t1", steps: ["push"], pics: [CLEAN("vClient")] });
  assert.deepStrictEqual(r.newMenu, ["whenBg"]);
  assert.deepStrictEqual(r.newAtOnce, { view: "client/00000000-0000-4000-8000-0000000000f1", shown: ["vClient"], pushed: 0, made: 0 }, "nothing made before the page is drawn: a template made and left behind would stay, empty");
  assert.ok(r.newTpl.view.startsWith("training/") && r.newTpl.made === 1, JSON.stringify(r.newTpl));
  assert.deepStrictEqual([r.newTpl.steps, pic(r.newTpl)], [["push"], [CLEAN("vClient")]]);
  assert.deepStrictEqual([r.useDays, r.useAtOnce], [["datePick"], { view: "client/00000000-0000-4000-8000-0000000000f1", shown: ["vClient"], pushed: 0 }]);
  assert.ok(r.use.view.startsWith("training/") && r.use.made, JSON.stringify(r.use));
  assert.deepStrictEqual([r.use.steps, pic(r.use)], [["push"], [CLEAN("vClient")]]);
  assert.deepStrictEqual(r.weekAtOnce, { view: "client/00000000-0000-4000-8000-0000000000f1", shown: ["vClient"], pushed: 0 });
  assert.deepStrictEqual({ view: r.week.view, made: r.week.made, steps: r.week.steps, pics: pic(r.week) }, { view: "client/c1", made: 2, steps: ["push"], pics: [CLEAN("vClient")] }, "the week goes in at once; the client's page waits");
});

test("a template's own page: Use for a client's list and the days go, and the new workout opens once the page is drawn without them", () => {
  assert.strictEqual(r.usePickOpen, true);
  assert.deepStrictEqual(r.pageUseAtOnce, { view: "training/t1", shown: ["vTraining"], pushed: 0, list: false });
  assert.ok(fresh(r.pageUse, "t1") && r.pageUse.made, JSON.stringify(r.pageUse));
  assert.deepStrictEqual([r.pageUse.steps, pic(r.pageUse)], [["push"], [CLEAN("vTraining")]]);
});

test("a template's unsaved changes held a page opened from it: Save, or Discard after its question, opens it once the template is drawn without the bar and the question; a held Back goes at once", () => {
  assert.strictEqual(r.drafted, 3, "the template page drawn, its draft there to mark unsaved, in each of the three");
  assert.deepStrictEqual(r.draftBefore, { page: ["vTraining"], over: ["draftBar", "usePick"], month: false, y: 0 }, "the bar, and Use for a client's list still open under it");
  assert.deepStrictEqual(r.draftAtOnce, { view: "training/t1", shown: ["vTraining"], pushed: 0 });
  assert.deepStrictEqual({ view: r.draft.view, steps: r.draft.steps, pics: pic(r.draft) }, { view: "training/todo", steps: ["push"], pics: [CLEAN("vTraining")] });
  assert.deepStrictEqual([r.discardAsk, r.discardAtOnce], [["askSheet", "draftBar"], { view: "training/t1", shown: ["vTraining"], pushed: 0 }]);
  assert.deepStrictEqual({ view: r.discard.view, steps: r.discard.steps, pics: pic(r.discard) }, { view: "training/todo", steps: ["push"], pics: [CLEAN("vTraining")] });
  assert.deepStrictEqual([r.discardTitle, r.discard.title], ["Edited", "Day 1"], "drawn with the edit before; its picture the template as it was, drawn again before it is left");
  assert.deepStrictEqual(r.draftBack, { view: "client/00000000-0000-4000-8000-0000000000f1", shown: ["vClient"] });
});

test("not a phone's browser tab, a template with unsaved changes: Use for a client's move is held and its list stays open, as before", () => {
  assert.deepStrictEqual(r.heldList, { listOpen: true, held: true, view: "training/t1", shown: ["vTraining"] });
});

test("not a phone's browser tab (a computer here; the home-screen app keeps no steps): nothing waits, as before", () => {
  assert.deepStrictEqual(r.desk, { view: "training/todo", shown: ["vTraining"], pushed: 0 });
  assert.deepStrictEqual(r.rejected, [], "nothing threw along the way");
});
