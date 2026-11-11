// His asks, 10 Nov: "I want to create a workout preview very simple and clean … and add it to the swipe options … at the bottom there will be
// something like go to workout and cancel"; "it can look like my closed cards in actual workout", "not exactly like that but aesthetically
// pleasing and simple"; then "I want nicer preview", "no green lines in preview", "I don't need any buttons and chevrons", "I want the preview
// option on the same swipe as reschedule and skip", "leave it as is just add preview" (Today stays a missed workout's), "it can say start
// workout … whatever Apple would say" (Apple's Fitness: Start Workout on a planned one). A sheet on the page's grey: the workout's title and
// day as its page writes them, its cards as Apple draws an inset grouped list (one card per number, a superset together): each exercise's
// number, name (and subtitle), and sets and reps as the workout's cards write them; a finished card says so in a quiet line, nothing green;
// Start workout and Cancel at the foot. The swipe itself runs in row-swipe-probe.mjs, the sheet's buttons in month-menu-probe.mjs.
import fs from "node:fs";
import { test, assert, tick } from "./assert.js";
import { load } from "./load.js";
import { TEMPLATES_ID } from "../app/model.js";
const app = await load();
const { fns, maps } = app;
const $ = (id) => document.getElementById(id);
const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const day = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return fns.localIso(d); };   // the app's local day (never UTC)
const longDay = (iso) => { const [y, m, d] = iso.split("-").map(Number); return new Date(y, m - 1, d, 12).toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric", ...(y !== new Date().getFullYear() ? { year: "numeric" } : {}) }); };
const row = (id, label, name, sets, reps, extra = {}) => ({ id, label, name, sets, reps, rest: "60 sec", tempo: "", weights: [], repsDone: [], setsDone: 0, done: false, note: "", alts: [], ...extra });
const quiet = () => { for (const t of maps.timers.values()) clearTimeout(t); maps.timers.clear(); fns.closePreview(); };
const page = (client, rows, extra = {}) => {
  quiet(); app.reset(); app.set({ signedIn: true, clientMode: client, myClientId: client ? "c1" : null, tab: "workouts" });
  maps.clients.set("c1", { id: "c1", name: "Jane", unit: "lb" }); maps.clients.set(TEMPLATES_ID, { id: TEMPLATES_ID, name: "Templates" });
  maps.trainings.set("w1", { id: "w1", clientId: "c1", title: "Shoulders + back", date: day(1), createdAt: "2026-11-01T10:00:00.000Z", completedAt: null, skippedAt: null, rows, ...extra });
  maps.trainings.set("tp", { id: "tp", clientId: TEMPLATES_ID, title: "Push", date: null, createdAt: "2026-11-01T10:00:00.000Z", completedAt: null, skippedAt: null, rows: [] });
  app.set({ view: { name: "client", id: "c1" } }); fns.render();
};
// elements that keep what is put in them while fn runs (the shared stand-in drops them); the sheet's cards are kept as they are drawn, and
// every element made (got.all); a chip's lookups answer (the workout page's cards ask for them)
function seeing(fn) {
  const make = document.createElement, cards = $("pvCards"), got = { cards: [], all: [] };
  const chip = (sel) => (sel === ".chip" ? make("div") : null);
  document.createElement = (tag) => { const e = make(tag); e.kids = []; e.append = (...k) => { e.kids.push(...k); }; e.appendChild = (c) => { e.kids.push(c); return c; }; e.closest = chip; e.querySelector = () => { const c = make("input"); c.closest = chip; return c; }; e.querySelectorAll = (sel) => (sel === ".specs .chip" ? [make("div"), make("div")] : []); got.all.push(e); return e; };
  cards.replaceChildren = (...k) => { got.cards = k; };
  try { return fn(got); } finally { document.createElement = make; delete cards.replaceChildren; }
}
const walk = (n, f) => { f(n); for (const k of n.kids || []) if (k && typeof k === "object") walk(k, f); };
const capOf = (el) => el.textContent + el.kids.map((k) => k.textContent).join("");   // a caption's words, its "· Superset" included
const card = (w) => { const c = w.kids[1]; return { grp: w.className, cap: w.kids[0].className + ":" + capOf(w.kids[0]), cls: c.className, rows: c.kids.filter((k) => k.className === "pv-row").map((r) => ({ l: r.kids[0].textContent, b: r.kids[1].kids.map((k) => (k.className === "pv-sum" ? "sum:" + k.kids.map((s) => s.textContent).join(" \u00b7 ") : k.className + ":" + k.textContent)) })), foot: c.kids.filter((k) => k.className === "pv-foot").map((f) => f.kids.map((x) => x.textContent)) }; };   // a card under its caption

test("the preview: the title and day as the workout page writes them; one card per number (a superset together) under its caption as the client's workout page writes it (\"EXERCISE 2 \u00b7 SUPERSET\", his pick B), each exercise's number, name and subtitle, and its sets and reps as the workout's cards write them; both views", () => {
  for (const client of [false, true]) {
    page(client, [row("a", "1", "Back squat", 4, "8"), row("b", "2a", "Seated dumbbell front raise (neutral-grip)", 3, "10, 8, 6"), row("c", "2b", "Plank", 3, "30 sec"), row("d", "3", "Walking lunge", 1, "8 / side")]);
    seeing((got) => {
      assert.strictEqual(fns.openPreview("w1"), true);
      assert.deepStrictEqual([$("pvTitle").textContent, $("pvDay").textContent], ["Shoulders + back", longDay(day(1))], "its title, its day (\"Wednesday, Nov 11\")");
      assert.deepStrictEqual(got.cards.map(card), [
        { grp: "pv-grp", cap: "pv-cap:Exercise 1", cls: "pv-card", rows: [{ l: "1", b: ["pv-n:Back squat", "sum:4 sets \u00b7 8 reps"] }], foot: [] },
        { grp: "pv-grp", cap: "pv-cap:Exercise 2 \u00b7 Superset", cls: "pv-card", rows: [{ l: "2a", b: ["pv-n:Seated dumbbell front raise", "pv-sub:neutral-grip", "sum:3 sets \u00b7 10, 8, 6 reps"] }, { l: "2b", b: ["pv-n:Plank", "sum:3 sets \u00b7 30 sec"] }], foot: [] },
        { grp: "pv-grp", cap: "pv-cap:Exercise 3", cls: "pv-card", rows: [{ l: "3", b: ["pv-n:Walking lunge", "sum:1 set \u00b7 8 reps / side"] }], foot: [] },
      ], (client ? "client" : "coach") + ": the cards");
    });
  }
  quiet();
});

test("a finished card stays as plain as the others (no green, his ask) and says so in a quiet line: finished, finished early, or skipped with nothing logged, the same lines its folded card writes; nothing added: a line", () => {
  const full = { done: true, setsDone: 3 };
  page(true, [row("a", "1a", "Bench press", 3, "8", full), row("b", "1b", "Row", 3, "8", full),
    row("c", "2", "Dip", 4, "12", { done: true, setsDone: 2, earlyReason: "Tired" }),
    row("d", "3", "Curl", 3, "10", { done: true, setsDone: 0, earlyReason: "Pain" }), row("e", "4", "Shrug", 3, "10")]);
  seeing((got) => {
    fns.openPreview("w1");
    assert.deepStrictEqual(got.cards.map(card), [
      { grp: "pv-grp", cap: "pv-cap:Exercise 1 \u00b7 Superset", cls: "pv-card", rows: [{ l: "1a", b: ["pv-n:Bench press", "sum:3 sets \u00b7 8 reps"] }, { l: "1b", b: ["pv-n:Row", "sum:3 sets \u00b7 8 reps"] }], foot: [["Finished \u00b7 3 of 3 sets"]] },
      { grp: "pv-grp", cap: "pv-cap:Exercise 2", cls: "pv-card", rows: [{ l: "2", b: ["pv-n:Dip", "sum:4 sets \u00b7 12 reps"] }], foot: [["Finished early \u00b7 2 of 4 sets", "2 sets not completed \u00b7 Tired"]] },
      { grp: "pv-grp", cap: "pv-cap:Exercise 3", cls: "pv-card", rows: [{ l: "3", b: ["pv-n:Curl", "sum:3 sets \u00b7 10 reps"] }], foot: [["Skipped \u00b7 Pain"]] },
      { grp: "pv-grp", cap: "pv-cap:Exercise 4", cls: "pv-card", rows: [{ l: "4", b: ["pv-n:Shrug", "sum:3 sets \u00b7 10 reps"] }], foot: [] },
    ]);
    assert.deepStrictEqual(fns.groupSummary({ rows: [row("x", "1", "A", 3, "8", full)] }), { early: false, skipped: false, lines: ["Finished \u00b7 3 of 3 sets"] }, "the workout page's folded card and the preview write the same lines (one helper)");
  });
  page(false, []);
  seeing((got) => { fns.openPreview("w1"); assert.deepStrictEqual(got.cards.map((c) => [c.className, c.textContent]), [["pv-none", "Nothing added yet"]]); });
  quiet();
});

test("it opens for a workout of a client's, in both views, and holds the page while it is up; never for a template, never twice, never over another question; rows next to each other under one number are one card", () => {
  for (const client of [false, true]) {
    page(client, [row("a", "1", "Squat", 3, "5")]);
    assert.strictEqual(fns.openPreview("w1"), true, client ? "client" : "coach");
    assert.deepStrictEqual([$("pvSheet").hidden, app.get().asking, fns.previewState()], [false, true, { id: "w1" }], "up: a sync swaps nothing under it");
    assert.strictEqual(fns.openPreview("w1"), false, "never twice");
    assert.strictEqual(fns.closePreview(), true); assert.deepStrictEqual([$("pvSheet").hidden, app.get().asking, fns.previewState()], [true, false, null], "closed: the page is the page's again");
  }
  assert.strictEqual(fns.closePreview(), false, "nothing to close");
  assert.strictEqual(fns.openPreview("tp"), false, "a template: no");
  assert.strictEqual(fns.openPreview("gone"), false, "deleted meanwhile: no");
  app.set({ asking: true }); assert.strictEqual(fns.openPreview("w1"), false, "another question up: it waits for that one"); app.set({ asking: false });
  assert.deepStrictEqual(fns.groupsOf([row("a", "1a", "A", 1, "1"), row("b", "1b", "B", 1, "1"), row("c", "2", "C", 1, "1"), row("d", "1", "D", 1, "1")]).map((g) => g.rows.map((r) => r.id).join("")), ["ab", "c", "d"]);
  quiet();
});

test("a sync's redraw while it is up: it shows the workout as it is now, and goes with it when it is gone", () => {
  page(true, [row("a", "1", "Squat", 3, "5")]);
  fns.openPreview("w1"); maps.trainings.get("w1").title = "Legs"; fns.render();
  assert.deepStrictEqual([$("pvTitle").textContent, fns.previewState()], ["Legs", { id: "w1" }], "renamed on the coach's side: the new title");
  maps.trainings.delete("w1"); fns.render();
  assert.deepStrictEqual([fns.previewState(), $("pvSheet").hidden, app.get().asking], [null, true, false], "deleted: it goes, and the page is free");
  quiet();
});

test("Preview on the same swipe as Skip and Reschedule (his pick, 10 Nov), innermost; last in the row's touch and hold and right-click and in a missed workout's \u2026, as the swipe lists them outermost first; each opens the preview", () => {
  page(false, [row("a", "1", "Squat", 3, "5")]);
  const menu = fns.rowMenu("w1"); assert.deepStrictEqual(menu.map((it) => it.label), ["Reschedule", "Skip", "Preview"]); assert.strictEqual(menu[2].icon, fns.menuIcons().eye);
  menu[2].onPick(); assert.deepStrictEqual(fns.previewState(), { id: "w1" }, "its pick opens the preview"); fns.closePreview();
  maps.trainings.get("w1").date = day(-2); const miss = fns.missItems("w1");
  assert.deepStrictEqual(miss.map((it) => it.label), ["Do it today", "Reschedule", "Skip", "Preview"]);
  miss[3].onPick(); assert.deepStrictEqual(fns.previewState(), { id: "w1" }); fns.closePreview();
  const make = document.createElement; document.createElement = (tag) => { const e = make(tag); e.kids = []; e.on = {}; e.appendChild = (c) => { e.kids.push(c); return c; }; e.append = (...k) => { e.kids.push(...k); }; e.addEventListener = (t, f) => { (e.on[t] ||= []).push(f); }; return e; };
  try {
    for (const [mode, n] of [["next", 3], ["missed", 3]]) {
      const li = fns.workoutRow(maps.trainings.get("w1"), mode, true), acts = li.kids.find((k) => k.className === "swipe-acts").kids;
      assert.strictEqual(acts.length, n, mode); assert.strictEqual(acts[0].className, "swipe-act sa-prev", mode + ": Preview innermost");
      assert.ok(/<span class="sa-lbl">Preview<\/span>/.test(acts[0].innerHTML) && /fill-rule="evenodd"/.test(acts[0].innerHTML), "its eye, filled as the swipe's are, and its title");
      acts[0].on.click[0]({ stopPropagation() {} }); assert.deepStrictEqual(fns.previewState(), { id: "w1" }, mode + ": its tap opens the preview"); fns.closePreview();
      assert.ok(!li.kids.some((k) => /swipe-lead/.test(k.className || "")), "no swipe to the right (his pick: the same swipe)");
    }
  } finally { document.createElement = make; }
  quiet();
});

test("what was inert stays inert (#ctxLift, inert in the markup, lets a tap on a touch and hold's lifted row through to open it); the page behind is held while the sheet is up and given back after; the sheet itself never held", () => {
  page(true, [row("a", "1", "Squat", 3, "5")]);
  const main = { inert: false }, lift = { inert: true }, sheet = $("pvSheet"); sheet.inert = false; document.body.children = [main, lift, sheet];
  try {
    fns.openPreview("w1"); assert.deepStrictEqual([main.inert, lift.inert, sheet.inert], [true, true, false], "up: the page held, the sheet free");
    fns.closePreview(); assert.deepStrictEqual([main.inert, lift.inert, sheet.inert], [false, true, false], "closed: the page given back, the lifted copy still inert");
  } finally { document.body.children = []; }
});

test("it opens at its first card and goes into the sheet (a keyboard or VoiceOver reads it from its title); a sync's repaint keeps the reader's place; a sync's new record (mergeDown puts a new object) is what it shows", async () => {
  page(true, [row("a", "1", "Squat", 3, "5")]);
  $("pvCards").scrollTop = 240; await tick(5); let f = 0; $("pvBox").focus = () => { f++; };
  try {
    fns.openPreview("w1"); assert.strictEqual($("pvCards").scrollTop, 0, "at the top"); await tick(5); assert.strictEqual(f, 1, "focus into the sheet");
    $("pvCards").scrollTop = 240; fns.render(); assert.strictEqual($("pvCards").scrollTop, 240, "a repaint keeps the place");
    maps.trainings.set("w1", { ...maps.trainings.get("w1"), title: "Legs" }); fns.render(); assert.strictEqual($("pvTitle").textContent, "Legs", "the new record");
  } finally { delete $("pvBox").focus; quiet(); }
});

test("nothing to tap inside the cards (his ask: no buttons, no chevrons): a row is its number and its body alone; a half-done superset says nothing yet; blank reps read as the page's grey 10; a nameless exercise and an untitled workout read as their rows do", () => {
  page(true, [row("a", "1a", "Bench press", 3, "8", { done: true, setsDone: 3 }), row("b", "1b", "Row", 3, "8"), row("c", "2", "", 4, "")], { title: "  " });
  seeing((got) => {
    fns.openPreview("w1");
    assert.deepStrictEqual(got.cards.map((w) => [w.className, w.kids[1].kids.filter((k) => k.className === "pv-foot").length]), [["pv-grp", 0], ["pv-grp", 0]], "no status line until the whole card is done");
    const bad = []; for (const c of got.cards) walk(c, (n) => { if (n.tagName === "BUTTON" || /\bchev\b/.test(n.className || "")) bad.push(n.className || n.tagName); });
    assert.deepStrictEqual(bad, [], "no buttons, no chevrons");
    assert.deepStrictEqual(got.cards.map((w) => w.kids.map((k) => k.className)), [["pv-cap", "pv-card"], ["pv-cap", "pv-card"]], "each card under its caption, nothing else beside it");
    for (const w of got.cards) for (const r of w.kids[1].kids.filter((k) => k.className === "pv-row")) assert.deepStrictEqual(r.kids.map((k) => k.className), ["pv-l", "pv-b"], "a row: its number and its body, nothing else");
    assert.deepStrictEqual(card(got.cards[1]).rows, [{ l: "2", b: ["pv-n:Exercise", "sum:4 sets · 10 reps"] }], "blank: Exercise, and the page's 10 reps");
    assert.strictEqual($("pvTitle").textContent, "Workout");
  });
  quiet();
});

test("a card's caption, one helper for the client's workout page and the preview: Exercise and its number, a superset, tri-set or giant set beside it, Warmup for the warm-up, a label without a number just Exercise", () => {
  const C = (label, n) => fns.groupCaption({ key: fns.groupKey(label, 0), rows: Array(n).fill(0) });
  assert.deepStrictEqual([C("1", 1), C("2a", 2), C("3a", 3), C("4a", 4), C("W", 1), C("Wa", 2), C("A1", 1)], [{ main: "Exercise 1", kind: "" }, { main: "Exercise 2", kind: "Superset" }, { main: "Exercise 3", kind: "Tri-set" }, { main: "Exercise 4", kind: "Giant set" }, { main: "Warmup", kind: "" }, { main: "Warmup", kind: "Superset" }, { main: "Exercise", kind: "" }]);
});

test("the status lines' edge cases, as v257's folded card wrote them: a superset of unequal sets counts the larger, one set left, no reason given, a one-set exercise", () => {
  const L = (rows) => fns.groupSummary({ rows }).lines;
  assert.deepStrictEqual(L([row("a", "1a", "A", 4, "8", { done: true, setsDone: 4 }), row("b", "1b", "B", 3, "8", { done: true, setsDone: 3 })]), ["Finished · 4 of 4 sets"]);
  assert.deepStrictEqual(L([row("a", "1", "A", 3, "8", { done: true, setsDone: 2, earlyReason: "Tired" })]), ["Finished early · 2 of 3 sets", "1 set not completed · Tired"]);
  assert.deepStrictEqual(L([row("a", "1", "A", 3, "8", { done: true, setsDone: 0 })]), ["Skipped"]);
  assert.deepStrictEqual(L([row("a", "1", "A", 1, "8", { done: true, setsDone: 1 })]), ["Finished · 1 of 1 set"]);
});

test("the workout page's own finished cards (one helper with the preview now): their lines, Resume only on one finished early, grey only when nothing was logged, as v257", () => {
  page(true, [row("a", "1", "Bench", 3, "8", { done: true, setsDone: 3 }), row("b", "2", "Dip", 4, "12", { done: true, setsDone: 2, earlyReason: "Tired" }), row("c", "3", "Curl", 3, "10", { done: true, setsDone: 0, earlyReason: "Pain" }), row("d", "4", "Shrug", 3, "10")]);
  seeing((got) => {
    app.set({ view: { name: "training", id: "w1" }, renderedTraining: null }); fns.render();
    assert.deepStrictEqual(got.all.filter((e) => e.className === "card-sum").map((s) => s.kids.map((d) => d.textContent)), [["Finished · 3 of 3 sets"], ["Finished early · 2 of 4 sets", "2 sets not completed · Tired"], ["Skipped · Pain"], []]);
    assert.deepStrictEqual(got.all.filter((e) => e.className === "resume").map((b) => b.hidden), [true, false, false, true], "Resume: on the two finished early");
    assert.deepStrictEqual(got.all.filter((e) => e.className === "block").map((b) => b.classList.contains("skipped")), [false, false, true, false], "grey: the one with nothing logged");
    assert.deepStrictEqual(got.all.filter((e) => e.className === "num").map(capOf), ["Exercise 1", "Exercise 2", "Exercise 3", "Exercise 4"], "the client's own captions, from the same helper as the preview's");
  });
  app.set({ view: { name: "client", id: "c1" } }); quiet();
});

test("the keyboard's place: back to what had it when the preview opened if it is still there and not a swipe button, else to the row's button on the client's page; never the body; given after the page is free", () => {
  page(false, [row("a", "1", "Squat", 3, "5")]);
  const main = { inert: false }, sheet = $("pvSheet"); sheet.inert = false; document.body.children = [main, sheet];
  const rowBtn = { n: 0, focus() { this.n++; } }, vc = $("vClient"); vc.querySelector = (s) => (s === 'li[data-tid="w1"] > button' ? rowBtn : null);
  const mk = (x = {}) => ({ n: 0, held: null, isConnected: true, closest: () => null, focus() { this.n++; this.held = main.inert; }, ...x });
  try {
    for (const [k, back, own] of [["live", mk(), true], ["gone", mk({ isConnected: false }), false], ["body", document.body, false], ["swipe", mk({ closest: (s) => (s === ".swipe-acts" ? {} : null) }), false]]) {
      rowBtn.n = 0; document.activeElement = back; fns.openPreview("w1"); document.activeElement = $("pvBox"); fns.closePreview(true);
      if (own) assert.deepStrictEqual([back.n, back.held, rowBtn.n], [1, false, 0], k + ": back to it, the page already free");
      else assert.deepStrictEqual([rowBtn.n, back === document.body ? 0 : back.n], [1, 0], k + ": the row's button");
    }
    const live = mk(); rowBtn.n = 0; document.activeElement = live; fns.openPreview("w1"); fns.closePreview(); assert.deepStrictEqual([live.n, rowBtn.n], [0, 0], "a tap's close (no refocus) moves nothing");
  } finally { delete vc.querySelector; document.activeElement = null; document.body.children = []; quiet(); }
});

test("the day's sheet (sheetList: a day of two workouts, Copy workout to) holds the page and gives back only that; #ctxLift, inert in the markup, stays inert; never its own sheet", async () => {
  const lift = { inert: true }, main = { inert: false }, bg = $("pickSheet"); bg.inert = false; document.body.children = [main, lift, bg];
  let no = null; const pn = $("pickNo"); pn.addEventListener = (t, f) => { if (t === "click") no = f; };
  try {
    const p = fns.sheetList({ title: "Tuesday", rows: [] });
    assert.deepStrictEqual([main.inert, lift.inert, bg.inert], [true, true, false], "up");
    no(); assert.strictEqual(await p, null);
    assert.deepStrictEqual([main.inert, lift.inert, bg.inert], [false, true, false], "closed");
  } finally { document.body.children = []; delete pn.addEventListener; }
});

test("his colour rule in any spelling (every colour one place, one reason, one use): the teal is Preview's capsule alone, Steel blue saved for rest; blank or missing reps read as the page's grey 10, the reps box's own default", () => {
  const appJs = fs.readdirSync(new URL("../app/", import.meta.url)).filter((f) => f.endsWith(".js")).map((f) => fs.readFileSync(new URL("../app/" + f, import.meta.url), "utf8")).join("\n");
  const all = html + appJs;
  assert.strictEqual((all.match(/var\(--swipe-preview\)/g) || []).length, 1, "one use: Preview's capsule");
  assert.strictEqual((all.match(/#006072|\b0[,\s]+96[,\s]+114\b/gi) || []).length, 1, "the value once, in any spelling");
  assert.strictEqual((all.match(/#5e8ca7|\b94[,\s]+140[,\s]+167\b/gi) || []).length, 0, "Steel blue nowhere (saved for rest)");
  assert.ok(/<input class="reps tab" inputmode="decimal" placeholder="\$\{REPS_DEFAULT\}"/.test(appJs) && /const REPS_DEFAULT = "10";/.test(appJs), "the reps box's grey and the preview's blank reps: one constant");
  for (const reps of [null, undefined]) {
    page(false, [row("a", "1", "Squat", 3, reps)]);
    seeing((got) => { fns.openPreview("w1"); assert.deepStrictEqual(card(got.cards[0]).rows, [{ l: "1", b: ["pv-n:Squat", "sum:3 sets · 10 reps"] }], String(reps)); });
  }
  quiet();
});

test("the page around the preview: every sheet's own height cap (24 below the status bar) and none of the preview's own; the list's keyboard ring; the hairline's 30 is the row's left padding plus its gap", () => {
  assert.ok(/\n  \.sheet \{[^}]*max-height: calc\(100% - env\(safe-area-inset-top, 0px\) - 24px\);/.test(html), "the base cap the preview stands on");
  assert.deepStrictEqual([...html.matchAll(/([^{}]*)\{([^{}]*)\}/g)].filter((m) => /pv-sheet/.test(m[1]) && /(?:^|;)\s*(?:max-)?height\s*:/.test(m[2])).map((m) => m[0].trim()), [], "no height of its own");
  assert.ok(html.includes(".pv-cards:focus-visible { outline: 2px solid var(--brand); outline-offset: 2px; border-radius: var(--r-card); }"), "a keyboard sees where it is");
  const m = /\.pv-row \{[^}]*\bgap: (\d+)px;[^}]*\bpadding: \d+px \d+px \d+px (\d+)px;/.exec(html);
  assert.ok(m && +m[1] + +m[2] === 30, "the 30 in calc(30px + 2rem): the row's 18 plus its 12");
});

test("the page: the sheet on the page's grey (in dark Apple's raised pair, so it has an edge on the dimmed black), its title and day in the workout page's type, the cards as Apple's inset grouped list (no green, no buttons or chevrons in them), Start workout at the foot and Apple's close cross in the corner (no Cancel); Preview's capsule his peacock teal (its one job)", () => {
  assert.ok(html.includes('<div class="sheet-bg" id="pvSheet" hidden><div class="sheet pv-sheet" id="pvBox" role="dialog" aria-modal="true" aria-labelledby="pvTitle" tabindex="-1"><button class="pv-x" id="pvX" type="button" aria-label="Close"><svg viewBox="0 0 18 18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round"><path d="M1.7 1.7 16.3 16.3M16.3 1.7 1.7 16.3"/></svg></button><h3 id="pvTitle"></h3><p class="pv-day" id="pvDay"></p><div class="pv-cards" id="pvCards" tabindex="0" role="group" aria-label="Exercises"></div><div class="ask-actions"><button class="btn" id="pvGo" type="button">Start workout</button></div></div></div>'), "a dialog named by its title; first the close cross (named Close), then the list a keyboard can reach and scroll; Start workout filled (Apple's Fitness word), alone (no Cancel, his ask)");
  assert.ok(/\.pv-x \{[^}]*border-radius: 50%;[^}]*margin: 0 0 10px;[^}]*background: var\(--disc-fill\); color: var\(--disc-ink\);[^}]*width: 44px; height: 44px;/.test(html) && html.includes(".pv-x svg { width: 18px; height: 18px; flex: none; }") && html.includes(".pv-x:focus-visible { outline: 2px solid var(--brand); outline-offset: 2px; }"), "the cross: a 44-point circle in the app's round-button grey (as the back button), its 18-point mark, a keyboard's ring");
  assert.ok(html.includes(".sheet.pv-sheet { background: var(--pv-bg); display: flex; flex-direction: column; padding-top: 16px; }"), "a column (the cross, title, cards, button) at the base sheet's height, 24 below the status bar (no cap of its own); the cross 16 from its top and left edges, as Apple's");
  assert.ok(html.includes(".pv-cards { flex: 1 1 auto; min-height: 0; overflow-y: auto; overscroll-behavior: contain;"), "the cards scroll inside it, the buttons stay at its foot");
  assert.ok(html.includes(".pv-cap { margin: 0 0 0 18px; font-size: 0.8125rem; font-weight: 500; letter-spacing: 0.10em; line-height: 1.25rem; text-transform: uppercase; color: var(--text-secondary); }") && html.includes(".pv-cap i { font-style: normal; color: var(--text-tertiary); }") && html.includes(".pv-grp { display: grid; gap: 7px; }"), "the caption in the client's workout page's small caps (13, 500, 0.10em, Steel), \"\u00b7 SUPERSET\" a shade lighter, over the number's column, 7 above its card");
  assert.ok(html.includes("    --pv-bg: var(--surface); --pv-card: var(--card);") && (html.match(/--pv-bg: #1c1c1e; --pv-card: #2c2c2e;/g) || []).length === 2, "light: the page's grey and white cards; dark (both blocks): Apple's raised #1c1c1e and #2c2c2e");
  assert.ok(html.includes(".pv-sheet h3 { margin: 0 4px 2px; font-size: 1.625rem; line-height: 1.15; font-weight: 600;") && html.includes(".pv-day { margin: 0 4px 16px; font-size: 1.0625rem; color: var(--text-secondary); }"), "the workout page's title (26, semibold) and its day (17, Steel)");
  const pvCss = html.slice(html.indexOf("/* the workout preview (his asks"), html.indexOf(".pv-sheet .ask-actions")); assert.ok(pvCss.length > 500, "the preview's own rules");
  assert.ok(html.includes(".pv-card { background: var(--pv-card); border: 1px solid var(--card-edge); border-radius: var(--r-card); }") && !/pv-card\.done|--done|#3c7a4e|#bfe8c2/i.test(pvCss), "every card as the page's, nothing green (by token or by value)");
  assert.ok(html.includes(".pv-row + .pv-row::before { content: \"\"; position: absolute; top: 0; right: 0; left: calc(30px + 2rem); border-top: 1px solid var(--card-border); }") && html.includes(".pv-foot { padding: 0 16px 13px calc(30px + 2rem);"), "Apple's inset hairline, from the name to the card's edge, and the finished line under the name: both move with the number's column");
  assert.ok(html.includes(".pv-l { flex: none; width: 2rem; font-size: 1.0625rem; font-weight: 500; color: var(--text-tertiary);") && /\.pv-n \{[^}]*font-size: 1\.0625rem;[^}]*font-weight: 600;[^}]*color: var\(--text-primary\);/.test(html) && /\.pv-sum \{[^}]*font-size: 0\.9375rem;[^}]*color: var\(--text-secondary\);/.test(html), "the number quiet in a column that grows with Text Size (\"12b\" stays clear of the name), the name 17 semibold in ink, sets and reps 15 in Steel (what a client acts on is never tertiary)");
  assert.ok(html.includes(".pv-sum .si + .si::before { content: \"\\00b7\"; margin: 0 6px; }"), "sets \u00b7 reps");
  assert.ok(html.includes(".swipe-act.sa-prev .sa-cap { background: var(--swipe-preview); }") && (html.match(/--swipe-preview: [^;]*;/g) || []).join() === "--swipe-preview: #006072;", "Preview's capsule: his peacock teal, one value in both modes, its one job (his pick, 10 Nov)");
  assert.deepStrictEqual([(html.match(/#006072/gi) || []).length, (html.match(/#5e8ca7/gi) || []).length], [1, 0], "the teal nowhere else, and Steel blue saved (his rule: every colour one place, one reason, one use)");
});
