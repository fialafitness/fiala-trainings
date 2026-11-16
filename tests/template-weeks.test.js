// His ask, 12 Nov: "In templates phases have stages I believe ... rename every stage to week". What the coach reads says Week: a phase's tabs
// and the From template pill's path. The data keeps its "stage", so every template, and every account seeded from them, stays as it was.
import fs from "node:fs";
import { test, assert } from "./assert.js";
import { load } from "./load.js";
const app = await load();
const { fns } = app;
const src = fs.readFileSync(new URL("../app/main.js", import.meta.url), "utf8");

test("the From template pill's path says Week, never Stage; no week where the template has none", () => {
  assert.strictEqual(fns.templatePath({ title: "Legs", template: { program: "Fat Burn", phase: 1, stage: 2, n: 3 } }), "Fat Burn · Phase 1 · Week 2 · Workout 3");
  assert.strictEqual(fns.templatePath({ title: "Legs", template: { program: "My templates", phase: 0, stage: 0, n: 0 } }), "My templates · Legs");
});

test("a phase's tabs say Week 1, Week 2 …; nothing in the app's words says Stage", () => {
  assert.ok(src.includes('b.textContent = "Week " + s;'), "the tabs");
  assert.ok(!/"[^"\n]*\bStage\b[^"\n]*"/.test(src), "no Stage left in a string the coach could read");
});
