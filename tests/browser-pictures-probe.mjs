// Run by browser-pictures.test.js in its own process: a phone's browser tab (Safari, or Chrome on Android), where the swipe back from the
// left edge is the browser's and slides in the browser's own picture of the page underneath. WebKit takes that picture as the next step is
// added (addItem), from the screen as last drawn (v297; measured on the simulator, 14 Nov: after Start workout and after Show in History the
// swipe back showed the preview sheet over the client's page). This loads the real app/main.js as a phone's tab: a coarse pointer, not the
// home-screen app, the browser's steps kept. The screen is drawn every 16 ms on this probe's own clock (requestAnimationFrame's callbacks
// first, as a browser runs them), and each step added files the last drawn screen as the picture of the step it leaves: which page, which
// sheets, menus or pickers were over it, and whether the client's month was open. (Started from show-in-history-probe.mjs.)
import { byId, el } from "./env.js";
let NOW = 10000, SEQ = 0; const Q = [], RAF = [];
globalThis.setTimeout = (fn, ms) => { const id = ++SEQ; Q.push({ id, at: NOW + Math.max(0, ms || 0), fn }); return id; };
globalThis.clearTimeout = (id) => { const i = Q.findIndex((q) => q.id === id); if (i >= 0) Q.splice(i, 1); };
globalThis.requestAnimationFrame = (fn) => { const id = ++SEQ; RAF.push({ id, fn }); return id; };
globalThis.cancelAnimationFrame = (id) => { const i = RAF.findIndex((r) => r.id === id); if (i >= 0) RAF.splice(i, 1); };
try { performance.now = () => NOW; } catch (_) { Object.defineProperty(globalThis, "performance", { value: { now: () => NOW }, configurable: true }); }
const flush = async () => { for (let i = 0; i < 30; i++) await Promise.resolve(); };
let nextFrame = NOW + 16, drawn = null, drawnTitle = null, frames = 0;
async function advance(ms) {                                                     // timers and frames in time order; a frame runs the callbacks asked for before it, then the screen is drawn
  const end = NOW + ms;
  for (;;) {
    Q.sort((a, b) => a.at - b.at || a.id - b.id); const q = Q[0];
    if (nextFrame <= end && (!q || nextFrame <= q.at)) { NOW = nextFrame; nextFrame += 16; const due = RAF.splice(0); for (const r of due) r.fn(NOW); await flush(); drawn = screen(); drawnTitle = sec("vTraining").hidden ? null : document.getElementById("tTitle").value; frames++; continue; }
    if (!q || q.at > end) break;
    Q.shift(); NOW = Math.max(NOW, q.at); q.fn(); await flush();
  }
  NOW = end; await flush();
}
// the document and the window keep their listeners
const L = {}, WL = {};
document.addEventListener = (t, fn, o) => { (L[t] ||= []).push({ fn, capture: o === true || !!(o && o.capture) }); };
document.removeEventListener = (t, fn) => { const a = L[t] || []; const i = a.findIndex((x) => x.fn === fn); if (i >= 0) a.splice(i, 1); };
globalThis.addEventListener = (t, fn) => { (WL[t] ||= []).push(fn); };
globalThis.removeEventListener = (t, fn) => { const a = WL[t] || []; const i = a.indexOf(fn); if (i >= 0) a.splice(i, 1); };
const fireDoc = (type, ev = {}) => { ev.type = type; for (const l of [...(L[type] || [])]) l.fn(ev); };
const qs = document.querySelector; document.querySelector = (s) => (/sheet-bg|crop-view|header \.bar/.test(s) ? null : qs(s));
document.contains = (x) => !!x;
let coarse = true;                                                               // a phone: a finger, not a mouse; not the home-screen app, not a computer
globalThis.matchMedia = (q) => ({ matches: coarse && /pointer: coarse/.test(q), addEventListener() {}, removeEventListener() {} });
// the browser's steps, as a phone's tab keeps them: each step added files the last drawn screen as the picture of the one it leaves
const steps = [], pics = [];
const hist = {
  length: 1, state: null, scrollRestoration: "auto",
  pushState(s) { pics.push({ leaves: (this.state && this.state.fiala) || 0, picture: drawn, title: drawnTitle }); steps.push("push " + s.fiala); this.state = s; this.length++; },
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
const listens = (e) => { const H = {}; e.addEventListener = (type, fn) => { (H[type] ||= []).push(fn); }; e.removeEventListener = (type, fn) => { const a = H[type] || []; const i = a.indexOf(fn); if (i >= 0) a.splice(i, 1); }; e.fire = (type, ev = {}) => { for (const fn of [...(H[type] || [])]) fn({ stopPropagation() {}, preventDefault() {}, target: e, ...ev }); }; return e; };
const recorder = (id, extra = {}) => { const e = listens(kids(el("div"))); Object.assign(e, extra); byId.set(id, e); return e; };
for (const id of ["ctxDim", "ctxLift", "whenPop", "tMore", "tAdd", "calView", "calTrack", "calTitle", "calToday", "calPrev", "calNext", "pvGo", "pvEdit", "pvMore", "pickList", "pickNo", "pickUp", "pickSheet", "draftSave", "draftDiscard", "draftBar", "useBtn", "usePick", "dayMore", "datePick", "dpGrid", "dpCancel", "askSheet", "askYes", "askNo"]) recorder(id, { clientWidth: 350 });
const calWrap = recorder("calWrap"), toggle = recorder("calToggle");
for (const id of ["week", "weekView", "weekHead", "calToggleText", "tabbar", "meDisc"]) recorder(id);
calWrap.hidden = true;
for (const id of ["pickSheet", "datePick", "askSheet", "draftBar", "usePick", "ctxDim", "ctxLift"]) byId.get(id).hidden = true;
document.getElementById("whenBg").hidden = true; document.getElementById("pvSheet").hidden = true;
// the window: 800 tall; any page 2000, the client's 1500 with its month and 1280 with its week; History's row scrolled into the middle puts it 700 down
let rawY = 0;
const sec = (id) => document.getElementById(id);
const pageH = () => (!sec("vClient").hidden ? (calWrap.hidden ? 1280 : 1500) : 2000);
const maxY = () => Math.max(0, pageH() - 800);
Object.defineProperty(globalThis, "scrollY", { get: () => Math.min(rawY, maxY()), configurable: true });
Object.defineProperty(globalThis, "scrollTo", { value: (x, y) => { rawY = Math.max(0, Math.min(maxY(), Math.round(Number(y) || 0))); }, configurable: true, writable: true });
Object.defineProperty(document.documentElement, "scrollHeight", { get: () => pageH(), configurable: true });
const make = document.createElement;
const findTag = (e, tag) => { for (const c of e.children || []) { if (c && c.tagName === tag) return c; const f = c && findTag(c, tag); if (f) return f; } return null; };
document.createElement = (t) => { const e = listens(kids(make(t))); e.getClientRects = () => [1]; e.scrollIntoView = () => { if (e.dataset && e.dataset.tid) rawY = 700; }; e.querySelector = (sel) => (sel === "button" ? findTag(e, "BUTTON") : null) || make("div"); e.cloneNode = () => document.createElement(t); e.replaceWith = () => {}; return e; };   // (a day's list copies each row's button: cal-chips-probe.mjs's stand-ins)
const rejected = []; process.on("unhandledRejection", (e) => { rejected.push(String((e && e.message) || e)); });
const hl = recorder("histList");
const pathTo = (e, tid, up = []) => { for (const c of e.children || []) { if (c && c.dataset && c.dataset.tid === tid) return [...up, c]; const f = c && pathTo(c, tid, [...up, c]); if (f) return f; } return null; };
hl.querySelector = (s) => { const m = /data-tid="([^"]+)"/.exec(s); const p = m ? pathTo(hl, m[1]) : null; return p ? p[p.length - 1] : null; };
const SECTIONS = ["vClients", "vClient", "vTraining", "vHistory", "vClientCard", "vSettings"];
document.querySelectorAll = (sel) => sel !== "main > section" ? [] : SECTIONS.map((id) => { const real = sec(id); return { id, get hidden() { return real.hidden; }, getClientRects: () => (real.hidden ? [] : [1]), getBoundingClientRect: () => ({ top: 0, left: 0, width: 390, height: 800 }), querySelectorAll: () => [], cloneNode: () => ({ style: {}, querySelectorAll: () => [] }) }; });
// what is on the screen as a frame is drawn
const OVER = ["pvSheet", "pickSheet", "datePick", "askSheet", "whenBg", "ctxDim", "ctxLift", "draftBar", "usePick"];
const litRows = () => { const out = []; const walk = (e) => { for (const c of e.children || []) { if (c && c.dataset && c.dataset.tid && c.classList && c.classList.contains("flash")) out.push(c.dataset.tid); if (c) walk(c); } }; walk(hl); return out; };
const screen = () => ({ page: SECTIONS.filter((id) => !sec(id).hidden), over: OVER.filter((id) => !sec(id).hidden), month: !calWrap.hidden, y: globalThis.scrollY, ...(sec("vHistory").hidden ? {} : { lit: litRows() }) });
for (const id of SECTIONS) sec(id).hidden = true;

