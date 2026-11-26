// The outside audit of 20 Nov 2026, #5 (tests/queue-full.test.js): the unsent queue lives in localStorage (about 2.6 million characters). With hundreds of records
// waiting its write failed with no word: the device copy (the database) held the edits, and after a relaunch none of them was waiting, so the next sync put the
// server's older copies back. A stand-in database (devicecopy-probe's), a localStorage that refuses the queue past its room, the real sync.js through main.js and
// its own boot, a stand-in server, real timers.
//   node queue-full-probe.mjs        a browser with the database
//   node queue-full-probe.mjs nodb   a browser with none
const NODB = process.argv[2] === "nodb";
const store = new Map(); let failPut = false, hangPut = false;
const request = () => ({ onsuccess: null, onerror: null, result: undefined, error: null });
const db = {
  createObjectStore() {}, close() {},
  transaction() {
    const tx = { oncomplete: null, onerror: null, onabort: null }, end = (ok) => setTimeout(() => (ok ? tx.oncomplete && tx.oncomplete() : tx.onerror && tx.onerror()), 0);
    tx.objectStore = () => ({
      get(k) { const r = request(); setTimeout(() => { r.result = store.has(k) ? structuredClone(store.get(k)) : undefined; if (r.onsuccess) r.onsuccess(); }, 0); return r; },
      put(v, k) { const val = structuredClone(v), r = request(); setTimeout(() => { if (hangPut) return; if (failPut) return end(false); store.set(k, val); if (r.onsuccess) r.onsuccess(); end(true); }, 0); return r; },   // cloned at the call, as a database does; hangPut: the app is closed before the write ends
      delete(k) { const r = request(); setTimeout(() => { store.delete(k); if (r.onsuccess) r.onsuccess(); end(true); }, 0); return r; },
    });
    return tx;
  },
};
if (!NODB) globalThis.indexedDB = { open() { const r = request(); setTimeout(() => { r.result = db; if (r.onupgradeneeded) r.onupgradeneeded(); if (r.onsuccess) r.onsuccess(); }, 0); return r; } };
await import("./env.js");
const { load } = await import("./load.js");
const { makeSupabase } = await import("./fake-supabase.js");
const app = await load(); const { fns, maps } = app;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const settle = async () => { const until = Date.now() + 60000; do await wait(5); while ((app.get().inflight > 0 || maps.timers.size) && Date.now() < until); };
const quiet = () => { for (const tm of maps.timers.values()) clearTimeout(tm); maps.timers.clear(); clearTimeout(app.get().syncTimer); };
const QUEUE = "fiala.pending.v1", COPY = "fiala.trainings.v1", ROOM = 2600000; let refused = 0;
{ const put = localStorage.setItem.bind(localStorage); localStorage.setItem = (k, v) => { if (k === QUEUE && String(v).length > ROOM) { refused++; throw new Error("QuotaExceededError"); } return put(k, v); }; }   // WebKit's room for one key, measured for v306: only the queue is held to it here
const queue = () => { try { return JSON.parse(localStorage.getItem(QUEUE)); } catch (_) { return null; } };
const status = () => { fns.setStatus(); return String(document.getElementById("status").textContent || ""); };
const N = 350, ids = Array.from({ length: N }, (_, i) => "t" + String(i).padStart(3, "0")), K = (id) => "trainings/" + id, LAST = ids[N - 1];
const big = (id) => ({ id, clientId: "c1", title: "Workout", date: "2026-11-20", createdAt: "2026-11-01T10:00:00.000Z", completedAt: null, skippedAt: null,
  rows: Array.from({ length: 10 }, (_, j) => ({ id: "r" + j, label: String(j + 1), name: "Squat", sets: 3, reps: "8", note: "x".repeat(500), weights: [], repsDone: [], setsDone: 0, done: false, alts: [] })) });
const signIn = (sb) => app.set({ sb, signedIn: true, clientMode: false, backend: fns.cloudBackend, sessionEmail: "coach@x.com", view: { name: "clients" }, offline: false, offlineEntry: null });
const start = async () => {                                            // the coach's device, signed in, everything read from the server
  quiet(); app.reset(); store.clear(); failPut = false; hangPut = false; refused = 0; fns.leaveSettings();
  const sb = makeSupabase(); signIn(sb);
  localStorage.setItem("fiala.trainings.role", JSON.stringify({ email: "coach@x.com", role: "trainer" }));
  sb.seed("ft_clients", "c1", { id: "c1", name: "Jane Testperson", unit: "lb", email: "jane@x.com" });
  for (const id of ids) sb.seed("ft_trainings", id, big(id), { client_id: "c1" });
  if (!NODB) await fns.localBackend.loadDb();
  await fns.syncDownNow(); await settle();
  return sb;
};
const editAll = (word, list = ids) => { for (const id of list) { maps.trainings.get(id).title = word; fns.scheduleSave("trainings", id); } quiet(); };   // each change as the app makes it (the queue written at every one); no signal: nothing is sent
const relaunch = async (sb) => {                                       // the app closed and opened again: what the device kept, and main.js's own boot
  const keep = [QUEUE, "fiala.pending.tab", "fiala.trainings.role"].map((k) => [k, localStorage.getItem(k)]);
  quiet(); app.reset(); for (const [k, v] of keep) if (v != null) localStorage.setItem(k, v);
  await fns.boot(); signIn(sb);
};
const out = {};

