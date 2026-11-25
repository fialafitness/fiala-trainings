// v316, the twenty-fourth check round (24 Nov 2026): one device, two accounts, after a session ended elsewhere (a password changed on
// another device) while something still waited for the signal, so the device kept the first account's work for its next sign-in.
// - A client signing in next holds her own record, as the server sends it (without the coach's notes about her), and her own workouts,
//   in her page and in her device copy at once, and her app opened again opens on her own page (it opened on another client's workout,
//   his note shown as "Your note", and her device copy kept every client of the coach's until a read of hers landed).
// - The coach signing in next never takes a client's waiting card notes (pendingNoteRows): his syncs then take the server's copy of her
//   workout (his Mac's rename and new exercise came in nowhere) and no launch writes her old copy back over it (every launch did).
// - The coach's unsaved template typing is kept for his own sign-in again (the session's end dropped it), never over the sign-in page,
//   never for another account; a wiped device keeps no draft of his.
// A half-typed card note never crosses to the next account, and the coach's typing comes back on his template's page with its bar:
// account-switch-probe.mjs draws those pages with the real sign-in form (Node's stand-in elements cannot draw a workout's page).
// Each sign-in here is main.js's own boot, the stand-in library holding that person's session. Made-up people only.
// The twenty-fifth check round (25 Nov 2026): the owner's pick "Clear the device" (R25-TW-4), and, on the probe's pages, what one account leaves
// waiting while the next one comes in (R25-PRV-1 to -4) and the coach's half-typed private note (R25-TW-10): see the blocks below.
// The twenty-sixth check round (25 Nov 2026), on the probe's pages too: what the Sign in and Create account forms hold after a Sign out (R26-PRV-1),
// the half-typed notes and the cards' state after both Sign outs and the wipe (R26-PRV-2, R26-WAP-5), and a password-reset link left unfinished
// (R26-PRV-3): see the last block.
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { test, assert, tick } from "./assert.js";
import { makeSupabase } from "./fake-supabase.js";
import { load } from "./load.js";
import { byId } from "./env.js";
import { TEMPLATES_ID, cmpLabel } from "../app/model.js";
const app = await load();
const { fns, maps } = app;
const settle = async () => { const until = Date.now() + 15000; do await tick(5); while ((app.get().inflight > 0 || maps.timers.size) && Date.now() < until); };
const until = async (ok, what) => { for (let i = 0; i < 4000 && !ok(); i++) await tick(2); assert.ok(ok(), "(the setup) this never happened: " + what); };   // waits for a step of the app, never for a fixed time
const JC = "5e7a9c1b-1111-4d3f-8a5b-7c9e1a3b5d7f", JW = "5e7a9c1b-3333-4d3f-8a5b-7c9e1a3b5d7f";   // Jane Example and her Legs
const OC = "5e7a9c1b-2222-4d3f-8a5b-7c9e1a3b5d7f", OW = "5e7a9c1b-4444-4d3f-8a5b-7c9e1a3b5d7f";   // Omar Sample and his Legs
const TP = "5e7a9c1b-5555-4d3f-8a5b-7c9e1a3b5d7f";                                                // the coach's template Upper A
const AT = "2026-11-10T16:00:00.000Z", COPY = "fiala.trainings.v1", QUEUE = "fiala.pending.v1", DRAFT = "fiala.trainings.draft";
const COACH = "coach@x.com", JANE = "jane@x.com";
const HIS_NOTE = "Private: going through a divorce, go easy";                   // the coach's own note on Jane's record (the server never sends it to her)
const OMAR_HEALTH = "Atrial fibrillation", OMAR_NOTE = "Tight chest walking up stairs";   // Omar's health details, and his own note on his Back squat
const TYPED = "Upper A, his new 6-week block";                                  // the coach's unsaved typing in his template's name
let n = 0; const bump = (s) => { s.updated_at = "2026-11-24T18:" + String(10 + Math.floor(n / 50) % 50).padStart(2, "0") + ":" + String(10 + (n++ % 50)).padStart(2, "0") + ".000Z"; };   // another device's write
const day = (k) => { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + k); return fns.localIso(d); };   // the app's local day (never UTC)
const ex = (id, label, name) => ({ id, label, name, sets: 3, reps: "8", rest: "", tempo: "", weights: [], repsDone: [], setsDone: 0, done: false, note: "" });
const legsOf = (id, clientId, title) => ({ id, clientId, title, date: day(1), createdAt: AT, completedAt: null, skippedAt: null, rows: [ex("sq", "1", "Back squat"), ex("lp", "2", "Leg press")] });
const said = (t) => (t ? [t.title, ...[...(t.rows || [])].sort((a, b) => cmpLabel(a.label, b.label)).map((r) => r.label + " " + r.name)] : null);
const quiet = () => { for (const tm of maps.timers.values()) clearTimeout(tm); maps.timers.clear(); clearTimeout(app.get().syncTimer); };
const done = () => { quiet(); app.set({ templateDraft: null, view: { name: "clients" } }); app.reset(); fns.leaveSettings(); localStorage.clear(); };
const server = ({ template = false } = {}) => {                           // the server behind one shared gym iPad
  const sb = makeSupabase(); sb.tables.trainers = new Map(); let told = null;   // trainers: the coach's row is all row-level security shows him; a client sees none
  sb.as = (email) => { sb.auth.getSession = async () => ({ data: { session: email ? { user: { email } } : null }, error: null }); sb.tables.trainers.clear(); if (email === COACH) sb.tables.trainers.set("t1", { id: "t1", email }); };   // whose session the library holds
  sb.auth.onAuthStateChange = (cb) => { told = cb; return { data: { subscription: { unsubscribe() {} } } }; };
  sb.tell = (event) => { if (told) told(event, null); };              // the library to the page: SIGNED_OUT (a session ended elsewhere)
  sb.auth.signOut = async () => { sb.as(null); sb.tell("SIGNED_OUT"); return { error: null }; };   // as supabase-js does: the session gone, then SIGNED_OUT
  sb.myData = async () => ({ clients: [{ id: JC, data: (({ notes, ...rest }) => rest)(JSON.parse(JSON.stringify(sb.tables.ft_clients.get(JC).data))) }], trainings: [...sb.tables.ft_trainings.values()].filter((t) => t.client_id === JC).map((t) => ({ id: t.id, data: JSON.parse(JSON.stringify(t.data)), updated_at: t.updated_at })) });   // client_my_data: her record without his notes, and her workouts
  sb.rpcs.client_my_data = () => sb.myData();
  sb.rpcs.client_row_note = async ({ p_training, p_row, p_note }) => { const s = sb.tables.ft_trainings.get(p_training), r = s && s.data.rows.find((x) => x.id === p_row); if (!r) throw Object.assign(new Error("no such exercise"), { code: "P0001" }); if (p_note) Object.assign(r, { clientNote: p_note, clientNoteBy: "client" }); else { delete r.clientNote; delete r.clientNoteBy; } bump(s); return null; };
  sb.seed("ft_clients", JC, { id: JC, name: "Jane Example", unit: "lb", email: JANE, phone: "3105550100", notes: { log: [{ id: "n1", at: AT, text: HIS_NOTE }] }, choices: { zone: { state: "deny", at: AT } } });   // (her time-zone question answered: none comes up over her page)
  sb.seed("ft_clients", OC, { id: OC, name: "Omar Sample", unit: "lb", email: "omar@x.com", phone: "3105550101", notes: { log: [{ id: "n9", at: AT, text: "Cardiologist letter on file" }] }, health: { conditions: OMAR_HEALTH } });
  sb.seed("ft_trainings", JW, legsOf(JW, JC, "Jane Legs"), { client_id: JC });
  const om = legsOf(OW, OC, "Omar Legs"); Object.assign(om.rows[0], { clientNote: OMAR_NOTE, clientNoteBy: "client", weights: ["135", "135"], repsDone: ["8", "6"], setsDone: 2 });
  sb.seed("ft_trainings", OW, om, { client_id: OC });
  if (template) {
    sb.seed("ft_clients", TEMPLATES_ID, { id: TEMPLATES_ID, name: "Templates", kind: "templates", templatesVersion: 3, builtinsAdopted: 1, folders: [{ id: "f1", name: "Strength", parent: null, kind: "folder", at: AT }] });
    sb.seed("ft_trainings", TP, { id: TP, clientId: TEMPLATES_ID, title: "Upper A", date: "2026-01-01", createdAt: AT, completedAt: null, skippedAt: null, template: { program: "My templates", phase: 0, stage: 0, n: 1, folder: "f1" }, rows: [ex("t1", "1", "Bench press")] });
  }
  return sb;
};
const openApp = async (sb, email, { session } = {}) => { if (session) sb.auth.getSession = session; else sb.as(email); globalThis.supabase = { createClient: () => sb }; try { await fns.boot(); await settle(); } finally { delete globalThis.supabase; } };   // main.js's own boot, the library holding this session: a sign-in on that page, or as the app opens
const closeApp = () => { const keep = Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i)).map((k) => [k, localStorage.getItem(k)]); quiet(); app.reset(); fns.leaveSettings(); for (const [k, v] of keep) if (v != null) localStorage.setItem(k, v); app.set({ sb: null, signedIn: false, clientMode: false, myClientId: null, backend: null, offline: false, offlineEntry: null, sessionEmail: "", pendingOwner: "", view: { name: "clients" }, templateDraft: null }); };   // closed: only what the device keeps is left
const noSignal = async () => ({ data: { session: null }, error: { message: "Failed to fetch" } });   // the library cannot reach the server for the session
const slowRead = (sb) => { let open = null; sb.rpcs.client_my_data = () => new Promise((r) => { open = () => r(sb.myData()); }); return { asked: () => !!open, open: () => { sb.rpcs.client_my_data = () => sb.myData(); if (open) open(); } }; };   // her first read on its way until opened (it lands then)
const boot = (sb, email) => { sb.as(email); globalThis.supabase = { createClient: () => sb }; return fns.boot(); };   // a sign-in whose end the test waits for itself
const goTo = (view) => { app.set({ view }); localStorage.setItem("fiala.trainings.view", JSON.stringify(view)); };   // a page opened, as go() sets and stores it (Node's stand-ins cannot draw a workout's page)
const hisChangeWaits = async (sb) => { sb.setFail({ times: 1e6, message: "Failed to fetch" }); maps.trainings.get(JW).title = "Jane Legs B"; fns.scheduleSave("trainings", JW); await settle(); sb.setFail(null); app.set({ offline: false }); };   // his rename of Jane's Legs, waiting for the signal
const queued = () => { const q = JSON.parse(localStorage.getItem(QUEUE) || "{}"); return { owner: q.owner || null, waiting: q.dirty || [], notes: (q.rownotes || []).map((e) => e[0]) }; };
const NAMES = { [JC]: "Jane", [OC]: "Omar", [TEMPLATES_ID]: "Templates", [JW]: "Jane's Legs", [OW]: "Omar's Legs", [TP]: "Upper A" };
const name = (id) => NAMES[id] || id;
const allStored = () => Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i) + "=" + (localStorage.getItem(localStorage.key(i)) || "")).join("\n");
const holds = (text, ids) => ({ clients: ids.clients.map(name).sort(), trainings: ids.trainings.map(name).sort(), hisNote: text.includes(HIS_NOTE), omar: text.includes(OMAR_HEALTH) || text.includes(OMAR_NOTE) });
const inPage = () => holds(JSON.stringify([...maps.clients.values(), ...maps.trainings.values()]), { clients: [...maps.clients.keys()], trainings: [...maps.trainings.keys()] });   // what her page holds
const inCopy = () => { const t = localStorage.getItem(COPY) || "", c = JSON.parse(t || "{}"); return holds(t, { clients: Object.keys(c.clients || {}), trainings: Object.keys(c.trainings || {}) }); };   // what her device copy holds
const HERS = { clients: ["Jane"], trainings: ["Jane's Legs"], hisNote: false, omar: false };
const onScreen = () => { const g = app.get(), v = g.view; return { client: g.clientMode, me: name(g.myClientId), view: v.name === "training" ? "the workout " + name(v.id) : v.name === "client" ? "the page of " + name(v.id) : v.name, drawn: g.renderedTraining ? name(g.renderedTraining) : null, workoutPage: !byId.get("vTraining").hidden }; };
const HER_PAGE = { client: true, me: "Jane", view: "the page of Jane", drawn: null, workoutPage: false };

