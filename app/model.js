// The workout model: what a training, a row and the templates entry are, with no app state.
import { uid, clamp, localIso, daysLater } from "./util.js";

export const TEMPLATES_ID = "00000000-0000-4000-8000-0000000000f1";
export const isTemplateClient = (id) => id === TEMPLATES_ID;
export const effDate = (t) => t.completedAt ? localIso(new Date(t.completedAt)) : (t.date || "");
export const freshRow = (r) => { const x = { ...r, id: uid(), weights: [], repsDone: [], setsDone: 0, done: false, alts: [...(r.alts || [])] }; delete x.earlyReason; delete x.clientNote; delete x.clientNoteBy; delete x.clientNoteAt; delete x.unit; delete x.logSeq; return x; };   // the plan, with nothing logged: the unit comes with the first weight the new client logs
export const isEmptyWorkout = (t) => !!t && !t.completedAt && !t.skippedAt && !(t.rows || []).length && !String(t.title || "").trim() && !isTemplateClient(t.clientId);
// A plan written in time ("30 sec", "45 s", "1 min", "60 sec / side") is logged as time held, not reps: { n: "30", unit: "sec" }.
// A timed plan: the reps box says time, so the set log asks for time, not reps. Every spelling he uses: "30 sec", "30s", "30 seconds / side",
// "1 min", "30-45 sec", "1:00", 30", and the words "hold" / "max hold" / "as long as possible". The exercise name never decides (a plank jack is reps).
export const timedPlan = (reps) => {
  const s = String(reps || "");
  const lead = /^\s*\d+\s*[x\u00d7]\s*/i.exec(s), base = lead ? lead[0].length : 0, first = s.slice(base).search(/\d/);   // the plan's own number is the first one ("3 x 30 sec" aside): "10 reps, 2 sec hold at top" is reps
  const at = (i) => first < 0 || i === base + first;
  const ms = /(\d+)\s*min(?:s|utes?)?\s*(\d+)\s*s(?:ec|ecs|econds?)?\b/i.exec(s); if (ms && at(ms.index)) return { n: String(parseInt(ms[1], 10) * 60 + parseInt(ms[2], 10)), unit: "sec" };   // "1 min 30 sec" = 90 seconds, like "1:30"
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
// The exercise page edits the two lines clients see; the stored name is both together. A name already written with a
// comma or a dash keeps that form when only its words change; otherwise the subtitle goes in brackets.
export const composeName = (title, sub, like) => {
  const t = String(title || "").trim(), s = String(sub || "").trim(); if (!s) return t;
  const was = String(like || "").trim().toLowerCase(), tail = s.toLowerCase();
  const sep = was.endsWith(", " + tail) ? ", " : was.endsWith(" \u2013 " + tail) ? " \u2013 " : was.endsWith(" - " + tail) ? " - " : null;
  return sep ? t + sep + s : t + " (" + s + ")";
};
export const splitName = (name, chosen) => {
  const s = String(name || "").trim(), sub = chosen == null ? autoSubtitle(s) : String(chosen).trim();
  if (!sub) return { title: s, sub: "" };
  const i = s.toLowerCase().lastIndexOf(sub.toLowerCase());
  if (i <= 0 || i + sub.length < s.length - 1) return { title: s, sub: "" };                        // the subtitle must be the end of the name (a closing bracket may follow)
  const title = s.slice(0, i).replace(/[\s,(\u2013-]+$/, "").trim();
  return title ? { title, sub: s.slice(i, i + sub.length) } : { title: s, sub: "" };
};
// A logged weight carries the unit it was logged in (row.unit, "lb" or "kg"); rows from before that were logged in the unit the client had then,
// which stampUnit writes onto them the moment the client's unit is switched (plain numbers, as the server's rule does: client-profile.sql).
// v301 (the owner's ask, 15 Nov 2026: "when client or me switch the weight unit every workout past and future converts to that unit ... they come back
// and they can see what they lifted in unit they know"; their picks: one switch for the client and the coach, one decimal): a weight is never rewritten.
// It keeps the unit it was logged in, and every screen shows it in the client's unit at one decimal: 135 lb reads 61.2 kg, and 135 lb again, however often the switch goes.
export const LB_PER_KG = 2.2046226218;
export const KG_PER_LB = 0.45359237;                                   // exact, by definition
const inKg = (n, u) => (u === "lb" ? n * KG_PER_LB : n), fromKg = (kg, u) => (u === "lb" ? kg / KG_PER_LB : kg);
const oneDecimal = (n) => String(Math.round(n * 10 + 1e-7) / 10);     // "61.2"; a whole number has no ".0" (the owner's pick: one decimal); the hair up keeps a half typed in one unit a half after the trip through the other (11.25 kg reads 11.3)
export const weightNumber = (v) => { const s = String(v == null ? "" : v).trim(); return /^\d{1,3}(?:,\d{3})+$/.test(s) ? parseFloat(s.replace(/,/g, "")) : num(s.replace(/^(\d+)[.,]$/, "$1")); };   // a logged weight as a number: "1,000" is a thousand, never 1.0; "60." is 60 (a point left at the end)
const NOT_WEIGHT = /(?:\b(?:bands?|levels?|lvl|setting|pin|hole|notch|no\.?)\s*|#\s*)\d+$|\d:\d\d$/i;   // numbered things that are not weights: "Band 3", "Level 8", "#3", a time "1:30"
const saysUnit = (s) => /\d$/.test(s) && !/(lb|kg)s?\b/i.test(s) && !NOT_WEIGHT.test(s);   // words ending in a weight with no unit written: "2x20", "BW+10", "+20"
export const sameWeightText = (a, b) => { const x = weightNumber(a), y = weightNumber(b); return x != null && y != null ? x === y : String(a == null ? "" : a).trim() === String(b == null ? "" : b).trim(); };   // the number shown typed back, a comma keypad's "61,2" for "61.2" too
export const weightIn = (v, from, to) => {                             // a logged weight as the screens show it in the unit `to`: 135 lb in kg reads 61.2
  const s = String(v == null ? "" : v).trim(), n = weightNumber(s); if (!s) return "";
  if (n == null) return from && to && from !== to && saysUnit(s) ? s + " " + from : s;   // words stay as written; in the other unit one that ends in a weight says the unit it was logged in ("2x20 lb"; never "Band 3 lb")
  if (!from || !to || from === to) return /[.,]\d\d+$/.test(s) && !/^\d{1,3}(?:,\d{3})+$/.test(s) ? oneDecimal(n).replace(".", s.includes(",") ? "," : ".") : s;   // its own unit: as typed ("1,000", "60."), a kept conversion ("61.23") at one decimal
  return oneDecimal(fromKg(inKg(n, from), to));
};
export const weightStored = (v, from, to) => {                         // a number typed in `from` kept in the exercise's own unit `to`: the shortest number that reads back as typed in `from` and as the same weight in `to` (60 kg into a pound exercise: "132.3"; 135 lb into a kilo one: "61.23")
  const s = String(v == null ? "" : v).trim(), n = weightNumber(s); if (!from || !to || from === to) return v;   // the exercise's own unit: as typed
  const words = () => (saysUnit(s) && (s + " " + from).length <= 16 ? s + " " + from : v);   // words, kept with the unit they were typed in ("2x10 kg" in a pound exercise reads so in both units); within the server's 16 characters
  if (n == null) return words();
  const exact = fromKg(inKg(n, from), to), back = oneDecimal(n), shown = oneDecimal(exact);
  for (let d = 0; d <= 8; d++) { const c = Math.round(exact * 10 ** d) / 10 ** d; if (oneDecimal(fromKg(inKg(c, to), from)) === back && oneDecimal(c) === shown) return String(c).length <= 16 ? String(c) : words(); }   // two decimals nearly always; more only a hair from a rounding edge (33.4 lb is 15.14998 kg, which reads 15.1)
  return words();
};
export const stampUnit = (t, unit) => { let changed = false; for (const r of (t && t.rows) || []) { if (r.unit || !(r.weights || []).some((w) => num(w) != null)) continue; r.unit = unit; changed = true; } return changed; };
// Health details (v299; the owner's asks, 15 Nov 2026: Apple's Health details in both views, "options for lbs and cm", and "switch to cm and feet as they are adding the height and lbs and kg as they are adding body weight ... units for workouts are separate").
// Height and body weight are kept as entered on their wheels, { v, u }: whole inches or centimetres, whole pounds or kilograms (Apple's own wheels, measured on iOS 27.2: 1-inch, 1-cm, 1-lb and 1-kg steps).
// Each is shown in the unit picked on its own switch (heightUnit, bodyUnit), so flipping a switch back and forth never drifts a value: 142 lb shows as 64 kg, and as 142 lb again.
export const CM_PER_IN = 2.54;
const okMeasure = (m, a, b) => !!m && typeof m === "object" && (m.u === a || m.u === b) && typeof m.v === "number" && isFinite(m.v) && m.v > 0;
export const heightAs = (h, u) => (!okMeasure(h, "in", "cm") ? null : !u || h.u === u ? Math.round(h.v) : u === "cm" ? Math.round(h.v * CM_PER_IN) : Math.round(h.v / CM_PER_IN));
export const weightAs = (w, u) => (!okMeasure(w, "lb", "kg") ? null : !u || w.u === u ? Math.round(w.v) : u === "kg" ? Math.round(w.v / LB_PER_KG) : Math.round(w.v * LB_PER_KG));
export const heightUnitOf = (c) => (c && (c.heightUnit === "in" || c.heightUnit === "cm") ? c.heightUnit : c && okMeasure(c.height, "in", "cm") ? c.height.u : c && c.unit === "kg" ? "cm" : "in");   // nothing chosen yet: the unit the client lifts in says which side of the Atlantic
export const bodyUnitOf = (c) => (c && (c.bodyUnit === "lb" || c.bodyUnit === "kg") ? c.bodyUnit : c && okMeasure(c.bodyWeight, "lb", "kg") ? c.bodyWeight.u : c && c.unit === "kg" ? "kg" : "lb");
export const fmtHeight = (v, u) => (v == null ? "" : u === "cm" ? v + " cm" : Math.floor(v / 12) + "\u2032 " + (v % 12) + "\u2033");   // 5' 7" with Apple's prime marks, as Fitness writes it
export const fmtBodyWeight = (v, u) => (v == null ? "" : v + (u === "kg" ? " kg" : " lb"));
export const ageOn = (birthday, day) => { const b = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birthday || ""), d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day || ""); if (!b || !d) return null; let a = +d[1] - +b[1]; if (+d[2] < +b[2] || (+d[2] === +b[2] && +d[3] < +b[3])) a--; return a >= 0 && a < 150 ? a : null; };
// A client's own profile field by the key client_set_profile takes ("sex", "height", "unit", "health.limits", …): read as it is sent (an empty text or nothing is null, a clear), and written back the same way.
export const profileGet = (c, k) => { const v = !c ? undefined : String(k).startsWith("health.") ? (c.health && typeof c.health === "object" ? c.health[k.slice(7)] : undefined) : c[k]; return v === undefined || v === null || v === "" ? null : v; };
export const profilePut = (c, k, v) => { const none = v === undefined || v === null || v === ""; if (String(k).startsWith("health.")) { const f = k.slice(7); if (!c.health || typeof c.health !== "object" || Array.isArray(c.health)) { if (none) return; c.health = {}; } if (none) delete c.health[f]; else c.health[f] = v; } else if (none) delete c[k]; else c[k] = v; };
export const toTimeUnit = (st, from, to) => (st && from && to && from !== to && st.rp != null && from !== "m" && to !== "m" ? { ...st, rp: from === "min" ? Math.round(st.rp * 60 * 100) / 100 : Math.round(st.rp / 60 * 100) / 100 } : st);   // a hold logged in minutes against one in seconds
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
// reps and no weight (bodyweight) ranks below any weighted set. A set is { w, rp } with null for what was not logged, and u, the unit its weight was logged in
// (v301): sets compare in kilograms, and within 0.06 kg is the same weight, as a weight shown at one decimal in the other unit is never more than 0.05 kg off
// (135 lb is 61.235 kg: the 61.2 typed in Europe is the same weight, so more reps at it is a best, and 61.2 for as many is not).
const num = (v) => { const str = String(v == null ? "" : v).trim(); return /^\d+(?:[.,]\d+)?$/.test(str) ? parseFloat(str.replace(",", ".")) : null; };
export const numOf = num;   // v311: a set's reps or time as the card reads them ("1,5" from a comma keypad is 1.5)
const TIE_KG = 0.06;
const kgOr = (st, none) => (st.w == null ? none : st.u === "lb" ? st.w * KG_PER_LB : st.w);   // no unit (one exercise's own sets): the numbers as they stand
const cmpW = (a, b, none) => { const d = kgOr(a, none) - kgOr(b, none); return d > TIE_KG + 1e-9 ? 1 : d < -TIE_KG - 1e-9 ? -1 : 0; };   // exactly 0.06 is the same weight (a float's hair over is not heavier)
export const kgOf = (st) => kgOr(st, -1);   // a set's weight in kilograms: of two sets the same within 0.06 kg, the heavier keeps the title (Best never reads lower than a session that tied it)
export const betterSet = (a, b, timed) => !b || (timed ? (a.rp || 0) > (b.rp || 0) || ((a.rp || 0) === (b.rp || 0) && cmpW(a, b, 0) > 0)
  : cmpW(a, b, -1) > 0 || (cmpW(a, b, -1) === 0 && (a.rp || 0) > (b.rp || 0)));
// How many sets of a row were completed (the Complete set button). Rows from before the count existed: finished = all of them.
export const doneCount = (row) => { const n = parseInt(row && row.setsDone, 10); return Number.isFinite(n) ? clamp(n, 0, 20) : (row && row.done ? 20 : 0); };
// A set is a lift once it was completed, or once its reps (or seconds) were logged. A weight typed into a set that never happened is not a lift:
// it used to become a phantom "best" (a client's 58 lb curl, Oct 2026) and then carried itself into the next session.
export const setCounts = (row, i) => i < doneCount(row) || num(((row && row.repsDone) || [])[i]) != null;
export const topSet = (row, timed, upTo) => { let best = null; const ws = (row && row.weights) || [], rs = (row && row.repsDone) || []; for (let i = 0; i < Math.max(ws.length, rs.length); i++) { if (!setCounts(row, i) && !(upTo != null && i < upTo)) continue; const w = weightNumber(ws[i]), rp = num(rs[i]); if (timed ? rp == null : (w == null && rp == null)) continue; const st = { w, rp }; if (betterSet(st, best, timed)) best = st; } return best; };   // upTo: the card being logged may preview the set under the finger
export const sameSet = (a, b) => !!a && !!b && cmpW(a, b, -1) === 0 && a.rp === b.rp;
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
export const carryOver = (plan, list) => { const p = planProgress(plan, list); return p ? p.used - (p.complete ? 0 : p.inPack) : 0; };   // (15 Nov 2026, the audit's #10) the sessions of the packages already finished: a switch to another size goes on from the open one
export const sessionNo = (plan, list, t) => {                      // "Session 3 of 10": finished in-person workouts rank by the day they were finished (the card's count); a planned one comes after them, in date order
  if (!plan || plan.kind !== "sessions" || !(plan.size > 0) || !t || !t.inPerson || t.skippedAt || t.missed === true || effDate(t) < (plan.startedOn || "")) return null;
  const by = (a, b) => effDate(a).localeCompare(effDate(b)) || (a.createdAt || "").localeCompare(b.createdAt || "");
  const since = list.filter((x) => x.inPerson && !x.skippedAt && x.missed !== true && effDate(x) >= (plan.startedOn || ""));
  const todayIso = localIso(new Date()), done = since.filter((x) => x.completedAt).sort(by), planned = since.filter((x) => !x.completedAt && (x.id === t.id || effDate(x) >= todayIso)).sort(by);   // a planned workout left behind unfiled does not take a number from the ones ahead
  const p = t.completedAt ? done.findIndex((x) => x.id === t.id) + 1 : done.length + planned.findIndex((x) => x.id === t.id) + 1;
  const n = p + (parseInt(plan.adjust, 10) || 0); if (p < 1 || n < 1) return null;
  return { n: ((n - 1) % plan.size) + 1, size: plan.size, packNo: Math.floor((n - 1) / plan.size) + 1 };
};
export const planActive = (plan, day) => !plan || plan.kind !== "monthly" || !plan.until || plan.until >= day;   // a monthly plan past its day is over
export const setsOf = (r) => Math.max(1, clamp(parseInt(r.sets, 10) || 4, 0, 20));   // blank = the default 4; 0 still counts as one

// "W", "Wa", "Wb" … = warm-up: groups like a number and sorts before 1; then the numbers with their letters; anything else last, by its text
export const labelKey = (l) => { const s = String(l || "").trim(); const m = s.match(/^(\d+)\s*([a-z]*)/i); if (m) return [parseInt(m[1], 10), m[2].toLowerCase()]; const w = s.match(/^w\s*([a-z]?)$/i); return w ? [-1, w[1].toLowerCase()] : [Infinity, s.toLowerCase()]; };
export const cmpLabel = (a, b) => { const [an, as] = labelKey(a), [bn, bs] = labelKey(b); return an - bn || (as < bs ? -1 : as > bs ? 1 : 0); };
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
  const optMeasure = (m, a, b) => m == null || (isObj(m) && (m.u === a || m.u === b) && typeof m.v === "number" && isFinite(m.v));   // v299's height and body weight, { v, u }, read with numbers on the Health details page
  const isUuid = (v) => typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);   // the server's id columns take nothing else, and would refuse the record for good
  const optList = (v, max) => v == null || (Array.isArray(v) && v.length <= max);   // a list where a list is read with .map / .find: an object here throws on the screen
  const LIMIT = { rows: 300, sets: 60, alts: 60, history: 200, packages: 200, folders: 1000 };
  if (!isObj(d) || d.app !== "fiala-trainings") throw new Error("not a backup");
  if (d.format != null) { const f = Number(d.format); if (!(f >= 1)) throw new Error("not a backup"); if (f > 1) throw new Error("newer backup"); }   // written by a later app: it may use words this one does not know
  const cs = Object.values(isObj(d.clients) ? d.clients : {}), ts = Object.values(isObj(d.trainings) ? d.trainings : {});
  const ids = new Set();
  for (const c of cs) {
    if (!isObj(c) || !isUuid(c.id) || ids.has(c.id)) throw new Error("bad client");
    if (!optList(c.seenNotes, 5000) || (c.seenNotes || []).some((x) => typeof x !== "string") || !optWhen(c.seenDoneAt)) throw new Error("bad client");
    if (!optStr(c.name) || !optStr(c.email) || !optStr(c.kind) || !optBool(c.paused) || !optNum(c.sort) || !optUnit(c.unit)) throw new Error("bad client");
    if (c.notes != null && typeof c.notes !== "string" && !(isObj(c.notes) && optList(c.notes.log, 5000))) throw new Error("bad client");
    if (!optStr(c.birthday) || !(c.sex == null || ["female", "male", "other", ""].includes(c.sex)) || !optMeasure(c.height, "in", "cm") || !optMeasure(c.bodyWeight, "lb", "kg") || !(c.heightUnit == null || c.heightUnit === "in" || c.heightUnit === "cm") || !(c.bodyUnit == null || c.bodyUnit === "lb" || c.bodyUnit === "kg")) throw new Error("bad client");
    if (c.health != null && !(isObj(c.health) && optStr(c.health.limits) && optStr(c.health.conditions) && optStr(c.health.medications) && optStr(c.health.allergies) && optBool(c.health.pregnant) && optStr(c.health.emergency) && optStr(c.health.doctor))) throw new Error("bad client");   // Health & safety (v299): what its page reads as text
    if (c.plan != null && !(isObj(c.plan) && optStr(c.plan.id) && optStr(c.plan.name) && optStr(c.plan.kind) && optNum(c.plan.size) && optNum(c.plan.adjust) && optStr(c.plan.startedOn) && optStr(c.plan.until))) throw new Error("bad client");
    if (!optList(c.planHistory, LIMIT.history) || (c.planHistory || []).some((h) => !isObj(h))) throw new Error("bad client");
    if (!optList(c.packages, LIMIT.packages) || (c.packages || []).some((pk) => !isObj(pk) || typeof pk.id !== "string" || !pk.id || typeof pk.name !== "string" || !pk.name.trim() || !optStr(pk.kind) || !optNum(pk.size) || !optBool(pk.inPerson) || (pk.kind !== "monthly" && !(Number(pk.size) >= 1)))) throw new Error("bad client");   // a package is shown by its name and counted by its size
    if (!optList(c.folders, LIMIT.folders) || (c.folders || []).some((x) => !isObj(x))) throw new Error("bad client");   // the coach's template folders (12 Nov): a list the Templates pages read with .filter
    if (!optList(c.rootOrder, LIMIT.folders + 100) || (c.rootOrder || []).some((k) => typeof k !== "string")) throw new Error("bad client");   // the Programs list's order (Reorder, 12 Nov): keys read with .map
    ids.add(c.id);
  }
  const tids = new Set();
  for (const t of ts) {
    if (!isObj(t) || !isUuid(t.id) || tids.has(t.id) || !isUuid(t.clientId) || !Array.isArray(t.rows) || t.rows.length > LIMIT.rows) throw new Error("bad training");
    if (t.template != null && !(isObj(t.template) && optStr(t.template.program) && optStr(t.template.phaseName) && optNum(t.template.phase) && optNum(t.template.stage) && optNum(t.template.n) && optStr(t.template.folder))) throw new Error("bad training");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(t.date || ""))) throw new Error("bad date");   // every workout has a day (the app's own backups always carry one)
    if (!optStr(t.title) || !optStr(t.createdAt) || !optWhen(t.completedAt) || !optStr(t.completedBy) || !optWhen(t.skippedAt) || !optStr(t.skipReason) || !optBool(t.missed) || !optBool(t.inPerson)) throw new Error("bad training");
    if (!ids.has(t.clientId) && !knownClient(t.clientId)) throw new Error("orphan training");
    const rids = new Set();
    for (const r of t.rows) {
      if (!isObj(r) || typeof r.id !== "string" || !r.id || rids.has(r.id)) throw new Error("bad row");
      if (!optStr(r.name) || !optStr(r.label) || !optStr(r.reps) || !optStr(r.rest) || !optStr(r.tempo) || !optStr(r.note) || !optStr(r.clientNote) || !optStr(r.earlyReason) || !optUnit(r.unit)) throw new Error("bad row");
      if (!optNum(r.sets) || !optNum(r.setsDone) || !optBool(r.ramp) || !optBool(r.pyramid) || !(r.logSeq === undefined || (Number.isInteger(r.logSeq) && r.logSeq >= 0 && r.logSeq < 2147483647)) || !optBool(r.done) || !optStr(r.clientNoteBy) || !optWhen(r.clientNoteAt)) throw new Error("bad row");
      if (!optList(r.weights, LIMIT.sets) || !optList(r.repsDone, LIMIT.sets) || !optList(r.alts, LIMIT.alts)) throw new Error("bad row");   // read with .map and .find on every screen
      if ((r.alts || []).some((a) => typeof a !== "string") || [...(r.weights || []), ...(r.repsDone || [])].some((w) => w != null && typeof w !== "string" && typeof w !== "number")) throw new Error("bad row");
      rids.add(r.id);
    }
    tids.add(t.id);
  }
  return { cs, ts };
}

