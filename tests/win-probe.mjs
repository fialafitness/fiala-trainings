// One window at a time (v316, app/win.js): windows of one browser on a stand-in lock manager, message channel and clock, each window its own copy
// of win.js (a module per window, as each tab loads its own). Prints one JSON line of what each scenario saw; tests/win.test.js reads it.
// The stand-ins follow the Web Locks and BroadcastChannel specs as the research of 19 Nov 2026 read them: ifAvailable never waits; steal is granted
// at once and the holder's request rejects with an AbortError, which the holder hears when it runs next (v316, the twenty-sixth check round: a
// window asleep or busy hears it once it wakes, after what was queued for it before); a plain request waits in order (a signal gives it up); query()
// lists the holders with their client ids, as they are now; a message reaches every other window of the same name, later, never the sender; a
// window asleep gets its messages and its timers only when it wakes; a window closed lets its locks go. A window opened with lag (Chrome, measured
// in the twenty-sixth check round) reads its own copy of the device's storage, which hears another window's writes later, as a task of its own.
// (v321, the twenty-seventh round) A window opened with grantLag gets its lock grants as tasks of its own, that many ms later (the lock manager is
// another process: a message can arrive first); one opened with typePx has the hidden Text Size probe (#typeProbe) in the system font at that size;
// every window notes the times of its 2 s checks (ticks). The scenarios after 16 write keys of their own (tests/win-lock-r27.test.js reads them).
const out = {};
let T = 0; const timers = [];                                   // the one clock: every window's timers on it
const at = (ms, fn, win) => { const t = { at: T + Math.max(0, ms), fn, win, id: timers.length + 1, live: true }; timers.push(t); return t; };
const flush = async () => { for (let i = 0; i < 30; i++) await Promise.resolve(); await new Promise((r) => setImmediate(r)); for (let i = 0; i < 30; i++) await Promise.resolve(); };
async function advance(ms) {                                     // runs every timer due within ms, in order, the promises between them
  const end = T + ms;
  for (;;) {
    await flush();
    const due = timers.filter((t) => t.live && t.at <= end && !(t.win && (t.win.asleep || t.win.closed))).sort((a, b) => a.at - b.at || a.id - b.id)[0];
    if (!due) break;
    due.live = false; T = Math.max(T, due.at); try { due.fn(); } catch (e) { out.errors = (out.errors || []).concat(String(e && e.stack || e)); }
  }
  T = end; await flush();
}
const abort = (m) => Object.assign(new Error(m || "aborted"), { name: "AbortError" });
const locks = (() => {                                            // one lock manager for the browser
  const held = new Map(), queues = new Map(), q = (n) => { if (!queues.has(n)) queues.set(n, []); return queues.get(n); };
  const release = (req) => { if (held.get(req.name) !== req) return; held.delete(req.name); const next = q(req.name).shift(); if (next) grant(next); };
  function grant(req) {
    held.set(req.name, req); let r;
    try { r = req.cb({ name: req.name, mode: "exclusive" }); } catch (e) { release(req); req.reject(e); return; }
    Promise.resolve(r).then((v) => { release(req); req.resolve(v); }, (e) => { release(req); req.reject(e); });
  }
  const forClient = (win) => ({
    request(name, opts, cb) {
      if (typeof opts === "function") { cb = opts; opts = {}; }
      if (win.refuse) throw Object.assign(new Error("refused"), { name: "SecurityError" });
      if (win.grantLag) { const cb0 = cb; cb = (lock) => new Promise((ok, no) => at(win.grantLag, () => { try { ok(cb0(lock)); } catch (e) { no(e); } }, win)); }   // (v321) the grant reaches the page as a task of its own
      return new Promise((resolve, reject) => {
        const req = { name, opts, cb, resolve, reject, win };
        if (opts.steal) { const h = held.get(name); if (h) { held.delete(name); at(0, () => h.reject(abort("Lock was stolen by another request")), h.win); } grant(req); return; }   // the holder hears of the steal when it runs next
        if (opts.ifAvailable) { if (held.has(name) || q(name).length) { Promise.resolve().then(() => cb(null)).then(resolve, reject); return; } grant(req); return; }
        if (opts.signal) { if (opts.signal.aborted) { reject(abort()); return; } opts.signal.addEventListener("abort", () => { const l = q(name), i = l.indexOf(req); if (i >= 0) { l.splice(i, 1); reject(abort()); } }); }
        if (!held.has(name)) grant(req); else q(name).push(req);
      });
    },
    async query() { return { held: [...held.values()].map((r) => ({ name: r.name, mode: "exclusive", clientId: r.win.client })), pending: [...queues.values()].flat().map((r) => ({ name: r.name, mode: "exclusive", clientId: r.win.client })) }; },
  });
  const closeWin = (win) => { for (const r of [...held.values()]) if (r.win === win) { release(r); } for (const l of queues.values()) for (let i = l.length - 1; i >= 0; i--) if (l[i].win === win) l.splice(i, 1); };
  const dropAll = (win) => { for (const r of [...held.values()]) if (r.win === win) { held.delete(r.name); at(0, () => r.reject(abort("Promise was rejected because the browsing context is going away")), win); const next = q(r.name).shift(); if (next) grant(next); } };   // Safari 26: the back/forward cache lets the page's locks go, and the page hears of it only when it runs again
  return { forClient, closeWin, dropAll, held: () => [...held.values()].map((r) => r.win.name + ":" + r.name) };
})();
const chans = new Set();
const channelFor = (win) => class {                               // BroadcastChannel: to every other window's channel of the same name, later
  constructor(name) { this.name = name; this.win = win; this.onmessage = null; chans.add(this); }
  postMessage(data) { const copy = JSON.parse(JSON.stringify(data)); for (const c of chans) if (c !== this && c.name === this.name && !c.closed && !c.win.closed && c.win !== this.win) at(1, () => { if (c.onmessage && !c.closed) c.onmessage({ data: copy }); }, c.win); }
  close() { this.closed = true; chans.delete(this); }
};
const store = new Map(), laggers = new Set();                   // the device's storage; the windows whose own copy of it hears other windows' writes late
const spread = (from, k, v) => { for (const w of laggers) if (w !== from && !w.closed) at(0, () => { if (v === null) w.seen.delete(k); else w.seen.set(k, v); }, w); };   // another window's write reaches a lagging window as a task of its own, after those queued before it (Chrome: a "yield" waiting behind a long task runs first)
const ls = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => { store.set(k, String(v)); spread(null, k, String(v)); }, removeItem: (k) => { store.delete(k); spread(null, k, null); } };
const lsOf = (win) => ({ getItem: (k) => (win.seen.has(k) ? win.seen.get(k) : null), setItem: (k, v) => { v = String(v); win.seen.set(k, v); store.set(k, v); spread(win, k, v); }, removeItem: (k) => { win.seen.delete(k); store.delete(k); spread(win, k, null); } });
let n = 0;
async function openWin(name, { visible = true, url = "https://app.example/", locksOff = false, refuse = false, lag = false, grantLag = 0, typePx, start } = {}) {   // a window: its page, its copy of win.js, its own listeners
  const win = { name, client: "client-" + name, asleep: false, closed: false, refuse, grantLag, typePx, started: 0, went: [], ticks: [], listeners: new Map() };
  if (lag) { win.seen = new Map(store); laggers.add(win); } win.ls = lag ? lsOf(win) : ls;
  const on = (t, f) => { if (!win.listeners.has(t)) win.listeners.set(t, []); win.listeners.get(t).push(f); };
  win.fire = (t, e = {}) => { for (const f of win.listeners.get(t) || []) f(e); };
  const el = (props = {}) => ({ hidden: false, disabled: false, textContent: "", inert: false, tagName: "DIV", listeners: {}, addEventListener(t, f) { this.listeners[t] = f; }, ...props });
  const els = { oneWin: el({ hidden: true }), owUse: el(), owMoving: el() }; if (typePx !== undefined) els.typeProbe = el({ tagName: "SPAN" });
  const header = el({ tagName: "HEADER" }), main = el({ tagName: "MAIN" }), cls = new Set();
  const doc = { visibilityState: visible ? "visible" : "hidden", addEventListener: on, getElementById: (id) => els[id] || null, body: { classList: { add: (c) => cls.add(c), remove: (c) => cls.delete(c), contains: (c) => cls.has(c) }, children: [header, main, els.oneWin] } };
  if (typePx !== undefined) doc.documentElement = { style: { fontSize: "" } };   // the root's own size, as main.js's fitText and win.js's fitRoot set it
  const loc = { href: url, get hash() { return new URL(this.href).hash; } };
  const hist = { state: null, replaceState: (s, t, u) => { loc.href = new URL(u, loc.href).href; } };
  Object.assign(win, { els, doc, loc, main, header });
  const mod = await import("../app/win.js?w=" + name + "-" + ++n);
  win.mod = mod;
  if (!start) {   // (v321: a page run by its own loader, start, has none: main.js fills them as it loads)
    mod.winHooks.handOver = async () => { win.handed = (win.handed || 0) + 1; };
    mod.winHooks.lose = () => { win.lostHook = (win.lostHook || 0) + 1; };
    mod.winHooks.hidden = () => { win.hiddenHook = (win.hiddenHook || 0) + 1; };
    mod.winHooks.shown = () => { win.shownHook = (win.shownHook || 0) + 1; };
  }
  const env = {
    locks: locksOff ? null : locks.forClient(win), Channel: channelFor(win), ls: win.ls, doc, win: { addEventListener: on }, loc, hist,
    now: () => T, clock: () => 1795600000000 + T, setT: (f, ms) => at(ms, f, win), clearT: (t) => { if (t) t.live = false; },
    setI: (f, ms) => { const tick = { live: true }; const go = () => { if (!tick.live) return; tick.t = at(ms, () => { if (!tick.live) return; win.ticks.push(T); f(); go(); }, win); }; go(); return tick; }, clearI: (tick) => { if (tick) { tick.live = false; if (tick.t) tick.t.live = false; } },
    Abort: AbortController, go: (u) => { win.went.push(u || "reload"); },
  };
  if (typePx !== undefined) env.win.getComputedStyle = (e) => ({ fontSize: e === els.typeProbe && win.typePx != null ? win.typePx + "px" : "" });   // the system font's size at the phone's Text Size
  if (start) start(mod, env, win); else mod.oneWindow(() => { win.started++; }, env);   // (v321) start: the page's own loader instead (index.html's module script)
  return win;
}
const show = (win, vis) => { win.doc.visibilityState = vis ? "visible" : "hidden"; win.fire("visibilitychange"); };
const close = (win) => { win.fire("pagehide", { persisted: false }); win.closed = true; laggers.delete(win); locks.closeWin(win); for (const c of [...chans]) if (c.win === win) c.close(); };
const st = (win) => ({ ...win.mod.winState(), startedCalls: win.started, cover: !win.els.oneWin.hidden, moving: win.els.owMoving.textContent, useDisabled: win.els.owUse.disabled, went: win.went.slice(), lostHook: win.lostHook || 0, handed: win.handed || 0, lost: win.mod.winLost() });
const rec = () => JSON.parse(store.get("fiala.window") || "null");
const reset = () => { store.clear(); laggers.clear(); for (const c of [...chans]) c.close(); for (const t of timers) t.live = false; };

