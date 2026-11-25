// Run by plan-until.test.js in its own process (v316, the twenty-third check round, R23-HND-3): Active until (#planUntil) on a client's card, the
// coach's view. A computer's date box fires change at every digit typed (measured in Chrome: 12/31/2026 typed over 12/01/2026 gave 2026-01-01,
// 2026-12-01, 2026-12-03, 2026-12-31, 0002-12-31, 0020-12-31, 0202-12-31, then 2026-12-31), and each in-between date was saved: for those seconds the
// server held a past date, and her phone read her plan as over. Now a date typed by keys lands once, as he leaves the box, presses Return or the page
// is hidden; one picked with no key (a phone's wheel, the box's calendar) lands at once; the plan's own date lands nothing.
// Started from plan-switch-probe.mjs (the box keeps its listeners; the real sync against fake-supabase; real timers) and alternatives-probe.mjs (the
// document's listeners kept with their phase; events sent as a browser sends them: capture on the document, the target's own, then the document's).
// A pause after a key waits for whatever save the app has queued (its half-second wait, then the server's answer), never a fixed time.
// Then the year half typed (12/31/20: the box holds 0020-12-31) and the box left: that saved 0020-12-31 (the card read "Ended Fri, Dec 31, 1920" and
// her plan was over until he finished the year); now it lands nothing, and the year finished lands once. Measured in Chrome 157 on a bare date box:
// a click away fires no change and keeps 0020-12-31, and a click back on the year starts it anew (2 gives 0002-12-31); after Return, or another tab
// in front (the page hidden), the box keeps the focus and fires nothing, and the year carries on (2 gives 0202-12-31, then 7 the whole date).
{ const now = new Date(), next = new Date(now); next.setHours(24, 0, 0, 0); const left = next - now; if (left < 60000) await new Promise((r) => setTimeout(r, left + 50)); }   // as the day-picker and cal-chips probes do: a run that would cross local midnight waits for it first (the card's words carry the year only off this year, so New Year's midnight mid-run changed them; v316, the twenty-fourth check round: +4 weeks and a package picked count from today, so any midnight mid-run changes their dates, and the run takes about 13 s: a minute, not 30 s; the twenty-fifth check round's cases make it about 25 s)
const env = await import("./env.js");
const { byId, el } = env;
const L = {};                                                              // the document's listeners, with their phase
document.addEventListener = (t, fn, o) => { (L[t] ||= []).push({ fn, capture: o === true || !!(o && o.capture) }); };
document.removeEventListener = (t, fn) => { const a = L[t] || []; const i = a.findIndex((x) => x.fn === fn); if (i >= 0) a.splice(i, 1); };
const keep = (id, tag) => { const e = el(tag); const H = {}; e.H = H; e.id = id; e.addEventListener = (t, fn) => { (H[t] ||= []).push(fn); }; e.removeEventListener = (t, fn) => { const a = H[t] || []; const i = a.indexOf(fn); if (i >= 0) a.splice(i, 1); }; byId.set(id, e); return e; };   // these keep their listeners
const box = keep("planUntil", "input"); box.type = "date";              // Active until
const cardName = keep("cardName", "h1"), plus4 = keep("planMonth", "button");   // where a click away lands (the card's name, as the finder's probe clicked); +4 weeks, where a second Tab goes
const planSel = keep("planSel", "select");                                // the Plan pop-up (v316, the twenty-fourth check round)
const phone = keep("cPhone", "input"), planCard = keep("planCard", "div"), noteSave = keep("noteSave", "button"), cNotes = keep("cNotes", "textarea");   // (the twenty-fifth check round) the card's Phone box; her page's plan card (Change, its steps, Save), Save note and its box
{ const wb = el(); wb.hidden = true; byId.set("whenBg", wb); const was = document.querySelector; document.querySelector = (sel) => (/sheet-bg|crop-view/.test(String(sel)) ? null : was(sel)); }   // no menu, sheet or photo framing up: held() is false, as on the card
globalThis.fetch = async () => { throw new Error("no network in this probe"); };
const { load } = await import("./load.js");
const { makeSupabase } = await import("./fake-supabase.js");
const { daysLater, fmtDay } = await import("../app/util.js");
const model = await import("../app/model.js");
const app = await load(); const { fns, maps } = app;
const $ = (id) => document.getElementById(id);

