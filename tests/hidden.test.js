// The audit of 15 Nov 2026, its smaller hidden fixes (#10, #18, #22): what the coach's card counts after a package switch, a rename that
// stays renamed, and the card's summaries. The Health wheel (#17) plays in wheel-probe.mjs, the plan's last day in Hawaii (#22) in
// plan-end-probe.mjs, the missed filing (#22) in missed.test.js.
import fs from "node:fs";
import { test, assert, tick } from "./assert.js";
import { makeSupabase } from "./fake-supabase.js";
import { load } from "./load.js";
import { carryOver, planProgress, TEMPLATES_ID } from "../app/model.js";
const app = await load();
const { fns, maps } = app;
const src = fs.readFileSync(new URL("../app/main.js", import.meta.url), "utf8");
const settle = async () => { const until = Date.now() + 15000; do await tick(5); while ((app.get().inflight > 0 || maps.timers.size) && Date.now() < until); };

test("(#10) a package switch goes on from the open package: a finished 10 moved to a 20 starts at 0 of 20, 23 used at 3 of 20, 7 of 10 at 7 of 20", () => {
  const done = (n) => Array.from({ length: n }, (_, i) => ({ id: "t" + i, inPerson: true, completedAt: "2026-11-0" + ((i % 9) + 1) + "T18:00:00.000Z", date: "2026-11-0" + ((i % 9) + 1) }));
  const ten = { kind: "sessions", size: 10, startedOn: "2026-10-01", adjust: 0 };
  for (const [used, left] of [[10, 0], [23, 3], [7, 7], [0, 0]]) {
    const list = done(used), twenty = { ...ten, size: 20, adjust: -carryOver(ten, list) };
    const p = planProgress(twenty, list);
    assert.strictEqual(p.inPack, left, used + " used: " + left + " of 20"); assert.strictEqual(p.left, 20 - left);
  }
  const model = fs.readFileSync(new URL("../app/model.js", import.meta.url), "utf8");
  assert.ok(model.includes("adjust: carry ? (parseInt(old.adjust, 10) || 0) - carried : 0") && src.includes("sw = planSwitch(c, pk, clientTrainings(c.id), today());") && model.includes("else plan = nextPlan(old, pk, list, todayIso);"), "the switch on the card uses it (v312: through model.js's planSwitch and nextPlan)");
});

