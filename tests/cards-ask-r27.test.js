// v321, the owner's pick "Ask first" (25 Nov 2026, after pictures) for R26-CRD-7's join: the coach's own number change (the number picker, a number
// typed then left, or typed then picked over) that would join the card of a note box holding his half-written words into a card whose note is on
// another exercise asks first, in the app's question sheet: "Discard what you wrote?", "<Exercise>’s card already has <client>’s note, and a card
// shows one note." ("already has a note" when it is the coach's own), Discard (red) and Cancel. Cancel changes nothing (the number as it was, his
// words in the box, here and on the server); Discard joins and the words go, as before the question. The join is measured against the numbers as
// the page will draw them (the exercise moved goes last in its new superset). Read on the real page as cards-follow-probe.mjs draws it (out.r27.ask,
// and out.r27.own.join). The number box exists in the coach's own look only (read-only in his Client view; none on the client's phone). Made-up people only.
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test, assert } from "./assert.js";

const probeAt = path.join(path.dirname(fileURLToPath(import.meta.url)), "cards-follow-probe.mjs");
let probed = null;
const probe = () => { if (!probed) { try { probed = { r: JSON.parse(execFileSync(process.execPath, [probeAt], { encoding: "utf8", timeout: 120000 }).trim().split("\n").pop()) }; } catch (e) { probed = { e }; } } if (probed.e) throw probed.e; return probed.r; };
const ask = () => { const r = probe(); assert.deepStrictEqual([r.found, r.r24 && r.r24.foundBase], [{ sets: 1, maps: 1, distinct: true }, { maps: 1, distinct: true }], "the probe could not tell main.js's card note stores apart: " + JSON.stringify([r.found, r.r24 && r.r24.foundBase])); assert.deepStrictEqual(r.rejected, [], "a tap threw: " + JSON.stringify(r.rejected)); return r.r27; };
const ran = (o, at = "") => assert.ok(o && !o.error, at + "the case did not run: " + (o && o.error));
const Q = (text) => ({ open: true, title: "Discard what you wrote?", text, yes: "Discard", red: true });
const LP_Q = Q("Leg press’s card already has Mia’s note, and a card shows one note."), LC_Q = Q("Leg curl’s card already has Mia’s note, and a card shows one note.");
const LEGS = ["1 Back squat", "2 Leg press [client: Knee ok today]", "3 Leg curl [client: Calves tight]", "4 Calf raise"];   // Legs as it was: two cards, each with a note of Mia's
const JOINED = ["1 Back squat", "2a Leg press [client: Knee ok today]", "2b Leg curl [client: Calves tight]", "4 Calf raise"];
const nothing = { open: [], drafts: {}, bases: {} };

test("the coach's own number change that would join Leg curl's card, his Edit box on Mia's note holding \"Calves tight, stretch first\" (not saved yet), into Leg press's card, which holds Mia's note \"Knee ok today\", asks first: \"Discard what you wrote?\", \"Leg press’s card already has Mia’s note, and a card shows one note.\", Discard (red) and Cancel; by the number picker, by 2 typed in the number box and then a tap elsewhere, and by 4 typed and 2 then picked over; Cancel changes nothing: Leg curl stays 3 (the number box too), his words stay in the box, here and on the server, and from the keyboard its place is the number box again; Discard joins them (2a Leg press, 2b Leg curl) and his box and words go (v321, the owner's pick \"Ask first\" for R26-CRD-7's join: the words went without a word)", () => {
  const a = ask().ask;
  for (const how of ["pick", "typed", "typed then picked"]) {
    const no = a[how + " no"], yes = a[how + " yes"], at = "(" + how + ") ";
    ran(no, at + "(Cancel) "); ran(yes, at + "(Discard) ");
    for (const o of [no, yes]) assert.deepStrictEqual([o.typed, o.asked], ["Calves tight, stretch first", LP_Q], at + "the number change did not ask first, or asked in other words: " + JSON.stringify([o.typed, o.asked, o.typedNo, o.picked]));
    assert.deepStrictEqual([no.cards, no.labels, no.here, no.server, no.notes.drafts, no.q], [["Back squat", "Leg press", "Leg curl [box: Calves tight, stretch first]", "Calf raise"], ["lp:2", "lc:3", "cr:4"], LEGS, LEGS, { 3: "Calves tight, stretch first" }, { open: false }], at + "Cancel changed something: the number, his words in the box, or Legs here or on the server: " + JSON.stringify(no));
    assert.deepStrictEqual([yes.cards, yes.labels, yes.here, yes.server, yes.box, yes.notes], [["Back squat", "Leg press+Leg curl", "Calf raise"], ["lp:2a", "lc:2b", "cr:4"], JOINED, JOINED, [], nothing], at + "Discard did not join Leg curl to Leg press, or left his box or words behind: " + JSON.stringify(yes));
  }
  assert.strictEqual(a["typed no"].focus, "Leg curl's number box", "(typed, Cancel) the keyboard's place did not come back to the number box the change was asked from (2 typed, then Tab): " + JSON.stringify(a["typed no"].focus));
  const j = ask().own.join; ran(j, "(own.join) ");
  assert.deepStrictEqual([j.asked, j.asked2], [LP_Q, { open: false }], "(own.join) the join did not ask first, or Calf raise given 3 afterwards asked: " + JSON.stringify(j));
});

