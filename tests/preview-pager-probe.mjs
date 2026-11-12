// Run by preview-pager.test.js in its own process: the workout preview's arrows, its sideways slide and its "…" (his asks, 11 Nov). The
// sheet, its header, its list and the sheets and menu it opens over itself keep their listeners, styles and classes; elements the app makes
// (the page sliding in, the menu's rows) are the same kind; every timer runs on this probe's own clock; it prints, as JSON, what each did.
import { byId, el } from "./env.js";
import { ui } from "../app/state.js";
let NOW = 10000, SEQ = 0; const Q = [];
globalThis.setTimeout = (fn, ms) => { const id = ++SEQ; Q.push({ id, at: NOW + Math.max(0, ms || 0), fn }); return id; };
globalThis.clearTimeout = (id) => { const i = Q.findIndex((q) => q.id === id); if (i >= 0) Q.splice(i, 1); };
try { performance.now = () => NOW; } catch (_) { Object.defineProperty(globalThis, "performance", { value: { now: () => NOW }, configurable: true }); }
{ const t0 = Date.now() - NOW; Date.now = () => t0 + NOW; }
const flush = async () => { for (let i = 0; i < 30; i++) await Promise.resolve(); };
async function advance(ms) { const end = NOW + ms; for (;;) { Q.sort((a, b) => a.at - b.at || a.id - b.id); const q = Q[0]; if (!q || q.at > end) break; Q.shift(); NOW = Math.max(NOW, q.at); q.fn(); await flush(); } NOW = end; await flush(); }
const L = {};                                                              // the document's listeners, with their phase
document.addEventListener = (t, fn, o) => { (L[t] ||= []).push({ fn, capture: o === true || !!(o && o.capture) }); };
document.removeEventListener = (t, fn) => { const a = L[t] || []; const i = a.findIndex((x) => x.fn === fn); if (i >= 0) a.splice(i, 1); };
const WIN = {}; globalThis.addEventListener = (t, fn) => { (WIN[t] ||= []).push(fn); }; globalThis.removeEventListener = () => {};
const key = (k, mods = {}) => { const ev = { type: "keydown", key: k, target: byId.get("pvBox"), defaultPrevented: false, preventDefault() { this.defaultPrevented = true; }, ...mods }; for (const l of [...(L.keydown || [])].sort((a, b) => b.capture - a.capture)) l.fn(ev); return ev; };   // capture listeners first, as the DOM runs them
const kids = (e) => { e.replaceChildren = (...k) => { e.children = k; }; e.appendChild = (c) => { e.children = [...e.children, c]; return c; }; e.append = (...k) => { e.children = [...e.children, ...k]; }; return e; };
const listens = (e) => { const H = {}; e.H = H; e.addEventListener = (type, fn, o) => { (H[type] ||= []).push({ fn, o }); if (o && o.signal && o.signal.addEventListener) o.signal.addEventListener("abort", () => { H[type] = (H[type] || []).filter((x) => x.fn !== fn); }); }; e.removeEventListener = (type, fn) => { H[type] = (H[type] || []).filter((x) => x.fn !== fn); }; e.fire = (type, ev = {}) => { ev.type = type; if (!ev.target) ev.target = e; if (!ev.preventDefault) ev.preventDefault = () => { ev.defaultPrevented = true; }; if (!ev.stopPropagation) ev.stopPropagation = () => {}; for (const x of [...(H[type] || [])]) x.fn(ev); return ev; }; return e; };
const styled = (e) => { const st = {}; st.setProperty = (k, v) => { st[k] = v; }; st.removeProperty = (k) => { delete st[k]; }; e.style = st; return e; };
const made = [];                                                           // what the app made, in order (the pages sliding in, the menu's rows)
const num = (v) => +v || 0;
const mk = (tag) => { const e = styled(listens(kids(el(tag)))); e.inert = false; e.removed = false; e.remove = () => { e.removed = true; }; e.setAttribute = (k, v) => { e["@" + k] = v; };
  e.getBoundingClientRect = () => { const t = (/pv-peek|pv-cards/.test(e.className || "") ? 200 : 0) + num(e.offsetTop), h = num(e.offsetHeight); return { top: t, bottom: t + h, height: h, left: 0, right: 0, width: 0 }; }; made.push(e); return e; };   // laid out where its offsets say (a page placed beside the list, and its cards, 200 down the screen)
