// The restore picker as the coach meets it (v316, the seventeenth check round): the real change handler of #restoreFile, fed a backup file.
// A backup that differs only by what a restore keeps as the app has it now opens Nothing to restore, with the words; one the same says so
// in the status line; signed in, a Delete client still waiting refuses the restore, one landed is named; with no cloud library it says what to do; a client deleted on the coach's
// other device while the question is up stays deleted, however the sync after the tap goes (quiet, a sync already out, none, slow), and a sign-out during it restores nothing. Run by restore.test.js in its own process. The stand-ins are consent-probe.mjs's, cut to what a sheet made by script needs.
// The twenty-first check round: the read after the tap keeps the bar (role=status) in reach and says Saving… throughout, Back and a second backup's question wait
// for it, focus goes back where a keyboard left it, the question waits for typing, a new release never reloads the page mid-restore, the handler's
// smaller guards (guards), the seeding a sync's end starts, offline at the tap, a server error's own words in the bar, and the device alone.
// The twenty-second check round: a step off the Clients page while a picked backup is read (the page's picture, navDuringRead), a date box typed
// by keys (focusedBox), the alerts for a file the handler cannot take (badFile), a failed save's banner up at the tap (barBanner), a damaged
// copy here (oddHere), the backup picked twice and both restored under a new release (twiceBoth), and a throw inside the handler (throwInside).
// The twenty-third check round: keysIn's own branches (focusedKind: a date box only clicked into, a month box, a read-only date box, a checkbox;
// run a second time as a computer, "desk": main.js's deskOn), and the bar beside the alert when a read fails with no words of its own, before the
// question or after the tap, a save still out landing after the alert, then the next good sync and save, the Mac's clock set back too (barBefore, barAfter).
// The twenty-fourth check round: the same read before the question on the Data page, whose bar starts blank (dataBar), and a sign-out during that read or
// after a failed one, then the next sign-in on the page (signOutMid, signOutAfter): Couldn't sync never carried into it.
// The twenty-fifth check round: a backup with nothing new in it, then a second one whose read before the question fails (alreadyThenFail), and a
// backup picked before Sign out whose read is still out when the same coach (or another) signs in again on the page (signBackIn).
import { byId, el } from "./env.js";
import { makeSupabase } from "./fake-supabase.js";
const Y = new Date().getFullYear();                                    // birthdays counted from this year, so each case keeps the age it needs on any day (the sixteenth check round: fixed dates failed every run from 1 Jan 2027)
let NOW = 10000, SEQ = 0; const Q = [];
globalThis.setTimeout = (fn, ms) => { const id = ++SEQ; Q.push({ id, at: NOW + Math.max(0, ms || 0), fn }); return id; };
globalThis.clearTimeout = (id) => { const i = Q.findIndex((q) => q.id === id); if (i >= 0) Q.splice(i, 1); };
try { performance.now = () => NOW; } catch (_) { Object.defineProperty(globalThis, "performance", { value: { now: () => NOW }, configurable: true }); }
let SEED_MS = 0; const fetch0 = globalThis.fetch; globalThis.fetch = (u, o) => (SEED_MS && /templates\.json/.test(String(u)) ? new Promise((r) => setTimeout(() => r({ ok: false, status: 404, json: async () => [] }), SEED_MS)) : fetch0(u, o));   // templates.json (not deployed since v302) answering 404 SEED_MS later on this clock: the seeding a sync's end starts on an account below TEMPLATES_VERSION
const flush = async () => { for (let i = 0; i < 30; i++) await Promise.resolve(); };
async function advance(ms) { const end = NOW + ms; for (;;) { Q.sort((a, b) => a.at - b.at || a.id - b.id); const q = Q[0]; if (!q || q.at > end) break; Q.shift(); NOW = Math.max(NOW, q.at); q.fn(); await flush(); } NOW = end; await flush(); }
const L = {};
document.addEventListener = (t, fn, o) => { (L[t] ||= []).push({ fn, capture: o === true || !!(o && o.capture) }); };
document.removeEventListener = (t, fn) => { const a = L[t] || []; const i = a.findIndex((x) => x.fn === fn); if (i >= 0) a.splice(i, 1); };
const rejected = []; process.on("unhandledRejection", (e) => { rejected.push(String((e && e.message) || e)); });
// ---------- the stand-in elements: children with their parent, listeners, attributes, focus ----------
const MK = new WeakSet(), classesOf = (n) => new Set(String(n.className || "").split(/\s+/).filter(Boolean));
const kids = (n) => (n && n.nodes ? n.nodes.filter((c) => c && typeof c === "object") : []);
const findAll = (root, test, out = []) => { for (const c of kids(root)) { if (test(c)) out.push(c); findAll(c, test, out); } return out; };
const byClass = (root, c) => findAll(root, (n) => classesOf(n).has(c));
const byTag = (root, t) => findAll(root, (n) => String(n.tagName || "").toLowerCase() === t);
function mk(tag) {
  const e = el(tag);
  e.tagName = String(tag).toUpperCase(); e.nodes = []; e.parent = null; e.H = {}; e.attrs = {}; e.removed = false; e.inert = false; e.disabled = false; e.value = "";
  Object.defineProperty(e, "children", { get: () => kids(e), set: (v) => { e.nodes = [...v]; }, configurable: true });
  let text = ""; Object.defineProperty(e, "textContent", { get: () => text + kids(e).map((c) => c.textContent).join(""), set: (v) => { e.nodes = []; text = String(v); }, configurable: true });
  const cl = { add: (...c) => { const k = classesOf(e); for (const x of c) k.add(x); e.className = [...k].join(" "); }, remove: (...c) => { const k = classesOf(e); for (const x of c) k.delete(x); e.className = [...k].join(" "); }, toggle: (c, f) => { const on = f === undefined ? !classesOf(e).has(c) : !!f; (on ? cl.add : cl.remove)(c); return on; }, contains: (c) => classesOf(e).has(c) }; e.classList = cl;
  const st = {}; st.setProperty = (k, v) => { st[k] = v; }; st.removeProperty = (k) => { delete st[k]; }; e.style = st;
  e.appendChild = (c) => { if (c && typeof c === "object") { if (c.parent) c.parent.nodes = c.parent.nodes.filter((x) => x !== c); c.parent = e; } e.nodes.push(c); return c; };
  e.append = (...k) => { for (const c of k) e.appendChild(c); };
  e.remove = () => { e.removed = true; if (e.parent) { e.parent.nodes = e.parent.nodes.filter((x) => x !== e); e.parent = null; } };
  e.setAttribute = (k, v) => { e.attrs[k] = String(v); }; e.getAttribute = (k) => (k in e.attrs ? e.attrs[k] : null); e.removeAttribute = (k) => { delete e.attrs[k]; };
  e.addEventListener = (t, fn) => { (e.H[t] ||= []).push(fn); }; e.removeEventListener = (t, fn) => { const a = e.H[t] || []; const i = a.indexOf(fn); if (i >= 0) a.splice(i, 1); };
  e.focus = (o) => { document.activeElement = e; e.focusedWith = o || null; };
  e.closest = (sel) => null; e.querySelector = () => null; e.querySelectorAll = () => [];
  MK.add(e); return e;
}
document.createElement = mk;
const body = mk("body"); document.body = body;
const page = mk("main"); body.appendChild(page);
const lift = mk("div"); lift.inert = true; body.appendChild(lift);   // inert in the markup (as #ctxLift): a restore never gives it back
const fire = (e, type, extra = {}) => {                                     // the target and up through its parents, then the document's own
  const ev = { type, target: e, detail: 1, isTrusted: true, key: "", ...extra, stopped: false, defaultPrevented: false, stopPropagation() { this.stopped = true; }, stopImmediatePropagation() { this.stopped = true; }, preventDefault() { this.defaultPrevented = true; } };
  for (const l of [...(L[type] || [])].filter((x) => x.capture)) l.fn(ev);
  for (let n = e; n && MK.has(n) && !ev.stopped; n = n.parent) { ev.currentTarget = n; for (const fn of [...((n.H || {})[type] || [])]) fn(ev); }
  if (!ev.stopped) for (const l of [...(L[type] || [])].filter((x) => !x.capture)) l.fn(ev);
  return ev;
};
const reg = (id, tag = "button") => { const e = mk(tag); e.id = id; byId.set(id, e); return e; };   // the parts the coach's card and Settings wire at import: stand-ins with listeners
for (const id of ["cardPaper", "cardHealthDel", "cardZoneStop", "cardMinor", "meZoneSw", "meHealthSw", "askYes", "askNo", "restore", "settingsBtn", "catalogBtn", "dataBtn"]) reg(id);   // (the Clients page's Settings, Catalog and Data pills: navDuringRead)
const restoreFile = reg("restoreFile", "input");
const loginForm = reg("loginForm", "form");                            // (the twenty-fourth check round) the sign-in page's form: the next sign-in on the page, after a sign-out
for (const id of ["askTitle", "askText", "status", "cardHealthNote", "cardPaperLabel"]) reg(id, "p");
const askSheet = reg("askSheet", "div"), askBox = reg("askBox", "div"); reg("askInput", "input"); askSheet.appendChild(askBox); askSheet.firstElementChild = askBox; askSheet.hidden = true; body.appendChild(askSheet);
const header = mk("header"), hbar = mk("div"), backBtn = mk("button"), status = byId.get("status"); hbar.className = "bar"; header.appendChild(hbar); hbar.appendChild(backBtn); hbar.appendChild(status); body.appendChild(header);   // the bar: the Back circle and the status line (role=status)
status.closest = (sel) => (sel === "header" ? header : null); header.querySelectorAll = (sel) => (sel === ".bar > *" ? kids(hbar) : []);
const restoreBtn = byId.get("restore"); restoreBtn.isConnected = true; restoreBtn.getClientRects = () => [{}]; page.appendChild(restoreBtn);   // Settings › Data's Restore row, on screen
const desk = process.argv[2] === "desk";                              // (the twenty-third check round) run as a computer, a mouse or a trackpad: keysIn's cases only
if (desk) globalThis.matchMedia = (q) => ({ matches: q === "(hover: hover) and (pointer: fine)", addEventListener() {}, removeEventListener() {} });   // main.js reads deskOn once, as it loads
const app = (await import("../app/main.js")).internals();
const { fns, maps } = app;
const { scheduleSync } = await import("../app/sync.js");               // sync.js's own, the one its once-a-minute interval calls
const C = "3d6f1a2b-4c5d-4e6f-8a7b-9c0d1e2f3a4b", AGREED = { health: { state: "agreed", at: "2026-11-18T08:00:00.000Z", by: "client" } };
document.querySelector = () => null; document.getElementById("whenBg").hidden = true; document.activeElement = null;   // no menu, date picker or sheet up
async function pick(here, inFile) {
  app.reset(); app.set({ signedIn: false, clientMode: false, backend: fns.localBackend, view: { name: "clients" } });   // the device's own copy (no server in this probe)
  maps.clients.set(C, here); maps.seenAt.set("clients/" + C, "S1");
  byId.get("status").textContent = "";
  const f = { app: "fiala-trainings", format: 1, clients: { [C]: inFile }, trainings: {} };
  const ev = { type: "change", target: { files: [{ text: async () => JSON.stringify(f) }], value: "x" } };
  for (const fn of restoreFile.H.change || []) fn(ev);
  await flush(); await advance(2000); await flush();
  const alert = byClass(body, "pa-ask")[0], seen = { alert: alert ? { title: byClass(alert, "pa-title")[0].textContent, text: byClass(alert, "pa-text").map((p) => p.textContent) } : null, status: byId.get("status").textContent };
  if (alert) { fire(body, "keydown", { key: "Escape" }); await flush(); }   // closed, as Esc does
  return seen;
}
const S1 = "9d2f8a76-7b8c-4d9e-8fa6-1a2b3c4d5e67";
async function pickCloud(mode) {                                     // the coach signed in (the stand-in server), a Delete client of Sam waiting or landed; or no cloud library at all (the eighteenth check round)
  app.reset(); byId.get("status").textContent = ""; byId.get("askText").textContent = ""; byId.get("askTitle").textContent = "";
  const sam = { id: S1, name: "Sam Lee", unit: "lb", birthday: "1988-06-02", choices: { health: { state: "agreed", at: "2026-11-18T08:00:00.000Z", by: "client" } }, health: { allergies: "Peanuts" } };
  const sb = makeSupabase(); sb.seed("ft_clients", S1, sam);
  app.set({ sb: mode === "no library" ? null : sb, signedIn: true, clientMode: false, backend: fns.cloudBackend, sessionEmail: "coach@test", view: { name: "clients" } });
  maps.clients.set(S1, JSON.parse(JSON.stringify(sam))); maps.seenAt.set("clients/" + S1, sb.tables.ft_clients.get(S1).updated_at);
  if (mode !== "no library") { sb.setFail({ op: "delete", times: mode === "delete waits" ? 100000 : 1, message: "Failed to fetch" }); fns.deleteRec("clients", S1); await flush(); await advance(2000); await flush(); }   // Delete client on one bar of signal: it waits (or its first try fails)
  const f = { app: "fiala-trainings", format: 1, clients: { [S1]: sam }, trainings: {} };
  const ev = { type: "change", target: { files: [{ text: async () => JSON.stringify(f) }], value: "x" } };
  for (const fn of restoreFile.H.change || []) fn(ev);
  for (let i = 0; i < 20; i++) { await flush(); await advance(500); }
  const alert = byClass(body, "pa-ask")[0];
  const seen = { alert: alert ? { title: byClass(alert, "pa-title")[0].textContent, text: byClass(alert, "pa-text").map((p) => p.textContent) } : null, question: byId.get("askTitle").textContent ? { title: byId.get("askTitle").textContent, text: byId.get("askText").textContent } : null, samOnServer: sb.tables.ft_clients.has(S1) };
  if (alert) { fire(body, "keydown", { key: "Escape" }); await flush(); }
  sb.setFail(null); return seen;
}
const JR = "11111111-2222-4333-8444-555555555555", OM = "22222222-3333-4444-8555-666666666666", LEGS = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee", PUSH = "bbbbbbbb-cccc-4ddd-8eee-ffffffffffff";
async function race(mode) {                                           // the nineteenth check round: Jane deleted on the coach's iPad while the question is up, this page syncing nothing meanwhile: Restore writes nothing of hers; the twentieth: the same with the minute's sync already out at the tap, its reads made before her Delete (inFlight), the sync after the tap failing (fails), and on a slow signal, the page out of reach until the restore lands (slow)
  app.reset(); byId.get("status").textContent = ""; byId.get("askText").textContent = ""; byId.get("askTitle").textContent = "";
  const sb = makeSupabase(), at = "2026-11-10T16:00:00.000Z", row = (id, x) => ({ id, label: "1", name: "Back squat", sets: 3, reps: "8", weights: ["135", "135", "135"], repsDone: ["8", "8", "8"], setsDone: 3, done: true, unit: "lb", ...x });
  let ANS = 0; const from0 = sb.from; sb.from = (table) => { const b = from0(table); if (table !== "ft_clients" && table !== "ft_trainings") return b; const then0 = b.then; b.then = (res, rej) => { const ans = ANS; return then0.call(b, (v) => (ans ? new Promise((r) => setTimeout(() => r(v), ans)) : v)).then(res, rej); }; return b; };   // the server reads as a request arrives; on a weak signal its answer comes ANS ms later
  sb.seed("ft_clients", JR, { id: JR, name: "Jane Roe", unit: "lb" }); sb.seed("ft_clients", OM, { id: OM, name: "Omar Sample", unit: "lb" });
  sb.seed("ft_trainings", LEGS, { id: LEGS, clientId: JR, title: "Legs", date: "2026-11-20", createdAt: at, completedAt: "2026-11-20T17:00:00.000Z", skippedAt: null, rows: [row("r1", { clientNote: "knee sore after my fall", clientNoteBy: "client", clientNoteAt: "2026-11-20T17:00:00.000Z" })] }, { client_id: JR });
  sb.seed("ft_trainings", PUSH, { id: PUSH, clientId: OM, title: "Push", date: "2026-11-21", createdAt: at, completedAt: null, skippedAt: null, rows: [row("p1", { name: "Bench press", weights: ["", "", ""], repsDone: ["", "", ""], setsDone: 0, done: false })] }, { client_id: OM });
  app.set({ sb, signedIn: true, clientMode: false, backend: fns.cloudBackend, sessionEmail: "coach@test", view: { name: "clients" } });
  fns.syncDownNow(); for (let i = 0; i < 6; i++) { await flush(); await advance(500); }
  const f = JSON.parse(JSON.stringify(fns.backupData()));
  if (mode === "allGone") delete f.trainings[PUSH];                   // the twenty-second check round: a backup of Jane's Legs alone, so her deletion under the question leaves the restore nothing to write (its read went well: the bar says Saved, never Couldn't sync)
  fns.deleteRec("trainings", LEGS); fns.deleteRec("trainings", PUSH); for (let i = 0; i < 6; i++) { await flush(); await advance(500); }   // deleted by mistake, sent: what the restore is for
  if (mode === "inFlightBefore") { ANS = 4000; scheduleSync(); await advance(300); sb.tables.ft_clients.delete(JR); await advance(500); ANS = 0; }   // Jane deleted on the iPad just before the file is picked, the minute's sync already out (its reads made before her Delete)
  const ev = { type: "change", target: { files: [{ text: async () => JSON.stringify(f) }], value: "x" } };
  for (const fn of restoreFile.H.change || []) fn(ev);
  for (let i = 0; i < 10; i++) { await flush(); await advance(500); }
  const question = byId.get("askText").textContent;
  if (mode === "barBanner") app.set({ failed: true, failReason: "that email is already on another client" });   // the twenty-second check round: a save refused for good, its banner up as Restore is tapped (setStatus's failed-save line, which leaves the bar to the banner, comes after its Saving… line: no test held the order)
  if (mode === "inFlight" || mode === "seedAfterSync" || mode === "barSyncOut" || mode === "barBanner") { ANS = mode === "barSyncOut" || mode === "barBanner" ? 2500 : 4000; if (mode === "seedAfterSync") SEED_MS = 3000; scheduleSync(); await advance(300); }   // seedAfterSync: and its end starts a 3-s seeding; barSyncOut: every answer 2.5 s, the tap's own read too   // the minute's sync starts under the question on a weak signal: its reads made before her Delete lands, their answers still on the way at the tap
  sb.tables.ft_clients.delete(JR);                                   // the iPad: Delete client (her workouts with her)
  if (mode === "inFlight" || mode === "seedAfterSync" || mode === "barSyncOut" || mode === "barBanner") await advance(500);
  if (mode === "fails") sb.setFail({ op: "select", times: 100000, message: "Failed to fetch" });   // the signal drops as Restore is tapped
  if (mode === "slow") ANS = 3000;                                    // one bar of signal: each answer 3 s
  if (mode === "offlineAtTap") { navigator.onLine = false; sb.setFail({ op: "select", times: 100000, message: "Failed to fetch" }); }   // the signal gone as Restore is tapped, and the phone knows it
  if (mode === "server500") sb.setFail({ op: "select", times: 100000, message: "Internal Server Error", code: "XX000" });   // the server answers the read with an error (not offline)
  if (mode === "slow") document.activeElement = restoreBtn;          // a keyboard's focus, back on Restore as the question closes
  if (mode === "seeding" || mode === "seedingStuck") { app.set({ seeding: true }); if (mode === "seeding") setTimeout(() => app.set({ seeding: false }), 600); }   // the built-in templates' seeding a sync's end started (an account below TEMPLATES_VERSION): every read refused while it runs; stuck: it never ends
  fire(byId.get("askYes"), "click"); if (mode === "inFlight" || mode === "seedAfterSync") ANS = 0;
  let seedingSeen = 0; if (mode === "seedAfterSync") { for (let i = 0; i < 100; i++) { await advance(100); if (app.get().seeding) seedingSeen++; } }   // the sync out ends, its end starts the seeding: counted while it runs
  let bars = null; if (mode === "barSyncOut" || mode === "barBanner") { bars = []; await flush(); for (let i = 0; i < 40; i++) { await advance(250); bars.push([status.textContent, page.inert]); } ANS = 0; }   // the bar every 250 ms while the sync out ends and the tap's own read runs
  let during = null; if (mode === "slow") { await flush(); document.activeElement = body; await advance(1000); during = { pageInert: page.inert, bar: status.textContent, headInert: header.inert, backInert: backBtn.inert, statusInert: status.inert, held: fns.heldNow(), flags: fns.restoreFlags() }; ANS = 0; }   // the sync after the tap still out (inert takes a browser's focus to the page itself)
  for (let i = 0; i < (mode === "seedingStuck" ? 30 : 20); i++) { await flush(); await advance(500); }
  sb.setFail(null); const bar = byId.get("status").textContent; app.set({ seeding: false }); navigator.onLine = true; SEED_MS = 0;
  const alert = byClass(body, "pa-ask")[0], said = alert ? [byClass(alert, "pa-title")[0].textContent, ...byClass(alert, "pa-text").map((p) => p.textContent)] : null;
  if (alert) { fire(body, "keydown", { key: "Escape" }); await flush(); }
  const after = { headInert: header.inert, backInert: backBtn.inert, statusInert: status.inert, liftInert: lift.inert, flags: fns.restoreFlags(), focusBack: document.activeElement === restoreBtn && !!restoreBtn.focusedWith && restoreBtn.focusedWith.preventScroll === true };
  if (document.activeElement === restoreBtn) document.activeElement = null;
  return { question, legsOnServer: sb.tables.ft_trainings.has(LEGS), pushOnServer: sb.tables.ft_trainings.has(PUSH), janeOnServer: sb.tables.ft_clients.has(JR), janeHere: maps.clients.has(JR), legsHere: maps.trainings.has(LEGS), said, during, pageInert: page.inert, bar, after, seedingSeen, bars };
}
async function signedOutUnderTheSync() {                              // the twentieth check round: the coach's session ends (signed out elsewhere) while the sync after the tap is out: nothing of the restore lands on the wiped device
  app.reset(); byId.get("status").textContent = ""; byId.get("askText").textContent = ""; byId.get("askTitle").textContent = "";
  const sb = makeSupabase(), at = "2026-11-10T16:00:00.000Z", row = (id, x) => ({ id, label: "1", name: "Back squat", sets: 3, reps: "8", weights: ["135", "135", "135"], repsDone: ["8", "8", "8"], setsDone: 3, done: true, unit: "lb", ...x });
  sb.seed("ft_clients", JR, { id: JR, name: "Jane Roe", unit: "lb" });
  sb.seed("ft_trainings", LEGS, { id: LEGS, clientId: JR, title: "Legs", date: "2026-11-20", createdAt: at, completedAt: "2026-11-20T17:00:00.000Z", skippedAt: null, rows: [row("r1", {})] }, { client_id: JR });
  app.set({ sb, signedIn: true, clientMode: false, backend: fns.cloudBackend, sessionEmail: "coach@test", view: { name: "clients" } });
  fns.syncDownNow(); for (let i = 0; i < 6; i++) { await flush(); await advance(500); }
  const f = JSON.parse(JSON.stringify(fns.backupData()));
  fns.deleteRec("trainings", LEGS); fns.deleteRec("clients", JR); for (let i = 0; i < 6; i++) { await flush(); await advance(500); }   // Delete client, sent: the restore brings her back
  const ev = { type: "change", target: { files: [{ text: async () => JSON.stringify(f) }], value: "x" } };
  for (const fn of restoreFile.H.change || []) fn(ev);
  for (let i = 0; i < 10; i++) { await flush(); await advance(500); }
  const question = byId.get("askText").textContent.includes("Back in the app: Jane Roe, without health details, Health & safety or photo (the app asks again).");
  sb.delayMs = 4000;                                                  // one bar of signal: the sync after the tap is slow
  fire(byId.get("askYes"), "click");
  await flush(); await advance(1000);                                 // the sync after the tap is out
  maps.clients.clear(); maps.trainings.clear(); fns.localBackend.wipe(); app.set({ backend: null }); fns.showLogin("Signed out. Sign in again to keep syncing.");   // the session ends, as onAuthStateChange's SIGNED_OUT does: the device wiped, the sign-in page
  const writes = () => sb.log.filter((l) => l.op === "update" || l.op === "upsert" || l.op === "insert").length, w0 = writes();
  for (let i = 0; i < 30; i++) { await flush(); await advance(500); }
  const copy = localStorage.getItem("fiala.trainings.v1") || ""; sb.delayMs = 0;
  return { question, clientsHere: maps.clients.size, trainingsHere: maps.trainings.size, dirty: maps.dirty.size, serverWrites: writes() - w0, copyHolds: copy.includes(LEGS) || copy.includes(JR), pageInert: page.inert };
}

