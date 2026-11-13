// Run by alternatives.test.js in its own process: an exercise's alternatives as Apple's pop-up button (his pick, 13 Nov: "Pop-up on the
// name"): the client's name with its chevrons, the coach's chevrons at the end of the name field, the menu with its tick and its line, and
// the coach's Alternatives sheet (the red minus, Delete, Add alternative and the names to pick). Every element the app makes keeps its
// children, its listeners and what it looks up; every timer runs on this probe's own clock; it prints, as JSON, what each step showed.
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
const find = (root, sel) => { for (const c of root.children || []) { if (anyOf(c, sel)) return c; const d = c && typeof c === "object" ? find(c, sel) : null; if (d) return d; } return null; };
const findAll = (root, sel, out = []) => { for (const c of root.children || []) { if (anyOf(c, sel)) out.push(c); if (c && typeof c === "object") findAll(c, sel, out); } return out; };
const PART_TAG = (sel) => (/(^|\s)\.(name|label|reps|rest|tempo|w|rp|vid-url|note-field)$/.test(sel) ? "input" : /(btn|-pop|addname|vid-edit|vid-save|vid-remove|vid-cancel|fold-btn)$/.test(sel) ? "button" : "div");
function mk(tag) {
  const e = el(tag);
  e.children = []; e.parent = null; e.H = {}; e.attrs = {}; e.qs = {}; e.html = ""; e.removed = false; e.inert = false; e.cs = null; e.rect = null;
  const cl = { add: (...c) => { const k = classesOf(e); for (const x of c) k.add(x); e.className = [...k].join(" "); e.classes = new Set(); }, remove: (...c) => { const k = classesOf(e); for (const x of c) k.delete(x); e.className = [...k].join(" "); e.classes = new Set(); },
    toggle: (c, f) => { const on = f === undefined ? !classesOf(e).has(c) : !!f; (on ? cl.add : cl.remove)(c); return on; }, contains: (c) => classesOf(e).has(c) }; e.classList = cl;   // one list of classes, as a page has (its className and its classList the same)
  const st = {}; st.setProperty = (k, v) => { st[k] = v; }; st.removeProperty = (k) => { delete st[k]; }; st.getPropertyValue = (k) => st[k] || ""; e.style = st;
  const adopt = (c) => { if (c && typeof c === "object") { if (c.parent && c.parent !== e) c.parent.children = c.parent.children.filter((x) => x !== c); c.parent = e; } return c; };
  e.replaceChildren = (...k) => { for (const c of e.children) if (c && typeof c === "object") c.parent = null; e.children = []; for (const c of k) { adopt(c); e.children.push(c); } };
  e.appendChild = (c) => { adopt(c); e.children.push(c); return c; };
  e.append = (...k) => { for (const c of k) e.appendChild(c); };
  e.prepend = (...k) => { for (const c of [...k].reverse()) { adopt(c); e.children.unshift(c); } };
  e.after = (...k) => { const p = e.parent; if (!p) return; let i = p.children.indexOf(e); for (const c of k) { if (c && typeof c === "object") { if (c.parent) c.parent.children = c.parent.children.filter((x) => x !== c); c.parent = p; } i = p.children.indexOf(e) + (k.indexOf(c)) + 1; p.children.splice(i, 0, c); } };
  e.remove = () => { e.removed = true; if (e.parent) { e.parent.children = e.parent.children.filter((x) => x !== e); e.parent = null; } };
  e.contains = (x) => { for (let n = x; n && MK.has(n); n = n.parent) if (n === e) return true; return false; };
  e.setAttribute = (k, v) => { e.attrs[k] = String(v); }; e.getAttribute = (k) => (k in e.attrs ? e.attrs[k] : null); e.removeAttribute = (k) => { delete e.attrs[k]; }; e.hasAttribute = (k) => k in e.attrs;
  e.addEventListener = (t, fn) => { (e.H[t] ||= []).push(fn); }; e.removeEventListener = (t, fn) => { const a = e.H[t] || []; const i = a.indexOf(fn); if (i >= 0) a.splice(i, 1); };
  e.focus = (o) => { document.activeElement = e; e.focusedWith = o || null; }; e.blur = () => { if (document.activeElement === e) document.activeElement = document.body; };
  e.insertAdjacentHTML = (pos, h) => { e.html = /^(afterbegin|beforebegin)$/.test(pos) ? h + e.html : e.html + h; const m = /^<(\w+)[^>]*\bclass="([^"]+)"/.exec(h); if (m) { const c = mk(m[1]); c.className = m[2]; if (/^(afterbegin)$/.test(pos)) e.prepend(c); else e.appendChild(c); } };   // the icon it holds, as an element of its own
  e.closest = (sel) => { if (sel === ".chip") { const c = mk("div"); c.innerHTML = "chip"; return c; } for (let n = e; n && MK.has(n); n = n.parent) if (anyOf(n, sel)) return n; return null; };
  e.querySelector = (sel) => {                                             // the markup the app wrote into it: each part by its selector, the same part each time
    const f = find(e, sel); if (f) return f; if (!e.innerHTML) return null;
    const nh = /:not\(\[hidden\]\)$/.test(sel), base = sel.replace(/:not\(\[hidden\]\)$/, "");
    let p = e.qs[base]; if (!p) { p = mk(PART_TAG(base)); p.className = base.split(/\s+/).pop().split(".").filter(Boolean).join(" "); p.parent = e; e.qs[base] = p; }
    return nh && p.hidden ? null : p;
  };
  e.querySelectorAll = (sel) => (sel === ".specs .chip" ? [0, 1].map(() => { const c = mk("div"); c.innerHTML = "chip"; return c; }) : findAll(e, sel));
  e.getBoundingClientRect = () => e.rect || { top: 0, bottom: 0, left: 0, right: 0, width: 0, height: 0 };
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
const app = (await import("../app/main.js")).internals();
const { fns, maps } = app;
// ---------- a workout of four exercises: Leg press with two alternatives, Plank with none, Calf raise with only itself, a subtitled Lunge with a blank and one ----------
const R = (id, label, name, alts, extra = {}) => ({ id, label, name, sets: 1, reps: "12", rest: "60 sec", tempo: "", weights: [], repsDone: [], setsDone: 0, done: false, note: "", alts, ...extra });
function seed({ client = false, finished = false, preview = false, rows = null } = {}) {
  app.reset(); fns.setPreview(false); made.length = 0; rowsEl.replaceChildren();
  app.set({ signedIn: true, clientMode: client, myClientId: client ? "c1" : null, tab: "workouts" });
  maps.clients.set("c1", { id: "c1", name: "Jane", unit: "lb" });
  maps.trainings.set("t1", { id: "t1", clientId: "c1", title: "Legs", date: today(), createdAt: "2026-11-01T10:00:00.000Z", completedAt: finished ? "2026-11-01T11:00:00.000Z" : null, skippedAt: null,
    rows: rows || [R("a", "1", "Leg press", ["Hack squat", "Goblet squat"]), R("b", "2", "Plank", []), R("c", "3", "Calf raise", ["Calf raise"]), R("d", "4", "Lunge (walking)", ["", "Split squat"])] });
  byId.get("whenPop").replaceChildren(); fns.setPreview(preview); app.set({ view: { name: "training", id: "t1" }, renderedTraining: null }); fns.render();
  byId.get("whenPop").offsetWidth = 250; byId.get("whenPop").offsetHeight = 180; whenBg.hidden = true;
}
const rowOf = (id) => made.filter((x) => x.className === "row" && x.dataset && x.dataset.id === id).pop() || null;
const popOf = (id) => made.filter((x) => classesOf(x).has("name-pop") && x.parent && x.parent.dataset && x.parent.dataset.id === id).pop() || null;
const text = (n) => (typeof n === "string" ? n : n && typeof n === "object" ? String(n.textContent || "") + (n.children || []).map(text).join("") : "");   // its own words, then its children's (a word and the icon after it)
const menu = () => byId.get("whenPop").children.map((b) => (classesOf(b).has("msep") ? "—" : (b.attrs["aria-current"] === "true" ? "✓ " : "") + text(b.children.find((c) => c.tagName === "SPAN"))));
const menuLook = () => { const p = byId.get("whenPop"); return { open: !whenBg.hidden, rows: menu(), classes: ["menu", "checks", "hung", "above"].filter((c) => p.classList.contains(c)), left: p.style.left, top: p.style.top,
  tick: p.children.filter((b) => /class="ck"/.test(b.html || "")).map((b) => text(b.children.find((c) => c.tagName === "SPAN"))), seps: p.children.filter((b) => classesOf(b).has("msep")).map((b) => b.attrs.role || null) }; };