// ---------- the coach on Omar's Legs on the gym iPad, his rename of Jane's Legs waiting; his session ends elsewhere; Jane signs in there ----------
const coachLeavesWorkWaiting = async (sb) => {
  await openApp(sb, COACH);                                            // the coach signed in on the gym iPad, his first sync in
  goTo({ name: "training", id: OW });                                  // he opens Omar's Legs
  await hisChangeWaits(sb);
  sb.as(null); sb.tell("SIGNED_OUT"); await settle();                 // his session ends elsewhere (his password changed on his Mac): his work waits, so the device keeps it
  return { signedIn: app.get().signedIn, queue: queued(), copy: inCopy() };
};
const KEPT = { signedIn: false, queue: { owner: COACH, waiting: ["trainings/" + JW], notes: [] }, copy: { clients: ["Jane", "Omar"], trainings: ["Jane's Legs", "Omar's Legs"], hisNote: true, omar: true } };

for (const how of ["is slow (still on its way)", "fails (one bar of signal)"]) test("the coach's session ended elsewhere while his change waited (the device keeps his records for his next sign-in), then Jane signs in on that page and her first read " + how + ": her page and her device copy hold her own record, without his notes about her, and her own workouts at once; opened again with no signal, her app opens on her own page (the twenty-fourth check round: her device copy kept every client of his, Omar's health details and his notes about her among them, until a read of hers landed)", async () => {
  const sb = server(), log = {};
  try {
    log.kept = await coachLeavesWorkWaiting(sb);
    if (how.startsWith("is slow")) {
      const read = slowRead(sb), booting = boot(sb, JANE);
      await until(read.asked, "Jane's first read was never asked for");
      log.atOnce = { page: inPage(), copy: inCopy(), client: app.get().clientMode };   // her read still out
      read.open(); await booting; await settle();
    } else {
      sb.rpcs.client_my_data = async () => { throw Object.assign(new Error("Failed to fetch"), { code: "" }); };
      await openApp(sb, JANE);
      log.atOnce = { page: inPage(), copy: inCopy(), client: app.get().clientMode };
      sb.rpcs.client_my_data = () => sb.myData();
    }
    delete globalThis.supabase;
    log.then = { page: inPage(), copy: inCopy() };
    closeApp(); await openApp(sb, JANE, { session: noSignal });       // the app closed, then opened again with no signal: the device copy and what it remembers
    log.relaunch = { screen: onScreen(), page: inPage(), copy: inCopy() };
  } finally { delete globalThis.supabase; done(); }
  assert.deepStrictEqual(log.kept, KEPT, "(the setup: his rename waits under his account, and the device keeps every record of his): " + JSON.stringify(log));
  assert.deepStrictEqual(log.atOnce, { page: HERS, copy: HERS, client: true }, "right after Jane's sign-in her page or her device copy holds another client's records, the coach's notes about her, or someone else's workout: " + JSON.stringify(log));
  assert.deepStrictEqual(log.then, { page: HERS, copy: HERS }, "after her first read her page or her device copy holds more than her own: " + JSON.stringify(log));
  assert.deepStrictEqual(log.relaunch, { screen: HER_PAGE, page: HERS, copy: HERS }, "opened again with no signal, Jane's app is not on her own page, or holds more than her own: " + JSON.stringify(log));
});

