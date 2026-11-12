// Run by cal-chips.test.js in its own process: the client page's week strip and month draw each day's workouts as chips with their names
// (his ask, 11 Nov). This loads the real app/main.js with page elements that keep what is put in them, draws a client's page with
// workouts in every state, opens the month with its own Month button, and prints, as JSON, what each day shows in the week and in all
// three months on the slide track (found by the date VoiceOver hears, so it holds whatever day it runs on).
import { byId, el } from "./env.js";
const kids = (e) => {
  e.replaceChildren = (...k) => { e.children = k; e.firstElementChild = k[0] || null; };
  e.appendChild = (c) => { e.children = [...e.children, c]; e.firstElementChild = e.children[0]; return c; };
  e.append = (...k) => { e.children = [...e.children, ...k]; e.firstElementChild = e.children[0] || null; };
  return e;
};
const listens = (e) => { const H = {}; e.addEventListener = (type, fn) => { (H[type] ||= []).push(fn); }; e.removeEventListener = () => {}; e.fire = (type, ev) => { for (const fn of [...(H[type] || [])]) fn(ev); }; e.setAttribute = (k, v) => { e["@" + k] = String(v); }; return e; };
const recorder = (id, extra = {}) => { const e = listens(kids(el("div"))); Object.assign(e, extra); byId.set(id, e); return e; };
for (const id of ["calView", "calTrack", "calTitle", "calToday", "calPrev", "calNext", "calWrap", "week", "weekHead", "calToggleText", "dayMore"]) recorder(id, { clientWidth: 350 });   // (dayMore: the workout page's "Also today")
const toggle = recorder("calToggle");
const make = document.createElement;
const find = (e, tag) => { for (const c of e.children || []) { if (c.tagName === tag) return c; const f = find(c, tag); if (f) return f; } return null; };
document.createElement = (t) => { const e = listens(kids(make(t))); e.querySelector = (sel) => (sel === "button" ? find(e, "BUTTON") : null) || make("div"); e.cloneNode = () => document.createElement(t); e.replaceWith = () => {}; e.getClientRects = () => [1]; e.scrolled = false; e.scrollIntoView = () => { e.scrolled = true; }; return e; };   // a day's list builds its rows from the workout rows (their button copied); History's rows are drawn and scroll into view
for (const id of ["pickSheet", "pickList", "pickNo", "pickTitle", "pvGo", "vHistory"]) recorder(id);   // (pvGo: the preview's foot; vHistory: the client's History)
byId.get("vHistory").hidden = true;                                                 // History as the page starts: not up
{ const h = recorder("histList"); const byTid = (e, tid) => { for (const c of e.children || []) { if (c.dataset && c.dataset.tid === tid) return c; const f = byTid(c, tid); if (f) return f; } return null; };
  h.querySelector = (sel) => { const m = /data-tid="([^"]+)"/.exec(sel); return m ? byTid(h, m[1]) : null; }; }   // History's list, its rows found by their workout
