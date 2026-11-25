// v321, the twenty-sixth check round's one-window findings on the app's side (app/win.js decides which window runs Fiala; main.js keeps what is
// typed for the window it moves to, and stops once it has moved). win-app-r27-probe.mjs, one mode per process, all at once: the real main.js,
// sync.js and photos.js behind the real win.js on the stand-in server, made-up people. (The lock's own side: win.test.js; the round's earlier
// fixes: win-r26.test.js.)
import path from "node:path";
import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { test, assert } from "./assert.js";
const here = path.dirname(fileURLToPath(import.meta.url));
const MODES = ["fold", "bootHidden", "bootHidden handover", "bootHiddenFail", "empty", "retake", "offlineCard", "offlineNotes", "failCard", "exercise", "wheel", "restore", "blur", "signIn", "signInOwn", "signInGuards", "lostSwitch", "photoLost", "photoCache", "photoWait", "photoReset", "sheets", "lostClient", "wake", "foldText", "exerciseLeft"];
const run = (m) => new Promise((done) => execFile(process.execPath, [path.join(here, "win-app-r27-probe.mjs"), ...m.split(" ")], { encoding: "utf8", timeout: 120000 }, (e, so, se) => {
  if (e) { done({ err: m + ": " + String((se || "") + (e.message || e)).slice(-600) }); return; }
  try { done(JSON.parse(String(so).trim().split("\n").pop())); } catch (_) { done({ err: m + ": " + String(so).slice(-600) }); }
}));
const r = Object.fromEntries(await Promise.all(MODES.map(async (m) => [m, await run(m)])));
const ok = (m) => { assert.strictEqual(r[m].err, undefined, r[m].err); assert.strictEqual(r[m].error, undefined, r[m].error); return r[m]; };
const NOTE = "Knee sore on set 3, check next week", CARD = [["w1/1", NOTE]];

