// r27 (the twenty-seventh check round, the merge verifier): two of the coach's devices (or her phone and the Mac) on one client workout; the Mac
// (this page) is open on it and not synced since the other's save, so its save meets the other copy and merges it (sync.js mergeServerRows).
// - R27-MRG-1: the card's "…" > Delete exercise claimed the whole order (v321, R26-MRG-3), so the iPad's join, warm-up or split went back to the
//   Mac's numbering. It now claims the order only while the other copy put no exercise in another card or under a word (her Start still keeps
//   the card she began). And a card not begun never takes a number below a card she began that comes before it (fix F: the Delete of a card
//   before hers freed a lower number and the next card took it, so her phone opened Calf raise while she was on Leg curl).
// - R27-MRG-2: an exercise deleted on the iPad that the Mac made the warm-up, or gave words, stays (only a number is no change of the exercise).
// - R27-MRG-4: a card the iPad added alone, on the number the Mac just gave one of its own cards with the number picker, goes after the others.
// - R27-MRG-5: an exercise joined on the Mac follows its card to the number the merge gave it (a superset nobody made, or the join lost).
// - R27-MRG-6: inside a superset the rests belong to the places (Reorder moves them so): moved on one side only, an exercise's rest merges by place.
// The iPad's changes and her phone's are written on the stand-in server by main.js's own functions (renumber, the number picker's tidy, + Add
// exercise's numbering, roCards/roRows on a copy under its own id, startExerciseNow); the Mac's by main.js's own functions or deleteRow's line
// as main.js has it (its claim read from the source). Each case runs in the three ways the Mac's save can meet the other copy. Made-up people only.
import fs from "node:fs";
import { test, assert, tick } from "./assert.js";
import { makeSupabase } from "./fake-supabase.js";
import { load } from "./load.js";
import { byId, el } from "./env.js";
import { tidyLabels, cmpLabel, labelKey } from "../app/model.js";
const app = await load();
const { fns, maps } = app;
const src = fs.readFileSync(new URL("../app/main.js", import.meta.url), "utf8");
const DEL = /t\.rows = t\.rows\.filter\(\(x\) => x\.id !== r\.id\); renumber\(t, r\); (?:if \(!tpl\) touchState\(t\.id, "(\w+)"\); )?save\(\); S\.renderedTraining = null; render\(\);/.exec(src);   // deleteRow, once its question is answered
const CLAIM = DEL ? DEL[1] || null : undefined;
const settle = async () => { const until = Date.now() + 15000; do await tick(5); while ((app.get().inflight > 0 || maps.timers.size) && Date.now() < until); };
const C = "9c8d7e6f-1111-4a3b-8c9d-0e1f2a3b4c5d", W = "9c8d7e6f-2222-4a3b-8c9d-0e1f2a3b4c5d";
let n = 0; const bump = (s) => { s.updated_at = "2026-11-25T23:" + String(10 + Math.floor(n / 50) % 50).padStart(2, "0") + ":" + String(10 + (n++ % 50)).padStart(2, "0") + ".000Z"; };   // another device's write
const day = (k) => { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + k); return fns.localIso(d); };   // the app's local day (never UTC)
const coach = (sb) => { app.reset(); fns.leaveSettings(); app.set({ sb, signedIn: true, clientMode: false, backend: fns.cloudBackend, sessionEmail: "coach@x.com", view: { name: "clients" }, tab: "workouts", templateDraft: null, offline: false, offlineEntry: null }); };
const sync = async () => { await fns.syncDownNow(); await settle(); };
const quiet = () => { for (const tm of maps.timers.values()) clearTimeout(tm); maps.timers.clear(); clearTimeout(app.get().syncTimer); };
const done = () => { quiet(); app.set({ templateDraft: null, view: { name: "clients" }, tab: "workouts" }); app.reset(); localStorage.clear(); };
const AVA = () => ({ id: C, name: "Ava Example", unit: "lb", email: "ava@example.com", phone: "3105550111", notes: { log: [] } });
const legs = (rows) => ({ id: W, clientId: C, title: "Legs", date: day(0), createdAt: "2026-11-20T16:00:00.000Z", rows, completedAt: null, skippedAt: null });   // Ava's Legs today
const ex = (id, label, name, more = {}) => ({ id, label, name, sets: 3, reps: "10", tempo: "", rest: "", weights: [], repsDone: [], setsDone: 0, done: false, note: "", ...more });
const finished = (r) => ({ ...r, weights: ["50", "50", "50"], repsDone: ["8", "8", "8"], setsDone: 3, done: true, unit: "lb", logSeq: 3 });
const srvRows = (sb) => sb.tables.ft_trainings.get(W).data.rows;
const cards = (rows) => { const ys = JSON.parse(JSON.stringify(rows || [])); tidyLabels(ys); ys.sort((a, b) => cmpLabel(a.label, b.label)); return fns.groupsOf(ys).map((g) => g.rows.map((r) => r.label + " " + r.name).join(" + ")); };   // the cards as the page draws them
const rests = (rows) => { const ys = JSON.parse(JSON.stringify(rows || [])); tidyLabels(ys); return ys.sort((a, b) => cmpLabel(a.label, b.label)).map((r) => r.label + " " + r.name + " " + (r.rest || "-")); };
const onWorkout = (fn) => { app.set({ view: { name: "training", id: W }, renderedTraining: null }); try { fn(); } catch (_) {} app.set({ view: { name: "clients" }, renderedTraining: null }); };
const macPage = () => onWorkout(() => fns.render());                    // the Mac's page drawn: its numbers tidied and saved (renderTraining: normalizeLabels, tidySave)

