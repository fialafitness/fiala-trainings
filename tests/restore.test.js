// v316, the seventeenth check round: Restore (Settings · Data) held against what the app has now. The owner's pick (19 Nov 2026): what a client
// deleted in the app never comes back. Each case is a person's steps: the coach's Mac restoring, the client's phone changing the server's copy.
// Made-up people only.
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { test, assert, tick } from "./assert.js";
import { makeSupabase } from "./fake-supabase.js";
import { load } from "./load.js";
import { TEMPLATES_ID, weightIn, discomforts, attendance, isMinor, needsParent, healthEditable, effDate, inPersonCount } from "../app/model.js";
const app = await load();
const { fns, maps } = app;
const settle = async () => { const until = Date.now() + 15000; do await tick(5); while ((app.get().inflight > 0 || maps.timers.size) && Date.now() < until); };
const clone = (x) => JSON.parse(JSON.stringify(x));
const C = "3d6f1a2b-4c5d-4e6f-8a7b-9c0d1e2f3a4b", C2 = "8a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d", C3 = "9b2c3d4e-5f6a-4b7c-8d9e-0f1a2b3c4d5e";
const W = "5e7a2b3c-6d4e-4f5a-9b8c-0d1e2f3a4b5c", W2 = "6f8b3c4d-7e5f-4a6b-8c9d-1e2f3a4b5c6d", W3 = "7a9c4d5e-8f6a-4b7c-9d0e-2f3a4b5c6d7e", TP = "4b6d8f0a-2c4e-4a6b-8d0f-1a3c5e7a9b1d";
const AT = "2026-11-10T16:00:00.000Z";
let n = 0; const bump = (s) => { s.updated_at = "2026-11-22T10:" + String(10 + Math.floor(n / 50) % 50).padStart(2, "0") + ":" + String(10 + (n++ % 50)).padStart(2, "0") + ".000Z"; };
const coach = (sb) => { app.reset(); fns.leaveSettings(); app.set({ sb, signedIn: true, clientMode: false, backend: fns.cloudBackend, sessionEmail: "coach@x.com", view: { name: "clients" } }); };
const backupNow = () => clone({ app: "fiala-trainings", format: 1, exported: new Date().toISOString(), clients: Object.fromEntries(maps.clients), trainings: Object.fromEntries(maps.trainings) });
const row = (extra) => ({ id: "r1", label: "1", name: "Back squat", sets: 3, reps: "8", rest: "", tempo: "", weights: ["135", "135", "135"], repsDone: ["8", "8", "8"], setsDone: 3, done: true, note: "", unit: "lb", ...extra });
const file = (cs, ts) => ({ app: "fiala-trainings", format: 1, clients: Object.fromEntries(cs.map((c) => [c.id, c])), trainings: Object.fromEntries(ts.map((t) => [t.id, t])) });
const put = (kind, r) => { (kind === "clients" ? maps.clients : maps.trainings).set(r.id, clone(r)); maps.seenAt.set(kind + "/" + r.id, "S1"); };
const signal = async (sb) => { sb.setFail(null); app.set({ offline: false }); for (const k of [...maps.dirty.keys()]) { const [kind, id] = k.split("/"); fns.scheduleSave(kind, id, 0); } await settle(); };
const KEPT = "Health details, Health & safety, photos, Weights in and Under 18 stay as they are in the app now. In a client’s workout in both the backup and the app, a finish or skip taken back stays taken back, and a reason for skipping taken back or changed to another stays that way. On its exercises in both, notes stay as they are now, and weights and reps cleared, sets marked not done, exercises resumed and reasons for finishing early taken back or changed to another stay that way.";
const JANE = { id: C, name: "Jane Testperson", unit: "lb", choices: { health: { state: "agreed", at: "2026-11-01T08:00:00.000Z", by: "client" } }, sex: "female", birthday: "1990-03-14", health: { allergies: "Latex" } };

// ---------- Weights in: a weight with no unit of its own ----------
const serverSwitch = (sb, cid, unit) => {                             // client_set_profile's p_key 'unit' (client-profile.sql): her rows with a weight and no unit are stamped with the old unit, then the unit is set
  const c = sb.tables.ft_clients.get(cid), old = c.data.unit || "lb";
  if (old !== unit) for (const t of sb.tables.ft_trainings.values()) { if (t.client_id !== cid) continue; let ch = false; for (const r of t.data.rows || []) if (!r.unit && (r.weights || []).some((w) => /^[0-9]+([.,][0-9]+)?$/.test(String(w).trim()))) { r.unit = old; ch = true; } if (ch) bump(t); }
  c.data.unit = unit; bump(c);
};
test("a restore after the client switched Weights in to kilograms (the seventeenth check round): a backup's 135 lb, logged before rows carried a unit, stays 135 lb (read as 61.2 kg, never 135 kg), and a workout that differs only by the stamp is no change; a switch while the question is up too", async () => {
  for (const when of ["before the restore", "while the question is up"]) {
    const sb = makeSupabase(); coach(sb);
    const bench = (x) => row({ id: "b1", name: "Bench press", unit: undefined, ...x });
    sb.seed("ft_clients", C, { id: C, name: "Jane Testperson", unit: "lb" });
    sb.seed("ft_trainings", W, { id: W, clientId: C, title: "Push", date: "2026-10-15", createdAt: AT, completedAt: "2026-10-15T17:00:00.000Z", skippedAt: null, rows: [bench({})] }, { client_id: C });   // logged before rows carried a unit of their own
    sb.seed("ft_trainings", W2, { id: W2, clientId: C, title: "Legs", date: "2026-10-17", createdAt: AT, completedAt: null, skippedAt: null, rows: [row({ id: "s1", unit: undefined, weights: ["185", "185", "185"], repsDone: ["", "", ""], setsDone: 0, done: false })] }, { client_id: C });   // the coach's planned 185, no unit
    await fns.syncDownNow(); await settle();
    const backup = backupNow();
    { const t = sb.tables.ft_trainings.get(W2); t.data.title = "Legs (moved)"; bump(t); } await fns.syncDownNow(); await settle();   // a change since the backup: the restore has something to do (Legs goes back)
    if (when === "before the restore") { serverSwitch(sb, C, "kg"); await fns.syncDownNow(); await settle(); }
    const plan = fns.planRestore(backup);
    if (when === "before the restore") assert.strictEqual(plan.text, "1 workout from the file goes into the app. It replaces a copy already here, logged sets and all. Everything else stays as it is.", "Push differs only by the stamp the switch put on it: no change");
    if (when === "while the question is up") { serverSwitch(sb, C, "kg"); await fns.syncDownNow(); await settle(); }   // Jane switches on her phone, a sync under the question
    assert.deepStrictEqual(plan.ts.map((t) => t.id), [W2], when + ": Legs goes back, Push is the same");
    fns.applyRestore(plan); await settle();
    const push = sb.tables.ft_trainings.get(W).data.rows[0], legs = sb.tables.ft_trainings.get(W2).data.rows[0], unit = sb.tables.ft_clients.get(C).data.unit;
    assert.deepStrictEqual([unit, push.unit, legs.unit, maps.trainings.get(W2).rows[0].unit], ["kg", "lb", "lb", "lb"], when + ": her kilograms stay; the backup's rows say pounds, as they were logged and planned");
    assert.deepStrictEqual([weightIn(push.weights[0], push.unit, unit), weightIn(legs.weights[0], legs.unit, unit)], ["61.2", "83.9"], when + ": read in kilograms as before the restore");
    app.reset(); localStorage.clear();
  }
});

// ---------- the coach's own change not sent yet at the tap ----------
test("the coach's change not yet sent as Restore is tapped (the seventeenth check round): one bar of signal (reads work, his writes don't) while Jane's phone changes her record: his limit, birthday, Weights in, photo and exercise note stand once the signal is back; and with every request just slow, a tap while his save is out", async () => {
  const cl = { id: C, name: "Jane Testperson", unit: "lb", birthday: "1990-03-14", photo: "v1abcdef", choices: { health: { state: "agreed", at: "2026-11-18T08:00:00.000Z", by: "client" }, zone: { state: "allow", at: "2026-11-18T08:00:00.000Z", by: "client" } }, zone: { zone: "America/Los_Angeles", at: "2026-11-18T08:00:00.000Z" }, health: { limits: "Left knee" } };
  const want = { limits: "Left knee, no jumping", birthday: "1990-04-14", unit: "kg", photo: "v2bcdefa", note: "Keep the bar path straight" };
  for (const variant of ["limits", "birthday", "unit", "photo", "note", "limits, every request slow"]) {
    const sb = makeSupabase(); coach(sb);
    sb.seed("ft_clients", C, clone(cl)); sb.seed("ft_trainings", W, { id: W, clientId: C, title: "Legs", date: "2026-11-20", createdAt: AT, completedAt: null, skippedAt: null, rows: [row({ weights: ["135", "135", ""], repsDone: ["8", "8", ""], setsDone: 2, done: false })] }, { client_id: C });
    await fns.syncDownNow(); await settle();
    const backup = backupNow(); backup.trainings[W].title = "Legs (from the backup)"; backup.clients[C].name = "Jane T.";   // something real to restore, in both records
    const slow = variant.includes("slow");
    if (slow) sb.delayMs = 120; else sb.setFail({ op: "update", times: 100000, message: "Failed to fetch" });
    const key = variant.split(",")[0];
    if (key === "limits") fns.setProfile(C, "health.limits", want.limits);
    if (key === "birthday") fns.setProfile(C, "birthday", want.birthday);
    if (key === "unit") fns.setLiftUnit(C, "kg");
    if (key === "photo") { const c = maps.clients.get(C); c.photo = want.photo; maps.profileTouched.set(C, new Set(["photo"])); fns.scheduleSave("clients", C, 0); }   // as photos.js marks the coach's pick
    if (key === "note") { const r = maps.trainings.get(W).rows[0]; r.clientNote = want.note; r.clientNoteBy = "coach"; r.clientNoteAt = "2026-11-22T09:00:00.000Z"; maps.trainerNoted.set(W, new Set(["r1"])); fns.scheduleSave("trainings", W, 0); }
    if (!slow) await settle();
    { const s = sb.tables.ft_clients.get(C); s.data.zone = { zone: "Europe/Lisbon", at: "2026-11-22T09:30:00.000Z" }; bump(s); }   // Jane's phone meanwhile: her time-zone report, and a set
    { const s = sb.tables.ft_trainings.get(W); s.data.rows[0].weights[2] = "135"; s.data.rows[0].repsDone[2] = "8"; s.data.rows[0].setsDone = 3; bump(s); }
    if (slow) await tick(30); else { await fns.syncDownNow(); await settle(); }   // (the sheet syncs first; a slow save is still out at the tap)
    fns.applyRestore(fns.planRestore(backup)); await settle(); await signal(sb); sb.delayMs = 0; await settle();
    const s = sb.tables.ft_clients.get(C).data, h = maps.clients.get(C), sr = sb.tables.ft_trainings.get(W).data.rows[0], hr = maps.trainings.get(W).rows[0];
    const got = { limits: [(s.health || {}).limits, (h.health || {}).limits], birthday: [s.birthday, h.birthday], unit: [s.unit, h.unit], photo: [s.photo, h.photo], note: [sr.clientNote, hr.clientNote] }[key];
    assert.deepStrictEqual(got, [want[key], want[key]], variant + ": his change stands, on the server and here");
    assert.deepStrictEqual([s.name, sb.tables.ft_trainings.get(W).data.title, s.zone && s.zone.zone], ["Jane T.", "Legs (from the backup)", "Europe/Lisbon"], variant + ": the file's name and title land; her phone's report stays");
    app.reset(); localStorage.clear();
  }
});

// ---------- a Delete client still waiting ----------
test("a Delete client still waiting to reach the server goes before a restore of a backup holding that client, or there is no restore (the seventeenth check round: the sheet said he came back without details or photo, and the write took them from the server's copy, answers and all); a coach whose cloud library did not load restores nothing; a device with no account restores from its own copy", async () => {
  const S1 = "9d2f8a76-7b8c-4d9e-8fa6-1a2b3c4d5e67";
  const sam = { id: S1, name: "Sam Lee", unit: "lb", birthday: "1988-06-02", choices: { health: { state: "agreed", at: "2026-11-18T08:00:00.000Z", by: "client" } }, health: { allergies: "Peanuts" } };
  for (const deletes of ["failing", "working"]) {
    const sb = makeSupabase(); coach(sb); sb.seed("ft_clients", S1, clone(sam)); await fns.syncDownNow(); await settle();
    const backup = backupNow();
    sb.setFail({ op: "delete", times: 100000, message: "Failed to fetch" }); fns.deleteRec("clients", S1); await settle();   // Delete client on one bar of signal: it waits
    assert.ok(maps.deleting.has("clients/" + S1) && sb.tables.ft_clients.has(S1), "still queued");
    if (deletes === "working") sb.setFail(null);                        // the signal is back by the tap, the Delete still waiting
    const ready = await fns.restoreReady(backup);
    assert.deepStrictEqual([ready, sb.tables.ft_clients.has(S1)], deletes === "failing" ? [false, true] : [true, false], deletes + ": " + (deletes === "failing" ? "no restore while it waits" : "the Delete went first"));
    if (ready) { const plan = fns.planRestore(backup); assert.ok(plan.text.includes("Back in the app: Sam Lee, without health details, Health & safety or photo (the app asks again)."), plan.text); fns.applyRestore(plan); await settle(); const d = sb.tables.ft_clients.get(S1).data; assert.deepStrictEqual([d.name, d.health, d.birthday, d.choices], ["Sam Lee", undefined, undefined, undefined], "back with none of them: both questions asked again"); }
    sb.setFail(null); app.reset(); localStorage.clear();
  }
  app.reset(); app.set({ sb: null, signedIn: true, clientMode: false, backend: fns.cloudBackend, sessionEmail: "coach@x.com" });
  assert.strictEqual(await fns.restoreReady(file([], [])), false, "the library never loaded: no restore from a copy that may be days old");
  app.reset(); app.set({ sb: null, signedIn: false, clientMode: false, backend: fns.localBackend });
  assert.strictEqual(await fns.restoreReady(file([], [])), true, "no account: the device's own copy is the app");
  app.reset(); localStorage.clear();
});

