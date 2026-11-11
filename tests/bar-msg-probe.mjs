// Run by bar-msg.test.js in its own process: the swipe back's bar buttons around the Messages circle, through the real go() (which takes the
// picture of the page left), the real startSwipe and release, and the real swap. The header's bar is a stand-in that keeps each button's id
// and hidden flag, and its copies the same; every animate() is recorded. Prints, per case, what goes out and what comes in as the finger
// moves, and the bar once the page has landed.
import { byId, el } from "./env.js";
globalThis.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
const L = {};
document.addEventListener = (t, fn, o) => { (L[t] ||= []).push({ fn, capture: o === true || !!(o && o.capture) }); };
document.removeEventListener = (t, fn) => { const a = L[t] || []; const i = a.findIndex((x) => x.fn === fn); if (i >= 0) a.splice(i, 1); };
const fire = (type, ev = {}) => { ev.type = type; ev.preventDefault ||= () => {}; ev.stopPropagation ||= () => {}; const ls = L[type] || []; for (const l of [...ls.filter((x) => x.capture), ...ls.filter((x) => !x.capture)]) l.fn(ev); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
// the bar: the real elements in the page's order, a copy that keeps ids and hidden flags (as cloneNode(true) does)
const IDS = ["back", "brand", "status", "barMsg", "tMore", "meDisc", "navDone"];
const animFn = () => () => ({ cancel() {} });
const mkBar = (kids) => {
  const b = { children: kids, style: {}, attrs: {}, removed: false };
  b.querySelector = (s) => { const m = /^#(\w+)$/.exec(s); return m ? kids.find((k) => k.id === m[1]) || null : null; };
  b.cloneNode = () => mkBar(kids.map((k) => { const c = el("div"); c.id = k.id; c.hidden = !!k.hidden; c.style = {}; c.animate = animFn(); return c; }));
  b.setAttribute = (k, v) => { b.attrs[k] = v; };
  b.after = () => {}; b.remove = () => { b.removed = true; };
  b.getBoundingClientRect = () => ({ top: 0, left: 0, width: 402, height: 56 });
  b.parentElement = { getBoundingClientRect: () => ({ top: 0, left: 0, width: 402, height: 57 }) };
  return b;
};
const live = IDS.map((id) => { const e = document.getElementById(id); e.id = id; e.animate = animFn(); return e; });
const liveBar = mkBar(live);
byId.set("whenBg", Object.assign(el("div"), { hidden: true }));
const header = el("header");
const qs = document.querySelector; document.querySelector = (s) => (/sheet-bg|crop-view/.test(s) ? null : s === "header .bar" ? liveBar : s === "header" ? header : qs(s));
document.contains = (x) => !!x;
const make = document.createElement; document.createElement = (t) => { const e = make(t); e.kids = []; e._land = undefined; e.parentNode = null; e.appendChild = (c) => { e.kids.push(c); return c; }; e.querySelectorAll = () => []; e.remove = () => {}; return e; };
const SECTIONS = ["vClients", "vClient", "vTraining", "vClientCard"];
document.querySelectorAll = (sel) => sel !== "main > section" ? [] : SECTIONS.map((id) => { const real = document.getElementById(id); return { id, get hidden() { return real.hidden; }, getClientRects: () => (real.hidden ? [] : [1]), getBoundingClientRect: () => ({ top: 0, left: 0, width: 402, height: 800 }), querySelectorAll: () => [], cloneNode: () => ({ style: {}, id, querySelectorAll: () => [] }) }; });
document.body.appendChild = (c) => c;
const shows = () => live.filter((k) => !k.hidden && k.id !== "status").map((k) => k.id).join(" ");

const { TEMPLATES_ID } = await import("../app/model.js");
const app = (await import("../app/main.js")).internals();
const { fns, maps } = app;
const $ = (id) => document.getElementById(id);
const DONE = "2026-11-09T18:00:00.000Z";
fns.forceSwipe(true); fire("pointerdown", {});
const out = {};
const swipe = async () => {                                             // a finger from the left edge to 240 of 402, then let go
  const target = { closest: () => null }; let ts = 1000;
  fire("touchstart", { touches: [{ clientX: 5, clientY: 300 }], target, timeStamp: ts });
  for (const x of [20, 60, 120, 180, 240]) { ts += 16; fire("touchmove", { touches: [{ clientX: x, clientY: 300 }], target, timeStamp: ts }); }
  const s = fns.swipeState(), moving = { goesOut: (s && s.glassOut) || [], comesIn: (s && s.glassIn) || [] };
  fire("touchend", { changedTouches: [{ clientX: 240 }], target, timeStamp: ts + 5 }); await wait(1500);
  return { ...moving, landed: app.get().view.name + ": " + shows() };
};
const setup = (client, w = {}, c = {}) => {
  for (const t of maps.timers.values()) clearTimeout(t); maps.timers.clear();
  app.reset(); fns.setPreview(false); fns.dropShots(); fns.leaveSettings();
  app.set({ signedIn: true, clientMode: client, myClientId: client ? "c1" : null, tab: "workouts", syncedOnce: true });
  maps.clients.set("c1", { id: "c1", name: "Jane Doe", unit: "lb", phone: "(310) 555-0100", trainerPhone: "3105550199", ...c });
  maps.clients.set(TEMPLATES_ID, { id: TEMPLATES_ID, name: "Templates" });
  maps.trainings.set("w1", { id: "w1", clientId: "c1", title: "Legs", date: fns.today(), createdAt: "2026-11-01T10:00:00.000Z", completedAt: null, skippedAt: null, rows: [], ...w });
  maps.trainings.set("tp", { id: "tp", clientId: TEMPLATES_ID, title: "Push", date: null, createdAt: "2026-11-01T10:00:00.000Z", completedAt: null, skippedAt: null, rows: [] });
};
const fromClientPage = async (label, client, w, opts = {}) => {      // her page, then her workout through go() (the week strip's tap), then the swipe back
  setup(client, w);
  app.set({ view: { name: "client", id: "c1" }, renderedTraining: null }); fns.render(); await wait(5);
  fns.go({ name: "training", id: "w1" }); await wait(5);
  if (opts.preview) { fns.setPreview(true); app.set({ renderedTraining: null }); fns.render(); }
  out[label] = { workout: shows(), ...(await swipe()) };
};
await fromClientPage("clientToDo", true, {});
await fromClientPage("clientFinished", true, { completedAt: DONE });
await fromClientPage("clientSkipped", true, { skippedAt: DONE });
await fromClientPage("previewFinished", false, { completedAt: DONE }, { preview: true });
await fromClientPage("coachFinished", false, { completedAt: DONE });
// a template back to the library: Back stays where it is
setup(false); app.set({ view: { name: "client", id: TEMPLATES_ID }, renderedTraining: null }); fns.render(); await wait(5);
fns.go({ name: "training", id: "tp" }); await wait(5);
out.template = { workout: shows(), ...(await swipe()) };
// her number typed on her card after the picture of her page was taken: the circle comes in with her page (from what is true now)
setup(false, {}, { phone: "" }); app.set({ view: { name: "client", id: "c1" }, renderedTraining: null }); fns.render(); await wait(5);
fns.showClientCard(); await wait(5);
maps.clients.get("c1").phone = "(310) 555-0100";
out.cardNumber = { card: shows(), ...(await swipe()) };
for (const t of maps.timers.values()) clearTimeout(t);
console.log(JSON.stringify(out));
process.exit(0);
