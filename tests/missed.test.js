// His ask, 10 Nov: "when workout is missed now it says do it today, skip … give it another option to reschedule … make it like apple would ..
// also figure out how show missed workouts when there is more than one". His picks: B, a "…" on each missed workout opening Do it today,
// Reschedule and Skip, "with the slide option giving the same 3 options"; one card, and with more "it has to be clear": the newest and a row
// "2 more" (Up next's own fold; Apple's lists show more so, its stacks are for notifications); Skip all; a week, then History by itself
// ("Missed", his pick). Both views alike. The real swipe of the three is driven in row-swipe-probe.mjs, the "…" menu in month-menu-probe.mjs.
import fs from "node:fs";
import { test, assert, tick } from "./assert.js";
import { load } from "./load.js";
import { byId, el } from "./env.js";
import { TEMPLATES_ID } from "../app/model.js";
const app = await load();
const { fns, maps } = app;
const $ = (id) => document.getElementById(id);
const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const day = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return fns.localIso(d); };   // the app's local day (never UTC: after 4 pm in Los Angeles that is tomorrow)
const W = (id, n, extra = {}) => maps.trainings.set(id, { id, clientId: "c1", title: id, date: day(n), createdAt: "2026-11-01T10:00:00.000Z", completedAt: null, skippedAt: null, rows: [], ...extra });
const quiet = () => { for (const t of maps.timers.values()) clearTimeout(t); maps.timers.clear(); fns.setPreview(false); };   // no save left to run into a later test
const setup = (client, ws = {}) => {
  quiet(); app.reset(); fns.missReset();                             // (the card's fold lives in main.js: a reset does not clear it)
  app.set({ signedIn: true, clientMode: client, myClientId: client ? "c1" : null, tab: "workouts" });
  maps.clients.set("c1", { id: "c1", name: "Jane", unit: "lb" }); maps.clients.set("c2", { id: "c2", name: "Ann", unit: "lb" }); maps.clients.set(TEMPLATES_ID, { id: TEMPLATES_ID, name: "Templates" });
  for (const [id, n] of Object.entries(ws)) W(id, n);
  app.set({ view: { name: "client", id: "c1" } });
};
// elements that keep what is put in them and the listeners they are given (the shared stand-in drops both), while fn runs; the three lists
// keep what is drawn into them
function drawing(fn) {
  const make = document.createElement, ids = ["missList", "todayList", "nextList"], lists = ids.map((id) => $(id)), got = {};
  document.createElement = (tag) => {
    const e = make(tag); e.kids = []; e.on = {}; e.attrs = {}; let inner = "";
    e.appendChild = (c) => { e.kids.push(c); return c; }; e.append = (...k) => { e.kids.push(...k); };
    e.addEventListener = (type, f) => { (e.on[type] ||= []).push(f); }; e.setAttribute = (k, v) => { e.attrs[k] = String(v); };
    Object.defineProperty(e, "innerHTML", { configurable: true, get: () => inner, set: (v) => { inner = String(v); e.firstChild = /^<span/.test(inner) ? { textContent: "" } : make("span"); } });
    return e;
  };
  lists.forEach((l, k) => { got[ids[k]] = []; l.replaceChildren = (...kids) => { got[ids[k]] = kids; }; l.appendChild = (c) => { got[ids[k]].push(c); return c; }; });
  try { return fn(got); } finally { document.createElement = make; for (const l of lists) { delete l.replaceChildren; delete l.appendChild; } }
}
const tids = (lis) => lis.filter((li) => li.dataset && li.dataset.tid).map((li) => li.dataset.tid);
const isMissedRow = (li) => /\bmiss\b/.test(li.className) && li.classList.contains("swipe-row") && li.kids.some((k) => k.className === "miss-more") && li._ctx().map((it) => it.label).join() === "Do it today,Reschedule,Skip,Preview" && li.kids.find((k) => k.className === "swipe-acts").kids.map((a) => a.className).join() === "swipe-act sa-prev,swipe-act sa-skip,swipe-act sa-resched";
const foldOf = (lis) => { const li = lis.find((x) => x.className === "more only"); if (!li) return null; const f = li.kids[0].kids[0]; return { cls: f.className, label: f.attrs["aria-label"], expanded: f.attrs["aria-expanded"], text: f.firstChild.textContent, click: () => f.on.click[0]({}) }; };

