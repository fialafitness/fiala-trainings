// v315 (17 Nov 2026), the owner's ask: "if my client travels to a different country with a different time zone .. scheduled workouts fall into a different day".
// A workout to do has a day and no time: the same on every device. A finished one was filed under the day of its finish on the clock of whoever looked,
// so a Tuesday workout done at 8 am in Paris showed on Monday on the coach's Mac in Los Angeles. Now the finish carries the time zone it was made in,
// stamped with the finish time it belongs to (completedZone = { zone, at }), and every device files it, and writes its time, as it was there.
// None of the expectations below depends on this computer's own zone: the suite passes the same with TZ=Asia/Tokyo, Europe/Paris, Pacific/Honolulu,
// Pacific/Kiritimati or America/Los_Angeles.
import { test, assert, tick } from "./assert.js";
import { makeSupabase } from "./fake-supabase.js";
import { load } from "./load.js";
import { effDate, doneDay, zoneOf, zoneOpt, dayIn, hereZone, pickZone, validateBackup, discomforts, inPersonCount, planOver, daysLeft } from "../app/model.js";
import { daysLater } from "../app/util.js";
const app = await load();
const { fns, maps } = app;
const $ = (id) => document.getElementById(id);
const PARIS_TUE_8AM = "2026-11-24T07:00:00.000Z", TOKYO_TUE_830AM = "2026-11-23T23:30:00.000Z", HONOLULU_MON_1030PM = "2026-11-24T08:30:00.000Z";
const stamp = (zone, at) => ({ zone, at });
const workout = (id, extra) => ({ id, clientId: "c1", title: "Legs", date: "2026-11-24", createdAt: "2026-11-20T10:00:00.000Z", completedAt: null, skippedAt: null, rows: [], ...(extra || {}) });
const finished = (id, at, zone, extra) => workout(id, { completedAt: at, ...(zone ? { completedZone: stamp(zone, at) } : {}), ...(extra || {}) });
const settle = async () => { const until = Date.now() + 15000; do await tick(5); while ((app.get().inflight > 0 || maps.timers.size) && Date.now() < until); };
const coachOn = (extra) => { app.reset(); app.set({ signedIn: true, clientMode: false, tab: "workouts", ...(extra || {}) }); maps.clients.set("c1", { id: "c1", name: "Jane", unit: "lb" }); };

test("a finished workout is filed under the day where it was finished, whatever the zone of the device looking", () => {
  assert.strictEqual(effDate(finished("p", PARIS_TUE_8AM, "Europe/Paris")), "2026-11-24", "8 am Tuesday in Paris (11 pm Monday in Los Angeles): Tuesday");
  assert.strictEqual(effDate(finished("t", TOKYO_TUE_830AM, "Asia/Tokyo")), "2026-11-24", "8:30 am Tuesday in Tokyo (3:30 pm Monday in Los Angeles): Tuesday");
  assert.strictEqual(effDate(finished("h", HONOLULU_MON_1030PM, "Pacific/Honolulu", { date: "2026-11-23" })), "2026-11-23", "10:30 pm Monday in Honolulu (Tuesday everywhere east of it): Monday");
  assert.strictEqual(effDate(finished("l", "2026-11-25T07:30:00.000Z", "America/Los_Angeles")), "2026-11-24", "11:30 pm Tuesday at home: Tuesday, on a phone abroad too");
  assert.strictEqual(doneDay(finished("p", PARIS_TUE_8AM, "Europe/Paris")), "2026-11-24");
  assert.strictEqual(effDate(workout("x")), "2026-11-24", "a workout to do: its day, the same everywhere");
  assert.strictEqual(effDate(workout("s", { completedAt: PARIS_TUE_8AM, completedZone: stamp("Europe/Paris", "2026-11-24T07:00:00+00:00") })), "2026-11-24", "the server writes the stamp's time as +00:00: the same moment, so it counts");
  assert.strictEqual(dayIn(PARIS_TUE_8AM, "Asia/Tokyo"), "2026-11-24"); assert.strictEqual(dayIn(PARIS_TUE_8AM, "Mars/Olympus_Mons"), ""); assert.strictEqual(dayIn("not a time", "Europe/Paris"), "");
});

