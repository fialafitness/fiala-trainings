// His ask, 10 Nov: "add the three dot button in the right top corner to coaches view too but in coaches view it will also have the option to
// delete workout". His picks: Reschedule (any day, as his row's) and, last and red, Delete workout, which asks first; a finished or skipped
// workout shows only Delete, a template Move to and Delete template (v283); the red Delete workout at the page's foot stays. The client's "…" (and the
// coach's Client view of a workout) keeps the client's Reschedule, from today on. And the client page's tabs are filled (his pick: B, a
// dumbbell, bars, a page; traced to Apple's dumbbell.fill, chart.bar.fill and doc.text.fill).
// His ask, 12 Nov: "copy workout and save as template will go to "..." button only for coaches view": between Reschedule and Delete.
import fs from "node:fs";
import { test, assert, tick } from "./assert.js";
import { load } from "./load.js";
import { byId, el } from "./env.js";
import { TEMPLATES_ID } from "../app/model.js";
const app = await load();
const { fns, maps } = app;
const $ = (id) => document.getElementById(id);
const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const src = fs.readFileSync(new URL("../app/main.js", import.meta.url), "utf8");
const day = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return fns.localIso(d); };   // the app's local day (never UTC)
const page = (id, extra = {}, opts = {}) => {
  for (const t of maps.timers.values()) clearTimeout(t); maps.timers.clear();   // (a reset forgets the save timers without stopping them: stopped here, none runs into a later file)
  app.reset(); fns.setPreview(!!opts.preview);
  app.set({ signedIn: true, clientMode: !!opts.client, myClientId: opts.client ? "c1" : null, tab: "workouts" });
  maps.clients.set("c1", { id: "c1", name: "Jane", unit: "lb" }); maps.clients.set(TEMPLATES_ID, { id: TEMPLATES_ID, name: "Templates" });
  maps.trainings.set("w1", { id: "w1", clientId: "c1", title: "Legs", date: day(1), createdAt: "2026-11-01T10:00:00.000Z", completedAt: null, skippedAt: null, rows: [], ...extra });
  maps.trainings.set("tp", { id: "tp", clientId: TEMPLATES_ID, title: "Push", date: null, createdAt: "2026-11-01T10:00:00.000Z", completedAt: null, skippedAt: null, rows: [] });
  app.set({ view: { name: "training", id }, renderedTraining: null }); fns.render();
};
const menu = (id) => fns.moreItems(maps.trainings.get(id)).map((it) => (it.danger ? "red " : "") + it.label);
const shown = () => !$("tMore").hidden;
const agree = (id) => assert.strictEqual(fns.barFor("training/" + id).tMore, shown(), "the swipe back's bar for this page agrees with the page");
const DONE = "2026-11-02T18:00:00.000Z";
const quiet = () => { for (const t of maps.timers.values()) clearTimeout(t); maps.timers.clear(); fns.setPreview(false); };   // no save left to run into a later test

test("the coach's own view: the \"…\" on every workout and template; Reschedule while it is still to do; Copy workout and Save as template; last and red, Delete", () => {
  const MID = ["Copy workout", "Save as template"];
  page("w1"); assert.deepStrictEqual([shown(), menu("w1")], [true, ["Reschedule", ...MID, "red Delete workout"]], "still to do"); agree("w1");
  page("w1", { completedAt: DONE }); assert.deepStrictEqual([shown(), menu("w1")], [true, [...MID, "red Delete workout"]], "finished: nothing to reschedule"); agree("w1");
  page("w1", { skippedAt: DONE }); assert.deepStrictEqual([shown(), menu("w1")], [true, [...MID, "red Delete workout"]], "skipped"); agree("w1");
  page("tp"); assert.deepStrictEqual([shown(), menu("tp")], [true, ["Move to", "red Delete template"]], "a template: no day to move, and Use for a client is its copy; Move to its place, as its row's swipe (v283)"); agree("tp");
  for (const id of ["w1", "tp"]) assert.ok(fns.moreItems(maps.trainings.get(id)).every((it) => it.icon), "each with its symbol, as every menu of his");
  quiet();
});

