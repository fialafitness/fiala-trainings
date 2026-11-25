// v316 (the twenty-third check round, R23-HND-3): Active until on a client's card (the coach's view), driven through its real listeners and the
// document's in plan-until-probe.mjs. A computer's date box fires change at every digit typed (measured in Chrome), and each in-between date was
// saved: 0002-12-31 and the like reached the server, and while it held a past date her phone read her plan as over ("Plan ended", no workouts).
// A date typed by keys now lands once, as he leaves the box, presses Return or the page is hidden; one picked with no key (a phone's wheel, the
// box's calendar) lands at once; the plan's own date lands nothing (a click in and out must not write it over a date his iPad saved meanwhile).
// Found while round 23's tests were written: the box left with the year half typed (12/31/20) saved 0020-12-31, and her plan read as over until he
// finished the year. A year before 2000 now lands nothing; the year finished lands once.
// The twenty-fourth check round: +4 weeks (or a Plan switch) left the box with the date it was drawn with, and a tap or click into it and away wrote
// that date back (R24-HND-1, R24-HND-2); his iPad's date landing by a sync while the box had the focus was written over the same way (R24-HND-1);
// a whole year before 2000 (1999 on a phone's wheel, 1987 typed) had no test of its own (R24-TW-3).
// The twenty-fifth check round: a save from the card or her page that took his iPad's plan change by round 24's merge left this Mac's package and
// date on screen beside Saved (R25-HND-1); the box left as drawn kept its old date after the iPad's change synced in under the focus (R25-HND-2);
// and a date typed back to the one the box was drawn with had no behaviour test (R25-TW-12).
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { test, assert } from "./assert.js";
import { daysLater } from "../app/util.js";
const here = path.dirname(fileURLToPath(import.meta.url));
const r = JSON.parse(execFileSync(process.execPath, [path.join(here, "plan-until-probe.mjs")], { encoding: "utf8", timeout: 180000 }).trim().split("\n").pop());
const noneAtKeys = (keys, label) => keys.forEach((k, i) => assert.deepStrictEqual({ kept: k.here, marked: k.touched, queued: k.queued, card: k.big, server: k.server, sent: k.writes }, { kept: r.OLD, marked: false, queued: false, card: r.words.old, server: r.OLD, sent: 0 },
  label + ", key " + (i + 1) + " of " + keys.length + " (the box showed " + k.shown + "): nothing kept, shown on the card or sent, even after a pause longer than a save's wait"));
const nothingWhileTyping = (name) => noneAtKeys(r[name].keys, name);
const keptOld = (s, label) => assert.deepStrictEqual({ kept: s.here, marked: s.touched, queued: s.queued, waiting: s.waiting, sending: s.out, card: s.big, server: s.server, sent: s.writes, over: s.over },
  { kept: r.OLD, marked: false, queued: false, waiting: false, sending: 0, card: r.words.old, server: r.OLD, sent: [], over: false }, label);
const MID = [["midClick", "a click on the card's name", false], ["midEnter", "Return", true], ["midHidden", "the page hidden", true]];   // how he left the box with the year half typed, and whether the box kept the focus (it did after Return and with the page hidden: measured in Chrome)
const landed = (s, label) => assert.deepStrictEqual({ kept: s.here, marked: s.touched, queued: s.queued, card: s.big }, { kept: r.NEW, marked: true, queued: true, card: r.words.new }, label);
const sentOnce = (s, label) => assert.deepStrictEqual({ sent: s.writes, server: s.server, kept: s.here }, { sent: [r.NEW], server: r.NEW, kept: r.NEW }, label);

test("(R23-HND-3) Active until typed digit by digit on a computer (12, 31, then next year) saves nothing while he types, even with a pause after each key: no in-between date on her record, on the card or on the server (the old box sent all eight, 0002-12-31 among them)", () => {
  assert.deepStrictEqual(r.errors, [], "no listener threw while the probe drove the card");
  assert.deepStrictEqual([r.click.before.value, r.click.before.here, r.click.focused], [r.OLD, r.OLD, true], "the box showed her plan's date, and the click gave it the focus");
  assert.deepStrictEqual(r.click.fired, r.shown.filter((v, i, a) => v !== (i ? a[i - 1] : r.OLD)), "a change at every digit, as Chrome's date box sends them");
  assert.ok(r.click.fired.filter((v) => v < r.today).length >= 3, "some in-between dates are days long past (" + r.click.fired.join(", ") + "): saved, her plan read as over");
  for (const name of ["click", "tab", "back", "enter", "hidden"]) nothingWhileTyping(name);
  assert.deepStrictEqual([r.click.tabbed.here, r.click.tabbed.writes, r.tab.tab1.here, r.tab.tab1.writes], [r.OLD, [], r.OLD, []], "a Tab that stays in the box (Chrome's next stop is the box's own calendar button) saves nothing either");
});

