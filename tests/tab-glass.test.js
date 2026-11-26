// His ask, 25 Nov 2026: "I want the bar and both plus buttons match apples frosted bar from apple fitness .. can you match it exactly ?", then,
// of a first mockup that was only frost, "in apple fitness I cans see text though it's bar", and "make it sit as low as apples one .. but
// keep my height". v319: the tab bar and the round + (the one that adds a workout and the one that adds an exercise are one button: "I want
// them to be the same") wear Apple's tab bar glass, measured from his iPhone screenshot of Fitness (iOS 27.2) and from
// Fitness and Apple's own bar on the iOS 27.2 simulator, which agree:
//   - plain greys under the glass (0, 28, 64, 128, 192, 245, 255) read 32, 59, 89, 134, 166, 183, 185 in dark and 133, 147, 164, 195, 225,
//     249, 253 in light;
//   - words under the bar still read, dimmed: a white title stands out by about 17 of 255 on his iPhone (17 to 22 on the simulator), dark
//     words on white by about 13 in light;
//   - the chosen tab's capsule darkens the glass under it, 4 points in, with no rim; the bar is 21 points from the screen's foot.
// The glass is two layers behind the tabs and the + (::before the frost, ::after the tone and the lit edge), so the buttons' markup and
// every count of the bar's children stay as they were. v320: the layers sit at z-index 0 with the tabs and the + sign at 1 above them. Checked in the simulator's WebKit against Fitness's own bar and in headless Chrome.
// This file pins the numbers by working the layers out as a browser does (the measured rules: a layer's opacity blends its filtered
// backdrop with the sharp one, a later layer's backdrop takes in the earlier one's result, brightness cuts at white).
import fs from "node:fs";
import { test, assert } from "./assert.js";
const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const css = html.slice(html.indexOf("<style>"), html.indexOf("</style>"));
const one = (re, what) => { const m = re.exec(css); assert.ok(m, what + " found"); return m; };
const all = (re) => [...css.matchAll(re)];
const rule = (sel) => { const i = css.indexOf("\n  " + sel + " {"); assert.ok(i >= 0, sel + " has a rule"); return css.slice(i + 3, css.indexOf("}", i) + 1); };
// the tokens: light once, dark in both dark blocks (the phone's own dark and the forced theme)
const tokens = (name) => all(new RegExp("--" + name + ": ([^;]+);", "g")).map((m) => m[1].trim());
const num = (s) => Number(s);
const frostOf = (v) => ({ gain: num((/brightness\(([\d.]+)\)/.exec(v) || [0, 1])[1]), blur: num(/blur\(([\d.]+)px\)/.exec(v)[1]), sat: num(/saturate\(([\d.]+)\)/.exec(v)[1]) });
const rgba = (v) => { const m = /rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)/.exec(v); return { c: num(m[1]), g: num(m[2]), b: num(m[3]), a: num(m[4]) }; };
const clip = (x) => Math.max(0, Math.min(255, x));
// one look of the glass: what a plain grey x under it reads, and how far a small thing of grey t stands out from a field of grey x around it
// (small: the blur sees the field; the sharp part sees the thing)
function glass(k) {
  const frost = frostOf(tokens("tab-frost")[k]), on = num(tokens("tab-frost-on")[k]), bf = tokens("tab-tone-bf")[k], tint = rgba(tokens("tab-tone")[k]), toneOn = num(tokens("tab-tone-on")[k]);
  const mu = bf === "none" ? null : num(/brightness\(([\d.]+)\)/.exec(bf)[1]);
  const tone = (m) => (1 - toneOn) * m + toneOn * (tint.a * tint.c + (1 - tint.a) * (mu ? clip(mu * m) : m));
  const under = (sharp, field) => tone((1 - on) * sharp + on * clip(frost.gain * field));
  return { frost, on, mu, tint, toneOn, flat: (x) => under(x, x), small: (t, x) => under(t, x) - under(x, x) };
}
const LIGHT = 0, DARK = 1;

test("the bar and the round + have no fill, filter or opacity of their own: the glass is two layers behind them", () => {
  const bar = rule("#tabbar"), plus = rule(".dock-add");
  for (const [name, r] of [["the bar", bar], ["the +", plus]]) {
    assert.ok(/isolation: isolate;/.test(r), name + " keeps its layers to itself");
    assert.ok(!/backdrop-filter/.test(r), name + " filters nothing itself (in Chrome its layers would stop seeing the page)");
    assert.ok(!/[; ]opacity:/.test(r) && !/[; ]filter:/.test(r), name + ": no opacity, no filter");
    assert.ok(/box-shadow: var\(--tab-ring\);/.test(r), name + " carries only its ring, outside");
  }
  assert.ok(!/background/.test(bar), "the bar has no fill");
  assert.ok(/background: none;/.test(plus), "the +'s own grey button face is gone: it would be all the glass sees (found on the simulator: the + read 53 over black, the bar 32)");
  assert.ok(css.includes('\n  #tabbar::before, #tabbar::after, .dock-add::before, .dock-add::after { content: ""; position: absolute; inset: 0; z-index: 0; border-radius: inherit; pointer-events: none; }'), "both layers fill the glass and take no taps");
  assert.ok(css.includes("\n  #tabbar::before, .dock-add::before { -webkit-backdrop-filter: var(--tab-frost); backdrop-filter: var(--tab-frost); opacity: var(--tab-frost-on); }"), "the frost first");
  assert.ok(css.includes("\n  #tabbar::after, .dock-add::after { -webkit-backdrop-filter: var(--tab-tone-bf); backdrop-filter: var(--tab-tone-bf); background: var(--tab-tone); opacity: var(--tab-tone-on); box-shadow: var(--tab-edge); }"), "the tone and the lit edge over it");
  for (const old of ["--tab-fill", "--tab-shadow", "--tab-on:", "--tab-on-shadow", "blur(2.5px)"]) assert.ok(!css.includes(old), "the old glass is gone: " + old);
});