// 1. One window: Fiala opens at once, the lock and the record are its
{ reset(); const a = await openWin("a1"); await advance(10);
  out.one = { a: st(a), rec: rec() && rec().tab === a.mod.winTab(), vis: rec() && rec().vis, held: locks.held() }; close(a); await advance(10); }
// 2. A second window while the first runs and answers: the page, nothing started; the first untouched
{ reset(); const a = await openWin("a2"); await advance(10); show(a, false);
  const b = await openWin("b2"); await advance(400); const mid = st(b); await advance(600);
  out.second = { duringAsk: { cover: mid.cover, started: mid.startedCalls }, b: st(b), a: st(a), recA: rec().tab === a.mod.winTab(), bodyClass: b.doc.body.classList.contains("ow-on"), inert: b.main.inert };
  // Use here: the first hands over (its hook), loses, shows the page; the second starts
  b.els.owUse.listeners.click(); await advance(1); const moving = st(b);
  await advance(50);
  out.useHere = { moving: { text: moving.moving, disabled: moving.useDisabled }, b: st(b), a: st(a), recB: rec().tab === b.mod.winTab(), aWrites: a.mod.winLost() };
  // Close the second (in use): the first, a page that ran Fiala before, starts again only when it is seen (a reload), after the 2.5 s pause
  close(b); await advance(2000); const early = st(a); show(a, true); await advance(4000);
  out.closeOther = { early: early.went.length, a: st(a) };
  close(a); await advance(10); }
