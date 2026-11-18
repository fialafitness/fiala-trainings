// The audit of 15 Nov 2026, #22: the client's phone judged a monthly plan by its own day, the server by Los Angeles's. A client in Hawaii,
// in the two hours after Los Angeles's midnight on the plan's last day (three in summer), got no workouts back, and the phone took that as "deleted",
// wiping the day's queued finish and logged sets. The phone now asks both days (plan-end-probe.mjs, run in Honolulu's time).
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test, assert } from "./assert.js";
const here = path.dirname(fileURLToPath(import.meta.url));
const r = JSON.parse(execFileSync(process.execPath, [path.join(here, "plan-end-probe.mjs")], { encoding: "utf8", timeout: 60000, env: { ...process.env, TZ: "Pacific/Honolulu" } }).trim().split("\n").pop());

test("(#22) Hawaii, the plan's last day, just after Los Angeles's midnight: the queued finish and sets stay, and so does the workout", () => {
  assert.strictEqual(r.phoneDay, "2026-11-15", "the phone is still on the plan's last day (the probe ran in Honolulu's time)");
  assert.deepStrictEqual({ finish: r.finish, sets: r.sets, dirty: r.dirty, onDevice: r.onDevice }, { finish: true, sets: true, dirty: true, onDevice: true });
});

test("(v315) the same moment on the client page: Plan ended and the plan card's Ended, never an empty list with nothing said (the server holds the workouts back by Los Angeles's day)", () => {
  assert.deepStrictEqual({ view: r.view, kicker: r.kicker, card: r.card }, { view: "client", kicker: "Plan ended", card: true }, "the Plan ended caption and card, though the phone's own day is still the plan's last");
  assert.ok(/^Ended /.test(r.planBig), "the plan card says Ended (" + r.planBig + ")"); assert.ok(/^Your plan ended /.test(r.cardText), r.cardText);
});

test("(v315) the coach's Clients list reads the same two clocks: Plan ended once Los Angeles is past the plan's day, Ends today on Los Angeles's last day", () => {
  assert.strictEqual(r.listEnded, "Plan ended", "a coach's device in Honolulu, the plan's last day there, Los Angeles already past it: the server holds the workouts back");
  assert.strictEqual(r.listNext, "Ends today", "a plan ending on Los Angeles's today: its last day, by the server's clock");
});
