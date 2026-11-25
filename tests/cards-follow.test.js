// v316, the twenty-second check round: the state of the cards on this device (a card opened, the set picked, a note unfolded, a card note half
// written) when a sync brings a workout another device changed. Each card here goes where its first exercise goes (`relabeled`), and a card none
// of whose exercises the server's copy still has goes with its state: an exercise the coach deleted on his iPad left its open card, its Set 3 and a
// half-written note to the exercise that took its number (Save note then wrote the note on that one), and Row taken out of Bench press's superset
// there took the card's open state and its set with it. The coach's own save does the same when it merges the server's copy in (`cloudBackend.set`:
// a conflict, and the read before a write when no stamp is kept): her Start this exercise, or an exercise deleted on his iPad, came in with his save
// and the cards here stayed on the old numbers. A damaged copy of a workout here never stops a sync. The cards themselves are drawn only in
// a browser, so these read the state `relabeled` moves (`cardSets`: the cards opened, the set picked; the note unfolded and the note half written
// move with them, in `remapCardKeys` and `dropCardKeys`). Made-up people only.
// The twenty-third check round: a card's note state (unfolded, half written) follows the exercise its note is on, not the card's first exercise, and
// goes when that exercise no longer takes its card's note; a workout deleted here and brought back by a restore, or new to this page from a sync,
// keeps none of the old numbers' state; after the coach's own save merges new numbers the cards are drawn again, and a card still drawn under his
// finger sends its taps and its note to its own exercise. These are read on the real page (cards-follow-probe.mjs, in its own process).
// Found while those tests were written: such a card's Start this exercise, the glide after its Complete set and its Resume, and the keyboard's
// place after a pick on it read the card's number at the tap too (they took the number it was drawn with: another exercise went ahead, or the
// page and the keyboard's place went to the card that took that number).
// Found while writing those: the keyboard's place after a No to such a pick's question (a No draws nothing again) stays on the card asked from;
// Finish early reads the card's number at Finish & move on (a save landing while its sheet was up cleared another card's set, and the page
// went to the wrong card); and the coach's own Start this exercise claims the whole order (his save merged it one exercise at a time with the
// iPad's: a superset nobody made).
// The twenty-fourth check round (the probe's out.r24): the coach's own save that merges a regrouped superset keeps the note's state with the
// exercise holding the client's note, as a sync does; Delete exercise and Reorder's trash of that exercise take its note's state with it; a
// workout this page takes from another window's waiting queue keeps the objects its cards hold (a weight typed there went nowhere) and moves
// their state; a card whose exercise left the workout under the finger sets nothing on the card that took its number; each of the card's other
// taps reads its number at the tap (twelve could go back to the number as drawn with every test passing); and another account signing in on the
// page takes none of the last account's card state.
// Then the owner's pick "Ask first" (25 Nov 2026): Save note asks "Replace the note written meanwhile?" before it replaces a note the other side
// wrote on that exercise since the box was opened (her note by his own save's merge under his finger, by a sync, her change to the note he is
// editing, his Client view, the coach's note on her phone); Cancel keeps that note, unfolded, and the box; Replace saves; no question when
// nothing changed meanwhile or the texts agree; a regrouped superset keeps the note its box was opened on with the note's exercise.
// The twenty-fifth check round (the probe's out.r25): Save note asks "Save a note deleted meanwhile?" before it brings back a note the other side
// deleted while the box was open; a note that comes on the superset's other exercise under the coach's finger is the card's note, and Save note
// asks before it replaces it; an Edit box emptied over newer words asks one question, "Delete the note written meanwhile?"; Edit on the note above
// a box with words in it keeps them; Delete on a note that changed under the finger quotes the newer words; the question keeps a quoted note's
// lines; Skip and Finish early on a card whose exercise left the workout set nothing on the card that took its number; and three rules of the
// twenty-fourth round that no test caught being undone (what Save note measures against, through a split superset, Delete exercise and a card deleted).
// Found while those tests were written: the note deleted on a superset's second exercise, merged under his finger, still came back unasked.
// The twenty-sixth check round (the probe's out.r26): a change to the note that the coach's own save merges in while a question of the note box is
// up (Delete's "Delete this note?", an emptied box's "Delete this note?", "Replace the note written meanwhile?", "Save a note deleted meanwhile?")
// is asked about again, her newer words quoted, never deleted or replaced unseen; a note she deleted under the question is drawn gone, nothing more asked.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { test, assert, tick } from "./assert.js";
import { makeSupabase } from "./fake-supabase.js";
import { load } from "./load.js";
import { cmpLabel } from "../app/model.js";
const app = await load();
const { fns, maps } = app;
const src = fs.readFileSync(new URL("../app/main.js", import.meta.url), "utf8");
const settle = async () => { const until = Date.now() + 15000; do await tick(5); while ((app.get().inflight > 0 || maps.timers.size) && Date.now() < until); };
const clone = (x) => JSON.parse(JSON.stringify(x));
const C = "2f4a6c8e-1111-4b3d-9e5f-7a9c1e3b5d70", W = "2f4a6c8e-3333-4b3d-9e5f-7a9c1e3b5d70", WA = "2f4a6c8e-5555-4b3d-9e5f-7a9c1e3b5d70", WB = "2f4a6c8e-7777-4b3d-9e5f-7a9c1e3b5d70", AT = "2026-11-10T16:00:00.000Z";   // (WA before WB: a sync reads the workouts in their ids' order)
const JANE = { id: C, name: "Jane Testperson", unit: "lb", email: "jane@x.com" };
let n = 0; const bump = (s) => { s.updated_at = "2026-11-24T14:" + String(10 + Math.floor(n / 50) % 50).padStart(2, "0") + ":" + String(10 + (n++ % 50)).padStart(2, "0") + ".000Z"; };   // the other device's write
const day = (k) => { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + k); return fns.localIso(d); };   // the app's local day (never UTC)
const ex = (id, label, name) => ({ id, label, name, sets: 4, reps: "8", rest: "", tempo: "", weights: [], repsDone: [], setsDone: 0, done: false, note: "" });
const coach = (sb) => { app.reset(); fns.leaveSettings(); app.set({ sb, signedIn: true, clientMode: false, backend: fns.cloudBackend, sessionEmail: "coach@x.com", view: { name: "clients" } }); };
const phone = (sb) => {                                                   // Jane's own phone: her record and her workouts as the server has them now (client_my_data)
  sb.rpcs.client_my_data = async () => ({ clients: [{ id: C, data: clone(sb.tables.ft_clients.get(C).data) }], trainings: [...sb.tables.ft_trainings.values()].filter((t) => t.client_id === C).map((t) => ({ id: t.id, data: clone(t.data), updated_at: t.updated_at })) });
  app.reset(); fns.leaveSettings(); app.set({ sb, signedIn: true, clientMode: true, myClientId: C, backend: fns.clientBackend, sessionEmail: "jane@x.com", view: { name: "client", id: C } });
};
const sync = async () => { await fns.syncDownNow(); await settle(); };
const cardsOf = (id) => { const { openBlocks, setSel } = fns.cardSets(); return { open: [...openBlocks].filter((k) => k.startsWith(id + "/")).map((k) => k.slice(id.length + 1)).sort(), sel: [...setSel].filter(([k]) => k.startsWith(id + "/")).map(([k, v]) => [k.slice(id.length + 1), v]).sort() }; };
const clearCards = () => { const { openBlocks, setSel } = fns.cardSets(); openBlocks.clear(); setSel.clear(); };
const pick = (id, card, set) => fns.cardSets().setSel.set(id + "/" + card, set - 1);   // "Set N of 4" picked on that card (the app counts from 0)
const open = (id, card) => fns.cardSets().openBlocks.add(id + "/" + card);
const said = (rows) => rows.map((r) => r.label + " " + r.name);

for (const who of ["the coach's Mac", "Jane's phone"]) test("an exercise the coach deleted on his iPad takes its card's state with it at the next sync on " + who + " (the twenty-second check round: Leg press's open card and its Set 3 of 4 went to Leg curl, which took its number); Leg curl, now 2, keeps its own Set 2, and Standing calf raise, left alone when Leg extension went from their superset, keeps the card's (open, Set 4), now as 3", async () => {
  const sb = makeSupabase(); let log = {};
  sb.seed("ft_clients", C, JANE);
  sb.seed("ft_trainings", W, { id: W, clientId: C, title: "Legs", date: day(1), createdAt: AT, completedAt: null, skippedAt: null, rows: [ex("sq", "1", "Back squat"), ex("lp", "2", "Leg press"), ex("lc", "3", "Leg curl"), ex("le", "4a", "Leg extension"), ex("cr", "4b", "Standing calf raise")] }, { client_id: C });
  try {
    if (who === "Jane's phone") phone(sb); else coach(sb);
    clearCards(); await sync();
    // Leg curl's set picked before Leg press's: of two cards' states moved onto one number, the one picked last is kept (Leg press's Set 3 over Leg curl's Set 2)
    pick(W, "3", 2); pick(W, "2", 3); open(W, "2"); pick(W, "4", 4); open(W, "4");   // Leg curl on Set 2; Leg press open on Set 3; the superset open on Set 4
    { const s = sb.tables.ft_trainings.get(W); s.data.rows = [ex("sq", "1", "Back squat"), ex("lc", "2", "Leg curl"), ex("cr", "3", "Standing calf raise")]; bump(s); }   // the iPad: Delete exercise on Leg press and on Leg extension (the numbers close up; the calf raise, alone, loses its letter)
    await sync();
    log = { rows: said(maps.trainings.get(W).rows), cards: cardsOf(W) };
  } finally { clearCards(); app.reset(); localStorage.clear(); }
  assert.deepStrictEqual(log.rows, ["1 Back squat", "2 Leg curl", "3 Standing calf raise"], "the iPad's deletions came in: " + JSON.stringify(log));
  assert.deepStrictEqual(log.cards, { open: ["3"], sel: [["2", 1], ["3", 3]] }, "after the sync Leg curl's card (now 2) shows the deleted Leg press's open card or its Set 3, or the calf raise's card lost its own: " + JSON.stringify(log));
});

test("a card's unfolded note and its half-written note go, and move, with its open state and its set picked (dropCardKeys, remapCardKeys: two stores these tests cannot read, as the cards are drawn only in a browser)", () => {
  const body = (name) => { const at = src.indexOf("function " + name + "("), end = src.indexOf("\n  }\n", at); return at < 0 || end < 0 ? "" : src.slice(at, end); };
  for (const [f, wrong] of [["dropCardKeys", "stays behind for the exercise that takes the deleted one's number"], ["remapCardKeys", "stays on the old number when the exercises are renumbered"]]) {
    const b = body(f); assert.ok(b.length > 0 && b.length < 1200, "(" + f + " found in main.js as one function: " + b.length + " characters)");
    for (const store of ["openBlocks", "fullBlocks", "peekBlocks", "openExNotes", "setSel", "cardNoteDraft"]) assert.ok(new RegExp("\\b" + store + "\\b").test(b), f + " leaves out " + store + ": that part of a card's state " + wrong + " (a half-written note was then saved on the wrong exercise)");
  }
});

const push = (sb) => sb.seed("ft_trainings", W, { id: W, clientId: C, title: "Push", date: day(1), createdAt: AT, completedAt: null, skippedAt: null, rows: [ex("bp", "1a", "Bench press"), ex("rw", "1b", "Row"), ex("fl", "2", "Fly")] }, { client_id: C });
test("Row taken out of Bench press's superset on the coach's iPad (1a Bench press, 1b Row, 2 Fly become 1 Bench press, 2 Fly, 3 Row): at the next sync on his Mac card 1's state (open, Set 3 of 4) stays with Bench press, its first exercise, and Fly keeps its Set 2 (the twenty-second check round: card 1's state went to Row's card)", async () => {
  const sb = makeSupabase(); coach(sb); let log = {};
  sb.seed("ft_clients", C, JANE); push(sb);
  try {
    clearCards(); await sync();
    pick(W, "1", 3); open(W, "1"); pick(W, "2", 2);
    { const s = sb.tables.ft_trainings.get(W); s.data.rows = [ex("bp", "1", "Bench press"), ex("fl", "2", "Fly"), ex("rw", "3", "Row")]; bump(s); }   // the iPad: Row's number typed 3 (Bench press, alone, is 1)
    await sync();
    log = { rows: said(maps.trainings.get(W).rows), cards: cardsOf(W) };
  } finally { clearCards(); app.reset(); localStorage.clear(); }
  assert.deepStrictEqual(log.rows, ["1 Bench press", "2 Fly", "3 Row"], "the iPad's numbers came in: " + JSON.stringify(log));
  assert.deepStrictEqual(log.cards, { open: ["1"], sel: [["1", 2], ["2", 1]] }, "Bench press's card 1 lost its open state and its Set 3 to Row's card 3, though Row was only taken out of it: " + JSON.stringify(log));
});

test("a card's state follows its first exercise by number, not by where it lies in the copy here: the iPad's Reorder puts Row first in the superset while the Mac saves the workout's new name (the save takes the iPad's letters into the copy here as it lies, 1b Bench press before 1a Row, not drawn since); then the iPad takes Bench press out: card 1's state stays card 1, Row's, and Fly keeps its Set 2 (the twenty-second check round)", async () => {
  const sb = makeSupabase(); coach(sb); let log = {};
  sb.seed("ft_clients", C, JANE); push(sb);
  try {
    clearCards(); await sync();
    pick(W, "1", 3); open(W, "1"); pick(W, "2", 2);
    { const s = sb.tables.ft_trainings.get(W); s.data.rows.find((r) => r.id === "rw").label = "1a"; s.data.rows.find((r) => r.id === "bp").label = "1b"; bump(s); }   // the iPad: Reorder, Row before Bench press inside the superset
    maps.trainings.get(W).title = "Push B"; fns.scheduleSave("trainings", W); await settle();   // the Mac: the workout's new name, saved over the iPad's copy (its merge takes the iPad's letters)
    log.merged = said(maps.trainings.get(W).rows);
    { const s = sb.tables.ft_trainings.get(W); s.data.rows = [ex("rw", "1", "Row"), ex("fl", "2", "Fly"), ex("bp", "3", "Bench press")]; bump(s); }   // the iPad: Bench press's number typed 3 (Row, alone, is 1)
    await sync();
    log.rows = said(maps.trainings.get(W).rows); log.cards = cardsOf(W);
  } finally { clearCards(); app.reset(); localStorage.clear(); }
  assert.deepStrictEqual(log.rows, ["1 Row", "2 Fly", "3 Bench press"], "the iPad's numbers came in: " + JSON.stringify(log));
  assert.deepStrictEqual(log.cards, { open: ["1"], sel: [["1", 2], ["2", 1]] }, "card 1's open state and its Set 3 went to Bench press's card 3, though in the copy here (merged: as the Mac's save left it) Row was that card's first exercise: " + JSON.stringify(log));
});

for (const [what, odd] of [["its exercises not a list", () => ({ a: 1 })], ["an empty slot among its exercises", (rows) => [null, ...rows.slice(1)]]]) test("a damaged copy of a workout here (" + what + ") never stops a sync: the next workout's newer copy still comes in (Push renamed on the iPad), and the damaged one is the server's again (the twenty-second check round: the sync threw at it, and nothing after it came in)", async () => {
  const sb = makeSupabase(); coach(sb); let log = {};
  sb.seed("ft_clients", C, JANE);
  sb.seed("ft_trainings", WA, { id: WA, clientId: C, title: "Legs", date: day(1), createdAt: AT, completedAt: null, skippedAt: null, rows: [ex("sq", "1", "Back squat"), ex("lc", "2", "Leg curl")] }, { client_id: C });
  sb.seed("ft_trainings", WB, { id: WB, clientId: C, title: "Push", date: day(3), createdAt: AT, completedAt: null, skippedAt: null, rows: [ex("bp", "1", "Bench press")] }, { client_id: C });
  try {
    clearCards(); await sync();
    { const T = maps.trainings.get(WA); T.rows = odd(T.rows); }        // damaged from outside the app (no release writes such a copy), nothing of it to send
    { const s = sb.tables.ft_trainings.get(WB); s.data.title = "Push B"; bump(s); }   // the iPad renames Push
    let ok = null, err = null; try { ok = await fns.syncDownNow(); } catch (e) { err = String((e && e.message) || e); }
    await settle();
    const A = maps.trainings.get(WA);
    log = { ok, err, legs: Array.isArray(A.rows) ? A.rows.map((r) => (r ? r.label + " " + r.name : r)) : A.rows, push: maps.trainings.get(WB).title };
  } finally { clearCards(); app.reset(); localStorage.clear(); }
  assert.deepStrictEqual(log, { ok: true, err: null, legs: ["1 Back squat", "2 Leg curl"], push: "Push B" }, "the sync stopped at the damaged workout, and the iPad's new name for Push never came in: " + JSON.stringify(log));
});

