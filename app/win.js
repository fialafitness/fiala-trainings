// Fiala in one window at a time (v316; the owner's pick A of 19 Nov 2026, "Build A if you think it's the best choice", brought into v316 on 25 Nov 2026:
// "Yes, bring it in now"). Two windows of one browser (two Safari tabs or windows on the Mac, iPad split view, Chrome's tabs and its installed app)
// share the device copy and the unsent queue; only one of them runs Fiala. A second window shows "Fiala is open in another window" with Use here
// (index.html #oneWin, the approved picture); close either window and the other carries on by itself; a window asleep (a phone tab in the
// background, a tab the browser froze) or closed never blocks a new one. An iPhone's Home Screen app, the Mac's Dock app and Safari never share
// storage (Apple: "It shares no browsing history, cookies, website data, or settings with Safari"), so they sync as two devices, as before.
// How (the research of 19 Nov 2026, from the specs and the WebKit, Chromium and Firefox sources; the critique's four fixes):
//  - the window in use holds the exclusive Web Lock "fiala.window" for its life (Safari 15.4+, Chrome 69+, Firefox 96+; where there is none, the
//    feature is off and the pages share as since v305). It is asked for here, before main.js is even loaded (index.html imports it after), so
//    nothing of the account is read or written by a window that does not hold it.
//  - a newcomer asks on the BroadcastChannel "fiala.window" ("who"); the window in use answers ("here"). No answer in 0.8 s means the window
//    in use is asleep or gone: the newcomer takes the lock (steal: granted at once, even from a sleeping holder) when that window was last seen
//    hidden or gone, never while it says it is on screen (busy: the person decides, with Use here).
//  - Use here asks the window in use to let go ("yield"): it keeps what is being typed, closes its sheets as Cancel, saves (the queue, the device
//    copy, the saves already on their way, up to 3 s) and lets go ("yielded"); no answer in 0.8 s: taken at once.
//  - the window that lost Fiala stops writing at once (winLost(), checked by every write: lsSet, the queue, the device copy, a sync, a save, the
//    photos) and shows the page; its copy in memory is old, so it starts again (a reload) before it runs Fiala again.
//  - the owner record (localStorage "fiala.window": { tab, at, vis }) names the window in use and whether it was last seen on screen: a write
//    from a page the record does not name stops (a frozen tab woken before its notice of the steal arrives); and on its return a page checks the
//    lock's own registry against its own client id (the notice and the registry travel apart).
//  - a window going away (a reload, a close) says "bye": no other window takes Fiala for 2.5 s, so a reload keeps it (measured in WebKit: without
//    the pause it moved to the other window in 4 of 11 reloads, with it 0 of 6).
const LOCK = "fiala.window", REC = "fiala.window", ASK = 800, WAIT = 6000, AFTER = 1000, PAUSE = 2500, POLL = 2000, HAND = 4000;
const rid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
const TAB = rid();
let E = null, on = false, leaving = false, holding = false, letGo = null, gen = 0, holdGen = 0, lost = false, started = false, booted = false, covered = false, checking = false, moving = false, handing = false, rechecking = false, byeAt = -Infinity, me = null, ch = null, startFn = null, poll = 0;
const waiters = new Set(), heard = new Set();
export const winHooks = { handOver: null, lose: null, hidden: null, shown: null };   // main.js fills these: what to keep and save before letting go, what to stop when Fiala has gone, what to keep when the window goes out of sight (it may be taken while asleep) and drop when it comes back still in use
export const winOn = () => on;
export const winTab = () => TAB;

const envOf = (o = {}) => {
  const g = globalThis, pick = (k, d) => (Object.prototype.hasOwnProperty.call(o, k) ? o[k] : d);
  let ls = null; try { ls = g.localStorage || null; } catch (_) { ls = null; }
  return {
    locks: pick("locks", g.navigator && g.navigator.locks ? g.navigator.locks : null), Channel: pick("Channel", typeof g.BroadcastChannel === "function" ? g.BroadcastChannel : null),
    ls: pick("ls", ls), doc: pick("doc", g.document), win: pick("win", g), loc: pick("loc", g.location), hist: pick("hist", g.history),
    now: pick("now", () => g.performance.now()), clock: pick("clock", () => Date.now()), setT: pick("setT", (f, ms) => g.setTimeout(f, ms)), clearT: pick("clearT", (t) => g.clearTimeout(t)),
    setI: pick("setI", (f, ms) => g.setInterval(f, ms)), clearI: pick("clearI", (t) => g.clearInterval(t)), Abort: pick("Abort", typeof g.AbortController === "function" ? g.AbortController : null),
    go: pick("go", (url) => { if (url) g.location.replace(url); else g.location.reload(); }),
  };
};
const rec = () => { try { const r = JSON.parse(E.ls.getItem(REC)); return r && typeof r === "object" ? r : null; } catch (_) { return null; } };
const vis = () => (E.doc.visibilityState === "hidden" ? "hidden" : "visible");
const writeRec = (v) => { try { E.ls.setItem(REC, JSON.stringify({ tab: TAB, at: E.clock(), vis: v || vis() })); } catch (_) {} };
const ours = () => { const r = rec(); return !(r && r.tab && r.tab !== TAB); };   // the record names no other window (none at all: the first window, or storage cleared)

