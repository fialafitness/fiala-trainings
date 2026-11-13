// Run by template-preview.test.js in its own process: a template's preview, opened from its row on the Templates pages (his ask, 13 Nov:
// "Make Template workouts open in preview"): Edit in the corner and no "…", the purple Use for client at the foot (Use while choosing for a
// client), the arrows and the finger walking only the page's own slide (or folder, or My templates). The sheet, its buttons, the Templates
// list and the list sheet keep their listeners; every timer runs on this probe's own clock; it prints, as JSON, what each did.
import { byId, el } from "./env.js";
import { ui } from "../app/state.js";
import { TEMPLATES_ID as TPL } from "../app/model.js";
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
const WIN = {}; globalThis.addEventListener = (t, fn) => { (WIN[t] ||= []).push(fn); }; globalThis.removeEventListener = () => {};
const key = (k, mods = {}) => { const ev = { type: "keydown", key: k, target: byId.get("pvBox"), defaultPrevented: false, preventDefault() { this.defaultPrevented = true; }, ...mods }; for (const l of [...(L.keydown || [])].sort((a, b) => b.capture - a.capture)) l.fn(ev); return ev; };   // capture listeners first, as the DOM runs them
const kids = (e) => { e.replaceChildren = (...k) => { e.children = k; }; e.appendChild = (c) => { e.children = [...e.children, c]; return c; }; e.append = (...k) => { e.children = [...e.children, ...k]; }; return e; };
const listens = (e) => { const H = {}; e.H = H; e.addEventListener = (type, fn, o) => { (H[type] ||= []).push({ fn, o }); if (o && o.signal && o.signal.addEventListener) o.signal.addEventListener("abort", () => { H[type] = (H[type] || []).filter((x) => x.fn !== fn); }); }; e.removeEventListener = (type, fn) => { H[type] = (H[type] || []).filter((x) => x.fn !== fn); }; e.fire = (type, ev = {}) => { ev.type = type; if (!ev.target) ev.target = e; if (!ev.preventDefault) ev.preventDefault = () => { ev.defaultPrevented = true; }; if (!ev.stopPropagation) ev.stopPropagation = () => {}; for (const x of [...(H[type] || [])]) x.fn(ev); return ev; }; return e; };
const styled = (e) => { const st = {}; st.setProperty = (k, v) => { st[k] = v; }; st.removeProperty = (k) => { delete st[k]; }; e.style = st; return e; };
const made = [];                                                           // what the app made, in order (the pages sliding in, the menu's rows)
const num = (v) => +v || 0;
const mk = (tag) => { const e = styled(listens(kids(el(tag)))); e.inert = false; e.removed = false; e.remove = () => { e.removed = true; }; e.setAttribute = (k, v) => { e["@" + k] = v; }; e.focus = () => { document.activeElement = e; };
  e.getBoundingClientRect = () => ({ top: num(e.offsetTop), bottom: num(e.offsetTop) + num(e.offsetHeight), height: num(e.offsetHeight), left: 0, right: 0, width: 0 }); made.push(e); return e; };
