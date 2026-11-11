// Run by preview-swipe.test.js in its own process: the workout preview's header and its swipe down to close (his asks, 11 Nov, with
// Calendar's event sheet beside them; measured on the test iPhone, iOS 27.2). The sheet, its header and its list keep their listeners and
// their styles, every timer runs on this probe's own clock, and the fingers are played as WebKit delivers them (each with its identifier,
// the lifted one in changedTouches; the overlay hears every touch's start and end first, as its capture listener does); it prints, as JSON,
// what each one did.
import { byId, el } from "./env.js";
import { ui } from "../app/state.js";
// the clock: every timer the app sets is this one's, and so is performance.now
let NOW = 10000, SEQ = 0; const Q = [];
globalThis.setTimeout = (fn, ms) => { const id = ++SEQ; Q.push({ id, at: NOW + Math.max(0, ms || 0), fn }); return id; };
globalThis.clearTimeout = (id) => { const i = Q.findIndex((q) => q.id === id); if (i >= 0) Q.splice(i, 1); };
try { performance.now = () => NOW; } catch (_) { Object.defineProperty(globalThis, "performance", { value: { now: () => NOW }, configurable: true }); }
{ const t0 = Date.now() - NOW; Date.now = () => t0 + NOW; }
const flush = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };
async function advance(ms) {
  const end = NOW + ms;
  for (;;) { Q.sort((a, b) => a.at - b.at || a.id - b.id); const q = Q[0]; if (!q || q.at > end) break; Q.shift(); NOW = Math.max(NOW, q.at); q.fn(); await flush(); }
  NOW = end; await flush();
}
// the document keeps its listeners (Escape)
const L = {};
document.addEventListener = (t, fn, o) => { (L[t] ||= []).push({ fn, capture: o === true || !!(o && o.capture) }); };
document.removeEventListener = (t, fn) => { const a = L[t] || []; const i = a.findIndex((x) => x.fn === fn); if (i >= 0) a.splice(i, 1); };
const WIN = {}; globalThis.addEventListener = (t, fn) => { (WIN[t] ||= []).push(fn); }; globalThis.removeEventListener = () => {};   // the window keeps its listeners (a turn: resize)
const fireDoc = (type, ev) => { ev.type = type; ev.preventDefault = () => {}; for (const l of [...(L[type] || [])]) l.fn(ev); return ev; };
// the sheet's own elements: they keep their listeners (and the options they were added with), what is put in them, their styles (custom
// properties too) and their classes
const kids = (e) => { e.replaceChildren = (...k) => { e.children = k; }; e.appendChild = (c) => { e.children = [...e.children, c]; return c; }; e.append = (...k) => { e.children = [...e.children, ...k]; }; return e; };
const listens = (e) => { const H = {}, O = {}; e.opts = O; e.addEventListener = (type, fn, o) => { (H[type] ||= []).push(fn); O[type] = o; }; e.removeEventListener = (type, fn) => { const a = H[type] || []; const i = a.indexOf(fn); if (i >= 0) a.splice(i, 1); }; e.fire = (type, ev) => { for (const fn of [...(H[type] || [])]) fn(ev); return ev; }; return e; };
const styled = (e) => { const st = {}; st.setProperty = (k, v) => { st[k] = v; }; st.removeProperty = (k) => { delete st[k]; }; e.style = st; return e; };
const recorder = (id, extra = {}) => { const e = styled(listens(kids(el("div")))); Object.assign(e, extra); byId.set(id, e); return e; };
const pvSheet = recorder("pvSheet"), pvBar = recorder("pvBar");
let hidden = true; const shown = [];                                       // the header as it is at the moment the sheet comes up
Object.defineProperty(pvSheet, "hidden", { get: () => hidden, set: (v) => { hidden = !!v; if (!v) shown.push({ titled: pvBar.classList.contains("pv-titled"), on: pvBar.style["--pv-on"] }); }, configurable: true });
const pvBox = recorder("pvBox", { offsetHeight: 600 });                   // a sheet 600 tall: half is 300, a quarter 150
const pvScroll = recorder("pvScroll", { scrollTop: 0, scrollHeight: 1600, clientHeight: 600 }), pvTitle = recorder("pvTitle"), pvCards = recorder("pvCards");
let paints = 0; { const rc = pvCards.replaceChildren; pvCards.replaceChildren = (...k) => { paints++; rc(...k); }; }   // the cards repainted (a redraw)
for (const id of ["pvBarTitle", "pvX", "pvGo", "pvDay", "pvMore", "pvPrev", "pvNext", "pvSay"]) recorder(id);
recorder("whenBg", { hidden: true });                                      // the menu layer, hidden as in the page
const TITLE_AT = 94;                                                      // the big title's top below the sheet's, at rest (the list's own padding)
pvBox.getBoundingClientRect = () => ({ top: 200, left: 0, width: 402, height: 600, right: 402, bottom: 800 });
pvTitle.getBoundingClientRect = () => ({ top: 200 + TITLE_AT - pvScroll.scrollTop, left: 20, width: 300, height: 30, right: 320, bottom: 230 + TITLE_AT - pvScroll.scrollTop });
const app = (await import("../app/main.js")).internals();
const { fns, maps } = app;
const day = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return fns.localIso(d); };
// fingers as WebKit delivers them: every finger down in touches (with its identifier), the ones that came or went in changedTouches, the
// target the touch began on, the moment, and whether the page may still refuse it (once iOS scrolls the list itself, cancelable false)
const F = new Map(); let cancelable = true;
const open = () => {
  fns.closePreview(); app.reset(); app.set({ signedIn: true, clientMode: false, tab: "workouts" });
  maps.clients.set("c1", { id: "c1", name: "Jane", unit: "lb" });
  maps.trainings.set("w1", { id: "w1", clientId: "c1", title: "Legs", date: day(1), createdAt: "2026-11-01T10:00:00.000Z", completedAt: null, skippedAt: null, rows: [] });
  app.set({ view: { name: "client", id: "c1" } }); fns.render(); pvScroll.scrollTop = 0; F.clear(); cancelable = true;
  return fns.openPreview("w1");
};
const openAt = async () => { open(); await advance(100); };              // opened, and iOS has had 100 ms to take up that its list does not bounce at its top
const T = (id, x, y) => ({ identifier: id, clientX: x, clientY: y });
const tev = (target, changed) => ({ touches: [...F.entries()].map(([id, p]) => T(id, p.x, p.y)), changedTouches: changed, target, timeStamp: NOW, cancelable, defaultPrevented: false, preventDefault() { if (this.cancelable) this.defaultPrevented = true; } });
const inBar = { closest: () => null }, inList = { closest: (s) => (s === "#pvScroll" ? pvScroll : null) }, inButton = { closest: () => null };
const card = { isConnected: true, H: {}, closest: (s) => (s === "#pvScroll" ? pvScroll : s === "#pvCards" ? pvCards : null) };   // a card in the list: it keeps the listeners the sheet puts on it (gone when their signal aborts)
card.addEventListener = (type, fn, o) => { const rec = { fn, o }; (card.H[type] ||= []).push(rec); if (o && o.signal) o.signal.addEventListener("abort", () => { card.H[type] = card.H[type].filter((x) => x !== rec); }); };
card.fire = (type, ev) => { for (const x of [...(card.H[type] || [])]) x.fn(ev); return ev; };
card.listening = () => Object.values(card.H).reduce((n, a) => n + a.length, 0);
const fire = (type, ev, on = pvBox) => { if (on === pvBox) { pvSheet.fire(type, ev); const t = ev.target; if (t && t.fire && t.isConnected) t.fire(type, ev); } return on.fire(type, ev); };   // the overlay (its capture listener), the card it is on (the target's own), then the sheet; an event on a card the page no longer holds reaches that card's own listeners only
const startMany = (fs, target) => { F.clear(); for (const [id, x, y] of fs) F.set(id, { x, y }); return fire("touchstart", tev(target, fs.map(([id, x, y]) => T(id, x, y)))); };
const start = (x, y, target, n = 1) => startMany(Array.from({ length: n }, (_, i) => [i + 1, x, y]), target);
const move = (x, y, target, on = pvBox) => { for (const id of F.keys()) F.set(id, { x, y }); return fire("touchmove", tev(target, [...F.keys()].map((id) => T(id, x, y))), on); };
const moveOne = (id, x, y, target) => { F.set(id, { x, y }); return fire("touchmove", tev(target, [T(id, x, y)])); };
const end = (target, type = "touchend", on = pvBox) => { const ch = [...F.entries()].map(([id, p]) => T(id, p.x, p.y)); F.clear(); return fire(type, tev(target, ch), on); };
const join = (id, x, y, target) => { F.set(id, { x, y }); return fire("touchstart", tev(target, [T(id, x, y)])); };
const lift = (id, target) => { const p = F.get(id); F.delete(id); return fire("touchend", tev(target, [T(id, p.x, p.y)])); };
const look = () => ({ up: !!fns.previewState(), transform: pvBox.style.transform || "", dim: pvSheet.style.backgroundColor || "", drag: fns.previewDrag() });
const after = () => ({ ...look(), transition: pvBox.style.transition || "", dimTransition: pvSheet.style.transition || "" });
const scrollTo = (s) => { pvScroll.scrollTop = s; pvScroll.fire("scroll", {}); };   // iOS scrolls the list (its scroll event)
const topped = () => pvScroll.classList.contains("pv-top");
// a pull from y0 to y1 in steps of `step` points every `every` ms, then a rest of `rest` ms before letting go
async function pull(y0, y1, { target = inBar, step = 10, every = 16, rest = 0, x = 200, type = "touchend" } = {}) {
  start(x, y0, target); const prevented = [];
  for (let y = y0 + step; step > 0 ? y <= y1 : y >= y1; y += step) { await advance(every); prevented.push(move(x, y, target).defaultPrevented); }
  const during = look(); await advance(rest);
  end(target, type); const a = after();
  await advance(700); return { prevented, during, after: a, settled: look() };
}
// moves of the given [ms, y] after a touch at y0, then the lift on the last move's own moment
async function flick(y0, steps, { target = inBar, x = 300 } = {}) {
  start(x, y0, target); const prevented = [];
  for (const [ms, y] of steps) { await advance(ms); prevented.push(move(x, y, target).defaultPrevented); }
  const during = look(); end(target); const a = after(); await advance(700);
  return { prevented, during, after: a, settled: look() };
}
const out = {};
// ---------- the header: at rest the sheet itself; once anything scrolls under it, see-through (fully by 10 points); its name comes in as
// the big title's letters go under its edge; the name written in it; at rest again whenever the sheet goes ----------
{ open(); const at = (s) => { scrollTo(s); return { on: pvBar.style["--pv-on"], titled: pvBar.classList.contains("pv-titled") }; };
  out.header = { rest: at(0), five: at(5), ten: at(10), under: at(30), gone: at(40), back: at(0) };
  out.barText = byId.get("pvBarTitle").textContent; }
{ open(); scrollTo(40); const titled = pvBar.classList.contains("pv-titled");
  fns.closePreview(); const closed = { titled: pvBar.classList.contains("pv-titled"), on: pvBar.style["--pv-on"] };
  shown.length = 0; app.set({ view: { name: "client", id: "c1" } }); pvScroll.scrollTop = 0; fns.openPreview("w1");   // opened again, no scroll event
  out.reopen = { titled, closed, atShow: shown[0], now: { titled: pvBar.classList.contains("pv-titled"), on: pvBar.style["--pv-on"] } };
  scrollTo(240); const r = await pull(100, 290, { rest: 200 }); out.reopen.keptOnSpringBack = { titled: pvBar.classList.contains("pv-titled"), on: pvBar.style["--pv-on"], up: r.settled.up }; }