test("one Missed card above Today, the newest first; Today and Up next keep only what is still ahead; one: its row alone; two or more: the newest, \"2 more\" and Skip all; \"2 more\" opens them all and the up chevron folds them back; another client's page folds it again", () => {
  for (const client of [false, true]) {
    setup(client, { m1: -1, m3: -5, m2: -3, t0: 0, u1: 1 });
    drawing((got) => {
      fns.render();
      assert.deepStrictEqual([tids(got.missList), tids(got.todayList), tids(got.nextList)], [["m1"], ["t0"], ["u1"]], "the newest missed alone on the card; the rest are not Up next's");
      assert.deepStrictEqual([$("missHead").hidden, $("missList").hidden, $("skipAll").hidden], [false, false, false], "the card, and Skip all on its title (" + (client ? "client" : "coach") + ")");
      assert.ok(isMissedRow(got.missList[0]), "the card draws a missed row: its \u2026, its three behind it, its menu");
      let f = foldOf(got.missList);
      assert.deepStrictEqual([f.cls, f.text, f.label, f.expanded], ["fold wide", "2 more", "Show more", "false"], "folded: \"2 more\", the whole row, as Up next's");
      f.click(); fns.render();
      assert.deepStrictEqual(tids(got.missList), ["m1", "m2", "m3"], "open: all of them, the newest first");
      assert.ok(got.missList.filter((li) => li.dataset && li.dataset.tid).every(isMissedRow), "each a missed row");
      f = foldOf(got.missList);
      assert.deepStrictEqual([f.cls, f.text, f.label, f.expanded], ["fold open", "", "Show less", "true"], "open: the up chevron alone");
      fns.render(); assert.deepStrictEqual(tids(got.missList), ["m1", "m2", "m3"], "a redraw (a sync) keeps it open");
      if (!client) {                                                   // (a client has only her own page)
        app.set({ view: { name: "client", id: "c2" } }); fns.render(); assert.strictEqual($("missHead").hidden, true, "another client with none: no card");
        app.set({ view: { name: "client", id: "c1" } }); fns.render(); assert.deepStrictEqual(tids(got.missList), ["m1"], "back on her page: folded again");
      } else { foldOf(got.missList).click(); fns.render(); }
      f = foldOf(got.missList); f.click(); fns.render(); foldOf(got.missList).click(); fns.render(); assert.deepStrictEqual(tids(got.missList), ["m1"], "the chevron folds it back");
      foldOf(got.missList).click(); fns.render();                     // open, then two are dealt with elsewhere
      maps.trainings.delete("m2"); maps.trainings.delete("m3"); fns.render();
      assert.deepStrictEqual([tids(got.missList), foldOf(got.missList), $("skipAll").hidden, $("missHead").hidden, $("missList").hidden], [["m1"], null, true, false, false], "one: the card with its row alone, nothing to fold, no Skip all");
      W("m4", -2); fns.render();
      assert.deepStrictEqual([tids(got.missList), foldOf(got.missList).text, $("skipAll").hidden], [["m1"], "1 more", false], "a second one missed later: folded again (the fold went away with the first two), Skip all back at two");
      maps.trainings.delete("m1"); maps.trainings.delete("m4"); fns.render();
      assert.deepStrictEqual([$("missHead").hidden, $("missList").hidden], [true, true], "none: no card");
    });
  }
  quiet();
});

test("missed: still to do, its day gone, the newest first, on the same day the later-made first; a workout with no day is never missed", () => {
  setup(false, { a: -2, b: -2, c: -5, f: 0 }); maps.trainings.get("b").createdAt = "2026-11-01T18:00:00.000Z"; W("nodate", -3, { date: null });
  assert.deepStrictEqual(fns.missedOf("c1").map((t) => t.id), ["b", "a", "c"]);
  quiet();
});

