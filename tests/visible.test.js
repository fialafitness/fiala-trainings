// The audit of 15 Nov 2026, its four visible fixes (v307), each built after the owner's pick and pictures of it:
// #12 "Mark set N as not done" asks first, naming every set that changes ("Ask first, naming sets");
// #25 a failed save is a banner at the top of the page with a real Try again ("Banner with Try again");
// #24 the sign-in's Email and Password are labelled rows ("Labelled rows");
// #6  the monthly report is one Monthly report button and a sheet, his private notes off unless he turns them on ("One button, export sheet").
// The question and the sheet play in their own process (visible-probe.mjs); the report's notes themselves are in report.test.js.
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test, assert, tick } from "./assert.js";
import { load } from "./load.js";
const here = path.dirname(fileURLToPath(import.meta.url));
const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const app = await load();
const { fns, maps } = app;
const $ = (id) => document.getElementById(id);
const r = JSON.parse(execFileSync(process.execPath, [path.join(here, "visible-probe.mjs")], { encoding: "utf8", timeout: 90000 }).trim().split("\n").pop());
const settle = async () => { const until = Date.now() + 15000; do await tick(5); while ((app.get().inflight > 0 || maps.timers.size) && Date.now() < until); };

// ---------- #12: "Mark set N as not done" ----------
test("(#12) with sets 1 to 3 done, set 2's button asks first and names both sets that change: \"Mark sets 2 and 3 as not done?\", their reps cleared, a red Mark not done; nothing changes while it asks", () => {
  assert.deepStrictEqual(r.button, { text: "Mark set 2 as not done", hidden: false });
  assert.deepStrictEqual(r.asked, { open: true, title: "Mark sets 2 and 3 as not done?", text: "Their reps are cleared.", yes: "Mark not done", red: true });
  assert.deepStrictEqual(r.askedRow, { setsDone: 3, done: false, reps: ["5", "6", "7"], weights: ["135", "135", "135", "", ""] }); assert.strictEqual(r.askedSaved, false);
});

test("(#12) Cancel changes nothing; a double tap's second tap on the red button does nothing; Mark not done un-does sets 2 and 3, clears their reps, keeps the weights, saves, and the card is on set 2", () => {
  assert.deepStrictEqual(r.cancelled, { open: false, row: { setsDone: 3, done: false, reps: ["5", "6", "7"], weights: ["135", "135", "135", "", ""] }, saved: false });
  assert.deepStrictEqual(r.doubleTap, { open: true, row: { setsDone: 3, done: false, reps: ["5", "6", "7"], weights: ["135", "135", "135", "", ""] } });
  assert.deepStrictEqual(r.marked, { open: false, row: { setsDone: 1, done: false, reps: ["5", "", ""], weights: ["135", "135", "135", "", ""] }, saved: true, touched: true, cur: "Set 2 of 5" });
});

test("(#12) the question names the sets as Drop sets does: one (\"set 3\", its reps), two (\"2 and 3\"), more (\"2 to 4\"); with no reps logged it says nothing about them", () => {
  assert.deepStrictEqual(r.one, { open: true, title: "Mark set 3 as not done?", text: "Its reps are cleared.", yes: "Mark not done", red: true });
  assert.deepStrictEqual(r.three, { open: true, title: "Mark sets 2 to 4 as not done?", text: "Their reps are cleared.", yes: "Mark not done", red: true });
  assert.deepStrictEqual(r.noReps, { open: true, title: "Mark sets 2 and 3 as not done?", text: "", yes: "Mark not done", red: true });
});

test("(#12) a superset: the sets done in either exercise are named, and both go back; an exercise finished before the set counter existed keeps the sets before the one marked, as the question says", () => {
  assert.strictEqual(r.superset.title, "Mark sets 2 and 3 as not done?");
  assert.deepStrictEqual(r.supersetMarked, { a: { setsDone: 1, done: false, reps: ["5", "", ""], weights: ["135", "135", "135", "", ""] }, b: { setsDone: 1, done: false, reps: ["10", ""], weights: ["60", "60", "", "", ""] } });
  assert.strictEqual(r.legacy.title, "Mark sets 3 and 4 as not done?");
  assert.deepStrictEqual(r.legacyMarked, { setsDone: 2, done: false, reps: ["5", "5", "", ""], weights: ["135", "135", "135", "135"] }, "sets 1 and 2 stay done (it used to clear all four)");
});

test("(#12) a sync that replaced the workout while it asked: the change goes into the one there now; a workout gone meanwhile is not brought back", () => {
  assert.deepStrictEqual(r.synced, { now: { setsDone: 1, done: false, reps: ["5", "", ""], weights: ["135", "135", "135", "", ""] }, title: "Synced", oldKept: 3 });
  assert.deepStrictEqual(r.gone, { asked: true, threw: null, back: false });
});

