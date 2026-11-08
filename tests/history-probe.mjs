// Run by history.test.js in its own process: loads the real app/main.js as one kind of page and prints, as JSON, every history call it makes.
// mode: "tab" (a Safari tab or an Android install), "ios" (the iOS home-screen app, opened fresh), "stale" (the home-screen app reloaded in place
// by an update, with three steps an older version left: it is on the third).
import "./env.js";
const mode = process.argv[2] || "ios";
const calls = [], listeners = {};
const fire = (type, ev) => { for (const fn of listeners[type] || []) fn(ev); };
globalThis.addEventListener = (type, fn) => { (listeners[type] ||= []).push(fn); };
const hist = {
  length: 1, state: null, scrollRestoration: "auto",
  pushState(s) { calls.push("pushState " + JSON.stringify(s)); this.state = s; this.length++; },
  replaceState(s) { calls.push("replaceState " + JSON.stringify(s)); this.state = s; },
  go(n) {                                                   // the browser: moves along its steps and says so a moment later
    calls.push("go " + n);
    const d = Math.max(0, ((this.state && this.state.fiala) || 0) + n); this.state = { fiala: d };
    setTimeout(() => fire("popstate", { state: this.state }), 5);
  },
};
if (mode === "stale") { hist.length = 3; hist.state = { fiala: 2 }; }
Object.defineProperty(globalThis, "history", { value: hist, configurable: true, writable: true });
if (mode !== "tab") globalThis.navigator.standalone = true;
const app = (await import("../app/main.js")).internals();
const tick = (ms = 30) => new Promise((r) => setTimeout(r, ms));
const out = { mode };
await tick();
out.load = calls.splice(0); out.stateAfterLoad = hist.state;
app.fns.showExercise("Bench Press", "benchpress"); await tick();
out.forwardKey = app.fns.navState().key; out.forward = calls.splice(0);
await app.fns.goBackNow(); await tick();
out.backKey = app.fns.navState().key; out.back = calls.splice(0); out.depth = app.fns.navState().depth;
hist.state = null; fire("popstate", { state: null }); await tick();         // a step with no number (a link to "#")
out.popNull = calls.splice(0);
hist.state = { fiala: 1 }; fire("popstate", { state: { fiala: 1 } }); await tick();   // iOS's forward swipe onto an old step
out.popOld = calls.splice(0); out.keyAfterPops = app.fns.navState().key;
console.log(JSON.stringify(out));
process.exit(0);