test("a finish with no counted zone is read on this device's own clock, as before: none, unknown here, not a stamp, or a stamp left from another finish", () => {
  const own = fns.localIso(new Date(PARIS_TUE_8AM));
  assert.strictEqual(effDate(finished("o", PARIS_TUE_8AM)), own, "no zone (a finish made before v315): this device's day");
  assert.strictEqual(effDate(finished("u", PARIS_TUE_8AM, "Mars/Olympus_Mons")), own, "a zone this device does not know: its own day, never an error");
  assert.strictEqual(effDate(workout("n", { completedAt: PARIS_TUE_8AM, completedZone: "Europe/Paris" })), own, "a bare name with no time to tie it to: not counted");
  assert.strictEqual(effDate(workout("k", { completedAt: PARIS_TUE_8AM, completedZone: 42 })), own, "not a stamp at all: the same");
  const stale = workout("st", { completedAt: TOKYO_TUE_830AM, completedZone: stamp("America/Los_Angeles", "2026-11-20T18:00:00.000Z") });   // the old rule (client-finish.sql not run yet), or a v314 page still open, wrote a new finish and left the coach's earlier stamp on it
  assert.strictEqual(zoneOf(stale), "", "a stamp for another finish is never read (the v315 review's catch: it put a Tokyo finish on Los Angeles's Monday)");
  assert.strictEqual(effDate(stale), fns.localIso(new Date(TOKYO_TUE_830AM)), "so that finish is read on this device's clock, as every finish was before");
  assert.doesNotThrow(() => effDate(workout("bad", { completedAt: "not a time", completedZone: stamp("Europe/Paris", "not a time") })), "a broken finish time: no error (the screens drew it before v315 too)");
  assert.deepStrictEqual(zoneOpt(stale), {}, "and its time is written on this device's clock");
  assert.deepStrictEqual(zoneOpt(finished("p", PARIS_TUE_8AM, "Europe/Paris")), { timeZone: "Europe/Paris" });
});

test("a record's day is worked out again when its finish or its stamp changes", () => {
  const t = finished("c", PARIS_TUE_8AM, "Europe/Paris");
  assert.strictEqual(effDate(t), "2026-11-24"); assert.strictEqual(effDate(t), "2026-11-24", "(read twice: the same)");
  t.completedZone = stamp("Pacific/Honolulu", PARIS_TUE_8AM); assert.strictEqual(effDate(t), "2026-11-23", "the same moment in Honolulu: 9 pm on Monday");
  t.completedAt = "2026-11-26T07:00:00.000Z"; assert.strictEqual(effDate(t), fns.localIso(new Date(t.completedAt)), "finished again later, the stamp still the old finish's: this device's day");
  t.completedZone = stamp("Europe/Paris", t.completedAt); assert.strictEqual(effDate(t), "2026-11-26");
  delete t.completedZone; assert.strictEqual(effDate(t), fns.localIso(new Date(t.completedAt)), "the stamp gone: this device's day");
});

test("a backup keeps a finish's stamp, and refuses one that is not a stamp", () => {
  const C = "1b4e28ba-2fa1-41d2-883f-0016d3cca427", W = "2c5f39cb-3fb2-42e3-894f-0127e4ddb538";
  const file = (z) => ({ app: "fiala-trainings", clients: { [C]: { id: C, name: "Jane", unit: "lb" } }, trainings: { [W]: { ...workout(W, { completedAt: PARIS_TUE_8AM }), clientId: C, ...(z === undefined ? {} : { completedZone: z }) } } });
  const ok = (z) => { try { validateBackup(file(z), () => true); return true; } catch (_) { return false; } };
  assert.ok(ok(stamp("Europe/Paris", PARIS_TUE_8AM)), "a zone with its finish time"); assert.ok(ok(undefined), "none (a finish made before v315)"); assert.ok(ok(null), "null");
  assert.ok(!ok("Europe/Paris"), "a bare name is refused (a backup is taken whole or refused whole)"); assert.ok(!ok(7)); assert.ok(!ok(stamp(7, PARIS_TUE_8AM))); assert.ok(!ok(stamp("Europe/Paris", "not a time"))); assert.ok(!ok(stamp("Europe/Paris")));
});

