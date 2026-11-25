// v316 (the twenty-second check round, found while its tests were written): a record that was NOT waiting to send when the app closed, edited
// after a relaunch before the first sync (or with no signal), had no copy read to measure the server's copy against (no copy, no stamp): its
// save read the server's copy first and merged nothing, so the Mac's whole record stood. An exercise deleted on the iPad came back, Jane's Start
// this exercise was undone, an exercise added on the iPad was dropped, the iPad's change of another field was undone, a client note deleted
// on the iPad came back, and a workout deleted on the iPad was written again. The device copy now keeps the server's stamp of each record
// (copyOf's "seen", read back by takeCopy), and a launch takes every record not waiting to send, as the device copy holds it, as the copy this
// device last read, with that stamp (seedBases, after the queue and a template's draft; on the coach's devices only). Each test closes the app
// and opens it again through main.js's own boot, on the device copy and the queue the app itself wrote before it. Made-up people only.
// The twenty-third check round added, at the end: a package edited on the iPad while the Mac was closed (R23-RLN-3), exercises made with
// + Add exercise, which carry no done key (R23-RLN-2), and a client signing in after the coach on one device (R23-RLN-1).
import { test, assert, tick } from "./assert.js";
import { makeSupabase } from "./fake-supabase.js";
import { load } from "./load.js";
import { TEMPLATES_ID, cmpLabel } from "../app/model.js";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
const app = await load();
const { fns, maps } = app;
const syncJs = await import("../app/sync.js");                          // seedBases, timed on its own in the last test (sync.js had none before this round)
const settle = async () => { const until = Date.now() + 15000; do await tick(5); while ((app.get().inflight > 0 || maps.timers.size) && Date.now() < until); };
const C = "7d9f1b3c-1111-4e5a-8b7c-2d4e6f8a0b1c", W = "7d9f1b3c-3333-4e5a-8b7c-2d4e6f8a0b1c", TP = "7d9f1b3c-5555-4e5a-8b7c-2d4e6f8a0b1c", AT = "2026-11-10T16:00:00.000Z";
const WK = "trainings/" + W, CK = "clients/" + C, TK = "trainings/" + TP, COPY = "fiala.trainings.v1";
let n = 0; const bump = (s) => { s.updated_at = "2026-11-24T15:" + String(10 + Math.floor(n / 50) % 50).padStart(2, "0") + ":" + String(10 + (n++ % 50)).padStart(2, "0") + ".000Z"; };   // another device's write
const day = (k) => { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + k); return fns.localIso(d); };   // the app's local day (never UTC)
const D2 = day(2), D3 = day(3);                                         // Legs' day, and the day the iPad moves it to (read once: a test running past midnight compares the days it wrote)
const ex = (id, label, name) => ({ id, label, name, sets: 4, reps: "8", rest: "", tempo: "", weights: [], repsDone: [], setsDone: 0, done: false, note: "" });
const JANE = () => ({ id: C, name: "Jane Testperson", unit: "lb", email: "jane@x.com", phone: "3105550142", notes: { log: [{ id: "n1", at: AT, text: "Left knee: no deep lunges" }, { id: "n2", at: "2026-11-12T16:00:00.000Z", text: "Prefers mornings" }] }, bodyWeight: { v: 142, u: "lb" }, health: { limits: "Left knee: no deep lunges" } });
const legs = () => ({ id: W, clientId: C, title: "Legs", date: D2, createdAt: AT, completedAt: null, skippedAt: null, rows: [ex("sq", "1", "Back squat"), ex("lp", "2", "Leg press"), ex("lc", "3", "Leg curl"), ex("ca", "4", "Calf raise")] });
const TPL = () => ({ id: TEMPLATES_ID, name: "Templates", kind: "templates", templatesVersion: 3, builtinsAdopted: 1, folders: [{ id: "f1", name: "Strength", parent: null, kind: "folder", at: AT }, { id: "f2", name: "Rehab", parent: null, kind: "folder", at: AT }, { id: "f3", name: "Mobility", parent: null, kind: "folder", at: AT }], packages: [{ id: "p1", name: "10 sessions", kind: "sessions", size: 10, inPerson: true }, { id: "p2", name: "4-week plan", kind: "monthly", size: null, inPerson: false }] });
const upperA = () => ({ id: TP, clientId: TEMPLATES_ID, title: "Upper A", date: "2026-01-01", createdAt: AT, completedAt: null, skippedAt: null, template: { program: "My templates", phase: 0, stage: 0, n: 1, folder: "f1" }, rows: [ex("t1", "1", "Bench press")] });
const coach = (sb) => { app.reset(); fns.leaveSettings(); app.set({ sb, signedIn: true, clientMode: false, backend: fns.cloudBackend, sessionEmail: "coach@x.com", view: { name: "clients" }, templateDraft: null }); };
const phone = (sb) => {                                                   // Jane's own phone: her record and her workouts as the server has them now (client_my_data)
  sb.rpcs.client_my_data = async () => ({ clients: [{ id: C, data: JSON.parse(JSON.stringify(sb.tables.ft_clients.get(C).data)) }], trainings: [...sb.tables.ft_trainings.values()].filter((t) => t.client_id === C).map((t) => ({ id: t.id, data: JSON.parse(JSON.stringify(t.data)), updated_at: t.updated_at })) });
  app.reset(); fns.leaveSettings(); app.set({ sb, signedIn: true, clientMode: true, myClientId: C, backend: fns.clientBackend, sessionEmail: "jane@x.com", view: { name: "client", id: C } });
};
const sync = async () => { await fns.syncDownNow(); await settle(); };
const said = (rows) => [...(rows || [])].sort((p, q) => cmpLabel(p.label, q.label)).map((r) => r.label + " " + r.name);   // as the cards show them
const quiet = () => { for (const tm of maps.timers.values()) clearTimeout(tm); maps.timers.clear(); clearTimeout(app.get().syncTimer); };   // no save or sync left to run into the next test
const done = () => { quiet(); app.set({ templateDraft: null, view: { name: "clients" } }); app.reset(); localStorage.clear(); };
const relaunch = async (sb, { as = "coach", signal = true, before } = {}) => {   // the app closed and opened again: only what the device keeps is left, and main.js's own boot takes it back (the account it remembers, the cloud library still on its way); then signed in, no sync yet
  const keep = Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i)).map((k) => [k, localStorage.getItem(k)]);   // all the device keeps (the queue, the device copy, a template's unsaved draft, the first sync's mark), as a real relaunch does
  quiet(); app.reset(); for (const [k, v] of keep) if (v != null) localStorage.setItem(k, v);
  if (before) before();
  localStorage.setItem("fiala.trainings.role", JSON.stringify(as === "jane" ? { email: "jane@x.com", role: "client" } : { email: "coach@x.com", role: "trainer" }));
  const lib = globalThis.supabase; delete globalThis.supabase;
  try { await fns.boot(); } finally { if (lib !== undefined) globalThis.supabase = lib; }
  if (as === "jane") app.set({ sb, signedIn: true, clientMode: true, myClientId: C, backend: fns.clientBackend, sessionEmail: "jane@x.com", view: { name: "client", id: C }, offline: !signal, offlineEntry: null });
  else app.set({ sb, signedIn: true, clientMode: false, backend: fns.cloudBackend, sessionEmail: "coach@x.com", view: { name: "clients" }, offline: !signal, offlineEntry: null });
};
const oldCopy = () => { const d = JSON.parse(localStorage.getItem(COPY)); delete d.seen; localStorage.setItem(COPY, JSON.stringify(d)); };   // the device copy as the release before this one wrote it: no stamps
const flushAll = () => { for (const k of [...maps.dirty.keys()]) { const [kind, id] = k.split("/"); fns.flushOne(kind, id); } };
const HOWS = ["before the first sync", "with no signal, then a sync once the signal is back", "with no signal, then his waiting save first once the signal is back"];
const edit = async (sb, how, change) => {                                 // the Mac's edit after the relaunch, and its save
  const off = how !== HOWS[0]; if (off) sb.setFail({ times: 1e6, message: "Failed to fetch" });
  change(); await settle();
  if (!off) return;
  sb.setFail(null); app.set({ offline: false });                         // the signal back
  if (how === HOWS[1]) await sync(); else { flushAll(); await settle(); }
};
const whileClosed = (sb, title) => {                                      // while the Mac was closed: the iPad deletes Leg press (the numbers close up), adds Leg extension and moves Legs a day on (and renames it); then Jane's phone: Start this exercise on Calf raise
  const s = sb.tables.ft_trainings.get(W);
  s.data.rows = [ex("sq", "1", "Back squat"), ex("lc", "2", "Leg curl"), ex("ca", "3", "Calf raise"), ex("le", "4", "Leg extension")]; s.data.date = D3; if (title) s.data.title = title; bump(s);
  for (const [id, l] of [["ca", "1"], ["sq", "2"], ["lc", "3"]]) s.data.rows.find((r) => r.id === id).label = l; bump(s);
};
const MERGED = ["1 Calf raise", "2 Back squat", "3 Leg curl", "4 Leg extension"];
const shape = (t) => (t ? [t.title, t.date === D3 ? "a day on" : t.date === D2 ? "its old day" : t.date, ...said(t.rows)] : null);