const pick = (label, extra = {}) => { const b = byId.get("whenPop").children.find((x) => !classesOf(x).has("msep") && text(x.children.find((c) => c.tagName === "SPAN")) === label); return b ? fire(b, "click", extra) : null; };
const sheet = () => ({ open: !altSheet.hidden, lead: byId.get("altLead").textContent, rows: altRows.children.map((li) => {
  const k = classesOf(li);
  if (k.has("alt-row")) { const minus = li.children[0], del = li.children[2]; return text(li.children[1]) + (del.hidden ? "" : " [Delete]") + (minus.attrs["aria-expanded"] === "true" ? " (open)" : ""); }
  if (k.has("alt-add")) { const f = li.children.find((c) => classesOf(c).has("alt-field")); return f ? "+ [" + (f.value || "") + "]" + (document.activeElement === f ? " (typing)" : "") : "+ " + text(li.children[0]); }
  if (k.has("alt-hit")) return "· " + text(li.children[0]);
  return "?" + li.className; }) });
const altsOf = (rid) => [...(maps.trainings.get("t1").rows.find((r) => r.id === rid).alts || [])];
const dirtyNow = () => maps.dirty.has("trainings/t1");
const field = () => { const li = altRows.children.find((x) => classesOf(x).has("alt-add")); return li ? li.children.find((c) => classesOf(c).has("alt-field")) || null : null; };
const minusOf = (name) => { const li = altRows.children.find((x) => classesOf(x).has("alt-row") && text(x.children[1]) === name); return li ? li.children[0] : null; };
const delOf = (name) => { const li = altRows.children.find((x) => classesOf(x).has("alt-row") && text(x.children[1]) === name); return li ? li.children[2] : null; };
const addBtn = () => { const li = altRows.children.find((x) => classesOf(x).has("alt-add")); return li && li.children[0] && li.children[0].tagName === "BUTTON" ? li.children[0] : null; };
const hits = () => altRows.children.filter((x) => classesOf(x).has("alt-hit")).map((x) => text(x.children[0]));
const inertNow = () => [main, header, whenBg].map((x) => !!x.inert);
const out = {};

