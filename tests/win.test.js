// v316: Fiala in one window at a time (app/win.js; the owner's pick A of 19 Nov 2026, "Build A if you think it's the best choice", brought into
// v316 on 25 Nov 2026). Windows of one browser on stand-in Web Locks, BroadcastChannel and a clock (win-probe.mjs): each scenario as the approved
// picture and the critique promise it. The real thing in Chrome (two tabs of one profile) is checked by hand at each round (scratch ow/*.mjs).
// Some stops are doubled on purpose and cannot be seen alone (each undone, the other still holds): scheduleSync before syncDownNow, the device copy's save
// before lsSet and flushDb, the sign-outs' own clear of the kept words before the wipe their SIGNED_OUT runs, the second store of the hand-over,
// the lost page's own restart before begin's, the registry's holder before the record, and the page's parts each in a try.
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { test, assert } from "./assert.js";
const here = path.dirname(fileURLToPath(import.meta.url));
const r = JSON.parse(execFileSync(process.execPath, [path.join(here, "win-probe.mjs")], { encoding: "utf8", timeout: 120000 }).trim().split("\n").pop());
const runs = (s) => s.startedCalls === 1 && s.started && !s.lost && s.holding && !s.cover;
const shows = (s) => s.cover && !(s.started && !s.lost);