// ---------- the iPad's save (or her phone's rule), landed on the server ----------
const onServer = (sb, change) => { const s = sb.tables.ft_trainings.get(W); change(s.data); bump(s); };
const scratch = (d, fn) => {                                             // main.js's own Reorder on a copy of the server's record under its own id (nothing of this page's state kept); its labels and rests back by id
  const TMP = "ipad-" + W, t = { ...JSON.parse(JSON.stringify(d)), id: TMP }; let ok;
  try { ok = fn(t); } finally { maps.trainerState.delete(TMP); const k = "trainings/" + TMP; clearTimeout(maps.timers.get(k)); maps.timers.delete(k); maps.dirty.delete(k); }
  if (!ok) throw new Error("(the setup) the iPad's Reorder changed nothing");
  const by = new Map(t.rows.map((r) => [r.id, r])); for (const r of d.rows) { const x = by.get(r.id); if (!x) continue; r.label = x.label; if (x.rest === undefined) delete r.rest; else r.rest = x.rest; }
};
const ip = {
  del: (...rids) => (d) => { for (const rid of rids) { const gone = d.rows.find((x) => x.id === rid); d.rows = d.rows.filter((x) => x.id !== rid); fns.renumber(d, gone, false); } },   // Delete exercise (the numbers after it close up)
  pick: (rid, num) => (d) => { d.rows.find((x) => x.id === rid).label = String(num); tidyLabels(d.rows, rid); },   // the number picker, the page's tidy
  add: (id, name) => (d) => { let max = 0; for (const r of d.rows) { const k = labelKey(r.label)[0]; if (Number.isFinite(k)) max = Math.max(max, k); } d.rows.push({ id, label: String(max + 1), name, sets: 3, reps: "", tempo: "", rest: "", weights: [], repsDone: [], setsDone: 0, note: "" }); },   // + Add exercise (newRow(nextLabel(t))), its name typed
  row: (rid, to) => (d) => scratch(d, (t) => fns.roRows(t, rid, to, false)),   // Reorder inside a card
  rest: (rid, v) => (d) => { d.rows.find((x) => x.id === rid).rest = v; },
  herStart: (key, logRid = null) => (d) => {                             // her Start this exercise (main.js's own, on her copy under its own id), and with logRid her first set on it
    const HER = "her-" + W, t = { ...JSON.parse(JSON.stringify(d)), id: HER }; app.set({ clientMode: true }); let res; try { res = fns.startExerciseNow(t, key); } finally { app.set({ clientMode: false }); }
    if (!res || !res.changed) throw new Error("(the setup) her Start this exercise changed nothing");
    maps.pendingOrder.delete(HER); const hk = "trainings/" + HER; clearTimeout(maps.timers.get(hk)); maps.timers.delete(hk); maps.dirty.delete(hk);
    const lab = new Map(t.rows.map((r) => [r.id, r.label])); for (const r of d.rows) if (lab.has(r.id)) r.label = lab.get(r.id);
    if (logRid) { const r = d.rows.find((x) => x.id === logRid); r.weights = ["30"]; r.repsDone = ["10"]; r.setsDone = 1; r.unit = "lb"; r.logSeq = 1; }
  },
  herLog: (rid, k) => (d) => { const r = d.rows.find((x) => x.id === rid); r.weights = Array(k).fill("50"); r.repsDone = Array(k).fill("8"); r.setsDone = k; r.done = k >= (r.sets || 3); r.unit = "lb"; r.logSeq = (r.logSeq || 0) + k; },   // client_log_set's fields
};
// ---------- the Mac: main.js's own functions, and deleteRow's line as main.js has it ----------
const mrow = (rid) => maps.trainings.get(W).rows.find((x) => x.id === rid);
const H = {}, askButtons = () => { for (const id of ["askYes", "askNo"]) { H[id] = []; const b = el("button"); b.addEventListener = (t, fn) => { (H[id] ||= []).push(fn); }; b.removeEventListener = (t, fn) => { H[id] = (H[id] || []).filter((f) => f !== fn); }; byId.set(id, b); } };
const answer = (id) => { for (const fn of [...(H[id] || [])]) fn({}); };
const mac = {
  del: (rid) => () => { const t = maps.trainings.get(W), r = mrow(rid); t.rows = t.rows.filter((x) => x.id !== r.id); fns.renumber(t, r); if (CLAIM) fns.touchState(W, CLAIM); fns.scheduleSave("trainings", W); macPage(); },   // the card's "…" > Delete exercise (deleteRow)
  trash: (rid) => async () => { askButtons(); app.set({ view: { name: "training", id: W }, renderedTraining: null }); fns.startOrder(W); const p = fns.roDelete(W, rid); await tick(400); answer("askYes"); const ok = await p; try { fns.doneOrder(); } catch (_) {} app.set({ view: { name: "clients" }, renderedTraining: null }); if (!ok) throw new Error("(the setup) Reorder's trash deleted nothing"); },
  pick: (rid, num) => () => { const t = maps.trainings.get(W); mrow(rid).label = String(num); tidyLabels(t.rows, rid); fns.scheduleSave("trainings", W); macPage(); },   // the number picker (lastEditedId: the page's tidy places it)
  word: (rid, w) => () => { const t = maps.trainings.get(W); mrow(rid).label = w; tidyLabels(t.rows, rid); fns.scheduleSave("trainings", W); macPage(); },   // words typed in the number box, then left
  row: (rid, to) => () => { app.set({ view: { name: "training", id: W }, renderedTraining: null }); fns.startOrder(W); const ok = fns.roRows(maps.trainings.get(W), rid, to); try { fns.doneOrder(); } catch (_) {} app.set({ view: { name: "clients" }, renderedTraining: null }); if (!ok) throw new Error("(the setup) the Mac's Reorder changed nothing"); },
  rest: (rid, v) => () => { mrow(rid).rest = v; fns.scheduleSave("trainings", W); },   // the rest box
};
const ROUTES = ["online", "with no signal, then the waiting save first", "with no signal, then a sync first"];
async function crossed(rows, first, second, look = cards) {
  const out = {};
  for (const route of ROUTES) {
    const sb = makeSupabase(); coach(sb); const log = {};
    sb.seed("ft_clients", C, AVA()); sb.seed("ft_trainings", W, legs(JSON.parse(JSON.stringify(rows))), { client_id: C });
    try {
      await sync(); macPage(); await settle();                           // the Mac's last sync; the coach opens Ava's Legs
      onServer(sb, first); log.first = look(srvRows(sb));
      if (route !== "online") sb.setFail({ times: 1e6, message: "Failed to fetch" });
      await second(); log.macAlone = look(maps.trainings.get(W).rows); await settle();
      if (route !== "online") { log.waited = [...maps.dirty.keys()]; sb.setFail(null); app.set({ offline: false }); if (route.endsWith("a sync first")) await sync(); else { fns.flushOne("trainings", W); await settle(); } }
      macPage(); await settle();
      log.server = look(srvRows(sb)); log.mac = look(maps.trainings.get(W).rows); log.waiting = [...maps.dirty.keys()];
      await sync(); log.after = look(maps.trainings.get(W).rows);
    } finally { done(); }
    out[route] = log;
  }
  return out;
}
const holds = (out, want, what) => { for (const [route, log] of Object.entries(out)) { if (route !== "online") assert.deepStrictEqual(log.waited, ["trainings/" + W], "(the setup: the Mac's save waits for the signal) [" + route + "]"); assert.deepStrictEqual({ server: log.server, mac: log.mac, waiting: log.waiting, after: log.after }, { server: want, mac: want, waiting: [], after: want }, what + " [" + route + "]: " + JSON.stringify(log)); } };
const setupIs = (out, key, want, what) => { for (const [route, log] of Object.entries(out)) assert.deepStrictEqual(log[key], want, "(the setup: " + what + ") [" + route + "]"); };
const FOUR = () => [ex("r1", "1", "Back squat"), ex("r2", "2", "Leg curl"), ex("r3", "3", "Calf raise"), ex("r4", "4", "Plank")];
const SUP = () => [ex("r1", "1", "Back squat"), ex("r2", "2a", "Leg curl"), ex("r3", "2b", "Lunge"), ex("r4", "3", "Calf raise")];
const SUPR = () => [ex("r1", "1", "Back squat", { rest: "90 sec" }), ex("r2", "2a", "Leg curl", { rest: "30 sec" }), ex("r3", "2b", "Lunge", { rest: "90 sec" }), ex("r4", "3", "Calf raise", { rest: "60 sec" })];
const TRI = () => [ex("r1", "1", "Back squat", { rest: "90 sec" }), ex("r2", "2a", "Leg curl", { rest: "20 sec" }), ex("r3", "2b", "Lunge", { rest: "30 sec" }), ex("r5", "2c", "Step-up", { rest: "2 min" }), ex("r4", "3", "Calf raise", { rest: "60 sec" })];
const TWELVE = () => Array.from({ length: 12 }, (_, i) => ex("m" + (i + 1), String(i + 1), "Move " + (i + 1)));
const doneLook = (rows) => { const ys = JSON.parse(JSON.stringify(rows || [])); tidyLabels(ys); ys.sort((a, b) => cmpLabel(a.label, b.label)); return fns.groupsOf(ys).map((g) => g.rows.map((r) => r.label + " " + r.name + (r.done ? " (done)" : (r.setsDone || 0) ? " (" + r.setsDone + " of " + r.sets + ")" : "")).join(" + ")); };

