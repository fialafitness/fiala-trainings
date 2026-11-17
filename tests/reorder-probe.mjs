// Run by reorder.test.js in its own process (v314, Reorder: his ask, 17 Nov 2026, "touch and hold to move exercises in the card/ superset but I
// also want to be able to move the whole superset tri set etc by touch and hold ... also swiping on exercise delete option"; his picks: grey,
// the one held in purple, an exercise moving only inside its own card). The real app/main.js on its own clock, with card-sets-probe.mjs's
// stand-ins, laid out as a 402-point phone shows the folded cards; fingers and a Mac's mouse played as WebKit sends them. Prints JSON.
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
document.addEventListener = (t, fn, o) => { (L[t] ||= []).push({ fn, capture: o === true || !!(o && o.capture), passive: o && typeof o === "object" && "passive" in o ? !!o.passive : /^(touchstart|touchmove|wheel)$/.test(t) }); };   // (Reorder: a document touch listener is passive unless it says not, as a browser makes it)
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
// ---- Reorder's own stand-ins: each element knows its parent as a page does, and where it is on a 402 x 874 phone (the bar's foot at 100, the
// cards from 250 down, 16 apart: an exercise's row 58 tall, a card of one 116, a card's own line 58, the card's 1-point edge), scrolled by scrollY
const box = (l, t, w, h) => ({ left: l, top: t, width: w, height: h, right: l + w, bottom: t + h, x: l, y: t });
const has = (n, c) => !!n && classesOf(n).has(c);
const ROWS_TOP = 250, GAP = 16;
const hOf = (n) => (has(n, "ro-block") ? hOf(n.children[0]) : has(n, "ro-card") ? 2 + n.children.reduce((s, li) => s + hOf(li), 0) : n && n.tagName === "LI" ? (has(n, "ro-one") ? 116 : 58) : 0);
let SY = 0; const pageH = () => ROWS_TOP + rowsEl.children.reduce((s, b) => s + hOf(b) + GAP, 0) + 160;
function rectOf(e) {
  if (has(e, "ro-block") && e.parent === rowsEl) { const i = rowsEl.children.indexOf(e); let top = ROWS_TOP; for (const b of rowsEl.children.slice(0, i)) top += hOf(b) + GAP; return box(16, top - SY, 370, hOf(e)); }
  if (has(e, "ro-card") && e.parent) return rectOf(e.parent);
  if (e.tagName === "LI" && e.parent && has(e.parent, "ro-card")) { const b = rectOf(e.parent); let top = b.top + 1; for (const li of e.parent.children.slice(0, e.parent.children.indexOf(e))) top += hOf(li); return box(17, top, 368, hOf(e)); }
  for (let n = e.parent; n && MK.has(n); n = n.parent) if (n.tagName === "LI" && n.parent && has(n.parent, "ro-card")) return rectOf(n);
  return e.rect || box(0, 0, 0, 0);
}
const mk0 = document.createElement;
document.createElement = (t) => { const e = mk0(t); e.addEventListener = (t2, fn, o) => { (e.H[t2] ||= []).push(fn); fn.__passive = !!(o && typeof o === "object" && o.passive); }; Object.defineProperty(e, "parentElement", { get: () => e.parent, configurable: true }); Object.defineProperty(e, "isConnected", { get: () => { for (let n = e; n && MK.has(n); n = n.parent) if (n === rowsEl || n === whenBg || n === askSheet) return !e.removed; return false; }, configurable: true }); e.getBoundingClientRect = () => rectOf(e); for (const k of ["_rs", "_ctx", "_full", "_paint", "_land", "_info"]) e[k] = undefined; return e; };   // (what the app hangs on an element is none until it does: env.js would answer a stub)
const headerEl = byId.get("headerEl"); headerEl.rect = box(0, 0, 402, 100);
for (const id of ["navDone", "tMore"]) { const e = document.createElement("button"); e.id = id; byId.set(id, e); headerEl.appendChild(e); }   // (they take the keyboard's place)
const draftBar = document.createElement("div"); draftBar.id = "draftBar"; draftBar.hidden = true; draftBar.rect = box(0, 775, 402, 99); byId.set("draftBar", draftBar);   // a template's Unsaved changes bar at the foot (65 + the home indicator's 34)
{ const was = document.querySelector; document.querySelector = (sel) => (sel === "header" ? headerEl : /sheet-bg|crop-view/.test(sel) ? null : was ? was.call(document, sel) : null); }   // (held() is false: no sheet, no photo framing up; a question is S.asking)
const scrollTo0 = (y) => { const max = Math.max(0, pageH() - 874), was = SY; SY = Math.max(0, Math.min(max, Math.round(y))); globalThis.scrollY = SY; if (SY !== was) for (const l of [...(WIN.scroll || [])]) l.fn({ type: "scroll" }); };
globalThis.scrollY = 0; globalThis.scrollTo = (x, y) => scrollTo0(typeof x === "object" ? x.top : y); globalThis.scrollBy = (x, y) => scrollTo0(SY + (typeof x === "object" ? x.top : y));
globalThis.requestAnimationFrame = (fn) => setTimeout(() => fn(NOW), 16); globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
let buzz = 0; navigator.vibrate = () => { buzz++; return true; };
// events as WebKit sends them: the document's capture listeners, the element and its parents, the document's bubbling ones
function send(type, target, extra = {}) {
  const ev = { type, target, timeStamp: NOW, detail: 1, cancelable: true, isTrusted: true, ...extra, halted: false, stoppedAll: false, defaultPrevented: false };
  ev.preventDefault = () => { if (!ev.__passive) ev.defaultPrevented = true; }; ev.stopPropagation = () => { ev.halted = true; }; ev.stopImmediatePropagation = () => { ev.halted = ev.stoppedAll = true; };   // (a passive listener cannot stop the scroll)
  if (target && MK.has(target) && target.isConnected === false && /^touch/.test(type)) { for (const fn of [...((target.H || {})[type] || [])]) { ev.__passive = !!fn.__passive; fn(ev); ev.__passive = false; if (ev.stoppedAll) break; } return ev; }   // a touch whose element a redraw took out of the page reaches only that element, as WebKit sends it
  for (const l of [...(L[type] || [])].filter((x) => x.capture)) { if (ev.stoppedAll) return ev; ev.__passive = l.passive; l.fn(ev); ev.__passive = false; }
  for (let n = target; n && MK.has(n) && !ev.halted; n = n.parent) for (const fn of [...((n.H || {})[type] || [])]) { fn(ev); if (ev.stoppedAll) return ev; }
  if (!ev.halted) for (const l of [...(L[type] || [])].filter((x) => !x.capture)) { if (ev.stoppedAll) return ev; ev.__passive = l.passive; l.fn(ev); ev.__passive = false; }
  return ev;
}
let TID = 0, cur = null;
const P = (x, y, id) => ({ identifier: id, clientX: x, clientY: y });
const tdown = (target, x, y) => { cur = { id: ++TID, target, x, y }; return send("touchstart", target, { touches: [P(x, y, cur.id)], changedTouches: [P(x, y, cur.id)] }); };
const tmove = (x, y) => { cur.x = x; cur.y = y; return send("touchmove", cur.target, { touches: [P(x, y, cur.id)], changedTouches: [P(x, y, cur.id)] }); };
const tup = (type = "touchend") => send(type, cur.target, { touches: [], changedTouches: [P(cur.x, cur.y, cur.id)], cancelable: type === "touchend" });
const second = () => send("touchstart", cur.target, { touches: [P(cur.x, cur.y, cur.id), P(cur.x + 40, cur.y, cur.id + 100)], changedTouches: [P(cur.x + 40, cur.y, cur.id + 100)] });
const mouse = (type, target, x, y, extra = {}) => send(type, target, { pointerType: "mouse", pointerId: 1, isPrimary: true, button: 0, buttons: type === "pointerup" ? 0 : 1, clientX: x, clientY: y, ...extra });
const tglide = async (dx, dy, steps = 8) => { const x0 = cur.x, y0 = cur.y; for (let i = 1; i <= steps; i++) { tmove(Math.round(x0 + dx * i / steps), Math.round(y0 + dy * i / steps)); await advance(16); } };
const mglide = async (target, x0, y0, dy, steps = 8) => { for (let i = 1; i <= steps; i++) { mouse("pointermove", target, x0, Math.round(y0 + dy * i / steps)); await advance(16); } };
const click = (target) => send("click", target, { detail: 1 });

