import { test, assert, tick } from "./assert.js";
import { makeSupabase } from "./fake-supabase.js";
import * as env from "./env.js";
import { load } from "./load.js";
const app = await load();
const { fns, maps } = app;
const day = (n) => { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + n); return fns.localIso(d); };
const row = (id, w, r, done) => ({ id, label: "1", name: "Deadlift", sets: 3, reps: "5", rest: "90 sec", tempo: "", weights: w || [], repsDone: r || [], setsDone: done || 0, done: (done || 0) >= 3, note: "", alts: [] });
const training = (id, extra) => ({ id, clientId: "c1", title: "Pull", date: day(0), createdAt: "2026-10-01T10:00:00.000Z", completedAt: null, skippedAt: null, rows: [row("r1")], ...(extra || {}) });
const coach = (sb) => { app.reset(); app.set({ sb, signedIn: true, clientMode: false, backend: fns.cloudBackend }); maps.clients.set("c1", { id: "c1", name: "Jane", unit: "lb" }); };
const settle = async () => {   // every save this test started has answered, and none is still waiting to go: nothing of it runs on into the next test
  const until = Date.now() + 15000;                                   // generous: a save the server keeps refusing is tried four times over up to 5.4 s
  do await tick(5); while ((app.get().inflight > 0 || maps.timers.size) && Date.now() < until);
  assert.strictEqual(app.get().inflight, 0, "every save has answered (below zero: a save of an earlier test ended in this one)"); assert.strictEqual(maps.timers.size, 0, "and none is still waiting to go");
};

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
test("a coach's note on a row lands on a conflict without carrying the row's old weights; a coach's weight edit still wins for its row", async () => {
  const sb = makeSupabase(); coach(sb);
  const server = training("T", { rows: [row("r1", ["30", "30"], ["5", "5"], 2), row("r2", ["80"], ["8"], 1)] });   // the client logged more meanwhile
  sb.seed("ft_trainings", "T", server, { client_id: "c1" }); maps.seenAt.set("trainings/T", "S0");
  const local = training("T", { rows: [row("r1", ["20"], ["5"], 1), row("r2", ["90"], ["8"], 1)] });               // the coach's older copy: a note on r1, a corrected weight on r2
  local.rows[0].clientNote = "Keep the elbows in"; local.rows[0].clientNoteBy = "coach"; maps.trainings.set("T", local);
  maps.trainerNoted.set("T", new Set(["r1"])); maps.trainerTouched.set("T", new Set(["r2"]));
  await fns.cloudBackend.set("trainings", "T", JSON.parse(JSON.stringify(local)));
  const saved = sb.tables.ft_trainings.get("T").data;
  assert.strictEqual(saved.rows[0].clientNote, "Keep the elbows in", "the note lands"); assert.deepStrictEqual(saved.rows[0].weights, ["30", "30"], "the client's newer weights stay"); assert.strictEqual(saved.rows[0].setsDone, 2);
  assert.deepStrictEqual(saved.rows[1].weights, ["90"], "the coach's own weight edit wins for its row");
  assert.deepStrictEqual(maps.trainings.get("T").rows[0].weights, ["30", "30"], "the live copy learns the client's sets too");
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
test("without the log-set rule a hold's seconds still travel the old way, as a weight the coach's app moves back", async () => {
  const sb = makeSupabase(); app.reset(); app.set({ sb, signedIn: true, clientMode: true, myClientId: "c1", backend: fns.clientBackend });
  sb.rpcs.client_set_weights = async () => null; sb.rpcs.client_set_done = async () => null;   // client_log_set missing: PGRST202
  const hold = { ...row("r1", ["", "", "25"], ["45", "50", ""], 2), name: "Plank", reps: "45 sec" }, lift = row("r2", ["100", "", ""], ["5", "", ""], 1);
  const t = training("T", { rows: [hold, lift] }); maps.trainings.set("T", t); maps.pendingWeightRows.set("T", new Set(["r1", "r2"]));
  await fns.clientBackend.set("trainings", "T", JSON.parse(JSON.stringify(t)));
  const sent = sb.log.filter((l) => l.rpc === "client_set_weights").map((l) => l.args.p_weights);
  assert.deepStrictEqual(sent, [["45 sec", "50 sec", "25"], ["100", "", ""]], "seconds as the old weight string; a real weight and a plain lift untouched");
  assert.ok(app.get().logSetMissing);
});
test("a client's skip carries the reason; a rule that does not know the reason yet still takes the skip", async () => {
  const sb = makeSupabase(); app.reset(); app.set({ sb, signedIn: true, clientMode: true, myClientId: "c1", backend: fns.clientBackend });
  sb.rpcs.client_skip_training = async (a) => { if (a.p_reason !== undefined) { const e = new Error("Could not find the function"); e.code = "PGRST202"; throw e; } return null; };   // the old two-argument rule
  const t = training("T", { skippedAt: "2026-10-22T10:00:00.000Z", skipReason: "Sick" }); maps.trainings.set("T", t); maps.pendingSkip.add("T");
  await fns.clientBackend.set("trainings", "T", JSON.parse(JSON.stringify(t)));
  const calls = sb.log.filter((l) => l.rpc === "client_skip_training").map((l) => l.args);
  assert.deepStrictEqual(calls, [{ p_training: "T", p_skipped: true, p_reason: "Sick", p_at: "2026-10-22T10:00:00.000Z" }, { p_training: "T", p_skipped: true, p_reason: "Sick" }, { p_training: "T", p_skipped: true }]); assert.ok(!maps.pendingSkip.has("T"));
});
test("a client's skip carries the phone's own time, as a finish does (a skip made offline on Monday and uploaded on Wednesday is Monday's: her 24-hour Undo counts from it, a review's catch); a rule without the time still takes the skip with its reason; an Undo sends no time", async () => {
  const sb = makeSupabase(); app.reset(); app.set({ sb, signedIn: true, clientMode: true, myClientId: "c1", backend: fns.clientBackend });
  const calls = []; sb.rpcs.client_skip_training = async (a) => { calls.push(a); if ("p_at" in a) { const e = new Error("Could not find the function"); e.code = "PGRST202"; throw e; } return null; };   // the rule from before the time
  const t = training("T", { skippedAt: "2026-11-09T07:00:00.000Z", skipReason: "Sick" }); maps.trainings.set("T", t); maps.dirty.set("trainings/T", 1); maps.pendingSkip.add("T");
  fns.flushOne("trainings", "T"); await settle();
  assert.deepStrictEqual(calls, [{ p_training: "T", p_skipped: true, p_reason: "Sick", p_at: "2026-11-09T07:00:00.000Z" }, { p_training: "T", p_skipped: true, p_reason: "Sick" }], "the time went first; the rule that does not know it got the reason's shape");
  assert.ok(!maps.pendingSkip.has("T"), "and the skip is done");
  calls.length = 0; sb.rpcs.client_skip_training = async (a) => { calls.push(a); return null; };   // the rule that knows the time
  t.skippedAt = null; delete t.skipReason; maps.dirty.set("trainings/T", 2); maps.pendingSkip.add("T"); fns.flushOne("trainings", "T"); await settle();
  assert.deepStrictEqual(calls, [{ p_training: "T", p_skipped: false, p_reason: "", p_at: null }], "an Undo of the skip: no time to keep");
});
test("Finish then Undo while the finish request is out: the answer does not swallow the Undo, which goes with the next flush", async () => {
  const sb = makeSupabase(); app.reset(); app.set({ sb, signedIn: true, clientMode: true, myClientId: "c1", backend: fns.clientBackend });
  const t = training("T", { completedAt: "2026-10-22T10:00:00.000Z" }); maps.trainings.set("T", t); maps.pendingFinish.add("T");
  sb.rpcs.client_finish_training = async (a) => { if (a.p_finished) { t.completedAt = null; maps.pendingFinish.add("T"); } return null; };   // Undo lands while the Finish request is on its way
  await fns.clientBackend.set("trainings", "T", JSON.parse(JSON.stringify({ ...t, completedAt: "2026-10-22T10:00:00.000Z" })));
  assert.ok(maps.pendingFinish.has("T"), "the Undo is still queued");
  await fns.clientBackend.set("trainings", "T", JSON.parse(JSON.stringify(t)));
  const sent = sb.log.filter((l) => l.rpc === "client_finish_training").map((l) => l.args.p_finished);
  assert.deepStrictEqual(sent, [true, false]); assert.ok(!maps.pendingFinish.has("T"), "acknowledged once the server holds the Undo");
});
test("a set logged while the log request is out stays queued, and the queue survives a persist mid-flight", async () => {
  const sb = makeSupabase(); app.reset(); app.set({ sb, signedIn: true, clientMode: true, myClientId: "c1", backend: fns.clientBackend });
  const t = training("T", { rows: [row("r1", ["100"], ["5"], 1)] }); maps.trainings.set("T", t); maps.pendingWeightRows.set("T", new Set(["r1"]));
  let persistedMidFlight = null;
  sb.rpcs.client_log_set = async (a) => { if (a.p_sets_done === 1) { fns.persistPending(); persistedMidFlight = JSON.parse(localStorage.getItem("fiala.pending.v1")); t.rows[0].weights = ["100", "105"]; t.rows[0].repsDone = ["5", "5"]; t.rows[0].setsDone = 2; } return null; };   // the app is backgrounded and set 2 logged while set 1 is on its way
  await fns.clientBackend.set("trainings", "T", JSON.parse(JSON.stringify({ ...t, rows: [row("r1", ["100"], ["5"], 1)] })));
  assert.deepStrictEqual(persistedMidFlight.weights, [["T", ["r1"]]], "the queue written mid-flight still holds the row");
  assert.ok(maps.pendingWeightRows.get("T").has("r1"), "set 2 is still queued");
  await fns.clientBackend.set("trainings", "T", JSON.parse(JSON.stringify(t)));
  const sent = sb.log.filter((l) => l.rpc === "client_log_set").map((l) => l.args.p_sets_done);
  assert.deepStrictEqual(sent, [1, 2]); assert.ok(!maps.pendingWeightRows.get("T").has("r1"), "acknowledged once the server holds set 2");
});
test("a send that fails leaves every unsent row queued; a row the server refused for good is dropped", async () => {
  const sb = makeSupabase(); app.reset(); app.set({ sb, signedIn: true, clientMode: true, myClientId: "c1", backend: fns.clientBackend });
  const t = training("T", { rows: [row("r1", ["1"], ["1"], 1), row("r2", ["2"], ["2"], 1), row("r3", ["3"], ["3"], 1)] }); maps.trainings.set("T", t); maps.pendingWeightRows.set("T", new Set(["r1", "r2", "r3"]));
  sb.rpcs.client_log_set = async (a) => { if (a.p_row === "r1") { const e = new Error("row gone"); e.code = "P0001"; throw e; } if (a.p_row === "r2") { const e = new Error("network down"); e.code = "500"; throw e; } return null; };
  await assert.rejects(fns.clientBackend.set("trainings", "T", JSON.parse(JSON.stringify(t))));
  assert.deepStrictEqual([...maps.pendingWeightRows.get("T")], ["r2", "r3"], "r1 dropped for good, r2 and r3 wait for the next try");
  clearTimeout(app.get().syncTimer);                                  // the sync the refused row asks for (0.3 s on) is not this test's: it would run, and flush, inside the next one
});
test("the device copy reports when it cannot be written", () => {
  app.reset(); app.set({ backend: fns.localBackend });
  env.storage.fail = true;
  try { fns.localBackend.save(); assert.strictEqual(app.get().deviceFull, true); fns.setStatus(); assert.ok(/Not saved on this device/.test(document.getElementById("status").textContent)); }
  finally { env.storage.fail = false; fns.localBackend.save(); assert.strictEqual(app.get().deviceFull, false); }
});
test("a client whose monthly plan has ended keeps everything still queued: the server hid the workouts, it did not delete them", async () => {
  const sb = makeSupabase(); app.reset(); app.set({ sb, signedIn: true, clientMode: true, myClientId: "c1", backend: fns.clientBackend });
  maps.clients.set("c1", { id: "c1", name: "Jane", unit: "lb", plan: { id: "m", name: "Monthly plan", kind: "monthly", until: "2000-01-01" } });
  sb.rpcs.client_my_data = async () => ({ clients: [{ id: "c1", data: { name: "Jane", unit: "lb", plan: { id: "m", name: "Monthly plan", kind: "monthly", until: "2000-01-01" } } }], trainings: [] });
  const t = training("T", { completedAt: "2026-10-13T10:00:00.000Z", date: day(-1), missed: false, rows: [row("r1", ["225"], ["5"], 1)] }); maps.trainings.set("T", t);
  maps.dirty.set("trainings/T", 1); maps.pendingFinish.add("T"); maps.pendingWeightRows.set("T", new Set(["r1"]));
  await fns.syncDownNow();
  assert.ok(maps.dirty.has("trainings/T") && maps.pendingFinish.has("T") && maps.pendingWeightRows.has("T"), "the queue survives"); assert.ok(maps.trainings.has("T"), "and so does the device copy");
  await settle();                                                     // the flush the sync started ends here, not inside the next test: this server has no rules for it, so it is tried four times (about 5 s) and given up
});

test("a client on an 'in person by default' package gets new workouts with the switch on; other clients do not", async () => {
  const sb = makeSupabase(); coach(sb);
  const { TEMPLATES_ID } = await import("../app/model.js");
  maps.clients.set(TEMPLATES_ID, { id: TEMPLATES_ID, name: "Templates", kind: "templates", packages: [{ id: "p1", name: "10 sessions", kind: "sessions", size: 10, inPerson: true }, { id: "p2", name: "4-week plan", kind: "monthly", size: null, inPerson: false }] });
  maps.clients.get("c1").plan = { id: "p1", name: "10 sessions", kind: "sessions", size: 10, startedOn: "2026-10-01", adjust: 0 };
  maps.clients.set("c2", { id: "c2", name: "Bob", unit: "lb", plan: { id: "p2", name: "4-week plan", kind: "monthly", size: null, until: "2026-12-01" } });
  maps.clients.set("c3", { id: "c3", name: "Cat", unit: "lb" });
  fns.addTraining("c1"); fns.addTraining("c2"); fns.addTraining("c3");
  const of = (id) => [...maps.trainings.values()].find((t) => t.clientId === id);
  assert.strictEqual(of("c1").inPerson, true); assert.strictEqual(of("c2").inPerson, undefined); assert.strictEqual(of("c3").inPerson, undefined);
  assert.strictEqual(fns.packageOf(maps.clients.get("c1")).name, "10 sessions"); assert.strictEqual(fns.packageOf(maps.clients.get("c3")), null);
  await settle();                                                     // the three new workouts' saves land here, not inside a later test
});

const TPL = "00000000-0000-4000-8000-0000000000f1", U = (n) => "00000000-0000-4000-8000-" + String(n).padStart(12, "0");
test("a workout restored from a backup lands as the file has it: without a stamp and through a conflict, nothing of the server's is merged in", async () => {
  const sb = makeSupabase(); coach(sb);
  sb.seed("ft_trainings", "T", training("T", { title: "Server", completedAt: null, date: day(2), rows: [row("r1", ["40"], ["5"], 1)] }), { client_id: "c1" });
  const file = training("T", { title: "File", completedAt: "2026-10-02T18:00:00.000Z", date: "2026-10-02", rows: [row("r1", ["100", "100", "100"], ["5", "5", "5"], 3)] });
  maps.trainings.set("T", JSON.parse(JSON.stringify(file))); maps.fromFile.set("trainings/T", 1);   // no stamp: the app was relaunched, or never saw this record
  await fns.cloudBackend.set("trainings", "T", JSON.parse(JSON.stringify(file)));
  let saved = sb.tables.ft_trainings.get("T").data;
  assert.deepStrictEqual([saved.title, saved.completedAt, saved.date, saved.rows[0].weights], ["File", file.completedAt, "2026-10-02", ["100", "100", "100"]]);
  assert.deepStrictEqual(maps.trainings.get("T").rows[0].weights, ["100", "100", "100"], "the live copy keeps the file's sets too");
  sb.seed("ft_trainings", "T", training("T", { title: "Server again", rows: [row("r1", ["50"], ["5"], 1)] }), { client_id: "c1" });   // the server moves on: the next write meets a newer stamp
  await fns.cloudBackend.set("trainings", "T", JSON.parse(JSON.stringify(file)));
  saved = sb.tables.ft_trainings.get("T").data; assert.strictEqual(saved.title, "File"); assert.deepStrictEqual(saved.rows[0].weights, ["100", "100", "100"]);
  assert.strictEqual(sb.log.filter((l) => l.op === "update" && l.table === "ft_trainings").length, 3, "a conditional write each time, one retried over the newer stamp");
});
test("a client restored from a backup replaces the server's notes, packages and plan; the same save without the restore marker keeps them", async () => {
  const serverCopy = () => ({ id: TPL, name: "Templates", kind: "templates", packages: [{ id: "p1", name: "10 sessions", kind: "sessions", size: 10 }], notes: { log: [{ id: "n1", at: "2026-10-01T10:00:00.000Z", text: "Server note" }] }, plan: { id: "p1", kind: "sessions" } });
  const file = { id: TPL, name: "Templates", kind: "templates", packages: [], notes: { log: [] }, plan: null };
  for (const restored of [true, false]) {
    const sb = makeSupabase(); coach(sb); sb.seed("ft_clients", TPL, serverCopy());
    maps.clients.set(TPL, JSON.parse(JSON.stringify(file))); if (restored) maps.fromFile.set("clients/" + TPL, 1);
    await fns.cloudBackend.set("clients", TPL, JSON.parse(JSON.stringify(file)));
    const saved = sb.tables.ft_clients.get(TPL).data;
    if (restored) { assert.deepStrictEqual(saved.packages, []); assert.deepStrictEqual(saved.notes, { log: [] }); assert.strictEqual(saved.plan, null); }
    else { assert.strictEqual(saved.packages.length, 1, "an ordinary save keeps a package added elsewhere"); assert.strictEqual(saved.notes.log.length, 1); assert.deepStrictEqual(saved.plan, { id: "p1", kind: "sessions" }); }
  }
});
test("the coach's plan edit, a deleted note and a deleted package are kept on the device across a relaunch and cleared only by the save that carried them", async () => {
  const sb = makeSupabase(); coach(sb); sb.delayMs = 30;
  sb.seed("ft_clients", TPL, { id: TPL, name: "Templates", kind: "templates", packages: [{ id: "p1", name: "10 sessions", kind: "sessions", size: 10 }], notes: { log: [{ id: "n1", at: "2026-10-01T10:00:00.000Z", text: "Old" }] } });
  const tc = { id: TPL, name: "Templates", kind: "templates", packages: [], notes: { log: [] }, plan: { id: "x", kind: "monthly", until: "2026-11-15" } }; maps.clients.set(TPL, tc);
  maps.planTouched.add(TPL); maps.deletedNotes.set("n1", TPL); maps.deletedPackages.set("p1", TPL); maps.dirty.set("trainings/zzz", 7); maps.fromFile.set("trainings/zzz", 7); maps.fromFile.set("trainings/stale", 3);   // zzz: a restored record with its edit still to go; stale: a marker whose write went before the relaunch
  fns.scheduleSave("clients", TPL, 0);
  await tick(5);                                                      // the save is on the wire
  const stored = JSON.parse(localStorage.getItem("fiala.pending.v1"));
  assert.deepStrictEqual([stored.plans, stored.notesGone, stored.packagesGone, stored.fromFile], [[TPL], [["n1", TPL]], [["p1", TPL]], [["trainings/zzz", 7], ["trainings/stale", 3]]], "written to the device with the queue");
  maps.planTouched.clear(); maps.deletedNotes.clear(); maps.deletedPackages.clear(); maps.fromFile.clear(); maps.dirty.delete("trainings/zzz"); fns.restorePending();   // the app relaunched meanwhile
  assert.ok(maps.planTouched.has(TPL) && maps.deletedNotes.get("n1") === TPL && maps.deletedPackages.get("p1") === TPL, "back after the relaunch");
  assert.strictEqual(maps.fromFile.get("trainings/zzz"), 1, "the marker follows the edit, which a relaunch numbers 1 again: the save that carries the file's copy will clear it");
  assert.ok(!maps.fromFile.has("trainings/stale"), "a marker with no edit behind it is dropped: a later ordinary edit must not inherit the restore's rights");
  await settle();                                                    // the save landed: read first (no stamp), then the write
  const saved = sb.tables.ft_clients.get(TPL).data;
  assert.deepStrictEqual(saved.packages, [], "the deleted package did not come back"); assert.deepStrictEqual(saved.notes.log, [], "nor the deleted note"); assert.strictEqual(saved.plan.until, "2026-11-15", "and the plan edit stands");
  assert.ok(!maps.planTouched.has(TPL) && !maps.deletedNotes.has("n1") && !maps.deletedPackages.has("p1"), "the save that carried them clears them");
  assert.ok(maps.fromFile.has("trainings/zzz"), "a marker for another record stays");
  assert.ok(!maps.dirty.has("clients/" + TPL));
});
test("a deleted package does not come back through a conflict, and an offline plan extension survives a relaunch and a newer server copy", async () => {
  const sb = makeSupabase(); coach(sb);
  sb.seed("ft_clients", TPL, { id: TPL, name: "Templates", kind: "templates", packages: [{ id: "p1", name: "10 sessions", kind: "sessions", size: 10 }] });
  maps.seenAt.set("clients/" + TPL, "S0");                            // stale: the server has moved on since this device read it
  const tc = { id: TPL, name: "Templates", kind: "templates", packages: [] }; maps.clients.set(TPL, tc); maps.deletedPackages.set("p1", TPL); maps.planTouched.add(TPL);
  await fns.cloudBackend.set("clients", TPL, JSON.parse(JSON.stringify(tc)));
  assert.deepStrictEqual(sb.tables.ft_clients.get(TPL).data.packages, [], "the only package, deleted, stays deleted");
  sb.seed("ft_clients", "c1", { id: "c1", name: "Jane", plan: { id: "p1", kind: "monthly", until: "2026-10-18" } });   // the server's copy, edited on another device meanwhile
  const c = { id: "c1", name: "Jane", plan: { id: "p1", kind: "monthly", until: "2026-11-15" } }; maps.clients.set("c1", c);   // extended here, offline
  maps.planTouched.add("c1"); fns.persistPending(); maps.planTouched.clear(); fns.restorePending();   // relaunched before it could be sent
  await fns.cloudBackend.set("clients", "c1", JSON.parse(JSON.stringify(c)));                        // no stamp: read first, then the write
  assert.strictEqual(sb.tables.ft_clients.get("c1").data.plan.until, "2026-11-15", "the extension lands");
  maps.planTouched.clear(); maps.seenAt.delete("clients/c1"); sb.seed("ft_clients", "c1", { id: "c1", name: "Jane", plan: { id: "p1", kind: "monthly", until: "2026-10-18" } });
  await fns.cloudBackend.set("clients", "c1", JSON.parse(JSON.stringify(c)));
  assert.strictEqual(sb.tables.ft_clients.get("c1").data.plan.until, "2026-10-18", "without the marker a plan set on another device stands");
});
test("a restore skips what is already here, the same and known to the server, replaces what differs, says so in the sheet's words, and brings the file's template version", async () => {
  const sb = makeSupabase(); coach(sb);
  maps.clients.set(U(1), { id: U(1), name: "Jane", unit: "lb" }); maps.seenAt.set("clients/" + U(1), "S1");
  maps.clients.set(TPL, { id: TPL, name: "Templates", kind: "templates", templatesVersion: 5, packages: [] }); maps.seenAt.set("clients/" + TPL, "S1");
  maps.trainings.set(U(10), training(U(10), { clientId: U(1), title: "Same" })); maps.seenAt.set("trainings/" + U(10), "S1");
  maps.trainings.set(U(11), training(U(11), { clientId: U(1), title: "Here" })); maps.seenAt.set("trainings/" + U(11), "S1");
  const file = { app: "fiala-trainings", format: 1, clients: { [TPL]: { id: TPL, name: "Templates", kind: "templates", templatesVersion: 3, packages: [{ id: "p1", name: "10 sessions", kind: "sessions", size: 10 }] }, [U(1)]: { unit: "lb", name: "Jane", id: U(1) } },
    trainings: { [U(10)]: training(U(10), { clientId: U(1), title: "Same" }), [U(11)]: training(U(11), { clientId: U(1), title: "From the file" }), [U(12)]: training(U(12), { clientId: U(1), title: "New" }) } };
  const plan = fns.planRestore(JSON.parse(JSON.stringify(file)));
  assert.deepStrictEqual([plan.cs.map((c) => c.id), plan.ts.map((t) => t.id)], [[TPL], [U(11), U(12)]], "the first workout and Jane are here already and the same (whatever the key order)");
  assert.strictEqual(plan.text, "2 workouts and the packages list from the file go into the app. 2 of them replace a copy already here, logged sets and all. Everything else stays as it is.");
  maps.seenAt.delete("trainings/" + U(10));                           // the same record, but never confirmed by the server: it goes too
  assert.deepStrictEqual(fns.planRestore(JSON.parse(JSON.stringify(file))).ts.map((t) => t.id), [U(10), U(11), U(12)]); maps.seenAt.set("trainings/" + U(10), "S1");
  assert.strictEqual(fns.planRestore(JSON.parse(JSON.stringify({ app: "fiala-trainings", clients: { [U(1)]: { id: U(1), name: "Jane", unit: "lb" } }, trainings: {} }))).text, "", "nothing to do, nothing to say");
  fns.applyRestore(plan);
  assert.strictEqual(maps.trainings.get(U(11)).title, "From the file"); assert.strictEqual(maps.trainings.get(U(12)).title, "New"); assert.strictEqual(maps.trainings.get(U(10)).title, "Same");
  assert.strictEqual(maps.clients.get(TPL).templatesVersion, 3, "the file's template version: the next launch repairs and completes the built-in set"); assert.strictEqual(maps.clients.get(TPL).packages[0].id, "p1", "the packages come from the file");
  assert.deepStrictEqual([...maps.fromFile.keys()].sort(), ["clients/" + TPL, "trainings/" + U(11)].sort(), "a marker only for what was here already"); assert.ok(!maps.dirty.has("trainings/" + U(10)), "an unchanged record is not saved again");
  await settle();                                                     // the zero-delay saves landed
  assert.strictEqual(sb.tables.ft_trainings.get(U(11)).data.title, "From the file"); assert.ok(!maps.fromFile.size, "the markers went with the saves");
  const one = fns.planRestore(JSON.parse(JSON.stringify({ app: "fiala-trainings", clients: {}, trainings: { [U(11)]: training(U(11), { clientId: U(1), title: "Again" }) } })));
  assert.strictEqual(one.text, "1 workout from the file goes into the app. It replaces a copy already here, logged sets and all. Everything else stays as it is.");
  const cl = fns.planRestore(JSON.parse(JSON.stringify({ app: "fiala-trainings", clients: { [U(1)]: { id: U(1), name: "Jane", unit: "kg" } }, trainings: {} })));
  assert.strictEqual(cl.text, "1 client from the file goes into the app. It replaces a copy already here, notes and plan included. Everything else stays as it is.");
});
test("a restored workout this device never had joins the usual way: the file's plan, the client's log on the server kept", async () => {
  const sb = makeSupabase(); coach(sb);
  maps.clients.set(U(1), { id: U(1), name: "Jane", unit: "lb" }); maps.seenAt.set("clients/" + U(1), "S1");
  sb.seed("ft_trainings", U(10), training(U(10), { clientId: U(1), title: "Server", rows: [row("r1", ["40", "40"], ["5", "5"], 2)] }), { client_id: U(1) });
  const plan = fns.planRestore(JSON.parse(JSON.stringify({ app: "fiala-trainings", clients: {}, trainings: { [U(10)]: training(U(10), { clientId: U(1), title: "File", rows: [row("r1")] }) } })));
  assert.strictEqual(plan.text, "1 workout from the file goes into the app. Everything else stays as it is.");
  fns.applyRestore(plan); assert.ok(!maps.fromFile.size, "no marker for a record that was not here");
  await settle();
  const saved = sb.tables.ft_trainings.get(U(10)).data; assert.strictEqual(saved.title, "File"); assert.deepStrictEqual(saved.rows[0].weights, ["40", "40"], "the client's log on the server is kept");
});
test("the restore marker goes with the write that carried the file's copy, even with an edit queued behind it: the next save merges a client's newer log as usual", async () => {
  const sb = makeSupabase(); coach(sb); sb.delayMs = 30;
  sb.seed("ft_trainings", "T", training("T", { title: "Server", rows: [row("r1", ["40"], ["5"], 1)] }), { client_id: "c1" }); maps.seenAt.set("trainings/T", sb.tables.ft_trainings.get("T").updated_at);
  const file = training("T", { title: "File", rows: [row("r1", ["100", "100", "100"], ["5", "5", "5"], 3)] }); maps.trainings.set("T", file);
  maps.fromFile.set("trainings/T", (maps.dirty.get("trainings/T") || 0) + 1); fns.scheduleSave("trainings", "T", 0);   // as applyRestore does
  await tick(5); sb.delayMs = 100;                                    // write A is on the wire with the file's copy; what follows takes longer
  file.title = "File, edited"; fns.scheduleSave("trainings", "T", 0);   // the coach edits while it is out: a second save queued behind the first
  await tick(80);                                                     // write A landed
  assert.strictEqual(sb.tables.ft_trainings.get("T").data.title, "File"); assert.ok(!maps.fromFile.has("trainings/T"), "the marker went with the write that carried the file's copy"); assert.ok(maps.dirty.has("trainings/T"), "the edit is still to go");
  const srv = sb.tables.ft_trainings.get("T"); srv.data.rows[0].weights = ["110", "110", "110", "110"]; srv.data.rows[0].setsDone = 4; srv.updated_at = "2026-10-13T00:00:59Z";   // the client logs a set before write B
  await settle();
  const saved = sb.tables.ft_trainings.get("T").data;
  assert.strictEqual(saved.title, "File, edited"); assert.deepStrictEqual(saved.rows[0].weights, ["110", "110", "110", "110"], "the client's newer sets survive the queued edit"); assert.ok(!maps.dirty.size);
});
test("a save already out when Restore is tapped merges nothing of the server's into the restored record, and the restore's own write follows it", async () => {
  const sb = makeSupabase(); coach(sb); sb.delayMs = 30;
  sb.seed("ft_trainings", "T", training("T", { completedAt: "2026-10-12T18:00:00.000Z", rows: [row("r1", ["40"], ["5"], 1)] }), { client_id: "c1" });   // the server holds the client's log
  maps.trainings.set("T", training("T", { title: "Renamed" })); fns.scheduleSave("trainings", "T", 0);   // an ordinary edit with no stamp: it would read first and merge
  await tick(5);
  const file = training("T", { title: "File", completedAt: null, rows: [row("r1", ["100"], ["5"], 1)] }); maps.trainings.set("T", file);
  maps.fromFile.set("trainings/T", (maps.dirty.get("trainings/T") || 0) + 1); fns.scheduleSave("trainings", "T", 0);   // Restore while that save is out
  await settle();
  assert.strictEqual(maps.trainings.get("T").completedAt, null, "the live copy stayed the file's: the earlier save merged nothing into it"); assert.deepStrictEqual(maps.trainings.get("T").rows[0].weights, ["100"]);
  const saved = sb.tables.ft_trainings.get("T").data; assert.strictEqual(saved.title, "File"); assert.strictEqual(saved.completedAt, null); assert.deepStrictEqual(saved.rows[0].weights, ["100"]);
  assert.ok(!maps.fromFile.size && !maps.dirty.size);
});
test("a client whose email the server refuses (it is on another client) keeps its other edits: the email goes back, the rest lands, the marker and the queue entry go", async () => {
  const sb = makeSupabase(); coach(sb);
  sb.seed("ft_clients", U(2), { id: U(2), name: "Twin", email: "old@x.com" }); maps.seenAt.set("clients/" + U(2), sb.tables.ft_clients.get(U(2)).updated_at);
  maps.clients.set(U(2), { id: U(2), name: "Twin Renamed", email: "same@x.com" }); maps.fromFile.set("clients/" + U(2), 1); maps.dirty.set("clients/" + U(2), 1);
  sb.setFail({ table: "ft_clients", op: "update", times: 1, code: "23505", message: "duplicate key" });
  await fns.flushOne("clients", U(2)).catch(() => {});
  const saved = sb.tables.ft_clients.get(U(2)).data;
  assert.strictEqual(saved.email, "old@x.com", "the refused email went back to the server's"); assert.strictEqual(saved.name, "Twin Renamed", "the rest of the edit landed");
  assert.strictEqual(maps.clients.get(U(2)).email, "old@x.com", "and the live copy shows it"); assert.match(app.get().failReason, /email/);
  assert.ok(!maps.fromFile.has("clients/" + U(2)) && !maps.dirty.has("clients/" + U(2)));
});
test("two coach devices: a field this device did not change takes the other device's value on a conflict; a record deleted elsewhere is not brought back", async () => {
  const sb = makeSupabase(); coach(sb);
  const stamp = sb.seed("ft_clients", "c1", { id: "c1", name: "Jane", email: "jane@x.com", unit: "lb", paused: false });
  fns.mergeDown(maps.clients, "clients", [{ id: "c1", data: { id: "c1", name: "Jane", email: "jane@x.com", unit: "lb", paused: false }, updated_at: stamp }], true, Date.now());   // this device read the record
  sb.seed("ft_clients", "c1", { id: "c1", name: "Jane Doe", email: "jane@x.com", unit: "lb", paused: true });   // the other device renamed and paused her meanwhile
  const mine = maps.clients.get("c1"); mine.unit = "kg";                                                     // this device only switched the unit
  await fns.cloudBackend.set("clients", "c1", JSON.parse(JSON.stringify(mine)));
  const saved = sb.tables.ft_clients.get("c1").data;
  assert.deepStrictEqual([saved.unit, saved.name, saved.paused], ["kg", "Jane Doe", true], "both devices' changes land"); assert.strictEqual(maps.clients.get("c1").name, "Jane Doe", "the live copy learns the rename");
  sb.tables.ft_clients.delete("c1");                                                                         // deleted on the other device
  mine.unit = "lb"; await fns.cloudBackend.set("clients", "c1", JSON.parse(JSON.stringify(mine)));
  assert.ok(!sb.tables.ft_clients.has("c1"), "not written back"); assert.ok(!maps.clients.has("c1"), "and gone here too");
});
test("a client's card note and finish-early reason still queued when their rule was missing are sent again on the next launch, and a sync does not overwrite them meanwhile", async () => {
  const sb = makeSupabase(); app.reset(); app.set({ sb, signedIn: true, clientMode: true, myClientId: "c1", backend: fns.clientBackend });
  const t = training("T", { rows: [{ ...row("r1"), clientNote: "Pinched", clientNoteBy: "client" }] }); maps.trainings.set("T", t);
  maps.pendingNoteRows.set("T", new Set(["r1"])); fns.persistPending(); maps.dirty.clear(); fns.restorePending();
  assert.ok(maps.dirty.has("trainings/T"), "queued again on launch");
  fns.mergeDown(maps.trainings, "trainings", [{ id: "T", data: training("T"), updated_at: "S1" }], true, Date.now());
  assert.strictEqual(maps.trainings.get("T").rows[0].clientNote, "Pinched", "the server's copy without the note does not replace ours");
});
test("a template's unsaved draft stays out of the device copy and comes back unsaved after a relaunch", async () => {
  const sb = makeSupabase(); coach(sb);
  const tpl = training("tpl1", { clientId: TPL, title: "Upper A", rows: [row("r1")] }); maps.trainings.set("tpl1", tpl);
  app.set({ templateDraft: { id: "tpl1", snapshot: JSON.stringify(tpl), dirty: false, saving: false }, view: { name: "training", id: "tpl1" } });
  tpl.title = "Upper A, edited"; fns.scheduleSave("trainings", "tpl1");                                      // swallowed into the draft
  assert.ok(app.get().templateDraft.dirty && !maps.dirty.has("trainings/tpl1"));
  fns.localBackend.save(); const stored = JSON.parse(localStorage.getItem("fiala.trainings.v1")).trainings.tpl1;
  assert.strictEqual(stored.title, "Upper A", "the device copy holds the template as saved");
  const draft = JSON.parse(localStorage.getItem("fiala.trainings.draft")); assert.strictEqual(draft.doc.title, "Upper A, edited", "the draft is kept on its own");
});
test("a sync that changes nothing keeps the very same objects, so the cards on screen keep writing to the live record; a changed sibling workout repaints the open one", () => {
  app.reset(); app.set({ clientMode: false, renderedTraining: "A" });
  const a = training("A"), b = training("B"); maps.trainings.set("A", a); maps.trainings.set("B", b);
  fns.mergeDown(maps.trainings, "trainings", [{ id: "A", data: training("A"), updated_at: "S1" }, { id: "B", data: training("B"), updated_at: "S1" }], true, Date.now());
  assert.strictEqual(maps.trainings.get("A"), a, "the same object"); assert.strictEqual(app.get().renderedTraining, "A", "nothing to repaint");
  fns.mergeDown(maps.trainings, "trainings", [{ id: "A", data: training("A"), updated_at: "S1" }, { id: "B", data: training("B", { title: "Changed elsewhere" }), updated_at: "S2" }], true, Date.now());
  assert.strictEqual(maps.trainings.get("A"), a, "A untouched"); assert.strictEqual(app.get().renderedTraining, null, "B changed: A's last/best lines are read again");
});
test("a record deleted this session can be restored from a backup: its stamp went with it", async () => {
  const sb = makeSupabase(); coach(sb);
  const stamp = sb.seed("ft_trainings", U(10), training(U(10), { clientId: "c1" }), { client_id: "c1" });
  fns.mergeDown(maps.trainings, "trainings", [{ id: U(10), data: training(U(10), { clientId: "c1" }), updated_at: stamp }], true, Date.now());
  await fns.cloudBackend.del("trainings", U(10)); maps.trainings.delete(U(10));
  assert.ok(!maps.seenAt.has("trainings/" + U(10)), "no stamp left behind");
  const back = training(U(10), { clientId: "c1", title: "Back from the file" }); maps.trainings.set(U(10), back);
  await fns.cloudBackend.set("trainings", U(10), JSON.parse(JSON.stringify(back)));
  assert.strictEqual(sb.tables.ft_trainings.get(U(10)).data.title, "Back from the file", "restored, not treated as deleted elsewhere");
});
test("empty note and reason queues are neither written to the device nor re-marked on launch", () => {
  app.reset(); app.set({ clientMode: true });
  maps.pendingNoteRows.set("T", new Set()); fns.persistPending();
  assert.deepStrictEqual(JSON.parse(localStorage.getItem("fiala.pending.v1")).rownotes, []);
  maps.dirty.clear(); fns.restorePending(); assert.ok(!maps.dirty.has("trainings/T"));
});

test("a client's finish carries the phone's own time; the old rule without that argument is sent the old shape", async () => {
  const sb = makeSupabase(); app.reset(); app.set({ sb, signedIn: true, clientMode: true, myClientId: "c1", backend: fns.clientBackend });
  const calls = []; sb.rpcs.client_finish_training = async (args) => { calls.push(args); if ("p_at" in args) { const e = new Error("Could not find the function"); e.code = "PGRST202"; throw e; } return null; };
  const t = training("T", { completedAt: "2026-11-02T18:04:00.000Z" }); maps.trainings.set("T", t); maps.dirty.set("trainings/T", 1); maps.pendingFinish.add("T");
  fns.flushOne("trainings", "T"); await settle();
  assert.deepStrictEqual(calls.map((a) => a.p_at), ["2026-11-02T18:04:00.000Z", undefined], "the time went first; the rule that does not know it got the old shape");
  assert.ok(!maps.pendingFinish.has("T"), "and the finish is done");
  sb.rpcs.client_finish_training = async (args) => { calls.push(args); return null; };
  maps.dirty.set("trainings/T", 2); maps.pendingFinish.add("T"); fns.flushOne("trainings", "T"); await settle();
  assert.strictEqual(calls[calls.length - 1].p_at, "2026-11-02T18:04:00.000Z", "a rule that knows the time takes it: a Monday finish uploaded on Wednesday stays Monday's");
});
test("a catalog that never answers cannot hold the workouts back", async () => {
  const sb = makeSupabase(); coach(sb); app.set({ catalogWait: 30 });
  sb.seed("ft_trainings", "T", training("T"), { client_id: "c1" });
  const from = sb.from; sb.from = (table) => table === "ft_exercise_hidden" ? { select: () => new Promise(() => {}) } : from(table);   // the hidden-exercises catalog hangs for ever
  const started = Date.now(); await fns.syncDownNow();
  assert.ok(maps.trainings.has("T"), "the workouts arrived"); assert.ok(Date.now() - started < 2000, "without waiting on the catalog");
  sb.from = from; app.set({ catalogWait: 0 }); await settle();
});
test("with no cloud library on the page, a remembered client opens as the client, offline, and a queued change stays queued", async () => {
  const sb = makeSupabase(); app.reset();
  localStorage.setItem("fiala.trainings.role", JSON.stringify({ email: "jane@example.com", role: "client" }));
  maps.clients.set("c1", { id: "c1", name: "Jane", email: "jane@example.com", unit: "lb" }); maps.trainings.set("T", training("T")); fns.localBackend.save();
  maps.dirty.set("trainings/T", 1); fns.persistPending();
  app.set({ sb: null, signedIn: false, clientMode: false, myClientId: null, backend: null, offline: false });
  await fns.boot();
  const st = app.get();
  assert.ok(st.clientMode && st.myClientId === "c1" && st.signedIn, "the remembered role, not the coach's"); assert.ok(st.offline, "and offline, since the cloud is out of reach");
  assert.ok(st.backend && st.backend !== fns.localBackend, "the cloud backend, so nothing is confirmed locally by mistake");
  fns.flushOne("trainings", "T"); await settle();
  assert.ok(maps.dirty.has("trainings/T"), "the change is still to go"); assert.ok(!app.get().failed, "and nothing is marked failed");
});

test("a finish uploaded days after the fact is still news for the coach, even after a later look; the first look by id marks everything older as seen", async () => {
  const sb = makeSupabase(); coach(sb);
  const c = maps.clients.get("c1"); c.seenDoneAt = "2026-11-03T12:00:00.000Z";   // an older device last looked on Tuesday
  maps.trainings.set("sat", training("sat", { date: "2026-10-31", completedAt: "2026-10-31T18:00:00.000Z", completedBy: "client" }));
  assert.strictEqual(fns.clientNews(c).done, 0, "before the first look by id, the time stamp still rules: Saturday's was looked at");
  maps.trainings.set("new", training("new", { date: "2026-11-04", completedAt: "2026-11-04T18:00:00.000Z", completedBy: "client" }));
  assert.deepStrictEqual(fns.clientNews(c).workouts.map((t) => t.id), ["new"]); fns.markWorkoutsSeen(c);
  assert.deepStrictEqual([...c.seenFinished].sort(), ["new", "sat"], "from now on by id: the one looked at and everything older");
  maps.trainings.set("mon", training("mon", { date: "2026-11-02", completedAt: "2026-11-02T18:04:00.000Z", completedBy: "client" }));   // finished Monday offline, uploaded now with Monday's time
  assert.deepStrictEqual(fns.clientNews(c).workouts.map((t) => t.id), ["mon"], "Monday's is news although it is older than the last look");
  fns.markWorkoutsSeen(c); assert.strictEqual(fns.clientNews(c).done, 0); await settle();
});
test("a catalog answer from an earlier load that lands after a fresher one is dropped", async () => {
  const sb = makeSupabase(); coach(sb);
  const from = sb.from; let release = null;
  sb.from = (table) => table !== "ft_exercise_hidden" ? from(table) : { select: () => release ? Promise.resolve({ data: [{ name_key: "deadlift" }], error: null }) : new Promise((r) => { release = () => r({ data: [], error: null }); }) };
  const first = fns.loadHidden();                                    // stalls
  await fns.loadHidden();                                            // answers at once: Deadlift hidden
  assert.ok(maps.hiddenKeys.has("deadlift"));
  release(); await first;                                            // the stalled, older answer arrives: an empty list
  assert.ok(maps.hiddenKeys.has("deadlift"), "the older answer did not roll the fresher one back");
  sb.from = from;
});
test("finished again at a later time while the first finish was out: the later time is what reaches the server", async () => {
  const sb = makeSupabase(); app.reset(); app.set({ sb, signedIn: true, clientMode: true, myClientId: "c1", backend: fns.clientBackend }); sb.delayMs = 30;
  const sent = []; sb.rpcs.client_finish_training = async (a) => { sent.push(a.p_at); return null; };
  const t = training("T", { completedAt: "2026-11-02T18:04:00.000Z" }); maps.trainings.set("T", t); maps.dirty.set("trainings/T", 1); maps.pendingFinish.add("T");
  fns.flushOne("trainings", "T"); await tick(5);                      // the 18:04 finish is on the wire
  t.completedAt = "2026-11-02T18:05:30.000Z"; maps.dirty.set("trainings/T", 2); maps.pendingFinish.add("T"); fns.flushOne("trainings", "T");   // Undo, then Finish again
  await settle();
  assert.deepStrictEqual(sent, ["2026-11-02T18:04:00.000Z", "2026-11-02T18:05:30.000Z"], "both went, the later one last"); assert.ok(!maps.pendingFinish.has("T"));
});
test("a set-log that timed out on the phone and lands after a newer one is refused by the row's number: the newer result stands, and the number carries on across a relaunch", async () => {
  const sb = makeSupabase(); app.reset(); app.set({ sb, signedIn: true, clientMode: true, myClientId: "c1", backend: fns.clientBackend, saveWait: 40 });
  const server = { seq: 0, w: null, calls: [] }; let calls = 0, release = null;
  sb.rpcs.client_log_set = async (a) => {                              // the rule as client-log-set.sql has it: an older number than the one stored is ignored
    calls++; if (calls === 1) await new Promise((r) => { release = r; });
    server.calls.push([a.p_seq, a.p_weights[0]]); if (a.p_seq != null && a.p_seq < server.seq) return server.seq; server.seq = a.p_seq; server.w = a.p_weights; return a.p_seq;
  };
  const t = training("T", { rows: [row("r1", ["20"], ["5"], 1)] }); maps.trainings.set("T", t);
  maps.dirty.set("trainings/T", 1); maps.pendingWeightRows.set("T", new Set(["r1"])); fns.flushOne("trainings", "T");
  await tick(90);                                                     // the first request is stuck; the phone gave up on it and keeps the set queued
  assert.ok(maps.pendingWeightRows.get("T").has("r1"), "still queued after the timeout");
  t.rows[0].weights = ["30"]; maps.dirty.set("trainings/T", 2); fns.flushOne("trainings", "T"); await settle();   // corrected to 30: a newer request, through at once
  assert.deepStrictEqual(server.w, ["30"]); assert.strictEqual(server.seq, 2);
  release(); await tick(20);                                          // the stuck request finally reaches the server, carrying 20 and the older number
  assert.deepStrictEqual(server.calls.map((c) => c[0]), [2, 1], "as they reached the server: the newer first, the stuck one last"); assert.deepStrictEqual(server.w, ["30"], "the late request was refused: 30 stands");
  const stored = JSON.parse(localStorage.getItem("fiala.trainings.v1")).trainings.T.rows[0].logSeq; assert.strictEqual(stored, 2, "the number is on the device");
  maps.trainings.clear(); fns.localBackend.load();                    // relaunch
  maps.trainings.get("T").rows[0].weights = ["35"]; maps.dirty.set("trainings/T", 3); maps.pendingWeightRows.set("T", new Set(["r1"])); fns.flushOne("trainings", "T"); await settle();
  assert.strictEqual(server.seq, 3, "and counts on from there");
});
test("a client's move that timed out on the phone and is still out holds the next move back: the server takes the two in the order they were picked", async () => {
  const sb = makeSupabase(); app.reset(); app.set({ sb, signedIn: true, clientMode: true, myClientId: "c1", backend: fns.clientBackend, saveWait: 40 });
  const server = { date: null, calls: [] }; let calls = 0, release = null;
  sb.rpcs.client_move_training = async (a) => {                        // the rule as client-missed.sql has it: it writes any day it is given
    calls++; if (calls === 1) await new Promise((r) => { release = r; });
    server.calls.push(a.p_date); server.date = a.p_date; return null;
  };
  const t = training("T", { date: day(3) }); maps.trainings.set("T", t);   // Reschedule: Wednesday
  maps.dirty.set("trainings/T", 1); maps.pendingMove.add("T"); fns.flushOne("trainings", "T");
  await tick(90);                                                     // the request is stuck; the phone gave up on it and keeps the move queued
  assert.ok(maps.pendingMove.has("T"), "still queued after the timeout");
  t.date = day(5); maps.dirty.set("trainings/T", 2); maps.pendingMove.add("T"); fns.flushOne("trainings", "T"); await settle();   // she changed her mind: Friday
  assert.deepStrictEqual(server.calls, [], "Friday waits: Wednesday can still land");
  assert.ok(maps.pendingMove.has("T"), "and stays queued");
  release(); await tick(30); await settle();                          // Wednesday reaches the server at last
  assert.deepStrictEqual(server.calls, [day(3), day(5)], "Wednesday first, then Friday"); assert.strictEqual(server.date, day(5), "Friday stands");
  assert.ok(!maps.pendingMove.has("T"), "then acknowledged");
  sb.rpcs.client_move_training = async (a) => { server.calls.push(a.p_date); server.date = a.p_date; return null; };
  t.date = day(6); maps.dirty.set("trainings/T", 3); maps.pendingMove.add("T"); fns.flushOne("trainings", "T"); await settle();
  assert.strictEqual(server.date, day(6), "with nothing out, a move goes at once");
});
test("a server row's number is taken by the coach's copy, and a copied workout starts without one", async () => {
  const sb = makeSupabase(); coach(sb);
  const t = training("T", { rows: [row("r1", ["20"], ["5"], 1)] }); maps.trainings.set("T", t);
  sb.seed("ft_trainings", "T", training("T", { rows: [{ ...row("r1", ["30"], ["5"], 1), logSeq: 4 }] }), { client_id: "c1" });
  t.title = "Edited"; fns.scheduleSave("trainings", "T", 0); await settle();
  assert.strictEqual(sb.tables.ft_trainings.get("T").data.rows[0].logSeq, 4, "the coach's save keeps the row's number"); assert.deepStrictEqual(sb.tables.ft_trainings.get("T").data.rows[0].weights, ["30"], "and the client's set");
  assert.ok(!("logSeq" in fns.freshRow({ ...row("r1"), logSeq: 4 })), "a copied row starts without a number");
});
test("a request the server refuses because it already holds a higher number is not acknowledged: the row stays queued and goes again past that number", async () => {
  const sb = makeSupabase(); app.reset(); app.set({ sb, signedIn: true, clientMode: true, myClientId: "c1", backend: fns.clientBackend });
  const server = { seq: 7, w: ["50"], calls: [] };
  sb.rpcs.client_log_set = async (a) => { server.calls.push(a.p_seq); if (a.p_seq < server.seq) return server.seq; server.seq = a.p_seq; server.w = a.p_weights; return a.p_seq; };
  const t = training("T", { rows: [{ ...row("r1", ["30"], ["5"], 1), logSeq: 2 }] }); maps.trainings.set("T", t);   // this phone's copy is behind: another device logged seqs 3 to 7
  maps.dirty.set("trainings/T", 1); maps.pendingWeightRows.set("T", new Set(["r1"])); fns.flushOne("trainings", "T"); await settle();
  assert.deepStrictEqual(server.calls, [3, 8], "refused at 3, then sent again at once past the server's 7"); assert.deepStrictEqual(server.w, ["30"], "this phone's latest values stand"); assert.strictEqual(t.rows[0].logSeq, 8);
  assert.ok(!(maps.pendingWeightRows.get("T") || new Set()).has("r1") && !maps.dirty.has("trainings/T"), "then acknowledged");
});
test("the rule from before the number refuses the eighth argument: the request goes again in the old shape and is acknowledged", async () => {
  const sb = makeSupabase(); app.reset(); app.set({ sb, signedIn: true, clientMode: true, myClientId: "c1", backend: fns.clientBackend });
  const shapes = []; sb.rpcs.client_log_set = async (a) => { shapes.push(Object.keys(a).length); if ("p_seq" in a) { const e = new Error("Could not find the function"); e.code = "PGRST202"; throw e; } return null; };
  const t = training("T", { rows: [row("r1", ["30"], ["5"], 1)] }); maps.trainings.set("T", t);
  maps.dirty.set("trainings/T", 1); maps.pendingWeightRows.set("T", new Set(["r1"])); fns.flushOne("trainings", "T"); await settle();
  assert.deepStrictEqual(shapes, [8, 7]); assert.ok(!(maps.pendingWeightRows.get("T") || new Set()).has("r1"), "acknowledged the old way");
});
test("a row's number only goes up: the coach's edit of that row and a verbatim restore both carry the server's higher number", async () => {
  const sb = makeSupabase(); coach(sb);
  const t = training("T", { rows: [{ ...row("r1", ["35"], ["5"], 1), logSeq: 1 }] }); maps.trainings.set("T", t);
  sb.seed("ft_trainings", "T", training("T", { rows: [{ ...row("r1", ["30"], ["5"], 1), logSeq: 3 }] }), { client_id: "c1" });
  maps.trainerTouched.set("T", new Set(["r1"])); fns.scheduleSave("trainings", "T", 0); await settle();   // the coach changed the row's weight: his claim on the log, not on the number
  let srv = sb.tables.ft_trainings.get("T").data.rows[0]; assert.deepStrictEqual([srv.weights, srv.logSeq], [["35"], 3], "the coach's weight, the server's number");
  srv.logSeq = 5; sb.tables.ft_trainings.get("T").updated_at = "2026-11-03T12:00:00Z";
  maps.fromFile.set("trainings/T", (maps.dirty.get("trainings/T") || 0) + 1); t.rows[0].logSeq = 1; fns.scheduleSave("trainings", "T", 0); await settle(); await tick(30); await settle();   // a restore from a file: verbatim, except the number
  srv = sb.tables.ft_trainings.get("T").data.rows[0]; assert.strictEqual(srv.logSeq, 5, "the restore did not lower it");
});

test("the coach's round + sits beside the bar on a client's page, on every tab; a client never sees it", () => {
  app.reset(); app.set({ signedIn: true, clientMode: false, view: { name: "client", id: "c1" }, tab: "workouts" }); maps.clients.set("c1", { id: "c1", name: "Jane", unit: "lb" });
  const add = document.getElementById("addBtn"), bar = document.getElementById("tabbar");
  add.hidden = true; bar.hidden = true; fns.render(); assert.deepStrictEqual([bar.hidden, add.hidden], [false, false], "Workouts: the bar and the +");
  add.hidden = true; app.set({ tab: "notes" }); fns.render(); assert.strictEqual(add.hidden, false, "Notes: still there");
  add.hidden = true; app.set({ tab: "profile" }); fns.render(); assert.strictEqual(add.hidden, false, "Progress: still there");
  app.set({ clientMode: true, myClientId: "c1", tab: "workouts" }); fns.render(); assert.deepStrictEqual([bar.hidden, add.hidden], [false, true], "a client has the bar, not the +");
  app.set({ clientMode: false, myClientId: null, view: { name: "clients" } }); fns.render(); assert.deepStrictEqual([bar.hidden, add.hidden], [true, true], "the clients page has neither");
});

test("the + makes today's workout for the client whose page it is, and leaves the page on Workouts so Back shows it", () => {
  app.reset(); app.set({ signedIn: true, clientMode: false, view: { name: "client", id: "c1" }, tab: "notes" }); maps.clients.set("c1", { id: "c1", name: "Jane", unit: "lb" });
  const before = new Set(maps.trainings.keys()); fns.newWorkoutHere();
  const made = [...maps.trainings.values()].filter((t) => !before.has(t.id));
  assert.strictEqual(made.length, 1, "one new workout"); assert.deepStrictEqual([made[0].clientId, made[0].date, made[0].rows.length], ["c1", fns.today(), 0], "hers, today, empty");   // the app's local day, not UTC's (after 4 pm in Los Angeles those differ)
  assert.deepStrictEqual([app.get().view.name, app.get().view.id, app.get().tab], ["training", made[0].id, "workouts"], "on the new workout; the tab is Workouts");
  assert.strictEqual(document.getElementById("addBtn").hidden, true, "the + is not on the workout page");
});

test("the week strip is titled with its month, as Calendar's, and the title steps aside for the month view", () => {
  app.reset(); app.set({ signedIn: true, clientMode: true, myClientId: "c1", view: { name: "client", id: "c1" }, tab: "workouts" }); maps.clients.set("c1", { id: "c1", name: "Jane", unit: "lb" });
  const head = document.getElementById("weekHead"); head.textContent = ""; fns.render();
  const base = new Date(); const monday = new Date(base); monday.setDate(base.getDate() - ((base.getDay() + 6) % 7)); const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6);
  const want = monday.getMonth() === sunday.getMonth() ? monday.toLocaleDateString(undefined, { month: "long" }) : monday.toLocaleDateString(undefined, { month: "short" }) + " \u2013 " + sunday.toLocaleDateString(undefined, { month: "short" });
  assert.strictEqual(head.textContent, want, "the month the week is in"); assert.strictEqual(head.hidden, false, "shown with the week");
});

test("a day's workouts: planned and finished count, a skipped one does not, a finished one files under the day it was finished; the words and the order follow", () => {
  app.reset(); app.set({ signedIn: true, clientMode: false }); maps.clients.set("c1", { id: "c1", name: "Jane", unit: "lb" });
  maps.trainings.set("a", { id: "a", clientId: "c1", title: "Morning", date: "2026-11-04", createdAt: "2026-11-01T08:00:00.000Z", completedAt: null, skippedAt: null, rows: [] });
  maps.trainings.set("b", { id: "b", clientId: "c1", title: "Evening", date: "2026-11-04", createdAt: "2026-11-01T09:00:00.000Z", completedAt: null, skippedAt: null, rows: [] });
  maps.trainings.set("s", { id: "s", clientId: "c1", title: "Skipped", date: "2026-11-04", createdAt: "2026-11-01T10:00:00.000Z", completedAt: null, skippedAt: "2026-11-04T10:00:00.000Z", rows: [] });
  maps.trainings.set("f", { id: "f", clientId: "c1", title: "Moved", date: "2026-11-03", createdAt: "2026-11-01T07:00:00.000Z", completedAt: "2026-11-04T18:00:00.000Z", skippedAt: null, rows: [] });
  const ids = (l) => l.sort(fns.byMade).map((t) => t.id);
  assert.deepStrictEqual(ids(fns.dayList("c1", "2026-11-04")), ["f", "a", "b"], "the finished one under the day it was finished, the skipped one not at all, the morning one before the evening one");
  assert.deepStrictEqual(fns.dayList("c1", "2026-11-03"), [], "nothing left on the planned day once it was finished elsewhere");
  assert.strictEqual(fns.dayWords(fns.dayList("c1", "2026-11-04")), ", 3 workouts, 1 finished"); assert.strictEqual(fns.dayWords([maps.trainings.get("a")]), ", 1 workout"); assert.strictEqual(fns.dayWords([maps.trainings.get("f")]), ", 1 workout, finished"); assert.strictEqual(fns.dayWords([]), "");
});

test("Up next always shows the next workout after today's, however far off it is", () => {
  app.reset(); app.set({ signedIn: true, clientMode: false, view: { name: "client", id: "c1" }, tab: "workouts" }); maps.clients.set("c1", { id: "c1", name: "Jane", unit: "lb" });
  const day = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
  maps.trainings.set("t0", { id: "t0", clientId: "c1", title: "Today", date: day(0), createdAt: "2026-11-01T10:00:00.000Z", completedAt: null, skippedAt: null, rows: [{ id: "r", label: "1", name: "Squat", sets: 3, reps: "10", rest: "", tempo: "", weights: [], repsDone: [], setsDone: 0, done: false, note: "", alts: [] }] });
  maps.trainings.set("t9", { id: "t9", clientId: "c1", title: "Far", date: day(12), createdAt: "2026-11-01T10:00:00.000Z", completedAt: null, skippedAt: null, rows: [{ id: "r2", label: "1", name: "Squat", sets: 3, reps: "10", rest: "", tempo: "", weights: [], repsDone: [], setsDone: 0, done: false, note: "", alts: [] }] });
  const nextHead = document.getElementById("nextHead"), todayHead = document.getElementById("todayHead"); nextHead.hidden = true; todayHead.hidden = true;
  fns.render();
  assert.deepStrictEqual([todayHead.hidden, nextHead.hidden], [false, false], "today's card, and Up next with the one twelve days out");
});

test("the client's Messages disc (in the bar, his pick 10 Nov) is wired on the Workouts page and on the workout page alike, for the client with a number to reach", () => {
  app.reset(); app.set({ signedIn: true, clientMode: true, myClientId: "c1" });
  const c = { id: "c1", name: "Jane", unit: "lb", trainerPhone: "3105550199" }; maps.clients.set("c1", c);
  maps.trainings.set("w1", { id: "w1", clientId: "c1", title: "Legs", date: fns.today(), createdAt: "2026-11-01T10:00:00.000Z", completedAt: null, skippedAt: null, rows: [] });
  const a = document.getElementById("barMsg"), at = (view) => { a.hidden = true; app.set({ view }); fns.paintBarMsg(); return [a.hidden, a.href]; };
  assert.deepStrictEqual([at({ name: "client", id: "c1" }), at({ name: "training", id: "w1" })], [[false, "sms:+13105550199"], [false, "sms:+13105550199"]], "both pages, the same Messages link");
  c.chat = "whatsapp"; assert.deepStrictEqual(at({ name: "training", id: "w1" }), [false, "https://wa.me/13105550199"], "WhatsApp when the client chose it"); delete c.chat;
  c.trainerPhone = ""; assert.strictEqual(at({ name: "client", id: "c1" })[0], true, "nor without a number");
});
test("Start this exercise: the card goes ahead of the ones not yet done, they slide down behind it in their order, the numbers run 1, 2, 3 again", () => {
  app.reset(); app.set({ clientMode: true, myClientId: "c1", backend: fns.localBackend });
  const r = (id, label, done) => ({ ...row(id, [], [], done ? 3 : 0), label });
  const t = training("T", { rows: [r("w", "W"), r("a", "1", true), r("b", "2"), r("c", "3a"), r("d", "3b"), r("e", "4")] }); maps.trainings.set("T", t);
  assert.deepStrictEqual(fns.startExerciseNow(t, "4"), { key: "2", changed: true });
  assert.deepStrictEqual(t.rows.map((x) => x.id + ":" + x.label), ["w:W", "a:1", "e:2", "b:3", "c:4a", "d:4b"], "the finished one stays first; the started one takes the first open slot; the superset keeps its letters");
  assert.ok(maps.pendingOrder.has("T") && maps.dirty.has("trainings/T"), "queued for the server");
  assert.strictEqual(fns.startExerciseNow(t, "2"), null, "already next: nothing to do");
  assert.strictEqual(fns.startExerciseNow(t, "1"), null, "a finished one is not moved");
  assert.strictEqual(fns.startExerciseNow(t, "w"), null, "the warmup is not an exercise");
  const u = training("U", { rows: [r("a", "1"), r("b", "2", true), r("c", "3")] }); maps.trainings.set("U", u);   // a finished exercise between the open slot and the started one
  assert.deepStrictEqual(fns.startExerciseNow(u, "3"), { key: "1", changed: true });
  assert.deepStrictEqual(u.rows.map((x) => x.id + ":" + x.label), ["c:1", "b:2", "a:3"], "the finished one keeps its place and its number");
  for (const id of ["T", "U"]) { clearTimeout(maps.timers.get("trainings/" + id)); maps.timers.delete("trainings/" + id); }
});
test("the new order reaches the server as the numbered rows' numbers; without the rule it waits on the phone; moved again while out, it goes again", async () => {
  const sb = makeSupabase(); app.reset(); app.set({ sb, signedIn: true, clientMode: true, myClientId: "c1", backend: fns.clientBackend });
  const t = training("T", { rows: [{ ...row("w"), label: "W" }, { ...row("a"), label: "1" }, { ...row("b"), label: "2" }] }); maps.trainings.set("T", t); maps.pendingOrder.add("T");
  await fns.clientBackend.set("trainings", "T", JSON.parse(JSON.stringify(t)));
  assert.ok(app.get().orderMissing && maps.pendingOrder.has("T"), "rule not installed: kept for a later launch");
  app.set({ orderMissing: false }); const sent = []; sb.rpcs.client_order_rows = async (a) => { sent.push(a); return null; };
  await fns.clientBackend.set("trainings", "T", JSON.parse(JSON.stringify(t)));
  assert.deepStrictEqual(sent, [{ p_training: "T", p_labels: { a: "1", b: "2" } }], "only the numbered rows; the warmup keeps its W"); assert.ok(!maps.pendingOrder.has("T"));
  maps.pendingOrder.add("T"); sb.rpcs.client_order_rows = async () => { t.rows[1].label = "2"; t.rows[2].label = "1"; return null; };   // moved again while the request was out
  await fns.clientBackend.set("trainings", "T", JSON.parse(JSON.stringify(t)));
  assert.ok(maps.pendingOrder.has("T"), "still queued: the phone's latest order goes next");
  sb.rpcs.client_order_rows = async () => { const e = new Error("not allowed"); e.code = "P0001"; throw e; };
  await fns.clientBackend.set("trainings", "T", JSON.parse(JSON.stringify(t)));
  assert.ok(!maps.pendingOrder.has("T"), "refused for good: dropped, the server's copy comes back on the next sync");
});
test("while the new order is queued the server's old copy does not undo it, and a relaunch sends it again", () => {
  app.reset(); app.set({ clientMode: true, myClientId: "c1" });
  const t = training("T", { rows: [{ ...row("a"), label: "2" }, { ...row("b"), label: "1" }] }); maps.trainings.set("T", t); maps.pendingOrder.add("T");
  fns.mergeDown(maps.trainings, "trainings", [{ id: "T", data: training("T", { rows: [{ ...row("a"), label: "1" }, { ...row("b"), label: "2", reps: "8" }] }), updated_at: "S1" }], true, Date.now());
  assert.deepStrictEqual(maps.trainings.get("T").rows.map((x) => x.id + ":" + x.label + ":" + x.reps), ["b:1:8", "a:2:5"], "her numbers stand until the server holds them, and the coach's edit still lands");
  maps.trainings.delete("T"); fns.mergeDown(maps.trainings, "trainings", [{ id: "T", data: training("T"), updated_at: "S2" }], true, Date.now());
  assert.ok(maps.trainings.has("T"), "a workout hidden (paused plan) and shown again comes back while the order is queued");
  fns.persistPending(); maps.pendingOrder.clear(); maps.dirty.clear(); fns.restorePending();
  assert.ok(maps.pendingOrder.has("T") && maps.dirty.has("trainings/T"), "restored from the device and queued again");
});
test("on a conflict the client's new exercise order stands, except for a row the coach renumbered himself", async () => {
  const sb = makeSupabase(); coach(sb);
  const srv = (l1, l2, l3) => training("T", { rows: [{ ...row("r1"), label: l1 }, { ...row("r2"), label: l2 }, { ...row("r3"), label: l3 }] });
  const stamp = sb.seed("ft_trainings", "T", srv("1", "2", "3"), { client_id: "c1" });
  fns.mergeDown(maps.trainings, "trainings", [{ id: "T", data: srv("1", "2", "3"), updated_at: stamp }], true, Date.now());   // the coach's device read the workout
  sb.seed("ft_trainings", "T", srv("2", "1", "3"), { client_id: "c1" });                                                       // she started r2 first: it is 1 now, r1 is 2
  const mine = maps.trainings.get("T"); mine.rows[0].reps = "8"; mine.rows[2].label = "4";                                         // meanwhile the coach changed r1's reps and renumbered r3 himself
  await fns.cloudBackend.set("trainings", "T", JSON.parse(JSON.stringify(mine)));
  const saved = sb.tables.ft_trainings.get("T").data;
  assert.deepStrictEqual(saved.rows.map((r) => r.id + ":" + r.label), ["r1:2", "r2:1", "r3:4"], "her order lands with his edit; his own renumbering wins for its row"); assert.strictEqual(saved.rows[0].reps, "8");
  assert.deepStrictEqual(maps.trainings.get("T").rows.map((r) => r.label), ["2", "1", "4"], "the live copy learns her order too");
});
test("a coach's save sent after a relaunch still keeps the client's new order: the copy he last read travels with the stamp", async () => {
  const sb = makeSupabase(); coach(sb);
  const srv = (l1, l2, l3) => training("T", { rows: [{ ...row("r1"), label: l1 }, { ...row("r2"), label: l2 }, { ...row("r3"), label: l3 }] });
  const stamp = sb.seed("ft_trainings", "T", srv("1", "2", "3"), { client_id: "c1" });
  fns.mergeDown(maps.trainings, "trainings", [{ id: "T", data: srv("1", "2", "3"), updated_at: stamp }], true, Date.now());
  const mine = maps.trainings.get("T"); mine.rows[0].reps = "8"; fns.markDirty("trainings", "T"); fns.persistPending();   // the edit is queued when the app is closed
  maps.seenDoc.delete("trainings/T"); maps.seenAt.delete("trainings/T"); maps.dirty.clear(); fns.restorePending();         // relaunch: only the device copy is left
  assert.ok(maps.seenDoc.has("trainings/T") && maps.seenAt.has("trainings/T"), "stamp and copy restored");
  sb.seed("ft_trainings", "T", srv("2", "1", "3"), { client_id: "c1" });                                                       // she started r2 first meanwhile
  await fns.cloudBackend.set("trainings", "T", JSON.parse(JSON.stringify(mine)));
  const saved = sb.tables.ft_trainings.get("T").data;
  assert.deepStrictEqual(saved.rows.map((r) => r.id + ":" + r.label + ":" + r.reps), ["r1:2:8", "r2:1:5", "r3:3:5"], "her order stands, his edit lands");
});
test("a server copy whose rows only differ in array order is the same workout: nothing is replaced, the cards are not rebuilt", () => {
  app.reset(); app.set({ clientMode: true, myClientId: "c1" });
  const t = training("T", { rows: [{ ...row("b"), label: "1" }, { ...row("a"), label: "2" }] }); maps.trainings.set("T", t);
  fns.mergeDown(maps.trainings, "trainings", [{ id: "T", data: training("T", { rows: [{ ...row("a"), label: "2" }, { ...row("b"), label: "1" }] }), updated_at: "S1" }], true, Date.now());
  assert.strictEqual(maps.trainings.get("T"), t, "the same object stays");
});

test("a full answer from the server marks the day it came: the week's filing of missed workouts waits for one from today", async () => {
  const sb = makeSupabase(); coach(sb);
  assert.deepStrictEqual([app.get().syncedOnce, app.get().syncedOn], [false, ""], "none yet this session");
  await fns.syncDownNow();
  assert.deepStrictEqual([app.get().syncedOnce, app.get().syncedOn], [true, fns.today()], "today's");
  await settle();
});
