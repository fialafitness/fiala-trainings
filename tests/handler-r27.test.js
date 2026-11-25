// v321: the twenty-sixth check round's handler findings (R26-HND-1, -2, -3) and the round-25 rule no test held (R26-TW-9's a_adoptForget).
// - R26-HND-1: a template with unsaved changes, Use for a client, a client, a day: the workout is made at once and its page waits for Save
//   template or Discard; a second pick meanwhile (the same client or another) makes nothing, and Save opens the one workout.
// - R26-HND-2 and R26-HND-3: run in handler-r27-probe.mjs's own process (cards-follow-probe.mjs's stand-ins, main.js's own boot for the restore).
// - a_adoptForget: a workout this page had (card 2 open, Set 3 picked, a note half typed), deleted on another device and dropped here by the sync,
//   comes back from another page's queue (a page that knows no lock: a v315 tab on release day) with none of the old copy's card state.
// Made-up people only.
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { test, assert, tick } from "./assert.js";
import { makeSupabase } from "./fake-supabase.js";
import { load } from "./load.js";
const dir = path.dirname(fileURLToPath(import.meta.url));
const app = await load();
const { fns, maps } = app;
const settle = async () => { const until = Date.now() + 15000; do await tick(5); while ((app.get().inflight > 0 || maps.timers.size) && Date.now() < until); };