// 3. The window in use asleep (a phone tab in the background): a new window takes Fiala after 0.8 s with no page; the sleeper, woken, has lost it
{ reset(); const a = await openWin("a3"); await advance(10); show(a, false); a.asleep = true;
  const b = await openWin("b3"); await advance(700); const mid = st(b); await advance(300);
  out.asleep = { mid: { cover: mid.cover, started: mid.startedCalls }, b: st(b), recB: rec().tab === b.mod.winTab() };
  a.asleep = false; await advance(5); const aWrite = a.mod.winLost(); await advance(50); show(a, true); await advance(50);
  out.asleep.a = st(a); out.asleep.aFirstWrite = aWrite;
  close(a); close(b); await advance(10); }
// 4. The window in use on screen but busy (no answer, its record says visible): the page, never taken quietly; Use here then takes it after 0.8 s
{ reset(); const a = await openWin("a4"); await advance(10); a.asleep = true;   // busy: on screen (its record says so) and not answering
  const b = await openWin("b4"); await advance(1500);
  out.busy = { b: st(b) };
  b.els.owUse.listeners.click(); await advance(900);
  out.busy.afterUse = st(b); a.asleep = false; await advance(20); out.busy.a = st(a);
  close(a); close(b); await advance(10); }
// 4b. (v316, the twenty-sixth check round, R26-WIN-1) The same busy window, in Chrome: its copy of the device's storage hears the new window's writes
// only after the "yield" that waited behind its long task, so as that task ends its copy of the record still names it. Its hand-over (main.js's
// keeps and stores the queue, each write asking winLost() first: as here) must not run: the lock's own registry says another window holds it.
{ reset(); const a = await openWin("a4b", { lag: true }); await advance(10);
  a.mod.winHooks.handOver = async () => { a.handed = (a.handed || 0) + 1; if (!a.mod.winLost()) a.ls.setItem("fiala.pending.v1", "A's queue: 135, unsent"); };
  a.asleep = true;                                                // busy on screen: its record says visible, and it answers nothing
  const b = await openWin("b4b"); await advance(1500); const bPage = st(b).cover;
  b.els.owUse.listeners.click(); await advance(900); const bTook = st(b);
  b.ls.setItem("fiala.pending.v1", "B's queue: 140");             // the coach's change in B, stored with B's queue
  const staleAtWake = JSON.parse(a.seen.get("fiala.window")).tab === a.mod.winTab();
  a.asleep = false; await advance(50);                            // the long task ends: the yield waiting behind it runs first
  out.busyYield = { bPage, bTook, staleAtWake, aHanded: a.handed || 0, queue: store.get("fiala.pending.v1"), recB: rec().tab === b.mod.winTab(), a: st(a), b: st(b), aSeesB: JSON.parse(a.seen.get("fiala.window")).tab === b.mod.winTab() };
  close(a); close(b); await advance(10); }
