// verify-signin (check round 28, the sign-in lens's verifier): the v321 app probe's harness (tests/rw27-probe.mjs's, unchanged but for the New
// password and Create account forms made live), with a stand-in for supabase-js 2.117.2 that keeps the sign-in as the real one does (in
// localStorage under its own key, shared by the browser's windows; its signOut with a sign-in stored answers its /logout first, then removes
// whatever is stored then; checked in headless Chrome against the real library: the verifier's rl/lib-drop.mjs). Run by vsig28.test.js, one mode
// per process: node tests/vsig28-probe.mjs <mode>. Prints one JSON line. Made-up people only. Modes:
//  - recOwn, recOwnLands, recOwnNoSession(Slow) (R28-SIG-1 kept): Mia's own reset link, with her own sign-in landing from the other window;
//  - recLands, recSilent, recNoSession(Slow) (R28-SIG-1): Jane's sign-in lands under Mia's New password page (told, or with no word of it);
//  - linkLost(Slow): Mia's link whose one check is lost while the device holds the coach's sign-in;
//  - signupIdle (R28-SIG-3), signupBusy (R28-SIG-4's Create account case): Jane's sign-in lands on the Create account page;
//  - failLands, failSame, failLate (R28-SIG-4): a Sign in of the page's own fails while another sign-in landed or the launch's late session came;
//  - dropFirst, stopFirst, outLands (R28-SIG-2, R28-SIG-5): a sign-in this page did not make leaves the device at once, whatever its sign-out's answer;
//  - notesCleared, cardCleared (R28-SIG-6): a note box typed in and emptied by hand during a slow start.
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
for (const id of ["restoreFile", "loginForm", "signout", "signout3", "createBtn", "askYes", "askNo", "noteOk", "noteNo", "textOk", "textNo", "cNotes", "recoveryForm", "signupForm", "suDoneBtn", "suBack"]) part(id);   // verify-signin: the New password and Create account forms live too
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
const OLD = "Knee sore since Monday", NEW = "Knee sore since Monday, ice after every session";   // the notes box: kept in window A, then typed in B

