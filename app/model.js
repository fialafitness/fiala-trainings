// The workout model: what a training, a row and the templates entry are, with no app state.
import { uid, clamp, localIso } from "./util.js";

export const TEMPLATES_ID = "00000000-0000-4000-8000-0000000000f1";
export const isTemplateClient = (id) => id === TEMPLATES_ID;
export const effDate = (t) => t.completedAt ? localIso(new Date(t.completedAt)) : (t.date || "");
export const freshRow = (r) => { const x = { ...r, id: uid(), weights: [], repsDone: [], setsDone: 0, done: false, alts: [...(r.alts || [])] }; delete x.earlyReason; delete x.clientNote; delete x.clientNoteBy; delete x.clientNoteAt; delete x.unit; return x; };   // the plan, with nothing logged: the unit comes with the first weight the new client logs
export const isEmptyWorkout = (t) => !!t && !t.completedAt && !t.skippedAt && !(t.rows || []).length && !String(t.title || "").trim() && !isTemplateClient(t.clientId);
// A plan written in time ("30 sec", "45 s", "1 min", "60 sec / side") is logged as time held, not reps: { n: "30", unit: "sec" }.
// A timed plan: the reps box says time, so the set log asks for time, not reps. Every spelling he uses: "30 sec", "30s", "30 seconds / side",
// "1 min", "30-45 sec", "1:00", 30", and the words "hold" / "max hold" / "as long as possible". The exercise name never decides (a plank jack is reps).
export const timedPlan = (reps) => {
  const s = String(reps || "");
  const lead = /^\s*\d+\s*[x\u00d7]\s*/i.exec(s), base = lead ? lead[0].length : 0, first = s.slice(base).search(/\d/);   // the plan's own number is the first one ("3 x 30 sec" aside): "10 reps, 2 sec hold at top" is reps
  const at = (i) => first < 0 || i === base + first;
  const m = /(\d+(?:[.,]\d+)?)(?:\s*[\u2013-]\s*\d+(?:[.,]\d+)?)?\s*(s|sec|secs|second|seconds|min|mins|minute|minutes)\b/i.exec(s);
  if (m && at(m.index)) return { n: m[1], unit: /^m/i.test(m[2]) ? "min" : "sec" };
  const mm = /(?:^|[^\d:])(\d{1,2}):(\d{2})(?![\d:])/.exec(s); if (mm && at(s.indexOf(mm[1] + ":" + mm[2], mm.index))) return { n: String(parseInt(mm[1], 10) * 60 + parseInt(mm[2], 10)), unit: "sec" };   // "1:30" = 90 seconds
  const q = /(\d+)\s*(?:"|\u2033|'')/.exec(s); if (q && at(q.index)) return { n: q[1], unit: "sec" };                                   // 30" = 30 seconds
  const kw = /\b(hold|max\s*time|as long as possible|alap|for time)\b/i.exec(s);
  if (kw && !/\brep/i.test(s)) { const n = /\d+/.exec(s); if (!n || n.index > kw.index) return { n: n ? n[0] : "", unit: "sec" }; }   // "max hold", "hold 30": the box asks for the seconds; "12 (hold 2s at bottom)" is reps
  return null;
};
// A distance plan ("40 m", "40m", "20-40 meters"): the box logs meters, like a hold logs seconds. measurePlan covers both.
export const distPlan = (reps) => { const m = /(\d+(?:[.,]\d+)?)(?:\s*[\u2013-]\s*\d+(?:[.,]\d+)?)?\s*(m|meter|meters|metre|metres)\b/i.exec(String(reps || "")); return m ? { n: m[1], unit: "m" } : null; };
export const measurePlan = (reps) => timedPlan(reps) || distPlan(reps);
// Before the Time box existed, a plank's seconds were typed into the weight box ("45 sec"). On a timed exercise a weight that reads as a
// time is the time: it moves to the time column (in the plan's unit) and the weight is bodyweight again. Idempotent: runs on every load and pull.
export const timeAsWeight = (v) => { const s = String(v || ""); if (!/\d\s*(sec|secs|second|seconds|min|mins|minute|minutes)\b|\d:\d{2}|\d\s*(?:"|\u2033|'')/i.test(s)) return null; const tm = timedPlan(s); return tm && tm.n !== "" ? tm : null; };   // only a spelled-out time: "25s" in a weight box is a pair of 25s, not 25 seconds
// The number the plan puts in the box before anything is typed: "10" → 10, "8–10" or "6, 6, 4" → the highest, "10 / side" → 10,
// "45 sec" → 45, "30-45 sec" → 45, "1:00" → 60; "max", "AMRAP" or a bare "hold" → nothing (the box asks). Whole numbers only.
export const planNumber = (reps) => {
  const s = String(reps || ""), tm = timedPlan(s);
  if (tm && /\d+:\d{2}/.test(s)) return tm.n;
  const nums = (s.replace(/\s*(\/|each|per)\s*(side|leg|arm)\b/gi, "").replace(/@\s*\d+(?:[.,]\d+)?\s*%?|\d+(?:[.,]\d+)?\s*%|\brpe\s*\d+(?:[.,]\d+)?/gi, "").match(/\d+(?:[.,]\d+)?/g) || []).map((x) => parseFloat(x.replace(",", ".")));   // "8-10 @ 70%", "RPE 8": the load note is not a rep count
  if (!nums.length) return "";
  const top = Math.max(...nums); return Number.isInteger(top) ? String(top) : "";
};
// A long name reads as a title with a subtitle under it (client view). The subtitle is the ending the coach chose for it — "" for none —
// else the part in brackets, after the first comma, or after a spaced dash: "TRX row (underhand, to chest)" → "TRX row" / "underhand, to chest".
export const autoSubtitle = (name) => { const s = String(name || "").trim(); const m = /^(.*?\S)\s*(?:\((.+)\)|,\s*(.+)|\s[\u2013-]\s+(.+))$/.exec(s); if (!m) return ""; const sub = (m[2] || m[3] || m[4] || "").trim(); return m[1].trim() && sub ? sub : ""; };
export const splitName = (name, chosen) => {
  const s = String(name || "").trim(), sub = chosen == null ? autoSubtitle(s) : String(chosen).trim();
  if (!sub) return { title: s, sub: "" };
  const i = s.toLowerCase().lastIndexOf(sub.toLowerCase());
  if (i <= 0 || i + sub.length < s.length - 1) return { title: s, sub: "" };                        // the subtitle must be the end of the name (a closing bracket may follow)
  const title = s.slice(0, i).replace(/[\s,(\u2013-]+$/, "").trim();
  return title ? { title, sub: s.slice(i, i + sub.length) } : { title: s, sub: "" };
};
// A logged weight carries the unit it was logged in (row.unit, "lb" or "kg"); rows from before that were logged in the unit the client had then,
// which stampUnit writes onto them the moment the client's unit is switched. A weight read in the other unit converts to the nearest half.
export const LB_PER_KG = 2.2046226218;
export const convertWeight = (v, from, to) => { if (!from || !to || from === to) return v; const n = num(v); if (n == null) return v; return Math.round((from === "kg" ? n * LB_PER_KG : n / LB_PER_KG) * 2) / 2; };
export const stampUnit = (t, unit) => { let changed = false; for (const r of (t && t.rows) || []) { if (r.unit || !(r.weights || []).some((w) => num(w) != null)) continue; r.unit = unit; changed = true; } return changed; };
export const toUnit = (st, from, to) => (st && from && to && from !== to && st.w != null ? { ...st, w: convertWeight(st.w, from, to) } : st);   // a top set read in another unit
export const toTimeUnit = (st, from, to) => (st && from && to && from !== to && st.rp != null && from !== "m" && to !== "m" ? { ...st, rp: from === "min" ? st.rp * 60 : Math.round(st.rp / 60 * 100) / 100 } : st);   // a hold logged in minutes against one in seconds
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
export const followFrom = (arr, i, was) => { const old = String(was == null ? "" : was).trim(); const out = []; if (old) for (let j = i + 1; j < (arr || []).length; j++) if (String(arr[j] == null ? "" : arr[j]).trim() === old) out.push(j); return out; };   // which later sets were copied from this one: decided when editing begins, so every keystroke of the correction reaches them
export const correctFrom = (arr, i, value, was, follow) => { const out = [...(arr || [])]; while (out.length <= i) out.push(""); const js = follow || followFrom(out, i, was == null ? out[i] : was); out[i] = value; for (const j of js) if (j < out.length) out[j] = value; return out; };
// Packages. A client's plan: { id, name, kind: "sessions" | "monthly", size, startedOn, adjust, until }.
// A sessions package counts finished workouts marked "in person" since it started, plus the trainer's correction;
// package 2 starts by itself once package 1 is full. A monthly plan is just a day it is active until.
export const planProgress = (plan, list) => {
  if (!plan || plan.kind !== "sessions" || !(plan.size > 0)) return null;
  const used = Math.max(0, list.filter((t) => t.inPerson && t.completedAt && !t.skippedAt && t.missed !== true && effDate(t) >= (plan.startedOn || "")).length + (parseInt(plan.adjust, 10) || 0));   // the same workouts the session pill counts
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

export function validateBackup(d, knownClient) {                  // the whole file first: a backup is taken whole or refused whole, and only in the shape every screen reads
  const isObj = (x) => !!x && typeof x === "object" && !Array.isArray(x);
  const optStr = (v) => v == null || typeof v === "string";
  const optNum = (v) => v == null || (typeof v === "number" && isFinite(v)) || (typeof v === "string" && v.trim() !== "" && isFinite(Number(v)));   // a count may travel as "3"
  const optBool = (v) => v == null || typeof v === "boolean";
  const optWhen = (v) => v == null || (typeof v === "string" && !isNaN(new Date(v)));   // a moment the screens turn into a day
  const optUnit = (v) => v == null || v === "lb" || v === "kg";                           // anything else would be rescaled as if it were one of these
  const isUuid = (v) => typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);   // the server's id columns take nothing else, and would refuse the record for good
  const optList = (v, max) => v == null || (Array.isArray(v) && v.length <= max);   // a list where a list is read with .map / .find: an object here throws on the screen
  const LIMIT = { rows: 300, sets: 60, alts: 60, history: 200, packages: 200 };
  if (!isObj(d) || d.app !== "fiala-trainings") throw new Error("not a backup");
  if (d.format != null) { const f = Number(d.format); if (!(f >= 1)) throw new Error("not a backup"); if (f > 1) throw new Error("newer backup"); }   // written by a later app: it may use words this one does not know
  const cs = Object.values(isObj(d.clients) ? d.clients : {}), ts = Object.values(isObj(d.trainings) ? d.trainings : {});
  const ids = new Set();
  for (const c of cs) {
    if (!isObj(c) || !isUuid(c.id) || ids.has(c.id)) throw new Error("bad client");
    if (!optList(c.seenNotes, 5000) || (c.seenNotes || []).some((x) => typeof x !== "string") || !optWhen(c.seenDoneAt)) throw new Error("bad client");
    if (!optStr(c.name) || !optStr(c.email) || !optStr(c.kind) || !optBool(c.paused) || !optNum(c.sort) || !optUnit(c.unit)) throw new Error("bad client");
    if (c.notes != null && typeof c.notes !== "string" && !(isObj(c.notes) && optList(c.notes.log, 5000))) throw new Error("bad client");
    if (c.plan != null && !(isObj(c.plan) && optStr(c.plan.id) && optStr(c.plan.name) && optStr(c.plan.kind) && optNum(c.plan.size) && optNum(c.plan.adjust) && optStr(c.plan.startedOn) && optStr(c.plan.until))) throw new Error("bad client");
    if (!optList(c.planHistory, LIMIT.history) || (c.planHistory || []).some((h) => !isObj(h))) throw new Error("bad client");
    if (!optList(c.packages, LIMIT.packages) || (c.packages || []).some((pk) => !isObj(pk) || typeof pk.id !== "string" || !pk.id || typeof pk.name !== "string" || !pk.name.trim() || !optStr(pk.kind) || !optNum(pk.size) || !optBool(pk.inPerson) || (pk.kind !== "monthly" && !(Number(pk.size) >= 1)))) throw new Error("bad client");   // a package is shown by its name and counted by its size
    ids.add(c.id);
  }
  const tids = new Set();
  for (const t of ts) {
    if (!isObj(t) || !isUuid(t.id) || tids.has(t.id) || !isUuid(t.clientId) || !Array.isArray(t.rows) || t.rows.length > LIMIT.rows) throw new Error("bad training");
    if (t.template != null && !(isObj(t.template) && optStr(t.template.program) && optStr(t.template.phaseName) && optNum(t.template.phase) && optNum(t.template.stage) && optNum(t.template.n))) throw new Error("bad training");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(t.date || ""))) throw new Error("bad date");   // every workout has a day (the app's own backups always carry one)
    if (!optStr(t.title) || !optStr(t.createdAt) || !optWhen(t.completedAt) || !optStr(t.completedBy) || !optWhen(t.skippedAt) || !optStr(t.skipReason) || !optBool(t.missed) || !optBool(t.inPerson)) throw new Error("bad training");
    if (!ids.has(t.clientId) && !knownClient(t.clientId)) throw new Error("orphan training");
    const rids = new Set();
    for (const r of t.rows) {
      if (!isObj(r) || typeof r.id !== "string" || !r.id || rids.has(r.id)) throw new Error("bad row");
      if (!optStr(r.name) || !optStr(r.label) || !optStr(r.reps) || !optStr(r.rest) || !optStr(r.tempo) || !optStr(r.note) || !optStr(r.clientNote) || !optStr(r.earlyReason) || !optUnit(r.unit)) throw new Error("bad row");
      if (!optNum(r.sets) || !optNum(r.setsDone) || !optBool(r.done) || !optStr(r.clientNoteBy) || !optWhen(r.clientNoteAt)) throw new Error("bad row");
      if (!optList(r.weights, LIMIT.sets) || !optList(r.repsDone, LIMIT.sets) || !optList(r.alts, LIMIT.alts)) throw new Error("bad row");   // read with .map and .find on every screen
      if ((r.alts || []).some((a) => typeof a !== "string") || [...(r.weights || []), ...(r.repsDone || [])].some((w) => w != null && typeof w !== "string" && typeof w !== "number")) throw new Error("bad row");
      rids.add(r.id);
    }
    tids.add(t.id);
  }
  return { cs, ts };
}
