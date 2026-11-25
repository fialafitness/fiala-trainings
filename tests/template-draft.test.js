// v316 (the twenty-first check round, 24 Nov 2026): a template's draft against the coach's other device. Discard goes back to the template
// as saved, never as the page was first drawn; a Save that merged the iPad's changes is the new "as saved"; a draft taken back at a relaunch
// measures its Save against the template as saved here; Save template with no signal sends only what was saved; and opening a template
// (the drawing adds empty sets) is no change to its exercises.
// The twenty-second check round: a relaunch here is main.js's own boot (the device copy, the unsaved draft kept on the device, the queue,
// draftBase, in boot's order), never a copy of it; a reps typed into a card while or just after a merging Save lands in the template; a
// merged Save that loses the signal sends the merged copy later; the draft kept on the device follows the merge, carries the server's stamp
// and goes with a template deleted elsewhere; a second window follows the first's draft; the numbers the page tidies, an alternative's old
// name and the server's own key order are no change of this device's; and the page puts an exercise whose number was just typed where its
// letter asks (template-draft-labels-probe.mjs). Found while those tests were written: the unsaved draft kept on the device names the
// window that typed it last, so another window's Save template or Discard leaves it (of one template or another), a draft only taken back
// at a launch goes with its own Save or Discard, and a restore or a Delete of a template takes its draft with it whichever window typed it,
// never another template's. Made-up data only.
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { test, assert, tick } from "./assert.js";
import { makeSupabase } from "./fake-supabase.js";
import { el, byId } from "./env.js";
import { load } from "./load.js";
import { TEMPLATES_ID, cmpLabel } from "../app/model.js";
import { ALIASES } from "../app/catalog.js";
const app = await load();
const { fns, maps } = app;
const settle = async () => { const until = Date.now() + 15000; do await tick(5); while ((app.get().inflight > 0 || maps.timers.size) && Date.now() < until); };
const clone = (x) => JSON.parse(JSON.stringify(x));
const TP = "4b6d8f0a-2c4e-4a6b-8d0f-1a3c5e7a9b1d", AT = "2026-11-10T16:00:00.000Z";
let n = 0; const bump = (s) => { s.updated_at = "2026-11-24T10:" + String(10 + Math.floor(n / 50) % 50).padStart(2, "0") + ":" + String(10 + (n++ % 50)).padStart(2, "0") + ".000Z"; };
const ex = (id, label, name) => ({ id, label, name, sets: 3, reps: "8", rest: "", tempo: "", weights: [], repsDone: [], setsDone: 0, done: false, note: "" });
const coach = (sb) => { app.reset(); fns.leaveSettings(); app.set({ sb, signedIn: true, clientMode: false, backend: fns.cloudBackend, sessionEmail: "coach@x.com", view: { name: "clients" }, templateDraft: null }); };
const PLACE = { program: "My templates", phase: 0, stage: 0, n: 1, folder: "f1" };
const seed = (sb, rows = [ex("t1", "1", "Bench press")], place = PLACE) => {
  sb.seed("ft_clients", TEMPLATES_ID, { id: TEMPLATES_ID, name: "Templates", kind: "templates", templatesVersion: 3, folders: [{ id: "f1", name: "Strength", parent: null, kind: "folder", at: AT }, { id: "f2", name: "Rehab", parent: null, kind: "folder", at: AT }, { id: "f3", name: "Mobility", parent: null, kind: "folder", at: AT }], builtinsAdopted: 1 });
  sb.seed("ft_trainings", TP, { id: TP, clientId: TEMPLATES_ID, title: "Upper A", date: "2026-01-01", createdAt: AT, completedAt: null, skippedAt: null, template: clone(place), rows });
};
const ipad = (sb, f) => { const s = sb.tables.ft_trainings.get(TP); f(s.data); bump(s); };
const moveAndPullUp = (d) => { d.template.folder = "f2"; d.rows.push(ex("t2", "2", "Pull-up")); };   // the iPad: Move to Rehab, Add exercise Pull-up, Save template there
const drawn = () => { const t = maps.trainings.get(TP); t.rows.sort((a, b) => cmpLabel(a.label, b.label)); for (const r of t.rows) { const k = Math.max(1, parseInt(r.sets, 10) || 4); r.weights = (r.weights || []).slice(0, k); while (r.weights.length < k) r.weights.push(""); r.repsDone = (r.repsDone || []).slice(0, k); } };   // what the page's drawing does to the exercises: in the order of their numbers (renderTraining), each with its sets' boxes (renderWeights)
const open = () => { fns.draftFor(maps.trainings.get(TP)); drawn(); };   // the template's page: its draft first, then the cards (env.js draws no card, so the drawing is done here as renderTraining and renderWeights do it)
const type = (title) => { maps.trainings.get(TP).title = title; fns.scheduleSave("trainings", TP); };   // as the name box's input handler does
const save = async () => { fns.saveDraft(); await settle(); };
const discard = async () => { fns.discardDraft(); await settle(); };   // (the Discard button asks first: "The template stays as it was.")
const shape = (t) => (t ? [t.title, t.template ? t.template.folder : null, (t.rows || []).map((r) => r.name).join("+")] : null);   // (null: not there; a workout has no place among the templates)
const server = (sb) => { const s = sb.tables.ft_trainings.get(TP); return s ? shape(s.data) : null; };
const here = () => shape(maps.trainings.get(TP));
const snap = () => shape(JSON.parse(app.get().templateDraft.snapshot));
const stored = () => { const d = JSON.parse(localStorage.getItem("fiala.trainings.draft") || "null"); return d ? shape(d.doc) : null; };   // the unsaved draft kept on the device
const unsaved = () => !!(app.get().templateDraft && app.get().templateDraft.dirty);
const reps = (t) => t && t.rows.map((r) => r.name + " " + r.reps);
const sync = async () => { await fns.syncDownNow(); await settle(); };
const done = () => { for (const tm of maps.timers.values()) clearTimeout(tm); clearTimeout(app.get().syncTimer); app.set({ templateDraft: null, view: { name: "clients" } }); app.reset(); localStorage.clear(); };
const relaunch = async (sb) => {                                      // the app closed and opened again: only the device copy, the queue and the unsaved draft are left, and main.js's own boot takes them back (as the coach's Mac with the cloud library still on its way: the account it remembers, then signed in, no sync yet)
  const keep = ["fiala.pending.v1", "fiala.trainings.v1", "fiala.trainings.draft"].map((k) => [k, localStorage.getItem(k)]);
  for (const tm of maps.timers.values()) clearTimeout(tm);
  clearTimeout(app.get().syncTimer); app.reset(); for (const [k, v] of keep) if (v != null) localStorage.setItem(k, v);
  localStorage.setItem("fiala.trainings.role", JSON.stringify({ email: "coach@x.com", role: "trainer" }));
  const lib = globalThis.supabase; delete globalThis.supabase;
  try { await fns.boot(); } finally { if (lib !== undefined) globalThis.supabase = lib; }
  app.set({ sb, signedIn: true, clientMode: false, backend: fns.cloudBackend, sessionEmail: "coach@x.com", view: { name: "clients" }, offline: false, offlineEntry: null });
};
const atRequest = (sb, op, nth, what) => {                             // the stand-in server's nth request of this kind for the template ("update", or "read": a read of it by its id): "lost" (the signal drops on the way: it never lands), "answer lost" (it lands, its answer never comes back), or what the coach did while it was on its way
  const real = sb.from; let seen = 0;
  sb.from = (table) => {
    const b = real(table), up = b.update, eq = b.eq, then = b.then; let kind = "read", one = false;
    b.update = (row) => { kind = "update"; up(row); return b; };
    b.eq = (col, v) => { if (col === "id") one = true; eq(col, v); return b; };
    b.then = (res, rej) => {
      if (table !== "ft_trainings" || kind !== op || !one || ++seen !== nth) return then.call(b, res, rej);
      if (what === "lost") return Promise.resolve({ data: null, error: { message: "Failed to fetch" } }).then(res, rej);
      if (what === "answer lost") return then.call(b, () => res({ data: null, error: { message: "network timeout" } }), rej);
      what(); return then.call(b, res, rej);
    };
    return b;
  };
  return () => { sb.from = real; };
};
const WANT = ["f2", "Bench press+Pull-up"];

test("a template looked at earlier (or left open) with nothing typed, then saved on the iPad and synced in: Discard goes back to the iPad's copy, Back up writes it, and Discard then Save keeps the iPad's move and exercise on the server (the twenty-first check round: the draft kept the template as its page was first drawn)", async () => {
  for (const how of ["looked at earlier, Back, opened again", "page left open"]) {
    const sb = makeSupabase(); coach(sb); seed(sb); const log = {};
    try {
      await sync(); open();
      if (how.startsWith("looked")) app.set({ view: { name: "client", id: TEMPLATES_ID } });   // Back, nothing typed (the draft stays, clean)
      ipad(sb, moveAndPullUp); await sync();
      if (how.startsWith("looked")) open();
      log.snap = snap(); type("Upper A1"); log.backup = shape(fns.backupData().trainings[TP]);
      await discard(); log.afterDiscard = here();
      type("Upper A2"); await save(); log.server = server(sb);
      await sync(); log.serverAfterSync = server(sb); log.hereAfterSync = here();
    } finally { done(); }
    assert.deepStrictEqual(log, { snap: ["Upper A", ...WANT], backup: ["Upper A", ...WANT], afterDiscard: ["Upper A", ...WANT], server: ["Upper A2", ...WANT], serverAfterSync: ["Upper A2", ...WANT], hereAfterSync: ["Upper A2", ...WANT] }, how);
  }
});

test("Save template meets the iPad's newer copy and merges it: that merged copy is the template as saved (Discard goes back to it, Back up writes it, the next Save keeps it), also when a name is typed while that Save is on its way", async () => {
  for (const slow of [false, true]) {
    const sb = makeSupabase(); coach(sb); seed(sb); const log = {};
    try {
      await sync(); open(); type("Upper A1");
      ipad(sb, moveAndPullUp); await sync();                                   // the sync passes over the draft (unsaved changes here)
      if (slow) { const undo = atRequest(sb, "update", 1, () => type("Upper A1 x")); await save(); undo(); } else await save();   // (slow: " x" typed as the save goes, before its merge)
      log.firstSave = server(sb); log.snap = snap();
      type("Upper A1 y"); log.backup = shape(fns.backupData().trainings[TP]);
      await discard(); log.afterDiscard = here();
      type("Upper A2"); await save(); log.server = server(sb);
    } finally { done(); }
    assert.deepStrictEqual(log, { firstSave: ["Upper A1", ...WANT], snap: ["Upper A1", ...WANT], backup: ["Upper A1", ...WANT], afterDiscard: ["Upper A1", ...WANT], server: ["Upper A2", ...WANT] }, slow ? "typed while the Save was out" : "Save, then typed");
  }
});

test("the first Save after the iPad's: a template's exercises as the page draws them (empty sets added, an empty list where there was none) are no change of this device's, so the iPad's new exercise is kept (a template's exercises merge as one field)", async () => {
  for (const rows of [[ex("t1", "1", "Bench press")], [{ id: "t1", label: "1", name: "Bench press", sets: 3, reps: "8" }], [{ ...ex("t1", "1", "Bench press"), weights: ["", "", "", "", ""] }]]) {
    const sb = makeSupabase(); coach(sb); seed(sb, rows); let got;
    try { await sync(); open(); type("Upper A1"); ipad(sb, moveAndPullUp); await sync(); await save(); got = server(sb); } finally { done(); }
    assert.deepStrictEqual(got, ["Upper A1", ...WANT], JSON.stringify(rows[0]));
  }
  { const sb = makeSupabase(); coach(sb); seed(sb); let got;
    try { await sync(); open(); maps.trainings.get(TP).rows[0].reps = "10"; fns.scheduleSave("trainings", TP); ipad(sb, moveAndPullUp); await sync(); await save(); got = [server(sb), sb.tables.ft_trainings.get(TP).data.rows.map((r) => r.reps)]; } finally { done(); }
    assert.deepStrictEqual(got, [["Upper A", "f2", "Bench press"], ["10"]], "an exercise changed here is a change: ours stands, the whole list (as CLAUDE.md says of a template's exercises)"); }
});

test("the iPad saves twice (Pull-up, then Bench press deleted) around the Mac's sync that passed over its unsaved draft: Discard takes the copy the sync kept, and the next Save measures against it (Bench press stays deleted)", async () => {
  for (const relaunched of [false, true]) {
    const sb = makeSupabase(); coach(sb); seed(sb, [ex("t1", "1", "Bench press"), ex("t3", "2", "Row")]); let log = {};
    try {
      await sync(); open(); type("Upper A1");
      if (relaunched) await relaunch(sb);
      ipad(sb, (d) => d.rows.push(ex("t2", "3", "Pull-up"))); await sync();
      ipad(sb, (d) => { d.rows = d.rows.filter((r) => r.id !== "t1"); d.rows.forEach((r, i) => { r.label = String(i + 1); }); });
      await discard(); log.afterDiscard = here();
      type("Upper A2"); await save(); log.server = server(sb);
    } finally { done(); }
    assert.deepStrictEqual(log, { afterDiscard: ["Upper A", "f1", "Bench press+Row+Pull-up"], server: ["Upper A2", "f1", "Row+Pull-up"] }, relaunched ? "after a relaunch" : "the same page");
  }
});

test("a relaunch with the template's changes unsaved while the iPad saved its move and exercise: Discard, or Save template alone, keeps them; so does a Save tapped before the first sync (the draft taken back measures against the template as saved here: boot's draftBase)", async () => {
  for (const how of ["Discard, then a change and Save", "Save template alone", "Save before the first sync"]) {
    const sb = makeSupabase(); coach(sb); seed(sb); const log = {};
    try {
      await sync(); open(); type("Upper A1");
      await relaunch(sb); log.base = !!maps.seenDoc.get("trainings/" + TP);
      ipad(sb, moveAndPullUp);
      if (how !== "Save before the first sync") { await sync(); log.backup = shape(fns.backupData().trainings[TP]); }
      if (how.startsWith("Discard")) { await discard(); log.afterDiscard = here(); type("Upper A2"); log.backupAfter = shape(fns.backupData().trainings[TP]); }
      await save(); log.server = server(sb);
    } finally { done(); }
    const want = how.startsWith("Discard") ? { base: true, backup: ["Upper A", ...WANT], afterDiscard: ["Upper A", ...WANT], backupAfter: ["Upper A", ...WANT], server: ["Upper A2", ...WANT] } : how === "Save template alone" ? { base: true, backup: ["Upper A", ...WANT], server: ["Upper A1", ...WANT] } : { base: true, server: ["Upper A1", ...WANT] };
    assert.deepStrictEqual(log, want, how + ": after the relaunch the iPad's move and exercise were lost (base false: boot took the draft back with no copy to measure its Save against)");
  }
});

test("Save template with no signal, then typed again before the signal came back: only the template as saved reaches the server, never the changes typed after it; Discard goes back to it and no sync brings them back (the twenty-first check round: the waiting save sent the unsaved draft)", async () => {
  for (const relaunched of [false, true]) {
    const sb = makeSupabase(); coach(sb); seed(sb); const log = {};
    try {
      await sync(); open(); type("Upper A1");
      sb.setFail({ times: 100000, message: "Failed to fetch" }); await save(); log.offline = [app.get().offline, maps.dirty.has("trainings/" + TP), server(sb)];
      type("Upper A1 (not saved)"); log.dirtyDraft = app.get().templateDraft.dirty;
      if (relaunched) await relaunch(sb);
      sb.setFail(null); app.set({ offline: false }); fns.flushOne("trainings", TP); await settle(); log.server = server(sb);
      log.stillUnsaved = [app.get().templateDraft.dirty, here()];
      await discard(); log.afterDiscard = here();
      await sync(); log.afterSync = [here(), server(sb)];
    } finally { done(); }
    assert.deepStrictEqual(log, { offline: [true, true, ["Upper A", "f1", "Bench press"]], dirtyDraft: true, server: ["Upper A1", "f1", "Bench press"], stillUnsaved: [true, ["Upper A1 (not saved)", "f1", "Bench press"]], afterDiscard: ["Upper A1", "f1", "Bench press"], afterSync: [["Upper A1", "f1", "Bench press"], ["Upper A1", "f1", "Bench press"]] }, relaunched ? "after a relaunch" : "the same page");
  }
});

