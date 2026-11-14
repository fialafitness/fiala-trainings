// Run by sets-count.test.js in its own process: how many sets a card has, chosen from Apple's pop-up button at the end of the set bar (his pick A,
// 14 Nov, after pictures: "lets build A for the set setting ... only change how I add sets nothing else"). The − / + under the bar are gone; the
// count's list is Calendar's Repeat menu with 1 to 20 sets, twelve in view; fewer sets with something logged on them ask first, naming them all.
// The stand-ins are ramp-probe.mjs's, with each row laid out 42 tall under 12 of padding.
import { byId, el } from "./env.js";
import { today } from "../app/util.js";
let NOW = 10000, SEQ = 0; const Q = [];
globalThis.setTimeout = (fn, ms) => { const id = ++SEQ; Q.push({ id, at: NOW + Math.max(0, ms || 0), fn }); return id; };
globalThis.clearTimeout = (id) => { const i = Q.findIndex((q) => q.id === id); if (i >= 0) Q.splice(i, 1); };
try { performance.now = () => NOW; } catch (_) { Object.defineProperty(globalThis, "performance", { value: { now: () => NOW }, configurable: true }); }
{ const t0 = Date.now() - NOW; Date.now = () => t0 + NOW; }
const flush = async () => { for (let i = 0; i < 30; i++) await Promise.resolve(); };
async function advance(ms) { const end = NOW + ms; for (;;) { Q.sort((a, b) => a.at - b.at || a.id - b.id); const q = Q[0]; if (!q || q.at > end) break; Q.shift(); NOW = Math.max(NOW, q.at); q.fn(); await flush(); } NOW = end; await flush(); }
const L = {};                                                              // the document's listeners, with their phase
document.addEventListener = (t, fn, o) => { (L[t] ||= []).push({ fn, capture: o === true || !!(o && o.capture) }); };
document.removeEventListener = (t, fn) => { const a = L[t] || []; const i = a.findIndex((x) => x.fn === fn); if (i >= 0) a.splice(i, 1); };
const WIN = {}, capOf = (o) => o === true || !!(o && o.capture);   // the window's listeners with their phase: a page takes one off only for the same phase
globalThis.addEventListener = (t, fn, o) => { (WIN[t] ||= []).push({ fn, capture: capOf(o) }); }; globalThis.removeEventListener = (t, fn, o) => { const a = WIN[t] || []; const i = a.findIndex((x) => x.fn === fn && x.capture === capOf(o)); if (i >= 0) a.splice(i, 1); };
const rejected = []; process.on("unhandledRejection", (e) => { rejected.push(String((e && e.message) || e)); });   // a pick that throws after its question
const VV = { height: 874, offsetTop: 0, H: {} }; VV.addEventListener = (t, fn) => { (VV.H[t] ||= []).push(fn); }; VV.removeEventListener = (t, fn) => { const a = VV.H[t] || []; const i = a.indexOf(fn); if (i >= 0) a.splice(i, 1); };
globalThis.visualViewport = VV; globalThis.innerHeight = 874; globalThis.innerWidth = 402; document.documentElement.clientWidth = 402;
globalThis.getComputedStyle = (n) => { const c = (n && n.cs) || {}; return { getPropertyValue: () => "", display: c.display || "block", paddingLeft: c.paddingLeft || "0px", paddingTop: c.paddingTop || "0px", paddingBottom: c.paddingBottom || "0px", color: "" }; };
if (typeof globalThis.CSS === "undefined") globalThis.CSS = { escape: (v) => String(v) };
// ---------- the stand-in elements: children with their parent, listeners, attributes, focus, the markup's parts looked up by selector ----------
const made = [], MK = new WeakSet();                                     // (the walks up stop at the stand-ins: any other look-up answers a new element, without end)
const classesOf = (n) => new Set([...String(n.className || "").split(/\s+/).filter(Boolean), ...(n.classes || [])]);
const matches = (n, sel) => {                                              // ".a.b", "tag", "tag.a", and ":not([hidden])" after either
  if (!n || typeof n !== "object") return false;
  let s = String(sel).trim(); if (/:not\(\[hidden\]\)$/.test(s)) { if (n.hidden) return false; s = s.replace(/:not\(\[hidden\]\)$/, ""); }
  const m = /^([a-z]*)((?:\.[\w-]+)*)$/i.exec(s); if (!m || (!m[1] && !m[2])) return false;
  if (m[1] && String(n.tagName || "").toLowerCase() !== m[1].toLowerCase()) return false;
  const have = classesOf(n); return m[2].split(".").filter(Boolean).every((c) => have.has(c));
};
const anyOf = (n, sel) => String(sel).split(",").some((s) => matches(n, s));
const kidsOf = (n) => [...(n.children || []), ...Object.values((n && n.qs) || {})].filter((c, i, a) => a.indexOf(c) === i);
const find = (root, sel) => { for (const c of kidsOf(root)) { if (anyOf(c, sel)) return c; const d = c && typeof c === "object" ? find(c, sel) : null; if (d) return d; } return null; };
const findAll = (root, sel, out = []) => { for (const c of kidsOf(root)) { if (anyOf(c, sel)) out.push(c); if (c && typeof c === "object") findAll(c, sel, out); } return out; };
const PART_TAG = (sel) => (/(^|\s)\.(name|label|reps|rest|tempo|w|rp|vid-url|note-field)$/.test(sel) ? "input" : /(btn|-pop|addname|vid-edit|vid-save|vid-remove|vid-cancel|fold-btn)$/.test(sel) ? "button" : "div");
function mk(tag) {
  const e = el(tag);
  e.nodes = []; e.parent = null; e.H = {}; e.attrs = {}; e.qs = {}; e.html = ""; e.removed = false; e.inert = false; e.cs = null; e.rect = null; e.chips = null;   // (env.js answers any unset name with a stub)
  const isText = (c) => !!c && typeof c === "object" && c.nodeType === 3;   // a page keeps written text as a node among the children, in order: what comes before or after the words can be told
  Object.defineProperty(e, "children", { get: () => e.nodes.filter((c) => !isText(c)), set: (v) => { e.nodes = [...v]; }, configurable: true });   // the elements alone, as a page's children are
  Object.defineProperty(e, "lastElementChild", { get: () => { const k = e.children; return k[k.length - 1] || null; }, configurable: true });
  Object.defineProperty(e, "textContent", { get: () => e.nodes.map((c) => (c && typeof c === "object" ? String(c.textContent || "") : "")).join(""), set: (v) => { for (const c of e.nodes) if (c && typeof c === "object") c.parent = null; e.nodes = v === "" || v == null ? [] : [{ nodeType: 3, textContent: String(v), parent: e }]; }, configurable: true });
  const cl = { add: (...c) => { const k = classesOf(e); for (const x of c) k.add(x); e.className = [...k].join(" "); e.classes = new Set(); }, remove: (...c) => { const k = classesOf(e); for (const x of c) k.delete(x); e.className = [...k].join(" "); e.classes = new Set(); },
    toggle: (c, f) => { const on = f === undefined ? !classesOf(e).has(c) : !!f; (on ? cl.add : cl.remove)(c); return on; }, contains: (c) => classesOf(e).has(c) }; e.classList = cl;   // one list of classes, as a page has (its className and its classList the same)
  const st = {}; st.setProperty = (k, v) => { st[k] = v; }; st.removeProperty = (k) => { delete st[k]; }; st.getPropertyValue = (k) => st[k] || ""; e.style = st;
  const adopt = (c) => { if (c && typeof c === "object") { if (c.parent && c.parent !== e) c.parent.nodes = c.parent.nodes.filter((x) => x !== c); c.parent = e; } return c; };
  e.replaceChildren = (...k) => { for (const c of e.nodes) if (c && typeof c === "object") c.parent = null; e.nodes = []; for (const c of k) { adopt(c); e.nodes.push(c); } };
  e.appendChild = (c) => { if (c && c.parent === e) e.nodes = e.nodes.filter((x) => x !== c); adopt(c); e.nodes.push(c); return c; };
  e.append = (...k) => { for (const c of k) e.appendChild(c); };
  e.prepend = (...k) => { for (const c of [...k].reverse()) { if (c && c.parent === e) e.nodes = e.nodes.filter((x) => x !== c); adopt(c); e.nodes.unshift(c); } };
  e.after = (...k) => { const p = e.parent; if (!p) return; let i = p.nodes.indexOf(e); for (const c of k) { if (c && typeof c === "object") { if (c.parent) c.parent.nodes = c.parent.nodes.filter((x) => x !== c); c.parent = p; } i = p.nodes.indexOf(e) + (k.indexOf(c)) + 1; p.nodes.splice(i, 0, c); } };
  e.remove = () => { e.removed = true; if (e.parent) { e.parent.nodes = e.parent.nodes.filter((x) => x !== e); e.parent = null; } };
  e.contains = (x) => { for (let n = x; n && MK.has(n); n = n.parent) if (n === e) return true; return false; };
  e.setAttribute = (k, v) => { e.attrs[k] = String(v); }; e.getAttribute = (k) => (k in e.attrs ? e.attrs[k] : null); e.removeAttribute = (k) => { delete e.attrs[k]; }; e.hasAttribute = (k) => k in e.attrs;
  e.addEventListener = (t, fn) => { (e.H[t] ||= []).push(fn); }; e.removeEventListener = (t, fn) => { const a = e.H[t] || []; const i = a.indexOf(fn); if (i >= 0) a.splice(i, 1); };
  e.focus = (o) => { document.activeElement = e; e.focusedWith = o || null; }; e.blur = () => { if (document.activeElement === e) document.activeElement = document.body; };
  e.insertAdjacentHTML = (pos, h) => { e.html = /^(afterbegin|beforebegin)$/.test(pos) ? h + e.html : e.html + h; const m = /^<(\w+)[^>]*\bclass="([^"]+)"/.exec(h); if (m) { const c = mk(m[1]); c.className = m[2]; if (/^(afterbegin)$/.test(pos)) e.prepend(c); else e.appendChild(c); } };   // the icon it holds, as an element of its own
  e.closest = (sel) => { if (sel === ".chip") { const c = mk("div"); c.innerHTML = "chip"; return c; } for (let n = e; n && MK.has(n); n = n.parent) if (anyOf(n, sel)) return n; return null; };
  e.querySelector = (sel) => {                                             // the markup the app wrote into it: each part by its selector, the same part each time
    const f = find(e, sel); if (f) return f; if (!e.innerHTML) return null;
    const nh = /:not\(\[hidden\]\)$/.test(sel), base = sel.replace(/:not\(\[hidden\]\)$/, "");
    let p = e.qs[base]; if (!p) { p = mk(PART_TAG(base)); p.className = base.split(/\s+/).pop().split(".").filter(Boolean).join(" "); p.parent = e; e.nodes.push(p); e.qs[base] = p; }   // (a part is one of its children, so what goes after it lands beside it)
    return nh && p.hidden ? null : p;
  };
  e.querySelectorAll = (sel) => { if (sel === ".specs .chip") { e.chips = e.chips || [0, 1].map(() => { const c = mk("div"); c.className = "chip"; c.innerHTML = "chip"; c.parent = e; e.nodes.push(c); return c; }); return e.chips; } return findAll(e, sel); };   // (the chips the row asked for, kept: its reps chip is looked at again)
  e.getBoundingClientRect = () => e.rect || { top: 0, bottom: 0, left: 0, right: 0, width: 0, height: 0 };
  Object.defineProperty(e, "offsetTop", { get: () => (e.parent ? 12 + e.parent.children.indexOf(e) * 42 : 0), configurable: true }); e.offsetHeight = 42; e.scrollTop = 0;   // a menu's rows laid out as Apple's: 42 a row under 12 of padding
  MK.add(e); made.push(e); return e;
}
document.createElement = mk;
const fire = (e, type, extra = {}) => {                                     // capture on the document, then the target and up through its parents, then the document's own
  const ev = { type, target: e, detail: 1, clientX: 0, clientY: 0, button: 0, isPrimary: true, ...extra, stopped: false, defaultPrevented: false, stopPropagation() { this.stopped = true; }, preventDefault() { this.defaultPrevented = true; }, composedPath() { const path = []; for (let n = e; n && MK.has(n); n = n.parent) path.push(n); return path; } };
  for (const l of [...(L[type] || [])].filter((x) => x.capture)) l.fn(ev);
  for (let n = e; n && MK.has(n) && !ev.stopped; n = n.parent) { ev.currentTarget = n; for (const fn of [...((n.H || {})[type] || [])]) fn(ev); }
  if (!ev.stopped) for (const l of [...(L[type] || [])].filter((x) => !x.capture)) l.fn(ev);
  return ev;
};
const QSA = []; { const was = document.querySelectorAll; document.querySelectorAll = (sel) => { QSA.push(sel); return was ? was.call(document, sel) : []; }; }
const recorder = (id, extra = {}) => { const e = mk("div"); e.id = id; Object.assign(e, extra); byId.set(id, e); return e; };
for (const id of ["whenPop", "ctxDim", "altTitle", "altLead", "altDone", "status", "dpTitle"]) recorder(id);
const whenBg = recorder("whenBg", { hidden: true }), rowsEl = recorder("rows");
const altSheet = recorder("altSheet", { hidden: true }), altBox = recorder("altBox"), altRows = recorder("altRows");
altSheet.appendChild(altBox); altBox.appendChild(byId.get("altTitle")); altBox.appendChild(byId.get("altLead")); altBox.appendChild(altRows); altBox.appendChild(byId.get("altDone"));
altSheet.firstElementChild = altBox;
whenBg.appendChild(byId.get("whenPop"));
rowsEl.querySelector = (sel) => { const m = /^\.row\[data-id="(.+)"\]$/.exec(sel); if (m) return made.filter((x) => x.className === "row" && x.dataset && x.dataset.id === m[1]).pop() || null; return find(rowsEl, sel); };
const main = recorder("mainEl"), header = recorder("headerEl");
document.body.children = [main, header, whenBg, altSheet];

