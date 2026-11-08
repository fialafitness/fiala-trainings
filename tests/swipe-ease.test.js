// The swipe's release curve: UIKit's spring (damping 0.85, response 0.3 s), written as a cubic-bezier. WebKit (iOS 27.2) runs a cubic-bezier transition
// in Core Animation, at the screen's own rate and through any work on the page; a linear() one runs on the page itself at 60 and stops when it is busy
// (measured in the iOS 27.2 Simulator, 8 Nov). So the easing must stay a cubic-bezier, and it must stay within a few percent of the spring.
import { test, assert } from "./assert.js";
import { load } from "./load.js";
const { fns } = await load();
const spring = (v0, response, damping) => {                       // the spring itself, cut where it first arrives (as the app does)
  const w0 = 2 * Math.PI / response, wd = w0 * Math.sqrt(Math.max(1e-6, 1 - damping * damping)), a = damping * w0, b = (a - v0) / wd;
  const y = (t) => Math.exp(-a * t) * (Math.cos(wd * t) + b * Math.sin(wd * t));
  let T = 0.02; while (T < 1.5 && y(T) > (damping < 1 ? 0.001 : 0.005)) T += 0.004;
  return { f: (u) => 1 - y(u * T), ms: Math.round(T * 1000) };
};
const bezier = (css) => {                                          // progress at time u of a CSS cubic-bezier
  const m = /^cubic-bezier\(([^)]+)\)$/.exec(css); assert.ok(m, "a cubic-bezier: " + css);
  const [x1, y1, x2, y2] = m[1].split(",").map(Number);
  assert.ok(x1 >= 0 && x1 <= 1 && x2 >= 0 && x2 <= 1, "x control points within 0..1: " + css);
  const X = (t) => 3 * (1 - t) * (1 - t) * t * x1 + 3 * (1 - t) * t * t * x2 + t * t * t, Y = (t) => 3 * (1 - t) * (1 - t) * t * y1 + 3 * (1 - t) * t * t * y2 + t * t * t;
  return (u) => { let lo = 0, hi = 1, t = u; for (let i = 0; i < 60; i++) { const e = X(t) - u; if (Math.abs(e) < 1e-7) break; if (e > 0) hi = t; else lo = t; t = (lo + hi) / 2; } return Y(t); };
};
test("the swipe settles on UIKit's spring written as a cubic-bezier (Core Animation runs it), within 3% of the spring, at every speed it can start with", () => {
  for (const [response, damping, worst] of [[0.3, 0.85, 0.03], [0.416, 0.75, 0.02], [0.3, 1, 0.08]]) {
    for (const v0 of [-15, -8, -3, 0, 1, 3, 6, 10, 15]) {
      const e = fns.springEase(v0, response, damping), s = spring(v0, response, damping), B = bezier(e.css);
      assert.strictEqual(e.ms, s.ms, "its length is the spring's");
      let m = 0; for (let i = 0; i <= 100; i++) m = Math.max(m, Math.abs(B(i / 100) - s.f(i / 100)));
      assert.ok(m < worst, `${response}/${damping} from ${v0}: ${(m * 100).toFixed(2)}% off the spring`);
    }
  }
  assert.ok(!/linear\(/.test(fns.springEase(0, 0.3, 0.85).css), "never linear()");
});