test("(R23-HND-3) the typed date is saved once, as he leaves the box: a click away, a second Tab (on to +4 weeks), or Back with the box still in focus (the card goes and the browser takes the focus from it)", () => {
  for (const [name, label] of [["click", "a click on the card's name"], ["tab", "a second Tab"], ["back", "Back"]]) {
    landed(r[name].left, label + ": kept, marked as his change and queued as the box loses the focus, the card saying the new date");
    sentOnce(r[name].after, label + ": one save, the last date");
  }
  assert.strictEqual(r.tab.on, true, "the second Tab went on to +4 weeks");
  assert.deepStrictEqual({ before: r.back.cardBefore, after: r.back.cardAfter, view: r.back.view }, { before: true, after: false, view: { name: "client", id: "c1" } }, "Back closed the card, onto her page: the client the date belongs to");
});

test("(R23-HND-3) the typed date is saved once as he presses Return, the box still in focus; a click away after that sends nothing more", () => {
  landed(r.enter.entered, "kept, marked and queued at the Return");
  assert.strictEqual(r.enter.entered.focused, true, "the box still has the focus");
  sentOnce(r.enter.sent, "one save, the last date");
  sentOnce(r.enter.after, "leaving the box with the date already saved sends nothing more");
});

test("(R23-HND-3) the typed date is saved once as the page is hidden with the box still in focus (Cmd-Tab, another app, the home screen): on its way at that moment, not after the save's half-second wait; back on the page and out of the box, nothing more is sent", () => {
  landed(r.hidden.hid, "kept, marked and queued as the page is hidden");
  assert.deepStrictEqual({ waiting: r.hidden.hid.waiting, sending: r.hidden.hid.out > 0 }, { waiting: false, sending: true }, "already on its way to the server: a hidden page may be stopped before half a second is up");
  sentOnce(r.hidden.sent, "one save, the last date");
  sentOnce(r.hidden.back, "back on the page, after a sync: still the one save");
  sentOnce(r.hidden.after, "leaving the box afterwards sends nothing more");
});

test("(R23-HND-3) a date picked with no key is saved at once, the box still in focus: a phone's wheel, or the box's calendar on a computer after the month was typed (the typed month itself saved nothing); leaving the box then sends nothing more", () => {
  assert.deepStrictEqual({ kept: r.calendar.typed.here, queued: r.calendar.typed.queued, sent: r.calendar.typed.writes }, { kept: r.OLD, queued: false, sent: [] }, "the month typed before the calendar was opened: nothing kept or sent");
  for (const [name, label] of [["wheel", "a phone's wheel"], ["calendar", "the box's calendar"]]) {
    landed(r[name].picked, label + ": kept, marked and queued at the pick");
    assert.strictEqual(r[name].picked.focused, true, label + ": while the box still has the focus");
    sentOnce(r[name].sent, label + ": sent after the save's usual wait");
    sentOnce(r[name].after, label + ": leaving the box sends nothing more");
  }
});

test("(R23-HND-3) the box clicked into and left with the plan's own date (a click away, Return, the page hidden) sends and marks nothing, so a later date his iPad saved meanwhile stands", () => {
  for (const [step, label] of [["clickOut", "a click away"], ["enter", "Return"], ["hidden", "the page hidden"]]) {
    const s = r.same[step];
    assert.deepStrictEqual({ sent: s.writes, marked: s.touched, queued: s.queued, server: s.server }, { sent: [], marked: false, queued: false, server: r.IPAD }, label + ": nothing sent or marked as his change, the server keeps the iPad's date");
  }
  assert.deepStrictEqual({ kept: r.same.synced.here, box: r.same.synced.value, server: r.same.synced.server, sent: r.same.synced.writes }, { kept: r.IPAD, box: r.IPAD, server: r.IPAD, sent: [] }, "the next sync brings the iPad's date here, into the box too");
});