test("a missed workout's row: its day in red, how long ago; a \"…\" where the chevron was, Do it today, Reschedule, Skip and Preview; its touch and hold and right-click the same; its swipe Preview, Skip and outermost Reschedule, as every row's (his ask, 10 Nov: \"keep do it today … the sliding menu can only have reschedule skip and preview to keep it clean\")", () => {
  for (const client of [false, true]) {
    setup(client, { m1: -3 });
    drawing(() => {
      const li = fns.workoutRow(maps.trainings.get("m1"), "missed", true), b = li.kids[0], sec = b.kids[2].kids[1];
      assert.ok(/\bmiss\b/.test(li.className) && li.classList.contains("swipe-row"), "a missed row, and it swipes");
      assert.deepStrictEqual([sec.kids[0].className, sec.kids[0].textContent, sec.kids[1]], ["missed", "3 days ago", " \u00b7 Nothing added yet"], "the one red word: how long ago (the card says Missed)");
      assert.strictEqual(b.kids.some((k) => k.className === "chev"), false, "no chevron");
      const more = li.kids[1];
      assert.deepStrictEqual([more.tagName, more.className, more.attrs["aria-label"], more.type], ["BUTTON", "miss-more", "More", "button"], "the \"…\": its own button after the row's, named More");
      const items = fns.missItems("m1");
      assert.deepStrictEqual(items.map((it) => it.label), ["Do it today", "Reschedule", "Skip", "Preview"], "the menu: Do it today first (the likeliest), then Reschedule, Skip, and Preview (his ask, 10 Nov), as the swipe has them outermost first");
      assert.ok(items[0].icon.includes(">" + Number(fns.today().slice(8)) + "</text>"), "Do it today: the calendar with today's date on it, as Reminders marks its Today");
      assert.deepStrictEqual(items.slice(1).map((it) => it.icon), [fns.menuIcons().calendar, fns.menuIcons().skip, fns.menuIcons().eye], "Reschedule's calendar, Skip's glyph and Preview's eye, as the row's other menus");
      assert.deepStrictEqual(li._ctx().map((it) => it.label), ["Do it today", "Reschedule", "Skip", "Preview"], "touch and hold, right-click: the same four");
      const acts = li.kids.find((k) => k.className === "swipe-acts").kids;
      assert.deepStrictEqual(acts.map((a) => a.className), ["swipe-act sa-prev", "swipe-act sa-skip", "swipe-act sa-resched"], "the swipe: every row's three, Preview innermost, Reschedule outermost; Do it today only in the \"…\" and touch and hold");
      assert.ok(acts.every((a) => a.tabIndex === -1), "out of the keyboard's way: the \"…\" holds all four");
      const before = maps.trainings.get("m1").date;
      for (const [how, run] of [["the menu", () => items[1].onPick()], ["its swipe button", () => acts[2].on.click[0]({ stopPropagation() {} })]]) {
        run(); const dp = fns.datePicker();
        assert.deepStrictEqual([dp && dp.title, dp && (client ? typeof dp.min : dp.min), maps.trainings.get("m1").date], ["Reschedule", client ? "function" : null, before], "Reschedule from " + how + ": the days (" + (client ? "from today on" : "any day") + "), nothing moved yet");
        fns.closeDatePicker();
      }
      li._full(); const fd = fns.datePicker(); assert.deepStrictEqual([fd && fd.title, maps.trainings.get("m1").date], ["Reschedule", before], "the full swipe: Reschedule's days, as every row's (never Do it today)"); fns.closeDatePicker();
      items[0].onPick(); assert.strictEqual(maps.trainings.get("m1").date, fns.today(), "Do it today: from its \"…\" (and touch and hold)");
    });
  }
  setup(false, { u1: 1 });
  drawing(() => {
    const li = fns.workoutRow(maps.trainings.get("u1"), "next", true);
    assert.deepStrictEqual(li.kids.find((k) => k.className === "swipe-acts").kids.map((a) => a.className), ["swipe-act sa-prev", "swipe-act sa-skip", "swipe-act sa-resched"], "a workout still ahead: its two and Preview (no Today: that is a missed one's, his rule 10 Nov)");
    assert.deepStrictEqual(li._ctx().map((it) => it.label), ["Reschedule", "Skip", "Preview"]);
    assert.ok(!li.kids.some((k) => k.className === "miss-more") && !/\bmiss\b/.test(li.className) && li.kids[0].kids.some((k) => k.className === "chev"), "and its chevron");
    for (const mode of ["today", "past"]) assert.ok(fns.workoutRow(maps.trainings.get("u1"), mode, true).kids[0].kids.some((k) => k.className === "chev"), mode + ": its chevron");
    li._full(); assert.strictEqual(fns.datePicker() && fns.datePicker().title, "Reschedule", "its full swipe: the days"); fns.closeDatePicker();
  });
  quiet();
});

