// The audit of 15 Nov 2026, #1 (tests/devicecopy.test.js): the device copy lives in the browser's database (IndexedDB), with far more room
// than localStorage's 2.6 million characters. A stand-in database, the real sync.js through main.js, real timers.
const store = new Map(); let failPut = false;
const request = () => ({ onsuccess: null, onerror: null, result: undefined, error: null });
const db = {
  createObjectStore() {}, close() {},
  transaction() {
    const tx = { oncomplete: null, onerror: null, onabort: null }, end = (ok) => setTimeout(() => (ok ? tx.oncomplete && tx.oncomplete() : tx.onerror && tx.onerror()), 0);
    tx.objectStore = () => ({
      get(k) { const r = request(); setTimeout(() => { r.result = store.has(k) ? structuredClone(store.get(k)) : undefined; if (r.onsuccess) r.onsuccess(); }, 0); return r; },
      put(v, k) { const val = structuredClone(v), r = request(); setTimeout(() => { if (failPut) return end(false); store.set(k, val); if (r.onsuccess) r.onsuccess(); end(true); }, 0); return r; },   // cloned at the call, as a database does
      delete(k) { const r = request(); setTimeout(() => { store.delete(k); if (r.onsuccess) r.onsuccess(); end(true); }, 0); return r; },
    });
    return tx;
  },
};
globalThis.indexedDB = { open() { const r = request(); setTimeout(() => { r.result = db; if (r.onupgradeneeded) r.onupgradeneeded(); if (r.onsuccess) r.onsuccess(); }, 0); return r; } };
await import("./env.js");
const { load } = await import("./load.js");
const app = await load(); const { fns, maps } = app;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const COPY = "fiala.trainings.v1", T = (id) => ({ id, clientId: "c1", title: id, date: "2026-11-15", createdAt: "2026-11-01T10:00:00.000Z", rows: [] });
const out = {};
// a launch on a device holding a copy of a release before v306: it moves over and leaves localStorage
app.reset(); app.set({ clientMode: false });
localStorage.setItem(COPY, JSON.stringify({ clients: { c1: { id: "c1", name: "Jane" } }, trainings: { A: T("A") } }));
fns.localBackend.load(); const dbUsed = await fns.localBackend.loadDb();
out.moved = { dbUsed, inMemory: maps.trainings.has("A"), inDb: !!(store.get(COPY) && store.get(COPY).trainings.A), leftInLocalStorage: localStorage.getItem(COPY) !== null };
// saves go to the database (one write for a burst), never to localStorage
maps.trainings.set("B", T("B")); for (let i = 0; i < 5; i++) fns.localBackend.save();
await wait(250);
out.saved = { inDb: !!store.get(COPY).trainings.B, inLocalStorage: localStorage.getItem(COPY) !== null, full: app.get().deviceFull };
// a big copy (6 million characters, past localStorage's room) is kept whole
maps.trainings.set("BIG", { ...T("BIG"), note: "x".repeat(6000000) }); fns.localBackend.save(); await wait(250);
out.big = { inDb: !!store.get(COPY).trainings.BIG && store.get(COPY).trainings.BIG.note.length === 6000000, full: app.get().deviceFull };
maps.trainings.delete("BIG"); fns.localBackend.save(); await wait(250);
// the next launch reads it back from the database
maps.clients.clear(); maps.trainings.clear(); fns.localBackend.load(); await fns.localBackend.loadDb();
out.nextLaunch = { A: maps.trainings.has("A"), B: maps.trainings.has("B"), c1: maps.clients.has("c1") };
// a write the database refuses (a full device) is reported, as before
failPut = true; fns.localBackend.save(); await wait(250); out.refused = { full: app.get().deviceFull }; failPut = false; fns.localBackend.save(); await wait(250); out.refused.after = app.get().deviceFull;
// a sign-out leaves nothing of the account on the device
await fns.localBackend.wipe(); out.wiped = { inDb: store.has(COPY), inLocalStorage: localStorage.getItem(COPY) !== null };
// a damaged copy (the wrong shape) no longer stops the launch
maps.trainings.clear(); localStorage.setItem(COPY, "[]"); let threw = false; try { fns.localBackend.load(); } catch (_) { threw = true; } out.damaged = { threw, empty: maps.trainings.size === 0 };
console.log(JSON.stringify(out));
process.exit(0);
