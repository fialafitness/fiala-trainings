// The Progress tab's counts (v310; the owner's picks after the pictures, 16 Nov 2026): the This month and Total tiles, This week
// ("1 of 3 workouts", a disc a day, and the average of the weeks before in place of weeks in a row) and the Workouts page's W, M, 6M
// and Y. The functions are pure (app/model.js) and take "today" as a day string, so these tests never depend on the clock.
import { test, assert } from "./assert.js";
import { mondayOf, finishedByDay, weekDays, weekAverage, rangeCounts } from "../app/model.js";

// a workout on a day, in one of the states the app keeps: finished (on its own day unless `on` says when), to do, skipped, or filed as missed
const mk = (date, st, on) => ({ id: date + st + (on || ""), clientId: "c1", title: "Lower body", rows: [{ id: "r" }], date,
  completedAt: st === "done" ? (on || date) + "T18:00:00" : null, skippedAt: st === "skip" || st === "filed" ? date + "T07:00:00" : null, ...(st === "filed" ? { missed: true } : {}) });

test("weeks run Monday to Sunday: a Sunday belongs to the week that began six days before, across a month's end", () => {
  assert.strictEqual(mondayOf("2026-11-16"), "2026-11-16");
  assert.strictEqual(mondayOf("2026-11-22"), "2026-11-16");
  assert.strictEqual(mondayOf("2026-11-01"), "2026-10-26");
  assert.strictEqual(mondayOf("2027-01-02"), "2026-12-28");
});

test("This week: a disc a day, done of all the week's workouts; a to-do whose day has gone is missed, today's is still to do", () => {
  const list = [mk("2026-11-16", "done"), mk("2026-11-18", "todo"), mk("2026-11-20", "todo")];
  const mon = weekDays(list, "2026-11-16");
  assert.deepStrictEqual([mon.mon, mon.sun, mon.done, mon.of], ["2026-11-16", "2026-11-22", 1, 3]);
  assert.deepStrictEqual(mon.days.map((d) => d.state), ["done", "rest", "plan", "rest", "plan", "rest", "rest"]);
  const thu = weekDays(list, "2026-11-19");
  assert.deepStrictEqual(thu.days.map((d) => d.state), ["done", "rest", "miss", "rest", "plan", "rest", "rest"], "Wednesday's workout, not done on Thursday, is missed");
  assert.deepStrictEqual([thu.done, thu.of], [1, 3]);
  const wed = weekDays(list, "2026-11-18");
  assert.strictEqual(wed.days[2].state, "plan", "today's workout is still to do all day");
});

test("This week: skipped and filed-missed workouts show as such and count among the week's workouts; empty ones count nowhere", () => {
  const empty = { id: "e", clientId: "c1", title: "", rows: [], date: "2026-11-21", completedAt: null, skippedAt: null };
  const list = [mk("2026-11-16", "skip"), mk("2026-11-17", "filed"), mk("2026-11-18", "done"), empty];
  const w = weekDays(list, "2026-11-19");
  assert.deepStrictEqual(w.days.map((d) => d.state), ["skip", "miss", "done", "rest", "rest", "rest", "rest"]);
  assert.deepStrictEqual([w.done, w.of], [1, 3]);
});

test("This week: a workout finished on another day than planned counts on the day it was finished; a day with one done and one gone undone is missed", () => {
  const list = [mk("2026-11-13", "done", "2026-11-16"), mk("2026-11-17", "done"), mk("2026-11-17", "todo")];
  const w = weekDays(list, "2026-11-19");
  assert.strictEqual(w.days[0].state, "done", "planned last Friday, finished this Monday: this week's");
  assert.strictEqual(w.days[1].state, "miss");
  assert.deepStrictEqual([w.done, w.of], [2, 3]);
});

