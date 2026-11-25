// v321: the card note box findings of the twenty-sixth check round (R26-CRD-1, -2, -3, -4, -6, -7) and the card note part of R26-TW-9, read on the
// real page as cards-follow-probe.mjs draws it (its out.r27, and out.r25.deleted for the test that waited for v321). Made-up people only.
// - R26-CRD-1: the person's own Delete on the note of a superset's second exercise (2b Leg curl) with the box open: Save note and Discard left the
//   box to come back at the next drawing, and words typed after the Delete were replaced by older ones there, with a false "Save a note deleted
//   meanwhile?" (noteKey went to "gone:" once no exercise of the card held a note).
// - R26-CRD-2: her Delete of that note, merged under his finger by his own save, was saved back by Save note as his, unasked (round 25's known
//   limit); by a sync, his half-written edit went without a word (relabeled dropped the box's state).
// - R26-CRD-3: Use here in another window lost a box's words when his own save had merged a note change under his finger (the note on the
//   superset's other exercise, her Delete on 2b), or while "Replace the note written meanwhile?" was up (keepTyping kept only the stores).
// - R26-CRD-4: two cards with notes joined on his iPad while his Mac edits one: Save note asked about the other card's note, and Replace wrote
//   his Leg curl words over her Leg press note.
// - R26-CRD-6: after her change came in under his finger, Hide note on a note she deleted opened an empty box or asked "Discard what you
//   wrote?", and Edit opened her newer words under her old caption.
// - R26-CRD-7: his own number change (the picker; a number typed, then left or picked over) left the card state on the old numbers: the box went
//   to another card, and Save note asked "Save a note deleted meanwhile?" and wrote on the wrong exercise.
// - R26-TW-9 (round 25's rules no test held): the caption's Delete on a note deleted under his finger asks "Delete this note?" and never quotes
//   an empty note; an emptied box over a note deleted under his finger closes, asking nothing.
// - v321, the twenty-seventh check round, the cards lens (out.r27.v, the verifier's cases; out.r27.rev, the reviewer's):
//   R27-CRD-1: Use here kept his edit of Mia's note on Leg curl (2b) for the card although her new note on Leg press (2a) had come in under his
//   finger: the window Fiala went to asked "Replace the note written meanwhile?" about her Leg press note, and Replace wrote there.
//   R27-CRD-2: her Delete of the note on 2b (or his own), then her new note on 2a, merged under his finger: words typed after went to "gone:",
//   the next drawing showed older ones, and after Save note or Discard the box came back with them.
//   R27-CRD-3: a number typed (the caret still in its box) while his number's save merged her Start this exercise or the iPad's Delete exercise:
//   the box went to Leg press's card, and Save note asked "Save a note deleted meanwhile?" and wrote there; with "Ask first", the question
//   still comes when such a merge lands, and a merge that puts his typed number beside a card with no note asks nothing.
//   R27-CRD-4: Save note wrote over another exercise's note that was on the card before ("Replace the note written meanwhile?", false), after
//   her Delete or his own of the card's note and after the iPad's join; her Delete with the iPad's regroup was saved back unasked.
//   R27-CRD-5: Add note just after her note came in on the superset's other exercise opened an empty box on a card holding her note.
//   R27-CRD-6: Save note on a box whose exercise the iPad deleted under his finger closed as if saved (See note, the dot), no note anywhere.
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test, assert } from "./assert.js";

const probeAt = path.join(path.dirname(fileURLToPath(import.meta.url)), "cards-follow-probe.mjs");
let probed = null;
const probe = () => { if (!probed) { try { probed = { r: JSON.parse(execFileSync(process.execPath, [probeAt], { encoding: "utf8", timeout: 120000 }).trim().split("\n").pop()) }; } catch (e) { probed = { e }; } } if (probed.e) throw probed.e; return probed.r; };
const found = (r) => {                                                     // the probe found main.js's note stores (the notes unfolded, half written, and what each box was opened on)
  assert.deepStrictEqual(r.found, { sets: 1, maps: 1, distinct: true }, "the probe could not tell which of main.js's stores keep the notes unfolded and the notes half written: " + JSON.stringify(r.found));
  assert.deepStrictEqual(r.r24 && r.r24.foundBase, { maps: 1, distinct: true }, "the probe could not tell which of main.js's stores keeps the note each box was opened on: " + JSON.stringify(r.r24 && r.r24.foundBase));
  return r;
};
const r27 = () => found(probe()).r27;
const ran = (o, at = "") => assert.ok(o && !o.error, at + "the case did not run: " + (o && o.error));
const says = (c) => (c ? [c.button, c.note, c.composer] : null);       // what a card shows of its note: the button's words, the note unfolded (or null), the box with its words (or null)
const edited = "Knee ok today, sore after set 3";                       // Mia's note on Leg curl, "Knee ok today", with the coach's words added in its box
const DELETED_Q = { open: true, title: "Save a note deleted meanwhile?", text: "This note was deleted after you opened it.", yes: "Save", red: false };
const DEL_Q = { open: true, title: "Delete this note?", text: "It goes from this exercise and from the notes list.", yes: "Delete", red: true };
const ss = (n2a, n2b) => ["1 Back squat", "2a Leg press" + (n2a ? " [" + n2a + "]" : ""), "2b Leg curl" + (n2b ? " [" + n2b + "]" : ""), "3 Calf raise"];   // Legs with the superset 2a Leg press, 2b Leg curl, and the notes on them
const nothing = { open: [], drafts: {}, bases: {} };                     // nothing of a note box left on the page