const app = (await import("../app/main.js")).internals();
const { fns, maps } = app;

const TPL = "00000000-0000-4000-8000-0000000000f1", pop = byId.get("whenPop"), yes = byId.get("askYes"), no = byId.get("askNo");
const popH = () => Math.min(classesOf(pop).has("long") ? 528 : Infinity, parseFloat(pop.style.maxHeight) || Infinity, 24 + 42 * pop.children.filter((c) => classesOf(c).has("wopt")).length);   // as a page lays the bubble out: its rows, the long list's 528, a cap written on it
Object.defineProperty(pop, "offsetHeight", { get: popH, configurable: true }); Object.defineProperty(pop, "clientHeight", { get: popH, configurable: true });
let popTop = 0; Object.defineProperty(pop, "scrollTop", { get: () => popTop, set: (v) => { if (!whenBg.hidden) popTop = v; }, configurable: true });   // a hidden bubble does not scroll
// the app on the made-up workout of his pictures (no client's name)
const RW = (id, label, name, sets = 4) => ({ id, label, name, sets, reps: "8", rest: "60 sec", tempo: "", weights: [], repsDone: [], setsDone: 0, done: false, note: "", alts: [], unit: "lb" });
const LEGS = () => [RW("d", "1", "Deadlift"), RW("l", "2a", "Knee over toe lunge"), RW("r", "2b", "Barbell Romanian deadlift"), RW("g", "3", "Banded glute kickback"), RW("s", "4", "Squat"),
  RW("x", "5a", "Leg extension", 3), RW("y", "5b", "Lying leg curl", 3), RW("z", "5c", "Standing calf raise", 3)];