// ---------- a reason taken back with Resume ----------
const sq = (x) => row({ id: "q1", sets: 4, reps: "5", weights: ["185", "185", "", ""], repsDone: ["5", "5", "", ""], setsDone: 2, done: true, earlyReason: "Discomfort", ...x });
test("an exercise the client resumed since the backup (the seventeenth check round): it stays open with the backup's own sets, and its Discomfort never comes back (Progress counts no day she took back); with the Resume the only difference: Nothing to restore; a reason changed stays as changed; finished again here, it stays finished, without the reason", async () => {
  const day = (k) => { const x = new Date(fns.today() + "T12:00:00"); x.setDate(x.getDate() - k); return fns.localIso(x); }, canon = (x) => String(x || "").toLowerCase();
  const cases = [
    ["resumed, then a sync", (r) => { r.done = false; delete r.earlyReason; }, true, { done: false, setsDone: 2, earlyReason: undefined }],
    ["resumed, no sync before the tap (the restore's own write meets it)", (r) => { r.done = false; delete r.earlyReason; }, false, { done: false, setsDone: 2, earlyReason: undefined }],
    ["resumed and set 3 logged", (r) => { r.done = false; delete r.earlyReason; r.weights[2] = "185"; r.repsDone[2] = "5"; r.setsDone = 3; }, true, { done: false, setsDone: 2, earlyReason: undefined }],
    ["the reason changed to Fatigue", (r) => { r.earlyReason = "Fatigue"; }, true, { done: true, setsDone: 2, earlyReason: "Fatigue" }],
    ["resumed, then finished early again with no reason", (r) => { delete r.earlyReason; }, true, { done: true, setsDone: 2, earlyReason: undefined }],
  ];
  for (const [what, change, synced, want] of cases) {
    const sb = makeSupabase(); coach(sb);
    sb.seed("ft_clients", C, { id: C, name: "Jane Testperson", unit: "lb" });
    sb.seed("ft_trainings", W2, { id: W2, clientId: C, title: "Legs A", date: day(10), createdAt: AT, completedAt: day(10) + "T17:00:00.000Z", skippedAt: null, rows: [sq({})] }, { client_id: C });   // an earlier Discomfort day, a real one
    sb.seed("ft_trainings", W, { id: W, clientId: C, title: "Legs B", date: day(2), createdAt: AT, completedAt: null, skippedAt: null, rows: [sq({})] }, { client_id: C });
    await fns.syncDownNow(); await settle();
    const backup = backupNow(); backup.trainings[W].title = "Legs B (backup)";   // so the workout is written
    { const s = sb.tables.ft_trainings.get(W); change(s.data.rows[0]); bump(s); }   // on Jane's phone
    if (synced) { await fns.syncDownNow(); await settle(); }
    const plan = fns.planRestore(backup);
    assert.ok(plan.text.endsWith(KEPT + " Everything else stays as it is.") || !synced, what + ": the sheet says what stays: " + plan.text);
    fns.applyRestore(plan); await settle();
    const pick = (r) => ({ done: r.done, setsDone: r.setsDone, earlyReason: r.earlyReason });
    assert.deepStrictEqual([pick(maps.trainings.get(W).rows[0]), pick(sb.tables.ft_trainings.get(W).data.rows[0])], [want, want], what);
    if (!want.done) assert.deepStrictEqual(discomforts([...maps.trainings.values()], canon, fns.today()).map((x) => x.days.length), [], what + ": no Discomfort note for a day she took back");
    app.reset(); localStorage.clear();
  }
  coach(makeSupabase());                                               // the Resume the only difference: nothing goes in, and that is told
  put("clients", { id: C, name: "Jane Testperson", unit: "lb" }); put("trainings", { id: W, clientId: C, title: "Legs B", date: "2026-11-10", createdAt: AT, completedAt: null, skippedAt: null, rows: [sq({ done: false, earlyReason: undefined })] });
  const p = fns.planRestore(file([], [{ id: W, clientId: C, title: "Legs B", date: "2026-11-10", createdAt: AT, completedAt: null, skippedAt: null, rows: [sq({})] }]));
  assert.deepStrictEqual([p.ts.length, p.held], [0, 1]);
  coach(makeSupabase());                                               // finished whole in the backup; the coach gave it a 4th set since: the backup's finish stands, nothing of the client's is kept out
  put("clients", { id: C, name: "Jane Testperson", unit: "lb" }); put("trainings", { id: W, clientId: C, title: "Legs B", date: "2026-11-10", createdAt: AT, completedAt: null, skippedAt: null, rows: [row({ sets: 4, done: false })] });
  const p6 = fns.planRestore(file([], [{ id: W, clientId: C, title: "Legs B", date: "2026-11-10", createdAt: AT, completedAt: null, skippedAt: null, rows: [row({})] }]));
  assert.strictEqual(p6.text, "1 workout from the file goes into the app. It replaces a copy already here, logged sets and all. Everything else stays as it is.");
  fns.applyRestore(p6); assert.deepStrictEqual([maps.trainings.get(W).rows[0].done, maps.trainings.get(W).rows[0].setsDone], [true, 3]);
  await settle(); app.reset(); localStorage.clear();
});

// ---------- what the sheet counts, and names ----------
test("a workout only opened is no change (the seventeenth check round: the empty sets a page draws counted it as replaced); whose workouts come back is named (the policy: we tell you), a client brought back once; an empty workout not in the app stays out", async () => {
  const sb = makeSupabase(); coach(sb);
  sb.seed("ft_clients", C, { id: C, name: "Jane Testperson", unit: "lb" }); sb.seed("ft_clients", C2, { id: C2, name: "Omar Sample", unit: "lb" }); sb.seed("ft_clients", C3, { id: C3, name: "Lea Example", unit: "kg" });
  sb.seed("ft_trainings", W, { id: W, clientId: C, title: "Legs", date: "2026-11-10", createdAt: AT, completedAt: AT, skippedAt: null, rows: [row({ clientNote: "knee sore after my fall", clientNoteBy: "client", clientNoteAt: AT })] }, { client_id: C });
  sb.seed("ft_trainings", W2, { id: W2, clientId: C2, title: "Push", date: "2026-11-11", createdAt: AT, completedAt: null, skippedAt: null, rows: [row({})] }, { client_id: C2 });
  sb.seed("ft_trainings", W3, { id: W3, clientId: C2, title: "Pull", date: "2026-11-12", createdAt: AT, completedAt: null, skippedAt: null, rows: [row({})] }, { client_id: C2 });
  const E = "1c3e5a7b-9d1f-4b3d-8e5f-7a9b1c3d5e7f", L = "2d4f6b8c-0e2a-4c4e-9f6a-8b0c2d4e6f8a";
  sb.seed("ft_trainings", E, { id: E, clientId: C, title: "", date: "2026-11-13", createdAt: AT, completedAt: null, skippedAt: null, rows: [] }, { client_id: C });   // an accidental day tap
  sb.seed("ft_trainings", L, { id: L, clientId: C3, title: "Upper", date: "2026-11-13", createdAt: AT, completedAt: null, skippedAt: null, rows: [row({ unit: "kg" })] }, { client_id: C3 });
  await fns.syncDownNow(); await settle();
  const backup = backupNow();
  for (const r of maps.trainings.get(W).rows) { r.weights.push("", ""); r.repsDone.push("", ""); }   // the coach opened Legs: the page drew its empty sets
  assert.strictEqual(fns.planRestore(clone(backup)).text, "", "the same as the server's copy: nothing to restore");
  { const s = sb.tables.ft_trainings.get(W), r = s.data.rows[0]; delete r.clientNote; delete r.clientNoteBy; delete r.clientNoteAt; bump(s); }   // Jane deletes her note
  await fns.syncDownNow(); await settle();
  for (const id of [W, W2, W3, E]) fns.deleteRec("trainings", id); fns.deleteRec("trainings", L); fns.deleteRec("clients", C3); await settle();   // the coach deletes the workouts, and Lea with hers
  await fns.syncDownNow(); await settle();
  const plan = fns.planRestore(clone(backup));
  assert.strictEqual(plan.text, "1 client and 4 workouts from the file go into the app. Back in the app: Lea Example, without health details, Health & safety or photo (the app asks again). Workouts back in the app: Jane Testperson (1 workout) and Omar Sample (2 workouts). Everything else stays as it is.");
  assert.ok(!plan.ts.some((t) => t.id === E), "the empty workout stays out");
  app.reset(); localStorage.clear();
});

// ---------- the restore's own write, held against the server's copy it reads (no test covered these three before) ----------
async function underTheQuestion(serverChange, coachAfterTap) {        // the question is up (planned on the Mac's copy) while the phone changes the server's; the coach taps Restore
  const sb = makeSupabase(); coach(sb);
  sb.seed("ft_clients", C, clone(JANE)); sb.seed("ft_trainings", W, { id: W, clientId: C, title: "Legs", date: "2026-11-10", createdAt: AT, completedAt: null, skippedAt: null, rows: [row({})] }, { client_id: C });
  await fns.syncDownNow(); await settle();
  const f = backupNow(); f.clients[C].name = "Jane T."; f.trainings[W].title = "Legs (file)";   // the backup differs (an older name and title), so both records are written
  const plan = fns.planRestore(f);
  serverChange(sb);                                                   // on Jane's phone, while the question is up
  if (coachAfterTap) { sb.setFail({ times: 1000, message: "Failed to fetch" }); fns.applyRestore(plan); await settle(); coachAfterTap(); await settle(); await signal(sb); }
  else { fns.applyRestore(plan); await settle(); }
  return sb;
}
test("the restore's own write (the seventeenth check round): Jane switches Weights in to kg while the question is up: kg stays; she sets Sex to Not set and clears her date of birth: they stay deleted; with no signal at the tap, the coach's note written after it stands over hers", async () => {
  let sb = await underTheQuestion((sb) => { const s = sb.tables.ft_clients.get(C); s.data.unit = "kg"; bump(s); });
  assert.deepStrictEqual([sb.tables.ft_clients.get(C).data.name, sb.tables.ft_clients.get(C).data.unit], ["Jane T.", "kg"]); app.reset(); localStorage.clear();
  sb = await underTheQuestion((sb) => { const s = sb.tables.ft_clients.get(C); delete s.data.sex; delete s.data.birthday; bump(s); });
  const d = sb.tables.ft_clients.get(C).data; assert.deepStrictEqual([d.name, d.sex, d.birthday, d.health], ["Jane T.", undefined, undefined, { allergies: "Latex" }]); app.reset(); localStorage.clear();
  sb = await underTheQuestion((sb) => { const s = sb.tables.ft_trainings.get(W); s.data.rows[0].clientNote = "knee sore"; s.data.rows[0].clientNoteBy = "client"; s.data.rows[0].clientNoteAt = AT; bump(s); },
    () => { const r = maps.trainings.get(W).rows[0]; r.clientNote = "Keep it light next time"; r.clientNoteBy = "coach"; r.clientNoteAt = new Date().toISOString(); if (!maps.trainerNoted.has(W)) maps.trainerNoted.set(W, new Set()); maps.trainerNoted.get(W).add("r1"); fns.scheduleSave("trainings", W, 0); });
  const r = sb.tables.ft_trainings.get(W).data.rows[0]; assert.deepStrictEqual([r.clientNote, r.clientNoteBy], ["Keep it light next time", "coach"]);
  app.reset(); localStorage.clear();
});

// ---------- the done rule, each half ----------
test("the done rule, each half (the seventeenth check round): a set marked not done on a row the backup has as cut short for Discomfort comes back not done, without the reason; a backup with 2 of 3 done, all 3 done here: the backup's 2 come back, never 3 counted with set 3 blank", async () => {
  coach(makeSupabase());
  const hereW = { id: W, clientId: C, title: "Legs", date: "2026-11-10", createdAt: AT, completedAt: null, skippedAt: null, rows: [row({ weights: ["135", "135", ""], repsDone: ["8", "", ""], setsDone: 1, done: false })] };
  put("clients", { id: C, name: "Jane Testperson", unit: "lb" }); put("trainings", hereW);
  fns.applyRestore(fns.planRestore(file([], [{ ...hereW, title: "Legs (file)", rows: [row({ weights: ["135", "135", ""], repsDone: ["8", "8", ""], setsDone: 2, done: true, earlyReason: "Discomfort" })] }])));
  let r = maps.trainings.get(W).rows[0]; assert.deepStrictEqual([r.setsDone, r.done, r.earlyReason], [1, false, undefined]);
  await settle(); coach(makeSupabase());
  const allDone = { ...hereW, rows: [row({})] }; put("clients", { id: C, name: "Jane Testperson", unit: "lb" }); put("trainings", allDone);
  fns.applyRestore(fns.planRestore(file([], [{ ...allDone, title: "Legs (file)", rows: [row({ weights: ["135", "135", ""], repsDone: ["8", "8", ""], setsDone: 2, done: false })] }])));
  r = maps.trainings.get(W).rows[0]; assert.deepStrictEqual([r.setsDone, r.done, r.repsDone], [2, false, ["8", "8", ""]]);
  await settle(); app.reset(); localStorage.clear();
});

// ---------- each part of "Nothing to restore", and the words ----------
const heldOf = (here, hereW, fileC, fileW) => { coach(makeSupabase()); if (here) put("clients", here); if (hereW) put("trainings", hereW); const p = fns.planRestore(file(fileC ? [fileC] : [], fileW ? [fileW] : [])); app.reset(); return [p.cs.length + p.ts.length, p.held]; };
const plainW = (extra) => ({ id: W, clientId: C, title: "Legs", date: "2026-11-10", createdAt: AT, completedAt: null, skippedAt: null, rows: [row(extra || {})] });
test("each thing a restore keeps, alone, is told as Nothing to restore (the seventeenth check round): a photo removed, Sex set to Not set, a note deleted, a weight cleared, a set marked not done, a reason taken back; a templates-only restore never adds the client words; two clients brought back: 'or photos'", () => {
  const h = { id: C, name: "Jane Testperson", unit: "lb" }, agreed = { ...h, choices: JANE.choices };
  assert.deepStrictEqual(heldOf(h, null, { ...h, photo: "v1abcdef" }, null), [0, 1], "a photo she removed");
  assert.deepStrictEqual(heldOf(agreed, null, { ...agreed, sex: "female" }, null), [0, 1], "Sex set to Not set");
  assert.deepStrictEqual(heldOf(h, plainW(), null, plainW({ clientNote: "knee sore", clientNoteBy: "client", clientNoteAt: AT })), [0, 1], "a note deleted");
  assert.deepStrictEqual(heldOf(h, plainW({ weights: ["135", "", "135"] }), null, plainW()), [0, 1], "a weight cleared");
  assert.deepStrictEqual(heldOf(h, plainW({ repsDone: ["", "", ""], setsDone: 2, done: false }), null, plainW({ repsDone: ["", "", ""] })), [0, 1], "a set marked not done (no reps to clear)");
  assert.deepStrictEqual(heldOf(h, plainW({ setsDone: 2, done: true, weights: ["135", "135", ""], repsDone: ["8", "8", ""] }), null, plainW({ setsDone: 2, done: true, weights: ["135", "135", ""], repsDone: ["8", "8", ""], earlyReason: "Discomfort" })), [0, 1], "a reason taken back");
  assert.deepStrictEqual(heldOf(h, plainW({ setsDone: 2, done: false, weights: ["135", "135", ""], repsDone: ["8", "8", ""] }), null, plainW({ setsDone: 2, done: true, weights: ["135", "135", ""], repsDone: ["8", "8", ""] })), [0, 1], "an exercise resumed (cut short with no reason)");
  coach(makeSupabase()); put("clients", { id: TEMPLATES_ID, name: "Templates", kind: "templates" });
  const tpl = { id: TP, clientId: TEMPLATES_ID, title: "Upper A", date: "2026-01-01", createdAt: AT, completedAt: null, skippedAt: null, rows: [row({ weights: ["", "", ""], repsDone: ["", "", ""], setsDone: 0, done: false })] }; put("trainings", tpl);
  assert.strictEqual(fns.planRestore(file([], [{ ...tpl, rows: [row({ weights: ["95", "95", "95"], repsDone: ["", "", ""], setsDone: 0, done: false })] }])).text, "1 template from the file goes into the app. It replaces a copy already here. Everything else stays as it is.", "a template is the coach's own: no client words, and no logged sets (the nineteenth check round)");
  coach(makeSupabase());
  assert.ok(fns.planRestore(file([{ id: C2, name: "Omar Sample", unit: "lb" }, { id: C3, name: "Lea Example", unit: "kg" }], [])).text.includes("Back in the app: Omar Sample and Lea Example, without health details, Health & safety or photos (the app asks again)."));
  app.reset(); localStorage.clear();
});

test("odd shapes in a damaged copy never stop a restore (the seventeenth check round): rows that are not a list, a null row, weights that are not a list; the twenty-second: rows a string too, and the restore itself writes every workout in the file over them, throwing nothing (relabeled read the copy here and threw: that workout and every one after it were left as they were, with no word)", async () => {
  const got = {}, want = {};
  for (const odd of [{ rows: { a: 1 } }, { rows: "x" }, { rows: [null, row({})] }, { rows: [row({ weights: "135", repsDone: null })] }]) {
    const k = JSON.stringify(odd); coach(makeSupabase()); put("clients", { id: C, name: "Jane Testperson", unit: "lb" });
    maps.trainings.set(W, { ...plainW(), ...clone(odd) }); maps.seenAt.set("trainings/" + W, "S1");   // the damaged copy here
    put("trainings", { ...plainW(), id: W2, title: "Push" });
    const p = fns.planRestore(file([], [{ ...plainW({ clientNote: "x", clientNoteBy: "client", clientNoteAt: AT }), title: "Legs (file)" }, { ...plainW(), id: W2, title: "Push (file)" }]));   // the damaged one first in the file
    assert.ok(typeof p.text === "string", k);
    let threw = null; try { fns.applyRestore(p); } catch (e) { threw = String((e && e.message) || e); }
    await settle();
    got[k] = [threw, maps.trainings.get(W).title, maps.trainings.get(W2).title]; want[k] = [null, "Legs (file)", "Push (file)"];
    app.reset(); localStorage.clear();
  }
  assert.deepStrictEqual(got, want, "over each damaged copy: nothing thrown, and both workouts are the file's");
});