// ---------- the menu itself: a tick column, a line between groups, over its button ----------
{ seed();
  const a = mk("button"), picked = [];
  fns.showMenu(a, [{ label: "Never", checked: true, onPick: (e) => picked.push(["Never", e.detail]) }, { label: "Every day", checked: false, onPick: () => picked.push(["Every day"]) }, { label: "Edit", sep: true, onPick: () => picked.push(["Edit"]) }], { over: true, align: "left", rect: { left: 40, right: 360, top: 300, bottom: 344, width: 320, height: 44 } });
  out.menu = menuLook();
  fns.showMenu(a, [{ label: "Never", checked: true, onPick: () => {} }, { label: "Later", onPick: () => {} }], { over: true, align: "right", rect: { left: 300, right: 360, top: 760, bottom: 804, width: 60, height: 44 } });
  out.menuLow = menuLook();                                               // no room under it: up from the button's foot
  byId.get("whenPop").offsetHeight = 900;
  fns.showMenu(a, [{ label: "Never", checked: true, onPick: () => {} }], { over: true, align: "left", rect: { left: 40, right: 360, top: 300, bottom: 344, width: 320, height: 44 } });
  out.menuTall = menuLook();                                              // taller than the screen: from the top margin
  byId.get("whenPop").offsetHeight = 180; byId.get("ctxDim").cs = { paddingTop: "62px", paddingBottom: "34px" };
  fns.showMenu(a, [{ label: "Never", checked: true, onPick: () => {} }], { over: true, align: "left", rect: { left: 40, right: 360, top: 700, bottom: 744, width: 320, height: 44 } });
  out.menuSafe = menuLook();                                              // the home indicator's room kept: 874 - 34 - 8 = 832 is the floor
  fns.showMenu(a, [{ label: "Never", checked: true, onPick: () => {} }], { over: true, align: "left", rect: { left: 40, right: 360, top: 670, bottom: 714, width: 320, height: 44 } });
  out.menuSafe2 = menuLook().top;                                          // 670 + 180 = 850: past 832, short of 866: up, foot at the button's
  byId.get("ctxDim").cs = null;
  fns.showMenu(a, [{ label: "Copy", onPick: () => {} }, { label: "Delete", danger: true, sep: true, onPick: () => {} }], { align: "right" });
  out.menuPlain = menuLook();                                             // no choice in it: no tick column (a line still parts its groups)
  fns.showMenu(a, [{ label: "Never", checked: true, onPick: (e) => picked.push(["Never", e.detail]) }, { label: "Every day", checked: false, onPick: () => picked.push(["Every day"]) }], { over: true, align: "left", rect: { left: 40, right: 360, top: 300, bottom: 344, width: 320, height: 44 } });
  const ev = pick("Never", { detail: 0 }); out.menuPick = { picked, closed: whenBg.hidden, stopped: !!ev && ev.stopped };
  fns.showMenu(a, [{ label: "Lead", sep: true, onPick: () => {} }, { label: "Next", onPick: () => {} }], {});
  out.menuFirstSep = menu();                                               // a line never opens a menu
  whenBg.hidden = true;
}

// ---------- the coach: chevrons at the end of the field where there are alternatives; the menu from them; a swap ----------
{ seed();
  const vis = (id) => { const r = rowOf(id), p = r && r.qs[".alt-pop"], w = r && r.qs[".top .exwrap"]; return { pop: !!p && !p.hidden, wrap: !!w && w.classList.contains("has-pop") }; };
  out.coachChevrons = { a: vis("a"), b: vis("b"), c: vis("c"), d: vis("d"), clientPops: made.filter((x) => classesOf(x).has("name-pop")).length };
  const p = rowOf("a").qs[".alt-pop"], chev = mk("span"); chev.rect = { left: 330, right: 339, top: 446, bottom: 459, width: 9, height: 13 }; p.innerHTML = "x"; p.qs[".pop-chev"] = chev;
  const down = fire(p, "mousedown"); const ev = fire(p, "click");
  out.coachMenu = { ...menuLook(), stopped: ev.stopped, keptFocus: down.defaultPrevented };
  const t = maps.trainings.get("t1"); maps.dirty.clear();
  pick("Goblet squat");
  const a = t.rows.find((r) => r.id === "a");
  out.coachSwap = { name: a.name, alts: [...a.alts], named: !!(maps.trainerNamed.get("t1") && maps.trainerNamed.get("t1").has("a")), saved: dirtyNow(), closed: whenBg.hidden, pending: maps.pendingSwap.has("t1"), redrawn: rowOf("a") !== null && rowOf("a").qs[".alt-pop"] !== p };
  const p2 = rowOf("a").qs[".alt-pop"]; fire(p2, "click");
  out.coachMenuAfter = menu();                                             // the tick on the one in effect now, the one it replaced among the alternatives
  pick("Goblet squat");
  out.coachCheckedPick = { name: t.rows.find((r) => r.id === "a").name, closed: whenBg.hidden };   // the ticked one: the menu closes, nothing changes
}

