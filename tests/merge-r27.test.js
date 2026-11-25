// v321 (the twenty-sixth check round): two of the coach's devices on one client workout, the second (the Mac, this page) open on it and not synced
// since the first device's change (the iPad's save, or her phone's), so its save meets the other copy and merges it (sync.js mergeServerRows):
// - R26-MRG-1: an exercise deleted on the iPad came back when the Mac deleted an earlier one: the Mac's Delete exercise moved the rest up a number,
//   and the three-way merge read the new number as a change of the exercise (with what was logged on it). It now compares an exercise without its
//   number. So an exercise deleted on one device that the other only renumbered, moved (Reorder) or joined a new exercise to now goes.
// - R26-MRG-5: a number was left out (1, 2, 4; no exercise 1) when the device that deleted saved second, or both deleted: when both copies had every
//   number from 1 on, so has the merged one (its cards close up in their order, as Delete exercise closes them up on one device).
// - R26-MRG-3: the card's "…" > Delete exercise did not claim the order, as Reorder's trash does: her Start this exercise crossing it moved the card
//   she had begun down (her phone opened the next one), or made a superset nobody made. It now claims the order (settleOrder places the cards).
// - R26-MRG-2: a label merged whole: the iPad's new number beside the Mac's dropped or swapped letter made a superset nobody made. A number and its
//   letter now merge each on its own, three ways.
// - R26-MRG-4 (in part): an exercise only one device has (added there or here, or joined into a card) follows the exercises it shared a card with on
//   that side, to the number the merge gave them (his tri-set was split, or her Start crossing his join made one nobody made).
// - R26-MRG-6, R26-TW-1: the Mac's own new exercises came back in each other's places when the iPad added one too (the round-25 known limit): they
//   now keep his order after the iPad's (round 25's four MISS tests, the save still on its way, nine and ten).
// - R26-TW-9 (the merge part): two new exercises numbered 9 and 10 (the closing-up sorts numbers, not words), and a read of a note dropping the
//   read marks that went stale (main.js markSeen), which the merge keeps dropped.
// The iPad's changes and her phone's are written on the stand-in server as main.js writes them (renumber, + Add exercise, the number picker, her
// Start this exercise run by main.js's own startExerciseNow on a copy). The Mac's are made with main.js's own functions (addExercise, renumber,
// roDelete, roCards, render's tidy) and the lines this file copies (the first test checks they still read so). Each case runs in all three ways
// the Mac's save can meet the other copy: online; with no signal, then its waiting save first; with no signal, then a sync first. Made-up people only.
import fs from "node:fs";
import { test, assert, tick } from "./assert.js";
import { makeSupabase } from "./fake-supabase.js";
import { load } from "./load.js";
import { byId, el } from "./env.js";
import { tidyLabels, cmpLabel, labelKey } from "../app/model.js";
const app = await load();
const { fns, maps } = app;
const src = fs.readFileSync(new URL("../app/main.js", import.meta.url), "utf8");
const settle = async () => { const until = Date.now() + 15000; do await tick(5); while ((app.get().inflight > 0 || maps.timers.size) && Date.now() < until); };
const C = "6e5d4c3b-1111-4a2b-9c8d-7e6f5a4b3c2d", W1 = "6e5d4c3b-2222-4a2b-9c8d-7e6f5a4b3c2d";
let n = 0; const bump = (s) => { s.updated_at = "2026-11-25T20:" + String(10 + Math.floor(n / 50) % 50).padStart(2, "0") + ":" + String(10 + (n++ % 50)).padStart(2, "0") + ".000Z"; };   // another device's write
const day = (k) => { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + k); return fns.localIso(d); };   // the app's local day (never UTC)
const coach = (sb) => { app.reset(); fns.leaveSettings(); app.set({ sb, signedIn: true, clientMode: false, backend: fns.cloudBackend, sessionEmail: "coach@x.com", view: { name: "clients" }, tab: "workouts", templateDraft: null, offline: false, offlineEntry: null }); };
const sync = async () => { await fns.syncDownNow(); await settle(); };
const quiet = () => { for (const tm of maps.timers.values()) clearTimeout(tm); maps.timers.clear(); clearTimeout(app.get().syncTimer); };   // no save or sync left to run into the next test
const done = () => { quiet(); app.set({ templateDraft: null, view: { name: "clients" }, tab: "workouts" }); app.reset(); localStorage.clear(); };
const AVA = (more = {}) => ({ id: C, name: "Ava Example", unit: "lb", email: "ava@example.com", phone: "3105550111", notes: { log: [] }, ...more });
const legs = (rows) => ({ id: W1, clientId: C, title: "Legs", date: day(0), createdAt: "2026-11-20T16:00:00.000Z", rows, completedAt: null, skippedAt: null });   // Ava's Legs today
const ex = (id, label, name, logged = false) => ({ id, label, name, sets: 3, reps: "10", tempo: "", rest: "", weights: [], repsDone: [], setsDone: 0, done: false, note: "", ...(logged ? { weights: ["95", "95", "95"], repsDone: ["10", "10", "10"], setsDone: 3, done: true, unit: "lb" } : {}) });
const srv = (sb) => sb.tables.ft_trainings.get(W1).data.rows;
const onIpad = (sb, change) => { const s = sb.tables.ft_trainings.get(W1); change(s.data); bump(s); };   // the iPad's save (or her phone's rule), landed
const cards = (rows) => { const ys = JSON.parse(JSON.stringify(rows || [])); tidyLabels(ys); ys.sort((a, b) => cmpLabel(a.label, b.label)); return fns.groupsOf(ys).map((g) => g.rows.map((r) => r.label + " " + r.name).join(" + ")); };   // the cards as the page draws them: its numbers tidied, a superset one card
const onWorkout = (fn) => { app.set({ view: { name: "training", id: W1 }, renderedTraining: null }); try { fn(); } catch (_) {} app.set({ view: { name: "clients" }, renderedTraining: null }); };   // on the Mac's page of the workout (what comes before the cards' draw runs; the draw itself is caught)
const macPage = () => onWorkout(() => fns.render());                    // the Mac's page drawn: its numbers tidied and saved (renderTraining: normalizeLabels, tidySave)