test("(R23-HND-3) Active until left with the year half typed (12/31/20: the box holds 0020-12-31) saves nothing, three ways: a click away, Return, or the page hidden with the box in focus; her plan keeps its end day on her record, on the card and on the server, and her phone still reads it as running (the box saved 0020-12-31, and the card read Ended Fri, Dec 31, 1920)", () => {
  assert.deepStrictEqual(r.errors, [], "no listener threw while the probe drove the card");
  for (const [name, label, stays] of MID) {
    const s = r[name];
    assert.deepStrictEqual({ box: s.typed.value, focused: s.typed.focused }, { box: r.shown[5], focused: true }, label + ": before he left it, the box held 12/31/20 (" + r.shown[5] + ") and had the focus");
    noneAtKeys(s.half, label + ", the year half typed");
    assert.deepStrictEqual({ box: s.left.value, focused: s.left.focused }, { box: r.shown[5], focused: stays }, label + ": the box still holds 12/31/20, " + (stays ? "and keeps the focus" : "and has lost the focus"));
    keptOld(s.left, label + ", as he leaves the box: nothing kept, marked, queued or sent; the card and the server keep her plan's end day, and her phone reads her plan as running");
    keptOld(s.after, label + ", after a pause longer than a save's wait: still nothing saved, and her plan keeps its end day");
  }
  assert.deepStrictEqual({ box: r.midHidden.back.value, focused: r.midHidden.back.focused }, { box: r.shown[5], focused: true }, "back on the page after a sync: the box still holds what he typed, and has the focus (a sync leaves a box he is typing in alone)");
  keptOld(r.midHidden.back, "back on the page after a sync: still nothing saved, and her plan keeps its end day");
});

test("(R23-HND-3) the year then finished is saved once, the whole date: typed anew after a click back on the year (the click starts it again: 2 gives 0002-12-31), or carried on after Return or the page hidden; nothing is saved while he finishes it, and the half-typed date never reaches the server", () => {
  for (const [name, label, stays] of MID) {
    const s = r[name], seq = [...r.shown.slice(0, 6), ...r.shown.slice(stays ? 6 : 4)];
    assert.strictEqual((s.back || s.after).value, r.shown[5], label + ": the box still held 12/31/20 when he came back to finish the year (nothing redrew it), so the dates below are the ones Chrome's box gives");
    assert.deepStrictEqual(s.fired, seq.filter((v, i) => v !== (i ? seq[i - 1] : r.OLD)), label + ": a change at every digit, as Chrome's box sends them (" + (stays ? "the year carries on" : "a click on the year starts it again") + ")");
    noneAtKeys(s.rest, label + ", the year finished");
    assert.deepStrictEqual({ box: s.finished.value, focused: s.finished.focused }, { box: r.NEW, focused: true }, label + ": the box holds the whole date and has the focus");
    landed(s.left2, label + ", then the box left: kept, marked as his change and queued, the card saying the new date");
    sentOnce(s.after2, label + ": one save, the whole date, never the half-typed one");
    assert.strictEqual(s.after2.over, false, label + ": her phone reads her plan as running");
  }
});

// ---------- v316, the twenty-fourth check round ----------
const R = r.r24, W = R.words;
const PLUS4 = [["plus4", "a click on +4 weeks", R.PLUS, W.plus], ["plus4Tap", "a tap on +4 weeks (a phone)", R.PLUS, W.plus], ["plus4Out", "a tap on +4 weeks with one bar of signal", R.PLUS, W.plus], ["plus4Run", "+4 weeks on a plan still running", R.RUN, W.run]];
const extended = (s, until, words, label) => assert.deepStrictEqual({ sent: s.writes, server: s.server, kept: s.here, marked: s.touched, queued: s.queued, box: s.value, card: s.big, over: s.over },
  { sent: [until], server: until, kept: until, marked: false, queued: false, box: until, card: words, over: false }, label);
const WAYS = [["click", "a click away", false], ["enter", "Return", true], ["tab", "Tab, then Tab again (on to +4 weeks)", false], ["back", "Back", false], ["hidden", "the page hidden", true]];   // how he left the box, and whether it kept the focus
const STEP = { left: "as he leaves the box", after: "after a pause longer than a save's wait", away: "then a click away", next: "after the next sync" };

