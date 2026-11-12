// Run by cal-drag.test.js in its own process: a workout held and dragged to another day in the client page's week strip and month (his
// ask, 11 Nov). This loads the real app/main.js on its own clock and on a fixed day (Wednesday 11 November 2026, 10 am: the strip is
// Monday 9 to Sunday 15, and November starts on a Sunday), with page elements that keep their children, their parents and their own
// listeners and know where they are on the screen (the strip 16 to 386 across, 203 to 319 down; the month's days 88 tall from 268), plays
// fingers and a Mac's mouse on them as WebKit sends them (the document's capture listeners, the element and its parents, the document's
// bubbling ones; a touch whose element was taken out of the page reaches only that element), and prints, as JSON, what each did.
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
document.addEventListener = (t, fn, o) => { (L[t] ||= []).push({ fn, capture: o === true || !!(o && o.capture), passive: passiveOf(t, o) }); };
document.removeEventListener = (t, fn) => { const a = L[t] || []; const i = a.findIndex((x) => x.fn === fn); if (i >= 0) a.splice(i, 1); };
globalThis.addEventListener = (t, fn) => { (WL[t] ||= []).push(fn); };
globalThis.removeEventListener = (t, fn) => { const a = WL[t] || []; const i = a.indexOf(fn); if (i >= 0) a.splice(i, 1); };
const qs = document.querySelector; document.querySelector = (s) => (/sheet-bg|crop-view|header \.bar/.test(s) ? null : qs(s));
document.contains = (x) => !!x;
document.documentElement.clientWidth = 402; globalThis.innerHeight = 812; globalThis.innerWidth = 402;
let ticks = 0; navigator.vibrate = () => { ticks++; return true; };   // the lift's tick (Android's; the iPhone's switch is a no-op here)
// page elements: children with their parents, a place on the screen, their own listeners (that a signal can take away), in the page or not
const ROOTS = new Set();
const cls = (e, c) => typeof (e && e.className) === "string" && (" " + e.className + " ").includes(" " + c + " ");
function adopt(p, c) { if (!c || typeof c !== "object") return; if (c.parentElement && c.parentElement !== p && c.parentElement.children) c.parentElement.children = c.parentElement.children.filter((x) => x !== c); c.parentElement = p; }
function mk(tag) {
  const e = el(tag), H = [];
  e.children = []; e.parentElement = null;
  e.appendChild = (c) => { adopt(e, c); e.children = [...e.children.filter((x) => x !== c), c]; return c; };
  e.append = (...k) => { for (const c of k) e.appendChild(c); };
  e.replaceChildren = (...k) => { for (const c of e.children) if (c && c.parentElement === e) c.parentElement = null; e.children = []; for (const c of k) e.appendChild(c); };
  e.remove = () => { const p = e.parentElement; if (p) { p.children = p.children.filter((x) => x !== e); e.parentElement = null; } e.removed = true; };
  e.addEventListener = (t, fn, o) => { H.push({ t, fn, o }); };
  e.removeEventListener = (t, fn) => { const i = H.findIndex((h) => h.t === t && h.fn === fn); if (i >= 0) H.splice(i, 1); };
  e.fire = (t, ev) => { for (const h of [...H]) if (h.t === t && !(h.o && h.o.signal && h.o.signal.aborted)) { ev.__passive = !!(h.o && typeof h.o === "object" && h.o.passive); h.fn(ev); ev.__passive = false; if (ev.stoppedAll) return; } };
  e.listening = (t) => H.filter((h) => h.t === t && !(h.o && h.o.signal && h.o.signal.aborted)).length;
  e.setAttribute = (k, v) => { e["@" + k] = String(v); }; e.getAttribute = (k) => (e["@" + k] === undefined ? null : e["@" + k]);
  e.getBoundingClientRect = () => rectOf(e);
  e.querySelector = () => el(); e.querySelectorAll = () => [];   // (as the stand-in's own: a stub, never null)
  Object.defineProperty(e, "isConnected", { get: () => { for (let n = e, i = 0; n && i < 60; n = n.parentElement, i++) if (ROOTS.has(n)) return true; return false; }, configurable: true });
  return e;
}
const root = (id, extra = {}) => { const e = mk("div"); e.id = id; Object.assign(e, extra); byId.set(id, e); ROOTS.add(e); return e; };
for (const id of ["calTitle", "calToday", "calPrev", "calNext", "calWrap", "weekHead", "calToggleText", "dayMore", "pickSheet", "pickList", "pickNo", "pickTitle", "pvGo", "vHistory", "histList"]) root(id);
const week = root("week", { clientWidth: 370 }), calView = root("calView", { clientWidth: 370 }), calTrack = root("calTrack"), toggle = root("calToggle");
calView.appendChild(calTrack);                                       // (the month's pointer listeners are on its view: a press on a chip reaches them)
root("whenBg", { hidden: true }); byId.get("vHistory").hidden = true;
const body = mk("body"); ROOTS.add(body); Object.defineProperty(document, "body", { value: body, configurable: true });
document.createElement = (t) => mk(t);
document.getElementById = (id) => { if (!byId.has(id)) { const e = mk("div"); byId.set(id, e); } return byId.get(id); };
// where things are: the strip and the month as on a 402-point phone
const box = (l, t, w, h) => ({ left: l, top: t, width: w, height: h, right: l + w, bottom: t + h, x: l, y: t });
const WEEK = { left: 16, top: 203, width: 370, height: 116 }, VIEW = { left: 16, top: 268, width: 370, rowH: 88 };
function rectOf(e) {
  if (e === week) return box(WEEK.left, WEEK.top, WEEK.width, WEEK.height);
  if (e === calView) return box(VIEW.left, VIEW.top, VIEW.width, 6 * VIEW.rowH);
  const p = e.parentElement;
  if (e.tagName === "BUTTON" && p === week) { const i = week.children.indexOf(e), sl = week.classList.contains("wk-in-r") ? 0.3 : week.classList.contains("wk-in-l") ? -0.3 : 0; return box(WEEK.left + i * WEEK.width / 7 + sl * WEEK.width, WEEK.top, WEEK.width / 7, WEEK.height); }   // (a week sliding in sits a third aside, as the animation begins)
  if (e.tagName === "BUTTON" && p && p.className === "cal") { const panel = p.parentElement, i = p.children.indexOf(e), off = (calTrack.children.indexOf(panel) - 1) * VIEW.width; return box(VIEW.left + off + (i % 7) * VIEW.width / 7, VIEW.top + Math.floor(i / 7) * VIEW.rowH, VIEW.width / 7, VIEW.rowH); }
  if (cls(e, "day-ev")) { const evs = p, day = evs && evs.parentElement, d = day ? rectOf(day) : box(0, 0, 0, 0), k = evs ? evs.children.indexOf(e) : 0; return box(d.left + 2, d.top + 50 + k * 19, d.width - 4, 16); }
  if (cls(e, "day-ev-t")) return p ? rectOf(p) : box(0, 0, 0, 0);
  return box(0, 0, 0, 0);
}
// events as WebKit sends them
function dispatch(type, target, ev = {}) {
  let passive = false; ev.type = type; ev.target = target; ev.defaultPrevented = false; ev.stoppedAll = false;
  ev.preventDefault = () => { if (!passive && !ev.__passive) ev.defaultPrevented = true; }; ev.stopPropagation = () => { ev.halted = true; }; ev.stopImmediatePropagation = () => { ev.halted = ev.stoppedAll = true; };
  if (ev.cancelable === undefined) ev.cancelable = true;
  if (target && target.isConnected === false) { target.fire(type, ev); return ev; }   // taken out of the page: only it hears its touch
  const ls = L[type] || [];
  for (const l of ls.filter((x) => x.capture)) { if (ev.stoppedAll) return ev; passive = l.passive; l.fn(ev); passive = false; }
  for (let n = target, i = 0; n && i < 60 && !ev.halted; n = n.parentElement, i++) if (typeof n.fire === "function") n.fire(type, ev);
  if (!ev.halted) for (const l of ls.filter((x) => !x.capture)) { if (ev.stoppedAll) return ev; passive = l.passive; l.fn(ev); passive = false; }
  return ev;
}
let TID = 0, cur = null;
const T = (x, y, id) => ({ identifier: id, clientX: x, clientY: y });
const ptr = (type, x, y) => dispatch(type, cur.target, { pointerType: "touch", pointerId: 900 + cur.id, isPrimary: true, button: 0, buttons: type === "pointerup" ? 0 : 1, clientX: x, clientY: y });   // a finger's pointer events come first, as WebKit sends them
const down = (target, x, y) => { cur = { id: ++TID, target, x, y }; ptr("pointerdown", x, y); return dispatch("touchstart", target, { touches: [T(x, y, cur.id)], changedTouches: [T(x, y, cur.id)] }); };
const move = (x, y) => { cur.x = x; cur.y = y; ptr("pointermove", x, y); return dispatch("touchmove", cur.target, { touches: [T(x, y, cur.id)], changedTouches: [T(x, y, cur.id)] }); };
const up = (type = "touchend") => { ptr(type === "touchend" ? "pointerup" : "pointercancel", cur.x, cur.y); return dispatch(type, cur.target, { touches: [], changedTouches: [T(cur.x, cur.y, cur.id)], cancelable: type === "touchend" }); };
const second = () => dispatch("touchstart", cur.target, { touches: [T(cur.x, cur.y, cur.id), T(cur.x + 40, cur.y, cur.id + 100)], changedTouches: [T(cur.x + 40, cur.y, cur.id + 100)] });
const mouse = (type, target, x, y, extra = {}) => dispatch(type, target, { pointerType: "mouse", pointerId: 1, isPrimary: true, button: 0, buttons: type === "pointerup" ? 0 : 1, clientX: x, clientY: y, ...extra });
const click = (target) => dispatch("click", target, { detail: 1 });
const glide = async (x0, y0, x1, y1, steps = 6) => { for (let i = 1; i <= steps; i++) { move(Math.round(x0 + (x1 - x0) * i / steps), Math.round(y0 + (y1 - y0) * i / steps)); await advance(16); } };
// the app on a client's page, with workouts in every state
globalThis.addEventListener = (t, fn) => { (WL[t] ||= []).push(fn); };
const app = (await import("../app/main.js")).internals();
const { fns, maps } = app;
const iso = (d) => fns.localIso(d), day = (n) => { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + n); return iso(d); };
const W = (id, title, n, extra = {}) => ({ id, clientId: "c1", title, date: day(n), createdAt: "2026-11-01T0" + (TID++ % 9) + ":00:00.000Z", completedAt: null, skippedAt: null, rows: [{ id: "r" + id, name: "Squat", sets: "3", reps: "10" }], ...extra });
function seed(clientMode = false) {
  week.classList.remove("wk-in-r", "wk-in-l");   // (each scene on a settled page: the last one's slide, 260 ms, long over)
  app.reset(); app.set({ signedIn: true, clientMode, myClientId: clientMode ? "c1" : null, tab: "workouts" });
  maps.clients.set("c1", { id: "c1", name: "Jane", unit: "lb" });
  for (const t of [
    W("a", "Push day", 2),                                           // Friday 13: still to do
    W("m", "Legs", -2),                                              // Monday 9: missed two days ago (inside its week)
    W("d", "Done", -1, { completedAt: new Date(Date.now() - 86400000).toISOString() }),   // Tuesday 10: finished
    W("o", "Old", -9, { missed: false }),                            // Monday 2: missed nine days ago, brought back: past its week
  ]) maps.trainings.set(t.id, t);
  app.set({ view: { name: "client", id: "c1" } }); fns.render();
}
const grid = () => (fns.calState().open ? (calTrack.children[1] && calTrack.children[1].children[0]) : week);
const dayOf = (key) => (grid() ? grid().children.find((b) => b.dataset && b.dataset.day === key) : null);
const chipOf = (tid) => { for (const b of (grid() || {}).children || []) for (const evs of b.children || []) if (cls(evs, "day-evs")) for (const c of evs.children || []) if (c.dataset && c.dataset.tid === tid) return c; return null; };
const mid = (e) => { const r = e.getBoundingClientRect(); return [Math.round(r.left + r.width / 2), Math.round(r.top + r.height / 2)]; };
const ghost = () => body.children.find((c) => c.id === "calDrag") || null;
const st = () => fns.calDragState();
const lit = () => ((grid() || {}).children || []).filter((b) => b.classList && b.classList.contains("drop-on")).map((b) => b.dataset.day);
const past = () => ((grid() || {}).children || []).filter((b) => b.classList && b.classList.contains("past")).map((b) => b.dataset.day);
const preview = () => (fns.previewState() || {}).id || null;
const out = {};