test("the line this file copies from main.js still reads so (the card's \"…\" > Delete exercise, its claim read from it)", () => {
  assert.ok(CLAIM !== undefined, "main.js's deleteRow no longer reads as merge-r27b.test.js copies it");
});

// ---------- R27-MRG-1: the card's Delete exercise on the Mac crossing the iPad's join, warm-up or split ----------
test("the iPad's join stays when the Mac, not synced since, deletes another exercise with the card's \"…\" > Delete exercise: Leg curl put into Back squat's card on the iPad, Calf raise deleted on the Mac: 1a Back squat + 1b Leg curl, 3 Plank (r27, R27-MRG-1: the Delete's claim on the order put the Mac's numbering back, 1 Back squat, 2 Leg curl, 3 Plank)", async () => {
  const out = await crossed(FOUR(), ip.pick("r2", 1), mac.del("r3"));
  setupIs(out, "first", ["1a Back squat + 1b Leg curl", "3 Calf raise", "4 Plank"], "the iPad's join");
  setupIs(out, "macAlone", ["1 Back squat", "2 Leg curl", "3 Plank"], "the Mac's Delete exercise");
  holds(out, ["1a Back squat + 1b Leg curl", "3 Plank"], "the iPad's superset went");
});

test("the same for the iPad's warm-up: Back squat made the warm-up on the iPad, Calf raise (or Leg curl) deleted on the Mac: W Back squat stays (r27, R27-MRG-1: it went back to 1)", async () => {
  holds(await crossed(FOUR(), ip.pick("r1", "W"), mac.del("r3")), ["W Back squat", "2 Leg curl", "3 Plank"], "the iPad's warm-up went back to 1");
  holds(await crossed(FOUR(), ip.pick("r1", "W"), mac.del("r2")), ["W Back squat", "2 Calf raise", "3 Plank"], "the iPad's warm-up went back to 1");
});