test("(R24-HND-2) +4 weeks on a client's card shows its new date in Active until at once, before any sync, on a computer and on a phone, and a second press shows its own (the box kept the old date beside Saved until the next sync, up to a minute, and a second press made her plan 8 weeks)", () => {
  assert.deepStrictEqual(r.errors, [], "no listener threw while the probe drove the card");
  assert.deepStrictEqual({ box: r.plus4.before.value, card: r.plus4.before.big, over: r.plus4.before.over }, { box: R.ENDED, card: W.ended, over: true }, "before: her plan ended three days ago, and her phone reads it as over");
  for (const [name, label, until, words] of PLUS4) {
    const s = r[name].pressed;
    assert.deepStrictEqual({ box: s.value, kept: s.here, card: s.big, row: s.row }, { box: until, kept: until, card: words, row: true }, label + ": the box shows the date her plan now has, at once");
  }
  assert.deepStrictEqual([r.twice.first.value, r.twice.second.value], [R.PLUS, R.PLUS2], "pressed twice: the box shows four weeks from today, then four weeks more, each at once");
  assert.deepStrictEqual({ sent: r.twice.after.writes, server: r.twice.after.server }, { sent: [R.PLUS, R.PLUS2], server: R.PLUS2 }, "pressed twice: each press saved once");
});

test("(R24-HND-1) +4 weeks, then a click or a tap into Active until and away with nothing picked, writes nothing more: one save, and her plan stays extended here, on the card and on the server, also when the tap comes while that save is still on its way (the box's old date was written back: +4 weeks undone, her phone on Plan ended, the bar saying Saved)", () => {
  for (const [name, label, until, words] of PLUS4) {
    const s = r[name];
    if (s.saved) assert.deepStrictEqual({ sent: s.saved.writes, server: s.saved.server, over: s.saved.over }, { sent: [until], server: until, over: false }, label + ": +4 weeks saved once, and her phone reads her plan as running");
    if (s.inBox) assert.strictEqual(s.inBox.focused, true, label + ": the box took the focus");
    if (s.left && name !== "plus4Out") extended(s.left, until, words, label + ", then into the box and away, as he leaves it: nothing more kept, marked, queued or sent, and the box and the card keep the new date");
    extended(s.after, until, words, label + ", then into the box and away, after a pause longer than a save's wait: still the one save, the new date here, in the box, on the card and on the server");
  }
  const o = r.plus4Out.left;
  assert.deepStrictEqual({ sending: o.out > 0, sent: o.writes, server: o.server }, { sending: true, sent: [], server: R.ENDED }, "one bar of signal: the save of +4 weeks was still on its way when he tapped into the box and away");
  assert.deepStrictEqual({ kept: o.here, box: o.value, card: o.big }, { kept: R.PLUS, box: R.PLUS, card: W.plus }, "one bar of signal: leaving the box kept the four weeks");
});

test("(R24-HND-2) a package picked in the Plan pop-up shows on the card at once: another monthly package's date in Active until, no Active until row for None or a session package, and the row back for a monthly package picked after None, with that package's date; a click into the box and away then writes nothing more (the card kept the old plan's row and date until the next sync, and a click in and out wrote the old package's date into the new one)", () => {
  const m = r.switchMonthly;
  assert.deepStrictEqual({ row: m.switched.row, box: m.switched.value, kept: m.switched.here, plan: m.switched.planHere }, { row: true, box: R.PLUS, kept: R.PLUS, plan: "pm2" }, "another monthly package: the box shows its date (four weeks from today) at once");
  assert.deepStrictEqual({ sent: m.after.writes, server: m.after.server, plan: m.after.planThere, box: m.after.value, over: m.after.over }, { sent: [R.PLUS], server: R.PLUS, plan: "pm2", box: R.PLUS, over: false }, "then a click into the box and away: one save, the new package with its own date, and her phone reads her plan as running");
  for (const [name, label, plan] of [["switchNone", "None", null], ["switchSessions", "a session package", "ps"]]) {
    const s = r[name];
    assert.strictEqual(s.before.row, true, label + ": before, the card showed Active until (her monthly plan)");
    assert.deepStrictEqual({ row: s.switched.row, plan: s.switched.planHere }, { row: false, plan }, label + ": the Active until row is gone at once");
    assert.deepStrictEqual({ row: s.saved.row, plan: s.saved.planThere }, { row: false, plan }, label + ": and stays gone once saved");
  }
  const f = r.switchFromNone;
  assert.deepStrictEqual({ row: f.before.row, kept: f.before.here }, { row: false, kept: null }, "no plan yet: no Active until row");
  assert.deepStrictEqual({ row: f.switched.row, box: f.switched.value, kept: f.switched.here }, { row: true, box: R.PLUS, kept: R.PLUS }, "a monthly package picked after None: the row is back at once, with that package's date");
  assert.deepStrictEqual({ sent: f.after.writes, server: f.after.server, plan: f.after.planThere }, { sent: [R.PLUS], server: R.PLUS, plan: "pm" }, "then a click into the box and away: one save, nothing more");
});

