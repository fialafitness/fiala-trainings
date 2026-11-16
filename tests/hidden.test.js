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
  assert.ok(src.includes("adjust: carry ? (parseInt(c.plan.adjust, 10) || 0) - carried : 0"), "the switch on the card uses it");
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
