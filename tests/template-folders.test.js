// His ask, 12 Nov: "In templates that I have I have folders and subfolders and the week slider lets come up with way how I can create those
// myself". His picks: a "…" at the top right with New folder and New slide ("maybe call it a new slide or something and let me name it ...
// instead of automatically new week"), Rename and Delete; a new template from the round glass + at the foot, as on a client's page;
// deleting a folder or a slide moves its templates to My templates; "my folders and sliders when created should look exactly like templates
// I already have": his folders listed with the programs, a folder's folders as a program's phases, its slides as a phase's week slider.
import fs from "node:fs";
import { test, assert, tick } from "./assert.js";
import { load } from "./load.js";
import { byId, el } from "./env.js";
import { makeSupabase } from "./fake-supabase.js";
import { TEMPLATES_ID } from "../app/model.js";
const app = await load();
const { fns, maps } = app;
const $ = (id) => document.getElementById(id);
const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const src = fs.readFileSync(new URL("../app/main.js", import.meta.url), "utf8");
const TPL = TEMPLATES_ID;
const quiet = () => { for (const t of maps.timers.values()) clearTimeout(t); maps.timers.clear(); fns.setPreview(false); fns.setPickFor(null); };   // no save left to run into a later test
const at = (m) => "2026-11-12T10:" + String(m).padStart(2, "0") + ":00.000Z";
const node = (id, name, parent, kind, m) => ({ id, name, parent, kind, at: at(m) });
const T = (id, meta, extra = {}) => ({ id, clientId: TPL, title: "", date: "2026-01-01", createdAt: "2026-11-01T10:00:00.000Z", completedAt: null, skippedAt: null, rows: [{ id: "r" + id, label: "1", name: "Back squat", sets: 3, reps: "8", rest: "90 sec", tempo: "", note: "", alts: [] }], template: meta, ...extra });
const MINE = (n, folder) => ({ program: "My templates", phase: 0, stage: 0, n, ...(folder ? { folder } : {}) });
// A: his program, made 10:05; H: another of his, made 10:01 (listed after A, as a merge can); B: a phase of A with two weeks; t4 sits in B itself
const FOLDERS = [node("A", "Summer block", null, "folder", 5), node("H", "Rehab", null, "folder", 1), node("B", "Phase 1", "A", "folder", 6), node("S1", "Week 1", "B", "slide", 7), node("S2", "Week 2", "B", "slide", 8)];
const TPLS = [T("t1", MINE(1, "S1")), T("t2", MINE(2, "S1")), T("t3", MINE(1, "S2")), T("t4", MINE(3, "B")), T("t5", MINE(1)), T("b1", { program: "Fat Burn", phase: 1, stage: 1, n: 1, phaseName: "Base" })];
const setup = (folders = FOLDERS, tpls = TPLS, view = { name: "client", id: TPL }) => {
  quiet(); app.reset();
  app.set({ signedIn: true, clientMode: false, myClientId: null, tab: "workouts" });
  maps.clients.set("c1", { id: "c1", name: "Jane", unit: "lb" });
  maps.clients.set(TPL, { id: TPL, name: "Templates", kind: "templates", folders: JSON.parse(JSON.stringify(folders)) });
  for (const t of tpls) maps.trainings.set(t.id, JSON.parse(JSON.stringify(t)));
  app.set({ view, renderedTraining: null }); fns.render();
};
const menu = () => fns.tplMoreItems().map((it) => (it.danger ? "red " : "") + it.label);
const meta = (id) => { const m = maps.trainings.get(id).template; return [m.program, m.n, m.folder || null]; };
// the ask sheet's buttons and field, keeping the listeners they are given (the shared stand-in drops them)
function asking() {
  const H = {};
  for (const id of ["askYes", "askNo", "askInput"]) { const b = el(id === "askInput" ? "input" : "button"); b.addEventListener = (t, fn) => { (H[id + t] ||= []).push(fn); }; b.removeEventListener = (t, fn) => { H[id + t] = (H[id + t] || []).filter((f) => f !== fn); }; byId.set(id, b); }
  const fire = (id, type) => { for (const fn of [...(H[id + type] || [])]) fn({ target: $(id) }); };
  return { yes: () => fire("askYes", "click"), no: () => fire("askNo", "click"), type: (v) => { $("askInput").value = v; fire("askInput", "input"); }, done: () => { for (const id of ["askYes", "askNo", "askInput"]) byId.delete(id); } };
}
const sheet = () => ({ up: !$("askSheet").hidden, title: $("askTitle").textContent, text: $("askText").hidden ? null : $("askText").textContent, field: $("askInput").hidden ? null : $("askInput").value, yes: $("askYes").textContent, red: $("askYes").classList.contains("danger") });
// elements that keep what is put in them and the listeners they are given, while fn runs; the Templates list keeps what is drawn into it
function drawing(fn) {
  const make = document.createElement, wrap = $("tplList"); let got = [];
  document.createElement = (tag) => {
    const e = make(tag); e.kids = []; e.on = {}; let inner = "", cn = "";
    Object.defineProperty(e, "className", { configurable: true, get: () => cn, set: (v) => { cn = String(v); e.classes.clear(); for (const c of cn.split(/\s+/)) if (c) e.classes.add(c); } });   // the class name and the class list in step, as a page's are
    e.appendChild = (c) => { e.kids.push(c); return c; }; e.append = (...k) => { e.kids.push(...k); }; e.replaceChildren = (...k) => { e.kids = k; };
    e.addEventListener = (type, f) => { (e.on[type] ||= []).push(f); };
    Object.defineProperty(e, "innerHTML", { configurable: true, get: () => inner, set: (v) => { inner = String(v); e.firstChild = make("span"); e.lastChild = make("span"); } });
    return e;
  };
  wrap.replaceChildren = (...k) => { got = k; }; wrap.appendChild = (c) => { got.push(c); return c; };
  try { return fn(() => got); } finally { document.createElement = make; delete wrap.replaceChildren; delete wrap.appendChild; }
}
const read = (kids) => kids.flatMap((e) => (e.tagName === "H2" ? ["# " + e.textContent]
  : e.className === "list" ? e.kids.map((li) => (li.dataset.tid ? "tpl " + li.dataset.tid : li.kids[0].className === "rowline" ? (li.className === "drag-row" ? "≡ " : "· ") + li.kids[0].kids[0].textContent : "> " + li.kids[0].firstChild.textContent + " · " + li.kids[0].lastChild.textContent))
  : /\bseg\b/.test(e.className) ? ["tabs " + e.kids.map((b) => { const w = b.kids.length ? b.kids[0].textContent : b.textContent; return b.classList.contains("on") ? "[" + w + "]" : w; }).join(" ")]
  : e.className === "empty" ? ["empty: " + e.textContent] : ["? " + e.tagName]));
const pageNow = () => [$("tplKicker").textContent, $("cName").textContent];