// Every write of the app asks this first (lsSet, the queue, the device copy, a sync, a save, the photos): true once Fiala has moved to another
// window. With the feature off (no locks, as in the tests) it is always false.
export function winLost() {
  if (!on) return false;
  if (lost) return true;
  if (started && !ours()) { loseNow(); return true; }   // another window took Fiala while this one slept: its notice of the steal may come later than its first timers
  return false;
}

const post = (m) => { try { ch.postMessage({ v: 1, from: TAB, ...m }); } catch (_) {} };
const wait = (want, n, ms) => new Promise((done) => {
  if (heard.has(want + "/" + n)) { done(true); return; }
  const w = { want, n, done }; waiters.add(w); E.setT(() => { if (waiters.delete(w)) done(false); }, ms);
});
const ask = (t, ms, n = rid()) => { const p = wait(t === "who" ? "here" : "yielding", n, ms); post({ t, n }); return p; };
const running = () => started && !lost;                                 // this page runs Fiala now
function onMsg(e) {
  const m = e && e.data; if (!m || typeof m !== "object" || m.v !== 1 || m.from === TAB) return;
  if (m.t === "bye" || m.t === "yield") byeAt = E.now();                // the window in use is going (a reload, a close) or moving: no window takes Fiala for a moment
  if (m.to) { if (m.to !== TAB) return; heard.add(m.t + "/" + m.n); for (const w of [...waiters]) if (w.want === m.t && w.n === m.n) { waiters.delete(w); w.done(true); } return; }
  if (!holding || !running()) return;                                  // only the window running Fiala answers
  if (m.t === "who") post({ t: "here", to: m.from, n: m.n });
  else if (m.t === "yield") handOver(m);
}

// One request for the lock: resolves true once this page holds it, false if not granted (ifAvailable with the lock held, an aborted wait, an error).
const take = (opts) => new Promise((done) => {
  const g = ++gen; let p;
  try {
    p = E.locks.request(LOCK, opts, (lock) => {
      if (!lock) { done(false); return undefined; }
      if (holding) { done(true); return undefined; }                   // this page holds it already (a check and Use here at once): the second grant lets go at once
      holding = true; holdGen = g; done(true);
      return new Promise((r) => { letGo = r; });
    });
  } catch (_) { done("error"); return; }
  Promise.resolve(p).then(() => { if (holdGen === g) holding = false; }, (err) => {
    if (holdGen === g && holding) { holding = false; letGo = null; if (!lost && err && err.name === "AbortError") recheck().catch(() => {}); }   // stolen, or let go as the page went into the back/forward cache (Safari 26): which, the registry says
    else done(err && err.name === "AbortError" ? false : "error");   // a wait given up (Use here's 6 s), or the lock refused (a sandbox, a document not fully active: the research's case 28)
  });
});
const isFree = async () => { try { const q = await E.locks.query(); return !((q && q.held) || []).some((l) => l && l.name === LOCK); } catch (_) { return false; } };
async function learnMe() {                                              // this page's own client id, to find it in the lock's registry later
  const name = "fiala.me." + TAB;
  try { await E.locks.request(name, async () => { const q = await E.locks.query(); const x = ((q && q.held) || []).find((l) => l && l.name === name); me = x && x.clientId ? x.clientId : null; }); } catch (_) { me = null; }
}