// ---------- the lines of main.js this file copies ----------
const DELETE_LINE = 't.rows = t.rows.filter((x) => x.id !== r.id); renumber(t, r); if (!tpl) touchState(t.id, "orderDel"); save(); S.renderedTraining = null; render();';   // the card's "…" > Delete exercise (deleteRow), once its question is answered
const LINES = [
  DELETE_LINE,
  "function nextLabel(t) { let max = 0; for (const r of t.rows) { const n = labelKey(r.label)[0]; if (Number.isFinite(n)) max = Math.max(max, n); } return String(max + 1); }",   // + Add exercise numbers the new exercise one past the highest
  'function newRow(label) { return { id: uid(), label, name: "", sets: 4, reps: "", tempo: "", rest: "", weights: [], repsDone: [], setsDone: 0, note: "" }; }',
  'r.name = e.target.value.replace(/\\n/g, " "); markNamed();',            // the name box
  "const markNamed = () => { if (S.clientMode) return; if (!trainerNamed.has(t.id)) trainerNamed.set(t.id, new Set()); trainerNamed.get(t.id).add(r.id); };",
  "r.label = n; lastEditedId = r.id;",                                   // the number picker's click: the number, ...
  "numpick.hidden = true; takeCardSets(cur); save(); S.renderedTraining = null; render();",   // ... saved, the page drawn again (tidied)
  'q(".label").addEventListener("input", (e) => { if (!typedNums.has(tk)) typedNums.set(tk, r.label); r.label = e.target.value; lastEditedId = r.id; save(); });',   // a number typed in its box (typedNums: the card state follows his own number, R26-CRD-7, and a merge under the caret reads it, R27-CRD-3; nothing of the merge)
  'bind(".reps", "reps");',                                              // the reps box
  "const mark = () => { if (!trainings.has(t.id)) return; const track = S.clientMode ? pendingWeightRows : trainerTouched; if (!track.has(t.id)) track.set(t.id, new Set()); track.get(t.id).add(r.id); save(); };",   // a weight typed: the coach's log on that exercise
];
const CLAIMS = /renumber\(t, r\); if \(!tpl\) touchState\(t\.id, "orderDel"\); save\(\);/.test(src);   // deleteRow's claim, as main.js has it (the stand-in below does what the line does)

// ---------- the iPad's changes and her phone's, as main.js writes them ----------
const iPadDeletes = (sb, ...rids) => onIpad(sb, (d) => { for (const rid of rids) { const gone = d.rows.find((x) => x.id === rid); d.rows = d.rows.filter((x) => x.id !== rid); fns.renumber(d, gone, false); } });   // Delete exercise on each (deleteRow: the numbers after it close up)
const iPadAdds = (sb, id, name, join = null) => onIpad(sb, (d) => { let max = 0; for (const r of d.rows) { const k = labelKey(r.label)[0]; if (Number.isFinite(k)) max = Math.max(max, k); } d.rows.push({ id, label: String(max + 1), name, sets: 4, reps: "", tempo: "", rest: "", weights: [], repsDone: [], setsDone: 0, note: "" }); if (join != null) { d.rows[d.rows.length - 1].label = String(join); tidyLabels(d.rows, id); } });   // + Add exercise (newRow(nextLabel(t))), its name typed, with join its number picked (its page tidies the numbers)
const herStart = (sb, key, logRid = null) => onIpad(sb, (d) => {        // her Start this exercise (client_order_rows writes her numbers), and with logRid her first set on that exercise (client_log_set)
  const HER = "her-" + W1, t = { ...JSON.parse(JSON.stringify(d)), id: HER }; app.set({ clientMode: true }); let res; try { res = fns.startExerciseNow(t, key); } finally { app.set({ clientMode: false }); }   // main.js's own Start this exercise, on her copy under its own id (nothing of this page's state is touched)
  if (!res || !res.changed) throw new Error("(the setup) her Start this exercise changed nothing");
  maps.pendingOrder.delete(HER); const hk = "trainings/" + HER; clearTimeout(maps.timers.get(hk)); maps.timers.delete(hk); maps.dirty.delete(hk);   // (her phone's queue is not this page's)
  const lab = new Map(t.rows.map((r) => [r.id, r.label])); for (const r of d.rows) if (lab.has(r.id)) r.label = lab.get(r.id);
  if (logRid) { const r = d.rows.find((x) => x.id === logRid); r.weights = ["30"]; r.repsDone = ["10"]; r.setsDone = 1; r.unit = "lb"; }
});
const herSets = (sb, rid, sets) => onIpad(sb, (d) => { const r = d.rows.find((x) => x.id === rid); r.weights = Array(sets).fill("50"); r.repsDone = Array(sets).fill("8"); r.setsDone = sets; r.unit = "lb"; if (sets >= (r.sets || 3)) r.done = true; });   // her sets logged (client_log_set)

// ---------- the Mac's changes: main.js's own functions, and the lines above ----------
const macRow = (rid) => maps.trainings.get(W1).rows.find((x) => x.id === rid);
const macDeletes = (rid) => { const t = maps.trainings.get(W1), r = macRow(rid); t.rows = t.rows.filter((x) => x.id !== r.id); fns.renumber(t, r); if (CLAIMS) fns.touchState(W1, "orderDel"); fns.scheduleSave("trainings", W1); macPage(); };   // DELETE_LINE
const macNew = (name) => { onWorkout(() => fns.addExercise()); const t = maps.trainings.get(W1), r = t.rows[t.rows.length - 1]; r.name = name; if (!maps.trainerNamed.has(W1)) maps.trainerNamed.set(W1, new Set()); maps.trainerNamed.get(W1).add(r.id); fns.scheduleSave("trainings", W1); return r.id; };   // + Add exercise (main.js addExercise), then its name typed
const macJoins = (rid, num) => { macRow(rid).label = String(num); fns.scheduleSave("trainings", W1); macPage(); };   // the number picker: that number, saved, the page drawn again (tidied)
const macTypes = (labels) => { for (const [rid, label] of Object.entries(labels)) macRow(rid).label = label; fns.scheduleSave("trainings", W1); macPage(); };   // numbers typed in their boxes, then the page drawn
const macReps = (rid, reps) => { macRow(rid).reps = reps; fns.scheduleSave("trainings", W1); };   // the reps box
const macWeight = (rid, w) => { const r = macRow(rid); r.weights = [w]; if (!r.unit) r.unit = "lb"; if (!maps.trainerTouched.has(W1)) maps.trainerTouched.set(W1, new Set()); maps.trainerTouched.get(W1).add(rid); fns.scheduleSave("trainings", W1); };   // set 1's weight box (mark)
const H = {}, askButtons = () => { for (const id of ["askYes", "askNo"]) { H[id] = []; const b = el("button"); b.addEventListener = (t, fn) => { (H[id] ||= []).push(fn); }; b.removeEventListener = (t, fn) => { H[id] = (H[id] || []).filter((f) => f !== fn); }; byId.set(id, b); } };   // the question's buttons, put in place at each use (another file's tests put their own)
const answer = (id) => { for (const fn of [...(H[id] || [])]) fn({}); };   // a press on the question's button
const roTrash = async (rid) => { askButtons(); app.set({ view: { name: "training", id: W1 }, renderedTraining: null }); fns.startOrder(W1); const p = fns.roDelete(W1, rid); await tick(400); answer("askYes"); const ok = await p; try { fns.doneOrder(); } catch (_) {} app.set({ view: { name: "clients" }, renderedTraining: null }); if (!ok) throw new Error("(the setup) Reorder's trash deleted nothing"); };   // the workout's "…" > Reorder, the swipe's Delete, Delete, Done
const roMove = (rid, to) => { app.set({ view: { name: "training", id: W1 }, renderedTraining: null }); fns.startOrder(W1); fns.roCards(maps.trainings.get(W1), rid, to); try { fns.doneOrder(); } catch (_) {} app.set({ view: { name: "clients" }, renderedTraining: null }); };   // Reorder: that card let go at place `to`, Done

