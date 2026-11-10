// After an exercise gets a new number (picked from the coach's number picker, or typed), the page glides to THAT exercise, not to the top
// of its card (his ask, 9 Nov: "if I just added 3c it jumps to 3c and not 3a"). Opening a client's note from the Notes tab still shows
// the whole card, its note unfolded.
import { test, assert } from "./assert.js";
import { load } from "./load.js";
const { fns } = await load();

test("a new number: the page goes to that exercise (3c), not to the top of its card (3a); a note from the Notes tab shows the whole card", () => {
  const card = { id: "card 3" };
  const row3c = { id: "3c", closest: (s) => (s === ".block" ? card : null) };
  assert.strictEqual(fns.followEl(row3c), row3c, "a number picked or typed: the exercise itself");
  assert.strictEqual(fns.followEl(row3c, false), row3c, "the same, said out loud");
  assert.strictEqual(fns.followEl(row3c, true), card, "a note opened from the Notes tab: the whole card");
  const alone = { id: "x", closest: () => null };
  assert.strictEqual(fns.followEl(alone, true), alone, "no card around it: the exercise");
});