test("finishing stamps this device's time zone with that very finish; Undo takes it away and leaves the workout on the day where it was finished", () => {
  coachOn();
  const t = workout("w1", { date: fns.today() }); maps.trainings.set("w1", t); app.set({ view: { name: "training", id: "w1" } }); fns.render();
  fns.setFinished(true);
  assert.ok(t.completedAt, "finished"); assert.deepStrictEqual(t.completedZone, stamp(hereZone(), t.completedAt), "this device's zone (\"" + hereZone() + "\"), stamped with the finish's own time");
  assert.ok(maps.trainerState.get("w1") && maps.trainerState.get("w1").has("completedZone"), "the coach's own finish's stamp stands over the server's copy, as its time does");
  coachOn({ view: { name: "training", id: "w1" } }); maps.trainings.set("w1", t); fns.render();   // the Nice work screen closed (as its Back or its 4 seconds do), the workout open again
  Object.assign(t, { completedAt: PARIS_TUE_8AM, completedZone: stamp("Europe/Paris", PARIS_TUE_8AM), date: "2026-11-23" });   // say it was finished in Paris at 8 am on Tuesday, a workout planned for Monday
  fns.setFinished(false);
  assert.strictEqual(t.completedAt, null); assert.ok(!("completedZone" in t), "Undo: the stamp goes with the finish");
  assert.strictEqual(t.date, "2026-11-24", "and the workout stays on Tuesday, the day it was done where it was done (never the day on this computer's clock)");
  coachOn();
});

test("the coach logging a past session: the stamp carries the time set on the session's day, so it files under that day", () => {
  coachOn();
  const past = daysLater(fns.today(), -3), t = workout("w3", { date: past }); maps.trainings.set("w3", t); app.set({ view: { name: "training", id: "w3" } }); fns.render();
  fns.setFinished(true);
  assert.ok(t.completedZone && t.completedZone.at === t.completedAt, "stamped with the finish time as set on that day, not the moment of the tap");
  assert.strictEqual(effDate(t), past, "filed under the session's own day");
  coachOn();
});

test("the coach's finish: this clock's zone when it keeps the planned day; else where the client last finished one (7 days, no session with the coach since); else no zone", () => {
  const LA = "America/Los_Angeles", MON_3PM_LA = "2026-11-23T23:00:00.000Z", NOW = Date.parse(MON_3PM_LA), ago = (d) => new Date(NOW - d * 864e5).toISOString();   // Monday 3 pm in Los Angeles is Tuesday 8 am in Tokyo
  const tue = workout("w", { date: "2026-11-24", completedAt: MON_3PM_LA }), mon = workout("m", { date: "2026-11-23", completedAt: MON_3PM_LA });
  const own = (id, zone, daysAgo, extra) => finished(id, ago(daysAgo), zone, { completedBy: "client", ...(extra || {}) });
  assert.strictEqual(pickZone(mon, LA, [own("a", "Asia/Tokyo", 2)], NOW), LA, "Monday's workout logged on Monday: this clock's zone, wherever the client is");
  assert.strictEqual(pickZone(tue, LA, [own("a", "Asia/Tokyo", 2)], NOW), "Asia/Tokyo", "Tuesday's workout logged while it is Tuesday in Tokyo: the client's zone keeps it on Tuesday");
  const crowd = [own("paris", "Europe/Paris", 10), own("tokyo", "Asia/Tokyo", 2), finished("coach", ago(1), "Europe/London"), own("old", "Australia/Sydney", 31)];
  assert.strictEqual(pickZone(tue, LA, crowd, NOW), "Asia/Tokyo", "the newest of the client's own finishes in 7 days: not an older one, not one the coach logged elsewhere, not one a month old");
  assert.strictEqual(pickZone(tue, LA, [own("tokyo", "Asia/Tokyo", 2), finished("met", ago(1), LA, { inPerson: true })], NOW), "", "a session with the coach after it: the client is no longer known to be away, so no zone");
  assert.strictEqual(pickZone(tue, LA, [own("tokyo", "Asia/Tokyo", 9)], NOW), "", "the client's last own finish more than 7 days ago: no zone");
  assert.strictEqual(pickZone(tue, LA, [], NOW), "", "nothing to go on: no zone, so each device reads its own clock, as before v315");
  assert.strictEqual(pickZone({ ...tue, inPerson: true }, LA, [own("tokyo", "Asia/Tokyo", 2)], NOW), "Asia/Tokyo", "the workout's own In person mark (often the package's default) does not decide");
  const tip = { ...tue, inPerson: true };
  assert.strictEqual(pickZone(tip, LA, [own("tokyo", "Asia/Tokyo", 2), tip], NOW), "Asia/Tokyo", "finishZone passes all the client's workouts, this one with its fresh finish among them: it is never its own evidence");
  assert.strictEqual(pickZone(workout("wed", { date: "2026-11-25", completedAt: MON_3PM_LA }), LA, [own("tokyo", "Asia/Tokyo", 2)], NOW), "", "a zone that does not keep the planned day either: no zone");
  assert.strictEqual(pickZone(tue, LA, [own("tokyo", "Asia/Tokyo", 2, { inPerson: true })], NOW), "Asia/Tokyo", "a client's own finish counts, In person or not");
  assert.strictEqual(pickZone(tue, LA, [{ ...own("tokyo", "Asia/Tokyo", 2), completedZone: undefined }], NOW), "", "a client's own finish with no zone tells nothing");
});

