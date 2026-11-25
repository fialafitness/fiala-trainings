// Run by visible.test.js in its own process: two of the audit's visible fixes of 15 Nov 2026, after the owner's picks and pictures.
// "Mark set N as not done" asks first and names every set that changes (#12, his pick "Ask first, naming sets"); the monthly report opens a
// sheet, the month and "Include your notes" (off every time), and shares the PDF with or without his private notes (#6, his pick "One button,
// export sheet"). The stand-ins are sets-count-probe.mjs's.
import { byId, el } from "./env.js";
import { today } from "../app/util.js";
{ const now = new Date(), next = new Date(now); next.setHours(24, 0, 0, 0); const left = next - now; if (left < 15000) await new Promise((r) => setTimeout(r, left + 50)); }   // (v316, the twenty-third check round: a run that would cross local midnight starts in the next day)
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
for (const id of ["whenPop", "ctxDim", "altTitle", "altLead", "altDone", "status", "dpTitle"]) recorder(id);
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
const repSheet = recorder("repSheet", { hidden: true }), repBox = recorder("repBox");   // the report's sheet, as the markup holds it
for (const id of ["repTitle", "repLead", "repMonth", "repNotes", "repFoot", "repShare", "repNo", "reportBtn"]) recorder(id);
repBox.append(byId.get("repTitle"), byId.get("repLead"), byId.get("repMonth"), byId.get("repNotes"), byId.get("repFoot"), byId.get("repShare"), byId.get("repNo")); repSheet.appendChild(repBox); repSheet.firstElementChild = repBox;
document.body.children = [main, header, whenBg, altSheet, askSheet, repSheet];
const shared = []; navigator.canShare = () => true; navigator.share = async (d) => { shared.push(d); };   // the phone's share sheet: what it was handed
globalThis.fetch = () => Promise.reject(new Error("offline"));   // no fonts: the report in the PDF's own Helvetica, its words readable in the file
const app = (await import("../app/main.js")).internals();
const { fns, maps } = app;
const turn = async (n = 6) => { for (let i = 0; i < n; i++) { await flush(); await new Promise((r) => setImmediate(r)); } };   // the share's own promises (the fonts, the file) are real ones

const yes = byId.get("askYes"), no = byId.get("askNo"), askText = byId.get("askText");
const R = (id, label, name, extra = {}) => ({ id, label, name, sets: 5, reps: "8", rest: "90 sec", tempo: "", weights: [], repsDone: [], setsDone: 0, done: false, note: "", alts: [], ...extra });
function seed({ client = false, a = {}, b = null } = {}) {
  fire(document.body, "keydown", { key: "Escape" });   // what an earlier scene left open closes, with all it listened for
  app.reset(); fns.setPreview(false); made.length = 0; rowsEl.replaceChildren();
  app.set({ signedIn: true, clientMode: client, myClientId: client ? "c1" : null, tab: "workouts", templateDraft: null });
  maps.clients.set("c1", { id: "c1", name: "Jane Smith", unit: "lb", notes: { log: [{ id: "n1", at: new Date().toISOString(), text: "Left knee clicked on set 4." }] } });
  maps.trainings.set("t1", { id: "t1", clientId: "c1", title: "Upper body", date: today(), createdAt: "2026-11-01T10:00:00.000Z", completedAt: null, skippedAt: null,
    rows: [R("a", b ? "1a" : "1", "Barbell bench press", a), ...(b ? [R("b", "1b", "Seated cable row", b)] : [])] });
  app.set({ view: { name: "training", id: "t1" }, renderedTraining: null }); fns.render();
  whenBg.hidden = true; askSheet.hidden = true; repSheet.hidden = true; maps.dirty.clear(); document.activeElement = null;
  for (const n of [main, header, whenBg, altSheet, askSheet, repSheet]) n.inert = false;
}
const blockOf = (key = "1") => made.filter((x) => classesOf(x).has("block") && x.parent === rowsEl && x.dataset && x.dataset.key === key).pop() || null;
const chip = (i) => { const t = findAll(blockOf(), ".tracker")[0]; return t ? findAll(t, ".tr-chips")[0].children[i] : null; };
const undoBtn = () => findAll(blockOf(), ".undo-set")[0] || null;
const asked = () => ({ open: !askSheet.hidden, title: byId.get("askTitle").textContent, text: askText.hidden ? "" : askText.textContent, yes: yes.textContent, red: classesOf(yes).has("danger") });
const rowNow = (id = "a") => { const r = maps.trainings.get("t1").rows.find((x) => x.id === id); return { setsDone: r.setsDone, done: r.done, reps: (r.repsDone || []).slice(), weights: (r.weights || []).slice() }; };
const logged3 = { setsDone: 3, weights: ["135", "135", "135"], repsDone: ["5", "6", "7"] };
const out = {};