for (const signal of ["no signal", "a signal, her first read slow"]) test("Jane's app opened again (" + signal + ") on a device copy that still holds the coach's records (the app closed moments after her sign-in, before the browser's database took her copy: its write waits 120 ms): it opens on her own page, never on the workout of Omar's the coach left open, and her page and her device copy at once hold her own record without his notes, and her own workouts (the twenty-fourth check round: her app opened on Omar's Legs, his logged sets and his note shown as \"Your note\", and kept his records in her page)", async () => {
  const sb = server(), log = {}; let read = null;
  try {
    log.kept = await coachLeavesWorkWaiting(sb);
    const his = localStorage.getItem(COPY);
    read = slowRead(sb); boot(sb, JANE);                                // Jane signs in on that page; her first read is on its way when the app is closed
    await until(read.asked, "Jane's first read was never asked for");
    log.signedIn = app.get().clientMode;
    localStorage.setItem(COPY, his);                                    // (Node keeps the device copy in localStorage, written at once: here it is put back as the browser's database still holds it)
    closeApp(); delete globalThis.supabase;                            // (the closed page's read never lands)
    if (signal === "no signal") {
      await openApp(sb, JANE, { session: noSignal });
      log.opened = { screen: onScreen(), page: inPage(), copy: inCopy() };
    } else {
      const again = slowRead(sb), booting = boot(sb, JANE);
      await until(again.asked, "Jane's read after the relaunch was never asked for");
      log.opened = { screen: onScreen(), page: inPage(), copy: inCopy() };   // what is on screen until her read lands
      again.open(); await booting; await settle(); delete globalThis.supabase;
      log.landed = { screen: onScreen(), page: inPage(), copy: inCopy() };
    }
  } finally { delete globalThis.supabase; if (read) { app.set({ signedIn: false, sessionEmail: "" }); read.open(); await settle(); } done(); }   // (the closed page's read is let go with no one signed in: it lands nowhere, never in a later test's page when its 8 s deadline comes)
  assert.deepStrictEqual([log.kept, log.signedIn], [KEPT, true], "(the setup: the device kept his records, then Jane signed in): " + JSON.stringify(log));
  assert.deepStrictEqual(log.opened, { screen: HER_PAGE, page: HERS, copy: HERS }, "Jane's app opened on Omar's workout or off her own page, or her page or her device copy still holds another client's records or the coach's notes about her: " + JSON.stringify(log));
  if (log.landed) assert.deepStrictEqual(log.landed, { screen: HER_PAGE, page: HERS, copy: HERS }, "after her read landed Jane's app is off her own page, or holds more than her own: " + JSON.stringify(log));
});

// ---------- Jane's card note waits on the gym iPad, her session ends elsewhere, the coach signs in there ----------
const noSignalAtAll = (sb) => { const real = sb.rpc; sb.rpc = async (rpc, args) => { sb.log.push({ rpc, args, offline: true }); return { data: null, error: { message: "Failed to fetch", code: "" } }; }; sb.setFail({ times: 1e6, message: "Failed to fetch" }); return () => { sb.rpc = real; sb.setFail(null); app.set({ offline: false }); }; };   // every request fails as the browser's fetch does; the returned call brings the signal back
const janeSavesNote = (text) => { const t = maps.trainings.get(JW), r = t.rows.find((x) => x.id === "sq"); Object.assign(r, { clientNote: text, clientNoteBy: "client", clientNoteAt: new Date().toISOString() }); if (!maps.pendingNoteRows.has(JW)) maps.pendingNoteRows.set(JW, new Set()); maps.pendingNoteRows.get(JW).add("sq"); fns.scheduleSave("trainings", JW); };   // Save note on her Back squat, as the card's writeNote does on her phone
const MAC = ["Legs (from the Mac)", "1 Back squat", "2 Leg press", "3 Leg extension"];
for (const how of ["on that page", "after the iPad's app was closed and opened again"]) test("Jane's note on her Back squat waits for the signal on the gym iPad when her session ends elsewhere, and the coach signs in there " + how + ": his page never takes her waiting note on (in the page or in his queue), so his Mac's rename and new exercise reach the iPad, and no launch of the iPad writes her old copy back over them (the twenty-fourth check round: the account switch left her note's entry, every sync passed over her Legs, and every launch wrote the iPad's old copy over the Mac's)", async () => {
  const sb = server(), log = {};
  try {
    await openApp(sb, JANE);                                             // Jane on the gym iPad, her first read in
    const back = noSignalAtAll(sb); janeSavesNote("Knee hurt on set 3"); await settle();   // the Wi-Fi drops: her note waits
    log.waits = { client: app.get().clientMode, notes: [...maps.pendingNoteRows.keys()].map(name), queue: queued() };
    sb.as(null); sb.tell("SIGNED_OUT"); await settle(); back();          // her session ends elsewhere (her password changed on her phone); the Wi-Fi comes back
    if (how.startsWith("after")) closeApp();
    await openApp(sb, COACH);                                            // the coach signs in on the iPad; his first sync lands
    const t = maps.trainings.get(JW);
    log.coachIn = { client: app.get().clientMode, notes: [...maps.pendingNoteRows.keys()].map(name), queue: queued(), here: said(t), note: t.rows.find((r) => r.id === "sq").clientNote || null };
    { const s = sb.tables.ft_trainings.get(JW); s.data.title = "Legs (from the Mac)"; s.data.rows.push(ex("le", "3", "Leg extension")); bump(s); }   // his Mac renames Jane's Legs and adds Leg extension
    await fns.syncDownNow(); await settle();
    log.synced = { here: said(maps.trainings.get(JW)), server: said(sb.tables.ft_trainings.get(JW).data) };
    closeApp(); await openApp(sb, COACH);                                // the iPad's app opened again
    log.relaunched = { here: said(maps.trainings.get(JW)), server: said(sb.tables.ft_trainings.get(JW).data), notes: [...maps.pendingNoteRows.keys()].map(name), queue: queued() };
    { const s = sb.tables.ft_trainings.get(JW); s.data.title = "Legs v2 (from the Mac)"; bump(s); }   // his Mac renames it again
    closeApp(); await openApp(sb, COACH);
    log.again = said(sb.tables.ft_trainings.get(JW).data)[0];
  } finally { done(); }
  assert.deepStrictEqual(log.waits, { client: true, notes: ["Jane's Legs"], queue: { owner: JANE, waiting: ["trainings/" + JW], notes: [JW] } }, "(the setup: her note waits on the iPad, under her account): " + JSON.stringify(log));
  const NONE = { owner: COACH, waiting: [], notes: [] };
  assert.deepStrictEqual(log.coachIn, { client: false, notes: [], queue: NONE, here: ["Jane Legs", "1 Back squat", "2 Leg press"], note: null }, "the coach's page took Jane's waiting note on (in the page or in his queue), or still shows her unsent note: " + JSON.stringify(log));
  assert.deepStrictEqual(log.synced, { here: MAC, server: MAC }, "the coach's iPad never takes his Mac's rename and new exercise: " + JSON.stringify(log));
  assert.deepStrictEqual(log.relaunched, { here: MAC, server: MAC, notes: [], queue: NONE }, "a launch of the iPad wrote its old copy of Jane's Legs over the Mac's, or her note's entry is still kept: " + JSON.stringify(log));
  assert.strictEqual(log.again, "Legs v2 (from the Mac)", "the next launch undid the Mac's second rename: " + JSON.stringify(log));
});

// ---------- the coach's template on the gym iPad when his session ends elsewhere ----------
const onTemplate = () => { goTo({ name: "training", id: TP }); fns.draftFor(maps.trainings.get(TP)); };   // his template's page: its draft first (as renderTraining does)
const typeName = (title) => { maps.trainings.get(TP).title = title; fns.scheduleSave("trainings", TP); };   // as the name box's input handler does
const draftNow = () => { const d = app.get().templateDraft, s = JSON.parse(localStorage.getItem(DRAFT) || "null"); return { draft: d ? (d.dirty ? "unsaved" : "clean") : null, stored: s && s.doc ? s.doc.title : null }; };
const NO_DRAFT = { draft: null, stored: null };
const forJane = () => ({ ...draftNow(), typed: allStored().includes(TYPED), template: maps.trainings.has(TP) || maps.clients.has(TEMPLATES_ID), copy: (localStorage.getItem(COPY) || "").includes("Upper A") });   // what of his template Jane's page and storage hold
const NOTHING_OF_HIS = { draft: null, stored: null, typed: false, template: false, copy: false };