// The coach's own save merging the server's copy in (the twenty-second check round, found while its tests were written): the card state follows
// each card's first exercise as a sync's does (cloudBackend.set: liveKeys before the merge, relabelLive after it, a card whose exercises are all
// gone dropped), through a conflict and through the read before a write with no stamp.
const inOrder = (rows) => said([...rows].sort((p, q) => cmpLabel(p.label, q.label)));   // as the cards show them (a save's merge renumbers the exercises where they lie in the copy)
const rename = async (title) => { maps.trainings.get(W).title = title; fns.scheduleSave("trainings", W); await settle(); };   // the Mac renames the workout (as the name box's input handler does), and its save goes
const refuseStamp = (sb) => sb.setFail({ table: "ft_trainings", op: "update", times: 1, code: "22007", message: "invalid input syntax for type timestamp with time zone" });   // the server refuses the stamp the next save carries: sync.js drops it (a bad stamp must not spoil every retry) and keeps the copy he last read, so the retry has no stamp to send: it reads the server's copy first and merges it against that copy
const quiet = () => { for (const tm of maps.timers.values()) clearTimeout(tm); clearTimeout(app.get().syncTimer); };   // no save or sync left to run into the next test
const relaunch = async (sb) => {                                       // the app closed and opened again: only the device copy and the queue are left, and main.js's own boot takes them back (the account it remembers, with no signal; the cards' state lives in the page and starts afresh)
  const keep = ["fiala.pending.v1", "fiala.trainings.v1"].map((k) => [k, localStorage.getItem(k)]);
  quiet(); app.reset(); clearCards(); for (const [k, v] of keep) if (v != null) localStorage.setItem(k, v);
  localStorage.setItem("fiala.trainings.role", JSON.stringify({ email: "coach@x.com", role: "trainer" }));
  const lib = globalThis.supabase; delete globalThis.supabase;
  try { await fns.boot(); } finally { if (lib !== undefined) globalThis.supabase = lib; }
  app.set({ sb, signedIn: true, clientMode: false, backend: fns.cloudBackend, sessionEmail: "coach@x.com", view: { name: "clients" }, offlineEntry: null });
};
const pushFour = (sb) => sb.seed("ft_trainings", W, { id: W, clientId: C, title: "Push", date: day(1), createdAt: AT, completedAt: null, skippedAt: null, rows: [{ ...ex("bp", "1", "Bench press"), done: true, setsDone: 4, weights: ["100", "100", "100", "100"], repsDone: ["8", "8", "8", "8"] }, ex("rw", "2", "Row"), ex("fl", "3", "Fly"), ex("dp", "4", "Dip")] }, { client_id: C });
const legs = (sb) => sb.seed("ft_trainings", W, { id: W, clientId: C, title: "Legs", date: day(1), createdAt: AT, completedAt: null, skippedAt: null, rows: [ex("sq", "1", "Back squat"), ex("lp", "2", "Leg press"), ex("lc", "3", "Leg curl")] }, { client_id: C });

for (const how of ["meets her newer copy: a conflict", "has no stamp to send, the server having refused the one it carried: it reads the server's copy first, the read before a write"]) test("her Start this exercise on Dip, on the server before the coach's next sync, comes in with his own save as he renames Push (his save " + how + "): Row's Set 2 of 4 follows Row to 3 and Dip's open card follows Dip to 2, as a sync's do (the twenty-second check round: they stayed on the old numbers, Row's Set 2 on Dip's card and Dip's open state on Fly's)", async () => {
  const sb = makeSupabase(); coach(sb); let log = {};
  sb.seed("ft_clients", C, JANE); pushFour(sb);
  try {
    clearCards(); await sync();
    pick(W, "2", 2); open(W, "4");                                       // Row on Set 2; Dip's card open (Bench press done)
    { const s = sb.tables.ft_trainings.get(W); for (const [id, l] of [["dp", "2"], ["rw", "3"], ["fl", "4"]]) s.data.rows.find((r) => r.id === id).label = l; bump(s); }   // Jane's phone: Start this exercise on Dip (Dip next, Row and Fly after it)
    if (how.includes("no stamp")) refuseStamp(sb);
    await rename("Push B");                                              // the Mac renames Push before its next sync: his save meets her copy and merges it in
    const s = sb.tables.ft_trainings.get(W).data;
    log = { here: inOrder(maps.trainings.get(W).rows), server: [s.title, ...inOrder(s.rows)], cards: cardsOf(W) };
  } finally { quiet(); clearCards(); app.reset(); localStorage.clear(); }
  assert.deepStrictEqual([log.here, log.server], [["1 Bench press", "2 Dip", "3 Row", "4 Fly"], ["Push B", "1 Bench press", "2 Dip", "3 Row", "4 Fly"]], "his save did not land with her new numbers in it, here and on the server: " + JSON.stringify(log));
  assert.deepStrictEqual(log.cards, { open: ["2"], sel: [["3", 1]] }, "after his save the cards here stayed on the old numbers (Row's Set 2 on Dip's card, Dip's open state on Fly's): " + JSON.stringify(log));
});

for (const how of ["meets the iPad's newer copy: a conflict", "waited through a relaunch with no signal and goes after the first sync once the signal is back", "waited through a relaunch with no signal and goes before the first sync once the signal is back", "has no stamp to send, the server having refused the one it carried: it reads the server's copy first, the read before a write"]) test("Leg press deleted on the coach's iPad reaches his Mac with his own save as he renames Legs (his save " + how + "): its open card and its Set 3 of 4 go with it, and Leg curl, now 2, keeps its own Set 2 (the twenty-second check round: Leg curl's card took Leg press's open state and its Set 3)", async () => {
  const sb = makeSupabase(); coach(sb); let log = {};
  sb.seed("ft_clients", C, JANE); legs(sb);
  const ipad = () => { const s = sb.tables.ft_trainings.get(W); s.data.rows = [ex("sq", "1", "Back squat"), ex("lc", "2", "Leg curl")]; bump(s); };   // the iPad: Delete exercise on Leg press (the numbers close up)
  const cards = () => { pick(W, "3", 2); pick(W, "2", 3); open(W, "2"); };   // Leg curl on Set 2, then Leg press open on Set 3 (of two cards' states moved onto one number, the one picked last is kept)
  try {
    clearCards(); await sync();
    if (how.includes("relaunch")) {
      sb.setFail({ times: 100000, message: "Failed to fetch" });          // no signal from here on
      await rename("Legs B");                                           // queued, with its stamp and the copy he read (a relaunch takes both back: a conflict once it goes)
      await relaunch(sb); ipad(); cards();                              // the app opened again, still with no signal; the iPad deletes Leg press meanwhile; he opens Legs' cards
      sb.setFail(null); app.set({ offline: false });                    // the signal back
      if (how.includes("after the first sync")) await sync(); else { fns.flushOne("trainings", W); await settle(); }   // a sync, then the queue it flushes; or his waiting save first
    } else {
      cards(); ipad();
      if (how.includes("no stamp")) refuseStamp(sb);
      await rename("Legs B");                                           // the Mac renames Legs before its next sync: his save meets the iPad's copy and merges it in
    }
    const s = sb.tables.ft_trainings.get(W).data;
    log = { here: inOrder(maps.trainings.get(W).rows), server: [s.title, ...inOrder(s.rows)], cards: cardsOf(W) };
  } finally { quiet(); clearCards(); app.reset(); localStorage.clear(); }
  assert.deepStrictEqual([log.here, log.server], [["1 Back squat", "2 Leg curl"], ["Legs B", "1 Back squat", "2 Leg curl"]], "his save did not land with the iPad's deletion in it, here and on the server: " + JSON.stringify(log));
  assert.deepStrictEqual(log.cards, { open: [], sel: [["2", 1]] }, "after his save Leg curl's card (now 2) showed the deleted Leg press's open state or its Set 3, or lost its own Set 2: " + JSON.stringify(log));
});

// ---------- the twenty-third check round ----------
for (const via of ["a sync", "the Mac's own save (a conflict)"]) test("Back squat taken out of the superset 1a Back squat, 1b Lunge on the coach's iPad (1 Lunge, 2 Back squat, 3 Fly), reaching his Mac by " + via + ": card 1's open state and its Set 3 follow Back squat, the card's first exercise in the copy here, to card 2, and Fly's Set 2 follows Fly to 3 (the twenty-third check round: taken from the incoming copy, the card's first exercise was Lunge, and card 1's state stayed on Lunge's card)", async () => {
  const sb = makeSupabase(); coach(sb); let log = {};
  sb.seed("ft_clients", C, JANE);
  sb.seed("ft_trainings", W, { id: W, clientId: C, title: "Legs", date: day(1), createdAt: AT, completedAt: null, skippedAt: null, rows: [ex("sq", "1a", "Back squat"), ex("lu", "1b", "Lunge"), ex("fl", "2", "Fly")] }, { client_id: C });
  try {
    clearCards(); await sync();
    open(W, "1"); pick(W, "1", 3); pick(W, "2", 2);                     // the superset open on Set 3; Fly on Set 2
    { const s = sb.tables.ft_trainings.get(W); s.data.rows = [ex("lu", "1", "Lunge"), ex("sq", "2", "Back squat"), ex("fl", "3", "Fly")]; bump(s); }   // the iPad: Back squat's number typed 2 (Lunge, alone, is 1)
    if (via === "a sync") await sync(); else await rename("Legs B");   // the Mac renames Legs before its next sync: his save meets the iPad's copy and merges it in
    log = { rows: inOrder(maps.trainings.get(W).rows), cards: cardsOf(W) };
  } finally { quiet(); clearCards(); app.reset(); localStorage.clear(); }
  assert.deepStrictEqual(log.rows, ["1 Lunge", "2 Back squat", "3 Fly"], "the iPad's numbers came in: " + JSON.stringify(log));
  assert.deepStrictEqual(log.cards, { open: ["2"], sel: [["2", 2], ["3", 1]] }, "card 1's open state and its Set 3 stayed on Lunge's card (1) instead of following Back squat to 2, or Fly lost its Set 2: " + JSON.stringify(log));
});

const legsAhead = (sb) => { const s = sb.tables.ft_trainings.get(W); s.data.rows = [ex("sq", "1", "Back squat"), { ...ex("lc", "2", "Leg curl"), setsDone: 1, weights: ["50"], repsDone: ["8"] }, ex("lp", "3", "Leg press")]; bump(s); };   // Jane's Start this exercise on Leg curl, its first set logged
for (const how of ["the coach's Delete here", "a Delete on his iPad, seen by a sync"]) test("Legs deleted by mistake (" + how + ") and brought back by a restore of a backup from before Leg curl went ahead (1 Back squat, 2 Leg press, 3 Leg curl) keeps none of its cards' state from before the delete: no card open, no set picked (the twenty-third check round: the open card and the sets stayed on the old numbers, Leg curl's card showing Leg press's open card on Set 4, and Leg press's Leg curl's Set 2)", async () => {
  const sb = makeSupabase(); coach(sb); let log = {};
  sb.seed("ft_clients", C, JANE); legs(sb);
  try {
    clearCards(); await sync();
    const backup = clone(fns.backupData());                              // made before Leg curl went ahead
    legsAhead(sb); await sync();
    open(W, "3"); pick(W, "3", 4); pick(W, "2", 2);                     // Leg press's card (3) open on Set 4; Leg curl (2) on Set 2
    log.before = cardsOf(W);
    if (how === "the coach's Delete here") { app.set({ view: { name: "training", id: W } }); fns.deleteTraining(W); await settle(); }   // Delete workout (its question answered)
    else { sb.tables.ft_trainings.delete(W); await sync(); }
    log.deleted = !maps.trainings.has(W) && !sb.tables.ft_trainings.has(W);
    fns.applyRestore(fns.planRestore(clone(backup))); await settle();   // Restore, tapped
    log.rows = said(maps.trainings.get(W).rows); log.cards = cardsOf(W);
  } finally { quiet(); clearCards(); app.reset(); localStorage.clear(); }
  assert.deepStrictEqual([log.before, log.deleted], [{ open: ["3"], sel: [["2", 1], ["3", 3]] }, true], "(setup) Leg press's card open on Set 4 and Leg curl on Set 2, then Legs deleted here and on the server: " + JSON.stringify(log));
  assert.deepStrictEqual(log.rows, ["1 Back squat", "2 Leg press", "3 Leg curl"], "the backup's copy came back: " + JSON.stringify(log));
  assert.deepStrictEqual(log.cards, { open: [], sel: [] }, "the restored Legs shows the cards' state from before the delete on the old numbers (now other exercises'): " + JSON.stringify(log));
});

test("Legs deleted on the coach's iPad and brought back there by its own restore, with the backup's numbers (1 Back squat, 2 Leg press, 3 Leg curl), reaches his Mac's sync as a workout new to this page: it keeps none of the cards' state from before the delete (the twenty-third check round: Leg curl's card showed Leg press's open card on Set 4)", async () => {
  const sb = makeSupabase(); coach(sb); let log = {};
  sb.seed("ft_clients", C, JANE); legs(sb);
  const before = clone(sb.tables.ft_trainings.get(W).data);              // the copy the iPad's backup holds
  try {
    clearCards(); await sync();
    legsAhead(sb); await sync();
    open(W, "3"); pick(W, "3", 4); pick(W, "2", 2);
    sb.tables.ft_trainings.delete(W); await sync();                      // the iPad's Delete workout, seen by a sync here
    log.gone = !maps.trainings.has(W);
    sb.seed("ft_trainings", W, before, { client_id: C }); bump(sb.tables.ft_trainings.get(W));   // the iPad's restore writes it back
    await sync();
    log.rows = said(maps.trainings.get(W).rows); log.cards = cardsOf(W);
  } finally { quiet(); clearCards(); app.reset(); localStorage.clear(); }
  assert.deepStrictEqual([log.gone, log.rows], [true, ["1 Back squat", "2 Leg press", "3 Leg curl"]], "(setup) Legs went at one sync and came back with the backup's numbers at the next: " + JSON.stringify(log));
  assert.deepStrictEqual(log.cards, { open: [], sel: [] }, "Legs, back on the Mac, shows the cards' state from before its delete on the old numbers (now other exercises'): " + JSON.stringify(log));
});

// The real page (cards-follow-probe.mjs): its cards as drawn, and the page's two note stores (the notes unfolded, the notes half written)
const probeAt = path.join(path.dirname(fileURLToPath(import.meta.url)), "cards-follow-probe.mjs");
let probed = null;
const probe = () => { if (!probed) { try { probed = { r: JSON.parse(execFileSync(process.execPath, [probeAt], { encoding: "utf8", timeout: 120000 }).trim().split("\n").pop()) }; } catch (e) { probed = { e }; } } if (probed.e) throw probed.e; return probed.r; };
const found = (r) => { assert.deepStrictEqual(r.found, { sets: 1, maps: 1, distinct: true }, "the probe could not tell which of main.js's stores keep the notes unfolded and the notes half written (the Set a tap on See note adds to, the Map the typing writes into): " + JSON.stringify(r.found)); assert.deepStrictEqual(r.rejected, [], "a step of the probe threw: " + JSON.stringify(r.rejected)); };
const cardOf = (page, names) => page.find((c) => c.names === names) || {};   // the card drawn with those exercises in it
const boxes = (page) => page.filter((c) => c.composer != null).map((c) => c.names + ": " + c.composer);   // every note box open on the page, with its words
const drawn = (page) => page.map((c) => c.names + (c.set ? " " + c.set : ""));   // the cards in their order, each with the set it is on

test("a half-written edit of Mia's note on a tri-set (2a Leg press, 2b Leg curl holding her note, 2c Calf raise), her note unfolded, stays with Leg curl when the other copy takes Leg press out on its own as 3, by a restore and by a sync on the coach's Mac and by a sync on Mia's phone: Leg curl's card keeps her note unfolded and the box with the words, Leg press's card has neither, and Save note writes the note on Leg curl (the twenty-third check round: the box went to Leg press's card, which had no note, and Save note wrote it there)", () => {
  const r = probe(); found(r);
  const typed = "Knee ok today, sore after set 3";
  for (const p of ["restore", "mac", "phone"]) {
    const o = r.notes["triset " + p], at = "(" + p + ") ";
    assert.ok(o && !o.error, at + "the case did not run: " + (o && o.error));
    assert.deepStrictEqual(o.typed.state, { open: [], sel: {}, notesOpen: ["2"], drafts: { 2: typed } }, at + "(setup) her note unfolded on the tri-set's card, and words added to it in its box: " + JSON.stringify(o.typed));
    const lc = cardOf(o.after.page, "Leg curl+Calf raise"), lp = cardOf(o.after.page, "Leg press");
    assert.deepStrictEqual([lc.key, lc.note, lc.composer, lp.key, lp.note, lp.composer], ["2", "Knee ok today", typed, "3", null, null], at + "after the new numbers Leg curl's card lost her note unfolded or the box with the words, or Leg press's card took them: " + JSON.stringify(o.after.page));
    assert.deepStrictEqual(o.after.state, { open: [], sel: {}, notesOpen: ["2"], drafts: { 2: typed } }, at + "the page keeps the note's state under another card than Leg curl's: " + JSON.stringify(o.after.state));
    const want = ["1 Back squat", "2a Leg curl [" + (p === "phone" ? "client" : "coach") + ": " + typed + "]", "2b Calf raise", "3 Leg press"];
    assert.deepStrictEqual([(o.saved || {}).here, (o.saved || {}).server], [want, want], at + "Save note did not write the note on Leg curl, here and on the server, or wrote it on Leg press: " + JSON.stringify(o.saved));
    if (p === "phone") assert.deepStrictEqual(o.saved.sent, ["lc: " + typed], "her phone sent the note for another exercise than Leg curl: " + JSON.stringify(o.saved.sent));
  }
});

test("two cards merging (2 Bench press and 3 Fly become 2a Bench press, 2b Fly), each with a new note half written, by a restore and by a sync on the coach's Mac: Bench press's words stay in the superset's box and Save note writes them on Bench press; Fly's go, as the superset's note is written on Bench press now (the twenty-third check round: Bench press's words were lost, and Fly's were saved on Bench press)", () => {
  const r = probe(); found(r);
  for (const p of ["restore", "mac"]) {
    const o = r.notes["merge " + p], at = "(" + p + ") ";
    assert.ok(o && !o.error, at + "the case did not run: " + (o && o.error));
    assert.deepStrictEqual(o.typed.state.drafts, { 2: "Bench: shoulder ok", 3: "Fly: elbow pinch" }, at + "(setup) a note half written on each card: " + JSON.stringify(o.typed));
    assert.deepStrictEqual(boxes(o.after.page), ["Bench press+Fly: Bench: shoulder ok"], at + "after the merge the superset's box does not hold Bench press's words alone (Fly's took their place, or Bench press's were lost): " + JSON.stringify(o.after.page));
    assert.deepStrictEqual(o.after.state.drafts, { 2: "Bench: shoulder ok" }, at + "Fly's half-written note, which no exercise takes now, is still kept by the page: " + JSON.stringify(o.after.state));
    const want = ["1 Back squat", "2a Bench press [coach: Bench: shoulder ok]", "2b Fly"];
    assert.deepStrictEqual([(o.saved || {}).here, (o.saved || {}).server], [want, want], at + "Save note did not write Bench press's words on Bench press, here and on the server: " + JSON.stringify(o.saved));
  }
});