// 1. the strip, the coach's view: held 0.4 s, the copy lifts (nothing before), the days gone by grey, the day under it filled; dragged a day on, let go: moved there; its release clicks nothing
seed();
{ const chip = chipOf("a"), [x, y] = mid(chip); const t = chip.children[0];
  down(t, x, y); await advance(390); const early = { lifted: st().lifted, ghost: !!ghost(), body: body.classList.contains("cal-drag") };
  const pre = move(x + 2, y).defaultPrevented; move(x, y); await advance(20); const g = ghost();   // (a nudge before the lift, and back)
  const lift = { lifted: st().lifted, ghost: !!g, cls: g ? g.className : "", words: g ? g.children[0].textContent : "", width: g ? g.style.width : "", body: body.classList.contains("cal-drag"), lit: lit(), past: past(), ticks, transform: g ? g.style.transform : "" };
  const held = move(x + 4, y).defaultPrevented; await advance(16);
  await glide(x, y, x + 53, y); const over = { lit: lit(), key: st().key, transform: g ? g.style.transform : "", pre, held };
  const t0 = ticks; const end = up(); const landTicks = ticks - t0; const clk = click(dayOf(day(3)));   // (the click iOS sends at the release lands on what is under the finger: the day it moved to)
  out.strip = { early, lift, over, landTicks, upPrevented: end.defaultPrevented, clickEaten: !!clk.stoppedAll, date: maps.trainings.get("a").date, preview: preview(), dirty: maps.dirty.has("trainings/a") || [...maps.dirty.keys()].some((k) => /a$/.test(k)), coachDate: (maps.trainerState.get("a") || new Set()).has ? maps.trainerState.get("a").has("date") : !!(maps.trainerState.get("a") || {}).date };
  await advance(300); out.strip.after = { ghost: !!ghost(), body: body.classList.contains("cal-drag"), lit: lit(), on: st().on, chipDay: (chipOf("a") && chipOf("a").parentElement.parentElement.dataset.day) || null };
}
// 2. held and let go where it was: it settles back, nothing moves and nothing opens (his pick); a tap still opens the preview
seed();
{ const chip = chipOf("a"), [x, y] = mid(chip);
  down(chip, x, y); await advance(450); const lifted = st().lifted; const t0 = ticks; up(); const clk = click(chip); await advance(300);
  out.inPlace = { ticked: ticks !== t0, lifted, date: maps.trainings.get("a").date, preview: preview(), clickEaten: !!clk.stoppedAll, ghost: !!ghost() };
  const c2 = chipOf("a"), [x2, y2] = mid(c2); down(c2, x2, y2); await advance(120); up(); const tap = click(c2); await advance(50);
  out.tap = { lifted: st().lifted, preview: preview(), eaten: !!tap.stoppedAll };
  fns.closePreview && fns.closePreview(); await advance(400);
}
// 3. a day gone by takes nothing: no fill over it, and let go there it settles back
seed();
{ const chip = chipOf("a"), [x, y] = mid(chip), [px] = mid(dayOf(day(-1)));
  down(chip, x, y); await advance(410); await glide(x, y, px, y); const over = { lit: lit(), key: st().key };
  const t0 = ticks; up(); await advance(300); out.pastDay = { over, ticked: ticks !== t0, date: maps.trainings.get("a").date };
}
// 4. a finger that wanders 8 points before the lift is a scroll or the months' slide: nothing lifts; a finished workout and one missed past its week never lift
seed();
{ const chip = chipOf("a"), [x, y] = mid(chip);
  down(chip, x, y); await advance(100); move(x, y + 12); await advance(400); const wandered = st().on || st().lifted; up(); await advance(50);
  const dc = chipOf("d"), [dx, dy] = mid(dc); down(dc, dx, dy); await advance(450); const done = st().lifted; up(); await advance(50);
  out.noLift = { wandered, done, ghost: !!ghost() };
}
// 5. a missed workout inside its week moves to today; one missed past its week (on the month: Monday 2) never lifts
seed();
{ const chip = chipOf("m"), [x, y] = mid(chip), [tx] = mid(dayOf(day(0)));
  down(chip, x, y); await advance(410); const lifted = st().lifted, cls0 = ghost() ? ghost().className : ""; await glide(x, y, tx, y); up(); await advance(300);
  out.missed = { lifted, cls: cls0, date: maps.trainings.get("m").date };
  toggle.fire("click", {}); await advance(50);
  const oc = chipOf("o"); const [ox, oy] = oc ? mid(oc) : [0, 0]; if (oc) { down(oc, ox, oy); await advance(450); }
  out.missed.old = { shown: !!oc, lifted: st().lifted };
  if (oc) up(); await advance(50); toggle.fire("click", {}); await advance(50);
}
// 6. the strip held at its right edge: the next week after half a second, the one after 0.9 s later; let go on a day there: moved; the strip comes back to this week; never back past this week
seed();
{ const chip = chipOf("a"), [x, y] = mid(chip);
  down(chip, x, y); await advance(410);
  await glide(x, y, 20, y, 4); await advance(700); const left = st().weekOff;   // the left edge of this week: nothing turns
  await glide(20, y, 381, y, 6); await advance(480); const before = st().weekOff; await advance(40); const first = { weekOff: st().weekOff, days: week.children.map((b) => b.dataset.day.slice(8)).join(" "), slide: week.classList.contains("wk-in-r"), minHeight: week.style.minHeight || "" };
  await advance(900); const again = st().weekOff;
  const wx = WEEK.left + 2.5 * WEEK.width / 7; await glide(381, y, wx, y, 6); const key = st().key;   // (aimed at Wednesday's column: the strip's days are its columns, wherever a sliding week's buttons are)
  up(); await advance(240); const back = week.classList.contains("wk-in-l"); await advance(400);
  out.weekEdge = { left, before, first, again, key, date: maps.trainings.get("a").date, back, after: { weekOff: st().weekOff, days: week.children.map((b) => b.dataset.day.slice(8)).join(" "), minHeight: week.style.minHeight || "", slide: week.classList.contains("wk-in-r") || week.classList.contains("wk-in-l") } };
}
// 7. the month: held at its right edge, December after half a second (the slide lands, the day under the finger found again); let go there: moved; never back past this month
seed();
toggle.fire("click", {}); await advance(50);
{ const chip = chipOf("a"), [x, y] = mid(chip);
  down(chip, x, y); await advance(410); const pastM = past().length;
  await glide(x, y, 20, y, 4); await advance(700); const back = fns.calState().month;
  await glide(20, y, 382, y, 8); await advance(520); const turned = fns.calState().month; await advance(400);
  const [dx2, dy2] = mid(grid().children.find((b) => b.dataset && b.dataset.day === "2026-12-17")); await glide(382, y, dx2, dy2, 6); const key = st().key;
  up(); await advance(300);
  out.monthEdge = { pastM, back, turned, key, date: maps.trainings.get("a").date, month: fns.calState().month };
}
// 8. the month's own slide stands down under a lifted workout (its pointer moves are not a swipe)
seed();
toggle.fire("click", {}); await advance(50);
{ const chip = chipOf("a"), [x, y] = mid(chip);
  const m0 = fns.calState().month;
  down(chip, x, y); await advance(410);
  const tr0 = calTrack.style.transform || "";
  move(x + 40, y); await advance(16); move(x + 80, y); await advance(20);
  out.monthStill = { lifted: st().lifted, tr0, tr1: calTrack.style.transform || "", same: fns.calState().month === m0 };
  up(); await advance(400);
}
// 9. the client's own view: the move goes by the server's rule (a pending move)
seed(true);
{ const chip = chipOf("a"), [x, y] = mid(chip);
  down(chip, x, y); await advance(410); await glide(x, y, x + 53, y); up(); await advance(300);
  out.client = { date: maps.trainings.get("a").date, pending: maps.pendingMove.has("a") };
}
// 10. a Mac: click and hold, drag, let go: moved, its click eaten; a mouse that moves 4 points before the hold is the month's own slide; a right-click holds nothing
seed();
{ const chip = chipOf("a"), [x, y] = mid(chip);
  mouse("pointerdown", chip, x, y); await advance(410); const lifted = st().lifted;
  mouse("pointermove", chip, x + 30, y); await advance(16); mouse("pointermove", chip, x + 53, y); await advance(16);
  mouse("pointerup", chip, x + 53, y); const clk = click(dayOf(day(3))); await advance(300);   // (a mouse's click follows its release on what is under it)
  const moved = maps.trainings.get("a").date;
  const c2 = chipOf("a"), [x2, y2] = mid(c2); mouse("pointerdown", c2, x2, y2); await advance(100); mouse("pointermove", c2, x2 + 6, y2); await advance(400); const wandered = st().on; mouse("pointerup", c2, x2 + 6, y2); await advance(50);
  mouse("pointerdown", c2, x2, y2, { button: 2 }); await advance(450); const right = st().on; mouse("pointerup", c2, x2, y2, { button: 2 }); await advance(50);
  out.mouse = { lifted, moved, clickEaten: !!clk.stoppedAll, wandered, right };
}
// 11. Escape, a second finger, the system's cancel: back where it was, nothing moved
seed();
{ const r = {};
  for (const how of ["escape", "second", "cancel"]) {
    const chip = chipOf("a"), [x, y] = mid(chip);
    down(chip, x, y); await advance(410); await glide(x, y, x + 53, y, 3);
    if (how === "escape") { const k = { key: "Escape" }; for (const l of (L.keydown || []).filter((q) => q.capture)) { k.preventDefault = () => {}; k.stopImmediatePropagation = () => { k.stopped = true; }; l.fn(k); if (k.stopped) break; } up(); }
    else if (how === "second") { second(); up(); }
    else up("touchcancel");
    await advance(300); r[how] = { on: st().on, date: maps.trainings.get("a").date, ghost: !!ghost() };
  }
  out.cancel = r;
}
// 12. a sync's redraw waits while a workout is lifted (the chip stays in the page), and comes once it is down
seed();
{ const chip = chipOf("a"), [x, y] = mid(chip);
  down(chip, x, y); await advance(410);
  const { ui } = await import("../app/state.js"); maps.trainings.get("d").title = "Done 2"; ui.render(); await advance(20);
  const held = chip.isConnected;
  up(); await advance(500); out.redraw = { held, after: chip.isConnected, title: (() => { const c = chipOf("d"); return c ? c.children[0].textContent : null; })() };
}
// 13. the week turned under the finger takes its chip out of the page: its touch reaches only that chip, and still drops
seed();
{ const chip = chipOf("a"), [x, y] = mid(chip), t = chip.children[0];
  down(t, x, y); await advance(410); await glide(x, y, 381, y, 6); await advance(520);
  const gone = !t.isConnected; const wx = WEEK.left + 4.5 * WEEK.width / 7; await glide(381, y, wx, y, 5);   // (Friday's column)
  up(); await advance(300);
  out.detached = { gone, date: maps.trainings.get("a").date, listening: t.listening("touchmove") };
}
// 14. midnight passes under a lifted workout held over today: today has become a day gone by, and let go there it stays where it was
seed();
{ const chip = chipOf("a"), [x, y] = mid(chip), [tx] = mid(dayOf(day(0)));
  down(chip, x, y); await advance(410); await glide(x, y, tx, y); const key = st().key;
  NOW += 14 * 3600 * 1000; await flush();   // (the clock alone: 0:00 on Thursday the 12th, the finger still)
  up(); await advance(300);
  out.midnight = { key, date: maps.trainings.get("a").date };
  NOW -= 14 * 3600 * 1000;
}
// 15. a redraw in the moment after a drop from another week (before the strip slides back) leaves the strip this week, at its own height
seed();
{ const chip = chipOf("a"), [x, y] = mid(chip);
  down(chip, x, y); await advance(410); await glide(x, y, 381, y, 6); await advance(520);
  const wx = WEEK.left + 3.5 * WEEK.width / 7; await glide(381, y, wx, y, 5); up(); await advance(30);   // (Thursday's column)
  fns.render(); await advance(400);
  out.landRedraw = { date: maps.trainings.get("a").date, weekOff: st().weekOff, days: week.children.map((b) => b.dataset.day.slice(8)).join(" "), minHeight: week.style.minHeight || "" };
}
// 16. resting on Sunday's middle (and in the month on the 22nd's) aims at that day: nothing turns, and the drop lands there
seed();
{ const chip = chipOf("a"), [x, y] = mid(chip), sx = WEEK.left + 6.5 * WEEK.width / 7;
  down(chip, x, y); await advance(410); await glide(x, y, sx, y, 4); await advance(800); const w = st().weekOff; up(); await advance(300);
  const wkDate = maps.trainings.get("a").date;
  toggle.fire("click", {}); await advance(50);
  const c2 = chipOf("a"), [x2, y2] = mid(c2), [sx2, sy2] = mid(dayOf("2026-11-22"));
  down(c2, x2, y2); await advance(410); await glide(x2, y2, sx2, sy2, 5); await advance(1000); const m = fns.calState().month; up(); await advance(300);
  out.sunday = { weekOff: w, weekDate: wkDate, month: m, monthDate: maps.trainings.get("a").date };
  toggle.fire("click", {}); await advance(50);
}
// 17. called off with the finger or the button still on it (Escape, a second finger), the rest of that press is no swipe of the months, and its release clicks nothing
seed();
toggle.fire("click", {}); await advance(50);
{ const chip = chipOf("a"), [x, y] = mid(chip);
  mouse("pointerdown", chip, x, y); await advance(410); mouse("pointermove", chip, x + 40, y); await advance(16);
  const k = { key: "Escape" }; for (const l of (L.keydown || []).filter((q) => q.capture)) { k.preventDefault = () => {}; k.stopImmediatePropagation = () => { k.stopped = true; }; l.fn(k); if (k.stopped) break; }
  for (const d of [60, 90]) { mouse("pointermove", chip, x + d, y); await advance(16); }
  const trMid = calTrack.style.transform || ""; mouse("pointerup", chip, x + 90, y); const clk = click(dayOf("2026-11-13")); await advance(400);
  const esc = { on: st().on, tr: trMid, month: fns.calState().month, clickEaten: !!clk.stoppedAll, preview: preview(), date: maps.trainings.get("a").date };
  const c2 = chipOf("a"), [x2, y2] = mid(c2);
  down(c2, x2, y2); await advance(410); move(x2 + 30, y2); await advance(16); second();
  move(x2 + 70, y2); await advance(16); move(x2 + 110, y2); await advance(16); const trTwo = calTrack.style.transform || "";
  const end = up(); const clk2 = click(dayOf("2026-11-13")); await advance(400);
  out.calledOff = { esc, two: { on: st().on, tr: trTwo, month: fns.calState().month, upPrevented: end.defaultPrevented, clickEaten: !!clk2.stoppedAll, preview: preview(), date: maps.trainings.get("a").date } };
  toggle.fire("click", {}); await advance(50);
}
// 18. a tap a quarter of a second after a drop opens its preview (the drop's window is over at the next touch)
seed();
{ const chip = chipOf("a"), [x, y] = mid(chip);
  down(chip, x, y); await advance(410); await glide(x, y, x + 53, y); up(); await advance(250);
  const m = chipOf("m"), [mx, my] = mid(m); down(m, mx, my); await advance(100); up(); const tap = click(m); await advance(50);
  out.tapAfter = { preview: preview(), eaten: !!tap.stoppedAll };
  fns.closePreview && fns.closePreview(); await advance(400);
}
// 19. the copy follows the finger at once from its first move; let go far below the strip, nothing moves; the day under a still finger is found once a turned month lands
seed();
{ const chip = chipOf("a"), [x, y] = mid(chip);
  down(chip, x, y); await advance(410); const tr0 = ghost() ? ghost().style.transition : ""; move(x + 10, y); await advance(16); const tr1 = ghost() ? ghost().style.transition : "";
  await glide(x + 10, y, x + 53, y + 260, 6); const key = st().key; await glide(x + 53, y + 260, 381, y + 260, 4); await advance(700); const turnedBelow = st().weekOff; up(); await advance(300);
  out.follow = { tr0, tr1, keyBelow: key, turnedBelow, date: maps.trainings.get("a").date };
  toggle.fire("click", {}); await advance(50);
  const c2 = chipOf("a"), [x2, y2] = mid(c2);
  down(c2, x2, y2); await advance(410); await glide(x2, y2, 382, y2, 6); await advance(520); const during = st().key; await advance(420); const landed = st().key; up(); await advance(300);
  out.follow.month = { during, landed, date: maps.trainings.get("a").date };
  toggle.fire("click", {}); await advance(50);
}
// 20. a sync's redraw during the hold draws the chip anew: the same workout in the same day still lifts
seed();
{ const chip = chipOf("a"), [x, y] = mid(chip);
  down(chip, x, y); await advance(250); fns.render(); await advance(10); const gone = !chip.isConnected; await advance(200);
  out.redrawHold = { gone, lifted: st().lifted }; await glide(x, y, x + 53, y); up(); await advance(300); out.redrawHold.date = maps.trainings.get("a").date;
}
// 21. a Mac's release lost to the window (its last move with the button already up, no pointerup): back where it was
seed();
{ const chip = chipOf("a"), [x, y] = mid(chip);
  mouse("pointerdown", chip, x, y); await advance(410); mouse("pointermove", chip, x + 53, y); await advance(16);
  mouse("pointermove", chip, x + 60, y, { buttons: 0 }); await advance(120); const waiting = st().on; await advance(500);
  out.lostUp = { waiting, on: st().on, date: maps.trainings.get("a").date, ghost: !!ghost() };
}
// 22. the client gone (deleted on another device) while a workout is held at the strip's edge: nothing turns, it goes back
seed();
{ const chip = chipOf("a"), [x, y] = mid(chip);
  down(chip, x, y); await advance(410); await glide(x, y, 381, y, 6); maps.clients.delete("c1"); let threw = null;
  try { await advance(600); } catch (e) { threw = String(e && e.message || e); }
  out.goneClient = { threw, on: st().on, weekOff: st().weekOff }; up(); await advance(300);
}
// 23. Reduce Motion: the copy appears and goes at once, and the strip's weeks change with no slide
seed();
{ const mm = globalThis.matchMedia; globalThis.matchMedia = (q) => ({ matches: /reduce/.test(q), addEventListener() {}, removeEventListener() {} });
  const chip = chipOf("a"), [x, y] = mid(chip);
  down(chip, x, y); await advance(410); const tr = ghost() ? ghost().style.transition : null;
  await glide(x, y, 381, y, 6); await advance(520); const slide = week.classList.contains("wk-in-r") || week.classList.contains("wk-in-l");
  const [wx] = [WEEK.left + 2.5 * WEEK.width / 7]; await glide(381, y, wx, y, 4); up(); const gone = !ghost(); await advance(300);
  out.calm = { tr, slide, gone, date: maps.trainings.get("a").date };
  globalThis.matchMedia = mm;
}
// 24. dropped on a turned week, then a quick tap on a chip there before the strip slides back: it still comes back, at its own height
seed();
{ const chip = chipOf("a"), [x, y] = mid(chip);
  down(chip, x, y); await advance(410); await glide(x, y, 381, y, 6); await advance(520);
  const wx = WEEK.left + 2.5 * WEEK.width / 7; await glide(381, y, wx, y, 5); up(); await advance(60);
  const c = chipOf("a"), [cx, cy] = c ? mid(c) : [wx, y]; down(c || week.children[2], cx, cy); await advance(250); up(); await advance(600);
  out.tapBack = { date: maps.trainings.get("a").date, weekOff: st().weekOff, days: week.children.map((b) => b.dataset.day.slice(8)).join(" "), minHeight: week.style.minHeight || "" };
  fns.closePreview && fns.closePreview(); await advance(400);
}
out.ticks = ticks;
console.log(JSON.stringify(out));
process.exit(0);
