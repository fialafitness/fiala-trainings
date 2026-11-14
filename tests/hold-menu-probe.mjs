// Run by hold-menu.test.js in its own process: a finger held on a workout row and on a coach's exercise (the phone's right-click), as
// iOS 27.2 does it (measured on its Contacts and Home Screen, 10 Nov). The document and window keep their listeners, the menu, the dimmed
// page, the lifted copy and the sheets keep theirs, and every timer runs on this probe's own clock, so this loads the real app/main.js with
// recording stand-ins, plays the touches and prints, as JSON, what each one did. Events at an element go as a browser sends them (the document's
// capture listeners, the element's own, the document's bubbling ones), a passive listener's preventDefault does nothing (the document's
// and a page element's alike), and a page element hears its own events (a touch whose element a redraw took out of the page reaches only
// that element). A frame comes every 16 ms of the clock.
import { byId, el } from "./env.js";
import { ui } from "../app/state.js";
// the clock: every timer the app sets is this one's, and so is performance.now
let NOW = 10000, SEQ = 0; const Q = [];
globalThis.setTimeout = (fn, ms) => { const id = ++SEQ; Q.push({ id, at: NOW + Math.max(0, ms || 0), fn }); return id; };
globalThis.clearTimeout = (id) => { const i = Q.findIndex((q) => q.id === id); if (i >= 0) Q.splice(i, 1); };
try { performance.now = () => NOW; } catch (_) { Object.defineProperty(globalThis, "performance", { value: { now: () => NOW }, configurable: true }); }
{ const t0 = Date.now() - NOW; Date.now = () => t0 + NOW; }
globalThis.requestAnimationFrame = (fn) => setTimeout(() => fn(NOW), 16); globalThis.cancelAnimationFrame = (id) => clearTimeout(id);   // a frame every 16 ms of this clock (env.js's comes at once, and a loop that asks for the next frame would hold the clock still)
const flush = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };
async function advance(ms) {
  const end = NOW + ms;
  for (;;) { Q.sort((a, b) => a.at - b.at || a.id - b.id); const q = Q[0]; if (!q || q.at > end) break; Q.shift(); NOW = Math.max(NOW, q.at); q.fn(); await flush(); }
  NOW = end; await flush();
}
// the document and the window keep their listeners (and let them go)
const L = {}, WL = {};
const passiveOf = (t, o) => (o && typeof o === "object" && "passive" in o ? !!o.passive : /^(touchstart|touchmove|wheel|mousewheel)$/.test(t));   // (on the document a touchstart or touchmove listener is passive unless it says otherwise)
document.addEventListener = (t, fn, o) => { (L[t] ||= []).push({ fn, capture: o === true || !!(o && o.capture), passive: passiveOf(t, o) }); };
document.removeEventListener = (t, fn) => { const a = L[t] || []; const i = a.findIndex((x) => x.fn === fn); if (i >= 0) a.splice(i, 1); };
globalThis.addEventListener = (t, fn) => { (WL[t] ||= []).push(fn); };
globalThis.removeEventListener = (t, fn) => { const a = WL[t] || []; const i = a.indexOf(fn); if (i >= 0) a.splice(i, 1); };
let sheetUp = () => false;
const qs = document.querySelector; document.querySelector = (s) => (/sheet-bg/.test(s) ? (sheetUp() ? {} : null) : /crop-view|header \.bar/.test(s) ? null : qs(s));
document.contains = (x) => !!x;
document.documentElement.clientWidth = 402; globalThis.innerHeight = 812;   // an iPhone 17 Pro's page: 402 wide, 812 tall under the clock
let pointAt = () => null; document.elementFromPoint = (x, y) => pointAt(x, y);
function fire(type, ev) {                                                   // an event at the document: its capture listeners, then its bubbling ones
  let stopped = false, passive = false; ev.type = type; ev.defaultPrevented = false;
  ev.preventDefault = () => { if (!passive) ev.defaultPrevented = true; }; ev.stopPropagation = () => {}; ev.stopImmediatePropagation = () => { stopped = true; ev.stoppedAll = true; };
  if (ev.timeStamp == null) ev.timeStamp = NOW;
  const ls = L[type] || []; for (const l of [...ls.filter((x) => x.capture), ...ls.filter((x) => !x.capture)]) { if (stopped) break; passive = l.passive; l.fn(ev); }
  return ev;
}
function dispatch(type, target, ev = {}) {                                 // an event at an element, as a browser sends it: the document's capture listeners, the element's own, the document's bubbling ones
  let stopped = false, halted = false, passive = false; ev.type = type; ev.target = target; ev.defaultPrevented = false;
  ev.preventDefault = () => { if (!passive && !ev.__passive) ev.defaultPrevented = true; }; ev.stopPropagation = () => { halted = true; }; ev.stopImmediatePropagation = () => { stopped = halted = true; ev.stoppedAll = true; };   // (__passive: the element's own listener that runs is passive)
  if (ev.timeStamp == null) ev.timeStamp = NOW;
  const ls = L[type] || [];
  for (const l of ls.filter((x) => x.capture)) { if (stopped) break; passive = l.passive; l.fn(ev); }
  passive = false; if (!halted && target && target.fire) target.fire(type, ev);
  if (!halted) for (const l of ls.filter((x) => !x.capture)) { if (stopped) break; passive = l.passive; l.fn(ev); }
  return ev;
}
function own(target, type, ev) {                                           // an event that reaches only its element (taken out of the page by a redraw: the document no longer hears it)
  ev.type = type; ev.target = target; ev.defaultPrevented = false; ev.preventDefault = () => { if (!ev.__passive) ev.defaultPrevented = true; }; ev.stopPropagation = () => {}; ev.stopImmediatePropagation = () => {};
  if (ev.timeStamp == null) ev.timeStamp = NOW; target.fireOwn(type, ev); return ev;
}
const fireWin = (type, ev = {}) => { for (const fn of [...(WL[type] || [])]) fn(ev); };
// the page's own elements: they keep what is put in them and their listeners
const kids = (e) => {
  e.replaceChildren = (...k) => { e.children = k; e.firstElementChild = k[0] || null; };
  e.appendChild = (c) => { e.children = [...e.children, c]; e.firstElementChild = e.children[0]; return c; };
  e.append = (...k) => { e.children = [...e.children, ...k]; e.firstElementChild = e.children[0] || null; };
  return e;
};
const listens = (e) => { const H = {}; e.addEventListener = (type, fn) => { (H[type] ||= []).push(fn); }; e.removeEventListener = (type, fn) => { const a = H[type] || []; const i = a.indexOf(fn); if (i >= 0) a.splice(i, 1); }; e.fire = (type, ev) => { for (const fn of [...(H[type] || [])]) fn(ev); }; e.focus = () => { document.activeElement = e; }; return e; };
const recorder = (id, extra = {}) => { const e = listens(kids(el("div"))); Object.assign(e, extra); byId.set(id, e); return e; };
for (const id of ["calView", "calTrack", "calTitle", "calToday", "calPrev", "calNext", "calWrap", "dpPrev", "dpNext", "dpToday", "datePick", "dpCancel"]) recorder(id, { clientWidth: 350 });
recorder("dpGrid", { clientWidth: 350, setPointerCapture() {} });
const pop = recorder("whenPop", { offsetHeight: 108 });
Object.defineProperty(pop, "offsetWidth", { get() { pop.measuredLeft = pop.style.left; return 243; }, configurable: true });   // (and where it stood when it was measured)
pop.style.setProperty = (k, v) => { pop.style[k] = v; };
pop.querySelector = (sel) => (sel === ".wopt" ? pop.children.find((c) => /\bwopt\b/.test(c.className)) || null : null); pop.contains = (x) => !!x && pop.children.includes(x);
const bg = recorder("whenBg"); bg.hidden = true;
const dim = recorder("ctxDim", { offsetWidth: 402 }); dim.hidden = true;
const box = recorder("ctxLift", { offsetWidth: 0 }); box.hidden = true;
box.getBoundingClientRect = () => {                                         // where the lifted copy is: its place, moved and scaled about its centre by its transform
  const l = parseFloat(box.style.left) || 0, t = parseFloat(box.style.top) || 0, w = parseFloat(box.style.width) || 0, h = parseFloat(box.style.height) || 0, tf = box.style.transform || "";
  const m = /translateY\(([-\d.e]+)px\)/.exec(tf), k = /scale\(([-\d.e]+)\)/.exec(tf), dy = m ? +m[1] : 0, sc = k ? +k[1] : 1, cx = l + w / 2, cy = t + h / 2 + dy;
  return { left: cx - w * sc / 2, right: cx + w * sc / 2, top: cy - h * sc / 2, bottom: cy + h * sc / 2, width: w * sc, height: h * sc };
};
const sheet = recorder("skipSheet"); sheet.hidden = true; recorder("skGo"); recorder("skKeep"); recorder("skReasons");
const make = document.createElement; document.createElement = (t) => { const e = listens(kids(make(t))); e.closest = (sel) => (/\.wopt\b/.test(sel) && /\bwopt\b/.test(e.className || "") ? e : null); e.click = () => dispatch("click", e, {}); return e; };   // (a menu row knows it is one, and a click() on it goes as a browser's does, past the document's capture listeners)
globalThis.getComputedStyle = (node) => {                                // the dimmed page carries the safe areas as its padding (none above in a home-screen app, the home indicator's 34 below)
  if (node === dim) return { paddingTop: "0px", paddingBottom: "34px", getPropertyValue: () => "" };
  const m = /translate3d\(([-\d.e]+)px/.exec((node && node.style && node.style.transform) || "");
  return { transform: m ? "matrix(1, 0, 0, 1, " + Number(m[1]) + ", 0)" : "none", borderTopLeftRadius: (node && node.radius) || "0px", borderTopWidth: (node && node.bt) || "0px", backgroundColor: (node && node.bg) || "rgba(0, 0, 0, 0)", getPropertyValue: () => "", display: node && node.gone ? "none" : "block", color: "" };
};
const app = (await import("../app/main.js")).internals();
const { fns, maps } = app;
sheetUp = () => !!fns.datePicker();
const day = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return fns.localIso(d); };