test("the coach's finish with nothing to go on, a day this clock is not on: no zone, so each device reads its own clock as before", () => {
  coachOn();
  const t = workout("w2", { date: daysLater(fns.today(), 2) }); maps.trainings.set("w2", t); app.set({ view: { name: "training", id: "w2" } }); fns.render();
  fns.setFinished(true);
  assert.ok(t.completedAt && !("completedZone" in t), "finished with no zone"); assert.strictEqual(effDate(t), fns.localIso(new Date(t.completedAt)), "filed on this device's own day");
  coachOn();
});

test("a client's own finish stamps the phone's zone, and the upload carries it", async () => {
  const sb = makeSupabase(); app.reset(); app.set({ sb, signedIn: true, clientMode: true, myClientId: "c1", backend: fns.clientBackend, tab: "workouts" });
  maps.clients.set("c1", { id: "c1", name: "Jane", unit: "lb" });
  const sent = []; sb.rpcs.client_finish_training = async (a) => { sent.push(a); return null; };
  const t = workout("cf", { date: fns.today() }); maps.trainings.set("cf", t); app.set({ view: { name: "training", id: "cf" } }); fns.render();
  fns.setFinished(true);
  assert.deepStrictEqual(t.completedZone, stamp(hereZone(), t.completedAt), "the phone's own zone, stamped with this finish"); assert.ok(maps.pendingFinish.has("cf"), "queued for the server");
  fns.flushOne("trainings", "cf"); await settle();
  const last = sent[sent.length - 1];
  assert.deepStrictEqual([last && last.p_at, last && last.p_zone], [t.completedAt, hereZone()], "sent with its time and its zone");
  for (const n of [-1, 1]) {                                          // a missed workout done today, or one done early: the phone's zone still, never the coach's rule
    const w = workout("cf" + n, { date: daysLater(fns.today(), n) }); maps.trainings.set(w.id, w); app.set({ view: { name: "training", id: w.id }, renderedTraining: null }); fns.render();
    fns.setFinished(true);
    assert.deepStrictEqual(w.completedZone, stamp(hereZone(), w.completedAt), "a workout dated " + (n < 0 ? "yesterday" : "tomorrow") + ", finished on the phone: the phone's zone");
  }
  await settle();
  app.reset();
});

test("the ✓ Finished line writes the date and the time as they were on the clock where it was finished", () => {
  coachOn();
  maps.trainings.set("f1", finished("f1", PARIS_TUE_8AM, "Europe/Paris")); app.set({ view: { name: "training", id: "f1" }, renderedTraining: null }); fns.render();
  const d = new Date(PARIS_TUE_8AM), at = (o) => d.toLocaleDateString(undefined, { month: "short", day: "numeric", ...o }) + ", " + d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit", ...o });
  assert.strictEqual($("finishedText").textContent, "✓ Finished · " + at({ timeZone: "Europe/Paris" }), "Paris's 8:00 on the 24th, on any computer");
  assert.ok(/24/.test($("finishedText").textContent) && /8:00/.test($("finishedText").textContent), "the 24th, 8:00 (" + $("finishedText").textContent + ")");
  maps.trainings.set("f2", finished("f2", PARIS_TUE_8AM)); app.set({ view: { name: "training", id: "f2" }, renderedTraining: null }); fns.render();
  assert.strictEqual($("finishedText").textContent, "✓ Finished · " + at({}), "a finish with no zone: this computer's clock, as before");
});

test("the calendar's day lists file a client's finish abroad under the client's day", () => {
  coachOn();
  maps.trainings.set("p", finished("p", PARIS_TUE_8AM, "Europe/Paris", { title: "Paris", completedBy: "client" }));
  maps.trainings.set("h", finished("h", HONOLULU_MON_1030PM, "Pacific/Honolulu", { title: "Honolulu", date: "2026-11-23", completedBy: "client" }));
  maps.trainings.set("todo", workout("todo", { title: "To do", date: "2026-11-25" }));
  const ids = (d) => fns.dayList("c1", d).map((t) => t.id).sort();
  assert.deepStrictEqual(ids("2026-11-23"), ["h"], "Monday: the one finished on Monday night in Honolulu");
  assert.deepStrictEqual(ids("2026-11-24"), ["p"], "Tuesday: the one finished on Tuesday morning in Paris");
  assert.deepStrictEqual(ids("2026-11-25"), ["todo"], "Wednesday: the one to do, as planned");
});