test("one window: Fiala opens at once, holding the lock, and the record names it, seen on screen", () => {
  assert.ok(runs(r.one.a), JSON.stringify(r.one.a)); assert.strictEqual(r.one.rec, true); assert.strictEqual(r.one.vis, "visible"); assert.deepStrictEqual(r.one.held.length, 1);
  assert.strictEqual(r.errors, undefined, String(r.errors));
});
test("a second window while the first runs and answers shows \"Fiala is open in another window\": nothing of Fiala starts behind it, the page behind is out of reach, the first is untouched", () => {
  assert.strictEqual(r.second.duringAsk.started, 0); assert.ok(shows(r.second.b), JSON.stringify(r.second.b)); assert.strictEqual(r.second.b.startedCalls, 0);
  assert.strictEqual(r.second.bodyClass, true); assert.strictEqual(r.second.inert, true); assert.ok(runs(r.second.a)); assert.strictEqual(r.second.recA, true);
});
test("Use here: the button greys with \"Moving here…\" under it; the first window keeps and saves (its hand-over), lets go and shows the page, writing nothing more; the second starts", () => {
  assert.deepStrictEqual(r.useHere.moving, { text: "Moving here…", disabled: true });
  assert.ok(runs(r.useHere.b), JSON.stringify(r.useHere.b)); assert.strictEqual(r.useHere.recB, true);
  assert.ok(shows(r.useHere.a)); assert.strictEqual(r.useHere.a.handed, 1); assert.strictEqual(r.useHere.a.lostHook, 1); assert.strictEqual(r.useHere.aWrites, true, "every write asks winLost() first: true now");
  assert.strictEqual(r.useHere.b.moving, ""); assert.strictEqual(r.useHere.b.useDisabled, false);
});
test("closing the window in use: the other, a page that ran Fiala before, starts again by itself once it is seen, never in the 2.5 s after a goodbye, and only once", () => {
  assert.strictEqual(r.closeOther.early, 0); assert.deepStrictEqual(r.closeOther.a.went, ["reload"]);
});
test("the window in use asleep (a phone tab in the background): a new window opens Fiala within a second with no page; the sleeper, woken, stops at its first write and shows the page", () => {
  assert.deepStrictEqual(r.asleep.mid, { cover: false, started: 0 }); assert.ok(runs(r.asleep.b), JSON.stringify(r.asleep.b)); assert.strictEqual(r.asleep.recB, true);
  assert.strictEqual(r.asleep.aFirstWrite, true); assert.ok(shows(r.asleep.a)); assert.strictEqual(r.asleep.a.lostHook, 1); assert.strictEqual(r.asleep.a.handed, 0);
});
test("the window in use on screen but busy (no answer, its record says on screen): never taken quietly; Use here takes it 0.8 s after no answer", () => {
  assert.ok(shows(r.busy.b), JSON.stringify(r.busy.b)); assert.ok(runs(r.busy.afterUse), JSON.stringify(r.busy.afterUse)); assert.ok(shows(r.busy.a));
});
test("the twenty-sixth check round (R26-WIN-1): when the busy window's long task ends, the Use here waiting behind it finds Fiala already taken in the lock's own registry, though its copy of the record still names it (Chrome): no hand-over runs and nothing is stored, so the change the coach made meanwhile in the window now in use stays (its old queue replaced it)", () => {
  const y = r.busyYield;
  assert.strictEqual(y.bPage, true, "busy on screen: the page first, never taken quietly"); assert.ok(runs(y.bTook), JSON.stringify(y.bTook)); assert.strictEqual(y.staleAtWake, true, "as its task ends, its own copy of the record still names it (the case)");
  assert.strictEqual(y.aHanded, 0, "no hand-over in a window whose lock was taken"); assert.strictEqual(y.queue, "B's queue: 140", "the queue the window in use stored stays");
  assert.ok(runs(y.b), JSON.stringify(y.b)); assert.strictEqual(y.recB, true); assert.ok(shows(y.a), JSON.stringify(y.a)); assert.strictEqual(y.a.lostHook, 1); assert.strictEqual(y.aSeesB, true);
});
test("a reload of the window in use keeps Fiala there: the window showing the page never takes it in the gap", () => {
  assert.ok(runs(r.reload.a2), JSON.stringify(r.reload.a2)); assert.ok(shows(r.reload.b)); assert.strictEqual(r.reload.recA2, true);
});
test("a window closed while the other checks at once (its focus): no take in the 2.5 s after its goodbye (a reload there keeps Fiala), then the other carries on by itself", () => {
  assert.deepStrictEqual(r.pause.soon, { started: 0, cover: true }); assert.ok(runs(r.pause.later), JSON.stringify(r.pause.later));
});
test("a window opened unseen (a tab restored, a preload) never asks or takes while hidden; shown, it opens Fiala when the window in use sleeps", () => {
  assert.deepStrictEqual(r.unseen.hidden, { cover: true, started: 0, held: 0 }); assert.ok(runs(r.unseen.shown), JSON.stringify(r.unseen.shown));
});
test("a sign-in or password link opened in a new window is used there: the window in use hands over, without the page, and the link stays in the address for the sign-in", () => {
  assert.ok(runs(r.link.b), JSON.stringify(r.link.b)); assert.ok(shows(r.link.a)); assert.strictEqual(r.link.a.handed, 1); assert.strictEqual(r.link.hash, "#access_token=x&type=recovery");
});
test("Use here in a window that lost Fiala starts it again with the move asked in the address (never in sessionStorage: a page that cannot keep it would loop), and the marker leaves the address", () => {
  assert.deepStrictEqual(r.backHere.went, ["/?here=1"]); assert.ok(runs(r.backHere.a2), JSON.stringify(r.backHere.a2)); assert.ok(shows(r.backHere.b)); assert.strictEqual(r.backHere.address, "https://app.example/");
});
test("a record naming another window (a steal whose notice has not come yet) stops the first write and shows the page", () => {
  assert.strictEqual(r.record.lost, true); assert.ok(shows(r.record.a)); assert.strictEqual(r.record.a.lostHook, 1);
});
test("back from the back/forward cache (Safari 26 lets its locks go there): with nobody in between Fiala carries on quietly; with another window run meanwhile, the page (its copy is old)", () => {
  assert.ok(runs(r.bfcache.a), JSON.stringify(r.bfcache.a)); assert.strictEqual(r.bfcache.recVis, "visible"); assert.strictEqual(r.bfcache.held.length, 1);
  assert.ok(shows(r.bfcacheMoved.a), JSON.stringify(r.bfcacheMoved.a));
});
test("no Web Locks (Safari before 15.4), or the lock refused outright: Fiala opens at once and never stops, as since v305", () => {
  for (const s of [r.noLocks.a, r.noLocks.b, r.refused.a]) assert.deepStrictEqual({ started: s.startedCalls, cover: s.cover, lost: s.lost, on: s.on }, { started: 1, cover: false, lost: false, on: false });
});
test("hidden and shown again while running: the record says where it was seen last (gone at a goodbye), and the words are kept when it goes out of sight and dropped when it comes back", () => {
  assert.deepStrictEqual(r.visHooks, { hiddenVis: "hidden", shownVis: "visible", hiddenHook: 1, shownHook: 1, gone: "gone" });
});
test("the page's own parts broken (markup the script does not find): Fiala still opens, never a page that cannot open", () => {
  assert.strictEqual(r.broken.a, 1); assert.strictEqual(r.broken.bAsleepHolder, 1);
});
test("three windows, two Use here at once: exactly one window runs Fiala", () => {
  assert.strictEqual(r.three.a, 1); assert.strictEqual(r.three.b, true); assert.strictEqual(r.three.c, true);
  assert.strictEqual(r.three.running.length, 1); assert.strictEqual(r.three.held.length, 1); assert.ok(r.three.held[0].startsWith(r.three.running[0] + ":"));
});

