// Run by row-delete.test.js in its own process: the coach's Delete in a workout row's touch and hold (and right-click, and the Missed
// card's "…"), the owner's ask 14 Nov (v298): "press and hold will have one more option and that is to delete ... only coach", Today and Up next,
// and the Missed card's too (the owner's pick). It asks first, as the workout page's own Delete. This loads the real app/main.js on a page whose
// question sheet keeps its listeners and whose lists keep their rows, with every timer on this probe's own clock.
import { byId, el } from "./env.js";
let NOW = 10000, SEQ = 0; const Q = [];
globalThis.setTimeout = (fn, ms) => { const id = ++SEQ; Q.push({ id, at: NOW + Math.max(0, ms || 0), fn }); return id; };
globalThis.clearTimeout = (id) => { const i = Q.findIndex((q) => q.id === id); if (i >= 0) Q.splice(i, 1); };
try { performance.now = () => NOW; } catch (_) { Object.defineProperty(globalThis, "performance", { value: { now: () => NOW }, configurable: true }); }
const flush = async () => { for (let i = 0; i < 30; i++) await Promise.resolve(); };
async function advance(ms) { const end = NOW + ms; for (;;) { Q.sort((a, b) => a.at - b.at || a.id - b.id); const q = Q[0]; if (!q || q.at > end) break; Q.shift(); NOW = Math.max(NOW, q.at); q.fn(); await flush(); } NOW = end; await flush(); }
const L = {};
document.addEventListener = (t, fn, o) => { (L[t] ||= []).push({ fn, capture: o === true || !!(o && o.capture) }); };
document.removeEventListener = (t, fn) => { const a = L[t] || []; const i = a.findIndex((x) => x.fn === fn); if (i >= 0) a.splice(i, 1); };
globalThis.addEventListener = () => {}; globalThis.removeEventListener = () => {};
const rejected = []; process.on("unhandledRejection", (e) => { rejected.push(String((e && e.message) || e)); });
// the page's own elements: they keep what is put in them (each child knowing its parent, so a row knows its list and its neighbours),
// their listeners, the focus, and the few lookups a row's Delete makes to give a keyboard its place back
const elems = (k) => k.filter((c) => c && typeof c === "object");
const kids = (e) => {
  const own = (k) => { for (const c of elems(k)) c.parentElement = e; };
  const drop = () => { for (const c of elems(e.children || [])) if (c.parentElement === e) c.parentElement = null; };
  e.parentElement = null;
  e.replaceChildren = (...k) => { drop(); e.children = k; e.firstElementChild = elems(k)[0] || null; own(k); };
  e.appendChild = (c) => { e.children = [...e.children, c]; e.firstElementChild = elems(e.children)[0] || null; own([c]); return c; };
  e.append = (...k) => { e.children = [...e.children, ...k]; e.firstElementChild = elems(e.children)[0] || null; own(k); };
  const sib = (d) => { const p = e.parentElement, a = p ? elems(p.children || []) : [], i = a.indexOf(e); return i >= 0 ? a[i + d] || null : null; };
  Object.defineProperty(e, "nextElementSibling", { get: () => sib(1), configurable: true });
  Object.defineProperty(e, "previousElementSibling", { get: () => sib(-1), configurable: true });
  const has = e.classList.contains, cls = (c) => has(c) || (" " + e.className + " ").includes(" " + c + " ");
  e.classList = { ...e.classList, contains: cls };
  e.closest = (sel) => { if (sel !== "li[data-tid]") return null; for (let x = e; x; x = x.parentElement) if (x.tagName === "LI" && x.dataset && x.dataset.tid) return x; return null; };
  e.querySelectorAll = (sel) => (sel === ":scope > li[data-tid]" ? elems(e.children || []).filter((c) => c.tagName === "LI" && c.dataset && c.dataset.tid) : []);
  e.querySelector = (sel) => (sel === ":scope > button" ? elems(e.children || []).find((c) => c.tagName === "BUTTON") || null : sel === ":scope > .miss-more" ? elems(e.children || []).find((c) => c.className === "miss-more") || null : el());
  e.focus = (o) => { document.activeElement = e; e.focusOpts = o || null; };
  e.blur = () => { if (document.activeElement === e) document.activeElement = document.body; };
  return e;
};
const listens = (e) => { const H = {}; e.addEventListener = (type, fn) => { (H[type] ||= []).push(fn); }; e.removeEventListener = (type, fn) => { const a = H[type] || []; const i = a.indexOf(fn); if (i >= 0) a.splice(i, 1); }; e.fire = (type, ev = {}) => { for (const fn of [...(H[type] || [])]) fn({ stopPropagation() {}, preventDefault() {}, target: e, ...ev }); }; return e; };
const recorder = (id, extra = {}) => { const e = listens(kids(el("div"))); Object.assign(e, extra); byId.set(id, e); return e; };
for (const id of ["askSheet", "askYes", "askNo", "askTitle", "askText", "askInput", "todayList", "nextList", "missList", "calView", "calTrack", "week", "calWrap", "skipSheet", "skGo", "skKeep"]) recorder(id, { clientWidth: 350 });
byId.get("askSheet").hidden = true; byId.get("calWrap").hidden = true; byId.get("skipSheet").hidden = true;
document.getElementById("whenPop").contains = (x) => !!x && x.menuRow === true;
{ const inSheet = new Set(["askSheet", "askYes", "askNo", "askTitle", "askText", "askInput"].map((id) => byId.get(id))); byId.get("askSheet").contains = (x) => inSheet.has(x); }
document.getElementById("whenBg").hidden = true;
const make = document.createElement; document.createElement = (t) => listens(kids(make(t)));
const app = (await import("../app/main.js")).internals();
const { fns, maps } = app;
const at = (n) => { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + n); return d; };
const W = (id, n) => ({ id, clientId: "c1", title: id.toUpperCase(), date: fns.localIso(at(n)), createdAt: "2026-01-01T10:00:00.000Z", completedAt: null, skippedAt: null, rows: [] });
const seed = (clientMode = false, more = []) => {
  if (!byId.get("askSheet").hidden) byId.get("askNo").fire("click");
  app.reset(); app.set({ signedIn: true, clientMode, myClientId: clientMode ? "c1" : null, tab: "workouts", view: { name: "client", id: "c1" } });
  maps.clients.set("c1", { id: "c1", name: "Jane", unit: "lb" });
  for (const t of [W("late", -2), W("now", 0), W("next", 2), ...more]) maps.trainings.set(t.id, t);
  document.activeElement = null; fns.render();
};
const tids = (id) => (byId.get(id).children || []).filter((li) => li && li.dataset && li.dataset.tid).map((li) => li.dataset.tid);
const lists = () => ({ missed: tids("missList"), today: tids("todayList"), next: tids("nextList") });
const ask = () => ({ open: !byId.get("askSheet").hidden, title: byId.get("askTitle").textContent, text: byId.get("askText").textContent, yes: byId.get("askYes").textContent });
const rowOf = (list, tid) => elems(byId.get(list).children || []).find((li) => li.dataset && li.dataset.tid === tid);
const btnOf = (list, tid, more) => { const li = rowOf(list, tid); return li ? elems(li.children).find((c) => (more ? c.className === "miss-more" : c.tagName === "BUTTON" && c.className !== "miss-more")) || null : null; };
const where = () => { const a = document.activeElement; if (!a || a === document.body) return "page"; if (byId.get("askSheet").contains(a)) return "question"; const li = a.closest("li[data-tid]"); return (a.className === "miss-more" ? "more:" : "row:") + (li ? li.dataset.tid : "?"); };
const del = (items) => { const it = items[items.length - 1]; return { label: it.label, danger: !!it.danger, sep: !!it.sep, trash: it.icon === fns.menuIcons().trash }; };
const out = {};