test("his folders as the app reads them: one at the top or inside a top folder, never deeper nor in a ring; a slide inside a folder; in the order made, whatever order a merge listed them in; anything else is left out", () => {
  setup([...FOLDERS,
    node("C", "Too deep", "B", "folder", 9), node("D", "Orphan", "gone", "folder", 10), node("E", "Ring 1", "F", "folder", 12), node("F", "Ring 2", "E", "folder", 11), node("G", "Itself", "G", "folder", 13),
    node("S3", "Lost", "gone", "slide", 14), { id: "X", name: 5, parent: null, kind: "folder" }, { id: "Y", name: "Odd", parent: null, kind: "box" }, null, { name: "No id", kind: "folder" }]);
  assert.deepStrictEqual(Object.fromEntries(fns.tplNodes().map((f) => [f.id, f.parent])), { A: null, H: null, B: "A", S1: "B", S2: "B", C: null, D: null, E: null, F: null, G: null },
    "three deep, its folder gone (deleted on another device), a ring (two devices' moves crossing) or its own folder: at the top; a slide whose folder went goes with it");
  assert.deepStrictEqual(fns.tplKids(null, "folder").map((f) => f.id), ["H", "A", "C", "D", "F", "E", "G"], "the top, in the order made (H before A: made first), the same on every device");
  assert.deepStrictEqual([fns.tplKids("A", "folder").map((f) => f.id), fns.tplKids("B", "slide").map((f) => f.id), fns.tplKids("A", "slide")], [["B"], ["S1", "S2"], []]);
  assert.deepStrictEqual([...fns.tplTree("A")].sort(), ["A", "B", "S1", "S2"], "a folder, its folders and their slides");
  assert.deepStrictEqual([fns.tplIn(fns.tplTree("A")).map((t) => t.id).sort(), fns.tplIn(new Set(["S1"])).map((t) => t.id).sort()], [["t1", "t2", "t3", "t4"], ["t1", "t2"]]);
  assert.strictEqual(fns.tplNode(null), null); assert.strictEqual(fns.tplNode("S3"), null);
  quiet();
});

test("the Templates page lists his folders first under Programs, each with the workouts in it, folders and slides inside counted too; the built-in programs as they are", () => {
  setup();
  drawing((got) => {
    fns.render();
    assert.deepStrictEqual(read(got()), ["# My templates", "tpl t5", "# Programs", "> Rehab · 0 workouts", "> Summer block · 4 workouts", "> Fat Burn · 1 workout"]);
    assert.deepStrictEqual(pageNow(), ["Workout library", "Templates"]);
  });
  assert.strictEqual($("newTraining").hidden, true, "no + Template on the page: the + at the foot makes one");
  quiet();
});

test("his folder looks as a program does: its folders as phases; a folder's slides as a phase's week slider, the first on, with its templates in order (the folder's own on the first slide); a tap on a slide shows its templates", () => {
  setup(FOLDERS, TPLS, { name: "client", id: TPL, folder: "A" });
  drawing((got) => {
    fns.render();
    assert.deepStrictEqual([pageNow(), read(got())], [["Templates", "Summer block"], ["# Folders", "> Phase 1 · 4 workouts"]]);
    fns.go(fns.tplPage("B"));
    assert.deepStrictEqual([pageNow(), read(got())], [["Summer block", "Phase 1"], ["tabs [Week 1] Week 2", "tpl t1", "tpl t2", "tpl t4"]], "the kicker names the folder it is in, as a phase's names its program");
    const seg = got().find((e) => /\bseg\b/.test(e.className)); seg.kids[1].on.click[0]();
    assert.deepStrictEqual(read(got()), ["tabs Week 1 [Week 2]", "tpl t3"]);
    assert.deepStrictEqual([app.get().view.folder, app.get().view.slide], ["B", "S2"], "in place, as a week's tab: the page is the same, its slide noted for Back");
    fns.go(fns.tplPage("A"), true); fns.go(fns.templateHome(maps.trainings.get("t3")), true);
    assert.deepStrictEqual(read(got()), ["tabs Week 1 [Week 2]", "tpl t3"], "back from its template: on that slide");
  });
  quiet();
});

test("an empty folder says what to do: + for a template, … for a folder or a slide (a folder inside a folder: a slide only); an empty slide: + for a template", () => {
  setup([node("A", "New program", null, "folder", 1), node("B", "Inner", "A", "folder", 2), node("E", "Empty", null, "folder", 3), node("S", "Week 1", "A", "slide", 4)], [], { name: "client", id: TPL, folder: "E" });
  drawing((got) => {
    fns.render(); assert.deepStrictEqual(read(got()), ["empty: Nothing here yet. Tap + for a template, or … for a folder or a slide."]);
    fns.go(fns.tplPage("B")); assert.deepStrictEqual(read(got()), ["empty: Nothing here yet. Tap + for a template, or … for a slide."]);
    fns.go(fns.tplPage("A")); assert.deepStrictEqual(read(got()), ["# Folders", "> Inner · 0 workouts", "tabs [Week 1]", "empty: Nothing here yet. Tap + for a template."], "a new slide, still empty");
  });
  quiet();
});

test("the … : New folder on the Templates page and in a top folder; in any folder New slide, the slide shown's Rename and Delete, the folder's Rename and, last and red, Delete; none on a built-in program's pages", () => {
  setup();
  assert.deepStrictEqual(menu(), ["New folder", "Reorder folders"], "the Templates page: a slide needs a folder; two folders of his, so Reorder");
  fns.go(fns.tplPage("A")); assert.deepStrictEqual(menu(), ["New folder", "New slide", "Rename folder", "red Delete folder"], "a top folder with no slides");
  fns.go(fns.tplPage("B")); assert.deepStrictEqual(menu(), ["New slide", "Rename slide", "Rename folder", "red Delete slide", "red Delete folder"], "a folder inside a folder: no deeper folder");
  const icons = fns.tplMoreItems().map((it) => it.icon), MI = fns.menuIcons();
  assert.deepStrictEqual(icons, [MI.slidePlus, MI.pencil, MI.pencil, MI.trash, MI.trash]);
  fns.go({ name: "client", id: TPL }); assert.deepStrictEqual(fns.tplMoreItems().map((it) => it.icon), [MI.folderPlus, MI.reorder]);
  assert.strictEqual(MI.reorder, MI.swap.replace("<path ", '<path transform="rotate(90 21.88 10)" '), "Reorder: the swap arrows a quarter turn round (up beside down)");
  for (const k of ["folderPlus", "slidePlus"]) assert.ok(/^<svg class="mi" viewBox="0 0 16 16" aria-hidden="true" fill="currentColor" fill-rule="evenodd"><path d="M[^"]+Z"\/><\/svg>$/.test(MI[k]) && !MI[k].includes("stroke"), k + ": our own filled glyph, its plus cut through it");
  fns.go({ name: "client", id: TPL, program: "Fat Burn", phase: null, stage: null }); assert.deepStrictEqual(menu(), [], "a built-in program: as it was");
  fns.go({ name: "client", id: TPL, program: "Fat Burn", phase: 1, stage: 1 }); assert.deepStrictEqual(menu(), []);
  quiet();
});

