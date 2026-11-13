// His pick, 10 Nov ("Build b", after his Photos screenshot): on the coach's workout page the Coach | Client switch and a round + share the
// bar at the foot, as Photos' Library | Collections and its round button do. The + puts a new exercise at the end with the keyboard on its
// name; the black "+ Add exercise" button is gone, from an empty workout too ("Remove it, template full width"), where From template has the
// row to itself. The switch stays while he previews the client's look (the + goes); a template has the + alone; the client's own view has
// neither. On the swipe back a page's bar goes with its page, unless the page underneath has the same bar.
// His ask, 12 Nov: the + Add exercise button comes back (white in the dark, black in the light) "where it was right bellow the last
// exercise with full width and also at the beginning next to template split half and half", and the bar's + stays.
// (This stand-in page draws no exercise cards, so the workouts drawn here are empty; the + is checked up to its draw, and its page move through followRow.
// Typing, a double click and the swipe back's pictures run in their own processes, as a phone and as a computer: workout-bar-probe.mjs.)
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { test, assert } from "./assert.js";
import { load } from "./load.js";
import { byId } from "./env.js";
import { TEMPLATES_ID } from "../app/model.js";
const app = await load();
const { fns, maps } = app;
const $ = (id) => document.getElementById(id);
const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const here = path.dirname(fileURLToPath(import.meta.url));
const probe = (mode) => JSON.parse(execFileSync(process.execPath, [path.join(here, "workout-bar-probe.mjs"), mode], { encoding: "utf8", timeout: 60000 }).trim().split("\n").pop());
const phone = probe("phone"), desk = probe("desk"), swipe = probe("swipe"), kb = probe("kb");
const src = fs.readFileSync(new URL("../app/main.js", import.meta.url), "utf8");
const workout = (id, extra = {}) => ({ id, clientId: "c1", title: "Legs", date: fns.today(), createdAt: "2026-11-01T10:00:00.000Z", completedAt: null, skippedAt: null, rows: [], ...extra });
const BAR = ["viewSeg", "addExBtn", "tabbar", "addBtn"];
const page = (view, extra = {}) => {
  app.reset(); fns.setPreview(false);
  app.set({ signedIn: true, clientMode: false, myClientId: null, tab: "workouts", ...extra });
  maps.clients.set("c1", { id: "c1", name: "Jane", unit: "lb" }); maps.clients.set(TEMPLATES_ID, { id: TEMPLATES_ID, name: "Templates" });
  maps.trainings.set("w1", workout("w1")); maps.trainings.set("tp", workout("tp", { clientId: TEMPLATES_ID }));
  for (const id of BAR) $(id).hidden = false;                          // whatever the last page left: the draw decides
  document.body.classList.add("wsdock"); $("dock").classList.add("ws");
  app.set({ view, renderedTraining: null }); fns.render();
};
const redraw = () => { app.set({ renderedTraining: null }); fns.render(); };
const bar = () => ({ wsdock: document.body.classList.contains("wsdock") && $("dock").classList.contains("ws"), seg: !$("viewSeg").hidden, plus: !$("addExBtn").hidden, tabs: !$("tabbar").hidden, newWorkout: !$("addBtn").hidden });
const NONE = { wsdock: false, seg: false, plus: false, tabs: false, newWorkout: false }, COACH = { wsdock: true, seg: true, plus: true, tabs: false, newWorkout: false };

test("the coach's workout page: Coach | Client at the foot with the round +; a client's page keeps its tabs and its +; the Clients page has neither", () => {
  page({ name: "training", id: "w1" }); assert.deepStrictEqual(bar(), COACH);
  page({ name: "client", id: "c1" }); assert.deepStrictEqual(bar(), { wsdock: false, seg: false, plus: false, tabs: true, newWorkout: true });
  page({ name: "clients" }); assert.deepStrictEqual(bar(), NONE);
});

test("previewing the client's look: the switch stays (to switch back), the + goes; back on Coach the + is there again", () => {
  page({ name: "training", id: "w1" }); fns.setPreview(true); redraw();
  assert.deepStrictEqual({ ...bar(), look: document.body.classList.contains("client") }, { ...COACH, plus: false, look: true });
  fns.setPreview(false); redraw(); assert.deepStrictEqual(bar(), COACH);
});

