// v321, the twenty-eighth check round (the data lens, R28-DAT-1 and R28-DAT-2): the card's "…" > Delete exercise on the coach's Mac, not synced
// since, crossing a change of cards on his iPad (a warm-up, a join, a word such as Finisher) and/or Ava's Start this exercise and a set on her
// phone. Since R27-MRG-1 that Delete claims the order only while the other copy kept every card as last read; otherwise the merge goes exercise
// by exercise, and it read the numbers his own Delete only closed up as numbers he gave: the iPad's change after the exercise he deleted went
// back (R28-DAT-2), and with her Start it made a superset nobody made, Back squat beside Calf raise with a set marked done on Back squat that
// nobody did (R28-DAT-1: 1a Back squat 1/3 + 1b Calf raise 1/3, 2 Plank, the iPad's warm-up gone). Now a number his Delete only closed up is
// none of his (sync.js mergeServerRows' `closed`), and the place the exercise held on the server closes up as his Delete closed it here.
// The iPad's save and her phone's rules land on the stand-in server (main.js's own startExerciseNow for her Start, the picker's tidy); the
// Mac deletes with deleteRow's line as main.js has it (its claim read from the source). Three routes each. Made-up people only.
import fs from "node:fs";
import { test, assert, tick } from "./assert.js";
import { makeSupabase } from "./fake-supabase.js";
import { load } from "./load.js";
import { tidyLabels, cmpLabel } from "../app/model.js";
const app = await load();
const { fns, maps } = app;
const src = fs.readFileSync(new URL("../app/main.js", import.meta.url), "utf8");
const DEL = /t\.rows = t\.rows\.filter\(\(x\) => x\.id !== r\.id\); renumber\(t, r\); (?:if \(!tpl\) touchState\(t\.id, "(\w+)"\); )?save\(\);/.exec(src);   // deleteRow, once its question is answered
const CLAIM = DEL ? DEL[1] || null : undefined;
const settle = async () => { const until = Date.now() + 15000; do await tick(5); while ((app.get().inflight > 0 || maps.timers.size) && Date.now() < until); };
const C = "4d3c2b1a-1111-4b2c-9d3e-4f5a6b7c8d9e", W = "4d3c2b1a-2222-4b2c-9d3e-4f5a6b7c8d9e";
let n = 0; const bump = (s) => { s.updated_at = "2026-11-25T23:" + String(10 + Math.floor(n / 50) % 50).padStart(2, "0") + ":" + String(10 + (n++ % 50)).padStart(2, "0") + ".000Z"; };   // another device's write
const day = (k) => { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + k); return fns.localIso(d); };   // the app's local day (never UTC)
const coach = (sb) => { app.reset(); fns.leaveSettings(); app.set({ sb, signedIn: true, clientMode: false, backend: fns.cloudBackend, sessionEmail: "coach@x.com", view: { name: "clients" }, tab: "workouts", templateDraft: null, offline: false, offlineEntry: null }); };
const sync = async () => { await fns.syncDownNow(); await settle(); };
const quiet = () => { for (const tm of maps.timers.values()) clearTimeout(tm); maps.timers.clear(); clearTimeout(app.get().syncTimer); };
const done = () => { quiet(); app.set({ templateDraft: null, view: { name: "clients" }, tab: "workouts" }); app.reset(); localStorage.clear(); };
const AVA = () => ({ id: C, name: "Ava Example", unit: "lb", email: "ava@example.com", phone: "3105550111", notes: { log: [] } });
const legs = (rows) => ({ id: W, clientId: C, title: "Legs", date: day(0), createdAt: "2026-11-20T16:00:00.000Z", rows, completedAt: null, skippedAt: null });
const ex = (id, label, name) => ({ id, label, name, sets: 3, reps: "10", tempo: "", rest: "", weights: [], repsDone: [], setsDone: 0, done: false, note: "" });
const FOUR = () => [ex("bs", "1", "Back squat"), ex("lc", "2", "Leg curl"), ex("cr", "3", "Calf raise"), ex("pk", "4", "Plank")];
// the cards as the page draws them (numbers tidied, a superset one card), each exercise's sets done and weights
const cards = (rows) => { const ys = JSON.parse(JSON.stringify(rows || [])); tidyLabels(ys); ys.sort((a, b) => cmpLabel(a.label, b.label)); return fns.groupsOf(ys).map((g) => g.rows.map((r) => { const ws = (r.weights || []).filter((w) => String(w == null ? "" : w).trim()), sd = Number(r.setsDone) || 0; return r.label + " " + r.name + (sd || r.done ? " " + sd + "/" + r.sets + (r.done ? " done" : "") : "") + (ws.length ? " [" + ws.join(",") + "]" : ""); }).join(" + ")); };
const together = (cs) => cs.map((c) => c.split(" + ").map((x) => x.replace(/^\S+ /, "").replace(/ \d+\/\d+.*$/, "")).sort().join(" + ")).sort();   // which exercises share a card, whatever its number
const onServer = (sb, fn) => { const s = sb.tables.ft_trainings.get(W); fn(s.data); bump(s); };
const other = {
  pick: (rid, to) => (d) => { d.rows.find((x) => x.id === rid).label = String(to); tidyLabels(d.rows, rid); },   // the iPad's number picker (W or a number), its page's tidy
  word: (rid, w) => (d) => { d.rows.find((x) => x.id === rid).label = w; },                                     // the iPad's own word in the number box (Finisher)
  del: (rid) => (d) => { const g = d.rows.find((x) => x.id === rid); d.rows = d.rows.filter((x) => x.id !== rid); fns.renumber(d, g, false); },   // the iPad's Delete exercise
  start: (rid) => (d) => {                                                                                       // her Start this exercise (main.js's own, on a copy under its own id, in client mode)
    const t = { ...JSON.parse(JSON.stringify(d)), id: "phone-" + W }, key = String(t.rows.find((x) => x.id === rid).label).match(/^\d+/)[0];
    app.set({ clientMode: true }); let res; try { res = fns.startExerciseNow(t, key); } finally { app.set({ clientMode: false }); maps.pendingOrder.delete(t.id); const k = "trainings/" + t.id; clearTimeout(maps.timers.get(k)); maps.timers.delete(k); maps.dirty.delete(k); }
    if (!res || !res.changed) throw new Error("(the setup) her Start this exercise changed nothing");
    const lab = new Map(t.rows.map((x) => [x.id, x.label])); for (const x of d.rows) if (lab.has(x.id)) x.label = lab.get(x.id);
  },
  set: (rid) => (d) => { const r = d.rows.find((x) => x.id === rid); r.weights = ["30"]; r.repsDone = ["10"]; r.setsDone = 1; r.unit = "lb"; r.logSeq = (r.logSeq || 0) + 1; },   // her set 1 (client_log_set's fields)
  all: (...fs) => (d) => { for (const f of fs) f(d); },
};
const page = () => { app.set({ view: { name: "training", id: W }, renderedTraining: null }); try { fns.render(); } catch (_) {} app.set({ view: { name: "clients" }, renderedTraining: null }); };   // the Mac's page drawn (its tidy saved)
const macDel = (rid) => () => { const t = maps.trainings.get(W), r = t.rows.find((x) => x.id === rid); t.rows = t.rows.filter((x) => x.id !== r.id); fns.renumber(t, r); if (CLAIM) fns.touchState(W, CLAIM); fns.scheduleSave("trainings", W); page(); };   // the card's "…" > Delete exercise > Delete
const ROUTES = ["online", "no signal, then his waiting save", "no signal, then a sync first"];
async function crossed(rows, theirs, mine) {                              // per route: the server, the Mac after its save's merge, and the Mac after its next sync
  const out = {};
  for (const route of ROUTES) {
    const sb = makeSupabase(); coach(sb); const log = {};
    sb.seed("ft_clients", C, AVA()); sb.seed("ft_trainings", W, legs(JSON.parse(JSON.stringify(rows))), { client_id: C });
    try {
      await sync(); page(); await settle();
      onServer(sb, theirs);
      if (route !== "online") sb.setFail({ times: 1e6, message: "Failed to fetch" });
      await mine(); await settle();
      if (route !== "online") { sb.setFail(null); app.set({ offline: false }); if (route.endsWith("sync first")) await sync(); else { fns.flushOne("trainings", W); await settle(); } }
      page(); await settle();
      log.server = cards(sb.tables.ft_trainings.get(W).data.rows); log.mac = cards(maps.trainings.get(W).rows); log.bs = (sb.tables.ft_trainings.get(W).data.rows.find((x) => x.id === "bs") || {}).setsDone || 0;
      await sync(); log.after = cards(maps.trainings.get(W).rows);
    } finally { done(); }
    out[route] = log;
  }
  return out;
}
const each = (out, check) => { for (const [route, l] of Object.entries(out)) { assert.deepStrictEqual(l.mac, l.server, route + ": the Mac after its save shows what the server holds"); assert.deepStrictEqual(l.after, l.server, route + ": and after its next sync"); check(l, route); } };
assert.ok(CLAIM !== undefined, "(the setup) main.js's deleteRow no longer reads as this file copies it");

