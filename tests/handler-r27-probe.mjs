// Run by handler-r27.test.js in its own process (v321, the twenty-sixth check round's R26-HND-2 and R26-HND-3): the real main.js on
// cards-follow-probe.mjs's stand-ins (its clock and elements), the stand-in server and sign-in library under it. Made-up people only.
// - gone (R26-HND-2): a client's workout deleted on another device (the coach's iPad; under the client's phone, by the coach) while its page
//   is up here with a question, an exercise's "…" menu, the Skip sheet, the Skip exercise sheet or the day picker over it: the sync takes the
//   page away (to the Clients list, or her own page on her phone), and nothing it held stays up over that page, nor out of reach behind it.
// - restore (R26-HND-3): the coach's session ends elsewhere while the read after Restore's tap is out (one bar of signal): the sign-in page
//   is in reach at once, the part kept inert in the markup (as #ctxLift) stays so, and nothing is restored; signed in again at once (the read
//   held by the built-in templates' seeding), a question up as the old read ends keeps the page behind it out of reach; a restore with no
//   sign-out (the control) holds the page out of reach until its read is in, then lands.
// Prints, as JSON, what each case showed.
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
for (const id of ["loginForm", "loginEmail", "loginPassword", "loginMsg", "loginBtn", "vLogin"]) recorder(id);   // the sign-in form, heard by main.js as it loads (the twenty-fourth check round: another account signing in on the page)
// ---------- this probe's own parts of the page (the twenty-sixth check round's cases) ----------
for (const id of ["skGo", "skReasons", "skFor", "dpCancel"]) recorder(id);
const skipSheet = recorder("skipSheet", { hidden: true }), datePick = recorder("datePick", { hidden: true }), earlySheet = byId.get("earlySheet"), vLogin = byId.get("vLogin");   // the Skip sheet, the day picker (hidden in the markup)
recorder("dpGrid", { clientWidth: 350, setPointerCapture() {} });
const restoreFile = recorder("restoreFile");                            // Settings › Data's file picker, heard by main.js as it loads
const hbar = mk("div"), backBtn = mk("button"), status = byId.get("status"); hbar.className = "bar"; header.tagName = "HEADER"; header.appendChild(hbar); hbar.append(backBtn, status);   // the bar: the Back circle and the status line (role=status)
header.querySelectorAll = (sel) => (sel === ".bar > *" ? hbar.children : findAll(header, sel));
const lift = mk("div"); lift.inert = true;                              // inert in the markup, as #ctxLift (touch and hold's lifted copy): nothing ever gives it back
document.body.children = [main, header, whenBg, altSheet, askSheet, earlySheet, skipSheet, datePick, lift];
document.querySelectorAll = (sel) => (sel === "main, header" ? [main, header] : /body > \*/.test(sel) ? [...document.body.children, ...(/\.bar > \*/.test(sel) ? hbar.children : [])] : []);   // the page and its bar, as the day picker holds them out of reach; the page's top parts, and the bar's (a look-up that would also reach the part inert in the markup)
{ const qs0 = document.querySelector; document.querySelector = (sel) => (/^\.(sheet-bg|crop-view)\b/.test(String(sel)) ? null : qs0(sel)); }   // no other sheet and no photo framing up: held() reads only what this probe puts up
const app = (await import("../app/main.js")).internals();
const { fns, maps } = app;