// ---------- a pull from the header: nothing refused in its first 10 points (a tap that rolls stays a tap), then the sheet follows ----------
{ open(); start(200, 100, inBar); await advance(16); const first = move(200, 105, inBar); const firstLook = look(); await advance(16);
  const second = move(200, 130, inBar); out.follow = { first: { prevented: first.defaultPrevented, ...firstLook }, second: { prevented: second.defaultPrevented, ...look() } };
  end(inBar); await advance(700); }
{ open(); start(40, 40, inBar); await advance(30); const m = move(41, 42, inBar); await advance(60); end(inBar); out.tap = { prevented: m.defaultPrevented, ...look() }; await advance(700); }   // a tap on the cross that rolls
{ open(); start(200, 100, inBar); await advance(16); const up3 = move(200, 97, inBar); const still = look(); const prevented = [];
  for (let y = 110; y <= 200; y += 10) { await advance(16); prevented.push(move(200, y, inBar).defaultPrevented); }
  out.headerRollUp = { up3: up3.defaultPrevented, still: still.drag, prevented, during: look() }; await advance(200); end(inBar); await advance(700); }   // a finger that rolls up first, then pulls
open(); out.slowBack = await pull(100, 290, { rest: 200 });                // 180 pulled (of 600), let go at rest: back
open(); out.slowClose = await pull(100, 440, { rest: 200 });               // 330 pulled: past half, closed
open(); pvScroll.scrollTop = 50; out.headerScrolled = await pull(100, 440, { rest: 200 });   // the header pulls whatever the list's place
open(); out.fromButton = await pull(700, 1100, { target: inButton, rest: 200 });   // outside the list (Start workout): the sheet's, like the header
// ---------- flicks: where the sheet would coast to (its pull and 0.099 s of its speed) past half closes; a fast flick (1,000 a second or
// more, in a touch of 50 ms or more) closes past a quarter ----------
open(); out.flickFast = await pull(100, 250, { step: 30, every: 15 });     // 140 at 2,000 a second in 75 ms: closed
open(); out.flickSlow = await pull(100, 280, { step: 9, every: 10 });      // 170 at 900: coasts to 259, short of half, and too slow a flick: back
open(); out.flickNear = await pull(100, 150, { step: 10, every: 10 });     // 40 at 1,000 in 50 ms: coasts to 139, short of a quarter: back
open(); out.flickPast = await pull(100, 180, { step: 10, every: 10 });     // 70 at 1,000 in 80 ms: coasts to 169, past a quarter: closed
open(); out.flickQuick = await pull(100, 180, { step: 20, every: 10 });    // 70 at 2,000, but 40 ms from touch to lift: back
open(); out.flickQuick50 = await pull(100, 200, { step: 20, every: 10 });  // 90 at 2,000 in 50 ms: closed
open(); out.simFlick = await flick(58, [[29, 98], [24, 158], [30, 218]]);   // as the test iPhone handed one over (logged 11 Nov): moves 29, 24 and 30 ms apart, the lift on the last one's own moment
open(); out.slowLast = await flick(100, [[29, 160], [24, 220], [30, 232]]);   // fast, then a slow last move: its speed from 40 ms back (1,333 a second), closed; from the last move alone (400) it would come back
{ open(); start(200, 100, inBar); await advance(200); for (const y of [125, 150, 175, 200]) { await advance(10); move(200, y, inBar); }   // still for 200 ms, then a flick of 2,500 a second
  end(inBar); out.restFlick = { after: after() }; await advance(700); out.restFlick.settled = look(); }
