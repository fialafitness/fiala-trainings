// rev/window (check round 27): the v321 app probe's harness (tests/win-app-r27-probe.mjs, the notes box made live too), with this lens's modes.
// Run by rw27.test.js, one mode per process. The
// real main.js, sync.js and photos.js behind the real win.js on a stand-in lock that grants at once (the feature on: winLost() reads the owner
// record, which names another window once Fiala has moved there), a stand-in browser database, Cache Storage and server; every element the app
// makes, and the parts named below, keep their listeners (env.js drops them), so a sheet's Cancel, a wheel's turn and the sign-in form run as on
// the page. The people and their words are made up. Modes (node tests/win-app-r27-probe.mjs <mode>):
//  - fold, bootHidden, empty (R26-WAP-3, R26-WIN-4, R26-PRV-4, R26-TW-4's hidden hook, R26-TW-8's empty branch): the words another window kept for
//    this account are folded in, never removed or written over; nothing typed removes only this window's own words, and another account's;
//  - retake (R26-WAP-6): a page that signs in again while out of sight leaves its own kept words alone;
//  - offlineCard, failCard (R26-WAP-4): a card's note taken by a start that completes no sync is drawn;
//  - exercise (R26-WAP-7): the exercise page's unsaved changes are kept and given back once, and a save makes them old;
//  - wheel (R26-WAP-9), restore (R26-WIN-2), blur (R26-TW-8, h_handBlur): what the hand-over keeps of a wheel turning, a restore's read, a box;
//  - signIn, signInOwn, signInGuards (R26-WIN-6): a sign-in that landed in another window of this browser, as auth-js tells the other tabs;
//  - lostSwitch (R26-PRV-4): a start that lost Fiala during its role check goes no further;
//  - photoLost, photoCache (R26-WAP-8): a photo pass, the cache's writes and its prune stop once Fiala has moved;
//  - photoWait, photoReset (R26-PRV-5): the last account's waiting photo stays through the next account's role check (the online event);
//  - sheets (R26-TW-4): the instructions sheet, New folder, New slide and Rename kept and given back, Cancel keeps nothing, the account switch;
//  - lostClient, wake (R26-TW-8): a client's Sign out in a window that lost Fiala wipes nothing; the screen's wake lock goes with Fiala.
// Prints one JSON line.
const mode = process.argv[2] || "";
const idb = new Map();                                                    // the browser's database, as win-app-probe.mjs stands in for it
const request = () => ({ onsuccess: null, onerror: null, result: undefined, error: null });
const db = { createObjectStore() {}, close() {}, transaction() {
  const tx = { oncomplete: null, onerror: null, onabort: null }, end = (ok) => setTimeout(() => (ok ? tx.oncomplete && tx.oncomplete() : tx.onerror && tx.onerror()), 0);
  tx.objectStore = () => ({
    get(k) { const r = request(); setTimeout(() => { r.result = idb.has(k) ? structuredClone(idb.get(k)) : undefined; if (r.onsuccess) r.onsuccess(); }, 0); return r; },
    put(v, k) { const val = structuredClone(v), r = request(); setTimeout(() => { idb.set(k, val); if (r.onsuccess) r.onsuccess(); end(true); }, 0); return r; },
    delete(k) { const r = request(); setTimeout(() => { idb.delete(k); if (r.onsuccess) r.onsuccess(); end(true); }, 0); return r; },
  });
  return tx; } };
