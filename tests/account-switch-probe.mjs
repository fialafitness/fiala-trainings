// Run by account-switch.test.js in its own process (v316, the twenty-fourth check round): one gym iPad, two accounts, drawn by the real main.js
// on cards-follow-probe.mjs's stand-ins (its clock and elements), with a stand-in server and sign-in library under it: main.js's own boot,
// the real Sign in form, and a session that ends elsewhere (a password changed on another device) while something still waits for the
// signal, so the device keeps that account's work for its next sign-in.
// - notes: a card note half typed on a workout's page stays with its own account: the next account signing in on that page (the coach after
//   Jane, Jane after the coach) lands on the same workout with no box holding the other's words, and the page keeps none of them; the same
//   account signing in again finds its words still in the box.
// - template: the coach's unsaved typing in his template's name, kept through his session's end, never shows its Unsaved changes bar over
//   the sign-in page, and comes back on the template's page with the bar when he signs in again, on that page or after the app was closed
//   and opened again; the server keeps the template as saved until Save template.
// The note store of main.js that the tests cannot reach (cardNoteDraft) is found by what the page's own handler does with it: the Map the
// typing writes the note into. Prints, as JSON, what each case showed. Made-up people only.
// The twenty-fifth check round's cases (out.r25, at the end): what one account leaves waiting stays that account's while the next one comes in
// (R25-PRV-1 to -4), and the coach's half-typed private note in a client's Notes tab never reaches her page (R25-TW-10).
// The twenty-sixth check round's cases (out.r26, after them): the Sign in and Create account boxes after every Sign out (R26-PRV-1), the half-typed
// notes and the cards' state at both Sign outs and the wipe, and whose name kept words go under (R26-PRV-2, R26-WAP-5), and a password-reset link
// left unfinished that reads and sends nothing of the remembered account's while its role is checked (R26-PRV-3).
import { byId, el } from "./env.js";
import { makeSupabase } from "./fake-supabase.js";
import { TEMPLATES_ID } from "../app/model.js";
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
const SPY = { on: null, sets: new Set(), maps: new Set() };            // the store a handler writes the card's key into, watched for the length of one handler
{ const add0 = Set.prototype.add, set0 = Map.prototype.set;
  Set.prototype.add = function (k) { if (SPY.on && SPY.on.kind === "set" && k === SPY.on.key) SPY.sets.add(this); return add0.call(this, k); };
  Map.prototype.set = function (k, v) { if (SPY.on && SPY.on.kind === "map" && k === SPY.on.key && v === SPY.on.value) SPY.maps.add(this); return set0.call(this, k, v); }; }
for (const id of ["loginForm", "tTitle", "draftSave", "draftDiscard"]) recorder(id);   // heard by main.js as it loads: the sign-in form, the workout's name box, the Unsaved changes bar's buttons
for (const id of ["cNotes", "signout3", "recoveryForm"]) recorder(id);   // (the twenty-fifth check round) and the coach's notes box on a client's Notes tab, Sign out on "Couldn't reach the server", the New password form
for (const id of ["signout", "createBtn", "signupForm", "suDoneBtn", "meDisc"]) recorder(id);   // (the twenty-sixth check round) and Sign out in Settings, Create an account, its form and its Back to sign in, a client's person disc (her Settings)
const draftBar = recorder("draftBar", { hidden: true });               // the Unsaved changes bar (hidden in the markup)
const app = (await import("../app/main.js")).internals();
const { fns, maps } = app;