open(); out.restBefore = await pull(100, 250, { step: 30, every: 15, rest: 61 });   // still for 61 ms before lifting: no speed, 140 pulled, back
open(); out.restBefore60 = await pull(100, 250, { step: 30, every: 15, rest: 60 });   // 60 ms: its speed counts, closed
// past half, then flung back up: where it would coast to decides (measured: fast up comes back, a slow drift up still closes)
async function pastHalf(steps) { start(200, 100, inBar); for (let y = 110; y <= 500; y += 10) { await advance(16); move(200, y, inBar); } for (const [ms, y] of steps) { await advance(ms); move(200, y, inBar); } const during = look(); end(inBar); const a = after(); await advance(700); return { during, after: a, settled: look() }; }
open(); out.flungUp = await pastHalf([[10, 470], [10, 440], [10, 410]]);   // 390 down, then up at about 1,700 a second, let go at 300
open(); out.driftUp = await pastHalf([[10, 495], [10, 490], [10, 485], [10, 480]]);   // up at 500 a second, let go at 370: coasts to 320, closed
{ open(); start(200, 100, inBar); for (let y = 110; y <= 200; y += 10) { await advance(16); move(200, y, inBar); } for (const y of [180, 160, 140]) { await advance(10); move(200, y, inBar); }   // 30 pulled, flicked back up (960 a second at the lift, 32 sheet-distances a second toward its place): at the most 15
  const during = look(); end(inBar); const a = after(); await advance(700); out.flickUpNear = { during, after: a, settled: look() }; }