const ROUTES = ["online", "with no signal, then the waiting save first", "with no signal, then a sync first"];
async function crossed(rows, ipad, mac, routes = ROUTES) {               // the Mac synced and opened the workout; the iPad's change lands; the Mac's change and its save, by each route; what each copy draws
  const out = {};
  for (const route of routes) {
    const sb = makeSupabase(); coach(sb); const log = {};
    sb.seed("ft_clients", C, AVA()); sb.seed("ft_trainings", W1, legs(JSON.parse(JSON.stringify(rows))), { client_id: C });
    try {
      await sync(); macPage(); await settle();                           // the Mac's last sync; the coach opens Ava's Legs
      ipad(sb); log.iPad = cards(srv(sb)); log.rowsIn = srv(sb).map((r) => r.label + " " + r.name);   // the server's list in its own order (a client's Start this exercise changes only the numbers)
      if (route !== "online") sb.setFail({ times: 1e6, message: "Failed to fetch" });   // no signal on the Mac
      await mac(sb); log.macAlone = cards(maps.trainings.get(W1).rows); log.claim = [...(maps.trainerState.get(W1) || [])]; await settle();
      if (route !== "online") { log.offline = { offline: app.get().offline, waiting: [...maps.dirty.keys()] }; sb.setFail(null); app.set({ offline: false }); if (route.endsWith("a sync first")) await sync(); else { fns.flushOne("trainings", W1); await settle(); } }   // the signal back
      macPage(); await settle();                                         // the page drawn after the merge (what it tidies is saved)
      log.server = cards(srv(sb)); log.mac = cards(maps.trainings.get(W1).rows); log.waiting = [...maps.dirty.keys()]; log.rows = JSON.parse(JSON.stringify(srv(sb)));
      await sync(); log.after = cards(maps.trainings.get(W1).rows);
    } finally { done(); sb.delayMs = 0; }
    out[route] = log;
  }
  return out;
}
const holds = (out, want, what) => { for (const [route, log] of Object.entries(out)) { if (route !== "online") assert.deepStrictEqual(log.offline, { offline: true, waiting: ["trainings/" + W1] }, "(the setup: the Mac's save waits for the signal) [" + route + "]: " + JSON.stringify(log)); assert.deepStrictEqual({ server: log.server, mac: log.mac, waiting: log.waiting, after: log.after }, { server: want, mac: want, waiting: [], after: want }, what + " [" + route + "]: " + JSON.stringify({ ...log, rows: undefined })); } };
const setup = (out, key, want, what) => { for (const [route, log] of Object.entries(out)) assert.deepStrictEqual(log[key], want, "(the setup: " + what + ") [" + route + "]: " + JSON.stringify({ ...log, rows: undefined })); };

test("the lines this file copies from main.js still read so (the card's Delete exercise, + Add exercise, the name box, the number picker, a number typed, the reps box, the weight box's mark)", () => {
  for (const line of LINES) assert.ok(src.includes(line), "main.js no longer reads as merge-r27.test.js copies it: " + line);
});

// ---------- R26-MRG-1: an exercise deleted on the other device, only renumbered here, goes ----------
test("an exercise deleted on the iPad stays deleted when the Mac, open on the workout and not synced since, deletes an earlier one with the card's \"…\" > Delete exercise (its Delete moved the rest up a number, nothing else): the iPad deleted Calf raise (3), the Mac Back squat (1); the server, the Mac and the Mac after its next sync hold 1 Romanian deadlift alone, online and with no signal (v321, the twenty-sixth check round, R26-MRG-1: Calf raise's new number read as a change made on the Mac, and it came back as 2, on the server and her phone)", async () => {
  for (const line of LINES) assert.ok(src.includes(line), "(the setup: main.js no longer reads as this file copies it): " + line);
  const out = await crossed([ex("r1", "1", "Back squat"), ex("r2", "2", "Romanian deadlift"), ex("r3", "3", "Calf raise")], (sb) => iPadDeletes(sb, "r3"), () => macDeletes("r1"));
  setup(out, "iPad", ["1 Back squat", "2 Romanian deadlift"], "the iPad's Delete exercise");
  setup(out, "macAlone", ["1 Romanian deadlift", "2 Calf raise"], "the Mac's Delete exercise closed up the rest");
  holds(out, ["1 Romanian deadlift"], "the exercise the iPad deleted came back");
});

