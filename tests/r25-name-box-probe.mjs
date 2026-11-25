// Run by template-draft.test.js in its own process (v316, the twenty-fifth check round, R25-DRF-5): the name box (#tTitle) of a template's page and
// of a client's workout, clicked into on the coach's Mac with nothing typed, when a sync brings his iPad's rename. Round 24 lets that box take the new
// name (it kept the old one under the cursor), but writing the value collapsed his selection to the end: Upper A selected with Cmd+A to retype it
// became "Upper A (iPad)Legs" as he typed, and a caret placed after "Upper " jumped to the end. Now a whole-name selection stays whole, and a
// selection or caret whose text before it is unchanged stays where it was; a caret at the end goes to the new end (round 24's own case).
// Started from template-draft-labels-probe.mjs (its clock, the document's and the window's listeners, the stand-in elements that keep their
// listeners), with the stand-in server (fake-supabase.js) for the sync and the save, and a name box that keeps a browser's rules: a value written
// by script puts the caret at the end when it changes, select() selects it all, and a letter typed replaces the selection. Prints, as JSON, what the
// box held and what was saved.
import { byId, el } from "./env.js";
import { makeSupabase } from "./fake-supabase.js";
let NOW = 10000, SEQ = 0; const Q = [];
globalThis.setTimeout = (fn, ms) => { const id = ++SEQ; Q.push({ id, at: NOW + Math.max(0, ms || 0), fn }); return id; };
globalThis.clearTimeout = (id) => { const i = Q.findIndex((q) => q.id === id); if (i >= 0) Q.splice(i, 1); };
try { performance.now = () => NOW; } catch (_) { Object.defineProperty(globalThis, "performance", { value: { now: () => NOW }, configurable: true }); }
const flush = async () => { for (let i = 0; i < 30; i++) await Promise.resolve(); };
async function advance(ms) { const end = NOW + ms; for (;;) { Q.sort((a, b) => a.at - b.at || a.id - b.id); const q = Q[0]; if (!q || q.at > end) break; Q.shift(); NOW = Math.max(NOW, q.at); q.fn(); await flush(); } NOW = end; await flush(); }
const L = {};                                                              // the document's listeners, with their phase
document.addEventListener = (t, fn, o) => { (L[t] ||= []).push({ fn, capture: o === true || !!(o && o.capture) }); };
document.removeEventListener = (t, fn) => { const a = L[t] || []; const i = a.findIndex((x) => x.fn === fn); if (i >= 0) a.splice(i, 1); };
const WIN = {}, capOf = (o) => o === true || !!(o && o.capture);   // the window's listeners with their phase: a page takes one off only for the same phase
globalThis.addEventListener = (t, fn, o) => { (WIN[t] ||= []).push({ fn, capture: capOf(o) }); }; globalThis.removeEventListener = (t, fn, o) => { const a = WIN[t] || []; const i = a.findIndex((x) => x.fn === fn && x.capture === capOf(o)); if (i >= 0) a.splice(i, 1); };
const rejected = []; process.on("unhandledRejection", (e) => { rejected.push(String((e && e.message) || e)); });
globalThis.fetch = async () => { throw new Error("no network in this probe"); };
globalThis.innerHeight = 900; globalThis.innerWidth = 1280; document.documentElement.clientWidth = 1280;   // the coach's Mac
globalThis.getComputedStyle = (n) => { const c = (n && n.cs) || {}; return { getPropertyValue: () => "", display: c.display || "block", paddingLeft: "0px", paddingTop: "0px", paddingBottom: "0px", color: "" }; };
if (typeof globalThis.CSS === "undefined") globalThis.CSS = { escape: (v) => String(v) };
const MK = new WeakSet();
function mk(tag) {                                                         // an element that keeps its listeners and its style (env.js answers any other name with a stub)
  const e = el(tag); e.H = {}; e.attrs = {}; e.parent = null; e.removed = false; e.inert = false;
  const st = {}; st.setProperty = (k, v) => { st[k] = v; }; st.removeProperty = (k) => { delete st[k]; }; st.getPropertyValue = (k) => st[k] || ""; e.style = st;
  e.addEventListener = (t, fn) => { (e.H[t] ||= []).push(fn); }; e.removeEventListener = (t, fn) => { const a = e.H[t] || []; const i = a.indexOf(fn); if (i >= 0) a.splice(i, 1); };
  e.setAttribute = (k, v) => { e.attrs[k] = String(v); }; e.getAttribute = (k) => (k in e.attrs ? e.attrs[k] : null); e.removeAttribute = (k) => { delete e.attrs[k]; };
  e.focus = () => { document.activeElement = e; }; e.blur = () => { if (document.activeElement === e) document.activeElement = document.body; };
  MK.add(e); return e;
}
const fire = (e, type, extra = {}) => {                                     // capture on the document, then the target's own, then the document's
  const ev = { type, target: e, currentTarget: e, detail: 1, clientX: 0, clientY: 0, button: 0, isPrimary: true, isTrusted: true, ...extra, stopped: false, defaultPrevented: false, stopPropagation() { this.stopped = true; }, preventDefault() { this.defaultPrevented = true; }, composedPath() { return [e]; } };
  for (const l of [...(L[type] || [])].filter((x) => x.capture)) l.fn(ev);
  if (!ev.stopped) for (const fn of [...((e.H || {})[type] || [])]) fn(ev);
  if (!ev.stopped) for (const l of [...(L[type] || [])].filter((x) => !x.capture)) l.fn(ev);
  return ev;
};
const recorder = (id, extra = {}) => { const e = mk("div"); e.id = id; Object.assign(e, extra); byId.set(id, e); return e; };
for (const id of ["whenPop", "ctxDim", "status"]) recorder(id);
recorder("whenBg", { hidden: true }); const askSheet = recorder("askSheet", { hidden: true });
document.querySelector = (s) => (/crop-view|sheet-bg/.test(String(s)) ? null : el());   // no menu, sheet or photo framing up
// the name box, as a page's textarea keeps it
const box = mk("textarea"); box.id = "tTitle"; byId.set("tTitle", box);
let text = "", s0 = 0, s1 = 0;
Object.defineProperty(box, "value", { get: () => text, set: (v) => { const nv = String(v ?? ""); if (nv !== text) { text = nv; s0 = s1 = nv.length; } }, configurable: true });   // written by script: the caret goes to the end when the value changes (as Chrome and Safari do)
Object.defineProperty(box, "selectionStart", { get: () => s0, configurable: true });
Object.defineProperty(box, "selectionEnd", { get: () => s1, configurable: true });
box.select = () => { s0 = 0; s1 = text.length; };
box.setSelectionRange = (a, b) => { s0 = Math.min(Math.max(0, a), text.length); s1 = Math.min(Math.max(s0, b), text.length); };
const app = (await import("../app/main.js")).internals();
const { fns, maps } = app;
const { TEMPLATES_ID } = await import("../app/model.js");