test("her Start this exercise still keeps the card she began when the Mac deletes another with the card's Delete exercise (R26-MRG-3 kept): she started Plank and logged a set; the Mac deleted Back squat: 1 Plank, 2 Leg curl, 3 Calf raise; the Mac deleted Leg curl: 1 Plank, 2 Back squat, 3 Calf raise", async () => {
  holds(await crossed(FOUR(), ip.herStart(4, "r4"), mac.del("r1")), ["1 Plank", "2 Leg curl", "3 Calf raise"], "the card she began moved");
  holds(await crossed(FOUR(), ip.herStart(4, "r4"), mac.del("r2")), ["1 Plank", "2 Back squat", "3 Calf raise"], "the card she began moved, or a superset nobody made");
});

test("a card not begun never goes ahead of the card she is on: she finished Back squat and logged set 1 of Leg curl; the Mac, not synced since her set, deleted Back squat (with the card's Delete exercise, or Reorder's trash): 1 Leg curl (1 of 3), 2 Calf raise, 3 Plank (r27, fix F: 1 Calf raise, 2 Leg curl, and her phone opened Calf raise); and after her Start this exercise on Plank: 1 Leg curl (done), 2 Plank (1 of 3), 3 Calf raise", async () => {
  const rows = () => { const rs = FOUR(); rs[0] = finished(rs[0]); return rs; };
  holds(await crossed(rows(), ip.herLog("r2", 1), mac.del("r1"), doneLook), ["1 Leg curl (1 of 3)", "2 Calf raise", "3 Plank"], "the card she has not reached went ahead of hers");
  holds(await crossed(rows(), ip.herLog("r2", 1), mac.trash("r1"), doneLook), ["1 Leg curl (1 of 3)", "2 Calf raise", "3 Plank"], "the card she has not reached went ahead of hers");
  holds(await crossed(rows(), ip.herLog("r2", 1), mac.del("r3"), doneLook), ["1 Back squat (done)", "2 Leg curl (1 of 3)", "3 Plank"], "(a Delete after her card)");
  const two = () => { const rs = rows(); rs[1] = finished(rs[1]); return rs; };   // she finished Back squat and Leg curl, then Start this exercise on Plank and a set; the Mac, read before her Start, deleted Back squat
  holds(await crossed(two(), ip.herStart(4, "r4"), mac.del("r1"), doneLook), ["1 Leg curl (done)", "2 Plank (1 of 3)", "3 Calf raise"], "the card she has not reached went ahead of hers (1 Calf raise, 2 Leg curl, 3 Plank)");
});

