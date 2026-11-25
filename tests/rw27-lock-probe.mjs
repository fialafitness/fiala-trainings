// rev/window (check round 27): win-probe.mjs's stand-ins (unchanged), with this lens's three-window scenarios. One window at a time (v316, app/win.js): windows of one browser on a stand-in lock manager, message channel and clock, each window its own copy
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


// T1. Three windows: B's Use here while the window in use (A, a background tab: last seen out of sight) falls asleep in the middle of its
// hand-over; C, a third window on screen showing the page, checks every 2 s (and at a click into it: focus at the time given). Each window's
// starts and losses on the clock, from B's tap.
async function three(name, { cFocusAt = null, cUseAt = null, aVisible = false } = {}) {
  reset(); const a = await openWin("a" + name); await advance(10); if (!aVisible) show(a, false);
  a.mod.winHooks.handOver = () => { a.handed = (a.handed || 0) + 1; a.asleep = true; return new Promise(() => {}); };
  const b = await openWin("b" + name); await advance(1000); const c = await openWin("c" + name); await advance(700);
  const t0 = T, log = []; let prev = {};
  b.els.owUse.listeners.click();
  for (let t = 0; t <= 12000; t += 50) {
    if (cFocusAt !== null && t === cFocusAt) c.fire("focus");
    if (cUseAt !== null && t === cUseAt) c.els.owUse.listeners.click();
    await advance(50);
    for (const w of [a, b, c]) { const s = st(w), now = { runs: s.started && !s.lost, cover: s.cover, moving: s.moving || "" }, was = prev[w.name] || {}; if (now.runs !== was.runs || now.cover !== was.cover || now.moving !== was.moving) log.push([T - t0, w.name.slice(0, 1), now.runs ? "runs Fiala" : now.cover ? "shows the page" + (now.moving ? " (" + now.moving + ")" : "") : "nothing shown"]); prev[w.name] = now; }
  }
  a.asleep = false; await advance(50);
  const end = [a, b, c].filter((w) => { const s = st(w); return s.started && !s.lost; }).map((w) => w.name.slice(0, 1));
  const r = { log, cStarts: c.started, cLostHook: c.lostHook || 0, bStarts: b.started, end, cTicks: c.ticks.filter((x) => x >= t0).map((x) => x - t0).slice(0, 6) };
  close(a); close(b); close(c); await advance(10); return r;
}
// T2. The same, but C is opened only during B's move (a new tab, 3 s after the tap): its first check, which never waits for a pause
async function freshC(name, at = 3000) {
  reset(); const a = await openWin("a" + name); await advance(10); show(a, false);
  a.mod.winHooks.handOver = () => { a.handed = (a.handed || 0) + 1; a.asleep = true; return new Promise(() => {}); };
  const b = await openWin("b" + name); await advance(1000);
  const t0 = T, log = []; let prev = {}, c = null;
  b.els.owUse.listeners.click();
  for (let t = 0; t <= 12000; t += 50) {
    if (t === at) c = await openWin("c" + name);
    await advance(50);
    for (const w of [a, b, c].filter(Boolean)) { const s = st(w), now = { runs: s.started && !s.lost, cover: s.cover, moving: s.moving || "" }, was = prev[w.name] || {}; if (now.runs !== was.runs || now.cover !== was.cover || now.moving !== was.moving) log.push([T - t0, w.name.slice(0, 1), now.runs ? "runs Fiala" : now.cover ? "shows the page" + (now.moving ? " (" + now.moving + ")" : "") : "nothing shown"]); prev[w.name] = now; }
  }
  a.asleep = false; await advance(50);
  const end = [a, b, c].filter((w) => { const s = st(w); return s.started && !s.lost; }).map((w) => w.name.slice(0, 1));
  const r = { log, cStarts: c.started, cLostHook: c.lostHook || 0, end };
  close(a); close(b); close(c); await advance(10); return r;
}
// T3. B's move fails half way (B closed while "Moving here…"): C, which heard the yield, carries on by itself (how soon)
async function moverClosed(name) {
  reset(); const a = await openWin("a" + name); await advance(10); show(a, false);
  a.mod.winHooks.handOver = () => { a.handed = (a.handed || 0) + 1; a.asleep = true; return new Promise(() => {}); };
  const b = await openWin("b" + name); await advance(1000); const c = await openWin("c" + name); await advance(700);
  const t0 = T; b.els.owUse.listeners.click(); await advance(1000); close(b);
  let at = -1; for (let t = 0; t <= 15000 && at < 0; t += 50) { await advance(50); const s = st(c); if (s.started && !s.lost) at = T - t0; }
  a.asleep = false; await advance(50); const r = { cRunsAt: at };
  close(a); close(c); await advance(10); return r;
}
// T4. (not fixed here) Use here in B, then Use here in C 1 s later, while A, awake, is still in its hand-over (a restore's read: 3 s): A answers
// only B; C takes Fiala at once from A (A's last stores never land); at 6 s B takes it from C
async function secondUse(name) {
  reset(); const a = await openWin("a" + name); await advance(10); show(a, false);
  a.mod.winHooks.handOver = () => new Promise((r) => at(3000, () => { a.storedAtEnd = !a.mod.winLost(); r(); }, a));   // its hook ends 3 s later; the last stores land only while it still holds Fiala
  const b = await openWin("b" + name); await advance(1000); const c = await openWin("c" + name); await advance(700);
  const t0 = T, log = []; let prev = {};
  b.els.owUse.listeners.click();
  for (let t = 0; t <= 9000; t += 50) {
    if (t === 1000) c.els.owUse.listeners.click();
    await advance(50);
    for (const w of [a, b, c]) { const s = st(w), now = { runs: s.started && !s.lost, cover: s.cover, moving: s.moving || "" }, was = prev[w.name] || {}; if (now.runs !== was.runs || now.cover !== was.cover || now.moving !== was.moving) log.push([T - t0, w.name.slice(0, 1), now.runs ? "runs Fiala" : now.cover ? "shows the page" + (now.moving ? " (" + now.moving + ")" : "") : "nothing shown"]); prev[w.name] = now; }
  }
  const end = [a, b, c].filter((w) => { const s = st(w); return s.started && !s.lost; }).map((w) => w.name.slice(0, 1));
  const r = { log, end, aStoredAtEnd: !!a.storedAtEnd };
  close(a); close(b); close(c); await advance(10); return r;
}
out.T1_polls = await three("1");
out.T1_focus3s = await three("2", { cFocusAt: 3000 });
out.T1_focus5s = await three("3", { cFocusAt: 5000 });
out.T1_cUseHere = await three("4", { cUseAt: 2000 });
out.T1_aOnScreen = await three("5", { aVisible: true });
out.T2_freshC = await freshC("6");
out.T3_moverClosed = await moverClosed("7");
out.T4_secondUse = await secondUse("8");
console.log(JSON.stringify(out));
