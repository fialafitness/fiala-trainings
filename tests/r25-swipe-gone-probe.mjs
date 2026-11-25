// Run by template-draft.test.js in its own process (v316, the twenty-fifth check round, R25-DRF-4): the swipe back under way on a template's page
// when a sync finds the template deleted on the coach's other device. draftGone (round 23; round 24 made it Back's own step and the page the device
// opens on) takes the page to the template's folder while the finger is still down, and the swipe, let go past half, then took its own Back as well:
// one page too far, the Templates list, kept as the page to open on. Now a swipe whose page changed under it lets go of its slide and leaves the page
// where the sync put it. Started from row-swipe-probe.mjs (its clock, the document's listeners, the elements that know their place, the trackpad's
// wheel events) with the stand-in server (fake-supabase.js) for the sync: the iPhone home-screen app's edge swipe (fns.forceSwipe, the app's own
// switch for it) and a Mac's two-finger swipe. Prints, as JSON, where each one landed.
import { byId } from "./env.js";
import { makeSupabase } from "./fake-supabase.js";
// the clock: every timer the app sets is this one's, and so is performance.now
let NOW = 10000, SEQ = 0; const Q = [];
globalThis.setTimeout = (fn, ms) => { const id = ++SEQ; Q.push({ id, at: NOW + Math.max(0, ms || 0), fn }); return id; };
globalThis.clearTimeout = (id) => { const i = Q.findIndex((q) => q.id === id); if (i >= 0) Q.splice(i, 1); };
try { performance.now = () => NOW; } catch (_) { Object.defineProperty(globalThis, "performance", { value: { now: () => NOW }, configurable: true }); }
const flush = async () => { for (let i = 0; i < 30; i++) await Promise.resolve(); };
async function advance(ms) {
  const end = NOW + ms;
  for (;;) { Q.sort((a, b) => a.at - b.at || a.id - b.id); const q = Q[0]; if (!q || q.at > end) break; Q.shift(); NOW = Math.max(NOW, q.at); q.fn(); await flush(); }
  NOW = end; await flush();
}
// the document keeps its listeners; held() finds no sheet, picture or menu up
const L = {};
document.addEventListener = (t, fn, o) => { (L[t] ||= []).push({ fn, capture: o === true || !!(o && o.capture) }); };
document.removeEventListener = (t, fn) => { const a = L[t] || []; const i = a.findIndex((x) => x.fn === fn); if (i >= 0) a.splice(i, 1); };
globalThis.addEventListener = () => {}; globalThis.removeEventListener = () => {};
globalThis.fetch = async () => { throw new Error("no network in this probe"); };
const qs = document.querySelector; document.querySelector = (s) => (/crop-view|sheet-bg|header \.bar/.test(s) ? null : qs(s));   // (no bar to copy under the swipe back)
document.getElementById("whenBg").hidden = true;
globalThis.innerWidth = 402;                                               // an iPhone 17 Pro's width, in points
globalThis.DOMMatrixReadOnly = class { constructor(s) { const m = /matrix\(([^)]*)\)/.exec(s || ""); const v = m ? m[1].split(",").map(Number) : [1, 0, 0, 1, 0, 0]; this.m41 = v[4]; } };
globalThis.getComputedStyle = () => ({ transform: "none", getPropertyValue: () => "", display: "block", color: "" });
function fire(type, ev) {
  let stopped = false; ev.type = type; ev.defaultPrevented = false;
  ev.preventDefault = () => { ev.defaultPrevented = true; }; ev.stopPropagation = () => {}; ev.stopImmediatePropagation = () => { stopped = true; };
  if (ev.timeStamp == null) ev.timeStamp = NOW;
  const ls = L[type] || []; for (const l of [...ls.filter((x) => x.capture), ...ls.filter((x) => !x.capture)]) { if (stopped) break; l.fn(ev); }
  return ev;
}
// the page under the fingers: an element that knows its place (what the trackpad's rules read)
const ROOT = { tagName: "HTML", parentElement: null };
const matches = (n, sel) => sel.split(",").some((part) => {
  const m = part.trim().match(/^([a-z]+)?(#[\w-]+)?((?:\.[\w-]+)*)$/i); if (!m) return false;
  const [, tag, id, cls] = m;
  return (!tag || n.tagName === tag.toUpperCase()) && (!id || n.id === id.slice(1)) && (cls || "").split(".").filter(Boolean).every((c) => n.classList.contains(c));
});
function mk(tag) {
  const set = new Set();
  const n = { nodeType: 1, tagName: tag.toUpperCase(), id: "", children: [], parentElement: null, dataset: {}, style: {},
    classList: { add: (...c) => c.forEach((x) => set.add(x)), remove: (...c) => c.forEach((x) => set.delete(x)), toggle: (c, f) => { const on = f === undefined ? !set.has(c) : !!f; if (on) set.add(c); else set.delete(c); return on; }, contains: (c) => set.has(c) },
    get isConnected() { let p = n; while (p.parentElement) p = p.parentElement; return p === ROOT; },
    append(...k) { for (const c of k) { c.parentElement = n; n.children.push(c); } },
    closest(sel) { for (let p = n; p && p !== ROOT; p = p.parentElement) if (matches(p, sel)) return p; return null; },
    contains(o) { for (let p = o; p; p = p.parentElement) if (p === n) return true; return false; },
    getBoundingClientRect() { return { width: 402, height: 60, top: 0, left: 0, right: 402, bottom: 60 }; } };
  return n;
}
const pageMain = mk("main"), pageDiv = mk("div"); pageMain.append(pageDiv); pageMain.parentElement = ROOT;
const app = (await import("../app/main.js")).internals();
const { fns, maps } = app;
const { TEMPLATES_ID } = await import("../app/model.js");

const TP = "4b6d8f0a-2c4e-4a6b-8d0f-1a3c5e7a9b1d", AT = "2026-11-10T16:00:00.000Z", FOLDER = { name: "client", id: TEMPLATES_ID, folder: "f1" };
const sync = async () => { let done = false; fns.syncDownNow().finally(() => { done = true; }); for (let i = 0; i < 100 && !done; i++) await advance(5); };   // a sync (the stand-in server answers at once): 5 ms steps of this clock until it is over
const where = () => { const v = app.get().view; return v.name === "training" ? (maps.trainings.get(v.id) || {}).title || "a workout gone" : v.name === "client" && v.id === TEMPLATES_ID ? (v.folder ? "Strength" : "Templates") : v.name; };   // the page up, by what the coach reads on it
const kept = () => { const v = JSON.parse(localStorage.getItem("fiala.trainings.view") || "null"); return v ? (v.name === "client" && v.id === TEMPLATES_ID ? (v.folder ? "Strength" : "Templates") : v.name === "training" ? "Upper A's page" : v.name) : null; };   // the page the device opens on next time
async function onUpperA(typed) {                                          // the coach's Clients list, Templates, Strength, then Upper A's page (no exercises yet); a name typed there, or nothing
  fns.forceSwipe(false); app.reset(); fns.leaveSettings(); localStorage.clear(); Q.length = 0;
  const sb = makeSupabase();
  sb.seed("ft_clients", TEMPLATES_ID, { id: TEMPLATES_ID, name: "Templates", kind: "templates", templatesVersion: 999, folders: [{ id: "f1", name: "Strength", parent: null, kind: "folder", at: AT }], builtinsAdopted: 1 });
  sb.seed("ft_trainings", TP, { id: TP, clientId: TEMPLATES_ID, title: "Upper A", date: "2026-01-01", createdAt: AT, completedAt: null, skippedAt: null, template: { program: "My templates", phase: 0, stage: 0, n: 1, folder: "f1" }, rows: [] });
  app.set({ sb, signedIn: true, clientMode: false, backend: fns.cloudBackend, sessionEmail: "coach@x.com", view: { name: "clients" }, templateDraft: null });
  await sync();
  for (const v of [{ name: "clients" }, { name: "client", id: TEMPLATES_ID }, FOLDER]) { fns.go(v); await flush(); }
  const folder = fns.navState().depth;
  fns.go({ name: "training", id: TP }); await flush();
  if (typed) { maps.trainings.get(TP).title = "Upper A1"; fns.scheduleSave("trainings", TP); }   // as the name box's input handler does (it waits as a draft)
  fns.forceSwipe(true); document.activeElement = null;                 // the home-screen app's own swipe back (a Mac's two fingers take the same one)
  return { sb, folder, log: { page: where(), draft: !!app.get().templateDraft } };
}
const pt = (x, y) => ({ clientX: x, clientY: y }), onPage = { closest: () => null };   // a touch on the page (no part of it keeps the touch for itself)
const touch = (type, x) => fire(type, { target: onPage, touches: type === "touchend" ? [] : [pt(x, 400)], changedTouches: [pt(x, 400)], cancelable: true });
const wheel = (dx) => fire("wheel", { deltaX: dx, deltaY: 0, deltaMode: 0, ctrlKey: false, target: pageDiv, webkitDirectionInvertedFromDevice: true, timeStamp: Math.floor(NOW) });
const FINGERS = [1, 2, 4, 6, 9, 12, 14, 15], COAST = [15, 16, 15, 15, 16, 15, 15, 15, 14, 15, 14, 14, 13, 13, 12, 12, 11, 11, 10, 10, 9, 9, 8, 8, 7, 7, 6, 6, 5, 5, 5, 4, 4, 4, 3, 3, 3, 2, 2, 2, 2, 1, 1, 1, 1, 1];   // a Mac's two-finger flick to the right, as row-swipe-probe.mjs plays it
async function swipe(how, { typed = false, gone = true } = {}) {
  const { sb, folder, log } = await onUpperA(typed);
  const deleteThere = async () => { if (!gone) return; sb.tables.ft_trainings.delete(TP); await sync(); const s = fns.swipeState(); log.during = { page: where(), sliding: !!(s && s.on), depth: fns.navState().depth - folder, kept: kept() }; };   // the iPad's Delete template, and this Mac's sync that finds it gone, mid-swipe
  if (how === "trackpad") {
    for (const d of FINGERS) { wheel(-d); await advance(8.33); }          // two fingers to the right: the page follows them
    await deleteThere();
    for (const d of COAST) { wheel(-d); await advance(8.33); }            // and coasts on past half: it goes
  } else {
    const to = how === "short" ? 70 : 260;                               // past half the screen (402), or a short way and back
    touch("touchstart", 6); for (let x = 18; x <= to; x += 12) { await advance(16); touch("touchmove", x); }   // the edge swipe, 12 points a frame
    await deleteThere();
    await advance(120); touch("touchend", to);                           // the finger rests, then lets go (no speed: where it is decides)
  }
  await advance(1500);
  log.after = { page: where(), sliding: !!fns.swipeState(), depth: fns.navState().depth - folder, kept: kept() };
  await fns.goBackNow(); await advance(400); log.back = { page: where(), depth: fns.navState().depth - folder };   // one more Back
  fns.forceSwipe(false); return log;
}
const out = { swiped: await swipe("finger", { gone: false }), gone: await swipe("finger"), goneTyped: await swipe("finger", { typed: true }), goneShort: await swipe("short"), goneTrackpad: await swipe("trackpad") };
console.log(JSON.stringify(out));
process.exit(0);