test("the same for what was logged on it, a superset, one exercise of a superset each, and Reorder's trash: Calf raise deleted on the iPad with Ava's three sets on it stays deleted, sets and all; superset 2 (2a Lunge, 2b Step-up) deleted on the iPad stays deleted when the Mac deletes Back squat (1): 1 Leg curl; each deletes one exercise of superset 2 (the iPad Leg curl, the Mac Lunge): 1 Back squat, 2 Calf raise; the Mac deletes Back squat with Reorder's trash: 1 Romanian deadlift (v321, the twenty-sixth check round, R26-MRG-1)", async () => {
  const three = () => [ex("r1", "1", "Back squat"), ex("r2", "2", "Romanian deadlift"), ex("r3", "3", "Calf raise")];
  const CASES = {
    "her sets on it": [[ex("r1", "1", "Back squat"), ex("r2", "2", "Romanian deadlift"), ex("r3", "3", "Calf raise", true)], (sb) => iPadDeletes(sb, "r3"), () => macDeletes("r1"), ["1 Romanian deadlift"]],
    "a superset": [[ex("r1", "1", "Back squat"), ex("r4", "2a", "Lunge"), ex("r5", "2b", "Step-up"), ex("r2", "3", "Leg curl")], (sb) => iPadDeletes(sb, "r4", "r5"), () => macDeletes("r1"), ["1 Leg curl"]],
    "one of a superset each": [[ex("r1", "1", "Back squat"), ex("r2", "2a", "Leg curl"), ex("r4", "2b", "Lunge"), ex("r3", "3", "Calf raise")], (sb) => iPadDeletes(sb, "r2"), () => macDeletes("r4"), ["1 Back squat", "2 Calf raise"]],
    "Reorder's trash": [three(), (sb) => iPadDeletes(sb, "r3"), () => roTrash("r1"), ["1 Romanian deadlift"]],
  };
  for (const [how, [rows, ipad, mac, want]] of Object.entries(CASES)) {
    const out = await crossed(rows, ipad, mac);
    holds(out, want, how + ": an exercise the iPad deleted came back");
    if (how === "her sets on it") for (const log of Object.values(out)) assert.ok(!log.rows.some((r) => r.id === "r3"), "Calf raise came back with her sets: " + JSON.stringify(log.rows));
  }
});

test("no change for an exercise deleted on the iPad and changed on the Mac (#4): its planned reps changed on the Mac (the iPad deleted Back squat and Calf raise): 1 Romanian deadlift, 2 Calf raise; the Mac deleted Back squat and typed a weight on Calf raise, which the iPad deleted: 1 Romanian deadlift, 2 Calf raise; and the other order (the iPad deleted Back squat, the Mac Calf raise): 1 Romanian deadlift", async () => {
  const three = () => [ex("r1", "1", "Back squat"), ex("r2", "2", "Romanian deadlift"), ex("r3", "3", "Calf raise")];
  const CASES = {
    "its planned reps": [(sb) => iPadDeletes(sb, "r1", "r3"), () => macReps("r3", "15"), ["1 Romanian deadlift", "2 Calf raise"]],
    "a Delete exercise and a weight typed": [(sb) => iPadDeletes(sb, "r3"), () => { macDeletes("r1"); macWeight("r3", "40"); }, ["1 Romanian deadlift", "2 Calf raise"]],
    "the other order": [(sb) => iPadDeletes(sb, "r1"), () => macDeletes("r3"), ["1 Romanian deadlift"]],
  };
  for (const [how, [ipad, mac, want]] of Object.entries(CASES)) holds(await crossed(three(), ipad, mac), want, how + ": an exercise changed on the Mac was dropped, or a deletion undone");
});

test("an exercise deleted on the iPad that the Mac only moved with Reorder, or only joined a new exercise to, goes too (the behaviour R26-MRG-1's fix changes, v321: before, it came back): the iPad deleted Calf raise (3); the Mac's Reorder put Calf raise first: 1 Back squat, 2 Romanian deadlift; the Mac added Step-up and gave it Calf raise's number (3): 1 Back squat, 2 Romanian deadlift, 3 Step-up", async () => {
  const three = () => [ex("r1", "1", "Back squat"), ex("r2", "2", "Romanian deadlift"), ex("r3", "3", "Calf raise")];
  holds(await crossed(three(), (sb) => iPadDeletes(sb, "r3"), () => roMove("r3", 0)), ["1 Back squat", "2 Romanian deadlift"], "Reorder's move brought back the exercise the iPad deleted");
  holds(await crossed(three(), (sb) => iPadDeletes(sb, "r3"), () => macJoins(macNew("Step-up"), 3)), ["1 Back squat", "2 Romanian deadlift", "3 Step-up"], "a join brought back the exercise the iPad deleted, or lost the new exercise");
});

// ---------- R26-MRG-5: no number left out when both copies had none ----------
test("no number left out when both copies had every number from 1 on: the iPad added Plank (+ Add exercise numbered it 4) and the Mac deleted Calf raise (3): 1 Back squat, 2 Romanian deadlift, 3 Plank; both deleted, the iPad Back squat (1) and the Mac Leg curl (2): 1 Calf raise, 2 Plank; online and with no signal (v321, the twenty-sixth check round, R26-MRG-5: 1, 2, 4 Plank, and 2 Calf raise, 3 Plank with no exercise 1)", async () => {
  const a = await crossed([ex("r1", "1", "Back squat"), ex("r2", "2", "Romanian deadlift"), ex("r3", "3", "Calf raise")], (sb) => iPadAdds(sb, "r8", "Plank"), () => macDeletes("r3"));
  setup(a, "iPad", ["1 Back squat", "2 Romanian deadlift", "3 Calf raise", "4 Plank"], "the iPad's + Add exercise numbered Plank 4");
  holds(a, ["1 Back squat", "2 Romanian deadlift", "3 Plank"], "a number was left out");
  const b = await crossed([ex("r1", "1", "Back squat"), ex("r2", "2", "Leg curl"), ex("r3", "3", "Calf raise"), ex("r4", "4", "Plank")], (sb) => iPadDeletes(sb, "r1"), () => macDeletes("r2"));
  holds(b, ["1 Calf raise", "2 Plank"], "no exercise 1");
});

test("no number left out after Reorder's trash beside her begun card: Ava finished Back squat, Leg curl and Calf raise (the Mac read them finished) and began Plank since; the Mac, not synced since her set, deleted Leg curl and Calf raise with Reorder's trash: 1 Back squat, 2 Plank (v321, the twenty-sixth check round, R26-MRG-5: 1 Back squat, 4 Plank; the twenty-seventh, R27-MRG-7: an exercise she finished after the copy was read comes back instead, merge-r27b.test.js)", async () => {
  const out = await crossed([ex("r1", "1", "Back squat", true), ex("r2", "2", "Leg curl", true), ex("r3", "3", "Calf raise", true), ex("r4", "4", "Plank")], (sb) => { herSets(sb, "r4", 1); }, async () => { await roTrash("r2"); await roTrash("r3"); });
  holds(out, ["1 Back squat", "2 Plank"], "a number was left out, or her begun card moved");
});

