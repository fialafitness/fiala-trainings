// v316, the twenty-fifth check round (R25-MRG-5): what the coach has read of a client's notes was marked by the exercise alone ("row/<workout>/<row>"
// in her record's seenNotes), never by the note. Once he had read Jane's note on Leg press, her edited note there (Edit, new words), or a new one
// written after she deleted it, was never news: no "1 note", no count on the Notes tab, on one device with no merge at all, even with a sync between
// her delete and her new note. A pain report could go unseen. A note read is now marked with its time ("row/<workout>/<row>@<clientNoteAt>", main.js
// noteMark): an edited or new note on that exercise is news again, and a read keeps only the marks of notes as they are now. A mark made before
// (the exercise alone) still counts its note as read, and becomes that note's own mark at his next read. He reads a note as main.js does: a tap on
// it (openClientNote: markNoteSeen), or her Notes tab shown (renderClient: markNotesSeen); her phone writes on the stand-in server as her note rule
// does (client_row_note: the words, by client, the time). The read marks merged between his devices are in merge-fields.test.js. Made-up people only.
import fs from "node:fs";
import { test, assert, tick } from "./assert.js";
import { makeSupabase } from "./fake-supabase.js";
import { load } from "./load.js";
const app = await load();
const { fns, maps } = app;
const src = fs.readFileSync(new URL("../app/main.js", import.meta.url), "utf8");
const settle = async () => { const until = Date.now() + 15000; do await tick(5); while ((app.get().inflight > 0 || maps.timers.size) && Date.now() < until); };
const C = "4c9d3e2b-1111-4a5b-8c7d-9e0f1a2b3c4d", W1 = "4c9d3e2b-2222-4a5b-8c7d-9e0f1a2b3c4d";
let n = 0; const bump = (s) => { s.updated_at = "2026-11-25T16:" + String(10 + Math.floor(n / 50) % 50).padStart(2, "0") + ":" + String(10 + (n++ % 50)).padStart(2, "0") + ".000Z"; };   // her phone's write
const day = (k) => { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + k); return fns.localIso(d); };   // the app's local day (never UTC)
const coach = (sb) => { app.reset(); fns.leaveSettings(); app.set({ sb, signedIn: true, clientMode: false, backend: fns.cloudBackend, sessionEmail: "coach@x.com", view: { name: "clients" }, tab: "workouts", templateDraft: null, offline: false, offlineEntry: null }); };
const sync = async () => { await fns.syncDownNow(); await settle(); };
const quiet = () => { for (const tm of maps.timers.values()) clearTimeout(tm); maps.timers.clear(); clearTimeout(app.get().syncTimer); };   // no save or sync left to run into the next test
const done = () => { quiet(); app.set({ templateDraft: null, view: { name: "clients" }, tab: "workouts" }); app.reset(); localStorage.clear(); };
const JANE = (more = {}) => ({ id: C, name: "Jane Sample", unit: "lb", email: "jane@x.com", phone: "3105550142", notes: { log: [] }, ...more });
const T1 = "2026-11-24T17:01:00.000Z", T2 = "2026-11-25T08:15:00.000Z", T3 = "2026-11-24T17:02:00.000Z";   // when she wrote: her first note, her new words, her note on Leg curl
const ex = (id, label, name, note, at) => ({ id, label, name, sets: 3, reps: "10", weights: [], repsDone: [], setsDone: 0, done: false, note: "", ...(note ? { clientNote: note, clientNoteBy: "client", clientNoteAt: at } : {}) });
const legs = (curl) => ({ id: W1, clientId: C, title: "Legs", date: day(0), createdAt: "2026-11-20T16:00:00.000Z", completedAt: null, skippedAt: null, rows: [ex("r1", "1", "Leg press", "Knee felt tight", T1), ex("r2", "2", "Leg curl", curl, T3)] });   // Jane's Legs today: her note on Leg press (and with curl, one on Leg curl)
const herNote = (sb, rid, text, at) => { const s = sb.tables.ft_trainings.get(W1), r = s.data.rows.find((x) => x.id === rid); if (text) Object.assign(r, { clientNote: text, clientNoteBy: "client", clientNoteAt: at }); else { delete r.clientNote; delete r.clientNoteBy; delete r.clientNoteAt; } bump(s); };   // her phone: Save note (the words, by client, the time) or Delete (client_row_note)
const noteId = (rid) => "row/" + W1 + "/" + rid;                          // main.js noteId: the exercise
const mark = (rid, at) => noteId(rid) + "@" + at;                         // main.js noteMark: the note as read, its exercise and its time
const LINES = ['const noteId = (t, r) => "row/" + t.id + "/" + r.id;', 'const noteMark = (t, r) => noteId(t, r) + "@" + String(r.clientNoteAt || "");'];
const held = () => { for (const line of LINES) assert.ok(src.includes(line), "(the setup: main.js's noteId or noteMark no longer reads as this file copies them): " + line); };
const READ = {                                                            // how the coach reads her notes, as main.js does it
  "taps it in her Notes tab": () => fns.markNoteSeen(maps.clients.get(C), noteId("r1")),   // openClientNote's first step (the workout it opens cannot be drawn on this stand-in page)
  "opens her Notes tab": () => { app.set({ view: { name: "client", id: C }, tab: "notes" }); fns.render(); app.set({ tab: "workouts" }); fns.render(); app.set({ view: { name: "clients" } }); },   // shown: what was unread counts as read (markNotesSeen); then the Workouts tab and the Clients list
};
const shows = () => {                                                     // what the Mac shows of her notes: the count on her page's Notes tab, and the notes listed as new (her words)
  app.set({ view: { name: "client", id: C }, tab: "workouts" }); fns.render(); app.set({ view: { name: "clients" } });
  const badge = document.getElementById("notesBadge");
  return { count: badge.hidden ? "none" : badge.textContent, notes: fns.clientNews(maps.clients.get(C)).notes.map((x) => x.r.clientNote) };
};
const seenOf = (sb) => [...(sb.tables.ft_clients.get(C).data.seenNotes || [])].sort();   // her record's read marks, as the server holds them
const NONE = { count: "none", notes: [] };

