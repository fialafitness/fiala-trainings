// Run by win-r26.test.js, one mode per process, all at once (v316, the twenty-sixth check round: the one-window fixes R26-TW-3, R26-WAP-1 and
// R26-WAP-2). The real main.js and sync.js behind the real win.js, on a stand-in lock that grants at once (the feature on: winLost() reads the
// owner record, which names another window once Fiala has moved there), a stand-in browser database and the stand-in server; the people and their
// words are made up. Modes (node tests/win-r26-probe.mjs <mode>):
//  - online, lateboot, slow4 (R26-TW-3): a window that lost Fiala signs in again by no route (the browser's online event, its own start's session
//    coming through late, its start carrying on offline) and leaves the words kept by the window in use on the device;
//  - retry-new, slow-save, client-skip, client-move, del (R26-WAP-1): a window that lost Fiala sends nothing more (a retry, a slow save's merge,
//    the client's rules after a slow one, her move, a deletion), so the change made in the window now in use stays;
//  - health, deleted, plain, norender (R26-WAP-2): words kept about a client whose health details went (her Don't Allow), or about a client or a
//    workout deleted elsewhere, are kept no longer, in the page or on the device.
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
const ENV = await import("./env.js");
const winL = new Map(); globalThis.addEventListener = (t, f) => { if (!winL.has(t)) winL.set(t, []); winL.get(t).push(f); };   // the window's own listeners (env.js drops them): the online event's, fired by hand
const W = await import("../app/win.js");
W.oneWindow(() => {}, {
  locks: { request: (name, o, cb) => { if (typeof o === "function") cb = o; const r = cb({ name }); return Promise.resolve(r); }, query: async () => ({ held: [{ name: "fiala.window", clientId: "me" }] }) },
  Channel: class { constructor() { this.onmessage = null; } postMessage() {} close() {} },
  loc: { href: "https://app.example/", hash: "" }, hist: { state: null, replaceState() {} }, setI: () => 0, clearI: () => {},
});
const { load } = await import("./load.js");
const { makeSupabase } = await import("./fake-supabase.js");
const app = await load(); const { fns, maps } = app;
const $ = (id) => ENV.document.getElementById(id);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const settle = async () => { const until = Date.now() + 15000; do await wait(5); while ((app.get().inflight > 0 || maps.timers.size) && Date.now() < until); };
const clone = (x) => JSON.parse(JSON.stringify(x));
const day = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return fns.localIso(d); };   // the app's local day (never UTC)
const COACH = "coach@x.com", JANE = "jane@x.com", C = "c1", WK = "w1";
const AGREED = { state: "agreed", at: "2026-11-18T17:00:00.000Z", by: "client" };
const HEALTH = { choices: { health: AGREED }, health: { limits: "Left knee" }, birthday: "1990-04-02" };
const loseTo = () => { localStorage.setItem("fiala.window", JSON.stringify({ tab: "window-B", at: Date.now(), vis: "visible" })); return W.winLost(); };   // Use here in window B: the record names it (its notice on its way); this window's first check loses Fiala
const keptBy = (tab, o) => { const s = JSON.stringify({ owner: COACH, tab, at: Date.now(), text: {}, cards: [], bases: [], notes: [], ...o }); localStorage.setItem("fiala.kept", s); return s; };
const calls = (sb, from) => sb.log.slice(from).map((c) => c.rpc || (c.table + " " + c.op));
const keptNow = () => { const k = fns.keptMaps(); return { text: [...k.keptText.keys()], cards: [...k.cardNoteDraft.keys()], notes: [...k.noteDraft.keys()] }; };
const onDevice = () => { const x = JSON.parse(localStorage.getItem("fiala.kept") || "null"); return x && { text: x.text, cards: x.cards, notes: x.notes }; };
const newPage = () => { const k = fns.keptMaps(); for (const m of [k.keptText, k.noteDraft, k.cardNoteDraft, k.cardNoteBase]) m.clear(); };   // a new start of the page (the window Fiala moved to): its memory empty
function server({ coach = true, health = null } = {}) {                   // Jane (made up) with one workout of one exercise; the coach's server, or hers
  const sb = makeSupabase();
  sb.tables.trainers = new Map(coach ? [["t1", { id: "t1", email: COACH }]] : []);
  const who = coach ? COACH : JANE;
  sb.auth.getSession = async () => ({ data: { session: { user: { email: who } } }, error: null });
  sb.auth.onAuthStateChange = (cb) => { sb.told = cb; return { data: { subscription: { unsubscribe() {} } } }; };
  sb.auth.stopAutoRefresh = () => {};
  sb.seed("ft_clients", C, { id: C, name: "Jane Testperson", unit: "lb", email: JANE, ...(health || {}) });
  sb.seed("ft_trainings", WK, { id: WK, clientId: C, title: "Legs", date: day(2), createdAt: "2026-11-10T16:00:00.000Z", completedAt: null, skippedAt: null, rows: [{ id: "sq", label: "1", name: "Back squat", sets: 3, reps: "8", weights: [], repsDone: [], setsDone: 0, done: false, note: "", alts: [], unit: "lb" }] }, { client_id: C });
  if (!coach) sb.rpcs.client_my_data = async () => ({ clients: [...sb.tables.ft_clients.values()].filter((c) => c.data.email === JANE).map((c) => ({ id: c.id, data: clone(c.data), updated_at: c.updated_at })), trainings: [...sb.tables.ft_trainings.values()].map((t) => ({ id: t.id, data: clone(t.data), updated_at: t.updated_at })) });
  globalThis.supabase = { createClient: () => sb };
  return sb;
}
const remember = () => localStorage.setItem("fiala.trainings.role", JSON.stringify({ email: COACH, role: "trainer" }));   // the device remembers the coach
const LIMITS = { ["safety:" + C + "/limits"]: "Left knee: no deep lunges" };   // a Health & safety limit half typed in the window in use, kept there as it went out of sight

