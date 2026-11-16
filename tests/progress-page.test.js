// The Progress tab's cards and the Workouts page (v310; the owner's ask, 16 Nov 2026: "I still want workouts this month and total workouts ...
// I want the stats and graphics look more like Apple ones", his picks after the pictures, then "Build it"). The cards read the client's workouts:
// This month, Total, This week (a disc a day, "1 of 2", the average of the weeks before). Each card opens the Workouts page, a page of its own
// over the client's page as History is: Back lands the Progress tab where it was, a sync's redraw keeps it, a reload reopens it.
import { test, assert } from "./assert.js";
import { load } from "./load.js";
import { mondayOf, weekDays } from "../app/model.js";
import { daysLater } from "../app/util.js";
const app = await load();
const { fns, maps } = app;
const $ = (id) => document.getElementById(id);
const tick = (ms = 10) => new Promise((r) => setTimeout(r, ms));
const quiet = () => { for (const t of maps.timers.values()) clearTimeout(t); maps.timers.clear(); fns.setPreview(false); };
const at = (d) => new Date(d + "T12:00:00").toISOString();
// four whole weeks before this one with two finished a week (Monday and Tuesday), this Monday finished and this Sunday to do: the same picture on any day of the week
const setup = (clientMode = false) => {
  app.reset(); app.set({ signedIn: true, clientMode, myClientId: clientMode ? "c1" : null, view: { name: "client", id: "c1" }, tab: "profile" });
  maps.clients.set("c1", { id: "c1", name: "jane Doe", unit: "lb" });
  const mon = mondayOf(fns.today()), add = (id, d, done) => maps.trainings.set(id, { id, clientId: "c1", title: "Legs", date: d, createdAt: at(daysLater(d, -1)), completedAt: done ? at(d) : null, skippedAt: null, rows: [] });
  for (let w = 1; w <= 4; w++) { add("a" + w, daysLater(mon, -7 * w), true); add("b" + w, daysLater(mon, -7 * w + 1), true); }
  add("now", mon, true); add("sun", daysLater(mon, 6), false);
  fns.render(); quiet();
  return mon;
};
const scroller = () => {
  const s = { ys: [], put: (y) => { globalThis.scrollY = y; } }, real = globalThis.scrollTo;
  globalThis.scrollTo = (x, y) => { s.ys.push(y); globalThis.scrollY = y; };
  s.done = () => { globalThis.scrollTo = real; globalThis.scrollY = 0; fns.leaveSettings(); quiet(); };
  return s;
};
const page = () => { try { return JSON.parse(localStorage.getItem("fiala.trainings.page")); } catch (_) { return null; } };
const wkKey = "client/c1/////|workouts|", clientKey = "client/c1/////||";

test("the cards: This month and Total count finished workouts; This week is done of the week's workouts, a disc a day, and the average of the 4 weeks before", () => {
  try {
    setup();
    const list = [...maps.trainings.values()], month = fns.overviewCounts(list, fns.today().slice(0, 7)).month;
    assert.deepStrictEqual([$("ovTotal").textContent, $("ovTotalUnit").textContent], ["9", "workouts"]);
    assert.deepStrictEqual([$("ovMonth").textContent, $("ovMonthUnit").textContent], [String(month), month === 1 ? "workout" : "workouts"]);
    assert.strictEqual(($("pgMonthChart").innerHTML.match(/<i\b/g) || []).length, new Set(list.filter((t) => t.completedAt && fns.effDate(t).slice(0, 7) === fns.today().slice(0, 7)).map((t) => fns.effDate(t))).size, "a bar on each day trained this month");
    assert.strictEqual(($("pgMonthChart").innerHTML.match(/class="now"/g) || []).length, month ? 1 : 0, "the latest in colour");
    assert.deepStrictEqual([$("pgWeekN").textContent, $("pgWeekUnit").textContent], ["1 of 2", "workouts"]);
    const states = [...$("pgDays").innerHTML.matchAll(/pg-dot (\w+)/g)].map((m) => m[1]);
    assert.deepStrictEqual(states, ["done", "rest", "rest", "rest", "rest", "rest", "plan"], "Monday done, Sunday still to do (even on a Sunday: today's)");
    assert.strictEqual(($("pgDays").innerHTML.match(/class="pg-day today"/g) || []).length, 1, "today's letter is marked");
    assert.deepStrictEqual([$("pgAvg").hidden, $("pgAvg").innerHTML], [false, "<b>2 a week</b> on average over the last 4 weeks"], "his pick: the average of the weeks before, in place of weeks in a row");
    assert.strictEqual(($("pgTotalChart").innerHTML.match(/class="now"/g) || []).length, month ? 1 : 0, "this month's bar in colour (none while this month has no finished workout yet: the v310 review)");
  } finally { quiet(); }
});

