// His rule, 10 Nov: a workout missed by more than a week files itself under History as "Missed" (the Missed card keeps a week), and the
// month never shows a skipped workout. The redraw that files one draws the week and the month after the filing, so the month lets its red
// chip go together with the Missed card's row, not a redraw later: on the day's first sync (a Mac left on a client's month overnight, or the
// month opened before a slow first sync) and on the coach's Reschedule to a day more than a week back. The page plays in its own process
// (cal-filing-probe.mjs).
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test, assert } from "./assert.js";
const here = path.dirname(fileURLToPath(import.meta.url));
const r = JSON.parse(execFileSync(process.execPath, [path.join(here, "cal-filing-probe.mjs")], { encoding: "utf8", timeout: 60000 }).trim().split("\n").pop());

test("the day's first sync, the month open: the workout it files under History leaves the month in the same redraw as it leaves the Missed card", () => {
  assert.strictEqual(r.open, true, "the month is open");
  assert.deepStrictEqual([r.yesterday.old.chips, r.yesterday.filed, r.yesterday.missed], [["miss:OLD"], false, ["late", "old"]], "an answer from yesterday files nothing: red on the month, on the card");
  assert.deepStrictEqual([r.synced.filed, r.synced.missed], [true, ["late"]], "the day's first answer files it");
  assert.deepStrictEqual(r.synced.old, { chips: [], label: r.days.old }, "and the month no longer shows it, nor says it to VoiceOver");
  assert.deepStrictEqual(r.synced.late.chips, ["miss:LATE"], "missed within the week: still red");
});

test("the coach's Reschedule to a day more than a week back, the month open: filed at once, and that day shows no red chip for it", () => {
  assert.deepStrictEqual([r.rescheduled, r.moved.filed, r.moved.missed], [true, true, ["late"]]);
  assert.deepStrictEqual(r.moved.mv, { chips: [], label: r.days.mv });
});