test("a template: the + alone (no client's look to preview); the client's own view of a workout: neither", () => {
  page({ name: "training", id: "tp" }); assert.deepStrictEqual(bar(), { ...COACH, seg: false });
  page({ name: "training", id: "w1" }, { clientMode: true, myClientId: "c1" }); assert.deepStrictEqual(bar(), NONE);
});

test("a settings page opened over the workout takes the bar away; Back brings it again, even onto the workout drawn as it was", () => {
  page({ name: "training", id: "w1" }); fns.leaveSettings(); assert.deepStrictEqual(bar(), NONE);
  fns.render(); assert.deepStrictEqual(bar(), COACH, "Back onto the same workout, nothing in it changed (its cards are not drawn again)");
  page({ name: "client", id: "c1" }); app.set({ view: { name: "training", id: "w1" } }); fns.render(); assert.deepStrictEqual(bar(), COACH, "from the client's page, whose tabs had the bar");
  page({ name: "client", id: "c1" }, { clientMode: true, myClientId: "c1" }); assert.deepStrictEqual(bar(), { ...NONE, tabs: true }, "the client's own page: their tabs, no + and no switch");
});

test("the start row (his ask, 12 Nov): + Add exercise beside From template on an empty workout; alone under the exercises, on a finished one and on a template; none in the client's look", () => {
  const row = () => [$("startRow").hidden, $("addRow").hidden, $("tplFill").hidden];
  page({ name: "training", id: "w1" }); assert.deepStrictEqual(row(), [false, false, false], "empty: + Add exercise and From template, half and half");
  maps.trainings.get("w1").completedAt = "2026-11-10T18:00:00.000Z"; redraw(); assert.deepStrictEqual(row(), [false, false, true], "finished: no template; + Add exercise stays, as the bar's + does");
  page({ name: "training", id: "w1" }); fns.setPreview(true); redraw(); assert.strictEqual($("startRow").hidden, true, "the client's look: no row"); fns.setPreview(false);
  page({ name: "training", id: "tp" }); assert.deepStrictEqual(row(), [false, false, true], "a template: + Add exercise alone");
  fns.setPreview(true); redraw(); assert.deepStrictEqual(row(), [false, false, true], "a template has no client's look: it stays, as the bar's + does"); fns.setPreview(false);
  page({ name: "training", id: "w1" }); maps.trainings.get("w1").rows = [{ id: "r1", label: "1", name: "Squat", sets: 3, reps: "8", tempo: "", rest: "", weights: [], repsDone: [], setsDone: 0, note: "" }];
  try { redraw(); } catch (_) {}                                         // (this stand-in page cannot draw the exercise's card: the row is decided before it)
  assert.deepStrictEqual(row(), [false, false, true], "with exercises: + Add exercise alone, across the row under the last one");
  page({ name: "training", id: "w1" }, { clientMode: true, myClientId: "c1" }); assert.strictEqual($("startRow").hidden, true, "the client's own view: no row");
});

test("the + on the coach's workout: a new exercise at the end, numbered next, saved; on a template too", () => {
  for (const id of ["w1", "tp"]) {
    page({ name: "training", id }); app.set({ renderedTraining: "stale" });
    try { fns.addExercise(); } catch (_) {}                              // (this stand-in page cannot draw an exercise card: the exercise is added and saved before the draw)
    assert.strictEqual(app.get().renderedTraining, id, id + ": the page drawn again, so the new card is there for the keyboard");
    for (const t of maps.timers.values()) clearTimeout(t); maps.timers.clear();   // its save never runs into a later test
    assert.deepStrictEqual(maps.trainings.get(id).rows.map((r) => [r.label, r.name]), [["1", ""]], id + ": one new exercise, number 1, its name to type");
    assert.ok(id === "tp" ? app.get().templateDraft && app.get().templateDraft.dirty : maps.dirty.size > 0, id + ": saved (a template: an unsaved change of its draft)");
  }
});

