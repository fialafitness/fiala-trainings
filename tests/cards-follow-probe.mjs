// Run by cards-follow.test.js in its own process (v316, the twenty-third check round): a workout's page in the coach's look (his Mac) or on
// the client's phone, drawn by the real main.js on card-sets-probe.mjs's stand-ins (its clock and elements), with the stand-in server under it.
// Where the state of a card goes when a restore, a sync or the coach's own save gives the exercises other numbers:
// - notes: a card's note state, unfolded or half written, follows the exercise its note is on (the one holding a note, else the card's first),
//   and goes when that exercise no longer takes its card's note (a tri-set regrouped, two cards merging, an exercise moved between supersets,
//   a client's note arriving on another exercise of the card), by a restore and by a sync, on his Mac and on her phone;
// - live: after his own save merges her Start this exercise or the iPad's renumbering, the cards are drawn again at once, and a card still
//   drawn under his typing finger sends its taps (a set picked, Complete set, a finished card opened) and its note (the typing, Save note,
//   Discard) to its own exercise, not to the card that took its old number;
// - at the tap (found while the round's tests were written): on such a card, Start this exercise moves its own exercise ahead, and the glide
//   after Complete set and Resume, and the keyboard's place after a pick (the sets count's list, Mark set N as not done), land on its card;
//   the keyboard's place after a No to their questions (which draws nothing again) stays on the card asked from; Finish early reads the
//   card's number at Finish & move on (a save can land while its sheet is up); and the coach's own Start this exercise (his Client view)
//   claims the whole order, so his save never merges it one exercise at a time with the iPad's.
// - the twenty-fourth check round (out.r24): a save's merge that regroups a superset, Delete exercise and Reorder's trash, and the note's state;
//   a workout taken from another window's waiting queue; a card whose exercise left the workout, tapped; each of the card's other taps read at
//   the tap; and another account signing in on the page (last: it runs main.js's own boot).
// - the owner's pick "Ask first" (out.r24.ask, quiet, regroup, box): Save note asks "Replace the note written meanwhile?" before it replaces a note
//   the other side wrote on that exercise since the box was opened, by his own save's merge under his finger, a sync, on his Mac, in his Client
//   view and on her phone; Cancel and Replace; no question when nothing changed meanwhile or the texts agree; a regrouped superset keeps the note
//   its box was opened on with the note's exercise (main.js's cardNoteBase, found as the two stores below are: the Map an Edit tap writes into).
// - the twenty-fifth check round (out.r25): Save note asks "Save a note deleted meanwhile?" before it brings back a note the other side deleted
//   while the box was open (a superset's second exercise too); a note that came on the superset's other exercise under his finger is the card's
//   note, and Save note asks before it replaces it; an Edit box emptied over newer words asks once, "Delete the note written meanwhile?"; Edit on
//   the note above a box with words keeps them; Delete on a note changed under his finger quotes the newer words; the question keeps a quoted
//   note's lines; Skip and Finish early on a card whose exercise left the workout; and three of round 24's rules no test guarded (out.r25.split,
//   renumber, twoBoxes: what Save note measures against, through the iPad's split, Delete exercise and a card deleted with its box).
// - the twenty-sixth check round (out.r26): the other side's change to the note, merged by his own save while the note box's question is up
//   (Delete's "Delete this note?", an emptied box's "Delete this note?", "Replace the note written meanwhile?", "Save a note deleted
//   meanwhile?"): his answer asks again, quoting the note as it is now, and a note deleted under the question is drawn gone with nothing more asked.
// The two note stores of main.js that the tests cannot reach (openExNotes, cardNoteDraft) are found by what the page's own handlers do with
// them: the Set a tap on See note adds the card's key to, and the Map the typing writes the note into. Prints, as JSON, what each case drew
// and kept. Made-up people only.
import { byId, el } from "./env.js";
import { makeSupabase } from "./fake-supabase.js";
import { cmpLabel } from "../app/model.js";
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
recorder("earlySheet", { hidden: true }); for (const id of ["esGo", "esKeep"]) recorder(id);   // the Finish early sheet and its two buttons (Finish & move on, Cancel), heard by main.js as it loads
for (const id of ["loginForm", "loginEmail", "loginPassword", "loginMsg", "loginBtn", "vLogin"]) recorder(id);   // the sign-in form, heard by main.js as it loads (the twenty-fourth check round: another account signing in on the page)
const SPY = { on: null, sets: new Set(), maps: new Set(), bases: new Set() };   // the store a handler writes the card's key into, watched for the length of one handler
{ const add0 = Set.prototype.add, set0 = Map.prototype.set;
  Set.prototype.add = function (k) { if (SPY.on && SPY.on.kind === "set" && k === SPY.on.key) SPY.sets.add(this); return add0.call(this, k); };
  Map.prototype.set = function (k, v) { if (SPY.on && (SPY.on.kind === "map" || SPY.on.kind === "base") && k === SPY.on.key && v === SPY.on.value) SPY[SPY.on.kind === "map" ? "maps" : "bases"].add(this); return set0.call(this, k, v); }; }
const app = (await import("../app/main.js")).internals();
const { fns, maps } = app;

const C = "4c5d6e7f-8a9b-4c0d-9e1f-2a3b4c5d6e7f", AT = "2026-11-10T16:00:00.000Z", OK = { at: "2026-11-18T08:00:00.000Z", by: "client" };
const MIA = { id: C, name: "Mia Torres", unit: "lb", email: "mia@x.com", choices: { zone: { state: "allow", ...OK }, health: { state: "agreed", ...OK } } };   // (her answers given: no question comes up on her phone)
let nW = 0; const wid = () => "5d6e7f8a-9b0c-4d1e-8f2a-3b4c5d6e7f" + (0x10 + nW++).toString(16).padStart(2, "0");   // each case its own workout (the card state lives in the page, by workout)
let nS = 0; const bump = (s) => { s.updated_at = "2026-11-24T14:" + String(10 + (Math.floor(nS / 50) % 50)).padStart(2, "0") + ":" + String(10 + (nS++ % 50)).padStart(2, "0") + ".000Z"; };   // the other device's write
const day = (k) => { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + k); return fns.localIso(d); };   // the app's local day (never UTC)
const clone = (x) => JSON.parse(JSON.stringify(x));
const NOTE = { clientNote: "Knee ok today", clientNoteBy: "client", clientNoteAt: "2026-11-22T17:00:00.000Z" };
const R = (id, label, name, x = {}) => ({ id, label, name, sets: 3, reps: "10", rest: "", tempo: "", weights: [], repsDone: [], setsDone: 0, done: false, note: "", alts: [], ...x });
const DONE = { weights: ["95", "95", "95"], repsDone: ["10", "10", "10"], setsDone: 3, done: true };
const settle = async () => { const end = NOW + 30000; do await advance(100); while ((app.get().inflight > 0 || maps.timers.size) && NOW < end); await advance(100); };
const sync = async () => { const p = fns.syncDownNow(); await settle(); await p; await settle(); };
const fresh = () => { fire(document.body, "keydown", { key: "Escape" }); app.reset(); fns.leaveSettings(); fns.setPreview(false); made.length = 0; rowsEl.replaceChildren(); whenBg.hidden = true; askSheet.hidden = true; document.activeElement = null; for (const x of [main, header, whenBg, altSheet]) x.inert = false; };
const coachOn = (sb) => { fresh(); app.set({ sb, signedIn: true, clientMode: false, backend: fns.cloudBackend, sessionEmail: "coach@x.com", view: { name: "clients" }, tab: "workouts" }); };
const phoneOn = (sb) => {                                                // Mia's own phone: her record and her workouts as the server has them now (client_my_data); her card note goes by client_row_note
  sb.rpcs.client_my_data = async () => ({ clients: [{ id: C, data: clone(sb.tables.ft_clients.get(C).data) }], trainings: [...sb.tables.ft_trainings.values()].filter((t) => t.client_id === C).map((t) => ({ id: t.id, data: clone(t.data), updated_at: t.updated_at })) });
  sb.rpcs.client_row_note = async (a) => { const s = sb.tables.ft_trainings.get(a.p_training), r = s && s.data.rows.find((x) => x.id === a.p_row); if (!r) throw Object.assign(new Error("no such exercise"), { code: "P0001" }); if (a.p_note) Object.assign(r, { clientNote: a.p_note, clientNoteBy: "client", clientNoteAt: "2026-11-24T18:00:00.000Z" }); else { delete r.clientNote; delete r.clientNoteBy; delete r.clientNoteAt; } bump(s); return null; };
  fresh(); app.set({ sb, signedIn: true, clientMode: true, myClientId: C, backend: fns.clientBackend, sessionEmail: "mia@x.com", view: { name: "client", id: C }, tab: "workouts" });
};
const seed = (sb, W, rows) => sb.seed("ft_trainings", W, { id: W, clientId: C, title: "Legs", date: day(1), createdAt: AT, completedAt: null, skippedAt: null, rows: clone(rows) }, { client_id: C });
const serverRows = (sb, W, rows) => { const s = sb.tables.ft_trainings.get(W); s.data = { ...s.data, rows: clone(rows) }; bump(s); };   // another device's copy of the workout on the server
const openW = async (W) => { app.set({ view: { name: "training", id: W }, renderedTraining: null }); fns.render(); await advance(50); };
const leave = () => { const a = document.activeElement; if (a && typeof a.blur === "function") a.blur(); document.activeElement = document.body; };   // a tap elsewhere: the box he was in lets go
// ---------- what the page shows, and what it keeps ----------
const blocks = () => rowsEl.children.filter((b) => classesOf(b).has("block"));
const rowIds = (b) => findAll(b, ".row").map((r) => r.dataset && r.dataset.id).filter((x, i, a) => x && a.indexOf(x) === i);
const blockOf = (rid) => blocks().find((b) => rowIds(b).includes(rid)) || null;   // the card drawn with that exercise in it
const part = (b, sel, text) => (b ? findAll(b, sel).find((x) => text == null || x.textContent === text) || null : null);
const nameOf = (W, rid) => { const r = ((maps.trainings.get(W) || {}).rows || []).find((x) => x && x.id === rid); return r ? r.name : rid; };
const look = (W) => blocks().map((b) => {
  const nb = part(b, ".exnote"), ta = nb && part(nb, "textarea"), sh = part(b, ".client-note"), tx = sh && part(sh, ".text"), chips = part(b, ".tr-chips"), cur = chips && chips.children.find((x) => classesOf(x).has("cur")), an = part(b, ".add-note");
  return { key: b.dataset.key, names: rowIds(b).map((id) => nameOf(W, id)).join("+"), set: cur ? cur.textContent : null, open: classesOf(b).has("open"), button: an ? String(an.innerHTML).replace(/<[^>]*>/g, "") : null, note: sh && !sh.hidden ? tx.textContent : null, composer: nb && !nb.hidden ? ta.value : null };
});
let EXN = null, DRF = null;                                               // main.js's openExNotes (the notes unfolded) and cardNoteDraft (the notes half written), once found
const own = (W, keys) => [...keys].filter((k) => k.startsWith(W + "/")).map((k) => k.slice(W.length + 1)).sort();
const ownMap = (W, m) => Object.fromEntries([...m].filter(([k]) => k.startsWith(W + "/")).map(([k, v]) => [k.slice(W.length + 1), v]));
const state = (W) => { const cs = fns.cardSets(); return { open: own(W, cs.openBlocks), sel: ownMap(W, cs.setSel), notesOpen: EXN ? own(W, EXN) : "not found", drafts: DRF ? ownMap(W, DRF) : "not found" }; };
const said = (rows) => [...(rows || [])].filter(Boolean).sort((a, b) => cmpLabel(a.label, b.label)).map((r) => r.label + " " + r.name + (r.clientNote ? " [" + (r.clientNoteBy || "client") + ": " + r.clientNote + "]" : ""));
const here = (W) => said((maps.trainings.get(W) || {}).rows), server = (sb, W) => said(((sb.tables.ft_trainings.get(W) || {}).data || {}).rows);
// ---------- what a person does ----------
const tap = async (e, gap = 0) => { if (!e) return false; if (gap) await advance(gap); fire(e, "click", { detail: 1 }); await advance(20); return true; };
const seeNote = async (W, rid) => { const b = blockOf(rid), an = part(b, ".add-note"); if (!an) return false; if (!EXN) SPY.on = { kind: "set", key: W + "/" + b.dataset.key }; fire(an, "click", { detail: 1 }); SPY.on = null; await advance(20); return true; };   // See note: the note unfolds (the Set it adds the card to is watched until found)
const editNote = async (rid) => { const sh = part(blockOf(rid), ".client-note"); return tap(sh && part(sh, "button", "Edit")); };
const addNote = async (rid) => tap(part(blockOf(rid), ".add-note"));   // a card with no note: Add note opens the box
const typeNote = async (W, rid, text) => {                              // typed on into the card's open note box (the finger stays in it)
  const b = blockOf(rid), nb = part(b, ".exnote"), ta = nb && part(nb, "textarea"); if (!ta || nb.hidden) return "no box";
  ta.focus(); ta.value = String(ta.value || "") + text;
  if (!DRF) SPY.on = { kind: "map", key: W + "/" + b.dataset.key, value: ta.value }; fire(ta, "input"); SPY.on = null; await advance(20); return ta.value;   // (the Map it writes the words into is watched until found)
};
const noteButton = async (rid, text) => { const b = blockOf(rid), nb = part(b, ".exnote"); return tap(nb && part(nb, "button", text)); };   // Save note, Discard
const answer = async (yes) => { await advance(400); const q = { open: !askSheet.hidden, title: byId.get("askTitle").textContent }; fire(byId.get(yes ? "askYes" : "askNo"), "click", { detail: 1 }); await advance(400); return q; };
const typeWeight = async (rid, v) => { const b = blockOf(rid), row = b && findAll(b, ".row").find((r) => r.dataset.id === rid), w = row && row.querySelector(".setlog .w"); if (!w) return "no box"; fire(w, "focus"); w.focus(); w.value = v; fire(w, "input"); await advance(20); return w.value; };   // his finger stays in the box
const chip = async (rid, n) => { const c = part(blockOf(rid), ".tr-chips"); return tap(c && c.children[n - 1]); };   // the set bar's chip for set n
const complete = async (rid) => tap(part(blockOf(rid), ".complete"), 400);
const openCard = async (rid) => tap(part(blockOf(rid), ".group"));   // a tap on a finished card opens it
const rename = (W, title) => { maps.trainings.get(W).title = title; fns.scheduleSave("trainings", W); };   // as the name box's input handler does: the save goes 0.5 s later
const findStores = () => ({ exn: SPY.sets.size === 1 ? [...SPY.sets][0] : null, drf: SPY.maps.size === 1 ? [...SPY.maps][0] : null, sets: SPY.sets.size, maps: SPY.maps.size });
const out = {};