// 5. A reload of the window in use while another shows the page: the other never takes Fiala in the gap (the 2.5 s pause), the reloaded page does
{ reset(); const a = await openWin("a5"); await advance(10); show(a, false);
  const b = await openWin("b5"); await advance(1000);
  close(a); await advance(300); const a2 = await openWin("a5r"); await advance(50); await advance(5000);
  out.reload = { a2: st(a2), b: st(b), recA2: rec().tab === a2.mod.winTab() };
  close(a2); close(b); await advance(10); }
// 5b. The window in use closed while another on screen checks at once (its focus): the goodbye holds it back 2.5 s, so a reload of the closed one
// would have kept Fiala; after the pause it carries on by itself
{ reset(); const a = await openWin("a5b"); await advance(10); show(a, false);
  const b = await openWin("b5b"); await advance(1000);
  close(a); await advance(5); b.fire("focus"); await advance(50); const soon = st(b);
  await advance(2600); b.fire("focus"); await advance(900);
  out.pause = { soon: { started: soon.startedCalls, cover: soon.cover }, later: st(b) };
  close(b); await advance(10); }
// 6. Opened unseen (a tab restored, a preload): it never asks or takes while hidden; shown, it checks
{ reset(); const a = await openWin("a6"); await advance(10); a.asleep = true; show(a, false);   // asleep in the background
  const b = await openWin("b6", { visible: false }); await advance(3000); const hidden = { ...st(b), heldNow: locks.held().filter((x) => x.startsWith("b6")).length, all: locks.held() };
  show(b, true); await advance(1000);
  out.unseen = { hidden: { cover: hidden.cover, started: hidden.startedCalls, held: hidden.heldNow }, shown: st(b) };
  a.asleep = false; close(a); close(b); await advance(10); }
// 7. A sign-in or password link opened in a new window is used there: the window in use lets go, without the page
{ reset(); const a = await openWin("a7"); await advance(10); show(a, false);
  const b = await openWin("b7", { url: "https://app.example/#access_token=x&type=recovery" }); await advance(200);
  out.link = { b: st(b), a: st(a), hash: b.loc.hash };
  close(a); close(b); await advance(10); }