let probeOut = null;                                                   // restore-probe.mjs, run once in its own process and read by each test of the picker below
const probe = () => probeOut || (probeOut = JSON.parse(execFileSync(process.execPath, [path.join(path.dirname(fileURLToPath(import.meta.url)), "restore-probe.mjs")], { encoding: "utf8", timeout: 90000 }).trim().split("\n").pop()));
test("the restore picker itself (the seventeenth check round): a backup differing only by what a restore keeps opens Nothing to restore with the words; one the same says so in the status line; signed in, a Delete client still waiting refuses, one landed is named, and with no cloud library it says what to do", () => {
  const r = probe();
  assert.deepStrictEqual(r.kept.alert, { title: "Nothing to restore", text: [KEPT + " Everything else in that backup is already here."] });
  assert.deepStrictEqual([r.same.alert, r.same.status], [null, "Everything in that backup is already here"]);
  assert.deepStrictEqual([r.waits.alert && r.waits.alert.title, r.waits.alert && r.waits.alert.text, r.waits.question, r.waits.samOnServer], ["Couldn\u2019t restore", ["The server didn\u2019t answer. Try again later."], null, true], "signed in, a Delete client of a client the backup holds still waiting: no restore (the eighteenth check round: no test drove the picker's call)");
  assert.ok(r.lands.question && r.lands.question.text.includes("Back in the app: Sam Lee, without health details") && !r.lands.samOnServer, "the Delete went first: " + JSON.stringify(r.lands));
  assert.deepStrictEqual([r.nolib.alert && r.nolib.alert.text, r.nolib.question], [["Restore needs the server. Close the app, then open it again when you\u2019re online."], null], "the cloud library never loaded: trying again on this page cannot work, and the words say so");
  assert.ok(r.race.question.includes("Workouts back in the app: Jane Roe (1 workout) and Omar Sample (1 workout)."), r.race.question);
  assert.deepStrictEqual([r.race.legsOnServer, r.race.pushOnServer, r.race.janeOnServer, r.race.janeHere, r.race.legsHere], [false, true, false, false, false], "Jane deleted on the iPad while the question was up, this page syncing nothing meanwhile: the sync after the tap keeps her deleted, and her Legs is never written (the nineteenth check round)");
  assert.deepStrictEqual([r.raceInFlight.legsOnServer, r.raceInFlight.pushOnServer, r.raceInFlight.janeOnServer, r.raceInFlight.janeHere, r.raceInFlight.legsHere, r.raceInFlight.said], [false, true, false, false, false, null], "the same with the minute's sync already out at the tap, its reads made before her Delete landed: the handler waits for it and reads once more (the twentieth check round: it took that sync's answer, wrote her Legs after her deletion and showed her again)");
  assert.deepStrictEqual([r.raceBefore.question.includes("Back in the app: Jane Roe, without health details"), r.raceBefore.janeOnServer, r.raceBefore.legsOnServer, r.raceBefore.pushOnServer], [true, true, true, true], "Jane deleted on the iPad just before the file is picked, the minute's sync already out: the question is planned on a read begun after it, so it names her as back, and Restore brings her back as it said (the twentieth check round)");
  assert.deepStrictEqual([r.raceFails.said, r.raceFails.legsOnServer, r.raceFails.pushOnServer, r.raceFails.janeOnServer, r.raceFails.legsHere, r.raceFails.pageInert, r.raceFails.bar], [["Couldn\u2019t restore", "The server didn\u2019t answer. Try again later."], false, false, false, false, false, "Offline"], "the sync after the tap fails (the signal drops as Restore is tapped): no restore, and the words said before the question (the twentieth check round: its answer was thrown away, and her Legs was written after her deletion); the bar keeps the failed sync's own word (the twenty-second check round)");
  assert.deepStrictEqual([r.raceSlow.during, r.raceSlow.pageInert, r.raceSlow.legsOnServer, r.raceSlow.pushOnServer, r.raceSlow.janeHere, r.raceSlow.said], [{ pageInert: true, bar: "Saving\u2026", headInert: false, backInert: true, statusInert: false, held: true, flags: { restoreRead: true, restoring: 1 } }, false, false, true, false, null], "on one bar of signal the page is out of reach and the bar says Saving… until the restore lands, then in reach again (the twentieth check round: a set logged in those seconds was replaced by the file's copy, here and on the server)");
  assert.deepStrictEqual([r.raceSeeding.said, r.raceSeeding.legsOnServer, r.raceSeeding.pushOnServer, r.raceSeeding.janeHere], [null, false, true, false], "the built-in templates' seeding under way at the tap (a sync's end starts it on an account below TEMPLATES_VERSION, and it refuses every read): the read after the tap waits for it, and the restore goes ahead");
  assert.deepStrictEqual([r.raceSeedingStuck.said, r.raceSeedingStuck.pushOnServer, r.raceSeedingStuck.pageInert, r.raceSeedingStuck.bar], [["Couldn\u2019t restore", "The server didn\u2019t answer. Try again later."], false, false, "Couldn\u2019t sync"], "a seeding that never ends: after 10 s no restore, the words said before the question, and the bar says Couldn't sync, no longer Saving… (the twenty-second check round: it said Saved beside Couldn't restore)");
  assert.deepStrictEqual(r.signout, { question: true, clientsHere: 0, trainingsHere: 0, dirty: 0, serverWrites: 0, copyHolds: false, pageInert: false }, "signed out while the sync after the tap is out: nothing of the restore lands on the wiped device or the server (the twentieth check round: no test held it)");
  { const after = { headInert: false, backInert: false, statusInert: false, liftInert: true, flags: { restoreRead: false, restoring: 0 } }, NA0 = ["Couldn\u2019t restore", "The server didn\u2019t answer. Try again later."];   // the twenty-first check round
    for (const k of ["race", "raceInFlight", "raceFails", "raceSlow", "raceSeedingStuck", "offlineAtTap", "server500", "barSyncOut", "barBanner", "raceAllGone"]) { const { focusBack, ...rest } = r[k].after; assert.deepStrictEqual(rest, after, k + ": nothing left out of reach after the read, landed or failed (and what was inert before it, as #ctxLift in the markup, stays so)"); }
    assert.strictEqual(r.raceSlow.after.focusBack, true, "a keyboard's focus, taken by the inert page, goes back to Restore once the read is in (it stayed on the page itself)");
    assert.ok(r.barSyncOut.bars.filter(([, inert]) => inert).length >= 8 && r.barSyncOut.bars.every(([bar, inert]) => !inert || bar === "Saving…"), "a sync already out at the tap ends during the read: the bar says Saving… for as long as the page is out of reach (it said Saved over the frozen page): " + JSON.stringify(r.barSyncOut.bars));
    assert.deepStrictEqual([r.barSyncOut.said, r.barSyncOut.pushOnServer, r.barSyncOut.janeHere], [null, true, false]);
    assert.deepStrictEqual(["race", "raceInFlight", "raceSlow", "raceSeeding", "seedAfterSync", "barSyncOut", "raceAllGone"].map((k) => [k, r[k].bar]), ["race", "raceInFlight", "raceSlow", "raceSeeding", "seedAfterSync", "barSyncOut", "raceAllGone"].map((k) => [k, "Saved"]), "a restore that landed ends on Saved in the bar (the twenty-second check round: only a read that failed with no words of its own says Couldn't sync)");
    assert.deepStrictEqual([r.raceAllGone.question.includes("Workouts back in the app: Jane Roe (1 workout)."), r.raceAllGone.said, r.raceAllGone.legsOnServer, r.raceAllGone.janeOnServer, r.raceAllGone.legsHere], [true, null, false, false, false], "a backup of Jane's alone, Jane deleted on the iPad under the question: nothing written and no alert, and the bar above says Saved with no save of the restore's own to say it (its read went well)");
    assert.deepStrictEqual([r.server500.said, r.server500.bar, r.server500.pushOnServer], [["Couldn’t restore", "The server didn’t answer. Try again later."], "Couldn’t sync · Internal Server Error", false], "a server error on the read after the tap: no restore, and the bar keeps the sync's own words (it said Saved beside Couldn't restore)");
    assert.deepStrictEqual([r.offlineAtTap.said, r.offlineAtTap.bar, r.offlineAtTap.pushOnServer], [["Couldn’t restore", "Restore needs a connection. Try again when you’re online."], "Offline", false], "offline at the tap: the words for no connection (no test held them)");
    assert.ok(r.seedAfterSync.seedingSeen > 0, "the seeding ran after the tap, started by the end of the sync already out: " + r.seedAfterSync.seedingSeen);
    assert.deepStrictEqual([r.seedAfterSync.said, r.seedAfterSync.legsOnServer, r.seedAfterSync.pushOnServer, r.seedAfterSync.janeHere], [null, false, true, false], "the minute's sync out at the tap, its end starting the seeding: the read after the tap waits for both, in that order, and the restore lands");
    assert.deepStrictEqual([r.localRestore.question, r.localRestore.name, r.localRestore.said, r.localRestore.pageInert], ["Restore this backup?", "Jane T. Person", null, false], "the device alone (no account): Restore restores at once, nothing to read first");
    assert.deepStrictEqual(r.typing, { whileTyping: [false, ""], afterTyping: [true, "Restore this backup?"] }, "the question waits while a weight is being typed (it took the keys and its Cancel took his Return), and comes up once he leaves the box");
    assert.deepStrictEqual(r.typingAlert, { before: { whileTyping: null, afterTyping: NA0 }, after: { whileTyping: null, afterTyping: NA0 } }, "the handler's own alert, before the question or after the tap, waits while a box is being typed in, as the question does");
    assert.ok(r.secondPick.first && r.secondPick.during.length > 4 && r.secondPick.during.every((x) => !x), "the backup picked twice: the second question never opens while the first restore's read is out (it opened inside the page made inert): " + JSON.stringify(r.secondPick));
    assert.deepStrictEqual([r.secondPick.later, r.secondPick.end], [{ asking: true, pageInert: true, headInert: true, legsHere: true }, { asking: false, pageInert: false, flags: { restoreRead: false, restoring: 0 } }], "it comes up once the first restore has landed, the page behind it blocked as for any question");
    assert.deepStrictEqual(r.release, { beforeQuestion: 0, duringRead: 0, landed: true, afterLanding: 1 }, "a newer release on the device: no reload while a backup is being restored (it dropped the restore he had confirmed); the next time he leaves the app after it, the page comes back new");
    const g = r.guards, NA = ["Couldn’t restore", "The server didn’t answer. Try again later."];
    assert.deepStrictEqual([g.throwBefore.alert, g.throwBefore.question, g.throwBefore.value], [NA, "", ""], "a read that throws before the question: the server's words, never \"not a Fiala backup\"; the picker emptied");
    assert.deepStrictEqual([g.throwOut.alert, g.throwOut.question], [NA, ""], "a sync already out that throws: the same");
    assert.deepStrictEqual([g.heldBefore.question, g.heldBefore.questionLater], ["", "Restore this backup?"], "a sheet up as the read before the question ends: the question waits for it");
    assert.deepStrictEqual([g.barClass.barClassDuring, g.barClass.barDuring], ["", "Saving…"], "the bar's red goes while it says Saving…");
    assert.deepStrictEqual([g.throwAfter.barDuring, g.throwAfter.alertAfter], ["Couldn’t sync", NA], "the read after the tap throws: no restore, the alert says so, and the bar says Couldn't sync (the twenty-second check round: it said Saved beside Couldn't restore)");
    assert.deepStrictEqual([g.failHeld.alertHeld, g.failHeld.alertAfter], [null, NA], "the read after the tap fails with a sheet up: the alert waits for it");
    assert.deepStrictEqual([g.failLeft.alertHeld, g.failLeft.alertAfter], [null, null], "signed out while the alert waited: no alert"); }
  assert.deepStrictEqual(r.rejected, [], "nothing thrown that nobody handled, in any case of the picker");
});
const NA22 = ["Couldn’t restore", "The server didn’t answer. Try again later."], ASKS = [true, "Restore this backup?"];
test("on a computer, a step off the Clients page while a picked backup is read before its question (a client's row; the Settings, Catalog and Data pills) goes where it should, and the restore still asks and lands; the file input's value is never copied into the page's picture (the twenty-second check round: the picture copied it, which a browser refuses, so the row did nothing, a pill left the page half-changed and the restore said the server had not answered)", () => {
  const { shots, ...r } = probe().navDuringRead;
  assert.deepStrictEqual(r, { steps: { row: "ok", rowOpens: "client", back: "ok", settingsBtn: "ok", settingsBtnOpens: "settings", settingsBtnBack: "ok", catalogBtn: "ok", catalogBtnOpens: "catalog", catalogBtnBack: "ok", dataBtn: "ok", dataBtnOpens: "data" }, question: "Restore this backup?", alert: null, fileEmptied: true, landed: [true, true], said: null, copied: [] }, "each step goes through (none throws), the question comes, Restore lands, and nothing is copied into the picture's file input");
  assert.ok(shots > 0, "the steps took the page's picture, as a computer's (with none, nothing here was tested): " + shots);
});
test("a date box typed into by keys (a Mac's Active until) holds the Restore question, and the alert after the tap, until he leaves it; a phone's date wheel tapped, or a box that takes no typing (the Client view's title), holds nothing (the twenty-second check round: the question came up mid-date and his Return took its Cancel; any box in focus counted as typing would hold the question for good)", () => {
  const b = probe().focusedBox;
  assert.deepStrictEqual(b.keys, { whileIn: [false, ""], afterLeaving: ASKS }, "typed by keys: the question waits, and comes once he leaves the box");
  assert.deepStrictEqual(b.alertKeys, { whileIn: null, afterLeaving: NA22 }, "typed by keys as the read after the tap fails: the alert waits, and comes once he leaves the box");
  assert.deepStrictEqual([b.tap, b.readonly], [{ whileIn: ASKS, afterLeaving: ASKS }, { whileIn: ASKS, afterLeaving: ASKS }], "a date wheel tapped on a phone, or a read-only box in focus: no typing, the question comes at once");
});
test("the alerts for a file the Restore picker cannot take wait while a box is being typed in, as its other alerts do: not a Fiala backup, as a weight is typed; from a newer version, as a date box is typed by keys (the twenty-second check round: they came at once, though CLAUDE.md promised the wait)", () => {
  assert.deepStrictEqual(probe().badFile, { notBackup: { whileTyping: null, afterTyping: ["Couldn’t restore", "That file is not a Fiala backup."] }, newer: { whileTyping: null, afterTyping: ["Couldn’t restore", "That backup is from a newer version of the app."] } }, "no alert pops up under his typing; it comes once he leaves the box");
});
test("a failed save's banner up as Restore is tapped, a sync out: the bar says Saving… for as long as the page is out of reach (the twenty-second check round: no test held the order of setStatus's lines; with the failed save's line first, the bar would go blank over the frozen page)", () => {
  const bars = probe().barBanner.bars;
  assert.ok(bars.filter(([, inert]) => inert).length >= 8 && bars.every(([bar, inert]) => !inert || bar === "Saving…"), "every bar sampled while the page is out of reach says Saving…: " + JSON.stringify(bars));
});
test("a damaged copy here (a workout's rows not a list) never stops a restore made with the Restore picker: on the device alone both workouts in the file are written; signed in, the read before the question takes the server's whole copy over it, and the restore lands (the twenty-second check round: relabeled threw on it, the restore wrote neither workout and said nothing, and signed in the read said the server had not answered)", () => {
  const { alone, signedIn } = probe().oddHere, ok = { restoreRead: false, restoring: 0 };
  assert.deepStrictEqual(alone, { question: "Restore this backup?", said: null, here: ["Push (from the backup)", "Legs (from the backup)"], server: null, flags: ok }, "the device alone: the question, then both workouts as in the file, and no alert");
  assert.deepStrictEqual(signedIn, { question: "Restore this backup?", said: null, here: ["Push (from the backup)", "Legs"], server: ["Push (from the backup)", "Legs"], flags: ok }, "signed in: the question, then Push as in the file and Legs back, here and on the server, and no alert");
});
test("the backup picked twice and both restored, a newer release on the device: the page never reloads during the second restore's read, and comes back new once both have landed (the twenty-second check round: no test held it; counted as a flag, the first restore to end would clear it, and the reload would drop the second)", () => {
  assert.deepStrictEqual(probe().twiceBoth, { second: true, flags: { restoreRead: true, restoring: 1 }, duringSecondRead: 0, end: { restoreRead: false, restoring: 0 }, afterBoth: 1 }, "the second restore still counted while its read is out: no reload under it; once both have landed, leaving the app brings the new release");
});
test("a throw inside the Restore handler leaves nothing counted: a newer release still reloads the page the next time he leaves the app (the twenty-second check round: no test held it; without the change listener's finally, one throw would hold every release off for the session)", () => {
  assert.deepStrictEqual(probe().throwInside, { threw: true, flags: { restoreRead: false, restoring: 0 }, reloads: 1 }, "the handler threw, nothing stays counted, and leaving the app brings the new release");
});
// ---------- the twenty-third check round ----------
const WAITS = { whileIn: [false, ""], afterLeaving: ASKS }, AT_ONCE = { whileIn: ASKS, afterLeaving: ASKS };
const onComputer = () => JSON.parse(execFileSync(process.execPath, [path.join(path.dirname(fileURLToPath(import.meta.url)), "restore-probe.mjs"), "desk"], { encoding: "utf8", timeout: 90000 }).trim().split("\n").pop());   // the probe again as a computer (a mouse or a trackpad: main.js's deskOn), keysIn's cases only
test("the Restore question and a box in focus, each of keysIn's own rules through the Restore picker: a month box typed by keys holds the question, and on a computer so does a date box he has only clicked into; a read-only date box after a key never holds it, nor a checkbox toggled by Space; each asks once he leaves the box (the twenty-third check round: any of the four could be undone with every test passing; on a Mac the question came up mid-date in Active until)", () => {
  const phone = probe().keyKinds, desk = onComputer();
  const words = { dateTap: "a date box only clicked into, no key yet", monthKey: "a month box typed by keys", roDateKey: "a read-only date box after a key", checkboxSpace: "a checkbox toggled by Space" };
  const want = { phone: { dateTap: AT_ONCE, monthKey: WAITS, roDateKey: AT_ONCE, checkboxSpace: AT_ONCE }, computer: { dateTap: WAITS, monthKey: WAITS, roDateKey: AT_ONCE, checkboxSpace: AT_ONCE } };
  assert.deepStrictEqual([desk.desk, desk.rejected], [true, []], "the second run is a computer's, and nothing was thrown that nobody handled");
  for (const [where, got] of [["phone", phone], ["computer", desk.keyKinds]]) for (const k of Object.keys(words)) assert.deepStrictEqual(got[k], want[where][k], "on a " + where + ", " + words[k] + ": " + (want[where][k] === WAITS ? "the question waits until he leaves the box, then comes" : "nothing to wait for, the question comes at once"));
});
test("the bar says Couldn't sync beside Couldn't restore, never Saved, when the read before the question fails with no words of its own (the built-in templates' seeding stuck past its 10 s, or a read that throws) and after the tap when a save still out lands after the alert; the next good sync says Saved, and a clock set back never holds Couldn't sync (the twenty-third check round: the bar said Saved beside the alert)", () => {
  const { bar23: b, guards: g } = probe(), CS = "Couldn\u2019t sync", SAVING = "Saving\u2026", ok = { restoreRead: false, restoring: 0 };
  const said = { beforeStuck: "the seeding stuck before the question", beforeThrows: "every read throwing before the question", beforeStuckSave: "the seeding stuck before the question, Omar's save still out", afterSave: "the seeding stuck after the tap, Omar's save still out", clockBack: "the same after the tap, the Mac's clock then set back 2 hours" };
  assert.deepStrictEqual([g.throwBefore.alert, g.throwBefore.bar], [NA22, CS], "a read that throws before the question: the alert, and Couldn't sync in the bar (it said Saved)");
  assert.deepStrictEqual([g.throwOut.alert, g.throwOut.bar], [NA22, CS], "a sync already out at the pick that throws, then the read before the question too: the same");
  for (const k of ["beforeStuck", "beforeThrows"]) {
    assert.deepStrictEqual([b[k].atPick, b[k].question], ["Saved", ""], said[k] + ": Saved in the bar as the backup is picked, and no question");
    assert.deepStrictEqual(b[k].alertAt, { alert: NA22, bar: CS }, said[k] + ": the alert comes with Couldn't sync in the bar beside it, not Saved");
    assert.strictEqual(b[k].barEnd, CS, said[k] + ": the bar still says Couldn't sync a while later");
  }
  assert.deepStrictEqual([b.beforeStuckSave.atPick, b.beforeStuckSave.alertAt], [SAVING, { alert: NA22, bar: SAVING }], said.beforeStuckSave + " on one bar of signal as the read fails: Saving… beside the alert");
  assert.deepStrictEqual([b.beforeStuckSave.omarOnServer, b.beforeStuckSave.barEnd], ["3105550199", CS], said.beforeStuckSave + ": once his save lands after the alert, the bar says Couldn't sync, never Saved (no read has gone well since)");
  for (const k of ["afterSave", "clockBack"]) {
    assert.deepStrictEqual([b[k].question, b[k].atTap, b[k].alertAt], ["Restore this backup?", SAVING, { alert: NA22, bar: SAVING }], said[k] + ": Restore tapped, the read after it fails: Saving… beside the alert");
    assert.deepStrictEqual([b[k].omarOnServer, b[k].legsOnServer, b[k].barEnd], ["3105550199", false, CS], said[k] + ": his save lands after the alert and nothing is restored: the bar says Couldn't sync, never Saved beside Couldn't restore");
  }
  for (const k of ["beforeStuck", "beforeThrows", "beforeStuckSave", "afterSave"]) assert.deepStrictEqual([b[k].afterGoodSync, b[k].afterNextSave, b[k].flags], ["Saved", "Saved", ok], said[k] + ": the next good sync says Saved again, and so does the next save");
  assert.deepStrictEqual([b.clockBack.afterGoodSync, b.clockBack.afterNextSave, b.clockBack.flags], ["Saved", "Saved", ok], said.clockBack + ": the next good sync still says Saved, and so does the next save (on the wall clock, Couldn't sync stayed until the clock caught up)");
  assert.deepStrictEqual(probe().rejected, [], "nothing thrown that nobody handled");
});
// ---------- the twenty-fourth check round ----------
test("on the Data page, whose bar starts blank, a read before the Restore question that fails with no words of its own (the built-in templates' seeding stuck past its 10 s, or every read throwing) says Couldn't sync beside Couldn't restore, and keeps saying it 2.5 s later, after OK, after Back on the Clients list and after the minute's sync, still failing; the next good sync says Saved (the twenty-fourth check round: the bar stayed blank, as the rule only took a bar that said Saved)", () => {
  const d24 = probe().data24, CS = "Couldn\u2019t sync";
  for (const how of ["stuck", "throws"]) {
    const d = d24[how], w = how === "stuck" ? "the seeding stuck" : "every read throwing";
    assert.deepStrictEqual([d.onClients, d.onData], ["Saved", { bar: "", page: "data" }], w + ": Saved on the Clients page, and the Data page opens with its bar blank");
    assert.deepStrictEqual(d.atAlert, { alert: NA22, bar: CS }, w + ": the alert comes with Couldn't sync in the bar beside it, never a blank bar");
    assert.deepStrictEqual(d.alertLater, { alert: NA22, bar: CS }, w + ": 2.5 s later the bar still says Couldn't sync");
    assert.deepStrictEqual([d.pressedOK, d.afterOK], [true, { alert: null, bar: CS, page: "data" }], w + ": OK closes the alert, and the bar still says Couldn't sync");
    assert.deepStrictEqual(d.backOnClients, { bar: CS, page: false, view: "clients" }, w + ": Back on the Clients list, the bar still says Couldn't sync");
    assert.strictEqual(d.afterFailedSync, CS, w + ": the minute's sync, failing with no words of its own too, leaves Couldn't sync");
    assert.deepStrictEqual([d.afterGoodSync, d.question, d.flags], ["Saved", "", { restoreRead: false, restoring: 0 }], w + ": a good sync says Saved; no question ever came, and nothing of the restore stays counted");
  }
});
const signedInClean = (s, as, w) => {                                    // a sign-in on one bar of signal (each answer 2.5 s): the bar from the tap on
  assert.deepStrictEqual([s.signedIn, s.as, s.login], [true, as, false], w + ": signed in, and off the sign-in page");
  assert.deepStrictEqual(s.seen.map(([, bar]) => bar), ["", "Saved"], w + ": the bar is blank on the sign-in page, then says Saved as the account opens and once its first sync lands, never Couldn't sync: " + JSON.stringify(s.seen));
  assert.ok(s.synced !== null && s.seen[1][0] < s.synced, w + ": the account opened before its first sync landed, so the bar was seen in between (Saved at " + (s.seen[1] || [])[0] + " ms, the sync landed at " + s.synced + " ms)");
};
test("Sign out while the read before the Restore question is still out (on the Data page, the seeding stuck): the read failing after it leaves the sign-in page's bar blank, and the same coach signing in again on this page never sees Couldn't sync (the twenty-fourth check round: a failure landing after the sign-out still counted, so the next sign-in said Couldn't sync until its first sync landed, 5 s on one bar of signal; with the blank bar taken as well, the sign-in page said it too)", () => {
  const { mid } = probe().signOut24;
  assert.deepStrictEqual(mid.signedOut, { done: true, login: true, signedIn: false, bar: "" }, "signed out during the read: the sign-in page, its bar blank");
  assert.deepStrictEqual(mid.onSignInPage, { bar: "", alert: null, login: true, question: "" }, "the read fails after the sign-out: the sign-in page's bar stays blank, with no alert and no question");
  signedInClean(mid.signIn, "coach@test", "the same coach signs in again");
  assert.deepStrictEqual(mid.flags, { restoreRead: false, restoring: 0 }, "nothing of the restore stays counted");
});
test("after a restore's read fails (Couldn't sync beside Couldn't restore, as designed), OK and Sign out, the next sign-in on this page, another coach or the same, never says Couldn't sync: Saved before its first sync lands and after (the twenty-fourth check round: the failed read outlived the sign-out, and the next sign-in said Couldn't sync until its first sync landed, 5 s on one bar of signal)", () => {
  const { after, afterSame } = probe().signOut24, CS = "Couldn\u2019t sync";
  for (const [o, as, w] of [[after, "second.coach@example.com", "another coach"], [afterSame, "coach@test", "the same coach"]]) {
    assert.deepStrictEqual([o.question, o.atAlert, o.pressedOK, o.beforeSignOut], ["Restore this backup?", { alert: NA22, bar: CS }, true, CS], w + ": Restore tapped and its read failing, Couldn't sync beside Couldn't restore, and still after OK");
    assert.deepStrictEqual(o.signedOut, { done: true, login: true, signedIn: false, bar: "" }, w + ": Sign out: the sign-in page, its bar blank");
    signedInClean(o.signIn, as, w + " signs in");
    assert.deepStrictEqual(o.flags, { restoreRead: false, restoring: 0 }, w + ": nothing of the restore stays counted");
  }
  assert.deepStrictEqual(probe().rejected, [], "nothing thrown that nobody handled");
});
// ---------- the twenty-fifth check round ----------
// R25-HND-3: Couldn't sync went beside Couldn't restore only over a bar saying Saved or nothing, so the restore's own earlier words stayed there;
// R25-HND-4: a backup picked before Sign out came back after the same coach signed in again, its read still out (left() compared only the email).
test("on the Data page, this morning's backup (nothing new: the bar says Everything in that backup is already here), then an older one whose read before the question fails with no words of its own (every read throwing, or the built-in templates' seeding stuck past its 10 s): the bar says Couldn't sync beside Couldn't restore, and keeps saying it 2.5 s later, after OK, back on the Clients list and after the minute's sync, still failing; a good sync says Saved; with no connection it says Offline (the twenty-fifth check round, R25-HND-3: the bar kept saying Everything in that backup is already here beside the alert until a sync succeeded)", () => {
  const a = probe().already25, CS = "Couldn’t sync", ALREADY = "Everything in that backup is already here", NC = ["Couldn’t restore", "Restore needs a connection. Try again when you’re online."];
  for (const [how, w, said, bar] of [["throws", "every read throwing", NA22, CS], ["stuck", "the seeding stuck", NA22, CS], ["offline", "no connection", NC, "Offline"]]) {
    const o = a[how];
    assert.deepStrictEqual([o.onData, o.first], ["", { bar: ALREADY, alert: null, question: "" }], w + ": the Data page opens with its bar blank, and this morning's backup says Everything in that backup is already here, with no question");
    assert.deepStrictEqual(o.atAlert, { alert: said, bar }, w + ": the older backup's read fails: the alert comes with " + bar + " in the bar beside it (it said " + (o.atAlert && o.atAlert.bar) + ")");
    assert.deepStrictEqual(o.alertLater, { alert: said, bar }, w + ": 2.5 s later the bar still says " + bar);
    assert.deepStrictEqual([o.pressedOK, o.afterOK], [true, { alert: null, bar }], w + ": OK closes the alert, and the bar still says " + bar);
    assert.deepStrictEqual(o.backOnClients, { bar, view: "clients" }, w + ": Back on the Clients list, the bar still says " + bar);
    assert.strictEqual(o.afterFailedSync, bar, w + ": the minute's sync, failing too, leaves " + bar);
    assert.deepStrictEqual([o.afterGoodSync, o.question, o.flags], ["Saved", "", { restoreRead: false, restoring: 0 }], w + ": a good sync says Saved; no question ever came, and nothing of the restore stays counted");
  }
});
test("on the Data page, a backup picked while the read before its question waits for the seeding (a new account's first sync), then Sign out, and the same coach signs in again on this page before that read ends: nothing of it comes up in the new session, whether the read fails (no Couldn't restore, no Couldn't sync) or goes on once the seeding ends (no Restore this backup?), and the bar says Saved throughout; another coach signing in sees nothing either (the twenty-fifth check round, R25-HND-4: the same coach got Couldn't sync with Couldn't restore, or the question for the backup picked before Sign out, as left() compared only the email)", () => {
  const b = probe().signBack25;
  for (const [k, as, w] of [["fails", "coach@test", "the same coach, the read failing at its 10 s"], ["goesOn", "coach@test", "the same coach, the read going on once the seeding ends"], ["otherGoesOn", "second.coach@example.com", "another coach, the read going on"]]) {
    const o = b[k];
    assert.deepStrictEqual(o.signedOut, { done: true, login: true, signedIn: false, bar: "" }, w + ": Sign out during the read: the sign-in page, its bar blank");
    assert.deepStrictEqual(o.signedIn, { signedIn: true, as, login: false, before: true }, w + ": signed in again on this page before the read ended");
    assert.ok(o.seen.length && o.seen.every(([bar, alert, question]) => bar === "Saved" && alert === null && question === ""), w + ": the bar says Saved throughout, with no alert and no question, until well after the read ends: " + JSON.stringify(o.seen));
    assert.deepStrictEqual(o.end, { bar: "Saved", alert: null, question: "", flags: { restoreRead: false, restoring: 0 }, as }, w + ": at the end, nothing of the restore is up or counted (it showed " + JSON.stringify([o.end.bar, o.end.alert, o.end.question]) + ")");
  }
  assert.deepStrictEqual(probe().rejected, [], "nothing thrown that nobody handled");
});