test("a number left out on purpose stays: the Mac typed 4 for Calf raise (1, 2, 4) while the iPad saved a change to Back squat; the iPad typed 5 for Calf raise (1, 2, 4, 5) and the Mac deleted Plank (4): 1 Back squat, 2 Leg curl, 5 Calf raise (only copies that both had every number from 1 on close up)", async () => {
  const a = await crossed([ex("r1", "1", "Back squat"), ex("r2", "2", "Leg curl"), ex("r3", "3", "Calf raise")], (sb) => onIpad(sb, (d) => { d.rows.find((x) => x.id === "r1").reps = "5"; }), () => macTypes({ r3: "4" }));
  holds(a, ["1 Back squat", "2 Leg curl", "4 Calf raise"], "the Mac's own number was closed up");
  holds(await crossed([ex("r1", "1", "Back squat"), ex("r2", "2", "Leg curl"), ex("r3", "3", "Calf raise"), ex("r4", "4", "Plank")], (sb) => onIpad(sb, (d) => { d.rows.find((x) => x.id === "r3").label = "5"; }), () => macDeletes("r4")), ["1 Back squat", "2 Leg curl", "5 Calf raise"], "the iPad's own number was closed up");
});

// ---------- R26-MRG-3: the card's Delete exercise claims the order, as Reorder's trash ----------
test("the exercise Ava has begun stays where she put it when the Mac, not synced since her Start this exercise, deletes another with the card's \"…\" > Delete exercise, as with Reorder's trash: she put Plank first and logged a set; the Mac deleted Back squat: 1 Plank (her set kept), 2 Leg curl, 3 Calf raise; the Mac deleted Leg curl instead: 1 Plank, 2 Back squat, 3 Calf raise; before her first set, his order stands with no superset nobody made: 1 Back squat, 2 Calf raise, 3 Plank (v321, the twenty-sixth check round, R26-MRG-3: Plank went back to 3 and her phone opened Leg curl; or 2a Back squat + 2b Calf raise, a superset nobody made, and no exercise 1)", async () => {
  const four = () => [ex("r1", "1", "Back squat"), ex("r2", "2", "Leg curl"), ex("r3", "3", "Calf raise"), ex("r4", "4", "Plank")];
  const a = await crossed(four(), (sb) => herStart(sb, "4", "r4"), () => macDeletes("r1"));
  setup(a, "iPad", ["1 Plank", "2 Back squat", "3 Leg curl", "4 Calf raise"], "her Start this exercise put Plank first");
  setup(a, "claim", ["orderDel"], "the card's Delete exercise claims the order");
  holds(a, ["1 Plank", "2 Leg curl", "3 Calf raise"], "the exercise she has begun moved");
  for (const log of Object.values(a)) assert.deepStrictEqual(log.rows.find((x) => x.id === "r4").weights, ["30"], "her set on Plank was lost: " + JSON.stringify(log.rows));
  holds(await crossed(four(), (sb) => herStart(sb, "4", "r4"), () => macDeletes("r2")), ["1 Plank", "2 Back squat", "3 Calf raise"], "the exercise she has begun moved, or a superset nobody made");
  holds(await crossed(four(), (sb) => herStart(sb, "4"), () => macDeletes("r2")), ["1 Back squat", "2 Calf raise", "3 Plank"], "a superset nobody made, or a number left out");
});

// ---------- R26-MRG-2: a number and its letter, each three ways ----------
test("a number and its letter merge each on its own: the iPad deleted Back squat (superset 2 moved to 1a and 1b) and the Mac, not synced since, swapped the superset's letters by typing (2a Lunge, 2b Leg curl): 1a Lunge, 1b Leg curl, 2 Calf raise; her Start this exercise on the superset crossing the same swap: 1a Lunge, 1b Leg curl, 2 Back squat, 3 Calf raise; and two Delete exercise (the iPad Back squat, the Mac Lunge, 2b): W Bike, 1 Leg curl, 2 Calf raise, Finisher Sled push; a label in words still merges whole (the iPad made Back squat the warm-up, W) (v321, the twenty-sixth check round, R26-MRG-2: taken whole, a label made a superset or a tri-set nobody made, and left no exercise 1)", async () => {
  const sup = () => [ex("r1", "1", "Back squat"), ex("r2", "2a", "Leg curl"), ex("r4", "2b", "Lunge"), ex("r3", "3", "Calf raise")];
  holds(await crossed(sup(), (sb) => iPadDeletes(sb, "r1"), () => macTypes({ r2: "2b", r4: "2a" })), ["1a Lunge + 1b Leg curl", "2 Calf raise"], "the iPad's numbers and the Mac's letters made a card nobody made");
  holds(await crossed(sup(), (sb) => herStart(sb, "2"), () => macTypes({ r2: "2b", r4: "2a" })), ["1a Lunge + 1b Leg curl", "2 Back squat", "3 Calf raise"], "her numbers and the Mac's letters made a card nobody made");
  holds(await crossed([ex("w", "W", "Bike"), ex("r1", "1", "Back squat"), ex("r2", "2a", "Leg curl"), ex("r4", "2b", "Lunge"), ex("r3", "3", "Calf raise"), ex("f", "Finisher", "Sled push")], (sb) => iPadDeletes(sb, "r1"), () => macDeletes("r4")), ["W Bike", "1 Leg curl", "2 Calf raise", "Finisher Sled push"], "two cards on one number, or a number left out");
  holds(await crossed([ex("r1", "1", "Back squat"), ex("r2", "2", "Leg curl"), ex("r3", "3", "Calf raise")], (sb) => onIpad(sb, (d) => { d.rows.find((x) => x.id === "r1").label = "W"; tidyLabels(d.rows, "r1"); }), () => macReps("r2", "12")), ["W Back squat", "2 Leg curl", "3 Calf raise"], "a label in words (the warm-up's W) picked on the iPad was lost");   // a label that is no number and letter merges whole, as before
});