const T = fns.today(), OLD = daysLater(T, 7), IPAD = daysLater(T, 35), Y = String(Number(T.slice(0, 4)) + 1), NEW = Y + "-12-31";   // her plan runs a week more; he types the last day of next year (12, 31, then the year, as the finder typed 12/31/2026); his iPad's date for the last case
const [oy, , od] = OLD.split("-");
const KEYS = ["1", "2", "3", "1", ...Y];
const SHOWN = [oy + "-01-" + od, oy + "-12-" + od, oy + "-12-03", oy + "-12-31", "000" + Y[0] + "-12-31", "00" + Y.slice(0, 2) + "-12-31", "0" + Y.slice(0, 3) + "-12-31", NEW];   // the box's value after each key, as Chrome's mm/dd/yyyy box takes them from its month part (measured, verify-handler's vh5-until: the month 01 then 12, the day 03 then 31, the year 0002, 0020, 0202, then 2026)
const HALF = [0, 1, 2, 3, 4, 5].map((i) => [KEYS[i], SHOWN[i]]);           // 12, 31 and the year's first two digits: the box holds 12/31/20, 0020-12-31 (the year half typed)
const REST = [6, 7].map((i) => [KEYS[i], SHOWN[i]]);                      // the year carried on, the box still in focus after Return or the page hidden (measured: 0202-12-31, then the whole date)
const AGAIN = [4, 5, 6, 7].map((i) => [KEYS[i], SHOWN[i]]);               // the year typed anew after a click back on it (measured: 0002-12-31, 0020-12-31, 0202-12-31, then the whole date)
const errors = [], fired = [];
const fire = (target, type, extra = {}, bubbles = true) => {             // capture on the document, the target's own, then the document's (an event that bubbles, or one sent to the document itself); a listener that throws is recorded and the rest still run, as a browser does
  const ev = { type, target, isTrusted: true, detail: 1, button: 0, buttons: 0, pointerId: 1, pointerType: "mouse", isPrimary: true, clientX: 30, clientY: 30, timeStamp: performance.now(), ...extra, defaultPrevented: false, stopped: false, stoppedNow: false,
    preventDefault() { this.defaultPrevented = true; }, stopPropagation() { this.stopped = true; }, stopImmediatePropagation() { this.stopped = true; this.stoppedNow = true; },
    composedPath: () => (target === document ? [document, globalThis] : [target, document.body, document.documentElement, document, globalThis]) };
  const call = (fn, at) => { if (ev.stoppedNow) return; ev.currentTarget = at; try { fn(ev); } catch (e) { errors.push(type + ": " + String((e && e.stack) || e).split("\n").slice(0, 3).join(" | ")); } };
  const doc = L[type] || [];
  for (const l of doc.filter((x) => x.capture)) call(l.fn, document);
  if (target !== document && !ev.stopped) for (const fn of [...((target.H || {})[type] || [])]) call(fn, target);
  if ((bubbles || target === document) && !ev.stopped) for (const l of doc.filter((x) => !x.capture)) call(l.fn, document);
  return ev;
};
const focusTo = (to) => {                                                  // the focus moves: blur and focusout on what had it (the page's body already the active element, as in Chrome), then focus and focusin on what takes it (the body takes no focus event)
  const from = document.activeElement; if (from === to) return;
  document.activeElement = document.body;
  if (from && from !== document.body) { fire(from, "blur", {}, false); fire(from, "focusout"); }
  document.activeElement = to;
  if (to && to !== document.body) { fire(to, "focus", {}, false); fire(to, "focusin"); }
};
const press = (on, pointerType = "mouse", takesFocus = true) => {         // a click or a tap: the press, the focus (the box keeps it, or takes it; the card's words give it to the page), the release, the click
  fire(on, "pointerdown", { pointerType, buttons: 1 }); focusTo(takesFocus ? on : document.body); fire(on, "pointerup", { pointerType }); fire(on, "click", { pointerType });
};
const key = (k, shown, moveTo) => {                                       // one key on what has the focus: keydown; a digit's new value with its input and change, as Chrome sends them at every digit (none when the value stays); a Tab's move; keyup
  const code = /^\d$/.test(k) ? "Digit" + k : k, t = document.activeElement;
  fire(t, "keydown", { key: k, code, detail: 0 });
  if (shown !== undefined && shown !== t.value) { t.value = shown; fired.push(shown); fire(t, "input", { detail: 0 }); fire(t, "change", { detail: 0 }); }
  if (moveTo) focusTo(moveTo);
  fire(document.activeElement, "keyup", { key: k, code, detail: 0 });
};
const pick = (v) => { box.value = v; fired.push(v); fire(box, "input", { detail: 0 }); fire(box, "change", { detail: 0 }); };   // a phone's wheel or the box's calendar sets the date: input and change, with no key
const hide = () => { document.visibilityState = "hidden"; document.hidden = true; fire(document, "visibilitychange"); };   // Cmd-Tab, another app, the home screen: the box keeps the focus
const show = () => { document.visibilityState = "visible"; document.hidden = false; fire(document, "visibilitychange"); clearTimeout(app.get().syncTimer); };   // back: the sync it asks for 0.3 s later is run by the probe itself, when it needs one

