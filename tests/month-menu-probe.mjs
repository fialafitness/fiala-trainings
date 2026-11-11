// Run by month-menu.test.js in its own process: two fingers on a Mac's trackpad over the client page's month and over the day picker's
// months, a right-click on a workout row and on an exercise, and a missed workout's Skip. The document keeps its listeners, the pagers, the
// menu and the skip sheet keep theirs, and every timer runs on this probe's own clock, so this loads the real app/main.js with recording
// stand-ins, plays the gestures (Safari's coasting after the fingers, as row-swipe-probe.mjs plays it) and prints, as JSON, what each one did.
import { byId, el } from "./env.js";
// the clock: every timer the app sets is this one's, and so is performance.now
let NOW = 10000, SEQ = 0; const Q = [];
globalThis.setTimeout = (fn, ms) => { const id = ++SEQ; Q.push({ id, at: NOW + Math.max(0, ms || 0), fn }); return id; };
globalThis.clearTimeout = (id) => { const i = Q.findIndex((q) => q.id === id); if (i >= 0) Q.splice(i, 1); };
try { performance.now = () => NOW; } catch (_) { Object.defineProperty(globalThis, "performance", { value: { now: () => NOW }, configurable: true }); }
{ const t0 = Date.now() - NOW; Date.now = () => t0 + NOW; }               // (the day picker waits for its months to land by Date.now)
const flush = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };
async function advance(ms) {
  const end = NOW + ms;
  for (;;) { Q.sort((a, b) => a.at - b.at || a.id - b.id); const q = Q[0]; if (!q || q.at > end) break; Q.shift(); NOW = Math.max(NOW, q.at); q.fn(); await flush(); }
  NOW = end; await flush();
}
// the document keeps its listeners (and lets them go); nothing is held up by a sheet, a picture or the top bar
const L = {};
document.addEventListener = (t, fn, o) => { (L[t] ||= []).push({ fn, capture: o === true || !!(o && o.capture) }); };
document.removeEventListener = (t, fn) => { const a = L[t] || []; const i = a.findIndex((x) => x.fn === fn); if (i >= 0) a.splice(i, 1); };
globalThis.addEventListener = () => {}; globalThis.removeEventListener = () => {};
let sheetUp = () => false;                                                // the day picker is a sheet (.sheet-bg): up, it holds the page under it
const qs = document.querySelector; document.querySelector = (s) => (/sheet-bg/.test(s) ? (sheetUp() ? {} : null) : /crop-view|header \.bar/.test(s) ? null : qs(s));
document.contains = (x) => !!x;
document.documentElement.clientWidth = 1000;                              // the window: 1000 wide, 800 tall
function fire(type, ev) {
  let stopped = false; ev.type = type; ev.defaultPrevented = false;
  ev.preventDefault = () => { ev.defaultPrevented = true; }; ev.stopPropagation = () => {}; ev.stopImmediatePropagation = () => { stopped = true; };
  if (ev.timeStamp == null) ev.timeStamp = NOW;
  const ls = L[type] || []; for (const l of [...ls.filter((x) => x.capture), ...ls.filter((x) => !x.capture)]) { if (stopped) break; l.fn(ev); }
  return ev;
}
// the page's own elements: they keep what is put in them and their listeners
const kids = (e) => {
  e.replaceChildren = (...k) => { e.children = k; e.firstElementChild = k[0] || null; };
  e.appendChild = (c) => { e.children = [...e.children, c]; e.firstElementChild = e.children[0]; return c; };
  e.append = (...k) => { e.children = [...e.children, ...k]; e.firstElementChild = e.children[0] || null; };
  return e;
};
const listens = (e) => { const H = {}; e.addEventListener = (type, fn) => { (H[type] ||= []).push(fn); }; e.removeEventListener = (type, fn) => { const a = H[type] || []; const i = a.indexOf(fn); if (i >= 0) a.splice(i, 1); }; e.fire = (type, ev) => { for (const fn of [...(H[type] || [])]) fn(ev); }; e.focus = () => { document.activeElement = e; }; return e; };
const recorder = (id, extra = {}) => { const e = listens(kids(el("div"))); Object.assign(e, extra); byId.set(id, e); return e; };
const W = 350;
const calView = recorder("calView", { clientWidth: W }), calTrack = recorder("calTrack"), calTitle = recorder("calTitle");
for (const id of ["calToday", "calPrev", "calNext", "calWrap"]) recorder(id);
const calToggle = recorder("calToggle");                                  // the page's Month button: the month is opened there (it never comes back by itself, v251)
const g = recorder("dpGrid", { clientWidth: W, setPointerCapture() {} });
for (const id of ["dpPrev", "dpNext", "dpToday", "datePick", "dpCancel"]) recorder(id);
const pop = recorder("whenPop", { offsetWidth: 243, offsetHeight: 150 });
pop.querySelector = (sel) => (sel === ".wopt" ? pop.children.find((c) => /\bwopt\b/.test(c.className)) || null : null); pop.contains = (x) => !!x && pop.children.includes(x);
const bg = recorder("whenBg"); bg.hidden = true;
const sheet = recorder("skipSheet"); sheet.hidden = true; const skGo = recorder("skGo"), skKeep = recorder("skKeep"); recorder("skReasons");
const skipAllBtn = recorder("skipAll"), askSheet = recorder("askSheet"), askYes = recorder("askYes"), askNo = recorder("askNo"); askSheet.hidden = true;   // the Missed card's Skip all and the question it asks
const make = document.createElement; document.createElement = (t) => listens(kids(make(t)));
globalThis.getComputedStyle = (node) => {                                // the day picker's track stands at its last written transform
  const m = /translate3d\(([-\d.e]+)px/.exec((node && node.style && node.style.transform) || "");
  return { transform: m ? "matrix(1, 0, 0, 1, " + Number(m[1]) + ", 0)" : "none", getPropertyValue: () => "", display: "block", color: "" };
};
const app = (await import("../app/main.js")).internals();
const { fns, maps } = app;
sheetUp = () => !!fns.datePicker();
const day = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return fns.localIso(d); };

