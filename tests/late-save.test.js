// The outside audit of 20 Nov 2026, #2 (v325, its first half). A save with no answer in time was given up on the phone but never cancelled: still on its way, it could
// reach the server after a newer save of the same thing and put the older value back, with nothing left waiting on the phone to put it right. The app's deadline
// helper (sync.js withTimeout) now cancels the request too, where the library can (a query or a rule call takes an abortSignal). A request that had already left the
// device can still land: only an order number on the server's side closes that (the second half, for a day with SQL); the last test pins it.
import { test, assert } from "./assert.js";
import { load } from "./load.js";
import { withTimeout } from "../app/sync.js";
const app = await load(); const { fns, maps } = app;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const quiet = () => { for (const tm of maps.timers.values()) clearTimeout(tm); maps.timers.clear(); clearTimeout(app.get().syncTimer); };
// a query as the library hands one out: nothing is sent until it is awaited, and it takes an abortSignal (postgrest-js answers a cancelled request with an error, it never throws)
const query = (ms, value) => { const q = { signal: null, sent: 0, abortSignal(s) { q.signal = s; return q; }, then(res, rej) { q.sent++; return new Promise((done) => { const tm = setTimeout(() => done(value), ms); if (q.signal) q.signal.addEventListener("abort", () => { clearTimeout(tm); done({ data: null, error: { message: "AbortError: The operation was aborted." } }); }); }).then(res, rej); } }; return q; };

test("(v325, the outside audit's #2) a query with no answer in time is given up and cancelled: one request was sent, its signal is aborted, and the caller hears a network timeout as before", async () => {
  const q = query(400, { data: "late", error: null });
  const out = await withTimeout(q, 20);
  assert.deepStrictEqual([out.error && out.error.message, out.data, q.sent, q.signal.aborted], ["network timeout", null, 1, true]);
});
test("(v325) a query answered in time is handed back as it is and never cancelled, not even once the deadline has passed", async () => {
  const q = query(5, { data: "in time", error: null });
  const out = await withTimeout(q, 40); await wait(70);
  assert.deepStrictEqual([out.data, out.error, q.sent, q.signal.aborted], ["in time", null, 1, false]);
});
test("(v325) what cannot be cancelled is only given up, as before: a plain promise (a sign-in check, a file, a move), and a query with no abortSignal (the tests' stand-in server)", async () => {
  let landed = false; const slow = new Promise((r) => setTimeout(() => { landed = true; r({ data: 1, error: null }); }, 60));
  const out = await withTimeout(slow, 15); assert.strictEqual(out.error.message, "network timeout"); await wait(80); assert.strictEqual(landed, true, "the promise ran on: nothing could stop it");
  assert.deepStrictEqual(await withTimeout(Promise.resolve({ data: 2, error: null }), 15), { data: 2, error: null });
  let sent = 0; const plain = { then(res, rej) { sent++; return Promise.resolve({ data: 3, error: null }).then(res, rej); } };
  assert.deepStrictEqual([await withTimeout(plain, 15), sent], [{ data: 3, error: null }, 1], "sent once");
  await assert.rejects(() => withTimeout(Promise.reject(new Error("boom")), 15), /boom/, "a rejection still reaches the caller");
});

// The client's "Weights in": kg picked, its save held up (no answer); lb picked instead and saved; then the line comes back. The stand-in line lets a held request
// through to the server only if it was not cancelled on the phone first (left: it had already left the phone, so cancelling it there stops nothing).
const phone = (left) => {
  const server = { unit: "lb", got: [] }, held = [];
  const sb = { auth: { getSession: async () => ({ data: { session: {} } }) }, rpc(name, a) {
    const q = { signal: null, abortSignal(s) { q.signal = s; return q; }, then(res, rej) { return new Promise((done) => {
      const land = () => { if (name === "client_set_profile") { server.unit = a.p_value; server.got.push(a.p_value); } done({ data: null, error: null }); };
      if (name !== "client_set_profile" || a.p_value !== "kg") return land();
      const req = { cancelled: false, land }; held.push(req);
      if (q.signal) q.signal.addEventListener("abort", () => { if (!left) req.cancelled = true; done({ data: null, error: { message: "AbortError: The operation was aborted." } }); });
    }).then(res, rej); } };
    return q;
  } };
  return { server, sb, lineBack: () => { for (const r of held.splice(0)) if (!r.cancelled) r.land(); } };
};
const pickKgThenLb = async (p) => {
  app.reset(); app.set({ signedIn: true, sessionEmail: "client@x.com", clientMode: true, myClientId: "c1", saveWait: 20, backend: fns.clientBackend, sb: p.sb });
  maps.clients.set("c1", { id: "c1", name: "Jane Testperson", unit: "kg" }); maps.pendingProfile.set("c1", new Set(["unit"])); fns.markDirty("clients", "c1");
  await fns.flushOne("clients", "c1"); quiet();                                           // kg: no answer in time
  const waiting = maps.dirty.has("clients/c1") && (maps.pendingProfile.get("c1") || new Set()).has("unit");
  maps.clients.get("c1").unit = "lb"; maps.pendingProfile.set("c1", new Set(["unit"])); fns.markDirty("clients", "c1");
  await fns.flushOne("clients", "c1"); quiet();                                           // lb: saved
  const saved = { server: p.server.unit, waiting: maps.dirty.has("clients/c1") };
  p.lineBack(); await wait(10); quiet();
  return { waiting, saved, serverAfter: p.server.unit, phone: maps.clients.get("c1").unit, got: p.server.got.slice() };
};
test("(v325, the outside audit's #2) Weights in: kg picked and its save held up, lb picked instead and saved, then the line comes back: the kg save was cancelled when its wait ran out and never reaches the server (it landed after lb and put kg back, the phone saying lb with nothing waiting)", async () => {
  const r = await pickKgThenLb(phone(false));
  assert.deepStrictEqual(r, { waiting: true, saved: { server: "lb", waiting: false }, serverAfter: "lb", phone: "lb", got: ["lb"] });
  await wait(30); quiet(); app.reset();
});
test("(v325, a known limit pinned: the second half of #2 needs the server's order number) a kg save that had already left the phone when its wait ran out still lands after lb: cancelling on the phone cannot call it back", async () => {
  const r = await pickKgThenLb(phone(true));
  assert.deepStrictEqual([r.saved.server, r.serverAfter, r.phone, r.got], ["lb", "kg", "lb", ["lb", "kg"]]);
  await wait(30); quiet(); app.reset();
});
