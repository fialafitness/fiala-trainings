// v316, the twenty-sixth check round: a window that lost Fiala (one window at a time, app/win.js) signs in again by no route, sends nothing more,
// and the words kept for later (the drafts add-on) go with what they were about. win-r26-probe.mjs, one mode per process, all at once: the real
// main.js and sync.js behind the real win.js on the stand-in server, made-up people. (The lock's own side, R26-WIN-1, and the Sign out's photo
// cache, R26-TW-2: win.test.js.)
import path from "node:path";
import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { test, assert } from "./assert.js";
const here = path.dirname(fileURLToPath(import.meta.url));
const MODES = ["online", "lateboot", "slow4", "retry-new", "slow-save", "client-skip", "client-move", "del", "health", "deleted", "plain", "norender"];
const run = (m) => new Promise((done) => execFile(process.execPath, [path.join(here, "win-r26-probe.mjs"), m], { encoding: "utf8", timeout: 120000 }, (e, so, se) => {
  if (e) { done({ err: m + ": " + String((se || "") + (e.message || e)).slice(-600) }); return; }
  try { done(JSON.parse(String(so).trim().split("\n").pop())); } catch (_) { done({ err: m + ": " + String(so).slice(-600) }); }
}));
const r = Object.fromEntries(await Promise.all(MODES.map(async (m) => [m, await run(m)])));
const ok = (m) => { assert.strictEqual(r[m].err, undefined, r[m].err); return r[m]; };

// R26-TW-3: a window that lost Fiala starts nothing of its own again (resumeOnline, enterCloud and takeKept ask winLost() first)
test("the twenty-sixth check round (R26-TW-3): a window that opened with no signal and then lost Fiala (Use here in another window) stays still when the signal comes back: it asks for no session, reads nothing from the server, and the words the window in use kept for later (a half-typed Health & safety limit) stay on the device for it", () => {
  const x = ok("online");
  assert.deepStrictEqual(x.start, { offline: true, entry: "remembered" }, "carrying on offline as the coach the device remembers (the case)"); assert.ok(x.listeners >= 1, "the online event has a listener");
  assert.deepStrictEqual({ lost: x.lost, sessions: x.sessions, keptLeft: x.keptLeft, calls: x.calls, taken: x.taken }, { lost: true, sessions: 0, keptLeft: true, calls: [], taken: [] }, JSON.stringify(x));
});
test("the twenty-sixth check round (R26-TW-3): a window whose start carried on offline after 4 s (the library still retrying its token) and then lost Fiala does not sign in when that session finally comes through: nothing read from the server, and the words kept by the window in use stay on the device", () => {
  const x = ok("lateboot");
  assert.deepStrictEqual(x.at4s, { offline: true, entry: "remembered" }, "the slow start carried on offline (the case)");
  assert.deepStrictEqual({ lost: x.lost, keptLeft: x.keptLeft, calls: x.calls, taken: x.taken }, { lost: true, keptLeft: true, calls: [], taken: [] }, JSON.stringify(x));
});
test("the twenty-sixth check round (R26-TW-3): a window that lost Fiala while its start still waited for its session takes nothing kept by the window in use when it carries on offline at 4 s: the half-typed limit and card note stay on the device for that window", () => {
  const x = ok("slow4");
  assert.deepStrictEqual(x, { lost: true, entry: "remembered", keptLeft: true, calls: [], taken: { text: [], cards: [], notes: [] } });
});

