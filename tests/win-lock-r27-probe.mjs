// Run by win-lock-r27.test.js in its own process (v321, the twenty-seventh round, R26-WIN-3): the page "Fiala is open in another window" follows
// the phone's Text Size in a window that never ran main.js, as main.js's fitText makes the app follow it. One window on the browser stand-ins
// (env.js), its hidden probe #typeProbe in the system font at a size the test sets (the Text Size); another window holds Fiala and answers, so
// this one shows the page (win.js's fitRoot sets the root); then the other goes, this window opens Fiala and the real main.js loads (its fitText
// sets the root); the same sizes are run through both. Prints one JSON line.
await import("./env.js");
const out = {};
const probe = document.getElementById("typeProbe"); let typePx = 25.5;   // the system font's size at the phone's Text Size (17 at the standard one)
globalThis.getComputedStyle = (e) => ({ getPropertyValue: () => "", display: "block", color: "", fontSize: e === probe && typePx != null ? typePx + "px" : "" });
const winL = new Map(), docL = new Map(), keep = (m) => (t, f) => { if (!m.has(t)) m.set(t, []); m.get(t).push(f); };
globalThis.addEventListener = keep(winL); document.addEventListener = keep(docL);   // the window's and the page's listeners, kept to be fired
const fire = (m, t) => { for (const f of m.get(t) || []) f({ type: t }); };
const root = () => document.documentElement.style.fontSize || "";
document.getElementById("oneWin").hidden = true;                         // as the markup has it
let T = 0; const timers = [];                                            // win.js's clock
const at = (ms, fn) => { const t = { at: T + Math.max(0, ms), fn, id: timers.length + 1, live: true }; timers.push(t); return t; };
const flush = async () => { for (let i = 0; i < 30; i++) await Promise.resolve(); await new Promise((r) => setImmediate(r)); };
async function advance(ms) { const end = T + ms; for (;;) { await flush(); const due = timers.filter((t) => t.live && t.at <= end).sort((a, b) => a.at - b.at || a.id - b.id)[0]; if (!due) break; due.live = false; T = Math.max(T, due.at); due.fn(); } T = end; await flush(); }
const other = { here: true };                                            // the window in use: it holds the lock and answers
const locks = {
  request(name, opts, cb) { if (typeof opts === "function") { cb = opts; opts = {}; } const taken = name === "fiala.window" && other.here;
    if (taken && opts.ifAvailable) return Promise.resolve().then(() => cb(null));
    if (taken) return new Promise(() => {});                              // (never asked here: the other window answers while it holds Fiala)
    return Promise.resolve().then(() => cb({ name, mode: "exclusive" })); },
  async query() { return { held: other.here ? [{ name: "fiala.window", mode: "exclusive", clientId: "other" }] : [], pending: [] }; },
};
class Channel { constructor() { this.onmessage = null; } close() {} postMessage(m) { if (m && m.t === "who" && other.here) at(1, () => { if (this.onmessage) this.onmessage({ data: { v: 1, from: "other-window", t: "here", to: m.from, n: m.n } }); }); } }
const W = await import("../app/win.js");
let mainP = null, starts = 0;
W.oneWindow(() => { starts++; mainP = import("../app/main.js"); return mainP; }, {
  locks, Channel, ls: localStorage, doc: document, win: globalThis, loc: { href: "https://app.example/", hash: "" }, hist: { state: null, replaceState() {} },
  now: () => T, clock: () => 1795600000000 + T, setT: (f, ms) => at(ms, f), clearT: (t) => { if (t) t.live = false; },
  setI: (f, ms) => { const k = { live: true }; const go = () => { k.t = at(ms, () => { if (!k.live) return; f(); go(); }); }; go(); return k; }, clearI: (k) => { if (k) { k.live = false; if (k.t) k.t.live = false; } },
  Abort: AbortController, go: () => {},
});
await advance(1000);
out.page = { shown: !document.getElementById("oneWin").hidden, owOn: document.body.classList.contains("ow-on"), root: root(), starts };
const SIZES = [12, 16, 17, 17.01, 17.02, 18, 20, 21.25, 25.5, 30, 40, 0, null];   // the probe's size in px (null: none read)
const viaPage = [];
for (const px of SIZES) { document.visibilityState = "hidden"; fire(docL, "visibilitychange"); typePx = px; document.visibilityState = "visible"; fire(docL, "visibilitychange"); await advance(5); viaPage.push(root()); }
typePx = 25.5; document.visibilityState = "hidden"; fire(docL, "visibilitychange"); document.visibilityState = "visible"; fire(docL, "visibilitychange"); await advance(5);
const before = root();
typePx = 20; other.here = false;                                         // the Text Size changed meanwhile, and the window in use is closed: Fiala opens here
await advance(2500); if (mainP) await mainP; await advance(10);
out.started = { before, root: root(), starts, page: !document.getElementById("oneWin").hidden, owOn: document.body.classList.contains("ow-on"), lost: W.winLost() };
const fitText = (winL.get("resize") || []).find((f) => f.name === "fitText");   // main.js's own (it listens for resize and for the page coming back)
const viaApp = [];
if (fitText) for (const px of SIZES) { typePx = px; fitText(); viaApp.push(root()); }
Object.assign(out, { sizes: SIZES, viaPage, viaApp, fitText: !!fitText });
console.log(JSON.stringify(out));
process.exit(0);