test("(#12) from the keyboard: Cancel puts the place back on the button, Mark not done on the card's Complete set; the client's own app asks the same and queues the change", () => {
  assert.deepStrictEqual(r.keyCancel, { focus: true });
  assert.deepStrictEqual(r.keyYes, { focus: true, text: "Complete set →" });
  assert.deepStrictEqual(r.client, { open: true, title: "Mark sets 2 and 3 as not done?", text: "Their reps are cleared.", yes: "Mark not done", red: true });
  assert.deepStrictEqual(r.clientMarked, { row: { setsDone: 1, done: false, reps: ["5", "", ""], weights: ["135", "135", "135", "", ""] }, queued: true });
});

// ---------- #25: a failed save, in a banner ----------
const failNow = (o) => { app.reset(); app.set({ backend: {}, offline: false, inflight: 0, failed: true, failReason: "", clientMode: false, ...o }); };
const banner = () => ({ hidden: $("saveBanner").hidden, why: $("saveWhy").textContent, button: $("saveAgain").textContent, bar: $("status").textContent, red: $("status").className === "err" });
const quietBanner = () => { app.set({ failed: false }); maps.dirty.clear(); fns.setStatus(); };

test("(#25) a client's failed save: the banner says what went wrong and that the sets are kept, with Try again; the bar above says nothing", () => {
  try {
    failNow({ clientMode: true, failReason: "database rule missing" }); maps.dirty.set("trainings/w1", 1); fns.setStatus();
    assert.deepStrictEqual(banner(), { hidden: false, why: " · Database rule missing. Your sets are kept on this phone.", button: "Try again", bar: "", red: false });
    maps.dirty.clear(); maps.dirty.set("clients/c1", 1); app.set({ failReason: "" }); fns.setStatus();
    assert.deepStrictEqual(banner(), { hidden: false, why: " · Your changes are kept on this phone.", button: "Try again", bar: "", red: false }, "a profile field: changes, not sets");
  } finally { quietBanner(); }
});

test("(#25) the coach's: his changes are kept on this device; refused for good with nothing waiting, the reason and OK, which puts the banner away", () => {
  try {
    failNow({ failReason: "that email is already on another client" }); maps.dirty.set("clients/c1", 1); fns.setStatus();
    assert.deepStrictEqual(banner(), { hidden: false, why: " · That email is already on another client. Your changes are kept on this device.", button: "Try again", bar: "", red: false });
    maps.dirty.clear(); fns.setStatus();
    assert.deepStrictEqual(banner(), { hidden: false, why: " · That email is already on another client.", button: "OK", bar: "", red: false });
    fns.saveAgain();
    assert.strictEqual(app.get().failed, false); assert.strictEqual($("saveBanner").hidden, true); assert.strictEqual($("status").textContent, "Saved");
  } finally { quietBanner(); }
});

test("(#25) Try again sends what waits once more and the banner goes; offline or still saving, there is no banner", async () => {
  try {
    failNow({ clientMode: true }); maps.dirty.set("trainings/w1", 1); fns.setStatus(); assert.strictEqual($("saveBanner").hidden, false);
    fns.saveAgain(); assert.strictEqual(app.get().failed, false); assert.strictEqual($("saveBanner").hidden, true);
    await settle();
    failNow({ clientMode: true, offline: true }); maps.dirty.set("trainings/w1", 1); fns.setStatus();
    assert.strictEqual($("saveBanner").hidden, true); assert.strictEqual($("status").textContent, "Offline · will sync");
    failNow({ clientMode: true, inflight: 1 }); fns.setStatus(); assert.strictEqual($("saveBanner").hidden, true); assert.strictEqual($("status").textContent, "Saving…");
  } finally { quietBanner(); app.set({ offline: false, inflight: 0 }); }
});