test("the coach's own Delete on Mia's note on a superset's second exercise (2b Leg curl), with his edit of it open in its box below (See note, Edit, his words, a tap elsewhere), answered Delete: Save note writes his words as his note and no box comes back at the next drawing of the cards; Discard (answered Discard) leaves nothing to come back; words typed on after the Delete stay in the box across the next drawing and Save note asks nothing (his own Delete is no \"meanwhile\"); the same in his Client view, and on Mia's phone with her own note (the twenty-sixth check round, R26-CRD-1: the box came back with the words just saved or discarded, and words typed after the Delete gave way to older ones, then \"Save a note deleted meanwhile?\")", () => {
  const f = r27().f1;
  for (const view of ["coach", "client view", "phone"]) {
    const mine = view === "phone" ? "Left knee hurts, sore after set 3" : edited, by = view === "phone" ? "client" : "coach";
    for (const then of ["save", "discard", "type-save"]) {
      const o = f[view + " " + then], at = "(" + view + ", " + then + ") ";
      ran(o, at);
      assert.deepStrictEqual([o.typed, o.del, says(o.afterDel.card), o.afterDel.here], [mine, view === "phone" ? { ...DEL_Q, text: "" } : DEL_Q, ["Add note", null, mine], ss(null, null)], at + "(setup) the words added to the note in its box, then the Delete on the note above it asked as \"Delete this note?\" and answered, the box still open: " + JSON.stringify([o.typed, o.del, o.afterDel]));
      if (then === "discard") {
        assert.deepStrictEqual([o.asked.map((q) => q.title), o.afterAct, o.afterRedraw, o.notes, o.here, o.server], [["Discard what you wrote?"], [], [], nothing, ss(null, null), ss(null, null)], at + "Discard asked something else, or the discarded words came back in a box at the next drawing, or the note came back: " + JSON.stringify(o));
        continue;
      }
      if (then === "type-save") assert.deepStrictEqual(o.redrawn, ["Leg press+Leg curl: " + mine + " and more"], at + "the words typed after the Delete were replaced by older ones when the cards were drawn again: " + JSON.stringify(o.redrawn));
      const saved = then === "save" ? ss(null, by + ": " + mine) : ss(by + ": " + mine + " and more", null);   // (drawn again, the card has no note: its box writes on its first exercise, as Add note does)
      assert.deepStrictEqual([o.asked, o.afterAct, o.afterRedraw, o.notes], [[], [], [], nothing], at + "Save note asked about the note deleted by the person's own Delete, or a box came back at the next drawing: " + JSON.stringify([o.asked, o.afterAct, o.afterRedraw, o.notes]));
      assert.deepStrictEqual([o.here, o.server], [saved, saved], at + "Save note did not write the words once, as the person's own note, here and on the server: " + JSON.stringify([o.here, o.server]));
      if (view === "phone") assert.deepStrictEqual(o.sent, then === "save" ? ["lc: " + mine] : ["lc: null", "lp: " + mine + " and more"], at + "her phone did not send her Delete and her note as it shows them: " + JSON.stringify(o.sent));
    }
  }
});

// Round 25's known limit, held out of the release (held-test-superset-deleted.js of the twenty-sixth check round), fixed in v321 (R26-CRD-2).
test("Save note asks \"Save a note deleted meanwhile?\" too when the note was on a superset's second exercise (2b Leg curl, the card's note) and her Delete came in with the coach's own save under his finger: a weight typed into Leg curl, See note, Edit and his words, the card still showing her note; Cancel leaves the note deleted, here and on the server; Save writes his words on Leg curl as his note; his own Delete on her note still drawn there is no \"meanwhile\" (found while the twenty-fifth check round's tests were written, R25-CRD-1 on a superset, the known limit fixed in v321 as R26-CRD-2: that merge dropped the card's note state, as Leg curl no longer takes the card's note, and Save note asked nothing and wrote her deleted words back on Leg curl as his note, here and on the server)", () => {
  const d = found(probe()).r25.deleted, w = d["superset own"];
  ran(w, "(his own Delete) ");
  assert.deepStrictEqual([w.typed, w.del && w.del.title, w.asked, w.after.here, w.after.server], [edited, "Delete this note?", [], ss(null, "coach: " + edited), ss(null, "coach: " + edited)], "(his own Delete) after his own Delete on her note still drawn on the card, Save note asked about the note he deleted, or did not write his words on Leg curl: " + JSON.stringify(w));
  for (const reply of ["cancel", "save"]) {
    const o = d["superset " + reply], at = "(" + reply + ") ";
    ran(o, at);
    assert.deepStrictEqual([o.w, o.typed, o.landed.finger, says(o.landed.card), o.landed.here, o.landed.server], ["100", edited, true, ["Hide note", "Knee ok today", edited], ss(null, null), ss(null, null)], at + "(setup) his weight and his words typed, and her Delete merged in by his save under his finger, the card still showing her note: " + JSON.stringify([o.w, o.typed, o.landed]));
    assert.deepStrictEqual(o.asked, [DELETED_Q], at + "Save note did not ask before it brought back the note she deleted on Leg curl: " + JSON.stringify(o.asked));
    const want = reply === "save" ? ss(null, "coach: " + edited) : ss(null, null);
    assert.deepStrictEqual([o.mid.here, o.after.here, o.after.server], [want, want, want], at + (reply === "save" ? "Save did not write his words on Leg curl as his note, here and on the server: " : "after Cancel the note she deleted came back, here or on the server: ") + JSON.stringify([o.mid, o.after]));
  }
});

test("her Delete of the note on a superset's second exercise (2b Leg curl) reaching the coach's Mac by a sync while his edit of it waits in its box (a tap elsewhere): the card is drawn with his box and words, and Save note asks \"Save a note deleted meanwhile?\"; Cancel keeps the box and the note deleted, and Save note once more writes his words as his note on the card, asking nothing; her Delete coming with the iPad's move of Leg curl into Calf raise's card carries no box to that card (the twenty-sixth check round, R26-CRD-2: the sync closed his box and his words went without a word)", () => {
  const r = r27(), o = r.knownSync, g = r.regroupDeleted;
  ran(o, "(sync) ");
  assert.deepStrictEqual([o.typed, o.box, o.notes.bases, o.here], [edited, ["Leg press+Leg curl: " + edited], { 2: "Knee ok today" }, ss(null, null)], "(sync) the card was drawn without his box and words, or without the note it was opened on: " + JSON.stringify(o));
  assert.deepStrictEqual([o.asked, o.mid.box, o.mid.here, o.mid.server], [[DELETED_Q], ["Leg press+Leg curl: " + edited], ss(null, null), ss(null, null)], "(sync) Save note did not ask before it brought back the note she deleted, or Cancel lost his box or brought the note back: " + JSON.stringify([o.asked, o.mid]));
  assert.deepStrictEqual([o.again, o.after.here, o.after.server, o.after.notes, o.box2], [[], ss("coach: " + edited, null), ss("coach: " + edited, null), nothing, []], "(sync) Save note once more, after Cancel, asked again, or did not write his words as his note (drawn again, the card has no note: its box writes on its first exercise, as Add note does): " + JSON.stringify([o.again, o.after, o.box2]));
  ran(g, "(with Leg curl moved) ");
  assert.deepStrictEqual([g.box, g.notes, g.here], [[], nothing, ["1 Back squat", "2 Leg press", "3a Calf raise", "3b Leg curl"]], "(with Leg curl moved) a box for a note deleted on another card was carried to Calf raise's card: " + JSON.stringify(g));
});