document.createElement = mk;
const recorder = (id, extra = {}) => { const e = mk("div"); e.id = id; Object.assign(e, extra); byId.set(id, e); return e; };
const pvSheet = recorder("pvSheet", { hidden: true }), pvBar = recorder("pvBar", { clientWidth: 402 }), pvBox = recorder("pvBox", { offsetHeight: 600, clientWidth: 402 });
const pvScroll = recorder("pvScroll", { scrollTop: 0, scrollHeight: 1600, clientHeight: 600, offsetTop: 0, offsetHeight: 520 }), pvCards = recorder("pvCards");
const peeks = []; pvScroll.after = (p) => { peeks.push(p); };          // the page sliding in, put beside the list
pvBox.getBoundingClientRect = () => { const h = num(pvBox.offsetHeight); return { top: 812 - h, bottom: 812, height: h, left: 0, right: 402, width: 402 }; };   // a bottom sheet: its foot at the screen's
pvScroll.getBoundingClientRect = () => { const t = pvBox.getBoundingClientRect().top + num(pvScroll.offsetTop), h = num(pvScroll.offsetHeight); return { top: t, bottom: t + h, height: h, left: 0, right: 402, width: 402 }; };
// every size written on the sheet, the whole run long (his ask, 11 Nov: "make sure the card is always the same height"): its height, its min and max heights, and a transition of any of them; read as a slice by the scenes that watch one slide, all of it at the end
const sizedAll = []; for (const k of ["height", "minHeight", "maxHeight", "transition"]) { let v = pvBox.style[k] || ""; Object.defineProperty(pvBox.style, k, { get: () => v, set: (x) => { sizedAll.push(k + "=" + x); v = x; }, configurable: true }); }
for (const id of ["pvTitle", "pvBarTitle", "pvX", "pvGo", "pvDay", "pvMore", "pvPrev", "pvNext", "pvSay", "whenPop", "askYes", "askNo", "askTitle", "askText", "pickList", "pickNo", "pickTitle", "skGo", "skKeep", "skReasons", "dpCancel"]) recorder(id);
for (const id of ["whenBg", "askSheet", "pickSheet", "skipSheet", "datePick"]) recorder(id, { hidden: true });
for (const id of ["pvSheet", "askSheet", "pickSheet", "skipSheet", "datePick"]) byId.get(id).classList.add("sheet-bg");   // every sheet's backdrop, as in the page
const main = recorder("mainEl"), header = recorder("headerEl");
document.querySelectorAll = (sel) => (sel === "main, header" ? [main, header] : sel === ".sheet-bg:not([hidden])" ? [pvSheet, byId.get("askSheet"), byId.get("pickSheet"), byId.get("skipSheet"), byId.get("datePick")].filter((x) => !x.hidden) : []);
document.querySelector = (sel) => (sel === "main" ? main : el());
document.body.children = [main, header, pvSheet, byId.get("whenBg"), byId.get("askSheet"), byId.get("pickSheet"), byId.get("skipSheet"), byId.get("datePick")];
const app = (await import("../app/main.js")).internals();
const { fns, maps } = app;
const day = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return fns.localIso(d); };
const W = (id, n, made_, extra = {}) => ({ id, clientId: "c1", title: id.toUpperCase(), date: day(n), createdAt: "2026-11-01T" + made_ + ":00.000Z", completedAt: null, skippedAt: null, rows: [], ...extra });
function seed(view = {}) {                                                 // a client's workouts: History's (one finished, one skipped, one missed filed after a week), two missed, two today (the morning one made first), two to come; one of another client
  fns.closePreview(); app.reset(); app.set({ signedIn: true, clientMode: false, tab: "workouts", ...view });
  maps.clients.set("c1", { id: "c1", name: "Jane", unit: "lb" }); maps.clients.set("c2", { id: "c2", name: "Kim", unit: "lb" });
  const noon = (n) => { const d = new Date(); d.setDate(d.getDate() + n); d.setHours(12, 0, 0, 0); return d.toISOString(); };
  for (const t of [W("f", -10, "10:00", { completedAt: noon(-10) }), W("s", -9, "08:00", { skippedAt: noon(-9) }), W("om", -8, "08:00", { skippedAt: noon(-1), missed: true }), W("m2", -3, "08:00"), W("m1", -1, "08:00"), W("b", 0, "09:00"), W("a", 0, "08:00"), W("c", 2, "08:00"), W("d", 5, "08:00"), { ...W("o", 1, "08:00"), clientId: "c2" }])
    maps.trainings.set(t.id, t);
  app.set({ view: { name: "client", id: "c1" } }); fns.render(); pvScroll.scrollTop = 0; peeks.length = 0;
}
const openOn = async (id, view) => { seed(view); const ok = fns.openPreview(id); await advance(400); return ok; };   // open, past its 350 ms guard
const look = () => ({ id: (fns.previewState() || {}).id || null, slide: fns.previewSlide(), prev: byId.get("pvPrev").disabled, next: byId.get("pvNext").disabled });
const out = {};
// ---------- the walk: every workout still to do, by its day, then as made ----------
seed(); out.walk = fns.previewWalk("c1");
out.near = { a: fns.previewNear("a"), m2: fns.previewNear("m2"), d: fns.previewNear("d"), f: fns.previewNear("f"), gone: fns.previewNear("zz") };
// ---------- the "…": by view, by state ----------
seed(); out.items = { coach: fns.previewItems("a"), coachMissed: fns.previewItems("m1"), coachFinished: fns.previewItems("f") };
seed({ clientMode: true }); out.items.client = fns.previewItems("a"); out.items.clientMissed = fns.previewItems("m1"); out.items.clientFinished = fns.previewItems("f");
// ---------- the arrows: dimmed at the ends; the 350 ms guard; a tap slides on the month view's curve and lands ----------
{ await openOn("f"); const first = look(); fns.closePreview(); await openOn("d"); const last = look(); fns.closePreview(); await openOn("a"); out.ends = { first, last, mid: look(), more: byId.get("pvMore").disabled }; }
{ seed(); fns.openPreview("a"); await advance(100); byId.get("pvNext").fire("click", { detail: 1 }); out.guard = look(); }
const page = (p) => p && { tr: p.style.transition, tf: p.style.transform, top: p.style.top, bottom: p.style.bottom, inert: p.inert, aria: p["@aria-hidden"], cls: p.className };
const veil = () => ({ on: pvBar.style["--pv-on"] ?? null, x: pvBar.style["--pv-veil-x"] ?? null, tr: pvBar.style["--pv-veil-tr"] ?? null, titled: pvBar.classList.contains("pv-titled") });
{ await openOn("a"); byId.get("pvNext").fire("click", { detail: 1 }); const inP = peeks[peeks.length - 2], outP = peeks[peeks.length - 1];   // the page coming in (placed first), then the copy of the page going out
  const during = { ...look(), list: { tr: pvScroll.style.transition, tf: pvScroll.style.transform }, peek: page(inP), out: page(outP), outScroll: outP && outP.scrollTop, bar: byId.get("pvBarTitle").textContent, title: byId.get("pvTitle").textContent, say: byId.get("pvSay").textContent, top: pvScroll.classList.contains("pv-top"), veil: veil() };
  await advance(359); const at359 = look(); await advance(1);
  out.tap = { during, at359, landed: { ...look(), list: { tr: pvScroll.style.transition, tf: pvScroll.style.transform }, peekGone: !!(inP && inP.removed), outGone: !!(outP && outP.removed), veil: veil(), say: byId.get("pvSay").textContent, title: byId.get("pvTitle").textContent, top: pvScroll.classList.contains("pv-top") } }; }
{ await openOn("a"); byId.get("pvNext").fire("click", { detail: 1 }); await advance(50); byId.get("pvNext").fire("click", { detail: 1 }); const mid = look(); await advance(400); out.twoTaps = { mid, landed: look() }; }   // two quick taps: two workouts
{ await openOn("a"); const ids = []; for (let i = 0; i < 6; i++) { byId.get("pvPrev").fire("click", { detail: 1 }); await advance(400); ids.push(look().id); } out.back = { ids, last: look() }; }   // back through the missed into History (his ask, 11 Nov), then nothing further
{ await openOn("a"); byId.get("pvNext").fire("click", { detail: 1 }); const inP = peeks[peeks.length - 2], outP = peeks[peeks.length - 1]; await advance(100);
  pvScroll.fire("transitionend", { target: pvScroll }); inP.fire("transitionend", { target: inP }); outP.fire("transitionend", { target: pvCards }); const others = !!fns.previewSlide();   // the list's, the incoming page's, a child's on its way up: not the slide's
  outP.fire("transitionend", { target: outP }); out.ended = { others, ...look() }; }   // the page going out's own transitionend lands it before the fallback
// ---------- Reduce Motion: at once ----------
{ const mm = globalThis.matchMedia; globalThis.matchMedia = (q) => ({ matches: /reduce/.test(q), addEventListener() {}, removeEventListener() {} });
  try { await openOn("a"); byId.get("pvNext").fire("click", { detail: 1 }); out.calm = { ...look(), tr: pvScroll.style.transition }; } finally { globalThis.matchMedia = mm; } }