// ---------- R27-MRG-2: deleted on the iPad, made the warm-up or given words on the Mac ----------
test("an exercise deleted on the iPad that the Mac, not synced since, made the warm-up or gave words stays (#4, changed here): W Back squat, 1 Leg curl, 2 Calf raise, 3 Plank; Finisher Back squat after the others; W Plank (r27, R27-MRG-2: a change of the whole label read as no change)", async () => {
  holds(await crossed(FOUR(), ip.del("r1"), mac.pick("r1", "W")), ["W Back squat", "1 Leg curl", "2 Calf raise", "3 Plank"], "the Mac's warm-up went");
  holds(await crossed(FOUR(), ip.del("r1"), mac.word("r1", "Finisher")), ["1 Leg curl", "2 Calf raise", "3 Plank", "Finisher Back squat"], "the Mac's Finisher went");
  holds(await crossed(FOUR(), ip.del("r4"), mac.pick("r4", "W")), ["W Plank", "1 Back squat", "2 Leg curl", "3 Calf raise"], "the Mac's warm-up went");
});

test("still no change for an exercise only renumbered here (R26-MRG-1 kept): Calf raise deleted on the iPad, Back squat on the Mac: 1 Leg curl, 2 Plank; two warm-ups (Wa Bike, Wb Row), Row deleted on the iPad, Bike on the Mac (Row became W): 1 Back squat, 2 Leg curl", async () => {
  holds(await crossed(FOUR(), ip.del("r3"), mac.del("r1")), ["1 Leg curl", "2 Plank"], "the exercise the iPad deleted came back");
  holds(await crossed([ex("w1", "Wa", "Bike"), ex("w2", "Wb", "Row"), ex("r1", "1", "Back squat"), ex("r2", "2", "Leg curl")], ip.del("w2"), mac.del("w1")), ["1 Back squat", "2 Leg curl"], "the warm-up the iPad deleted came back");
});

// ---------- R27-MRG-4: the Mac's number picker crossing the iPad's + Add exercise ----------
test("a card the iPad added on the number the Mac, not synced since, just gave one of its own with the number picker goes after it: Hip thrust added (5), Back squat moved to 5: 5 Back squat, 6 Hip thrust; Hip thrust added (4), Lunge split onto 4: 4 Lunge, 5 Hip thrust; twelve cards, Extra added (13), Move 3 moved to 13: 13 Move 3, 14 Extra (r27, R27-MRG-4: a superset nobody made)", async () => {
  holds(await crossed(FOUR(), ip.add("n1", "Hip thrust"), mac.pick("r1", 5)), ["2 Leg curl", "3 Calf raise", "4 Plank", "5 Back squat", "6 Hip thrust"], "a superset nobody made");
  holds(await crossed(SUP(), ip.add("n1", "Hip thrust"), mac.pick("r3", 4)), ["1 Back squat", "2 Leg curl", "3 Calf raise", "4 Lunge", "5 Hip thrust"], "a superset nobody made");
  const out = await crossed(TWELVE(), ip.add("n1", "Extra"), mac.pick("m3", 13));
  for (const log of Object.values(out)) for (const k of ["server", "mac", "after"]) { assert.ok(log[k].includes("13 Move 3") && log[k].includes("14 Extra"), "a superset nobody made: " + JSON.stringify(log[k])); }
});