// 8. Use here in a window that lost Fiala: it starts again, asking to move as it opens (in the address), and the marker leaves the address
{ reset(); const a = await openWin("a8"); await advance(10); show(a, false);
  const b = await openWin("b8"); await advance(1000); b.els.owUse.listeners.click(); await advance(100); show(b, false); show(a, true);
  a.els.owUse.listeners.click(); await advance(10); const asked = st(a);
  const a2 = await openWin("a8r", { url: asked.went[0] ? new URL(asked.went[0], "https://app.example/").href : "https://app.example/" }); await advance(100);
  out.backHere = { went: asked.went, a2: st(a2), b: st(b), address: a2.loc.href };
  close(a); close(a2); close(b); await advance(10); }
// 9. The record names another window (a steal whose notice has not arrived yet): the first write stops and the page shows
{ reset(); const a = await openWin("a9"); await advance(10); store.set("fiala.window", JSON.stringify({ tab: "someone-else", at: 1, vis: "visible" }));
  out.record = { lost: a.mod.winLost(), a: st(a) }; close(a); await advance(10); }
// 10. Safari 26 lets the locks go as the page enters the back/forward cache; back with nobody else in between, it takes Fiala back quietly
{ reset(); const a = await openWin("a10"); await advance(10); a.fire("pagehide", { persisted: true }); a.asleep = true; locks.dropAll(a); await advance(5);
  a.asleep = false; a.fire("pageshow", { persisted: true }); await advance(20);
  out.bfcache = { a: st(a), held: locks.held(), recVis: rec().vis }; close(a); await advance(10); }
// 10b. The same, but another window ran Fiala meanwhile and went: the page (its copy is old)
{ reset(); const a = await openWin("a10b"); await advance(10); a.fire("pagehide", { persisted: true }); a.asleep = true; locks.dropAll(a); await advance(5);
  const b = await openWin("b10b"); await advance(20); close(b); await advance(10);
  a.asleep = false; a.fire("pageshow", { persisted: true }); await advance(20);
  out.bfcacheMoved = { a: st(a) }; close(a); await advance(10); }
// 11. No Web Locks (Safari before 15.4): Fiala opens at once, never stops (the pages share, as since v305)
{ reset(); const a = await openWin("a11", { locksOff: true }); await advance(10); const b = await openWin("b11", { locksOff: true }); await advance(10);
  out.noLocks = { a: st(a), b: st(b) }; }
// 12. The lock refused outright (a sandbox): the feature is off for that page, never a page that cannot open
{ reset(); const a = await openWin("a12", { refuse: true }); await advance(10);
  out.refused = { a: st(a) }; close(a); await advance(10); }
// 13. Hidden and shown again while running: the record says where it was seen last; the hooks keep and drop the words
{ reset(); const a = await openWin("a13"); await advance(10); show(a, false); const h = rec().vis; show(a, true); await advance(10);
  out.visHooks = { hiddenVis: h, shownVis: rec().vis, hiddenHook: a.hiddenHook || 0, shownHook: a.shownHook || 0 };
  a.fire("pagehide", { persisted: false }); out.visHooks.gone = rec().vis; close(a); await advance(10); }
// 14. Three windows: two pages on screen at once never both start; the one in use keeps answering
{ reset(); const a = await openWin("a14"); await advance(10); show(a, false);
  const b = await openWin("b14"); await advance(1000); const c = await openWin("c14"); await advance(5000);
  out.three = { a: st(a).startedCalls, b: st(b).cover, c: st(c).cover, held: locks.held() };
  b.els.owUse.listeners.click(); c.els.owUse.listeners.click(); await advance(8000);
  const runs = [a, b, c].filter((w) => { const s = st(w); return s.started && !s.lost; }).map((w) => w.name);
  out.three.running = runs; out.three.held = locks.held();
  close(a); close(b); close(c); await advance(10); }
// 15. The page's own parts broken (a markup the script does not know): Fiala still opens, the lock free or held by a window asleep
{ reset(); const a = await openWin("a15"); a.doc.getElementById = () => { throw new Error("no such part"); }; await advance(10);
  const b = await openWin("b15", { visible: true }); b.doc.getElementById = () => { throw new Error("no such part"); };
  out.broken = { a: st(a).startedCalls }; close(a); await advance(10); }
{ reset(); const a = await openWin("a16"); await advance(10); show(a, false); a.asleep = true;
  const b = await openWin("b16"); b.doc.getElementById = () => { throw new Error("no such part"); }; await advance(1500);
  out.broken.bAsleepHolder = b.started; a.asleep = false; close(a); close(b); await advance(10); }