// things on the page that know where they are, for the events' targets: just what the gesture and menu code read
const ROOT = { tagName: "HTML", parentElement: null };
const matches = (n, sel) => sel.split(",").some((part) => {
  const m = part.trim().match(/^([a-z]+)?(#[\w-]+)?((?:\.[\w-]+)*)$/i); if (!m) return false;
  const [, tag, id, cls] = m;
  return (!tag || n.tagName === tag.toUpperCase()) && (!id || n.id === id.slice(1)) && (cls || "").split(".").filter(Boolean).every((c) => n.classList.contains(c));
});
function mk(tag, classes = [], id = "") {
  const set = new Set(classes);
  const n = { nodeType: 1, tagName: tag.toUpperCase(), id, children: [], parentElement: null, dataset: {}, style: {},
    classList: { add: (...c) => c.forEach((x) => set.add(x)), remove: (...c) => c.forEach((x) => set.delete(x)), toggle: (c, f) => { const on = f === undefined ? !set.has(c) : !!f; if (on) set.add(c); else set.delete(c); return on; }, contains: (c) => set.has(c) },
    append(...k) { for (const c of k) { c.parentElement = n; n.children.push(c); } },
    get isConnected() { let p = n; while (p.parentElement) p = p.parentElement; return p === ROOT; },
    querySelector(sel) { const walk = (x) => { for (const c of x.children) { if (matches(c, sel)) return c; const f = walk(c); if (f) return f; } return null; }; return walk(n); },
    closest(sel) { for (let p = n; p && p !== ROOT; p = p.parentElement) if (matches(p, sel)) return p; return null; },
    contains(o) { for (let p = o; p; p = p.parentElement) if (p === n) return true; return false; },
    getBoundingClientRect() { return { width: 300, height: 60, top: 100, left: 100, right: 400, bottom: 160 }; },
    tabIndex: -1, focus() { if (/^(BUTTON|INPUT|TEXTAREA)$/.test(n.tagName) || n.tabIndex >= 0) document.activeElement = n; } };   // a li or a div takes no focus
  return n;
}
const onPage = (n) => { n.parentElement = ROOT; return n; };
const calNode = onPage(mk("div", ["cal-view"], "calView")), calDay = mk("button"); calNode.append(calDay);
const dpNode = onPage(mk("div", ["dp-pager"], "dpGrid")), dpDay = mk("button"); dpNode.append(dpDay);
const elsewhere = onPage(mk("div"));

// Safari's two fingers: the fingers (whole events), then its coasting, one event per 120 Hz frame (row-swipe-probe.mjs, measured 8 Nov)
const FINGERS = [1, 2, 4, 6, 9, 12, 14, 15], COAST = [15, 16, 15, 15, 16, 15, 15, 15, 14, 15, 14, 14, 13, 13, 12, 12, 11, 11, 10, 10, 9, 9, 8, 8, 7, 7, 6, 6, 5, 5, 5, 4, 4, 4, 3, 3, 3, 2, 2, 2, 2, 1, 1, 1, 1, 1];
const wheel = (dx, dy, target, natural = true) => fire("wheel", { deltaX: dx, deltaY: dy, deltaMode: 0, ctrlKey: false, shiftKey: false, target, webkitDirectionInvertedFromDevice: natural, timeStamp: Math.floor(NOW) });
async function play(deltas, target, { sign = 1, natural = true, each } = {}) {   // sign 1: a scroll to the right (fingers to the left, scrolling naturally): the next month
  let prevented = 0; for (const d of deltas) { const [dx, dy] = Array.isArray(d) ? d : [d, 0]; const e = wheel(sign * dx, dy, target, natural); if (e.defaultPrevented) prevented++; if (each) each(); await advance(8.33); }
  return prevented;
}
const steady = (px, step = 5) => Array.from({ length: Math.round(px / step) }, () => step);   // slow fingers: px in steps, then they rest
const out = {};

// ---------- the client page's month ----------
const clientPage = (clientMode = false) => {
  app.reset(); app.set({ signedIn: true, clientMode, myClientId: clientMode ? "c1" : null, tab: "workouts" });
  maps.clients.set("c1", { id: "c1", name: "Jane", unit: "lb" });
  maps.trainings.set("w1", { id: "w1", clientId: "c1", title: "Legs", date: day(1), createdAt: "2026-11-01T10:00:00.000Z", completedAt: null, skippedAt: null, rows: [] });
  app.set({ view: { name: "client", id: "c1" } }); fns.render();
  if (!fns.calState().open) calToggle.fire("click", {});                   // the client page shows its month, not its week
};
const calX = () => { const m = /calc\(-100% \+ ([-\d.e]+)px\)/.exec(calTrack.style.transform || ""); return m ? Number(m[1]) : (calTrack.style.transform === "translateX(-100%)" ? 0 : calTrack.style.transform); };
const month = (ym, n) => { const [y, m] = ym.split("-").map(Number); const d = new Date(y, m - 1 + n, 1, 12); return d.toLocaleDateString(undefined, { month: "long", year: "numeric" }); };
const thisMonth = fns.today().slice(0, 7);
const calRun = async (deltas, opts = {}) => {
  clientPage(); await advance(500); const before = calTitle.textContent; let mid = null;
  const prevented = await play(deltas, opts.target || calDay, { ...opts, each: () => { const x = calX(); if (typeof x === "number" && (mid === null || Math.abs(x) > Math.abs(mid))) mid = x; } });
  await advance(600);
  return { before, after: calTitle.textContent, prevented, of: deltas.length, mid, rest: calX() };
};
out.cal = { titles: { now: month(thisMonth, 0), next: month(thisMonth, 1), prev: month(thisMonth, -1) } };
out.cal.slow60 = await calRun(steady(60));                                 // slow fingers 60 px to the left, then they rest: past 48, the next month
out.cal.slow40 = await calRun(steady(40));                                 // 40 px: back where it was
out.cal.flick = await calRun([...FINGERS, ...COAST]);                       // a flick and its coasting: one month, every event kept from Safari
out.cal.back = await calRun(steady(60), { sign: -1 });                      // to the right: the month before
out.cal.unnatural = await calRun(steady(60), { natural: false });            // natural scrolling off: a scroll to the right still brings the next month (the page's way, as Safari's own swipe)
out.cal.vertical = await calRun(Array.from({ length: 12 }, () => [0, 5]));   // up and down: the page's scroll, nothing kept, nothing moves
out.cal.slanted = await calRun(Array.from({ length: 12 }, () => [4, 3]));    // slanted, not twice as sideways: a scroll
{ clientPage(); await advance(500); bg.hidden = false;                       // a menu is up: the month under it is not the fingers'
  const before = calTitle.textContent, prevented = await play(steady(60), calDay); await advance(600); bg.hidden = true;
  out.cal.underMenu = { before, after: calTitle.textContent, prevented }; }
{ clientPage(); await advance(500); calView.fire("pointerdown", { isPrimary: true, pointerId: 1, clientX: 200, clientY: 300 });   // a finger already on the months: they stay its
  const before = calTitle.textContent, prevented = await play(steady(60), calDay); await advance(600); calView.fire("pointerup", {});
  out.cal.fingerOn = { before, after: calTitle.textContent, prevented }; }
{ clientPage(); await advance(500); const panels = calTrack.children; let keptMid = null;   // a sync's redraw while two fingers hold the months: it waits, then comes
  await play(steady(30), calDay, { each: () => { if (keptMid === null && calX() !== 0) { fns.render(); keptMid = calTrack.children === panels; } } });
  await advance(600); out.cal.redraw = { keptMid, after: calTrack.children !== panels, title: calTitle.textContent }; }
{ clientPage(); await advance(500); const from = calTitle.textContent;     // fingers back on the trackpad after a rest (200 ms): a new gesture, from where the month landed
  await play(steady(60), calDay); await advance(200); const first = calTitle.textContent; await play(steady(60), calDay); await advance(600);
  out.cal.twice = { from, first, then: calTitle.textContent }; }
{ clientPage(); await advance(500); const from = calTitle.textContent;     // on again within 40 ms, before any rest: the same gesture, one month
  await play(steady(60), calDay); await advance(30); await play(steady(60), calDay); await advance(600);
  out.cal.noRest = { from, then: calTitle.textContent }; }

out.cal.slowFlick = await calRun([...steady(330, 3), ...FINGERS, ...COAST]);   // slowly to 330 of 350, then a flick: the edge comes while the fingers still speed up; one month
{ clientPage(); await advance(500); calView.fire("pointerdown", { isPrimary: true, pointerId: 1, pointerType: "mouse", button: 2, clientX: 200, clientY: 300 });   // a right-click on a day (its menu takes the release): two fingers still page
  const before = calTitle.textContent; await play(steady(60), calDay); await advance(600); out.cal.afterRightPress = { before, after: calTitle.textContent }; }
{ clientPage(); await advance(500); calView.fire("pointerdown", { isPrimary: true, pointerId: 1, pointerType: "mouse", button: 0, clientX: 200, clientY: 300 });   // a press let go outside the month
  fire("pointerup", { target: elsewhere, pointerType: "mouse", pointerId: 1, button: 0, buttons: 0, clientX: 200, clientY: 700 });
  const before = calTitle.textContent; await play(steady(60), calDay); await advance(600); out.cal.afterOutsideRelease = { before, after: calTitle.textContent }; }
{ clientPage(); await advance(500); const before = calTitle.textContent;   // a second finger lifted elsewhere while the first drags the month: the first one's drag goes on
  const f = (type, x, id = 1, extra = {}) => calView.fire(type, { isPrimary: id === 1, pointerId: id, pointerType: "touch", button: 0, clientX: x, clientY: 300, ...extra });
  f("pointerdown", 300); f("pointermove", 280); f("pointermove", 260); const mid = calX();
  fire("pointerup", { target: elsewhere, pointerType: "touch", pointerId: 2, isPrimary: false, button: 0, clientX: 10, clientY: 10 });
  f("pointermove", 240); const on = calX(); f("pointerup", 240); await advance(600);
  out.cal.secondFinger = { mid, on, before, after: calTitle.textContent }; }
// ---------- the day picker's months ----------
const dpTrack = () => g.firstElementChild;
const dpPx = () => { const m = /translate3d\(([-\d.e]+)px/.exec(dpTrack().style.transform || ""); return m ? Number(m[1]) : null; };
const dpState = () => { const dp = fns.datePicker(); return dp ? { idx: dp.months.indexOf(dp.month), at: dpPx() / -W } : null; };
let picked = [];
const picker = (opts = {}) => {
  clientPage(); picked = [];
  fns.openDatePicker({ clientId: "c1", title: "Move to", selected: fns.today(), onPick: (d) => picked.push(d), ...opts });
};
const dpRun = async (deltas, opts = {}, pickerOpts = {}) => {
  picker(pickerOpts); await advance(500); const before = dpState(); let far = 0;
  const st = dpTrack().style; let raw = st.transform;                     // every place the months are put, even one let go of in the same event
  Object.defineProperty(st, "transform", { configurable: true, get: () => raw, set: (v) => { raw = v; const m = /translate3d\(([-\d.e]+)px/.exec(v || ""); if (m) { const a = Number(m[1]) / -W - before.idx; if (Math.abs(a) > Math.abs(far)) far = a; } } });
  const prevented = await play(deltas, dpNode.children[0], opts);
  await advance(800); const after = dpState(); fns.closeDatePicker();
  return { before: before.idx, after: after.idx, at: after.at, prevented, of: deltas.length, far };
};
out.dp = {};
out.dp.slow100 = await dpRun(steady(100));                                  // under half the month (175): back
out.dp.slow200 = await dpRun(steady(200));                                  // past half: the next month
out.dp.flick = await dpRun([...FINGERS, ...COAST]);                          // a flick: one month on, never two, the coasting kept from Safari
out.dp.back = await dpRun(steady(200), { sign: -1 });                        // the month before
out.dp.first = await dpRun(steady(200), { sign: -1 }, { min: fns.today(), title: "Reschedule" });   // Reschedule opens on its first month: nothing before it, it gives a little and comes back
{ picker(); await advance(500); const before = dpState(); g.fire("pointerdown", { isPrimary: true, pointerId: 1, pointerType: "touch", clientX: 200, clientY: 300, timeStamp: NOW });   // a finger on the months: theirs
  const prevented = await play(steady(200), dpNode.children[0]); await advance(800); g.fire("pointerup", { isPrimary: true, pointerId: 1, clientX: 200, clientY: 300, timeStamp: NOW });
  out.dp.fingerOn = { before: before.idx, after: dpState().idx, prevented }; fns.closeDatePicker(); }
out.dp.slowFlick = await dpRun([...steady(330, 3), ...FINGERS, ...COAST]);
{ picker({ min: fns.today(), title: "Reschedule" }); await advance(500); dpTrack().style.transform = "translate3d(40px,0,0)";   // caught bouncing back: 40 px past the first month on screen (a 120 px pull let go a moment ago)
  const seen = []; await play(steady(12, 3), dpNode.children[0], { sign: -1, each: () => seen.push(dpPx()) }); await advance(800);
  out.dp.catch = { from: 40, lowest: Math.min(...seen), first: seen.find((x) => x !== 40), after: dpState().idx }; fns.closeDatePicker(); }
{ picker(); await advance(500); g.fire("pointerdown", { isPrimary: true, pointerId: 1, pointerType: "mouse", button: 0, clientX: 200, clientY: 300, timeStamp: NOW });   // a press let go outside the months
  fire("pointerup", { target: elsewhere, pointerType: "mouse", pointerId: 1, button: 0, buttons: 0, clientX: 200, clientY: 700, timeStamp: NOW });
  const before = dpState().idx; await play(steady(200), dpNode.children[0]); await advance(800); out.dp.afterOutsideRelease = { before, after: dpState().idx }; fns.closeDatePicker(); }
{ picker(); await advance(500); g.fire("pointerdown", { isPrimary: true, pointerId: 1, pointerType: "mouse", button: 2, clientX: 200, clientY: 300, timeStamp: NOW });   // a right-click on a day
  const before = dpState().idx; await play(steady(200), dpNode.children[0]); await advance(800); out.dp.afterRightPress = { before, after: dpState().idx }; fns.closeDatePicker(); }
{ picker(); await advance(500); let keptMid = null, held = dpTrack();     // a sync's redraw waits until the months have settled
  await play(steady(200), dpNode.children[0], { each: () => { if (keptMid === null && dpPx() !== -12 * W) { fns.render(); keptMid = dpTrack() === held; } } });
  let soon = true; const land = 90 + fns.springEase(0, 0.3, 1).ms;   // let go at the rest (90 ms after the last event), then the spring: it lands about 446 ms after
  for (let t = 18.33; t < land; t += 10) { await advance(10); if (dpTrack() !== held) soon = false; }
  const letGo = dpState().idx === 13; await advance(1500);
  out.dp.redraw = { keptMid, soon, letGo, after: dpTrack() !== held }; fns.closeDatePicker(); }
{ picker(); await advance(500);                                             // the client page's month behind the sheet takes no part
  const before = calTitle.textContent; const prevented = await play(steady(60), calDay); await advance(600);
  out.dp.behind = { before, after: calTitle.textContent, prevented }; fns.closeDatePicker(); }

// ---------- a right-click ----------
const right = (target, x = 300, y = 200, extra = {}) => {
  const down = fire("pointerdown", { target, pointerType: "mouse", pointerId: 1, button: 2, buttons: 2, clientX: x, clientY: y, ...extra });
  const menu = fire("contextmenu", { target, clientX: x, clientY: y, button: 2 });
  fire("pointerup", { target, pointerType: "mouse", pointerId: 1, button: 2, buttons: 0, clientX: x, clientY: y });
  return { pressKept: down.defaultPrevented, menuKept: menu.defaultPrevented, open: bg.hidden === false, labels: pop.children.map((c) => c.textContent || (c.children.at(-1) || {}).textContent), left: pop.style.left, top: pop.style.top };
};
const menuOff = () => fire("keydown", { key: "Escape" });
// a workout row on Up next, the real one's menu on a row that knows where it is
const workoutRowOnPage = (clientMode, extra = {}) => {
  clientPage(clientMode); const t = maps.trainings.get("w1"); Object.assign(t, extra);
  const real = fns.workoutRow(t, "next", true), li = onPage(mk("li", ["w", "swipe-row"])), b = mk("button"), pri = mk("span", ["pri"]), acts = mk("div", ["swipe-acts"]), sa = mk("button", ["swipe-act"]);
  b.append(pri); acts.append(sa); li.append(b, acts); li._ctx = real._ctx; li.dataset.tid = "w1";
  return { li, b, pri, sa, real };
};
out.row = {};
{ const r = workoutRowOnPage(true); out.row.client = right(r.pri, 300, 200); out.row.client.ring = r.li.classList.contains("ctx-on");
  menuOff(); out.row.client.closed = bg.hidden === true; out.row.client.ringOff = !r.li.classList.contains("ctx-on"); }
{ const r = workoutRowOnPage(false); out.row.coach = right(r.pri, 900, 700);   // the trainer's view: the same two; near the window's corner the menu turns left and up
  pop.children[1].fire("click", { stopPropagation() {} }); out.row.coach.skip = { asking: app.get().asking, sheet: sheet.hidden === false, skipped: !!maps.trainings.get("w1").skippedAt, closed: bg.hidden === true, ringOff: !r.li.classList.contains("ctx-on") };
  sheet.hidden = true; app.set({ asking: false }); }
{ const r = workoutRowOnPage(false); right(r.pri); pop.children[0].fire("click", { stopPropagation() {} });
  const dp = fns.datePicker(); out.row.reschedule = { picker: !!dp, title: dp && dp.title }; fns.closeDatePicker(); }
{ const r = workoutRowOnPage(true); out.row.onAction = right(r.sa); menuOff(); }   // the swipe's own buttons are not the row
{ const r = workoutRowOnPage(true); out.row.finished = right(r.pri, 300, 200); menuOff();   // finished meanwhile (a sync): no menu of its own
  maps.trainings.get("w1").completedAt = "2026-11-02T18:00:00.000Z"; out.row.finished = right(r.pri); menuOff(); }
{ const r = workoutRowOnPage(true); fire("pointerdown", { target: r.pri, pointerType: "touch", pointerId: 3, button: 0, clientX: 300, clientY: 200 });   // a finger's long press: never this menu
  const ev = fire("contextmenu", { target: r.pri, clientX: 300, clientY: 200 }); out.row.longPress = { kept: ev.defaultPrevented, open: bg.hidden === false }; menuOff(); }
{ const r = workoutRowOnPage(true); await advance(2000); document.activeElement = null;   // the keyboard's or VoiceOver's (VO-Shift-M): no press before it; the menu at the row, focus in it
  const ev = fire("contextmenu", { target: r.pri, clientX: 0, clientY: 0 });
  out.row.keyboard = { kept: ev.defaultPrevented, open: bg.hidden === false, focusIn: document.activeElement === pop.children[0], left: pop.style.left, top: pop.style.top, ring: r.li.classList.contains("ctx-on") }; menuOff();
  out.row.keyboard.focusBack = document.activeElement === r.b; }
{ const r = workoutRowOnPage(true); await advance(2000);                    // Chrome says what opened its menu itself: a finger's (a long press however slow), the keyboard's (""), a mouse's
  const by = (pointerType, x = 300, y = 200) => { const ev = fire("contextmenu", { target: r.pri, clientX: x, clientY: y, pointerType }); const o = { kept: ev.defaultPrevented, open: bg.hidden === false, focusIn: document.activeElement === pop.children[0] }; menuOff(); document.activeElement = null; return o; };
  out.row.chrome = { touch: by("touch"), pen: by("pen"), keyboard: by(""), mouse: by("mouse") }; }
{ const r = workoutRowOnPage(true); await advance(2000);                    // a finger held 1.6 s (a long press set slow): still a finger's
  fire("pointerdown", { target: r.pri, pointerType: "touch", pointerId: 4, button: 0, clientX: 300, clientY: 200 }); await advance(1600);
  const ev = fire("contextmenu", { target: r.pri, clientX: 300, clientY: 200 }); out.row.slowLongPress = { kept: ev.defaultPrevented, open: bg.hidden === false }; menuOff();
  fire("pointerup", { target: r.pri, pointerType: "touch", pointerId: 4, button: 0, clientX: 300, clientY: 200 }); }
{ const r = workoutRowOnPage(true); await advance(2000); document.activeElement = null;   // the right button held 2 s, the menu after its release (as Windows sends it)
  fire("pointerdown", { target: r.pri, pointerType: "mouse", pointerId: 1, button: 2, buttons: 2, clientX: 300, clientY: 200 }); await advance(2000);
  fire("pointerup", { target: r.pri, pointerType: "mouse", pointerId: 1, button: 2, buttons: 0, clientX: 300, clientY: 200 }); await advance(20);
  const ev = fire("contextmenu", { target: r.pri, clientX: 300, clientY: 200 });
  out.row.slowRight = { kept: ev.defaultPrevented, open: bg.hidden === false, left: pop.style.left, top: pop.style.top, focusIn: document.activeElement === pop.children[0] }; menuOff(); }
{ const r = workoutRowOnPage(true);                                        // the Mac selects the word under a right-click before the menu: that selection is called off; a left press's is not
  fire("pointerdown", { target: r.pri, pointerType: "mouse", pointerId: 1, button: 2, buttons: 2, clientX: 300, clientY: 200 });
  const during = fire("selectstart", { target: r.pri }); fire("contextmenu", { target: r.pri, clientX: 300, clientY: 200 }); const after = fire("selectstart", { target: r.pri });
  fire("pointerup", { target: r.pri, pointerType: "mouse", pointerId: 1, button: 2, buttons: 0, clientX: 300, clientY: 200 }); menuOff();
  fire("pointerdown", { target: r.pri, pointerType: "mouse", pointerId: 1, button: 0, buttons: 1, clientX: 300, clientY: 200 }); const left = fire("selectstart", { target: r.pri });
  fire("pointerup", { target: r.pri, pointerType: "mouse", pointerId: 1, button: 0, buttons: 0, clientX: 300, clientY: 200 });
  out.row.selection = { during: during.defaultPrevented, after: after.defaultPrevented, left: left.defaultPrevented }; }
{ const r = workoutRowOnPage(true); await advance(2000); document.activeElement = null;   // a right-click on the page itself: the browser's own menu takes its release; a keyboard menu later is still the keyboard's
  fire("pointerdown", { target: elsewhere, pointerType: "mouse", pointerId: 1, button: 2, buttons: 2, clientX: 10, clientY: 10 }); const own = fire("contextmenu", { target: elsewhere, clientX: 10, clientY: 10 });
  await advance(2000); const ev = fire("contextmenu", { target: r.pri, clientX: 0, clientY: 0 });
  out.row.keyboardAfterNative = { nativeKept: own.defaultPrevented, kept: ev.defaultPrevented, focusIn: document.activeElement === pop.children[0], left: pop.style.left }; menuOff(); document.activeElement = null; }
{ const r = workoutRowOnPage(true), r2 = workoutRowOnPage(true);              // a right-click elsewhere while one is open: the first one's ring comes off, the new one opens
  right(r.pri); const first = r.li.classList.contains("ctx-on"); right(r2.pri, 320, 260);
  out.row.again = { first, firstOff: !r.li.classList.contains("ctx-on"), second: r2.li.classList.contains("ctx-on"), open: bg.hidden === false };
  menuOff(); }
{ const r = workoutRowOnPage(true); right(r.pri); const inside = fire("contextmenu", { target: pop.children[0], clientX: 310, clientY: 210 }); out.row.inMenu = { kept: inside.defaultPrevented, open: bg.hidden === false };
  const away = fire("contextmenu", { target: elsewhere, clientX: 10, clientY: 10 }); out.row.away = { kept: away.defaultPrevented, closed: bg.hidden === true, ringOff: !r.li.classList.contains("ctx-on") }; }

{ clientPage(true); const chip = onPage(mk("button")); fns.showWhen(chip, [{ k: "Best", v: "225 lb \u00d7 8", d: "Wed, Oct 8" }]);
  const inside = fire("contextmenu", { target: pop.children[0], clientX: 300, clientY: 200 }); const stillOpen = bg.hidden === false;
  const outside = fire("contextmenu", { target: elsewhere, clientX: 10, clientY: 10 });
  out.bubble = { insideKept: inside.defaultPrevented, stillOpen, outsideKept: outside.defaultPrevented, closed: bg.hidden === true }; }
// an exercise in the coach's view, carrying the menu of its "…" as the row's own code hangs it on (the stand-in cannot draw a whole exercise:
// that wiring is checked in a browser)
let exPicked = [];
const exerciseOnPage = (rowExtra = {}) => {
  clientPage(false); exPicked = [];
  const r = { id: "r1", label: "2a", name: "Wide-grip dip", note: "", ...rowExtra };
  const row = onPage(mk("div", ["row"])), num = mk("input", ["label"]), name = mk("textarea", ["name"]), reps = mk("input", ["reps"]), panel = mk("div", ["alt-menu"]), inPanel = mk("button");
  const more = mk("button", ["more-btn"]); panel.append(inPanel); row.append(num, name, reps, more, panel);
  row._ctx = () => fns.exerciseMenu(r, { swap: () => exPicked.push("swap"), note: () => exPicked.push("note"), remove: () => exPicked.push("remove") }); row._ctx.ok = () => true;
  return { row, num, name, reps, inPanel, more };
};
out.ex = {};
{ const x = exerciseOnPage(); document.activeElement = null; out.ex.name = right(x.name); out.ex.name.ring = x.row.classList.contains("ctx-on"); menuOff(); out.ex.name.ringOff = !x.row.classList.contains("ctx-on"); }
{ const x = exerciseOnPage({ note: "Slow on the way down" }); out.ex.noted = right(x.num); menuOff(); }   // its number: the menu, and the press opens no picker (it focuses nothing)
{ const x = exerciseOnPage(); document.activeElement = x.name; out.ex.typing = right(x.name); menuOff(); }   // the field being typed in: the browser's own (Cut, Copy, Paste)
{ const x = exerciseOnPage(); document.activeElement = x.reps; out.ex.otherField = right(x.name); menuOff(); document.activeElement = null; }   // typing in another field: the menu
{ const x = exerciseOnPage(); out.ex.panel = right(x.inPanel); menuOff(); }   // in its open panel: not the exercise
{ const x = exerciseOnPage(); await advance(2000); document.activeElement = null;   // from the keyboard on the exercise (VoiceOver on its card): focus into the menu, and back on its "…"
  const ev = fire("contextmenu", { target: x.row, clientX: 0, clientY: 0 }); const focusIn = document.activeElement === pop.children[0]; menuOff();
  out.ex.keyboard = { kept: ev.defaultPrevented, focusIn, focusBack: document.activeElement === x.more }; }
{ const x = exerciseOnPage(); out.ex.pick = right(x.name); const md = { preventDefault() { this.kept = true; } }; pop.children[2].fire("mousedown", md); out.ex.pick.pressKeepsFocus = !!md.kept; pop.children[2].fire("click", { stopPropagation() {} });   // its last row: Delete exercise, the "…" menu's own
  out.ex.pick.picked = exPicked.slice(); out.ex.pick.closed = bg.hidden === true; out.ex.pick.ringOff = !x.row.classList.contains("ctx-on"); }

// ---------- the typing look, after a field its own redraw took off the page (an exercise's new number): only its blur is heard ----------
{ clientPage(false); const f = onPage(mk("input", ["label"])); document.activeElement = f; fire("focusin", { target: f }); const on = document.body.classList.contains("typing");
  document.activeElement = document.body; fire("blur", { target: f }); await advance(100);   // (its focusout went to a field no longer on the page)
  out.typing = { on, off: !document.body.classList.contains("typing") }; }
// ---------- a missed workout's Skip, from its "…" on the Missed card (his pick B, 10 Nov) ----------
const missRow = (t) => { const li = fns.workoutRow(t, "missed", true); return { li, more: li.children.find((c) => c.className === "miss-more") }; };
const label = (b) => (b.children.find((c) => c.tagName === "SPAN") || {}).textContent;
{ clientPage(true); const t = maps.trainings.get("w1"); t.date = day(-2);
  const { more } = missRow(t); more.fire("click", { stopPropagation() {}, detail: 1 });
  const rows = pop.children.map(label), open = bg.hidden === false;
  pop.children.find((b) => label(b) === "Skip").fire("click", { stopPropagation() {} });
  out.missed = { rows, open, asked: sheet.hidden === false, asking: !!app.get().asking, skippedAtOnce: !!t.skippedAt, menuClosed: bg.hidden === true };
  await advance(400); skGo.fire("click", {});
  out.missed.after = { skipped: !!t.skippedAt, missed: t.missed, pending: maps.pendingSkip.has("w1"), closed: sheet.hidden === true }; }
{ clientPage(true); const t = maps.trainings.get("w1"); t.date = day(-2);
  const { more } = missRow(t); more.fire("click", { stopPropagation() {}, detail: 1 }); pop.children.find((b) => label(b) === "Skip").fire("click", { stopPropagation() {} });
  await advance(400); skKeep.fire("click", { detail: 1 }); out.missed.keep = { skipped: !!t.skippedAt, closed: sheet.hidden === true }; }
// ---------- its Do it today, from the same "…" ----------
{ clientPage(true); const t = maps.trainings.get("w1"); t.date = day(-2);
  const { more } = missRow(t); more.fire("click", { stopPropagation() {}, detail: 1 }); pop.children.find((b) => label(b) === "Do it today").fire("click", { stopPropagation() {} });
  out.missed.today = { date: t.date === fns.today(), moved: maps.pendingMove.has("w1"), decided: maps.pendingMiss.has("w1") || t.missed !== undefined, closed: bg.hidden === true }; }
// ---------- the Missed card's Skip all: its own button asks first; Cancel skips nothing, Skip all both ----------
{ clientPage(false); maps.trainings.get("w1").date = day(-2); maps.trainings.set("w2", { ...maps.trainings.get("w1"), id: "w2", title: "Push", date: day(-4) }); fns.render();
  skipAllBtn.fire("click", {}); await flush();
  out.skipAll = { asked: askSheet.hidden === false, title: document.getElementById("askTitle").textContent };
  askNo.fire("click", {}); await flush();
  out.skipAll.cancelled = { skipped: ["w1", "w2"].filter((id) => !!maps.trainings.get(id).skippedAt), closed: askSheet.hidden === true };
  skipAllBtn.fire("click", {}); await advance(400); askYes.fire("click", {}); await flush();
  out.skipAll.done = ["w1", "w2"].filter((id) => !!maps.trainings.get(id).skippedAt); }

console.log(JSON.stringify(out));
process.exit(0);