document.createElement = mk;
const recorder = (id, extra = {}) => { const e = mk("div"); e.id = id; Object.assign(e, extra); byId.set(id, e); return e; };
const pvSheet = recorder("pvSheet", { hidden: true }), pvBar = recorder("pvBar", { clientWidth: 402 }), pvBox = recorder("pvBox", { offsetHeight: 600, clientWidth: 402 });
const pvScroll = recorder("pvScroll", { scrollTop: 0, scrollHeight: 1600, clientHeight: 600, offsetTop: 0, offsetHeight: 520 }); recorder("pvCards");
pvScroll.after = () => {};                                                 // (the page sliding in, put beside the list)
pvBox.getBoundingClientRect = () => { const h = num(pvBox.offsetHeight); return { top: 812 - h, bottom: 812, height: h, left: 0, right: 402, width: 402 }; };
for (const id of ["pvTitle", "pvBarTitle", "pvX", "pvGo", "pvEdit", "pvDay", "pvMore", "pvPrev", "pvNext", "pvSay", "whenPop", "askYes", "askNo", "askTitle", "askText", "pickList", "pickNo", "pickUp", "pickTitle", "dpCancel", "tplList"]) recorder(id);
for (const id of ["whenBg", "askSheet", "pickSheet", "datePick"]) recorder(id, { hidden: true });
for (const id of ["pvSheet", "askSheet", "pickSheet", "datePick"]) byId.get(id).classList.add("sheet-bg");
const main = recorder("mainEl"), header = recorder("headerEl");
if (typeof globalThis.CSS === "undefined") globalThis.CSS = { escape: (v) => String(v) };
if (typeof document.contains !== "function") document.contains = () => true;   // (every stand-in is on the page)
const cardOf = (sel) => { const m = /li\[data-tid="([^"]+)"\] > button/.exec(sel || ""), li = m && rows().find((x) => x.dataset.tid === m[1]); return li ? li.children[0] : null; };   // (rows() is defined below; called only once the page is drawn)
byId.get("tplList").querySelector = cardOf; recorder("vClient").querySelector = cardOf; byId.get("vClient").querySelectorAll = () => [];
byId.get("pickSheet").contains = (x) => !!x && ["pickNo", "pickList", "pickTitle", "pickUp"].some((id) => byId.get(id) === x);
document.querySelectorAll = (sel) => (sel === "main, header" ? [main, header] : sel === ".sheet-bg:not([hidden])" ? [pvSheet, byId.get("askSheet"), byId.get("pickSheet"), byId.get("datePick")].filter((x) => !x.hidden) : []);
document.querySelector = (sel) => (sel === "main" ? main : el());
document.body.children = [main, header, pvSheet, byId.get("whenBg"), byId.get("askSheet"), byId.get("pickSheet"), byId.get("datePick")];
const app = (await import("../app/main.js")).internals();
const { fns, maps } = app;
const at = (m) => "2026-11-12T10:" + String(m).padStart(2, "0") + ":00.000Z";
const node = (id, name, parent, kind, m) => ({ id, name, parent, kind, at: at(m) });
const T = (id, meta, extra = {}) => ({ id, clientId: TPL, title: "", date: "2026-01-01", createdAt: "2026-11-01T10:00:00.000Z", completedAt: null, skippedAt: null, rows: [], template: meta, ...extra });   // (no exercises: the stand-in page cannot draw a workout's, and the preview's cards are preview.test.js's)
const MINE = (n, folder) => ({ program: "My templates", phase: 0, stage: 0, n, ...(folder ? { folder } : {}) });
const FAT = (n, stage) => ({ program: "Fat Burn", phase: 1, stage, n, phaseName: "Base" });
// his program A ("Summer block", with t7 in it itself) and its phase B ("Phase 1"): Week 1 has t1 (named Legs) and t2, Week 2 has t3, and t4 sits in B
// itself (shown with the first week); My templates has t5 and t6; a built-in program not yet a folder (a page kept from before v281): Week 1 has b1
// and b2, Week 2 b3
const FOLDERS = [node("A", "Summer block", null, "folder", 5), node("B", "Phase 1", "A", "folder", 6), node("S1", "Week 1", "B", "slide", 7), node("S2", "Week 2", "B", "slide", 8)];
const TPLS = [T("t1", MINE(1, "S1"), { title: "Legs" }), T("t2", MINE(2, "S1")), T("t3", MINE(1, "S2")), T("t4", MINE(3, "B")), T("t5", MINE(1)), T("t6", MINE(2)), T("b1", FAT(1, 1)), T("b2", FAT(2, 1)), T("b3", FAT(1, 2)), T("t7", MINE(1, "A"))];
function seed(view, extra = {}) {
  fns.closePreview(); fns.closeDatePicker(); app.reset(); fns.setPickFor(null); fns.setFillFor(null);
  app.set({ signedIn: true, clientMode: false, myClientId: null, tab: "workouts", ...extra });
  maps.clients.set("c1", { id: "c1", name: "Jane", unit: "lb", sort: 1 }); maps.clients.set("c2", { id: "c2", name: "Bob", unit: "lb", sort: 2 });
  maps.clients.set(TPL, { id: TPL, name: "Templates", kind: "templates", folders: JSON.parse(JSON.stringify(FOLDERS)) });
  for (const t of TPLS) maps.trainings.set(t.id, JSON.parse(JSON.stringify(t)));
  app.set({ view, renderedTraining: null }); fns.render();
}
const B1 = { name: "client", id: TPL, folder: "B" }, B2 = { name: "client", id: TPL, folder: "B", slide: "S2" }, ROOT = { name: "client", id: TPL }, FAT1 = { name: "client", id: TPL, program: "Fat Burn", phase: 1, stage: 1 };
const rows = () => (byId.get("tplList").children || []).filter((e) => e.className === "list").flatMap((ul) => ul.children || []).filter((li) => li.dataset && li.dataset.tid);
const rowOf = (tid) => rows().find((li) => li.dataset.tid === tid);
const look = () => ({ id: (fns.previewState() || {}).id || null, title: byId.get("pvTitle").textContent, day: byId.get("pvDay").textContent, bar: byId.get("pvBarTitle").textContent, go: byId.get("pvGo").textContent, purple: !byId.get("pvGo").classList.contains("tint"),
  edit: !byId.get("pvEdit").hidden, more: !byId.get("pvMore").hidden, prev: !byId.get("pvPrev").disabled, next: !byId.get("pvNext").disabled });
