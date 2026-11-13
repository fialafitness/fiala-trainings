// Run by cal-fold.test.js in its own process: the client page's month folds back into the week whenever the page is left (his ask,
// 10 Nov: "make it collapse back to week every time I leave the page"). The page keeps its listeners and its place on a scrolled window
// (the month 220 taller than the week), the swipe back's picture is recorded as it is taken, and every timer runs on this probe's own
// clock, so this loads the real app/main.js, opens the month with its own Month button, leaves the page every way there is and comes
// back, and prints, as JSON, what was on the screen at each step.
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
// the document keeps its listeners; nothing is held up by a sheet, a picture or the top bar
const L = {};
document.addEventListener = (t, fn, o) => { (L[t] ||= []).push({ fn, capture: o === true || !!(o && o.capture) }); };
document.removeEventListener = (t, fn) => { const a = L[t] || []; const i = a.findIndex((x) => x.fn === fn); if (i >= 0) a.splice(i, 1); };
globalThis.addEventListener = () => {}; globalThis.removeEventListener = () => {};
const qs = document.querySelector; document.querySelector = (s) => (/sheet-bg|crop-view|header \.bar/.test(s) ? null : qs(s));
document.contains = (x) => !!x;
const fireDoc = (type, ev = {}) => { ev.type = type; for (const l of [...(L[type] || [])]) l.fn(ev); };
// the page's own elements: they keep what is put in them and their listeners
const kids = (e) => {
  e.replaceChildren = (...k) => { e.children = k; e.firstElementChild = k[0] || null; };
  e.appendChild = (c) => { e.children = [...e.children, c]; e.firstElementChild = e.children[0]; return c; };
  e.append = (...k) => { e.children = [...e.children, ...k]; e.firstElementChild = e.children[0] || null; };
  return e;
};
const listens = (e) => { const H = {}; e.addEventListener = (type, fn) => { (H[type] ||= []).push(fn); }; e.removeEventListener = (type, fn) => { const a = H[type] || []; const i = a.indexOf(fn); if (i >= 0) a.splice(i, 1); }; e.fire = (type, ev) => { for (const fn of [...(H[type] || [])]) fn(ev); }; return e; };
const recorder = (id, extra = {}) => { const e = listens(kids(el("div"))); Object.assign(e, extra); byId.set(id, e); return e; };
for (const id of ["calView", "calTrack", "calTitle", "calToday", "calPrev", "calNext", "pvGo"]) recorder(id, { clientWidth: 350 });   // (pvGo: the preview's Start workout, which a workout in the calendar opens first since v262)
const calWrap = recorder("calWrap"), week = recorder("week"), weekView = recorder("weekView"), weekHead = recorder("weekHead"), toggleText = recorder("calToggleText"), toggle = recorder("calToggle");
const tabbar = recorder("tabbar"), meDisc = recorder("meDisc");
calWrap.hidden = true;
const make = document.createElement; document.createElement = (t) => listens(kids(make(t)));
// the window: 800 tall, scrolled; the client's page 1500 tall with its month, 1280 with its week (the month is 220 taller), any other page 2000
let rawY = 0;
const chipsOf = (b) => (b.children || []).filter((c) => c && c.className === "day-evs").reduce((n, c) => n + (c.children || []).filter((x) => (" " + (x.className || "") + " ").includes(" day-ev ")).length, 0);
const stripExtra = () => Math.max(0, Math.max(0, ...(week.children || []).map(chipsOf)) - 1);   // (each workout past the first on the strip's busiest day: 19 more, v285)
const pageH = () => (byId.get("vClient") && !byId.get("vClient").hidden ? (calWrap.hidden ? 1280 + 19 * stripExtra() : 1500) : 2000);
const maxY = () => Math.max(0, pageH() - 800);
Object.defineProperty(globalThis, "scrollY", { get: () => Math.min(rawY, maxY()), configurable: true });   // a page that got shorter holds the window at its end, as a browser does
Object.defineProperty(globalThis, "scrollTo", { value: (x, y) => { rawY = Math.max(0, Math.min(maxY(), Math.round(Number(y) || 0))); }, configurable: true, writable: true });
Object.defineProperty(document.documentElement, "scrollHeight", { get: () => pageH(), configurable: true });
// what the calendar row shows: the month or the week strip (its view, which holds the week before and after for the swipe, v285), the month's name above the strip, the button's word and its arrow
const calLook = () => ({ month: !calWrap.hidden, week: !weekView.hidden, head: !weekHead.hidden, toggle: toggleText.textContent, arrowUp: toggle.classList.contains("open") });
// the swipe back's picture: what the client's page showed, and where, the moment it is taken
const pics = [], wkPics = [];                                           // (and the strip's days in each picture: v285 pages it week by week)
const weekDays = () => (week.children || []).map((b) => (b.dataset && b.dataset.day ? b.dataset.day.slice(8) : "?")).join(" ");
const SECTIONS = ["vClients", "vClient", "vTraining", "vHistory", "vClientCard", "vSettings"];
document.querySelectorAll = (sel) => sel !== "main > section" ? [] : SECTIONS.map((id) => {
  const real = document.getElementById(id);
  return { id, get hidden() { return real.hidden; }, getClientRects: () => (real.hidden ? [] : [1]), getBoundingClientRect: () => ({ top: 0, left: 0, width: 390, height: 800 }), querySelectorAll: () => [],
    cloneNode: () => { if (id === "vClient") { pics.push({ ...calLook(), y: globalThis.scrollY }); wkPics.push(weekDays()); } return { style: {}, querySelectorAll: () => [] }; } };
});