const app = (await import("../app/main.js")).internals();
const { fns, maps } = app;
fireDoc("pointerdown", {});
const at = (n) => { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + n); return d; };
const W = (id, n, extra = {}) => ({ id, clientId: "c1", title: id.toUpperCase(), date: fns.localIso(at(n)), createdAt: "2026-01-01T10:00:00.000Z", completedAt: null, skippedAt: null, rows: [], ...extra });   // (no exercises: the stand-in page cannot draw one; a name keeps it from being an empty workout)
const { TEMPLATES_ID: TPL } = await import("../app/model.js");
const seed = (clientMode = false) => {
  fns.closePreview(); fns.closeDatePicker(); if (!byId.get("askSheet").hidden) byId.get("askNo").fire("click"); fns.leaveSettings();   // nothing left up from the scene before (History included: a settings page, which a reset keeps)
  app.reset(); rawY = 0; app.set({ signedIn: true, clientMode, myClientId: clientMode ? "c1" : null, tab: "workouts", view: { name: "client", id: "c1" } });
  maps.clients.set("c1", { id: "c1", name: "Jane", unit: "lb" });
  for (const t of [W("todo", 1), W("twin", 1), W("wk", 0, { completedAt: at(0).toISOString() }), W("wk2", 0, { completedAt: at(0).toISOString(), createdAt: "2026-01-02T10:00:00.000Z" })]) maps.trainings.set(t.id, t);
  maps.clients.set(TPL, { id: TPL, name: "Templates", kind: "templates", folders: [{ id: "F", name: "Summer block", parent: null, kind: "folder", at: "2026-11-12T10:05:00.000Z" }] });   // his folder F with two templates
  for (const n of [1, 2]) maps.trainings.set("t" + n, { id: "t" + n, clientId: TPL, title: "Day " + n, date: "2026-01-01", createdAt: "2026-11-01T10:00:00.000Z", completedAt: null, skippedAt: null, rows: [], template: { program: "My templates", phase: 0, stage: 0, n, folder: "F" } });
};
const TPLS = { name: "client", id: TPL }, FOLDER = { name: "client", id: TPL, folder: "F" };
const look = () => { const v = app.get().view; return { view: v.name + (v.id ? "/" + v.id : ""), shown: SECTIONS.filter((id) => !sec(id).hidden) }; };
const drawnNow = async () => { await advance(400); };                                // the page, and whatever is over it, drawn for a while
const tapped = () => ({ ...look(), pushed: pics.length - mark.p });
let mark = { p: 0, s: 0 };
const since = () => ({ pics: pics.slice(mark.p), steps: steps.slice(mark.s).map((x) => x.replace(/^push \d+$/, "push")) });
const begin = () => { mark = { p: pics.length, s: steps.length }; };
const pickRow = async (id) => { await advance(400); byId.get("pickList").fire("click", { target: { closest: (sel) => (sel === "button[data-id]" ? { dataset: { id } } : null) } }); await flush(); };   // a row of a sheet's list, past its 350 ms guard
const pickDay = async (key) => { await advance(400); const dp = fns.datePicker(); if (!dp) return false; const pick = dp.onPick; fns.closeDatePicker(); if (pick) pick(key); await flush(); return true; };   // a day, as a day's click does: the days close, then the pick
const menuRow = (label) => (byId.get("whenPop").children || []).find((b) => b && (b.children || []).some((s) => s && s.textContent === label));
const tapRow = (tid) => { if (sec("vHistory").inert) return "inert"; const p = pathTo(hl, tid), li = p && p[p.length - 1], b = li && (li.children || [])[0]; if (!b) return "none"; b.fire("click", { detail: 1 }); return "tapped"; };   // a finger on a History row: nothing on an inert page, as a browser
const out = {};