// ---------- the list: nothing on it is ever refused (iOS scrolls it as its own); at its top and still, a pull from it is the sheet's (it
// does not bounce there); scrolled, it scrolls back first and the sheet stays; up, it scrolls; once it moves, the touch is its own ----------
await openAt(); out.listTop = await pull(400, 520, { target: inList, rest: 200 });
await openAt(); pvScroll.scrollTop = 50; out.listScrolled = await pull(400, 520, { target: inList, rest: 200 }); pvScroll.scrollTop = 0;
await openAt(); out.listUp = await pull(400, 340, { target: inList, step: -10, rest: 200 });
{ await openAt(); start(200, 400, inList); const p = []; await advance(16); p.push(move(200, 399, inList).defaultPrevented); const waiting = look().drag;
  await advance(16); p.push(move(200, 395, inList).defaultPrevented); const still = look().drag;
  for (const y of [385, 370]) { await advance(16); p.push(move(200, y, inList).defaultPrevented); } out.listRollUp = { prevented: p, waiting, still, drag: look().drag }; end(inList); await advance(700); }
{ await openAt(); start(200, 400, inList); const p = []; await advance(16); p.push(move(201, 400, inList).defaultPrevented);
  for (const y of [396, 380]) { await advance(16); p.push(move(201, y, inList).defaultPrevented); } out.listRollSide = { prevented: p, drag: look().drag }; end(inList); await advance(700); }
{ await openAt(); start(200, 400, inList); const p = []; await advance(16); p.push(move(200, 401, inList).defaultPrevented); const waiting = look().drag;
  for (const y of [403, 410, 420, 430]) { await advance(16); p.push(move(200, y, inList).defaultPrevented); } out.listRollDown = { prevented: p, waiting, during: look() }; await advance(200); end(inList); await advance(700); out.listRollDown.settled = look(); }
{ await openAt(); start(200, 400, inList); cancelable = false; const p = []; for (const y of [405, 415, 430, 460]) { await advance(16); p.push(move(200, y, inList).defaultPrevented); }   // iOS already scrolling it (its moves can no longer be refused): at its top it cannot move it, and the sheet follows
  out.listNative = { prevented: p, during: look() }; await advance(200); end(inList); cancelable = true; await advance(700); out.listNative.settled = look(); }
{ await openAt(); start(200, 400, inList); await advance(100); const p = [move(200, 401.2, inList).defaultPrevented]; cancelable = false;   // still, a point of roll, then a flick down at 4,700 a second as iOS begins scrolling the list
  for (const y of [412, 440, 480, 530, 590]) { await advance(8); p.push(move(200, y, inList).defaultPrevented); }
  const during = look(); end(inList); cancelable = true; const a = after(); await advance(700); out.listFlick = { prevented: p, during, after: a, settled: look() }; }
{ await openAt(); start(200, 400, inList); const p = []; for (const y of [410, 425]) { await advance(16); p.push(move(200, y, inList).defaultPrevented); } const down = look();   // pulled 15, then back up past where it started: iOS scrolls the list
  for (const y of [405, 395]) { await advance(16); p.push(move(200, y, inList).defaultPrevented); } const back = look();
  scrollTo(10); const scrolled = look(); await advance(16); p.push(move(200, 380, inList).defaultPrevented); end(inList); await advance(700);
  out.listDownUp = { prevented: p, down, back, scrolled, settled: look(), topped: topped() }; pvScroll.scrollTop = 0; }
