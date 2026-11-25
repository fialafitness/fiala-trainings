// Run by win.test.js in its own process (v316, one window at a time): the app's side of app/win.js, on the real main.js and sync.js. The window
// runs Fiala (a stand-in lock that grants at once), signed in as the coach on the stand-in server; then:
// - the drafts add-on (the owner's yes, 19 Nov 2026): what the hand-over keeps (a sheet's words, a card's half-written note and the note it was
//   opened on, the coach's notes box), for this account only, given back once at the next start and never to another account; Sign out and
//   the session ended elsewhere take it away;
// - the write gate: once the record names another window, nothing more is stored (the queue, the device copy, any key), sent or read from the
//   server, the session's refresh stops, the sheets close, and the library's SIGNED_OUT wipes nothing; a Sign out there reaches its wipe and
//   wipes nothing either, nor the photo copies in the browser's cache, which every window shares (v316, the twenty-sixth check round, R26-TW-2).
// Prints one JSON line. Made-up people only.
const idb = new Map(); let idbWrites = 0;                                 // the browser's database, as relaunch-copy-probe.mjs stands in for it
const request = () => ({ onsuccess: null, onerror: null, result: undefined, error: null });
const db = { createObjectStore() {}, close() {}, transaction() {
  const tx = { oncomplete: null, onerror: null, onabort: null }, end = (ok) => setTimeout(() => (ok ? tx.oncomplete && tx.oncomplete() : tx.onerror && tx.onerror()), 0);
  tx.objectStore = () => ({
    get(k) { const r = request(); setTimeout(() => { r.result = idb.has(k) ? structuredClone(idb.get(k)) : undefined; if (r.onsuccess) r.onsuccess(); }, 0); return r; },
    put(v, k) { const val = structuredClone(v), r = request(); setTimeout(() => { idb.set(k, val); idbWrites++; if (r.onsuccess) r.onsuccess(); end(true); }, 0); return r; },
    delete(k) { const r = request(); setTimeout(() => { idb.delete(k); idbWrites++; if (r.onsuccess) r.onsuccess(); end(true); }, 0); return r; },
  });
  return tx; } };
globalThis.indexedDB = { open() { const r = request(); setTimeout(() => { r.result = db; if (r.onupgradeneeded) r.onupgradeneeded(); if (r.onsuccess) r.onsuccess(); }, 0); return r; } };
const cacheDeletes = []; globalThis.caches = { open: async () => ({ match: async () => undefined, keys: async () => [], delete: async () => true, put: async () => {} }), delete: async (n) => { cacheDeletes.push(n); return true; } };   // Cache Storage (the photo copies), shared by every window of the browser
await import("./env.js");
const W = await import("../app/win.js");
const COACH = "coach@x.com", C = "c1", WK = "w1";
let me = null;
W.oneWindow(() => {}, {
  locks: { request: (name, o, cb) => { if (typeof o === "function") cb = o; const r = cb({ name }); return Promise.resolve(r); }, query: async () => ({ held: [{ name: "fiala.window", clientId: "me" }, ...(me ? [{ name: me, clientId: "me" }] : [])] }) },
  Channel: class { constructor() { this.onmessage = null; } postMessage() {} close() {} },
  loc: { href: "https://app.example/", hash: "" }, hist: { state: null, replaceState() {} },
  setI: () => 0, clearI: () => {},
});
const { load } = await import("./load.js");
const { makeSupabase } = await import("./fake-supabase.js");
const { lsSet } = await import("../app/util.js");
const app = await load(); const { fns, maps } = app;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const settle = async () => { const until = Date.now() + 15000; do await wait(5); while ((app.get().inflight > 0 || maps.timers.size) && Date.now() < until); };
const allStored = () => { const o = {}; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); o[k] = localStorage.getItem(k); } return o; };
const out = {};
const sb = makeSupabase(); sb.tables.trainers = new Map([["t1", { id: "t1", email: COACH }]]);
let told = null, stopped = 0;
sb.auth.getSession = async () => ({ data: { session: { user: { email: COACH } } }, error: null });
sb.auth.onAuthStateChange = (cb) => { told = cb; return { data: { subscription: { unsubscribe() {} } } }; };
sb.auth.stopAutoRefresh = () => { stopped++; };
const coachSession = async () => ({ data: { session: { user: { email: COACH } } }, error: null });
sb.auth.signOut = async () => { sb.auth.getSession = async () => ({ data: { session: null }, error: null }); if (told) told("SIGNED_OUT", null); return { error: null }; };   // as supabase-js does: the session gone, then SIGNED_OUT
sb.seed("ft_clients", C, { id: C, name: "Jane Testperson", unit: "lb", email: "jane@x.com", choices: { zone: { state: "deny", at: "2026-11-18T17:00:00.000Z" }, health: { state: "agreed", at: "2026-11-18T17:00:00.000Z" } } });
sb.seed("ft_trainings", WK, { id: WK, clientId: C, title: "Legs", date: "2026-11-27", createdAt: "2026-11-10T16:00:00.000Z", completedAt: null, skippedAt: null, rows: [{ id: "sq", label: "1", name: "Back squat", sets: 4, reps: "8", weights: [], repsDone: [], setsDone: 0, done: false, note: "", alts: [], unit: "lb" }] }, { client_id: C });
globalThis.supabase = { createClient: () => sb };
await fns.boot(); await settle();
out.booted = { signedIn: app.get().signedIn, coach: !app.get().clientMode, workout: maps.trainings.has(WK), lost: W.winLost(), rec: JSON.parse(localStorage.getItem("fiala.window") || "null") ? JSON.parse(localStorage.getItem("fiala.window")).tab === W.winTab() : false };