const JC = "6f8b0d2e-1111-4a3c-9e5f-8b0d2e4f6a1c", JW = "6f8b0d2e-3333-4a3c-9e5f-8b0d2e4f6a1c", TP = "6f8b0d2e-5555-4a3c-9e5f-8b0d2e4f6a1c";   // Jane Example, her Legs, the coach's template Upper A
const AT = "2026-11-10T16:00:00.000Z", OK = { at: "2026-11-18T08:00:00.000Z", by: "client" }, COACH = "coach@x.com", JANE = "jane@x.com";
const HIS = "Coach only: she skips sets when tired, push harder", HERS = "I felt dizzy since my new heart medication";   // a card note half typed by each
const TYPED = "Upper A, his new 6-week block";                         // the coach's unsaved typing in his template's name
let nS = 0; const bump = (s) => { s.updated_at = "2026-11-24T19:" + String(10 + (Math.floor(nS / 50) % 50)).padStart(2, "0") + ":" + String(10 + (nS++ % 50)).padStart(2, "0") + ".000Z"; };
const day = (k) => { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + k); return fns.localIso(d); };   // the app's local day (never UTC)
const clone = (x) => JSON.parse(JSON.stringify(x));
const R = (id, label, name) => ({ id, label, name, sets: 3, reps: "10", rest: "", tempo: "", weights: [], repsDone: [], setsDone: 0, done: false, note: "", alts: [] });
const settle = async () => { const end = NOW + 30000; do await advance(100); while ((app.get().inflight > 0 || maps.timers.size) && NOW < end); await advance(100); };
const until = async (ok, ms = 30000) => { const end = NOW + ms; while (!ok() && NOW < end) await advance(20); return !!ok(); };   // a step of the app, on the probe's own clock
const server = () => {                                                   // the server behind the gym iPad, and the sign-in library on the iPad
  const sb = makeSupabase(); sb.tables.trainers = new Map(); let who = null, told = null, net = true;
  const trainers = () => { sb.tables.trainers.clear(); if (who === COACH) sb.tables.trainers.set("t1", { id: "t1", email: COACH }); };   // the coach's row is all row-level security shows him; a client sees none
  sb.auth = {
    getSession: async () => ({ data: { session: who ? { user: { email: who } } : null }, error: null }),
    getUser: async () => ({ data: { user: who ? { email: who } : null }, error: null }),
    onAuthStateChange: (cb) => { told = cb; return { data: { subscription: { unsubscribe() {} } } }; },
    signInWithPassword: async ({ email }) => { who = String(email || "").trim().toLowerCase(); trainers(); return { data: { session: { user: { email: who } } }, error: null }; },
    signOut: async () => { who = null; trainers(); if (told) told("SIGNED_OUT", null); return { error: null }; },
  };
  sb.as = (email) => { who = email; trainers(); };                       // whose session the library holds as the app opens
  sb.endElsewhere = () => { who = null; trainers(); if (told) told("SIGNED_OUT", null); };   // the session ended on another device (a password changed there): the session gone, then SIGNED_OUT
  sb.who = () => who; sb.tell = (event) => { if (told) told(event, null); };   // (the twenty-fifth check round) whose session the library holds now; an event the library tells the page
  const rpc = sb.rpc; sb.rpc = async (name, args) => { if (net) return rpc(name, args); sb.log.push({ rpc: name, args, offline: true }); return { data: null, error: { message: "Failed to fetch", code: "" } }; };
  sb.signal = (on) => { net = on; sb.setFail(on ? null : { times: 1e6, message: "Failed to fetch" }); };   // no signal: every request fails as the browser's fetch does
  sb.rpcs.client_my_data = async () => ({ clients: [{ id: JC, data: (({ notes, ...rest }) => rest)(clone(sb.tables.ft_clients.get(JC).data)) }], trainings: [...sb.tables.ft_trainings.values()].filter((t) => t.client_id === JC).map((t) => ({ id: t.id, data: clone(t.data), updated_at: t.updated_at })) });
  sb.rpcs.client_row_note = async (a) => { const s = sb.tables.ft_trainings.get(a.p_training), r = s && s.data.rows.find((x) => x.id === a.p_row); if (!r) throw Object.assign(new Error("no such exercise"), { code: "P0001" }); if (a.p_note) Object.assign(r, { clientNote: a.p_note, clientNoteBy: "client", clientNoteAt: "2026-11-24T18:00:00.000Z" }); else { delete r.clientNote; delete r.clientNoteBy; delete r.clientNoteAt; } bump(s); return null; };
  sb.rpcs.client_set_zone = async () => null; sb.rpcs.client_set_profile = async () => null;
  sb.seed("ft_clients", JC, { id: JC, name: "Jane Example", unit: "lb", email: JANE, phone: "3105550100", notes: { log: [] }, choices: { zone: { state: "allow", ...OK }, health: { state: "agreed", ...OK } } });   // (her answers given: no question comes up over her page)
  sb.seed("ft_trainings", JW, { id: JW, clientId: JC, title: "Legs", date: day(1), createdAt: AT, completedAt: null, skippedAt: null, rows: [R("sq", "1", "Back squat"), R("lp", "2", "Leg press")] }, { client_id: JC });
  sb.seed("ft_clients", TEMPLATES_ID, { id: TEMPLATES_ID, name: "Templates", kind: "templates", templatesVersion: 3, builtinsAdopted: 1, folders: [{ id: "f1", name: "Strength", parent: null, kind: "folder", at: AT }] });
  sb.seed("ft_trainings", TP, { id: TP, clientId: TEMPLATES_ID, title: "Upper A", date: "2026-01-01", createdAt: AT, completedAt: null, skippedAt: null, template: { program: "My templates", phase: 0, stage: 0, n: 1, folder: "f1" }, rows: [R("t1", "1", "Bench press")] });
  return sb;
};
let DRF = null;                                                           // main.js's cardNoteDraft (the card notes half typed), once found
const thrown = [];
const cardState = () => { const c = fns.cardSets(); for (const s of [c.openBlocks, c.setSel]) s.clear(); if (DRF) DRF.clear(); };
const fresh = () => { fire(document.body, "keydown", { key: "Escape" }); Q.length = 0; delete globalThis.supabase; app.reset(); fns.leaveSettings(); fns.setPreview(false); made.length = 0; rowsEl.replaceChildren(); whenBg.hidden = true; askSheet.hidden = true; draftBar.hidden = true; document.body.classList.remove("draft"); document.activeElement = null; cardState(); };
const launch = async (sb, email) => {                                    // the app opened (main.js's own boot), the library holding this person's session (none: the sign-in page)
  sb.as(email); globalThis.supabase = { createClient: () => sb };
  let over = false; fns.boot().then(() => { over = true; }, (e) => { over = true; thrown.push("boot: " + String((e && e.message) || e)); });
  const ok = await until(() => over); await settle(); return ok;
};
const closeApp = () => {                                                 // the app closed: its page and its timers go, only what the device keeps is left
  const keep = Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i)).map((k) => [k, localStorage.getItem(k)]);
  Q.length = 0; delete globalThis.supabase; app.reset(); fns.leaveSettings(); for (const [k, v] of keep) if (v != null) localStorage.setItem(k, v);
  app.set({ sb: null, signedIn: false, clientMode: false, myClientId: null, backend: null, offline: false, offlineEntry: null, sessionEmail: "", pendingOwner: "", view: { name: "clients" }, templateDraft: null, renderedTraining: null });
  made.length = 0; rowsEl.replaceChildren(); draftBar.hidden = true; document.body.classList.remove("draft"); byId.get("tTitle").value = ""; document.activeElement = null; cardState();   // (a new page: nothing drawn, no bar, no card state)
};
const signIn = async (email) => {                                        // the real Sign in form, on the sign-in page
  document.getElementById("loginEmail").value = email; document.getElementById("loginPassword").value = "made-up-pass-123";
  fire(byId.get("loginForm"), "submit");
  const ok = await until(() => { const g = app.get(); return g.signedIn && g.sessionEmail === email && !g.entering && !g.syncing; }); await settle(); return ok;
};
const openW = async (W) => { const view = { name: "training", id: W }; app.set({ view, renderedTraining: null }); localStorage.setItem("fiala.trainings.view", JSON.stringify(view)); fns.render(); await advance(50); };   // the workout's page opened (its view kept on the device, as go() keeps it)
const leave = () => { const a = document.activeElement; if (a && typeof a.blur === "function") a.blur(); document.activeElement = document.body; };   // a tap elsewhere: the box lets go
// ---------- what the page shows, and what it keeps ----------
const blocks = () => rowsEl.children.filter((b) => classesOf(b).has("block"));
const rowIds = (b) => findAll(b, ".row").map((r) => r.dataset && r.dataset.id).filter((x, i, a) => x && a.indexOf(x) === i);
const blockOf = (rid) => blocks().find((b) => rowIds(b).includes(rid)) || null;   // the card drawn with that exercise in it
const part = (b, sel, text) => (b ? findAll(b, sel).find((x) => text == null || x.textContent === text) || null : null);
const nameOf = (rid) => { const r = ((maps.trainings.get(JW) || {}).rows || []).find((x) => x && x.id === rid); return r ? r.name : rid; };
const boxes = () => blocks().map((b) => { const nb = part(b, ".exnote"), ta = nb && part(nb, "textarea"); return nb && !nb.hidden ? rowIds(b).map(nameOf).join("+") + ": " + ta.value : null; }).filter(Boolean);   // every note box open on the page, with its words
const drafts = (W) => (DRF ? [...DRF].filter(([k]) => k.startsWith(W + "/")).map(([k, v]) => k.slice(W.length + 1) + ": " + v) : "not found");   // the card notes the page keeps half typed for the workout
const whereNow = () => { const g = app.get(), v = g.view; return { as: g.signedIn ? (g.clientMode ? "Jane" : "the coach") : "signed out", view: v.name === "training" ? (v.id === JW ? "Legs" : v.id === TP ? "Upper A" : v.id) : v.name, drawn: g.renderedTraining === JW ? "Legs" : g.renderedTraining === TP ? "Upper A" : g.renderedTraining, login: !byId.get("vLogin").hidden }; };
const serverNote = (sb) => { const r = sb.tables.ft_trainings.get(JW).data.rows.find((x) => x.id === "sq"); return r.clientNote ? r.clientNote + " (" + (r.clientNoteBy || "client") + ")" : null; };
const tap = async (e) => { if (!e) return false; fire(e, "click", { detail: 1 }); await advance(20); return true; };
const addNote = async (rid) => tap(part(blockOf(rid), ".add-note"));   // a card with no note: Add note opens the box
const typeNote = async (W, rid, text) => {                              // typed into the card's open note box (the Map it writes the words into is watched until found)
  const b = blockOf(rid), nb = part(b, ".exnote"), ta = nb && part(nb, "textarea"); if (!ta || nb.hidden) return "no box";
  ta.focus(); ta.value = String(ta.value || "") + text;
  if (!DRF) SPY.on = { kind: "map", key: W + "/" + b.dataset.key, value: ta.value }; fire(ta, "input"); SPY.on = null;
  if (!DRF && SPY.maps.size === 1) DRF = [...SPY.maps][0];
  await advance(20); return ta.value;
};
const saveNote = async () => { const nb = blocks().map((b) => part(b, ".exnote")).find((x) => x && !x.hidden); return tap(nb && part(nb, "button", "Save note")); };   // Save note under the box that is open
const tpl = () => { const d = app.get().templateDraft, s = (() => { try { const x = JSON.parse(localStorage.getItem("fiala.trainings.draft") || "null"); return x && x.doc ? x.doc.title : null; } catch (_) { return "unreadable"; } })(), copy = localStorage.getItem("fiala.trainings.v1") || ""; return { draft: d ? (d.dirty ? "unsaved" : "clean") : null, stored: s, bar: !draftBar.hidden, marked: document.body.classList.contains("draft"), copyTyped: copy.includes(TYPED) }; };
const out = { notes: {}, template: {} };
const run = async (f) => { const o = {}; try { await f(o); } catch (e) { o.error = String((e && e.stack) || e).slice(0, 1500); } return o; };

// ---------- notes: a card note half typed, another change waiting, the session ends elsewhere, the next person signs in on that page ----------
for (const order of ["coach first", "Jane first", "coach again"]) out.notes[order] = await run(async (o) => {
  const sb = server(), first = order === "Jane first" ? JANE : COACH, next = order === "coach first" ? JANE : COACH; fresh();
  o.launched = await launch(sb, first);                                  // signed in on the gym iPad, the first sync in
  await openW(JW);                                                        // Jane's Legs
  o.opened = whereNow();
  await addNote("sq"); o.typedInto = await typeNote(JW, "sq", first === COACH ? HIS : HERS); leave();
  o.typed = { boxes: boxes(), drafts: drafts(JW) };
  sb.signal(false);                                                       // the gym's Wi-Fi drops; another change of theirs waits for it
  if (first === COACH) { maps.clients.get(JC).phone = "3105550199"; fns.scheduleSave("clients", JC, 0); } else fns.setProfile(JC, "unit", "kg");
  await settle();
  o.waiting = maps.dirty.size > 0;
  sb.endElsewhere(); await settle();                                      // the session ends elsewhere: the device keeps its work for the same account
  o.ended = whereNow();
  sb.signal(true); app.set({ offline: false });
  o.signedIn = await signIn(next);                                        // the next person signs in on that page
  o.landed = { ...whereNow(), boxes: boxes(), drafts: drafts(JW) };
  if (o.landed.boxes.length) { await saveNote(); await settle(); }        // Save note under what was found typed there
  o.server = serverNote(sb);
});

