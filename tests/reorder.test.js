// Reorder (v314). His ask, 17 Nov 2026: "in 3 dot button bellow reschedule we will have reorder ... folded cards for all exercises like in
// the pictures attached except not green .. gray or purple ... touch and hold to move exercises in the card/ superset but I also want to be
// able to move the whole superset tri set etc by touch and hold ... also swiping on exercise delete option"; "I also meant the 3 dots button
// in the top right corner". His picks after the pictures: grey cards, the one held in purple; an exercise moves only inside its own card,
// a whole card among the cards; workouts and templates. The hold, the drag and the swipe play in reorder-probe.mjs (its own process).
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { test, assert, tick } from "./assert.js";
import { load } from "./load.js";
import { byId, el } from "./env.js";
import { TEMPLATES_ID } from "../app/model.js";
const app = await load();
const { fns, maps } = app;
const $ = (id) => document.getElementById(id);
const here = path.dirname(fileURLToPath(import.meta.url));
const html = fs.readFileSync(path.join(here, "../index.html"), "utf8"), src = fs.readFileSync(path.join(here, "../app/main.js"), "utf8");
const day = (n) => { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + n); return fns.localIso(d); };   // the app's local day (never UTC)
const R = (id, label, name, sets = 4) => ({ id, label, name, sets, reps: "8", rest: "60 sec", tempo: "", weights: [], repsDone: [], setsDone: 0, done: false, note: "", alts: [] });
const LEGS = () => [R("d", "1", "Deadlift"), R("l", "2a", "Knee over toe lunge"), R("r", "2b", "Barbell Romanian deadlift"), R("g", "3", "Banded glute kickback"), R("s", "4", "Squat"),
  R("x", "5a", "Leg extension", 3), R("y", "5b", "Lying leg curl", 3), R("z", "5c", "Standing calf raise", 3)];
const quiet = () => { for (const t of maps.timers.values()) clearTimeout(t); maps.timers.clear(); fns.setPreview(false); };   // no save left to run into a later test
const page = (id, rows, extra = {}, opts = {}) => {             // (the cards of a workout's own look are drawn only in reorder-probe.mjs: env.js's stand-ins keep no children)
  if (fns.roOrdering()) { const t = maps.trainings.get(fns.roOrdering()); if (t) t.rows = []; fns.doneOrder(); }
  quiet(); app.reset(); fns.setPreview(!!opts.preview);
  app.set({ signedIn: true, clientMode: !!opts.client, myClientId: opts.client ? "c1" : null, tab: "workouts", templateDraft: null });
  maps.clients.set("c1", { id: "c1", name: "Jane", unit: "lb", phone: "3105550142" }); maps.clients.set(TEMPLATES_ID, { id: TEMPLATES_ID, name: "Templates" });   // (a made-up 555 number: the bar's Messages shows)
  maps.trainings.set("w1", { id: "w1", clientId: "c1", title: "Legs", date: day(1), createdAt: "2026-11-01T10:00:00.000Z", completedAt: null, skippedAt: null, rows: rows || LEGS(), ...extra });
  maps.trainings.set("tp", { id: "tp", clientId: TEMPLATES_ID, title: "Legs A", date: "2026-01-01", createdAt: "2026-11-01T10:00:00.000Z", completedAt: null, skippedAt: null, template: { program: "My templates", phase: 0, stage: 0, n: 1 }, rows: LEGS() });
  app.set({ view: { name: "training", id }, renderedTraining: null });
};
const menu = (id) => fns.moreItems(maps.trainings.get(id)).map((it) => (it.danger ? "red " : "") + it.label);
const on = () => fns.exOrderOn();
const T = (id = "w1") => maps.trainings.get(id);
const claimed = (id = "w1") => !!(maps.trainerState.get(id) && maps.trainerState.get(id).has("order"));