const C = "7c1d2e3f-4a5b-4c6d-8e7f-9a0b1c2d3e4f", AT = "2026-11-10T16:00:00.000Z", OK = { at: "2026-11-18T08:00:00.000Z", by: "client" }, COACH = "coach@x.com", NINA_EMAIL = "nina@x.com";
const NINA = { id: C, name: "Nina Park", unit: "lb", email: NINA_EMAIL, choices: { zone: { state: "allow", ...OK }, health: { state: "agreed", ...OK } } };   // (her answers given: no question comes up on her phone)
let nW = 0; const wid = () => "8d2e3f4a-5b6c-4d7e-8f9a-0b1c2d3e4f" + (0x10 + nW++).toString(16).padStart(2, "0");   // each case its own workout
const day = (k) => { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + k); return fns.localIso(d); };   // the app's local day (never UTC)
const clone = (x) => JSON.parse(JSON.stringify(x));
const R = (id, label, name) => ({ id, label, name, sets: 3, reps: "8", rest: "", tempo: "", weights: [], repsDone: [], setsDone: 0, done: false, note: "", alts: [] });
const settle = async () => { const end = NOW + 30000; do await advance(100); while ((app.get().inflight > 0 || maps.timers.size) && NOW < end); await advance(100); };
const sync = async () => { const p = fns.syncDownNow(); await settle(); await p; await settle(); };
const run = async (f) => { const o = {}; try { await f(o); } catch (e) { o.error = String((e && e.stack) || e).slice(0, 1500); } return o; };
const fresh = () => { fire(document.body, "keydown", { key: "Escape" }); Q.length = 0; delete globalThis.supabase; app.reset(); fns.leaveSettings(); fns.setPreview(false); made.length = 0; rowsEl.replaceChildren(); for (const x of [whenBg, askSheet, earlySheet, skipSheet, datePick]) x.hidden = true; document.activeElement = null; for (const x of [main, header, whenBg, altSheet, askSheet, earlySheet, skipSheet, datePick, backBtn]) x.inert = false; lift.inert = true; status.textContent = ""; };
const seed = (sb, W) => sb.seed("ft_trainings", W, { id: W, clientId: C, title: "Legs", date: day(0), createdAt: AT, completedAt: null, skippedAt: null, rows: [R("sq", "1", "Back squat"), R("lp", "2", "Leg press")] }, { client_id: C });
const coachOn = (sb) => { fresh(); app.set({ sb, signedIn: true, clientMode: false, backend: fns.cloudBackend, sessionEmail: COACH, view: { name: "clients" }, tab: "workouts" }); };   // the coach's Mac
const phoneOn = (sb) => {                                                // Nina's own phone: her record and her workouts as the server has them now (client_my_data)
  sb.rpcs.client_my_data = async () => ({ clients: [{ id: C, data: clone(sb.tables.ft_clients.get(C).data) }], trainings: [...sb.tables.ft_trainings.values()].filter((t) => t.client_id === C).map((t) => ({ id: t.id, data: clone(t.data), updated_at: t.updated_at })) });
  fresh(); app.set({ sb, signedIn: true, clientMode: true, myClientId: C, backend: fns.clientBackend, sessionEmail: NINA_EMAIL, view: { name: "client", id: C }, tab: "workouts" });
};
const openW = async (W) => { app.set({ view: { name: "training", id: W }, renderedTraining: null }); fns.render(); await advance(50); };
const rowOf = (rid) => made.filter((x) => classesOf(x).has("row") && x.dataset && x.dataset.id === rid && !x.removed).pop() || null;   // an exercise's row as drawn now
const blockOf = (rid) => { for (let n = rowOf(rid); n && MK.has(n); n = n.parent) if (classesOf(n).has("block")) return n; return null; };   // its card
const tap = async (e) => { if (!e) return false; fire(e, "click", { detail: 1 }); await advance(20); return true; };
const up = () => ({ question: !askSheet.hidden, menu: !whenBg.hidden, skip: !skipSheet.hidden || !!fns.skipSheet(), early: !earlySheet.hidden, days: !datePick.hidden || !!fns.datePicker(), asking: !!app.get().asking, inert: [["the page", main], ["the bar", header], ["the menu's layer", whenBg]].filter(([, x]) => x.inert).map(([n]) => n) });   // what hangs over the page, and what of it is out of reach
const out = { gone: {}, restore: {} };

// ---------- R26-HND-2: the workout deleted elsewhere while something of its page is up ----------
const part = (b, sel) => (b ? find(b, sel) : null);                    // a part of a row or card, by its selector
const OPEN = {                                                           // what is up over Legs' page as the deletion lands, put up as a person does
  question: async (W) => { if (app.get().clientMode) fns.finishTap(); else fns.askDelete(W); await advance(50); },   // his "Delete this workout?" (the page's foot); her "Finish this workout early?" (Finish workout)
  menu: async () => tap(part(rowOf("sq"), ".more-btn")),                  // Back squat's "…": Add alternatives · Add instructions · Delete exercise
  skip: async (W) => { fns.openSkip(W); await advance(50); },             // Skip workout's sheet
  early: async () => tap(findAll(blockOf("sq"), ".finish-early").find((x) => !classesOf(x).has("undo-set"))),   // Back squat's card, nothing logged: Skip exercise's sheet (not its Mark set N as not done)
  days: async (W) => { fns.openDatePicker({ clientId: C, moving: W, title: "Move to", selected: day(0), onPick() {} }); await advance(50); },   // Reschedule's days
};
for (const who of ["coach", "client"]) for (const what of who === "coach" ? ["question", "menu", "skip", "early", "days"] : ["question", "skip", "early"]) out.gone[who + " " + what] = await run(async (o) => {
  const sb = makeSupabase(), W = wid(); sb.seed("ft_clients", C, NINA); seed(sb, W);
  if (who === "coach") coachOn(sb); else phoneOn(sb);
  await sync(); await openW(W);
  o.drawn = !!rowOf("sq");
  await OPEN[what](W); await advance(400);
  o.before = up();
  sb.tables.ft_trainings.delete(W); await sync(); await advance(400);   // deleted on his iPad (under her phone, by the coach); the sync here
  const v = app.get().view; o.after = { page: v.name === "clients" ? "Clients" : v.name === "client" && v.id === C ? "her page" : v.name, ...up() };
  if (fns.skipSheet()) fns.closeSkip(); if (fns.datePicker()) fns.closeDatePicker(); fire(document.body, "keydown", { key: "Escape" }); await advance(400);
});

