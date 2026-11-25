// v316 (the twenty-third check round): two of the coach's own devices, one record, the Mac saving it from a copy read before the iPad's change.
// Each field merges by what each device changed since it last read the record. Two fields did not:
// - a package on the Templates record (R23-MRG-1, R23-RLN-3): the packages merged as a union that kept this device's copy of every package both
//   copies held, so a package edited on the iPad went back to the Mac's older copy whenever the Mac saved the Templates record for any reason
//   (a folder renamed or added, Reorder of the Programs, another package added or edited), while the clients on it kept the new name and size;
// - a client's lists of what the coach has read (R23-MRG-4): seenNotes and seenFinished were plain fields, so the Mac's list replaced the
//   iPad's, and a note or a finished workout read on the iPad came back as news.
// The twenty-fourth check round:
// - the read lists again (R24-MRG-4, R24-TW-1, R24-TW-4, R24-MRG-5): an id the other device let go (her note deleted, her finish taken back)
//   came back as read from the Mac's older list, so her new note on that exercise, or her second finish, was never news; the copy on screen
//   joins as the copy sent does; an entry that is not an id was added again at every merge (the list doubled);
// - an exercise deleted on the iPad and changed on the Mac (R24-MRG-3): #4's three-way merge keeps it (changed here), but it kept its old
//   number beside the exercise the iPad's Delete exercise had moved onto that number: the page drew a superset (or a tri-set) nobody made,
//   and saved it. It now comes back after the others, a superset whole; a superset the iPad only shortened stays together.
// - a client's plan and a package (R24-MRG-1, R24-MRG-2; the owner's pick "Each detail separately", 25 Nov 2026): Save changes on a package
//   rewrites every client on it from the Mac's copy, and a plan changed here was kept whole, so the iPad's Active until, + 4 weeks or switch of
//   package was undone; a package put back as it was read took the iPad's edit while its clients kept the Mac's old name and size. A plan now
//   merges detail by detail against the copy last read (a switch or None on the iPad beats a detail changed on the Mac), and so does a package
//   both devices changed.
// The twenty-fifth check round:
// - both devices adding an exercise (R25-MRG-1, R25-MRG-4): the two new exercises shared a number and the page made them one superset nobody
//   made; a deletion on one device and an exercise added on the other left a number out (1, 2, 4);
// - details that belong together (R25-MRG-2): a session count's correction and what it carried over, a package's kind and its size, merge as one
//   detail, and a plan started afresh (None, then the package again another day) counts as a switch;
// - a package made before In person existed (R25-MRG-3) read as changed by any Save changes: the iPad's In person went, and one it deleted came back;
// - the read marks carry the note's time (R25-MRG-5): the Mac reads a note through main.js's own markNoteSeen (note-news.test.js has the rest);
// - tests for undos no test caught (R25-TW-9, R25-TW-11): a detail only the other device's plan has, the plan history, the Reorder claim beside
//   an exercise deleted there, and only ids joining the read lists.
// The iPad's changes are written on the stand-in server as its own handlers and saves write them; the Mac is this page, its changes made as
// main.js's handlers make them. The same merges after a relaunch are in relaunch-merge.test.js (the plan's and the package's of the
// twenty-fourth round run here too, the Mac closed and opened again). Made-up people only.
import fs from "node:fs";
import { test, assert, tick } from "./assert.js";
import { makeSupabase } from "./fake-supabase.js";
import { load } from "./load.js";
import { TEMPLATES_ID, tidyLabels, cmpLabel, isTemplateClient, planSwitch, labelKey } from "../app/model.js";
import { daysLater, fmtDay } from "../app/util.js";
const app = await load();
const { fns, maps } = app;
const src = fs.readFileSync(new URL("../app/main.js", import.meta.url), "utf8");
const settle = async () => { const until = Date.now() + 15000; do await tick(5); while ((app.get().inflight > 0 || maps.timers.size) && Date.now() < until); };
const C = "4b8e2f1a-1111-4c3d-9e5f-6a7b8c9d0e1f", W1 = "4b8e2f1a-2222-4c3d-9e5f-6a7b8c9d0e1f", W2 = "4b8e2f1a-3333-4c3d-9e5f-6a7b8c9d0e1f", W3 = "4b8e2f1a-4444-4c3d-9e5f-6a7b8c9d0e1f";
const AT = "2026-11-10T16:00:00.000Z";
let n = 0; const bump = (s) => { s.updated_at = "2026-11-24T18:" + String(10 + Math.floor(n / 50) % 50).padStart(2, "0") + ":" + String(10 + (n++ % 50)).padStart(2, "0") + ".000Z"; };   // another device's write
const day = (k) => { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + k); return fns.localIso(d); };   // the app's local day (never UTC)
const coach = (sb) => { app.reset(); fns.leaveSettings(); app.set({ sb, signedIn: true, clientMode: false, backend: fns.cloudBackend, sessionEmail: "coach@x.com", view: { name: "clients" }, templateDraft: null, offline: false, offlineEntry: null }); };
const sync = async () => { await fns.syncDownNow(); await settle(); };
const quiet = () => { for (const tm of maps.timers.values()) clearTimeout(tm); maps.timers.clear(); clearTimeout(app.get().syncTimer); };   // no save or sync left to run into the next test
const done = () => { quiet(); app.set({ templateDraft: null, view: { name: "clients" } }); app.reset(); localStorage.clear(); };
const onIpad = (sb, table, id, change) => { const s = sb.tables[table].get(id); change(s.data); bump(s); };   // the iPad's save of that record, landed on the server

// ---------- a package on the Templates record ----------
const TPL = () => ({ id: TEMPLATES_ID, name: "Templates", kind: "templates", templatesVersion: 3, builtinsAdopted: 1,
  folders: [{ id: "f1", name: "Strength", parent: null, kind: "folder", at: AT }, { id: "f2", name: "Rehab", parent: null, kind: "folder", at: AT }],
  packages: [{ id: "p1", name: "10 sessions", kind: "sessions", size: 10, inPerson: true }, { id: "p2", name: "4-week plan", kind: "monthly", size: null, inPerson: false }] });
const JANE = () => ({ id: C, name: "Jane Sample", unit: "lb", email: "jane@x.com", phone: "3105550142", notes: { log: [] }, plan: { id: "p1", name: "10 sessions", kind: "sessions", size: 10, startedOn: day(-20) } });
const TWELVE = { name: "12 sessions", kind: "sessions", size: 12, inPerson: false };
const iPadEdits = (sb, id = "p1", next = TWELVE) => {                    // the iPad: Packages, the package tapped, its new name, size and In person, Save changes (main.js packAdd): the Templates record, then each client on it
  onIpad(sb, "ft_clients", TEMPLATES_ID, (d) => { d.packages = d.packages.map((p) => (p.id === id ? { ...p, ...next } : p)); });
  if (id === "p1") onIpad(sb, "ft_clients", C, (d) => { d.plan = { ...d.plan, name: next.name, kind: next.kind, size: next.size }; });
};
const tc = () => maps.clients.get(TEMPLATES_ID);
const packList = () => (tc().packages || []).filter((p) => p && p.id);   // main.js packagesList
const macEdits = (id, next) => { tc().packages = packList().map((p) => (p.id === id ? { ...p, ...next } : p)); maps.planTouched.add(TEMPLATES_ID); fns.scheduleSave("clients", TEMPLATES_ID); };   // packAdd's Save changes (no client on the package)
const macAdds = (p) => { tc().packages = [...packList(), p]; maps.planTouched.add(TEMPLATES_ID); fns.scheduleSave("clients", TEMPLATES_ID); };   // packAdd's Add package
const macDeletes = (id) => { tc().packages = packList().filter((x) => x.id !== id); maps.deletedPackages.set(id, TEMPLATES_ID); maps.planTouched.add(TEMPLATES_ID); fns.scheduleSave("clients", TEMPLATES_ID); };   // Delete on the Packages page, once its question is answered
const MAC = {                                                             // what the Mac changes, as main.js's own lines do it; each saves the Templates record
  "renames folder Strength": () => { tc().folders = tc().folders.map((x) => (x && x.id === "f1" ? { ...x, name: "Strength block" } : x)); maps.folderTouched.set("f1", TEMPLATES_ID); fns.scheduleSave("clients", TEMPLATES_ID); },   // renameNode, once its question is answered
  "adds a folder": () => { tc().folders = [...tc().folders, { id: "f9", name: "Power", parent: null, kind: "folder", at: AT }]; maps.folderTouched.set("f9", TEMPLATES_ID); fns.scheduleSave("clients", TEMPLATES_ID); },   // newFolder, once its question is answered
  "reorders the Programs": () => { const keys = fns.tplRootList().map((e) => e.key); fns.moveRootTo(keys[keys.length - 1], 0); },   // Reorder on the Templates page: the last one let go at the top (the app's own moveRootTo)
  "adds a package": () => macAdds({ id: "p9", name: "5 sessions", kind: "sessions", size: 5, inPerson: false }),
  "edits the other package": () => macEdits("p2", { name: "4-week plan", kind: "monthly", size: null, inPerson: true }),   // 4-week plan, In person on
};
const said = (p) => p.id + ": " + p.name + " (" + (p.size == null ? "no size" : p.size) + (p.inPerson ? ", In person" : "") + ")";
const pick = (d) => ({ packages: (d.packages || []).map(said), folders: (d.folders || []).map((f) => f.name), programs: d.rootOrder || null });
const want = (mine) => ({
  packages: ["p1: 12 sessions (12)", mine === "edits the other package" ? "p2: 4-week plan (no size, In person)" : "p2: 4-week plan (no size)", ...(mine === "adds a package" ? ["p9: 5 sessions (5)"] : [])],
  folders: [mine === "renames folder Strength" ? "Strength block" : "Strength", "Rehab", ...(mine === "adds a folder" ? ["Power"] : [])],
  programs: mine === "reorders the Programs" ? ["f2", "f1"] : null,
});
const afterSync = async () => { await sync(); const pk = fns.packageOf(maps.clients.get(C)), plan = maps.clients.get(C).plan; return { packageOf: pk ? said(pk) : null, card: plan.name + " (" + plan.size + ")" }; };   // the Mac's next sync: the package Jane's new workouts take (packageOf), and her card
const AGREE = { packageOf: "p1: 12 sessions (12)", card: "12 sessions (12)" };

for (const mine of Object.keys(MAC)) test("a package edited on the iPad (10 sessions made 12 sessions, size 12, In person off) stays when the Mac, open all along and not synced since, " + mine + ": the server and the Mac hold the iPad's 12 sessions beside the Mac's own change, and after the next sync the Packages list and Jane's card agree (the twenty-third check round: the Mac's save wrote its older 10 sessions back, In person on, while her card kept 12)", async () => {
  const sb = makeSupabase(); coach(sb); let log = {};
  sb.seed("ft_clients", TEMPLATES_ID, TPL()); sb.seed("ft_clients", C, JANE());
  try {
    await sync();                                                         // the Mac's last sync
    iPadEdits(sb);
    MAC[mine](); await settle();                                          // its save meets the iPad's newer copy (a conflict) and merges it
    log = { server: pick(sb.tables.ft_clients.get(TEMPLATES_ID).data), mac: pick(tc()), waiting: [...maps.dirty.keys()] };
    log.after = await afterSync();
  } finally { done(); }
  assert.deepStrictEqual(log.server, want(mine), "the server holds the Mac's older copy of the package the iPad edited, or lost the Mac's own change: " + JSON.stringify(log));
  assert.deepStrictEqual([log.mac, log.waiting], [want(mine), []], "the Mac shows other packages or folders than its save wrote (or the save still waits): " + JSON.stringify(log));
  assert.deepStrictEqual(log.after, AGREE, "after the sync the package on the Mac and Jane's card disagree (her new workouts would take the old package): " + JSON.stringify(log));
});

for (const then of ["a sync first", "the waiting save first"]) test("a package edited on the iPad stays when the Mac, with no signal, renames folder Strength (the save waits), and the signal comes back: " + then + " (the twenty-third check round: the waiting save merged the iPad's copy and still wrote the Mac's older 10 sessions back)", async () => {
  const sb = makeSupabase(); coach(sb); let log = {};
  sb.seed("ft_clients", TEMPLATES_ID, TPL()); sb.seed("ft_clients", C, JANE());
  try {
    await sync();
    iPadEdits(sb);
    sb.setFail({ times: 1e6, message: "Failed to fetch" });               // no signal on the Mac
    MAC["renames folder Strength"](); await settle();
    log.offline = { offline: app.get().offline, waiting: [...maps.dirty.keys()] };
    sb.setFail(null); app.set({ offline: false });                        // the signal back
    if (then === "a sync first") await sync(); else { fns.flushOne("clients", TEMPLATES_ID); await settle(); }
    log.server = pick(sb.tables.ft_clients.get(TEMPLATES_ID).data); log.mac = pick(tc()); log.waiting = [...maps.dirty.keys()];
    log.after = await afterSync();
  } finally { done(); }
  assert.deepStrictEqual(log.offline, { offline: true, waiting: ["clients/" + TEMPLATES_ID] }, "(the setup: the rename waits for the signal): " + JSON.stringify(log));
  assert.deepStrictEqual([log.server, log.mac, log.waiting], [want("renames folder Strength"), want("renames folder Strength"), []], "the waiting save wrote the Mac's older 10 sessions back (or lost the rename): " + JSON.stringify(log));
  assert.deepStrictEqual(log.after, AGREE, "after the sync the package on the Mac and Jane's card disagree: " + JSON.stringify(log));
});