// Start workout: the preview over the client's month; the tap folds the month and closes the preview, and the workout opens once the page has been drawn so
seed(); fns.render(); await drawnNow(); toggle.fire("click", {}); scrollTo(0, 600); await drawnNow();
fns.openPreview("todo"); await drawnNow(); out.startBefore = drawn;
begin(); byId.get("pvGo").fire("click", { detail: 1 }); out.startAtOnce = { ...tapped(), month: !calWrap.hidden, preview: !!fns.previewState() };
await advance(60); out.start = { ...look(), ...since() }; fns.goBackNow(); await advance(100); out.startBack = { ...look(), y: globalThis.scrollY, week: calWrap.hidden };

// Show in History: the client's page drawn without the preview (its picture), then History drawn with the workout's row lit (its picture), then the workout
seed(); fns.render(); await drawnNow();
fns.openPreview("wk"); await drawnNow();
begin(); byId.get("pvGo").fire("click", { detail: 1 }); out.histAtOnce = tapped();
await advance(60); out.histMid = { ...look(), ...since() };
await advance(300); out.hist = { ...look(), ...since(), from: app.get().view.from || null };
fns.goBackNow(); await advance(100); out.histBack1 = { ...look(), y: globalThis.scrollY };
fns.goBackNow(); await advance(100); out.histBack2 = look();