// ---------- the list's top, taken up: at open; gone once it scrolls; back when it is at its top and still (scrollend, or a second after it
// last moved), never while a finger is on the sheet; a pull from it only once iOS has had 100 ms; a list with nothing to scroll ----------
{ await openAt(); const atOpen = topped(); scrollTo(30); const scrolled = topped();
  start(200, 400, inList); await advance(16); const m = move(200, 420, inList); const scrolledTouch = { prevented: m.defaultPrevented, drag: look().drag, transform: look().transform }; end(inList); await advance(700);
  scrollTo(0); const backAtZero = topped(); pvScroll.fire("scrollend", {}); const afterEnd = topped();
  start(200, 400, inList); await advance(16); move(200, 420, inList); const soon = look().drag; end(inList); await advance(100);
  start(200, 400, inList); await advance(16); move(200, 420, inList); const later = look(); end(inList); await advance(700);
  out.topLife = { atOpen, scrolled, scrolledTouch, backAtZero, afterEnd, soon, later: { drag: later.drag, transform: later.transform } }; }
{ await openAt(); scrollTo(30); scrollTo(0); await advance(999); const at999 = topped(); await advance(1); const at1000 = topped();
  scrollTo(30); start(200, 100, inBar); scrollTo(0); pvScroll.fire("scrollend", {}); await advance(1500); const held = topped();
  end(inBar); const atLift = topped(); await advance(999); const lift999 = topped(); await advance(1); out.topWait = { at999, at1000, held, atLift, lift999, lift1000: topped() }; }
{ pvScroll.scrollHeight = 601; await openAt(); const fits = pvScroll.classList.contains("pv-fits");   // nothing to scroll (within a point): the sheet's, as the header
  start(200, 400, inList); const p = []; for (let y = 410; y <= 500; y += 10) { await advance(16); p.push(move(200, y, inList).defaultPrevented); } const during = look(); await advance(200); end(inList); await advance(700);
  start(200, 400, inList); await advance(16); const up = move(200, 380, inList); const upDrag = look().drag; end(inList); await advance(700);
  pvScroll.scrollHeight = 1600; ui.render(); out.fits = { fits, prevented: p, during, upPrevented: up.defaultPrevented, upDrag, afterGrow: pvScroll.classList.contains("pv-fits") }; }
{ await openAt(); scrollTo(1000); pvScroll.fire("scrollend", {}); const atEnd = topped(); await advance(1000); out.endRest = { atEnd, later: topped() }; pvScroll.scrollTop = 0; }   // at rest at its end: it still bounces there
{ await openAt(); scrollTo(30); scrollTo(0); await advance(300); scrollTo(-20); await advance(400); scrollTo(0); await advance(600); const bounce = topped(); await advance(400); const bounceEnd = topped();   // its bounce at the top: a second after its last move there
  scrollTo(30); scrollTo(0); await advance(500); scrollTo(30); scrollTo(0); await advance(600); const away = topped(); await advance(400);   // away and back again: the second starts again
  out.lastMove = { bounce, bounceEnd, away, awayEnd: topped() }; }
{ await openAt(); scrollTo(30); start(200, 400, inList); await advance(16); move(200, 380, inList); scrollTo(0); end(inList, "touchcancel"); await advance(1000); out.cancelTop = topped(); }   // iOS cancels the touch: as a lift
{ await openAt(); start(200, 100, inBar); fns.closePreview(); await openAt(); scrollTo(30); scrollTo(0); await advance(1000); out.reopenFingers = topped(); }   // a touch whose end never came (the app put away mid-touch), then the sheet closed: the next one opens with no finger on it
{ await openAt(); scrollTo(130); pvScroll.fire("scrollend", {}); await advance(400); const p0 = paints;   // a sync's redraw under a finger scrolling the list: its lift heard on the card it began on
  start(200, 300, card); await advance(16); move(200, 320, card); scrollTo(110); ui.render(); const painted = paints - p0; card.isConnected = false;
  for (const [y, s] of [[380, 50], [440, 0]]) { await advance(16); move(200, y, card, card); scrollTo(s); }
  end(card, "touchend", card); card.isConnected = true; pvScroll.fire("scrollend", {}); const atEnd = topped(); await advance(100);
  const r = await pull(400, 640, { target: card, step: 20, every: 16 }); out.liftOnDetached = { painted, atEnd, during: r.during.transform, closed: !r.settled.up, left: card.listening() }; }
{ await openAt(); scrollTo(30); scrollTo(0); start(200, 400, inList); const p = []; for (const y of [410, 420, 430]) { await advance(16); p.push(move(200, y, inList).defaultPrevented); }   // back at its top, not yet still: the list's (it bounces there)
  out.unsettled = { prevented: p, ...look() }; end(inList); await advance(700); }
{ await openAt(); start(200, 400, card); const p = []; for (const y of [410, 420]) { await advance(16); p.push(move(200, y, card).defaultPrevented); }   // pulled from the list, turned back: iOS's own scroll began at the last move it could still be refused at (20 down, as measured), and takes the list as the finger comes back above it
  cancelable = false; for (const y of [430, 440, 430, 421]) { await advance(16); p.push(move(200, y, card).defaultPrevented); }
  const before = look(); await advance(16); move(200, 419, card); scrollTo(1); const at = after();
  cancelable = true; await advance(16); end(card); await advance(700); out.listTurnBack = { prevented: p, before, at, settled: look() }; pvScroll.scrollTop = 0; }
{ await openAt(); scrollTo(300); start(200, 100, inBar); for (let y = 110; y <= 200; y += 10) { await advance(16); move(200, y, inBar); scrollTo(400 - y); }   // the header pulled while the list under it still coasts
  out.headerCoast = look(); end(inBar); await advance(700); pvScroll.scrollTop = 0; }
{ open(); start(100, 100, inBar); await advance(16); const m = move(116, 130, inBar); out.diagonal = { prevented: m.defaultPrevented, ...look() }; end(inBar); await advance(700); }   // 16 sideways and 30 down in one move: the sheet's
{ pvScroll.scrollHeight = 601; await openAt(); const fits = pvScroll.classList.contains("pv-fits"); const turn = () => { for (const fn of WIN.resize || []) if (/pvFit/.test(String(fn))) fn({}); };   // turned: the same cards no longer fit, then fit again
  pvScroll.clientHeight = 400; turn(); const turned = pvScroll.classList.contains("pv-fits"); pvScroll.clientHeight = 600; turn();
  out.turn = { fits, turned, back: pvScroll.classList.contains("pv-fits") }; pvScroll.scrollHeight = 1600; }
{ await openAt(); scrollTo(30); startMany([[1, 200, 400]], card); await advance(16); join(2, 250, 400, card); await advance(16); lift(2, card); card.isConnected = false;   // two fingers on one card: the second lifts, a redraw takes the card, then the first lifts (heard on the card, its own listener left by the second's lift)
  { const p = F.get(1); F.delete(1); card.fire("touchend", tev(card, [T(1, p.x, p.y)])); } card.isConnected = true; scrollTo(0); await advance(1000); out.twoOnCard = topped(); }
{ await openAt(); start(200, 100, card); for (let y = 110; y <= 460; y += 10) { await advance(16); move(200, y, card); } const far = look().transform;   // pulled past half from the list, and the list moves under it: home, whatever the let-go rule would say
  scrollTo(5); const at = after(); await advance(16); end(card); await advance(700); out.listTakenFar = { far, at: { transform: at.transform, drag: at.drag, sprung: /^transform \d+ms cubic/.test(at.transition) }, settled: look() }; pvScroll.scrollTop = 0; }
{ await openAt(); start(200, 400, card); for (const y of [410, 420]) { await advance(16); move(200, y, card); } cancelable = false;   // the list's scroll reported late, the finger already going down again: home by the spring from rest, never first away from its place
  for (const y of [430, 440, 450, 470, 490]) { await advance(16); move(200, y, card); } scrollTo(1); const at = after(); cancelable = true; await advance(16); end(card); await advance(700);
  out.listTakenLate = { transition: at.transition, transform: at.transform, settled: look() }; pvScroll.scrollTop = 0; }
