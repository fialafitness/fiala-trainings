// Run by week-pager.test.js in its own process: the client page's week strip pages week by week under a finger, a Mac's mouse and two
// fingers on its trackpad (his ask, 13 Nov: "we should add the ability to slide between weeks as well right and left swipe between weeks";
// his pick: as the month does). This loads the real app/main.js on its own clock and on a fixed day (Wednesday 11 November 2026, 10 am:
// the strip is Monday 9 to Sunday 15), with page elements that keep their children, their parents and their own listeners, know where they
// are and how tall a week is (60, and 20 for each workout of its busiest day), plays the gestures as WebKit sends them (the document's
// capture listeners, the elements' from the top down, then back up to the document) and prints, as JSON, what each did.
import { byId, el } from "./env.js";
// the clock: every timer is this one's, and so are performance.now and the date
let NOW = 10000, SEQ = 0; const Q = [];
globalThis.setTimeout = (fn, ms) => { const id = ++SEQ; Q.push({ id, at: NOW + Math.max(0, ms || 0), fn }); return id; };
globalThis.clearTimeout = (id) => { const i = Q.findIndex((q) => q.id === id); if (i >= 0) Q.splice(i, 1); };
try { performance.now = () => NOW; } catch (_) { Object.defineProperty(globalThis, "performance", { value: { now: () => NOW }, configurable: true }); }
globalThis.requestAnimationFrame = (fn) => setTimeout(() => fn(NOW), 16); globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
const RealDate = Date, BASE = new RealDate(2026, 10, 11, 10, 0, 0).getTime(), NOW0 = NOW;
class FakeDate extends RealDate { constructor(...a) { if (a.length) super(...a); else super(BASE + (NOW - NOW0)); } static now() { return BASE + (NOW - NOW0); } }
globalThis.Date = FakeDate;
const flush = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };
async function advance(ms) { const end = NOW + ms; for (;;) { Q.sort((a, b) => a.at - b.at || a.id - b.id); const q = Q[0]; if (!q || q.at > end) break; Q.shift(); NOW = Math.max(NOW, q.at); q.fn(); await flush(); } NOW = end; await flush(); }
// the document and the window keep their listeners
const L = {}, WL = {};
const passiveOf = (t, o) => (o && typeof o === "object" && "passive" in o ? !!o.passive : /^(touchstart|touchmove|wheel)$/.test(t));
const captureOf = (o) => o === true || !!(o && typeof o === "object" && o.capture);
document.addEventListener = (t, fn, o) => { (L[t] ||= []).push({ fn, capture: captureOf(o), passive: passiveOf(t, o) }); };
document.removeEventListener = (t, fn) => { const a = L[t] || []; const i = a.findIndex((x) => x.fn === fn); if (i >= 0) a.splice(i, 1); };
globalThis.addEventListener = (t, fn) => { (WL[t] ||= []).push(fn); };
globalThis.removeEventListener = (t, fn) => { const a = WL[t] || []; const i = a.indexOf(fn); if (i >= 0) a.splice(i, 1); };
const qs = document.querySelector; document.querySelector = (s) => (/sheet-bg|crop-view|header \.bar/.test(s) ? null : qs(s));
document.contains = (x) => !!x;
document.documentElement.clientWidth = 402; globalThis.innerHeight = 812; globalThis.innerWidth = 402;
navigator.vibrate = () => true;
let reduce = false;                                                     // Reduce Motion, as the scene sets it
globalThis.matchMedia = (q) => ({ matches: /reduce/.test(q) ? reduce : false, addEventListener() {}, removeEventListener() {} });
// page elements: children with their parents, a place on the screen, their own listeners (capture or not), in the page or not
const ROOTS = new Set();
const cls = (e, c) => !!e && ((typeof e.className === "string" && (" " + e.className + " ").includes(" " + c + " ")) || !!(e.classList && e.classList.contains && e.classList.contains(c)));
const matches = (n, sel) => String(sel).split(",").some((part) => {   // "tag#id.class" and lists of them: what the app asks closest() for here
  const m = part.trim().match(/^([a-z]+)?(#[\w-]+)?((?:\.[\w-]+)*)$/i); if (!m || !part.trim()) return false;
  const [, tag, id, cl] = m;
  return (!tag || n.tagName === tag.toUpperCase()) && (!id || n.id === id.slice(1)) && (cl || "").split(".").filter(Boolean).every((c) => cls(n, c));
});
function adopt(p, c) { if (!c || typeof c !== "object") return; if (c.parentElement && c.parentElement !== p && c.parentElement.children) c.parentElement.children = c.parentElement.children.filter((x) => x !== c); c.parentElement = p; }
function mk(tag) {
  const e = el(tag), H = [];
  e.children = []; e.parentElement = null; e.nodeType = 1;
  e.appendChild = (c) => { adopt(e, c); e.children = [...e.children.filter((x) => x !== c), c]; return c; };
  e.append = (...k) => { for (const c of k) e.appendChild(c); };
  e.replaceChildren = (...k) => { for (const c of e.children) if (c && c.parentElement === e) c.parentElement = null; e.children = []; for (const c of k) e.appendChild(c); };
  e.remove = () => { const p = e.parentElement; if (p) { p.children = p.children.filter((x) => x !== e); e.parentElement = null; } };
  e.addEventListener = (t, fn, o) => { H.push({ t, fn, o }); };
  e.removeEventListener = (t, fn) => { const i = H.findIndex((h) => h.t === t && h.fn === fn); if (i >= 0) H.splice(i, 1); };
  e.fireAt = (t, ev, capture) => { for (const h of [...H]) if (h.t === t && captureOf(h.o) === capture && !(h.o && h.o.signal && h.o.signal.aborted)) { if (ev.stoppedAll) return; ev.__passive = !!(h.o && typeof h.o === "object" && h.o.passive); h.fn(ev); ev.__passive = false; } };
  e.fire = (t, ev) => { e.fireAt(t, ev, true); e.fireAt(t, ev, false); };
  e.listening = (t) => H.filter((h) => h.t === t).length;
  e.setAttribute = (k, v) => { e["@" + k] = String(v); }; e.getAttribute = (k) => (e["@" + k] === undefined ? null : e["@" + k]);
  e.getBoundingClientRect = () => rectOf(e);
  e.closest = (sel) => { for (let p = e, i = 0; p && i < 60; p = p.parentElement, i++) if (p.nodeType === 1 && matches(p, sel)) return p; return null; };
  e.contains = (o) => { for (let p = o, i = 0; p && i < 60; p = p.parentElement, i++) if (p === e) return true; return false; };
  e.setPointerCapture = () => {}; e.releasePointerCapture = () => {};
  e.querySelector = () => el(); e.querySelectorAll = () => [];   // (as the stand-in's own: a stub, never null)
  Object.defineProperty(e, "isConnected", { get: () => { for (let n = e, i = 0; n && i < 60; n = n.parentElement, i++) if (ROOTS.has(n)) return true; return false; }, configurable: true });
  return e;
}
const root = (id, extra = {}) => { const e = mk("div"); e.id = id; Object.assign(e, extra); byId.set(id, e); ROOTS.add(e); return e; };
for (const id of ["calTitle", "calToday", "calPrev", "calNext", "weekHead", "calToggleText", "dayMore", "pickSheet", "pickList", "pickNo", "pickTitle", "pvGo", "vHistory", "histList"]) root(id);
const calWrap = root("calWrap"), calView = root("calView", { clientWidth: 370 }), calTrack = root("calTrack"), toggle = root("calToggle"), todayBtn = root("weekToday");
calView.appendChild(calTrack); calWrap.hidden = true; todayBtn.hidden = true;
// the strip: its view (370 wide), the track in it, and last week, this one and the next on the track, as index.html has them
const view = root("weekView", { clientWidth: 370 }), track = mk("div"), prevW = mk("div"), week = mk("div"), nextW = mk("div");
for (const [e, id] of [[track, "weekTrack"], [prevW, "weekPrev"], [week, "week"], [nextW, "weekNext"]]) { e.id = id; byId.set(id, e); }
view.className = "week-view"; track.className = "week-track"; prevW.className = week.className = nextW.className = "week";
view.appendChild(track); track.append(prevW, week, nextW);
const chipsIn = (b) => { let n = 0; for (const c of b.children || []) if (cls(c, "day-evs")) n += (c.children || []).filter((x) => cls(x, "day-ev")).length; return n; };
const weekH = (w) => ((w.children || []).length ? 60 + 20 * Math.max(0, ...w.children.map(chipsIn)) : 0);   // (an empty week, either side at rest: nothing)
for (const w of [prevW, week, nextW]) Object.defineProperty(w, "offsetHeight", { get: () => weekH(w), configurable: true });
let viewH = "", heights = [];                                           // the view's height as written (each write kept), and as laid out
Object.defineProperty(view.style, "height", { get: () => viewH, set: (v) => { viewH = String(v); heights.push(viewH); }, configurable: true });
Object.defineProperty(view, "offsetHeight", { get: () => (viewH ? parseFloat(viewH) : Math.max(weekH(prevW), weekH(week), weekH(nextW))), configurable: true });   // at its own height: the tallest week on the track (a flex row)
root("whenBg", { hidden: true }); byId.get("vHistory").hidden = true;
const body = mk("body"); ROOTS.add(body); Object.defineProperty(document, "body", { value: body, configurable: true });
document.createElement = (t) => mk(t);
document.getElementById = (id) => { if (!byId.has(id)) { const e = mk("div"); byId.set(id, e); } return byId.get(id); };
// where things are: the strip as on a 402-point phone, a day a seventh of it
const box = (l, t, w, h) => ({ left: l, top: t, width: w, height: h, right: l + w, bottom: t + h, x: l, y: t });
const WEEK = { left: 16, top: 203, width: 370, height: 116 };
function rectOf(e) {
  if (e === view || e === track || e === week) return box(WEEK.left, WEEK.top, WEEK.width, WEEK.height);
  const p = e.parentElement;
  if (e.tagName === "BUTTON" && p === week) { const i = week.children.indexOf(e); return box(WEEK.left + i * WEEK.width / 7, WEEK.top, WEEK.width / 7, WEEK.height); }
  if (cls(e, "day-ev")) { const evs = p, day = evs && evs.parentElement, d = day ? rectOf(day) : box(0, 0, 0, 0), k = evs ? evs.children.indexOf(e) : 0; return box(d.left + 2, d.top + 50 + k * 19, d.width - 4, 16); }
  if (cls(e, "day-ev-t")) return p ? rectOf(p) : box(0, 0, 0, 0);
  return box(0, 0, 0, 0);
}
// events as WebKit sends them: the document's capture listeners, the page's from the top down to the target, then back up, then the document's own
function dispatch(type, target, ev = {}) {
  let passive = false; ev.type = type; ev.target = target; ev.defaultPrevented = false; ev.halted = false; ev.stoppedAll = false;
  ev.preventDefault = () => { if (!passive && !ev.__passive) ev.defaultPrevented = true; }; ev.stopPropagation = () => { ev.halted = true; }; ev.stopImmediatePropagation = () => { ev.halted = ev.stoppedAll = true; };
  if (ev.cancelable === undefined) ev.cancelable = true;
  if (ev.timeStamp == null) ev.timeStamp = Math.floor(NOW);
  const path = []; for (let n = target, i = 0; n && i < 60 && typeof n.fireAt === "function"; n = n.parentElement, i++) path.push(n);
  const ls = L[type] || [];
  for (const l of ls.filter((x) => x.capture)) { if (ev.stoppedAll) return ev; passive = l.passive; l.fn(ev); passive = false; }
  for (const n of [...path].reverse()) { if (ev.halted) return ev; n.fireAt(type, ev, true); }
  for (const n of path) { if (ev.halted) return ev; n.fireAt(type, ev, false); }
  if (!ev.halted) for (const l of ls.filter((x) => !x.capture)) { if (ev.stoppedAll) return ev; passive = l.passive; l.fn(ev); passive = false; }
  return ev;
}
let TID = 0, cur = null;
const T = (x, y, id) => ({ identifier: id, clientX: x, clientY: y });
const ptr = (type, x, y, kind = "touch", extra = {}) => dispatch(type, cur.target, { pointerType: kind, pointerId: kind === "mouse" ? 1 : 900 + cur.id, isPrimary: true, button: 0, buttons: type === "pointerup" ? 0 : 1, clientX: x, clientY: y, ...extra });
const down = (target, x, y, kind = "touch", extra = {}) => { cur = { id: ++TID, target, x, y, kind }; ptr("pointerdown", x, y, kind, extra); if (kind === "touch") dispatch("touchstart", target, { touches: [T(x, y, cur.id)], changedTouches: [T(x, y, cur.id)] }); };
const move = (x, y = cur.y) => { cur.x = x; cur.y = y; ptr("pointermove", x, y, cur.kind); if (cur.kind === "touch") dispatch("touchmove", cur.target, { touches: [T(x, y, cur.id)], changedTouches: [T(x, y, cur.id)] }); };
const up = (cancel = false) => { const p = ptr(cancel ? "pointercancel" : "pointerup", cur.x, cur.y, cur.kind); if (cur.kind === "touch") dispatch(cancel ? "touchcancel" : "touchend", cur.target, { touches: [], changedTouches: [T(cur.x, cur.y, cur.id)], cancelable: !cancel }); return p; };
const glide = async (x1, y1 = cur.y, steps = 6) => { const x0 = cur.x, y0 = cur.y; for (let i = 1; i <= steps; i++) { move(Math.round(x0 + (x1 - x0) * i / steps), Math.round(y0 + (y1 - y0) * i / steps)); await advance(16); } };
const click = (target) => dispatch("click", target, { detail: 1 });
// Safari's two fingers: the fingers (whole events), then its coasting, one event per 120 Hz frame (row-swipe-probe.mjs, measured 8 Nov)
const FINGERS = [1, 2, 4, 6, 9, 12, 14, 15], COAST = [15, 16, 15, 15, 16, 15, 15, 15, 14, 15, 14, 14, 13, 13, 12, 12, 11, 11, 10, 10, 9, 9, 8, 8, 7, 7, 6, 6, 5, 5, 5, 4, 4, 4, 3, 3, 3, 2, 2, 2, 2, 1, 1, 1, 1, 1];
const steady = (px, step = 5) => Array.from({ length: Math.round(px / step) }, () => step);
async function play(deltas, target, sign = 1) {   // sign 1: a scroll to the right (fingers to the left, scrolling naturally): the next week
  let prevented = 0, most = 0;
  for (const d of deltas) { const [dx, dy] = Array.isArray(d) ? d : [d, 0]; const e = dispatch("wheel", target, { deltaX: sign * dx, deltaY: dy, deltaMode: 0, ctrlKey: false, shiftKey: false, webkitDirectionInvertedFromDevice: true }); if (e.defaultPrevented) prevented++; const x = trX(); if (typeof x === "number" && Math.abs(x) > Math.abs(most)) most = x; await advance(8.33); }
  return { prevented, most };
}
// the app on a client's page
const app = (await import("../app/main.js")).internals();
const { fns, maps } = app;
const iso = (d) => fns.localIso(d), day = (n) => { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + n); return iso(d); };
let WN = 0;
const W = (id, title, n, extra = {}) => ({ id, clientId: "c1", title, date: day(n), createdAt: "2026-11-01T0" + (WN++ % 9) + ":00:00.000Z", completedAt: null, skippedAt: null, rows: [{ id: "r" + id, name: "Squat", sets: "3", reps: "10" }], ...extra });
async function seed(clientMode = false) {
  await advance(1000);                                                  // (each scene on a settled page: the last one's slide long over)
  week.classList.remove("wk-in-r", "wk-in-l"); reduce = false;
  fns.setWeekOff(0); if (fns.calState().open) toggle.fire("click", {});
  app.reset(); app.set({ signedIn: true, clientMode, myClientId: clientMode ? "c1" : null, tab: "workouts" });
  maps.clients.set("c1", { id: "c1", name: "Jane", unit: "lb" });
  for (const t of [
    W("a", "Push day", 2),                                             // Friday 13: this week, one that day
    W("b", "Legs", 7), W("c", "Pull", 7),                              // Wednesday 18: next week, two that day (the taller week)
    W("p", "Done", -7, { completedAt: new Date(Date.now() - 7 * 86400000).toISOString() }),   // Wednesday 4: last week, finished
    W("x1", "Run", 14), W("x2", "Swim", 14), W("x3", "Bike", 14),     // Wednesday 25: three that day, the week after next the tallest
  ]) maps.trainings.set(t.id, t);
  app.set({ view: { name: "client", id: "c1" } }); fns.render();
  heights = [];
}
const days = (w) => (w.children || []).map((b) => (b.dataset && b.dataset.day ? b.dataset.day.slice(8) : "?")).join(" ");
const tr = () => track.style.transform || "";
const trX = () => { const m = /calc\(-100% \+ ([-\d.e]+)px\)/.exec(tr()); return m ? Number(m[1]) : (tr() === "" || tr() === "translateX(-100%)" ? 0 : tr()); };
const wed = () => week.children[2];                                     // today's day (Wednesday 11), no workout on it: the finger's place
const wx = () => { const r = rectOf(wed()); return Math.round(r.left + r.width / 2); };
const Y = 260;
const chipOf = (tid) => { for (const b of week.children) for (const evs of b.children || []) if (cls(evs, "day-evs")) for (const c of evs.children || []) if (c.dataset && c.dataset.tid === tid) return c; return null; };
const mid = (e) => { const r = e.getBoundingClientRect(); return [Math.round(r.left + r.width / 2), Math.round(r.top + r.height / 2)]; };
const preview = () => (fns.previewState() || {}).id || null;
const closePv = async () => { if (fns.closePreview) fns.closePreview(); await advance(400); };
const state = () => ({ weekOff: fns.weekOffNow(), days: days(week), head: byId.get("weekHead").textContent, today: !todayBtn.hidden, tr: tr(), height: viewH, prev: prevW.children.length, next: nextW.children.length });
const out = {};

// 1. a finger slides the strip to the next week: nothing for its first 8 points; then the weeks either side are drawn and the strip follows the
// finger, its height easing toward the week coming in; let go past 48 points, the next week slides in (the month's name and Today at once),
// the click that follows the release goes nowhere, and once it lands the strip is that week's, drawn anew
await seed();
{ const x = wx(); down(wed(), x, Y); move(x - 5);
  const early = { tr: tr(), prev: prevW.children.length, next: nextW.children.length, dragged: view.classList.contains("dragged") };
  move(x - 20);
  const taken = { tr: tr(), prevDays: days(prevW), nextDays: days(nextW), sideTab: nextW.children[0] ? nextW.children[0].tabIndex : null, sideClicks: nextW.children[0] ? nextW.children[0].listening("click") : null, liveClicks: wed().listening("click"), dragged: view.classList.contains("dragged"), height: viewH };
  move(x - 185); const half = { tr: tr(), height: viewH };
  up(); const clk = click(wed());
  const letGo = { tr: tr(), transition: track.style.transition || "", height: viewH, viewTransition: view.style.transition || "", head: byId.get("weekHead").textContent, today: !todayBtn.hidden, weekOff: fns.weekOffNow(), clickEaten: !!clk.halted, preview: preview() };
  await advance(400); const landed = state(); landed.transition = track.style.transition || "";
  const c = chipOf("b"); const tap = click(c); const after = { preview: preview(), eaten: !!tap.halted }; await closePv();
  out.finger = { early, taken, half, letGo, landed, after };
}
// 2. let go short of 48 points: back where it was
await seed();
{ const x = wx(); down(wed(), x, Y); move(x - 20); move(x - 40); up(); const letGo = { tr: tr(), today: !todayBtn.hidden };
  await advance(400); out.short = { letGo, after: state() };
}
// 3. up or down first: the page's scroll; the weeks stay where they are for the rest of that press
await seed();
{ const x = wx(); down(wed(), x, Y); move(x - 3, Y + 12); move(x - 60, Y + 20); const mid_ = { tr: tr(), prev: prevW.children.length, dragged: view.classList.contains("dragged") };
  up(); await advance(400); out.vertical = { mid: mid_, after: state() };
}
// 4. the weeks before: the month's name follows (Oct – Nov at once as the week sets off); Today comes back to this week, slid from the week
// next to it, or coming in from the side it is on
await seed();
{ const x = wx(); const swipe = async (dx) => { down(wed(), x, Y); move(x + Math.sign(dx) * 20); move(x + dx); up(); const atOnce = { head: byId.get("weekHead").textContent, today: !todayBtn.hidden }; await advance(400); return atOnce; };
  await swipe(100); const last = state();
  const atOnce = await swipe(100); const twoBack = state();
  todayBtn.fire("click", {}); const fromTwo = { ...state(), slide: week.classList.contains("wk-in-r") ? "r" : week.classList.contains("wk-in-l") ? "l" : "" };
  await advance(400);
  await swipe(-100); heights = []; const next = state();
  todayBtn.fire("click", {}); const fromOne = { tr: tr(), head: byId.get("weekHead").textContent, today: !todayBtn.hidden, weekOff: fns.weekOffNow() };
  await advance(400); fromOne.after = state(); fromOne.heights = heights.slice();
  out.weeks = { last, atOnce, twoBack, fromTwo, next, fromOne };
}
// 5. Month on another week opens that week's month (its Thursday's); Week again: the strip still on that week; Today hides while the month is up
await seed();
{ const r = {};
  for (const off of [3, 2, -2, 0]) { fns.setWeekOff(off); fns.render(); const head = byId.get("weekHead").textContent, today = !todayBtn.hidden; toggle.fire("click", {}); const m = { month: fns.calState().month, todayHidden: todayBtn.hidden }; toggle.fire("click", {}); r[off] = { head, today, ...m, back: state() }; }
  out.month = r;
}
// 6. the page left (calFold, as every way out runs it): this week again, drawn at once
await seed();
{ fns.setWeekOff(2); fns.render(); const before = state(); fns.calFold(); out.fold = { before, after: state() }; }
// 7. a sync's redraw while the finger holds the weeks: the strip stays as it is under the finger (the same buttons), and is drawn anew as it lands
await seed();
{ const x = wx(); down(wed(), x, Y); move(x - 20); const kids = [...week.children];
  maps.trainings.get("a").title = "Push 2"; const { ui } = await import("../app/state.js"); ui.render(); await advance(20);
  const held = { same: week.children.length === kids.length && week.children.every((b, i) => b === kids[i]), tr: tr() };
  move(x - 30); up(); await advance(400);
  const c = chipOf("a"); out.redraw = { held, after: { redrawn: week.children[0] !== kids[0], title: c ? c.children[0].textContent : null, weekOff: fns.weekOffNow() } };
}
// 8. a workout held on the strip is the drag's: sideways it moves the workout, never the weeks
await seed();
{ const c = chipOf("a"), [x, y] = mid(c); down(c, x, y); await advance(410); const lifted = fns.calDragState().lifted;
  await glide(x - 60, y, 4); const during = { tr: tr(), prev: prevW.children.length };
  up(); await advance(400); out.held = { lifted, during, weekOff: fns.weekOffNow(), date: maps.trainings.get("a").date };
}
// 8b. a drag called off with the finger still down (Escape on a Mac, a second finger): the rest of that press is no swipe of the weeks either;
// and a workout pressed while two fingers hold the weeks never lifts
for (const how of ["escape", "second"]) {
  await seed();
  const c = chipOf("a"), [x, y] = mid(c); down(c, x, y); await advance(410); await glide(x + 20, y, 2);
  if (how === "escape") { const k = { key: "Escape", preventDefault() {}, stopImmediatePropagation() { k.stopped = true; } }; for (const l of (L.keydown || []).filter((q) => q.capture)) { l.fn(k); if (k.stopped) break; } }
  else dispatch("touchstart", cur.target, { touches: [T(cur.x, cur.y, cur.id), T(cur.x + 40, cur.y, cur.id + 100)], changedTouches: [T(cur.x + 40, cur.y, cur.id + 100)] });
  await advance(50); const off = fns.calDragState().on;
  await glide(x - 100, y, 5); const during = { tr: tr(), prev: prevW.children.length };
  up(); await advance(400);
  (out.calledOff ||= {})[how] = { off: !off, during, weekOff: fns.weekOffNow(), date: maps.trainings.get("a").date };
}
await seed();
{ const w = fns.weekWheelNow(), began = w.begin(); const c = chipOf("a"), [x, y] = mid(c); down(c, x, y, "mouse"); await advance(450);
  out.wheelLift = { began, lifted: fns.calDragState().lifted }; up(); w.end(); await advance(400); out.wheelLift.weekOff = fns.weekOffNow(); }
// 9. a tap on a workout still opens its preview; a press as the weeks land lands them at once
await seed();
{ const c = chipOf("a"), [x, y] = mid(c); down(c, x, y); await advance(80); up(); const tap = click(c); out.tap = { preview: preview(), eaten: !!tap.halted }; await closePv(); }
await seed();
{ const x = wx(); down(wed(), x, Y); move(x - 20); move(x - 100); up(); await advance(100); const midway = fns.weekOffNow();
  down(wed(), x, Y); const caught = { weekOff: fns.weekOffNow(), tr: tr(), days: days(week) }; up(); await advance(400);
  out.caught = { midway, caught };
}
// 10. a Mac's mouse drags the weeks as a finger does (no "dragged" grey to let go of); a right press slides nothing
await seed();
{ const x = wx(); down(wed(), x, Y, "mouse"); move(x - 20); move(x - 100); const dragged = view.classList.contains("dragged"); up(); await advance(400); const left = fns.weekOffNow();
  down(wed(), x, Y, "mouse", { button: 2 }); move(x - 20); move(x - 100); const right = tr(); up(); await advance(400);
  out.mouse = { dragged, left, right, after: fns.weekOffNow() };
}
// 11. two fingers on a Mac's trackpad: a week at most; short of 48 points back; to the right the week before; up and down nothing; under a menu,
// with a finger already on the strip, or over a workout held: nothing
const wheelRun = async (deltas, sign = 1, setup) => { await seed(); if (setup) await setup(); const p = await play(deltas, wed(), sign); await advance(600); return { weekOff: fns.weekOffNow(), ...p, rest: tr() }; };
out.wheel = {
  next: await wheelRun(steady(60)), short: await wheelRun(steady(40)), back: await wheelRun(steady(60), -1), flick: await wheelRun([...FINGERS, ...COAST]),
  vertical: await wheelRun(Array.from({ length: 12 }, () => [0, 5])),
  underMenu: await wheelRun(steady(60), 1, () => { byId.get("whenBg").hidden = false; }),
};
byId.get("whenBg").hidden = true;
out.wheel.fingerOn = await wheelRun(steady(60), 1, () => { down(wed(), wx(), Y); });
up(); await advance(400);
out.wheel.held = await wheelRun(steady(60), 1, async () => { const c = chipOf("a"), [x, y] = mid(c); down(c, x, y); await advance(410); });
up(); await advance(400);
// 12. Reduce Motion: let go, the week is there at once, with no slide
await seed();
{ reduce = true; const x = wx(); down(wed(), x, Y); move(x - 20); move(x - 100); up(); out.calm = { weekOff: fns.weekOffNow(), tr: tr(), transition: track.style.transition || "", days: days(week) }; reduce = false; }
// 13. the client gone, or the page left, while the weeks slide: nothing throws; a page left keeps this week
await seed();
{ const x = wx(); down(wed(), x, Y); move(x - 20); move(x - 100); up(); maps.clients.delete("c1"); let threw = null;
  try { await advance(400); } catch (e) { threw = String((e && e.message) || e); }
  out.gone = { threw };
}
await seed();
{ const x = wx(); down(wed(), x, Y); move(x - 20); move(x - 100); up(); app.set({ view: { name: "clients" } }); await advance(400);
  const left = fns.weekOffNow(); app.set({ view: { name: "client", id: "c1" } }); fns.render(); out.leftMidway = { left, back: state() };
}
// 15. (the v285 review) planning a workout on another week: a day tapped, + Workout, the round +: the new workout opens (calFold draws the
// strip alone: a whole redraw swept the brand-new empty workout away and dropped the coach on Clients)
{ const r = {};
  for (const how of ["day", "button", "plus"]) {
    await seed(); const x = wx(); down(wed(), x, Y); move(x - 20); move(x - 100); up(); await advance(400);
    const before = fns.weekOffNow(), n0 = maps.trainings.size;
    if (how === "day") click(week.children[0]); else if (how === "button") byId.get("newTraining").fire("click", {}); else fns.newWorkoutHere();
    await advance(50); const v = app.get().view;
    r[how] = { before, view: v.name, made: maps.trainings.size - n0, open: v.name === "training" && maps.trainings.has(v.id), date: v.name === "training" && maps.trainings.get(v.id) ? maps.trainings.get(v.id).date : null, weekOff: fns.weekOffNow(), days: days(week) };
    app.set({ view: { name: "client", id: "c1" } }); fns.render();
  }
  out.plan = r;
}
// 15b. + Workout or the round + tapped while a week still slides in (60 ms after letting go): the slide lands quietly as the page is left, and
// the new workout opens (a landing's whole redraw there would sweep it away)
{ const r = {};
  for (const how of ["button", "plus"]) {
    await seed(); const x = wx(); down(wed(), x, Y); move(x - 20); move(x - 100); up(); await advance(60);
    const n0 = maps.trainings.size; if (how === "button") byId.get("newTraining").fire("click", {}); else fns.newWorkoutHere();
    await advance(50); const v = app.get().view;
    r[how] = { view: v.name, made: maps.trainings.size - n0, open: v.name === "training" && maps.trainings.has(v.id), weekOff: fns.weekOffNow(), days: days(week) };
    app.set({ view: { name: "client", id: "c1" } }); fns.render();
  }
  out.planMid = r;
}
// 16. Month or Today tapped while a week still slides in: it lands first (Month opens on the month of the week coming in; Today takes it back);
// a sync's redraw meanwhile leaves Today as the slide set it
await seed();
{ fns.setWeekOff(2); fns.render(); const x = wx(); down(wed(), x, Y); move(x - 20); move(x - 100); up(); await advance(100);
  const head = byId.get("weekHead").textContent; toggle.fire("click", {}); const opened = fns.calState().month; await advance(400);
  out.monthMid = { head, opened, landed: { month: fns.calState().month, weekOff: fns.weekOffNow() } }; toggle.fire("click", {}); await advance(50);
}
await seed();
{ const x = wx(); down(wed(), x, Y); move(x - 20); move(x - 100); up(); await advance(60); todayBtn.fire("click", {}); await advance(400);
  out.todayMid = { weekOff: fns.weekOffNow(), days: days(week), today: !todayBtn.hidden };
}
await seed();
{ const x = wx(); down(wed(), x, Y); move(x - 20); move(x - 100); up(); const atOnce = !todayBtn.hidden; await advance(100);
  const { ui } = await import("../app/state.js"); ui.render(); const during = !todayBtn.hidden; await advance(400);
  out.redrawMid = { atOnce, during, landed: !todayBtn.hidden, weekOff: fns.weekOffNow() };
}
// 17. a second finger lifted on the strip is no release of the first one's slide
await seed();
{ const x = wx(); down(wed(), x, Y); move(x - 20); move(x - 30); const sat = week.children[5], r5 = rectOf(sat);
  const two = (type) => dispatch(type, sat, { pointerType: "touch", pointerId: 990, isPrimary: false, button: 0, buttons: type === "pointerup" ? 0 : 1, clientX: Math.round(r5.left + 20), clientY: Y });
  two("pointerdown"); two("pointerup"); const kept = tr(), dragged = view.classList.contains("dragged"); move(x - 120); const on = tr(); up(); await advance(400);
  out.second = { kept, dragged, on, weekOff: fns.weekOffNow() };
}
// 17b. ... nor is a second finger the browser cancels
await seed();
{ const x = wx(); down(wed(), x, Y); move(x - 20); move(x - 30); const sat = week.children[5], r5 = rectOf(sat);
  dispatch("pointerdown", sat, { pointerType: "touch", pointerId: 990, isPrimary: false, button: 0, buttons: 1, clientX: Math.round(r5.left + 20), clientY: Y });
  dispatch("pointercancel", sat, { pointerType: "touch", pointerId: 990, isPrimary: false, button: 0, buttons: 0, clientX: Math.round(r5.left + 20), clientY: Y });
  const kept = tr(); move(x - 120); const on = tr(); up(); await advance(400);
  out.secondCancel = { kept, on, weekOff: fns.weekOffNow() };
}
// 17c. two fingers carry the strip a whole week (a firm flick): it lands at once (nothing left to move, nothing to wait for), and a click on a
// workout there opens it
await seed();
{ const p = await play(steady(400, 10), wed()); await advance(100); const landed = { weekOff: fns.weekOffNow(), tr: tr(), days: days(week) };
  const c = chipOf("b"); const tap = c ? click(c) : null; out.wholeWeek = { most: p.most, landed, preview: preview(), eaten: !!(tap && tap.halted) }; await closePv();
}
// 18. a day's own fade ending under the slide (a bubbling transitionend) is not the slide's end; the track's own transform's is
await seed();
{ const x = wx(); down(wed(), x, Y); move(x - 20); move(x - 100); up(); await advance(60);
  dispatch("transitionend", week.children[3], { propertyName: "background-color" }); const fade = { tr: tr(), weekOff: fns.weekOffNow() };
  dispatch("transitionend", track, { propertyName: "transform" }); out.bubble = { fade, own: { tr: tr(), weekOff: fns.weekOffNow() } };
}
// 19. a Mac's release lost (the button up, no pointerup): the weeks no longer follow the bare pointer, and 150 ms later go back where they
// were; a new press on a press that never ended lets the old one go first, and the strip is drawn by every redraw again
await seed();
{ const x = wx(); down(wed(), x, Y, "mouse"); move(x - 20); move(x - 100); const held = tr();
  ptr("pointermove", x - 140, Y, "mouse", { buttons: 0 }); const bare = tr(); await advance(200); const back = { tr: tr(), transition: track.style.transition || "" }; await advance(400);
  out.lost = { held, bare, back, after: { weekOff: fns.weekOffNow(), tr: tr() } };
}
await seed();
{ const x = wx(); down(wed(), x, Y, "mouse"); move(x - 20); move(x - 100);
  down(wed(), x, Y, "mouse"); const fresh = { tr: tr(), weekOff: fns.weekOffNow() }; up(); await advance(400);
  maps.trainings.get("a").title = "Push 3"; const { ui } = await import("../app/state.js"); ui.render(); const c = chipOf("a");
  out.lostPress = { fresh, title: c ? c.children[0].textContent : null };
}
// 19b. another tab, or the page left, while a week still slides in: it lands first, then this week (not the week it was sliding to)
await seed();
{ const x = wx(); down(wed(), x, Y); move(x - 20); move(x - 100); up(); await advance(60);
  app.set({ tab: "progress" }); fns.render(); const away = fns.weekOffNow(); await advance(400); app.set({ tab: "workouts" }); fns.render();
  out.tabMid = { away, back: state() };
}
await seed();
{ const x = wx(); down(wed(), x, Y); move(x - 20); move(x - 100); up(); await advance(60); fns.calFold(); const folded = state(); await advance(400);
  out.foldMid = { folded, after: fns.weekOffNow() };
}
// 19c. a Mac's release lost, then a new drag within the 150 ms: the old press is let go at the new press, its timer with it, and the new drag pages
await seed();
{ const x = wx(); down(wed(), x, Y, "mouse"); move(x - 20); move(x - 100); ptr("pointermove", x - 120, Y, "mouse", { buttons: 0 }); await advance(40);
  down(wed(), x, Y, "mouse"); const t = wed(); const m2 = (px) => dispatch("pointermove", t, { pointerType: "mouse", pointerId: 1, isPrimary: true, button: 0, buttons: 1, clientX: px, clientY: Y });
  m2(x - 20); await advance(40); m2(x - 60); await advance(40); m2(x - 90); await advance(60); const mid = tr();
  dispatch("pointerup", t, { pointerType: "mouse", pointerId: 1, isPrimary: true, button: 0, buttons: 0, clientX: x - 90, clientY: Y }); await advance(400);
  out.lostAgain = { mid, weekOff: fns.weekOffNow() };
}
// 20. the client gone (deleted on another device) while another week shows: leaving the page throws nothing
await seed();
{ fns.setWeekOff(1); fns.render(); maps.clients.delete("c1"); let threw = null; try { fns.calFold(); } catch (e) { threw = String((e && e.message) || e); }
  out.goneFold = { threw, weekOff: fns.weekOffNow() };
}
// 14. the page's own pieces: the weeks either side are a picture only (no keyboard place, nothing to tap), the strip keeps the finger from the
// swipe back and from two fingers' swipe back, and the hooks the test reads
{ const w = fns.weekWheelNow(); out.wired = { twoFingers: !!w && ["begin", "move", "end"].every((k) => typeof w[k] === "function"), page: typeof fns.weekPageNow() === "function" }; }
// 21. a new week begun under a week paged to (the page left open from Sunday to Monday): the week shown stays that week; this week shown stays
// this week (the last scene: the clock moves on for good)
{ await seed(); fns.setWeekOff(1); fns.render(); const before = state(); NOW += 5 * 86400000; await flush(); const still = days(week); fns.render();
  out.rollover = { before: [before.weekOff, before.days], still, after: [fns.weekOffNow(), days(week), !todayBtn.hidden] };
  fns.setWeekOff(1); fns.render(); out.rollover.next = [fns.weekOffNow(), days(week), !todayBtn.hidden];
  NOW += 7 * 86400000; await flush(); fns.render(); out.rollover.later = [fns.weekOffNow(), days(week), !todayBtn.hidden];
  // (now Monday 23 Nov) Today on a week paged to that a new week has made this one: drawn anew, today on it, no Today
  await seed(); fns.setWeekOff(1); fns.render(); NOW += 7 * 86400000; await flush(); const staleT = [days(week), !todayBtn.hidden];
  todayBtn.fire("click", {}); await advance(50); const mon = week.children.find((b) => b.classList.contains("today"));
  out.rollover.today = { stale: staleT, after: [fns.weekOffNow(), days(week), !todayBtn.hidden], marked: mon ? mon.dataset.day : null };
  // (now Monday 30 Nov) this week left up across Sunday's midnight, then a swipe from what it shows: the week after it, which is this week now
  await seed(); NOW += 7 * 86400000; await flush(); const staleS = days(week);
  { const x = wx(); down(wed(), x, Y); move(x - 20); const taken = [days(prevW), days(nextW)]; move(x - 100); up(); await advance(400);
    out.rollover.swipe = { stale: staleS, taken, after: [fns.weekOffNow(), days(week), !todayBtn.hidden] }; }
  // (now Monday 7 Dec) paged three weeks on, three weeks go by: Month opens this month (the week shown is this one now)
  await seed(); fns.setWeekOff(3); fns.render(); const staleM = days(week); NOW += 21 * 86400000; await flush();
  toggle.fire("click", {}); out.rollover.month = { stale: staleM, month: fns.calState().month, today: fns.today().slice(0, 7) }; toggle.fire("click", {});
  // (now Monday 28 Dec) this week left up across Sunday's midnight, then a sync's redraw: this week, the new one (today on it, no Today)
  await seed(); NOW += 7 * 86400000; await flush(); const staleI = days(week); fns.render(); const mi = week.children.find((b) => b.classList.contains("today"));
  out.rollover.idle = { stale: staleI, after: [fns.weekOffNow(), days(week), !todayBtn.hidden], marked: mi ? mi.dataset.day : null };
}
console.log(JSON.stringify(out));
process.exit(0);