// a double tap: its second tap on History during the beat, on another workout's row: nothing (the page takes no tap), and the workout opens
seed(); fns.render(); await drawnNow(); fns.openPreview("wk"); await drawnNow();
byId.get("pvGo").fire("click", { detail: 1 }); await advance(120); out.beatTap = { tap: tapRow("wk2"), ...look() }; await advance(400); out.beat = { ...look(), id: app.get().view.id }; out.afterBeat = { inert: !!sec("vHistory").inert };

// the same, the screen changed while History waited (Back): the workout does not open after it
seed(); fns.render(); await drawnNow(); fns.openPreview("wk"); await drawnNow();
byId.get("pvGo").fire("click", { detail: 1 }); await advance(60); fns.goBackNow(); await advance(400); out.histLeft = look();

// Start workout, then the page left meanwhile (Back to Clients within the two frames): nothing more opens
seed(); fns.render(); await drawnNow(); fns.openPreview("todo"); await drawnNow();
byId.get("pvGo").fire("click", { detail: 1 }); fns.go({ name: "clients" }); await advance(100); out.startLeft = look();

// Start workout, then a question up before the page was drawn (a sync's, say): nothing opens over it, nor after it
seed(); fns.render(); await drawnNow(); fns.openPreview("todo"); await drawnNow();
{ byId.get("pvGo").fire("click", { detail: 1 }); const asked = fns.askFirst({ title: "A question", yes: "OK" }); await advance(60); out.startAsked = look(); await advance(400); byId.get("askNo").fire("click"); await asked; await advance(100); out.startAskedAfter = look(); }

// a touch and hold: the row lifted with its menu, then the lifted row tapped: it opens once the page is drawn without the dim and the menu
seed(); fns.render(); await drawnNow();
{ const box = listens(kids(el("div"))); box.getBoundingClientRect = () => ({ left: 16, top: 400, right: 386, bottom: 470, width: 370, height: 70 });
  const li = fns.workoutRow(maps.trainings.get("todo"), "next", true), dim = byId.get("ctxDim"), copy = byId.get("ctxLift");
  const lift = { box, rect: { left: 16, top: 400, right: 386, bottom: 470, width: 370, height: 70 }, grow: 1.03, open: li._ctx.open, hide: () => { dim.hidden = true; copy.hidden = true; } };   // (the row's own open; the dim and the lifted copy hidden at once, as lpHide hides them)
  dim.hidden = false; copy.hidden = false; fns.showMenu(box, li._ctx(), { lift, at: null }); await drawnNow(); out.liftUp = { over: drawn.over, vis: !!lift.vis };
  const v = lift.vis || { left: 0, right: 0, top: 0, bottom: 0 }; begin(); byId.get("ctxDim").fire("click", { clientX: (v.left + v.right) / 2, clientY: (v.top + v.bottom) / 2 }); out.liftAtOnce = tapped(); await advance(60); out.lift = { ...look(), ...since() }; }