test("the other way round, measured as the page will draw the cards (the exercise moved goes last in its new superset): Leg press, his Edit box on Mia's note holding \"Knee ok today, seat lower\", given 3 beside Leg curl (Mia's note \"Calves tight\" stays first, 3a) asks \"Discard what you wrote?\" with \"Leg curl’s card already has Mia’s note…\"; Cancel changes nothing; Discard makes 3a Leg curl, 3b Leg press and his box goes; 3a typed for Leg press beside Leg curl's box asks too (Leg press's note goes first and Leg curl's box would go); and Leg press with no box given 3 beside Leg curl's box asks nothing and keeps Leg curl's box with his words on the card joined (it was measured with Leg press first and the box went)", () => {
  const a = ask().ask, J3 = ["1 Back squat", "3a Leg curl [client: Calves tight]", "3b Leg press [client: Knee ok today]", "4 Calf raise"];
  for (const reply of ["no", "yes"]) {
    const o = a["reverse " + reply], at = "(Leg press given 3, " + (reply === "yes" ? "Discard" : "Cancel") + ") "; ran(o, at);
    assert.deepStrictEqual([o.typed, o.asked], ["Knee ok today, seat lower", LC_Q], at + "the join did not ask, or asked in other words: " + JSON.stringify(o));
    if (reply === "no") assert.deepStrictEqual([o.cards, o.labels, o.here, o.server], [["Back squat", "Leg press [box: Knee ok today, seat lower]", "Leg curl", "Calf raise"], ["lp:2", "lc:3", "cr:4"], LEGS, LEGS], at + "Cancel changed something: " + JSON.stringify(o));
    else assert.deepStrictEqual([o.cards, o.labels, o.here, o.server, o.notes], [["Back squat", "Leg curl+Leg press", "Calf raise"], ["lp:3b", "lc:3a", "cr:4"], J3, J3, nothing], at + "Discard did not join with Leg curl first, or left his box: " + JSON.stringify(o));
  }
  for (const reply of ["no", "yes"]) {
    const o = a["typed 3a into the box " + reply], at = "(3a typed for Leg press, " + (reply === "yes" ? "Discard" : "Cancel") + ") "; ran(o, at);
    const J3A = ["1 Back squat", "3a Leg press [client: Knee ok today]", "3b Leg curl [client: Calves tight]", "4 Calf raise"];
    assert.deepStrictEqual([o.typedNo, o.asked], ["3a", LP_Q], at + "Leg press typed first into the card of Leg curl's box did not ask: " + JSON.stringify(o));
    if (reply === "no") assert.deepStrictEqual([o.cards, o.labels, o.here, o.server], [["Back squat", "Leg press", "Leg curl [box: Calves tight, stretch first]", "Calf raise"], ["lp:2", "lc:3", "cr:4"], LEGS, LEGS], at + "Cancel changed something (Leg press's number not put back, or Leg curl's box gone): " + JSON.stringify(o));
    else assert.deepStrictEqual([o.cards, o.labels, o.here, o.server, o.notes], [["Back squat", "Leg press+Leg curl", "Calf raise"], ["lp:3a", "lc:3b", "cr:4"], J3A, J3A, nothing], at + "Discard did not join with Leg press first, or left Leg curl's box: " + JSON.stringify(o));
  }
  const o = a["into the box"]; ran(o, "(into the box) ");
  assert.deepStrictEqual([o.asked, o.cards, o.labels, o.here, o.notes.drafts], [{ open: false }, ["Back squat", "Leg curl+Leg press [box: Calves tight, stretch first]", "Calf raise"], ["lp:3b", "lc:3a", "cr:4"], J3, { 3: "Calves tight, stretch first" }], "(into the box) Leg press joining Leg curl's card asked, or Leg curl's box and his words went: " + JSON.stringify(o));
});