test("a template saved on the Mac's list (a move, tidySave) while its draft is clean meets the iPad's rename: the draft holds the merged copy as saved", async () => {
  const sb = makeSupabase(); coach(sb); seed(sb); let out;
  try {
    await sync(); open(); app.set({ view: { name: "client", id: TEMPLATES_ID, folder: "f1" } });   // looked at Upper A, came back
    ipad(sb, (d) => { d.title = "Upper A (iPad)"; });                                       // the iPad renames it; the Mac has not synced since
    fns.placeTemplate(maps.trainings.get(TP), "f3"); await settle();                        // Move to Mobility on the Mac's list
    open(); type("Upper A (typing)");
    out = { server: server(sb), snap: snap(), backup: shape(fns.backupData().trainings[TP]) };
  } finally { done(); }
  const want = ["Upper A (iPad)", "f3", "Bench press"];
  assert.deepStrictEqual(out, { server: want, snap: want, backup: want });
});

test("a save of a template whose page is drawn asks the page to be drawn again once it lands (a template's exercises merge as one list: after Save template took the iPad's new exercise, the cards drawn before held the old list, the new exercise missing until the next sync and a reps typed into a card lost, measured in Chrome)", async () => {
  const sb = makeSupabase(); coach(sb); seed(sb); let got;
  try {
    await sync(); open(); type("Upper A1"); ipad(sb, moveAndPullUp); await sync();
    app.set({ renderedTraining: TP });                                     // the template's page is the one drawn (this stand-in page draws the Clients list when asked: render() empties it)
    await save(); got = [app.get().renderedTraining, server(sb)];
  } finally { done(); }
  assert.deepStrictEqual(got, [null, ["Upper A1", ...WANT]]);
});

test("Save template with no signal, the iPad moves the template meanwhile, the app relaunched before the signal came back: the name saved here and the iPad's move both stand (the copy the waiting save read is kept at the relaunch: boot runs draftBase after restorePending, never before)", async () => {
  const sb = makeSupabase(); coach(sb); seed(sb); let got;
  try {
    await sync(); open(); type("Upper A1");
    sb.setFail({ times: 100000, message: "Failed to fetch" }); await save();     // saved with no signal: waiting
    type("Upper A1 (not saved)"); await relaunch(sb);
    ipad(sb, (d) => { d.template.folder = "f2"; });                               // the iPad: Move to Rehab
    sb.setFail(null); app.set({ offline: false }); fns.flushOne("trainings", TP); await settle(); got = server(sb);
  } finally { done(); }
  assert.deepStrictEqual(got, ["Upper A1", "f2", "Bench press"], "the name saved on the Mac went back to the iPad's (the waiting save measured against the template as saved, not the copy it read)");
});

// ---------- the twenty-second check round ----------
// (a test with several ways runs them all and asserts once, so a failure names every way that went wrong)

test("a reps typed into a card just after Save template merged the iPad's copy (the cards not drawn again: a finger in a box, or a question up as it lands), or while that merged write is on its way, goes into the template, and the next Save template sends it (the twenty-second check round: it went into an exercise the template no longer held, and 8 was saved)", async () => {
  const got = {}, want = {};
  for (const when of ["just after the merged Save landed", "while the merged write was on its way"]) {
    const sb = makeSupabase(); coach(sb); seed(sb);
    try {
      await sync(); open(); type("Upper A1"); ipad(sb, moveAndPullUp);
      const card = maps.trainings.get(TP).rows[0];                       // the exercise the Bench press card drawn before holds (its boxes write into it: rowEl's r)
      const typeReps = () => { card.reps = "12"; fns.scheduleSave("trainings", TP); };   // "12" typed into its reps box, as the box's input handler does
      if (when.startsWith("while")) { const undo = atRequest(sb, "update", 2, typeReps); await save(); undo(); } else { await save(); typeReps(); }
      got[when] = { template: reps(maps.trainings.get(TP)), unsaved: unsaved() };
      await save(); got[when].server = reps(sb.tables.ft_trainings.get(TP).data);
    } finally { done(); }
    want[when] = { template: ["Bench press 12", "Pull-up 8"], unsaved: true, server: ["Bench press 12", "Pull-up 8"] };
  }
  assert.deepStrictEqual(got, want, "the 12 typed into Bench press's card was lost: the template kept 8, and Save template sent 8");
});

test("Save template meets the iPad's newer copy, merges it, then loses the signal (the write, or only its answer); the coach types on: once the signal is back the merged copy is what is sent, on the same page and after a relaunch, and so is the read-first Save of a relaunched draft kept with no stamp (an older build's): the iPad's move and exercise stay (the twenty-second check round: the waiting save sent the copy from before the merge)", async () => {
  const got = {}, want = {};
  for (const how of ["the write lost, the same page", "the write landed, its answer lost", "the write lost, the app relaunched", "a draft kept with no stamp, relaunched: read first, the write lost"]) {
    const sb = makeSupabase(); coach(sb); seed(sb);
    try {
      const first = how.startsWith("a draft kept");
      await sync(); open(); type("Upper A1");
      if (first) { const dr = JSON.parse(localStorage.getItem("fiala.trainings.draft")); delete dr.at; localStorage.setItem("fiala.trainings.draft", JSON.stringify(dr)); await relaunch(sb); }   // as v315 kept it: no stamp
      ipad(sb, moveAndPullUp);
      const undo = atRequest(sb, "update", first ? 1 : 2, how.includes("answer lost") ? "answer lost" : "lost"); await save(); undo();   // the write after the merge (the first write when it read first)
      type("Upper A1 x");                                                  // typed on: the draft holds more than was saved
      if (how.includes("app relaunched")) await relaunch(sb);
      app.set({ offline: false }); fns.flushOne("trainings", TP); await settle(); got[how] = server(sb);   // the signal back
    } finally { done(); }
    want[how] = ["Upper A1", ...WANT];
  }
  assert.deepStrictEqual(got, want, "the iPad's move to Rehab and its Pull-up were taken away when the waiting save went");
});

test("a name typed while a Save template that merges the iPad's copy was on its way, then the app closed: after the relaunch, Save template (at once or after a sync) keeps the iPad's move and exercise, and Discard goes back to the merged copy (the twenty-second check round: the draft kept on the device was the one from before the merge)", async () => {
  const got = {}, want = {};
  for (const how of ["Save template at once", "a sync, then Save template", "Discard"]) {
    const sb = makeSupabase(); coach(sb); seed(sb);
    try {
      await sync(); open(); type("Upper A1"); ipad(sb, moveAndPullUp);
      const undo = atRequest(sb, "update", 1, () => type("Upper A1 x")); await save(); undo();   // " x" typed as the save goes (before its merge)
      fns.localBackend.save();                                             // the device copy written after the save landed (the browser's database writes 120 ms after a burst)
      await relaunch(sb);
      if (how.startsWith("a sync")) await sync();
      if (how === "Discard") { await discard(); got[how] = here(); } else { await save(); got[how] = server(sb); }
    } finally { done(); }
    want[how] = [how === "Discard" ? "Upper A1" : "Upper A1 x", ...WANT];
  }
  assert.deepStrictEqual(got, want, "the iPad's move to Rehab and its Pull-up were undone after the relaunch");
});

test("a template deleted on the iPad while the Mac held its unsaved draft (the app closed): Save template after the relaunch, before the first sync or with no signal and then online (a sync first, or the waiting save first), never brings it back, nor does the draft a merged Save kept (the twenty-second check round: the draft kept on the device had no server stamp, so its Save wrote the template back)", async () => {
  const got = {}, want = {};
  for (const how of ["Save before the first sync", "Save with no signal, online, a sync first", "Save with no signal, online, the save first", "the draft a merged Save kept, Save before the first sync"]) {
    const sb = makeSupabase(); coach(sb); seed(sb);
    try {
      await sync(); open(); type("Upper A1");
      if (how.startsWith("the draft a merged")) { ipad(sb, moveAndPullUp); const undo = atRequest(sb, "update", 1, () => type("Upper A1 x")); await save(); undo(); }   // the last draft kept is the merge's own
      await relaunch(sb);
      sb.tables.ft_trainings.delete(TP);                                   // the iPad: Delete template
      if (how.includes("no signal")) { sb.setFail({ times: 100000, message: "Failed to fetch" }); await save(); sb.setFail(null); app.set({ offline: false }); if (how.endsWith("a sync first")) await sync(); fns.flushOne("trainings", TP); await settle(); }
      else await save();
      await sync(); got[how] = { server: server(sb), here: here(), unsaved: unsaved() };
    } finally { done(); }
    want[how] = { server: null, here: null, unsaved: false };
  }
  assert.deepStrictEqual(got, want, "the template deleted on the iPad came back");
});

test("two windows of the app on one device (one storage; a second tab or window of a browser): a window that took the other's typed draft at its launch follows it: the other's typing shows there, the other's Save ends it (clean, the saved template after its sync, and its own Save writes nothing older), also heard late by a tab woken from sleep; a window that typed after taking it keeps its own and its Save keeps the other's move; a follow while its finger is in a card keeps the card's exercise (the twenty-second check round: the second window kept the older typing and its Save wrote it over the saved template)", async () => {
  const got = {}, want = {};
  for (const how of ["the first window types on, then saves", "the first window types on and saves, the second hears both as its tab wakes", "typed in the second window, then the first window saves its move", "the first window types on while the second's finger is in a card"]) {
    const sb = makeSupabase(); coach(sb); seed(sb); const log = {};
    try {
      await sync(); open(); type("Upper A 1");                               // window A
      await relaunch(sb);                                                    // window B opens on the same storage: its boot takes A's typed draft
      const a = JSON.parse(localStorage.getItem("fiala.trainings.draft"));  // window A's draft, as A goes on with it
      const keep = (v) => { const s = v == null ? "null" : JSON.stringify(v); localStorage.setItem("fiala.trainings.draft", s); return s; };   // what A writes to the shared storage
      const hear = (s) => fns.onStorage({ key: "fiala.trainings.draft", newValue: s });   // window B's storage event for it
      const aTypes = (title) => { a.doc.title = title; return keep(a); };
      const aSaves = (f) => { ipad(sb, (d) => { Object.assign(d, clone(a.doc)); if (f) f(d); }); return keep(null); };   // A's Save template: its copy on the server, its draft cleared
      const followed = async () => { clearTimeout(app.get().syncTimer); await sync(); };   // the sync B asks for as it follows (run here, not on its 300 ms timer)
      if (how === "the first window types on, then saves") {
        hear(aTypes("Upper A 1 2")); log.follows = [here(), unsaved()];
        hear(aSaves()); await followed(); log.after = [here(), unsaved()];
      } else if (how.endsWith("as its tab wakes")) {
        const typed = aTypes("Upper A 1 2"), cleared = aSaves(); hear(typed); hear(cleared); await followed(); log.after = [here(), unsaved()];
      } else if (how.startsWith("typed in the second")) {
        type("Upper A 1 (B)");                                               // typed in window B: its own from now on
        hear(aSaves((d) => { d.template.folder = "f2"; })); log.after = [here(), unsaved()];
      } else {
        const card = maps.trainings.get(TP).rows[0];                         // the card B's finger is in (the cards are not drawn again under it)
        hear(aTypes("Upper A 1 2"));
        card.reps = "12"; fns.scheduleSave("trainings", TP);                // "12" typed in B's card
        log.after = [here(), unsaved()];
      }
      if (unsaved()) await save();                                           // B's Save template (offered only while B has unsaved changes)
      log.server = how.endsWith("in a card") ? [...server(sb).slice(0, 2), ...reps(sb.tables.ft_trainings.get(TP).data)] : server(sb);
    } finally { done(); }
    got[how] = log;
    want[how] = how === "the first window types on, then saves" ? { follows: [["Upper A 1 2", "f1", "Bench press"], true], after: [["Upper A 1 2", "f1", "Bench press"], false], server: ["Upper A 1 2", "f1", "Bench press"] }
      : how.endsWith("as its tab wakes") ? { after: [["Upper A 1 2", "f1", "Bench press"], false], server: ["Upper A 1 2", "f1", "Bench press"] }
      : how.startsWith("typed in the second") ? { after: [["Upper A 1 (B)", "f1", "Bench press"], true], server: ["Upper A 1 (B)", "f2", "Bench press"] }
      : { after: [["Upper A 1 2", "f1", "Bench press"], true], server: ["Upper A 1 2", "f1", "Bench press 12"] };
  }
  assert.deepStrictEqual(got, want, "the second window kept older typing (or dropped its own): what its Save template wrote was not the template as the coach left it");
});

test("a template deleted on the iPad takes its unsaved draft with it, the open one and the one kept on the device, whether a sync or a waiting Save template finds it gone: a later restore of the template (from a backup here, or on the iPad) brings no old typing back as unsaved changes, and this page takes the restored template in (the twenty-second check round: days-old typing came back at the next launch)", async () => {
  const got = {}, want = {};
  for (const how of ["a sync finds it gone, restored here", "a sync finds it gone, restored on the iPad", "a sync finds it gone, restored on the iPad, the page still open", "a waiting Save template finds it gone, restored here"]) {
    const sb = makeSupabase(); coach(sb); seed(sb); const log = {};
    const stays = how.endsWith("the page still open");
    try {
      await sync(); const backup = clone(fns.backupData()), saved = clone(sb.tables.ft_trainings.get(TP));
      open(); type("Upper A1 (typed days ago)");
      if (how.startsWith("a waiting")) {
        sb.setFail({ times: 100000, message: "Failed to fetch" }); await save(); type("Upper A1 (typed after it)");
        sb.tables.ft_trainings.delete(TP); sb.setFail(null); app.set({ offline: false }); fns.flushOne("trainings", TP); await settle();   // the iPad deleted it before the signal came back
      } else { sb.tables.ft_trainings.delete(TP); await sync(); }
      log.gone = { here: here(), kept: stored(), open: !!app.get().templateDraft };
      if (!stays) await relaunch(sb);
      if (how.endsWith("restored here")) { fns.applyRestore(fns.planRestore(clone(backup))); await settle(); }
      else { sb.tables.ft_trainings.set(TP, { ...clone(saved), updated_at: "2026-11-25T09:00:00.000Z" }); await sync(); }   // the iPad: Restore of a backup
      log.restored = [here(), unsaved()];
      if (!stays) { fns.localBackend.save(); await relaunch(sb); log.next = [here(), unsaved()]; }
    } finally { done(); }
    got[how] = log;
    want[how] = { gone: { here: null, kept: null, open: false }, restored: [["Upper A", "f1", "Bench press"], false], ...(stays ? {} : { next: [["Upper A", "f1", "Bench press"], false] }) };
  }
  assert.deepStrictEqual(got, want, "the deleted template's unsaved draft outlived it: its old typing came back as unsaved changes, or the restored template was passed over");
});

// ---------- found while the twenty-second check round's tests were written: the unsaved draft kept on the device is the page's that typed it last ----------
// (one process is one page here: another window of the browser is what it leaves in the shared storage, as in the two-window test above.
// Where another window's own typing is played on this page, its draft names this page: asPage gives it that window's name instead, and a
// draft that names no page stays so)
const DRAFT = "fiala.trainings.draft", TQ = "6c8e0a2b-4d6f-4a8c-9e0b-2c4e6a8c0e2a";
const seedLower = (sb) => sb.seed("ft_trainings", TQ, { id: TQ, clientId: TEMPLATES_ID, title: "Lower B", date: "2026-01-01", createdAt: AT, completedAt: null, skippedAt: null, template: clone(PLACE), rows: [ex("q1", "1", "Squat")] });
const keptFor = (id) => { const d = JSON.parse(localStorage.getItem(DRAFT) || "null"); return d && d.id === id ? shape(d.doc) : null; };   // the unsaved draft the device keeps for that template (null: none)
const draftHere = () => { const d = app.get().templateDraft; return d ? [shape(maps.trainings.get(d.id)), d.dirty] : null; };   // the draft this page holds: its template as the page shows it, and whether it has unsaved changes (null: none)
const hearB = () => fns.onStorage({ key: DRAFT, newValue: localStorage.getItem(DRAFT) });   // this page's storage event for what window B wrote
const typedInB = (id, title, thisRelease = true) => { const doc = { ...clone(maps.trainings.get(id)), title }; localStorage.setItem(DRAFT, JSON.stringify(thisRelease ? { id, doc, at: maps.seenAt.get("trainings/" + id) || null, tab: "window B" } : { id, doc })); hearB(); };   // window B (opened after this page's launch) types in that template: the draft kept on the device is B's, as B's page keeps it, under B's own name (a page still on the release before keeps no stamp and no name); this page hears it
const asPage = (name) => { const d = JSON.parse(localStorage.getItem(DRAFT) || "null"); if (d && d.tab && d.tab === localStorage.getItem("fiala.pending.tab")) d.tab = name; return d; };   // the draft kept on the device as the page that typed it keeps it, under that page's own name (played on this page, it carries this page's own: its queue's)
const yesArmed = () => {                                               // the question's red button, tapped once it is live (it waits 350 ms, so the second tap of a double tap never lands on it)
  const b = el("button"), on = []; b.addEventListener = (t, fn) => { if (t === "click") on.push(fn); }; b.removeEventListener = (t, fn) => { const i = on.indexOf(fn); if (i >= 0) on.splice(i, 1); }; byId.set("askYes", b);
  return async () => { const until = Date.now() + 5000; while (b.disabled && Date.now() < until) await tick(10); for (const fn of [...on]) fn({ target: b }); byId.delete("askYes"); };
};