test("a finish whose day is already further on where it was made counts now: the Discomfort note and the in-person sessions", () => {
  const row = { id: "r", label: "1", name: "Squat", sets: 3, reps: "8", rest: "", tempo: "", weights: ["100"], repsDone: ["8"], setsDone: 1, done: true, earlyReason: "Discomfort", note: "", alts: [] };
  const canon = (n) => String(n || "").toLowerCase(), MONDAY = "2026-11-23";   // the coach's Monday in Los Angeles, while it is already Tuesday morning in Paris
  const paris = finished("paris", PARIS_TUE_8AM, "Europe/Paris", { inPerson: true, rows: [row] });
  assert.strictEqual(effDate(paris), "2026-11-24", "(filed under Tuesday, the client's day)");
  assert.strictEqual(inPersonCount([paris], MONDAY).n, 1, "an in-person session finished where it is already Tuesday is a session used on Monday here");
  const saturday = finished("sat", "2026-11-21T18:00:00.000Z", "America/Los_Angeles", { date: "2026-11-21", rows: [row] });   // the note needs the same exercise on two days
  assert.deepStrictEqual(discomforts([saturday, paris], canon, MONDAY).map((x) => x.days), [["2026-11-21", "2026-11-24"]], "its Discomfort shows now, not when this clock reaches Tuesday");
  assert.strictEqual(inPersonCount([paris], "2026-11-21").n, 0, "never more than two days on (the widest two zones apart)");
  assert.strictEqual(discomforts([saturday, workout("planned", { rows: [row] })], canon, MONDAY).length, 0, "a workout still to do, dated tomorrow, does not count");
});

test("Plan ended on either clock: this device's day or the server's (Los Angeles), so a phone in Hawaii never shows an empty list", () => {
  const c = { id: "c1", plan: { kind: "monthly", until: "2026-11-30" } };
  assert.strictEqual(planOver(c, ["2026-11-30", "2026-11-30"]), false, "the last day on both clocks: still on");
  assert.strictEqual(planOver(c, ["2026-11-30", "2026-12-01"]), true, "Honolulu still on the 30th, Los Angeles on the 1st: the server sends no workouts, so it is over here too");
  assert.strictEqual(planOver(c, ["2026-12-01", "2026-11-30"]), true, "a phone east of Los Angeles past its own midnight: over, as before");
  assert.strictEqual(planOver({ id: "c1", paused: true }, ["2026-11-01"]), true, "paused by hand");
  assert.strictEqual(planOver({ id: "c1", plan: { kind: "package" } }, ["2027-01-01", "2027-01-01"]), false, "a package has no end day");
  assert.strictEqual(planOver(null, ["2026-11-30"]), false);
});

test("the Clients list counts a plan's days left from the later of the two days, as Plan ended does", () => {
  assert.strictEqual(daysLeft("2026-11-30", ["2026-11-28", "2026-11-28"]), 2);
  assert.strictEqual(daysLeft("2026-11-30", ["2026-11-30", "2026-12-01"]), -1, "Honolulu on the 30th, Los Angeles on the 1st: ended (the server holds the workouts back)");
  assert.strictEqual(daysLeft("2026-11-30", ["2026-12-01", "2026-11-30"]), -1, "east of Los Angeles past its own midnight: ended, as before");
  assert.strictEqual(daysLeft("2026-11-30", ["2026-11-30", "2026-11-30"]), 0, "the last day on both: Ends today");
});