out.notes["coach first, nothing else waiting"] = await run(async (o) => {   // the same with nothing else waiting: the device is wiped, and Jane opens her Legs herself
  const sb = server(); fresh();
  o.launched = await launch(sb, COACH);
  await openW(JW); o.opened = whereNow();
  await addNote("sq"); o.typedInto = await typeNote(JW, "sq", HIS); leave();
  o.typed = { boxes: boxes(), drafts: drafts(JW) };
  o.waiting = maps.dirty.size > 0;
  sb.endElsewhere(); await settle();                                      // his session ends elsewhere: nothing waits, so the device is wiped
  o.ended = { login: !byId.get("vLogin").hidden, records: maps.clients.size + maps.trainings.size };
  o.signedIn = await signIn(JANE);
  o.landed = whereNow();
  await openW(JW);                                                        // she opens her Legs
  o.reopened = { ...whereNow(), boxes: boxes(), drafts: drafts(JW) };
  if (o.reopened.boxes.length) { await saveNote(); await settle(); }
  o.server = serverNote(sb);
});

// ---------- template: the coach's typing in his template's name when his session ends elsewhere with his change waiting ----------
for (const where of ["on that page", "after the app was closed and opened again"]) out.template[where] = await run(async (o) => {
  const sb = server(); fresh();
  o.launched = await launch(sb, COACH);
  await openW(TP);                                                        // his template's page
  const tb = byId.get("tTitle"); fire(tb, "focus"); tb.focus(); tb.value = TYPED; fire(tb, "input"); await advance(20); leave();   // his new name typed into it
  o.typed = { ...tpl(), title: tb.value, at: whereNow() };
  sb.signal(false); maps.clients.get(JC).phone = "3105550199"; fns.scheduleSave("clients", JC, 0); await settle();   // the Wi-Fi drops: his change of Jane's phone waits
  o.waiting = maps.dirty.size > 0;
  sb.endElsewhere(); await settle();                                      // his session ends elsewhere (his password changed on his phone)
  o.ended = { ...tpl(), at: whereNow() };
  sb.signal(true); app.set({ offline: false });
  if (where.startsWith("after")) { closeApp(); o.relaunched = await launch(sb, null); o.reopened = { ...tpl(), at: whereNow() }; }   // opened again, no session: the sign-in page
  o.signedIn = await signIn(COACH);                                       // he signs in again
  o.back = { ...tpl(), title: tb.value, at: whereNow(), server: sb.tables.ft_trainings.get(TP).data.title };
  if (o.back.bar) { await tap(byId.get("draftSave")); await settle(); }   // Save template
  o.saved = { ...tpl(), server: sb.tables.ft_trainings.get(TP).data.title };
});

// ---------- the twenty-fifth check round (v316, 25 Nov 2026): what one account leaves waiting on the gym iPad stays that account's, whatever happens while the next one comes in ----------
// - R25-PRV-1: work kept for its owner after a session ended elsewhere stays the owner's while the next account's role check is out: the Wi-Fi's
//   return then (the window's online event, the real handler) writes the queue, and the next account's page never takes the work on as its own,
//   at once or after "Couldn't reach the server" and the app closed and opened again; a save of the last account's still trying again after a
//   server error never goes out through the next account's session.
// - R25-PRV-2: Sign out on "Couldn't reach the server" hands the device back when what waits is the last account's, and keeps it for that account.
// - R25-PRV-3: the last account's Couldn't save banner never comes up on the next account's page.
// - R25-PRV-4: a password-reset link opened where the coach's app was left open draws nothing of his, and no bar or sync of his stays behind its
//   New password page; nor when the library tells an open page of his that a reset link was opened (a browser where one window at a time cannot hold).
// - R25-TW-10: the coach's half-typed private note in a client's Notes tab never reaches her page.
// Each case keeps its own unhandled rejections (out.r25.*.rejected), so one case's trouble never reads as another's.
out.r25 = {};
{ const qs0 = document.querySelector; document.querySelector = (sel) => (/^\.(sheet-bg|crop-view)\b/.test(String(sel)) ? null : qs0(sel)); }   // (from here on) no sheet and no photo framing up: held() reads false, so an alert that waits for them comes up (the cases above never needed it)
const OC = "6f8b0d2e-2222-4a3c-9e5f-8b0d2e4f6a1c", OW = "6f8b0d2e-4444-4a3c-9e5f-8b0d2e4f6a1c";   // Omar Sample and his Legs
const OMAR_OLD = "3105550177", OMAR_NEW = "3105550170", MAC_TITLE = "Legs (renamed on the Mac)";
const VIEWS = ["vLogin", "vSignup", "vPassword", "vExercises", "vExercise", "vPackages", "vSettings", "vClientCard", "vHealth", "vSafety", "vHistory", "vWorkouts", "vBests", "vLift", "vCatalog", "vData", "vNumber", "vRecovery", "vWaiting", "vCelebrate", "vClients", "vClient", "vTraining"];
const gym = () => {                                                       // the gym's server with Omar too, and the rule a client's set is logged by
  const sb = server();
  sb.seed("ft_clients", OC, { id: OC, name: "Omar Sample", unit: "lb", email: "omar@x.com", phone: OMAR_OLD, notes: { log: [{ id: "n9", at: AT, text: "Cardiologist letter on file" }] } });
  sb.seed("ft_trainings", OW, { id: OW, clientId: OC, title: "Omar Legs", date: day(2), createdAt: AT, completedAt: null, skippedAt: null, rows: [R("sq", "1", "Back squat")] }, { client_id: OC });
  sb.rpcs.client_log_set = async (a) => { const s = sb.tables.ft_trainings.get(a.p_training), r = s && s.data.rows.find((x) => x.id === a.p_row); if (!r) throw Object.assign(new Error("no such exercise"), { code: "P0001" }); Object.assign(r, { weights: a.p_weights, repsDone: a.p_reps, setsDone: a.p_sets_done, done: a.p_done }); bump(s); return a.p_seq == null ? null : a.p_seq; };
  return sb;
};
const winFire = (type) => { for (const l of [...(WIN[type] || [])]) l.fn({ type }); };   // the window's own event, to every listener the app gave it (sync.js's and photos.js's)
const slowRole = (sb, ms, at, during, killed = false) => {                // the next sign-in's role check (the trainers read) takes ms on the gym's Wi-Fi; `during` happens at ms `at` of it; killed: it never answers ("Failed to fetch")
  const real = sb.from; let once = false;
  sb.from = (table) => { const b = real(table); if (table !== "trainers" || once) return b; once = true; const then0 = b.then;
    b.then = (res, rej) => { if (during) setTimeout(during, at); return new Promise((r) => setTimeout(r, ms)).then(() => (killed ? { data: null, error: { message: "Failed to fetch", code: "" } } : new Promise((ok, no) => then0.call(b, ok, no)))).then(res, rej); };
    return b; };
  return () => { sb.from = real; };
};
const janeSet = () => { const t = maps.trainings.get(JW), r = t.rows.find((x) => x.id === "lp"); r.weights = ["95"]; r.repsDone = ["10"]; r.setsDone = 1; if (!maps.pendingWeightRows.has(JW)) maps.pendingWeightRows.set(JW, new Set()); maps.pendingWeightRows.get(JW).add("lp"); fns.scheduleSave("trainings", JW, 0); };   // 95 lb, 10 reps on her Leg press, as the set's boxes write it
const macEdits = (sb) => { const s = sb.tables.ft_trainings.get(JW); s.data.title = MAC_TITLE; s.data.rows.push(R("hc", "3", "Hamstring curl")); bump(s); };   // the coach on his Mac, meanwhile: her Legs renamed, Hamstring curl added
const MAC = [MAC_TITLE, "1 Back squat", "2 Leg press", "3 Hamstring curl"];
const NM = { [JC]: "Jane", [JW]: "Jane's Legs", [OC]: "Omar", [OW]: "Omar's Legs", [TP]: "Upper A", [TEMPLATES_ID]: "Templates" };
const nm = (k) => { const x = String(k), id = x.slice(x.indexOf("/") + 1); return NM[id] || x; }, names = (it) => [...it].map(nm);   // a record by its name ("clients/<id>", "trainings/<id>" or the id)
const said = (t) => (t ? [t.title, ...(t.rows || []).map((r) => r.label + " " + r.name + ((r.weights || []).length ? " " + r.weights.join("/") : ""))] : null);
const queued = () => { const q = JSON.parse(localStorage.getItem("fiala.pending.v1") || "{}"); return { owner: q.owner || null, waiting: (q.dirty || []).map(nm), weights: (q.weights || []).map((e) => nm(e[0])) }; };   // the queue the device keeps: whose, the records still to send, the workouts with sets still to send
const allStored = () => Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i) + "=" + (localStorage.getItem(localStorage.key(i)) || "")).join("\n");
const idOf = (e) => (e.payload && e.payload.id) || ((e.filters || []).find((f) => f[0] === "eq" && f[1] === "id") || [])[2];
const sentOnJane = (sb, from) => sb.log.slice(from).filter((e) => (e.table && e.op !== "select" && [JC, JW].includes(idOf(e))) || (e.rpc && e.rpc !== "client_my_data" && !e.offline)).map((e) => (e.rpc ? "rpc " + e.rpc : e.op + " " + (idOf(e) === JW ? "her Legs" : "her record") + (e.payload && e.payload.data && e.payload.data.title ? " as \u201c" + e.payload.data.title + "\u201d" : "")));   // what reached the server about Jane (her Legs, her record) or in a client's rule
const newPage = () => {                                                   // the app opened again: a page of its own (sync.js names each page: what the device kept was written by the page before), its markup as index.html has it
  for (const k of ["fiala.pending.v1", "fiala.pending.answers.v1"]) { const v = JSON.parse(localStorage.getItem(k) || "null"); if (v && typeof v === "object") { v.tab = "the page before"; localStorage.setItem(k, JSON.stringify(v)); } }
  if (localStorage.getItem("fiala.pending.tab") != null) localStorage.setItem("fiala.pending.tab", "the page before");
  for (const id of VIEWS) byId.get(id).hidden = true; draftBar.hidden = true; byId.get("saveBanner").hidden = true; askSheet.hidden = true;
};
const typeTemplateName = async () => { await openW(TP); const tb = byId.get("tTitle"); fire(tb, "focus"); tb.focus(); tb.value = TYPED; fire(tb, "input"); await advance(20); leave(); };   // his new name typed into Upper A: the Unsaved changes bar comes up
const alertNow = () => { const a = made.filter((e) => classesOf(e).has("pa-ask") && !e.removed).pop(); return a ? findAll(a, ".pa-title, .pa-text").map((x) => x.textContent).join(" \u00b7 ") : null; };   // the alert up now (askChoice's), in its words
const look = () => { const g = app.get(); return { signedIn: !!g.signedIn, as: g.sessionEmail || null, shown: VIEWS.filter((id) => !byId.get(id).hidden), bar: !draftBar.hidden }; };   // what the screen shows, and whom the page works as
const r25 = async (f) => { const n0 = rejected.length, t0 = thrown.length; const o = await run(f); o.rejected = rejected.splice(n0); o.thrown = thrown.splice(t0); location.hash = ""; return o; };   // (a case's own rejections and boot errors: the cases above never see them)