test("an exercise moved between supersets (2a Bench press, 2b Row, 3a Fly, 3b Curl, with Row and Fly swapped) by a restore and by a sync on the coach's Mac: the new note half written on Fly's card goes, as Fly is now second in Bench press's superset, whose note is written on Bench press; no box opens on either card (the twenty-third check round: the words went to Bench press's card, and Save note wrote them on Bench press)", () => {
  const r = probe(); found(r);
  for (const p of ["restore", "mac"]) {
    const o = r.notes["swap " + p], at = "(" + p + ") ";
    assert.ok(o && !o.error, at + "the case did not run: " + (o && o.error));
    assert.deepStrictEqual(o.typed.state.drafts, { 3: "Fly: left elbow pinches" }, at + "(setup) a note half written on Fly's card: " + JSON.stringify(o.typed));
    assert.deepStrictEqual([boxes(o.after.page), o.after.state.drafts, o.after.here], [[], {}, ["1 Back squat", "2a Bench press", "2b Fly", "3a Row", "3b Curl"]], at + "after the swap Fly's half-written note is still kept, or a box with it opened on a card: " + JSON.stringify(o.after));
  }
});

test("a note arriving by a sync on the superset's other exercise (Mia's on Leg curl, at the coach's Mac; the coach's, on Mia's phone) makes the superset's note that one: the new note half written for Leg press, its first, goes, and the note that came stays as it was (the twenty-third check round: the box stayed, and Save note wrote its words over the note that came)", () => {
  const r = probe(); found(r);
  for (const [p, by, note, typed] of [["mac", "client", "Knee ok today", "Leg press: felt easy today"], ["phone", "coach", "Keep the knee soft", "Felt easy today"]]) {
    const o = r.notes["arrive " + p], at = "(" + p + ") ";
    assert.ok(o && !o.error, at + "the case did not run: " + (o && o.error));
    assert.deepStrictEqual(o.typed.state.drafts, { 2: typed }, at + "(setup) a new note half written on the superset: " + JSON.stringify(o.typed));
    assert.deepStrictEqual([boxes(o.after.page), o.after.state.drafts, cardOf(o.after.page, "Leg press+Leg curl").button], [[], {}, "See note"], at + "after the note came the half-written one is still kept, or its box is open over the note that came: " + JSON.stringify(o.after));
    assert.deepStrictEqual(o.after.here, ["1 Back squat", "2a Leg press", "2b Leg curl [" + by + ": " + note + "]"], at + "the note that came is not on Leg curl as it came: " + JSON.stringify(o.after.here));
  }
});

test("her Start this exercise on Leg curl (2 Leg curl, 3 Leg press), on the server before the coach's next sync, comes in with his own save as he renames Legs: with no finger in the cards they are drawn again at once in her order, and Set 2 tapped on Leg press's card lands on Leg press (the twenty-third check round: the cards kept the old order until the next sync, up to a minute)", () => {
  const o = probe().live.drawn;
  assert.ok(o && !o.error, "the case did not run: " + (o && o.error));
  assert.deepStrictEqual(o.landed.here, ["1 Back squat", "2 Leg curl", "3 Leg press"], "(setup) his save landed with her numbers in it: " + JSON.stringify(o.landed));
  assert.deepStrictEqual(o.landed.page.map((c) => c.key + " " + c.names), ["1 Back squat", "2 Leg curl", "3 Leg press"], "as his save landed the cards were not drawn again in her order: " + JSON.stringify(o.landed.page));
  assert.deepStrictEqual(drawn(o.tapped.page), ["Back squat Set 3 of 3", "Leg curl Set 1 of 3", "Leg press Set 2 of 3"], "Set 2 tapped on Leg press's card did not put Leg press on Set 2: " + JSON.stringify(o.tapped));
});

test("a set picked on a card still drawn under the coach's typing finger, after his save (a weight typed into that card) merged her Start this exercise, goes to that card's own exercise: Set 2 on Leg press's card when Leg curl went ahead, Set 4 on Back squat's when Romanian deadlift went ahead (the twenty-third check round: the set went to the exercise that took the card's old number, and Leg curl showed Set 2 of 3, Romanian deadlift Set 3 of 3)", () => {
  const r = probe();
  for (const [name, here0, still, after, sel] of [
    ["leg press", ["1 Back squat", "2 Leg curl", "3 Leg press"], ["Back squat", "Leg press", "Leg curl"], ["Back squat Set 3 of 3", "Leg curl Set 1 of 3", "Leg press Set 2 of 3"], { 3: 1 }],
    ["back squat", ["1 Romanian deadlift", "2 Back squat", "3 Walking lunge"], ["Back squat", "Romanian deadlift", "Walking lunge"], ["Romanian deadlift Set 1 of 3", "Back squat Set 4 of 4", "Walking lunge Set 1 of 3"], { 2: 3 }]]) {
    const o = r.live["set " + name], at = "(" + name + ") ";
    assert.ok(o && !o.error, at + "the case did not run: " + (o && o.error));
    assert.deepStrictEqual([o.typed, o.landed.here, o.landed.page.map((c) => c.names)], ["100", here0, still], at + "(setup) his weight typed, his save landed with her numbers, and the cards still drawn as before under his finger: " + JSON.stringify(o.landed));
    assert.deepStrictEqual([drawn(o.tapped.page), o.tapped.state.sel], [after, sel], at + "the set tapped on the card did not go to its own exercise: " + JSON.stringify(o.tapped));
  }
});

test("Complete set on Leg press's card still drawn under the coach's finger, after his save merged her Start this exercise on Leg curl, logs Leg press's set and leaves Leg curl's Set 2 as it was (the twenty-third check round: it cleared Leg curl's set, which went back to Set 1)", () => {
  const o = probe().live.complete;
  assert.ok(o && !o.error, "the case did not run: " + (o && o.error));
  assert.deepStrictEqual([o.landed.state.sel, o.landed.page.map((c) => c.names)], [{ 2: 1 }, ["Back squat", "Leg press", "Leg curl"]], "(setup) Leg curl's Set 2 under its new number, the cards still drawn as before: " + JSON.stringify(o.landed));
  assert.deepStrictEqual([drawn(o.after.page), o.after.state.sel], [["Back squat Set 3 of 3", "Leg curl Set 2 of 3", "Leg press Set 2 of 3"], { 2: 1 }], "Complete set on Leg press's card took Leg curl's Set 2 away, or did not move Leg press on: " + JSON.stringify(o.after));
  assert.deepStrictEqual([o.after.legPress.setsDone, o.after.legPress.weights[0]], [1, "100"], "Leg press's first set was not logged with his weight: " + JSON.stringify(o.after.legPress));
});

test("a finished card still drawn under the coach's finger opens for its own exercise: the iPad deletes Back squat (Leg press, done, becomes 1), his weight typed into Leg curl's card merges that in, and Leg press's card, still drawn as 2, tapped open is open when the cards are drawn again (the twenty-third check round: the tap opened the number Leg curl took, and Leg press stayed folded)", () => {
  const o = probe().live.opened;
  assert.ok(o && !o.error, "the case did not run: " + (o && o.error));
  assert.deepStrictEqual([o.landed.here, o.landed.page.length], [["1 Leg press", "2 Leg curl", "3 Calf raise"], 4], "(setup) his save landed with the iPad's deletion, the four cards still drawn as before: " + JSON.stringify(o.landed));
  assert.deepStrictEqual([cardOf(o.after.page, "Leg press").key, cardOf(o.after.page, "Leg press").open, o.after.state.open], ["1", true, ["1"]], "Leg press's finished card, tapped open, is not open once the cards are drawn again: " + JSON.stringify(o.after));
});

test("a card note the coach writes across his own save's merge of her Start this exercise stays with its exercise: written on after the merge and then left, the whole note waits in Leg press's box (Back squat's, when Romanian deadlift went ahead); Save note writes it on that exercise and leaves no box open; Discard leaves none (the twenty-third check round: the words after the merge went into the box of the exercise that took the old number, and the older half came back in a box of its own after Save note or Discard)", () => {
  const r = probe(); found(r);
  for (const [name, ex0, saved] of [["leg press", "Leg press", ["1 Back squat", "2 Leg curl", "3 Leg press [coach: Knees out today]"]], ["back squat", "Back squat", ["1 Romanian deadlift", "2 Back squat [coach: Knees out today]", "3 Walking lunge"]]]) for (const end of name === "leg press" ? ["save", "leave", "discard"] : ["save", "leave"]) {
    const o = r.live["note " + name + " " + end], at = "(" + name + ", " + end + ") ";
    assert.ok(o && !o.error, at + "the case did not run: " + (o && o.error));
    assert.deepStrictEqual([o.typed1, o.typed2, cardOf(o.landed.page, ex0).composer], ["Knees out", "Knees out today", "Knees out"], at + "(setup) the note written as his save went, and on after it merged her numbers, in the box still drawn: " + JSON.stringify(o.landed));
    if (end === "leave") assert.deepStrictEqual([boxes(o.after.page), o.after.here], [[ex0 + ": Knees out today"], saved.map((x) => x.replace(" [coach: Knees out today]", ""))], at + "left without Save note, the whole note does not wait in " + ex0 + "'s box alone (its words went to another exercise's box, or its older half stayed): " + JSON.stringify(o.after));
    else {
      if (end === "discard") assert.deepStrictEqual(o.asked, { open: true, title: "Discard what you wrote?" }, at + "Discard did not ask first: " + JSON.stringify(o.asked));
      const want = end === "save" ? saved : saved.map((x) => x.replace(" [coach: Knees out today]", ""));
      assert.deepStrictEqual([boxes(o.after.page), o.after.state.drafts, o.after.here, o.after.server], [[], {}, want, want], at + "after " + (end === "save" ? "Save note" : "Discard") + " a box came back with the note's older half, or the note is not where it was written (here and on the server): " + JSON.stringify(o.after));
    }
  }
});

test("a new note the coach writes for Leg press, the first of the superset 2a Leg press, 2b Leg curl, as his save brings in Mia's note on Leg curl (the superset's note is hers now): what he writes after the merge is kept off her note, no box opens on the superset when the cards are drawn again, and her note stays as it was (the twenty-third check round: his words waited in the superset's box, where Save note would write them over hers)", () => {
  const o = probe().live.gone;
  assert.ok(o && !o.error, "the case did not run: " + (o && o.error));
  const hers = ["1 Back squat", "2a Leg press", "2b Leg curl [client: Knee ok today]"];
  assert.deepStrictEqual([o.typed1, o.typed2, o.landed.here], ["Knees", "Knees out", hers], "(setup) his note written as the save went and on after it brought her note in: " + JSON.stringify(o.landed));
  assert.deepStrictEqual([boxes(o.after.page), cardOf(o.after.page, "Leg press+Leg curl").button], [[], "See note"], "his words wait in the superset's box, over her note: " + JSON.stringify(o.after));
  assert.deepStrictEqual([o.after.here, o.after.server], [hers, hers], "her note on Leg curl did not stay as it was: " + JSON.stringify(o.after));
});

test("Legs deleted (by the coach here, or on his iPad) and brought back (by his restore, or by the iPad's own, seen by a sync) keeps no note state of before either: opened again, it shows no note unfolded and no box with the words he had added to Mia's note on Leg curl, now card 3 (the twenty-third check round: the coach's note on Leg press, now card 2, came up unfolded, and after the iPad's delete and restore its box held the words meant for Mia's note)", () => {
  const r = probe(); found(r);
  for (const how of ["here", "ipad"]) {
    const o = r.deleted[how], at = how === "here" ? "(deleted here, then his restore) " : "(deleted on the iPad, then its own restore) ";
    assert.ok(o && !o.error, at + "the case did not run: " + (o && o.error));
    assert.deepStrictEqual(o.before.state, { open: [], sel: {}, notesOpen: ["2"], drafts: { 2: "Knee ok today, sore after set 3" } }, at + "(setup) Mia's note unfolded on Leg curl's card (2), and words added to it in its box: " + JSON.stringify(o.before));
    assert.deepStrictEqual(o.after.here, ["1 Back squat", "2 Leg press [coach: Keep the knee soft]", "3 Leg curl [client: Knee ok today]"], at + "Legs did not come back with the backup's numbers and notes: " + JSON.stringify(o.after.here));
    assert.deepStrictEqual([o.after.page.map((c) => c.names + " " + c.button), boxes(o.after.page), o.after.state], [["Back squat Add note", "Leg press See note", "Leg curl See note"], [], { open: [], sel: {}, notesOpen: [], drafts: {} }], at + "Legs, opened again, shows a note unfolded or a box with words from before its delete, on the exercise that took the old number: " + JSON.stringify(o.after));
  }
});

// ---------- found while the twenty-third check round's tests were written: a card's own number, read at the tap ----------
const stale = (page) => page.map((c) => c.key + " " + c.names);   // the cards as drawn, each with the number it was drawn with
test("Start this exercise on Leg curl's card, still drawn as 3 under the coach's finger in his Client view after his own save merged the iPad's order (Calf raise put before Leg curl: 3 Calf raise, 4 Leg curl), moves Leg curl ahead: 2 Leg curl, 3 Leg press, 4 Calf raise, here and on the server, and the page glides to Leg curl's card (found while the twenty-third check round's tests were written: Calf raise went ahead instead, the exercise that took Leg curl's old number)", () => {
  const o = probe().atTap.start;
  assert.ok(o && !o.error, "the case did not run: " + (o && o.error));
  assert.deepStrictEqual([o.peeked.client, o.peeked.start, o.typed, o.landed.here, stale(o.landed.page), o.landed.start, o.tapped], [true, true, "100", ["1 Back squat", "2 Leg press", "3 Calf raise", "4 Leg curl"], ["1 Back squat", "2 Leg press", "3 Leg curl", "4 Calf raise"], true, true], "(setup) Leg curl opened for a look in his Client view, his weight typed into Leg press, his save landed with the iPad's order, and the cards still drawn as before with Start this exercise on Leg curl's: " + JSON.stringify([o.peeked, o.landed]));
  const want = ["1 Back squat", "2 Leg curl", "3 Leg press", "4 Calf raise"];
  assert.deepStrictEqual([o.after.here, o.after.server, o.after.page.map((c) => c.names)], [want, want, ["Back squat", "Leg curl", "Leg press", "Calf raise"]], "Start this exercise on Leg curl's card did not put Leg curl next, here and on the server and on the page (another exercise went ahead): " + JSON.stringify(o.after));
  assert.strictEqual(o.glide.card, "Leg curl", "after Start this exercise the page did not glide to Leg curl's card: " + JSON.stringify(o.glide));
});

test("Complete set on Leg press's card, still drawn as 2 under the coach's finger after his save merged her Start this exercise on Leg curl (2 Leg curl, 3 Leg press), logs Leg press's set and glides the page to Leg press's card, now 3 (found while the twenty-third check round's tests were written: the page glided to card 2, Leg curl's now)", () => {
  const o = probe().atTap.complete;
  assert.ok(o && !o.error, "the case did not run: " + (o && o.error));
  assert.deepStrictEqual([o.typed, o.landed.here, stale(o.landed.page), o.completed], ["100", ["1 Back squat", "2 Leg curl", "3 Leg press"], ["1 Back squat", "2 Leg press", "3 Leg curl"], true], "(setup) his weight typed into Leg press, his save landed with her numbers, and the cards still drawn as before: " + JSON.stringify(o.landed));
  assert.deepStrictEqual([drawn(o.after.page), o.after.sets["Leg press"].done], [["Back squat Set 3 of 3", "Leg curl Set 1 of 3", "Leg press Set 2 of 3"], 1], "Complete set did not log Leg press's first set, or the cards were not drawn again in her order: " + JSON.stringify(o.after));
  assert.strictEqual(o.glide.card, "Leg press", "after Complete set the page glided to another card than Leg press's: " + JSON.stringify(o.glide));
});

test("Resume this exercise on Leg press's finished-early card (1 of 3 sets), still drawn as 2 under the coach's finger after his save merged the iPad's deletion of Back squat (1 Leg press, 2 Leg curl, 3 Calf raise), opens Leg press's last two sets again and glides the page to its card, now 1 (found while the twenty-third check round's tests were written: the page glided to card 2, Leg curl's now)", () => {
  const o = probe().atTap.resume;
  assert.ok(o && !o.error, "the case did not run: " + (o && o.error));
  assert.deepStrictEqual([o.typed, o.landed.here, o.landed.page.length, cardOf(o.landed.page, "Leg press").key], ["50", ["1 Leg press", "2 Leg curl", "3 Calf raise"], 4, "2"], "(setup) his weight typed into Leg curl, his save landed with the iPad's deletion, and the four cards still drawn as before, Leg press's as 2: " + JSON.stringify(o.landed));
  assert.deepStrictEqual([o.opened.summary, o.opened.resume, o.resumed], [true, "Resume this exercise", true], "(setup) Leg press's finished card opened shows its sets and Resume this exercise: " + JSON.stringify(o.opened));
  assert.deepStrictEqual([o.after.sets["Leg press"], o.after.page.map((c) => c.names)], [{ sets: 3, done: 1, finished: false }, ["Leg press", "Leg curl", "Calf raise"]], "Resume did not open Leg press's sets again (its logged set kept), or the cards were not drawn again with the new numbers: " + JSON.stringify(o.after));
  assert.strictEqual(o.glide.card, "Leg press", "after Resume the page glided to another card than Leg press's: " + JSON.stringify(o.glide));
});

