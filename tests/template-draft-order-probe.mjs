// Run by template-draft.test.js in its own process (v316, the twenty-third check round): a template's page in the coach's look, drawn by the real
// main.js on template-draft-labels-probe.mjs's stand-ins (its clock and elements), signed in on the stand-in server. A name typed, then Save template
// while the iPad's Move to Rehab is on the server (the Save meets the iPad's newer copy and merges it), and while that Save is on its way a number
// typed into an exercise's number box, the finger still in the box as the Save lands: the typed number stays (the merge reads the copy on screen
// as the page will tidy it, with the exercise just typed), leaving the box draws the exercise where its letter asks, and the next Save template
// sends that order with the iPad's move. Prints, as JSON, what each case showed.
import { byId, el } from "./env.js";
import { makeSupabase } from "./fake-supabase.js";
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
const { cmpLabel } = await import("../app/model.js");

const TPL = "00000000-0000-4000-8000-0000000000f1", TP = "4b6d8f0a-2c4e-4a6b-8d0f-1a3c5e7a9b1d", AT = "2026-11-10T16:00:00.000Z";
const R = (id, label, name) => ({ id, label, name, sets: 3, reps: "10", rest: "", tempo: "", weights: [], repsDone: [], setsDone: 0, done: false, note: "", alts: [] });
const rowEl = (id) => made.filter((x) => x.className.split(" ").includes("row") && x.dataset && x.dataset.id === id && !x.removed).pop() || null;
const run = async (ms) => { for (let i = 0; i < ms / 100; i++) { await flush(); await advance(100); } };   // the clock moves on in steps, each request answered on the way
const order = (rows) => [...rows].sort((a, b) => cmpLabel(a.label, b.label)).map((r) => r.label + " " + r.name);
async function typedWhileSaving({ rows, into, to, ipad }) {
  fire(document.body, "keydown", { key: "Escape" });
  app.reset(); fns.setPreview(false); made.length = 0; rowsEl.replaceChildren(); document.activeElement = null;
  const sb = makeSupabase();
  sb.seed("ft_clients", TPL, { id: TPL, name: "Templates", kind: "templates", templatesVersion: 3, folders: [{ id: "f1", name: "Strength", parent: null, kind: "folder", at: AT }, { id: "f2", name: "Rehab", parent: null, kind: "folder", at: AT }], builtinsAdopted: 1 });
  sb.seed("ft_trainings", TP, { id: TP, clientId: TPL, title: "Upper A", date: "2026-01-01", createdAt: AT, completedAt: null, skippedAt: null, template: { program: "My templates", phase: 0, stage: 0, n: 1, folder: "f1" }, rows: rows.map(([id, label, name]) => R(id, label, name)) });
  app.set({ sb, signedIn: true, clientMode: false, backend: fns.cloudBackend, sessionEmail: "coach@x.com", myClientId: null, tab: "workouts", templateDraft: null, view: { name: "training", id: TP }, renderedTraining: null });
  fns.syncDownNow(); await run(2000);                                    // the Mac reads the templates, Upper A's page open (drawn as the read lands)
  whenBg.hidden = true; askSheet.hidden = true;
  const t = maps.trainings.get(TP), lab = rowEl(into) && rowEl(into).querySelector(".label");
  if (!t || !lab) return { error: "the page was not drawn" };
  t.title = "Upper A1"; fns.scheduleSave("trainings", TP);               // a name typed (as the name box's input handler does): unsaved changes
  if (ipad) { const s = sb.tables.ft_trainings.get(TP); s.data.template.folder = "f2"; s.updated_at = "2026-11-24T12:00:00.000Z"; }   // the iPad: Move to Rehab, saved there (the Mac has not read it since)
  const real = sb.from; let writes = 0;
  sb.from = (table) => { const b = real(table), up = b.update, then = b.then; let write = false; b.update = (row) => { write = true; up(row); return b; }; b.then = (res, rej) => { if (table === "ft_trainings" && write && ++writes === 1) { lab.focus(); fire(lab, "focus"); lab.value = to; fire(lab, "input"); } return then.call(b, res, rej); }; return b; };   // as Save template's first write goes: he taps the number box and types the number (his finger stays in the box)
  fns.saveDraft(); await run(3000); sb.from = real;                      // Save template (the #draftSave button's handler): it lands, merged with the iPad's copy when there is one
  const unsaved = () => { const d = app.get().templateDraft; return !!(d && d.dirty); };
  const out = { landed: { typed: t.rows.find((r) => r.id === into).label, box: lab.value, unsaved: unsaved(), folder: t.template.folder } };
  lab.blur(); await run(300);                                            // he leaves the box: the page draws the cards again, tidied with the exercise just typed
  out.left = { rows: maps.trainings.get(TP).rows.map((r) => r.label + " " + r.name), unsaved: unsaved() };
  fns.saveDraft(); await run(3000);                                      // Save template
  const s = sb.tables.ft_trainings.get(TP).data; out.server = { rows: order(s.rows), folder: s.template.folder };
  return out;
}
const SUPERSET = [["b", "1a", "Bench press"], ["r", "1b", "Row"], ["c", "2", "Curl"]];
const out = {
  rowFirst: await typedWhileSaving({ rows: SUPERSET, into: "r", to: "1a", ipad: true }),             // Row typed 1a: to the top of its superset
  benchSecond: await typedWhileSaving({ rows: SUPERSET, into: "b", to: "1b", ipad: true }),          // Bench press given the next exercise's letter
  triSet: await typedWhileSaving({ rows: [["b", "1a", "Bench press"], ["r", "1b", "Row"], ["f", "1c", "Fly"], ["c", "2", "Curl"]], into: "r", to: "1c", ipad: true }),   // a tri-set: Row to its third place
  warmUp: await typedWhileSaving({ rows: [["k", "Wa", "Cat cow"], ["p", "Wb", "Band pull-apart"], ["s", "1", "Back squat"]], into: "p", to: "Wa", ipad: true }),   // the warm-up's second exercise first
  alone: await typedWhileSaving({ rows: SUPERSET, into: "r", to: "1a", ipad: false }),               // no other device: the Save lands with nothing to merge
};
await new Promise((r) => setImmediate(r));
out.rejected = rejected;
console.log(JSON.stringify(out));
process.exit(0);