test("the coach's \"…\": Reorder under Reschedule, on a workout still to do with two cards or a superset not begun; none on a finished or skipped one; a template's before Move to; his Client view's too (his ask); never the client's app", () => {
  try {
    page("w1"); assert.deepStrictEqual(menu("w1"), ["Reschedule", "Reorder", "Copy workout", "Save as template", "red Delete workout"], "his ask: \"bellow reschedule\"");
    assert.strictEqual(fns.moreItems(T()).find((it) => it.label === "Reorder").icon, fns.menuIcons().reorder, "the arrows up and down, as Reorder folders");
    page("w1", null, { completedAt: "2026-11-02T18:00:00.000Z" }); assert.deepStrictEqual(menu("w1"), ["Copy workout", "Save as template", "red Delete workout"], "finished: nothing left to put in order");
    page("w1", null, { skippedAt: "2026-11-02T18:00:00.000Z" }); assert.deepStrictEqual(menu("w1"), ["Copy workout", "Save as template", "red Delete workout"], "skipped: the same");
    page("tp"); assert.deepStrictEqual(menu("tp"), ["Reorder", "Move to", "red Delete template"], "a template's too (his pick)");
    page("w1", [R("d", "1", "Deadlift")]); assert.ok(!menu("w1").includes("Reorder"), "one exercise: nothing to put in order");
    page("w1", [R("d", "1a", "Deadlift"), R("e", "1b", "Bench press")]); assert.ok(menu("w1").includes("Reorder"), "one superset: its exercises move inside it");
    page("w1", null, {}, { preview: true }); assert.deepStrictEqual(menu("w1"), ["Reschedule", "Reorder", "Weights in lb", "Weights in kg"], "his Client view (his ask: \"from both clients and coaches view\"): after its Reschedule, before Weights in");
    page("w1", null, {}, { client: true }); assert.ok(!menu("w1").includes("Reorder"), "the client's app: never");
  } finally { quiet(); }
});

test("Reorder on: the cards fold, the title stays as it is with the hint under it, Done in place of the \"…\", no Messages, no bar at the foot; Done, Back or another page end it", () => {
  try {
    page("w1"); fns.paintBarMsg(); assert.deepStrictEqual([$("barMsg").hidden, fns.barFor("training/w1").barMsg], [false, true], "(Messages shows on the workout before Reorder)");
    fns.moreItems(T()).find((it) => it.label === "Reorder").onPick();
    assert.deepStrictEqual([on(), $("tMore").hidden, $("navDone").hidden, $("roHint").hidden, $("tTitle").readOnly], [true, true, false, false, true], "Done alone at the top right, as Fitness's Reorder");
    assert.ok(document.body.classList.contains("ro-on") && $("vTraining").classList.contains("ro"), "the page's own look (the bar at the foot hidden, the pills and buttons under the cards gone)");
    assert.deepStrictEqual([$("barMsg").hidden], [true], "no Messages meanwhile");
    const bar = fns.barFor("training/w1"); assert.deepStrictEqual([bar.navDone, bar.tMore, bar.barMsg], [true, false, false], "the swipe back's bar agrees");
    fns.setPreview(true); fns.render();
    assert.deepStrictEqual([on(), $("tMore").hidden, $("navDone").hidden], [true, true, false], "his Client view keeps it (Done, Back and another page: reorder-probe.mjs)");
    page("w1", null, {}, { preview: true }); fns.moreItems(T()).find((it) => it.label === "Reorder").onPick();
    assert.deepStrictEqual([on(), app.get().view.name], [true, "training"], "opened from his Client view's \"…\"");
    app.set({ clientMode: true }); assert.strictEqual(on(), false, "never in the client's app");
  } finally { quiet(); }
});

test("a card moves among the cards: the numbers follow the places (1, 2, 3, letters inside a superset), each card's own state goes with it, his whole numbering is claimed and saved", () => {
  try {
    page("w1"); fns.startOrder("w1");
    fns.cardSets().setSel.set("w1/2", 3);                                 // the set he was looking at in the superset
    assert.strictEqual(fns.roCards(T(), "l", 3), true);
    assert.deepStrictEqual(T().rows.map((r) => r.label + " " + r.id), ["1 d", "2 g", "3 s", "4a l", "4b r", "5a x", "5b y", "5c z"], "the superset after Squat: 4a and 4b, the two it passed up one");
    assert.deepStrictEqual([fns.cardSets().setSel.get("w1/4"), fns.cardSets().setSel.has("w1/2")], [3, false], "its set looked at went with it");
    assert.ok(maps.dirty.has("trainings/w1") && claimed(), "saved, and the order is his on a merge (sync.js)");
    assert.strictEqual(on(), true, "still in Reorder");
    page("w1"); fns.startOrder("w1");
    assert.strictEqual(fns.roCards(T(), "s", 3), false, "let go in its own place: nothing written");
    assert.ok(!maps.dirty.has("trainings/w1") && !claimed());
    assert.strictEqual(fns.roCards(T(), "x", 0), true); assert.deepStrictEqual(T().rows.map((r) => r.label + " " + r.id), ["1a x", "1b y", "1c z", "2 d", "3a l", "3b r", "4 g", "5 s"], "the tri-set first");
    assert.strictEqual(fns.roCards(T(), "x", 99), true); assert.deepStrictEqual(T().rows.map((r) => r.label + " " + r.id), ["1 d", "2a l", "2b r", "3 g", "4 s", "5a x", "5b y", "5c z"], "past the end: last");
  } finally { quiet(); }
});