// ---------- the eighteenth check round ----------
test("a workout whose client is gone never stops a restore (the eighteenth check round: one planned on the coach's iPhone with no signal reached the server after Delete client on the Mac, and every backup made since was refused, \"That file is not a Fiala backup.\"): Back up leaves it out, and a file that holds one restores the rest", async () => {
  const SAM = "2a1b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d", ORPHAN = "6e5f7a8b-9c0d-4e1f-8a2b-3c4d5e6f7a8b";
  const sb = makeSupabase(); coach(sb);
  sb.seed("ft_clients", C, { id: C, name: "Jane Testperson", unit: "lb" }); sb.seed("ft_clients", TEMPLATES_ID, { id: TEMPLATES_ID, name: "Templates", kind: "templates" });
  sb.seed("ft_trainings", W, plainW(), { client_id: C });
  sb.seed("ft_trainings", TP, { id: TP, clientId: TEMPLATES_ID, title: "Upper A", date: "2026-01-01", createdAt: AT, completedAt: null, skippedAt: null, rows: [row({ weights: [], repsDone: [], setsDone: 0, done: false })] }, { client_id: TEMPLATES_ID });
  sb.seed("ft_trainings", ORPHAN, { id: ORPHAN, clientId: SAM, title: "Pull B", date: "2026-11-27", createdAt: AT, completedAt: null, skippedAt: null, rows: [row({ id: "n1", name: "Pull-up", weights: [], repsDone: [], setsDone: 0, done: false })] }, { client_id: SAM });   // Sam deleted, his new workout landed after
  await fns.syncDownNow(); await settle();
  assert.ok(maps.trainings.has(ORPHAN) && !maps.clients.has(SAM), "in the device copy, shown nowhere");
  const b = fns.backupData();
  assert.deepStrictEqual([!!b.trainings[W], !!b.trainings[TP], !!b.trainings[ORPHAN]], [true, true, false], "Back up: Jane's workout and the template in, the one whose client is gone out");
  const old = clone(b); old.trainings[ORPHAN] = clone(maps.trainings.get(ORPHAN));   // a file made before this release, with it
  fns.deleteRec("trainings", W); await settle(); await fns.syncDownNow(); await settle();   // Jane's workout deleted by mistake
  const plan = fns.planRestore(old);
  assert.deepStrictEqual([plan.ts.map((t) => t.id), plan.text], [[W], "1 workout from the file goes into the app. Workouts back in the app: Jane Testperson (1 workout). Everything else stays as it is."], "the rest restores");
  app.reset(); localStorage.clear();
});