test("v312: Sessions is the session package's own count with the finished packages it carried over, through any switch (the owner's ask: \"fix that as well\"); a mis-pick put right the same day comes back exactly as it was", async () => {
  const { nextPlan, planSwitch, sessionsTotal } = await import("../app/model.js");
  const marks = (n) => Array.from({ length: n }, (_, i) => ({ id: "m" + i, inPerson: true, completedAt: "2026-11-0" + ((i % 9) + 1) + "T18:00:00.000Z", date: "2026-11-0" + ((i % 9) + 1) }));
  const ten = { id: "p10", name: "10 sessions", kind: "sessions", size: 10 }, twenty = { id: "p20", name: "20 sessions", kind: "sessions", size: 20 }, month = { id: "pm", name: "4 weeks", kind: "monthly" };
  let c = { plan: { ...ten, startedOn: "2026-10-01", adjust: 8 } }, list = marks(5);   // 8 sessions on paper before the app, 5 marked In person: package 2, 3 of 10
  assert.deepStrictEqual([sessionsTotal(c, list, "2026-11-16").n, planProgress(c.plan, list).inPack], [13, 3]);
  c = { plan: nextPlan(c.plan, twenty, list, "2026-11-16") };   // switched to a 20: the open package goes on, 3 of 20
  assert.deepStrictEqual([c.plan.adjust, c.plan.carried, planProgress(c.plan, list).inPack, sessionsTotal(c, list, "2026-11-16").n], [-2, 10, 3, 13], "still 13 with you");
  list = marks(12); c = { plan: nextPlan(c.plan, ten, list, "2026-11-20") };   // 7 more, then back to a 10 another day
  assert.deepStrictEqual([sessionsTotal(c, list, "2026-11-20").n, planProgress(c.plan, list).inPack], [20, 10], "12 marks and the 8 on paper, through two switches");
  const hist = { planHistory: [{ ...c.plan, endedOn: "2026-11-20" }], plan: nextPlan(c.plan, month, list, "2026-11-20") };   // onto a monthly plan: the package goes on record
  assert.deepStrictEqual([hist.plan.kind, sessionsTotal(hist, list, "2026-11-20").n], ["monthly", 20], "the last package on record still counts");
  const minus = { plan: { ...ten, startedOn: "2026-10-01", adjust: -1 } };
  assert.deepStrictEqual([sessionsTotal(minus, marks(5), "2026-11-16").n, planProgress(minus.plan, marks(5)).inPack], [4, 4], "a session counted by mistake taken off with Change -1: off the package and off Sessions (the owner's way of working)");
  assert.strictEqual(sessionsTotal({ plan: { ...ten, startedOn: "2026-10-01", adjust: -10 } }, marks(5), "2026-11-16").n, 0, "never below zero");
  assert.strictEqual(sessionsTotal({ planHistory: [{ ...ten, startedOn: "2026-10-01", adjust: -10, endedOn: "2026-11-15" }], plan: { ...month } }, marks(5), "2026-11-16").n, 5, "a package on record never reads below the marks (a switch before v312 kept no carried)");
  const restored = { plan: { ...ten, startedOn: "2026-12-01", adjust: 7 }, planHistory: [{ ...ten, startedOn: "2026-10-01", adjust: 0, endedOn: "2026-11-16" }] };
  assert.strictEqual(sessionsTotal(restored, marks(7), "2026-12-01").n, 7, "a package's progress put back by hand with Change counts once (the last check: it counted twice)");
  const p10 = { ...ten, startedOn: "2026-10-01", adjust: 8 }, wrong = planSwitch({ plan: p10 }, month, marks(5), "2026-11-16");   // the monthly picked by mistake
  const right = planSwitch({ plan: wrong.plan, planHistory: wrong.planHistory }, ten, marks(5), "2026-11-16");   // and the 10 put back the same day
  assert.deepStrictEqual([right.plan, right.planHistory.map((h) => h.kind), sessionsTotal({ plan: right.plan, planHistory: right.planHistory }, marks(5), "2026-11-16").n, planProgress(right.plan, marks(5)).inPack],
    [p10, ["monthly"], 13, 3], "a mis-pick put right through a monthly plan comes back exactly as it was: 3 of 10, still 13 with you, no Change needed");
  const later = planSwitch({ plan: wrong.plan, planHistory: wrong.planHistory }, ten, marks(5), "2026-11-20");
  assert.deepStrictEqual([later.plan.startedOn, later.plan.adjust, later.planHistory.length], ["2026-11-20", 0, 2], "put back another day: a new package, as before");
  const p20 = { ...twenty, startedOn: "2026-10-01", adjust: 0 }, mis = planSwitch({ plan: p20 }, ten, marks(13), "2026-11-16");   // a 20 at 13 of 20, a 10 picked by mistake
  assert.deepStrictEqual([planProgress(mis.plan, marks(13)).inPack, mis.planHistory], [3, null], "a switch between packages goes on record nowhere");
  const back = planSwitch({ plan: mis.plan }, twenty, marks(13), "2026-11-16");
  assert.deepStrictEqual([planProgress(back.plan, marks(13)).inPack, sessionsTotal({ plan: back.plan }, marks(13), "2026-11-16").n], [3, 13], "the 20 put back through another package: the card reads the open package, as v311 (3 of 20; a known limit), and Sessions stays 13 through carried");
  const m0 = { ...month, startedOn: "2026-11-01", until: "2026-11-29" }, mm = planSwitch({ plan: m0 }, ten, [], "2026-11-16"), mb = planSwitch({ plan: mm.plan, planHistory: mm.planHistory }, month, [], "2026-11-16");
  assert.deepStrictEqual([mb.plan, mb.planHistory.map((h) => h.id)], [m0, ["p10"]], "a monthly plan put back the same day keeps its last day");
  assert.ok(fns.validateBackup({ app: "fiala-trainings", clients: { "1b4e28ba-2fa1-41d2-883f-0016d3cca427": { id: "1b4e28ba-2fa1-41d2-883f-0016d3cca427", name: "A", plan: { ...back.plan, carried: 10 } } }, trainings: {} }) !== false);
});

