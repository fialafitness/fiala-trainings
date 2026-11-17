// Run by card-sets.test.js in its own process. v312, the owner's report (16 Nov 2026, twice with one client: "for the last 4th set it didn't let me log neither
// weight and reps for first one or two exercises and only let me log in the last"): in a tri-set two exercises kept 3 sets and the third had the 4 a new exercise
// starts with. v313, the owner's rule (17 Nov 2026): a superset has one number of sets by default; an exercise put into it takes them, taken out it keeps them; in
// the coach's own look the exercise's "…" has Sets (Default, or fewer for that exercise alone); the client's line says "3 sets" from set 1, and on the superset's
// extra set an exercise done with its own says Done with a green tick (his pick B), else how many it has. The stand-ins and the clock are sets-count-probe.mjs's.
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
  let s = String(sel).trim(); if (/^\[[\w-]+\]$/.test(s)) { const k = s.slice(1, -1); return !!(n[k] === true || (n.attrs && k in n.attrs)); }   // a bare [attr] (closest("[inert]")): the property, as a page reflects it
  if (/:not\(\[hidden\]\)$/.test(s)) { if (n.hidden) return false; s = s.replace(/:not\(\[hidden\]\)$/, ""); }
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
  e.focus = (o) => { document.activeElement = e; e.focusedWith = o || null; }; e.blur = () => { if (document.activeElement === e) { document.activeElement = document.body; if ((e.H.blur || []).length) fire(e, "blur", { relatedTarget: null }); } };   // a page tells the field it let go
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
rowsEl.querySelector = (sel) => { const m = /^\.row\[data-id="([^"]+)"\](?:\s+(\S.*))?$/.exec(sel); if (m) { const row = made.filter((x) => classesOf(x).has("row") && x.dataset && x.dataset.id === m[1] && !x.removed).pop() || null; return row && m[2] ? row.querySelector(m[2]) : row; } return find(rowsEl, sel); };   // a row by its id, whatever else its classes say ("row fewer"), and a part of it
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
function seed({ client = false, preview = false, rows = null, done = false, tpl = false } = {}) {
  fire(document.body, "keydown", { key: "Escape" });
  app.reset(); fns.setPreview(false); made.length = 0; rowsEl.replaceChildren();
  app.set({ signedIn: true, clientMode: client, myClientId: client ? "c1" : null, tab: "workouts", templateDraft: null });
  maps.clients.set("c1", { id: "c1", name: "Jane", unit: "kg" });
  maps.trainings.set("t1", { id: "t1", clientId: tpl ? TPL : "c1", title: "Arms", date: today(), createdAt: "2026-11-01T10:00:00.000Z", completedAt: done ? "2026-11-16T18:00:00.000Z" : null, skippedAt: null,
    rows: rows || [R("a", "1a", "Dumbbell French press", { ...three("18"), done: true }), R("b", "1b", "Dumbbell overhead tricep extension", { ...three("22"), done: true }), R("c", "1c", "Bodyweight bench dip", { sets: 4, reps: "30", rest: "60 sec", ...three("BW"), repsDone: ["30", "30", "30"] })] });
  pop.replaceChildren(); fns.setPreview(preview); if (tpl) app.set({ templateDraft: { id: "t1", snapshot: "{}", dirty: false, saving: false } }); app.set({ view: { name: "training", id: "t1" }, renderedTraining: null }); fns.render();
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
const rowEl = (id) => made.filter((x) => x.className.split(" ").includes("row") && x.dataset && x.dataset.id === id).pop() || null;
const look = (id) => { const e = rowEl(id); if (!e) return null; const sh = e.querySelector(".setlog-short"), st = e.querySelector(".short-text"); return { boxes: !e.querySelector(".setlog").hidden, short: sh.hidden ? null : classesOf(st).has("short-done") ? "Done" : st.textContent }; };
const fewer = (id) => { const e = rowEl(id), own = e.querySelector(".own-sets"); return { fewer: classesOf(e).has("fewer"), own: own.hidden ? null : own.textContent }; };
const rowsNow = () => maps.trainings.get("t1").rows.map((r) => r.id + ":" + r.sets + ":" + r.setsDone + ":" + (r.done ? "done" : "open") + ":" + ((r.weights || [])[3] || "") + "/" + ((r.repsDone || [])[3] || ""));
const complete = async () => { const c = findAll(blockOf("1"), ".complete")[0]; if (!c) return "no button"; NOW += 1000; fire(c, "click"); await advance(50); return c.textContent; };
for (const [name, opts] of [["client", { client: true }], ["preview", { preview: true }], ["coach", {}]]) {   // the client's app, the coach's Client view (the owner's screenshots), the coach's own look
  seed(opts); out[name] = { cur: (findAll(bar(), ".cur")[0] || {}).textContent, rows: ["a", "b", "c"].map(look), marks: ["a", "b", "c"].map(fewer) };
}
{ seed({ client: true, rows: [R("a", "1a", "Squat", { sets: 4, ...three("40") }), R("b", "1b", "Row", { sets: 4, ...three("30") }), R("c", "1c", "Plank", { sets: 3, reps: "45 sec", ...three(""), repsDone: ["45", "45", "45"], done: true, note: "Only the first three sets." })] });   // a program's tri-set of 4/4/3 on purpose
  out.planned = { c: look("c"), button: await complete(), after: rowsNow() };
}
{ seed({ done: true }); const coach = ["a", "b"].map(look); seed({ client: true, done: true }); const blk = blockOf("1"); out.finished = { coach, client: { block: [...classesOf(blk)].sort(), locked: classesOf(rowsEl).has("locked") } }; }   // a finished workout: the coach's own look shows the line; the client's holds the card as one still to come, where the pinned rule hides it
{ seed({ client: true, rows: [R("a", "1a", "Squat", { sets: 4, ...three("40") }), R("b", "1b", "Row", { sets: 3, weights: ["30"], repsDone: ["10"], setsDone: 1, done: true, earlyReason: "Discomfort" })] });   // finished early: fewer done than its own
  const chip4 = findAll(bar(), ".tr-chips")[0].children[3]; fire(chip4, "click"); await advance(50); out.early = look("b");   // on the card's 4th set
}
{ seed({ preview: true, rows: [R("a", "1a", "Squat", { sets: 5, ...three("40") }), R("b", "1b", "Row", { sets: 3, ...three("30"), done: true })] });   // a card of 5 with an exercise of 3
  const at4 = look("b"); const chip5 = findAll(bar(), ".tr-chips")[0].children[4]; fire(chip5, "click"); await advance(50); out.fiveCard = { at4, at5: look("b"), cur: (findAll(bar(), ".cur")[0] || {}).textContent };
}
// joining a superset: the number picked (or typed) puts the exercise into a card; it takes the card's sets, never fewer than it holds something on; taken out it keeps them
const pickTo = async (id, num) => { const e = rowEl(id); if (!e) return "no row " + id; const lab = e.querySelector(".label"); fire(lab, "focus"); const b = e.querySelector(".numpick").children.find((x) => x.textContent === num); if (!b) return "no " + num; NOW += 400; fire(b, "click"); await advance(50); return num; };
const idSets = () => maps.trainings.get("t1").rows.map((r) => r.id + ":" + r.sets).sort();
const blurTo = async (id, from, to) => { const lab = rowEl(id).querySelector(".label"); lab.value = from; fire(lab, "focus"); lab.value = to; fire(lab, "input"); fire(lab, "blur", { relatedTarget: null }); await advance(50); return idSets(); };
const addEx = async () => { const ids = new Set(maps.trainings.get("t1").rows.map((r) => r.id)); fire(byId.get("addExBtn"), "click", { detail: 1 }); await advance(50); const n = maps.trainings.get("t1").rows.find((r) => !ids.has(r.id)); return n ? n.id : null; };
{ seed({ rows: [R("s", "1", "Back squat", { sets: 4 }), R("b", "2", "Bench press", { sets: 4 }), R("r", "3", "Seated cable row"), R("p", "4", "Plank")] });   // a reorder through a shared number: the row joins the bench (4), then the bench leaves; each keeps what it has
  out.swap = [await pickTo("r", "2"), await pickTo("b", "3"), idSets(), maps.dirty.has("trainings/t1")];
}
{ seed({ rows: [R("a", "1a", "Curl"), R("b", "1b", "Press")] });   // the owner's case built anew: the real + Add exercise (4 sets) picked into a superset of 3
  const n = await addEx(); const was = maps.trainings.get("t1").rows.find((r) => r.id === n).sets; await pickTo(n, "1"); const x = maps.trainings.get("t1").rows.find((r) => r.id === n);
  out.joinedNew = [was, x.sets, findAll(bar(), ".tr-chips")[0].children.length, ["a", "b", n].map(fewer)];   // (the set looked at is the card's own state, kept from an earlier scene: its count of chips says the card's sets)
}
{ seed({ rows: [R("a", "1a", "Curl", { sets: 8 }), R("b", "1b", "Press", { sets: 8 }), R("n", "2", "Row", { sets: 4 })] });   // the owner's words: "a1 and a2 with 8 sets and I add another exercise it will let the 8 sets", typed this time
  out.typed = await blurTo("n", "2", "1");
}
{ seed({ rows: [R("a", "1a", "Curl"), R("b", "1b", "Press"), R("n", "2", "Row", { sets: 4 })] });   // a number typed on the way to another ("1", then "12"): no card 12, nothing joins
  out.typedOn = await blurTo("n", "2", "12");
}
{ seed({ rows: [R("a", "1a", "Curl"), R("b", "1b", "Press"), R("n", "2", "Row", { sets: 4, weights: ["30", "30", "30", "30"], repsDone: ["10", "10", "10", "10"], setsDone: 4, done: true })] });   // joined with 4 logged: never fewer than it holds
  await pickTo("n", "1"); out.joinedLogged = [idSets(), rowsNow()];
}
{ seed({ rows: [R("a", "1a", "Curl", { sets: 5 }), R("b", "1b", "Press", { sets: 5 }), R("n", "2", "Row", { sets: 4 })] });   // taken out of the superset it keeps its 5 (his answer)
  await pickTo("b", "3"); out.leftKeeps = idSets();
}
// the card's sets button on a superset with an exercise given fewer: the superset's own number moves; the one with fewer keeps them, unless the superset goes below
const mixed = () => [R("a", "1a", "Squat", { sets: 4 }), R("b", "1b", "Row", { sets: 4 }), R("c", "1c", "Plank", { sets: 3 })];
for (const [k, label] of [["disc5", "5 sets"], ["disc3", "3 sets"], ["disc2", "2 sets"]]) {
  seed({ rows: mixed() }); open({}, "1"); pick(label); await advance(50); out[k] = maps.trainings.get("t1").rows.map((r) => r.sets);
}
// Sets in the exercise's "…" (the coach's own look): Default (the superset's number) or fewer, for that exercise alone
const moreOf = (id) => rowEl(id).querySelector(".more-btn");
const openMore = (id, ev = {}) => { const b = moreOf(id); b.rect = { top: 300, bottom: 336, left: 340, right: 376, width: 36, height: 36 }; fire(b, "click", { detail: 1, ...ev }); return rowsOf().map((x) => x.textContent); };
const subEl = () => findAll(pop, ".msub")[0] || null;
const kids = () => { const s = subEl(); return s ? s.children.filter((c) => classesOf(c).has("wopt")) : []; };
const tapSets = (ev = {}) => { const r = rowsOf().find((x) => x.textContent.startsWith("Sets")); if (!r) return "no Sets row"; fire(r, "click", { detail: 1, ...ev }); return kids().map((x) => x.textContent + (x.attrs["aria-current"] === "true" ? " ✓" : "")); };
const pickKid = async (label) => { const r = kids().find((x) => x.textContent === label); if (!r) return "no " + label; NOW += 400; fire(r, "click"); await advance(50); return label; };
{ seed({ rows: mixed() });
  const rows = openMore("c"), list = tapSets(), state = { sub: !!subEl(), dimmed: rowsOf().every((x) => x.inert), expanded: rowsOf().find((x) => x.textContent.startsWith("Sets")).attrs["aria-expanded"] };
  await pickKid("Default (4 sets)"); out.menuMixed = { rows, list, state, sets: maps.trainings.get("t1").rows.map((r) => r.sets), saved: maps.dirty.has("trainings/t1"), open: !whenBg.hidden };
}
{ seed({ rows: mixed() }); openMore("a"); out.menuDefault = tapSets(); }   // the superset's own number: Default ticked
{ seed({ rows: mixed() }); openMore("a"); tapSets(); await pickKid("2 sets"); out.menuFewer = [maps.trainings.get("t1").rows.map((r) => r.sets), (findAll(bar(), ".cur")[0] || {}).textContent, fewer("a")]; }   // given fewer, alone
{ seed({ rows: mixed() }); openMore("c"); tapSets(); const head = findAll(subEl(), ".mhead")[0]; NOW += 400; fire(head, "click", { detail: 1 }); out.menuHead = { sub: !!subEl(), dimmed: rowsOf().some((x) => x.inert), subopen: classesOf(pop).has("subopen"), open: !whenBg.hidden }; }   // its head closes the list again, the menu stays
{ seed({ rows: [R("a", "1", "Squat", { sets: 4 })] }); out.menuSingle = openMore("a"); }   // an exercise on its own: no Sets
{ seed({ client: true, rows: mixed() }); out.menuClient = openMore("c"); }   // the client's app: never (the "…" is the coach's)
{ seed({ preview: true, rows: mixed() }); out.menuPreview = openMore("c"); }   // the coach's Client view: never
{ seed({ rows: [R("a", "1a", "Squat", { sets: 4, ...three("40") }), R("b", "1b", "Row", { sets: 4, ...three("30") })] });   // fewer with something logged on a set that goes: asked first, named
  openMore("b"); tapSets(); await pickKid("2 sets"); await advance(400); const q1 = asked(); fire(no, "click", { detail: 1 }); await advance(400);
  const kept = rowsNow(); openMore("b"); tapSets(); await pickKid("2 sets"); await advance(400); const q2 = asked(); fire(yes, "click", { detail: 1 }); await advance(400);
  out.menuDrop = { q1, kept, q2, after: rowsNow(), b: maps.trainings.get("t1").rows[1].weights.length };
}
{ seed({ rows: mixed() }); document.activeElement = null; openMore("c", { detail: 0, isTrusted: true }); tapSets({ detail: 0, isTrusted: true }); const f = document.activeElement; out.menuKeys = f && f.textContent ? f.textContent : null; }   // from the keyboard: on the choice in effect
// the review's catches: a keyboard's pick comes back to the "…" (to the chevron when it finished and folded the card); up and down stay in the list; a double tap keeps
// the list open; a pointer's click after a keyboard's Enter keeps the keyboard's place; an exercise finished before the set counter keeps its own sets done when given
// more; a number typed into the label then an alternative picked joins first; a right-click's menu has Sets too
const keyPick = async (label) => { const r = kids().find((x) => x.textContent === label); if (!r) return "no " + label; fire(r, "click", { detail: 0, isTrusted: true }); await advance(50); return label; };
const focusIs = () => { const f = document.activeElement; if (!f || f === document.body) return "body"; const row = (() => { for (let n = f; n && MK.has(n); n = n.parent) if (n.dataset && n.dataset.id) return n.dataset.id; return null; })(); return (row ? row + ":" : "") + [...classesOf(f)].filter((c) => /more-btn|card-chev|wopt|mhead/.test(c)).join(".") + (f.textContent && /wopt/.test(f.className) ? ":" + f.textContent : ""); };
{ seed({ rows: mixed() }); document.activeElement = null; openMore("c", { detail: 0, isTrusted: true }); tapSets({ detail: 0, isTrusted: true }); await keyPick("2 sets"); out.keysBack = [maps.trainings.get("t1").rows.map((r) => r.sets), focusIs()]; }
{ seed({ rows: [R("a", "1a", "Squat", { sets: 4, weights: ["40", "40", "40", "40"], repsDone: ["10", "10", "10", "10"], setsDone: 4, done: true }), R("b", "1b", "Row", { sets: 4, ...three("30") })] });
  document.activeElement = null; openMore("b", { detail: 0, isTrusted: true }); tapSets({ detail: 0, isTrusted: true }); await keyPick("3 sets");
  const blk = blockOf("1"); out.keysFold = [maps.trainings.get("t1").rows.map((r) => r.id + ":" + r.sets + ":" + (r.done ? "done" : "open")), [...classesOf(blk)].sort().join(" "), focusIs()];
}
{ seed({ rows: mixed() }); document.activeElement = null; openMore("c", { detail: 0, isTrusted: true }); tapSets({ detail: 0, isTrusted: true });
  const key = (k) => { fire(document.body, "keydown", { key: k }); return focusIs(); };
  out.arrows = [focusIs(), key("ArrowDown"), key("ArrowDown"), key("ArrowDown"), key("ArrowUp"), key("ArrowUp"), key("ArrowUp"), key("ArrowUp"), key("ArrowUp")];
}
{ seed({ rows: mixed() }); openMore("c"); const r = rowsOf().find((x) => x.textContent.startsWith("Sets")); fire(r, "click", { detail: 1 }); NOW += 120;
  fire(findAll(subEl(), ".mhead")[0], "click", { detail: 2 }); const held = !!subEl(); NOW += 400; fire(findAll(subEl(), ".mhead")[0], "click", { detail: 1 }); out.doubleTap = [held, !!subEl(), !whenBg.hidden];
}
{ seed({ rows: mixed() }); document.activeElement = null; openMore("c", { detail: 0, isTrusted: true }); const before = focusIs(); tapSets({ detail: 1 }); out.mixedFocus = [before, focusIs()]; }
{ seed({ rows: [R("a", "1a", "Squat", { sets: 4 }), R("b", "1b", "Row", { sets: 4 }), R("c", "1c", "Plank", { sets: 3, weights: ["", "", ""], repsDone: ["45", "45", "45"], done: true, setsDone: undefined })] });   // finished before the set counter existed
  openMore("c"); tapSets(); await pickKid("Default (4 sets)"); const c = maps.trainings.get("t1").rows[2]; out.legacy = [c.sets, c.setsDone, c.done];
}
{ seed({ rows: [R("a", "1a", "Curl"), R("b", "1b", "Press"), R("n", "2", "Seated cable row", { sets: 4, alts: ["Cable row"] })] });   // a number typed, then an alternative picked without leaving the box
  const lab = rowEl("n").querySelector(".label"); lab.value = "2"; lab.focus(); fire(lab, "focus"); lab.value = "1"; fire(lab, "input");
  const ap = rowEl("n").querySelector(".alt-pop"); fire(ap, "click", { detail: 1 }); NOW += 400; const alt = rowsOf().find((x) => x.textContent === "Cable row"); if (alt) fire(alt, "click", { detail: 1 }); await advance(50);
  out.altJoin = [!!alt, idSets(), maps.trainings.get("t1").rows.find((r) => r.id === "n").name];
}
{ seed({ rows: mixed() }); const c = rowEl("c"); c.rect = { top: 300, bottom: 600, left: 16, right: 386, width: 370, height: 300 };   // a right-click on the exercise (the Mac): its menu at the pointer has Sets too, and a pick from its list sets the exercise
  fire(c, "contextmenu", { clientX: 200, clientY: 320, button: 2, pointerType: "mouse" }); const rows = rowsOf().map((x) => x.textContent), list = tapSets(); await pickKid("2 sets");
  out.rightClick = { rows, list, sets: maps.trainings.get("t1").rows.map((r) => r.sets), open: !whenBg.hidden };
}
// the second review's catches: an exercise already begun keeps its count when it joins (no sets made up as done on the others); a pointer's click on the list's head
// keeps the keyboard's place; a menu that fits neither under nor over its button stays on the screen
{ seed({ rows: [R("a", "1a", "Squat", { sets: 4 }), R("b", "1b", "Row", { sets: 4 }), R("x", "2", "Curl", { sets: 3, ...three("18"), done: true })] });
  const st = () => maps.trainings.get("t1").rows.map((r) => r.id + ":" + r.label + ":" + r.sets + ":" + (parseInt(r.setsDone, 10) || 0) + ":" + (r.done ? "done" : "open"));
  await pickTo("x", "1"); const joined = st(); await pickTo("x", "2"); out.begunJoin = [joined, st()];
}
{ seed({ rows: mixed() }); document.activeElement = null; openMore("c", { detail: 0, isTrusted: true }); tapSets({ detail: 0, isTrusted: true }); const inList = focusIs();
  NOW += 400; fire(findAll(subEl(), ".mhead")[0], "click", { detail: 1 }); out.headPointer = [inList, focusIs(), !!subEl(), !whenBg.hidden];
}
{ seed({ rows: mixed() }); globalThis.innerHeight = 402; VV.height = 402; const b = moreOf("c"); b.rect = { top: 180, bottom: 216, left: 340, right: 376, width: 36, height: 36 };
  fire(b, "click", { detail: 1 }); out.menuFits = [pop.style.top, classesOf(pop).has("above")];
  const ins = rowsOf().find((x) => x.textContent === "Add instructions"); NOW += 120; fire(ins, "click", { detail: 2 }); const held = !whenBg.hidden;   // a double tap's second, on the menu drawn over its button: nothing
  NOW += 400; fire(ins, "click", { detail: 1 }); out.menuOverGuard = [held, !whenBg.hidden]; globalThis.innerHeight = 874; VV.height = 874; fire(document.body, "keydown", { key: "Escape" });
}
{ seed({ rows: [R("a", "1a", "Squat"), R("b", "1b", "Row"), R("x", "2", "Curl", { sets: 5, ...three("18") })] });   // an exercise under way (3 of 5) joining a superset of 3 not begun: it takes the superset's 3 (and is done with them)
  await pickTo("x", "1"); out.underWayJoin = maps.trainings.get("t1").rows.map((r) => r.id + ":" + r.sets + ":" + (parseInt(r.setsDone, 10) || 0) + ":" + (r.done ? "done" : "open"));
}
// a template (the coach's look): it stays as it is (no change on its own), shows the coach's "3 sets", and a change made in the "…" or by a join waits in its draft
{ seed({ tpl: true, rows: mixed() }); const before = maps.trainings.get("t1").rows.map((r) => r.sets), mark = fewer("c"); maps.dirty.clear();
  openMore("c"); tapSets(); await pickKid("Default (4 sets)"); const td = app.get().templateDraft;
  out.template = { before, mark, after: maps.trainings.get("t1").rows.map((r) => r.sets), draft: !!(td && td.dirty), saved: maps.dirty.has("trainings/t1") };
}
{ seed({ tpl: true, rows: [R("a", "1a", "Curl", { sets: 8 }), R("b", "1b", "Press", { sets: 8 }), R("n", "2", "Row", { sets: 4 })] }); maps.dirty.clear();
  await pickTo("n", "1"); const td = app.get().templateDraft; out.templateJoin = { sets: idSets(), draft: !!(td && td.dirty), saved: maps.dirty.has("trainings/t1") };
}
await new Promise((r) => setImmediate(r));
out.rejected = rejected;
console.log(JSON.stringify(out));