// ---------- R26-HND-1: Use for a client picked twice while the first pick's move waits ----------
async function useTwiceProbe(dir) {                                     // run in its own process by the test below (template-draft.test.js's useProbe pattern: Use's button and its rows hear their clicks only on stand-ins set up before main.js loads); prints one JSON line
  const { pathToFileURL } = await import("node:url"), { join } = await import("node:path"), at = (f) => pathToFileURL(join(dir, f)).href;
  const { byId, el } = await import(at("env.js")), { makeSupabase } = await import(at("fake-supabase.js"));
  const kids = (e) => { e.replaceChildren = (...k) => { e.children = k; e.firstElementChild = k[0] || null; }; e.appendChild = (c) => { e.children = [...e.children, c]; e.firstElementChild = e.children[0]; return c; }; e.append = (...k) => { e.children = [...e.children, ...k]; e.firstElementChild = e.children[0] || null; }; return e; };
  const listens = (e) => { const L = {}; e.addEventListener = (type, fn) => { (L[type] ||= []).push(fn); }; e.fire = (type, ev) => { for (const fn of [...(L[type] || [])]) fn(ev); }; e.focus = () => { document.activeElement = e; }; return e; };
  const attrs = (e) => { const A = {}; e.setAttribute = (k, v) => { A[k] = String(v); }; e.getAttribute = (k) => (k in A ? A[k] : null); return e; };
  const recorder = (id, extra = {}) => { const e = attrs(listens(kids(el("div")))); Object.assign(e, extra); byId.set(id, e); return e; };
  for (const id of ["useBtn", "dpPrev", "dpNext", "dpToday", "dpCancel", "whenPop", "draftSave", "draftDiscard"]) recorder(id);
  const pick = recorder("usePick", { hidden: true }), grid = recorder("dpGrid", { clientWidth: 350, setPointerCapture() {} }), bar = recorder("draftBar", { hidden: true }); recorder("datePick", { hidden: true }); recorder("whenBg", { hidden: true });
  const make = document.createElement; document.createElement = (t) => attrs(listens(kids(make(t))));
  document.contains = (x) => !!x;
  globalThis.getComputedStyle = (n) => { const m = /translate3d\(([-\d.e]+)px/.exec((n && n.style && n.style.transform) || ""); return { transform: m ? "matrix(1, 0, 0, 1, " + Number(m[1]) + ", 0)" : "none", getPropertyValue: () => "", display: "block", color: "" }; };
  const app = (await import(at("../app/main.js"))).internals(), { fns, maps } = app, { TEMPLATES_ID } = await import(at("../app/model.js"));
  const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms));
  const settle = async () => { const until = Date.now() + 15000; do await tick(5); while ((app.get().inflight > 0 || maps.timers.size) && Date.now() < until); };
  const TP = "4b6d8f0a-2c4e-4a6b-8d0f-1a3c5e7a9b1d", NINA = "5c7e9a1b-3d5f-4b7d-9f1a-3c5e7a9b1d3f", OMAR = "6d8f0a2c-4e6a-4c8e-8a2b-4d6f8a0c2e4a", AT = "2026-11-10T16:00:00.000Z", out = {};
  const pickDay = async (nth) => { const dp = fns.datePicker(); if (!dp) return null; const page = grid.firstElementChild && grid.firstElementChild.children[dp.months.indexOf(dp.month)], bs = page ? page.children.filter((x) => !x.disabled && x.children && x.children[0] && /^\d+$/.test(String(x.children[0].textContent))) : [], b = bs[nth]; const ev = { detail: 0, stopped: false, stopPropagation() { this.stopped = true; }, preventDefault() {} }; if (b) { grid.fire("click", ev); if (!ev.stopped) b.fire("click", ev); } await settle(); return b ? String(b.children[0].textContent) : null; };   // a day of the month shown, by its place among the days that can be picked
  const openFor = (id) => { for (const li of pick.children) { const b = li.children && li.children[0]; if (!b || !b.fire) continue; b.fire("click", { detail: 1 }); const dp = fns.datePicker(); if (dp && dp.clientId === id) return true; if (dp) fns.closeDatePicker(); } return false; };   // the client's row in Use's list (the stand-ins keep no names: each row's days say whose they are)
  for (const kase of ["one client twice", "a second client", "no unsaved changes"]) {
    app.reset(); fns.leaveSettings(); pick.hidden = true; bar.hidden = true; const sb = makeSupabase();
    sb.seed("ft_clients", TEMPLATES_ID, { id: TEMPLATES_ID, name: "Templates", kind: "templates", templatesVersion: 3, folders: [{ id: "f1", name: "Strength", parent: null, kind: "folder", at: AT }], builtinsAdopted: 1 });
    sb.seed("ft_trainings", TP, { id: TP, clientId: TEMPLATES_ID, title: "Upper A", date: "2026-01-01", createdAt: AT, completedAt: null, skippedAt: null, template: { program: "My templates", phase: 0, stage: 0, n: 1, folder: "f1" }, rows: [] });
    sb.seed("ft_clients", NINA, { id: NINA, name: "Nina Park", unit: "lb" }); sb.seed("ft_clients", OMAR, { id: OMAR, name: "Omar Reyes", unit: "lb" });
    app.set({ sb, signedIn: true, clientMode: false, backend: fns.cloudBackend, sessionEmail: "coach@x.com", view: { name: "clients" }, templateDraft: null });
    await fns.syncDownNow(); await settle();
    app.set({ view: { name: "training", id: TP } }); fns.render();                                   // Upper A's page (its draft taken as it is drawn)
    if (kase !== "no unsaved changes") { maps.trainings.get(TP).title = "Upper A heavy"; app.get().templateDraft.dirty = true; fns.render(); }   // a change typed, not saved: the Unsaved changes bar
    const log = { bar: !bar.hidden };
    byId.get("useBtn").fire("click", { detail: 1 });                                                 // Use for a client: the clients
    log.rowFound = openFor(NINA); log.first = await pickDay(2);                                      // Nina, a day
    log.afterFirst = { view: app.get().view.name, held: !!app.get().pendingGo, listOpen: !pick.hidden, made: [...maps.trainings.values()].filter((t) => t.fromTemplate === TP).length };
    if (kase !== "no unsaved changes") {
      bar.classList.remove("nudge");
      if (pick.hidden) byId.get("useBtn").fire("click", { detail: 1 });
      log.rowFound2 = openFor(kase === "a second client" ? OMAR : NINA); log.second = await pickDay(3);   // taking it that nothing happened: again
      log.afterSecond = { held: !!app.get().pendingGo, hopped: bar.classList.contains("nudge"), daysUp: !!fns.datePicker(), made: [...maps.trainings.values()].filter((t) => t.fromTemplate === TP).length };
      byId.get("draftSave").fire("click", { detail: 1 }); await settle();                           // Save template: the move waiting goes
    }
    const v = app.get().view, made = [...maps.trainings.values()].filter((t) => t.fromTemplate === TP);
    log.made = made.map((t) => [maps.clients.get(t.clientId).name, t.title]).sort(); log.onServer = [...sb.tables.ft_trainings.values()].filter((r) => r.data.fromTemplate === TP).length;
    log.opened = v.name === "training" ? (made.find((t) => t.id === v.id) ? maps.clients.get(made.find((t) => t.id === v.id).clientId).name : v.id === TP ? "the template" : "?") : v.name;
    out[kase] = log;
  }
  console.log(JSON.stringify(out)); process.exit(0);
}
test("R26-HND-1: a template with unsaved changes, Use for a client picked again (the same client, or another) while the first pick's workout waits for Save template: nothing more is made, the bar hops, and Save opens the one workout", () => {
  const out = execFileSync(process.execPath, ["--input-type=module", "-e", "(" + useTwiceProbe.toString() + ")(" + JSON.stringify(dir) + ");"], { encoding: "utf8", timeout: 90000 });
  const r = JSON.parse(out.trim().split("\n").pop());
  assert.deepStrictEqual([r["no unsaved changes"].made, r["no unsaved changes"].onServer, r["no unsaved changes"].opened], [[["Nina Park", "Upper A"]], 1, "Nina Park"], "(control) no unsaved changes: Use makes one workout and opens it: " + JSON.stringify(r["no unsaved changes"]));
  for (const kase of ["one client twice", "a second client"]) {
    const o = r[kase];
    assert.deepStrictEqual([o.bar, o.rowFound, o.first, o.afterFirst], [true, true, "3", { view: "training", held: true, listOpen: true, made: 1 }], "(the setup) the bar up, the first pick made one workout and its page waits: " + JSON.stringify(o));
    assert.deepStrictEqual([o.rowFound2, o.second, o.afterSecond], [true, "4", { held: true, hopped: true, daysUp: false, made: 1 }], kase + ": the second pick made a second workout (or the bar did not hop): " + JSON.stringify(o));
    assert.deepStrictEqual([o.made, o.onServer, o.opened], [[["Nina Park", "Upper A heavy"]], 1, "Nina Park"], kase + ": one workout, on the server once, and Save template opens it: " + JSON.stringify(o));
  }
});