test("no change for what each device changed on the packages themselves, the Mac open all along and not synced since: both edit one package (each detail separately, the owner's pick of 25 Nov 2026: what each changed stands), a package deleted on either side (deleted on the iPad and unchanged on the Mac goes, the audit's #9; deleted on the Mac stays deleted; edited on the Mac stays with the Mac's edit), both add one (both kept), and the Mac's edit put back as it was read (no change here: the iPad's edit stands)", async () => {
  const CASES = {
    "both edit 10 sessions": [(sb) => iPadEdits(sb), () => macEdits("p1", { name: "15 sessions", kind: "sessions", size: 15, inPerson: true }), ["p1: 15 sessions (15)", "p2: 4-week plan (no size)"]],   // (v316, the twenty-fourth check round, the owner's pick "Each detail separately": the Mac's new name and size, the iPad's In person off)
    "the iPad deletes 4-week plan, the Mac renames a folder": [(sb) => onIpad(sb, "ft_clients", TEMPLATES_ID, (d) => { d.packages = d.packages.filter((p) => p.id !== "p2"); }), MAC["renames folder Strength"], ["p1: 10 sessions (10, In person)"]],
    "the Mac deletes 10 sessions, the iPad edited it": [(sb) => iPadEdits(sb), () => macDeletes("p1"), ["p2: 4-week plan (no size)"]],
    "the iPad deletes 10 sessions, the Mac edited it": [(sb) => onIpad(sb, "ft_clients", TEMPLATES_ID, (d) => { d.packages = d.packages.filter((p) => p.id !== "p1"); }), () => macEdits("p1", { name: "15 sessions", kind: "sessions", size: 15, inPerson: true }), ["p1: 15 sessions (15, In person)", "p2: 4-week plan (no size)"]],
    "both add a package": [(sb) => onIpad(sb, "ft_clients", TEMPLATES_ID, (d) => { d.packages = [...d.packages, { id: "p8", name: "8 sessions", kind: "sessions", size: 8, inPerson: true }]; }), () => macAdds({ id: "p9", name: "5 sessions", kind: "sessions", size: 5, inPerson: false }), ["p1: 10 sessions (10, In person)", "p2: 4-week plan (no size)", "p9: 5 sessions (5)", "p8: 8 sessions (8, In person)"]],
    "the Mac edits 10 sessions, then puts it back as it was": [(sb) => iPadEdits(sb), () => { macEdits("p1", { name: "15 sessions", kind: "sessions", size: 15, inPerson: true }); macEdits("p1", { name: "10 sessions", kind: "sessions", size: 10, inPerson: true }); }, ["p1: 12 sessions (12)", "p2: 4-week plan (no size)"]],
  };
  const got = {}, wanted = {};
  for (const [how, [ipad, mac, end]] of Object.entries(CASES)) {
    const sb = makeSupabase(); coach(sb);
    sb.seed("ft_clients", TEMPLATES_ID, TPL()); sb.seed("ft_clients", C, JANE());
    try {
      await sync(); ipad(sb); mac(); await settle();
      got[how] = { server: pick(sb.tables.ft_clients.get(TEMPLATES_ID).data).packages, mac: pick(tc()).packages };
    } finally { done(); }
    wanted[how] = { server: end, mac: end };
  }
  assert.deepStrictEqual(got, wanted, "a package change of either device was lost, or one deleted came back: " + JSON.stringify(got));
});

// ---------- what the coach has read: a client's notes and finished workouts ----------
const noteAt = (label) => "2026-11-24T17:0" + label + ":00.000Z";       // when she wrote her note on the exercise numbered label (her note rule stamps it)
const exRow = (id, label, name, note) => ({ id, label, name, sets: 3, reps: "10", weights: [], repsDone: [], setsDone: 0, done: false, note: "", ...(note ? { clientNote: note, clientNoteBy: "client", clientNoteAt: noteAt(label) } : {}) });
const finished = (id, k, rows) => ({ id, clientId: C, title: "Legs", date: day(k), createdAt: AT, rows, completedAt: day(k) + "T17:30:00.000Z", completedBy: "client", skippedAt: null });
const noteId = (w, r) => "row/" + w + "/" + r;                            // main.js noteId: what clientNews lists (the exercise)
const seenMark = (w, r, label) => noteId(w, r) + "@" + noteAt(label);    // main.js noteMark: a note as read, its exercise and its time (v316, the twenty-fifth check round, R25-MRG-5)
const MARK_LINES = ['const noteId = (t, r) => "row/" + t.id + "/" + r.id;', 'const noteMark = (t, r) => noteId(t, r) + "@" + String(r.clientNoteAt || "");'];
const marksHeld = () => { for (const line of MARK_LINES) assert.ok(src.includes(line), "(the setup: main.js's noteId or noteMark no longer reads as this file copies them): " + line); };
const markNoteSeen = (id) => fns.markNoteSeen(maps.clients.get(C), id);   // her note tapped on the Mac (openClientNote): main.js's own markNoteSeen (until the twenty-fifth check round this file copied its lines)
const news = () => { const x = fns.clientNews(maps.clients.get(C)); return { notes: x.notes.map((e) => e.id).sort(), finished: x.workouts.map((t) => t.id).sort() }; };   // what the Mac shows as new: the red dots and "1 note", the New list

test("a note of Jane's read on the iPad stays read when the Mac, not synced since, reads her other note: both are read on the server, and after the Mac's next sync neither shows as news (the twenty-third check round: the Mac's list replaced the iPad's, and the note on Leg press came back as news on both devices)", async () => {
  marksHeld();
  const sb = makeSupabase(); coach(sb); let log = {};
  sb.seed("ft_clients", C, JANE()); sb.seed("ft_trainings", W1, finished(W1, -1, [exRow("r1", "1", "Leg press", "Knee felt tight"), exRow("r2", "2", "Leg curl", "Easy today")]), { client_id: C });
  try {
    await sync();
    log.before = news().notes;
    onIpad(sb, "ft_clients", C, (d) => { d.seenNotes = [seenMark(W1, "r1", "1")]; });   // the iPad: her note on Leg press tapped, saved
    markNoteSeen(noteId(W1, "r2")); await settle();                       // the Mac: her note on Leg curl tapped
    log.server = [...sb.tables.ft_clients.get(C).data.seenNotes].sort();
    await sync();
    log.after = news().notes;
  } finally { done(); }
  assert.deepStrictEqual(log.before, [noteId(W1, "r1"), noteId(W1, "r2")], "(the setup: both of her notes are news on the Mac): " + JSON.stringify(log));
  assert.deepStrictEqual([log.server, log.after], [[seenMark(W1, "r1", "1"), seenMark(W1, "r2", "2")], []], "a note read on the iPad shows as news again after the Mac read another: " + JSON.stringify(log));
});

test("a workout Jane finished, cleared from the New list on the iPad, stays cleared when the Mac, not synced since, leaves its own New list (markWorkoutsSeen): every one is read on the server, and after the Mac's next sync none is new (the twenty-third check round: the Mac's list of two replaced the iPad's three, and her newest workout was New again)", async () => {
  const sb = makeSupabase(); coach(sb); let log = {};
  sb.seed("ft_clients", C, JANE());
  sb.seed("ft_trainings", W1, finished(W1, -3, [exRow("a1", "1", "Back squat")]), { client_id: C }); sb.seed("ft_trainings", W2, finished(W2, -2, [exRow("a2", "1", "Back squat")]), { client_id: C });
  try {
    await sync();                                                         // the Mac knows W1 and W2, both New
    log.before = news().finished;
    sb.seed("ft_trainings", W3, finished(W3, -1, [exRow("a3", "1", "Back squat")]), { client_id: C });   // she finishes a third; the iPad syncs, its New list shown and left: all three read
    onIpad(sb, "ft_clients", C, (d) => { d.seenFinished = [W1, W2, W3]; d.seenDoneAt = "2026-11-24T18:00:00.000Z"; });
    fns.markWorkoutsSeen(maps.clients.get(C)); await settle();            // the Mac: its New list (W1, W2) shown and left
    log.server = [...sb.tables.ft_clients.get(C).data.seenFinished].sort();
    await sync();
    log.after = news().finished;
  } finally { done(); }
  assert.deepStrictEqual(log.before, [W1, W2].sort(), "(the setup: two finished workouts are New on the Mac): " + JSON.stringify(log));
  assert.deepStrictEqual([log.server, log.after], [[W1, W2, W3].sort(), []], "a finished workout cleared on the iPad is New again after the Mac cleared its own list: " + JSON.stringify(log));
});

test("a note the Mac forgot stays forgotten through the merge: Jane deleted her note on Leg press, which the coach had read; the iPad, its list unchanged, saves her new phone number; the Mac reads her Leg curl note; her new note on Leg press is news again, and the iPad's phone number stands (the three-way merge: only what the other device marked read since joins)", async () => {
  marksHeld();
  const sb = makeSupabase(); coach(sb); let log = {};
  sb.seed("ft_clients", C, { ...JANE(), seenNotes: [seenMark(W1, "r1", "1")] });   // her note on Leg press, read long ago
  sb.seed("ft_trainings", W1, finished(W1, -1, [exRow("r1", "1", "Leg press", "Knee felt tight"), exRow("r2", "2", "Leg curl", "Easy today")]), { client_id: C });
  try {
    await sync();
    onIpad(sb, "ft_trainings", W1, (d) => { const r = d.rows.find((x) => x.id === "r1"); delete r.clientNote; delete r.clientNoteBy; delete r.clientNoteAt; });   // her phone: that note deleted
    await sync();
    onIpad(sb, "ft_clients", C, (d) => { d.phone = "3105550199"; });       // the iPad: her new phone number (its list still names the deleted note)
    markNoteSeen(noteId(W1, "r2")); await settle();                       // the Mac: her Leg curl note tapped (the deleted one forgotten)
    log.server = [...sb.tables.ft_clients.get(C).data.seenNotes].sort();
    onIpad(sb, "ft_trainings", W1, (d) => { Object.assign(d.rows.find((x) => x.id === "r1"), { clientNote: "Knee is better now", clientNoteBy: "client", clientNoteAt: "2026-11-24T19:00:00.000Z" }); });   // her new note on Leg press
    await sync();
    log.after = news().notes; log.phone = sb.tables.ft_clients.get(C).data.phone;
  } finally { done(); }
  assert.deepStrictEqual(log, { server: [seenMark(W1, "r2", "2")], after: [noteId(W1, "r1")], phone: "3105550199" }, "her new note on Leg press is not news (the forgotten note came back as read), or the iPad's phone number was lost: " + JSON.stringify(log));
});

// ---------- the twenty-fourth check round: an id either device let go stays gone, the copy on screen joins, only ids join ----------
const threeNotes = () => finished(W1, -1, [exRow("r1", "1", "Leg press", "Knee felt tight"), exRow("r2", "2", "Leg curl", "Easy today"), exRow("r3", "3", "Calf raise", "Calf cramped")]);
const dropNote = (d, rid) => { const r = d.rows.find((x) => x.id === rid); delete r.clientNote; delete r.clientNoteBy; delete r.clientNoteAt; };   // her phone: her note on that exercise deleted
const newNote = (d, rid, text) => Object.assign(d.rows.find((x) => x.id === rid), { clientNote: text, clientNoteBy: "client", clientNoteAt: "2026-11-24T19:00:00.000Z" });   // her phone: a new note on that exercise (the same exercise, so the same id: noteId)
const listOf = (c, f) => [...((c && c[f]) || [])].sort();

test("a note the iPad let go stays gone when the Mac, not synced since, reads another of Jane's notes: she deleted her note on Leg press, read on both devices long ago; the iPad, synced, read her Leg curl note (its list let the deleted note go); the Mac, still showing the note on Leg press, then read her Calf raise note; the server and the Mac hold the two notes read and no more, and her new note on Leg press is news (the twenty-fourth check round: the join kept every id of the Mac's older list, the deleted note's came back as read, and her new note on that exercise was never news on either device)", async () => {
  marksHeld();
  const sb = makeSupabase(); coach(sb); let log = {};
  sb.seed("ft_clients", C, { ...JANE(), seenNotes: [seenMark(W1, "r1", "1")] });   // her note on Leg press, read long ago
  sb.seed("ft_trainings", W1, threeNotes(), { client_id: C });
  try {
    await sync();                                                         // the Mac's last sync
    log.before = news().notes;
    onIpad(sb, "ft_trainings", W1, (d) => dropNote(d, "r1"));             // her phone: that note deleted
    onIpad(sb, "ft_clients", C, (d) => { d.seenNotes = [seenMark(W1, "r2", "2")]; });   // the iPad, synced since: her Leg curl note tapped (markNoteSeen let the deleted one go)
    markNoteSeen(noteId(W1, "r3")); await settle();                       // the Mac: her Calf raise note tapped; its save meets the iPad's copy and merges it
    log.server = listOf(sb.tables.ft_clients.get(C).data, "seenNotes"); log.mac = listOf(maps.clients.get(C), "seenNotes");
    onIpad(sb, "ft_trainings", W1, (d) => newNote(d, "r1", "Knee is better now"));
    await sync();
    log.after = news().notes;
  } finally { done(); }
  const read = [seenMark(W1, "r2", "2"), seenMark(W1, "r3", "3")];
  assert.deepStrictEqual(log.before, [noteId(W1, "r2"), noteId(W1, "r3")], "(the setup: her notes on Leg curl and Calf raise are news on the Mac): " + JSON.stringify(log));
  assert.deepStrictEqual({ server: log.server, mac: log.mac }, { server: read, mac: read }, "the note the iPad let go came back as read (on the server, or on the Mac's screen): " + JSON.stringify(log));
  assert.deepStrictEqual(log.after, [noteId(W1, "r1")], "her new note on Leg press is not news: " + JSON.stringify(log));
});

test("a finish the iPad let go stays gone when the Mac, not synced since, leaves its New list: Jane took back her finish of the Legs two days ago (Undo); the iPad, synced, left its New list (its list let that finish go); the Mac then left its own; the server and the Mac hold only yesterday's, and when she finishes the earlier one again it is New (the twenty-fourth check round: the Mac's older list put the finish taken back in again as read, and her second finish never showed as New)", async () => {
  const sb = makeSupabase(); coach(sb); let log = {};
  sb.seed("ft_clients", C, { ...JANE(), seenFinished: [W1], seenDoneAt: "2026-11-23T10:00:00.000Z" });   // the one two days ago, finished and seen long ago
  sb.seed("ft_trainings", W1, finished(W1, -2, [exRow("a1", "1", "Back squat")]), { client_id: C }); sb.seed("ft_trainings", W2, finished(W2, -1, [exRow("a2", "1", "Back squat")]), { client_id: C });
  try {
    await sync();                                                         // the Mac's last sync: yesterday's is New
    log.before = news().finished;
    onIpad(sb, "ft_trainings", W1, (d) => { d.completedAt = null; delete d.completedBy; });   // her phone: Undo on the one two days ago
    onIpad(sb, "ft_clients", C, (d) => { d.seenFinished = [W2]; d.seenDoneAt = "2026-11-24T18:00:00.000Z"; });   // the iPad, synced since: its New list left (markWorkoutsSeen keeps only the finishes still there)
    fns.markWorkoutsSeen(maps.clients.get(C)); await settle();            // the Mac: its New list (yesterday's) left; the save meets the iPad's copy and merges it
    log.server = listOf(sb.tables.ft_clients.get(C).data, "seenFinished"); log.mac = listOf(maps.clients.get(C), "seenFinished");
    onIpad(sb, "ft_trainings", W1, (d) => { d.completedAt = day(-2) + "T18:15:00.000Z"; d.completedBy = "client"; });   // she finishes it again
    await sync();
    log.after = news().finished;
  } finally { done(); }
  assert.deepStrictEqual(log.before, [W2], "(the setup: yesterday's workout is New on the Mac): " + JSON.stringify(log));
  assert.deepStrictEqual({ server: log.server, mac: log.mac }, { server: [W2], mac: [W2] }, "the finish the iPad let go came back as read (on the server, or on the Mac's screen): " + JSON.stringify(log));
  assert.deepStrictEqual(log.after, [W1], "her second finish is not New: " + JSON.stringify(log));
});