// R26-WAP-1: a window that lost Fiala sends nothing more (flushOne's retry, cloudBackend.set's write, cloudBackend.del, the client's rules, her move)
test("the twenty-sixth check round (R26-WAP-1): the coach's new workout whose first save met a server error is not tried again from the window that lost Fiala while it waited: nothing is read or sent from there, so the name he gave it in the window now in use stays (that retry put the first name back)", () => {
  const x = ok("retry-new");
  assert.deepStrictEqual(x.firstTry, ["ft_trainings select"], "its first try (no stamp yet: a read first) met the error (the case)");
  assert.deepStrictEqual({ lost: x.lost, calls: x.calls, server: x.server }, { lost: true, calls: [], server: "Legs day 2 (B)" });
});
test("the twenty-sixth check round (R26-WAP-1): a save on a slow bar that comes back after Fiala has moved (the hand-over waited 3 s for it and let go) is not merged and written again from the old window: the correction made in the window now in use (105 lb) stays on the server", () => {
  const x = ok("slow-save");
  assert.ok(x.handOverMs >= 2900, "the hand-over waited for the save and let go (the case): " + x.handOverMs);
  assert.deepStrictEqual({ lost: x.lost, writes: x.writes, server: x.server }, { lost: true, writes: ["update:100"], server: "105" }, "only the write already on its way, refused by its stamp: " + JSON.stringify(x));
});
test("the twenty-sixth check round (R26-WAP-1): on Jane's phone, a pass cut by the move (her set still on its way) sends nothing more from the old tab: her Skip does not go after the move, so the Undo she made in the tab now in use stands", () => {
  const x = ok("client-skip");
  assert.ok(x.handOverMs >= 2900, "the hand-over waited for the set and let go (the case): " + x.handOverMs);
  assert.deepStrictEqual({ lost: x.lost, rules: x.rules, skipped: x.skipped }, { lost: true, rules: [], skipped: false });
});
test("the twenty-sixth check round (R26-WAP-1): her move of the workout, due in the same pass as a set still on its way at the move, is not sent from the old tab: the day she picked last, in the tab now in use, stands", () => {
  const x = ok("client-move");
  assert.deepStrictEqual(x, { lost: true, rules: [], day: "her last pick" });
});
test("the twenty-sixth check round (R26-WAP-1): a deletion asked of the old window's server connection after the move sends nothing (the queue asks first as well): the workout stays on the server", () => {
  const x = ok("del");
  assert.deepStrictEqual(x, { lost: true, threw: true, calls: [], onServer: true });
});

// R26-WAP-2: the kept words go with what they were about (sweepKept, at every redraw and before they are written to the device)
test("the twenty-sixth check round (R26-WAP-2): when Jane turns off Store health details, the coach's unsaved words about her health, kept for the next time that sheet opens, go too: not in the page, not on the device, and not in the box when she agrees again months later", () => {
  const x = ok("health");
  assert.deepStrictEqual({ keptAtMove: x.keptAtMove, taken: x.taken }, { keptAtMove: ["safety:c1/conditions"], taken: ["safety:c1/conditions"] }, "kept at Use here and taken by the window Fiala moved to (the case)");
  assert.deepStrictEqual(x.afterWithdrawal, { health: null, kept: [] }); assert.strictEqual(x.boxOnReopen, "", "the box holds her record's value, empty, not his old words"); assert.strictEqual(x.onDevice, null);
});
test("the twenty-sixth check round (R26-WAP-2): words kept about a client and her workout deleted on another device (her notes box, a card note, Health & safety, an exercise's instructions) are kept no longer once the sync brings the deletion, in the page or on the device", () => {
  const x = ok("deleted");
  assert.deepStrictEqual(x.taken, { text: ["safety:c1/conditions", "note:w1/sq"], cards: ["w1/1"], notes: ["c1"] }, "taken by the window Fiala moved to (the case)");
  assert.deepStrictEqual(x.gone, { client: true, workout: true }); assert.deepStrictEqual(x.afterSync, { text: [], cards: [], notes: [] }); assert.strictEqual(x.onDevice, null);
});
test("the twenty-sixth check round (R26-WAP-2): with no move at all, the Health & safety sheet left up with words is no longer written to the device once she withdraws, and the private note half typed in her notes box is not either once her record is deleted", () => {
  const x = ok("plain"), note = [["c1", "Private: knee surgery in March"]];
  assert.deepStrictEqual(x.before, { text: { "safety:c1/medications": "Albuterol before cardio" }, cards: [], notes: note }, "both kept while she agrees (the case)");
  assert.deepStrictEqual(x.afterWithdrawal, { text: {}, cards: [], notes: note }); assert.strictEqual(x.clientGone, true); assert.strictEqual(x.afterDeletion, null);
});
test("the twenty-sixth check round (R26-WAP-2): words kept about a workout that his own save found deleted on the iPad (no sync, no redraw) are not written to the device when the window goes out of sight", () => {
  const x = ok("norender");
  assert.deepStrictEqual({ taken: x.taken, view: x.view, gone: x.gone }, { taken: { text: ["note:w1/sq"], cards: ["w1/1"], notes: [] }, view: "clients", gone: true }, "taken, then the workout gone with no redraw (the case)");
  assert.strictEqual(x.onDevice, null);
});