test("no question where nothing he typed is at stake: Edit opened on Leg curl's note with nothing typed, then Leg curl given 2 (joined at once); Leg curl, his words in the box, given 4 beside Calf raise holding no note (the box goes with Leg curl, its note the card's); an Add note box with his words on Leg curl, no note anywhere, Leg curl given 2 (joined, as before); and with the coach's own note on Leg press the line says \"already has a note\" (v321, the owner's pick \"Ask first\")", () => {
  const a = ask().ask;
  const n = a["nothing typed"]; ran(n, "(nothing typed) ");
  assert.deepStrictEqual([n.asked, n.cards, n.labels, n.here, n.server], [{ open: false }, ["Back squat", "Leg press+Leg curl", "Calf raise"], ["lp:2a", "lc:2b", "cr:4"], JOINED, JOINED], "(nothing typed) an Edit box with nothing typed asked, or the number did not change: " + JSON.stringify(n));
  const f = a["no other note"]; ran(f, "(no other note) ");
  const F4 = ["1 Back squat", "2 Leg press [client: Knee ok today]", "4a Calf raise", "4b Leg curl [client: Calves tight]"];
  assert.deepStrictEqual([f.asked, f.cards, f.labels, f.here, f.notes.drafts], [{ open: false }, ["Back squat", "Leg press", "Calf raise+Leg curl [box: Calves tight, stretch first]"], ["lp:2", "lc:4b", "cr:4a"], F4, { 4: "Calves tight, stretch first" }], "(no other note) joining a card with no other note asked, or the box did not go with Leg curl: " + JSON.stringify(f));
  const d = a["add note, no other note"]; ran(d, "(Add note, no note anywhere) ");
  assert.deepStrictEqual([d.typed, d.asked, d.labels, d.here, d.server], ["Seat one notch lower", { open: false }, ["lp:2a", "lc:2b", "cr:4"], ["1 Back squat", "2a Leg press", "2b Leg curl", "4 Calf raise"], ["1 Back squat", "2a Leg press", "2b Leg curl", "4 Calf raise"]], "(Add note, no note anywhere) a card holding no note asked, or the number did not change: " + JSON.stringify(d));
  const c = a["coach note"]; ran(c, "(coach note) ");
  assert.deepStrictEqual([c.asked, c.labels], [Q("Leg press’s card already has a note, and a card shows one note."), ["lp:2", "lc:3", "cr:4"]], "(coach note) the line did not say the card already has a note (the coach's own), or Cancel changed the number: " + JSON.stringify(c));
});

test("the page changes under the question: \"Discard what you wrote?\" up for Leg curl given 2, Legs deleted on the coach's iPad and a sync passes: the question goes with the page, as Cancel, and nothing is written; the same whichever answer comes after (v321, the owner's pick \"Ask first\": read again after the answer)", () => {
  const a = ask().ask;
  for (const reply of ["yes", "no"]) {
    const o = a["gone " + reply], at = "(" + reply + ") "; ran(o, at);
    assert.deepStrictEqual([o.up, o.gone, o.asked, o.here, o.server, o.q], [LP_Q, { here: false, view: "clients" }, { open: false }, [], [], { open: false }], at + "the question stayed up over the page that went, or something was written after it: " + JSON.stringify(o));
  }
});