globalThis.addEventListener = () => {}; globalThis.removeEventListener = () => {};
const app = (await import("../app/main.js")).internals();
const { fns, maps } = app;
const at = (n) => { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + n); return d; };
const day = (n) => fns.localIso(at(n));
const W = (id, n, made, extra = {}) => ({ id, clientId: "c1", title: id.toUpperCase(), date: day(n), createdAt: "2026-11-01T" + made + ":00.000Z", completedAt: null, skippedAt: null, rows: [], ...extra });
app.reset(); app.set({ signedIn: true, clientMode: false, tab: "workouts" });
maps.clients.set("c1", { id: "c1", name: "Jane", unit: "lb" });
for (const t of [
  W("b", 0, "09:00"), W("u", 0, "08:00", { title: "  ", rows: [{ id: "r1", name: "Squat", sets: "3", reps: "10" }] }),   // today: an untitled one made first (with an exercise: an empty one is cleared away), then B
  W("done", -2, "08:00", { completedAt: at(-2).toISOString() }),                        // finished
  W("late", -1, "08:00"),                                                                // its day gone, still to do: missed
  W("f1", 2, "08:00"), W("f2", 2, "09:00"), W("f3", 2, "10:00"), W("f4", 2, "11:00"),   // four on one day: two, then "+2"
  W("t1", 3, "08:00"), W("t2", 3, "09:00"), W("t3", 3, "10:00"),                        // three: all three
  W("skip", 4, "08:00", { skippedAt: at(4).toISOString() }),                            // skipped: not on the calendar
  W("early", 6, "08:00", { completedAt: at(-3).toISOString() }),                       // finished ahead of its day: on the day it was finished
]) maps.trainings.set(t.id, t);
app.set({ view: { name: "client", id: "c1" } }); fns.render();
const label = (n) => at(n).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
const look = (b) => {                                                                // what a day shows: its chips (state, words) and the count of the rest
  const box = (b.children || []).find((s) => /day-evs/.test(s.className || "")); if (!box) return { chips: null, dots: (b.children || []).some((s) => s.className === "dots") };
  return { chips: (box.children || []).map((c) => (c.className === "day-ev-more" ? c.textContent : c.className.replace("day-ev ", "") + ":" + c.children[0].textContent)), label: b["@aria-label"] || "" };
};
const cellsOf = (grid) => (grid.children || []).filter((b) => (b.children || []).some((s) => s.className === "dn"));
const byLabel = (cells) => { const m = new Map(); for (const b of cells) { const l = String(b["@aria-label"] || "").split(":")[0]; m.set(l, b); } return m; };
const out = {};
const weekCells = byLabel(cellsOf(byId.get("week")));
out.week = {}; for (const n of [-3, -2, -1, 0, 1, 2, 3, 4, 5, 6]) { const b = weekCells.get(label(n)); if (b) out.week[n] = look(b); }
out.weekDays = cellsOf(byId.get("week")).length;
toggle.fire("click", {});                                                          // Month
const monthCells = byLabel((byId.get("calTrack").children || []).flatMap((p) => cellsOf(p.children[0])));
out.month = {}; for (const n of [-3, -2, -1, 0, 1, 2, 3, 4, 5, 6]) { const b = monthCells.get(label(n)); out.month[n] = b ? look(b) : null; }
out.labels = { today: (monthCells.get(label(0)) || {})["@aria-label"], late: (monthCells.get(label(-1)) || {})["@aria-label"], done: (monthCells.get(label(-2)) || {})["@aria-label"], empty: (monthCells.get(label(6)) || {})["@aria-label"] };
out.todayLabel = label(0);
// a workout in the calendar opens its preview first (his ask, 11 Nov), in the month and the week: the day with one, the chip tapped on a busy day, a busy day itself (or its "+N") opening the day's list, whose row opens the preview
const seen = () => ({ view: app.get().view.name, preview: (fns.previewState() || {}).id || null });
const chipOf = (b, i) => { const box = (b.children || []).find((x) => /day-evs/.test(x.className || "")); return box.children[i]; };
const onChip = (chip) => ({ target: { closest: (sel) => (sel === ".day-ev" ? chip : null) } });   // the tap's target: the chip's words, inside the chip
{ const b = monthCells.get(label(-1)); b.fire("click", {}); out.tap = seen(); fns.closePreview(); }
{ const b = monthCells.get(label(3)); b.fire("click", onChip(chipOf(b, 1))); out.tapChip = seen(); fns.closePreview(); }
// a finished workout's green chip opens its preview too, whose foot shows it in History (his pick, 11 Nov), as Apple's "Show in …"; one still to do says Start workout
{ const b = monthCells.get(label(-1)); b.fire("click", onChip(chipOf(b, 0))); out.tapLate = { ...seen(), go: byId.get("pvGo").textContent }; fns.closePreview(); }
{ const b = monthCells.get(label(-2)); b.fire("click", onChip(chipOf(b, 0))); out.tapDone = { ...seen(), go: byId.get("pvGo").textContent };
  byId.get("pvGo").fire("click", { detail: 0 });                                    // pressed (a keyboard's Enter: at once)
  const row = byId.get("histList").querySelector('[data-tid="done"]');
  out.showInHistory = { history: !byId.get("vHistory").hidden, ...seen(), row: !!row, lit: !!(row && row.classList.contains("flash")), scrolled: !!(row && row.scrolled) };
  fns.leaveSettings(); app.set({ view: { name: "client", id: "c1" } }); fns.render(); if (!fns.calState().open) toggle.fire("click", {}); }   // off History, back on the client's page (as Back does), its month open again (History, as any page, folded it)