test("the bar on the Templates pages: the … and the round glass + (New template) at the foot's trailing edge; neither on a program's pages nor while picking a template for a client; the swipe back's bar agrees", () => {
  const add = el("button"); add.attrs = {}; add.setAttribute = (k, v) => { add.attrs[k] = String(v); }; byId.set("addBtn", add);
  try {
    const bar = () => ({ more: !$("tMore").hidden, plus: !$("addBtn").hidden, label: add.attrs["aria-label"], foot: $("dock").classList.contains("tp"), pad: document.body.classList.contains("tplus") });
    const agree = (what) => assert.strictEqual(fns.barFor(fns.viewKey(app.get().view)).tMore, !$("tMore").hidden, what + ": the swipe back's bar agrees with the page");
    const ON = { more: true, plus: true, label: "New template", foot: true, pad: true }, OFF = { more: false, plus: false, label: "New workout", foot: false, pad: false };
    setup(); assert.deepStrictEqual(bar(), ON, "the Templates page"); agree("the Templates page");
    fns.go(fns.tplPage("A")); assert.deepStrictEqual(bar(), ON, "his folder"); agree("his folder");
    fns.go({ name: "client", id: TPL, folder: "B", slide: "S2" }); assert.deepStrictEqual(bar(), ON, "a slide of his"); agree("a slide");
    fns.go({ name: "client", id: TPL, program: "Fat Burn", phase: null, stage: null }); assert.deepStrictEqual(bar(), OFF, "a built-in program"); agree("a built-in program");
    fns.go({ name: "client", id: TPL }); fns.setPickFor("c1"); fns.render(); assert.deepStrictEqual(bar(), OFF, "choosing a template for Jane: only Use"); agree("choosing");
    fns.go(fns.tplPage("A")); assert.deepStrictEqual(bar(), OFF, "choosing, in his folder"); agree("choosing in a folder");
    fns.setPickFor(null); fns.go({ name: "client", id: "c1" }); assert.deepStrictEqual(bar(), { ...OFF, plus: true }, "a client's page: her + (New workout), beside her tabs");
    maps.trainings.set("tp", T("tp", MINE(9), { rows: [] })); fns.go({ name: "client", id: TPL }); fns.go({ name: "training", id: "tp" }); assert.deepStrictEqual([bar().plus, bar().foot, bar().pad], [false, false, false], "a template's page: its own bar");
  } finally { byId.delete("addBtn"); quiet(); }
});

test("New folder asks its name in the sheet: the field, a purple Add that waits for a name, Cancel makes nothing; the name, tidied, makes the folder where he is, kept for the save", async () => {
  setup([], [T("t5", MINE(1))]); const ask = asking();
  try {
    const no = fns.tplMoreItems()[0].onPick();
    assert.deepStrictEqual(sheet(), { up: true, title: "New folder", text: null, field: "", yes: "Add", red: false });
    assert.deepStrictEqual([$("askInput").placeholder, $("askInput").maxLength], ["Name", 40]);
    await tick(400); assert.strictEqual($("askYes").disabled, true, "no name yet: Add waits");
    ask.type("   "); assert.strictEqual($("askYes").disabled, true, "spaces are no name");
    ask.no(); await no; assert.deepStrictEqual([fns.tplNodes().length, $("askSheet").hidden, maps.dirty.size], [0, true, 0], "Cancel: nothing made, nothing to save");
    const yes = fns.tplMoreItems()[0].onPick(); await tick(400);
    ask.yes(); assert.strictEqual($("askSheet").hidden, false, "Add with no name does nothing");
    ask.type("  Summer   block "); assert.strictEqual($("askYes").disabled, false);
    ask.yes(); await yes;
    const [f] = fns.tplNodes();
    assert.deepStrictEqual([f.name, f.parent, f.kind, typeof f.at], ["Summer block", null, "folder", "string"], "at the top, his name with its spaces tidied");
    assert.deepStrictEqual([maps.folderTouched.get(f.id), maps.dirty.has("clients/" + TPL)], [TPL, true], "marked as this device's for a merge, and saved");
    fns.go(fns.tplPage(f.id)); const inner = fns.tplMoreItems()[0].onPick(); await tick(400); ask.type("Phase 1"); ask.yes(); await inner;
    assert.deepStrictEqual(fns.tplKids(f.id, "folder").map((x) => x.name), ["Phase 1"], "in a top folder: inside it");
  } finally { ask.done(); quiet(); }
});

test("New slide: named by him; the folder's first takes the templates in the folder itself, in their order; each new one is the slide shown, where the + puts the next template", async () => {
  setup([node("A", "Summer block", null, "folder", 1)], [T("t1", MINE(5, "A")), T("t2", MINE(2, "A")), T("t5", MINE(1))], { name: "client", id: TPL, folder: "A" }); const ask = asking();
  try {
    const one = fns.tplMoreItems().find((it) => it.label === "New slide").onPick();
    assert.deepStrictEqual(sheet(), { up: true, title: "New slide", text: null, field: "", yes: "Add", red: false });
    await tick(400); ask.type("Week 1"); ask.yes(); await one;
    const [s1] = fns.tplKids("A", "slide");
    assert.deepStrictEqual([s1.name, meta("t2"), meta("t1"), meta("t5")], ["Week 1", ["My templates", 1, s1.id], ["My templates", 2, s1.id], ["My templates", 1, null]], "Workout 2 and Workout 5 become Week 1's Workout 1 and 2; the loose one stays loose");
    assert.strictEqual(app.get().view.slide, s1.id);
    const two = fns.tplMoreItems().find((it) => it.label === "New slide").onPick(); await tick(400); ask.type("Week 2"); ask.yes(); await two;
    const s2 = fns.tplKids("A", "slide")[1]; assert.deepStrictEqual([s2.name, app.get().view.slide], ["Week 2", s2.id], "the new slide is the one shown");
    fns.newWorkoutHere();
    const v = app.get().view, made = maps.trainings.get(v.id);
    assert.deepStrictEqual([v.name, made.clientId, made.template, made.rows, made.date], ["training", TPL, { program: "My templates", phase: 0, stage: 0, n: 1, folder: s2.id }, [], "2026-01-01"], "+ makes Week 2's Workout 1 and opens it");
    assert.ok(maps.timers.has("trainings/" + made.id), "its save is on its way");
    assert.strictEqual(fns.backKey(), fns.viewKey({ name: "client", id: TPL, folder: "A", slide: s2.id }) + "||", "the swipe back has Week 2 underneath");
    made.rows.push({ id: "rx", label: "1", name: "Back squat", sets: 3, reps: "8", rest: "", tempo: "", note: "", alts: [] });   // an exercise: an empty one would be discarded on the way out
    await fns.goBackNow(); assert.deepStrictEqual([app.get().view, maps.trainings.has(made.id)], [{ name: "client", id: TPL, folder: "A", slide: s2.id }, true], "Back: the folder, on Week 2; the template with its exercise stays");
    fns.go({ name: "client", id: TPL }); fns.newWorkoutHere();
    assert.deepStrictEqual(maps.trainings.get(app.get().view.id).template, { program: "My templates", phase: 0, stage: 0, n: 2 }, "on the Templates page: the next of My templates");
  } finally { ask.done(); quiet(); }
});

