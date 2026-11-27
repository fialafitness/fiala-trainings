// v327 (the review of 26 Nov 2026; tests/queue-full.test.js). A launch whose database does not open, as a browser gives it: each launch here is its own process
// (sync.js keeps the database's handle for a page's life), and what the device keeps travels in a state file the test names.
//   node queue-hold-probe.mjs A <state> [N]      the coach signs in (boot's own entry), syncs, loses signal, changes N workouts, closes the app
//   node queue-hold-probe.mjs B <state> <mode>   the next launch; mode: ok | error (the open fails) | late (the open answers after 2.5 s)
//   node queue-hold-probe.mjs O <state> <mode>   a launch in that mode, then the Sign out button's own function
//   node queue-hold-probe.mjs L <state>          a launch with nobody signed in, the database opening as usual
// Everything from boot on is the app's own: main.js boot, its entry, its sync, its Sign out. Made-up people only.
import fs from "node:fs";
const [STAGE = "A", STATE = "", ARG = ""] = process.argv.slice(2);
const prev = STAGE === "A" ? { ls: {}, idb: {}, n: Number(ARG) || 350 } : JSON.parse(fs.readFileSync(STATE, "utf8"));
const N = prev.n, MODE = STAGE === "B" || STAGE === "O" ? ARG || "error" : "ok";
const store = new Map(Object.entries(prev.idb));                       // the browser's database: one store, answers on the next tick
const request = () => ({ onsuccess: null, onerror: null, result: undefined, error: null });
const db = { createObjectStore() {}, close() {}, transaction() {
  const tx = { oncomplete: null, onerror: null, onabort: null }, end = () => setTimeout(() => tx.oncomplete && tx.oncomplete(), 0);
  tx.objectStore = () => ({
    get(k) { const r = request(); setTimeout(() => { r.result = store.has(k) ? structuredClone(store.get(k)) : undefined; if (r.onsuccess) r.onsuccess(); }, 0); return r; },
    put(v, k) { const val = structuredClone(v), r = request(); setTimeout(() => { store.set(k, val); if (r.onsuccess) r.onsuccess(); end(); }, 0); return r; },
    delete(k) { const r = request(); setTimeout(() => { store.delete(k); if (r.onsuccess) r.onsuccess(); end(); }, 0); return r; },
  }); return tx; } };
globalThis.indexedDB = { open() { const r = request(), yes = () => { r.result = db; if (r.onupgradeneeded) r.onupgradeneeded(); if (r.onsuccess) r.onsuccess(); };
  if (MODE === "ok") setTimeout(yes, 0); else if (MODE === "late") setTimeout(yes, 2500); else setTimeout(() => { r.error = new Error("Internal error opening backing store"); if (r.onerror) r.onerror(); }, 5);
  return r; } };
await import("./env.js");
const ROOM = 2600000;                                                   // localStorage as a browser keeps it: about 2.6 million characters for the whole site, every key counted
{ const put = localStorage.setItem.bind(localStorage); localStorage.setItem = (k, v) => { let used = 0; for (const [kk, vv] of localStorage.map) if (kk !== k) used += kk.length + vv.length; if (used + k.length + String(v).length > ROOM) throw new Error("QuotaExceededError"); return put(k, v); }; }
for (const [k, v] of Object.entries(prev.ls)) localStorage.map.set(k, v);   // what the device kept from the launch before
const { makeSupabase } = await import("./fake-supabase.js");
const QUEUE = "fiala.pending.v1", COPY = "fiala.trainings.v1", WORD = "Changed with no signal";
const ids = Array.from({ length: N }, (_, i) => "t" + String(i).padStart(4, "0"));
const big = (id) => ({ id, clientId: "c1", title: "Workout", date: "2026-11-20", createdAt: "2026-11-01T10:00:00.000Z", completedAt: null, skippedAt: null,
  rows: Array.from({ length: 10 }, (_, j) => ({ id: "r" + j, label: String(j + 1), name: "Squat", sets: 3, reps: "8", note: "x".repeat(500), weights: [], repsDone: [], setsDone: 0, done: false, alts: [] })) });
