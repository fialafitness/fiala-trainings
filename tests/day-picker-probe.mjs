// Run by day-picker.test.js in its own process: the day picker's finger handling needs its elements to record their listeners before the app
// loads (the shared stand-in drops them), so this loads the real app/main.js with recording stand-ins for the picker and the "…" menu, and
// prints, as JSON, where the months are after each gesture and which day, if any, a click picked.
import { byId, el } from "./env.js";
const W = 350;
const kids = (e) => {                                                    // an element that keeps what is put in it, as the page's own do
  e.replaceChildren = (...k) => { e.children = k; e.firstElementChild = k[0] || null; };
  e.appendChild = (c) => { e.children = [...e.children, c]; e.firstElementChild = e.children[0]; return c; };
  e.append = (...k) => { e.children = [...e.children, ...k]; e.firstElementChild = e.children[0] || null; };
  return e;
};
const listens = (e) => {                                                 // and records its listeners, and takes focus
  const L = {};
  e.addEventListener = (type, fn) => { (L[type] ||= []).push(fn); };
  e.fire = (type, ev) => { for (const fn of L[type] || []) fn(ev); };
  e.focus = () => { document.activeElement = e; };
  return e;
};
const recorder = (id, extra = {}) => { const e = listens(kids(el("div"))); Object.assign(e, extra); byId.set(id, e); return e; };
const g = recorder("dpGrid", { clientWidth: W, setPointerCapture() {} });
recorder("dpPrev"); const next = recorder("dpNext"); recorder("dpToday"); const pickBg = recorder("datePick"), pickCancel = recorder("dpCancel");
const pop = recorder("whenPop"); pop.querySelector = (sel) => (sel === ".wopt" ? pop.children.find((c) => /\bwopt\b/.test(c.className)) || null : null); pop.contains = (x) => !!x && pop.children.includes(x);
const bg = recorder("whenBg"); const more = recorder("tMore");
const make = document.createElement; document.createElement = (t) => listens(kids(make(t)));
document.contains = (x) => !!x;
globalThis.getComputedStyle = (node) => {                                // where the track stands: its last written transform
  const m = /translate3d\(([-\d.e]+)px/.exec((node && node.style && node.style.transform) || "");
  return { transform: m ? "matrix(1, 0, 0, 1, " + Number(m[1]) + ", 0)" : "none", getPropertyValue: () => "", display: "block", color: "" };
};
const app = (await import("../app/main.js")).internals();
const { fns, maps } = app;
const day = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return fns.localIso(d); };
let picked = [];
const workout = (clientMode) => {
  app.reset(); app.set({ signedIn: true, clientMode, myClientId: clientMode ? "c1" : null, tab: "workouts" });
  maps.clients.set("c1", { id: "c1", name: "Jane", unit: "lb" });
  maps.trainings.set("w1", { id: "w1", clientId: "c1", title: "Legs", date: day(1), createdAt: "2026-11-01T10:00:00.000Z", completedAt: null, skippedAt: null, rows: [] });
  app.set({ view: { name: "training", id: "w1" } }); fns.render();
};
const setup = (opts = {}) => {
  workout(false); picked = [];
  fns.openDatePicker({ clientId: "c1", title: "Move to", selected: fns.today(), onPick: (d) => picked.push(d), ...opts });
};
const wait = (ms) => new Promise((res) => setTimeout(res, ms));
const track = () => g.firstElementChild;
const px = () => { const m = /translate3d\(([-\d.e]+)px/.exec(track().style.transform || ""); return m ? Number(m[1]) : null; };
const at = () => { const x = px(); return x === null ? null : x / -W; };   // in months from the first
const state = () => { const dp = fns.datePicker(); return { at: at(), idx: dp.months.indexOf(dp.month), month: dp.month, moving: /transform \d/.test(track().style.transition || "") }; };
const ev = (x, y, t, type = "touch") => ({ isPrimary: true, pointerId: 1, pointerType: type, clientX: x, clientY: y, timeStamp: t, button: 0 });
const dayBtn = (n, page) => { const dp = fns.datePicker(); return track().children[page ?? dp.months.indexOf(dp.month)].children.find((b) => b.children[0] && b.children[0].textContent === String(n)); };
const click = (detail = 1, n = 15) => {                                  // as a browser sends it: the pager's capture listener first, then the day's own unless it was stopped; true if a day was picked
  if (!fns.datePicker()) return null; const b = dayBtn(n), before = picked.length;
  const c = { detail, stopped: false, stopPropagation() { this.stopped = true; }, preventDefault() {} };
  g.fire("click", c); if (!c.stopped) b.fire("click", c);
  return picked.length > before;
};
const slide = (t0) => { g.fire("pointerdown", ev(300, 300, t0)); g.fire("pointermove", ev(285, 300, t0 + 16)); g.fire("pointermove", ev(270, 300, t0 + 32)); g.fire("pointerup", ev(270, 300, t0 + 200)); };
const out = {};

setup(); out.open = state();
out.inert = track().children.map((p) => !!p.inert);                     // only the month shown takes focus

// a finger that goes down first, then sideways: the months stay where they are
setup(); g.fire("pointerdown", ev(200, 300, 0)); g.fire("pointermove", ev(200, 312, 16));
for (let k = 1; k <= 10; k++) g.fire("pointermove", ev(200 - 15 * k, 312, 16 + 16 * k));
out.verticalMid = state(); g.fire("pointerup", ev(50, 312, 400)); out.verticalAfter = state();

// steeper than 45 degrees from the start (a scroll's angle): the same
setup(); g.fire("pointerdown", ev(300, 300, 0));
for (let k = 1; k <= 10; k++) g.fire("pointermove", ev(300 - 16 * k, 300 + 18 * k, 16 * k));
g.fire("pointerup", ev(140, 480, 200)); out.steep = state();

// sideways: follows the finger 1:1 and, let go past half at rest, settles on the next month
setup(); const i0 = state().idx; g.fire("pointerdown", ev(300, 300, 0)); g.fire("pointermove", ev(288, 301, 16));
for (let k = 1; k <= 10; k++) g.fire("pointermove", ev(288 - 20 * k, 301, 16 + 16 * k));
out.dragMid = state(); out.dragged = g.classes.has("dragged");
g.fire("pointerup", ev(88, 301, 400)); out.dragAfter = { ...state(), from: i0 };
out.inertAfter = track().children.map((p) => !!p.inert);
g.fire("pointerdown", ev(200, 300, 500)); out.draggedNextTouch = g.classes.has("dragged"); g.fire("pointerup", ev(200, 300, 520));

// a mouse dragging keeps its hover (it is really over a day)
setup(); g.fire("pointerdown", ev(300, 300, 0, "mouse")); g.fire("pointermove", ev(280, 300, 16, "mouse")); out.mouseDragged = g.classes.has("dragged");
g.fire("pointerup", ev(280, 300, 400, "mouse"));

// the pager scrolled by a focus: put back as the months move
setup(); g.scrollLeft = 255; next.fire("click", {}); out.scrollLeft = g.scrollLeft; out.afterNext = state();

// the click a slide leaves behind (iPhone sends it a moment later) picks no day; the next plain tap does; a keyboard's Enter always does
setup(); await wait(360); slide(0); await wait(30);
out.lateClickAfterSlide = click();
g.fire("pointerdown", ev(200, 300, 1000)); g.fire("pointerup", ev(200, 300, 1050)); out.tapClick = click(); out.tapPicked = picked[0] || null;
setup(); slide(2000); out.keyboardAfterSlide = click(0);
// a slide that brought no click at all (a long slide brings none): the next tap still picks its day
setup(); await wait(360); slide(3000); g.fire("pointerdown", ev(200, 300, 4000)); g.fire("pointerup", ev(200, 300, 4050)); out.tapAfterSlideNoClick = click();

// a touch on months still settling only catches them: its tap picks no day
setup(); track().style.transform = "translate3d(" + (-12 * W - 100) + "px,0,0)";   // mid-settle, 100 px short of the month
await wait(360); g.fire("pointerdown", ev(200, 300, 0)); out.catchPress = g.classes.has("dragged"); g.fire("pointerup", ev(200, 300, 60)); out.catchClick = click();

// caught while bouncing back from past the first month (Reschedule opens on its first) or the last: nothing jumps, and it gives a third of the finger
setup({ min: fns.today() }); track().style.transform = "translate3d(30px,0,0)";   // 30 px past the first month on screen: a 90 px pull let go a moment ago
g.fire("pointerdown", ev(200, 300, 0)); g.fire("pointermove", ev(212, 300, 16)); out.catchFirst = px(); g.fire("pointermove", ev(242, 300, 32)); out.catchFirstOn = px(); g.fire("pointerup", ev(242, 300, 300));
setup(); const lastX = -24 * W; track().style.transform = "translate3d(" + (lastX - 30) + "px,0,0)";
g.fire("pointerdown", ev(200, 300, 0)); g.fire("pointermove", ev(188, 300, 16)); out.catchLast = px() - lastX; g.fire("pointerup", ev(188, 300, 300));

// a short flick after the finger rested a moment still counts as a flick
setup(); const f0 = state().idx; g.fire("pointerdown", ev(300, 300, 0)); g.fire("pointermove", ev(288, 300, 16)); g.fire("pointermove", ev(260, 300, 40));
g.fire("pointermove", ev(245, 300, 600)); g.fire("pointermove", ev(230, 300, 612)); g.fire("pointermove", ev(215, 300, 624)); g.fire("pointerup", ev(215, 300, 630));
out.flickAfterRest = { from: f0, to: state().idx };

// a second finger that touches and lifts mid-slide: the first finger's slide goes on under it
setup(); g.fire("pointerdown", ev(300, 300, 0)); g.fire("pointermove", ev(288, 300, 16)); for (let k = 1; k <= 3; k++) g.fire("pointermove", ev(288 - 20 * k, 300, 16 + 16 * k));
const two = { ...ev(100, 420, 100), pointerId: 2, isPrimary: false };
g.fire("pointerdown", two); g.fire("pointerup", { ...two, timeStamp: 160 });
out.secondFinger = { idx: state().idx, dragged: g.classes.has("dragged"), before: at() };
g.fire("pointermove", ev(178, 300, 200)); out.secondFinger.after = at(); g.fire("pointerup", ev(178, 300, 500)); out.secondFinger.end = state().idx;

// a sync's redraw (render) waits for a settle, an arrow's slide and a finger that is down, and then comes
setup(); slide(0); let held = track(); fns.render(); out.redrawSettle = { kept: track() === held, moving: /transform \d/.test(held.style.transition) };
await wait(450); out.redrawSettle.after = track() !== held;
setup(); next.fire("click", {}); held = track(); fns.render(); out.redrawArrow = { kept: track() === held }; await wait(300); out.redrawArrow.after = track() !== held;
setup(); g.fire("pointerdown", ev(200, 300, 0)); held = track(); fns.render(); out.redrawFinger = { kept: track() === held };
g.fire("pointerup", ev(200, 300, 50)); out.redrawFinger.lift = track() === held; await wait(450); out.redrawFinger.after = track() !== held;

// days drawn before midnight: the first day allowed is asked again, so yesterday is not picked and greys out
let minNow = fns.today();
setup({ title: "Reschedule", min: () => minNow }); const todayN = new Date().getDate(), todayPage = fns.datePicker().months.indexOf(fns.today().slice(0, 7));
out.midnight = { before: !dayBtn(todayN, todayPage).disabled };
await wait(360); minNow = day(1); held = track(); const stale = dayBtn(todayN, todayPage), n0 = picked.length;
stale.fire("click", { detail: 1 }); out.midnight.picked = picked.length > n0; out.midnight.open = !!fns.datePicker(); out.midnight.redrawn = track() !== held;
const fresh = dayBtn(todayN, todayPage); out.midnight.greyed = fresh.disabled === true && fresh.classes.has("off");
fns.closeDatePicker();

// the second tap of a double tap (on a row's Reschedule, on the "…" menu's) lands on the days as they come up: 340 ms after they opened a day,
// the backdrop and Cancel take no tap (a keyboard's Enter, detail 0, always does); 360 ms after, a tap picks its day, the backdrop and Cancel
// close (the clock is moved on by hand: the 350 ms are measured on performance.now)
{ const realNow = performance.now.bind(performance), base = realNow(); let later = 0; performance.now = () => base + later;   // a clock moved only by hand: the 10 ms between 340 and 350 never hang on how fast this machine draws the months
  const bgTap = () => { pickBg.fire("click", { target: pickBg, detail: 1 }); return !!fns.datePicker(); }, cancelTap = () => { pickCancel.fire("click", { target: pickCancel, detail: 1 }); return !!fns.datePicker(); };
  const when = (ms, fn) => { setup(); later = ms; try { return fn(); } finally { later = 0; } };
  out.settle = { day: when(340, () => click(1, 20)), backdrop: when(340, bgTap), cancel: when(340, cancelTap), keyboard: when(0, () => click(0, 20)),
    dayLater: when(360, () => click(1, 20) && picked[0]), backdropLater: when(360, bgTap), cancelLater: when(360, cancelTap) };
  const early = (type) => when(150, () => { g.fire("pointerdown", ev(200, 300, 0, type)); g.fire("pointerup", ev(200, 300, 60, type)); return { picked: click(2, 20), letGo: g.classes.has("dragged") }; });   // the day that tap landed on lets go of the grey iOS leaves on it, as a catch's does (a mouse is really there: its hover stays)
  out.settle.earlyTouch = early("touch"); out.settle.earlyMouse = early("mouse");
  performance.now = realNow; }
// the "…" from the keyboard (or VoiceOver): focus goes into its menu, and comes back to the "…" when the menu or the days close; a tap leaves focus alone
workout(true); document.activeElement = more;
more.fire("click", { detail: 0, stopPropagation() {} });
const row = pop.children[0]; out.menu = { open: bg.hidden === false, focusIn: document.activeElement === row };
row.fire("click", { stopPropagation() {} });
out.menu.closed = bg.hidden === true; out.menu.picker = !!fns.datePicker(); out.menu.backIsMore = !!fns.datePicker() && fns.datePicker().back === more;
fns.closeDatePicker(); out.menu.focusBack = document.activeElement === more;
document.activeElement = null; more.fire("click", { detail: 1, stopPropagation() {} }); out.menu.tapLeavesFocus = document.activeElement === null && bg.hidden === false;

console.log(JSON.stringify(out));
process.exit(0);