test("the Mac's copy on screen takes the iPad's read mark at the merging save, before any sync: the iPad read Jane's note on Leg press; the Mac, not synced since, read her Leg curl note; at once the Mac shows only her Calf raise note as news, and when the coach reads that one too the server holds all three (the twenty-fourth check round's test: with the join on the copy sent alone, the Mac showed the note read on the iPad as news until its next sync, and its next read took the iPad's mark off the server)", async () => {
  marksHeld();
  const sb = makeSupabase(); coach(sb); let log = {};
  sb.seed("ft_clients", C, JANE()); sb.seed("ft_trainings", W1, threeNotes(), { client_id: C });
  try {
    await sync();
    onIpad(sb, "ft_clients", C, (d) => { d.seenNotes = [seenMark(W1, "r1", "1")]; });   // the iPad: her note on Leg press tapped
    markNoteSeen(noteId(W1, "r2")); await settle();                       // the Mac: her Leg curl note tapped; its save meets the iPad's copy and merges it
    log.mac = news().notes; log.server = listOf(sb.tables.ft_clients.get(C).data, "seenNotes");
    markNoteSeen(noteId(W1, "r3")); await settle();                       // the Mac, before its next sync: her Calf raise note tapped
    log.mac2 = news().notes; log.server2 = listOf(sb.tables.ft_clients.get(C).data, "seenNotes");
  } finally { done(); }
  assert.deepStrictEqual({ mac: log.mac, server: log.server }, { mac: [noteId(W1, "r3")], server: [seenMark(W1, "r1", "1"), seenMark(W1, "r2", "2")] }, "after its merging save the Mac still shows the note read on the iPad as news, or the server lost a mark: " + JSON.stringify(log));
  assert.deepStrictEqual({ mac: log.mac2, server: log.server2 }, { mac: [], server: [seenMark(W1, "r1", "1"), seenMark(W1, "r2", "2"), seenMark(W1, "r3", "3")] }, "the Mac's next read took the iPad's mark off the server: " + JSON.stringify(log));
});

test("an entry of the read lists that is not an id (a damaged record, as a hand-edited backup can bring) never doubles: four saves of the Mac, each meeting a newer copy of the iPad's, keep each list as long as it was or shorter, with its ids (the twenty-fourth check round: that entry was added again at every merge, 3, 5, 9, 17)", async () => {
  const sb = makeSupabase(); coach(sb); const log = { lens: [] };
  sb.seed("ft_clients", C, { ...JANE(), seenFinished: [W1, { id: W2 }], seenNotes: [noteId(W1, "a1"), { id: "x" }] });
  try {
    await sync();
    for (let i = 0; i < 4; i++) {
      onIpad(sb, "ft_clients", C, (d) => { d.phone = "31055501" + (40 + i); });   // the iPad: her phone number (its lists as they were)
      maps.clients.get(C).name = "Jane Sample " + (i + 2); fns.scheduleSave("clients", C); await settle();   // the Mac: her name; its save meets the iPad's copy and merges it
      const s = sb.tables.ft_clients.get(C).data; log.lens.push([s.seenFinished.length, s.seenNotes.length]);
    }
    const s = sb.tables.ft_clients.get(C).data, m = maps.clients.get(C);
    log.mac = [m.seenFinished.length, m.seenNotes.length];
    log.ids = { server: [s.seenFinished.includes(W1), s.seenNotes.includes(noteId(W1, "a1"))], mac: [m.seenFinished.includes(W1), m.seenNotes.includes(noteId(W1, "a1"))] };
  } finally { done(); }
  assert.ok(log.lens.every(([a, b]) => a <= 2 && b <= 2) && log.mac.every((x) => x <= 2), "a list grew at a merge: " + JSON.stringify(log));
  assert.deepStrictEqual(log.ids, { server: [true, true], mac: [true, true] }, "an id of the list was lost: " + JSON.stringify(log));
});

// The twenty-fifth check round (R25-TW-11): the test above counts the lists' lengths only. With the second filter of the join gone (the server's
// entries taken as they are), an entry that is not an id still joined at every merge, one for one, so the lengths never grew and no test saw it.
test("an entry of the read lists that is not an id (a damaged record: an object, a number, nothing) leaves at the Mac's merging save and never comes back from the server's copy: after the Mac's save meets the iPad's newer copy (her phone number), the server and the Mac hold her ids and nothing else (the twenty-fifth check round, R25-TW-11: only ids join, which no test checked)", async () => {
  const sb = makeSupabase(); coach(sb); let log = {};
  sb.seed("ft_clients", C, { ...JANE(), seenFinished: [W1, { id: W2 }, 7], seenNotes: [seenMark(W1, "a1", "1"), { id: "x" }, null] });
  try {
    await sync();
    onIpad(sb, "ft_clients", C, (d) => { d.phone = "3105550199"; });       // the iPad: her phone number (its lists as they were)
    maps.clients.get(C).name = "Jane Sample 2"; fns.scheduleSave("clients", C); await settle();   // the Mac: her name; its save meets the iPad's copy and merges it
    const s = sb.tables.ft_clients.get(C).data, m = maps.clients.get(C);
    log = { server: { finished: s.seenFinished, notes: s.seenNotes, phone: s.phone }, mac: { finished: m.seenFinished, notes: m.seenNotes, phone: m.phone } };
  } finally { done(); }
  const want = { finished: [W1], notes: [seenMark(W1, "a1", "1")], phone: "3105550199" };
  assert.deepStrictEqual(log, { server: want, mac: want }, "an entry that is not an id joined at the merge, or an id (or the iPad's phone number) was lost: " + JSON.stringify(log));
});

// ---------- an exercise deleted on the iPad and changed on the Mac ----------
const legs = (rows) => ({ id: W1, clientId: C, title: "Legs", date: day(0), createdAt: AT, rows, completedAt: null, skippedAt: null });   // Jane's Legs today
const lift = (id, label, name, logged = false) => ({ ...exRow(id, label, name), ...(logged ? { weights: ["135", "135", "135"], repsDone: ["8", "8", "8"], setsDone: 3, done: true, unit: "lb" } : {}) });
const iPadDeletes = (sb, ...rids) => onIpad(sb, "ft_trainings", W1, (d) => { for (const rid of rids) { const gone = d.rows.find((x) => x.id === rid); d.rows = d.rows.filter((x) => x.id !== rid); fns.renumber(d, gone, false); } });   // the iPad: Delete exercise on each (main.js deleteRow: the numbers after it close up), its save landed
const macRow = (rid) => maps.trainings.get(W1).rows.find((x) => x.id === rid);
const coachLogged = (rid) => { if (!maps.trainerTouched.has(W1)) maps.trainerTouched.set(W1, new Set()); maps.trainerTouched.get(W1).add(rid); };   // the coach's log on that exercise (the weight box's mark, Mark set as not done)
const MAC_CHANGE = {                                                      // what the Mac changes on an exercise, as main.js's own lines do it, and what shows it was kept
  "its planned reps": [(rid) => { macRow(rid).reps = "12"; }, (r) => r.reps === "12"],   // the reps box (bind ".reps")
  "a weight typed": [(rid) => { const r = macRow(rid); r.weights = ["145"]; if (!r.unit) r.unit = "lb"; coachLogged(rid); }, (r) => r.weights[0] === "145"],   // set 1's weight box (mark)
  "Mark set 1 as not done": [(rid) => { const r = macRow(rid); r.setsDone = 0; r.done = false; delete r.earlyReason; r.repsDone = r.repsDone.map(() => ""); coachLogged(rid); }, (r) => !r.done && !(r.setsDone > 0)],   // its finished card's Mark set 1 as not done, once the question is answered
};
const DELETE_LINES = ["t.rows = t.rows.filter((x) => x.id !== r.id); renumber(t, r); if (!tpl) touchState(t.id, \"orderDel\"); save();", 'bind(".reps", "reps");', "const mark = () => { if (!trainings.has(t.id)) return; const track = S.clientMode ? pendingWeightRows : trainerTouched; if (!track.has(t.id)) track.set(t.id, new Set()); track.get(t.id).add(r.id); save(); };", 'r.setsDone = Math.min(doneCount(r), sel); r.done = false; markEarly(T, r, ""); for (let j = sel; j < (r.repsDone || []).length; j++) r.repsDone[j] = "";'];
const cardsOf = (rows) => { const ys = JSON.parse(JSON.stringify(rows || [])); tidyLabels(ys); ys.sort((a, b) => cmpLabel(a.label, b.label)); return fns.groupsOf(ys).map((g) => g.rows.map((r) => r.label + " " + r.name).join(" + ")); };   // the cards as the page draws them: its numbers tidied (normalizeLabels), a superset one card
const together = (cards) => cards.map((c) => c.split(" + ").map((x) => x.replace(/^\S+ /, "")).sort().join(" + ")).sort();   // which exercises share a card, whatever its number

for (const change of Object.keys(MAC_CHANGE)) test("an exercise deleted on the iPad and changed on the Mac, open on that workout and not synced since (" + change + "), comes back after the others, on a number of its own: the iPad deleted Back squat, exercise 1 of Jane's Legs (Leg curl and Calf raise closed up to 1 and 2); the server, the Mac and the Mac after its next sync draw three cards, 1 Leg curl, 2 Calf raise, 3 Back squat, with the Mac's change (the twenty-fourth check round: Back squat kept its old 1 beside Leg curl's new 1, a superset nobody made, saved to the server and her phone)", async () => {
  for (const line of DELETE_LINES) assert.ok(src.includes(line), "(the setup: main.js's Delete exercise, reps box, weight box or Mark set as not done no longer reads as this file copies it): " + line);
  const sb = makeSupabase(); coach(sb); let log = {}; const [edit, kept] = MAC_CHANGE[change];
  sb.seed("ft_clients", C, JANE()); sb.seed("ft_trainings", W1, legs([lift("r1", "1", "Back squat", change === "Mark set 1 as not done"), lift("r2", "2", "Leg curl"), lift("r3", "3", "Calf raise")]), { client_id: C });
  try {
    await sync();                                                         // the Mac's last sync
    iPadDeletes(sb, "r1"); log.iPad = cardsOf(sb.tables.ft_trainings.get(W1).data.rows);
    edit("r1"); fns.scheduleSave("trainings", W1); await settle();        // the Mac: Back squat changed; its save meets the iPad's copy and merges it
    const sq = sb.tables.ft_trainings.get(W1).data.rows.find((x) => x.id === "r1");
    log.server = cardsOf(sb.tables.ft_trainings.get(W1).data.rows); log.mac = cardsOf(maps.trainings.get(W1).rows); log.kept = !!sq && kept(sq);
    await sync(); log.after = cardsOf(maps.trainings.get(W1).rows);
  } finally { done(); }
  const want = ["1 Leg curl", "2 Calf raise", "3 Back squat"];
  assert.deepStrictEqual(log.iPad, ["1 Leg curl", "2 Calf raise"], "(the setup: the iPad's Delete exercise closes up the rest): " + JSON.stringify(log));
  assert.deepStrictEqual({ server: log.server, mac: log.mac, after: log.after, kept: log.kept }, { server: want, mac: want, after: want, kept: true }, "Back squat shares a card with the exercise the iPad moved onto its number (a superset nobody made), or the Mac's change on it was lost: " + JSON.stringify(log));
});

for (const route of ["online", "with no signal, then a sync first", "with no signal, then the waiting save first"]) test("a superset deleted on the iPad and changed on the Mac, both its exercises, not synced since (" + route + "), comes back whole after the others: the iPad deleted superset 1 of Jane's Legs (1a Back squat, 1b Lunge; Leg curl and Calf raise closed up to 1 and 2); the server, the Mac and the Mac after its next sync draw 1 Leg curl, 2 Calf raise, then 3a Back squat and 3b Lunge, one superset (the twenty-fourth check round: Leg curl's new 1 joined them, a tri-set nobody made)", async () => {
  const sb = makeSupabase(); coach(sb); let log = {};
  sb.seed("ft_clients", C, JANE()); sb.seed("ft_trainings", W1, legs([lift("r1", "1a", "Back squat"), lift("r4", "1b", "Lunge"), lift("r2", "2", "Leg curl"), lift("r3", "3", "Calf raise")]), { client_id: C });
  try {
    await sync();
    iPadDeletes(sb, "r1", "r4");
    if (route !== "online") sb.setFail({ times: 1e6, message: "Failed to fetch" });   // no signal on the Mac
    MAC_CHANGE["its planned reps"][0]("r1"); MAC_CHANGE["a weight typed"][0]("r4"); fns.scheduleSave("trainings", W1); await settle();   // the Mac: Back squat's planned reps, a weight typed on Lunge
    if (route !== "online") {
      log.offline = { offline: app.get().offline, waiting: [...maps.dirty.keys()] };
      sb.setFail(null); app.set({ offline: false });                      // the signal back
      if (route.endsWith("a sync first")) await sync(); else { fns.flushOne("trainings", W1); await settle(); }
    }
    log.server = cardsOf(sb.tables.ft_trainings.get(W1).data.rows); log.mac = cardsOf(maps.trainings.get(W1).rows); log.waiting = [...maps.dirty.keys()];
    await sync(); log.after = cardsOf(maps.trainings.get(W1).rows);
  } finally { done(); }
  const want = ["1 Leg curl", "2 Calf raise", "3a Back squat + 3b Lunge"];
  if (route !== "online") assert.deepStrictEqual(log.offline, { offline: true, waiting: ["trainings/" + W1] }, "(the setup: the Mac's changes wait for the signal): " + JSON.stringify(log));
  assert.deepStrictEqual({ server: log.server, mac: log.mac, waiting: log.waiting, after: log.after }, { server: want, mac: want, waiting: [], after: want }, "the superset the iPad deleted took in Leg curl (a tri-set nobody made), or came back split: " + JSON.stringify(log));
});