// R25-PRV-1: Jane's set waits, her session ends elsewhere, the coach signs in on that page as the Wi-Fi comes back (or with nothing else happening)
out.r25.race = {};
for (const how of ["nothing else happens meanwhile", "the Wi-Fi comes back meanwhile"]) out.r25.race[how] = await r25(async (o) => {
  const sb = gym(); fresh();
  o.launched = await launch(sb, JANE);                                    // Jane on the gym iPad, her first read in
  sb.signal(false); janeSet(); await settle();                            // the Wi-Fi drops as she logs 95 lb on her Leg press: her set waits
  o.waits = { client: app.get().clientMode, queue: queued() };
  sb.endElsewhere(); await settle();                                      // her session ends elsewhere (her password changed on her phone): the device keeps her set for her
  o.kept = { login: !byId.get("vLogin").hidden, owner: app.get().pendingOwner, dirty: names(maps.dirty.keys()) };
  macEdits(sb); sb.signal(true); app.set({ offline: false });
  const from = sb.log.length, undo = slowRole(sb, 1500, 500, how.startsWith("the Wi-Fi") ? () => { o.atEvent = look(); winFire("online"); } : null);
  o.signedIn = await signIn(COACH); undo(); await settle();               // the coach signs in there; his role check takes 1.5 s
  o.coach = { client: app.get().clientMode, owner: app.get().pendingOwner, dirty: names(maps.dirty.keys()), weights: names(maps.pendingWeightRows.keys()), queue: queued(), sent: sentOnJane(sb, from), server: said(sb.tables.ft_trainings.get(JW).data) };
});

// R25-PRV-1, the other way: the coach's change and his template's unsaved name wait, his session ends elsewhere, Jane signs in as the Wi-Fi comes back
out.r25.otherWay = await r25(async (o) => {
  const sb = gym(); fresh();
  o.launched = await launch(sb, COACH);
  await typeTemplateName();
  sb.signal(false); maps.clients.get(OC).phone = OMAR_NEW; fns.scheduleSave("clients", OC, 0); await settle();   // the Wi-Fi drops: his change of Omar's phone waits
  sb.endElsewhere(); await settle();                                      // his session ends elsewhere: the device keeps his change and his typing for him
  o.kept = { ...tpl(), owner: app.get().pendingOwner, dirty: names(maps.dirty.keys()) };
  sb.signal(true); app.set({ offline: false });
  const undo = slowRole(sb, 1500, 500, () => { o.atEvent = look(); winFire("online"); });
  o.signedIn = await signIn(JANE); undo(); await settle(); fns.localBackend.save(); await settle();
  o.jane = { client: app.get().clientMode, owner: app.get().pendingOwner, ...tpl(), typed: allStored().includes(TYPED), queue: queued(), template: maps.trainings.has(TP), omar: maps.clients.has(OC) || allStored().includes("Omar Sample") };
});

// R25-PRV-1: the same Wi-Fi blip kills the coach's role check ("Couldn't reach the server"); he closes the app and opens it again
out.r25.problemThenRelaunch = await r25(async (o) => {
  const sb = gym(); fresh();
  o.launched = await launch(sb, JANE);
  sb.signal(false); janeSet(); fns.setChoice("zone", "deny"); await settle();   // the Wi-Fi drops: her set and her Don't Allow (Share time zone with coach) wait
  o.waits = { queue: queued(), answers: names(maps.pendingChoices.keys()) };
  sb.endElsewhere(); await settle();
  macEdits(sb); sb.signal(true); app.set({ offline: false });
  const undo = slowRole(sb, 1500, 500, () => winFire("online"), true);    // the blip: the online event as it ends, and the role check never answers
  o.signedIn = await signIn(COACH); undo(); await settle();
  o.problem = { page: !byId.get("vWaiting").hidden, words: byId.get("waitingText").textContent };
  closeApp(); newPage();                                                  // he closes the app and opens it again, his session still in the library
  const from = sb.log.length;
  o.relaunched = await launch(sb, COACH);
  o.coach = { client: app.get().clientMode, owner: app.get().pendingOwner, dirty: names(maps.dirty.keys()), weights: names(maps.pendingWeightRows.keys()), answers: names(maps.pendingChoices.keys()), queue: queued(), sent: sentOnJane(sb, from), server: said(sb.tables.ft_trainings.get(JW).data), zone: sb.tables.ft_clients.get(JC).data.choices.zone.state };
});