// ---------- the two note stores, found: Mia's note on Leg curl unfolded (See note), then a word added to it (Edit, typing) ----------
{ const sb = makeSupabase(), W = wid(); sb.seed("ft_clients", C, MIA); seed(sb, W, [R("sq", "1", "Back squat", DONE), R("lc", "2", "Leg curl", NOTE)]); coachOn(sb); await sync(); await openW(W);
  await seeNote(W, "lc"); await editNote("lc"); await typeNote(W, "lc", " (looked at)"); leave();
  out.found = findStores(); EXN = out.found.exn; DRF = out.found.drf; out.found = { sets: out.found.sets, maps: out.found.maps, distinct: !!EXN && !!DRF && EXN !== fns.cardSets().openBlocks && DRF !== fns.cardSets().setSel };
  if (EXN) EXN.delete(W + "/2"); if (DRF) DRF.delete(W + "/2"); }

// ---------- notes: a card's note state follows the exercise its note is on (R23-HND-1) ----------
const COACH = { clientNote: "Keep the knee soft", clientNoteBy: "coach", clientNoteAt: "2026-11-23T09:00:00.000Z" };
const SHAPES = {
  triset: {                                                            // Mia's note is on Leg curl (2b); the other copy has Leg press out of the tri-set, on its own as 3
    here: [R("sq", "1", "Back squat", DONE), R("lp", "2a", "Leg press"), R("lc", "2b", "Leg curl", NOTE), R("cr", "2c", "Calf raise")],
    other: [R("sq", "1", "Back squat", DONE), R("lc", "2a", "Leg curl", NOTE), R("cr", "2b", "Calf raise"), R("lp", "3", "Leg press")],
    act: async (W) => { await seeNote(W, "lc"); await editNote("lc"); await typeNote(W, "lc", ", sore after set 3"); leave(); },   // See note, Edit, a few words added, a tap elsewhere
  },
  merge: {                                                             // two cards, each with a new note half written; the other copy makes them one superset (Bench press first)
    here: [R("sq", "1", "Back squat", DONE), R("bp", "2", "Bench press"), R("fl", "3", "Fly")],
    other: [R("sq", "1", "Back squat", DONE), R("bp", "2a", "Bench press"), R("fl", "2b", "Fly")],
    act: async (W) => { await addNote("bp"); await typeNote(W, "bp", "Bench: shoulder ok"); leave(); await addNote("fl"); await typeNote(W, "fl", "Fly: elbow pinch"); leave(); },
  },
  swap: {                                                              // a new note half written on card 3 (for Fly, its first); the other copy has Row and Fly swapped between the supersets
    here: [R("sq", "1", "Back squat", DONE), R("bp", "2a", "Bench press"), R("rw", "2b", "Row"), R("fl", "3a", "Fly"), R("cu", "3b", "Curl")],
    other: [R("sq", "1", "Back squat", DONE), R("bp", "2a", "Bench press"), R("fl", "2b", "Fly"), R("rw", "3a", "Row"), R("cu", "3b", "Curl")],
    act: async (W) => { await addNote("fl"); await typeNote(W, "fl", "Fly: left elbow pinches"); leave(); },
  },
  arrive: {                                                            // a new note half written on the superset (for Leg press, its first); the other copy, by a sync, has Mia's note on Leg curl, the card's other exercise
    here: [R("sq", "1", "Back squat", DONE), R("lp", "2a", "Leg press"), R("lc", "2b", "Leg curl")],
    other: [R("sq", "1", "Back squat", DONE), R("lp", "2a", "Leg press"), R("lc", "2b", "Leg curl", NOTE)],
    act: async (W) => { await addNote("lp"); await typeNote(W, "lp", "Leg press: felt easy today"); leave(); },
    phoneOther: [R("sq", "1", "Back squat", DONE), R("lp", "2a", "Leg press"), R("lc", "2b", "Leg curl", COACH)],   // on her phone: the coach's note arrives
    phoneAct: async (W) => { await addNote("lp"); await typeNote(W, "lp", "Felt easy today"); leave(); },
  },
};
async function noteCase(shape, path) {                                 // path: "restore" (the coach's Mac: the file has the other copy), "mac" or "phone" (a sync brings the other copy)
  const sh = SHAPES[shape], sb = makeSupabase(), W = wid(), o = {}, other = path === "phone" && sh.phoneOther ? sh.phoneOther : sh.other;
  try {
    sb.seed("ft_clients", C, MIA); seed(sb, W, path === "restore" ? other : sh.here);
    if (path === "phone") phoneOn(sb); else coachOn(sb);
    await sync();
    let backup = null;
    if (path === "restore") { backup = clone(fns.backupData()); serverRows(sb, W, sh.here); await sync(); }   // the change since the backup (made on the iPad), synced here
    await openW(W); o.before = look(W);
    await (path === "phone" && sh.phoneAct ? sh.phoneAct : sh.act)(W);
    o.typed = { page: look(W), state: state(W) };
    if (path === "restore") { fns.applyRestore(fns.planRestore(backup)); fns.render(); await settle(); }   // Restore, tapped: the file's copy, and the page drawn again
    else { serverRows(sb, W, other); await sync(); }                    // the other copy reaches this page by a sync
    o.after = { page: look(W), state: state(W), here: here(W) };
    const boxed = blocks().filter((b) => { const nb = part(b, ".exnote"); return nb && !nb.hidden; });
    if (boxed.length) { await noteButton(rowIds(boxed[0])[0], "Save note"); await settle(); o.saved = { here: here(W), server: server(sb, W), sent: sb.log.filter((x) => x.rpc === "client_row_note").map((x) => x.args.p_row + ": " + x.args.p_note) }; }   // Save note where the box is
  } catch (e) { o.error = String((e && e.stack) || e); }
  return o;
}
out.notes = {};
for (const [shape, paths] of [["triset", ["restore", "mac", "phone"]], ["merge", ["restore", "mac"]], ["swap", ["restore", "mac"]], ["arrive", ["mac", "phone"]]]) for (const p of paths) out.notes[shape + " " + p] = await noteCase(shape, p);   // (a note never arrives by a restore: it keeps each exercise's note as it is here)

// ---------- live: the coach's own save merges her Start this exercise or the iPad's renumbering (R23-MRG-3, R23-DRF-2) ----------
const LEGS = [R("sq", "1", "Back squat", DONE), R("lp", "2", "Leg press"), R("lc", "3", "Leg curl")];
const curlStarts = (sb, W) => { const s = sb.tables.ft_trainings.get(W); s.data.rows.find((r) => r.id === "lc").label = "2"; s.data.rows.find((r) => r.id === "lp").label = "3"; bump(s); };   // her Start this exercise on Leg curl (her phone's rule writes the numbers on the server's copy)
const PULL = [R("bs", "1", "Back squat", { sets: 4 }), R("rd", "2", "Romanian deadlift"), R("wl", "3", "Walking lunge")];
const rdlStarts = (sb, W) => { const s = sb.tables.ft_trainings.get(W); s.data.rows.find((r) => r.id === "rd").label = "1"; s.data.rows.find((r) => r.id === "bs").label = "2"; bump(s); };   // her Start this exercise on Romanian deadlift: it goes first, Back squat second
async function live(rows) { const sb = makeSupabase(), W = wid(); sb.seed("ft_clients", C, MIA); seed(sb, W, rows); coachOn(sb); await sync(); await openW(W); return { sb, W }; }
const run = async (f) => { const o = {}; try { await f(o); } catch (e) { o.error = String((e && e.stack) || e); } return o; };
out.live = {};
out.live.drawn = await run(async (o) => {                              // he renames the workout (no finger in the cards): the cards are drawn again as his save lands
  const { sb, W } = await live(LEGS); curlStarts(sb, W); rename(W, "Legs B"); await settle();
  o.landed = { page: look(W), here: here(W) };
  await chip("lp", 2); o.tapped = { page: look(W), state: state(W) };
});
for (const [name, rows, starts, rid, n] of [["leg press", LEGS, curlStarts, "lp", 2], ["back squat", PULL, rdlStarts, "bs", 4]]) out.live["set " + name] = await run(async (o) => {   // his weight typed into the card (the finger stays in the box): his save merges her numbers under his finger, the cards still drawn; then a chip of that card
  const { sb, W } = await live(rows); starts(sb, W);
  o.typed = await typeWeight(rid, "100"); await settle();
  o.landed = { page: look(W), here: here(W) };
  leave(); await chip(rid, n); o.tapped = { page: look(W), state: state(W) };
});
out.live.complete = await run(async (o) => {                           // Leg curl on Set 2; his weight typed into Leg press; her numbers merged under his finger; Complete set on Leg press's card still drawn
  const { sb, W } = await live(LEGS); await chip("lc", 2); curlStarts(sb, W);
  o.typed = await typeWeight("lp", "100"); await settle();
  o.landed = { page: look(W), state: state(W) };
  leave(); o.completed = await complete("lp"); await advance(50);
  const lp = maps.trainings.get(W).rows.find((r) => r.id === "lp");
  o.after = { page: look(W), state: state(W), legPress: { setsDone: lp.setsDone, weights: lp.weights } };
});
for (const [name, rows, starts, rid] of [["leg press", LEGS, curlStarts, "lp"], ["back squat", PULL, rdlStarts, "bs"]]) for (const end of name === "leg press" ? ["save", "leave", "discard"] : ["save", "leave"]) out.live["note " + name + " " + end] = await run(async (o) => {   // he renames the workout, opens the card's note box and writes as the save goes; it merges her numbers under his finger; he writes on, then Save note, a tap elsewhere or Discard; the next sync draws the page
  const { sb, W } = await live(rows); starts(sb, W); rename(W, "Legs B");
  await addNote(rid); o.typed1 = await typeNote(W, rid, "Knees out"); await settle();
  o.landed = { page: look(W), state: state(W), here: here(W) };
  o.typed2 = await typeNote(W, rid, " today");
  if (end === "save") await noteButton(rid, "Save note"); else if (end === "discard") { await noteButton(rid, "Discard"); o.asked = await answer(true); }
  leave(); await settle(); await sync();
  o.after = { page: look(W), state: state(W), here: here(W), server: server(sb, W) };
});
out.live.gone = await run(async (o) => {                               // a new note on the superset (for Leg press, its first) as his save goes; Mia's note on Leg curl, on the server before his next sync, comes in with it: Leg press no longer takes the card's note
  const { sb, W } = await live([R("sq", "1", "Back squat", DONE), R("lp", "2a", "Leg press"), R("lc", "2b", "Leg curl")]);
  { const s = sb.tables.ft_trainings.get(W); Object.assign(s.data.rows.find((r) => r.id === "lc"), NOTE); bump(s); }
  rename(W, "Legs B"); await addNote("lp"); o.typed1 = await typeNote(W, "lp", "Knees"); await settle();
  o.landed = { page: look(W), state: state(W), here: here(W) };
  o.typed2 = await typeNote(W, "lp", " out"); leave(); await settle(); await sync();
  o.after = { page: look(W), state: state(W), here: here(W), server: server(sb, W) };
});
out.live.opened = await run(async (o) => {                             // the iPad deletes Back squat (Leg press, done, becomes 1); his weight typed into Leg curl merges it under his finger; a tap on Leg press's finished card, still drawn as 2
  const { sb, W } = await live([R("sq", "1", "Back squat", DONE), R("lp", "2", "Leg press", DONE), R("lc", "3", "Leg curl"), R("cr", "4", "Calf raise")]);
  serverRows(sb, W, [R("lp", "1", "Leg press", DONE), R("lc", "2", "Leg curl"), R("cr", "3", "Calf raise")]);
  o.typed = await typeWeight("lc", "50"); await settle();
  o.landed = { page: look(W), here: here(W) };
  leave(); o.tapped = await openCard("lp"); await sync();
  o.after = { page: look(W), state: state(W) };
});

// ---------- a workout deleted and brought back keeps no note state of before (R23-HND-4) ----------
out.deleted = {};
for (const how of ["here", "ipad"]) out.deleted[how] = await run(async (o) => {   // here: the coach's Delete here, then his restore of a backup from before Leg curl went ahead; ipad: the iPad's Delete, then its own restore, both seen by this page's syncs
  const sb = makeSupabase(), W = wid(), file = [R("sq", "1", "Back squat", DONE), R("lp", "2", "Leg press", COACH), R("lc", "3", "Leg curl", NOTE)];
  sb.seed("ft_clients", C, MIA); seed(sb, W, file); coachOn(sb); await sync();
  const backup = clone(fns.backupData());
  serverRows(sb, W, [R("sq", "1", "Back squat", DONE), R("lc", "2", "Leg curl", { ...NOTE, setsDone: 1, weights: ["50", "", ""], repsDone: ["8", "", ""] }), R("lp", "3", "Leg press", COACH)]); await sync();   // her Start this exercise on Leg curl, a set logged
  await openW(W); await seeNote(W, "lc"); await editNote("lc"); await typeNote(W, "lc", ", sore after set 3"); leave();   // her note unfolded on Leg curl's card (2), words added to it
  o.before = { page: look(W), state: state(W) };
  if (how === "here") { fns.deleteTraining(W); await settle(); fns.applyRestore(fns.planRestore(clone(backup))); fns.render(); await settle(); }
  else { sb.tables.ft_trainings.delete(W); await sync(); sb.seed("ft_trainings", W, { ...clone(backup.trainings[W]), rows: clone(file) }, { client_id: C }); bump(sb.tables.ft_trainings.get(W)); await sync(); }
  await openW(W); o.after = { page: look(W), state: state(W), here: here(W) };   // Legs opened again
});

// ---------- a card's own number at the tap (found while the twenty-third round's tests were written): on a card still drawn under his finger after his
// save merged new numbers, Start this exercise, the glide after Complete set and Resume, and the keyboard's place after a pick ----------
const SC = { scrollTop: 0, scrollHeight: 8000, clientHeight: 874 };   // from here on the page scrolls: each card 500 tall, the first 200 down; a glide stops 12 under the header (at the top)
document.scrollingElement = SC;
const topOf = (b) => 200 + blocks().indexOf(b) * 500;
const glideKeys = [];
{ const was = document.querySelector; document.querySelector = (sel) => {   // the card a glide looks for, by its number, where it lies on the page now; anything else as before
    const m = /^\.block\[data-key="([^"]*)"\]$/.exec(String(sel)); if (!m) return was.call(document, sel);
    glideKeys.push(m[1]); const all = blocks();
    for (const b of all) { b.getBoundingClientRect = () => { const top = topOf(b) - SC.scrollTop; return { top, bottom: top + 480, left: 0, right: 402, width: 402, height: 480 }; }; Object.defineProperty(b, "nextElementSibling", { get: () => all[all.indexOf(b) + 1] || null, configurable: true }); }
    return all.find((b) => String(b.dataset.key) === m[1]) || null; }; }
