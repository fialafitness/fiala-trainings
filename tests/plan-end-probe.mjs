// The audit of 15 Nov 2026, #22 (tests/plan-end.test.js): a client in Hawaii on the last day of a monthly plan. Just after midnight in Los
// Angeles the server's day is past the plan, so client_my_data sends no workouts, while the phone's day is still the last one. The client's
// finish and logged sets are still queued: they must stay. Run with TZ=Pacific/Honolulu; the clock is pinned at 08:30 UTC on 16 Nov 2026.
const FIXED = Date.parse("2026-11-16T08:30:00.000Z");                   // Los Angeles: 16 Nov, 00:30; Honolulu: 15 Nov, 22:30
const Real = Date;
class Pinned extends Real { constructor(...a) { if (a.length) super(...a); else super(FIXED); } static now() { return FIXED; } }
globalThis.Date = Pinned;
await import("./env.js");
const { makeSupabase } = await import("./fake-supabase.js");
const { load } = await import("./load.js");
const app = await load(); const { fns, maps } = app;
const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms));
const settle = async () => { const until = performance.now() + 15000; do await tick(5); while ((app.get().inflight > 0 || maps.timers.size) && performance.now() < until); };
const sb = makeSupabase();
app.reset(); app.set({ sb, signedIn: true, clientMode: true, myClientId: "c1", backend: fns.clientBackend });
const phoneDay = fns.today(), plan = { id: "m", name: "Monthly plan", kind: "monthly", until: phoneDay };
maps.clients.set("c1", { id: "c1", name: "Jane", email: "jane@test", unit: "lb", plan });
sb.rpcs.client_my_data = async () => ({ clients: [{ id: "c1", data: { name: "Jane", email: "jane@test", unit: "lb", plan } }], trainings: [] });
const t = { id: "T", clientId: "c1", title: "Pull", date: phoneDay, createdAt: "2026-10-01T10:00:00.000Z", completedAt: new Date().toISOString(), skippedAt: null,
  rows: [{ id: "r1", label: "1", name: "Deadlift", sets: 3, reps: "5", weights: ["225", "225", "235"], repsDone: ["5", "5", "5"], setsDone: 3, done: true, unit: "lb", note: "", alts: [] }] };
maps.trainings.set("T", t); maps.dirty.set("trainings/T", 1); maps.pendingFinish.add("T"); maps.pendingWeightRows.set("T", new Set(["r1"]));
await fns.syncDownNow(); await settle();
app.set({ view: { name: "client", id: "c1" }, tab: "workouts" }); fns.render();   // v315: the client page as the phone shows it now (the server already holds the workouts back)
const $ = (id) => document.getElementById(id);
const { daysLater } = await import("../app/util.js");
const words = (until) => fns.packWords({ id: "x", name: "X", plan: { id: "m", name: "Monthly plan", kind: "monthly", until } });   // the coach's Clients list (v315: on the later of the two days)
console.log(JSON.stringify({ phoneDay, finish: maps.pendingFinish.has("T"), sets: maps.pendingWeightRows.has("T"), dirty: maps.dirty.has("trainings/T"), onDevice: maps.trainings.has("T"),
  view: app.get().view.name, kicker: $("pausedKicker").hidden ? "" : $("pausedKicker").textContent, card: !$("pausedCard").hidden, cardText: $("pausedText").textContent, planBig: $("planBig").textContent, listEnded: words(phoneDay), listNext: words(daysLater(phoneDay, 1)) }));
process.exit(0);
