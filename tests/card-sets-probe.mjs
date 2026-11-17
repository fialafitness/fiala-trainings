// Run by card-sets.test.js in its own process (v312, the owner's report, 16 Nov 2026, twice with one client: "for the last 4th set it didn't let me log neither
// weight and reps for first one or two exercises and only let me log in the last"). In a tri-set two exercises kept 3 sets and the third had the 4 a new exercise
// starts with; the card showed 4, and on set 4 the first two had no boxes. The owner's pick: an exercise can still have fewer sets on purpose; one put into a card
// takes its sets, and on the card's extra set a shorter exercise says "3 sets only", with "Add set 4" in the coach's views.
// The stand-ins and the clock are sets-count-probe.mjs's (the real card, drawn and tapped).
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
const made = [], MK = new WeakSet();                                     // (the walks up stop at the stand-ins: any other look-up answers a new element, without end)
const classesOf = (n) => new Set([...String(n.className || "").split(/\s+/).filter(Boolean), ...(n.classes || [])]);
const matches = (n, sel) => {                                              // ".a.b", "tag", "tag.a", and ":not([hidden])" or one [data-x="y"] after either
  if (!n || typeof n !== "object") return false;
  let s = String(sel).trim(); if (/:not\(\[hidden\]\)$/.test(s)) { if (n.hidden) return false; s = s.replace(/:not\(\[hidden\]\)$/, ""); }
  const da = /\[data-([\w-]+)="([^"]*)"\]$/.exec(s); if (da) { const k = da[1].replace(/-(\w)/g, (_, c) => c.toUpperCase()); if (!n.dataset || String(n.dataset[k]) !== da[2]) return false; s = s.slice(0, da.index); }   // followRow finds a row by its id
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
for (const id of ["whenPop", "ctxDim", "altTitle", "altLead", "altDone", "status", "dpTitle", "addExBtn"]) recorder(id);
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
const R = (id, label, name, extra = {}) => ({ id, label, name, sets: 3, reps: "10", rest: "10 sec", tempo: "", weights: [], repsDone: [], setsDone: 0, done: false, note: "", alts: [], unit: "kg", ...extra });
const three = (w) => ({ weights: [w, w, w], repsDone: ["10", "10", "10"], setsDone: 3 });   // sets 1 to 3 logged
function seed({ client = false, preview = false, rows = null, done = false } = {}) {
  fire(document.body, "keydown", { key: "Escape" });
  app.reset(); fns.setPreview(false); made.length = 0; rowsEl.replaceChildren();
  app.set({ signedIn: true, clientMode: client, myClientId: client ? "c1" : null, tab: "workouts", templateDraft: null });
  maps.clients.set("c1", { id: "c1", name: "Jane", unit: "kg" });
  maps.trainings.set("t1", { id: "t1", clientId: "c1", title: "Arms", date: today(), createdAt: "2026-11-01T10:00:00.000Z", completedAt: done ? "2026-11-16T18:00:00.000Z" : null, skippedAt: null,
    rows: rows || [R("a", "1a", "Dumbbell French press", { ...three("18"), done: true }), R("b", "1b", "Dumbbell overhead tricep extension", { ...three("22"), done: true }), R("c", "1c", "Bodyweight bench dip", { sets: 4, reps: "30", rest: "60 sec", ...three("BW"), repsDone: ["30", "30", "30"] })] });
  pop.replaceChildren(); fns.setPreview(preview); app.set({ view: { name: "training", id: "t1" }, renderedTraining: null }); fns.render();
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
const rowEl = (id) => made.filter((x) => x.className === "row" && x.dataset && x.dataset.id === id).pop() || null;
const look = (id) => { const e = rowEl(id); if (!e) return null; const sh = e.querySelector(".setlog-short"), add = e.querySelector(".add-set"); return { boxes: !e.querySelector(".setlog").hidden, short: sh.hidden ? null : e.querySelector(".short-text").textContent, add: sh.hidden || add.hidden ? null : add.textContent }; };
const rowsNow = () => maps.trainings.get("t1").rows.map((r) => r.id + ":" + r.sets + ":" + r.setsDone + ":" + (r.done ? "done" : "open") + ":" + ((r.weights || [])[3] || "") + "/" + ((r.repsDone || [])[3] || ""));
const complete = async () => { const c = findAll(blockOf("1"), ".complete")[0]; if (!c) return "no button"; NOW += 1000; fire(c, "click"); await advance(50); return c.textContent; };
for (const [name, opts] of [["client", { client: true }], ["preview", { preview: true }], ["coach", {}]]) {   // the client's app, the coach's Client view (the owner's screenshots), the coach's own look
  seed(opts); out[name] = { cur: (findAll(bar(), ".cur")[0] || {}).textContent, rows: ["a", "b", "c"].map(look) };
}
{ seed({ preview: true });   // the owner's case: "Add set 4" on A, then the last set
  const add = rowEl("a").querySelector(".add-set"); fire(add, "click"); await advance(50);
  out.added = { sets: maps.trainings.get("t1").rows.map((r) => r.id + ":" + r.sets + ":" + (r.done ? "done" : "open")), saved: maps.dirty.has("trainings/t1"), a: look("a"), b: look("b") };
  out.addedComplete = await complete(); out.addedAfter = rowsNow();
}
{ seed({ client: true, rows: [R("a", "1a", "Squat", { sets: 4, ...three("40") }), R("b", "1b", "Row", { sets: 4, ...three("30") }), R("c", "1c", "Plank", { sets: 3, reps: "45 sec", ...three(""), repsDone: ["45", "45", "45"], done: true, note: "Only the first three sets." })] });   // a program's tri-set of 4/4/3 on purpose
  out.planned = { c: look("c"), button: await complete(), after: rowsNow() };
}
const blurTo = async (id, from, to) => { const lab = rowEl(id).querySelector(".label"); lab.value = from; fire(lab, "focus"); lab.value = to; fire(lab, "input"); fire(lab, "blur", { relatedTarget: null }); await advance(50); return maps.trainings.get("t1").rows.map((r) => r.id + ":" + r.sets); };
{ seed({ client: true, done: true }); out.finished = ["a", "b"].map(look); }   // a finished workout: said, no button
{ seed({ preview: true, rows: [R("a", "1a", "Squat", { sets: 5, ...three("40") }), R("b", "1b", "Row", { sets: 3, ...three("30"), done: true })] });   // a card of 5 with an exercise of 3
  const at4 = look("b"); const chip5 = findAll(bar(), ".tr-chips")[0].children[4]; fire(chip5, "click"); await advance(50); out.fiveCard = { at4, at5: look("b"), cur: (findAll(bar(), ".cur")[0] || {}).textContent };
}
{ seed({ preview: true, rows: [R("a", "1a", "Squat", { sets: 4, ...three("40") }), R("b", "1b", "Row", { sets: 3, weights: ["30", "30", "30"], repsDone: ["10", "10", "10"], done: true, setsDone: undefined })] });   // finished before the set counter existed
  fire(rowEl("b").querySelector(".add-set"), "click"); await advance(50); const b = maps.trainings.get("t1").rows[1]; out.oldDone = [b.sets, b.setsDone, b.done];
}
{ seed({ preview: true });   // the last check: a stale "Add set 4" on a workout the client has just finished (a sync replaced the record, the card not yet drawn anew)
  const add = rowEl("a").querySelector(".add-set"), T = maps.trainings.get("t1"); maps.trainings.set("t1", { ...T, completedAt: "2026-11-16T18:30:00.000Z", rows: T.rows.map((r) => ({ ...r })) });
  fire(add, "click"); await advance(50); out.staleAdd = { sets: maps.trainings.get("t1").rows.map((r) => r.id + ":" + r.sets + ":" + (r.done ? "done" : "open")), saved: maps.dirty.has("trainings/t1") };
}
{ seed({ preview: true, rows: [R("a", "1a", "Squat", { sets: 4, ...three("40") }), R("b", "1b", "Plank", { sets: 3, reps: "45 sec", ...three(""), repsDone: ["45", "45", "45"], done: true })] });   // a hold of 3 sets in a card of 4
  document.activeElement = null; fire(rowEl("b").querySelector(".add-set"), "click", { detail: 0, isTrusted: true }); await advance(50);   // from the keyboard (Enter or Space)
  const f = document.activeElement; out.holdKeys = { sets: maps.trainings.get("t1").rows[1].sets, focus: f && f.className ? String(f.className) : null, row: f && f.parent && f.parent.dataset ? f.parent.dataset.id || null : null };
}
// v312: renumbering never changes an exercise's number of sets (as v311): the checks found every rule that let a new exercise take a superset's sets changed a
// number in some reorder (a reorder can only pass through a shared number); the card's extra set says "3 sets only" instead, with Add set in the coach's views
const pickTo = async (id, num) => { const e = rowEl(id); if (!e) return "no row " + id; const lab = e.querySelector(".label"); fire(lab, "focus"); const b = e.querySelector(".numpick").children.find((x) => x.textContent === num); if (!b) return "no " + num; NOW += 400; fire(b, "click"); await advance(50); return num; };
const idSets = () => maps.trainings.get("t1").rows.map((r) => r.id + ":" + r.sets).sort();
const addEx = async () => { const ids = new Set(maps.trainings.get("t1").rows.map((r) => r.id)); fire(byId.get("addExBtn"), "click", { detail: 1 }); await advance(50); const n = maps.trainings.get("t1").rows.find((r) => !ids.has(r.id)); return n ? n.id : null; };
{ seed({ rows: [R("s", "1", "Back squat", { sets: 4 }), R("b", "2", "Bench press", { sets: 4 }), R("r", "3", "Seated cable row"), R("p", "4", "Plank")] });   // a reorder through a shared number
  out.swap = [await pickTo("r", "2"), await pickTo("b", "3"), idSets()];
}
{ seed({ rows: [R("a", "1a", "Curl"), R("b", "1b", "Press")] });   // the owner's case built anew: the real + Add exercise (4 sets) picked into a superset of 3
  const n = await addEx(); await pickTo(n, "1"); const x = maps.trainings.get("t1").rows.find((r) => r.id === n);
  const chip4 = findAll(bar(), ".tr-chips")[0].children[3]; if (chip4) { fire(chip4, "click"); await advance(50); }
  out.joinedNew = [x.sets, x.setsAuto === undefined, (findAll(bar(), ".cur")[0] || {}).textContent, look("a"), look("b")];
}
await new Promise((r) => setImmediate(r));
out.rejected = rejected;
console.log(JSON.stringify(out));