test("(R24-HND-1) his iPad's later date, landing by a sync while Active until has the focus (clicked into, nothing typed), stands when the box is left: a click away, Return, Tab, Back or the page hidden writes nothing over it; a date he picks or types there after that sync still lands, once (this Mac's older date, still in the box, was written over the iPad's)", () => {
  assert.deepStrictEqual(r.errors, [], "no listener threw while the probe drove the card");
  for (const [how, label, keeps] of WAYS) {
    const s = r["ipad_" + how];
    assert.deepStrictEqual({ focused: s.synced.focused, kept: s.synced.here, server: s.synced.server, box: s.synced.value }, { focused: true, kept: r.IPAD, server: r.IPAD, box: r.OLD }, label + ": the sync brought the iPad's date while the box, in focus, kept the date it was drawn with");
    assert.strictEqual(s.left.focused, keeps, label + ": " + (keeps ? "the box keeps the focus" : "the box has lost the focus"));
    for (const step of Object.keys(STEP)) if (s[step]) assert.deepStrictEqual({ sent: s[step].writes, kept: s[step].here, marked: s[step].touched, queued: s[step].queued, server: s[step].server, over: s[step].over },
      { sent: [], kept: r.IPAD, marked: false, queued: false, server: r.IPAD, over: false }, label + ", " + STEP[step] + ": nothing sent or marked as his change; the iPad's date stands here and on the server");
    if (how !== "back") assert.strictEqual(s.next.value, r.IPAD, label + ": the next sync brings the iPad's date into the box");
  }
  assert.strictEqual(r.ipad_tab.on, true, "the second Tab went on to +4 weeks");
  assert.strictEqual(r.ipad_back.card, false, "Back closed the card");
  const p = r.ipadThen_pick, t = r.ipadThen_type;
  for (const s of [p, t]) assert.deepStrictEqual({ focused: s.synced.focused, kept: s.synced.here, box: s.synced.value }, { focused: true, kept: r.IPAD, box: r.OLD }, "the same sync, landing while the box had the focus: the iPad's date here, the box still showing the date it was drawn with");
  landed(p.picked, "a date picked after that sync (no key): kept, marked and queued at once");
  sentOnce(p.after, "a date picked after that sync, then a click away: one save");
  t.keys.forEach((k, i) => assert.deepStrictEqual({ kept: k.here, marked: k.touched, sent: k.writes }, { kept: r.IPAD, marked: false, sent: 0 }, "a date typed after that sync, key " + (i + 1) + " of " + t.keys.length + ": nothing kept or sent while he types"));
  landed(t.left, "a date typed after that sync, then a click away: kept, marked and queued");
  sentOnce(t.after, "a date typed after that sync: one save, the whole date");
});

test("(R24-TW-3) Active until never takes a whole year before 2000: Dec 31, 1999 on a phone's wheel (then Done), or 1987 typed on a computer (a slip for 2027, then a click away), keeps her plan's end day here, on the card and on the server; the year 2000 is taken, picked or typed (only the half-typed years 0002, 0020 and 0202 were tested, so a check at 1000 passed every test)", () => {
  keptOld(r.wheel1999.picked, "1999 picked: nothing kept, marked or queued at the pick");
  keptOld(r.wheel1999.sent, "1999 picked: nothing sent after a pause longer than a save's wait");
  keptOld(r.wheel1999.after, "1999 picked, then Done: nothing sent");
  const seq = [...r.shown.slice(0, 4), "0001-12-31", "0019-12-31", "0198-12-31", "1987-12-31"];
  assert.deepStrictEqual(r.typed1987.fired, seq.filter((v, i) => v !== (i ? seq[i - 1] : r.OLD)), "1987 typed: a change at every digit, as Chrome's box sends them");
  assert.deepStrictEqual({ box: r.typed1987.typed.value, focused: r.typed1987.typed.focused }, { box: "1987-12-31", focused: true }, "1987 typed: the box holds 12/31/1987 and has the focus");
  noneAtKeys(r.typed1987.keys, "1987 typed");
  keptOld(r.typed1987.left, "1987 typed, then a click away: nothing kept, marked or queued");
  keptOld(r.typed1987.after, "1987 typed, then a click away: nothing sent after a pause longer than a save's wait");
  const w = r.wheel2000, y = r.typed2000;
  assert.deepStrictEqual({ kept: w.picked.here, marked: w.picked.touched, queued: w.picked.queued, card: w.picked.big }, { kept: "2000-01-01", marked: true, queued: true, card: W.jan2000 }, "Jan 1, 2000 picked: kept, marked and queued at once");
  assert.deepStrictEqual({ sent: w.after.writes, server: w.after.server }, { sent: ["2000-01-01"], server: "2000-01-01" }, "Jan 1, 2000 picked, then Done: one save");
  noneAtKeys(y.keys, "2000 typed");
  assert.deepStrictEqual({ kept: y.left.here, marked: y.left.touched, queued: y.left.queued, card: y.left.big }, { kept: "2000-12-31", marked: true, queued: true, card: W.dec2000 }, "12/31/2000 typed, then a click away: kept, marked and queued");
  assert.deepStrictEqual({ sent: y.after.writes, server: y.after.server }, { sent: ["2000-12-31"], server: "2000-12-31" }, "12/31/2000 typed: one save, the whole date");
});