// ---------- a workout ----------
for (const mine of ["renames it Legs B", "gives Back squat a fifth set"]) for (const how of HOWS) test("a client workout the Mac last read before it closed, the app opened again: Leg press deleted on the iPad, Leg extension added there, the day the iPad moved it to (and its new name) and Jane's Start this exercise on Calf raise all stay when the Mac " + mine + " " + how + " (the twenty-second check round: with no copy read at the launch the Mac's whole older workout was written over them)", async () => {
  const sb = makeSupabase(); coach(sb); let log = {};
  const fifth = mine.includes("fifth"), title = fifth ? "Legs, knee-friendly" : null;
  sb.seed("ft_clients", C, JANE()); sb.seed("ft_trainings", W, legs(), { client_id: C });
  try {
    await sync();                                                         // the Mac's last sync: its device copy holds Legs as read, with the server's stamp
    whileClosed(sb, title);
    await relaunch(sb, { signal: how === HOWS[0] });
    await edit(sb, how, () => { const t = maps.trainings.get(W); if (fifth) t.rows.find((r) => r.id === "sq").sets = 5; else t.title = "Legs B"; fns.scheduleSave("trainings", W); });
    const s = sb.tables.ft_trainings.get(W).data, t = maps.trainings.get(W);
    log = { server: shape(s), here: shape(t), sets: [s, t].map((x) => x.rows.find((r) => r.id === "sq").sets), waiting: maps.dirty.has(WK) };
  } finally { done(); }
  const want = [fifth ? title : "Legs B", "a day on", ...MERGED];
  assert.deepStrictEqual(log.server, want, "the server holds the Mac's older workout (Leg press back, Leg extension gone, Jane's numbers undone, the iPad's day or name undone) or lost the Mac's own change: " + JSON.stringify(log));
  assert.deepStrictEqual(log.here, want, "the Mac shows another workout than the one its save wrote: " + JSON.stringify(log));
  assert.deepStrictEqual([log.sets, log.waiting], [fifth ? [5, 5] : [4, 4], false], "Back squat's sets are not the Mac's (or the save is still waiting): " + JSON.stringify(log));
});

for (const what of ["workout", "client"]) for (const how of HOWS) test((what === "workout" ? "a workout deleted on the iPad while the Mac was closed stays deleted when the Mac, opened again, renames it " : "a client deleted on the iPad (her workouts with her) while the Mac was closed stays deleted when the Mac, opened again, changes her email ") + how + ": never written again, gone from the Mac too, nothing left waiting (the twenty-second check round: with no stamp kept the Mac's save wrote the whole " + what + " back)", async () => {
  const sb = makeSupabase(); coach(sb); let log = {};
  const id = what === "workout" ? W : C, k = what === "workout" ? WK : CK, table = what === "workout" ? "ft_trainings" : "ft_clients";
  sb.seed("ft_clients", C, JANE()); sb.seed("ft_trainings", W, legs(), { client_id: C });
  try {
    await sync();
    sb.tables.ft_trainings.delete(W); if (what === "client") sb.tables.ft_clients.delete(C);   // the iPad: Delete workout (or Delete client, which takes her workouts too)
    await relaunch(sb, { signal: how === HOWS[0] });
    const from = sb.log.length;
    await edit(sb, how, () => { if (what === "workout") { maps.trainings.get(W).title = "Legs B"; fns.scheduleSave("trainings", W); } else { maps.clients.get(C).email = "jane.t@x.com"; fns.scheduleSave("clients", C); } });
    const writes = sb.log.slice(from).filter((e) => (e.table === "ft_trainings" || e.table === "ft_clients") && /upsert|insert/.test(e.op || "")).length;
    await sync();                                                         // and the next sync
    log = { server: sb.tables[table].has(id), here: what === "workout" ? maps.trainings.has(W) : maps.clients.has(C) || maps.trainings.has(W), writes, waiting: maps.dirty.has(k), queued: (localStorage.getItem("fiala.pending.v1") || "").includes(id) };
  } finally { done(); }
  assert.deepStrictEqual(log, { server: false, here: false, writes: 0, waiting: false, queued: false }, "the " + what + " the iPad deleted was written again by the Mac's save (or stays on the Mac, or waits to be sent): " + JSON.stringify(log));
});

// ---------- a client ----------
for (const mine of ["changes her email", "writes a new note"]) for (const how of HOWS) test("Jane's record the Mac last read before it closed, the app opened again: her new phone number typed on the iPad, the note deleted there and her own Health details from her phone (body weight, Health & safety) all stay when the Mac " + mine + " " + how + " (the twenty-second check round: the Mac's older phone number and the deleted note came back)", async () => {
  const sb = makeSupabase(); coach(sb); let log = {};
  const note = mine.includes("note");
  sb.seed("ft_clients", C, JANE());
  try {
    await sync();
    { const s = sb.tables.ft_clients.get(C); s.data.phone = "3105550199"; s.data.notes.log = s.data.notes.log.filter((x) => x.id !== "n2"); bump(s); }   // the iPad: her new number; Delete on "Prefers mornings"
    { const s = sb.tables.ft_clients.get(C); s.data.bodyWeight = { v: 139, u: "lb" }; s.data.health = { limits: "Left knee: no deep lunges or jumps" }; bump(s); }   // her phone (client_set_profile): Health details
    await relaunch(sb, { signal: how === HOWS[0] });
    await edit(sb, how, () => { const c = maps.clients.get(C); if (note) c.notes = fns.packNotes([...fns.noteEntries(c), { id: "n3", at: "2026-11-24T18:00:00.000Z", text: "Bring the resistance bands" }]); else c.email = "jane.t@x.com"; fns.scheduleSave("clients", C); });   // as the note's Save and the email box's input handler do
    const pick = (c) => ({ phone: c.phone, email: c.email, notes: fns.noteEntries(c).map((x) => x.text), weight: c.bodyWeight && c.bodyWeight.v, limits: c.health && c.health.limits });
    log = { server: pick(sb.tables.ft_clients.get(C).data), here: pick(maps.clients.get(C)), waiting: maps.dirty.has(CK) };
  } finally { done(); }
  const want = { phone: "3105550199", email: note ? "jane@x.com" : "jane.t@x.com", notes: ["Left knee: no deep lunges", ...(note ? ["Bring the resistance bands"] : [])], weight: 139, limits: "Left knee: no deep lunges or jumps" };
  assert.deepStrictEqual(log.server, want, "the server holds the Mac's older phone number, the note deleted on the iPad, an older Health detail, or lost the Mac's own change: " + JSON.stringify(log));
  assert.deepStrictEqual([log.here, log.waiting], [want, false], "the Mac shows another record than the one its save wrote: " + JSON.stringify(log));
});