function loseNow() {                                                     // Fiala is in another window now: stop at once, show the page
  if (lost) return; lost = true; holding = false; const r = letGo; letGo = null;
  try { if (r) r(); } catch (_) {}
  try { if (winHooks.lose) winHooks.lose(); } catch (_) {}
  cover();
}
async function recheck() {                                               // back on screen, back from the back/forward cache, or told the lock went: is it still this page's?
  if (lost || !on || !started || rechecking) return; rechecking = true;
  try {
    let q = null; try { q = await E.locks.query(); } catch (_) { q = null; }
    if (lost) return;
    const held = q && Array.isArray(q.held) ? q.held.filter((l) => l && l.name === LOCK) : null;
    const mine = held && me ? held.some((l) => l.clientId === me) : null;
    if (holding && mine !== false && ours()) { writeRec(); return; }    // still this page's (the record says so again: a pagehide said "gone" before the back/forward cache)
    if (held && held.length && !mine) { loseNow(); return; }            // another window holds it
    if (!ours()) { loseNow(); return; }                                 // it went to another window meanwhile (and that one went): this page's copy is old
    if (holding || (await take({ ifAvailable: true })) === true) { if (lost) return; writeRec(); return; }   // nobody holds it (Safari 26 lets it go at the back/forward cache): taken back while the record still names this page
    loseNow();
  } finally { rechecking = false; }
}
async function handOver(m) {                                             // Use here in another window: keep, save, let go
  if (handing || lost) return; handing = true;
  post({ t: "yielding", to: m.from, n: m.n });
  try { const q = await E.locks.query(), held = ((q && q.held) || []).filter((l) => l && l.name === LOCK); if (!lost && me && held.length && !held.some((l) => l.clientId === me)) loseNow(); } catch (_) {}   // v316 (the twenty-sixth check round, R26-WIN-1): the lock's own registry first: a "yield" that waited behind a long task (Chrome runs it before the record's update) finds the lock taken meanwhile, and stores nothing (its old queue replaced the new window's)
  if (lost) { handing = false; return; }
  try { if (winHooks.handOver) await Promise.race([Promise.resolve().then(() => winHooks.handOver()), new Promise((r) => E.setT(r, HAND))]); } catch (_) {}
  loseNow();
  post({ t: "yielded", to: m.from, n: m.n });
  handing = false;
}

function restart(url) { leaving = true; stopPoll(); E.go(url); }      // a fresh start of this page (its old copy in memory is never run again)
function begin() {                                                        // this page holds Fiala: run it
  if (running()) return;
  if (booted) { restart(); return; }                                      // a page that ran Fiala before holds an old copy in memory: a fresh start (unreachable today: such a page reloads first)
  started = booted = true; lost = false; moving = false; stopPoll(); try { uncover(); } catch (_) {} writeRec(); learnMe();   // the page's own parts never stop Fiala from opening
  try { const s = startFn; startFn = null; if (s) s(); } catch (_) {}
}
function decideFor(use) {                                                 // the lock is held by another window: ask it, or move here (Use here, a sign-in link), or wait to be seen
  if (use) return moveHere();
  if (vis() !== "visible") { cover(); return undefined; }                 // a window opened unseen (a tab restored, a preload) never asks or takes: it checks when it is shown
  return coverCheck(true);
}
async function coverCheck(first = false) {                               // the page is up (or about to be): lock free, Fiala opens here; the other answers, the page stays; no answer from a window last seen out of sight, Fiala opens here
  if (checking || moving || leaving || running() || vis() !== "visible") return;
  if (!first && E.now() - byeAt < PAUSE) return;                          // a window going away a moment ago may be reloading: it keeps Fiala
  checking = true;
  try {
    if (booted) {                                                         // a page that lost Fiala: never takes it in place, starts again instead
      if (await isFree()) { restart(); return; }
      if (await ask("who", ASK)) return;
      const r = rec(); if (!r || r.vis !== "visible") restart();
      return;
    }
    if ((await take({ ifAvailable: true })) === true) { begin(); return; }
    if (await ask("who", ASK)) { if (!moving && !running()) cover(); return; }   // (the first time, nothing shows during the question: Fiala opens with no page when the other window sleeps)
    if (moving || running()) return;
    const r = rec(); if (r && r.vis === "visible") { cover(); return; }  // on screen but busy (a long task): the person decides, with Use here
    if ((await take({ steal: true })) === true) { begin(); return; }
    cover();
  } finally { checking = false; }
}
async function moveHere() {                                               // Use here: the window in use keeps, saves and lets go; asleep, it is taken at once
  if (moving || running()) return; moving = true; showMoving(true);
  try {
    const n = rid();
    if (await ask("yield", ASK, n)) {
      const ctl = E.Abort ? new E.Abort() : null, t = ctl ? E.setT(() => ctl.abort(), WAIT) : 0;
      const ok = ctl ? (await take({ signal: ctl.signal })) === true : false; if (t) E.clearT(t);
      if (ok) { await wait("yielded", n, AFTER); begin(); return; }       // its last writes have landed once it says so
    }
    if (holding || (await take({ steal: true })) === true) { begin(); return; }
  } catch (_) {}
  moving = false; showMoving(false);
}
function useHere() {                                                      // the button
  if (moving || leaving || running()) return;
  if (booted) { moving = true; showMoving(true); let url = ""; try { const u = new URL(E.loc.href); u.searchParams.set("here", "1"); url = u.pathname + u.search + u.hash; } catch (_) { url = ""; } restart(url); return; }   // a page that lost Fiala starts again, asking to move as it opens (in the address: sessionStorage may be blocked, and the page must never loop)
  moveHere();
}