// ---------- v316, the twenty-fifth check round ----------
// R25-HND-1: his save on the Mac met his iPad's newer copy of her record, and round 24's merge (the owner's pick "Each detail separately") took the
// iPad's plan: its switch to Monthly plus or its None beat the date he had just picked, and its +4 weeks came in with a save of anything else on her
// card or her page. Nothing drew them again, so for up to a minute the card showed this Mac's package and date beside Saved (her page its old plan
// card), and +4 weeks counted from a date it did not show. R25-HND-2: the box he had clicked into kept its old date after he left it, though the
// iPad's change had synced in meanwhile. R25-TW-12: a date put back to the one the box was drawn with, after a slip was saved, had no behaviour test.
const Q = r.r25;
test("(R25-HND-1) a date he picks in Active until (a phone's wheel, or the box's calendar on a computer) loses to his iPad's switch to Monthly plus, or its None, made within the minute before (each detail goes separately, the owner's pick): the card shows the iPad's plan as soon as his save lands, Monthly plus with its own date or None with no Active until row, and +4 weeks then counts from the date shown; another client's save that takes the iPad's switch of his own plan leaves her card hers (the twenty-fifth check round: the card kept 4-week plan and his date beside Saved for up to a minute, and +4 weeks extended Monthly plus from a date it never showed)", () => {
  assert.deepStrictEqual(r.errors, [], "no listener threw while the probe drove the card");
  for (const [name, label] of [["r25_switchWheel", "the iPad's Monthly plus, then his date on a phone's wheel"], ["r25_switchCalendar", "the iPad's Monthly plus, then his date in the box's calendar"]]) {
    const s = r[name];
    assert.deepStrictEqual({ plan: s.picked.sel, box: s.picked.value, server: s.picked.planThere }, { plan: "pm", box: Q.PICK, server: "pm2" }, label + ": his date shows at once beside 4-week plan; the iPad's switch is on the server, not read here yet");
    assert.deepStrictEqual({ kept: [s.saved.planHere, s.saved.here], server: [s.saved.planThere, s.saved.server] }, { kept: ["pm2", Q.PM2_UNTIL], server: ["pm2", Q.PM2_UNTIL] }, label + ": once his save lands, the iPad's switch stands, here and on the server");
    assert.deepStrictEqual({ plan: s.saved.sel, row: s.saved.row, box: s.saved.value, drawn: s.saved.shown }, { plan: "pm2", row: true, box: Q.PM2_UNTIL, drawn: Q.PM2_UNTIL }, label + ": the card shows Monthly plus and its own date as soon as his save lands (it showed " + s.saved.sel + " and " + s.saved.value + " beside Saved)");
    assert.deepStrictEqual({ box: s.plusSaved.value, kept: s.plusSaved.here, server: s.plusSaved.server }, { box: daysLater(s.saved.value, 28), kept: daysLater(s.saved.value, 28), server: daysLater(s.saved.value, 28) }, label + ": +4 weeks then gives four weeks after the date the box showed");
  }
  for (const [name, label] of [["r25_noneWheel", "the iPad's None, then his date on a phone's wheel"], ["r25_noneCalendar", "the iPad's None, then his date in the box's calendar"]]) {
    const s = r[name];
    assert.deepStrictEqual({ plan: s.picked.sel, row: s.picked.row, box: s.picked.value }, { plan: "pm", row: true, box: Q.PICK }, label + ": his date shows at once beside 4-week plan");
    assert.deepStrictEqual({ kept: s.saved.planHere, server: s.saved.planThere }, { kept: null, server: null }, label + ": once his save lands, the iPad's None stands, here and on the server");
    assert.deepStrictEqual({ plan: s.saved.sel, row: s.saved.row }, { plan: "", row: false }, label + ": the card shows None, with no Active until row, as soon as his save lands (it showed " + JSON.stringify(s.saved.sel) + ", the row " + (s.saved.row ? "still there" : "gone") + ")");
  }
  const o = r.r25_otherClient;
  assert.deepStrictEqual({ omarHere: o.saved.omarHere, omarThere: o.saved.omarThere }, { omarHere: "pm2", omarThere: "pm2" }, "Omar's save, landing while Mia's card is open, took the iPad's switch of his plan");
  assert.deepStrictEqual({ plan: o.saved.sel, row: o.saved.row, box: o.saved.value, kept: [o.saved.planHere, o.saved.here] }, { plan: "pm", row: true, box: r.OLD, kept: ["pm", r.OLD] }, "Mia's card stays hers: her 4-week plan and her date, never Omar's Monthly plus (the redraw is for the client whose card is open)");
});