test("Use here in another window keeps the coach's half-written card note when his own save merged a note change under his finger: Add note on the superset 2a Leg press, 2b Leg curl and \"Knees out\", and Mia's note on Leg curl merged in (typed on after it, or with \"Replace the note written meanwhile?\" up, or in his Client view): the new window shows his box with his words, Save note there asks \"Replace the note written meanwhile?\" with her note, Cancel keeps both, and Save note once more writes his words; with her Delete of the note on 2b merged under his finger it asks \"Save a note deleted meanwhile?\"; after his own Delete, words typed on are kept as typed and nothing is asked; an Edit box with nothing typed keeps nothing (the twenty-sixth check round, R26-CRD-3: the new window showed no box, his words gone; after his own Delete it had older words and asked)", () => {
  const h = r27().h, replaceQ = "Replace the note written meanwhile? | Mia’s note: “Knee ok today”";
  for (const [name, words] of [["arrive", "Knees out"], ["arrive typed on", "Knees out today"], ["question up", "Knees out"], ["client view", "Knees out"]]) {
    const o = h[name], at = "(" + name + ") ";
    ran(o, at);
    assert.deepStrictEqual([o.w, o.finger, says(o.landed.card), o.landed.here, o.boxA], ["100", true, ["Add note", null, "Knees out"], ss(null, "client: Knee ok today"), ["Leg press+Leg curl: " + words]], at + "(setup) his weight and his words typed, and her note on Leg curl merged in by his save under his finger, his box still open: " + JSON.stringify([o.w, o.finger, o.landed, o.boxA]));
    if (name === "question up") assert.deepStrictEqual(o.q && o.q.title, "Replace the note written meanwhile?", at + "(setup) Save note did not ask in the first window: " + JSON.stringify(o.q));
    assert.deepStrictEqual([o.boxB, o.askedB, o.midB.box, o.midB.here], [["Leg press+Leg curl: " + words], [replaceQ], ["Leg press+Leg curl: " + words], ss(null, "client: Knee ok today")], at + "the window Fiala went to lost his words, or Save note there did not ask about her note, or Cancel changed something: " + JSON.stringify([o.kept, o.boxB, o.askedB, o.midB]));
    assert.deepStrictEqual([o.againB, o.afterB.box, o.afterB.here, o.afterB.server], [[], [], ss(null, "coach: " + words), ss(null, "coach: " + words)], at + "Save note once more, after Cancel (her note seen), did not write his words as the card's note: " + JSON.stringify([o.againB, o.afterB]));
  }
  const d = h["deleted 2b"]; ran(d, "(deleted 2b) ");
  assert.deepStrictEqual([d.finger, d.boxA, d.boxB, d.askedB, d.againB, d.afterB.here, d.afterB.server], [true, ["Leg press+Leg curl: " + edited], ["Leg press+Leg curl: " + edited], ["Save a note deleted meanwhile? | This note was deleted after you opened it."], [], ss("coach: " + edited, null), ss("coach: " + edited, null)], "(deleted 2b) the window Fiala went to lost his edit of the note she deleted, or did not ask before saving it: " + JSON.stringify(d));
  const w = h["own del"]; ran(w, "(own del) ");
  assert.deepStrictEqual([w.del && w.del.title, w.boxA, w.boxB, w.askedB, w.afterB.here], ["Delete this note?", ["Leg press+Leg curl: " + edited + " and more"], ["Leg press+Leg curl: " + edited + " and more"], [], ss("coach: " + edited + " and more", null)], "(own del) after his own Delete the window Fiala went to had older words, or asked about his own Delete: " + JSON.stringify(w));
  const u = h["untouched edit"]; ran(u, "(untouched edit) ");
  assert.deepStrictEqual([u.finger0, u.boxA, u.kept, u.boxB], [true, ["Leg press+Leg curl: Knee ok today"], null, []], "(untouched edit) an Edit box with nothing typed in it was kept for the window Fiala went to: " + JSON.stringify(u));
});

test("a note box never comes back on another card, whose note is another exercise's, when the coach's own save merged a regrouping under his finger and he typed on: his edit of Mia's note on Leg curl (2b) with her Delete and the iPad's move of Leg curl into Calf raise's card (3a Calf raise, 3b Leg curl); his Add note on the superset (it writes on Leg press) with the iPad's move of Leg press into Calf raise's card; his edit of her Leg curl note with the iPad's join of Leg press (her note) and Leg curl; neither when the cards are drawn again nor in the window Fiala goes to (Use here): no box there, nothing asked, no note written on Calf raise or over her Leg press note (as a sync's or a save's relabel drops the box when its exercise no longer takes its card's note: v321 keeps a card's own key, and a box's words at the hand-over, only while the card is the card drawn)", () => {
  const r = r27();
  for (const [name, rows] of [["regroup finger", ["1 Back squat", "2 Leg press", "3a Calf raise", "3b Leg curl"]], ["lead moved", ["1 Back squat", "2 Leg curl", "3a Calf raise", "3b Leg press"]]]) for (const then of ["redraw", "hand-over"]) {
    const o = r[name + " " + then], at = "(" + name + ", " + then + ") ";
    ran(o, at);
    assert.deepStrictEqual([o.w, o.finger, o.landed], ["100", true, rows], at + "(setup) his weight typed and the iPad's change merged in by his save under his finger: " + JSON.stringify(o));
    assert.deepStrictEqual([o.box, o.asked, o.here, o.server], [[], null, rows, rows], at + "his words came back in a box on Calf raise's card, or were written there as a note: " + JSON.stringify([o.box, o.asked, o.here, o.notes]));
  }
  const j = r.join["hand-over"], joined = ["1 Back squat", "2a Leg press [client: Knee ok today]", "2b Leg curl [client: Calves tight]", "3 Calf raise"];
  ran(j, "(join, hand-over) ");
  assert.deepStrictEqual([j.w, j.finger, j.box, j.asked, j.here, j.server], ["100", true, [], null, joined, joined], "(join, hand-over) the window Fiala went to offered his Leg curl words over her Leg press note (\"Replace the note written meanwhile?\" about a note nobody wrote meanwhile), or wrote them: " + JSON.stringify(j));
});

test("the hand-over keeps no card note words for another account: the coach's Add note box with his words; his session ends and Mia signs in on this page (the account switch clears the stores), and the window goes out of sight before the cards are drawn again: nothing is kept on the device (the twenty-sixth check round, R26-CRD-3: an open box answers for the account the cards were drawn for only)", () => {
  const o = r27().h.owner; ran(o, "");
  assert.deepStrictEqual([o.typed, o.kept], ["Coach draft: she skips the last rep", null], "the coach's words were kept on the device under the next account: " + JSON.stringify(o));
});

test("two cards with Mia's notes (2 Leg press \"Knee ok today\", 3 Leg curl \"Calves tight\") made one superset on the coach's iPad while his Mac edits Leg curl's note (a weight typed into Leg curl, See note, Edit, \", stretch first\", his finger in the box), merged by his weight's save: Save note asks nothing, writes his edit on Leg curl and leaves her Leg press note, here and on the server; the same in his Client view (the twenty-sixth check round, R26-CRD-4: it asked \"Replace the note written meanwhile?\" about Leg press's note, and Replace wrote his Leg curl words over it)", () => {
  const j = r27().join, joined = ["1 Back squat", "2a Leg press [client: Knee ok today]", "2b Leg curl [client: Calves tight]", "3 Calf raise"], want = ["1 Back squat", "2a Leg press [client: Knee ok today]", "2b Leg curl [coach: Calves tight, stretch first]", "3 Calf raise"];
  for (const name of ["no", "yes", "client view"]) {
    const o = j[name], at = "(" + name + ") ";
    ran(o, at);
    assert.deepStrictEqual([o.w, o.typed, o.finger, says(o.landed.card), o.landed.here], ["100", "Calves tight, stretch first", true, ["Hide note", "Calves tight", "Calves tight, stretch first"], joined], at + "(setup) his weight and his words typed, and the iPad's superset merged in by his save under his finger: " + JSON.stringify(o.landed));
    assert.deepStrictEqual([o.asked, o.here, o.server, o.box], [[], want, want, []], at + "Save note asked about the other card's note, or did not write his edit on Leg curl, or wrote over her Leg press note: " + JSON.stringify(o));
  }
});

