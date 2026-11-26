import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
import { test, assert } from "./assert.js";
import { load } from "./load.js";
const app = await load();
const { fns, maps } = app;
const checkPdf = (bytes) => {
  const s = Buffer.from(bytes).toString("latin1");
  const m = /startxref\n(\d+)\n%%EOF$/.exec(s); assert.ok(m, "startxref"); const x = Number(m[1]); assert.strictEqual(s.slice(x, x + 4), "xref");
  const offs = [...s.slice(x).matchAll(/(\d{10}) 00000 n/g)].map((r) => Number(r[1]));
  offs.forEach((o, i) => assert.strictEqual(s.slice(o, o + String(i + 1).length + 6), (i + 1) + " 0 obj", "object " + (i + 1) + " offset"));
  return { text: s, pages: (s.match(/\/Type \/Page \/Parent/g) || []).length };
};
const seed = () => {
  const first = new Date(); first.setDate(1); const inMonth = (n) => { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(Math.max(1, d.getDate() - n)); return fns.localIso(d); };
  app.reset(); const c = { id: "c1", name: "Jiří Novák", unit: "lb", notes: { log: [{ id: "n1", at: new Date(inMonth(1) + "T19:00:00").toISOString(), text: "Twinge on set 2.", workout: { id: "a", title: "Lower", date: inMonth(1) } }] } }; maps.clients.set("c1", c);   // v316 (the twentieth check round): the note in this month too (dated yesterday, the 1st of every month failed)
  maps.trainings.set("a", { id: "a", clientId: "c1", title: "Lower", date: inMonth(1), createdAt: "2026-10-01T10:00:00.000Z", completedAt: new Date(inMonth(1) + "T18:00:00").toISOString(), skippedAt: null,
    rows: [{ id: "r1", name: "Back squat", setsDone: 2, weights: ["140", "140"], repsDone: ["5", "5"], earlyReason: "Short on time" }, { id: "r2", name: "Plank", setsDone: 1, weights: ["60 sec"], repsDone: [""] }] });
  maps.trainings.set("b", { id: "b", clientId: "c1", title: "Push", date: inMonth(0), createdAt: "2026-10-01T10:00:00.000Z", completedAt: null, skippedAt: null, rows: [{ id: "r3", name: "Bench", setsDone: 0 }] });
  return c;
};
test("the report is a valid PDF with the built-in font, and a timed entry is not a weight", () => {
  const c = seed(); const { bytes, name } = fns.buildReport("month", null, c);
  const { text, pages } = checkPdf(bytes); assert.ok(pages >= 1);
  assert.ok(/Ji.* Nov.k/.test(name) && name.endsWith(".pdf"));
  assert.ok(text.includes("(60 sec)") || text.includes("60 sec"), "the timed entry prints as typed"); assert.ok(!text.includes("60 lb"), "and never as pounds");
  assert.ok(text.includes("140 lb"), "a real weight prints with its unit");
});
test("a hold logged as time prints as seconds, with the weight only when there was one", () => {
  const c = seed(); const a = maps.trainings.get("a");
  a.rows[1] = { id: "r2", name: "Plank", reps: "30 sec", setsDone: 2, weights: ["", "25"], repsDone: ["30", "45"], clientNote: "Shaky at the end", clientNoteBy: "coach" };
  const { text } = checkPdf(fns.buildReport("month", null, c).bytes);
  assert.ok(text.includes("30 sec"), "a plain hold"); assert.ok(text.includes("25 lb × 45 sec") || text.includes("25 lb \u00d7 45 sec") || /25 lb.{1,4}45 sec/.test(text), "a weighted hold");
  assert.ok(!text.includes("30 reps") && !text.includes("45 reps"), "never as reps");
  assert.ok(text.includes("note from coach: Shaky"), "a card note says who wrote it");
});
test("the report embeds Inter when the font files are there, keeping Czech letters", () => {
  const c = seed(); const dir = path.join(__dirname, "..", "fonts");
  const load = (f) => { const b = fs.readFileSync(path.join(dir, f)); return fns.parseTtf(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)); };
  const fonts = { regular: load("Inter-Regular.ttf"), bold: load("Inter-Bold.ttf") };
  assert.ok(fonts.regular.gid("ř") > 0 && fonts.bold.gid("ě") > 0, "Czech letters in the subset");
  const { bytes, name } = fns.buildReport("month", fonts, c);
  const { text, pages } = checkPdf(bytes); assert.ok(pages >= 1); assert.strictEqual((text.match(/\/FontFile2/g) || []).length, 2);
  assert.ok(name.startsWith("Jiří Novák"), "accents survive in the file name");
});
test("a chosen month covers that whole month", () => {
  const r = fns.reportRange("2026-02"); assert.strictEqual(r.from, "2026-02-01"); assert.strictEqual(r.to, "2026-02-28"); assert.ok(/February 2026/.test(r.title));
});