test("an exercise moves inside its own card: the letters follow the places, the card keeps its number", () => {
  try {
    page("w1"); fns.startOrder("w1");
    assert.strictEqual(fns.roRows(T(), "z", 0), true);
    assert.deepStrictEqual(T().rows.map((r) => r.label + " " + r.id), ["1 d", "2a l", "2b r", "3 g", "4 s", "5a z", "5b x", "5c y"]);
    assert.ok(claimed());
    assert.strictEqual(fns.roRows(T(), "d", 1), false, "an exercise on its own moves as its card");
    assert.strictEqual(fns.roRows(T(), "l", 1), true); assert.deepStrictEqual(T().rows.slice(1, 3).map((r) => r.label + " " + r.id), ["2a r", "2b l"]);
  } finally { quiet(); }
});

test("inside a superset the rests keep their places (the transition between, the round's rest after the last) and the card's note stays on the exercise it was written on (the v314 reviews)", () => {
  try {
    const rows = LEGS(); Object.assign(rows[1], { rest: "10 sec", clientNote: "Left knee felt fine", clientNoteBy: "client", clientNoteAt: "2026-11-16T10:00:00.000Z" }); Object.assign(rows[2], { rest: "90 sec" });
    page("w1", rows); fns.startOrder("w1");
    assert.strictEqual(fns.roRows(T(), "l", 1), true);
    const [a, b] = T().rows.slice(1, 3);
    assert.deepStrictEqual([a.id + " " + a.label + " " + a.rest, b.id + " " + b.label + " " + b.rest], ["r 2a 10 sec", "l 2b 90 sec"], "the lunge after the deadlift: 10 seconds' transition, then the round's 90");
    assert.deepStrictEqual([a.clientNote, b.clientNote, b.clientNoteBy], [undefined, "Left knee felt fine", "client"], "the note stays on the lunge, where she wrote it: its id and its seen state stay (the final check: moved, it came back as unread under the other exercise)");
    assert.ok(src.includes("const first = g.rows.find((r) => r.clientNote) || g.rows[0], noteKey = selKey;"), "the card shows whichever of its exercises holds the note");
    assert.strictEqual(fns.roRows(T(), "r", 0), false, "already first: nothing written");
  } finally { quiet(); }
});

test("each place keeps its own number: with a gap (1, 2, 4, 5) a move never renumbers a begun card (the v314 final check)", () => {
  try {
    const rows = [R("d", "1", "Deadlift"), R("l", "2a", "Knee over toe lunge"), R("r", "2b", "Barbell Romanian deadlift"), R("s", "4", "Squat"), R("x", "5a", "Leg extension", 3), R("y", "5b", "Lying leg curl", 3)];
    Object.assign(rows[3], { setsDone: 1, weights: ["155"], repsDone: ["8"] });   // Squat begun
    page("w1", rows); fns.startOrder("w1");
    assert.strictEqual(fns.roRows(T(), "y", 0), true);
    assert.deepStrictEqual(T().rows.map((r) => r.label + " " + r.id), ["1 d", "2a l", "2b r", "4 s", "5a y", "5b x"], "a move inside a card changes its letters alone");
    assert.strictEqual(fns.roCards(T(), "y", 0), true);
    assert.deepStrictEqual(T().rows.map((r) => r.label + " " + r.id), ["1a y", "1b x", "2 d", "4 s", "5a l", "5b r"], "the cards trade places and numbers; the begun Squat keeps 4");
  } finally { quiet(); }
});