function scene(rows, { tpl = false } = {}) {
  send("keydown", document.body, { key: "Escape" }); if (fns.roOrdering()) fns.doneOrder();
  app.reset(); fns.setPreview(false); made.length = 0; rowsEl.replaceChildren(); SY = 0; globalThis.scrollY = 0;
  app.set({ signedIn: true, clientMode: false, myClientId: null, tab: "workouts", templateDraft: null });
  maps.clients.set("c1", { id: "c1", name: "Client", unit: "lb" }); maps.clients.set(TPL, { id: TPL, name: "Templates" });
  maps.trainings.set("w1", { id: "w1", clientId: tpl ? TPL : "c1", title: "Legs", date: today(), createdAt: "2026-11-01T10:00:00.000Z", completedAt: null, skippedAt: null, rows: rows || LEGS(), ...(tpl ? { template: { program: "My templates", phase: 0, stage: 0, n: 1 } } : {}) });
  app.set({ view: { name: "training", id: "w1" }, renderedTraining: null }); fns.render();
  maps.dirty.clear(); maps.trainerState.clear(); askSheet.hidden = true; whenBg.hidden = true; document.activeElement = null;
  fns.startOrder("w1");
}
const blocks = () => rowsEl.children.filter((b) => has(b, "ro-block"));
const blockOf = (key) => blocks().find((b) => b.dataset.key === key) || null;
const liOf = (id) => made.filter((x) => has(x, "ro-ex") && x.dataset && x.dataset.id === id && !x.removed && x.isConnected).pop() || null;
const inside = (n, c) => findAll(n, "." + c)[0] || null;
const mid = (e) => { const r = e.getBoundingClientRect(); return [Math.round(r.left + r.width / 2), Math.round(r.top + r.height / 2)]; };
const order = () => maps.trainings.get("w1").rows.map((r) => r.label + " " + r.id);
const st = () => fns.roState();
const claimed = () => !!(maps.trainerState.get("w1") && maps.trainerState.get("w1").has("order"));
const lifted = () => made.filter((x) => has(x, "ro-lifted") && x.isConnected).map((x) => (has(x, "ro-block") ? "card " + x.dataset.key : "row " + x.dataset.id));
const out = {};