// the workout page's "…" Save as template: the page drawn without the menu, then the new template
seed(); app.set({ view: { name: "training", id: "todo" } }); fns.render(); await drawnNow();
{ byId.get("tMore").fire("click", { detail: 1 }); await drawnNow(); out.saveMenu = drawn.over; const it = menuRow("Save as template"); begin(); it.fire("click", { detail: 1 }); out.saveAtOnce = tapped(); await advance(60); out.save = { ...look(), ...since(), template: fns.isTemplateClient((maps.trainings.get(app.get().view.id) || {}).clientId) }; }

// the preview's "…" Save as template (a finished workout's): the client's page drawn without the preview, then the new template
seed(); fns.render(); await drawnNow(); fns.openPreview("wk"); await drawnNow();
{ byId.get("pvMore").fire("click", { detail: 1 }); await drawnNow(); out.pvSaveMenu = drawn.over; const it = menuRow("Save as template"); begin(); it.fire("click", { detail: 1 }); out.pvSaveAtOnce = { ...tapped(), preview: !!fns.previewState() }; await advance(60); out.pvSave = { ...look(), ...since() }; }

// Copy workout from the workout page's "…": the client, the day, then the copy, once the page is drawn without the days
seed(); app.set({ view: { name: "training", id: "todo" } }); fns.render(); await drawnNow();
{ const go = fns.copyWorkout("todo"); await pickRow("c1"); await go; const key = fns.localIso(at(3)); await advance(50); out.copyDays = screen().over; begin(); out.copyPicked = await pickDay(key); out.copyAtOnce = tapped(); await advance(60); out.copy = { ...look(), ...since(), date: (maps.trainings.get(app.get().view.id) || {}).date === key }; }

// the workout page's Also today: the day's list, then Add a workout (the coach), once the page is drawn without the list
seed(); app.set({ view: { name: "training", id: "todo" } }); fns.render(); await drawnNow();
{ byId.get("dayMore").fire("click"); await advance(50); out.dayList = screen().over; begin(); await pickRow("+"); out.addAtOnce = tapped(); await advance(60); out.add = { ...look(), ...since(), fresh: !(maps.trainings.get(app.get().view.id) || { rows: [1] }).rows.length }; }
// ... and another workout's row there
seed(); app.set({ view: { name: "training", id: "todo" } }); fns.render(); await drawnNow();
{ byId.get("dayMore").fire("click"); await advance(50); begin(); await pickRow("twin"); out.rowAtOnce = tapped(); await advance(60); out.row = { ...look(), ...since() }; }

// a template's preview on the Templates page: Edit, once the page is drawn without the preview
seed(); app.set({ view: TPLS }); fns.render(); await drawnNow(); fns.openPreview("t1"); await drawnNow();
begin(); byId.get("pvEdit").fire("click", { detail: 1 }); out.editAtOnce = { ...tapped(), preview: !!fns.previewState() }; await advance(60); out.edit = { ...look(), ...since() };

// the Templates page's + menu: New template, made and opened once the page is drawn without the menu
seed(); app.set({ view: TPLS }); fns.render(); await drawnNow();
{ const n0 = [...maps.trainings.values()].filter((t) => t.clientId === TPL).length, it = (byId.get("tAdd").fire("click", { detail: 1 }), null); await drawnNow(); out.newMenu = drawn.over; begin(); menuRow("New template").fire("click", { detail: 1 }); out.newAtOnce = { ...tapped(), made: [...maps.trainings.values()].filter((t) => t.clientId === TPL).length - n0 }; await advance(60); out.newTpl = { ...look(), ...since(), made: [...maps.trainings.values()].filter((t) => t.clientId === TPL).length - n0 }; }

// a template's preview: Use for client, a client, a day, then the new workout
seed(); app.set({ view: TPLS }); fns.render(); await drawnNow(); fns.openPreview("t1"); await drawnNow();
{ byId.get("pvGo").fire("click", { detail: 1 }); await pickRow("c1"); const key = fns.localIso(at(2)); begin(); out.useDays = screen().over; await pickDay(key); out.useAtOnce = tapped(); await advance(60); const t = maps.trainings.get(app.get().view.id) || {}; out.use = { ...look(), ...since(), made: t.clientId === "c1" && t.fromTemplate === "t1" && t.date === key }; }