const tap = async (id) => { byId.get(id).fire("click", { detail: 1 }); await advance(400); };
const openRow = async (view, tid, extra) => { seed(view, extra); const li = rowOf(tid); if (li) li.children[0].fire("click", { detail: 1 }); await advance(400); return !!li; };
const walk = async (view, tid, dir) => { await openRow(view, tid); const ids = [look().id]; for (let i = 0; i < 4; i++) { await tap(dir > 0 ? "pvNext" : "pvPrev"); if (look().id === ids[ids.length - 1]) break; ids.push(look().id); } return ids; };
const pickRow = (id) => byId.get("pickList").fire("click", { target: { closest: () => ({ dataset: { id } }) } });
const sheetRows = () => (byId.get("pickList").children || []).map((li) => { const b = (li.children || [])[0]; return b ? [b.dataset.id, b.firstChild.textContent, b.lastChild.textContent] : [li.className, li.textContent]; });
const theirs = (cid) => [...maps.trainings.values()].filter((t) => t.clientId === cid).sort((x, y) => x.date.localeCompare(y.date)).map((t) => [t.date, t.title, t.fromTemplate || null, t.rows.map((r) => r.name).join()]);
const out = {};
// ---------- a row's tap opens its preview: its name as its row writes it, the page it is on, Edit in the corner, no "…", Use for client in the purple ----------
{ out.rowTap = { found: await openRow(B1, "t1"), ...look(), say: byId.get("pvSay").textContent }; }
{ await openRow(B1, "t2"); out.plain = look(); }
{ await openRow(ROOT, "t5"); out.root = look(); }
{ await openRow(FAT1, "b1"); out.fat = look(); }
{ await openRow({ name: "client", id: TPL, folder: "A" }, "t7"); out.folder = look(); }
// ---------- the walk: only the page's own templates (his ask: "only in that folder / slide .. for example week one"), in its order ----------
out.walks = { b1next: await walk(B1, "t1", 1), b1prev: await walk(B1, "t4", -1), b2: await walk(B2, "t3", 1), root: await walk(ROOT, "t5", 1), fat: await walk(FAT1, "b1", 1) };
out.near = { t1: (seed(B1), fns.previewNear("t1")), t3onB1: (seed(B1), fns.previewNear("t3")), t3onB2: (seed(B2), fns.previewNear("t3")) };
{ await openRow(B1, "t1"); await tap("pvNext"); out.slid = { ...look(), say: byId.get("pvSay").textContent }; }
// ---------- Edit: the template's own page, the coach's view, as its row's tap opened it before; not within the first 350 ms ----------
{ seed(B1); rowOf("t1").children[0].fire("click", { detail: 1 }); await advance(100); byId.get("pvEdit").fire("click", { detail: 1 }); const early = { id: (fns.previewState() || {}).id || null, view: app.get().view.name };
  await advance(300); byId.get("pvEdit").fire("click", { detail: 1 }); out.edit = { early, view: app.get().view, open: !!fns.previewState(), sheet: !byId.get("pvSheet").hidden }; }
{ seed(B1); rowOf("t1").children[0].fire("click", { detail: 1 }); byId.get("pvEdit").fire("click", { detail: 0 }); out.editKey = { view: app.get().view }; }   // a keyboard's Enter: at once
// ---------- Use for client: which client (the last one used first), the day in their calendar, then the new workout, in the coach's view ----------
{ await openRow(B1, "t1"); await tap("pvGo");
  const sheet = { up: !byId.get("pickSheet").hidden, title: byId.get("pickTitle").textContent, rows: sheetRows(), preview: !!fns.previewState() };
  await advance(400); pickRow("c2"); await flush();
  const dp = fns.datePicker(); const days = dp && { title: dp.title, ok: dp.ok ? dp.ok() : null };
  if (dp) { const pick = dp.onPick; fns.closeDatePicker(); pick("2026-12-07"); } await flush();
  const v = app.get().view, made_ = v.name === "training" ? maps.trainings.get(v.id) : null;
  out.use = { sheet, days, bob: theirs("c2"), view: v.name, opened: made_ ? [made_.clientId, made_.title, made_.fromTemplate] : null, preview: app.get().previewClient ?? null, coach: fns.previewOn() };
  seed(B1); rowOf("t2").children[0].fire("click", { detail: 1 }); await advance(400); await tap("pvGo"); out.use.again = sheetRows(); }
{ await openRow(B1, "t1"); await tap("pvGo"); await advance(400); app.set({ view: { name: "client", id: "c1" } }); pickRow("c1"); await flush(); out.useLeft = { days: !!fns.datePicker(), jane: theirs("c1").length }; }   // Back while the clients were up: nothing
{ await openRow(B1, "t1"); await tap("pvGo"); await advance(400); maps.trainings.delete("t1"); pickRow("c1"); await flush(); out.useGone = { days: !!fns.datePicker() }; }   // the template deleted on another device meanwhile
{ await openRow(B1, "t1"); await tap("pvGo"); await advance(400); pickRow("c1"); await flush(); const dp = fns.datePicker(); maps.trainings.delete("t1"); const ok = dp && dp.ok(); const pick = dp.onPick; fns.closeDatePicker(); pick("2026-12-07"); await flush(); out.useGoneDays = { ok, jane: theirs("c1").length }; }
{ seed(B1); maps.clients.delete("c1"); maps.clients.delete("c2"); rowOf("t1").children[0].fire("click", { detail: 1 }); await advance(400); await tap("pvGo"); out.noClients = { title: byId.get("pickTitle").textContent, rows: sheetRows() }; byId.get("pickNo").fire("click", {}); await flush(); out.noClients.days = !!fns.datePicker(); }
// ---------- choosing a template for a client (From template on their empty workout): the card opens the preview, its foot says Use (no Edit while choosing); Use, the row's or the
// preview's, asks the day first (his pick, 13 Nov: "if I click use it will take me to pick a date and then opens up in my coaches view"), the client's days open on the workout's own
// with it outlined, then it takes the template on the day picked and opens; one finished, skipped or filled meanwhile stays as it is and the template goes in beside it ----------
let clientDepth = 0;
const choosing = async (w0 = {}) => { seed({ name: "client", id: "c1" }); clientDepth = fns.navState().depth; maps.trainings.set("w0", { id: "w0", clientId: "c1", date: "2026-11-27", createdAt: "2026-11-10T10:00:00.000Z", title: "", completedAt: null, skippedAt: null, rows: [], ...w0 });
  fns.go({ name: "training", id: "w0" }); await flush(); fns.fromTemplate(maps.trainings.get("w0")); await flush(); fns.go(fns.tplPage("B")); await flush(); fns.render(); };