// ---------- the Templates record and a template ----------
for (const how of HOWS) test("the Templates record and a template not open as a draft, last read before the Mac closed, the app opened again: the folder and the package deleted on the iPad stay deleted, its new package stays, and its new exercise and name for Upper A stay, when the Mac renames a folder and moves Upper A to Rehab " + how + " (the twenty-second check round: the deleted folder and package came back, and the Mac's older Upper A was written over the iPad's)", async () => {
  const sb = makeSupabase(); coach(sb); let log = {};
  sb.seed("ft_clients", TEMPLATES_ID, TPL()); sb.seed("ft_trainings", TP, upperA());
  try {
    await sync();
    { const s = sb.tables.ft_clients.get(TEMPLATES_ID); s.data.folders = s.data.folders.filter((f) => f.id !== "f3"); s.data.packages = [...s.data.packages.filter((p) => p.id !== "p2"), { id: "p3", name: "5 sessions", kind: "sessions", size: 5, inPerson: false }]; bump(s); }   // the iPad: Delete folder Mobility, Delete package 4-week plan, a new package
    { const s = sb.tables.ft_trainings.get(TP); s.data.title = "Upper A, push-pull"; s.data.rows.push(ex("t2", "2", "Pull-up")); bump(s); }   // the iPad: Upper A renamed, Pull-up added, Save template
    await relaunch(sb, { signal: how === HOWS[0] });
    await edit(sb, how, () => {
      const tc = maps.clients.get(TEMPLATES_ID); tc.folders = tc.folders.map((f) => (f.id === "f1" ? { ...f, name: "Strength block" } : f)); maps.folderTouched.set("f1", TEMPLATES_ID); fns.scheduleSave("clients", TEMPLATES_ID);   // as Rename folder does once its question is answered
      fns.placeTemplate(maps.trainings.get(TP), "f2");                    // Move to Rehab
    });
    const pick = (tc, t) => ({ folders: tc.folders.map((f) => f.name), packages: tc.packages.map((p) => p.name), upperA: [t.title, t.template.folder, ...said(t.rows)] });
    log = { server: pick(sb.tables.ft_clients.get(TEMPLATES_ID).data, sb.tables.ft_trainings.get(TP).data), here: pick(maps.clients.get(TEMPLATES_ID), maps.trainings.get(TP)), waiting: [...maps.dirty.keys()] };
  } finally { done(); }
  const want = { folders: ["Strength block", "Rehab"], packages: ["10 sessions", "5 sessions"], upperA: ["Upper A, push-pull", "f2", "1 Bench press", "2 Pull-up"] };
  assert.deepStrictEqual(log.server, want, "the server holds a folder or a package deleted on the iPad, lost its new one, holds the Mac's older Upper A, or lost the Mac's own changes: " + JSON.stringify(log));
  assert.deepStrictEqual([log.here, log.waiting], [want, []], "the Mac shows other Templates than the ones its saves wrote: " + JSON.stringify(log));
});

// ---------- what was already right stays so ----------
for (const how of HOWS.slice(1)) test("no change for a save still waiting when the app closed, with the copy it read and its stamp: Legs renamed on the Mac with no signal, the app opened again, then " + how.replace("with no signal, then ", "") + ": the rename stands and the iPad's and Jane's changes come in with it (the queue's copy and stamp, never the device copy, which holds the rename)", async () => {
  const sb = makeSupabase(); coach(sb); let log = {};
  sb.seed("ft_clients", C, JANE()); sb.seed("ft_trainings", W, legs(), { client_id: C });
  try {
    await sync(); const read = maps.seenDoc.get(WK), stamp = maps.seenAt.get(WK);
    sb.setFail({ times: 1e6, message: "Failed to fetch" });
    maps.trainings.get(W).title = "Legs B"; fns.scheduleSave("trainings", W); await settle();   // waiting, with the copy it read and its stamp
    whileClosed(sb);
    await relaunch(sb, { signal: false });
    log.base = { same: maps.seenDoc.get(WK) === read, stamp: maps.seenAt.get(WK) === stamp, copy: JSON.parse(localStorage.getItem(COPY)).trainings[W].title };
    sb.setFail(null); app.set({ offline: false });
    if (how === HOWS[1]) await sync(); else { flushAll(); await settle(); }
    log.server = shape(sb.tables.ft_trainings.get(W).data); log.here = shape(maps.trainings.get(W));
  } finally { done(); }
  assert.deepStrictEqual([log.server, log.here], [["Legs B", "a day on", ...MERGED], ["Legs B", "a day on", ...MERGED]], "the waiting rename, or the iPad's and Jane's changes, were lost: " + JSON.stringify(log));
  assert.deepStrictEqual(log.base, { same: true, stamp: true, copy: "Legs B" }, "the waiting save no longer measures against the copy it read, under the stamp it read it with: " + JSON.stringify(log));
});

test("no change for a save still waiting when the app closed with no copy read (a queue the release before this one left: Legs renamed after a relaunch, before its first sync): opened again, the rename stands; the device copy, which holds the rename, is never taken for the copy it read (it took the server's old name back)", async () => {
  const sb = makeSupabase(); coach(sb); let log = {};
  sb.seed("ft_clients", C, JANE()); sb.seed("ft_trainings", W, legs(), { client_id: C });
  try {
    await sync();
    await relaunch(sb, { signal: false, before: oldCopy });               // a launch of the release before this one: a device copy with no stamps,
    maps.seenDoc.delete(WK); maps.seenAt.delete(WK);                      // and no copy read at the launch
    sb.setFail({ times: 1e6, message: "Failed to fetch" });
    maps.trainings.get(W).title = "Legs B"; fns.scheduleSave("trainings", W); await settle();   // waiting, with no copy read and no stamp
    { const q = JSON.parse(localStorage.getItem("fiala.pending.v1")); log.queued = { dirty: q.dirty.includes(WK), stamp: (q.stamps.find((e) => e[0] === WK) || [])[1], copy: q.docs.some((e) => e[0] === WK) }; }
    { const s = sb.tables.ft_trainings.get(W); s.data.date = D3; bump(s); }   // the iPad moves Legs a day on meanwhile
    await relaunch(sb, { signal: false });                                // this release, opened again
    log.base = maps.seenDoc.has(WK);
    sb.setFail(null); app.set({ offline: false }); flushAll(); await settle();
    log.server = shape(sb.tables.ft_trainings.get(W).data).slice(0, 2);
  } finally { done(); }
  assert.deepStrictEqual(log.queued, { dirty: true, stamp: null, copy: false }, "(the save waits with no copy read and no stamp, as the release before this one left it): " + JSON.stringify(log));
  assert.deepStrictEqual([log.base, log.server], [false, ["Legs B", "a day on"]], "the device copy, which holds the waiting rename, was taken for the copy it read, and the save took the server's old name back: " + JSON.stringify(log));
});

for (const how of HOWS) test("a device copy from before this release (no stamps kept): opened again, the Mac's rename " + how + " still merges the exercise list against the copy the device holds, by the read before a write: Leg press deleted on the iPad, Leg extension added, Jane's numbers all stay", async () => {
  const sb = makeSupabase(); coach(sb); let log = {};
  sb.seed("ft_clients", C, JANE()); sb.seed("ft_trainings", W, legs(), { client_id: C });
  try {
    await sync();
    whileClosed(sb);
    await relaunch(sb, { signal: how === HOWS[0], before: oldCopy });
    log.boot = { copy: maps.seenDoc.has(WK), stamp: maps.seenAt.has(WK) };
    await edit(sb, how, () => { maps.trainings.get(W).title = "Legs B"; fns.scheduleSave("trainings", W); });
    log.server = shape(sb.tables.ft_trainings.get(W).data); log.here = shape(maps.trainings.get(W));
  } finally { done(); }
  assert.deepStrictEqual([log.server, log.here], [["Legs B", "a day on", ...MERGED], ["Legs B", "a day on", ...MERGED]], "the Mac's save wrote its whole older exercise list over the iPad's and Jane's: " + JSON.stringify(log));
  assert.deepStrictEqual(log.boot, { copy: true, stamp: false }, "(the launch takes the record as the device copy holds it, with no stamp: there is none): " + JSON.stringify(log));
});

