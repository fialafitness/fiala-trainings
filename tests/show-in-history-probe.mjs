// Run by show-in-history.test.js in its own process: Show in History, on one of History's workouts in the preview, opens the workout itself,
// from History (his ask, 14 Nov, v297). This loads the real app/main.js on a page that keeps its listeners, its place on a scrolled window,
// History's rows as they are drawn and the browser's steps (a Safari tab: each step recorded, a step back said a moment later). The swipe
// back's pictures are recorded as they are taken (the page, and where it was scrolled), and every timer runs on this probe's own clock. It
// prints, as JSON, what was on the screen at each step. (Started from cal-fold-probe.mjs.) The app's own swipe back and its pictures, with a
// browser's steps, are the Mac's (deskOn) in a browser tab; the home-screen app has the same pictures and no steps. A Safari tab on a phone
// takes none of the app's own: there Safari's swipe shows Safari's own picture of each step, which no probe can see.
import { byId, el, storage } from "./env.js";
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
// the document and the window keep their listeners; nothing is held up by a sheet, a picture or the top bar
const L = {}, WL = {};
document.addEventListener = (t, fn, o) => { (L[t] ||= []).push({ fn, capture: o === true || !!(o && o.capture) }); };
document.removeEventListener = (t, fn) => { const a = L[t] || []; const i = a.findIndex((x) => x.fn === fn); if (i >= 0) a.splice(i, 1); };
globalThis.addEventListener = (t, fn) => { (WL[t] ||= []).push(fn); };
globalThis.removeEventListener = (t, fn) => { const a = WL[t] || []; const i = a.indexOf(fn); if (i >= 0) a.splice(i, 1); };
const fireDoc = (type, ev = {}) => { ev.type = type; for (const l of [...(L[type] || [])]) l.fn(ev); };
const qs = document.querySelector; document.querySelector = (s) => (/sheet-bg|crop-view|header \.bar/.test(s) ? null : qs(s));
document.contains = (x) => !!x;
document.getElementById("whenBg").hidden = true;                                   // no menu up (an env.js stub starts visible)
// the browser's steps, as a Safari tab keeps them
const steps = [];
const hist = {
  length: 1, state: null, scrollRestoration: "auto",
  pushState(s) { steps.push("push " + s.fiala); this.state = s; this.length++; },
  replaceState(s) { this.state = s; },
  go(n) { steps.push("go " + n); const d = Math.max(0, ((this.state && this.state.fiala) || 0) + n); this.state = { fiala: d }; setTimeout(() => { for (const fn of [...(WL.popstate || [])]) fn({ state: this.state }); }, 5); },
};
Object.defineProperty(globalThis, "history", { value: hist, configurable: true, writable: true });
// the page's own elements: they keep what is put in them and their listeners
const kids = (e) => {
  e.replaceChildren = (...k) => { e.children = k; e.firstElementChild = k[0] || null; };
  e.appendChild = (c) => { e.children = [...e.children, c]; e.firstElementChild = e.children[0]; return c; };
  e.append = (...k) => { e.children = [...e.children, ...k]; e.firstElementChild = e.children[0] || null; };
  return e;
};
const listens = (e) => { const H = {}; e.addEventListener = (type, fn) => { (H[type] ||= []).push(fn); }; e.removeEventListener = (type, fn) => { const a = H[type] || []; const i = a.indexOf(fn); if (i >= 0) a.splice(i, 1); }; e.fire = (type, ev) => { for (const fn of [...(H[type] || [])]) fn(ev); }; return e; };
const recorder = (id, extra = {}) => { const e = listens(kids(el("div"))); Object.assign(e, extra); byId.set(id, e); return e; };
for (const id of ["calView", "calTrack", "calTitle", "calToday", "calPrev", "calNext", "pvGo"]) recorder(id, { clientWidth: 350 });   // (pvGo: the preview's foot)
const calWrap = recorder("calWrap"), weekView = recorder("weekView"), toggle = recorder("calToggle");
for (const id of ["week", "weekHead", "calToggleText", "tabbar", "meDisc"]) recorder(id);
calWrap.hidden = true;
// the window: 800 tall, scrolled; the client's page 1500 tall with its month, 1280 with its week (the month is 220 taller), any other page
// 2000; History's rows are drawn as they are made, and one scrolled into the middle puts History 700 down
let rawY = 0; const ROW_Y = 700;
const sec = (id) => document.getElementById(id);
const pageH = () => (!sec("vClient").hidden ? (calWrap.hidden ? 1280 : 1500) : 2000);
const maxY = () => Math.max(0, pageH() - 800);
Object.defineProperty(globalThis, "scrollY", { get: () => Math.min(rawY, maxY()), configurable: true });
Object.defineProperty(globalThis, "scrollTo", { value: (x, y) => { rawY = Math.max(0, Math.min(maxY(), Math.round(Number(y) || 0))); }, configurable: true, writable: true });
Object.defineProperty(document.documentElement, "scrollHeight", { get: () => pageH(), configurable: true });
const make = document.createElement;
document.createElement = (t) => { const e = listens(kids(make(t))); e.getClientRects = () => [1]; e.scrollIntoView = (o) => { e.scrolled = o; if (e.dataset && e.dataset.tid) rawY = ROW_Y; }; return e; };
const hl = recorder("histList");
const pathTo = (e, tid, up = []) => { for (const c of e.children || []) { if (c && c.dataset && c.dataset.tid === tid) return [...up, c]; const f = c && pathTo(c, tid, [...up, c]); if (f) return f; } return null; };
hl.querySelector = (s) => { const m = /data-tid="([^"]+)"/.exec(s); const p = m ? pathTo(hl, m[1]) : null; return p ? p[p.length - 1] : null; };
const block = (tid) => { const p = pathTo(hl, tid), o = p && p[p.length - 1].scrolled; return o ? o.block || null : null; };   // how its row was scrolled into view
const lit = (tid) => { const p = pathTo(hl, tid); return !!p && p[p.length - 1].classList.contains("flash"); };   // its row lit a moment (as a template's is, found again)
const shown = (tid) => { const p = pathTo(hl, tid); if (!p) return null; const up = p.slice(0, -1); return up.every((e) => !e.hidden) && up.filter((e) => /^month\b/.test(e.className || "")).every((e) => /\bopen\b/.test(e.className)); };   // its row drawn in History, every group it sits in open
// the swipe back's pictures: which page, and where the window was, the moment each is taken (the client's page with its week or its month)
const pics = [];
const SECTIONS = ["vClients", "vClient", "vTraining", "vHistory", "vClientCard", "vSettings"];
document.querySelectorAll = (sel) => sel !== "main > section" ? [] : SECTIONS.map((id) => {
  const real = sec(id);
  return { id, get hidden() { return real.hidden; }, getClientRects: () => (real.hidden ? [] : [1]), getBoundingClientRect: () => ({ top: 0, left: 0, width: 390, height: 800 }), querySelectorAll: () => [],
    cloneNode: () => { pics.push(id === "vClient" ? { page: id, y: globalThis.scrollY, week: calWrap.hidden } : { page: id, y: globalThis.scrollY }); return { style: {}, querySelectorAll: () => [] }; } };
});