const HER = {                                                             // what Jane does on her phone after he read her note, and when his Mac syncs
  "she taps Edit on her note and saves new words": async (sb) => { herNote(sb, "r1", "Left knee hurts on the way down", T2); await sync(); },
  "she deletes her note and writes a new one there": async (sb) => { herNote(sb, "r1", null); herNote(sb, "r1", "Left knee hurts on the way down", T2); await sync(); },
  "she deletes her note, his Mac syncs, and she writes a new one there": async (sb) => { herNote(sb, "r1", null); await sync(); herNote(sb, "r1", "Left knee hurts on the way down", T2); await sync(); },
  "she deletes her note, he opens her Notes tab (nothing new there), and she writes a new one there": async (sb) => { herNote(sb, "r1", null); await sync(); READ["opens her Notes tab"](); await settle(); herNote(sb, "r1", "Left knee hurts on the way down", T2); await sync(); },
};
for (const [her, act] of Object.entries(HER)) for (const way of Object.keys(READ)) test("a note the coach read, rewritten, is news again on his Mac (one device, no merge): Jane wrote Knee felt tight on Leg press and he " + way + "; then " + her + ": her new words are listed as new and her Notes tab counts 1, and once he reads them nothing is new and her record keeps one mark, of the note as it is now (the twenty-fifth check round, R25-MRG-5: the mark named the exercise alone, so her new words were never news, and the coach could miss a pain report)", async () => {
  held();
  const sb = makeSupabase(); coach(sb); const log = {};
  sb.seed("ft_clients", C, JANE()); sb.seed("ft_trainings", W1, legs(), { client_id: C });
  try {
    await sync(); log.before = shows();                                   // his Mac, synced: her note is new
    READ[way](); await settle(); log.read = { ...shows(), seen: seenOf(sb) };   // he reads it (its mark saved)
    await act(sb); log.after = shows();                                   // her phone, then his Mac's sync
    READ[way](); await settle(); log.again = { ...shows(), seen: seenOf(sb) };
  } finally { done(); }
  const shown = (x) => ({ count: x.count, notes: x.notes });
  assert.deepStrictEqual(log.before, { count: "1", notes: ["Knee felt tight"] }, "(the setup: her note is new on the Mac): " + JSON.stringify(log));
  assert.deepStrictEqual([shown(log.read), log.after, shown(log.again)], [NONE, { count: "1", notes: ["Left knee hurts on the way down"] }, NONE], "her new words on Leg press are not news (no count on the Notes tab), or a read of his did not count: " + JSON.stringify(log));
  assert.deepStrictEqual([log.read.seen, log.again.seen], [[mark("r1", T1)], [mark("r1", T2)]], "her record does not keep one mark, of her note as it is now: " + JSON.stringify(log));
});