test("two windows, one template: window B took A's typed draft at its launch and typed in it; A's Save template, or its Discard, leaves B's typing on the device (also when B typed on while its own Save template merged the iPad's copy), and B's window, closed before its own Save, opens again with it unsaved (the twenty-second check round: A's Save cleared the draft kept on the device, and B's typing was lost)", async () => {
  const got = {}, want = {};
  for (const how of ["A's Save template", "A's Discard", "B typed on while its own Save template merged the iPad's copy, then A's Save template"]) {
    const sb = makeSupabase(); coach(sb); seed(sb); const merged = how.startsWith("B typed on");
    try {
      await sync(); open(); type("Upper A 1");                               // window A types
      await relaunch(sb); type("Upper A 1 (B)");                             // window B opens on the same storage, its boot takes A's typed draft, and B types in it: B's own from now on
      if (merged) { ipad(sb, moveAndPullUp); const undo = atRequest(sb, "update", 1, () => type("Upper A 1 (B) 2")); await save(); undo(); }   // B's Save template meets the iPad's newer copy and merges it, " 2" typed as it goes: B keeps the merged copy with its typing
      const b = asPage("window B");                                          // B's draft as B's page keeps it
      done(); coach(sb); await sync(); open(); type("Upper A 1");            // window A as it was: its own typing, not saved (its copy of the template as the server has it now)
      localStorage.setItem(DRAFT, JSON.stringify(b)); hearB();               // B's typing reached the storage after A's, and A hears it (a draft A typed in stays A's)
      if (how === "A's Discard") await discard(); else await save();
      got[how] = { server: server(sb), kept: keptFor(TP) };
      fns.localBackend.save(); await relaunch(sb); got[how].b = draftHere(); // B's window, closed before its own Save (iOS), opens again
    } finally { done(); }
    const typed = merged ? ["Upper A 1 (B) 2", ...WANT] : ["Upper A 1 (B)", "f1", "Bench press"];
    want[how] = { server: how === "A's Discard" ? ["Upper A", "f1", "Bench press"] : ["Upper A 1", ...(merged ? WANT : ["f1", "Bench press"])], kept: typed, b: [typed, true] };
  }
  assert.deepStrictEqual(got, want, "B's typing was cleared off the device by A's Save or Discard, so B's window opened again without it");
});

test("two windows, two templates: A's Save template or Discard of Upper A never clears B's typing of Lower B kept on the device (B on this release, or a page still on the release before, whose draft names no page), and B's window opens again with it unsaved (the twenty-second check round: A's Save cleared it)", async () => {
  const got = {}, want = {};
  for (const a of ["Save template", "Discard"]) for (const b of ["on this release", "still on the release before"]) {
    const how = "A's " + a + ", B " + b, sb = makeSupabase(); coach(sb); seed(sb); seedLower(sb);
    try {
      await sync(); open(); type("Upper A (A)");                             // window A types in Upper A
      typedInB(TQ, "Lower B (B)", b === "on this release");                  // window B, opened after A's launch, types in Lower B
      if (a === "Discard") await discard(); else await save();
      got[how] = { server: server(sb), kept: keptFor(TQ) };
      fns.localBackend.save(); await relaunch(sb); got[how].b = draftHere(); // B's window, closed before its own Save, opens again
    } finally { done(); }
    want[how] = { server: [a === "Discard" ? "Upper A" : "Upper A (A)", "f1", "Bench press"], kept: ["Lower B (B)", "f1", "Squat"], b: [["Lower B (B)", "f1", "Squat"], true] };
  }
  assert.deepStrictEqual(got, want, "A's Save or Discard of Upper A took B's typing of Lower B off the device, so B's window opened again without it");
});

test("one window: a draft only taken back at a launch, then Save template or Discard (at once, or after a sync), is gone at the next launch, and so is one typed in after it was taken back, then saved (the draft kept on the device names the page that typed it, here the page before the relaunch: a Save or Discard keeps another window's typing, never a draft this page only took back)", async () => {
  const got = {}, want = {};
  for (const how of ["Save template", "Discard", "a sync, then Save template", "a sync, then Discard", "typed in here, then Save template"]) {
    const sb = makeSupabase(); coach(sb); seed(sb);
    try {
      await sync(); open(); type("Upper A1");
      localStorage.setItem(DRAFT, JSON.stringify(asPage("the page before the relaunch")));   // closed with the change unsaved: the draft kept on the device names the page that typed it
      await relaunch(sb);                                                    // opened again: a new page, which takes the draft back
      if (how.startsWith("a sync")) await sync();
      if (how.startsWith("typed in")) type("Upper A1 2");
      if (how.endsWith("Discard")) await discard(); else await save();
      got[how] = { server: server(sb), kept: keptFor(TP) };
      fns.localBackend.save(); await relaunch(sb); got[how].next = [here(), draftHere()];
    } finally { done(); }
    const left = [how.endsWith("Discard") ? "Upper A" : how.startsWith("typed in") ? "Upper A1 2" : "Upper A1", "f1", "Bench press"];
    want[how] = { server: left, kept: null, next: [left, null] };
  }
  assert.deepStrictEqual(got, want, "the draft saved or discarded here was still kept on the device, and came back at the next launch as unsaved changes");
});

test("a restore of Upper A here, or its Delete here (on its row, or on its page), takes Upper A's unsaved draft kept on the device with it whichever window typed it, and never another template's; so does Upper A's deletion on the iPad (the twenty-second check round: only a draft this page held went, and then any template's: B's old typing came back over the restored template at the next launch, or B's typing of Lower B was lost)", async () => {
  const got = {}, want = {};
  for (const act of ["restored here", "Delete on its row", "Delete on its page", "deleted on the iPad"]) for (const typed of ["Upper A", "Lower B"]) {
    const how = act + ", B typed in " + typed, sb = makeSupabase(); coach(sb); seed(sb); const id = typed === "Upper A" ? TP : TQ;
    try {
      await sync(); const backup = clone(fns.backupData());                   // a backup with Upper A
      seedLower(sb); ipad(sb, (d) => { d.title = "Upper A (iPad)"; }); await sync();   // since then: Lower B made, and Upper A renamed on the iPad (a restore brings back only what differs from the file)
      const looked = act === "Delete on its page" || (act === "restored here" && typed === "Lower B");
      if (looked) open();                                                    // Upper A looked at here: its draft held, clean
      app.set({ view: act === "Delete on its page" ? { name: "training", id: TP } : { name: "client", id: TEMPLATES_ID, folder: "f1" } });
      typedInB(id, typed + " (B)");                                          // window B types in it
      if (act === "restored here") { fns.applyRestore(fns.planRestore(clone(backup))); await settle(); }
      else if (act === "deleted on the iPad") { sb.tables.ft_trainings.delete(TP); await sync(); }
      else { const yes = yesArmed(), p = act === "Delete on its row" ? fns.deleteTemplateRow(TP) : fns.askDelete(TP); await yes(); got[how] = { deleted: await p }; await settle(); }   // its row's Delete, or its page's "…" → Delete: asked first, then Delete
      got[how] = { ...got[how], kept: keptFor(id) };
      fns.localBackend.save(); await relaunch(sb); got[how].next = [here(), draftHere()];
    } finally { done(); }
    const upper = act === "restored here" ? ["Upper A", "f1", "Bench press"] : null, lower = ["Lower B (B)", "f1", "Squat"];
    want[how] = { ...(act.startsWith("Delete") ? { deleted: true } : {}), ...(typed === "Upper A" ? { kept: null, next: [upper, null] } : { kept: lower, next: [upper, [lower, true]] }) };
  }
  assert.deepStrictEqual(got, want, "a restore or a Delete of Upper A left B's old typing of it on the device (back over the restored template at the next launch), or took B's typing of Lower B");
});

const built = (id, label, name) => ({ id, label, name, sets: 3, reps: "10", tempo: "", rest: "", weights: [], note: "", done: false, alts: [] });   // an exercise as seedTemplatesNow writes a built-in program's (no repsDone)
const NUMBERS = [   // saved numbers, the numbers the page shows (its tidying), and the iPad's new exercise's
  { saved: ["1a", "1b", "2a"], shown: ["1a", "1b", "2"], add: "3", why: "a lone 2a (Hypertrophy, as saved)" },
  { saved: ["1a", "2a", "2b", "2c", "2d", "3a", "3b"], shown: ["1", "2a", "2b", "2c", "2d", "3a", "3b"], add: "4", why: "a lone 1a (Hypertrophy's other)" },
  { saved: ["1", "1a", "2"], shown: ["1b", "1a", "2"], add: "3", why: "a superset exercise with no letter (shown last in its superset: the cards' order is not the saved one)" },
];
const NAMES = ["Bench press", "Row", "Curl", "Shrug", "Push press", "Face pull", "Lateral raise"];
const seedNumbers = (sb, saved) => seed(sb, saved.map((l, i) => built("e" + i, l, NAMES[i])), { program: "Hypertrophy", phase: 3, stage: 4, n: 1, folder: "f1" });
const ipadAddsTo = (sb, shown, add) => ipad(sb, (d) => { d.rows.forEach((r, i) => { r.label = shown[i]; r.weights = ["", "", ""]; r.repsDone = []; }); d.rows.sort((a, b) => cmpLabel(a.label, b.label)); d.rows.push({ ...built("p9", add, "Pull-up"), weights: ["", "", ""], repsDone: [] }); });   // the iPad's page tidied the numbers and drew the boxes too; then Add exercise, Save template
const rowsOn = (sb) => sb.tables.ft_trainings.get(TP).data.rows.map((r) => r.label + " " + r.name);

test("a template saved with numbers the page tidies (a lone 2a shown as 2, as two built-in programs are saved; a superset exercise with no letter): the Mac's first Save after the iPad's Add exercise keeps the iPad's exercise, from the template's page with a name typed and from the list's Move to (the twenty-second check round: the tidied numbers counted as the Mac's own change to the exercises, and the iPad's exercise was taken away)", async () => {
  const got = {}, want = {};
  for (const c of NUMBERS) for (const how of ["its page, a name typed", "the list's Move to, before any sync"]) {
    const sb = makeSupabase(); coach(sb); seedNumbers(sb, c.saved); const k = c.why + ", " + how;
    try {
      await sync(); open();                                                  // the Mac opens it: the page tidies the numbers (not saved: "the tidying the build does is not an edit")
      if (how.startsWith("its page")) { type("Upper A (Mac)"); ipadAddsTo(sb, c.shown, c.add); await sync(); await save(); }
      else { app.set({ view: { name: "client", id: TEMPLATES_ID, folder: "f1" } }); ipadAddsTo(sb, c.shown, c.add); fns.placeTemplate(maps.trainings.get(TP), "f2"); await settle(); }
      got[k] = rowsOn(sb).includes(c.add + " Pull-up");
    } finally { done(); }
    want[k] = true;
  }
  assert.deepStrictEqual(got, want, "the iPad's Pull-up was taken away by the Mac's save (false: lost)");
});

test("real changes of the numbers on the Mac still count as its own (ours stands, for the whole list, as CLAUDE.md says of a template's exercises): an exercise put into the superset, its letters swapped, a number in words, made a warm-up, taken out of the superset; from saved numbers that are tidy and from ones the page tidies", async () => {
  const edits = {
    "Curl into the superset (2 to 1c)": (rows) => { rows.find((r) => r.name === "Curl").label = "1c"; },
    "the superset's letters swapped": (rows) => { rows.find((r) => r.name === "Bench press").label = "1b"; rows.find((r) => r.name === "Row").label = "1a"; },
    "a number in words": (rows) => { rows.find((r) => r.name === "Curl").label = "Finisher"; },
    "Curl made a warm-up": (rows) => { rows.find((r) => r.name === "Curl").label = "W"; },
    "Row taken out of the superset": (rows) => { rows.find((r) => r.name === "Row").label = "3"; rows.find((r) => r.name === "Bench press").label = "1"; },
  };
  const got = {}, want = {};
  for (const saved of [["1a", "1b", "2"], ["1a", "1b", "2a"]]) for (const [e, f] of Object.entries(edits)) {
    const sb = makeSupabase(); coach(sb); seedNumbers(sb, saved); const k = saved.join(" ") + ", " + e;
    try {
      await sync(); open(); f(maps.trainings.get(TP).rows); fns.scheduleSave("trainings", TP); want[k] = maps.trainings.get(TP).rows.map((r) => r.label + " " + r.name);
      ipadAddsTo(sb, ["1a", "1b", "2"], "3"); await sync(); await save(); got[k] = rowsOn(sb);
    } finally { done(); }
  }
  assert.deepStrictEqual(got, want, "the Mac's own change of the numbers was not what was saved");
});

test("an alternative under an old exercise name, renamed by the page into the unsaved draft (a draft kept from before a release renamed the exercise): no change of the Mac's, so Save template keeps the iPad's new exercise", async () => {
  const old = "Band face-pull";
  assert.ok(ALIASES[old] && ALIASES[old] !== old, "the catalog still renames " + old);
  const sb = makeSupabase(); coach(sb); seed(sb, [{ ...ex("t1", "1", "Face pull"), alts: [old] }, ex("t3", "2", "Row")]); let got;
  try {
    await sync(); open(); type("Upper A1");
    await relaunch(sb);                                                      // the app opened again on the new release, the draft taken back
    { const r = maps.trainings.get(TP).rows[0]; r.alts = r.alts.map((a) => ALIASES[a] || a); fns.scheduleSave("trainings", TP); }   // its page drawn: rowEl renames the alternative and saves through tidySave, which on an unsaved draft is the draft's
    ipad(sb, (d) => d.rows.push(ex("t2", "3", "Pull-up"))); await sync(); await save(); got = server(sb);
  } finally { done(); }
  assert.deepStrictEqual(got, ["Upper A1", "f1", "Face pull+Row+Pull-up"], "the iPad's Pull-up was taken away: the renamed alternative counted as the Mac's own change");
});

test("a template still holding an old exercise name (the page shows its new one): the first Save after the iPad's keeps the iPad's move and new exercise (an old name's new one is no change of the Mac's: normRow in bareRows)", async () => {
  const sb = makeSupabase(); coach(sb); seed(sb, [ex("t1", "1", "Band face-pull")]); let got;
  try {
    await sync(); open(); type("Upper A1");
    ipad(sb, (d) => { d.template.folder = "f2"; d.rows.push(ex("t2", "2", "Pull-up")); }); await sync();   // the iPad: Move to Rehab, Add exercise Pull-up
    await save(); got = server(sb);
  } finally { done(); }
  assert.deepStrictEqual(got, ["Upper A1", "f2", "Band face-pull+Pull-up"], "the iPad's move and Pull-up were taken away: the page's new name for the exercise counted as the Mac's own change");   // (the server's rows: the old name as saved there)
});

test("what the Mac wrote itself comes back from the server with its keys in Postgres's order (shortest first, the stand-in's too) and stays the Mac's own object: no change of the Mac's, so the iPad's Move to (the template's place) and its new exercise (the exercises) are kept at the Mac's next Save (the twenty-second check round: the template went back to the Mac's folder)", async () => {
  const got = {}, want = {};
  for (const what of ["the template's place", "the exercises"]) {
    const sb = makeSupabase(); coach(sb); seed(sb, [ex("t1", "1", "Bench press")], { program: "My templates", phase: 0, stage: 0, n: 1 });
    try {
      await sync();
      if (what === "the template's place") { fns.placeTemplate(maps.trainings.get(TP), "f1"); await settle(); }   // Move to Strength on the Mac's list: its copy writes the folder last
      else { open(); maps.trainings.get(TP).rows.push(ex("t3", "2", "Row")); fns.scheduleSave("trainings", TP); await save(); }   // Add exercise Row on the Mac, Save template: its copy writes the exercise in its own key order
      await sync();                                                          // nothing new: the server's copy says the same, so the Mac keeps its own object (the copy it measures against is the server's)
      open(); type("Upper A1");
      ipad(sb, (d) => { if (what === "the template's place") d.template.folder = "f2"; else d.rows.push(ex("t2", "3", "Pull-up")); }); await sync();
      await save(); got[what] = server(sb);
    } finally { done(); }
    want[what] = what === "the template's place" ? ["Upper A1", "f2", "Bench press"] : ["Upper A1", undefined, "Bench press+Row+Pull-up"];
  }
  assert.deepStrictEqual(got, want, "the iPad's change was undone by the Mac's Save");
});

