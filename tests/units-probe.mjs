// Run by units.test.js in its own process: every weight shown in the client's unit, never rewritten (v301; the owner's ask, 15 Nov 2026:
// "when client or me switch the weight unit every workout past and future converts to that unit ... they come back and they can see what they
// lifted in unit they know"; their picks: one switch for the client and the coach, one decimal). Last time's 135 lb reads 61.2 kg in the grey
// suggestion, Last time and Best; the bubble says "Logged as 135 lb × 5"; a number typed in kg into an exercise logged in lb is kept in lb
// (60 kg as 132.3), and the number shown typed back keeps what was there; Complete set left untouched writes last time's weight exactly.
// The stand-ins are ramp-probe.mjs's.
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
const app = (await import("../app/main.js")).internals();
const { fns, maps } = app;


const R = (id, label, name, extra = {}) => ({ id, label, name, sets: 3, reps: "5", rest: "60 sec", tempo: "", weights: [], repsDone: [], setsDone: 0, done: false, note: "", alts: [], ...extra });
const day = (n) => { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + n); return fns.localIso(d); };
const PAST = () => [R("p", "1", "Barbell bench press", { weights: ["135", "135", "135"], repsDone: ["5", "5", "5"], setsDone: 3, done: true, unit: "lb" })];
function seed({ client = true, unit = "kg", now = [R("a", "1", "Barbell bench press")], past = PAST(), past2 = null, open = "t1" } = {}) {
  app.reset(); fns.setPreview(false); made.length = 0; rowsEl.replaceChildren(); document.activeElement = document.body;
  app.set({ signedIn: true, clientMode: client, myClientId: client ? "c1" : null, tab: "workouts" });
  maps.clients.set("c1", { id: "c1", name: "Jane", unit });
  maps.trainings.set("p1", { id: "p1", clientId: "c1", title: "Upper body", date: day(-13), createdAt: "2026-11-01T10:00:00.000Z", completedAt: day(-13) + "T18:00:00.000Z", skippedAt: null, rows: past });
  maps.trainings.set("t1", { id: "t1", clientId: "c1", title: "Upper body", date: day(0), createdAt: "2026-11-02T10:00:00.000Z", completedAt: null, skippedAt: null, rows: now });
  if (past2) maps.trainings.set("p2", { id: "p2", clientId: "c1", title: "Upper body", date: day(-20), createdAt: "2026-10-20T10:00:00.000Z", completedAt: day(-20) + "T18:00:00.000Z", skippedAt: null, rows: past2 });
  byId.get("whenPop").replaceChildren(); app.set({ view: { name: "training", id: open }, renderedTraining: null }); fns.render();
  byId.get("whenPop").offsetWidth = 250; byId.get("whenPop").offsetHeight = 60; whenBg.hidden = true;
}
const redraw = () => { made.length = 0; document.activeElement = document.body; app.set({ renderedTraining: null }); fns.render(); };
const rowOf = (id) => made.filter((x) => x.className === "row" && x.dataset && x.dataset.id === id).pop() || null;
const rowIn = (tid, id) => maps.trainings.get(tid).rows.find((r) => r.id === id);
const box = (id) => rowOf(id).qs[".setlog .w"];
const chipOf = (w) => ({ val: String(w.chipEl.qs[".val"].textContent || ""), unit: String(w.chipEl.qs[".suffix"].textContent || "") });   // what the box shows: its number and the unit word after it
const type = (inp, v) => { inp.focus(); fire(inp, "focus"); inp.value = v; fire(inp, "input"); };   // what a person does: the box takes the focus, then the words
const lifts = (id) => ({ last: rowOf(id).qs[".lift.last b"].textContent, best: rowOf(id).qs[".lift.best b"].textContent });
const bubble = (id, which = ".lift.last") => { fire(rowOf(id).qs[which], "click"); const pop = byId.get("whenPop"); const got = pop.children.map((r) => r.children.map((c) => [String(c.className || ""), String(c.textContent || "")])); whenBg.hidden = true; return got; };
const sums = (id) => findAll(rowOf(id), ".sum-w").map((w) => ({ value: w.value, label: w.attrs["aria-label"] || null, unit: w.parent ? String((findAll(w.parent, ".sum-unit")[0] || {}).textContent || "") : null }));
const completeBtn = () => made.filter((x) => classesOf(x).has("complete")).pop();
const out = {};
{ seed();   // the client in kg, a fresh bench press: last time's 135 lb reads 61.2 kg everywhere
  const w = box("a"); out.fresh = { value: w.value, placeholder: w.placeholder, label: w.attrs["aria-label"] || null, lifts: lifts("a"), chip: chipOf(w) };
  out.bubble = bubble("a");
  type(w, "60"); const r = rowIn("t1", "a"); out.typedFresh = { weights: [...r.weights], unit: r.unit || null };   // a fresh exercise takes the client's unit: 60 is 60 kg
}
{ seed(); await advance(400); fire(completeBtn(), "click"); await advance(400); const r = rowIn("t1", "a");   // left untouched: Complete set writes last time's weight, kept in kilos so it reads 135 lb again
  out.untouched = { weights: [...r.weights], unit: r.unit || null, done: r.setsDone };
}
{ seed({ now: [R("a", "1", "Barbell bench press", { weights: ["135", "", ""], repsDone: ["5", "", ""], setsDone: 1, unit: "lb" })] });   // begun in lb before the switch to kg
  const w = box("a"); out.begun = { value: w.value, placeholder: w.placeholder, chip: chipOf(w) };
  type(w, "60"); out.begunTyped = { weights: [...rowIn("t1", "a").weights], unit: rowIn("t1", "a").unit };   // 60 kg kept in the exercise's own pounds
  redraw(); const w2 = box("a"); out.begunShown = w2.value;
  type(w2, "60"); out.retyped = [...rowIn("t1", "a").weights];   // the number shown typed back: what was there stays
  w2.value = "61"; fire(w2, "input"); out.changed = [...rowIn("t1", "a").weights];
  w2.value = "60"; fire(w2, "input"); out.changedBack = [...rowIn("t1", "a").weights];
}
{ seed({ now: [R("a", "1", "Barbell bench press", { weights: ["135", "135", ""], repsDone: ["5", "", ""], setsDone: 1, unit: "lb" })] });   // set 2 already typed in lb: the box shows 61.2, typed back it stays 135
  const w = box("a"); out.typedAhead = w.value; type(w, "61.2"); out.typedAheadKept = [...rowIn("t1", "a").weights];
}
{ seed({ now: [R("a", "1", "Barbell bench press", { weights: ["130", "", ""], repsDone: ["5", "", ""], setsDone: 1, unit: "lb" })] });   // begun in lb, 130 lb for 5: lighter than 135 lb, never a best in kg
  out.lighterInLb = { best: lifts("a").best, gold: rowOf("a").qs[".lift.best"].classList.contains("new") };
}
{ seed({ now: [R("a", "1", "Barbell bench press", { weights: ["135", "", ""], repsDone: ["5", "", ""], setsDone: 1, unit: "lb" })] });   // the grey number typed: the same as leaving it (the set before, 135 lb, as it is)
  type(box("a"), "61.2"); out.greyTyped = [...rowIn("t1", "a").weights];
}
{ seed(); type(box("a"), "61.2"); out.greyTypedFresh = { weights: [...rowIn("t1", "a").weights], unit: rowIn("t1", "a").unit };   // a fresh one: last time's 135 lb, kept as Complete set keeps it
}
{ seed({ now: [R("a", "1", "Barbell bench press", { weights: ["135", "135", ""], repsDone: ["5", "", ""], setsDone: 1, unit: "lb" })] });   // a comma keypad: "61,2" is the 61.2 shown
  type(box("a"), "61,2"); out.commaKept = [...rowIn("t1", "a").weights];
}
{ seed({ now: [R("a", "1", "Barbell bench press", { weights: ["135", "", ""], repsDone: ["5", "", ""], setsDone: 1, unit: "lb" })] });   // words typed in kg into a pound exercise keep their unit
  type(box("a"), "2x10"); out.wordsTyped = [...rowIn("t1", "a").weights];
}
{ seed({ past: [R("p", "1", "Dumbbell curl", { weights: ["2x20", "2x20", "2x20"], repsDone: ["10", "10", "10"], setsDone: 3, done: true, unit: "lb" })], now: [R("a", "1", "Dumbbell curl")] });
  out.wordsGrey = box("a").placeholder; await advance(400); fire(completeBtn(), "click"); await advance(400); const r = rowIn("t1", "a"); out.wordsCopied = { weights: [...r.weights], unit: r.unit || null };   // last time's "2x20" lb into a kilo exercise: "2x20 lb"
}
{ seed({ past: [R("p", "1", "Dip", { weights: ["BW+10", "BW+10", "BW+10"], repsDone: ["8", "8", "8"], setsDone: 3, done: true, unit: "lb" })], now: [R("a", "1", "Dip")] });
  await advance(400); fire(completeBtn(), "click"); await advance(400); const r = rowIn("t1", "a"); out.bwPlusCopied = { weights: [...r.weights], unit: r.unit || null };   // a number anywhere in it: the exercise takes the client's unit as it is logged
}
{ seed({ open: "p1", past: [R("p", "1", "Banded pull-apart", { weights: ["Band 3", "Band 3", "Band 3"], repsDone: ["15", "15", "15"], setsDone: 3, done: true, unit: "lb" })] });
  out.band = sums("p").map((x) => x.value);   // a band's number is not a weight: no unit added
}
{ seed({ unit: "lb", past: [R("p", "1", "Barbell bench press", { weights: ["61.2", "61.2", "61.2"], repsDone: ["5", "5", "5"], setsDone: 3, done: true, unit: "kg" })], past2: PAST() });   // 135 lb at home, then 61.2 kg (the same weight) in Europe
  out.tie = lifts("a");   // Best: the heavier of the two keeps it, so it reads 135 lb, Last time 134.9 lb
}
{ seed({ open: "p1" });   // the finished workout, read in kg; a typo fixed there
  out.finished = sums("p");
  const ws = findAll(rowOf("p"), ".sum-w");
  type(ws[0], "61.2"); out.finishedRetyped = [...rowIn("p1", "p").weights];   // 135 lb shows 61.2: typed back, nothing moves (no 134.9)
  ws[0].value = "60"; fire(ws[0], "input"); out.finishedTyped = { weights: [...rowIn("p1", "p").weights], unit: rowIn("p1", "p").unit };   // the sets that copied it follow
}
{ seed({ open: "p1", past: [R("p", "1", "Dip", { weights: ["BW", "BW", "BW"], repsDone: ["8", "8", "8"], setsDone: 3, done: true, unit: "lb" })] });   // the Bodyweight key gave this exercise a unit with no number
  const ws = findAll(rowOf("p"), ".sum-w"); type(ws[0], "10"); out.bwRow = { weights: [...rowIn("p1", "p").weights], unit: rowIn("p1", "p").unit };   // 10 kg kept as 22 lb, never 10 lb
}
{ seed({ unit: "lb", past: [R("p", "1", "Barbell bench press", { weights: ["60", "60", "60"], repsDone: ["5", "5", "5"], setsDone: 3, done: true, unit: "kg" })] });   // home again, in lb: the Europe session reads 132.3 lb
  out.home = { placeholder: box("a").placeholder, lifts: lifts("a"), bubble: bubble("a", ".lift.best"), chip: chipOf(box("a")) };
}
{ seed({ unit: "lb" }); out.sameUnit = { placeholder: box("a").placeholder, lifts: lifts("a"), bubble: bubble("a") };   // never switched: as it always was, and no "Logged as"
}
{ seed({ client: false }); out.coach = { placeholder: box("a").placeholder, lifts: lifts("a") };   // the coach sees the client's unit too: one switch for both (the owner's pick)
}
{ seed({ now: [R("a", "1", "Barbell bench press", { weights: ["61.2", "", ""], repsDone: ["5", "", ""], setsDone: 1, unit: "kg" })] }); out.sameWeight = { best: lifts("a").best, gold: rowOf("a").qs[".lift.best"].classList.contains("new") };   // 61.2 kg for 5 is last time's 135 lb for 5: no new best
  const r = rowIn("t1", "a"); r.repsDone[0] = "8"; redraw(); out.moreReps = { best: lifts("a").best, gold: rowOf("a").qs[".lift.best"].classList.contains("new") };   // more reps at it: a new best
}
console.log(JSON.stringify(out));