test("Copy workout from the \"…\": which client gets it (this one first), then the day in that client's calendar (his ask, 12 Nov), then a copy of the workout as it is now opens; Save as template opens the new template; nothing from a page left behind; the page's foot keeps only Delete workout", async () => {
  let onRow = null; const pl = $("pickList"); pl.addEventListener = (t, f) => { if (t === "click") onRow = f; };
  const bob = () => maps.clients.set("c2", { id: "c2", name: "Bob", unit: "lb" }), pickBob = () => onRow({ target: { closest: () => ({ dataset: { id: "c2" } }) } });
  const item = (label) => fns.moreItems(maps.trainings.get("w1")).find((it) => it.label === label);
  try {
    page("w1"); bob();
    assert.deepStrictEqual([item("Copy workout").icon, item("Save as template").icon], [fns.menuIcons().copy, fns.menuIcons().save], "Copy workout's page over a page; an arrow down into a tray for Save as template");
    $("pickSheet").hidden = true; const p = item("Copy workout").onPick();
    assert.deepStrictEqual([$("pickSheet").hidden, $("pickTitle").textContent], [false, "Copy workout to"], "which client gets it");
    await tick(400);
    pickBob(); await p;
    const dp = fns.datePicker();
    assert.deepStrictEqual([dp && dp.title, dp && dp.clientId, dp && dp.moving, [...maps.trainings.values()].filter((t) => t.clientId === "c2").length], ["Copy to Bob", "c2", null, 0], "then the day, in Bob's calendar; nothing copied yet");
    maps.trainings.set("w1", { ...maps.trainings.get("w1"), title: "Legs and calves" });   // a sync brings a newer copy of the workout while the days are up
    const pick = dp.onPick; fns.closeDatePicker(); pick(day(4));
    const made = [...maps.trainings.values()].filter((t) => t.clientId === "c2"), v = app.get().view;
    assert.deepStrictEqual([made.length, made[0] && made[0].title, made[0] && made[0].date, v.name, v.id], [1, "Legs and calves", day(4), "training", made[0] && made[0].id], "a copy for Bob on the day picked, of the workout as it is now, and it opens");
    page("w1"); const save = item("Save as template"); app.set({ view: { name: "client", id: "c1" } }); save.onPick();
    assert.strictEqual([...maps.trainings.values()].filter((t) => t.clientId === TEMPLATES_ID && t.id !== "tp").length, 0, "a menu from a page left behind saves nothing");
    page("w1"); item("Save as template").onPick();
    const tpl = [...maps.trainings.values()].filter((t) => t.clientId === TEMPLATES_ID && t.id !== "tp"), w = app.get().view;
    assert.deepStrictEqual([tpl.length, tpl[0] && tpl[0].title, w.name, w.id], [1, "Legs", "training", tpl[0] && tpl[0].id], "a new template, and it opens");
    page("w1"); bob(); $("pickSheet").hidden = true; const q = item("Copy workout").onPick();
    await tick(400); app.set({ view: { name: "client", id: "c1" } }); const before = maps.trainings.size; pickBob(); await q;
    assert.deepStrictEqual([maps.trainings.size, fns.datePicker()], [before, null], "Back while the clients were up: no days, nothing copied");
    page("w1"); bob(); const r2 = item("Copy workout").onPick(); await tick(400); pickBob(); await r2;
    const dp2 = fns.datePicker(); app.set({ view: { name: "client", id: "c1" } });
    assert.strictEqual(dp2.ok(), false, "Back while the days were up: they are for nothing now (the picker closes them at its next redraw)");
    const n2 = maps.trainings.size, pick2 = dp2.onPick; fns.closeDatePicker(); pick2(day(4));
    assert.strictEqual(maps.trainings.size, n2, "and nothing is copied");
    for (const [why, gone] of [["Bob deleted on another device", () => maps.clients.delete("c2")], ["the workout deleted on another device", () => maps.trainings.delete("w1")]]) {
      page("w1"); bob(); const r3 = item("Copy workout").onPick(); await tick(400); pickBob(); await r3;
      const dp3 = fns.datePicker(); gone();
      const n3 = maps.trainings.size; assert.strictEqual(dp3.ok(), false, why + " while the days were up: they are for nothing now");
      const pick3 = dp3.onPick; fns.closeDatePicker(); pick3(day(4)); assert.strictEqual(maps.trainings.size, n3, why + ": nothing copied");
    }
    page("w1"); bob(); let focused = 0; const more = $("tMore"), sheetEl = $("pickSheet"); more.hidden = false; more.focus = () => { focused++; document.activeElement = more; }; sheetEl.contains = () => true;
    const r4 = item("Copy workout").onPick(); await tick(400); pickBob(); await r4;
    delete more.focus; delete sheetEl.contains; const back = fns.datePicker().back; fns.datePicker().back = null; document.activeElement = null; fns.closeDatePicker();
    assert.deepStrictEqual([focused, back === more], [1, true], "a keyboard's place back on the \u2026 once the clients' sheet has gone, and the days give it back there (the v284 review)");
  } finally { delete pl.addEventListener; quiet(); }
  assert.ok(!html.includes('id="copyTraining"') && !html.includes('id="saveTemplate"'), "no longer at the page's foot");
  assert.ok(html.includes('<div class="foot stack trainer-only">\n      <button class="btn tint wide soft danger" id="delTraining" type="button">Delete workout</button>\n    </div>'), "the foot keeps the red Delete workout alone");
});