test("a warm-up stays first and a card numbered in words stays last (their numbers sort them there); their exercises still move inside them", () => {
  try {
    const rows = [R("wa", "Wa", "Bike", 1), R("wb", "Wb", "Band pull-apart", 1), R("a", "1", "Squat"), R("b", "2", "Bench press"), R("f1", "Finisher", "Farmer carry", 2), R("f2", "Finisher", "Sled push", 2)];
    page("w1", rows); fns.startOrder("w1");
    assert.strictEqual(fns.roCards(T(), "b", 0), true);
    assert.deepStrictEqual(T().rows.map((r) => r.label + " " + r.id), ["Wa wa", "Wb wb", "1 b", "2 a", "Finisher f1", "Finisher f2"], "only the numbered cards change places");
    assert.strictEqual(fns.roCards(T(), "f1", 0), false, "a card of words stays where its words sort");
    assert.strictEqual(fns.roRows(T(), "wb", 0), true); assert.deepStrictEqual(T().rows.slice(0, 2).map((r) => r.label + " " + r.id), ["Wa wb", "Wb wa"], "the warm-up's letters follow");
    assert.strictEqual(fns.roRows(T(), "f2", 0), true); assert.deepStrictEqual(T().rows.slice(4).map((r) => r.label + " " + r.id), ["Finisher f2", "Finisher f1"], "words as they were, in the new order");
    assert.deepStrictEqual(fns.roKeyItems("card", "wa").map((it) => it.label), [], "the warm-up has no place among the numbers");
  } finally { quiet(); }
});

test("from the keyboard or VoiceOver a grip offers Move up and Move down (the first has no up, the last no down), and each moves one place", () => {
  try {
    page("w1"); fns.startOrder("w1");
    const k = (kind, rid) => fns.roKeyItems(kind, rid).map((it) => it.label);
    assert.deepStrictEqual([k("card", "d"), k("card", "x"), k("card", "g"), k("row", "l"), k("row", "r"), k("row", "y")], [["Move down", "Delete"], ["Move up"], ["Move up", "Move down", "Delete"], ["Move down", "Delete"], ["Move up", "Delete"], ["Move up", "Move down", "Delete"]], "and the swipe's Delete, which VoiceOver cannot reach in a swipe row's hidden layer (the v314 review); a superset's own grip has none");
    const del = fns.roKeyItems("row", "y").pop(); assert.deepStrictEqual([del.danger, del.sep, del.icon === fns.menuIcons().trash], [true, true, true], "last and red, after a line");
    assert.ok(fns.roKeyItems("card", "g").every((it) => it.icon), "each with its arrow, as every menu of his");
    fns.roKeyItems("card", "d").find((it) => it.label === "Move down").onPick();
    assert.deepStrictEqual(T().rows.slice(0, 3).map((r) => r.label + " " + r.id), ["1a l", "1b r", "2 d"]);
    fns.roKeyItems("row", "z").find((it) => it.label === "Move up").onPick();
    assert.deepStrictEqual(T().rows.slice(5).map((r) => r.label + " " + r.id), ["5a x", "5b z", "5c y"]);
    app.set({ view: { name: "client", id: "c1" } }); assert.deepStrictEqual(fns.roKeyItems("card", "g"), [], "Reorder over: nothing");
  } finally { quiet(); }
});

