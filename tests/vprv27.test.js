// R27-PRV-1, R27-PRV-2, R27-PRV-3 (the privacy review of the twenty-seventh check round, verified): a sign-in that lands from a window that lost
// Fiala (its Sign in answered late; the browser keeps one sign-in for every window, and supabase-js 2.117.2 tells every tab SIGNED_IN with it),
// and a sign-in made while the account before still had a read out. vprv27-probe.mjs, one mode per process, all at once. Made-up people only.
import path from "node:path";
import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { test, assert } from "./assert.js";
const here = path.dirname(fileURLToPath(import.meta.url));
const MODES = ["typed", "empty", "same", "under", "underWork", "entering", "oldRead"];
const run = (m) => new Promise((done) => execFile(process.execPath, [path.join(here, "vprv27-probe.mjs"), m], { encoding: "utf8", timeout: 120000 }, (e, so, se) => {
  if (e) { done({ err: m + ": " + String((se || "") + (e.message || e)).slice(-600) }); return; }
  try { done(JSON.parse(String(so).trim().split("\n").pop())); } catch (_) { done({ err: m + ": " + String(so).slice(-600) }); }
}));
const r = Object.fromEntries(await Promise.all(MODES.map(async (m) => [m, await run(m)])));
const ok = (m) => { assert.strictEqual(r[m].err, undefined, r[m].err); assert.strictEqual(r[m].error, undefined, r[m].error); return r[m]; };
const OUT = "Signed out. Sign in again to keep syncing.";
test("R27-PRV-1: Mia has typed her own email and password on this sign-in page (Use here a moment ago) when Jane's sign-in lands from the window that lost Fiala: the page stays on its sign-in page with Mia's words, reads nothing as Jane, and Jane's sign-in is signed out on this device (it opened Jane's pages, her password box emptied)", () => {
  const x = ok("typed");
  assert.deepStrictEqual({ shown: x.shown, signedIn: x.signedIn, email: x.email, password: x.password, asJane: x.asJane, library: x.library, signOuts: x.signOuts }, { shown: ["vLogin"], signedIn: false, email: "mia@x.com", password: true, asJane: [], library: null, signOuts: 1 }, JSON.stringify(x));
});
test("R27-PRV-1: the same with nothing typed on this sign-in page yet: nothing names Jane here, so nothing of hers opens, and her sign-in is signed out on this device", () => {
  const x = ok("empty");
  assert.deepStrictEqual({ shown: x.shown, signedIn: x.signedIn, asJane: x.asJane, library: x.library }, { shown: ["vLogin"], signedIn: false, asJane: [], library: null }, JSON.stringify(x));
});
test("R26-WIN-6 kept: Jane typed her own email again in the window Fiala moved to (other letters' case, spaces): her sign-in that landed from the other window goes in, once, the password box emptied", () => {
  const x = ok("same");
  assert.deepStrictEqual(x, { shown: ["vClient"], signedIn: true, as: "jane@x.com", msg: "", client: true, password: "", library: "jane@x.com", signOuts: 0 });
});
test("R27-PRV-2 (older, v316): Mia's pages are up when Jane's sign-in lands from the window that lost Fiala: the page stops at once as at a session ended elsewhere, reads and sends nothing as Jane (her next sync showed Jane's workouts and a Skip went to Jane's), and Jane's sign-in is signed out on this device (a reload opened Jane's account)", () => {
  const x = ok("under");
  assert.deepStrictEqual(x.before, { shown: ["vClient"], signedIn: true, as: "mia@x.com", msg: "" }, "(the case)");
  assert.deepStrictEqual({ after: x.after, asJane: x.asJane, library: x.library, skip: x.skip }, { after: { shown: ["vLogin"], signedIn: false, as: "mia@x.com", msg: OUT }, asJane: [], library: null, skip: "no page" }, JSON.stringify(x));
});
test("R27-PRV-2 with Mia's Skip waiting for a signal: the stop keeps it on the device for her, and it reaches the server as Mia once she signs in again (Jane's read dropped it as deleted by the coach)", () => {
  const x = ok("underWork");
  assert.deepStrictEqual(x.before.waiting, ["trainings/w2"], "(the case) " + JSON.stringify(x));
  assert.deepStrictEqual({ shown: x.after.shown, msg: x.after.msg, waiting: x.after.waiting, owner: x.after.owner, queued: x.after.queued, asJane: x.asJane }, { shown: ["vLogin"], msg: OUT, waiting: ["trainings/w2"], owner: "mia@x.com", queued: ["trainings/w2"], asJane: [] }, JSON.stringify(x));
  assert.deepStrictEqual(x.again, { shown: ["vClient"], signedIn: true, as: "mia@x.com", msg: "", waiting: [] }); assert.ok(x.sentAsMia >= 1, JSON.stringify(x));
});
test("R27-PRV-2 during the page's own start: Jane's sign-in lands while Mia's role check is out: the start goes no further, the page shows its sign-in page (no blank page), nothing is read as Jane, and Jane's sign-in is signed out on this device", () => {
  const x = ok("entering");
  assert.deepStrictEqual(x.mid, { entering: true, as: "mia@x.com" }, "(the case)");
  assert.deepStrictEqual({ after: x.after, asJane: x.asJane, library: x.library }, { after: { shown: ["vLogin"], signedIn: false, as: "mia@x.com", msg: OUT }, asJane: [], library: null }, JSON.stringify(x));
});
test("R27-PRV-3 (older, v316): the coach's read is out when his session ends elsewhere, and Jane signs in on the sign-in page before it ends: her own read follows the old one and her page is drawn (it stayed blank, Saved, until a later sync)", () => {
  const x = ok("oldRead");
  assert.deepStrictEqual([x.out0, x.signInPage, x.as, x.client], [true, ["vLogin"], "jane@x.com", true], "(the case) " + JSON.stringify(x));
  assert.deepStrictEqual(x.shown, ["vClient"], "her page is not drawn: " + JSON.stringify(x)); assert.ok(x.myData >= 1, JSON.stringify(x));
});