// ---------- verify-signin (round 28): the library as supabase-js 2.117.2 keeps a sign-in (checked in headless Chrome with the real library) ----------
// The sign-in lives in localStorage under the library's own key, shared by every window of the browser. signOut: with a sign-in stored, its
// /logout first (logoutMs), then whatever is stored THEN goes and the page is told SIGNED_OUT; with none stored, at once. updateUser acts on
// whatever is stored when it is called. Another window's sign-in: stored, then this page told SIGNED_IN (BroadcastChannel); `replaced`: stored with
// no word to this page (a browser without BroadcastChannel, a tab asleep). A reset link: the launch's first read takes the link's session (unless
// its one check is lost on a weak signal), then the library tells PASSWORD_RECOVERY with it. admin.signOut(token, scope): the request the
// library's own signOut sends, logged. Made-up people only.
const KEY = "sb-umurkxqswcjmubeucrzw-auth-token", MIA = "mia@x.com", C2 = "c2", WK2 = "w2";
const IDS = { [COACH]: "11111111-1111-4111-8111-111111111111", [JANE]: "22222222-2222-4222-8222-222222222222", [MIA]: "33333333-3333-4333-8333-333333333333" };
const PASS = { [COACH]: "coach-pass-1", [JANE]: "jane-pass-1", [MIA]: "mia-pass-2" };
const jwt = (email, sid) => "h." + Buffer.from(JSON.stringify({ sub: IDS[email], email, session_id: sid })).toString("base64url") + ".s";
const OUTW = "Signed out. Sign in again to keep syncing.", LINK = "That link did not work. Ask for a new one.";
function world({ held = null, link = null, firstMs = 0, eventSession = true } = {}) {
  const sb = makeSupabase(); let told = null, n = 0; const L = (sb.authLog = []), toks = new Map();
  const stored = () => { try { return JSON.parse(localStorage.getItem(KEY) || "null"); } catch (_) { return null; } };
  sb.stored = () => { const x = stored(); return x && x.user ? x.user.email : null; };
  const trainers = () => { sb.tables.trainers = new Map(sb.stored() === COACH ? [["t1", { id: "t1", email: COACH }]] : []); };   // row-level security: the coach's row shows to him alone
  const from0 = sb.from; sb.reads = []; sb.from = (t) => { sb.reads.push(t + " as " + (sb.stored() || "nobody")); if (t === "trainers") trainers(); return from0(t); };
  const rpc0 = sb.rpc; sb.rpc = (name, args) => { sb.reads.push(name + " as " + (sb.stored() || "nobody")); return rpc0(name, args); };
  const mint = (email) => { const sid = "s" + (++n), access_token = jwt(email, sid); toks.set(access_token, email); return { access_token, refresh_token: "rt-" + sid, token_type: "bearer", expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, user: { id: IDS[email], email } }; };
  const store = (x) => { localStorage.setItem(KEY, JSON.stringify(x)); trainers(); return x; };
  const tell = (ev, x) => { if (told) told(ev, x ? JSON.parse(JSON.stringify(x)) : null); };
  sb.signInMs = 0; sb.logoutMs = 0; sb.signUpMs = 0;
  let first = true, linkSession = null;
  if (link) { linkSession = mint(link.email); location.hash = "#access_token=" + linkSession.access_token + "&expires_at=" + linkSession.expires_at + "&expires_in=3600&refresh_token=" + linkSession.refresh_token + "&token_type=bearer&type=recovery"; }
  if (held) store(mint(held));
  sb.auth = {
    getSession: async () => {
      if (first) { first = false; if (firstMs) await wait(firstMs); if (link && !link.lost) { store(linkSession); setTimeout(() => tell("PASSWORD_RECOVERY", eventSession ? linkSession : null), 0); } }
      return { data: { session: stored() }, error: null };
    },
    getUser: async () => { const x = stored(); return x ? { data: { user: x.user }, error: null } : { data: { user: null }, error: { name: "AuthSessionMissingError", message: "Auth session missing!" } }; },
    onAuthStateChange: (cb) => { told = cb; return { data: { subscription: { unsubscribe() {} } } }; },
    stopAutoRefresh: () => {}, startAutoRefresh: () => {},
    signInWithPassword: async ({ email, password }) => { const e = String(email || "").trim().toLowerCase(); L.push("sign-in " + e); if (sb.signInMs) await wait(sb.signInMs); if (PASS[e] !== password) return { data: { session: null, user: null }, error: { name: "AuthApiError", status: 400, message: "Invalid login credentials" } }; const x = store(mint(e)); tell("SIGNED_IN", x); return { data: { session: x, user: x.user }, error: null }; },
    signUp: async ({ email }) => { L.push("sign-up " + email); if (sb.signUpMs) await wait(sb.signUpMs); return { data: { user: { id: "44444444-4444-4444-8444-444444444444", email, identities: [{ id: "i1" }] }, session: null }, error: null }; },   // a confirmation link sent: no sign-in made
    signOut: async () => { const x = stored(); if (x) { L.push("library /logout as " + (toks.get(x.access_token) || "?")); if (sb.logoutMs) await wait(sb.logoutMs); } localStorage.removeItem(KEY); trainers(); tell("SIGNED_OUT", null); return { error: null }; },
    updateUser: async ({ password }) => { const x = stored(); if (!x) return { data: { user: null }, error: { name: "AuthSessionMissingError", message: "Auth session missing!" } }; L.push("password set for " + x.user.email); return { data: { user: x.user }, error: null }; },
    admin: { signOut: async (tok, scope) => { L.push("side /logout as " + (toks.get(tok) || "?") + " " + scope); if (sb.logoutMs) await wait(sb.logoutMs); return { data: null, error: null }; } },
  };
  sb.landed = (email) => tell("SIGNED_IN", store(mint(email)));   // another window's sign-in: stored on the device, this page told
  sb.replaced = (email) => store(mint(email));                    // the same with no word to this page
  sb.ended = () => { localStorage.removeItem(KEY); trainers(); tell("SIGNED_OUT", null); };   // the session ended elsewhere
  trainers();
  sb.seed("ft_clients", C, { id: C, name: "Jane Testperson", unit: "lb", email: JANE, ...HEALTH });
  sb.seed("ft_clients", C2, { id: C2, name: "Mia Testperson", unit: "kg", email: MIA, ...HEALTH });
  const ROW = (id, name) => ({ id, label: "1", name, sets: 3, reps: "8", rest: "", weights: [], repsDone: [], setsDone: 0, done: false, note: "", alts: [], unit: "lb" });
  sb.seed("ft_trainings", WK, { id: WK, clientId: C, title: "Legs", date: day(2), createdAt: "2026-11-10T16:00:00.000Z", completedAt: null, skippedAt: null, rows: [ROW("sq", "Back squat")] }, { client_id: C });
  sb.seed("ft_trainings", WK2, { id: WK2, clientId: C2, title: "Upper", date: day(2), createdAt: "2026-11-10T16:00:00.000Z", completedAt: null, skippedAt: null, rows: [ROW("bp", "Bench press")] }, { client_id: C2 });
  sb.rpcs.client_my_data = async () => { const me = [...sb.tables.ft_clients.values()].find((c) => c.data.email === sb.stored()); if (!me) return { clients: [], trainings: [] }; return { clients: [{ id: me.id, data: (({ notes, ...rest }) => rest)(clone(me.data)), updated_at: me.updated_at }], trainings: [...sb.tables.ft_trainings.values()].filter((t) => t.client_id === me.id).map((t) => ({ id: t.id, data: clone(t.data), updated_at: t.updated_at })) }; };
  sb.rpcs.client_set_zone = async () => null; sb.rpcs.client_set_profile = async () => null;
  globalThis.supabase = { createClient: () => sb };
  return sb;
}
const look = (sb) => ({ shown: shown(), signedIn: app.get().signedIn, as: app.get().sessionEmail || null, msg: $("loginMsg").textContent, stored: sb.stored() });
const said = (sb, re) => sb.authLog.filter((x) => re.test(x));
const savePassword = async () => { $("recoveryPassword").value = "made-up-new-pass-9"; $("recoveryPassword2").value = "made-up-new-pass-9"; fire($("recoveryForm"), "submit"); await wait(300); await settle(); await wait(100); await settle(); };
const bootUp = async (ms = 9000) => { let over = false; fns.boot().then(() => { over = true; }, () => { over = true; }); await until(() => over, ms); await settle(); await wait(50); };
const fill = (email, password) => { $("loginEmail").value = email; $("loginPassword").value = password; };