test("in the middle of a workout (his rule, 17 Nov 2026: \"only let me reorder exercises that have not been done or started\"): a card done or begun keeps its place and its number; the others take each other's places around it", () => {
  const begun = (r, n) => Object.assign(r, { setsDone: n, weights: Array(n).fill("100"), repsDone: Array(n).fill("8") });
  const done = (r) => Object.assign(begun(r, r.sets), { done: true });
  try {
    let rows = LEGS(); done(rows[0]); begun(rows[1], 1);                   // Deadlift finished, the superset's first exercise begun
    page("w1", rows); assert.ok(menu("w1").includes("Reorder"), "three cards not begun: Reorder");
    fns.startOrder("w1");
    assert.strictEqual(fns.roCards(T(), "d", 2), false, "a finished card does not move");
    assert.strictEqual(fns.roRows(T(), "r", 0), false, "nor do the exercises of a superset begun (its second not begun included: its rounds keep their order)");
    assert.deepStrictEqual([fns.roKeyItems("card", "d"), fns.roKeyItems("card", "l"), fns.roKeyItems("row", "r")], [[], [], []], "no Move up or down for them either");
    assert.strictEqual(fns.roCards(T(), "x", 0), true);
    assert.deepStrictEqual(T().rows.map((r) => r.label + " " + r.id), ["1 d", "2a l", "2b r", "3a x", "3b y", "3c z", "4 g", "5 s"], "the tri-set first of the three left; the two begun keep 1 and 2");
    assert.deepStrictEqual(fns.roKeyItems("card", "g").map((it) => it.label), ["Move up", "Move down", "Delete"]);
    rows = LEGS(); done(rows[3]);                                         // a card done out of turn (the coach logged 3 before 2): it stays where it is
    page("w1", rows); fns.startOrder("w1");
    assert.strictEqual(fns.roCards(T(), "s", 0), true);
    assert.deepStrictEqual(T().rows.map((r) => r.label + " " + r.id), ["1 s", "2 d", "3 g", "4a l", "4b r", "5a x", "5b y", "5c z"], "Squat to the top: Banded glute kickback keeps 3, the others fill the places around it");
    rows = LEGS(); for (const r of rows.slice(0, 5)) done(r);             // only the tri-set left: its exercises still move inside it
    page("w1", rows); assert.ok(menu("w1").includes("Reorder")); fns.startOrder("w1");
    assert.strictEqual(fns.roRows(T(), "z", 0), true); assert.deepStrictEqual(T().rows.slice(5).map((r) => r.label + " " + r.id), ["5a z", "5b x", "5c y"]);
    rows = LEGS(); for (const r of rows.slice(0, 7)) done(r);             // the last card begun too: nothing left
    begun(rows[7], 1); page("w1", rows); assert.ok(!menu("w1").includes("Reorder"), "nothing left to put in order");
    page("w1"); fns.startOrder("w1"); T().completedAt = "2026-11-02T18:00:00.000Z";
    assert.strictEqual(on(), false, "finished meanwhile (a sync): Reorder is over");
  } finally { quiet(); }
});

test("Delete from a swipe asks first, as every Delete: Cancel keeps it; Delete takes it and the numbers close up; a template's waits for Save template", async () => {
  const H = {};
  for (const id of ["askYes", "askNo"]) { const b = el("button"); b.addEventListener = (t, fn) => { (H[id] ||= []).push(fn); }; b.removeEventListener = (t, fn) => { H[id] = (H[id] || []).filter((f) => f !== fn); }; byId.set(id, b); }
  const answer = (id) => { for (const fn of [...(H[id] || [])]) fn({}); };
  try {
    page("w1"); fns.startOrder("w1");
    let p = fns.roDelete("w1", "y");
    assert.deepStrictEqual([$("askSheet").hidden, $("askTitle").textContent, $("askText").textContent, $("askYes").textContent], [false, "Delete Lying leg curl?", "It comes off this workout, with anything logged on it.", "Delete"], "the exercise's own question (Delete exercise's)");
    answer("askNo"); assert.strictEqual(await p, false); assert.ok(T().rows.some((r) => r.id === "y"), "Cancel: kept");
    p = fns.roDelete("w1", "y"); await tick(400); answer("askYes"); assert.strictEqual(await p, true);
    assert.deepStrictEqual(T().rows.map((r) => r.label + " " + r.id), ["1 d", "2a l", "2b r", "3 g", "4 s", "5a x", "5b z"], "gone; the tri-set closes up its letters");
    assert.ok(maps.dirty.has("trainings/w1") && claimed() && on(), "saved, his numbering claimed, still in Reorder");
    p = fns.roDelete("w1", "d"); T().rows = T().rows.filter((r) => r.id !== "d"); await tick(400); answer("askYes");
    assert.strictEqual(await p, false, "a sync took it away meanwhile: nothing more");
    p = fns.roDelete("w1", "g"); app.set({ view: { name: "client", id: "c1" } }); await tick(400); answer("askYes");
    assert.strictEqual(await p, false, "Reorder over meanwhile (another page): nothing deleted"); assert.ok(T().rows.some((r) => r.id === "g"));
    page("tp"); fns.startOrder("tp");
    p = fns.roDelete("tp", "s");
    assert.deepStrictEqual([$("askTitle").textContent, $("askText").textContent], ["Delete Squat from this template?", "Nothing changes until you tap Save template."]);
    await tick(400); answer("askYes"); assert.strictEqual(await p, true);
    assert.ok(app.get().templateDraft && app.get().templateDraft.id === "tp" && app.get().templateDraft.dirty, "a template's change waits in its draft");
    assert.ok(!claimed("tp"), "(a template's rows merge as one field: no claim)");
  } finally { byId.delete("askYes"); byId.delete("askNo"); quiet(); }
});

