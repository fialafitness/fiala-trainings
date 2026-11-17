// The rest of the Progress tab (v311; the owner's "So the rest", 16 Nov 2026, after the pictures of these parts): Attendance (both views: the owner's pick,
// clients see their attendance), Getting stronger, New bests and the Bests page, Sessions, the coach's Discomfort note, and a lift's own page.
// The counts first (model.js, on pinned days), then the cards and pages on a clock pinned at noon on Monday 16 Nov 2026, the day of the pictures.
import fs from "node:fs";
import { test, assert } from "./assert.js";
import { load } from "./load.js";
import { attendance, liftsOf, bestOf, gainOf, strongerLifts, monthBests, discomforts, inPersonCount, nextPlan } from "../app/model.js";
import { squash } from "../app/util.js";
const app = await load();
const { fns, maps } = app;
const $ = (id) => document.getElementById(id);
const tick = (ms = 10) => new Promise((r) => setTimeout(r, ms));
const quiet = () => { for (const t of maps.timers.values()) clearTimeout(t); maps.timers.clear(); fns.setPreview(false); };
const at = (d) => new Date(d + "T12:00:00").toISOString();
const T0 = "2026-11-16";                                               // a Monday: the 4 weeks before it are 19 Oct to 15 Nov
const row = (name, weights, reps, more = {}) => ({ id: name + weights.join("") + reps.join(""), name, reps: "10", sets: Math.max(weights.length, reps.length, 1), weights, repsDone: reps, setsDone: Math.max(weights.length, reps.length), done: true, unit: "lb", ...more });
const done = (id, d, rows, more = {}) => ({ id, clientId: "c1", title: "Lower body", date: d, createdAt: at(d), completedAt: at(d), skippedAt: null, rows, ...more });
const canon = (x) => squash(x);

// the made-up client of the pictures: a goblet squat from 30 Sep (before reps were logged: its weight alone) to today, a push-up, a plank, a deadlift once in kg
const sessions = () => [
  done("w1", "2026-09-30", [row("Goblet squat", ["25", "25", "25"], [])], { title: "Full body", inPerson: true }),
  done("w2", "2026-10-09", [row("Goblet squat", ["30", "30", "30"], ["10", "10", "10"]), row("Push-up", [], ["10", "10"]), row("Romanian deadlift", ["65"], ["10"])], { inPerson: true }),
  done("w3", "2026-10-19", [row("Goblet squat", ["35", "35", "35"], ["10", "10", "10"]), row("Plank", [], ["30"], { reps: "45 sec" })], { inPerson: true }),
  done("w4", "2026-11-09", [row("Goblet squat", ["35", "35", "35"], ["10", "10", "10"]), row("Push-up", [], ["12", "12"])], { inPerson: true }),
  done("w6", "2026-11-13", [row("Romanian deadlift", ["30"], ["10"], { unit: "kg" })]),
  done("w5", T0, [row("Goblet squat", ["35", "40", "40"], ["10", "10", "10"]), row("Plank", [], ["60"], { reps: "45 sec" })], { inPerson: true }),
  { id: "later", clientId: "c1", title: "Lower body", date: "2026-11-18", createdAt: at(T0), completedAt: null, skippedAt: null, rows: [row("Goblet squat", ["50"], [], { setsDone: 0, done: false })] },   // planned with a weight typed in, nothing done: not a session
];

test("Attendance: the 4 whole weeks before this one, finished of all but the still planned (a past one never done is missed), the skips' reasons, in person or on their own", () => {
  const list = [
    done("f1", "2026-10-19", [], { inPerson: true }), done("f2", "2026-10-21", []),
    { id: "s1", clientId: "c1", title: "Legs", date: "2026-10-23", createdAt: at("2026-10-01"), completedAt: null, skippedAt: at("2026-10-23"), skipReason: "Travelling", rows: [] },
    { id: "m1", clientId: "c1", title: "Legs", date: "2026-10-30", createdAt: at("2026-10-01"), completedAt: null, skippedAt: at("2026-11-07"), missed: true, rows: [] },
    { id: "n1", clientId: "c1", title: "Legs", date: "2026-11-02", createdAt: at("2026-10-01"), completedAt: null, skippedAt: null, rows: [] },
    { id: "e1", clientId: "c1", title: "", date: "2026-11-04", createdAt: at("2026-10-01"), completedAt: null, skippedAt: null, rows: [] },   // an empty workout: nothing
    done("old", "2026-10-18", []), { id: "p1", clientId: "c1", title: "Legs", date: T0, createdAt: at("2026-10-01"), completedAt: null, skippedAt: null, rows: [] },
  ];
  const a = attendance(list, T0);
  assert.deepStrictEqual([a.from, a.to, a.finished, a.skipped, a.missed, a.pct], ["2026-10-19", "2026-11-15", 2, 1, 2, 40]);
  assert.deepStrictEqual([a.reasons, a.missedDays, a.inPerson, a.onOwn], [{ Travelling: 1 }, ["2026-10-30", "2026-11-02"], 1, 1]);
  const twice = attendance([...list, { id: "n2", clientId: "c1", title: "Arms", date: "2026-11-02", createdAt: at("2026-10-01"), completedAt: null, skippedAt: null, rows: [] }], T0);
  assert.deepStrictEqual([twice.missed, twice.missedDays], [3, ["2026-10-30", "2026-11-02"]], "two missed on one day name it once (the v311 review)");
  assert.strictEqual(attendance([], T0).pct, null, "nothing in the weeks: no card");
});