test("the + sign and the tabs sit above the glass by their own z-index; the layers are never under the bar by a negative one (v320)", () => {
  // His screenshot, 25 Nov 2026 ("when I pull all the way down the plus disappear"): with the layers at z-index -1 an iPhone drew the +'s own
  // sign in a separate front layer and dropped it while the page was pulled down past its top; the glass disc stayed, empty. The same on the
  // simulator (the sign's 140 bright pixels were 0 in every picture taken during the pull, 140 again at rest; with this rule 140 throughout).
  // The tabs, each with its own place in the stack, were never lost.
  const layers = /\n {2}#tabbar::before, #tabbar::after, \.dock-add::before, \.dock-add::after \{[^}]*\}/.exec(css)[0];
  assert.ok(/z-index: 0;/.test(layers) && !/z-index: -/.test(layers), "the layers at 0");
  assert.ok(css.includes("\n  .dock-add svg { position: relative; z-index: 1; width: 26px; height: 26px; }"), "the + sign above them");
  assert.ok(css.includes("\n  #tabbar button { position: relative; z-index: 1; }"), "the tabs above them (the tone layer comes after them in the page, so at 0 it would cover them)");
  assert.ok(/isolation: isolate;/.test(rule("#tabbar")) && /isolation: isolate;/.test(rule(".dock-add")), "and all of it stays inside the bar and the +");
});

