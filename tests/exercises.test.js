import { test, assert } from "./assert.js";
import { makeSupabase } from "./fake-supabase.js";
import { load } from "./load.js";
const app = await load();
const { fns, maps } = app;
const coach = () => { const sb = makeSupabase(); app.reset(); app.set({ sb, signedIn: true, clientMode: false, backend: fns.cloudBackend }); maps.hiddenKeys.clear(); maps.customNames.clear(); maps.customVideos.clear(); fns.refreshNames(); return sb; };
const ops = (sb, table) => sb.log.filter((l) => l.table === table).map((l) => l.op);

test("renaming a built-in to a new spelling with the same key is his spelling of it: no hiding, one custom row, the list shows the new name once", async () => {
  const sb = coach();
  assert.ok(fns.allNames().includes("Tricep pushdown"));
  assert.strictEqual(await fns.renameExercise("triceppushdown", "Tricep pushdown", "Tricep push-down"), true);
  assert.deepStrictEqual(ops(sb, "ft_exercise_hidden"), []);
  assert.deepStrictEqual(ops(sb, "ft_exercises"), ["upsert"]);
  const names = fns.allNames(); assert.ok(names.includes("Tricep push-down")); assert.ok(!names.includes("Tricep pushdown"));
  assert.ok(!names.includes("Tricep push-down") || names.indexOf("Tricep push-down") === names.lastIndexOf("Tricep push-down"), "once");
});
test("renaming a built-in to a different key hides the built-in, adds his name, carries the built-in video and renames the workouts", async () => {
  const sb = coach();
  maps.trainings.set("t1", { id: "t1", clientId: "c1", date: "2026-10-01", rows: [{ id: "r1", name: "Tricep pushdown", alts: ["Tricep kickback"] }] });
  assert.strictEqual(await fns.renameExercise("triceppushdown", "Tricep pushdown", "Cable pushdown"), true);
  assert.ok(maps.hiddenKeys.has("triceppushdown")); assert.ok(!fns.allNames().includes("Tricep pushdown")); assert.ok(fns.allNames().includes("Cable pushdown"));
  assert.ok(ops(sb, "ft_exercise_hidden").includes("upsert")); assert.ok(ops(sb, "ft_exercise_videos").includes("upsert"), "the built-in video follows the name");
  assert.ok(fns.videoForName("Cable pushdown"), "the renamed exercise still has its video");
  assert.strictEqual(maps.trainings.get("t1").rows[0].name, "Cable pushdown");
  assert.ok(!fns.knownName("Tricep pushdown"), "the old built-in is no longer a known name");
});
test("renaming onto another built-in's spelling merges into it and brings it back if it was hidden", async () => {
  const sb = coach(); maps.hiddenKeys.add("tricepkickback"); fns.refreshNames();
  assert.ok(!fns.allNames().includes("Tricep kickback"));
  assert.strictEqual(await fns.renameExercise("triceppushdown", "Tricep pushdown", "Tricep kickback"), true);
  assert.ok(!maps.hiddenKeys.has("tricepkickback")); assert.ok(maps.hiddenKeys.has("triceppushdown"));
  assert.ok(fns.allNames().includes("Tricep kickback")); assert.deepStrictEqual(ops(sb, "ft_exercises"), [], "no custom row for a built-in spelling");
});
test("deleting a built-in hides it; adding the same name again brings it back instead of making a custom copy", async () => {
  const sb = coach();
  assert.strictEqual(await fns.deleteExercise("tricepdip", "Tricep dip"), true);
  assert.ok(maps.hiddenKeys.has("tricepdip")); assert.ok(!fns.allNames().includes("Tricep dip"));
  assert.strictEqual(await fns.addCustomName("Tricep dip"), true);
  assert.ok(!maps.hiddenKeys.has("tricepdip")); assert.ok(fns.allNames().includes("Tricep dip")); assert.deepStrictEqual(ops(sb, "ft_exercises"), []);
});
test("deleting one of his own exercises removes the row and its video; a custom spelling of a built-in also hides the built-in", async () => {
  const sb = coach(); maps.customNames.set("myspecialmove", "My special move"); maps.customVideos.set("my special move", "abc"); fns.refreshNames();
  assert.strictEqual(await fns.deleteExercise("myspecialmove", "My special move"), true);
  assert.ok(!maps.customNames.has("myspecialmove")); assert.ok(!maps.customVideos.has("my special move")); assert.ok(ops(sb, "ft_exercises").includes("delete"));
  maps.customNames.set("triceppushdown", "Tricep push-down"); fns.refreshNames();
  assert.strictEqual(await fns.deleteExercise("triceppushdown", "Tricep push-down"), true);
  assert.ok(maps.hiddenKeys.has("triceppushdown")); assert.ok(!fns.allNames().includes("Tricep pushdown")); assert.ok(!fns.allNames().includes("Tricep push-down"));
});
test("the old spelling still finds the exercise: 'triceps' is an alias of every tricep name", async () => {
  const { ALIASES, NAMES } = await import("../app/catalog.js");
  assert.strictEqual(NAMES.filter((n) => /triceps/i.test(n)).length, 0);
  assert.strictEqual(ALIASES["Triceps pushdown"], "Tricep pushdown"); assert.strictEqual(ALIASES["Triceps dips"], "Tricep dip");
  const keys = new Set(NAMES.map((n) => n.toLowerCase().replace(/[^a-z0-9]+/g, ""))); assert.strictEqual(keys.size, NAMES.length, "no two names share a key");
});