// ---------- the finger: 8 points sideways within 30 degrees is a slide (refused at once); past 48 on, else back; the rubber band ----------
const F = new Map(); let cancelable = true;
const T = (id, x, y) => ({ identifier: id, clientX: x, clientY: y });
const tev = (target, changed) => ({ touches: [...F.entries()].map(([id, p]) => T(id, p.x, p.y)), changedTouches: changed, target, timeStamp: NOW, cancelable, defaultPrevented: false, preventDefault() { if (this.cancelable) this.defaultPrevented = true; }, type: "" });
const inList = { closest: (s) => (s === "#pvScroll" ? pvScroll : null) }, inBar = { closest: () => null };
const fire = (type, ev) => { ev.type = type; pvSheet.fire(type, ev); return pvBox.fire(type, ev); };
const start = (x, y, target) => { F.clear(); F.set(1, { x, y }); return fire("touchstart", tev(target, [T(1, x, y)])); };
const move = (x, y, target) => { F.set(1, { x, y }); return fire("touchmove", tev(target, [T(1, x, y)])); };
const end = (target, type = "touchend") => { const ch = [...F.entries()].map(([id, p]) => T(id, p.x, p.y)); F.clear(); return fire(type, tev(target, ch)); };
async function drag(path, { target = inList, type = "touchend" } = {}) { const [x0, y0] = path[0]; start(x0, y0, target); const p = []; for (const [x, y] of path.slice(1)) { await advance(16); p.push(move(x, y, target).defaultPrevented); } const during = look(); end(target, type); const after = look(); await advance(400); return { p, during, after, landed: look(), listTr: pvScroll.style.transition || "" }; }
await openOn("a"); out.fling = await drag([[300, 400], [292, 401], [280, 401], [240, 402]]);   // 8 left (the claim), then 60: on to the next
await openOn("a"); out.short = await drag([[300, 400], [292, 400], [270, 400]]);                // 30 left: back
await openOn("a"); out.right = await drag([[100, 400], [108, 400], [170, 401]]);                // 70 right: the one before
await openOn("a"); out.cancelled = await drag([[300, 400], [292, 400], [200, 400]], { type: "touchcancel" });   // iOS takes the touch: back
await openOn("f"); out.band = await drag([[100, 400], [108, 400], [168, 400]]);                 // nothing before the first (History's oldest): a third of the way (20), and back
await openOn("a"); out.steep = await drag([[300, 400], [285, 411]]);                            // 15 sideways, 11 down (36 degrees): not a slide, and nobody's
await openOn("a"); out.header = await drag([[300, 30], [292, 30], [230, 31]], { target: inBar });   // from the header too
{ await openOn("a"); cancelable = false; const r = await drag([[300, 400], [290, 400], [250, 400]]); cancelable = true; out.native = r; }   // iOS already scrolling the list: never a slide
{ await openOn("a"); start(300, 400, inList); await advance(16); move(292, 400, inList); await advance(16); move(250, 400, inList); pvScroll.scrollTop = 6; pvScroll.fire("scroll", {}); const scrolled = look(); end(inList); await advance(400); pvScroll.scrollTop = 0; out.scrolled = { scrolled, landed: look() }; }   // the list scrolled anyway: the slide goes back, the touch is the list's
{ await openOn("a"); byId.get("pvNext").fire("click", { detail: 1 }); await advance(100); start(200, 400, inList); out.caught = { ...look(), drag: !!fns.previewDrag() }; end(inList); await advance(400); }   // a new finger lands a slide still settling
{ await openOn("a"); start(300, 400, inList); await advance(16); move(292, 400, inList); await advance(16); move(200, 400, inList); end(inList); const ev = { detail: 1, target: byId.get("pvNext"), defaultPrevented: false }; await advance(100); pvBox.fire("click", ev); out.eaten = ev.defaultPrevented; await advance(400); }   // the click after a slide: eaten
// ---------- a sync's redraw waits for the slide, a direct redraw paints nothing mid-slide, a workout gone mid-slide closes it ----------
{ await openOn("a"); let paints = 0; const rc = pvCards.replaceChildren; pvCards.replaceChildren = (...k) => { paints++; rc(...k); };
  byId.get("pvNext").fire("click", { detail: 1 }); const atGo = paints; ui.render(); const held = paints - atGo; fns.render(); const direct = { id: look().id, paints: paints - atGo }; await advance(400); out.redraw = { atGo, held, direct, after: paints - atGo, landed: look() }; pvCards.replaceChildren = rc; }
{ await openOn("a"); byId.get("pvNext").fire("click", { detail: 1 }); maps.trainings.delete("b"); await advance(400); out.goneMid = look(); }
// ---------- the sheet keeps its one height through a finger's slide, its let-go and its landing (his ask, 11 Nov: "make sure the card is always the same height"): nothing writes a height on it ----------
{ await openOn("a"); const real = document.createElement; document.createElement = (t) => { const e = real(t); Object.defineProperty(e, "offsetTop", { get() { return /\bpv-cards\b/.test(this.className) ? 94 : 0; }, configurable: true }); Object.defineProperty(e, "offsetHeight", { get() { return /\bpv-cards\b/.test(this.className) ? 200 : 0; }, configurable: true }); return e; }; const n0 = sizedAll.length;   // (the workout coming in a short one: its cards 200 tall under 94)
  start(300, 400, inList); await advance(16); move(292, 400, inList); await advance(16); move(92, 400, inList); document.createElement = real; const mid = pvBox.style.height, slid = !!fns.previewSlide(); end(inList); await advance(400);
  out.height = { slid, writes: sizedAll.slice(n0), mid, landed: look().id }; }
// ---------- keys: left and right go between them; Escape closes; a menu or a sheet up over the preview takes its own keys ----------
{ await openOn("a"); const r = key("ArrowRight"); await advance(400); const right = look().id; key("ArrowLeft"); await advance(400); const left = look().id; key("ArrowRight", { metaKey: true }); await advance(400);
  out.keys = { prevented: r.defaultPrevented, right, left, withCmd: look().id }; byId.get("whenBg").hidden = false; key("Escape"); out.keys.menuEsc = !!fns.previewState(); byId.get("whenBg").hidden = true; key("Escape"); out.keys.esc = !!fns.previewState(); }
// ---------- two fingers on a Mac's trackpad: the month view's own wheel, a workout at most ----------
{ await openOn("a"); const target = { closest: (s) => (s === "#pvBox" ? pvBox : null) }; const m = fns.monthWheel(target); const began = m && m.begin(); const full = m && m.move(-100); const mid = look(); m && m.end(); await advance(400); const on = look().id;
  const m2 = fns.monthWheel(target); m2.begin(); m2.move(-30); m2.end(); await advance(400); out.wheel = { has: !!m, began, full, mid: mid.slide && Math.round(mid.slide.x), on, short: look().id };
  byId.get("whenBg").hidden = false; out.wheel.underMenu = !!fns.monthWheel(target); byId.get("whenBg").hidden = true; }
// ---------- the "…" and what it opens over the preview ----------
{ await openOn("a"); byId.get("pvMore").fire("click", { detail: 1 }); const pop = byId.get("whenPop"); out.menu = { rows: (pop.children || []).map((b) => (b.className.includes("danger") ? "!" : "") + ((b.children || []).map((s) => s.textContent).join(""))), bgHidden: byId.get("whenBg").hidden };
  byId.get("pvNext").fire("click", { detail: 1 }); out.menu.closedOnSlide = byId.get("whenBg").hidden; await advance(400); }
{ await openOn("a"); const behind = document.body.children.filter((e) => e.inert).map((e) => e === main ? "main" : e === header ? "header" : e.hidden ? "hiddenSheet" : "other"); out.inert = { behind, pvUp: document.body.classList.contains("pv-up") }; fns.closePreview(); out.inert.pvUpAfter = document.body.classList.contains("pv-up"); }
// Skip: its question over the preview (the preview waits), then on to the next workout; Cancel stays
{ await openOn("a"); byId.get("pvMore").fire("click", { detail: 1 }); const skip = (byId.get("whenPop").children || []).find((b) => (b.children || []).some((s) => s.textContent === "Skip")); skip.fire("click", {});
  const open_ = { sheet: !byId.get("skipSheet").hidden, pvInert: pvSheet.inert, asking: app.get().asking }; await advance(400); byId.get("skGo").fire("click", {}); await advance(400);
  out.skip = { open: open_, skipped: !!maps.trainings.get("a").skippedAt, now: look(), pvInert: pvSheet.inert, asking: app.get().asking }; }
{ await openOn("a"); byId.get("pvMore").fire("click", { detail: 1 }); (byId.get("whenPop").children || []).find((b) => (b.children || []).some((s) => s.textContent === "Skip")).fire("click", {}); await advance(400); byId.get("skKeep").fire("click", {}); await advance(400);
  out.skipCancel = { now: look(), skipped: !!maps.trainings.get("a").skippedAt, pvInert: pvSheet.inert, asking: app.get().asking }; }
// Delete: asked over the preview, then on to the next; the last one closes it
{ await openOn("a"); byId.get("pvMore").fire("click", { detail: 1 }); (byId.get("whenPop").children || []).find((b) => (b.children || []).some((s) => s.textContent === "Delete workout")).fire("click", {});
  await advance(400); const asked = !byId.get("askSheet").hidden; byId.get("askYes").fire("click", {}); await flush(); const atYes = look(); await advance(400);
  out.del = { asked, atYes, gone: !maps.trainings.has("a"), now: look(), asking: app.get().asking, view: app.get().view.name }; }
{ await openOn("d"); for (const id of ["f", "s", "om", "m2", "m1", "a", "b", "c"]) maps.trainings.delete(id); fns.render(); byId.get("pvMore").fire("click", { detail: 1 }); (byId.get("whenPop").children || []).find((b) => (b.children || []).some((s) => s.textContent === "Delete workout")).fire("click", {});
  await advance(400); byId.get("askYes").fire("click", {}); await flush(); await advance(400); out.delLast = { open: !!fns.previewState(), gone: !maps.trainings.has("d"), asking: app.get().asking }; }
{ await openOn("a"); byId.get("pvMore").fire("click", { detail: 1 }); (byId.get("whenPop").children || []).find((b) => (b.children || []).some((s) => s.textContent === "Delete workout")).fire("click", {}); await advance(400); byId.get("askNo").fire("click", {}); await flush(); await advance(100);
  out.delNo = { now: look(), kept: maps.trainings.has("a"), asking: app.get().asking }; }