// ---------- "Mark set N as not done" (the audit's #12) ----------
{ seed({ a: logged3 });   // sets 1 to 3 done; set 2 looked at: its button names set 2, the question every set that changes
  fire(chip(1), "click"); const u = undoBtn(); out.button = { text: u && u.textContent, hidden: !!(u && u.hidden) };
  fire(u, "click"); await flush(); out.asked = asked(); out.askedRow = rowNow(); out.askedSaved = maps.dirty.has("trainings/t1");
  fire(no, "click"); await flush(); out.cancelled = { open: !askSheet.hidden, row: rowNow(), saved: maps.dirty.has("trainings/t1") };
  fire(undoBtn(), "click"); await flush(); fire(yes, "click"); await flush(); out.doubleTap = { open: !askSheet.hidden, row: rowNow() };   // the second tap of a double tap lands on the red button and does nothing
  await advance(400); fire(yes, "click"); await flush();
  out.marked = { open: !askSheet.hidden, row: rowNow(), saved: maps.dirty.has("trainings/t1"), touched: !!(maps.trainerTouched.get("t1") && maps.trainerTouched.get("t1").has("a")), cur: (findAll(findAll(blockOf(), ".tracker")[0], ".cur")[0] || {}).textContent };
}
{ seed({ a: logged3 }); fire(chip(2), "click"); fire(undoBtn(), "click"); await flush(); out.one = asked(); }   // the last set done: one set named
{ seed({ a: { setsDone: 4, weights: ["135", "135", "135", "135"], repsDone: ["5", "5", "5", "5"] } }); fire(chip(1), "click"); fire(undoBtn(), "click"); await flush(); out.three = asked(); }   // sets 2 to 4
{ seed({ a: { setsDone: 3, weights: ["135", "135", "135"] } }); fire(chip(1), "click"); fire(undoBtn(), "click"); await flush(); out.noReps = asked(); }   // nothing in the reps: nothing to say about them
{ seed({ a: logged3, b: { setsDone: 2, weights: ["60", "60"], repsDone: ["10", "10"] } });   // a superset: the sets done in either exercise from set 2 on
  fire(chip(1), "click"); fire(undoBtn(), "click"); await flush(); out.superset = asked(); await advance(400); fire(yes, "click"); await flush();
  out.supersetMarked = { a: rowNow("a"), b: rowNow("b") };
}
{ seed({ a: { sets: 4, done: true, repsDone: ["5", "5", "5", "5"], weights: ["135", "135", "135", "135"] } }); delete maps.trainings.get("t1").rows[0].setsDone; app.set({ renderedTraining: null }); fns.render();   // finished before the counter existed: set 3 and on, never sets 1 and 2
  fire(chip(2), "click"); fire(undoBtn(), "click"); await flush(); out.legacy = asked(); await advance(400); fire(yes, "click"); await flush(); out.legacyMarked = rowNow();
}
{ seed({ a: logged3 });   // a sync replaced the record while the question was up: the change goes into the record there now
  fire(chip(1), "click"); fire(undoBtn(), "click"); await flush(); const old = maps.trainings.get("t1"), fresh = JSON.parse(JSON.stringify(old)); fresh.title = "Synced"; maps.trainings.set("t1", fresh);
  await advance(400); fire(yes, "click"); await flush(); out.synced = { now: rowNow(), title: maps.trainings.get("t1").title, oldKept: old.rows[0].setsDone };
  fire(chip(1), "click"); fire(undoBtn(), "click"); await flush(); const askedNow = !askSheet.hidden; maps.trainings.delete("t1");   // gone meanwhile: nothing comes back, nothing throws
  let threw = null; await advance(400); try { fire(yes, "click"); await flush(); } catch (e) { threw = String(e); } out.gone = { asked: askedNow, threw, back: maps.trainings.has("t1") };
}
{ seed({ a: logged3 });   // from the keyboard: Cancel gives the place back to the button, Mark not done to the card's Complete set
  fire(chip(1), "click"); fire(undoBtn(), "click", { detail: 0, isTrusted: true }); await flush(); fire(no, "click", { detail: 0, isTrusted: true }); await flush();
  out.keyCancel = { focus: document.activeElement === undoBtn() };
  fire(undoBtn(), "click", { detail: 0, isTrusted: true }); await flush(); await advance(400); fire(yes, "click", { detail: 0, isTrusted: true }); await flush();
  const el = document.activeElement; out.keyYes = { focus: !!el && classesOf(el).has("complete") && blockOf().contains(el), text: el && el.textContent };
}
{ seed({ client: true, a: logged3 });   // the client's own: asked the same, and the change waits in the client's queue
  fire(chip(1), "click"); fire(undoBtn(), "click"); await flush(); out.client = asked(); await advance(400); fire(yes, "click"); await flush();
  out.clientMarked = { row: rowNow(), queued: !!(maps.pendingWeightRows.get("t1") && maps.pendingWeightRows.get("t1").has("a")) };
}