for (const how of [HOWS[0], HOWS[2]]) test("no change for a template left with unsaved changes when the app closed: opened again, the draft is back unsaved and its Save template " + how.replace("his waiting save", "the waiting Save") + " measures against the template as saved, under the stamp it was typed under (draftBase), never the draft as typed: the name typed on the Mac, and the iPad's move to Rehab and its Pull-up, all stand", async () => {
  const sb = makeSupabase(); coach(sb); let log = {};
  sb.seed("ft_clients", TEMPLATES_ID, TPL()); sb.seed("ft_trainings", TP, upperA());
  try {
    await sync(); const stamp = maps.seenAt.get(TK);
    fns.draftFor(maps.trainings.get(TP)); maps.trainings.get(TP).title = "Upper A, heavy"; fns.scheduleSave("trainings", TP);   // the template opened, a new name typed, no Save
    { const s = sb.tables.ft_trainings.get(TP); s.data.template.folder = "f2"; s.data.rows.push(ex("t2", "2", "Pull-up")); bump(s); }   // the iPad: Move to Rehab, Pull-up added
    await relaunch(sb, { signal: how === HOWS[0] });
    const d = app.get().templateDraft;
    log.boot = { unsaved: !!(d && d.dirty), base: JSON.parse(maps.seenDoc.get(TK) || "null").title, stamp: maps.seenAt.get(TK) === stamp };
    await edit(sb, how, () => fns.saveDraft());
    const s = sb.tables.ft_trainings.get(TP).data;
    log.server = [s.title, s.template.folder, ...said(s.rows)];
  } finally { done(); }
  assert.deepStrictEqual(log.server, ["Upper A, heavy", "f2", "1 Bench press", "2 Pull-up"], "Save template lost the name typed on the Mac, or the iPad's move or Pull-up: " + JSON.stringify(log));
  assert.deepStrictEqual(log.boot, { unsaved: true, base: "Upper A", stamp: true }, "the draft taken back at the launch measures against another copy than the template as saved, or another stamp than the one it was typed under: " + JSON.stringify(log));
});

for (const how of ["with signal", "with no signal, then the signal back"]) test("no change on Jane's phone (client mode: the account it remembers is a client's): opened again, nothing is taken as a copy read, and her set logged " + how + " before the first sync reaches the server through her rule; the sync then brings the coach's new name and keeps her set", async () => {
  const sb = makeSupabase(); let log = {};
  sb.seed("ft_clients", C, JANE()); sb.seed("ft_trainings", W, legs(), { client_id: C });
  sb.rpcs.client_log_set = async (a) => { const s = sb.tables.ft_trainings.get(a.p_training), r = s.data.rows.find((x) => x.id === a.p_row); r.weights = a.p_weights; r.repsDone = a.p_reps; r.setsDone = a.p_sets_done; r.done = !!a.p_done; if (a.p_seq != null) r.logSeq = a.p_seq; bump(s); return a.p_seq; };   // client-log-set.sql
  phone(sb);
  const realRpc = sb.rpc;
  try {
    await sync();                                                         // her phone's last sync: its device copy
    await relaunch(sb, { as: "jane", signal: !how.includes("no signal") });
    log.boot = { mode: app.get().clientMode, copies: maps.seenDoc.size, stamps: maps.seenAt.size };
    { const s = sb.tables.ft_trainings.get(W); s.data.title = "Legs B"; bump(s); }   // the coach renames Legs meanwhile
    if (how.includes("no signal")) { sb.setFail({ times: 1e6, message: "Failed to fetch" }); sb.rpc = async () => ({ data: null, error: { message: "Failed to fetch" } }); }
    { const t = maps.trainings.get(W), r = t.rows.find((x) => x.id === "sq"); r.weights = ["135"]; r.repsDone = ["8"]; r.setsDone = 1; maps.pendingWeightRows.set(W, new Set(["sq"])); fns.scheduleSave("trainings", W, 0); await settle(); }   // Back squat, set 1: 135 lb x 8
    log.queued = (JSON.parse(localStorage.getItem("fiala.pending.v1") || "{}").docs || []).length;
    if (how.includes("no signal")) { sb.rpc = realRpc; sb.setFail(null); app.set({ offline: false }); flushAll(); await settle(); }
    await sync();
    const sr = sb.tables.ft_trainings.get(W).data.rows.find((x) => x.id === "sq"), t = maps.trainings.get(W);
    log.server = [sr.weights, sr.setsDone]; log.here = [t.title, t.rows.find((x) => x.id === "sq").weights, maps.dirty.has(WK)];
  } finally { sb.rpc = realRpc; done(); }
  assert.deepStrictEqual([log.boot, log.queued], [{ mode: true, copies: 0, stamps: 0 }, 0], "her phone took the device copy for copies read (only the coach's whole-record saves use them): " + JSON.stringify(log));
  assert.deepStrictEqual([log.server, log.here], [[["135"], 1], ["Legs B", ["135"], false]], "her set did not reach the server, or the coach's new name did not come in: " + JSON.stringify(log));
});

// ---------- the cost ----------
test("the cost: a device copy of 5000 workouts (40 clients): the launch takes every one as the copy last read, with its stamp, and doing so (seedBases) stays far under a second (about 12 ms on the Mac these tests were written on, the whole launch about 50 ms); the stamps add about 4% to the device copy", async () => {
  const sb = makeSupabase(); coach(sb); let log = {};
  const ids = [];
  for (let c = 0; c < 40; c++) sb.seed("ft_clients", "c" + String(c).padStart(2, "0"), { id: "c" + String(c).padStart(2, "0"), name: "Client " + c, unit: "lb", email: "client" + c + "@x.com", phone: "310555" + String(1000 + c), notes: { log: [{ id: "n" + c, at: AT, text: "A note" }] } });
  for (let i = 0; i < 5000; i++) {
    const id = "w" + String(i).padStart(4, "0"), cid = "c" + String(i % 40).padStart(2, "0"); ids.push(id);
    const rows = [ex("a", "1", "Back squat"), ex("b", "2a", "Leg press"), ex("c", "2b", "Leg curl"), ex("d", "3", "Calf raise"), ex("e", "4", "Plank"), ex("f", "5", "Bike")];
    if (i % 2) for (const r of rows.slice(0, 3)) { r.weights = ["135", "135", "140", "140"]; r.repsDone = ["8", "8", "8", "6"]; r.setsDone = 4; r.done = true; }
    sb.seed("ft_trainings", id, { id, clientId: cid, title: "Workout " + i, date: day((i % 60) - 30), createdAt: AT, completedAt: i % 2 ? AT : null, skippedAt: null, rows }, { client_id: cid });
  }
  try {
    await sync();
    { const raw = localStorage.getItem(COPY), d = JSON.parse(raw); log.share = (JSON.stringify(d.seen || {}) || "").length / raw.length; }   // what the stamps add to the device copy
    await relaunch(sb, { signal: false });
    log.boot = { copies: maps.seenDoc.size, stamps: maps.seenAt.size, right: ids.every((id) => maps.seenAt.get("trainings/" + id) === sb.tables.ft_trainings.get(id).updated_at) };
    const times = [];
    if (typeof syncJs.seedBases === "function") for (let k = 0; k < 5; k++) {                                         // the same work as at the launch: the records and the stamps taken from the device copy, then seedBases
      maps.seenDoc.clear(); maps.seenAt.clear(); fns.localBackend.load();
      const t0 = performance.now(); syncJs.seedBases(); times.push(performance.now() - t0);
    }
    log.ms = times.map((x) => Math.round(x)); log.median = times.length ? [...times].sort((a, b) => a - b)[2] : Infinity;
    log.after = maps.seenDoc.size;
  } finally { done(); }
  assert.deepStrictEqual(log.boot, { copies: 5040, stamps: 5040, right: true }, "the launch did not take every record of the device copy as the copy last read, each with its own stamp: " + JSON.stringify(log.boot));
  assert.ok(log.after === 5040 && log.median < 1000, "taking 5000 workouts as the copies last read took " + Math.round(log.median) + " ms at a launch (runs: " + log.ms.join(", ") + " ms)");
  assert.ok(log.share < 0.1, "the stamps make up " + Math.round(log.share * 100) + "% of the device copy");
});