// Copy workout: which client gets it, then the preview closes and the copy opens
{ await openOn("a"); const n0 = maps.trainings.size; byId.get("pvMore").fire("click", { detail: 1 }); (byId.get("whenPop").children || []).find((b) => (b.children || []).some((s) => s.textContent === "Copy workout")).fire("click", {});
  await advance(400); const asked = !byId.get("pickSheet").hidden; byId.get("pickList").fire("click", { target: { closest: () => ({ dataset: { id: "c2" } }) } }); await flush(); await advance(100);
  const v = app.get().view, copy = maps.trainings.get(v.id); out.copy = { asked, open: !!fns.previewState(), view: v.name, client: copy && copy.clientId, title: copy && copy.title, n: maps.trainings.size - n0, asking: app.get().asking }; }
// Reschedule: the days over the preview (the preview waits; the page behind stays held), then the same workout on its new day
{ await openOn("a"); byId.get("pvMore").fire("click", { detail: 1 }); (byId.get("whenPop").children || []).find((b) => (b.children || []).some((s) => s.textContent === "Reschedule")).fire("click", {});
  const dp = fns.datePicker(); const during = { open: !!dp, pvInert: pvSheet.inert }; const pick = dp && dp.onPick; fns.closeDatePicker(); const closed = { pvInert: pvSheet.inert, mainInert: main.inert, asking: app.get().asking }; if (pick) pick(day(4));
  out.resched = { during, closed, now: look(), date: maps.trainings.get("a").date === day(4), day: byId.get("pvDay").textContent.length > 0, near: fns.previewNear("a") }; }
// Do it today: the same workout, today's now, no longer missed
{ await openOn("m1"); const before = byId.get("pvDay").children ? (byId.get("pvDay").children[0] || {}).textContent : ""; byId.get("pvMore").fire("click", { detail: 1 }); (byId.get("whenPop").children || []).find((b) => (b.children || []).some((s) => s.textContent === "Do it today")).fire("click", {});
  out.today = { before, now: look(), date: maps.trainings.get("m1").date === day(0), items: fns.previewItems("m1") }; }
// ---------- a missed one says so, in red, before its day ----------
{ await openOn("m1"); const d = byId.get("pvDay"); out.missedDay = { first: d.children && d.children[0] && { cls: d.children[0].className, text: d.children[0].textContent }, say: null }; byId.get("pvPrev").fire("click", { detail: 1 }); await advance(400); out.missedDay.say = byId.get("pvSay").textContent; }
// ---------- a click or a key while a slide is still landing acts on the workout it went to, as a touch does (a Mac has no touch to land it first) ----------
const pick = (label) => (byId.get("whenPop").children || []).find((b) => (b.children || []).some((s) => s.textContent === label));
{ await openOn("a"); byId.get("pvNext").fire("click", { detail: 1 }); await advance(150); byId.get("pvGo").fire("click", { detail: 1 }); const v = app.get().view; out.startMid = { view: v.name, id: v.id, open: !!fns.previewState() }; }
{ await openOn("a"); key("ArrowRight"); await advance(100); byId.get("pvGo").fire("click", { detail: 0 }); out.startKey = app.get().view.id; }
{ await openOn("a"); const m = fns.monthWheel({ closest: (s) => (s === "#pvBox" ? pvBox : null) }); m.begin(); const full = m.move(-402); m.end(); await advance(200); byId.get("pvGo").fire("click", { detail: 1 }); out.startWheel = { full, id: app.get().view.id }; }
{ await openOn("a"); byId.get("pvNext").fire("click", { detail: 1 }); await advance(150); byId.get("pvMore").fire("click", { detail: 1 }); out.moreMid = { menu: !byId.get("whenBg").hidden, sliding: !!fns.previewSlide(), id: look().id, rows: (byId.get("whenPop").children || []).length }; key("Escape"); await advance(400); }
{ await openOn("a"); byId.get("pvNext").fire("click", { detail: 1 }); await advance(100); maps.trainings.delete("b"); let threw = false; try { byId.get("pvGo").fire("click", { detail: 1 }); } catch (_) { threw = true; } out.goneStart = { threw, view: app.get().view.name, open: !!fns.previewState() }; await advance(400); }
// ---------- a finger landing while a slide is still landing lands on the list, which already holds the workout it went to: nothing repainted under it, the touch the list's ----------
{ await openOn("a"); byId.get("pvNext").fire("click", { detail: 1 }); await advance(60); const mid = { list: pvScroll.style.transform, title: byId.get("pvTitle").textContent };
  start(200, 400, inList); for (const y of [396, 388]) { await advance(16); move(200, y, inList); } const drag_ = fns.previewDrag(); end(inList); await advance(400); out.settleCatch = { mid, drag: drag_, landed: look() }; }
{ await openOn("a"); byId.get("pvNext").fire("click", { detail: 1 }); ui.render();   // a sync's redraw, held for the slide
  let inPage = true; const card = listens({ get isConnected() { return inPage; }, closest: (s) => (!inPage ? null : s === "#pvScroll" ? pvScroll : s === "#pvCards" ? pvCards : null) });
  const rc = pvCards.replaceChildren; pvCards.replaceChildren = (...k) => { inPage = false; rc(...k); };
  const send = (type, ev) => { ev.type = type; pvSheet.fire(type, ev); card.fire(type, ev); if (inPage) pvBox.fire(type, ev); return ev; };   // a card a repaint took out of the page passes nothing on
  await advance(40); F.clear(); F.set(1, { x: 60, y: 400 }); send("touchstart", tev(card, [T(1, 60, 400)])); const underFinger = inPage;
  for (const y of [396, 380, 340]) { await advance(16); F.set(1, { x: 60, y }); send("touchmove", tev(card, [T(1, 60, y)])); }
  const ch = [...F.entries()].map(([id, p]) => T(id, p.x, p.y)); F.clear(); send("touchend", tev(card, ch));
  pvCards.replaceChildren = rc; out.landedUnder = { underFinger, ...look(), drag: fns.previewDrag() }; await advance(400); }
// ---------- an arrow's slide (a key's, the one after Skip or Delete) writes no height either ----------
{ await openOn("a"); const real = document.createElement; document.createElement = (t) => { const e = real(t); Object.defineProperty(e, "offsetTop", { get() { return /\bpv-cards\b/.test(this.className) ? 94 : 0; }, configurable: true }); Object.defineProperty(e, "offsetHeight", { get() { return /\bpv-cards\b/.test(this.className) ? 200 : 0; }, configurable: true }); return e; }; const n0 = sizedAll.length;
  byId.get("pvNext").fire("click", { detail: 1 }); document.createElement = real; const mid = !!fns.previewSlide(); await advance(400);
  out.arrowHeight = { mid, log: sizedAll.slice(n0), landed: look().id }; }
// ---------- the page coming in placed where the list is: its foot under the list measured once, as the slide began ----------
const sized = (cap, natural) => { const st = pvBox.style; Object.defineProperty(pvBox, "offsetHeight", { get: () => Math.min(cap, parseFloat(st.height) || natural), configurable: true }); Object.defineProperty(pvScroll, "offsetHeight", { get: () => pvBox.offsetHeight - 80, configurable: true }); };
const unsized = () => { Object.defineProperty(pvBox, "offsetHeight", { value: 600, writable: true, configurable: true, enumerable: true }); Object.defineProperty(pvScroll, "offsetHeight", { value: 520, writable: true, configurable: true, enumerable: true }); };
const cardsOf = (hgt) => { const real = document.createElement; document.createElement = (t) => { const e = real(t); Object.defineProperty(e, "offsetTop", { get() { return /\bpv-cards\b/.test(this.className) ? 94 : 0; }, configurable: true }); Object.defineProperty(e, "offsetHeight", { get() { return /\bpv-cards\b/.test(this.className) ? hgt : 0; }, configurable: true }); return e; }; return () => { document.createElement = real; }; };
{ seed(); sized(616, 600); fns.openPreview("a"); await advance(400); const back = cardsOf(200);
  start(300, 400, inList); await advance(16); move(292, 400, inList); await advance(16); move(192, 400, inList); await advance(16); move(420, 400, inList); back();
  const other = peeks[peeks.length - 1]; out.foot = { bottom: other.style.bottom, h: pvBox.style.height }; end(inList); await advance(400); unsized(); }