test("This week with nothing planned says 0 workouts; a client in their first week has no average yet", () => {
  try {
    app.reset(); app.set({ signedIn: true, clientMode: false, view: { name: "client", id: "c1" }, tab: "profile" });
    maps.clients.set("c1", { id: "c1", name: "Jane", unit: "lb" }); fns.render(); quiet();
    assert.deepStrictEqual([$("pgWeekN").textContent, $("pgWeekUnit").textContent, $("pgAvg").hidden, $("ovTotal").textContent], ["0", "workouts", true, "0"]);
    const mon = mondayOf(fns.today());
    maps.trainings.set("x", { id: "x", clientId: "c1", title: "Legs", date: mon, createdAt: at(mon), completedAt: at(mon), skippedAt: null, rows: [] }); fns.render(); quiet();
    assert.deepStrictEqual([$("pgWeekN").textContent, $("pgWeekUnit").textContent, $("pgAvg").hidden], ["1 of 1", "workout", true], "started this week: no whole week before it");
  } finally { quiet(); }
});

test("a card opens the Workouts page over the client's page; a redraw keeps it; Back lands the Progress tab where it was", async () => {
  setup(); const sc = scroller();
  try {
    sc.put(300); fns.openWorkouts("M"); await tick();
    assert.deepStrictEqual(fns.settingsPage(), { open: "workouts", from: false });
    assert.deepStrictEqual([$("vWorkouts").hidden, $("vClient").hidden, $("backLabel").textContent], [false, true, "Back"]);
    assert.strictEqual(sc.ys[sc.ys.length - 1], 0, "it opens at its top");
    assert.deepStrictEqual([fns.workoutsRange(), fns.navState().key, fns.backKey()], ["M", wkKey, clientKey], "the swipe back has the client's page underneath");
    assert.deepStrictEqual(page(), { open: "workouts", from: false }, "a reload reopens it");
    fns.render(); assert.deepStrictEqual([$("vWorkouts").hidden, $("vPassword").hidden], [false, true], "a sync's redraw keeps it (never Change password)");
    await fns.goBackNow(); await tick();
    assert.deepStrictEqual([$("vWorkouts").hidden, $("vClient").hidden, fns.settingsPage().open, app.get().tab], [true, false, false, "profile"], "Back: the Progress tab");
    assert.strictEqual(sc.ys[sc.ys.length - 1], 300, "where it was");
    assert.strictEqual(fns.navState().key, clientKey);
  } finally { sc.done(); }
});

test("the Workouts page counts finished workouts in its range, heads it the way Health does, and keeps the range picked", () => {
  const mon = setup(); const sc = scroller();
  try {
    fns.openWorkouts("M");
    const t0 = fns.today(), [ty, tm] = t0.split("-").map(Number), last = fns.localIso(new Date(ty, tm, 0, 12));
    assert.deepStrictEqual([$("wkTotal").textContent, $("wkDates").textContent], [$("ovMonth").textContent, fns.dayRange(t0.slice(0, 8) + "01", last, true)], "the This month card's number and its month (the v310 review: never the 30 days to today)");
    fns.openWorkouts("W");
    assert.deepStrictEqual([$("wkTotal").textContent, $("wkUnit").textContent, $("wkDates").textContent], ["1", "workout", fns.dayRange(mon, daysLater(mon, 6), true)]);
    fns.showWorkouts("6M");
    assert.deepStrictEqual([$("wkTotal").textContent, $("wkUnit").textContent], ["9", "workouts"], "all nine within 26 weeks");
    fns.showWorkouts("Y"); assert.ok(/^\w{3} \d{4} – \w{3} \d{4}$/.test($("wkDates").textContent), "the year: from month to month");
    fns.showWorkouts(); assert.strictEqual(fns.workoutsRange(), "Y", "opened again with no range: the one picked last");
    assert.deepStrictEqual([$("wkHlCap").hidden, $("wkHl").hidden, $("wkHlText").textContent], [false, false, "Jane trained twice a week on average over the last 4 weeks.".replace("twice", "2 times")], "the coach reads the client's first name, a capital first");
  } finally { sc.done(); }
});

