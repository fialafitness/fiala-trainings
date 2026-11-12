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
for (const id of ["calView", "calTrack", "calTitle", "calToday", "calPrev", "calNext", "calWrap", "week", "weekHead", "calToggleText"]) recorder(id, { clientWidth: 350 });
const toggle = recorder("calToggle");
const make = document.createElement; document.createElement = (t) => listens(kids(make(t)));
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
// a day's tap is the day's, as before: one workout opens it
{ const b = monthCells.get(label(-1)); b.fire("click", {}); out.tap = { view: app.get().view.name, id: app.get().view.id }; }
console.log(JSON.stringify(out));
process.exit(0);
