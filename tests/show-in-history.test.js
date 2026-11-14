// His ask, 14 Nov (v297), after pictures of it on the test phone: "when I am scrolling trough finished workouts and click show in history ..
// it goes to history but I want it to show the actual workout in the history so it opens up the workout in the history". Show in History
// (the preview's foot on one of History's workouts: finished, skipped, or missed and filed there) opens the workout itself. History comes up
// as its card opens it (the workout's groups open, its row in the middle) and the workout opens from that row in the same moment, as a tap
// on the row does: Back is History at the row, and Back again the client's page where it was. The page runs in its own process
// (show-in-history-probe.mjs): a Safari tab's steps, the swipe back's pictures as they are taken, its own clock.
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test, assert } from "./assert.js";
const here = path.dirname(fileURLToPath(import.meta.url));
const r = JSON.parse(execFileSync(process.execPath, [path.join(here, "show-in-history-probe.mjs")], { encoding: "utf8", timeout: 90000 }).trim().split("\n").pop());
const HIST = "client/c1/////|history|", CLIENT = "client/c1/////||";
const onPage = (shown, extra = {}) => ({ view: "client", id: "c1", from: null, shown: [shown], preview: null, ...extra });
const opened = (id, extra = {}) => ({ view: "training", id, from: "history", shown: ["vTraining"], preview: null, y: 0, ...extra });
const STEPS = ["push +1", "push +2"];                                  // History's step, then the workout's

test("Show in History opens the workout itself, at its top, in the same moment (no timer between: History is never left up to be painted); it keeps its words (his pick, 11 Nov)", () => {
  assert.deepStrictEqual(r.before, onPage("vClient", { y: 600, month: true }), "the coach, 600 down the client's month");
  assert.strictEqual(r.go, "Show in History");
  const { pics, ...now } = r.atOnce;
  assert.deepStrictEqual(now, opened("old", { depth: 2, key: "training/old/////||", steps: STEPS }));
  assert.deepStrictEqual(r.after, opened("old", { depth: 2, key: "training/old/////||", steps: STEPS, backKey: HIST, backLabel: "History", shots: [CLIENT, HIST], page: null, kept: { name: "training", id: "old", from: "history" }, row: true, lit: false, block: "center" }),
    "Back says History and goes there; the device keeps the workout as the page up, opened from History (a reload opens it, and its Back still goes to History); its row was scrolled into the middle of History, and is not lit: nobody saw History");
});

test("each page is a step of its own: the app's own swipe back from the workout (the home-screen app, the Mac) has History under it with the workout's row in the middle, and History's the client's page as it was left (the week, the list where it was)", () => {
  assert.deepStrictEqual(r.atOnce.pics, [{ page: "vClient", y: 380, week: true }, { page: "vHistory", y: 700 }], "(600 down the month is 380 down the week: the month folds as the page is left)");
});

test("Back: History, the workout's year and its month opened for it (an earlier year is folded, and in it every month but its latest), at its row; Back again: the client's page where it was, on its week; the steps come out one at a time", () => {
  assert.deepStrictEqual(r.back1, onPage("vHistory", { y: 700, depth: 1, key: HIST, steps: [...STEPS, "go -1"], row: true, page: { open: "history", from: false } }));
  assert.deepStrictEqual(r.back2, onPage("vClient", { y: 380, depth: 0, key: CLIENT, steps: [...STEPS, "go -1", "go -1"], week: true, page: null }));
});

test("a keyboard's Enter (or VoiceOver's) on it acts at once, as on Start workout; a workout of this week: This week's group", () => {
  assert.strictEqual(r.keyGo, "Show in History");
  assert.deepStrictEqual(r.key, opened("wk", { depth: 2, key: "training/wk/////||", steps: STEPS, row: true,
    back1: onPage("vHistory", { y: 700, depth: 1, key: HIST, steps: [...STEPS, "go -1"] }), back2: onPage("vClient", { y: 0, depth: 0, key: CLIENT, steps: [...STEPS, "go -1", "go -1"] }) }));
});

test("a skipped workout opens the same way; one of last week's, so its month of this year, folded while This week has one, is opened for it", () => {
  assert.strictEqual(r.skipGo, "Show in History");
  assert.deepStrictEqual(r.skip, opened("skip", { depth: 2, key: "training/skip/////||", steps: STEPS, row: true, back1: onPage("vHistory", { y: 700 }), back2: onPage("vClient", { y: 0 }) }));
});

test("with the coach's Settings on Open workouts in: Client, it opens in the client's look, as a tap on its row in History does", () => {
  assert.deepStrictEqual(r.asClient, opened("old", { client: true }));
});

test("the client's own app: their workout, from their own History; Back is their History at it, then their page, with no step left behind it", () => {
  assert.strictEqual(r.clientGo, "Show in History");
  assert.deepStrictEqual(r.client, opened("old2", { depth: 2, key: "training/old2/////||", steps: STEPS, mode: true, backLabel: "History", row: true,
    back1: onPage("vHistory", { y: 700, row: true }), back2: onPage("vClient", { y: 0, stepsLeft: 0 }) }));
});

test("a workout a sync deleted while its preview was up: the preview closes, nothing opens, no step, no picture", () => {
  assert.deepStrictEqual(r.gone, onPage("vClient", { y: 0, depth: 0, key: CLIENT, steps: [], pics: [] }));
});

test("one still to do: Start workout opens it from the client's page, as before (Back goes there, not to History)", () => {
  assert.strictEqual(r.todoGo, "Start workout");
  assert.deepStrictEqual(r.todo, { view: "training", id: "todo", from: null, shown: ["vTraining"], preview: null, y: 0, depth: 1, key: "training/todo/////||", steps: ["push +1"], backKey: CLIENT,
    back: onPage("vClient", { y: 0, depth: 0, key: CLIENT, steps: ["push +1", "go -1"] }) });
});
