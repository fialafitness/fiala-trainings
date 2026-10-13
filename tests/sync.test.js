"use strict";
const { test, assert, tick } = require("./assert");
const { makeSupabase } = require("./fake-supabase");
const env = require("./env");
const app = require("./load")();
const { fns, maps } = app;
const day = (n) => { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + n); return fns.localIso(d); };
const row = (id, w, r, done) => ({ id, label: "1", name: "Deadlift", sets: 3, reps: "5", rest: "90 sec", tempo: "", weights: w || [], repsDone: r || [], setsDone: done || 0, done: (done || 0) >= 3, note: "", alts: [] });
const training = (id, extra) => ({ id, clientId: "c1", title: "Pull", date: day(0), createdAt: "2026-10-01T10:00:00.000Z", completedAt: null, skippedAt: null, rows: [row("r1")], ...(extra || {}) });
const coach = (sb) => { app.reset(); app.set({ sb, signedIn: true, clientMode: false, backend: fns.cloudBackend }); maps.clients.set("c1", { id: "c1", name: "Jane", unit: "lb" }); };

test("fetchAll pages through more than 1,000 rows and reports a complete answer", async () => {
  const sb = makeSupabase(); coach(sb);
  for (let i = 0; i < 2500; i++) sb.seed("ft_trainings", "t" + String(i).padStart(5, "0"), training("t" + i));
  const res = await fns.fetchAll("ft_trainings");
  assert.strictEqual(res.error, null); assert.strictEqual(res.complete, true); assert.strictEqual(res.data.length, 2500);
  assert.strictEqual(sb.log.filter((l) => l.op === "select").length, 3);
});
test("fetchAll reports an incomplete answer when a page fails, and keeps what it got", async () => {
  const sb = makeSupabase(); coach(sb);
  for (let i = 0; i < 1500; i++) sb.seed("ft_trainings", "t" + String(i).padStart(5, "0"), training("t" + i));
  sb.setFail({ table: "ft_trainings", op: "select", times: 1, message: "network timeout" });
  const res = await fns.fetchAll("ft_trainings");
  assert.ok(res.error); assert.strictEqual(res.complete, false); assert.strictEqual(res.data.length, 0);
});
test("mergeDown keeps records missing from a partial answer, and drops them only after a complete one", () => {
  app.reset(); app.set({ clientMode: false });
  maps.trainings.set("A", training("A")); maps.trainings.set("B", training("B"));
  fns.mergeDown(maps.trainings, "trainings", [{ id: "A", data: training("A", { title: "Server A" }), updated_at: "S9" }], false, Date.now());
  assert.ok(maps.trainings.has("B"), "partial answer must not delete B"); assert.strictEqual(maps.trainings.get("A").title, "Server A");
  fns.mergeDown(maps.trainings, "trainings", [{ id: "A", data: training("A"), updated_at: "S10" }], true, Date.now());
  assert.ok(!maps.trainings.has("B"), "complete answer deletes B");
});
test("mergeDown leaves a record with unsent edits alone, data and stamp", () => {
  app.reset(); app.set({ clientMode: false });
  maps.trainings.set("A", training("A", { title: "Mine" })); maps.seenAt.set("trainings/A", "S1"); maps.dirty.set("trainings/A", 1);
  fns.mergeDown(maps.trainings, "trainings", [{ id: "A", data: training("A", { title: "Theirs" }), updated_at: "S2" }], true, Date.now());
  assert.strictEqual(maps.trainings.get("A").title, "Mine"); assert.strictEqual(maps.seenAt.get("trainings/A"), "S1");
});
test("mergeDown skips the workout being edited and keeps its old stamp, so the next save conflicts and merges", () => {
  app.reset(); app.set({ clientMode: false, renderedTraining: "A" });
  document.getElementById("rows").contains = () => true;              // an input inside #rows has focus
  try {
    maps.trainings.set("A", training("A", { title: "Typing" })); maps.seenAt.set("trainings/A", "S1");
    fns.mergeDown(maps.trainings, "trainings", [{ id: "A", data: training("A", { title: "Theirs" }), updated_at: "S2" }], true, Date.now());
    assert.strictEqual(maps.trainings.get("A").title, "Typing"); assert.strictEqual(maps.seenAt.get("trainings/A"), "S1", "stamp must stay with the old document");
  } finally { document.getElementById("rows").contains = () => false; }
});
test("mergeDown takes the stamp and clears the coach's state flags only for records it actually takes", () => {
  app.reset(); app.set({ clientMode: false });
  maps.trainings.set("A", training("A")); maps.trainings.set("B", training("B"));
  maps.trainerState.set("A", new Set(["completedAt"])); maps.trainerState.set("B", new Set(["date"])); maps.pendingMove.add("B");
  fns.mergeDown(maps.trainings, "trainings", [{ id: "A", data: training("A"), updated_at: "S5" }, { id: "B", data: training("B", { title: "Theirs" }), updated_at: "S6" }], true, Date.now());
  assert.strictEqual(maps.seenAt.get("trainings/A"), "S5"); assert.ok(!maps.trainerState.has("A"));
  assert.strictEqual(maps.seenAt.get("trainings/B"), undefined, "a record kept for its pending move keeps no new stamp"); assert.ok(maps.trainerState.has("B")); assert.strictEqual(maps.trainings.get("B").title, "Pull");
});
test("on a conflict the coach's title lands, and the client's finish and logged sets survive", async () => {
  const sb = makeSupabase(); coach(sb);
  const server = training("T", { title: "Old", completedAt: "2026-10-12T18:00:00.000Z", rows: [row("r1", ["100", "100", "105"], ["5", "5", "4"], 3)] });
  sb.seed("ft_trainings", "T", server, { client_id: "c1" });
  maps.seenAt.set("trainings/T", "S0");                               // this device last saw an older version
  const local = training("T", { title: "New title" }); maps.trainings.set("T", local);
  await fns.cloudBackend.set("trainings", "T", JSON.parse(JSON.stringify(local)));
  const saved = sb.tables.ft_trainings.get("T").data;
  assert.strictEqual(saved.title, "New title"); assert.strictEqual(saved.completedAt, server.completedAt, "the client's finish must survive"); assert.deepStrictEqual(saved.rows[0].weights, ["100", "100", "105"]);
  assert.strictEqual(maps.trainings.get("T").completedAt, server.completedAt, "the live copy learns the finish too");
});
test("on a conflict a field the coach changed wins, field by field", async () => {
  const sb = makeSupabase(); coach(sb);
  sb.seed("ft_trainings", "T", training("T", { completedAt: "2026-10-12T18:00:00.000Z", skippedAt: null, date: day(-1) }), { client_id: "c1" });
  maps.seenAt.set("trainings/T", "S0");
  const local = training("T", { completedAt: null, date: day(2) }); maps.trainings.set("T", local);
  fns.touchState("T", "completedAt");                                 // the coach pressed Undo on the finish, but did not move it
  await fns.cloudBackend.set("trainings", "T", JSON.parse(JSON.stringify(local)));
  const saved = sb.tables.ft_trainings.get("T").data;
  assert.strictEqual(saved.completedAt, null, "the coach's undo wins"); assert.strictEqual(saved.date, day(-1), "the date was not the coach's change: the server's stays");
});
test("a save with no stamp reads first and still keeps the client's finish", async () => {
  const sb = makeSupabase(); coach(sb);
  sb.seed("ft_trainings", "T", training("T", { completedAt: "2026-10-12T18:00:00.000Z" }), { client_id: "c1" });
  const local = training("T", { title: "Edited offline" }); maps.trainings.set("T", local);
  await fns.cloudBackend.set("trainings", "T", JSON.parse(JSON.stringify(local)));
  const saved = sb.tables.ft_trainings.get("T").data;
  assert.strictEqual(saved.title, "Edited offline"); assert.strictEqual(saved.completedAt, "2026-10-12T18:00:00.000Z");
});
test("the coach's state flag is persisted across a relaunch and cleared only by the save that carried it", async () => {
  const sb = makeSupabase(); coach(sb); sb.delayMs = 30;
  sb.seed("ft_trainings", "T", training("T"), { client_id: "c1" }); maps.seenAt.set("trainings/T", sb.tables.ft_trainings.get("T").updated_at);
  const t = training("T"); maps.trainings.set("T", t);
  t.completedAt = "2026-10-13T10:00:00.000Z"; fns.touchState("T", "completedAt"); fns.scheduleSave("trainings", "T", 0);
  await tick(5);                                                      // the save is on the wire with its snapshot
  fns.persistPending(); const stored = JSON.parse(localStorage.getItem("fiala.pending.v1"));
  assert.deepStrictEqual(stored.state, [["T", ["completedAt"]]], "flag written to the device");
  t.date = day(3); fns.touchState("T", "date"); fns.markDirty("trainings", "T");   // a second change while the first save is in flight
  await tick(80);
  assert.ok(maps.trainerState.has("T") && maps.trainerState.get("T").has("date"), "the later change keeps its flag");
  assert.ok(maps.dirty.has("trainings/T"), "and stays queued");
  maps.trainerState.clear(); fns.restorePending(); assert.ok(maps.trainerState.get("T").has("completedAt"), "restored from the device");
});
test("a client's finish reaches the server before a move, so the move is not refused", async () => {
  const sb = makeSupabase(); app.reset(); app.set({ sb, signedIn: true, clientMode: true, myClientId: "c1", backend: fns.clientBackend });
  const order = []; for (const n of ["client_finish_training", "client_skip_training", "client_move_training", "client_miss_training"]) sb.rpcs[n] = async () => { order.push(n); return null; };
  const t = training("T", { completedAt: "2026-10-13T10:00:00.000Z", date: day(0), missed: false }); maps.trainings.set("T", t);
  maps.pendingFinish.add("T"); maps.pendingSkip.add("T"); maps.pendingMove.add("T"); maps.pendingMiss.add("T");
  await fns.clientBackend.set("trainings", "T", JSON.parse(JSON.stringify(t)));
  assert.deepStrictEqual(order, ["client_finish_training", "client_skip_training", "client_move_training", "client_miss_training"]);
  assert.strictEqual(sb.log.find((l) => l.rpc === "client_miss_training").args.p_missed, false);
  assert.ok(!maps.pendingMove.has("T") && !maps.pendingMiss.has("T") && !maps.pendingFinish.has("T") && !maps.pendingSkip.has("T"));
});
test("a rule not installed yet keeps the client's decision on the device and does not stop the rest", async () => {
  const sb = makeSupabase(); app.reset(); app.set({ sb, signedIn: true, clientMode: true, myClientId: "c1", backend: fns.clientBackend });
  sb.rpcs.client_finish_training = async () => null; sb.rpcs.client_skip_training = async () => null;   // move and miss rules missing
  const t = training("T", { date: day(0), missed: false }); maps.trainings.set("T", t);
  maps.pendingMove.add("T"); maps.pendingMiss.add("T"); maps.pendingFinish.add("T");
  await fns.clientBackend.set("trainings", "T", JSON.parse(JSON.stringify(t)));
  assert.ok(app.get().moveMissing && app.get().missMissing); assert.ok(maps.pendingMove.has("T") && maps.pendingMiss.has("T"), "kept for a later launch"); assert.ok(!maps.pendingFinish.has("T"));
});
test("the device copy reports when it cannot be written", () => {
  app.reset(); app.set({ backend: fns.localBackend });
  env.storage.fail = true;
  try { fns.localBackend.save(); assert.strictEqual(app.get().deviceFull, true); fns.setStatus(); assert.ok(/Not saved on this device/.test(document.getElementById("status").textContent)); }
  finally { env.storage.fail = false; fns.localBackend.save(); assert.strictEqual(app.get().deviceFull, false); }
});