// ---------- a slide reset by a close (its copies gone with it) whose leftover end comes after a reopen touches nothing of the new preview's own slide ----------
{ await openOn("a"); const n0 = peeks.length; byId.get("pvNext").fire("click", { detail: 1 }); await advance(100); key("Escape"); const firstLeft = peeks.slice(n0).filter((p) => !p.removed).length;
  await advance(50); fns.openPreview("c"); await advance(100); fns.previewGo(1); const mid = look().id; await advance(110); const at360 = fns.previewSlide(); await advance(400);
  out.staleEnd = { firstLeft, mid, at360: at360 && at360.to, landed: look(), left: peeks.slice(n0).filter((p) => !p.removed).length }; }
// ---------- a finger's let-go: the copy of the page going out starts where the finger left the list ----------
{ await openOn("a"); const at_ = [], af = pvScroll.after; pvScroll.after = (p) => { at_.push(p.style.transform); af(p); }; await drag([[300, 400], [292, 401], [280, 401], [240, 402]]); pvScroll.after = af; out.flingCopy = at_; }
// ---------- a new tap soon after a slide is a tap (its touch lets its own click through) ----------
{ await openOn("a"); start(300, 400, inList); await advance(16); move(292, 400, inList); await advance(16); move(200, 400, inList); end(inList); await advance(240);
  start(380, 30, inBar); await advance(60); end(inBar); const ev = { detail: 1, target: byId.get("pvNext"), defaultPrevented: false }; pvBox.fire("click", ev); if (!ev.defaultPrevented) byId.get("pvNext").fire("click", { detail: 1 });
  await advance(400); out.tapAfter = { eaten: ev.defaultPrevented, ...look() }; }
// ---------- a sync that takes the workout away while a question is up over the preview: the question goes with it ----------
{ const st = () => ({ open: !!fns.previewState(), ask: !byId.get("askSheet").hidden, pick: !byId.get("pickSheet").hidden, skip: !byId.get("skipSheet").hidden, days: !!fns.datePicker(), asking: app.get().asking, mainInert: main.inert, headerInert: header.inert });
  out.syncGone = {};
  for (const label of ["Delete workout", "Skip", "Copy workout", "Reschedule"]) {
    await openOn("a"); byId.get("pvMore").fire("click", { detail: 1 }); pick(label).fire("click", {}); await advance(400);
    maps.trainings.delete("a"); ui.render(); await flush(); out.syncGone[label] = st();
    if (!byId.get("askSheet").hidden) byId.get("askNo").fire("click", {}); if (!byId.get("pickSheet").hidden) byId.get("pickNo").fire("click", {}); if (!byId.get("skipSheet").hidden) byId.get("skKeep").fire("click", {}); if (fns.datePicker()) fns.closeDatePicker(); await flush(); } }
// ---------- VoiceOver's line never tells of another workout or an old day ----------
{ await openOn("a"); byId.get("pvNext").fire("click", { detail: 1 }); ui.render(); await advance(400); const landed = byId.get("pvSay").textContent;
  byId.get("pvMore").fire("click", { detail: 1 }); pick("Reschedule").fire("click", {});
  const dp = fns.datePicker(), pk = dp && dp.onPick; fns.closeDatePicker(); if (pk) pk(day(4)); await advance(100); const moved = byId.get("pvSay").textContent;
  fns.closePreview(); fns.openPreview("d"); await advance(400); const reopened = byId.get("pvSay").textContent; fns.closePreview();
  await openOn("m2"); byId.get("pvNext").fire("click", { detail: 1 }); await advance(400); const missed = byId.get("pvSay").textContent;
  byId.get("pvMore").fire("click", { detail: 1 }); pick("Do it today").fire("click", {}); await advance(100);
  out.sayLine = { landed, moved, reopened, missed, today: byId.get("pvSay").textContent }; }
// ---------- after Skip or Delete, focus comes back into the sheet: a keyboard's (left on the closed question's button) and a pointer's (the body) ----------
{ const into = []; pvBox.focus = (o) => { into.push(o); document.activeElement = pvBox; };
  const run = async (label, btn, detail, active) => { await openOn("a"); byId.get("pvMore").fire("click", { detail }); pick(label).fire("click", {}); await advance(400); document.activeElement = active(); into.length = 0; byId.get(btn).fire("click", { detail }); await flush(); await advance(400); return { into: into.length, on: look().id }; };
  out.focusBack = { keyDel: await run("Delete workout", "askYes", 0, () => byId.get("askYes")), keySkip: await run("Skip", "skGo", 0, () => byId.get("skGo")), pointerSkip: await run("Skip", "skGo", 1, () => document.body) };
  delete pvBox.focus; document.activeElement = null; }
// ---------- a pull of the sheet with its "…" menu open takes the menu away as the sheet starts to move ----------
{ await openOn("a"); byId.get("pvMore").fire("click", { detail: 1 }); const open_ = !byId.get("whenBg").hidden;
  start(200, 30, inBar); for (const y of [45, 80, 130]) { await advance(16); move(200, y, inBar); }
  out.menuPull = { open: open_, pulled: pvBox.style.transform, menuGone: byId.get("whenBg").hidden }; await advance(100); end(inBar); await advance(600);
  out.menuPull.after = { up: !!fns.previewState(), sheet: pvBox.style.transform, menuGone: byId.get("whenBg").hidden }; }
// ---------- from a scrolled list: the veil stays over that list's cards and leaves with them, the name going at once; landed, the header at rest over the new list's top ----------
{ await openOn("a"); pvScroll.scrollTop = 300; pvScroll.fire("scroll", {}); const before = { ...veil(), top: pvScroll.classList.contains("pv-top") };
  byId.get("pvNext").fire("click", { detail: 1 }); const outP = peeks[peeks.length - 1]; await advance(16); pvScroll.fire("scroll", {});   // the list's own scroll event, from being put at its top at the let-go, a frame later
  const during = { ...veil(), outScroll: outP.scrollTop, listScroll: pvScroll.scrollTop, top: pvScroll.classList.contains("pv-top") }; await advance(400);
  out.veil = { before, during, landed: { id: look().id, ...veil(), scrollTop: pvScroll.scrollTop, top: pvScroll.classList.contains("pv-top") } }; pvScroll.scrollTop = 0; }
// ---------- the "…" dims when it has nothing to offer (a sync finished the workout); never under the slide after Skip ----------
{ seed({ clientMode: true, myClientId: "c1" }); fns.openPreview("a"); await advance(400); const before = byId.get("pvMore").hidden;
  maps.trainings.get("a").completedAt = new Date().toISOString(); ui.render(); const off = { id: look().id, off: byId.get("pvMore").hidden }; fns.closePreview();
  seed({ clientMode: true, myClientId: "c1" }); fns.openPreview("a"); await advance(400); byId.get("pvMore").fire("click", { detail: 1 }); pick("Skip").fire("click", {}); await advance(400); byId.get("skGo").fire("click", {}); const underSlide = byId.get("pvMore").hidden; await advance(400);
  out.moreOff = { before, ...off, underSlide, landed: { ...look(), off: byId.get("pvMore").hidden } }; }