test("v312, after the final checks: a plan put back the same day comes back exactly through None too; a Change on the package picked is kept when the package left is picked back (as v311); a session taken off a package at 0 of 20 that carried a finished 10 reads 9; with no package now, the most a package on record counts, never below the marks", async () => {
  const { planSwitch, sessionsTotal } = await import("../app/model.js");
  const marks = (n) => Array.from({ length: n }, (_, i) => ({ id: "m" + i, inPerson: true, completedAt: "2026-11-0" + ((i % 9) + 1) + "T18:00:00.000Z", date: "2026-11-0" + ((i % 9) + 1) }));
  const P = (id, kind, size) => ({ id, name: id, kind, size }), ten = P("p10", "sessions", 10), twenty = P("p20", "sessions", 20), month = P("pm", "monthly");
  const D = "2026-11-16", run = (c, picks, list = marks(5)) => picks.reduce((st, pk) => { const sw = typeof pk === "function" ? { plan: pk(st.plan), planHistory: null } : planSwitch(st, pk, list, D); return { plan: sw.plan, planHistory: sw.planHistory ? (sw.planHistory.length ? sw.planHistory : undefined) : st.planHistory }; }, c);
  const p10 = { ...ten, startedOn: "2026-10-01", adjust: 8 };
  const viaNone = run({ plan: p10 }, [null, ten]); assert.deepStrictEqual([viaNone.plan, viaNone.planHistory], [p10, undefined], "None by mistake, then the 10: exactly as it was, nothing on record");
  const minus = (p) => ({ ...p, adjust: p.adjust - 1 }), kept = run({ plan: p10 }, [twenty, minus, ten]);
  assert.deepStrictEqual([planProgress(kept.plan, marks(5)).inPack, sessionsTotal(kept, marks(5), D).n], [2, 12], "a session taken off on the 20, then the 10 back: kept (2 of 10, Sessions 12), as v311");
  const atZero = { plan: { ...twenty, startedOn: "2026-10-01", adjust: -6, carried: 10 } };
  assert.deepStrictEqual([planProgress(atZero.plan, marks(5)).inPack, sessionsTotal(atZero, marks(5), D).n], [0, 9], "the card stays at 0 of 20 and Sessions takes the session off (the checks: it stayed at 10)");
  const noneDay = { plan: null, planHistory: [{ ...p10, endedOn: "2026-11-01" }] }, slip = run(noneDay, [ten, null]);   // no plan, the last package on record (13 with you); a package picked by mistake and None put back
  assert.deepStrictEqual([sessionsTotal(noneDay, marks(5), D).n, sessionsTotal(slip, marks(5), D).n], [13, 13], "the package picked and left the same day goes on record, and Sessions still reads 13 (the checks: it fell to the marks)");
  assert.deepStrictEqual([sessionsTotal(noneDay, [], D).n, sessionsTotal({ plan: { ...month, startedOn: "2026-10-01", until: "2026-10-29" }, planHistory: noneDay.planHistory }, [], D).n], [0, 0], "a paused or lapsed client's phone, sent no workouts: no package on record counts alone (the final check: it read 8, the corrections alone), as v311");
  assert.doesNotThrow(() => planSwitch({ plan: { ...p10, prev: "x" }, planHistory: [null, 3, { id: "p5", endedOn: D }] }, twenty, marks(5), D));
});

test("(#22) the card's Health & safety summary is the first point of what was written: never cut inside a number, never after Dr.", () => {
  const s = (limits) => fns.safetySummary({ health: { limits } });
  assert.strictEqual(s("1.5 lb max on the left shoulder"), "1.5 lb max on the left shoulder");
  assert.strictEqual(s("Dr. Kim: no overhead pressing"), "Dr. Kim");
  assert.strictEqual(s("Left knee, right hip"), "Left knee");
  assert.strictEqual(s("Left knee. Avoid deep squats"), "Left knee");
  assert.strictEqual(s("Left knee\nRight hip"), "Left knee");
  assert.strictEqual(fns.safetySummary({ health: { pregnant: true, conditions: "Asthma; mild" } }), "Pregnant · Asthma");
});