// ---------- sideways; two fingers pull it as one (measured); a finger joining or leaving mid-pull; a touch cancelled; up past the start ----------
{ open(); start(100, 100, inBar); await advance(16); const m = move(130, 105, inBar); out.sideways = { prevented: m.defaultPrevented, ...look() }; end(inBar); await advance(700); }
{ open(); startMany([[1, 150, 100], [2, 250, 100]], inBar); const p = []; for (let d = 10; d <= 200; d += 10) { await advance(16); F.set(1, { x: 150, y: 100 + d }); F.set(2, { x: 250, y: 100 + d }); p.push(fire("touchmove", tev(inBar, [T(1, 150, 100 + d), T(2, 250, 100 + d)])).defaultPrevented); }
  out.twoFingers = { prevented: p.some(Boolean), during: look() }; await advance(200); end(inBar); out.twoFingers.after = after(); await advance(700); out.twoFingers.settled = look(); }
{ open(); start(200, 100, inBar); for (let y = 110; y <= 250; y += 10) { await advance(16); move(200, y, inBar); }
  const before = look(); await advance(16); join(2, 300, 400, inBar); const atJoin = look();
  for (const dd of [10, 20]) { await advance(16); F.set(1, { x: 200, y: 250 + dd }); F.set(2, { x: 300, y: 400 + dd }); fire("touchmove", tev(inBar, [T(1, 200, 250 + dd), T(2, 300, 400 + dd)])); }
  const both = look(); await advance(16); lift(1, inBar); const firstUp = look(); await advance(16); moveOne(2, 300, 440, inBar); const secondOn = look();
  await advance(200); lift(2, inBar); const a = after(); await advance(700); out.join = { before, atJoin, both, firstUp, secondOn, after: a, settled: look() }; }