// ---------- the rest: each a check that failed on one deliberate break of the code ----------
{ await openOn("m1"); out.g04 = (byId.get("pvDay").children || []).map((k) => k.textContent).join(""); }
{ seed(); const tools = mk("div"); tools.offsetWidth = 156; pvBar.querySelector = (s) => (s === ".pv-tools" ? tools : null);   // the header's name room: centred where it fits on the narrower side, else between the cross and the buttons; after a sync's rename and a turn
  document.createRange = () => { let n = null; return { selectNodeContents(x) { n = x; }, getBoundingClientRect: () => ({ width: 10 * String((n && n.textContent) || "").length }) }; };   // 10 points a letter
  const bt = byId.get("pvBarTitle"), room = () => bt.style.left + " " + bt.style.right;
  fns.openPreview("a"); await advance(400); const short = room();
  maps.trainings.get("a").title = "Upper body strength day"; fns.render(); const renamed = room();
  pvBar.clientWidth = 700; for (const f of WIN.resize || []) { try { f(); } catch (_) {} } const turned = room();
  pvBar.clientWidth = 402; delete pvBar.querySelector; delete document.createRange; out.g13 = { short, renamed, turned }; }
{ await openOn("c"); for (const id of ["pvPrev", "pvNext", "pvBox"]) byId.get(id).focus = function () { document.activeElement = this; };   // a keyboard's › onto the last workout: its focus to ‹, never left on a dimmed arrow
  byId.get("pvNext").focus(); byId.get("pvNext").fire("click", { detail: 0 }); await advance(400); const f = document.activeElement;
  out.g12 = { on: look().id, nextDim: byId.get("pvNext").disabled, focus: f === byId.get("pvPrev") ? "prev" : f === byId.get("pvNext") ? "next" : f === pvBox ? "box" : "other" };
  for (const id of ["pvPrev", "pvNext", "pvBox"]) delete byId.get(id).focus; document.activeElement = null; }
{ await openOn("a"); const at_ = [], af = pvScroll.after; pvScroll.after = (p) => { at_.push(p.style.transform); af(p); };   // each page placed before anything moves it: the one coming in at its own side, the copy going out where the list is
  byId.get("pvNext").fire("click", { detail: 1 }); await advance(400); byId.get("pvPrev").fire("click", { detail: 1 }); await advance(400); pvScroll.after = af; out.g15 = at_; }
{ await openOn("a"); const hist = () => byId.get("histSub").textContent, h0 = hist(); byId.get("pvNext").fire("click", { detail: 1 }); await advance(100);   // a sync during the slide is drawn as it lands, not before
  maps.trainings.get("d").completedAt = new Date().toISOString(); ui.render(); const mid = hist(); await advance(400); out.g19 = { h0, mid, landed: hist() }; }
{ await openOn("a"); start(300, 400, inList); await advance(16); move(292, 400, inList); await advance(16); move(270, 400, inList); end(inList); await advance(100);   // a workout deleted elsewhere while a short slide springs back: the preview closes as it lands
  maps.trainings.delete("a"); ui.render(); const mid = (fns.previewState() || {}).id || null; await advance(400); out.g33 = { mid, landed: (fns.previewState() || {}).id || null }; }
{ await openOn("a"); const m = fns.monthWheel({ closest: (s) => (s === "#pvBox" ? pvBox : null) }); m.begin(); m.move(-90); const peek = peeks[peeks.length - 1];   // closed mid-slide (Escape under two fingers): the page sliding in goes with it
  key("Escape"); m.end(); out.g21 = { open: !!fns.previewState(), peekGone: !!(peek && peek.removed), list: pvScroll.style.transform }; }
{ await openOn("a"); const click = (target) => { const ev = { type: "click", target, detail: 1, stopped: false, stopPropagation() { this.stopped = true; }, preventDefault() { this.defaultPrevented = true; } };   // the click after a slide that began on › is eaten before the button hears it (the DOM's order)
    const run = (node, capture) => { for (const x of [...((node.H || {}).click || [])]) if (!ev.stopped && (x.o === true || !!(x.o && x.o.capture)) === capture) x.fn(ev); };
    run(pvBox, true); run(target, false); run(pvBox, false); return ev; };
  start(300, 30, inBar); await advance(16); move(292, 30, inBar); await advance(16); move(285, 30, inBar); end(inBar); await advance(50);
  const ev = click(byId.get("pvNext")); await advance(400); out.g22 = { eaten: ev.stopped, on: look().id }; }
{ await openOn("a"); byId.get("pvNext").fire("click", { detail: 1 }); await advance(100); const m = fns.monthWheel({ closest: (s) => (s === "#pvBox" ? pvBox : null) });   // two fingers while an arrow's slide lands: it lands at once and they take the next one
  const began = !!(m && m.begin()); if (began) { m.move(-100); m.end(); } await advance(400); out.g23 = { began, on: look().id }; }
{ await openOn("a"); byId.get("pvMore").fire("click", { detail: 1 }); const MI = fns.menuIcons();   // each row of the "…" its own glyph
  out.g25 = (byId.get("whenPop").children || []).map((b) => Object.keys(MI).find((k) => MI[k] === b.innerHTML) || "?"); key("Escape"); }
{ seed(); maps.clients.set("c3", { id: "c3", name: "Lee", unit: "lb" }); maps.trainings.set("x", { ...W("x", 1, "08:00"), clientId: "c3" }); app.set({ view: { name: "client", id: "c3" } }); fns.render();   // Delete on a client's only workout: the preview closes, the page behind is redrawn
  const listShown = byId.get("trainingEmpty").hidden; fns.openPreview("x"); await advance(400);
  byId.get("pvMore").fire("click", { detail: 1 }); pick("Delete workout").fire("click", {}); await advance(400); byId.get("askYes").fire("click", {}); await flush(); await advance(400);
  out.g28 = { listShown, open: !!fns.previewState(), empty: byId.get("trainingEmpty").hidden === false }; }
{ await openOn("a"); pvScroll.scrollTop = 300; pvScroll.fire("scroll", {}); const d = await drag([[300, 400], [298, 400], [290, 400], [230, 401]]); pvScroll.scrollTop = 0;   // from a scrolled list, a small first move: claimed at 8
  out.g29 = { p: d.p, x: d.during.slide && d.during.slide.x, on: d.landed.id }; }
{ await openOn("a"); start(300, 400, inList); await advance(16); move(288, 410, inList); await advance(16); move(280, 440, inList); const sheet = pvBox.style.transform, pull = fns.previewDrag(), slide = fns.previewSlide();   // 40 degrees: nobody's
  end(inList); await advance(600); out.g30 = { sheet, pull, slide, on: look().id }; }
{ await openOn("a"); byId.get("pvMore").fire("click", { detail: 1 }); pick("Reschedule").fire("click", {});   // the days up, a sync deletes the workout: both go, and the next preview is not left inert
  maps.trainings.delete("a"); ui.render(); const gone = { pv: !!fns.previewState(), days: !!fns.datePicker() };
  fns.openPreview("b"); await advance(400); out.g08 = { ...gone, open: (fns.previewState() || {}).id || null, pvInert: pvSheet.inert }; }
{ await openOn("a"); byId.get("pvMore").fire("click", { detail: 1 }); const was = !byId.get("whenBg").hidden; maps.trainings.delete("a"); ui.render();   // the menu up, a sync deletes the workout: the menu goes with the preview
  out.g09 = { was, open: !!fns.previewState(), menu: !byId.get("whenBg").hidden }; if (!byId.get("whenBg").hidden) key("Escape"); }
{ await openOn("a"); byId.get("pvMore").fire("click", { detail: 1 }); const was = !byId.get("whenBg").hidden; maps.trainings.get("a").completedAt = new Date().toISOString(); ui.render();   // the menu up, a sync changes what it offers: it closes, the preview stays
  out.g35 = { was, menu: !byId.get("whenBg").hidden, open: (fns.previewState() || {}).id || null }; if (!byId.get("whenBg").hidden) key("Escape"); }
{ await openOn("a"); byId.get("pvMore").fire("click", { detail: 1 }); pick("Reschedule").fire("click", {}); const up = !!fns.datePicker();   // Escape with the days up closes the days only
  key("Escape"); out.g10 = { up, days: !!fns.datePicker(), preview: !!fns.previewState() }; }
// ---------- a second review of the slide (each finding checked by a skeptic, most measured in WebKit) ----------
// after Skip or Delete moves on from the first or the last workout still to do: the arrow toward the one that went is dimmed as the slide begins, and stays so
{ const ends = async (from, label, btn, view) => { await openOn(from, view); byId.get("pvMore").fire("click", { detail: 1 }); pick(label).fire("click", {}); await advance(400); byId.get(btn).fire("click", {}); await flush(); const mid = look(); await advance(400); return { mid, landed: look() }; };
  const endsNew = async (from, label, btn) => { seed(); for (const id of ["f", "s", "om"]) maps.trainings.delete(id); fns.render(); fns.openPreview(from); await advance(400); byId.get("pvMore").fire("click", { detail: 1 }); pick(label).fire("click", {}); await advance(400); byId.get(btn).fire("click", {}); await flush(); const mid = look(); await advance(400); return { mid, landed: look() }; };   // a client with no History yet
  out.endsAfter = { delFirst: await endsNew("m2", "Delete workout", "askYes"), skipMid: await ends("m2", "Skip", "skGo"), clientSkipMid: await ends("m2", "Skip", "skGo", { clientMode: true, myClientId: "c1" }), skipLast: await ends("d", "Skip", "skGo"), delLast: await ends("d", "Delete workout", "askYes") }; }