// the drafts add-on: what the hand-over keeps, for this account
const k = fns.keptMaps();
k.noteDraft.set(C, "Asked about his knee"); k.cardNoteDraft.set(WK + "/1", "Knee ok, sore after set 3"); k.cardNoteBase.set(WK + "/1", "Knee ok"); k.cardNoteBase.set(WK + "/9", "a box with no words: not kept");
fns.editText({ keep: "safety:" + C + "/limits", title: "Injuries and limits", value: "Left knee", onSave: () => { out.savedByMove = true; } });
const $ = (id) => document.getElementById(id); $("textField").value = "Left knee: no lunges";
await W.winHooks.handOver();
const kept = JSON.parse(localStorage.getItem("fiala.kept") || "null");
out.kept = kept && { owner: kept.owner, tab: kept.tab === W.winTab(), text: kept.text, cards: kept.cards, bases: kept.bases, notes: kept.notes };
out.sheetClosed = $("textSheet").hidden === true;
// a new start of the page (the window Fiala moved to): the maps empty, then the words taken back once
for (const m of [k.keptText, k.noteDraft, k.cardNoteDraft, k.cardNoteBase]) m.clear();
fns.takeKept(COACH);
out.taken = { notes: [...k.noteDraft], cards: [...k.cardNoteDraft], bases: [...k.cardNoteBase], text: [...k.keptText], left: localStorage.getItem("fiala.kept") };
fns.editText({ keep: "safety:" + C + "/limits", title: "Injuries and limits", value: "Left knee", onSave: () => {} });
out.sheetBack = $("textField").value; $("textNo").click && $("textNo").click();
fns.editText({ keep: "safety:" + C + "/limits", title: "Injuries and limits", value: "Left knee", onSave: () => {} });
out.sheetOnce = $("textField").value;
// another account's words are never given back, and leave the device
localStorage.setItem("fiala.kept", JSON.stringify({ owner: "jane@x.com", tab: "x", at: 1, text: { "safety:c1/limits": "hers" }, cards: [[WK + "/1", "hers"]], bases: [], notes: [[C, "hers"]] }));
for (const m of [k.keptText, k.noteDraft, k.cardNoteDraft, k.cardNoteBase]) m.clear();
fns.takeKept(COACH);
out.foreign = { notes: k.noteDraft.size, cards: k.cardNoteDraft.size, text: k.keptText.size, left: localStorage.getItem("fiala.kept") };
// the window shown again while it still runs Fiala: its own kept words leave the device (they are on its page)
lsSet("fiala.kept", { owner: COACH, tab: W.winTab(), at: 1, text: {}, cards: [[WK + "/1", "x"]], bases: [], notes: [] }); W.winHooks.shown(); out.shownDrops = localStorage.getItem("fiala.kept");
lsSet("fiala.kept", { owner: COACH, tab: "another", at: 1, text: {}, cards: [[WK + "/1", "x"]], bases: [], notes: [] }); W.winHooks.shown(); out.shownKeepsOthers = localStorage.getItem("fiala.kept") !== null;
localStorage.removeItem("fiala.kept");
// Sign out takes the kept words away (a per-account key)
lsSet("fiala.kept", { owner: COACH, tab: "x", at: 1, text: { a: "b" }, cards: [], bases: [], notes: [] }); k.keptText.set("a", "b");
await fns.signOut(); await settle();
out.signOut = { left: localStorage.getItem("fiala.kept"), text: k.keptText.size, signedIn: app.get().signedIn };