test("a client's finish sends the zone stamped with that finish; a rule not updated yet takes the finish without it, and later finishes stop asking until the next launch", async () => {
  const sb = makeSupabase(); app.reset(); app.set({ sb, signedIn: true, clientMode: true, myClientId: "c1", backend: fns.clientBackend });
  const calls = []; sb.rpcs.client_finish_training = async (args) => { calls.push(args); if ("p_zone" in args) { const e = new Error("Could not find the function"); e.code = "PGRST202"; throw e; } return null; };
  const t = finished("T", PARIS_TUE_8AM, "Europe/Paris"); maps.trainings.set("T", t); maps.dirty.set("trainings/T", 1); maps.pendingFinish.add("T");
  fns.flushOne("trainings", "T"); await settle();
  assert.deepStrictEqual(calls.map((a) => [a.p_at, a.p_zone]), [[PARIS_TUE_8AM, "Europe/Paris"], [PARIS_TUE_8AM, undefined]], "the zone went first; the rule that does not know it took the finish with its time");
  assert.ok(!maps.pendingFinish.has("T"), "and the finish is done"); assert.strictEqual(app.get().zoneMissing, true);
  maps.dirty.set("trainings/T", 2); maps.pendingFinish.add("T"); fns.flushOne("trainings", "T"); await settle();
  assert.strictEqual(calls.length, 3); assert.ok(!("p_zone" in calls[2]), "the next finish goes straight in the shape the rule knows");
  app.set({ zoneMissing: false }); sb.rpcs.client_finish_training = async (args) => { calls.push(args); return null; };
  maps.dirty.set("trainings/T", 3); maps.pendingFinish.add("T"); fns.flushOne("trainings", "T"); await settle();
  assert.deepStrictEqual([calls[3].p_at, calls[3].p_zone], [PARIS_TUE_8AM, "Europe/Paris"], "a rule that knows the zone takes it");
  t.completedAt = "2026-11-24T09:00:00.000Z"; maps.dirty.set("trainings/T", 4); maps.pendingFinish.add("T"); fns.flushOne("trainings", "T"); await settle();
  assert.ok(!("p_zone" in calls[4]), "a stamp left from an earlier finish is never sent with a later one");
  t.completedAt = null; delete t.completedZone; maps.dirty.set("trainings/T", 5); maps.pendingFinish.add("T"); fns.flushOne("trainings", "T"); await settle();
  assert.deepStrictEqual([calls[5].p_finished, calls[5].p_at, "p_zone" in calls[5]], [false, null, false], "Undo sends no zone");
});

test("the coach's save keeps a client's finish with its stamp; the coach's own finish's stamp stands over the server's", async () => {
  const sb = makeSupabase(); app.reset(); app.set({ sb, signedIn: true, clientMode: false, backend: fns.cloudBackend }); maps.clients.set("c1", { id: "c1", name: "Jane", unit: "lb" });
  sb.seed("ft_trainings", "T", finished("T", PARIS_TUE_8AM, "Europe/Paris", { completedBy: "client" }), { client_id: "c1" });
  maps.seenAt.set("trainings/T", "S0");                               // this device last saw an older copy, before the client's finish
  const local = workout("T", { title: "Legs, renamed" }); maps.trainings.set("T", local);
  await fns.cloudBackend.set("trainings", "T", JSON.parse(JSON.stringify(local)));
  const saved = sb.tables.ft_trainings.get("T").data;
  assert.deepStrictEqual([saved.title, saved.completedAt, saved.completedZone], ["Legs, renamed", PARIS_TUE_8AM, stamp("Europe/Paris", PARIS_TUE_8AM)], "the coach's rename lands; the client's finish and its stamp survive");
  assert.deepStrictEqual(maps.trainings.get("T").completedZone, stamp("Europe/Paris", PARIS_TUE_8AM), "the live copy learns the stamp too");
  assert.strictEqual(effDate(maps.trainings.get("T")), "2026-11-24", "and files it under Tuesday");
  const sb2 = makeSupabase(); app.reset(); app.set({ sb: sb2, signedIn: true, clientMode: false, backend: fns.cloudBackend }); maps.clients.set("c1", { id: "c1", name: "Jane", unit: "lb" });
  sb2.seed("ft_trainings", "U", finished("U", PARIS_TUE_8AM, "Europe/Paris"), { client_id: "c1" }); maps.seenAt.set("trainings/U", "S0");
  const mine = finished("U", "2026-11-24T17:00:00.000Z", "America/Los_Angeles"); maps.trainings.set("U", mine); fns.touchState("U", "completedAt", "completedZone");
  await fns.cloudBackend.set("trainings", "U", JSON.parse(JSON.stringify(mine)));
  const s2 = sb2.tables.ft_trainings.get("U").data;
  assert.deepStrictEqual([s2.completedAt, s2.completedZone], ["2026-11-24T17:00:00.000Z", stamp("America/Los_Angeles", "2026-11-24T17:00:00.000Z")], "the coach's finish here, with its own stamp");
  await settle();
});
