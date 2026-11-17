// v312, the owner's report (16 Nov 2026, twice with one client, screenshots of a tri-set in the coach's Client view): "for the last 4th set it didn't let me
// log neither weight and reps for first one or two exercises and only let me log in the last". Two exercises of the card kept 3 sets and the third had the 4 a
// new exercise starts with; the card showed 4 (the most any of them has), and on set 4 the first two had no boxes. The owner's pick after the checks (some of
// their programs give one exercise fewer sets on purpose, "only the first three sets"): an exercise keeps its own count; one put into a card takes the card's
// sets; on the card's extra set a shorter exercise says "3 sets only", and the coach (either look) can "Add set 4". The card plays in card-sets-probe.mjs.
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { test, assert } from "./assert.js";
const here = path.dirname(fileURLToPath(import.meta.url));
const r = JSON.parse(execFileSync(process.execPath, [path.join(here, "card-sets-probe.mjs")], { encoding: "utf8", timeout: 90000 }).trim().split("\n").pop());
const short = (add) => ({ boxes: false, short: "3 sets only", add }), boxes = { boxes: true, short: null, add: null };

test("the owner's tri-set (A and B with 3 sets, C with 4, sets 1 to 3 done), on set 4: A and B say \"3 sets only\" in place of nothing; the coach's views (the Client view, the coach's own look) offer \"Add set 4\", the client's app does not", () => {
  assert.deepStrictEqual(r.client, { cur: "Set 4 of 4", rows: [short(null), short(null), boxes] });
  for (const v of ["preview", "coach"]) assert.deepStrictEqual(r[v], { cur: "Set 4 of 4", rows: [short("Add set 4"), short("Add set 4"), boxes] }, v);
});

test("\"Add set 4\" gives that exercise its 4th set (opened again, saved) and its boxes; Complete last set then logs it with the others, the one left at 3 untouched", () => {
  assert.deepStrictEqual(r.added, { sets: ["a:4:open", "b:3:done", "c:4:open"], saved: true, a: boxes, b: short("Add set 4") });
  assert.deepStrictEqual([r.addedComplete, r.addedAfter], ["Complete last set →", ["a:4:4:done:18/10", "b:3:3:done:/", "c:4:4:done:BW/30"]]);
});

test("a program's exercise with fewer sets on purpose (a tri-set of 4, 4 and 3, \"only the first three sets\") keeps them: Complete last set never logs a made-up 4th set", () => {
  assert.deepStrictEqual(r.planned, { c: short(null), button: "Complete last set →", after: ["a:4:4:done:40/10", "b:4:4:done:30/10", "c:3:3:done:/"] });
});

test("after the last check: a stale \"Add set 4\" on a workout the client has just finished changes nothing; from the keyboard on a timed hold the focus goes to its Time, the first box", () => {
  assert.deepStrictEqual(r.staleAdd, { sets: ["a:3:done", "b:3:done", "c:4:open"], saved: false });
  assert.deepStrictEqual([r.holdKeys.sets, r.holdKeys.focus], [4, "rp"]);
});

test("a finished workout says \"3 sets only\" with no button; nothing threw", () => {
  assert.deepStrictEqual([r.finished, r.rejected], [[short(null), short(null)], []]);
});

test("after the final check: \"Add set\" only on the first set an exercise does not have; one finished before the set counter keeps its sets done; the line hides wherever the set boxes do", async () => {
  assert.deepStrictEqual(r.fiveCard, { at4: short("Add set 4"), at5: short(null), cur: "Set 5 of 5" });
  assert.deepStrictEqual(r.oldDone, [4, 3, false], "4 sets, its 3 done, open for the 4th");
  const fs = await import("node:fs"), html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
  assert.ok(html.includes("body.client .block.ahead .row .setlog-short, #rows.locked .block.peek .row .setlog-short, .block.done:not(.open) .row .setlog-short, #vTraining.tpl .setlog-short { display: none; }"), "a folded finished card, a card still to come in the client's look, a look at a finished workout, a template");
});

test("renumbering never changes an exercise's number of sets, as v311 (the checks: every rule that let a new exercise take a superset's sets changed a number in some reorder): a reorder through a shared number keeps every count; the owner's case built anew (+ Add exercise picked into a superset of 3) keeps its 4, and on set 4 the other two say \"3 sets only\" with Add set 4 in the coach's look", () => {
  assert.deepStrictEqual(r.swap, ["2", "3", ["b:4", "p:3", "r:3", "s:4"]]);
  assert.deepStrictEqual(r.joinedNew, [4, true, "Set 4 of 4", short("Add set 4"), short("Add set 4")]);
});