test("a sync or a save of another workout (a client's) leaves a template's clean draft as it was: Back up and Discard keep the template, never that workout (the twenty-first check round's follow is for the draft's own template only; the twenty-third: also a save that meets her newer copy and merges it, round 22's draftFollows)", async () => {
  const W = "5e7a2b3c-6d4e-4f5a-9b8c-0d1e2f3a4b5c", C = "3d6f1a2b-4c5d-4e6f-8a7b-9c0d1e2f3a4b", got = {}, want = {};
  for (const how of ["a sync brings Jane's workout changed elsewhere", "a save of Jane's workout lands", "a save of Jane's workout meets her newer copy and merges it"]) {
    const sb = makeSupabase(); coach(sb); seed(sb); sb.seed("ft_clients", C, { id: C, name: "Jane Testperson", unit: "lb" }); sb.seed("ft_trainings", W, { id: W, clientId: C, title: "Legs", date: fns.localIso(new Date(Date.now() + 2 * 864e5)), createdAt: AT, completedAt: null, skippedAt: null, rows: [ex("w1", "1", "Back squat")] }, { client_id: C });
    try {
      await sync(); open(); app.set({ view: { name: "client", id: how.startsWith("a sync") ? TEMPLATES_ID : C } });   // looked at Upper A, then Back (nothing typed: the draft stays, clean)
      if (how.startsWith("a sync")) { const s = sb.tables.ft_trainings.get(W); s.data.title = "Legs (moved)"; bump(s); await sync(); }
      else { if (how.endsWith("merges it")) { const s = sb.tables.ft_trainings.get(W); s.data.rows[0].weights = ["135"]; s.data.rows[0].repsDone = ["8"]; bump(s); } maps.trainings.get(W).title = "Legs B"; fns.scheduleSave("trainings", W, 0); await settle(); }   // (merges it: her phone logged Set 1 first, so the Mac's save meets her newer copy)
      open(); type("Upper A1");
      got[how] = { backup: shape(fns.backupData().trainings[TP]) }; await discard(); got[how].afterDiscard = here();
    } finally { done(); }
    want[how] = { backup: ["Upper A", "f1", "Bench press"], afterDiscard: ["Upper A", "f1", "Bench press"] };
  }
  assert.deepStrictEqual(got, want, "the template turned into Jane's workout");
});

test("the page puts an exercise whose number was just typed where its letter asks (1a to the top of its superset, 1c to its third place), on a template's page in the coach's look, and keeps it in the draft (template-draft-labels-probe.mjs: the page's own tidying, model.js tidyLabels, with the exercise just typed)", () => {
  const dir = path.dirname(fileURLToPath(import.meta.url));
  const r = JSON.parse(execFileSync(process.execPath, [path.join(dir, "template-draft-labels-probe.mjs")], { encoding: "utf8", timeout: 90000 }).trim().split("\n").pop());
  assert.deepStrictEqual(r, {
    top: { rows: ["1a Row", "1b Bench press", "2 Curl"], unsaved: true, sent: false },
    third: { rows: ["1a Row", "1b Face pull", "1c Bench press", "2 Curl"], unsaved: true, sent: false },
    rejected: [],
  }, "the typed letter did not move the exercise (the page tidied it back to where it was), or the change did not wait in the template's draft");
});

// ---------- the twenty-third check round ----------
// Round 22's own rules that no test held (each could be undone with every test passing): what a merging save does to the draft (its own
// template only, a typed draft only, the copy sent, the stamp first), a window that only took the other's draft (back to the template as
// saved on the other's Discard, the same template only, the held move forgotten, a sync asked for), a template's exercises as another
// copy has them (old keys gone), the card state read before the merge, the redraw when a Save finds the template gone, and the held move
// dropped with it. And round 23's: a second window that only looked at a template, or only took its draft, takes the first window's
// waiting Save template or Delete; the draft kept on the device keeps the name of the window that typed it when another window's send
// merges; a template deleted on the iPad while its page is up here: the page goes to the template's folder and a question over it closes;
// a queue entry not for the record its key names is passed over; and a superset's order typed while a merging Save is out stays
// (template-draft-order-probe.mjs).
const KT = "trainings/" + TP, JANE = "8a2c4e6f-1b3d-4f5a-8c7e-9d1f3b5a7c9e", LEGS = "2f4a6c8e-3b5d-4e7f-9a1c-5e7a9c1e3b5d";
const FOLDER = { name: "client", id: TEMPLATES_ID, folder: "f1" };   // Upper A's folder (Strength), where its page's Back goes
const inDays = (k) => { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + k); return fns.localIso(d); };   // a local day (never UTC: after 4 pm in Los Angeles, UTC is already tomorrow)
const seedJane = (sb) => { sb.seed("ft_clients", JANE, { id: JANE, name: "Jane Testperson", unit: "lb" }); sb.seed("ft_trainings", LEGS, { id: LEGS, clientId: JANE, title: "Legs", date: inDays(2), createdAt: AT, completedAt: null, skippedAt: null, rows: [ex("w1", "1", "Back squat")] }, { client_id: JANE }); };
const janeLogs = (sb) => { const s = sb.tables.ft_trainings.get(LEGS); s.data.rows[0].weights = ["135"]; s.data.rows[0].repsDone = ["8"]; bump(s); };   // her phone logs Set 1 (the server's copy moves on)
const renameLegs = async (title = "Legs B") => { maps.trainings.get(LEGS).title = title; fns.scheduleSave("trainings", LEGS, 0); await settle(); };   // the Mac renames her workout (on her page, or its Up next row)
const noSignal = (sb) => sb.setFail({ times: 100000, message: "Failed to fetch" });
const queued = () => { const q = JSON.parse(localStorage.getItem("fiala.pending.v1") || "null"); if (!q) return null; const rec = ((q.recs || []).find((e) => e[0] === KT) || [null, null])[1]; return { dirty: (q.dirty || []).includes(KT), gone: (q.gone || []).includes(KT), title: rec ? rec.title : null }; };   // what the queue kept on the device holds for Upper A
const writeAs = (k, value) => { localStorage.setItem(k, value); if (k === "fiala.pending.v1") localStorage.setItem("fiala.pending.tab", "window A"); fns.onStorage({ key: k, newValue: value }); };   // another window writes to the shared storage (its queue, or its draft), and this page hears it
const viewNow = () => { const v = app.get().view; return { name: v.name, id: v.id, folder: v.folder }; };
const asA = () => { localStorage.setItem(DRAFT, JSON.stringify(asPage("window A"))); const q = JSON.parse(localStorage.getItem("fiala.pending.v1") || "null"); if (q) { q.tab = "window A"; localStorage.setItem("fiala.pending.v1", JSON.stringify(q)); } };   // what this page left on the device, as window A's page names it
const keptBy = () => { const d = JSON.parse(localStorage.getItem(DRAFT) || "null"); return d ? (d.tab === localStorage.getItem("fiala.pending.tab") ? "this page" : d.tab) : null; };   // the window the draft kept on the device names
const saveLower = async (sb) => {                                       // later: Lower B's page opened, a name typed, Save template
  app.set({ view: { name: "training", id: TQ }, renderedTraining: null }); fns.draftFor(maps.trainings.get(TQ));
  maps.trainings.get(TQ).title = "Lower B1"; fns.scheduleSave("trainings", TQ); fns.saveDraft(); await settle();
  return [viewNow(), shape(sb.tables.ft_trainings.get(TQ).data)];
};
const STAYS = [{ name: "training", id: TQ, folder: undefined }, ["Lower B1", "f1", "Squat"]];   // the page stays on Lower B, and its Save lands

test("a typed template draft taken back at a launch, the app then on Jane's page: the Mac's rename of her workout meets her newer copy (her phone logged a set) and merges it; Upper A's draft, the draft kept on the device and Discard all stay Upper A's (round 22's draftFollows is for the draft's own template only)", async () => {
  const sb = makeSupabase(); coach(sb); seed(sb); seedJane(sb); const log = {};
  try {
    await sync(); open(); type("Upper A1"); await relaunch(sb); await sync();   // closed with the change unsaved, opened again: the draft taken back
    app.set({ view: { name: "client", id: JANE } }); janeLogs(sb); await renameLegs();
    log.draft = { snap: snap(), kept: keptFor(TP), keptHers: keptFor(LEGS), unsaved: unsaved() };
    open(); await discard(); log.afterDiscard = here(); log.legs = shape(sb.tables.ft_trainings.get(LEGS).data);
  } finally { done(); }
  assert.deepStrictEqual(log, { draft: { snap: ["Upper A", "f1", "Bench press"], kept: ["Upper A1", "f1", "Bench press"], keptHers: null, unsaved: true }, afterDiscard: ["Upper A", "f1", "Bench press"], legs: ["Legs B", null, "Back squat"] }, "the template's draft took Jane's workout: Discard would write her workout into Upper A, or the draft kept on the device became hers");
});

test("Save template meets the iPad's newer copy and merges it, nothing typed while it is out: no unsaved draft is kept on the device, and the next launch shows no unsaved changes (round 22's draftFollows keeps a typed draft only)", async () => {
  const sb = makeSupabase(); coach(sb); seed(sb); const log = {};
  try {
    await sync(); open(); type("Upper A1"); ipad(sb, moveAndPullUp); await save();
    log.saved = { kept: stored(), server: server(sb) };
    fns.localBackend.save(); await relaunch(sb); log.next = [here(), unsaved()];
    await sync(); log.afterSync = unsaved();
  } finally { done(); }
  assert.deepStrictEqual(log, { saved: { kept: null, server: ["Upper A1", ...WANT] }, next: [["Upper A1", ...WANT], false], afterSync: false }, "a template saved with the iPad's changes merged in came back as unsaved changes at the next launch");
});

test("a name typed while a merging Save template reads the iPad's copy, then its write lost: Discard goes back to the merged copy, and the send once the signal is back carries the merged copy only, never the name typed (round 22's draftFollows: the draft follows the copy sent, not the page's)", async () => {
  const sb = makeSupabase(); coach(sb); seed(sb); const log = {};
  try {
    await sync(); open(); type("Upper A1"); ipad(sb, moveAndPullUp);
    const r = atRequest(sb, "read", 1, () => type("Upper A1 typed")), u = atRequest(sb, "update", 2, "lost");   // " typed" as the save reads the iPad's copy; then its merged write never lands
    await save(); u(); r(); log.mid = [unsaved(), snap()];
    await discard(); log.afterDiscard = here();
    app.set({ offline: false }); fns.flushOne("trainings", TP); await settle(); log.server = server(sb);   // the signal back
  } finally { done(); }
  assert.deepStrictEqual(log, { mid: [true, ["Upper A1", ...WANT]], afterDiscard: ["Upper A1", ...WANT], server: ["Upper A1", ...WANT] }, "the name typed while the merging Save was out stayed after Discard, or was sent though never saved");
});

test("a draft kept by an older build (no stamp) taken back at a launch; Save template reads first (the iPad had moved it), a name typed while that read is out, the app closed; the iPad then deletes the template: Save template after the next launch never writes it back (round 22: the draft kept on the device carries the stamp that read brought)", async () => {
  const sb = makeSupabase(); coach(sb); seed(sb); const log = {};
  try {
    await sync(); open(); type("Upper A1");
    { const d = JSON.parse(localStorage.getItem(DRAFT)); delete d.at; delete d.tab; localStorage.setItem(DRAFT, JSON.stringify(d)); }   // as v315 kept it: no stamp, no page
    await relaunch(sb); ipad(sb, moveAndPullUp);
    const r = atRequest(sb, "read", 1, () => type("Upper A1 y")); await save(); r();   // the read before the write, " y" typed while it is out
    log.stamped = !!(JSON.parse(localStorage.getItem(DRAFT) || "null") || {}).at;
    fns.localBackend.save(); await relaunch(sb);                             // closed with " y" unsaved, opened again
    sb.tables.ft_trainings.delete(TP);                                       // the iPad: Delete template
    await save(); await sync(); log.end = { server: server(sb), here: here(), unsaved: unsaved() };
  } finally { done(); }
  assert.deepStrictEqual(log, { stamped: true, end: { server: null, here: null, unsaved: false } }, "the template deleted on the iPad came back with the Save after the relaunch (the draft kept on the device had no stamp)");
});

test("two windows: window B took A's typed draft at its launch and follows A's typing; A's Discard, with no signal, puts Upper A back as saved on B at once (no sync can put it right), and B's later Save template sends none of the discarded typing (round 22's onStorage: back to the template as saved)", async () => {
  const sb = makeSupabase(); coach(sb); seed(sb); const log = {};
  try {
    await sync(); open(); type("Upper A 1"); asA(); await relaunch(sb);    // window A typed; window B opens on the same storage and takes A's draft
    const a = JSON.parse(localStorage.getItem(DRAFT)); a.doc.title = "Upper A 1 2"; writeAs(DRAFT, JSON.stringify(a)); clearTimeout(app.get().syncTimer);   // A types on: B follows
    log.follows = [here(), unsaved()];
    noSignal(sb); app.set({ offline: true });
    writeAs(DRAFT, "null"); clearTimeout(app.get().syncTimer);             // A's Discard: its draft goes
    log.after = [here(), unsaved()];
    maps.trainings.get(TP).rows[0].reps = "10"; fns.scheduleSave("trainings", TP); await save();   // B: a new reps, Save template (it waits for the signal)
    sb.setFail(null); app.set({ offline: false }); fns.flushOne("trainings", TP); await settle();
    log.server = [...server(sb), sb.tables.ft_trainings.get(TP).data.rows[0].reps];
  } finally { sb.setFail(null); done(); }
  assert.deepStrictEqual(log, { follows: [["Upper A 1 2", "f1", "Bench press"], true], after: [["Upper A", "f1", "Bench press"], false], server: ["Upper A", "f1", "Bench press", "10"] }, "the other window's discarded typing stayed on this window as the saved template, and its Save sent it");
});

test("two windows: window B follows A's typed draft of Upper A; a third window types Lower B, and the draft kept on the device becomes Lower B's: B's Upper A goes back to as saved, never Lower B's content (round 22's onStorage: the same template only)", async () => {
  const sb = makeSupabase(); coach(sb); seed(sb); seedLower(sb); const log = {};
  try {
    await sync(); open(); type("Upper A 1"); asA(); await relaunch(sb);    // window B took A's draft
    writeAs(DRAFT, JSON.stringify({ id: TQ, doc: { ...clone(sb.tables.ft_trainings.get(TQ).data), title: "Lower B 1" }, at: null, tab: "window C" })); clearTimeout(app.get().syncTimer);   // window C types in Lower B
    log.upper = [here(), maps.trainings.get(TP).id, unsaved()]; log.lower = shape(maps.trainings.get(TQ));
  } finally { done(); }
  assert.deepStrictEqual(log, { upper: [["Upper A", "f1", "Bench press"], TP, false], lower: ["Lower B", "f1", "Squat"] }, "Upper A on this window took Lower B's typed content");
});

test("the iPad switches off an exercise's add-weight sign (its key deleted) while the Mac types a name: the Mac's merging Save takes the sign off here too, and its next Save never puts it back (round 22's keepRows: the old keys go)", async () => {
  const sb = makeSupabase(); coach(sb); seed(sb, [{ ...ex("t1", "1", "Bench press"), ramp: true }]); const log = {};
  try {
    await sync(); open(); type("Upper A1"); ipad(sb, (d) => { delete d.rows[0].ramp; });   // the iPad: the sign tapped off, Save template there
    await save(); log.first = ["ramp" in maps.trainings.get(TP).rows[0], "ramp" in sb.tables.ft_trainings.get(TP).data.rows[0]];
    type("Upper A2"); await save(); log.next = "ramp" in sb.tables.ft_trainings.get(TP).data.rows[0];
  } finally { done(); }
  assert.deepStrictEqual(log, { first: [false, false], next: false }, "the add-weight sign switched off on the iPad stayed on the Mac, and its next Save put it back");
});