// the coach: every row's menu (touch and hold, right-click) ends in Delete, red after a line; the Missed card's "…" too
seed();
out.coach = { today: fns.rowMenu("now").map((x) => x.label), next: fns.rowMenu("next").map((x) => x.label), missed: fns.missItems("late").map((x) => x.label), item: del(fns.rowMenu("now")), missedItem: del(fns.missItems("late")) };
out.drawn = lists();
// Cancel: nothing goes
{ const p = fns.rowMenu("now").at(-1).onPick(); await advance(50); out.asked = ask(); await advance(400); byId.get("askNo").fire("click"); out.cancelled = { done: await p, kept: maps.trainings.has("now"), ...lists(), sheet: !byId.get("askSheet").hidden, view: app.get().view.name }; }
// Delete: gone for good, saved, its list drawn without it, the page where it was (no step: nothing to go back to)
{ const depth = fns.navState().depth; const p = fns.rowMenu("now").at(-1).onPick(); await advance(400); byId.get("askYes").fire("click"); const done = await p;
  out.deleted = { done, kept: maps.trainings.has("now"), saving: maps.dirty.has("trainings/now"), ...lists(), view: app.get().view.name + "/" + app.get().view.id, depth: fns.navState().depth - depth }; }
// the Missed card's: the same
{ const p = fns.missItems("late").at(-1).onPick(); await advance(400); byId.get("askYes").fire("click"); out.missedDeleted = { done: await p, kept: maps.trainings.has("late"), ...lists() }; }
// a sync took it away while the question was up: Delete does nothing more, and nothing throws
seed();
{ const p = fns.rowMenu("next").at(-1).onPick(); await advance(400); maps.trainings.delete("next"); byId.get("askYes").fire("click"); out.goneMeanwhile = { done: await p, sheet: !byId.get("askSheet").hidden }; }
// still to do, read on the pick and again after the question, as the menu's Skip and Reschedule are (the v298 review): a menu left open
// while a sync brought in the client's finish, or the client's finish or skip coming in while the question is up, deletes nothing
const FIN = "2026-11-14T10:00:00.000Z";
seed();
{ const items = fns.rowMenu("now"); maps.trainings.get("now").completedAt = FIN; const p = items.at(-1).onPick(); await advance(400); const asked = !byId.get("askSheet").hidden;
  if (asked) byId.get("askYes").fire("click");   // (a question it should not have asked, answered, so the probe never waits on it)
  out.staleMenu = { done: await p, asked, kept: maps.trainings.has("now"), saving: maps.dirty.has("trainings/now") }; }