test("a template's new order waits for Save template, as every change to a template", () => {
  try {
    page("tp"); fns.startOrder("tp");
    assert.strictEqual(on(), true, "a template is always the coach's");
    assert.strictEqual(fns.roCards(T("tp"), "g", 0), true);
    assert.deepStrictEqual(T("tp").rows.slice(0, 2).map((r) => r.label + " " + r.id), ["1 g", "2 d"]);
    assert.ok(app.get().templateDraft && app.get().templateDraft.dirty, "Unsaved changes: Discard or Save template");
  } finally { quiet(); }
});

test("the look: grey cards (his pick), the held one in purple as the day picker's moving workout, both dark blocks alike; the hint; a sync's redraw waits for a held card", () => {
  for (const line of ["--ro-edge: rgba(60,60,67,0.3); --ro-tint: rgba(120,120,128,0.07);", "--ro-edge: rgba(235,235,245,0.3); --ro-tint: rgba(120,120,128,0.12);"]) assert.ok(html.includes(line), line);
  assert.strictEqual(html.split("--ro-edge: rgba(235,235,245,0.3); --ro-tint: rgba(120,120,128,0.12);").length - 1, 2, "in both dark blocks");
  assert.ok(html.includes('<p class="ro-hint" id="roHint" hidden>Hold and drag to move. Swipe left to delete.</p>'), "the hint his pictures showed");
  assert.ok(html.includes(".ro-block.ro-lifted .list.ro-card { background: var(--card); border-color: var(--brand-text);"), "held: purple, as .day-ev.moving's outline");
  assert.ok(html.includes(".day-ev.moving { box-shadow: inset 0 0 0 1.5px var(--brand-text); }"), "(the day picker's moving workout, the same purple)");
  assert.ok(html.includes("body.ro-on #dock { visibility: hidden; }"), "the bar at the foot by visibility, as the keyboard's (v287)");
  assert.ok(html.includes(".list.ro-card li.swipe-row:not(.swiped):not(.ro-lifted) > :not(.swipe-acts) { background: transparent; }"), "a held exercise keeps its own solid card (the v314 review: it was see-through over the rows it passed)");
  assert.ok(/\|\| pvHolds\(\) \|\| cdHolds\(\) \|\| roHolds\(\);/.test(src), "rowHolds waits for a held card");
  assert.ok(src.includes('"cal-drag", "ro-drag"]'), "a page's picture never keeps the drag's cursor");
});