// ---------- R27-MRG-5: the Mac's join crossing the iPad's Delete exercise ----------
test("an exercise the Mac, not synced since, put into a card follows that card when the iPad deleted an earlier one: Back squat deleted, Plank into Leg curl's card: 1a Leg curl + 1b Plank, 2 Calf raise; Calf raise into Leg curl's card: 1a Leg curl + 1b Calf raise, 3 Plank; twelve cards, Move 1 deleted, Move 12 into Move 10's card: 9a Move 10 + 9b Move 12, 10 Move 11 (r27, R27-MRG-5: Plank + Calf raise, a superset nobody made; the join lost)", async () => {
  holds(await crossed(FOUR(), ip.del("r1"), mac.pick("r4", 2)), ["1a Leg curl + 1b Plank", "2 Calf raise"], "a superset nobody made");
  holds(await crossed(FOUR(), ip.del("r1"), mac.pick("r3", 2)), ["1a Leg curl + 1b Calf raise", "3 Plank"], "the Mac's join was lost");
  const out = await crossed(TWELVE(), ip.del("m1"), mac.pick("m12", 10));
  for (const log of Object.values(out)) for (const k of ["server", "mac", "after"]) assert.ok(log[k].includes("9a Move 10 + 9b Move 12") && log[k].includes("10 Move 11"), "a superset nobody made: " + JSON.stringify(log[k]));
});

// ---------- R27-MRG-6: Reorder inside a superset on one device, a rest on the other ----------
test("a superset's rests stay with their places when one device moves its exercises (Reorder) and the other changes a rest: the iPad swapped superset 2, the Mac set the round's rest (after Lunge, its 2b) to 2 min: 2a Lunge 30 sec, 2b Leg curl 2 min; the Mac set the transition (after Leg curl, its 2a) to 45 sec: 2a Lunge 45 sec, 2b Leg curl 90 sec; and the other way round (r27, R27-MRG-6: 2 minutes between the exercises and the old 90 sec after the round; the iPad's new rest lost)", async () => {
  const want = (a, b) => ["1 Back squat 90 sec", "2a Lunge " + a, "2b Leg curl " + b, "3 Calf raise 60 sec"];
  holds(await crossed(SUPR(), ip.row("r3", 0), mac.rest("r3", "2 min"), rests), want("30 sec", "2 min"), "the round's rest went between the exercises");
  holds(await crossed(SUPR(), ip.row("r3", 0), mac.rest("r2", "45 sec"), rests), want("45 sec", "90 sec"), "the transition went after the round");
  holds(await crossed(SUPR(), ip.rest("r3", "2 min"), mac.row("r3", 0), rests), want("30 sec", "2 min"), "the iPad's round rest was lost");
  holds(await crossed(SUPR(), ip.rest("r2", "45 sec"), mac.row("r3", 0), rests), want("45 sec", "90 sec"), "the iPad's transition was lost");
  holds(await crossed(TRI(), ip.row("r5", 0), mac.rest("r5", "3 min"), rests), ["1 Back squat 90 sec", "2a Step-up 20 sec", "2b Leg curl 30 sec", "2c Lunge 3 min", "3 Calf raise 60 sec"], "a tri-set's round rest went first");
});

test("rests merge by exercise as before when nobody moved one inside its card: the iPad set Leg curl's to 45 sec, the Mac Lunge's to 2 min: 2a Leg curl 45 sec, 2b Lunge 2 min; both swapped superset 2 and the Mac set the round's rest: 2b Leg curl 2 min", async () => {
  holds(await crossed(SUPR(), ip.rest("r2", "45 sec"), mac.rest("r3", "2 min"), rests), ["1 Back squat 90 sec", "2a Leg curl 45 sec", "2b Lunge 2 min", "3 Calf raise 60 sec"], "each device's rest");
  holds(await crossed(SUPR(), ip.row("r3", 0), async () => { await mac.row("r3", 0)(); await mac.rest("r2", "2 min")(); }, rests), ["1 Back squat 90 sec", "2a Lunge 30 sec", "2b Leg curl 2 min", "3 Calf raise 60 sec"], "the same move on both");
});