test("no change for a superset the iPad only shortened, the Mac open all along and not synced since: the iPad deleted Lunge (1b) from superset 1 and the Mac changed Lunge: it stays in superset 1 with Back squat (the twenty-fourth check round's rule moves an exercise deleted there and kept here only off a number the iPad gave another exercise, and a superset moves whole); and a superset the Mac's own Delete exercise only renumbered stays deleted: the iPad deleted superset 2 (2a Lunge, 2b Step-up) and the Mac deleted Back squat, exercise 1 (its Delete exercise moved 2a and 2b to 1a and 1b, their number and nothing else): Leg curl is the only card left (v321, the twenty-sixth check round, R26-MRG-1: a number changed here read as a change, and the superset came back)", async () => {
  const CASES = {
    "the iPad deletes Lunge, the Mac changed it": [[lift("r1", "1a", "Back squat"), lift("r4", "1b", "Lunge"), lift("r2", "2", "Leg curl")], (sb) => iPadDeletes(sb, "r4"), () => MAC_CHANGE["its planned reps"][0]("r4"), ["Back squat + Lunge", "Leg curl"]],
    "the iPad deletes superset 2, the Mac deletes Back squat": [[lift("r1", "1", "Back squat"), lift("r4", "2a", "Lunge"), lift("r5", "2b", "Step-up"), lift("r2", "3", "Leg curl")], (sb) => iPadDeletes(sb, "r4", "r5"), () => { const t = maps.trainings.get(W1), r = macRow("r1"); t.rows = t.rows.filter((x) => x.id !== r.id); fns.renumber(t, r); fns.touchState(W1, "orderDel"); }, ["Leg curl"]],   // the card's Delete exercise (deleteRow), once its question is answered (DELETE_LINES[0]: it claims the order)
  };
  const got = {}, wanted = {}, drawn = {};
  for (const [how, [rows, ipad, mac, end]] of Object.entries(CASES)) {
    const sb = makeSupabase(); coach(sb);
    sb.seed("ft_clients", C, JANE()); sb.seed("ft_trainings", W1, legs(rows), { client_id: C });
    try {
      await sync(); ipad(sb); mac(); fns.scheduleSave("trainings", W1); await settle();
      drawn[how] = { server: cardsOf(sb.tables.ft_trainings.get(W1).data.rows), mac: cardsOf(maps.trainings.get(W1).rows), waiting: [...maps.dirty.keys()] };
      got[how] = { server: together(drawn[how].server), mac: together(drawn[how].mac), waiting: drawn[how].waiting };
    } finally { done(); }
    wanted[how] = { server: end, mac: end, waiting: [] };
  }
  assert.deepStrictEqual(got, wanted, "a superset the iPad only shortened was split, or one the Mac renumbered came back split or joined with Leg curl: " + JSON.stringify(drawn));
});

// ---------- both devices add an exercise before either synced (the twenty-fifth check round, R25-MRG-1, R25-MRG-4) ----------
// + Add exercise numbers a new exercise one past the highest number its device holds (nextLabel). The iPad added Plank to Jane's Legs (3), and the
// Mac, open on the workout and not synced since, added Calf raise (3 as well): the Mac's save kept both on 3, and the page tidied them into 3a and
// 3b, a superset nobody made (a transition between them), saved to the server and her phone. The iPad's two and the Mac's one made 3a, 3b and 4;
// the Mac's own superset and the iPad's one, a tri-set. And the twenty-fourth round's rule split a superset the coach had just made: the iPad
// deleted Calf raise (3), the Mac changed it and joined a new Step-up to it (the number picker, 3); Step-up, new on the Mac, read as a card the
// iPad had moved onto 3. Now an exercise only this device has (deleted there and kept here, or added here) moves after the others only when a
// card the server holds was moved onto its number, and that number's card is not one both copies still hold there; and the cards only this
// device has above the server's highest number close up after it (the iPad's Delete exercise and the Mac's + Add exercise left 1, 2, 4).
// The Mac's + Add exercise is main.js's own (addExercise), and its page is drawn by main.js's own render: the numbers tidied and saved
// (normalizeLabels, tidySave) before the cards, which this stand-in page cannot draw (caught, as relaunch-merge.test.js does).
const ADD_LINES = [                                                       // main.js's lines this section copies: + Add exercise on the iPad (nextLabel, newRow), the name typed, the number picker
  "function nextLabel(t) { let max = 0; for (const r of t.rows) { const n = labelKey(r.label)[0]; if (Number.isFinite(n)) max = Math.max(max, n); } return String(max + 1); }",
  'function newRow(label) { return { id: uid(), label, name: "", sets: 4, reps: "", tempo: "", rest: "", weights: [], repsDone: [], setsDone: 0, note: "" }; }',
  'const r = newRow(nextLabel(t)); t.rows.push(r); scheduleSave("trainings", t.id);',
  'q(".name").addEventListener("input", (e) => { r.name = e.target.value.replace(/\\n/g, " "); markNamed();',
  "const markNamed = () => { if (S.clientMode) return; if (!trainerNamed.has(t.id)) trainerNamed.set(t.id, new Set()); trainerNamed.get(t.id).add(r.id); };",
  'r.label = n; lastEditedId = r.id; ownNumber(from); q(".label").value = n; numpick.hidden = true; takeCardSets(cur); save(); S.renderedTraining = null; render();',   // (v321, R26-CRD-7: the picker also moves the card state with the number, ownNumber; card state is no part of what this file reads)
];
const addHeld = () => { for (const line of ADD_LINES) assert.ok(src.includes(line), "(the setup: main.js's + Add exercise, name box or number picker no longer reads as this file copies it): " + line); };
const iPadAdds = (sb, id, name, join) => onIpad(sb, "ft_trainings", W1, (d) => {   // the iPad: + Add exercise (newRow(nextLabel(t))), its name typed, and with join its number picked (its page tidies the numbers), its save landed
  let max = 0; for (const r of d.rows) { const k = labelKey(r.label)[0]; if (Number.isFinite(k)) max = Math.max(max, k); }
  d.rows.push({ id, label: String(max + 1), name, sets: 4, reps: "", tempo: "", rest: "", weights: [], repsDone: [], setsDone: 0, note: "" });
  if (join != null) { d.rows[d.rows.length - 1].label = String(join); tidyLabels(d.rows, id); }
});
const onWorkout = (fn) => { app.set({ view: { name: "training", id: W1 }, renderedTraining: null }); try { fn(); } catch (_) {} app.set({ view: { name: "clients" }, renderedTraining: null }); };   // on the Mac's page of the workout (what comes before the cards' draw runs; the draw itself is caught)
const macPage = () => onWorkout(() => fns.render());                    // the Mac's page drawn: its numbers tidied and saved (renderTraining: normalizeLabels, tidySave)
const macNew = (name) => { onWorkout(() => fns.addExercise()); const t = maps.trainings.get(W1), r = t.rows[t.rows.length - 1]; r.name = name; if (!maps.trainerNamed.has(W1)) maps.trainerNamed.set(W1, new Set()); maps.trainerNamed.get(W1).add(r.id); fns.scheduleSave("trainings", W1); return r.id; };   // the Mac: + Add exercise (main.js addExercise: numbered next, saved), then its name typed (the name box: r.name, markNamed, save)
const macJoins = (rid, num) => { macRow(rid).label = String(num); fns.scheduleSave("trainings", W1); macPage(); };   // the card's number picker: that number, saved, the page drawn again (3 and 3 tidied into 3a and 3b, and saved)
const two = () => [lift("r1", "1", "Back squat"), lift("r2", "2", "Leg curl")];
const signalBack = async (sb, route) => { sb.setFail(null); app.set({ offline: false }); if (route.endsWith("a sync first")) await sync(); else { fns.flushOne("trainings", W1); await settle(); } };   // the signal back on the Mac, then a sync first or its waiting save first

for (const route of ["online", "with no signal, then a sync first", "with no signal, then the waiting save first"]) test("both devices add an exercise to Jane's Legs before either synced (" + route + "): the iPad added Plank and the Mac, open on the workout, Calf raise, + Add exercise numbering each 3; the server, the Mac and the Mac after its next sync draw four cards, 1 Back squat, 2 Leg curl, 3 Plank, 4 Calf raise (the twenty-fifth check round, R25-MRG-1: both kept 3, and the page made them one superset nobody made, 3a Calf raise + 3b Plank, saved to the server and her phone)", async () => {
  addHeld();
  const sb = makeSupabase(); coach(sb); let log = {};
  sb.seed("ft_clients", C, JANE()); sb.seed("ft_trainings", W1, legs(two()), { client_id: C });
  try {
    await sync(); macPage();                                              // the Mac's last sync; the coach opens Jane's Legs
    iPadAdds(sb, "r8", "Plank"); log.iPad = cardsOf(sb.tables.ft_trainings.get(W1).data.rows);
    if (route !== "online") sb.setFail({ times: 1e6, message: "Failed to fetch" });   // no signal on the Mac
    macNew("Calf raise"); log.macAlone = cardsOf(maps.trainings.get(W1).rows); await settle();   // its save meets the iPad's copy and merges it (or waits for the signal)
    if (route !== "online") { log.offline = { offline: app.get().offline, waiting: [...maps.dirty.keys()] }; await signalBack(sb, route); }
    macPage(); await settle();                                            // the page drawn after the merge (what it tidies is saved)
    log.server = cardsOf(sb.tables.ft_trainings.get(W1).data.rows); log.mac = cardsOf(maps.trainings.get(W1).rows); log.waiting = [...maps.dirty.keys()];
    await sync(); log.after = cardsOf(maps.trainings.get(W1).rows);
  } finally { done(); }
  const want = ["1 Back squat", "2 Leg curl", "3 Plank", "4 Calf raise"];
  assert.deepStrictEqual([log.iPad, log.macAlone], [["1 Back squat", "2 Leg curl", "3 Plank"], ["1 Back squat", "2 Leg curl", "3 Calf raise"]], "(the setup: each device's + Add exercise numbered its new exercise 3): " + JSON.stringify(log));
  if (route !== "online") assert.deepStrictEqual(log.offline, { offline: true, waiting: ["trainings/" + W1] }, "(the setup: the Mac's save waits for the signal): " + JSON.stringify(log));
  assert.deepStrictEqual({ server: log.server, mac: log.mac, waiting: log.waiting, after: log.after }, { server: want, mac: want, waiting: [], after: want }, "Plank and Calf raise share a card (a superset nobody made), or one was lost: " + JSON.stringify(log));
});

test("both devices adding exercises keep each one's cards as made, the Mac with no signal while it works, then its waiting save once the signal is back: the iPad's two (Plank, Side plank) and the Mac's one (Calf raise) make 3, 4 and 5; the Mac's own superset (Calf raise, then Step-up given its number, 3) and the iPad's Plank make 3 Plank and the superset 4a and 4b; a new exercise each joined into superset 2 (the number picker) makes one superset of four; the iPad deleted Calf raise (3) and the Mac changed it and joined a new Step-up to it: one superset, 3a Calf raise + 3b Step-up; and no change for the Mac's own superset and Hip thrust after it when the iPad renamed the workout (the twenty-fifth check round, R25-MRG-1: a superset nobody made, a tri-set, and the twenty-fourth round's rule splitting his own superset into 3 Step-up and 4 Calf raise)", async () => {
  addHeld();
  const CASES = {                                                         // [the rows seeded, the iPad's change, the Mac's change, the cards after]
    "the iPad adds two, the Mac one": [two(), (sb) => { iPadAdds(sb, "r8", "Plank"); iPadAdds(sb, "r7", "Side plank"); }, () => macNew("Calf raise"), ["1 Back squat", "2 Leg curl", "3 Plank", "4 Side plank", "5 Calf raise"]],
    "the Mac makes a superset of its own, the iPad adds one": [two(), (sb) => iPadAdds(sb, "r8", "Plank"), () => { macNew("Calf raise"); macJoins(macNew("Step-up"), 3); }, ["1 Back squat", "2 Leg curl", "3 Plank", "4a Calf raise + 4b Step-up"]],
    "each joins a new exercise into superset 2": [[lift("r1", "1", "Back squat"), lift("r2", "2a", "Leg curl"), lift("r3", "2b", "Lunge")], (sb) => iPadAdds(sb, "r8", "Plank", 2), () => macJoins(macNew("Step-up"), 2), ["1 Back squat", "2a Leg curl + 2b Lunge + 2c Step-up + 2d Plank"]],
    "the iPad deletes Calf raise, the Mac changes it and joins Step-up to it": [[...two(), lift("r3", "3", "Calf raise")], (sb) => iPadDeletes(sb, "r3"), () => { MAC_CHANGE["its planned reps"][0]("r3"); macJoins(macNew("Step-up"), 3); }, ["1 Back squat", "2 Leg curl", "3a Calf raise + 3b Step-up"]],
    "the iPad renames the workout, the Mac makes a superset and adds Hip thrust after it": [two(), (sb) => onIpad(sb, "ft_trainings", W1, (d) => { d.title = "Legs day"; }), () => { macNew("Calf raise"); macJoins(macNew("Step-up"), 3); macNew("Hip thrust"); }, ["1 Back squat", "2 Leg curl", "3a Calf raise + 3b Step-up", "4 Hip thrust"]],
  };
  const got = {}, wanted = {};
  for (const [how, [rows, ipad, mac, end]] of Object.entries(CASES)) {
    const sb = makeSupabase(); coach(sb);
    sb.seed("ft_clients", C, JANE()); sb.seed("ft_trainings", W1, legs(rows), { client_id: C });
    try {
      await sync(); macPage(); ipad(sb);
      sb.setFail({ times: 1e6, message: "Failed to fetch" });             // no signal on the Mac while it works
      mac(); await settle(); await signalBack(sb, "the waiting save first"); macPage(); await settle();
      got[how] = { server: cardsOf(sb.tables.ft_trainings.get(W1).data.rows), mac: cardsOf(maps.trainings.get(W1).rows), waiting: [...maps.dirty.keys()] };
      await sync(); got[how].after = cardsOf(maps.trainings.get(W1).rows);
      if (how.startsWith("the iPad renames")) got[how].title = sb.tables.ft_trainings.get(W1).data.title;
    } finally { done(); }
    wanted[how] = { server: end, mac: end, waiting: [], after: end, ...(how.startsWith("the iPad renames") ? { title: "Legs day" } : {}) };
  }
  assert.deepStrictEqual(got, wanted, "two devices' new exercises shared a card, or the coach's own superset was split, or his cards changed order: " + JSON.stringify(got));
});