const app = (await import("../app/main.js")).internals();
const { fns, maps } = app;
fns.forceSwipe(true); fireDoc("pointerdown", {});                        // the swipe back is on and the page has been touched: leaving takes its picture
const day = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return fns.localIso(d); };
const seen = () => ({ view: app.get().view.name, open: fns.calState().open, ...calLook(), y: globalThis.scrollY });
const drawPage = (clientMode = false, id = "c1") => {
  app.reset(); app.set({ signedIn: true, clientMode, myClientId: clientMode ? "c1" : null, tab: "workouts" });
  maps.clients.set("c1", { id: "c1", name: "Jane", unit: "lb" }); maps.clients.set("c2", { id: "c2", name: "Ann", unit: "lb" });
  maps.trainings.set("w1", { id: "w1", clientId: "c1", title: "Legs", date: day(0), createdAt: "2026-11-01T10:00:00.000Z", completedAt: null, skippedAt: null, rows: [] });
  app.set({ view: { name: "client", id } }); fns.render();
};
const clientPage = (clientMode = false, id = "c1") => {
  drawPage(clientMode, id);
  if (fns.calState().open) toggle.fire("click", {});                      // each step starts on the week (a step that stayed on the page left its month open), at the top
  rawY = 0;
};
const openMonth = () => { if (!fns.calState().open) toggle.fire("click", {}); };
const todayInMonth = () => {                                             // today's day in the month on the screen (the middle of the three)
  const panel = calTrack().children[1], grid = panel && panel.children[0], n = String(new Date().getDate());
  return grid && grid.children.find((b) => (b.children || []).some((s) => s.className === "dn" && s.textContent === n));
};
const calTrack = () => byId.get("calTrack");
const back = async () => { fns.goBackNow(); await flush(); await advance(50); };
const tab = (name) => tabbar.fire("click", { target: { closest: () => ({ dataset: { tab: name } }) } });
const out = {};

// the coach at the top of the page (the usual way: open a client, Month, a day): the picture and Back are the week; and the same over the
// client card
clientPage(); openMonth(); out.top = { before: seen() };
{ const b = todayInMonth(); out.top.found = !!b; const n = pics.length; if (b) { b.fire("click", {}); byId.get("pvGo").fire("click", { detail: 0 }); } await flush(); out.top.left = seen(); out.top.pic = pics.slice(n); }
await back(); out.top.back = seen();
clientPage(); openMonth();
{ const n = pics.length; meDisc.fire("click", {}); await flush(); out.topCard = { left: seen(), pic: pics.slice(n) }; }
await back(); out.topCard.back = seen();

// the coach, scrolled 600 down a month, taps today (one workout): the workout opens; the picture under the swipe back is the week, the list
// where it was (600 less the month's 220); Back lands there, on the week
clientPage(); openMonth(); scrollTo(0, 600); out.open = { before: seen() };
{ const b = todayInMonth(); out.open.found = !!b; const n = pics.length; if (b) { b.fire("click", {}); byId.get("pvGo").fire("click", { detail: 0 }); } await flush(); out.open.left = seen(); out.open.pic = pics.slice(n); }
await back(); out.open.back = seen();

// scrolled only into the month (100 down): the week from the top
clientPage(); openMonth(); scrollTo(0, 100);
{ const n = pics.length; const b = todayInMonth(); if (b) { b.fire("click", {}); byId.get("pvGo").fire("click", { detail: 0 }); } await flush(); out.shallow = { pic: pics.slice(n) }; }
await back(); out.shallow.back = seen();

// Back to Clients from the month, then another client's page: the week
clientPage(); openMonth(); out.toClients = { before: seen() };
await back(); out.toClients.left = seen();
app.set({ view: { name: "client", id: "c2" } }); fns.render(); out.toClients.other = seen();