// R26-WAP-3, R26-WIN-4, R26-PRV-4: the words another window kept for this account wait until a start takes them
test("the twenty-sixth check round (R26-WAP-3): this page goes out of sight before its start has taken the card note window A kept for this account, with the coach's notes box half typed here: both are kept on the device under this page (A's note folded in, never written over), and back on screen the device copy goes while both stay on the page (R26-TW-4: the phone's case, a tab taken while it sleeps, rests on this hook)", () => {
  const x = ok("fold");
  assert.deepStrictEqual(x.atHide, { tab: "this page", owner: "coach@x.com", text: {}, cards: CARD, bases: [["w1/1", ""]], notes: [["c1", "Asked about his knee"]] }, JSON.stringify(x));
  assert.deepStrictEqual(x.inPage, CARD); assert.deepStrictEqual(x.afterShown, { left: null, inPage: CARD });
});
for (const how of ["", " handover"]) test("the twenty-sixth check round (R26-WAP-3, R26-WIN-4): window B starts on one bar (1.5 s a request) and, before its start has taken the card note window A kept, " + (how ? "hands Fiala over again (Use here back in A): A, started afresh, gets the note" : "goes out of sight: its start ends with the note, and the device keeps it while B is out of sight (it may be taken while it sleeps)"), () => {
  const x = ok("bootHidden" + how);
  assert.deepStrictEqual(x.before, { signedIn: true, taken: 0 }, "B's pages up from the device copy, the note not taken yet (the case)");
  assert.deepStrictEqual(x.atHook && x.atHook.cards, CARD, "the note kept on the device at B's hook: " + JSON.stringify(x.atHook));
  assert.deepStrictEqual(x.taken, CARD, "the note taken: " + JSON.stringify(x));
  if (how) assert.strictEqual(x.left, null, "taken off the device by the window that runs Fiala");
  else assert.deepStrictEqual([x.left && x.left.tab, x.left && x.left.cards], ["this page", CARD], "B, still out of sight, keeps it on the device: " + JSON.stringify(x.left));
});
test("the twenty-sixth check round (R26-WAP-3, R26-WAP-4): the card note B folded in as it went out of sight during its start is drawn by that start on B's workout page, though its first sync fails (no sync comes to draw it, and leaving the workout dropped it unseen)", () => {
  const x = ok("bootHiddenFail");
  assert.deepStrictEqual({ folded: x.folded, drawnAtHide: x.drawnAtHide }, { folded: ["w1/1"], drawnAtHide: 0 }, "folded in, not drawn yet (the case)");
  assert.ok(/Couldn.t sync/.test(x.status), "the first sync failed (the case): " + x.status); assert.strictEqual(x.boxes, 1, JSON.stringify(x));
});
test("the twenty-sixth check round (R26-WIN-4, R26-PRV-4): with nothing typed in this page as it goes out of sight, its own words kept earlier go, and another account's as before, but words another window kept go only with the start that takes them", () => {
  const x = ok("empty");
  assert.deepStrictEqual(x, { own: null, otherAccount: false, unknownOwner: true });
});
// R26-WAP-6
test("the twenty-sixth check round (R26-WAP-6): a page carrying on offline with Jane's limits typed in Health & safety, kept as it went out of sight, signs in again while away (the online event): the words stay on the page and on the device, never as words to give back, so after his Save and her later change the field opens with her new words", () => {
  const x = ok("retake");
  assert.deepStrictEqual(x.keptAway, { "safety:c1/limits": "Left knee: no lunges" }, "kept as it went out of sight (the case)");
  assert.deepStrictEqual(x.afterSignIn, { signedIn: true, offline: false, keptText: [], left: true }, JSON.stringify(x.afterSignIn));
  assert.strictEqual(x.sheet, "Left knee: no lunges"); assert.strictEqual(x.boxNextTime, "Knee fine now, lunges OK");
});
// R26-WAP-4
test("the twenty-sixth check round (R26-WAP-4): the card note window A kept is drawn on the workout page of a start that carries on offline (no session within 4 s), so leaving the workout never drops it unseen", () => {
  const x = ok("offlineCard");
  assert.deepStrictEqual(x, { entry: "remembered", view: "training", drafts: ["w1/1"], boxes: 1 });
});
test("the twenty-sixth check round (R26-WAP-4): the coach's notes box kept by window A is filled on Jane's page as a start carrying on offline draws it", () => {
  assert.deepStrictEqual(ok("offlineNotes"), { entry: "remembered", view: "client", box: "Asked about his knee" });
});
test("the twenty-sixth check round (R26-WAP-4): the same with the session at once and the first sync failing (Couldn't sync): the note's box is drawn on the pages already up", () => {
  const x = ok("failCard");
  assert.ok(/Couldn.t sync/.test(x.status), "the first sync failed (the case): " + x.status);
  assert.deepStrictEqual({ drafts: x.drafts, boxes: x.boxes }, { drafts: ["w1/1"], boxes: 1 });
});
// R26-WAP-7
test("the twenty-sixth check round (R26-WAP-7): the exercise page's changes not saved yet (the line under the name, a video link) are kept at Use here and come back once on that page in the window Fiala moves to, still unsaved; saved with Done, older kept words of it never come back over what was saved", () => {
  const x = ok("exercise");
  assert.deepStrictEqual(x.kept, { "exercise:backsquat": JSON.stringify({ name: "Back squat", sub: "High bar, heels on plates", video: "https://youtu.be/abc123xyz00" }) });
  assert.deepStrictEqual(x.newWindow, { page: "exercise", sub: "High bar, heels on plates", video: "https://youtu.be/abc123xyz00" });
  assert.deepStrictEqual(x.again, x.painted, "given back once only");
  assert.strictEqual(x.doneTo, "exercises", "Done saved and went back to the list (the case)");
  assert.deepStrictEqual(x.afterSave, { sub: "", video: "https://youtu.be/zzz999yyy11", keptLeft: false }, JSON.stringify(x.afterSave));
});
// R26-WAP-9, R26-WIN-2, R26-TW-8's h_handBlur: what the hand-over keeps
test("the twenty-sixth check round (R26-WAP-9): a Health details wheel still turning when Use here is pressed in the other window keeps the value under its band (170 lb), queued for the window Fiala moves to", () => {
  const x = ok("wheel");
  assert.deepStrictEqual(x, { lost: true, dirty: true, weight: { v: 170, u: "lb" }, server: null });
});
test("the twenty-sixth check round (R26-WIN-2): Use here while a restore's read after its tap is still out waits for it: the restore he confirmed lands and goes with the queue (or reaches the server first), never thrown away", () => {
  const x = ok("restore");
  assert.deepStrictEqual({ asked: x.asked, reading: x.reading, lost: x.lost }, { asked: true, reading: true, lost: true }, "the question answered, the read out at Use here (the case)");
  assert.ok(x.server === "Legs (from backup)" || x.queued === "Legs (from backup)", "the restore was thrown away: " + JSON.stringify(x));
  assert.ok(x.handOverMs < 3900, "the hand-over took " + x.handOverMs + " ms");
});
test("the twenty-sixth check round (R26-TW-8): a box still being typed in at Use here lets go first, so its change (60 becomes 60 sec) goes with the queue", () => {
  assert.deepStrictEqual(ok("blur"), { lost: true, rest: "60 sec" });
});
// R26-WIN-6
test("the twenty-sixth check round (R26-WIN-6) with R27-PRV-1: Use here while the other window was signing in: when that sign-in lands (the library tells this page SIGNED_IN) on this empty sign-in page, nothing here names that account, so the page stays on its sign-in page as it was, reads nothing, and that sign-in is signed out on this device (another person may be at this page; a reload or Use here opened it); the email typed here naming it goes in (tests/vprv27.test.js)", () => {
  const x = ok("signIn");
  assert.deepStrictEqual(x.before, { shown: ["vLogin"], signedIn: false }, "the sign-in page (the case)");
  assert.deepStrictEqual(x.after, { shown: ["vLogin"], signedIn: false, as: "", coach: true, status: "", password: "something typed here" }); assert.strictEqual(x.roleChecks, 0); assert.strictEqual(x.library, null);
});
test("the twenty-sixth check round (R26-WIN-6): this page's own Sign in (Jane's) is out when another window's sign-in lands: the page waits for its own, and runs as the account the library holds", () => {
  assert.deepStrictEqual(ok("signInOwn"), { library: "jane@x.com", page: "jane@x.com", client: true, roleChecks: 1 });
});
test("the twenty-sixth check round (R26-WIN-6): SIGNED_IN never signs in a page with an account's pages up, the Create account page, a page whose sign-out is still on its way, or the New password page", () => {
  const x = ok("signInGuards");
  assert.deepStrictEqual(x.signedInPage, { as: "coach@x.com", coach: true, roleChecks: 0 });
  assert.deepStrictEqual(x.signUpPage, { page: ["vSignup"], shown: ["vSignup"], signedIn: false });
  assert.deepStrictEqual(x.signingOut, { page: ["vLogin"], signedIn: false, signingOut: true });
  assert.deepStrictEqual(x.recovery, { page: ["vRecovery"], shown: ["vRecovery"], signedIn: false });
});
// R26-PRV-4 (G)
test("the twenty-sixth check round (R26-PRV-4): Jane's sign-in on a page holding the coach's waiting work loses Fiala during her role check (Use here in window B): the start goes no further, so the words B keeps and the workouts B made stay on the device, and nothing more is asked of the server", () => {
  assert.deepStrictEqual(ok("lostSwitch"), { owner: "coach@x.com", lost: true, keptLeft: true, madeLeft: true, calls: [] });
});
// R26-WAP-8
test("the twenty-sixth check round (R26-WAP-8): Jane's photo upload still out at Use here marks nothing from the old window when it comes back, so her second pick, made in the window now in use, stays her photo", () => {
  assert.deepStrictEqual(ok("photoLost"), { client: true, lost: true, fromHere: [], photo: "v2second" });
});
test("the twenty-sixth check round (R26-WAP-8): the photo cache, every window's: a photo pass running at the move prunes nothing from it, and a photo drawn after the move writes nothing into it (the window in use's copy stays)", () => {
  assert.deepStrictEqual(ok("photoCache"), { lost: true, cacheWrites: [], kept: ["hers-new.jpg", "old0.jpg"] });
});
// R26-PRV-5
test("the twenty-sixth check round (R26-PRV-5, the round 25 writers' held-out case): the coach's waiting photo of a client survives the Wi-Fi coming back during Jane's role check, her Sign out on Couldn't reach the server, and his sign-in sends it with his change", () => {
  const x = ok("photoWait");
  assert.deepStrictEqual(x.waits, { owner: "coach@x.com", dirty: ["clients/c1"], photo: true }, "(the setup)");
  assert.deepStrictEqual(x.problem, { shown: ["vWaiting"], signedIn: true, photo: true }, "the coach's photo was dropped during her role check: " + JSON.stringify(x.problem));
  assert.deepStrictEqual(x.tapped, { shown: ["vLogin"], signedIn: false, owner: "coach@x.com", dirty: ["clients/c1"], photo: true });
  assert.deepStrictEqual(x.server, { phone: "3105550170", photo: true });
});
test("the twenty-sixth check round (R26-PRV-5): the same after a password-reset link left unfinished (the device remembers the coach, the library holds Jane's session at the next launch): his photo waits through her role check and the online event, and reaches the server at his sign-in", () => {
  const x = ok("photoReset");
  assert.deepStrictEqual(x, { waits: { owner: "coach@x.com", photo: true }, problem: { shown: ["vWaiting"], as: "jane@x.com", photo: true }, server: { photo: true } });
});
// R26-TW-4
test("the twenty-sixth check round (R26-TW-4): the drafts add-on's other sheets, an exercise's instructions, New folder, New slide and Rename, keep their words and give them back the next time they open in the window Fiala moves to; a sheet left with Cancel keeps nothing; words given back to the coach's page are gone when Jane signs in on it", () => {
  const x = ok("sheets");
  assert.deepStrictEqual(x, { noteKept: "Keep the back straight", noteBack: "Keep the back straight", folderKept: "Strength block", folderBack: "Strength block", slideKept: "Week 1", slideBack: "Week 1", renameKept: "Strength 2026", renameBack: "Strength 2026", noteCancel: null, askCancel: null, textCancel: null, jane: { client: true, keptText: [] } });
});
// R26-TW-8
test("the twenty-sixth check round (R26-TW-8): Jane's Sign out started in a window that lost Fiala wipes nothing of the device the window in use needs (her remembered role, the queue, the workouts made, the kept words)", () => {
  const x = ok("lostClient");
  assert.deepStrictEqual({ before: x.before.client, lost: x.lost, signedIn: x.signedIn }, { before: true, lost: true, signedIn: false });
  assert.deepStrictEqual(x.left, x.had, JSON.stringify(x));
});
test("the twenty-sixth check round (R26-TW-8): the screen kept on for a workout lets go once Fiala moves to another window, and a tap in that window takes no new hold", () => {
  assert.deepStrictEqual(ok("wake"), { held: true, lost: true, afterLoss: { held: false, releases: 1 }, requestsAfterTap: 0 });
});

