// verify-window (check round 27): the v321 app probe's harness (tests/win-app-r27-probe.mjs, unchanged), with this verifier's modes for the sign-in
// handling's amendments on top of the privacy verifier's fix (vprv27): the launch's late session (rev/window's guard: never over another email typed,
// the Create account page, or a sign-in of the page's own still out; such a session leaves the device), and a sign-in tapped while the library's
// sign-out of a sign-in this page did not make is still on its way (Sign in waits for it). Made-up people only. Run by vwin27.test.js, one mode
// per process: node tests/vwin27-probe.mjs <mode> [variant]. Prints one JSON line.
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
for (const id of ["restoreFile", "loginForm", "signout", "signout3", "createBtn", "askYes", "askNo", "noteOk", "noteNo", "textOk", "textNo"]) part(id);
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


const KEY = "sb-umurkxqswcjmubeucrzw-auth-token";
const modes = {
  // The launch cannot read the session within 4 s (no signal: the library retrying its refresh of the coach's sign-in the device still holds; no
  // account remembered): the sign-in page. [signup] the person taps Create account and types there; [typed] Jane types her own email; [busy] she
  // types her email and password and taps Sign in, which answers in 1.5 s (a sign-out of the library would answer in 2.5 s); [none] nothing typed.
  // Then the coach's session comes through.
  async late() {
    const v = process.argv[3] || "";
    const sb = server({ who: null }); localStorage.setItem(KEY, JSON.stringify({ access_token: "made-up", refresh_token: "made-up", expires_at: 1, user: { email: COACH } }));
    let release = null, first = true; const real = sb.auth.getSession;
    sb.auth.getSession = () => { if (!first) return real(); first = false; return new Promise((r) => { release = () => r({ data: { session: { user: { email: COACH } } }, error: null }); }); };
    let over = false; fns.boot().then(() => { over = true; }); await until(() => over, 9000);
    const before = shown();
    if (v === "signup") { $("createBtn").click(); $("suEmail").value = "mia@x.com"; $("suName").value = "Mia Newperson"; }
    if (v === "typed") $("loginEmail").value = JANE;
    if (v === "busy") { sb.signInMs = 1500; sb.signOutMs = 2500; signInForm(JANE); await wait(200); }   // (a sign-out of the library, if one started now, would answer after her sign-in: its end removes it)
    const n0 = sb.log.length; sb.as(COACH); release(); await wait(300); await settle();
    if (v === "busy") { await wait(3200); await until(() => app.get().signedIn && !app.get().entering && sb.who() === JANE, 4000); await settle(); await wait(100); await settle(); }
    return { before, after: shown(), signedIn: app.get().signedIn, as: app.get().sessionEmail || null, client: !!app.get().clientMode, library: sb.who(), roleChecks: calls(sb, n0).filter((c) => c === "trainers select").length };
  },
  // The same launch: the sign-in page, Jane's own email typed; then Use here in window B (this window loses Fiala); then the session comes through
  // here: this window, no longer running Fiala, does nothing with it (it never signs out the sign-in the device holds: it is the window in use's)
  async lateLost() {
    const sb = server({ who: null }); localStorage.setItem(KEY, JSON.stringify({ access_token: "made-up", refresh_token: "made-up", expires_at: 1, user: { email: COACH } }));
    let release = null, first = true; const real = sb.auth.getSession; let outs = 0; const so = sb.auth.signOut; sb.auth.signOut = (...a) => { outs++; return so(...a); };
    sb.auth.getSession = () => { if (!first) return real(); first = false; return new Promise((r) => { release = () => r({ data: { session: { user: { email: COACH } } }, error: null }); }); };
    let over = false; fns.boot().then(() => { over = true; }); await until(() => over, 9000);
    $("loginEmail").value = JANE; const lost = loseTo(); const n0 = sb.log.length;
    sb.as(COACH); release(); await wait(300); await settle();
    return { lost, after: shown(), signedIn: app.get().signedIn, library: sb.who(), signOuts: outs, calls: calls(sb, n0) };
  },
  // A sign-in of Jane's lands from the window that lost Fiala on this sign-in page, where Mia has typed her own email and password: it is signed out
  // on this device, and that answer is slow (1.5 s, a weak signal); Mia taps Sign in 300 ms after the landing
  async slowDrop() {
    const sb = server({ who: null }); await fns.boot(); await settle();
    sb.signOutMs = 1500; $("loginEmail").value = "mia@x.com"; $("loginPassword").value = "mias-own-pass-1";
    sb.landed(JANE); await wait(300);
    const during = { shown: shown(), signedIn: app.get().signedIn, signingOut: !!app.get().signingOut };
    fire($("loginForm"), "submit"); await wait(2600); await until(() => app.get().signedIn && !app.get().entering, 4000); await settle(); await wait(300); await settle();
    return { during, after: shown(), signedIn: app.get().signedIn, as: app.get().sessionEmail || null, library: sb.who(), msg: $("loginMsg").textContent };
  },
  // The coach's pages are up with a change of his waiting (no signal for saves); Jane's sign-in lands under them (the page stops, her sign-in is signed
  // out on this device, slowly: 1.5 s); the signal is back and he signs in again at once
  async slowStop() {
    const sb = server(); await fns.boot(); await settle();
    sb.setFail({ times: 1e6, message: "Failed to fetch" }); maps.clients.get(C).phone = "3105550111"; fns.scheduleSave("clients", C, 0); await settle(); sb.setFail(null); app.set({ offline: false });
    sb.signOutMs = 1500; sb.landed(JANE); await wait(300);
    const stopped = { shown: shown(), signedIn: app.get().signedIn, msg: $("loginMsg").textContent, waiting: [...maps.dirty.keys()], owner: app.get().pendingOwner };
    signInForm(COACH); await wait(2600); await until(() => app.get().signedIn && !app.get().entering, 4000); await settle(); await wait(300); await settle();
    return { stopped, after: shown(), signedIn: app.get().signedIn, as: app.get().sessionEmail || null, library: sb.who(), waiting: [...maps.dirty.keys()], phone: sb.tables.ft_clients.get(C).data.phone || null };
  },
};
if (!modes[mode]) { console.log(JSON.stringify({ error: "no mode " + mode })); process.exit(0); }
const out = await modes[mode]().catch((e) => ({ error: String((e && e.stack) || e).slice(0, 800) }));
console.log(JSON.stringify(out));
process.exit(0);