const TPL = model.TEMPLATES_ID, PM = { id: "pm", name: "4-week plan", kind: "monthly", inPerson: true };
const PM2 = { id: "pm2", name: "Monthly plus", kind: "monthly", inPerson: true }, PS = { id: "ps", name: "10 sessions", kind: "sessions", size: 10, inPerson: true };   // (the twenty-fourth check round) another monthly package, and a session package
const tplRec = { id: TPL, name: "Templates", kind: "templates", templatesVersion: 999, builtinsAdopted: true, packages: [PM, PM2, PS] };
const mia = (until) => ({ id: "c1", name: "Mia Torres", email: "mia@example.com", unit: "lb", plan: { id: "pm", name: "4-week plan", kind: "monthly", startedOn: daysLater(T, -21), until } });
const tick = (ms) => new Promise((r) => setTimeout(r, ms));
const settle = async () => { const until = Date.now() + 15000; do await tick(5); while ((app.get().inflight > 0 || maps.timers.size) && Date.now() < until); };   // a pause: whatever save the app has queued goes out
const quiet = () => { for (const t of maps.timers.values()) clearTimeout(t); maps.timers.clear(); clearTimeout(app.get().syncTimer); };
const idOf = (l) => (l.payload && l.payload.id) || ((l.filters || []).find((f) => f[0] === "eq" && f[1] === "id") || [])[2];
const writes = (sb) => sb.log.filter((l) => l.table === "ft_clients" && /^(update|upsert|insert)$/.test(l.op) && idOf(l) === "c1").map((l) => (l.payload && l.payload.data && l.payload.data.plan ? l.payload.data.plan.until : null));   // every Active until sent for her, in order
const planOf = (rec) => (rec && rec.plan) || {};                          // (a client with no plan has none)
const state = (sb) => ({ value: box.value, here: planOf(maps.clients.get("c1")).until ?? null, touched: maps.planTouched.has("c1"), queued: maps.dirty.has("clients/c1"), waiting: maps.timers.has("clients/c1"), out: app.get().inflight, server: planOf(sb.tables.ft_clients.get("c1").data).until ?? null, writes: writes(sb), big: $("planBig").textContent, over: model.planOver(sb.tables.ft_clients.get("c1").data, [T]), focused: document.activeElement === box, row: !$("planUntilRow").hidden, planHere: planOf(maps.clients.get("c1")).id ?? null, planThere: planOf(sb.tables.ft_clients.get("c1").data).id ?? null });   // over: her phone, reading the server's copy today, reads her plan as over; row: the card shows its Active until row; the plan's package here and on the server
async function open(rec = mia(OLD)) {                                      // the coach's Mac, signed in: Mia's card open, her monthly plan running a week more (or the record given)
  quiet(); app.reset(); fns.leaveSettings(); document.activeElement = document.body; document.visibilityState = "visible"; document.hidden = false; box.value = ""; box.dataset = {};
  const sb = makeSupabase();
  app.set({ sb, signedIn: true, clientMode: false, backend: fns.cloudBackend, sessionEmail: "coach@example.com", view: { name: "client", id: "c1" }, tab: "workouts" });
  sb.seed("ft_clients", TPL, tplRec); sb.seed("ft_clients", "c1", rec);
  await fns.syncDownNow(); await settle();
  fns.render(); fns.showClientCard(); sb.log.length = 0; fired.length = 0;
  return sb;
}
async function type(sb, pairs = KEYS.map((k, i) => [k, SHOWN[i]])) {      // 12, 31, then the year (or the keys given, each with the box's value after it), a pause after each key: what was kept at once, and what was sent once the pause was over
  const keys = [];
  for (const [k, shown] of pairs) { key(k, shown); const now = state(sb); await settle(); const later = state(sb); keys.push({ shown: now.value, here: now.here, touched: now.touched, queued: now.queued, big: now.big, server: later.server, writes: later.writes.length }); }
  return keys;
}
const out = { today: T, OLD, NEW, IPAD, shown: SHOWN, words: { old: "Until " + fmtDay(OLD), new: "Until " + fmtDay(NEW), ipad: "Until " + fmtDay(IPAD) } };