// ---------- the client: the name is the pop-up button, its last word and the chevrons together; the menu without Edit; a swap waits for the sync ----------
{ seed({ client: true });
  const v = popOf("a"), d = popOf("d");
  const look = (n) => n && { tag: n.tagName, type: n.type || null, popup: n.attrs["aria-haspopup"] || null, hiddenFromReader: n.attrs["aria-hidden"] || null, parts: n.children.map((c) => (typeof c === "string" ? c : c.className + ":" + text(c) + (/class="pop-chev"/.test(c.html || "") ? "+chev" : ""))) };
  out.clientName = { a: look(v), b: !!popOf("b"), c: !!popOf("c"), d: look(d), coachPops: [rowOf("a"), rowOf("b")].map((r) => !r.qs[".alt-pop"] || !!r.qs[".alt-pop"].hidden) };
  v.rect = { left: 32, right: 370, top: 380, bottom: 418, width: 338, height: 38 }; v.cs = { paddingLeft: "42px" };
  const ev = fire(v, "click");
  out.clientMenu = { ...menuLook(), stopped: ev.stopped };
  const t = maps.trainings.get("t1"); maps.dirty.clear();
  pick("Hack squat");
  const a = t.rows.find((r) => r.id === "a");
  out.clientSwap = { name: a.name, alts: [...a.alts], pending: maps.pendingSwap.has("t1") ? maps.pendingSwap.get("t1").get("a") : null, named: !!(maps.trainerNamed.get("t1") && maps.trainerNamed.get("t1").has("a")), saved: dirtyNow() };
  whenBg.hidden = true; const w = popOf("d"), chev = w.querySelector(".pop-chev"); if (chev) chev.cs = { display: "none" };   // a card still to come: the stylesheet hides its chevrons
  const ev2 = fire(w, "click");
  out.clientAhead = { chev: !!chev, opened: !whenBg.hidden, stopped: ev2.stopped };
}
{ seed({ client: true, finished: true }); out.clientLocked = { pops: made.filter((x) => classesOf(x).has("name-pop")).length }; }
{ seed({ preview: true });
  const v = popOf("a"); out.previewPop = !!v; if (v) { fire(v, "click"); out.previewMenu = menu(); }
  whenBg.hidden = true; }