test("(R25-HND-1) her phone number typed on the card within the minute after his iPad's +4 weeks: that save takes her plan's new end from the iPad's copy, Active until shows it as soon as the save lands, and +4 weeks then gives four weeks after the date shown (the twenty-fifth check round: the box kept her old end beside Saved, and +4 weeks made her plan eight weeks longer than it showed)", () => {
  const s = r.r25_phone;
  assert.deepStrictEqual({ box: s.typed.value, kept: s.typed.here, server: s.typed.server }, { box: r.OLD, kept: r.OLD, server: r.IPAD }, "the iPad's +4 weeks is on the server, not read here yet, as he types her phone");
  assert.deepStrictEqual({ kept: s.saved.here, server: s.saved.server }, { kept: r.IPAD, server: r.IPAD }, "his save took the iPad's date, here and on the server");
  assert.deepStrictEqual({ box: s.saved.value, drawn: s.saved.shown, plan: s.saved.sel }, { box: r.IPAD, drawn: r.IPAD, plan: "pm" }, "Active until shows the iPad's date as soon as the save lands (it showed " + s.saved.value + " beside Saved)");
  assert.strictEqual(s.left.value, r.IPAD, "a click away: still the iPad's date");
  assert.deepStrictEqual({ box: s.plusSaved.value, kept: s.plusSaved.here, server: s.plusSaved.server }, { box: daysLater(s.left.value, 28), kept: daysLater(s.left.value, 28), server: daysLater(s.left.value, 28) }, "+4 weeks: four weeks after the date the box showed");
});

test("(R25-HND-1) her page, no card open: Change, +1 and Save on her 10 sessions plan within the minute after his iPad switched her to Monthly plus, or a note saved on her Notes tab after the iPad's +4 weeks on her ended plan: as soon as that save lands her page shows the plan her record now holds, Monthly plus with its date, or her plan running again with no Plan ended over it (the twenty-fifth check round: her plan card kept 10 sessions, 1 of 10, or Plan ended, beside Saved until the next sync)", () => {
  const a = r.r25_pageAdjust, n = r.r25_pageNote;
  assert.deepStrictEqual({ name: a.before.name, big: a.before.big }, { name: "10 sessions", big: "0 of 10" }, "her page shows her 10 sessions plan");
  assert.deepStrictEqual({ name: a.pressed.name, big: a.pressed.big, server: a.pressed.server }, { name: "10 sessions", big: "1 of 10", server: "pm2" }, "Change, +1, Save: one session more at once; the iPad's switch is on the server, not read here yet");
  assert.deepStrictEqual({ kept: a.saved.here, server: a.saved.server }, { kept: "pm2", server: "pm2" }, "his save took the iPad's switch: Monthly plus, here and on the server");
  assert.deepStrictEqual({ name: a.saved.name, big: a.saved.big, bar: a.saved.bar }, { name: "Monthly plus", big: Q.words.pm2, bar: "Saved" }, "her plan card shows Monthly plus and its date as soon as the save lands (it showed " + a.saved.name + ", " + a.saved.big + ")");
  assert.deepStrictEqual({ kicker: n.before.kicker, big: n.before.big }, { kicker: "Plan ended", big: Q.words.ended }, "her plan ended three days ago: Plan ended over her page");
  assert.deepStrictEqual({ server: n.saved.until, kicker: n.saved.kicker, big: n.saved.big, bar: n.saved.bar }, { server: r.r24.PLUS, kicker: "", big: Q.words.ipadEnded, bar: "Saved" }, "his note's save took the iPad's +4 weeks: as soon as it lands her page shows her plan running, with no Plan ended (it showed " + JSON.stringify(n.saved.kicker) + ", " + n.saved.big + ")");
});