// another tab and back: the week
clientPage(); openMonth(); tab("profile"); out.tabs = { away: seen() }; tab("workouts"); out.tabs.back = seen();

// the client card (the person disc) over the month, 600 down: the week under it, and Back where the list was
clientPage(); openMonth(); scrollTo(0, 600);
{ const n = pics.length; meDisc.fire("click", {}); await flush(); out.card = { left: seen(), pic: pics.slice(n) }; }
await back(); out.card.back = seen();

// History over the month, 600 down: the same
clientPage(); openMonth(); scrollTo(0, 600);
{ const n = pics.length; fns.openHistoryPage(); await flush(); out.history = { left: seen(), pic: pics.slice(n) }; }
await back(); out.history.back = seen();

// staying on the page: a sync's redraw, the Skip question opened and closed, another month: still the month
clientPage(); openMonth(); fns.render(); out.stay = { redraw: seen() };
fns.rowSkip("w1"); out.stay.asking = seen(); fns.closeSkip(); out.stay.closed = seen();
byId.get("calNext").fire("click", {}); await advance(400); out.stay.paged = { ...seen(), shown: fns.calState().month };

// the client's own view: a workout opened from the month, and Back
clientPage(true); openMonth(); scrollTo(0, 600);
{ const n = pics.length; const b = todayInMonth(); if (b) { b.fire("click", {}); byId.get("pvGo").fire("click", { detail: 0 }); } await flush(); out.client = { found: !!b, left: seen(), pic: pics.slice(n) }; }
await back(); out.client.back = seen();

// a week paged to (his pick, 13 Nov: "Leaving the client's page brings it back to this week"): a workout opened from it, the client card over
// it, Back to Clients: the picture and Back are this week's
for (const how of ["workout", "card", "clients", "tab", "month"]) {
  clientPage(); fns.setWeekOff(1); fns.render(); if (how === "month") openMonth(); const before = { off: fns.weekOffNow(), days: weekDays() }, n = wkPics.length;
  if (how === "workout" || how === "month") fns.go({ name: "training", id: "w1" }); else if (how === "card") meDisc.fire("click", {}); else if (how === "tab") tab("profile"); else await back();
  await flush(); const left = { view: app.get().view.name, off: fns.weekOffNow(), pic: wkPics.slice(n) };
  if (how === "clients") { app.set({ view: { name: "client", id: "c1" } }); fns.render(); } else if (how === "tab") tab("workouts"); else await back();
  (out.week ||= {})[how] = { before, left, back: { view: app.get().view.name, off: fns.weekOffNow(), days: weekDays(), today: !byId.get("weekToday").hidden } };
}

// a paged week whose strip is taller than this week's (two workouts on a day), 300 down: the list stays where it was on the screen as the
// strip comes back to this week, in the picture and on Back (the month's fold keeps it so too; the v285 review)
clientPage();
for (const id of ["w2", "w3"]) maps.trainings.set(id, { id, clientId: "c1", title: id === "w2" ? "Run" : "Swim", date: day(7), createdAt: "2026-11-01T10:00:00.000Z", completedAt: null, skippedAt: null, rows: [] });
fns.setWeekOff(1); fns.render(); scrollTo(0, 300);
{ const before = { y: globalThis.scrollY, h: pageH() }, n = pics.length; fns.go({ name: "training", id: "w1" }); await flush();
  out.place = { before, pic: pics.slice(n).map((p) => p.y), left: { h: pageH() } }; await back(); out.place.back = { y: globalThis.scrollY, off: fns.weekOffNow() }; }
clientPage();                                                            // ... and this week's strip the taller one (two on today): the list stays put the other way too
maps.trainings.set("w2", { id: "w2", clientId: "c1", title: "Run", date: day(0), createdAt: "2026-11-01T10:00:00.000Z", completedAt: null, skippedAt: null, rows: [] });
fns.setWeekOff(1); fns.render(); scrollTo(0, 300);
{ const before = { y: globalThis.scrollY, h: pageH() }, n = pics.length; fns.go({ name: "training", id: "w1" }); await flush();
  out.placeUp = { before, pic: pics.slice(n).map((p) => p.y) }; await back(); out.placeUp.back = { y: globalThis.scrollY, off: fns.weekOffNow() }; }

// the Month button still opens and closes it, and writes nothing on the device either way
clientPage();
{ const keep = () => JSON.stringify([...storage.map]), s0 = keep(); toggle.fire("click", {}); out.toggle = { open: seen(), wroteOnOpen: keep() !== s0 };
  const s1 = keep(); toggle.fire("click", {}); out.toggle.closed = seen(); out.toggle.wroteOnClose = keep() !== s1; }

console.log(JSON.stringify(out));
process.exit(0);