// ---------- the coach's sheet ----------
const openSheet = async (keys = false) => { seed(); const r = rowOf("a"), p = r.qs[".alt-pop"]; fire(p, "click"); pick("Edit alternatives", { detail: keys ? 0 : 1, isTrusted: true }); return r; };
{ await openSheet();
  out.sheetOpen = { ...sheet(), menuClosed: whenBg.hidden, asking: !!app.get().asking, inert: inertNow(), focus: document.activeElement === altBox ? "sheet" : document.activeElement && document.activeElement.className };
  fire(minusOf("Hack squat"), "click"); out.minusOnce = sheet().rows;
  fire(minusOf("Hack squat"), "click"); out.minusTwice = sheet().rows;   // again: taken back
  fire(minusOf("Hack squat"), "click"); fire(minusOf("Goblet squat"), "click"); out.minusOther = sheet().rows;   // another's: only one Delete at a time
  fire(byId.get("altLead"), "click"); out.tapElsewhere = sheet().rows;   // anywhere else in the sheet: taken back
  fire(minusOf("Hack squat"), "click"); maps.dirty.clear();
  fire(delOf("Hack squat"), "click");
  out.deleted = { rows: sheet().rows, alts: altsOf("a"), saved: dirtyNow(), named: !!(maps.trainerNamed.get("t1") && maps.trainerNamed.get("t1").has("a")), open: !altSheet.hidden };
  fire(addBtn(), "click");
  out.adding = { rows: sheet().rows, focus: document.activeElement === field(), how: field() && field().focusedWith, attrs: field() && { placeholder: field().placeholder, max: field().maxLength, key: field().attrs.enterkeyhint, label: field().attrs["aria-label"] } };
  const f = field(); f.value = "rom"; fire(f, "input");
  const h1 = hits(); const st = h1.filter((n) => /^rom/i.test(n)); out.typed = { first: h1.slice(0, 3), n: h1.length, startsFirst: h1.slice(0, st.length).every((n) => /^rom/i.test(n)), shortestFirst: st.every((n, i) => !i || st[i - 1].length <= n.length), noTaken: !h1.includes("Leg press") && !h1.includes("Goblet squat") };
  f.value = "goblet"; fire(f, "input"); out.typedTaken = hits().filter((n) => n === "Goblet squat");   // the one already there is never offered
  f.value = "r"; fire(f, "input"); out.typedShort = hits().length;          // one letter: nothing yet
  f.value = "rom"; fire(f, "input"); const pickName = hits()[0]; maps.dirty.clear();
  const hitBtn = altRows.children.find((x) => classesOf(x).has("alt-hit")).children[0];
  const md = fire(hitBtn, "mousedown"); fire(hitBtn, "click");
  out.picked = { name: pickName, keptFocus: md.defaultPrevented, rows: sheet().rows, alts: altsOf("a"), saved: dirtyNow(), hits: hits().length };   // two now: the row to add one goes
  fire(byId.get("altDone"), "click");
}
{ const v0 = (VV.H.resize || []).length + (VV.H.scroll || []).length;
  await openSheet(); out.vvWatch = (VV.H.resize || []).length + (VV.H.scroll || []).length - v0; fire(minusOf("Hack squat"), "click"); fire(delOf("Hack squat"), "click"); fire(addBtn(), "click");
  const f = field(); f.value = "  band   face-pull "; const ent = fire(f, "keydown", { key: "Enter" });
  out.enterAlias = { alts: altsOf("a"), rows: sheet().rows, prevented: ent.defaultPrevented };   // an old spelling becomes the catalogue's own, spaces tidied
  fire(minusOf("Band face pull"), "click"); fire(delOf("Band face pull"), "click"); fire(addBtn(), "click");
  const g = field(); g.value = "LEG  press"; fire(g, "keydown", { key: "Enter" }); out.enterSelf = { alts: altsOf("a"), rows: sheet().rows };   // the exercise itself: not its own alternative
  fire(addBtn(), "click"); const h = field(); h.value = "goblet SQUAT"; fire(h, "keydown", { key: "Enter" }); out.enterDup = { alts: altsOf("a"), rows: sheet().rows };   // one it has: not twice
  fire(addBtn(), "click"); const k = field(); k.value = "   "; fire(k, "keydown", { key: "Enter" }); out.enterBlank = { alts: altsOf("a"), rows: sheet().rows };
  fire(addBtn(), "click"); const m = field(); m.value = "Sled push"; const esc = fire(m, "keydown", { key: "Escape" });
  out.escField = { alts: altsOf("a"), rows: sheet().rows, open: !altSheet.hidden, stopped: esc.stopped };   // Escape in the field: the row back, the sheet stays
  fire(addBtn(), "click"); const n = field(); document.activeElement = document.body; fire(n, "blur"); await advance(199); const before = sheet().rows; await advance(1);
  out.blurEmpty = { before, after: sheet().rows };                         // left empty: the row to add one again, 0.2 s on
  fire(addBtn(), "click"); const o = field(); o.value = "Sled"; document.activeElement = document.body; fire(o, "blur"); await advance(300);
  out.blurTyped = sheet().rows;                                            // left with words in it: kept
  fire(minusOf("Goblet squat"), "click"); out.minusWhileAdding = sheet().rows;   // a minus while typing: the field goes, the Delete shows
  fire(minusOf("Goblet squat"), "click"); fire(addBtn(), "click"); field().value = "Sled";
  const vvH = VV.H.resize || []; altBox.scrollHeight = 300; byId.get("ctxDim").cs = { paddingTop: "62px" }; VV.height = 500; for (const fn of vvH) fn(); out.kbLift = [altBox.style.paddingBottom, altRows.style.maxHeight];
  altBox.scrollHeight = 800; for (const fn of vvH) fn(); out.kbTight = altRows.style.maxHeight;   // no room: three rows still
  VV.height = 874; for (const fn of vvH) fn(); out.kbDown = [altBox.style.paddingBottom, altRows.style.maxHeight]; byId.get("ctxDim").cs = null; altBox.scrollHeight = 0;
  VV.height = 500; for (const fn of vvH) fn(); const capped = altRows.style.maxHeight; fire(byId.get("altDone"), "click"); out.kbClosed = { capped: !!capped, after: altRows.style.maxHeight }; VV.height = 874; await openSheet();   // closed with the keyboard up: no height left on the list
  fire(byId.get("altDone"), "click"); out.vvLeft = (VV.H.resize || []).length + (VV.H.scroll || []).length - v0;   // closed: its keyboard watch gone
}
{ const k0 = (L.keydown || []).length, c0 = (altBox.H.click || []).length + (altSheet.H.click || []).length + (byId.get("altDone").H.click || []).length;
  await openSheet(); fire(minusOf("Goblet squat"), "click");
  const e1 = fire(byId.get("altDone"), "keydown", { key: "Escape" }); out.escDelete = { rows: sheet().rows, open: !altSheet.hidden };   // Escape first takes the Delete back
  fire(byId.get("altDone"), "keydown", { key: "Escape" }); out.escClose = { open: !altSheet.hidden, asking: !!app.get().asking, inert: inertNow(), keyLeft: (L.keydown || []).length - k0, clicksLeft: (altBox.H.click || []).length + (altSheet.H.click || []).length + (byId.get("altDone").H.click || []).length - c0, rowsLeft: altRows.children.length };
}
{ const r0 = await openSheet(); await advance(100); fire(altSheet, "click"); out.bgEarly = !altSheet.hidden; await advance(250); fire(altSheet, "click"); out.bgLate = { open: !altSheet.hidden, redrawn: rowOf("a") !== r0 };   // nothing changed: the page is not drawn again   // the second tap of a double tap does not close it; a tap on the dim later does
}
{ await openSheet(); fire(byId.get("altDone"), "click"); out.done = { open: !altSheet.hidden, asking: !!app.get().asking }; }
{ await openSheet(true);
  out.keysOpen = { focus: document.activeElement && document.activeElement.className, on: document.activeElement === minusOf("Hack squat") };
  fire(byId.get("altDone"), "click"); const now = rowOf("a");
  out.keysBack = { focus: document.activeElement === now.qs[".alt-pop"] ? "chevrons" : document.activeElement === now.qs[".more-btn"] ? "more" : String(document.activeElement && document.activeElement.className) };
}
{ await openSheet(true); fire(minusOf("Hack squat"), "click"); fire(delOf("Hack squat"), "click"); fire(minusOf("Goblet squat"), "click"); fire(delOf("Goblet squat"), "click");
  fire(byId.get("altDone"), "click"); const now = rowOf("a");
  out.keysBackNone = { pop: !now.qs[".alt-pop"].hidden, focus: document.activeElement === now.qs[".more-btn"] ? "more" : String(document.activeElement && document.activeElement.className), alts: altsOf("a") };   // no alternatives left: no chevrons, so back on its "…"
}
{ await openSheet(); fns.askFirst({ title: "Something else?" }); out.otherAsk = { open: !altSheet.hidden }; }
{ await openSheet(); maps.trainings.get("t1").rows = maps.trainings.get("t1").rows.filter((r) => r.id !== "a"); fire(minusOf("Hack squat"), "click"); out.rowGone = { open: !altSheet.hidden, asking: !!app.get().asking }; }   // the exercise gone while it is up (a sync, another device): the sheet goes
// ---------- after the review: what is typed is kept by Done and the dim; Delete and Escape from the keyboard keep its place; the minus turns in place; a gone workout closes the sheet ----------
{ const r0 = await openSheet(); QSA.length = 0; fire(minusOf("Hack squat"), "click"); fire(delOf("Hack squat"), "click"); fire(addBtn(), "click"); field().value = "sled  push"; fire(byId.get("altDone"), "click");
  out.doneKeeps = { alts: altsOf("a"), open: !altSheet.hidden, redrawn: rowOf("a") !== r0, pop: !r0.qs[".alt-pop"].hidden, measured: QSA.includes("#rows textarea.name, #tTitle") };
  fns.render(); out.syncAfter = { redrawn: rowOf("a") !== r0 }; }   // the next sync with nothing new: the cards kept (the picture they stand for is the new one)   // kept, tidied; the row's chevrons as they are, the page not drawn again
{ await openSheet(); fire(minusOf("Hack squat"), "click"); fire(delOf("Hack squat"), "click"); fire(addBtn(), "click"); field().value = "Sled push"; await advance(400); fire(altSheet, "click");
  out.dimKeeps = { alts: altsOf("a"), open: !altSheet.hidden }; }
{ await openSheet(); fire(addBtn() || altBox, "click"); out.twoNoAdd = !addBtn();
  const li0 = altRows.children[0], m = minusOf("Hack squat"); fire(m, "click"); out.inPlace = { same: altRows.children[0] === li0 && minusOf("Hack squat") === m, rows: sheet().rows, cls: li0.classList.contains("del") };
  fire(m, "click"); out.inPlaceBack = { same: altRows.children[0] === li0, cls: li0.classList.contains("del"), rows: sheet().rows };
  fire(m, "click"); const d = delOf("Hack squat"); document.activeElement = d; fire(d, "click");
  out.keysDelete = { rows: sheet().rows, focus: document.activeElement === minusOf("Goblet squat") ? "next minus" : String(document.activeElement && document.activeElement.className) };
  fire(minusOf("Goblet squat"), "click"); const d2 = delOf("Goblet squat"); document.activeElement = d2; fire(d2, "click");
  out.keysDeleteLast = { rows: sheet().rows, focus: document.activeElement === addBtn() ? "add" : String(document.activeElement && document.activeElement.className) };
  fire(addBtn(), "click"); const f = field(); f.value = "Sled"; fire(f, "keydown", { key: "Escape" });
  out.keysEscape = { rows: sheet().rows, focus: document.activeElement === addBtn() ? "add" : String(document.activeElement && document.activeElement.className) };
  fire(byId.get("altDone"), "click"); }
{ await openSheet(); maps.trainings.delete("t1"); fire(minusOf("Hack squat"), "click"); out.goneDelete = { open: !altSheet.hidden, asking: !!app.get().asking }; }   // gone before the minus: the minus closes it
{ await openSheet(); fire(minusOf("Hack squat"), "click"); maps.trainings.delete("t1"); fire(delOf("Hack squat"), "click"); out.goneBetween = { open: !altSheet.hidden, asking: !!app.get().asking }; }   // gone between the minus and Delete: Delete closes it
{ seed(); const p = rowOf("a").qs[".alt-pop"]; fire(p, "click"); pick("Edit alternatives", { detail: 0, isTrusted: false });   // the touch and hold's slide picks its row with a script click: not the keyboard's
  out.scriptPick = document.activeElement === altBox ? "sheet" : String(document.activeElement && document.activeElement.className); fire(byId.get("altDone"), "click"); }