// ---- v321 (the twenty-seventh round): the scenarios below write keys of their own; tests/win-lock-r27.test.js reads them ----
const page = (w) => ({ owOn: w.doc.body.classList.contains("ow-on"), mainInert: w.main.inert, headerInert: w.header.inert, coverHidden: w.els.oneWin.hidden });
const tick = async (w) => { const n0 = w.ticks.length; for (let i = 0; i < 2100 && w.ticks.length === n0; i++) await advance(1); };   // to just after the window's next 2 s check
// 17. (R26-TW-5) The window Fiala moves to shows its page again and takes taps (no body.ow-on, nothing inert, #oneWin hidden); the window that let go
// is covered (the page over everything, the rest inert, its header kept); and so is a newcomer's page once the window in use is closed
{ reset(); const a = await openWin("a17"); await advance(10); show(a, false);
  const b = await openWin("b17"); await advance(1000); const bBefore = page(b);
  b.els.owUse.listeners.click(); await advance(50);
  out.movedShown = { bBefore, b: page(b), a: page(a), bState: st(b), aState: st(a) };
  close(a); close(b); await advance(10); }
{ reset(); const a = await openWin("a17c"); await advance(10); show(a, false);
  const b = await openWin("b17c"); await advance(1000); close(a); await advance(5000);
  out.movedShown.afterClose = { b: page(b), bState: st(b) };
  close(b); await advance(10); }
// 18. (R26-TW-6) The window in use asleep (a phone tab in the background) is taken; woken by being shown (the person switches back to it) before
// anything of it runs, it must not write its record back over the window that took Fiala (that one would stop at its next write, and both would
// show the page). While asleep it has heard nothing of the steal: the stand-in delivers it when the window runs again, as a frozen tab hears it.
{ reset(); const a = await openWin("a18"); await advance(10); show(a, false); a.asleep = true;
  const b = await openWin("b18"); await advance(1000); const bTook = st(b);
  const ws = a.mod.winState(), asleep = { holding: ws.holding, lost: ws.lost, lostHook: a.lostHook || 0 };   // read as it is, without winLost() (that reads the record)
  a.asleep = false; show(a, true); await advance(50);
  out.wokenShown = { bTook, asleep, recB: rec().tab === b.mod.winTab(), bLost: b.mod.winLost(), b: st(b), a: st(a) };
  close(a); close(b); await advance(10); }
// 19. (R26-TW-8) A window that lost Fiala to Use here carries on by itself (a reload) once the window it moved to falls asleep out of sight (a phone tab
// in the background), never in the pause after the move
{ reset(); const a = await openWin("a19"); await advance(10); show(a, false);
  const b = await openWin("b19"); await advance(1000); b.els.owUse.listeners.click(); await advance(100);
  show(b, false); b.asleep = true; show(a, true); await advance(2000); const early = st(a).went.slice(); await advance(4000);
  out.lostCarriesOn = { early, went: st(a).went.slice(), aLost: st(a).lost };
  b.asleep = false; close(a); close(b); await advance(10); }
// 20. The same when the window in use goes without its goodbye while on screen (its page crashed: no pagehide, its record still says on screen, its
// lock gone with it): the lock's registry says it is free, and the lost window carries on by itself
{ reset(); const a = await openWin("a20"); await advance(10); show(a, false);
  const b = await openWin("b20"); await advance(1000); b.els.owUse.listeners.click(); await advance(100);
  const recVis = rec().vis; b.closed = true; locks.closeWin(b); for (const c of [...chans]) if (c.win === b) c.close();   // crashed: nothing of it runs any more
  show(a, true); await advance(6000);
  out.crashCarriesOn = { recVis, went: st(a).went.slice() };
  close(a); await advance(10); }
// 21. (R26-TW-8) Use here while the window in use answers but never lets go (it fell asleep in the middle of its hand-over): taken at 6 s, not before
{ reset(); const a = await openWin("a21"); await advance(10); show(a, false);
  a.mod.winHooks.handOver = () => { a.handed = (a.handed || 0) + 1; a.asleep = true; return new Promise(() => {}); };
  const b = await openWin("b21"); await advance(1000);
  b.els.owUse.listeners.click(); await advance(5500); const before = st(b); await advance(1000);
  out.waitLimit = { handed: a.handed || 0, before: { started: before.startedCalls, moving: before.moving }, after: st(b) };
  a.asleep = false; await advance(10); out.waitLimit.a = st(a);
  close(a); close(b); await advance(10); }