test("Rename shows the name in the field and saves the new one (Save, purple); the same name changes nothing", async () => {
  setup(FOLDERS, TPLS, { name: "client", id: TPL, folder: "B", slide: "S2" }); const ask = asking();
  try {
    const same = fns.tplMoreItems().find((it) => it.label === "Rename slide").onPick(); await tick(400); ask.yes(); await same;
    assert.deepStrictEqual([fns.tplNode("S2").name, maps.folderTouched.size, maps.dirty.size], ["Week 2", 0, 0], "Save on the same name: nothing changed, nothing to save");
    const p = fns.tplMoreItems().find((it) => it.label === "Rename folder").onPick();
    assert.deepStrictEqual(sheet(), { up: true, title: "Rename folder", text: null, field: "Phase 1", yes: "Save", red: false });
    await tick(400); ask.type("Phase 2"); ask.yes(); await p;
    assert.deepStrictEqual([fns.tplNode("B").name, maps.folderTouched.get("B")], ["Phase 2", TPL]);
    const q = fns.tplMoreItems().find((it) => it.label === "Rename slide").onPick();
    assert.deepStrictEqual(sheet().field, "Week 2", "the slide shown"); await tick(400); ask.type("Deload"); ask.yes(); await q;
    assert.deepStrictEqual([fns.tplNode("S2").name, fns.tplNode("S1").name], ["Deload", "Week 1"]);
    assert.deepStrictEqual([...maps.folderTouched.keys()].sort(), ["B", "S2"], "only what was renamed is marked as this device's");
  } finally { ask.done(); quiet(); }
});

test("Delete slide and Delete folder ask first (red), saying where the templates go; Cancel keeps all; Delete moves them to My templates after the loose ones, in the order they were shown, and goes up when its page went", async () => {
  setup(FOLDERS, TPLS, { name: "client", id: TPL, folder: "B", slide: "S1" }); const ask = asking();
  try {
    const no = fns.tplMoreItems().find((it) => it.label === "Delete slide").onPick();
    assert.deepStrictEqual(sheet(), { up: true, title: "Delete “Week 1”?", text: "Its 2 templates move to My templates.", field: null, yes: "Delete", red: true });
    await tick(400); ask.no(); assert.strictEqual(await no, undefined);
    assert.deepStrictEqual([fns.tplNodes().length, meta("t1")], [5, ["My templates", 1, "S1"]], "Cancel: all as it was");
    const slide = fns.tplMoreItems().find((it) => it.label === "Delete slide").onPick(); await tick(400); ask.yes(); await slide;
    assert.deepStrictEqual([meta("t1"), meta("t2"), meta("t5")], [["My templates", 2, null], ["My templates", 3, null], ["My templates", 1, null]], "after Workout 1 of My templates");
    assert.deepStrictEqual([fns.tplNode("S1"), maps.deletedFolders.get("S1"), app.get().view.folder, app.get().view.slide || null, fns.tplSlide(fns.tplNode("B")).id], [null, TPL, "B", null, "S2"], "the folder's page stays, on the slide left");
    const folder = (() => { fns.go(fns.tplPage("A")); return fns.tplMoreItems().find((it) => it.label === "Delete folder").onPick(); })();
    assert.deepStrictEqual(sheet(), { up: true, title: "Delete “Summer block”?", text: "Its folder and slide go too, and its 2 templates move to My templates.", field: null, yes: "Delete", red: true }, "what goes with it (Phase 1 and its Week 2), and its folders' and slides' templates counted too");
    await tick(400); ask.yes(); await folder;
    assert.deepStrictEqual([meta("t4"), meta("t3")], [["My templates", 4, null], ["My templates", 5, null]], "Phase 1's own, then its slides'");
    assert.deepStrictEqual([fns.tplNodes().map((f) => f.id), [...maps.deletedFolders.keys()].sort(), app.get().view], [["H"], ["A", "B", "S1", "S2"], { name: "client", id: TPL }], "the tree gone, each kept from a merge; up to the Templates page");
    assert.ok(maps.dirty.has("clients/" + TPL) && maps.dirty.has("trainings/t3"), "the folders and the templates saved");
    fns.go(fns.tplPage("H")); const empty = fns.tplMoreItems().find((it) => it.label === "Delete folder").onPick();
    assert.strictEqual(sheet().text, "The folder is empty."); await tick(400); ask.no(); await empty;
    setup(FOLDERS, TPLS, { name: "client", id: TPL, folder: "B", slide: "S2" });
    const inner = fns.tplMoreItems().find((it) => it.label === "Delete folder").onPick(); await tick(400); ask.yes(); await inner;
    assert.deepStrictEqual([app.get().view, $("backLabel").textContent], [{ name: "client", id: TPL, folder: "A" }, "Templates"], "a folder inside a folder, deleted from its own page: up to its folder");
  } finally { ask.done(); quiet(); }
});

test("one template in a slide: “Its template moves”; a sync that takes the folder away while the question is up leaves nothing to do", async () => {
  setup([node("A", "Solo", null, "folder", 1), node("S", "Only", "A", "slide", 2)], [T("t1", MINE(1, "S"))], { name: "client", id: TPL, folder: "A" }); const ask = asking();
  try {
    const p = fns.tplMoreItems().find((it) => it.label === "Delete slide").onPick();
    assert.strictEqual(sheet().text, "Its template moves to My templates.");
    maps.clients.get(TPL).folders = []; await tick(400); ask.yes(); await p;
    setup([node("A", "Solo", null, "folder", 1), node("S", "Only", "A", "slide", 2), node("S2", "Two", "A", "slide", 3), node("B", "Inner", "A", "folder", 4)], [], { name: "client", id: TPL, folder: "A" });
    const q = fns.tplMoreItems().find((it) => it.label === "Delete folder").onPick(); assert.strictEqual(sheet().text, "Its folder and slides go too."); await tick(400); ask.no(); await q;
    setup([node("A", "Solo", null, "folder", 1), node("S", "Only", "A", "slide", 2)], [T("t1", MINE(1, "S"))], { name: "client", id: TPL, folder: "A" });
    const r = fns.tplMoreItems().find((it) => it.label === "Delete folder").onPick(); assert.strictEqual(sheet().text, "Its slide goes too, and its template moves to My templates."); await tick(400); ask.no(); await r;
    assert.deepStrictEqual([meta("t1"), maps.deletedFolders.size], [["My templates", 1, "S"], 0], "nothing moved, nothing marked");
  } finally { ask.done(); quiet(); }
});

