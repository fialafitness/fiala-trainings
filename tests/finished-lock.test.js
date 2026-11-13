// A finished workout, as the client sees it (his rule, 11 Nov: "They can only click the weight and rep and change that"; confirmed: no
// "Resume this exercise" at any age, notes stay, the coach's own view keeps everything): its cards done open to their sets (a set's weight
// and reps still tapped to fix), with no Resume; its cards not done stay folded, a look and no more: no Complete set, no Skip, no "Finish
// Exercise 3 first", no Start this exercise, no swap, no weight or reps typed in; a note on one stays hers to read and change. Undo (24 hours,
// undo-window.test.js) opens it all again at once. The page is drawn here with elements that keep their children, their listeners and
// what each looks up (the shared stand-in drops all three), and its chevrons and cards are tapped.
import fs from "node:fs";
import { test, assert } from "./assert.js";
import { load } from "./load.js";
const app = await load();
const { fns, maps } = app;
const $ = (id) => document.getElementById(id);
const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const day = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return fns.localIso(d); };   // the app's local day (never UTC)
const row = (id, label, name, extra = {}) => ({ id, label, name, sets: 1, reps: "12", rest: "60 sec", tempo: "", weights: [], repsDone: [], setsDone: 0, done: false, note: "", alts: [], ...extra });
const ROWS = () => [row("a", "1", "Leg press", { done: true, setsDone: 1, weights: ["100"], repsDone: ["12"] }), row("b", "2", "Lying leg curl", { done: true, setsDone: 0, earlyReason: "Tired" }),
  row("c", "3", "Calf raise", { alts: ["Seated calf raise"] }), row("d", "4", "Plank")];
const AGO = new Date(Date.now() - 72 * 3600e3).toISOString();
let made = 0;                                                         // each look its own workout: a card opened or looked at stays so in the app for that workout (its open and peek marks are the app's own)
function page(clientMode, finished, preview = false) {
  const id = "lock" + ++made;
  app.reset(); app.set({ signedIn: true, clientMode, myClientId: clientMode ? "c1" : null, tab: "workouts" });
  maps.clients.set("c1", { id: "c1", name: "Jane", unit: "lb" });
  maps.trainings.set(id, { id, clientId: "c1", title: "Legs", date: day(-3), createdAt: "2026-11-01T10:00:00.000Z", completedAt: finished ? AGO : null, skippedAt: null, rows: ROWS() });
  fns.setPreview(preview); app.set({ view: { name: "training", id }, renderedTraining: null });
  return maps.trainings.get(id);
}
function capture(run) {                                                // what the page draws while run() runs: its cards, every element made, with their children, listeners and look-ups
  const make = document.createElement, rows = $("rows"), got = { blocks: [], all: [] }, was = { ap: rows.appendChild, rc: rows.replaceChildren };
  const chip = (sel) => (sel === ".chip" ? make("div") : null);           // a chip's lookups answer (the cards' weight and reps ask for them), as preview.test.js's
  document.createElement = (tag) => { const e = make(tag); e.kids = []; e.on = {}; e.qs = {};
    e.append = (...k) => { e.kids.push(...k); }; e.appendChild = (c) => { e.kids.push(c); return c; }; e.prepend = (...k) => { e.kids.unshift(...k); }; e.after = () => {};
    e.closest = chip; e.querySelector = (sel) => e.qs[sel] || (e.qs[sel] = (() => { const c = make("input"); c.closest = chip; return c; })());   // the same part for the same look-up (a row's chevrons, asked for again as they are painted)
    e.querySelectorAll = (sel) => (sel === ".specs .chip" ? [make("div"), make("div")] : []);
    e.addEventListener = (type, f) => { (e.on[type] ||= []).push(f); }; got.all.push(e); return e; };
  rows.appendChild = (c) => { got.blocks.push(c); return c; }; rows.replaceChildren = (...k) => { got.blocks = [...k]; };
  try { run(); } finally { document.createElement = make; rows.appendChild = was.ap; rows.replaceChildren = was.rc; }
  return got;
}
const all = (n, out = []) => { out.push(n); for (const k of n.kids || []) if (k && typeof k === "object") all(k, out); return out; };
const has = (n, cls) => String(n.className || "").split(/\s+/).includes(cls) || !!(n.classes && n.classes.has(cls));
const find = (n, cls) => all(n).filter((x) => x !== n && has(x, cls));
const cardOf = (block) => block.kids.find((k) => has(k, "group"));
const tap = (el) => { for (const f of (el && el.on && el.on.click) || []) f({ target: el, detail: 1, stopPropagation() {}, preventDefault() {}, composedPath: () => [] }); };
function look(clientMode, finished, preview = false) {                 // the page; the first card's chevron tapped open; the fourth card (not done, after the third) tapped for a look
  page(clientMode, finished, preview);
  const drawn = capture(() => fns.render()), [b1, , b3, b4] = drawn.blocks;
  const resume = find(b1, "resume-full")[0], chev1 = find(b1, "card-chev")[0];
  const calf = drawn.all.find((x) => x.className === "row" && x.dataset && x.dataset.id === "c"), swap = !calf ? null : clientMode || preview ? drawn.all.some((x) => has(x, "name-pop")) : !calf.qs[".alt-pop"].hidden;   // Calf raise has an alternative: the client's name is its pop-up button, the coach's field has the chevrons (v291)
  tap(chev1);
  const sr = drawn.all.find((x) => has(x, "sum-row")), pen = sr && sr.kids.find((k) => has(k, "add-note"));
  const noteDisc = sr ? !sr.hidden && !!pen && !pen.hidden : null;     // the opened card's line: its note disc, itself shown (and Resume where there is one)
  const peeked = capture(() => tap(cardOf(b4)));                         // a card still to come, tapped: drawn again, opened for a look
  const p4 = peeked.blocks[3] || null, words = p4 ? find(p4, "foot-wait").map((x) => x.textContent) : null;
  const out = { locked: !!$("rows").classes && $("rows").classes.has("locked"), resumeHidden: resume ? !!resume.hidden : null, summary: has(b1, "summary"), noteDisc, swap,
    ahead: [b3, b4].map((b) => has(b, "ahead")), peek: p4 ? has(p4, "peek") : null, wait: words, start: p4 ? peeked.all.filter((x) => has(x, "start-now")).length : null };   // (Start this exercise goes in after the line, beside it: counted among all made)
  fns.setPreview(false); app.set({ renderedTraining: null });
  return out;
}

