// v312: the card's Plan pop-up and the plan card's Change, driven through their real listeners in plan-switch-probe.mjs (the owner's ask, 16 Nov 2026: "fix that
// as well", Sessions kept through package switches; and the last check's findings: a mis-pick put right comes back exactly as it was, a bigger package picked as
// a smaller one and back keeps its place, a Change left open while a sync brings another device's switch writes nothing into the new plan).
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { test, assert } from "./assert.js";
const here = path.dirname(fileURLToPath(import.meta.url));
const r = JSON.parse(execFileSync(process.execPath, [path.join(here, "plan-switch-probe.mjs")], { encoding: "utf8", timeout: 90000 }).trim().split("\n").pop());
const at = (big, right) => ({ big, right, steps: false });

test("a monthly plan picked by mistake and the session package put back the same day: exactly as it was (3 of 10, Package 2), Sessions 13 all along", () => {
  assert.deepStrictEqual(r.misPick.before, [at("3 of 10", "Package 2"), "13"]);
  assert.strictEqual(r.misPick.wrong[1], "13", "the package on record still counts while the monthly plan is on");
  assert.deepStrictEqual(r.misPick.back, [at("3 of 10", "Package 2"), "13", true]);
});

test("a 20 at 13 of 20 picked as a 10 and put back the same day: the card reads the open package, as v311 (a known limit), and Sessions stays 13 through carried", () => {
  assert.deepStrictEqual([r.bigSmallBig.before, r.bigSmallBig.wrong, r.bigSmallBig.back.slice(0, 2)], ["13 of 20", [at("3 of 10", "Package 2"), "13"], ["3 of 20", "13"]]);
});

test("a Change left open (+2 on the card) while a sync brings the other device's switch to 20 sessions: it closes, and a tap where Save was writes nothing into the new plan (the last check: Sessions read 25)", () => {
  assert.deepStrictEqual(r.sync.open, [{ big: "5 of 10", right: "Package 2", steps: true }, "13"]);
  assert.deepStrictEqual(r.sync.synced, [at("3 of 20", ""), "13"]);
  assert.deepStrictEqual(r.sync.saved, [at("3 of 20", ""), "13", -2, 10, -2]);
});

test("after the final checks: None picked by mistake and the 10 put back the same day: exactly as it was (3 of 10, Package 2, Sessions 13, nothing on record); a session taken off with Change on the 20 stays off when the 10 comes back (as v311: 2 of 10, Sessions 12)", () => {
  assert.deepStrictEqual(r.viaNone, [at("3 of 10", "Package 2"), "13", true, true]);
  assert.deepStrictEqual(r.changeKept, [["2 of 20", "12"], "2 of 10", "12", -3]);
});

test("the final check: a Change left open while the other device switches to 20 sessions and back to 10: it closes (the plan changed), and a tap where Save was writes nothing (Sessions 13, not 23)", () => {
  assert.deepStrictEqual(r.roundTrip.synced, [{ big: "3 of 10", right: "", steps: false }, "13"]);
  assert.deepStrictEqual(r.roundTrip.saved, [{ big: "3 of 10", right: "", steps: false }, "13", -2, 10]);
});