test("from the keyboard, 4 sets picked from the sets count's list on Leg curl's card, still drawn as 3 under the coach's finger after his save merged the iPad's order (3 Calf raise, 4 Leg curl), gives Leg curl 4 sets and puts his place back on Leg curl's count, its card drawn again as 4 (found while the twenty-third check round's tests were written: his place landed on Calf raise's count, the card that took number 3)", () => {
  const o = probe().atTap.count;
  assert.ok(o && !o.error, "the case did not run: " + (o && o.error));
  assert.deepStrictEqual([o.typed, o.landed.here, stale(o.landed.page), o.menu], ["100", ["1 Back squat", "2 Leg press", "3 Calf raise", "4 Leg curl"], ["1 Back squat", "2 Leg press", "3 Leg curl", "4 Calf raise"], { open: true, at: "3 sets", row: true }], "(setup) his save landed with the iPad's order, the cards still drawn as before, and Leg curl's list of sets opened from the keyboard on 3 sets: " + JSON.stringify([o.landed, o.menu]));
  assert.deepStrictEqual([o.after.sets["Leg curl"].sets, o.after.sets["Calf raise"].sets, drawn(o.after.page)], [4, 3, ["Back squat Set 3 of 3", "Leg press Set 1 of 3", "Calf raise Set 1 of 3", "Leg curl Set 1 of 4"]], "4 sets did not go to Leg curl alone, or the cards were not drawn again in the iPad's order: " + JSON.stringify(o.after));
  assert.deepStrictEqual(o.after.focus, { card: "Leg curl", on: "tr-count", drawn: true }, "after the pick the keyboard's place is not on Leg curl's count: " + JSON.stringify(o.after.focus));
});

test("from the keyboard, Mark set 1 as not done on Leg curl's card (its first set logged, Set 1 picked), still drawn as 3 under the coach's finger after his save merged the iPad's order (3 Calf raise, 4 Leg curl), asks first and, answered, takes Leg curl's set back and puts his place on Leg curl's Complete set, its card drawn again as 4 (found while the twenty-third check round's tests were written: his place landed on Calf raise's Complete set)", () => {
  const o = probe().atTap.undo;
  assert.ok(o && !o.error, "the case did not run: " + (o && o.error));
  assert.deepStrictEqual([o.typed, o.landed.here, stale(o.landed.page), o.landed.undo, o.asked], ["100", ["1 Back squat", "2 Leg press", "3 Calf raise", "4 Leg curl"], ["1 Back squat", "2 Leg press", "3 Leg curl", "4 Calf raise"], "Mark set 1 as not done", { open: true, title: "Mark set 1 as not done?" }], "(setup) his save landed with the iPad's order, the cards still drawn as before with Mark set 1 as not done on Leg curl's, and its question came up: " + JSON.stringify([o.landed, o.asked]));
  assert.deepStrictEqual([o.after.sets["Leg curl"], o.after.page.map((c) => c.names)], [{ sets: 3, done: 0, finished: false }, ["Back squat", "Leg press", "Calf raise", "Leg curl"]], "Leg curl's first set was not taken back, or the cards were not drawn again in the iPad's order: " + JSON.stringify(o.after));
  assert.deepStrictEqual(o.after.focus, { card: "Leg curl", on: "complete", drawn: true }, "after the answer the keyboard's place is not on Leg curl's Complete set: " + JSON.stringify(o.after.focus));
});

// ---------- found while those were written: a No that draws nothing again, Finish early under new numbers, the coach's own Start this exercise ----------
const ipadOrder = ["1 Back squat", "2 Leg press", "3 Calf raise", "4 Leg curl"], drawnBefore = ["1 Back squat", "2 Leg press", "3 Leg curl", "4 Calf raise"], curlFirst = ["1 Back squat", "2 Leg curl", "3 Leg press", "4 Calf raise"];   // the iPad's order (Calf raise before Leg curl); the cards as drawn before it, each with its number then; Leg curl put next (her Start this exercise, or his)
test("from the keyboard, No to \"Drop set 3?\" (2 sets picked from the sets count's list on Leg curl's card, 2 of its 3 sets done and set 3's weight typed ahead), its card still drawn as 3 under the coach's finger after his save merged the iPad's order (3 Calf raise, 4 Leg curl), keeps Leg curl's 3 sets and all it logged, and puts his place back on Leg curl's count, on the card he asked from (found while the twenty-third check round's tests were written: an answer that draws nothing again put his place on Calf raise's count, the card drawn as 4, the number Leg curl holds now)", () => {
  const o = probe().atTap.countNo;
  assert.ok(o && !o.error, "the case did not run: " + (o && o.error));
  assert.deepStrictEqual([o.typed, o.landed.here, stale(o.landed.page), o.menu, o.asked], ["100", ipadOrder, drawnBefore, { open: true, at: "3 sets", row: true }, { open: true, title: "Drop set 3?" }], "(setup) his save landed with the iPad's order, the cards still drawn as before, Leg curl's list of sets opened from the keyboard on 3 sets, and 2 sets asked first: " + JSON.stringify([o.landed, o.menu, o.asked]));
  assert.deepStrictEqual([o.after.sets["Leg curl"], o.after.legCurl], [{ sets: 3, done: 2, finished: false }, { weights: ["50", "50", "50"], reps: ["8", "8", ""] }], "No took a set from Leg curl, or something it logged: " + JSON.stringify(o.after));
  assert.deepStrictEqual(stale(o.after.page), drawnBefore, "(setup) No drew nothing again: Leg curl's card is still the one drawn as 3: " + JSON.stringify(o.after.page));
  assert.deepStrictEqual([o.after.focus, o.after.shown], [{ card: "Leg curl", on: "tr-count", drawn: true }, true], "after No the keyboard's place is not on Leg curl's count: " + JSON.stringify([o.after.focus, o.after.shown]));
});

test("from the keyboard, No to \"Mark set 1 as not done?\" on Leg curl's card (its first set logged, Set 1 picked), still drawn as 3 under the coach's finger after his save merged the iPad's order (3 Calf raise, 4 Leg curl), keeps Leg curl's set and puts his place back on Leg curl's Mark set 1 as not done, the button he pressed (found while the twenty-third check round's tests were written: his place went to Calf raise's card, drawn as 4, onto its Mark set as not done, which is hidden there)", () => {
  const o = probe().atTap.undoNo;
  assert.ok(o && !o.error, "the case did not run: " + (o && o.error));
  assert.deepStrictEqual([o.typed, o.landed.here, stale(o.landed.page), o.landed.undo, o.asked], ["100", ipadOrder, drawnBefore, "Mark set 1 as not done", { open: true, title: "Mark set 1 as not done?" }], "(setup) his save landed with the iPad's order, the cards still drawn as before with Mark set 1 as not done on Leg curl's, and its question came up: " + JSON.stringify([o.landed, o.asked]));
  assert.deepStrictEqual([o.after.sets["Leg curl"], o.after.legCurl], [{ sets: 3, done: 1, finished: false }, { weights: ["50", "", ""], reps: ["8", "", ""] }], "No took Leg curl's first set back: " + JSON.stringify(o.after));
  assert.deepStrictEqual(stale(o.after.page), drawnBefore, "(setup) No drew nothing again: Leg curl's card is still the one drawn as 3: " + JSON.stringify(o.after.page));
  assert.deepStrictEqual([o.after.focus, o.after.shown], [{ card: "Leg curl", on: "undo-set", drawn: true }, true], "after No the keyboard's place is not on Leg curl's Mark set 1 as not done, or is on a hidden button: " + JSON.stringify([o.after.focus, o.after.shown]));
});

test("Finish early on Leg press's card (a set logged), still drawn as 2 under the coach's finger after his save merged her Start this exercise on Leg curl (2 Leg curl, 3 Leg press), then Finish & move on: Leg press is finished with its one set, the cards are drawn again in her order, and the page moves on to the card after Leg press's, Calf raise's (found while the twenty-third check round's tests were written: the page went to card 2, Leg curl's now)", () => {
  const o = probe().atTap.finishEarly;
  assert.ok(o && !o.error, "the case did not run: " + (o && o.error));
  assert.deepStrictEqual([o.typed, o.landed.here, stale(o.landed.page), o.button, o.sheet, o.went], ["40", curlFirst, ["1 Back squat", "2 Leg press", "3 Leg curl", "4 Calf raise"], "Finish early", { up: true, go: "Finish & move on" }, true], "(setup) his weight typed into Calf raise, his save landed with her numbers, the cards still drawn as before, and Finish early on Leg press's card brought up its sheet: " + JSON.stringify([o.landed, o.button, o.sheet]));
  assert.deepStrictEqual([o.after.sets["Leg press"], o.after.sets["Leg curl"], o.after.here, o.after.page.map((c) => c.names), o.after.up], [{ sets: 3, done: 1, finished: true }, { sets: 3, done: 0, finished: false }, curlFirst, ["Back squat", "Leg curl", "Leg press", "Calf raise"], false], "Finish & move on did not finish Leg press alone, with its one set, or the cards were not drawn again in her order: " + JSON.stringify(o.after));
  assert.strictEqual(o.glide.card, "Calf raise", "after Finish & move on the page did not move on to Calf raise's card, the one after Leg press's: " + JSON.stringify(o.glide));
});

test("a save landing while the Finish early sheet is up: Leg curl on Set 2, the coach's weight typed into Leg press and Finish early tapped on its card before his save went; the save merges her Start this exercise on Leg curl (2 Leg curl, 3 Leg press) under the sheet; Finish & move on then finishes Leg press, leaves Leg curl on its Set 2, and moves on to the card after Leg press's, Calf raise's (found while the twenty-third check round's tests were written: it cleared Leg curl's Set 2, as Leg curl holds Leg press's old number 2 now, and the page went to Leg curl's card)", () => {
  const o = probe().atTap.finishEarlyMid;
  assert.ok(o && !o.error, "the case did not run: " + (o && o.error));
  assert.deepStrictEqual([o.typed, o.sheet.up, o.sheet.sent, o.sheet.here, o.sheet.state.sel, o.sheet.server], ["100", true, false, drawnBefore, { 3: 1 }, curlFirst], "(setup) Finish early's sheet came up before his save went: his weight not on the server yet, the copy here still in the old order with Leg curl on Set 2 as 3, her numbers waiting on the server: " + JSON.stringify(o.sheet));
  assert.deepStrictEqual([o.landed.up, o.landed.sent, o.landed.here, o.landed.server, o.landed.state.sel, o.landed.same, o.went], [true, true, curlFirst, curlFirst, { 2: 1 }, true, true], "(setup) his save landed while the sheet was up, her numbers merged into the same copy here, and Leg curl's Set 2 followed it to 2: " + JSON.stringify(o.landed));
  assert.deepStrictEqual([o.after.sets["Leg press"], o.after.sets["Leg curl"], o.after.state.sel, cardOf(o.after.page, "Leg curl").set, o.after.page.map((c) => c.names)], [{ sets: 3, done: 1, finished: true }, { sets: 3, done: 0, finished: false }, { 2: 1 }, "Set 2 of 3", ["Back squat", "Leg curl", "Leg press", "Calf raise"]], "Finish & move on cleared Leg curl's Set 2 (Leg curl took Leg press's old number), or did not finish Leg press: " + JSON.stringify(o.after));
  assert.strictEqual(o.glide.card, "Calf raise", "after Finish & move on the page did not move on to Calf raise's card, the one after Leg press's: " + JSON.stringify(o.glide));
});

test("the coach's own Start this exercise in his Client view claims the whole order, as his Reorder does: the iPad puts Calf raise before Leg curl (3 Calf raise, 4 Leg curl) while his finger rests in Leg press's weight box, and a sync passes over Legs; then Start this exercise on Leg curl's card gives 1 Back squat, 2 Leg curl, 3 Leg press, 4 Calf raise here, on the server and on the page, once his save has met the iPad's copy (found while the twenty-third check round's tests were written: his save merged the numbers one exercise at a time, 2 Leg curl, 3a Leg press, 3b Calf raise, a superset nobody made)", () => {
  const o = probe().atTap.syncStart;
  assert.ok(o && !o.error, "the case did not run: " + (o && o.error));
  assert.deepStrictEqual([o.landed.client, o.landed.finger, o.landed.same, o.landed.here, stale(o.landed.page), o.landed.server, o.landed.start, o.tapped], [true, true, true, drawnBefore, drawnBefore, ipadOrder, true, true], "(setup) in his Client view, his finger in Leg press's weight box, a sync passed over Legs (the iPad's order waiting on the server), and Start this exercise was on Leg curl's card: " + JSON.stringify(o.landed));
  assert.deepStrictEqual([o.after.here, o.after.server, stale(o.after.page)], [curlFirst, curlFirst, curlFirst], "Start this exercise on Leg curl did not give 1 Back squat, 2 Leg curl, 3 Leg press, 4 Calf raise here, on the server and on the page (his save merged its numbers one exercise at a time with the iPad's): " + JSON.stringify(o.after));
});

// ---------- the twenty-fourth check round (cards-follow-probe.mjs, out.r24) ----------
const r24 = () => { const r = probe(); found(r); return r.r24; };
const ran = (o, at = "") => assert.ok(o && !o.error, at + "the case did not run: " + (o && o.error));
const edited = "Knee ok today, sore after set 3";                       // Mia's note on Leg curl, "Knee ok today", with the coach's words added in its box
test("the coach's own save that merges the iPad's regrouping of a tri-set (Leg press taken out of 2a Leg press, 2b Leg curl holding Mia's note, 2c Calf raise, on its own as 3) keeps his half-written edit of her note with Leg curl, as a sync does: Leg curl's card keeps her note unfolded and the box with his words, Leg press's card has neither, and Save note writes on Leg curl; with his finger still in the box as the save lands, only Leg curl's card has a box, with all his words (the twenty-fourth check round: the box went to Leg press's card and Save note wrote her note's words there as a coach note on Leg press; with the finger in the box, a second box with the older half)", () => {
  const n = r24().note, want = ["1 Back squat", "2a Leg curl [coach: " + edited + "]", "2b Calf raise", "3 Leg press"];
  for (const how of ["save", "sync"]) {
    const o = n["ipad " + how], at = how === "save" ? "(his rename's save) " : "(a sync) ";
    ran(o, at);
    assert.deepStrictEqual([o.typed, o.after.here], [edited, ["1 Back squat", "2a Leg curl [client: Knee ok today]", "2b Calf raise", "3 Leg press"]], at + "(setup) his words added to her note in its box, and the iPad's numbers came in: " + JSON.stringify([o.typed, o.after.here]));
    const lc = cardOf(o.after.page, "Leg curl+Calf raise"), lp = cardOf(o.after.page, "Leg press");
    assert.deepStrictEqual([lc.key, lc.note, lc.composer, lp.key, lp.note, lp.composer], ["2", "Knee ok today", edited, "3", null, null], at + "after the iPad's numbers came in, Leg curl's card lost her note unfolded or the box with his words, or Leg press's card took them: " + JSON.stringify(o.after.page));
    assert.deepStrictEqual([o.after.state.notesOpen, o.after.state.drafts], [["2"], { 2: edited }], at + "the page keeps the note's state under another card than Leg curl's: " + JSON.stringify(o.after.state));
    assert.deepStrictEqual([o.saved.card, o.saved.here, o.saved.server], ["Leg curl+Calf raise", want, want], at + "Save note did not write his words on Leg curl, here and on the server (or wrote them on Leg press): " + JSON.stringify(o.saved));
  }
  const f = n["ipad finger"], at = "(his finger in the box) ";
  ran(f, at);
  assert.deepStrictEqual([f.typed1, f.typed2, f.landed.here], ["Knee ok today, sore", edited, ["1 Back squat", "2a Leg curl [client: Knee ok today]", "2b Calf raise", "3 Leg press"]], at + "(setup) his words typed as the save went, and on after it landed with the iPad's numbers: " + JSON.stringify([f.typed1, f.typed2, f.landed]));
  assert.deepStrictEqual([boxes(f.after.page), f.after.state.notesOpen, f.after.state.drafts], [["Leg curl+Calf raise: " + edited], ["2"], { 2: edited }], at + "after a tap elsewhere and a sync, the page does not show one box, on Leg curl's card, with all his words (the older half went to a box on Leg press's card): " + JSON.stringify(f.after));
});

test("with one coach device: Mia's Start this exercise on Calf raise (it goes ahead of the superset 2a Leg press, 2b Leg curl holding her note, now 3a, 3b), merged by his own save as he renames Legs or as he logs a weight on Calf raise, keeps his half-written edit of her note with Leg curl's card, now 3: her note unfolded and the box with his words; Save note writes on Leg curl (the twenty-fourth check round: his edit was dropped and her note folded, with no box anywhere, where a sync keeps them)", () => {
  const n = r24().note, want = ["1 Back squat", "2 Calf raise", "3a Leg press", "3b Leg curl [coach: " + edited + "]"];
  for (const how of ["rename", "weight"]) {
    const o = n["start " + how], at = how === "rename" ? "(his rename's save) " : "(his save of a weight typed into Calf raise) ";
    ran(o, at);
    assert.deepStrictEqual([o.typed, o.after.here, how === "weight" ? o.w : "40"], [edited, ["1 Back squat", "2 Calf raise", "3a Leg press", "3b Leg curl [client: Knee ok today]"], "40"], at + "(setup) his words added to her note, and her numbers came in with his save: " + JSON.stringify([o.typed, o.w, o.after.here]));
    const ss = cardOf(o.after.page, "Leg press+Leg curl");
    assert.deepStrictEqual([ss.key, ss.note, ss.composer, boxes(o.after.page)], ["3", "Knee ok today", edited, ["Leg press+Leg curl: " + edited]], at + "the superset's card, now 3, lost her note unfolded or the box with his words: " + JSON.stringify(o.after.page));
    assert.deepStrictEqual([o.after.state.notesOpen, o.after.state.drafts], [["3"], { 3: edited }], at + "the page dropped the note's state, or keeps it under another card: " + JSON.stringify(o.after.state));
    assert.deepStrictEqual([o.saved.card, o.saved.here, o.saved.server], ["Leg press+Leg curl", want, want], at + "Save note did not write his words on Leg curl, here and on the server: " + JSON.stringify(o.saved));
  }
});