for (const id of SECTIONS) sec(id).hidden = true;                                 // every page hidden as the page starts, till one is drawn
const app = (await import("../app/main.js")).internals();
const { fns, maps } = app;
fns.forceSwipe(true); fireDoc("pointerdown", {});                                 // the swipe back is on and the page has been touched: leaving takes its picture
const at = (n) => { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + n); return d; };
const W = (id, n, extra = {}) => ({ id, clientId: "c1", title: id.toUpperCase(), date: fns.localIso(at(n)), createdAt: "2026-01-01T10:00:00.000Z", completedAt: null, skippedAt: null, rows: [], ...extra });
const Y = new Date().getFullYear(), on = (y, m, d) => new Date(y, m - 1, d, 12);   // a day of an earlier year, at noon where the tests run
const done = (id, d) => ({ ...W(id, 0), date: fns.localIso(d), completedAt: d.toISOString() });   // finished on that day
const lastMonday = (() => { const d = at(0); d.setDate(d.getDate() - ((d.getDay() + 6) % 7) - 7); return d; })();   // last week's Monday: a month of this year (but in a year's first days), folded while This week has a workout
const drawPage = async (clientMode = false) => {                                   // the client's page, at its top, on its week; the coach comes to it from Clients (its own step, for Back)
  app.reset(); app.set({ signedIn: true, clientMode, myClientId: clientMode ? "c1" : null, tab: "workouts", view: clientMode ? { name: "client", id: "c1" } : { name: "clients" } });
  maps.clients.set("c1", { id: "c1", name: "Jane", unit: "lb" });
  for (const t of [
    done("old", on(Y - 2, 6, 10)), done("oldB", on(Y - 2, 10, 10)),                 // finished in June and October two years back: History keeps that year folded, and in it all but its latest month (October)
    done("old2", on(Y - 3, 3, 3)), done("old2B", on(Y - 3, 8, 8)),                  // the same three years back, for the client's own view
    W("wk", 0, { completedAt: at(0).toISOString() }),                               // finished today: This week
    { ...W("skip", 0), date: fns.localIso(lastMonday), skippedAt: lastMonday.toISOString() },   // skipped, last week: its month opened for it, whatever day this runs
    W("todo", 1),                                                                    // still to do
  ]) maps.trainings.set(t.id, t);
  fns.render(); if (!clientMode) fns.go({ name: "client", id: "c1" }); await flush();
  if (fns.calState().open) toggle.fire("click", {}); rawY = 0; fns.dropShots();
};
const look = () => { const v = app.get().view; return { view: v.name, id: v.id, from: v.from || null, shown: SECTIONS.filter((id) => !sec(id).hidden), preview: (fns.previewState() || {}).id || null, y: globalThis.scrollY }; };
let d0 = 0, s0 = 0;                                                                // the browser's steps as the tap came: the depth, and how many were recorded
const mark = () => { d0 = fns.navState().depth; s0 = steps.length; };
const nav = () => ({ depth: fns.navState().depth - d0, key: fns.navState().key, steps: steps.slice(s0).map((x) => x.replace(/^push (\d+)$/, (m, k) => "push +" + (k - d0))) });   // counted from the tap
const kept = (k) => { try { return JSON.parse(storage.getItem(k)); } catch (_) { return null; } };
const back = async () => { fns.goBackNow(); await flush(); await advance(50); };
const tap = async (id, detail = 1) => { fns.openPreview(id); if (detail) await advance(400); mark(); const go = byId.get("pvGo").textContent; byId.get("pvGo").fire("click", { detail }); return go; };   // the preview up (its 350 ms guard passed by a tap; a key acts at once), then its foot
const out = {};