const TP = "4b6d8f0a-2c4e-4a6b-8d0f-1a3c5e7a9b1d", ALEX = "5c7e9a1b-3d5f-4b7d-9f1a-3c5e7a9b1d3f", LEGS = "3f5a7c9e-1b3d-4f5a-8c7e-9d1f3b5a7c9f", AT = "2026-11-10T16:00:00.000Z";
const sync = async () => { let done = false; fns.syncDownNow().finally(() => { done = true; }); for (let i = 0; i < 100 && !done; i++) await advance(5); await advance(50); };
const clickIn = (caret) => { fire(box, "pointerdown", { pointerType: "mouse", buttons: 1 }); box.focus(); fire(box, "focus"); fire(box, "pointerup", { pointerType: "mouse" }); fire(box, "click", { pointerType: "mouse" }); box.setSelectionRange(caret, caret); };   // a click in the box: the caret where he clicked
const selectAll = () => { fire(box, "keydown", { key: "a", code: "KeyA", metaKey: true, detail: 0 }); box.select(); fire(box, "keyup", { key: "a", code: "KeyA", metaKey: true, detail: 0 }); };   // Cmd+A
const typeText = async (s) => { for (const ch of s) { fire(box, "keydown", { key: ch, detail: 0 }); text = text.slice(0, s0) + ch + text.slice(s1); s0 = s1 = s0 + 1; fire(box, "input", { inputType: "insertText", data: ch }); fire(box, "keyup", { key: ch, detail: 0 }); await advance(40); } };   // each letter replaces the selection, the caret after it
async function rename(where, how) {                                         // where: Upper A's page (a template) or Alex's Legs (a client's workout); how: the whole name selected (Cmd+A), the caret after its first word, before it, or at its end
  fns.closePreview && fns.closePreview(); app.reset(); fns.leaveSettings(); localStorage.clear(); Q.length = 0; document.activeElement = document.body; text = ""; s0 = s1 = 0; box.dataset = {};
  const sb = makeSupabase(), tpl = where === "template", id = tpl ? TP : LEGS, was = tpl ? "Upper A" : "Legs", renamed = was + " (iPad)", extra = tpl ? undefined : { client_id: ALEX };
  sb.seed("ft_clients", TEMPLATES_ID, { id: TEMPLATES_ID, name: "Templates", kind: "templates", templatesVersion: 999, folders: [{ id: "f1", name: "Strength", parent: null, kind: "folder", at: AT }], builtinsAdopted: 1 });
  sb.seed("ft_trainings", TP, { id: TP, clientId: TEMPLATES_ID, title: "Upper A", date: "2026-01-01", createdAt: AT, completedAt: null, skippedAt: null, template: { program: "My templates", phase: 0, stage: 0, n: 1, folder: "f1" }, rows: [] });   // (no exercises yet)
  sb.seed("ft_clients", ALEX, { id: ALEX, name: "Alex Sample", unit: "lb" });
  { const d = new Date(); d.setDate(d.getDate() + 2); sb.seed("ft_trainings", LEGS, { id: LEGS, clientId: ALEX, title: "Legs", date: fns.localIso(d), createdAt: AT, completedAt: null, skippedAt: null, rows: [] }, { client_id: ALEX }); }   // Alex's Legs, the day after tomorrow
  app.set({ sb, signedIn: true, clientMode: false, backend: fns.cloudBackend, sessionEmail: "coach@x.com", view: { name: "clients" }, templateDraft: null });
  await sync();
  app.set({ view: { name: "training", id }, renderedTraining: null }); fns.render(); await advance(50);   // the page, drawn
  const log = { drawn: text };
  clickIn(how === "word" ? was.indexOf(" ") + 1 : how === "start" ? 0 : was.length); if (how === "all") selectAll();
  log.before = [s0, s1];
  { const cur = JSON.parse(JSON.stringify(sb.tables.ft_trainings.get(id).data)); cur.title = renamed; sb.seed("ft_trainings", id, cur, extra); }   // the iPad's rename reached the server
  await sync(); log.heard = { box: text, sel: [s0, s1], focused: document.activeElement === box };   // this Mac's sync brings it
  await typeText(how === "all" ? (tpl ? "Legs" : "Push") : how === "word" ? "Body " : how === "start" ? "Easy " : "x");
  log.typed = text; log.here = maps.trainings.get(id).title;
  if (tpl) fns.saveDraft();                                               // Save template (a client's workout saves by itself)
  await advance(2000); log.server = sb.tables.ft_trainings.get(id).data.title;
  box.blur(); return log;
}
const out = {};
for (const [where, ways] of [["template", ["all", "word", "end"]], ["workout", ["all", "start", "end"]]]) for (const how of ways) out[where + "_" + how] = await rename(where, how);
await new Promise((r) => setImmediate(r)); out.rejected = rejected;
console.log(JSON.stringify(out));
process.exit(0);