test("the From template pill's path for one in his folders: folder, folder, slide, Workout N, as a program's reads program, phase, week; back to it from the pill lands on its slide", () => {
  setup();
  assert.strictEqual(fns.templatePath(maps.trainings.get("t3")), "Summer block · Phase 1 · Week 2 · Workout 1");
  assert.strictEqual(fns.templatePath(maps.trainings.get("t4")), "Summer block · Phase 1 · Workout 3");
  assert.strictEqual(fns.templatePath(maps.trainings.get("b1")), "Fat Burn · Phase 1 · Week 1 · Workout 1", "the built-ins as they were");
  assert.deepStrictEqual(fns.templateHome(maps.trainings.get("t3")), { name: "client", id: TPL, folder: "B", slide: "S2" });
  assert.deepStrictEqual(fns.templateHome(maps.trainings.get("t4")), { name: "client", id: TPL, folder: "B" });
  maps.trainings.get("t3").template.folder = "gone";
  assert.deepStrictEqual([fns.templatePath(maps.trainings.get("t3")), fns.templateHome(maps.trainings.get("t3"))], ["My templates · Workout 1", { name: "client", id: TPL }], "its folder deleted on another device: loose, in My templates");
  quiet();
});

test("Back from his folders: a slide's folder up to its folder, a top folder to the Templates page, and the Back label names where it goes", async () => {
  setup(FOLDERS, TPLS, { name: "client", id: TPL, folder: "B", slide: "S2" });
  assert.strictEqual($("backLabel").textContent, "Summer block");
  assert.strictEqual(fns.backKey(), fns.viewKey({ name: "client", id: TPL, folder: "A" }) + "||");
  await fns.goBackNow(); assert.deepStrictEqual([app.get().view, $("backLabel").textContent], [{ name: "client", id: TPL, folder: "A" }, "Templates"]);
  assert.strictEqual(fns.backKey(), fns.viewKey({ name: "client", id: TPL }) + "||");
  await fns.goBackNow(); assert.deepStrictEqual(app.get().view, { name: "client", id: TPL });
  app.set({ view: { name: "client", id: TPL, folder: "gone" } }); fns.render(); assert.deepStrictEqual(app.get().view, { name: "client", id: TPL }, "a folder deleted on another device: the Templates page");
  quiet();
});

test("a template moved out of his folders is My templates' next; a built-in one too, its program left behind; Save as template numbers after the loose ones only", () => {
  setup(FOLDERS, [...TPLS, T("b2", { program: "Hypertrophy", phase: 2, stage: 3, n: 7 })]);   // a built-in Workout 7: not one of My templates
  fns.placeTemplate(maps.trainings.get("b1"), null);
  assert.deepStrictEqual(maps.trainings.get("b1").template, { program: "My templates", phase: 0, stage: 0, n: 2 });
  fns.placeTemplate(maps.trainings.get("t5"), "S2"); assert.deepStrictEqual(meta("t5"), ["My templates", 2, "S2"], "into a slide: its next");
  fns.saveAsTemplate({ title: "Copy", rows: [] });
  assert.deepStrictEqual(maps.trainings.get(app.get().view.id).template, { program: "My templates", phase: 0, stage: 0, n: 3 }, "after Workout 2 of My templates (those in folders count in theirs)");
  quiet();
});

test("a template opened before (its draft still clean) moves out with its slide's delete as a real save, never an unsaved change on it", async () => {
  setup(FOLDERS, TPLS, { name: "client", id: TPL, folder: "B", slide: "S1" }); const ask = asking();
  try {
    app.set({ templateDraft: { id: "t1", snapshot: JSON.stringify(maps.trainings.get("t1")), dirty: false, saving: false } });   // he looked at Workout 1 and came back without changing it
    const p = fns.tplMoreItems().find((it) => it.label === "Delete slide").onPick(); await tick(400); ask.yes(); await p;
    const d = app.get().templateDraft;
    assert.deepStrictEqual([meta("t1"), d.dirty, d.snapshot === JSON.stringify(maps.trainings.get("t1")), maps.dirty.has("trainings/t1")], [["My templates", 2, null], false, true, true], "saved past the clean draft (tidySave), the draft still clean");
  } finally { ask.done(); app.set({ templateDraft: null }); quiet(); }
});

const FOLDERS2 = [node("A", "Summer block", null, "folder", 1), node("AS1", "Week 1", "A", "slide", 2), node("AS2", "Week 2", "A", "slide", 3), node("B", "Phase 1", "A", "folder", 4), node("BS1", "Week 1", "B", "slide", 5)];
test("his folder's page is left and found again under one key: opened from its row (its first slide shown, none named), a template opened, and Back lands where the page was, its picture the one the swipe looks for; Back from a folder inside it lands on the slide it was left on", async () => {
  const real = globalThis.scrollTo, ys = []; globalThis.scrollTo = (x, y) => { ys.push(y); globalThis.scrollY = y; };
  const ask = asking();
  try {
    setup(FOLDERS, [...TPLS, T("e1", MINE(9, "S1"), { rows: [] })], { name: "client", id: TPL, folder: "A" });
    fns.go(fns.tplPage("B"));
    const left = fns.viewKey(app.get().view);
    assert.strictEqual(left, fns.viewKey({ name: "client", id: TPL, folder: "B", slide: "S1" }), "keyed by the slide it shows, Week 1, though none was named");
    globalThis.scrollY = 333; fns.go({ name: "training", id: "e1" });
    assert.strictEqual(fns.backKey(), left + "||", "the swipe back's picture: the one the page was left under");
    await fns.goBackNow(); assert.deepStrictEqual([app.get().view, ys[ys.length - 1]], [{ name: "client", id: TPL, folder: "B", slide: "S1" }, 333], "Back: on Week 1, where the page was");
    setup(FOLDERS2, [], { name: "client", id: TPL, folder: "A", slide: "AS2" });
    globalThis.scrollY = 210; fns.go(fns.tplPage("B"));
    assert.strictEqual(fns.backKey(), fns.viewKey({ name: "client", id: TPL, folder: "A", slide: "AS2" }) + "||");
    await fns.goBackNow(); assert.deepStrictEqual([app.get().view, ys[ys.length - 1]], [{ name: "client", id: TPL, folder: "A", slide: "AS2" }, 210], "Back from Phase 1: Summer block on Week 2, where he left it");
    fns.go(fns.tplPage("B")); const p = fns.tplMoreItems().find((it) => it.label === "Delete folder").onPick(); await tick(400); ask.yes(); await p;
    assert.deepStrictEqual(app.get().view, { name: "client", id: TPL, folder: "A", slide: "AS2" }, "Phase 1 deleted from its own page: up to Summer block, on Week 2");
  } finally { globalThis.scrollTo = real; globalThis.scrollY = 0; ask.done(); quiet(); }
});

test("the + makes a template where he is; backed out of with no name and no exercise, it goes again (as a client page's empty workout does), its draft with it; a named one stays", async () => {
  setup(FOLDERS, TPLS, { name: "client", id: TPL, folder: "B", slide: "S2" });
  fns.newWorkoutHere(); const id = app.get().view.id;
  assert.deepStrictEqual([maps.trainings.has(id), (app.get().templateDraft || {}).id], [true, id], "made, open as a draft");
  await fns.goBackNow();
  assert.deepStrictEqual([maps.trainings.has(id), maps.dirty.has("trainings/" + id), app.get().templateDraft, app.get().view], [false, true, null, { name: "client", id: TPL, folder: "B", slide: "S2" }], "gone, its delete on its way to the server");
  fns.newWorkoutHere(); const id2 = app.get().view.id; maps.trainings.get(id2).title = "Upper A";
  await fns.goBackNow(); assert.ok(maps.trainings.has(id2), "named: it stays");
  quiet();
});