test("Delete exercise on Leg curl (its \"…\", then Delete), or Reorder's trash on it, when Leg curl holds Mia's note on the superset 2a Leg press, 2b Leg curl and the coach had unfolded it and added words to it in its box: the note's state goes with Leg curl, so Leg press, alone as 2 now, shows no box and no note unfolded, and nothing of her note is written on Leg press; a note of hers that comes on Leg press later arrives folded (the twenty-fourth check round: Leg press's card showed the box with her note's words, and Save note wrote them on Leg press as a coach note; her later note on it came up unfolded)", () => {
  const d = r24().del, none = { open: [], sel: {}, notesOpen: [], drafts: {} }, left = ["1 Back squat", "2 Leg press", "3 Calf raise"];
  for (const [name, at] of [["note's own", "(Delete exercise) "], ["trash", "(Reorder's trash) "]]) {
    const o = d[name];
    ran(o, at);
    assert.deepStrictEqual([o.typed, o.asked, o.after.here], [edited, { open: true, title: "Delete Leg curl?" }, left], at + "(setup) his words added to her note, Delete Leg curl asked first, and Leg curl went: " + JSON.stringify([o.typed, o.asked, o.after.here]));
    if (name === "trash") assert.deepStrictEqual([o.on, o.deleted], [true, true], at + "(setup) Reorder was on, and its trash deleted Leg curl: " + JSON.stringify([o.on, o.deleted]));
    assert.deepStrictEqual([boxes(o.after.page), cardOf(o.after.page, "Leg press").button, o.after.state], [[], "Add note", none], at + "after Leg curl went, Leg press's card shows a box with her note's words, or the page keeps the note's state for card 2: " + JSON.stringify(o.after));
    assert.strictEqual(o.saved.card, null, at + "a box was left open on the page, and Save note wrote her note's words on Leg press: " + JSON.stringify(o.saved));
  }
  assert.deepStrictEqual(d["note's own"].after.server, left, "(Delete exercise) the server's copy holds something of her note on Leg press: " + JSON.stringify(d["note's own"].after.server));
  const s = d.seen, at = "(her note only unfolded) ";
  ran(s, at);
  assert.deepStrictEqual([s.asked, s.after.here, s.after.state], [{ open: true, title: "Delete Leg curl?" }, left, none], at + "Leg curl's deletion left her note's unfolded state on card 2, Leg press's now: " + JSON.stringify(s.after));
  const lp = cardOf(s.later.page, "Leg press");
  assert.deepStrictEqual([s.later.here, lp.button, lp.note], [["1 Back squat", "2 Leg press [client: Left knee clicks]", "3 Calf raise"], "See note", null], at + "her later note on Leg press came up unfolded, as if the coach had opened it: " + JSON.stringify(s.later));
});

test("Delete exercise on another exercise than the one holding Mia's note keeps the coach's half-written edit of it with Leg curl, her note unfolded: Leg press, the superset's first (Leg curl now alone as 2), or Back squat, another card (the superset now 1); Save note writes on Leg curl (controls for the twenty-fourth check round's rule: only the exercise holding the card's note takes its state with it)", () => {
  const d = r24().del;
  for (const [name, key, names, want] of [["card's first", "2", "Leg curl", ["1 Back squat", "2 Leg curl [coach: " + edited + "]", "3 Calf raise"]], ["another card", "1", "Leg press+Leg curl", ["1a Leg press", "1b Leg curl [coach: " + edited + "]", "2 Calf raise"]]]) {
    const o = d[name], at = "(" + name + " deleted) ";
    ran(o, at);
    const c = cardOf(o.after.page, names);
    assert.deepStrictEqual([c.key, c.note, c.composer, boxes(o.after.page).length], [key, "Knee ok today", edited, 1], at + "Leg curl's card lost her note unfolded or the box with his words: " + JSON.stringify(o.after.page));
    assert.deepStrictEqual([o.saved.card, o.saved.here, o.saved.server], [names, want, want], at + "Save note did not write his words on Leg curl, here and on the server: " + JSON.stringify(o.saved));
  }
});

test("two windows of one browser on Legs: window B, its caret in Romanian deadlift's weight box, takes window A's waiting copy of Legs (A's Complete set on Back squat, 185, its save still on its way); 135 then typed on in B's box reaches B's copy and B's save, and the box shows 135 when the page is drawn again (the twenty-fourth check round: B took A's copy as a new record while its cards still held the old one, so the 135 went nowhere: B's save sent the copy without it, and the box came back empty while the bar said Saved)", () => {
  const o = r24().tabs.typed;
  ran(o);
  assert.deepStrictEqual([o.taken.caret, o.taken.squat, o.typed.box], [true, { done: 1, weights: ["185"] }, "135"], "(setup) B's caret stayed in the box, B took A's set on Back squat, and 135 was typed: " + JSON.stringify([o.taken, o.typed]));
  assert.deepStrictEqual([o.saved.here, o.saved.server, o.saved.squat], [{ done: 0, weights: ["135"] }, { done: 0, weights: ["135"] }, { done: 1, weights: ["185"] }], "the 135 typed in B did not reach B's copy of Legs and the server, beside A's set on Back squat: " + JSON.stringify(o.saved));
  assert.deepStrictEqual([o.after.box, o.after.here, o.after.server], ["135", { done: 0, weights: ["135"] }, { done: 0, weights: ["135"] }], "after a sync and the page drawn again, Romanian deadlift's weight box no longer shows 135: " + JSON.stringify(o.after));
});

test("two windows of one browser on Legs: window B has Set 3 picked on Romanian deadlift (card 2) and its caret in that card; window A deletes Back squat (the numbers close up) and B takes A's waiting copy: drawn again, B shows Set 3 on Romanian deadlift, card 1 now, and Walking lunge, card 2 now, on its own Set 1 (the twenty-fourth check round: the set stayed on number 2, and Walking lunge showed Set 3 of 3)", () => {
  const o = r24().tabs.deleted;
  ran(o);
  assert.deepStrictEqual([drawn(o.before.page), o.before.state.sel, o.taken.here], [["Back squat Set 1 of 4", "Romanian deadlift Set 3 of 3", "Walking lunge Set 1 of 3"], { 2: 2 }, ["1 Romanian deadlift", "2 Walking lunge"]], "(setup) Set 3 on Romanian deadlift's card, then A's copy without Back squat taken: " + JSON.stringify([o.before, o.taken]));
  assert.deepStrictEqual([drawn(o.after.page), o.after.state.sel], [["Romanian deadlift Set 3 of 3", "Walking lunge Set 1 of 3"], { 1: 2 }], "the set picked on Romanian deadlift did not follow it to card 1 (Walking lunge took it): " + JSON.stringify(o.after));
});

test("a card still drawn under the coach's finger after his save merged the iPad's deletion of its exercise (Leg press, 2; Leg curl, a set logged, takes number 2) sets nothing on the card that took its number: Set 3 tapped on Leg press's card leaves Leg curl on its Set 2, and Complete set there leaves Leg curl's Set 3, picked ahead, as it was; with a superset's first exercise deleted, Set 2 tapped on the card still drawn goes to the exercise left on it (the twenty-fourth check round: the tap read the number 2, and Leg curl went to Set 3 of 3, or lost its Set 3 to Set 2)", () => {
  const g = r24().gone, merged = ["1 Back squat", "2 Leg curl", "3 Calf raise"];
  for (const [what, set, sel] of [["set", "Set 2 of 3", 1], ["complete", "Set 3 of 3", 2]]) {
    const o = g[what], at = what === "set" ? "(Set 3 tapped) " : "(Complete set) ";
    ran(o, at);
    assert.deepStrictEqual([o.typed, o.landed.here, o.landed.drawn, cardOf(o.landed.page, "Leg curl").set, o.landed.state.sel], ["40", merged, true, set, { 2: sel }], at + "(setup) his save landed with the iPad's deletion, Leg press's card still drawn, and Leg curl's pick moved with it to 2: " + JSON.stringify(o.landed));
    assert.deepStrictEqual([o.tapped, drawn(o.after.page), o.after.state.sel["2"]], [true, ["Back squat Set 3 of 3", "Leg curl " + set, "Calf raise Set 1 of 3"], sel], at + "the tap on Leg press's card changed the set of Leg curl, the card that took Leg press's number: " + JSON.stringify(o.after));
  }
  const s = g.superset, at = "(the superset's first deleted) ";
  ran(s, at);
  assert.deepStrictEqual([s.landed.here, s.tapped, drawn(s.after.page), s.after.state.sel], [merged, true, ["Back squat Set 3 of 3", "Leg curl Set 2 of 3", "Calf raise Set 1 of 3"], { 2: 1 }], at + "Set 2 tapped on the card still drawn did not go to Leg curl, the exercise left on it: " + JSON.stringify(s.after));
});

// R24-TW-2: each of the card's other taps on a card still drawn under his finger after his save merged new numbers reads the card's number at the
// tap. In each case the card that took the tapped card's old number has state of its own (a set picked, a finished card opened, a card opened for a
// look, a note unfolded), so a tap that used the number as drawn shows there. The iPad deletes Back squat (the others move up one) unless it says otherwise.
for (const [name, what, got, want, wrong] of [
  ["count", "4 sets from the sets count's list on Leg curl's card, drawn as 3 (now 2): its own Set 3 pick goes, and Calf raise, now 3, keeps its Set 3", (o) => [o.picked, o.row, o.after.lc, o.after.cr], [{ lc: "Set 3 of 3", cr: "Set 3 of 3" }, true, "Set 2 of 4", "Set 3 of 3"], "the pick cleared Calf raise's Set 3, or kept Leg curl's"],
  ["undo", "Mark set 1 as not done on Leg curl's card, drawn as 3 (now 2), answered: Leg curl is on Set 1, and Calf raise, now 3, keeps its Set 3", (o) => [o.picked, o.button, o.asked, o.after.lc, o.after.cr], [{ lc: "Set 1 of 3", cr: "Set 3 of 3" }, "Mark set 1 as not done", { open: true, title: "Mark sets 1 and 2 as not done?" }, "Set 1 of 3", "Set 3 of 3"], "Calf raise was put on Set 1"],
  ["back", "Back to set 2 on Leg curl's card, drawn as 3 (now 2) and on Set 3 ahead: Leg curl goes back to Set 2, and Calf raise, now 3, keeps its Set 3", (o) => [o.button, o.tapped, o.after.lc, o.after.cr], ["Back to set 2", true, "Set 2 of 3", "Set 3 of 3"], "Calf raise lost its Set 3, or Leg curl did not go back to Set 2"],
  ["finish", "Complete last set on Leg curl's card, drawn as 3 (the iPad put Leg curl before Leg press: Leg curl 2, Leg press 3): Leg press, finished and opened, now 3, stays open", (o) => [o.opened.open, o.landed.lp.open, o.button, o.tapped, o.after.lp.open], [true, true, "Complete last set →", true, true], "Leg press's opened card folded"],
  ["resume", "Resume this exercise on Leg press's finished-early card, drawn as 2 (now 1): Leg press's sets open again, and Leg curl, now 2, keeps its Set 3", (o) => [o.picked, o.button, o.resumed, o.after.lc, o.after.sets["Leg press"]], ["Set 3 of 3", "Resume this exercise", true, "Set 3 of 3", { sets: 3, done: 1, finished: false }], "Leg curl lost its Set 3, or Leg press was not resumed"],
  ["full", "Resume this exercise on Leg press's finished card, drawn as 2 (now 1): its working card opens", (o) => [o.opened, o.button, o.after.lp], [{ open: true, summary: true, peek: false }, "Resume this exercise", { open: true, summary: false, peek: false }], "the summary stayed up, and the tap did nothing"],
  ["chev", "the chevron on Leg press's finished card, drawn as 2 (now 1): it opens, and is still open after the next sync draws the page again", (o) => [o.tapped, o.at.open, o.after.lp.open, o.after.state.open], [true, true, true, ["1"]], "the card folded again at the next drawing"],
  ["peek", "in his Client view, a tap on Calf raise's card still to come, drawn as 4 (now 3): Calf raise opens for a look, and no other card does", (o) => [o.after.client, o.after.cr.peek, o.after.lc.peek, o.after.ca.peek], [true, true, false, false], "another card opened for a look"],
  ["unpeek", "in his Client view, the fold chevron on Calf raise's card opened for a look, drawn as 4 (now 3): it folds", (o) => [o.peeked.peek, o.landed.cr.peek, o.tapped, o.after.cr.peek], [true, true, true, false], "Calf raise did not fold"],
  ["see", "See note on Leg curl's card, drawn as 3 (now 2): Mia's note unfolds at the tap, and stays unfolded after the next sync", (o) => [o.at.shown, o.at.state.notesOpen, o.after.shown], [true, ["2"], true], "her note did not unfold at the tap, or its unfolded state went to another card"],
  ["del", "Delete on Mia's note on Leg curl's card, drawn as 3 (now 2), answered: her note goes from Leg curl, and her note on Calf raise, unfolded, now 3, stays unfolded", (o) => [o.shown, o.button, o.asked, o.after.lc, o.after.cr, o.after.here], [{ lc: true, cr: true }, true, { open: true, title: "Delete this note?" }, false, true, ["1 Leg press", "2 Leg curl", "3 Calf raise [client: Calves tight today]"]], "Calf raise's unfolded note folded"],
]) test("a card still drawn under the coach's finger after his save merged new numbers reads its number at the tap: " + what + " (the twenty-fourth check round: this tap could go back to the number the card was drawn with, and every test still passed)", () => {
  const o = r24().taps[name];
  ran(o);
  assert.deepStrictEqual(got(o), want, wrong + ": " + JSON.stringify(o));
});

// The owner's pick "Ask first" (25 Nov 2026, R24-CRD-3): Save note asks "Replace the note written meanwhile?" (the other side's note in it, Replace
// or Cancel) before it replaces a note written on that exercise since the box was opened; Cancel keeps that note, unfolds it and keeps the box
// with the words in it; Replace saves them. The probe's out.r24.ask, quiet, regroup and box; the note each open box was opened on is main.js's
// cardNoteBase, read as the probe found it (bases: card number -> the note's words, "" for a box opened by Add note).
const ASK = "Replace the note written meanwhile?", HERS_W = "Left knee hurts on the way down", HERS2_W = "Knee hurts now, stopping", HIS_W = "Knees out on the way up", HIS_NOTE = "Keep the knees out";
const baseFound = (r) => { assert.deepStrictEqual(r.foundBase, { maps: 1, distinct: true }, "the probe could not tell which of main.js's stores keeps the note each note box was opened on (the Map an Edit tap writes the card's number and the note's words into): " + JSON.stringify(r.foundBase)); return r; };
const question = (whose, words) => ({ open: true, title: ASK, text: whose + ": “" + words + "”", yes: "Replace", red: true });   // the sheet as it comes up: its title, the other side's note, and its red Replace (Cancel is the sheet's other button)
const says = (c) => (c ? [c.button, c.note, c.composer] : null);       // what a card shows of its note: the button's words, the note unfolded (or null), the box with its words (or null)
const withNote = (by, words) => ["1 Back squat", "2 Leg press" + (by ? " [" + by + ": " + words + "]" : ""), "3 Leg curl"];   // Legs as kept, with the note on Leg press and who wrote it
const kept = { open: [], drafts: {}, bases: {} };                       // nothing of a note box left on the page

test("Save note asks before it replaces Mia's note when it came in with the coach's own save while his finger was still in the box (Add note on an exercise that got a note meanwhile): a weight typed into Leg press, then Add note and his words; her note reaches the server and his weight's save merges it in under his finger, the card still drawn without it; Save note asks \"Replace the note written meanwhile?\" with her words in it; Cancel keeps her note, here and on the server, unfolds it and keeps his box with his words, and Save note once more (her note in view now) writes his words with no second question; Replace writes his note on Leg press, here and on the server (the twenty-fourth check round, the owner's pick \"Ask first\": her note was replaced with no question, and he never saw it)", () => {
  const a = r24().ask;
  for (const reply of ["cancel", "replace"]) {
    const o = a["merge " + reply], at = reply === "cancel" ? "(Cancel) " : "(Replace) ";
    ran(o, at);
    assert.deepStrictEqual([o.w, o.typed, o.landed.finger, says(o.landed.card), o.landed.here, o.landed.server], ["100", HIS_W, true, ["Add note", null, HIS_W], withNote("client", HERS_W), withNote("client", HERS_W)], at + "(setup) his weight and his words typed, and her note merged in by his save under his finger, the card not drawn again: " + JSON.stringify([o.w, o.typed, o.landed]));
    assert.deepStrictEqual(o.asked, question("Mia’s note", HERS_W), at + "Save note did not ask before it replaced Mia's note, or the question does not show her words: " + JSON.stringify(o.asked));
    if (reply === "cancel") {
      assert.deepStrictEqual([says(o.mid.card), o.mid.here], [["Hide note", HERS_W, HIS_W], withNote("client", HERS_W)], at + "Cancel did not keep her note and show it unfolded on Leg press's card, with his box and his words kept: " + JSON.stringify(o.mid));
      assert.deepStrictEqual([o.opened.bases, o.mid.notes.bases], [{ 2: "" }, { 2: HERS_W }], at + "the page did not keep that the box was opened on no note, or after Cancel that her note is the one now in view: " + JSON.stringify([o.opened, o.mid.notes]));
      assert.deepStrictEqual([says(o.after.card), o.after.here, o.after.server], [["Hide note", HERS_W, HIS_W], withNote("client", HERS_W), withNote("client", HERS_W)], at + "after a tap elsewhere and a sync, her note is not kept here and on the server, or his box with his words went: " + JSON.stringify(o.after));
      assert.deepStrictEqual([o.again, o.last.here, o.last.server, o.last.notes], [{ open: false }, withNote("coach", HIS_W), withNote("coach", HIS_W), kept], at + "Save note once more, with her note in view, asked again, or did not write his words on Leg press, here and on the server: " + JSON.stringify([o.again, o.last]));
    } else {
      assert.deepStrictEqual([says(o.mid.card), o.mid.here, o.mid.notes], [["See note", null, null], withNote("coach", HIS_W), kept], at + "Replace did not write his note on Leg press and close the box: " + JSON.stringify(o.mid));
      assert.deepStrictEqual([o.after.here, o.after.server], [withNote("coach", HIS_W), withNote("coach", HIS_W)], at + "his note is not on Leg press on the server after Replace: " + JSON.stringify(o.after));
    }
  }
});