{ const sb = await open(); const s = out.click = { before: state(sb) };   // (1) a click into the box, the date typed, a Tab (it stays in the box: Chrome's next stop is the box's own calendar button), then a click on the card's name
  press(box); s.focused = document.activeElement === box;
  s.keys = await type(sb); s.fired = fired.slice();
  key("Tab"); await settle(); s.tabbed = state(sb);
  press(cardName, "mouse", false); s.left = state(sb); await settle(); s.after = state(sb);
}
{ const sb = await open(); const s = out.tab = {};                       // (2) the date typed, then Tab twice: out of the box, to +4 weeks
  press(box); s.keys = await type(sb);
  key("Tab"); await settle(); s.tab1 = state(sb);
  key("Tab", undefined, plus4); s.left = state(sb); s.on = document.activeElement === plus4; await settle(); s.after = state(sb);
}
{ const sb = await open(); const s = out.back = {};                      // (3) the date typed, then Back with the box still in focus: the card goes, and the browser takes the focus from it (measured in Chrome, verify-handler's vh5c-back)
  press(box); s.keys = await type(sb); s.cardBefore = !$("vClientCard").hidden;
  await fns.goBackNow(); s.view = app.get().view; s.cardAfter = !$("vClientCard").hidden; focusTo(document.body); s.left = state(sb); await settle(); s.after = state(sb);
}
{ const sb = await open(); const s = out.enter = {};                     // (4) the date typed, then Return; then a click away
  press(box); s.keys = await type(sb);
  key("Enter"); s.entered = state(sb); await settle(); s.sent = state(sb);
  press(cardName, "mouse", false); await settle(); s.after = state(sb);
}
{ const sb = await open(); const s = out.hidden = {};                    // (5) the date typed, then the page hidden with the box still in focus; back, and a click away
  press(box); s.keys = await type(sb);
  hide(); s.hid = state(sb); await settle(); s.sent = state(sb);
  show(); await fns.syncDownNow(); await settle(); s.back = state(sb);
  press(cardName, "mouse", false); await settle(); s.after = state(sb);
}
{ const sb = await open(); const s = out.wheel = {};                     // (6) a phone: a tap on the box, and its wheel set to the date (no key); then Done (the box loses the focus)
  press(box, "touch"); pick(NEW); s.picked = state(sb); await settle(); s.sent = state(sb);
  focusTo(document.body); await settle(); s.after = state(sb);
}
{ const sb = await open(); const s = out.calendar = {};                  // (7) a computer: the month typed (12), then the box's calendar button clicked and a day picked in Chrome's calendar (its own clicks reach no page)
  press(box); key(KEYS[0], SHOWN[0]); key(KEYS[1], SHOWN[1]); await settle(); s.typed = state(sb);
  press(box); pick(NEW); s.picked = state(sb); await settle(); s.sent = state(sb);
  press(cardName, "mouse", false); await settle(); s.after = state(sb);
}
{ const sb = await open(); const s = out.same = {};                      // (8) the plan's own date: his iPad extended her plan (the server has it, this Mac has not read it yet); here the box is clicked into and left three ways, its date unchanged
  sb.seed("ft_clients", "c1", mia(IPAD)); sb.log.length = 0;
  press(box); press(cardName, "mouse", false); await settle(); s.clickOut = state(sb);
  press(box); key("Enter"); await settle(); s.enter = state(sb); press(cardName, "mouse", false); await settle();
  press(box); hide(); await settle(); s.hidden = state(sb); show(); press(cardName, "mouse", false); await settle();
  await fns.syncDownNow(); await settle(); s.synced = state(sb);
}
{ const sb = await open(); const s = out.midClick = {};                  // (9) the year half typed (12/31/20), then a click on the card's name; back in with a click on the year (it starts anew), the year typed whole, and a click away
  press(box); s.half = await type(sb, HALF); s.typed = state(sb);
  press(cardName, "mouse", false); s.left = state(sb); await settle(); s.after = state(sb);
  press(box); s.rest = await type(sb, AGAIN); s.finished = state(sb);
  press(cardName, "mouse", false); s.left2 = state(sb); await settle(); s.after2 = state(sb); s.fired = fired.slice();
}
{ const sb = await open(); const s = out.midEnter = {};                  // (10) the year half typed, then Return (the box keeps the focus); the year carried on to its end, and a click away
  press(box); s.half = await type(sb, HALF); s.typed = state(sb);
  key("Enter"); s.left = state(sb); await settle(); s.after = state(sb);
  s.rest = await type(sb, REST); s.finished = state(sb);
  press(cardName, "mouse", false); s.left2 = state(sb); await settle(); s.after2 = state(sb); s.fired = fired.slice();
}
{ const sb = await open(); const s = out.midHidden = {};                 // (11) the year half typed, then the page hidden with the box in focus (another tab in front); back on the page and its sync, the year carried on to its end, and a click away
  press(box); s.half = await type(sb, HALF); s.typed = state(sb);
  hide(); s.left = state(sb); await settle(); s.after = state(sb);
  show(); await fns.syncDownNow(); await settle(); s.back = state(sb);
  s.rest = await type(sb, REST); s.finished = state(sb);
  press(cardName, "mouse", false); s.left2 = state(sb); await settle(); s.after2 = state(sb); s.fired = fired.slice();
}

