// Run by finish-early.test.js in its own process. Finishing a workout puts up the "Nice work" screen, which only its own button takes
// down (a listener the shared stand-in drops), so in the shared process every later page would draw as that screen. Here the real
// app/main.js finishes workouts for good. It plays Finish early's question (his ask, 12 Nov) in the coach's view, the client's and the
// coach's Client view, both answers, a sync or Back while it is up, Finish workout with every exercise done (no question), and the next
// Delete question in red again. It prints, as JSON, what each one did.
import { byId, el } from "./env.js";
import { load } from "./load.js";
const H = {};                                                            // the sheet's two buttons keep their listeners here
for (const id of ["askYes", "askNo"]) {
  const b = el("button");
  b.addEventListener = (t, fn) => { (H[id] ||= []).push(fn); };
  b.removeEventListener = (t, fn) => { H[id] = (H[id] || []).filter((f) => f !== fn); };
  byId.set(id, b);
}
const app = await load();
const { fns, maps } = app;
const $ = (id) => document.getElementById(id);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const answer = (id) => { for (const fn of [...(H[id] || [])]) fn({}); };
const row = (id, done) => ({ id, label: id, name: "Squat", sets: 3, reps: "8", tempo: "", rest: "", weights: [], repsDone: [], setsDone: done ? 3 : 0, done, note: "" });
function open({ client = false, preview = false, rows, extra = {} }) {
  for (const t of maps.timers.values()) clearTimeout(t); maps.timers.clear();
  app.reset(); fns.setPreview(preview);
  app.set({ signedIn: true, clientMode: client, myClientId: client ? "c1" : null, tab: "workouts" });
  maps.clients.set("c1", { id: "c1", name: "Jane", unit: "lb" });
  maps.trainings.set("w1", { id: "w1", clientId: "c1", title: "Legs", date: fns.today(), createdAt: "2026-11-01T10:00:00.000Z", completedAt: null, skippedAt: null, rows, ...extra });
  app.set({ view: { name: "training", id: "w1" }, renderedTraining: null });
  $("askSheet").hidden = true;                                           // as the markup has it
  fns.paintFinish(maps.trainings.get("w1"));
  return maps.trainings.get("w1");
}
const paint = () => ({ label: $("finishBtn").textContent, quiet: $("finishBtn").classList.contains("tint") && $("finishBtn").classList.contains("soft"), split: $("finishWrap").classList.contains("split") });
const sheet = () => ({ up: !$("askSheet").hidden, title: $("askTitle").textContent, text: $("askText").textContent, yes: $("askYes").textContent, red: $("askYes").classList.contains("danger") });
const state = () => { const t = maps.trainings.get("w1"); return { finished: !!t.completedAt, by: t.completedBy || null, queued: maps.pendingFinish.has("w1") }; };
const out = {};
async function tap(plan) {                                               // Finish: "no" answers Cancel, "yes" Finish early (once the button is armed), a function changes something first
  const p = fns.finishTap(); await wait(0);
  const seen = sheet();
  if (seen.up) {
    if (plan === "no") answer("askNo");
    else { await wait(400); if (typeof plan === "function") await plan(); answer("askYes"); }
  }
  if (!$("askSheet").hidden) answer("askNo");                             // a question still up (an app that asks where it should not): let go, so the probe ends
  await p;
  return seen;
}

// the coach's own view, one of two done: Cancel keeps it open; Finish early finishes it
open({ rows: [row("1", true), row("2", false)] });
out.coachPaint = paint();
out.coachAsk = await tap("no");
out.coachCancel = { ...state(), up: !$("askSheet").hidden };
await tap("yes");
out.coachYes = { ...state(), up: !$("askSheet").hidden, paint: paint() };

// the client's own view, nothing done yet
open({ client: true, rows: [row("1", false), row("2", false)] });
out.clientPaint = paint();
out.clientAsk = await tap("yes");
out.clientYes = state();

// the coach's Client view, four of five done
open({ preview: true, rows: [row("1", true), row("2", true), row("3", true), row("4", true), row("5", false)] });
out.previewPaint = paint();
out.previewAsk = await tap("no");
out.previewCancel = state();

// a superset is one card (Exercise 2 · Superset): 1 done, 2a done but 2b not, 3 not
open({ rows: [row("1", true), row("2a", true), row("2b", false), row("3", false)] });
out.supersetAsk = await tap("no");

// every exercise done: Finish workout, across the row, no question
open({ rows: [row("1", true), row("2", true)] });
out.allDonePaint = paint();
out.allDone = { asked: (await tap("yes")).up, ...state() };

// finished meanwhile while the question is up: the answer adds nothing
open({ rows: [row("1", false)] });
await tap(() => { const t = maps.trainings.get("w1"); t.completedAt = "2026-11-12T08:00:00.000Z"; t.completedBy = "client"; });
out.finishedMeanwhile = { at: maps.trainings.get("w1").completedAt, by: maps.trainings.get("w1").completedBy };

// another workout's page by the time of the answer: neither workout is finished
open({ rows: [row("1", false)] });
maps.trainings.set("w2", { id: "w2", clientId: "c1", title: "Arms", date: fns.today(), createdAt: "2026-11-01T10:00:00.000Z", completedAt: null, skippedAt: null, rows: [row("1", false)] });
await tap(() => { app.set({ view: { name: "training", id: "w2" } }); });
out.otherPage = { w1: !!maps.trainings.get("w1").completedAt, w2: !!maps.trainings.get("w2").completedAt };

// a skipped workout has nothing to finish
open({ rows: [row("1", false)], extra: { skippedAt: "2026-11-11T08:00:00.000Z" } });
out.skippedPaint = paint();
out.skipped = { asked: (await tap("yes")).up, ...state() };

// the next question that deletes is red again, with its own word
open({ rows: [row("1", false)] });
const del = fns.askFirst({ title: "Delete this workout?" }); await wait(0);
out.deleteAfter = sheet();
answer("askNo"); await del;

process.stdout.write(JSON.stringify(out) + "\n");
process.exit(0);