// things on the page that know where they are, and can be copied, for the touches' targets and the lifted copy
const ROOT = { tagName: "HTML", parentElement: null };
const matches = (n, sel) => sel.split(",").some((part) => {
  const p = part.trim(); if (p === "*") return true; if (p === "[id]") return !!n.id; if (p === "[contenteditable]") return false;
  const m = p.match(/^([a-z]+)?(#[\w-]+)?((?:\.[\w-]+)*)$/i); if (!m) return false;
  const [, tag, id, cls] = m;
  return (!tag || n.tagName === tag.toUpperCase()) && (!id || n.id === id.slice(1)) && (cls || "").split(".").filter(Boolean).every((c) => n.classList.contains(c));
});
function mk(tag, classes = [], id = "", rect = null) {
  const set = new Set(classes), H = {};
  const n = { nodeType: 1, tagName: tag.toUpperCase(), id, children: [], parentElement: null, dataset: {}, style: {}, value: "", rect,
    addEventListener(t, fn, o) { const rec = { fn, passive: !!(o && typeof o === "object" && o.passive) }; (H[t] ||= []).push(rec); if (o && o.signal) o.signal.addEventListener("abort", () => { const a = H[t] || [], i = a.indexOf(rec); if (i >= 0) a.splice(i, 1); }); },
    removeEventListener(t, fn) { const a = H[t] || [], i = a.findIndex((r) => r.fn === fn); if (i >= 0) a.splice(i, 1); },
    fireOwn(t, ev) { for (const r of [...(H[t] || [])]) { ev.__passive = r.passive; r.fn(ev); } ev.__passive = false; }, fire(t, ev) { n.fireOwn(t, ev); }, listening() { return Object.values(H).reduce((a, x) => a + x.length, 0); },
    get className() { return [...set].join(" "); }, get firstElementChild() { return n.children[0] || null; },
    classList: { add: (...c) => c.forEach((x) => set.add(x)), remove: (...c) => c.forEach((x) => set.delete(x)), toggle: (c, f) => { const on = f === undefined ? !set.has(c) : !!f; if (on) set.add(c); else set.delete(c); return on; }, contains: (c) => set.has(c) },
    append(...k) { for (const c of k) { c.parentElement = n; n.children.push(c); } },
    removeAttribute(a) { if (a === "id") n.id = ""; },
    replaceWith(o) { const p = n.parentElement; if (!p) return; const i = p.children.indexOf(n); p.children[i] = o; o.parentElement = p; n.parentElement = null; },
    get isConnected() { let p = n; while (p.parentElement) p = p.parentElement; return p === ROOT; },
    querySelector(sel) { return n.querySelectorAll(sel)[0] || null; },
    querySelectorAll(sel) { const out = []; const walk = (x) => { for (const c of x.children || []) { if (c.nodeType === 1 && matches(c, sel)) out.push(c); if (c.children) walk(c); } }; walk(n); return out; },
    closest(sel) { for (let p = n; p && p !== ROOT; p = p.parentElement) if (matches(p, sel)) return p; return null; },
    contains(o) { for (let p = o; p; p = p.parentElement) if (p === n) return true; return false; },
    cloneNode() { const c = mk(tag, [...set], n.id, n.rect); c.value = n.value; c.offsetWidth = n.offsetWidth; c.offsetHeight = n.offsetHeight; for (const k of n.children) c.append(k.cloneNode ? k.cloneNode(true) : k); return c; },
    getBoundingClientRect() { const r = n.rect || { left: 17, top: 500, width: 368, height: 76 }; return { ...r, right: r.left + r.width, bottom: r.top + r.height }; },
    getClientRects() { return n.gone ? [] : [n.getBoundingClientRect()]; },   // (gone: the page's rules hide it, display none)
    tabIndex: /^(INPUT|TEXTAREA|SELECT|BUTTON|A)$/i.test(tag) ? 0 : -1, focus() { if (/^(BUTTON|INPUT|TEXTAREA)$/.test(n.tagName)) document.activeElement = n; } };
  return n;
}
const onPage = (n) => { n.parentElement = ROOT; return n; };
const elsewhere = onPage(mk("div"));

// the client page with a workout tomorrow (Up next), and that row on the page, with the real row's menu and its open
const clientPage = (clientMode = true) => {
  app.reset(); app.set({ signedIn: true, clientMode, myClientId: clientMode ? "c1" : null, tab: "workouts" });
  maps.clients.set("c1", { id: "c1", name: "Jane", unit: "lb" });
  maps.trainings.set("w1", { id: "w1", clientId: "c1", title: "Legs", date: day(1), createdAt: "2026-11-01T10:00:00.000Z", completedAt: null, skippedAt: null, rows: [] });
  app.set({ view: { name: "client", id: "c1" } }); fns.render();
};
const rowOnPage = (top = 500, clientMode = true) => {
  clientPage(clientMode); pointAt = () => null;
  const real = fns.workoutRow(maps.trainings.get("w1"), "next", true), list = onPage(mk("ul", ["list"]));
  const li = mk("li", ["w", "swipe-row"], "", { left: 17, top, width: 368, height: 76 }), b = mk("button"), pri = mk("span", ["pri"]), acts = mk("div", ["swipe-acts"]), sa = mk("button", ["swipe-act", "sa-skip"]), sb = mk("button", ["swipe-act", "sa-resched"]);
  li.bt = "1px";                                                                   // (not its list's first: the hairline above it, li + li)
  sa.append(mk("span", ["sa-cap"])); sb.append(mk("span", ["sa-cap"]));                // (the swipe's own two, each with its capsule: a row its swipe can take)
  b.append(pri); acts.append(sa, sb); li.append(b, acts); list.append(li); li._ctx = real._ctx; li.dataset.tid = "w1";
  return { li, pri, sa, list };
};
const T = (x, y, id = 1) => ({ identifier: id, clientX: x, clientY: y });
const down = (target, x = 200, y = 538, more = []) => fire("touchstart", { target, touches: [T(x, y), ...more], changedTouches: [T(x, y)], cancelable: true });
const move = (target, x, y, more = []) => fire("touchmove", { target, touches: [T(x, y), ...more], changedTouches: [T(x, y)], cancelable: true });
const up = (target, x = 200, y = 538) => fire("touchend", { target, touches: [], changedTouches: [T(x, y)], cancelable: true });
let FID = 1;
function tap2(target, x, y) {                                               // a new finger's tap, as WebKit sends one: press, touch, press up, touch up, and its click unless the touch's end was cancelled
  const id = ++FID, p = { target, pointerType: "touch", isPrimary: true, button: 0, clientX: x, clientY: y };
  fire("pointerdown", { ...p }); fire("touchstart", { target, touches: [T(x, y, id)], changedTouches: [T(x, y, id)], cancelable: true });
  fire("pointerup", { ...p }); const e = fire("touchend", { target, touches: [], changedTouches: [T(x, y, id)], cancelable: true });
  return e.defaultPrevented ? null : dispatch("click", target, { clientX: x, clientY: y });
}
const nextList = document.getElementById("nextList"); let drawn = 0; nextList.replaceChildren = () => { drawn++; };   // the client page's Up next, redrawn
const state = () => ({ hold: fns.holdState(), menu: bg.hidden === false, labels: bg.hidden ? null : pop.children.map((c) => (c.children.at(-1) || {}).textContent), lifted: box.hidden === false, grown: box.style.transform || "", dim: dim.hidden === false && dim.classList.contains("on") });
const reset = async () => { fire("keydown", { key: "Escape" }); await advance(1000); };
const out = {};

// ---------- a workout row ----------
out.row = {};
{ const r = rowOnPage(); down(r.pri); await advance(99); out.row.at99 = state(); await advance(2); out.row.at101 = state(); await advance(298); out.row.at399 = state(); await advance(2);
  out.row.at401 = state(); out.row.at401.lift = pop.classList.contains("lift"); out.row.at401.hung = pop.classList.contains("hung"); out.row.at401.place = { left: pop.style.left, top: pop.style.top, moved: box.style.transform, liftOff: pop.style["--lift-off"] };
  const u = up(r.pri); out.row.release = { kept: u.defaultPrevented, ...state() };
  const c = fire("click", { target: r.pri }); out.row.release.clickEaten = c.defaultPrevented && !!c.stoppedAll;
  const later = fire("click", { target: r.pri }); out.row.release.secondClick = later.defaultPrevented;   // (only the release's own click)
  await advance(500); out.row.stays = state();
  pointAt = () => dim; tap2(dim, 200, 120); out.row.dimTap = { ...state(), back: box.classList.contains("lp-back"), headerBack: box.classList.contains("back"), dimShown: dim.hidden === false };
  await advance(300); out.row.dimTap.after = state(); out.row.dimTap.view = app.get().view.name; }
{ const r = rowOnPage(); down(r.pri); await advance(500); up(r.pri);                 // a tap on the lifted row: it opens, as Apple's open what they lift
  tap2(dim, 200, 530); await advance(300);
  out.row.liftTap = { view: app.get().view.name, id: app.get().view.id, ...state() }; }
{ const r = rowOnPage(); down(r.pri); await advance(300); const u = up(r.pri); await advance(300);   // let go at 0.3 s: a tap, as ever
  out.row.early = { kept: u.defaultPrevented, ...state() }; const c = fire("click", { target: r.pri }); out.row.early.clickEaten = c.defaultPrevented; }
{ const r = rowOnPage(); down(r.pri); await advance(150); const dm = move(r.pri, 205, 545); await advance(300);   // 8.6 points of drift: still the menu (measured: 8 keep it); before the menu a move is the page's
  out.row.drift8 = { ...state(), moveKept: dm.defaultPrevented }; await reset(); }
{ const r = rowOnPage(); down(r.pri); await advance(150); move(r.pri, 200, 550); await advance(300);   // 12 points: a scroll (measured: 16 lose it), and the lifted copy is down at once
  out.row.drift12 = state(); up(r.pri, 200, 550); await reset(); }
{ const r = rowOnPage(); down(r.pri); await advance(150); move(r.pri, 200, 538, [T(300, 600, 2)]); await advance(300);   // a second finger
  out.row.twoFingers = state(); await reset(); }
{ const r = rowOnPage(); down(r.pri); await advance(150); fireWin("scroll"); await advance(300); out.row.scrolled = state(); await reset(); }   // the page scrolled under the finger
{ const r = rowOnPage(); down(r.sa); await advance(500); out.row.onAction = state(); up(r.sa); await reset(); }   // the swipe's own buttons are not the row
{ const r = rowOnPage(); fns.showWhen(onPage(mk("button")), [{ k: "Best", v: "225 lb", d: "Oct 8" }]); down(r.pri); await advance(500);   // a bubble is up: this touch only closes it
  out.row.underBubble = { ...state(), labels: null, holdNone: fns.holdState() === null }; up(r.pri); await reset(); }
{ const r = rowOnPage(); const f = onPage(mk("input")); document.activeElement = f; down(r.pri); await advance(500);   // typing: no hold while the keyboard is up
  out.row.typing = state(); up(r.pri); document.activeElement = null; await reset(); }
{ const r = rowOnPage(); maps.trainings.get("w1").completedAt = "2026-11-02T18:00:00.000Z"; down(r.pri); await advance(500);   // finished meanwhile: nothing to hold
  out.row.finished = state(); up(r.pri); await reset(); }
{ const r = rowOnPage(); down(r.pri); await advance(200); maps.trainings.get("w1").completedAt = "2026-11-02T18:00:00.000Z"; await advance(300);   // finished during the hold (a sync): no menu, the copy down
  out.row.finishedDuring = state(); up(r.pri); await reset(); }
{ const r = rowOnPage(); const f = onPage(mk("input")); document.activeElement = f; down(r.pri); await advance(200);   // typing: not even the lift
  out.row.typingLift = state(); up(r.pri); document.activeElement = null; await reset(); }
{ const r = rowOnPage(); fns.showWhen(onPage(mk("button")), [{ k: "Best", v: "225 lb", d: "Oct 8" }]); down(r.pri); await advance(200);   // a bubble up: not even the lift
  out.row.bubbleLift = state(); up(r.pri); await reset(); }
{ const r = rowOnPage(); down(r.pri); await advance(500); move(r.pri, 150, 539); move(r.pri, 90, 540);   // the finger goes clearly sideways after the menu came: the row does not slide under it
  out.row.sideways = { swipe: fns.rowSwipe(), menu: bg.hidden === false }; up(r.pri, 90, 540); await reset(); }
// the finger slides onto a row of the menu and lets go there: that row, as the Home Screen's menu takes it
{ const r = rowOnPage(); down(r.pri); await advance(500);
  const skip = pop.children[1]; pointAt = (x, y) => (y > 640 ? skip : elsewhere);
  const m1 = move(r.pri, 120, 600); const over1 = skip.classList.contains("lp-over"); const m2 = move(r.pri, 120, 700); const over2 = skip.classList.contains("lp-over");
  const u = up(r.pri, 120, 700); const liftedAtPick = box.hidden === false, dimAtPick = dim.hidden === false; await advance(400);
  out.row.slide = { over1, over2, movesKept: [m1.defaultPrevented, m2.defaultPrevented], kept: u.defaultPrevented, liftedAtPick, dimAtPick, sheet: sheet.hidden === false, asking: !!app.get().asking, overOff: !skip.classList.contains("lp-over"), ...state() }; fns.closeSkip(); await reset(); }
{ const r = rowOnPage(); down(r.pri); await advance(500);                              // slid onto a row and off it again: nothing picked, the menu stays
  const resched = pop.children[0]; pointAt = (x, y) => (y > 640 && y < 680 ? resched : elsewhere);
  move(r.pri, 120, 660); const over = resched.classList.contains("lp-over"); move(r.pri, 120, 760); const off = !resched.classList.contains("lp-over"); up(r.pri, 120, 760); await advance(400);
  out.row.slideOff = { over, off, picker: !!fns.datePicker(), ...state() }; await reset(); }
{ const r = rowOnPage(); down(r.pri); await advance(500); const ev = fire("contextmenu", { target: r.pri, pointerType: "touch", clientX: 200, clientY: 538 });   // Android's long press comes after: its own menu never shows over this one, and this one stays
  out.row.androidMenu = { kept: ev.defaultPrevented, ...state() }; up(r.pri); await reset(); }
{ const r = rowOnPage(); down(r.pri); await advance(200); const ev = fire("contextmenu", { target: r.pri, pointerType: "touch", clientX: 200, clientY: 538 });   // or before it: the hold goes on
  await advance(300); out.row.androidEarly = { kept: ev.defaultPrevented, ...state() }; up(r.pri); await reset(); }
{ const r = rowOnPage(); down(r.pri); await advance(500); up(r.pri);                 // a right-click elsewhere while a held row's menu is up (an iPad's trackpad): it closes, as any menu
  const ev = fire("contextmenu", { target: elsewhere, pointerType: "mouse", clientX: 50, clientY: 50 }); await advance(300); out.row.mouseCtx = { closed: bg.hidden === true }; await reset(); }
{ const r = rowOnPage(); down(r.pri); await advance(500);                             // the lifted copy: the row's own look, in its list (for its styles), no ids
  const w = box.children[0]; out.row.copy = { wrap: w && w.tagName + " " + w.className + " " + (w.classes && w.classes.has("lp-wrap")), row: w && w.children[0] && w.children[0].className, sameNode: !!w && w.children[0] === r.li, width: w && w.children[0] && w.children[0].style.width, border: w && w.children[0] && w.children[0].style.borderTop, platter: box.style.background };
  up(r.pri); await reset(); }
{ const r = rowOnPage(); const ev = fire("contextmenu", { target: r.pri, pointerType: "touch", clientX: 200, clientY: 538 });   // no hold under way: a long press's contextmenu stays the browser's
  out.row.androidAlone = { kept: ev.defaultPrevented, menu: bg.hidden === false }; await reset(); }
{ const r = rowOnPage(); down(r.pri); await advance(500); up(r.pri);                 // a tap on the dimmed page whose click never comes: it closes anyway
  const pd = fire("pointerdown", { target: dim, pointerType: "touch", isPrimary: true, button: 0, clientX: 200, clientY: 120 }); fire("pointerup", { target: dim, pointerType: "touch", isPrimary: true, button: 0, clientX: 200, clientY: 120 });
  const md = fire("mousedown", { target: dim, button: 0, clientX: 200, clientY: 120 });   // (WebKit's mousedown comes after the touch's end)
  out.row.dimPress = { pdCancelled: pd.defaultPrevented, mdEaten: md.defaultPrevented };
  await advance(590); const at590 = bg.hidden === false; await advance(20); out.row.noClick = { at590, at610: bg.hidden === false }; await reset(); }
{ const r = rowOnPage(); down(r.pri); await advance(500); up(r.pri); fire("keydown", { key: "Escape" }); await advance(300); out.row.escape = state(); }
{ const r = rowOnPage(740); down(r.pri, 200, 778); await advance(500);               // a row near the bottom: it moves up with its menu until the menu fits above the home indicator
  out.row.low = { top: pop.style.top, moved: box.style.transform, liftOff: pop.style["--lift-off"] }; up(r.pri, 200, 778); await reset(); }

// the review's findings, 10 Nov
const menuAt = (x, y) => { const top = parseFloat(pop.style.top), left = parseFloat(pop.style.left), i = Math.floor((y - top - 12) / 42);   // what is under a point: a row of the menu (12 in, 42 a row), else the page
  return x >= left && x <= left + 243 && i >= 0 && i < pop.children.length ? pop.children[i] : elsewhere; };
{ const r = rowOnPage(680); pointAt = menuAt; down(r.pri, 200, 718); await advance(500);   // held near the bottom: the row and its menu move up, and the menu comes to lie under the still finger
  const under = menuAt(200, 718), lit = under !== elsewhere && under.classList.contains("lp-over"); out.row.jitterKept = move(r.pri, 202, 721).defaultPrevented; const litJitter = under !== elsewhere && under.classList.contains("lp-over");
  const u = up(r.pri, 202, 721); await advance(400);
  out.row.stillUnder = { underMenu: under !== elsewhere, lit, litJitter, kept: u.defaultPrevented, picked: !!fns.datePicker() || !!app.get().asking, ...state() }; fns.closeSkip(); fns.closeDatePicker(); await reset(); }
{ const r = rowOnPage(680); pointAt = menuAt; down(r.pri, 200, 718); await advance(500);   // the same finger, slid off and back onto a row: now it picks
  move(r.pri, 200, 640); move(r.pri, 120, 718); const u = up(r.pri, 120, 718); await advance(400);
  out.row.slidBack = { kept: u.defaultPrevented, picked: !!fns.datePicker() || !!app.get().asking }; fns.closeSkip(); fns.closeDatePicker(); await reset(); }
{ const r = rowOnPage(); down(r.pri); await advance(500); fire("keydown", { key: "Escape" }); await advance(300);   // the menu closed while the finger is still down (Escape, a turn of the phone): its release still clicks nothing
  const u = up(r.pri); const c = fire("click", { target: r.pri }); out.row.closedUnder = { kept: u.defaultPrevented, clickEaten: c.defaultPrevented, ...state() }; await reset(); }
{ const r = rowOnPage(); down(r.pri); await advance(200); move(r.pri, 191, 538); await advance(250);   // the row's swipe takes the finger (9 points to the left) just before 0.4 s: no menu, the swipe keeps it
  out.row.swipeFirst = { swipe: !!fns.rowSwipe(), ...state() }; up(r.pri, 191, 538); await advance(600); await reset(); }
{ const r = rowOnPage(); down(r.pri); await advance(500); up(r.pri);                 // a tap on the lifted workout: the copy and the dim go at once, not over the workout that opens
  tap2(dim, 200, 530);
  out.row.liftTapNow = { view: app.get().view.name, lifted: box.hidden === false, dim: dim.hidden === false }; await reset(); }

// the second review's findings, 10 Nov
// a sync's redraw while the held menu is up and its finger still down waits for that finger (the row is not rebuilt under it, so its release
// stays the hold's) and comes once its click would have; the menu gone with the finger still down, it still waits; after 10 s it goes through
{ const r = rowOnPage(); const d0 = drawn; down(r.pri); await advance(500); ui.render(); const whileDown = drawn - d0;
  up(r.pri); const atUp = drawn - d0; await advance(399); const at399 = drawn - d0; await advance(2); out.row.redraw = { whileDown, atUp, at399, at401: drawn - d0 }; await reset(); }
{ const r = rowOnPage(); const d0 = drawn; down(r.pri); await advance(500); fire("keydown", { key: "Escape" }); ui.render(); await advance(300);
  const gone = drawn - d0, listening = r.pri.listening(); up(r.pri); await advance(401); out.row.redrawGone = { gone, listening, afterUp: drawn - d0, after: r.pri.listening() }; await reset(); }
{ const r = rowOnPage(); const d0 = drawn; down(r.pri); await advance(500); ui.render(); const first = drawn - d0; await advance(9800); ui.render(); const at9_9s = drawn - d0; await advance(200); ui.render();
  out.row.redrawCap = { first, at9_9s, after10s: drawn - d0 }; up(r.pri); await reset(); }
{ const r = rowOnPage(); const d0 = drawn; down(r.pri); await advance(500); const before = r.pri.listening(); ui.render();   // a redraw that does not wait took the row out of the page: its finger's moves and release are heard on the row itself (and a sync's redraw that waited comes after)
  r.list.parentElement = null;
  const mv = own(r.pri, "touchmove", { target: r.pri, touches: [T(200, 560)], changedTouches: [T(200, 560)], cancelable: true });
  const u = own(r.pri, "touchend", { target: r.pri, touches: [], changedTouches: [T(200, 560)], cancelable: true }); const c = fire("click", { target: r.pri });
  const atUp = drawn - d0; await advance(401);
  out.row.detached = { before, moveKept: mv.defaultPrevented, kept: u.defaultPrevented, clickEaten: c.defaultPrevented && !!c.stoppedAll, down: (fns.holdState() || {}).down, after: r.pri.listening(), atUp, at401: drawn - d0 }; await reset(); }
{ const r = rowOnPage(); const d0 = drawn; down(r.pri); await advance(500); ui.render(); up(r.pri); await advance(401); const redrawn = drawn - d0; if (redrawn) r.list.parentElement = null;   // the redraw that waited came while the menu was up (the row rebuilt): the close takes the copy at once
  await advance(300); tap2(dim, 200, 120); out.row.closeAfterRedraw = { redrawn, menu: bg.hidden === false, lifted: box.hidden === false }; await reset(); }
{ const r = rowOnPage(); down(r.pri); await advance(300); up(r.pri); out.row.tapLets = r.pri.listening(); await reset(); }   // a tap: its listeners on the row go with it
{ const r = rowOnPage(); const d0 = drawn; down(r.pri); await advance(500); fire("keydown", { key: "Escape" }); await advance(300);   // a release that never reached the app (the menu gone, the finger's end lost): the next lone touch lets go of it
  const t9 = [T(100, 300, 9)]; fire("touchstart", { target: elsewhere, touches: t9, changedTouches: t9, cancelable: true }); ui.render();
  out.row.lostRelease = { drawn: drawn - d0, listening: r.pri.listening() }; fire("touchend", { target: elsewhere, touches: [], changedTouches: t9, cancelable: true }); await reset(); }
// a second finger while the hold's finger is still down (only a lone touch says no earlier finger is): that finger's release stays the hold's
{ const r = rowOnPage(); const d0 = drawn; down(r.pri); await advance(500); ui.render();   // the menu up, a sync waiting; a second finger taps the dim
  const p2 = { target: dim, pointerType: "touch", isPrimary: false, button: 0, clientX: 200, clientY: 120 };
  fire("pointerdown", { ...p2 }); fire("touchstart", { target: dim, touches: [T(200, 538, 1), T(200, 120, 6)], changedTouches: [T(200, 120, 6)], cancelable: true });
  const redrawnAtFinger2 = drawn - d0; if (redrawnAtFinger2) r.list.parentElement = null;
  fire("pointerup", { ...p2 }); const e2 = fire("touchend", { target: dim, touches: [T(200, 538, 1)], changedTouches: [T(200, 120, 6)], cancelable: true });
  if (!e2.defaultPrevented) dispatch("click", dim, { clientX: 200, clientY: 120 });
  const listening = r.pri.listening(), relEv = { target: r.pri, touches: [], changedTouches: [T(200, 538, 1)], cancelable: true };
  const rel = r.list.parentElement ? fire("touchend", relEv) : own(r.pri, "touchend", relEv); const c = fire("click", { target: elsewhere });
  out.row.secondFinger = { redrawnAtFinger2, listening, releaseCancelled: rel.defaultPrevented, clickEaten: c.defaultPrevented && !!c.stoppedAll }; await reset(); }
{ const r = rowOnPage(); down(r.pri); await advance(500); fire("keydown", { key: "Escape" }); await advance(300);   // the menu gone first, and another finger comes and goes while the hold's is still down
  fire("touchstart", { target: elsewhere, touches: [T(200, 538, 1), T(100, 300, 7)], changedTouches: [T(100, 300, 7)], cancelable: true });
  fire("touchend", { target: elsewhere, touches: [T(200, 538, 1)], changedTouches: [T(100, 300, 7)], cancelable: true });
  const u = up(r.pri); const c = fire("click", { target: r.pri }); out.row.secondFingerGone = { releaseCancelled: u.defaultPrevented, clickEaten: c.defaultPrevented && !!c.stoppedAll }; await reset(); }

// the row's swipe or the swipe back taking the finger lets the hold go on that very move, lifted or not
{ const r = rowOnPage(); down(r.pri); await advance(50); move(r.pri, 191, 538); const atTake = state(); await advance(100);   // the row's swipe takes it 9 points to the left at 0.05 s; the finger rests
  out.row.takenEarly = { swipe: !!fns.rowSwipe(), atTake, at150: state() }; up(r.pri, 191, 538); await advance(600); await reset(); }
{ const r = rowOnPage(); down(r.pri); await advance(150); const lifted = box.hidden === false; move(r.pri, 191, 538);   // lifted first, then taken
  out.row.takenLate = { lifted, swipe: !!fns.rowSwipe(), now: state() }; up(r.pri, 191, 538); await advance(600); await reset(); }
const backOn = () => { fns.forceSwipe(true); document.getElementById("back").hidden = false; };   // the home-screen app on a page with Back: the swipe back is on
const cancel = (target, x, y) => fire("touchcancel", { target, touches: [], changedTouches: [T(x, y)], cancelable: false });
{ const r = rowOnPage(500, false); backOn(); down(r.pri); await advance(50); move(r.pri, 209, 538); const atTake = state(), held = !!(fns.swipeState() || {}).held; await advance(100);   // the swipe back takes it, 9 points to the right
  out.row.backEarly = { held, atTake, at150: state() }; cancel(r.pri, 209, 538); fns.forceSwipe(false); await reset(); }
{ const r = rowOnPage(500, false); backOn(); down(r.pri); await advance(150); const lifted = box.hidden === false; move(r.pri, 209, 538);
  out.row.backLate = { lifted, held: !!(fns.swipeState() || {}).held, now: state() }; cancel(r.pri, 209, 538); fns.forceSwipe(false); await reset(); }
{ const r = rowOnPage(500, false); backOn(); down(r.pri); await advance(500); move(r.pri, 215, 540); move(r.pri, 230, 541); move(r.pri, 260, 542);   // after the menu came, sliding right: the page does not swipe back under it
  out.row.backAfterMenu = { sw: fns.swipeState(), menu: bg.hidden === false }; up(r.pri, 260, 542); fns.forceSwipe(false); await reset(); }
{ const r = rowOnPage(500, false); backOn(); down(r.pri); move(r.pri, 209, 538); await advance(16); move(r.pri, 230, 538); await advance(16); move(r.pri, 240, 538); await advance(16);
  up(r.pri, 240, 538); await advance(30); const sw = fns.swipeState();                   // a swipe back let go: while the pages settle, a touch holds nothing
  fire("touchstart", { target: r.pri, touches: [T(200, 538, 7)], changedTouches: [T(200, 538, 7)], cancelable: true }); const hold = fns.holdState(); await advance(150);
  out.row.whileSettling = { settling: !!sw && (sw.on || sw.busy), hold, at150: state() }; fire("touchend", { target: r.pri, touches: [], changedTouches: [T(200, 538, 7)], cancelable: true });
  await advance(3500); fns.forceSwipe(false); await reset(); }
{ const r = rowOnPage(); down(r.pri, 300, 538); for (let x = 290; x >= 150; x -= 10) { move(r.pri, x, 538); await advance(16); } await advance(200); up(r.pri, 150, 538); await advance(800);   // a row swiped open: a touch on it only closes it
  const open = !!(fns.rowSwipe() || {}).open; down(r.pri, 100, 538); const hold = fns.holdState(); await advance(500);
  out.row.rowOpen = { open, hold, at500: state() }; up(r.pri, 100, 538); await advance(800); await reset(); }
// what comes during the hold: the phone turned (the menu closes; a copy whose item moved goes at once), typing, a question
{ const r = rowOnPage(); down(r.pri); await advance(500); up(r.pri); r.li.rect = { left: 17, top: 300, width: 800, height: 76 }; fireWin("resize");
  out.row.turned = { menu: bg.hidden === false, lifted: box.hidden === false, dimShown: dim.hidden === false }; await advance(300); out.row.turned.after = { lifted: box.hidden === false, dimShown: dim.hidden === false }; await reset(); }
{ const r = rowOnPage(); down(r.pri); await advance(200); const f = onPage(mk("input")); document.activeElement = f; await advance(250);
  out.row.typedDuring = state(); up(r.pri); document.activeElement = null; await reset(); }
{ const r = rowOnPage(); down(r.pri); await advance(200); app.set({ asking: { kind: "test" } }); await advance(250);
  out.row.askedDuring = state(); app.set({ asking: null }); up(r.pri); await reset(); }

// after the menu: the closing tap's copy settles back, but goes at once if the page moves under it or a new touch comes; the dim takes no touch
{ const r = rowOnPage(); down(r.pri); await advance(500); up(r.pri); await advance(500); tap2(dim, 200, 120); await advance(50);
  const settling = box.hidden === false; fireWin("scroll"); out.row.settleScroll = { settling, lifted: box.hidden === false, dimShown: dim.hidden === false };
  await advance(300); out.row.settleScroll.dimAfter = dim.hidden === false; await reset(); }
{ const r = rowOnPage(); down(r.pri); await advance(500); up(r.pri); await advance(500); tap2(dim, 200, 120); await advance(50);   // the phone turned 0.05 s into the settle: the copy at once (it would settle onto the row's old place)
  const settling = box.hidden === false; r.li.rect = { left: 17, top: 300, width: 800, height: 76 }; fireWin("resize"); out.row.settleResize = { settling, lifted: box.hidden === false, dimShown: dim.hidden === false };
  await advance(300); out.row.settleResize.dimAfter = dim.hidden === false; await reset(); }
{ const r = rowOnPage(); down(r.pri); await advance(500); up(r.pri); await advance(500); tap2(dim, 200, 120); await advance(50);
  const settling = box.hidden === false; fire("touchstart", { target: elsewhere, touches: [T(100, 300, 8)], changedTouches: [T(100, 300, 8)], cancelable: true });
  out.row.settleTouch = { settling, lifted: box.hidden === false, hold: fns.holdState(), dimShown: dim.hidden === false }; fire("touchend", { target: elsewhere, touches: [], changedTouches: [T(100, 300, 8)], cancelable: true }); await reset(); }
{ const r = rowOnPage(); down(r.pri); await advance(500); up(r.pri); r.li.rect = { left: 17, top: 420, width: 368, height: 76 }; fireWin("scroll");   // a scroll closed the menu, the row no longer where it was: its copy goes at once
  out.row.scrolledShut = { menu: bg.hidden === false, lifted: box.hidden === false }; await reset(); }
// a sync's redraw that comes while the copy settles back (one that waited for the finger, released 0.4 s after the release; or a new one) waits
// for the settle and comes as the copy goes: the copy never slides back over a row the redraw took away
const settleDraw = async (late) => {
  const r = rowOnPage(); const d0 = drawn; let copyAtDraw = null;
  nextList.replaceChildren = () => { drawn++; if (copyAtDraw === null) copyAtDraw = box.hidden === false; r.list.parentElement = null; };
  down(r.pri); await advance(500); if (!late) ui.render(); up(r.pri); await advance(late ? 50 : 250); tap2(dim, 200, 120);   // closed 0.25 s after the release (the waited redraw due at 0.4 s), or 0.05 s and a sync 0.1 s into the settle
  if (late) { await advance(100); ui.render(); await advance(150); } else await advance(250);
  const at250 = { drawn: drawn - d0, settling: box.hidden === false }; await advance(11);
  const o = { at250, at261: { drawn: drawn - d0, settling: box.hidden === false }, copyAtDraw };
  nextList.replaceChildren = () => { drawn++; }; await reset(); return o; };
out.row.settleDraw = { waited: await settleDraw(false), during: await settleDraw(true) };
// let go, and 0.15 s later a new finger's tap (WebKit sends no click for the cancelled release, so the release's click eater is still armed): it is that tap's
{ const r = rowOnPage(); down(r.pri); await advance(500); up(r.pri); await advance(150); const c = tap2(dim, 200, 120);
  out.row.quickDim = { menu: bg.hidden === false, view: app.get().view.name, eaten: !!(c && c.stoppedAll) }; await reset(); }
{ const r = rowOnPage(); down(r.pri); await advance(500); up(r.pri); await advance(150); tap2(dim, 200, 530); await advance(50);
  out.row.quickLift = { view: app.get().view.name }; await reset(); }
{ const r = rowOnPage(); down(r.pri); await advance(500); up(r.pri); await advance(150); tap2(pop.children[1], 120, 640);
  out.row.quickSkip = { asking: !!app.get().asking, sheet: sheet.hidden === false, menu: bg.hidden === false, lifted: box.hidden === false }; fns.closeSkip(); await reset(); }
// the moved-up copy is where a tap opens the workout; where the row was, a tap only closes
const lowTap = async (y) => { const r = rowOnPage(740); down(r.pri, 200, 778); await advance(500); up(r.pri, 200, 778); await advance(450); tap2(dim, 200, y); await advance(50); const v = app.get().view.name; await reset(); return v; };
out.row.lowTap = { onCopy: await lowTap(598), wasThere: await lowTap(778) };
// a menu measured where the last bubble left it would be squeezed by the screen's edge: it is measured at its own size
{ pop.style.left = "214px"; const r = rowOnPage(); down(r.pri); await advance(500); out.row.measuredAt = pop.measuredLeft; up(r.pri); await reset(); }

// a touchcancel after the menu came (the system took the finger: a call, Siri, the side button): it lets go as a release does, and picks nothing
{ const r = rowOnPage(); const d0 = drawn; down(r.pri); await advance(500); ui.render(); cancel(r.pri, 200, 538); await advance(401);
  out.row.cancelOpen = { drawn: drawn - d0, listening: r.pri.listening(), down: (fns.holdState() || {}).down, menu: bg.hidden === false }; await reset(); }
{ const r = rowOnPage(); const d0 = drawn; down(r.pri); await advance(500); fire("keydown", { key: "Escape" }); ui.render(); await advance(300); cancel(r.pri, 200, 538); await advance(401);
  out.row.cancelGone = { drawn: drawn - d0, listening: r.pri.listening() }; await reset(); }
const slidCancel = async (detach) => { const r = rowOnPage(); down(r.pri); await advance(500); const skip = pop.children[1]; pointAt = (x, y) => (y > 640 ? skip : elsewhere);
  move(r.pri, 120, 600); move(r.pri, 120, 700); const lit = skip.classList.contains("lp-over");
  if (detach) { r.list.parentElement = null; own(r.pri, "touchcancel", { target: r.pri, touches: [], changedTouches: [T(120, 700)], cancelable: false }); } else cancel(r.pri, 120, 700);
  const s = { lit, litAfter: skip.classList.contains("lp-over"), down: (fns.holdState() || {}).down, listening: r.pri.listening() }; await advance(400);
  const o = { ...s, litLater: skip.classList.contains("lp-over"), asking: !!app.get().asking, menu: bg.hidden === false }; fns.closeSkip(); await reset(); return o; };
out.row.cancelSlid = await slidCancel(false); out.row.cancelSlidDetached = await slidCancel(true);

// the menu still rising into its place (held near the bottom: it starts 119 points low and rises over 0.45 s) under a finger that slid onto
// it and rests: the row lit follows the rows passing under the finger, frame by frame, and letting go picks the row that is lit
const riseHold = async (slideAt, y, releaseAt) => {
  const r = rowOnPage(680); down(r.pri, 200, 718); await advance(400);
  const opened = NOW, off0 = parseFloat(pop.style["--lift-off"]), off = () => off0 * Math.max(0, 1 - (NOW - opened) / 450);   // (a straight rise: enough to move the rows under a still finger)
  pointAt = (x, yy) => menuAt(x, yy - off());
  const label = (b) => (b && b !== elsewhere ? b.children.at(-1).textContent : null), litNow = () => label(pop.children.find((c) => c.classList.contains("lp-over")));
  await advance(slideAt); move(r.pri, 120, y); const atSlide = litNow();
  await advance(releaseAt - slideAt); const lit = litNow(), under = label(menuAt(120, y - off()));
  up(r.pri, 120, y); await advance(400); const picked = fns.datePicker() ? "Reschedule" : app.get().asking ? "Skip" : null;
  fns.closeSkip(); fns.closeDatePicker(); await reset(); return { atSlide, lit, under, picked }; };
out.row.rise = { settled: await riseHold(300, 720, 600), between: await riseHold(300, 720, 406) };   // let go once it is in its place; and 6 ms after the next row came under the finger, before a frame showed it

// ---------- a coach's exercise ----------
out.ex = {};
let picked = [];
const exerciseOnPage = (o = {}) => {
  clientPage(false); picked = []; pointAt = () => null;
  const block = onPage(mk("div", o.done ? ["block", "done", "open"] : ["block", "open"])), group = mk("div", ["group", "multi"]), row = mk("div", ["row"], "", o.rect || { left: 27, top: 408, width: 347, height: 318 });
  group.bg = o.done ? "rgba(60, 122, 78, 0.08)" : "rgb(28, 28, 30)";            // its card: the fern wash of a finished one, or the plain card
  const num = mk("input", ["label"]), name = mk("textarea", ["name"]), icons = mk("div", ["ex-icons"]), more = mk("button", ["more-btn"]), player = mk("div", ["player"]), frame = mk("iframe", [], "yt1"), tag = mk("span", ["sum"], "s1");
  const chip = mk("div", ["chip"]), chipVal = mk("span", ["val"]), chipIn = mk("input", ["reps", "tab"]), tiles = mk("div", ["tempo-tiles"]), tile = mk("button");   // a box that is a field (its words, then its field on a tap), and the tempo's tiles
  chip.append(chipVal, chipIn); tiles.append(tile);
  num.value = "2b"; name.value = "Wide-grip dip"; chipIn.value = "12";
  const setlog = mk("div", ["setlog"]), alt = mk("div", ["sugg"]); setlog.gone = !!o.template; row.append(setlog, alt);   // the set log a template's page hides; the names suggested under the name, open (v295: the instructions' panel, the last other, became a sheet)
  frame.offsetWidth = 315; frame.offsetHeight = 177; player.append(frame); icons.append(more); row.append(num, name, icons, player, tag, chip, tiles); group.append(row); block.append(group);
  row._ctx = () => fns.exerciseMenu({ id: "r1", label: "2b", name: "Wide-grip dip", note: "" }, { swap: () => picked.push("swap"), note: () => picked.push("note"), remove: () => picked.push("remove") }); row._ctx.ok = () => true;
  return { block, group, row, num, name, icons, more, player, chipVal, tile };
};
{ const x = exerciseOnPage(); down(x.icons, 150, 493); await advance(401);
  const wraps = [], walk = (n) => { if (!n || !(n.classes && n.classes.has("lp-wrap"))) return n; wraps.push(n.tagName + " " + n.className); return walk(n.children[0]); };
  const copy = walk(box.children[0]); const fields = copy ? copy.querySelectorAll("input, textarea") : [];
  out.ex.hold = { ...state(), wraps, copied: !!copy && copy !== x.row && copy.classList.contains("row"),
    fields: fields.map((f) => ({ value: f.value, disabled: f.disabled === true, tab: f.tabIndex })), frames: copy ? copy.querySelectorAll("iframe").length : -1, ids: copy ? copy.querySelectorAll("[id]").length : -1, width: copy && copy.style.width, margin: copy && copy.style.margin, platter: box.style.background };
  up(x.icons, 150, 493); await advance(200); tap2(pop.children[2], 150, 700);         // its last row: Delete exercise, tapped
  out.ex.hold.atPick = { lifted: box.hidden === false, dimShown: dim.hidden === false, dimOn: dim.classList.contains("on") };   // the copy goes at once (what the pick opens is not under it); the page brightens over 0.2 s
  await advance(300); out.ex.hold.picked = picked.slice(); out.ex.hold.after = { ...state(), dimShown: dim.hidden === false }; }
{ const x = exerciseOnPage({ done: true, template: true }); down(x.icons, 150, 493); await advance(401);   // a finished card opened again, in a template: its wash, its page's hidden parts, its open list closed
  const walk = (n) => (n && n.classes && n.classes.has("lp-wrap") ? walk(n.children[0]) : n), copy = walk(box.children[0]);
  out.ex.washed = { platter: box.style.background, setlog: copy && copy.querySelector(".setlog") && copy.querySelector(".setlog").style.display, altHidden: !!copy && !!copy.querySelector(".sugg") && copy.querySelector(".sugg").hidden === true, liveAlt: x.row.querySelector(".sugg").hidden === true };
  up(x.icons, 150, 493); await reset(); }
{ const x = exerciseOnPage(); down(x.name, 150, 440); await advance(600); out.ex.onField = state(); up(x.name, 150, 440); await reset(); }   // on a field: iOS's own (its loupe and caret)
{ const x = exerciseOnPage(); down(x.player, 150, 600); await advance(600); out.ex.inPlayer = state(); up(x.player, 150, 600); await reset(); }   // in its open video: not the exercise
{ const x = exerciseOnPage(); down(x.more, 345, 492); await advance(600); out.ex.onMore = state(); up(x.more, 345, 492); await reset(); }   // its "…" held: the same menu, under the lifted exercise
{ const x = exerciseOnPage(); down(x.chipVal, 100, 560); await advance(150); const lift150 = state(); await advance(450); out.ex.onChip = { lift150, at600: state() }; up(x.chipVal, 100, 560); await reset(); }   // a box that is a field (Reps, Rest, the set's Weight): its own, never lifted
{ const x = exerciseOnPage(); down(x.tile, 100, 640); await advance(600); out.ex.onTiles = state(); up(x.tile, 100, 640); await reset(); }   // the tempo's tiles: the tempo field's

{ const x = exerciseOnPage({ rect: { left: 27, top: 100, width: 347, height: 900 } }); down(x.icons, 150, 493); await advance(401);   // a card too tall for the room: it shrinks to fit over its menu, from the top margin
  out.ex.tall = { moved: box.style.transform, top: pop.style.top, liftOff: pop.style["--lift-off"] }; up(x.icons, 150, 493); await reset(); }

console.log(JSON.stringify(out));
process.exit(0);