// The app's side (win-app-probe.mjs, the real main.js and sync.js signed in as the coach on the stand-in server).
const a = JSON.parse(execFileSync(process.execPath, [path.join(here, "win-app-probe.mjs")], { encoding: "utf8", timeout: 120000 }).trim().split("\n").pop());
test("the app starts once its window holds Fiala, the record naming it", () => {
  assert.deepStrictEqual(a.booted, { signedIn: true, coach: true, workout: true, lost: false, rec: true });
});
test("the drafts add-on (the owner's yes, 19 Nov 2026): the hand-over keeps, for this account, a sheet's words (Health & safety here), a card's half-written note with the note its box was opened on, and the notes box; then the sheet closes as Cancel, saving nothing", () => {
  assert.deepStrictEqual(a.kept, { owner: "coach@x.com", tab: true, text: { "safety:c1/limits": "Left knee: no lunges" }, cards: [["w1/1", "Knee ok, sore after set 3"]], bases: [["w1/1", "Knee ok"]], notes: [["c1", "Asked about his knee"]] });
  assert.strictEqual(a.sheetClosed, true); assert.strictEqual(a.savedByMove, undefined);
});
test("the page Fiala moves to takes the words back once: the note boxes as they were (with the note asked about if one was written meanwhile), and the sheet's words the next time that sheet opens for the same thing, then never again", () => {
  assert.deepStrictEqual(a.taken, { notes: [["c1", "Asked about his knee"]], cards: [["w1/1", "Knee ok, sore after set 3"]], bases: [["w1/1", "Knee ok"]], text: [["safety:c1/limits", "Left knee: no lunges"]], left: null });
  assert.strictEqual(a.sheetBack, "Left knee: no lunges"); assert.strictEqual(a.sheetOnce, "Left knee");
});
test("the kept words come back only at the same account's sign-in: never at a start before anyone signed in (the device remembers the coach, his session ended elsewhere), never to another account signing in (Jane), and they go when the session ends elsewhere with nothing waiting", () => {
  assert.deepStrictEqual(a.bootNoSession, { cards: [], notes: [], text: [], left: true, signedIn: false });
  assert.deepStrictEqual(a.otherAccount, { cards: [], notes: [], text: [], left: false, client: true });
  assert.deepStrictEqual(a.sameAccount, { cards: ["card by coach@x.com"], notes: ["notes by coach@x.com"], text: ["typed by coach@x.com"], left: false, base: "Knee ok" });
  assert.deepStrictEqual(a.wiped, { left: null, text: 0, signedIn: false });
  assert.deepStrictEqual(a.clientSignOut, { left: null, signedIn: false }, "her own Sign out takes her kept words away");
  assert.deepStrictEqual(a.offlineSame, { cards: ["card by coach@x.com"], notes: ["notes by coach@x.com"], text: ["typed by coach@x.com"], left: false, offline: true }, "carrying on offline as the account the device remembers");
});
test("another account's kept words are never given back, and leave the device; a window shown again while it runs Fiala drops only its own kept words; Sign out takes them away", () => {
  assert.deepStrictEqual(a.foreign, { notes: 0, cards: 0, text: 0, left: null });
  assert.strictEqual(a.shownDrops, null); assert.strictEqual(a.shownKeepsOthers, true);
  assert.deepStrictEqual(a.signOut, { left: null, text: 0, signedIn: false });
});
test("the write gate: once the record names another window, nothing more is stored (the queue, the device copy, any key), sent or read from the server (a save asked for or waiting from before, a sync, another page's queue, the device's database, the session, a photo folder to delete); the session's refresh stops; the library's SIGNED_OUT wipes nothing, and a Sign out there signs out nothing and wipes nothing", () => {
  assert.deepStrictEqual(a.again, { signedIn: true, lost: false }); assert.strictEqual(a.beforeLoss.server, "Legs (here)");
  assert.deepStrictEqual(a.loss, { lost: true, stopped: 1 });
  assert.deepStrictEqual(a.afterLoss, { libOuts: 0, marked: { dirty: false, timers: false }, adopted: false, idbAfter: 0, sessions: 0, lsSet: false, synced: false, changed: [], calls: [], server: "Legs (here)", afterEvent: true, roleKept: true });
});
test("the twenty-sixth check round (R26-TW-2): a Sign out started in the window that lost Fiala, with no photo work left to wait for, goes on to its wipe and still wipes nothing the window in use needs: the photo copies in the browser's cache stay (that window showed initials), nothing leaves the device's database, the library is not signed out", () => {
  assert.deepStrictEqual(a.lostSignOut, { pwAt: false, cacheDeletes: [], signedInAfter: false, idbOut: 0 }, JSON.stringify(a.lostSignOut));
  assert.strictEqual(a.afterLoss.libOuts, 0); assert.deepStrictEqual(a.afterLoss.changed, []); assert.strictEqual(a.afterLoss.roleKept, true);
  assert.deepStrictEqual(a.lostDrop, [], "the photo copies' own drop (a session ended elsewhere) deletes nothing from there either");
});