// the two pages and the header's veil set off in one style change: no layout read between the page going out's move and the one coming in's (with no height to ease, nothing else reads it after them)
{ const together = async (go) => {
    await openOn("a"); const back = cardsOf(2000), log = [], made_ = document.createElement;   // the next workout as tall as the sheet's cap: no height eased
    document.createElement = (t) => { const e = made_(t); let tf = ""; Object.defineProperty(e.style, "transform", { get: () => tf, set: (v) => { tf = v; log.push({ e, v }); }, configurable: true }); return e; };
    Object.defineProperty(pvBox, "clientWidth", { get: () => { log.push("read"); return 402; }, configurable: true });
    Object.defineProperty(pvBox, "offsetHeight", { get: () => { log.push("read"); return 600; }, configurable: true });
    const sp = pvBar.style.setProperty; pvBar.style.setProperty = (k, v) => { if (k === "--pv-veil-x") log.push("veil=" + v); sp(k, v); };
    const n0 = peeks.length; await go();
    document.createElement = made_; back(); pvBar.style.setProperty = sp;
    Object.defineProperty(pvBox, "clientWidth", { value: 402, writable: true, configurable: true, enumerable: true }); Object.defineProperty(pvBox, "offsetHeight", { value: 600, writable: true, configurable: true, enumerable: true });
    const inP = peeks[n0], outP = peeks[n0 + 1], s = log.map((x) => (typeof x === "string" ? x : (x.e === inP ? "in=" : x.e === outP ? "out=" : "other=") + x.v));
    const ends = [s.lastIndexOf("out=translate3d(-402px,0,0)"), s.lastIndexOf("veil=-402px"), s.lastIndexOf("in=translate3d(0px,0,0)")];
    await advance(400); return ends.includes(-1) ? s : s.slice(Math.min(...ends), Math.max(...ends) + 1); };   // from the first of the three moves to the last
  out.oneFlush = { arrow: await together(async () => { byId.get("pvNext").fire("click", { detail: 1 }); }),
    finger: await together(async () => { start(300, 400, inList); await advance(16); move(292, 400, inList); await advance(16); move(200, 400, inList); end(inList); }) }; }
// a scroll bar that takes room (a Mac set to show them always, Windows): the copy going out draws the list's; a phone's or a trackpad's takes none
{ const keep = [pvScroll.offsetWidth, pvScroll.clientWidth], bar = {};
  for (const [k, ow, cw, sh] of [["classic", 402, 385, 1600], ["overlay", 402, 402, 1600], ["fits", 402, 385, 600]]) { await openOn("a"); pvScroll.offsetWidth = ow; pvScroll.clientWidth = cw; pvScroll.scrollHeight = sh; byId.get("pvNext").fire("click", { detail: 1 }); bar[k] = peeks[peeks.length - 1].style.overflowY || ""; await advance(400); }
  [pvScroll.offsetWidth, pvScroll.clientWidth] = keep; pvScroll.scrollHeight = 1600; out.outBar = bar; }
// a trackpad's coasting that carries on under a slide an arrow key began: the list lands at its top, as the page that slid in showed it; a second press meanwhile copies that workout out from its top
{ await openOn("a"); pvScroll.scrollTop = 300; pvScroll.fire("scroll", {}); key("ArrowRight"); const atGo = pvScroll.scrollTop;
  for (const y of [40, 90, 130]) { await advance(16); pvScroll.scrollTop = y; pvScroll.fire("scroll", {}); }   // WebKit goes on scrolling the list with the coasting, under the copies
  await advance(400); const landed = { id: look().id, scrollTop: pvScroll.scrollTop, ...veil() };
  pvScroll.scrollTop = 300; pvScroll.fire("scroll", {}); key("ArrowRight"); for (const y of [60, 120]) { await advance(16); pvScroll.scrollTop = y; pvScroll.fire("scroll", {}); }
  key("ArrowRight"); const outP = peeks[peeks.length - 1], twice = { id: look().id, outScroll: outP && outP.scrollTop, on: veil().on }; await advance(400);
  out.coast = { atGo, landed, twice }; pvScroll.scrollTop = 0; }
// a sync takes the workout going out away while the fingers hold a slide on to the next (after their last move, or in two fingers' rest): it lands at once on the one it went to
{ const gone = async (letGo) => { maps.trainings.delete("a"); ui.render(); letGo(); const r = { list: pvScroll.style.transform, title: byId.get("pvTitle").textContent, over: peeks.filter((p) => !p.removed).map((p) => p.children[0].textContent), slide: !!fns.previewSlide() }; await advance(400); return { ...r, landed: look() }; };   // over: the pages left over the list, by their titles
  await openOn("a"); start(300, 400, inList); await advance(16); move(292, 400, inList); await advance(16); move(200, 400, inList); const finger = await gone(() => end(inList));
  await openOn("a"); const m = fns.monthWheel({ closest: (s) => (s === "#pvBox" ? pvBox : null) }); m.begin(); m.move(-100); const wheel = await gone(() => m.end());
  out.fromGone = { finger, wheel }; }
// the sheet laid out to the fraction, as WebKit at 402 x 874 measured a slide from 9 exercises to 1 (the sheet 24 to 874 under its 1-point top border, its list 25 to 789.65625; the incoming cards' foot 270.703125 under their page's top): the pages that slide cover the list exactly, and the sheet keeps its height (nothing written on it)
{ seed(); const st = pvBox.style, gcs = globalThis.getComputedStyle, boxRect = pvBox.getBoundingClientRect, listRect = pvScroll.getBoundingClientRect;
  globalThis.getComputedStyle = (e) => (e === pvBox ? { borderTopWidth: "1px", borderBottomWidth: "0px", getPropertyValue: () => "" } : gcs(e));
  Object.defineProperty(pvBox, "offsetHeight", { get: () => Math.round(parseFloat(st.height) || 850), configurable: true });
  pvBox.getBoundingClientRect = () => { const h = parseFloat(st.height) || 850; return { top: 874 - h, bottom: 874, height: h, left: 0, right: 402, width: 402 }; };
  pvScroll.getBoundingClientRect = () => ({ top: 25, bottom: 789.65625, height: 764.65625, left: 0, right: 402, width: 402 });
  fns.openPreview("a"); await advance(400);
  const real = document.createElement; document.createElement = (t) => { const e = real(t); Object.defineProperty(e, "offsetTop", { get() { return /\bpv-cards\b/.test(this.className) ? 165.4375 : 0; }, configurable: true }); Object.defineProperty(e, "offsetHeight", { get() { return /\bpv-cards\b/.test(this.className) ? 105.265625 : 0; }, configurable: true }); return e; };
  const n0 = sizedAll.length;
  byId.get("pvNext").fire("click", { detail: 1 }); document.createElement = real; const pages = peeks.slice(-2).map((p) => p.style.top + " " + p.style.bottom);
  await advance(400); const writes = sizedAll.slice(n0); globalThis.getComputedStyle = gcs; pvBox.getBoundingClientRect = boxRect; pvScroll.getBoundingClientRect = listRect; unsized();
  out.fracPlace = { writes, pages }; }
