// v321 (the twenty-seventh check round): what the coach plans on an exercise (its reps, tempo, rest, instructions, and its sign: the arrow or the
// pyramid, one at a time) merges three ways between two of his devices, as its number of sets does (sync.js mergeServerRows). Before, the device
// that saved last put its whole copy of those fields back: the iPad's 5 reps went back to the Mac's 10 when the Mac, open on the workout and not
// synced since, saved any change to it (a rename, another exercise's reps). Each case runs in the three ways the Mac's save can meet the iPad's copy
// (online; with no signal, then the waiting save; with no signal, then a sync first). The iPad's save is written on the stand-in server as main.js
// writes it. Made-up people only.
import { test, assert, tick } from "./assert.js";
import { makeSupabase } from "./fake-supabase.js";
import { load } from "./load.js";
const app = await load();
const { fns, maps } = app;
const settle = async () => { const until = Date.now() + 15000; do await tick(5); while ((app.get().inflight > 0 || maps.timers.size) && Date.now() < until); };
const C = "7f6e5d4c-1111-4a2b-9c8d-7e6f5a4b3c2d", W1 = "7f6e5d4c-2222-4a2b-9c8d-7e6f5a4b3c2d";
let n = 0; const bump = (s) => { s.updated_at = "2026-11-25T21:" + String(10 + Math.floor(n / 50) % 50).padStart(2, "0") + ":" + String(10 + (n++ % 50)).padStart(2, "0") + ".000Z"; };   // another device's write
const day = (k) => { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + k); return fns.localIso(d); };   // the app's local day (never UTC)
const coach = (sb) => { app.reset(); fns.leaveSettings(); app.set({ sb, signedIn: true, clientMode: false, backend: fns.cloudBackend, sessionEmail: "coach@x.com", view: { name: "clients" }, tab: "workouts", templateDraft: null, offline: false, offlineEntry: null }); };
const sync = async () => { await fns.syncDownNow(); await settle(); };
const quiet = () => { for (const tm of maps.timers.values()) clearTimeout(tm); maps.timers.clear(); clearTimeout(app.get().syncTimer); };
const done = () => { quiet(); app.set({ templateDraft: null, view: { name: "clients" }, tab: "workouts" }); app.reset(); localStorage.clear(); };
const ex = (id, label, name, more = {}) => ({ id, label, name, sets: 3, reps: "10", tempo: "", rest: "", weights: [], repsDone: [], setsDone: 0, done: false, note: "", ...more });
const ROWS = (squat = {}) => [ex("r1", "1", "Back squat", squat), ex("r2", "2", "Leg curl", { pyramid: true })];
const PLAN = (r) => ({ reps: r.reps, tempo: r.tempo, rest: r.rest, note: r.note, sign: [r.ramp ? "ramp" : "", r.pyramid ? "pyramid" : ""].filter(Boolean).join("+") });   // both signs at once would read "ramp+pyramid" (one at a time is the rule)
const ROUTES = ["online", "with no signal, then the waiting save first", "with no signal, then a sync first"];
async function crossed(ipad, mac, squat = {}) {                          // the Mac synced; the iPad's save lands; the Mac's change and its save, by each route (squat: Back squat's plan as seeded)
  const out = {};
  for (const route of ROUTES) {
    const sb = makeSupabase(); coach(sb); const log = {};
    sb.seed("ft_clients", C, { id: C, name: "Ava Example", unit: "lb", email: "ava@example.com", phone: "3105550111", notes: { log: [] } });
    sb.seed("ft_trainings", W1, { id: W1, clientId: C, title: "Legs", date: day(0), createdAt: "2026-11-20T16:00:00.000Z", rows: ROWS(squat), completedAt: null, skippedAt: null }, { client_id: C });
    try {
      await sync();
      const s = sb.tables.ft_trainings.get(W1); ipad(s.data); bump(s);       // the iPad's save, landed
      if (route !== "online") sb.setFail({ times: 1e6, message: "Failed to fetch" });
      mac(maps.trainings.get(W1)); fns.scheduleSave("trainings", W1); await settle();
      if (route !== "online") { log.waited = [...maps.dirty.keys()]; sb.setFail(null); app.set({ offline: false }); if (route.endsWith("a sync first")) await sync(); else { fns.flushOne("trainings", W1); await settle(); } }
      const sd = sb.tables.ft_trainings.get(W1).data, md = maps.trainings.get(W1);
      log.server = { title: sd.title, rows: sd.rows.map((r) => [r.name, PLAN(r)]) }; log.mac = { title: md.title, rows: md.rows.map((r) => [r.name, PLAN(r)]) }; log.waiting = [...maps.dirty.keys()]; log.stray = [...sd.rows, ...md.rows].filter((r) => r && Object.prototype.hasOwnProperty.call(r, "")).map((r) => r.name);   // a field named "" (a sign taken off, written back as lr[""])
    } finally { done(); }
    out[route] = log;
  }
  return out;
}
const holds = (out, want, what) => { for (const [route, log] of Object.entries(out)) { if (route !== "online") assert.deepStrictEqual(log.waited, ["trainings/" + W1], "(the setup: the Mac's save waits for the signal) [" + route + "]"); assert.deepStrictEqual({ server: log.server, mac: log.mac, waiting: log.waiting }, { server: want, mac: want, waiting: [] }, what + " [" + route + "]: " + JSON.stringify(log)); } };
const P = (reps, tempo, rest, note, sign) => ({ reps, tempo, rest, note, sign });