// ---------- the menu over its button with the keyboard up, and under the status bar; the number picker left alone; a sync's redraw under the open menu ----------
{ seed(); const a = mk("button"); byId.get("ctxDim").cs = { paddingTop: "62px", paddingBottom: "34px" }; VV.height = 500;
  fns.showMenu(a, [{ label: "Never", checked: true, onPick: () => {} }], { over: true, align: "left", rect: { left: 40, right: 360, top: 400, bottom: 444, width: 320, height: 44 } });
  out.overKeyboard = byId.get("whenPop").style.top;                       // 400 + 180 runs past the keyboard's top (500 - 8): up from the button's foot, 444 - 180
  VV.height = 874; fns.showMenu(a, [{ label: "Never", checked: true, onPick: () => {} }], { over: true, align: "left", rect: { left: 40, right: 360, top: 30, bottom: 74, width: 320, height: 44 } });
  out.overStatus = byId.get("whenPop").style.top;                         // a name scrolled up under the status bar: the menu under it, 62 + 8
  VV.offsetTop = 100; VV.height = 400; fns.showMenu(a, [{ label: "Never", checked: true, onPick: () => {} }], { over: true, align: "left", rect: { left: 40, right: 360, top: 120, bottom: 164, width: 320, height: 44 } });
  out.overScrolled = byId.get("whenPop").style.top;                       // the keyboard up and the view scrolled 100 down: under the status bar of what shows, 100 + 62 + 8
  VV.offsetTop = 0; VV.height = 874;
  byId.get("ctxDim").cs = null; whenBg.hidden = true; }
{ seed(); const r = rowOf("a"), np = r.qs[".numpick"]; np.hidden = false; fire(r.qs[".alt-pop"], "click"); out.numpick = !np.hidden; whenBg.hidden = true; }
{ seed(); const p = rowOf("a").qs[".alt-pop"]; fire(p, "click");
  const T = maps.trainings.get("t1"); T.rows = T.rows.map((x) => ({ ...x, alts: [...(x.alts || [])] }));   // a sync swaps in its own copy of the workout while the menu is open
  pick("Hack squat"); const now = maps.trainings.get("t1").rows.find((x) => x.id === "a"); out.syncedSwap = { name: now.name, alts: [...now.alts] }; }
{ seed(); const p = rowOf("a").qs[".alt-pop"]; fire(p, "click");
  const T = maps.trainings.get("t1"); T.rows = T.rows.map((x) => (x.id === "a" ? { ...x, alts: ["Goblet squat"] } : x));   // the sync's copy no longer has Hack squat among them
  pick("Hack squat"); const now = maps.trainings.get("t1").rows.find((x) => x.id === "a"); out.syncedGone = { name: now.name, alts: [...now.alts] }; }
{ seed(); const p = rowOf("a").qs[".alt-pop"]; fire(p, "click");
  const T = maps.trainings.get("t1"); T.rows = T.rows.map((x) => (x.id === "a" ? { ...x, name: "Hack squat", alts: ["Leg press", "Goblet squat"] } : x));   // the client swapped to Hack squat meanwhile (the server's rule)
  pick("Hack squat"); const now = maps.trainings.get("t1").rows.find((x) => x.id === "a"); out.syncedSame = { name: now.name, alts: [...now.alts] }; }
{ seed(); fire(rowOf("a").qs[".alt-pop"], "click"); const before = !whenBg.hidden; maps.trainings.get("t1").rows[1].reps = "15"; app.set({ renderedTraining: null }); fns.render();
  out.menuOnRebuild = { before, after: !whenBg.hidden }; }   // a sync rebuilds the cards: the menu hung from them goes
{ seed({ client: true, rows: [R("a", "1", "Dumbbell Supercalifragilisticexpialidocious", ["Plank"]), R("b", "2", "Plank", [])] });
  const v = popOf("a"); out.longWord = v && v.children.map((c) => (typeof c === "string" ? c : c.className + ":" + text(c))); }