test("Delete template, on a template in his folders, lands where Back goes: its folder, on its slide", async () => {
  setup(FOLDERS, [...TPLS, T("e1", MINE(9, "S2"), { rows: [] })], { name: "training", id: "e1" }); const ask = asking();
  try {
    const p = fns.askDelete("e1"); await tick(400); ask.yes(); await p;
    assert.deepStrictEqual([maps.trainings.has("e1"), app.get().view], [false, { name: "client", id: TPL, folder: "B", slide: "S2" }]);
  } finally { ask.done(); quiet(); }
});

test("Delete folder reads what is in it again once he answers: a folder and a slide a sync brought in while the question was up go with it", async () => {
  setup(FOLDERS, TPLS, { name: "client", id: TPL, folder: "A" }); const ask = asking();
  try {
    const p = fns.tplMoreItems().find((it) => it.label === "Delete folder").onPick();
    const tc = maps.clients.get(TPL); tc.folders = [...tc.folders, node("C", "Phase 2", "A", "folder", 20), node("CS", "Week 1", "C", "slide", 21)]; maps.trainings.set("t9", T("t9", MINE(1, "CS")));   // made on his iPhone, synced in meanwhile
    await tick(400); ask.yes(); await p;
    assert.deepStrictEqual([fns.tplNodes().map((f) => f.id), maps.deletedFolders.has("C"), maps.deletedFolders.has("CS"), meta("t9")[0], meta("t9")[2]], [["H"], true, true, "My templates", null], "nothing left behind at the top; its template loose too");
  } finally { ask.done(); quiet(); }
});

test("choosing a template for a client: an empty folder or slide says only that it is empty (no + and no … on screen to point at)", () => {
  setup([node("E", "Empty", null, "folder", 1), node("A", "New", null, "folder", 2), node("S", "Week 1", "A", "slide", 3)], [], { name: "client", id: TPL, folder: "E" });
  fns.setPickFor("c1");
  drawing((got) => {
    fns.render(); assert.deepStrictEqual(read(got()), ["empty: Nothing here yet."]);
    fns.go(fns.tplPage("A")); assert.deepStrictEqual(read(got()), ["tabs [Week 1]", "empty: Nothing here yet."]);
  });
  quiet();
});

test("a restore never wipes his folders: a backup from before them leaves them as they are (nothing to restore for the Templates record); one with other folders says so", () => {
  setup(FOLDERS, TPLS);
  maps.seenAt.set("clients/" + TPL, "S1");
  const tc = maps.clients.get(TPL), copy = { id: TPL, name: "Templates", kind: "templates" };   // the record as an old backup has it: no folders
  for (const k of Object.keys(tc)) if (k !== "folders") copy[k] = JSON.parse(JSON.stringify(tc[k]));
  const old = fns.planRestore({ app: "fiala-trainings", format: 1, clients: { [TPL]: copy }, trainings: {} });
  assert.deepStrictEqual([old.cs.length, old.text], [0, ""], "the same record but for the folders: nothing to do");
  const other = fns.planRestore({ app: "fiala-trainings", format: 1, clients: { [TPL]: { ...copy, folders: [node("Z", "Winter", null, "folder", 1)] } }, trainings: {} });
  assert.strictEqual(other.text, "the packages list and the template folders from the file go into the app. It replaces a copy already here. Everything else stays as it is.");
  assert.deepStrictEqual(fns.tplNodes().map((f) => f.id), ["A", "H", "B", "S1", "S2"], "planning changed nothing here");
  quiet();
});

test("Reorder folders (his pick, 12 Nov: his folders only, like the Clients list's Reorder): grips on his folders, the built-in programs below without; Done at the top right, no … and no +; a folder let go in a new place keeps it, marked for the save; a new one comes last; Done or another page ends it", () => {
  setup();
  drawing((got) => {
    fns.tplMoreItems().find((it) => it.label === "Reorder folders").onPick();
    assert.deepStrictEqual([fns.tplOrderOn(), $("tMore").hidden, $("navDone").hidden, $("addBtn").hidden], [true, true, false, true], "Done instead of the …, and no +");
    assert.deepStrictEqual(read(got()), ["# Programs", "≡ Rehab", "≡ Summer block", "· Fat Burn"], "his folders with the grip (Rehab first: made first), Fat Burn below as it is; My templates out of the way");
    const rows = got()[1].kids; assert.deepStrictEqual([!!(rows[0].on.pointerdown || []).length, !!(rows[2].on.pointerdown || []).length], [true, false], "his are dragged by the grip; a built-in program is not");
    fns.moveFolderTo("A", 0);
    assert.deepStrictEqual([fns.tplKids(null, "folder").map((x) => x.id), [...maps.folderTouched.keys()].sort(), maps.dirty.has("clients/" + TPL)], [["A", "H"], ["A", "H"], true], "Summer block first now, both marked as this device's, the order saved");
    assert.deepStrictEqual(read(got()), ["# Programs", "≡ Summer block", "≡ Rehab", "· Fat Burn"]);
    maps.folderTouched.clear(); fns.moveFolderTo("A", 0); assert.strictEqual(maps.folderTouched.size, 0, "let go where it was: nothing changed");
    fns.doneTplOrder();
    assert.deepStrictEqual([fns.tplOrderOn(), $("tMore").hidden, $("navDone").hidden, read(got()).slice(-4)], [false, false, true, ["# Programs", "> Summer block · 4 workouts", "> Rehab · 0 workouts", "> Fat Burn · 1 workout"]], "Done: the page as it was, in the new order");
    maps.clients.get(TPL).folders.push(node("N", "New one", null, "folder", 30)); assert.deepStrictEqual(fns.tplKids(null, "folder").map((x) => x.id), ["A", "H", "N"], "a folder made after a reorder comes last");
    fns.tplMoreItems().find((it) => it.label === "Reorder folders").onPick(); fns.go(fns.tplPage("A")); assert.strictEqual(fns.tplOrderOn(), false, "another page ends it");
    fns.go({ name: "client", id: TPL }, true); assert.strictEqual(fns.tplOrderOn(), false, "and coming back does not start it again");
  });
  quiet();
});

test("Reorder folders inside a folder: offered where two folders or more stand in it (after New slide), puts them in order under Folders; one folder alone offers none", () => {
  setup([...FOLDERS, node("B2", "Phase 2", "A", "folder", 9)], TPLS, { name: "client", id: TPL, folder: "A" });
  assert.deepStrictEqual(menu(), ["New folder", "New slide", "Reorder folders", "Rename folder", "red Delete folder"]);
  drawing((got) => {
    fns.tplMoreItems().find((it) => it.label === "Reorder folders").onPick();
    assert.deepStrictEqual([pageNow(), read(got())], [["Templates", "Summer block"], ["# Folders", "≡ Phase 1", "≡ Phase 2"]]);
    fns.moveFolderTo("B2", 0); assert.deepStrictEqual(read(got()), ["# Folders", "≡ Phase 2", "≡ Phase 1"]);
    fns.doneTplOrder(); assert.deepStrictEqual(read(got()).slice(0, 3), ["# Folders", "> Phase 2 · 0 workouts", "> Phase 1 · 4 workouts"]);
  });
  fns.go(fns.tplPage("B")); assert.ok(!menu().includes("Reorder folders"), "no folders inside Phase 1: nothing to reorder");
  quiet();
});