toggle.fire("click", {});                                                          // Week
{ const b = byLabel(cellsOf(byId.get("week"))).get(label(0)); b.fire("click", onChip(chipOf(b, 1))); out.tapWeekChip = seen(); fns.closePreview(); }
toggle.fire("click", {});                                                          // Month
{ const cells = byLabel((byId.get("calTrack").children || []).flatMap((p) => cellsOf(p.children[0]))); const b = cells.get(label(2)); b.fire("click", {}); const sheet = !byId.get("pickSheet").hidden;
  await new Promise((r) => setTimeout(r, 400));                                    // the list's own guard (a double tap's second tap)
  byId.get("pickList").fire("click", { target: { closest: (sel) => (sel === "button[data-id]" ? { dataset: { id: "f3" } } : null) } }); for (let i = 0; i < 20; i++) await Promise.resolve();
  out.tapBusy = { sheet, ...seen() }; fns.closePreview(); }
// the keyboard's place (Escape, the cross's Enter give it back, v258): a preview opened from the calendar gives it back to the day, never to the page:
// through a busy day's list (its row went with the list, and WebKit's focus() does nothing on a row no longer drawn), and after a redraw (a
// sync's, every minute) drew the day anew while the preview was up (the same day, drawn anew)
const dayAt = (n) => byLabel((byId.get("calTrack").children || []).flatMap((p) => cellsOf(p.children[0]))).get(label(n));
const placeOf = (b, nb) => (document.activeElement === b ? "day" : nb && document.activeElement === nb ? "new day" : document.activeElement === byId.get("pvBox") ? "lost" : "elsewhere");
out.keys = {};
{ const b = dayAt(2), row = { dataset: { id: "f3" }, isConnected: true, closest: () => null, getClientRects: () => [], focus() {} };   // the list's row, hidden with its sheet
  b.focus = () => { document.activeElement = b; }; byId.get("pickSheet").contains = (x) => x === row || x === byId.get("pickNo");
  document.activeElement = b; b.fire("click", {}); document.activeElement = byId.get("pickNo");                  // Enter on the day: its list, focus on Cancel
  await new Promise((r) => setTimeout(r, 400));
  document.activeElement = row; byId.get("pickList").fire("click", { target: { closest: (sel) => (sel === "button[data-id]" ? row : null) } }); for (let i = 0; i < 20; i++) await Promise.resolve();   // Tab to a row, Enter: its preview
  const id = (fns.previewState() || {}).id; document.activeElement = byId.get("pvBox"); fns.closePreview(true);   // the preview takes it; Escape
  out.keys.busy = { id, place: placeOf(b) }; delete byId.get("pickSheet").contains; }
{ const b = dayAt(-2); b.focus = () => { document.activeElement = b; };
  document.activeElement = b; b.fire("click", {}); const id = (fns.previewState() || {}).id; document.activeElement = byId.get("pvBox");   // Enter on a day of one (finished: no row on the page)
  fns.render(); b.isConnected = false;                                                                           // a sync's redraw while it is up: the day drawn anew
  const nb = dayAt(-2); nb.focus = () => { document.activeElement = nb; };
  const vc = document.getElementById("vClient"); vc.querySelector = (s) => (/^li\[/.test(s) ? null : el("div")); vc.querySelectorAll = (s) => (s === 'button[data-day="' + day(-2) + '"]' ? [nb] : []);   // the page's lookups: no row (finished), the same day drawn anew
  fns.closePreview(true); out.keys.redraw = { id, place: placeOf(b, nb) }; delete vc.querySelector; delete vc.querySelectorAll; }
document.activeElement = null;
// only the calendar's: the workout page's "Also today" list still opens the workout itself
{ fns.go({ name: "training", id: "f1" }); byId.get("dayMore").fire("click", {}); const sheet = !byId.get("pickSheet").hidden;
  await new Promise((r) => setTimeout(r, 400));
  byId.get("pickList").fire("click", { target: { closest: (sel) => (sel === "button[data-id]" ? { dataset: { id: "f2" } } : null) } }); for (let i = 0; i < 20; i++) await Promise.resolve();
  out.alsoToday = { sheet, ...seen(), id: app.get().view.id }; }
console.log(JSON.stringify(out));
process.exit(0);