for (const [key, field] of [["finishedMeanwhile", "completedAt"], ["skippedMeanwhile", "skippedAt"]]) {
  seed(); const p = fns.rowMenu("now").at(-1).onPick(); await advance(400); const w = maps.trainings.get("now"); if (w) w[field] = FIN; byId.get("askYes").fire("click");
  out[key] = { done: await p, kept: maps.trainings.has("now"), saving: maps.dirty.has("trainings/now"), sheet: !byId.get("askSheet").hidden };
}
// a keyboard's or VoiceOver's place (the menu's close puts it back on the row's button, or the Missed row's "…"): after Cancel back on its
// row, after Delete on the row now where it was, the "…" of the next missed one, or off the closed question when the list is empty; a
// pointer's (no place on a row) is left alone; a list drawn again while the question was up: the row's new button
const pick = async (list, tid, more, answer, mid, place) => { const b = place ? btnOf(...place) : btnOf(list, tid, more); document.activeElement = b; const p = fns.rowMenu(tid).at(-1).onPick(); await advance(400); const at = where(); if (mid) mid(); byId.get(answer).fire("click"); const done = await p; return { done, asking: at, after: where(), old: !!b && document.activeElement === b }; };
seed(false, [W("now2", 0)]); out.keyCancel = await pick("todayList", "now", false, "askNo");
seed(false, [W("now2", 0)]); out.keyDelete = await pick("todayList", "now", false, "askYes");
seed(); out.keyDeleteLast = await pick("nextList", "next", false, "askYes");
seed(false, [W("now2", 0), W("now3", 0)]); { const order = tids("todayList"); out.keyDeleteMiddle = { order, ...(await pick("todayList", order[1], false, "askYes")) }; }
seed(false, [W("late2", -3)]); { const b = btnOf("missList", "late", true); document.activeElement = b; const p = fns.missItems("late").at(-1).onPick(); await advance(400); byId.get("askYes").fire("click"); out.keyMissed = { done: await p, after: where(), drawn: tids("missList") }; }
seed(false, [W("now2", 0)]); out.keyRedrawn = await pick("todayList", "now", false, "askNo", () => fns.render());
seed(false, [W("now2", 0)]); out.keyRefused = await pick("todayList", "now", false, "askYes", () => { const w = maps.trainings.get("now"); if (w) w.completedAt = FIN; fns.render(); });
seed(false, [W("now2", 0)]); { const p = fns.rowMenu("now").at(-1).onPick(); await advance(400); byId.get("askYes").fire("click"); out.pointer = { done: await p, after: where() }; }
// the second v298 review: the place on another row (a right-click or a hold on this one moves no focus) stays on its own row; a row a sync
// moved to another list while the question was up is found there; the menu's own row (a sync drew the lists anew while the menu was up,
// so the menu could give no row the focus back) is this workout's row; and Up next opened with Show more closes up as a list does
for (const [key, answer] of [["otherCancel", "askNo"], ["otherDelete", "askYes"]]) { seed(false, [W("now2", 0), W("now3", 0)]); out[key] = await pick("todayList", "now", false, answer, null, ["todayList", "now2", false]); }
for (const [key, answer] of [["crossCancel", "askNo"], ["crossDelete", "askYes"]]) { seed(false, [W("now2", 0)]); out[key] = await pick("todayList", "now", false, answer, null, ["missList", "late", true]); }
seed(false, [W("late2", -3)]); out.movedCancel = await pick("missList", "late", true, "askNo", () => { const w = maps.trainings.get("late"); if (w) w.date = fns.today(); fns.render(); }, ["missList", "late", true]);
const inMenu = async (list, tid, answer, mk) => { seed(false, mk); const opt = document.createElement("button"); opt.menuRow = true; fns.render(); document.activeElement = opt; const items = tid === "late" ? fns.missItems(tid) : fns.rowMenu(tid); const p = items.at(-1).onPick(); await advance(400); byId.get(answer).fire("click"); return { done: await p, after: where() }; };
out.menuCancel = await inMenu("todayList", "now", "askNo", [W("now2", 0)]);
out.menuDelete = await inMenu("todayList", "now", "askYes", [W("now2", 0)]);
out.menuMissed = await inMenu("missList", "late", "askYes", [W("late2", -3)]);
seed(false, [5, 6, 7, 8, 9, 10, 11].map((n) => W("n" + n, n)));
{ const before = tids("nextList"), moreLi = elems(byId.get("nextList").children).find((li) => !(li.dataset && li.dataset.tid)), bar = moreLi && elems(moreLi.children)[0], fold = bar && elems(bar.children).find((c) => String(c.className).startsWith("fold"));
  if (fold) fold.fire("click"); const shown = tids("nextList"), last = shown[shown.length - 1];
  out.showMore = { before, shown, last, ...(await pick("nextList", last, false, "askYes")), now: tids("nextList") }; }