test("the client's own app reads You trained; the coach's Workouts page leaves when the client is deleted on another device", () => {
  setup(true); const sc = scroller();
  try {
    fns.openWorkouts("6M");
    assert.strictEqual($("wkHlText").textContent, "You trained 2 times a week on average over the last 4 weeks.");
    fns.leaveSettings(); setup(false); fns.openWorkouts("6M");   // (a client's own record gone takes the client's app to its waiting page: sync.js, not this page)
    maps.clients.delete("c1"); fns.render();
    assert.notStrictEqual(fns.settingsPage().open, "workouts", "the client gone: off the page"); assert.strictEqual($("vWorkouts").hidden, true);
  } finally { sc.done(); }
});

test("nothing opens for Templates or a client who is not there", () => {
  try {
    app.reset(); app.set({ signedIn: true, clientMode: false, view: { name: "client", id: "nobody" }, tab: "profile" });
    assert.strictEqual(fns.showWorkouts("W"), false); assert.notStrictEqual(fns.settingsPage().open, "workouts");
    app.set({ view: { name: "client", id: "00000000-0000-4000-8000-0000000000f1" } }); maps.clients.set("00000000-0000-4000-8000-0000000000f1", { id: "00000000-0000-4000-8000-0000000000f1", name: "Templates", kind: "templates" });
    assert.strictEqual(fns.showWorkouts("W"), false, "Templates have no Progress");
  } finally { fns.leaveSettings(); quiet(); }
});

test("Total opens on 6 months, or on the year once there is more than 26 weeks to show", () => {
  try {
    setup(); const c = maps.clients.get("c1");
    assert.strictEqual(fns.totalRange(c), "6M");
    const old = daysLater(mondayOf(fns.today()), -200);
    maps.trainings.set("old", { id: "old", clientId: "c1", title: "Legs", date: old, createdAt: at(old), completedAt: at(old), skippedAt: null, rows: [] });
    assert.strictEqual(fns.totalRange(c), "Y");
  } finally { quiet(); }
});