// ---- the gestures, in their own process (reorder-probe.mjs)
const r = JSON.parse(execFileSync(process.execPath, [path.join(here, "reorder-probe.mjs")], { encoding: "utf8", timeout: 90000 }).trim().split("\n").pop());
test("a whole card, a finger (his ask: \"move the whole superset tri set etc by touch and hold\"): nothing for 0.39 s; at 0.4 it lifts; dragged, the cards it passes glide out of its way; let go, the numbers follow and it is saved; the release clicks nothing", () => {
  const c = r.card;
  assert.deepStrictEqual(c.early, { lifted: false, cls: [] }, "0.39 s: nothing yet");
  assert.deepStrictEqual([c.pre, c.held], [false, true], "a move before the lift is the page's (a scroll); after it every move is the drag's");
  assert.deepStrictEqual([c.lift.lifted, c.lift.kind, c.lift.cls, c.lift.body, c.lift.transform, c.lift.buzz], [true, "card", ["card 2"], true, "scale(1.03)", 0], "lifted a little larger (Fitness's held card), purple (his pick), no buzz at the lift (as the calendar's)");
  assert.deepStrictEqual([c.mid1.to, c.mid1.b3, c.mid1.b4, c.mid1.b5], [3, "translate3d(0,-192px,0)", "translate3d(0,-192px,0)", ""], "the two it passed up by its height and the gap (176 + 16)");
  assert.strictEqual(c.mid1.b2, "translate3d(0,308px,0) scale(1.03)", "it follows the finger");
  assert.deepStrictEqual([c.upPrevented, c.clickEaten], [true, true], "iOS clicks after a long press: that click goes nowhere");
  assert.deepStrictEqual([c.during, c.sameCards], ["1 d | 2 g | 3 s | 4a l | 4b r | 5a x | 5b y | 5c z", true], "written as it is let go (a Done or a Back during the glide keeps it: the v314 review), the cards drawn anew only once it has landed");
  assert.deepStrictEqual(c.order, ["1 d", "2 g", "3 s", "4a l", "4b r", "5a x", "5b y", "5c z"]);
  assert.deepStrictEqual([c.dirty, c.claimed, c.state, c.body, c.on, c.cards, c.buzz], [true, true, null, false, true, "1 2 3 4 5", 1], "saved, his order claimed, still in Reorder, Android's one buzz as it lands");
});
test("an exercise inside its tri-set, a finger (his ask: \"move exercises in the card/ superset\"): it lifts out over its card's edge, the two above it glide down, the letters follow", () => {
  assert.deepStrictEqual(r.row.lift, { kind: "row", rid: "z", cls: ["row z"], open: true });
  assert.deepStrictEqual(r.row.mid1, { to: 0, x: "translate3d(0,58px,0)", y: "translate3d(0,58px,0)" });
  assert.deepStrictEqual([r.row.order.slice(5), r.row.claimed], [["5a z", "5b x", "5c y"], true]);
});
test("a scroll or a swipe before the hold's end lifts nothing; the swipe opens the row's red Delete, which asks first and then takes the exercise", () => {
  assert.deepStrictEqual(r.scroll, { state: null, order: true, cls: [] });
  assert.deepStrictEqual([r.swipe.swiped.open, r.swipe.swiped.state, r.swipe.swiped.cls], [true, null, []]);
  assert.deepStrictEqual(r.swipe.ask, { open: true, title: "Delete Lying leg curl?", text: "It comes off this workout, with anything logged on it." });
  assert.deepStrictEqual([r.swipe.order.slice(5), r.swipe.on, r.swipe.claimed], [["5a x", "5b z"], true, true]);
});
test("held and let go where it was, or called off (Escape, a second finger, the system's cancel): back in its place, nothing written, the release clicks nothing", () => {
  assert.deepStrictEqual(r.inPlace, { lifted: true, order: true, dirty: false, cls: [] });
  for (const k of ["back_escape", "back_second"]) assert.deepStrictEqual(r[k], { order: true, state: null, dirty: false, eaten: true, upPrevented: true }, k);
  assert.deepStrictEqual(r.back_cancel, { order: true, state: null, dirty: false, eaten: null, upPrevented: null });
});
test("a sync's redraw waits while a card is held, the drop goes into the workout as it is then, and what the sync brought stays", () => {
  assert.deepStrictEqual(r.sync, { same: true, order: ["1 d", "2 g", "3a l", "3b r", "4 s", "5a x", "5b y", "5c z"], redrawn: true, name: "Trap bar deadlift" });
});
test("a Mac (he works on one): click and hold, then drag; a press that moves first lifts nothing; a release lost outside the window puts it back", () => {
  assert.deepStrictEqual(r.mouse, { lift: true, order: ["1a l", "1b r", "2 d", "3 g", "4 s", "5a x", "5b y", "5c z"], eaten: true });
  assert.deepStrictEqual([r.mouseMoved, r.mouseLost], [{ state: null }, { state: null, order: true }]);
});
test("held near the screen's foot the page scrolls on, and the place under the finger follows", () => {
  assert.deepStrictEqual([r.auto.scrolled, r.auto.to, r.auto.order.at(-1)], [true, 4, "5 d"], "carried to the end");
});
test("Done: the workout's own look again, in the new order", () => {
  assert.deepStrictEqual(r.done, { on: false, roBlocks: 0, cards: 5, body: false, order: ["1a x", "1b y", "1c z", "2 d"], gone: null });
});
test("a warm-up keeps its place (no grip of its own), its exercises move inside it; a card of words keeps its place; numbered cards move below the warm-up", () => {
  assert.deepStrictEqual(r.warm, { grips: "w:none 1:grip 2:grip finisher:none", kind: "row", words: null, order: ["Wa wb", "Wb wa", "1 b", "2 a", "Finisher f"] });
});
test("the keyboard or VoiceOver on a grip: Move up, Move down; a pointer's tap on it opens nothing (it is held to move)", () => {
  assert.deepStrictEqual(r.keys, { tap: { open: false }, open: true, rows: ["Move up", "Move down", "Delete"] });
});
test("a template: the move waits in its draft; Reduce Motion: it lands at once; nothing threw", () => {
  assert.deepStrictEqual(r.tpl, { order: ["1 s", "2 d"], draft: true, claimed: false });
  assert.deepStrictEqual(r.calm, { tr: "none", order: ["1 d", "2 g", "3a l"] });
  assert.deepStrictEqual(r.rejected, []);
});
test("in the middle of a workout, by finger: a card done or begun has no grip, grey names and its own line, and lifts nothing; a card dragged past it lands around it, and it keeps its number", () => {
  assert.strictEqual(r.begun.look, "1:none:fixed:Finished \u00b7 4 of 4 sets | 2:grip:4 sets \u00b7 8 reps | 3:none:fixed:In progress | 4:grip:4 sets \u00b7 8 reps | 5:grip:Tri-set \u00b7 3 sets".replace("2:grip:4 sets \u00b7 8 reps", "2:grip:Superset \u00b7 4 sets"));
  assert.deepStrictEqual([r.begun.onDone, r.begun.onBegun], [null, null], "a hold on them lifts nothing");
  assert.deepStrictEqual(r.begun.during, { to: 0, b3: "translate3d(0,58px,0)", b1: "" }, "the begun card shifts by the height that changed above it (the tri-set's 234 for the superset's 176); the finished one above stays");
  assert.deepStrictEqual(r.begun.order, ["1 d", "2a x", "2b y", "2c z", "3 g", "4a l", "4b r", "5 s"]);
});
test("the swipe's Delete is the trash alone (his ask: \"only delete icon to ensure it fits\"); VoiceOver's Delete is the grip's menu (the swipe's layer is hidden, as every swipe row's)", () => {
  assert.deepStrictEqual(r.trash, { label: "none", aria: "Delete", cap: true });
});
test("one card left not begun has no grip of its own (nowhere else to go); its exercises keep theirs", () => {
  assert.deepStrictEqual(r.lastOne, { cardGrip: false, rowGrips: 3, others: 0 });
});
test("from his Client view: the same Reorder and the same drag; Done brings his Client view back", () => {
  assert.deepStrictEqual(r.clientView, { look: { on: true, client: true, cards: 5 }, moved: ["1a l", "1b r", "2 d"], after: { on: false, client: true, preview: true, roBlocks: 0 } });
});
test("Done during the glide keeps the move; a finish ends Reorder and its Undo does not bring it back; from the keyboard the place goes to Done, then back to the \"…\" (the v314 review)", () => {
  assert.deepStrictEqual(r.doneMidGlide, { on: false, order: ["1a l", "1b r", "2 d"], dirty: true });
  assert.deepStrictEqual(r.finishUndo, { ended: false, back: false, roBlocks: 0 });
  assert.deepStrictEqual(r.keysPlace, { atStart: "navDone", atEnd: "tMore", on: false });
});
test("a press during the last drop's glide starts its own hold and moves its card; a row swiped in the glide is not drawn out from under its finger; a template's scroll band sits above its Unsaved changes bar (the v314 review)", () => {
  assert.deepStrictEqual(r.pressInGlide, { lifted: true, claimed: true, order: ["1 g", "2a l", "2b r", "3 d"] }, "its old row's own listener claims the finger (not passive), so the page holds still");
  assert.deepStrictEqual([r.swipeInGlide.midSwipe.same, r.swipeInGlide.midSwipe.dropped, r.swipeInGlide.open, r.swipeInGlide.order], [true, true, true, ["1a l", "1b r", "2 d"]], "the swipe keeps its row, and the dropped card rests in its new place meanwhile");
  assert.deepStrictEqual(r.tplBand, { scrolled: true });
});
test("the keyboard's Delete keeps the place (back on the grip after Cancel, on the next exercise's after Delete); a sync that ends Reorder under the question leaves no Reorder cards behind (the v314 final check)", () => {
  assert.deepStrictEqual(r.keyDelete, { afterCancel: { asked: true, place: "y", kept: true }, place: "z", gone: true, order: ["5a x", "5b z"] });
  assert.deepStrictEqual(r.endedUnderQuestion, { on: false, roBlocks: 0, kept: true });
});
test("a finger resting on a row during a drop's glide, then lifted, holds off no sync's redraw (the v314 final check)", () => {
  assert.deepStrictEqual(r.restingFinger, { redrawn: true, name: true });
});
test("the keyboard's Delete that leaves nothing more to move puts the place on Done (the v314 final check)", () => {
  assert.deepStrictEqual(r.lastDelete, { place: "navDone", rows: ["1 a"] });
});