test("(#25) scrolled up out of sight under the bar, the bar says \"Couldn't save\" in red (a tap there scrolls up to it); beside it, as the page slides away under the swipe back, it does not", () => {
  const IO = {}; globalThis.IntersectionObserver = class { constructor(cb, o) { IO.cb = cb; IO.opts = o; IO.gone = false; } observe(el) { IO.el = el; } disconnect() { IO.gone = true; } };
  try {
    failNow({ clientMode: true }); maps.dirty.set("trainings/w1", 1); fns.setStatus();
    assert.ok(IO.cb && IO.el === $("saveBanner"), "the banner is watched while it shows"); assert.strictEqual(IO.opts.rootMargin, "0px 0px 0px 0px", "from the bar's foot (none in the tests)");
    IO.cb([{ isIntersecting: false, boundingClientRect: { top: -100, bottom: -10 }, rootBounds: { top: 0 } }]);
    assert.strictEqual(fns.bannerOff(), true); assert.deepStrictEqual([$("status").textContent, $("status").className], ["Couldn’t save", "err"]);
    IO.cb([{ isIntersecting: false, boundingClientRect: { top: 40, bottom: 130 }, rootBounds: { top: 0 } }]);
    assert.strictEqual(fns.bannerOff(), false); assert.strictEqual($("status").textContent, "");
    IO.cb([{ isIntersecting: false, boundingClientRect: { top: -100, bottom: -10 }, rootBounds: { top: 0 } }]); assert.strictEqual(fns.bannerOff(), true);
    quietBanner(); assert.strictEqual(IO.gone, true, "no watch once it has gone"); assert.strictEqual(fns.bannerOff(), false); assert.strictEqual($("status").textContent, "Saved");
  } finally { delete globalThis.IntersectionObserver; quietBanner(); }
});

test("(#25) the banner's markup: an alert at the top of the page, before every page, with the red mark, the words and a real button; the bar's words no longer offer a tap to retry", () => {
  assert.match(html, /<main>\n  <div class="save-banner" id="saveBanner" role="alert" hidden><svg class="sb-ico" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="[^"]+"\/><\/svg><p class="sb-text"><b>Couldn’t save<\/b><span id="saveWhy"><\/span><\/p><button type="button" id="saveAgain">Try again<\/button><\/div>\n  <section id="vLogin" hidden>/);
  assert.ok(html.includes("  .save-banner[hidden] { display: none; }\n"), "hidden means hidden (its flex would show it)");
  assert.ok(html.includes("  .save-banner .sb-ico { flex: none; width: 22px; height: 22px; color: var(--danger); }\n"));
  assert.ok(html.includes("  .save-banner button { flex: none; appearance: none; border: 0; border-radius: 999px; padding: 8px 14px; font: inherit; font-size: 0.9375rem; font-weight: 600; background: var(--brand-fill); color: #fff; cursor: pointer; }\n"));
  const src = fs.readFileSync(new URL("../app/main.js", import.meta.url), "utf8");
  assert.ok(!src.includes('tap to retry" : ""'), "no words to tap (the old line's ending; the comment that tells of it stays)");
});

// ---------- #24: the sign-in's labelled rows ----------
test("(#24) sign-in: Email and Password are labelled rows in one card, the hints in Apple's grey, the fields as they were (ids, the phone's password autofill, required)", () => {
  assert.ok(html.includes('      <ul class="list sign-rows">\n'
    + '        <li><label><span class="lab">Email</span><input id="loginEmail" type="email" placeholder="name@example.com" autocomplete="username" inputmode="email" autocapitalize="none" required></label></li>\n'
    + '        <li><label><span class="lab">Password</span><input id="loginPassword" type="password" placeholder="Required" autocomplete="current-password" required></label></li>\n'
    + '      </ul>\n      <button class="btn" type="submit" id="loginBtn"'));
  assert.ok(!/placeholder="Email" autocomplete="username"[^>]*>\n\s*<input id="loginPassword"/.test(html), "the old hint-only boxes are gone");
  assert.ok(html.includes("  .sign-rows .lab { flex: none; width: 92px; font-size: 1.0625rem; letter-spacing: -0.01em; color: var(--text-primary); }\n"));
  assert.ok(html.includes("  .sign-rows input::placeholder { color: var(--text-secondary); }\n"), "the hint at 4.6:1, not 1.5:1");
  assert.ok(/  \.sign-rows input:-webkit-autofill \{ -webkit-box-shadow: 0 0 0 40px var\(--card\) inset; -webkit-text-fill-color: var\(--text-primary\); \}/.test(html), "a filled-in password keeps the card's colours");
});

// ---------- #6: the monthly report's sheet ----------
test("(#6) one Monthly report button; its sheet opens on this month with the notes off, says what that means, and holds the page behind; a double tap's second tap changes nothing", () => {
  assert.ok(html.includes('<span class="rep-cap">Report PDF</span><button class="pill" type="button" id="reportBtn" aria-haspopup="dialog">Monthly report</button></div>'));
  assert.ok(!/id="reportNow"|id="reportMonth"|select\.pill/.test(html), "This month, Pick a month and their style are gone");
  assert.deepStrictEqual(r.opened, { open: true, lead: "Jane Smith", notes: "false", foot: "Off: safe to send to Jane. Your private notes stay in the app.", inert: true, focus: true, asking: true });
  const now = new Date(), iso = now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, "0");
  assert.strictEqual(r.months.count, 25); assert.strictEqual(r.months.first[0], iso); assert.strictEqual(r.months.value, iso, "this month chosen");
  assert.deepStrictEqual(r.early, { ...r.opened, shared: 0 });
});