test("Leg press's (2) and Leg curl's (3) cards open on a template's page; the iPad deletes Leg press (Leg curl becomes 2); the Mac's merging Save, after a conflict, after the server refused its stamp (it reads first) and for a draft an older build kept (read first): Leg press's card state goes and Leg curl's follows it to 2 (round 22's relabelLive: the card numbers read before the merge, on both save paths)", async () => {
  const got = {}, want = {}, { openBlocks } = fns.cardSets();
  for (const how of ["a conflict", "the stamp refused, read first", "a draft kept by an older build, read first"]) {
    const sb = makeSupabase(); coach(sb); seed(sb, [ex("t1", "1", "Back squat"), ex("t2", "2", "Leg press"), ex("t3", "3", "Leg curl")]);
    try {
      await sync(); open(); type("Upper A1");
      if (how.startsWith("a draft kept")) { const d = JSON.parse(localStorage.getItem(DRAFT)); delete d.at; delete d.tab; localStorage.setItem(DRAFT, JSON.stringify(d)); await relaunch(sb); drawn(); }
      openBlocks.add(TP + "/2"); openBlocks.add(TP + "/3");                // the two cards opened
      ipad(sb, (d) => { d.rows = [ex("t1", "1", "Back squat"), ex("t3", "2", "Leg curl")]; });   // the iPad: Delete exercise on Leg press, Save template there
      if (how.startsWith("the stamp refused")) sb.setFail({ table: "ft_trainings", op: "update", times: 1, code: "22007", message: "invalid input syntax for type timestamp with time zone" });
      await save(); got[how] = { server: server(sb), open: [...openBlocks].filter((k) => k.startsWith(TP + "/")).map((k) => k.slice(TP.length + 1)).sort() };
    } finally { sb.setFail(null); openBlocks.clear(); done(); }
    want[how] = { server: ["Upper A1", "f1", "Back squat+Leg curl"], open: ["2"] };
  }
  assert.deepStrictEqual(got, want, "a card's open state stayed on its old number after the merging Save: Leg press's on Leg curl's card, and a card 3 left with no exercise");
});

test("two windows: window B follows A's typed draft, and B's Back is held (the Unsaved changes bar asks Save or Discard); A's Save template, or its Discard: B's draft ends, the held move is forgotten (a later Save template of another template stays on its page), and B asks for a sync (round 22's onStorage)", async () => {
  const got = {}, want = {};
  for (const how of ["A's Save template", "A's Discard"]) {
    const sb = makeSupabase(); coach(sb); seed(sb); seedLower(sb); const log = {};
    try {
      await sync(); open(); type("Upper A 1"); asA(); await relaunch(sb); await sync();   // window B, A's draft taken at its launch
      app.set({ view: { name: "training", id: TP }, renderedTraining: TP }); fns.go(FOLDER, true);   // B's Back on Upper A's page: held
      log.held = [app.get().view.name, !!app.get().pendingGo, unsaved()];
      if (how === "A's Save template") { const a = JSON.parse(localStorage.getItem(DRAFT)); ipad(sb, (d) => Object.assign(d, clone(a.doc))); }   // A's Save landed
      clearTimeout(app.get().syncTimer); app.set({ syncTimer: 0, view: { name: "clients" } });   // (env.js cannot draw a template's page: the redraw onStorage asks for is drawn on the list)
      writeAs(DRAFT, "null");                                                // A's draft cleared, by its Save or its Discard
      log.end = [unsaved(), app.get().pendingGo, !!app.get().syncTimer]; clearTimeout(app.get().syncTimer);
      await sync(); log.later = await saveLower(sb);
    } finally { done(); }
    got[how] = log;
    want[how] = { held: ["training", true, true], end: [false, null, true], later: STAYS };
  }
  assert.deepStrictEqual(got, want, "the other window's Save or Discard left this window's held Back waiting (a later Save template carried it out), or asked for no sync");
});

test("two windows: window A's Save template, or its Delete, made with no signal and A then closed, reaches the server when window B only looked at Upper A (opened, then Back), had its page open, or only took A's typed draft at its launch (A typed on, B followed): B shows it at once, keeps it waiting through its own edit (Jane's workout renamed, no signal), and sends it once the signal is back, B still open or opened again (the twenty-third check round: B passed over any template it held as a draft, and its next write of the queue dropped A's Save or Delete)", async () => {
  const windowA = async (sb, act, typed) => {                            // window A, run for real on this page before B's opens: it read the templates, typed in Upper A (each draft kept on the device, as A's page names it), then, with no signal, Save template or Delete template (its page's "…", asked first); what it left in the shared storage
    coach(sb); await sync(); const drafts = [];
    if (act === "Save template" || typed.length) open();
    for (const title of typed) { type(title); drafts.push(JSON.stringify(asPage("window A"))); }
    noSignal(sb);
    if (act === "Save template") { if (!typed.length) type("Upper A (saved in A)"); await save(); } else { fns.deleteTraining(TP); await settle(); }
    const q = JSON.parse(localStorage.getItem("fiala.pending.v1")); q.tab = "window A";
    done(); sb.setFail(null); return { drafts, queue: JSON.stringify(q) };
  };
  const got = {}, want = {};
  for (const act of ["Save template", "Delete template"]) for (const b of ["looked at Upper A earlier", "has Upper A's page open, nothing typed", "took A's typed draft at its launch", "never opened Upper A"]) for (const end of ["the signal back, B still open", "B closed, then opened again with the signal back"]) {
    if (act === "Save template" && b.startsWith("has")) continue;          // (env.js cannot draw a template's page: the redraw A's Save brings)
    const how = act + ", B " + b + ", " + end, taken = b.startsWith("took"), sb = makeSupabase(); seed(sb); seedJane(sb); const log = {};
    try {
      const a = await windowA(sb, act, taken ? (act === "Save template" ? ["Upper A 1", "Upper A 1 2"] : ["Upper A 1"]) : []);
      coach(sb); await sync();                                               // window B, signed in on the same account
      if (b.startsWith("looked")) { open(); app.set({ view: FOLDER }); }      // opened, then Back to its folder: its draft held, clean
      if (b.startsWith("has")) { open(); app.set({ view: { name: "training", id: TP }, renderedTraining: TP }); }
      if (taken) { fns.localBackend.save(); localStorage.setItem(DRAFT, a.drafts[0]); await relaunch(sb); await sync(); }   // B opened while A had typed: its boot took A's draft
      noSignal(sb);
      if (act === "Save template") { if (taken) writeAs(DRAFT, a.drafts[1]); writeAs("fiala.pending.v1", a.queue); writeAs(DRAFT, "null"); }   // A typed on (B follows), then Save template: its queue, then its draft cleared
      else { writeAs(DRAFT, "null"); writeAs("fiala.pending.v1", a.queue); }   // A's Delete template: its draft goes, then its queue
      clearTimeout(app.get().syncTimer); await settle();                     // (the sync B asks for as it follows would find no signal)
      log.heard = { here: here(), draft: draftHere(), ...(b.startsWith("has") ? { view: viewNow() } : {}) };
      if (app.get().view.name === "training") app.set({ view: FOLDER, renderedTraining: null });   // (still on the template's page, where it should not be: B goes Back, as env.js cannot draw that page)
      await renameLegs("Legs (B)"); log.afterB = queued();                   // B: Jane's workout renamed, no signal
      if (end.startsWith("the signal back")) { sb.setFail(null); app.set({ offline: false }); await sync(); }
      else { fns.localBackend.save(); sb.setFail(null); await relaunch(sb); await sync(); }
      log.server = server(sb); log.legs = sb.tables.ft_trainings.get(LEGS).data.title;
    } finally { sb.setFail(null); done(); }
    got[how] = log;
    const saved = taken ? "Upper A 1 2" : "Upper A (saved in A)", upper = [saved, "f1", "Bench press"];
    want[how] = act === "Save template"
      ? { heard: { here: upper, draft: b.startsWith("never") ? null : [upper, false] }, afterB: { dirty: true, gone: false, title: saved }, server: upper, legs: "Legs (B)" }
      : { heard: { here: null, draft: null, ...(b.startsWith("has") ? { view: FOLDER } : {}) }, afterB: { dirty: true, gone: true, title: null }, server: null, legs: "Legs (B)" };
  }
  assert.deepStrictEqual(got, want, "window A's Save template or Delete, waiting for the signal, never reached the server (window B's write of the queue dropped it), or window B did not show it");
});

test("a relaunch whose queue holds Upper A's Delete still waiting (window A deleted it with no signal), while the device keeps window B's unsaved draft of it, typed after the Delete, and the device copy B wrote last still holds it: the Delete goes, the draft with it, and Upper A is never written back (the twenty-third check round: the draft's template was passed over at the launch, and its waiting save wrote it back; reached only by two windows typing one template)", async () => {
  const sb = makeSupabase(); coach(sb); seed(sb); const log = {};
  try {
    await sync(); const t = clone(maps.trainings.get(TP)); fns.localBackend.save(); const copy = localStorage.getItem("fiala.trainings.v1");   // the device copy as window B keeps it: Upper A in it
    noSignal(sb); fns.deleteTraining(TP); await settle();                    // window A: Delete template with no signal (its queue lists it as gone)
    localStorage.setItem("fiala.trainings.v1", copy);                        // window B wrote the device copy last
    localStorage.setItem(DRAFT, JSON.stringify({ id: TP, doc: { ...t, title: "Upper A (typed in B)" }, at: maps.seenAt.get(KT) || null, tab: "window B" }));   // and B's typing, after the Delete
    sb.setFail(null); await relaunch(sb);
    log.boot = { here: here(), draft: draftHere(), kept: stored(), deleting: maps.deleting.has(KT) };
    await sync(); log.server = server(sb);
  } finally { sb.setFail(null); done(); }
  assert.deepStrictEqual(log, { boot: { here: null, draft: null, kept: null, deleting: true }, server: null }, "the template deleted here (its Delete waiting for the signal) was written back at the relaunch, or its draft came back");
});

test("two windows: window A taps Save template with no signal and types on; window B opens and takes A's typing and A's waiting Save; once the signal is back B sends that Save, which meets the iPad's move and merges it: the draft kept on the device keeps A's name, so A's next Save template clears it, B's Unsaved changes go, and the next launch shows none (the twenty-third check round: it took B's name, and A's Save left it behind as unsaved changes)", async () => {
  const sb = makeSupabase(); coach(sb); seed(sb); const log = {};
  try {
    await sync(); open(); type("Upper A 1"); noSignal(sb); await save(); type("Upper A 1 2");   // window A: Save template with no signal (it waits), then typed on
    asA(); await relaunch(sb); log.opened = [here(), unsaved(), snap()];   // window B opens on what A left on the device
    fns.persistPending();                                                    // and writes the queue as its sign-in does (enterCloudNow), before any send: A's entry is its own now (relaunch() skips the sign-in; a first write after the send landed took A's entry again and sent it twice)
    ipad(sb, (d) => { d.template.folder = "f2"; });                         // the iPad moves Upper A meanwhile
    sb.setFail(null); app.set({ offline: false }); fns.flushOne("trainings", TP); await settle();   // the signal back: B sends A's waiting Save, which merges the iPad's copy
    log.sent = { server: server(sb), kept: stored(), by: keptBy() };
    ipad(sb, (d) => { d.title = "Upper A 1 2"; });                          // A's Save template lands (A's name, the iPad's move)
    { const d = JSON.parse(localStorage.getItem(DRAFT) || "null"); if (d && d.id === TP && (!d.tab || d.tab === "window A")) writeAs(DRAFT, "null"); }   // and A's page clears the draft kept on the device if it names A (forgetDraft, as A typed it)
    clearTimeout(app.get().syncTimer); await sync();
    log.aSaved = { kept: stored(), unsaved: unsaved(), here: here() };
    fns.localBackend.save(); await relaunch(sb); log.next = [here(), unsaved()];
  } finally { sb.setFail(null); done(); }
  assert.deepStrictEqual(log, {
    opened: [["Upper A 1 2", "f1", "Bench press"], true, ["Upper A 1", "f1", "Bench press"]],
    sent: { server: ["Upper A 1", "f2", "Bench press"], kept: ["Upper A 1 2", "f2", "Bench press"], by: "window A" },
    aSaved: { kept: null, unsaved: false, here: ["Upper A 1 2", "f2", "Bench press"] },
    next: [["Upper A 1 2", "f2", "Bench press"], false],
  }, "the draft kept on the device took the name of the window that only sent the Save, so A's Save left it behind: Unsaved changes on B and at the next launch");
});

test("a template deleted on the iPad while its page is up here with a name typed: the page goes to the template's folder (where its Back goes) when a sync finds it gone and when Save template finds it gone (drawn at once), a Discard question up closes, and a Back held by the Unsaved changes bar leaves no move behind (a later Save template of another template stays on its page); its draft goes, the one kept on the device too (the twenty-third check round: the page landed on the Clients list with the question still up over it; round 22's redraw after the Save and the held move dropped)", async () => {
  const got = {}, want = {};
  for (const how of ["a sync finds it gone", "a sync finds it gone, the Discard question up", "a sync finds it gone, a Back held", "Save template finds it gone"]) {
    const sb = makeSupabase(); coach(sb); seed(sb); seedLower(sb); const log = {};
    try {
      await sync(); open(); app.set({ view: { name: "training", id: TP }, renderedTraining: TP }); type("Upper A1");   // Upper A's page, a name typed
      let answer = "no question";
      if (how.endsWith("question up")) { answer = "still up"; fns.askFirst({ title: "Discard the unsaved changes?", text: "The template stays as it was.", yes: "Discard" }).then((v) => { answer = v; }); }   // the Discard button's question
      if (how.endsWith("a Back held")) { fns.go(FOLDER, true); log.held = [app.get().view.name, !!app.get().pendingGo]; }
      sb.tables.ft_trainings.delete(TP);                                     // the iPad: Delete template
      if (how.startsWith("Save template")) await save(); else await sync();
      log.after = { view: viewNow(), drawn: app.get().renderedTraining, draft: draftHere(), kept: stored(), pendingGo: app.get().pendingGo, asking: !!app.get().asking, answer };
      if (how.endsWith("a Back held")) log.later = await saveLower(sb);
    } finally { done(); }
    got[how] = log;
    const held = how.endsWith("a Back held");
    want[how] = { ...(held ? { held: ["training", true] } : {}), after: { view: FOLDER, drawn: null, draft: null, kept: null, pendingGo: null, asking: false, answer: how.endsWith("question up") ? false : "no question" }, ...(held ? { later: STAYS } : {}) };
  }
  assert.deepStrictEqual(got, want, "the deleted template's page did not go to its folder (it landed on the Clients list, or stayed), a question stayed up over it, or a held Back was carried out later");
});

test("a queue entry whose record is not the record its key names (an empty one, or another template's) for the template taken back as a draft at a launch: it is passed over, the waiting Save template sends the template as saved, and Discard goes back to it (the twenty-third check round's hardening: it became the template as saved, wiping the template on the server)", async () => {
  const got = {}, want = {};
  for (const bad of ["an empty record", "Lower B's record"]) {
    const sb = makeSupabase(); coach(sb); seed(sb); seedLower(sb); const log = {};
    try {
      await sync(); open(); type("Upper A1"); noSignal(sb); await save();   // Save template with no signal: it waits in the queue
      type("Upper A1 x");                                                    // typed on (the draft kept on the device)
      { const q = JSON.parse(localStorage.getItem("fiala.pending.v1")); q.recs = q.recs.map((e) => (e[0] === KT ? [KT, bad === "an empty record" ? {} : clone(sb.tables.ft_trainings.get(TQ).data)] : e)); localStorage.setItem("fiala.pending.v1", JSON.stringify(q)); }   // the entry damaged (no code of the app writes one)
      sb.setFail(null); await relaunch(sb); log.snap = snap();
      await sync(); log.server = [...server(sb), sb.tables.ft_trainings.get(TP).data.clientId === TEMPLATES_ID];
      await discard(); log.afterDiscard = here();
    } finally { sb.setFail(null); done(); }
    got[bad] = log;
    want[bad] = { snap: ["Upper A1", "f1", "Bench press"], server: ["Upper A1", "f1", "Bench press", true], afterDiscard: ["Upper A1", "f1", "Bench press"] };
  }
  assert.deepStrictEqual(got, want, "a damaged queue entry was taken as the template as saved: sent over the template on the server, or Discard went back to it");
});