// the words come back at the same account's sign-in (a page starting again with the device copy, as the window Fiala moves to), never at a start before
// anyone signed in, never to another account signing in on that page; and they go when the session ends elsewhere with nothing waiting
const keptFor = (owner) => localStorage.setItem("fiala.kept", JSON.stringify({ owner, tab: "x", at: 1, text: { "safety:c1/limits": "typed by " + owner }, cards: [[WK + "/1", "card by " + owner]], bases: [[WK + "/1", "Knee ok"]], notes: [[C, "notes by " + owner]] }));
const drafts = () => ({ cards: [...k.cardNoteDraft.values()], notes: [...k.noteDraft.values()], text: [...k.keptText.values()], left: localStorage.getItem("fiala.kept") !== null });
sb.auth.getSession = coachSession; await fns.boot(); await settle();      // the coach signed in again, his device copy filled
for (const m of [k.keptText, k.noteDraft, k.cardNoteDraft, k.cardNoteBase]) m.clear();
keptFor(COACH); await fns.boot(); await settle();                          // the window Fiala moves to starts: the same account
out.sameAccount = { ...drafts(), base: k.cardNoteBase.get(WK + "/1") };
for (const m of [k.keptText, k.noteDraft, k.cardNoteDraft, k.cardNoteBase]) m.clear();
keptFor(COACH); sb.auth.getSession = async () => ({ data: { session: null }, error: null }); await fns.boot(); await settle();   // nobody signed in (his session ended elsewhere): the device remembers the coach
out.bootNoSession = { ...drafts(), signedIn: app.get().signedIn };
sb.auth.getSession = async () => ({ data: { session: { user: { email: "jane@x.com" } } }, error: null }); sb.tables.trainers = new Map();   // Jane signs in on that page
sb.rpcs.client_my_data = async () => ({ clients: [{ id: C, data: { id: C, name: "Jane Testperson", unit: "lb", email: "jane@x.com" } }], trainings: [] });
await fns.boot(); await settle();
out.otherAccount = { ...drafts(), client: app.get().clientMode };
keptFor("jane@x.com"); await fns.signOut(); await settle();
out.clientSignOut = { left: localStorage.getItem("fiala.kept"), signedIn: app.get().signedIn };
sb.tables.trainers = new Map([["t1", { id: "t1", email: COACH }]]); sb.auth.getSession = coachSession; await fns.boot(); await settle();
keptFor(COACH); k.keptText.set("x", "y"); if (told) told("SIGNED_OUT", null); await settle();   // his session ended elsewhere, nothing waiting: the device is wiped
out.wiped = { left: localStorage.getItem("fiala.kept"), text: k.keptText.size, signedIn: app.get().signedIn };
// carrying on offline as the account the device remembers (no signal for the session): that account's kept words come back
sb.auth.getSession = coachSession; await fns.boot(); await settle(); for (const m of [k.keptText, k.noteDraft, k.cardNoteDraft, k.cardNoteBase]) m.clear();
keptFor(COACH); sb.auth.getSession = async () => ({ data: { session: null }, error: { message: "Failed to fetch" } }); await fns.boot(); await settle();
out.offlineSame = { ...drafts(), offline: !!app.get().offline };