// a folder's Use for a client: a client, a day, then the client's page with the week in it
seed(); app.set({ view: FOLDER }); fns.render(); await drawnNow();
{ const go = fns.useWeekFor("F"); await pickRow("c1"); await go; const key = fns.localIso(at(3)); begin(); await pickDay(key); out.weekAtOnce = tapped(); await advance(60); out.week = { ...look(), ...since(), made: [...maps.trainings.values()].filter((t) => t.clientId === "c1" && t.fromTemplate).length }; }

// a template's own page: Use for a client (its list under the button), a client, a day: the page drawn without the list and the days, then the new workout
seed(); app.set({ view: { name: "training", id: "t1" } }); fns.render(); await drawnNow();
{ byId.get("useBtn").fire("click"); await advance(50); const li = (byId.get("usePick").children || [])[0], b = li && (li.children || [])[0]; out.usePickOpen = !byId.get("usePick").hidden && !!b; if (b) b.fire("click"); const key = fns.localIso(at(4)); begin(); await pickDay(key); out.pageUseAtOnce = { ...tapped(), list: !byId.get("usePick").hidden }; await advance(60); const t = maps.trainings.get(app.get().view.id) || {}; out.pageUse = { ...look(), ...since(), made: t.clientId === "c1" && t.date === key }; }

// a template with unsaved changes held a page opened from it (Use for a client's workout); Save: the page drawn without the bar, then that page
seed(); app.set({ view: { name: "training", id: "t1" } }); fns.render(); await drawnNow();
{ const dr = app.get().templateDraft; if (dr) dr.dirty = true; out.drafted = (out.drafted || 0) + (dr ? 1 : 0); app.set({ pendingGo: { next: { name: "training", id: "todo" }, back: false } }); fns.render(); byId.get("useBtn").fire("click"); await drawnNow(); out.draftBefore = drawn; begin(); byId.get("draftSave").fire("click"); out.draftAtOnce = tapped(); await advance(60); out.draft = { ...look(), ...since() }; }
// ... Discard, after its question
seed(); app.set({ view: { name: "training", id: "t1" } }); fns.render(); await drawnNow();
{ maps.trainings.get("t1").title = "Edited"; const dr = app.get().templateDraft; if (dr) dr.dirty = true; out.drafted = (out.drafted || 0) + (dr ? 1 : 0); app.set({ pendingGo: { next: { name: "training", id: "todo" }, back: false }, renderedTraining: null }); fns.render(); await drawnNow(); out.discardTitle = drawnTitle; byId.get("draftDiscard").fire("click"); await advance(400); out.discardAsk = screen().over; begin(); byId.get("askYes").fire("click"); await flush(); out.discardAtOnce = tapped(); await advance(60); out.discard = { ...look(), ...since(), title: (pics[pics.length - 1] || {}).title }; }
// ... and a held Back goes at once, as always
seed(); app.set({ view: { name: "training", id: "t1" } }); fns.render(); await drawnNow();
{ const dr = app.get().templateDraft; if (dr) dr.dirty = true; out.drafted = (out.drafted || 0) + (dr ? 1 : 0); app.set({ pendingGo: { next: TPLS, back: true } }); fns.render(); await drawnNow(); byId.get("draftSave").fire("click"); out.draftBack = look(); await advance(60); }

// not a phone's tab, a template with unsaved changes: Use for a client, a client, a day: the move is held and the list stays open, as before
seed(); app.set({ view: { name: "training", id: "t1" } }); fns.render(); await drawnNow(); coarse = false;
{ const dr = app.get().templateDraft; if (dr) dr.dirty = true; byId.get("useBtn").fire("click"); await advance(50); const li = (byId.get("usePick").children || [])[0], b = li && (li.children || [])[0]; if (b) b.fire("click"); await pickDay(fns.localIso(at(5))); out.heldList = { listOpen: !byId.get("usePick").hidden, held: !!app.get().pendingGo, ...look() }; }
coarse = true;

// not a phone's tab (a computer, or the tests' usual page): nothing waits, as before
seed(); fns.render(); await drawnNow(); fns.openPreview("todo"); await drawnNow(); coarse = false;
begin(); byId.get("pvGo").fire("click", { detail: 1 }); out.desk = tapped(); coarse = true; await advance(60);

out.rejected = rejected;
console.log(JSON.stringify(out));
process.exit(0);
