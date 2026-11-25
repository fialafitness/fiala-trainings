// v321 (the twenty-seventh round): one window at a time (app/win.js), the lock and the page. The round-26 findings R26-WIN-3 (the page follows the
// phone's Text Size), R26-WIN-4 (index.html's loader starts main.js only while this window still holds Fiala), R26-TW-5 to R26-TW-8 (the promises
// no test held: the window Fiala moves to takes taps, a sleeper woken by being shown, a lost window carrying on, the 6 s and 4 s limits, and the
// smaller ones). Windows on stand-in Web Locks, BroadcastChannel and a clock (win-probe.mjs, the scenarios after 16), and one window running the
// real main.js behind the page (win-lock-r27-probe.mjs).
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { test, assert } from "./assert.js";
const here = path.dirname(fileURLToPath(import.meta.url)), root = path.join(here, "..");
const probe = (f) => JSON.parse(execFileSync(process.execPath, [path.join(here, f)], { encoding: "utf8", timeout: 120000 }).trim().split("\n").pop());
const r = probe("win-probe.mjs"), t = probe("win-lock-r27-probe.mjs");
const runs = (s) => !!s && s.startedCalls === 1 && s.started && !s.lost && s.holding && !s.cover;
const shows = (s) => !!s && s.cover && !(s.started && !s.lost);
const html = fs.readFileSync(path.join(root, "index.html"), "utf8"), winJs = fs.readFileSync(path.join(root, "app", "win.js"), "utf8");
const moduleScript = () => { const at = html.lastIndexOf('<script type="module">'); return at < 0 ? "" : html.slice(at, html.indexOf("</script>", at)); };

test("(v321) the stand-in windows' new scenarios ran without an error", () => {
  assert.strictEqual(r.errors, undefined, String(r.errors));
});

// R26-WIN-3
test("(v321, R26-WIN-3) the page \"Fiala is open in another window\" follows the phone's Text Size in a window that never ran main.js: as it shows, and each time it comes back on screen (Settings changed meanwhile) at once, the root as the app sets it, never above 1.5 times", () => {
  assert.deepStrictEqual(r.textSize, { atCover: "24.00px", page: true, larger: "18.82px", standard: "", capped: "24.00px", smaller: "", unread: "", back: "24.00px", later: [] });
});
test("(v321, R26-WIN-3) the page and the app agree: for every Text Size the page sets the root main.js's fitText sets (the same probe, over 17, kept between 1 and 1.5), and a window that then opens Fiala has main.js's own root", () => {
  assert.deepStrictEqual(t.page, { shown: true, owOn: true, root: "24.00px", starts: 0 }, "the page at a large Text Size, main.js never run");
  assert.strictEqual(t.fitText, true, "main.js's fitText is found by its name among its resize listeners");
  assert.deepStrictEqual(t.viaPage, ["", "", "", "", "16.02px", "16.94px", "18.82px", "20.00px", "24.00px", "24.00px", "24.00px", "", ""]);
  assert.deepStrictEqual(t.viaPage, t.viaApp, "for the sizes " + JSON.stringify(t.sizes));
  assert.deepStrictEqual(t.started, { before: "24.00px", root: "18.82px", starts: 1, page: false, owOn: false, lost: false }, "the Text Size changed before Fiala opened here: main.js's value");
});