// R25-PRV-1: Jane's save meets a server error and tries again; her session ends between two tries and the coach signs in at once
out.r25.retrying = await r25(async (o) => {
  const sb = gym(); fresh();
  o.launched = await launch(sb, JANE);
  sb.rpcs.client_log_set = async () => { throw Object.assign(new Error("upstream connect error"), { code: "XX000" }); };   // a server hiccup: her save tries again in about a second, then two, then three
  janeSet();
  o.tried = await until(() => sb.log.some((e) => e.rpc === "client_log_set")); await advance(100);
  sb.endElsewhere();                                                      // her session ends elsewhere between two tries
  macEdits(sb);
  const from = sb.log.length;
  o.signedIn = await signIn(COACH);                                       // the coach signs in on that page at once
  o.switched = { client: app.get().clientMode, owner: app.get().pendingOwner, dirty: names(maps.dirty.keys()) };
  await advance(8000); await settle();                                    // her save's tries run out
  o.coach = { sent: sentOnJane(sb, from), server: said(sb.tables.ft_trainings.get(JW).data) };
});

// R25-PRV-2: the coach's change of Omar's phone and his new photo of Omar wait; his session ends elsewhere; Jane's role check cannot reach the server; she taps Sign out
out.r25.problemSignOut = await r25(async (o) => {
  const sb = gym(); fresh(); await fns.resetPhotos();
  try {
    o.launched = await launch(sb, COACH);
    sb.signal(false); sb.storage.fail = { times: 1e6, message: "Failed to fetch" };   // no signal
    maps.clients.get(OC).phone = OMAR_NEW; fns.scheduleSave("clients", OC, 0);       // his change of Omar's phone
    await fns.setPhoto(OC, new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], { type: "image/jpeg" })); await settle();   // and his new photo of Omar
    o.waits = { owner: app.get().pendingOwner, dirty: names(maps.dirty.keys()), photo: fns.photoQueue().has(OC) };
    sb.endElsewhere(); await settle();                                    // his session ends elsewhere: the device keeps both for him
    sb.signal(true); sb.storage.fail = null; app.set({ offline: false });
    sb.setFail({ table: "trainers", times: 1e6, message: "Failed to fetch" });   // the check of the next person's role cannot reach the server
    o.signedIn = await signIn(JANE);
    o.problem = { ...look(), words: byId.get("waitingText").textContent };
    sb.setFail(null);
    fire(byId.get("signout3"), "click"); await settle();                  // she taps that page's Sign out to hand the iPad back
    o.tapped = { ...look(), asked: alertNow(), owner: app.get().pendingOwner || null, dirty: names(maps.dirty.keys()), photo: fns.photoQueue().has(OC) };
    if (o.tapped.shown.includes("vLogin")) { o.coachIn = await signIn(COACH); await settle(); }   // the coach signs in there
    const om = sb.tables.ft_clients.get(OC).data;
    o.server = { phone: om.phone, photo: !!om.photo && sb.storage.files.has("photos/" + OC + "/" + om.photo + ".jpg") };
  } finally { await fns.resetPhotos(); }
});

// R25-PRV-3: the coach's save fails for good, his session ends elsewhere with work waiting, Jane signs in there
out.r25.banner = {};
for (const why of ["an outage (four tries refused)", "a refusal for good (that email is on another client)"]) out.r25.banner[why] = await r25(async (o) => {
  const sb = gym(); fresh();
  o.launched = await launch(sb, COACH);
  if (why.startsWith("an outage")) { sb.setFail({ table: "ft_clients", times: 1e6, message: "upstream server error", code: "XX000" }); maps.clients.get(OC).phone = OMAR_NEW; fns.scheduleSave("clients", OC, 0); }
  else {
    sb.signal(false); maps.trainings.get(OW).title = "Omar Legs B"; fns.scheduleSave("trainings", OW, 0); await settle(); sb.signal(true); app.set({ offline: false });   // his rename of Omar's Legs waits for the signal
    sb.setFail({ table: "ft_clients", op: "update", times: 1e6, message: "duplicate key value violates unique constraint", code: "23505" }); maps.clients.get(OC).email = JANE; fns.scheduleSave("clients", OC, 0);   // then the server refuses Omar's new email for good
  }
  o.failed = await until(() => app.get().failed); await settle(); sb.setFail(null);
  o.coach = { banner: !byId.get("saveBanner").hidden, words: byId.get("saveWhy").textContent, waiting: maps.dirty.size > 0 };
  sb.endElsewhere(); await settle();
  o.signInPage = { login: !byId.get("vLogin").hidden, banner: !byId.get("saveBanner").hidden };
  o.signedIn = await signIn(JANE); await settle();
  o.jane = { client: app.get().clientMode, banner: !byId.get("saveBanner").hidden, failed: !!app.get().failed };
});

// R25-PRV-4: the coach's template typed and the app closed without Sign out; Jane opens her password-reset link on that iPad
const linkCheck = (sb, email, ms) => { sb.auth.getSession = () => new Promise((r) => setTimeout(() => { sb.as(email); r({ data: { session: { user: { email } } }, error: null }); setTimeout(() => sb.tell("PASSWORD_RECOVERY"), 0); }, ms)); };   // the library checks the link's token (one round trip), then holds the link's session and tells the page
out.r25.resetLink = await r25(async (o) => {
  const sb = gym(); fresh();
  o.launched = await launch(sb, COACH);
  await typeTemplateName(); o.typed = { ...tpl(), at: whereNow() };
  closeApp(); newPage();                                                  // the app closed without Sign out
  location.hash = "#access_token=made-up-recovery-token&expires_in=3600&refresh_token=made-up-refresh&token_type=bearer&type=recovery";
  const getSession0 = sb.auth.getSession; linkCheck(sb, JANE, 700); globalThis.supabase = { createClient: () => sb };
  const from = sb.log.length; let over = false; fns.boot().then(() => { over = true; }, (e) => { over = true; thrown.push("boot: " + String((e && e.message) || e)); });
  await advance(300); o.opening = look();                                 // the screen while the library checks her link
  await until(() => over); await advance(50); sb.auth.getSession = getSession0;
  o.newPassword = { ...look(), user: document.getElementById("recoveryUser").value };
  winFire("focus"); await advance(500); await settle();                   // the window gets the focus back
  o.afterFocus = { ...look(), reads: sb.log.slice(from).filter((e) => e.table && e.op === "select").length, records: maps.clients.size + maps.trainings.size, ...tpl() };
  document.getElementById("recoveryPassword").value = "made-up-new-pass-9"; document.getElementById("recoveryPassword2").value = "made-up-new-pass-9";
  sb.auth.updateUser = async () => ({ data: { user: { email: JANE } }, error: null });
  fire(byId.get("recoveryForm"), "submit");                               // she saves her new password
  o.done = await until(() => { const g = app.get(); return g.signedIn && g.sessionEmail === JANE && !g.entering && !g.syncing; }); await settle(); fns.localBackend.save(); await settle();
  o.jane = { ...whereNow(), ...tpl(), typed: allStored().includes(TYPED), template: maps.trainings.has(TP), omar: maps.clients.has(OC) || allStored().includes("Omar Sample") };
});

// R25-PRV-4 (the second guard): the coach's page is open with his template typed; the library tells it a password-reset link was opened (another tab of a browser where one window at a time cannot hold)
out.r25.resetHere = await r25(async (o) => {
  const sb = gym(); fresh();
  o.launched = await launch(sb, COACH);
  await typeTemplateName(); o.typed = { ...tpl(), at: whereNow() };
  sb.as(JANE); const from = sb.log.length; sb.tell("PASSWORD_RECOVERY"); await advance(50);   // the library holds her link's session now, and tells this page
  o.newPassword = look();
  winFire("focus"); await advance(500); await settle();
  o.afterFocus = { ...look(), reads: sb.log.slice(from).filter((e) => e.table && e.op === "select").length, records: maps.clients.size + maps.trainings.size, ...tpl() };
});