// ---------- the Progress tab's counts (v310; the owner's picks after the pictures, 16 Nov 2026) ----------
// A workout counts on its effDate: a finished one on the day it was finished, any other on its planned day. Days are local YYYY-MM-DD.
export const mondayOf = (iso) => { const [y, m, d] = String(iso).split("-").map(Number); const dt = new Date(y, m - 1, d, 12); return localIso(new Date(y, m - 1, d - ((dt.getDay() + 6) % 7), 12)); };   // weeks run Monday to Sunday, as History and the calendar
export const finishedByDay = (list) => { const m = new Map(); for (const t of list) if (t.completedAt) { const e = effDate(t); m.set(e, (m.get(e) || 0) + 1); } return m; };
// This week: each day's state for its disc, and finished "of" all the week's workouts (skipped and missed among them: his pick, clients see their attendance too).
// A day still to do whose day has gone is missed, as the calendar's red chip; one filed as missed is missed; today's to do is planned.
export function weekDays(list, todayIso) {
  const mon = mondayOf(todayIso), days = [];
  for (let k = 0; k < 7; k++) days.push({ iso: daysLater(mon, k), ws: [] });
  for (const t of list) { if (isEmptyWorkout(t)) continue; const d = days.find((x) => x.iso === effDate(t)); if (d) d.ws.push(t); }
  let done = 0, of = 0;
  for (const d of days) {
    const fin = d.ws.filter((t) => t.completedAt).length, todo = d.ws.filter((t) => !t.completedAt && !t.skippedAt).length, filed = d.ws.filter((t) => !t.completedAt && t.skippedAt && t.missed === true).length;
    done += fin; of += d.ws.length;
    d.state = !d.ws.length ? "rest" : (todo && d.iso < todayIso) || filed ? "miss" : todo ? "plan" : fin ? "done" : "skip";
  }
  return { mon, sun: days[6].iso, days: days.map((d) => ({ iso: d.iso, state: d.state })), done, of };
}
// Finished workouts a week, over the last n whole weeks before this one, counted from the week of the client's first workout (his pick, 16 Nov: "an average of previous weeks", in place of weeks in a row).
export function weekAverage(list, todayIso, n = 4) {
  let first = ""; for (const t of list) { if (isEmptyWorkout(t)) continue; const e = effDate(t); if (e && (!first || e < first)) first = e; }
  if (!first) return null;
  const mon = mondayOf(todayIso), start = mondayOf(first), byDay = finishedByDay(list), weeks = [];
  for (let k = n; k >= 1; k--) { const a = daysLater(mon, -7 * k); if (a < start) continue; let c = 0; for (let j = 0; j < 7; j++) c += byDay.get(daysLater(a, j)) || 0; weeks.push({ mon: a, n: c }); }
  return weeks.length ? { avg: weeks.reduce((s, w) => s + w.n, 0) / weeks.length, weeks } : null;
}
// The Workouts page's ranges, as Apple Health draws them: W this week's days, M this month's days, 6M the 26 weeks to this one, Y the 12 months to this one.
// M is the calendar month, as W is the calendar week, so the This month card and the page it opens show the same number (the v310 review; Health's own M runs to today).
export function rangeCounts(list, range, todayIso) {
  const byDay = finishedByDay(list), out = [], sum = (a, b) => { let c = 0; for (const [d, k] of byDay) if (d >= a && d <= b) c += k; return c; };
  if (range === "W") { const mon = mondayOf(todayIso); for (let k = 0; k < 7; k++) { const d = daysLater(mon, k); out.push({ from: d, to: d, n: byDay.get(d) || 0 }); } }
  else if (range === "M") { const [y, m] = String(todayIso).split("-").map(Number), len = new Date(y, m, 0).getDate(); for (let k = 1; k <= len; k++) { const d = localIso(new Date(y, m - 1, k, 12)); out.push({ from: d, to: d, n: byDay.get(d) || 0 }); } }
  else if (range === "6M") { const mon = mondayOf(todayIso); for (let k = 25; k >= 0; k--) { const a = daysLater(mon, -7 * k), b = daysLater(a, 6); out.push({ from: a, to: b, n: sum(a, b) }); } }
  else { const [y, m] = String(todayIso).split("-").map(Number); for (let k = 11; k >= 0; k--) { const a = localIso(new Date(y, m - 1 - k, 1, 12)), [ay, am] = a.split("-").map(Number), b = localIso(new Date(ay, am, 0, 12)); out.push({ from: a, to: b, n: sum(a, b) }); } }
  return out;
}
// ---------- the rest of the Progress tab (v311; the owner's "So the rest", 16 Nov 2026, from the pictures he had seen) ----------
// A workout's state as the monthly PDF names it (report.js's status): finished; skipped (a person decided); missed (filed, or its day gone undone); or still planned.
export const workoutStatus = (t, todayIso) => (t.completedAt ? "finished" : t.skippedAt ? (t.missed === true ? "missed" : "skipped") : effDate(t) < todayIso ? "missed" : "planned");
// Attendance over the 4 whole weeks before this one (the average's weeks): finished of all but the still planned, as the PDF's; the skips' reasons; the finished ones in person or on their own (not marked In person).
export function attendance(list, todayIso, n = 4) {
  const mon = mondayOf(todayIso), out = { from: daysLater(mon, -7 * n), to: daysLater(mon, -1), finished: 0, skipped: 0, missed: 0, reasons: {}, missedDays: [], inPerson: 0, onOwn: 0, pct: null };
  for (const t of list) {
    const e = effDate(t); if (isEmptyWorkout(t) || !e || e < out.from || e > out.to) continue;
    const st = workoutStatus(t, todayIso); if (st === "planned") continue;
    out[st]++;
    if (st === "skipped" && t.skipReason) out.reasons[t.skipReason] = (out.reasons[t.skipReason] || 0) + 1;
    if (st === "finished") { if (t.inPerson) out.inPerson++; else out.onOwn++; }
    if (st === "missed") out.missedDays.push(e);
  }
  out.missedDays = [...new Set(out.missedDays)].sort();   // two missed on one day name it once
  const held = out.finished + out.skipped + out.missed; out.pct = held ? Math.round((100 * out.finished) / held) : null;
  return out;
}
// Every exercise's sessions, oldest first, by the key canon(name) gives (main.js's alias merge): every dated workout with sets counted, as the card's Best and the
// Look up count them (sets logged in a workout ahead of its day were lifted; the v311 review: the Look up's Best and this page disagreed). Each session's top set by the workout card's rules (a set counts once completed
// or its reps typed; only rows of the kind the newest logged row has: reps, a hold, a carry; holds in the newest plan's unit, rounded as the card rounds them), its counted sets,
// and whether it was a new best as the card's NEW BEST
// decides: strictly better than every earlier session, the earlier ones folded newest first as Last time and Best are (in the 0.06 kg band the direction matters).
export function liftsOf(list, canon, todayIso, clientUnit) {
  const kindOf = (mu) => (!mu ? "reps" : mu.unit === "m" ? "m" : "time"), by = new Map(), better = (st, b, timed) => betterSet(st, b, timed) || (sameSet(st, b) && kgOf(st) > kgOf(b));
  const ws = list.filter((t) => effDate(t) && !isEmptyWorkout(t)).sort((a, b) => effDate(b).localeCompare(effDate(a)) || (b.createdAt || "").localeCompare(a.createdAt || ""));
  for (const t of ws) {                                                           // newest first: the name keeps its newest spelling, the kind its newest plan's
    const here = new Map();
    for (const r of t.rows || []) {
      const k = canon(r.name); if (!k) continue;
      const mu = measurePlan(r.reps), kind = kindOf(mu), raw = topSet(r, kind !== "reps"); if (!raw) continue;
      let e = by.get(k); if (!e) by.set(k, (e = { key: k, name: String(r.name || "").trim(), kind, tunit: kind === "time" ? mu.unit : null, timed: kind !== "reps", points: [] }));   // tunit: a hold shows in its newest plan's unit, as the card's Best
      if (kind !== e.kind) continue;
      const own = { ...raw, u: r.unit || clientUnit || "lb" }, ou = kind === "time" ? mu.unit : null, st = ou ? toTimeUnit(own, ou, e.tunit) : own;   // the card converts each hold to its plan's unit (2 decimals): the same numbers, the same bests
      let s = here.get(k); if (!s) here.set(k, (s = { date: effDate(t), tid: t.id, title: String(t.title || "").trim(), top: null, tops: [], rows: [], sets: [], words: false }));
      if (better(st, s.top, e.timed)) s.top = st;
      s.tops.push(st); s.rows.push({ own, ou });                                  // every row's top: in the unit shown (tops, the card's Best folds rows, not sessions) and in its own plan's (rows, for its NEW BEST)
      const n = Math.max(setsOf(r), ((r.weights || []).length), ((r.repsDone || []).length));
      for (let i = 0; i < n; i++) if (setCounts(r, i)) {
        const w = (r.weights || [])[i]; if (String(w == null ? "" : w).trim() && weightNumber(w) == null) s.words = true;   // "BW+10", "2x20", "Band 3": a load in words, never compared as a weight
        s.sets.push({ w, rp: (r.repsDone || [])[i], u: own.u, m: mu ? mu.unit : null });
      }
    }
    for (const [k, s] of here) by.get(k).points.push(s);
  }
  for (const e of by.values()) {
    e.points.reverse();                                                           // oldest first
    // a new best as the card's NEW BEST judges it: this session's top against every earlier row folded newest first, all in this session's own plan's unit (a hold's
    // plan can move between seconds and minutes, and the card rounds in the unit of the workout it is on: the v311 check found a best here that the card did not show)
    e.points.forEach((p, i) => {
      const u = p.rows[0].ou, to = (x) => (u && x.ou ? toTimeUnit(x.own, x.ou, u) : x.own);
      let mine = null; for (const x of p.rows) { const st = to(x); if (better(st, mine, e.timed)) mine = st; }
      let b = null; for (let j = i - 1; j >= 0; j--) for (const x of e.points[j].rows) { const st = to(x); if (better(st, b, e.timed)) b = st; }
      p.gold = !!b && betterSet(mine, b, e.timed);
    });
  }
  return by;
}
// An exercise's best: the set as the card's Best and the Look up fold every row, newest first (a better set takes it, an equal one only when heavier: 135 lb, not
// the 134.9 lb of a 61.2 kg; the v311 review), and the day it was set: its last new best (the chart's last filled dot), or the first time when none came after. A best
// matched again later keeps its day (the v311 check: a top set repeated each week read "Today" and sorted first).
export const bestOf = (e) => {
  let top = null, at = null;
  for (let i = e.points.length - 1; i >= 0; i--) for (const st of e.points[i].tops || [e.points[i].top]) if (!top || betterSet(st, top, e.timed) || (sameSet(st, top) && kgOf(st) > kgOf(top))) top = st;
  for (const p of e.points) if (p.gold) at = p;
  at = at || e.points[0];
  return { top, date: at.date, title: at.title, tid: at.tid };
};
// What grew from one session's top set to another's, in one measure, or null when nothing clearly did. A hold: longer (or, as long, heavier); a carry: farther (or, as far,
// heavier); else heavier past the 0.06 kg band (no weight is none added), or more reps at the same weight with both counted: before 6 Oct 2026 sets kept no reps, and a set
// with none never reads as fewer (the v311 review: the same 25 lb read as "stronger"). The sentence and the bars of Getting stronger measure what this names.
export function gainOf(a, b, kind) {
  if (!a || !b) return null;
  const kg = (st) => (st.w == null ? 0 : st.u === "lb" ? st.w * KG_PER_LB : st.w), dw = kg(b) - kg(a), both = a.rp != null && b.rp != null, band = TIE_KG + 1e-9;   // the card's band, a float's hair included
  if (kind === "time" || kind === "m") { if (both && b.rp > a.rp) return { by: kind === "time" ? "time" : "dist", d: b.rp - a.rp }; return both && b.rp === a.rp && dw > band ? { by: "weight", d: dw } : null; }
  if (dw > band) return { by: "weight", d: dw };
  return Math.abs(dw) <= band && both && b.rp > a.rp ? { by: "reps", d: b.rp - a.rp } : null;
}
// Getting stronger: exercises done in the last 8 weeks whose latest session clearly beats their first, on an earlier day (gainOf); the most done in those weeks first.
// Never from or to a load typed in words ("BW+10" then "10" is no 10 lb gained), never a heavier assisted machine (more help, not more strength: the v311 check). A first
// time from before 6 Oct 2026 kept no reps: when its weight is the same, the first time with reps is the one to grow from (firstTime false: "than on Oct 20").
export function strongerLifts(lifts, todayIso, days = 56) {
  const since = daysLater(todayIso, -(days - 1)), out = [];
  for (const e of lifts.values()) {
    const p = e.points; if (p.length < 2) continue;
    const recent = p.filter((x) => x.date >= since).length; if (!recent) continue;
    const last = p[p.length - 1], assisted = /assist/i.test(e.name); if (last.words) continue;
    const grew = (base) => { if (!base || base === last || base.words || !(base.date < last.date)) return null; const g = gainOf(base.top, last.top, e.kind); return g && !(assisted && g.by === "weight") ? g : null; };   // two sessions on one day are no first time to grow from
    let first = p[0], gain = grew(first), firstTime = true;
    if (!gain && first.top.rp == null) { const b = p.find((x) => x.top.rp != null && x !== last); const g = grew(b); if (g) { first = b; gain = g; firstTime = false; } }
    if (gain) out.push({ e, first, last, recent, gain, firstTime });
  }
  return out.sort((a, b) => b.recent - a.recent || b.last.date.localeCompare(a.last.date) || a.e.name.localeCompare(b.e.name));
}
// New bests this month: one an exercise (its latest this month), newest first.
export function monthBests(lifts, todayIso) {
  const ym = String(todayIso).slice(0, 7), out = [];
  for (const e of lifts.values()) { let at = null; for (const p of e.points) if (p.gold && p.date.slice(0, 7) === ym) at = p; if (at) out.push({ e, p: at }); }
  return out.sort((a, b) => b.p.date.localeCompare(a.p.date) || a.e.name.localeCompare(b.e.name));
}
// An exercise cut short for Discomfort on two days or more within 4 weeks (the coach's note). The reason is written on every row of a card, so a row counts only when it was
// itself cut short (skipped, or finished early); a stale reason on a complete row never counts. Days, not rows.
export function discomforts(list, canon, todayIso, days = 28) {
  const from = daysLater(todayIso, -(days - 1)), by = new Map();
  const ws = list.filter((t) => effDate(t) >= from && effDate(t) <= todayIso).sort((a, b) => effDate(b).localeCompare(effDate(a)));
  for (const t of ws) for (const r of t.rows || []) {
    if (r.earlyReason !== "Discomfort" || r.done !== true || Math.min(doneCount(r), setsOf(r)) >= setsOf(r)) continue;
    const k = canon(r.name); if (!k) continue;
    let x = by.get(k); if (!x) by.set(k, (x = { key: k, name: String(r.name || "").trim(), days: new Map() }));
    if (!x.days.has(effDate(t))) x.days.set(effDate(t), doneCount(r) === 0 ? "skipped" : "early");
  }
  return [...by.values()].filter((x) => x.days.size >= 2).map((x) => ({ key: x.key, name: x.name, days: [...x.days.keys()].sort(), skipped: [...x.days.values()].every((v) => v === "skipped"), early: [...x.days.values()].every((v) => v === "early") }));
}
// Sessions with the coach: the finished workouts marked In person (the mark exists since 14 Oct 2026, so the count says from when).
export function inPersonCount(list, todayIso) {
  let n = 0, since = "";
  for (const t of list) { if (!(t.inPerson && t.completedAt && !t.skippedAt && t.missed !== true)) continue; const e = effDate(t); if (!e || e > todayIso) continue; n++; if (!since || e < since) since = e; }
  return { n, since };
}