const sb = makeSupabase(); let offline = false;                         // the server: the same rows and stamps at every launch (it never got the changes), unless a launch sends them
sb.tables.trainers = new Map([["t", { id: "t", email: "coach@x.com" }]]);
sb.seed("ft_clients", "c1", { id: "c1", name: "Jane Testperson", unit: "lb", email: "jane@x.com" }); sb.tables.ft_clients.get("c1").updated_at = "2026-11-01T10:00:00.000Z";
ids.forEach((id, i) => { sb.seed("ft_trainings", id, big(id), { client_id: "c1" }); sb.tables.ft_trainings.get(id).updated_at = new Date(Date.UTC(2026, 10, 1, 11, 0, i)).toISOString(); });
const session = STAGE === "L" ? null : { user: { id: "u1", email: "coach@x.com" } };
sb.auth = { getSession: async () => ({ data: { session }, error: null }), onAuthStateChange() {}, getUser: async () => ({ data: { user: session && session.user } }), signOut: async () => ({ error: null }) };
{ const from = sb.from, rpc = sb.rpc; const dead = () => { const p = new Proxy(function () {}, { get: (_, k) => (k === "then" ? (res, rej) => Promise.reject(new TypeError("Failed to fetch")).then(res, rej) : () => p) }); return p; };
  sb.from = (t) => (offline ? dead() : from(t)); sb.rpc = (...a) => (offline ? Promise.reject(new TypeError("Failed to fetch")) : rpc(...a)); }
globalThis.supabase = { createClient: () => sb };                      // the library the page loads: boot makes its client and goes in with the session by itself
const { load } = await import("./load.js");
const app = await load(); const { fns, maps } = app;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const calm = async (max) => { const until = Date.now() + max; let still = 0; while (Date.now() < until && still < 40) { await wait(25); still = app.get().inflight > 0 || app.get().syncing ? 0 : still + 1; } };
const queue = () => { try { return JSON.parse(localStorage.getItem(QUEUE)); } catch (_) { return null; } };
const status = () => { fns.setStatus(); return String(document.getElementById("status").textContent || ""); };
const inDb = () => ids.filter((id) => (((store.get(COPY) || {}).trainings || {})[id] || {}).title === WORD).length;
const onServer = () => ids.filter((id) => sb.tables.ft_trainings.get(id).data.title === WORD).length;
const device = () => { const q = queue() || {}, c = store.get(COPY) || {}; return { queueSlim: q.slim === true, waitingInQueue: (q.dirty || []).length, changedInDatabaseCopy: inDb(), clientsInDatabaseCopy: Object.keys(c.clients || {}).length, workoutsInDatabaseCopy: Object.keys(c.trainings || {}).length, copyInLocalStorage: localStorage.getItem(COPY) != null }; };
const out = { stage: STAGE, mode: MODE };
await fns.boot(); await calm(STAGE === "A" ? 20000 : 60000);
if (STAGE === "A") {
  if (N > 100) { offline = true; navigator.onLine = false;             // the signal goes; one change in every workout (an exercise renamed everywhere, a restore)
    for (const id of ids) { maps.trainings.get(id).title = WORD; fns.scheduleSave("trainings", id); }
    await wait(2500); await calm(8000); }                               // the sends fail, the device keeps the work; then the app is closed
  out.closed = { ...device(), workouts: maps.trainings.size, queueFull: app.get().queueFull, changedOnServer: onServer() };
} else if (STAGE === "O") {
  out.before = { signedIn: app.get().signedIn, clientsInMemory: maps.clients.size };
  await fns.signOut(); await wait(300);
  out.after = { signedIn: app.get().signedIn, clientsInMemory: maps.clients.size, ...device() };
} else {
  out.after = { signedIn: app.get().signedIn, waitingInMemory: maps.dirty.size, changedOnScreen: ids.filter((id) => (maps.trainings.get(id) || {}).title === WORD).length, clientsInMemory: maps.clients.size, workoutsInMemory: maps.trainings.size,
    ...device(), queueFull: app.get().queueFull, saysNotSaved: /Not saved on this device/.test(status()), changedOnServer: onServer() };
}
if (STATE) fs.writeFileSync(STATE, JSON.stringify({ n: N, ls: Object.fromEntries(localStorage.map), idb: Object.fromEntries(store) }));
console.log(JSON.stringify(out));
process.exit(0);
