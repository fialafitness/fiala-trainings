// Run by win-app-r27.test.js, one mode per process, all at once (v321: the twenty-sixth check round's one-window findings on the app's side). The
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
for (const id of ["restoreFile", "loginForm", "signout", "signout3", "createBtn", "askYes", "askNo", "noteOk", "noteNo", "textOk", "textNo", "back"]) part(id);   // (back: the exercise page's Back, tapped in exerciseLeft)
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

const modes = {
  // v321, the twenty-seventh check round (tests lens), R26-WAP-7's guards: the exercise page left with Back > Discard (the fields still hold the words discarded), or open with nothing
  // changed, then Use here in another window: no exercise words are kept for that window
  async exerciseLeft() {
    server(); await fns.boot(); await settle(); const out = {};
    const key = "backsquat"; fns.showExercise("Back squat", key);
    await W.winHooks.handOver(); out.untouched = onDevice() && onDevice().text; W.winHooks.shown && W.winHooks.shown();
    localStorage.removeItem(KEPT); newPage();
    fns.showExercise("Back squat", key); $("exSub").value = "High bar, heels on plates";
    $("back").click(); await wait(400); out.asked = !$("askSheet").hidden && $("askTitle").textContent; $("askYes").click(); await wait(100);
    out.page = fns.settingsPage().open;
    await W.winHooks.handOver(); out.discarded = onDevice() && onDevice().text;
    return out;
  },
  // v321, the twenty-seventh check round (tests lens), R26-WAP-3 for a sheet's words: window A kept the New folder sheet's half-typed name for this account; this page, which has not
  // taken it yet, goes out of sight with nothing typed (alone), or with the coach's notes box half typed (withNotes)
  async foldText() {
    server(); await fns.boot(); await settle(); const out = {};
    newPage(); keptBy("window-A", { text: { "name:folder:": "Strength block" } }); W.winHooks.hidden(); out.alone = onDevice(); W.winHooks.shown();
    newPage(); k.noteDraft.set(C, "Asked about his knee"); keptBy("window-A", { text: { "name:folder:": "Strength block" } }); W.winHooks.hidden(); out.withNotes = onDevice(); W.winHooks.shown();
    return out;
  },
  // R26-WAP-3 (with R26-TW-4's hidden hook): window A kept a half-written card note for this account; this page, which has not taken it yet, has
  // the coach's notes box half typed and goes out of sight; then it comes back still running Fiala
  async fold() {
    server(); await fns.boot(); await settle();
    newPage(); k.noteDraft.set(C, "Asked about his knee"); keptBy("window-A", { cards: [[WK + "/1", NOTE]], bases: [[WK + "/1", ""]] });
    W.winHooks.hidden(); const atHide = onDevice(), inPage = [...k.cardNoteDraft];
    W.winHooks.shown();
    return { atHide, inPage, afterShown: { left: localStorage.getItem(KEPT), inPage: [...k.cardNoteDraft] } };
  },
  // R26-WAP-3 / R26-WIN-4: window A kept a card note at Use here; this window B starts on one bar (every request 1.5 s) and, before its start has
  // taken the note, goes out of sight (or hands over again: Use here back in A); then its start ends
  async bootHidden() {
    const sb = server(); await fns.boot(); await settle();
    newPage(); keptBy("window-A", { cards: [[WK + "/1", NOTE]], bases: [[WK + "/1", ""]] });
    sb.delayMs = 1500; const booting = fns.boot(); await wait(300);
    const before = { signedIn: app.get().signedIn, taken: k.cardNoteDraft.size };
    if (process.argv[3] === "handover") await W.winHooks.handOver(); else W.winHooks.hidden();
    const atHook = onDevice();
    if (process.argv[3] === "handover") { const r = JSON.parse(localStorage.getItem(KEPT) || "null"); if (r) { r.tab = "window-A2"; localStorage.setItem(KEPT, JSON.stringify(r)); } newPage(); sb.delayMs = 0; fns.takeKept(COACH); }   // window A, started afresh (Use here there reloads), takes what B handed over
    await booting; sb.delayMs = 0; await settle();
    return { before, atHook, taken: [...k.cardNoteDraft], left: onDevice() };
  },
  // R26-WAP-3 with R26-WAP-4: the same, B on its workout page (the Client view) and its first sync failing: the note folded in as B went out of
  // sight is drawn by B's start, though no sync comes to draw it
  async bootHiddenFail() {
    const sb = server(); await fns.boot(); await settle();
    localStorage.setItem("fiala.trainings.view", JSON.stringify({ name: "training", id: WK })); fns.setPreview(true);
    newPage(); keptBy("window-A", { cards: [[WK + "/1", NOTE]], bases: [[WK + "/1", ""]] });
    sb.setFail({ table: "ft_trainings", op: "select", times: 1e6, message: "upstream connect error", code: "XX000" });
    sb.delayMs = 1500; const n0 = boxes(); const booting = fns.boot(); await wait(300);
    W.winHooks.hidden(); const folded = [...k.cardNoteDraft.keys()], drawnAtHide = boxes() - n0;
    await booting; sb.delayMs = 0; await settle(); await wait(50);
    return { folded, drawnAtHide, status: $("status").textContent, boxes: boxes() - n0 };
  },
  // R26-WIN-4 / R26-PRV-4 / R26-TW-8 (h_keepEmptyRemove): nothing typed in this page as it goes out of sight
  async empty() {
    server(); await fns.boot(); await settle(); const out = {};
    newPage(); lsSetKept(W.winTab()); W.winHooks.hidden(); out.own = onDevice();   // its own words from an earlier hide, saved since: they go
    newPage(); const other = keptBy("window-A", { cards: [[WK + "/1", NOTE]] }, JANE); W.winHooks.hidden(); out.otherAccount = localStorage.getItem(KEPT) === other;   // another account's words: they go, as before
    const role = localStorage.getItem("fiala.trainings.role"), was = { sessionEmail: app.get().sessionEmail, pendingOwner: app.get().pendingOwner };
    newPage(); app.set({ sessionEmail: "", pendingOwner: "" }); localStorage.removeItem("fiala.trainings.role");   // a page that knows no account yet
    const theirs = keptBy("window-A", { cards: [[WK + "/1", NOTE]] }); W.winHooks.hidden(); out.unknownOwner = localStorage.getItem(KEPT) === theirs;   // another window's words stay for the start that takes them
    app.set(was); localStorage.setItem("fiala.trainings.role", role);
    return out;
  },
  // R26-WAP-6: the page opened with no signal (carrying on offline); the coach types Jane's limits in Health & safety, the sheet still up, and
  // switches to another app (the words kept on the device); the signal comes back while he is away (the online event: the page signs in properly);
  // he comes back and saves; later Jane changes her limits; he opens that field again
  async retake() {
    const sb = server({ health: HEALTH }); await fns.boot(); await settle();
    app.set({ offline: true, offlineEntry: "remembered" });
    fns.editSafety(C, "limits"); $("textField").value = "Left knee: no lunges";
    W.winHooks.hidden(); const keptAway = onDevice() && onDevice().text;
    fireWin("online"); await wait(100); await settle();
    const afterSignIn = { signedIn: app.get().signedIn, offline: !!app.get().offline, keptText: [...k.keptText.keys()], left: !!onDevice() };
    W.winHooks.shown(); const sheet = $("textField").value;
    fns.setProfile(C, "health.limits", "Left knee: no lunges"); $("textNo").click(); await settle();   // his Save (what its onSave does), the sheet closed
    { const r = sb.tables.ft_clients.get(C); r.data = clone(r.data); r.data.health = { ...r.data.health, limits: "Knee fine now, lunges OK" }; r.updated_at = "2026-10-13T07:00:00Z"; }   // later Jane changes her limits on her phone
    await fns.syncDownNow(); await settle();
    $("textField").value = ""; fns.editSafety(C, "limits"); const boxNextTime = $("textField").value; $("textNo").click();
    return { keptAway, afterSignIn, sheet, boxNextTime };
  },
  // R26-WAP-4: window A kept a half-written card note; this window's start gets no session within 4 s (no signal): it carries on offline as the
  // coach, its workout page already drawn from the device copy (the Client view, where the note boxes are)
  async offlineCard() {
    const sb = server(); await fns.boot(); await settle();
    localStorage.setItem("fiala.trainings.view", JSON.stringify({ name: "training", id: WK })); fns.setPreview(true);
    newPage(); keptBy("window-A", { cards: [[WK + "/1", NOTE]], bases: [[WK + "/1", ""]] });
    sb.auth.getSession = () => new Promise(() => {});                    // the library still retrying the token
    const n0 = boxes(); let over = false; fns.boot().then(() => { over = true; });
    await until(() => over, 9000); await wait(50);
    return { entry: app.get().offlineEntry, view: app.get().view.name, drafts: [...k.cardNoteDraft.keys()], boxes: boxes() - n0 };
  },
  // R26-WAP-4: the same on Jane's page as the coach sees it, with his notes box kept by window A
  async offlineNotes() {
    const sb = server(); await fns.boot(); await settle();
    localStorage.setItem("fiala.trainings.view", JSON.stringify({ name: "client", id: C })); $("cNotes").value = "";
    newPage(); keptBy("window-A", { notes: [[C, "Asked about his knee"]] });
    sb.auth.getSession = () => new Promise(() => {});
    let over = false; fns.boot().then(() => { over = true; });
    await until(() => over, 9000); await wait(50);
    return { entry: app.get().offlineEntry, view: app.get().view.name, box: $("cNotes").value };
  },
  // R26-WAP-4: the same, the session read at once but the first sync failing ("Couldn't sync"): the pages already up stay as drawn
  async failCard() {
    const sb = server(); await fns.boot(); await settle();
    localStorage.setItem("fiala.trainings.view", JSON.stringify({ name: "training", id: WK })); fns.setPreview(true);
    newPage(); keptBy("window-A", { cards: [[WK + "/1", NOTE]], bases: [[WK + "/1", ""]] });
    sb.setFail({ table: "ft_trainings", op: "select", times: 1e6, message: "upstream connect error", code: "XX000" });
    const n0 = boxes(); await fns.boot(); await settle(); await wait(50);
    return { status: $("status").textContent, drafts: [...k.cardNoteDraft.keys()], boxes: boxes() - n0 };
  },
  // R26-WAP-7: the coach edits Back squat in his catalog (the line under its name, a video link), nothing saved; Use here in another window, which
  // opens again on that page; then the changes come back once; another kept change of it, then his Done with what he typed fresh
  async exercise() {
    const sb = server(); await fns.boot(); await settle();
    const key = "backsquat"; fns.showExercise("Back squat", key); const painted = { sub: $("exSub").value, video: $("exVideo").value };
    $("exSub").value = "High bar, heels on plates"; $("exVideo").value = "https://youtu.be/abc123xyz00";
    await W.winHooks.handOver();
    const kept = onDevice() && onDevice().text;
    { const r = JSON.parse(localStorage.getItem(KEPT) || "null"); if (r) { r.tab = "window-A"; localStorage.setItem(KEPT, JSON.stringify(r)); } }   // (window A is another page: its own tab)
    newPage(); $("exSub").value = ""; $("exVideo").value = ""; app.set({ syncedOnce: false });   // the window Fiala moved to: no sync yet, the page reopened as it was left
    await fns.boot(); await settle(); fns.render(); await wait(20);
    const newWindow = { page: fns.settingsPage().open, sub: $("exSub").value, video: $("exVideo").value };
    fns.showExercise("Back squat", key); const again = { sub: $("exSub").value, video: $("exVideo").value };   // opened again: given back once only
    k.keptText.set("exercise:" + key, JSON.stringify({ name: "Back squat", sub: "Kept from the other window", video: "" }));   // words kept for it, not given back (he typed on the page meanwhile)
    $("exVideo").value = "https://youtu.be/zzz999yyy11"; await fns.saveExercise(); await settle();   // Done: the link he typed fresh is saved
    const doneTo = fns.settingsPage().open, savedVideo = ((sb.tables.ft_exercise_videos.get(key) || {}).video_id) || null;
    fns.showExercise("Back squat", key); const afterSave = { sub: $("exSub").value, video: $("exVideo").value, keptLeft: k.keptText.has("exercise:" + key) };
    return { painted, kept, newWindow, again, doneTo, savedVideo, afterSave };
  },
  // R26-WAP-9: the coach flicks Jane's Weight wheel in Health details and Use here is pressed in another window while it still turns
  async wheel() {
    const sb = server({ health: HEALTH }); await fns.boot(); await settle();
    fns.go({ name: "client", id: C }); fns.showSub("health"); fns.toggleWheel("weight"); await wait(20);
    const col = made.filter((e) => e.className === "hd-col").pop(); if (!col) return { error: "no wheel" };
    col.isConnected = true; col.clientHeight = 230;
    const p = Math.round(87.3 * (Math.PI / 9) * 64) / 64, at = Number(col.scrollTop) || 0;
    fire(col, "pointerdown"); col.scrollTop = at + 12 * p; fire(col, "scroll");   // a person's flick: 12 rows on, still coasting (no rest yet)
    await W.winHooks.handOver(); const lost = loseTo();
    await wait(400); await settle();
    const q = queued(), rec = q && q.recs["clients/" + C];
    return { lost, dirty: !!q && q.dirty.includes("clients/" + C), weight: rec ? rec.bodyWeight || null : null, server: sb.tables.ft_clients.get(C).data.bodyWeight || null };
  },
  // R26-WIN-2: the coach restores a backup (its Legs renamed in the file) and taps Restore; Use here in another window while the restore's read is out
  async restore() {
    const RC = "8f0e7a52-1c3d-4b8e-9a6f-2d4c5b6a7e81", RW = "5b2d9c1e-7a4f-4e3b-8c6d-1f2e3a4b5c6d";   // (a backup holds the server's own kind of ids)
    const sb = server({ cid: RC, wid: RW }); await fns.boot(); await settle();
    const d = fns.backupData(); d.trainings[RW] = clone(d.trainings[RW]); d.trainings[RW].title = "Legs (from backup)";
    fire($("restoreFile"), "change", { target: { files: [{ text: async () => JSON.stringify(d) }], value: "x" } });
    const asked = await until(() => !$("askSheet").hidden && /Restore/.test($("askTitle").textContent), 8000); await wait(400);
    sb.delayMs = Number(process.argv[3] || 400);                          // one bar: every request takes 0.4 s
    $("askYes").click(); await wait(50);
    const reading = fns.restoreFlags().restoreRead, t0 = Date.now();
    await Promise.race([W.winHooks.handOver(), wait(4000)]); const handOverMs = Date.now() - t0, lost = loseTo();   // (win.js lets go after 4 s at the most)
    await wait(sb.delayMs * 4 + 500); sb.delayMs = 0; await wait(50);
    const q = queued(), rec = q && q.recs["trainings/" + RW];
    return { asked, reading, lost, handOverMs, queued: rec ? rec.title : null, server: sb.tables.ft_trainings.get(RW).data.title };
  },
  // R26-TW-8 (h_handBlur): a box still being typed in at Use here (its change is written as it is left)
  async blur() {
    server(); await fns.boot(); await settle();
    const box = live(ENV.el("input")); box.tagName = "INPUT"; box.blur = () => { const t = maps.trainings.get(WK); t.rows[0].rest = "60 sec"; fns.scheduleSave("trainings", WK); };   // as its own blur handler does: "60" becomes "60 sec", saved
    ENV.document.activeElement = box;
    await W.winHooks.handOver(); const lost = loseTo(); ENV.document.activeElement = null; await wait(50);
    const q = queued(), rec = q && q.recs["trainings/" + WK];
    return { lost, rest: rec ? rec.rows[0].rest : null };
  },
  // R26-WIN-6: window A shows the sign-in page and its Sign in is out; Use here in this window, which shows an empty sign-in page; then A's
  // sign-in lands (the library stores the session and tells this page SIGNED_IN, as auth-js tells the other tabs)
  async signIn() {
    const sb = server({ who: null }); await fns.boot(); await settle();
    const before = { shown: shown(), signedIn: app.get().signedIn };
    $("loginPassword").value = "something typed here";
    const n0 = sb.log.length; sb.landed(COACH); await until(() => app.get().signedIn && !app.get().entering, 4000); await settle();
    return { before, after: { shown: shown(), signedIn: app.get().signedIn, as: app.get().sessionEmail, coach: !app.get().clientMode, status: $("status").textContent, password: $("loginPassword").value }, roleChecks: calls(sb, n0).filter((c) => c === "trainers select").length, library: sb.who() };
  },
  // R26-WIN-6: this page's own Sign in (Jane's, slow) is out when the coach's sign-in in another window lands
  async signInOwn() {
    const sb = server({ who: null }); await fns.boot(); await settle();
    sb.signInMs = 800; signInForm(JANE); await wait(200);
    const n0 = sb.log.length; sb.landed(COACH); await wait(50);
    await until(() => app.get().signedIn && !app.get().entering && sb.who() === JANE, 6000); await settle(); await wait(100); await settle();
    return { library: sb.who(), page: app.get().sessionEmail, client: !!app.get().clientMode, roleChecks: calls(sb, n0).filter((c) => c === "trainers select").length };
  },
  // R26-WIN-6: SIGNED_IN where it must not sign the page in: the coach's pages up; the Create account page; the New password page (a reset link);
  // a sign-out still on its way (the library's answer later than 8 s, the token gone)
  async signInGuards() {
    const out = {};
    { const sb = server(); await fns.boot(); await settle(); const n0 = sb.log.length; sb.landed(JANE); await wait(300); await settle(); out.signedInPage = { as: app.get().sessionEmail, coach: !app.get().clientMode, roleChecks: calls(sb, n0).filter((c) => c === "trainers select").length }; }
    { const sb = server({ who: null }); await fns.boot(); await settle(); $("createBtn").click(); const page = shown(); sb.landed(COACH); await wait(300); await settle(); out.signUpPage = { page, shown: shown(), signedIn: app.get().signedIn }; }
    { const sb = server(); await fns.boot(); await settle(); sb.signOutMs = 9000; fns.signOut(); await wait(8600); const page = shown(); sb.as(null); sb.landed(JANE); await wait(300); out.signingOut = { page, signedIn: app.get().signedIn, signingOut: !!app.get().signingOut }; await wait(800); }
    { const sb = server({ who: JANE }); location.hash = "#access_token=made-up&type=recovery"; await fns.boot(); await settle(); const page = shown(); sb.landed(JANE); await wait(300); await settle(); out.recovery = { page, shown: shown(), signedIn: app.get().signedIn }; location.hash = ""; }
    return out;
  },
  // R26-PRV-4 (G): the coach's work waits (his session ended elsewhere); Jane signs in on this page and Use here is pressed in window B during her
  // role check; B, now Jane's, keeps her half-typed words on the device as it goes out of sight, and has made a workout this hour
  async lostSwitch() {
    const sb = server(); await fns.boot(); await settle();
    sb.setFail({ times: 1e6, message: "Failed to fetch" }); maps.clients.get(C).phone = "3105550199"; fns.scheduleSave("clients", C, 0); await settle();   // no signal: his change waits
    sb.ended(); await settle(); sb.setFail(null); app.set({ offline: false });
    const owner = app.get().pendingOwner; const undo = slowRole(sb, 1500);
    sb.as(JANE); const n0 = sb.log.length; signInForm(JANE); await wait(400);
    const lost = loseTo(), kept = keptBy("window-B", { notes: [[C, "Jane's words"]] }, JANE), madeHere = JSON.stringify({ tab: "window-B", ids: [["w9", Date.now()]] }); localStorage.setItem("fiala.made", madeHere);
    await wait(1600); await settle(); undo();
    return { owner, lost, keptLeft: localStorage.getItem(KEPT) === kept, madeLeft: localStorage.getItem("fiala.made") === madeHere, calls: calls(sb, n0).filter((c) => c !== "trainers select") };
  },
  // R26-WAP-8: Jane picks a new photo in this window on a slow connection (its upload takes 1.5 s); Use here in window B, which sends it and then
  // her second pick; then this window's upload comes back
  async photoLost() {
    const sb = server({ who: JANE });
    sb.rpcs.client_set_photo = async (a) => { const r = sb.tables.ft_clients.get(a.p_client); r.data = clone(r.data); if (a.p_photo) r.data.photo = a.p_photo; else delete r.data.photo; return null; };
    await fns.boot(); await settle();
    sb.storage.delayMs = 1500; await fns.setPhoto(C, new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], { type: "image/jpeg" }));
    await wait(200); const n0 = sb.log.length;
    await W.winHooks.handOver(); const lost = loseTo();
    await sb.rpcs.client_set_photo({ p_client: C, p_photo: "v2second" });   // window B: her second pick lands
    await wait(2000); await settle();
    return { client: !!app.get().clientMode, lost, fromHere: calls(sb, n0), photo: sb.tables.ft_clients.get(C).data.photo };
  },
  // R26-WAP-8: the photo cache, which every window shares: a pass still running at the move prunes nothing, and a photo read after the move
  // writes nothing into it
  async photoCache() {
    const sb = server(); await fns.boot(); await settle();
    const P = await import("../app/photos.js"), url = (v) => new URL("./__photos/" + C + "/" + v + ".jpg", location.href).href;
    cacheStore.set(url("hers-new"), "the photo window B shows"); maps.clients.get(C).photo = "hers-new";
    sb.storage.files.set("photos/" + C + "/old1.jpg", new Blob([new Uint8Array([1])], { type: "image/jpeg" }));
    sb.storage.delayMs = 800; P.forgetPhoto("c-gone"); await wait(100);   // a pass running (a deleted client's folder to list, slow)
    cacheStore.set(url("old0"), "an old version only window B still lists"); await W.winHooks.handOver(); const lost = loseTo(); const c0 = cacheLog.length;
    await wait(1200); sb.storage.delayMs = 0;
    await fns.loadPhoto(C, "old1"); await wait(100);                     // this window draws an old version after the move
    return { lost, cacheWrites: cacheLog.slice(c0), kept: [...cacheStore.keys()].map((u) => u.slice(u.lastIndexOf("/") + 1)) };
  },
  // R26-PRV-5 (the round 25 writers' held-out test): the coach's change of a client's phone and his new photo of her wait (no signal); his session
  // ends elsewhere; the Wi-Fi comes back while Jane's role check is out (the online event: photos.js's own pass), the check still failing; she taps
  // Sign out on "Couldn't reach the server"; the coach signs in again
  async photoWait() {
    const sb = server(); await fns.boot(); await settle(); await fns.resetPhotos();
    sb.setFail({ times: 1e6, message: "Failed to fetch" }); sb.storage.fail = { times: 1e6, message: "Failed to fetch" };
    maps.clients.get(C).phone = "3105550170"; fns.scheduleSave("clients", C, 0);
    await fns.setPhoto(C, new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], { type: "image/jpeg" })); await settle();
    const waits = { owner: app.get().pendingOwner, dirty: [...maps.dirty.keys()], photo: fns.photoQueue().has(C) };
    sb.ended(); await settle(); sb.setFail(null); sb.storage.fail = null; app.set({ offline: false });
    const undo = slowRole(sb, 1500, true); sb.as(JANE); signInForm(JANE); await wait(500); fireWin("online"); await wait(1300); await settle(); undo();
    const problem = { shown: shown(), signedIn: app.get().signedIn, photo: fns.photoQueue().has(C) };
    $("signout3").click(); await settle(); await wait(100);
    const tapped = { shown: shown(), signedIn: app.get().signedIn, owner: app.get().pendingOwner, dirty: [...maps.dirty.keys()], photo: fns.photoQueue().has(C) };
    sb.as(null); signInForm(COACH); await until(() => app.get().signedIn && app.get().sessionEmail === COACH && !app.get().entering, 6000); await settle(); await wait(300); await settle();
    const r = sb.tables.ft_clients.get(C).data;
    return { waits, problem, tapped, server: { phone: r.phone || null, photo: !!r.photo && sb.storage.files.has("photos/" + C + "/" + r.photo + ".jpg") } };
  },
  // R26-PRV-5 (the reset-link launch): the coach's new photo of her waits and the app is closed; Jane opens her password-reset link there and leaves
  // New password; the app is opened again: the device remembers the coach, the library holds Jane's session; the Wi-Fi comes back during her role
  // check, which cannot reach the server; she taps Sign out on "Couldn't reach the server"; the coach signs in
  async photoReset() {
    const sb = server(); await fns.boot(); await settle(); await fns.resetPhotos();
    sb.storage.fail = { times: 1e6, message: "Failed to fetch" };
    await fns.setPhoto(C, new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], { type: "image/jpeg" })); await settle();
    const waits = { owner: app.get().pendingOwner, photo: fns.photoQueue().has(C) };
    sb.storage.fail = null; sb.as(JANE);                                    // her link: the library holds her session now
    newPage(); app.set({ signedIn: false });
    const undo = slowRole(sb, 1500, true); const booting = fns.boot(); await wait(500); fireWin("online"); await booting; await wait(1300); await settle(); undo();
    const problem = { shown: shown(), as: app.get().sessionEmail, photo: fns.photoQueue().has(C) };
    $("signout3").click(); await settle(); await wait(100);
    sb.as(null); signInForm(COACH); await until(() => app.get().signedIn && app.get().sessionEmail === COACH && !app.get().entering, 6000); await settle(); await wait(300); await settle();
    const r = sb.tables.ft_clients.get(C).data;
    return { waits, problem, server: { photo: !!r.photo && sb.storage.files.has("photos/" + C + "/" + r.photo + ".jpg") } };
  },
  // R26-TW-4: the drafts add-on's other sheets (an exercise's instructions, New folder, New slide, Rename), kept and given back the next time that
  // sheet opens in the window Fiala moves to; a sheet left with Cancel keeps nothing; words given back to the coach's page never reach Jane's
  async sheets() {
    const sb = server({ templates: true, health: HEALTH }); await fns.boot(); await settle();
    const keptNow = (key) => (JSON.parse(localStorage.getItem(KEPT) || "{}").text || {})[key] || null;
    const moved = () => { const r = JSON.parse(localStorage.getItem(KEPT) || "null"); if (r) { r.tab = "window-A"; localStorage.setItem(KEPT, JSON.stringify(r)); } newPage(); fns.takeKept(COACH); };   // the window Fiala moves to (another page) takes them
    const out = {}, clear = () => { newPage(); localStorage.removeItem(KEPT); };
    clear(); fns.editNote(WK, "sq"); $("noteField").value = "Keep the back straight"; fns.keepTyping(); out.noteKept = keptNow("note:" + WK + "/sq"); $("noteNo").click();
    moved(); fns.editNote(WK, "sq"); out.noteBack = $("noteField").value; $("noteNo").click();
    clear(); fns.newFolder(null); $("askInput").value = "Strength block"; fns.keepTyping(); out.folderKept = keptNow("name:folder:"); $("askNo").click();
    moved(); fns.newFolder(null); out.folderBack = $("askInput").value; $("askNo").click();
    clear(); fns.newSlide("f1"); $("askInput").value = "Week 1"; fns.keepTyping(); out.slideKept = keptNow("name:slide:f1"); $("askNo").click();
    moved(); fns.newSlide("f1"); out.slideBack = $("askInput").value; $("askNo").click();
    clear(); fns.renameNode("f1"); $("askInput").value = "Strength 2026"; fns.keepTyping(); out.renameKept = keptNow("name:rename:f1"); $("askNo").click();
    moved(); fns.renameNode("f1"); out.renameBack = $("askInput").value; $("askNo").click();
    clear(); fns.editNote(WK, "sq"); $("noteField").value = "words left with Cancel"; $("noteNo").click(); W.winHooks.hidden(); out.noteCancel = keptNow("note:" + WK + "/sq");
    clear(); fns.newFolder(null); $("askInput").value = "a name left with Cancel"; $("askNo").click(); W.winHooks.hidden(); out.askCancel = keptNow("name:folder:");
    clear(); fns.editSafety(C, "limits"); $("textField").value = "words left with Cancel"; $("textNo").click(); W.winHooks.hidden(); out.textCancel = keptNow("safety:" + C + "/limits");
    clear(); await wait(20);
    // the coach's page holds words given back to it, not used yet, when Jane signs in on it (his work waiting)
    k.keptText.set("safety:" + C + "/limits", "his words about her knee"); app.set({ pendingOwner: COACH }); sb.as(JANE);
    await fns.boot(); await settle();
    out.jane = { client: !!app.get().clientMode, keptText: [...k.keptText.values()] };
    return out;
  },
  // R26-TW-8 (h_wipeClient): Jane's Sign out in a window that lost Fiala (its question answered before the move): nothing of hers leaves the device
  async lostClient() {
    server({ who: JANE }); await fns.boot(); await settle();
    const before = { client: !!app.get().clientMode, role: localStorage.getItem("fiala.trainings.role") };
    const lost = loseTo(); keptBy("window-B", { notes: [[C, "kept in window B"]] }, JANE); localStorage.setItem("fiala.made", JSON.stringify({ tab: "window-B", ids: [] }));
    const keys = ["fiala.trainings.role", "fiala.pending.v1", "fiala.made", KEPT], have = Object.fromEntries(keys.map((x) => [x, localStorage.getItem(x)]));
    await fns.signOut(); await settle();
    return { before, lost, signedIn: app.get().signedIn, left: keys.filter((x) => have[x] !== null && localStorage.getItem(x) === have[x]), had: keys.filter((x) => have[x] !== null) };
  },
  // R26-TW-8 (h_loseWake, h_holdWake): the coach on a workout keeps the screen on; Fiala moves to another window; then a tap in this window
  async wake() {
    let requests = 0, releases = 0;
    navigator.wakeLock = { request: async () => { requests++; return { released: false, release: async () => { releases++; }, addEventListener() {} }; } };
    server(); await fns.boot(); await settle();
    fns.go({ name: "training", id: WK }); await wait(50);
    const held = app.wake().held;
    const lost = loseTo(); W.winLost(); const afterLoss = { held: app.wake().held, releases };
    const r0 = requests; fireDoc("pointerdown"); await wait(50);
    return { held, lost, afterLoss, requestsAfterTap: requests - r0 };
  },
};
function lsSetKept(tab) { localStorage.setItem(KEPT, JSON.stringify({ owner: COACH, tab, at: Date.now(), text: {}, cards: [[WK + "/1", NOTE]], bases: [], notes: [] })); }
if (!modes[mode]) { console.log(JSON.stringify({ error: "no mode " + mode })); process.exit(0); }
const out = await modes[mode]().catch((e) => ({ error: String((e && e.stack) || e).slice(0, 800) }));
console.log(JSON.stringify(out));
process.exit(0);