// R25-TW-10: the coach half types a private note in Jane's Notes tab; a change of his waits; his session ends elsewhere; Jane (or the coach again) signs in
out.r25.privateNote = {};
for (const next of [JANE, COACH]) out.r25.privateNote[next === JANE ? "Jane next" : "the coach again"] = await r25(async (o) => {
  const sb = server(); fresh(); const cn = byId.get("cNotes"); cn.value = "";
  o.launched = await launch(sb, COACH);
  app.set({ view: { name: "client", id: JC }, tab: "notes" }); fns.render(); await advance(50);   // Jane's page, its Notes tab
  fire(cn, "focus"); cn.focus(); cn.value = "Coach only: watch her blood pressure, ask about the new medication"; fire(cn, "input"); await advance(20); leave();
  o.typed = { box: cn.value, at: whereNow() };
  sb.signal(false); maps.clients.get(JC).phone = "3105550199"; fns.scheduleSave("clients", JC, 0); await settle();   // the Wi-Fi drops: his change of her phone waits
  o.waiting = maps.dirty.size > 0;
  sb.endElsewhere(); await settle(); o.ended = whereNow();
  sb.signal(true); app.set({ offline: false });
  o.signedIn = await signIn(next);
  if (next === COACH) app.set({ view: { name: "client", id: JC }, tab: "notes" });   // he opens her Notes tab again; she lands on her own page
  fns.render(); await advance(50);
  o.landed = { ...whereNow(), box: cn.value };
});

// ---------- the twenty-sixth check round (v316, 25 Nov 2026): what one person leaves on the gym iPad never reaches the next ----------
// - R26-PRV-1: the Sign in and Create account boxes. The password leaves the page once it is used, every Sign out empties both forms (Settings, as
//   the coach or a client, and "Couldn't reach the server", the last account's work kept or not), and the next person's Create account form
//   holds nothing of the last one's. The stand-in library takes any password, so the next person's tap on Sign in with nothing typed opens
//   whatever account the boxes still hold (the form is sent only with both boxes filled: both are required, as the browser checks).
// - R26-PRV-2 / R26-WAP-5: the half-typed notes and the cards' state go with the account at both Sign outs and the wipe, and words kept while
//   another account's role check is out are filed under the account whose work the device keeps.
// - R26-PRV-3: a password-reset link left unfinished: at the next launch its session reads and sends nothing of the remembered account's while its
//   role is checked, whatever wakes the page meanwhile.
// Each case keeps its own unhandled rejections and boot errors, as the twenty-fifth round's do.
out.r26 = {};
const FORM = ["loginEmail", "loginPassword", "suName", "suEmail", "suPhone", "suPassword", "suPassword2"];   // the Sign in and Create account boxes
const box = (id) => document.getElementById(id);
const blankForms = () => { for (const id of FORM) box(id).value = ""; };   // (a page of its own: nothing typed in either form)
const signInPage = () => ({ login: !byId.get("vLogin").hidden, signedIn: !!app.get().signedIn, email: box("loginEmail").value, password: box("loginPassword").value.length > 0 });   // what the sign-in page holds
const nextTap = async () => {                                             // the next person taps Sign in, typing nothing
  if (box("loginEmail").value && box("loginPassword").value) fire(byId.get("loginForm"), "submit");
  await until(() => { const g = app.get(); return (g.signedIn && !g.entering && !g.syncing) || false; }, 3000); await settle();
  return { signedIn: !!app.get().signedIn, as: app.get().signedIn ? app.get().sessionEmail : null };
};
const PRIVATE = "Coach only: watch her blood pressure, ask about the new medication";   // the coach's half-typed private note about Jane
const typePrivate = async (cn) => { app.set({ view: { name: "client", id: JC }, tab: "notes" }); fns.render(); await advance(50); fire(cn, "focus"); cn.focus(); cn.value = PRIVATE; fire(cn, "input"); await advance(20); leave(); };   // Jane's page, its Notes tab: his words typed into the notes box, not saved

// R26-PRV-1: the coach (or Jane) signs in with the Sign in form, then taps Sign out in Settings; the next person taps Sign in, typing nothing
out.r26.signInForm = {};
for (const who of [COACH, JANE]) out.r26.signInForm[who === COACH ? "the coach" : "Jane"] = await r25(async (o) => {
  const sb = server(); fresh(); blankForms();
  o.launched = await launch(sb, null);                                    // the app opened on the sign-in page
  o.signedIn = await signIn(who);                                         // email and password typed into the form
  if (who === JANE) app.set({ view: { name: "client", id: JC } });        // (her own page, where her person disc opens Settings)
  fire(byId.get("signout"), "click"); await settle();                     // Sign out in Settings
  o.signInPage = signInPage();
  o.next = await nextTap();
});

// R26-PRV-1: the coach signs in with the form; his session ends elsewhere (his password changed on his phone), with nothing else waiting (the device
// is wiped) or with his change of Jane's phone waiting (the device keeps it for him); the next person taps Sign in, typing nothing
out.r26.signInEnded = {};
for (const how of ["nothing else waiting", "his change waiting"]) out.r26.signInEnded[how] = await r25(async (o) => {
  const sb = server(); fresh(); blankForms();
  o.launched = await launch(sb, null);
  o.signedIn = await signIn(COACH);
  if (how === "his change waiting") { sb.signal(false); maps.clients.get(JC).phone = "3105550199"; fns.scheduleSave("clients", JC, 0); await settle(); }   // the Wi-Fi drops: his change waits
  sb.endElsewhere(); await settle(); sb.signal(true); app.set({ offline: false });
  o.ended = { ...signInPage(), kept: maps.clients.size + maps.trainings.size > 0, owner: app.get().pendingOwner || null };
  o.next = await nextTap();
});

// R26-PRV-1: Ana makes her account on the gym iPad (Create an account, email confirmation on, as the real project has it), taps Back to sign in, and
// the next person taps Create an account
out.r26.signUp = await r25(async (o) => {
  const sb = server(); fresh(); blankForms();
  sb.auth.signUp = async ({ email }) => ({ data: { session: null, user: { email, identities: [{}] } }, error: null });   // the account made; no session until her link is opened
  o.launched = await launch(sb, null);
  fire(byId.get("createBtn"), "click"); await advance(100);               // Create an account
  const ANA = { suName: "Ana Madeup", suEmail: "ana@x.com", suPhone: "(310) 555-0123", suPassword: "made-up-pass-456", suPassword2: "made-up-pass-456" };
  for (const [id, v] of Object.entries(ANA)) box(id).value = v;          // her name, email, phone and password, typed
  fire(byId.get("signupForm"), "submit"); await settle();
  o.sent = { done: !box("suDone").hidden, words: box("suDoneText").textContent };   // "We sent a confirmation link to …"
  fire(byId.get("suDoneBtn"), "click"); await advance(50);                // Back to sign in
  o.signInPage = signInPage();
  fire(byId.get("createBtn"), "click"); await advance(100);               // the next person taps Create an account
  o.nextForm = { shown: !byId.get("vSignup").hidden, name: box("suName").value, email: box("suEmail").value, phone: box("suPhone").value, password: box("suPassword").value.length, again: box("suPassword2").value.length };
});

// R26-PRV-2 / R26-WAP-5: the coach half types a private note in Jane's Notes tab with nothing else waiting, then taps Sign out in Settings, or his
// session ends elsewhere (the device is wiped); Jane signs in on that page, after the app went out of sight on the sign-in page (the drafts add-on
// keeps typing then) or at once; then the app goes out of sight with Jane signed in
out.r26.privateNote = {};
for (const how of ["Sign out", "ended elsewhere"]) for (const when of ["out of sight first", "at once"]) out.r26.privateNote[how + ", " + when] = await r25(async (o) => {
  const sb = server(); fresh(); blankForms(); const cn = byId.get("cNotes"); cn.value = "";
  o.launched = await launch(sb, COACH);
  await typePrivate(cn); o.typed = cn.value;
  app.set({ view: { name: "clients" } }); fns.render(); await advance(50);   // back on his Clients page
  if (how === "Sign out") { fire(byId.get("signout"), "click"); await settle(); } else { sb.endElsewhere(); await settle(); }
  o.signedOut = { signedIn: !!app.get().signedIn, login: !byId.get("vLogin").hidden };
  if (when === "out of sight first") { fns.keepTyping(); o.storedAfterSignOut = (localStorage.getItem("fiala.kept") || "").includes("blood pressure"); }   // the app goes out of sight (win.js's hidden hook): what is typed waits on the device
  o.signedIn = await signIn(JANE);
  fns.render(); await advance(50);
  o.landed = { as: app.get().sessionEmail, client: app.get().clientMode, box: cn.value, held: [...fns.keptMaps().noteDraft.values()].some((v) => v.includes("blood pressure")) };
  fns.keepTyping();                                                       // out of sight, Jane signed in
  o.storedForJane = (localStorage.getItem("fiala.kept") || "").includes("blood pressure");
});