test("v321 (the twenty-seventh check round): the iPad plans Back squat (5 reps, 3-1-1, 90 sec rest, instructions, the arrow) and the Mac, not synced since, renames the workout: the iPad's plan stays, here and on the server, with the Mac's name", async () => {
  const out = await crossed((d) => { const b = d.rows[0]; b.reps = "5"; b.tempo = "3-1-1"; b.rest = "90 sec"; b.note = "Brace first"; b.ramp = true; }, (t) => { t.title = "Legs A"; });
  holds(out, { title: "Legs A", rows: [["Back squat", P("5", "3-1-1", "90 sec", "Brace first", "ramp")], ["Leg curl", P("10", "", "", "", "pyramid")]] }, "the iPad's plan on Back squat stays");
});

test("v321 (the twenty-seventh check round): the iPad changes Back squat's tempo and the Mac, not synced since, Leg curl's reps: both changes stay", async () => {
  const out = await crossed((d) => { d.rows[0].tempo = "2-0-2"; }, (t) => { t.rows[1].reps = "12"; });
  holds(out, { title: "Legs", rows: [["Back squat", P("10", "2-0-2", "", "", "")], ["Leg curl", P("12", "", "", "", "pyramid")]] }, "each device's change stays");
});

test("v321 (the twenty-seventh check round): both devices change Back squat's reps: the Mac's, made since it last read the workout, stands (as for the number of sets)", async () => {
  const out = await crossed((d) => { d.rows[0].reps = "5"; d.rows[0].rest = "2 min"; }, (t) => { t.rows[0].reps = "12"; });
  holds(out, { title: "Legs", rows: [["Back squat", P("12", "", "2 min", "", "")], ["Leg curl", P("10", "", "", "", "pyramid")]] }, "the Mac's own change stands, the iPad's other one comes in");
});

test("v321 (the twenty-seventh check round): an exercise's sign merges as one field: the iPad's pyramid and the Mac's arrow on Back squat leave the Mac's arrow only (one sign at a time); the iPad taking Leg curl's pyramid off, off", async () => {
  const out = await crossed((d) => { d.rows[0].pyramid = true; delete d.rows[1].pyramid; }, (t) => { t.rows[0].ramp = true; t.title = "Legs B"; });
  holds(out, { title: "Legs B", rows: [["Back squat", P("10", "", "", "", "ramp")], ["Leg curl", P("10", "", "", "", "")]] }, "one sign each, the iPad's taking off kept");
  for (const [route, log] of Object.entries(out)) assert.deepStrictEqual(log.stray, [], "a sign taken off left a field named \"\" on the exercise [" + route + "]");
});

test("v321 (the twenty-seventh check round): the iPad empties Back squat's instructions (Brace first) and its tempo (3-1-1), and the Mac, not synced since, changes Leg curl's rest: the instructions and the tempo stay empty", async () => {
  const out = await crossed((d) => { d.rows[0].note = ""; d.rows[0].tempo = ""; }, (t) => { t.rows[1].rest = "45 sec"; }, { note: "Brace first", tempo: "3-1-1" });
  holds(out, { title: "Legs", rows: [["Back squat", P("10", "", "", "", "")], ["Leg curl", P("10", "", "45 sec", "", "pyramid")]] }, "nothing comes back");
});