test("Save note asks before it replaces Mia's note when a sync drew it on the card while the coach's box was open (Add note, his words, a tap elsewhere; her note reaches the server; the next sync shows See note and his box): Cancel keeps her note, here and on the server, unfolded, with his box and his words; Replace writes his words on Leg press (the twenty-fourth check round, the owner's pick \"Ask first\": her note was replaced with no question)", () => {
  const a = r24().ask;
  for (const reply of ["cancel", "replace"]) {
    const o = a["sync " + reply], at = reply === "cancel" ? "(Cancel) " : "(Replace) ";
    ran(o, at);
    assert.deepStrictEqual([o.typed, says(o.drawn.card), o.drawn.here], [HIS_W, ["See note", null, HIS_W], withNote("client", HERS_W)], at + "(setup) his words typed, and the sync drew her note on the card, folded, beside his box: " + JSON.stringify([o.typed, o.drawn]));
    assert.deepStrictEqual(o.asked, question("Mia’s note", HERS_W), at + "Save note did not ask before it replaced Mia's note, or the question does not show her words: " + JSON.stringify(o.asked));
    if (reply === "cancel") assert.deepStrictEqual([says(o.mid.card), says(o.after.card), o.after.here, o.after.server, o.after.notes.bases], [["Hide note", HERS_W, HIS_W], ["Hide note", HERS_W, HIS_W], withNote("client", HERS_W), withNote("client", HERS_W), { 2: HERS_W }], at + "Cancel did not keep her note, here and on the server, unfolded, with his box and his words kept: " + JSON.stringify([o.mid, o.after]));
    else assert.deepStrictEqual([says(o.mid.card), o.after.here, o.after.server, o.after.notes], [["See note", null, null], withNote("coach", HIS_W), withNote("coach", HIS_W), kept], at + "Replace did not write his note on Leg press, here and on the server, and close the box: " + JSON.stringify([o.mid, o.after]));
  }
});

test("Save note asks before it replaces the newer words of the note the coach was editing: Edit on Mia's note \"Knee ok today\", his words added, a tap elsewhere; she changes her note to \"Knee hurts now, stopping\" and a sync draws it, or his weight's save merges it under his finger (the card still showing her old words); the question shows her newer words; Cancel keeps them, unfolded, with his box; Replace writes his edit (the twenty-fourth check round, the owner's pick \"Ask first\": his Save wrote over her newer words with no question)", () => {
  const a = r24().ask;
  for (const reply of ["cancel", "replace"]) {
    const o = a["edit " + reply], at = reply === "cancel" ? "(Cancel) " : "(Replace) ";
    ran(o, at);
    assert.deepStrictEqual([o.typed, says(o.drawn.card), o.drawn.here], [edited, ["Hide note", HERS2_W, edited], withNote("client", HERS2_W)], at + "(setup) his words added to her note, and the sync drew her newer words beside his box: " + JSON.stringify([o.typed, o.drawn]));
    assert.deepStrictEqual(o.asked, question("Mia’s note", HERS2_W), at + "Save note did not ask before it replaced her newer words, or the question does not show them: " + JSON.stringify(o.asked));
    assert.deepStrictEqual([o.opened.bases, o.drawn.notes.bases], [{ 2: "Knee ok today" }, { 2: "Knee ok today" }], at + "the page did not keep the note his box was opened on, her old words, through the sync: " + JSON.stringify([o.opened, o.drawn.notes]));
    if (reply === "cancel") assert.deepStrictEqual([says(o.after.card), o.after.here, o.after.server], [["Hide note", HERS2_W, edited], withNote("client", HERS2_W), withNote("client", HERS2_W)], at + "Cancel did not keep her newer words, here and on the server, unfolded, with his box and his words kept: " + JSON.stringify(o.after));
    else assert.deepStrictEqual([says(o.mid.card), o.after.here, o.after.server], [["See note", null, null], withNote("coach", edited), withNote("coach", edited)], at + "Replace did not write his edit on Leg press, here and on the server: " + JSON.stringify([o.mid, o.after]));
  }
  const f = a["edit finger"], at = "(his finger in the box) ";
  ran(f, at);
  assert.deepStrictEqual([f.w, f.typed, f.landed.finger, says(f.landed.card), f.landed.here], ["100", edited, true, ["Hide note", "Knee ok today", edited], withNote("client", HERS2_W)], at + "(setup) his weight and his edit typed, and her newer words merged in by his save under his finger, the card still showing her old words: " + JSON.stringify([f.w, f.typed, f.landed]));
  assert.deepStrictEqual(f.asked, question("Mia’s note", HERS2_W), at + "Save note did not ask before it replaced her newer words, or the question does not show them: " + JSON.stringify(f.asked));
  assert.deepStrictEqual([says(f.mid.card), says(f.after.card), f.after.server], [["Hide note", HERS2_W, edited], ["Hide note", HERS2_W, edited], withNote("client", HERS2_W)], at + "Cancel did not show her newer words unfolded on the card, keep them on the server, and keep his box with his edit: " + JSON.stringify([f.mid, f.after]));
});

test("in the coach's Client view too, Save note asks before it replaces Mia's note that a sync drew on the card while his box was open, and Replace writes his words on Leg press (the twenty-fourth check round, the owner's pick \"Ask first\", both views)", () => {
  const o = r24().ask.preview;
  ran(o);
  assert.deepStrictEqual([o.client, o.typed, says(o.drawn.card), o.drawn.here], [true, HIS_W, ["See note", null, HIS_W], withNote("client", HERS_W)], "(setup) his Client view on, his words typed, and the sync drew her note on the card beside his box: " + JSON.stringify([o.client, o.typed, o.drawn]));
  assert.deepStrictEqual(o.asked, question("Mia’s note", HERS_W), "Save note in his Client view did not ask before it replaced Mia's note: " + JSON.stringify(o.asked));
  assert.deepStrictEqual([o.after.here, o.after.server, o.after.notes], [withNote("coach", HIS_W), withNote("coach", HIS_W), kept], "Replace in his Client view did not write his note on Leg press, here and on the server: " + JSON.stringify(o.after));
});

test("on Mia's phone, Save note asks before it replaces the coach's note that her sync drew while her box was open (Add note and her words; or Edit on her own note \"Left knee hurts\" and her words added, the coach changing the note meanwhile): the question shows \"Coach note\" and his words; Cancel keeps his note, here and on the server, unfolded, with her box and her words, and sends nothing; Replace sends her words as her note (the twenty-fourth check round, the owner's pick \"Ask first\": her Save replaced his note with no question)", () => {
  const a = r24().ask;
  for (const reply of ["cancel", "replace"]) {
    const o = a["phone " + reply], at = reply === "cancel" ? "(Cancel) " : "(Replace) ";
    ran(o, at);
    assert.deepStrictEqual([o.typed, says(o.drawn.card), o.drawn.here], ["Left knee hurts", ["See note", null, "Left knee hurts"], withNote("coach", HIS_NOTE)], at + "(setup) her words typed, and her sync drew the coach's note beside her box: " + JSON.stringify([o.typed, o.drawn]));
    assert.deepStrictEqual(o.asked, question("Coach note", HIS_NOTE), at + "Save note on her phone did not ask before it replaced the coach's note, or the question does not show his words: " + JSON.stringify(o.asked));
    if (reply === "cancel") assert.deepStrictEqual([says(o.after.card), o.after.here, o.after.server, o.sent], [["Hide note", HIS_NOTE, "Left knee hurts"], withNote("coach", HIS_NOTE), withNote("coach", HIS_NOTE), []], at + "Cancel did not keep the coach's note, here and on the server, unfolded, with her box and her words, or her phone sent her note: " + JSON.stringify([o.after, o.sent]));
    else assert.deepStrictEqual([says(o.mid.card), o.sent, o.after.here, o.after.server], [["See note", null, null], ["lp: Left knee hurts"], withNote("client", "Left knee hurts"), withNote("client", "Left knee hurts")], at + "Replace did not send her words as her note on Leg press: " + JSON.stringify([o.mid, o.sent, o.after]));
  }
  const e = a["phone edit"], at = "(Edit on her own note) ";
  ran(e, at);
  assert.deepStrictEqual([e.typed, says(e.drawn.card), e.drawn.here], [HERS_W, ["Hide note", HIS_NOTE, HERS_W], withNote("coach", HIS_NOTE)], at + "(setup) her words added to her own note, and her sync drew the coach's change beside her box: " + JSON.stringify([e.typed, e.drawn]));
  assert.deepStrictEqual(e.asked, question("Coach note", HIS_NOTE), at + "Save note on her phone did not ask before it replaced the coach's change to the note she was editing: " + JSON.stringify(e.asked));
  assert.deepStrictEqual([says(e.after.card), e.after.server, e.sent], [["Hide note", HIS_NOTE, HERS_W], withNote("coach", HIS_NOTE), []], at + "Cancel did not keep the coach's note unfolded, with her box and her words, or her phone sent her note: " + JSON.stringify([e.after, e.sent]));
});