// ---------- the read before a write (a device copy with no stamps: the first launch after this release), then the iPad again before the
// Mac's save lands, or the save's write lost and sent again (found while these tests were written: the second merge measured the iPad's
// newer copy against the older one, its second rename undone and the exercise it deleted back) ----------
const onUpdate = (sb, nth, what) => { const real = sb.from; let k = 0, over = false; sb.from = (table) => { const b = real(table), up = b.update, then = b.then; let upd = false; b.update = (row) => { upd = true; up(row); return b; }; b.then = (res, rej) => { if (table === "ft_trainings" && upd && !over && ++k === nth) { over = true; const r = what(); if (r) return Promise.resolve(r).then(res, rej); } return then.call(b, res, rej); }; return b; }; return () => { sb.from = real; }; };   // just before the nth write of a workout goes: the iPad writes, or (what() answering) the write is lost on the way
const COPIES = ["from before this release (no stamps kept)", "of this release"];
const legs3 = (row = ex) => ({ ...legs(), rows: [row("sq", "1", "Back squat"), row("lp", "2", "Leg press"), row("lc", "3", "Leg curl")] });
for (const copy of COPIES) test("the iPad writing again while the Mac's first save after a relaunch is out (a device copy " + copy + "): the iPad's second change is merged against the copy that save just read, never an older one: its second rename and its deletion of the exercise it had added both stand, beside the Mac's fifth set", async () => {
  const sb = makeSupabase(); coach(sb); let log = {};
  sb.seed("ft_clients", C, JANE()); sb.seed("ft_trainings", W, legs3(), { client_id: C });
  try {
    await sync();
    await relaunch(sb, { before: copy === COPIES[0] ? oldCopy : null });
    { const s = sb.tables.ft_trainings.get(W); s.data.title = "Legs (iPad)"; s.data.rows.push(ex("le", "4", "Leg extension")); bump(s); }   // the iPad: renamed, Leg extension added
    const undo = onUpdate(sb, 1, () => { const s = sb.tables.ft_trainings.get(W); s.data.title = "Legs, knee-friendly"; s.data.rows = s.data.rows.filter((r) => r.id !== "le"); bump(s); });   // the iPad again, between the Mac's read and its write
    try { maps.trainings.get(W).rows.find((r) => r.id === "sq").sets = 5; fns.scheduleSave("trainings", W); await settle(); } finally { undo(); }   // the Mac: Back squat's fifth set
    const t = sb.tables.ft_trainings.get(W).data; log = { server: [t.title, ...said(t.rows)], sets: t.rows.find((r) => r.id === "sq").sets };
  } finally { done(); }
  assert.deepStrictEqual(log, { server: ["Legs, knee-friendly", "1 Back squat", "2 Leg press", "3 Leg curl"], sets: 5 }, "the iPad's second rename and its deletion of Leg extension stand, and the Mac's fifth set: " + JSON.stringify(log));
});
for (const copy of COPIES) test("the Mac's first save after a relaunch lost on the way and sent again after the iPad wrote once more (a device copy " + copy + "): the copy it waits with is the one it read, so the iPad's second change is merged against it: its second rename and its deletion of Leg extension stand, beside the Mac's fifth set", async () => {
  const sb = makeSupabase(); coach(sb); let log = {};
  sb.seed("ft_clients", C, JANE()); sb.seed("ft_trainings", W, legs3(), { client_id: C });
  try {
    await sync();
    await relaunch(sb, { before: copy === COPIES[0] ? oldCopy : null });
    { const s = sb.tables.ft_trainings.get(W); s.data.title = "Legs (iPad)"; s.data.rows.push(ex("le", "4", "Leg extension")); bump(s); }
    const undo = onUpdate(sb, 1, () => ({ data: null, error: { message: "Failed to fetch" } }));   // one bar of signal: the write never arrives
    try { maps.trainings.get(W).rows.find((r) => r.id === "sq").sets = 5; fns.scheduleSave("trainings", W); await settle(); } finally { undo(); }
    log.waiting = maps.dirty.has(WK);
    { const s = sb.tables.ft_trainings.get(W); s.data.title = "Legs, knee-friendly"; s.data.rows = s.data.rows.filter((r) => r.id !== "le"); bump(s); }   // the iPad again
    app.set({ offline: false }); fns.flushOne("trainings", W); await settle();   // the signal back: the waiting save goes
    const t = sb.tables.ft_trainings.get(W).data; log.server = [t.title, ...said(t.rows)]; log.sets = t.rows.find((r) => r.id === "sq").sets;
  } finally { done(); }
  assert.deepStrictEqual(log, { waiting: true, server: ["Legs, knee-friendly", "1 Back squat", "2 Leg press", "3 Leg curl"], sets: 5 }, "the iPad's second rename and its deletion of Leg extension stand, and the Mac's fifth set: " + JSON.stringify(log));
});
const bare = (id, label, name) => ({ id, label, name, sets: 4, reps: "8", done: false });   // an exercise as a release before logged sets and alternatives wrote it: no lists at all
for (const copy of COPIES) test("exercises saved by an old release, with no lists of sets or alternatives (a device copy " + copy + "): the Mac's save after a relaunch merges the iPad's rename, then meets the iPad's Delete of Leg curl: an empty list the first merge wrote is no change of the Mac's, so Leg curl stays deleted", async () => {
  const sb = makeSupabase(); coach(sb); let log = {};
  sb.seed("ft_clients", C, JANE()); sb.seed("ft_trainings", W, legs3(bare), { client_id: C });
  try {
    await sync();
    await relaunch(sb, { before: copy === COPIES[0] ? oldCopy : null });
    { const s = sb.tables.ft_trainings.get(W); s.data.title = "Legs (iPad)"; bump(s); }   // the iPad: renamed
    const undo = onUpdate(sb, copy === COPIES[0] ? 1 : 2, () => { const s = sb.tables.ft_trainings.get(W); s.data.rows = s.data.rows.filter((r) => r.id !== "lc"); bump(s); });   // the iPad again, after the Mac's save has merged its rename once: Leg curl deleted
    try { maps.trainings.get(W).rows.find((r) => r.id === "sq").sets = 5; fns.scheduleSave("trainings", W); await settle(); } finally { undo(); }
    const t = sb.tables.ft_trainings.get(W).data; log = { server: [t.title, ...said(t.rows)], sets: t.rows.find((r) => r.id === "sq").sets };
  } finally { done(); }
  assert.deepStrictEqual(log, { server: ["Legs (iPad)", "1 Back squat", "2 Leg press"], sets: 5 }, "the iPad's rename and its Delete of Leg curl stand, and the Mac's fifth set: " + JSON.stringify(log));
});
test("the device copy moved into the browser's database at a launch keeps the server's stamps, so a workout deleted on the iPad while the Mac was closed stays deleted when the Mac edits it before its first sync (the stamps were lost in the move: the edit wrote it back)", () => {
  const r = JSON.parse(execFileSync(process.execPath, [new URL("./relaunch-copy-probe.mjs", import.meta.url).pathname], { encoding: "utf8", timeout: 60000 }).trim().split("\n").pop());
  assert.deepStrictEqual(r, { launchA: { inLocalStorage: true, stamp: true }, launchB: { inDb: true, stampInDb: true, stampInMemory: true, leftInLocalStorage: false }, launchC: { stamp: true, copy: true, writtenAgain: false } }, JSON.stringify(r));
});