test("after Mia's change came in under the coach's finger (her note on Leg press unfolded, a weight typed into Leg press, her change merged by his weight's save, the card still showing \"Knee ok today\"): Edit shows her newer words in the caption over the box it opens on them; Hide note on a note she deleted shows the card without it (Add note), no empty box and no \"Discard what you wrote?\", and keeps his box and words when he had one open; See note (folded) or Edit on a note she deleted shows the card without it and opens no box; Add note tapped when her note had come shows See note with her note's dot, nothing more; the same in his Client view (the twenty-sixth check round, R26-CRD-6: Edit opened her newer words under her old caption; Hide note opened an empty box, or asked \"Discard what you wrote?\" and Discard dropped his words while her deleted note stayed on the card)", () => {
  const r = r27();
  for (const view of ["coach", "client view"]) {
    const e = r["edit " + view], at = "(" + view + ") ";
    ran(e, at + "(edit) ");
    assert.deepStrictEqual([e.w, says(e.landed), e.here[1]], ["100", ["Hide note", "Knee ok today", null], "2 Leg press [client: Knee hurts now, stopping]"], at + "(edit, setup) her change merged in under his finger, the card still showing her old words: " + JSON.stringify(e));
    assert.deepStrictEqual([e.edited, says(e.after), e.notes.bases], [true, ["Hide note", "Knee hurts now, stopping", "Knee hurts now, stopping"], { 2: "Knee hurts now, stopping" }], at + "(edit) Edit opened her newer words under her old caption, or the box does not measure against them: " + JSON.stringify(e));
    const n = r["hide nobox " + view]; ran(n, at + "(hide, no box) ");
    assert.deepStrictEqual([says(n.landed), n.buttonSays, n.here[1]], [["Hide note", "Knee ok today", null], "Hide note", "2 Leg press"], at + "(hide, no box, setup) her Delete merged in under his finger, the card still showing her note: " + JSON.stringify(n));
    assert.deepStrictEqual([n.q, says(n.after), n.boxes, n.notes], [{ open: false }, ["Add note", null, null], [], nothing], at + "(hide, no box) Hide note on the note she deleted opened a box or asked something, or the deleted note stayed on the card: " + JSON.stringify(n));
    const b = r["hide box " + view]; ran(b, at + "(hide, box) ");
    assert.deepStrictEqual([b.typed, says(b.landed), b.here[1]], [edited, ["Hide note", "Knee ok today", edited], "2 Leg press"], at + "(hide, box, setup) his words in the box, and her Delete merged in under his finger, the card still showing her note: " + JSON.stringify(b));
    assert.deepStrictEqual([b.q, says(b.after), b.boxes, b.notes.bases], [{ open: false }, ["Add note", null, edited], ["Leg press: " + edited], { 2: "Knee ok today" }], at + "(hide, box) Hide note on the note she deleted asked \"Discard what you wrote?\", or dropped his box, or the deleted note stayed on the card: " + JSON.stringify(b));
  }
  const none = ["1 Back squat", "2 Leg press", "3 Leg curl"];
  for (const [name, landed, here, after] of [["see gone", ["See note", null, null], none, ["Add note", null, null]], ["edit gone", ["Hide note", "Knee ok today", null], none, ["Add note", null, null]], ["add came", ["Add note", null, null], ["1 Back squat", "2 Leg press [client: Left knee hurts on the way down]", "3 Leg curl"], ["See note", null, null]]]) {
    const o = r[name], at = "(" + name + ") ";
    ran(o, at);
    assert.deepStrictEqual([o.w, says(o.landed), o.here], ["100", landed, here], at + "(setup) her change merged in under his finger, the card still drawn as before it: " + JSON.stringify(o));
    assert.deepStrictEqual([o.tapped, o.q, says(o.after), o.boxes, o.notes.drafts, o.notes.bases], [true, { open: false }, after, [], {}, {}], at + (name === "add came" ? "Add note, tapped when her note had come under his finger, did something else than show the card with her note (See note)" : "See note or Edit on the note she deleted opened an empty box, or the card still offers the deleted note") + ": " + JSON.stringify(o));
  }
});

test("the coach's own number change with his edit of Mia's note on Leg curl open (2a Leg press, 2b Leg curl holding her note, 4 Calf raise; See note, Edit, his words, a tap elsewhere): Leg curl given 3 from the number picker, or 3 typed in its number box and then a tap elsewhere, or 3 typed and then 5 tapped in the picker (also where the box the redraw removed gets no blur, as in Safari): the box goes with Leg curl to its own card, and Save note asks nothing and writes his words on Leg curl; Leg press given 3 leaves the box with Leg curl on card 2; Leg curl given 2 beside Leg press's own note (3 Leg curl, \"Calves tight\") drops the box, and it never comes back on Calf raise given 3 (the twenty-sixth check round, R26-CRD-7: the box stayed on the old number, on Leg press's card, and Save note asked \"Save a note deleted meanwhile?\" and wrote his Leg curl words on Leg press; joined, the box came back on Calf raise's card and Save wrote them there)", () => {
  const own = r27().own;
  for (const [name, card, cards, want] of [
    ["split", "3", ["Back squat", "Leg press", "Leg curl [box: " + edited + "]", "Calf raise"], ["1 Back squat", "2 Leg press", "3 Leg curl [coach: " + edited + "]", "4 Calf raise"]],
    ["typed", "3", ["Back squat", "Leg press", "Leg curl [box: " + edited + "]", "Calf raise"], ["1 Back squat", "2 Leg press", "3 Leg curl [coach: " + edited + "]", "4 Calf raise"]],
    ["typed then picked", "5", ["Back squat", "Leg press", "Calf raise", "Leg curl [box: " + edited + "]"], ["1 Back squat", "2 Leg press", "4 Calf raise", "5 Leg curl [coach: " + edited + "]"]],
    ["typed then picked, no blur", "5", ["Back squat", "Leg press", "Calf raise", "Leg curl [box: " + edited + "]"], ["1 Back squat", "2 Leg press", "4 Calf raise", "5 Leg curl [coach: " + edited + "]"]],
    ["other", "2", ["Back squat", "Leg curl [box: " + edited + "]", "Leg press", "Calf raise"], ["1 Back squat", "2 Leg curl [coach: " + edited + "]", "3 Leg press", "4 Calf raise"]],
  ]) {
    const o = own[name], at = "(" + name + ") ";
    ran(o, at);
    assert.strictEqual(o.typed, edited, at + "(setup) his words added in the box: " + JSON.stringify(o.typed));
    if (o.picked !== undefined) assert.strictEqual(o.picked, true, at + "(setup) the number picker did not offer the number: " + JSON.stringify(o.picked));
    if (o.typedNo !== undefined) assert.strictEqual(o.typedNo, "3", at + "(setup) the number was not typed in the box: " + JSON.stringify(o.typedNo));
    assert.deepStrictEqual([o.cards, o.box, o.notes.bases], [cards, ["Leg curl: " + edited], { [card]: "Knee ok today" }], at + "the box did not go with Leg curl to its card, or does not measure against her note there: " + JSON.stringify([o.cards, o.box, o.notes]));
    assert.deepStrictEqual([o.asked, o.here, o.server, o.after], [[], want, want, []], at + "Save note asked about a note nobody deleted, or wrote his words on another exercise than Leg curl: " + JSON.stringify([o.asked, o.here, o.server]));
  }
  const j = own.join, joined = ["1 Back squat", "2a Leg press [client: Knee ok today]", "2b Leg curl [client: Calves tight]", "3 Calf raise"];
  ran(j, "(join) ");
  assert.deepStrictEqual([j.typed, j.picked, j.picked2, j.box1, j.notes1], ["Calves tight, stretch first", true, true, [], nothing], "(join) joined beside Leg press's own note, the box for Leg curl's note was not dropped with its state (a card holds one note): " + JSON.stringify(j));
  assert.deepStrictEqual([j.box2, j.here, j.server], [[], joined, joined], "(join) the dropped box came back on Calf raise's card when Calf raise took number 3, or a note changed: " + JSON.stringify(j));
});