const numbers = (cards) => cards.map((c) => parseInt(c, 10));            // the cards' numbers, top to bottom
for (const changed of [false, true]) test("a deletion on the iPad and an exercise added on the Mac leave no number out: the iPad deleted Back squat, exercise 1 of Jane's Legs (Leg curl and Hip thrust closed up to 1 and 2), and the Mac, open on the workout and not synced since, " + (changed ? "changed Back squat's planned reps and " : "") + "added Calf raise (+ Add exercise numbered it 4); the server, the Mac and the Mac after its next sync number the cards " + (changed ? "1 to 4, Back squat and Calf raise each a card of its own" : "1 Leg curl, 2 Hip thrust, 3 Calf raise") + " (the twenty-fifth check round, R25-MRG-4: Exercise 1, 2, 4" + (changed ? ", 5" : "") + ", and she looked for an exercise 3)", async () => {
  addHeld();
  const sb = makeSupabase(); coach(sb); let log = {};
  sb.seed("ft_clients", C, JANE()); sb.seed("ft_trainings", W1, legs([lift("r1", "1", "Back squat"), lift("r2", "2", "Leg curl"), lift("r3", "3", "Hip thrust")]), { client_id: C });
  try {
    await sync(); macPage();
    iPadDeletes(sb, "r1"); log.iPad = cardsOf(sb.tables.ft_trainings.get(W1).data.rows);
    if (changed) MAC_CHANGE["its planned reps"][0]("r1");
    macNew("Calf raise"); log.macAlone = cardsOf(maps.trainings.get(W1).rows); await settle();   // its save meets the iPad's copy and merges it
    macPage(); await settle();
    log.server = cardsOf(sb.tables.ft_trainings.get(W1).data.rows); log.mac = cardsOf(maps.trainings.get(W1).rows); log.waiting = [...maps.dirty.keys()];
    await sync(); log.after = cardsOf(maps.trainings.get(W1).rows);
  } finally { done(); }
  assert.deepStrictEqual([log.iPad, log.macAlone[3]], [["1 Leg curl", "2 Hip thrust"], "4 Calf raise"], "(the setup: the iPad's Delete exercise closed up the rest, the Mac's + Add exercise numbered Calf raise 4): " + JSON.stringify(log));
  const look = (cards) => (changed ? { numbers: numbers(cards), cards: together(cards) } : cards);
  const want = changed ? { numbers: [1, 2, 3, 4], cards: ["Back squat", "Calf raise", "Hip thrust", "Leg curl"] } : ["1 Leg curl", "2 Hip thrust", "3 Calf raise"];
  assert.deepStrictEqual({ server: look(log.server), mac: look(log.mac), waiting: log.waiting, after: look(log.after) }, { server: want, mac: want, waiting: [], after: want }, "a number was left out (or an exercise lost, or two shared a card): " + JSON.stringify(log));
});

// The twenty-fifth check round (R25-TW-11): the deleted-exercise rule above stays out of the coach's Reorder (keepAll: settleOrder places the cards
// once, by his numbers). With that guard gone no test failed, while his Reorder lost to the iPad's numbers.
test("the coach's Reorder stands beside an exercise the iPad deleted: on the Mac, not synced since, Reorder put Leg curl last (3) and the coach changed its reps; the iPad had deleted Leg curl and added Hip thrust (3); the server, the Mac and the Mac after its next sync draw 1 Back squat, 2 Calf raise, 3 Leg curl, 4 Hip thrust (the twenty-fifth check round, R25-TW-11: run under his Reorder's claim, the deleted-exercise rule put Hip thrust on 3 and Leg curl after it, against his order)", async () => {
  addHeld();
  const sb = makeSupabase(); coach(sb); let log = {};
  sb.seed("ft_clients", C, JANE()); sb.seed("ft_trainings", W1, legs([lift("r1", "1", "Back squat"), lift("r2", "2", "Leg curl"), lift("r3", "3", "Calf raise")]), { client_id: C });
  try {
    await sync();                                                         // the Mac's last sync
    iPadDeletes(sb, "r2"); iPadAdds(sb, "r9", "Hip thrust"); log.iPad = cardsOf(sb.tables.ft_trainings.get(W1).data.rows);   // the iPad: Delete exercise on Leg curl (Calf raise closed up to 2), then + Add exercise, Hip thrust
    log.moved = fns.roCards(maps.trainings.get(W1), "r2", 2, false);      // the Mac: Reorder, Leg curl's card let go last (main.js roCards: the numbers follow the places, his order claimed, saved)
    MAC_CHANGE["its planned reps"][0]("r2"); fns.scheduleSave("trainings", W1); await settle();   // then Leg curl's reps; the save meets the iPad's copy and merges it
    log.server = cardsOf(sb.tables.ft_trainings.get(W1).data.rows); log.mac = cardsOf(maps.trainings.get(W1).rows); log.waiting = [...maps.dirty.keys()];
    log.kept = (sb.tables.ft_trainings.get(W1).data.rows.find((x) => x.id === "r2") || {}).reps;
    await sync(); log.after = cardsOf(maps.trainings.get(W1).rows);
  } finally { done(); }
  assert.deepStrictEqual([log.iPad, log.moved], [["1 Back squat", "2 Calf raise", "3 Hip thrust"], true], "(the setup: the iPad's Delete exercise and + Add exercise, and the Mac's Reorder): " + JSON.stringify(log));
  const want = ["1 Back squat", "2 Calf raise", "3 Leg curl", "4 Hip thrust"];
  assert.deepStrictEqual({ server: log.server, mac: log.mac, waiting: log.waiting, after: log.after, kept: log.kept }, { server: want, mac: want, waiting: [], after: want, kept: "12" }, "the Mac's Reorder lost to the iPad's numbers (Hip thrust on 3), or Leg curl or its reps were lost: " + JSON.stringify(log));
});

// ---------- a client's plan and a package, both devices changing them (the twenty-fourth check round, R24-MRG-1 and R24-MRG-2; the owner's pick
// "Each detail separately", 25 Nov 2026). Save changes on a package rewrites every client on it from this device's copy ({ ...c.plan, name, kind,
// size }) and marks each plan changed here; the save then kept this device's whole plan and plan history. So the iPad's Active until or + 4 weeks
// went back to the old last day (her plan read as over, her phone got no workouts), its switch of package was undone (back on 10 sessions, the
// history entry gone), and the Mac's Change kept the old size beside the iPad's resize of her package. And a package the Mac edited and put back
// as it was read took the iPad's edit while every client on it kept the Mac's old name and size: the Packages list said 12, her card x of 10.
// Now a client's plan merges detail by detail against the copy last read: a switch or None on the other device beats a detail changed here; a
// plan put back as read takes the other device's; one switched here, or one detail both changed, keeps this device's. A package both devices
// changed merges detail by detail too. ----------
const O = "4b8e2f1a-5555-4c3d-9e5f-6a7b8c9d0e1f";                        // Omar, on a package too
const TPL3 = () => ({ ...TPL(), packages: [...TPL().packages, { id: "p3", name: "20 sessions", kind: "sessions", size: 20, inPerson: true }] });   // 10 sessions, 4-week plan, 20 sessions
const person = (id, name, plan) => ({ id, name, unit: "lb", email: name.split(" ")[0].toLowerCase() + "@x.com", phone: "3105550142", notes: { log: [] }, plan });
const dates = () => ({ start: day(-30), mStart: day(-24), until: day(4), picked: day(30), plus4: day(32), later: day(40), yesterday: day(-1), today: day(0) });   // read once a test: one running past midnight compares the days it wrote (plus4: + 4 weeks on from the last day, 4 days on)
const tenOf = (D, extra = {}) => ({ id: "p1", name: "10 sessions", kind: "sessions", size: 10, startedOn: D.start, ...extra });   // on 10 sessions since a month ago
const monthOf = (D, extra = {}) => ({ id: "p2", name: "4-week plan", kind: "monthly", size: null, startedOn: D.mStart, until: D.until, ...extra });   // on the 4-week plan, its last day 4 days on
const PLAN_LINES = [                                                      // main.js's lines this section copies: Save changes on a package (packAdd), the card's Change and Save, Active until (untilPut), + 4 weeks, the Plan pop-up
  'const name = String($("packName").value || "").trim() || (packKind === "monthly" ? "4-week plan" : size + " sessions");',
  'const tc = tplClient(); const next = { name, kind: packKind, size: packKind === "sessions" ? size : null, inPerson: packInPerson };',
  "tc.packages = packagesList().map((pk) => (pk.id === packEdit ? { ...pk, ...next } : pk));",
  "if (!c.plan || c.plan.id !== packEdit || isTemplateClient(c.id)) continue;",
  'c.plan = { ...c.plan, name, kind: next.kind, size: next.size }; planTouched.add(c.id); scheduleSave("clients", c.id);',
  'planTouched.add(tc.id); scheduleSave("clients", tc.id);',
  "planEdit = { clientId: c.id, planKey: planKeyOf(c.plan), adjust: parseInt(c.plan.adjust, 10) || 0 };",
  'planEdit.adjust += step.id === "planPlus" ? 1 : -1;',
  'if (planEdit && planEdit.planKey === planKeyOf(c.plan)) c.plan.adjust = planEdit.adjust; planEdit = null; planTouched.add(c.id); scheduleSave("clients", c.id);',
  'c.plan.until = el.value; el.dataset.shown = el.value; planTouched.add(c.id); scheduleSave("clients", c.id);',
  'c.plan.until = daysLater(c.plan.until && c.plan.until > today() ? c.plan.until : today(), 28); planTouched.add(c.id); scheduleSave("clients", c.id);',
  "const pk = packagesList().find((x) => x.id === id), sw = planSwitch(c, pk, clientTrainings(c.id), today());",
  "if (sw.planHistory) { if (sw.planHistory.length) c.planHistory = sw.planHistory; else delete c.planHistory; } planEdit = null; c.plan = sw.plan;",
];
const linesHeld = () => { for (const line of PLAN_LINES) assert.ok(src.includes(line), "(the setup: main.js's package form, Change, Active until, + 4 weeks or Plan pop-up no longer reads as this file copies it): " + line); };
const PLAN = {                                                            // a change on a client's card as main.js's own lines make it, on either device's copy of her record (packs: that device's packages)
  change: (c, by) => { c.plan.adjust = (parseInt(c.plan.adjust, 10) || 0) + by; },   // Change, then + or - (by), then Save
  until: (c, date) => { c.plan.until = date; },                           // Active until: a day picked
  plus4: (c) => { c.plan.until = daysLater(c.plan.until && c.plan.until > fns.today() ? c.plan.until : fns.today(), 28); },   // + 4 weeks
  pick: (c, pkId, packs) => { const pk = packs.find((x) => x.id === pkId), sw = planSwitch(c, pk, fns.clientTrainings(c.id), fns.today()); if (sw.planHistory) { if (sw.planHistory.length) c.planHistory = sw.planHistory; else delete c.planHistory; } c.plan = sw.plan; },   // the Plan pop-up: another package, or None ("")
  pickOn: (c, pkId, on, packs) => { const pk = packs.find((x) => x.id === pkId), sw = planSwitch(c, pk, fns.clientTrainings(c.id), on); if (sw.planHistory) { if (sw.planHistory.length) c.planHistory = sw.planHistory; else delete c.planHistory; } c.plan = sw.plan; },   // the same, on another day (on)
};
const onMac = (id, how, ...args) => { const c = maps.clients.get(id); PLAN[how](c, ...args, packList()); maps.planTouched.add(c.id); fns.scheduleSave("clients", c.id); };   // the Mac: that change on her card, then its save
const onIpadCard = (sb, id, how, ...args) => onIpad(sb, "ft_clients", id, (d) => PLAN[how](d, ...args, sb.tables.ft_clients.get(TEMPLATES_ID).data.packages));   // the iPad: that change on her card, its save landed
const macPack = (packEdit, form) => {                                     // the Mac: Packages, that package tapped, the form as given, Save changes (main.js packAdd, line for line): every client on it, then the Templates record
  const packKind = form.kind, packInPerson = form.inPerson, size = Math.max(0, Math.min(200, parseInt(form.size, 10) || 0));
  const name = String(form.name || "").trim() || (packKind === "monthly" ? "4-week plan" : size + " sessions");
  assert.ok(!packList().some((pk) => pk.id !== packEdit && String(pk.name || "").toLowerCase() === name.toLowerCase()), "(the setup: another package has that name, so the form would not save it): " + name);
  const t = tc(), next = { name, kind: packKind, size: packKind === "sessions" ? size : null, inPerson: packInPerson };
  t.packages = packList().map((pk) => (pk.id === packEdit ? { ...pk, ...next } : pk));
  for (const c of maps.clients.values()) { if (!c.plan || c.plan.id !== packEdit || isTemplateClient(c.id)) continue; c.plan = { ...c.plan, name, kind: next.kind, size: next.size }; maps.planTouched.add(c.id); fns.scheduleSave("clients", c.id); }
  maps.planTouched.add(t.id); fns.scheduleSave("clients", t.id);
};
const iPadPack = (sb, packEdit, next) => {                                // the iPad: Save changes on a package (main.js packAdd): every client on it, then its Templates record, each save landed
  for (const s of sb.tables.ft_clients.values()) if (!isTemplateClient(s.id) && s.data.plan && s.data.plan.id === packEdit) { s.data.plan = { ...s.data.plan, name: next.name, kind: next.kind, size: next.size }; bump(s); }
  onIpad(sb, "ft_clients", TEMPLATES_ID, (d) => { d.packages = d.packages.map((p) => (p.id === packEdit ? { ...p, ...next } : p)); });
};
const planOf = (d) => JSON.parse(JSON.stringify({ plan: (d && d.plan) || null, history: (d && d.planHistory) || [] }));   // a client's plan and the plans she was on before, as a copy of her record holds them
const srvOf = (sb, id) => sb.tables.ft_clients.get(id).data;
const packOf = (d, id) => { const p = ((d && d.packages) || []).find((x) => x && x.id === id); return p ? said(p) : null; };   // one package as the Packages list says it
const cardOf = (id) => {                                                  // that client's page on the Mac, drawn by main.js: the plan card's name and its line
  app.set({ view: { name: "client", id } }); fns.render();
  const $ = (x) => document.getElementById(x);
  return $("planCard").hidden ? "no plan card" : $("planName").textContent + ": " + $("planBig").textContent;
};
const relaunch = async (sb) => {                                          // the Mac closed and opened again, the signal back (as relaunch-merge.test.js): only what the device keeps is left, and main.js's own boot takes it back; then signed in, no sync yet
  const keep = Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i)).map((k) => [k, localStorage.getItem(k)]);
  quiet(); app.reset(); for (const [k, v] of keep) if (v != null) localStorage.setItem(k, v);
  localStorage.setItem("fiala.trainings.role", JSON.stringify({ email: "coach@x.com", role: "trainer" }));
  const lib = globalThis.supabase; delete globalThis.supabase;
  try { await fns.boot(); } finally { if (lib !== undefined) globalThis.supabase = lib; }
  sb.setFail(null); app.set({ sb, signedIn: true, clientMode: false, backend: fns.cloudBackend, sessionEmail: "coach@x.com", view: { name: "clients" }, offline: false, offlineEntry: null });
};
const ROUTES = [                                                          // how the Mac's saves meet the iPad's copy
  { how: "open all along", off: false },
  { how: "with no signal, then a sync once the signal is back", off: true, first: "sync" },
  { how: "with no signal, then its waiting saves first once the signal is back", off: true, first: "saves" },
  { how: "with no signal, closed and opened again with the signal back, then a sync", off: true, closed: true, first: "sync" },
  { how: "with no signal, closed and opened again with the signal back, then its waiting saves first", off: true, closed: true, first: "saves" },
];
const macRoute = async (sb, r, mac) => {                                  // the Mac's change (the iPad's already on the server): its saves land at once, or wait for the signal and land once it is back
  if (r.off) sb.setFail({ times: 1e6, message: "Failed to fetch" });     // no signal on the Mac
  await mac(); await settle();
  const was = { offline: !!app.get().offline, waiting: [...maps.dirty.keys()].sort() };
  if (r.off) {
    if (r.closed) await relaunch(sb); else { sb.setFail(null); app.set({ offline: false }); }   // the signal back
    if (r.first === "sync") await sync(); else { for (const k of [...maps.dirty.keys()]) { const [kind, id] = k.split("/"); fns.flushOne(kind, id); } await settle(); }
  }
  return was;
};