test("the two round + are one button, and their markup is as it was", () => {
  const plus = [...html.matchAll(/<button class="dock-add trainer-only" id="(\w+)"[^>]*>(<svg[\s\S]*?<\/svg>)<\/button>/g)];
  assert.deepStrictEqual(plus.map((m) => m[1]), ["addBtn", "addExBtn"], "the + that adds a workout and the + that adds an exercise");
  assert.strictEqual(plus[0][2], plus[1][2], "the same sign");
  assert.ok(!/#addExBtn\b[^{]*\{/.test(css) && !/#addBtn\b[^{]*\{/.test(css), "neither has a look of its own");
  assert.ok(/<nav id="tabbar" aria-label="Sections" hidden>\s*<button type="button" data-tab="workouts"/.test(html), "the bar's first child is still its first tab");
});

test("the tokens: one set in light, the same set in both dark blocks", () => {
  for (const t of ["tab-frost", "tab-frost-on", "tab-tone-bf", "tab-tone", "tab-tone-on", "tab-cap", "tab-edge", "tab-ring"]) {
    const v = tokens(t);
    assert.strictEqual(v.length, 3, "--" + t + ": light, dark, dark");
    assert.strictEqual(v[1], v[2], "--" + t + " is the same in both dark blocks");
    assert.notStrictEqual(v[0], v[1], "--" + t + " differs in dark");
  }
});

test("frost: a 17-point blur, never at full strength, so what is under the glass still reads", () => {
  for (const k of [LIGHT, DARK]) {
    const g = glass(k);
    assert.strictEqual(g.frost.blur, 17, "Apple's blur, measured across a black and white edge");
    assert.ok(g.on >= 0.8 && g.on <= 0.9, "between a tenth and a fifth of the page stays sharp: " + g.on);
  }
  assert.strictEqual(glass(LIGHT).frost.gain, 1, "light: the page as it is");
  assert.strictEqual(glass(DARK).frost.gain, 1.35, "dark: the page 1.35 times brighter, cut at white, before the blur: white words give less glow");
});

test("dark: plain greys under the glass read as under Apple's bar, and white never comes near the white icons", () => {
  const g = glass(DARK);
  const APPLE = { 0: 32, 28: 59, 64: 89, 128: 134, 192: 166 };
  for (const [x, want] of Object.entries(APPLE)) assert.ok(Math.abs(g.flat(Number(x)) - want) <= 5, "grey " + x + ": " + g.flat(Number(x)).toFixed(1) + ", Apple " + want);
  assert.ok(Math.abs(g.flat(0) - 32) <= 1 && Math.abs(g.flat(28) - 59) <= 2.5, "the black page and a card, where the bar mostly sits: " + g.flat(0).toFixed(1) + ", " + g.flat(28).toFixed(1));
  const white = g.flat(255);
  assert.ok(white >= 160 && white <= 185, "white under the glass is a mid grey (Apple 185): " + white.toFixed(1));
  assert.ok(255 - white >= 70, "so a white icon or the + stays 70 or more above it (it was white on white over a card's set circle)");
});

test("dark: white words on a card show through, dimmed, as through Fitness's bar", () => {
  const g = glass(DARK);
  const stands = g.small(255, 28);
  assert.ok(stands >= 14 && stands <= 30, "a white word on a card stands out by about 17 to 22 of 255 (his iPhone: 17): " + stands.toFixed(1));
  assert.ok(g.small(255, 28) < 0.15 * 227, "far dimmer than on the page itself");
});

test("light: plain greys read as under Apple's light bar, and dark words show through, dimmed", () => {
  const g = glass(LIGHT);
  const APPLE = { 0: 133, 28: 147, 64: 164, 128: 195, 192: 225, 245: 249, 255: 253 };
  for (const [x, want] of Object.entries(APPLE)) assert.ok(Math.abs(g.flat(Number(x)) - want) <= 3, "grey " + x + ": " + g.flat(Number(x)).toFixed(1) + ", Apple " + want);
  const stands = g.small(29, 255);
  assert.ok(stands <= -9 && stands >= -18, "a dark word on white stands out by about 13 of 255: " + stands.toFixed(1));
});

test("the chosen tab: Apple's capsule, the glass under it made darker, 4 points in, no rim", () => {
  assert.ok(css.includes("\n  #tabbar button.on { color: var(--brand-text); -webkit-backdrop-filter: var(--tab-cap); backdrop-filter: var(--tab-cap); }"), "the capsule filters the glass under it; no fill, no shadow");
  const cap = (k) => { const m = /contrast\(([\d.]+)\) brightness\(([\d.]+)\)/.exec(tokens("tab-cap")[k]); const c = num(m[1]), b = num(m[2]); return (x) => clip(b * ((x - 127.5) * c + 127.5)); };
  const dark = cap(DARK), light = cap(LIGHT);
  for (const [x, want] of [[32, 10], [59, 33], [89, 60], [134, 99], [166, 127], [185, 143]]) assert.ok(Math.abs(dark(x) - want) <= 3, "dark, glass " + x + ": " + dark(x).toFixed(1) + ", Apple " + want);
  for (const [x, want] of [[133, 99], [147, 115], [164, 134], [195, 169], [225, 203], [249, 230], [253, 235]]) assert.ok(Math.abs(light(x) - want) <= 3, "light, glass " + x + ": " + light(x).toFixed(1) + ", Apple " + want);
  assert.ok(/#tabbar \{[^}]*padding: 4px;/.test(css), "4 in from the glass all round");
  assert.ok(/\n {2}#tabbar button \{[^}]*height: 52px;/.test(css), "so the bar keeps his 60 points (52 and 4 above and below)");
  assert.ok(/\n {2}#tabbar button \{[^}]*transition: -webkit-backdrop-filter 160ms ease, backdrop-filter 160ms ease, color 160ms ease;/.test(css), "the capsule still comes in over 160 ms");
});

test("the lit edge thins to nothing round the ends, and the ring is outside", () => {
  for (const k of [LIGHT, DARK]) {
    const edge = tokens("tab-edge")[k].split(/,\s*(?=inset)/);
    assert.strictEqual(edge.length, 8, "three steps of the line and a glow, top and bottom");
    for (const sh of edge) {
      const m = /^inset 0 (-?[\d.]+)px ([\d.]+)(?:px)? (-?[\d.]+)px rgba\(255,255,255,([\d.]+)\)$/.exec(sh); assert.ok(m, "a white inset shadow: " + sh);
      const off = Math.abs(num(m[1])), spread = num(m[3]);
      assert.strictEqual(spread, -1, "pulled in by 1");
      assert.ok(off > 1 && off <= 2, "and pushed down or up by more: it is a line at the top and bottom only");
    }
    const ring = tokens("tab-ring")[k];
    assert.ok(!/inset/.test(ring), "the ring is outside the glass");
    assert.ok(/1px 0 0 -0\.33px rgba\(0,0,0,[\d.]+\), -1px 0 0 -0\.33px rgba\(0,0,0,[\d.]+\)/.test(ring), "a darker line at the two ends");
  }
});

test("the bar sits as low as Apple's and keeps his height", () => {
  assert.ok(/\n {2}#dock \{ position: fixed; left: 0; right: 0; bottom: max\(8px, calc\(env\(safe-area-inset-bottom, 0px\) - 13px\)\); z-index: 45;/.test(css), "21 points from the foot of an iPhone (its inset is 34), 8 where there is none");
  assert.ok(/\n {2}\.dock-add \{ flex: none; width: 60px; height: 60px;/.test(css), "the + is as tall as the bar: 60");
  assert.ok(css.includes("\n  body.draft #dock { bottom: calc(79px + env(safe-area-inset-bottom, 0px)); }"), "over a template's Unsaved changes bar it floats where it did");
});