// v316, the twenty-fourth check round. R24-HND-1: the box's old date was written when the plan's date changed under it. +4 weeks was saved while the box
// kept the date it was drawn with (nothing drew the card again until the next sync, up to a minute: R24-HND-2), and a tap or click into the box and away
// wrote that date back: +4 weeks undone here and on the server, her phone on Plan ended, the bar saying Saved. The same when his iPad's date landed by a
// sync while the box had the focus (a box in focus is never drawn again): a click away, Return, Tab, Back or the page hidden wrote this Mac's older date
// over it. Now +4 weeks and the Plan pop-up draw the card's plan at once, and a box left with the date it was drawn with writes nothing.
// R24-TW-3: "never a year before 2000" was tested only below 1000 (the half-typed years): a phone's wheel turned to 1999, and 1987 typed for 2027.
const ENDED = daysLater(T, -3), PLUS = daysLater(T, 28), PLUS2 = daysLater(PLUS, 28), RUN = daysLater(OLD, 28);   // her plan ended three days ago (her phone says Plan ended): +4 weeks counts from today, a second press four weeks more; a plan still running goes on from its own day
const noPlan = () => { const c = mia(OLD); delete c.plan; return c; };    // a client with no plan yet (Plan: None)
const choose = (id) => { press(planSel); planSel.value = id; fire(planSel, "input"); fire(planSel, "change"); };   // the Plan pop-up: a click on it, then a package picked in its menu (input and change; the pop-up keeps the focus)
const leave = async (how) => {                                             // the box left with nothing typed: a click on the card's name; Return (the box keeps the focus); Tab, then Tab again (the first stays in Chrome's date box, the second goes on to +4 weeks); Back (the card goes and the browser takes the focus from the box); the page hidden (the box keeps the focus)
  if (how === "click") press(cardName, "mouse", false);
  else if (how === "enter") key("Enter");
  else if (how === "tab") { key("Tab"); key("Tab", undefined, plus4); }
  else if (how === "back") { await fns.goBackNow(); focusTo(document.body); }
  else if (how === "hidden") hide();
};
const yearTyped = (y) => [...[0, 1, 2, 3].map((i) => [KEYS[i], SHOWN[i]]), ...[1, 2, 3, 4].map((n) => [y[n - 1], y.slice(0, n).padStart(4, "0") + "-12-31"])];   // 12, 31, then the year y digit by digit, each key with the box's value after it (1987: 0001-12-31, 0019-12-31, 0198-12-31, then 1987-12-31)
out.r24 = { ENDED, PLUS, PLUS2, RUN, words: { ended: "Ended " + fmtDay(ENDED), plus: "Until " + fmtDay(PLUS), run: "Until " + fmtDay(RUN), ipad: "Until " + fmtDay(IPAD), dec2000: "Ended " + fmtDay("2000-12-31"), jan2000: "Ended " + fmtDay("2000-01-01") } };
{ const sb = await open(mia(ENDED)); const s = out.plus4 = { before: state(sb) };   // (12) her plan ended three days ago: +4 weeks clicked on her card, its save lands; then a click into Active until and a click away, nothing picked
  press(plus4); s.pressed = state(sb); await settle(); s.saved = state(sb);
  press(box); s.inBox = state(sb); press(cardName, "mouse", false); s.left = state(sb); await settle(); s.after = state(sb);
}
{ const sb = await open(mia(ENDED)); const s = out.plus4Tap = {};        // (13) the same on a phone: a tap on +4 weeks, then a tap on the box (its wheel comes up) and a tap away, nothing picked
  press(plus4, "touch"); s.pressed = state(sb); await settle(); s.saved = state(sb);
  press(box, "touch"); s.inBox = state(sb); press(cardName, "touch", false); s.left = state(sb); await settle(); s.after = state(sb);
}
{ const sb = await open(mia(ENDED)); const s = out.plus4Out = {};        // (14) one bar of signal (the server answers 0.4 s after each call): +4 weeks tapped, then the box tapped into and away while that save is on its way
  sb.delayMs = 400; press(plus4, "touch"); s.pressed = state(sb);
  { const until = Date.now() + 15000; while (maps.timers.has("clients/c1") && Date.now() < until) await tick(5); }   // until the save's half-second wait is over and it has gone out
  press(box, "touch"); press(cardName, "touch", false); s.left = state(sb); await settle(); s.after = state(sb);
}
{ const sb = await open(); const s = out.plus4Run = {};                  // (15) her plan still running (a week more): +4 weeks goes on from its day; then a click into the box and away
  press(plus4); s.pressed = state(sb); await settle(); s.saved = state(sb);
  press(box); press(cardName, "mouse", false); await settle(); s.after = state(sb);
}
{ const sb = await open(mia(ENDED)); const s = out.twice = {};           // (16) +4 weeks pressed twice: what the box shows after each press
  press(plus4); s.first = state(sb); await settle(); press(plus4); s.second = state(sb); await settle(); s.after = state(sb);
}
{ const sb = await open(mia(ENDED)); const s = out.switchMonthly = {};   // (17) the Plan pop-up: another monthly package (it starts today, for four weeks); then a click into the box and away, nothing picked
  choose("pm2"); s.switched = state(sb); await settle(); s.saved = state(sb);
  press(box); press(cardName, "mouse", false); await settle(); s.after = state(sb);
}
for (const [name, id] of [["switchNone", ""], ["switchSessions", "ps"]]) {   // (18, 19) the Plan pop-up: None, or a session package (neither has an end day)
  const sb = await open(); const s = out[name] = { before: state(sb) };
  choose(id); s.switched = state(sb); await settle(); s.saved = state(sb);
}
{ const sb = await open(noPlan()); const s = out.switchFromNone = { before: state(sb) };   // (20) no plan yet: the Plan pop-up, a monthly package; then a click into the box and away, nothing picked
  choose("pm"); s.switched = state(sb); await settle(); s.saved = state(sb);
  press(box); press(cardName, "mouse", false); await settle(); s.after = state(sb);
}
for (const how of ["click", "enter", "tab", "back", "hidden"]) {          // (21-25) the box clicked into, nothing typed; his iPad's +4 weeks reaches the server and this Mac's sync lands while the box has the focus; then the box left
  const sb = await open(); const s = out["ipad_" + how] = {};
  press(box); s.inBox = state(sb);
  sb.seed("ft_clients", "c1", mia(IPAD)); sb.log.length = 0;
  await fns.syncDownNow(); await settle(); s.synced = state(sb);
  await leave(how); s.left = state(sb); s.on = document.activeElement === plus4; s.card = !$("vClientCard").hidden; await settle(); s.after = state(sb);
  if (how === "hidden") show();
  if (how === "enter" || how === "hidden") { press(cardName, "mouse", false); await settle(); s.away = state(sb); }   // the box kept the focus: then a click away
  await fns.syncDownNow(); await settle(); s.next = state(sb);            // and the next sync
}
for (const how of ["pick", "type"]) {                                      // (26, 27) the same sync under the box in focus, then a date he picks there (no key) or types (12, 31, next year), and a click away
  const sb = await open(); const s = out["ipadThen_" + how] = {};
  press(box); sb.seed("ft_clients", "c1", mia(IPAD)); sb.log.length = 0; await fns.syncDownNow(); await settle(); s.synced = state(sb);
  if (how === "pick") { pick(NEW); s.picked = state(sb); await settle(); s.sent = state(sb); } else s.keys = await type(sb);
  press(cardName, "mouse", false); s.left = state(sb); await settle(); s.after = state(sb);
}
{ const sb = await open(); const s = out.wheel1999 = {};                 // (28) a phone's wheel turned to Dec 31, 1999 (no key), then Done
  press(box, "touch"); pick("1999-12-31"); s.picked = state(sb); await settle(); s.sent = state(sb);
  focusTo(document.body); await settle(); s.after = state(sb);
}
{ const sb = await open(); const s = out.typed1987 = {};                 // (29) a computer: 12, 31, then 1987 typed (a slip for 2027), then a click away
  press(box); s.keys = await type(sb, yearTyped("1987")); s.typed = state(sb); s.fired = fired.slice();
  press(cardName, "mouse", false); s.left = state(sb); await settle(); s.after = state(sb);
}
{ const sb = await open(); const s = out.wheel2000 = {};                 // (30) the first year taken: Jan 1, 2000 on a phone's wheel, then Done
  press(box, "touch"); pick("2000-01-01"); s.picked = state(sb); await settle(); s.sent = state(sb);
  focusTo(document.body); await settle(); s.after = state(sb);
}
{ const sb = await open(); const s = out.typed2000 = {};                 // (31) and typed on a computer: 12, 31, then 2000, then a click away
  press(box); s.keys = await type(sb, yearTyped("2000")); s.typed = state(sb);
  press(cardName, "mouse", false); s.left = state(sb); await settle(); s.after = state(sb);
}