// ---------- R27-MRG-7 (the owner's pick B, 25 Nov 2026): what she logged on an exercise the coach deleted on a copy that never showed it ----------
// Before, her sets went from the server, her phone and her History (the three-way rule "removed here stays", the audit's #4). Now the exercise comes
// back with what she logged, finished early at those sets (nothing of it is left to do, as the coach asked); his next Delete, over a copy that
// shows her sets, stands. Her own rule (client_log_set) is played on the stand-in server as client-log-set.sql writes it.
const logged = (rows) => { const ys = JSON.parse(JSON.stringify(rows || [])); tidyLabels(ys); ys.sort((a, b) => cmpLabel(a.label, b.label)); return ys.map((r) => { const ws = (r.weights || []).filter((w) => String(w == null ? "" : w).trim()), sd = Number(r.setsDone) || 0; return r.label + " " + r.name + (r.done ? (sd < (r.sets || 3) ? " finished early, " + sd + " of " + r.sets : " finished") : sd ? ", " + sd + " of " + r.sets : "") + (ws.length ? " [" + ws.join(",") + "]" : "") + (r.earlyReason ? " (" + r.earlyReason + ")" : ""); }); };
const ONBS = () => { const rs = FOUR().slice(0, 3); rs[0] = finished(rs[0]); return rs; };   // Back squat finished (the Mac read it so); 2 Leg curl, 3 Calf raise
const herRule = (sb) => { sb.rpcs.client_log_set = async (a) => { const s = sb.tables.ft_trainings.get(a.p_training), r = s && s.data.rows.find((x) => x.id === a.p_row); if (!r) { const e = new Error("row not found"); e.code = "P0001"; throw e; } if (a.p_seq != null && (Number(r.logSeq) || 0) > a.p_seq) return r.logSeq; r.weights = a.p_weights; r.repsDone = a.p_reps; r.setsDone = a.p_sets_done; r.done = !!a.p_done; if (a.p_unit) r.unit = a.p_unit; if (a.p_seq != null) r.logSeq = a.p_seq; bump(s); return a.p_seq; };   // client-log-set.sql: the row gone is P0001
  sb.rpcs.client_my_data = async () => ({ clients: [{ id: C, data: (({ notes, ...rest }) => rest)(JSON.parse(JSON.stringify(sb.tables.ft_clients.get(C).data))) }], trainings: [...sb.tables.ft_trainings.values()].filter((t) => t.client_id === C).map((t) => ({ id: t.id, data: JSON.parse(JSON.stringify(t.data)), updated_at: t.updated_at })) }); };   // her phone's sync

test("an exercise the coach deleted on a copy that never showed her set comes back, finished early at what she logged: she finished Back squat and logged set 1 of Leg curl (50 lb); the Mac, not synced since, deleted Leg curl with the card's \"…\" > Delete exercise, or with Reorder's trash: the server, the Mac and the Mac after its next sync hold 2 Leg curl finished early, 1 of 3 [50] (r27, R27-MRG-7: her set went from the server, her phone and her History)", async () => {
  const want = ["1 Back squat finished [50,50,50]", "2 Leg curl finished early, 1 of 3 [50]", "3 Calf raise"];
  for (const del of [mac.del, mac.trash]) {
    const out = await crossed(ONBS(), ip.herLog("r2", 1), del("r2"), logged);
    setupIs(out, "macAlone", ["1 Back squat finished [50,50,50]", "2 Calf raise"], "the Mac's Delete took Leg curl off its own copy");
    holds(out, want, "her logged set was deleted with Leg curl (or the exercise came back with sets left to do)");
  }
});

test("a finished one comes back finished, a skipped one skipped with her reason: she logged all 3 sets of Leg curl, or skipped it for Discomfort, after the Mac's copy was read; the Mac deleted Leg curl: 2 Leg curl finished [50,50,50]; 2 Leg curl finished early, 0 of 3 (Discomfort) (r27, R27-MRG-7)", async () => {
  holds(await crossed(ONBS(), ip.herLog("r2", 3), mac.del("r2"), logged), ["1 Back squat finished [50,50,50]", "2 Leg curl finished [50,50,50]", "3 Calf raise"], "her finished Leg curl was deleted");
  holds(await crossed(ONBS(), (d) => { const r = d.rows.find((x) => x.id === "r2"); r.done = true; r.setsDone = 0; r.earlyReason = "Discomfort"; }, mac.del("r2"), logged), ["1 Back squat finished [50,50,50]", "2 Leg curl finished early, 0 of 3 (Discomfort)", "3 Calf raise"], "her skip and its reason were deleted");
});