// R26-PRV-2: the sign-in library could not load (no signal as the app opened after an update): the remembered account's pages from the device copy,
// offline, where Sign out has no library to tell (so no SIGNED_OUT wipes the page first: Sign out's own finish clears it). The coach half types a
// private note in Jane's Notes tab and taps Sign out, and the app goes out of sight; or Jane, on her Push, picks set 2 of her Bench press, goes back
// to her page and taps Sign out in Settings.
const bootNoLibrary = async () => { delete globalThis.supabase; let over = false; fns.boot().then(() => { over = true; }, (e) => { over = true; thrown.push("boot: " + String((e && e.message) || e)); }); const ok = await until(() => over); await settle(); return ok; };
out.r26.noLibrary = {};
out.r26.noLibrary["the coach"] = await r25(async (o) => {
  const sb = server(); fresh(); blankForms(); const cn = byId.get("cNotes"); cn.value = "";
  o.launched = await launch(sb, COACH);                                   // signed in once: the iPad remembers him, and keeps his device copy
  closeApp(); newPage();                                                  // the app closed
  o.reopened = await bootNoLibrary(); o.at = { ...look(), offline: !!app.get().offline };
  await typePrivate(cn); o.typed = cn.value;
  app.set({ view: { name: "clients" } }); fns.render(); await advance(50);
  fire(byId.get("signout"), "click"); await settle();                     // Sign out in Settings
  o.signedOut = { signedIn: !!app.get().signedIn, login: !byId.get("vLogin").hidden };
  fns.keepTyping();                                                       // the app goes out of sight on the sign-in page
  o.stored = (localStorage.getItem("fiala.kept") || "").includes("blood pressure");
  o.held = [...fns.keptMaps().noteDraft.values()].some((v) => v.includes("blood pressure"));
});

// R26-PRV-2 (a client's Sign out): on her Push Jane picks set 2 of her Bench press and opens her note on it (See note), goes back to her page and
// signs out in Settings; the coach signs in on that iPad and opens her Push. (Her Push is this case's own workout: no case before drew its cards.)
const JP = "6f8b0d2e-6666-4a3c-9e5f-8b0d2e4f6a1c", HER_BP = "Left shoulder clicks on the way down";   // Jane's Push, and her own note on its Bench press
const noteOf = (rid) => { const b = blockOf(rid), a = part(b, ".add-note"), sh = part(b, ".client-note"); if (!a) return null; const h = String(a.innerHTML || ""); return { button: /Hide note/.test(h) ? "Hide note" : /See note/.test(h) ? "See note" : /Add note/.test(h) ? "Add note" : h, open: !!sh && !sh.hidden }; };   // the card's note: its button's words, and whether the note is open on the card
const setsOf = (rid) => ((part(blockOf(rid), ".tr-chips") || { children: [] }).children || []).map((b) => b.textContent);   // the card's sets as its slider says them ("Set 2 of 3" the one picked)
const cardsHeld = (W) => { const c = fns.cardSets(), k = fns.keptMaps(); return [...c.openBlocks, ...c.setSel.keys(), ...k.cardNoteDraft.keys(), ...k.cardNoteBase.keys()].filter((x) => String(x).startsWith(W + "/")).length; };   // the card state and card notes the page keeps for that workout
out.r26.clientCards = await r25(async (o) => {
  const sb = server(); fresh(); blankForms();
  sb.seed("ft_trainings", JP, { id: JP, clientId: JC, title: "Push", date: day(1), createdAt: AT, completedAt: null, skippedAt: null, rows: [{ ...R("bp", "1", "Bench press"), clientNote: HER_BP, clientNoteBy: "client", clientNoteAt: "2026-11-24T17:00:00.000Z" }, R("pu", "2", "Push-up")] }, { client_id: JC });
  o.launched = await launch(sb, null); o.signedIn = await signIn(JANE);
  await openW(JP); o.before = { note: noteOf("bp"), sets: setsOf("bp") };   // her Push
  await tap((part(blockOf("bp"), ".tr-chips") || { children: [] }).children[1]);   // set 2 picked on the card's sets
  await tap(part(blockOf("bp"), ".add-note"));                             // See note: her note opens on the card
  o.picked = { note: noteOf("bp"), sets: setsOf("bp"), held: cardsHeld(JP) };
  fns.go({ name: "client", id: JC }); await advance(50);                  // Back to her page
  fire(byId.get("meDisc"), "click"); await advance(50);                   // her person disc: Settings
  o.settings = !byId.get("vSettings").hidden;
  fire(byId.get("signout"), "click"); await settle();                     // Sign out
  o.signedOut = { ...signInPage(), held: cardsHeld(JP) };
  o.coachIn = await signIn(COACH);                                        // the coach signs in on that iPad
  await openW(JP); o.coach = { as: app.get().sessionEmail, client: app.get().clientMode, note: noteOf("bp"), sets: setsOf("bp") };   // and opens her Push
});

out.r26.noLibrary["Jane"] = await r25(async (o) => {
  const sb = server(); fresh(); blankForms();
  sb.seed("ft_trainings", JP, { id: JP, clientId: JC, title: "Push", date: day(1), createdAt: AT, completedAt: null, skippedAt: null, rows: [{ ...R("bp", "1", "Bench press"), clientNote: HER_BP, clientNoteBy: "client", clientNoteAt: "2026-11-24T17:00:00.000Z" }, R("pu", "2", "Push-up")] }, { client_id: JC });
  o.launched = await launch(sb, JANE);                                    // signed in once: the iPad remembers her
  closeApp(); newPage();
  o.reopened = await bootNoLibrary(); o.at = { ...look(), offline: !!app.get().offline };
  await openW(JP); await tap((part(blockOf("bp"), ".tr-chips") || { children: [] }).children[1]);   // her Push: set 2 picked
  o.picked = { sets: setsOf("bp"), held: cardsHeld(JP) };
  fns.go({ name: "client", id: JC }); await advance(50);                  // Back to her page
  fire(byId.get("meDisc"), "click"); await advance(50); o.settings = !byId.get("vSettings").hidden;
  fire(byId.get("signout"), "click"); await settle();                     // Sign out
  o.signedOut = { signedIn: !!app.get().signedIn, login: !byId.get("vLogin").hidden, held: cardsHeld(JP) };
});

// R26-PRV-2 / R26-WAP-5 / R26-PRV-1: the coach half types a private note in Jane's Notes tab, his change of Omar's phone waits, and his session ends
// elsewhere (the device keeps both for him); Jane signs in, her role check cannot reach the server, and she taps Sign out on "Couldn't reach the
// server"; the app goes out of sight (the drafts add-on keeps the typing), is closed, and the coach signs in again
out.r26.problemKept = await r25(async (o) => {
  const sb = gym(); fresh(); blankForms(); const cn = byId.get("cNotes"); cn.value = "";
  o.launched = await launch(sb, COACH);
  await typePrivate(cn);
  sb.signal(false); maps.clients.get(OC).phone = OMAR_NEW; fns.scheduleSave("clients", OC, 0); await settle();
  sb.endElsewhere(); await settle(); sb.signal(true); app.set({ offline: false });
  sb.setFail({ table: "trainers", times: 1e6, message: "Failed to fetch" });
  o.signedIn = await signIn(JANE); o.problem = !byId.get("vWaiting").hidden; sb.setFail(null);
  fire(byId.get("signout3"), "click"); await settle();
  o.signInPage = signInPage();
  fns.keepTyping();                                                       // the app goes out of sight
  const k = JSON.parse(localStorage.getItem("fiala.kept") || "null"); o.kept = k && { owner: k.owner, words: JSON.stringify(k.notes || []).includes("blood pressure") };
  o.janeEmailStored = Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i)).filter((key) => (localStorage.getItem(key) || "").includes('"owner":"' + JANE + '"') || (key === "fiala.trainings.role" && (localStorage.getItem(key) || "").includes(JANE)));   // her email as the owner of something kept, or as the account remembered (the coach's own records of her, kept for him, name her as his client: that is his data)
  closeApp(); newPage(); cn.value = ""; blankForms();                     // the app closed; the coach opens it again and signs in
  o.coachIn = await launch(sb, null) && await signIn(COACH);
  app.set({ view: { name: "client", id: JC }, tab: "notes" }); fns.render(); await advance(50);
  o.box = cn.value; o.server = sb.tables.ft_clients.get(OC).data.phone;
});