// v321, the twenty-seventh check round (tests lens): R26-WAP-3's fold for a sheet's words, and R26-WAP-7's two guards (no test held them)
test("the twenty-seventh check round (tests lens, R26-WAP-3): a sheet's words another window kept for this account (New folder's half-typed name) stay on the device when this page goes out of sight before its start took them: with nothing typed here, and with the notes box half typed here", () => {
  const x = ok("foldText");
  assert.deepStrictEqual(x.alone && x.alone.text, { "name:folder:": "Strength block" }, "nothing typed here: " + JSON.stringify(x.alone));
  assert.deepStrictEqual(x.withNotes && x.withNotes.text, { "name:folder:": "Strength block" }, "the notes box typed here: " + JSON.stringify(x.withNotes));
  assert.deepStrictEqual(x.withNotes.notes, [["c1", "Asked about his knee"]], "the notes box kept too");
});
test("the twenty-seventh check round (tests lens, R26-WAP-7): the exercise page keeps nothing for the window Fiala moves to when nothing on it changed, nor once it was left with Back > Discard (the words he discarded never come back as unsaved)", () => {
  const x = ok("exerciseLeft");
  assert.ok(!x.untouched || !Object.keys(x.untouched).some((k) => k.startsWith("exercise:")), "nothing changed: " + JSON.stringify(x.untouched));
  assert.deepStrictEqual([x.asked, x.page], ["Discard the changes?", "exercises"], "(the setup: Back asks, Discard goes back to the list) " + JSON.stringify(x));
  assert.ok(!x.discarded || !Object.keys(x.discarded).some((k) => k.startsWith("exercise:")), "discarded: " + JSON.stringify(x.discarded));
});
