// The audit of 15 Nov 2026, #3 and #11: a sync that replaced the open workout left its cards writing into the old copy (a set typed and
// completed after the client's Undo, or after the coach renamed the workout, went nowhere), and a sync that changed another workout of the
// client rebuilt the cards under a typing finger. The page plays in its own process (detached-probe.mjs).
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test, assert } from "./assert.js";
const here = path.dirname(fileURLToPath(import.meta.url));
const r = JSON.parse(execFileSync(process.execPath, [path.join(here, "detached-probe.mjs")], { encoding: "utf8", timeout: 60000 }).trim().split("\n").pop());

test("(#11) a server copy that differs only by the empty sets the cards drew is not swapped in, and the cards are not rebuilt", () => {
  assert.strictEqual(r.A_replaced, false); assert.strictEqual(r.A_rebuilt, false);
  assert.deepStrictEqual(r.A_secondSync, { replaced: false, rebuilt: false });
});
for (const v of ["title", "undo"]) test("(#3) a sync that replaces the open workout (" + (v === "title" ? "the coach renamed it" : "the client's Undo") + ") draws its cards again: the next set typed and completed lands in the live record", () => {
  const b = r["B_" + v];
  assert.strictEqual(b.replaced, true); assert.strictEqual(b.rebuilt, true);
  assert.strictEqual(b.typed.live, "140", "typed into the live record");
  assert.strictEqual(b.afterComplete.liveSetsDone, 2); assert.deepStrictEqual(b.afterComplete.liveWeights.slice(0, 2), ["135", "140"]);
});
test("(#11) the coach typing in a client's workout: a sync that changed another of that client's workouts never rebuilds the cards under his finger, nor swaps the record he types in", () => {
  assert.deepStrictEqual(r.C_control, { renderedTrainingAfterMerge: "t1", rebuiltUnderTypingFinger: false, focusedFieldStillInPage: true });
  assert.deepStrictEqual(r.C_sibling, { renderedTrainingAfterMerge: "t1", rebuiltUnderTypingFinger: false, focusedFieldStillInPage: true });
  assert.deepStrictEqual(r.C2, { replacedWhileTyping: false });
  assert.ok(!r.unhandled, "no unhandled rejection: " + JSON.stringify(r.unhandled));
});