test("the lifts: each exercise's sessions, oldest first, its top set by the card's rules, and a new best where the card says NEW BEST", () => {
  const L = liftsOf(sessions(), canon, T0, "lb"), g = L.get("gobletsquat");
  assert.deepStrictEqual(g.points.map((p) => [p.date, p.top.w, p.top.rp, p.gold]), [["2026-09-30", 25, null, false], ["2026-10-09", 30, 10, true], ["2026-10-19", 35, 10, true], ["2026-11-09", 35, 10, false], [T0, 40, 10, true]], "a planned one with nothing done is not a session");
  const ahead = liftsOf([...sessions(), done("ahead", "2026-11-18", [row("Goblet squat", ["45"], ["10"])], { completedAt: null })], canon, T0, "lb").get("gobletsquat");
  assert.deepStrictEqual(ahead.points.slice(-1).map((p) => [p.date, p.top.w, p.gold]), [["2026-11-18", 45, true]], "sets logged in a workout ahead of its day count, as on the card's Best and the Look up (the v311 review)");
  assert.deepStrictEqual(g.points[4].sets.map((s) => s.w + "x" + s.rp), ["35x10", "40x10", "40x10"]);
  assert.deepStrictEqual([L.get("plank").kind, L.get("plank").tunit, L.get("plank").points.map((p) => p.top.rp)], ["time", "sec", [30, 60]]);
  const d = L.get("romaniandeadlift"); assert.deepStrictEqual([d.points[1].top.u, d.points[1].gold], ["kg", true], "30 kg is more than 65 lb");
  assert.strictEqual(bestOf(g).date, T0);
  const tie = { timed: false, points: [{ date: "2026-11-02", top: { w: 61.2, rp: 5, u: "kg" } }, { date: "2026-11-09", top: { w: 135, rp: 5, u: "lb" } }] };
  assert.deepStrictEqual([bestOf(tie).top.w, bestOf(tie).top.u], [135, "lb"], "the card's Best: of the same set in two units the heavier, 135 lb, never 134.9 (the v311 review)");
  const again = liftsOf([...sessions(), done("rep", "2026-11-18", [row("Goblet squat", ["40", "40"], ["10", "10"])])], canon, T0, "lb").get("gobletsquat");
  assert.deepStrictEqual([bestOf(again).top.w, bestOf(again).date], [40, T0], "a best matched again later keeps the day it was set (the v311 check: a repeated top set read Today)");
  const twice = liftsOf([done("t1", "2026-11-02", [row("Dumbbell bench press", ["11.3"], ["10"], { unit: "kg" }), row("Dumbbell bench press", ["11.25"], ["12"], { unit: "kg" })]), done("t2", "2026-11-09", [row("Dumbbell bench press", ["25", "25"], ["8", "8"])])], canon, T0, "lb").get("dumbbellbenchpress");
  assert.deepStrictEqual([bestOf(twice).top.w, bestOf(twice).top.rp], [11.25, 12], "an exercise twice in one workout: every row folded, as the card's Best (the band is not transitive)");
  const mins = liftsOf([done("h1", "2026-11-02", [row("Plank", [], ["100"], { reps: "60 sec" })]), done("h2", "2026-11-09", [row("Plank", [], ["1.67"], { reps: "2 min" })])], canon, T0, "lb").get("plank");
  assert.deepStrictEqual([mins.tunit, mins.points.map((p) => [p.top.rp, p.gold])], ["min", [[1.67, false], [1.67, false]]], "holds in the newest plan's unit, rounded as the card rounds them: 100 sec is 1.67 min, no new best");
});

test("Getting stronger: done in the last 8 weeks and better than the first time, the most done first; New bests: this month's, one an exercise, newest first", () => {
  const L = liftsOf(sessions(), canon, T0, "lb");
  assert.deepStrictEqual(strongerLifts(L, T0).map((x) => x.e.name + " " + x.recent), ["Goblet squat 5", "Plank 2", "Romanian deadlift 2", "Push-up 2"]);
  assert.deepStrictEqual(monthBests(L, T0).map((x) => x.e.name + " " + x.p.date), ["Goblet squat " + T0, "Plank " + T0, "Romanian deadlift 2026-11-13", "Push-up 2026-11-09"]);
  assert.deepStrictEqual(strongerLifts(L, "2027-03-01"), [], "nothing done for 8 weeks: nothing listed");
  const same = liftsOf([done("o1", "2026-09-30", [row("Goblet squat", ["25", "25"], [])]), done("o2", "2026-11-09", [row("Goblet squat", ["25", "25"], ["8", "8"])])], canon, T0, "lb");
  assert.deepStrictEqual(strongerLifts(same, T0), [], "the same weight as before reps were logged is not stronger (the v311 review)");
  const day = liftsOf([done("y1", T0, [row("Goblet squat", ["25"], ["10"])]), done("y2", T0, [row("Goblet squat", ["30"], ["10"])], { createdAt: at(T0).replace("12:", "13:") })], canon, T0, "lb");
  assert.deepStrictEqual(strongerLifts(day, T0), [], "two sessions on one day are no first time to grow from");
  assert.deepStrictEqual(L.get("gobletsquat") && strongerLifts(L, T0)[0].gain.by, "weight");
});

test("what grew: a hold longer, a carry farther, heavier past the band (no weight is none added), more reps only when both sets have reps; else nothing", () => {
  const lb = (w, rp) => ({ w, rp, u: "lb" });
  assert.deepStrictEqual(gainOf(lb(null, 15), lb(10, 8), "reps"), { by: "weight", d: 10 * 0.45359237 }, "from bodyweight to 10 lb added");
  assert.strictEqual(gainOf(lb(10, 8), lb(null, 15), "reps"), null, "dropping the weight is not stronger, whatever the reps");
  assert.strictEqual(gainOf(lb(25, null), lb(25, 8), "reps"), null);
  assert.deepStrictEqual(gainOf(lb(25, 8), lb(25, 10), "reps"), { by: "reps", d: 2 });
  assert.strictEqual(gainOf({ w: 61.2, rp: 5, u: "kg" }, lb(135, 5), "reps"), null, "the same weight in two units");
  assert.deepStrictEqual([gainOf(lb(null, 30), lb(null, 45), "time").by, gainOf(lb(40, 30), lb(40, 40), "m").by, gainOf(lb(40, 30), lb(50, 30), "m").by], ["time", "dist", "weight"]);
  assert.strictEqual(gainOf(lb(50, 30), lb(40, 30), "m"), null);
});

test("Discomfort: an exercise cut short for it on two days within 4 weeks; a complete one, an older one or one day alone is not", () => {
  const cut = (d, setsDone, more = {}) => done("d" + d + setsDone, d, [row("Push-up", [], [], { sets: 3, setsDone, earlyReason: "Discomfort", ...more })]);
  assert.deepStrictEqual(discomforts([cut("2026-11-04", 1), cut("2026-11-11", 1), cut("2026-11-12", 3)], canon, T0), [{ key: "pushup", name: "Push-up", days: ["2026-11-04", "2026-11-11"], skipped: false, early: true }]);
  assert.deepStrictEqual(discomforts([cut("2026-10-10", 1), cut("2026-11-11", 0)], canon, T0), [], "one is older than 4 weeks");
  assert.deepStrictEqual(discomforts([cut("2026-11-11", 3), cut("2026-11-12", 3)], canon, T0), [], "a stale reason on complete rows");
  assert.deepStrictEqual(discomforts([cut("2026-11-10", 0), cut("2026-11-12", 0)], canon, T0)[0].skipped, true);
});