globalThis.indexedDB = { open() { const r = request(); setTimeout(() => { r.result = db; if (r.onupgradeneeded) r.onupgradeneeded(); if (r.onsuccess) r.onsuccess(); }, 0); return r; } };
const cacheStore = new Map(), cacheLog = [];                              // Cache Storage (the photo copies), shared by every window of the browser
globalThis.caches = { open: async () => ({ match: async (k) => cacheStore.get(String(k)), keys: async () => [...cacheStore.keys()].map((url) => ({ url })), delete: async (r) => { const u = typeof r === "string" ? r : r.url; cacheLog.push("delete " + u); return cacheStore.delete(u); }, put: async (k, v) => { cacheLog.push("put " + k); cacheStore.set(String(k), v); } }), delete: async (n) => { cacheLog.push("drop " + n); return true; } };
const ENV = await import("./env.js");
const winL = new Map(), docL = new Map();                                 // the window's and the document's own listeners (env.js drops them), fired by hand
globalThis.addEventListener = (t, f) => { if (!winL.has(t)) winL.set(t, []); winL.get(t).push(f); };
ENV.document.addEventListener = (t, f) => { if (!docL.has(t)) docL.set(t, []); docL.get(t).push(f); };
const fireWin = (t) => { for (const f of [...(winL.get(t) || [])]) f({ type: t }); };
const fireDoc = (t) => { for (const f of [...(docL.get(t) || [])]) f({ type: t, target: ENV.document.body }); };
const fire = (e, type, extra = {}) => { const ev = { type, target: e, currentTarget: e, isTrusted: false, detail: 0, key: "", preventDefault() {}, stopPropagation() {}, stopImmediatePropagation() {}, ...extra }; for (const f of [...((e.H || {})[type] || [])]) f(ev); return ev; };
const live = (e) => { const H = {}, parts = {}; e.H = H; e.addEventListener = (t, f) => { (H[t] ||= []).push(f); }; e.removeEventListener = (t, f) => { const a = H[t] || []; const i = a.indexOf(f); if (i >= 0) a.splice(i, 1); }; e.click = () => fire(e, "click");
  e.closest = (sel) => (sel === ".chip" ? live(ENV.el("div")) : null); e.querySelector = (sel) => (parts[sel] ||= live(ENV.el("div"))); let chips = null; e.querySelectorAll = (sel) => (sel === ".specs .chip" ? (chips ||= [live(ENV.el("div")), live(ENV.el("div"))]) : []); return e; };   // an element whose listeners run (a part it holds, by its selector, the same each time; a set's box inside its chip, as the cards draw it)