test("Reorder by the finger: the grip lifts the folder and the others slide out of its way; let go, it lands among his folders only, however far it went (never among the built-in programs); a sync's redraw waits while it is held; a second move marks only what moved", () => {
  setup([...FOLDERS.slice(0, 2), node("P", "Pre-season", null, "folder", 7), ...FOLDERS.slice(2)], TPLS);   // his top folders in the order made: Rehab, Summer block, Pre-season
  drawing((got) => {
    fns.tplMoreItems().find((it) => it.label === "Reorder folders").onPick();
    const lay = () => { const ul = got()[1]; ul.children = ul.kids; ul.kids.forEach((li, k) => { li.parentElement = ul; li.getBoundingClientRect = () => ({ top: 100 + k * 56, bottom: 156 + k * 56, height: 56 }); li.setPointerCapture = () => {}; }); return ul; };   // the rows as a page lays them out: 56 tall, one under the other
    const press = (li, y) => li.on.pointerdown[0]({ button: 0, pointerType: "touch", pointerId: 1, clientY: y, target: { closest: (sel) => (sel === ".grip" ? {} : null) } });
    let ul = lay(); const [rehab, summer, pre] = ul.kids;
    press(pre, 240); pre.on.pointermove[0]({ clientY: 240 - 112 });  // Pre-season up two rows
    assert.deepStrictEqual([pre.style.transform, rehab.style.transform, summer.style.transform, ul.kids[3].style.transform || ""], ["translateY(-112px)", "translateY(56px)", "translateY(56px)", ""], "it follows the finger, the two above slide down a row, Fat Burn stays");
    fns.render(); assert.strictEqual(got()[1], ul, "a sync's redraw while it is held leaves the list under the finger alone");
    pre.on.pointerup[0]({});
    assert.deepStrictEqual([fns.tplKids(null, "folder").map((x) => x.id), read(got()).slice(1, 4)], [["P", "H", "A"], ["≡ Pre-season", "≡ Rehab", "≡ Summer block"]], "let go at the top: first");
    ul = lay(); const first = ul.kids[0];
    press(first, 128); first.on.pointermove[0]({ clientY: 128 + 2000 });   // dragged far down, past the built-in programs
    assert.strictEqual(ul.kids[3].style.transform || "", "", "Fat Burn never moves");
    maps.folderTouched.clear(); first.on.pointerup[0]({});
    assert.deepStrictEqual([fns.tplKids(null, "folder").map((x) => x.id), [...maps.folderTouched.keys()].sort()], [["H", "A", "P"], ["A", "H", "P"]], "it lands last among his folders, above Fat Burn");
    ul = lay(); const second = ul.kids[1];
    maps.folderTouched.clear(); press(second, 184); second.on.pointermove[0]({ clientY: 184 + 56 }); second.on.pointerup[0]({});
    assert.deepStrictEqual([fns.tplKids(null, "folder").map((x) => x.id), [...maps.folderTouched.keys()].sort()], [["H", "P", "A"], ["A", "P"]], "Summer block one down: only the two that moved are marked (Rehab kept its place)");
  });
  quiet();
});

test("Reorder ends when its page goes from under it: a folder being reordered, deleted on another device, leaves the Templates page as it is (no grips there)", () => {
  setup([...FOLDERS, node("B2", "Phase 2", "A", "folder", 9)], TPLS, { name: "client", id: TPL, folder: "A" });
  fns.tplMoreItems().find((it) => it.label === "Reorder folders").onPick(); assert.strictEqual(fns.tplOrderOn(), true);
  maps.clients.get(TPL).folders = maps.clients.get(TPL).folders.filter((x) => x.id !== "A" && x.parent !== "A"); fns.render();   // a sync took Summer block away
  assert.deepStrictEqual([app.get().view, fns.tplOrderOn(), $("tMore").hidden, $("navDone").hidden], [{ name: "client", id: TPL }, false, false, true], "on the Templates page, as it is");
  quiet();
});

const coach = (sb) => { quiet(); app.reset(); app.set({ sb, signedIn: true, clientMode: false, backend: fns.cloudBackend }); };
const settle = async () => { const until = Date.now() + 15000; do await tick(5); while ((app.get().inflight > 0 || maps.timers.size) && Date.now() < until); assert.strictEqual(maps.timers.size, 0); };
const F = (id, name, m) => node(id, name, null, "folder", m);
const names = (fs) => fs.map((f) => f.id + ":" + f.name).sort();

test("two of his devices: folders made on either are both kept; a rename made there is taken unless this one renamed it too; one deleted here stays deleted; one deleted there (and not changed here) goes here too", async () => {
  const sb = makeSupabase(); coach(sb);
  const base = { id: TPL, name: "Templates", kind: "templates", folders: [F("f1", "Push", 1), F("f3", "Pull", 3), F("f5", "Legs", 5), F("f6", "Core", 6), F("f7", "Arms", 7)] };
  sb.seed("ft_clients", TPL, { ...base, folders: [F("f1", "Push day", 1), F("f3", "Pull", 3), F("f4", "Glutes", 4), F("f6", "Core B", 6)] });   // the other device: renamed f1 and f6, made f4, deleted f5 and f7
  maps.seenAt.set("clients/" + TPL, "S0"); maps.seenDoc.set("clients/" + TPL, JSON.stringify(base));   // what this device last read: older than the server's copy
  const mine = { ...base, folders: [F("f1", "Push", 1), F("f2", "Mobility", 2), F("f5", "Legs", 5), F("f6", "Core A", 6), F("f7", "Arm day", 7)] };   // this device: made f2, renamed f6 and f7, deleted f3
  maps.clients.set(TPL, JSON.parse(JSON.stringify(mine))); for (const id of ["f2", "f6", "f7"]) maps.folderTouched.set(id, TPL); maps.deletedFolders.set("f3", TPL);
  await fns.cloudBackend.set("clients", TPL, JSON.parse(JSON.stringify(mine)));
  const want = ["f1:Push day", "f2:Mobility", "f4:Glutes", "f6:Core A", "f7:Arm day"];
  assert.deepStrictEqual(names(sb.tables.ft_clients.get(TPL).data.folders), want, "saved: f7, deleted there but renamed here, stays");
  assert.deepStrictEqual(names(maps.clients.get(TPL).folders), want, "the copy on screen too");
});