test("Sessions: the finished workouts marked In person, counted from the first", () => {
  assert.deepStrictEqual(inPersonCount(sessions(), T0), { n: 5, since: "2026-09-30" });
  assert.deepStrictEqual(inPersonCount([], T0), { n: 0, since: "" });
});

// ---- the cards and pages, on the pictures' day
const Real = Date, FIXED = new Real(2026, 10, 16, 12).getTime();
class Pinned extends Real { constructor(...a) { if (a.length) super(...a); else super(FIXED); } static now() { return FIXED; } }
const pinned = async (fn) => { globalThis.Date = Pinned; try { return await fn(); } finally { globalThis.Date = Real; quiet(); } };
const setup = (clientMode = false, extra = []) => {
  app.reset(); app.set({ signedIn: true, clientMode, myClientId: clientMode ? "c1" : null, view: { name: "client", id: "c1" }, tab: "profile" });
  maps.clients.set("c1", { id: "c1", name: "jane Doe", unit: "lb", plan: { id: "p", name: "10 sessions", kind: "sessions", size: 10, startedOn: "2026-09-01", adjust: 8 } });
  for (const t of [...sessions(), ...extra]) maps.trainings.set(t.id, t);
  fns.render(); quiet();
};
const scroller = () => {
  const s = { ys: [], put: (y) => { globalThis.scrollY = y; } }, real = globalThis.scrollTo;
  globalThis.scrollTo = (x, y) => { s.ys.push(y); globalThis.scrollY = y; };
  s.done = () => { globalThis.scrollTo = real; globalThis.scrollY = 0; fns.leaveSettings(); quiet(); };
  return s;
};
const page = () => { try { return JSON.parse(localStorage.getItem("fiala.trainings.page")); } catch (_) { return null; } };
const ENT = { "&rsaquo;": "›", "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'" };
const text = (h) => String(h).replace(/<svg[\s\S]*?<\/svg>/g, "").replace(/<[^>]+>/g, "|").replace(/\|+/g, "|").replace(/&\w+;|&#39;/g, (m) => ENT[m] || m);   // the words a person reads, each piece between bars
const discomfort = [done("x1", "2026-11-04", [row("Push-up", [], ["8"], { sets: 3, setsDone: 1, earlyReason: "Discomfort" })], { title: "Upper body" }), done("x2", "2026-11-11", [row("Push-up", [], ["6"], { sets: 3, setsDone: 1, earlyReason: "Discomfort" })], { title: "Upper body" })];

test("the coach's view: the Discomfort note on top, Attendance, Getting stronger in the client's first name (no he or she), New bests, Sessions with the package", () => pinned(() => {
  setup(false, discomfort);
  assert.strictEqual(text($("pgNotes").innerHTML), "|Discomfort twice on Push-up|Finished it early on Nov 4 and Nov 11|›|");
  assert.strictEqual($("pgAttend").hidden, false);
  assert.strictEqual(text($("pgAttend").innerHTML), "|Attendance|Last 4 weeks|100%|of planned workouts|5|finished|In person\u00a02 · On their own\u00a03|", "the five of the 4 weeks, each finished; In person inside the bar, the longest");
  assert.ok(/<span class="pg-bar done" style="--w:100\.0%"><span>In person\u00a02/.test($("pgAttend").innerHTML));
  assert.deepStrictEqual([$("pgStrongCap").hidden, $("pgStrong").hidden, $("pgStrong").dataset.key], [false, false, "gobletsquat"]);
  assert.strictEqual(text($("pgStrong").innerHTML), "|Goblet squat|›|Jane is lifting 15 lb more than the first time, Sep 30.|40 lb × 10|Today|25 lb|Sep 30|");
  assert.ok(/class="pg-bar now" style="--w:100\.0%"/.test($("pgStrong").innerHTML) && /class="pg-bar then" style="--w:62\.5%"/.test($("pgStrong").innerHTML), "the bars as long as their weights");
  assert.strictEqual(text($("pgStrongList").innerHTML), "|Plank|from 30 sec|60 sec|›|Romanian deadlift|from 65 lb × 10|66.1 lb × 10|›|", "the rest, each from its first time to its latest (the push-up, cut short twice since its best, is not getting stronger)");
  assert.strictEqual(text($("pgBests").innerHTML), "|New bests|November|4|this month|Goblet squat|Today|40 lb × 10|›|Plank|Today|60 sec|›|Romanian deadlift|Fri, Nov 13|66.1 lb × 10|›|All bests|›|", "four this month, the three newest shown");
  assert.strictEqual(text($("pgSessions").innerHTML), "|Sessions|Package 2|13|with you|This package: 3 of 10|", "8 before the app and 5 in it: the 13th, the 3rd of package 2 (the number the package's own, its correction included: the v311 check)");
  assert.ok(!/\b(he|she|his|her|him)\b/i.test(text($("pgStrong").innerHTML + $("pgAttend").innerHTML + $("pgSessions").innerHTML)));
}));

test("the client's own app: no Discomfort note, You’re … than on your first time (the picture's words), On your own, with your coach", () => pinned(() => {
  setup(true, discomfort);
  assert.strictEqual($("pgNotes").innerHTML, "", "the coach's alone");
  assert.ok(text($("pgStrong").innerHTML).includes("|You’re lifting 15 lb more than on your first time, Sep 30.|"));
  assert.ok(text($("pgAttend").innerHTML).includes("|In person\u00a02 · On your own\u00a03|"));
  assert.ok(text($("pgSessions").innerHTML).includes("|13|with your coach|"));
}));

test("missed and skipped in Attendance: their bars as long as their counts, the reason and the missed day named; In person under a bar too short to hold it", () => pinned(() => {
  const skip = (id, d, why, missed) => ({ id, clientId: "c1", title: "Legs", date: d, createdAt: at("2026-10-01"), completedAt: null, skippedAt: at(d), skipReason: why, missed, rows: [] });
  setup(false, [skip("k1", "2026-10-26", "Travelling"), skip("k2", "2026-10-27", "Travelling"), skip("k3", "2026-10-28", "Sick"), skip("k4", "2026-10-29", null, true), skip("k5", "2026-10-30", null, true), skip("k6", "2026-10-31", null, true), skip("k7", "2026-11-01", null, true), skip("k8", "2026-11-03", null, true), skip("k9", "2026-11-05", null, true)]);
  const h = $("pgAttend").innerHTML;
  assert.strictEqual(text(h), "|Attendance|Last 4 weeks|25%|of planned workouts|3|finished|In person\u00a02 · On their own\u00a01|3|skipped · Travelling\u00a02, Sick|6|missed|", "the commonest reason first");
  assert.deepStrictEqual([...h.matchAll(/pg-bar (\w+)" style="--w:([\d.]+)%"/g)].map((m) => m[1] + " " + m[2]), ["done 50.0", "skip 50.0", "miss 100.0"]);
  assert.ok(/<span class="pg-sub">In person\u00a02/.test(h), "under the finished bar: it is not the longest");
}));

test("words a person typed are escaped: an exercise's name never becomes markup", () => pinned(() => {
  setup(false, [done("evil", "2026-11-14", [row('<img src=x onerror="alert(1)">', ["10"], ["10"])])]);
  const all = $("pgBests").innerHTML + $("pgStrongList").innerHTML;
  assert.ok(!all.includes("<img"), "no tag"); fns.showBests(); assert.ok(!$("bestsList").innerHTML.includes("<img") && $("bestsList").innerHTML.includes("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;"));
  fns.leaveSettings();
}));

test("All bests opens the Bests page over the client's page: each exercise's best and the day it first reached it, newest first; the box finds one; Back lands the Progress tab where it was", () => pinned(async () => {
  setup(); const sc = scroller();
  try {
    sc.put(420); fns.openBests(); await tick();
    assert.deepStrictEqual([fns.settingsPage(), $("vBests").hidden, $("vClient").hidden, page()], [{ open: "bests", from: false }, false, true, { open: "bests", from: false }]);
    assert.strictEqual(text($("bestsList").innerHTML), "|Goblet squat|Today|40 lb × 10|›|Plank|Today|60 sec|›|Romanian deadlift|Fri, Nov 13|66.1 lb × 10|›|Push-up|Mon, Nov 9|12 reps|›|");
    $("bestsFind").value = "squat"; fns.paintBests(); assert.strictEqual(text($("bestsList").innerHTML), "|Goblet squat|Today|40 lb × 10|›|");
    $("bestsFind").value = "row"; fns.paintBests(); assert.deepStrictEqual([$("bestsList").hidden, $("bestsEmpty").hidden, $("bestsEmpty").textContent], [true, false, "No exercise by that name yet."]);
    fns.render(); assert.deepStrictEqual([$("vBests").hidden, $("vPassword").hidden], [false, true], "a sync's redraw keeps it");
    await fns.goBackNow(); await tick();
    assert.deepStrictEqual([$("vBests").hidden, $("vClient").hidden, fns.settingsPage().open, app.get().tab, sc.ys[sc.ys.length - 1]], [true, false, false, "profile", 420]);
    sc.put(0); fns.openBests(); assert.strictEqual($("bestsFind").value, "", "opened anew: every exercise again");
  } finally { sc.done(); }
}));

test("a lift's own page: from the Progress tab Back lands there; from Bests Back lands Bests where it was; a reload reopens it; its client gone, it leaves", () => pinned(async () => {
  setup(); const sc = scroller();
  try {
    sc.put(300); fns.openLift("gobletsquat", false); await tick();
    assert.deepStrictEqual([fns.settingsPage(), fns.liftPage(), $("vLift").hidden, $("backLabel").textContent], [{ open: "lift", from: false }, { key: "gobletsquat", name: "Goblet squat" }, false, "Back"]);
    assert.deepStrictEqual([$("liftName").textContent, $("liftBest").textContent, $("liftDates").textContent], ["Goblet squat", "40 lb × 10", "Sep 30 – Nov 16, 2026"]);
    assert.strictEqual(text($("liftList").innerHTML), "|Today · Lower body|35 lb × 10 · 40 lb × 10 · 40 lb × 10|Mon, Nov 9 · Lower body|35 lb × 10 · 35 lb × 10 · 35 lb × 10|Mon, Oct 19 · Lower body|35 lb × 10 · 35 lb × 10 · 35 lb × 10|Fri, Oct 9 · Lower body|30 lb × 10 · 30 lb × 10 · 30 lb × 10|Wed, Sep 30 · Full body|25 lb · 25 lb · 25 lb|", "every session, newest first; before reps were logged, the weights alone");
    assert.deepStrictEqual([page(), $("liftKey").hidden, $("liftKeyText").textContent], [{ open: "lift", from: false, name: "Goblet squat", key: "gobletsquat" }, false, "New best: heavier, or more reps"]);
    await fns.goBackNow(); await tick();
    assert.deepStrictEqual([fns.settingsPage().open, $("vClient").hidden, sc.ys[sc.ys.length - 1]], [false, false, 300]);
    sc.put(500); fns.openBests(); sc.put(140); fns.openLift("plank", "bests"); await tick();
    assert.deepStrictEqual([fns.settingsPage(), $("backLabel").textContent, $("liftBest").textContent, fns.subPlace()], [{ open: "lift", from: "bests" }, "Bests", "60 sec", 140]);
    await fns.goBackNow(); await tick();
    assert.deepStrictEqual([fns.settingsPage(), $("vBests").hidden, sc.ys[sc.ys.length - 1]], [{ open: "bests", from: false }, false, 140], "Bests, where it was");
    await fns.goBackNow(); await tick();
    assert.deepStrictEqual([fns.settingsPage().open, sc.ys[sc.ys.length - 1]], [false, 500], "then the Progress tab, where it was");
    fns.openLift("gobletsquat", false); maps.clients.delete("c1"); fns.render();
    assert.notStrictEqual(fns.settingsPage().open, "lift", "the client gone: off the page"); assert.strictEqual($("vLift").hidden, true);
  } finally { sc.done(); }
}));

test("a lift's chart: about four lines at round weights, a dot each time (a new best's filled), the line drawn by its class, the months named", () => pinned(() => {
  const L = liftsOf(sessions(), canon, T0, "lb"), h = fns.liftChart(L.get("gobletsquat"), "lb");
  assert.deepStrictEqual([...h.matchAll(/class="yl"[^>]*>([^<]+)</g)].map((m) => m[1]), ["25 lb", "30 lb", "35 lb", "40 lb"]);
  assert.deepStrictEqual([(h.match(/class="pt"/g) || []).length, (h.match(/class="pt best"/g) || []).length], [2, 3]);
  assert.deepStrictEqual([...h.matchAll(/class="xl"[^>]*>([^<]+)</g)].map((m) => m[1]), ["Oct", "Nov"]);
  assert.ok(/<polyline points="[^"]+" class="ln"/.test(h) && !/stroke="var\(/.test(h), "a var() in an SVG attribute is not read everywhere");
  assert.deepStrictEqual([...fns.liftChart(L.get("plank"), "lb").matchAll(/class="yl"[^>]*>([^<]+)</g)].map((m) => m[1]).slice(-1), ["60 sec"]);
  const long = { kind: "reps", points: Array.from({ length: 20 }, (_, k) => ({ date: fns.localIso(new Real(2025, k, 3, 12)), top: { w: 20 + k, rp: 10, u: "lb" }, gold: true })) };
  assert.ok([...fns.liftChart(long, "lb").matchAll(/class="xl"/g)].length <= 6, "a long span names about six months, never one into the next");
}));

test("after the review: a weight typed far too big draws a few lines, not thousands; one day's sessions read as that day; a part of a minute reads in seconds; the bars measure what grew", () => pinned(() => {
  const typo = { kind: "reps", points: [{ date: "2026-11-02", top: { w: 25, rp: 10, u: "lb" }, gold: false }, { date: "2026-11-09", top: { w: 40000000, rp: 10, u: "lb" }, gold: true }] };
  const h = fns.liftChart(typo, "lb"); assert.ok((h.match(/class="gl/g) || []).length <= 5 && h.length < 5000, "lines: " + (h.match(/class="gl/g) || []).length);
  const flat = fns.liftChart({ kind: "reps", points: [{ date: "2026-11-02", top: { w: 40, rp: 10, u: "lb" }, gold: false }, { date: "2026-11-09", top: { w: 40, rp: 10, u: "lb" }, gold: false }] }, "lb");
  assert.deepStrictEqual([...flat.matchAll(/class="yl"[^>]*>([^<]+)</g)].map((m) => m[1]), ["30 lb", "40 lb", "50 lb"], "equal weights: the line in the middle of round values");
  setup(false, [done("am", T0, [row("Lunge", ["20"], ["10"])], { createdAt: "2026-11-16T17:00:00.000Z" }), done("pm", T0, [row("Lunge", ["25"], ["10"])], { createdAt: "2026-11-16T23:00:00.000Z" })]);
  fns.showLift("lunge", false); assert.strictEqual($("liftDates").textContent, "Mon, Nov 16", "never Nov 16–16"); fns.leaveSettings();
  setup(false, [done("p1", "2026-11-02", [row("Side plank", [], ["1.5"], { reps: "2 min" })]), done("p2", "2026-11-09", [row("Side plank", [], ["2"], { reps: "2 min" })])]);
  fns.showLift("sideplank", false); assert.deepStrictEqual([$("liftBest").textContent, text($("liftList").innerHTML)], ["2 min", "|Mon, Nov 9 · Lower body|2 min|Mon, Nov 2 · Lower body|90 sec|"], "as the card writes them"); fns.leaveSettings();
  setup(false); maps.trainings.clear(); for (const t of [done("b1", "2026-10-21", [row("Pull-up", [], ["15"])]), done("b2", "2026-11-11", [row("Pull-up", ["10"], ["8"])])]) maps.trainings.set(t.id, t); fns.render(); quiet();
  assert.strictEqual(text($("pgStrong").innerHTML), "|Pull-up|›|Jane is lifting 10 lb more than the first time, Oct 21.|10 lb × 8|Wed, Nov 11|15 reps|Oct 21|", "from bodyweight to 10 lb added");
  assert.deepStrictEqual([...$("pgStrong").innerHTML.matchAll(/pg-bar (\w+)" style="--w:([\d.]+)%"/g)].map((m) => m[1] + " " + m[2]), ["now 100.0", "then 12.0"], "the bars measure the weight the sentence speaks of, not the reps (the v311 review)");
}));

test("after the second review: every tap that opens a lift carries its name (an exercise never logged is titled by its name, not its key); bars never cut their words; the axis has room", () => pinned(() => {
  const skipped = (id, d) => done(id, d, [row("Bulgarian split squat", [], [], { sets: 3, setsDone: 0, earlyReason: "Discomfort" })], { title: "Legs" });
  setup(false, [skipped("q1", "2026-11-04"), skipped("q2", "2026-11-11")]);
  assert.ok(/data-key="bulgariansplitsquat" data-name="Bulgarian split squat"/.test($("pgNotes").innerHTML));
  fns.pgTap({ target: { closest: () => ({ dataset: { key: "bulgariansplitsquat", name: "Bulgarian split squat" } }) } });
  assert.deepStrictEqual([fns.settingsPage().open, $("liftName").textContent, $("liftBest").textContent, fns.liftPage()], ["lift", "Bulgarian split squat", "Nothing logged yet", { key: "bulgariansplitsquat", name: "Bulgarian split squat" }]);
  assert.strictEqual(JSON.parse(localStorage.getItem("fiala.trainings.page")).name, "Bulgarian split squat", "a reload titles it the same");
  fns.leaveSettings();
  assert.ok(/data-key="gobletsquat" data-name="Goblet squat"/.test($("pgBests").innerHTML) && $("pgStrong").dataset.name === "Goblet squat");
  const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
  assert.ok(html.includes("width: fit-content; min-width: var(--w, 24px); max-width: 100%;") && html.includes(".pg-bar > span { min-width: 0; overflow-wrap: break-word; }"), "as long as its count, never shorter than its words, never wider than the card (its words wrap at large Text Sizes)");
  assert.ok(html.includes(".pg-lift-chart .plot { position: absolute; left: 6px; right: calc(var(--gut, 6ch) + 10px); top: 10px; bottom: 0; font-size: 0.8125rem; }") && html.includes(".pg-lift-chart .yl { position: absolute; right: calc(-1 * (var(--gut, 6ch) + 10px)); transform") && !/\.pg-lift-chart \.yl \{[^}]*width: 40px/.test(html), "the labels as wide as their words, the room as wide as the longest");
  assert.ok(html.includes(".pg-cmp.sm .pg-val small { min-width: 0; white-space: normal; line-height: 1.25; }"), "the skip reasons wrap");
  const js = fs.readFileSync(new URL("../app/main.js", import.meta.url), "utf8");
  assert.ok(js.includes('b.addEventListener("click", (ev) => { askEat(ev); ovPick = k;'), "a suggestion's double tap lands on nothing");
}));

test("after the deeper check: Getting stronger never claims a load typed in words or more help on an assisted machine, grows from the first time with reps, and words a gain as its labels show it", () => pinned(() => {
  const L = (rows) => liftsOf(rows, canon, T0, "lb"), names = (l) => strongerLifts(l, T0).map((x) => x.e.name);
  assert.deepStrictEqual(names(L([done("a", "2026-10-20", [row("Pull-up", ["BW+10"], ["8"])]), done("b", "2026-11-09", [row("Pull-up", ["10"], ["8"])])])), [], "BW+10 then 10: no 10 lb gained");
  assert.deepStrictEqual(names(L([done("a", "2026-10-20", [row("Dip", ["BW+20"], ["10"])]), done("b", "2026-11-09", [row("Dip", ["BW+10"], ["12"])])])), [], "the load went down");
  assert.deepStrictEqual(names(L([done("a", "2026-10-20", [row("Assisted pull-up", ["40"], ["8"])]), done("b", "2026-11-09", [row("Assisted pull-up", ["60"], ["8"])])])), [], "more help is not more strength");
  assert.deepStrictEqual(names(L([done("a", "2026-10-20", [row("Assisted pull-up", ["40"], ["6"])]), done("b", "2026-11-09", [row("Assisted pull-up", ["40"], ["9"])])])), ["Assisted pull-up"], "more reps with the same help is");
  const old = strongerLifts(L([done("a", "2026-09-28", [row("Goblet squat", ["25"], [])]), done("b", "2026-10-20", [row("Goblet squat", ["25"], ["8"])]), done("c", "2026-11-09", [row("Goblet squat", ["25"], ["12"])])]), T0)[0];
  assert.deepStrictEqual([old.first.date, old.firstTime, old.gain], ["2026-10-20", false, { by: "reps", d: 4 }], "the first time kept no reps: from the first with reps");
  setup(false); maps.trainings.clear(); for (const t of [done("a", "2026-09-28", [row("Goblet squat", ["25"], [])]), done("b", "2026-10-20", [row("Goblet squat", ["25"], ["8"])]), done("c", "2026-11-09", [row("Goblet squat", ["25"], ["12"])])]) maps.trainings.set(t.id, t); fns.render(); quiet();
  assert.ok(text($("pgStrong").innerHTML).includes("|Jane is doing 4 more reps at 25 lb than on Oct 20.|"), text($("pgStrong").innerHTML));
  maps.clients.get("c1").unit = "kg"; maps.trainings.clear(); for (const t of [done("a", "2026-10-20", [row("Curl", ["20"], ["10"])]), done("b", "2026-11-09", [row("Curl", ["25"], ["10"])])]) maps.trainings.set(t.id, t); fns.render(); quiet();
  assert.ok(text($("pgStrong").innerHTML).includes("|Jane is lifting 2.2 kg more than the first time, Oct 20.|11.3 kg × 10|Mon, Nov 9|9.1 kg × 10|"), "the difference of the two weights shown (11.3 - 9.1), never 2.3: " + text($("pgStrong").innerHTML));
  maps.clients.get("c1").unit = "lb"; maps.trainings.clear(); for (const t of [done("a", "2026-10-20", [row("Sprint", [], ["20"], { reps: "20 m" })]), done("b", "2026-11-09", [row("Sprint", [], ["40"], { reps: "20 m" })]), done("c", "2026-10-21", [row("Mountain climber", [], ["30"], { reps: "30 sec" })]), done("d", "2026-11-10", [row("Mountain climber", [], ["45"], { reps: "30 sec" })])]) maps.trainings.set(t.id, t); fns.render(); quiet();
  const all = text($("pgStrong").innerHTML);
  assert.ok(/going (20 m farther|15 sec longer)/.test(all) && !/carrying|holding/.test(all), "words that fit any timed or distance plan: " + all);
  maps.trainings.clear(); for (const t of [done("a", "2026-10-20", [row("Push-up", ["0"], ["10"])]), done("b", "2026-11-09", [row("Push-up", ["0"], ["12"])])]) maps.trainings.set(t.id, t); fns.render(); quiet();
  assert.ok(text($("pgStrong").innerHTML).includes("|Jane is doing 2 more reps than the first time, Oct 20.|"), "never at 0 lb");
}));

test("after the deeper check: holds judged as the card judges them, minutes to seconds rounded, the Look up's tile in the card's words, the search by the name shown", () => pinned(() => {
  const P = liftsOf([done("h1", "2026-10-20", [row("Plank", [], ["100"], { reps: "60 sec" })]), done("h2", "2026-11-09", [row("Plank", [], ["1.67"], { reps: "2 min" })]), done("h3", "2026-11-13", [row("Plank", [], ["90"], { reps: "90 sec" })])], canon, T0, "lb").get("plank");
  assert.deepStrictEqual(P.points.map((p) => [p.date, p.top.rp, p.gold]), [["2026-10-20", 100, false], ["2026-11-09", 100.2, false], ["2026-11-13", 90, false]], "1.67 min on a minutes plan is the card's 1.67 against 100 sec's 1.67: no new best; shown as 100.2 sec, never 100.19999999999999");
  setup(false, [done("s1", "2026-11-02", [row("Side plank", [], ["1.5"], { reps: "2 min" })])]);
  const c = maps.clients.get("c1"); assert.strictEqual(fns.fmtSetFor(c, fns.loggedExercises(c).get("sideplank")), "90 sec", "the tile says what the page it opens says");
  setup(false, [done("al", "2026-11-12", [row("Barbell one-arm row", ["50"], ["10"])])]);   // an older spelling (catalog alias of "Barbell single-arm row"): its key is the new name's
  fns.showBests(); $("bestsFind").value = "one-arm"; fns.paintBests(); assert.ok(text($("bestsList").innerHTML).includes("|Barbell one-arm row|"), "found by the name shown (the v311 check)"); fns.leaveSettings();
}));

test("after the deeper check: the chart counts in whole steps, a part of a minute in seconds, room for its longest label, and the bests alone once sessions crowd", () => pinned(() => {
  const pts = (vals, kind = "reps", w = null) => ({ kind, tunit: kind === "time" ? "min" : null, points: vals.map((v, k) => ({ date: fns.localIso(new Date(2026, 8, 1 + 3 * k, 12)), top: { w, rp: v, u: "lb" }, gold: k === vals.length - 1 })) });
  const labs = (h) => [...h.matchAll(/class="yl"[^>]*>([^<]+)</g)].map((m) => m[1]);
  assert.deepStrictEqual(labs(fns.liftChart(pts([10, 12, 15, 17]), "lb")), ["10 reps", "15 reps", "20 reps"], "whole steps for counts (never 12.5 reps)");
  assert.deepStrictEqual(labs(fns.liftChart(pts([1, 1, 2]), "lb")), ["1 rep", "2 reps"]);
  assert.deepStrictEqual(labs(fns.liftChart(pts([0.5, 0.75, 1.25], "time"), "lb")).slice(-1), ["80 sec"], "a part of a minute: the chart in seconds");
  const wide = fns.liftChart({ kind: "reps", points: [{ date: "2026-11-02", top: { w: 25, rp: 10, u: "lb" }, gold: false }, { date: "2026-11-09", top: { w: 40000000, rp: 10, u: "lb" }, gold: true }] }, "lb");
  assert.ok(/<div class="plot" style="--gut:11ch">/.test(wide), "the room as wide as \"40000000 lb\": " + wide.slice(0, 60));
  const many = fns.liftChart(pts(Array.from({ length: 30 }, (_, k) => 10 + (k % 5))), "lb"), ml = [...many.matchAll(/class="pt[^"]*" style="left:([\d.]+)%/g)].map((m) => Number(m[1])).sort((p, q) => p - q);
  assert.ok((many.match(/class="pt best"/g) || []).length === 1 && ml.every((v, k) => !k || v - ml[k - 1] >= 5 - 1e-9), "thirty sessions three days apart: the rings thinned to the room they have, the best kept: " + ml.length);
  const few = fns.liftChart(pts([10, 12, 11]), "lb"); assert.ok(few.indexOf('class="pt best"') > few.lastIndexOf('class="pt"'), "the bests drawn last, on top");
}));

test("after the deeper check: Sessions without a package counts the In person marks; Attendance is a card, not a door; a page opened from the tab closes the Look up's list first", () => pinned(() => {
  setup(false); delete maps.clients.get("c1").plan; fns.render(); quiet();
  assert.strictEqual(text($("pgSessions").innerHTML), "|Sessions|5|with you|Counted since Sep 30|");
  const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8"), js = fs.readFileSync(new URL("../app/main.js", import.meta.url), "utf8");
  assert.ok(html.includes('<div class="pg-card pg-gap" id="pgAttend" hidden></div>') && !/addEventListener\("click", attendTap\)|\$\("pgAttend"\)\.addEventListener/.test(js), "no tap: History lists a miss only once it is filed");
  assert.ok(!$("pgAttend").innerHTML.includes("pg-go"), "no chevron");
  $("ovSugg").hidden = false; fns.openLift("gobletsquat", false); assert.strictEqual($("ovSugg").hidden, true, "closed before the page is left (the swipe back's picture)"); fns.leaveSettings();
  $("ovSugg").hidden = false; fns.openBests(); assert.strictEqual($("ovSugg").hidden, true); fns.leaveSettings();
  assert.ok(html.includes(".ov-pick input::placeholder { color: var(--stat-grey); }") && html.includes(".ov-pick .ov-clear { position: absolute; top: 20px; }") && html.includes(".limits-note.pg-note .lim-text { display: block; -webkit-line-clamp: none; overflow: visible; }") && html.includes("min-height: 1.5rem; margin-top: 6px;"), "the placeholder's grey, the × inside the field, the whole note, bars that grow with the text");
}));

test("after the second round of checks: the Bodyweight key is no load in words, the fallback needs the same weight, more assisted spellings, a best dated by the day that very set was lifted", () => pinned(() => {
  const L = (rows) => liftsOf(rows, canon, T0, "lb"), names = (l) => strongerLifts(l, T0).map((x) => x.e.name);
  assert.deepStrictEqual(names(L([done("a", "2026-10-20", [row("Push-up", ["BW"], ["10"])]), done("b", "2026-11-09", [row("Push-up", ["BW", "BW"], ["15", "16"])])])), ["Push-up"], "BW, the keyboard's Bodyweight key, is none added");
  assert.deepStrictEqual(names(L([done("a", "2026-10-20", [row("Dip", ["BW+10"], ["8"])]), done("b", "2026-11-09", [row("Dip", ["BW+10"], ["10"])])])), [], "a load in words stays out");
  assert.deepStrictEqual(names(L([done("a", "2026-09-28", [row("Goblet squat", ["60"], [])]), done("b", "2026-10-20", [row("Goblet squat", ["20"], ["8"])]), done("c", "2026-11-09", [row("Goblet squat", ["20"], ["12"])])])), [], "60 lb then 20 lb is not growing from Oct 20");
  assert.deepStrictEqual(names(L([done("a", "2026-10-20", [row("Gravitron pull-up", ["40"], ["8"])]), done("b", "2026-11-09", [row("Gravitron pull-up", ["60"], ["8"])])])), [], "Gravitron: more help");
  assert.deepStrictEqual(names(L([done("a", "2026-10-20", [row("Asst. dip", ["40"], ["8"])]), done("b", "2026-11-09", [row("Asst. dip", ["60"], ["8"])])])), [], "Asst.: more help");
  const tie = L([done("k", "2026-11-02", [row("Bench press", ["61.2"], ["5"], { unit: "kg" })]), done("l", "2026-11-09", [row("Bench press", ["135"], ["5"])])]).get("benchpress");
  assert.deepStrictEqual([bestOf(tie).top.w, bestOf(tie).date], [135, "2026-11-09"], "135 lb beside the day 135 lb was lifted");
}));

test("after the second round of checks: the chart keeps the bodyweight sessions, spaces its rings and month names; Sessions never drops at a package switch; any page change closes the Look up's list", () => pinned(() => {
  const P = (list) => ({ kind: "reps", points: list.map(([d, w, rp], k) => ({ date: d, top: { w, rp, u: "lb" }, gold: k === list.length - 1, words: false })) });
  const labs = (h) => [...h.matchAll(/class="yl"[^>]*>([^<]+)</g)].map((m) => m[1]), dots = (h) => (h.match(/class="pt/g) || []).length;
  const pull = P([["2026-09-07", null, 5], ["2026-09-14", null, 6], ["2026-09-21", null, 7], ["2026-09-28", null, 8], ["2026-10-05", null, 8], ["2026-10-12", null, 9], ["2026-10-19", null, 9], ["2026-10-26", null, 9], ["2026-11-09", 10, 5]]);
  const hp = fns.liftChart(pull, "lb"); assert.ok(dots(hp) === 9 && labs(hp)[0] === "0 lb" && labs(hp).every((t) => / lb$/.test(t)), "bodyweight, then a weighted best: charted by the weight (0 added before), rising as its sentence says (the v312 checks): " + labs(hp));
  const bw = P([["2026-10-05", null, 10], ["2026-10-12", null, 12], ["2026-10-19", null, 15]]); assert.ok(labs(fns.liftChart(bw, "lb")).every((t) => / reps?$/.test(t)), "bodyweight alone: the reps");
  const mostly = P([["2026-10-05", 20, 10], ["2026-10-12", 20, 10], ["2026-10-19", 25, 10], ["2026-10-26", null, 12], ["2026-11-02", 25, 10]]);
  const hm = fns.liftChart(mostly, "lb"); assert.ok(dots(hm) === 5 && labs(hm)[0] === "0 lb" && labs(hm).every((t) => / lb$/.test(t)), "a session with no weight after weighted ones is none added, as logged and as Getting stronger reads it: 0 lb (the last check: a Bodyweight-key session left out stopped the line early, while one before the first weight was drawn): " + labs(hm));
  const mwf = (n) => P(Array.from({ length: n }, (_, k) => [fns.localIso(new Date(2026, 8, 7 + [0, 2, 4][k % 3] + 7 * Math.floor(k / 3), 12)), 20 + k, 10]));
  const lefts = (h) => [...h.matchAll(/class="pt[^"]*" style="left:([\d.]+)%/g)].map((m) => Number(m[1])).sort((p, q) => p - q);
  assert.strictEqual(dots(fns.liftChart(mwf(12), "lb")), 12, "Mon/Wed/Fri for a month: every ring has room");
  const l24 = lefts(fns.liftChart(mwf(24), "lb")); assert.ok(l24.length > 8 && l24.every((v, k) => !k || v - l24[k - 1] >= 5 - 1e-9), "eight weeks: a ring only where it has 5% of the plot, never all gone for one close pair (the v312 checks): " + l24.length);
  const xs = [...fns.liftChart(P(Array.from({ length: 14 }, (_, k) => [fns.localIso(new Date(2025, k, 3, 12)), 20 + k, 10])), "lb").matchAll(/class="xl" style="left:([\d.]+)%"/g)].map((m) => Number(m[1])).sort((p, q) => p - q);
  assert.ok(xs.every((v, k) => !k || v - xs[k - 1] >= 20) && xs.every((v) => v <= 88), "a month named only a fifth of the plot from the next: " + xs);
  const jn = [...fns.liftChart(P([["2026-06-15", 20, 10], ["2026-08-10", 22, 10], ["2026-11-13", 25, 10]]), "lb").matchAll(/class="xl"[^>]*>([^<]+)</g)].map((m) => m[1]);
  assert.ok(jn.includes("Oct"), "named from the newest back: the latest months are named (the v312 checks): " + jn);
  setup(false); const cl = maps.clients.get("c1"), was = { id: "p10", name: "10 sessions", kind: "sessions", size: 10, startedOn: "2026-09-01", adjust: 5 };   // 5 marks and 5 added by hand: a full 10
  cl.plan = nextPlan(was, { id: "p20", name: "20 sessions", kind: "sessions", size: 20 }, [...maps.trainings.values()], T0); fns.render(); quiet();
  assert.strictEqual(text($("pgSessions").innerHTML), "|Sessions|10|with you|This package: 0 of 20|", "a package switch keeps the 5 added by hand (the owner's ask); no Package 1: " + text($("pgSessions").innerHTML));
  setup(false); fns.showLift("plank", false); assert.strictEqual($("liftKeyText").textContent, "New best: longer, or heavier"); fns.leaveSettings();
  $("ovSugg").hidden = false; fns.showClientCard(); assert.strictEqual($("ovSugg").hidden, true, "the photo disc's card too: the list never rides into the swipe back's picture"); fns.leaveSettings();
}));

test("after the third round: a best repeated after a switch of units keeps its first day (the app's own copy of 25 lb in kg is a hair heavier)", () => pinned(() => {
  const L = liftsOf([done("s1", "2026-11-02", [row("Goblet squat", ["25"], ["10"])]), done("s2", "2026-11-09", [row("Goblet squat", ["25"], ["10"])]), done("s3", T0, [row("Goblet squat", ["11.34"], ["10"], { unit: "kg" })])], canon, T0, "kg").get("gobletsquat");
  assert.deepStrictEqual([bestOf(L, "kg").date, bestOf(L, "lb").date], ["2026-11-02", "2026-11-02"], "25 lb and 11.34 kg read the same in either unit: the first day");
}));

test("the Look up's Best opens that exercise's page; the markup has the new cards in the order of the pictures and the two pages after Workouts", () => pinned(() => {
  const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8"), ov = html.slice(html.indexOf('id="overview"'), html.indexOf('id="weekBar"'));
  const order = ["pgNotes", "pgMonth", "pgWeek", "pgAttend", "pgStrongCap", "pgStrong", "pgStrongList", "ovEx", "ovBest", "pgBests", "pgSessions"].map((id) => ov.indexOf('id="' + id + '"'));
  assert.ok(order.every((x, k) => x > 0 && (!k || x > order[k - 1])), "in the order of the pictures: " + order);
  assert.ok(/<div class="pg-notes trainer-only" id="pgNotes">/.test(ov), "the note is the coach's alone, in the Client view too");
  assert.ok(/<\/section>\n  <section id="vBests" hidden>[\s\S]*<section id="vLift" hidden>/.test(html.slice(html.indexOf('id="vWorkouts"'))), "after Workouts, inside <main>");
  const js = fs.readFileSync(new URL("../app/main.js", import.meta.url), "utf8");
  assert.ok(js.includes('$("ovBestBtn").addEventListener("click", (e) => { if (ovPick) openLift(ovPick, false, e, ($("ovBest")._e || {}).name); });'));
}));