// ---------- the monthly report's sheet (the audit's #6) ----------
const sheet = () => ({ open: !repSheet.hidden, lead: byId.get("repLead").textContent, notes: byId.get("repNotes").attrs["aria-checked"], foot: byId.get("repFoot").textContent, inert: main.inert, focus: document.activeElement === byId.get("repNo"), asking: !!app.get().asking });
const pdfOf = async (i) => { const f = shared[i] && shared[i].files && shared[i].files[0]; if (!f) return null; const s = Buffer.from(await f.arrayBuffer()).toString("latin1"); return { name: f.name, type: f.type, note: s.includes("Left knee clicked on set 4."), heading: s.includes("(Notes)") }; };
const openRep = (ev = {}) => fire(byId.get("reportBtn"), "click", ev);
{ seed(); app.set({ view: { name: "client", id: "c1" }, tab: "profile" });
  openRep(); const sel = byId.get("repMonth"), opts = sel.nodes.map((o) => [o.value, o.text]);
  out.opened = sheet(); out.months = { count: opts.length, first: opts[0], value: sel.value, twelve: opts[12] };
  fire(byId.get("repNotes"), "click"); fire(byId.get("repShare"), "click"); await turn();   // a double tap on Monthly report: its second tap lands on the sheet and changes nothing
  out.early = { ...sheet(), shared: shared.length };
  await advance(400); fire(byId.get("repNotes"), "click"); out.on = sheet(); fire(byId.get("repNotes"), "click"); out.off = sheet();
  fire(byId.get("repShare"), "click"); await turn(); out.sharedOff = { ...sheet(), count: shared.length, pdf: await pdfOf(0) };
  openRep(); await advance(400); fire(byId.get("repNotes"), "click"); fire(byId.get("repShare"), "click"); await turn(); out.sharedOn = { count: shared.length, pdf: await pdfOf(1) };
  openRep(); out.reopened = sheet().notes;   // off again, every time
  const prev = byId.get("repMonth").nodes[1]; byId.get("repMonth").value = prev.value; await advance(400); fire(byId.get("repShare"), "click"); await turn(); out.sharedPrev = { month: prev.text, pdf: await pdfOf(2) };
  openRep(); await advance(400); fire(byId.get("repNo"), "click"); await turn(); out.cancel = { ...sheet(), shared: shared.length };
  openRep(); await advance(400); fire(repBox, "pointerdown"); fire(repSheet, "click"); out.dimFromSheet = sheet().open;   // a press begun on the sheet and let go on the dim (words selected past its edge) keeps it
  fire(repSheet, "pointerdown"); fire(repSheet, "click"); out.dim = { ...sheet(), shared: shared.length };
  openRep(); fire(document.body, "keydown", { key: "Escape" }); out.escape = sheet().open;
  const btn = byId.get("reportBtn"); document.activeElement = btn; openRep({ detail: 0, isTrusted: true }); fire(byId.get("repNo"), "click", { detail: 0, isTrusted: true }); out.keyBack = document.activeElement === btn;
  openRep(); fns.askFirst({ title: "Delete it?" }); await flush(); out.otherAsk = { rep: !repSheet.hidden, ask: !askSheet.hidden };   // another question closes it first
  fire(document.body, "keydown", { key: "Escape" });
  app.set({ clientMode: true }); openRep(); out.repClient = !repSheet.hidden; app.set({ clientMode: false });
  app.set({ view: { name: "training", id: "t1" } }); openRep(); out.otherPage = !repSheet.hidden;
}
await new Promise((r) => setImmediate(r));   // a turn of the event loop: Node reports a promise rejected and unhandled only then
out.rejected = rejected;
console.log(JSON.stringify(out));
