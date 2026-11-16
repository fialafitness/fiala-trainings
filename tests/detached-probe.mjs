// The audit of 15 Nov 2026, #3 and #11 (tests/detached.test.js): a sync that replaces the open workout must never leave its cards writing into
// the old copy (an Undo, a rename), nor rebuild them under a typing finger because another workout of the client changed. Started from the
// review's own probe: the real main.js with ramp-probe's stand-ins, the clock its own.
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
const WIN = {}; globalThis.addEventListener = (t, fn) => { (WIN[t] ||= []).push(fn); }; globalThis.removeEventListener = (t, fn) => { const a = WIN[t] || []; const i = a.indexOf(fn); if (i >= 0) a.splice(i, 1); };
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
  e.nodes = []; e.parent = null; e.H = {}; e.attrs = {}; e.qs = {}; e.html = ""; e.removed = false; e.inert = false; e.cs = null; e.rect = null; e.chips = null; e.chipEl = null;   // (env.js answers any unset name with a stub)
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
  e.closest = (sel) => { if (sel === ".chip") { if (!e.chipEl) { e.chipEl = mk("div"); e.chipEl.innerHTML = "chip"; } return e.chipEl; }   // one chip per box (here: its words and unit can be read)
   for (let n = e; n && MK.has(n); n = n.parent) if (anyOf(n, sel)) return n; return null; };
  e.querySelector = (sel) => {                                             // the markup the app wrote into it: each part by its selector, the same part each time
    const f = find(e, sel); if (f) return f; if (!e.innerHTML) return null;
    const nh = /:not\(\[hidden\]\)$/.test(sel), base = sel.replace(/:not\(\[hidden\]\)$/, "");
    let p = e.qs[base]; if (!p) { p = mk(PART_TAG(base)); p.className = base.split(/\s+/).pop().split(".").filter(Boolean).join(" "); p.parent = e; e.nodes.push(p); e.qs[base] = p; }   // (a part is one of its children, so what goes after it lands beside it)
    return nh && p.hidden ? null : p;
  };
  e.querySelectorAll = (sel) => { if (sel === ".specs .chip") { e.chips = e.chips || [0, 1].map((k) => { const c = mk("div"); c.className = "chip"; c.innerHTML = "chip"; c.parent = e; e.nodes.push(c); const none = !k && repsOf(e) === ""; c.querySelector(".val").textContent = k ? "60 sec" : none ? "10" : "4-6"; const x = c.querySelector(".suffix"); x.textContent = k ? "rest" : "reps"; x.hidden = false; return c; }); return e.chips; } return findAll(e, sel); };   // (the chips the row asked for, kept: its reps chip is looked at again)
  e.getBoundingClientRect = () => e.rect || { top: 0, bottom: 0, left: 0, right: 0, width: 0, height: 0 };
  MK.add(e); made.push(e); return e;
}
document.createElement = mk;
const repsOf = (e) => { try { const t = maps.trainings.get("t1"), row = t && (t.rows || []).find((x) => x.id === (e.dataset || {}).id); return row ? String(row.reps || "") : null; } catch (_) { return null; } };   // a row's reps box: its words, or the box's own grey 10 when the coach left it empty (wireChip writes the placeholder, REPS_DEFAULT)
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
globalThis.fetch = () => Promise.reject(new Error("probe: no network"));
const app = (await import("../app/main.js")).internals();
const { fns, maps } = app;
const askSheet = recorder("askSheet", { hidden: true });
const R = (id, label, name, extra = {}) => ({ id, label, name, sets: 3, reps: "5", rest: "60 sec", tempo: "", weights: [], repsDone: [], setsDone: 0, done: false, note: "", alts: [], ...extra });
const day = (n) => { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + n); return fns.localIso(d); };
function seed({ client = true, unit = "lb", now = [R("a", "1", "Barbell bench press")], extraT = {}, others = [] } = {}) {
  app.reset(); fns.setPreview(false); made.length = 0; rowsEl.replaceChildren(); document.activeElement = document.body; askSheet.hidden = true;
  app.set({ signedIn: true, clientMode: client, myClientId: client ? "c1" : null, tab: "workouts", syncedOnce: true, syncedOn: today() });
  maps.clients.set("c1", { id: "c1", name: "Jane", unit });
  for (const o of others) maps.trainings.set(o.id, o);
  maps.trainings.set("t1", { id: "t1", clientId: "c1", title: "Upper body", date: day(0), createdAt: "2026-11-02T10:00:00.000Z", completedAt: null, skippedAt: null, rows: now, ...extraT });
  app.set({ view: { name: "training", id: "t1" }, renderedTraining: null }); fns.render();
}
const rowOf = (id) => made.filter((x) => x.className === "row" && x.dataset && x.dataset.id === id).pop() || null;
const box = (id) => rowOf(id).qs[".setlog .w"];
const type = (inp, v) => { inp.focus(); fire(inp, "focus"); inp.value = v; fire(inp, "input"); };
const completeBtn = () => made.filter((x) => classesOf(x).has("complete")).pop();
const out = {};
process.on("unhandledRejection", (e) => { (out.unhandled ||= []).push(String(e && e.message || e)); });
// A: the render pads r.weights; the server's copy (weights []) differs, so each sync replaces the record and rebuilds the cards
{ seed(); const live = maps.trainings.get("t1"), el0 = rowOf("a");
  out.A_paddedLocally = JSON.stringify(live.rows[0].weights);
  const server = () => ({ id: "t1", clientId: "c1", title: "Upper body", date: day(0), createdAt: "2026-11-02T10:00:00.000Z", completedAt: null, skippedAt: null, rows: [R("a", "1", "Barbell bench press")] });
  fns.mergeDown(maps.trainings, "trainings", [{ id: "t1", data: server() }], false, Date.now());
  out.A_replaced = maps.trainings.get("t1") !== live; fns.render(); out.A_rebuilt = rowOf("a") !== el0;
  const el1 = rowOf("a"), live2 = maps.trainings.get("t1");
  fns.mergeDown(maps.trainings, "trainings", [{ id: "t1", data: server() }], false, Date.now());
  out.A_secondSync = { replaced: maps.trainings.get("t1") !== live2, rebuilt: (fns.render(), rowOf("a") !== el1) };
}
// B: a sync that changes only what the cards do not draw (the title; or completedAt null vs missing after Undo): the record is replaced, the cards are not rebuilt
for (const variant of ["title", "undo"]) {
  seed({ now: [R("a", "1", "Barbell bench press", { weights: ["135", "", ""], repsDone: ["5", "", ""], setsDone: 1, unit: "lb" })] });
  const live = maps.trainings.get("t1"), el0 = rowOf("a");
  const server = JSON.parse(JSON.stringify(live)); if (variant === "title") server.title = "Upper body A"; else delete server.completedAt;
  fns.mergeDown(maps.trainings, "trainings", [{ id: "t1", data: server }], false, Date.now());
  const replaced = maps.trainings.get("t1") !== live; fns.render(); const rebuilt = rowOf("a") !== el0;
  const w = box("a"); type(w, "140"); w.blur(); document.activeElement = document.body;
  const typed = { live: maps.trainings.get("t1").rows[0].weights[1], detached: live.rows[0].weights[1] };
  await advance(400); fire(completeBtn(), "click"); await advance(400);
  const L = maps.trainings.get("t1").rows[0];
  out["B_" + variant] = { replaced, rebuilt, typed, afterComplete: { liveSetsDone: L.setsDone, liveWeights: L.weights, detachedSetsDone: live.rows[0].setsDone, detachedWeights: live.rows[0].weights } };
}
// C: the coach typing in a client's workout; a sync brings a change to ANOTHER workout of that client (the client logged a set there)
for (const variant of ["control", "sibling"]) {
  const sib0 = { id: "s0", clientId: "c1", title: "Legs", date: day(-1), createdAt: "2026-11-01T10:00:00.000Z", completedAt: null, skippedAt: null, rows: [R("b", "1", "Back squat", { weights: ["", "", ""] })] };
  seed({ client: false, others: [sib0] });
  maps.dirty.clear(); await advance(2000); maps.dirty.clear();
  const el0 = rowOf("a"), name = el0.qs[".name"]; type(name, "Barbell bench pres");
  await advance(2000); maps.dirty.clear();   // that keystroke's save has gone out; the finger is still in the field
  const sib = JSON.parse(JSON.stringify(maps.trainings.get("s0"))); if (variant === "sibling") { sib.rows[0].weights = ["100", "", ""]; sib.rows[0].repsDone = ["5"]; sib.rows[0].setsDone = 1; }
  const self = JSON.parse(JSON.stringify(maps.trainings.get("t1"))), liveT = maps.trainings.get("t1");
  fns.mergeDown(maps.trainings, "trainings", [{ id: "s0", data: sib }, { id: "t1", data: self }], false, Date.now());
  const rt = app.get().renderedTraining; fns.render();
  out["C_" + variant] = { renderedTrainingAfterMerge: rt, rebuiltUnderTypingFinger: rowOf("a") !== el0, focusedFieldStillInPage: rowsEl.contains(name) };
}
// C2: the same, the coach's own copy differing from the server's only in key order (jsonb sorts keys): replaced while typed in
{ const sib0 = { id: "s0", clientId: "c1", title: "Legs", date: day(-1), createdAt: "2026-11-01T10:00:00.000Z", completedAt: null, skippedAt: null, rows: [R("b", "1", "Back squat", { weights: ["", "", ""] })] };
  seed({ client: false, others: [sib0] }); await advance(2000); maps.dirty.clear();
  const el0 = rowOf("a"), name = el0.qs[".name"]; type(name, "Barbell bench pres"); await advance(2000); maps.dirty.clear();
  const sib = JSON.parse(JSON.stringify(maps.trainings.get("s0"))); sib.rows[0].setsDone = 1; sib.rows[0].repsDone = ["5"];
  const cur = maps.trainings.get("t1"), self = {}; for (const k of Object.keys(cur).sort((a, b) => a.length - b.length || (a < b ? -1 : 1))) self[k] = JSON.parse(JSON.stringify(cur[k]));
  fns.mergeDown(maps.trainings, "trainings", [{ id: "s0", data: sib }, { id: "t1", data: self }], false, Date.now());
  out.C2 = { replacedWhileTyping: maps.trainings.get("t1") !== cur };
}
console.log(JSON.stringify(out));   // one line: the test reads the last