test("Delete on Mia's note after she deleted it and the coach's own save merged that under his finger (her note unfolded, a weight typed into Leg press, the card still showing \"Knee ok today\"): it asks \"Delete this note?\" and never \"Delete the note written meanwhile?\" over an empty note; Delete or Cancel shows the card without the note, here and on the server; and Save note on an Edit box he emptied, over a note she deleted under his finger, closes the box asking nothing; the same in his Client view (R26-TW-9: two of round 25's rules no test held, a_delMeanwhileNow and a_delSaveText)", () => {
  const r = r27(), none = ["1 Back squat", "2 Leg press", "3 Leg curl"];
  for (const view of ["coach", "client view"]) {
    for (const reply of ["yes", "no"]) {
      const o = r["delGone " + reply + " " + view], at = "(" + view + ", " + (reply === "yes" ? "Delete" : "Cancel") + ") ";
      ran(o, at);
      assert.deepStrictEqual([o.w, says(o.landed.card), o.landed.here, o.landed.server], ["100", ["Hide note", "Knee ok today", null], none, none], at + "(setup) her Delete merged in under his finger, the card still showing her note: " + JSON.stringify(o.landed));
      assert.deepStrictEqual(o.q, DEL_Q, at + "the caption's Delete did not ask \"Delete this note?\" (\"Delete the note written meanwhile?\" quoting an empty note is the a_delMeanwhileNow undo): " + JSON.stringify(o.q));
      assert.deepStrictEqual([says(o.mid.card), o.mid.here, o.mid.q, says(o.after.card), o.after.here, o.after.server], [["Add note", null, null], none, { open: false }, ["Add note", null, null], none, none], at + "after the answer the card still shows the deleted note, or another question came, or a note came back: " + JSON.stringify([o.mid, o.after]));
    }
    const e = r["emptiedGone " + view], at = "(" + view + ", emptied box) ";
    ran(e, at);
    assert.deepStrictEqual([e.w, e.emptied, e.landed.finger, says(e.landed.card), e.landed.here], ["100", "", true, ["Hide note", "Knee ok today", ""], none], at + "(setup) the Edit box emptied, his caret in it, and her Delete merged in under his finger: " + JSON.stringify(e.landed));
    assert.deepStrictEqual([e.asked, says(e.mid.card), e.mid.here, says(e.after.card), e.after.here, e.after.server, e.after.notes], [[], ["Add note", null, null], none, ["Add note", null, null], none, none, nothing], at + "Save note on the emptied box over the deleted note asked something (\"Save a note deleted meanwhile?\" about nothing is the a_delSaveText undo), or the box stayed open, or a note came back: " + JSON.stringify(e));
  }
});

// ---------- v321, the twenty-seventh check round (tests lens): out.r27.tw, and the keys kept at Use here (no test held them) ----------
test("v321, the twenty-seventh check round (tests lens, R26-CRD-3) a card note saved with Save note (the box folded away) is no half-written note at Use here: nothing is kept, and no box opens in the window Fiala moves to", () => {
  const o = r27().tw.savedHand; assert.ok(o && !o.error, o && o.error);
  assert.deepStrictEqual(o.here, ["1 Back squat", "2a Leg press [coach: Knees out]", "2b Leg curl", "3 Calf raise"], "(the setup: the note saved)");
  assert.deepStrictEqual(o.boxA, [], "(the setup: the box folded away)");
  assert.deepStrictEqual([o.kept, o.boxB], [null, []], "a saved note kept as words typed, its box opened again: " + JSON.stringify(o));
});
test("v321, the twenty-seventh check round (tests lens, R26-CRD-7) his edit of Mia's note on Leg curl (2b) open; 3 typed in Leg curl's number box, then 4 (Calf raise's card) tapped in the picker, then a tap elsewhere: the box goes with Leg curl to card 4, and Save note writes his words on Leg curl, asking nothing", () => {
  const o = r27().tw.typedPickedLeft; assert.ok(o && !o.error, o && o.error);
  assert.deepStrictEqual([o.typedNo, o.picked], ["3", true], "(the setup: typed, then picked)");
  const words = "Knee ok today, sore after set 3";
  assert.deepStrictEqual(o.box, ["Calf raise+Leg curl: " + words], "the box did not follow Leg curl: " + JSON.stringify(o));
  assert.deepStrictEqual([o.asked, o.here], [[], ["1 Back squat", "2 Leg press", "4a Calf raise", "4b Leg curl [coach: " + words + "]"]], JSON.stringify(o));
});

