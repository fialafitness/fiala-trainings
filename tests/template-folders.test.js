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
const quiet = () => { for (const t of maps.timers.values()) clearTimeout(t); maps.timers.clear(); fns.setPreview(false); fns.setPickFor(null); fns.setFillFor(null); };   // no save left to run into a later test
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
const adds = () => fns.tplAddItems().map((it) => it.label);
const add = (label) => fns.tplAddItems().find((it) => it.label === label).onPick();
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
  : e.className === "listbar" ? ["bar " + e.kids.map((k) => k.textContent).join(" · ")]
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

test("an empty folder says what to do: + for a template, a folder or a slide (a folder inside a folder: a template or a slide); an empty slide: + for a template", () => {
  setup([node("A", "New program", null, "folder", 1), node("B", "Inner", "A", "folder", 2), node("E", "Empty", null, "folder", 3), node("S", "Week 1", "A", "slide", 4)], [], { name: "client", id: TPL, folder: "E" });
  drawing((got) => {
    fns.render(); assert.deepStrictEqual(read(got()), ["empty: Nothing here yet. Tap + for a template, a folder or a slide."]);
    fns.go(fns.tplPage("B")); assert.deepStrictEqual(read(got()), ["empty: Nothing here yet. Tap + for a template or a slide."]);
    fns.go(fns.tplPage("A")); assert.deepStrictEqual(read(got()), ["# Folders", "> Inner · 0 workouts", "tabs [Week 1]", "empty: Nothing here yet. Tap + for a template."], "a new slide, still empty");
  });
  quiet();
});

test("the two buttons (his ask, 12 Nov: \"split it in 2 buttons\"): the + has everything he can add there (New template, New folder at the top and in a top folder, New slide in any folder); the … the rest (Reorder; in a folder the slide shown's Rename and Delete, the folder's Rename and, last and red, Delete); neither on a built-in program's pages", () => {
  setup();
  assert.deepStrictEqual([adds(), menu()], [["New template", "New folder"], ["Reorder"]], "the Templates page");
  fns.go(fns.tplPage("A")); assert.deepStrictEqual([adds(), menu()], [["New template", "New folder", "New slide"], ["Rename folder", "red Delete folder"]], "a top folder with no slides and one folder inside");
  fns.go(fns.tplPage("B")); assert.deepStrictEqual([adds(), menu()], [["New template", "New slide"], ["Use for a client", "Rename slide", "Rename folder", "Move folder", "red Delete slide", "red Delete folder"]], "a folder inside a folder: no deeper folder (and Week 1's three templates go into a client's calendar at once: v282; it can go elsewhere: v283)");
  const MI = fns.menuIcons();
  assert.deepStrictEqual([fns.tplAddItems().map((it) => it.icon), fns.tplMoreItems().map((it) => it.icon)], [[MI.docPlus, MI.slidePlus], [MI.calendar, MI.pencil, MI.pencil, MI.folder, MI.trash, MI.trash]]);
  fns.go({ name: "client", id: TPL }); assert.deepStrictEqual([fns.tplAddItems().map((it) => it.icon), fns.tplMoreItems().map((it) => it.icon)], [[MI.docPlus, MI.folderPlus], [MI.reorder]]);
  assert.strictEqual(MI.reorder, MI.swap.replace("<path ", '<path transform="rotate(90 21.88 10)" '), "Reorder: the swap arrows a quarter turn round (up beside down)");
  for (const k of ["folderPlus", "slidePlus", "docPlus"]) assert.ok(/^<svg class="mi" viewBox="0 0 16 16" aria-hidden="true" fill="currentColor" fill-rule="evenodd"><path d="M[^"]+Z"\/><\/svg>$/.test(MI[k]) && !MI[k].includes("stroke"), k + ": our own filled glyph, its plus cut through it");
  fns.tplAddItems()[0].onPick(); assert.deepStrictEqual(maps.trainings.get(app.get().view.id).template, { program: "My templates", phase: 0, stage: 0, n: 2 }, "New template: as the round + at the foot");
  fns.go({ name: "client", id: TPL, program: "Fat Burn", phase: null, stage: null }); assert.deepStrictEqual([adds(), menu()], [[], []], "a built-in program: as it was");
  fns.go({ name: "client", id: TPL, program: "Fat Burn", phase: 1, stage: 1 }); assert.deepStrictEqual([adds(), menu()], [[], []]);
  quiet();
});
test("the bar on the Templates pages: the + and the … at the top, and the round glass + (New template) at the foot's trailing edge; neither on a program's pages nor while picking a template for a client; the swipe back's bar agrees", () => {
  const add = el("button"); add.attrs = {}; add.setAttribute = (k, v) => { add.attrs[k] = String(v); }; byId.set("addBtn", add);
  try {
    const bar = () => ({ more: !$("tMore").hidden, top: !$("tAdd").hidden, plus: !$("addBtn").hidden, label: add.attrs["aria-label"], foot: $("dock").classList.contains("tp"), pad: document.body.classList.contains("tplus") });
    const agree = (what) => { const b = fns.barFor(fns.viewKey(app.get().view)); assert.deepStrictEqual([b.tMore, b.tAdd], [!$("tMore").hidden, !$("tAdd").hidden], what + ": the swipe back's bar agrees with the page"); };
    const ON = { more: true, top: true, plus: true, label: "New template", foot: true, pad: true }, OFF = { more: false, top: false, plus: false, label: "New workout", foot: false, pad: false };
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
    const no = add("New folder");
    assert.deepStrictEqual(sheet(), { up: true, title: "New folder", text: null, field: "", yes: "Add", red: false });
    assert.deepStrictEqual([$("askInput").placeholder, $("askInput").maxLength], ["Name", 40]);
    await tick(400); assert.strictEqual($("askYes").disabled, true, "no name yet: Add waits");
    ask.type("   "); assert.strictEqual($("askYes").disabled, true, "spaces are no name");
    ask.no(); await no; assert.deepStrictEqual([fns.tplNodes().length, $("askSheet").hidden, maps.dirty.size], [0, true, 0], "Cancel: nothing made, nothing to save");
    const yes = add("New folder"); await tick(400);
    ask.yes(); assert.strictEqual($("askSheet").hidden, false, "Add with no name does nothing");
    ask.type("  Summer   block "); assert.strictEqual($("askYes").disabled, false);
    ask.yes(); await yes;
    const [f] = fns.tplNodes();
    assert.deepStrictEqual([f.name, f.parent, f.kind, typeof f.at], ["Summer block", null, "folder", "string"], "at the top, his name with its spaces tidied");
    assert.deepStrictEqual([maps.folderTouched.get(f.id), maps.dirty.has("clients/" + TPL)], [TPL, true], "marked as this device's for a merge, and saved");
    fns.go(fns.tplPage(f.id)); const inner = add("New folder"); await tick(400); ask.type("Phase 1"); ask.yes(); await inner;
    assert.deepStrictEqual(fns.tplKids(f.id, "folder").map((x) => x.name), ["Phase 1"], "in a top folder: inside it");
  } finally { ask.done(); quiet(); }
});