// ---------- R26-HND-2 and R26-HND-3 (handler-r27-probe.mjs) ----------
let probed = null;
const probe = () => probed || (probed = JSON.parse(execFileSync(process.execPath, [path.join(dir, "handler-r27-probe.mjs")], { encoding: "utf8", timeout: 120000 }).trim().split("\n").pop()));
const NONE = { question: false, menu: false, skip: false, early: false, days: false, asking: false, inert: [] };
test("R26-HND-2: a client's workout deleted on another device while its page is up with a question, an exercise's menu, the Skip sheet, the Skip exercise sheet or the day picker (the coach's Mac; and on her phone, the coach deleting it): the sync lands on Clients (her own page) with none of them left up, and nothing out of reach", () => {
  const r = probe(); assert.deepStrictEqual(r.rejected, [], "a step threw: " + JSON.stringify(r.rejected));
  const UP = { question: "question", menu: "menu", skip: "skip", early: "early", days: "days" };
  for (const [k, o] of Object.entries(r.gone)) {
    const [who, what] = k.split(" ");
    assert.ok(!o.error && o.drawn && o.before && o.before[UP[what]] === true, "(the setup) " + k + ": its page drawn and the " + what + " up over it: " + JSON.stringify(o));
    assert.deepStrictEqual(o.after, { page: who === "coach" ? "Clients" : "her page", ...NONE }, k + ": something stayed up (or out of reach) over the page the sync landed on: " + JSON.stringify(o.after));
  }
  assert.deepStrictEqual(Object.keys(r.gone), ["coach question", "coach menu", "coach skip", "coach early", "coach days", "client question", "client skip", "client early"]);
});
test("R26-HND-3: the coach's session ends elsewhere while the read after Restore's tap is out (one bar of signal, or the built-in templates' seeding): the sign-in page is in reach at once (the part inert in the markup stays so), and nothing is restored; signed in again at once, a question up as the old read ends stays the only thing in reach; with no sign-out the page waits for the read, then the restore lands", () => {
  const r = probe(), a = r.restore["signed out during the read"], c = r.restore["signed in again during the read, a question up as it ends"], b = r.restore["no sign-out"];
  for (const o of [a, c, b]) assert.deepStrictEqual([o.error, o.launched, o.question, o.reading], [undefined, true, "Restore this backup?", { page: false, bar: true, back: false, lifted: "inert", words: "Saving\u2026", read: true }], "(the setup) Restore tapped, its read out, the page out of reach: " + JSON.stringify(o));
  for (const o of [a, c]) assert.deepStrictEqual(o.signInPage, { page: true, bar: true, back: true, lifted: "inert", login: true, words: "Signed out. Sign in again to keep syncing.", read: true }, "the sign-in page came up out of reach (Email took no focus, Sign in was lost) while the old read was out: " + JSON.stringify(o.signInPage));
  assert.deepStrictEqual(a.after, { page: true, bar: true, back: true, lifted: "inert", read: false, login: true, server: "Legs heavy" }, "after the read: the sign-in page out of reach, the lifted copy given back, or the restore landed after the sign-out: " + JSON.stringify(a.after));
  assert.deepStrictEqual([c.signedIn, c.asked], [true, { question: true, page: false, read: true }], "(the setup) signed in again, a question up over his page, the old read still out: " + JSON.stringify(c));
  assert.deepStrictEqual(c.underQuestion, { question: true, page: false, bar: false, back: true, lifted: "inert", read: false }, "the old read's end gave the page behind the question back (a tap there reached the page): " + JSON.stringify(c.underQuestion));
  assert.deepStrictEqual(c.after, { page: true, bar: true, back: true, lifted: "inert", read: false, login: false, server: "Legs heavy" }, "after Cancel: his page out of reach, or the restore landed after the sign-out: " + JSON.stringify(c.after));
  assert.deepStrictEqual(b.after, { page: true, bar: true, back: true, lifted: "inert", read: false, login: false, server: "Legs" }, "(control) a restore with no sign-out lands, the page given back: " + JSON.stringify(b.after));
});