test("Save note asks nothing when the note did not change since the box was opened, or now holds the very words in the box: Add note and a sync that brought nothing new; Edit on Mia's note and a sync that brought her set on Leg curl; her note with the very words he typed (Add note), or changed to the very words of his edit; her note changed and then changed back; each Save writes his words and leaves nothing of the box kept (while the same Add note with her note arriving meanwhile asks)", () => {
  const r = r24(), q = r.quiet, noteWords = (rows) => rows.map((x) => x.replace(/ \[(?:client|coach): /, " ["));   // the note's words on each exercise, whoever wrote them
  assert.deepStrictEqual(r.ask["sync replace"].asked.open, true, "(the contrast) the same Add note with her note arriving meanwhile did not ask: " + JSON.stringify(r.ask["sync replace"].asked));
  for (const [name, typed, drawn, words] of [["nothing add", HIS_W, null, HIS_W], ["nothing edit", edited, withNote("client", "Knee ok today"), edited], ["same add", HERS_W, withNote("client", HERS_W), HERS_W], ["same edit", edited, withNote("client", edited), edited], ["back", edited, withNote("client", "Knee ok today"), edited]]) {
    const o = q[name], at = "(" + name + ") ";
    ran(o, at);
    assert.deepStrictEqual([o.typed, drawn && o.drawn.here], [typed, drawn], at + "(setup) his words typed, and the note as the last sync drew it: " + JSON.stringify([o.typed, o.drawn]));
    assert.deepStrictEqual(o.asked, { open: false }, at + "Save note asked although no other note was written meanwhile, or the other note holds the very words in his box: " + JSON.stringify(o.asked));
    assert.deepStrictEqual([noteWords(o.after.here), noteWords(o.after.server), o.after.notes], [noteWords(withNote("coach", words)), noteWords(withNote("coach", words)), kept], at + "Save note did not write his words on Leg press, here and on the server, or left something of the box kept: " + JSON.stringify(o.after));
  }
  for (const [name, words] of [["nothing add", HIS_W], ["nothing edit", edited], ["back", edited]]) assert.deepStrictEqual(q[name].after.server, withNote("coach", words), "(" + name + ") his words are not his note on Leg press on the server: " + JSON.stringify(q[name].after.server));
  assert.deepStrictEqual(says(q["nothing edit"].drawn.card), ["Hide note", "Knee ok today", edited], "(nothing edit) (setup) the sync drew the card again with her note as it was, beside his box: " + JSON.stringify(q["nothing edit"].drawn));
  assert.deepStrictEqual(q.back.between, withNote("client", HERS2_W), "(back) (setup) her note was changed before it was changed back: " + JSON.stringify(q.back.between));
});

test("a merge that gives the card another number keeps the note its box was opened on with the note's exercise: Edit on Mia's note on Leg curl (2b of 2a Leg press, 2b Leg curl), his words added; her Start this exercise on Calf raise (2 Calf raise, 3a Leg press, 3b Leg curl) with her note changed comes in by his rename's save, by a sync, or by his save under his finger: Save note on the superset's card asks with her newer words; Cancel keeps them, Replace writes his edit on Leg curl; with her note unchanged, Save note asks nothing and writes his edit on Leg curl (the twenty-fourth check round, the owner's pick \"Ask first\")", () => {
  const r = r24(), g = r.regroup, at3 = ["1 Back squat", "2 Calf raise", "3a Leg press"], hers = [...at3, "3b Leg curl [client: " + HERS2_W + "]"], his = [...at3, "3b Leg curl [coach: " + edited + "]"];
  for (const [name, note, reply] of [["save", HERS2_W, "replace"], ["sync", HERS2_W, "cancel"], ["same", "Knee ok today", null]]) {
    const o = g[name], at = "(" + (name === "save" ? "his rename's save" : name === "sync" ? "a sync" : "her note unchanged") + ") ";
    ran(o, at);
    assert.deepStrictEqual([o.typed, o.drawn.card && o.drawn.card.key, o.drawn.card && o.drawn.card.names, says(o.drawn.card), o.drawn.here], [edited, "3", "Leg press+Leg curl", ["Hide note", note, edited], [...at3, "3b Leg curl [client: " + note + "]"]], at + "(setup) his words added to her note on card 2, and her new order drew the superset as card 3 with her note and his box: " + JSON.stringify([o.typed, o.drawn]));
    if (!reply) assert.deepStrictEqual([o.asked, o.after.here, o.after.server], [{ open: false }, his, his], at + "Save note asked although her note did not change, or did not write his edit on Leg curl: " + JSON.stringify([o.asked, o.after]));
    else assert.deepStrictEqual(o.asked, question("Mia’s note", HERS2_W), at + "Save note on the superset's card, now 3, did not ask before it replaced her newer words: " + JSON.stringify(o.asked));
    assert.deepStrictEqual([o.opened.bases, o.drawn.notes.bases], [{ 2: "Knee ok today" }, { 3: "Knee ok today" }], at + "the note his box was opened on did not move with Leg curl from card 2 to card 3: " + JSON.stringify([o.opened, o.drawn.notes]));
    if (!reply) continue;
    if (reply === "cancel") assert.deepStrictEqual([says(o.after.card), o.after.server], [["Hide note", HERS2_W, edited], hers], at + "Cancel did not keep her newer words on Leg curl, unfolded, with his box: " + JSON.stringify(o.after));
    else assert.deepStrictEqual([o.after.here, o.after.server], [his, his], at + "Replace did not write his edit on Leg curl: " + JSON.stringify(o.after));
  }
  const f = g.finger, at = "(his finger in the box) ";
  ran(f, at);
  assert.deepStrictEqual([f.landed.finger, f.landed.card && f.landed.card.key, f.landed.here], [true, "2", hers], at + "(setup) his save merged her new order and her newer words under his finger, the card still drawn as 2: " + JSON.stringify(f.landed));
  assert.deepStrictEqual([f.asked, f.after.server], [question("Mia’s note", HERS2_W), his], at + "Save note on the card still drawn did not ask before it replaced her newer words, or Replace did not write his edit on Leg curl: " + JSON.stringify([f.asked, f.after]));
  assert.deepStrictEqual(f.landed.notes.bases, { 3: "Knee ok today" }, at + "the note his box was opened on did not move with Leg curl to card 3 under his finger: " + JSON.stringify(f.landed.notes));
});

test("the note a box was opened on is kept only while that box is open: Edit tapped on Mia's note and nothing typed, a tap elsewhere, and the next drawing of the page closes the box and keeps nothing for card 2; her note changed after that, Edit opens the box on her newer words and Save note asks nothing (the twenty-fourth check round, the owner's pick \"Ask first\": what Save note measures against belongs to the box on screen)", () => {
  const r = r24(), o = r.box;
  baseFound(r); ran(o);
  assert.deepStrictEqual([says(o.opened.card), o.opened.notes.bases, o.opened.notes.drafts], [["Hide note", "Knee ok today", "Knee ok today"], { 2: "Knee ok today" }, {}], "(setup) Edit opened the box on her note, nothing typed: " + JSON.stringify(o.opened));
  assert.deepStrictEqual([says(o.drawn.card), o.drawn.notes.bases], [["Hide note", "Knee ok today", null], {}], "the page drawn again closed the box but still keeps the note it was opened on for card 2: " + JSON.stringify(o.drawn));
  assert.deepStrictEqual([o.typed, o.reopened.bases, o.asked, o.after.server], [HERS2_W + " (seen)", { 2: HERS2_W }, { open: false }, withNote("coach", HERS2_W + " (seen)")], "Edit on her newer words did not open the box on them, or Save note asked, or did not write his words: " + JSON.stringify([o.typed, o.reopened, o.asked, o.after]));
});

const COACH_DRAFT = "Coach draft: she skips the last rep";
test("another account signing in on this page takes none of the last account's card state: the coach's session ends elsewhere with his rename still to send (the page keeps his work), and Mia signs in with the sign-in form on that page; her Legs shows no card he opened, no note he unfolded, no set he picked and no box with his half-written card note, and nothing of his is sent as her note (the twenty-fourth check round: her card showed his words in its box, and her Save note sent them as her note)", () => {
  const o = r24().switch.Mia;
  ran(o);
  const his = { open: ["1"], sel: { 3: 1 }, notesOpen: ["1"], drafts: { 2: COACH_DRAFT } };
  assert.deepStrictEqual([o.coach, o.typed, o.before.state, o.before.idle], [{ signedIn: true, clientMode: false, has: true }, COACH_DRAFT, his, false], "(setup) the coach signed in through main.js's own boot, opened Back squat and unfolded her note on it, put Leg curl on Set 2, half wrote a note on Leg press, and his rename waits: " + JSON.stringify([o.coach, o.before]));
  assert.deepStrictEqual([o.out.signedIn, o.out.kept, o.out.state], [false, true, his], "(setup) his session ended elsewhere, and the page kept his work and his card state: " + JSON.stringify(o.out));
  assert.deepStrictEqual([o.in.signedIn, o.in.clientMode, o.in.view, o.look], [true, true, "training", "client"], "(setup) Mia signed in on that page and is on Legs, in her own look: " + JSON.stringify([o.in, o.look]));
  assert.deepStrictEqual(o.in.state, { open: [], sel: {}, notesOpen: [], drafts: {} }, "Mia's page keeps the coach's card state (a card he opened, a note he unfolded, a set he picked, his half-written card note): " + JSON.stringify(o.in.state));
  assert.deepStrictEqual(o.page.map((c) => [c.names, c.set, c.open, c.button, c.composer]), [["Back squat", "Set 3 of 3", false, "See note", null], ["Leg press", "Set 1 of 3", false, "Add note", null], ["Leg curl", "Set 1 of 3", false, "Add note", null]], "Mia's Legs shows something of the coach's: Back squat opened, her note unfolded, Leg curl on his Set 2, or his words in Leg press's box: " + JSON.stringify(o.page));
  assert.deepStrictEqual([o.saved.card, o.saved.sent], [null, []], "the coach's half-written card note waited in a box on Mia's page, and her Save note sent it as her note: " + JSON.stringify(o.saved));
});

test("the same account signing in again on this page keeps its half-written card note (a control for the twenty-fourth check round's clear at an account switch): the coach, whose session ended elsewhere with his rename still to send, signs in again with the sign-in form and finds his words in Leg press's box, and Save note writes them on Leg press as his note", () => {
  const o = r24().switch["the coach"];
  ran(o);
  assert.deepStrictEqual([o.out.signedIn, o.out.kept, o.in.signedIn, o.in.clientMode, o.in.view, o.look], [false, true, true, false, "training", "coach"], "(setup) his session ended elsewhere with his work kept, and he signed in again on Legs in his own look: " + JSON.stringify([o.out, o.in, o.look]));
  assert.deepStrictEqual([o.in.state.drafts, boxes(o.page)], [{ 2: COACH_DRAFT }, ["Leg press: " + COACH_DRAFT]], "the coach's half-written card note is gone after he signed in again as himself: " + JSON.stringify([o.in.state, o.page]));
  const want = ["1 Back squat [client: Knee ok today]", "2 Leg press [coach: " + COACH_DRAFT + "]", "3 Leg curl"];
  assert.deepStrictEqual([o.saved.card, o.saved.here, o.saved.server, o.saved.sent], ["Leg press", want, want, []], "Save note did not write his words on Leg press as his note, here and on the server: " + JSON.stringify(o.saved));
});
test("Save note on a box Add note opened empty, nothing typed, after her note came in with his own save (his finger in the box): it closes, asking nothing, and her note stays, here and on the server, unfolded (the twenty-fourth check round, found while testing the owner's \"Ask first\": it asked \"Replace the note written meanwhile?\" and then \"Delete this note?\", and a Delete took her note)", () => {
  const e = r24().empty;
  for (const reply of ["replace", "cancel"]) {
    const o = e[reply];
    assert.deepStrictEqual([o.first.open === true, o.second.open === true], [false, false], "(" + reply + ") a question came up on an empty box: " + JSON.stringify([o.first, o.second]));
    assert.ok(JSON.stringify(o.after.here).includes("Left knee") && JSON.stringify(o.after.server).includes("Left knee"), "(" + reply + ") her note is gone, here or on the server: " + JSON.stringify(o.after));
  }
});


// ---------- the twenty-fifth check round (cards-follow-probe.mjs, out.r25) ----------
// The note box's questions after round 24's "Ask first": a note the other side deleted while the box was open (R25-CRD-1), a note that came on the
// superset's other exercise under the coach's finger (R25-CRD-2), an Edit box emptied over newer words (R25-CRD-4, R25-TW-5), Edit on the note above
// a box with words (R25-CRD-6), Delete on a note that changed under the finger (R25-TW-1), a quoted note's lines (R25-TW-6); Skip and Finish early on
// a card whose exercise left the workout (R25-CRD-5); and three of round 24's rules that every test still passed without (R25-TW-2, -7, -8).
const r25 = () => { const r = probe(); found(r); baseFound(r.r24); return r.r25; };
const DELETED_Q = { open: true, title: "Save a note deleted meanwhile?", text: "This note was deleted after you opened it.", yes: "Save", red: false };   // the sheet as it comes up: its title, its line, and Save in the sheets' purple (a Save loses nothing)
const none = withNote(null);                                             // Legs with no note on Leg press

test("Save note on an edit of Mia's note that she deleted meanwhile asks \"Save a note deleted meanwhile?\" first (\"This note was deleted after you opened it.\", Save or Cancel): See note, Edit and his words, a tap elsewhere; her Delete reaches the coach's Mac and a sync draws the card (Add note, his box beside it); Cancel keeps his words in the box and the note stays deleted, here and on the server, and Save note once more writes his words as his note with no second question; Save writes them at once (the twenty-fifth check round, R25-CRD-1: Save brought her deleted note back, as his, here, on the server and on her phone, with nothing asked)", () => {
  const d = r25().deleted, mine = withNote("coach", edited);
  for (const reply of ["cancel", "save"]) {
    const o = d["sync " + reply], at = "(" + reply + ") ";
    ran(o, at);
    assert.deepStrictEqual([o.typed, o.opened.bases, says(o.drawn.card), o.drawn.here, o.drawn.server], [edited, { 2: "Knee ok today" }, ["Add note", null, edited], none, none], at + "(setup) his words added to her note in its box, then her Delete drawn by the sync, his box still open: " + JSON.stringify([o.typed, o.opened, o.drawn]));
    assert.deepStrictEqual(o.asked, [DELETED_Q], at + "Save note did not ask before it brought back the note she deleted, or asked something else (the twenty-fourth round's \"Replace the note written meanwhile?\" with empty quotes, R25-TW-8, is its question without the check that a note is there): " + JSON.stringify(o.asked));
    if (reply === "save") { assert.deepStrictEqual([says(o.mid.card), o.mid.here, o.after.here, o.after.server, o.after.notes], [["See note", null, null], mine, mine, mine, kept], at + "Save did not write his words as his note on Leg press, here and on the server, and close the box: " + JSON.stringify([o.mid, o.after])); continue; }
    assert.deepStrictEqual([says(o.mid.card), o.mid.here, says(o.after.card), o.after.here, o.after.server], [["Add note", null, edited], none, ["Add note", null, edited], none, none], at + "Cancel did not keep his words in the box, or the note she deleted came back, here or on the server: " + JSON.stringify([o.mid, o.after]));
    assert.deepStrictEqual([o.again, o.last.here, o.last.server, o.last.notes], [[], mine, mine, kept], at + "Save note once more, after Cancel, asked again, or did not write his words as his note: " + JSON.stringify([o.again, o.last]));
    assert.deepStrictEqual(o.after.notes.bases, { 2: "" }, at + "after Cancel the box does not measure against no note (the note she deleted): " + JSON.stringify(o.after.notes));
  }
});

test("Save note asks \"Save a note deleted meanwhile?\" too when her Delete came in with the coach's own save under his finger (a weight typed into Leg press, then See note, Edit and his words, the card still showing her note): Cancel draws the card without the note at once, his box and words kept, and the note stays deleted; on Mia's phone, when the coach deleted her note, her Save note asks the same and her Cancel sends nothing; his own Delete on the note above his box is no \"meanwhile\": Save note then asks nothing and writes his words (the twenty-fifth check round, R25-CRD-1)", () => {
  const d = r25().deleted, f = d.finger, p = d.phone, w = d.own, hers = "Left knee hurts on the way down";
  ran(f, "(under his finger) ");
  assert.deepStrictEqual([f.w, f.typed, f.landed.finger, says(f.landed.card), f.landed.here, f.landed.server], ["100", edited, true, ["Hide note", "Knee ok today", edited], none, none], "(under his finger) (setup) his weight and his words typed, and her Delete merged in by his save, the card still showing her note: " + JSON.stringify([f.w, f.typed, f.landed]));
  assert.deepStrictEqual(f.asked, [DELETED_Q], "(under his finger) Save note did not ask before it brought back the note she deleted: " + JSON.stringify(f.asked));
  assert.deepStrictEqual([says(f.mid.card), f.mid.here, f.mid.server, says(f.after.card), f.after.server], [["Add note", null, edited], none, none, ["Add note", null, edited], none], "(under his finger) after Cancel the card still shows the note she deleted, or his box went, or the note came back: " + JSON.stringify([f.mid, f.after]));
  ran(p, "(her phone) ");
  assert.deepStrictEqual([p.typed, says(p.drawn.card), p.drawn.here], [hers, ["Add note", null, hers], none], "(her phone) (setup) her words added to her own note, and the coach's Delete drawn by her sync, her box still open: " + JSON.stringify([p.typed, p.drawn]));
  assert.deepStrictEqual([p.asked, p.sent, says(p.after.card), p.after.server], [[DELETED_Q], [], ["Add note", null, hers], none], "(her phone) Save note did not ask before it brought back the note the coach deleted, or her Cancel sent it, or her box went: " + JSON.stringify([p.asked, p.sent, p.after]));
  ran(w, "(his own Delete) ");
  assert.deepStrictEqual([w.typed, w.del && w.del.title, says(w.mid.card), w.mid.here], [edited, "Delete this note?", ["Add note", null, edited], none], "(his own Delete) (setup) his words added, then his Delete on her note answered, his box still open: " + JSON.stringify([w.typed, w.del, w.mid]));
  assert.deepStrictEqual([w.asked, w.after.here, w.after.server], [[], withNote("coach", edited), withNote("coach", edited)], "(his own Delete) Save note asked about the note he deleted himself, or did not write his words as his note: " + JSON.stringify([w.asked, w.after]));
});

test("a note that comes on the superset's other exercise under the coach's finger is the card's note, and Save note asks before it replaces it: a weight typed into Leg press, Add note on 2a Leg press, 2b Leg curl and his words; Mia's note on Leg curl comes in with his weight's save, the card still drawn without it; Save note asks \"Replace the note written meanwhile?\" with her words (\"Coach note\" for a note of his own from his iPad); Cancel unfolds her note at once with his box and his words, kept as he types on and after a sync, and her next change asks again; Replace writes his note on Leg curl, so the card keeps one note (the twenty-fifth check round, R25-CRD-2: nothing asked, his note went on Leg press, and the card, his Mac and her phone showed only his)", () => {
  const g = r25().gone, ss = (n) => ["1 Back squat", "2a Leg press", "2b Leg curl" + (n ? " [" + n + "]" : ""), "3 Calf raise"];
  for (const [name, by, whose, words] of [["cancel", "client", "Mia’s note", "Knee ok today"], ["replace", "client", "Mia’s note", "Knee ok today"], ["coach", "coach", "Coach note", HIS_NOTE]]) {
    const o = g[name], at = "(" + name + ") ";
    ran(o, at);
    assert.deepStrictEqual([o.w, o.typed, o.landed.finger, says(o.landed.card), o.landed.here], ["100", "Knees out", true, ["Add note", null, "Knees out"], ss(by + ": " + words)], at + "(setup) his weight and his words typed, and the note on Leg curl merged in by his save under his finger, the card still drawn without it: " + JSON.stringify([o.w, o.typed, o.landed]));
    assert.deepStrictEqual(o.asked, [question(whose, words)], at + "Save note did not ask before it put his note beside the one on Leg curl (which the card would no longer show), or the question does not show that note and who wrote it: " + JSON.stringify(o.asked));
    if (name === "replace") { assert.deepStrictEqual([says(o.mid.card), o.mid.here, o.after.here, o.after.server, o.after.notes], [["See note", null, null], ss("coach: Knees out"), ss("coach: Knees out"), ss("coach: Knees out"), kept], at + "Replace did not write his note on Leg curl (the card's note), here and on the server, or the card was not drawn again with it: " + JSON.stringify([o.mid, o.after])); continue; }
    assert.deepStrictEqual([says(o.mid.card), o.mid.here], [["Hide note", words, "Knees out"], ss(by + ": " + words)], at + "Cancel did not unfold the note on Leg curl at once with his box and his words kept, or changed the note: " + JSON.stringify(o.mid));
    if (name !== "cancel") continue;
    assert.deepStrictEqual([o.typedOn, says(o.after.card), o.after.server], ["Knees out today", ["Hide note", words, "Knees out today"], ss(by + ": " + words)], at + "after Cancel, his words typed on are not kept in the box across a sync, or her note is not kept unfolded: " + JSON.stringify([o.typedOn, o.after]));
    assert.deepStrictEqual([o.again, o.last.here, o.last.server], [[question(whose, HERS2_W)], ss("coach: Knees out today"), ss("coach: Knees out today")], at + "her next change did not make Save note ask again with her newest words, or Replace did not write his words on Leg curl: " + JSON.stringify([o.again, o.last]));
    assert.deepStrictEqual(o.after.notes.bases, { 2: words }, at + "after Cancel the box does not measure against her note, the one he saw: " + JSON.stringify(o.after.notes));
  }
});

test("Save note on an Edit box emptied to delete Mia's note, after her newer words came in with the coach's own save under his finger, asks once: \"Delete the note written meanwhile?\" with her newer words and a red Delete; Delete takes her note, here and on the server, with no second question; Cancel keeps her newer words, unfolded; the same in his Client view (the twenty-fifth check round, R25-CRD-4 and R25-TW-5: it asked \"Replace the note written meanwhile?\", whose Replace deletes, and then \"Delete this note?\")", () => {
  const e = r25().emptied, q = { open: true, title: "Delete the note written meanwhile?", text: "Mia’s note: “" + HERS2_W + "”", yes: "Delete", red: true };
  for (const name of ["delete", "cancel", "client view"]) {
    const o = e[name], at = "(" + name + ") ";
    ran(o, at);
    assert.deepStrictEqual([o.client, o.w, o.emptied, o.landed.finger, says(o.landed.card), o.landed.here], [name === "client view", "100", "", true, ["Hide note", "Knee ok today", ""], withNote("client", HERS2_W)], at + "(setup) his weight typed, the box emptied with his caret in it, and her newer words merged in by his save, the card still showing her old words: " + JSON.stringify([o.client, o.w, o.emptied, o.landed]));
    assert.deepStrictEqual(o.asked, [q], at + "Save note on the emptied box did not ask once, \"Delete the note written meanwhile?\" with her newer words and a red Delete: " + JSON.stringify(o.asked));
    if (name === "cancel") assert.deepStrictEqual([says(o.after.card), o.after.here, o.after.server], [["Hide note", HERS2_W, null], withNote("client", HERS2_W), withNote("client", HERS2_W)], at + "Cancel did not keep her newer words, unfolded, here and on the server: " + JSON.stringify(o.after));
    else assert.deepStrictEqual([o.after.here, o.after.server, o.after.notes], [none, none, kept], at + "Delete did not take her note, here and on the server: " + JSON.stringify(o.after));
  }
});

test("Skip exercise (then Skip), or Finish early (then Finish & move on), on Leg press's card still drawn under the coach's finger after his save merged the iPad's deletion of Leg press (Leg curl, a set logged and picked on Set 3, takes its number 2) leaves Leg curl on Set 3 and the page where it is (the twenty-fifth check round, R25-CRD-5: Leg curl went back to Set 2 of 3 and the page glided to it, as Finish early used the number the card was drawn with)", () => {
  const e = r25().early;
  for (const [name, button, go] of [["skip", "Skip exercise", "Skip"], ["finish", "Finish early", "Finish & move on"]]) {
    const o = e[name], at = "(" + name + ") ";
    ran(o, at);
    assert.deepStrictEqual([o.typed, o.landed.here, o.landed.drawn, cardOf(o.landed.page, "Leg curl").set, o.landed.state.sel, o.button, o.sheet], ["40", ["1 Back squat", "2 Leg curl", "3 Calf raise"], true, "Set 3 of 3", { 2: 2 }, button, { up: true, go }], at + "(setup) the iPad's deletion merged by his save, Leg press's card still drawn, Leg curl's Set 3 moved with it to 2, and the sheet up: " + JSON.stringify([o.typed, o.landed, o.button, o.sheet]));
    assert.deepStrictEqual([o.went, drawn(o.after.page), o.after.state.sel, o.scrolled], [true, ["Back squat Set 3 of 3", "Leg curl Set 3 of 3", "Calf raise Set 1 of 3"], { 2: 2 }, 0], at + "Leg curl, the card that took Leg press's number, lost its Set 3, or the page glided to it: " + JSON.stringify([o.went, o.after, o.glide, o.scrolled]));
  }
});

test("Edit on Mia's note shown above the coach's open box with his words in it keeps his words and puts his caret in the box: Add note and his words, her note by a sync, Save note and Cancel (her note unfolded above his box), then Edit; Save note writes his words as his note, asking nothing; Edit on a box emptied of every word still brings her words into it (the twenty-fifth check round, R25-CRD-6: Edit swapped his words for hers with no question, and Save note then stored her words as a coach note)", () => {
  const r = r25(), o = r.editAfterCancel, c = r.editEmptied;
  ran(o); ran(c, "(an emptied box) ");
  assert.deepStrictEqual([o.typed, o.first, says(o.mid.card)], [HIS_W, [question("Mia’s note", HERS_W)], ["Hide note", HERS_W, HIS_W]], "(setup) his words typed, her note drawn by the sync, Save note asked and Cancel unfolded her note above his box: " + JSON.stringify([o.typed, o.first, o.mid]));
  assert.deepStrictEqual([o.edited, says(o.afterEdit.card), o.afterEdit.notes.drafts, o.afterEdit.finger], [true, ["Hide note", HERS_W, HIS_W], { 2: HIS_W }, true], "Edit swapped his words in the box for her note, or did not put his caret in the box: " + JSON.stringify(o.afterEdit));
  assert.deepStrictEqual([o.second, o.after.here, o.after.server], [[], withNote("coach", HIS_W), withNote("coach", HIS_W)], "Save note after Edit asked, or did not write his words as his note (her words saved as a coach note): " + JSON.stringify([o.second, o.after]));
  assert.deepStrictEqual([c.emptied, c.edited, says(c.afterEdit)], ["", true, ["Hide note", "Knee ok today", "Knee ok today"]], "(an emptied box) Edit no longer brings her words into a box emptied of every word: " + JSON.stringify(c));
});

test("Delete on Mia's note after newer words came in under the coach's finger (her note unfolded, a weight typed into Leg press, her change merged by his weight's save, the card still showing \"Knee ok today\") asks \"Delete the note written meanwhile?\" with her newer words; Delete takes what it quotes, here and on the server; Cancel shows her newer words on the card at once and keeps them; with the card showing her note as it is, Delete asks \"Delete this note?\" as before (the twenty-fifth check round, R25-TW-1: the question never showed her newer words, and Delete took them unseen)", () => {
  const d = r25().del, q = { open: true, title: "Delete the note written meanwhile?", text: "Mia’s note: “" + HERS2_W + "”", yes: "Delete", red: true };
  for (const reply of ["delete", "cancel"]) {
    const o = d[reply], at = "(" + reply + ") ";
    ran(o, at);
    assert.deepStrictEqual([o.w, says(o.landed.card), o.landed.here, o.landed.server], ["100", ["Hide note", "Knee ok today", null], withNote("client", HERS2_W), withNote("client", HERS2_W)], at + "(setup) his weight typed, and her newer words merged in by his save, the card still showing her old words after he left the box: " + JSON.stringify([o.w, o.landed]));
    assert.deepStrictEqual(o.asked, q, at + "Delete did not ask with her newer words, the note it would take: " + JSON.stringify(o.asked));
    if (reply === "delete") assert.deepStrictEqual([says(o.mid.card), o.after.here, o.after.server], [["Add note", null, null], none, none], at + "Delete did not take her note, here and on the server: " + JSON.stringify([o.mid, o.after]));
    else assert.deepStrictEqual([says(o.mid.card), o.after.here, o.after.server], [["Hide note", HERS2_W, null], withNote("client", HERS2_W), withNote("client", HERS2_W)], at + "Cancel left her old words on the card, or did not keep her newer ones: " + JSON.stringify([o.mid, o.after]));
  }
  const p = d.plain; ran(p, "(the card as it is) ");
  assert.deepStrictEqual([says(p.card), p.asked, p.after.server], [["Hide note", HERS2_W, null], { open: true, title: "Delete this note?", text: "It goes from this exercise and from the notes list.", yes: "Delete", red: true }, none], "(the card as it is) Delete no longer asks as it did, or did not take the note: " + JSON.stringify(p));
});

test("the question keeps the lines of the note it quotes, and a long link in it wraps inside the sheet: Mia's note written meanwhile on three lines comes into \"Replace the note written meanwhile?\" with its line breaks, and index.html's #askText keeps them (white-space: pre-line) and breaks a long word anywhere (the twenty-fifth check round, R25-TW-6: her lines ran together, and at 402 a pasted link ran past the sheet's edge)", () => {
  const o = r25().lines, html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
  ran(o);
  assert.deepStrictEqual([o.typed, o.asked], [HIS_W, [question("Mia’s note", "Felt fine on set 2.\n\nStopped after set 3.\nIce at home.")]], "the question does not quote her note with its line breaks: " + JSON.stringify(o));
  assert.ok(html.includes('<p class="lead" id="askText"></p>'), "the question's text is no longer index.html's #askText");
  assert.ok(html.includes("  #askText { white-space: pre-line; overflow-wrap: anywhere; }"), "index.html's #askText rule no longer keeps a quoted note's lines (white-space: pre-line) and breaks a long link inside the sheet (overflow-wrap: anywhere)");
});

test("the iPad splitting the superset (2a Leg press, 2b Leg curl become 2 Leg press, 3 Leg curl, 4 Calf raise) while the coach's edit of Mia's note on Leg curl is open, her note changed meanwhile: the note his box was opened on goes with Leg curl to card 3, by a sync or by his rename's save, and Save note asks \"Replace the note written meanwhile?\" with her newer words; Cancel keeps them (the twenty-fifth check round, R25-TW-2: every test still passed when that note followed the card's first exercise instead, and Save note then wrote over her newer words with no question)", () => {
  const s = r25().split, hers = ["1 Back squat", "2 Leg press", "3 Leg curl [client: " + HERS2_W + "]", "4 Calf raise"];
  for (const how of ["sync", "save"]) {
    const o = s[how], at = how === "sync" ? "(a sync) " : "(his rename's save) ";
    ran(o, at);
    assert.deepStrictEqual([o.typed, o.opened.bases, o.drawn.card && o.drawn.card.key, says(o.drawn.card), o.drawn.here], [edited, { 2: "Knee ok today" }, "3", ["Hide note", HERS2_W, edited], hers], at + "(setup) his words added to her note on card 2, then the split and her newer words drew Leg curl as card 3 with his box: " + JSON.stringify([o.typed, o.opened, o.drawn]));
    assert.deepStrictEqual([o.drawn.notes.bases, o.asked], [{ 3: "Knee ok today" }, [question("Mia’s note", HERS2_W)]], at + "the note his box was opened on did not go with Leg curl to card 3, or Save note did not ask before it replaced her newer words: " + JSON.stringify([o.drawn.notes, o.asked]));
    assert.deepStrictEqual([o.after.here, o.after.server], [hers, hers], at + "Cancel did not keep her newer words, here and on the server: " + JSON.stringify(o.after));
  }
});

test("Delete exercise on Leg curl (2b, with a note of its own) keeps the coach's half-written edit of the superset's note, Mia's on Leg press (2a): his box and his words stay on Leg press's card, now 2, and Save note writes them on Leg press (the twenty-fifth check round, R25-TW-7: every test still passed when Delete exercise on an exercise with any note took the card's note state, and his words were lost)", () => {
  const o = r25().renumber, want = ["1 Back squat", "2 Leg press [coach: " + edited + "]", "3 Calf raise"];
  ran(o);
  assert.deepStrictEqual([o.typed, o.asked0, o.after.here], [edited, { open: true, title: "Delete Leg curl?" }, ["1 Back squat", "2 Leg press [client: Knee ok today]", "3 Calf raise"]], "(setup) his words added to her note on Leg press, and Delete Leg curl asked first and done: " + JSON.stringify([o.typed, o.asked0, o.after.here]));
  assert.deepStrictEqual([says(o.after.card), o.after.notes.drafts, o.after.notes.bases], [["Hide note", "Knee ok today", edited], { 2: edited }, { 2: "Knee ok today" }], "Leg curl's deletion took the box with his words, or her note unfolded, from Leg press's card: " + JSON.stringify(o.after));
  assert.deepStrictEqual([o.asked, o.last.here, o.last.server], [[], want, want], "Save note asked, or did not write his words on Leg press, here and on the server: " + JSON.stringify([o.asked, o.last]));
});

test("two note boxes open and the second card deleted: Edit on Mia's note on Leg curl (3) with his words, then Add note on Leg press (2) with words; Delete exercise on Leg press: Leg curl's card, now 2, keeps the note its box was opened on, and Save note asks nothing and writes his edit on Leg curl (the twenty-fifth check round, R25-TW-8: every test still passed when the deleted card's empty note took Leg curl's place, and Save note then asked \"Replace the note written meanwhile?\" about her unchanged note)", () => {
  const o = r25().twoBoxes, typed = "Calves tight, sore after set 3", want = ["1 Back squat", "2 Leg curl [coach: " + typed + "]"];
  ran(o);
  assert.deepStrictEqual([o.typed, o.typed2, o.opened.bases, o.asked0], [typed, "Seat one notch lower", { 2: "", 3: "Calves tight" }, { open: true, title: "Delete Leg press?" }], "(setup) his words in both boxes, and Delete Leg press asked first: " + JSON.stringify([o.typed, o.typed2, o.opened, o.asked0]));
  assert.deepStrictEqual([says(o.drawn.card), o.drawn.notes.drafts], [["Hide note", "Calves tight", typed], { 2: typed }], "Leg curl's card, now 2, did not keep its box with his words: " + JSON.stringify(o.drawn));
  assert.deepStrictEqual([o.asked, o.after.here, o.after.server], [[], want, want], "Save note asked about her unchanged note, or did not write his edit on Leg curl: " + JSON.stringify([o.asked, o.after]));
  assert.deepStrictEqual(o.drawn.notes.bases, { 2: "Calves tight" }, "Leg curl's box, now on card 2, does not measure against the note it was opened on: " + JSON.stringify(o.drawn.notes));
});

// ---------- the twenty-sixth check round (cards-follow-probe.mjs, out.r26) ----------
// R26-CRD-5: a weight typed a moment before a question of the note box comes up (its save goes 0.5 s later, or longer on a slow signal); Mia changes
// her note meanwhile, and that save merges her change into the page under the open question, the sheet still showing what it asked about. Delete's
// "Delete this note?", an emptied box's "Delete this note?", "Replace the note written meanwhile?" and "Save a note deleted meanwhile?" each took her
// newer words, never shown to him, here and on the server. Now the answer asks again, quoting them; a note she deleted under the question is drawn gone.
const r26 = () => { const r = probe(); found(r); baseFound(r.r24); return r.r26; };
const HERS3_W = "Stopped: sharp pain in left knee";                    // her newest words, written while his question is up
const DEL_Q = { open: true, title: "Delete this note?", text: "It goes from this exercise and from the notes list.", yes: "Delete", red: true };   // the question as it first comes up, the note as he saw it
const DEL_AGAIN = { open: true, title: "Delete the note written meanwhile?", text: "Mia’s note: “" + HERS3_W + "”", yes: "Delete", red: true };   // asked again, with her newer words and a red Delete
const hersNow = withNote("client", HERS3_W);                             // Legs with her newest words on Leg press

test("Delete on Mia's note asks again when her newer words come in while \"Delete this note?\" is up (her note unfolded, a weight typed into Leg press a moment before: its save merges her change under the question, the card still showing \"Knee ok today\"): Delete opens \"Delete the note written meanwhile?\" with her newer words; Delete then takes them, here and on the server; Cancel keeps them and shows them on the card; a note she deleted under the question is drawn gone, nothing more asked (the twenty-sixth check round, R26-CRD-5: Delete took her newer words, never shown to him, here and on the server)", () => {
  const d = r26();
  for (const name of ["delete", "cancel", "gone"]) {
    const o = d["del " + name], at = "(" + name + ") ", now = name === "gone" ? none : hersNow;
    ran(o, at);
    assert.deepStrictEqual([o.w, o.q, says(o.under.card), o.under.here, o.under.server, o.under.q], ["100", DEL_Q, ["Hide note", "Knee ok today", null], now, now, DEL_Q], at + "(setup) his weight typed and Delete's question up, then her change merged in by his weight's save under it, the card still showing her old words: " + JSON.stringify([o.w, o.q, o.under]));
    if (name === "gone") { assert.deepStrictEqual([o.asked, says(o.mid.card), o.after.here, o.after.server], [[DEL_Q], ["Add note", null, null], none, none], at + "a note she deleted under the question asked something more, or the card still shows it: " + JSON.stringify([o.asked, o.mid, o.after])); continue; }
    assert.deepStrictEqual(o.asked, [DEL_Q, DEL_AGAIN], at + "Delete took her newer words without asking about them (the twenty-sixth check round: deleted unseen, here and on the server), or asked something else: " + JSON.stringify([o.asked, o.mid]));
    if (name === "delete") assert.deepStrictEqual([says(o.mid.card), o.after.here, o.after.server, o.after.notes], [["Add note", null, null], none, none, kept], at + "Delete on the second question did not take her newer words, here and on the server: " + JSON.stringify([o.mid, o.after]));
    else assert.deepStrictEqual([says(o.mid.card), says(o.after.card), o.after.here, o.after.server], [["Hide note", HERS3_W, null], ["Hide note", HERS3_W, null], hersNow, hersNow], at + "Cancel did not keep her newer words, here and on the server, or left her old words on the card: " + JSON.stringify([o.mid, o.after]));
  }
});

test("Save note on an Edit box emptied to delete Mia's note asks again when her newer words come in while its \"Delete this note?\" is up (a weight typed into Leg press a moment before; her note unfolded, Edit, every word deleted): Delete opens \"Delete the note written meanwhile?\" with her newer words; Delete then takes them, here and on the server; Cancel keeps them, unfolded above his empty box; a note she deleted under the question closes the box, nothing more asked (the twenty-sixth check round, R26-CRD-5: the emptied box's Delete took her newer words unseen)", () => {
  const e = r26();
  for (const name of ["delete", "cancel", "gone"]) {
    const o = e["emptied " + name], at = "(" + name + ") ", now = name === "gone" ? none : hersNow;
    ran(o, at);
    assert.deepStrictEqual([o.w, o.emptied, o.q, says(o.under.card), o.under.here, o.under.server, o.under.q], ["100", "", DEL_Q, ["Hide note", "Knee ok today", ""], now, now, DEL_Q], at + "(setup) his weight typed, the box emptied and Save note's question up, then her change merged in by his weight's save under it, the card still showing her old words: " + JSON.stringify([o.w, o.emptied, o.q, o.under]));
    if (name === "gone") { assert.deepStrictEqual([o.asked, says(o.mid.card), o.after.here, o.after.server, o.after.notes], [[DEL_Q], ["Add note", null, null], none, none, kept], at + "a note she deleted under the question asked something more, or the box or the note stayed: " + JSON.stringify([o.asked, o.mid, o.after])); continue; }
    assert.deepStrictEqual(o.asked, [DEL_Q, DEL_AGAIN], at + "the emptied box's Delete took her newer words without asking about them (the twenty-sixth check round: deleted unseen, here and on the server), or asked something else: " + JSON.stringify([o.asked, o.mid]));
    if (name === "delete") assert.deepStrictEqual([says(o.mid.card), o.after.here, o.after.server, o.after.notes], [["Add note", null, null], none, none, kept], at + "Delete on the second question did not take her newer words, here and on the server, or the box stayed: " + JSON.stringify([o.mid, o.after]));
    else assert.deepStrictEqual([says(o.mid.card), o.after.here, o.after.server], [["Hide note", HERS3_W, ""], hersNow, hersNow], at + "Cancel did not keep her newer words, unfolded above his empty box, here and on the server: " + JSON.stringify([o.mid, o.after]));
  }
});

test("Replace asks again when Mia changes her note while \"Replace the note written meanwhile?\" is up (Add note on Leg press and his words; her note by a sync; a weight typed into Leg curl a moment before: its save merges her newer words under the question): Replace opens the question again with her newer words; Replace then writes his words; Cancel keeps her newer words, unfolded above his box with his words, and the box measures against them (the twenty-sixth check round, R26-CRD-5: Replace wrote his words over her newer ones, never shown to him)", () => {
  const p = r26(), first = question("Mia’s note", HERS_W), again = question("Mia’s note", HERS3_W), his = withNote("coach", "Knees out");
  for (const reply of ["replace", "cancel"]) {
    const o = p["replace " + reply], at = "(" + reply + ") ";
    ran(o, at);
    assert.deepStrictEqual([o.typed, says(o.drawn), o.w, o.q, says(o.under.card), o.under.here, o.under.server, o.under.q], ["Knees out", ["See note", null, "Knees out"], "60", first, ["See note", null, "Knees out"], hersNow, hersNow, first], at + "(setup) his words in the box, her note drawn by the sync, his weight typed and Save note's question up, then her newer words merged in by his weight's save under it: " + JSON.stringify([o.typed, o.drawn, o.w, o.q, o.under]));
    assert.deepStrictEqual(o.asked, [first, again], at + "Replace wrote over her newer words without asking about them (the twenty-sixth check round: replaced unseen, here and on the server), or asked something else: " + JSON.stringify([o.asked, o.mid]));
    if (reply === "replace") assert.deepStrictEqual([says(o.mid.card), o.after.here, o.after.server, o.after.notes], [["See note", null, null], his, his, kept], at + "Replace on the second question did not write his words, here and on the server: " + JSON.stringify([o.mid, o.after]));
    else assert.deepStrictEqual([says(o.mid.card), says(o.after.card), o.after.here, o.after.server, o.after.notes.bases], [["Hide note", HERS3_W, "Knees out"], ["Hide note", HERS3_W, "Knees out"], hersNow, hersNow, { 2: HERS3_W }], at + "Cancel did not keep her newer words, unfolded above his box with his words, or the box does not measure against them: " + JSON.stringify([o.mid, o.after]));
  }
});

test("Save on \"Save a note deleted meanwhile?\" asks again when Mia writes a new note while that question is up (her note unfolded, Edit and his words; her Delete by a sync; a weight typed into Leg curl a moment before: its save merges her new note under the question): Save opens \"Replace the note written meanwhile?\" with her new words; Replace then writes his words; Cancel keeps her new note, unfolded above his box with his words (the twenty-sixth check round, R26-CRD-5: Save wrote his edit over her new note, never shown to him)", () => {
  const s = r26(), again = question("Mia’s note", HERS3_W), his = withNote("coach", edited);
  for (const reply of ["replace", "cancel"]) {
    const o = s["deleted " + reply], at = "(" + reply + ") ";
    ran(o, at);
    assert.deepStrictEqual([o.typed, says(o.drawn), o.w, o.q, says(o.under.card), o.under.here, o.under.server, o.under.q], [edited, ["Add note", null, edited], "60", DELETED_Q, ["Add note", null, edited], hersNow, hersNow, DELETED_Q], at + "(setup) his words added to her note, her Delete drawn by the sync, his weight typed and Save note's question up, then her new note merged in by his weight's save under it: " + JSON.stringify([o.typed, o.drawn, o.w, o.q, o.under]));
    assert.deepStrictEqual(o.asked, [DELETED_Q, again], at + "Save wrote his edit over her new note without asking about it (the twenty-sixth check round: replaced unseen, here and on the server), or asked something else: " + JSON.stringify([o.asked, o.mid]));
    if (reply === "replace") assert.deepStrictEqual([says(o.mid.card), o.after.here, o.after.server, o.after.notes], [["See note", null, null], his, his, kept], at + "Replace on the second question did not write his words, here and on the server: " + JSON.stringify([o.mid, o.after]));
    else assert.deepStrictEqual([says(o.mid.card), says(o.after.card), o.after.here, o.after.server, o.after.notes.bases], [["Hide note", HERS3_W, edited], ["Hide note", HERS3_W, edited], hersNow, hersNow, { 2: HERS3_W }], at + "Cancel did not keep her new note, unfolded above his box with his words, or the box does not measure against it: " + JSON.stringify([o.mid, o.after]));
  }
});