test("the client's \"…\", and the coach's Client view of a workout: the client's Reschedule only, none once it is finished; never Delete", () => {
  page("w1", {}, { client: true }); assert.deepStrictEqual([shown(), menu("w1")], [true, ["Reschedule"]], "the client"); agree("w1");
  page("w1", { completedAt: DONE }, { client: true }); assert.deepStrictEqual([shown(), menu("w1")], [false, []], "the client, finished"); agree("w1");
  page("w1", {}, { preview: true }); assert.deepStrictEqual([shown(), menu("w1")], [true, ["Reschedule"]], "the coach's Client view: what the client sees"); agree("w1");
  page("w1", { completedAt: DONE }, { preview: true }); assert.deepStrictEqual([shown(), menu("w1")], [false, []], "and finished, as the client sees it"); agree("w1");
  page("w1"); app.set({ view: { name: "client", id: "c1" } }); fns.render(); assert.strictEqual(shown(), false, "only on the workout page");
  quiet();
});

test("a sync that changes what the coach's \"…\" offers (a finish, a skip) takes its open menu away; one that changes nothing leaves it", () => {
  for (const stamp of ["completedAt", "skippedAt"]) {
    page("w1"); fns.showMenu($("tMore"), fns.moreItems(maps.trainings.get("w1")), { align: "right" });
    fns.render(); assert.strictEqual($("whenBg").hidden, false, stamp + ": a sync with nothing new leaves it up");
    maps.trainings.get("w1")[stamp] = DONE; fns.render();
    assert.deepStrictEqual([shown(), $("whenBg").hidden], [true, true], stamp + ": the \"…\" stays (Delete), the menu with its Reschedule goes");
  }
  quiet();
});

test("the bar's buttons for the swipe back: the coach's workout and template have the \"…\", a client's finished one has none", () => {
  page("w1"); assert.strictEqual(fns.barFor("training/w1").tMore, true); assert.strictEqual(fns.barFor("training/tp").tMore, true);
  assert.strictEqual(fns.barFor("training/w1|exercise").tMore, false, "not over the exercise's page");
  page("w1", { completedAt: DONE }, { client: true }); assert.strictEqual(fns.barFor("training/w1").tMore, false);
  quiet();
});

test("the coach's Reschedule: the day picker, any day (one gone by too), as his row's; the pick moves the workout", () => {
  page("w1");
  fns.moreItems(maps.trainings.get("w1"))[0].onPick();
  const dp = fns.datePicker();
  assert.ok(dp, "the days are up"); assert.deepStrictEqual({ title: dp.title, min: dp.min, selected: dp.selected }, { title: "Reschedule", min: null, selected: day(1) });
  dp.onPick(day(-2)); fns.closeDatePicker();
  assert.strictEqual(maps.trainings.get("w1").date, day(-2), "moved, to a day gone by too (his own record)");
  assert.strictEqual(maps.pendingMove.has("w1"), false, "an ordinary save, not the client's queued move");
  assert.ok(maps.dirty.has("trainings/w1") && maps.timers.has("trainings/w1"), "queued as his ordinary save");
  assert.ok((maps.trainerState.get("w1") || new Set()).has("date"), "his day: it wins when the save meets a newer server copy");
  page("w1", {}, { client: true });
  fns.moreItems(maps.trainings.get("w1"))[0].onPick();
  assert.strictEqual(typeof fns.datePicker().min, "function", "the client's: from today on, asked at each redraw"); fns.closeDatePicker();
  quiet();
});

