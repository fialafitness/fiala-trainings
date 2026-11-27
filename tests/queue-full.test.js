// The outside audit of 20 Nov 2026, #5 (v324). The unsent queue lives in the browser's small store (localStorage, about 2.6 million characters for one key).
// With hundreds of records waiting at once (a big restore, an exercise renamed everywhere, a long stretch with no signal) its write failed with no word: the
// device copy held the edits, but after a relaunch none of them was waiting, and the next sync put the server's older copies back (in the audit's run, 137 of 350).
// Now the queue is kept short when it does not fit (which records wait, and every mark), and each waiting record, the stamp it was read under and the copy last
// read are the device copy's own, of one write. The real code against a stand-in database, server and store in queue-full-probe.mjs (run twice: with a database, and with none).
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
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

test("(v327, the review of 26 Nov 2026) the short queue is written on the answer of a device-copy write begun while it was due, never on the answer of an earlier one still out: until then the last whole queue stays (the short one sat beside a copy with no copies read, and a relaunch merged every waiting save against nothing)", () => {
  assert.deepStrictEqual(r.window, { someFit: true, refused: true, shortOnTheEarlierAnswer: false, wholeMeanwhile: true, shortOnItsOwn: true, waiting: true, copiesReadInCopy: true, newestInCopy: "The one too many" });
});
test("(v327, the review of 26 Nov 2026) a device-copy write that gets no answer: after its wait the bar says the device is not saving (it said Saved while nothing more was kept)", () => {
  assert.deepStrictEqual(r.silent, { saidNothingAtFirst: true, queueFull: true, status: "Not saved on this device · free up space", shortWritten: false });
});
// A launch whose database does not open (queue-hold-probe.mjs: each launch its own process, the device's state in a file between them).
const hold = (...args) => JSON.parse(execFileSync(process.execPath, [path.join(here, "queue-hold-probe.mjs"), ...args], { encoding: "utf8", timeout: 240000 }).trim().split("\n").pop());
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "fiala-hold-")), at = (n) => path.join(tmp, n);
const hA = hold("A", at("b.json"), "350"); fs.copyFileSync(at("b.json"), at("c.json"));
const hErr = hold("B", at("b.json"), "error"), hNext = hold("B", at("b.json"), "ok"), hLate = hold("B", at("c.json"), "late");
const sA = hold("A", at("s.json"), "3"), sOut = hold("O", at("s.json"), "error"), sNext = hold("L", at("s.json"));
fs.rmSync(tmp, { recursive: true, force: true });
const pick = (o, ks) => Object.fromEntries(ks.map((k) => [k, o[k]]));
test("(v327, the review of 26 Nov 2026, found twice) a launch whose database does not open leaves a short queue alone: nothing is restored, nothing is written over it or over the database's copy, and the bar says the device is not saving; the next launch finds all 350 changes waiting and sends them (every key was dropped for want of its record, an empty queue was stored over the short one, and the bar said Saved)", () => {
  assert.deepStrictEqual(pick(hA.closed, ["queueSlim", "waitingInQueue", "changedInDatabaseCopy"]), { queueSlim: true, waitingInQueue: 350, changedInDatabaseCopy: 350 }, "the device as the app was closed");
  assert.deepStrictEqual(pick(hErr.after, ["signedIn", "waitingInMemory", "queueSlim", "waitingInQueue", "changedInDatabaseCopy", "copyInLocalStorage", "queueFull", "saysNotSaved", "changedOnServer"]),
    { signedIn: true, waitingInMemory: 0, queueSlim: true, waitingInQueue: 350, changedInDatabaseCopy: 350, copyInLocalStorage: false, queueFull: true, saysNotSaved: true, changedOnServer: 0 }, "the launch with no database");
  assert.deepStrictEqual(pick(hNext.after, ["changedOnServer", "waitingInQueue", "queueFull", "saysNotSaved"]), { changedOnServer: 350, waitingInQueue: 0, queueFull: false, saysNotSaved: false }, "the launch after it");
});
test("(v327) with a short queue on the device the database's open is given longer than the usual 2 seconds: one that answers after 2.5 is waited for, and everything waiting goes", () => {
  assert.deepStrictEqual(pick(hLate.after, ["changedOnServer", "waitingInQueue", "queueFull"]), { changedOnServer: 350, waitingInQueue: 0, queueFull: false });
});
test("(v327, the review of 26 Nov 2026, an older gap) signed out in a launch whose database did not open: the next launch does not read the account's copy back from the database, and empties it (every client and workout came back into memory behind the sign-in page, and stayed on the device)", () => {
  assert.deepStrictEqual(pick(sA.closed, ["clientsInDatabaseCopy", "workoutsInDatabaseCopy"]), { clientsInDatabaseCopy: 1, workoutsInDatabaseCopy: 3 });
  assert.deepStrictEqual(pick(sOut.after, ["signedIn", "clientsInMemory", "clientsInDatabaseCopy", "copyInLocalStorage"]), { signedIn: false, clientsInMemory: 0, clientsInDatabaseCopy: 1, copyInLocalStorage: true }, "signed out: the database could not be reached, so a mark is left");
  assert.deepStrictEqual(pick(sNext.after, ["clientsInMemory", "workoutsInMemory", "clientsInDatabaseCopy", "workoutsInDatabaseCopy", "copyInLocalStorage"]), { clientsInMemory: 0, workoutsInMemory: 0, clientsInDatabaseCopy: 0, workoutsInDatabaseCopy: 0, copyInLocalStorage: false }, "the next launch");
});