const modes = {
  // R26-TW-3 (resumeOnline): no signal at the start (the session unreadable): carrying on as the remembered coach. Use here in B; the signal comes back
  async online() {
    const sb = server(); let up = false, sessions = 0;
    sb.auth.getSession = async () => { sessions++; return up ? { data: { session: { user: { email: COACH } } }, error: null } : { data: { session: null }, error: { message: "Failed to fetch" } }; };
    remember(); await fns.boot(); await settle();
    const start = { offline: !!app.get().offline, entry: app.get().offlineEntry };
    const lost = loseTo(), kept = keptBy("window-B", { text: LIMITS }), s0 = sessions, c0 = sb.log.length;
    up = true; for (const f of winL.get("online") || []) f({ type: "online" });
    await settle(); await wait(400); await settle();
    return { start, lost, listeners: (winL.get("online") || []).length, sessions: sessions - s0, keptLeft: localStorage.getItem("fiala.kept") === kept, calls: calls(sb, c0), taken: keptNow().text };
  },
  // R26-TW-3 (enterCloud): the library still retrying the token after 4 s (boot carries on offline); Use here in B; then the session comes through
  async lateboot() {
    const sb = server(); let sessions = 0;
    sb.auth.getSession = () => { sessions++; return new Promise((r) => setTimeout(() => r({ data: { session: { user: { email: COACH } } }, error: null }), 5500)); };
    remember(); const booting = fns.boot(); await wait(4500);
    const at4s = { offline: !!app.get().offline, entry: app.get().offlineEntry };
    const lost = loseTo(), kept = keptBy("window-B", { text: LIMITS }), c0 = sb.log.length;
    await booting; await wait(2000); await settle();
    return { at4s, lost, sessions, keptLeft: localStorage.getItem("fiala.kept") === kept, calls: calls(sb, c0), taken: keptNow().text };
  },
  // R26-TW-3 (takeKept): Use here in B while this window's start still waits for its session; at 4 s boot carries on offline
  async slow4() {
    const sb = server();
    sb.auth.getSession = () => new Promise((r) => setTimeout(() => r({ data: { session: null }, error: { message: "Failed to fetch" } }), 9000));
    remember(); const booting = fns.boot(); await wait(1500);
    const lost = loseTo(), kept = keptBy("window-B", { text: LIMITS, cards: [[WK + "/1", "Knee sore on set 3"]], bases: [[WK + "/1", ""]] }), c0 = sb.log.length;
    await booting; await wait(300);
    return { lost, entry: app.get().offlineEntry, keptLeft: localStorage.getItem("fiala.kept") === kept, calls: calls(sb, c0), taken: keptNow() };
  },
  // R26-WAP-1 (flushOne's retry): the coach's new workout (no stamp yet: its save reads first) meets a server error; while it waits to try again,
  // Fiala moves to B (this tab asleep), which sends it from the queue, and he renames it there
  async "retry-new"() {
    const sb = server(); await fns.boot(); await settle();
    const c00 = sb.log.length;
    sb.setFail({ table: "ft_trainings", op: "select", times: 1, message: "An invalid response was received from the upstream server", code: "502" });
    const w2 = { id: "w2", clientId: C, title: "Legs day 2", date: day(3), createdAt: new Date().toISOString(), completedAt: null, skippedAt: null, rows: [{ id: "dl", label: "1", name: "Deadlift", sets: 3, reps: "5", weights: [], repsDone: [], setsDone: 0, done: false, note: "", alts: [], unit: "lb" }] };
    maps.trainings.set("w2", clone(w2)); fns.scheduleSave("trainings", "w2", 0); await wait(150);
    const firstTry = calls(sb, c00);
    const lost = loseTo(), c0 = sb.log.length;
    sb.seed("ft_trainings", "w2", { ...w2, title: "Legs day 2 (B)" }, { client_id: C });   // B sent it from the queue, then his rename landed
    await wait(2000); await settle();
    return { firstTry, lost, calls: calls(sb, c0), server: sb.tables.ft_trainings.get("w2").data.title };
  },
  // R26-WAP-1 (cloudBackend.set's write): no server error, a slow bar: his 100 lb takes 4 s to reach the server; Use here in B: the hand-over
  // waits 3 s and lets go; B's two saves land first (100 from the queue, then his correction 105)
  async "slow-save"() {
    const sb = server(); await fns.boot(); await settle();
    sb.delayMs = 4000;
    { const r = maps.trainings.get(WK).rows[0]; r.weights = ["100"]; r.repsDone = ["8"]; r.setsDone = 1; if (!maps.trainerTouched.has(WK)) maps.trainerTouched.set(WK, new Set()); maps.trainerTouched.get(WK).add("sq"); fns.scheduleSave("trainings", WK, 0); }
    await wait(50); const c0 = sb.log.length, t0 = Date.now();
    await W.winHooks.handOver(); const handOverMs = Date.now() - t0, lost = loseTo();
    sb.delayMs = 0;
    { const r = sb.tables.ft_trainings.get(WK); r.data = clone(r.data); r.data.rows[0].weights = ["105"]; r.updated_at = "2026-10-13T02:59:59Z"; }
    await wait(1500); await settle();
    const after = sb.log.slice(c0);
    return { handOverMs, lost, writes: after.filter((c) => c.op && c.op !== "select").map((c) => c.op + ":" + ((c.payload && c.payload.data && c.payload.data.rows) ? c.payload.data.rows[0].weights.join(",") : "")), server: sb.tables.ft_trainings.get(WK).data.rows[0].weights.join(",") };
  },
  // R26-WAP-1 (the client's rules): Jane's tab A sends one pass, her set (slow: 4.5 s on one bar) then her Skip; Use here in B mid-pass (the
  // hand-over waits 3 s and lets go); in B she takes the Skip back (Undo), which lands
  async "client-skip"() {
    const sb = server({ coach: false });
    sb.rpcs.client_log_set = async (a) => { await wait(4500); const s = sb.tables.ft_trainings.get(a.p_training), r = s.data.rows.find((x) => x.id === a.p_row); if ((r.logSeq || 0) > a.p_seq) return r.logSeq; r.weights = a.p_weights; r.logSeq = a.p_seq; return a.p_seq; };
    sb.rpcs.client_skip_training = async (a) => { const s = sb.tables.ft_trainings.get(a.p_training); s.data = clone(s.data); if (a.p_skipped) { s.data.skippedAt = a.p_at || new Date().toISOString(); s.data.skipReason = a.p_reason; } else { delete s.data.skippedAt; delete s.data.skipReason; } return null; };
    await fns.boot(); await settle();
    { const t = maps.trainings.get(WK), r = t.rows[0]; r.weights = ["100"]; r.repsDone = ["8"]; r.setsDone = 1; maps.pendingWeightRows.set(WK, new Set(["sq"])); t.skippedAt = new Date().toISOString(); t.skipReason = "Sick"; maps.pendingSkip.add(WK); fns.scheduleSave("trainings", WK, 0); }
    await wait(200); const t0 = Date.now();
    await W.winHooks.handOver(); const handOverMs = Date.now() - t0, lost = loseTo(), c0 = sb.log.length;
    { const s = sb.tables.ft_trainings.get(WK); s.data = clone(s.data); delete s.data.skippedAt; delete s.data.skipReason; }
    await wait(2500); await settle();
    return { handOverMs, lost, rules: calls(sb, c0), skipped: !!sb.tables.ft_trainings.get(WK).data.skippedAt };
  },
  // R26-WAP-1 (her move): Jane's tab A sends her set (slow) and her move of the workout to one day; Use here in B mid-pass; in B she moves it to
  // the next day, which lands
  async "client-move"() {
    const sb = server({ coach: false });
    sb.rpcs.client_log_set = async (a) => { await wait(4500); const s = sb.tables.ft_trainings.get(a.p_training), r = s.data.rows.find((x) => x.id === a.p_row); if ((r.logSeq || 0) > a.p_seq) return r.logSeq; r.weights = a.p_weights; r.logSeq = a.p_seq; return a.p_seq; };
    sb.rpcs.client_move_training = async (a) => { const s = sb.tables.ft_trainings.get(a.p_training); s.data = clone(s.data); s.data.date = a.p_date; return null; };
    await fns.boot(); await settle();
    { const t = maps.trainings.get(WK), r = t.rows[0]; r.weights = ["100"]; r.repsDone = ["8"]; r.setsDone = 1; maps.pendingWeightRows.set(WK, new Set(["sq"])); t.date = day(4); maps.pendingMove.add(WK); fns.scheduleSave("trainings", WK, 0); }
    await wait(200);
    await W.winHooks.handOver(); const lost = loseTo(), c0 = sb.log.length;
    { const s = sb.tables.ft_trainings.get(WK); s.data = clone(s.data); s.data.date = day(5); }
    await wait(2500); await settle();
    const name = (d) => (d === day(4) ? "her first pick" : d === day(5) ? "her last pick" : d);
    return { lost, rules: sb.log.slice(c0).filter((c) => c.rpc).map((c) => c.rpc + (c.rpc === "client_move_training" ? ": " + name(c.args.p_date) : "")), day: name(sb.tables.ft_trainings.get(WK).data.date) };
  },
  // R26-WAP-1 (cloudBackend.del): a deletion asked of the backend in a window that lost Fiala (flushOne asks winLost() just before it: asked here directly)
  async del() {
    const sb = server(); await fns.boot(); await settle();
    const lost = loseTo(), c0 = sb.log.length; let threw = "";
    try { await app.get().backend.del("trainings", WK); } catch (e) { threw = String((e && e.message) || e); }
    await wait(50);
    return { lost, threw: /another window/.test(threw), calls: calls(sb, c0), onServer: sb.tables.ft_trainings.has(WK) };
  },
  // R26-WAP-2 (health withdrawn): the coach types Jane's medical conditions in Health & safety, unsaved; Use here: the window Fiala moves to takes
  // the words for the next time that sheet opens; then her Don't Allow arrives (her details deleted on the server); months later she agrees again
  async health() {
    const sb = server({ health: HEALTH }); await fns.boot(); await settle();
    fns.editSafety(C, "conditions"); $("textField").value = "Asthma, uses an inhaler before cardio";
    await W.winHooks.handOver();
    const keptAtMove = Object.keys((JSON.parse(localStorage.getItem("fiala.kept") || "null") || {}).text || {});
    { const x = JSON.parse(localStorage.getItem("fiala.kept")); x.tab = "window-A"; localStorage.setItem("fiala.kept", JSON.stringify(x)); }   // (window A is another page: its own tab)
    newPage(); await fns.boot(); await settle();
    const taken = keptNow().text;
    { const r = sb.tables.ft_clients.get(C); r.data = clone(r.data); delete r.data.health; delete r.data.birthday; r.data.choices = { health: { state: "declined", at: new Date().toISOString(), by: "client" } }; r.updated_at = "2026-10-13T05:00:00Z"; }
    await fns.syncDownNow(); await settle();
    const afterWithdrawal = { health: maps.clients.get(C).health || null, kept: keptNow().text };
    { const r = sb.tables.ft_clients.get(C); r.data = clone(r.data); r.data.choices = { health: { state: "agreed", at: new Date(Date.now() + 1000).toISOString(), by: "client" } }; r.data.birthday = "1990-04-02"; r.updated_at = "2026-10-13T06:00:00Z"; }
    await fns.syncDownNow(); await settle();
    $("textField").value = "(the sheet did not open)"; fns.editSafety(C, "conditions");
    const boxOnReopen = $("textField").value; $("textNo").click && $("textNo").click();
    W.winHooks.hidden(); const kept = onDevice(); W.winHooks.shown();
    return { keptAtMove, taken, afterWithdrawal, boxOnReopen, onDevice: kept };
  },
  // R26-WAP-2 (deleted elsewhere): words kept about Jane (her notes box, a card note on her workout, Health & safety, an exercise's instructions),
  // taken by the window Fiala moved to; then her client record and her workout are deleted on the coach's iPad
  async deleted() {
    const sb = server({ health: HEALTH }); await fns.boot(); await settle();
    keptBy("window-A", { text: { ["safety:" + C + "/conditions"]: "Asthma, inhaler before cardio", ["note:" + WK + "/sq"]: "Heels on plates" }, cards: [[WK + "/1", "Knee sore on set 3"]], bases: [[WK + "/1", ""]], notes: [[C, "Private: knee surgery in March"]] });
    newPage(); await fns.boot(); await settle();
    const taken = keptNow();
    sb.tables.ft_trainings.delete(WK); sb.tables.ft_clients.delete(C);
    await fns.syncDownNow(); await settle();
    const gone = { client: !maps.clients.has(C), workout: !maps.trainings.has(WK) }, afterSync = keptNow();
    W.winHooks.hidden(); const kept = onDevice(); W.winHooks.shown();
    return { taken, gone, afterSync, onDevice: kept };
  },
  // R26-WAP-2 (one window, no move): the coach leaves a private note half typed in Jane's notes box and her Health & safety sheet up with words;
  // her Don't Allow arrives, later her record is deleted on his iPad; each time the page goes out of sight, what waits on the device
  async plain() {
    const sb = server({ health: HEALTH }); await fns.boot(); await settle();
    const k = fns.keptMaps();
    k.noteDraft.set(C, "Private: knee surgery in March");                // what the notes box's input handler keeps
    fns.editSafety(C, "medications"); $("textField").value = "Albuterol before cardio";
    W.winHooks.hidden(); const before = onDevice(); W.winHooks.shown();
    { const r = sb.tables.ft_clients.get(C); r.data = clone(r.data); delete r.data.health; r.data.choices = { health: { state: "declined", at: new Date().toISOString(), by: "client" } }; r.updated_at = "2026-10-13T05:00:00Z"; }
    await fns.syncDownNow(); await settle();
    W.winHooks.hidden(); const afterWithdrawal = onDevice(); W.winHooks.shown();
    sb.tables.ft_trainings.delete(WK); sb.tables.ft_clients.delete(C);
    await fns.syncDownNow(); await settle();
    W.winHooks.hidden(); const afterDeletion = onDevice();
    return { before, afterWithdrawal, clientGone: !maps.clients.has(C), afterDeletion };
  },
  // R26-WAP-2 (no redraw): words kept about Jane's workout (its exercise's instructions, a card note), taken by the window Fiala moved to; the iPad
  // deletes the workout and his own save of it finds it gone (no sync, no redraw: he is on the Clients page); then the window goes out of sight
  async norender() {
    const sb = server(); await fns.boot(); await settle();
    keptBy("window-A", { text: { ["note:" + WK + "/sq"]: "Heels on plates" }, cards: [[WK + "/1", "Knee sore on set 3"]], bases: [[WK + "/1", ""]] });
    newPage(); await fns.boot(); await settle();
    const taken = keptNow(), view = app.get().view && app.get().view.name;
    sb.tables.ft_trainings.delete(WK);
    maps.trainings.get(WK).title = "Legs (renamed)"; fns.scheduleSave("trainings", WK, 0); await settle();
    const gone = !maps.trainings.has(WK), before = keptNow();
    W.winHooks.hidden(); const kept = onDevice();
    return { taken, view, gone, before, onDevice: kept };
  },
};
if (!modes[mode]) { console.log(JSON.stringify({ error: "no mode " + mode })); process.exit(0); }
const out = await modes[mode]();
console.log(JSON.stringify(out));
process.exit(0);