// ---------- R26-HND-3: the session ends elsewhere during the read after Restore's tap ----------
const server = () => {                                                   // the server, and the sign-in library on the Mac
  const sb = makeSupabase(); sb.tables.trainers = new Map(); let who = null, told = null;
  const trainers = () => { sb.tables.trainers.clear(); if (who === COACH) sb.tables.trainers.set("t1", { id: "t1", email: COACH }); };
  sb.auth = {
    getSession: async () => ({ data: { session: who ? { user: { email: who } } : null }, error: null }),
    getUser: async () => ({ data: { user: who ? { email: who } : null }, error: null }),
    onAuthStateChange: (cb) => { told = cb; return { data: { subscription: { unsubscribe() {} } } }; },
    signInWithPassword: async ({ email }) => { who = String(email || "").trim().toLowerCase(); trainers(); return { data: { session: { user: { email: who } } }, error: null }; },
    signOut: async () => { who = null; trainers(); if (told) told("SIGNED_OUT", null); return { error: null }; },
  };
  sb.as = (email) => { who = email; trainers(); };
  sb.endElsewhere = () => { who = null; trainers(); if (told) told("SIGNED_OUT", null); };   // the session ended on another device (his password changed on his iPad): the session gone, then SIGNED_OUT
  sb.seed("ft_clients", C, NINA);
  sb.seed("ft_clients", TEMPLATES_ID, { id: TEMPLATES_ID, name: "Templates", kind: "templates", templatesVersion: 3, builtinsAdopted: 1, folders: [] });   // (the built-in templates in: no seeding of them starts)
  return sb;
};
const launch = async (sb, email) => {                                    // the app opened (main.js's own boot), the library holding the coach's session
  sb.as(email); globalThis.supabase = { createClient: () => sb };
  let over = false; fns.boot().then(() => { over = true; }, (e) => { over = true; out.bootError = String((e && e.message) || e); });
  for (let i = 0; i < 300 && !over; i++) await advance(100); await settle(); return over && app.get().signedIn;
};
const pickFile = (f) => { const ev = { type: "change", target: { files: [{ text: async () => JSON.stringify(f) }], value: "x" } }; for (const fn of restoreFile.H.change || []) fn(ev); };
const inReach = () => ({ page: !main.inert, bar: !header.inert, back: !backBtn.inert, lifted: lift.inert ? "inert" : "in reach" });
for (const how of ["signed out during the read", "signed in again during the read, a question up as it ends", "no sign-out"]) out.restore[how] = await run(async (o) => {
  fresh(); const sb = server(), W = wid(); seed(sb, W);
  o.launched = await launch(sb, COACH);
  const f = clone(fns.backupData());                                    // his backup: Legs as it is
  maps.trainings.get(W).title = "Legs heavy"; fns.scheduleSave("trainings", W, 0); await settle();   // renamed since, and saved
  pickFile(f); for (let i = 0; i < 20 && askSheet.hidden; i++) await advance(250);
  o.question = askSheet.hidden ? null : byId.get("askTitle").textContent;
  const again = how.startsWith("signed in again");
  if (again) app.set({ seeding: true }); else sb.delayMs = 3000;        // the read after the tap waits for the built-in templates' seeding (up to 10 s); or one bar of signal: each answer 3 s
  await advance(400); fire(byId.get("askYes"), "click", { detail: 1 }); await advance(300);   // Restore: the read after the tap is out
  o.reading = { ...inReach(), words: status.textContent, read: fns.restoreFlags().restoreRead };
  if (how !== "no sign-out") {
    sb.endElsewhere(); await advance(50);                                 // his session ends elsewhere, the read still out
    o.signInPage = { ...inReach(), login: !vLogin.hidden, words: byId.get("loginMsg").textContent, read: fns.restoreFlags().restoreRead };
  }
  if (again) {                                                            // he signs in again at once (the form's Sign in), and a question comes up on his page before that old read ends
    byId.get("loginEmail").value = COACH; byId.get("loginPassword").value = "made-up-pass-123"; fire(byId.get("loginForm"), "submit");
    for (let i = 0; i < 40 && !(app.get().signedIn && !app.get().entering); i++) await advance(100);
    o.signedIn = app.get().signedIn && app.get().sessionEmail === COACH;
    fns.askFirst({ title: "Delete this workout?", text: "It goes for good, with everything logged on it.", yes: "Delete" }); await advance(400);
    o.asked = { question: !askSheet.hidden, page: !main.inert, read: fns.restoreFlags().restoreRead };
    app.set({ seeding: false }); for (let i = 0; i < 20; i++) await advance(250);   // the seeding ends: the old read goes on, and ends under the question
    o.underQuestion = { question: !askSheet.hidden, ...inReach(), read: fns.restoreFlags().restoreRead };
    fire(byId.get("askNo"), "click", { detail: 1 }); await advance(400);  // Cancel
  }
  for (let i = 0; i < 40; i++) await advance(250); sb.delayMs = 0; await settle();   // the read ends
  o.after = { ...inReach(), read: fns.restoreFlags().restoreRead, login: !vLogin.hidden, server: sb.tables.ft_trainings.get(W).data.title };
});
await new Promise((r) => setImmediate(r)); out.rejected = rejected;
console.log(JSON.stringify(out));
process.exit(0);