test("the Delete stands over a copy that showed her sets: she logged set 1 of Leg curl before the Mac's last sync, then the iPad renamed the workout; the Mac deleted Leg curl: 1 Back squat, 2 Calf raise; with set 2 logged after the Mac's sync it comes back finished early at 2 of 3 (only what she logged since the copy was read brings it back)", async () => {
  const seen = () => { const rs = ONBS(); rs[1] = { ...rs[1], weights: ["50"], repsDone: ["8"], setsDone: 1, unit: "lb", logSeq: 1 }; return rs; };
  holds(await crossed(seen(), (d) => { d.title = "Legs A"; }, mac.del("r2"), logged), ["1 Back squat finished [50,50,50]", "2 Calf raise"], "the Delete of an exercise whose sets the Mac showed did not stand");
  holds(await crossed(seen(), ip.herLog("r2", 2), mac.del("r2"), logged), ["1 Back squat finished [50,50,50]", "2 Leg curl finished early, 2 of 3 [50,50]", "3 Calf raise"], "her set logged after the Mac's sync was deleted");
});

test("her set still waiting on her phone when his Delete lands: with nothing of hers on the server, the Delete stands; her phone then sends the set, her rule refuses it (the row is gone) and the phone drops it, so Leg curl and that set are gone on her phone after its sync (the known limit); with set 1 on the server and set 2 waiting, Leg curl comes back finished early at 1 of 3, then her set 2 lands on it and it is open again at 2 of 3, on the server, her phone and the Mac", async () => {
  for (const landed of [0, 1]) {
    const sb = makeSupabase(); coach(sb); herRule(sb); const log = { landed };
    sb.seed("ft_clients", C, AVA()); sb.seed("ft_trainings", W, legs(ONBS()), { client_id: C });
    try {
      await sync(); macPage(); await settle();                           // the Mac's last sync
      if (landed) onServer(sb, ip.herLog("r2", 1));                      // her set 1 landed (client_log_set)
      const herCopy = JSON.parse(JSON.stringify(sb.tables.ft_trainings.get(W).data));   // her phone's copy as it was
      { const r = herCopy.rows.find((x) => x.id === "r2"); r.weights = ["50", "50"].slice(0, landed + 1); r.repsDone = ["8", "8"].slice(0, landed + 1); r.setsDone = landed + 1; r.unit = "lb"; r.logSeq = landed; }   // the set still on her phone (set 1, or set 2)
      mac.del("r2")(); await settle();                                   // the Mac, not synced since, deletes Leg curl; its save lands
      log.server = logged(srvRows(sb));
      app.reset(); fns.leaveSettings(); app.set({ sb, signedIn: true, clientMode: true, myClientId: C, backend: fns.clientBackend, sessionEmail: "ava@example.com", view: { name: "client", id: C }, offline: false });   // her phone
      maps.clients.set(C, AVA()); maps.trainings.set(W, { ...herCopy, id: W }); maps.pendingWeightRows.set(W, new Set(["r2"])); fns.scheduleSave("trainings", W, 0); await settle();   // her waiting set goes
      log.afterHerSend = logged(srvRows(sb)); log.queue = [...(maps.pendingWeightRows.get(W) || [])];
      await sync(); log.herPhone = logged(maps.trainings.get(W).rows);
      quiet(); coach(sb); await sync(); log.macAfter = logged(maps.trainings.get(W).rows);   // the Mac's next sync
    } finally { done(); }
    if (!landed) assert.deepStrictEqual(log, { landed, server: ["1 Back squat finished [50,50,50]", "2 Calf raise"], afterHerSend: ["1 Back squat finished [50,50,50]", "2 Calf raise"], queue: [], herPhone: ["1 Back squat finished [50,50,50]", "2 Calf raise"], macAfter: ["1 Back squat finished [50,50,50]", "2 Calf raise"] }, "nothing of hers on the server: the Delete stands and her waiting set is refused and dropped (the known limit): " + JSON.stringify(log));
    else assert.deepStrictEqual(log, { landed, server: ["1 Back squat finished [50,50,50]", "2 Leg curl finished early, 1 of 3 [50]", "3 Calf raise"], afterHerSend: ["1 Back squat finished [50,50,50]", "2 Leg curl, 2 of 3 [50,50]", "3 Calf raise"], queue: [], herPhone: ["1 Back squat finished [50,50,50]", "2 Leg curl, 2 of 3 [50,50]", "3 Calf raise"], macAfter: ["1 Back squat finished [50,50,50]", "2 Leg curl, 2 of 3 [50,50]", "3 Calf raise"] }, "set 1 on the server, set 2 waiting: Leg curl did not come back, or her set 2 did not land on it: " + JSON.stringify(log));
  }
});