// ---------- the client's name is a pop-up button only where its chevrons show; a folded finished card's name opens the card as a tap does ----------
{ seed({ client: true, rows: [R("a", "1", "Leg press", ["Hack squat"], { done: true, setsDone: 1, weights: ["100"], repsDone: ["12"] }), R("b", "2", "Plank", ["Side plank"]), R("d", "3", "Lunge (walking)", ["Split squat"])] });
  const st = (id) => { const v = popOf(id); return v && { popup: v.attrs["aria-haspopup"] || null, tab: v.tabIndex === -1 ? -1 : "default" }; };
  out.popLive = { doneFolded: st("a"), current: st("b"), ahead: st("d") };
  const blk = rowOf("a").closest(".block"), ch = popOf("a").querySelector(".pop-chev"); if (ch) ch.cs = { display: "none" }; fire(popOf("a"), "click");   // (the stylesheet hides a folded card's chevrons)
  out.popOpensCard = { open: !!blk && blk.classList.contains("open"), summary: !!blk && blk.classList.contains("summary"), still: st("a"), menu: !whenBg.hidden, disabled: popOf("a").attrs["aria-disabled"] || null, others: [popOf("b").attrs["aria-disabled"] || null, popOf("d").attrs["aria-disabled"] || null] };
}
// ---------- a keyboard's place: on the Delete a minus showed, back on its minus with Escape, on the row to add another after a name picked ----------
{ await openSheet(); const m = minusOf("Hack squat"); document.activeElement = m; fire(m, "click"); out.keysMinus = document.activeElement === delOf("Hack squat") ? "its Delete" : String(document.activeElement && document.activeElement.className);
  fire(document.activeElement, "keydown", { key: "Escape" }); out.keysEscDelete = { rows: sheet().rows, focus: document.activeElement === minusOf("Hack squat") ? "its minus" : String(document.activeElement && document.activeElement.className), open: !altSheet.hidden };
  fire(minusOf("Hack squat"), "click"); fire(delOf("Hack squat"), "click"); fire(addBtn(), "click"); const f = field(); f.value = "rom"; fire(f, "input");
  const hb = altRows.children.find((x) => classesOf(x).has("alt-hit")).children[0]; document.activeElement = hb; fire(hb, "click");
  out.keysPick = { rows: sheet().rows.length, focus: document.activeElement === minusOf(altsOf("a")[1]) ? "the new one's minus" : document.activeElement === addBtn() ? "add" : String(document.activeElement && document.activeElement.className) };
  fire(byId.get("altDone"), "click"); }
{ await openSheet(true); fire(minusOf("Hack squat"), "click"); fire(delOf("Hack squat"), "click"); fire(addBtn(), "click"); field().value = "Sled";
  const m = minusOf("Goblet squat"); document.activeElement = m; fire(m, "click");
  out.keysMinusFromField = { rows: sheet().rows, focus: document.activeElement === delOf("Goblet squat") ? "its Delete" : String(document.activeElement && document.activeElement.className) };
  fire(minusOf("Goblet squat"), "click"); fire(addBtn(), "click"); const f = field(); document.activeElement = minusOf("Goblet squat"); fire(f, "blur"); await advance(250);
  out.keysBlurRedraw = { rows: sheet().rows, focus: document.activeElement === minusOf("Goblet squat") ? "its minus" : String(document.activeElement && document.activeElement.className) };
  fire(addBtn(), "click"); const g = field(); g.value = "Sled push"; fire(g, "keydown", { key: "Enter" });
  out.keysReturn = { rows: sheet().rows, focus: document.activeElement === minusOf("Sled push") ? "the new one's minus" : document.activeElement === addBtn() ? "add" : String(document.activeElement && document.activeElement.className) };
  fire(byId.get("altDone"), "click"); }
{ await openSheet(); fire(minusOf("Hack squat"), "click"); fire(delOf("Hack squat"), "click"); fire(addBtn(), "click"); const g = field(); g.value = "Sled push"; fire(g, "keydown", { key: "Enter" });
  out.touchReturn = document.activeElement === altBox || document.activeElement === document.body || document.activeElement === g ? "let go" : String(document.activeElement && document.activeElement.className);   // a tap's sheet on the phone: Return lets the keyboard go, no ring on a button
  fire(byId.get("altDone"), "click"); }