const days = () => { const dp = fns.datePicker(); return dp ? { title: dp.title, selected: dp.selected, moving: dp.moving } : null; };
const pickDay = async (d) => { const dp = fns.datePicker(); if (dp) { const pick = dp.onPick; fns.closeDatePicker(); pick(d); } await flush(); };
const w0Now = () => { const w = maps.trainings.get("w0"); return w && { title: w.title, date: w.date, from: w.fromTemplate || null, rows: w.rows.length, skipped: !!w.skippedAt }; };
{ await choosing(); const li = rowOf("t2"); out.pickRow = { pick: li.classList.contains("pick-row"), kids: li.children.map((k) => k.tagName + "." + k.className + ":" + (k.textContent || "")), swipe: typeof li._ctx === "function" };
  li.children[0].fire("click", { detail: 1 }); await advance(400); out.pickPreview = look();
  await tap("pvGo"); out.pickUse = { preview: !!fns.previewState(), days: days(), w0: w0Now() };
  await pickDay("2026-11-27"); out.pickUse.after = { w0: w0Now(), view: app.get().view, others: theirs("c1").length, choosing: fns.choosing().pickFor, coach: fns.previewOn() }; }
{ await choosing(); rowOf("t2").children[1].fire("click", { detail: 1 }); out.rowUse = { preview: !!fns.previewState(), days: days() }; await pickDay("2026-12-02"); out.rowUse.after = { w0: w0Now(), view: app.get().view, others: theirs("c1").length, claimed: [...(maps.trainerState.get("w0") || [])].includes("date"), depth: fns.navState().depth - clientDepth }; }
{ await choosing(); rowOf("t2").children[0].fire("click", { detail: 1 }); await advance(400); maps.trainings.get("w0").skippedAt = "2026-11-12T10:00:00.000Z";   // the client skipped it meanwhile, on their phone
  await tap("pvGo"); out.beside = { days: days() }; await pickDay("2026-12-08"); const v = app.get().view, made_ = v.name === "training" ? maps.trainings.get(v.id) : null;
  out.beside.after = { w0: w0Now(), opened: made_ && made_.id !== "w0" ? [made_.date, made_.title, made_.fromTemplate] : null, all: theirs("c1").length, depth: fns.navState().depth - clientDepth }; }
{ await choosing(); maps.trainings.get("w0").rows = [{ id: "x", label: "1", name: "Plank", sets: 3, reps: "30 sec", rest: "", tempo: "", note: "", alts: [] }]; rowOf("t2").children[1].fire("click", { detail: 1 }); out.besideFull = { days: days() }; }   // given exercises on another device meanwhile: nothing outlined
{ await choosing(); rowOf("t2").children[1].fire("click", { detail: 1 }); const dp = fns.datePicker(); maps.trainings.delete("t2"); out.useGoneTpl = { ok: dp.ok() }; await pickDay("2026-11-27"); out.useGoneTpl.w0 = w0Now(); }
// ---------- a touch and hold's lifted card, tapped: what a tap on the card does ----------
{ seed(B1); const li = rowOf("t1"); out.browseRow = { pick: li.classList.contains("pick-row"), kids: li.children.map((k) => k.tagName + "." + k.className) }; }
{ seed(B1); const li = rowOf("t1"); out.lift = { has: !!(li._ctx && li._ctx.open) }; if (li._ctx && li._ctx.open) { li._ctx.open(); await advance(400); } out.lift.id = (fns.previewState() || {}).id || null; out.lift.view = app.get().view.name; }
// ---------- a client's workout keeps its own: no Edit, Start workout, its day ----------
{ seed({ name: "client", id: "c1" }); maps.trainings.set("w1", { id: "w1", clientId: "c1", date: fns.today(), createdAt: "2026-11-10T10:00:00.000Z", title: "Push", completedAt: null, skippedAt: null, rows: [] }); fns.render(); fns.openPreview("w1"); await advance(400); out.client = look(); }
// ---------- a template deleted on another device while its preview is up: the preview closes, as a workout's does ----------
{ await openRow(B1, "t2"); maps.trainings.get("t2").title = "Pull"; fns.render(); out.synced = look(); maps.trainings.delete("t2"); fns.render(); await advance(400); out.goneOpen = { open: !!fns.previewState(), sheet: !byId.get("pvSheet").hidden }; }
{ await openRow(B1, "t1"); maps.trainings.get("t3").template = MINE(4, "S1"); fns.render(); out.joined = look(); await tap("pvNext"); await tap("pvNext"); await tap("pvNext"); out.joined.end = look().id; }   // another device moved Week 2's into Week 1 meanwhile: the walk takes it in
{ await openRow(B1, "t2"); byId.get("pvNext").fire("click", { detail: 1 }); await advance(50); const mid = { slide: !!fns.previewSlide(), id: (fns.previewState() || {}).id || null, next: !byId.get("pvNext").disabled };
  maps.trainings.set("t8", T("t8", MINE(4, "S1"))); fns.render(); out.midSlide = { ...mid, nextAfter: !byId.get("pvNext").disabled, slideAfter: !!fns.previewSlide() }; await advance(400); out.midSlide.landed = look().id; }   // a redraw mid-slide (another device added one at the end of Week 1): the arrows at once, the slide still lands where it was going
{ await openRow(B1, "t1"); maps.trainings.get("t1").template = MINE(1, "S2"); fns.render(); out.movedOff = { open: !!fns.previewState(), sheet: !byId.get("pvSheet").hidden }; }   // another device moved it to Week 2: the preview goes
{ seed(B1); const card = rowOf("t1").children[0]; card.focus(); card.fire("click", { detail: 0 }); await advance(400);   // a keyboard's Enter on the row, then on Use for client, then Cancel on the clients
  byId.get("pvGo").fire("click", { detail: 0 }); const inSheet = document.activeElement === byId.get("pickNo"); await advance(400);
  byId.get("pickNo").fire("click", {}); await flush(); out.focus = { sheetTookIt: inSheet, backOnRow: document.activeElement === rowOf("t1").children[0] }; }
{ seed(B1); const card = rowOf("t1").children[0]; card.focus(); card.fire("click", { detail: 0 }); await advance(400); byId.get("pvGo").fire("click", { detail: 0 }); await advance(400); pickRow("c2"); await flush();
  const dp = fns.datePicker(); out.focus.daysBack = !!dp && dp.back === rowOf("t1").children[0]; }
{ await choosing(); const card = rowOf("t2").children[0]; card.focus(); card.fire("click", { detail: 0 }); await advance(400); byId.get("pvGo").fire("click", { detail: 0 });   // choosing: a keyboard's Use in the preview
  const dp = fns.datePicker(); out.focus.pickDaysBack = !!dp && dp.back === rowOf("t2").children[0]; out.today = fns.today(); }
console.log(JSON.stringify(out));