// sign in again, then the write gate
sb.auth.getSession = coachSession; await fns.boot(); await settle();
out.again = { signedIn: app.get().signedIn, lost: W.winLost() };
maps.trainings.get(WK).title = "Legs (here)"; fns.scheduleSave("trainings", WK); await settle();
out.beforeLoss = { server: sb.tables.ft_trainings.get(WK).data.title };
const calls0 = sb.log.length;
localStorage.setItem("fiala.window", JSON.stringify({ tab: "another-window", at: Date.now(), vis: "visible" }));   // Fiala moved to another window (its notice still on its way)
const stored0 = allStored(), dirtyBefore = [...maps.dirty.keys()].sort().join();
out.loss = { lost: W.winLost(), stopped };
maps.trainings.get(WK).title = "Legs (old window)"; fns.scheduleSave("trainings", WK);
const lsOk = lsSet("fiala.trainings.view", { name: "clients" });
fns.persistPending(); fns.localBackend.save(); await fns.localBackend.flushDb();
const synced = await fns.syncDownNow();
const dirty0 = [...maps.dirty.keys()].sort().join(), timers0 = maps.timers.size; fns.scheduleSave("trainings", WK);
const marked = { dirty: [...maps.dirty.keys()].sort().join() !== dirtyBefore, timers: maps.timers.size !== timers0 };
maps.dirty.set("trainings/" + WK, 99); await fns.flushOne("trainings", WK); maps.dirty.delete("trainings/" + WK);   // a save waiting from before the move: never sent from here
const q0 = localStorage.getItem("fiala.pending.v1"), t0 = localStorage.getItem("fiala.pending.tab"); localStorage.setItem("fiala.pending.tab", "another-window"); localStorage.setItem("fiala.pending.v1", JSON.stringify({ tab: "another-window", owner: COACH, dirty: ["trainings/w9"], recs: [["trainings/w9", { id: "w9", clientId: C, title: "From the other window", date: "2026-11-28", rows: [] }]] }));
fns.persistPending(); const adopted = maps.trainings.has("w9");                // the other window's queue: never taken into this page
for (const [kk, v] of [["fiala.pending.v1", q0], ["fiala.pending.tab", t0]]) { if (v === null) localStorage.removeItem(kk); else localStorage.setItem(kk, v); }   // (the stand-in's own writes, taken back)
const idb0 = idbWrites; await fns.localBackend.flushDb(); const idbAfter = idbWrites - idb0;
let sessions = 0; const gs = sb.auth.getSession; sb.auth.getSession = async (...x) => { sessions++; return gs(...x); };
app.set({ offline: true }); const SY0 = await import("../app/sync.js"); SY0.scheduleSync(); await wait(500); app.set({ offline: false }); sb.auth.getSession = gs;   // a sync asked for with no signal: no session asked for (that window answers for it)
const P = await import("../app/photos.js"); P.forgetPhoto(C); await fns.flushPhotos(); await wait(50);   // a client's photo folder to delete: never from here
const SY = await import("../app/sync.js"); SY.shownAgain(); SY.scheduleSync(); fns.onStorage({ key: "fiala.pending.v1" }); await fns.flushPhotos(); await settle(); await wait(700);
if (told) told("SIGNED_OUT", null);   // the session ended in the window in use: this one wipes nothing
await settle();
P.loadPhotoQueue(); const pwAt = P.photoWork(), cd0 = cacheDeletes.length, idbS0 = idbWrites;   // (v316, the twenty-sixth check round, R26-TW-2) the folder to delete above never reached the device (its write was stopped): a page starting from the device has no photo work left, so its Sign out goes on to its wipe
const afterEvent = app.get().signedIn; let libOuts = 0; const libOut = sb.auth.signOut; sb.auth.signOut = async (...x) => { libOuts++; return libOut(...x); };
await fns.signOut(); await settle();                                       // a Sign out started in that window (its question answered before the move)
out.lostSignOut = { pwAt, cacheDeletes: cacheDeletes.slice(cd0), signedInAfter: app.get().signedIn, idbOut: idbWrites - idbS0 };
{ const cd1 = cacheDeletes.length; await P.dropPhotoCopies(); out.lostDrop = cacheDeletes.slice(cd1); }   // the photo copies' own drop (a session ended elsewhere), asked here directly: the library's SIGNED_OUT never reaches it in this window
const stored1 = allStored(), changed = Object.keys({ ...stored0, ...stored1 }).filter((x) => stored0[x] !== stored1[x]);
out.afterLoss = { libOuts, marked, adopted, idbAfter, sessions, lsSet: lsOk, synced, changed, calls: sb.log.slice(calls0).map((c) => c.rpc || (c.table + " " + c.op)), server: sb.tables.ft_trainings.get(WK).data.title, afterEvent, roleKept: !!localStorage.getItem("fiala.trainings.role") };
console.log(JSON.stringify(out));
process.exit(0);