open(); out.cancel = await pull(100, 290, { rest: 200, type: "touchcancel" });   // iOS takes the touch mid-pull: it settles as a lift would
{ open(); start(200, 100, inBar); for (let y = 110; y <= 160; y += 10) { await advance(16); move(200, y, inBar); } const down = look();
  for (let y = 150; y >= 70; y -= 10) { await advance(16); move(200, y, inBar); } out.clamp = { down, up: look() }; await advance(200); end(inBar); await advance(700); }
// ---------- a sync's redraw while a finger is on the sheet waits (the card under it is never rebuilt), and comes after: at the lift, when
// the touch turns out to be the list's, when the spring ends or the sheet closes; a touch that never came up holds it 10 s at the most; a card
// a redraw took out of the page all the same still passes its finger's moves and lift on ----------
{ await openAt(); const p0 = paints; start(200, 400, card); for (let y = 410; y <= 500; y += 10) { await advance(16); move(200, y, card); } ui.render(); const whilePulled = paints - p0;
  await advance(200); end(card); await advance(100); ui.render(); const whileSpringing = paints - p0; await advance(700);
  out.syncHeld = { whilePulled, whileSpringing, after: paints - p0, up: look().up }; }
{ open(); const p0 = paints; start(200, 100, inBar); await advance(30); ui.render(); const held = paints - p0; await advance(30); end(inBar); out.tapFlush = { held, atLift: paints - p0, up: look().up }; await advance(700); }
{ await openAt(); pvScroll.scrollTop = 50; const p0 = paints; start(200, 400, inList); await advance(16); ui.render(); const held = paints - p0; await advance(16); move(200, 380, inList);
  out.dropFlush = { held, atDrop: paints - p0, drag: look().drag }; end(inList); await advance(700); pvScroll.scrollTop = 0; }
{ open(); const bl = document.getElementById("backLabel"); bl.textContent = "stale"; start(200, 100, inBar); for (let y = 110; y <= 440; y += 10) { await advance(16); move(200, y, inBar); }
  ui.render(); const held = bl.textContent; await advance(200); end(inBar); await advance(700); out.closeFlush = { held, after: bl.textContent, up: look().up }; }
{ open(); const p0 = paints; start(200, 100, inBar); await advance(16); move(200, 103, inBar); await advance(10001); ui.render(); out.lostLift = { after10s: paints - p0 }; end(inBar); await advance(700); }
{ await openAt(); start(200, 400, card); for (let y = 410; y <= 450; y += 10) { await advance(16); move(200, y, card); } const listening = card.listening();
  card.isConnected = false; for (let y = 460; y <= 500; y += 10) { await advance(16); move(200, y, card, card); } const followed = look();
  await advance(200); end(card, "touchend", card); const a = after(); card.isConnected = true; await advance(700);
  out.detached = { listening, followed, after: a, settled: look(), left: card.listening() }; }