test("(#22) an emergency number written with the trunk zero, +44 (0)20 …, calls the number without it", () => {
  assert.strictEqual(fns.phoneIn("Mum +44 (0)20 7946 0958"), "442079460958");
  assert.strictEqual(fns.phoneIn("+44(0)20 7946 0958"), "442079460958");
  assert.strictEqual(fns.phoneIn("+44 20 7946 0958"), "442079460958", "written without it: as before");
});

test("(#18) a renamed exercise stays renamed: on a workout whose save meets the client's newer copy, and on the last template opened", async () => {
  {
    const sb = makeSupabase(); app.reset(); app.set({ sb, signedIn: true, clientMode: false, backend: fns.cloudBackend, syncedOnce: true });
    maps.hiddenKeys.clear(); maps.customNames.clear(); maps.customVideos.clear(); fns.refreshNames();
    maps.clients.set("c1", { id: "c1", name: "Jane", unit: "lb" });
    const doc = { id: "T", clientId: "c1", title: "Arms", date: fns.today(), createdAt: "2026-11-01T10:00:00.000Z", completedAt: null, skippedAt: null, rows: [{ id: "r1", label: "1", name: "Tricep pushdown", sets: 3, reps: "10", weights: [], repsDone: [], setsDone: 0, alts: [] }] };
    sb.seed("ft_trainings", "T", doc, { client_id: "c1" }); maps.trainings.set("T", JSON.parse(JSON.stringify(doc))); maps.seenAt.set("trainings/T", "S0");
    const srv = sb.tables.ft_trainings.get("T"); srv.data.rows[0].weights = ["40"]; srv.data.rows[0].repsDone = ["10"]; srv.data.rows[0].setsDone = 1;   // the client logged a set since his last read
    await fns.renameExercise("triceppushdown", "Tricep pushdown", "Cable pushdown"); await settle();
    const s = sb.tables.ft_trainings.get("T").data.rows[0];
    assert.strictEqual(s.name, "Cable pushdown"); assert.strictEqual(maps.trainings.get("T").rows[0].name, "Cable pushdown"); assert.deepStrictEqual(s.weights, ["40"], "and her set stays");
  }
  {
    const sb = makeSupabase(); app.reset(); app.set({ sb, signedIn: true, clientMode: false, backend: fns.cloudBackend, syncedOnce: true });
    maps.hiddenKeys.clear(); maps.customNames.clear(); maps.customVideos.clear(); fns.refreshNames();
    maps.clients.set(TEMPLATES_ID, { id: TEMPLATES_ID, name: "Templates", kind: "templates" });
    const tdoc = { id: "P", clientId: TEMPLATES_ID, title: "Day 1", date: "2026-01-01", createdAt: "2026-01-01T10:00:00.000Z", completedAt: null, skippedAt: null, rows: [{ id: "r1", label: "1", name: "Tricep pushdown", sets: 3, reps: "10", weights: [], repsDone: [], alts: [] }] };
    sb.seed("ft_trainings", "P", tdoc, { client_id: TEMPLATES_ID }); maps.trainings.set("P", JSON.parse(JSON.stringify(tdoc))); maps.seenAt.set("trainings/P", sb.tables.ft_trainings.get("P").updated_at);
    app.set({ templateDraft: { id: "P", snapshot: JSON.stringify(maps.trainings.get("P")), dirty: false, saving: false } });   // the clean draft its page leaves behind
    await fns.renameExercise("triceppushdown", "Tricep pushdown", "Cable pushdown"); await settle();
    assert.strictEqual(sb.tables.ft_trainings.get("P").data.rows[0].name, "Cable pushdown", "saved, not parked");
    assert.strictEqual(app.get().templateDraft.dirty, false, "no Unsaved changes on the template");
  }
  app.reset();
});

test("(#22) History files a workout skipped ahead of its day under today, the day it was decided, and a lapsed plan is judged by the server's Los Angeles day too", () => {
  assert.ok(src.includes("const week = rest.filter((t) => hday(t) >= mondayIso), older = rest.filter((t) => hday(t) < mondayIso);"));
  const sync = fs.readFileSync(new URL("../app/sync.js", import.meta.url), "utf8");
  assert.ok(sync.includes("planActive(me.data && me.data.plan, today()) && planActive(me.data && me.data.plan, laToday())"));
});
