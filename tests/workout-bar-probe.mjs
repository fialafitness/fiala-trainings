// Run by workout-bar.test.js in its own process: the coach's workout bar as the page really runs it. The document keeps its listeners,
// focus moves as a browser moves it, and the swipe back takes, stores and shows its pictures. argv[2] says what to run:
//   "phone" / "desk": typing on the workout (the +, a number box, back to the name, letting go) and a double click on the +, on a phone
//                     (a keyboard comes up from the bottom) or a computer ((hover: hover) and (pointer: fine): its keyboard is on the desk);
//   "swipe":          the swipe back's pictures of the bar (Templates back to a workout, a workout back to its client's page), and a Back
//                     refused by a template's Unsaved changes.
// Prints, as JSON, what the page showed at each step.
import { byId, el } from "./env.js";
const MODE = process.argv[2] || "phone", DESK = MODE === "desk";
globalThis.matchMedia = (q) => ({ matches: (DESK && /hover: hover|pointer: fine/.test(q)) || /reduced-motion/.test(q), addEventListener() {}, removeEventListener() {} });   // (reduced motion: a glide lands at once)
const L = {};
document.addEventListener = (t, fn, o) => { (L[t] ||= []).push({ fn, capture: o === true || !!(o && o.capture) }); };
document.removeEventListener = (t, fn) => { const a = L[t] || []; const i = a.findIndex((x) => x.fn === fn); if (i >= 0) a.splice(i, 1); };
const fire = (type, ev = {}) => { ev.type = type; ev.preventDefault ||= () => {}; ev.stopPropagation ||= () => {}; const ls = L[type] || []; for (const l of [...ls.filter((x) => x.capture), ...ls.filter((x) => !x.capture)]) l.fn(ev); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const qs = document.querySelector; document.querySelector = (s) => (/sheet-bg|crop-view|header \.bar/.test(s) ? null : qs(s));   // no sheet up; the top bar's buttons are not part of this
document.contains = (x) => !!x;
const listens = (e) => { const H = {}; e.addEventListener = (type, fn) => { (H[type] ||= []).push(fn); }; e.fire = (type, ev = {}) => { for (const fn of [...(H[type] || [])]) fn(ev); }; return e; };
// the bar at the foot: its real items (render() shows and hides them), where the live bar is put (its transform, in order), and a copy that
// keeps its id and its classes, as a browser's cloneNode(true) does
const items = ["viewSeg", "tabbar", "addBtn", "addExBtn"].map((id) => { const e = listens(el("div")); e.id = id; byId.set(id, e); return e; });
const dock = el("div"); dock.id = "dock"; dock.children = items; byId.set("dock", dock);
const moves = []; dock.style = new Proxy({ setProperty() {}, removeProperty() {} }, { set(t, k, v) { t[k] = v; if (k === "transform") moves.push(v); return true; } });
dock.cloneNode = () => { const c = el("div"); c.id = dock.id; c.style = {}; for (const k of dock.classes) c.classList.add(k); c.children = items.map((k) => ({ id: k.id, hidden: k.hidden })); c.isCopy = true; return c; };
const tplFill = listens(el("button")); byId.set("tplFill", tplFill);
const addRow = listens(el("button")); byId.set("addRow", addRow);   // + Add exercise under the exercises (his ask, 12 Nov)
byId.set("whenBg", Object.assign(el("div"), { hidden: true }));
// a picture's box keeps what is put in it; the page's sections, for the picture to copy
const make = document.createElement; document.createElement = (t) => { const e = make(t); e.kids = []; e._land = undefined; e._bar = null; e.parentNode = null; e.appendChild = (c) => { e.kids.push(c); return c; }; e.querySelectorAll = (s) => (s === ".shot-dock" ? e.kids.filter((k) => k.classList && k.classList.contains("shot-dock")) : []); e.remove = () => {}; return e; };
const SECTIONS = ["vClients", "vClient", "vTraining"];
document.querySelectorAll = (sel) => sel !== "main > section" ? [] : SECTIONS.map((id) => { const real = document.getElementById(id); return { id, get hidden() { return real.hidden; }, getClientRects: () => (real.hidden ? [] : [1]), getBoundingClientRect: () => ({ top: 0, left: 0, width: 390, height: 800 }), querySelectorAll: () => [], cloneNode: () => ({ style: {}, id, querySelectorAll: () => [] }) }; });
let layer = null; document.body.appendChild = (c) => { layer = c; return c; };   // the swipe's layer: the picture under the page
const shown = () => { const shot = layer && layer.kids && layer.kids.find((k) => k.className === "nav-shot"); const d = shot && shot.kids.find((k) => k.isCopy); return d ? { classes: [...d.classes].sort().join(" "), shows: d.children.filter((k) => !k.hidden).map((k) => k.id).join(",") } : null; };

const { TEMPLATES_ID } = await import("../app/model.js");
const app = (await import("../app/main.js")).internals();
const { fns, maps } = app;
const $ = (id) => document.getElementById(id), body = document.body;
const look = () => ({ typing: body.classList.contains("typing"), keys: body.classList.contains("kb"), focus: document.activeElement === body || !document.activeElement ? "nothing" : document.activeElement.className });
const out = { mode: MODE };

if (MODE !== "swipe") {
  // fields that move the focus as a browser does: the old one lets go (focusout), then the new one takes it (focusin)
  const field = (tag, cls) => { const f = { tagName: tag, type: tag === "TEXTAREA" ? "textarea" : "text", className: cls, value: "", readOnly: false, inputMode: "", closest: () => null, classList: { contains: (c) => c === cls } };
    f.focus = () => { const was = document.activeElement; if (was === f) return; document.activeElement = f; if (was && was !== body) fire("focusout", { target: was }); fire("focusin", { target: f }); };
    f.blur = () => { if (document.activeElement !== f) return; document.activeElement = body; fire("focusout", { target: f }); };
    return f; };
  const name = field("TEXTAREA", "name"), reps = field("INPUT", "reps");
  const row = { querySelector: (s) => (s === ".name" ? name : s === ".reps" ? reps : null), getBoundingClientRect: () => ({ top: 0, bottom: 100 }), closest: () => null };
  const rows = $("rows"); byId.set("rows", new Proxy(rows, { get: (t, k) => (k === "querySelector" ? (s) => (/^\.row\[data-id=/.test(s) ? row : t.querySelector(s)) : t[k]) }));
  document.activeElement = body;
  app.reset(); fns.setPreview(false);
  app.set({ signedIn: true, clientMode: false, myClientId: null, tab: "workouts" });
  maps.clients.set("c1", { id: "c1", name: "Jane", unit: "lb" }); maps.clients.set(TEMPLATES_ID, { id: TEMPLATES_ID, name: "Templates" });
  // (this stand-in page cannot draw an exercise's card: the workout's list keeps what the + adds aside, so the drawn page stays empty)
  const added = [], list = []; list.push = (r) => { added.push(r); return 0; };
  maps.trainings.set("w1", { id: "w1", clientId: "c1", title: "Legs", date: fns.today(), createdAt: "2026-11-01T10:00:00.000Z", completedAt: null, skippedAt: null, rows: list });
  app.set({ view: { name: "training", id: "w1" }, renderedTraining: null }); fns.render();
  const plus = $("addExBtn");
  out.drawn = { ...look(), plus: !plus.hidden };
  plus.fire("click", { detail: 1 }); out.plus = { ...look(), added: added.length }; await wait(120); out.plusLater = look();
  reps.focus(); await wait(120); out.reps = look();
  name.focus(); await wait(120); out.backToName = look();
  name.blur(); await wait(120); out.letGo = look();
  plus.fire("click", { detail: 1 }); plus.fire("click", { detail: 2 }); out.doubleClick = { added: added.length };
  // + Add exercise under the exercises, double clicked: the new card takes the button's place, so the second click lands on the card
  const click = (detail) => { const e = { detail, prevented: false, stopped: false }; e.preventDefault = () => { e.prevented = true; }; e.stopImmediatePropagation = () => { e.stopped = true; }; return e; };
  addRow.fire("click", { detail: 1 }); const second = click(2), single = click(1); fire("click", second); fire("click", single);
  await wait(600); const late = click(2); fire("click", late);
  out.addRow = { added: added.length, secondEaten: second.prevented && second.stopped, singleKept: !single.prevented && !single.stopped, lateKept: !late.prevented && !late.stopped };
  for (const t of maps.timers.values()) clearTimeout(t);
}

if (MODE === "swipe") {
  fns.forceSwipe(true); fire("pointerdown", {});                       // the swipe back is on and the page has been touched: leaving takes its picture
  app.reset(); app.set({ signedIn: true, clientMode: false, myClientId: null, tab: "workouts", syncedOnce: true });
  maps.clients.set("c1", { id: "c1", name: "Jane", unit: "lb" }); maps.clients.set(TEMPLATES_ID, { id: TEMPLATES_ID, name: "Templates", kind: "templates" });
  maps.trainings.set("tp", { id: "tp", clientId: TEMPLATES_ID, title: "Legs", date: null, createdAt: "2026-11-01T10:00:00.000Z", completedAt: null, skippedAt: null, rows: [] });
  app.set({ view: { name: "client", id: "c1" } }); fns.render();
  const at = () => ({ view: app.get().view.name, wsdock: body.classList.contains("wsdock"), ws: dock.classList.contains("ws"), bar: items.filter((k) => !k.hidden).map((k) => k.id).join(",") });
  const swipe = async (label) => {                                      // a finger from the left edge to 240 of 390, and let go
    const target = { closest: () => null }; let ts = 1000;
    fire("touchstart", { touches: [{ clientX: 5, clientY: 300 }], target, timeStamp: ts });
    for (const x of [20, 60, 120, 180, 240]) { ts += 16; fire("touchmove", { touches: [{ clientX: x, clientY: 300 }], target, timeStamp: ts }); }
    out[label] = { live: at(), picture: shown() };
    fire("touchend", { changedTouches: [{ clientX: 240 }], target, timeStamp: ts + 5 }); await wait(1500);
    out[label].landed = at();
  };
  await wait(10); fns.addTraining("c1"); await wait(10);              // the client page's +: a new, empty workout (the client page's picture is taken)
  out.workout = at();
  tplFill.fire("click", {}); await wait(10);                           // From template (the workout's picture is taken)
  out.templates = at();
  await swipe("templatesToWorkout");
  await swipe("workoutToClient");
  // a template with Unsaved changes: Back is refused (the Unsaved changes bar is nudged), and the page comes back in
  app.set({ view: { name: "training", id: "tp" }, renderedTraining: null }); fns.render(); await wait(10);
  fns.scheduleSave("trainings", "tp");                                  // an edit: the template's draft has an unsaved change
  out.template = { ...at(), dirty: !!(app.get().templateDraft && app.get().templateDraft.dirty) };
  moves.length = 0;
  await swipe("refused");
  out.refused.moves = moves.slice();
  for (const t of maps.timers.values()) clearTimeout(t);
}
console.log(JSON.stringify(out));
process.exit(0);