test("a finished workout, the client's view: its done card opens to its sets with no \"Resume this exercise\", its note disc kept; its cards not done stay folded, a look with nothing to do (no \"Finish … first\", no Start this exercise, no swap)", () => {
  assert.deepStrictEqual(look(true, true), { locked: true, resumeHidden: true, summary: true, noteDisc: true, swap: false, ahead: [true, true], peek: true, wait: [], start: 0 }, "its note disc stays (his \"Yes, exactly\": notes stay)");
});

test("the same workout still to do, the client's view: Resume there, the swap there (its name a pop-up), the first card not done is the one open, a card after it says to finish that one first and offers Start this exercise (what the lock takes away on a finished one)", () => {
  assert.deepStrictEqual(look(true, false), { locked: false, resumeHidden: false, summary: true, noteDisc: true, swap: true, ahead: [false, true], peek: true, wait: ["Finish Exercise 3 first"], start: 1 });
});

test("the coach's own view of the finished workout keeps everything: Resume on its done card, its swap, its cards not done open to him (his own view: none folded away)", () => {
  const r = look(false, true);
  assert.deepStrictEqual({ locked: r.locked, resumeHidden: r.resumeHidden, summary: r.summary, noteDisc: r.noteDisc, swap: r.swap, ahead: r.ahead }, { locked: false, resumeHidden: false, summary: true, noteDisc: true, swap: true, ahead: [false, false] });
});

test("the coach looking at the finished workout as the client (Client at the foot) sees the client's page: locked as hers", () => {
  try { assert.deepStrictEqual(look(false, true, true), { locked: true, resumeHidden: true, summary: true, noteDisc: true, swap: false, ahead: [true, true], peek: true, wait: [], start: 0 }); }
  finally { fns.setPreview(false); }
});

test("Undo of the finish lifts the lock at once: the cards are drawn again, the first exercise not done open as the current one, the swap back (the review's catch: they had stayed locked until the next sync)", () => {
  const t = page(true, true); t.completedAt = new Date(Date.now() - 3600e3).toISOString();   // finished an hour ago: her Undo is there
  capture(() => fns.render()); assert.strictEqual($("rows").classes.has("locked"), true, "finished: locked");
  const again = capture(() => fns.setFinished(false)), [, , b3, b4] = again.blocks;
  const calf = again.all.find((x) => x.className === "row" && x.dataset && x.dataset.id === "c");
  assert.deepStrictEqual({ undone: !t.completedAt, redrawn: again.blocks.length, locked: $("rows").classes.has("locked"), ahead: [b3, b4].map((b) => !!b && has(b, "ahead")), swap: !!calf && again.all.some((x) => has(x, "name-pop")) },
    { undone: true, redrawn: 4, locked: false, ahead: [false, true], swap: true });
  app.set({ renderedTraining: null });
});

test("on a finished workout an exercise not done, opened for a look, takes nothing (its set chips and its weight and reps go), keeps the client's note (read, changed, written), and no card offers Complete set, Skip exercise, Finish early, Mark set as not done or Resume; a card resumed before the finish opens as its sets", () => {
  const src = fs.readFileSync(new URL("../app/main.js", import.meta.url), "utf8");
  assert.ok(src.includes('const summary = block.classList.contains("done") && block.classList.contains("open") && (locked || !fullBlocks.has(selKey));'), "a finished workout's opened card is always its summary for the client");
  assert.ok(html.includes("#rows.locked .block.peek .tracker, #rows.locked .block.peek .row .setlog { display: none; }"), "nothing to log on an exercise not done (the review's catch: weight and reps typed in were saved)");
  assert.ok(html.includes(".block.peek .card-foot .complete, #rows:not(.locked) .block.peek .card-foot .add-note, #rows:not(.locked) .block.peek .card-foot .exnote, #rows:not(.locked) .block.peek .card-foot .client-note { display: none !important; }"), "a card still to come keeps hiding its note; a finished workout's exercise not done shows it (the review's catch: her note there was out of reach)");
  assert.ok(html.includes("#rows:not(.locked) .block.peek .card-foot .foot-row, #rows.locked .block.peek .card-foot .foot-row.center { display: none; }"), "on a finished workout only the note's row stays on a looked-at card");
  assert.ok(html.includes("#rows.locked .card-foot .complete, #rows.locked .card-foot .finish-early, #rows.locked .card-foot .resume { display: none !important; }"), "no card of a finished workout offers a way to change what was logged");
  assert.ok(!html.includes("#rows.locked .alt-btn") && !html.includes("#rows.locked .name-pop"), "the swap goes in the code (no pop-up is drawn on a finished workout: the review's catch), not by a style alone");
});
