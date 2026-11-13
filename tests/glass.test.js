// His asks, 13 Nov: "measure exactly how Apple would do edit buttons .. I believe it has some" (his Mail screenshot, a Select button), then
// "do my buttons just like Apple does theirs"; his pick A the same day: Apple's glass on the floating bar buttons (back, Messages, "…", the
// Templates pages' + …, and the preview's ×, "…", ‹ › and Edit), the page's own buttons plain as Apple's are (Fitness' "Add to Workout App",
// the × in Reminders' card: measured flat), and the round buttons inside a card in Apple's own card grey. Every value was measured pixel by
// pixel on iOS 27.2 (his Mail screenshot; Photos, Reminders, Calendar's event sheet, Contacts on the Simulator) and fitted in WebKit at 3x.
import fs from "node:fs";
import { test, assert } from "./assert.js";
const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const LIGHT_EDGE = "inset 0 1.67px 0 -0.67px rgba(255,255,255,0.5), inset 0 -1.67px 0 -0.67px rgba(255,255,255,0.5), inset 0 5px 0 -4.33px rgba(255,255,255,0.8), inset 0 -5px 0 -4.33px rgba(255,255,255,0.8), inset 0 20px 5px -17px rgba(255,255,255,0.6), inset 0 -10px 3px -8.67px rgba(255,255,255,0.2), inset 0 10px 5px 6px rgba(0,0,0,0.016), 0 0 0 0.33px rgba(0,0,0,0.052), 0 0 0 0.67px rgba(0,0,0,0.052), 1px 0 0 -0.33px rgba(0,0,0,0.2), -1px 0 0 -0.33px rgba(0,0,0,0.2), 0 7.67px 5.33px rgba(0,0,0,0.013)";
const DARK_PAGE_EDGE = "inset 0 19px 0 -18.67px rgba(255,255,255,0.094), inset 0 -19px 0 -18.67px rgba(255,255,255,0.094), inset 0 1.67px 0 -1px rgba(255,255,255,0.02), inset 0 -1.67px 0 -1px rgba(255,255,255,0.02), inset 0 8.33px 0 -7.33px rgba(255,255,255,0.034), inset 0 -8.33px 0 -7.33px rgba(255,255,255,0.034), inset 0 1.33px 0 -0.33px rgba(255,255,255,0.063), inset 0 -1.33px 0 -0.33px rgba(255,255,255,0.063), inset 0 24.67px 8px -24.33px rgba(255,255,255,0.112), inset 0 -24.67px 8px -24.33px rgba(255,255,255,0.112), inset 0 17.33px 0 -16.67px rgba(255,255,255,0.048), inset 0 -17.33px 0 -16.67px rgba(255,255,255,0.048)";
const DARK_SHEET_EDGE = "inset 0 1.67px 0 -0.67px rgba(255,255,255,0.07), inset 0 -1.67px 0 -0.67px rgba(255,255,255,0.07), inset 0 5px 0 -4.33px rgba(255,255,255,0.1), inset 0 -5px 0 -4.33px rgba(255,255,255,0.1), inset 0 20px 4.67px -19.33px rgba(255,255,255,0.11), inset 0 -20px 4.67px -19.33px rgba(255,255,255,0.11), 1px 0 0 -0.33px rgba(0,0,0,0.62), -1px 0 0 -0.33px rgba(0,0,0,0.62)";
const count = (s) => html.split(s).length - 1;

test("the glass, light: one material on the page and on the preview (#f8f8f8, Apple's on #f5f5f5: 247.4 on #F2F2F7, 252 on white, measured), its edge lit from above and below with a grey ring and a faint shadow", () => {
  assert.ok(html.includes("    --disc-fill: #f8f8f8; --disc-ink: #1d1d1f;"), "the light fill, once in :root");
  assert.strictEqual(count("--disc-edge: " + LIGHT_EDGE + ";"), 1, "the light edge, its layers in the fitted order");
  assert.ok(html.includes("--glass-sheet-fill: #f8f8f8; --glass-sheet-edge: var(--disc-edge);"), "the preview's the same in light");
});

test("the glass, dark, in BOTH dark blocks (the phone's Auto and Dark chosen): #1f1f1f with a bright line at the top and bottom on the black page (his Mail: 12% white, 99/79/63 then a glow), #3a3a3c with a lighter line and dark ends on the #1c1c1e preview (Calendar's sheet)", () => {
  assert.strictEqual(count("--disc-fill: #1f1f1f; --disc-ink: #ffffff;"), 2);
  assert.strictEqual(count("--disc-edge: " + DARK_PAGE_EDGE + ";"), 2);
  assert.strictEqual(count("--glass-sheet-fill: #3a3a3c; --glass-sheet-edge: " + DARK_SHEET_EDGE + ";"), 2);
  assert.ok(!/--disc-fill: (#333436|#e5e5ea)/.test(html), "the old flat greys gone from the bar buttons");
});

test("every floating bar button wears the edge; the preview's take the sheet's glass; the + and … are one capsule, drawn once behind both halves (each half's own edge would draw a line where they meet)", () => {
  assert.ok(html.includes("  .back, .bar-msg, .bar-more, .pv-x, .pv-pager, .pv-edit { box-shadow: var(--disc-edge); }"));
  assert.ok(html.includes("  .sheet.pv-sheet { --disc-fill: var(--glass-sheet-fill); --disc-edge: var(--glass-sheet-edge); }"));
  assert.ok(html.includes("  #tAdd:not([hidden]), #tAdd:not([hidden]) + #tMore { background: transparent; box-shadow: none; }"));
  assert.ok(html.includes('  #tAdd:not([hidden])::after { content: ""; position: absolute; left: 0; top: 0; width: 103px; height: 44px; border-radius: 22px; background: var(--disc-fill); box-shadow: var(--disc-edge); z-index: -1; pointer-events: none; }'), "on ::after: ::before is the wider tap area");
  assert.ok(html.includes("  .disc::before") || html.includes(".disc::before { content: \"\"; position: absolute; inset: -4px; }"), "(the tap area it must not take)");
  assert.ok(/\.pv-edit \{[^}]*padding: 0 16\.5px;/.test(html), "Edit's word 17.4 points from its ends with Inter, as Apple's 17.5");
});

test("the page's own buttons stay plain, as Apple's do; the round ones inside a card take Apple's card grey (Reminders' card ×: 226 on white, 59 on #1c1c1e: system fill)", () => {
  assert.ok(html.includes("--card-disc: rgba(120,120,128,0.215);"), "light");
  assert.strictEqual(count("--card-disc: rgba(120,120,128,0.335);"), 2, "dark, both blocks");
  for (const sel of ["body:not(.client) .ex-icons button { width: 36px; height: 36px; border-radius: 50%; background: var(--card-disc);", ".card-chev { position: absolute; right: 12px; z-index: 2; appearance: none; border: 0; background: var(--card-disc);", "body.client .ex-icons .alt-btn { width: 36px; height: 36px; margin-right: 10px; border-radius: 50%; background: var(--card-disc);", ".list li.swipe-row.swiped > button.miss-more { background: var(--card-disc); }"])
    assert.ok(html.includes(sel), sel.slice(0, 40));
  assert.ok(/\.btn\.tint \{ background: var\(--glyph-fill\);/.test(html), "the grey capsules unchanged (Finish early, Skip workout)");
});