test("Delete workout asks first: Cancel keeps it; Delete deletes it and the page goes up to the client's; a template asks as a template", async () => {
  const H = {};
  for (const id of ["askYes", "askNo"]) { const b = el("button"); b.addEventListener = (t, fn) => { (H[id] ||= []).push(fn); }; b.removeEventListener = (t, fn) => { H[id] = (H[id] || []).filter((f) => f !== fn); }; byId.set(id, b); }
  const answer = (id) => { for (const fn of [...(H[id] || [])]) fn({}); };
  try {
    page("w1");
    const del = fns.moreItems(maps.trainings.get("w1")).pop();
    const no = del.onPick();
    assert.deepStrictEqual([$("askSheet").hidden, $("askTitle").textContent, $("askText").textContent], [false, "Delete this workout?", "It goes for good, with everything logged on it."], "the question first");
    answer("askNo"); await no; await tick(0);
    assert.deepStrictEqual([maps.trainings.has("w1"), app.get().view.name, $("askSheet").hidden], [true, "training", true], "Cancel: it stays, and so does the page");
    const yes = fns.askDelete("w1"); await tick(400); answer("askYes");
    assert.strictEqual(await yes, true);
    assert.deepStrictEqual([maps.trainings.has("w1"), app.get().view.name, app.get().view.id], [false, "client", "c1"], "Delete: gone, up to the client's page");
    assert.ok(maps.dirty.has("trainings/w1") && maps.timers.has("trainings/w1"), "the delete is queued for the server");
    page("w1");
    const moved = fns.askDelete("w1"); app.set({ view: { name: "client", id: "c1" } }); fns.render(); await tick(400); answer("askYes");
    assert.strictEqual(await moved, false); assert.ok(maps.trainings.has("w1"), "the page changed while the question was up: Delete deletes nothing from elsewhere");
    page("w1");
    const gone = fns.askDelete("w1"); maps.trainings.delete("w1"); await tick(400); answer("askYes");
    assert.strictEqual(await gone, false, "a sync took it away meanwhile: nothing more to do");
    page("tp");
    const t = fns.askDelete("tp");
    assert.deepStrictEqual([$("askTitle").textContent, $("askText").textContent], ["Delete this template?", "Workouts already made from it stay."]);
    answer("askNo"); assert.strictEqual(await t, false); assert.ok(maps.trainings.has("tp"));
  } finally { byId.delete("askYes"); byId.delete("askNo"); quiet(); }
});

test("the page's own red Delete workout stays, and asks the same question", () => {
  assert.ok(html.includes('<button class="btn tint wide soft danger" id="delTraining" type="button">Delete workout</button>'), "still at the page's foot (his pick: keep it)");
  assert.ok(src.includes('$("delTraining").addEventListener("click", () => { askDelete(S.view.id); });'), "one question for both");
});