// ---------- R26-MRG-4 (in part): an exercise only one side has follows its card ----------
test("an exercise only one device has follows its card through the other device's renumbering: the iPad deleted Back squat (superset 2 moved to 1) and the Mac, not synced since, added Step-up and joined it into superset 2 with the number picker: one tri-set, 1a Leg curl, 1b Lunge, 1c Step-up, then 2 Calf raise; the iPad deleted Back squat and the Mac joined a new Step-up into Lunge's card (3): 1 Leg curl, 2a Lunge + 2b Step-up, 3 Deadlift; Ava's Start this exercise on Calf raise (3) crossing the Mac's new Step-up joined into Leg curl's card (2): 1 Calf raise, 2 Back squat, 3a Leg curl + 3b Step-up (v321, the twenty-sixth check round, R26-MRG-4: his tri-set was split, Step-up joined Deadlift, or Back squat joined his superset)", async () => {
  holds(await crossed([ex("r1", "1", "Back squat"), ex("r2", "2a", "Leg curl"), ex("r4", "2b", "Lunge"), ex("r3", "3", "Calf raise")], (sb) => iPadDeletes(sb, "r1"), () => macJoins(macNew("Step-up"), 2)), ["1a Leg curl + 1b Lunge + 1c Step-up", "2 Calf raise"], "his tri-set was split");
  holds(await crossed([ex("r1", "1", "Back squat"), ex("r2", "2", "Leg curl"), ex("r3", "3", "Lunge"), ex("r4", "4", "Deadlift")], (sb) => iPadDeletes(sb, "r1"), () => macJoins(macNew("Step-up"), 3)), ["1 Leg curl", "2a Lunge + 2b Step-up", "3 Deadlift"], "his superset was split, or made with another exercise");
  holds(await crossed([ex("r1", "1", "Back squat"), ex("r2", "2", "Leg curl"), ex("r3", "3", "Calf raise")], (sb) => herStart(sb, "3"), () => macJoins(macNew("Step-up"), 2)), ["1 Calf raise", "2 Back squat", "3a Leg curl + 3b Step-up"], "his superset was made with another exercise");
});

// ---------- R26-MRG-6, R26-TW-1: his own new exercises keep his order ----------
test("the Mac's own new exercises keep the order he added them in when the iPad added one too: Legs 1 to 5; the iPad added Hip thrust (6) and the Mac, not synced since, Step-up and then Hop: 6 Hip thrust, 7 Step-up, 8 Hop, online and with no signal (v321, the twenty-sixth check round, R26-MRG-6, R26-TW-1: the round-25 known limit, 7 Hop, 8 Step-up)", async () => {
  const out = await crossed([ex("r1", "1", "Back squat"), ex("r2", "2", "Leg curl"), ex("r3", "3", "Calf raise"), ex("r4", "4", "Plank"), ex("r5", "5", "Lunge")], (sb) => iPadAdds(sb, "r8", "Hip thrust"), () => { macNew("Step-up"); macNew("Hop"); });
  setup(out, "macAlone", ["1 Back squat", "2 Leg curl", "3 Calf raise", "4 Plank", "5 Lunge", "6 Step-up", "7 Hop"], "the Mac's + Add exercise numbered Step-up 6 and Hop 7");
  holds(out, ["1 Back squat", "2 Leg curl", "3 Calf raise", "4 Plank", "5 Lunge", "6 Hip thrust", "7 Step-up", "8 Hop"], "his two new exercises came back in each other's places");
});

// round 25's four MISS tests (its fix of R25-MRG-1 missed these; r25/fix/t25-merge/undo/miss/miss-test.js), on this file's stand-ins
const two = () => [ex("r1", "1", "Back squat"), ex("r2", "2", "Leg curl")];
for (const [how, mac, end] of [
  ["the Mac added two (Calf raise, then Hip thrust), the iPad one (Plank)", () => { macNew("Calf raise"); macNew("Hip thrust"); }, ["1 Back squat", "2 Leg curl", "3 Plank", "4 Calf raise", "5 Hip thrust"]],
  ["the Mac made a superset (Calf raise, then Step-up given its number, 3) and added Hip thrust after it, the iPad added Plank", () => { macNew("Calf raise"); macJoins(macNew("Step-up"), 3); macNew("Hip thrust"); }, ["1 Back squat", "2 Leg curl", "3 Plank", "4a Calf raise + 4b Step-up", "5 Hip thrust"]],
]) for (const route of ["online", "with no signal, then the waiting save first"]) test("both devices adding exercises keep the coach's own order on the Mac (" + route + "): " + how + ": the Mac's exercises come after the iPad's in the order he added them (v321, the twenty-sixth check round, R26-TW-1: round 25's MISS tests)", async () => {
  holds(await crossed(two(), (sb) => iPadAdds(sb, "r8", "Plank"), mac, [route]), end, "the Mac's own exercises came out in another order than he added them");
});

test("the Mac's own new exercises keep his order while its first save is still on its way (a slow signal): the iPad added Plank; the Mac added Calf raise, and Hip thrust while that save was out: 3 Plank, 4 Calf raise, 5 Hip thrust (v321, the twenty-sixth check round, R26-TW-1)", async () => {
  holds(await crossed(two(), (sb) => iPadAdds(sb, "r8", "Plank"), async (sb) => { sb.delayMs = 300; macNew("Calf raise"); await tick(700); macNew("Hip thrust"); }, ["online"]), ["1 Back squat", "2 Leg curl", "3 Plank", "4 Calf raise", "5 Hip thrust"], "his exercises came back in each other's places");
});

test("nine and ten keep their order: eight exercises on the server; the iPad renamed the workout and the Mac added Calf raise and Hip thrust (9 and 10): 9 Calf raise, 10 Hip thrust; with the iPad's Plank (9) as well: 9 Plank, 10 Calf raise, 11 Hip thrust; online and with no signal (v321, the twenty-sixth check round, R26-TW-9: the closing-up sorts numbers, not words)", async () => {
  const eight = () => ["Back squat", "Leg curl", "Lunge", "Step-up", "Deadlift", "Leg press", "Hip abduction", "Calf press"].map((nm, i) => ex("e" + (i + 1), String(i + 1), nm));
  const head = ["1 Back squat", "2 Leg curl", "3 Lunge", "4 Step-up", "5 Deadlift", "6 Leg press", "7 Hip abduction", "8 Calf press"];
  const a = await crossed(eight(), (sb) => onIpad(sb, (d) => { d.title = "Legs day"; }), () => { macNew("Calf raise"); macNew("Hip thrust"); });
  holds(a, [...head, "9 Calf raise", "10 Hip thrust"], "9 and 10 came back in each other's places");
  holds(await crossed(eight(), (sb) => iPadAdds(sb, "r8", "Plank"), () => { macNew("Calf raise"); macNew("Hip thrust"); }), [...head, "9 Plank", "10 Calf raise", "11 Hip thrust"], "his 10 and 11 came back in each other's places");
});