test("a row logged in pounds prints in kilos after the client switched to kilos (v301: one unit, one decimal), and a minute hold compares with a seconds hold", () => {
  const c = seed(); c.unit = "kg";
  const a = maps.trainings.get("a"); a.rows[0].unit = "lb"; a.rows[1].reps = "1 min"; a.rows[1].weights = [""]; a.rows[1].repsDone = ["1"];
  const { text } = checkPdf(fns.buildReport("month", null, c).bytes);
  assert.ok(text.includes("63.5 kg"), "140 lb reads 63.5 kg"); assert.ok(!text.includes("140 kg"), "never read as kilos"); assert.ok(!/140 lb/.test(text), "and the report holds one unit");
  a.rows[0].weights = ["140", "2x20"]; const words = checkPdf(fns.buildReport("month", null, c).bytes).text; assert.ok(words.includes("2x20 lb"), "words with a number say the unit they were logged in");
  a.rows[0].weights = ["1,000", "1,000"]; const thousand = checkPdf(fns.buildReport("month", null, c).bytes).text; assert.ok(thousand.includes("453.6 kg"), "1,000 lb is a thousand: 453.6 kg"); assert.ok(!/\b0\.5 kg/.test(thousand), "never 1 lb");
  assert.ok(text.includes("60 sec"), "a one-minute hold reads as 60 seconds in the progress table"); assert.ok(!text.includes("1 min") || text.includes("60 sec"));
});