const namesOf = (W, b) => rowIds(b).map((id) => nameOf(W, id)).join("+");
const glided = async (W) => { await advance(3000); const b = blocks().find((x) => topOf(x) - 12 === SC.scrollTop); return { card: b ? namesOf(W, b) : "none (scrolled to " + SC.scrollTop + ")", keys: [...new Set(glideKeys)] }; };   // where the page came to rest once the glide was over, and the numbers it looked for
const focusOn = (W) => { const a = document.activeElement; let n = a; while (n && MK.has(n) && !classesOf(n).has("block")) n = n.parent; const b = n && MK.has(n) && classesOf(n).has("block") ? n : null; return { card: b ? namesOf(W, b) : null, on: a && MK.has(a) ? ["tr-count", "complete", "undo-set", "card-chev"].find((c) => classesOf(a).has(c)) || String(a.className || a.tagName) : null, drawn: !!b && b.parent === rowsEl }; };   // the card the keyboard's place is on, the control, and whether that card is on the page
const keyTap = (e) => { if (!e) return false; fire(e, "click", { detail: 0, isTrusted: true }); return true; };   // Return or Space on a control: a click of no clicks, from the keyboard
const LEGS4 = [R("sq", "1", "Back squat", DONE), R("lp", "2", "Leg press"), R("lc", "3", "Leg curl"), R("cr", "4", "Calf raise")];
const calfFirst = (sb, W) => { const s = sb.tables.ft_trainings.get(W); s.data.rows.find((r) => r.id === "cr").label = "3"; s.data.rows.find((r) => r.id === "lc").label = "4"; bump(s); };   // the iPad: Calf raise put before Leg curl
const setsHere = (W) => Object.fromEntries(maps.trainings.get(W).rows.map((r) => [r.name, { sets: r.sets, done: r.setsDone, finished: r.done }]));
out.atTap = {};
out.atTap.start = await run(async (o) => {                             // his Client view: Leg curl, still to come, opened for a look; the iPad puts Calf raise before it; his weight typed into Leg press (the card in play) merges that under his finger; then Start this exercise on Leg curl's card, still drawn as 3
  const sb = makeSupabase(), W = wid(); sb.seed("ft_clients", C, MIA); seed(sb, W, LEGS4); coachOn(sb); await sync(); fns.setPreview(true); await openW(W);
  await openCard("lc"); o.peeked = { page: look(W), client: fns.previewOn(), start: !!part(blockOf("lc"), ".start-now") };
  calfFirst(sb, W);
  o.typed = await typeWeight("lp", "100"); await settle();
  o.landed = { page: look(W), here: here(W), start: !!part(blockOf("lc"), ".start-now") };
  leave(); SC.scrollTop = 0; glideKeys.length = 0; o.tapped = await tap(part(blockOf("lc"), ".start-now"));
  o.glide = await glided(W); await settle();
  o.after = { page: look(W), here: here(W), server: server(sb, W), classes: blocks().map((b) => b.className) };
});
out.atTap.complete = await run(async (o) => {                          // her Start this exercise on Leg curl (2 Leg curl, 3 Leg press) merged by his save as he types Leg press's weight; Complete set on Leg press's card, still drawn as 2
  const { sb, W } = await live(LEGS); curlStarts(sb, W);
  o.typed = await typeWeight("lp", "100"); await settle();
  o.landed = { page: look(W), here: here(W) };
  leave(); SC.scrollTop = 0; glideKeys.length = 0; o.completed = await complete("lp");
  o.glide = await glided(W); await settle();
  o.after = { page: look(W), here: here(W), sets: setsHere(W) };
});
out.atTap.resume = await run(async (o) => {                            // Leg press finished early (1 of 3 sets); the iPad deletes Back squat (Leg press becomes 1); his weight typed into Leg curl merges that under his finger; Leg press's card, still drawn as 2, opened, and Resume this exercise
  const EARLY = { weights: ["95", "", ""], repsDone: ["10", "", ""], setsDone: 1, done: true };
  const { sb, W } = await live([R("sq", "1", "Back squat", DONE), R("lp", "2", "Leg press", EARLY), R("lc", "3", "Leg curl"), R("cr", "4", "Calf raise")]);
  serverRows(sb, W, [R("lp", "1", "Leg press", EARLY), R("lc", "2", "Leg curl"), R("cr", "3", "Calf raise")]);
  o.typed = await typeWeight("lc", "50"); await settle();
  o.landed = { page: look(W), here: here(W) };
  leave(); await openCard("lp");
  const b = blockOf("lp"), full = part(b, ".resume-full"), resume = findAll(b, ".resume").find((x) => !classesOf(x).has("resume-full"));
  if (resume) resume.click = () => fire(resume, "click", { detail: 0 });   // as a page's click() does: the click itself (the summary's Resume passes its tap on to the card's own)
  o.opened = { page: look(W), summary: classesOf(b).has("summary"), resume: full && !full.hidden ? full.textContent : null };
  SC.scrollTop = 0; glideKeys.length = 0; o.resumed = await tap(full && !full.hidden ? full : null);
  o.glide = await glided(W); await settle();
  o.after = { page: look(W), here: here(W), sets: setsHere(W) };
});
out.atTap.count = await run(async (o) => {                             // the iPad puts Calf raise before Leg curl; his weight typed into Leg press merges it under his finger; from the keyboard, Leg curl's sets count (its card still drawn as 3), then 4 sets from its list
  const { sb, W } = await live(LEGS4); calfFirst(sb, W);
  o.typed = await typeWeight("lp", "100"); await settle();
  o.landed = { page: look(W), here: here(W) };
  leave(); keyTap(part(blockOf("lc"), ".tr-count")); await advance(20);
  const pop = byId.get("whenPop"), row = pop.children.find((x) => x.textContent === "4 sets");
  o.menu = { open: !whenBg.hidden, at: document.activeElement && document.activeElement.textContent, row: !!row };
  keyTap(row); await advance(20);
  o.after = { page: look(W), here: here(W), sets: setsHere(W), focus: focusOn(W) };
  await settle();
});
out.atTap.undo = await run(async (o) => {                              // Leg curl, its first set logged, on Set 1 (a set done); the iPad puts Calf raise before it; his weight typed into Leg press merges it; from the keyboard, Mark set 1 as not done on Leg curl's card (still drawn as 3), its question answered
  const { sb, W } = await live([R("sq", "1", "Back squat", DONE), R("lp", "2", "Leg press"), R("lc", "3", "Leg curl", { weights: ["50", "", ""], repsDone: ["8", "", ""], setsDone: 1 }), R("cr", "4", "Calf raise")]);
  await chip("lc", 1); calfFirst(sb, W);
  o.typed = await typeWeight("lp", "100"); await settle();
  const u = part(blockOf("lc"), ".undo-set");
  o.landed = { page: look(W), here: here(W), undo: u && !u.hidden ? u.textContent : null };
  leave(); keyTap(u && !u.hidden ? u : null); o.asked = await answer(true);
  o.after = { page: look(W), here: here(W), sets: setsHere(W), focus: focusOn(W) };
  await settle();
});
// ---------- found while those tests were written: a No that draws nothing again, Finish early with a save landing under its sheet, and the coach's
// own Start this exercise against the iPad's order ----------
const shownNow = () => { const a = document.activeElement; return a && MK.has(a) ? !a.hidden : null; };   // the control the keyboard's place is on is shown, not a hidden one
const early = (rid) => findAll(blockOf(rid), ".finish-early").find((x) => !classesOf(x).has("undo-set")) || null;   // the card's Finish early (Skip on a card not begun), not its Mark set N as not done
const logOf = (W, rid) => { const r = maps.trainings.get(W).rows.find((x) => x.id === rid); return { weights: r.weights, reps: r.repsDone }; };   // what is logged on an exercise
const ONE = { weights: ["95", "", ""], repsDone: ["10", "", ""], setsDone: 1 };   // a set logged, two to come
const sentW = (sb, W, rid, v) => ((((sb.tables.ft_trainings.get(W) || {}).data || {}).rows || []).find((r) => r.id === rid) || { weights: [] }).weights.includes(v);   // the weight he typed is on the server: his save went
out.atTap.countNo = await run(async (o) => {                           // Leg curl, 2 of its 3 sets done and set 3's weight typed ahead; the iPad puts Calf raise before it; his weight typed into Leg press merges that under his finger; from the keyboard, Leg curl's sets count (its card still drawn as 3), 2 sets from its list, and No to its question
  const { sb, W } = await live([R("sq", "1", "Back squat", DONE), R("lp", "2", "Leg press"), R("lc", "3", "Leg curl", { weights: ["50", "50", "50"], repsDone: ["8", "8", ""], setsDone: 2 }), R("cr", "4", "Calf raise")]);
  calfFirst(sb, W);
  o.typed = await typeWeight("lp", "100"); await settle();
  o.landed = { page: look(W), here: here(W) };
  leave(); keyTap(part(blockOf("lc"), ".tr-count")); await advance(20);
  const row = byId.get("whenPop").children.find((x) => x.textContent === "2 sets");
  o.menu = { open: !whenBg.hidden, at: document.activeElement && document.activeElement.textContent, row: !!row };
  keyTap(row); o.asked = await answer(false);
  o.after = { page: look(W), sets: setsHere(W), legCurl: logOf(W, "lc"), focus: focusOn(W), shown: shownNow() };
  await settle();
});
out.atTap.undoNo = await run(async (o) => {                            // as the undo case (Leg curl, its first set logged, on Set 1, its card still drawn as 3), its question answered No
  const { sb, W } = await live([R("sq", "1", "Back squat", DONE), R("lp", "2", "Leg press"), R("lc", "3", "Leg curl", { weights: ["50", "", ""], repsDone: ["8", "", ""], setsDone: 1 }), R("cr", "4", "Calf raise")]);
  await chip("lc", 1); calfFirst(sb, W);
  o.typed = await typeWeight("lp", "100"); await settle();
  const u = part(blockOf("lc"), ".undo-set");
  o.landed = { page: look(W), here: here(W), undo: u && !u.hidden ? u.textContent : null };
  leave(); keyTap(u && !u.hidden ? u : null); o.asked = await answer(false);
  o.after = { page: look(W), sets: setsHere(W), legCurl: logOf(W, "lc"), focus: focusOn(W), shown: shownNow() };
  await settle();
});
out.atTap.finishEarly = await run(async (o) => {                       // Leg press, a set logged; her Start this exercise on Leg curl (2 Leg curl, 3 Leg press) merged by his save as he types Calf raise's weight; Finish early on Leg press's card, still drawn as 2, then Finish & move on
  const { sb, W } = await live([R("sq", "1", "Back squat", DONE), R("lp", "2", "Leg press", ONE), R("lc", "3", "Leg curl"), R("cr", "4", "Calf raise")]);
  curlStarts(sb, W);
  o.typed = await typeWeight("cr", "40"); await settle();
  o.landed = { page: look(W), here: here(W) };
  leave(); const e = early("lp"); o.button = e ? e.textContent : null; await tap(e);
  o.sheet = { up: !byId.get("earlySheet").hidden, go: byId.get("esGo").textContent };
  SC.scrollTop = 0; glideKeys.length = 0; o.went = await tap(byId.get("esGo"), 400);
  o.glide = await glided(W); await settle();
  o.after = { page: look(W), here: here(W), sets: setsHere(W), up: !byId.get("earlySheet").hidden };
});
out.atTap.finishEarlyMid = await run(async (o) => {                    // Leg curl on Set 2; her Start this exercise on Leg curl waits on the server; his weight typed into Leg press and, before his save goes, Finish early on its card; the save lands while the sheet is up, her numbers merged in (2 Leg curl, 3 Leg press); then Finish & move on
  const { sb, W } = await live([R("sq", "1", "Back squat", DONE), R("lp", "2", "Leg press", ONE), R("lc", "3", "Leg curl"), R("cr", "4", "Calf raise")]);
  await chip("lc", 2); curlStarts(sb, W);
  const before = maps.trainings.get(W);
  o.typed = await typeWeight("lp", "100"); leave(); await tap(early("lp"));
  o.sheet = { up: !byId.get("earlySheet").hidden, here: here(W), state: state(W), server: server(sb, W), sent: sentW(sb, W, "lp", "100") };   // (his save not gone yet: the copy here still on the old numbers, hers waiting on the server)
  await settle();
  o.landed = { up: !byId.get("earlySheet").hidden, here: here(W), server: server(sb, W), state: state(W), same: maps.trainings.get(W) === before, sent: sentW(sb, W, "lp", "100") };
  SC.scrollTop = 0; glideKeys.length = 0; o.went = await tap(byId.get("esGo"), 400);
  o.glide = await glided(W); await settle();
  o.after = { page: look(W), here: here(W), state: state(W), sets: setsHere(W), server: server(sb, W) };
});
out.atTap.syncStart = await run(async (o) => {                         // his Client view: Leg curl, still to come, opened for a look; the iPad puts Calf raise before it; a sync while his finger rests in Leg press's weight box (nothing typed: nothing of his to save) passes over Legs; then Start this exercise on Leg curl's card, and his save meets the iPad's copy
  const sb = makeSupabase(), W = wid(); sb.seed("ft_clients", C, MIA); seed(sb, W, LEGS4); coachOn(sb); await sync(); fns.setPreview(true); await openW(W);
  await openCard("lc"); calfFirst(sb, W);
  const b = blockOf("lp"), row = b && findAll(b, ".row").find((r) => r.dataset.id === "lp"), w = row && row.querySelector(".setlog .w");
  if (w) { fire(w, "focus"); w.focus(); }
  const before = maps.trainings.get(W); await sync();
  o.landed = { page: look(W), here: here(W), server: server(sb, W), same: maps.trainings.get(W) === before, client: fns.previewOn(), finger: !!w && document.activeElement === w, start: !!part(blockOf("lc"), ".start-now") };
  leave(); o.tapped = await tap(part(blockOf("lc"), ".start-now")); await settle(); await advance(3000); await settle();
  o.after = { page: look(W), here: here(W), server: server(sb, W) };
});