// the coach, 600 down the client's month, opens a finished workout of an earlier year from the calendar and taps Show in History
await drawPage(); toggle.fire("click", {}); scrollTo(0, 600); out.before = { ...look(), month: !calWrap.hidden };
{ const n = pics.length; out.go = await tap("old");
  out.atOnce = { ...look(), ...nav(), pics: pics.slice(n) };                              // the same moment: no timer has run, nothing painted between
  await advance(50);
  out.after = { ...look(), ...nav(), backKey: fns.backKey(), backLabel: byId.get("backLabel").textContent, shots: fns.shotKeys(), page: kept("fiala.trainings.page"), kept: kept("fiala.trainings.view"), row: shown("old"), lit: lit("old"), block: block("old") };
  await back(); out.back1 = { ...look(), ...nav(), row: shown("old"), page: kept("fiala.trainings.page") };
  await back(); out.back2 = { ...look(), ...nav(), week: calWrap.hidden, page: kept("fiala.trainings.page") }; }

// the keyboard's Enter (or VoiceOver's) on it acts at once, as on Start workout; this week's workout: This week's group
await drawPage();
{ out.keyGo = await tap("wk", 0); await advance(50);
  out.key = { ...look(), ...nav(), row: shown("wk") };
  await back(); out.key.back1 = { ...look(), ...nav() }; await back(); out.key.back2 = { ...look(), ...nav() }; }

// a skipped workout: the same
await drawPage();
{ out.skipGo = await tap("skip"); await advance(50); out.skip = { ...look(), ...nav(), row: shown("skip") };
  await back(); out.skip.back1 = look(); await back(); out.skip.back2 = look(); }

// the coach's Settings say Open workouts in: Client: it opens in the client's look, as a tap on its row in History opens it
await drawPage(); fns.setOpenAs("client");
{ await tap("old"); await advance(50); out.asClient = { ...look(), client: fns.previewOn() };
  await back(); await back(); fns.setOpenAs("coach"); }

// the client's own app: their own History, the year two back opened for it
await drawPage(true);
{ out.clientGo = await tap("old2"); await advance(50);
  out.client = { ...look(), ...nav(), mode: app.get().clientMode, backLabel: byId.get("backLabel").textContent, row: shown("old2") };
  await back(); out.client.back1 = { ...look(), row: shown("old2") }; await back(); out.client.back2 = { ...look(), stepsLeft: fns.navState().depth }; }   // (their own page has no Back: no step behind it at all)

// gone while its preview was up (a sync deleted it): nothing opens, nothing is stepped, no picture taken
await drawPage();
{ fns.openPreview("old"); await advance(400); mark(); const n = pics.length; maps.trainings.delete("old"); byId.get("pvGo").fire("click", { detail: 1 }); await advance(50);
  out.gone = { ...look(), ...nav(), pics: pics.slice(n) }; }

// one still to do: Start workout opens it from the client's page, as always (Back goes there, not to History)
await drawPage();
{ out.todoGo = await tap("todo"); await advance(50); out.todo = { ...look(), ...nav(), backKey: fns.backKey() };
  await back(); out.todo.back = { ...look(), ...nav() }; }

console.log(JSON.stringify(out));
process.exit(0);
