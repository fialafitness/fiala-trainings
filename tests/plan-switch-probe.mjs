// Run by plan-switch.test.js in its own process (v312, the owner's ask, 16 Nov 2026: "fix that as well", Sessions kept through package switches; and the last
// check's findings). It keeps the real listeners of the card's Plan pop-up (#planSel) and of the plan card (#planCard: Change, +, Save) and drives them as the
// coach: a mis-pick put right the same day, a bigger package picked as a smaller one and back, and a Change left open while a sync brings another device's switch.
// Started from the checkers' probe (env.js stand-ins with these two keeping their listeners; the real sync against fake-supabase; real timers).
const env = await import("./env.js");
const { byId, el } = env;
const keep = (id) => { const e = el("div"); const H = {}; e.addEventListener = (t, fn) => { (H[t] ||= []).push(fn); }; e.H = H; byId.set(id, e); return e; };   // these two keep their listeners
const planCard = keep("planCard"), planSel = keep("planSel");
globalThis.fetch = async () => { throw new Error("no network in this probe"); };
const { load } = await import("./load.js");
const { makeSupabase } = await import("./fake-supabase.js");
const model = await import("../app/model.js");
const app = await load(); const { fns, maps } = app;
const $ = (id) => document.getElementById(id);
const TPL = model.TEMPLATES_ID;
const dayAgo = (n) => { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() - n); return fns.localIso(d); };
const P5 = { id: "p5", name: "5 sessions", kind: "sessions", size: 5, inPerson: true }, P10 = { id: "p10", name: "10 sessions", kind: "sessions", size: 10, inPerson: true }, P20 = { id: "p20", name: "20 sessions", kind: "sessions", size: 20, inPerson: true }, PM = { id: "pm", name: "4-week plan", kind: "monthly", inPerson: true };
const tplRec = { id: TPL, name: "Templates", kind: "templates", templatesVersion: 999, builtinsAdopted: true, packages: [P5, P10, P20, PM] };
const client = (plan) => ({ id: "c1", name: "Jane", unit: "lb", plan });
const marks = Array.from({ length: 5 }, (_, i) => ({ id: "m" + i, clientId: "c1", title: "Full body", date: dayAgo(12 - 2 * i), createdAt: new Date(dayAgo(20) + "T12:00:00").toISOString(), completedAt: new Date(dayAgo(12 - 2 * i) + "T18:00:00").toISOString(), skippedAt: null, inPerson: true,
  rows: [{ id: "r" + i, label: "1", name: "Goblet squat", sets: 3, reps: "10", rest: "60 sec", tempo: "", weights: ["25", "25", "25"], repsDone: ["10", "10", "10"], setsDone: 3, done: true, unit: "lb", note: "", alts: [] }] }));   // 5 finished In person
const strip = (h) => String(h || "").replace(/<[^>]+>/g, "|").replace(/\|+/g, "|");
const card = () => ({ big: $("planBig").textContent, right: $("planRight").textContent, steps: !$("planSteps").hidden });
const sessions = () => (/\|Sessions\|(?:Package \d+\|)?(\d+)\|/.exec(strip($("pgSessions").innerHTML)) || [])[1] || null;
const tap = (sel, id) => { for (const fn of planCard.H.click || []) fn({ target: { closest: (s) => (s === sel ? { id: id || "" } : null) }, currentTarget: planCard }); };
const pick = (v) => { for (const fn of planSel.H.change || []) fn({ target: { value: v } }); };   // the card's Plan pop-up
const tick = (ms) => new Promise((r) => setTimeout(r, ms));
const settle = async () => { const until = Date.now() + 15000; do await tick(5); while ((app.get().inflight > 0 || maps.timers.size) && Date.now() < until); };
const quiet = () => { for (const t of maps.timers.values()) clearTimeout(t); maps.timers.clear(); };
const local = (plan) => {
  app.reset(); app.set({ signedIn: true, clientMode: false, backend: fns.localBackend, view: { name: "client", id: "c1" }, tab: "workouts" });
  maps.clients.set(TPL, JSON.parse(JSON.stringify(tplRec))); maps.clients.set("c1", JSON.parse(JSON.stringify(client(plan)))); for (const t of marks) maps.trainings.set(t.id, JSON.parse(JSON.stringify(t)));
  fns.render();
};
const plan = () => JSON.parse(JSON.stringify(maps.clients.get("c1").plan));
const out = {};

