// Run by row-swipe.test.js in its own process: a row's touch, mouse and trackpad handling listen on the document, which the shared stand-in
// does not keep, and wait on timers, so this loads the real app/main.js with a recording document, a clock of its own and rows that know
// their place in the page, plays the gestures, and prints, as JSON, what each one did.
import { byId } from "./env.js";
import { ui } from "../app/state.js";
// the clock: every timer the app sets is this one's, and so is performance.now
let NOW = 10000, SEQ = 0; const Q = [];
globalThis.setTimeout = (fn, ms) => { const id = ++SEQ; Q.push({ id, at: NOW + Math.max(0, ms || 0), fn }); return id; };
globalThis.clearTimeout = (id) => { const i = Q.findIndex((q) => q.id === id); if (i >= 0) Q.splice(i, 1); };
try { performance.now = () => NOW; } catch (_) { Object.defineProperty(globalThis, "performance", { value: { now: () => NOW }, configurable: true }); }
const flush = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };
async function advance(ms) {
  const end = NOW + ms;
  for (;;) { Q.sort((a, b) => a.at - b.at || a.id - b.id); const q = Q[0]; if (!q || q.at > end) break; Q.shift(); NOW = Math.max(NOW, q.at); q.fn(); await flush(); }
  NOW = end; await flush();
}
const to = (t) => advance(Math.max(0, t - NOW));
// the document keeps its listeners; held() finds no sheet, picture or menu up
const L = {};
document.addEventListener = (t, fn, o) => { (L[t] ||= []).push({ fn, capture: o === true || !!(o && o.capture) }); };
globalThis.addEventListener = () => {};
const qs = document.querySelector; document.querySelector = (s) => (/crop-view|sheet-bg|header \.bar/.test(s) ? null : qs(s));   // (no bar to copy under the swipe back)
document.getElementById("whenBg").hidden = true;
globalThis.DOMMatrixReadOnly = class { constructor(s) { const m = /matrix\(([^)]*)\)/.exec(s || ""); const v = m ? m[1].split(",").map(Number) : [1, 0, 0, 1, 0, 0]; this.m41 = v[4]; } };
const shown = new Map();                                                 // where a part is on the screen mid-settle (its computed transform)
globalThis.getComputedStyle = (n) => ({ transform: shown.get(n) || "none", getPropertyValue: () => "", display: "block", color: "" });
function fire(type, ev) {
  let stopped = false; ev.type = type; ev.defaultPrevented = false;
  ev.preventDefault = () => { ev.defaultPrevented = true; }; ev.stopPropagation = () => {}; ev.stopImmediatePropagation = () => { stopped = true; };
  if (ev.timeStamp == null) ev.timeStamp = NOW;
  const ls = L[type] || []; for (const l of [...ls.filter((x) => x.capture), ...ls.filter((x) => !x.capture)]) { if (stopped) break; l.fn(ev); }
  return ev;
}
// rows that know where they are: just what the row code reads
const ROOT = { tagName: "HTML", parentElement: null };
const matches = (n, sel) => sel.split(",").some((part) => {
  const m = part.trim().match(/^([a-z]+)?(#[\w-]+)?((?:\.[\w-]+)*)$/i); if (!m) return false;
  const [, tag, id, cls] = m;
  return (!tag || n.tagName === tag.toUpperCase()) && (!id || n.id === id.slice(1)) && (cls || "").split(".").filter(Boolean).every((c) => n.classList.contains(c));
});
function mk(tag, classes = [], w = 0) {
  const set = new Set(classes);
  const n = { nodeType: 1, tagName: tag.toUpperCase(), id: "", children: [], parentElement: null, dataset: {}, style: {}, _w: w,
    classList: { add: (...c) => c.forEach((x) => set.add(x)), remove: (...c) => c.forEach((x) => set.delete(x)), toggle: (c, f) => { const on = f === undefined ? !set.has(c) : !!f; if (on) set.add(c); else set.delete(c); return on; }, contains: (c) => set.has(c) },
    get firstElementChild() { return n.children[0] || null; },
    get isConnected() { let p = n; while (p.parentElement) p = p.parentElement; return p === ROOT; },
    append(...k) { for (const c of k) { c.parentElement = n; n.children.push(c); } },
    closest(sel) { for (let p = n; p && p !== ROOT; p = p.parentElement) if (matches(p, sel)) return p; return null; },
    contains(o) { for (let p = o; p; p = p.parentElement) if (p === n) return true; return false; },
    getBoundingClientRect() { const w = n.isConnected ? n._w : 0; return { width: w, height: 60, top: 0, left: 0, right: w, bottom: 60 }; },
    get offsetWidth() { return n.isConnected ? n._ow || 0 : 0; },
    setPointerCapture() {} };
  return n;
}
function makeRow(tid = "w1", width = 648, { iw = 61, ow = 61, capW = 61 } = {}) {   // a row with its two actions: Skip, then Reschedule outermost
  const li = mk("li", ["w", "swipe-row"], width); li.dataset.tid = tid;
  const b = mk("button"), pri = mk("span", ["pri"]); b.append(pri);
  const layer = mk("div", ["swipe-acts"]), skip = mk("button", ["swipe-act", "sa-skip"]), scap = mk("span", ["sa-cap"]), resched = mk("button", ["swipe-act", "sa-resched"]), rcap = mk("span", ["sa-cap"]);
  skip._ow = iw; scap._ow = capW; resched._ow = ow; rcap._ow = capW;
  skip.append(scap); resched.append(rcap); layer.append(skip, resched); li.append(b, layer);
  const ul = mk("ul", ["list"]); ul.append(li); ul.parentElement = ROOT;
  return { li, b, pri, skip, resched, rcap, ul, drop() { ul.parentElement = null; } };
}
const title = mk("h2"); title.parentElement = ROOT;
const header = mk("header"), barBtn = mk("button"); header.append(barBtn); header.parentElement = ROOT;   // the top bar
const pageMain = mk("main"), pageDiv = mk("div"), field = mk("input"); pageMain.append(pageDiv, field); pageMain.parentElement = ROOT;   // a page under the bar, with a field
let blurred = 0; field.blur = () => { blurred++; if (document.activeElement === field) document.activeElement = null; };
// the skip sheet's buttons and the workout page's Skip workout and Undo keep their listeners (the shared stand-in drops them): a click reaches them
const ON = {};
for (const id of ["skGo", "skKeep", "skReasons", "skipSheet", "skipBtn", "unskipBtn", "datePick", "dpCancel"]) { const e = document.getElementById(id); ON[id] = {}; e.addEventListener = (t, f) => { (ON[id][t] ||= []).push(f); }; }

const app = (await import("../app/main.js")).internals();
const { fns, maps } = app;
const day = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return fns.localIso(d); };
function setup() {
  app.reset(); app.set({ signedIn: true, clientMode: true, myClientId: "c1", tab: "workouts" });
  maps.clients.set("c1", { id: "c1", name: "Jane", unit: "lb" });
  maps.trainings.set("w1", { id: "w1", clientId: "c1", title: "Legs", date: day(1), createdAt: "2026-11-01T10:00:00.000Z", completedAt: null, skippedAt: null, rows: [] });
  app.set({ view: { name: "client", id: "c1" } }); fns.render();
  if (fns.datePicker()) fns.closeDatePicker();
}
const wheel = (dx, dy, target) => fire("wheel", { deltaX: dx, deltaY: dy, deltaMode: 0, ctrlKey: false, target, webkitDirectionInvertedFromDevice: true, timeStamp: Math.floor(NOW) });
const pt = (x, y) => ({ clientX: x, clientY: y });
const touch = (type, x, y, target, n = 1) => fire(type, { target, touches: type === "touchend" || type === "touchcancel" ? [] : Array.from({ length: n }, (_, i) => pt(x + 40 * i, y)), changedTouches: [pt(x, y)], cancelable: true });
const mouse = (type, x, y, target, extra = {}) => fire(type, { target, pointerType: "mouse", pointerId: 1, button: 0, buttons: type === "pointerup" ? 0 : 1, clientX: x, clientY: y, ...extra });
const click = (target) => fire("click", { target });
const row = () => fns.rowSwipe();
async function dragOpen(r) {                                             // a finger opens a row slowly and rests: open, nothing else
  touch("touchstart", 300, 100, r.pri); for (let k = 1; k <= 11; k++) { await advance(16); touch("touchmove", 300 - 10 * k, 100, r.pri); }
  await advance(120); touch("touchend", 190, 100, r.pri); await advance(600);
}
// Safari's two fingers: the fingers (whole events), then its coasting in whole pixels, at the lifting speed for a tenth of a second
// before it slows (WebKit's MomentumEventDispatcher), one event per 120 Hz frame
const FINGERS = [1, 2, 4, 6, 9, 12, 14, 15], DRAG = [1, 2, 4, 6, 9, 12, 14, 15, 15, 14, 12, 9, 6, 3], COAST = [15, 16, 15, 15, 16, 15, 15, 15, 14, 15, 14, 14, 13, 13, 12, 12, 11, 11, 10, 10, 9, 9, 8, 8, 7, 7, 6, 6, 5, 5, 5, 4, 4, 4, 3, 3, 3, 2, 2, 2, 2, 1, 1, 1, 1, 1];
async function play(deltas, target, sign = 1) { let prevented = 0, maxX = 0; for (const [dx, dy] of deltas) { const e = wheel(sign * dx, dy, target); if (e.defaultPrevented) prevented++; const r = row(); if (r) maxX = Math.max(maxX, r.x); await advance(8.33); } return { prevented, maxX }; }
const out = {};
const W2 = 11.67 + 61 + 10.33 + 61 + 10.67;                              // the two actions open: 154.67
// the skip sheet as the page has it (hidden until asked), a click that reached one of its buttons, and what it and w1 show
const $ = (id) => document.getElementById(id), sheet = $("skipSheet");
const IN_SHEET = ["skGo", "skKeep"];                                    // inside #skipSheet: a click on them goes on up to its backdrop's listener, as a browser's does
const press = (id, ev = {}) => { const e = { target: $(id), detail: 1, stopPropagation() {}, preventDefault() {}, ...ev }; for (const k of IN_SHEET.includes(id) ? [id, "skipSheet"] : [id]) for (const f of ON[k].click || []) f(e); };
const pick = (reason) => { const b = mk("button"); b.dataset.reason = reason; const e = { target: b }; for (const k of ["skReasons", "skipSheet"]) for (const f of ON[k].click || []) f(e); };   // a reason's button in the sheet: its click goes up through the reasons to the backdrop
const asked = () => ({ shown: sheet.hidden === false, sheet: fns.skipSheet(), asking: app.get().asking });
const w1 = () => { const t = maps.trainings.get("w1"); return { skipped: !!t.skippedAt, reason: t.skipReason || null, pending: maps.pendingSkip.has("w1") }; };
// the row the app itself draws (fns.workoutRow: its own click handlers, its dataset.tid), in nodes that keep what it writes into them: its
// classes, the spans its innerHTML makes, its children and its listeners; its actions as wide as their 61-point capsules (the default Text Size)
function mkDrawn(tag) {
  const n = mk(tag); let cls = ""; n.on = {}; n.attrs = {};
  Object.defineProperty(n, "className", { get: () => cls, set: (v) => { cls = String(v); for (const c of cls.split(/\s+/).filter(Boolean)) n.classList.add(c); } });
  Object.defineProperty(n, "innerHTML", { get: () => "", set: (h) => { n.children = []; for (const m of String(h).matchAll(/<span class="([^"]*)">([\s\S]*?)<\/span>/g)) { const s = mkDrawn("span"); s.className = m[1]; s.textContent = m[2].replace(/<[^>]*>/g, ""); s.parentElement = n; n.children.push(s); } } });
  Object.defineProperty(n, "firstChild", { get: () => n.children[0] || null }); Object.defineProperty(n, "lastChild", { get: () => n.children[n.children.length - 1] || null });
  n.append = (...k) => { for (const c of k) if (c && typeof c === "object") { c.parentElement = n; n.children.push(c); } };
  n.appendChild = (c) => { n.append(c); return c; }; n.setAttribute = (k, v) => { n.attrs[k] = String(v); }; n.addEventListener = (t, f) => { (n.on[t] ||= []).push(f); };
  return n;
}
function drawnRow(width = 368) {
  const make = document.createElement; document.createElement = mkDrawn;
  let li; try { li = fns.workoutRow(maps.trainings.get("w1"), "next", true); } finally { document.createElement = make; }
  const layer = li.children.find((c) => c.classList.contains("swipe-acts")); li._w = width;
  for (const a of layer.children) { a._ow = 61; a.children[0]._ow = 61; }
  const ul = mk("ul", ["list"]); ul.append(li); ul.parentElement = ROOT;
  const b = li.children[0];
  return { li, b, pri: b.children[2].children[0], skip: layer.children[0], resched: layer.children[1], drop() { ul.parentElement = null; } };
}
async function tap(target, x, y, own) {                                  // a tap as WebKit delivers it: its click only if its touchend was not cancelled, and the control's own listeners only if the document let the click through
  touch("touchstart", x, y, target); await advance(60); const end = touch("touchend", x, y, target);
  if (end.defaultPrevented) return { cancelled: true, clicked: false };
  await advance(5); if (click(target).defaultPrevented) return { cancelled: false, clicked: false };
  for (const f of own || []) f({ target, detail: 1, stopPropagation() {}, preventDefault() {} });
  return { cancelled: false, clicked: true };
}

// 1. two fingers flick a closed row to the left: it opens and stops at its open width; the coasting reaches nothing and opens no days
setup(); { const r = makeRow(); const p = await play([...FINGERS, ...COAST].map((d) => [d, 0]), r.pri); await advance(800);
  out.flick = { ...p, events: FINGERS.length + COAST.length, open: !!row() && row().open, x: row() && row().x, w: row() && row().w, fired: !!fns.datePicker() }; r.drop(); }

// 2. ... and the fingers come down on its coasting (Safari stops it) and scroll the page 40 ms later: the page scrolls, the row closes
setup(); { const r = makeRow(); await play([...FINGERS, ...COAST.slice(0, 12)].map((d) => [d, 0]), r.pri); await advance(40);
  const p = await play([[0, 3], [0.4, 7], [0, 12], [0, 16], [0, 16], [0.3, 15]], title); await advance(800);
  out.scrollAfter = { prevented: p.prevented, open: !!row() }; r.drop(); }

// 3. a row swiped 40 ms after the page's scroll stops coasting: the row moves; so does a slow one (one pixel at a time)
setup(); { const r = makeRow(); await play([3, 8, 14, 20, 24, 25, 25, 24, 24, 23, 23].map((d) => [0, d]), title); await advance(40);
  const p = await play(DRAG.map((d) => [d, 0]), r.pri); await advance(800); out.rowAfterScroll = { maxX: p.maxX, open: !!row() && row().open }; r.drop(); }
setup(); { const r = makeRow(); await play([3, 8, 14, 20, 24, 25, 25].map((d) => [0, d]), title); await advance(40);
  const p = await play(Array.from({ length: 40 }, () => [1, 0]), r.pri); await advance(800); out.slowAfterScroll = { maxX: p.maxX }; r.drop(); }
// ... and a row swiped to the right first (nothing of the app's), then straight to the left without a pause: the row moves
setup(); { const r = makeRow(); await play([2, 4, 6, 8, 8, 6, 4, 2].map((d) => [d, 0]), r.pri, -1);
  const p = await play(DRAG.map((d) => [d, 0]), r.pri); await advance(800); out.rightThenLeft = { maxX: p.maxX, open: !!row() && row().open }; r.drop(); }

// 4. a redraw replaces the row during a trackpad swipe's first pixels: the swipe moves nothing and opens nothing
setup(); { const r = makeRow(); wheel(3, 0, r.pri); await advance(8); wheel(2, 0, r.pri); await advance(8); r.drop(); const r2 = makeRow();
  for (const d of [6, 9, 12]) { wheel(d, 0, r.pri); await advance(8); } await advance(800);
  out.detached = { row: row(), fired: !!fns.datePicker(), fresh: r2.li.classList.contains("swiped") }; r2.drop(); }
setup(); { const r = makeRow(); wheel(3, 0, r.pri); await advance(8); wheel(2, 0, r.pri); await advance(8); r.drop(); const r2 = makeRow();   // ... the rest of it over the new row: that one moves
  const p = await play(DRAG.slice(3).map((d) => [d, 0]), r2.pri); await advance(800); out.detached.newRowMoved = p.maxX > 0 && !!row() && row().open; r2.drop(); }
setup(); { const r = makeRow("w1", 0); await play(DRAG.map((d) => [d, 0]), r.pri); await advance(800);   // a row with no width (its page hidden) moves nothing
  out.detached.noWidth = { row: row(), fired: !!fns.datePicker() }; r.drop(); }

// 5. a finger drags a row 40 px and a second finger lands: the row settles (here: closed), never left part-way
setup(); { const r = makeRow(); touch("touchstart", 300, 100, r.pri); await advance(16); touch("touchmove", 290, 100, r.pri); await advance(16); touch("touchmove", 250, 100, r.pri);
  const during = row() && row().x; await advance(16); touch("touchstart", 250, 100, r.pri, 2); await advance(600);
  out.secondFinger = { during, after: row() }; touch("touchend", 250, 100, r.pri); await advance(600); r.drop(); }

// 6. the closing tap: its touchend is cancelled and its click goes nowhere, a rolled one's and a long press's too; a tap that brought no
//    click leaves the next tap alone; a tap on the top bar closes the row and acts at once (as Apple's Back does, measured)
setup(); { const a = makeRow("w1"), b = makeRow("w2"); await dragOpen(a); const opened = !!row() && row().open;
  touch("touchstart", 100, 100, a.pri); await advance(80); const end = touch("touchend", 100, 100, a.pri); await advance(5); const own = click(a.b).defaultPrevented; await advance(600);
  const marked = a.b.classList.contains("rs-ate"); touch("touchstart", 30, 20, title); const unmarked = !a.b.classList.contains("rs-ate"); touch("touchend", 30, 20, title); await advance(600);
  await dragOpen(a); touch("touchstart", 30, 20, title); await advance(80); touch("touchend", 30, 20, title); await advance(250);   // no click: a title has no listener
  touch("touchstart", 100, 100, b.pri); await advance(80); touch("touchend", 100, 100, b.pri); await advance(5); const next = click(b.b).defaultPrevented; await advance(600);
  await dragOpen(a); touch("touchstart", 100, 100, a.pri); await advance(1000); touch("touchend", 100, 100, a.pri); await advance(5); const long = click(a.b).defaultPrevented; await advance(600);
  const closedAfterLong = !row();
  await dragOpen(a); touch("touchstart", 100, 100, b.pri); await advance(40); touch("touchmove", 106, 106, b.pri); await advance(40); touch("touchend", 106, 106, b.pri); await advance(5); const rolled = click(b.b).defaultPrevented; await advance(600);
  await dragOpen(a); touch("touchstart", 20, 20, barBtn); await advance(60); const barEnd = touch("touchend", 20, 20, barBtn); await advance(5); const bar = click(barBtn).defaultPrevented; await advance(600);
  out.eat = { opened, ownTapEaten: own, ownEndCancelled: end.defaultPrevented, pressLookOff: marked && unmarked, nextTapEaten: next, longPressEaten: long, closedAfterLong, rolledTapEaten: rolled, barTapEaten: bar, barEndCancelled: barEnd.defaultPrevented, closedByBar: !row() }; a.drop(); b.drop(); }

// 7. a sync's redraw waits while a finger rests on a row (the swipe it starts still holds), comes once the row has settled, and keeps it open
setup(); { const r = makeRow(); const nl = document.getElementById("nextList"); let renders = 0; nl.replaceChildren = () => { renders++; }; nl.children = [r.li];
  touch("touchstart", 300, 100, r.pri); await advance(30); ui.render();
  for (let k = 1; k <= 11; k++) { await advance(16); touch("touchmove", 300 - 10 * k, 100, r.pri); }
  const moved = row() && row().x, rendersDuring = renders; await advance(120); touch("touchend", 190, 100, r.pri); const openThen = !!row() && row().open; await advance(800);
  out.redraw = { moved, rendersDuring, openThen, renders, keptOpen: !!row() && row().open }; delete nl.replaceChildren; nl.children = []; r.drop(); }

// 8. a mouse drag that a redraw interrupts: the grabbing cursor goes with it
setup(); { const r = makeRow(); mouse("pointerdown", 300, 100, r.pri); await advance(16); mouse("pointermove", 280, 100, r.pri); const grabbing = document.body.classList.contains("rs-drag");
  fns.render(); out.cursor = { grabbing, after: document.body.classList.contains("rs-drag") }; mouse("pointerup", 280, 100, r.pri); await advance(600); r.drop(); }

// 9. another page: the open row is put back before the page's picture is taken (the swipe back shows it as it is)
setup(); { const r = makeRow(); await dragOpen(r); const was = !!row() && row().open; fns.forceSwipe(true);
  let atPicture = "never asked"; const qsa = document.querySelectorAll; document.querySelectorAll = (sel) => { if (sel === "main > section" && atPicture === "never asked") atPicture = row(); return qsa(sel); };
  fns.leaveSettings(); document.querySelectorAll = qsa; fns.forceSwipe(false);
  out.page = { was, after: row(), atPicture }; await advance(600); r.drop(); }

// 10. a row caught while it settles is taken up where it is on the screen, not where the settle was going
setup(); { const r = makeRow(); touch("touchstart", 300, 100, r.pri); for (let k = 1; k <= 4; k++) { await advance(16); touch("touchmove", 300 - 15 * k, 100, r.pri); }
  touch("touchend", 240, 100, r.pri); await advance(60);                    // a flick: it springs open
  shown.set(r.b, "matrix(1, 0, 0, 1, -62, 0)");                           // where the spring has it now
  touch("touchstart", 250, 100, r.pri); await advance(16); touch("touchmove", 240, 100, r.pri); const caught = row() && row().x;
  touch("touchend", 240, 100, r.pri); shown.clear(); await advance(800); out.regrab = { caught }; r.drop(); }

// 11. on a trackpad an open row closes when the page scrolls, and when the fingers go back the other way
setup(); { const r = makeRow(); await play(DRAG.map((d) => [d, 0]), r.pri); await advance(800); const opened = !!row() && row().open;
  await play([[0, 4], [0, 8], [0, 12]], title); await advance(800); const afterScroll = row();
  await play(DRAG.map((d) => [d, 0]), r.pri); await advance(800); const reopened = !!row() && row().open;
  await play(DRAG.map((d) => [d, 0]), r.pri, -1); await advance(800);
  out.trackpadClose = { opened, afterScroll, reopened, afterBack: row() }; r.drop(); }

// 12. a finger's full swipe on a phone-wide row (368): armed once the row's edge is within 81 px of its start, and the days open on the lift
setup(); { const r = makeRow("w1", 368); touch("touchstart", 360, 100, r.pri); let armedAt = null, x = 360;
  for (let k = 1; k <= 40; k++) { await advance(16); x -= 8; touch("touchmove", x, 100, r.pri); if (armedAt == null && r.li.classList.contains("armed")) armedAt = row() && row().x; }
  const armedBefore = r.li.classList.contains("armed"); touch("touchend", x, 100, r.pri); await advance(600);
  out.fullTouch = { armedAt, armedBefore, picker: fns.datePicker() && fns.datePicker().title, closed: !row() }; if (fns.datePicker()) fns.closeDatePicker(); r.drop(); }

// 13. a mouse: a full drag opens the days and its click opens nothing; a click elsewhere closes the open row and goes through; a
//     Control-click (the Mac's secondary click, its menu takes the release) never starts a drag; a move with no button ends one
setup(); { const a = makeRow("w1", 368), b = makeRow("w2", 368); mouse("pointerdown", 360, 100, a.pri); let x = 360;
  for (let k = 1; k <= 40; k++) { await advance(16); x -= 8; mouse("pointermove", x, 100, a.pri); }
  mouse("pointerup", x, 100, a.pri); const dragClick = click(a.b).defaultPrevented; await advance(600); const picker = fns.datePicker() && fns.datePicker().title; if (fns.datePicker()) fns.closeDatePicker();
  await dragOpen(a); mouse("pointerdown", 100, 100, b.pri); mouse("pointerup", 100, 100, b.pri); const elsewhere = click(b.b).defaultPrevented; await advance(600); const closedByClick = !row();
  const nl = document.getElementById("nextList"); let renders = 0; nl.replaceChildren = () => { renders++; };
  mouse("pointerdown", 300, 100, a.pri, { ctrlKey: true }); ui.render(); const ctrlHeld = renders === 0;   // a Control-click holds no redraw (its release never comes)
  for (let k = 1; k <= 6; k++) { await advance(16); mouse("pointermove", 300 - 10 * k, 100, a.pri, { buttons: 0 }); } await advance(600); const ctrl = row(); delete nl.replaceChildren;
  mouse("pointerdown", 300, 100, a.pri); await advance(16); mouse("pointermove", 280, 100, a.pri); for (let k = 1; k <= 6; k++) { await advance(16); mouse("pointermove", 280 - 10 * k, 100, a.pri, { buttons: 0 }); } await advance(600);
  out.mouse = { picker, dragClickEaten: dragClick, elsewhereEaten: elsewhere, closedByClick, ctrlHeld, ctrlRow: ctrl, noButtonRow: row() && row().x, cursor: document.body.classList.contains("rs-drag") }; a.drop(); b.drop(); }

// 14. a tap on the open row's Reschedule that rolls a little (8 across, 5 down) is still that tap: the row stays open, its click goes through
setup(); { const r = makeRow(); await dragOpen(r); touch("touchstart", 340, 100, r.rcap); await advance(30); touch("touchmove", 332, 105, r.rcap); await advance(30);
  const openAtEnd = !!row() && row().open; touch("touchend", 332, 105, r.rcap); await advance(5); const eaten = click(r.resched).defaultPrevented; await advance(600);
  out.actTap = { openAtEnd, eaten }; r.drop(); }

// 15. a finger never moves a row and the page at once: a move that holds is kept from the page; the page scrolling under a held row (or
//     WebKit cancelling the pointer for its own scroll) settles it; a slanted start on an open row, or a scroll from its Reschedule, closes it
setup(); { const r = makeRow(); touch("touchstart", 300, 100, r.pri); let kept = 0, n = 0;
  for (let k = 1; k <= 8; k++) { await advance(16); const e = touch("touchmove", 300 - 10 * k, 100, r.pri); if (k > 1) { n++; if (e.defaultPrevented) kept++; } }
  globalThis.scrollY = 30; await advance(16); touch("touchmove", 210, 100, r.pri); await advance(600); const afterScroll = row(); globalThis.scrollY = 0; touch("touchend", 210, 100, r.pri); await advance(600);
  touch("touchstart", 300, 100, r.pri); for (let k = 1; k <= 7; k++) { await advance(16); touch("touchmove", 300 - 10 * k, 100, r.pri); } fire("pointercancel", { pointerType: "touch", pointerId: 2, target: r.pri }); await advance(600);
  const afterCancel = row(); touch("touchend", 230, 100, r.pri); await advance(600);
  await dragOpen(r); touch("touchstart", 200, 100, r.pri); await advance(16); touch("touchmove", 191, 105, r.pri); await advance(16); touch("touchmove", 188, 130, r.pri); await advance(600); touch("touchend", 188, 130, r.pri); await advance(600); const afterSlant = row();
  await dragOpen(r); touch("touchstart", 340, 100, r.rcap); await advance(16); touch("touchmove", 340, 112, r.rcap); await advance(16); touch("touchmove", 340, 130, r.rcap); await advance(600); touch("touchend", 340, 130, r.rcap); await advance(600);
  out.touchGuards = { kept, moves: n, afterScroll: afterScroll && afterScroll.x, afterCancel: afterCancel && { x: afterCancel.x, open: afterCancel.open }, afterSlant, afterActScroll: row() }; r.drop(); }

// 16. two fingers on a Mac's trackpad, the workout page: a flick to the right goes back; a short nudge and a peek out and back stay; it
//     works with a field focused (let go first) and over a field
const toWorkout = () => { setup(); fns.forceSwipe(true); app.set({ view: { name: "training", id: "w1" } }); fns.render(); };
const wb = async (deltas, target) => { const p = await play(deltas.map((d) => [d, 0]), target, -1); await advance(1500); return { view: app.get().view.name, kept: p.prevented }; };
toWorkout(); out.wheelBack = { flick: await wb([...FINGERS, ...COAST], pageDiv) };
toWorkout(); out.wheelBack.nudge = await wb([2, 4, 6, 8, 8, 8, 6, 4, 2], pageDiv);
toWorkout(); { const outw = [1, 3, 6, 9, 11, 12, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1], back = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1];
  await play(outw.map((d) => [d, 0]), pageDiv, -1); await play(back.map((d) => [d, 0]), pageDiv, 1); await advance(1500); out.wheelBack.peek = { view: app.get().view.name }; }
toWorkout(); document.activeElement = field; blurred = 0; out.wheelBack.focused = { ...(await wb([...FINGERS, ...COAST], pageDiv)), blurred };
toWorkout(); document.activeElement = null; out.wheelBack.overField = await wb([...FINGERS, ...COAST], field);
fns.forceSwipe(false);

// 17. trackpad rules: a rest mid-drag, then on (picked up again); a slanted start (a scroll); a mouse wheel's line steps and Escape close an open row
setup(); { const r = makeRow(); await play([2, 4, 6, 8, 8, 8].map((d) => [d, 0]), r.pri); const x1 = row() && row().x; await advance(100);
  const p = await play([4, 6, 8, 8, 8, 8, 8, 6].map((d) => [d, 0]), r.pri); await advance(800);
  const slant = (setup(), makeRow("w2")); const ps = await play([[5, 3], [5, 3], [5, 3], [5, 3]], slant.pri); await advance(800);
  out.wheelRules = { beforeRest: x1, afterRest: p.maxX, slantKept: ps.prevented, slantRow: row() };
  await dragOpen(slant); fire("wheel", { deltaX: 0, deltaY: 4.000244140625, deltaMode: 0, ctrlKey: false, target: title, timeStamp: Math.floor(NOW) }); await advance(800); out.wheelRules.lineWheel = row();   // a mouse wheel as Safari sends it: pixels (lines x 40), a slow notch 0.1 line
  await dragOpen(slant); for (const d of [4.000244140625, 40, 80]) { fire("wheel", { deltaX: d, deltaY: 0, deltaMode: 0, ctrlKey: false, shiftKey: true, target: slant.pri, timeStamp: Math.floor(NOW) }); await advance(50); } await advance(800); out.wheelRules.shiftWheel = row();   // Shift + a mouse wheel: sideways, in pixels
  await dragOpen(slant); fire("keydown", { key: "Escape" }); await advance(800); out.wheelRules.escape = row(); slant.drop(); r.drop(); }

// 18. the open width is the actions' own: a wider outer action (a title wider than its capsule) widens it
setup(); { const r = makeRow("w1", 648, { ow: 72 }); await dragOpen(r); out.widths = { w: row() && row().w }; r.drop(); }

// 19. Skip asks first, through the sheet's own buttons (the page starts it hidden): the row's Skip shows it and skips nothing yet; Skip
//     workout and the backdrop take no click in its first 350 ms (a double tap's second tap); a reason, then Skip workout, skips that row's
//     workout with it; Cancel, the backdrop and Escape skip nothing; the workout page's own Skip workout asks for its workout
{ const wasHidden = sheet.hidden; out.sheet = {};
  setup(); sheet.hidden = true; fns.rowSkip("w1"); const ask = { ...asked(), ...w1() };
  await advance(340); press("skGo"); const early = { ...asked(), ...w1() };   // (just inside the 350 ms; just after them, below)
  await advance(20); pick("Sick"); press("skGo"); out.sheet.go = { ask, early, after: { ...asked(), ...w1(), view: app.get().view.name } };
  setup(); sheet.hidden = true; fns.rowSkip("w1"); await advance(340); press("skipSheet"); const earlyBg = asked();
  await advance(20); press("skipSheet"); out.sheet.backdrop = { early: earlyBg, after: { ...asked(), ...w1() } };
  setup(); sheet.hidden = true; fns.rowSkip("w1"); await advance(400); press("skKeep"); out.sheet.keep = { ...asked(), ...w1() };
  setup(); sheet.hidden = true; fns.rowSkip("w1"); await advance(100); fire("keydown", { key: "Escape" }); out.sheet.escape = { ...asked(), ...w1() };
  setup(); sheet.hidden = true; app.set({ view: { name: "training", id: "w1" } }); fns.render(); press("skipBtn"); const pageAsk = asked();
  await advance(400); press("skGo"); out.sheet.page = { ask: pageAsk, after: { ...asked(), ...w1(), view: app.get().view.name } };
  if (fns.skipSheet()) fns.closeSkip(); sheet.hidden = wasHidden; }

// 20. Skip and Reschedule tapped on an open row the app draws (its own handlers, opened by a finger): the row closes first, then the sheet or
//     the days open, so the next tap, on Skip workout or in the days, is that tap (never one that only closes a row left open behind them)
{ const wasHidden = sheet.hidden;
  setup(); sheet.hidden = true; { const r = drawnRow(); await dragOpen(r); const opened = !!row() && row().open;
    const t = await tap(r.skip.children[0], 250, 100, r.skip.on.click); const then = { ...asked(), ...w1(), row: row() && { open: row().open } };
    await advance(400); const next = await tap($("skGo"), 200, 640, ON.skGo.click);
    out.openSkip = { opened, tap: t, then, next, after: { ...asked(), ...w1(), row: row() } }; if (fns.skipSheet()) fns.closeSkip(); r.drop(); }
  setup(); { const r = drawnRow(); await dragOpen(r); const opened = !!row() && row().open;
    const t = await tap(r.resched.children[0], 330, 100, r.resched.on.click); const picker = fns.datePicker() && fns.datePicker().title, then = row() && { open: row().open }, armedAtTap = r.li.classList.contains("armed");
    await advance(100); const armedMid = r.li.classList.contains("armed"); await advance(300); touch("touchstart", 200, 420, $("datePick")); await advance(60); const dayEnd = touch("touchend", 200, 420, $("datePick"));
    out.openResched = { opened, tap: t, picker, then, armedAtTap, armedMid, dayCancelled: dayEnd.defaultPrevented, after: row() }; if (fns.datePicker()) fns.closeDatePicker(); await advance(600); r.drop(); }
  sheet.hidden = wasHidden; }

// 20b. a double tap on an open row's Reschedule (the row the app draws, opened by a finger): its second tap lands where the days come up
//      (the backdrop above them, or Cancel). 120 ms (a quick double tap) or 340 ms after the first one's click it leaves them up, the
//      workout's day as it was; 360 ms after, it closes them
{ out.dblResched = {};
  for (const [k, id] of [["backdrop", "datePick"], ["cancel", "dpCancel"]]) for (const gap of [120, 340, 360]) {
    setup(); const r = drawnRow(); await dragOpen(r);
    const first = await tap(r.resched.children[0], 330, 100, r.resched.on.click); await advance(gap - 65);   // (a tap's click comes 65 ms after its touch)
    const second = await tap($(id), 330, 100, ON[id].click);
    out.dblResched[k + gap] = { first, second, days: fns.datePicker() && fns.datePicker().title, dayKept: maps.trainings.get("w1").date === day(1) };
    if (fns.datePicker()) fns.closeDatePicker(); await advance(600); r.drop(); } }

// 20c. a double tap on an open row's Skip (the row the app draws, opened by a finger): its second tap lands in the question as it comes up,
//      under the Skip capsule: on a reason of the right column (Injury, Travelling, Other) or, just above the tab bar, on Cancel. In the
//      question's first 350 ms it picks no reason and closes nothing (as Skip workout, the backdrop and the days); after them it does; a
//      keyboard's Enter or VoiceOver (detail 0) picks a reason at once
{ const wasHidden = sheet.hidden; out.dblSkip = {};
  const second = async (target, ids) => { touch("touchstart", 272, 600, target); await advance(60); touch("touchend", 272, 600, target); await advance(5); click(target);
    const e = { target, detail: 2, stopPropagation() {}, preventDefault() {} }; for (const k of ids) for (const f of ON[k].click || []) f(e); };
  for (const gap of [120, 340, 360]) {
    setup(); sheet.hidden = true; let r = drawnRow(); await dragOpen(r);
    await tap(r.skip.children[0], 272, 600, r.skip.on.click); await advance(gap - 65);   // (the second tap's click comes gap ms after the first's: its touch 65 ms before)
    const b = mk("button"); b.dataset.reason = "Injury"; await second(b, ["skReasons", "skipSheet"]);
    const reason = fns.skipSheet() && fns.skipSheet().reason; if (fns.skipSheet()) fns.closeSkip(); await advance(600); r.drop();
    setup(); sheet.hidden = true; r = drawnRow(); await dragOpen(r);
    await tap(r.skip.children[0], 272, 784, r.skip.on.click); await advance(gap - 65);
    await second($("skKeep"), ["skKeep", "skipSheet"]);
    out.dblSkip[gap] = { reason, keepItLeavesItUp: !!fns.skipSheet() }; if (fns.skipSheet()) fns.closeSkip(); await advance(600); r.drop(); }
  setup(); sheet.hidden = true; fns.rowSkip("w1"); await advance(30);
  { const b = mk("button"); b.dataset.reason = "Sick"; const e = { target: b, detail: 0 }; for (const k of ["skReasons", "skipSheet"]) for (const f of ON[k].click || []) f(e); }
  out.dblSkip.keyboard = fns.skipSheet() && fns.skipSheet().reason; if (fns.skipSheet()) fns.closeSkip();
  sheet.hidden = wasHidden; }

// 21. the two actions as a finger draws a phone-wide row out slowly (2 points a move), as measured on Reminders: Reschedule grows in first,
//     then Skip; past the open width Skip fades (66% at 30 points past, then 0.19% a point) and Reschedule stretches; armed, Skip shows at
//     30% and Reschedule whole; back out of armed, Skip's insides ease back over 150 ms while Skip itself follows the row; closed, nothing is
//     left on them. On a wide row (a computer's window) Skip's fade stops at 30%.
setup(); { const r = drawnRow(368), kids = [...r.skip.children], look = {}, back = {};
  const snap = () => ({ x: row().x, armed: r.li.classList.contains("armed"), skip: { op: r.skip.style.opacity, tf: r.skip.style.transform || "", w: r.skip.style.width || "", tr: r.skip.style.transition },
    kids: kids.map((c) => ({ op: c.style.opacity, tr: c.style.transition })), resched: { op: r.resched.style.opacity, tf: r.resched.style.transform || "", w: r.resched.style.width || "" }, capW: r.resched.children[0].style.width || "" });
  let x = 366; const move = async (dx) => { await advance(16); x += dx; touch("touchmove", x, 100, r.pri); }, at = () => (row() ? row().x : NaN);   // (each walk stops after 400 moves: a row that never moves fails the test, never hangs it)
  touch("touchstart", x, 100, r.pri);
  for (let k = 0; k < 400 && !(at() >= 330); k++) { await move(-2); if ([62, 134, 170, 186, 254, 286, 288, 330].includes(Math.round(at()))) look[Math.round(at())] = snap(); }
  for (let k = 0; k < 400 && at() > 270; k++) { await move(+2); if ([286, 284, 272].includes(Math.round(at()))) back[Math.round(at())] = snap(); }
  for (let k = 0; k < 400 && at() > 40; k++) await move(+2);
  touch("touchend", x, 100, r.pri); await advance(600);
  out.look = { ...look, back, closed: { row: row(), skip: { op: r.skip.style.opacity || "", tr: r.skip.style.transition || "" }, kids: kids.map((c) => ({ op: c.style.opacity || "", tr: c.style.transition || "" })) } }; r.drop(); }
setup(); { const r = drawnRow(648); let x = 600; touch("touchstart", x, 100, r.pri);
  for (let k = 0; k < 400 && !(row() && row().x >= 420); k++) { await advance(16); x -= 2; touch("touchmove", x, 100, r.pri); }
  out.look.wide420 = { x: row() && row().x, armed: r.li.classList.contains("armed"), skip: r.skip.style.opacity };
  touch("touchend", x, 100, r.pri); await advance(600); fire("keydown", { key: "Escape" }); await advance(600); r.drop(); }

// 22. a sync's redraw and a row: the open row it draws anew is simply there, grey with no fade in from the card's white (else it would blink
//     at every sync); a row two fingers bring back to closed after a mouse drag loses its grey; a finger resting on the open row with a redraw
//     waiting, which then scrolls (slanted, straight, or with the page scrolling under it), closes the row before the redraw comes
setup(); { const r = makeRow(); await dragOpen(r); const r2 = makeRow("w1"); r.drop();   // what the redraw draws: a new row for the same workout
  const nl = $("nextList"); nl.children = [r2.li]; nl.replaceChildren = () => {};
  let seen = "never laid out"; Object.defineProperty(r2.rcap, "offsetWidth", { get() { if (r2.li.classList.contains("swiped")) seen = r2.b.style.transition; return 61; }, configurable: true });
  fns.render(); out.redrawOpen = { greyLaidOutWith: seen, open: !!row() && row().open && row().tid === "w1" && r2.li.classList.contains("swiped") };
  delete nl.replaceChildren; nl.children = []; fire("keydown", { key: "Escape" }); await advance(600); r2.drop(); }
setup(); { const r = makeRow(); mouse("pointerdown", 300, 100, r.pri); for (let k = 1; k <= 6; k++) { await advance(16); mouse("pointermove", 300 - 10 * k, 100, r.pri); }
  for (let k = 1; k <= 6; k++) { await advance(16); mouse("pointermove", 240 + 10 * k, 100, r.pri); } mouse("pointerup", 300, 100, r.pri); await advance(50);   // out and back to its place, let go: still settling
  await play([2, 4, 6, 8, 8, 6, 4, 2].map((d) => [d, 0]), r.pri, -1); await advance(800);   // two fingers to the right on it
  out.closedGrey = { grey: r.li.classList.contains("swiped"), row: row() }; r.drop(); }
out.waiting = {};
for (const [name, moves] of [["slanted", [[-9, 5], [-12, 30]]], ["straight", [[0, 12], [0, 30]]], ["pageScrolled", [[-2, 3], [-3, 6]]]]) {
  setup(); const r = makeRow(); await dragOpen(r); const r2 = makeRow("w1");   // what the redraw draws: a new row for the same workout
  const nl = $("nextList"); let renders = 0; nl.replaceChildren = () => { renders++; }; nl.children = [r2.li];
  touch("touchstart", 200, 100, r.pri); await advance(30); ui.render();   // a sync comes while the finger rests on the open row: it waits
  if (name === "pageScrolled") globalThis.scrollY = 30;
  for (const [dx, dy] of moves) { await advance(16); touch("touchmove", 200 + dx, 100 + dy, r.pri); }
  globalThis.scrollY = 0; await advance(600); touch("touchend", 200 + moves[1][0], 100 + moves[1][1], r.pri); await advance(800);
  out.waiting[name] = { renders, row: row() && { open: row().open, x: row().x } };
  delete nl.replaceChildren; nl.children = []; r.drop(); r2.drop();
}

// 23. two fingers after a let-go, while Safari still coasts: gentle one-point moves back the other way are new fingers (coasting never
//     turns): the row follows them back and closes; a swipe that speeds up again over another row is new fingers too: that row moves and opens
setup(); { const r = makeRow(); await play([...FINGERS, ...COAST.slice(0, 10)].map((d) => [d, 0]), r.pri); const openThen = !!row() && row().open;
  shown.set(r.b, "matrix(1, 0, 0, 1, " + -W2 + ", 0)");                  // still settling: on the screen at its open width, where the new fingers take it up
  let least = W2; for (let k = 0; k < 120; k++) { wheel(-1, 0, r.pri); if (row()) least = Math.min(least, row().x); await advance(8.33); }
  shown.clear(); await advance(800); out.coast = { openThen, backTo: least, after: row() }; r.drop(); }
setup(); { const a = makeRow("w1"), b = makeRow("w2"); await play([...FINGERS, ...COAST.slice(0, 16)].map((d) => [d, 0]), a.pri);
  let moved = 0; for (const d of [1, 2, 3, 5, 7, 9, 11, 12, 12, 12, 11, 10, 8, 6, 4, 2]) { wheel(d, 0, b.pri); const s = row(); if (s && s.tid === "w2") moved = Math.max(moved, s.x); await advance(8.33); }
  await advance(800); out.coast.speedUp = { moved, open: row() && row().open && row().tid }; fire("keydown", { key: "Escape" }); await advance(600); a.drop(); b.drop(); }

// 24. the field being typed in, with the pointer over it: while its text can still scroll back (scrolled 30) two fingers to the right are its
//     own (the page stays, nothing kept from the browser, the field kept); with its text at its start they go back, the field let go first
toWorkout(); document.activeElement = field; field.scrollLeft = 0; blurred = 0; out.focusedUnder = { atStart: { ...(await wb([...FINGERS, ...COAST], field)), blurred } };
toWorkout(); document.activeElement = field; field.scrollLeft = 30; blurred = 0; out.focusedUnder.scrolled = { ...(await wb([...FINGERS, ...COAST], field)), blurred };
document.activeElement = null; delete field.scrollLeft; fns.forceSwipe(false);

// 25. a tap on the tab bar with a row open acts at once (its touchend and its click go through) and the row closes, as the top bar's does
setup(); { const dock = mk("div"), tab = mk("button"); dock.id = "dock"; dock.append(tab); dock.parentElement = ROOT;
  const a = makeRow("w1"); await dragOpen(a); const opened = !!row() && row().open;
  touch("touchstart", 100, 780, tab); await advance(60); const end = touch("touchend", 100, 780, tab); await advance(5); const eaten = click(tab).defaultPrevented; await advance(600);
  out.tabBar = { opened, endCancelled: end.defaultPrevented, clickEaten: eaten, closed: !row() }; a.drop(); dock.parentElement = null; }

// 26. two fingers to the right over what only a finger slides: a set track whose sets fit, the week strip: the page goes back; over a set
//     track scrolled 120 px (it scrolls back itself) the page stays and nothing of the gesture is kept from the browser
{ const wrap = mk("div"), tracker = mk("div", ["tracker"]), chips = mk("div", ["tr-chips"]), chip = mk("button"); chips.append(chip); tracker.append(chips); wrap.append(tracker); wrap.parentElement = ROOT;
  const gcs = globalThis.getComputedStyle; globalThis.getComputedStyle = (n) => (n === chips ? { ...gcs(n), overflowX: "auto" } : gcs(n));   // the track scrolls sideways when its sets overflow
  Object.assign(chips, { scrollWidth: 300, clientWidth: 300, scrollLeft: 0 }); toWorkout(); out.overTrack = { fits: await wb([...FINGERS, ...COAST], chip) };
  Object.assign(chips, { scrollWidth: 600, clientWidth: 300, scrollLeft: 120 }); toWorkout(); out.overTrack.scrolled = await wb([...FINGERS, ...COAST], chip);
  Object.assign(chips, { scrollWidth: 600, clientWidth: 300, scrollLeft: 0 }); toWorkout(); out.overTrack.longAtStart = await wb([...FINGERS, ...COAST], chip);   // a long track not yet scrolled: nothing to scroll back
  globalThis.getComputedStyle = gcs; wrap.parentElement = null; }
{ const week = mk("div", ["week"]), wd = mk("button"); week.id = "week"; week.append(wd); week.parentElement = ROOT;   // the coach on a client's page: Back goes to Clients
  app.reset(); app.set({ signedIn: true, clientMode: false, tab: "workouts" }); maps.clients.set("c1", { id: "c1", name: "Jane", unit: "lb" });
  app.set({ view: { name: "client", id: "c1" } }); fns.render(); fns.forceSwipe(true);
  out.overWeek = await wb([...FINGERS, ...COAST], wd); week.parentElement = null; }
fns.forceSwipe(false);

// 27. a mouse on a Mac: a drag whose last move already says no button (Safari reads the button when it handles the move, so that can come
//     after the release) is let go there: its click opens nothing, and a drag armed before that move still opens the days; a click on the
//     open row that wobbles mostly up or down only closes it, its click going nowhere
setup(); { const a = makeRow("w1", 368); out.noButton = {}; out.wobble = {};
  const drag = async (from, n) => { mouse("pointerdown", from, 100, a.pri); let x = from; for (let k = 1; k <= n; k++) { await advance(16); x -= 8; mouse("pointermove", x, 100, a.pri, k === n ? { buttons: 0 } : {}); } mouse("pointerup", x, 100, a.pri); return click(a.b).defaultPrevented; };
  out.noButton.full = { clickEaten: await drag(360, 40) }; await advance(600); out.noButton.full.picker = fns.datePicker() && fns.datePicker().title; if (fns.datePicker()) fns.closeDatePicker();
  out.noButton.open = { clickEaten: await drag(300, 15) }; await advance(600); out.noButton.open.open = !!row() && row().open;
  for (const [dx, dy] of [[0, 6], [2, 7], [4, 9], [-5, 12]]) {
    if (!(row() && row().open)) { mouse("pointerdown", 300, 100, a.pri); for (let k = 1; k <= 15; k++) { await advance(16); mouse("pointermove", 300 - 8 * k, 100, a.pri); } mouse("pointerup", 180, 100, a.pri); click(a.b); await advance(600); }   // opened by a mouse drag
    const was = !!row() && row().open;
    mouse("pointerdown", 300, 100, a.pri); await advance(30); mouse("pointermove", 300 + dx, 100 + dy, a.pri); await advance(30); mouse("pointerup", 300 + dx, 100 + dy, a.pri);
    const eaten = click(a.b).defaultPrevented; await advance(600); out.wobble[dx + "," + dy] = { was, eaten, closed: !row() };
  }
  const mouseOpen = async () => { if (!(row() && row().open)) { mouse("pointerdown", 300, 100, a.pri); for (let k = 1; k <= 15; k++) { await advance(16); mouse("pointermove", 300 - 8 * k, 100, a.pri); } mouse("pointerup", 180, 100, a.pri); click(a.b); await advance(600); } return !!row() && row().open; };
  { const was = await mouseOpen();   // a click on the open row whose one small move already says no button: that move is its release (the row closes, its click goes nowhere)
    mouse("pointerdown", 300, 100, a.pri); await advance(30); mouse("pointermove", 302, 100, a.pri, { buttons: 0 }); await advance(5); mouse("pointerup", 302, 100, a.pri);
    const eaten = click(a.b).defaultPrevented; await advance(600); out.clickNoButton = { was, eaten, closed: !row() }; }
  { const was = await mouseOpen(); let maxX = 0;   // a press on the open row that drifts down first, then goes clearly sideways: the mouse takes the row up and draws it on to Reschedule
    mouse("pointerdown", 300, 100, a.pri); await advance(16); mouse("pointermove", 300, 107, a.pri);
    for (let k = 1; k <= 20; k++) { await advance(16); mouse("pointermove", 300 - 8 * k, 108, a.pri); if (row()) maxX = Math.max(maxX, row().x); }
    mouse("pointerup", 140, 108, a.pri); const eaten = click(a.b).defaultPrevented; await advance(600);
    out.dragOpenRow = { was, maxX: Math.round(maxX * 100) / 100, eaten, picker: fns.datePicker() && fns.datePicker().title }; if (fns.datePicker()) fns.closeDatePicker(); }
  if (row()) { fire("keydown", { key: "Escape" }); await advance(600); } a.drop(); }

// 28. a slow slanted scroll over a row (40 events of 1 across and 0.6 down: a scroll by the 2:1 rule) stays the scroll it began as: at most
//     its first few events, still undecided, are kept from the page; a row swiped 40 ms after a slanted scroll (35 degrees off vertical) moves
setup(); { const r = makeRow(); const p = await play(Array.from({ length: 40 }, () => [1, 0.6]), r.pri); await advance(800); out.slowSlant = { kept: p.prevented, row: row() }; r.drop(); }
setup(); { const r = makeRow(); await play(Array.from({ length: 12 }, () => [7, 10]), r.pri); await advance(40);
  const p = await play(DRAG.map((d) => [d, 0]), r.pri); await advance(800); out.slowSlant.rowAfter = { moved: p.maxX, open: !!row() && row().open };
  if (row()) { fire("keydown", { key: "Escape" }); await advance(600); } r.drop(); }

// 29. a swipe back started while typing (a field focused, the pointer elsewhere): the field and its typing look go first, so this page's tab
//     bar slides with the page from the first frame (never shown again standing still over the page underneath)
toWorkout(); { const dock = $("dock"), kids = dock.children; dock.children = [{ hidden: false }];   // the tab bar is up on this page
  const plainBlur = field.blur; field.blur = () => { plainBlur(); fire("focusout", { target: field }); };   // as the browser does: focusout at once
  document.activeElement = field; fire("focusin", { target: field }); const typing = document.body.classList.contains("typing");
  let first = null;
  for (const d of [...FINGERS, ...COAST]) { wheel(-d, 0, pageDiv); const s = fns.swipeState(); if (!first && s && s.on) first = { typing: document.body.classList.contains("typing"), dock: dock.style.transform || "" }; await advance(8.33); }
  await advance(1500); out.typingBack = { typing, first, view: app.get().view.name };
  field.blur = plainBlur; document.activeElement = null; document.body.classList.remove("typing"); dock.children = kids; delete dock.style.transform; delete dock.style.transition; }
fns.forceSwipe(false);

// 30. a workout with nothing added yet: the client's page offers Skip workout (as its row does) and no Finish; skipped through the sheet from
//     its row, its page (opened from History) shows the Skipped line with Undo, and Undo brings it back; the trainer's own page of an empty
//     workout still to do offers Skip workout too (his row skips it), and of one the client skipped shows its Undo
const finishArea = () => ({ area: !$("finishWrap").hidden, finishBtn: !$("finishBtn").hidden, skipBtn: !$("skipLine").hidden, skippedLine: !$("skippedLine").hidden, more: !$("tMore").hidden });   // what the page shows
{ const wasHidden = sheet.hidden; out.empty = {};
  setup(); sheet.hidden = true; app.set({ view: { name: "training", id: "w1" } }); fns.render(); const before = finishArea();
  app.set({ view: { name: "client", id: "c1" } }); fns.render(); fns.rowSkip("w1"); await advance(400); pick("Sick"); press("skGo");
  app.set({ view: { name: "training", id: "w1" } }); fns.render(); const skipped = { page: finishArea(), text: $("skippedText").textContent, w1: w1() };   // opened from History
  press("unskipBtn"); out.empty.client = { before, skipped, undone: { page: finishArea(), w1: w1() } };
  app.reset(); app.set({ signedIn: true, clientMode: false, tab: "workouts" }); maps.clients.set("c1", { id: "c1", name: "Jane", unit: "lb" });
  maps.trainings.set("w1", { id: "w1", clientId: "c1", title: "Legs", date: day(1), createdAt: "2026-11-01T10:00:00.000Z", completedAt: null, skippedAt: null, rows: [] });
  app.set({ view: { name: "training", id: "w1" } }); fns.render(); const toDo = finishArea();
  Object.assign(maps.trainings.get("w1"), { skippedAt: "2026-11-02T18:00:00.000Z", skipReason: "Sick" }); fns.render();   // the client's skip, brought in by a sync
  out.empty.coach = { toDo, skipped: { page: finishArea(), text: $("skippedText").textContent } };
  if (fns.skipSheet()) fns.closeSkip(); sheet.hidden = wasHidden; }

// 31. a larger Text Size: "Reschedule" wider than its capsule (the action 97 wide, its 61 capsule centred in it) grows in only once half of it
//     is uncovered, at half the action (59.17 from the card's edge), never as if the capsule touched the edge; Skip goes by its own width the same way
setup(); { const r = makeRow("w1", 368, { ow: 97 }); let x = 366; const at = {}, sk = {}; touch("touchstart", x, 100, r.pri);   // (Skip beside it still fits its 61)
  for (let k = 0; k < 400 && !(row() && row().x >= 150); k++) { await advance(16); x -= 2; touch("touchmove", x, 100, r.pri); if (row()) { at[Math.round(row().x)] = r.resched.style.opacity; sk[Math.round(row().x)] = r.skip.style.opacity; } }
  touch("touchend", x, 100, r.pri); await advance(600); fire("keydown", { key: "Escape" }); await advance(600);
  out.wide = { resched58: at[58], resched62: at[62], resched110: at[110], skip146: sk[146], skip150: sk[150] }; r.drop(); }
setup(); { const r = makeRow("w1", 368, { iw: 80 }); let x = 366; const at = {}; touch("touchstart", x, 100, r.pri);
  for (let k = 0; k < 400 && !(row() && row().x >= 124); k++) { await advance(16); x -= 2; touch("touchmove", x, 100, r.pri); if (row()) at[Math.round(row().x)] = r.skip.style.opacity; }
  touch("touchend", x, 100, r.pri); await advance(600); fire("keydown", { key: "Escape" }); await advance(600); out.wide.skip116 = at[116]; out.wide.skip124 = at[124]; r.drop(); }

// 32. a row taken up again while it still closes, after a touch moved another row: it is that same row, taken up where its closing spring has
//     it on the screen, its actions staying behind it while the finger drags it (never a second state whose close takes them away mid-drag)
setup(); { const a = makeRow("w1", 370), b = makeRow("w2", 370); await dragOpen(a);
  touch("touchstart", 300, 100, b.pri); await advance(16); touch("touchmove", 290, 100, b.pri); await advance(16); touch("touchmove", 286, 100, b.pri); touch("touchend", 286, 100, b.pri);
  await advance(60); shown.set(a.b, "matrix(1, 0, 0, 1, -30, 0)");   // where A's closing spring has it now
  touch("touchstart", 300, 100, a.pri); await advance(16); touch("touchmove", 294, 100, a.pri); await advance(16); touch("touchmove", 288, 100, a.pri); const caught = row() && row().tid === "w1" ? row().x : null; shown.clear();
  for (let k = 1; k <= 25; k++) { await advance(16); touch("touchmove", 288 - 6 * k, 100, a.pri); }
  const swipedMid = a.li.classList.contains("swiped"); touch("touchend", 138, 100, a.pri); await advance(800);
  out.backToFirst = { caught, swipedMid, open: !!row() && row().open && row().tid === "w1", swipedEnd: a.li.classList.contains("swiped") };
  touch("touchstart", 30, 20, title); touch("touchend", 30, 20, title); await advance(800); a.drop(); b.drop(); }

// 33. a full swipe let go: the row closes in its armed look (Reschedule's title still gone, Skip's insides at their share of 30%) until it has
//     closed, never the title fading back in for a moment under the days
setup(); { const r = makeRow("w1", 368); touch("touchstart", 360, 100, r.pri); let x = 360;
  for (let k = 1; k <= 40; k++) { await advance(16); x -= 8; touch("touchmove", x, 100, r.pri); } await advance(300);
  touch("touchend", x, 100, r.pri); const armedAtLift = r.li.classList.contains("armed"), skipInside = r.skip.children[0].style.opacity, skipOwn = r.skip.style.opacity; await advance(100); const armedMid = r.li.classList.contains("armed"); await advance(600);
  out.fireLook = { armedAtLift, armedMid, skipInside, skipOwn, armedEnd: r.li.classList.contains("armed"), skipInsideEnd: r.skip.children[0].style.opacity, picker: fns.datePicker() && fns.datePicker().title }; if (fns.datePicker()) fns.closeDatePicker(); r.drop(); }

// 34. a mouse: a full drag whose release never reaches the page (a menu took it), the pointer moving on 3 s later with no button: the drag is
//     cancelled where it is (open), no days open; a rest, then a move with no button and its pointerup right after it: that is the release, the days open
setup(); { const r = makeRow("w1", 368); mouse("pointerdown", 360, 100, r.pri); let x = 360;
  for (let k = 1; k <= 40; k++) { await advance(16); x -= 8; mouse("pointermove", x, 100, r.pri); }
  await advance(3000); mouse("pointermove", x, 140, pageDiv, { buttons: 0 }); await advance(600); const lostPicker = !!fns.datePicker(), lostOpen = !!row() && row().open; if (fns.datePicker()) fns.closeDatePicker();
  mouse("pointerdown", 360, 100, r.pri); x = 360; for (let k = 1; k <= 40; k++) { await advance(16); x -= 8; mouse("pointermove", x, 100, r.pri); }
  await advance(300); mouse("pointermove", x - 1, 100, r.pri, { buttons: 0 }); await advance(1); mouse("pointerup", x - 1, 100, r.pri); const restEaten = click(r.b).defaultPrevented; await advance(600);
  out.lostRelease = { lost: { picker: lostPicker, open: lostOpen }, restThenLate: { picker: fns.datePicker() && fns.datePicker().title, clickEaten: restEaten } }; if (fns.datePicker()) fns.closeDatePicker(); r.drop(); }
out.lostRelease.late = {};
for (const gap of [50, 90, 110]) { setup(); const r = makeRow("w1", 368); mouse("pointerdown", 360, 100, r.pri); let x = 360;
  for (let k = 1; k <= 40; k++) { await advance(16); x -= 8; mouse("pointermove", x, 100, r.pri); }
  await advance(16); mouse("pointermove", x - 1, 100, r.pri, { buttons: 0 }); await advance(gap); mouse("pointerup", x - 1, 100, r.pri); click(r.b); await advance(600);
  out.lostRelease.late[gap] = fns.datePicker() && fns.datePicker().title; if (fns.datePicker()) fns.closeDatePicker(); if (row()) { fire("keydown", { key: "Escape" }); await advance(600); } r.drop(); }

// 35. natural scrolling turned off (the page's delta is then the fingers' own way, and Safari says so): two fingers to the right over a long set
//     track at its start scroll it on toward its later sets (its own, nothing kept from the browser); at its end they are Safari's (its forward
//     on such a Mac), nothing of the app's. Two fingers to the left scroll it back, and at its start the page goes back. The same for the field
//     being typed in under the pointer, its text longer than the box (let go first when the page goes back)
{ const wheelOff = (dx, target) => fire("wheel", { deltaX: dx, deltaY: 0, deltaMode: 0, ctrlKey: false, target, webkitDirectionInvertedFromDevice: false, timeStamp: Math.floor(NOW) });
  const wbOff = async (deltas, target) => { let kept = 0; for (const d of deltas) { if (wheelOff(d, target).defaultPrevented) kept++; await advance(8.33); } await advance(1500); return { view: app.get().view.name, kept }; };
  const wrap = mk("div"), tracker = mk("div", ["tracker"]), chips = mk("div", ["tr-chips"]), chip = mk("button"); chips.append(chip); tracker.append(chips); wrap.append(tracker); wrap.parentElement = ROOT;
  const gcs = globalThis.getComputedStyle; globalThis.getComputedStyle = (n) => (n === chips ? { ...gcs(n), overflowX: "auto" } : gcs(n));
  Object.assign(chips, { scrollWidth: 600, clientWidth: 300, scrollLeft: 0 }); toWorkout(); out.unnatural = { trackAtStart: await wbOff([...FINGERS, ...COAST], chip) };
  Object.assign(chips, { scrollWidth: 600, clientWidth: 300, scrollLeft: 300 }); toWorkout(); out.unnatural.trackAtEnd = await wbOff([...FINGERS, ...COAST], chip);
  const LEFT = [...FINGERS, ...COAST].map((d) => -d);                    // fingers to the left: Safari's back on this Mac (its page delta toward the start)
  Object.assign(chips, { scrollWidth: 600, clientWidth: 300, scrollLeft: 300 }); toWorkout(); out.unnatural.leftAtEnd = await wbOff(LEFT, chip);
  Object.assign(chips, { scrollWidth: 600, clientWidth: 300, scrollLeft: 0 }); toWorkout(); out.unnatural.leftAtStart = await wbOff(LEFT, chip);
  globalThis.getComputedStyle = gcs; wrap.parentElement = null;
  Object.assign(field, { scrollWidth: 600, clientWidth: 300 });
  toWorkout(); document.activeElement = field; field.scrollLeft = 0; blurred = 0; out.unnatural.fieldCanScroll = { ...(await wbOff([...FINGERS, ...COAST], field)), blurred };
  toWorkout(); document.activeElement = field; field.scrollLeft = 300; blurred = 0; out.unnatural.fieldAtEnd = { ...(await wbOff([...FINGERS, ...COAST], field)), blurred };
  toWorkout(); document.activeElement = field; field.scrollLeft = 300; blurred = 0; out.unnatural.fieldLeftCanScroll = { ...(await wbOff(LEFT, field)), blurred };
  toWorkout(); document.activeElement = field; field.scrollLeft = 0; blurred = 0; out.unnatural.fieldLeftAtStart = { ...(await wbOff(LEFT, field)), blurred };
  document.activeElement = null; delete field.scrollLeft; delete field.scrollWidth; delete field.clientWidth; fns.forceSwipe(false);
  wheel(0, 3, title); await advance(800); }   // (natural scrolling back on for what follows)

// 36. a quick diagonal scroll, more sideways than down yet a scroll by the 2:1 rule (1.43:1): Safari speeds up each way of its coasting on its
//     own, so the coasting leans further sideways (2.14:1). It stays the scroll it began as: on the workout page no swipe back, over a row no row
//     moves. New fingers right after it, clearly sideways, are a gesture of their own: the page goes back
{ const DIAG = [[5, 3.5], [6, 4.2], [8, 5.6], [10, 7], [12, 8.4], [14, 9.8], [15, 7], [14, 6.5], [13, 6.1], [12, 5.6], [11, 5.1], [10, 4.7], [9, 4.2], [8, 3.7], [7, 3.3], [6, 2.8], [5, 2.3], [4, 1.9], [3, 1.4], [2, 0.9], [1, 0.5]];
  toWorkout(); const pg = await play(DIAG, pageDiv, -1); await advance(1500); out.diagonal = { page: { view: app.get().view.name, kept: pg.prevented } };
  toWorkout(); const p1 = await play(DIAG, pageDiv, -1); const p2 = await play([...FINGERS, ...COAST].map((d) => [d, 0]), pageDiv, -1); await advance(1500);
  out.diagonal.thenSideways = { view: app.get().view.name, kept: p1.prevented + p2.prevented }; fns.forceSwipe(false);
  setup(); const r = makeRow(); const pr = await play(DIAG, r.pri); await advance(800); out.diagonal.row = { maxX: pr.maxX, kept: pr.prevented, row: row() }; r.drop();
  const S30 = [[0.08,0.04],[0.12,0.07],[0.33,0.19],[0.65,0.38],[1.09,0.63],[1.63,0.94],[2.28,1.32],[3.02,1.75],[3.85,2.22],[4.73,2.73],[5.92,3.42],[7.2,4.16],[8.51,4.92],[9.78,5.65],[10.94,6.32],[11.93,6.89],[11.93,6.89],[9,2],[11,4],[10,4],[12,5],[11,4],[10,4],[11,5],[11,4],[10,4],[10,4],[11,4],[9,4],[10,4],[10,4],[9,3],[9,4],[8,3],[9,3],[8,4],[8,3],[7,3],[7,2],[6,3],[6,2],[7,3],[6,2],[5,2],[5,3],[5,2],[5,2],[5,2],[4,1],[4,2],[5,2],[3,1],[4,2],[4,1],[3,2],[3,1],[3,2],[3,1],[3,1],[3,1],[3,1],[2,1],[3,1],[2,2],[2,1]];
  toWorkout(); let slid = false; for (const [dx, dy] of S30) { wheel(-dx, dy, pageDiv); const s = fns.swipeState(); if (s && s.on) slid = true; await advance(8.33); } await advance(1500);
  out.diagonal.slant30 = { page: { view: app.get().view.name, slid } }; fns.forceSwipe(false);
  setup(); const r30 = makeRow(); const p30 = await play(S30, r30.pri); await advance(800); out.diagonal.slant30.row = { maxX: p30.maxX, row: row() }; r30.drop();
  toWorkout(); await play([[0, 3], [0.4, 7], [0, 12], [0, 16], [0, 16], [0.3, 15], [0, 14], [0, 12]], pageDiv, -1); const pt = await play([...FINGERS, ...COAST].map((d) => [d, d / 2.5]), pageDiv, -1); await advance(1500);
  out.diagonal.uprightThenTilted = { view: app.get().view.name, kept: pt.prevented }; fns.forceSwipe(false);
  // its coasting in WebKit's whole pixels, each way rounded on its own: lone events, and once two in a row, more sideways than the scroll's own
  // 2.86:1, never three: the scroll it began as (each such event, which may be new fingers, is kept from Safari meanwhile, never a gesture cut)
  const TAIL = [...DIAG.slice(0, 17), [4, 1], [3, 2], [3, 2], [4, 1], [3, 1], [2, 2], [2, 1], [3, 1], [2, 2], [1, 1], [2, 1], [1, 1], [1, 0], [1, 1], [1, 0], [0, 1], [1, 0]];
  toWorkout(); const ptl = await play(TAIL, pageDiv, -1); await advance(1500); out.diagonal.tailPage = { view: app.get().view.name, kept: ptl.prevented }; fns.forceSwipe(false);
  setup(); const r2 = makeRow(); const pr2 = await play(TAIL, r2.pri); await advance(800); out.diagonal.tailRow = { maxX: pr2.maxX, kept: pr2.prevented, row: row() }; r2.drop(); }

// 37. a full swipe let go whose workout can no longer move (finished meanwhile, so no days open), caught again by the finger while it closes:
//     the row is a row on the move again, no longer in the armed look it was let go in
setup(); { const r = makeRow("w1", 368); touch("touchstart", 360, 100, r.pri); let x = 360;
  for (let k = 1; k <= 40; k++) { await advance(16); x -= 8; touch("touchmove", x, 100, r.pri); }
  maps.trainings.get("w1").completedAt = "2026-11-02T18:00:00.000Z"; touch("touchend", x, 100, r.pri); const armedAtLift = r.li.classList.contains("armed"); await advance(60);
  touch("touchstart", 200, 100, r.pri); await advance(16); touch("touchmove", 190, 100, r.pri); await advance(16); touch("touchmove", 186, 100, r.pri);
  out.fireRegrab = { armedAtLift, picker: !!fns.datePicker(), armedAfter: r.li.classList.contains("armed") };
  touch("touchend", 186, 100, r.pri); await advance(800); if (row()) { fire("keydown", { key: "Escape" }); await advance(800); } r.drop(); }

// 38. the same row swiped open, closed (a tap elsewhere), then swiped again: a finger, then a mouse, then two fingers: its actions behind it every time
setup(); { const r = makeRow("w1", 368); out.again = {};
  const closeIt = async () => { touch("touchstart", 30, 20, title); touch("touchend", 30, 20, title); await advance(800); };
  await dragOpen(r); out.again.first = r.li.classList.contains("swiped"); await closeIt();
  touch("touchstart", 300, 100, r.pri); for (let k = 1; k <= 11; k++) { await advance(16); touch("touchmove", 300 - 10 * k, 100, r.pri); }
  out.again.finger = r.li.classList.contains("swiped"); await advance(120); touch("touchend", 190, 100, r.pri); await advance(600); await closeIt();
  mouse("pointerdown", 300, 100, r.pri); for (let k = 1; k <= 15; k++) { await advance(16); mouse("pointermove", 300 - 8 * k, 100, r.pri); }
  out.again.mouse = r.li.classList.contains("swiped"); mouse("pointerup", 180, 100, r.pri); click(r.b); await advance(600); await closeIt();
  await play(DRAG.map((d) => [d, 0]), r.pri); out.again.wheel = r.li.classList.contains("swiped"); await advance(800); fire("keydown", { key: "Escape" }); await advance(800); r.drop(); }

// 39. three swipes back in a row, quickly (the coach from a workout to Clients): the second lands while the page is still settling and goes
//     nowhere, as on iPhone; the third, while the second still glides, is new fingers: the app's own slide, its first move kept from Safari
//     (Safari starts its own swipe only on a gesture's first event: in the Dock's web app the slide with nothing behind the page)
const coachWorkout = () => { app.reset(); app.set({ signedIn: true, clientMode: false, tab: "workouts" }); maps.clients.set("c1", { id: "c1", name: "Jane", unit: "lb" });
  maps.trainings.set("w1", { id: "w1", clientId: "c1", title: "Legs", date: day(1), createdAt: "2026-11-01T10:00:00.000Z", completedAt: null, skippedAt: null, rows: [] });
  app.set({ view: { name: "training", id: "w1" } }); fns.render(); fns.forceSwipe(true); };
{ coachWorkout();
  const views = []; await play([...FINGERS, ...COAST.slice(0, 30)].map((d) => [d, 0]), pageDiv, -1); views.push(app.get().view.name);   // let go, still settling as the next fingers land
  await advance(20); let secondSlid = false; for (const d of [...FINGERS, ...COAST.slice(0, 20)]) { wheel(-d, 0, pageDiv); const s = fns.swipeState(); if (s && s.on && !s.busy) secondSlid = true; await advance(8.33); } views.push(app.get().view.name);
  await advance(20); let first = null; for (const d of [...FINGERS, ...COAST]) { const e = wheel(-d, 0, pageDiv); if (first == null) first = e.defaultPrevented; await advance(8.33); }
  await advance(1500); views.push(app.get().view.name); out.tripleBack = { views, secondSlid, thirdFirstKept: first }; fns.forceSwipe(false); }
// 40. a flick back, then, while the page still settles, one slow swipe to the right (a hand's 450 ms drag, slow at its start and end, as
//     wk.mjs makes it) and nothing after it: begun mid-transition, it goes nowhere from its start to its end, as on iPhone (never a slide
//     that starts part-way through it once the page has landed: its own fingers speeding up are not new ones)
{ coachWorkout();
  const SLOW = [0.03, 0.05, 0.13, 0.25, 0.4, 0.6, 0.84, 1.11, 1.42, 1.77, 2.23, 2.75, 3.33, 3.97, 4.67, 5.42, 6.19, 6.99, 7.79, 8.59, 9.35, 10.08, 10.75, 11.35, 11.86, 12.27, 12.58, 12.78, 12.86, 12.82, 12.65, 12.37, 11.98, 11.48, 10.89, 10.22, 9.48, 8.69, 7.87, 7.02, 6.17, 5.34, 4.53, 3.77, 3.06, 2.42, 1.85, 1.36, 0.95, 0.62, 0.36, 0.18, 0.06, 0.01];
  await play([...FINGERS, ...COAST.slice(0, 22)].map((d) => [d, 0]), pageDiv, -1); await advance(20);   // let go; the slow swipe's first 8 px come while the page still settles
  let slid = false; for (const d of SLOW) { wheel(-d, 0, pageDiv); const s = fns.swipeState(); if (s && s.on && !s.busy) slid = true; await advance(8.33); }
  await advance(1500); out.slowWhileSettling = { slid, view: app.get().view.name }; fns.forceSwipe(false); }

// 41. the trainer's view of a client's page (his pick, 9 Nov): the row the app draws swipes there too. Two fingers to the left open it and
//     stop, as in the client's view; its Reschedule opens the days for any day (no first day), as his date on the workout page; two fingers
//     to the right over a closed row go back to Clients
const coachClient = () => { app.reset(); app.set({ signedIn: true, clientMode: false, tab: "workouts" }); maps.clients.set("c1", { id: "c1", name: "Jane", unit: "lb" });
  maps.trainings.set("w1", { id: "w1", clientId: "c1", title: "Legs", date: day(1), createdAt: "2026-11-01T10:00:00.000Z", completedAt: null, skippedAt: null, rows: [] });
  app.set({ view: { name: "client", id: "c1" } }); fns.render(); };
try { coachClient(); const r = drawnRow(); const p = await play([...FINGERS, ...COAST].map((d) => [d, 0]), r.pri); await advance(800);
  const opened = { open: !!row() && row().open, x: row() && Math.round(row().x * 100) / 100, kept: p.prevented };
  const t = await tap(r.resched.children[0], 330, 100, r.resched.on.click); const dp = fns.datePicker();
  out.coachRow = { hasActions: r.li.classList.contains("swipe-row"), opened, tap: t, days: dp && { title: dp.title, min: dp.min } };
  if (fns.datePicker()) fns.closeDatePicker(); await advance(600); r.drop();
  coachClient(); fns.forceSwipe(true); const r2 = drawnRow(); const p2 = await play([...FINGERS, ...COAST].map((d) => [d, 0]), r2.pri, -1); await advance(1500);
  out.coachRow.rightOverRow = { view: app.get().view.name, kept: p2.prevented, row: row() }; fns.forceSwipe(false); r2.drop();
} catch (e) { out.coachRow = { error: String(e && e.message || e) }; fns.forceSwipe(false); if (fns.datePicker()) fns.closeDatePicker(); }   // (a row drawn with nothing behind it, or a throw: a failed check, not a lost run)

// 34. a missed workout's row (his pick B, 10 Nov): three actions, Skip, Reschedule and outermost Today. A finger draws it out slowly: each
//     grows as its own slot is uncovered (Today, then Reschedule, then Skip); past the open width the two inner ones fade alike and Today
//     stretches; armed, both inner ones show at 30%; let go armed, the workout comes to today (the full swipe's Do it today, not the days)
try {
  setup(); const t = maps.trainings.get("w1"); t.date = day(-2); fns.render();
  const make = document.createElement; document.createElement = mkDrawn;
  let li; try { li = fns.workoutRow(t, "missed", true); } finally { document.createElement = make; }
  const layer = li.children.find((c) => c.classList.contains("swipe-acts")); li._w = 368;
  for (const a of layer.children) { a._ow = 61; a.children[0]._ow = 61; }
  const ul = mk("ul", ["list"]); ul.append(li); ul.parentElement = ROOT;
  const pri = li.children[0].children[2].children[0], [skip, resched, todayA] = layer.children, inner = [skip, resched];
  const snap = () => ({ armed: li.classList.contains("armed"), ops: [skip, resched, todayA].map((a) => a.style.opacity), tfs: [skip, resched, todayA].map((a) => a.style.transform || ""), w: todayA.style.width || "", kids: inner.map((a) => a.children.map((c) => c.style.opacity)), parts: li.children.filter((c) => c !== layer).map((c) => c.style.transform || "") });
  const look = {}; let x = 366; touch("touchstart", x, 100, pri);
  for (let k = 0; k < 400 && !(row() && row().x >= 300); k++) { await advance(16); x -= 2; touch("touchmove", x, 100, pri); const at = row() ? Math.round(row().x) : -1; if ([62, 134, 206, 256, 290].includes(at)) look[at] = snap(); }
  out.three = { classes: layer.children.map((a) => a.className), titles: layer.children.map((a) => a.children[1] && a.children[1].textContent), w: row() && row().w, look };
  touch("touchend", x, 100, pri); await advance(800);
  out.three.fired = { today: t.date === fns.today(), moved: maps.pendingMove.has("w1"), days: !!fns.datePicker(), closed: row() === null };
  out.three.cleared = [skip, resched, todayA].map((a) => [a.style.opacity || "", a.style.transform || "", a.style.width || ""]).concat(inner.flatMap((a) => a.children.map((c) => [c.style.opacity || "", "", ""])));
  if (fns.datePicker()) fns.closeDatePicker(); ul.parentElement = null;
} catch (e) { out.three = { error: String(e && e.stack || e) }; }
// 35. a sync's redraw with a missed workout's row open: the Missed card's new row for it is open, as Today's and Up next's are
try {
  setup(); const t = maps.trainings.get("w1"); t.date = day(-2); fns.render();
  const drawMissed = () => { const make = document.createElement; document.createElement = mkDrawn; let li; try { li = fns.workoutRow(t, "missed", true); } finally { document.createElement = make; }
    const layer = li.children.find((c) => c.classList.contains("swipe-acts")); li._w = 368; for (const a of layer.children) { a._ow = 61; a.children[0]._ow = 61; }
    const ul = mk("ul", ["list"]); ul.append(li); ul.parentElement = ROOT; return { li, ul, pri: li.children[0].children[2].children[0] }; };
  const a = drawMissed(); let x = 300; touch("touchstart", x, 100, a.pri);
  for (let k = 1; k <= 16; k++) { await advance(16); x -= 10; touch("touchmove", x, 100, a.pri); }
  await advance(120); touch("touchend", x, 100, a.pri); await advance(800);
  const openBefore = !!row() && row().open;
  const b = drawMissed(); a.ul.parentElement = null;                   // what the redraw draws: a new row for the same workout, on the Missed card
  const ml = $("missList"); ml.children = [b.li]; ml.replaceChildren = () => {}; ml.appendChild = (c) => c;
  fns.render();
  out.missRedraw = { openBefore, open: !!row() && row().open && row().tid === "w1" && b.li.classList.contains("swiped") };
  delete ml.replaceChildren; delete ml.appendChild; ml.children = []; fire("keydown", { key: "Escape" }); await advance(600); b.ul.parentElement = null;
} catch (e) { out.missRedraw = { error: String(e && e.stack || e) }; }
// 36. a tap on an open missed row's Reschedule: the days, never Do it today (only Today's button and the full swipe bring it to today)
try {
  setup(); const t = maps.trainings.get("w1"); t.date = day(-2); fns.render(); const before = t.date;
  const make = document.createElement; document.createElement = mkDrawn; let li; try { li = fns.workoutRow(t, "missed", true); } finally { document.createElement = make; }
  const layer = li.children.find((c) => c.classList.contains("swipe-acts")); li._w = 368; for (const a of layer.children) { a._ow = 61; a.children[0]._ow = 61; }
  const ul = mk("ul", ["list"]); ul.append(li); ul.parentElement = ROOT; const pri = li.children[0].children[2].children[0], resched = layer.children[1];
  let x = 300; touch("touchstart", x, 100, pri); for (let k = 1; k <= 16; k++) { await advance(16); x -= 10; touch("touchmove", x, 100, pri); }
  await advance(120); touch("touchend", x, 100, pri); await advance(800);
  const open = !!row() && row().open;
  const tp = await tap(resched.children[0], 250, 100, resched.on.click); await advance(600);
  const dp = fns.datePicker();
  out.missResched = { open, tap: tp, days: dp && dp.title, date: t.date === before, moved: maps.pendingMove.has("w1") };
  if (fns.datePicker()) fns.closeDatePicker(); await advance(600); ul.parentElement = null;
} catch (e) { out.missResched = { error: String(e && e.stack || e) }; }

console.log(JSON.stringify(out));
process.exit(0);