test("v321, the twenty-seventh check round (tests lens, R26-CRD-3) at Use here a box's words are kept under its card alone: her note came in on Leg curl under his finger while he typed on in his Add note box on the superset (his typing went on under \"gone:\"), and nothing is kept under the old key beside the card's", () => {
  const o = r27().h["arrive typed on"]; assert.ok(o && !o.error, o && o.error);
  const keys = ((o.kept && o.kept.cards) || []).map((x) => x[0]);
  assert.strictEqual(keys.length, 1, "(the setup: one box kept) " + JSON.stringify(o.kept));
  assert.ok(keys.every((k) => /\/\d+$/.test(k)), "kept under a key no card draws: " + JSON.stringify(o.kept));
});
test("v321, the twenty-seventh check round (tests lens, R26-CRD-1) his edit of Mia's note on Leg curl (2b) open, his finger in it, when the iPad deletes Leg curl itself (merged with his weight's save under his finger): what he types on never lands on Leg press, the exercise left on card 2 (no box there after the redraw, nothing written on it, and none in the window Fiala moves to at Use here)", () => {
  const o = r27().tw.exerciseGone; assert.ok(o && !o.error, o && o.error);
  assert.deepStrictEqual([o.finger, o.landed], [true, ["1 Back squat", "2 Leg press", "3 Calf raise"]], "(the setup: Leg curl gone under his finger)");
  assert.deepStrictEqual([o.box, o.after], [[], ["1 Back squat", "2 Leg press", "3 Calf raise"]], "his Leg curl words went to Leg press: " + JSON.stringify(o));
  assert.deepStrictEqual(o.boxB, [], "at Use here his Leg curl words went into a box on Leg press in the window Fiala moved to: " + JSON.stringify(o));
  assert.deepStrictEqual([o.draftsLeft, o.keptAfter], [{}, null], "(R27-TW-12) his words for the exercise gone stayed on the page after the cards were drawn again (under \"gone:\"), or went to the window Fiala moved to: " + JSON.stringify(o));
});
test("v321, the twenty-seventh check round (tests lens, R26-CRD-3) the same with Use here while his finger is still in the box (the cards not drawn since Leg curl went): the window Fiala moves to opens no box with his Leg curl words on Leg press", () => {
  const o = r27().tw.exerciseGoneHand; assert.ok(o && !o.error, o && o.error);
  assert.deepStrictEqual([o.finger, o.landed], [true, ["1 Back squat", "2 Leg press", "3 Calf raise"]], "(the setup: Leg curl gone under his finger)");
  assert.deepStrictEqual(o.boxB, [], "his Leg curl words opened on Leg press: " + JSON.stringify(o));
});
test("v321, the twenty-seventh check round (tests lens, R27-TW-12): words typed on under \"gone:\" (Add note on the superset, Mia's note on Leg curl merged in under his finger by his weight's save) go with the box at the next drawing, as the card's note state goes by the rule: nothing is left that no card draws (it held back a release's reload on this page while it was open), and nothing goes to the window Fiala moves to at Use here", () => {
  const o = r27().tw.goneLeft; ran(o);
  assert.deepStrictEqual([o.w, o.finger, o.typed2, o.box1], ["100", true, "Knees out today", ["Leg press+Leg curl: Knees out today"]], "(the setup: her note merged in under his finger, his words typed on in the box) " + JSON.stringify(o));
  assert.deepStrictEqual([o.box2, o.here], [[], ss(null, "client: Knee ok today")], "(the rule: the box goes at the next drawing, her note on the card) " + JSON.stringify(o));
  assert.deepStrictEqual(o.drafts, {}, "words no card draws were left on the page: " + JSON.stringify(o));
  assert.deepStrictEqual([o.kept, o.boxB, o.draftsB], [null, [], {}], "words no card draws went to the window Fiala moved to: " + JSON.stringify(o));
});

// ---------- v321, the twenty-seventh check round (cards lens): R27-CRD-1 to -6, the verifier's cases (r27().v) and the reviewer's (r27().rev) ----------
const HERS27 = "client: Left knee hurts on the way down", REPLACE27 = "Replace the note written meanwhile? | Mia’s note: “Left knee hurts on the way down”", DELETED27 = "Save a note deleted meanwhile? | This note was deleted after you opened it.";   // her new note on Leg press, and the two questions as the cases read them (title | text)

test("v321, the twenty-seventh check round (cards lens, R27-CRD-1) her new note on Leg press (2a) merged under his finger before he opened his edit of her Leg curl note (2b) on the card not drawn again: Save note here writes on Leg curl, asking nothing; Use here in another window keeps no box for the card (whose note is Leg press's), so nothing there asks about her Leg press note or writes over it", () => {
  const r = r27().v, s = r["c1 same"], h = r["c1 hand"]; ran(s, "(same window) "); ran(h, "(Use here) ");
  assert.deepStrictEqual([s.save.asked, s.here, s.server], [[], ss(HERS27, "coach: " + edited), ss(HERS27, "coach: " + edited)], "(same window) " + JSON.stringify(s));
  assert.deepStrictEqual([h.box, h.save, h.here, h.server], [[], { box: false }, ss(HERS27, "client: Knee ok today"), ss(HERS27, "client: Knee ok today")], "(Use here) the window Fiala went to offered his Leg curl words as the card's note over hers: " + JSON.stringify(h));
});
test("v321, the twenty-seventh check round (cards lens, R27-CRD-1) the same with her new note merged while his finger is in the box: Save note here writes his edit on Leg curl, asking nothing; Use here then keeps no box (with Cancel, the same), so the window Fiala went to never offers his Leg curl words over her Leg press note", () => {
  const r = r27().rev, s = r["twoNotes same save"], h = r["twoNotes hand-over"], c = r["twoNotes cancel hand-over"];
  for (const [o, at] of [[s, "(same window) "], [h, "(hand-over) "], [c, "(hand-over, Cancel) "]]) ran(o, at);
  assert.deepStrictEqual([s.finger, s.landed.here, s.asked, s.here, s.server], [true, ss(HERS27, "client: Knee ok today"), [], ss(HERS27, "coach: " + edited + " and more"), ss(HERS27, "coach: " + edited + " and more")], "(same window) " + JSON.stringify(s));
  assert.deepStrictEqual([h.box, h.asked, h.here, h.server], [[], null, ss(HERS27, "client: Knee ok today"), ss(HERS27, "client: Knee ok today")], "(hand-over) the window Fiala went to offered his Leg curl words over her Leg press note: " + JSON.stringify([h.kept, h.box, h.asked, h.here]));
  assert.deepStrictEqual([c.box, c.here], [[], ss(HERS27, "client: Knee ok today")], "(hand-over, Cancel) " + JSON.stringify(c));
});