test("an exercise deleted on the iPad and changed on the Mac comes back after the iPad's exercises, among the Mac's own in his order: the iPad deleted Back squat (1); the Mac changed its reps and then added Calf raise: 1 Leg curl, 2 Hip thrust, 3 Back squat, 4 Calf raise (v321, the twenty-sixth check round, R26-TW-1: before, after everything, 4 Back squat)", async () => {
  const out = await crossed([ex("r1", "1", "Back squat"), ex("r2", "2", "Leg curl"), ex("r3", "3", "Hip thrust")], (sb) => iPadDeletes(sb, "r1"), () => { macReps("r1", "5"); macNew("Calf raise"); });
  holds(out, ["1 Leg curl", "2 Hip thrust", "3 Back squat", "4 Calf raise"], "the order changed, or an exercise was lost");
  for (const log of Object.values(out)) assert.strictEqual(log.rows.find((x) => x.id === "r1").reps, "5", "the Mac's change on Back squat was lost: " + JSON.stringify(log.rows));
});

// ---------- R26-TW-9: a read drops the read marks that went stale, and the merge keeps them dropped ----------
test("a read of a note drops the read marks that went stale, even when the note was read before (main.js markSeen), and the Mac's save keeps them dropped against the iPad's older list: Ava's marks hold an old plain one for her Leg press note (as v315 wrote them), one for her Leg curl note before she rewrote it, and one for a note on an exercise since deleted; the Mac reads her Leg press note again: her record holds that note's own mark alone, on the Mac and on the server, beside the iPad's new phone number; then her rewritten Leg press note is news (v321, the twenty-sixth check round, R26-TW-9: the stale marks stayed until the next new read, and the plain one kept her rewrite from ever being news)", async () => {
  const TA = "2026-11-24T17:01:00.000Z", TB = "2026-11-24T17:02:00.000Z", TB2 = "2026-11-25T08:15:00.000Z", TA2 = "2026-11-25T09:30:00.000Z";
  const noteId = (rid) => "row/" + W1 + "/" + rid, mk = (rid, at) => noteId(rid) + "@" + at;   // main.js noteId and noteMark
  for (const line of ['const noteId = (t, r) => "row/" + t.id + "/" + r.id;', 'const noteMark = (t, r) => noteId(t, r) + "@" + String(r.clientNoteAt || "");']) assert.ok(src.includes(line), "(the setup: main.js's noteId or noteMark no longer reads as this file copies them): " + line);
  const noted = (id, label, name, note, at) => ({ ...ex(id, label, name), clientNote: note, clientNoteBy: "client", clientNoteAt: at });
  const stale = [noteId("r1"), mk("r2", TB), mk("r9", TA)];
  const sb = makeSupabase(); coach(sb); const log = {};
  sb.seed("ft_clients", C, AVA({ seenNotes: stale })); sb.seed("ft_trainings", W1, legs([noted("r1", "1", "Leg press", "Knee felt tight", TA), noted("r2", "2", "Leg curl", "Easy today, more weight", TB2)]), { client_id: C });
  try {
    await sync();
    const s = sb.tables.ft_clients.get(C); s.data.phone = "3105550199"; bump(s);   // the iPad, synced: her new phone number (its list as it was)
    fns.markNoteSeen(maps.clients.get(C), noteId("r1")); log.mac = [...maps.clients.get(C).seenNotes]; log.waiting = [...maps.dirty.keys()]; await settle();   // her Leg press note tapped again on the Mac; its save meets the iPad's copy
    log.server = [...(sb.tables.ft_clients.get(C).data.seenNotes || [])]; log.phone = sb.tables.ft_clients.get(C).data.phone;
    const t = sb.tables.ft_trainings.get(W1); Object.assign(t.data.rows.find((x) => x.id === "r1"), { clientNote: "Knee sore after set 3", clientNoteAt: TA2 }); bump(t);   // her phone: her Leg press note rewritten
    await sync(); log.news = fns.clientNews(maps.clients.get(C)).notes.map((x) => x.r.clientNote).sort();
  } finally { done(); }
  assert.deepStrictEqual(log, { mac: [mk("r1", TA)], waiting: ["clients/" + C], server: [mk("r1", TA)], phone: "3105550199", news: ["Easy today, more weight", "Knee sore after set 3"] }, "a stale read mark stayed, or the iPad's phone number was lost, or her rewritten note was not news: " + JSON.stringify(log));
});

// ---------- v321, the twenty-seventh check round (tests lens): follow's other side and two-number case (R26-MRG-4), the closing-up's sorts (R26-MRG-5) ----------
test("v321 (the twenty-seventh check round, tests lens): an exercise only the iPad has follows its card through the Mac's renumbering: the iPad added Step-up and joined it into Lunge's card (2a Lunge, 2b Step-up); the Mac, not synced since, gave Lunge the last number with the number picker: Step-up goes with Lunge, online and with no signal (follow's server side, R26-MRG-4)", async () => {
  const out = await crossed([ex("r1", "1", "Back squat"), ex("r2", "2", "Lunge"), ex("r3", "3", "Calf raise")], (sb) => iPadAdds(sb, "r4", "Step-up", 2), () => macJoins("r2", 4));
  setup(out, "iPad", ["1 Back squat", "2a Lunge + 2b Step-up", "3 Calf raise"], "the iPad's join");
  setup(out, "macAlone", ["1 Back squat", "3 Calf raise", "4 Lunge"], "the Mac's number pick");
  holds(out, ["1 Back squat", "3 Calf raise", "4a Lunge + 4b Step-up"], "Step-up stays on Lunge's card (not 2b beside Calf raise, a superset nobody made)");
});

test("v321 (the twenty-seventh check round, tests lens): no exercise 1 left out when her Start this exercise left the server's exercises out of their order: the iPad deleted Back squat, then Ava started Plank first (her rule changes only the numbers, the list keeps its order), and the Mac, not synced since, deleted Leg curl: 1 Calf raise, 2 Plank (R26-MRG-5's closing-up reads the server's numbers sorted)", async () => {
  const out = await crossed([ex("r1", "1", "Back squat"), ex("r2", "2", "Leg curl"), ex("r3", "3", "Calf raise"), ex("r4", "4", "Plank")], (sb) => { iPadDeletes(sb, "r1"); herStart(sb, "3"); }, () => macDeletes("r2"));
  setup(out, "iPad", ["1 Plank", "2 Leg curl", "3 Calf raise"], "the iPad's Delete and her Start");
  for (const [route, log] of Object.entries(out)) assert.deepStrictEqual(log.rowsIn, ["2 Leg curl", "3 Calf raise", "1 Plank"], "(the setup: the server's list in its old order) [" + route + "]");
  setup(out, "macAlone", ["1 Back squat", "2 Calf raise", "3 Plank"], "the Mac's Delete");
  holds(out, ["1 Calf raise", "2 Plank"], "no number left out");
});

