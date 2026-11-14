// Run by instructions.test.js in its own process: an exercise's instructions in a sheet (his ask, 13 Nov: "unify adding instructions .. make
// it coherent with the way all app work with adding things"; his pick the same day, after pictures: as New folder and Rename, Add or Save over
// Cancel). The "…" row opens it; nothing changes until Add or Save; Cancel, the dim and Escape keep what was there; the box saved empty takes
// the instructions off. The stand-ins are ramp-probe.mjs's (alternatives-probe.mjs's, with written text kept among the children).
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
const noteSheet = recorder("noteSheet", { hidden: true }), noteBox = recorder("noteBox"), noteField = recorder("noteField");   // the instructions sheet, as the markup holds it
for (const id of ["noteTitle", "noteLead", "noteOk", "noteNo"]) recorder(id);
noteSheet.appendChild(noteBox); noteBox.append(byId.get("noteTitle"), byId.get("noteLead"), noteField, byId.get("noteOk"), byId.get("noteNo")); noteSheet.firstElementChild = noteBox;
document.body.children = [main, header, whenBg, altSheet, noteSheet];
const app = (await import("../app/main.js")).internals();
const { fns, maps } = app;


const TPL = "00000000-0000-4000-8000-0000000000f1";
const R = (id, label, name, note) => ({ id, label, name, sets: 3, reps: "8-10", rest: "60 sec", tempo: "", weights: [], repsDone: [], setsDone: 0, done: false, note, alts: [] });
function seed() {
  app.reset(); fns.setPreview(false); made.length = 0; rowsEl.replaceChildren();
  app.set({ signedIn: true, clientMode: false, myClientId: null, tab: "workouts", templateDraft: null });
  maps.clients.set("c1", { id: "c1", name: "Jane", unit: "lb" });
  maps.trainings.set("t1", { id: "t1", clientId: "c1", title: "Legs", date: today(), createdAt: "2026-11-01T10:00:00.000Z", completedAt: null, skippedAt: null, rows: [R("a", "1", "Leg press", ""), R("b", "2", "Curl", "Elbows still")] });
  maps.trainings.set("t2", { id: "t2", clientId: TPL, title: "Week 1", createdAt: "2026-11-01T10:00:00.000Z", completedAt: null, skippedAt: null, rows: [R("a", "1", "Squat", "")] });
  app.set({ view: { name: "training", id: "t1" }, renderedTraining: null }); fns.render();
  noteSheet.hidden = true; maps.dirty.clear(); document.activeElement = null;
  for (const n of [main, header, whenBg, altSheet]) n.inert = false;
}
const rowOf = (id) => made.filter((x) => x.className === "row" && x.dataset && x.dataset.id === id).pop() || null;
const noteNow = (tid, id) => maps.trainings.get(tid).rows.find((r) => r.id === id).note;
const ok = byId.get("noteOk"), no = byId.get("noteNo");
const look = () => ({ open: !noteSheet.hidden, title: byId.get("noteTitle").textContent, lead: byId.get("noteLead").textContent, button: ok.textContent, value: noteField.value, off: !!ok.disabled, asking: !!app.get().asking, behind: main.inert === true && header.inert === true, focus: document.activeElement === noteField });
const type = (v) => { noteField.value = v; fire(noteField, "input"); };
const pick = (id, label, ev = {}) => { const items = rowOf(id)._ctx(); const it = items.find((x) => x.label === label); if (!it) return "no row " + label; it.onPick({ detail: 1, isTrusted: false, ...ev }); return it.label; };
const out = {};
{ seed();   // a new one from the "…": the sheet asks for words, Add waits for them, and nothing is saved before Add
  out.menu = rowOf("a")._ctx().map((x) => x.label);
  out.picked = pick("a", "Add instructions");
  out.addOpen = look(); await advance(400); out.addArmed = look();
  type("   "); out.spacesOnly = { off: !!ok.disabled }; fire(ok, "click"); out.spacesNotAdded = { open: !noteSheet.hidden, note: noteNow("t1", "a") };
  type("  Feet low on the platform.\nPush through the heels.  "); out.typed = { off: !!ok.disabled, saved: maps.dirty.has("trainings/t1"), note: noteNow("t1", "a") };
  fire(ok, "click"); out.added = { open: !noteSheet.hidden, note: noteNow("t1", "a"), saved: maps.dirty.has("trainings/t1"), asking: !!app.get().asking, behind: main.inert === true, focus: document.activeElement === noteField };
  out.menuAfter = rowOf("a")._ctx().map((x) => x.label);
}
{ seed();   // the double tap's second tap lands on nothing
  pick("a", "Add instructions"); type("Quick"); fire(ok, "click"); out.early = { open: !noteSheet.hidden, note: noteNow("t1", "a") };
  fire(noteSheet, "pointerdown"); fire(noteSheet, "click"); out.earlyDim = { open: !noteSheet.hidden };
  await advance(400); fire(ok, "click"); out.late = { open: !noteSheet.hidden, note: noteNow("t1", "a") };
}
{ seed();   // some there: Edit, Save; Cancel keeps them as they were
  out.picked2 = pick("b", "Edit instructions"); out.editOpen = look(); await advance(400); out.editArmed = { off: !!ok.disabled };
  type("Elbows still, slow down"); fire(no, "click"); out.cancelled = { open: !noteSheet.hidden, note: noteNow("t1", "b"), saved: maps.dirty.has("trainings/t1"), asking: !!app.get().asking, behind: main.inert === true };
  pick("b", "Edit instructions"); await advance(400); type("Elbows still, slow down"); fire(noteSheet, "pointerdown"); fire(noteSheet, "click"); out.dimmed = { open: !noteSheet.hidden, note: noteNow("t1", "b"), saved: maps.dirty.has("trainings/t1") };
  pick("b", "Edit instructions"); await advance(400); type("Changed"); fire(noteField, "keydown", { key: "Escape" }); out.escaped = { open: !noteSheet.hidden, note: noteNow("t1", "b"), saved: maps.dirty.has("trainings/t1") };
  pick("b", "Edit instructions"); await advance(400); type("Elbows still, slow down"); fire(ok, "click"); out.saved = { open: !noteSheet.hidden, note: noteNow("t1", "b"), saved: maps.dirty.has("trainings/t1") };
  maps.dirty.clear(); pick("b", "Edit instructions"); await advance(400); fire(ok, "click"); out.unchanged = { open: !noteSheet.hidden, saved: maps.dirty.has("trainings/t1") };
  pick("b", "Edit instructions"); await advance(400); type(""); out.emptyOff = { off: !!ok.disabled }; fire(ok, "click"); out.removed = { open: !noteSheet.hidden, note: noteNow("t1", "b"), saved: maps.dirty.has("trainings/t1") };
  out.menuRemoved = rowOf("b")._ctx().map((x) => x.label);
}
{ seed();   // the Mac's Command-Return adds; Return alone is a new line
  pick("a", "Add instructions"); await advance(400); type("Hold the top");
  const plain = fire(noteField, "keydown", { key: "Enter" }); out.returnKey = { open: !noteSheet.hidden, kept: plain.defaultPrevented };
  fire(noteField, "keydown", { key: "Enter", metaKey: true }); out.commandReturn = { open: !noteSheet.hidden, note: noteNow("t1", "a") };
}
{ seed();   // from the keyboard (VoiceOver too): the field takes it, and on closing its place is back on the exercise's "…"
  pick("a", "Add instructions", { detail: 0, isTrusted: true }); out.keysOpen = { focus: document.activeElement === noteField };
  fire(no, "click"); out.keysBack = { more: document.activeElement === rowOf("a").qs[".more-btn"] };
  pick("a", "Add instructions"); fire(no, "click"); out.tapBack = { more: document.activeElement === rowOf("a").qs[".more-btn"] };
}
{ seed();   // the keyboard up: the sheet's foot clears it; a small phone gets a shorter box, never shorter than three lines
  Object.defineProperty(noteField, "offsetHeight", { get: () => (noteField.style.maxHeight === "0px" ? 24 : 143), configurable: true });   // squeezed to nothing, a box keeps its padding
  const before = (VV.H.resize || []).length; pick("a", "Add instructions"); const during = (VV.H.resize || []).length; noteBox.scrollHeight = 300; VV.height = 874 - 336;
  for (const fn of VV.H.resize || []) fn(); out.liftRoomy = { pad: noteBox.style.paddingBottom, cap: noteField.style.maxHeight };
  noteBox.scrollHeight = 760; for (const fn of VV.H.resize || []) fn(); out.liftTight = { cap: noteField.style.maxHeight };
  noteBox.scrollHeight = 820; for (const fn of VV.H.resize || []) fn(); out.liftFloor = { cap: noteField.style.maxHeight };
  VV.height = 874; for (const fn of VV.H.resize || []) fn(); out.liftDown = { pad: noteBox.style.paddingBottom, cap: noteField.style.maxHeight };
  fire(no, "click"); out.liftGone = { pad: noteBox.style.paddingBottom, cap: noteField.style.maxHeight, added: during - before, left: (VV.H.resize || []).length - before };
}
{ seed();   // a template: the change waits in its draft, as every edit there
  app.set({ templateDraft: { id: "t2", snapshot: "{}", dirty: false, saving: false } });
  fns.editNote("t2", "a", false); await advance(400); type("Brace first"); fire(ok, "click");
  out.template = { note: noteNow("t2", "a"), draft: !!(app.get().templateDraft && app.get().templateDraft.dirty), saved: maps.dirty.has("trainings/t2") };
}
{ seed();   // the exercise gone under it (a sync): Save writes nowhere, and the sheet still closes
  fns.editNote("t1", "a", false); await advance(400); type("Lost"); maps.trainings.get("t1").rows = maps.trainings.get("t1").rows.filter((r) => r.id !== "a");
  fire(ok, "click"); out.gone = { open: !noteSheet.hidden, saved: maps.dirty.has("trainings/t1") };
  out.noRow = (() => { fns.editNote("t1", "zz", false); return !noteSheet.hidden; })();
}
{ seed();   // words selected with the mouse and let go past the sheet's edge: the click lands on the dim, and must not throw them away
  pick("b", "Edit instructions"); await advance(400); type("Elbows still, hips down");
  fire(noteField, "pointerdown"); fire(noteSheet, "click"); out.dragOut = { open: !noteSheet.hidden, value: noteField.value, note: noteNow("t1", "b") };
  fire(noteSheet, "pointerdown"); fire(noteSheet, "click"); out.tapDim = { open: !noteSheet.hidden, note: noteNow("t1", "b") };
}
{ seed();   // every way of closing takes away all it put up: nothing of an earlier sheet acts later
  const kids = () => ({ key: (L.keydown || []).length, resize: (VV.H.resize || []).length, scroll: (VV.H.scroll || []).length, input: (noteField.H.input || []).length, ok: (ok.H.click || []).length, no: (no.H.click || []).length, dim: (noteSheet.H.click || []).length, press: (noteSheet.H.pointerdown || []).length });
  const base = JSON.stringify(kids()); const left = {};
  const ways = { cancel: () => fire(no, "click"), dim: () => { fire(noteSheet, "pointerdown"); fire(noteSheet, "click"); }, escape: () => fire(noteField, "keydown", { key: "Escape" }), add: () => { type("Go slow"); fire(ok, "click"); }, command: () => { type("Go slower"); fire(noteField, "keydown", { key: "Enter", metaKey: true }); } };
  for (const [k, close] of Object.entries(ways)) { maps.trainings.get("t1").rows[0].note = ""; pick("a", "Add instructions"); await advance(400); close(); left[k] = noteSheet.hidden && JSON.stringify(kids()) === base; }
  out.cleanup = left;
  maps.trainings.get("t1").rows[0].note = ""; maps.dirty.clear();
  pick("a", "Add instructions"); await advance(400); type("Leg press words"); fire(no, "click");
  pick("b", "Edit instructions"); await advance(400); type("Curl words"); fire(noteField, "keydown", { key: "Enter", metaKey: true });
  out.others = { a: noteNow("t1", "a"), b: noteNow("t1", "b") };
  maps.dirty.clear(); fire(document.body, "keydown", { key: "Enter", metaKey: true }); fire(document.body, "keydown", { key: "Escape" });
  out.stray = { a: noteNow("t1", "a"), b: noteNow("t1", "b"), saved: maps.dirty.has("trainings/t1") };
}
{ seed();   // a sync replaced the record under a touch and hold, its redraw held back: after Add those cards are drawn again
  const before = rowOf("a"); const T1 = JSON.parse(JSON.stringify(maps.trainings.get("t1"))); T1.rows[1].weights = ["50"]; maps.trainings.set("t1", T1);
  fns.editNote("t1", "a", false); await advance(400); type("Brace first"); fire(ok, "click"); fns.render();
  out.stale = { rebuilt: !!rowOf("a") && rowOf("a") !== before, note: noteNow("t1", "a") };
  const still = rowOf("a"); fns.editNote("t1", "b", false); await advance(400); type("Curl it"); fire(ok, "click"); fns.render();
  out.fresh = { kept: rowOf("a") === still, note: noteNow("t1", "b") };   // the cards were this record's: nothing to draw again
}
console.log(JSON.stringify(out));