const made = []; { const ce = ENV.document.createElement; ENV.document.createElement = (t) => { const e = live(ce(t)); made.push(e); return e; }; }   // every element the app makes
const part = (id, props = {}) => { const e = live(ENV.el("div")); Object.assign(e, props); ENV.byId.set(id, e); return e; };   // a part of the markup the app wires (some at import)
for (const id of ["restoreFile", "loginForm", "signout", "signout3", "createBtn", "askYes", "askNo", "noteOk", "noteNo", "textOk", "textNo", "cNotes"]) part(id);
for (const id of ["askSheet", "noteSheet", "textSheet", "whenBg"]) part(id, { hidden: true });
ENV.document.querySelector = () => null;                                  // no menu, date picker, photo framing or sheet up (held() reads them)
const W = await import("../app/win.js");
W.oneWindow(() => {}, {
  locks: { request: (name, o, cb) => { if (typeof o === "function") cb = o; const r = cb({ name }); return Promise.resolve(r); }, query: async () => ({ held: [{ name: "fiala.window", clientId: "me" }] }) },
  Channel: class { constructor() { this.onmessage = null; } postMessage() {} close() {} },
  loc: { href: "https://app.example/", hash: "" }, hist: { state: null, replaceState() {} }, setI: () => 0, clearI: () => {},
});
const { load } = await import("./load.js");
const { makeSupabase } = await import("./fake-supabase.js");
const { TEMPLATES_ID } = await import("../app/model.js");
const app = await load(); const { fns, maps } = app;
const $ = (id) => ENV.document.getElementById(id);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const settle = async () => { const until = Date.now() + 15000; do await wait(5); while ((app.get().inflight > 0 || maps.timers.size) && Date.now() < until); };
const until = async (ok, ms = 8000) => { const t0 = Date.now(); while (!ok() && Date.now() - t0 < ms) await wait(10); return !!ok(); };
const clone = (x) => JSON.parse(JSON.stringify(x));
const day = (n) => { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + n); return fns.localIso(d); };   // the app's local day (never UTC)
const COACH = "coach@x.com", JANE = "jane@x.com", C = "c1", WK = "w1", KEPT = "fiala.kept";
const AGREED = { state: "agreed", at: "2026-11-18T17:00:00.000Z", by: "client" };
const HEALTH = { choices: { health: AGREED, zone: { state: "deny", at: "2026-11-18T17:00:00.000Z" } }, health: { limits: "Left knee" }, birthday: "1990-04-02" };
const NOTE = "Knee sore on set 3, check next week";                      // a card's half-written note, kept in window A
const k = fns.keptMaps();
const newPage = () => { for (const m of [k.keptText, k.noteDraft, k.cardNoteDraft, k.cardNoteBase]) m.clear(); };   // a new start of the page (the window Fiala moved to): its memory empty
const keptBy = (tab, o = {}, owner = COACH) => { const s = JSON.stringify({ owner, tab, at: Date.now(), text: {}, cards: [], bases: [], notes: [], ...o }); localStorage.setItem(KEPT, s); return s; };
const onDevice = () => { const x = JSON.parse(localStorage.getItem(KEPT) || "null"); return x && { tab: x.tab === W.winTab() ? "this page" : x.tab, owner: x.owner, text: x.text, cards: x.cards, bases: x.bases, notes: x.notes }; };
const loseTo = (tab = "window-B") => { localStorage.setItem("fiala.window", JSON.stringify({ tab, at: Date.now(), vis: "visible" })); return W.winLost(); };   // Use here in window B: the record names it; this window's first check loses Fiala
const calls = (sb, from) => sb.log.slice(from).map((c) => c.rpc || (c.storage ? "storage " + c.storage : c.table + " " + c.op));
const queued = () => { const q = JSON.parse(localStorage.getItem("fiala.pending.v1") || "null"); return q && { owner: q.owner || null, dirty: q.dirty || [], recs: Object.fromEntries((q.recs || []).map(([kk, d]) => [kk, d])) }; };   // the queue on the device: what the window Fiala moves to sends
const boxes = () => made.filter((e) => String(e.tagName).toUpperCase() === "TEXTAREA" && e.value === NOTE).length;   // card note boxes drawn with the kept note in them
const VIEWS = ["vLogin", "vSignup", "vRecovery", "vWaiting", "vClients", "vClient", "vTraining", "vExercise"];
const shown = () => VIEWS.filter((id) => !$(id).hidden);
function server({ who = COACH, health = null, templates = false, cid = C, wid = WK } = {}) {   // Jane (made up) with one workout of one exercise; the library holding a session (shared by the browser's windows)
  const sb = makeSupabase(); let session = who;
  const trainers = () => { sb.tables.trainers = new Map(session === COACH ? [["t1", { id: "t1", email: COACH }]] : []); };   // row-level security: the coach's row shows to him alone
  sb.auth.getSession = async () => ({ data: { session: session ? { user: { email: session } } : null }, error: null });
  sb.auth.getUser = async () => ({ data: { user: session ? { email: session } : null }, error: null });
  sb.auth.onAuthStateChange = (cb) => { sb.told = cb; return { data: { subscription: { unsubscribe() {} } } }; };
  sb.auth.stopAutoRefresh = () => {};
  sb.signInMs = 0; sb.auth.signInWithPassword = async ({ email }) => { if (sb.signInMs) await wait(sb.signInMs); session = String(email).trim().toLowerCase(); trainers(); if (sb.told) sb.told("SIGNED_IN", { user: { email: session } }); return { data: { session: { user: { email: session } } }, error: null }; };   // as auth-js: the session stored, then its own page told SIGNED_IN, then the answer
  sb.signOutMs = 0; sb.auth.signOut = async () => { if (sb.signOutMs) await wait(sb.signOutMs); session = null; trainers(); if (sb.told) sb.told("SIGNED_OUT", null); return { error: null }; };
  sb.landed = (email) => { session = email; trainers(); if (sb.told) sb.told("SIGNED_IN", { user: { email } }); };   // a sign-in in another window of this browser: the session stored on the device, and this page's library told SIGNED_IN (auth-js's BroadcastChannel)
  sb.ended = () => { session = null; trainers(); if (sb.told) sb.told("SIGNED_OUT", null); };   // the session ended elsewhere (a password changed there)
  sb.as = (email) => { session = email; trainers(); }; sb.who = () => session;
  trainers();
  sb.seed("ft_clients", cid, { id: cid, name: "Jane Testperson", unit: "lb", email: JANE, ...(health || {}) });
  sb.seed("ft_trainings", wid, { id: wid, clientId: cid, title: "Legs", date: day(2), createdAt: "2026-11-10T16:00:00.000Z", completedAt: null, skippedAt: null, rows: [{ id: "sq", label: "1", name: "Back squat", sets: 3, reps: "8", rest: "", weights: [], repsDone: [], setsDone: 0, done: false, note: "", alts: [], unit: "lb" }] }, { client_id: C });
  if (templates) sb.seed("ft_clients", TEMPLATES_ID, { id: TEMPLATES_ID, name: "Templates", kind: "templates", templatesVersion: 3, builtinsAdopted: 1, folders: [{ id: "f1", name: "Strength", parent: null, kind: "folder", at: "2026-11-10T16:00:00.000Z" }] });
  sb.rpcs.client_my_data = async () => ({ clients: [...sb.tables.ft_clients.values()].filter((c) => c.data.email === JANE).map((c) => ({ id: c.id, data: (({ notes, ...rest }) => rest)(clone(c.data)), updated_at: c.updated_at })), trainings: [...sb.tables.ft_trainings.values()].filter((t) => t.client_id === cid).map((t) => ({ id: t.id, data: clone(t.data), updated_at: t.updated_at })) });
  sb.rpcs.client_set_zone = async () => null; sb.rpcs.client_set_profile = async () => null;
  globalThis.supabase = { createClient: () => sb };
  return sb;
}
const slowRole = (sb, ms, killed = false) => {                            // the next role check (the trainers read) takes ms; killed: it never answers ("Failed to fetch")
  const real = sb.from; let once = false;
  sb.from = (table) => { const b = real(table); if (table !== "trainers" || once) return b; once = true; const then0 = b.then;
    b.then = (res, rej) => new Promise((r) => setTimeout(r, ms)).then(() => (killed ? { data: null, error: { message: "Failed to fetch", code: "" } } : new Promise((ok, no) => then0.call(b, ok, no)))).then(res, rej);
    return b; };
  return () => { sb.from = real; };
};
const signInForm = async (email) => { $("loginEmail").value = email; $("loginPassword").value = "made-up-pass-123"; fire($("loginForm"), "submit"); };   // the real Sign in form

