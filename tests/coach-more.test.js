// His ask, 10 Nov: "add the three dot button in the right top corner to coaches view too but in coaches view it will also have the option to
// delete workout". His picks: Reschedule (any day, as his row's) and, last and red, Delete workout, which asks first; a finished or skipped
// workout shows only Delete, a template only Delete template; the red Delete workout at the page's foot stays. The client's "…" (and the
// coach's Client view of a workout) keeps the client's Reschedule, from today on. And the client page's tabs are filled (his pick: B, a
// dumbbell, bars, a page; traced to Apple's dumbbell.fill, chart.bar.fill and doc.text.fill).
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

test("the coach's own view: the \"…\" on every workout and template; Reschedule while it is still to do; last and red, Delete", () => {
  page("w1"); assert.deepStrictEqual([shown(), menu("w1")], [true, ["Reschedule", "red Delete workout"]], "still to do"); agree("w1");
  page("w1", { completedAt: DONE }); assert.deepStrictEqual([shown(), menu("w1")], [true, ["red Delete workout"]], "finished: nothing to reschedule"); agree("w1");
  page("w1", { skippedAt: DONE }); assert.deepStrictEqual([shown(), menu("w1")], [true, ["red Delete workout"]], "skipped"); agree("w1");
  page("tp"); assert.deepStrictEqual([shown(), menu("tp")], [true, ["red Delete template"]], "a template: no day to move"); agree("tp");
  assert.ok(fns.moreItems(maps.trainings.get("tp")).every((it) => it.icon), "each with its symbol, as every menu of his");
  quiet();
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