test("a queue entry another window wrote whose record is not the record its key names (an empty one, or another template's under Upper A's key) is passed over: this window keeps Upper A as it is, whether it looked at Upper A earlier or never opened it, and nothing of the entry reaches the server (the twenty-third check round's hardening)", async () => {
  const got = {}, want = {};
  for (const bad of ["an empty record", "Lower B's record"]) for (const b of ["looked at Upper A earlier", "never opened Upper A"]) {
    const how = bad + ", " + b, sb = makeSupabase(); coach(sb); seed(sb); seedLower(sb);
    try {
      await sync(); if (b.startsWith("looked")) { open(); app.set({ view: FOLDER }); }
      const rec = bad === "an empty record" ? {} : clone(sb.tables.ft_trainings.get(TQ).data);
      writeAs("fiala.pending.v1", JSON.stringify({ dirty: [KT], recs: [[KT, rec]], gone: [], stamps: [[KT, maps.seenAt.get(KT)]], docs: [[KT, maps.seenDoc.get(KT)]], owner: "coach@x.com", tab: "window A" }));   // window A's queue, its entry for Upper A damaged
      await settle(); clearTimeout(app.get().syncTimer);
      got[how] = { here: here(), id: maps.trainings.get(TP).id, taken: maps.dirty.has(KT) };
      await sync(); got[how].server = server(sb);
    } finally { done(); }
    want[how] = { here: ["Upper A", "f1", "Bench press"], id: TP, taken: false, server: ["Upper A", "f1", "Bench press"] };
  }
  assert.deepStrictEqual(got, want, "a damaged queue entry from another window replaced Upper A here, or was sent over it");
});

test("a superset's order typed into an exercise's number box while Save template is on its way and meets the iPad's move (the finger still in the box as the Save lands) stays as typed: Row typed 1a, Bench press given the next letter, a tri-set's Row typed 1c, the warm-up's second exercise typed Wa; leaving the box draws each where its letter asks, and the next Save template sends that order with the iPad's move (template-draft-order-probe.mjs; the twenty-third check round: the merge read the copy on screen with no exercise just typed, called it no change, and the server's order came back under his finger)", () => {
  const dir = path.dirname(fileURLToPath(import.meta.url));
  const r = JSON.parse(execFileSync(process.execPath, [path.join(dir, "template-draft-order-probe.mjs")], { encoding: "utf8", timeout: 90000 }).trim().split("\n").pop());
  const kept = (typed, rows, folder = "f2") => ({ landed: { typed, box: typed, unsaved: true, folder }, left: { rows, unsaved: true }, server: { rows, folder } });
  assert.deepStrictEqual(r, {
    rowFirst: kept("1a", ["1a Row", "1b Bench press", "2 Curl"]),
    benchSecond: kept("1b", ["1a Row", "1b Bench press", "2 Curl"]),
    triSet: kept("1c", ["1a Bench press", "1b Fly", "1c Row", "2 Curl"]),
    warmUp: kept("Wa", ["Wa Band pull-apart", "Wb Cat cow", "1 Back squat"]),
    alone: kept("1a", ["1a Row", "1b Bench press", "2 Curl"], "f1"),
    rejected: [],
  }, "the number typed while the merging Save was out went back to the server's (the page drew the old order, and the next Save sent it), or the iPad's move was lost");
});

// ---------- the twenty-fourth check round ----------
// A window that typed in a template takes another window's waiting Save of exactly that typing (its draft is then clean) or its Delete
// (R24-DRF-1); a template deleted elsewhere while its page is up: the page leaves with its menus and its step, the device keeps the folder as
// the page to open on, and Use's day picker closes (R24-DRF-2); a sync read before another window's write, answering after this window gave
// its own copy of that record up, changes nothing of it (R24-DRF-3); the name box clicked into but not typed in takes a rename (R24-DRF-4);
// and draftGone acts only while that template's page is up (R24-TW-5).
const writeBy = (tab, k, value) => { localStorage.setItem(k, value); if (k === "fiala.pending.v1") localStorage.setItem("fiala.pending.tab", tab); fns.onStorage({ key: k, newValue: value }); };   // another window (tab: its name) writes to the shared storage, and this page hears it
const keptView = () => { const v = JSON.parse(localStorage.getItem("fiala.trainings.view") || "null"); return v ? { name: v.name, id: v.id, folder: v.folder } : null; };   // the page the device opens on at the next launch
const menuUp = () => !document.getElementById("whenBg").hidden;       // a menu or bubble is up (its dim)
const queueOf = (tab) => JSON.stringify({ dirty: [], gone: [], recs: [], stamps: [], docs: [], owner: "coach@x.com", tab });   // a window's queue with nothing left to send

test("two windows: window A typed in Upper A and has not saved; window B, opened on A's typing (its launch took A's draft), taps Save template with no signal, or deletes Upper A on its page (asked first), or a window that never opened it deletes it on its row; it then renames Jane's workout and is closed: A takes that waiting Save of exactly its own typing (its Unsaved changes go) or the Delete (its draft goes), keeps it through its own writes of the queue (typing on, a Discard while it still asks, a relaunch), and the server has it once the signal is back (the twenty-fourth check round: A passed over a template it had typed in, and its next write of the queue dropped the Save or the Delete: the template stayed as it was, or came back)", async () => {
  const other = async (sb, act) => {                                  // that window, run for real on this page first, then closed: the queue it left in the shared storage
    coach(sb); await sync();
    if (act.startsWith("B")) { open(); type("Upper A 1"); asA(); fns.localBackend.save(); await relaunch(sb); await sync(); app.set({ view: { name: "training", id: TP }, renderedTraining: null }); }   // A's typing on the device; window B opens on it (its boot takes A's draft), on Upper A's page (not drawn: env.js cannot draw it)
    else app.set({ view: FOLDER, renderedTraining: null });            // window C on Upper A's folder, never having opened it
    noSignal(sb);
    if (act === "B's Save template") { fns.saveDraft(); await settle(); }
    else { const yes = yesArmed(), p = act.startsWith("B") ? fns.askDelete(TP) : fns.deleteTemplateRow(TP); await yes(); await p; await settle(); }   // its page's "…" or its row: asked first, then Delete
    await renameLegs("Legs (" + act[0] + ")");                         // and Jane's workout renamed, still no signal
    const q = JSON.parse(localStorage.getItem("fiala.pending.v1")); q.tab = "window " + act[0];
    done(); sb.setFail(null); return JSON.stringify(q);
  };
  const got = {}, want = {}, up = ["Upper A 1", "f1", "Bench press"];
  for (const act of ["B's Save template", "B's Delete on its page", "C's Delete on its row"]) for (const end of ["A does nothing more, then closed", "A types on, then closed", "A taps Discard while it still asks, then closed", "A stays open, the signal back"]) {
    const saved = act.endsWith("Save template"); if (!saved && (end.startsWith("A types") || end.startsWith("A taps"))) continue;   // (deleted: its page has gone, nothing to type in or discard)
    const how = act + "; " + end, sb = makeSupabase(); seed(sb); seedJane(sb); const log = {}, by = "window " + act[0];
    try {
      const queue = await other(sb, act);
      coach(sb); await sync(); open(); type("Upper A 1"); app.set({ view: FOLDER, renderedTraining: null }); noSignal(sb);   // window A as it was: its own typing, not saved (its page played on its folder: env.js cannot draw it)
      writeBy(by, DRAFT, "null"); writeBy(by, "fiala.pending.v1", queue); clearTimeout(app.get().syncTimer); await settle();   // what that window wrote: the draft kept on the device gone (its Save of a draft it only took, or a Delete, clears it whichever window typed it), then its queue
      log.heard = { here: here(), unsaved: unsaved(), queued: queued() };
      if (end.startsWith("A types on")) type("Upper A 1 2");
      if (end.startsWith("A taps Discard") && unsaved()) await discard();
      if (end.endsWith("then closed")) { fns.localBackend.save(); sb.setFail(null); await relaunch(sb); log.relaunched = [here(), unsaved()]; await sync(); }
      else { sb.setFail(null); app.set({ offline: false }); await sync(); }
      log.server = server(sb); log.legs = sb.tables.ft_trainings.get(LEGS).data.title;
    } finally { sb.setFail(null); done(); }
    got[how] = log;
    const typedOn = end.startsWith("A types on");
    want[how] = { heard: { here: saved ? up : null, unsaved: false, queued: { dirty: true, gone: !saved, title: saved ? "Upper A 1" : null } }, ...(end.endsWith("then closed") ? { relaunched: saved ? [typedOn ? ["Upper A 1 2", "f1", "Bench press"] : up, typedOn] : [null, false] } : {}), server: saved ? up : null, legs: "Legs (" + act[0] + ")" };
  }
  assert.deepStrictEqual(got, want, "window A dropped the other window's waiting Save template of A's own typing, or its Delete, from the queue (the server kept Upper A as it was, or still has it), or A still showed Unsaved changes for typing already saved");
});

test("two windows typing different things in Upper A, the signal on: window A has set Bench press to 10 reps (not saved), window B renames Upper A and taps Save template, and it lands: A keeps its own typing (B's Save is not exactly it), and A's Save template then keeps B's new name with A's reps (the twenty-fourth check round: A takes another window's Save only when it is exactly A's typing; a looser rule took B's copy in as A's own, and A's Save wrote the old name back)", async () => {
  const sb = makeSupabase(); coach(sb); seed(sb); const log = {};
  try {
    await sync(); const st = maps.seenAt.get(KT), doc = maps.seenDoc.get(KT);
    open(); app.set({ view: FOLDER, renderedTraining: null });
    maps.trainings.get(TP).rows[0].reps = "10"; fns.scheduleSave("trainings", TP);   // window A: 10 typed into Bench press's reps (its draft)
    const b = { ...clone(JSON.parse(doc)), id: TP, title: "Upper A (B)" };
    writeBy("window B", "fiala.pending.v1", JSON.stringify({ dirty: [KT], gone: [], recs: [[KT, b]], stamps: [[KT, st]], docs: [[KT, doc]], owner: "coach@x.com", tab: "window B" }));   // window B's Save template: its queue
    ipad(sb, (d) => { d.title = "Upper A (B)"; });                         // it lands
    writeBy("window B", "fiala.pending.v1", queueOf("window B")); clearTimeout(app.get().syncTimer); await settle();   // and B's queue once it landed
    log.heard = [maps.trainings.get(TP).title, maps.trainings.get(TP).rows[0].reps, unsaved()];
    await save(); const s = sb.tables.ft_trainings.get(TP).data; log.server = [s.title, s.rows[0].reps];
  } finally { done(); }
  assert.deepStrictEqual(log, { heard: ["Upper A", "10", true], server: ["Upper A (B)", "10"] }, "window A took window B's Save of other typing than its own, or its Save template then wrote B's new name back to Upper A");
});

test("a template deleted on the iPad while its page is up here, reached from the Clients list through Templates and its folder, nothing typed or a name typed: the sync that finds it gone puts the page on the folder's own step (one Back from there goes to the Templates list, the next to the Clients list), and the device keeps the folder as the page to open on (the twenty-fourth check round: the template's step stayed under the folder, every Back after it was one step off, and a relaunch opened on the Clients list)", async () => {
  const got = {}, want = {}, bg = document.getElementById("whenBg"), was = bg.hidden;
  try {
    for (const how of ["nothing typed", "a name typed"]) {
      const sb = makeSupabase(); coach(sb); seed(sb, []); const log = {};   // (Upper A with no exercises yet: env.js draws its page)
      try {
        await sync(); bg.hidden = true;                                     // (no menu up: Back is not held)
        fns.go({ name: "clients" }); await tick(); fns.go({ name: "client", id: TEMPLATES_ID }); await tick(); fns.go(FOLDER); await tick(); const folder = fns.navState().depth;
        fns.go({ name: "training", id: TP }); await tick(); if (how === "a name typed") type("Upper A1");   // Upper A's page
        log.page = [fns.navState().depth - folder, keptView()];
        sb.tables.ft_trainings.delete(TP); await sync();                    // the iPad: Delete template
        log.after = [viewNow(), fns.navState().depth - folder, keptView()];
        await fns.goBackNow(); await tick(); log.back = [viewNow(), fns.navState().depth - folder];
        await fns.goBackNow(); await tick(); log.backAgain = [viewNow(), fns.navState().depth];
      } finally { done(); }
      got[how] = log;
      want[how] = { page: [1, { name: "training", id: TP, folder: undefined }], after: [FOLDER, 0, FOLDER], back: [{ name: "client", id: TEMPLATES_ID, folder: undefined }, -1], backAgain: [{ name: "clients", id: undefined, folder: undefined }, 0] };
    }
  } finally { bg.hidden = was; }
  assert.deepStrictEqual(got, want, "the deleted template's step stayed under its folder (each Back after it landed one step off), or the device kept the deleted template as the page to open on");
});

test("a template deleted on the iPad while its page is up here with a menu open over it (an exercise's \"…\", the 1 to 20 list of its sets disc, a touch and hold's menu over the card it lifted), nothing typed or a name typed: the sync that finds it gone closes the menu as the page goes to the folder (the twenty-fourth check round: Bench press's menu stayed over the folder page, its Delete exercise still asking about the deleted template, and on the phone the lifted card and the dim stayed)", async () => {
  const got = {}, want = {}, bg = document.getElementById("whenBg"), was = bg.hidden;
  try {
    for (const menu of ["an exercise's \"…\"", "the sets list", "a touch and hold's menu"]) for (const how of ["nothing typed", "a name typed"]) {
      const k = menu + ", " + how, sb = makeSupabase(); coach(sb); seed(sb); let closed = 0;
      try {
        await sync(); bg.hidden = true;
        open(); app.set({ view: { name: "training", id: TP }, renderedTraining: TP }); if (how === "a name typed") type("Upper A1");   // Upper A's page
        const onClose = () => { closed++; }, items = fns.exerciseMenu(maps.trainings.get(TP).rows[0], { swap() {}, note() {}, remove() {} });   // Bench press's menu, as its card builds it
        if (menu.startsWith("an exercise")) fns.showMenu(el("button"), items, { align: "right", onClose });   // as the card's "…" opens it
        else if (menu.startsWith("the sets")) fns.showMenu(el("button"), Array.from({ length: 20 }, (_, i) => ({ label: i + 1 + (i ? " sets" : " set"), checked: i === 2, onPick() {} })), { align: "right", over: true, long: true, onClose });   // as the sets disc opens it
        else fns.showMenu(el("div"), items, { lift: { box: el("div"), rect: { top: 120, bottom: 240, left: 16, right: 386, width: 370, height: 120 }, grow: 1.03, open() {}, hide() {}, drop() {} }, onClose });   // as a touch and hold opens it over the card it lifted (its onClose takes the lift and the dim away)
        const before = menuUp();
        sb.tables.ft_trainings.delete(TP); await sync();                    // the iPad: Delete template
        got[k] = { before, after: { view: viewNow(), menu: menuUp(), closed } };
      } finally { if (menuUp()) { fns.showMenu(document.getElementById("tMore"), [], {}); fns.render(); } done(); }   // (a menu left up: replaced by one on the page's "…", which the redraw closes)
      want[k] = { before: true, after: { view: FOLDER, menu: false, closed: 1 } };
    }
  } finally { bg.hidden = was; }
  assert.deepStrictEqual(got, want, "a menu stayed up over the folder page after its template was deleted elsewhere");
});

