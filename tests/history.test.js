// The browser history the app keeps, per kind of page. Each kind loads the real app in its own process (history-probe.mjs), since the
// home-screen app is told apart once, as the module loads.
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test, assert } from "./assert.js";
const probe = path.join(path.dirname(fileURLToPath(import.meta.url)), "history-probe.mjs");
const run = (mode) => JSON.parse(execFileSync(process.execPath, [probe, mode], { encoding: "utf8", timeout: 30000 }).trim().split("\n").pop());

test("the iOS home-screen app keeps no history steps, so iOS's own edge swipes never start; Back still goes back", () => {
  const r = run("ios");
  assert.deepStrictEqual(r.load, [], "no step written as the app opens");
  assert.deepStrictEqual(r.forward, [], "no step added going forward");
  assert.deepStrictEqual(r.back, [], "no step taken out going back");
  assert.strictEqual(r.depth, 0);
  assert.notStrictEqual(r.backKey, r.forwardKey, "Back changed the screen");
  assert.deepStrictEqual(r.popNull, [], "a step with no number changes nothing");
  assert.deepStrictEqual(r.popOld, ["go -1"], "a swipe onto a numbered step goes straight back to the first");
  assert.strictEqual(r.keyAfterPops, r.backKey, "the screen stays as it was");
});
test("the home-screen app updated in place, on a step an older version left, goes back to the first step and keeps it that way", () => {
  const r = run("stale");
  assert.deepStrictEqual(r.load, ["go -2"], "nothing left behind for iOS's back swipe");
  assert.deepStrictEqual(r.stateAfterLoad, { fiala: 0 });
  assert.deepStrictEqual(r.forward, [], "no new steps");
  assert.deepStrictEqual(r.back, []);
  assert.deepStrictEqual(r.popOld, ["go -1"], "iOS's forward swipe onto an old step: straight back");
  assert.strictEqual(r.keyAfterPops, r.backKey);
});
test("a Safari tab still keeps one step per screen, for Safari's own swipe", () => {
  const r = run("tab");
  assert.deepStrictEqual(r.load, ['replaceState {"fiala":0}']);
  assert.deepStrictEqual(r.forward, ['pushState {"fiala":1}']);
  assert.strictEqual(r.back[0], "go -1", "Back takes its step out");
});