// v316, the twenty-fifth check round. R25-HND-1: a save of hers from this Mac meets his iPad's newer copy, and the merge (the owner's pick "Each detail
// separately") takes the iPad's plan into her record: its switch to Monthly plus or its None beats the date he picked here, and its +4 weeks comes in
// with a save of anything else on her card (her phone typed). Nothing drew the card or her page again: Plan and Active until kept this Mac's package
// and date beside Saved (her page its old plan card) for up to a minute, and +4 weeks then counted from a date the box did not show. Now the merge
// draws the card's plan, or her page, at once. R25-HND-2: the iPad's change landing by a sync while Active until had the focus (nothing typed) stayed
// out of the box after he left it, its old date beside the new package's name; a box left as it was drawn now shows the plan's date (a half-typed
// year still stays for him to finish: R23-HND-3's tests). R25-TW-12: a date typed back to the one the box was drawn with, after a slip was saved,
// had no behaviour test (untilPut's dataset.shown, held only by a source-text pin).
const PICK = daysLater(T, 21), PM2_UNTIL = daysLater(T, 28);              // the date he picks here; Monthly plus picked on the iPad today runs four weeks from today
const ipadSaves = (sb, change) => { const cur = JSON.parse(JSON.stringify(sb.tables.ft_clients.get("c1").data)); change(cur); sb.seed("ft_clients", "c1", cur); sb.log.length = 0; };   // his iPad's save of her record reached the server (stamped newer); this Mac has not read it yet
const ipadPlan = (to) => (c) => { const pk = to ? tplRec.packages.find((p) => p.id === to) : null, sw = model.planSwitch(c, pk, [], T); if (sw.planHistory) { if (sw.planHistory.length) c.planHistory = sw.planHistory; else delete c.planHistory; } if (sw.plan) c.plan = sw.plan; else delete c.plan; };   // the iPad's Plan pop-up: another package, or None (as the pop-up's own change handler switches)
const ipadPlus4 = (c) => { c.plan.until = daysLater(c.plan.until > T ? c.plan.until : T, 28); };   // the iPad's +4 weeks
const card25 = (sb) => ({ ...state(sb), sel: planSel.value, shown: box.dataset.shown ?? null });   // the card as he sees it, with the Plan pop-up's package and the date Active until was drawn with
const page25 = (sb) => ({ name: $("planName").textContent, big: $("planBig").textContent, kicker: $("pausedKicker").hidden ? "" : $("pausedKicker").textContent, here: planOf(maps.clients.get("c1")).id ?? null, server: planOf(sb.tables.ft_clients.get("c1").data).id ?? null, until: planOf(sb.tables.ft_clients.get("c1").data).until ?? null, bar: $("status").textContent });   // her page's plan card (and the line over her page), what her record and the server hold
const onPart = (sel, id = "") => ({ closest: (q) => (q === sel ? { id } : null) });   // a click on one part of her plan card
out.r25 = { PICK, PM2_UNTIL, words: { pm2: "Until " + fmtDay(PM2_UNTIL), ipad: "Until " + fmtDay(IPAD), ended: "Ended " + fmtDay(ENDED), ipadEnded: "Until " + fmtDay(daysLater(T, 28)) } };
for (const [name, to, how] of [["r25_switchWheel", "pm2", "touch"], ["r25_switchCalendar", "pm2", "mouse"], ["r25_noneWheel", null, "touch"], ["r25_noneCalendar", null, "mouse"]]) {   // (32-35) the iPad switches her to Monthly plus (or to None); within the minute, before this Mac's next sync, he picks a date in Active until here: a phone's wheel, then Done, or the box's calendar, then a click away; once his save has landed, +4 weeks
  const sb = await open(); const s = out[name] = {};
  ipadSaves(sb, ipadPlan(to));
  press(box, how); pick(PICK); s.picked = card25(sb);
  if (how === "touch") focusTo(document.body); else press(cardName, "mouse", false);
  await settle(); s.saved = card25(sb);
  press(plus4); s.plus = card25(sb); await settle(); s.plusSaved = card25(sb);
}
{ const sb = await open(); const s = out.r25_phone = {};                  // (36) the older way: the iPad's +4 weeks on the server; here, within the minute, he types her phone number on the card (that save takes her plan from the iPad's copy); a click away, then +4 weeks
  ipadSaves(sb, ipadPlus4);
  press(phone); phone.value = "(310) 555-0142"; fire(phone, "input"); s.typed = card25(sb);
  await settle(); s.saved = card25(sb);
  press(cardName, "mouse", false); s.left = card25(sb);
  press(plus4); s.plus = card25(sb); await settle(); s.plusSaved = card25(sb);
}
{ const sess = mia(OLD); sess.plan = { id: "ps", name: "10 sessions", kind: "sessions", size: 10, startedOn: daysLater(T, -10), adjust: 0 };   // (37) her page, no card open: a session plan; the iPad switches her to Monthly plus; here Change, +1 and Save on her plan card (that save takes the iPad's switch)
  const sb = await open(sess); fns.leaveSettings(); app.set({ view: { name: "client", id: "c1" }, tab: "workouts" }); fns.render(); const s = out.r25_pageAdjust = { before: page25(sb) };
  ipadSaves(sb, ipadPlan("pm2"));
  fire(planCard, "click", { target: onPart("#planChange") }); fire(planCard, "click", { target: onPart(".step", "planPlus") }); fire(planCard, "click", { target: onPart("#planSave") }); s.pressed = page25(sb);
  await settle(); s.saved = page25(sb);
}
{ const sb = await open(mia(ENDED)); fns.leaveSettings(); app.set({ view: { name: "client", id: "c1" }, tab: "notes" }); fns.render(); const s = out.r25_pageNote = { before: page25(sb) };   // (38) her page: her plan ended three days ago; the iPad's +4 weeks on the server; here a note saved on her Notes tab (that save takes the iPad's date)
  ipadSaves(sb, ipadPlus4);
  cNotes.value = "Knee felt better today"; fire(noteSave, "click"); s.pressed = page25(sb);
  await settle(); s.saved = page25(sb);
}
for (const [name, change] of [["r25_focusDate", ipadPlus4], ["r25_focusSwitch", ipadPlan("pm2")]]) {   // (39, 40) Active until clicked into, nothing typed; the iPad's +4 weeks (or its switch to Monthly plus) lands by a sync while the box has the focus; then a click away, and +4 weeks
  const sb = await open(); const s = out[name] = {};
  press(box); ipadSaves(sb, change); await fns.syncDownNow(); await settle(); s.synced = card25(sb);
  press(cardName, "mouse", false); s.left = card25(sb); await settle(); s.after = card25(sb);
  press(plus4); s.plus = card25(sb); await settle(); s.plusSaved = card25(sb);
}
{ const sb = await open(); const s = out.r25_mergeFocused = {};           // (41) both: the iPad's switch on the server; a date picked on a phone's wheel, the box keeping the focus as his save lands and merges the switch; then Done
  ipadSaves(sb, ipadPlan("pm2")); press(box, "touch"); pick(PICK); await settle(); s.saved = card25(sb);
  focusTo(document.body); s.left = card25(sb); await settle(); s.after = card25(sb);
}
{ const sb = await open(); const s = out.r25_otherClient = {};           // (44) Mia's card open; Omar's save from a moment before (his phone typed on his card) meets the iPad's switch of his plan to Monthly plus: Mia's card stays hers
  sb.seed("ft_clients", "c2", { ...mia(OLD), id: "c2", name: "Omar Reyes", email: "omar@example.com" }); await fns.syncDownNow(); await settle(); s.before = card25(sb);
  { const cur = JSON.parse(JSON.stringify(sb.tables.ft_clients.get("c2").data)); ipadPlan("pm2")(cur); sb.seed("ft_clients", "c2", cur); sb.log.length = 0; }
  maps.clients.get("c2").phone = "3105550111"; fns.scheduleSave("clients", "c2"); await settle();
  s.saved = { ...card25(sb), omarHere: planOf(maps.clients.get("c2")).id ?? null, omarThere: planOf(sb.tables.ft_clients.get("c2").data).id ?? null };
}
for (const how of ["typed", "picked"]) {                                  // (42, 43) next year's Dec 31 typed and Return: it lands; the slip seen, her old date put back, typed (its keys land nothing) then Return, or picked in the box's calendar; then a click away
  const sb = await open(); const s = out["r25_back_" + how] = {};
  press(box); await type(sb); key("Enter"); await settle(); s.first = card25(sb);
  if (how === "typed") { key("1", OLD); key("Enter"); } else { press(box); pick(OLD); }
  await settle(); s.back = card25(sb);
  press(cardName, "mouse", false); await settle(); s.left = card25(sb);
}
quiet();
out.errors = errors;
console.log(JSON.stringify(out));
process.exit(0);