// the v298 safety check, in the question every Delete and discard asks (askFirst) and the Skip sheet: a double press on a button answers it,
// and its second press would land on the page behind (a list closed up under it opened the workout that came up), so a person's press
// (a trusted click with a count) eats the next one for 350 ms; a key's click (no count) or a script's arms nothing. And the first button
// takes the keyboard's ring only after a key: after a right-click's or a hold's menu, whose presses are all cancelled, WebKit drew it for
// a finger in a page not yet clicked
const docEvent = (type, extra) => { const ev = { type, target: document.body, clientX: 0, clientY: 0, button: 0, pointerType: "mouse", isPrimary: true, eaten: false, stopped: false, preventDefault() { this.eaten = true; }, stopPropagation() { this.stopped = true; }, stopImmediatePropagation() { this.stopped = true; }, ...extra };
  for (const l of [...(L[type] || [])].filter((x) => x.capture)) { l.fn(ev); if (ev.stopped) break; } return ev; };
const eaten = () => { const ev = docEvent("click", { isTrusted: true, detail: 1 }); return ev.eaten && ev.stopped; };
const answer = async (id, ev) => { seed(); const p = fns.rowMenu("now").at(-1).onPick(); await advance(400); byId.get(id).fire("click", ev); await p; };
await answer("askNo", { isTrusted: true, detail: 1 }); out.eatPress = { at0: eaten(), at200: (await advance(200), eaten()), at400: (await advance(200), eaten()) };
await answer("askYes", { isTrusted: true, detail: 1 }); out.eatDelete = eaten();
await advance(400); await answer("askNo", { isTrusted: true, detail: 0 }); out.eatKey = eaten();
await advance(400); await answer("askNo", { isTrusted: false, detail: 1 }); out.eatScript = eaten();
await advance(400); seed(); fns.rowMenu("now")[1].onPick(); await advance(400); out.skipOpen = !byId.get("skipSheet").hidden; byId.get("skKeep").fire("click", { isTrusted: true, detail: 1 }); out.eatSkipKeep = { closed: byId.get("skipSheet").hidden, eaten: eaten() };
await advance(400); seed(); fns.rowMenu("now")[1].onPick(); await advance(400); byId.get("skGo").fire("click", { isTrusted: true, detail: 1 }); out.eatSkipGo = { skipped: !!(maps.trainings.get("now") || {}).skippedAt, eaten: eaten() };
await advance(400); seed(); fns.rowMenu("now")[1].onPick(); await advance(400); byId.get("skipSheet").fire("click", { isTrusted: true, detail: 1 }); out.eatSkipDim = { closed: byId.get("skipSheet").hidden, eaten: eaten() };
await advance(400); seed(); { const p = fns.rowMenu("now").at(-1).onPick(); await advance(400); byId.get("askSheet").fire("click", { isTrusted: true, detail: 1 }); out.eatAskDim = { done: await p, closed: byId.get("askSheet").hidden, eaten: eaten() }; }
const ringAfter = async (type) => { await advance(400); seed(); docEvent(type, type === "keydown" ? { key: "Tab" } : { pointerType: "touch" }); const p = fns.rowMenu("now").at(-1).onPick(); await advance(400); const o = byId.get("askNo").focusOpts; byId.get("askNo").fire("click"); await p;
  docEvent(type, type === "keydown" ? { key: "Tab" } : { pointerType: "touch" }); fns.rowMenu("now")[1].onPick(); await advance(400); const k = byId.get("skGo").focusOpts; byId.get("skKeep").fire("click", { detail: 0 }); return { cancel: o, skip: k }; };
out.ringKey = await ringAfter("keydown"); out.ringPress = await ringAfter("pointerdown");
// the client's own app: no Delete anywhere
seed(true);
out.client = { today: fns.rowMenu("now").map((x) => x.label), missed: fns.missItems("late").map((x) => x.label) };
await new Promise((r) => setImmediate(r));   // a turn of the event loop: Node reports a promise rejected and unhandled only then (the v298 review: without it this list could never fill)
out.rejected = rejected;
console.log(JSON.stringify(out));
process.exit(0);