test("the PDF's Best is the heavier of two sets the same within 0.06 kg, so it never reads lower than End (61.2 kg, then 135 lb at home)", () => {
  const c = seed(); const a = maps.trainings.get("a"), b = maps.trainings.get("b");   // fixed days in October 2026: the order holds on any day the tests run
  Object.assign(a, { date: "2026-10-06", completedAt: new Date("2026-10-06T18:00:00").toISOString(), rows: [{ id: "r1", name: "Back squat", setsDone: 1, weights: ["61.2"], repsDone: ["5"], unit: "kg" }] });
  Object.assign(b, { date: "2026-10-14", completedAt: new Date("2026-10-14T18:00:00").toISOString(), rows: [{ id: "r3", name: "Back squat", setsDone: 1, weights: ["135"], repsDone: ["5"], unit: "lb" }] });
  const { text } = checkPdf(fns.buildReport("2026-10", null, c).bytes);
  const cells = [...text.matchAll(/\(([^)]*lb[^)]*)\)/g)].map((m) => m[1]); assert.deepStrictEqual(cells.slice(0, 3), ["134.9 lb × 5", "135 lb × 5", "135 lb × 5"], "START, END, BEST: BEST is 135 lb, as END");
});
// v322 (the outside audit of 20 Nov 2026, its #9): the Progress table's lines as the PDF holds them: EXERCISE, SESSIONS, START, END, BEST (the built-in font writes the dash of an exercise done once as "?")
const progRows = (text) => { const cells = [...text.matchAll(/\(((?:[^()\\]|\\.)*)\)/g)].map((m) => m[1]), from = cells.indexOf("BEST") + 1, to = cells.indexOf("Sessions", from), out = []; for (let i = from; i + 4 < to; i += 5) out.push(cells.slice(i, i + 5)); return out; };
const onDay = (t, d, rows) => Object.assign(t, { date: d, completedAt: new Date(d + "T18:00:00").toISOString(), skippedAt: null, rows });   // fixed days in October 2026: the order holds on any day the tests run
const set1 = (id, name, reps, w, done) => ({ id, name, reps, setsDone: 1, weights: [w], repsDone: [done], unit: "lb" });
test("(v322, the outside audit's #9) an exercise planned in metres, then in seconds, has a line for each in the monthly report: a 40 m carry is never printed as 40 sec, nor compared with a hold", () => {
  const c = seed(), a = maps.trainings.get("a"), b = maps.trainings.get("b");
  onDay(a, "2026-10-06", [set1("r1", "Farmer carry", "40 m", "45", "40"), set1("r2", "Back squat", "5", "140", "5")]);
  onDay(b, "2026-10-14", [set1("r3", "Farmer carry", "30 sec", "45", "30"), set1("r4", "Back squat", "5", "145", "5")]);
  const { text } = checkPdf(fns.buildReport("2026-10", null, c).bytes);
  assert.deepStrictEqual(progRows(text), [["Back squat", "2", "140 lb × 5", "145 lb × 5", "145 lb × 5"], ["Farmer carry", "1", "45 lb × 40 m", "?", "45 lb × 40 m"], ["Farmer carry", "1", "45 lb × 30 sec", "?", "45 lb × 30 sec"]],
    "the carry in metres and the carry in seconds each on a line of their own, the older first; an exercise of one kind as before");
  assert.ok(!text.includes("40 sec") && !text.includes("30 m"), "no result under the other plan's unit, anywhere in the report (it printed 45 lb × 40 sec as the start and the best)");
});
test("(v322, the outside audit's #9) reps before a hold, and a hold before reps: each keeps its own words in the monthly report (10 reps was printed as 10 sec, a 45-second hold as 45 reps)", () => {
  const c = seed(), a = maps.trainings.get("a"), b = maps.trainings.get("b");
  onDay(a, "2026-10-06", [set1("r1", "Plank", "10", "", "10")]); onDay(b, "2026-10-14", [set1("r3", "Plank", "45 sec", "", "45")]);
  const first = checkPdf(fns.buildReport("2026-10", null, c).bytes).text;
  assert.deepStrictEqual(progRows(first), [["Plank", "1", "10 reps", "?", "10 reps"], ["Plank", "1", "45 sec", "?", "45 sec"]], "reps, then the hold");
  assert.ok(!first.includes("10 sec") && !first.includes("45 reps"), "neither under the other's unit");
  onDay(a, "2026-10-06", [set1("r1", "Plank", "45 sec", "", "45")]); onDay(b, "2026-10-14", [set1("r3", "Plank", "10", "", "10")]);
  const second = checkPdf(fns.buildReport("2026-10", null, c).bytes).text;
  assert.deepStrictEqual(progRows(second), [["Plank", "1", "45 sec", "?", "45 sec"], ["Plank", "1", "10 reps", "?", "10 reps"]], "the hold, then reps");
  assert.ok(!second.includes("45 reps") && !second.includes("10 sec"), "neither under the other's unit");
});
test("(v322) holds planned in minutes and in seconds still share one line of the monthly report, in seconds, and an exercise's lines stay together, placed by all its sessions that month", () => {
  const c = seed(), a = maps.trainings.get("a"), b = maps.trainings.get("b");
  onDay(a, "2026-10-06", [set1("r1", "Plank", "1 min", "", "1")]); onDay(b, "2026-10-14", [set1("r3", "Plank", "90 sec", "", "90")]);
  assert.deepStrictEqual(progRows(checkPdf(fns.buildReport("2026-10", null, c).bytes).text), [["Plank", "2", "60 sec", "90 sec", "90 sec"]], "one line: a minute is 60 seconds, and 90 seconds is the end and the best");
  onDay(a, "2026-10-06", [set1("r1", "Farmer carry", "40 m", "45", "40"), set1("r2", "Back squat", "5", "140", "5")]);
  onDay(b, "2026-10-14", [set1("r3", "Farmer carry", "40 m", "45", "50"), set1("r4", "Back squat", "5", "145", "5")]);
  maps.trainings.set("x", onDay({ id: "x", clientId: "c1", title: "Carry", createdAt: "2026-10-01T10:00:00.000Z" }, "2026-10-20", [set1("r5", "Farmer carry", "30 sec", "45", "30")]));
  assert.deepStrictEqual(progRows(checkPdf(fns.buildReport("2026-10", null, c).bytes).text).map((r) => r.slice(0, 3)), [["Farmer carry", "2", "45 lb × 40 m"], ["Farmer carry", "1", "45 lb × 30 sec"], ["Back squat", "2", "140 lb × 5"]],
    "the carry's three sessions put both its lines first, together, the one with more sessions on top; the squat's two after them");
});
test("(v307, the audit's #6) his private notes are left out of the report unless he asks for them: no Notes section at all by default; with { notes: true } they are there, under their heading", () => {
  const c = seed();
  const off = checkPdf(fns.buildReport("month", null, c).bytes).text, fromSheet = checkPdf(fns.buildReport("month", null, c, { notes: false }).bytes).text;
  for (const t of [off, fromSheet]) { assert.ok(!t.includes("Twinge on set 2."), "no note"); assert.ok(!t.includes("(Notes)") && !t.includes("No notes this month."), "no Notes section"); }
  assert.ok(off.includes("140 lb") && off.includes("finished early: Short"), "the rest of the month is all there, the client's own words included");
  const on = checkPdf(fns.buildReport("month", null, c, { notes: true }).bytes).text;
  assert.ok(on.includes("(Notes)") && on.includes("Twinge on set 2."), "his notes, when he turned them on");
  c.notes = { log: [] }; assert.ok(checkPdf(fns.buildReport("month", null, c, { notes: true }).bytes).text.includes("No notes this month."), "on, with none that month: it says so");
});