// ---------- a package edited on the iPad while the Mac was closed (the twenty-third check round, R23-RLN-3; the Mac open all along, or with no
// signal and no relaunch, is in merge-fields.test.js): the Mac's first save of the Templates record after the relaunch kept its own older copy
// of every package both copies held (only a package deleted on the iPad was measured against the copy read: the audit's #9) ----------
const JANE_ON = () => ({ ...JANE(), plan: { id: "p1", name: "10 sessions", kind: "sessions", size: 10, startedOn: day(-20) } });   // Jane on the package 10 sessions
const iPadPackage = (sb) => {                                             // the iPad: Packages, 10 sessions tapped, 12 sessions, size 12, In person off, Save changes (main.js packAdd): the Templates record, then each client on it
  { const s = sb.tables.ft_clients.get(TEMPLATES_ID); s.data.packages = s.data.packages.map((p) => (p.id === "p1" ? { ...p, name: "12 sessions", kind: "sessions", size: 12, inPerson: false } : p)); bump(s); }
  { const s = sb.tables.ft_clients.get(C); s.data.plan = { ...s.data.plan, name: "12 sessions", kind: "sessions", size: 12 }; bump(s); }
};
const packsHere = () => (maps.clients.get(TEMPLATES_ID).packages || []).filter((p) => p && p.id);   // main.js packagesList
const MAC_TPL = {                                                         // the Mac's change after the relaunch, as main.js's own lines make it; each saves the Templates record
  "renames folder Strength": () => { const tc = maps.clients.get(TEMPLATES_ID); tc.folders = tc.folders.map((f) => (f.id === "f1" ? { ...f, name: "Strength block" } : f)); maps.folderTouched.set("f1", TEMPLATES_ID); fns.scheduleSave("clients", TEMPLATES_ID); },   // as Rename folder does once its question is answered
  "adds a package": () => { maps.clients.get(TEMPLATES_ID).packages = [...packsHere(), { id: "p9", name: "5 sessions", kind: "sessions", size: 5, inPerson: false }]; maps.planTouched.add(TEMPLATES_ID); fns.scheduleSave("clients", TEMPLATES_ID); },   // as Add package does
  "edits the other package": () => { maps.clients.get(TEMPLATES_ID).packages = packsHere().map((p) => (p.id === "p2" ? { ...p, name: "4-week plan", kind: "monthly", size: null, inPerson: true } : p)); maps.planTouched.add(TEMPLATES_ID); fns.scheduleSave("clients", TEMPLATES_ID); },   // as Save changes does: 4-week plan, In person on (no client on it)
};
const pkWords = (p) => p.name + " (" + (p.size == null ? "no size" : p.size) + (p.inPerson ? ", In person" : "") + ")";
const tplNow = (tc) => ({ packages: (tc.packages || []).map(pkWords), folders: (tc.folders || []).map((f) => f.name) });
const PACK_HOWS = [...HOWS, "before the first sync, on a device copy from before this release (no stamps kept)"];
for (const [mine, change] of Object.entries(MAC_TPL)) for (const how of PACK_HOWS) test("a package edited on the iPad while the Mac was closed (10 sessions made 12 sessions, size 12, In person off) stays when the Mac, opened again, " + mine + " " + how + ": the server and the Mac hold the iPad's 12 sessions beside the Mac's own change, and after the next sync the package on the Mac and Jane's card agree (the twenty-third check round: the Mac's save wrote its older 10 sessions back, In person on, while her card kept 12)", async () => {
  const sb = makeSupabase(); coach(sb); let log = {};
  const old = how === PACK_HOWS[3];
  sb.seed("ft_clients", TEMPLATES_ID, TPL()); sb.seed("ft_clients", C, JANE_ON());
  try {
    await sync();                                                         // the Mac's last sync before it closed
    iPadPackage(sb);
    await relaunch(sb, { signal: how === HOWS[0] || old, before: old ? oldCopy : null });
    await edit(sb, old ? HOWS[0] : how, change);
    log = { server: tplNow(sb.tables.ft_clients.get(TEMPLATES_ID).data), here: tplNow(maps.clients.get(TEMPLATES_ID)), waiting: [...maps.dirty.keys()] };
    await sync();                                                         // and the next sync: the package Jane's new workouts take (packageOf), and her card
    { const pk = fns.packageOf(maps.clients.get(C)), plan = maps.clients.get(C).plan; log.after = { packageOf: pk ? pkWords(pk) : null, card: plan.name + " (" + plan.size + ")" }; }
  } finally { done(); }
  const want = { packages: ["12 sessions (12)", mine === "edits the other package" ? "4-week plan (no size, In person)" : "4-week plan (no size)", ...(mine === "adds a package" ? ["5 sessions (5)"] : [])], folders: [mine === "renames folder Strength" ? "Strength block" : "Strength", "Rehab", "Mobility"] };
  assert.deepStrictEqual(log.server, want, "the server holds the Mac's older copy of the package the iPad edited, or lost the Mac's own change: " + JSON.stringify(log));
  assert.deepStrictEqual([log.here, log.waiting], [want, []], "the Mac shows other Templates than its save wrote (or the save still waits): " + JSON.stringify(log));
  assert.deepStrictEqual(log.after, { packageOf: "12 sessions (12)", card: "12 sessions (12)" }, "after the sync the package on the Mac and Jane's card disagree (her new workouts would take the old package): " + JSON.stringify(log));
});

// ---------- exercises made with + Add exercise (the twenty-third check round, R23-RLN-2): main.js newRow writes no done key, and a merge
// writes done: false into every exercise it takes from the server (mergeServerRows); normRow read the two as different, so after one merge
// every exercise read as changed here, and one the iPad deleted came back when the same save merged again: its write lost and sent again, or
// the iPad writing between its read and its write. The tests above build their exercises with done: false, which is why they missed it ----------
const LOST = () => ({ data: null, error: { message: "Failed to fetch" } });   // one bar of signal: the write never arrives
const added = async (sb) => {                                             // Legs for Jane, built on the Mac: + Add exercise three times (main.js addExercise), the names typed, saved
  sb.seed("ft_clients", C, JANE()); await sync();
  fns.addTraining(C, null, D2, true); const t = [...maps.trainings.values()].find((x) => x.clientId === C);
  app.set({ view: { name: "training", id: t.id } });
  for (const name of ["Back squat", "Leg press", "Leg curl"]) { const was = t.rows.length; try { fns.addExercise(); } catch (_) {} assert.strictEqual(t.rows.length, was + 1, "+ Add exercise added no exercise"); Object.assign(t.rows[was], { name, reps: "8" }); fns.scheduleSave("trainings", t.id); }   // (the page it draws after adding does not draw in Node: caught)
  t.title = "Legs"; fns.scheduleSave("trainings", t.id); await settle(); app.set({ view: { name: "clients" } });
  assert.deepStrictEqual(sb.tables.ft_trainings.get(t.id).data.rows.map((r) => r.name + ("done" in r ? " (with a done key)" : "")), ["Back squat", "Leg press", "Leg curl"], "(the setup: the server holds the three exercises as + Add exercise made them, with no done key)");
  return t.id;
};
const janeLogs = (sb, id) => { const s = sb.tables.ft_trainings.get(id), r = s.data.rows.find((x) => x.name === "Leg press"); Object.assign(r, { weights: ["90"], repsDone: ["10"], setsDone: 1, done: false }); bump(s); };   // her phone (client_log_set): Leg press, set 1
const iPadDeletesCurl = (sb, id) => { const s = sb.tables.ft_trainings.get(id); s.data.rows = s.data.rows.filter((r) => r.name !== "Leg curl"); bump(s); };   // the iPad: Delete exercise on Leg curl (the last one: nothing to renumber)
const AGAIN = ["its write is lost and the iPad deletes Leg curl before the save goes again", "the iPad deletes Leg curl between that read and the Mac's write"];
for (const when of AGAIN) test("a workout built with + Add exercise (no done key), the Mac open all along: its rename meets Jane's set and merges it, then " + when + ": Leg curl stays deleted, beside the rename and her set (the twenty-third check round: after the first merge every exercise read as changed here, and Leg curl was written back)", async () => {
  const sb = makeSupabase(); coach(sb); let log = {};
  const lost = when === AGAIN[0];
  try {
    const id = await added(sb), k = "trainings/" + id;
    janeLogs(sb, id);
    const undo = onUpdate(sb, 2, lost ? LOST : () => { iPadDeletesCurl(sb, id); });   // the first write meets her set (a conflict: merged); the second never arrives, or the iPad writes just before it
    try { maps.trainings.get(id).title = "Legs B"; fns.scheduleSave("trainings", id); await settle(); } finally { undo(); }
    if (lost) { log.waiting = maps.dirty.has(k); iPadDeletesCurl(sb, id); app.set({ offline: false }); fns.flushOne("trainings", id); await settle(); }   // the signal back: the waiting save goes
    const s = sb.tables.ft_trainings.get(id).data; log.server = [s.title, ...said(s.rows)]; log.set = (s.rows.find((r) => r.name === "Leg press") || {}).weights; log.left = maps.dirty.has(k);
  } finally { done(); }
  assert.deepStrictEqual(log, { ...(lost ? { waiting: true } : {}), server: ["Legs B", "1 Back squat", "2 Leg press"], set: ["90"], left: false }, "Leg curl, deleted on the iPad, came back (or the rename or Jane's set was lost): " + JSON.stringify(log));
});
for (const copy of COPIES) for (const when of AGAIN) test("a workout built with + Add exercise (no done key), renamed on the iPad while the Mac was closed (a device copy " + copy + "): the Mac's first save after the relaunch (Back squat's fifth set) merges the rename, then " + when + ": Leg curl stays deleted, beside the iPad's rename and the fifth set (the twenty-third check round: Leg curl was written back)", async () => {
  const sb = makeSupabase(); coach(sb); let log = {};
  const lost = when === AGAIN[0], nth = copy === COPIES[0] ? 1 : 2;      // no stamp: the save reads first and merges, so its first write follows the merge; a stamp: its first write meets the rename (a conflict), the second follows the merge
  try {
    const id = await added(sb), k = "trainings/" + id;
    { const s = sb.tables.ft_trainings.get(id); s.data.title = "Legs (iPad)"; bump(s); }   // the iPad, while the Mac was closed
    await relaunch(sb, { before: copy === COPIES[0] ? oldCopy : null });
    const undo = onUpdate(sb, nth, lost ? LOST : () => { iPadDeletesCurl(sb, id); });
    try { maps.trainings.get(id).rows.find((r) => r.name === "Back squat").sets = 5; fns.scheduleSave("trainings", id); await settle(); } finally { undo(); }
    if (lost) { log.waiting = maps.dirty.has(k); iPadDeletesCurl(sb, id); app.set({ offline: false }); fns.flushOne("trainings", id); await settle(); }
    const s = sb.tables.ft_trainings.get(id).data; log.server = [s.title, ...said(s.rows)]; log.sets = s.rows.find((r) => r.name === "Back squat").sets; log.left = maps.dirty.has(k);
  } finally { done(); }
  assert.deepStrictEqual(log, { ...(lost ? { waiting: true } : {}), server: ["Legs (iPad)", "1 Back squat", "2 Leg press"], sets: 5, left: false }, "Leg curl, deleted on the iPad, came back (or the iPad's rename or the fifth set was lost): " + JSON.stringify(log));
});