test("the average: finished workouts a week over the 4 whole weeks before this one", () => {
  const list = [mk("2026-10-19", "done"), mk("2026-10-21", "done"), mk("2026-10-23", "skip"), mk("2026-10-26", "done"), mk("2026-10-28", "done"), mk("2026-10-30", "filed"),
    mk("2026-11-02", "done"), mk("2026-11-04", "done"), mk("2026-11-09", "done"), mk("2026-11-11", "done"), mk("2026-11-13", "done"), mk("2026-11-16", "done"), mk("2026-10-12", "done")];
  const a = weekAverage(list, "2026-11-16");
  assert.deepStrictEqual(a.weeks.map((w) => [w.mon, w.n]), [["2026-10-19", 2], ["2026-10-26", 2], ["2026-11-02", 2], ["2026-11-09", 3]], "this week and the weeks before the four are left out");
  assert.strictEqual(a.avg, 2.25);
  assert.strictEqual(weekAverage(list, "2026-11-22").avg, 2.25, "Sunday is still this week");
  assert.strictEqual(weekAverage(list, "2026-11-23").weeks[3].mon, "2026-11-16", "a new week moves the window on");
});

test("the average starts at the week of the client's first workout: no weeks of zeros before they began, nothing at all in their first week", () => {
  const list = [mk("2026-11-04", "done"), mk("2026-11-06", "todo"), mk("2026-11-10", "done"), mk("2026-11-12", "done")];
  const a = weekAverage(list, "2026-11-16");
  assert.deepStrictEqual(a.weeks.map((w) => [w.mon, w.n]), [["2026-11-02", 1], ["2026-11-09", 2]]);
  assert.strictEqual(a.avg, 1.5);
  assert.strictEqual(weekAverage(list, "2026-11-08"), null, "still in the first week: no whole week yet");
  assert.strictEqual(weekAverage([], "2026-11-16"), null);
  assert.strictEqual(weekAverage([mk("2026-12-01", "todo")], "2026-11-16"), null, "only planned ahead");
  const gap = weekAverage([mk("2026-10-19", "done"), mk("2026-11-12", "done")], "2026-11-16");
  assert.deepStrictEqual(gap.weeks.map((w) => w.n), [1, 0, 0, 1], "a week with nothing finished counts as none");
});

test("the Workouts page's ranges: W this week's days, M this month's days (the card's number), 6M 26 weeks to this one, Y 12 months to this one; finished workouts only", () => {
  const list = [mk("2026-11-16", "done"), mk("2026-11-16", "done"), mk("2026-11-18", "todo"), mk("2026-11-11", "skip"), mk("2026-10-18", "done"), mk("2026-10-17", "done"), mk("2025-12-31", "done"), mk("2025-11-30", "done")];
  const W = rangeCounts(list, "W", "2026-11-17");
  assert.deepStrictEqual(W.map((b) => b.from), ["2026-11-16", "2026-11-17", "2026-11-18", "2026-11-19", "2026-11-20", "2026-11-21", "2026-11-22"]);
  assert.deepStrictEqual(W.map((b) => b.n), [2, 0, 0, 0, 0, 0, 0]);
  const M = rangeCounts(list, "M", "2026-11-16");
  assert.deepStrictEqual([M.length, M[0].from, M[29].to], [30, "2026-11-01", "2026-11-30"], "the calendar month, days to come included");
  assert.strictEqual(M.reduce((s, b) => s + b.n, 0), 2, "October's are last month's");
  assert.deepStrictEqual([rangeCounts(list, "M", "2028-02-10").length, rangeCounts(list, "M", "2026-12-31").length], [29, 31]);
  const H = rangeCounts(list, "6M", "2026-11-16");
  assert.deepStrictEqual([H.length, H[0].from, H[25].from, H[25].to], [26, "2026-05-25", "2026-11-16", "2026-11-22"]);
  assert.strictEqual(H[25].n, 2);
  const Y = rangeCounts(list, "Y", "2026-11-16");
  assert.deepStrictEqual([Y.length, Y[0].from, Y[0].to, Y[11].from, Y[11].to], [12, "2025-12-01", "2025-12-31", "2026-11-01", "2026-11-30"]);
  assert.deepStrictEqual([Y[0].n, Y[10].n, Y[11].n], [1, 2, 2], "Nov 30 last year is before the year shown");
  assert.deepStrictEqual([...finishedByDay(list).entries()].sort(), [["2025-11-30", 1], ["2025-12-31", 1], ["2026-10-17", 1], ["2026-10-18", 1], ["2026-11-16", 2]]);
});
