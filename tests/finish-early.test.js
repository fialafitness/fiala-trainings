// His ask, 12 Nov: "until all exercises are marked as completed finish workout button stays same as skip workout and says finish early
// ... but now in both views coach and client ... finish early will ask for are you sure ... those two buttons will be split half and half
// and will be sitting next to each other until all exercises are marked as completed. then it becomes this full width finish workout as we
// have it now". His pick for the question: worded as the exercise's own ("Finish this exercise?", "2 of 4 sets completed."), its button
// purple, not red. Finishing for good runs in its own process (finish-early-probe.mjs): the "Nice work" screen it puts up would stay up
// in this shared one.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { test, assert } from "./assert.js";
const here = path.dirname(fileURLToPath(import.meta.url));
const got = JSON.parse(execFileSync(process.execPath, [path.join(here, "finish-early-probe.mjs")], { encoding: "utf8", timeout: 60000 }).trim().split("\n").pop());
const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const src = fs.readFileSync(new URL("../app/main.js", import.meta.url), "utf8");
const EARLY = { label: "Finish early", quiet: true, split: true };       // a quiet pill like Skip workout, the two side by side
const ASK = (text) => ({ up: true, title: "Finish this workout early?", text, yes: "Finish early", red: false });

test("an exercise still open: Finish early, quiet like Skip workout and beside it, in the coach's view, the client's and the coach's Client view", () => {
  assert.deepStrictEqual(got.coachPaint, EARLY, "the coach's own view (it was the purple Finish workout there)");
  assert.deepStrictEqual(got.clientPaint, EARLY, "the client's");
  assert.deepStrictEqual(got.previewPaint, EARLY, "the coach looking as the client");
  assert.deepStrictEqual(got.allDonePaint, { label: "Finish workout", quiet: false, split: false }, "every exercise done: the purple Finish workout across the whole width, Skip under it");
  assert.deepStrictEqual(got.skippedPaint.split, false, "a skipped workout: its line with Undo, no pair");
  assert.deepStrictEqual(got.coachYes.paint.split, false, "finished: the pair goes with the buttons");
});

test("Finish early asks first, worded as the exercise's question; Cancel keeps the workout open, Finish early finishes it", () => {
  assert.deepStrictEqual(got.coachAsk, ASK("1 of 2 exercises completed. The remaining one will stay incomplete."), "the coach: its button purple, not red (nothing is lost)");
  assert.deepStrictEqual(got.coachCancel, { finished: false, by: null, queued: false, up: false }, "Cancel: still open, the sheet gone");
  assert.deepStrictEqual(got.coachYes, { finished: true, by: null, queued: false, up: false, paint: got.coachYes.paint }, "Finish early: finished, the coach's own save");
  assert.deepStrictEqual(got.clientAsk, ASK("No exercises completed yet. The remaining 2 will stay incomplete."), "the client, nothing done yet");
  assert.deepStrictEqual(got.clientYes, { finished: true, by: "client", queued: true }, "the client's finish: news for the coach, queued for the server's rule");
  assert.deepStrictEqual(got.previewAsk, ASK("4 of 5 exercises completed. The remaining one will stay incomplete."), "the coach's Client view asks as the client's page does");
  assert.deepStrictEqual(got.previewCancel, { finished: false, by: null, queued: false });
  assert.deepStrictEqual(got.supersetAsk, ASK("1 of 3 exercises completed. The remaining 2 will stay incomplete."), "counted as the page's cards: a superset (2a, 2b) is one, done only when both are");
});

test("no question when every exercise is done; none on a skipped workout; a finish or another page meanwhile: the answer finishes nothing more", () => {
  assert.deepStrictEqual(got.allDone, { asked: false, finished: true, by: null, queued: false }, "Finish workout finishes at once");
  assert.deepStrictEqual(got.skipped, { asked: false, finished: false, by: null, queued: false }, "skipped: nothing to finish");
  assert.deepStrictEqual(got.finishedMeanwhile, { at: "2026-11-12T08:00:00.000Z", by: "client" }, "finished meanwhile: the answer keeps that finish, its time and its maker");
  assert.deepStrictEqual(got.otherPage, { w1: false, w2: false }, "another workout's page by the answer: neither is finished (the finish takes the page's workout)");
  assert.deepStrictEqual(got.deleteAfter, { up: true, title: "Delete this workout?", text: "", yes: "Delete", red: true }, "the next question that deletes is red again, with its own word");
});

test("the page: Finish early first, Skip workout beside it in a grid of two halves; the button asks through finishTap", () => {
  const wrap = (html.match(/<div class="finish" id="finishWrap" hidden>[\s\S]*?\n    <\/div>/) || [""])[0];
  assert.ok(wrap.indexOf('id="finishBtn"') > 0 && wrap.indexOf('id="finishBtn"') < wrap.indexOf('id="skipLine"'), "Finish first (left), Skip workout second (right)");
  assert.ok(html.includes("  .finish.split { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }"), "two equal halves, 12 apart (Skip sits 12 under Finish when they stack); minmax(0, ...) so a long label never widens its half");
  assert.ok(html.includes("  .finish.split .btn { min-width: 0; white-space: normal; line-height: 1.2; text-align: center; }"), "with the phone's larger Text Size a label wraps inside its half, never past the screen's edge");
  assert.ok(html.includes("  .finish.split #skipLine { margin-top: 0; min-height: 0; }"), "Skip workout level with Finish early, not 12 below it");
  assert.ok(src.includes('$("finishBtn").addEventListener("click", finishTap);'), "the button asks first when it is Finish early");
  assert.ok(src.includes('$("finishWrap").classList.toggle("split", left && !done && !skipped);'), "the pair only while it can still be finished");
  assert.ok(src.includes("const left = t.rows.some((r) => !r.done);"), "in either view (no longer the client's page alone)");
  assert.ok(html.includes('<button class="btn danger" id="askYes" type="button">Delete</button>'), "the sheet's button starts red: only Finish early asks for purple");
});