// ---------- the coach's account, then a client's, on one device (the twenty-third check round, R23-RLN-1): no sign-out cleared the stamps or
// the copies read, so after the coach signed out on Jane's phone (or his session ended elsewhere), her sign-in wrote them into her own
// storage: the id and change time of every record of his account in her device copy, and his copy of her record, his private note about her
// with it, in her queue. Every hand-written clear list now clears both, and a client's page keeps none at all. Each sign-in goes through
// main.js's own boot, the library holding that person's session ----------
const C2 = "7d9f1b3c-2222-4e5a-8b7c-2d4e6f8a0b1c", W2 = "7d9f1b3c-4444-4e5a-8b7c-2d4e6f8a0b1c", WK2 = "trainings/" + W2;   // Omar Sample, and his Legs
const COACH = "coach@x.com", HER = "jane@x.com", HIS_NOTE = "Going through a hard time at work, go easy";   // the coach's own note about Jane: the server never sends it to her (client_my_data: data - 'notes')
const shared = () => {                                                    // the server behind one shared phone
  const sb = makeSupabase(); sb.tables.trainers = new Map(); let told = null;   // trainers: the coach's row is all row-level security shows him; a client sees none
  sb.as = (email) => { sb.auth.getSession = async () => ({ data: { session: email ? { user: { email } } : null }, error: null }); sb.tables.trainers.clear(); if (email === COACH) sb.tables.trainers.set("t1", { id: "t1", email }); };   // whose session the library holds
  sb.auth.onAuthStateChange = (cb) => { told = cb; return { data: { subscription: { unsubscribe() {} } } }; };
  sb.tell = (event) => { if (told) told(event, null); };              // the library to the page: SIGNED_OUT (his Sign out here, or his session ended elsewhere)
  sb.auth.signOut = async () => { sb.as(null); sb.tell("SIGNED_OUT"); return { error: null }; };   // as supabase-js does: the session gone, then SIGNED_OUT
  sb.rpcs.client_my_data = async () => ({ clients: [{ id: C, data: (({ notes, ...rest }) => rest)(JSON.parse(JSON.stringify(sb.tables.ft_clients.get(C).data))) }], trainings: [...sb.tables.ft_trainings.values()].filter((t) => t.client_id === C).map((t) => ({ id: t.id, data: JSON.parse(JSON.stringify(t.data)), updated_at: t.updated_at })) });
  sb.seed("ft_clients", C, { ...JANE(), notes: { log: [{ id: "n1", at: AT, text: HIS_NOTE }] }, choices: { zone: { state: "deny", at: AT } } });   // (her time-zone question answered before: no question comes up over her page)
  sb.seed("ft_clients", C2, { id: C2, name: "Omar Sample", unit: "lb", email: "omar@x.com", phone: "3105550177", notes: { log: [{ id: "n9", at: AT, text: "Cardiologist letter on file" }] }, health: { conditions: "Arrhythmia" } });
  sb.seed("ft_trainings", W, legs(), { client_id: C }); sb.seed("ft_trainings", W2, { ...legs(), id: W2, clientId: C2 }, { client_id: C2 });
  return sb;
};
const openApp = async (sb, email) => { sb.as(email); globalThis.supabase = { createClient: () => sb }; try { await fns.boot(); await settle(); } finally { delete globalThis.supabase; } };   // main.js's own boot, the library holding this session: a sign-in as the app opens
const closeApp = () => { const keep = Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i)).map((k) => [k, localStorage.getItem(k)]); quiet(); app.reset(); for (const [k, v] of keep) if (v != null) localStorage.setItem(k, v); app.set({ sb: null, signedIn: false, clientMode: false, myClientId: null, backend: null, offline: false, offlineEntry: null, sessionEmail: "", pendingOwner: "", view: { name: "clients" } }); };   // closed: only what the device keeps is left
const hisRenameWaits = async (sb) => { sb.setFail({ times: 1e6, message: "Failed to fetch" }); maps.trainings.get(W2).title = "Legs B"; fns.scheduleSave("trainings", W2); await settle(); sb.setFail(null); app.set({ offline: false }); };   // his rename of Omar's Legs, waiting for the signal
const inPage = () => ({ stamps: maps.seenAt.size, copies: maps.seenDoc.size, health: [...maps.seenDoc.values()].some((d) => d.includes("Arrhythmia")) });
const herStorage = async (sb) => {                                       // what Jane's phone keeps: her device copy, and her queue once her Weights in switch to kg waits for the signal
  fns.localBackend.save(); await settle();
  const copy = JSON.parse(localStorage.getItem(COPY) || "{}");
  const real = sb.rpc; sb.rpc = async (name, args) => (name === "client_set_profile" ? { data: null, error: { message: "Failed to fetch" } } : real(name, args));
  try { fns.setProfile(C, "unit", "kg"); await settle(); } finally { sb.rpc = real; }
  const q = JSON.parse(localStorage.getItem("fiala.pending.v1") || "{}"), kept = Array.from({ length: localStorage.length }, (_, i) => localStorage.getItem(localStorage.key(i)) || "").join("\n");
  return { her: !!app.get().clientMode && app.get().myClientId === C, waiting: (q.dirty || []).includes(CK), stamps: Object.keys(copy.seen || {}).sort(), copies: (q.docs || []).map((e) => e[0]), hisNote: kept.includes(HIS_NOTE), omar: kept.includes("Omar") };
};
const CLEAN = { her: true, waiting: true, stamps: [], copies: [], hisNote: false, omar: false };
const NONE = { stamps: 0, copies: 0, health: false };

test("the coach's Sign out on Jane's phone, then Jane signs in on the same page (the app never closed): nothing of his stamps or copies read stays in the page (another client's health details among them), and none of it reaches her device copy or her queue: no record of his in her copy's stamps, no copy of his of her record (his private note about her) in her queue (the twenty-third check round: no sign-out cleared them, and her device copy and her queue wrote them)", async () => {
  const sb = shared(); let log = {};
  try {
    await openApp(sb, COACH);                                             // the coach signs in on her phone; his first sync lands
    log.coach = { mode: app.get().clientMode, ...inPage() };
    await fns.signOut(); await settle();                                  // Sign out (Settings)
    log.out = { signedIn: app.get().signedIn, records: maps.clients.size + maps.trainings.size, ...inPage() };
    await openApp(sb, HER);                                               // Jane signs in on that page
    log.page = inPage(); log.jane = await herStorage(sb);
  } finally { done(); }
  assert.deepStrictEqual(log.coach, { mode: false, stamps: 4, copies: 4, health: true }, "(the setup: the coach signed in, his first sync in, every record with its stamp and its copy read): " + JSON.stringify(log));
  assert.deepStrictEqual(log.out, { signedIn: false, records: 0, ...NONE }, "after the coach's Sign out the page still holds his stamps or his copies read (another client's health details among them): " + JSON.stringify(log.out));
  assert.deepStrictEqual([log.page, log.jane], [NONE, CLEAN], "the coach's stamps, his copies read, his private note about Jane or anything of Omar's reached Jane's page, her device copy or her queue: " + JSON.stringify(log));
});