test("(R25-HND-2) Active until clicked into, nothing typed, while his iPad's +4 weeks (or its switch to Monthly plus) lands by a sync: once he clicks away, the box shows the date her plan now has, beside the package the Plan pop-up shows, and +4 weeks then gives four weeks after it; leaving writes nothing. A date picked on a phone's wheel whose save takes the iPad's switch while the box still has the focus: Done shows Monthly plus's own date (the twenty-fifth check round: the box kept the date it was drawn with beside Saved, under Monthly plus's name, until the next sync)", () => {
  for (const [name, label, plan, until] of [["r25_focusDate", "the iPad's +4 weeks", "pm", r.IPAD], ["r25_focusSwitch", "the iPad's Monthly plus", "pm2", Q.PM2_UNTIL]]) {
    const s = r[name];
    assert.deepStrictEqual({ focused: s.synced.focused, box: s.synced.value, kept: s.synced.here, plan: s.synced.sel }, { focused: true, box: r.OLD, kept: until, plan }, label + ": the sync leaves the box he is in alone (round 24), its old date under the pop-up's package");
    assert.deepStrictEqual({ focused: s.left.focused, box: s.left.value, drawn: s.left.shown, plan: s.left.sel, sent: s.left.writes }, { focused: false, box: until, drawn: until, plan, sent: [] }, label + ", then a click away: the box shows the date her plan has, and nothing is written (it showed " + s.left.value + ")");
    assert.deepStrictEqual({ box: s.after.value, kept: s.after.here, server: s.after.server, sent: s.after.writes }, { box: until, kept: until, server: until, sent: [] }, label + ": after a pause longer than a save's wait, still the iPad's date, nothing written");
    assert.deepStrictEqual({ box: s.plusSaved.value, server: s.plusSaved.server }, { box: daysLater(s.after.value, 28), server: daysLater(s.after.value, 28) }, label + ": +4 weeks then gives four weeks after the date the box showed");
  }
  const m = r.r25_mergeFocused;
  assert.deepStrictEqual({ focused: m.saved.focused, plan: m.saved.sel, box: m.saved.value, kept: [m.saved.planHere, m.saved.here] }, { focused: true, plan: "pm2", box: Q.PICK, kept: ["pm2", Q.PM2_UNTIL] }, "his date picked on a phone's wheel, his save taking the iPad's Monthly plus while the box still has the focus: the Plan pop-up shows Monthly plus, the box he is in keeps his date");
  assert.deepStrictEqual({ box: m.left.value, drawn: m.left.shown, plan: m.left.sel, sent: m.after.writes.length }, { box: Q.PM2_UNTIL, drawn: Q.PM2_UNTIL, plan: "pm2", sent: m.saved.writes.length }, "then Done: the box shows Monthly plus's own date, and nothing more is written (it showed " + m.left.value + ")");
});

test("(R25-TW-12) next year's Dec 31 typed in Active until and saved with Return, then her old end put back, typed (then Return) or picked in the box's calendar: the date put back lands at once, here, on the card and on the server, and stays after a click away (the twenty-fifth check round: only a source-text pin held untilPut's dataset.shown; without it the date put back was refused, the box saying her old end while her plan, the card and the server stayed on Dec 31 next year)", () => {
  for (const [how, label] of [["typed", "typed back, then Return"], ["picked", "picked back in the box's calendar"]]) {
    const s = r["r25_back_" + how];
    assert.deepStrictEqual({ box: s.first.value, kept: s.first.here, server: s.first.server, card: s.first.big }, { box: r.NEW, kept: r.NEW, server: r.NEW, card: r.words.new }, label + ": first the slip, saved with Return: Dec 31 next year here, on the card and on the server");
    assert.deepStrictEqual({ box: s.back.value, kept: s.back.here, server: s.back.server, card: s.back.big, sent: s.back.writes }, { box: r.OLD, kept: r.OLD, server: r.OLD, card: r.words.old, sent: [r.NEW, r.OLD] }, label + ": her old end lands here, on the card and on the server (her plan said " + s.back.here + ")");
    assert.deepStrictEqual({ box: s.left.value, kept: s.left.here, server: s.left.server, sent: s.left.writes }, { box: r.OLD, kept: r.OLD, server: r.OLD, sent: [r.NEW, r.OLD] }, label + ", then a click away: her old end stays, and nothing more is written");
  }
});