// The owner's pick "Clear the device" (25 Nov 2026; the twenty-fifth check round, R25-TW-4): an unsaved template alone does not keep the device. A session
// ended elsewhere with nothing else waiting wipes it as Sign out does, his typing in the template's name included; only the clean draft was checked before.
for (const [what, relaunch] of [["opened, nothing typed", false], ["typed and not saved", false], ["typed and not saved", true]]) test("the coach's session ends elsewhere with nothing else waiting while his template's page is up (" + what + "): the device is wiped as Sign out wipes it, his records and his typing with it (the owner's pick \"Clear the device\", 25 Nov 2026: an unsaved template alone does not keep the device; the twenty-fifth check round, R25-TW-4); Jane signs in next" + (relaunch ? " after the app was closed and opened again" : " on that page") + ": nothing of his draft, his template or his typing reaches her page or her storage (the twenty-fourth check round: a session's end no longer drops the draft itself, so the wipe must)", async () => {
  const sb = server({ template: true }), log = {};
  try {
    await openApp(sb, COACH);
    onTemplate(); if (what.startsWith("typed")) typeName(TYPED);
    log.before = draftNow();
    sb.as(null); sb.tell("SIGNED_OUT"); await settle();                 // his session ends elsewhere
    { const all = allStored(); log.wiped = { ...draftNow(), records: maps.clients.size + maps.trainings.size, typed: all.includes(TYPED), hisNote: all.includes(HIS_NOTE), omar: all.includes(OMAR_HEALTH) || all.includes(OMAR_NOTE) }; }   // the page and the device's storage after his session's end
    if (relaunch) closeApp();
    await openApp(sb, JANE);                                             // Jane signs in on that iPad
    fns.localBackend.save(); await settle();
    log.jane = { client: app.get().clientMode, ...forJane() };
  } finally { done(); }
  assert.deepStrictEqual(log.before, what.startsWith("typed") ? { draft: "unsaved", stored: TYPED } : { draft: "clean", stored: null }, "(the setup: his template's draft): " + JSON.stringify(log));
  assert.deepStrictEqual(log.wiped, { ...NO_DRAFT, records: 0, typed: false, hisNote: false, omar: false }, "his session ended elsewhere with nothing but his template's page up, and the device kept his records, his notes about Jane, Omar's health details or his draft and typing (the owner's pick: an unsaved template alone does not keep the device): " + JSON.stringify(log));
  assert.deepStrictEqual(log.jane, { client: true, ...NOTHING_OF_HIS }, "after the wipe Jane's page or her storage holds the coach's template draft, his template or his typing: " + JSON.stringify(log));
});

for (const relaunch of [false, true]) test("the coach's session ends elsewhere while his change of Jane's Legs waits and his template's name is typed and not saved (the device keeps both for his own sign-in again), then Jane signs in" + (relaunch ? " after the app was closed and opened again" : " on that page") + ": her page and her storage hold no draft of his, nor his template or his typing; signed out, then the coach signs in there: Upper A as saved, no draft (another account took the device, so his draft went with it; the twenty-fourth check round)", async () => {
  const sb = server({ template: true }), log = {};
  try {
    await openApp(sb, COACH);
    onTemplate(); typeName(TYPED);
    await hisChangeWaits(sb);
    sb.as(null); sb.tell("SIGNED_OUT"); await settle();                 // his session ends elsewhere: his work waits, so the device keeps it, his draft with it
    log.kept = draftNow();
    if (relaunch) closeApp();
    await openApp(sb, JANE);
    fns.localBackend.save(); await settle();
    log.jane = { client: app.get().clientMode, ...forJane() };
    await fns.signOut(); await settle();                                // Jane's Sign out (Settings)
    await openApp(sb, COACH);                                            // the coach signs in on that page
    log.coach = { ...draftNow(), here: (maps.trainings.get(TP) || {}).title || null, server: sb.tables.ft_trainings.get(TP).data.title };
  } finally { done(); }
  assert.deepStrictEqual(log.kept, { draft: "unsaved", stored: TYPED }, "his session's end dropped his unsaved typing, though the device keeps the rest of his work for his own sign-in again: " + JSON.stringify(log));
  assert.deepStrictEqual(log.jane, { client: true, ...NOTHING_OF_HIS }, "Jane's page or her storage holds the coach's template draft, his template or his typing: " + JSON.stringify(log));
  assert.deepStrictEqual(log.coach, { ...NO_DRAFT, here: "Upper A", server: "Upper A" }, "after Jane, the coach's old draft came back to him, or his template is not as saved: " + JSON.stringify(log));
});

// ---------- on the real pages (account-switch-probe.mjs, in its own process): the note boxes, and his template's page with its bar ----------
const probeAt = path.join(path.dirname(fileURLToPath(import.meta.url)), "account-switch-probe.mjs");
let probed = null;
const probe = () => { if (!probed) { try { probed = { r: JSON.parse(execFileSync(process.execPath, [probeAt], { encoding: "utf8", timeout: 120000 }).trim().split("\n").pop()) }; } catch (e) { probed = { e }; } } if (probed.e) throw probed.e; return probed.r; };
const sane = (r) => { assert.deepStrictEqual([r.found, r.rejected, r.thrown], [{ drafts: true }, [], []], "the probe could not find the Map the typing writes a card note into, or a step of it threw: " + JSON.stringify([r.found, r.rejected, r.thrown])); };
const HIS_WORDS = "Coach only: she skips sets when tired, push harder", HER_WORDS = "I felt dizzy since my new heart medication";   // a card note half typed by each (as the probe types them)
const noteSetup = (o, first, words) => assert.deepStrictEqual([o.launched, o.opened, o.typed, o.waiting, o.ended], [true, { as: first, view: "Legs", drawn: "Legs", login: false }, { boxes: ["Back squat: " + words], drafts: ["1: " + words] }, true, { as: "signed out", view: "Legs", drawn: "Legs", login: true }], "(the setup: Jane's Legs open, a note half typed in Back squat's box, another change waiting, the sign-in page up over the workout): " + JSON.stringify(o));

test("the coach half types a card note on Jane's Legs on the gym iPad (\"" + HIS_WORDS + "\"), his change of her phone number waits, and his session ends elsewhere; Jane signs in on that page and lands on her Legs: no note box holds his words, the page keeps none of them, and nothing of his reaches the server as her note (the twenty-fourth check round: his words were in her own box, and her Save note stored them as hers)", () => {
  const r = probe(); sane(r); const o = r.notes["coach first"];
  assert.ok(o && !o.error, "the case did not run: " + (o && o.error));
  noteSetup(o, "the coach", HIS_WORDS);
  assert.deepStrictEqual(o.landed, { as: "Jane", view: "Legs", drawn: "Legs", login: false, boxes: [], drafts: [] }, "Jane's page shows or keeps the coach's half-typed note: " + JSON.stringify(o.landed));
  assert.strictEqual(o.server, null, "the coach's half-typed words reached the server as Jane's note: " + o.server);
});

test("Jane half types a card note on her Legs on the gym iPad (\"" + HER_WORDS + "\"), her switch to kg waits for the signal, and her session ends elsewhere; the coach signs in on that page and lands on her Legs: no note box holds her words, the page keeps none of them, and nothing of hers reaches the server as his Coach note (the twenty-fourth check round: her words were in his box, and his Save note stored them as a Coach note)", () => {
  const r = probe(); sane(r); const o = r.notes["Jane first"];
  assert.ok(o && !o.error, "the case did not run: " + (o && o.error));
  noteSetup(o, "Jane", HER_WORDS);
  assert.deepStrictEqual(o.landed, { as: "the coach", view: "Legs", drawn: "Legs", login: false, boxes: [], drafts: [] }, "the coach's page shows or keeps Jane's half-typed note: " + JSON.stringify(o.landed));
  assert.strictEqual(o.server, null, "Jane's half-typed words reached the server as the coach's note: " + o.server);
});

test("the coach half types a card note on Jane's Legs, his change waits, his session ends elsewhere, and he signs in again on that page: his words are still in Back squat's box, and Save note saves them as his Coach note (the same account keeps its typing)", () => {
  const r = probe(); sane(r); const o = r.notes["coach again"];
  assert.ok(o && !o.error, "the case did not run: " + (o && o.error));
  noteSetup(o, "the coach", HIS_WORDS);
  assert.deepStrictEqual(o.landed, { as: "the coach", view: "Legs", drawn: "Legs", login: false, boxes: ["Back squat: " + HIS_WORDS], drafts: ["1: " + HIS_WORDS] }, "the coach's own half-typed note was lost when he signed in again: " + JSON.stringify(o.landed));
  assert.strictEqual(o.server, HIS_WORDS + " (coach)", "his Save note did not save his own words as his Coach note: " + o.server);
});

