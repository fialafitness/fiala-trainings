// Run by cal-fold.test.js in its own processes: the client page's month and a reload (v251: a reload opens on the week).
//   before <killedOnMonth|leftAndBack>  the coach on Jane's page taps Month (and, for leftAndBack, opens today's workout from the month and
//                                       comes Back); prints what the device keeps, as the browser would hand it to the next page
//   after                               a new page from that storage (stdin), with the Supabase library on the page as in a browser (so
//                                       nothing is drawn while the script loads) and boot() opening straight on the saved page
//   release <visible|hidden>            the app's own reload for a newer release with the month open and the window 600 down (he comes
//                                       back and the worker answers; or a newer release is known and he leaves the app): the page as the
//                                       reload is asked for, which is what the browser keeps for its put-back of the scroll
import fs from "node:fs";
import { byId, el, storage } from "./env.js";
const [phase, arg] = process.argv.slice(2);
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
const L = {};
document.addEventListener = (t, fn) => { (L[t] ||= []).push({ fn }); };
document.removeEventListener = (t, fn) => { const a = L[t] || []; const i = a.findIndex((x) => x.fn === fn); if (i >= 0) a.splice(i, 1); };
globalThis.addEventListener = () => {}; globalThis.removeEventListener = () => {};
const qs = document.querySelector; document.querySelector = (s) => (/sheet-bg|crop-view|header \.bar/.test(s) ? null : qs(s));
document.contains = (x) => !!x;
const fireDoc = (type, ev = {}) => { ev.type = type; for (const l of [...(L[type] || [])]) l.fn(ev); };
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
recorder("tabbar"); recorder("meDisc");
calWrap.hidden = true;
const make = document.createElement; document.createElement = (t) => listens(kids(make(t)));
// the window: 800 tall; the client's page 1500 tall with its month, 1280 with its week; any other page 2000
let rawY = 0;
const pageH = () => (byId.get("vClient") && !byId.get("vClient").hidden ? (calWrap.hidden ? 1280 : 1500) : 2000);
const maxY = () => Math.max(0, pageH() - 800);
Object.defineProperty(globalThis, "scrollY", { get: () => Math.min(rawY, maxY()), configurable: true });
Object.defineProperty(globalThis, "scrollTo", { value: (x, y) => { rawY = Math.max(0, Math.min(maxY(), Math.round(Number(y) || 0))); }, configurable: true, writable: true });
Object.defineProperty(document.documentElement, "scrollHeight", { get: () => pageH(), configurable: true });
const calLook = () => ({ month: !calWrap.hidden, week: !weekView.hidden, head: !weekHead.hidden, toggle: toggleText.textContent, arrowUp: toggle.classList.contains("open") });
let app = null;
const seen = () => ({ view: app.get().view.name, tab: app.get().tab, open: app.fns.calState().open, ...calLook(), y: globalThis.scrollY });
const todayInMonth = () => {
  const panel = byId.get("calTrack").children[1], grid = panel && panel.children[0], n = String(new Date().getDate());
  return grid && grid.children.find((b) => (b.children || []).some((s) => s.className === "dn" && s.textContent === n));
};
const day = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return app.fns.localIso(d); };
const janesPage = () => {
  app.reset(); app.set({ signedIn: true, clientMode: false, myClientId: null, tab: "workouts" });
  app.maps.clients.set("c1", { id: "c1", name: "Jane", unit: "lb" });
  app.maps.trainings.set("w1", { id: "w1", clientId: "c1", title: "Legs", date: day(0), createdAt: "2026-11-01T10:00:00.000Z", completedAt: null, skippedAt: null, rows: [] });
  app.set({ view: { name: "client", id: "c1" } }); app.fns.render();
};
const out = { phase, arg };

if (phase === "after") {
  for (const [k, v] of JSON.parse(fs.readFileSync(0, "utf8"))) storage.setItem(k, v);
  storage.setItem("fiala.cal.open", "true");                                // and a device an older version left on the month
  globalThis.supabase = { createClient: () => ({ auth: { onAuthStateChange() {}, getSession: () => new Promise(() => {}) } }) };   // the library is on the page; the session is still on its way
}
if (phase === "release") {
  document.querySelectorAll = (s) => (s === "script[type=module]" ? [{ textContent: 'import { boot } from "./app/main.js?v=251"; boot();' }] : []);   // the page's own release
  const SW = {};
  navigator.serviceWorker = {                                               // the worker answers "check" with a newer release on the device
    controller: { postMessage: (m) => { if (m && m.type === "check") setTimeout(() => { for (const fn of SW.message || []) fn({ data: { type: "release", current: 252 } }); }, 60); } },
    addEventListener: (t, fn) => { (SW[t] ||= []).push(fn); },
    getRegistration: () => Promise.resolve({ update() {} }),
  };
  out.reloads = [];
  location.reload = () => { out.reloads.push(seen()); };                    // what the browser keeps for the reloaded page: the window's place at this moment
  out.say = () => { for (const fn of SW.message || []) fn({ data: { type: "release", current: 252 } }); };
}
app = (await import("../app/main.js")).internals();

if (phase === "before") {
  janesPage();
  storage.setItem("fiala.trainings.view", JSON.stringify({ name: "client", id: "c1" }));   // what the app keeps anyway: the page he is on, its tab,
  storage.setItem("fiala.trainings.tab", JSON.stringify("workouts"));                      // the account and the device copy
  storage.setItem("fiala.trainings.role", JSON.stringify({ email: "coach@example.com", role: "trainer" }));
  app.fns.localBackend.save();
  toggle.fire("click", {}); out.opened = seen();                            // he taps Month
  if (arg === "leftAndBack") {
    const b = todayInMonth(); out.found = !!b; if (b) { b.fire("click", {}); byId.get("pvGo").fire("click", { detail: 0 }); } await flush(); out.left = seen();
    app.fns.goBackNow(); await flush(); await advance(50); out.back = seen();
  }
  out.storage = [...storage.map];
} else if (phase === "after") {
  app.fns.boot(); await flush(); await advance(50);
  out.booted = seen();
} else if (phase === "release") {
  const say = out.say; delete out.say;
  await app.fns.boot(); await advance(50);
  janesPage(); toggle.fire("click", {}); scrollTo(0, 600); out.before = seen();
  if (arg === "visible") { document.visibilityState = "visible"; fireDoc("visibilitychange"); await advance(200); }   // he comes back: the page asks, the worker answers at once
  else { say(); await advance(50); out.whileUp = out.reloads.length; document.visibilityState = "hidden"; fireDoc("visibilitychange"); await advance(50); }   // known while he looks (no reload under him), then he leaves the app
  out.atReload = out.reloads[0] || null; out.reloadCount = out.reloads.length; delete out.reloads;
}
console.log(JSON.stringify(out));
process.exit(0);
