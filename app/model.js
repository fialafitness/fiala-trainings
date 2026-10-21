// The workout model: what a training, a row and the templates entry are, with no app state.
import { uid, clamp, localIso } from "./util.js";

export const TEMPLATES_ID = "00000000-0000-4000-8000-0000000000f1";
export const isTemplateClient = (id) => id === TEMPLATES_ID;
export const effDate = (t) => t.completedAt ? localIso(new Date(t.completedAt)) : (t.date || "");
export const freshRow = (r) => { const x = { ...r, id: uid(), weights: [], repsDone: [], setsDone: 0, done: false, alts: [...(r.alts || [])] }; delete x.earlyReason; delete x.clientNote; delete x.clientNoteBy; delete x.clientNoteAt; return x; };   // the plan, with nothing logged
export const isEmptyWorkout = (t) => !!t && !t.completedAt && !t.skippedAt && !(t.rows || []).length && !String(t.title || "").trim() && !isTemplateClient(t.clientId);
// A plan written in time ("30 sec", "45 s", "1 min", "60 sec / side") is logged as time held, not reps: { n: "30", unit: "sec" }.
// A timed plan: the reps box says time, so the set log asks for time, not reps. Every spelling he uses: "30 sec", "30s", "30 seconds / side",
// "1 min", "30-45 sec", "1:00", 30", and the words "hold" / "max hold" / "as long as possible". The exercise name never decides (a plank jack is reps).
export const timedPlan = (reps) => {
  const s = String(reps || "");
  const m = /(\d+(?:[.,]\d+)?)(?:\s*[\u2013-]\s*\d+(?:[.,]\d+)?)?\s*(s|sec|secs|second|seconds|min|mins|minute|minutes)\b/i.exec(s);
  if (m) return { n: m[1], unit: /^m/i.test(m[2]) ? "min" : "sec" };
  const mm = /(?:^|[^\d:])(\d{1,2}):(\d{2})(?![\d:])/.exec(s); if (mm) return { n: String(parseInt(mm[1], 10) * 60 + parseInt(mm[2], 10)), unit: "sec" };   // "1:30" = 90 seconds
  const q = /(\d+)\s*(?:"|\u2033|'')/.exec(s); if (q) return { n: q[1], unit: "sec" };                                                  // 30" = 30 seconds
  if (/\b(hold|max\s*time|as long as possible|alap|for time)\b/i.test(s)) { const n = /\d+/.exec(s); return { n: n ? n[0] : "", unit: "sec" }; }   // "max hold": the box asks for the seconds
  return null;
};
// Before the Time box existed, a plank's seconds were typed into the weight box ("45 sec"). On a timed exercise a weight that reads as a
// time is the time: it moves to the time column (in the plan's unit) and the weight is bodyweight again. Idempotent: runs on every load and pull.
export const timeAsWeight = (v) => { const tm = timedPlan(v); return tm && tm.n !== "" ? tm : null; };
// The number the plan puts in the box before anything is typed: "10" → 10, "8–10" or "6, 6, 4" → the highest, "10 / side" → 10,
// "45 sec" → 45, "30-45 sec" → 45, "1:00" → 60; "max", "AMRAP" or a bare "hold" → nothing (the box asks). Whole numbers only.
export const planNumber = (reps) => {
  const s = String(reps || ""), tm = timedPlan(s);
  if (tm && /\d+:\d{2}/.test(s)) return tm.n;
  const nums = (s.replace(/\s*(\/|each|per)\s*(side|leg|arm)\b/gi, "").match(/\d+(?:[.,]\d+)?/g) || []).map((x) => parseFloat(x.replace(",", ".")));
  if (!nums.length) return "";
  const top = Math.max(...nums); return Number.isInteger(top) ? String(top) : "";
};
export const repairTimed = (t) => {
  let changed = false;
  for (const r of (t && t.rows) || []) {
    const tm = timedPlan(r.reps); if (!tm || !Array.isArray(r.weights)) continue;
    for (let i = 0; i < r.weights.length; i++) {
      const tw = timeAsWeight(r.weights[i]); if (!tw) continue;
      if (!Array.isArray(r.repsDone)) r.repsDone = []; while (r.repsDone.length <= i) r.repsDone.push("");
      if (!String(r.repsDone[i] == null ? "" : r.repsDone[i]).trim()) {
        const n = parseFloat(String(tw.n).replace(",", ".")), v = tw.unit === tm.unit ? n : tw.unit === "min" ? n * 60 : n / 60;   // "1 min" on a seconds plan = 60
        if (!Number.isFinite(v) || v !== Math.round(v)) continue;                                                              // 90 sec on a minutes plan: left alone
        r.repsDone[i] = String(v);
      }
      r.weights[i] = ""; changed = true;                                                                                       // the time is already logged: the weight was a copy of it
    }
  }
  return changed;
};
// A dumbbell or kettlebell exercise is logged per hand: the Weight label says so ("Weight / dumbbell"), the number stays a number.
export const perHand = (name) => { const n = String(name || ""); return /\b(dumb?bells?|dbs?)\b/i.test(n) ? "dumbbell" : /\b(kettlebells?|kbs?)\b/i.test(n) ? "kettlebell" : null; };
// Ranking logged sets. A hold: the longest, then the heaviest. Anything else: the heaviest, then the most reps; a set with
// reps and no weight (bodyweight) ranks below any weighted set. A set is { w, rp } with null for what was not logged.
const num = (v) => { const str = String(v == null ? "" : v).trim(); return /^\d+(?:[.,]\d+)?$/.test(str) ? parseFloat(str.replace(",", ".")) : null; };
export const betterSet = (a, b, timed) => !b || (timed ? (a.rp || 0) > (b.rp || 0) || ((a.rp || 0) === (b.rp || 0) && (a.w || 0) > (b.w || 0))
  : (a.w == null ? -1 : a.w) > (b.w == null ? -1 : b.w) || ((a.w == null ? -1 : a.w) === (b.w == null ? -1 : b.w) && (a.rp || 0) > (b.rp || 0)));
// How many sets of a row were completed (the Complete set button). Rows from before the count existed: finished = all of them.
export const doneCount = (row) => { const n = parseInt(row && row.setsDone, 10); return Number.isFinite(n) ? clamp(n, 0, 20) : (row && row.done ? 20 : 0); };
// A set is a lift once it was completed, or once its reps (or seconds) were logged. A weight typed into a set that never happened is not a lift:
// it used to become a phantom "best" (Aly's 58 lb curl, Oct 2026) and then carried itself into the next session.
export const setCounts = (row, i) => i < doneCount(row) || num(((row && row.repsDone) || [])[i]) != null;
export const topSet = (row, timed, upTo) => { let best = null; const ws = (row && row.weights) || [], rs = (row && row.repsDone) || []; for (let i = 0; i < Math.max(ws.length, rs.length); i++) { if (!setCounts(row, i) && !(upTo != null && i < upTo)) continue; const w = num(ws[i]), rp = num(rs[i]); if (timed ? rp == null : (w == null && rp == null)) continue; const st = { w, rp }; if (betterSet(st, best, timed)) best = st; } return best; };   // upTo: the card being logged may preview the set under the finger
export const sameSet = (a, b) => !!a && !!b && a.w === b.w && a.rp === b.rp;
// Correcting a logged number: the sets after it that still show the old number were copied from it ("untouched box = same as the set
// before"), so they follow the correction. A later set with a different number was typed on purpose and stays.
export const correctFrom = (arr, i, value) => { const out = [...(arr || [])]; while (out.length <= i) out.push(""); const old = String(out[i] == null ? "" : out[i]).trim(); out[i] = value; if (old) for (let j = i + 1; j < out.length; j++) if (String(out[j] == null ? "" : out[j]).trim() === old) out[j] = value; return out; };
// Packages. A client's plan: { id, name, kind: "sessions" | "monthly", size, startedOn, adjust, until }.
// A sessions package counts finished workouts marked "in person" since it started, plus the trainer's correction;
// package 2 starts by itself once package 1 is full. A monthly plan is just a day it is active until.
export const planProgress = (plan, list) => {
  if (!plan || plan.kind !== "sessions" || !(plan.size > 0)) return null;
  const used = Math.max(0, list.filter((t) => t.inPerson && t.completedAt && effDate(t) >= (plan.startedOn || "")).length + (parseInt(plan.adjust, 10) || 0));
  const size = plan.size, packNo = used === 0 ? 1 : Math.floor((used - 1) / size) + 1, inPack = used === 0 ? 0 : ((used - 1) % size) + 1;
  return { used, size, packNo, inPack, left: size - inPack, complete: used > 0 && used % size === 0 };
};
export const sessionNo = (plan, list, t) => {                      // "Session 3 of 10": finished in-person workouts rank by the day they were finished (the card's count); a planned one comes after them, in date order
  if (!plan || plan.kind !== "sessions" || !(plan.size > 0) || !t || !t.inPerson || t.skippedAt || t.missed === true || effDate(t) < (plan.startedOn || "")) return null;
  const by = (a, b) => effDate(a).localeCompare(effDate(b)) || (a.createdAt || "").localeCompare(b.createdAt || "");
  const since = list.filter((x) => x.inPerson && !x.skippedAt && x.missed !== true && effDate(x) >= (plan.startedOn || ""));
  const done = since.filter((x) => x.completedAt).sort(by), planned = since.filter((x) => !x.completedAt).sort(by);
  const p = t.completedAt ? done.findIndex((x) => x.id === t.id) + 1 : done.length + planned.findIndex((x) => x.id === t.id) + 1;
  const n = p + (parseInt(plan.adjust, 10) || 0); if (p < 1 || n < 1) return null;
  return { n: ((n - 1) % plan.size) + 1, size: plan.size, packNo: Math.floor((n - 1) / plan.size) + 1 };
};
export const planActive = (plan, day) => !plan || plan.kind !== "monthly" || !plan.until || plan.until >= day;   // a monthly plan past its day is over
export const setsOf = (r) => Math.max(1, clamp(parseInt(r.sets, 10) || 4, 0, 20));   // blank = the default 4; 0 still counts as one

export function groupKey(label, index) {
  const s = String(label || "").trim().toLowerCase();
  const m = s.match(/^(\d+)/);
  if (m) return m[1];
  return /^w\s*[a-z]?$/i.test(s) ? "w" : (s || "row-" + index);
}

export function validateBackup(d, knownClient) {
  const isObj = (x) => !!x && typeof x === "object" && !Array.isArray(x);
  if (!isObj(d) || d.app !== "fiala-trainings") throw new Error("not a backup");
  const cs = Object.values(isObj(d.clients) ? d.clients : {}), ts = Object.values(isObj(d.trainings) ? d.trainings : {});
  for (const c of cs) if (!isObj(c) || typeof c.id !== "string" || !c.id || typeof (c.name == null ? "" : c.name) !== "string") throw new Error("bad client");
  const ids = new Set(cs.map((c) => c.id));
  for (const t of ts) {
    if (!isObj(t) || typeof t.id !== "string" || !t.id || typeof t.clientId !== "string" || !Array.isArray(t.rows)) throw new Error("bad training");
    if (t.date != null && !/^\d{4}-\d{2}-\d{2}$/.test(String(t.date))) throw new Error("bad date");
    if (!ids.has(t.clientId) && !knownClient(t.clientId)) throw new Error("orphan training");
    for (const r of t.rows) if (!isObj(r) || typeof r.id !== "string") throw new Error("bad row");
  }
  return { cs, ts };
}