// ---------- a catch while it springs back; Escape while it is pulled; reduced motion ----------
{ open(); start(200, 100, inBar); for (let y = 110; y <= 290; y += 10) { await advance(16); move(200, y, inBar); } await advance(200); end(inBar);
  await advance(100); start(200, 300, inBar); await advance(16); move(200, 340, inBar); out.caught = look(); end(inBar); await advance(800); out.caught.after = look(); }
{ open(); start(200, 100, inBar); for (let y = 110; y <= 250; y += 10) { await advance(16); move(200, y, inBar); }
  fireDoc("keydown", { key: "Escape" }); out.escape = look(); end(inBar); await advance(700); out.escape.after = look(); }
{ const mm = globalThis.matchMedia; globalThis.matchMedia = (q) => ({ matches: /reduce/.test(q), addEventListener() {}, removeEventListener() {} });
  try {
    open(); out.calmBack = await pull(100, 290, { rest: 200 }); open(); out.calmClose = await pull(100, 440, { rest: 200 });
    { open(); const p0 = paints; start(200, 100, inBar); for (let y = 110; y <= 290; y += 10) { await advance(16); move(200, y, inBar); } ui.render(); const held = paints - p0; await advance(200); end(inBar); out.calmFlush = { held, atLift: paints - p0, up: look().up }; await advance(700); }
  } finally { globalThis.matchMedia = mm; } }
out.opts = { touchstart: pvBox.opts.touchstart, touchmove: pvBox.opts.touchmove, scroll: pvScroll.opts.scroll, scrollend: pvScroll.opts.scrollend, fingers: pvSheet.opts.touchstart };
console.log(JSON.stringify(out));
process.exit(0);