// 22. The same, but its hand-over hangs while it stays awake (its saves never answer): it lets go after 4 s, and Fiala opens in the other window then
{ reset(); const a = await openWin("a22"); await advance(10); show(a, false);
  a.mod.winHooks.handOver = () => { a.handed = (a.handed || 0) + 1; return new Promise(() => {}); };
  const b = await openWin("b22"); await advance(1000);
  b.els.owUse.listeners.click(); await advance(3500); const before = st(b); await advance(1000);
  out.handLimit = { handed: a.handed || 0, before: { started: before.startedCalls, moving: before.moving }, after: st(b), a: st(a) };
  close(a); close(b); await advance(10); }
// 23. Three windows: Use here in one while the window in use falls asleep in its hand-over: the third, checking meanwhile (its focus), holds back in the
// pause after the "yield" as after a goodbye (no Fiala there in the first 2.5 s of a move); at 6 s the window where Use here was pressed takes it. (A
// third window checking between 2.5 and 6 s can still take Fiala first and lose it at 6 s: later, as the code is; not pinned here.)
{ reset(); const a = await openWin("a23"); await advance(10); show(a, false);
  a.mod.winHooks.handOver = () => { a.handed = (a.handed || 0) + 1; a.asleep = true; return new Promise(() => {}); };
  const b = await openWin("b23"); await advance(1000); const c = await openWin("c23"); await advance(1000);
  b.els.owUse.listeners.click(); await advance(900); c.fire("focus"); await advance(1100);
  out.yieldPause = { c: { started: st(c).startedCalls, cover: st(c).cover }, b: { started: st(b).startedCalls, moving: st(b).moving } };
  await advance(4500); out.yieldPause.later = { b: st(b).startedCalls, c: st(c).startedCalls };
  a.asleep = false; await advance(10); out.yieldPause.end = [a, b, c].filter((w) => { const s = st(w); return s.started && !s.lost; }).map((w) => w.name);
  close(a); close(b); close(c); await advance(10); }
// 24. Use here where the lock's grant reaches the page after the window in use's "yielded" (the lock manager is another process: the grant is a task of
// its own): the answer heard before its waiter still counts, so Fiala opens at once, not a second later
{ reset(); const a = await openWin("a24"); await advance(10); show(a, false);
  const b = await openWin("b24", { grantLag: 5 }); await advance(1000);
  b.els.owUse.listeners.click(); await advance(100);
  out.heardFirst = { b: st(b), a: st(a) };
  close(a); close(b); await advance(10); }
// 25. A move that fails (the lock refused, as for a page that is not fully active): the button comes back and "Moving here…" goes, so Use here can be
// pressed again
{ reset(); const a = await openWin("a25"); await advance(10); a.asleep = true;   // busy on screen: its record says visible, and it answers nothing
  const b = await openWin("b25"); await advance(1500); b.refuse = true;
  b.els.owUse.listeners.click(); await advance(1); const moving = st(b); await advance(1000);
  out.moveFailed = { moving: { text: moving.moving, disabled: moving.useDisabled }, after: st(b) };
  close(a); close(b); await advance(10); }
// 26. The window in use asleep is taken, then closed before it runs again (its pagehide comes first): it never writes "gone" over the record of the
// window that took Fiala (that one would stop at its next write)
{ reset(); const a = await openWin("a26"); await advance(10); show(a, false); a.asleep = true;
  const b = await openWin("b26"); await advance(1000);
  a.asleep = false; close(a); await advance(10);
  out.closedAsleep = { recB: rec().tab === b.mod.winTab(), recVis: rec().vis, bLost: b.mod.winLost(), b: st(b) };
  close(b); await advance(10); }
// 27. A check and Use here at once (a click into the window on the Mac, on its Use here), the lock free (the window in use closed a moment before) and
// its grant on the way: the check opens Fiala, and Use here, finding the lock held already, never takes it again from this very page (that took it
// away from itself, the page lost Fiala and started again)
{ reset(); const a = await openWin("a27"); await advance(10); show(a, false);
  const b = await openWin("b27", { grantLag: 5 }); await advance(1000);
  await tick(b); await advance(20); close(a); await advance(2600);   // past the pause after its goodbye, and between two of b's 2 s checks
  b.fire("focus"); b.els.owUse.listeners.click(); await advance(3000);
  out.checkAndUse = { b: st(b) };
  close(b); await advance(10); }
