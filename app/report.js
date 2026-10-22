// The monthly client report: overview, progress, sessions, notes, laid out on US Letter.
import { today, localIso, fmtDay, clamp } from "./util.js";
import { effDate, measurePlan, topSet as modelTop, setCounts, setsOf } from "./model.js";
import { noteEntries } from "./notes.js";
import { pdfDoc } from "./pdf.js";

export function reportRange(kind) {                                      // "month" = this month; "2026-09" = that month
  const base = new Date(today() + "T12:00:00");
  const first = /^\d{4}-\d{2}$/.test(kind) ? new Date(Number(kind.slice(0, 4)), Number(kind.slice(5, 7)) - 1, 1, 12) : new Date(base.getFullYear(), base.getMonth(), 1, 12);
  const last = new Date(first.getFullYear(), first.getMonth() + 1, 0, 12);
  return { from: localIso(first), to: localIso(last), title: first.toLocaleDateString(undefined, { month: "long", year: "numeric" }) };
}
export function buildReport(kind, fonts, c, allTrainings) {                           // the client's month on paper: overview, progress, sessions, notes
  const r = reportRange(kind), doc = pdfDoc(fonts), t = today(), made = new Date(), M = doc.M, R = doc.W - doc.M;
  const grey = "0.45 0.45 0.47", soft = "0.25 0.25 0.27", brand = "0.435 0.42 0.6", fern = "0.235 0.478 0.306", warn = "0.65 0.23 0.27";
  const inRange = (day) => day >= r.from && day <= r.to, unit = c.unit || "lb";
  const sessions = allTrainings.filter((x) => inRange(effDate(x))).sort((a, b) => effDate(a).localeCompare(effDate(b)));
  const notes = noteEntries(c).filter((n) => n.at && inRange(localIso(new Date(n.at)))).sort((a, b) => a.at.localeCompare(b.at));
  const status = (x) => x.completedAt ? "Finished" : x.skippedAt ? (x.missed === true ? "Missed" : "Skipped") : effDate(x) < t ? "Not done" : "Planned";
  const totals = { finished: 0, missed: 0, skipped: 0, planned: 0 };
  for (const x of sessions) { const st = status(x); totals[st === "Finished" ? "finished" : st === "Skipped" ? "skipped" : st === "Planned" ? "planned" : "missed"]++; }
  const when = (d) => d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  // the header
  doc.text("FIALA TRAININGS", { size: 9, bold: true, color: brand, gap: 10 });
  doc.text(c.name || "Client", { size: 26, bold: true, gap: 5 });
  doc.row([{ x: M, text: r.title + "  ·  Monthly report", color: grey }, { right: R, text: "Made " + when(made), size: 9, color: grey }], { size: 12, gap: 8 });
  // overview: the month in three figures
  doc.section("Overview");
  const held = totals.finished + totals.missed + totals.skipped;
  const tiles = [[String(totals.finished), "Finished"], [String(totals.missed), "Missed"], [String(totals.skipped), "Skipped"], [held ? Math.round(100 * totals.finished / held) + "%" : "–", "Attendance"]];
  doc.space(6);
  doc.row(tiles.map((tl, i) => ({ x: M + i * 126, text: tl[0], size: 24, bold: true })), { size: 24, gap: 3 });
  doc.row(tiles.map((tl, i) => ({ x: M + i * 126, text: tl[1].toUpperCase(), size: 8, color: grey })), { size: 8, gap: 8 });
  if (totals.planned) doc.text(totals.planned + (totals.planned === 1 ? " session" : " sessions") + " still planned this month.", { size: 10, color: grey });
  // progress: per exercise, the top set at the first and the last session of the month, and the best
  const num = (v) => { const str = String(v == null ? "" : v).trim(); return /^\d+(?:[.,]\d+)?$/.test(str) ? parseFloat(str.replace(",", ".")) : null; };
  const better = (a, b, timed) => !b || (timed ? (a.rp || 0) > (b.rp || 0) || ((a.rp || 0) === (b.rp || 0) && (a.w || 0) > (b.w || 0))   // a hold: longer wins, then heavier
    : (a.w != null && (b.w == null || a.w > b.w || (a.w === b.w && (a.rp || 0) > (b.rp || 0)))) || (a.w == null && b.w == null && (a.rp || 0) > (b.rp || 0)));
  const topSet = (row) => modelTop(row, !!measurePlan(row.reps));   // the same rule as the card and the overview: a completed set, or one with its reps logged
  const fmtSet = (st, tm) => tm ? (st.w != null ? st.w + " " + unit + " × " : "") + (st.rp != null ? st.rp + " " + tm.unit : "–")   // "30 sec", "50 lb × 30 sec"
    : (st.w != null ? st.w + " " + unit + (st.rp != null ? " × " + st.rp : "") : (st.rp != null ? st.rp + (st.rp === 1 ? " rep" : " reps") : "–"));
  const same = (a, b) => a.w === b.w && a.rp === b.rp;
  const prog = new Map();
  for (const x of sessions) if (x.completedAt) for (const row of x.rows || []) {
    const top = topSet(row), name = String(row.name || "").trim(); if (!top || !name) continue;
    const k = name.toLowerCase(), tm = measurePlan(row.reps); if (!prog.has(k)) prog.set(k, { name, first: top, last: top, best: top, n: 0, tm });
    const e = prog.get(k); e.n++; e.last = top; e.name = name; e.tm = tm; if (better(top, e.best, !!tm)) e.best = top;
  }
  doc.section("Progress");
  if (!prog.size) doc.text("No sets logged this month.", { size: 10.5, color: grey });
  else {
    const col = { name: M, n: M + 206, start: M + 262, end: M + 344, best: M + 426 };
    doc.row([{ x: col.name, text: "EXERCISE" }, { x: col.n, text: "SESSIONS" }, { x: col.start, text: "START" }, { x: col.end, text: "END" }, { x: col.best, text: "BEST" }].map((h) => ({ ...h, size: 8, color: grey })), { size: 8, gap: 2 });
    doc.rule();
    for (const e of [...prog.values()].sort((a, b) => b.n - a.n || a.name.localeCompare(b.name))) {
      const up = e.n > 1 && !same(e.first, e.last) && better(e.last, e.first, !!e.tm);
      doc.row([{ x: col.name, text: e.name, bold: true, maxW: 196 }, { x: col.n, text: String(e.n), color: soft }, { x: col.start, text: fmtSet(e.first, e.tm), color: soft, maxW: 78 }, { x: col.end, text: e.n > 1 ? fmtSet(e.last, e.tm) : "–", color: up ? fern : soft, bold: up, maxW: 78 }, { x: col.best, text: fmtSet(e.best, e.tm), color: soft, maxW: 78 }], { size: 10, gap: 7 });
    }
  }
  // sessions: one line each, logged sets underneath
  doc.section("Sessions");
  if (!sessions.length) doc.text("No sessions this month.", { size: 10.5, color: grey });
  for (const x of sessions) {
    const st = status(x); doc.keep(42);                                      // a session's line stays with its first logged sets
    doc.row([{ x: M, text: fmtDay(effDate(x)), bold: true }, { x: M + 92, text: x.title || "Workout", bold: true, maxW: 290 }, { right: R, text: st, color: st === "Finished" ? fern : st === "Missed" || st === "Not done" ? warn : grey }], { size: 10.5, gap: 3 });
    if (x.completedAt) for (const row of x.rows || []) {
      const sets = [], tm = measurePlan(row.reps);
      for (let i = 0; i < setsOf(row); i++) { if (!setCounts(row, i)) continue; const w = String((row.weights || [])[i] || "").trim(), rp = String((row.repsDone || [])[i] || "").trim(); const wt = w ? (/^\d+(?:[.,]\d+)?$/.test(w) ? w + " " + unit : w) : ""; sets.push(tm ? (wt ? wt + " × " : "") + (rp ? rp + " " + tm.unit : "–") : (wt ? wt + (rp ? " × " + rp : "") : (rp ? rp + " reps" : "–"))); }
      const lines = doc.wrap((sets.length ? sets.join(", ") : "not started") + (row.earlyReason ? "  ·  finished early: " + row.earlyReason : "") + (row.clientNote ? "  ·  note from " + (row.clientNoteBy === "coach" ? "coach" : (String(c.name || "").trim().split(/\s+/)[0] || "client")) + ": " + row.clientNote : ""), 9.5, false, R - (M + 252));
      doc.row([{ x: M + 92, text: row.name || "Exercise", color: soft, maxW: 150 }, { x: M + 252, text: lines[0], color: soft }], { size: 9.5, gap: 2 });
      for (const ln of lines.slice(1)) doc.text(ln, { size: 9.5, indent: 198, gap: 2, color: soft });
    }
    doc.space(5);
  }
  // notes, each with its time and the session it came with
  doc.section("Notes");
  if (!notes.length) doc.text("No notes this month.", { size: 10.5, color: grey });
  notes.forEach((n, i) => {
    const d = new Date(n.at); doc.keep(44);                                  // a note's heading stays with its first lines
    doc.row([{ x: M, text: d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }) + ", " + d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }), bold: true, color: grey }, ...(n.workout ? [{ x: M + 150, text: n.workout.title || "Workout", color: grey, maxW: 300 }] : [])], { size: 9, gap: 3 });
    doc.text(n.text, { size: 10.5, gap: 4 });
    if (i < notes.length - 1) { doc.space(2); doc.rule(); }
  });
  doc.footer((c.name || "Client") + "  ·  " + r.title);
  return { bytes: doc.bytes(), name: ((c.name || "Client") + " " + r.title).replace(/[^\p{L}\p{N}\- ]+/gu, " ").replace(/\s+/g, " ").trim() + ".pdf" };
}