for (const r of ROUTES) test("the iPad's Active until and + 4 weeks stay when the Mac, not synced since, saves the package the clients are on (4-week plan, In person on, Save changes), " + r.how + ": the iPad picked Jane's last day a month on and gave Omar 4 more weeks; the server and the Mac hold both new days beside the Mac's In person, and after the next sync both cards say Until that day (the twenty-fourth check round, R24-MRG-1: Save changes rewrote each client on the package from the Mac's old copy and its save kept that whole: both plans ended on the old day, and their phones got no workouts)", async () => {
  linesHeld();
  const sb = makeSupabase(); coach(sb); const D = dates(); let log = {};
  sb.seed("ft_clients", TEMPLATES_ID, TPL3()); sb.seed("ft_clients", C, person(C, "Jane Sample", monthOf(D))); sb.seed("ft_clients", O, person(O, "Omar Sample", monthOf(D)));
  try {
    await sync();                                                         // the Mac's last sync
    onIpadCard(sb, C, "until", D.picked); onIpadCard(sb, O, "plus4");    // the iPad: a day picked in Jane's Active until; + 4 weeks on Omar's card
    log.iPad = { jane: planOf(srvOf(sb, C)), omar: planOf(srvOf(sb, O)) };
    log.route = await macRoute(sb, r, () => macPack("p2", { name: "4-week plan", kind: "monthly", size: "", inPerson: true }));   // the Mac: 4-week plan tapped, In person on, Save changes
    log.server = { jane: planOf(srvOf(sb, C)), omar: planOf(srvOf(sb, O)), p2: packOf(srvOf(sb, TEMPLATES_ID), "p2") };
    log.mac = { jane: planOf(maps.clients.get(C)), omar: planOf(maps.clients.get(O)), p2: packOf(tc(), "p2"), waiting: [...maps.dirty.keys()] };
    await sync();                                                         // the Mac's next sync
    log.cards = { jane: cardOf(C), omar: cardOf(O) };
  } finally { done(); }
  const kept = { jane: { plan: monthOf(D, { until: D.picked }), history: [] }, omar: { plan: monthOf(D, { until: D.plus4 }), history: [] } }, inPerson = "p2: 4-week plan (no size, In person)";
  assert.deepStrictEqual(log.iPad, kept, "(the setup: the iPad's day picked and its + 4 weeks): " + JSON.stringify(log));
  assert.deepStrictEqual(log.route, r.off ? { offline: true, waiting: ["clients/" + TEMPLATES_ID, "clients/" + C, "clients/" + O].sort() } : { offline: false, waiting: [] }, "(the setup: the Mac's saves " + (r.off ? "wait for the signal" : "land at once") + "): " + JSON.stringify(log));
  assert.deepStrictEqual(log.server, { ...kept, p2: inPerson }, "the server holds a client's old last day (the iPad's day picked or its + 4 weeks lost), or lost the Mac's In person: " + JSON.stringify(log));
  assert.deepStrictEqual(log.mac, { ...kept, p2: inPerson, waiting: [] }, "the Mac shows a client's old last day, or lost its own In person (or a save still waits): " + JSON.stringify(log));
  assert.deepStrictEqual(log.cards, { jane: "4-week plan: Until " + fmtDay(D.picked), omar: "4-week plan: Until " + fmtDay(D.plus4) }, "after the next sync a card shows another last day than the iPad gave: " + JSON.stringify(log));
});

const OVER = [                                                            // a switch or None on the iPad beats a detail the Mac changed on that plan: [what each device did, the plans seeded, the iPad's change, the Mac's change, the server's packages after, the cards after]
  ["the iPad moved Jane from 10 sessions to 20 sessions (the Plan pop-up) and the Mac saved a Change of +1 on her card: she is on 20 sessions, 0 of 20 (the +1 was made on the plan she left)",
    (D) => ({ [C]: tenOf(D) }), (sb) => onIpadCard(sb, C, "pick", "p3"), () => onMac(C, "change", 1), null, () => ({ [C]: "20 sessions: 0 of 20" })],
  ["the iPad moved Omar from 10 sessions to 20 sessions and Jane from 10 sessions to the 4-week plan, and the Mac renamed 10 sessions to 10 sessions (PT) (Save changes): both stay where the iPad put them, Jane's 10 sessions on record, and the package takes the new name",
    (D) => ({ [C]: tenOf(D), [O]: tenOf(D, { adjust: 3 }) }), (sb) => { onIpadCard(sb, O, "pick", "p3"); onIpadCard(sb, C, "pick", "p2"); }, () => macPack("p1", { name: "10 sessions (PT)", kind: "sessions", size: "10", inPerson: true }), "p1: 10 sessions (PT) (10, In person)", (iPad) => ({ [C]: "4-week plan: Until " + fmtDay(iPad[C].plan && iPad[C].plan.until), [O]: "20 sessions: 3 of 20" })],
  ["the iPad set Jane's and Omar's plans to None, and the Mac picked a last day in Jane's Active until and pressed + 4 weeks on Omar's card: both have no plan, the 4-week plan on record",
    (D) => ({ [C]: monthOf(D), [O]: monthOf(D) }), (sb) => { onIpadCard(sb, C, "pick", ""); onIpadCard(sb, O, "pick", ""); }, (D) => { onMac(C, "until", D.later); onMac(O, "plus4"); }, null, () => ({ [C]: "no plan card", [O]: "no plan card" })],
];
for (const [what, seeds, ipad, mac, packs, cards] of OVER) test("a switch of package, or None, made on the iPad stands when the Mac, open all along and not synced since, changes a detail of the old plan: " + what + "; the server, the Mac and the cards after the next sync agree (the twenty-fourth check round, R24-MRG-1: the Mac's whole plan stood, the switch undone and its history entry gone)", async () => {
  linesHeld();
  const sb = makeSupabase(); coach(sb); const D = dates(), seeded = seeds(D), ids = Object.keys(seeded); let log = {};
  sb.seed("ft_clients", TEMPLATES_ID, TPL3()); for (const id of ids) sb.seed("ft_clients", id, person(id, id === C ? "Jane Sample" : "Omar Sample", seeded[id]));
  try {
    await sync();                                                         // the Mac's last sync
    ipad(sb); log.iPad = Object.fromEntries(ids.map((id) => [id, planOf(srvOf(sb, id))]));
    mac(D); await settle();                                                // the Mac's change; its saves meet the iPad's copy and merge it
    log.server = Object.fromEntries(ids.map((id) => [id, planOf(srvOf(sb, id))])); log.mac = Object.fromEntries(ids.map((id) => [id, planOf(maps.clients.get(id))]));
    log.packs = { server: packOf(srvOf(sb, TEMPLATES_ID), "p1"), mac: packOf(tc(), "p1") }; log.waiting = [...maps.dirty.keys()];
    await sync(); log.cards = Object.fromEntries(ids.map((id) => [id, cardOf(id)]));
  } finally { done(); }
  const p1 = packs || "p1: 10 sessions (10, In person)";
  assert.ok(ids.every((id) => (log.iPad[id].plan ? log.iPad[id].plan.id : "None") !== seeded[id].id), "(the setup: the iPad moved each client to another package, or to None): " + JSON.stringify(log));
  assert.deepStrictEqual({ server: log.server, mac: log.mac, waiting: log.waiting }, { server: log.iPad, mac: log.iPad, waiting: [] }, "the Mac's change undid the iPad's switch or None (the old plan back, or its history entry gone), on the server or on the Mac: " + JSON.stringify(log));
  assert.deepStrictEqual(log.packs, { server: p1, mac: p1 }, "the Mac's Save changes on the package was lost: " + JSON.stringify(log));
  assert.deepStrictEqual(log.cards, cards(log.iPad), "after the next sync a card shows another plan than the iPad set: " + JSON.stringify(log));
});

test("a plan both devices changed merges detail by detail against the copy last read, the Mac open all along and not synced since: the iPad resized 10 sessions to 12 (Save changes) and the Mac saved a Change of +1 on Jane's card: 12 sessions, size 12, +1, 1 of 12; the iPad's + 4 weeks and the Mac's rename of 4-week plan to Monthly plan: both stand; and no change where both changed one detail, or the Mac switched: both set Active until (the Mac's day stands), both saved a Change (the Mac's stands), the Mac's switch to 20 sessions over the iPad's Change, the Mac's None over the iPad's + 4 weeks (the Mac's whole plan) (the twenty-fourth check round, R24-MRG-1: the Mac's whole plan stood, her card said 1 of 10 while the package said 12)", async () => {
  linesHeld();
  const D = dates();
  const CASES = {                                                         // [Jane's plan seeded, the iPad's change, the Mac's change, her plan after, her card after]
    "the iPad resizes 10 sessions to 12, the Mac saves a Change of +1": [tenOf(D), (sb) => iPadPack(sb, "p1", { name: "12 sessions", kind: "sessions", size: 12, inPerson: true }), () => onMac(C, "change", 1), { plan: tenOf(D, { name: "12 sessions", size: 12, adjust: 1 }), history: [] }, "12 sessions: 1 of 12"],
    "the iPad's + 4 weeks, the Mac renames 4-week plan to Monthly plan": [monthOf(D), (sb) => onIpadCard(sb, C, "plus4"), () => macPack("p2", { name: "Monthly plan", kind: "monthly", size: "", inPerson: false }), { plan: monthOf(D, { name: "Monthly plan", until: D.plus4 }), history: [] }, "Monthly plan: Until " + fmtDay(D.plus4)],
    "both set Active until: the iPad + 4 weeks, the Mac a later day picked": [monthOf(D), (sb) => onIpadCard(sb, C, "plus4"), () => onMac(C, "until", D.later), { plan: monthOf(D, { until: D.later }), history: [] }, "4-week plan: Until " + fmtDay(D.later)],
    "both save a Change: the iPad -1, the Mac +1": [tenOf(D, { adjust: 2 }), (sb) => onIpadCard(sb, C, "change", -1), () => onMac(C, "change", 1), { plan: tenOf(D, { adjust: 3 }), history: [] }, "10 sessions: 3 of 10"],
    "the iPad saves a Change of -1, the Mac moves her to 20 sessions": [tenOf(D, { adjust: 2 }), (sb) => onIpadCard(sb, C, "change", -1), () => onMac(C, "pick", "p3"), { plan: { id: "p3", name: "20 sessions", kind: "sessions", size: 20, startedOn: D.start, adjust: 2, carried: 0 }, history: [] }, "20 sessions: 2 of 20"],
    "the iPad's + 4 weeks, the Mac sets her plan to None": [monthOf(D), (sb) => onIpadCard(sb, C, "plus4"), () => onMac(C, "pick", ""), (mine) => ({ plan: null, history: [{ ...monthOf(D), endedOn: mine.history.length ? mine.history[0].endedOn : "none" }] }), "no plan card"],   // (the day she left it: the Mac's own, as it switched)
  };
  const got = {}, wanted = {};
  for (const [how, [plan, ipad, mac, after, card]] of Object.entries(CASES)) {
    const sb = makeSupabase(); coach(sb);
    sb.seed("ft_clients", TEMPLATES_ID, TPL3()); sb.seed("ft_clients", C, person(C, "Jane Sample", plan));
    try {
      await sync(); ipad(sb); mac(); const mine = planOf(maps.clients.get(C)); await settle();   // the Mac's change, as it made it; its save meets the iPad's copy and merges it
      got[how] = { server: planOf(srvOf(sb, C)), mac: planOf(maps.clients.get(C)), waiting: [...maps.dirty.keys()] };
      await sync(); got[how].card = cardOf(C);
      wanted[how] = { server: typeof after === "function" ? after(mine) : after, mac: typeof after === "function" ? after(mine) : after, waiting: [], card };
    } finally { done(); }
  }
  assert.deepStrictEqual(got, wanted, "a detail one device changed was lost, or where both changed one detail (or the Mac switched) the iPad's stood: " + JSON.stringify(got));
});

