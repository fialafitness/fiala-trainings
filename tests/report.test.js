"use strict";
const fs = require("fs"), path = require("path");
const { test, assert } = require("./assert");
const app = require("./load")();
const { fns, maps } = app;
const day = (n) => { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + n); return fns.localIso(d); };
const at = (n, h) => { const d = new Date(); d.setDate(d.getDate() + n); d.setHours(h, 0, 0, 0); return d.toISOString(); };
const checkPdf = (bytes) => {
  const s = Buffer.from(bytes).toString("latin1");
  const m = /startxref\n(\d+)\n%%EOF$/.exec(s); assert.ok(m, "startxref"); const x = Number(m[1]); assert.strictEqual(s.slice(x, x + 4), "xref");
  const offs = [...s.slice(x).matchAll(/(\d{10}) 00000 n/g)].map((r) => Number(r[1]));
  offs.forEach((o, i) => assert.strictEqual(s.slice(o, o + String(i + 1).length + 6), (i + 1) + " 0 obj", "object " + (i + 1) + " offset"));
  return { text: s, pages: (s.match(/\/Type \/Page \/Parent/g) || []).length };
};
const seed = () => {
  app.reset(); const c = { id: "c1", name: "Jiří Novák", unit: "lb", notes: { log: [{ id: "n1", at: at(-1, 19), text: "Twinge on set 2.", workout: { id: "a", title: "Lower", date: day(-1) } }] } }; maps.clients.set("c1", c);
  const first = new Date(); first.setDate(1); const inMonth = (n) => { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(Math.max(1, d.getDate() - n)); return fns.localIso(d); };
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
