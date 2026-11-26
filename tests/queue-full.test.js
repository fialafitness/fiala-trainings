// The outside audit of 20 Nov 2026, #5 (v324). The unsent queue lives in the browser's small store (localStorage, about 2.6 million characters for one key).
// With hundreds of records waiting at once (a big restore, an exercise renamed everywhere, a long stretch with no signal) its write failed with no word: the
// device copy held the edits, but after a relaunch none of them was waiting, and the next sync put the server's older copies back (in the audit's run, 137 of 350).
// Now the queue is kept short when it does not fit (which records wait, and every mark), and each waiting record, the stamp it was read under and the copy last
// read are the device copy's own, of one write. The real code against a stand-in database, server and store in queue-full-probe.mjs (run twice: with a database, and with none).
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test, assert } from "./assert.js";
const here = path.dirname(fileURLToPath(import.meta.url));
const run = (...args) => JSON.parse(execFileSync(process.execPath, [path.join(here, "queue-full-probe.mjs"), ...args], { encoding: "utf8", timeout: 240000 }).trim().split("\n").pop());
const r = run(), nodb = run("nodb");

test("(v324, the outside audit's #5) 350 changed workouts waiting at once: the queue no longer fits, so the short one is kept (every one of them listed, no word in the bar), and the device copy holds each as it is now with the copy last read", () => {
  assert.deepStrictEqual(r.kept, { refused: true, slim: true, waiting: 350, recs: 0, docs: 0, stamps: 0, queueChars: true, queueFull: false, deviceFull: false, warned: false, newestInCopy: "Changed with no signal", basesInCopy: 350 });
});
test("(v324, the outside audit's #5) after a relaunch all 350 are still waiting, each with the stamp and the copy it was read under; the next sync keeps them, and with the signal back every one reaches the server (137 of them were lost, replaced by the server's older copies)", () => {
  assert.deepStrictEqual(r.relaunched, { waiting: 350, newest: "Changed with no signal", newestWaits: true, stampAsRead: true, baseAsRead: "Workout" });
  assert.deepStrictEqual(r.afterSync, { newest: "Changed with no signal", changedHere: 350 });
  assert.deepStrictEqual(r.sent, { onServer: 350, waiting: 0 });
});
test("(v324) once the queue fits again it is kept whole as before, and the device copy lets go of what it carried for the short one", () => {
  assert.deepStrictEqual(r.drained, { slim: false, waiting: 0, queueFull: false, basesInCopy: 0 });
});
test("(v324) a waiting record, its stamp and its copy read are of one write of the device copy: a stamp or a copy read the page learned after that write never meets the older record (the stamp would write it over the newer one, the copy read would undo the other device's change in a merge)", () => {
  assert.deepStrictEqual(r.oneMoment, { slim: true, stampsInQueue: 0, record: "First change", waits: true, stampIsTheCopys: true, baseIsTheCopys: "Workout" });
});
test("(v324) the database refusing its write while the queue does not fit: no short queue is written beside an older copy, the last queue that fitted stays whole, the bar says the device is not saving, and it stops saying so once the queue fits", () => {
  assert.deepStrictEqual(r.fullDevice, { queueFull: true, deviceFull: true, status: "Not saved on this device · free up space", shortWritten: false, lastOneThatFit: true });
  assert.deepStrictEqual(r.fullDeviceOver, { queueFull: false, stored: 3 });
});
test("(v324) a browser with no database: a queue that does not fit cannot lean on the device copy, so the bar says the device is not saving (it said Saved), until the queue fits again", () => {
  assert.deepStrictEqual(nodb.nodb, { refused: true, queueFull: true, status: "Not saved on this device · free up space", waitingInMemory: 350 });
  assert.deepStrictEqual(nodb.nodbFits, { queueFull: false, status: "Saved", stored: 3 });
});