// R26-PRV-3: the coach's change of Omar's phone waits on the gym iPad (no signal) and the app is closed; Jane opens her password-reset link there and
// leaves New password without saving (the library keeps her link's session); the app is opened again later: the device remembers the coach, the
// library holds Jane's session. Her role check is slow and cannot reach the server, and the window gets the focus, the Wi-Fi comes back (the online
// event) or the app goes out of sight and back while it is out; she taps Sign out on "Couldn't reach the server"; the coach signs in. The server
// answers as its row-level security does: under her session the coach's tables show no rows and take no write.
const rlsAs = (sb) => {                                                   // Postgres's answers under a non-trainer's session: "for all using (is_trainer()) with check (is_trainer())"
  const real = sb.from, wrote = [];
  sb.from = (table) => { const b = real(table); if (!/^ft_(clients|trainings)$/.test(table) || sb.who() === COACH) return b; let op = "select", one = false; const u = b.update, d = b.delete, up = b.upsert, ms = b.maybeSingle;
    b.update = (row) => { op = "update"; return u.call(b, row); }; b.delete = () => { op = "delete"; return d.call(b); }; b.upsert = (row) => { op = "upsert"; return up.call(b, row); }; b.maybeSingle = () => { one = true; return ms.call(b); };
    b.then = (res, rej) => { wrote.push(op + " " + table + " as " + sb.who()); return Promise.resolve(op === "upsert" ? { data: null, error: { message: "new row violates row-level security policy", code: "42501" } } : { data: one ? null : [], error: null }).then(res, rej); };   // no rows: a list comes back empty, a single row as none
    return b; };
  return wrote;
};
const appSwitch = () => { for (const v of ["hidden", "visible"]) { document.visibilityState = v; document.hidden = v === "hidden"; for (const l of [...(L.visibilitychange || [])]) l.fn({ type: "visibilitychange" }); } };   // out of sight and back (the page's own visibilitychange listeners)
const WAKE = { focus: () => winFire("focus"), online: () => winFire("online"), "an app switch": appSwitch };
out.r26.resetLeft = {};
for (const ev of Object.keys(WAKE)) out.r26.resetLeft[ev] = await r25(async (o) => {
  const sb = gym(); fresh(); blankForms();
  o.launched = await launch(sb, COACH);
  sb.signal(false); maps.clients.get(OC).phone = OMAR_NEW; fns.scheduleSave("clients", OC, 0); await settle();   // the Wi-Fi drops: his change of Omar's phone waits
  o.waits = { owner: app.get().pendingOwner, dirty: names(maps.dirty.keys()) };
  closeApp(); newPage();                                                  // the app closed without Sign out
  sb.signal(true); location.hash = "#access_token=made-up-recovery-token&expires_in=3600&refresh_token=made-up-refresh&token_type=bearer&type=recovery";
  o.newPassword = await launch(sb, JANE); o.atLink = look();              // her link: New password comes up; she leaves it
  closeApp(); newPage(); location.hash = "";                              // the app closed; her link's session stays in the library
  const wrote = rlsAs(sb);
  const undo = slowRole(sb, 1500, 500, WAKE[ev], true);                 // opened again: her role check is slow, then cannot reach the server; the page is woken while it is out
  o.reopened = await launch(sb, JANE); undo();
  o.problem = { ...look(), owner: app.get().pendingOwner || null, dirty: names(maps.dirty.keys()) };
  fire(byId.get("signout3"), "click"); await settle();                    // she taps that page's Sign out
  o.tapped = { ...look(), owner: app.get().pendingOwner || null, dirty: names(maps.dirty.keys()) };
  o.underJane = wrote.slice();
  if (o.tapped.shown.includes("vLogin")) o.coachIn = await signIn(COACH);
  await settle(); document.visibilityState = "visible"; document.hidden = false;
  o.server = sb.tables.ft_clients.get(OC).data.phone;
});

// R26-PRV-3 (two clients on one iPad): Jane's set (95 lb on her Leg press) waits on the gym iPad (no signal) and the app is closed; Omar opens his
// password-reset link there and leaves New password; the app is opened again: the device remembers Jane, the library holds Omar's session. His role
// check is slow and cannot reach the server, and the window gets the focus while it is out; he taps Sign out on "Couldn't reach the server"; Jane
// signs in. The client rules answer as the server's do: client_my_data gives the caller's own record and workouts only, and client_log_set refuses
// (P0001) a workout that is not the caller's.
const OMAR = "omar@x.com";
out.r26.resetLeftClients = await r25(async (o) => {
  const sb = gym(); fresh(); blankForms();
  const mine = () => [...sb.tables.ft_clients.values()].find((r) => r.data && String(r.data.email || "").toLowerCase() === sb.who());
  sb.rpcs.client_my_data = async () => { const me = mine(); if (!me) throw Object.assign(new Error("no client profile for this account"), { code: "P0001" }); return { clients: [{ id: me.id, data: (({ notes, ...rest }) => rest)(clone(me.data)) }], trainings: [...sb.tables.ft_trainings.values()].filter((t) => t.client_id === me.id).map((t) => ({ id: t.id, data: clone(t.data), updated_at: t.updated_at })) }; };
  const logSet = sb.rpcs.client_log_set; sb.rpcs.client_log_set = async (a) => { const s = sb.tables.ft_trainings.get(a.p_training), me = mine(); if (!s || !me || s.client_id !== me.id) throw Object.assign(new Error("not your workout"), { code: "P0001" }); return logSet(a); };
  o.launched = await launch(sb, JANE);
  sb.signal(false); janeSet(); await settle();                            // the Wi-Fi drops as she logs 95 lb on her Leg press: her set waits
  o.waits = { owner: app.get().pendingOwner, dirty: names(maps.dirty.keys()) };
  closeApp(); newPage();                                                  // the app closed without Sign out
  sb.signal(true); location.hash = "#access_token=made-up-recovery-token&expires_in=3600&refresh_token=made-up-refresh&token_type=bearer&type=recovery";
  o.newPassword = await launch(sb, OMAR); o.atLink = look();              // his link: New password comes up; he leaves it
  closeApp(); newPage(); location.hash = "";                              // the app closed; his link's session stays in the library
  const asked = []; { const rpc0 = sb.rpc; sb.rpc = async (name, args) => { asked.push(name + " as " + sb.who()); return rpc0(name, args); }; }
  const wrote = rlsAs(sb);
  const undo = slowRole(sb, 1500, 500, () => winFire("focus"), true);    // opened again: his role check is slow, then cannot reach the server; the window gets the focus meanwhile
  o.reopened = await launch(sb, OMAR); undo();
  o.problem = { ...look(), owner: app.get().pendingOwner || null, dirty: names(maps.dirty.keys()), page: names([...maps.clients.keys(), ...maps.trainings.keys()]).sort(), copyOmar: (localStorage.getItem("fiala.trainings.v1") || "").includes("Omar Sample") };
  fire(byId.get("signout3"), "click"); await settle();                    // he taps that page's Sign out
  o.tapped = { ...look(), owner: app.get().pendingOwner || null, dirty: names(maps.dirty.keys()) };
  o.underOmar = [...asked.filter((x) => x.endsWith(" as " + OMAR)), ...wrote];
  if (o.tapped.shown.includes("vLogin")) o.janeIn = await signIn(JANE);   // Jane signs in there
  await settle();
  o.server = ((sb.tables.ft_trainings.get(JW).data.rows || []).find((r) => r.id === "lp") || {}).weights || null;
});

await new Promise((r) => setImmediate(r));
out.found = { drafts: !!DRF };
out.rejected = rejected; out.thrown = thrown;
console.log(JSON.stringify(out));
process.exit(0);
