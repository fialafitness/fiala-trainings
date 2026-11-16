// The owner's screenshot, 15 Nov 2026 (v309): "In setting a program the blue border stays after clicking ... fix it". The Plan pop-up on the
// coach's card for a client kept a blue ring after its menu closed. Measured on the simulator (iOS 27.2): a tapped select matches
// :focus-visible, so WebKit drew its own ring (the same blue, 14,86,142 on the dark card, as in his screenshot) from the tap until something
// else took the focus, the menu closed or not, a plan picked or not. Now a tap leaves no ring on it, nor on the Monthly report's Month (the
// same pop-up). A keyboard's move gets the app's ring round the value and its chevrons, as every other control's: Tab, Shift-Tab or Safari's
// Option-Tab (never Cmd-Tab or Ctrl-Tab, which leave), and on a computer also a focus that no press on its row brought (Tab from the address bar). A phone's typing
// followed by its next-field arrow is no keyboard's move, and the window or the app going and coming back changes nothing (the v309
// review). The page runs in its own process (pop-ring-probe.mjs), as a phone and as a computer (main.js's deskOn).
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test, assert } from "./assert.js";
const here = path.dirname(fileURLToPath(import.meta.url));
const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const run = (mode) => JSON.parse(execFileSync(process.execPath, [path.join(here, "pop-ring-probe.mjs"), mode], { encoding: "utf8", timeout: 90000 }).trim().split("\n").pop());
const phone = run("touch"), mac = run("desk");
const pick = (r, keys) => Object.fromEntries(keys.map((k) => [k, r[k]]));
const IDS = ["planSel", "repMonth"];

test("a tap or a click on the Plan or Month pop-up leaves no ring: not while its menu is up, not after a pick, not after it closes, nor a press on its name", () => {
  assert.strictEqual(phone.desk, false); assert.strictEqual(mac.desk, true, "the computer's run is a computer (deskOn)");
  for (const [r, where] of [[phone, "phone"], [mac, "computer"]]) for (const id of IDS) {
    assert.deepStrictEqual(pick(r[id], ["tapped", "picked", "closed", "namePressed", "typedThenTapped"]), { tapped: false, picked: false, closed: false, namePressed: false, typedThenTapped: false }, where + ", " + id);
  }
  assert.ok(html.includes("  .settings-list .pop-sel select:focus { outline: none; }"), "WebKit's own ring is never drawn round the select (a tapped select matches :focus-visible on iOS)");
});

test("Tab, Shift-Tab or Safari's Option-Tab onto it gives the app's ring round the value and its chevrons, gone when the focus goes or a press lands on its row", () => {
  for (const [r, where] of [[phone, "phone"], [mac, "computer"]]) for (const id of IDS) {
    assert.deepStrictEqual(pick(r[id], ["tabbed", "tabbedAway", "shiftTabbed", "optionTab", "pressedAfterTab", "namePressedAfterTab"]), { tabbed: true, tabbedAway: false, shiftTabbed: true, optionTab: true, pressedAfterTab: false, namePressedAfterTab: false }, where + ", " + id);
  }
  assert.ok(html.includes("  .settings-list .pop-sel.keys { outline: 2px solid var(--brand); outline-offset: 2px; border-radius: 8px; }"), "the ring, as the exercise name's pop-up wears it");
});

test("on a phone only Tab is a keyboard's move: typing and then the next-field arrow, Cmd-Tab or Ctrl-Tab, or a focus with no key, give no ring (the v309 review)", () => {
  for (const id of IDS) assert.deepStrictEqual(pick(phone[id], ["typedThenArrow", "cmdTab", "ctrlTab", "noKeyNoPress"]), { typedThenArrow: false, cmdTab: false, ctrlTab: false, noKeyNoPress: false }, id);
  assert.deepStrictEqual(phone.capture, { keydown: [true], pointerdown: [true] }, "one listener each tells a Tab from a press, and reads it before anything on the page can stop it");
});

test("on a computer a focus that no press on its row brought gets the ring: Tab from the address bar, VoiceOver, even after an earlier click on that row (the v309 review)", () => {
  for (const id of IDS) assert.deepStrictEqual(pick(mac[id], ["noKeyNoPress", "typedThenArrow", "focusAfterOldPress", "addressBarAfterRowPress", "reclickedThenAddressBar", "reclickedThenVO", "cancelledPressThenAddressBar", "namePressRefocus"]), { noKeyNoPress: true, typedThenArrow: true, focusAfterOldPress: true, addressBarAfterRowPress: true, reclickedThenAddressBar: true, reclickedThenVO: true, cancelledPressThenAddressBar: true, namePressRefocus: false }, id);
  for (const id of IDS) assert.deepStrictEqual(pick(phone[id], ["focusAfterOldPress", "addressBarAfterRowPress", "reclickedThenAddressBar", "reclickedThenVO", "cancelledPressThenAddressBar", "namePressRefocus"]), { focusAfterOldPress: false, addressBarAfterRowPress: false, reclickedThenAddressBar: false, reclickedThenVO: false, cancelledPressThenAddressBar: false, namePressRefocus: false }, "a phone: only Tab, " + id);
});

test("the window or the app going and coming back changes nothing: a clicked pop-up gets no ring after Cmd-Tab, a tabbed one keeps its ring, Safari's second focus too (the v309 review)", () => {
  for (const [r, where] of [[phone, "phone"], [mac, "computer"]]) for (const id of IDS) {
    assert.deepStrictEqual(pick(r[id], ["pickedAway", "pickedBack", "pickedBackTwice", "tabbedAway2", "tabbedBack", "tabbedBackTwice", "tabbedBackLeft", "awayThenPressed", "tabbedBackWinFocusFirst", "pickedBackWinFocusFirst"]), { pickedAway: false, pickedBack: false, pickedBackTwice: false, tabbedAway2: true, tabbedBack: true, tabbedBackTwice: true, tabbedBackLeft: false, awayThenPressed: false, tabbedBackWinFocusFirst: true, pickedBackWinFocusFirst: false }, where + ", " + id);
  }
});

test("the page getting the focus back on another control (Safari's Tab from the address bar, which moves it with no blur) takes the ring off and lets the next Tab onto it ring (the v309 review, third round)", () => {
  for (const [r, where] of [[phone, "phone"], [mac, "computer"]]) for (const id of IDS) {
    assert.deepStrictEqual(pick(r[id], ["tabOutFromAddressBar", "tabOutThenClickElsewhere", "clickedThenTabAlong"]), { tabOutFromAddressBar: false, tabOutThenClickElsewhere: false, clickedThenTabAlong: true }, where + ", " + id);
  }
});
