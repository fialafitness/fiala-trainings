// The workout model: what a training, a row and the templates entry are, with no app state.
import { uid, clamp, localIso } from "./util.js";

export const TEMPLATES_ID = "00000000-0000-4000-8000-0000000000f1";
export const isTemplateClient = (id) => id === TEMPLATES_ID;
export const effDate = (t) => t.completedAt ? localIso(new Date(t.completedAt)) : (t.date || "");
export const freshRow = (r) => { const x = { ...r, id: uid(), weights: [], repsDone: [], setsDone: 0, done: false, alts: [...(r.alts || [])] }; delete x.earlyReason; delete x.clientNote; delete x.clientNoteBy; delete x.clientNoteAt; return x; };   // the plan, with nothing logged
export const isEmptyWorkout = (t) => !!t && !t.completedAt && !t.skippedAt && !(t.rows || []).length && !String(t.title || "").trim() && !isTemplateClient(t.clientId);
// A plan written in time ("30 sec", "45 s", "1 min", "60 sec / side") is logged as time held, not reps: { n: "30", unit: "sec" }.
export const timedPlan = (reps) => { const m = /(\d+(?:[.,]\d+)?)(?:\s*[\u2013-]\s*\d+(?:[.,]\d+)?)?\s*(s|sec|secs|second|seconds|min|mins|minute|minutes)\b/i.exec(String(reps || "")); return m ? { n: m[1], unit: /^m/i.test(m[2]) ? "min" : "sec" } : null; };
// A dumbbell or kettlebell exercise is logged per hand: the Weight label says so ("Weight / dumbbell"), the number stays a number.
export const perHand = (name) => { const n = String(name || ""); return /\b(dumb?bells?|dbs?)\b/i.test(n) ? "dumbbell" : /\b(kettlebells?|kbs?)\b/i.test(n) ? "kettlebell" : null; };
// Ranking logged sets. A hold: the longest, then the heaviest. Anything else: the heaviest, then the most reps; a set with
// reps and no weight (bodyweight) ranks below any weighted set. A set is { w, rp } with null for what was not logged.
const num = (v) => { const str = String(v == null ? "" : v).trim(); return /^\d+(?:[.,]\d+)?$/.test(str) ? parseFloat(str.replace(",", ".")) : null; };
export const betterSet = (a, b, timed) => !b || (timed ? (a.rp || 0) > (b.rp || 0) || ((a.rp || 0) === (b.rp || 0) && (a.w || 0) > (b.w || 0))
  : (a.w == null ? -1 : a.w) > (b.w == null ? -1 : b.w) || ((a.w == null ? -1 : a.w) === (b.w == null ? -1 : b.w) && (a.rp || 0) > (b.rp || 0)));
export const topSet = (row, timed) => { let best = null; const ws = (row && row.weights) || [], rs = (row && row.repsDone) || []; for (let i = 0; i < Math.max(ws.length, rs.length); i++) { const w = num(ws[i]), rp = num(rs[i]); if (timed ? rp == null : (w == null && rp == null)) continue; const st = { w, rp }; if (betterSet(st, best, timed)) best = st; } return best; };
export const sameSet = (a, b) => !!a && !!b && a.w === b.w && a.rp === b.rp;
// Packages. A client's plan: { id, name, kind: "sessions" | "monthly", size, startedOn, adjust, until }.
// A sessions package counts finished workouts marked "in person" since it started, plus the trainer's correction;
// package 2 starts by itself once package 1 is full. A monthly plan is just a day it is active until.
export const planProgress = (plan, list) => {
  if (!plan || plan.kind !== "sessions" || !(plan.size > 0)) return null;
  const used = Math.max(0, list.filter((t) => t.inPerson && t.completedAt && effDate(t) >= (plan.startedOn || "")).length + (parseInt(plan.adjust, 10) || 0));
  const size = plan.size, packNo = used === 0 ? 1 : Math.floor((used - 1) / size) + 1, inPack = used === 0 ? 0 : ((used - 1) % size) + 1;
  return { used, size, packNo, inPack, left: size - inPack, complete: used > 0 && used % size === 0 };
};
export const sessionNo = (plan, list, t) => {                      // "Session 3 of 10": this in-person workout's place since the plan started, planned ones included, in date order
  if (!plan || plan.kind !== "sessions" || !(plan.size > 0) || !t || !t.inPerson || t.skippedAt || t.missed === true || effDate(t) < (plan.startedOn || "")) return null;
  const order = list.filter((x) => x.inPerson && !x.skippedAt && x.missed !== true && effDate(x) >= (plan.startedOn || "")).sort((a, b) => effDate(a).localeCompare(effDate(b)) || (a.createdAt || "").localeCompare(b.createdAt || ""));
  const p = order.findIndex((x) => x.id === t.id); if (p < 0) return null;
  const n = p + 1 + (parseInt(plan.adjust, 10) || 0); if (n < 1) return null;
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