test("R28-DAT-1: the iPad makes Plank the warm-up, Ava starts Calf raise and logs a set, the Mac (not synced since) deletes Leg curl: W Plank, 1 Calf raise with her set, 2 Back squat, by every route; never Back squat and Calf raise made one card, never a set marked done on Back squat that nobody did, and the iPad's warm-up stays (round 27's claim left the order to the exercise-by-exercise merge, which read his Delete's close-up as his own numbering: 1a Back squat 1/3 + 1b Calf raise 1/3, 2 Plank)", async () => {
  each(await crossed(FOUR(), other.all(other.pick("pk", "W"), other.start("cr"), other.set("cr")), macDel("lc")), (l, route) => {
    assert.deepStrictEqual(l.server, ["W Plank", "1 Calf raise 1/3 [30]", "2 Back squat"], route);
    assert.strictEqual(l.bs, 0, route + ": no set marked done on Back squat");
  });
});
test("R28-DAT-1, the same with her Start and no set yet, and with five exercises (Bike the warm-up): her order and the iPad's warm-up stand, no superset nobody made", async () => {
  each(await crossed(FOUR(), other.all(other.pick("pk", "W"), other.start("cr")), macDel("lc")), (l, route) => assert.deepStrictEqual(l.server, ["W Plank", "1 Calf raise", "2 Back squat"], route));
  each(await crossed([...FOUR(), ex("bk", "5", "Bike")], other.all(other.pick("bk", "W"), other.start("cr"), other.set("cr")), macDel("lc")), (l, route) => assert.deepStrictEqual(l.server, ["W Bike", "1 Calf raise 1/3 [30]", "2 Back squat", "3 Plank"], route));
});
test("R28-DAT-2: the iPad's change of cards after the exercise the Mac deletes stands: its join (Plank into Calf raise's card), its word (Finisher on Plank), its warm-up with its own Delete of Calf raise (round 27's claim gave way, but the merge still put the Mac's numbers back: 1 Back squat, 2 Calf raise, 3 Plank)", async () => {
  each(await crossed(FOUR(), other.pick("pk", 3), macDel("lc")), (l, route) => assert.deepStrictEqual(l.server, ["1 Back squat", "2a Calf raise + 2b Plank"], route));
  each(await crossed(FOUR(), other.word("pk", "Finisher"), macDel("lc")), (l, route) => assert.deepStrictEqual(l.server, ["1 Back squat", "2 Calf raise", "Finisher Plank"], route));
  each(await crossed(FOUR(), other.all(other.del("cr"), other.pick("pk", "W")), macDel("lc")), (l, route) => assert.deepStrictEqual(l.server, ["W Plank", "1 Back squat"], route));
});
test("R28-DAT-2: a join on the iPad before the exercise the Mac deletes stands too (Calf raise into Back squat's card), and the place the deleted exercise held closes up as his Delete closed it: the iPad's join of Calf raise into Plank's card (4a, 4b) with Back squat deleted on the Mac starts at 1 (1 Leg curl, then Plank and Calf raise together), never at 2", async () => {
  each(await crossed(FOUR(), other.pick("cr", 1), macDel("lc")), (l, route) => assert.deepStrictEqual(together(l.server), ["Back squat + Calf raise", "Plank"], route));
  each(await crossed(FOUR(), other.pick("cr", 4), macDel("bs")), (l, route) => { assert.deepStrictEqual(together(l.server), ["Calf raise + Plank", "Leg curl"], route); assert.ok(/^1 Leg curl$/.test(l.server[0]), route + ": the first card is 1, " + l.server.join(", ")); });
});
test("R28-DAT-1's guards: her Start and a set crossing his Delete with no iPad keeps the card she began (R26-MRG-3); her set on the exercise he deleted brings it back finished early in its place (R27-MRG-7), the iPad's warm-up kept", async () => {
  each(await crossed(FOUR(), other.all(other.start("pk"), other.set("pk")), macDel("lc")), (l, route) => assert.deepStrictEqual(l.server, ["1 Plank 1/3 [30]", "2 Back squat", "3 Calf raise"], route));
  each(await crossed(FOUR(), other.all(other.pick("pk", "W"), other.set("lc")), macDel("lc")), (l, route) => assert.deepStrictEqual(l.server, ["W Plank", "1 Back squat", "2 Leg curl 1/3 done [30]", "3 Calf raise"], route));
});
