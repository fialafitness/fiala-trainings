// Verifier (privacy, round 27): R27-PRV-1/2/3 on the real main.js, sync.js, photos.js and win.js, as tests/win-app-r27-probe.mjs runs them (its setup
// copied below, lines 19-106), with a stand-in server of my own: two made-up clients (Jane c1, Mia c2) and the coach, client_my_data by the
// session the library holds, every call logged with that account. sb.landed(email) is what the real supabase-js 2.117.2 does in this page when a
// sign-in lands in another tab (measured in rl/lib1.mjs: the session stored, SIGNED_IN with it told to every tab). One mode per process.
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

const norm = (s) => String(s || "").trim().toLowerCase();
const MIA = "mia@x.com";
function server2(who) {
  const sb = makeSupabase(); let session = who; const seen = [];
  const trainers = () => { sb.tables.trainers = new Map(session === COACH ? [["t1", { id: "t1", email: COACH }]] : []); };
  sb.auth.getSession = async () => ({ data: { session: session ? { user: { email: session } } : null }, error: null });
  sb.auth.getUser = async () => ({ data: { user: session ? { email: session } : null }, error: null });
  sb.auth.onAuthStateChange = (cb) => { sb.told = cb; return { data: { subscription: { unsubscribe() {} } } }; };
  sb.auth.stopAutoRefresh = () => {};
  sb.signInMs = 0; sb.auth.signInWithPassword = async ({ email }) => { if (sb.signInMs) await wait(sb.signInMs); session = norm(email); trainers(); if (sb.told) sb.told("SIGNED_IN", { user: { email: session } }); return { data: { session: { user: { email: session } } }, error: null }; };
  sb.signOuts = 0; sb.auth.signOut = async () => { sb.signOuts++; session = null; trainers(); if (sb.told) sb.told("SIGNED_OUT", null); return { error: null }; };   // as 2.117.2: the stored session goes even offline, SIGNED_OUT told
  sb.landed = (email) => { session = email; trainers(); if (sb.told) sb.told("SIGNED_IN", { user: { email } }); };
  sb.ended = () => { session = null; trainers(); if (sb.told) sb.told("SIGNED_OUT", null); };
  sb.as = (e) => { session = e; trainers(); }; sb.who = () => session; sb.seen = seen;
  const rpc0 = sb.rpc; sb.rpc = (n, a) => { seen.push(n + " as " + (session || "anon")); return rpc0(n, a); };
  const from0 = sb.from; sb.from = (t) => { seen.push(t + " as " + (session || "anon")); return from0(t); };
  trainers();
  const rows = (id) => [{ id: id + "a", label: "1", name: "Back squat", sets: 3, reps: "8", rest: "", weights: [], repsDone: [], setsDone: 0, done: false, note: "", alts: [], unit: "lb" }];
  sb.seed("ft_clients", "c1", { id: "c1", name: "Jane Testperson", unit: "lb", email: JANE });
  sb.seed("ft_clients", "c2", { id: "c2", name: "Mia Madeup", unit: "kg", email: MIA });
  sb.seed("ft_trainings", "w1", { id: "w1", clientId: "c1", title: "Legs", date: day(0), createdAt: "2026-11-10T16:00:00.000Z", completedAt: null, skippedAt: null, rows: rows("w1") }, { client_id: "c1" });
  sb.seed("ft_trainings", "w2", { id: "w2", clientId: "c2", title: "Upper", date: day(0), createdAt: "2026-11-10T16:00:00.000Z", completedAt: null, skippedAt: null, rows: rows("w2") }, { client_id: "c2" });
  sb.rpcs.client_my_data = async () => { const c = [...sb.tables.ft_clients.values()].find((x) => x.data.email === session); if (!c) return { clients: [], trainings: [] }; return { clients: [{ id: c.id, data: clone(c.data), updated_at: c.updated_at }], trainings: [...sb.tables.ft_trainings.values()].filter((t) => t.client_id === c.id).map((t) => ({ id: t.id, data: clone(t.data), updated_at: t.updated_at })) }; };
  for (const n of ["client_set_zone", "client_set_profile", "client_log_set", "client_set_weights", "client_set_done", "client_skip_training", "client_miss_training", "client_finish_training"]) sb.rpcs[n] = async () => null;
  globalThis.supabase = { createClient: () => sb };
  return sb;
}
const asOther = (sb, from, who) => sb.seen.slice(from).filter((c) => c.endsWith(" as " + who));
const view = () => ({ shown: shown(), signedIn: !!app.get().signedIn, as: app.get().sessionEmail || "", msg: $("loginMsg").textContent || "" });
const modes = {
  // R27-PRV-1: Mia's own email (and password) typed on this idle sign-in page (Use here a moment ago); Jane's sign-in lands from the window that lost Fiala
  async typed() {
    const sb = server2(null); await fns.boot(); await settle();
    $("loginEmail").value = MIA; $("loginPassword").value = "mia's own password";
    const n0 = sb.seen.length; sb.landed(JANE); await wait(400); await settle();
    return { ...view(), email: $("loginEmail").value, password: !!$("loginPassword").value, asJane: asOther(sb, n0, JANE), library: sb.who(), signOuts: sb.signOuts };
  },
  // R27-PRV-1: the same, nothing typed yet on this sign-in page (Mia has just tapped Use here)
  async empty() {
    const sb = server2(null); await fns.boot(); await settle();
    const n0 = sb.seen.length; sb.landed(JANE); await wait(400); await settle();
    return { ...view(), asJane: asOther(sb, n0, JANE), library: sb.who(), signOuts: sb.signOuts };
  },
  // R26-WIN-6's own case, kept: the person whose sign-in landed typed their own email again here (Jane, letters in another case, spaces around)
  async same() {
    const sb = server2(null); await fns.boot(); await settle();
    $("loginEmail").value = " Jane@X.com "; $("loginPassword").value = "typed again";
    sb.landed(JANE); await until(() => app.get().signedIn && !app.get().entering, 4000); await settle();
    return { ...view(), client: !!app.get().clientMode, password: $("loginPassword").value, library: sb.who(), signOuts: sb.signOuts };
  },
  // R27-PRV-2: Mia's pages up (signed in); Jane's sign-in lands from the window that lost Fiala; then this page's next sync (its focus) and a Skip tap
  async under() {
    const sb = server2(MIA); await fns.boot(); await settle();
    const before = view(); const n0 = sb.seen.length;
    sb.landed(JANE); await wait(50); fireWin("focus"); await wait(800); await settle();
    let skip = "no page"; if (app.get().signedIn) { const t = [...maps.trainings.values()].find((x) => x && !x.skippedAt); if (t) { fns.setSkipped(true, "Sick", t.id); skip = t.id; } await wait(300); await settle(); }
    return { before, after: view(), asJane: asOther(sb, n0, JANE), skip, library: sb.who(), signOuts: sb.signOuts, trainings: [...maps.trainings.keys()] };
  },
  // R27-PRV-2 with work waiting: Mia logged a weight that has not reached the server (its call fails); Jane's sign-in lands: the page stops, and
  // Mia's change is still on the device for her, sent as Mia once she signs in again
  async underWork() {
    const sb = server2(MIA); await fns.boot(); await settle();
    let down = true; sb.rpcs.client_skip_training = async () => { if (down) throw Object.assign(new Error("Failed to fetch"), { code: "0" }); return null; };   // her Skip cannot reach the server yet (no signal)
    fns.setSkipped(true, "Busy", "w2"); await wait(400); await settle();
    const before = { ...view(), waiting: [...maps.dirty.keys()] }; const n0 = sb.seen.length;
    sb.landed(JANE); await wait(100); fireWin("focus"); await wait(600); await settle();
    const after = { ...view(), waiting: [...maps.dirty.keys()], owner: app.get().pendingOwner, queued: (JSON.parse(localStorage.getItem("fiala.pending.v1") || "null") || {}).dirty || null };
    down = false; sb.as(null);
    signInForm(MIA); await until(() => app.get().signedIn && !app.get().entering, 4000); await wait(300); await settle();
    return { before, after, asJane: asOther(sb, n0, JANE), again: { ...view(), waiting: [...maps.dirty.keys()] }, sentAsMia: sb.seen.slice(n0).filter((c) => /^client_skip_training as mia@x\.com$/.test(c)).length, library: sb.who() };
  },
  // R27-PRV-2 during the page's own start: Mia's Sign in is out (its role check slow); Jane's sign-in lands during it
  async entering() {
    const sb = server2(null); await fns.boot(); await settle();
    slowRole(sb, 1200); signInForm(MIA); await wait(300);
    const mid = { entering: !!app.get().entering, as: app.get().sessionEmail };
    const n0 = sb.seen.length; sb.landed(JANE); await wait(2500); await settle(); fireWin("focus"); await wait(800); await settle();
    return { mid, after: view(), asJane: asOther(sb, n0, JANE), library: sb.who(), signOuts: sb.signOuts };
  },
  // R27-PRV-3: the coach's read is out (1.5 s a table call) when his session ends elsewhere; Jane signs in on the sign-in page before it ends
  async oldRead() {
    const sb = server2(COACH); await fns.boot(); await settle();
    sb.delayMs = 1500; fireWin("focus"); await wait(450);
    const out0 = !!app.get().syncing;
    sb.ended(); await wait(50); const signInPage = shown();
    sb.delayMs = 0; signInForm(JANE);
    await until(() => app.get().signedIn && app.get().sessionEmail === JANE && !app.get().entering, 8000);
    const t0 = Date.now(); const drawn = await until(() => shown().includes("vClient"), 9000);
    return { out0, signInPage, as: app.get().sessionEmail, client: !!app.get().clientMode, shown: shown(), drawnAfterMs: drawn ? Date.now() - t0 : null, myData: sb.seen.filter((c) => c === "client_my_data as " + JANE).length };
  },
};
if (!modes[mode]) { console.log(JSON.stringify({ error: "no mode " + mode })); process.exit(0); }
const out = await modes[mode]().catch((e) => ({ error: String((e && e.stack) || e).slice(0, 800) }));
console.log(JSON.stringify(out));
process.exit(0);