test("a past day's own sheet: a workout still to do says Missed in red, with no \"…\" and nothing to swipe (its choices are on the Missed card)", () => {
  setup(false, { m1: -2 });
  drawing(() => {
    const li = fns.workoutRow(maps.trainings.get("m1"), "next"), sec = li.kids[0].kids[2].kids[1];
    assert.deepStrictEqual([sec.kids[0].className, sec.kids[0].textContent], ["missed", "Missed"]);
    assert.deepStrictEqual(li.kids.map((k) => k.tagName), ["BUTTON"], "the row alone: no \"…\", no actions behind it, no buttons under it");
  });
  quiet();
});

test("Do it today: today; the client's through the server's own rule, the coach's an ordinary save; never marked as decided; nothing once it is no longer missed", () => {
  setup(true, { m1: -2 }); fns.render();
  assert.strictEqual(fns.doToday("m1"), true);
  let t = maps.trainings.get("m1");
  assert.deepStrictEqual([t.date, maps.pendingMove.has("m1"), maps.pendingMiss.has("m1"), "missed" in t, maps.dirty.has("trainings/m1")], [fns.today(), true, false, false, true], "the client's: client_move_training, nothing about missed");
  setup(false, { m1: -2 }); maps.trainings.get("m1").missed = false;   // (brought back once by Undo: moved, the week counts again)
  drawing((got) => {
    fns.render(); assert.strictEqual(fns.doToday("m1"), true); t = maps.trainings.get("m1");
    assert.deepStrictEqual([t.date, maps.pendingMove.has("m1"), "missed" in t, maps.dirty.has("trainings/m1")], [fns.today(), false, false, true], "the coach's: an ordinary save");
    assert.ok(["date", "skippedAt", "missed"].every((f) => (maps.trainerState.get("m1") || new Set()).has(f)), "his: it stands over a filing another device sent meanwhile");
    assert.deepStrictEqual([tids(got.missList), tids(got.todayList), $("missHead").hidden], [[], ["m1"], true], "the page redrawn: off the card, on Today");
  });
  for (const [why, extra, n] of [["finished meanwhile", { completedAt: "2026-11-02T18:00:00.000Z" }, -2], ["skipped meanwhile", { skippedAt: "2026-11-02T18:00:00.000Z" }, -2], ["already today", {}, 0], ["ahead", {}, 3], ["a template's", { clientId: TEMPLATES_ID }, -2], ["no day", { date: null }, -2]]) {
    setup(false); W("m1", n, extra); const before = maps.trainings.get("m1").date;
    assert.strictEqual(fns.doToday("m1"), false, why); assert.strictEqual(maps.trainings.get("m1").date, before, why + ": its day stays");
  }
  setup(false); assert.strictEqual(fns.doToday("gone"), false, "deleted meanwhile");
  quiet();
});