test("the coach half types a card note on Jane's Legs with nothing else waiting, and his session ends elsewhere, so the device is wiped; Jane signs in on that page and opens her Legs: no note box holds his words, the page keeps none of them, and nothing of his reaches the server as her note (a workout new to the page keeps no card state: forgetCards)", () => {
  const r = probe(); sane(r); const o = r.notes["coach first, nothing else waiting"];
  assert.ok(o && !o.error, "the case did not run: " + (o && o.error));
  assert.deepStrictEqual([o.launched, o.opened, o.typed, o.waiting, o.ended, o.signedIn, o.landed.as], [true, { as: "the coach", view: "Legs", drawn: "Legs", login: false }, { boxes: ["Back squat: " + HIS_WORDS], drafts: ["1: " + HIS_WORDS] }, false, { login: true, records: 0 }, true, "Jane"], "(the setup: his note half typed in Back squat's box, nothing else waiting, the device wiped, Jane signed in): " + JSON.stringify(o));
  assert.deepStrictEqual(o.reopened, { as: "Jane", view: "Legs", drawn: "Legs", login: false, boxes: [], drafts: [] }, "Jane's Legs shows or keeps the coach's half-typed note: " + JSON.stringify(o.reopened));
  assert.strictEqual(o.server, null, "the coach's half-typed words reached the server as Jane's note: " + o.server);
});

const TPL_TYPED = { draft: "unsaved", stored: TYPED, copyTyped: false };   // his typing: unsaved, kept on the device as a draft, never in the device copy as if saved
for (const where of ["on that page", "after the app was closed and opened again"]) {
  test("the coach types a new name into his template Upper A (the Unsaved changes bar comes up), his change of Jane's phone waits, and his session ends elsewhere: the sign-in page comes up without the bar" + (where.startsWith("after") ? ", and without it when the app is opened again" : "") + ", his typing kept for his own sign-in (the twenty-fourth check round: kept now, the draft's bar stayed up over the sign-in page)", () => {
    const r = probe(); sane(r); const o = r.template[where];
    assert.ok(o && !o.error, "the case did not run: " + (o && o.error));
    assert.deepStrictEqual([o.launched, o.typed, o.waiting], [true, { ...TPL_TYPED, bar: true, marked: true, title: TYPED, at: { as: "the coach", view: "Upper A", drawn: "Upper A", login: false } }, true], "(the setup: his typing in the template's name, the bar up, another change waiting): " + JSON.stringify(o));
    assert.deepStrictEqual(o.ended, { ...TPL_TYPED, bar: false, marked: false, at: { as: "signed out", view: "Upper A", drawn: "Upper A", login: true } }, "the Unsaved changes bar is up over the sign-in page (or his typing was not kept): " + JSON.stringify(o.ended));
    if (where.startsWith("after")) assert.deepStrictEqual([o.relaunched, o.reopened], [true, { ...TPL_TYPED, bar: false, marked: false, at: { as: "signed out", view: "Upper A", drawn: null, login: true } }], "opened again, the sign-in page shows the Unsaved changes bar (or his typing was not kept): " + JSON.stringify(o.reopened));
  });
  test("the coach's unsaved typing in his template's name, kept when his session ended elsewhere with his change waiting, is back when he signs in again " + where + ": the template's page shows his new name with the Unsaved changes bar, the server keeps Upper A until Save template, then takes the new name (the twenty-fourth check round: the session's end dropped his typing, though the device kept the rest of his work)", () => {
    const r = probe(); sane(r); const o = r.template[where];
    assert.ok(o && !o.error, "the case did not run: " + (o && o.error));
    assert.deepStrictEqual(o.back, { ...TPL_TYPED, bar: true, marked: true, title: TYPED, at: { as: "the coach", view: "Upper A", drawn: "Upper A", login: false }, server: "Upper A" }, "signed in again, his typing is not back on the template's page with the Unsaved changes bar, or the server took it before Save template: " + JSON.stringify(o));
    assert.deepStrictEqual(o.saved, { draft: "clean", stored: null, bar: false, marked: false, copyTyped: true, server: TYPED }, "Save template did not send his new name: " + JSON.stringify(o.saved));
  });
}

// ---------- the twenty-fifth check round (v316, 25 Nov 2026), on the real pages (account-switch-probe.mjs's out.r25): what one account leaves on the gym iPad ----------
// A session ended elsewhere with work waiting keeps that work for its own account. Until the next account's role check has decided, nothing may make the
// work the next account's: the Wi-Fi's return then (the online event writes the queue), "Couldn't reach the server" and a relaunch, a save of the last
// account's still trying again (R25-PRV-1). Sign out on "Couldn't reach the server" hands the device back and keeps that work (R25-PRV-2); the last
// account's Couldn't save banner (R25-PRV-3), its pages, its bar and its syncs (R25-PRV-4, a password-reset link) and its half-typed private note
// (R25-TW-10) never reach the next person. Each case also checks its own unhandled rejections and boot errors (the probe keeps them apart).
const ofR25 = (key, sub) => { const r = probe(); sane(r); const o = sub ? r.r25[key][sub] : r.r25[key]; assert.ok(o && !o.error, "the case did not run: " + (o && o.error)); assert.deepStrictEqual([o.rejected, o.thrown], [[], []], "a step of the case threw: " + JSON.stringify([o.rejected, o.thrown])); return o; };
const MAC_LEGS = ["Legs (renamed on the Mac)", "1 Back squat", "2 Leg press", "3 Hamstring curl"];   // Jane's Legs as the coach's Mac left them meanwhile
const NOTHING_WAITS = (owner) => ({ owner, waiting: [], weights: [] });   // the queue on the device: this account's, empty
const NO_SERVER = "Couldn\u2019t reach the server \u00b7 check your signal and tap Try again";
const PRIVATE = "Coach only: watch her blood pressure, ask about the new medication";   // the coach's half-typed private note about Jane (as the probe types it)

test("Jane's set (95 lb on her Leg press) waits on the gym iPad when her session ends elsewhere, so the iPad keeps it for her; the coach signs in there just as the Wi-Fi comes back (the online event while his role check is out): his page takes none of her waiting work on and sends nothing of hers as his, so his Mac's rename of her Legs and its new Hamstring curl stay on the server, as when nothing happens meanwhile (the twenty-fifth check round, R25-PRV-1: the event's write of the queue made the queue his, the account switch never ran, and her old Legs went out over the Mac's)", () => {
  for (const how of ["nothing else happens meanwhile", "the Wi-Fi comes back meanwhile"]) {
    const o = ofR25("race", how);
    assert.deepStrictEqual([o.launched, o.waits, o.kept, o.signedIn], [true, { client: true, queue: { owner: JANE, waiting: ["Jane's Legs"], weights: ["Jane's Legs"] } }, { login: true, owner: JANE, dirty: ["Jane's Legs"] }, true], "(the setup, " + how + ": her set waits under her account, the device keeps it for her, the coach signed in): " + JSON.stringify(o));
    if (how.startsWith("the Wi-Fi")) assert.deepStrictEqual(o.atEvent, { signedIn: true, as: COACH, shown: ["vLogin"], bar: false }, "(the setup: the online event came while his role check was out): " + JSON.stringify(o.atEvent));
    assert.deepStrictEqual(o.coach, { client: false, owner: COACH, dirty: [], weights: [], queue: NOTHING_WAITS(COACH), sent: [], server: MAC_LEGS }, how + ": the coach's page took Jane's waiting set on, or sent her copy of her Legs as his over the Mac's: " + JSON.stringify(o.coach));
  }
});

test("the coach's change of Omar's phone and his template's new name (typed, not saved) wait on the gym iPad when his session ends elsewhere; Jane signs in there just as the Wi-Fi comes back (the online event while her role check is out): her page and her storage hold nothing of his draft, his typing, his template, Omar or his queue (the twenty-fifth check round, R25-PRV-1, the other way: her page kept his template draft, and her storage his unsaved typing)", () => {
  const o = ofR25("otherWay");
  assert.deepStrictEqual([o.launched, o.kept, o.atEvent, o.signedIn], [true, { draft: "unsaved", stored: TYPED, bar: false, marked: false, copyTyped: false, owner: COACH, dirty: ["Omar"] }, { signedIn: true, as: JANE, shown: ["vLogin"], bar: false }, true], "(the setup: his change and his typing kept for him, the online event while her role check was out): " + JSON.stringify(o));
  assert.deepStrictEqual(o.jane, { client: true, owner: JANE, draft: null, stored: null, bar: false, marked: false, copyTyped: false, typed: false, queue: NOTHING_WAITS(JANE), template: false, omar: false }, "Jane's page or her storage holds the coach's template draft, his typing, his template, Omar or his queue: " + JSON.stringify(o.jane));
});