// 28. The window in use falls asleep out of sight (a background tab frozen) while another shows the page: the other, focused (a click into it on the
// Mac), checks at once and opens Fiala within a second, not at its next 2 s check
{ reset(); const a = await openWin("a28"); await advance(10); show(a, false);
  const b = await openWin("b28"); await advance(1000);
  await tick(b); await advance(20);   // just after one of its 2 s checks
  a.asleep = true; b.fire("focus"); await advance(900);
  out.focusCheck = { b: st(b) };
  a.asleep = false; close(a); close(b); await advance(10); }
// 29. (R26-WIN-3) The page in a window that never ran main.js follows the phone's Text Size as the app does (main.js's fitText: the hidden probe's
// system font over 17, kept between 1 and 1.5, on a 16 px root): as it shows, and each time it comes back on screen (the Text Size changed meanwhile),
// at once, before its check hears an answer (the first picture it shows is the right size; in the pause after a goodbye that check stops early)
{ reset(); const a = await openWin("a29"); await advance(10); show(a, false);
  const b = await openWin("b29", { typePx: 25.5 }); await advance(1000);
  const root = () => b.doc.documentElement.style.fontSize, seen = { atCover: root(), page: st(b).cover }, later = [];
  for (const [k, px] of [["larger", 20], ["standard", 17], ["capped", 40], ["smaller", 12], ["unread", null], ["back", 25.5]]) { show(b, false); b.typePx = px; show(b, true); seen[k] = root(); await advance(5); if (root() !== seen[k]) later.push(k + " " + root()); }
  out.textSize = seen; seen.later = later;
  close(a); close(b); await advance(10); }
// 30. (R26-WIN-4) index.html's own loader, its module script run as written (main.js a stand-in that loads in the time given): a window that loses
// Fiala before its app has loaded never starts it behind the page (main.js's boot: the session's sign-in, the kept words taken); the window it moved
// to starts as usual
{ const fs = await import("node:fs"), html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
  const at0 = html.lastIndexOf('<script type="module">'), mod = at0 < 0 ? "" : html.slice(at0, html.indexOf("</script>", at0));
  const imp = /import \{([^}]*)\} from "\.\/app\/win\.js";/.exec(mod), names = imp ? imp[1].split(",").map((x) => x.trim()).filter(Boolean) : [];
  let call = null; const i0 = mod.search(/\boneWindow\(/);
  if (i0 >= 0) { let d = 0, q = null, j = i0 + "oneWindow".length; for (; j < mod.length; j++) { const ch = mod[j]; if (q) { if (ch === "\\") j++; else if (ch === q) q = null; } else if (ch === '"' || ch === "'" || ch === "`") q = ch; else if (ch === "(") d++; else if (ch === ")" && --d === 0) break; } call = mod.slice(i0, j + 1); }   // the call, to its own closing bracket
  const body = call && call.replace(/import\("\.\/app\/main\.js\?v=\d+"\)/, "__main()");
  const ok = !!(imp && names.includes("oneWindow") && body && body !== call);
  out.loader = { found: ok };
  if (ok) {
    const run = new Function(...names, "__main", body + ";");
    const loader = (ms) => (m, env, win) => run(...names.map((k) => (k === "oneWindow" ? (f) => m.oneWindow(f, env) : m[k])), () => { win.started++; return new Promise((r) => at(ms, () => r({ boot: () => { win.booted = (win.booted || 0) + 1; } }), win)); });
    reset(); const a = await openWin("a30", { start: loader(0) }); await advance(10); show(a, false);       // Fiala opens in A, its main.js at once
    const b = await openWin("b30", { start: loader(1500) }); await advance(1000);                      // B shows the page; its main.js takes 1.5 s (a slow phone or network)
    b.els.owUse.listeners.click(); await advance(100); const bTook = st(b);                             // Use here in B: Fiala moves there, its app still loading
    show(b, false); show(a, true); a.els.owUse.listeners.click(); await advance(10);                    // Use here back in A at once: A starts again, asking to move as it opens
    const a2 = await openWin("a30r", { url: new URL(st(a).went[0] || "/", "https://app.example/").href, start: loader(0) }); await advance(3000);
    Object.assign(out.loader, { aBooted: a.booted || 0, aWent: st(a).went, bTook: { started: bTook.started, lost: bTook.lost, imports: bTook.startedCalls }, bBooted: b.booted || 0, b: st(b), a2: st(a2), a2Booted: a2.booted || 0 });
    close(a); close(a2); close(b); await advance(10);
  } }
console.log(JSON.stringify(out));