const modes = {
  // R28-SIG-1 and the link's own cases: a reset link opened in this window (it took Fiala; another window had a sign-in out)
  async recOwn() {   // Mia's own link: New password, Save: her password is set, her pages open
    const sb = world({ link: { email: MIA } }); await bootUp(); const page = shown();
    await savePassword(); return { page, set: said(sb, /password set/), ...look(sb) };
  },
  async recLands() {   // Jane's sign-in, out in the window that lost Fiala, lands while Mia's New password page is up; then Save is tapped (base: as Jane)
    const sb = world({ link: { email: MIA } }); await bootUp(); const page = shown();
    sb.landed(JANE); const atOnce = sb.stored(); await wait(50); await settle(); const after = look(sb);
    if (!$("vRecovery").hidden) await savePassword();
    return { page, atOnce, after, set: said(sb, /password set/), side: said(sb, /side/), library: said(sb, /library/), readsAsJane: sb.reads.filter((x) => x.endsWith(" as " + JANE)), ...look(sb) };
  },
  async recSilent() {   // the same with no word to this page (no BroadcastChannel, or a tab asleep): Save finds Jane's sign-in stored
    const sb = world({ link: { email: MIA } }); await bootUp(); const page = shown();
    sb.replaced(JANE); await savePassword();
    return { page, set: said(sb, /password set/), side: said(sb, /side/), readsAsJane: sb.reads.filter((x) => x.endsWith(" as " + JANE)), ...look(sb) };
  },
  async recOwnLands() {   // Mia's own sign-in (she also signed in in the other window) lands under her New password page: it stays, Save sets her password
    const sb = world({ link: { email: MIA } }); await bootUp(); const page = shown();
    sb.landed(MIA); await wait(50); await settle(); const after = shown(); await savePassword();
    return { page, after, set: said(sb, /password set/), side: said(sb, /side/), ...look(sb) };
  },
  async recNoSession() {   // the library's PASSWORD_RECOVERY carrying no session (as older stand-ins tell it): the launch read the link's account; Jane lands
    const sb = world({ link: { email: MIA }, eventSession: false }); await bootUp(); const page = shown();
    sb.landed(JANE); await wait(50); await settle(); if (!$("vRecovery").hidden) await savePassword();
    return { page, set: said(sb, /password set/), ...look(sb) };
  },
  async recNoSessionSlow() {   // the same when the launch's read took longer than 4 s (the sign-in page first, then New password)
    const sb = world({ link: { email: MIA }, eventSession: false, firstMs: 4500 }); await bootUp(12000); await until(() => !$("vRecovery").hidden, 3000); await wait(50); const page = shown();
    sb.landed(JANE); await wait(50); await settle(); if (!$("vRecovery").hidden) await savePassword();
    return { page, set: said(sb, /password set/), ...look(sb) };
  },
  async recOwnNoSession() {   // the same event with no session, and Mia's own sign-in landing from the other window: her New password page stays, Save sets her password
    const sb = world({ link: { email: MIA }, eventSession: false }); await bootUp(); const page = shown();
    sb.landed(MIA); await wait(50); await settle(); const after = shown(); if (!$("vRecovery").hidden) await savePassword();
    return { page, after, set: said(sb, /password set/), ...look(sb) };
  },
  async recOwnNoSessionSlow() {   // the same with the launch's read slower than 4 s
    const sb = world({ link: { email: MIA }, eventSession: false, firstMs: 4500 }); await bootUp(12000); await until(() => !$("vRecovery").hidden, 3000); await wait(50); const page = shown();
    sb.landed(MIA); await wait(50); await settle(); const after = shown(); if (!$("vRecovery").hidden) await savePassword();
    return { page, after, set: said(sb, /password set/), ...look(sb) };
  },
  async linkLost() {   // the device holds the coach's sign-in; Mia's link opens and its one check is lost: the library keeps the coach's sign-in (base: New password over it)
    const sb = world({ held: COACH, link: { email: MIA, lost: true } }); await bootUp(); const page = look(sb);
    if (!$("vRecovery").hidden) await savePassword();
    return { page, set: said(sb, /password set/), side: said(sb, /side/), ...look(sb) };
  },
  async linkLostSlow() {   // the same with the launch's read slower than 4 s
    const sb = world({ held: COACH, link: { email: MIA, lost: true }, firstMs: 4500 }); await bootUp(12000); await wait(700); await settle(); const page = look(sb);
    if (!$("vRecovery").hidden) await savePassword();
    return { page, set: said(sb, /password set/), side: said(sb, /side/), ...look(sb) };
  },
  // R28-SIG-3: the Create account page
  async signupIdle() {   // Mia is typing on Create account when Jane's sign-in lands from the other window
    const sb = world(); await bootUp(); $("createBtn").click(); $("suName").value = "Mia Testperson"; $("suEmail").value = MIA; const page = shown();
    sb.landed(JANE); const atOnce = sb.stored(); await wait(50); await settle();
    return { page, atOnce, name: $("suName").value, side: said(sb, /side/), readsAsJane: sb.reads.filter((x) => x.endsWith(" as " + JANE)), ...look(sb) };
  },
  async signupBusy() {   // Mia's Create account is out (a slow answer: a confirmation link sent) when Jane's sign-in lands
    const sb = world(); await bootUp(); $("createBtn").click();
    for (const [id, v] of [["suName", "Mia Testperson"], ["suEmail", "mia.new@x.com"], ["suPhone", "3105550123"], ["suPassword", "mias-new-pass-1"], ["suPassword2", "mias-new-pass-1"]]) $(id).value = v;
    sb.signUpMs = 1500; fire($("signupForm"), "submit"); await wait(300); const during = { shown: shown(), busy: !!$("suBtn").disabled };
    sb.landed(JANE); await wait(1600); await settle(); await wait(50); await settle();
    return { during, done: !$("suDone").hidden, side: said(sb, /side/), readsAsJane: sb.reads.filter((x) => x.endsWith(" as " + JANE)), ...look(sb) };
  },
  // R28-SIG-4: a Sign in of the page's own that fails
  async failLands() {   // Mia's Sign in is out (a mistyped password, a slow answer) when Jane's sign-in lands from the other window
    const sb = world(); await bootUp(); fill(MIA, "mia-pass-typo"); sb.signInMs = 1500; fire($("loginForm"), "submit"); await wait(300);
    sb.landed(JANE); await wait(1500); await settle(); await wait(50); await settle();
    return { side: said(sb, /side/), readsAsJane: sb.reads.filter((x) => x.endsWith(" as " + JANE)), ...look(sb) };
  },
  async failSame() {   // the same with Mia's own sign-in landing from the other window: her failed Sign in then goes in with it (R26-WIN-6, the email typed names it)
    const sb = world(); await bootUp(); fill(MIA, "mia-pass-typo"); sb.signInMs = 1500; fire($("loginForm"), "submit"); await wait(300);
    sb.landed(MIA); await wait(1500); await settle(); await wait(50); await settle();
    return { side: said(sb, /side/), password: $("loginPassword").value, ...look(sb) };
  },
  async failLate() {   // the launch cannot read the coach's sign-in within 4 s (no account remembered): the sign-in page; Jane taps Sign in with a mistyped password; the late session comes while hers is out; hers fails
    const sb = world({ held: COACH, firstMs: 4500 }); let over = false; fns.boot().then(() => { over = true; }); await until(() => over, 9000); const page = shown();
    fill(JANE, "jane-pass-typo"); sb.signInMs = 1500; fire($("loginForm"), "submit"); await wait(2500); await settle(); await wait(50); await settle();
    return { page, side: said(sb, /side/), readsAsCoach: sb.reads.filter((x) => x.endsWith(" as " + COACH)).length, ...look(sb) };
  },
  // R28-SIG-2 and R28-SIG-5: what a sign-in this page did not make leaves, and when
  async dropFirst() {   // Mia typed her email and password; Jane's sign-in lands; the sign-out answers in 10 s; Mia taps Sign in 300 ms after the landing
    const sb = world(); await bootUp(); fill(MIA, PASS[MIA]); sb.logoutMs = 10000;
    sb.landed(JANE); await wait(50); const atOnce = sb.stored(); await wait(250); const t0 = Date.now(); fire($("loginForm"), "submit");
    await until(() => app.get().signedIn && !app.get().entering, 12000); const inMs = Date.now() - t0; await settle(); const inNow = look(sb);
    await wait(Math.max(0, 10600 - (Date.now() - t0))); await settle();
    return { atOnce, inMs, inNow, side: said(sb, /side/), library: said(sb, /library/), ...look(sb) };
  },
  async stopFirst() {   // the coach's pages are up; Jane's sign-in lands under them (the stop); the sign-out answers in 10 s; he signs in again at once
    const sb = world({ held: COACH }); await bootUp(); const before = look(sb); sb.logoutMs = 10000;
    sb.landed(JANE); const atOnce = sb.stored(); await wait(300); const stopped = look(sb); fill(COACH, PASS[COACH]); const t0 = Date.now(); fire($("loginForm"), "submit");
    await until(() => app.get().signedIn && !app.get().entering, 12000); const inMs = Date.now() - t0; await settle();
    await wait(Math.max(0, 10600 - (Date.now() - t0))); await settle();
    return { before, atOnce, stopped, inMs, side: said(sb, /side/), ...look(sb) };
  },
  async outLands() {   // the coach taps Sign out (its answer 3 s away) and Jane's sign-in lands meanwhile: it leaves the device at once, not at his sign-out's answer
    const sb = world({ held: COACH }); await bootUp(); sb.logoutMs = 3000; $("signout").click(); await wait(300);
    sb.landed(JANE); const atOnce = sb.stored(); await wait(3500); await settle();
    return { atOnce, side: said(sb, /side/), library: said(sb, /library/), ...look(sb) };
  },
  // R28-SIG-6: a note box typed in and emptied by hand during a slow start, with the other window's older words kept
  async notesCleared() {
    const sb = world({ held: COACH }); await bootUp();
    localStorage.setItem("fiala.trainings.view", JSON.stringify({ name: "client", id: C }));
    newPage(); $("cNotes").value = ""; keptBy("window-A", { notes: [[C, OLD]] });
    sb.delayMs = 1500; const booting = fns.boot(); await wait(300);
    const page = { view: app.get().view.name, signedIn: app.get().signedIn };
    $("cNotes").value = NEW; fire($("cNotes"), "input", { target: $("cNotes") }); $("cNotes").value = ""; fire($("cNotes"), "input", { target: $("cNotes") });
    await booting; sb.delayMs = 0; await settle(); fns.render(); await wait(20);
    return { page, draft: k.noteDraft.get(C) || null, box: $("cNotes").value };
  },
  async cardCleared() {
    const sb = world({ held: COACH }); await bootUp();
    localStorage.setItem("fiala.trainings.view", JSON.stringify({ name: "training", id: WK })); fns.setPreview(true);
    newPage(); keptBy("window-A", { cards: [[WK + "/1", NOTE]], bases: [[WK + "/1", ""]] });
    const mark = made.length; sb.delayMs = 1500; const booting = fns.boot(); await wait(300);
    const add = made.slice(mark).filter((e) => e.className === "add-note").pop(), ta = made.slice(mark).filter((e) => String(e.tagName).toUpperCase() === "TEXTAREA" && e.placeholder === "Something noticed on this exercise").pop();
    if (!add || !ta) return { error: "no note box drawn during the start (" + (add ? "" : "add ") + (ta ? "" : "box") + ")" };
    add.click(); const opened = !ta.parentNode || true; ta.value = "Ask about the left knee"; fire(ta, "input"); const typed = k.cardNoteDraft.get(WK + "/1") || null; ta.value = ""; fire(ta, "input");
    await booting; sb.delayMs = 0; await settle(); app.set({ renderedTraining: null }); fns.render(); await wait(20);
    return { opened, typed, draft: k.cardNoteDraft.has(WK + "/1") ? k.cardNoteDraft.get(WK + "/1") : null, boxes: boxes() };
  },
};
if (!modes[mode]) { console.log(JSON.stringify({ error: "no mode " + mode })); process.exit(0); }
const out = await modes[mode]().catch((e) => ({ error: String((e && e.stack) || e).slice(0, 800) }));
console.log(JSON.stringify(out));
process.exit(0);
