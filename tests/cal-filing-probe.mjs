// Run by cal-filing.test.js in its own process: the redraw that files a workout missed by more than a week (his rule, 10 Nov) with the
// client's month open. The day's first answer comes through the real sync (syncDownNow, against the in-memory server), the month opens with
// its own Month button, and the coach's Reschedule to a day more than a week back goes through moveWorkout. Prints, as JSON, what the month
// and the Missed card hold after each (days found by the date VoiceOver hears, so it holds whatever day it runs on).
import { byId, el } from "./env.js";
import { makeSupabase } from "./fake-supabase.js";
const kids = (e) => {
  e.replaceChildren = (...k) => { e.children = k; e.firstElementChild = k[0] || null; };
  e.appendChild = (c) => { e.children = [...e.children, c]; e.firstElementChild = e.children[0]; return c; };
  e.append = (...k) => { e.children = [...e.children, ...k]; e.firstElementChild = e.children[0] || null; };
  return e;
};
const listens = (e) => { const H = {}; e.addEventListener = (type, fn) => { (H[type] ||= []).push(fn); }; e.removeEventListener = () => {}; e.fire = (type, ev) => { for (const fn of [...(H[type] || [])]) fn(ev); }; e.setAttribute = (k, v) => { e["@" + k] = String(v); }; return e; };
const recorder = (id, extra = {}) => { const e = listens(kids(el("div"))); Object.assign(e, extra); byId.set(id, e); return e; };
for (const id of ["calView", "calTrack", "calTitle", "calToday", "calPrev", "calNext", "calWrap", "week", "weekHead", "calToggleText", "missList", "todayList", "nextList"]) recorder(id, { clientWidth: 350 });
const toggle = recorder("calToggle");
const make = document.createElement; document.createElement = (t) => listens(kids(make(t)));
globalThis.addEventListener = () => {}; globalThis.removeEventListener = () => {};
const app = (await import("../app/main.js")).internals();
const { TEMPLATES_ID } = await import("../app/model.js");
const { fns, maps } = app;
const at = (n) => { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + n); return d; };
const day = (n) => fns.localIso(at(n));
const W = (id, n) => ({ id, clientId: "c1", title: id.toUpperCase(), date: day(n), createdAt: "2026-11-01T08:00:00.000Z", completedAt: null, skippedAt: null, rows: [{ id: "r" + id, label: "1", name: "Squat", sets: "3", reps: "10" }] });
const sb = makeSupabase(), C1 = { id: "c1", name: "Jane", unit: "lb" }, TC = { id: TEMPLATES_ID, name: "Templates", kind: "templates", templatesVersion: 3 };
sb.seed("ft_clients", "c1", C1); sb.seed("ft_clients", TEMPLATES_ID, TC);
const ws = () => [W("old", -9), W("late", -2), W("mv", 3)];                         // missed 9 days ago, missed 2 days ago, still ahead
for (const t of ws()) sb.seed("ft_trainings", t.id, t, { client_id: "c1" });
app.reset(); app.set({ sb, signedIn: true, clientMode: false, backend: fns.cloudBackend, tab: "workouts", syncedOnce: true, syncedOn: day(-1) });   // its last answer from the server came yesterday (a Mac left on the page overnight)
maps.clients.set("c1", { ...C1 }); maps.clients.set(TEMPLATES_ID, { ...TC });
for (const t of ws()) maps.trainings.set(t.id, t);
app.set({ view: { name: "client", id: "c1" } }); fns.render();
toggle.fire("click", {});                                                           // Month
const label = (n) => at(n).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
const cellsOf = (grid) => (grid.children || []).filter((b) => (b.children || []).some((s) => s.className === "dn"));
const look = (n) => {                                                               // a day of the three months on the track: its chips (state, words) and what VoiceOver hears
  for (const p of byId.get("calTrack").children || []) for (const b of cellsOf(p.children[0])) {
    if (String(b["@aria-label"] || "").split(":")[0] !== label(n)) continue;
    const box = (b.children || []).find((s) => /day-evs/.test(s.className || ""));
    return { chips: (box.children || []).map((c) => (c.className === "day-ev-more" ? c.textContent : c.className.replace("day-ev ", "") + ":" + c.children[0].textContent)), label: b["@aria-label"] };
  }
  return null;
};
const filed = (id) => { const t = maps.trainings.get(id); return !!t.skippedAt && t.missed === true; };
const missed = () => fns.missedOf("c1").map((t) => t.id);
const out = { open: fns.calState().open, days: { old: label(-9), mv: label(-10) } };
out.yesterday = { old: look(-9), filed: filed("old"), missed: missed() };
await fns.syncDownNow();                                                            // the day's first answer: S.syncedOn is today, and the sync redraws
out.synced = { old: look(-9), late: look(-2), filed: filed("old"), missed: missed() };
out.rescheduled = fns.moveWorkout("mv", day(-10));                                  // the coach's Reschedule from its row: any day, here 10 days back
out.moved = { mv: look(-10), filed: filed("mv"), missed: missed() };
console.log(JSON.stringify(out));
process.exit(0);