test("v321 (the twenty-seventh check round, tests lens): eleven exercises, both devices deleted one: the iPad Squat 1, the Mac, not synced since, Lunge 2: the nine left are 1 to 9 in their order, never a 10 taken for a 1 (R26-MRG-5's closing-up sorts numbers, not words)", async () => {
  const names = ["Squat 1", "Lunge 2", "Row 3", "Press 4", "Curl 5", "Dip 6", "Plank 7", "Bridge 8", "Step 9", "Hop 10", "Skip 11"];
  const rows = names.map((nm, i) => ex("e" + (i + 1), String(i + 1), nm));
  const out = await crossed(rows, (sb) => iPadDeletes(sb, "e1"), () => macDeletes("e2"));
  setup(out, "macAlone", names.filter((nm) => nm !== "Lunge 2").map((nm, i) => (i + 1) + " " + nm), "the Mac's Delete");
  holds(out, names.slice(2).map((nm, i) => (i + 1) + " " + nm), "no number left out, the order kept");
});

test("v321 (the twenty-seventh check round, tests lens): an exercise only the Mac has, on a superset the iPad split, stays where its card's number stayed: the Mac added Step-up into 2 (2a Lunge, 2b Leg curl, 2c Step-up); the iPad, not synced, gave Lunge 4 with the number picker: Step-up stays on card 2 with Leg curl, Lunge 4 (its card-mates went to two numbers: follow moves it to neither; the letters aside)", async () => {
  let sid = null;
  const out = await crossed([ex("r1", "1", "Back squat"), ex("r2", "2a", "Lunge"), ex("r3", "2b", "Leg curl"), ex("r4", "3", "Calf raise")], (sb) => onIpad(sb, (d) => { d.rows.find((x) => x.id === "r2").label = "4"; tidyLabels(d.rows, "r2"); }), () => { sid = macNew("Step-up"); macJoins(sid, 2); });
  setup(out, "iPad", ["1 Back squat", "2 Leg curl", "3 Calf raise", "4 Lunge"], "the iPad's pick");
  setup(out, "macAlone", ["1 Back squat", "2a Lunge + 2b Leg curl + 2c Step-up", "3 Calf raise"], "the Mac's new exercise in the superset");
  const letterless = (cs) => cs.map((c) => c.split(" + ").map((x) => x.replace(/^(\d+)[a-z]? /, "$1 ")).sort().join(" + "));
  for (const [route, log] of Object.entries(out)) for (const k of ["server", "mac", "after"]) assert.deepStrictEqual(letterless(log[k]), ["1 Back squat", "2 Leg curl + 2 Step-up", "3 Calf raise", "4 Lunge"], "Step-up stays on card 2 [" + route + "] " + k + ": " + JSON.stringify(log[k]));
});

// ---------- v321, the twenty-seventh check round (tests lens, R27-TW-11): a superset's order through a letter the other device dropped ----------
// The other device left an exercise of the superset alone on its card (its letter dropped: "2"), while this device put an exercise of its own
// into that card: the dropped letter was taken, and a number with no letter sorts last in its card, so the superset came out in another order.
test("v321 (the twenty-seventh check round, R27-TW-11): the superset keeps the Mac's order through the iPad's split: the Mac added Step-up into 2 (2a Lunge, 2b Leg curl, 2c Step-up); the iPad, not synced, gave Lunge 4 with the number picker: 2a Leg curl, 2b Step-up, 4 Lunge (Leg curl's letter, dropped on the iPad alone, is no reason to move it behind Step-up)", async () => {
  const out = await crossed([ex("r1", "1", "Back squat"), ex("r2", "2a", "Lunge"), ex("r3", "2b", "Leg curl"), ex("r4", "3", "Calf raise")], (sb) => onIpad(sb, (d) => { d.rows.find((x) => x.id === "r2").label = "4"; tidyLabels(d.rows, "r2"); }), () => { const sid = macNew("Step-up"); macJoins(sid, 2); });
  setup(out, "iPad", ["1 Back squat", "2 Leg curl", "3 Calf raise", "4 Lunge"], "the iPad's pick");
  setup(out, "macAlone", ["1 Back squat", "2a Lunge + 2b Leg curl + 2c Step-up", "3 Calf raise"], "the Mac's new exercise in the superset");
  holds(out, ["1 Back squat", "2a Leg curl + 2b Step-up", "3 Calf raise", "4 Lunge"], "the superset in the Mac's order");
});
test("v321 (the twenty-seventh check round, R27-TW-11): the same when the iPad gave the superset's second exercise another number: the Mac added Step-up into 2; the iPad gave Leg curl 4: 2a Lunge, 2b Step-up, 4 Leg curl", async () => {
  const out = await crossed([ex("r1", "1", "Back squat"), ex("r2", "2a", "Lunge"), ex("r3", "2b", "Leg curl"), ex("r4", "3", "Calf raise")], (sb) => onIpad(sb, (d) => { d.rows.find((x) => x.id === "r3").label = "4"; tidyLabels(d.rows, "r3"); }), () => { const sid = macNew("Step-up"); macJoins(sid, 2); });
  setup(out, "iPad", ["1 Back squat", "2 Lunge", "3 Calf raise", "4 Leg curl"], "the iPad's pick");
  holds(out, ["1 Back squat", "2a Lunge + 2b Step-up", "3 Calf raise", "4 Leg curl"], "the superset in the Mac's order");
});
test("v321 (the twenty-seventh check round, R27-TW-11): an exercise of a superset deleted on the iPad and changed on the Mac stays in its place (#4): 2a Lunge, 2b Leg curl; the iPad deleted Leg curl, the Mac, not synced since, changed its reps: 2a Lunge, 2b Leg curl", async () => {
  const out = await crossed([ex("r1", "1", "Back squat"), ex("r2", "2a", "Lunge"), ex("r3", "2b", "Leg curl"), ex("r4", "3", "Calf raise")], (sb) => iPadDeletes(sb, "r3"), () => macReps("r3", "12"));
  setup(out, "iPad", ["1 Back squat", "2 Lunge", "3 Calf raise"], "the iPad's Delete");
  holds(out, ["1 Back squat", "2a Lunge + 2b Leg curl", "3 Calf raise"], "the superset in its order");
});
