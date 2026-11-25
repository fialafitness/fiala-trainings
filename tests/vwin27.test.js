// verify-window (check round 27): the sign-in handling's amendments on top of the privacy verifier's fix (vprv27.test.js), and R27-WIN-3's case the
// window lens's fix leaves (rw27-lock-probe.mjs, its stand-in windows on one clock: Use here pressed in a third window during a move).
// vwin27-probe.mjs, one mode per process, all at once. Made-up people only.
import path from "node:path";
import { execFile, execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { test, assert } from "./assert.js";
const here = path.dirname(fileURLToPath(import.meta.url));
const lock = JSON.parse(execFileSync(process.execPath, [path.join(here, "rw27-lock-probe.mjs")], { encoding: "utf8", timeout: 120000 }).trim().split("\n").pop());
const MODES = ["late none", "late typed", "late signup", "late busy", "lateLost", "slowDrop", "slowStop"];
const run = (m) => new Promise((done) => execFile(process.execPath, [path.join(here, "vwin27-probe.mjs"), ...m.split(" ")], { encoding: "utf8", timeout: 120000 }, (e, so, se) => {
  if (e) { done({ err: m + ": " + String((se || "") + (e.message || e)).slice(-600) }); return; }
  try { done(JSON.parse(String(so).trim().split("\n").pop())); } catch (_) { done({ err: m + ": " + String(so).slice(-600) }); }
}));
const r = Object.fromEntries(await Promise.all(MODES.map(async (m) => [m, await run(m)])));
const ok = (m) => { assert.strictEqual(r[m].err, undefined, r[m].err); assert.strictEqual(r[m].error, undefined, r[m].error); return r[m]; };
const OUT = "Signed out. Sign in again to keep syncing.";
test("(verify-window, the launch's late session) the device still holds the coach's sign-in and the launch showed the sign-in page (no signal, no account remembered): with nothing typed, his session coming through late goes in as before", () => {
  const x = ok("late none"); assert.deepStrictEqual(x.before, ["vLogin"]); assert.deepStrictEqual([x.after, x.as, x.library], [["vClients"], "coach@x.com", "coach@x.com"], JSON.stringify(x));
});
test("(verify-window) ...with Jane's own email typed there meanwhile, it never goes in, and that sign-in leaves the device (a reload or a tab switch opened the coach's Clients page)", () => {
  const x = ok("late typed"); assert.deepStrictEqual([x.after, x.signedIn, x.library, x.roleChecks], [["vLogin"], false, null, 0], JSON.stringify(x));
});
test("(verify-window) ...with the Create account page up (a new person making an account), it never goes in, and that sign-in leaves the device (it opened the coach's Clients page from under her typing)", () => {
  const x = ok("late signup"); assert.deepStrictEqual([x.after, x.signedIn, x.library, x.roleChecks], [["vSignup"], false, null, 0], JSON.stringify(x));
});
test("(verify-window) ...with Jane's own Sign in still out: her own sign-in decides, and the page runs as the account the library holds (v321 opened the coach's pages first; with the privacy fix alone her own sign-in then ended signed out; signing the late session out while hers was out removed hers when that answer came)", () => {
  const x = ok("late busy"); assert.deepStrictEqual([x.after, x.signedIn, x.as, x.client, x.library], [["vClient"], true, "jane@x.com", true, "jane@x.com"], JSON.stringify(x));
});
test("(verify-window) ...and in a window that lost Fiala meanwhile (Use here in another window) with Jane's email typed: the session coming through there is neither entered nor signed out (the sign-in the device holds is the window in use's)", () => {
  const x = ok("lateLost"); assert.strictEqual(x.lost, true, "(the case)"); assert.deepStrictEqual([x.signedIn, x.library, x.signOuts, x.calls], [false, "coach@x.com", 0, []], JSON.stringify(x));
});
test("(verify-window) a sign-in of Jane's lands on this sign-in page where Mia typed her own email and password, and the sign-out of it is slow (1.5 s): Mia's Sign in, tapped meanwhile, waits for it and she ends signed in as herself (its end removed her new sign-in: signed out again)", () => {
  const x = ok("slowDrop");
  assert.deepStrictEqual(x.during, { shown: ["vLogin"], signedIn: false, signingOut: true }, "(the case)");
  assert.deepStrictEqual([x.signedIn, x.as, x.library], [true, "mia@x.com", "mia@x.com"], JSON.stringify(x)); assert.notStrictEqual(x.msg, OUT);
});
test("(verify-window) the coach's pages stop as Jane's sign-in lands under them, its sign-out slow (1.5 s); he signs in again at once: he ends signed in, and his waiting change reaches the server as his", () => {
  const x = ok("slowStop");
  assert.deepStrictEqual(x.stopped, { shown: ["vLogin"], signedIn: false, msg: OUT, waiting: ["clients/c1"], owner: "coach@x.com" }, "(the case)");
  assert.deepStrictEqual([x.after, x.signedIn, x.as, x.library, x.waiting, x.phone], [["vClients"], true, "coach@x.com", "coach@x.com", [], "3105550111"], JSON.stringify(x));
});
test("(verify-window, R27-WIN-3's case the moving window's answer leaves) Use here in B, then in C 2 s later, while the window in use (asleep) never ends its hand-over: C, pressed last, keeps Fiala and what it took on; B gives way at the end of its wait (it took Fiala from C at 6 s, without a hand-over, and the words C took were lost)", () => {
  const x = lock.T1_cUseHere; assert.deepStrictEqual(x.end, ["c"], JSON.stringify(x.log)); assert.strictEqual(x.cLostHook, 0, JSON.stringify(x.log));
});
test("(verify-window) Use here in B, then in C 1 s later, while the window in use, awake, is still in its hand-over (3 s): C waits its turn, the hand-over's last stores land, and Fiala opens in B, where Use here was pressed first (C took it at once from the window still storing, then lost it to B at 6 s)", () => {
  const x = lock.T4_secondUse; assert.strictEqual(x.aStoredAtEnd, true, JSON.stringify(x.log)); assert.deepStrictEqual(x.end, ["b"], JSON.stringify(x.log)); assert.ok(!x.log.some((e) => e[1] === "c" && e[2] === "runs Fiala"), JSON.stringify(x.log));
});