test("Jane's set and her Don't Allow (Share time zone with coach) wait on the gym iPad when her session ends elsewhere; the coach signs in there as the Wi-Fi blips, so his role check never answers (\"Couldn't reach the server\"), and he closes the app and opens it again: his page drops her waiting work and sends nothing of hers as his, neither her Legs nor her answer, and the Mac's rename and new exercise stay (the twenty-fifth check round, R25-PRV-1: the queue the device kept was written as his while his role check was out, and the next launch sent her old Legs over the Mac's and her record with her answer as his)", () => {
  const o = ofR25("problemThenRelaunch");
  assert.deepStrictEqual([o.launched, o.waits, o.signedIn, o.problem, o.relaunched], [true, { queue: { owner: JANE, waiting: ["Jane's Legs", "Jane"], weights: ["Jane's Legs"] }, answers: ["Jane"] }, true, { page: true, words: NO_SERVER }, true], "(the setup: her set and her answer wait under her account, the coach on Couldn't reach the server, then the app opened again): " + JSON.stringify(o));
  assert.deepStrictEqual(o.coach, { client: false, owner: COACH, dirty: [], weights: [], answers: [], queue: NOTHING_WAITS(COACH), sent: [], server: MAC_LEGS, zone: "allow" }, "opened again, the coach's page took Jane's waiting work on, or sent her Legs or her answer as his: " + JSON.stringify(o.coach));
});

test("Jane's save of her set meets a server error and tries again; her session ends elsewhere between two tries and the coach signs in on that iPad at once: no later try sends her copy through his session, and the Mac's rename and new exercise stay (the twenty-fifth check round, R25-PRV-1: the try after his sign-in went out through his account and wrote her old Legs over the Mac's)", () => {
  const o = ofR25("retrying");
  assert.deepStrictEqual([o.launched, o.tried, o.signedIn, o.switched], [true, true, true, { client: false, owner: COACH, dirty: [] }], "(the setup: her save tried and met the error, the coach signed in, the account switch dropped her queue): " + JSON.stringify(o));
  assert.deepStrictEqual(o.coach, { sent: [], server: MAC_LEGS }, "a try of Jane's save went out through the coach's session after he signed in: " + JSON.stringify(o.coach));
});

test("the coach's change of Omar's phone and his new photo of Omar wait on the gym iPad when his session ends elsewhere; Jane signs in there but the check of her role cannot reach the server, and she taps Sign out on \"Couldn't reach the server\" to hand the iPad back: the sign-in page comes up with no \"Couldn't sign out\", the coach's change and photo stay kept for him, and his sign-in sends both (the twenty-fifth check round, R25-PRV-2: \"Couldn't sign out \u00b7 Some changes are not saved yet\" for changes that were not hers, his photo dropped by her sign-out's photo pass, and the only way on dropped his change)", () => {
  const o = ofR25("problemSignOut");
  assert.deepStrictEqual([o.launched, o.waits, o.signedIn, o.problem], [true, { owner: COACH, dirty: ["Omar"], photo: true }, true, { signedIn: true, as: JANE, shown: ["vWaiting"], bar: false, words: NO_SERVER }], "(the setup: his change and photo kept for him, Jane on Couldn't reach the server): " + JSON.stringify(o));
  const { as, ...tapped } = o.tapped;
  assert.deepStrictEqual(tapped, { signedIn: false, shown: ["vLogin"], bar: false, asked: null, owner: COACH, dirty: ["Omar"], photo: true }, "Sign out on Couldn't reach the server refused (or asked), or dropped the coach's waiting change or photo: " + JSON.stringify(o.tapped));
  assert.deepStrictEqual([o.coachIn, o.server], [true, { phone: "3105550170", photo: true }], "the coach signed in again, and his change of Omar's phone or his photo of Omar never reached the server: " + JSON.stringify([o.coachIn, o.server]));
});

for (const why of ["an outage (four tries refused)", "a refusal for good (that email is on another client)"]) test("the coach's save of Omar's record fails on the gym iPad (" + why + "), so the Couldn't save banner comes up; his session ends elsewhere with work waiting, and Jane signs in there: her page shows no Couldn't save banner (the twenty-fifth check round, R25-PRV-3: his banner came up on her page, with his reason)", () => {
  const o = ofR25("banner", why);
  assert.deepStrictEqual([o.launched, o.failed, o.coach.banner, o.coach.waiting, o.signInPage, o.signedIn], [true, true, true, true, { login: true, banner: false }, true], "(the setup: his banner up with his work waiting, none over the sign-in page, Jane signed in): " + JSON.stringify(o));
  if (why.startsWith("a refusal")) assert.ok(o.coach.words.includes("That email is already on another client."), "(the setup: his banner gives the server's reason): " + o.coach.words);
  assert.deepStrictEqual(o.jane, { client: true, banner: false, failed: false }, "Jane's page shows the coach's Couldn't save banner (or keeps his failed save to show it): " + JSON.stringify(o.jane));
});

test("the coach types a new name into his template Upper A on the gym iPad (the Unsaved changes bar comes up) and the app is closed without Sign out; Jane opens her password-reset link there: nothing of his is drawn while the link is checked, New password comes up without his bar, the window's focus starts no sync as him under her link's session (his records and typing stay for the account switch), and her new password lands her on her own page with nothing of his (the twenty-fifth check round, R25-PRV-4: his template's page and bar were drawn as the app opened, the bar stayed over New password, and a sync ran as him under her session)", () => {
  const o = ofR25("resetLink");
  assert.deepStrictEqual([o.launched, o.typed], [true, { draft: "unsaved", stored: TYPED, bar: true, marked: true, copyTyped: false, at: { as: "the coach", view: "Upper A", drawn: "Upper A", login: false } }], "(the setup: his typing in Upper A, the bar up): " + JSON.stringify(o));
  assert.deepStrictEqual(o.opening, { signedIn: false, as: null, shown: [], bar: false }, "while her link was checked, the coach's page was drawn (or the page worked as him): " + JSON.stringify(o.opening));
  assert.deepStrictEqual(o.newPassword, { signedIn: false, as: null, shown: ["vRecovery"], bar: false, user: JANE }, "New password came up with the coach's Unsaved changes bar, or as his page: " + JSON.stringify(o.newPassword));
  assert.deepStrictEqual(o.afterFocus, { signedIn: false, as: null, shown: ["vRecovery"], bar: false, reads: 0, records: 6, draft: "unsaved", stored: TYPED, marked: false, copyTyped: false }, "behind New password a sync ran as the coach under her link's session, or his records or typing went: " + JSON.stringify(o.afterFocus));
  assert.deepStrictEqual([o.done, o.jane], [true, { as: "Jane", view: "client", drawn: null, login: false, draft: null, stored: null, bar: false, marked: false, copyTyped: false, typed: false, template: false, omar: false }], "after her new password, Jane's page or her storage holds something of the coach's: " + JSON.stringify(o.jane));
});

test("the coach's page is open with his template's new name typed (the Unsaved changes bar up) when the library tells it that a password-reset link was opened (Jane's, in another tab of a browser where one window at a time cannot hold): New password comes up without his bar, and the window's focus starts no sync as him under her link's session (the twenty-fifth check round, R25-PRV-4: New password is a sign-in page like the others, with no account's bar, banner or sync behind it)", () => {
  const o = ofR25("resetHere");
  assert.deepStrictEqual([o.launched, o.typed], [true, { draft: "unsaved", stored: TYPED, bar: true, marked: true, copyTyped: false, at: { as: "the coach", view: "Upper A", drawn: "Upper A", login: false } }], "(the setup: his typing in Upper A, the bar up): " + JSON.stringify(o));
  const page = ({ as, ...rest }) => rest;
  assert.deepStrictEqual(page(o.newPassword), { signedIn: false, shown: ["vRecovery"], bar: false }, "New password came up with the coach's Unsaved changes bar, or with his page still signed in behind it: " + JSON.stringify(o.newPassword));
  assert.deepStrictEqual(page(o.afterFocus), { signedIn: false, shown: ["vRecovery"], bar: false, reads: 0, records: 6, draft: "unsaved", stored: TYPED, marked: false, copyTyped: false }, "behind New password a sync ran as the coach under her link's session: " + JSON.stringify(o.afterFocus));
});