// The page (index.html #oneWin): the approved picture A.
function cover() { try { coverNow(); } catch (_) {} }                  // the page's own parts never stop the decisions (a part missing: the page shows less)
function coverNow() {
  if (!E || !E.doc) return; covered = true;
  const d = E.doc, el = d.getElementById && d.getElementById("oneWin"); startPoll(); if (!el) return;
  if (d.body && d.body.classList) d.body.classList.add("ow-on");
  if (el.hidden) { el.hidden = false; for (const c of (d.body && d.body.children) || []) if (c !== el && c.tagName !== "HEADER") c.inert = true; }
  if (!moving) showMoving(false);
}
function uncover() { try { uncoverNow(); } catch (_) {} }
function uncoverNow() {
  covered = false; const d = E.doc, el = d && d.getElementById && d.getElementById("oneWin"); if (!el) return;
  if (!el.hidden) for (const c of (d.body && d.body.children) || []) if (c !== el && c.tagName !== "HEADER") c.inert = false;
  el.hidden = true; if (d.body && d.body.classList) d.body.classList.remove("ow-on"); showMoving(false);
}
function showMoving(yes) { try { showMovingNow(yes); } catch (_) {} }
function showMovingNow(yes) {
  const d = E && E.doc, b = d && d.getElementById && d.getElementById("owUse"), m = d && d.getElementById && d.getElementById("owMoving");
  if (b) b.disabled = !!yes; if (m) m.textContent = yes ? "Moving here…" : "";
}
function startPoll() { if (!poll && !running()) poll = E.setI(() => { coverCheck().catch(() => {}); }, POLL); }
function stopPoll() { if (poll) { E.clearI(poll); poll = 0; } }

// Opens Fiala in this window once it holds the lock (start: main.js's boot). Returns at once; start runs now or later. Anything unforeseen here
// opens Fiala as before this feature (the pages share, as since v305): never a page that cannot open.
export function oneWindow(start, env) {
  try { oneWindowNow(start, env); } catch (_) { if (!started) begin0(); }
}
function oneWindowNow(start, env) {
  E = envOf(env); startFn = start;
  if (!E.locks || typeof E.locks.request !== "function" || !E.Channel || !E.ls) { begin0(); return; }   // no Web Locks (Safari before 15.4): the pages share, as since v305
  try { ch = new E.Channel(LOCK); ch.onmessage = onMsg; } catch (_) { ch = null; begin0(); return; }
  on = true;
  let use = false;
  try { const u = new URL(E.loc.href); if (u.searchParams.get("here") === "1") { use = true; u.searchParams.delete("here"); E.hist.replaceState(E.hist.state, "", u.pathname + u.search + u.hash); } } catch (_) {}   // Use here in a page that had lost Fiala: read once, then gone from the address (a later reload asks again)
  if (/access_token=|type=recovery|error_code=/.test(String((E.loc && E.loc.hash) || ""))) use = true;   // a sign-in or password link opened in a new window is used here: the window in use lets go
  const d = E.doc, w = E.win, b = d.getElementById && d.getElementById("owUse");
  if (b) b.addEventListener("click", useHere);
  d.addEventListener("visibilitychange", () => {
    if (started && !lost) { if (!ours()) { loseNow(); return; } writeRec(); if (vis() === "visible") { recheck().catch(() => {}); try { if (winHooks.shown) winHooks.shown(); } catch (_) {} } else { try { if (winHooks.hidden) winHooks.hidden(); } catch (_) {} } }
    else if (covered && vis() === "visible") coverCheck().catch(() => {});
  });
  w.addEventListener("pageshow", (e) => { if (!(e && e.persisted)) return; if (started && !lost) recheck().catch(() => {}); else if (covered) coverCheck().catch(() => {}); });
  w.addEventListener("focus", () => { if (covered) coverCheck().catch(() => {}); });
  w.addEventListener("pagehide", () => { if (started && !lost && holding && ours()) { writeRec("gone"); post({ t: "bye" }); } });
  take({ ifAvailable: true }).then((got) => { if (got === "error") { try { ch.close(); } catch (_) {} ch = null; begin0(); } else if (got) begin(); else return decideFor(use); return undefined; }).catch(() => { if (!started) { try { if (ch) ch.close(); } catch (_) {} ch = null; begin0(); } });   // the lock refused outright: the feature is off for this page (never a page that can't open)
}
function begin0() { on = false; started = booted = true; const s = startFn; startFn = null; if (s) s(); }

// For the tests: the state, and a fresh module state between runs of one probe.
export const winState = () => ({ on, holding, lost, started, booted, covered, moving, checking, me, tab: TAB });
