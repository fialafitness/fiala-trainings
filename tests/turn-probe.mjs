// Run by turn.test.js in its own process: the page once the phone has turned (his find, 13 Nov: the workout bar left mid-screen after a turn
// to landscape and back). The window keeps its listeners; its size, its scroll and the page's height are this probe's; every timer and frame
// runs on this probe's own clock; it prints, as JSON, where the page was scrolled at each step.
import "./env.js";
let NOW = 10000, SEQ = 0; const Q = [];
globalThis.setTimeout = (fn, ms) => { const id = ++SEQ; Q.push({ id, at: NOW + Math.max(0, ms || 0), fn }); return id; };
globalThis.clearTimeout = (id) => { const i = Q.findIndex((q) => q.id === id); if (i >= 0) Q.splice(i, 1); };
let RAF = []; globalThis.requestAnimationFrame = (fn) => { RAF.push(fn); return RAF.length; };
try { performance.now = () => NOW; } catch (_) { Object.defineProperty(globalThis, "performance", { value: { now: () => NOW }, configurable: true }); }
const flush = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };
async function advance(ms) { const end = NOW + ms; for (;;) { Q.sort((a, b) => a.at - b.at || a.id - b.id); const q = Q[0]; if (!q || q.at > end) break; Q.shift(); NOW = Math.max(NOW, q.at); q.fn(); await flush(); } NOW = end; await flush(); }
const frame = () => { const fs = RAF; RAF = []; for (const f of fs) f(); };
const WIN = {}; globalThis.addEventListener = (t, fn) => { (WIN[t] ||= []).push(fn); }; globalThis.removeEventListener = () => {};
const winFire = (t) => { for (const fn of [...(WIN[t] || [])]) fn({ type: t }); };
globalThis.innerWidth = 402; globalThis.innerHeight = 812; globalThis.scrollX = 0; globalThis.scrollY = 0;
let pageHeight = 2343; Object.defineProperty(document.documentElement, "scrollHeight", { get: () => pageHeight, configurable: true });
const scrolls = []; globalThis.scrollTo = (x, y) => { scrolls.push(y); globalThis.scrollY = y; winFire("scroll"); };
await import("../app/main.js");
await advance(2000); RAF = [];
const size = (w, h) => { globalThis.innerWidth = w; globalThis.innerHeight = h; winFire("resize"); };
const userScroll = (y) => { globalThis.scrollY = y; winFire("scroll"); };   // the page moving under a finger, or by the turn itself
const out = {};
const reset = async (y = 1500, h = 2343) => { size(402, 812); await advance(2000); frame(); RAF = []; scrolls.length = 0; pageHeight = h; globalThis.scrollY = y; };   // upright again, as a phone tells it, and settled
// a turn to landscape and back at the foot of a workout, as iOS sizes the page: landscape, then upright at full height, then the clock's strip back
{ await reset(1517);
  size(874, 402); userScroll(1469); await advance(600); const afterLand = scrolls.slice(); frame(); scrolls.length = 0; globalThis.scrollY = 1927;
  size(402, 874); userScroll(1455); await advance(330); size(402, 812); userScroll(1517); await advance(399); const early = scrolls.slice();
  await advance(1); const moved = scrolls.slice(); frame(); out.turn = { afterLand, early, moved, back: scrolls.slice(), y: globalThis.scrollY }; }
// at the top of the page: a point down and back
{ await reset(0); size(874, 402); await advance(400); frame(); out.top = { scrolls: scrolls.slice(), y: globalThis.scrollY }; }
// the keyboard (the height alone changes): the page is never moved for it
{ await reset(800); size(402, 416); await advance(1000); size(402, 812); await advance(1000); frame(); out.keyboard = scrolls.slice(); }
// a page that does not scroll even sideways: nothing to do
{ await reset(0, 380); size(874, 402); await advance(1000); frame(); out.short = scrolls.slice(); }
// a fling going on when the turn settles: after it has stopped
{ await reset(1200); size(874, 402); await advance(350); for (let i = 0; i < 5; i++) { userScroll(1200 + i * 40); await advance(100); } const during = scrolls.slice(); await advance(149); const stillWaiting = scrolls.slice(); await advance(1); const moved = scrolls.slice(); frame();
  out.fling = { during, stillWaiting, moved, after: scrolls.slice(), y: globalThis.scrollY }; }   // (the last scroll at 750 ms: the page still at 999, the point down at 1000)
// a finger takes the page between the point down and the frame: it is left where the finger put it
{ await reset(1500); size(874, 402); await advance(400); userScroll(1300); frame(); out.finger = { scrolls: scrolls.slice(), y: globalThis.scrollY }; }
// a second turn before the first has settled: one settle, after the last
{ await reset(1500); size(874, 402); await advance(300); size(402, 812); await advance(300); const mid = scrolls.slice(); await advance(100); frame(); out.twice = { mid, scrolls: scrolls.slice() }; }
console.log(JSON.stringify(out));