const BACK = [...ROUTES.slice(1), { how: "open all along, 10 sessions tapped and Save changes pressed with nothing changed", off: false, same: true }];
for (const r of BACK) test("a package the Mac put back as it was read takes the iPad's edit, and so does every client on it: Jane and Omar on 10 sessions, the iPad made it 12 sessions, size 12, In person off, and the Mac, not synced since, " + (r.same ? "was " + r.how : "edited it to 15 sessions and back to 10 sessions " + r.how) + ": the Packages list and both plans say 12 sessions, size 12, on the server and on the Mac, and after the next sync her new workouts take 12 sessions and both cards count to 12 (the twenty-fourth check round, R24-MRG-2: the package took the iPad's 12 sessions while both clients kept 10 sessions, size 10)", async () => {
  linesHeld();
  const sb = makeSupabase(); coach(sb); const D = dates(); let log = {};
  sb.seed("ft_clients", TEMPLATES_ID, TPL3()); sb.seed("ft_clients", C, person(C, "Jane Sample", tenOf(D))); sb.seed("ft_clients", O, person(O, "Omar Sample", tenOf(D, { adjust: 3 })));
  try {
    await sync();                                                         // the Mac's last sync
    iPadPack(sb, "p1", TWELVE);                                           // the iPad: 10 sessions tapped, 12 sessions, size 12, In person off, Save changes
    log.route = await macRoute(sb, r, async () => {
      const ten = { name: "10 sessions", kind: "sessions", size: "10", inPerson: true };
      if (r.same) { macPack("p1", ten); return; }                         // the Mac: 10 sessions tapped, Save changes with nothing changed
      macPack("p1", { name: "15 sessions", kind: "sessions", size: "15", inPerson: true }); await settle(); macPack("p1", ten);   // the Mac: 15 sessions, size 15, Save changes; then back to 10 sessions, size 10, Save changes
    });
    log.server = { p1: packOf(srvOf(sb, TEMPLATES_ID), "p1"), jane: planOf(srvOf(sb, C)), omar: planOf(srvOf(sb, O)) };
    log.mac = { p1: packOf(tc(), "p1"), jane: planOf(maps.clients.get(C)), omar: planOf(maps.clients.get(O)), waiting: [...maps.dirty.keys()] };
    await sync();                                                         // the Mac's next sync: the package Jane's new workouts take (packageOf), and both cards
    { const pk = fns.packageOf(maps.clients.get(C)); log.after = { packageOf: pk ? said(pk) : null, jane: cardOf(C), omar: cardOf(O) }; }
  } finally { done(); }
  const twelve = { p1: "p1: 12 sessions (12)", jane: { plan: tenOf(D, { name: "12 sessions", size: 12 }), history: [] }, omar: { plan: tenOf(D, { name: "12 sessions", size: 12, adjust: 3 }), history: [] } };
  assert.deepStrictEqual(log.route, r.off ? { offline: true, waiting: ["clients/" + TEMPLATES_ID, "clients/" + C, "clients/" + O].sort() } : { offline: false, waiting: [] }, "(the setup: the Mac's saves " + (r.off ? "wait for the signal" : "land at once") + "): " + JSON.stringify(log));
  assert.deepStrictEqual(log.server, twelve, "the server's Packages list and a client's plan disagree, or the iPad's 12 sessions was lost: " + JSON.stringify(log));
  assert.deepStrictEqual(log.mac, { ...twelve, waiting: [] }, "the Mac's Packages list and a client's plan disagree, or the iPad's 12 sessions was lost (or a save still waits): " + JSON.stringify(log));
  assert.deepStrictEqual(log.after, { packageOf: "p1: 12 sessions (12)", jane: "12 sessions: 0 of 12", omar: "12 sessions: 3 of 12" }, "after the next sync her new workouts take another package than her card counts to, or a card counts to 10: " + JSON.stringify(log));
});

test("a package both devices changed merges detail by detail, the Mac open all along and not synced since, Jane on it: the iPad made 10 sessions 12 sessions, size 12, and the Mac turned In person off: 12 sessions, size 12, In person off; the iPad turned In person off and the Mac renamed it 10 sessions (PT): the new name, In person off; the iPad 12 sessions, size 12, In person off, and the Mac 15 sessions, size 15: 15 sessions, In person off; and both a new name and size: the Mac's. The Packages list and her plan say the same on the server and on the Mac, and after the next sync her new workouts take the package her card counts to (the twenty-fourth check round, R24-MRG-2: the Mac's whole package stood, the iPad's change of another detail lost)", async () => {
  linesHeld();
  const D = dates();
  const CASES = {                                                         // [the iPad's Save changes, the Mac's form, the package after, her plan's name and size after]
    "the iPad 12 sessions, size 12; the Mac In person off": [{ name: "12 sessions", kind: "sessions", size: 12, inPerson: true }, { name: "10 sessions", kind: "sessions", size: "10", inPerson: false }, "p1: 12 sessions (12)", ["12 sessions", 12]],
    "the iPad In person off; the Mac 10 sessions (PT)": [{ name: "10 sessions", kind: "sessions", size: 10, inPerson: false }, { name: "10 sessions (PT)", kind: "sessions", size: "10", inPerson: true }, "p1: 10 sessions (PT) (10)", ["10 sessions (PT)", 10]],
    "the iPad 12 sessions, size 12, In person off; the Mac 15 sessions, size 15": [TWELVE, { name: "15 sessions", kind: "sessions", size: "15", inPerson: true }, "p1: 15 sessions (15)", ["15 sessions", 15]],
    "both a new name and size: the iPad 12 sessions, the Mac 15 sessions": [{ ...TWELVE, inPerson: true }, { name: "15 sessions", kind: "sessions", size: "15", inPerson: true }, "p1: 15 sessions (15, In person)", ["15 sessions", 15]],
  };
  const got = {}, wanted = {};
  for (const [how, [ipad, form, pack, [name, size]]] of Object.entries(CASES)) {
    const sb = makeSupabase(); coach(sb);
    sb.seed("ft_clients", TEMPLATES_ID, TPL3()); sb.seed("ft_clients", C, person(C, "Jane Sample", tenOf(D)));
    try {
      await sync(); iPadPack(sb, "p1", ipad); macPack("p1", form); await settle();   // the iPad's save landed; the Mac's saves meet its copy and merge it
      const sp = srvOf(sb, C).plan, mp = maps.clients.get(C).plan;
      got[how] = { server: [packOf(srvOf(sb, TEMPLATES_ID), "p1"), sp.name, sp.size], mac: [packOf(tc(), "p1"), mp.name, mp.size], waiting: [...maps.dirty.keys()] };
      await sync(); { const pk = fns.packageOf(maps.clients.get(C)); got[how].after = [pk ? said(pk) : null, cardOf(C)]; }
    } finally { done(); }
    wanted[how] = { server: [pack, name, size], mac: [pack, name, size], waiting: [], after: [pack, name + ": 0 of " + size] };
  }
  assert.deepStrictEqual(got, wanted, "a detail of the package one device changed was lost, or the Packages list and her plan disagree: " + JSON.stringify(got));
});

// ---------- details that belong together, a plan started afresh, a package from before In person (the twenty-fifth check round, R25-MRG-2,
// R25-MRG-3, R25-TW-9) ----------
// "Each detail separately" (the owner's pick) merged two pairs of details apart. A session package's correction (adjust) and the sessions it
// carried over at a switch (carried): the iPad put a mis-pick right (10 sessions, 20 sessions, 10 sessions again: -10, and 10 carried) while the
// Mac saved a Change of +1, and the merge took the Mac's +1 beside the iPad's 10 carried: Sessions said 23 with you (13 is right), on his Progress
// and on her phone. A package's kind and its size: the iPad made 10 sessions a monthly plan while the Mac resized it to 12, and the package and her
// plan became a monthly plan with a size of 12. And a plan started afresh (None, then the same package again another day: a new start) took the
// other device's details of the old one: her new package read 1 of 10 with nothing done. Now each pair merges as one detail, and a plan whose start
// changed counts as a switch (the device that started it afresh keeps it whole). A package saved from 14 to 20 Oct 2026 has no In person on record,
// and Save changes writes In person off: that read as a change, so the iPad's In person went, and a package the iPad deleted came back. A missing
// In person now reads as off. Last, tests for two undos of the twenty-fourth round's plan merge that no test caught (R25-TW-9).
const metWith = (k, i) => ({ id: "4b8e2f1a-6" + String(i).padStart(3, "0") + "-4c3d-9e5f-6a7b8c9d0e1f", clientId: C, title: "Session " + i, date: day(k), createdAt: AT, inPerson: true, completedAt: day(k) + "T19:00:00.000Z", skippedAt: null, rows: [lift("s" + i, "1", "Back squat", true)] });   // a session with the coach, finished (In person)
const sessionsOf = (id) => {                                              // that client's Progress tab on the Mac, drawn by main.js: the Sessions tile's words, each piece between bars
  app.set({ view: { name: "client", id }, tab: "profile" }); fns.render(); app.set({ tab: "workouts" });
  return String(document.getElementById("pgSessions").innerHTML).replace(/<svg[\s\S]*?<\/svg>/g, "").replace(/<[^>]+>/g, "|").replace(/\|+/g, "|");
};
const TAP_LINE = 'packEdit = pk.id; packKind = pk.kind === "monthly" ? "monthly" : "sessions"; packInPerson = !!pk.inPerson; $("packName").value = pk.name || ""; $("packSize").value = pk.size || "";';
const macTaps = (id, change = {}) => {                                    // the Mac: Packages, that package tapped (main.js fills the form from the Mac's copy), the change typed, Save changes
  assert.ok(src.includes(TAP_LINE), "(the setup: main.js's tap on a package no longer fills the form as this file copies it): " + TAP_LINE);
  const pk = packList().find((x) => x.id === id); macPack(id, { name: pk.name || "", kind: pk.kind === "monthly" ? "monthly" : "sessions", size: String(pk.size || ""), inPerson: !!pk.inPerson, ...change });
};
const OLD_TPL = () => ({ ...TPL3(), packages: [{ id: "p1", name: "10 sessions", kind: "sessions", size: 10 }, ...TPL3().packages.slice(1)] });   // 10 sessions as Add package saved it from 14 to 20 Oct 2026 (91a11a3): no In person

for (const r of ROUTES) test("a session count's correction and what it carried over merge as one detail: Jane 12 sessions into 10 sessions, the iPad put a mis-pick right (20 sessions, then 10 sessions again) and the Mac, not synced since, saved a Change of +1 on her card, " + r.how + ": the server and the Mac hold the Mac's +1 with nothing carried, her card says 3 of 10, and her Progress says Sessions 13 with you, Package 2 (the twenty-fifth check round, R25-MRG-2: the merge took the Mac's +1 beside the iPad's 10 carried, and Sessions said 23)", async () => {
  linesHeld();
  const sb = makeSupabase(); coach(sb); const D = dates(); let log = {};
  sb.seed("ft_clients", TEMPLATES_ID, TPL3()); sb.seed("ft_clients", C, person(C, "Jane Sample", tenOf(D)));
  for (let i = 1; i <= 12; i++) { const t = metWith(-26 + i, i); sb.seed("ft_trainings", t.id, t, { client_id: C }); }   // 12 sessions with him this month
  try {
    await sync();                                                         // the Mac's last sync
    log.before = sessionsOf(C);
    onIpadCard(sb, C, "pick", "p3"); onIpadCard(sb, C, "pick", "p1");    // the iPad: the Plan pop-up, 20 sessions by mistake, then 10 sessions again
    log.iPad = planOf(srvOf(sb, C));
    log.route = await macRoute(sb, r, () => onMac(C, "change", 1));       // the Mac: Change, +, Save on her card
    log.server = planOf(srvOf(sb, C)); log.mac = planOf(maps.clients.get(C)); log.waiting = [...maps.dirty.keys()];
    await sync(); log.card = cardOf(C); log.sessions = sessionsOf(C);    // the Mac's next sync: her card and her Progress
  } finally { done(); }
  assert.deepStrictEqual([log.before, log.iPad], ["|Sessions|Package 2|12|with you|This package: 2 of 10|", { plan: tenOf(D, { adjust: -10, carried: 10 }), history: [] }], "(the setup: 12 sessions, and the iPad's switch and switch back carried the first 10 over): " + JSON.stringify(log));
  assert.deepStrictEqual(log.route, r.off ? { offline: true, waiting: ["clients/" + C] } : { offline: false, waiting: [] }, "(the setup: the Mac's save " + (r.off ? "waits for the signal" : "lands at once") + "): " + JSON.stringify(log));
  const want = { plan: tenOf(D, { adjust: 1 }), history: [] };
  assert.deepStrictEqual({ server: log.server, mac: log.mac, waiting: log.waiting }, { server: want, mac: want, waiting: [] }, "her plan holds one device's correction beside the other's sessions carried over: " + JSON.stringify(log));
  assert.deepStrictEqual([log.card, log.sessions], ["10 sessions: 3 of 10", "|Sessions|Package 2|13|with you|This package: 3 of 10|"], "her card or her Progress counts other sessions than the 13 she had with him: " + JSON.stringify(log));
});

