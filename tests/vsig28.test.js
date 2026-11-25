// verify-signin (check round 28, the sign-in lens's verifier): round 28's sign-in findings, verified with the real supabase-js 2.117.2 in headless
// Chrome (the verifier's rl/ harness) and held here by vsig28-probe.mjs, one mode per process, all at once (its stand-in library keeps the
// sign-in as 2.117.2 does: in localStorage, shared by the browser's windows; a sign-out with a sign-in stored answers its /logout first, then
// removes whatever is stored then). Made-up people only.
import path from "node:path";
import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { test, assert } from "./assert.js";
const here = path.dirname(fileURLToPath(import.meta.url));
const MODES = ["recOwn", "recLands", "recSilent", "recOwnLands", "recNoSession", "recNoSessionSlow", "recOwnNoSession", "recOwnNoSessionSlow", "linkLost", "linkLostSlow", "signupIdle", "signupBusy", "failLands", "failSame", "failLate", "dropFirst", "stopFirst", "outLands", "notesCleared", "cardCleared"];
const run = (m) => new Promise((done) => execFile(process.execPath, [path.join(here, "vsig28-probe.mjs"), m], { encoding: "utf8", timeout: 120000 }, (e, so, se) => {
  if (e) { done({ err: m + ": " + String((se || "") + (e.message || e)).slice(-600) }); return; }
  try { done(JSON.parse(String(so).trim().split("\n").pop())); } catch (_) { done({ err: m + ": " + String(so).slice(-600) }); }
}));
const r = Object.fromEntries(await Promise.all(MODES.map(async (m) => [m, await run(m)])));
const ok = (m) => { assert.strictEqual(r[m].err, undefined, r[m].err); assert.strictEqual(r[m].error, undefined, r[m].error); return r[m]; };
const LINK = "That link did not work. Ask for a new one.", OUT = "Signed out. Sign in again to keep syncing.", WRONG = "Wrong email or password.";
const JANE = "jane@x.com", MIA = "mia@x.com", COACH = "coach@x.com";
const pick = (x, keys) => Object.fromEntries(keys.map((k) => [k, x[k]]));