// R26-WIN-4 and R26-TW-7
test("(v321, R26-WIN-4) index.html's own loader, run as written: a window that loses Fiala before its app has loaded never starts it behind the page (no sign-in, no kept words taken), and the window it moved to starts", () => {
  const l = r.loader;
  assert.strictEqual(l.found, true, "the module script's oneWindow call, with main.js?v=N in it, is found");
  assert.strictEqual(l.aBooted, 1); assert.deepStrictEqual(l.aWent, ["/?here=1"]);
  assert.deepStrictEqual(l.bTook, { started: true, lost: false, imports: 1 }, "Use here moved Fiala there and its main.js was asked for");
  assert.strictEqual(l.bBooted, 0, "main.js's boot ran in a window that had lost Fiala: " + JSON.stringify(l.b)); assert.ok(shows(l.b), JSON.stringify(l.b));
  assert.ok(runs(l.a2), JSON.stringify(l.a2)); assert.strictEqual(l.a2Booted, 1);
});
test("(v321, R26-TW-7) index.html starts main.js only through app/win.js, booting it only while this window still holds Fiala, and holds the page's parts by the ids win.js reads", () => {
  const mod = moduleScript();
  assert.ok(/import \{ oneWindow, winLost \} from "\.\/app\/win\.js";\s*oneWindow\(\(\) => import\("\.\/app\/main\.js\?v=\d+"\)\.then\(\(m\) => \{ if \(!winLost\(\)\) return m\.boot\(\); \}\)\);/.test(mod), "the module script: " + mod.slice(0, 400));
  assert.ok(!/(^|[^.\w])boot\(\)/.test(mod), "the module script calls boot() itself");
  assert.strictEqual((html.match(/main\.js\?v=\d+/g) || []).length, 1, "the page names its release once (sw.js and pageRelease read the first)");
  for (const id of ["oneWin", "owTitle", "owUse", "owMoving", "typeProbe"]) assert.strictEqual(html.split('id="' + id + '"').length - 1, 1, "#" + id + " must be in index.html once");
  for (const [, id] of winJs.matchAll(/getElementById\("([^"]+)"\)/g)) assert.ok(html.includes('id="' + id + '"'), "win.js reads #" + id + ", missing from index.html");
  assert.ok(/<section id="oneWin" hidden/.test(html), "#oneWin must start hidden");
});
test("(v321) the page as approved: its words (the owner's pick A), and nothing of the account showing over it (its bars and sheets sit above it, inert but still to be seen)", () => {
  assert.ok(html.includes('<h1 id="owTitle">Fiala is open in another window</h1>'));
  assert.ok(html.includes('<p class="ow-line">Fiala works in one window at a time. It&nbsp;continues here when you close the other one.</p>'));
  assert.ok(html.includes('<button class="btn" id="owUse" type="button">Use here</button>'));
  assert.ok(winJs.includes('"Moving here…"'));
  assert.ok(/\n  body\.ow-on > :not\(header\):not\(#oneWin\):not\(#topEdge\):not\(#edgeNudge\):not\(script\) \{ display: none !important; \}/.test(html), "the rule hiding the rest of the page under body.ow-on");
});

// R26-TW-5
test("(v321, R26-TW-5) the window Fiala moves to shows its page again and takes taps (no body.ow-on, nothing inert, the page hidden); the window that let go is covered, its header kept; and a newcomer's page goes once the window in use is closed", () => {
  const m = r.movedShown, open = { owOn: false, mainInert: false, headerInert: false, coverHidden: true }, covered = { owOn: true, mainInert: true, headerInert: false, coverHidden: false };
  assert.deepStrictEqual(m.bBefore, covered); assert.deepStrictEqual(m.b, open, "after Use here"); assert.deepStrictEqual(m.a, covered, "the window that let go");
  assert.ok(runs(m.bState), JSON.stringify(m.bState)); assert.ok(shows(m.aState), JSON.stringify(m.aState));
  assert.deepStrictEqual(m.afterClose.b, open, "after the window in use was closed"); assert.ok(runs(m.afterClose.bState), JSON.stringify(m.afterClose.bState));
});

// R26-TW-6
test("(v321, R26-TW-6) the window in use asleep and taken, woken by being shown before anything of it runs: it hears of the steal only then, leaves the record naming the window that took Fiala (which carries on), and shows the page", () => {
  const w = r.wokenShown;
  assert.ok(runs(w.bTook), JSON.stringify(w.bTook)); assert.deepStrictEqual(w.asleep, { holding: true, lost: false, lostHook: 0 }, "a sleeper hears nothing until it runs again (the stand-in as a frozen tab)");
  assert.strictEqual(w.recB, true, "the record still names the window that took Fiala"); assert.strictEqual(w.bLost, false, "that window must not stop at its next write");
  assert.ok(runs(w.b), JSON.stringify(w.b)); assert.ok(shows(w.a), JSON.stringify(w.a)); assert.strictEqual(w.a.lostHook, 1);
});

// R26-TW-8
test("(v321, R26-TW-8) a window that lost Fiala to Use here carries on by itself, a reload, once the window it moved to falls asleep out of sight; never in the pause after the move", () => {
  assert.deepStrictEqual(r.lostCarriesOn, { early: [], went: ["reload"], aLost: true });
});
test("(v321) ...and once the window in use is gone without its goodbye while on screen (its page crashed): the lock is free, so it carries on though the record still says on screen", () => {
  assert.deepStrictEqual(r.crashCarriesOn, { recVis: "visible", went: ["reload"] });
});
test("(v321, R26-TW-8) Use here while the window in use answers but never lets go (asleep in the middle of its hand-over): taken at 6 s, not before", () => {
  const w = r.waitLimit;
  assert.strictEqual(w.handed, 1); assert.deepStrictEqual(w.before, { started: 0, moving: "Moving here…" }, "at 5.5 s"); assert.ok(runs(w.after), "at 6.5 s: " + JSON.stringify(w.after)); assert.ok(shows(w.a), JSON.stringify(w.a));
});
test("(v321) Use here while the window in use hangs in its hand-over, awake (saves that never answer): it lets go after 4 s, and Fiala opens in the other window then", () => {
  const w = r.handLimit;
  assert.strictEqual(w.handed, 1); assert.deepStrictEqual(w.before, { started: 0, moving: "Moving here…" }, "at 3.5 s"); assert.ok(runs(w.after), "at 4.5 s: " + JSON.stringify(w.after)); assert.ok(shows(w.a), JSON.stringify(w.a)); assert.strictEqual(w.a.lostHook, 1);
});
test("(v321) three windows, Use here in one while the window in use falls asleep in its hand-over: the third holds back in the pause after the \"yield\" (no Fiala there in the middle of a move), and Fiala ends in the window where Use here was pressed", () => {
  const y = r.yieldPause;
  assert.deepStrictEqual(y.c, { started: 0, cover: true }, "2 s after the yield"); assert.deepStrictEqual(y.b, { started: 0, moving: "Moving here…" }); assert.deepStrictEqual(y.end, ["b23"]);
});
test("(v321) Use here where the lock's grant reaches the page after the other window's \"yielded\": the answer heard before its waiter counts, and Fiala opens at once, not a second later", () => {
  assert.ok(runs(r.heardFirst.b), JSON.stringify(r.heardFirst.b)); assert.ok(shows(r.heardFirst.a), JSON.stringify(r.heardFirst.a));
});
test("(v321) a move that fails (the lock refused): Use here comes back, \"Moving here…\" goes, and the page stays", () => {
  assert.deepStrictEqual(r.moveFailed.moving, { text: "Moving here…", disabled: true });
  const s = r.moveFailed.after; assert.deepStrictEqual({ moving: s.moving, useDisabled: s.useDisabled, cover: s.cover, started: s.startedCalls }, { moving: "", useDisabled: false, cover: true, started: 0 });
});
test("(v321) the window in use asleep and taken, then closed before it runs again: its pagehide never writes \"gone\" over the record of the window that took Fiala, which carries on", () => {
  const c = r.closedAsleep; assert.deepStrictEqual({ recB: c.recB, recVis: c.recVis, bLost: c.bLost }, { recB: true, recVis: "visible", bLost: false }); assert.ok(runs(c.b), JSON.stringify(c.b));
});
test("(v321) a check and Use here at once, the lock free and its grant still on the way: Fiala opens once, and Use here never takes the lock from this page itself (the page lost Fiala and reloaded)", () => {
  assert.ok(runs(r.checkAndUse.b), JSON.stringify(r.checkAndUse.b)); assert.deepStrictEqual(r.checkAndUse.b.went, []);
});
test("(v321) focused (a click into it on the Mac) after the window in use fell asleep out of sight: the page checks at once and Fiala opens within a second, not at the next 2 s check", () => {
  assert.ok(runs(r.focusCheck.b), JSON.stringify(r.focusCheck.b));
});