for (const r of ROUTES.filter((x) => x.off)) test("a plan the iPad started afresh stands whole: Jane on 10 sessions; the iPad set her plan to None yesterday and picked 10 sessions again today (a new package from today), while the Mac, not synced since, saved a Change of +1 on the package she left, " + r.how + ": the server and the Mac hold the iPad's new package and the old one on record, and her card says 0 of 10 (the twenty-fifth check round, R25-MRG-2: the Mac's +1 landed on the new package, 1 of 10 with no session done)", async () => {
  linesHeld();
  const sb = makeSupabase(); coach(sb); const D = dates(); let log = {};
  const old = tenOf(D, { adjust: 0 });                                    // (a plan made since v312 carries its correction from the start)
  sb.seed("ft_clients", TEMPLATES_ID, TPL3()); sb.seed("ft_clients", C, person(C, "Jane Sample", old));
  try {
    await sync();                                                         // the Mac's last sync
    onIpadCard(sb, C, "pickOn", "", D.yesterday); onIpadCard(sb, C, "pick", "p1");   // the iPad: the Plan pop-up, None yesterday, then 10 sessions today
    log.iPad = planOf(srvOf(sb, C));
    log.route = await macRoute(sb, r, () => onMac(C, "change", 1));       // the Mac: Change, +, Save on her card (the package she left)
    log.server = planOf(srvOf(sb, C)); log.mac = planOf(maps.clients.get(C)); log.waiting = [...maps.dirty.keys()];
    await sync(); log.card = cardOf(C);
  } finally { done(); }
  const fresh = { plan: { id: "p1", name: "10 sessions", kind: "sessions", size: 10, startedOn: D.today, adjust: 0 }, history: [{ ...old, endedOn: D.yesterday }] };
  assert.deepStrictEqual(log.iPad, fresh, "(the setup: the iPad's new package from today, the old one on record): " + JSON.stringify(log));
  assert.deepStrictEqual(log.route, { offline: true, waiting: ["clients/" + C] }, "(the setup: the Mac's save waits for the signal): " + JSON.stringify(log));
  assert.deepStrictEqual({ server: log.server, mac: log.mac, waiting: log.waiting, card: log.card }, { server: fresh, mac: fresh, waiting: [], card: "10 sessions: 0 of 10" }, "the Mac's +1 on the package she left landed on her new one (or the iPad's new package was lost): " + JSON.stringify(log));
});

for (const r of ROUTES.filter((x) => x.off)) test("a plan the Mac started afresh stands whole: Jane on 10 sessions; the iPad saved a Change of +1 on her card, while the Mac, not synced since, set her plan to None yesterday and picked 10 sessions again today (a new package from today), " + r.how + ": the server and the Mac hold the Mac's new package and the old one on record, and her card says 0 of 10 (the twenty-fifth check round, R25-MRG-2: the iPad's +1 on the package she left landed on the new one)", async () => {
  linesHeld();
  const sb = makeSupabase(); coach(sb); const D = dates(); let log = {};
  const old = tenOf(D, { adjust: 0 });
  sb.seed("ft_clients", TEMPLATES_ID, TPL3()); sb.seed("ft_clients", C, person(C, "Jane Sample", old));
  try {
    await sync();                                                         // the Mac's last sync
    onIpadCard(sb, C, "change", 1); log.iPad = planOf(srvOf(sb, C));      // the iPad: Change, +, Save on her card
    log.route = await macRoute(sb, r, () => { onMac(C, "pickOn", "", D.yesterday); onMac(C, "pick", "p1"); });   // the Mac: the Plan pop-up, None yesterday, then 10 sessions today
    log.server = planOf(srvOf(sb, C)); log.mac = planOf(maps.clients.get(C)); log.waiting = [...maps.dirty.keys()];
    await sync(); log.card = cardOf(C);
  } finally { done(); }
  const fresh = { plan: { id: "p1", name: "10 sessions", kind: "sessions", size: 10, startedOn: D.today, adjust: 0 }, history: [{ ...old, endedOn: D.yesterday }] };
  assert.deepStrictEqual(log.iPad, { plan: tenOf(D, { adjust: 1 }), history: [] }, "(the setup: the iPad's +1): " + JSON.stringify(log));
  assert.deepStrictEqual(log.route, { offline: true, waiting: ["clients/" + C] }, "(the setup: the Mac's save waits for the signal): " + JSON.stringify(log));
  assert.deepStrictEqual({ server: log.server, mac: log.mac, waiting: log.waiting, card: log.card }, { server: fresh, mac: fresh, waiting: [], card: "10 sessions: 0 of 10" }, "the iPad's +1 on the package she left landed on the Mac's new one: " + JSON.stringify(log));
});

test("a package's kind and its size merge as one detail, Jane on it, the Mac open all along and not synced since: the iPad made 10 sessions a monthly plan (its name kept, or renamed Monthly) and the Mac made it 12 sessions, size 12 (each Save changes): the Packages list, her plan, the package her new workouts take and her card are the Mac's 12 sessions, never a monthly plan with a size (the twenty-fifth check round, R25-MRG-2: the package and her plan became a monthly plan named 12 sessions, with a size of 12)", async () => {
  linesHeld();
  const D = dates();
  const CASES = { "its name kept": { name: "10 sessions", kind: "monthly", size: null, inPerson: true }, "renamed Monthly": { name: "Monthly", kind: "monthly", size: null, inPerson: true } };   // the iPad's Save changes
  const pack = (d) => { const p = ((d && d.packages) || []).find((x) => x && x.id === "p1"); return p ? said(p) + ", " + p.kind : null; };
  const plan = (c) => [c.plan.name, c.plan.kind, c.plan.size];
  const got = {}, wanted = {};
  for (const [how, ipad] of Object.entries(CASES)) {
    const sb = makeSupabase(); coach(sb);
    sb.seed("ft_clients", TEMPLATES_ID, TPL3()); sb.seed("ft_clients", C, person(C, "Jane Sample", tenOf(D)));
    try {
      await sync(); iPadPack(sb, "p1", ipad); macPack("p1", { name: "12 sessions", kind: "sessions", size: "12", inPerson: true }); await settle();   // the iPad's save landed; the Mac's saves meet its copy and merge it
      got[how] = { server: [pack(srvOf(sb, TEMPLATES_ID)), plan(srvOf(sb, C))], mac: [pack(tc()), plan(maps.clients.get(C))], waiting: [...maps.dirty.keys()] };
      await sync(); { const pk = fns.packageOf(maps.clients.get(C)); got[how].after = [pk ? said(pk) + ", " + pk.kind : null, cardOf(C)]; }
    } finally { done(); }
    const twelve = ["p1: 12 sessions (12, In person), sessions", ["12 sessions", "sessions", 12]];
    wanted[how] = { server: twelve, mac: twelve, waiting: [], after: [twelve[0], "12 sessions: 0 of 12"] };
  }
  assert.deepStrictEqual(got, wanted, "the package or her plan took one device's kind beside the other's size (a monthly plan with a size): " + JSON.stringify(got));
});

for (const [how, change] of [["renamed it 10 sessions (PT)", { name: "10 sessions (PT)" }], ["tapped it and pressed Save changes with nothing changed", {}]]) test("a package made before In person existed (none on record: 14 to 20 Oct 2026) keeps the iPad's In person: the iPad turned In person on for 10 sessions, Jane on it, and the Mac, open all along and not synced since, " + how + ": In person stays on, on the server and on the Mac, and after the next sync her new workout made on the Mac is In person (the twenty-fifth check round, R25-MRG-3: the Mac's form wrote In person off, which read as a change of its own; In person went, and her sessions stopped counting on her package unless he marked each one)", async () => {
  linesHeld();
  const sb = makeSupabase(); coach(sb); const D = dates(); let log = {};
  sb.seed("ft_clients", TEMPLATES_ID, OLD_TPL()); sb.seed("ft_clients", C, person(C, "Jane Sample", tenOf(D)));
  try {
    await sync();                                                         // the Mac's last sync
    iPadPack(sb, "p1", { name: "10 sessions", kind: "sessions", size: 10, inPerson: true });   // the iPad: 10 sessions tapped, In person on, Save changes
    macTaps("p1", change); await settle();                                // the Mac's form, filled from its copy (In person off), Save changes
    const name = change.name || "10 sessions";
    log.server = packOf(srvOf(sb, TEMPLATES_ID), "p1"); log.mac = packOf(tc(), "p1"); log.waiting = [...maps.dirty.keys()]; log.want = "p1: " + name + " (10, In person)";
    await sync();
    fns.addTraining(C, null, day(1), true); { const t = [...maps.trainings.values()].find((x) => x.clientId === C); log.newWorkout = t ? !!t.inPerson : "none"; }   // the Mac: + Workout on her page, tomorrow
  } finally { done(); }
  assert.deepStrictEqual({ server: log.server, mac: log.mac, waiting: log.waiting, newWorkout: log.newWorkout }, { server: log.want, mac: log.want, waiting: [], newWorkout: true }, "the iPad's In person went (on the server or the Mac), or her new workout is not In person: " + JSON.stringify(log));
});

for (const [how, mac] of [["tapped it and pressed Save changes with nothing changed", () => macTaps("p1")], ["renamed folder Strength (the package itself untouched)", () => MAC["renames folder Strength"]()]]) test("a package made before In person existed, deleted on the iPad, stays deleted when the Mac, open all along and not synced since, " + how + ": the Packages list holds 4-week plan and 20 sessions only, on the server and on the Mac (the twenty-fifth check round, R25-MRG-3: In person off written by the form, or missing on record, read as a change of the Mac's, and the package came back)", async () => {
  linesHeld();
  const sb = makeSupabase(); coach(sb); const D = dates(); let log = {};
  sb.seed("ft_clients", TEMPLATES_ID, OLD_TPL()); sb.seed("ft_clients", C, person(C, "Jane Sample", monthOf(D)));
  try {
    await sync();                                                         // the Mac's last sync
    onIpad(sb, "ft_clients", TEMPLATES_ID, (d) => { d.packages = d.packages.filter((p) => p.id !== "p1"); });   // the iPad: Delete on 10 sessions, its question answered
    mac(); await settle();                                                // the Mac's save of the Templates record meets the iPad's copy and merges it
    log.server = (srvOf(sb, TEMPLATES_ID).packages || []).map(said); log.mac = packList().map(said); log.waiting = [...maps.dirty.keys()];
  } finally { done(); }
  const want = ["p2: 4-week plan (no size)", "p3: 20 sessions (20, In person)"];
  assert.deepStrictEqual({ server: log.server, mac: log.mac, waiting: log.waiting }, { server: want, mac: want, waiting: [] }, "the package the iPad deleted came back: " + JSON.stringify(log));
});

test("a detail only the iPad's copy of a plan has stands: Jane on 10 sessions from before v312 (no correction on record), the iPad saved a Change of +1 on her card, and the Mac, open all along and not synced since, renamed 10 sessions to 10 sessions (PT) (Save changes, which rewrites every client on it): 10 sessions (PT) and the +1, on the server and on the Mac, and her card says 1 of 10 (the twenty-fifth check round, R25-TW-9: with the merge reading only the details the Mac's copy had, no test failed, and the +1 went)", async () => {
  linesHeld();
  const sb = makeSupabase(); coach(sb); const D = dates(); let log = {};
  sb.seed("ft_clients", TEMPLATES_ID, TPL3()); sb.seed("ft_clients", C, person(C, "Jane Sample", tenOf(D)));
  try {
    await sync();                                                         // the Mac's last sync
    onIpadCard(sb, C, "change", 1); log.iPad = planOf(srvOf(sb, C));      // the iPad: Change, +, Save on her card
    macPack("p1", { name: "10 sessions (PT)", kind: "sessions", size: "10", inPerson: true }); await settle();   // the Mac: 10 sessions tapped, renamed, Save changes
    log.server = planOf(srvOf(sb, C)); log.mac = planOf(maps.clients.get(C)); log.waiting = [...maps.dirty.keys()];
    await sync(); log.card = cardOf(C);
  } finally { done(); }
  assert.deepStrictEqual(log.iPad, { plan: tenOf(D, { adjust: 1 }), history: [] }, "(the setup: the iPad's +1, the first correction on her plan): " + JSON.stringify(log));
  const want = { plan: tenOf(D, { name: "10 sessions (PT)", adjust: 1 }), history: [] };
  assert.deepStrictEqual({ server: log.server, mac: log.mac, waiting: log.waiting, card: log.card }, { server: want, mac: want, waiting: [], card: "10 sessions (PT): 1 of 10" }, "the iPad's +1 (a detail the Mac's copy did not have) was lost, or the Mac's new name: " + JSON.stringify(log));
});

test("the iPad's plan history stands beside the Mac's change: the iPad picked 10 sessions for Jane by mistake and put her back on the 4-week plan the same day (10 sessions goes on record), and the Mac, open all along and not synced since, pressed + 4 weeks on her card: the Mac's last day and the iPad's record of 10 sessions, on the server, on the Mac and after its next sync (the twenty-fifth check round, R25-TW-9: with the plan history's merge gone, no test failed, and the record went)", async () => {
  linesHeld();
  const sb = makeSupabase(); coach(sb); const D = dates(); let log = {};
  sb.seed("ft_clients", TEMPLATES_ID, TPL3()); sb.seed("ft_clients", C, person(C, "Jane Sample", monthOf(D)));
  try {
    await sync();                                                         // the Mac's last sync
    onIpadCard(sb, C, "pick", "p1"); onIpadCard(sb, C, "pick", "p2"); log.iPad = planOf(srvOf(sb, C));   // the iPad: the Plan pop-up, 10 sessions by mistake, then the 4-week plan again
    onMac(C, "plus4"); await settle();                                    // the Mac: + 4 weeks on her card
    log.server = planOf(srvOf(sb, C)); log.mac = planOf(maps.clients.get(C)); log.waiting = [...maps.dirty.keys()];
    await sync(); log.after = planOf(maps.clients.get(C));
  } finally { done(); }
  assert.deepStrictEqual([log.iPad.plan, log.iPad.history.map((h) => h.id + " to " + h.endedOn)], [monthOf(D), ["p1 to " + D.today]], "(the setup: the iPad's mis-pick put right, 10 sessions on record): " + JSON.stringify(log));
  const want = { plan: monthOf(D, { until: D.plus4 }), history: log.iPad.history };
  assert.deepStrictEqual({ server: log.server, mac: log.mac, waiting: log.waiting, after: log.after }, { server: want, mac: want, waiting: [], after: want }, "the iPad's record of 10 sessions was lost, or the Mac's + 4 weeks: " + JSON.stringify(log));
});
