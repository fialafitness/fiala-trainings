// Run by relaunch-merge.test.js in its own process (v316, the twenty-second check round): the device copy moved from localStorage into the
// browser's database at a launch keeps the server's stamps. A launch that could not open the database left its copy (with the stamps) in
// localStorage; the next launch opens the database and moves the copy over (loadDb), then closes with nothing saved again; the launch after
// that edits a workout deleted on the iPad meanwhile, before its first sync: it stays deleted (the stamps were lost in the move, copyOf ran
// before seedBases took them in, and the edit wrote the workout back). Prints one JSON line. Made-up people only.
const store = new Map();
const request = () => ({ onsuccess: null, onerror: null, result: undefined, error: null });
const db = {
  createObjectStore() {}, close() {},
  transaction() {
    const tx = { oncomplete: null, onerror: null, onabort: null }, end = (ok) => setTimeout(() => (ok ? tx.oncomplete && tx.oncomplete() : tx.onerror && tx.onerror()), 0);
    tx.objectStore = () => ({
      get(k) { const r = request(); setTimeout(() => { r.result = store.has(k) ? structuredClone(store.get(k)) : undefined; if (r.onsuccess) r.onsuccess(); }, 0); return r; },
      put(v, k) { const val = structuredClone(v), r = request(); setTimeout(() => { store.set(k, val); if (r.onsuccess) r.onsuccess(); end(true); }, 0); return r; },
      delete(k) { const r = request(); setTimeout(() => { store.delete(k); if (r.onsuccess) r.onsuccess(); end(true); }, 0); return r; },
    });
    return tx;
  },
};
globalThis.indexedDB = { open() { const r = request(); setTimeout(() => { r.result = db; if (r.onupgradeneeded) r.onupgradeneeded(); if (r.onsuccess) r.onsuccess(); }, 0); return r; } };
await import("./env.js");
const { load } = await import("./load.js");
const { makeSupabase } = await import("./fake-supabase.js");
const app = await load(); const { fns, maps } = app;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const settle = async () => { const until = Date.now() + 15000; do await wait(5); while ((app.get().inflight > 0 || maps.timers.size) && Date.now() < until); };
const COPY = "fiala.trainings.v1", C = "c1", W = "w1", WK = "trainings/" + W;
const quiet = () => { for (const tm of maps.timers.values()) clearTimeout(tm); maps.timers.clear(); clearTimeout(app.get().syncTimer); };
const relaunch = async (sb) => {
  const keep = ["fiala.pending.v1", COPY].map((k) => [k, localStorage.getItem(k)]);
  quiet(); app.reset(); for (const [k, v] of keep) if (v != null) localStorage.setItem(k, v);
  localStorage.setItem("fiala.trainings.role", JSON.stringify({ email: "coach@x.com", role: "trainer" }));
  await fns.boot();
  app.set({ sb, signedIn: true, clientMode: false, backend: fns.cloudBackend, sessionEmail: "coach@x.com", view: { name: "clients" }, offline: false, offlineEntry: null });
};
const out = {};
const sb = makeSupabase(); app.reset(); fns.leaveSettings(); app.set({ sb, signedIn: true, clientMode: false, backend: fns.cloudBackend, sessionEmail: "coach@x.com", view: { name: "clients" } });
sb.seed("ft_clients", C, { id: C, name: "Jane Testperson", unit: "lb", email: "jane@x.com" });
sb.seed("ft_trainings", W, { id: W, clientId: C, title: "Legs", date: "2026-11-27", createdAt: "2026-11-10T16:00:00.000Z", completedAt: null, skippedAt: null, rows: [{ id: "sq", label: "1", name: "Back squat", sets: 4, reps: "8", weights: [], done: false }] }, { client_id: C });
await fns.syncDownNow(); await settle();                                  // a launch whose database never opened: its copy went to localStorage
{ const ls = JSON.parse(localStorage.getItem(COPY) || "null"); out.launchA = { inLocalStorage: !!ls, stamp: !!(ls && ls.seen && ls.seen[WK]) }; }
await relaunch(sb); await wait(400);                                      // the next launch opens the database and moves the copy over; nothing saved after (closed, no signal)
{ const d = store.get(COPY); out.launchB = { inDb: !!d, stampInDb: !!(d && d.seen && d.seen[WK]), stampInMemory: maps.seenAt.has(WK), leftInLocalStorage: localStorage.getItem(COPY) !== null }; }
sb.tables.ft_trainings.delete(W);                                         // the iPad: Delete workout, while the Mac is closed
await relaunch(sb);                                                       // the launch after: the copy from the database
out.launchC = { stamp: maps.seenAt.has(WK), copy: maps.seenDoc.has(WK) };
maps.trainings.get(W).title = "Legs B"; fns.scheduleSave("trainings", W); await settle();   // the Mac renames Legs before its first sync
out.launchC.writtenAgain = sb.tables.ft_trainings.has(W);
console.log(JSON.stringify(out));
process.exit(0);