test("the coach half types a private note about Jane in her Notes tab (\"" + PRIVATE + "\"), his change of her phone waits, and his session ends elsewhere; Jane signs in on that page: her page's notes box holds none of his words (the box is the coach's only, hidden from her by the page's style, but its words were in her page); the coach signing in again finds them still there (the twenty-fifth check round, R25-TW-10: no test caught the account switch keeping his note)", () => {
  const jane = ofR25("privateNote", "Jane next"), coach = ofR25("privateNote", "the coach again");
  for (const o of [jane, coach]) assert.deepStrictEqual([o.launched, o.typed, o.waiting, o.ended, o.signedIn], [true, { box: PRIVATE, at: { as: "the coach", view: "client", drawn: null, login: false } }, true, { as: "signed out", view: "client", drawn: null, login: true }, true], "(the setup: his note half typed on her Notes tab, his change waiting, the sign-in page up): " + JSON.stringify(o));
  assert.deepStrictEqual(jane.landed, { as: "Jane", view: "client", drawn: null, login: false, box: "" }, "Jane's page holds the coach's half-typed private note about her: " + JSON.stringify(jane.landed));
  assert.deepStrictEqual(coach.landed, { as: "the coach", view: "client", drawn: null, login: false, box: PRIVATE }, "the coach's own half-typed note was lost when he signed in again: " + JSON.stringify(coach.landed));
});

// ---------- the twenty-sixth check round (v316, 25 Nov 2026), on the real pages (account-switch-probe.mjs's out.r26): what one person leaves on the gym iPad ----------
// R26-PRV-1: the Sign in and Create account boxes never hold the last person's sign-in for the next one (the password leaves the page once used, every Sign
// out empties both forms). R26-PRV-2 / R26-WAP-5: the half-typed notes and the cards' state go with the account at both Sign outs and the wipe, and words
// kept while another account's role check is out are filed under the account whose work the device keeps. R26-PRV-3: a password-reset link left
// unfinished reads and sends nothing of the remembered account's (the coach's, or another client's) while its own role is checked.
const ofR26 = (key, sub) => { const r = probe(); sane(r); const o = sub ? r.r26[key][sub] : r.r26[key]; assert.ok(o && !o.error, "the case did not run: " + (o && o.error)); assert.deepStrictEqual([o.rejected, o.thrown], [[], []], "a step of the case threw: " + JSON.stringify([o.rejected, o.thrown])); return o; };
const NOTHING_OPENS = { signedIn: false, as: null };                    // the next person's tap on Sign in, nothing typed
const EMPTY_FORM = { login: true, signedIn: false, email: "", password: false };

for (const who of ["the coach", "Jane"]) test(who + " signs in on the gym iPad with the Sign in form (email and password typed), then taps Sign out in Settings: the sign-in page holds neither the email nor the password, and the next person's tap on Sign in, typing nothing, opens nothing (the twenty-sixth check round, R26-PRV-1: the form kept both since the cloud sign-in came in, and one tap signed the next person in as " + who + ")", () => {
  const o = ofR26("signInForm", who);
  assert.deepStrictEqual([o.launched, o.signedIn], [true, true], "(the setup: signed in with the form): " + JSON.stringify(o));
  assert.deepStrictEqual(o.signInPage, EMPTY_FORM, "after Sign out the sign-in page still holds " + who + "'s email or password: " + JSON.stringify(o.signInPage));
  assert.deepStrictEqual(o.next, NOTHING_OPENS, "the next person's tap on Sign in opened " + who + "'s account: " + JSON.stringify(o.next));
});

test("the coach signs in on the gym iPad with the Sign in form, and his session ends elsewhere (his password changed on his phone), with nothing else waiting (the iPad is wiped) or with his change of Jane's phone waiting (kept for him): the sign-in page that comes up holds no password, and the next person's tap on Sign in, typing nothing, opens nothing (the twenty-sixth check round, R26-PRV-1: the password stayed in its box once used, and one tap signed the next person in as the coach)", () => {
  for (const how of ["nothing else waiting", "his change waiting"]) {
    const o = ofR26("signInEnded", how), kept = how === "his change waiting";
    assert.deepStrictEqual([o.launched, o.signedIn, o.ended.login, o.ended.signedIn, o.ended.kept, o.ended.owner], [true, true, true, false, kept, kept ? COACH : null], "(the setup, " + how + ": signed in with the form, then the sign-in page after his session ended, the iPad " + (kept ? "keeping his change" : "wiped") + "): " + JSON.stringify(o));
    assert.strictEqual(o.ended.password, false, how + ": the sign-in page still holds the coach's password: " + JSON.stringify(o.ended));
    assert.deepStrictEqual(o.next, NOTHING_OPENS, how + ": the next person's tap on Sign in opened the coach's account: " + JSON.stringify(o.next));
  }
});

test("Ana makes her account on the gym iPad with Create an account (a confirmation link is sent to her) and taps Back to sign in; the next person's Create an account form holds none of her name, her phone or her password (the twenty-sixth check round, R26-PRV-1: the form kept all of them, both password boxes as dots)", () => {
  const o = ofR26("signUp");
  assert.deepStrictEqual([o.launched, o.sent.done, o.signInPage.login, o.nextForm.shown], [true, true, true, true], "(the setup: the link sent, Back to sign in, then Create an account again): " + JSON.stringify(o));
  assert.ok(o.sent.words.includes("ana@x.com"), "(the setup: the confirmation link sent to her) " + o.sent.words);
  const { email, shown, ...rest } = o.nextForm;
  assert.deepStrictEqual(rest, { name: "", phone: "", password: 0, again: 0 }, "the next person's Create an account form holds Ana's name, phone or password: " + JSON.stringify(o.nextForm));
});

for (const how of ["Sign out", "ended elsewhere"]) for (const when of ["out of sight first", "at once"]) test("the coach half types a private note about Jane in her Notes tab with nothing else waiting, then " + (how === "Sign out" ? "taps Sign out in Settings" : "his session ends elsewhere (the iPad is wiped)") + "; Jane signs in on that page" + (when === "at once" ? " at once" : " after the app went out of sight on the sign-in page") + ", and the app goes out of sight with her signed in: " + (when === "at once" ? "her page holds none of his words" : "the iPad keeps none of his words after the " + (how === "Sign out" ? "Sign out" : "wipe") + ", her page holds none of them") + ", and nothing of his is kept under her name (the twenty-sixth check round, R26-PRV-2 and R26-WAP-5: the " + (how === "Sign out" ? "Sign out" : "wipe") + " kept his half-typed note in the page, the drafts add-on wrote it to the iPad with his email, then it was in her page and kept under her name)", () => {
  const o = ofR26("privateNote", how + ", " + when);
  assert.deepStrictEqual([o.launched, o.typed, o.signedOut, o.signedIn], [true, PRIVATE, { signedIn: false, login: true }, true], "(the setup: his note half typed, the sign-in page up, then Jane signed in): " + JSON.stringify(o));
  if (when === "out of sight first") assert.strictEqual(o.storedAfterSignOut, false, "after the " + how + " the iPad keeps the coach's half-typed private note (the drafts add-on, under his email): " + JSON.stringify(o));
  assert.deepStrictEqual(o.landed, { as: JANE, client: true, box: "", held: false }, "Jane's page holds the coach's half-typed private note about her: " + JSON.stringify(o.landed));
  assert.strictEqual(o.storedForJane, false, "the coach's half-typed private note was kept on the iPad under Jane's name: " + JSON.stringify(o));
});