// ---------- R26-TW-9, a_adoptForget ----------
const day = (n) => { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + n); return fns.localIso(d); };   // the app's local day (never UTC)
const row = (id, label, name) => ({ id, label, name, sets: 3, reps: "10", rest: "", tempo: "", weights: [], repsDone: [], setsDone: 0, done: false, note: "", alts: [] });
test("R26-TW-9 (a_adoptForget): a workout deleted on the other device and dropped here by the sync, brought back by another page's queue (a v315 tab on release day), comes with none of this page's old card state (the open card, the picked set, the half-typed note and its base)", async () => {
  const C = "c-h27-1", W = "w-h27-1";
  const sb = makeSupabase(); app.reset(); fns.leaveSettings(); localStorage.clear();
  app.set({ sb, signedIn: true, clientMode: false, backend: fns.cloudBackend, sessionEmail: "coach@x.com", pendingOwner: "coach@x.com", view: { name: "clients" }, offline: false, offlineEntry: null });
  sb.seed("ft_clients", C, { id: C, name: "Jane Sample", unit: "lb", email: "jane@x.com" });
  const rec = { id: W, clientId: C, title: "Legs", date: day(1), createdAt: "2026-11-20T16:00:00.000Z", completedAt: null, skippedAt: null, rows: [row("x1", "1", "Back squat"), row("x2", "2", "Leg curl"), row("x3", "3", "Hip thrust")] };
  sb.seed("ft_trainings", W, rec, { client_id: C });
  const { openBlocks, setSel } = fns.cardSets(), k = fns.keptMaps(), mine = (it) => [...it].filter((x) => x.startsWith(W + "/"));
  let left;
  try {
    await fns.syncDownNow(); await settle();
    const had = maps.trainings.has(W);
    openBlocks.add(W + "/2"); setSel.set(W + "/2", 3); k.cardNoteDraft.set(W + "/2", "half typed on Leg curl"); k.cardNoteBase.set(W + "/2", "");   // card 2 open, its Set 3 picked, a note half typed on it
    sb.tables.ft_trainings.delete(W);                                     // deleted on the iPad
    await fns.syncDownNow(); await settle();
    const gone = !maps.trainings.has(W), kept = mine(openBlocks).length > 0;
    const other = { ...rec, rows: [row("x3", "1", "Hip thrust"), row("x2", "2", "Leg curl")] };   // the other tab's copy, edited before the deletion reached it
    localStorage.setItem("fiala.pending.tab", "v315-tab");
    localStorage.setItem("fiala.pending.v1", JSON.stringify({ tab: "v315-tab", owner: "coach@x.com", dirty: ["trainings/" + W], recs: [["trainings/" + W, other]] }));
    fns.persistPending();                                                 // this page writes the queue: it takes the other page's on first
    left = { had, gone, keptAfterSync: kept, back: maps.trainings.has(W), open: mine(openBlocks), set: mine(setSel.keys()), note: mine(k.cardNoteDraft.keys()), base: mine(k.cardNoteBase.keys()) };
  } finally { openBlocks.clear(); setSel.clear(); k.cardNoteDraft.clear(); k.cardNoteBase.clear(); for (const tm of maps.timers.values()) clearTimeout(tm); maps.timers.clear(); clearTimeout(app.get().syncTimer); app.reset(); localStorage.clear(); }
  assert.deepStrictEqual(left, { had: true, gone: true, keptAfterSync: true, back: true, open: [], set: [], note: [], base: [] }, "the copy taken from the other page came with the old copy's card state: " + JSON.stringify(left));
});