test("the chart page's axis: about four lines at round values, days of the week, the 30 days' Mondays, the months of 6M and of the year", () => {
  const bins = (n, f) => Array.from({ length: n }, (_, k) => ({ from: f(k), to: f(k), n: k % 3 }));
  const W = fns.pgChart(bins(7, (k) => daysLater("2026-11-16", k)), "W");
  assert.strictEqual((W.match(/class="gl/g) || []).length, 4, "0, 1, 2, 3");
  assert.deepStrictEqual([...W.matchAll(/class="xl"[^>]*>([^<]+)</g)].map((m) => m[1]), ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]);
  const big = fns.pgChart([{ from: "2026-11-01", to: "2026-11-30", n: 11 }], "Y");
  assert.deepStrictEqual([...big.matchAll(/class="yl"[^>]*>([^<]+)</g)].map((m) => m[1]), ["0", "4", "8", "12"], "11 at the most: lines at 0, 4, 8, 12");
  const M = fns.pgChart(bins(30, (k) => daysLater("2026-10-18", k)), "M");
  assert.deepStrictEqual([...M.matchAll(/class="xl"[^>]*>([^<]+)</g)].map((m) => m[1]), ["19", "26", "2", "9", "16"], "Mondays' dates");
  assert.strictEqual((M.match(/class="vl solid"/g) || []).length, 2, "the chart's edge and the 1st of a month solid");
  const six = fns.pgChart(bins(26, (k) => daysLater("2026-05-25", 7 * k)), "6M");
  assert.deepStrictEqual([...six.matchAll(/class="xl"[^>]*>([^<]+)</g)].map((m) => m[1]), ["Jun", "Jul", "Aug", "Sep", "Oct", "Nov"]);
  const Y = fns.pgChart(Array.from({ length: 12 }, (_, k) => ({ from: fns.localIso(new Date(2025, 11 + k, 1, 12)), to: "", n: 0 })), "Y");
  assert.deepStrictEqual([...Y.matchAll(/class="xl"[^>]*>([^<]+)</g)].map((m) => m[1]).join(""), "DJFMAMJJASON");
});

test("dates head the cards and the chart the way Health writes them", () => {
  assert.strictEqual(fns.dayRange("2026-11-16", "2026-11-22"), "Nov 16–22");
  assert.strictEqual(fns.dayRange("2026-11-16", "2026-11-22", true), "Nov 16–22, 2026");
  assert.strictEqual(fns.dayRange("2026-11-30", "2026-12-06"), "Nov 30 – Dec 6");
  assert.strictEqual(fns.dayRange("2026-05-25", "2026-11-22", true), "May 25 – Nov 22, 2026");
  assert.strictEqual(fns.dayRange("2026-12-28", "2027-01-03", true), "Dec 28, 2026 – Jan 3, 2027");
  assert.strictEqual(fns.monthRange("2025-12-01", "2026-11-30"), "Dec 2025 – Nov 2026");
});

test("the markup: the cards are buttons, the page is a section of <main>, and the names of the tiles and the page are the ones in the pictures", async () => {
  const fs = await import("node:fs"); const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
  for (const id of ["pgMonth", "pgTotal", "pgWeek"]) assert.ok(new RegExp('<button type="button" class="pg-card[^"]*" id="' + id + '">').test(html), id);
  assert.ok(/<\/section>\n  <section id="vWorkouts" hidden>\n    <h1 class="pagetitle">Workouts<\/h1>/.test(html), "after History, inside <main>");
  assert.ok(html.includes("<span>This month</span>") && html.includes("<span>Total</span>") && html.includes("<span>This week</span>"));
  assert.ok(!html.includes('class="ov-tiles"'), "the old two tiles are gone");
  assert.ok(html.includes('data-range="W" aria-label="Week"') && html.includes('data-range="6M" aria-label="6 months"'), "VoiceOver hears the ranges' words");
  assert.ok(/\$\("vWorkouts"\)|"vWorkouts"/.test(fs.readFileSync(new URL("../app/main.js", import.meta.url), "utf8")), "main.js names it");
});

test("Total's small chart: a bar a month from the first month trained however long ago (six at most); with more than three, the first and last named at the edges", () => {
  try {
    setup(); const t0 = fns.today(), mon = mondayOf(t0);
    const old = daysLater(mon, -400);                                  // over a year back: six months shown, not one
    maps.trainings.set("old", { id: "old", clientId: "c1", title: "Legs", date: old, createdAt: at(old), completedAt: at(old), skippedAt: null, rows: [] }); fns.render(); quiet();
    const h = $("pgTotalChart").innerHTML;
    assert.strictEqual((h.match(/<span>(<i[^>]*><\/i>)?<\/span>/g) || []).length, 6, "six months");
    assert.ok(/<span class="l0">\w+<\/span><span class="l1">\w+<\/span>/.test(h), "named at the two ends only");
  } finally { quiet(); }
});

test("the average card: no workouts in the weeks before reads as such, and its box makes room for the words wherever the line falls", () => {
  const sc = scroller();
  try {
    app.reset(); app.set({ signedIn: true, clientMode: false, view: { name: "client", id: "c1" }, tab: "profile" });
    maps.clients.set("c1", { id: "c1", name: "Jane", unit: "lb" });
    const d = daysLater(mondayOf(fns.today()), -21);                  // three weeks back, planned and never done (filed as missed)
    maps.trainings.set("m", { id: "m", clientId: "c1", title: "Legs", date: d, createdAt: at(daysLater(d, -9)), completedAt: null, skippedAt: at(d), missed: true, rows: [] });
    fns.render(); quiet(); fns.openWorkouts("6M");
    assert.strictEqual($("wkHlText").textContent, "Jane finished no workouts in the last 3 weeks.");
    assert.ok(/calc\(1\.75rem \+ 14\.0px\)/.test($("wkAvg").style.marginBottom), "the number under the line at the foot of the box: room below, in rem");
  } finally { sc.done(); }
});

test("6M names its first month when the 26 weeks begin on the 1st; the This week card leaves the years out, the page keeps them", () => {
  const six = fns.pgChart(Array.from({ length: 26 }, (_, k) => ({ from: daysLater("2026-06-01", 7 * k), to: "", n: 1 })), "6M");
  assert.deepStrictEqual([...six.matchAll(/class="xl"[^>]*>([^<]+)</g)].map((m) => m[1]), ["Jun", "Jul", "Aug", "Sep", "Oct", "Nov"]);
  assert.strictEqual(fns.dayRange("2026-12-28", "2027-01-03"), "Dec 28 \u2013 Jan 3", "the New Year week fits beside This week");
  assert.strictEqual(fns.dayRange("2026-12-28", "2027-01-03", true), "Dec 28, 2026 \u2013 Jan 3, 2027");
});