test("the sign-in library could not load (no signal as the app opened after an update: the coach's pages from the iPad's copy, offline); he half types a private note about Jane in her Notes tab, taps Sign out in Settings, and the app goes out of sight on the sign-in page: the page and the iPad keep none of his words (the twenty-sixth check round, R26-PRV-2: with no library no SIGNED_OUT wiped the page first, and Sign out's own finish kept his note, which the drafts add-on then wrote to the iPad under his email)", () => {
  const o = ofR26("noLibrary", "the coach");
  assert.deepStrictEqual([o.launched, o.reopened, o.at, o.typed, o.signedOut], [true, true, { signedIn: true, as: COACH, shown: ["vClients"], bar: false, offline: true }, PRIVATE, { signedIn: false, login: true }], "(the setup: his pages offline with no library, his note half typed, then the sign-in page): " + JSON.stringify(o));
  assert.deepStrictEqual([o.held, o.stored], [false, false], "after his Sign out the page or the iPad keeps the coach's half-typed private note: " + JSON.stringify(o));
});

test("the sign-in library could not load (no signal as the app opened after an update: Jane's pages from the iPad's copy, offline); on her Push she picks set 2 of her Bench press, goes back to her page and taps Sign out in Settings: her page keeps none of her cards' state (the twenty-sixth check round, R26-PRV-2: with no library no SIGNED_OUT wiped the page first, and a client's Sign out kept her cards' state)", () => {
  const o = ofR26("noLibrary", "Jane");
  assert.deepStrictEqual([o.launched, o.reopened, o.at, o.picked, o.settings], [true, true, { signedIn: true, as: JANE, shown: ["vClient"], bar: false, offline: true }, { sets: ["1", "Set 2 of 3", "3"], held: 1 }, true], "(the setup: her pages offline with no library, set 2 picked on her Push, then Settings): " + JSON.stringify(o));
  assert.deepStrictEqual(o.signedOut, { signedIn: false, login: true, held: 0 }, "after Jane's Sign out her page still keeps her cards' state (the set she picked): " + JSON.stringify(o.signedOut));
});

test("on her Push Jane picks set 2 of her Bench press and opens her note on it, goes back to her page and taps Sign out in Settings: her page keeps none of her cards' state; the coach signing in on that iPad finds her Push as any new page shows it, set 1 the current one and her note folded (the twenty-sixth check round, R26-PRV-2: a client's Sign out kept her cards' state and anything half typed on them in the page; only the account switch emptied them)", () => {
  const o = ofR26("clientCards");
  assert.deepStrictEqual([o.launched, o.signedIn, o.before, o.picked, o.settings], [true, true, { note: { button: "See note", open: false }, sets: ["Set 1 of 3", "2", "3"] }, { note: { button: "Hide note", open: true }, sets: ["1", "Set 2 of 3", "3"], held: 1 }, true], "(the setup: her Push drawn, set 2 picked and her note opened, then Settings): " + JSON.stringify(o));
  assert.deepStrictEqual(o.signedOut, { ...EMPTY_FORM, held: 0 }, "after Jane's Sign out her page still keeps her cards' state (the set she picked), or the sign-in page holds her sign-in: " + JSON.stringify(o.signedOut));
  assert.deepStrictEqual([o.coachIn, o.coach], [true, { as: COACH, client: false, note: { button: "See note", open: false }, sets: ["Set 1 of 3", "2", "3"] }], "the coach's page shows Jane's Push with her picked set or her note left open: " + JSON.stringify(o.coach));
});

test("the coach's private note half typed in Jane's Notes tab and his change of Omar's phone wait when his session ends elsewhere; Jane signs in, cannot get past \"Couldn't reach the server\" and taps its Sign out; the app goes out of sight and is closed; the coach signs in again: the sign-in page Jane left holds nothing of hers, the words kept on the iPad are his (never under Jane's email, which leaves the iPad with her Sign out), his note is back in its box and his change reaches the server (the twenty-sixth check round, R26-PRV-2, R26-WAP-5 and R26-PRV-1: the drafts add-on filed his note under her email, his sign-in dropped it, and her email and password stayed in the form)", () => {
  const o = ofR26("problemKept");
  assert.deepStrictEqual([o.launched, o.signedIn, o.problem], [true, true, true], "(the setup: his work kept for him, Jane on Couldn't reach the server): " + JSON.stringify(o));
  assert.deepStrictEqual(o.signInPage, EMPTY_FORM, "after her Sign out on Couldn't reach the server the sign-in page still holds Jane's email or password: " + JSON.stringify(o.signInPage));
  assert.deepStrictEqual([o.kept, o.janeEmailStored], [{ owner: COACH, words: true }, []], "the coach's typing was kept under Jane's email, or her email stayed on the iPad after her Sign out: " + JSON.stringify(o));
  assert.deepStrictEqual([o.coachIn, o.box, o.server], [true, PRIVATE, "3105550170"], "the coach's note or his change did not come back to him: " + JSON.stringify(o));
});

for (const ev of ["focus", "online", "an app switch"]) test("the coach's change of Omar's phone waits on the gym iPad and the app is closed; Jane leaves her password-reset link there unfinished; the app is opened again (the iPad remembers the coach, the library holds her session) and " + (ev === "focus" ? "the window gets the focus" : ev === "online" ? "the Wi-Fi comes back (the online event)" : "the app goes out of sight and back") + " while her role check is out, which then cannot reach the server; she taps Sign out on \"Couldn't reach the server\" and the coach signs in: nothing of his is read or sent under her session, and his change reaches the server (the twenty-sixth check round, R26-PRV-3: the remembered account's sync and save ran under her session, row-level security answered with no rows, and his change was dropped as deleted elsewhere)", () => {
  const o = ofR26("resetLeft", ev);
  assert.deepStrictEqual([o.launched, o.waits, o.atLink.shown, o.reopened], [true, { owner: COACH, dirty: ["Omar"] }, ["vRecovery"], true], "(the setup: his change waits, her link left on New password, the app opened again): " + JSON.stringify(o));
  assert.deepStrictEqual(o.underJane, [], "the coach's records were read or written under Jane's session: " + JSON.stringify(o.underJane));
  assert.deepStrictEqual([o.problem.shown, o.problem.owner, o.problem.dirty], [["vWaiting"], COACH, ["Omar"]], "while Jane's role check was out the coach's waiting change was dropped: " + JSON.stringify(o.problem));
  assert.deepStrictEqual([o.tapped.shown, o.tapped.owner, o.tapped.dirty, o.coachIn, o.server], [["vLogin"], COACH, ["Omar"], true, "3105550170"], "after her Sign out the coach's change was lost: " + JSON.stringify([o.tapped, o.coachIn, o.server]));
});

test("Jane's set (95 lb on her Leg press) waits on the gym iPad and the app is closed; Omar leaves his password-reset link there unfinished; the app is opened again (the iPad remembers Jane, the library holds his session) and the window gets the focus while his role check is out, which then cannot reach the server; he taps Sign out on \"Couldn't reach the server\" and Jane signs in: nothing of hers is read or sent under his session, her page and her device copy never hold his record or his workout, and her set reaches the server (the twenty-sixth check round, R26-PRV-3, two clients: her page's sync ran under his session and took his record and workout in, and her waiting set was dropped)", () => {
  const o = ofR26("resetLeftClients");
  assert.deepStrictEqual([o.launched, o.waits, o.atLink.shown, o.reopened], [true, { owner: JANE, dirty: ["Jane's Legs"] }, ["vRecovery"], true], "(the setup: her set waits, his link left on New password, the app opened again): " + JSON.stringify(o));
  assert.deepStrictEqual(o.underOmar, [], "Jane's records were read or sent under Omar's session: " + JSON.stringify(o.underOmar));
  assert.deepStrictEqual([o.problem.shown, o.problem.owner, o.problem.dirty, o.problem.page, o.problem.copyOmar], [["vWaiting"], JANE, ["Jane's Legs"], ["Jane", "Jane's Legs"], false], "while Omar's role check was out Jane's page took his record or workout in, or her waiting set was dropped: " + JSON.stringify(o.problem));
  assert.deepStrictEqual([o.tapped.shown, o.tapped.owner, o.tapped.dirty, o.janeIn, o.server], [["vLogin"], JANE, ["Jane's Legs"], true, ["95"]], "after his Sign out Jane's waiting set was lost: " + JSON.stringify([o.tapped, o.janeIn, o.server]));
});