test("an exercise the coach deleted since the backup comes back with what the client had on it, and the question names whose (the eighteenth check round: her deleted note came back unannounced, and the policy promises we tell her); the coach's own plan on one is nothing to tell", async () => {
  const sb = makeSupabase(); coach(sb);
  sb.seed("ft_clients", C, { id: C, name: "Jane Testperson", unit: "lb" });
  sb.seed("ft_trainings", W, { ...plainW({ clientNote: "knee sore after my fall", clientNoteBy: "client", clientNoteAt: AT }), rows: [row({ clientNote: "knee sore after my fall", clientNoteBy: "client", clientNoteAt: AT }), row({ id: "r2", label: "2", name: "Romanian deadlift", weights: ["95", "95", "95"], repsDone: ["", "", ""], setsDone: 0, done: false, clientNote: "slow down", clientNoteBy: "coach" })] }, { client_id: C });
  sb.seed("ft_trainings", W2, { id: W2, clientId: C, title: "Upper", date: "2026-11-20", createdAt: AT, completedAt: null, skippedAt: null, rows: [row({ id: "u1", name: "Bench press", done: false, setsDone: 0, repsDone: ["", "", ""] })] }, { client_id: C });
  await fns.syncDownNow(); await settle();
  const backup = backupNow();
  { const s = sb.tables.ft_trainings.get(W), r = s.data.rows[0]; delete r.clientNote; delete r.clientNoteBy; delete r.clientNoteAt; bump(s); } await fns.syncDownNow(); await settle();   // Jane deletes her note
  { const t = maps.trainings.get(W); t.rows = []; fns.scheduleSave("trainings", W, 0); } await settle();   // the coach deletes both exercises
  fns.deleteRec("trainings", W2); await settle(); await fns.syncDownNow(); await settle();   // and Upper by mistake: the restore he wants
  const plan = fns.planRestore(clone(backup));
  assert.strictEqual(plan.text, "2 workouts from the file go into the app. 1 of them replaces a copy already here, logged sets and all. Workouts back in the app: Jane Testperson (1 workout). Exercises back in the app: Jane Testperson (1 exercise). Everything else stays as it is.", "the squats (her sets, her note) named; the deadlifts (his plan and his note) not");
  app.reset(); localStorage.clear();
});

test("the coach's Under 18 switched off on one bar of signal stays off through a restore (the eighteenth check round: the restore's write met the client's changed copy and took the server's Under 18 back)", async () => {
  const SAM = "2a1b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d";
  const sb = makeSupabase(); coach(sb);
  sb.seed("ft_clients", SAM, { id: SAM, name: "Sam Lee", unit: "lb", zone: { zone: "America/Los_Angeles", at: "2026-11-23T08:00:00.000Z" } }); await fns.syncDownNow(); await settle();
  const backup = backupNow(); backup.clients[SAM].name = "Sam L.";          // from before he was ever marked
  { const c = maps.clients.get(SAM); c.minor = true; maps.profileTouched.set(SAM, new Set(["minor", "minorUntil"])); fns.scheduleSave("clients", SAM, 0); await settle(); }   // marked by mistake, sent
  assert.strictEqual(sb.tables.ft_clients.get(SAM).data.minor, true);
  sb.setFail({ op: "update", times: 100000, message: "Failed to fetch" });
  { const c = maps.clients.get(SAM); delete c.minor; delete c.minorUntil; maps.profileTouched.set(SAM, new Set(["minor", "minorUntil"])); fns.scheduleSave("clients", SAM, 0); await settle(); }   // switched off: it waits
  { const s = sb.tables.ft_clients.get(SAM); s.data.zone = { zone: "America/Denver", at: "2026-11-23T10:30:00.000Z" }; bump(s); }   // his phone's report meanwhile
  fns.applyRestore(fns.planRestore(clone(backup))); await settle(); await signal(sb);
  const s = sb.tables.ft_clients.get(SAM).data, h = maps.clients.get(SAM);
  assert.deepStrictEqual([s.name, s.minor, h.minor, s.zone.zone], ["Sam L.", undefined, undefined, "America/Denver"]);
  app.reset(); localStorage.clear();
});

test("a workout a restore already wrote is no change the next time (the eighteenth check round: the same file picked twice, or a client who went lb, kg, then lb, counted it as replaced again)", async () => {
  for (const how of ["the same file twice", "lb, kg, then lb"]) {
    const sb = makeSupabase(); coach(sb);
    sb.seed("ft_clients", C, { id: C, name: "Jane Testperson", unit: "lb" });
    sb.seed("ft_trainings", W, plainW({ unit: undefined, weights: ["185", "185", "185"], repsDone: ["", "", ""], setsDone: 0, done: false }), { client_id: C });   // the coach's planned 185, no unit of its own
    await fns.syncDownNow(); await settle();
    const backup = backupNow();
    if (how === "the same file twice") { fns.deleteRec("trainings", W); await settle(); await fns.syncDownNow(); await settle(); fns.applyRestore(fns.planRestore(clone(backup))); await settle(); await fns.syncDownNow(); await settle(); }
    else { serverSwitch(sb, C, "kg"); await fns.syncDownNow(); await settle(); serverSwitch(sb, C, "lb"); await fns.syncDownNow(); await settle(); }
    assert.strictEqual(maps.trainings.get(W).rows[0].unit, "lb", how + ": the row carries its unit now");
    const p = fns.planRestore(clone(backup));
    assert.deepStrictEqual([p.text, p.ts.length], ["", 0], how + ": nothing to restore");
    app.reset(); localStorage.clear();
  }
});

test("a backup from while a workout was still empty never empties it (the eighteenth check round: the empty copy replaced the finished workout, then the tidying took it away)", async () => {
  const sb = makeSupabase(); coach(sb);
  sb.seed("ft_clients", C, { id: C, name: "Jane Testperson", unit: "lb" });
  sb.seed("ft_trainings", W, { id: W, clientId: C, title: "", date: "2026-11-20", createdAt: "2026-11-16T10:00:00.000Z", completedAt: null, skippedAt: null, rows: [] }, { client_id: C });   // Monday: Friday tapped, still empty
  await fns.syncDownNow(); await settle();
  const backup = backupNow();
  { const s = sb.tables.ft_trainings.get(W); s.data.title = "Legs"; s.data.rows = [row({})]; s.data.completedAt = "2026-11-20T17:00:00.000Z"; bump(s); } await fns.syncDownNow(); await settle();   // filled, and Jane did it
  const p = fns.planRestore(clone(backup));
  assert.deepStrictEqual([p.text, p.ts.length, p.held], ["", 0, 0], "nothing to restore");
  app.reset(); localStorage.clear();
});

test("the rest of the question (the eighteenth check round): a Delete client still waiting for a client the backup does not hold never stops a restore; a backup the same as the app with an exercise finished early is \"already here\"; a template deleted since names no one; a client with no name is named so; the question starts with a capital letter", async () => {
  const X = "7c8d9e0f-1a2b-4c3d-8e4f-5a6b7c8d9e0f";
  { const sb = makeSupabase(); coach(sb); sb.seed("ft_clients", C, { id: C, name: "Jane Testperson", unit: "lb" }); sb.seed("ft_clients", X, { id: X, name: "Max Newcomer", unit: "lb" }); await fns.syncDownNow(); await settle();
    sb.setFail({ op: "delete", times: 100000, message: "Failed to fetch" }); fns.deleteRec("clients", X); await settle();
    assert.strictEqual(await fns.restoreReady(file([{ id: C, name: "Jane T.", unit: "lb" }], [])), true, "Max is not in the backup: his Delete waits on its own");
    sb.setFail(null); await settle(); app.reset(); localStorage.clear(); }
  coach(makeSupabase()); put("clients", { id: C, name: "Jane Testperson", unit: "lb" });
  const early = plainW({ weights: ["135", "135", ""], repsDone: ["8", "8", ""], setsDone: 2, done: true, earlyReason: "Discomfort" }); put("trainings", early);
  let p = fns.planRestore(file([], [clone(early)])); assert.deepStrictEqual([p.cs.length + p.ts.length, p.held], [0, 0], "already here, nothing kept out");
  coach(makeSupabase()); put("clients", { id: TEMPLATES_ID, name: "Templates", kind: "templates", unit: "lb" });
  p = fns.planRestore(file([], [{ id: TP, clientId: TEMPLATES_ID, title: "Upper A", date: "2026-01-01", createdAt: AT, completedAt: null, skippedAt: null, rows: [row({ weights: [], repsDone: [], setsDone: 0, done: false })] }]));
  assert.strictEqual(p.text, "1 template from the file goes into the app. Everything else stays as it is.");
  coach(makeSupabase()); put("clients", { id: C2, name: "  ", unit: "lb" });
  p = fns.planRestore(file([], [{ ...plainW(), clientId: C2 }]));
  assert.ok(p.text.includes("Workouts back in the app: a client with no name (1 workout)."), p.text);
  coach(makeSupabase()); put("clients", { id: TEMPLATES_ID, name: "Templates", kind: "templates", packages: [{ id: "p10", name: "10 sessions", kind: "sessions", size: 10 }] });
  p = fns.planRestore(file([{ id: TEMPLATES_ID, name: "Templates", kind: "templates", packages: [] }], []));
  assert.strictEqual(p.text, "The packages list from the file goes into the app. It replaces a copy already here. Everything else stays as it is.");
  app.reset(); localStorage.clear();
});

// ---------- the nineteenth check round ----------
const blankRow = (id, x) => row({ id, label: id, name: "Exercise " + id, weights: ["", "", ""], repsDone: ["", "", ""], setsDone: 0, done: false, ...x });
const daysAgo = (k) => { const d = new Date(fns.today() + "T12:00:00"); d.setDate(d.getDate() - k); return fns.localIso(d); };
test("a client deleted on the coach's other device while the Restore question is up stays deleted (the nineteenth check round: the restore wrote her workout after her deletion, shown nowhere and in no later backup, and, renamed since the backup, brought her back with the question naming no one); Omar's workout comes back", async () => {
  for (const renamed of [false, true]) {
    const sb = makeSupabase(); coach(sb);
    sb.seed("ft_clients", C, { id: C, name: "Jane Roe", unit: "lb" }); sb.seed("ft_clients", C2, { id: C2, name: "Omar Sample", unit: "lb" });
    sb.seed("ft_trainings", W, { id: W, clientId: C, title: "Legs", date: "2026-11-20", createdAt: AT, completedAt: "2026-11-20T17:00:00.000Z", skippedAt: null, rows: [row({ clientNote: "knee sore after my fall", clientNoteBy: "client", clientNoteAt: "2026-11-20T17:00:00.000Z" })] }, { client_id: C });
    sb.seed("ft_trainings", W2, { id: W2, clientId: C2, title: "Push", date: "2026-11-21", createdAt: AT, completedAt: null, skippedAt: null, rows: [blankRow("p1", { name: "Bench press" })] }, { client_id: C2 });
    await fns.syncDownNow(); await settle();
    const backup = clone(fns.backupData());
    if (renamed) { maps.clients.get(C).name = "Jane R."; fns.scheduleSave("clients", C, 0); await settle(); }
    fns.deleteRec("trainings", W); fns.deleteRec("trainings", W2); await settle(); await fns.syncDownNow(); await settle();   // deleted by mistake: what the restore is for
    const plan = fns.planRestore(clone(backup));
    assert.ok(plan.text.includes("Workouts back in the app: Jane " + (renamed ? "R." : "Roe") + " (1 workout) and Omar Sample (1 workout)."), plan.text);
    sb.tables.ft_clients.delete(C);                                   // the iPad: Delete client (she asked), her workouts with her
    await fns.syncDownNow(); await settle();                          // the Mac's own sync under the question
    fns.applyRestore(plan); await settle();
    assert.deepStrictEqual([sb.tables.ft_clients.has(C), sb.tables.ft_trainings.has(W), sb.tables.ft_trainings.has(W2), maps.clients.has(C), maps.trainings.has(W), !!app.get().failed], [false, false, true, false, false, false], (renamed ? "renamed since" : "as in the file") + ": Jane and her Legs stay deleted, Omar's Push comes back");
    app.reset(); localStorage.clear();
  }
});

test("a finish or a skip the client took back since the backup stays taken back, and a reason for skipping is as the app has it, removed or changed (the nineteenth check round: her Injury, taken back with Undo, came back with the restore, in History and Attendance, naming no one; the policy calls Sick and Injury health information)", async () => {
  const LEGS = W, UPPER = W2, at = daysAgo(10) + "T15:00:00.000Z", again = daysAgo(9) + "T09:00:00.000Z";
  const cases = [
    ["her Undo of the skip", { skippedAt: at, skipReason: "Injury" }, (t) => { t.skippedAt = null; delete t.skipReason; t.missed = false; }, true, { skippedAt: null, skipReason: undefined, completedAt: null }],
    ["Undo, then skipped again as Other", { skippedAt: at, skipReason: "Injury" }, (t) => { t.skippedAt = again; t.skipReason = "Other"; }, false, { skippedAt: at, skipReason: "Other" }],
    ["Undo, then skipped again with no reason", { skippedAt: at, skipReason: "Injury" }, (t) => { t.skippedAt = again; delete t.skipReason; }, false, { skippedAt: at, skipReason: undefined }],
    ["her Undo of the finish, made in Lisbon", { completedAt: at, completedBy: "client", completedZone: { zone: "Europe/Lisbon", at } }, (t) => { t.completedAt = null; delete t.completedBy; delete t.completedZone; t.missed = false; }, true, { completedAt: null, completedBy: undefined, completedZone: undefined, skippedAt: null }],
  ];
  for (const [what, was, undo, same, want] of cases) for (const alone of [false, true]) {
    const sb = makeSupabase(); coach(sb);
    sb.seed("ft_clients", C, { id: C, name: "Jane Testperson", unit: "lb" });
    sb.seed("ft_trainings", LEGS, { id: LEGS, clientId: C, title: "Legs", date: daysAgo(10), createdAt: AT, completedAt: null, skippedAt: null, ...was, rows: [blankRow("q1", {})] }, { client_id: C });
    sb.seed("ft_trainings", UPPER, { id: UPPER, clientId: C, title: "Upper", date: daysAgo(9), createdAt: AT, completedAt: daysAgo(9) + "T17:00:00.000Z", skippedAt: null, rows: [row({ id: "u1", name: "Bench press" })] }, { client_id: C });
    await fns.syncDownNow(); await settle();
    const backup = clone(fns.backupData());
    { const s = sb.tables.ft_trainings.get(LEGS); undo(s.data); bump(s); } await fns.syncDownNow(); await settle();   // on her phone (client_skip, client_finish), synced here
    if (!alone) { fns.deleteRec("trainings", UPPER); await settle(); await fns.syncDownNow(); await settle(); }   // deleted by mistake: what the restore is for
    const plan = fns.planRestore(clone(backup)), kept = plan.text.includes(KEPT);
    if (same) assert.deepStrictEqual([plan.ts.some((t) => t.id === LEGS), plan.held], [false, 1], what + (alone ? ", alone: Nothing to restore, the words say why" : ": Legs is no change"));
    else assert.deepStrictEqual([plan.ts.some((t) => t.id === LEGS), kept], [true, true], what + ": Legs goes back with the skip, the reason as here, and the words say so: " + plan.text);
    if (!alone) assert.ok(plan.text.includes("Workouts back in the app: Jane Testperson (1 workout)."), plan.text);
    fns.applyRestore(plan); await settle();
    const s = sb.tables.ft_trainings.get(LEGS).data, h = maps.trainings.get(LEGS);
    for (const [f, v] of Object.entries(want)) assert.deepStrictEqual([s[f], h[f]], [v, v], what + (alone ? " (alone)" : "") + ": " + f + " on the server and here");
    assert.ok(!("Injury" in attendance([...maps.trainings.values()].filter((t) => t.clientId === C), fns.today()).reasons), what + ": no Injury in Attendance");
    app.reset(); localStorage.clear();
  }
});