test("Skip all asks first; Cancel keeps them; Skip all files every workout still missed as skipped (the client's through the server's rules), not the ones ahead; leaving the page while it asks takes nothing", async () => {
  const H = {};
  for (const id of ["askYes", "askNo"]) { const b = el("button"); b.addEventListener = (t, fn) => { (H[id] ||= []).push(fn); }; b.removeEventListener = (t, fn) => { H[id] = (H[id] || []).filter((f) => f !== fn); }; byId.set(id, b); }
  const answer = (id) => { for (const fn of [...(H[id] || [])]) fn({}); };
  try {
    setup(true, { m1: -1, m2: -3, t0: 0, u1: 1 }); fns.render();
    assert.strictEqual($("skipAll").hidden, false, "two missed: Skip all shows");
    const no = fns.skipAllMissed();
    assert.deepStrictEqual([$("askSheet").hidden, $("askTitle").textContent, $("askText").textContent, $("askYes").textContent], [false, "Skip 2 missed workouts?", "They move to History as skipped.", "Skip all"], "the question first");
    answer("askNo"); assert.strictEqual(await no, false);
    assert.ok(["m1", "m2"].every((id) => !maps.trainings.get(id).skippedAt), "Cancel: both still missed");
    const yes = fns.skipAllMissed(); await tick(400); answer("askYes"); assert.strictEqual(await yes, true);
    for (const id of ["m1", "m2"]) {
      const t = maps.trainings.get(id);
      assert.deepStrictEqual([!!t.skippedAt, t.missed, "skipReason" in t, maps.pendingSkip.has(id), maps.pendingMiss.has(id), maps.dirty.has("trainings/" + id)], [true, false, false, true, true, true], id + ": skipped by a person (History says Skipped), through client_skip and client_miss_training, saved");
    }
    assert.ok(["t0", "u1"].every((id) => !maps.trainings.get(id).skippedAt), "today's and the one ahead stay");
    assert.strictEqual($("missHead").hidden, true, "the card goes");
    setup(false, { m1: -1, m2: -3 }); fns.render();
    const coach = fns.skipAllMissed(); await tick(400); answer("askYes"); assert.strictEqual(await coach, true);
    for (const id of ["m1", "m2"]) assert.deepStrictEqual([maps.dirty.has("trainings/" + id), maps.pendingSkip.has(id), maps.pendingMiss.has(id), ["skippedAt", "missed", "skipReason"].every((f) => (maps.trainerState.get(id) || new Set()).has(f))], [true, false, false, true], id + ", the coach's: an ordinary save, his fields claimed, no client rule");
    for (const [name, open] of [["his History of her", fns.openHistoryPage], ["her card", fns.showClientCard]]) {
      setup(false, { m1: -1, m2: -3 }); fns.render();
      const asked = fns.skipAllMissed(); open(); await tick(400); answer("askYes");
      assert.strictEqual(await asked, false, name + " opened while it asked: nothing"); assert.ok(["m1", "m2"].every((id) => !maps.trainings.get(id).skippedAt)); fns.leaveSettings();
    }
    setup(false, { m1: -1, m2: -3 }); fns.render();
    const left = fns.skipAllMissed(); app.set({ view: { name: "clients" } }); fns.render(); await tick(400); answer("askYes");
    assert.strictEqual(await left, false); assert.ok(["m1", "m2"].every((id) => !maps.trainings.get(id).skippedAt), "left her page while it asked: nothing");
    setup(false, { m1: -1, m2: -3 }); fns.render();
    const one = fns.skipAllMissed(); W("m2", 2); await tick(400); answer("askYes");
    assert.strictEqual(await one, true); assert.deepStrictEqual([!!maps.trainings.get("m1").skippedAt, !!maps.trainings.get("m2").skippedAt], [true, false], "moved ahead meanwhile (another device): only the one still missed");
    setup(false, { m1: -1 }); fns.render(); assert.strictEqual(await fns.skipAllMissed(), false, "one alone: no Skip all (its own Skip)");
  } finally { byId.delete("askYes"); byId.delete("askNo"); quiet(); }
});