if (NODB) {                                                             // no database: the queue cannot give its heavy parts to the device copy, so the bar says so
  const sb = await start();
  editAll("Changed with no signal");
  out.nodb = { refused: refused > 0, queueFull: app.get().queueFull, status: status(), waitingInMemory: maps.dirty.size };
  for (const id of ids.slice(3)) maps.dirty.delete(K(id)); fns.persistPending();   // most of it sent: the queue fits again
  out.nodbFits = { queueFull: app.get().queueFull, status: status(), stored: (queue() || { dirty: [] }).dirty.length };
  void sb; console.log(JSON.stringify(out)); process.exit(0);
}

{ // 350 changed workouts waiting at once: the queue does not fit, the short one is kept, and nothing is said (nothing is lost)
  const sb = await start(); const stamp = maps.seenAt.get(K(LAST));
  editAll("Changed with no signal"); await wait(120);                  // the device copy's write, then the short queue
  const q = queue() || {}, copy = store.get(COPY) || { trainings: {}, bases: {} };
  out.kept = { refused: refused > 0, slim: q.slim === true, waiting: (q.dirty || []).length, recs: (q.recs || []).length, docs: (q.docs || []).length, stamps: (q.stamps || []).length, queueChars: (localStorage.getItem(QUEUE) || "").length < ROOM,
    queueFull: app.get().queueFull, deviceFull: app.get().deviceFull, warned: /Not saved/.test(status()), newestInCopy: (copy.trainings[LAST] || {}).title, basesInCopy: Object.keys(copy.bases || {}).length };
  await relaunch(sb);
  out.relaunched = { waiting: maps.dirty.size, newest: (maps.trainings.get(LAST) || {}).title, newestWaits: maps.dirty.has(K(LAST)), stampAsRead: maps.seenAt.get(K(LAST)) === stamp, baseAsRead: JSON.parse(maps.seenDoc.get(K(LAST)) || "{}").title };
  await fns.syncDownNow(); await settle(); quiet();                   // the next sync: the server still holds the older copies
  out.afterSync = { newest: (maps.trainings.get(LAST) || {}).title, changedHere: ids.filter((id) => (maps.trainings.get(id) || {}).title === "Changed with no signal").length };
  for (const id of ids) fns.scheduleSave("trainings", id); await settle();   // the signal is back: everything waiting goes
  out.sent = { onServer: ids.filter((id) => sb.tables.ft_trainings.get(id).data.title === "Changed with no signal").length, waiting: maps.dirty.size };
  fns.persistPending(); fns.localBackend.save(); await wait(300);   // the queue fits again; the device copy's next write drops what it carried for the short one
  const q2 = queue() || {}, copy2 = store.get(COPY) || {};
  out.drained = { slim: q2.slim === true, waiting: (q2.dirty || []).length, queueFull: app.get().queueFull, basesInCopy: copy2.bases ? Object.keys(copy2.bases).length : 0 };
}
{ // a waiting record's stamp and copy read are the device copy's own, of the same write as the record: never a newer stamp or a newer copy read the page learned after it
  const sb = await start(); const stamp = maps.seenAt.get(K(LAST));
  editAll("First change"); await wait(120);                           // on the device: the short queue, and the copy with every record, stamp and copy read
  hangPut = true;                                                      // from here on the app is closed before any write of the database ends
  maps.seenAt.set(K(LAST), "2099-01-01T00:00:00.000000+00:00"); maps.seenDoc.set(K(LAST), JSON.stringify({ ...big(LAST), title: "The other device's change" }));   // a save of it landed meanwhile, merged with the other device's change...
  maps.trainings.get(LAST).title = "Second change"; fns.scheduleSave("trainings", LAST); quiet(); await wait(60);   // ...and it was changed again
  const q = queue() || {};
  hangPut = false; await relaunch(sb);
  out.oneMoment = { slim: q.slim === true, stampsInQueue: (q.stamps || []).length, record: (maps.trainings.get(LAST) || {}).title, waits: maps.dirty.has(K(LAST)), stampIsTheCopys: maps.seenAt.get(K(LAST)) === stamp, baseIsTheCopys: JSON.parse(maps.seenDoc.get(K(LAST)) || "{}").title };
}
{ // the database refuses its write (a full device) while the queue does not fit: nothing short is written beside an older copy, and the bar says the device is not saving
  await start();
  failPut = true; editAll("Changed on a full device"); await wait(120);
  const q = queue() || {};
  out.fullDevice = { queueFull: app.get().queueFull, deviceFull: app.get().deviceFull, status: status(), shortWritten: q.slim === true, lastOneThatFit: (q.dirty || []).length > 0 && (q.dirty || []).length < N && (q.recs || []).length === (q.dirty || []).length };   // what stays on the device: the last queue that fitted, whole, each waiting record with it
  failPut = false; for (const id of ids.slice(3)) maps.dirty.delete(K(id)); fns.persistPending(); await wait(120);   // room again, and the queue fits
  out.fullDeviceOver = { queueFull: app.get().queueFull, stored: (queue() || { dirty: [] }).dirty.length };
}
console.log(JSON.stringify(out));
process.exit(0);