{ const p10 = { ...P10, startedOn: dayAgo(60), adjust: 8 }; delete p10.inPerson; local(p10);   // 8 on paper before the app and 5 marks: Package 2, 3 of 10
  out.misPick = { before: [card(), sessions()] };
  pick("pm"); out.misPick.wrong = [card().big, sessions()];   // the monthly plan picked by mistake
  pick("p10"); out.misPick.back = [card(), sessions(), JSON.stringify(plan()) === JSON.stringify(p10)];   // and the 10 put back the same day
  quiet();
}
{ const p20 = { ...P20, startedOn: dayAgo(60), adjust: 8 }; delete p20.inPerson; local(p20);   // 13 of 20
  out.bigSmallBig = { before: card().big }; pick("p10"); out.bigSmallBig.wrong = [card(), sessions()];
  pick("p20"); out.bigSmallBig.back = [card().big, sessions(), JSON.stringify(plan()) === JSON.stringify(p20)];
  quiet();
}
const fresh = (P, adjust) => { const p = { ...P, startedOn: dayAgo(60), adjust }; delete p.inPerson; return p; }, hist = () => maps.clients.get("c1").planHistory;
// the final checks: None by mistake put back the same day comes back exactly; a session taken off on the package picked stays off when the old one is picked back
{ const p10 = fresh(P10, 8); local(p10); pick(""); pick("p10"); out.viaNone = [card(), sessions(), JSON.stringify(plan()) === JSON.stringify(p10), hist() === undefined]; quiet(); }
{ local(fresh(P10, 8)); pick("p20"); tap("#planChange", "planChange"); tap(".step", "planMinus"); tap("#planSave", "planSave");
  const mid = [card().big, sessions()]; pick("p10"); out.changeKept = [mid, card().big, sessions(), plan().adjust]; quiet();
}
{ const sb = makeSupabase(), p10 = { ...P10, startedOn: dayAgo(60), adjust: 8 }; delete p10.inPerson;   // the last check's [2]: a Change open across another device's switch
  app.reset(); app.set({ sb, signedIn: true, clientMode: false, backend: fns.cloudBackend, view: { name: "client", id: "c1" }, tab: "workouts" });
  sb.seed("ft_clients", TPL, tplRec); sb.seed("ft_clients", "c1", client(p10)); for (const t of marks) sb.seed("ft_trainings", t.id, t);
  await fns.syncDownNow(); await settle();
  tap("#planChange", "planChange"); tap(".step", "planPlus"); tap(".step", "planPlus");   // Change, +, +: 5 of 10 on the card, not saved
  out.sync = { open: [card(), sessions()] };
  const sw = model.planSwitch(client(p10), P20, marks, fns.today());   // the coach's other device: 20 sessions picked, saved to the server
  sb.seed("ft_clients", "c1", { ...client(p10), plan: sw.plan }); await fns.syncDownNow(); await settle();
  out.sync.synced = [card(), sessions()];
  tap("#planSave", "planSave"); await settle();   // a tap where Save was
  const c = maps.clients.get("c1"); out.sync.saved = [card(), sessions(), c.plan.adjust, c.plan.carried, sb.tables.ft_clients.get("c1").data.plan.adjust];
  quiet();
}
{ const sb = makeSupabase(), p10 = { ...P10, startedOn: dayAgo(60), adjust: 8 }; delete p10.inPerson;   // the final check: the other device switches to 20 and back to 10 while a Change is open here
  app.reset(); app.set({ sb, signedIn: true, clientMode: false, backend: fns.cloudBackend, view: { name: "client", id: "c1" }, tab: "workouts" });
  sb.seed("ft_clients", TPL, tplRec); sb.seed("ft_clients", "c1", client(p10)); for (const t of marks) sb.seed("ft_trainings", t.id, t);
  await fns.syncDownNow(); await settle();
  tap("#planChange", "planChange"); tap(".step", "planPlus");
  const there = model.planSwitch(client(p10), P20, marks, fns.today()), back = model.planSwitch({ ...client(p10), plan: there.plan }, P10, marks, fns.today());
  sb.seed("ft_clients", "c1", { ...client(p10), plan: back.plan }); await fns.syncDownNow(); await settle();
  out.roundTrip = { synced: [card(), sessions()] }; tap("#planSave", "planSave"); await settle();
  const c = maps.clients.get("c1"); out.roundTrip.saved = [card(), sessions(), c.plan.adjust, c.plan.carried];
  quiet();
}
console.log(JSON.stringify(out));
process.exit(0);