test("(verify-signin, R28-SIG-1 kept) Mia's own reset link: New password, Save: her password is set and her pages open", () => {
  const x = ok("recOwn");
  assert.deepStrictEqual(pick(x, ["page", "set", "shown", "as"]), { page: ["vRecovery"], set: ["password set for " + MIA], shown: ["vClient"], as: MIA });
});
test("(verify-signin, R28-SIG-1, older: v316) Jane's sign-in, out in the window that lost Fiala, lands while Mia's New password page is up: the page goes to the sign-in page with the existing link words, that sign-in leaves the device at once (its server end asked for on the side), and nothing sets Jane's password or reads as Jane (Mia's Save set Jane's password, then opened Jane's pages)", () => {
  const x = ok("recLands");
  assert.deepStrictEqual(x.page, ["vRecovery"], "(the case)");
  assert.deepStrictEqual(pick(x, ["atOnce", "set", "readsAsJane", "side", "library", "shown", "msg", "stored"]), { atOnce: null, set: [], readsAsJane: [], side: ["side /logout as " + JANE + " local"], library: [], shown: ["vLogin"], msg: LINK, stored: null }, JSON.stringify(x));
});
test("(verify-signin, R28-SIG-1) the same with no word of it to this page (a browser without BroadcastChannel, a tab asleep): Save finds Jane's sign-in stored, sets no password, goes to the sign-in page and that sign-in leaves the device (it stayed, and a reload opened Jane's pages)", () => {
  const x = ok("recSilent");
  assert.deepStrictEqual(pick(x, ["set", "readsAsJane", "side", "shown", "msg", "stored"]), { set: [], readsAsJane: [], side: ["side /logout as " + JANE + " local"], shown: ["vLogin"], msg: LINK, stored: null }, JSON.stringify(x));
});
test("(verify-signin, R28-SIG-1 kept) Mia's own sign-in (also made in the other window) lands under her New password page: the page stays, Save sets her own password and opens her pages", () => {
  const x = ok("recOwnLands");
  assert.deepStrictEqual(pick(x, ["after", "set", "side", "shown", "as"]), { after: ["vRecovery"], set: ["password set for " + MIA], side: [], shown: ["vClient"], as: MIA });
});
for (const m of ["recNoSession", "recNoSessionSlow"]) test("(verify-signin, R28-SIG-1) the link's account as the launch read it (the library's PASSWORD_RECOVERY carrying no session" + (m === "recNoSession" ? ")" : "; the launch's read slower than 4 s: the sign-in page first)") + ": Jane's landing still leaves the device and sets no password", () => {
  const x = ok(m);
  assert.deepStrictEqual(x.page, ["vRecovery"], "(the case)");
  assert.deepStrictEqual(pick(x, ["set", "shown", "msg", "stored"]), { set: [], shown: ["vLogin"], msg: LINK, stored: null }, JSON.stringify(x));
});
for (const m of ["recOwnNoSession", "recOwnNoSessionSlow"]) test("(verify-signin, R28-SIG-1 kept) the same event with no session" + (m === "recOwnNoSession" ? "" : ", the launch's read slower than 4 s") + ", and Mia's own sign-in lands from the other window: her New password page stays and Save sets her own password (the link's account read at launch is kept)", () => {
  const x = ok(m);
  assert.deepStrictEqual(pick(x, ["page", "after", "set", "shown", "as"]), { page: ["vRecovery"], after: ["vRecovery"], set: ["password set for " + MIA], shown: ["vClient"], as: MIA }, JSON.stringify(x));
});
for (const m of ["linkLost", "linkLostSlow"]) test("(verify-signin, a reset link whose one check is lost, older: v316) the device holds the coach's sign-in and Mia's link opens; the library cannot read the link's session (a weak signal" + (m === "linkLost" ? ")" : "; the launch's read slower than 4 s)") + " and keeps the coach's: no New password page over his account (her Save set the COACH's password, then opened his Clients page); the sign-in page says the link did not work and the coach's sign-in leaves the device (a reload opened his Clients page)", () => {
  const x = ok(m);
  assert.deepStrictEqual(x.page, { shown: ["vLogin"], signedIn: false, as: null, msg: LINK, stored: null }, JSON.stringify(x));
  assert.deepStrictEqual([x.set, x.side], [[], ["side /logout as " + COACH + " local"]], JSON.stringify(x));
});
test("(verify-signin, R28-SIG-3, older) Mia is typing on Create account when Jane's sign-in lands from the other window: the page stays as she left it and that sign-in leaves the device at once (it stayed: a reload opened Jane's pages)", () => {
  const x = ok("signupIdle");
  assert.deepStrictEqual(x.page, ["vSignup"], "(the case)");
  assert.deepStrictEqual(pick(x, ["atOnce", "name", "shown", "stored", "side", "readsAsJane"]), { atOnce: null, name: "Mia Testperson", shown: ["vSignup"], stored: null, side: ["side /logout as " + JANE + " local"], readsAsJane: [] }, JSON.stringify(x));
});
test("(verify-signin, R28-SIG-4's Create account case) Jane's sign-in lands while Mia's own Create account is out; it makes no sign-in (a confirmation link sent): that sign-in leaves the device then (it stayed)", () => {
  const x = ok("signupBusy");
  assert.deepStrictEqual(x.during, { shown: ["vSignup"], busy: true }, "(the case)");
  assert.deepStrictEqual(pick(x, ["done", "stored", "side", "readsAsJane"]), { done: true, stored: null, side: ["side /logout as " + JANE + " local"], readsAsJane: [] }, JSON.stringify(x));
});
test("(verify-signin, R28-SIG-4 (b), older) Jane's sign-in lands while Mia's own Sign in is out, and Mia's fails (a mistyped password): that sign-in leaves the device then, nothing read as Jane (it stayed: a reload opened Jane's pages)", () => {
  const x = ok("failLands");
  assert.deepStrictEqual(pick(x, ["shown", "msg", "stored", "side", "readsAsJane"]), { shown: ["vLogin"], msg: WRONG, stored: null, side: ["side /logout as " + JANE + " local"], readsAsJane: [] }, JSON.stringify(x));
});
test("(verify-signin, R26-WIN-6 after a failed Sign in) the sign-in that landed meanwhile is Mia's own (the other window's): her failed Sign in then goes in with it, the password box emptied", () => {
  const x = ok("failSame");
  assert.deepStrictEqual(pick(x, ["shown", "as", "password", "side"]), { shown: ["vClient"], as: MIA, password: "", side: [] }, JSON.stringify(x));
});
test("(verify-signin, R28-SIG-4 (a), left by R27-WIN-1) the launch's late session (the coach's) comes while Jane's own Sign in is out and hers fails: it leaves the device then (it stayed: a reload opened the coach's Clients page)", () => {
  const x = ok("failLate");
  assert.deepStrictEqual(x.page, ["vLogin"], "(the case)");
  assert.deepStrictEqual(pick(x, ["shown", "msg", "stored", "side", "readsAsCoach"]), { shown: ["vLogin"], msg: WRONG, stored: null, side: ["side /logout as " + COACH + " local"], readsAsCoach: 0 }, JSON.stringify(x));
});
test("(verify-signin, R28-SIG-2 and R28-SIG-5) a sign-in this page did not make (Jane's, on Mia's sign-in page) leaves the device at once though its sign-out answers only in 10 s; Mia's Sign in goes in at once and stays (it waited 8 s, and the sign-out's answer then signed her out)", () => {
  const x = ok("dropFirst");
  assert.strictEqual(x.atOnce, null, JSON.stringify(x)); assert.ok(x.inMs < 3000, "her Sign in waited " + x.inMs + " ms");
  assert.deepStrictEqual(pick(x, ["shown", "signedIn", "as", "stored", "library", "side"]), { shown: ["vClient"], signedIn: true, as: MIA, stored: MIA, library: [], side: ["side /logout as " + JANE + " local"] }, JSON.stringify(x));
});
test("(verify-signin, R28-SIG-2 and R28-SIG-5) the coach's pages stop as Jane's sign-in lands under them; it leaves the device at once (its sign-out answers in 10 s); he signs in again at once and stays signed in", () => {
  const x = ok("stopFirst");
  assert.deepStrictEqual(x.before.shown, ["vClients"], "(the case)");
  assert.deepStrictEqual([x.atOnce, x.stopped.shown, x.stopped.msg, x.stopped.stored], [null, ["vLogin"], OUT, null], JSON.stringify(x)); assert.ok(x.inMs < 3000, "his Sign in waited " + x.inMs + " ms");
  assert.deepStrictEqual(pick(x, ["shown", "as", "stored"]), { shown: ["vClients"], as: COACH, stored: COACH }, JSON.stringify(x));
});
test("(verify-signin, R28-SIG-2) Jane's sign-in lands while the coach's own Sign out is on its way (its answer 3 s away): it leaves the device at once, not at his sign-out's answer", () => {
  const x = ok("outLands");
  assert.deepStrictEqual(pick(x, ["atOnce", "side", "library", "shown", "stored"]), { atOnce: null, side: ["side /logout as " + JANE + " local"], library: ["library /logout as " + COACH], shown: ["vLogin"], stored: null }, JSON.stringify(x));
});
test("(verify-signin, R28-SIG-6, older) the coach's notes about Jane, kept in window A; in B, during its slow start, he types in the notes box and empties it again: the older kept words do not come back into the emptied box", () => {
  const x = ok("notesCleared");
  assert.deepStrictEqual(x.page, { view: "client", signedIn: true }, "(the case)");
  assert.deepStrictEqual(pick(x, ["draft", "box"]), { draft: null, box: "" }, JSON.stringify(x));
});
test("(verify-signin, R28-SIG-6, older) the same with card 1's note box: typed in and emptied during the slow start, window A's kept words for that card are not put back", () => {
  const x = ok("cardCleared");
  assert.strictEqual(x.typed, "Ask about the left knee", "(the case) " + JSON.stringify(x));
  assert.deepStrictEqual(pick(x, ["draft", "boxes"]), { draft: null, boxes: 0 }, JSON.stringify(x));
});