test("v321, the twenty-seventh check round (cards lens, R27-CRD-2) her Delete of the note on Leg curl (2b), then her new note on Leg press (2a), each merged under his finger with words typed after: the next drawing keeps every word; Save note asks \"Replace the note written meanwhile?\" with her note, and Discard asks first; after either no box comes back", () => {
  const r = r27().v, all = edited + " and more (left)";
  const d = r["c2 redraw"]; ran(d, "(redraw) "); assert.deepStrictEqual(d.box, ["Leg press+Leg curl: " + all], "(redraw) the words typed after her new note came were lost: " + JSON.stringify(d));
  const s = r["c2 save"]; ran(s, "(Save note) "); assert.deepStrictEqual([s.save.asked, s.box, s.here, s.server], [[REPLACE27], [], ss("coach: " + all, null), ss("coach: " + all, null)], "(Save note) " + JSON.stringify(s));
  const x = r["c2 discard"]; ran(x, "(Discard) "); assert.deepStrictEqual([x.q.title, x.box, x.here], ["Discard what you wrote?", [], ss(HERS27, null)], "(Discard) the discarded box came back: " + JSON.stringify(x));
});
test("v321, the twenty-seventh check round (cards lens, R27-CRD-2) his own Delete of the note on Leg curl (2b), or hers merged under his finger, then her new note on Leg press (2a) merged under his finger and words typed on: the next drawing keeps every word, Save note asks \"Replace the note written meanwhile?\" with her note, and after Save note (Replace) or Discard no box comes back", () => {
  const r = r27().rev, all = edited + " and more";
  const rd = r["residue redraw"]; ran(rd, "(own Delete, redraw) ");
  assert.deepStrictEqual([rd.typed2, rd.redrawn, rd.asked], [all, ["Leg press+Leg curl: " + all], [REPLACE27]], "(own Delete, redraw) the words typed after her note came were replaced by older ones: " + JSON.stringify(rd));
  const sv = r["residue save"]; ran(sv, "(own Delete, Save note) ");
  assert.deepStrictEqual([sv.asked, sv.mid.box, sv.redrawn, sv.here, sv.server], [[REPLACE27], [], [], ss("coach: " + all, null), ss("coach: " + all, null)], "(own Delete, Save note) the box came back with older words after Save: " + JSON.stringify(sv));
  const dc = r["residue discard"]; ran(dc, "(own Delete, Discard) ");
  assert.deepStrictEqual([dc.mid.box, dc.redrawn, dc.here], [[], [], ss(HERS27, null)], "(own Delete, Discard) the discarded box came back: " + JSON.stringify(dc));
  const hr = r["herTwice redraw"]; ran(hr, "(her Delete, redraw) ");
  assert.deepStrictEqual([hr.box, hr.asked, hr.here], [["Leg press+Leg curl: " + all + " (left)"], [REPLACE27], ss(HERS27, null)], "(her Delete, redraw) the words typed after her note came were lost at the next drawing: " + JSON.stringify(hr));
  const hs = r["herTwice save"]; ran(hs, "(her Delete, Save note) ");
  assert.deepStrictEqual([hs.asked, hs.box, hs.redrawn, hs.server], [[REPLACE27], [], [], ss("coach: " + all + " (left)", null)], "(her Delete, Save note) the box came back with older words after Save: " + JSON.stringify(hs));
});

test("v321, the twenty-seventh check round (cards lens, R27-CRD-3) 4 typed in Leg curl's number box (the caret still in it) while his number's save merges her Start this exercise on Calf raise, or the iPad's Delete of Back squat: once he leaves the box, his edit of her Leg curl note stays with Leg curl, and Save note writes there asking nothing", () => {
  const w = "coach: " + edited;
  for (const [name, here] of [["calf", ["1 Back squat", "2 Calf raise", "3 Leg press", "4 Leg curl [" + w + "]"]], ["sq", ["1 Leg press", "2 Calf raise", "3 Leg curl [" + w + "]"]]]) {
    const o = r27().v["c3 " + name], at = "(" + name + ") "; ran(o, at);
    assert.deepStrictEqual([o.focus, o.box, o.save.asked, o.here, o.server], ["label", ["Leg curl: " + edited], [], here, here], at + "the box went to Leg press's card, or Save note asked \"Save a note deleted meanwhile?\" and wrote there: " + JSON.stringify(o));
  }
});
test("v321, the twenty-seventh check round (cards lens, R27-CRD-3) the reviewer's cases: his edit of Mia's note on Leg curl (2b) open, 4 typed in Leg curl's number box (the caret still in it), and his save's merge renumbering the cards under his finger (her Start this exercise on Calf raise; the iPad's Delete of Back squat): leaving the box puts the note box on Leg curl's card, and Save note asks nothing and writes on Leg curl", () => {
  const w = "coach: " + edited;
  for (const [name, here] of [["calf starts", ["1 Back squat", "2 Calf raise", "3 Leg press", "4 Leg curl [" + w + "]"]], ["sq deleted", ["1 Leg press", "2 Calf raise", "3 Leg curl [" + w + "]"]]]) {
    const o = r27().rev["typedMerge " + name], at = "(" + name + ") "; ran(o, at);
    assert.deepStrictEqual([o.typedNo, o.landed.focus], ["4", "label"], at + "(the setup) " + JSON.stringify(o.landed));
    assert.deepStrictEqual([o.box, o.asked, o.here, o.server], [["Leg curl: " + edited], [], here, here], at + "the box went to another card, or Save note asked \"Save a note deleted meanwhile?\" and wrote there: " + JSON.stringify(o));
  }
});
test("v321, the twenty-seventh check round (cards lens, R27-CRD-3, the owner's pick \"Ask first\") with his edit of Leg curl's note open, a number typed in Leg curl's box and a save's merge under the caret: Leg curl given 2 (Leg press's card, her note) with her set logged elsewhere, the question still comes as he leaves the box (Cancel puts 3 back and keeps the box; Discard joins); Leg curl given 4 (Calf raise's card, no note) with her Start this exercise on Calf raise (Calf raise to 2, Leg curl with it): nothing is asked and the box goes with Leg curl, never onto Leg press's card", () => {
  const r = r27().v, Q = { open: true, title: "Discard what you wrote?", text: "Leg press’s card already has Mia’s note, and a card shows one note.", yes: "Discard", red: true };
  const n = r["ask her set no"], y = r["ask her set yes"]; ran(n, "(her set, Cancel) "); ran(y, "(her set, Discard) ");
  assert.deepStrictEqual([n.asked, n.lcBox, n.box, n.after], [Q, "3", ["Leg curl: Calves tight, stretch first"], ["1 Back squat", "2 Leg press [client: Knee ok today]", "3 Leg curl [coach: Calves tight, stretch first]", "4 Calf raise"]], "(her set, Cancel) " + JSON.stringify(n));
  assert.deepStrictEqual([y.asked, y.lcBox, y.box, y.here], [Q, "2b", [], ["1 Back squat", "2a Leg press [client: Knee ok today]", "2b Leg curl [client: Calves tight]", "4 Calf raise"]], "(her set, Discard) " + JSON.stringify(y));
  const s = r["ask beside her start no"]; ran(s, "(her start) ");
  assert.deepStrictEqual([s.asked, s.box, s.save, s.after], [{ open: false }, ["Calf raise+Leg curl: Calves tight, stretch first"], [], ["1 Back squat", "2a Calf raise", "2b Leg curl [coach: Calves tight, stretch first]", "3 Leg press [client: Knee ok today]"]], "(her start) the box went to Leg press's card, and Save note wrote his Leg curl words over her Leg press note: " + JSON.stringify(s));
});