async function useProbe(dir) {                                          // run in its own process by the test below: Use's button and the client rows it lists hear their clicks only on stand-ins set up before main.js loads (env.js drops listeners); prints one JSON line
  const { pathToFileURL } = await import("node:url"), { join } = await import("node:path"), at = (f) => pathToFileURL(join(dir, f)).href;
  const { byId, el } = await import(at("env.js")), { makeSupabase } = await import(at("fake-supabase.js"));
  const kids = (e) => { e.replaceChildren = (...k) => { e.children = k; e.firstElementChild = k[0] || null; }; e.appendChild = (c) => { e.children = [...e.children, c]; e.firstElementChild = e.children[0]; return c; }; e.append = (...k) => { e.children = [...e.children, ...k]; e.firstElementChild = e.children[0] || null; }; return e; };   // an element that keeps what is put in it, as the page's own do
  const listens = (e) => { const L = {}; e.addEventListener = (type, fn) => { (L[type] ||= []).push(fn); }; e.fire = (type, ev) => { for (const fn of [...(L[type] || [])]) fn(ev); }; e.focus = () => { document.activeElement = e; }; return e; };   // and records its listeners
  const attrs = (e) => { const A = {}; e.setAttribute = (k, v) => { A[k] = String(v); }; e.getAttribute = (k) => (k in A ? A[k] : null); return e; };
  const recorder = (id, extra = {}) => { const e = attrs(listens(kids(el("div")))); Object.assign(e, extra); byId.set(id, e); return e; };
  for (const id of ["useBtn", "dpPrev", "dpNext", "dpToday", "dpCancel", "whenPop"]) recorder(id);
  const pick = recorder("usePick", { hidden: true }), grid = recorder("dpGrid", { clientWidth: 350, setPointerCapture() {} }), days = recorder("datePick", { hidden: true }); recorder("whenBg", { hidden: true });
  const make = document.createElement; document.createElement = (t) => attrs(listens(kids(make(t))));
  document.contains = (x) => !!x;
  globalThis.getComputedStyle = (n) => { const m = /translate3d\(([-\d.e]+)px/.exec((n && n.style && n.style.transform) || ""); return { transform: m ? "matrix(1, 0, 0, 1, " + Number(m[1]) + ", 0)" : "none", getPropertyValue: () => "", display: "block", color: "" }; };
  const app = (await import(at("../app/main.js"))).internals(), { fns, maps } = app, { TEMPLATES_ID } = await import(at("../app/model.js"));
  const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms));
  const settle = async () => { const until = Date.now() + 15000; do await tick(5); while ((app.get().inflight > 0 || maps.timers.size) && Date.now() < until); };
  const sync = async () => { await fns.syncDownNow(); await settle(); };
  const TP = "4b6d8f0a-2c4e-4a6b-8d0f-1a3c5e7a9b1d", ALEX = "5c7e9a1b-3d5f-4b7d-9f1a-3c5e7a9b1d3f", AT = "2026-11-10T16:00:00.000Z", out = {};
  for (const gone of ["the template", "the client"]) {
    app.reset(); fns.leaveSettings(); pick.hidden = true; const sb = makeSupabase();
    sb.seed("ft_clients", TEMPLATES_ID, { id: TEMPLATES_ID, name: "Templates", kind: "templates", templatesVersion: 3, folders: [{ id: "f1", name: "Strength", parent: null, kind: "folder", at: AT }], builtinsAdopted: 1 });
    sb.seed("ft_trainings", TP, { id: TP, clientId: TEMPLATES_ID, title: "Upper A", date: "2026-01-01", createdAt: AT, completedAt: null, skippedAt: null, template: { program: "My templates", phase: 0, stage: 0, n: 1, folder: "f1" }, rows: [] });   // (no exercises yet: its page draws on these stand-ins)
    sb.seed("ft_clients", ALEX, { id: ALEX, name: "Alex Sample", unit: "lb" });
    app.set({ sb, signedIn: true, clientMode: false, backend: fns.cloudBackend, sessionEmail: "coach@x.com", view: { name: "clients" }, templateDraft: null });
    await sync();
    app.set({ view: { name: "training", id: TP } }); fns.render();       // Upper A's page
    byId.get("useBtn").fire("click", { detail: 1 });                       // Use: the clients to give it to
    const row = pick.children.find((li) => li.children && li.children[0]); if (row) row.children[0].fire("click", { detail: 1 });   // Alex: her days
    const log = { opened: fns.datePicker() ? [fns.datePicker().title, days.hidden] : null };
    if (gone === "the template") sb.tables.ft_trainings.delete(TP); else sb.tables.ft_clients.delete(ALEX);   // the iPad: Delete template, or Alex deleted there
    await sync();
    const v = app.get().view; log.after = { picker: !!fns.datePicker(), hidden: days.hidden, view: [v.name, v.folder || null] };
    const dp = fns.datePicker();
    if (dp) {                                                            // still up: a day picked (a keyboard's Enter, as it never waits for the double-tap guard)
      const page = grid.firstElementChild && grid.firstElementChild.children[dp.months.indexOf(dp.month)], b = page && page.children.find((x) => !x.disabled && x.children && x.children[0] && /^\d+$/.test(String(x.children[0].textContent)));
      const ev = { detail: 0, stopped: false, stopPropagation() { this.stopped = true; }, preventDefault() {} };
      if (b) { grid.fire("click", ev); if (!ev.stopped) b.fire("click", ev); } await settle(); if (fns.datePicker()) fns.closeDatePicker();
    }
    log.made = [...maps.trainings.values()].filter((t) => t.clientId === ALEX).map((t) => t.title);
    out[gone] = log;
  }
  console.log(JSON.stringify(out)); process.exit(0);
}

test("Use on a template's page, a client picked, her days up: the template deleted on the iPad (or the client deleted there), and a sync finds it gone: the days close, so no day picked makes a workout from the deleted template (Use's days ask, as the Templates list's Use for client does; the twenty-fourth check round: the days stayed up over the folder page, and a day picked made Upper A for Alex from the deleted template)", () => {
  const dir = path.dirname(fileURLToPath(import.meta.url));
  const out = execFileSync(process.execPath, ["--input-type=module", "-e", "(" + useProbe.toString() + ")(" + JSON.stringify(dir) + ");"], { encoding: "utf8", timeout: 90000 });
  const r = JSON.parse(out.trim().split("\n").pop());
  assert.deepStrictEqual(r, {
    "the template": { opened: ["Add to Alex Sample", false], after: { picker: false, hidden: true, view: ["client", "f1"] }, made: [] },
    "the client": { opened: ["Add to Alex Sample", false], after: { picker: false, hidden: true, view: ["training", null] }, made: [] },
  }, "Use's days stayed up after the template (or the client) was deleted elsewhere, and a day picked made a workout from it");
});

const TC = "7e9a1c3e-5b7d-4f9a-8c1e-3a5c7e9b1d3f", KC = "trainings/" + TC;   // Core C, a new template window A makes
const CORE = () => ({ id: TC, clientId: TEMPLATES_ID, title: "Core C", date: "2026-01-01", createdAt: AT, completedAt: null, skippedAt: null, template: clone(PLACE), rows: [] });   // (no exercises yet: env.js draws its page)
const holdReads = (sb) => {                                            // this page's full read of the tables (a sync on a slow connection): read from the server as it is when sent, its answer held until let go
  const real = sb.from; let open = null, n = 0; const gate = new Promise((r) => { open = r; });
  sb.from = (table) => {
    const b = real(table), then = b.then, order = b.order; let list = false;
    b.order = (col) => { if (col === "id") list = true; return order.call(b, col); };
    b.then = (res, rej) => { if (!list || !(table === "ft_trainings" || table === "ft_clients")) return then.call(b, res, rej); n++; const read = new Promise((r) => then.call(b, r, (e) => r({ data: null, error: e }))); return read.then((v) => gate.then(() => v)).then(res, rej); };
    return b;
  };
  return { release: () => { sb.from = real; open(); }, reads: () => n };
};
const inCopy = (id) => { const c = JSON.parse(localStorage.getItem("fiala.trainings.v1") || "null"); return !!(c && c.trainings && c.trainings[id]); };   // the device copy holds it

test("this window's sync is out on a slow connection when window A deletes Upper A (this window on its folder, or on its page), or makes a new template Core C (this window on the folder, or then opening Core C and typing its name): this window takes it, A's write lands, this window gives its own copy of it up (A's queue no longer lists it), and then the sync's answer, read before A's write, comes back: Upper A stays gone, from the list and the device copy; Core C stays, with the name typed, its draft and the draft kept on the device (the twenty-fourth check round: the answer brought the deleted template back until the next sync, or took Core C away with the typing; a copy given up now counts as written after any read already out)", async () => {
  const got = {}, want = {};
  for (const how of ["A deletes Upper A, this window on its folder", "A deletes Upper A, this window on its page", "A makes Core C, this window on the folder", "A makes Core C, this window then opens it and types its name"]) {
    const sb = makeSupabase(); coach(sb); seed(sb); const log = {}, made = how.startsWith("A makes"), k = made ? KC : KT, id = made ? TC : TP, typed = how.endsWith("types its name"); let held = null;
    try {
      await sync(); const st = maps.seenAt.get(KT);
      if (how.endsWith("on its page")) { open(); app.set({ view: { name: "training", id: TP }, renderedTraining: TP }); } else app.set({ view: FOLDER, renderedTraining: null });
      held = holdReads(sb); const out = fns.syncDownNow().finally(() => app.set({ syncing: null })); app.set({ syncing: out });   // the sync goes out (as syncDown starts it: a sync asked for while it is out is this one)
      for (let i = 0; i < 400 && held.reads() < 2; i++) await tick(5);       // its reads sent: the server as it is now
      writeBy("window A", "fiala.pending.v1", made ? JSON.stringify({ dirty: [KC], gone: [], recs: [[KC, CORE()]], stamps: [[KC, null]], docs: [], owner: "coach@x.com", tab: "window A" }) : JSON.stringify({ dirty: [KT], gone: [KT], recs: [], stamps: [[KT, st]], docs: [], owner: "coach@x.com", tab: "window A" }));   // A's new template, or its Delete (asked first): its queue
      log.took = [maps.trainings.has(id), maps.dirty.has(k), viewNow()];
      if (made) { const { id: _, ...d } = CORE(); sb.seed("ft_trainings", TC, d); } else sb.tables.ft_trainings.delete(TP);   // A's write lands
      writeBy("window A", "fiala.pending.v1", queueOf("window A"));           // and A's queue once it landed
      clearTimeout(maps.timers.get(k)); maps.timers.delete(k); fns.flushOne("trainings", id); await settle(); clearTimeout(app.get().syncTimer);   // this window's own send of the copy it took (its timer's, run now): given up (the sync it asks for is the one still out)
      log.gaveUp = !maps.dirty.has(k);
      if (typed) { app.set({ view: { name: "training", id: TC } }); fns.render(); maps.trainings.get(TC).title = "Core C (B)"; fns.scheduleSave("trainings", TC); }   // Core C's page, its name typed (as the name box's input handler does)
      held.release(); await out; await settle();                              // the answer read before A's write
      log.answer = { here: maps.trainings.has(id), copy: inCopy(id), view: viewNow(), ...(typed ? { draft: draftHere(), kept: keptFor(TC) } : {}) };
      await sync(); log.next = { here: maps.trainings.has(id), server: !!sb.tables.ft_trainings.get(id) };
    } finally { if (held) held.release(); done(); }
    got[how] = log;
    const typedC = ["Core C (B)", "f1", ""];
    want[how] = { took: [made, true, FOLDER], gaveUp: true, answer: { here: made, copy: made, view: typed ? { name: "training", id: TC, folder: undefined } : FOLDER, ...(typed ? { draft: [typedC, true], kept: typedC } : {}) }, next: { here: made, server: made } };
  }
  assert.deepStrictEqual(got, want, "the answer read before window A's write brought the deleted template back here (in the list and the device copy), or took the new template away with the name typed in it");
});

test("the same for a client's workout, made 3 hours ago elsewhere: window A fills it while it is still empty on the server, or a window behind writes its old empty copy over the server's full one (the iPad's exercise, her logged set); this window takes A's copy while its sync is out, gives it up once A's queue no longer lists it, the answer read before comes back, and her page is drawn (its tidying of old empty workouts): the workout stays on the server with its exercise, here too after the next sync (the twenty-fourth check round: the answer brought the empty copy back and the tidying deleted the filled workout on the server; a copy given up counted as this window's own confirmed write took the hold off the empty copy taken, and the tidying deleted the full one)", async () => {
  const W = "9b1d3f5a-7c9e-4b1d-8f3a-5c7e9b1d3f5a", KW = "trainings/" + W, got = {}, want = {};
  const empty = () => ({ id: W, clientId: JANE, title: "", date: inDays(1), createdAt: new Date(Date.now() - 3 * 3600e3).toISOString(), completedAt: null, skippedAt: null, rows: [] });   // made 3 hours ago on another device, nothing in it yet
  const full = () => ({ ...empty(), title: "Legs day", rows: [{ ...ex("s1", "1", "Back squat"), weights: ["135"], repsDone: ["8"] }] });   // the iPad's exercise, her Set 1 logged
  const data = (r) => { const { id: _, ...d } = r; return d; };
  for (const how of ["window A fills it", "a window behind writes its old empty copy"]) {
    const sb = makeSupabase(); coach(sb); seed(sb); seedJane(sb); const fills = how.startsWith("window A"); let held = null;
    try {
      sb.seed("ft_trainings", W, data(fills ? empty() : full()), { client_id: JANE }); await sync(); const st = maps.seenAt.get(KW);
      writeBy("window A", "fiala.pending.v1", JSON.stringify({ dirty: [KW], gone: [], recs: [[KW, fills ? full() : empty()]], stamps: [[KW, fills ? st : "2026-10-13T00:00:01Z"]], docs: [[KW, JSON.stringify(data(empty()))]], owner: "coach@x.com", tab: "window A" }));   // that window's queue: its copy of her workout (the one behind read it long ago)
      held = holdReads(sb); const out = fns.syncDownNow().finally(() => app.set({ syncing: null })); app.set({ syncing: out });   // this window's sync goes out (as syncDown starts it)
      for (let i = 0; i < 400 && held.reads() < 2; i++) await tick(5);
      if (fills) { const s = sb.tables.ft_trainings.get(W); s.data = data(full()); bump(s); }   // A's write lands (the one behind: merged into the server's copy, it changes nothing there)
      writeBy("window A", "fiala.pending.v1", queueOf("window A"));
      clearTimeout(maps.timers.get(KW)); maps.timers.delete(KW); fns.flushOne("trainings", W); await settle(); clearTimeout(app.get().syncTimer);   // this window's own send of the copy it took: given up
      held.release(); await out; await settle();                              // the answer read before A's write
      app.set({ view: { name: "client", id: JANE }, tab: "workouts" }); fns.render(); await settle();   // her page drawn: its tidying
      got[how] = { server: sb.tables.ft_trainings.get(W) ? sb.tables.ft_trainings.get(W).data.rows.map((r) => r.name) : "deleted" };
      await sync(); got[how].next = maps.trainings.get(W) ? maps.trainings.get(W).rows.map((r) => r.name) : "gone";
    } finally { if (held) held.release(); done(); }
    want[how] = { server: ["Back squat"], next: ["Back squat"] };
  }
  assert.deepStrictEqual(got, want, "her filled workout was tidied away as empty and deleted on the server");
});

test("the cursor in the name box with nothing typed (clicked into it): another window's Save template of a rename made with no signal, or a sync bringing the iPad's rename, on a template's page (and on Jane's workout's page): the box shows the new name, and the letter typed next goes after it, never back over the rename; a box typed in keeps what was typed (the twenty-fourth check round: the box kept the old name under the cursor, and the next letter wrote it back over the rename)", async () => {
  const W = "3f5a7c9e-1b3d-4f5a-8c7e-9d1f3b5a7c9f", got = {}, want = {}, tb = document.getElementById("tTitle");
  for (const how of ["another window's Save template", "a sync", "a sync, on Jane's workout", "typed in the box, saved, then a sync"]) {
    const sb = makeSupabase(); coach(sb); seed(sb, []); const log = {}, jane = how.endsWith("Jane's workout"), id = jane ? W : TP;   // (no exercises: env.js draws the page)
    if (jane) { sb.seed("ft_clients", JANE, { id: JANE, name: "Jane Testperson", unit: "lb" }); sb.seed("ft_trainings", W, { id: W, clientId: JANE, title: "Legs", date: inDays(2), createdAt: AT, completedAt: null, skippedAt: null, rows: [] }, { client_id: JANE }); }
    const was = jane ? "Legs" : "Upper A", renamed = was + (how.startsWith("another") ? " (A)" : " (iPad)"), typeBox = (s) => { tb.value = s; maps.trainings.get(id).title = s; fns.scheduleSave("trainings", id); };   // a letter typed into the box (as its input handler does)
    try {
      await sync(); app.set({ view: { name: "training", id }, renderedTraining: null }); fns.render(); document.activeElement = tb;   // the page drawn, the cursor put in its name box
      log.drawn = tb.value;
      if (how.startsWith("typed")) { typeBox(was + "x"); await save(); }      // a letter typed, Save template (it lands; the cursor still in the box)
      if (how.startsWith("another")) { const st = maps.seenAt.get(KT), doc = maps.seenDoc.get(KT); noSignal(sb); writeBy("window A", "fiala.pending.v1", JSON.stringify({ dirty: [KT], gone: [], recs: [[KT, { ...clone(JSON.parse(doc)), id: TP, title: renamed }]], stamps: [[KT, st]], docs: [[KT, doc]], owner: "coach@x.com", tab: "window A" })); clearTimeout(app.get().syncTimer); await settle(); }   // window A's Save template of its rename, waiting for the signal: this window takes it
      else { const s = sb.tables.ft_trainings.get(id); s.data.title = renamed; bump(s); await sync(); }   // the iPad's rename
      log.box = tb.value;
      if (!how.startsWith("typed")) { typeBox(tb.value + "x"); if (!jane) await save(); else await settle(); sb.setFail(null); app.set({ offline: false }); await sync(); log.server = sb.tables.ft_trainings.get(id).data.title; }   // a letter typed, saved (once the signal is back)
    } finally { document.activeElement = null; sb.setFail(null); done(); }
    got[how] = log;
    want[how] = how.startsWith("typed") ? { drawn: was, box: was + "x" } : { drawn: was, box: renamed, server: renamed + "x" };
  }
  assert.deepStrictEqual(got, want, "the name box under the cursor kept the old name after a rename came in, and the letter typed next wrote the old name back over the rename (or a box typed in lost its typing)");
});