test("the restore's own write holds the finish and skip rule against the server's copy too (the nineteenth check round): her Undo of a skip that reaches the server while the restore waits for a signal stays; the coach's own skip made after the tap stands", async () => {
  for (const coachAfter of [false, true]) {
    const sb = makeSupabase(); coach(sb);
    sb.seed("ft_clients", C, { id: C, name: "Jane Testperson", unit: "lb" });
    sb.seed("ft_trainings", W, { id: W, clientId: C, title: "Legs", date: daysAgo(10), createdAt: AT, completedAt: null, skippedAt: daysAgo(10) + "T15:00:00.000Z", skipReason: "Sick", rows: [blankRow("q1", {})] }, { client_id: C });
    await fns.syncDownNow(); await settle();
    const backup = clone(fns.backupData());
    maps.trainings.get(W).title = "Legs B"; fns.scheduleSave("trainings", W, 0); await settle(); await fns.syncDownNow(); await settle();   // the coach's rename since: Legs goes back
    const plan = fns.planRestore(clone(backup)); assert.deepStrictEqual(plan.ts.map((t) => t.id), [W]);
    sb.setFail({ op: "update", times: 100000, message: "Failed to fetch" });
    fns.applyRestore(plan); await settle();                           // the write waits: one bar of signal
    { const s = sb.tables.ft_trainings.get(W); s.data.skippedAt = null; delete s.data.skipReason; s.data.missed = false; bump(s); }   // her Undo lands meanwhile
    if (coachAfter) { const t = maps.trainings.get(W); t.skipReason = "Travelling"; fns.touchState(W, "skippedAt", "missed", "skipReason"); fns.scheduleSave("trainings", W, 0); await settle(); }   // the coach changes the reason after the tap
    await signal(sb);
    const s = sb.tables.ft_trainings.get(W).data;
    if (coachAfter) assert.deepStrictEqual([s.title, !!s.skippedAt, s.skipReason], ["Legs", true, "Travelling"], "his skip after the tap stands");
    else assert.deepStrictEqual([s.title, s.skippedAt, s.skipReason], ["Legs", null, undefined], "the file's title, her Undo kept");
    app.reset(); localStorage.clear();
  }
});

test("the coach's Under 18 is as the app has it, both ways (the nineteenth check round: switched off since the backup, or its year cleared, an adult marked by mistake came back under 18, details locked and a parent asked); switched on since, it stays on", async () => {
  const Y = +fns.today().slice(0, 4);
  for (const how of ["switched off", "year cleared", "switched on since"]) {
    const sb = makeSupabase(); coach(sb);
    sb.seed("ft_clients", C3, { id: C3, name: "Sam Lee", unit: "lb", birthday: "1990-06-02", choices: { health: { state: "agreed", at: "2026-11-01T08:00:00.000Z", by: "client" } }, health: { allergies: "Peanuts" } });
    sb.seed("ft_trainings", W, { id: W, clientId: C3, title: "Legs", date: "2026-11-20", createdAt: AT, completedAt: "2026-11-20T17:00:00.000Z", skippedAt: null, rows: [row({})] }, { client_id: C3 });
    await fns.syncDownNow(); await settle();
    const mark = (on) => { const c = maps.clients.get(C3); if (on) { if (how === "year cleared") c.minorUntil = Y; else c.minor = true; } else { delete c.minor; delete c.minorUntil; } maps.profileTouched.set(C3, new Set(["minor", "minorUntil"])); fns.scheduleSave("clients", C3, 0); };
    if (how !== "switched on since") { mark(true); await settle(); }   // marked by mistake, and backed up so
    const backup = clone(fns.backupData());
    mark(how === "switched on since"); await settle();
    fns.deleteRec("trainings", W); await settle(); await fns.syncDownNow(); await settle();   // a workout deleted by mistake: what the restore is for
    const plan = fns.planRestore(clone(backup));
    assert.deepStrictEqual([plan.text, plan.held], ["1 workout from the file goes into the app. Workouts back in the app: Sam Lee (1 workout). Everything else stays as it is.", how === "switched on since" ? 0 : 1], how + ": the question, and his record told as kept (Nothing to restore, were it alone)");
    fns.applyRestore(plan); await settle();
    const s = sb.tables.ft_clients.get(C3).data, h = maps.clients.get(C3), on = how === "switched on since", days = [fns.today()];
    assert.deepStrictEqual([isMinor(s, days), isMinor(h, days), needsParent(h, days), healthEditable(h, days)], [on, on, on, !on], how);
    app.reset(); localStorage.clear();
  }
});

test("Back up writes a template open as a draft as it was saved (the nineteenth check round: a second tab's Back up wrote the half-typed draft, its empty exercise and all, which a restore then made the saved template)", () => {
  coach(makeSupabase()); maps.clients.set(TEMPLATES_ID, { id: TEMPLATES_ID, name: "Templates", kind: "templates" });
  const saved = { id: TP, clientId: TEMPLATES_ID, title: "Upper A", date: null, createdAt: AT, completedAt: null, skippedAt: null, rows: [row({ name: "Bench press", weights: ["95", "95", "95"], repsDone: ["", "", ""], setsDone: 0, done: false })] };
  maps.trainings.set(TP, { ...clone(saved), title: "Upper A (half-edited)", rows: [{ ...saved.rows[0], name: "Incline press" }, blankRow("r2", { name: "" })] });
  let b;
  try { app.set({ templateDraft: { id: TP, dirty: true, snapshot: JSON.stringify(saved) } }); b = fns.backupData().trainings[TP]; } finally { app.set({ templateDraft: null }); app.reset(); localStorage.clear(); }
  assert.deepStrictEqual([b.title, b.rows.map((r) => r.name)], ["Upper A", ["Bench press"]]);
});

test("a backup from before the built-in programs became folders (its Templates record has no builtinsAdopted) is no change when the rest is the same (the nineteenth check round: it said the packages list went in, nothing changing)", async () => {
  const sb = makeSupabase(); coach(sb);
  sb.seed("ft_clients", TEMPLATES_ID, { id: TEMPLATES_ID, name: "Templates", kind: "templates", packages: [{ id: "k1", name: "10 sessions", kind: "sessions", size: 10 }], templatesVersion: 3, builtinsAdopted: 1 });
  await fns.syncDownNow(); await settle();
  const backup = clone(fns.backupData()); delete backup.clients[TEMPLATES_ID].builtinsAdopted;
  const plan = fns.planRestore(backup);
  assert.deepStrictEqual([plan.cs.length, plan.ts.length, plan.text, plan.held], [0, 0, "", 0]);
  app.reset(); localStorage.clear();
});

test("each kind of thing a client leaves on an exercise names her when the exercise comes back: her note alone, sets ticked with the planned reps, reps typed, a reason with no set; counted per exercise, two clients joined, one with no name (the nineteenth check round: no test told these apart)", async () => {
  const sb = makeSupabase(); coach(sb);
  sb.seed("ft_clients", C, { id: C, name: "Jane Testperson", unit: "lb" }); sb.seed("ft_clients", C2, { id: C2, name: "  ", unit: "lb" });
  sb.seed("ft_trainings", W, { id: W, clientId: C, title: "Legs", date: "2026-11-20", createdAt: AT, completedAt: null, skippedAt: null, rows: [
    blankRow("n1", { clientNote: "my shoulder hurts on these", clientNoteBy: "client", clientNoteAt: AT }),   // her note, nothing done
    blankRow("d1", { setsDone: 2 }),                                                                             // two sets ticked, the planned reps kept (no reps typed)
    blankRow("p1", { repsDone: ["8", "", ""] }),                                                                  // reps typed, not ticked
    blankRow("e1", { done: true, earlyReason: "Discomfort" }),                                                    // ended before a set, for a reason
    blankRow("c1", { weights: ["95", "95", "95"], clientNote: "slow down", clientNoteBy: "coach", clientNoteAt: AT }),   // his plan and his note only
    blankRow("k1", {})] }, { client_id: C });
  sb.seed("ft_trainings", W2, { id: W2, clientId: C2, title: "Upper", date: "2026-11-21", createdAt: AT, completedAt: null, skippedAt: null, rows: [blankRow("u1", { setsDone: 1 }), blankRow("u2", {})] }, { client_id: C2 });
  await fns.syncDownNow(); await settle();
  const backup = backupNow();
  { const t = maps.trainings.get(W); t.rows = t.rows.filter((r) => r.id === "k1"); fns.scheduleSave("trainings", W, 0); }   // the coach deletes five exercises
  { const t = maps.trainings.get(W2); t.rows = t.rows.filter((r) => r.id === "u2"); fns.scheduleSave("trainings", W2, 0); }
  await settle(); await fns.syncDownNow(); await settle();
  const plan = fns.planRestore(clone(backup));
  assert.strictEqual(plan.text, "2 workouts from the file go into the app. They replace a copy already here, logged sets and all. Exercises back in the app: Jane Testperson (4 exercises) and a client with no name (1 exercise). Everything else stays as it is.");
  app.reset(); localStorage.clear();
});

test("the coach's Under 18 switched off also clears the year a teen's Don't Allow kept; switched off on one bar of signal while the phone reports its zone, the year stays cleared through a restore (the nineteenth check round: no test held the year)", async () => {
  const SAM = "2a1b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d", Y = new Date().getFullYear();
  const sb = makeSupabase(); coach(sb);
  sb.seed("ft_clients", SAM, { id: SAM, name: "Sam Lee", unit: "lb", zone: { zone: "America/Los_Angeles", at: "2026-11-23T08:00:00.000Z" } }); await fns.syncDownNow(); await settle();
  const backup = backupNow(); backup.clients[SAM].name = "Sam L.";          // from before the year was kept
  { const s = sb.tables.ft_clients.get(SAM); s.data.minorUntil = Y + 1; bump(s); } await fns.syncDownNow(); await settle();   // his Don't Allow while under 18 kept the year
  assert.strictEqual(isMinor(maps.clients.get(SAM), [fns.today()]), true);
  sb.setFail({ op: "update", times: 100000, message: "Failed to fetch" });
  { const c = maps.clients.get(SAM); delete c.minor; delete c.minorUntil; maps.profileTouched.set(SAM, new Set(["minor", "minorUntil"])); fns.scheduleSave("clients", SAM, 0); await settle(); }   // the coach's switch off (he turned 18): it waits
  { const s = sb.tables.ft_clients.get(SAM); s.data.zone = { zone: "America/Denver", at: "2026-11-23T10:30:00.000Z" }; bump(s); }   // his phone's report meanwhile
  fns.applyRestore(fns.planRestore(clone(backup))); await settle(); await signal(sb);
  const s = sb.tables.ft_clients.get(SAM).data, h = maps.clients.get(SAM);
  assert.deepStrictEqual([s.name, s.minorUntil, h.minorUntil, s.zone.zone], ["Sam L.", undefined, undefined, "America/Denver"]);
  app.reset(); localStorage.clear();
});

test("the smaller parts of the eighteenth round's restore (the nineteenth check round: each could be undone with every test passing): a file's workout whose client is neither in it nor here, and not on this device, plans nothing; the Back up button writes backupData(); planning reads each side's unit on a copy, changing nothing here; the privacy policy's Backups sentence names exercises, in the text and the page built from it", async () => {
  const fs = await import("node:fs"), read = (f) => fs.readFileSync(new URL("../" + f, import.meta.url), "utf8");
  const SAM = "2a1b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d", ORPHAN = "6e5f7a8b-9c0d-4e1f-8a2b-3c4d5e6f7a8b";
  coach(makeSupabase()); put("clients", { id: C, name: "Jane Testperson", unit: "lb" });
  const orphan = { id: ORPHAN, clientId: SAM, title: "Pull B", date: "2026-11-27", createdAt: AT, completedAt: null, skippedAt: null, rows: [row({ id: "n1", name: "Pull-up", weights: [], repsDone: [], setsDone: 0, done: false })] };
  const p = fns.planRestore(file([{ id: C, name: "Jane Testperson", unit: "lb" }], [orphan]));
  assert.deepStrictEqual([p.ts.length, p.text], [0, ""], "not in the app: left out");
  app.reset(); localStorage.clear();
  const src = read("app/main.js"), h = src.indexOf('$("backup").addEventListener("click"'), body = src.slice(h, src.indexOf("});", h));
  assert.ok(h > 0 && /const data = backupData\(\);/.test(body), "the button writes backupData()");
  coach(makeSupabase()); put("clients", { id: C, name: "Jane Testperson", unit: "kg" });
  const here = { id: W, clientId: C, title: "Legs", date: "2026-11-10", createdAt: AT, completedAt: null, skippedAt: null, rows: [row({ unit: undefined, weights: ["60", "60", "60"] })] };
  put("trainings", here); const before = JSON.stringify(maps.trainings.get(W));
  fns.planRestore(file([{ id: C, name: "Jane Testperson", unit: "lb" }], [{ ...clone(here), title: "Legs (backup)" }]));
  const after = JSON.stringify(maps.trainings.get(W)); app.reset(); localStorage.clear();
  assert.strictEqual(after, before, "a row with a weight and no unit of its own keeps none");
  for (const f of ["policies/privacy.md", "privacy.html"]) assert.ok(read(f).includes("unless it was in a workout, an exercise or an account that had been deleted too and comes back from the copy"), f);
});

// ---------- the twentieth check round ----------
test("a finish or a skip taken back stays taken back on every path (the twentieth check round: undoing either half of the rule passed every test): her Undo of a finish made two days late (its day moves to the finish's), her Undo then a skip, her Undo of a skip then a finish, a skip with no reason taken back, alone or then finished", async () => {
  const at = daysAgo(10) + "T15:00:00.000Z", late = daysAgo(8) + "T15:00:00.000Z", again = daysAgo(9) + "T09:00:00.000Z";
  const cases = [
    ["her Undo of a finish made two days late", { completedAt: late, completedBy: "client" }, (t) => { t.date = effDate(t); t.completedAt = null; delete t.completedBy; t.missed = false; }],
    ["her Undo of the finish, then skipped as Sick", { completedAt: at, completedBy: "client" }, (t) => { t.completedAt = null; delete t.completedBy; t.skippedAt = again; t.skipReason = "Sick"; t.missed = false; }],
    ["her Undo of the skip, then finished", { skippedAt: at, skipReason: "Injury" }, (t) => { t.skippedAt = null; delete t.skipReason; t.missed = false; t.completedAt = again; t.completedBy = "client"; }],
    ["her Undo of a skip with no reason", { skippedAt: at }, (t) => { t.skippedAt = null; t.missed = false; }],
    ["her Undo of a skip with no reason, then finished", { skippedAt: at }, (t) => { t.skippedAt = null; t.missed = false; t.completedAt = again; t.completedBy = "client"; }],
  ];
  const got = {};
  for (const [what, was, undo] of cases) {
    const sb = makeSupabase(); coach(sb);
    sb.seed("ft_clients", C, { id: C, name: "Jane Testperson", unit: "lb" });
    sb.seed("ft_trainings", W, { id: W, clientId: C, title: "Legs", date: daysAgo(10), createdAt: AT, completedAt: null, skippedAt: null, ...was, rows: [blankRow("q1", {})] }, { client_id: C });
    await fns.syncDownNow(); await settle();
    const backup = clone(fns.backupData());
    { const s = sb.tables.ft_trainings.get(W); undo(s.data); bump(s); } await fns.syncDownNow(); await settle();   // on her phone, synced here
    const here = clone(maps.trainings.get(W)), plan = fns.planRestore(clone(backup));
    fns.applyRestore(plan); await settle();
    const s = sb.tables.ft_trainings.get(W).data;
    got[what] = [plan.ts.length, plan.held, ...["date", "completedAt", "skippedAt", "skipReason"].map((f) => JSON.stringify(s[f]) === JSON.stringify(here[f]))];
    app.reset(); localStorage.clear();
  }
  assert.deepStrictEqual(got, Object.fromEntries(cases.map((c) => [c[0], [0, 1, true, true, true, true]])), "each is no change, told as Nothing to restore, and the server keeps the day, the finish, the skip and the reason the app has");
});

