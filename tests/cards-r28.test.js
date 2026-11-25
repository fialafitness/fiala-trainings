// v321, the twenty-eighth check round (the data lens, R28-DAT-5 and R28-DAT-6): a merge lands under his caret while he has typed a number in an
// exercise's number box and a card note box holds his words, read on the real page as cards-follow-probe.mjs draws it (out.r28). Made-up people only.
// - R28-DAT-5: Mia's note on Leg curl edited (his words added, not saved), 2 typed in Leg curl's number box (Leg press's card, her note); her Start
//   this exercise on Calf raise merged by his number's save: Leg curl goes with Leg press (3a Leg press, 3b Leg curl) and the box with it, under
//   Leg press's note. Save note asked "Replace the note written meanwhile?" quoting her Leg press note, and Replace wrote his Leg curl words over
//   it. Save note now writes on the exercise the box was opened on while that exercise still holds the note it was opened on (main.js saveNote).
// - R28-DAT-6: the iPad's Delete of Back squat merged instead (Leg press 1, Leg curl with it, Calf raise 3): "Discard what you wrote?" answered
//   Cancel put Leg curl back on 3, which the merge had given Calf raise (3a Calf raise, 3b Leg curl: a superset nobody made, on her phone too);
//   the same after her set brought back the exercise he had deleted. Cancel now gives it a number of its own after the card drawn before it
//   (askJoin); a warm-up stays a warm-up.
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test, assert } from "./assert.js";

const probeAt = path.join(path.dirname(fileURLToPath(import.meta.url)), "cards-follow-probe.mjs");
let probed = null;
const probe = () => { if (!probed) { try { probed = { r: JSON.parse(execFileSync(process.execPath, [probeAt], { encoding: "utf8", timeout: 120000 }).trim().split("\n").pop()) }; } catch (e) { probed = { e }; } } if (probed.e) throw probed.e; return probed.r; };
const r28 = () => { const r = probe(); assert.ok(r.r28, "the probe drew no r28 cases"); return r.r28; };
const ran = (o, at = "") => assert.ok(o && !o.error, at + "the case did not run: " + (o && o.error));
const Q = (text) => ({ open: true, title: "Discard what you wrote?", text, yes: "Discard", red: true });

test("R28-DAT-5: his Leg curl words, the box come under Leg press's note when her Start merged under his caret (2 typed in Leg curl's number box): Save note writes them on Leg curl, the exercise its box was opened on, asking nothing, and her Leg press note stays hers (it asked \"Replace the note written meanwhile?\" quoting her Leg press note, and Replace wrote his Leg curl words over it)", () => {
  for (const reply of ["no", "yes"]) {
    const o = r28()["dat5 " + reply]; ran(o, reply + ": ");
    assert.deepStrictEqual(o.here, ["1 Back squat", "2 Calf raise", "3a Leg press [client: Knee ok today]", "3b Leg curl [client: Calves tight]"], reply + ": (the setup) Leg curl went with Leg press under his caret");
    assert.deepStrictEqual(o.save, [], reply + ": Save note asks nothing");
    for (const at of ["after", "serverAfter"]) assert.deepStrictEqual(o[at], ["1 Back squat", "2 Calf raise", "3a Leg press [client: Knee ok today]", "3b Leg curl [coach: Calves tight, stretch first]"], reply + " " + at);
  }
});
test("R28-DAT-6: the iPad's Delete of Back squat merged under his caret (2 typed in Leg curl's number box, Leg curl went with Leg press to 1): Cancel on \"Discard what you wrote?\" leaves Leg curl on a card of its own, 2, with his box, never on 3 beside Calf raise (3a Calf raise, 3b Leg curl: a superset nobody made, on her phone too); Discard still joins Leg press", () => {
  const no = r28()["dat6 no"]; ran(no, "Cancel: ");
  assert.deepStrictEqual(no.asked, Q("Leg press’s card already has Mia’s note, and a card shows one note."), "the question");
  assert.deepStrictEqual([no.sharedHere, no.sharedServer], [[], []], "no number shared by two exercises, here or on the server");
  assert.strictEqual(no.numberBox, "2", "Leg curl's number box");
  for (const at of ["after", "serverAfter"]) assert.deepStrictEqual(no[at], ["1 Leg press [client: Knee ok today]", "2 Leg curl [coach: Calves tight, stretch first]", "3 Calf raise"], "Cancel " + at + ": his box stayed with Leg curl and Save note wrote there");
  const yes = r28()["dat6 yes"]; ran(yes, "Discard: ");
  assert.deepStrictEqual(yes.serverAfter, ["1a Leg press [client: Knee ok today]", "1b Leg curl [client: Calves tight]", "3 Calf raise"], "Discard joins, his words gone");
});
test("R28-DAT-6 after a revive: her set on Leg press, his Delete of Leg press with no signal, 1 typed in Leg curl's number box (Back squat's card, her note), the signal back brings Leg press back on 2 under his caret: Cancel leaves Leg curl on a card of its own, never 2b beside Leg press", () => {
  const no = r28()["dat6 revive no"]; ran(no);
  assert.deepStrictEqual(no.asked, Q("Back squat’s card already has Mia’s note, and a card shows one note."), "the question");
  assert.ok(no.serverAfter.includes("2 Leg press"), "(the setup) Leg press came back with her set: " + no.serverAfter.join(", "));
  assert.deepStrictEqual([no.sharedHere, no.sharedServer], [[], []], "no number shared by two exercises: " + no.serverAfter.join(", "));
  assert.ok(no.serverAfter.some((x) => /^\d+ Leg curl \[coach: Calves tight, stretch first\]$/.test(x)), "his words saved on Leg curl, on a card of its own: " + no.serverAfter.join(", "));
});
test("R28-DAT-6's Cancel moves only a number: Bike, the warm-up, with his Add note box, 1 typed in its number box (Back squat's card, her note), the iPad made Calf raise a warm-up too and it merged under his caret: Cancel keeps Bike a warm-up, never a numbered card of its own", () => {
  const o = r28()["dat6 warm-up no"]; ran(o);
  assert.strictEqual(o.asked && o.asked.title, "Discard what you wrote?", "(the setup) the question came");
  assert.strictEqual(o.numberBox, "W", "Bike's number box");
  assert.ok(o.serverAfter.some((x) => /^W[a-z]? Bike/.test(x)) && !o.serverAfter.some((x) => /^\d+[a-z]? Bike/.test(x)), "Bike stays a warm-up: " + o.serverAfter.join(", "));
});