const setupJane = async (sb) => {                                        // Jane's Legs synced, backed up, then deleted by mistake and sent: what a restore is for
  const at = "2026-11-10T16:00:00.000Z", row = (id, x) => ({ id, label: "1", name: "Back squat", sets: 3, reps: "8", weights: ["135", "135", "135"], repsDone: ["8", "8", "8"], setsDone: 3, done: true, unit: "lb", ...x });
  sb.seed("ft_clients", JR, { id: JR, name: "Jane Roe", unit: "lb" });
  sb.seed("ft_trainings", LEGS, { id: LEGS, clientId: JR, title: "Legs", date: "2026-11-20", createdAt: at, completedAt: "2026-11-20T17:00:00.000Z", skippedAt: null, rows: [row("r1", {})] }, { client_id: JR });
  app.set({ sb, signedIn: true, clientMode: false, backend: fns.cloudBackend, sessionEmail: "coach@test", view: { name: "clients" } });
  fns.syncDownNow(); for (let i = 0; i < 6; i++) { await flush(); await advance(500); }
  const f = JSON.parse(JSON.stringify(fns.backupData()));
  fns.deleteRec("trainings", LEGS); for (let i = 0; i < 6; i++) { await flush(); await advance(500); }
  return f;
};
const fresh = () => { app.reset(); for (const id of ["status", "askText", "askTitle"]) byId.get(id).textContent = ""; status.className = ""; };
const alertNow = () => { const a = byClass(body, "pa-ask")[0]; return a ? [byClass(a, "pa-title")[0].textContent, ...byClass(a, "pa-text").map((p) => p.textContent)] : null; };
const closeAlert = async () => { if (byClass(body, "pa-ask")[0]) { fire(body, "keydown", { key: "Escape" }); await flush(); } };
const pickFile = (f, v = "x") => { const ev = { type: "change", target: { files: [{ text: async () => JSON.stringify(f) }], value: v } }; for (const fn of restoreFile.H.change || []) fn(ev); return ev; };
async function guards(mode) {                                         // the handler's smaller guards, each in its own case (no test held them: round 21's undos)
  fresh(); const sb = makeSupabase(), f = await setupJane(sb);
  const from0 = sb.from; let THROW = 0;                               // THROW: the reads reject (a sync that throws), after that many ms
  sb.from = (table) => { const b = from0(table); if (!THROW) return b; const ms = THROW; b.then = (res, rej) => new Promise((r) => setTimeout(r, ms)).then(() => { throw new Error("boom"); }).then(res, rej); return b; };
  const o = { mode };
  if (mode === "throwBefore") THROW = 1;                              // the read before the question throws
  if (mode === "throwOut") { THROW = 3000; scheduleSync(); await advance(400); }   // a sync already out at the pick, that throws as it ends
  if (mode === "heldBefore") sb.delayMs = 3000;                        // one bar: the read before the question is slow ...
  const ev = pickFile(f);
  if (mode === "heldBefore") { await flush(); await advance(500); app.set({ asking: true }); }   // ... and a sheet comes up meanwhile
  for (let i = 0; i < 36; i++) { await flush(); await advance(500); }
  o.value = ev.target.value; o.question = byId.get("askTitle").textContent; o.alert = alertNow(); o.bar = status.textContent;   // (the twenty-third check round: the bar beside the alert)
  if (mode === "heldBefore") { app.set({ asking: false }); for (let i = 0; i < 4; i++) { await flush(); await advance(500); } o.questionLater = byId.get("askTitle").textContent; sb.delayMs = 0; }
  if (mode === "barClass" || mode === "throwAfter" || mode === "failHeld" || mode === "failLeft") {
    status.className = "err";                                         // the bar said "Couldn't save" (red) as Restore is tapped
    if (mode === "barClass") sb.delayMs = 3000;
    if (mode === "throwAfter") THROW = 1;
    if (mode === "failHeld" || mode === "failLeft") { sb.setFail({ op: "select", times: 100000, message: "Failed to fetch" }); sb.delayMs = 2000; }   // the signal drops as Restore is tapped (each try 2 s)
    fire(byId.get("askYes"), "click"); await flush();
    if (mode === "failHeld" || mode === "failLeft") app.set({ asking: true });   // a sheet a late answer opened is up as the read fails
    await advance(1000); o.barClassDuring = status.className; o.barDuring = status.textContent;
    for (let i = 0; i < 20; i++) { await flush(); await advance(500); }
    o.alertHeld = alertNow();
    if (mode === "failLeft") app.set({ signedIn: false });            // the session ends while the alert waits
    if (mode === "failHeld" || mode === "failLeft") { app.set({ asking: false }); for (let i = 0; i < 4; i++) { await flush(); await advance(500); } }
    o.alertAfter = alertNow(); sb.delayMs = 0; sb.setFail(null);
  }
  await closeAlert(); THROW = 0; app.set({ asking: false }); return o;
}
async function typing() {                                             // the read before the question on one bar; he goes back to Jane's Legs and types a weight meanwhile
  fresh(); const sb = makeSupabase(), f = await setupJane(sb), box = mk("input"); box.type = "text"; page.appendChild(box);
  sb.delayMs = 2000; pickFile(f); await flush(); await advance(500); document.activeElement = box;
  for (let i = 0; i < 12; i++) { await flush(); await advance(500); }
  const o = { whileTyping: [app.get().asking, byId.get("askTitle").textContent] };
  document.activeElement = null; for (let i = 0; i < 3; i++) { await flush(); await advance(500); }   // he leaves the box
  o.afterTyping = [app.get().asking, byId.get("askTitle").textContent]; sb.delayMs = 0;
  fire(byId.get("askNo"), "click"); for (let i = 0; i < 4; i++) { await flush(); await advance(500); } box.remove();
  return o;
}
async function typingAlert(when) {                                    // an alert of the handler's own comes due while he types: it waits for him to leave the box, as the question does
  fresh(); const sb = makeSupabase(), f = await setupJane(sb), box = mk("input"); box.type = "text"; page.appendChild(box); const o = {};
  if (when === "before") { sb.setFail({ op: "select", times: 100000, message: "Failed to fetch" }); sb.delayMs = 1000; pickFile(f); await flush(); await advance(300); document.activeElement = box; }   // the read before the question fails while he types a weight
  else { pickFile(f); for (let i = 0; i < 10; i++) { await flush(); await advance(500); } await advance(1000); sb.setFail({ op: "select", times: 100000, message: "Failed to fetch" }); sb.delayMs = 1000; fire(byId.get("askYes"), "click"); await flush(); app.set({ asking: true }); for (let i = 0; i < 10; i++) { await flush(); await advance(500); } document.activeElement = box; app.set({ asking: false }); }   // the read after the tap fails with a sheet up; the sheet goes and he is typing
  for (let i = 0; i < 12; i++) { await flush(); await advance(500); }
  o.whileTyping = alertNow(); document.activeElement = null; for (let i = 0; i < 3; i++) { await flush(); await advance(500); }
  o.afterTyping = alertNow(); sb.setFail(null); sb.delayMs = 0; await closeAlert(); box.remove();
  return o;
}
async function secondPick() {                                         // one bar of signal: nothing shows, so he picks the backup a second time ("… (1).json"); the first question answered Restore
  fresh(); const sb = makeSupabase(), f = await setupJane(sb);
  sb.delayMs = 3000; pickFile(f); await flush(); await advance(1500); pickFile(JSON.parse(JSON.stringify(f)), "y");
  let first = false; for (let i = 0; i < 40 && !first; i++) { await flush(); await advance(250); first = app.get().asking; }
  await advance(1000); fire(byId.get("askYes"), "click"); await flush();   // read, then tapped (a press the moment it opens is not counted)
  const o = { first, during: [] };
  for (let i = 0; i < 60 && fns.restoreFlags().restoreRead; i++) { await advance(250); o.during.push(app.get().asking && fns.restoreFlags().restoreRead); }   // the first restore's read: the second question waits (never up while it is out)
  sb.delayMs = 0; for (let i = 0; i < 12; i++) { await flush(); await advance(500); }
  o.later = { asking: app.get().asking, pageInert: page.inert, headInert: header.inert, legsHere: maps.trainings.has(LEGS) };   // the first restore landed; the second question up, the page behind it blocked
  fire(byId.get("askNo"), "click"); for (let i = 0; i < 4; i++) { await flush(); await advance(500); }
  o.end = { asking: app.get().asking, pageInert: page.inert, flags: fns.restoreFlags() };
  return o;
}
async function pickLocalRestore() {                                  // the device alone (no account): a backup with Jane renamed, the question, Restore tapped
  fresh(); app.set({ signedIn: false, clientMode: false, backend: fns.localBackend, view: { name: "clients" } });
  maps.clients.set(C, { id: C, name: "Jane Testperson", unit: "lb" });
  pickFile({ app: "fiala-trainings", format: 1, clients: { [C]: { id: C, name: "Jane T. Person", unit: "lb" } }, trainings: {} });
  for (let i = 0; i < 6; i++) { await flush(); await advance(500); }
  const question = byId.get("askTitle").textContent;
  fire(byId.get("askYes"), "click");
  for (let i = 0; i < 20; i++) { await flush(); await advance(500); }
  const said = alertNow(); await closeAlert();
  return { question, name: (maps.clients.get(C) || {}).name, said, pageInert: page.inert };
}
let reloads = 0, watching = false;                                    // a newer release on the device: one watcher for the whole probe (each watchReleases call adds listeners of its own), the page's reloads counted
const newRelease = () => {
  reloads = 0; if (watching) return; watching = true; const SW = {};
  navigator.serviceWorker = { controller: null, addEventListener: (t, fn) => { (SW[t] ||= []).push(fn); }, getRegistration: () => Promise.resolve(null) };
  location.reload = () => { reloads++; };
  fns.watchReleases(316); for (const fn of SW.message || []) fn({ data: { type: "release", current: 317 } });   // the worker: release 317 is on the device
};
const vis = async (v) => { document.visibilityState = v; for (const l of [...(L.visibilitychange || [])]) l.fn({ type: "visibilitychange" }); await flush(); };   // he leaves the app ("hidden") and comes back ("visible")
async function release() {                                            // a newer release is on the device while he restores: no reload until the restore is done (it dropped the restore he had confirmed)
  fresh(); const sb = makeSupabase(), f = await setupJane(sb), o = {}; newRelease();
  sb.delayMs = 3000; pickFile(f); await flush(); await advance(1000);
  await vis("hidden"); o.beforeQuestion = reloads; await vis("visible");   // he leaves the app for a moment while the read before the question is out, and comes back
  for (let i = 0; i < 30 && !app.get().asking; i++) { await flush(); await advance(500); }
  await advance(1000); fire(byId.get("askYes"), "click"); await flush(); await advance(1000);
  await vis("hidden"); o.duringRead = reloads; await vis("visible");      // and again while the read after the tap is out
  sb.delayMs = 0; for (let i = 0; i < 20; i++) { await flush(); await advance(500); }
  o.landed = sb.tables.ft_trainings.has(LEGS) && maps.trainings.has(LEGS);
  await vis("hidden"); o.afterLanding = reloads; await vis("visible");    // once it has landed, the next time he leaves the app it comes back new
  return o;
}
// ---------- the twenty-second check round ----------
async function focusedBox(how, alertToo = false) {                     // a box in focus as the question, or the alert after the tap, comes due. "keys": a date box typed digit by digit (a computer's, or one reached by keys: keysIn) holds it, as typing does, until he leaves the box (on a Mac the question came up mid-date in a client's Active until, and his Return took its Cancel); "tap": a phone's date wheel, no key, holds nothing; "readonly": nor does a box that takes no typing (the Client view's title: counted as typing, it would hold the question for good)
  fresh(); const sb = makeSupabase(), f = await setupJane(sb), box = mk("input"); box.type = how === "readonly" ? "text" : "date"; box.readOnly = how === "readonly"; page.appendChild(box); const o = {};
  if (!alertToo) { sb.delayMs = 2000; pickFile(f); await flush(); await advance(500); }   // one bar of signal: the read before the question is out
  else { pickFile(f); for (let i = 0; i < 10; i++) { await flush(); await advance(500); } await advance(1000); sb.setFail({ op: "select", times: 100000, message: "Failed to fetch" }); sb.delayMs = 1000; fire(byId.get("askYes"), "click"); await flush(); app.set({ asking: true }); for (let i = 0; i < 10; i++) { await flush(); await advance(500); } }   // Restore tapped; the read after it fails with a sheet up
  document.activeElement = box; fire(box, "pointerdown", {}); if (how === "keys") fire(box, "keydown", { key: "1" });   // clicked into, then a digit typed; or only tapped
  if (alertToo) app.set({ asking: false });                            // the sheet goes: the alert is due
  for (let i = 0; i < 12; i++) { await flush(); await advance(500); }
  const now = () => (alertToo ? alertNow() : [app.get().asking, byId.get("askTitle").textContent]);
  o.whileIn = now(); document.activeElement = null; for (let i = 0; i < 3; i++) { await flush(); await advance(500); }   // he leaves the box
  o.afterLeaving = now(); sb.delayMs = 0; sb.setFail(null);
  if (alertToo) await closeAlert(); else { fire(byId.get("askNo"), "click"); for (let i = 0; i < 4; i++) { await flush(); await advance(500); } }
  fire(body, "pointerdown", {}); box.remove();                         // (a press: the next case starts with no key last)
  return o;
}
async function badFile(kind) {                                        // the alerts for a file the handler cannot take wait while a box is being typed in, as its other alerts do (they came at once): not a backup, as a weight is typed; from a newer version of the app, as a date box is typed by keys
  fresh(); const sb = makeSupabase(); await setupJane(sb); const box = mk("input"); box.type = kind === "newer" ? "date" : "text"; page.appendChild(box);
  document.activeElement = box; if (kind === "newer") fire(box, "keydown", { key: "2" });
  pickFile(kind === "newer" ? { app: "fiala-trainings", format: 2, clients: {}, trainings: {} } : { app: "something-else" });
  for (let i = 0; i < 4; i++) { await flush(); await advance(500); }
  const o = { whileTyping: alertNow() }; document.activeElement = null; for (let i = 0; i < 3; i++) { await flush(); await advance(500); }   // he leaves the box
  o.afterTyping = alertNow(); await closeAlert(); fire(body, "pointerdown", {}); box.remove();
  return o;
}
async function navDuringRead() {                                       // a computer's swipe back (the home-screen app's too) slides over a picture of the page left, taken as he leaves it (captureScreen), with what its boxes hold copied in; the Clients page holds the restore's file input, whose value a script may set only to empty (a browser throws), so while a picked backup was read before its question every step off the Clients page threw: a client's row did nothing, a pill left the page half-changed, and the read then said the server had not answered
  fresh(); const sb = makeSupabase(), f = await setupJane(sb), o = { steps: {} }, copied = [];
  let held = ""; restoreFile.type = "file"; Object.defineProperty(restoreFile, "value", { get: () => held, set: (x) => { if (x !== "") throw new Error("InvalidStateError"); held = ""; }, configurable: true });   // as a browser's file input: it holds the file's name, and a script may only empty it
  const copyBox = () => ({ tagName: "INPUT", type: "file", get value() { return ""; }, set value(x) { copied.push(x); if (x !== "") throw new Error("InvalidStateError"); } });   // the file input in the picture's copy of the page
  const clientsPage = { hidden: false, getClientRects: () => [{}], getBoundingClientRect: () => ({ top: 0, left: 0, width: 390, height: 800, right: 390, bottom: 800 }), querySelectorAll: () => [restoreFile], cloneNode: () => ({ style: {}, querySelectorAll: () => [copyBox()] }) };   // the Clients page on screen, holding #restoreFile
  const qsa0 = document.querySelectorAll; document.querySelectorAll = (sel) => (sel === "main > section" ? [clientsPage] : qsa0.call(document, sel));
  try {
    fns.forceSwipe(true); fire(body, "pointerdown", {});                 // the swipe back on (the tests' matchMedia says no to a computer; the home-screen app's takes the same pictures), and the app touched: pictures are taken
    sb.delayMs = 2000; restoreFile.files = [{ text: async () => JSON.stringify(f) }]; held = "C:\\fakepath\\backup.json";   // picked on the Data page, then Back to the Clients page; one bar of signal: the read before the question shows nothing for a while
    for (const fn of restoreFile.H.change || []) fn({ type: "change", target: restoreFile });
    await flush(); await advance(500);
    const step = (k, fn) => { try { fn(); o.steps[k] = "ok"; } catch (e) { o.steps[k] = String((e && e.message) || e); } };
    step("row", () => fns.go({ name: "client", id: JR })); o.steps.rowOpens = app.get().view.name;   // Jane's row: her page
    await flush(); step("back", () => fns.go({ name: "clients" }, true)); await flush();   // Back
    for (const pill of ["settingsBtn", "catalogBtn", "dataBtn"]) { step(pill, () => fire(byId.get(pill), "click")); o.steps[pill + "Opens"] = fns.settingsPage().open; await flush(); if (pill !== "dataBtn") { step(pill + "Back", () => fns.leaveSettings()); await flush(); } }   // each pill and Back, ending on the Data page
    for (let i = 0; i < 12 && !app.get().asking; i++) { await flush(); await advance(500); }
    o.question = byId.get("askTitle").textContent; o.alert = alertNow(); o.fileEmptied = held === ""; o.shots = fns.navState().shots; sb.delayMs = 0;
    await advance(1000); fire(byId.get("askYes"), "click"); for (let i = 0; i < 10; i++) { await flush(); await advance(500); }   // Restore
    o.landed = [maps.trainings.has(LEGS), sb.tables.ft_trainings.has(LEGS)]; o.said = alertNow(); o.copied = copied;
    await closeAlert();
  } finally { document.querySelectorAll = qsa0; fns.forceSwipe(false); fns.dropShots(); fns.leaveSettings(); Object.defineProperty(restoreFile, "value", { value: "", writable: true, configurable: true, enumerable: true }); restoreFile.files = null; delete restoreFile.type; }   // the page as before: no pictures, the plain stand-in input
  return o;
}
async function oddHere(where) {                                       // a damaged copy of Push here (its rows not a list: an older version wrote it so) never stops the restore: on the device alone, and signed in with the server's copy whole (the read before the question takes it over the damaged one); relabeled read the copy here and threw, so the restore, or that read, stopped at it, every workout after it left as it was
  fresh(); const at = "2026-11-10T16:00:00.000Z", work = (id, title) => ({ id, clientId: JR, title, date: "2026-11-21", createdAt: at, completedAt: null, skippedAt: null, rows: [{ id: "p1", label: "1", name: "Bench press", sets: 3, reps: "8", weights: [], repsDone: [], setsDone: 0, done: false }] });
  let sb = null, f;
  if (where === "alone") { app.set({ signedIn: false, clientMode: false, backend: fns.localBackend, view: { name: "clients" } }); maps.clients.set(JR, { id: JR, name: "Jane Roe", unit: "lb" }); maps.trainings.set(PUSH, work(PUSH, "Push")); maps.trainings.set(LEGS, work(LEGS, "Legs")); f = { app: "fiala-trainings", format: 1, clients: { [JR]: { id: JR, name: "Jane Roe", unit: "lb" } }, trainings: { [PUSH]: work(PUSH, "Push (from the backup)"), [LEGS]: work(LEGS, "Legs (from the backup)") } }; }   // the device alone: both renamed since the backup, the damaged one first in the file
  else { sb = makeSupabase(); f = await setupJane(sb); sb.seed("ft_trainings", PUSH, work(PUSH, "Push"), { client_id: JR }); fns.syncDownNow(); for (let i = 0; i < 6; i++) { await flush(); await advance(500); } f.trainings[PUSH] = work(PUSH, "Push (from the backup)"); }   // signed in: her Legs deleted by mistake since the backup, her Push renamed
  maps.trainings.get(PUSH).rows = { a: 1 };                          // the damaged copy here
  pickFile(f); for (let i = 0; i < 10; i++) { await flush(); await advance(500); }
  const o = { question: byId.get("askTitle").textContent }; fire(byId.get("askYes"), "click"); for (let i = 0; i < 20; i++) { await flush(); await advance(500); }
  const title = (id) => (maps.trainings.get(id) || {}).title, onServer = (id) => (sb.tables.ft_trainings.has(id) ? sb.tables.ft_trainings.get(id).data.title : null);
  o.said = alertNow(); o.here = [title(PUSH), title(LEGS)]; o.server = sb ? [onServer(PUSH), onServer(LEGS)] : null; o.flags = fns.restoreFlags();
  await closeAlert(); return o;
}
async function twiceBoth() {                                          // one bar of signal: nothing shows, so he picks the backup a second time, and answers Restore to both questions; a newer release on the device: no reload during the second restore's read either (restoring counts the picks: as a flag, the first to end would clear it, and the page reload under the second)
  fresh(); const sb = makeSupabase(), f = await setupJane(sb), o = {}; newRelease();
  sb.delayMs = 3000; pickFile(f); await flush(); await advance(1500); pickFile(JSON.parse(JSON.stringify(f)), "y");
  for (let i = 0; i < 40 && !app.get().asking; i++) { await flush(); await advance(250); }
  await advance(1000); fire(byId.get("askYes"), "click"); await flush();   // the first question: Restore
  for (let i = 0; i < 80 && !(app.get().asking && !fns.restoreFlags().restoreRead); i++) { await flush(); await advance(250); }   // the first restore lands; the second question comes up
  o.second = app.get().asking;
  await advance(1000); fire(byId.get("askYes"), "click"); await flush(); await advance(1000);   // the second: Restore too, its read out (3 s)
  o.flags = fns.restoreFlags(); await vis("hidden"); o.duringSecondRead = reloads; await vis("visible");
  sb.delayMs = 0; for (let i = 0; i < 20; i++) { await flush(); await advance(500); }
  o.end = fns.restoreFlags(); await vis("hidden"); o.afterBoth = reloads; await vis("visible");
  return o;
}
async function throwInside() {                                        // a throw inside the handler (here the picker's file list cannot be read: a stand-in for any throw not met yet) leaves nothing counted, so a newer release still reloads the page the next time he leaves the app (the change listener's finally: without it one throw would hold every reload off for the session)
  fresh(); newRelease(); const MSG = "the file list could not be read";
  for (const fn of restoreFile.H.change || []) fn({ type: "change", target: { get files() { throw new Error(MSG); }, value: "x" } });
  for (let i = 0; i < 4; i++) { await flush(); await advance(500); }
  await new Promise((r) => setImmediate(r)); const i = rejected.indexOf(MSG); if (i >= 0) rejected.splice(i, 1);   // the throw itself, unhandled as in a browser: counted here, not left for the check at the end
  const o = { threw: i >= 0, flags: fns.restoreFlags() }; await vis("hidden"); o.reloads = reloads; await vis("visible");
  return o;
}
// ---------- the twenty-third check round ----------
async function focusedKind(type, readOnly, key) {                     // keysIn's own branches: a box of this kind clicked into as the question comes due, then a key pressed (or none); run on a phone and, with "desk", on a computer
  fresh(); const sb = makeSupabase(), f = await setupJane(sb), box = mk("input"); box.type = type; box.readOnly = !!readOnly; page.appendChild(box); const o = {};
  sb.delayMs = 2000; pickFile(f); await flush(); await advance(500);    // one bar of signal: the read before the question is out
  document.activeElement = box; fire(box, "pointerdown", {}); if (key) fire(box, "keydown", { key });
  for (let i = 0; i < 12; i++) { await flush(); await advance(500); }
  const now = () => [app.get().asking, byId.get("askTitle").textContent];
  o.whileIn = now(); document.activeElement = null; for (let i = 0; i < 3; i++) { await flush(); await advance(500); }   // he leaves the box
  o.afterLeaving = now(); sb.delayMs = 0; fire(byId.get("askNo"), "click"); for (let i = 0; i < 4; i++) { await flush(); await advance(500); }
  fire(body, "pointerdown", {}); box.remove();                         // (a press: the next case starts with no key last)
  return o;
}
const keyKinds = async () => ({ dateTap: await focusedKind("date", false, ""), monthKey: await focusedKind("month", false, "1"), roDateKey: await focusedKind("date", true, "1"), checkboxSpace: await focusedKind("checkbox", false, " ") });   // a date box only clicked into; a month box, then a digit; a read-only date box, then a digit; a checkbox, then Space
const OMAR = { id: OM, name: "Omar Sample", unit: "lb", phone: "3105550100" };
const slowNet = (sb) => {                                              // net.ms: a write to a client's record answered that many ms after it goes out (one bar of signal); net.throws: every read throws (a stand-in for a read that throws, as on the known damaged server copy)
  const net = { ms: 0, throws: false }, from0 = sb.from;
  sb.from = (table) => { const b = from0(table); let write = false; for (const m of ["update", "upsert", "insert", "delete"]) { const fn = b[m]; b[m] = (...a) => { write = true; fn(...a); return b; }; } const then0 = b.then; b.then = (res, rej) => (net.throws && !write ? Promise.reject(new Error("a damaged copy")).then(res, rej) : write && table === "ft_clients" && net.ms ? new Promise((r) => setTimeout(r, net.ms)).then(() => then0.call(b, res, rej)) : then0.call(b, res, rej)); return b; };
  return net;
};
const omarSaved = async (net, ms, phone) => { net.ms = ms; maps.clients.get(OM).phone = phone; fns.scheduleSave("clients", OM, 0); await flush(); await advance(100); };   // the coach saves Omar's new phone number
async function afterwards(o, net, back) {                             // the next good sync, then the next save: their words; back: the Mac's clock set back that many ms after the failed read (the page's steady clock never moves)
  const real = Date.now; if (back) Date.now = () => real() - back;
  try {
    app.set({ seeding: false }); net.throws = false; await closeAlert(); fire(body, "pointerdown", {});
    fns.syncDownNow(); for (let i = 0; i < 6; i++) { await flush(); await advance(500); } o.afterGoodSync = status.textContent;
    await omarSaved(net, 0, "3105550101"); for (let i = 0; i < 6; i++) { await flush(); await advance(500); } o.afterNextSave = status.textContent;
  } finally { Date.now = real; }
  o.flags = fns.restoreFlags(); return o;
}
async function barBefore(how, saveMs = 0) {                           // the read before the question fails with no words of its own: the built-in templates' seeding stuck past its 10 s ("stuck"), or every read throwing ("throws"); saveMs: Omar's new phone number saved just before the pick, its answer saveMs later (after the alert)
  fresh(); const sb = makeSupabase(); sb.seed("ft_clients", OM, OMAR); const net = slowNet(sb), f = await setupJane(sb), o = {};
  if (saveMs) await omarSaved(net, saveMs, "3105550199");
  o.atPick = status.textContent; if (how === "stuck") app.set({ seeding: true }); else net.throws = true;
  pickFile(f);
  for (let i = 0; i < 80 && !o.alertAt; i++) { await flush(); await advance(250); if (alertNow()) o.alertAt = { alert: alertNow(), bar: status.textContent }; }   // the alert comes: the bar beside it
  for (let i = 0; i < 30; i++) { await flush(); await advance(500); }  // and a while after it (a save still out lands)
  o.barEnd = status.textContent; o.question = byId.get("askTitle").textContent; o.omarOnServer = sb.tables.ft_clients.get(OM).data.phone;
  return afterwards(o, net, 0);
}
async function barAfter(saveMs, back = 0) {                           // the read after the tap fails with no words of its own (the seeding stuck past its 10 s) while Omar's new phone number, saved just before the tap on one bar of signal, is answered saveMs later (after the alert); back: the Mac's clock set back that many ms after the failed read
  fresh(); const sb = makeSupabase(); sb.seed("ft_clients", OM, OMAR); const net = slowNet(sb), f = await setupJane(sb), o = {};
  pickFile(f); for (let i = 0; i < 10; i++) { await flush(); await advance(500); }
  o.question = byId.get("askTitle").textContent;
  await omarSaved(net, saveMs, "3105550199"); o.atTap = status.textContent;
  app.set({ seeding: true }); fire(byId.get("askYes"), "click");
  for (let i = 0; i < 80 && !o.alertAt; i++) { await flush(); await advance(250); if (alertNow()) o.alertAt = { alert: alertNow(), bar: status.textContent }; }
  for (let i = 0; i < 30; i++) { await flush(); await advance(500); }
  o.barEnd = status.textContent; o.omarOnServer = sb.tables.ft_clients.get(OM).data.phone; o.legsOnServer = sb.tables.ft_trainings.has(LEGS);
  return afterwards(o, net, back);
}
// ---------- the twenty-fourth check round ----------
const okAlert = async () => { const a = byClass(body, "pa-ask")[0], b = a ? byTag(a, "button").find((x) => x.textContent === "OK") : null; if (b) { fire(b, "click"); await flush(); } return !!b; };   // the alert's OK, pressed (it takes no answer for its first 350 ms)
const signOutNow = async (sb) => {                                    // Sign out (the stand-in server lets it go at once): the sign-in page
  sb.auth.signOut = async () => ({ error: null }); let done = false; fns.signOut().then(() => { done = true; }, (e) => { done = "threw: " + String((e && e.message) || e); });
  for (let i = 0; i < 40 && !done; i++) { await flush(); await advance(250); }
  return { done, login: !document.getElementById("vLogin").hidden, signedIn: app.get().signedIn, bar: status.textContent };
};
async function signInAgain(sb, email, ms) {                           // a sign-in on this page (the stand-in server takes any; nothing is typed in the password box), each answer ms late (one bar of signal): the bar each time it changes, from the tap until well after the first sync lands
  sb.tables.trainers = new Map([["t1", { id: "t1", email }]]);       // a coach's account
  sb.auth.signInWithPassword = async () => ({ data: { session: { user: { email } } }, error: null });
  sb.auth.getSession = async () => ({ data: { session: { user: { email } } } });
  sb.delayMs = ms; document.getElementById("loginEmail").value = email;
  const t0 = NOW, seen = [[0, status.textContent]]; let synced = null;
  fire(loginForm, "submit");
  for (let i = 0; i < 60; i++) { await flush(); await advance(250); const b = status.textContent; if (seen[seen.length - 1][1] !== b) seen.push([NOW - t0, b]); if (synced === null && app.get().syncedPerf > t0) synced = NOW - t0; }
  sb.delayMs = 0;
  return { seen, synced, signedIn: app.get().signedIn, as: app.get().sessionEmail, login: !document.getElementById("vLogin").hidden };
}
async function dataBar(how) {                                         // the coach opens Settings › Data (showData blanks its bar) while every read fails with no words of its own (the built-in templates' seeding stuck past its 10 s: "stuck"; every read throwing: "throws"), and picks a backup: the bar beside Couldn't restore, 2.5 s later, after OK, after Back on the Clients list and after the minute's sync, still failing; then after a good sync
  fresh(); const sb = makeSupabase(), net = slowNet(sb), f = await setupJane(sb), o = { onClients: status.textContent };
  if (how === "stuck") app.set({ seeding: true }); else net.throws = true;
  fire(byId.get("dataBtn"), "click"); await flush(); o.onData = { bar: status.textContent, page: fns.settingsPage().open };
  pickFile(f);
  for (let i = 0; i < 80 && !o.atAlert; i++) { await flush(); await advance(250); if (alertNow()) o.atAlert = { alert: alertNow(), bar: status.textContent }; }
  for (let i = 0; i < 5; i++) { await flush(); await advance(500); } o.alertLater = { alert: alertNow(), bar: status.textContent };
  o.pressedOK = await okAlert(); for (let i = 0; i < 2; i++) { await flush(); await advance(250); } o.afterOK = { alert: alertNow(), bar: status.textContent, page: fns.settingsPage().open };
  fns.goBackNow(); for (let i = 0; i < 4; i++) { await flush(); await advance(250); } o.backOnClients = { bar: status.textContent, page: fns.settingsPage().open, view: app.get().view.name };   // Back, as the Back circle does
  scheduleSync(); for (let i = 0; i < 6; i++) { await flush(); await advance(500); } o.afterFailedSync = status.textContent;   // the minute's sync, the reads still failing
  app.set({ seeding: false }); net.throws = false;
  scheduleSync(); for (let i = 0; i < 6; i++) { await flush(); await advance(500); } o.afterGoodSync = status.textContent;
  o.question = byId.get("askTitle").textContent; o.flags = fns.restoreFlags(); return o;
}
async function signOutMid(who) {                                      // on the Data page, Sign out while the read before the question is out (the seeding stuck), that read failing after it (at its 10 s); then a sign-in on this page, the same coach or another, on one bar of signal (each answer 2.5 s)
  fresh(); const sb = makeSupabase(), f = await setupJane(sb), o = {};
  fire(byId.get("dataBtn"), "click"); await flush();
  app.set({ seeding: true }); pickFile(f); for (let i = 0; i < 3; i++) { await flush(); await advance(500); }   // the read before the question waits for the seeding
  o.signedOut = await signOutNow(sb);
  for (let i = 0; i < 24; i++) { await flush(); await advance(500); } // the read gives up (its 10 s) after the sign-out
  o.onSignInPage = { bar: status.textContent, alert: alertNow(), login: !document.getElementById("vLogin").hidden, question: byId.get("askTitle").textContent }; app.set({ seeding: false });
  o.signIn = await signInAgain(sb, who === "same" ? "coach@test" : "second.coach@example.com", 2500);
  o.flags = fns.restoreFlags(); return o;
}
async function signOutAfter(who) {                                    // on the Data page, Restore tapped and the read after it failing with no words of its own (the seeding stuck past its 10 s): Couldn't sync beside the alert, as designed; OK, Sign out, then a sign-in on this page, another coach or the same, on one bar of signal
  fresh(); const sb = makeSupabase(), f = await setupJane(sb), o = {};
  fire(byId.get("dataBtn"), "click"); await flush();
  pickFile(f); for (let i = 0; i < 10; i++) { await flush(); await advance(500); }
  o.question = byId.get("askTitle").textContent;
  app.set({ seeding: true }); fire(byId.get("askYes"), "click");
  for (let i = 0; i < 80 && !o.atAlert; i++) { await flush(); await advance(250); if (alertNow()) o.atAlert = { alert: alertNow(), bar: status.textContent }; }
  await advance(1000); o.pressedOK = await okAlert(); app.set({ seeding: false }); await flush(); o.beforeSignOut = status.textContent;
  o.signedOut = await signOutNow(sb);
  o.signIn = await signInAgain(sb, who === "same" ? "coach@test" : "second.coach@example.com", 2500);
  o.flags = fns.restoreFlags(); return o;
}
// ---------- the twenty-fifth check round ----------
// R25-HND-3: the rule that puts Couldn't sync beside Couldn't restore repainted only a bar saying Saved or nothing, so after a backup with nothing new
// ("Everything in that backup is already here") a second backup's failed read left those words beside the alert, after OK, back on the Clients list
// and after a failing sync. R25-HND-4: left() compared only the email, so a backup picked before Sign out, its read still out, came back after the
// same coach signed in again on this page: Couldn't sync with Couldn't restore when the read failed, "Restore this backup?" when it went on.
const askOn = () => (byId.get("askSheet").hidden ? "" : byId.get("askTitle").textContent);   // the question up, by its title
async function alreadyThenFail(how) {                                  // on the Data page, this morning's backup (nothing new in it), then an older one while the read before its question fails with no words of its own (every read throwing: "throws"; the built-in templates' seeding stuck past its 10 s: "stuck") or with no connection ("offline"): the bar beside Couldn't restore, 2.5 s later, after OK, back on the Clients list and after the minute's sync, still failing; then after a good sync
  fresh(); const sb = makeSupabase(), net = slowNet(sb), f = await setupJane(sb), o = {};
  const same = JSON.parse(JSON.stringify(fns.backupData()));          // this morning's backup: Legs already deleted, nothing new in it
  fire(byId.get("dataBtn"), "click"); await flush(); o.onData = status.textContent;
  pickFile(same); for (let i = 0; i < 10; i++) { await flush(); await advance(250); }
  o.first = { bar: status.textContent, alert: alertNow(), question: askOn() };
  if (how === "throws") net.throws = true; else if (how === "stuck") app.set({ seeding: true }); else { navigator.onLine = false; sb.setFail({ op: "select", times: 100000, message: "Failed to fetch" }); }
  pickFile(f);
  for (let i = 0; i < 80 && !o.atAlert; i++) { await flush(); await advance(250); if (alertNow()) o.atAlert = { alert: alertNow(), bar: status.textContent }; }
  for (let i = 0; i < 5; i++) { await flush(); await advance(500); } o.alertLater = { alert: alertNow(), bar: status.textContent };
  o.pressedOK = await okAlert(); for (let i = 0; i < 2; i++) { await flush(); await advance(250); } o.afterOK = { alert: alertNow(), bar: status.textContent };
  fns.goBackNow(); for (let i = 0; i < 4; i++) { await flush(); await advance(250); } o.backOnClients = { bar: status.textContent, view: app.get().view.name };   // Back, as the Back circle does
  scheduleSync(); for (let i = 0; i < 6; i++) { await flush(); await advance(500); } o.afterFailedSync = status.textContent;   // the minute's sync, the reads still failing
  app.set({ seeding: false }); net.throws = false; navigator.onLine = true; sb.setFail(null);
  scheduleSync(); for (let i = 0; i < 6; i++) { await flush(); await advance(500); } o.afterGoodSync = status.textContent;
  o.question = askOn(); o.flags = fns.restoreFlags(); return o;
}
async function signBackIn(who, ends) {                                // on the Data page, a backup picked while the read before its question waits for the seeding (a new account's first sync); Sign out, then a sign-in on this page (the same coach, or another) before that read ends: it fails at its 10 s (ends 0), or goes on once the seeding ends at `ends` ms; the bar, an alert, the question and the restore's count each time one changes, until well past the read's 10 s
  fresh(); const sb = makeSupabase(), f = await setupJane(sb), o = { seen: [] }, t0 = NOW;
  fire(byId.get("dataBtn"), "click"); await flush();
  app.set({ seeding: true }); if (ends) setTimeout(() => app.set({ seeding: false }), ends);
  pickFile(f); for (let i = 0; i < 6; i++) { await flush(); await advance(250); }   // the read before the question waits for the seeding
  o.signedOut = await signOutNow(sb);
  sb.tables.trainers = new Map([["t1", { id: "t1", email: who }]]);   // the sign-in page: the email typed, Sign in (the stand-in server takes it at once; nothing is typed in the password box)
  sb.auth.signInWithPassword = async () => ({ data: { session: { user: { email: who } } }, error: null });
  sb.auth.getSession = async () => ({ data: { session: { user: { email: who } } } });
  document.getElementById("loginEmail").value = who; fire(loginForm, "submit");
  for (let i = 0; i < 8; i++) { await flush(); await advance(250); }
  o.signedIn = { signedIn: app.get().signedIn, as: app.get().sessionEmail, login: !document.getElementById("vLogin").hidden, before: NOW - t0 < (ends || 10000) };
  let last = ""; for (let i = 0; i < 64; i++) { await flush(); await advance(250); const s = JSON.stringify([status.textContent, alertNow(), askOn(), fns.restoreFlags().restoring]); if (s !== last) { last = s; o.seen.push(JSON.parse(s)); } }
  o.end = { bar: status.textContent, alert: alertNow(), question: askOn(), flags: fns.restoreFlags(), as: app.get().sessionEmail };
  if (alertNow()) await okAlert();
  if (askOn()) { fire(byId.get("askNo"), "click"); for (let i = 0; i < 4; i++) { await flush(); await advance(250); } }   // a question up: Cancel
  app.set({ seeding: false }); return o;
}
if (desk) {                                                           // restore.test.js's second run, as a computer: keysIn's own branches only
  const k = { desk, keyKinds: await keyKinds() };
  await new Promise((r) => setImmediate(r)); k.rejected = rejected; console.log(JSON.stringify(k)); process.exit(0);
}
const out = {};
out.guards = {}; for (const m of ["throwBefore", "throwOut", "heldBefore", "barClass", "throwAfter", "failHeld", "failLeft"]) out.guards[m] = await guards(m);
out.typing = await typing();
out.typingAlert = { before: await typingAlert("before"), after: await typingAlert("after") };
out.secondPick = await secondPick();
out.race = await race("quiet");
out.raceAllGone = await race("allGone");
out.raceInFlight = await race("inFlight");
out.raceBefore = await race("inFlightBefore");
out.raceFails = await race("fails");
out.raceSlow = await race("slow");
out.raceSeeding = await race("seeding");
out.raceSeedingStuck = await race("seedingStuck");
out.seedAfterSync = await race("seedAfterSync");
out.offlineAtTap = await race("offlineAtTap");
out.server500 = await race("server500");
out.barSyncOut = await race("barSyncOut");
out.barBanner = await race("barBanner");
out.signout = await signedOutUnderTheSync();
out.waits = await pickCloud("delete waits");
out.lands = await pickCloud("delete lands");
out.nolib = await pickCloud("no library");
out.kept = await pick({ id: C, name: "Jane Testperson", unit: "lb", choices: AGREED, health: {} }, { id: C, name: "Jane Testperson", unit: "lb", choices: AGREED, health: { allergies: "Latex" } });   // she deleted her allergy since the backup
out.same = await pick({ id: C, name: "Jane Testperson", unit: "lb" }, { id: C, name: "Jane Testperson", unit: "lb" });
out.localRestore = await pickLocalRestore();
out.release = await release();
out.focusedBox = { keys: await focusedBox("keys"), tap: await focusedBox("tap"), readonly: await focusedBox("readonly"), alertKeys: await focusedBox("keys", true) };
out.badFile = { notBackup: await badFile("not a backup"), newer: await badFile("newer") };
out.navDuringRead = await navDuringRead();
out.oddHere = { alone: await oddHere("alone"), signedIn: await oddHere("signed in") };
out.twiceBoth = await twiceBoth();
out.throwInside = await throwInside();
out.keyKinds = await keyKinds();
out.bar23 = { beforeStuck: await barBefore("stuck"), beforeThrows: await barBefore("throws"), beforeStuckSave: await barBefore("stuck", 14000), afterSave: await barAfter(14000), clockBack: await barAfter(14000, 2 * 3600e3) };   // the clock set back 2 hours
out.data24 = { stuck: await dataBar("stuck"), throws: await dataBar("throws") };
out.signOut24 = { mid: await signOutMid("same"), after: await signOutAfter("other"), afterSame: await signOutAfter("same") };
out.already25 = { throws: await alreadyThenFail("throws"), stuck: await alreadyThenFail("stuck"), offline: await alreadyThenFail("offline") };
out.signBack25 = { fails: await signBackIn("coach@test", 0), goesOn: await signBackIn("coach@test", 4500), otherGoesOn: await signBackIn("second.coach@example.com", 4500) };
await new Promise((r) => setImmediate(r)); out.rejected = rejected;   // (a rejection nobody handled is told only once the run gives the event loop a turn: without one, this check saw none)
console.log(JSON.stringify(out));