test("a template looked at earlier (its clean draft kept) or taken back at a launch, the coach now elsewhere (the Clients list, Jane's page, a question up there, her workout's page): the iPad deletes the template and a sync finds it gone: the page stays where it is and the question stays up; only the draft goes (draftGone acts only while that template's page is up; R24-TW-5: no test held it)", async () => {
  const W = "3f5a7c9e-1b3d-4f5a-8c7e-9d1f3b5a7c9f", got = {}, want = {};
  for (const where of ["the Clients list", "Jane's page", "Jane's page, a question up", "Jane's workout", "the Clients list, the draft taken back at a launch"]) {
    const sb = makeSupabase(); coach(sb); seed(sb); seedJane(sb); sb.seed("ft_trainings", W, { id: W, clientId: JANE, title: "Push", date: inDays(1), createdAt: AT, completedAt: null, skippedAt: null, rows: [] }, { client_id: JANE }); const log = {};   // (her workout with no exercises yet: env.js draws its page)
    const to = where.startsWith("the Clients") ? { name: "clients" } : where === "Jane's workout" ? { name: "training", id: W } : { name: "client", id: JANE };
    let answer = "no question", yes = null;
    try {
      await sync(); open();                                                 // Upper A's page: its draft (as renderTraining makes it)
      if (where.endsWith("at a launch")) { type("Upper A1"); await relaunch(sb); await sync(); }   // a name typed, the app closed and opened again on the Clients list: its draft taken back
      else app.set({ view: { name: "training", id: TP }, renderedTraining: TP });
      log.draft = !!app.get().templateDraft;
      app.set({ view: to, renderedTraining: null });                         // he is elsewhere (go() never clears a clean draft; one taken back at a launch stays while the app opens on the Clients list)
      if (where.endsWith("question up")) { yes = yesArmed(); answer = "still up"; fns.askFirst({ title: "Delete this note?", text: "It goes from this exercise and from the notes list.", yes: "Delete" }).then((v) => { answer = v; }); }
      sb.tables.ft_trainings.delete(TP); await sync();                      // the iPad: Delete template
      log.after = { view: viewNow(), draft: !!app.get().templateDraft, kept: keptFor(TP), asking: !!app.get().asking, answer };
    } finally { if (yes) await yes(); done(); }
    got[where] = log;
    want[where] = { draft: true, after: { view: { name: to.name, id: to.id, folder: undefined }, draft: false, kept: null, asking: where.endsWith("question up"), answer: where.endsWith("question up") ? "still up" : "no question" } };
  }
  assert.deepStrictEqual(got, want, "a template deleted elsewhere while the coach was on another page moved him to its folder, or closed the question he had up");
});

// ---------- the twenty-fifth check round ----------
// R25-DRF-3: Use's days refuse a template deleted elsewhere (round 24's ok), but ok is asked only when the days are drawn again, and a redraw waits
// while a finger (or the mouse) is on the days. A sync finding Upper A gone during that press took the page to its folder and left the days up; the
// lift then picked the day, and Use's onPick made Upper A for Alex from the old copy it held (trainings.get(t.id) || t). It now reads the template
// again, as the Templates list's Use for client does.
async function useHeldProbe(dir) {                                      // run in its own process by the test below, on useProbe's stand-ins (Use's button, the client rows, the days keep their listeners); prints one JSON line
  const { pathToFileURL } = await import("node:url"), { join } = await import("node:path"), at = (f) => pathToFileURL(join(dir, f)).href;
  const { byId, el } = await import(at("env.js")), { makeSupabase } = await import(at("fake-supabase.js"));
  const kids = (e) => { e.replaceChildren = (...k) => { e.children = k; e.firstElementChild = k[0] || null; }; e.appendChild = (c) => { e.children = [...e.children, c]; e.firstElementChild = e.children[0]; return c; }; e.append = (...k) => { e.children = [...e.children, ...k]; e.firstElementChild = e.children[0] || null; }; return e; };
  const listens = (e) => { const L = {}; e.addEventListener = (type, fn) => { (L[type] ||= []).push(fn); }; e.fire = (type, ev) => { for (const fn of [...(L[type] || [])]) fn(ev); }; e.focus = () => { document.activeElement = e; }; return e; };
  const attrs = (e) => { const A = {}; e.setAttribute = (k, v) => { A[k] = String(v); }; e.getAttribute = (k) => (k in A ? A[k] : null); return e; };
  const recorder = (id, extra = {}) => { const e = attrs(listens(kids(el("div")))); Object.assign(e, extra); byId.set(id, e); return e; };
  for (const id of ["useBtn", "dpPrev", "dpNext", "dpToday", "dpCancel", "whenPop"]) recorder(id);
  const pick = recorder("usePick", { hidden: true }), grid = recorder("dpGrid", { clientWidth: 350, setPointerCapture() {} }), days = recorder("datePick", { hidden: true }); recorder("whenBg", { hidden: true });
  const make = document.createElement; document.createElement = (t) => attrs(listens(kids(make(t))));
  document.contains = (x) => !!x;
  globalThis.getComputedStyle = (n) => { const m = /translate3d\(([-\d.e]+)px/.exec((n && n.style && n.style.transform) || ""); return { transform: m ? "matrix(1, 0, 0, 1, " + Number(m[1]) + ", 0)" : "none", getPropertyValue: () => "", display: "block", color: "" }; };
  const app = (await import(at("../app/main.js"))).internals(), { fns, maps } = app, { TEMPLATES_ID } = await import(at("../app/model.js"));
  const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms));
  const settle = async () => { const until = Date.now() + 15000; do await tick(5); while ((app.get().inflight > 0 || maps.timers.size) && Date.now() < until); };
  const sync = async () => { await fns.syncDownNow(); await settle(); };
  const TP = "4b6d8f0a-2c4e-4a6b-8d0f-1a3c5e7a9b1d", ALEX = "5c7e9a1b-3d5f-4b7d-9f1a-3c5e7a9b1d3f", AT = "2026-11-10T16:00:00.000Z", out = {};
  const day = String(Number(fns.today().slice(8)));                    // today's day in the month shown
  for (const [how, pointerType] of [["a finger, nothing deleted", "touch"], ["a finger", "touch"], ["the mouse", "mouse"]]) {
    app.reset(); fns.leaveSettings(); pick.hidden = true; const sb = makeSupabase();
    sb.seed("ft_clients", TEMPLATES_ID, { id: TEMPLATES_ID, name: "Templates", kind: "templates", templatesVersion: 3, folders: [{ id: "f1", name: "Strength", parent: null, kind: "folder", at: AT }], builtinsAdopted: 1 });
    sb.seed("ft_trainings", TP, { id: TP, clientId: TEMPLATES_ID, title: "Upper A", date: "2026-01-01", createdAt: AT, completedAt: null, skippedAt: null, template: { program: "My templates", phase: 0, stage: 0, n: 1, folder: "f1" }, rows: [] });   // (no exercises yet: its page draws on these stand-ins)
    sb.seed("ft_clients", ALEX, { id: ALEX, name: "Alex Sample", unit: "lb" });
    app.set({ sb, signedIn: true, clientMode: false, backend: fns.cloudBackend, sessionEmail: "coach@x.com", view: { name: "clients" }, templateDraft: null });
    await sync();
    app.set({ view: { name: "training", id: TP } }); fns.render();       // Upper A's page
    byId.get("useBtn").fire("click", { detail: 1 });                       // Use: the clients to give it to
    const row = pick.children.find((li) => li.children && li.children[0]); if (row) row.children[0].fire("click", { detail: 1 });   // Alex: her days
    await tick(400);                                                       // (past the days' first 350 ms, when a tap picks nothing)
    const dp = fns.datePicker(), log = { opened: dp ? dp.title : null };
    const page = dp && grid.firstElementChild && grid.firstElementChild.children[dp.months.indexOf(dp.month)], b = page && page.children.find((x) => !x.disabled && x.children && x.children[0] && String(x.children[0].textContent) === day);
    const ev = (type) => ({ type, isPrimary: true, pointerType, pointerId: 7, button: 0, buttons: type === "pointerdown" ? 1 : 0, clientX: 120, clientY: 300, timeStamp: performance.now(), detail: 1, stopped: false, stopPropagation() { this.stopped = true; }, preventDefault() {} });
    grid.fire("pointerdown", ev("pointerdown"));                           // the press on today, held
    if (how !== "a finger, nothing deleted") { sb.tables.ft_trainings.delete(TP); await sync(); }   // meanwhile the iPad's Delete template, and the sync that finds it gone
    const v = app.get().view; log.during = { view: [v.name, v.folder || null], picker: !!fns.datePicker() };
    grid.fire("pointerup", ev("pointerup"));                               // the lift, then its click on the day (the grid's capture listener first)
    const c = ev("click"); if (b) { grid.fire("click", c); if (!c.stopped) b.fire("click", c); }
    await settle(); await tick(50); await settle();
    const w = app.get().view, now = w.name === "training" ? maps.trainings.get(w.id) : null; log.after = { view: [w.name, w.folder || null], picker: !!fns.datePicker(), on: now ? (now.clientId === ALEX ? "Alex's " : "") + now.title : null };   // on: the workout whose page is up
    log.made = [...maps.trainings.values()].filter((t) => t.clientId === ALEX).map((t) => t.title);
    log.server = [...sb.tables.ft_trainings.values()].filter((t) => t.data.clientId === ALEX).map((t) => t.data.title);
    if (fns.datePicker()) fns.closeDatePicker();
    out[how] = log;
  }
  console.log(JSON.stringify(out)); process.exit(0);
}
test("Use on a template's page, Alex picked, a finger (or the mouse) pressed on one of her days: a sync finding the template deleted on the iPad during the press takes the page to the template's folder, and the lift that follows makes nothing for Alex, here or on the server; with nothing deleted, the same press makes Upper A for her (the twenty-fifth check round, R25-DRF-3: the days waited for the finger, and the lift made Upper A for Alex from the deleted template, opened it and saved it)", () => {
  const dir = path.dirname(fileURLToPath(import.meta.url));
  const out = execFileSync(process.execPath, ["--input-type=module", "-e", "(" + useHeldProbe.toString() + ")(" + JSON.stringify(dir) + ");"], { encoding: "utf8", timeout: 90000 });
  const r = JSON.parse(out.trim().split("\n").pop());
  assert.deepStrictEqual(r["a finger, nothing deleted"], { opened: "Add to Alex Sample", during: { view: ["training", null], picker: true }, after: { view: ["training", null], picker: false, on: "Alex's Upper A" }, made: ["Upper A"], server: ["Upper A"] }, "with nothing deleted, the press on today makes Upper A for Alex, opens it and saves it (so the harness can make one)");
  for (const how of ["a finger", "the mouse"]) assert.deepStrictEqual(r[how], { opened: "Add to Alex Sample", during: { view: ["client", "f1"], picker: true }, after: { view: ["client", "f1"], picker: false, on: null }, made: [], server: [] }, how + ": the sync during the press takes the page to Strength (the days wait for the lift); the lift makes nothing for Alex from the deleted template, and the page stays on Strength");
});
// R25-DRF-4: a swipe back under way on the template's page when a sync found it deleted: draftGone took the page to its folder (Back's own step),
// and the swipe, let go past half, then took its own Back as well (r25-swipe-gone-probe.mjs).
test("the swipe back under way on Upper A's page (the iPhone home-screen app's edge swipe, or a Mac's two fingers), reached from the Clients list through Templates and Strength, when a sync finds Upper A deleted on the iPad: the page goes to Strength at once, and letting go past half leaves it there, its own step, Strength kept as the page to open on; one more Back goes to Templates. A swipe with nothing deleted lands on Strength the same, and so does a short one let go early (the twenty-fifth check round, R25-DRF-4: the swipe then took its own Back too, one page too far: the Templates list, kept as the page to open on, and the next Back left for the Clients list)", () => {
  const dir = path.dirname(fileURLToPath(import.meta.url));
  const r = JSON.parse(execFileSync(process.execPath, [path.join(dir, "r25-swipe-gone-probe.mjs")], { encoding: "utf8", timeout: 90000 }).trim().split("\n").pop());
  const land = { page: "Strength", sliding: false, depth: 0, kept: "Strength" }, back = { page: "Templates", depth: -1 };
  assert.deepStrictEqual(r.swiped, { page: "Upper A", draft: true, after: land, back }, "nothing deleted: the swipe back from Upper A lands on Strength, its step, kept as the page to open on; one more Back goes to Templates");
  for (const [k, w, page] of [["gone", "the edge swipe, nothing typed", "Upper A"], ["goneTyped", "the edge swipe, a name typed", "Upper A1"], ["goneShort", "a short edge swipe, let go early", "Upper A"], ["goneTrackpad", "a Mac's two fingers", "Upper A"]]) {
    assert.deepStrictEqual({ page: r[k].page, draft: r[k].draft, during: r[k].during }, { page, draft: true, during: { page: "Strength", sliding: true, depth: 0, kept: "Strength" } }, w + ": the sync that finds Upper A gone puts the page on Strength while the page is still sliding");
    assert.deepStrictEqual({ after: r[k].after, back: r[k].back }, { after: land, back }, w + ": let go, the page stays on Strength (its own step, kept as the page to open on), and one more Back goes to Templates (it went to " + r[k].after.page + ", then " + r[k].back.page + ")");
  }
});
// R25-DRF-5: round 24 lets the name box he clicked into (nothing typed) take a rename that comes in, but writing the new name collapsed his
// selection to its end, so the letters he typed next went after the rename (r25-name-box-probe.mjs).
test("the coach clicks into the name box on his Mac (Upper A's page, or Alex's Legs) and, before his first letter, a sync brings his iPad's rename: a whole name selected with Cmd+A stays selected over the new name, so what he types replaces it (Legs, Push); a caret after Upper (or before Legs) stays where he put it, so his word goes there; a caret at the end goes to the new end (round 24's case); and each is what Save sends to the server (the twenty-fifth check round, R25-DRF-5: the selection collapsed to the end, and Upper A (iPad)Legs, Legs (iPad)Push or Upper A (iPad)Body was saved)", () => {
  const dir = path.dirname(fileURLToPath(import.meta.url));
  const r = JSON.parse(execFileSync(process.execPath, [path.join(dir, "r25-name-box-probe.mjs")], { encoding: "utf8", timeout: 90000 }).trim().split("\n").pop());
  const got = {}; for (const [k, v] of Object.entries(r)) got[k] = k === "rejected" ? v : { drawn: v.drawn, before: v.before, heard: v.heard, typed: v.typed, here: v.here, server: v.server };
  const way = (drawn, before, box, sel, typed) => ({ drawn, before, heard: { box, sel, focused: true }, typed, here: typed, server: typed });
  assert.deepStrictEqual(got, {
    template_all: way("Upper A", [0, 7], "Upper A (iPad)", [0, 14], "Legs"),
    template_word: way("Upper A", [6, 6], "Upper A (iPad)", [6, 6], "Upper Body A (iPad)"),
    template_end: way("Upper A", [7, 7], "Upper A (iPad)", [14, 14], "Upper A (iPad)x"),
    workout_all: way("Legs", [0, 4], "Legs (iPad)", [0, 11], "Push"),
    workout_start: way("Legs", [0, 0], "Legs (iPad)", [0, 0], "Easy Legs (iPad)"),
    workout_end: way("Legs", [4, 4], "Legs (iPad)", [11, 11], "Legs (iPad)x"),
    rejected: [],
  }, "the rename came into the box, but his selection or caret went to its end: what he typed joined the rename instead of replacing it or going where he put the caret");
});