document.contains = (x) => !!x && MK.has(x) && !x.removed;   // (the count the list hangs from is on the page: focus comes back to it)
const askSheet = recorder("askSheet", { hidden: true }), askBox = recorder("askBox");   // the question sheet, as the markup holds it
for (const id of ["askTitle", "askText", "askYes", "askNo", "askInput"]) recorder(id);
askSheet.appendChild(askBox); askBox.append(byId.get("askTitle"), byId.get("askText"), byId.get("askInput"), byId.get("askYes"), byId.get("askNo")); askSheet.firstElementChild = askBox;
document.body.children = [main, header, whenBg, altSheet, askSheet];
const app = (await import("../app/main.js")).internals();
const { fns, maps } = app;

const TPL = "00000000-0000-4000-8000-0000000000f1", pop = byId.get("whenPop"), yes = byId.get("askYes"), no = byId.get("askNo");
const popH = () => Math.min(classesOf(pop).has("long") ? 528 : Infinity, parseFloat(pop.style.maxHeight) || Infinity, 24 + 42 * pop.children.filter((c) => classesOf(c).has("wopt")).length);   // as a page lays the bubble out: its rows, the long list's 528, a cap written on it
Object.defineProperty(pop, "offsetHeight", { get: popH, configurable: true }); Object.defineProperty(pop, "clientHeight", { get: popH, configurable: true });
let popTop = 0; Object.defineProperty(pop, "scrollTop", { get: () => popTop, set: (v) => { if (!whenBg.hidden) popTop = v; }, configurable: true });   // a hidden bubble does not scroll
const R = (id, label, name, extra = {}) => ({ id, label, name, sets: 5, reps: "12, 10, 8, 8, 6", rest: "10 sec", tempo: "", weights: [], repsDone: [], setsDone: 0, done: false, note: "", alts: [], ...extra });
function seed({ client = false, preview = false, a = {}, b = {}, view = "t1", extra = [] } = {}) {
  fire(document.body, "keydown", { key: "Escape" });   // what an earlier scene left open closes, with all it listened for
  app.reset(); fns.setPreview(false); made.length = 0; rowsEl.replaceChildren();
  app.set({ signedIn: true, clientMode: client, myClientId: client ? "c1" : null, tab: "workouts", templateDraft: null });
  maps.clients.set("c1", { id: "c1", name: "Jane", unit: "lb" });
  maps.trainings.set("t1", { id: "t1", clientId: "c1", title: "Chest + back", date: today(), createdAt: "2026-11-01T10:00:00.000Z", completedAt: null, skippedAt: null,
    rows: [R("a", "1a", "Decline bench press", a), R("b", "1b", "Wide-grip pull-up", { reps: "6-8", rest: "90 sec", ...b }), ...extra] });
  maps.trainings.set("t2", { id: "t2", clientId: TPL, title: "Upper A", createdAt: "2026-11-01T10:00:00.000Z", completedAt: null, skippedAt: null, rows: [R("a", "1a", "Military press"), R("b", "1b", "Row")] });
  pop.replaceChildren(); fns.setPreview(preview); app.set({ view: { name: "training", id: view }, renderedTraining: null }); fns.render();
  pop.offsetWidth = 243; pop.style.maxHeight = ""; whenBg.hidden = true; popTop = 0; askSheet.hidden = true;
  globalThis.innerHeight = 874; VV.height = 874; maps.dirty.clear(); document.activeElement = null;
  for (const n of [main, header, whenBg, altSheet]) n.inert = false;
}
const blockOf = (key) => made.filter((x) => classesOf(x).has("block") && x.parent === rowsEl && x.dataset && x.dataset.key === key).pop() || null;
const bar = (key) => (key ? findAll(blockOf(key), ".tracker")[0] || null : made.filter((x) => classesOf(x).has("tracker")).pop() || null);   // a card's by its key, or the last drawn
const countBtn = (key) => { const t = bar(key); return t ? findAll(t, ".tr-count")[0] || null : null; };
const setsNow = (tid = "t1") => maps.trainings.get(tid).rows.filter((r) => r.id !== "c").map((r) => r.sets);   // the first card's
const allSets = () => maps.trainings.get("t1").rows.map((r) => r.id + ":" + r.sets);
const rowsOf = () => pop.children.filter((c) => classesOf(c).has("wopt"));
const menu = () => ({ open: !whenBg.hidden, classes: ["menu", "checks", "long", "hung"].filter((c) => classesOf(pop).has(c)), rows: rowsOf().map((b) => b.textContent), ticked: rowsOf().filter((b) => b.attrs["aria-current"] === "true").map((b) => b.textContent) });
const open = (ev = {}, key) => { const c = countBtn(key); c.rect = { top: 330, bottom: 378, left: 342, right: 368, width: 26, height: 48 }; return fire(c, "click", { detail: 1, isTrusted: false, ...ev }); };
const pick = (label) => { const r = rowsOf().find((b) => b.textContent === label); if (!r) return "no row " + label; NOW += 400; fire(r, "click"); return label; };   // a tap well after the one that opened it
const asked = () => ({ open: !askSheet.hidden, title: byId.get("askTitle").textContent, text: byId.get("askText").textContent, yes: yes.textContent });
const out = {};
{ seed();   // the coach's card: the set bar as it was, its count at the end, and no − / +
  const t = bar(), c = countBtn();
  out.closed = { sets: findAll(t, ".tr-chips")[0].children.length, cur: (findAll(t, ".cur")[0] || {}).textContent, text: c && c.textContent, label: c && c.attrs["aria-label"], popup: c && c.attrs["aria-haspopup"], chevrons: c ? findAll(c, ".pop-chev").length : null, last: t.children[t.children.length - 1] === c, steps: findAll(t, ".step").length + findAll(t, ".tr-steps").length, pos: findAll(t, ".tr-pos").length };
  const ev = open(); out.opened = { ...menu(), stopped: ev.stopped, top: pop.style.top, left: pop.style.left, cap: pop.style.maxHeight, scrolled: pop.scrollTop, focus: document.activeElement === null };
  out.picked7 = pick("7 sets"); await flush();
  out.seven = { open: !whenBg.hidden, sets: setsNow(), saved: maps.dirty.has("trainings/t1"), asked: !askSheet.hidden, text: countBtn().textContent, label: countBtn().attrs["aria-label"], chips: findAll(bar(), ".tr-chips")[0].children.length };
  maps.dirty.clear(); open(); out.ticked7 = menu().ticked; pick("4 sets"); await flush(); out.four = { sets: setsNow(), saved: maps.dirty.has("trainings/t1"), asked: !askSheet.hidden };
  maps.dirty.clear(); open(); pick("4 sets"); await flush(); out.same = { open: !whenBg.hidden, sets: setsNow(), saved: maps.dirty.has("trainings/t1") };   // the ticked row: nothing changes, nothing is saved
}
{ seed({ b: { sets: 7, weights: ["", "", "", "", "", "100", ""] }, a: { sets: 7 } });   // a weight on set 6 of seven: going to three asks, naming every set that goes (the old check looked at the first set going only)
  open(); pick("3 sets"); await flush(); out.askMany = asked();
  fire(no, "click"); await flush(); out.cancelled = { open: !askSheet.hidden, sets: setsNow(), saved: maps.dirty.has("trainings/t1") };
  open(); pick("3 sets"); await flush(); await advance(400); fire(yes, "click"); await flush();
  out.dropped = { open: !askSheet.hidden, sets: setsNow(), saved: maps.dirty.has("trainings/t1"), text: countBtn().textContent };
}
{ seed({ a: { repsDone: ["", "", "", "", "8"] } });   // reps on set 5: going to three names two sets
  open(); pick("3 sets"); await flush(); out.askTwo = asked(); fire(no, "click"); await flush();
  maps.trainings.get("t1").rows[0].repsDone = []; maps.trainings.get("t1").rows[1].setsDone = 5; app.set({ renderedTraining: null }); fns.render();   // all five done on the second: going to four names the one
  open(); pick("4 sets"); await flush(); out.askOne = asked(); await advance(400); fire(yes, "click"); await flush();
  const r = maps.trainings.get("t1").rows[1]; out.oneDropped = { sets: setsNow(), setsDone: r.setsDone, done: r.done };
}
{ seed({ a: { setsDone: 5, done: true }, b: { setsDone: 5, done: true } });   // a set added to finished exercises opens them again
  open(); pick("6 sets"); await flush(); out.reopened = { sets: setsNow(), done: maps.trainings.get("t1").rows.map((r) => r.done), asked: !askSheet.hidden };
}
{ seed({ a: { sets: 18 }, b: { sets: 18 } });   // the list opens with the ticked row in view, in the middle where it can
  open(); out.at18 = { ticked: menu().ticked, scrolled: pop.scrollTop };
  pop.scrollTop = 0; fns.render(); open(); pick("2 sets"); await flush(); out.nothingLogged18 = { sets: setsNow(), asked: !askSheet.hidden };
}
{ seed();   // from the keyboard (VoiceOver too): into the list on the ticked row, ↑ ↓ from row to row, Escape back on the count
  open({ detail: 0, isTrusted: true }); const at = () => (rowsOf().includes(document.activeElement) ? document.activeElement.textContent : document.activeElement === countBtn() ? "count" : null);
  out.keys = [at()];
  for (const k of ["ArrowDown", "ArrowUp", "ArrowUp"]) { const ev = fire(document.body, "keydown", { key: k }); out.keys.push(at() + (ev.defaultPrevented ? "" : " (not held)")); }
  for (let i = 0; i < 5; i++) fire(document.body, "keydown", { key: "ArrowUp" }); out.keys.push(at());
  fire(document.body, "keydown", { key: "Escape" }); out.keys.push(at()); out.keysClosed = whenBg.hidden;
  open(); out.tapFocus = document.activeElement === null || !rowsOf().includes(document.activeElement);
}
{ seed();   // a pick from the keyboard: the count, drawn anew, has the focus; Cancel on the question gives it back as well
  open({ detail: 0, isTrusted: true }); fire(rowsOf().find((b) => b.textContent === "6 sets"), "click", { detail: 0, isTrusted: true }); await flush();
  out.keyPick = { sets: setsNow(), focus: document.activeElement === countBtn(), text: countBtn().textContent };
  maps.trainings.get("t1").rows[0].weights = ["", "", "", "", "", "70"]; app.set({ renderedTraining: null }); fns.render();
  open({ detail: 0, isTrusted: true }); fire(rowsOf().find((b) => b.textContent === "2 sets"), "click", { detail: 0, isTrusted: true }); await flush();
  const askedNow = !askSheet.hidden; fire(no, "click"); await flush();
  out.keyCancel = { asked: askedNow, sets: setsNow(), focus: document.activeElement === countBtn() };
  open(); pick("3 sets"); await flush(); await advance(400); fire(yes, "click"); await flush();
  out.tapPick = { sets: setsNow(), focus: document.activeElement === countBtn() };   // a tap's pick leaves focus alone
}
{ seed();   // a long list scrolls inside itself and stays; the page scrolling closes it
  const before = (WIN.scroll || []).length; open(); const added = (WIN.scroll || []).length - before, capture = (WIN.scroll || []).slice(before).map((x) => x.capture);
  for (const x of [...(WIN.scroll || [])]) x.fn({ type: "scroll", target: pop }); out.ownScroll = !whenBg.hidden;
  for (const x of [...(WIN.scroll || [])]) x.fn({ type: "scroll", target: document }); out.pageScroll = !whenBg.hidden; out.scrollListeners = { added, capture, left: (WIN.scroll || []).length - before };
}
{ seed();   // a phone turned sideways: the list as tall as what shows, scrolling inside it; upright again, as tall as Apple's
  globalThis.innerHeight = 402; VV.height = 402; open(); out.sideways = { cap: pop.style.maxHeight, top: pop.style.top }; whenBg.hidden = true;
  globalThis.innerHeight = 874; VV.height = 874; open(); out.upright = { cap: pop.style.maxHeight };
}
{ seed({ b: { weights: ["", "", "", "", "90"] } });   // a sync replaced the record while the question was up: Drop goes into the record there now
  open(); pick("4 sets"); await flush(); const old = maps.trainings.get("t1"), fresh = JSON.parse(JSON.stringify(old)); fresh.title = "Synced"; maps.trainings.set("t1", fresh);
  await advance(400); fire(yes, "click"); await flush();
  out.synced = { now: setsNow(), title: maps.trainings.get("t1").title, oldKept: old.rows.map((r) => r.sets) };
  maps.trainings.get("t1").rows[1].weights = ["", "", "", "80"]; app.set({ renderedTraining: null }); fns.render();   // something on set 4 of four, so going to two asks
  open(); pick("2 sets"); await flush(); const askedNow = !askSheet.hidden; maps.trainings.delete("t1"); await advance(400); let threw = null; try { fire(yes, "click"); await flush(); } catch (e) { threw = String(e); }
  out.gone = { asked: askedNow, threw, back: maps.trainings.has("t1") };
}
{ seed();   // a double tap: the list opens over the count, the second tap lands on its first row and picks nothing; a tap after picks; a keyboard's pick is never held
  open(); fire(rowsOf()[0], "click"); await flush(); out.doubleTap = { open: !whenBg.hidden, sets: setsNow(), saved: maps.dirty.has("trainings/t1") };
  NOW += 400; fire(rowsOf()[0], "click"); await flush(); out.afterWait = { open: !whenBg.hidden, sets: setsNow() };
  open({ detail: 0, isTrusted: true }); fire(rowsOf().find((b) => b.textContent === "3 sets"), "click", { detail: 0, isTrusted: true }); await flush(); out.keyAtOnce = { sets: setsNow() };
}
{ seed({ a: { weights: ["50", "50", "50"], repsDone: ["8", "8", "8"], setsDone: 3 } });   // logged on sets 1 to 3 only: going to three loses nothing and asks nothing
  open(); pick("3 sets"); await flush(); out.keepsLogged = { asked: !askSheet.hidden, sets: setsNow(), weights: maps.trainings.get("t1").rows[0].weights.slice(0, 3) };
}
{ const done3 = { weights: ["50", "50", "50"], repsDone: ["8", "8", "8"], setsDone: 3 }; seed({ a: done3, b: done3 });   // from the keyboard, a pick that finishes the card: it folds, and the place goes to its chevron
  open({ detail: 0, isTrusted: true }); fire(rowsOf().find((b) => b.textContent === "3 sets"), "click", { detail: 0, isTrusted: true }); await flush();
  const blk = blockOf("1"), el = document.activeElement;
  out.keyFinish = { asked: !askSheet.hidden, sets: setsNow(), done: maps.trainings.get("t1").rows.map((r) => r.done), folded: !!blk && classesOf(blk).has("done") && !classesOf(blk).has("open"), focus: !!el && classesOf(el).has("card-chev") && !!blk && blk.contains(el) };
}
{ seed({ extra: [R("c", "2", "Back squat", { weights: ["", "", "", "100", "100"] })] });   // a second card: a pick changes its own card only, and asks only about its own sets
  out.cards = [blockOf("1") ? "1" : null, blockOf("2") ? "2" : null];
  open({}, "1"); pick("3 sets"); await flush(); out.ownCard = { asked: !askSheet.hidden, sets: allSets() };
}
{ seed({ extra: [R("c", "2", "Back squat")], b: { weights: ["", "", "", "", "90"] } });   // a sync took an exercise off the card while the question was up: the others go, it is not brought back
  open({}, "1"); pick("4 sets"); await flush(); const fresh = JSON.parse(JSON.stringify(maps.trainings.get("t1"))); fresh.rows = fresh.rows.filter((r) => r.id !== "b"); maps.trainings.set("t1", fresh);
  await advance(400); fire(yes, "click"); await flush(); out.syncedOff = { sets: allSets() };
}
{ seed();   // after the sets' list, another menu is as it always was: no cap, not long
  open(); fire(document.body, "keydown", { key: "Escape" });
  const more = made.filter((x) => classesOf(x).has("more-btn")).pop(); more.rect = { top: 400, bottom: 436, left: 330, right: 366, width: 36, height: 36 }; fire(more, "click"); await flush();
  out.nextMenu = { open: !whenBg.hidden, long: classesOf(pop).has("long"), cap: pop.style.maxHeight, first: (rowsOf()[0] || {}).textContent };
}
{ seed({ a: { sets: 18 }, b: { sets: 18 } });   // sideways with eighteen: the list as tall as what shows, eighteen in its middle
  globalThis.innerHeight = 402; VV.height = 402; open(); out.sideways18 = { cap: pop.style.maxHeight, scrolled: pop.scrollTop };
}
{ seed({ view: "t2" }); app.set({ templateDraft: { id: "t2", snapshot: "{}", dirty: false, saving: false } });   // a template: its words have room, the change waits in its draft
  const c = countBtn(); out.template = { text: c && c.textContent, label: c && c.attrs["aria-label"], pos: findAll(bar(), ".tr-pos").length };
  maps.dirty.clear(); open(); pick("3 sets"); await flush(); out.templatePicked = { sets: setsNow("t2"), draft: !!(app.get().templateDraft && app.get().templateDraft.dirty), saved: maps.dirty.has("trainings/t2") };
}
{ seed({ client: true }); out.client = { count: !!countBtn(), cur: (findAll(bar(), ".cur")[0] || {}).textContent }; }
{ seed({ preview: true }); out.preview = { count: !!countBtn(), cur: (findAll(bar(), ".cur")[0] || {}).textContent }; }   // the coach's Client view: the client's look
await new Promise((r) => setImmediate(r));   // a turn of the event loop: Node reports a promise rejected and unhandled only then
out.rejected = rejected;
console.log(JSON.stringify(out));