// the menu up, a sync's redraw: the sheet keeps its one height, so its "…" stays where it is and the menu with it, two exercises added or not; a redraw that did move the "…" (none does now) would close the menu placed once under it
{ await openOn("a"); const more = byId.get("pvMore"), rc = pvCards.replaceChildren; let top = 414;
  more.getBoundingClientRect = () => ({ top, bottom: top + 44, left: 230, right: 274, width: 44, height: 44 });
  more.fire("click", { detail: 1 }); const was = !byId.get("whenBg").hidden;
  maps.trainings.get("d").title = "D2"; ui.render(); const same = !byId.get("whenBg").hidden;   // another workout changed: this one repainted as it was
  maps.trainings.set("a", { ...maps.trainings.get("a"), rows: [{ id: "x1", name: "Squat", label: "1", sets: "3", reps: "10" }, { id: "x2", name: "Lunge", label: "2", sets: "3", reps: "10" }] }); ui.render(); const stays = !byId.get("whenBg").hidden;   // two exercises added on another device: the "…" where it was
  pvCards.replaceChildren = (...k) => { top = 300; rc(...k); }; maps.trainings.set("a", { ...maps.trainings.get("a"), rows: [{ id: "x1", name: "Squat", label: "1", sets: "3", reps: "10" }] }); ui.render();   // a redraw that moves the "…"
  out.menuMoved = { was, same, stays, moved: !byId.get("whenBg").hidden, open: (fns.previewState() || {}).id || null };
  pvCards.replaceChildren = rc; delete more.getBoundingClientRect; if (!byId.get("whenBg").hidden) key("Escape"); }
// the "…" tapped while the sheet springs back from a short pull: nothing (its menu would open where the "…" is mid-spring and hang below it once the sheet is home)
{ await openOn("a"); start(200, 30, inBar); for (const y of [36, 44, 80, 120, 140]) { await advance(16); move(200, y, inBar); } await advance(120); end(inBar); const springing = !!pvBox.style.transition; await advance(100);
  byId.get("pvMore").fire("click", { detail: 1 }); const menu = !byId.get("whenBg").hidden; await advance(600); if (!byId.get("whenBg").hidden) key("Escape");
  byId.get("pvMore").fire("click", { detail: 1 }); out.moreSpring = { springing, menu, home: !byId.get("whenBg").hidden }; if (!byId.get("whenBg").hidden) key("Escape"); }
// ---------- the slide into History (his asks, 11 Nov): finished green, skipped grey, missed red (filed after a week, or this week's), still to do plain; History's say Show in History ----------
{ await openOn("f"); const seen = [];
  for (let i = 0; i < 6; i++) { const d = byId.get("pvDay"), st = /st-/.test(d.className || ""), w = st && d.children && d.children[0];
    seen.push({ id: look().id, day: d.className, word: w ? w.className + ":" + w.textContent : null, cards: pvCards.className, go: byId.get("pvGo").textContent, goCls: [...byId.get("pvGo").classes].sort().join(" "), more: !byId.get("pvMore").hidden, say: byId.get("pvSay").textContent });
    byId.get("pvNext").fire("click", { detail: 1 }); await advance(400); }
  out.states = seen; }
{ seed(); const h = { coachSkipped: fns.previewItems("s"), coachOldMissed: fns.previewItems("om") }; seed({ clientMode: true, myClientId: "c1" }); h.clientSkipped = fns.previewItems("s"); h.clientOldMissed = fns.previewItems("om"); out.histItems = h; }
// the keyboard on the "…" as the slide goes into History (its "…" not there): the keyboard's place moves to the arrows, never lost with it
{ await openOn("m2"); for (const id of ["pvPrev", "pvNext", "pvBox", "pvMore"]) byId.get(id).focus = function () { document.activeElement = this; };
  byId.get("pvMore").focus(); key("ArrowLeft"); await advance(400); const f = document.activeElement;
  out.moreFocus = { on: look().id, more: !byId.get("pvMore").hidden, focus: f === byId.get("pvPrev") ? "prev" : f === byId.get("pvNext") ? "next" : f === byId.get("pvMore") ? "more" : f === pvBox ? "box" : "other" };
  for (const id of ["pvPrev", "pvNext", "pvBox", "pvMore"]) delete byId.get(id).focus; document.activeElement = null; }
// a sync makes the previewed workout History while a keyboard is in its "…" menu, or in the days picked from it: the menu or the days go
// with the "…", and the keyboard lands on an arrow, never on the page (a review's catch)
// the header's name gets its room back when the "…" goes, also when a sync makes the workout History in the middle of a slide (the one path
// where only the arrows are redrawn: nothing tested it, a review's catch)
{ seed(); for (const id of ["a", "b"]) maps.trainings.get(id).title = "Upper body strength day";
  const tools = mk("div"); Object.defineProperty(tools, "offsetWidth", { get: () => (byId.get("pvMore").hidden ? 100 : 156), configurable: true }); pvBar.querySelector = (s) => (s === ".pv-tools" ? tools : null);   // the ‹ › pill and the "…" (100 without it)
  document.createRange = () => { let n = null; return { selectNodeContents(x) { n = x; }, getBoundingClientRect: () => ({ width: 10 * String((n && n.textContent) || "").length }) }; };   // 10 points a letter
  const bt = byId.get("pvBarTitle"), room = () => bt.style.left + " " + bt.style.right;
  fns.openPreview("a"); await advance(400); const open = { id: look().id, room: room() };
  byId.get("pvNext").fire("click", { detail: 1 }); await advance(16); const mid = { id: look().id, slide: !!fns.previewSlide(), room: room() };
  maps.trainings.get(mid.id).completedAt = new Date().toISOString(); fns.render(); const synced = { more: !byId.get("pvMore").hidden, room: room() };
  await advance(400); delete pvBar.querySelector; delete document.createRange; out.titleRoom = { open, mid, synced }; }
const hadContains = document.contains; document.contains = () => true;   // (a real page has it: the menu and the days hand focus back only to what is still in it)
{ await openOn("a"); for (const id of ["pvPrev", "pvNext", "pvBox", "pvMore"]) byId.get(id).focus = function () { document.activeElement = this; };
  const pop = byId.get("whenPop"), was = pop.contains; byId.get("pvMore").fire("click", { detail: 0 });
  const rows = pop.children || []; pop.contains = (n) => rows.includes(n); document.activeElement = rows[0] || null;
  const before = { menu: !byId.get("whenBg").hidden, inMenu: !!rows[0] };
  maps.trainings.get("a").completedAt = new Date().toISOString(); fns.render(); await advance(50);
  const f = document.activeElement;
  out.menuSync = { before, menu: !byId.get("whenBg").hidden, more: !byId.get("pvMore").hidden, focus: f === byId.get("pvPrev") ? "prev" : f === byId.get("pvNext") ? "next" : f === pvBox ? "box" : "other" };
  pop.contains = was; for (const id of ["pvPrev", "pvNext", "pvBox", "pvMore"]) delete byId.get(id).focus; document.activeElement = null; }
{ await openOn("a"); for (const id of ["pvPrev", "pvNext", "pvBox", "pvMore"]) byId.get(id).focus = function () { document.activeElement = this; };
  const pop = byId.get("whenPop"), was = pop.contains; byId.get("pvMore").fire("click", { detail: 0 });
  const rows = pop.children || [], row = pick("Reschedule"); pop.contains = (n) => rows.includes(n); document.activeElement = row;   // the keyboard on Reschedule
  row.fire("click", { detail: 0 }); pop.contains = was;                // the menu goes (the keyboard back on the "…", as a page does), the days come up
  const dp = fns.datePicker(), open = !!dp, back = !!dp && dp.back === byId.get("pvMore"); document.activeElement = null;   // (the keyboard among the days)
  maps.trainings.get("a").completedAt = new Date().toISOString(); fns.render(); await advance(50);
  const f = document.activeElement;
  out.daysSync = { open, back, closed: !fns.datePicker(), more: !byId.get("pvMore").hidden, focus: f === byId.get("pvPrev") ? "prev" : f === byId.get("pvNext") ? "next" : f === pvBox ? "box" : "other" };
  if (fns.datePicker()) fns.closeDatePicker(); for (const id of ["pvPrev", "pvNext", "pvBox", "pvMore"]) delete byId.get(id).focus; document.activeElement = null; }
document.contains = hadContains;
out.sizedAll = sizedAll.filter((w) => !w.startsWith("transition=") || /height/i.test(w));   // (the spring's own transform transition is not a size)
console.log(JSON.stringify(out));
process.exit(0);
