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

test("an old spelling is the exercise it names: known, not addable, resolved by the editor; and the search still finds it", async () => {
  const sb = coach();
  assert.strictEqual(fns.knownName("Triceps pushdown"), true); assert.strictEqual(fns.properName(" Triceps  pushdown "), "Tricep pushdown");
  assert.strictEqual(fns.knownName("triceps pushdown"), true); assert.strictEqual(fns.properName("triceps push-down"), "Tricep pushdown");   // however typed
  assert.strictEqual(fns.properName("Band face pull"), "Band face pull", "a real name stays itself even when an alias shares its key");
  assert.strictEqual(await fns.addCustomName("Triceps pushdown"), true); assert.deepStrictEqual(ops(sb, "ft_exercises"), [], "no duplicate row for an alias");
  assert.ok(fns.exerciseMatches("triceps pushdown").some(([n]) => n === "Tricep pushdown"));
  await fns.renameExercise("triceppushdown", "Tricep pushdown", "Tricep push-down");                          // his spelling, same key
  assert.ok(fns.exerciseMatches("triceps").some(([n]) => n === "Tricep push-down"), "the alias search shows his spelling");
});
test("renaming his spelling of a built-in to a new name keeps the built-in hidden, and a failed hide reports failure", async () => {
  const sb = coach();
  await fns.renameExercise("triceppushdown", "Tricep pushdown", "Tricep push-down");
  assert.strictEqual(await fns.renameExercise("triceppushdown", "Tricep push-down", "Cable pushdown"), true);
  assert.ok(maps.hiddenKeys.has("triceppushdown"), "the built-in must not come back"); assert.ok(!fns.allNames().includes("Tricep pushdown")); assert.ok(fns.allNames().includes("Cable pushdown"));
  const sb2 = coach(); maps.customNames.set("tricepdip", "Tricep dip!"); fns.refreshNames(); sb2.setFail({ table: "ft_exercise_hidden", times: 1, message: "Could not find the table public.ft_exercise_hidden in the schema cache" });
  assert.strictEqual(await fns.deleteExercise("tricepdip", "Tricep dip!"), false, "the built-in would have reappeared");
});
test("a rename follows every spelling of the old name in workouts, and nothing moves before the built-in has stepped aside", async () => {
  const sb = coach(); maps.customVideos.set("tricep pushdown", "mine1");
  maps.trainings.set("t1", { id: "t1", clientId: "c1", date: "2026-10-01", rows: [{ id: "r1", name: "Triceps pushdown" }, { id: "r2", name: "Triceps pushdowns", alts: ["Tricep pushdown"] }] });
  sb.setFail({ table: "ft_exercise_hidden", times: 1, message: "boom" });
  assert.strictEqual(await fns.renameExercise("triceppushdown", "Tricep pushdown", "Cable pushdown"), false);
  assert.strictEqual(maps.customVideos.get("tricep pushdown"), "mine1", "the video stays where it was"); assert.ok(!maps.customVideos.has("cable pushdown"));
  assert.strictEqual(await fns.renameExercise("triceppushdown", "Tricep pushdown", "Cable pushdown"), true);
  const rows = maps.trainings.get("t1").rows; assert.strictEqual(rows[0].name, "Cable pushdown"); assert.strictEqual(rows[1].name, "Cable pushdown"); assert.deepStrictEqual(rows[1].alts, ["Cable pushdown"]);
  assert.strictEqual(maps.customVideos.get("cable pushdown"), "mine1");
});
test("a stored 'no video' marker does not travel onto a merge target's own video", async () => {
  coach(); maps.customVideos.set("tricep pushdown", ""); 
  assert.strictEqual(await fns.renameExercise("triceppushdown", "Tricep pushdown", "Tricep kickback"), true);
  assert.ok(!maps.customVideos.has("tricep kickback")); assert.ok(fns.videoForName("Tricep kickback"), "the kickback keeps its built-in video");
});

test("a chosen subtitle is stored under the exercise key, read back, moved by a rename, and removed again", async () => {
  const sb = coach();
  assert.strictEqual(await fns.saveSub("trxrow", "underhand, to chest", null), null);
  assert.strictEqual(sb.tables.ft_exercise_subtitles.get("trxrow").subtitle, "underhand, to chest");
  maps.customSubs.clear(); await fns.loadCustomSubs(); assert.strictEqual(fns.subtitleFor("TRX row"), "underhand, to chest");
  assert.strictEqual(await fns.saveSub("trxrowwide", "wide", "trxrow"), null); assert.ok(!sb.tables.ft_exercise_subtitles.has("trxrow"), "a rename moves it"); assert.strictEqual(maps.customSubs.get("trxrowwide"), "wide");
  assert.strictEqual(await fns.deleteSub(["trxrowwide"]), null); assert.strictEqual(fns.subtitleFor("TRX row wide"), null);
});
