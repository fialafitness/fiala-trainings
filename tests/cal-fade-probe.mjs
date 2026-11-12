// Run by cal-fade.test.js in its own process: a chip's words fade over its last 12 points only when they do not fit (Calendar's way);
// a name that fits is left whole. The words' widths and the chip's room are WebKit's own (Inter semibold 11, measured in a WKWebView):
// the room for the words is 33.14 on a 320-point phone (an SE or a mini in Display Zoom), 48.86 on a 430-point one (a Pro Max).
// This loads the real app/main.js with page elements that keep what is put in them, draws a client's week, opens the month, turns the
// phone wider (the window's resize), folds back to the week, and prints, as JSON, which chips are marked to fade at each step.
import { byId, el } from "./env.js";
const TEXT = { Upper: 32.70, Legs: 25.65, Glutes: 34.18, Workout: 45.24, "Full Body": 48.74, Shoulders: 53.98 };
let ROOM = 33.14;
const kids = (e) => {
  e.replaceChildren = (...k) => { e.children = k; e.firstElementChild = k[0] || null; };
  e.appendChild = (c) => { e.children = [...e.children, c]; e.firstElementChild = e.children[0]; return c; };
  e.append = (...k) => { e.children = [...e.children, ...k]; e.firstElementChild = e.children[0] || null; };
  return e;
};
const listens = (e) => { const H = {}; e.addEventListener = (type, fn) => { (H[type] ||= []).push(fn); }; e.removeEventListener = () => {}; e.fire = (type, ev) => { for (const fn of [...(H[type] || [])]) fn(ev); }; e.setAttribute = (k, v) => { e["@" + k] = String(v); }; return e; };
const shown = (rootId) => (rootId === "week" ? !byId.get("week").hidden : !byId.get("calWrap").hidden);
const words = (root, rootId, out = []) => { for (const c of root.children || []) { if (c.className === "day-ev-t") { c._root = rootId; out.push(c); } words(c, rootId, out); } return out; };
const recorder = (id, extra = {}) => { const e = listens(kids(el("div"))); Object.assign(e, extra); byId.set(id, e); e.querySelectorAll = (s) => (s === ".day-ev-t" ? words(e, id) : []); return e; };
for (const id of ["calView", "calTrack", "calTitle", "calToday", "calPrev", "calNext", "calWrap", "week", "weekHead", "calToggleText"]) recorder(id, { clientWidth: 350 });
byId.get("calWrap").hidden = true;
const toggle = recorder("calToggle");
const make = document.createElement;
document.createElement = (t) => {
  const e = listens(kids(make(t)));
  Object.defineProperty(e, "offsetWidth", { get: () => (e.className === "day-ev-t" && e._root && shown(e._root) ? Math.round(ROOM) : 0), configurable: true });
  e.getBoundingClientRect = () => { const w = e.className === "day-ev-t" && e._root && shown(e._root) ? ROOM : 0; return { left: 0, top: 0, right: w, bottom: 0, width: w, height: 0 }; };
  return e;
};
document.createRange = () => { let n = null; return { selectNodeContents(x) { n = x; }, getBoundingClientRect: () => ({ width: TEXT[n.textContent] }) }; };
document.querySelectorAll = (s) => (s === ".day-ev-t" ? [...words(byId.get("week"), "week"), ...words(byId.get("calTrack"), "calTrack")] : []);
const win = {}; globalThis.addEventListener = (type, fn) => { (win[type] ||= []).push(fn); }; globalThis.removeEventListener = () => {};
const app = (await import("../app/main.js")).internals();
const { fns, maps } = app;
const at = (n) => { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + n); return d; };
app.reset(); app.set({ signedIn: true, clientMode: false, tab: "workouts" });
maps.clients.set("c1", { id: "c1", name: "Jane", unit: "lb" });
const names = Object.keys(TEXT), monday = at(-((at(0).getDay() + 6) % 7));
names.forEach((title, i) => { const d = new Date(monday); d.setDate(monday.getDate() + i); maps.trainings.set("t" + i, { id: "t" + i, clientId: "c1", title, date: fns.localIso(d), createdAt: "2026-11-01T08:00:00.000Z", completedAt: d < at(0) ? d.toISOString() : null, skippedAt: null, rows: [{ id: "r" + i, name: "Squat", sets: "3", reps: "10" }] }); });
app.set({ view: { name: "client", id: "c1" } }); fns.render();
const marks = (root, rootId) => { const o = {}; for (const n of words(root, rootId)) if (!(n.textContent in o)) o[n.textContent] = n.classList.contains("over"); return o; };
const out = { week320: marks(byId.get("week"), "week") };
toggle.fire("click", {});                                                          // Month
const track = byId.get("calTrack"); out.month320 = marks(track, "calTrack"); out.monthChips = words(track, "calTrack").length;   // the three months on the track (this week may run into the next)
ROOM = 48.86; for (const fn of win.resize || []) fn({});                             // the phone turned wider: the window's resize
out.month430 = marks(track, "calTrack");
toggle.fire("click", {});                                                          // Week
out.week430 = marks(byId.get("week"), "week");
ROOM = 44.86; for (const fn of win.resize || []) fn({});                             // his own 402-point phone: the plain "Workout" is 0.38 over, a point's grace
out.week402 = marks(byId.get("week"), "week");
console.log(JSON.stringify(out));
process.exit(0);
