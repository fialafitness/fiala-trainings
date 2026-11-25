// rev/window (check round 27, the one-window lens): what this lens found and fixed. rw27-lock-probe.mjs (win-probe.mjs's stand-in windows on one
// clock: three windows and a move) and rw27-probe.mjs (the real main.js behind the real win.js on the stand-in server, one mode per process).
// Made-up people only.
import path from "node:path";
import { execFile, execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { test, assert } from "./assert.js";
const here = path.dirname(fileURLToPath(import.meta.url));
const lock = JSON.parse(execFileSync(process.execPath, [path.join(here, "rw27-lock-probe.mjs")], { encoding: "utf8", timeout: 120000 }).trim().split("\n").pop());
const MODES = ["overwrite", "overwrite nohide", "cardOverwrite", "cardOverwrite nohide", "heldSignIn", "heldSignIn typed", "typedOther", "swapUnder", "slowHeld", "slowHeld typed", "slowHeld own"];
const run = (m) => new Promise((done) => execFile(process.execPath, [path.join(here, "rw27-probe.mjs"), ...m.split(" ")], { encoding: "utf8", timeout: 120000 }, (e, so, se) => {
  if (e) { done({ err: m + ": " + String((se || "") + (e.message || e)).slice(-600) }); return; }
  try { done(JSON.parse(String(so).trim().split("\n").pop())); } catch (_) { done({ err: m + ": " + String(so).slice(-600) }); }
}));
const r = Object.fromEntries(await Promise.all(MODES.map(async (m) => [m, await run(m)])));
const ok = (m) => { assert.strictEqual(r[m].err, undefined, r[m].err); assert.strictEqual(r[m].error, undefined, r[m].error); return r[m]; };
const OLD = "Knee sore since Monday", NEW = "Knee sore since Monday, ice after every session";

test("(rev/window) the stand-in windows' three-window scenarios ran without an error", () => { assert.strictEqual(lock.errors, undefined, String(lock.errors)); });
for (const [k, what] of [["T1_polls", "C on screen showing the page, checking every 2 s"], ["T1_focus3s", "a click into C 3 s after the tap"], ["T1_focus5s", "a click into C 5 s after the tap"], ["T2_freshC", "C opened only during the move (a new tab, 3 s after the tap: its first check)"]])
  test("(rev/window, the lock writer's case) three windows: Use here in B while the window in use, last seen out of sight, falls asleep in the middle of its hand-over; " + what + ": C never opens Fiala before B takes it at 6 s (it opened it and lost it then, taking the words kept for B with it)", () => {
    const x = lock[k]; assert.strictEqual(x.cStarts, 0, JSON.stringify(x.log)); assert.deepStrictEqual(x.end, ["b"], JSON.stringify(x.log));
  });
test("(rev/window) ...and with B closed half way through its move, C still carries on by itself as soon as before (about 4 s after the tap)", () => {
  assert.ok(lock.T3_moverClosed.cRunsAt > 0 && lock.T3_moverClosed.cRunsAt <= 5000, JSON.stringify(lock.T3_moverClosed));
});
for (const how of ["", " nohide"]) test("(rev/window) window A kept the coach's half-typed notes about Jane at Use here; in B, before its start (one bar) took them, he types the fuller version in the empty notes box" + (how ? ", and waits for the start" : ", and switches to Mail and back before the start ends") + ": his newer words stay, on the device and in the box (the older kept words were put back over them)", () => {
  const x = ok("overwrite" + how);
  assert.deepStrictEqual(x.page, { view: "client", signedIn: true }, "B's pages up from the device copy during its start (the case)");
  assert.strictEqual(x.typed, NEW);
  if (!how) assert.deepStrictEqual(x.atHide, [["c1", NEW]], "kept on the device as B went out of sight");
  assert.strictEqual(x.draft, NEW); assert.strictEqual(x.box, NEW);
});
for (const how of ["", " nohide"]) test("(rev/window) the same with a card's note: B typed its own words in card 1's note box before its start took window A's note for that card" + (how ? "" : ", then went out of sight and back") + ": B's words, and the note B's box was opened on, stay", () => {
  const x = ok("cardOverwrite" + how);
  if (!how) assert.deepStrictEqual(x.atHide, [["w1/1", "Ask about the left knee"]]);
  assert.strictEqual(x.draft, "Ask about the left knee"); assert.strictEqual(x.base, "");
});
for (const how of ["", " typed"]) test("(rev/window, R26-WIN-6's entry) the browser still holds the coach's sign-in while this page shows the sign-in page (a launch with no signal, no account remembered); the library, back on screen, tells the page SIGNED_IN for that same sign-in" + (how ? ", Jane's own email and password typed in the boxes" : "") + ": the page stays on the sign-in page (it went into the coach's account by itself" + (how ? ", over her typing, her password box emptied" : "") + ")", () => {
  const x = ok("heldSignIn" + how);
  assert.deepStrictEqual(x.before, ["vLogin"]); assert.deepStrictEqual(x.after, ["vLogin"]); assert.strictEqual(x.signedIn, false); assert.strictEqual(x.roleChecks, 0);
  if (how) assert.strictEqual(x.password, "janes-own-pass-1");
});
test("(rev/window, R26-WIN-6's entry) Jane types her own email on the sign-in page when a sign-in of the coach's lands from another window of this browser (one that lost Fiala while its Sign in was out): the page stays on the sign-in page with her typing", () => {
  const x = ok("typedOther");
  assert.deepStrictEqual(x.after, ["vLogin"]); assert.strictEqual(x.signedIn, false); assert.strictEqual(x.password, "janes-own-pass-1"); assert.strictEqual(x.roleChecks, 0);
});
test("(rev/window, the late sign-in) the coach is signed in with a change waiting when a sign-in of Jane's, begun in a window that lost Fiala, lands late in the library: the page reads and sends nothing as her, goes to the sign-in page as for a session ended elsewhere, and keeps his waiting change for him (his pages went on syncing under her sign-in)", () => {
  const x = ok("swapUnder");
  assert.deepStrictEqual(x.shown, ["vLogin"], JSON.stringify(x)); assert.strictEqual(x.signedIn, false); assert.strictEqual(x.library, null, "her sign-in left the library (local only)");
  assert.strictEqual(x.owner, "coach@x.com"); assert.deepStrictEqual(x.waiting, ["clients/c1"]); assert.strictEqual(x.callsAfter, 0, "no read or save after her sign-in landed");
});
test("(rev/window, the launch's own late session; older) the same device: the launch's session comes through only after the sign-in page came up (the library retrying): with Jane's own email typed there meanwhile the page stays on the sign-in page with her typing; with nothing typed, or the coach's own email, it goes in as before", () => {
  const t = ok("slowHeld typed"), n = ok("slowHeld"), o = ok("slowHeld own");
  assert.deepStrictEqual(t.before, ["vLogin"]); assert.deepStrictEqual(t.after, ["vLogin"], JSON.stringify(t)); assert.strictEqual(t.signedIn, false); assert.strictEqual(t.password, "janes-own-pass-1");
  assert.deepStrictEqual(n.after, ["vClients"], JSON.stringify(n)); assert.strictEqual(n.as, "coach@x.com");
  assert.deepStrictEqual(o.after, ["vClients"], JSON.stringify(o)); assert.strictEqual(o.as, "coach@x.com");
});