test("the + adds nothing anywhere else: a client's page, or the client's own view of a workout", () => {
  page({ name: "client", id: "c1" }); fns.addExercise(); assert.strictEqual(maps.trainings.get("w1").rows.length, 0);
  page({ name: "training", id: "w1" }, { clientMode: true, myClientId: "c1" }); fns.addExercise(); assert.strictEqual(maps.trainings.get("w1").rows.length, 0);
});

test("the + puts its new exercise under the header at once, before asking for the keyboard (a field far down: iOS would slide the whole page, header and all); other follows still glide after", () => {
  page({ name: "training", id: "w1" });
  const de = document.documentElement, was = { st: de.scrollTop, sh: de.scrollHeight, ch: de.clientHeight }, mm = globalThis.matchMedia, rows = byId.get("rows");
  globalThis.matchMedia = () => ({ matches: true, addEventListener() {}, removeEventListener() {} });   // (reduced motion: the glide lands at once, no timers left over)
  const seen = [];
  const name = { focus: (o) => seen.push({ at: de.scrollTop, preventScroll: !!(o && o.preventScroll) }) };
  const row = { querySelector: (s) => (s === ".name" ? name : null), getBoundingClientRect: () => ({ top: 900 - de.scrollTop, bottom: 1000 - de.scrollTop }), closest: () => null };   // 900 down a page the length of a real workout
  byId.set("rows", new Proxy(rows, { get: (t, k) => (k === "querySelector" ? (s) => (/^\.row\[data-id=/.test(s) ? row : t.querySelector(s)) : t[k]) }));
  try {
    de.scrollTop = 0; de.scrollHeight = 5000; de.clientHeight = 800;
    fns.followRow("n1", "name", false, true);
    assert.deepStrictEqual(seen.shift(), { at: 888, preventScroll: true }, "the +: the page is already there (900 less the header's 12) when the keyboard is asked for");
    assert.strictEqual(de.scrollTop, 888, "and it stays");
    de.scrollTop = 0; fns.followRow("n1", "name");
    assert.deepStrictEqual(seen.shift(), { at: 0, preventScroll: true }, "a follow without it (a renumbered exercise, the keyboard already up): the focus first");
    assert.strictEqual(de.scrollTop, 888, "then the glide");
  } finally { byId.set("rows", rows); globalThis.matchMedia = mm; de.scrollTop = was.st; de.scrollHeight = was.sh; de.clientHeight = was.ch; }
  assert.ok(src.includes('$("addExBtn").addEventListener("click", addExercise);') && src.includes('followRow(r.id, "name", false, !deskOn);'), "the + asks for exactly that, on the new exercise's name, on a phone; a computer (no keyboard to come) glides there");
  assert.ok(src.includes("const r = newRow(nextLabel(t)); t.rows.push(r); scheduleSave(\"trainings\", t.id);"), "the new exercise: the next number, at the end, saved");
});

test("the page: + Add exercise in ink beside From template outlined; the bar's switch in the tab bar's glass and its + with its name", () => {
  assert.ok(html.includes('<div class="start-row" id="startRow" hidden><button class="btn ink trainer-only" id="addRow" type="button">+ Add exercise</button><button class="btn outline trainer-only" id="tplFill" type="button" hidden>From template</button></div>'), "+ Add exercise first, then From template; never in the client's look (trainer-only)");
  assert.ok(html.includes(".btn.ink { background: var(--ink); color: var(--ink-on); }"), "ink: white on the dark page, black on the light one (his ask: \"in white\")");
  assert.match(html, /\.start-row #addRow, \.start-row #tplFill \{ flex: 1 1 0;/, "half and half, or one across the row");
  assert.ok(html.includes("  .start-row #addRow, .start-row #tplFill { min-width: 0; white-space: normal; line-height: 1.2; text-align: center; }"), "with the phone's larger Text Size a label wraps inside its half, never past the screen's edge");
  assert.ok(src.includes('$("addRow").addEventListener("click", addExercise);'), "it adds as the bar's + does");
  const seg = (html.match(/<div id="dock">\s*(<div class="view-seg" id="viewSeg"[\s\S]*?<\/button><\/div>)/) || [])[1] || "";
  assert.strictEqual(seg.replace(/<svg[\s\S]*?<\/svg>/g, "<svg/>"), '<div class="view-seg" id="viewSeg" role="radiogroup" aria-label="See it as" hidden><button type="button" role="radio" data-view="coach" class="on" aria-checked="true"><svg/><span>Coach</span></button><button type="button" role="radio" data-view="client" aria-checked="false"><svg/><span>Client</span></button></div>', "Coach | Client lives in the bar at the foot, first, each a symbol over its word");
  const [coachIcon, clientIcon] = [...seg.matchAll(/<svg[\s\S]*?<\/svg>/g)].map((m) => m[0]);
  assert.ok(/^<svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path fill-rule="evenodd" d="[^"]+"\/><path fill-rule="evenodd" d="[^"]+"\/><\/svg>$/.test(coachIcon || ""), "Coach: a clipboard, filled as Apple's list.clipboard.fill (his picks: a clipboard, to Apple's standard): the board with its three lines cut out, and the clip with its hole");
  assert.ok(/^<svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><ellipse cx="12" cy="7\.5" rx="3\.9" ry="4\.3"\/><path d="M3\.8 19\.8A8\.2 6\.3 0 0 1 20\.2 19\.8A1 1 0 0 1 19\.2 20\.8H4\.8A1 1 0 0 1 3\.8 19\.8Z"\/><\/svg>$/.test(clientIcon || ""), "Client: a person, filled as Apple's person.fill: an upright oval head over a half-oval body (traced to its measures)");
  assert.match(html, /#dock \.view-seg button \{[^}]*display: inline-flex; flex-direction: column; align-items: center; justify-content: center; gap: 3px;[^}]*font-size: 0\.6875rem;/, "the symbol over its word, in the tabs' small letters");
  assert.ok(html.includes("#dock .view-seg button svg { width: 22px; height: 22px; }"), "the tabs' symbol size");
  assert.ok(!/class="date-row">[^\n]*viewSeg/.test(html), "and no longer beside the date");
  assert.ok(html.includes('<button class="dock-add dock-pill trainer-only" id="addExBtn" type="button" aria-label="Add exercise" title="Add exercise" hidden>'), "the + says Add exercise to VoiceOver and to a Mac's pointer; never in the client's look (trainer-only)");
  assert.match(html, /id="addExBtn"[^>]*><svg viewBox="0 0 24 24"[^>]*><path d="M12 3\.1V20\.9M3\.1 12H20\.9" fill="none" stroke="currentColor" stroke-width="1\.9" stroke-linecap="round"\/><\/svg><span>Exercise<\/span><\/button>/, "a big plus over the word Exercise (his ask: as Photos' pills), with Apple's plus's round-ended arms at its thickness to length (0.107)");
  assert.ok(html.includes(".dock-add.dock-pill { width: auto; min-width: 96px; border-radius: 50px; padding: 0 18px 2px; flex-direction: column; gap: 3px; font: inherit; font-size: 0.6875rem; font-weight: 600;"), "a pill as the tabs: the plus on top, the word under it in the tabs' small letters");
  assert.ok(html.includes(".dock-add.dock-pill svg { width: 24px; height: 24px; }"), "the plus big");
  assert.match(html, /#dock \.view-seg \{[^}]*background: var\(--tab-fill\);[^}]*box-shadow: var\(--tab-shadow\);/, "the switch in the tab bar's glass");
  assert.match(html, /#dock \.view-seg button\.on \{ background: var\(--tab-on\); color: var\(--brand-text\); box-shadow: var\(--tab-on-shadow\); \}/, "the chosen side lit as the tab bar's");
  assert.ok(src.includes('b.classList.toggle("on", on); b.setAttribute("aria-checked", String(on));'), "VoiceOver hears which side is chosen");
});

test("the bar's place, as Photos': the switch at the leading edge, the + at the trailing one, 21 in, kept to the page's column; above a template's Unsaved changes bar; side by side on the narrowest screens", () => {
  assert.ok(html.includes("#dock.ws { justify-content: space-between; padding: 0 21px; max-width: 680px; margin: 0 auto; }"), "marked on the bar itself, so a picture's copy of it keeps the layout");
  assert.ok(!/body\.[\w-]+ #(dock|addExBtn)[^{]*\{[^}]*(justify-content|padding|max-width|margin)/.test(html), "no page class lays the bar out: during a swipe that class is the other page's");
  assert.ok(html.includes("#dock.ws #addExBtn { margin-left: auto; }"), "the + stays at the trailing edge alone (a template)");
  assert.ok(html.includes("body.wsdock #vTraining { padding-bottom: 100px; }"), "the last thing on the page clears the bar");
  assert.ok(html.includes("body.draft #dock { bottom: calc(79px + env(safe-area-inset-bottom, 0px)); }"), "14 above the Unsaved changes bar");
  assert.ok(html.includes("#dock .view-seg button { appearance: none; border: 0; background: none; width: 100px; min-width: 0; flex: 1 1 100px; height: 56px; padding: 0 8px;"), "100 each, as Photos' (208 with the glass); on a screen too narrow (320) they give way, to 80 each, as the tabs do");
  assert.match(html, /\.dock-add \{ flex: none;/, "the + never gives way, so the switch never runs under it");
});

test("typing on a phone: the bar gives the keyboard the bottom, from the + on; it is back once the field is let go", () => {
  assert.deepStrictEqual(phone.drawn, { typing: false, keys: false, focus: "nothing", plus: true });
  assert.deepStrictEqual(phone.plus, { typing: true, keys: false, focus: "name", added: 1 }, "the +: a new exercise, the keyboard on its name, the bar away");
  assert.deepStrictEqual(phone.reps, { typing: true, keys: true, focus: "reps" }, "a number box: the keyboard and its bar of keys");
  assert.deepStrictEqual(phone.backToName, { typing: true, keys: false, focus: "name" });
  assert.deepStrictEqual(phone.letGo, { typing: false, keys: false, focus: "nothing" }, "let go: the bar is back");
  assert.ok(html.includes("body.typing #dock, body.kb #dock { visibility: hidden; }"), "either look takes the bar away: hidden, never taken out (v287), so WebKit keeps placing it with the page");
});

test("typing on a computer (his Mac): the bar stays, so the + is under the pointer for the next exercise; only the keyboard's bar of keys, at the window's foot, takes the bottom", () => {
  assert.deepStrictEqual(desk.plus, { typing: false, keys: false, focus: "name", added: 1 }, "the +: the cursor in the new name, the bar still there");
  assert.deepStrictEqual(desk.plusLater, { typing: false, keys: false, focus: "name" });
  assert.deepStrictEqual(desk.reps, { typing: false, keys: true, focus: "reps" }, "a number box: its bar of keys has the bottom, so the bar gives way");
  assert.deepStrictEqual(desk.backToName, { typing: false, keys: false, focus: "name" }, "back to a name: the bar is back at once");
  assert.deepStrictEqual(desk.letGo, { typing: false, keys: false, focus: "nothing" });
  assert.ok(src.includes("dockOn = dockShows(dock);") && src.includes('&& !document.body.classList.contains("typing") && !document.body.classList.contains("kb");'), "a swipe counts the live bar only when it is on screen");
  assert.ok(src.includes("box._dock = !!dock && [...dock.children].some((k) => !k.hidden);"), "a page's picture has its bar as the page comes back (never typing then, v287)");
  assert.ok(src.includes('a.blur(); document.body.classList.remove("typing"); if (kbTarget) hideKb(); }'), "two fingers on a computer let the field go, and its bar of keys at once: the page's bar slides with the page");
});

test("a double click on the + is one exercise (on a computer the + stays under the pointer)", () => {
  assert.strictEqual(phone.doubleClick.added, 2, "the one before, and one for the double click");
  assert.strictEqual(desk.doubleClick.added, 2);
});

test("a double click on + Add exercise under the exercises adds one; its second click, landing on the new card in the button's place, is eaten; a single click right after, and a double click later, are not", () => {
  for (const r of [phone, desk]) assert.deepStrictEqual(r.addRow, { added: 3, secondEaten: true, singleKept: true, lateKept: true }, r.mode);
});

test("the swipe back: each picture keeps its own page's bar, laid out as that page lays it out", () => {
  assert.deepStrictEqual(swipe.workout, { view: "training", wsdock: true, ws: true, bar: "viewSeg,addExBtn" }, "a new, empty workout from the client page's +");
  assert.deepStrictEqual(swipe.templatesToWorkout.live, { view: "client", wsdock: false, ws: false, bar: "" }, "From template: the Templates page, no bar");
  assert.deepStrictEqual(swipe.templatesToWorkout.picture, { classes: "shot-dock ws", shows: "viewSeg,addExBtn" }, "the workout comes back in with its bar at its edges, as it lands");
  assert.deepStrictEqual(swipe.templatesToWorkout.landed, { view: "training", wsdock: true, ws: true, bar: "viewSeg,addExBtn" });
  assert.deepStrictEqual(swipe.workoutToClient.picture, { classes: "shot-dock", shows: "tabbar,addBtn" }, "the client page comes in with its tabs and + centred as it has them, not at the workout's edges");
  assert.deepStrictEqual(swipe.workoutToClient.landed, { view: "client", wsdock: false, ws: false, bar: "tabbar,addBtn" });
});

test("(v286) a workout the coach shows as the client (Settings: Open workouts in Client): the swipe back slides over the client's page as Back shows it, in the coach's own look (it was the plain page colour), the copy under a body of its own with that page's classes and not the client's look", () => {
  assert.deepStrictEqual(swipe.asClient, { view: "training", wsdock: true, ws: true, bar: "viewSeg", client: true }, "the workout in the client's look (no + of the coach's)");
  const a = swipe.asClientToClient;
  assert.deepStrictEqual(a.picture, { classes: "shot-dock", shows: "tabbar,addBtn" }, "the client's page under it, its tabs and the coach's + as Back brings them");
  assert.deepStrictEqual([a.under, a.layerIn, a.clientMid, a.landedClient], ["tabs", "html", true, false], "its body: the page's own class (its tabs), not the client's look the live page keeps while the finger holds it, beside the live body (inside it, body.client's rules would restyle it); landed: the coach's look");
  assert.deepStrictEqual(a.landed, { view: "client", wsdock: false, ws: false, bar: "tabbar,addBtn" });
});

test("(v286) the picture is taken in the look Back lands in, every way: a brand-new workout a template is being chosen for opens as the coach even with Open workouts in Client; a workout switched to the client's view by hand comes back as the client's from Settings; the client's own app keeps its look; a passing state (typing) is never in a picture", () => {
  assert.deepStrictEqual([swipe.fillAsClient.picture, swipe.fillAsClient.under, swipe.fillAsClient.landedClient], [{ classes: "shot-dock ws", shows: "viewSeg,addExBtn" }, "wsdock", false], "the brand-new workout, as the coach (its + and Coach | Client)");
  const st = swipe.settingsToClientView;
  assert.deepStrictEqual([st.switched, st.picture, st.under, st.landedClient], [true, { classes: "shot-dock ws", shows: "viewSeg" }, "wsdock client", true], "Settings over a workout shown as the client: back to it as the client sees it");
  assert.strictEqual(swipe.typingToClient.under, "tabs", "taken while typing: no typing class under the picture");
  assert.deepStrictEqual([swipe.clientApp.picture, swipe.clientApp.under], [{ classes: "shot-dock", shows: "tabbar" }, "tabs client"], "the client's own app: their page in their look");
});


test("Back refused (a template's Unsaved changes): the + that went with the page comes back in with it", () => {
  assert.deepStrictEqual(swipe.template, { view: "training", wsdock: true, ws: true, bar: "addExBtn", dirty: true });
  const m = swipe.refused.moves;
  assert.deepStrictEqual(m.slice(m.indexOf("")), ["", "translate3d(390px,0,0)", "translate3d(0px,0,0)", ""], "off with the page; when Back is refused, put back beside the page, then home with it (not home at once, the page still off the screen)");
  assert.deepStrictEqual(swipe.refused.landed, { view: "training", wsdock: true, ws: true, bar: "addExBtn" }, "still the template, its changes kept");
});

test("the swipe back: a page's bar goes with it, unless the page underneath has the same bar", () => {
  const dock = { children: [{ id: "viewSeg", hidden: false }, { id: "tabbar", hidden: true }, { id: "addBtn", hidden: true }, { id: "addExBtn", hidden: false }] };
  const clientShot = { _dock: true, _dockSig: "tabbar,addBtn" }, workoutShot = { _dock: true, _dockSig: "viewSeg,addExBtn" }, noBar = { _dock: false, _dockSig: "" };
  assert.strictEqual(fns.dockGoes(true, clientShot, dock), true, "a workout back to its client's page: Coach | Client goes with the workout, the tabs come with the client's page");
  assert.strictEqual(fns.dockGoes(true, workoutShot, dock), false, "the same bar on both pages (the day's other workout): it stays");
  assert.strictEqual(fns.dockGoes(true, noBar, dock), true, "a page underneath with no bar (History): it goes");
  assert.strictEqual(fns.dockGoes(true, null, dock), true, "no picture of the page underneath: it goes");
  assert.strictEqual(fns.dockGoes(false, clientShot, dock), false, "no bar on this page: nothing moves");
  assert.ok(src.includes("sw.dockSlides = dockGoes(dockOn, shot, dock);"), "the swipe asks it");
  assert.ok(src.includes('d.style.visibility = dockOn && !sw.dockSlides ? "hidden" : ""'), "the page underneath shows its own bar unless the same one stays");
  assert.ok(src.includes('box._dockSig = box._dock ? dockSig(dock) : "";'), "each picture remembers which bar it had");
  assert.ok(src.includes('$("dock").classList.toggle("ws", wsDock);') && src.includes('$("dock").classList.remove("ws");'), "the copy (a clone of the bar) carries its page's layout: the workout's bar comes in at its edges under the Templates page, the client page's tabs centred under a workout");
  assert.ok(src.includes('if (s.dockSlides && s.dock) { s.dock.style.transition = "none"; s.dock.style.transform = "translate3d(" + w + "px,0,0)"; }'), "Back refused (a template's Unsaved changes): the bar that went with the page comes back in with it");
});

// His screenshots, 13 Nov ("the glass bar has a lot of glitches ... sometimes when I add an exercise after I add it it disappears sometimes it moves
// when it shouldn't ... make sure the glass bar and all the plus buttons ... always there no matter what"): the bar mid-screen on a workout.
test("(v287) the bar at the foot and the keyboard: it waits for the keyboard to have gone before it comes back, at most 0.7 s; a box taken away with the keyboard on it, a redraw, or the app sent away and back never leave it away; it never moves with the visible area; a read-only box hides nothing; a swipe back as the keyboard goes takes the bar with its page", () => {
  assert.deepStrictEqual(kb.kbGate, { waiting: true, back: false }, "let go with the keyboard still on its way out: away until it has gone, then back");
  assert.deepStrictEqual(kb.kbSilent, { mid: true, late: false }, "a keyboard that never says: back after 0.7 s");
  assert.deepStrictEqual(kb.kbGone, { stuck: [true, true], after: [false, false] }, "the box taken away with no blur: the keyboard going takes the typing look and the bar of keys with it");
  assert.strictEqual(kb.kbRedraw, false, "or the next redraw does");
  assert.deepStrictEqual(kb.kbPin, { pinned: "", rest: "", keyboardUp: "", notPanned: "" }, "the visible area reported moved (an iPhone does so at every bounce at a page's foot, 125 points measured): the bar never moves with it (the v287 review: a pin made it dip)");
  assert.deepStrictEqual(kb.kbReadOnly, { typing: false, hidden: false }, "a read-only box (the client's look: the title, an exercise's name and number) takes a tap with no keyboard: no typing look, the bar stays (it hid the bar for good)");
  assert.deepStrictEqual(kb.kbSwipe, { typingAtTouch: true, typingAtStart: false, slid: true }, "a swipe back started as the keyboard still goes (the typing look still on at the touch): the bar is back once the swipe starts and slides with its page (it stayed still over the page coming in)");
  assert.strictEqual(kb.kbBack, false, "the app back on screen: no typing look left behind");
  assert.deepStrictEqual(kb.kbNext, { typing: true, keys: true, focus: "reps" }, "another box has the keyboard: still away");
  assert.deepStrictEqual([kb.drawn, kb.plus, kb.reps, kb.letGo], [phone.drawn, phone.plus, phone.reps, phone.letGo], "the phone's own steps, the same with its visible area");
});