test("a week (his rule): a missed workout files itself under History as Missed, with something logged on it too; one a person brought back stays on the card; Do it today, then missed again, files itself a week later", () => {
  for (const client of [false, true]) {
    setup(client, { old: -8, week: -7 });
    W("logged", -9, { rows: [{ id: "r1", name: "Squat", label: "1", sets: "3", reps: "8", weights: ["100"], repsDone: ["8"], setsDone: 1, done: false }] });
    W("kept", -12, { missed: false });                                  // brought back by Undo on its page
    drawing((got) => {
      fns.render();
      for (const id of ["old", "logged"]) {
        const t = maps.trainings.get(id);
        assert.deepStrictEqual([!!t.skippedAt, t.missed, maps.pendingMiss.has(id)], [true, true, client], id + ": filed as Missed (" + (client ? "client, through client_miss_training" : "coach") + ")");
      }
      assert.deepStrictEqual(maps.trainings.get("logged").rows[0].weights, ["100"], "what was logged stays on it");
      assert.strictEqual(maps.trainings.get("week").skippedAt, null, "seven days: still on the card");
      assert.strictEqual(maps.trainings.get("kept").skippedAt, null, "brought back: never filed by itself");
      assert.deepStrictEqual(tids(got.missList), ["week"], "the card: the newest still missed, folded");
      foldOf(got.missList).click(); fns.render(); assert.deepStrictEqual(tids(got.missList), ["week", "kept"], "and the one brought back under it");
    });
    setup(client, { stale: -9 }); app.set({ sb: {}, syncedOnce: true, syncedOn: day(-2) }); fns.render();
    assert.strictEqual(maps.trainings.get("stale").skippedAt, null, "a server answer days old (an iPad woken offline): nothing filed");
    app.set({ syncedOn: fns.today() }); fns.render(); assert.ok(maps.trainings.get("stale").skippedAt, "one from today: filed"); app.set({ sb: null });
    setup(client, { m1: -2 }); fns.render(); fns.doToday("m1");
    const t = maps.trainings.get("m1"); t.date = day(-8); fns.render();      // a week and a day later, missed again
    assert.deepStrictEqual([!!t.skippedAt, t.missed], [true, true], "Do it today never marked it as decided: missed again, it files itself");
  }
  quiet();
});

test("the page: the Missed card above Today with Skip all on its title; the \"…\" disc as the exercise's; the paused and the library pages hide it; the buttons under the row are gone", () => {
  assert.ok(html.includes('<div data-tab="workouts" class="card-head miss-head" id="missHead" hidden><h2>Missed</h2><button type="button" class="miss-all" id="skipAll" hidden>Skip all</button></div>\n    <ul data-tab="workouts" class="list" id="missList" hidden></ul>\n    <h2 data-tab="workouts" class="card-head" id="todayHead" hidden>Today</h2>'), "the card's title and list, then Today's");
  assert.ok(/\.miss-head h2 \{ margin: 0; font: inherit; letter-spacing: inherit; text-transform: none; color: inherit; \}/.test(html), "its title in the card's own type, never the page's small capitals");
  assert.ok(/\.miss-all \{[^}]*min-height: 30px; margin: -6px -8px -2px 0;[^}]*border-radius: 50px; background: var\(--glyph-fill\);/.test(html), "Skip all: a 30 capsule, inside the title bar (14 over a 22.1 line, 2 under it): the first row never covers its foot");
  assert.ok(html.includes(".miss-all::after { content: \"\"; position: absolute; inset: -9px -4px -2px; }"), "its target up to the card's top, never over the first row");
  assert.ok(/\.list li\.w > button\.miss-more \{[^}]*width: 36px; height: 36px;[^}]*border-radius: 50%; corner-shape: round; background: var\(--glyph-fill\);/.test(html), "the \"…\": the coach's exercise disc, a true circle");
  assert.ok(html.includes(".list li.swipe-row.swiped > button.miss-more { background: var(--glyph-fill); }"), "it keeps its disc on the swiped row's grey");
  assert.ok(html.includes(".list li.w.miss > button:not(.miss-more) { padding-right: 60px; }"), "the words stop short of it");
  assert.ok(html.includes(".list li.swipe-row:last-child > :first-child {"), "the last row's own button keeps the card's corners, with the \"…\" after it");
  assert.ok(html.includes("body.client.paused #missHead, body.client.paused #missList,") && html.includes("#vClient.tpl #missHead, #vClient.tpl #missList,"), "paused, or the library: no card");
  assert.ok(!html.includes("missed-actions"), "no buttons under the row any more");
});