test("a skip with no reason in the backup, skipped again here as Injury: the reason given since goes with the copy replaced, as CLAUDE.md says (the twentieth check round)", async () => {
  const sb = makeSupabase(), at = daysAgo(10) + "T15:00:00.000Z"; coach(sb);
  sb.seed("ft_clients", C, { id: C, name: "Jane Testperson", unit: "lb" });
  sb.seed("ft_trainings", W, { id: W, clientId: C, title: "Legs", date: daysAgo(10), createdAt: AT, completedAt: null, skippedAt: at, rows: [blankRow("q1", {})] }, { client_id: C });
  await fns.syncDownNow(); await settle();
  const backup = clone(fns.backupData());
  { const s = sb.tables.ft_trainings.get(W); s.data.skippedAt = daysAgo(9) + "T09:00:00.000Z"; s.data.skipReason = "Injury"; bump(s); } await fns.syncDownNow(); await settle();
  const plan = fns.planRestore(clone(backup));
  fns.applyRestore(plan); await settle();
  const s = sb.tables.ft_trainings.get(W).data; app.reset(); localStorage.clear();
  assert.deepStrictEqual([plan.ts.length, s.skippedAt, s.skipReason], [1, at, undefined]);
});

test("the coach changes the reason for a skip after the tap while the restore waits for a signal, and her own skip again (as Other) reaches the server meanwhile: his reason stands (the twentieth check round: the reason's own mark was never tested)", async () => {
  const sb = makeSupabase(); coach(sb);
  sb.seed("ft_clients", C, { id: C, name: "Jane Testperson", unit: "lb" });
  sb.seed("ft_trainings", W, { id: W, clientId: C, title: "Legs", date: daysAgo(10), createdAt: AT, completedAt: null, skippedAt: daysAgo(10) + "T15:00:00.000Z", skipReason: "Sick", rows: [blankRow("q1", {})] }, { client_id: C });
  await fns.syncDownNow(); await settle();
  const backup = clone(fns.backupData());
  maps.trainings.get(W).title = "Legs B"; fns.scheduleSave("trainings", W, 0); await settle(); await fns.syncDownNow(); await settle();   // the coach's rename since: Legs goes back
  const plan = fns.planRestore(clone(backup)); assert.deepStrictEqual(plan.ts.map((t) => t.id), [W]);
  sb.setFail({ op: "update", times: 100000, message: "Failed to fetch" });
  fns.applyRestore(plan); await settle();
  { const s = sb.tables.ft_trainings.get(W); s.data.skippedAt = daysAgo(9) + "T09:00:00.000Z"; s.data.skipReason = "Other"; bump(s); }   // her Undo and skip again, as Other, lands meanwhile
  { const t = maps.trainings.get(W); t.skipReason = "Travelling"; fns.touchState(W, "skippedAt", "missed", "skipReason"); fns.scheduleSave("trainings", W, 0); await settle(); }   // the coach's reason, after the tap
  await signal(sb);
  const s = sb.tables.ft_trainings.get(W).data; app.reset(); localStorage.clear();
  assert.deepStrictEqual([s.title, !!s.skippedAt, s.skipReason], ["Legs", true, "Travelling"]);
});

test("Back up with a template open as a draft changes only that template, and only while it holds unsaved changes (the twentieth check round: the draft written for every record, or an untouched draft written, passed every test)", () => {
  coach(makeSupabase()); maps.clients.set(TEMPLATES_ID, { id: TEMPLATES_ID, name: "Templates", kind: "templates" }); maps.clients.set(C, { id: C, name: "Jane Testperson", unit: "lb" });
  const saved = { id: TP, clientId: TEMPLATES_ID, title: "Upper A", date: "2026-01-01", createdAt: AT, completedAt: null, skippedAt: null, rows: [row({ name: "Bench press", weights: ["95", "95", "95"], repsDone: ["", "", ""], setsDone: 0, done: false })] };
  const legs = { id: W, clientId: C, title: "Legs", date: "2026-11-20", createdAt: AT, completedAt: "2026-11-20T17:00:00.000Z", skippedAt: null, rows: [row({})] };
  maps.trainings.set(TP, { ...clone(saved), title: "Upper A (half-edited)" }); maps.trainings.set(W, clone(legs));
  let b, c;
  try {
    app.set({ templateDraft: { id: TP, dirty: true, snapshot: JSON.stringify(saved) } }); b = fns.backupData().trainings;
    maps.trainings.set(TP, { ...clone(saved), title: "Upper A (iPad)" }); app.set({ templateDraft: { id: TP, dirty: false, snapshot: JSON.stringify(saved) } }); c = fns.backupData().trainings;   // opened, nothing typed; the iPad's rename synced in
  } finally { app.set({ templateDraft: null }); app.reset(); localStorage.clear(); }
  assert.deepStrictEqual([b[TP].title, b[W], c[TP].title], ["Upper A", legs, "Upper A (iPad)"]);
});

test("a template replaced and a client's workout brought back: the question never says logged sets of the copy replaced, the template (the twentieth check round)", async () => {
  const sb = makeSupabase(); coach(sb);
  sb.seed("ft_clients", TEMPLATES_ID, { id: TEMPLATES_ID, name: "Templates", kind: "templates", builtinsAdopted: 1, templatesVersion: 3 });
  sb.seed("ft_clients", C, { id: C, name: "Jane Testperson", unit: "lb" });
  sb.seed("ft_trainings", TP, { id: TP, clientId: TEMPLATES_ID, title: "Upper A", date: "2026-01-01", createdAt: AT, completedAt: null, skippedAt: null, rows: [blankRow("t1", { weights: ["95", "95", "95"] })] }, { client_id: TEMPLATES_ID });
  sb.seed("ft_trainings", W, { id: W, clientId: C, title: "Legs", date: "2026-11-20", createdAt: AT, completedAt: "2026-11-20T17:00:00.000Z", skippedAt: null, rows: [row({})] }, { client_id: C });
  await fns.syncDownNow(); await settle();
  const backup = clone(fns.backupData());
  maps.trainings.get(TP).title = "Upper A2"; fns.scheduleSave("trainings", TP, 0); fns.deleteRec("trainings", W); await settle(); await fns.syncDownNow(); await settle();
  const text = fns.planRestore(clone(backup)).text; app.reset(); localStorage.clear();
  assert.strictEqual(text, "1 workout and 1 template from the file go into the app. 1 of them replaces a copy already here. Workouts back in the app: Jane Testperson (1 workout). Everything else stays as it is.");
});

test("a finish or a skip the coach makes after the tap is his own, never one taken back (the twentieth check round: his In person finish, made while the restore's write waited and Jane's skip landed, took her skip from the server: finished and skipped at once, the session missing from her pack; his skip took the day of the drag the restore was undoing)", async () => {
  const out = {}, PACK = { kind: "sessions", size: 10, startedOn: "2026-10-01", name: "10 sessions" }, yday = daysAgo(1);   // (counted once: a run across midnight seeded one day and expected the next, the twenty-first check round)
  for (const reason of ["Sick", "Injury"]) {
    const sb = makeSupabase(); coach(sb);
    sb.seed("ft_clients", C, { id: C, name: "Jane Testperson", unit: "lb", plan: PACK });
    sb.seed("ft_trainings", W, { id: W, clientId: C, title: "Legs", date: yday, createdAt: AT, completedAt: null, skippedAt: null, rows: [blankRow("q1", {})] }, { client_id: C });
    sb.seed("ft_trainings", W2, { id: W2, clientId: C, title: "Push", date: daysAgo(3), createdAt: AT, completedAt: daysAgo(3) + "T17:00:00.000Z", inPerson: true, skippedAt: null, rows: [row({ id: "p1", name: "Bench press" })] }, { client_id: C });
    await fns.syncDownNow(); await settle();
    const backup = clone(fns.backupData());
    maps.trainings.get(W).title = "Legs B"; fns.scheduleSave("trainings", W, 0); await settle(); await fns.syncDownNow(); await settle();   // renamed since the backup: Legs goes back
    fns.deleteRec("trainings", W2); await settle(); await fns.syncDownNow(); await settle();   // Push deleted by mistake: what the restore is for
    sb.setFail({ op: "update", times: 100000, message: "Failed to fetch" });   // one bar of signal: reads work, writes wait
    fns.applyRestore(fns.planRestore(clone(backup))); await settle();
    { const s = sb.tables.ft_trainings.get(W); s.data.skippedAt = yday + "T15:00:00.000Z"; s.data.skipReason = reason; s.data.missed = false; bump(s); }   // her skip on her phone, while the Mac's write waits
    app.set({ view: { name: "training", id: W } }); { const t = maps.trainings.get(W); t.inPerson = true; fns.touchState(W, "inPerson"); fns.scheduleSave("trainings", W, 0); } fns.setFinished(true); await settle();   // the coach: In person, then Finish (the session he gave her)
    await signal(sb); await fns.syncDownNow(); await settle();
    const s = sb.tables.ft_trainings.get(W).data, list = [...maps.trainings.values()].filter((t) => t.clientId === C);
    out[reason] = [s.title, !!s.completedAt, !!s.skippedAt, s.skipReason || null, !!s.inPerson, inPersonCount(list, fns.today()).n];
    app.reset(); localStorage.clear();
  }
  {
    const sb = makeSupabase(); coach(sb);
    sb.seed("ft_clients", C, { id: C, name: "Jane Testperson", unit: "lb" });
    sb.seed("ft_trainings", W, { id: W, clientId: C, title: "Legs", date: yday, createdAt: AT, completedAt: null, skippedAt: null, rows: [blankRow("q1", {})] }, { client_id: C });
    await fns.syncDownNow(); await settle();
    const backup = clone(fns.backupData());
    { const t = maps.trainings.get(W); t.date = daysAgo(-5); fns.touchState(W, "date"); fns.scheduleSave("trainings", W, 0); } await settle(); await fns.syncDownNow(); await settle();   // dragged to another day by mistake: the restore puts it back
    sb.setFail({ op: "update", times: 100000, message: "Failed to fetch" });
    fns.applyRestore(fns.planRestore(clone(backup))); await settle();
    { const s = sb.tables.ft_trainings.get(W); s.data.rows[0].clientNote = "can we move this one?"; s.data.rows[0].clientNoteBy = "client"; s.data.rows[0].clientNoteAt = "2026-11-24T09:00:00.000Z"; bump(s); }   // her note on her phone meanwhile
    fns.setSkipped(true, "Travelling", W); await settle();   // he skips it after the tap
    await signal(sb);
    const s = sb.tables.ft_trainings.get(W).data; out.travelling = [s.date, !!s.skippedAt, s.skipReason, s.rows[0].clientNote];
    app.reset(); localStorage.clear();
  }
  assert.deepStrictEqual(out, { Sick: ["Legs", true, false, null, true, 2], Injury: ["Legs", true, false, null, true, 2], travelling: [yday, true, "Travelling", "can we move this one?"] });
});

test("a workout or an exercise the coach deletes on his other device while the Restore question is up stays deleted (the twentieth check round: it came back with the note the client had deleted, the question naming nothing); the exercises after one close up as Delete exercise's; a workout empty here as the question came up is still written (the tidying may have taken it)", async () => {
  const NOTE = "my knee hurts on these", out = {};
  const seedAll = async (sb) => {
    sb.seed("ft_clients", C, { id: C, name: "Jane Testperson", unit: "lb" });
    sb.seed("ft_trainings", W, { id: W, clientId: C, title: "Legs", date: daysAgo(4), createdAt: AT, completedAt: daysAgo(4) + "T17:00:00.000Z", skippedAt: null, rows: [row({ id: "e1", label: "1", clientNote: NOTE, clientNoteBy: "client", clientNoteAt: AT }), row({ id: "e2", label: "2a", name: "Leg press" }), row({ id: "e3", label: "2b", name: "Leg curl" }), row({ id: "e4", label: "3", name: "Calf raise" })] }, { client_id: C });
    sb.seed("ft_trainings", W2, { id: W2, clientId: C, title: "Push", date: daysAgo(3), createdAt: AT, completedAt: null, skippedAt: null, rows: [blankRow("p1", { name: "Bench press" })] }, { client_id: C });
    await fns.syncDownNow(); await settle();
  };
  for (const what of ["workout", "exercise", "two exercises"]) {
    const sb = makeSupabase(); coach(sb); await seedAll(sb);
    const backup = clone(fns.backupData());
    { const s = sb.tables.ft_trainings.get(W), r = s.data.rows[0]; delete r.clientNote; delete r.clientNoteBy; delete r.clientNoteAt; bump(s); } await fns.syncDownNow(); await settle();   // Jane deletes her note on her phone
    maps.trainings.get(W).title = "Legs B"; fns.scheduleSave("trainings", W, 0); await settle();   // the coach renames Legs: it goes back
    fns.deleteRec("trainings", W2); await settle(); await fns.syncDownNow(); await settle();   // and deletes Push by mistake: what the restore is for
    const plan = fns.planRestore(clone(backup));                                                  // the question comes up
    if (what === "workout") sb.tables.ft_trainings.delete(W);                                     // the iPad: Delete workout, while the question is up
    else { const s = sb.tables.ft_trainings.get(W), gone = what === "exercise" ? ["e1"] : ["e1", "e3"], labels = what === "exercise" ? { e2: "1a", e3: "1b", e4: "2" } : { e2: "1", e4: "2" }; s.data.rows = s.data.rows.filter((r) => !gone.includes(r.id)); for (const r of s.data.rows) r.label = labels[r.id]; bump(s); }   // the iPad: Delete exercise (the numbers close up there)
    await fns.syncDownNow(); await settle();                                                      // the sync after the tap
    fns.applyRestore(plan); await settle();
    const s = sb.tables.ft_trainings.get(W);
    out[what] = [plan.text.includes("1 of them replaces a copy already here"), s ? s.data.title : null, s ? s.data.rows.map((r) => r.id + " " + r.label + (r.clientNote ? " " + r.clientNote : "")) : null, sb.tables.ft_trainings.has(W2)];
    app.reset(); localStorage.clear();
  }
  {
    const sb = makeSupabase(); coach(sb); await seedAll(sb);
    const backup = clone(fns.backupData());
    { const t = maps.trainings.get(W); t.rows = []; fns.scheduleSave("trainings", W, 0); } await settle(); await fns.syncDownNow(); await settle();   // every exercise deleted here since the backup
    const plan = fns.planRestore(clone(backup));
    sb.tables.ft_trainings.delete(W); await fns.syncDownNow(); await settle();                 // the empty workout tidied away meanwhile
    fns.applyRestore(plan); await settle();
    const s = sb.tables.ft_trainings.get(W); out.empty = s ? s.data.rows.map((r) => r.id) : null;
    app.reset(); localStorage.clear();
  }
  assert.deepStrictEqual(out, {
    workout: [true, null, null, true],
    exercise: [true, "Legs", ["e2 1a", "e3 1b", "e4 2"], true],
    "two exercises": [true, "Legs", ["e2 1", "e4 2"], true],
    empty: ["e1", "e2", "e3", "e4"],
  });
});