const OLD = "Knee sore since Monday", NEW = "Knee sore since Monday, ice after every session";   // the notes box: kept in window A, then typed fuller in B
const KEY = "sb-umurkxqswcjmubeucrzw-auth-token";
const modes = {
  // R27-WIN (the fold): window A kept the coach's half-typed notes about Jane at Use here; this window B starts on one bar (its role check out for
  // 1.5 s), Jane's page already drawn from the device copy, the notes box empty (A's words not taken yet); he types the fuller version there; then
  // [hide] he switches to Mail before the start ends and comes back, or [no hide] he just waits; then the start ends and the page is drawn
  async overwrite() {
    const sb = server(); await fns.boot(); await settle();
    localStorage.setItem("fiala.trainings.view", JSON.stringify({ name: "client", id: C }));
    newPage(); $("cNotes").value = ""; keptBy("window-A", { notes: [[C, OLD]] });
    sb.delayMs = 1500; const booting = fns.boot(); await wait(300);
    const page = { view: app.get().view.name, signedIn: app.get().signedIn };
    $("cNotes").value = NEW; fire($("cNotes"), "input", { target: $("cNotes") }); const typed = k.noteDraft.get(C) || null;
    let atHide = null; if (process.argv[3] !== "nohide") { W.winHooks.hidden(); atHide = onDevice() && onDevice().notes; W.winHooks.shown(); }
    await booting; sb.delayMs = 0; await settle(); fns.render(); await wait(20);
    return { page, typed, atHide, draft: k.noteDraft.get(C) || null, box: $("cNotes").value };
  },
  // R27-WIN (the fold, a card's note): the same with a card's note: A kept "Knee sore on set 3..." for card 1; B, before its start took it, opened
  // card 1's note and typed its own words (the box's input), then left the box; B goes out of sight and back; the start ends; the cards drawn again
  async cardOverwrite() {
    const sb = server(); await fns.boot(); await settle();
    localStorage.setItem("fiala.trainings.view", JSON.stringify({ name: "training", id: WK })); fns.setPreview(true);
    newPage(); keptBy("window-A", { cards: [[WK + "/1", NOTE]], bases: [[WK + "/1", "Her note from before"]] });   // A's box was opened on her note of then
    sb.delayMs = 1500; const booting = fns.boot(); await wait(300);
    k.cardNoteDraft.set(WK + "/1", "Ask about the left knee"); k.cardNoteBase.set(WK + "/1", "");   // what the box's input handler keeps as he types in B (opened on no note)
    let atHide = null; if (process.argv[3] !== "nohide") { W.winHooks.hidden(); atHide = onDevice() && onDevice().cards; W.winHooks.shown(); }
    await booting; sb.delayMs = 0; await settle();
    return { atHide, draft: k.cardNoteDraft.get(WK + "/1") || null, base: k.cardNoteBase.has(WK + "/1") ? k.cardNoteBase.get(WK + "/1") : "(none)" };
  },
  // R27-WIN (R26-WIN-6's entry): the device still holds the coach's sign-in (the library's record), and the page shows the sign-in page (a launch
  // with no signal: the session could not be read, no account remembered); later the library, back on screen, reads that sign-in again and tells
  // the page SIGNED_IN (auth-js's visibility re-check); [typed] Jane has typed her own email in the box meanwhile
  async heldSignIn() {
    const sb = server({ who: null }); localStorage.setItem(KEY, JSON.stringify({ access_token: "made-up", refresh_token: "made-up", expires_at: 1, user: { email: COACH } }));
    await fns.boot(); await settle();
    const before = shown();
    if (process.argv[3] === "typed") { $("loginEmail").value = JANE; $("loginPassword").value = "janes-own-pass-1"; }
    const n0 = sb.log.length; sb.landed(COACH); await wait(300); await settle();
    return { before, after: shown(), signedIn: app.get().signedIn, as: app.get().sessionEmail || null, password: $("loginPassword").value, roleChecks: calls(sb, n0).filter((c) => c === "trainers select").length };
  },
  // R27-WIN (R26-WIN-6's entry): no sign-in held; Jane is typing her own email on the sign-in page when a sign-in of the coach's lands from another
  // window of this browser (a window that lost Fiala while its Sign in was out: its answer came late)
  async typedOther() {
    const sb = server({ who: null }); localStorage.removeItem(KEY); await fns.boot(); await settle();
    $("loginEmail").value = JANE; $("loginPassword").value = "janes-own-pass-1";
    const n0 = sb.log.length; sb.landed(COACH); await wait(300); await settle();
    return { after: shown(), signedIn: app.get().signedIn, as: app.get().sessionEmail || null, password: $("loginPassword").value, roleChecks: calls(sb, n0).filter((c) => c === "trainers select").length };
  },
  // R27-WIN (R26-WIN-6's entry, the launch's own late session; older): the same device (the coach's sign-in held, no account remembered); the
  // launch cannot read the session within 4 s (the library retrying its refresh): the sign-in page; [typed] Jane types her own email and
  // password, [own] the coach types his; then the session comes through
  async slowHeld() {
    const sb = server({ who: null }); localStorage.setItem(KEY, JSON.stringify({ access_token: "made-up", refresh_token: "made-up", expires_at: 1, user: { email: COACH } }));
    let release = null; sb.auth.getSession = () => new Promise((r) => { release = () => r({ data: { session: { user: { email: COACH } } }, error: null }); });
    let over = false; fns.boot().then(() => { over = true; }); await until(() => over, 9000);
    const before = shown();
    if (process.argv[3] === "typed") { $("loginEmail").value = JANE; $("loginPassword").value = "janes-own-pass-1"; }
    if (process.argv[3] === "own") { $("loginEmail").value = COACH; $("loginPassword").value = "his-own-pass-1"; }
    sb.as(COACH); release(); await wait(300); await settle();
    return { before, after: shown(), signedIn: app.get().signedIn, as: app.get().sessionEmail || null, password: $("loginPassword").value };
  },
  // R27-WIN (the late sign-in): the coach is signed in on this page with a change waiting (no signal); a sign-in of Jane's, begun in another window
  // of this browser that lost Fiala while its Sign in was out, lands late: the library now holds her sign-in (as auth-js tells the other tabs)
  async swapUnder() {
    const sb = server(); await fns.boot(); await settle();
    sb.setFail({ times: 1e6, message: "Failed to fetch" }); maps.clients.get(C).phone = "3105550111"; fns.scheduleSave("clients", C, 0); await settle();   // his change waits
    sb.setFail(null); app.set({ offline: false });
    const n0 = sb.log.length; sb.landed(JANE); await wait(300); await settle();
    await fns.syncDownNow().catch(() => {}); await settle();                // the next sync (60 s later on the page)
    return { shown: shown(), signedIn: app.get().signedIn, page: app.get().sessionEmail, library: sb.who(), owner: app.get().pendingOwner, waiting: [...maps.dirty.keys()], callsAfter: calls(sb, n0).length, msg: $("loginMsg").textContent };
  },
};
if (!modes[mode]) { console.log(JSON.stringify({ error: "no mode " + mode })); process.exit(0); }
const out = await modes[mode]().catch((e) => ({ error: String((e && e.stack) || e).slice(0, 800) }));
console.log(JSON.stringify(out));
process.exit(0);
