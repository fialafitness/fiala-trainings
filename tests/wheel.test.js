// The audit of 15 Nov 2026, #17: a Health details wheel saved its starting value for a touch that turned nothing (an empty Weight became
// 158 lb on the coach's card). CLAUDE.md's rule: a value is kept only once a person turns the wheel. The real wheel plays in wheel-probe.mjs.
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test, assert } from "./assert.js";
const here = path.dirname(fileURLToPath(import.meta.url));
const r = JSON.parse(execFileSync(process.execPath, [path.join(here, "wheel-probe.mjs")], { encoding: "utf8", timeout: 60000 }).trim().split("\n").pop());

test("(#17) a touch that turns nothing keeps nothing; a tap on the row already in the band keeps nothing", () => {
  assert.deepStrictEqual(r.tap, []); assert.deepStrictEqual(r.sameRow, []);
});
test("(#17) turned, turned and brought back, another row tapped, or a key pressed: the value under the band is kept", () => {
  assert.deepStrictEqual(r.turned, [7]); assert.deepStrictEqual(r.turnedBack, [5], "turned away and back: the value is chosen");
  assert.deepStrictEqual(r.otherRow, [9]); assert.deepStrictEqual(r.key, [6]);
});