// ---------- the twenty-fourth check round ----------
// note: the coach's own save that merges a regrouped superset (the iPad's, or her Start this exercise) keeps the note's state with the exercise
// holding her note, as a sync does (R24-CRD-1); del: Delete exercise and Reorder's trash of that exercise take its note's state with it (R24-CRD-2);
// tabs: a workout this page takes from another window's waiting queue keeps the objects its cards hold, and their state follows the new numbers
// (R24-CRD-4); gone: a card whose exercise left the workout under the finger sets nothing on the card that took its number (R24-CRD-5); taps: each
// of the card's other taps reads its number at the tap (R24-TW-2: the card that took the old number is given state of its own first, so a tap
// that used the number as drawn shows there); switch (last, as it runs main.js's own boot): another account signing in on this page takes none
// of the last account's card state (R24-CRD-6).
out.r24 = {};
{
  const saveWhereBox = async (sb, W) => {                               // Save note on the card whose note box is open, if one is
    const b = blocks().find((x) => { const nb = part(x, ".exnote"); return !!nb && !nb.hidden; }); if (!b) return { card: null };
    const card = namesOf(W, b); await noteButton(rowIds(b)[0], "Save note"); await settle();
    return { card, here: here(W), server: server(sb, W) };
  };
  const rowOf = (rid) => { const b = blockOf(rid); return (b && findAll(b, ".row").find((r) => r.dataset.id === rid)) || null; };   // the exercise's row as drawn now
  const weightBox = (rid) => { const row = rowOf(rid); return row ? row.querySelector(".setlog .w") : null; };

  // ---------- R24-CRD-1: a save's merge, and the note's state ----------
  const TRI = [R("sq", "1", "Back squat", DONE), R("lp", "2a", "Leg press"), R("lc", "2b", "Leg curl", NOTE), R("cr", "2c", "Calf raise")];
  const TRI_IPAD = [R("sq", "1", "Back squat", DONE), R("lc", "2a", "Leg curl", NOTE), R("cr", "2b", "Calf raise"), R("lp", "3", "Leg press")];   // the iPad: Leg press out of the tri-set, on its own as 3
  out.r24.note = {};
  for (const how of ["save", "sync"]) out.r24.note["ipad " + how] = await run(async (o) => {   // her note on Leg curl unfolded, Edit, words added, a tap elsewhere; then his rename's save meets the iPad's copy and merges it (or a sync brings it)
    const { sb, W } = await live(TRI);
    await seeNote(W, "lc"); await editNote("lc"); o.typed = await typeNote(W, "lc", ", sore after set 3"); leave();
    serverRows(sb, W, TRI_IPAD);
    if (how === "save") { rename(W, "Legs B"); await settle(); } else await sync();
    o.after = { page: look(W), state: state(W), here: here(W) };
    o.saved = await saveWhereBox(sb, W);
  });
  out.r24.note["ipad finger"] = await run(async (o) => {               // the same with his finger still in the box as his save lands: he types on, taps elsewhere, and a sync draws the page
    const { sb, W } = await live(TRI);
    await seeNote(W, "lc"); await editNote("lc"); o.typed1 = await typeNote(W, "lc", ", sore");
    serverRows(sb, W, TRI_IPAD); rename(W, "Legs B"); await settle();
    o.landed = { here: here(W), state: state(W) };
    o.typed2 = await typeNote(W, "lc", " after set 3"); leave(); await settle(); await sync();
    o.after = { page: look(W), state: state(W), here: here(W) };
  });
  const SS = [R("sq", "1", "Back squat", DONE), R("lp", "2a", "Leg press"), R("lc", "2b", "Leg curl", NOTE), R("cr", "3", "Calf raise")];
  const calfStarts = (sb, W) => { const s = sb.tables.ft_trainings.get(W); for (const [id, l] of [["cr", "2"], ["lp", "3a"], ["lc", "3b"]]) s.data.rows.find((r) => r.id === id).label = l; bump(s); };   // her Start this exercise on Calf raise: it goes ahead of the superset, now 3
  for (const how of ["rename", "weight"]) out.r24.note["start " + how] = await run(async (o) => {   // one coach device: her note on Leg curl (2b) unfolded and edited; her Start this exercise on Calf raise, merged by his rename's save, or by his save of a weight typed into Calf raise (his finger in its box; then a tap elsewhere and a sync)
    const { sb, W } = await live(SS);
    await seeNote(W, "lc"); await editNote("lc"); o.typed = await typeNote(W, "lc", ", sore after set 3"); leave();
    calfStarts(sb, W);
    if (how === "rename") { rename(W, "Legs B"); await settle(); } else { o.w = await typeWeight("cr", "40"); await settle(); leave(); await settle(); await sync(); }
    o.after = { page: look(W), state: state(W), here: here(W) };
    o.saved = await saveWhereBox(sb, W);
  });

  // ---------- R24-CRD-2: Delete exercise and Reorder's trash, and the note's state ----------
  const delEx = async (rid) => {                                         // the exercise's "…", Delete exercise, then Delete in its question
    const row = rowOf(rid), mb = row && row.querySelector(".more-btn"); if (!mb) return "no … button";
    fire(mb, "click", { detail: 1 }); await advance(30);
    const item = byId.get("whenPop").children.find((x) => /Delete exercise/.test(String(x.textContent || "") + String(x.innerHTML || ""))); if (!item) return "no Delete exercise in its menu";
    fire(item, "click", { detail: 1 }); await advance(30);
    const q = await answer(true); await settle(); return q;
  };
  out.r24.del = {};
  for (const [name, rid] of [["note's own", "lc"], ["card's first", "lp"], ["another card", "sq"]]) out.r24.del[name] = await run(async (o) => {   // her note on Leg curl (2b) unfolded, Edit, words added, a tap elsewhere; then Delete exercise on Leg curl (the note's own), on Leg press (the card's first), or on Back squat (another card)
    const { sb, W } = await live(SS);
    await seeNote(W, "lc"); await editNote("lc"); o.typed = await typeNote(W, "lc", ", sore after set 3"); leave();
    o.asked = await delEx(rid);
    o.after = { page: look(W), state: state(W), here: here(W), server: server(sb, W) };
    o.saved = await saveWhereBox(sb, W);
  });
  out.r24.del.seen = await run(async (o) => {                           // her note on Leg curl only unfolded (See note); Leg curl deleted; then a note of hers on Leg press, the card's exercise now, comes by a sync
    const { sb, W } = await live(SS);
    await seeNote(W, "lc"); leave(); o.asked = await delEx("lc");
    o.after = { page: look(W), state: state(W), here: here(W) };
    { const s = sb.tables.ft_trainings.get(W); Object.assign(s.data.rows.find((r) => r.id === "lp"), { clientNote: "Left knee clicks", clientNoteBy: "client", clientNoteAt: "2026-11-24T15:00:00.000Z" }); bump(s); }
    await sync();
    o.later = { page: look(W), state: state(W), here: here(W) };
  });
  out.r24.del.trash = await run(async (o) => {                          // her note on Leg curl edited as above; then Reorder, the trash on Leg curl (its question answered), and Done
    const { sb, W } = await live(SS);
    await seeNote(W, "lc"); await editNote("lc"); o.typed = await typeNote(W, "lc", ", sore after set 3"); leave();
    fns.startOrder(W); await advance(30); o.on = fns.exOrderOn();
    const p = fns.roDelete(W, "lc"); o.asked = await answer(true); o.deleted = await p; fns.doneOrder(); await advance(30); await settle();
    o.after = { page: look(W), state: state(W), here: here(W) };
    o.saved = await saveWhereBox(sb, W);
  });

  // ---------- R24-CRD-4: two windows of one browser on Legs; this page is window B ----------
  const aQueue = (sb, W, rows, touched) => {                             // window A's queue as its persistPending lays it out (its copy of Legs still to send, read against the server's copy both windows synced), and the storage event this window hears
    const s = sb.tables.ft_trainings.get(W), k = "trainings/" + W, rec = { ...clone(maps.trainings.get(W)), rows: clone(rows) };
    const q = { deliv: [], wd: [], dirty: [k], weights: [], done: [], early: [], rownotes: [], profile: [], under: [], held: [], settled: [], choices: [], finish: [], skip: [], move: [], miss: [], swap: [], order: [],
      touched: touched.length ? [[W, touched]] : [], named: [], noted: [], state: [], plans: [], profTouched: [], notesGone: [], packagesGone: [], foldersGone: [], foldersTouched: [], fromFile: [],
      stamps: [[k, s.updated_at]], docs: [[k, JSON.stringify(s.data)]], recs: [[k, rec]], gone: [], owner: "coach@x.com", tab: "window-A" };
    localStorage.setItem("fiala.pending.v1", JSON.stringify(q)); localStorage.setItem("fiala.pending.tab", "window-A");
    fns.onStorage({ key: "fiala.pending.v1", newValue: "x" });
  };
  const caretIn = (rid) => { const w = weightBox(rid); if (w) { fire(w, "focus"); w.focus(); } return w; };   // his caret in the exercise's weight box, nothing typed
  const rowHere = (W, rid) => ((maps.trainings.get(W) || {}).rows || []).find((x) => x && x.id === rid) || {};
  const rowThere = (sb, W, rid) => ((((sb.tables.ft_trainings.get(W) || {}).data || {}).rows) || []).find((x) => x && x.id === rid) || {};
  const lifts = (r) => ({ done: r.setsDone || 0, weights: (r.weights || []).filter((v) => String(v || "").trim()) });   // what is logged on an exercise
  out.r24.tabs = {};
  out.r24.tabs.typed = await run(async (o) => {                         // B's caret in Romanian deadlift's weight box; A's Complete set on Back squat (185 × 5) waits in the queue, its save still on its way, and B takes it; then 135 typed on in B's box
    const { sb, W } = await live(PULL);
    const w = caretIn("rd");
    aQueue(sb, W, PULL.map((r) => (r.id === "bs" ? { ...clone(r), weights: ["185", "", "", ""], repsDone: ["5", "", "", ""], setsDone: 1 } : clone(r))), ["bs"]); await advance(50);
    o.taken = { squat: lifts(rowHere(W, "bs")), page: look(W), caret: !!w && document.activeElement === w };
    if (w) { w.value = "135"; fire(w, "input"); } await advance(20);
    o.typed = { box: w ? w.value : null };
    await settle();
    o.saved = { here: lifts(rowHere(W, "rd")), server: lifts(rowThere(sb, W, "rd")), squat: lifts(rowThere(sb, W, "bs")) };
    leave(); await settle(); await sync(); app.set({ renderedTraining: null }); fns.render(); await advance(50);
    o.after = { box: weightBox("rd") ? weightBox("rd").value : null, here: lifts(rowHere(W, "rd")), server: lifts(rowThere(sb, W, "rd")) };
  });
  out.r24.tabs.deleted = await run(async (o) => {                       // B: Set 3 picked on Romanian deadlift (card 2), its caret in that card's weight box; A deletes Back squat (the numbers close up) and B takes A's waiting copy; then B's caret leaves and the page is drawn again
    const { sb, W } = await live(PULL);
    await chip("rd", 3); caretIn("rd");
    o.before = { page: look(W), state: state(W) };
    aQueue(sb, W, PULL.filter((r) => r.id !== "bs").map((r, i) => ({ ...clone(r), label: String(i + 1) })), []); await advance(50);
    o.taken = { here: here(W) };
    leave(); app.set({ renderedTraining: null }); fns.render(); await advance(50);
    o.after = { page: look(W), state: state(W) };
    await settle();
  });

  // ---------- R24-CRD-5: a card whose exercise left the workout, tapped ----------
  const LOG1 = { weights: ["50", "", ""], repsDone: ["8", "", ""], setsDone: 1 };   // a set logged, two to come
  out.r24.gone = {};
  for (const [what, pick] of [["set", 2], ["complete", 3]]) out.r24.gone[what] = await run(async (o) => {   // Leg curl (a set logged) picked on Set 2, or on Set 3 ahead; the iPad deletes Leg press; his weight typed into Calf raise merges that under his finger (Leg press's card still drawn); then Set 3, or Complete set, on Leg press's card
    const { sb, W } = await live([R("sq", "1", "Back squat", DONE), R("lp", "2", "Leg press"), R("lc", "3", "Leg curl", LOG1), R("cr", "4", "Calf raise")]);
    await chip("lc", pick);
    serverRows(sb, W, [R("sq", "1", "Back squat", DONE), R("lc", "2", "Leg curl", LOG1), R("cr", "3", "Calf raise")]);
    o.typed = await typeWeight("cr", "40"); await settle();
    o.landed = { page: look(W), here: here(W), state: state(W), drawn: !!blockOf("lp") };
    leave(); o.tapped = what === "set" ? await chip("lp", 3) : await complete("lp"); await advance(50); await settle();
    o.after = { page: look(W), state: state(W), here: here(W) };
  });
  out.r24.gone.superset = await run(async (o) => {                      // the superset's first exercise deleted on the iPad (2a Leg press, 2b Leg curl become 2 Leg curl); Set 2 tapped on the card still drawn
    const { sb, W } = await live([R("sq", "1", "Back squat", DONE), R("lp", "2a", "Leg press"), R("lc", "2b", "Leg curl"), R("cr", "3", "Calf raise")]);
    serverRows(sb, W, [R("sq", "1", "Back squat", DONE), R("lc", "2", "Leg curl"), R("cr", "3", "Calf raise")]);
    o.typed = await typeWeight("cr", "40"); await settle();
    o.landed = { page: look(W), here: here(W) };
    leave(); o.tapped = await chip("lc", 2); await advance(50); await settle();
    o.after = { page: look(W), state: state(W), here: here(W) };
  });

  // ---------- R24-TW-2: each tap on a card still drawn under his finger after his save merged new numbers ----------
  const vCur = (rid) => { const b = blockOf(rid), c = b && part(b, ".tr-chips"), cur = c && c.children.find((x) => classesOf(x).has("cur")); return cur ? cur.textContent : null; };   // the set the card is on
  const vFlags = (rid) => { const b = blockOf(rid); return b ? { open: classesOf(b).has("open"), summary: classesOf(b).has("summary"), peek: classesOf(b).has("peek") } : null; };
  const vNote = (rid) => { const b = blockOf(rid), sh = b && part(b, ".client-note"); return !!sh && !sh.hidden; };   // the card's note unfolded
  const V1 = { weights: ["60", "", ""], repsDone: ["12", "", ""], setsDone: 1 }, V2 = { weights: ["60", "60", ""], repsDone: ["12", "12", ""], setsDone: 2 };
  const noSquat = (sb, W) => { const s = sb.tables.ft_trainings.get(W); s.data.rows = s.data.rows.filter((r) => r.id !== "sq"); for (const r of s.data.rows) r.label = String(Number(r.label) - 1); bump(s); };   // the iPad deletes Back squat: the others move up one
  const lpAfterLc = (sb, W) => { const s = sb.tables.ft_trainings.get(W); s.data.rows.find((r) => r.id === "lc").label = "2"; s.data.rows.find((r) => r.id === "lp").label = "3"; bump(s); };   // the iPad puts Leg curl before Leg press
  const CR5 = () => [R("sq", "1", "Back squat", DONE), R("lp", "2", "Leg press"), R("lc", "3", "Leg curl"), R("cr", "4", "Calf raise"), R("ca", "5", "Cable row")];
  out.r24.taps = {};
  out.r24.taps.count = await run(async (o) => {                         // Leg curl (drawn 3, now 2) and Calf raise (drawn 4, now 3) each on Set 3; Leg curl's sets count, 4 sets
    const { sb, W } = await live([R("sq", "1", "Back squat", DONE), R("lp", "2", "Leg press"), R("lc", "3", "Leg curl", V1), R("cr", "4", "Calf raise", V1)]);
    await chip("lc", 3); await chip("cr", 3); o.picked = { lc: vCur("lc"), cr: vCur("cr") };
    noSquat(sb, W); o.typed = await typeWeight("lp", "110"); await settle(); o.landed = { keys: look(W).map((x) => x.key + " " + x.names), state: state(W) };
    leave(); await tap(part(blockOf("lc"), ".tr-count")); const row = byId.get("whenPop").children.find((x) => x.textContent === "4 sets"); o.row = !!row; await tap(row, 400); await settle();
    o.after = { lc: vCur("lc"), cr: vCur("cr"), state: state(W) };
  });
  out.r24.taps.undo = await run(async (o) => {                          // Leg curl, 2 sets done, on Set 1 (its Mark set 1 as not done shows); Calf raise on Set 3; Mark set 1 as not done on Leg curl's card, answered
    const { sb, W } = await live([R("sq", "1", "Back squat", DONE), R("lp", "2", "Leg press"), R("lc", "3", "Leg curl", V2), R("cr", "4", "Calf raise", V1)]);
    await chip("lc", 1); await chip("cr", 3); o.picked = { lc: vCur("lc"), cr: vCur("cr") };
    noSquat(sb, W); o.typed = await typeWeight("lp", "110"); await settle();
    leave(); const u = part(blockOf("lc"), ".undo-set"); o.button = u && !u.hidden ? u.textContent : null; await tap(u && !u.hidden ? u : null); o.asked = await answer(true); await settle();
    o.after = { lc: vCur("lc"), cr: vCur("cr"), state: state(W) };
  });
  out.r24.taps.back = await run(async (o) => {                          // Leg curl on Set 3, ahead of its Set 2 (its button reads Back to set 2); Calf raise on Set 3; Back to set 2 on Leg curl's card
    const { sb, W } = await live([R("sq", "1", "Back squat", DONE), R("lp", "2", "Leg press"), R("lc", "3", "Leg curl", V1), R("cr", "4", "Calf raise", V1)]);
    await chip("lc", 3); await chip("cr", 3);
    noSquat(sb, W); o.typed = await typeWeight("lp", "110"); await settle();
    leave(); const c = part(blockOf("lc"), ".complete"); o.button = c ? c.textContent : null; o.tapped = await complete("lc"); await advance(50); await settle();
    o.after = { lc: vCur("lc"), cr: vCur("cr"), state: state(W) };
  });
  out.r24.taps.finish = await run(async (o) => {                        // Leg press finished and opened (2); the iPad puts Leg curl before it (Leg curl 2, Leg press 3); his weight typed into Calf raise; Complete last set on Leg curl's card (drawn 3)
    const { sb, W } = await live([R("sq", "1", "Back squat", DONE), R("lp", "2", "Leg press", DONE), R("lc", "3", "Leg curl", V2), R("cr", "4", "Calf raise")]);
    await openCard("lp"); o.opened = vFlags("lp");
    lpAfterLc(sb, W); o.typed = await typeWeight("cr", "40"); await settle(); o.landed = { keys: look(W).map((x) => x.key + " " + x.names), lp: vFlags("lp"), state: state(W) };
    leave(); o.button = (part(blockOf("lc"), ".complete") || {}).textContent; o.tapped = await complete("lc"); await advance(50); await settle();
    o.after = { lp: vFlags("lp"), lc: vFlags("lc"), state: state(W) };
  });
  out.r24.taps.resume = await run(async (o) => {                        // Leg press finished early (2); Leg curl on Set 3 (3); the iPad deletes Back squat (Leg press 1, Leg curl 2); his weight typed into Calf raise; Leg press's card (drawn 2) opened, Resume this exercise
    const EARLY = { weights: ["95", "", ""], repsDone: ["10", "", ""], setsDone: 1, done: true };
    const { sb, W } = await live([R("sq", "1", "Back squat", DONE), R("lp", "2", "Leg press", EARLY), R("lc", "3", "Leg curl", V1), R("cr", "4", "Calf raise")]);
    await chip("lc", 3); o.picked = vCur("lc");
    noSquat(sb, W); o.typed = await typeWeight("cr", "40"); await settle(); o.landed = { lc: vCur("lc"), state: state(W) };
    leave(); await openCard("lp");
    const b = blockOf("lp"), full = part(b, ".resume-full"), resume = findAll(b, ".resume").find((x) => !classesOf(x).has("resume-full"));
    if (resume) resume.click = () => fire(resume, "click", { detail: 0 });   // as a page's click() does (the summary's Resume passes its tap on to the card's own)
    o.button = full && !full.hidden ? full.textContent : null; o.resumed = await tap(full && !full.hidden ? full : null); await advance(3000); await settle();
    o.after = { lc: vCur("lc"), sets: setsHere(W), state: state(W) };
  });
  out.r24.taps.full = await run(async (o) => {                          // Leg press all done (2); the iPad deletes Back squat (Leg press 1); his weight typed into Leg curl; Leg press's card (drawn 2) opened, Resume this exercise
    const { sb, W } = await live([R("sq", "1", "Back squat", DONE), R("lp", "2", "Leg press", DONE), R("lc", "3", "Leg curl"), R("cr", "4", "Calf raise")]);
    noSquat(sb, W); o.typed = await typeWeight("lc", "55"); await settle();
    leave(); await openCard("lp"); o.opened = vFlags("lp");
    const full = part(blockOf("lp"), ".resume-full"); o.button = full && !full.hidden ? full.textContent : null; await tap(full && !full.hidden ? full : null); await settle();
    o.after = { lp: vFlags("lp"), state: state(W) };
  });
  out.r24.taps.chev = await run(async (o) => {                          // Leg press all done (2); the iPad deletes Back squat (Leg press 1); his weight typed into Leg curl; the chevron on Leg press's card (drawn 2), then a sync draws the page again
    const { sb, W } = await live([R("sq", "1", "Back squat", DONE), R("lp", "2", "Leg press", DONE), R("lc", "3", "Leg curl"), R("cr", "4", "Calf raise")]);
    noSquat(sb, W); o.typed = await typeWeight("lc", "55"); await settle();
    leave(); o.tapped = await tap(part(blockOf("lp"), ".card-chev")); o.at = vFlags("lp");
    await sync(); o.after = { lp: vFlags("lp"), state: state(W) };
  });
  out.r24.taps.peek = await run(async (o) => {                          // his Client view; the iPad deletes Back squat (Leg curl 2, Calf raise 3); his weight typed into Leg press (in play); a tap on Calf raise's card still to come (drawn 4)
    const sb = makeSupabase(), W = wid(); sb.seed("ft_clients", C, MIA); seed(sb, W, CR5()); coachOn(sb); await sync(); fns.setPreview(true); await openW(W);
    noSquat(sb, W); o.typed = await typeWeight("lp", "110"); await settle(); o.landed = { keys: look(W).map((x) => x.key + " " + x.names) };
    leave(); o.tapped = await tap(part(blockOf("cr"), ".group")); await settle();
    o.after = { cr: vFlags("cr"), lc: vFlags("lc"), ca: vFlags("ca"), client: fns.previewOn() };
    fns.setPreview(false);
  });
  out.r24.taps.unpeek = await run(async (o) => {                        // his Client view; Calf raise opened for a look (4); the iPad deletes Back squat (Calf raise 3); his weight typed into Leg press; Calf raise's fold chevron (its card drawn 4)
    const sb = makeSupabase(), W = wid(); sb.seed("ft_clients", C, MIA); seed(sb, W, CR5()); coachOn(sb); await sync(); fns.setPreview(true); await openW(W);
    await openCard("cr"); o.peeked = vFlags("cr");
    noSquat(sb, W); o.typed = await typeWeight("lp", "110"); await settle(); o.landed = { cr: vFlags("cr"), state: state(W) };
    leave(); const b = blockOf("cr"), ch = b && findAll(b, ".card-chev")[0]; o.tapped = await tap(ch); await settle();
    o.after = { cr: vFlags("cr"), lc: vFlags("lc") };
    fns.setPreview(false);
  });
  out.r24.taps.see = await run(async (o) => {                           // Mia's note on Leg curl (3); the iPad deletes Back squat (Leg curl 2); his weight typed into Leg press; See note on Leg curl's card (drawn 3), then a sync draws the page again
    const { sb, W } = await live([R("sq", "1", "Back squat", DONE), R("lp", "2", "Leg press"), R("lc", "3", "Leg curl", NOTE), R("cr", "4", "Calf raise")]);
    noSquat(sb, W); o.typed = await typeWeight("lp", "110"); await settle();
    leave(); await tap(part(blockOf("lc"), ".add-note")); o.at = { shown: vNote("lc"), state: state(W) };
    await sync(); o.after = { shown: vNote("lc"), state: state(W) };
  });
  out.r24.taps.del = await run(async (o) => {                           // Mia's notes on Leg curl (3) and Calf raise (4), both unfolded; the iPad deletes Back squat (Leg curl 2, Calf raise 3); his weight typed into Leg press; Delete on Leg curl's note (its card drawn 3), answered
    const N2 = { clientNote: "Calves tight today", clientNoteBy: "client", clientNoteAt: "2026-11-22T18:30:00.000Z" };
    const { sb, W } = await live([R("sq", "1", "Back squat", DONE), R("lp", "2", "Leg press"), R("lc", "3", "Leg curl", NOTE), R("cr", "4", "Calf raise", N2)]);
    await tap(part(blockOf("lc"), ".add-note")); await tap(part(blockOf("cr"), ".add-note")); o.shown = { lc: vNote("lc"), cr: vNote("cr") };
    noSquat(sb, W); o.typed = await typeWeight("lp", "110"); await settle(); o.landed = { lc: vNote("lc"), cr: vNote("cr"), state: state(W) };
    leave(); const sh = part(blockOf("lc"), ".client-note"), d = sh && part(sh, "button", "Delete"); o.button = !!d; await tap(d); o.asked = await answer(true); await settle();
    await sync(); o.after = { cr: vNote("cr"), lc: vNote("lc"), here: here(W) };
  });

  // ---------- R24-CRD-3, the owner's pick "Ask first" (25 Nov 2026): Save note asks "Replace the note written meanwhile?" before it replaces a note
  // written on that exercise since its box was opened (main.js's cardNoteBase: the note each box was opened on, empty for Add note). Cancel keeps the
  // other side's note, unfolds it and keeps the box with the words in it; Replace saves them. ask: each way the other side's note comes while the
  // box is open (his own save's merge under his finger, a sync that draws the card, her change to the note he is editing, his Client view, the
  // coach's note on her phone); quiet: Saves that ask nothing (nothing changed meanwhile, the texts agree, changed and changed back); regroup: a
  // merge that gives the card another number keeps the note its box was opened on with the note's exercise; box: that note is kept only while its
  // box is open. The third note store is found as the others are: the Map an Edit tap writes the card's key and the note's words into.
  let BASE = null;
  { const sb = makeSupabase(), W = wid(); sb.seed("ft_clients", C, MIA); seed(sb, W, [R("sq", "1", "Back squat", DONE), R("lc", "2", "Leg curl", NOTE)]); coachOn(sb); await sync(); await openW(W);
    await seeNote(W, "lc"); const sh = part(blockOf("lc"), ".client-note"), ed = sh && part(sh, "button", "Edit");
    if (ed) { SPY.on = { kind: "base", key: W + "/2", value: NOTE.clientNote }; fire(ed, "click", { detail: 1 }); SPY.on = null; await advance(20); }
    BASE = SPY.bases.size === 1 ? [...SPY.bases][0] : null;
    out.r24.foundBase = { maps: SPY.bases.size, distinct: !!BASE && BASE !== DRF && BASE !== fns.cardSets().setSel };
    await noteButton("lc", "Discard"); leave(); }
  const notesOf = (W) => ({ open: EXN ? own(W, EXN) : "not found", drafts: DRF ? ownMap(W, DRF) : "not found", bases: BASE ? ownMap(W, BASE) : "not found" });   // the notes unfolded, the notes half written, and the note each open box was opened on
  const sheetNow = () => (askSheet.hidden ? { open: false } : { open: true, title: byId.get("askTitle").textContent, text: byId.get("askText").hidden ? "" : byId.get("askText").textContent, yes: byId.get("askYes").textContent, red: classesOf(byId.get("askYes")).has("danger") });
  const saveAs = async (rid, reply) => {                                 // Save note on the open box of the card with that exercise in it; a question that comes up is read, then answered: "replace" (its red button) or "cancel"
    const b = blockOf(rid), nb = b && part(b, ".exnote"), s = nb && !nb.hidden ? part(nb, "button", "Save note") : null; if (!s) return { tapped: false };
    fire(s, "click", { detail: 1 }); await advance(400);
    const q = sheetNow(); if (q.open) { fire(byId.get(reply === "replace" ? "askYes" : "askNo"), "click", { detail: 1 }); await advance(400); }
    return q;
  };
  const cardWith = (W, rid) => look(W).find((x) => x.names.split("+").includes(nameOf(W, rid))) || null;   // the card drawn with that exercise in it, as the page shows it
  const sentNotes = (sb) => sb.log.filter((x) => x.rpc === "client_row_note").map((x) => x.args.p_row + ": " + x.args.p_note);   // her phone's notes, as sent to the server's rule
  const putNote = (sb, W, rid, n) => { const s = sb.tables.ft_trainings.get(W); Object.assign(s.data.rows.find((r) => r.id === rid), n); bump(s); };   // the other side's note reaches the server (her phone's rule, or the coach's own save from another device)
  const later = async (sb, W, rid) => { leave(); await settle(); await sync(); return { card: cardWith(W, rid), notes: notesOf(W), here: here(W), server: server(sb, W) }; };   // a tap elsewhere, and the next sync
  const HERS = { clientNote: "Left knee hurts on the way down", clientNoteBy: "client", clientNoteAt: "2026-11-24T15:00:00.000Z" }, HERS2 = { ...HERS, clientNote: "Knee hurts now, stopping" };
  const HIS = { clientNote: "Keep the knees out", clientNoteBy: "coach", clientNoteAt: "2026-11-24T15:00:00.000Z" };
  const LP = () => [R("sq", "1", "Back squat", DONE), R("lp", "2", "Leg press"), R("lc", "3", "Leg curl")], LPN = () => [R("sq", "1", "Back squat", DONE), R("lp", "2", "Leg press", NOTE), R("lc", "3", "Leg curl")];
  const herSet = (sb, W) => { const s = sb.tables.ft_trainings.get(W); Object.assign(s.data.rows.find((r) => r.id === "lc"), { weights: ["50", "", ""], repsDone: ["8", "", ""], setsDone: 1 }); bump(s); };   // her set logged on Leg curl: the page is drawn again, her note as it was
  out.r24.ask = {};
  for (const reply of ["cancel", "replace"]) {
    out.r24.ask["merge " + reply] = await run(async (o) => {             // a weight typed into Leg press, then Add note and his words, his finger in the box; her note reaches the server; his weight's save merges it under his finger (the card still drawn as before); Save note
      const { sb, W } = await live(LP());
      o.w = await typeWeight("lp", "100"); await addNote("lp"); o.typed = await typeNote(W, "lp", "Knees out on the way up"); o.opened = notesOf(W);
      putNote(sb, W, "lp", HERS); await settle();
      o.landed = { card: cardWith(W, "lp"), here: here(W), server: server(sb, W), finger: !!document.activeElement && document.activeElement.tagName === "TEXTAREA" };
      o.asked = await saveAs("lp", reply); o.mid = { card: cardWith(W, "lp"), here: here(W), notes: notesOf(W) };
      o.after = await later(sb, W, "lp");
      if (reply === "cancel") { o.again = await saveAs("lp", "cancel"); o.last = await later(sb, W, "lp"); }   // Save note once more, her note in view now
    });
    out.r24.ask["sync " + reply] = await run(async (o) => {              // Add note and his words, a tap elsewhere; her note reaches the server; a sync draws the card (her note folded, his box); Save note
      const { sb, W } = await live(LP());
      await addNote("lp"); o.typed = await typeNote(W, "lp", "Knees out on the way up"); leave();
      putNote(sb, W, "lp", HERS); await sync();
      o.drawn = { card: cardWith(W, "lp"), here: here(W), notes: notesOf(W) };
      o.asked = await saveAs("lp", reply); o.mid = { card: cardWith(W, "lp"), here: here(W), notes: notesOf(W) };
      o.after = await later(sb, W, "lp");
    });
    out.r24.ask["edit " + reply] = await run(async (o) => {              // her note on Leg press unfolded, Edit, his words added, a tap elsewhere; she changes her note; a sync draws the card; Save note
      const { sb, W } = await live(LPN());
      await seeNote(W, "lp"); await editNote("lp"); o.typed = await typeNote(W, "lp", ", sore after set 3"); o.opened = notesOf(W); leave();
      putNote(sb, W, "lp", HERS2); await sync();
      o.drawn = { card: cardWith(W, "lp"), here: here(W), notes: notesOf(W) };
      o.asked = await saveAs("lp", reply); o.mid = { card: cardWith(W, "lp"), here: here(W), notes: notesOf(W) };
      o.after = await later(sb, W, "lp");
    });
    out.r24.ask["phone " + reply] = await run(async (o) => {             // Mia's phone: Add note and her words, a tap elsewhere; the coach's note reaches the server; her sync draws the card; Save note
      const sb = makeSupabase(), W = wid(); sb.seed("ft_clients", C, MIA); seed(sb, W, LP()); phoneOn(sb); await sync(); await openW(W);
      await addNote("lp"); o.typed = await typeNote(W, "lp", "Left knee hurts"); leave();
      putNote(sb, W, "lp", HIS); await sync();
      o.drawn = { card: cardWith(W, "lp"), here: here(W), notes: notesOf(W) };
      o.asked = await saveAs("lp", reply); o.mid = { card: cardWith(W, "lp"), here: here(W), notes: notesOf(W) };
      o.after = await later(sb, W, "lp"); o.sent = sentNotes(sb);
    });
  }
  out.r24.ask["edit finger"] = await run(async (o) => {                  // her note on Leg press: a weight typed into it, See note, Edit, his words added, his finger in the box; she changes her note; his weight's save merges it under his finger; Save note, Cancel
    const { sb, W } = await live(LPN());
    o.w = await typeWeight("lp", "100"); await seeNote(W, "lp"); await editNote("lp"); o.typed = await typeNote(W, "lp", ", sore after set 3");
    putNote(sb, W, "lp", HERS2); await settle();
    o.landed = { card: cardWith(W, "lp"), here: here(W), finger: !!document.activeElement && document.activeElement.tagName === "TEXTAREA" };
    o.asked = await saveAs("lp", "cancel"); o.mid = { card: cardWith(W, "lp"), here: here(W), notes: notesOf(W) };
    o.after = await later(sb, W, "lp");
  });
  out.r24.ask.preview = await run(async (o) => {                         // his Client view: Add note and his words on Leg press, a tap elsewhere; her note reaches the server; a sync draws the card; Save note, Replace
    const sb = makeSupabase(), W = wid(); sb.seed("ft_clients", C, MIA); seed(sb, W, LP()); coachOn(sb); await sync(); fns.setPreview(true); await openW(W);
    o.client = fns.previewOn();
    await addNote("lp"); o.typed = await typeNote(W, "lp", "Knees out on the way up"); leave();
    putNote(sb, W, "lp", HERS); await sync();
    o.drawn = { card: cardWith(W, "lp"), here: here(W) };
    o.asked = await saveAs("lp", "replace"); o.after = await later(sb, W, "lp");
    fns.setPreview(false);
  });
  out.r24.ask["phone edit"] = await run(async (o) => {                   // Mia's phone: her own note on Leg press unfolded, Edit, her words added, a tap elsewhere; the coach changes the note on his Mac; her sync draws the card; Save note, Cancel
    const MINE = { clientNote: "Left knee hurts", clientNoteBy: "client", clientNoteAt: "2026-11-24T14:00:00.000Z" };
    const sb = makeSupabase(), W = wid(); sb.seed("ft_clients", C, MIA); seed(sb, W, [R("sq", "1", "Back squat", DONE), R("lp", "2", "Leg press", MINE), R("lc", "3", "Leg curl")]); phoneOn(sb); await sync(); await openW(W);
    await seeNote(W, "lp"); await editNote("lp"); o.typed = await typeNote(W, "lp", " on the way down"); leave();
    putNote(sb, W, "lp", HIS); await sync();
    o.drawn = { card: cardWith(W, "lp"), here: here(W) };
    o.asked = await saveAs("lp", "cancel"); o.mid = { card: cardWith(W, "lp"), here: here(W) };
    o.after = await later(sb, W, "lp"); o.sent = sentNotes(sb);
  });
  out.r24.quiet = {};
  out.r24.quiet["nothing add"] = await run(async (o) => {                // Add note and his words, a tap elsewhere, a sync that brings nothing new; Save note
    const { sb, W } = await live(LP());
    await addNote("lp"); o.typed = await typeNote(W, "lp", "Knees out on the way up"); leave(); await sync();
    o.asked = await saveAs("lp", "cancel"); o.after = await later(sb, W, "lp");
  });
  out.r24.quiet["nothing edit"] = await run(async (o) => {               // her note on Leg press unfolded, Edit, his words added, a tap elsewhere; a sync brings her set on Leg curl and draws the card, her note as it was; Save note
    const { sb, W } = await live(LPN());
    await seeNote(W, "lp"); await editNote("lp"); o.typed = await typeNote(W, "lp", ", sore after set 3"); leave();
    herSet(sb, W); await sync();
    o.drawn = { card: cardWith(W, "lp"), here: here(W) };
    o.asked = await saveAs("lp", "cancel"); o.after = await later(sb, W, "lp");
  });
  out.r24.quiet["same add"] = await run(async (o) => {                   // Add note and his words; her note with the very same words reaches the server; a sync; Save note
    const { sb, W } = await live(LP());
    await addNote("lp"); o.typed = await typeNote(W, "lp", HERS.clientNote); leave();
    putNote(sb, W, "lp", HERS); await sync();
    o.drawn = { card: cardWith(W, "lp"), here: here(W) };
    o.asked = await saveAs("lp", "cancel"); o.after = await later(sb, W, "lp");
  });
  out.r24.quiet["same edit"] = await run(async (o) => {                  // her note unfolded, Edit, his words added; she changes her note to the very words in his box; a sync; Save note
    const { sb, W } = await live(LPN());
    await seeNote(W, "lp"); await editNote("lp"); o.typed = await typeNote(W, "lp", ", sore after set 3"); leave();
    putNote(sb, W, "lp", { ...HERS, clientNote: NOTE.clientNote + ", sore after set 3" }); await sync();
    o.drawn = { card: cardWith(W, "lp"), here: here(W) };
    o.asked = await saveAs("lp", "cancel"); o.after = await later(sb, W, "lp");
  });
  out.r24.quiet.back = await run(async (o) => {                          // her note unfolded, Edit, his words added; she changes her note, then back to what it was, each seen by a sync; Save note
    const { sb, W } = await live(LPN());
    await seeNote(W, "lp"); await editNote("lp"); o.typed = await typeNote(W, "lp", ", sore after set 3"); leave();
    putNote(sb, W, "lp", HERS2); await sync(); o.between = here(W);
    putNote(sb, W, "lp", { ...NOTE, clientNoteAt: "2026-11-24T15:30:00.000Z" }); await sync();
    o.drawn = { card: cardWith(W, "lp"), here: here(W) };
    o.asked = await saveAs("lp", "cancel"); o.after = await later(sb, W, "lp");
  });
  out.r24.regroup = {};
  const regroupServer = (sb, W, changed) => { calfStarts(sb, W); if (changed) putNote(sb, W, "lc", HERS2); };   // her Start this exercise on Calf raise (2 Calf raise, 3a Leg press, 3b Leg curl), and her note on Leg curl changed
  for (const [name, how, changed, reply] of [["save", "save", true, "replace"], ["sync", "sync", true, "cancel"], ["same", "save", false, "cancel"]]) out.r24.regroup[name] = await run(async (o) => {   // her note on Leg curl (2b) unfolded, Edit, his words added, a tap elsewhere; her new order (and her changed note) reaches this page by his rename's save or by a sync; Save note on the superset's card
    const { sb, W } = await live(SS);
    await seeNote(W, "lc"); await editNote("lc"); o.typed = await typeNote(W, "lc", ", sore after set 3"); o.opened = notesOf(W); leave();
    regroupServer(sb, W, changed);
    if (how === "save") { rename(W, "Legs B"); await settle(); } else await sync();
    o.drawn = { card: cardWith(W, "lc"), here: here(W), notes: notesOf(W) };
    o.asked = await saveAs("lc", reply); o.mid = { card: cardWith(W, "lc"), here: here(W), notes: notesOf(W) };
    o.after = await later(sb, W, "lc");
  });
  out.r24.regroup.finger = await run(async (o) => {                      // the same, his finger still in the box as his rename's save merges her new order and her changed note (the card still drawn as 2); Save note, Replace
    const { sb, W } = await live(SS);
    await seeNote(W, "lc"); await editNote("lc"); o.typed = await typeNote(W, "lc", ", sore after set 3");
    regroupServer(sb, W, true); rename(W, "Legs B"); await settle();
    o.landed = { card: cardWith(W, "lc"), here: here(W), notes: notesOf(W), finger: !!document.activeElement && document.activeElement.tagName === "TEXTAREA" };
    o.asked = await saveAs("lc", "replace"); o.after = await later(sb, W, "lc");
  });
  out.r24.box = await run(async (o) => {                                 // her note on Leg press unfolded, Edit, nothing typed, a tap elsewhere; a sync brings her set on Leg curl and draws the page; then she changes her note, and Edit, his words, Save note
    const { sb, W } = await live(LPN());
    await seeNote(W, "lp"); await editNote("lp"); o.opened = { card: cardWith(W, "lp"), notes: notesOf(W) }; leave();
    herSet(sb, W); await sync();
    o.drawn = { card: cardWith(W, "lp"), notes: notesOf(W) };
    putNote(sb, W, "lp", HERS2); await sync();
    await editNote("lp"); o.typed = await typeNote(W, "lp", " (seen)"); o.reopened = notesOf(W); leave();
    o.asked = await saveAs("lp", "cancel"); o.after = await later(sb, W, "lp");
  });

  out.r24.empty = {};
  for (const reply of ["replace", "cancel"]) out.r24.empty[reply] = await run(async (o) => {   // a weight typed, Add note opened on Leg press and nothing typed, his finger in the box; her note comes in with his weight's save; Save note on the empty box (any question answered with the reply)
    const { sb, W } = await live(LP());
    o.w = await typeWeight("lp", "100"); await addNote("lp"); const ta = part(part(blockOf("lp"), ".exnote"), "textarea"); ta.focus();
    putNote(sb, W, "lp", HERS); await settle();
    o.first = await saveAs("lp", reply);
    await advance(400); o.second = sheetNow(); if (o.second.open) { fire(byId.get("askYes"), "click", { detail: 1 }); await advance(400); }
    o.after = await later(sb, W, "lp");
  });

  // ---------- the twenty-fifth check round (out.r25): the note box's questions, and a card whose exercise left the workout ----------
  // deleted: Save note on an edit of a note the other side deleted meanwhile asks "Save a note deleted meanwhile?" first (R25-CRD-1: her deleted note
  // came back as his, unasked), by a sync, by his own save under his finger and on her phone; his own Delete above his box is no "meanwhile". gone: a
  // note that came on the superset's other exercise under his finger is the card's note now, and Save note asks before it replaces it (R25-CRD-2).
  // emptied: an Edit box emptied over newer words asks one question, "Delete the note written meanwhile?" (R25-CRD-4, R25-TW-5). early: Skip and
  // Finish early on a card whose exercise left the workout set nothing on the card that took its number (R25-CRD-5). editAfterCancel: Edit on the
  // note above a box with words in it keeps them (R25-CRD-6). del: Delete on a note that changed under the finger quotes the newer words (R25-TW-1).
  // lines: the question quotes a note with its line breaks (R25-TW-6). split, renumber, twoBoxes: what Save note measures against stays with the
  // note's own exercise when the iPad splits the superset, when another exercise is deleted, and when a card with a box is deleted (R25-TW-2, -7, -8).
  out.r25 = {};
  const dropNote = (sb, W, rid) => { const s = sb.tables.ft_trainings.get(W), r = s.data.rows.find((x) => x.id === rid); delete r.clientNote; delete r.clientNoteBy; delete r.clientNoteAt; bump(s); };   // the other side's Delete of the note reaches the server
  const emptyBox = async (rid) => { const nb = part(blockOf(rid), ".exnote"), ta = nb && part(nb, "textarea"); if (!ta || nb.hidden) return "no box"; ta.focus(); ta.value = ""; fire(ta, "input"); await advance(20); return ta.value; };   // every word in the open box deleted, the caret left in it
  const saveSays = async (rid, replies) => {                             // Save note on the open box of the card with that exercise in it; every question that comes up is read, then answered in turn ("yes": its own button, Replace, Delete or Save; else Cancel); null when no box is open
    const nb = part(blockOf(rid), ".exnote"), s = nb && !nb.hidden ? part(nb, "button", "Save note") : null; if (!s) return null;
    fire(s, "click", { detail: 1 }); await advance(400); const asked = [];
    for (let i = 0; i < 4; i++) { const q = sheetNow(); if (!q.open) break; asked.push(q); fire(byId.get(replies[i] === "yes" ? "askYes" : "askNo"), "click", { detail: 1 }); await advance(400); }
    return asked;
  };
  const delSays = async (rid, reply) => {                                // Delete on the note unfolded on the card with that exercise in it: the question read, then answered ("yes": Delete; else Cancel); null when no note is unfolded
    const sh = part(blockOf(rid), ".client-note"), d = sh && !sh.hidden ? part(sh, "button", "Delete") : null; if (!d) return null;
    fire(d, "click", { detail: 1 }); await advance(400);
    const q = sheetNow(); if (q.open) { fire(byId.get(reply === "yes" ? "askYes" : "askNo"), "click", { detail: 1 }); await advance(400); }
    return q;
  };
  const inBox = () => !!document.activeElement && document.activeElement.tagName === "TEXTAREA";   // his finger is in a note box
  const CALF = { clientNote: "Calves tight", clientNoteBy: "client", clientNoteAt: "2026-11-22T17:05:00.000Z" };

  // ---------- R25-CRD-1 (and R25-TW-8 b): a note deleted meanwhile ----------
  out.r25.deleted = {};
  for (const reply of ["cancel", "save"]) out.r25.deleted["sync " + reply] = await run(async (o) => {   // Mia's note on Leg press unfolded, Edit, his words added, a tap elsewhere; she deletes her note on her phone; a sync draws the card (Add note, his box); Save note, answered (after Cancel: a tap elsewhere, a sync, and Save note once more)
    const { sb, W } = await live(LPN());
    await seeNote(W, "lp"); await editNote("lp"); o.typed = await typeNote(W, "lp", ", sore after set 3"); o.opened = notesOf(W); leave();
    dropNote(sb, W, "lp"); await sync();
    o.drawn = { card: cardWith(W, "lp"), here: here(W), server: server(sb, W) };
    o.asked = await saveSays("lp", [reply === "save" ? "yes" : "no"]); o.mid = { card: cardWith(W, "lp"), here: here(W) };
    o.after = await later(sb, W, "lp");
    if (reply === "cancel") { o.again = await saveSays("lp", ["no"]); o.last = await later(sb, W, "lp"); }
  });
  out.r25.deleted.finger = await run(async (o) => {   // a weight typed into Leg press, her note unfolded, Edit, his words added, his finger in the box; she deletes her note; his weight's save merges that under his finger (the card still shows her note); Save note, Cancel
    const { sb, W } = await live(LPN());
    o.w = await typeWeight("lp", "100"); await seeNote(W, "lp"); await editNote("lp"); o.typed = await typeNote(W, "lp", ", sore after set 3");
    dropNote(sb, W, "lp"); await settle();
    o.landed = { card: cardWith(W, "lp"), here: here(W), server: server(sb, W), finger: inBox() };
    o.asked = await saveSays("lp", ["no"]); o.mid = { card: cardWith(W, "lp"), here: here(W), server: server(sb, W) };
    o.after = await later(sb, W, "lp");
  });
  out.r25.deleted.phone = await run(async (o) => {   // Mia's phone: her own note on Leg press unfolded, Edit, her words added, a tap elsewhere; the coach deletes it on his Mac; her sync draws the card; Save note, Cancel
    const MINE = { clientNote: "Left knee hurts", clientNoteBy: "client", clientNoteAt: "2026-11-24T14:00:00.000Z" };
    const sb = makeSupabase(), W = wid(); sb.seed("ft_clients", C, MIA); seed(sb, W, [R("sq", "1", "Back squat", DONE), R("lp", "2", "Leg press", MINE), R("lc", "3", "Leg curl")]); phoneOn(sb); await sync(); await openW(W);
    await seeNote(W, "lp"); await editNote("lp"); o.typed = await typeNote(W, "lp", " on the way down"); leave();
    dropNote(sb, W, "lp"); await sync();
    o.drawn = { card: cardWith(W, "lp"), here: here(W) };
    o.asked = await saveSays("lp", ["no"]);
    o.after = await later(sb, W, "lp"); o.sent = sentNotes(sb);
  });
  for (const reply of ["cancel", "save"]) out.r25.deleted["superset " + reply] = await run(async (o) => {   // her note on Leg curl, the second of the superset 2a Leg press, 2b Leg curl (the card's note): a weight typed into Leg curl, See note, Edit, his words added, his finger in the box; she deletes her note; his weight's save merges that under his finger (the card still shows her note, and the card's note state goes, as Leg curl no longer takes the card's note); Save note, answered; a tap elsewhere and a sync
    const { sb, W } = await live(SS);
    o.w = await typeWeight("lc", "100"); await seeNote(W, "lc"); await editNote("lc"); o.typed = await typeNote(W, "lc", ", sore after set 3");
    dropNote(sb, W, "lc"); await settle();
    o.landed = { card: cardWith(W, "lc"), here: here(W), server: server(sb, W), finger: inBox() };
    o.asked = await saveSays("lc", [reply === "save" ? "yes" : "no"]); o.mid = { card: cardWith(W, "lc"), here: here(W) };
    leave(); await settle(); await sync(); o.after = { here: here(W), server: server(sb, W) };
  });
  out.r25.deleted["superset own"] = await run(async (o) => {   // the same, then his own Delete on her note, still drawn on the card, answered; then Save note; a tap elsewhere and a sync
    const { sb, W } = await live(SS);
    o.w = await typeWeight("lc", "100"); await seeNote(W, "lc"); await editNote("lc"); o.typed = await typeNote(W, "lc", ", sore after set 3");
    dropNote(sb, W, "lc"); await settle();
    o.del = await delSays("lc", "yes"); o.asked = await saveSays("lc", ["no"]);
    leave(); await settle(); await sync(); o.after = { here: here(W), server: server(sb, W) };
  });
  out.r25.deleted.own = await run(async (o) => {   // his own Delete on her note shown above his box (her note unfolded, Edit, his words added, a tap elsewhere, then Delete on the note, answered); Save note
    const { sb, W } = await live(LPN());
    await seeNote(W, "lp"); await editNote("lp"); o.typed = await typeNote(W, "lp", ", sore after set 3"); leave();
    o.del = await delSays("lp", "yes"); o.mid = { card: cardWith(W, "lp"), here: here(W) };
    o.asked = await saveSays("lp", ["no"]); o.after = await later(sb, W, "lp");
  });

  // ---------- R25-CRD-2: a note on the superset's other exercise, under his finger ----------
  out.r25.gone = {};
  const SS0 = () => [R("sq", "1", "Back squat", DONE), R("lp", "2a", "Leg press"), R("lc", "2b", "Leg curl"), R("cr", "3", "Calf raise")];   // the superset 2a Leg press, 2b Leg curl, no note on it yet
  for (const [name, note, reply] of [["cancel", NOTE, "no"], ["replace", NOTE, "yes"], ["coach", HIS, "no"]]) out.r25.gone[name] = await run(async (o) => {   // a weight typed into Leg press, Add note on the superset (its box writes on Leg press, the first) and his words, his finger in the box; a note on Leg curl (Mia's; for "coach" his own, from his iPad) reaches the server and his weight's save merges it under his finger; Save note, answered (after Cancel: words typed on, a tap elsewhere and a sync; then she changes her note, a sync, and Save note once more, Replace)
    const { sb, W } = await live(SS0());
    o.w = await typeWeight("lp", "100"); await addNote("lp"); o.typed = await typeNote(W, "lp", "Knees out");
    putNote(sb, W, "lc", note); await settle();
    o.landed = { card: cardWith(W, "lp"), here: here(W), finger: inBox() };
    o.asked = await saveSays("lp", [reply]); o.mid = { card: cardWith(W, "lp"), here: here(W) };
    if (name !== "cancel") { o.after = await later(sb, W, "lp"); return; }
    o.typedOn = await typeNote(W, "lp", " today"); o.after = await later(sb, W, "lp");
    putNote(sb, W, "lc", HERS2); await sync(); o.again = await saveSays("lp", ["yes"]); o.last = await later(sb, W, "lp");
  });

  // ---------- R25-CRD-4, R25-TW-5: an Edit box emptied, her newer words under his finger ----------
  out.r25.emptied = {};
  for (const [name, reply, view] of [["delete", "yes", "coach"], ["cancel", "no", "coach"], ["client view", "yes", "client"]]) out.r25.emptied[name] = await run(async (o) => {   // a weight typed into Leg press; her note unfolded, Edit, every word in the box deleted (the caret stays in it); she changes her note; his weight's save merges it under his finger (the card still shows her old words); Save note, its question answered with Delete (or Cancel), a second one with its red button
    const sb = makeSupabase(), W = wid(); sb.seed("ft_clients", C, MIA); seed(sb, W, LPN()); coachOn(sb); await sync(); if (view === "client") fns.setPreview(true); await openW(W);
    o.client = fns.previewOn();
    o.w = await typeWeight("lp", "100"); await seeNote(W, "lp"); await editNote("lp"); o.emptied = await emptyBox("lp");
    putNote(sb, W, "lp", HERS2); await settle();
    o.landed = { card: cardWith(W, "lp"), here: here(W), finger: inBox() };
    o.asked = await saveSays("lp", [reply, "yes"]);
    o.after = await later(sb, W, "lp");
    fns.setPreview(false);
  });

  // ---------- R25-CRD-5: Skip and Finish early on a card whose exercise left the workout ----------
  out.r25.early = {};
  const LC3 = { weights: ["50", "", ""], repsDone: ["8", "", ""], setsDone: 1 };   // a set logged on Leg curl, two to come
  for (const [name, lp] of [["skip", {}], ["finish", { weights: ["90", "", ""], repsDone: ["10", "", ""], setsDone: 1 }]]) out.r25.early[name] = await run(async (o) => {   // Leg curl (a set logged) picked on Set 3, ahead; the iPad deletes Leg press (Leg curl takes its number 2); his weight typed into Calf raise merges that under his finger, Leg press's card still drawn; Skip exercise on that card (Finish early, a set logged on Leg press), then Skip (Finish & move on)
    const { sb, W } = await live([R("sq", "1", "Back squat", DONE), R("lp", "2", "Leg press", lp), R("lc", "3", "Leg curl", LC3), R("cr", "4", "Calf raise")]);
    await chip("lc", 3);
    serverRows(sb, W, [R("sq", "1", "Back squat", DONE), R("lc", "2", "Leg curl", LC3), R("cr", "3", "Calf raise")]);
    o.typed = await typeWeight("cr", "40"); await settle();
    o.landed = { page: look(W), here: here(W), state: state(W), drawn: !!blockOf("lp") };
    leave(); const e = early("lp"); o.button = e ? e.textContent : null; await tap(e);
    o.sheet = { up: !byId.get("earlySheet").hidden, go: byId.get("esGo").textContent };
    SC.scrollTop = 0; glideKeys.length = 0; o.went = await tap(byId.get("esGo"), 400);
    o.glide = await glided(W); o.scrolled = SC.scrollTop; await settle();
    o.after = { page: look(W), state: state(W), here: here(W), server: server(sb, W) };
  });

  // ---------- R25-CRD-6: Edit on the note above a box with words in it ----------
  out.r25.editAfterCancel = await run(async (o) => {   // Add note on Leg press and his words, a tap elsewhere; her note comes by a sync; Save note asks, and Cancel unfolds her note above his box; then Edit on her note, and Save note
    const { sb, W } = await live(LP());
    await addNote("lp"); o.typed = await typeNote(W, "lp", "Knees out on the way up"); leave();
    putNote(sb, W, "lp", HERS); await sync();
    o.first = await saveSays("lp", ["no"]); o.mid = { card: cardWith(W, "lp"), notes: notesOf(W) };
    o.edited = await editNote("lp"); o.afterEdit = { card: cardWith(W, "lp"), notes: notesOf(W), finger: inBox() };
    o.second = await saveSays("lp", ["yes"]); o.after = await later(sb, W, "lp");
  });
  out.r25.editEmptied = await run(async (o) => {   // her note unfolded, Edit, every word in the box deleted, then Edit again
    const { W } = await live(LPN());
    await seeNote(W, "lp"); await editNote("lp"); o.emptied = await emptyBox("lp");
    o.edited = await editNote("lp"); o.afterEdit = cardWith(W, "lp");
  });

  // ---------- R25-TW-1: Delete on a note that changed under the finger ----------
  out.r25.del = {};
  for (const reply of ["delete", "cancel"]) out.r25.del[reply] = await run(async (o) => {   // her note on Leg press unfolded; a weight typed into Leg press, his finger in its box; she changes her note; his weight's save merges it under his finger (the card still shows her old words); a tap elsewhere; Delete on the note, answered
    const { sb, W } = await live(LPN());
    await seeNote(W, "lp"); o.w = await typeWeight("lp", "100");
    putNote(sb, W, "lp", HERS2); await settle();
    leave(); o.landed = { card: cardWith(W, "lp"), here: here(W), server: server(sb, W) };
    o.asked = await delSays("lp", reply === "delete" ? "yes" : "no"); o.mid = { card: cardWith(W, "lp"), here: here(W) };
    await settle(); o.after = { here: here(W), server: server(sb, W) };
  });
  out.r25.del.plain = await run(async (o) => {   // the card shows her note as it is (her change drawn by a sync); Delete on it
    const { sb, W } = await live(LPN());
    putNote(sb, W, "lp", HERS2); await sync(); await seeNote(W, "lp");
    o.card = cardWith(W, "lp"); o.asked = await delSays("lp", "yes"); await settle(); o.after = { here: here(W), server: server(sb, W) };
  });

  // ---------- R25-TW-6: a note with line breaks, quoted in the question ----------
  out.r25.lines = await run(async (o) => {   // Add note on Leg press and his words, a tap elsewhere; her note, written on three lines, reaches the server and a sync draws it; Save note, Cancel
    const { sb, W } = await live(LP());
    await addNote("lp"); o.typed = await typeNote(W, "lp", "Knees out on the way up"); leave();
    putNote(sb, W, "lp", { ...HERS, clientNote: "Felt fine on set 2.\n\nStopped after set 3.\nIce at home." }); await sync();
    o.asked = await saveSays("lp", ["no"]);
  });

  // ---------- R25-TW-2, R25-TW-7, R25-TW-8 a: what Save note measures against stays with the note's own exercise ----------
  out.r25.split = {};
  for (const how of ["sync", "save"]) out.r25.split[how] = await run(async (o) => {   // her note on Leg curl (2b of 2a Leg press, 2b Leg curl) unfolded, Edit, his words added, a tap elsewhere; on his iPad the superset is split (2 Leg press, 3 Leg curl, 4 Calf raise) and she changes her note; a sync, or his rename's save, brings both; Save note on Leg curl's card, Cancel
    const { sb, W } = await live(SS);
    await seeNote(W, "lc"); await editNote("lc"); o.typed = await typeNote(W, "lc", ", sore after set 3"); o.opened = notesOf(W); leave();
    { const s = sb.tables.ft_trainings.get(W); for (const [id, l] of [["lp", "2"], ["lc", "3"], ["cr", "4"]]) s.data.rows.find((r) => r.id === id).label = l; Object.assign(s.data.rows.find((r) => r.id === "lc"), HERS2); bump(s); }
    if (how === "sync") await sync(); else { rename(W, "Legs B"); await settle(); }
    o.drawn = { card: cardWith(W, "lc"), here: here(W), notes: notesOf(W) };
    o.asked = await saveSays("lc", ["no"]); o.after = await later(sb, W, "lc");
  });
  out.r25.renumber = await run(async (o) => {   // 2a Leg press holds Mia's note, the superset's note; 2b Leg curl has a note of its own; her note on Leg press unfolded, Edit, his words added, a tap elsewhere; Delete exercise on Leg curl; Save note
    const { sb, W } = await live([R("sq", "1", "Back squat", DONE), R("lp", "2a", "Leg press", NOTE), R("lc", "2b", "Leg curl", CALF), R("cr", "3", "Calf raise")]);
    await seeNote(W, "lp"); await editNote("lp"); o.typed = await typeNote(W, "lp", ", sore after set 3"); leave();
    o.asked0 = await delEx("lc"); o.after = { card: cardWith(W, "lp"), here: here(W), notes: notesOf(W) };
    o.asked = await saveSays("lp", ["no"]); o.last = await later(sb, W, "lp");
  });
  out.r25.twoBoxes = await run(async (o) => {   // Edit on Mia's note on Leg curl (3) and his words, a tap elsewhere; then Add note on Leg press (2) and words, a tap elsewhere; Delete exercise on Leg press (Leg curl becomes 2); Save note on Leg curl's card
    const { sb, W } = await live([R("sq", "1", "Back squat", DONE), R("lp", "2", "Leg press"), R("lc", "3", "Leg curl", CALF)]);
    await seeNote(W, "lc"); await editNote("lc"); o.typed = await typeNote(W, "lc", ", sore after set 3"); leave();
    await addNote("lp"); o.typed2 = await typeNote(W, "lp", "Seat one notch lower"); leave();
    o.opened = notesOf(W); o.asked0 = await delEx("lp");
    o.drawn = { card: cardWith(W, "lc"), notes: notesOf(W) };
    o.asked = await saveSays("lc", ["no"]); o.after = await later(sb, W, "lc");
  });

  // ---------- the twenty-sixth check round (out.r26): the note changed while the note box's question is up (R26-CRD-5) ----------
  // A weight typed a moment before (its save goes 0.5 s later) and a question of the note box up: the other side's change to the note reaches the
  // server, and his weight's save merges it into the page under the open question (the sheet still shows what it asked about). The answer must not
  // delete or replace words he never saw: it asks again, quoting the note as it is now; a note deleted under the question is drawn gone, nothing
  // more asked. del: Delete on her note unfolded; emptied: Save note on an Edit box emptied of every word; replace: Save note on his Add note box
  // over her note written meanwhile; deleted: Save note on his edit of her note deleted meanwhile ("Save a note deleted meanwhile?").
  out.r26 = {};
  const HERS3 = { clientNote: "Stopped: sharp pain in left knee", clientNoteBy: "client", clientNoteAt: "2026-11-24T16:30:00.000Z" };   // her newest words, written while his question is up
  const tapAsks = async (rid, where, text) => {                          // a tap on that button of the card with that exercise in it (Delete above her note, Save note in the box): the question it opens, as it comes up
    const b = blockOf(rid), box = part(b, where), btn = box && !box.hidden ? part(box, "button", text) : null; if (!btn) return null;
    fire(btn, "click", { detail: 1 }); await advance(30); return sheetNow();
  };
  const meanwhile = async (sb, W, rid, change) => {                      // her change reaches the server ("gone": she deletes her note), and his weight's save, on its way, merges it into the page under the open question
    if (change === "gone") dropNote(sb, W, rid); else putNote(sb, W, rid, HERS3);
    await advance(2000); await settle(); return { card: cardWith(W, rid), here: here(W), server: server(sb, W), q: sheetNow() };
  };
  const answerAll = async (replies) => {                                 // every question, read once its button can be pressed (350 ms after it opens, one opened by the answer before it too), then answered in turn ("yes": its own button; else Cancel); one more left up is read and left
    const asked = [];
    for (let i = 0; i <= replies.length; i++) {
      await advance(0); await advance(400); const q = sheetNow(); if (!q.open) break; asked.push(q); if (i === replies.length) break;
      fire(byId.get(replies[i] === "yes" ? "askYes" : "askNo"), "click", { detail: 1 });
    }
    return asked;
  };
  for (const [name, change, replies] of [["delete", "change", ["yes", "yes"]], ["cancel", "change", ["yes", "no"]], ["gone", "gone", ["yes"]]]) out.r26["del " + name] = await run(async (o) => {   // her note on Leg press unfolded; a weight typed into Leg press, a tap elsewhere; Delete on her note ("Delete this note?" up); she changes her note (or deletes it), merged by his weight's save under the question; Delete, and what comes after it answered
    const { sb, W } = await live(LPN());
    await seeNote(W, "lp"); o.w = await typeWeight("lp", "100"); leave();
    o.q = await tapAsks("lp", ".client-note", "Delete"); o.under = await meanwhile(sb, W, "lp", change);
    o.asked = await answerAll(replies); o.mid = { card: cardWith(W, "lp"), here: here(W) };
    o.after = await later(sb, W, "lp");
  });
  for (const [name, change, replies] of [["delete", "change", ["yes", "yes"]], ["cancel", "change", ["yes", "no"]], ["gone", "gone", ["yes"]]]) out.r26["emptied " + name] = await run(async (o) => {   // a weight typed into Leg press; her note unfolded, Edit, every word in the box deleted (the caret stays in it); Save note ("Delete this note?" up); she changes her note (or deletes it), merged by his weight's save under the question; Delete, and what comes after it answered
    const { sb, W } = await live(LPN());
    o.w = await typeWeight("lp", "100"); await seeNote(W, "lp"); await editNote("lp"); o.emptied = await emptyBox("lp");
    o.q = await tapAsks("lp", ".exnote", "Save note"); o.under = await meanwhile(sb, W, "lp", change);
    o.asked = await answerAll(replies); o.mid = { card: cardWith(W, "lp"), here: here(W) };
    o.after = await later(sb, W, "lp");
  });
  for (const reply of ["replace", "cancel"]) out.r26["replace " + reply] = await run(async (o) => {   // Add note on Leg press and his words, a tap elsewhere; her note comes by a sync; a weight typed into Leg curl, a tap elsewhere; Save note ("Replace the note written meanwhile?" with her words up); she changes her note, merged by his weight's save under the question; Replace, and the question after it answered
    const { sb, W } = await live(LP());
    await addNote("lp"); o.typed = await typeNote(W, "lp", "Knees out"); leave();
    putNote(sb, W, "lp", HERS); await sync(); o.drawn = cardWith(W, "lp");
    o.w = await typeWeight("lc", "60"); leave();
    o.q = await tapAsks("lp", ".exnote", "Save note"); o.under = await meanwhile(sb, W, "lp", "change");
    o.asked = await answerAll(["yes", reply === "replace" ? "yes" : "no"]); o.mid = { card: cardWith(W, "lp"), here: here(W) };
    o.after = await later(sb, W, "lp");
  });
  for (const reply of ["replace", "cancel"]) out.r26["deleted " + reply] = await run(async (o) => {   // her note unfolded, Edit, his words added, a tap elsewhere; her Delete comes by a sync (his box stays); a weight typed into Leg curl, a tap elsewhere; Save note ("Save a note deleted meanwhile?" up); she writes a new note, merged by his weight's save under the question; Save, and the question after it answered
    const { sb, W } = await live(LPN());
    await seeNote(W, "lp"); await editNote("lp"); o.typed = await typeNote(W, "lp", ", sore after set 3"); leave();
    dropNote(sb, W, "lp"); await sync(); o.drawn = cardWith(W, "lp");
    o.w = await typeWeight("lc", "60"); leave();
    o.q = await tapAsks("lp", ".exnote", "Save note"); o.under = await meanwhile(sb, W, "lp", "change");
    o.asked = await answerAll(["yes", reply === "replace" ? "yes" : "no"]); o.mid = { card: cardWith(W, "lp"), here: here(W) };
    o.after = await later(sb, W, "lp");
  });

  // ---------- R24-CRD-6 (last: main.js's own boot): the coach's session ends elsewhere with his work still to send, and someone signs in on that page ----------
  out.r24.switch = {};
  for (const who of ["Mia", "the coach"]) out.r24.switch[who] = await run(async (o) => {   // the coach on Mia's Legs: Back squat (done, her note on it) opened and her note unfolded, Leg curl on Set 2, a card note half written on Leg press; his rename waits for the signal; his session ends elsewhere (a password changed on his iPad); then Mia (or the coach again) signs in with the sign-in form on that page
    fresh(); localStorage.clear();
    const sb = makeSupabase(), W = wid(); let told = null; sb.tables.trainers = new Map();
    const as = (email) => { sb.auth.getSession = async () => ({ data: { session: email ? { user: { email } } : null }, error: null }); sb.tables.trainers.clear(); if (email === "coach@x.com") sb.tables.trainers.set("t1", { id: "t1", email }); };   // who the server says is signed in (the coach is in the trainers table)
    sb.auth.onAuthStateChange = (cb) => { told = cb; return { data: { subscription: { unsubscribe() {} } } }; };
    sb.auth.signOut = async () => { as(null); if (told) told("SIGNED_OUT", null); return { error: null }; };
    sb.auth.signInWithPassword = async ({ email }) => { as(email); return { data: { session: { user: { email } } }, error: null }; };   // the sign-in form's call
    sb.rpcs.client_my_data = async () => ({ clients: [{ id: C, data: (({ notes, ...rest }) => rest)(clone(sb.tables.ft_clients.get(C).data)) }], trainings: [...sb.tables.ft_trainings.values()].filter((t) => t.client_id === C).map((t) => ({ id: t.id, data: clone(t.data), updated_at: t.updated_at })) });
    sb.rpcs.client_row_note = async (a) => { const s = sb.tables.ft_trainings.get(a.p_training), r = s && s.data.rows.find((x) => x.id === a.p_row); if (!r) throw Object.assign(new Error("no such exercise"), { code: "P0001" }); if (a.p_note) Object.assign(r, { clientNote: a.p_note, clientNoteBy: "client", clientNoteAt: "2026-11-24T18:00:00.000Z" }); else { delete r.clientNote; delete r.clientNoteBy; delete r.clientNoteAt; } bump(s); return null; };
    sb.seed("ft_clients", C, MIA); seed(sb, W, [R("sq", "1", "Back squat", { ...DONE, ...NOTE }), R("lp", "2", "Leg press"), R("lc", "3", "Leg curl")]);
    as("coach@x.com"); globalThis.supabase = { createClient: () => sb }; try { await fns.boot(); await settle(); } finally { delete globalThis.supabase; }   // main.js's own boot: the coach's session
    o.coach = { signedIn: app.get().signedIn, clientMode: app.get().clientMode, has: maps.trainings.has(W) };
    app.set({ view: { name: "training", id: W }, renderedTraining: null }); fns.setPreview(false); fns.render(); await advance(50);
    await openCard("sq"); await seeNote(W, "sq"); await chip("lc", 2); await addNote("lp"); o.typed = await typeNote(W, "lp", "Coach draft: she skips the last rep"); leave();
    sb.setFail({ times: 1e6, message: "Failed to fetch" }); rename(W, "Legs B"); await settle(); sb.setFail(null); app.set({ offline: false });   // his rename waits for the signal
    o.before = { page: look(W), state: state(W), idle: fns.idleDevice() };
    as(null); if (told) told("SIGNED_OUT", null); await settle();
    o.out = { signedIn: app.get().signedIn, kept: maps.trainings.has(W), state: state(W) };
    byId.get("loginEmail").value = who === "Mia" ? "mia@x.com" : "coach@x.com"; byId.get("loginPassword").value = "made-up"; fire(byId.get("loginForm"), "submit"); await settle(); await settle();
    o.in = { signedIn: app.get().signedIn, clientMode: app.get().clientMode, view: app.get().view.name, state: state(W) };
    if (!(app.get().view.name === "training" && app.get().view.id === W)) { app.set({ view: { name: "training", id: W }, renderedTraining: null }); fns.render(); await advance(50); }   // her Legs opened from her list (she lands on it here)
    o.page = look(W); o.look = blocks().some((b) => !!part(b, ".tr-count")) ? "coach" : "client";   // the coach's look has a sets count on each card, the client's none
    o.saved = await saveWhereBox(sb, W); o.saved.sent = sb.log.filter((x) => x.rpc === "client_row_note").map((x) => x.args.p_row + ": " + x.args.p_note);   // Save note on a box she finds open
  });
}

await new Promise((r) => setImmediate(r));
out.rejected = rejected;
process.stdout.write(JSON.stringify(out) + "\n", () => process.exit(0));   // the whole line before the exit (a pipe takes 64 KB at a time: an exit before it drained cut the JSON short once the cases outgrew it)