test("New slide: named by him; the folder's first takes the templates in the folder itself, in their order; each new one is the slide shown, where the + puts the next template", async () => {
  setup([node("A", "Summer block", null, "folder", 1)], [T("t1", MINE(5, "A")), T("t2", MINE(2, "A")), T("t5", MINE(1))], { name: "client", id: TPL, folder: "A" }); const ask = asking();
  try {
    const one = add("New slide");
    assert.deepStrictEqual(sheet(), { up: true, title: "New slide", text: null, field: "", yes: "Add", red: false });
    await tick(400); ask.type("Week 1"); ask.yes(); await one;
    const [s1] = fns.tplKids("A", "slide");
    assert.deepStrictEqual([s1.name, meta("t2"), meta("t1"), meta("t5")], ["Week 1", ["My templates", 1, s1.id], ["My templates", 2, s1.id], ["My templates", 1, null]], "Workout 2 and Workout 5 become Week 1's Workout 1 and 2; the loose one stays loose");
    assert.strictEqual(app.get().view.slide, s1.id);
    const two = add("New slide"); await tick(400); ask.type("Week 2"); ask.yes(); await two;
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
  maps.seenAt.set("clients/" + TPL, "S1"); maps.clients.get(TPL).rootOrder = ["p:Fat Burn", "H", "A"];   // his Programs order too (Reorder, v280)
  const tc = maps.clients.get(TPL), copy = { id: TPL, name: "Templates", kind: "templates" };   // the record as an old backup has it: no folders, no order
  for (const k of Object.keys(tc)) if (k !== "folders" && k !== "rootOrder") copy[k] = JSON.parse(JSON.stringify(tc[k]));
  const old = fns.planRestore({ app: "fiala-trainings", format: 1, clients: { [TPL]: copy }, trainings: {} });
  assert.deepStrictEqual([old.cs.length, old.text], [0, ""], "the same record but for the folders and the order: nothing to do");
  const other = fns.planRestore({ app: "fiala-trainings", format: 1, clients: { [TPL]: { ...copy, folders: [node("Z", "Winter", null, "folder", 1)] } }, trainings: {} });
  assert.strictEqual(other.text, "the packages list and the template folders from the file go into the app. It replaces a copy already here. Everything else stays as it is.");
  const order = fns.planRestore({ app: "fiala-trainings", format: 1, clients: { [TPL]: { ...copy, folders: JSON.parse(JSON.stringify(maps.clients.get(TPL).folders)), rootOrder: ["A", "H", "p:Fat Burn"] } }, trainings: {} });
  assert.strictEqual(order.text, "the packages list and the order of the programs from the file go into the app. It replaces a copy already here. Everything else stays as it is.", "another Programs order in the file: said so");
  assert.deepStrictEqual(fns.tplNodes().map((f) => f.id), ["A", "H", "B", "S1", "S2"], "planning changed nothing here");
  quiet();
});

test("Reorder on the Templates page (his ask, 12 Nov: \"in this slide I should have already been able to see reorder\"): the whole Programs list, the built-in programs too, each with the grip; Done at the top right, no …, no + and no + beside it; a row let go in a new place keeps it, saved with the Templates record; one added since comes after; Done or another page ends it", () => {
  setup();
  drawing((got) => {
    fns.tplMoreItems().find((it) => it.label === "Reorder").onPick();
    assert.deepStrictEqual([fns.tplOrderOn(), $("tMore").hidden, $("tAdd").hidden, $("navDone").hidden, $("addBtn").hidden], [true, true, true, false, true], "Done instead of the two buttons, and no + at the foot");
    assert.deepStrictEqual(read(got()), ["# Programs", "≡ Rehab", "≡ Summer block", "≡ Fat Burn"], "his folders and Fat Burn, each with the grip; My templates out of the way");
    assert.ok(got()[1].kids.every((li) => (li.on.pointerdown || []).length === 1), "every row is dragged by its grip");
    fns.moveRootTo("p:Fat Burn", 0);
    assert.deepStrictEqual([maps.clients.get(TPL).rootOrder, maps.dirty.has("clients/" + TPL), read(got())], [["p:Fat Burn", "H", "A"], true, ["# Programs", "≡ Fat Burn", "≡ Rehab", "≡ Summer block"]], "Fat Burn first now, the order saved with the Templates record");
    maps.dirty.clear(); fns.moveRootTo("p:Fat Burn", 0); assert.strictEqual(maps.dirty.size, 0, "let go where it was: nothing to save");
    fns.doneTplOrder();
    assert.deepStrictEqual([fns.tplOrderOn(), $("tMore").hidden, $("tAdd").hidden, $("navDone").hidden, read(got()).slice(-4)], [false, false, false, true, ["# Programs", "> Fat Burn · 1 workout", "> Rehab · 0 workouts", "> Summer block · 4 workouts"]], "Done: the page as it was, in the new order");
    maps.clients.get(TPL).folders.push(node("N", "New one", null, "folder", 30)); assert.deepStrictEqual(fns.tplRootList().map((e) => e.key), ["p:Fat Burn", "H", "A", "N"], "a folder made after a reorder comes after");
    fns.tplMoreItems().find((it) => it.label === "Reorder").onPick(); fns.go(fns.tplPage("A")); assert.strictEqual(fns.tplOrderOn(), false, "another page ends it");
    fns.go({ name: "client", id: TPL }, true); assert.strictEqual(fns.tplOrderOn(), false, "and coming back does not start it again");
  });
  setup(FOLDERS.filter((f) => f.id !== "H"), TPLS); assert.deepStrictEqual(menu(), ["Reorder"], "one folder of his and Fat Burn: two to put in order");
  setup([], [T("t5", MINE(1))]); assert.deepStrictEqual(menu(), [], "nothing to put in order: no Reorder");
  quiet();
});
test("Reorder folders inside a folder: offered first in the … where two folders or more stand in it, puts them in order under Folders; one folder alone offers none", () => {
  setup([...FOLDERS, node("B2", "Phase 2", "A", "folder", 9)], TPLS, { name: "client", id: TPL, folder: "A" });
  assert.deepStrictEqual(menu(), ["Reorder folders", "Rename folder", "red Delete folder"]);
  drawing((got) => {
    fns.tplMoreItems().find((it) => it.label === "Reorder folders").onPick();
    assert.deepStrictEqual([pageNow(), read(got())], [["Templates", "Summer block"], ["# Folders", "≡ Phase 1", "≡ Phase 2"]]);
    fns.moveFolderTo("B2", 0); assert.deepStrictEqual(read(got()), ["# Folders", "≡ Phase 2", "≡ Phase 1"]);
    fns.doneTplOrder(); assert.deepStrictEqual(read(got()).slice(0, 3), ["# Folders", "> Phase 2 · 0 workouts", "> Phase 1 · 4 workouts"]);
  });
  fns.go(fns.tplPage("B")); assert.ok(!menu().includes("Reorder folders"), "no folders inside Phase 1: nothing to reorder");
  quiet();
});

test("Reorder by the finger: the grip lifts the row and the others slide out of its way; let go, it lands where the finger left it (however far it went, within the list); a sync's redraw waits while it is held; a second move marks only the folders that moved; on the Templates page a built-in program moves too", () => {
  setup([...FOLDERS, node("B2", "Phase 2", "A", "folder", 9), node("B3", "Phase 3", "A", "folder", 10)], TPLS, { name: "client", id: TPL, folder: "A" });   // inside Summer block: Phase 1, Phase 2, Phase 3
  drawing((got) => {
    fns.tplMoreItems().find((it) => it.label === "Reorder folders").onPick();
    const lay = () => { const ul = got()[1]; ul.children = ul.kids; ul.kids.forEach((li, k) => { li.parentElement = ul; li.getBoundingClientRect = () => ({ top: 100 + k * 56, bottom: 156 + k * 56, height: 56 }); li.setPointerCapture = () => {}; }); return ul; };   // the rows as a page lays them out: 56 tall, one under the other
    const press = (li, y) => li.on.pointerdown[0]({ button: 0, pointerType: "touch", pointerId: 1, clientY: y, target: { closest: (sel) => (sel === ".grip" ? {} : null) } });
    let ul = lay(); const [p1, p2, p3] = ul.kids;
    press(p3, 240); p3.on.pointermove[0]({ clientY: 240 - 112 });   // Phase 3 up two rows
    assert.deepStrictEqual([p3.style.transform, p1.style.transform, p2.style.transform], ["translateY(-112px)", "translateY(56px)", "translateY(56px)"], "it follows the finger, the two above slide down a row");
    fns.render(); assert.strictEqual(got()[1], ul, "a sync's redraw while it is held leaves the list under the finger alone");
    p3.on.pointerup[0]({});
    assert.deepStrictEqual([fns.tplKids("A", "folder").map((x) => x.id), read(got())], [["B3", "B", "B2"], ["# Folders", "≡ Phase 3", "≡ Phase 1", "≡ Phase 2"]], "let go at the top: first");
    ul = lay(); const first = ul.kids[0];
    press(first, 128); first.on.pointermove[0]({ clientY: 128 + 2000 }); maps.folderTouched.clear(); first.on.pointerup[0]({});
    assert.deepStrictEqual([fns.tplKids("A", "folder").map((x) => x.id), [...maps.folderTouched.keys()].sort()], [["B", "B2", "B3"], ["B", "B2", "B3"]], "dragged far down: last, never past the list");
    ul = lay(); const second = ul.kids[1];
    maps.folderTouched.clear(); press(second, 184); second.on.pointermove[0]({ clientY: 184 + 56 }); second.on.pointerup[0]({});
    assert.deepStrictEqual([fns.tplKids("A", "folder").map((x) => x.id), [...maps.folderTouched.keys()].sort()], [["B", "B3", "B2"], ["B2", "B3"]], "Phase 2 one down: only the two that moved are marked (Phase 1 kept its place)");
    fns.doneTplOrder(); fns.go({ name: "client", id: TPL }, true); fns.tplMoreItems().find((it) => it.label === "Reorder").onPick();
    ul = lay(); const fat = ul.kids[2];                                // the Templates page: Rehab, Summer block, Fat Burn
    press(fat, 240); fat.on.pointermove[0]({ clientY: 240 - 120 }); fat.on.pointerup[0]({});
    assert.deepStrictEqual([maps.clients.get(TPL).rootOrder, read(got()).slice(1, 4)], [["p:Fat Burn", "H", "A"], ["≡ Fat Burn", "≡ Rehab", "≡ Summer block"]], "Fat Burn dragged to the top");
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

// v281: the built-in programs become folders like his own (his ask, 12 Nov: "all the functions need to work on every single template including the ones I already have")
const BUILT = [T("b1", { program: "Fat Burn", phase: 1, stage: 1, n: 1, phaseName: "Base" }), T("b2", { program: "Fat Burn", phase: 1, stage: 2, n: 1, phaseName: "Base" }), T("b3", { program: "Hypertrophy", phase: 2, stage: 1, n: 3 })];
const BTPLS = [...TPLS.filter((t) => t.id !== "b1"), ...BUILT];
test("the built-in programs become folders: a folder for each program, one in it for each phase (named as its page was), a slide for each week; the same ids and words on every device; no template rewritten; the Programs list in the order he saw it; a second run changes nothing", () => {
  setup(FOLDERS, BTPLS);
  const before = fns.tplRootList().map((e) => e.key);
  assert.deepStrictEqual(before, ["H", "A", "p:Fat Burn", "p:Hypertrophy"]);
  assert.strictEqual(fns.adoptBuiltins(), true);
  const nodes = fns.tplNodes().filter((f) => f.id.startsWith("b:")).map((f) => [f.id, f.name, f.parent, f.kind]);
  assert.deepStrictEqual(nodes, [["b:Fat Burn", "Fat Burn", null, "folder"], ["b:Fat Burn/1", "Phase 1 · Base", "b:Fat Burn", "folder"], ["b:Fat Burn/1/1", "Week 1", "b:Fat Burn/1", "slide"], ["b:Fat Burn/1/2", "Week 2", "b:Fat Burn/1", "slide"], ["b:Hypertrophy", "Hypertrophy", null, "folder"], ["b:Hypertrophy/2", "Phase 2", "b:Hypertrophy", "folder"], ["b:Hypertrophy/2/1", "Week 1", "b:Hypertrophy/2", "slide"]]);
  assert.deepStrictEqual([fns.templateHome(maps.trainings.get("b2")), maps.trainings.get("b2").template.folder, maps.dirty.has("trainings/b2"), maps.dirty.has("clients/" + TPL)], [{ name: "client", id: TPL, folder: "b:Fat Burn/1", slide: "b:Fat Burn/1/2" }, undefined, false, true], "each template finds its week by its program, phase and week: none rewritten; the folders saved");
  assert.deepStrictEqual([maps.clients.get(TPL).rootOrder, fns.tplRootList().map((e) => e.key), maps.clients.get(TPL).builtinsAdopted], [undefined, ["H", "A", "b:Fat Burn", "b:Hypertrophy"], 1], "the Programs list as it was (his folders, then the programs), no order written; the account marked as done");
  assert.ok(!maps.folderTouched.has("b:Fat Burn/1/2") && !maps.folderTouched.has(":rootOrder"), "claiming nothing: another device's renames, reorders and deletes win a merge");
  maps.clients.get(TPL).folders.push(node("N", "New one", null, "folder", 30)); assert.deepStrictEqual(fns.tplRootList().map((e) => e.key), ["H", "A", "N", "b:Fat Burn", "b:Hypertrophy"], "a folder made after it joins his, above the programs (as before)");
  maps.clients.get(TPL).folders.pop();
  const mine = JSON.stringify(maps.clients.get(TPL).folders.filter((f) => f.id.startsWith("b:")));
  assert.strictEqual(fns.adoptBuiltins(), false, "once for the account is enough");
  setup(FOLDERS, BTPLS); maps.deletedFolders.set("b:Fat Burn/1/2", TPL); fns.adoptBuiltins();
  assert.deepStrictEqual([fns.tplNode("b:Fat Burn/1/1") && fns.tplNode("b:Fat Burn/1/1").name, fns.tplNode("b:Fat Burn/1/2")], ["Week 1", null], "a week deleted here and not yet saved is not made again");
  setup(FOLDERS, BTPLS); app.set({ clientMode: true }); assert.strictEqual(fns.adoptBuiltins(), false, "never on a client's phone"); app.set({ clientMode: false });
  setup(FOLDERS, BTPLS); maps.dirty.set("clients/" + TPL, 1); assert.deepStrictEqual([fns.adoptBuiltins(), fns.tplNode("b:Fat Burn")], [false, null], "not while a change of this device's to the Templates record waits: the merge first brings in the other device's");
  setup(FOLDERS, BTPLS); fns.adoptBuiltins();
  assert.strictEqual(JSON.stringify(maps.clients.get(TPL).folders.filter((f) => f.id.startsWith("b:"))), mine, "another device makes the very same folders, word for word (their times too)");
  quiet();
});

test("a built-in program, as a folder, looks as it did and does what his folders do: its phases under Folders, its weeks as the slider, the pill's path; Rename, Delete (its templates to My templates), New template into a week; a page kept from before opens in the same place", async () => {
  setup(FOLDERS, BTPLS, { name: "client", id: TPL, program: "Fat Burn", phase: 1, stage: 2 });   // he had Fat Burn's Phase 1, Week 2 open
  fns.adoptBuiltins();
  assert.deepStrictEqual(app.get().view, { name: "client", id: TPL, folder: "b:Fat Burn/1", slide: "b:Fat Burn/1/2" }, "the page kept from before: the same place, as a folder");
  drawing((got) => {
    fns.go({ name: "client", id: TPL }); assert.deepStrictEqual(read(got()).slice(2), ["# Programs", "> Rehab · 0 workouts", "> Summer block · 4 workouts", "> Fat Burn · 2 workouts", "> Hypertrophy · 1 workout"]);
    fns.go(fns.tplPage("b:Fat Burn")); assert.deepStrictEqual([pageNow(), read(got())], [["Templates", "Fat Burn"], ["# Phases", "> Phase 1 · Base · 2 workouts"]], "its phases under Phases, as its page always had them");
    fns.go(fns.tplPage("b:Fat Burn/1")); assert.deepStrictEqual([pageNow(), read(got())], [["Fat Burn", "Phase 1 · Base"], ["tabs [Week 1] Week 2", "tpl b1"]]);
  });
  assert.strictEqual(fns.templatePath(maps.trainings.get("b1")), "Fat Burn · Phase 1 · Base · Week 1 · Workout 1");
  fns.go(fns.tplPage("b:Fat Burn")); assert.deepStrictEqual([adds(), menu()], [["New template", "New folder", "New slide"], ["Rename folder", "red Delete folder"]], "every folder action, as on his own");
  fns.go({ name: "client", id: TPL, folder: "b:Fat Burn/1", slide: "b:Fat Burn/1/2" }); fns.newWorkoutHere();
  assert.deepStrictEqual(maps.trainings.get(app.get().view.id).template, { program: "My templates", phase: 0, stage: 0, n: 2, folder: "b:Fat Burn/1/2" }, "New template into Week 2: after its Workout 1");
  const ask = asking();
  try {
    fns.go(fns.tplPage("b:Fat Burn")); const p = fns.tplMoreItems().find((it) => it.label === "Delete folder").onPick();
    assert.strictEqual(sheet().text, "Its folder and slides go too, and its 2 templates move to My templates.", "(the empty one the + made went when its page was left)");
    await tick(400); ask.yes(); await p;
    assert.deepStrictEqual([meta("b1"), meta("b2"), fns.tplNode("b:Fat Burn"), app.get().view], [["My templates", 2, null], ["My templates", 3, null], null, { name: "client", id: TPL }], "after My templates' Workout 1, in the order shown; Fat Burn gone");
    assert.strictEqual(fns.adoptBuiltins(), false, "its templates are his own now: Fat Burn is not made again");
  } finally { ask.done(); quiet(); }
});

test("the programs become folders once the server's copy is in (seedTemplates), after a reorder of the programs keeps that order; a built-in template moved into his folder stays there, and finds its week again if that folder goes", async () => {
  setup(FOLDERS, BTPLS); maps.clients.get(TPL).templatesVersion = 99; maps.clients.get(TPL).rootOrder = ["p:Hypertrophy", "A", "p:Fat Burn", "H"];   // an order from before (v280)
  maps.trainings.get("b3").template = { ...maps.trainings.get("b3").template, folder: "A" };   // Hypertrophy's workout put in Summer block
  await fns.seedTemplates();
  assert.deepStrictEqual([fns.tplRootList().map((e) => e.key), fns.tplNode("b:Hypertrophy")], [["A", "b:Fat Burn", "H"], null], "his order, Fat Burn as a folder; Hypertrophy's only workout is in his folder, so no Hypertrophy folder");
  assert.strictEqual(fns.templateHome(maps.trainings.get("b3")).folder, "A");
  maps.clients.get(TPL).folders = maps.clients.get(TPL).folders.filter((f) => f.id !== "A" && f.parent !== "A" && !["S1", "S2"].includes(f.id));   // Summer block deleted on another device (its templates not yet back)
  for (const t of maps.timers.values()) clearTimeout(t); maps.timers.clear(); maps.dirty.clear();   // its save landed: only the account's mark stops another adoption
  assert.deepStrictEqual([fns.adoptBuiltins(), fns.templateHome(maps.trainings.get("b3"))], [false, { name: "client", id: TPL, program: "Hypertrophy", phase: 2, stage: 1 }], "after the account's one adoption nothing is made again on its own (a delete still landing must not bring folders back): it shows on its program's page");
  assert.deepStrictEqual([fns.adoptBuiltins("all"), fns.templateHome(maps.trainings.get("b3"))], [true, { name: "client", id: TPL, folder: "b:Hypertrophy/2", slide: "b:Hypertrophy/2/1" }], "a restore's call files it in its week again");
  assert.ok(maps.folderTouched.has("b:Hypertrophy/2/1"), "and those it makes are this device's, kept by a merge");
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

test("the Programs order across two devices: one reordered there survives a save from here, even one with no copy read before (opened offline), and a rename here; one reordered here lands with a rename made there", async () => {
  const base = { id: TPL, name: "Templates", kind: "templates", folders: [F("A", "Summer block", 5), F("H", "Rehab", 1)] };
  const there = ["A", "p:Fat Burn", "H"];
  const run = async (server, opts, here) => {
    const sb = makeSupabase(); coach(sb); sb.seed("ft_clients", TPL, server); maps.trainings.set("b1", T("b1", { program: "Fat Burn", phase: 1, stage: 1, n: 1 }));   // Fat Burn in the Programs list
    if (opts.read) { maps.seenAt.set("clients/" + TPL, "S0"); maps.seenDoc.set("clients/" + TPL, JSON.stringify(base)); }   // a copy read before (older than the server's), or none at all
    maps.clients.set(TPL, JSON.parse(JSON.stringify(base))); here();
    for (const t of maps.timers.values()) clearTimeout(t); maps.timers.clear();
    await fns.cloudBackend.set("clients", TPL, JSON.parse(JSON.stringify(maps.clients.get(TPL))));
    const saved = sb.tables.ft_clients.get(TPL).data; return [saved.rootOrder || null, saved.folders.map((f) => f.id + ":" + f.name).sort()];
  };
  const renameA = () => { const tc = maps.clients.get(TPL); tc.folders = tc.folders.map((f) => (f.id === "A" ? { ...f, name: "Summer block 2" } : f)); maps.folderTouched.set("A", TPL); };
  assert.deepStrictEqual(await run({ ...base, rootOrder: there }, {}, renameA), [there, ["A:Summer block 2", "H:Rehab"]], "no copy read before, renamed here: the order made there stays");
  assert.deepStrictEqual(await run({ ...base, rootOrder: there }, { read: true }, renameA), [there, ["A:Summer block 2", "H:Rehab"]], "with a copy read before: the same");
  assert.deepStrictEqual(await run({ ...base, folders: [F("A", "Summer block", 5), F("H", "Knee rehab", 1)] }, { read: true }, () => { fns.moveRootTo("p:Fat Burn", 0); }), [["p:Fat Burn", "H", "A"], ["A:Summer block", "H:Knee rehab"]], "reordered here, renamed there: both");
  assert.deepStrictEqual(await run({ ...base, rootOrder: there }, {}, () => { fns.moveRootTo("p:Fat Burn", 0); }), [["p:Fat Burn", "H", "A"], ["A:Summer block", "H:Rehab"]], "reordered here with no copy read before: this device's order lands");
  quiet();
});

test("two devices: one that made the programs into folders from a copy with a change of its own waiting does not undo the other's rename or bring back a program deleted there", async () => {
  const sb = makeSupabase(); coach(sb);
  for (const t of BUILT) maps.trainings.set(t.id, JSON.parse(JSON.stringify(t)));
  const base = { id: TPL, name: "Templates", kind: "templates", folders: [] };
  maps.clients.set(TPL, JSON.parse(JSON.stringify(base))); fns.adoptBuiltins();   // this device's adoption, its save not out (no signal)
  const mine = JSON.parse(JSON.stringify(maps.clients.get(TPL))), theirs = JSON.parse(JSON.stringify(mine));
  theirs.folders = theirs.folders.filter((f) => !f.id.startsWith("b:Hypertrophy")).map((f) => (f.id === "b:Fat Burn" ? { ...f, name: "Fat Loss" } : f));   // the other device: adopted too, renamed Fat Burn, deleted Hypertrophy
  sb.seed("ft_clients", TPL, theirs); maps.seenAt.set("clients/" + TPL, "S0"); maps.seenDoc.set("clients/" + TPL, JSON.stringify(base));
  for (const t of maps.timers.values()) clearTimeout(t); maps.timers.clear();
  await fns.cloudBackend.set("clients", TPL, mine);
  const saved = sb.tables.ft_clients.get(TPL).data.folders;
  assert.deepStrictEqual([saved.find((f) => f.id === "b:Fat Burn").name, saved.some((f) => f.id.startsWith("b:Hypertrophy"))], ["Fat Loss", false], "the rename kept, Hypertrophy stays deleted");
  quiet();
});

test("a reseed's new built-in templates go into their weeks even after the account's adoption, made as this device's", () => {
  setup(FOLDERS, BTPLS); fns.adoptBuiltins();
  maps.trainings.set("b9", T("b9", { program: "Fat Burn", phase: 2, stage: 1, n: 1 }));   // a new week the next templates.json brings
  maps.dirty.set("clients/" + TPL, 1);
  assert.deepStrictEqual([fns.adoptBuiltins(), fns.adoptBuiltins(new Set(["b9"]))], [false, true], "nothing on its own; the reseed's own template, though a change waits");
  assert.deepStrictEqual([fns.templateHome(maps.trainings.get("b9")), maps.folderTouched.has("b:Fat Burn/2/1")], [{ name: "client", id: TPL, folder: "b:Fat Burn/2", slide: "b:Fat Burn/2/1" }, true]);
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
  assert.ok(html.includes("\n  #tAdd:not([hidden]) { width: 51.5px; border-radius: 22px 0 0 22px; }") && html.includes("\n  #tAdd:not([hidden]) + #tMore { width: 51.5px; margin-left: -12px; border-radius: 0 22px 22px 0; }"), "the + and the … in one capsule, as Apple groups two symbol buttons (about 103 wide, 44 tall), the … outermost");
  assert.ok(html.includes('<button class="disc hdr-disc bar-more" id="tAdd" type="button" aria-label="Add" aria-haspopup="menu" hidden>'), "the + at the top: the …'s grey circle, named for VoiceOver, opening a menu");
  assert.ok(html.includes("\n  .seg.stages button { min-width: 0; }\n  .seg.stages button > span { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }"), "cut in a span: the key keeps its 44 pt halo (a clip on the key would cut it)");
  assert.ok(src.includes('const nm = document.createElement("span"); nm.textContent = x.name; b.appendChild(nm);'), "his slide's name in that span");
  assert.ok(src.includes('if (input) f.focus({ preventScroll: true }); else n.focus({ preventScroll: true });'), "the field takes the focus in the tap that opened the sheet, so the phone gives its keyboard");
});

// His ask, 12 Nov: "every time there is more than one workout in one folder I want to be able to add the whole folder / slide to the calendar
// ... I pick Monday then Monday through Friday will have all the workouts there". His picks: from both places (Use all while choosing a
// template for a client, Use for a client in a folder's "…"), every day in a row, one week at a time.
const W0 = (extra = {}) => ({ id: "w0", clientId: "c1", date: "2026-11-27", createdAt: "2026-11-10T10:00:00.000Z", title: "", completedAt: null, skippedAt: null, rows: [], ...extra });
const theirs = (cid, but) => [...maps.trainings.values()].filter((t) => t.clientId === cid && t.id !== but).sort((x, y) => x.date.localeCompare(y.date)).map((t) => [t.date, t.title, t.fromTemplate, t.rows.map((r) => r.name).join()]);
const pickDays = (day) => { const dp = fns.datePicker(), pick = dp.onPick; fns.closeDatePicker(); pick(day); };   // a day tapped: the days close, then the pick (as the picker's own click)

test("Use all, choosing a template for a client's empty workout: the slide's workouts in their order, Workout 1 into that workout, the rest a day each after it, from the day picked; then their page, where Back goes as before", async () => {
  setup(FOLDERS, TPLS, { name: "client", id: "c1" }); await tick();
  maps.trainings.get("t2").rows[0].name = "Deadlift"; maps.trainings.get("t4").rows[0].name = "Bench press";   // each template its own exercise
  const d0 = fns.navState().depth;
  maps.trainings.set("w0", W0({ inPerson: true }));                     // In person, set on it
  fns.go({ name: "training", id: "w0" }); await tick();
  fns.fromTemplate(maps.trainings.get("w0")); await tick();             // From template on it
  assert.deepStrictEqual([fns.choosing().pickFor, fns.choosing().fillFor, fns.choosing().pickHome, app.get().view], ["c1", "w0", d0, { name: "client", id: TPL, program: null, phase: null, stage: null }], "choosing for it, the client's own step noted");
  fns.go(fns.tplPage("B")); await tick();
  const kids = drawing((got) => { fns.render(); return got(); });
  assert.deepStrictEqual(read(kids), ["tabs [Week 1] Week 2", "bar 3 workouts · Use all", "tpl t1", "tpl t2", "tpl t4"], "how many, and Use all, above the slide's list (Workout 1, 2, 3: the one in the folder itself counts with the first slide)");
  const use = kids.find((e) => e.className === "listbar").kids[1];
  assert.deepStrictEqual([use.style.color, use.className], ["var(--brand-text)", "btn quiet use-all"], "the purple as text, as the pick note's Cancel above it (the v282 review: the fill purple reads 4.2:1 on the dark page)");
  app.set({ tab: "notes" });                                          // their page was last left on another tab
  use.on.click[0]();
  const dp = fns.datePicker();
  assert.deepStrictEqual(dp && [dp.title, dp.selected, dp.moving, dp.clientId], ["Add Week 1 to Jane", "2026-11-27", "w0", "c1"], "the client's calendar, on the workout's own day, its chip outlined: it moves to the first day picked");
  for (const k of ["trainings/w0"]) { maps.dirty.delete(k); clearTimeout(maps.timers.get(k)); maps.timers.delete(k); }   // nothing of it waiting before the pick
  pickDays("2026-11-30");
  assert.deepStrictEqual(theirs("c1"), [["2026-11-30", "Workout 1", "t1", "Back squat"], ["2026-12-01", "Workout 2", "t2", "Deadlift"], ["2026-12-02", "Workout 3", "t4", "Bench press"]], "Workout 1 on the day picked, the rest a day each after it, across the month's end, each with its own exercises");
  const w0 = maps.trainings.get("w0");
  assert.deepStrictEqual([w0 && w0.date, w0 && w0.title, w0 && w0.fromTemplate, w0 && w0.inPerson], ["2026-11-30", "Workout 1", "t1", true], "the empty workout is Workout 1, where it is: on the day picked, its In person kept");
  assert.ok((maps.trainerState.get("w0") || new Set()).has("date"), "its new day is his: it wins when the save meets a newer server copy");
  assert.deepStrictEqual([...maps.trainings.values()].filter((t) => t.clientId === "c1").sort((x, y) => x.date.localeCompare(y.date)).map((t) => !!t.inPerson), [true, false, false], "In person on it only (a new one gets the client's package's)");
  const made = [...maps.trainings.values()].filter((t) => t.clientId === "c1");
  assert.ok(made.length === 3 && made.every((t) => maps.dirty.has("trainings/" + t.id) && maps.timers.has("trainings/" + t.id)), "it and the two new ones, each queued for its save");
  const row = w0.rows[0], tr = maps.trainings.get("t1").rows[0];
  assert.ok(row !== tr && row.id !== tr.id && row.weights !== tr.weights, "the exercises copied, not shared with the template");
  assert.deepStrictEqual([app.get().view, app.get().tab], [{ name: "client", id: "c1" }, "workouts"], "then their page, on Workouts, where the calendar shows them");
  assert.deepStrictEqual(fns.choosing().pickFor, null, "no longer choosing");
  assert.strictEqual(fns.choosing().fillFor, null);
  await tick();
  assert.strictEqual(fns.navState().depth, d0, "their page on its own step: Back from it goes where it went before, not through the templates");
  assert.strictEqual(fns.choosing().pickHome, null);
  quiet();
});

test("From template on a workout opened from History: Use all lands on the client's own step, under History's", async () => {
  setup(FOLDERS, TPLS, { name: "client", id: "c1" });
  maps.trainings.set("w0", W0({ skippedAt: "2026-11-27T10:00:00.000Z" }));
  app.set({ view: { name: "training", id: "w0", from: "history" } }); await tick(); const d = fns.navState().depth;
  fns.fromTemplate(maps.trainings.get("w0")); await tick();
  assert.strictEqual(fns.choosing().pickHome, d - 2, "the workout's step, History's, then the client's");
  fns.go(fns.tplPage("B")); await tick();
  drawing((got) => { fns.render(); return got(); }).find((e) => e.className === "listbar").kids[1].on.click[0]();
  pickDays("2026-11-30"); await tick();
  assert.deepStrictEqual([app.get().view, fns.navState().depth, theirs("c1", "w0").length, maps.trainings.get("w0").skippedAt], [{ name: "client", id: "c1" }, Math.max(1, d - 2), 3, "2026-11-27T10:00:00.000Z"], "their page on that step; the week beside the skipped one, which stays as it was");
  setup(FOLDERS, TPLS, { name: "client", id: "c1" }); maps.trainings.set("w0", W0());
  app.set({ view: { name: "training", id: "w0" } }); const e = fns.navState().depth;
  fns.fromTemplate(maps.trainings.get("w0"));
  assert.strictEqual(fns.choosing().pickHome, e - 1, "opened from their page: the step under it");
  setup(FOLDERS, TPLS, { name: "client", id: "c1" }); maps.trainings.set("w0", W0({ skippedAt: "2026-11-27T10:00:00.000Z" }));
  fns.go({ name: "clients" }); await tick(); fns.go({ name: "training", id: "w0", from: "history" }); await tick();
  fns.fromTemplate(maps.trainings.get("w0")); await tick();
  assert.deepStrictEqual([fns.navState().depth, fns.choosing().pickHome], [2, -1], "a fresh tab opened on the workout from History: too short a history to hold History's step");
  fns.go(fns.tplPage("B")); await tick();
  drawing((got) => { fns.render(); return got(); }).find((e) => e.className === "listbar").kids[1].on.click[0]();
  pickDays("2026-12-07"); await tick();
  assert.deepStrictEqual([app.get().view, fns.navState().depth], [{ name: "client", id: "c1" }, 1], "their page on the first step, never before it");
  quiet();
});

test("Use all shows only while choosing, and only for two or more; a slide's name or the folder's names the days; a template or the client gone while the days are up", async () => {
  const two = [...TPLS, T("h2", MINE(2, "H")), T("h1", MINE(1, "H"))];   // (made out of their order: listed by their number)
  setup(FOLDERS, two, { name: "client", id: TPL, folder: "B" });
  assert.deepStrictEqual(drawing((got) => { fns.render(); return read(got()); }), ["tabs [Week 1] Week 2", "tpl t1", "tpl t2", "tpl t4"], "not while he is only looking");
  fns.setPickFor("c1"); fns.setFillFor(null);
  app.set({ view: { name: "client", id: TPL, folder: "B", slide: "S2" } });
  assert.deepStrictEqual(drawing((got) => { fns.render(); return read(got()); }), ["tabs Week 1 [Week 2]", "tpl t3"], "one workout: its Use is all there is");
  maps.trainings.set("a1", T("a1", MINE(1, "A"))); maps.trainings.set("a2", T("a2", MINE(2, "A"))); app.set({ view: { name: "client", id: TPL, folder: "A" } });
  const top = drawing((got) => { fns.render(); return got(); });
  assert.deepStrictEqual(read(top), ["# Folders", "> Phase 1 · 4 workouts", "bar 2 workouts · Use all", "tpl a1", "tpl a2"], "a folder with folders and templates of its own: the bar stands in for the Templates heading (two headings in a row read as one too many: the v282 review)");
  assert.strictEqual(top[2].style.marginTop, "24px", "where that heading stood");
  fns.setPickFor(null);
  assert.deepStrictEqual(drawing((got) => { fns.render(); return read(got()); }), ["# Folders", "> Phase 1 · 4 workouts", "# Templates", "tpl a1", "tpl a2"], "only looking: the heading as before");
  fns.setPickFor("c1");
  maps.trainings.delete("a1"); maps.trainings.delete("a2");
  app.set({ view: { name: "client", id: TPL, folder: "H" } });
  const kids = drawing((got) => { fns.render(); return got(); });
  assert.deepStrictEqual(read(kids), ["bar 2 workouts · Use all", "tpl h1", "tpl h2"], "a folder with no slides: its own, Workout 1 first");
  kids[0].kids[1].on.click[0]();
  assert.deepStrictEqual([fns.datePicker().title, fns.datePicker().moving, fns.datePicker().selected], ["Add Rehab to Jane", null, fns.today()], "named by the folder; no workout of theirs to fill, so none moves, and it opens on today");
  maps.trainings.delete("h1");
  pickDays("2026-10-31");
  assert.deepStrictEqual(theirs("c1"), [["2026-10-31", "Workout 2", "h2", "Back squat"]], "a template deleted on another device while the days were up: the rest, from the day picked");
  maps.trainings.set("w0", W0({ skippedAt: "2026-11-27T10:00:00.000Z" })); fns.setPickFor("c1"); fns.setFillFor("w0"); app.set({ view: { name: "client", id: TPL, folder: "B" } });
  drawing((got) => { fns.render(); return got(); }).find((e) => e.className === "listbar").kids[1].on.click[0]();
  assert.deepStrictEqual([fns.datePicker().moving, fns.datePicker().selected], [null, fns.today()], "From template on a skipped one (History): it stays as it is, so nothing outlined, and the days open on today");
  maps.clients.delete("c1");
  assert.strictEqual(fns.datePicker().ok(), false, "the client deleted meanwhile: the days close at the next redraw");
  pickDays("2026-11-30");
  assert.deepStrictEqual(theirs("c1", "w0").length, 1, "and nothing more is added");
  quiet();
});

test("Use all into an empty workout across the clock change, one finished or filled meanwhile, one with a name and In person of its own", () => {
  setup();
  const tp = ["t1", "t2", "t4"].map((id) => maps.trainings.get(id));
  maps.trainings.set("w0", W0({ title: "Legs day", date: "2026-10-31", inPerson: true }));
  fns.useWeek(tp, "c1", "2026-10-31", "w0");
  const w0 = maps.trainings.get("w0");
  assert.deepStrictEqual([w0.title, w0.date, w0.rows.length, w0.inPerson, w0.fromTemplate], ["Legs day", "2026-10-31", 1, true, "t1"], "Workout 1 where it is, its own name and In person kept");
  assert.ok((maps.trainerState.get("w0") || new Set()).has("date"), "its day claimed even when it was there already: a move made on another device meanwhile does not pull it out of the week (the v282 review)");
  assert.deepStrictEqual(theirs("c1").map((x) => x[0]), ["2026-10-31", "2026-11-01", "2026-11-02"], "a day each, over the night the clocks go back");
  assert.ok(theirs("c1", "w0").every((x) => x[1] !== "Legs day"), "its name on Workout 1 only");
  setup(); maps.trainings.set("w0", W0());
  fns.useWeek(["t1"].map((id) => maps.trainings.get(id)), "c1", "2026-11-30", "w0");
  assert.deepStrictEqual([maps.trainings.get("w0").title, "inPerson" in maps.trainings.get("w0"), theirs("c1", "w0").length], ["Workout 1", false, 0], "no name of its own: the template's; nothing added beside it");
  for (const [why, extra] of [["finished", { completedAt: "2026-11-27T10:00:00.000Z" }], ["skipped", { skippedAt: "2026-11-27T10:00:00.000Z" }], ["filled on another device", { rows: [{ id: "x", label: "1", name: "Deadlift", sets: 3, reps: "5" }] }], ["another client's", { clientId: "c2" }]]) {
    setup(); maps.trainings.set("w0", W0({ title: "Legs day", inPerson: true, ...extra })); const before = JSON.stringify(maps.trainings.get("w0"));
    fns.useWeek(["t1", "t2"].map((id) => maps.trainings.get(id)), "c1", "2026-11-30", "w0");
    assert.strictEqual(JSON.stringify(maps.trainings.get("w0")), before, why + ": left as it is");
    assert.strictEqual(fns.canFill(maps.trainings.get("w0"), "c1"), false, why + ": not one to fill");
    assert.deepStrictEqual(theirs("c1", "w0").map((x) => [x[0], x[1], x[2]]), [["2026-11-30", "Workout 1", "t1"], ["2026-12-01", "Workout 2", "t2"]], why + ": the whole week goes in beside it, by the templates' own names");
    assert.ok([...maps.trainings.values()].filter((t) => t.clientId === "c1" && t.id !== "w0").every((t) => !t.inPerson), why + ": its In person not borrowed");
  }
  quiet();
});

test("Use for a client, first in a folder's \"…\" when its page shows two templates or more: which client (the last one used first), the first day, then the week and their page; nothing from a page left meanwhile", async () => {
  setup(FOLDERS, TPLS, { name: "client", id: TPL, folder: "B" });
  maps.clients.set("c2", { id: "c2", name: "Bob", unit: "lb", sort: 9 }); maps.clients.get("c1").sort = 1;   // his Clients list: Jane, then Bob
  assert.deepStrictEqual(menu(), ["Use for a client", "Rename slide", "Rename folder", "Move folder", "red Delete slide", "red Delete folder"]);
  assert.strictEqual(fns.tplMoreItems()[0].icon, fns.menuIcons().calendar, "the calendar, as Reschedule's");
  app.set({ view: { name: "client", id: TPL, folder: "B", slide: "S2" } });
  assert.ok(!menu().includes("Use for a client"), "Week 2 has one workout: nothing to add at once");
  for (const view of [{ name: "client", id: TPL, folder: "A" }, { name: "client", id: TPL, folder: "H" }, { name: "client", id: TPL }]) { app.set({ view }); assert.ok(!menu().includes("Use for a client"), JSON.stringify(view)); }
  app.set({ view: { name: "client", id: TPL, folder: "B" } }); fns.setPickFor("c1");
  assert.deepStrictEqual(menu(), [], "choosing for a client: no \"…\", Use all instead");
  fns.setPickFor(null);
  let rows = [], onRow = null, onNo = null; const pl = $("pickList"), pn = $("pickNo"), cid = (id) => onRow({ target: { closest: () => ({ dataset: { id } }) } });
  pl.replaceChildren = (...k) => { rows = k; }; pl.addEventListener = (t, f) => { if (t === "click") onRow = f; }; pn.addEventListener = (t, f) => { if (t === "click") onNo = f; };
  const people = () => rows.map((li) => [li.kids[0].dataset.id, li.kids[0].firstChild.textContent, li.kids[0].lastChild.textContent]);
  try {
    $("pickSheet").hidden = true; app.set({ view: { name: "client", id: TPL, folder: "B", slide: "S2" } });
    await fns.useWeekFor("B");
    assert.strictEqual($("pickSheet").hidden, true, "a page with one workout left on it (a sync took the rest): nothing asked");
    app.set({ view: { name: "client", id: TPL, folder: "B" }, tab: "notes" });
    let p = drawing(() => fns.tplMoreItems()[0].onPick());
    assert.deepStrictEqual([$("pickSheet").hidden, $("pickTitle").textContent], [false, "Add Week 1 to"], "which client");
    await tick(400); cid("c2"); await p;
    assert.deepStrictEqual([fns.datePicker().title, fns.datePicker().selected, fns.datePicker().moving], ["Add Week 1 to Bob", fns.today(), null], "the first day, in Bob's calendar");
    pickDays("2026-11-30");
    assert.deepStrictEqual(theirs("c2"), [["2026-11-30", "Workout 1", "t1", "Back squat"], ["2026-12-01", "Workout 2", "t2", "Back squat"], ["2026-12-02", "Workout 3", "t4", "Back squat"]], "Week 1, a day each from the one picked");
    assert.deepStrictEqual([app.get().view, app.get().tab], [{ name: "client", id: "c2" }, "workouts"], "then Bob's page, on Workouts");
    app.set({ view: { name: "client", id: TPL, folder: "B" } }); fns.render();
    p = drawing(() => fns.tplMoreItems()[0].onPick());
    assert.deepStrictEqual(people(), [["c2", "Bob", "last used"], ["c1", "Jane", ""]], "the last one used first, then his list's order");
    await tick(400); app.set({ view: { name: "client", id: "c1" } }); cid("c1"); await p;
    assert.strictEqual(fns.datePicker(), null, "Back while the clients were up: no days, nothing added");
    assert.strictEqual(theirs("c1").length, 0);
    app.set({ view: { name: "client", id: TPL, folder: "B" } }); fns.render();
    p = drawing(() => fns.tplMoreItems()[0].onPick()); await tick(400); app.set({ view: { name: "client", id: TPL, folder: "A" } }); cid("c1"); await p;
    assert.strictEqual(fns.datePicker(), null, "Back up to its folder meanwhile: no days");
    app.set({ view: { name: "client", id: TPL, folder: "B" } }); fns.render();
    p = drawing(() => fns.tplMoreItems()[0].onPick()); await tick(400); maps.clients.get(TPL).folders = maps.clients.get(TPL).folders.filter((x) => x.id !== "B" && x.parent !== "B"); fns.render(); cid("c1"); await p;
    assert.strictEqual(fns.datePicker(), null, "the folder deleted on another device meanwhile: no days");
    setup(FOLDERS, TPLS, { name: "client", id: TPL, folder: "B" }); maps.clients.set("c2", { id: "c2", name: "Bob", unit: "lb", sort: 9 }); maps.clients.get("c1").sort = 1;
    p = drawing(() => fns.tplMoreItems()[0].onPick()); await tick(400); maps.clients.delete("c2"); cid("c2"); await p;
    assert.strictEqual(fns.datePicker(), null, "Bob deleted while the clients were up: no days");
    let focused = 0; const more = $("tMore"), sheetEl = $("pickSheet"); more.hidden = false; more.focus = () => { focused++; document.activeElement = more; }; sheetEl.contains = () => true;
    p = drawing(() => fns.tplMoreItems()[0].onPick()); await tick(400); cid("c1"); await p;
    delete more.focus; delete sheetEl.contains; const handed = fns.datePicker().back; fns.datePicker().back = null; document.activeElement = null;   // (the stand-in page cannot take the focus back)
    assert.deepStrictEqual([focused, handed === more], [1, true], "a keyboard's place back on the \u2026 once the sheet has gone, and the days hand it back there");
    maps.trainings.delete("t2"); pickDays("2026-11-30");
    assert.deepStrictEqual(theirs("c1").map((x) => [x[0], x[2]]), [["2026-11-30", "t1"], ["2026-12-01", "t4"]], "a template deleted while the days were up: the rest, a day each");
    app.set({ view: { name: "client", id: TPL, folder: "B", slide: "S2" } }); maps.trainings.set("t5", { ...maps.trainings.get("t5"), template: MINE(2, "S2") });
    assert.deepStrictEqual([menu()[0], fns.weekName(fns.tplNode("B"))], ["Use for a client", "Week 2"], "Week 2 with two: its own name");
    let again = 0; more.hidden = false; more.focus = () => { again++; }; sheetEl.contains = () => true; onNo = null;   // (the "\u2026" shown, as on the page)
    p = drawing(() => fns.tplMoreItems()[0].onPick()); await tick(400); onNo(); await p;
    delete more.focus; delete sheetEl.contains;
    assert.deepStrictEqual([again, fns.datePicker()], [1, null], "Cancel on the clients: the keyboard's place back on the \u2026 too, and no days");
    app.set({ view: { name: "client", id: TPL, folder: "B" } }); fns.render();
    p = drawing(() => fns.tplMoreItems()[0].onPick()); await tick(400); cid("c1"); await p;
    assert.strictEqual(fns.datePicker().ok(), true, "Jane's days");
    maps.clients.delete("c1"); const had = theirs("c1").length;
    assert.strictEqual(fns.datePicker().ok(), false, "Jane deleted on another device: her days close at the next redraw");
    pickDays("2026-11-30");
    assert.strictEqual(theirs("c1").length, had, "and nothing is added for her");
    maps.clients.delete("c2"); onNo = null;
    p = drawing(() => fns.tplMoreItems()[0].onPick());
    assert.deepStrictEqual(rows.map((li) => [li.className, li.textContent, li.kids.length]), [["empty", "Add a client first.", 0]], "no clients yet: a word, nothing to pick");
    onNo(); assert.strictEqual(await p, undefined, "Cancel");
    assert.strictEqual(fns.datePicker(), null);
  } finally { delete pl.replaceChildren; delete pl.addEventListener; delete pn.addEventListener; }
  quiet();
});

test("Use on one template while choosing for an empty workout still fills it where it is, on its own day, and lands back on its page's own step (From template keeps its steps)", async () => {
  setup(FOLDERS, TPLS, { name: "client", id: "c1" }); await tick();
  maps.trainings.set("w0", W0());
  fns.go({ name: "training", id: "w0" }); await tick(); const dw = fns.navState().depth;
  fns.fromTemplate(maps.trainings.get("w0")); await tick();
  fns.go(fns.tplPage("B")); await tick(); maps.trainings.get("t2").rows = [];   // (the stand-in page cannot draw a workout's exercises)
  const list = drawing((got) => { fns.render(); return got(); }).find((e) => e.className === "list");
  list.kids.find((li) => li.dataset.tid === "t2").kids[0].on.click[0](); await tick();
  const w0 = maps.trainings.get("w0");
  assert.deepStrictEqual([app.get().view, w0.title, w0.date, w0.fromTemplate, fns.navState().depth, fns.choosing().fillFor, theirs("c1", "w0").length], [{ name: "training", id: "w0" }, "Workout 2", "2026-11-27", "t2", dw, null, 0], "Workout 2 into it, on its own day, nothing else added; back on its own step");
  quiet();
});

test("Use all with every template of the page deleted while the days are up adds nothing and leaves the empty workout as it was", () => {
  setup(FOLDERS, TPLS, { name: "client", id: TPL, folder: "B" });
  maps.trainings.set("w0", W0()); fns.setPickFor("c1"); fns.setFillFor("w0");
  drawing((got) => { fns.render(); return got(); }).find((e) => e.className === "listbar").kids[1].on.click[0]();
  for (const id of ["t1", "t2", "t4"]) maps.trainings.delete(id);
  const before = JSON.stringify(maps.trainings.get("w0"));
  pickDays("2026-11-30");
  assert.deepStrictEqual([JSON.stringify(maps.trainings.get("w0")), theirs("c1", "w0").length, fns.choosing().pickFor], [before, 0, "c1"], "nothing to add: the workout as it was, still choosing");
  quiet();
});

// His picks, 12 Nov: "Swipe the row" (a template's or a folder's row slid left: Move to and Delete; a long press, or a right-click on the
// Mac, the same two in a menu), Move to "Purple, like Reschedule", "Everything is movable and editable" (the built-in programs too), and
// for where it goes, "Step by step" (My templates and his top folders, a folder opened to its weeks, as the Templates pages are browsed).
const rowsOf = (kids) => kids.filter((e) => e.className === "list").flatMap((ul) => ul.kids);
const swipeOf = (li) => (li.classList.contains("swipe-row") ? li.kids.find((k) => k.className === "swipe-acts").kids.map((a) => a.className.replace("swipe-act ", "") + ":" + /sa-lbl">([^<]*)/.exec(a.innerHTML)[1]) : null);
const ctxOf = (li) => li._ctx().map((it) => (it.danger ? "red " : "") + it.label);
function sheetOn() {                                                  // the pick sheet's rows, its step back and its Cancel, keeping what they are given (and, till off, elements that keep what is put in them, as drawing's)
  const S2 = { rows: [] }, pl = $("pickList"), pu = $("pickUp"), pn = $("pickNo"), make = document.createElement;
  document.createElement = (tag) => {
    const e = make(tag); e.kids = []; e.on = {}; let inner = "";
    e.appendChild = (c) => { e.kids.push(c); return c; }; e.append = (...k) => { e.kids.push(...k); }; e.addEventListener = (type, f) => { (e.on[type] ||= []).push(f); };
    Object.defineProperty(e, "innerHTML", { configurable: true, get: () => inner, set: (v) => { inner = String(v); e.firstChild = make("span"); e.lastChild = make("span"); } });
    return e;
  };
  pl.replaceChildren = (...k) => { S2.rows = k; }; pl.addEventListener = (t, f) => { if (t === "click") S2.onRow = f; }; pu.addEventListener = (t, f) => { if (t === "click") S2.onUp = f; }; pn.addEventListener = (t, f) => { if (t === "click") S2.onNo = f; };
  S2.list = () => S2.rows.map((li) => { const b = li.kids[0]; return (b.disabled ? "~" : "") + b.dataset.id + " " + b.firstChild.textContent + (b.lastChild.textContent ? " (" + b.lastChild.textContent + ")" : ""); });
  S2.tap = (id) => S2.onRow({ target: { closest: () => ({ dataset: { id } }) } });
  S2.off = () => { document.createElement = make; delete pl.replaceChildren; delete pl.addEventListener; delete pu.addEventListener; delete pn.addEventListener; };
  return S2;
}

test("the Templates pages' rows swipe to Delete (red) and, outermost, Move to (purple, the full swipe's: his ask, \"move to sits on the right of delete\"), and hold the same two for a long press and a right-click; a folder with nowhere to go has Delete alone; none while choosing for a client or putting folders in order", () => {
  setup(FOLDERS, TPLS, { name: "client", id: TPL });
  let kids = drawing((got) => { fns.render(); return got(); });
  const byKey = (k) => rowsOf(kids).find((li) => li.dataset.tid === k || li.dataset.fid === k);
  assert.deepStrictEqual(swipeOf(byKey("t5")), ["sa-del:Delete", "sa-move:Move to"], "a template of My templates: Delete, then Move to outermost (his ask, 12 Nov: \"move to sits on the right of delete\")");
  assert.deepStrictEqual([ctxOf(byKey("t5")), byKey("t5")._ctx().map((it) => it.icon), typeof byKey("t5")._full, byKey("t5")._ctx.ok()], [["Move to", "red Delete"], [fns.menuIcons().folder, fns.menuIcons().trash], "function", true], "its long press and right-click: the same two, Delete last and red; the full swipe moves it");
  assert.deepStrictEqual([swipeOf(byKey("H")), swipeOf(byKey("A"))], [["sa-del:Delete", "sa-move:Move to"], ["sa-del:Delete"]], "his folders: Rehab can go into Summer block; Summer block has a folder inside, so it stays at the top: Delete alone");
  assert.deepStrictEqual(ctxOf(byKey("A")), ["red Delete"]);
  assert.strictEqual(rowsOf(kids).find((li) => !li.dataset.tid && !li.dataset.fid).classList.contains("swipe-row"), false, "a built-in program not yet a folder: no swipe");
  app.set({ view: { name: "client", id: TPL, folder: "A" } });
  kids = drawing((got) => { fns.render(); return got(); });
  assert.deepStrictEqual(swipeOf(byKey("B")), ["sa-del:Delete", "sa-move:Move to"], "a folder inside a folder: to the top, or into another top folder");
  app.set({ view: { name: "client", id: TPL, folder: "B" } });
  kids = drawing((got) => { fns.render(); return got(); });
  assert.deepStrictEqual(["t1", "t2", "t4"].map((k) => swipeOf(byKey(k)).length), [2, 2, 2], "every template on a week");
  const acts = byKey("t1").kids.find((k) => k.className === "swipe-acts").kids;
  assert.deepStrictEqual([acts[0].innerHTML.includes('viewBox="-7.3 -3.3 62.6 62.6"'), acts[1].innerHTML.includes('d="M1.6 4.1C1.6 3.3 2.2 2.7 3 2.7H6.05')], [true, true], "Delete's capsule the trash, Move to's the folder");
  const gone = byKey("t1"); maps.trainings.delete("t1");
  assert.strictEqual(gone._ctx.ok(), false, "its template deleted on another device: no menu for it");
  fns.setPickFor("c1");
  kids = drawing((got) => { fns.render(); return got(); });
  assert.ok(rowsOf(kids).every((li) => !li.classList.contains("swipe-row")), "choosing a template for a client: its Use, no swipe");
  app.set({ view: { name: "client", id: TPL } });
  kids = drawing((got) => { fns.render(); return got(); });
  assert.ok(rowsOf(kids).length > 1 && rowsOf(kids).every((li) => !li.classList.contains("swipe-row")), "nor his folders' rows then");
  fns.setPickFor(null); app.set({ view: { name: "client", id: TPL } }); fns.tplMoreItems()[0].onPick();
  kids = drawing((got) => { fns.render(); return got(); });
  assert.ok(rowsOf(kids).length && rowsOf(kids).every((li) => !li.classList.contains("swipe-row")), "Reorder: grips, no swipe");
  fns.doneTplOrder();
  app.set({ view: { name: "client", id: TPL, program: "Fat Burn", phase: 1, stage: 1 } });
  kids = drawing((got) => { fns.render(); return got(); });
  assert.ok(rowsOf(kids).every((li) => !li.classList.contains("swipe-row")), "a program's old page (not yet a folder): as it was");
  setup(FOLDERS, BTPLS, { name: "client", id: TPL }); fns.adoptBuiltins();
  kids = drawing((got) => { fns.render(); return got(); });
  assert.deepStrictEqual(swipeOf(byKey("b:Fat Burn")), ["sa-del:Delete"], "a built-in program, now a folder of his: its phases inside keep it at the top");
  const fb = byKey("b:Fat Burn"); maps.clients.get(TPL).folders = maps.clients.get(TPL).folders.filter((x) => x.id !== "b:Fat Burn");
  assert.strictEqual(fb._ctx.ok(), false, "a folder deleted on another device: no menu for it");
  setup(FOLDERS, BTPLS, { name: "client", id: TPL }); fns.adoptBuiltins();
  app.set({ view: { name: "client", id: TPL, folder: "b:Fat Burn" } });
  kids = drawing((got) => { fns.render(); return got(); });
  assert.deepStrictEqual(swipeOf(byKey("b:Fat Burn/1")), ["sa-del:Delete", "sa-move:Move to"], "its phase can go elsewhere, as his own (\"Everything is movable\")");
  quiet();
});

test("Move to, step by step: My templates and his top folders; a folder opens to its weeks (and to its own templates when it has none), a step back over the title; where it is now shown, not picked; it lands numbered next there", async () => {
  setup(FOLDERS, TPLS, { name: "client", id: TPL, folder: "B" });
  const sh = sheetOn();
  try {
    let p = fns.moveTemplate("t1");
    assert.deepStrictEqual([$("pickTitle").textContent, $("pickUp").hidden, sh.list()], ["Move “Workout 1” to", true, ["to: My templates", "to:H Rehab", "in:A Summer block"]], "the top: My templates, his folders in his order (Rehab has neither weeks nor folders: it takes it as it is)");
    await tick(400); sh.tap("in:A"); await tick(0);
    assert.deepStrictEqual([$("pickTitle").textContent, $("pickUp").hidden, $("pickUp").textContent, sh.list()], ["Summer block", false, "‹ Templates", ["to:A Summer block (This folder)", "in:B Phase 1"]], "a folder with folders and no weeks: its own templates' place, and its folders");
    await tick(400); sh.tap("in:B"); await tick(0);
    assert.deepStrictEqual([$("pickTitle").textContent, $("pickUp").textContent, sh.list()], ["Phase 1", "‹ Summer block", ["~to:S1 Week 1 (Current)", "to:S2 Week 2"]], "its weeks; the one it is on now greyed");
    await tick(400); sh.onUp(); await tick(0);
    assert.strictEqual($("pickTitle").textContent, "Summer block", "a step back");
    await tick(400); sh.tap("in:B"); await tick(400); sh.tap("to:S2");
    assert.strictEqual(await p, true);
    assert.deepStrictEqual([meta("t1"), maps.dirty.has("trainings/t1")], [["My templates", 2, "S2"], true], "on Week 2, numbered after its Workout 1, saved");
    p = fns.moveTemplate("t1"); await tick(400); sh.onNo(); assert.strictEqual(await p, false, "Cancel moves nothing");
    assert.deepStrictEqual(meta("t1"), ["My templates", 2, "S2"]);
    p = fns.moveTemplate("t1"); await tick(400); sh.tap("to:");
    assert.deepStrictEqual([await p, meta("t1")], [true, ["My templates", 2, null]], "to My templates: loose, after Workout 1 there");
    p = fns.moveTemplate("t1");
    assert.ok(sh.list()[0].startsWith("~to: My templates (Current)"), "where it is now, at the top too");
    await tick(400); sh.onNo(); await p;
    p = fns.moveTemplate("b1"); await tick(400);
    assert.ok(!sh.list().some((r) => r.startsWith("~")), "a built-in one not yet in a folder: nowhere is its place yet");
    sh.tap("to:H");
    assert.deepStrictEqual([await p, meta("b1")], [true, ["Fat Burn", 1, "H"]], "into his folder, Workout 1 there");
    p = fns.moveTemplate("t2"); await tick(400); sh.tap("in:A"); await tick(400); sh.tap("in:B");
    maps.clients.get(TPL).folders = maps.clients.get(TPL).folders.filter((x) => x.id !== "S2"); await tick(400);
    sh.tap("to:S2"); assert.deepStrictEqual([await p, meta("t2")[2]], [false, "S1"], "the week deleted on another device while the sheet was up: it stays where it was");
    p = fns.moveTemplate("t2"); await tick(400); maps.trainings.delete("t2"); sh.tap("to:H");
    assert.deepStrictEqual([await p, maps.trainings.has("t2")], [false, false], "itself deleted meanwhile: nothing made again");
    p = fns.moveTemplate("t4"); const other = fns.sheetList({ title: "Something else", rows: [] });
    assert.deepStrictEqual([await p, meta("t4")[2]], [false, "B"], "another sheet put over it: Move to stops, nothing moved");
    await tick(400); sh.onNo(); await other;
    app.set({ view: { name: "training", id: "t4" } }); const item = fns.moreItems(maps.trainings.get("t4")).find((it) => it.label === "Move to");
    app.set({ view: { name: "client", id: TPL, folder: "B" } }); $("pickSheet").hidden = true; item.onPick();
    assert.strictEqual($("pickSheet").hidden, true, "a template page's Move to, picked from a menu its page has left: nothing asked");
  } finally { sh.off(); }
  quiet();
});

test("Move to on a folder's row: the top or another top folder, never deeper than two; the move is this device's, merged field by field; a folder deleted meanwhile is not gone into", async () => {
  setup([...FOLDERS.slice(0, 2), { ...FOLDERS[2], sort: 3 }, ...FOLDERS.slice(3)], TPLS, { name: "client", id: TPL });
  const sh = sheetOn(), place = (id) => fns.tplNode(id).parent;
  try {
    assert.deepStrictEqual([fns.folderPlaces(fns.tplNode("H")), fns.folderPlaces(fns.tplNode("A")), fns.folderPlaces(fns.tplNode("B"))], [[{ id: "A", name: "Summer block" }], [], [{ id: "", name: "Templates" }, { id: "H", name: "Rehab" }]], "Rehab into Summer block; Summer block (a folder inside) stays at the top; Phase 1 to the top or into Rehab");
    assert.strictEqual(await fns.moveFolder("A"), false, "nowhere to go: nothing asked");
    let p = fns.moveFolder("B");
    assert.deepStrictEqual([$("pickTitle").textContent, $("pickUp").hidden, sh.list()], ["Move “Phase 1” to", true, ["to: Templates (Top level)", "to:H Rehab"]]);
    await tick(400); sh.tap("to:H");
    assert.deepStrictEqual([await p, place("B"), "sort" in maps.clients.get(TPL).folders.find((x) => x.id === "B"), maps.folderTouched.has("B"), maps.dirty.has("clients/" + TPL)], [true, "H", false, true, true], "into Rehab, after the folders he put in order there; this device's change, saved");
    assert.deepStrictEqual([fns.tplKids("H", "slide").length, fns.tplIn(new Set(["S1"])).map((t) => t.id).sort()], [0, ["t1", "t2"]], "its weeks and their templates go with it");
    p = fns.moveFolder("B"); await tick(400); sh.tap("to:");
    assert.deepStrictEqual([await p, place("B")], [true, null], "back to the top");
    p = fns.moveFolder("H"); await tick(400); maps.clients.get(TPL).folders = maps.clients.get(TPL).folders.filter((x) => x.id !== "A"); sh.tap("to:A");
    assert.deepStrictEqual([await p, place("H")], [false, null], "Summer block deleted on another device while the sheet was up: Rehab stays at the top");
  } finally { sh.off(); }
  quiet();
});

test("Delete on a template's row asks first, by its name (Workouts already made from it stay), and takes it off the page it is on; Cancel keeps it; the swipe's own buttons do the same", async () => {
  setup(FOLDERS, TPLS, { name: "client", id: TPL, folder: "B" });
  const a = asking();
  try {
    let p = fns.deleteTemplateRow("t2");
    assert.deepStrictEqual(sheet(), { up: true, title: "Delete “Workout 2”?", text: "Workouts already made from it stay.", field: null, yes: "Delete", red: true });
    a.no(); assert.deepStrictEqual([await p, maps.trainings.has("t2")], [false, true], "Cancel: kept");
    p = fns.deleteTemplateRow("t4"); const was = maps.trainings.get("t4"); maps.trainings.delete("t4"); maps.dirty.delete("trainings/t4");
    await tick(400); a.yes();
    assert.deepStrictEqual([await p, maps.dirty.has("trainings/t4")], [false, false], "deleted on another device while the question was up: nothing more to do");
    maps.trainings.set("t4", was);
    const li = rowsOf(drawing((got) => { fns.render(); return got(); })).find((x) => x.dataset.tid === "t2");
    $("askTitle").textContent = ""; li.kids.find((k) => k.className === "swipe-acts").kids[0].on.click[0]({ stopPropagation() {} });
    assert.strictEqual(sheet().title, "Delete “Workout 2”?", "the red Delete behind the row asks the same");
    await tick(400); a.yes(); await tick(0);   // (its red button waits 350 ms: the second tap of a double tap never lands on it)
    assert.deepStrictEqual([maps.trainings.has("t2"), maps.dirty.has("trainings/t2"), app.get().view], [false, true, { name: "client", id: TPL, folder: "B" }], "gone, saved, the page as it was");
    const sh = sheetOn();
    try {
      const l1 = rowsOf(drawing((got) => { fns.render(); return got(); })).find((x) => x.dataset.tid === "t1");
      const q = l1.kids.find((k) => k.className === "swipe-acts").kids[1].on.click[0]({ stopPropagation() {} });
      assert.strictEqual($("pickTitle").textContent, "Move “Workout 1” to", "the purple Move to behind the row opens the places");
      await tick(400); sh.onNo(); await q;
      $("pickTitle").textContent = ""; const f = l1._full();
      assert.strictEqual($("pickTitle").textContent, "Move \u201cWorkout 1\u201d to", "the full swipe: Move to, the outermost");
      await tick(400); sh.onNo(); await f;
    } finally { sh.off(); }
    app.set({ view: { name: "client", id: TPL } });
    const top = rowsOf(drawing((got) => { fns.render(); return got(); })).find((x) => x.dataset.fid === "A");
    $("askTitle").textContent = ""; const d = top._full();
    assert.strictEqual(sheet().title, "Delete \u201cSummer block\u201d?", "a folder with nowhere to go: its full swipe is Delete, asked first");
    a.no(); await d; assert.ok(fns.tplNode("A"), "Cancel: kept");
  } finally { a.done(); }
  quiet();
});

test("Move to everywhere it is offered, and what each leaves behind: a template's page (not while it has unsaved changes, which Discard would take the move back with), a folder's own “…”, a folder row's swipe and menu; the page drawn again; a keyboard's place back on the “…”; Delete forgets the template's draft; the light that finds a template shows on a swipe row", async () => {
  setup(FOLDERS, TPLS, { name: "client", id: TPL, folder: "B" });
  const sh = sheetOn(), a = asking();
  try {
    app.set({ view: { name: "training", id: "t1" } });
    const mv = () => fns.moreItems(maps.trainings.get("t1")).find((it) => it.label === "Move to");
    $("pickTitle").textContent = ""; mv().onPick();
    assert.strictEqual($("pickTitle").textContent, "Move “Workout 1” to", "a template's own page: its “…” has Move to");
    await tick(400); sh.onNo(); await tick(0);
    app.set({ templateDraft: { id: "t1", snapshot: "{}", dirty: true, saving: false } });
    assert.strictEqual(mv(), undefined, "with unsaved changes: none until they are saved or discarded");
    $("pickSheet").hidden = true; assert.deepStrictEqual([await fns.moveTemplate("t1"), $("pickSheet").hidden], [false, true], "and a Move to begun before cannot slip into them");
    app.set({ templateDraft: null, view: { name: "client", id: TPL, folder: "B" } });
    assert.ok(fns.tplMoreItems().some((it) => it.label === "Move folder"), "a folder's own “…”: Move folder, as its row's Move to");
    app.set({ view: { name: "client", id: TPL, folder: "A" } }); assert.ok(!fns.tplMoreItems().some((it) => it.label === "Move folder"), "not for one with folders inside");
    app.set({ view: { name: "client", id: TPL } });
    const rows = rowsOf(drawing((got) => { fns.render(); return got(); })), h = rows.find((x) => x.dataset.fid === "H");
    $("pickTitle").textContent = ""; h.kids.find((k) => k.className === "swipe-acts").kids[1].on.click[0]({ stopPropagation() {} });
    assert.strictEqual($("pickTitle").textContent, "Move “Rehab” to", "a folder row's Move to, behind the row");
    await tick(400); sh.onNo(); await tick(0);
    $("pickTitle").textContent = ""; h._ctx().find((it) => it.label === "Move to").onPick();
    assert.strictEqual($("pickTitle").textContent, "Move “Rehab” to", "and in its menu");
    await tick(400); sh.onNo(); await tick(0);
    $("askTitle").textContent = ""; const d = h._ctx().find((it) => it.label === "Delete").onPick();
    assert.strictEqual(sheet().title, "Delete “Rehab”?", "its menu's Delete asks its own question");
    a.no(); await d;
    let drawn = 0; const wrap = $("tplList"); wrap.replaceChildren = () => { drawn++; };
    let focused = 0; const more = $("tMore"), sheetEl = $("pickSheet"); more.hidden = false; more.focus = () => { focused++; }; sheetEl.contains = () => true;
    try {
      const p = fns.moveTemplate("t5"); await tick(400); sh.tap("to:H"); await p;
      assert.deepStrictEqual([drawn > 0, meta("t5")[2], focused], [true, "H", 1], "moved: the page drawn again at once, the keyboard's place back on the “…”");
      const q = fns.moveTemplate("t5"); await tick(400); sh.onNo(); await q;
      assert.strictEqual(focused, 2, "Cancel: the same");
    } finally { delete wrap.replaceChildren; delete more.focus; delete sheetEl.contains; }
    app.set({ templateDraft: { id: "t3", snapshot: "{}", dirty: false, saving: false } });
    const r = fns.deleteTemplateRow("t3"); await tick(400); a.yes(); await r;
    assert.deepStrictEqual([maps.trainings.has("t3"), app.get().templateDraft], [false, null], "Delete forgets the draft kept for it");
  } finally { sh.off(); a.done(); }
  assert.ok(html.includes("\n  .list li.swipe-row.flash > :not(.swipe-acts) { animation: flash-row 1200ms ease; }") && html.includes("@keyframes flash-row { 0% { box-shadow: inset 0 0 0 100vmax rgba(111,107,153,0.28); } 100% { box-shadow: inset 0 0 0 100vmax rgba(111,107,153,0); } }"), "the light that finds a template (Back to its template) laid over a swipe row's solid part");
  quiet();
});

test("Move to on a stale copy of a template keeps the exercises another device gave it meanwhile, as any field it did not change (the v283 review); its own exercise edits still stand", async () => {
  const sb = makeSupabase(); coach(sb);
  maps.clients.set(TPL, { id: TPL, name: "Templates", kind: "templates", folders: JSON.parse(JSON.stringify(FOLDERS)) });
  const old = T("t1", MINE(1, "S1")), there = { ...old, rows: [{ id: "x1", label: "1", name: "Front squat", sets: 5, reps: "5", rest: "", tempo: "", note: "", alts: [] }] };
  sb.seed("ft_trainings", "t1", there, { client_id: TPL });
  maps.seenAt.set("trainings/t1", "S0"); maps.seenDoc.set("trainings/t1", JSON.stringify(old));   // what this device last read: before the other device's edit
  maps.trainings.set("t1", JSON.parse(JSON.stringify(old)));
  fns.placeTemplate(maps.trainings.get("t1"), "H");
  await fns.cloudBackend.set("trainings", "t1", JSON.parse(JSON.stringify(maps.trainings.get("t1"))));
  const saved = sb.tables.ft_trainings.get("t1").data;
  assert.deepStrictEqual([saved.rows.map((r) => r.name), saved.template.folder], [["Front squat"], "H"], "the other device's exercises, and the move made here");
  const mine = { ...old, rows: [{ ...old.rows[0], name: "Box squat" }] };
  sb.seed("ft_trainings", "t1", there, { client_id: TPL }); maps.seenAt.set("trainings/t1", "S0"); maps.seenDoc.set("trainings/t1", JSON.stringify(old));
  maps.trainings.set("t1", JSON.parse(JSON.stringify(mine)));
  await fns.cloudBackend.set("trainings", "t1", JSON.parse(JSON.stringify(mine)));
  assert.deepStrictEqual(sb.tables.ft_trainings.get("t1").data.rows.map((r) => r.name), ["Box squat"], "an exercise edit made here still stands");
  quiet();
});