// ---------- the "…" menu: Add or Edit alternatives opens the same sheet ----------
{ seed(); const mc = rowOf("c").qs[".more-btn"]; fire(mc, "click"); pick("Add alternatives", { detail: 0, isTrusted: true });
  out.ownName = { ...sheet(), focus: document.activeElement === addBtn() ? "add" : String(document.activeElement && document.activeElement.className) }; fire(byId.get("altDone"), "click");   // only its own name: none, Add alternatives; from the keyboard, on its first button
}
{ seed(); const typing = mk("input"); let blurred = false; typing.blur = () => { blurred = true; document.activeElement = document.body; }; document.activeElement = typing; document.body.classList.add("typing");
  const more = rowOf("b").qs[".more-btn"]; fire(more, "click"); out.moreNone = menu(); pick("Add alternatives"); out.letGo = { blurred, typingLook: document.body.classList.contains("typing") };
  out.moreOpened = { ...sheet(), focus: document.activeElement === altBox ? "sheet" : "?" };
  fire(addBtn(), "click"); const f = field(); f.value = "Side plank"; fire(f, "keydown", { key: "Enter" });
  out.moreAdded = { alts: altsOf("b"), rows: sheet().rows };
  fire(byId.get("altDone"), "click"); out.moreAfter = { pop: !rowOf("b").qs[".alt-pop"].hidden };   // drawn again: its chevrons now there
  fire(rowOf("b").qs[".more-btn"], "click"); out.moreSome = menu(); whenBg.hidden = true;
}
console.log(JSON.stringify(out));