test("(#6) the switch turns the notes on and off, its line with it; Share closes the sheet and hands the phone the PDF: without his notes when off, with them when on; off again at every open", () => {
  assert.deepStrictEqual([r.on.notes, r.on.foot], ["true", "On: for you only. Your private notes about Jane are in it."]);
  assert.deepStrictEqual([r.off.notes, r.off.foot], ["false", "Off: safe to send to Jane. Your private notes stay in the app."]);
  assert.strictEqual(r.sharedOff.open, false); assert.strictEqual(r.sharedOff.inert, false); assert.strictEqual(r.sharedOff.asking, false); assert.strictEqual(r.sharedOff.count, 1);
  assert.strictEqual(r.sharedOff.pdf.type, "application/pdf"); assert.match(r.sharedOff.pdf.name, /^Jane Smith \S+ \d{4}\.pdf$/);
  assert.deepStrictEqual([r.sharedOff.pdf.note, r.sharedOff.pdf.heading], [false, false], "off: no Notes, no note");
  assert.deepStrictEqual([r.sharedOn.count, r.sharedOn.pdf.note, r.sharedOn.pdf.heading], [2, true, true], "on: his notes, under their heading");
  assert.strictEqual(r.reopened, "false");
});

test("(#6) the month picked is the month shared; Cancel, the dim (a press begun on it) and Escape close it and share nothing; a press begun on the sheet and let go on the dim keeps it", () => {
  const prev = new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1, 12);   // last month, by the local calendar
  assert.strictEqual(r.sharedPrev.month, prev.toLocaleDateString(undefined, prev.getFullYear() === new Date().getFullYear() ? { month: "long" } : { month: "long", year: "numeric" }));
  assert.strictEqual(r.sharedPrev.pdf.name, "Jane Smith " + prev.toLocaleDateString(undefined, { month: "long", year: "numeric" }) + ".pdf");
  assert.strictEqual(r.sharedPrev.pdf.note, false);
  assert.deepStrictEqual([r.cancel.open, r.cancel.inert, r.cancel.shared], [false, false, 3]);
  assert.strictEqual(r.dimFromSheet, true); assert.deepStrictEqual([r.dim.open, r.dim.shared], [false, 3]); assert.strictEqual(r.escape, false);
});

test("(#6) from the keyboard Cancel puts the place back on Monthly report; another question closes the sheet first; never in the client's app or off the client's page; nothing thrown", () => {
  assert.strictEqual(r.keyBack, true);
  assert.deepStrictEqual(r.otherAsk, { rep: false, ask: true });
  assert.strictEqual(r.repClient, false); assert.strictEqual(r.otherPage, false);
  assert.deepStrictEqual(r.rejected, []);
});

test("(#6) the months: this one and the 24 before, the year written only where it is not this one; the line under the switch names the client by first name", () => {
  const m = fns.repMonths(new Date(2026, 10, 15, 12));
  assert.strictEqual(m.length, 25);
  assert.deepStrictEqual([m[0], m[10], m[11], m[24]], [["2026-11", "November"], ["2026-01", "January"], ["2025-12", "December 2025"], ["2024-11", "November 2024"]]);
  assert.strictEqual(fns.repFoot(false, { name: "Jane Smith" }), "Off: safe to send to Jane. Your private notes stay in the app.");
  assert.strictEqual(fns.repFoot(true, { name: "" }), "On: for you only. Your private notes about your client are in it.");
});

test("(#6) the sheet's markup: Apple's switch for the notes, off, read with its line; the month as the card's Plan pop-up; Share over Cancel; the list the page grey on the sheet", () => {
  assert.ok(html.includes('<button class="ios-switch" id="repNotes" type="button" role="switch" aria-checked="false" aria-labelledby="repNotesLabel" aria-describedby="repFoot"></button>'));
  assert.ok(html.includes('<span class="pop-sel"><select id="repMonth" aria-label="Month"></select><svg class="pop-chev" viewBox="0 0 9 13"'));
  assert.ok(html.includes('<div class="ask-actions"><button class="btn" id="repShare" type="button">Share</button><button class="btn quiet" id="repNo" type="button">Cancel</button></div>'));
  assert.ok(html.includes("  .rep-sheet .settings-list { margin: 14px 0 0; background: var(--sheet-list); border-color: transparent; }"));
  assert.ok(html.includes("  .rep-sheet .settings-list .pop-sel { font-size: 1.0625rem; color: var(--text-secondary); }"), "after .settings-list .pop-sel in weight, wherever it sits");
});