test("the coach's session ended elsewhere with nothing waiting (a password changed on his iPad) while he was signed in on Jane's phone: the page wipes the device and keeps none of his stamps or copies read, and Jane, signing in next on that page, gets none of them (the twenty-third check round: the wipe left both in the page, and her sign-in wrote them into her storage)", async () => {
  const sb = shared(); let log = {};
  try {
    await openApp(sb, COACH);
    sb.as(null); sb.tell("SIGNED_OUT"); await settle();                  // nothing waits, so the page wipes the device (wipeDevice)
    log.out = { signedIn: app.get().signedIn, records: maps.clients.size + maps.trainings.size, ...inPage() };
    await openApp(sb, HER);
    log.page = inPage(); log.jane = await herStorage(sb);
  } finally { done(); }
  assert.deepStrictEqual(log.out, { signedIn: false, records: 0, ...NONE }, "after his session ended elsewhere the page still holds his stamps or his copies read: " + JSON.stringify(log.out));
  assert.deepStrictEqual([log.page, log.jane], [NONE, CLEAN], "the coach's stamps, his copies read, his private note about Jane or anything of Omar's reached Jane's page, her device copy or her queue: " + JSON.stringify(log));
});

test("the coach's session ended elsewhere while his rename of Omar's workout waited for the signal (the device keeps his copy and his queue for his next sign-in), the app closed and opened again, and Jane signs in: her sign-in starts clean, none of his stamps or copies read in the page, her device copy or her queue (the twenty-third check round: the launch took every record of his as a copy read, and her copy and her queue kept them)", async () => {
  const sb = shared(); let log = {};
  try {
    await openApp(sb, COACH);
    await hisRenameWaits(sb);
    sb.as(null); sb.tell("SIGNED_OUT"); await settle();                  // his work waits: the device keeps it, and forgets the account it remembers
    { const q = JSON.parse(localStorage.getItem("fiala.pending.v1") || "{}"); log.kept = { waiting: q.dirty, owner: q.owner, remembered: localStorage.getItem("fiala.trainings.role") }; }
    closeApp();
    await openApp(sb, HER);
    log.page = inPage(); log.jane = await herStorage(sb);
  } finally { done(); }
  assert.deepStrictEqual(log.kept, { waiting: [WK2], owner: COACH, remembered: null }, "(the setup: his rename waits on the device, under his account, and no account is remembered): " + JSON.stringify(log));
  assert.deepStrictEqual([log.page, log.jane], [NONE, CLEAN], "the coach's stamps, his copies read, his private note about Jane or anything of Omar's reached Jane's page, her device copy or her queue: " + JSON.stringify(log));
});

test("Jane signs in on a phone whose page holds the coach's stamps and copies read and whose queue names no account, so no account switch clears them (his app closed while he was signed in with nothing waiting, his session gone by the next open): none stay in her page or reach her device copy or her queue (the twenty-third check round: a client's page keeps no stamps or copies read at all, whatever the page held before her sign-in)", async () => {
  const sb = shared(); let log = {};
  try {
    await openApp(sb, COACH);
    closeApp();
    { const q = JSON.parse(localStorage.getItem("fiala.pending.v1")); delete q.owner; localStorage.setItem("fiala.pending.v1", JSON.stringify(q)); }   // a queue that names no account (restorePending takes a missing owner as none)
    await openApp(sb, HER);
    log.page = inPage(); log.jane = await herStorage(sb);
  } finally { done(); }
  assert.deepStrictEqual([log.page, log.jane], [NONE, CLEAN], "the coach's stamps, his copies read, his private note about Jane or anything of Omar's reached Jane's page, her device copy or her queue: " + JSON.stringify(log));
});

const holdSync = (sb) => {                                                // one bar of signal: the sync's read of the workouts waits until opened (a save's own reads and writes go on)
  const real = sb.from; let go; const gate = new Promise((r) => { go = r; });
  sb.from = (table) => { const b = real(table); if (table !== "ft_trainings") return b; const order = b.order, then = b.then; let paged = false; b.order = (col) => { paged = true; order(col); return b; }; b.then = (res, rej) => (paged ? gate.then(() => then.call(b, res, rej)) : then.call(b, res, rej)); return b; };
  return { open: () => { sb.from = real; go(); } };
};
test("no change for the coach himself: his session ended elsewhere while his rename of Omar's workout waited; meanwhile the iPad deletes Leg press from Jane's Legs (the numbers close up); the app opened again, he signs in and gives Back squat a fifth set before his first sync lands: Leg press stays deleted, measured against the copy the launch took (seedBases: on any device whose remembered account is not a client's), and his waiting rename lands (a launch that took no copy read when no account was remembered wrote Leg press back)", async () => {
  const sb = shared(); let log = {};
  try {
    await openApp(sb, COACH);
    await hisRenameWaits(sb);
    sb.as(null); sb.tell("SIGNED_OUT"); await settle();
    { const s = sb.tables.ft_trainings.get(W); s.data.rows = s.data.rows.filter((r) => r.id !== "lp"); for (const [id, l] of [["lc", "2"], ["ca", "3"]]) s.data.rows.find((r) => r.id === id).label = l; bump(s); }   // the iPad: Delete exercise on Leg press
    closeApp();
    const gate = holdSync(sb); sb.as(COACH); globalThis.supabase = { createClient: () => sb };
    let opening = null;
    try {
      opening = fns.boot();
      for (let i = 0; i < 5000 && !(app.get().signedIn && !app.get().clientMode && app.get().backend === fns.cloudBackend); i++) await tick(2);   // signed in again, his first sync on its way
      log.before = { coach: app.get().backend === fns.cloudBackend, synced: !!app.get().syncedOnce };
      log.base = { copy: maps.seenDoc.has(WK), stamp: maps.seenAt.has(WK) };
      maps.trainings.get(W).rows.find((r) => r.id === "sq").sets = 5; fns.scheduleSave("trainings", W, 0); await settle();   // Back squat's fifth set, saved before the first sync lands
    } finally { gate.open(); await opening; delete globalThis.supabase; }
    await settle();
    const s = sb.tables.ft_trainings.get(W).data; log.server = said(s.rows); log.sets = s.rows.find((r) => r.id === "sq").sets; log.omar = sb.tables.ft_trainings.get(W2).data.title; log.waiting = [...maps.dirty.keys()];
  } finally { delete globalThis.supabase; done(); }
  assert.deepStrictEqual(log.before, { coach: true, synced: false }, "(the setup: signed in again as the coach, his first sync not in yet): " + JSON.stringify(log));
  assert.deepStrictEqual([log.server, log.sets, log.omar, log.waiting], [["1 Back squat", "2 Leg curl", "3 Calf raise"], 5, "Legs B", []], "Leg press, deleted on the iPad, came back with his fifth set, or his waiting rename was lost: " + JSON.stringify(log));
  assert.deepStrictEqual(log.base, { copy: true, stamp: true }, "the launch took no copy read of Legs (or no stamp) on a device that remembers no account: " + JSON.stringify(log));
});

test("every hand-written clear list clears the stamps and the copies read with the rest (the account switch, both sign-outs, the wipe), and a client's sign-in clears both before anything else", () => {
  const src = fs.readFileSync(new URL("../app/main.js", import.meta.url), "utf8");
  const listAt = (head) => { const i = src.indexOf(head); assert.ok(i >= 0, "main.js no longer has: " + head); return src.slice(i, src.indexOf("\n", src.indexOf("dirty.clear();", i))); };
  for (const head of ["if (S.pendingOwner && S.pendingOwner !== S.sessionEmail) {", "const signOutClient = async () => {", "const wipeDevice = () => {", "const signOutTrainer = async () => {"]) assert.ok(listAt(head).includes("deletedHere.clear(); seenAt.clear(); seenDoc.clear();"), "this clear list leaves the stamps or the copies read in the page: " + head);
  const branch = src.indexOf("    if (S.clientMode) {\n      seenAt.clear(); seenDoc.clear();"); assert.ok(branch > src.indexOf("async function enterCloudNow(session) {"), "a client's sign-in (enterCloudNow) no longer clears the stamps and the copies read first");
});
