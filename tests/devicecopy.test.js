// The audit of 15 Nov 2026, #1: the device copy outgrew localStorage (about 2.6 million characters once it holds a "–" or a curly quote), a
// coach's in months of use. Since v306 it lives in the browser's database (IndexedDB); where there is none, localStorage as before (the rest
// of the tests run so, with no database). The real code against a stand-in database in devicecopy-probe.mjs.
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test, assert } from "./assert.js";
const here = path.dirname(fileURLToPath(import.meta.url));
const r = JSON.parse(execFileSync(process.execPath, [path.join(here, "devicecopy-probe.mjs")], { encoding: "utf8", timeout: 60000 }).trim().split("\n").pop());

test("(#1) a device's copy from before v306 moves into the database at the first launch, and leaves localStorage its room", () => {
  assert.deepStrictEqual(r.moved, { dbUsed: true, inMemory: true, inDb: true, leftInLocalStorage: false });
});
test("(#1) saves go to the database, a burst as one write; a copy far past localStorage's room is kept whole; the next launch reads it back", () => {
  assert.deepStrictEqual(r.saved, { inDb: true, inLocalStorage: false, full: false });
  assert.deepStrictEqual(r.big, { inDb: true, full: false });
  assert.deepStrictEqual(r.nextLaunch, { A: true, B: true, c1: true });
});
test("(#1) a write the database refuses is reported as before; a sign-out leaves nothing; a damaged copy never stops the launch (#20)", () => {
  assert.deepStrictEqual(r.refused, { full: true, after: false });
  assert.deepStrictEqual(r.wiped, { inDb: false, inLocalStorage: false });
  assert.deepStrictEqual(r.damaged, { threw: false, empty: true });
});