test("v321, the twenty-seventh check round (cards lens, R27-CRD-4) Save note never writes over another exercise's note that was on the card before: her Delete of the card's note (two notes on one superset) asks \"Save a note deleted meanwhile?\" and Save writes on the box's own exercise; his own Delete asks nothing and no box comes back; the iPad's join with her Delete asks the same and writes on Leg curl; the iPad's regroup with her Delete asks before it is saved back (Cancel keeps her Delete), and with his own Delete first asks nothing", () => {
  const r = r27().v, mine = "coach: Left knee hurts on the way down (stop at 90)";
  const h = r["c4 her"]; ran(h, "(her Delete) "); assert.deepStrictEqual([h.save.asked, h.here, h.server, h.redrawn], [[DELETED27], ss(mine, "client: Knee ok today"), ss(mine, "client: Knee ok today"), []], "(her Delete) " + JSON.stringify(h));
  const o = r["c4 own"]; ran(o, "(his own Delete) "); assert.deepStrictEqual([o.save.asked, o.here, o.redrawn], [[], ss(mine, "client: Knee ok today"), []], "(his own Delete) " + JSON.stringify(o));
  const j = r["c4 join"]; ran(j, "(join) "); assert.deepStrictEqual([j.save.asked, j.here], [[DELETED27], ["1 Back squat", "2a Leg press [client: Knee ok today]", "2b Leg curl [coach: Calves tight, stretch first]", "3 Calf raise"]], "(join) his Leg curl words went over her Leg press note: " + JSON.stringify(j));
  const g = r["c4 regroup her"]; ran(g, "(regroup, her Delete) "); assert.deepStrictEqual([g.save.asked, g.here], [[DELETED27], ["1 Back squat", "2 Leg press", "3a Calf raise", "3b Leg curl"]], "(regroup, her Delete) her deleted note was saved back as his, unasked: " + JSON.stringify(g));
  const w = r["c4 regroup own"]; ran(w, "(regroup, his own Delete) "); assert.deepStrictEqual([w.save.asked, w.here], [[], ["1 Back squat", "2 Leg press", "3a Calf raise", "3b Leg curl [coach: " + edited + "]"]], "(regroup, his own Delete) " + JSON.stringify(w));
});
test("v321, the twenty-seventh check round (cards lens, R27-CRD-4) the reviewer's cases: two notes on one superset, her Delete of the card's note under his finger asks \"Save a note deleted meanwhile?\" (Save writes there, Cancel writes nothing) and his own asks nothing; R26-CRD-4's join with her Delete of Leg curl's note never writes over her Leg press note; her Delete with the iPad's regroup under his finger asks before it is saved back, with the box drawn back once first too", () => {
  const r = r27().rev, mine = "Left knee hurts on the way down (stop at 90)";
  for (const reply of ["yes", "no"]) {
    const o = r["twoCard her delete " + reply], at = "(two notes, her Delete, " + reply + ") "; ran(o, at);
    assert.deepStrictEqual([o.asked, o.here, o.server], [[DELETED27], ss(reply === "yes" ? "coach: " + mine : null, "client: Knee ok today"), ss(reply === "yes" ? "coach: " + mine : null, "client: Knee ok today")], at + JSON.stringify(o));
  }
  const w = r["twoCard own delete yes"]; ran(w, "(two notes, own Delete) ");
  assert.deepStrictEqual([w.asked, w.here, w.after, w.redrawn], [[], ss("coach: " + mine, "client: Knee ok today"), [], []], "(two notes, own Delete) " + JSON.stringify(w));
  const j = r["joinDel yes"], jn = r["joinDel no"]; ran(j, "(join, Save) "); ran(jn, "(join, Cancel) ");
  assert.deepStrictEqual([j.asked, j.here, j.server], [[DELETED27], ["1 Back squat", "2a Leg press [client: Knee ok today]", "2b Leg curl [coach: Calves tight, stretch first]", "3 Calf raise"], ["1 Back squat", "2a Leg press [client: Knee ok today]", "2b Leg curl [coach: Calves tight, stretch first]", "3 Calf raise"]], "(join, Save) his Leg curl words went over her Leg press note: " + JSON.stringify(j));
  assert.deepStrictEqual([jn.asked, jn.here], [[DELETED27], ["1 Back squat", "2a Leg press [client: Knee ok today]", "2b Leg curl", "3 Calf raise"]], "(join, Cancel) " + JSON.stringify(jn));
  const g = r["regroupSave no"], gy = r["regroupSave yes"]; ran(g, "(regroup, Cancel) "); ran(gy, "(regroup, Save) ");
  assert.deepStrictEqual([g.asked, g.here, g.server], [[DELETED27], ["1 Back squat", "2 Leg press", "3a Calf raise", "3b Leg curl"], ["1 Back squat", "2 Leg press", "3a Calf raise", "3b Leg curl"]], "(regroup) her deleted note was saved back as his, unasked: " + JSON.stringify(g));
  assert.deepStrictEqual([gy.asked, gy.here], [[DELETED27], ["1 Back squat", "2 Leg press", "3a Calf raise", "3b Leg curl [coach: " + edited + "]"]], "(regroup, Save) " + JSON.stringify(gy));
  const dr = r.regroupDrawn; ran(dr, "(regroup, the box drawn back first) ");
  assert.deepStrictEqual([dr.drawn, dr.finger, dr.asked, dr.here], [["Leg press+Leg curl: " + edited], true, [DELETED27], ["1 Back squat", "2 Leg press", "3a Calf raise", "3b Leg curl"]], "(regroup, the box drawn back first) her deleted note was saved back as his, unasked: " + JSON.stringify(dr));
});

test("v321, the twenty-seventh check round (cards lens, R27-CRD-5) Add note tapped on the superset with no note just after her note on Leg curl came in under his finger (a weight typed into Leg press, then a tap elsewhere) shows the card with her note (See note), not an empty box", () => {
  const o = r27().v.c5; ran(o); assert.deepStrictEqual([o.cards[1], o.box], ["Leg press+Leg curl (See note)", []], JSON.stringify(o));
});
test("v321, the twenty-seventh check round (cards lens, R27-CRD-5) the reviewer's case: Add note tapped on the superset (2a Leg press, 2b Leg curl, no note) just after her note on Leg curl came in under his finger shows the card with her note (See note), not an empty box", () => {
  const o = r27().rev.addOther; ran(o); assert.deepStrictEqual([o.landed.cards[1], o.after.cards[1], o.after.box], ["Leg press+Leg curl (Add note)", "Leg press+Leg curl (See note)", []], JSON.stringify(o));
});
test("v321, the twenty-seventh check round (cards lens, R27-CRD-6, wording-free) Save note on his box after the iPad's Delete exercise of Leg curl came in under his finger draws the cards as they are (Leg curl gone), never a card that reads as saved", () => {
  const o = r27().v.c6; ran(o); assert.deepStrictEqual([o.save.asked, o.cards, o.box, o.here], [[], ["Back squat (Add note)", "Leg press (Add note)", "Calf raise (Add note)"], [], ["1 Back squat", "2 Leg press", "3 Calf raise"]], JSON.stringify(o));
});