test("Back up with a template's unsaved draft writes the template as the server has it saved (the twentieth check round: a move and an exercise the iPad saved while the draft was open were missing from the backup); a save here since counts over that older copy", async () => {
  const out = {};
  for (const how of ["taken at this tab's launch", "begun on this page", "saved here since"]) {
    const sb = makeSupabase(); coach(sb);
    sb.seed("ft_clients", TEMPLATES_ID, { id: TEMPLATES_ID, name: "Templates", kind: "templates", folders: [{ id: "f1", name: "Strength", parent: null, kind: "folder", at: AT }, { id: "f2", name: "Rehab", parent: null, kind: "folder", at: AT }], builtinsAdopted: 1 });
    sb.seed("ft_trainings", TP, { id: TP, clientId: TEMPLATES_ID, title: "Upper A", date: "2026-01-01", createdAt: AT, completedAt: null, skippedAt: null, template: { program: "My templates", phase: 0, stage: 0, n: 1, folder: "f1" }, rows: [blankRow("t1", { label: "1", name: "Bench press" })] });
    await fns.syncDownNow(); await settle();
    const saved = clone(maps.trainings.get(TP)), draft = { ...clone(saved), title: "Upper A (half-typed)", rows: [...clone(saved.rows), blankRow("t9", { label: "2", name: "" })] };
    if (how === "taken at this tab's launch") { app.set({ templateDraft: { id: TP, snapshot: JSON.stringify(saved), dirty: true, saving: false } }); maps.trainings.set(TP, draft); }   // as boot takes fiala.trainings.draft
    else { app.set({ view: { name: "training", id: TP }, templateDraft: { id: TP, snapshot: JSON.stringify(saved), dirty: false, saving: false } }); maps.trainings.set(TP, draft); fns.scheduleSave("trainings", TP, 0); app.set({ view: { name: "clients" } }); }
    { const s = sb.tables.ft_trainings.get(TP); s.data.template.folder = "f2"; s.data.rows.push(blankRow("t2", { label: "2", name: "Pull-up" })); bump(s); }   // the iPad: Move to Rehab, Add exercise Pull-up, saved there
    await fns.syncDownNow(); await settle();
    if (how === "saved here since") { fns.saveDraft(); await settle(); maps.trainings.get(TP).title = "Upper A (typed again)"; fns.scheduleSave("trainings", TP); out.server = [sb.tables.ft_trainings.get(TP).data.title, sb.tables.ft_trainings.get(TP).data.template.folder, sb.tables.ft_trainings.get(TP).data.rows.map((r) => r.name)]; }   // Save template (its write meets the iPad's and merges: its folder taken, the rows changed here kept), then typed again, no sync yet (the twenty-first check round: a snapshot set by hand never met the merge)
    const b = fns.backupData().trainings[TP];
    out[how] = [app.get().templateDraft.dirty, b.title, b.template.folder, b.rows.map((r) => r.name)];
    app.set({ templateDraft: null }); app.reset(); localStorage.clear();
  }
  assert.deepStrictEqual(out, {
    "taken at this tab's launch": [true, "Upper A", "f2", ["Bench press", "Pull-up"]],
    "begun on this page": [true, "Upper A", "f2", ["Bench press", "Pull-up"]],
    "saved here since": [true, "Upper A (half-typed)", "f2", ["Bench press", ""]],
    server: ["Upper A (half-typed)", "f2", ["Bench press", ""]],
  });
});

test("the coach moves a finished workout after the tap (Move to: the day he gave the session) while the restore's write waits and Jane's Undo of her finish lands: her Undo stands and so does his day (the twentieth check round: with his own finish and skip no longer counted as taken back, no test held the marks of his other changes inside the rule)", async () => {
  const sb = makeSupabase(), d3 = daysAgo(3), d2 = daysAgo(2); coach(sb);   // (each day counted once: a run across midnight on New Year's Eve seeded one day and expected the next, the twenty-first check round)
  sb.seed("ft_clients", C, { id: C, name: "Jane Testperson", unit: "lb" });
  sb.seed("ft_trainings", W, { id: W, clientId: C, title: "Legs", date: d3, createdAt: AT, completedAt: d3 + "T17:00:00.000Z", completedBy: "client", skippedAt: null, rows: [blankRow("q1", {})] }, { client_id: C });
  await fns.syncDownNow(); await settle();
  const backup = clone(fns.backupData());
  maps.trainings.get(W).title = "Legs B"; fns.scheduleSave("trainings", W, 0); await settle(); await fns.syncDownNow(); await settle();   // renamed since the backup: Legs goes back
  sb.setFail({ op: "update", times: 100000, message: "Failed to fetch" });   // one bar of signal: reads work, writes wait
  fns.applyRestore(fns.planRestore(clone(backup))); await settle();
  { const s = sb.tables.ft_trainings.get(W); s.data.completedAt = null; delete s.data.completedBy; s.data.missed = false; bump(s); }   // her Undo on her phone, while the Mac's write waits
  { const t = maps.trainings.get(W); fns.touchState(W, "date"); t.date = d2; fns.scheduleSave("trainings", W, 0); await settle(); }   // the coach's Move to, after the tap
  await signal(sb);
  const s = sb.tables.ft_trainings.get(W).data; app.reset(); localStorage.clear();
  assert.deepStrictEqual([s.title, s.completedAt, s.completedBy, s.date], ["Legs", null, undefined, d2]);
});

test("an exercise the coach deleted here since the backup (before the question) comes back when Restore is tapped, here and on the server, as the question says (rowsHere spares it: the twenty-first check round, no test applied it)", async () => {
  const sb = makeSupabase(); coach(sb);
  sb.seed("ft_clients", C, { id: C, name: "Riley Example", unit: "lb" });
  sb.seed("ft_trainings", W, { id: W, clientId: C, title: "Legs", date: "2026-11-26", createdAt: AT, completedAt: null, skippedAt: null, rows: [blankRow("r1", { label: "1", name: "Back squat" }), blankRow("r2", { label: "2", name: "Romanian deadlift", clientNote: "felt my hamstring", clientNoteBy: "client", clientNoteAt: AT })] }, { client_id: C });
  let out;
  try {
    await fns.syncDownNow(); await settle();
    const backup = clone(fns.backupData());
    { const t = maps.trainings.get(W); t.rows = t.rows.filter((r) => r.id !== "r2"); fns.scheduleSave("trainings", W, 0); } await settle(); await fns.syncDownNow(); await settle();   // deleted by mistake
    const plan = fns.planRestore(clone(backup));
    fns.applyRestore(plan); await settle();
    out = { text: plan.text, here: maps.trainings.get(W).rows.map((r) => r.id + ":" + r.label), server: sb.tables.ft_trainings.get(W).data.rows.map((r) => r.id + ":" + r.label) };
  } finally { app.reset(); localStorage.clear(); }
  assert.deepStrictEqual(out, { text: "1 workout from the file goes into the app. It replaces a copy already here, logged sets and all. Exercises back in the app: Riley Example (1 exercise). Everything else stays as it is.", here: ["r1:1", "r2:2"], server: ["r1:1", "r2:2"] });
});

for (const what of ["the template", "its first exercise"]) test("a template, or an exercise of one, deleted on the iPad while the Restore question is up stays deleted, as a client's workout does (rowsHere covers templates: the twenty-first check round, no test held it): " + what, async () => {
  const sb = makeSupabase(); coach(sb);
  sb.seed("ft_clients", TEMPLATES_ID, { id: TEMPLATES_ID, name: "Templates", kind: "templates", builtinsAdopted: 1, templatesVersion: 3 });
  sb.seed("ft_trainings", TP, { id: TP, clientId: TEMPLATES_ID, title: "Upper A", date: "2026-01-01", createdAt: AT, completedAt: null, skippedAt: null, template: { program: "My templates", phase: 0, stage: 0, n: 1 }, rows: [blankRow("t1", { label: "1", name: "Bench press", weights: [], repsDone: [] }), blankRow("t2", { label: "2", name: "Row", weights: [], repsDone: [] })] }, { client_id: TEMPLATES_ID });
  let out;
  try {
    await fns.syncDownNow(); await settle();
    const backup = clone(fns.backupData());
    { const s = sb.tables.ft_trainings.get(TP); s.data.title = "Upper A (new)"; bump(s); } await fns.syncDownNow(); await settle();   // renamed since the backup: the restore puts the old one back
    const plan = fns.planRestore(clone(backup));
    if (what === "the template") sb.tables.ft_trainings.delete(TP);                           // the iPad, under the question
    else { const s = sb.tables.ft_trainings.get(TP); s.data.rows = s.data.rows.filter((r) => r.id !== "t1"); s.data.rows[0].label = "1"; bump(s); }
    await fns.syncDownNow(); await settle();                                                  // the read after the tap
    fns.applyRestore(plan); await settle();
    const s = sb.tables.ft_trainings.get(TP);
    out = { planned: plan.ts.map((t) => t.id === TP), here: maps.trainings.has(TP) ? maps.trainings.get(TP).rows.map((r) => r.id + ":" + r.label) : null, server: s ? s.data.rows.map((r) => r.id + ":" + r.label) : null };
  } finally { app.reset(); localStorage.clear(); }
  assert.deepStrictEqual(out, what === "the template" ? { planned: [true], here: null, server: null } : { planned: [true], here: ["t2:1"], server: ["t2:1"] });
});

const cardsOf = (id) => { const { openBlocks, setSel } = fns.cardSets(); return { open: [...openBlocks].filter((k) => k.startsWith(id + "/")).map((k) => k.slice(id.length + 1)).sort(), sel: [...setSel].filter(([k]) => k.startsWith(id + "/")).map(([k, v]) => [k.slice(id.length + 1), v]).sort() }; };
const legsOf4 = () => [blankRow("r1", { label: "1", name: "Back squat", sets: 4 }), blankRow("r2", { label: "2", name: "Leg press", sets: 4 }), blankRow("r3", { label: "3", name: "Leg curl", sets: 4 }), blankRow("r4", { label: "4", name: "Calf raise", sets: 4 })];
test("the card state (the set looked at, a card opened) follows each exercise through a restore that drops one the iPad deleted under the question (the twenty-first check round: renumbering the file's copy moved it a second time, Calf raise's set onto Leg curl)", async () => {
  const sb = makeSupabase(); coach(sb);
  sb.seed("ft_clients", C, { id: C, name: "Jane Testperson", unit: "lb" });
  sb.seed("ft_trainings", W, { id: W, clientId: C, title: "Legs", date: "2026-11-26", createdAt: AT, completedAt: null, skippedAt: null, rows: legsOf4() }, { client_id: C });
  const log = {}; { const { openBlocks, setSel } = fns.cardSets(); openBlocks.clear(); setSel.clear(); }
  try {
    await fns.syncDownNow(); await settle();
    const backup = clone(fns.backupData());
    { const s = sb.tables.ft_trainings.get(W); s.data.title = "Legs B"; bump(s); } await fns.syncDownNow(); await settle();   // renamed since the backup: the restore puts Legs back
    const { openBlocks, setSel } = fns.cardSets(); setSel.set(W + "/4", 2); openBlocks.add(W + "/3");   // Calf raise on "Set 3 of 4", Leg curl's card open
    const plan = fns.planRestore(clone(backup));
    { const s = sb.tables.ft_trainings.get(W); s.data.rows = s.data.rows.filter((r) => r.id !== "r2"); s.data.rows.find((r) => r.id === "r3").label = "2"; s.data.rows.find((r) => r.id === "r4").label = "3"; bump(s); }   // the iPad: Delete exercise Leg press (the numbers close up there)
    await fns.syncDownNow(); await settle(); log.beforeTap = cardsOf(W);   // the sync under the question (or the read after the tap) brings it: the state here follows the iPad's numbers
    fns.applyRestore(plan); await settle();
    log.after = cardsOf(W); log.rows = maps.trainings.get(W).rows.map((r) => r.label + " " + r.name);
  } finally { app.reset(); localStorage.clear(); }
  assert.deepStrictEqual(log, { beforeTap: { open: ["2"], sel: [["3", 2]] }, after: { open: ["2"], sel: [["3", 2]] }, rows: ["1 Back squat", "2 Leg curl", "3 Calf raise"] });
});

test("a restore brings back an exercise deleted here since the backup: the card state follows each exercise into the file's numbers, and a card the file has none of goes with its state (an exercise added here since: its number is another exercise's now)", async () => {
  const sb = makeSupabase(); coach(sb);
  sb.seed("ft_clients", C, { id: C, name: "Jane Testperson", unit: "lb" });
  sb.seed("ft_trainings", W, { id: W, clientId: C, title: "Legs", date: "2026-11-26", createdAt: AT, completedAt: null, skippedAt: null, rows: legsOf4() }, { client_id: C });
  const log = {}; { const { openBlocks, setSel } = fns.cardSets(); openBlocks.clear(); setSel.clear(); }
  try {
    await fns.syncDownNow(); await settle();
    const backup = clone(fns.backupData());
    { const T = maps.trainings.get(W), x = T.rows.find((r) => r.id === "r2"); T.rows = T.rows.filter((r) => r !== x); fns.renumber(T, x); T.rows.push(blankRow("r5", { label: "4", name: "Lunge", sets: 4 })); fns.scheduleSave("trainings", W, 0); await settle(); }   // Delete exercise Leg press, then Add exercise Lunge (4)
    const { openBlocks, setSel } = fns.cardSets(); setSel.set(W + "/3", 2); openBlocks.add(W + "/2"); openBlocks.add(W + "/4");   // Calf raise (3 now) on set 3; Leg curl (2 now) and Lunge (4) open
    log.before = cardsOf(W);
    const plan = fns.planRestore(clone(backup));
    fns.applyRestore(plan); await settle();
    log.after = cardsOf(W); log.rows = maps.trainings.get(W).rows.map((r) => r.label + " " + r.name);
  } finally { app.reset(); localStorage.clear(); }
  assert.deepStrictEqual(log, { before: { open: ["2", "4"], sel: [["3", 2]] }, after: { open: ["3"], sel: [["4", 2]] }, rows: ["1 Back squat", "2 Leg press", "3 Leg curl", "4 Calf raise"] });
});

test("a restore that splits a superset (the twenty-second check round): since the backup, Row went into Bench press's superset (1a Bench press, 1b Row, 2 Fly; the backup has 1 Bench press, 2a Row, 2b Fly), and card 1 is open on Set 3: its state stays on Bench press's card, the first exercise of the card here, never sent to Row's new card; the same when the list here is not in number order (Row stored before Bench press)", async () => {
  const out = {}, ex = (id, label, name) => blankRow(id, { label, name, sets: 4 }), day = daysAgo(-3);   // a workout still to come (counted once)
  for (const order of ["in number order", "Row stored first"]) {
    const sb = makeSupabase(); coach(sb);
    sb.seed("ft_clients", C, { id: C, name: "Jane Testperson", unit: "lb" });
    sb.seed("ft_trainings", W, { id: W, clientId: C, title: "Upper", date: day, createdAt: AT, completedAt: null, skippedAt: null, rows: [ex("r1", "1", "Bench press"), ex("r2", "2a", "Row"), ex("r3", "2b", "Fly")] }, { client_id: C });
    const { openBlocks, setSel } = fns.cardSets(); openBlocks.clear(); setSel.clear();
    try {
      await fns.syncDownNow(); await settle();
      const backup = clone(fns.backupData());
      { const s = sb.tables.ft_trainings.get(W); s.data.rows = [ex("r1", "1a", "Bench press"), ex("r2", "1b", "Row"), ex("r3", "2", "Fly")]; bump(s); } await fns.syncDownNow(); await settle();   // since the backup: Row into Bench press's superset, Fly alone (on his iPad), synced here
      if (order === "Row stored first") { const t = maps.trainings.get(W); t.rows = [t.rows[1], t.rows[0], t.rows[2]]; }   // the list here not in number order (a typed number changes the label, not the list's order: the page draws by number)
      openBlocks.add(W + "/1"); setSel.set(W + "/1", 2);              // card 1 (Bench press and Row) open, on "Set 3 of 4"
      fns.applyRestore(fns.planRestore(clone(backup))); await settle();
      out[order] = { ...cardsOf(W), rows: maps.trainings.get(W).rows.map((r) => r.label + " " + r.name) };
    } finally { app.reset(); localStorage.clear(); }
  }
  const want = { open: ["1"], sel: [["1", 2]], rows: ["1 Bench press", "2a Row", "2b Fly"] };
  assert.deepStrictEqual(out, { "in number order": want, "Row stored first": want }, "card 1 stays open on Set 3 with Bench press; Row and Fly's card is as it was");
});