test("no change for a note the coach read and Jane left alone: his Mac syncs, she writes her first note on Leg curl, and only that one is new (her Notes tab counts 1); the Leg press note stays read, before and after he reads the new one (the twenty-fifth check round, R25-MRG-5: a note read stays read, by its own mark)", async () => {
  held();
  const sb = makeSupabase(); coach(sb); const log = {};
  sb.seed("ft_clients", C, JANE()); sb.seed("ft_trainings", W1, legs(), { client_id: C });
  try {
    await sync(); READ["taps it in her Notes tab"](); await settle();     // he read her note on Leg press
    await sync(); log.synced = shows();
    herNote(sb, "r2", "Hamstring cramp", T3); await sync(); log.after = shows();   // her first note on Leg curl
    READ["opens her Notes tab"](); await settle(); log.again = { ...shows(), seen: seenOf(sb) };
  } finally { done(); }
  assert.deepStrictEqual(log, { synced: NONE, after: { count: "1", notes: ["Hamstring cramp"] }, again: { ...NONE, seen: [mark("r1", T1), mark("r2", T3)] } }, "a note he read came back as new, or her new note on Leg curl was not news: " + JSON.stringify(log));
});

for (const way of Object.keys(READ)) test("a note read before the twenty-fifth check round (its mark the exercise alone) stays read, and his next read marks it with its time: Jane's note on Leg press was read on the release before; on this one only her note on Leg curl is new; he " + way.replace("taps it", "taps that one") + "; then she taps Edit on her Leg press note and saves new words: they are news (the twenty-fifth check round, R25-MRG-5: a mark from before named the exercise alone and kept every later note there read)", async () => {
  held();
  const sb = makeSupabase(); coach(sb); const log = {};
  sb.seed("ft_clients", C, JANE({ seenNotes: [noteId("r1")] })); sb.seed("ft_trainings", W1, legs("Hamstring cramp"), { client_id: C });
  try {
    await sync(); log.before = shows();                                   // the old mark still counts her Leg press note as read
    if (way.startsWith("taps")) fns.markNoteSeen(maps.clients.get(C), noteId("r2")); else READ[way]();   // he reads her note on Leg curl
    await settle(); log.read = { ...shows(), seen: seenOf(sb) };
    herNote(sb, "r1", "Left knee hurts on the way down", T2); await sync(); log.after = shows();
  } finally { done(); }
  assert.deepStrictEqual(log.before, { count: "1", notes: ["Hamstring cramp"] }, "a note read on the release before shows as new (or her Leg curl note is not new): " + JSON.stringify(log));
  assert.deepStrictEqual([{ count: log.read.count, notes: log.read.notes }, log.after], [NONE, { count: "1", notes: ["Left knee hurts on the way down"] }], "her new words on Leg press are not news, or his read did not count: " + JSON.stringify(log));
  assert.deepStrictEqual(log.read.seen, [mark("r1", T1), mark("r2", T3)], "the old mark was not made her note's own mark at his read: " + JSON.stringify(log));
});