test("two devices, a Reorder on one: a rename made on the other keeps its new name in the new order; a folder deleted on the other is not brought back by the move; a reorder made there survives a rename made here (the v279 review's catch: only what this device changed rides on the save)", async () => {
  const base = { id: TPL, name: "Templates", kind: "templates", folders: [F("A", "Summer block", 5), F("H", "Rehab", 1)] };   // in the order made: Rehab, Summer block
  const run = async (server, here) => {
    const sb = makeSupabase(); coach(sb); sb.seed("ft_clients", TPL, server);
    maps.seenAt.set("clients/" + TPL, "S0"); maps.seenDoc.set("clients/" + TPL, JSON.stringify(base));   // what this device last read: older than the server's copy
    maps.clients.set(TPL, JSON.parse(JSON.stringify(base))); here();
    for (const t of maps.timers.values()) clearTimeout(t); maps.timers.clear();
    await fns.cloudBackend.set("clients", TPL, JSON.parse(JSON.stringify(maps.clients.get(TPL))));
    return sb.tables.ft_clients.get(TPL).data.folders.map((f) => f.id + ":" + f.name + ":" + (f.sort === undefined ? "-" : f.sort)).sort();
  };
  const moveA = () => fns.moveFolderTo("A", 0);                       // Summer block dragged to the top here
  assert.deepStrictEqual(await run({ ...base, folders: [F("A", "Summer block", 5), F("H", "Knee rehab", 1)] }, moveA), ["A:Summer block:0", "H:Knee rehab:1"], "(a) renamed there, moved here: both");
  assert.deepStrictEqual(await run({ ...base, folders: [F("A", "Summer block", 5)] }, moveA), ["A:Summer block:0"], "(b) deleted there, moved here: it stays deleted");
  const renameA = () => { const tc = maps.clients.get(TPL); tc.folders = tc.folders.map((f) => (f.id === "A" ? { ...f, name: "Summer block 2" } : f)); maps.folderTouched.set("A", TPL); };
  assert.deepStrictEqual(await run({ ...base, folders: [{ ...F("A", "Summer block", 5), sort: 0 }, { ...F("H", "Rehab", 1), sort: 1 }] }, renameA), ["A:Summer block 2:0", "H:Rehab:1"], "(c) reordered there, renamed here: both");
  assert.deepStrictEqual(fns.tplKids(null, "folder").map((f) => f.name), ["Summer block 2", "Rehab"], "shown in the order made there");
  quiet();
});

test("no copy read before (the app relaunched offline): both sides' folders kept, except those deleted here", async () => {
  const sb = makeSupabase(); coach(sb);
  sb.seed("ft_clients", TPL, { id: TPL, name: "Templates", kind: "templates", folders: [F("f1", "Push", 1), F("f3", "Pull", 3), F("f4", "Glutes", 4)] });
  const mine = { id: TPL, name: "Templates", kind: "templates", folders: [F("f1", "Push", 1), F("f2", "Mobility", 2)] };
  maps.clients.set(TPL, JSON.parse(JSON.stringify(mine))); maps.folderTouched.set("f2", TPL); maps.deletedFolders.set("f3", TPL);
  await fns.cloudBackend.set("clients", TPL, JSON.parse(JSON.stringify(mine)));
  assert.deepStrictEqual(names(sb.tables.ft_clients.get(TPL).data.folders), ["f1:Push", "f2:Mobility", "f4:Glutes"]);
});

test("his folder changes are kept on the device across a relaunch and cleared only by the save that carried them; a reset and a sign-out forget them", async () => {
  const sb = makeSupabase(); coach(sb); sb.delayMs = 30;
  sb.seed("ft_clients", TPL, { id: TPL, name: "Templates", kind: "templates", folders: [F("f1", "Push", 1), F("f3", "Pull", 3)] });
  const tc = { id: TPL, name: "Templates", kind: "templates", folders: [F("f1", "Push day", 1)] }; maps.clients.set(TPL, tc);
  maps.folderTouched.set("f1", TPL); maps.deletedFolders.set("f3", TPL);
  fns.scheduleSave("clients", TPL, 0); await tick(5);
  const stored = JSON.parse(localStorage.getItem("fiala.pending.v1"));
  assert.deepStrictEqual([stored.foldersTouched, stored.foldersGone], [[["f1", TPL]], [["f3", TPL]]], "written to the device with the queue");
  maps.folderTouched.clear(); maps.deletedFolders.clear(); fns.restorePending();
  assert.deepStrictEqual([maps.folderTouched.get("f1"), maps.deletedFolders.get("f3")], [TPL, TPL], "back after the relaunch");
  await settle();
  assert.deepStrictEqual(names(sb.tables.ft_clients.get(TPL).data.folders), ["f1:Push day"], "the rename and the delete landed (read first: no stamp)");
  assert.deepStrictEqual([maps.folderTouched.size, maps.deletedFolders.size], [0, 0], "the save that carried them clears them");
  maps.folderTouched.set("x", TPL); maps.deletedFolders.set("y", TPL); app.reset(); assert.deepStrictEqual([maps.folderTouched.size, maps.deletedFolders.size], [0, 0], "resetState");
  assert.strictEqual(src.split("folderTouched.clear(); deletedFolders.clear();").length - 1, 2, "the account switch and the coach's sign-out forget them, as the packages'");
});

test("the page: the name field in the question sheet, the + alone at the foot's trailing edge, the last template clear of it, a long slide name cut short", () => {
  assert.ok(html.includes('<h3 id="askTitle"></h3><p class="lead" id="askText"></p><input class="ask-input" id="askInput" type="text" autocomplete="off" autocapitalize="words" spellcheck="false" enterkeyhint="done" aria-labelledby="askTitle" hidden><div class="ask-actions">'), "named by the sheet's title, capital letters for a name, Done on the keyboard");
  assert.ok(/\n {2}\.sheet\.confirm-sheet \.ask-input \{ display: block; width: 100%; box-sizing: border-box; margin: 4px 0 0; min-height: 48px; padding: 0 14px; border: 0; border-radius: var\(--r-field\); background: var\(--field\); color: var\(--text-primary\); font: inherit; font-size: 1\.0625rem; letter-spacing: 0; \}/.test(html), "17 px: the phone does not zoom into it");
  assert.ok(html.includes("\n  .sheet.confirm-sheet .ask-input[hidden] { display: none; }\n"), "every other question has no field");
  assert.ok(html.includes("\n  #dock.tp { justify-content: flex-end; padding: 0 21px; max-width: 680px; margin: 0 auto; }"), "where the workout page's + sits when alone");
  assert.ok(html.includes("\n  body.tplus #vClient { padding-bottom: 100px; }"));
  assert.ok(html.includes("\n  .seg.stages button { min-width: 0; }\n  .seg.stages button > span { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }"), "cut in a span: the key keeps its 44 pt halo (a clip on the key would cut it)");
  assert.ok(src.includes('const nm = document.createElement("span"); nm.textContent = x.name; b.appendChild(nm);'), "his slide's name in that span");
  assert.ok(src.includes('if (input) f.focus({ preventScroll: true }); else n.focus({ preventScroll: true });'), "the field takes the focus in the tap that opened the sheet, so the phone gives its keyboard");
});