test("the client page's tabs: filled, as Apple's tab bars show a symbol that has a filled form (a dumbbell, bars, a page)", () => {
  const svgs = Object.fromEntries(["workouts", "profile", "notes"].map((k) => [k, (html.match(new RegExp('data-tab="' + k + '"[^>]*>(<svg[\\s\\S]*?</svg>)')) || [])[1] || ""]));
  for (const [k, s] of Object.entries(svgs)) {
    assert.match(s, /^<svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"( fill-rule="evenodd")?>/, k + ": filled");
    assert.ok(!/stroke/.test(s), k + ": no outlines");
  }
  assert.strictEqual((svgs.workouts.match(/<path /g) || []).length, 1, "the dumbbell: one shape of five parts");
  assert.strictEqual((svgs.workouts.match(/Z/g) || []).length, 5, "two plates each side and the bar");
  assert.strictEqual((svgs.profile.match(/Z/g) || []).length, 3, "three bars");
  assert.match(svgs.notes, /fill-rule="evenodd"/, "the page with its corner and lines cut out");
  assert.ok(html.includes("#tabbar button svg { width: 22px; height: 22px; overflow: visible; }"), "the dumbbell and the bars a little wider than the box, as Apple draws them");
});

// His ask, 12 Nov: "add to my coaches setting a toggle where I can switch in what view workouts open automatically ... coach and client ... I
// want to be able to set it so even from coaches profile when I open a workout it automatically opens in clients view ... that obviously doesnt
// apply when I am creating a brand new workout". His picks: the Coach | Client control, as Appearance's, kept on each device.
test("Open workouts in: Coach | Client in his Settings, kept on this device; a workout he opens comes up in the view set there, a brand-new one as the coach; the page's own switch still flips the one open; never a template, never the client's own app", async () => {
  const opened = (id) => { fns.go({ name: "training", id }); return fns.previewOn(); };
  const onPage = () => { app.set({ view: { name: "client", id: "c1" } }); fns.render(); };
  assert.ok(html.includes('<li class="trainer-only"><div class="srow wrap"><span>Open workouts in</span><div class="seg" id="openSeg" role="radiogroup" aria-label="Open workouts in"><button type="button" role="radio" data-open="coach" class="on">Coach</button><button type="button" role="radio" data-open="client">Client</button></div></div></li>'), "under Appearance, the same kind of control, the coach's only");
  assert.ok(html.includes("\n  body.client .settings-list li.trainer-only:first-child + li { border-top: 0; }"), "the client's Settings: only the hidden top row (My number) takes the line under it away; the new one, hidden between Appearance and Change password, leaves theirs (the v284 review)");
  try {
    page("w1"); onPage();
    const b1 = el("button"), b2 = el("button"); b1.dataset.open = "coach"; b2.dataset.open = "client"; $("openSeg").querySelectorAll = () => [b1, b2];
    assert.deepStrictEqual([fns.openAs(), opened("w1")], ["coach", false], "as before until he sets it");
    fns.setOpenAs("client");
    assert.deepStrictEqual([fns.openAs(), JSON.parse(localStorage.getItem("fiala.openAs"))], ["client", "client"], "kept on this device");
    assert.deepStrictEqual([b1.classList.contains("on"), b2.classList.contains("on")], [false, true], "the control shows it");
    onPage(); assert.strictEqual(opened("w1"), true, "a workout of hers he opens: as the client sees it");
    assert.ok(document.body.classList.contains("client"), "drawn in the client's look");
    fns.setPreview(false); assert.strictEqual(opened("w1"), false, "switched to Coach on its page: the same workout drawn again stays so");
    onPage(); assert.strictEqual(opened("w1"), true, "opened again later: as set");
    onPage(); fns.addTraining("c1", { title: "Arms", rows: [] }, day(3)); const made = [...maps.trainings.values()].find((t) => t.clientId === "c1" && t.date === day(3));   // (named: an empty one left behind would be tidied away)
    assert.deepStrictEqual([app.get().view, fns.previewOn()], [{ name: "training", id: made.id }, false], "a brand-new one (the +, a day tapped, a copy, a template used): as the coach, to fill it in");
    onPage(); assert.strictEqual(opened(made.id), true, "and the next time it is opened, as set");
    onPage(); fns.addTraining("c1", { title: "Back day", rows: [] }, day(5)); const nw = app.get().view.id;
    fns.fromTemplate(maps.trainings.get(nw)); await tick(); await fns.goBackNow(); await tick();
    assert.deepStrictEqual([app.get().view, fns.previewOn()], [{ name: "training", id: nw }, false], "Back from choosing a template for a new one: still being made, as the coach (the v284 review)");
    const W = { name: "training", id: "w1" };
    assert.deepStrictEqual([fns.firstPreview("1", W), fns.firstPreview("0", W), fns.firstPreview(null, W), fns.firstPreview(null, { name: "training", id: "tp" }), fns.firstPreview(null, { name: "client", id: "c1" })], [true, false, true, false, false], "a workout page opened anew: this tab's own view on a reload, else (a new session) the one set in Settings; never a template, nor another page");
    assert.ok(src.includes("    try { previewClient = firstPreview(sessionStorage.getItem(PREVIEW_KEY), S.view); } catch (_) {}"), "the app asks it for the page it opens on");
    const ss = new Map(); globalThis.sessionStorage = { getItem: (k) => (ss.has(k) ? ss.get(k) : null), setItem: (k, v) => { ss.set(k, String(v)); }, removeItem: (k) => { ss.delete(k); } };
    try {
      onPage(); opened("w1"); const kept1 = ss.get("fiala.preview");
      fns.setOpenAs("coach"); onPage(); opened("w1"); const kept0 = ss.get("fiala.preview"); fns.setOpenAs("client");
      assert.deepStrictEqual([kept1, kept0, fns.firstPreview(kept0, W)], ["1", "0", false], "this tab keeps the view the workout came up in, a Coach one too: a reload keeps it, whatever Settings say");
    } finally { delete globalThis.sessionStorage; }
    assert.strictEqual(opened("tp"), false, "a template has no client's view");
    fns.setOpenAs("coach"); onPage();
    assert.strictEqual(opened("w1"), false, "set back to Coach");
    page("w1", {}, { client: true }); fns.setOpenAs("client"); app.set({ view: { name: "client", id: "c1" } });
    assert.strictEqual(opened("w1"), false, "the client's own app is the client's already");
  } finally { fns.setOpenAs("coach"); localStorage.removeItem("fiala.openAs"); fns.setPreview(false); delete $("openSeg").querySelectorAll; }
  quiet();
});