// 1. a whole card, a finger: held on the superset's own grip, nothing for 0.39 s; at 0.4 it lifts (larger, the purple outline, the page's grabbing state);
//    dragged down past two cards, those two glide up out of its way; let go, it glides into its place, the numbers follow, saved, and the release clicks nothing
scene();
{ const grip = inside(blockOf("2"), "ro-move"), [x, y] = mid(grip);
  tdown(grip, x, y); await advance(390); const early = { lifted: !!(st() && st().lifted), cls: lifted() };
  const pre = tmove(x, y + 2).defaultPrevented; tmove(x, y); await advance(20);
  const b2 = blockOf("2"), lift = { lifted: st().lifted, kind: st().kind, cls: lifted(), body: has(document.body, "ro-drag"), transform: b2.style.transform, buzz };
  const held = tmove(x, y + 3).defaultPrevented; await advance(16);
  await tglide(0, 300); const mid1 = { to: st().to, b3: blockOf("3").style.transform, b4: blockOf("4").style.transform, b5: blockOf("5").style.transform, b2: blockOf("2").style.transform };
  const cardsAtUp = blocks().slice(); const end = tup(); const clk = click(grip); const during = order().join(" | "), sameCards = blocks().every((b, k) => b === cardsAtUp[k]);
  await advance(250);
  out.card = { early, pre, held, lift, mid1, upPrevented: end.defaultPrevented, clickEaten: !!clk.stoppedAll, during, sameCards, order: order(), dirty: maps.dirty.has("trainings/w1"), claimed: claimed(), state: st(), body: has(document.body, "ro-drag"), on: fns.exOrderOn(), cards: blocks().map((b) => b.dataset.key).join(" "), buzz };
}
// 2. an exercise inside its tri-set, a finger: held on its row, it lifts out over its card's edge, goes up past the two above it, the letters follow
scene();
{ scrollTo0(rectOf(liOf("z")).top + SY - 420); const li = liOf("z"), name = inside(li, "ro-name"), [x, y] = mid(name);
  tdown(name, x, y); await advance(410); const lift = { kind: st().kind, rid: st().rid, cls: lifted(), open: has(li.parent, "ro-open") };
  await tglide(0, -130); const mid1 = { to: st().to, x: liOf("x").style.transform, y: liOf("y").style.transform };
  tup(); await advance(250);
  out.row = { lift, mid1, order: order(), claimed: claimed() };
}
// 3. a scroll before the hold's end: nothing lifts, nothing moves
scene();
{ const li = liOf("g"), [x, y] = mid(li);
  tdown(li, x, y); await advance(100); tmove(x, y + 12); await advance(400);
  out.scroll = { state: st(), order: order().join(" | ") === LEGS().map((r) => r.label + " " + r.id).join(" | "), cls: lifted() };
  tup(); await advance(50);
}
// 4. a swipe to the left before the hold's end: the row's Delete, not a lift; its Delete asks first, then the exercise goes and the letters close up
scene();
{ const li = liOf("y"), [x, y] = mid(li);
  tdown(li, x + 60, y); await advance(40); tmove(x + 50, y); await advance(16); tmove(x + 20, y); await advance(16); tmove(x - 30, y); await advance(16); tmove(x - 60, y); await advance(16); tup(); await advance(500);
  const sw = fns.rowSwipe(); const swiped = { open: sw && sw.open, state: st(), cls: lifted() };
  const act = inside(li, "sa-del"); send("touchstart", act, { touches: [P(330, y, 77)], changedTouches: [P(330, y, 77)] }); send("touchend", act, { touches: [], changedTouches: [P(330, y, 77)] }); click(act); await advance(50);
  const ask = { open: !askSheet.hidden, title: byId.get("askTitle").textContent, text: byId.get("askText").textContent };
  await advance(400); send("click", yes, { detail: 1 }); await advance(50);
  out.swipe = { swiped, ask, order: order(), on: fns.exOrderOn(), claimed: claimed() };
}
// 5. held and let go where it was: it settles back, nothing written
scene();
{ const li = liOf("s"), [x, y] = mid(li);
  tdown(li, x, y); await advance(450); const was = st().lifted; tup(); await advance(250);
  out.inPlace = { lifted: was, order: order().join(" | ") === LEGS().map((r) => r.label + " " + r.id).join(" | "), dirty: maps.dirty.has("trainings/w1"), cls: lifted() };
}
// 6. Escape, a second finger, the system's own cancel: back into its place; the finger's release clicks nothing
for (const how of ["escape", "second", "cancel"]) {
  scene();
  const li = liOf("d"), [x, y] = mid(li);
  tdown(li, x, y); await advance(410); await tglide(0, 200);
  if (how === "escape") send("keydown", document.body, { key: "Escape" }); else if (how === "second") second(); else tup("touchcancel");
  await advance(250); const end = how === "cancel" ? null : tup(); const clk = click(li);
  out["back_" + how] = { order: order().join(" | ") === LEGS().map((r) => r.label + " " + r.id).join(" | "), state: st(), dirty: maps.dirty.has("trainings/w1"), eaten: how === "cancel" ? null : !!clk.stoppedAll, upPrevented: end ? end.defaultPrevented : null };
}
// 7. a sync's redraw while a card is held waits (the same cards stay under the finger) and comes once it is down
scene();
{ const li = liOf("g"), [x, y] = mid(li), before = blocks()[0];
  tdown(li, x, y); await advance(410);
  const { ui } = await import("../app/state.js"); maps.trainings.get("w1").rows.find((r) => r.id === "d").name = "Trap bar deadlift"; ui.render(); await advance(20);
  const same = blocks()[0] === before && li.isConnected;
  await tglide(0, -200); tup(); await advance(300);
  out.sync = { same, order: order(), redrawn: blocks()[0] !== before, name: maps.trainings.get("w1").rows.find((r) => r.id === "d").name };
}
// 8. a Mac: click and hold on a card of one, dragged down, let go: moved; its click goes nowhere; a press moved more than 4 before the hold's end lifts nothing; a release lost outside the window takes it back
scene();
{ const li = liOf("d"), [x, y] = mid(li);
  mouse("pointerdown", li, x, y); await advance(410); const lift = st() && st().lifted;
  await mglide(li, x, y, 280); mouse("pointerup", li, x, y + 280); const clk = click(li); await advance(250);
  out.mouse = { lift, order: order(), eaten: !!clk.stoppedAll };
}
scene();
{ const li = liOf("d"), [x, y] = mid(li);
  mouse("pointerdown", li, x, y); await advance(100); mouse("pointermove", li, x, y + 6); await advance(400);
  out.mouseMoved = { state: st() }; mouse("pointerup", li, x, y + 6); await advance(50);
  const li2 = liOf("g"), [x2, y2] = mid(li2);
  mouse("pointerdown", li2, x2, y2); await advance(410); await mglide(li2, x2, y2, -120, 4); mouse("pointermove", li2, x2, y2 - 120, { buttons: 0 }); await advance(400);
  out.mouseLost = { state: st(), order: order().join(" | ") === LEGS().map((r) => r.label + " " + r.id).join(" | ") };
}
// 9. held near the screen's foot, the page scrolls on under it, and the place under the finger follows
scene();
{ const li = liOf("d"), [x, y] = mid(li);
  tdown(li, x, y); await advance(410); await tglide(0, 860 - y, 10); const sy0 = SY; await advance(400);
  out.auto = { scrolled: SY > sy0, sy: SY, to: st().to }; tup(); await advance(300); out.auto.order = order();
}
// 10. Done: the page as it was, with the new order; the Reorder look gone
scene();
{ scrollTo0(380); const grip = inside(blockOf("5"), "ro-move"), [x, y] = mid(grip);
  tdown(grip, x, y); await advance(410); await tglide(0, -820, 14); tup(); await advance(300);
  fns.doneOrder();
  out.done = { on: fns.exOrderOn(), roBlocks: blocks().length, cards: rowsEl.children.filter((b) => has(b, "block")).length, body: has(document.body, "ro-on"), order: order().slice(0, 4) };
  fns.startOrder("w1"); fns.go({ name: "client", id: "c1" }); out.done.gone = fns.roOrdering();   // Back, or any other page: over
}
// 11. a warm-up stays first: its card has no grip of its own, its exercises move inside it; a card of words has none either, and a hold on it lifts nothing
scene([RW("wa", "Wa", "Bike", 1), RW("wb", "Wb", "Band pull-apart", 1), RW("a", "1", "Squat"), RW("b", "2", "Bench press"), RW("f", "Finisher", "Farmer carry", 2)]);
{ const grips = blocks().map((b) => b.dataset.key + ":" + (inside(b, "ro-move") ? "grip" : "none")).join(" ");
  const li = liOf("wb"), [x, y] = mid(li); tdown(li, x, y); await advance(410); const k = st() && st().kind; await tglide(0, -60); tup(); await advance(300);
  const lf = liOf("f"), [fx, fy] = mid(lf); tdown(lf, fx, fy); await advance(410); const words = st(); tup(); await advance(50);
  const la = liOf("b"), [ax, ay] = mid(la); tdown(la, ax, ay); await advance(410); await tglide(0, -400); tup(); await advance(300);
  out.warm = { grips, kind: k, words, order: order() };
}
// 12. the keyboard or VoiceOver (a click with no count) on a grip: Move up, Move down; a pointer's tap on it: nothing
scene();
{ const grip = inside(blockOf("3"), "ro-move");
  click(grip); const tap = { open: !whenBg.hidden };
  send("click", grip, { detail: 0 }); const rows = pop.children.filter((c) => has(c, "wopt")).map((c) => c.textContent);
  out.keys = { tap, open: !whenBg.hidden, rows };
  send("keydown", document.body, { key: "Escape" }); await advance(50);
}
// 13. a template: the move waits in its draft (Unsaved changes), with no claim
scene(null, { tpl: true });
{ const li = liOf("s"), [x, y] = mid(li); tdown(li, x, y); await advance(410); await tglide(0, -500); tup(); await advance(300);
  const td = app.get().templateDraft; out.tpl = { order: order().slice(0, 2), draft: !!(td && td.dirty), claimed: claimed() };
}
// 14. Reduce Motion: it lands at once
scene();
{ const mm = globalThis.matchMedia; globalThis.matchMedia = (q) => ({ matches: /reduce/.test(q), addEventListener() {}, removeEventListener() {} });
  const li = liOf("g"), [x, y] = mid(li); tdown(li, x, y); await advance(410); const tr = blockOf("3").style.transition; await tglide(0, -200); tup(); await advance(20);
  out.calm = { tr, order: order().slice(0, 3) };
  globalThis.matchMedia = mm;
}
// 15. in the middle of a workout (his rule: only exercises not done or started move): Deadlift finished and Banded glute kickback begun keep their places, numbers
//     and grey names, with no grip; a hold on them lifts nothing; the tri-set held by its grip and taken up past the begun card lands in the superset's place, the begun
//     card shifting down by the height that changed above it (234 for 176) and keeping its 3
{ const rows = LEGS(); Object.assign(rows[0], { done: true, setsDone: 4, weights: ["185", "185", "185", "185"], repsDone: ["6", "6", "6", "6"] }); Object.assign(rows[3], { setsDone: 1, weights: ["BW"], repsDone: ["15"] });
  scene(rows);
  const look = blocks().map((b) => b.dataset.key + ":" + (inside(b, "ro-move") ? "grip" : "none") + (has(b, "ro-fixed") ? ":fixed" : "") + ":" + findAll(b, ".ro-sum")[0].children[0].textContent).join(" | ");
  const d = liOf("d"), [dx, dy] = mid(d); tdown(d, dx, dy); await advance(410); const onDone = st(); tup(); await advance(50);
  const g = liOf("g"), [gx, gy] = mid(g); tdown(g, gx, gy); await advance(410); const onBegun = st(); tup(); await advance(50);
  scrollTo0(300); const grip = inside(blockOf("5"), "ro-move"), [x, y] = mid(grip);
  tdown(grip, x, y); await advance(410); await tglide(0, -560, 10); const during = { to: st().to, b3: blockOf("3").style.transform, b1: blockOf("1").style.transform }; tup(); await advance(300);
  out.begun = { look, onDone, onBegun, during, order: order() };
}
// 16. the swipe's Delete is the trash alone (his ask: "only delete icon to ensure it fits")
scene();
{ const li = liOf("y"), act = inside(li, "sa-del"); out.trash = { label: /sa-lbl|>Delete</.test(act.innerHTML) ? "word" : "none", aria: act.getAttribute("aria-label"), cap: /^<span class="sa-cap"><svg class="mi"[^]*<\/svg><\/span>$/.test(act.innerHTML) }; }   // (the stand-ins keep written markup as text)
// 17. one card left not begun: it has nowhere to go, so no grip of its own (its exercises still move inside it, by theirs)
{ const rows = LEGS(); for (const r of rows.slice(0, 5)) Object.assign(r, { done: true, setsDone: r.sets, weights: Array(r.sets).fill("100"), repsDone: Array(r.sets).fill("8") });
  scene(rows); const b5 = blockOf("5");
  out.lastOne = { cardGrip: !!inside(b5, "ro-move"), rowGrips: findAll(b5, ".ro-grip").length, others: blocks().filter((b) => b !== b5 && inside(b, "ro-move")).length };
}
// 18. from his Client view (his ask: "from both clients and coaches view"): the same Reorder, the drag the same, and Done back in his Client view
scene();
{ fns.setPreview(true); fns.render(); const look = { on: fns.exOrderOn(), client: has(document.body, "client"), cards: blocks().length };
  const li = liOf("d"), [x, y] = mid(li); tdown(li, x, y); await advance(410); await tglide(0, 300); tup(); await advance(300);
  const moved = order().slice(0, 3); fns.doneOrder();
  out.clientView = { look, moved, after: { on: fns.exOrderOn(), client: has(document.body, "client"), preview: fns.previewOn(), roBlocks: blocks().length } };
  fns.setPreview(false);
}
// 19. Done tapped during the glide: the move is kept (it was written as it was let go: the v314 review)
scene();
{ const li = liOf("d"), [x, y] = mid(li); tdown(li, x, y); await advance(410); await tglide(0, 300); tup(); await advance(60); fns.doneOrder(); await advance(300);
  out.doneMidGlide = { on: fns.exOrderOn(), order: order().slice(0, 3), dirty: maps.dirty.has("trainings/w1") };
}
// 20. finished (his, or a sync's) while in Reorder: it ends, and an Undo does not bring it back by itself
scene();
{ const t = maps.trainings.get("w1"); t.completedAt = "2026-11-17T18:00:00.000Z"; fns.render(); const ended = fns.exOrderOn();
  delete t.completedAt; t.completedAt = null; fns.render();
  out.finishUndo = { ended, back: fns.exOrderOn(), roBlocks: blocks().length };
}
// 21. the keyboard's place: picked from the keyboard, Reorder starts on Done; Done from the keyboard puts it back on the "…"
await advance(500); scene(); fns.doneOrder();                       // (the last scene's release window long over, as a new press would end it)
{ const item = fns.moreItems(maps.trainings.get("w1")).find((it) => it.label === "Reorder"); document.activeElement = null;
  item.onPick({ isTrusted: true, detail: 0 }); const atStart = document.activeElement && document.activeElement.id;
  send("click", byId.get("navDone"), { detail: 0 }); const atEnd = document.activeElement && document.activeElement.id;
  out.keysPlace = { atStart, atEnd, on: fns.exOrderOn() };
}
// 22. a press during the last drop's glide: it starts its own hold; the landing draws the cards anew under it, and at its lift the same card is found again and moves
await advance(500); scene();
{ const li = liOf("d"), [x, y] = mid(li); tdown(li, x, y); await advance(410); await tglide(0, 300); tup(); await advance(40);
  const g = liOf("g"), [gx, gy] = mid(g); tdown(g, gx, gy); await advance(420); const lifted = st() && st().lifted; const claimed2 = tmove(gx, gy - 4).defaultPrevented; await tglide(0, -400); tup(); await advance(300);
  out.pressInGlide = { lifted, claimed: claimed2, order: order().slice(0, 4) };   // (its row drawn anew under it: its touch reaches only the old row, whose own listener must claim it)
}
// 23. a row swiped during the last drop's glide is not drawn out from under its finger: the swipe opens, and the cards are drawn after
await advance(500); scene();
{ const li = liOf("d"), [x, y] = mid(li); tdown(li, x, y); await advance(410); await tglide(0, 300); tup(); await advance(30);
  const row = liOf("y"), [rx, ry] = mid(row); tdown(row, rx + 60, ry); await advance(16); tmove(rx + 50, ry); await advance(16); tmove(rx + 20, ry); await advance(16); tmove(rx - 30, ry); await advance(200);
  const midSwipe = { same: liOf("y") === row && row.isConnected, held: !!(fns.rowSwipe() && fns.rowSwipe().li !== null), dropped: blocks()[0].style.transform !== "" };   // (the dropped Deadlift rests where its glide left it, not back on top: the final check)
  tmove(rx - 60, ry); tup(); await advance(500);
  out.swipeInGlide = { midSwipe, open: !!(fns.rowSwipe() && fns.rowSwipe().open), order: order().slice(0, 3) };
}
// 24. a template with Unsaved changes: the band that scrolls the page sits above that bar, not under it (the v314 review)
await advance(500); scene(null, { tpl: true });
{ draftBar.hidden = false; const li = liOf("d"), [x, y] = mid(li); tdown(li, x, y); await advance(410); await tglide(0, 760 - y, 8); const sy0 = SY; await advance(300);
  out.tplBand = { scrolled: SY > sy0 }; tup(); await advance(300); draftBar.hidden = true;
}
// 25. the keyboard's Delete (a grip's menu): after Cancel the place is back on that grip, after Delete on the next exercise's (the v314 final check)
await advance(500); scene();
{ const focusedRow = () => { const a = document.activeElement; const li = a && a.closest ? a.closest("li.ro-ex") : null; return a && has(a, "ro-grip") && li ? li.dataset.id : (a && a.id) || null; };
  const pickDelete = async () => { const grip = inside(liOf("y"), "ro-grip"); grip.focus(); send("click", grip, { detail: 0 }); await advance(20); const del = pop.children.find((c) => has(c, "wopt") && c.textContent === "Delete"); send("click", del, { detail: 0 }); await advance(400); };
  await pickDelete(); const asked = !askSheet.hidden; send("click", no, { detail: 0 }); await advance(60);
  const afterCancel = { asked, place: focusedRow(), kept: !!liOf("y") };
  await pickDelete(); send("click", yes, { detail: 1 }); await advance(60);
  out.keyDelete = { afterCancel, place: focusedRow(), gone: !liOf("y"), order: order().slice(5) };
}
// 26. a sync ends Reorder (her finish) while its Delete question is up: after the answer the page is drawn as it now is, its Reorder cards gone (the v314 final check)
await advance(500); scene();
{ const p = fns.roDelete("w1", "y"); await advance(400); const t = maps.trainings.get("w1"); t.completedAt = "2026-11-17T18:00:00.000Z"; app.set({ asking: true }); fns.render(); app.set({ asking: true });
  send("click", no, { detail: 1 }); await p; await advance(60);
  out.endedUnderQuestion = { on: fns.exOrderOn(), roBlocks: blocks().length, kept: maps.trainings.get("w1").rows.some((r) => r.id === "y") };
}
// 27. a finger resting on a row during a drop's glide, then lifted: the row engine lets that touch go, so a sync's redraw is not held off (the final check)
await advance(500); scene();
{ const li = liOf("d"), [x, y] = mid(li); tdown(li, x, y); await advance(410); await tglide(0, 300); tup(); await advance(40);
  const row = liOf("y"), [rx, ry] = mid(row); tdown(row, rx, ry); await advance(250); tup(); await advance(50);
  const before = blocks()[0]; const { ui } = await import("../app/state.js"); maps.trainings.get("w1").rows.find((r) => r.id === "s").name = "Back squat"; ui.render(); await advance(20);
  out.restingFinger = { redrawn: blocks()[0] !== before, name: !!made.find((x) => has(x, "ro-name") && x.textContent === "Back squat" && x.isConnected) };
}
// 28. the keyboard's Delete leaving nothing more to move (two cards of one, one deleted): the place goes to Done (the final check)
await advance(500); scene([RW("a", "1", "Squat"), RW("b", "2", "Bench press")]);
{ const grip = inside(blockOf("2"), "ro-move"); grip.focus(); send("click", grip, { detail: 0 }); await advance(20);
  const del = pop.children.find((c) => has(c, "wopt") && c.textContent === "Delete"); send("click", del, { detail: 0 }); await advance(400); send("click", yes, { detail: 1 }); await advance(60);
  out.lastDelete = { place: document.activeElement && document.activeElement.id, rows: maps.trainings.get("w1").rows.map((r) => r.label + " " + r.id) };
}
await new Promise((r) => setImmediate(r));
out.rejected = rejected;
console.log(JSON.stringify(out));
process.exit(0);
