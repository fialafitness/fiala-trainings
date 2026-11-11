// His asks, 11 Nov: "add arrow buttons in shared pills like Apple does it to go to the next workout and previous all the way till today … not
// history and all the way till the last scheduled workout … you will also be able to slide finger to the next workout and it will have the same
// sliding effect like calendar in month view … the arrows will be on top right corner and then to them there will be our typical … button …
// when client clicks on it they will see reschedule and skip … coach will see one more option and that is delete workout", "another tab in …
// button for coach will be copy workout". His picks the same day: the "…" left of the arrows; every preview walks the missed workouts too, each
// clearly marked missed (the red word, as its row says it); after Skip or Delete the next workout; after Reschedule the same workout on its new
// day (a tap on the day is enough); Do it today first on a missed one. Checked on the test iPhone: the arrows, the finger's slide and the sheet's
// height easing with it, the rubber band at the first, and each of the "…"'s rows over the preview. The fingers and the sheets play in their
// own process (preview-pager-probe.mjs).
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test, assert } from "./assert.js";
import { load } from "./load.js";
const { fns } = await load();
const probe = path.join(path.dirname(fileURLToPath(import.meta.url)), "preview-pager-probe.mjs");
const r = JSON.parse(execFileSync(process.execPath, [probe], { encoding: "utf8", timeout: 60000 }).trim().split("\n").pop());
const CURVE = "280ms cubic-bezier(0.22, 1, 0.36, 1)";                     // the month view's own slide
const at = (id, prev, next) => ({ id, slide: null, prev, next });         // landed on id, its arrows dimmed (true) or not

test("the walk: every workout of the client still to do, by its day and then as made: the missed ones, today's (the morning one first), the ones to come; never a finished or skipped one (History), another client's; a workout no longer in it (finished meanwhile) has the ones either side of where it would sort", () => {
  assert.deepStrictEqual(r.walk, ["m2", "m1", "a", "b", "c", "d"]);
  assert.deepStrictEqual(r.near, { a: { prev: "m1", next: "b" }, m2: { prev: null, next: "m1" }, d: { prev: "c", next: null }, f: { prev: "m1", next: "a" }, gone: { prev: null, next: null } });
});

test("the \"…\": Reschedule and Skip on any workout still to do; Do it today first on a missed one; the coach's own view adds Copy workout and, last and red, Delete workout; a finished one offers the coach only Copy and Delete, the client nothing (the \"…\" dimmed)", () => {
  assert.deepStrictEqual(r.items, { coach: ["Reschedule", "Skip", "Copy workout", "!Delete workout"], coachMissed: ["Do it today", "Reschedule", "Skip", "Copy workout", "!Delete workout"], coachFinished: ["Copy workout", "!Delete workout"],
    client: ["Reschedule", "Skip"], clientMissed: ["Do it today", "Reschedule", "Skip"], clientFinished: [] });
  assert.deepStrictEqual(r.menu, { rows: ["Reschedule", "Skip", "Copy workout", "!Delete workout"], bgHidden: false, closedOnSlide: true }, "the menu opens over the preview with those rows, and a slide closes it");
});

test("the arrows: dimmed at the first and the last workout; nothing in the sheet's first 350 ms (a double tap's second tap); a tap slides on the month view's curve: the workout it goes to is the preview's at once (its name, its list at its top, still, VoiceOver hears it), as the month view takes its month at the let-go; a copy of the page going out slides away over it and the incoming one comes in beside that (each from its top, out of reach of taps and VoiceOver), the header's veil leaving with the page under it; it lands at 360 ms at the latest (or on the page going out's own transitionend), the copies gone", () => {
  assert.deepStrictEqual(r.ends, { first: at("m2", true, false), last: at("d", false, true), mid: at("a", false, false), more: false });
  assert.deepStrictEqual(r.guard, at("a", false, false));
  const { say: said, ...d } = r.tap.during, page = (tf) => ({ tr: "transform " + CURVE, tf, top: "0px", bottom: "80px", inert: true, aria: "true", cls: "pv-scroll pv-peek" });
  assert.deepStrictEqual(d, { id: "b", slide: { dir: 1, to: "b", x: 0, settling: true }, prev: false, next: false, list: { tr: "", tf: "" }, peek: page("translate3d(0px,0,0)"), out: page("translate3d(-402px,0,0)"), outScroll: 0, bar: "B", title: "B", top: true, veil: { on: "0", x: "-402px", tr: "transform " + CURVE, titled: false } });
  assert.ok(/^B, \w+day, \w{3} \d{1,2}(, \d{4})?$/.test(said), said);
  assert.deepStrictEqual(r.tap.at359, { ...at("b", false, false), slide: { dir: 1, to: "b", x: 0, settling: true } });
  const { say, ...landed } = r.tap.landed;
  assert.deepStrictEqual(landed, { id: "b", slide: null, prev: false, next: false, list: { tr: "", tf: "" }, peekGone: true, outGone: true, veil: { on: "0", x: null, tr: null, titled: false }, title: "B", top: true });
  assert.strictEqual(say, said, "the line it heard at the let-go, kept");
  assert.deepStrictEqual(r.ended, { others: true, ...at("b", false, false) }, "the page going out's own transitionend (not the still list's, the incoming page's or a card's on its way up)");
  assert.deepStrictEqual(r.g15, ["translate3d(402px,0,0)", "", "translate3d(-402px,0,0)", ""], "each page placed before anything moves it: the one coming in at its own side (› from the right, ‹ from the left), the copy going out where the list was");
});

test("two quick taps go two workouts (the first lands at once, as the month's arrows); back to the first, then nothing further; Reduce Motion lands at once with no slide", () => {
  assert.deepStrictEqual([r.twoTaps.mid.id, r.twoTaps.mid.slide.to, r.twoTaps.landed], ["c", "c", at("c", false, false)]);
  assert.deepStrictEqual(r.back, { one: "m1", two: "m2", three: at("m2", true, false) });
  assert.deepStrictEqual(r.calm, { ...at("b", false, false), tr: "" });
});

test("the finger: 8 points sideways within 30 degrees of level is a slide, refused at once (so iOS starts no scroll of the list), from the list or the header; it follows from there with no jump; let go past 48 points it goes on (either way), else back; a cancelled touch goes back; with nothing that way a third of the way, and back; steeper is nobody's; a move that can no longer be refused (iOS scrolling the list) is never a slide", () => {
  assert.deepStrictEqual([r.fling.p, r.fling.during.slide, r.fling.landed], [[true, true, true], { dir: 1, to: "b", x: -52, settling: false }, at("b", false, false)]);
  assert.deepStrictEqual([r.short.during.slide.x, r.short.landed], [-22, at("a", false, false)]);
  assert.deepStrictEqual([r.right.during.slide, r.right.landed], [{ dir: -1, to: "m1", x: 62, settling: false }, at("m1", false, false)]);
  assert.deepStrictEqual([r.cancelled.during.slide.x, r.cancelled.landed], [-92, at("a", false, false)]);
  assert.deepStrictEqual([r.band.during.slide, r.band.landed], [{ dir: -1, to: null, x: 20, settling: false }, at("m2", true, false)]);
  assert.deepStrictEqual([r.steep.p, r.steep.during.slide, r.steep.landed], [[false], null, at("a", false, false)]);
  assert.deepStrictEqual([r.header.during.slide.x, r.header.landed], [-62, at("b", false, false)]);
  assert.deepStrictEqual([r.native.p, r.native.landed], [[false, false], at("a", false, false)]);
});

test("never a slide and a scroll at once: the list scrolled anyway, the slide goes back; a new finger lands a slide still settling at once; the click after a slide presses nothing", () => {
  assert.deepStrictEqual([r.scrolled.scrolled.slide.settling, r.scrolled.landed], [true, at("a", false, false)]);
  assert.deepStrictEqual(r.caught, { ...at("b", false, false), drag: true });
  assert.strictEqual(r.eaten, true);
});

test("a sync's redraw waits for a slide (the list takes the workout it went to once, at the let-go, and nothing rebuilds it under way); a redraw mid-slide paints nothing and closes nothing; a workout a sync took away mid-slide closes the preview where it would land, a short slide's springing back too; the page behind is redrawn as it lands, not before", () => {
  assert.deepStrictEqual([r.redraw.atGo, r.redraw.held, r.redraw.direct, r.redraw.landed], [1, 0, { id: "b", paints: 0 }, at("b", false, false)]);
  assert.ok(r.redraw.after >= 1);
  assert.deepStrictEqual(r.goneMid, { id: null, slide: null, prev: false, next: false });
  assert.deepStrictEqual(r.g33, { mid: "a", landed: null });
  assert.deepStrictEqual(r.g19, { h0: "2 workouts", mid: "2 workouts", landed: "3 workouts" });
});

test("the sheet's height eases toward the incoming workout's with the share slid, as the month view's does, settles on the slide's curve, and is the sheet's own again when it lands", () => {
  assert.deepStrictEqual(r.height, { at200: "488px", tr: "none", settling: { h: "374px", tr: "height " + CURVE }, landed: "", trAfter: "" });   // 600 tall now, 0 + 94 + 200 + 80 with the next one: 200 of 402 slid is 49.75%
});

test("the keys: right and left go to the next and the one before (as Quick Look steps through files), never with Command; Escape closes it, but not while a menu or a sheet is up over it; two fingers on a Mac's trackpad slide it, a workout at most, by the finger's rule, never under its menu", () => {
  assert.deepStrictEqual(r.keys, { prevented: true, right: "b", left: "a", withCmd: "a", menuEsc: true, esc: false });
  assert.deepStrictEqual(r.wheel, { has: true, began: true, full: false, mid: -100, on: "b", short: "b", underMenu: false });
});

test("over the preview: the page behind held (and only it: the menu and the other sheets stay usable for what the preview opens), the page's mark on while it is up", () => {
  assert.deepStrictEqual(r.inert, { behind: ["main", "header"], pvUp: true, pvUpAfter: false });
});

test("Skip: its own question over the preview (the preview waits, still a question up), then on to the next workout; Cancel stays on it", () => {
  assert.deepStrictEqual(r.skip, { open: { sheet: true, pvInert: true, asking: true }, skipped: true, now: at("b", false, false), pvInert: false, asking: true });
  assert.deepStrictEqual(r.skipCancel, { now: at("a", false, false), skipped: false, pvInert: false, asking: true });
});

test("Delete workout (the coach's): asked over the preview, then gone and on to the next workout, still on the client's page; No keeps it; deleting the last one closes the preview", () => {
  assert.deepStrictEqual(r.del, { asked: true, atYes: { id: "b", slide: { dir: 1, to: "b", x: 0, settling: true }, prev: false, next: false }, gone: true, now: at("b", false, false), asking: true, view: "client" });
  assert.deepStrictEqual(r.g28, { listShown: true, open: false, empty: true }, "the client's only workout: the preview closes and the page behind shows it has none");
  assert.deepStrictEqual(r.delNo, { now: at("a", false, false), kept: true, asking: true });
  assert.deepStrictEqual(r.delLast, { open: false, gone: true, asking: false });
});

test("Copy workout (the coach's): which client gets it, over the preview; then the preview closes and the copy opens, as the workout page's Copy workout does", () => {
  assert.deepStrictEqual(r.copy, { asked: true, open: false, view: "training", client: "c2", title: "A", n: 1, asking: false });
});

test("Reschedule: the days over the preview (the preview waits; the page behind stays held), then the same workout on its new day, among its new neighbours; Do it today: the same workout, today's, no longer missed", () => {
  assert.deepStrictEqual(r.resched, { during: { open: true, pvInert: true }, closed: { pvInert: false, mainInert: true, asking: true }, now: at("a", false, false), date: true, day: true, near: { prev: "c", next: "d" } });
  assert.deepStrictEqual(r.today, { before: "Missed", now: at("m1", false, false), date: true, items: ["Reschedule", "Skip", "Copy workout", "!Delete workout"] });
});

test("a missed workout says so before its day, the one red word (as its row says it), and VoiceOver hears it", () => {
  assert.deepStrictEqual(r.missedDay.first, { cls: "missed", text: "Missed" });
  assert.ok(/^M2, missed, \w+day, \w{3} \d{1,2}(, \d{4})?$/.test(r.missedDay.say), r.missedDay.say);   // (a year, when three days ago was last year)
  assert.ok(/^Missed · \w+day, \w{3} \d{1,2}(, \d{4})?$/.test(r.g04), r.g04);
});

test("the page: the \"…\" (More) then the arrows' shared pill (Previous workout, Next workout) at the top right; the pill and its dimmed ends, the title's room, the page sliding in, the red Missed, sheets and the menu over the preview", async () => {
  const fs = await import("node:fs"); const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
  assert.ok(html.includes('<div class="pv-tools"><button class="pv-x pv-more" id="pvMore" type="button" aria-label="More" aria-haspopup="menu">') && html.includes('<div class="pv-pager" role="group" aria-label="Workouts"><button id="pvPrev" type="button" aria-label="Previous workout">') && html.includes('<button id="pvNext" type="button" aria-label="Next workout">'));
  assert.ok(html.includes(".pv-tools { position: relative; margin-left: auto; display: flex; gap: 12px; }") && html.includes(".pv-pager { display: flex; height: 44px; border-radius: 22px; background: var(--disc-fill); }") && /\.pv-pager button \{[^}]*width: 50px; height: 44px;/.test(html), "a 44 circle, 12 apart, a 100 x 44 capsule (Apple's, measured)");
  assert.ok(html.includes(".pv-pager button:disabled { opacity: 0.3; cursor: default; }") && html.includes(".pv-day .missed { color: var(--danger); }") && html.includes(".pv-scroll.pv-peek { position: absolute; top: 0; left: 0; right: 0; margin: 0; overflow: hidden; pointer-events: none; background: var(--pv-bg); }"));
  assert.ok(html.includes("body.pv-up #whenBg { z-index: 61; }") && html.includes("body.pv-up .sheet-bg:not(#pvSheet) { z-index: 62; }"), "the menu, and the sheets it opens, over the preview");
  assert.ok(html.includes('<p class="vh" id="pvSay" aria-live="polite"></p>'), "VoiceOver hears the workout it went to");
});

// A second look at v260 (an independent review, each finding checked by a skeptic; and deliberate breaks of the code, each caught by one
// check below): the workout a slide goes to is the preview's from its let-go, as the month view takes its month then, so a click, a key or
// a finger meanwhile acts on it, and nothing is repainted under a finger.
test("a click or a key while a slide is still landing acts on the workout it went to, as a touch does (a Mac's click, a key, two fingers that took it a whole width over: no touch lands it first): Start workout opens it, the \"…\" lands it and opens its menu; one a sync took away meanwhile closes the preview and opens nothing", () => {
  assert.deepStrictEqual(r.startMid, { view: "training", id: "b", open: false });
  assert.strictEqual(r.startKey, "b");
  assert.deepStrictEqual(r.startWheel, { full: true, id: "b" });
  assert.deepStrictEqual(r.moreMid, { menu: true, sliding: false, id: "b", rows: 4 });
  assert.deepStrictEqual(r.goneStart, { threw: false, view: "client", open: false });
});

test("a finger landing while a slide is still landing lands on the list, which already holds the workout it went to (still, its name in the header): the touch is the list's, nothing is repainted under it (a sync's redraw waits for it), and its moves and lift are heard", () => {
  assert.deepStrictEqual(r.settleCatch, { mid: { list: "", title: "B" }, drag: null, landed: at("b", false, false) });
  assert.deepStrictEqual(r.landedUnder, { underFinger: true, ...at("b", false, false), drag: null });
  assert.deepStrictEqual(r.tapAfter, { eaten: false, ...at("c", false, false) }, "a new tap soon after a slide is a tap: its touch lets its own click through");
  assert.deepStrictEqual(r.g22, { eaten: true, on: "a" }, "the click of the slide's own touch (it began on ›) is eaten before the button hears it");
  assert.deepStrictEqual(r.g23, { began: true, on: "c" }, "two fingers while an arrow's slide lands: it lands at once and they take the next one");
  assert.deepStrictEqual(r.g21, { open: false, peekGone: true, list: "" }, "closed mid-slide: the page sliding in goes with it");
  assert.deepStrictEqual(r.staleEnd, { firstLeft: 0, mid: "d", at360: "d", landed: at("d", false, true), left: 0 }, "closed mid-slide (both copies gone with it) and reopened: the old slide's leftover end touches nothing of the new one's");
  assert.deepStrictEqual(r.flingCopy, ["translate3d(402px,0,0)", "translate3d(-52px,0,0)"], "a finger's let-go: the copy going out starts where the finger left the list (no jump)");
});

test("the sheet's height on an arrow's slide (a key's, the one after Skip or Delete): from its own height in points, read, then eased (WebKit eases nothing from height auto), as the finger's; its cap as laid out (its max-height reads back as calc(), not in points), measured once with the foot under the list as the slide began", () => {
  assert.deepStrictEqual(r.arrowHeight, ["read", "read", "height=100000px", "read", "height=", "transition=none", "height=600px", "read", "transition=height " + CURVE, "height=374px"]);
  assert.deepStrictEqual(r.fraction, ["", "788px", "630.984375px", ""], "to the fraction, as laid out (measured on the test iPhone: whole points added up came to 630, and the sheet jumped a point as it landed)");
  assert.deepStrictEqual(r.capped, { half: "500px", settling: "700px", landed: "" });   // 300 tall, the next one 2,094 capped at 700: half slid is 500
  assert.deepStrictEqual(r.foot, { toward: "544px", bottom: "80px", h: "528px" });   // toward a shorter one (374) by 100, then back past the start: the other page's foot still 80
});

test("a sync that takes the workout away while a question is up over the preview: the question goes with it (as UIKit dismisses what is above a sheet it takes away), nothing held or asking; the menu goes with the preview; one that only changes what the \"…\" offers closes its menu; the next preview opened is not left held", () => {
  const none = { open: false, ask: false, pick: false, skip: false, days: false, asking: false, mainInert: false, headerInert: false };
  assert.deepStrictEqual(r.syncGone, { "Delete workout": none, Skip: none, "Copy workout": none, Reschedule: none });
  assert.deepStrictEqual(r.g09, { was: true, open: false, menu: false });
  assert.deepStrictEqual(r.g35, { was: true, menu: false, open: "a" });
  assert.deepStrictEqual(r.g08, { pv: false, days: false, open: "b", pvInert: false });
  assert.deepStrictEqual(r.g10, { up: true, days: false, preview: true }, "Escape with the days up closes the days only");
});

test("VoiceOver's line never tells of another workout or an old day: kept as it lands (a sync's redraw then too), emptied when the workout moves or the preview closes", () => {
  assert.ok(/^B, \w+day, \w{3} \d{1,2}(, \d{4})?$/.test(r.sayLine.landed), r.sayLine.landed);
  assert.ok(/^M1, missed, /.test(r.sayLine.missed), r.sayLine.missed);
  assert.deepStrictEqual({ moved: r.sayLine.moved, reopened: r.sayLine.reopened, today: r.sayLine.today }, { moved: "", reopened: "", today: "" });
});

test("after Skip or Delete the keyboard's place comes back into the sheet, on the next workout: a keyboard's (left on the closed question's button) and a pointer's (the body); a keyboard's › onto the last workout moves to ‹, never left on a dimmed arrow", () => {
  const back = { into: 1, on: "b" };
  assert.deepStrictEqual(r.focusBack, { keyDel: back, keySkip: back, pointerSkip: back });
  assert.deepStrictEqual(r.g12, { on: "d", nextDim: true, focus: "prev" });
});

test("a pull of the sheet with its \"…\" menu open takes the menu away as the sheet starts to move, as a slide does", () => {
  assert.deepStrictEqual(r.menuPull, { open: true, pulled: "translate3d(0,90px,0)", menuGone: true, after: { up: true, sheet: "", menuGone: true } });
});

test("a slide from a scrolled list: the header's veil stays over that list's cards and leaves with them (the copy going out kept at its scroll), the name going at once; the new list at its top from the let-go; landed, the header at rest; a small first move is claimed at 8", () => {
  assert.deepStrictEqual(r.veil, { before: { on: "1", x: null, tr: null, titled: true, top: false }, during: { on: "1", x: "-402px", tr: "transform " + CURVE, titled: false, outScroll: 300, listScroll: 0, top: true }, landed: { id: "b", on: "0", x: null, tr: null, titled: false, scrollTop: 0, top: true } });
  assert.deepStrictEqual(r.g29, { p: [false, true, true], x: -62, on: "b" });
  assert.deepStrictEqual(r.g30, { sheet: "", pull: null, slide: null, on: "a" }, "40 degrees: nobody's, no slide and no pull");
});

test("the \"…\" dims when it has nothing to offer (a sync finished the workout), as the arrows beside it; never under the slide after Skip (the slide starts before the skip's redraw); each of its rows its own glyph", async () => {
  assert.deepStrictEqual(r.moreOff, { before: false, id: "a", off: true, underSlide: false, landed: { ...at("b", false, false), off: false } });
  assert.deepStrictEqual(r.g25, ["calendar", "skip", "copy", "trash"]);
  const fs = await import("node:fs"); const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
  assert.ok(html.includes(".pv-more:disabled { opacity: 0.3; cursor: default; }") && html.includes(".pv-x:hover:not(:disabled) { opacity: 0.85; }") && html.includes(".pv-x:active:not(:disabled) { transform: scale(0.97); }"));
});

test("the page's part in it: the veil moves with the page under it (two variables, so a slide sets it on its own curve), the copies sliding over the list have the sheet's own grey (nothing under them shows through), the header's name centred in the room it has (else between the cross and the buttons), re-fitted after a rename and a turn", async () => {
  const fs = await import("node:fs"); const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
  assert.ok(html.includes(".pv-bar::before { transform: translate3d(var(--pv-veil-x, 0px), 0, 0); transition: var(--pv-veil-tr, none); }"));
  assert.ok(/\.pv-scroll\.pv-peek \{[^}]*pointer-events: none; background: var\(--pv-bg\); \}/.test(html));
  assert.deepStrictEqual(r.g13, { short: "180px 180px", renamed: "68px 180px", turned: "180px 180px" });
});

// A second review of the slide as it now is (each finding checked by a skeptic, most measured in WebKit, frame by frame).
test("after Skip or Delete moves on from the first or the last workout still to do, the arrow toward the one that went is dimmed as the slide begins and once it lands (nothing is that way any more), the coach's and the client's", () => {
  const first = { mid: { ...at("m1", true, false), slide: { dir: 1, to: "m1", x: 0, settling: true } }, landed: at("m1", true, false) };
  const last = { mid: { ...at("c", false, true), slide: { dir: -1, to: "c", x: 0, settling: true } }, landed: at("c", false, true) };
  assert.deepStrictEqual(r.endsAfter, { delFirst: first, skipFirst: first, clientSkipFirst: first, skipLast: last, delLast: last });
});

test("the two pages and the header's veil set off together, in one style change: nothing reads the layout between the page going out's move and the one coming in's (in WebKit a read there starts the page going out, and the veil, a frame before the one coming in, and the list shows between them: 26 of 40 clicks measured), by an arrow and by a finger's let-go, when no height eases", () => {
  const together = ["out=translate3d(-402px,0,0)", "veil=-402px", "in=translate3d(0px,0,0)"];
  assert.deepStrictEqual(r.oneFlush, { arrow: together, finger: together });
});

test("a scroll bar that takes room (a Mac set to show scroll bars always or with a mouse plugged in; Windows): the list and the pages sliding over it keep the same room for it, scrolling or not, so nothing widens, re-wraps or shifts at a slide's let-go or landing (measured in WebKit: without it the copies were 17 points wider, two-line names went to one line); the copy going out keeps the list's scroll bar, never where one takes no room", async () => {
  const fs = await import("node:fs"); const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
  const rules = (sel) => [...html.matchAll(/^  ([^{}\n]+?) \{([^{}]*)\}/gm)].filter((m) => m[1] === sel).map((m) => m[2]).join(";");
  const val = (css, prop) => { let v = null; for (const d of css.split(";")) { const m = /^\s*([\w-]+)\s*:\s*(.+?)\s*$/.exec(d); if (m && m[1] === prop) v = m[2]; else if (m && prop === "overflow-y" && m[1] === "overflow") v = m[2].split(/\s+/).pop(); } return v; };
  const list = rules(".pv-scroll"), copy = list + ";" + rules(".pv-scroll.pv-peek");
  const room = (css, scrolls) => { const y = val(css, "overflow-y") || "visible", g = val(css, "scrollbar-gutter") || "auto"; return (/^stable/.test(g) && /^(hidden|auto|scroll)$/.test(y)) || y === "scroll" || (y === "auto" && scrolls); };   // a classic scroll bar's room: kept by a stable gutter, else taken while it scrolls
  assert.ok(list && copy !== list, "the list's rule and the copies' found");
  for (const scrolls of [true, false]) assert.strictEqual(room(copy, scrolls), room(list, scrolls), (scrolls ? "a list that scrolls" : "a list that fits") + ": the copy has the room the list has");
  assert.deepStrictEqual(r.outBar, { classic: "scroll", overlay: "", fits: "" });
});

test("a trackpad's coasting that carries on under a slide an arrow key began (pressed while a flick up the list still coasts): the list, already holding the workout it went to, lands at its top, as the page that slid in showed it, the header at rest; a second press meanwhile copies that workout out from its top", () => {
  assert.deepStrictEqual(r.coast, { atGo: 0, landed: { id: "b", scrollTop: 0, on: "0", x: null, tr: null, titled: false }, twice: { id: "d", outScroll: 0, on: "0" } });
});

test("a sync that takes away the workout going out while the fingers hold a slide on to the next (after their last move, or in two fingers' rest on a trackpad): it lands at once on the one it went to, the list never moving and nothing showing that workout twice", () => {
  const landed = { list: "", title: "B", over: [], slide: false, landed: at("b", false, false) };
  assert.deepStrictEqual(r.fromGone, { finger: landed, wheel: landed });
});

test("the sheet to the fraction of a point, as WebKit lays it out (402 x 874, 9 exercises to 1): the pages that slide cover the list exactly (from its padding edge, under the sheet's 1-point top border), and the sheet eases from its own height to the incoming workout's own, so nothing jumps as it lands", () => {
  assert.deepStrictEqual(r.fracPlace, { writes: ["", "850px", "356.046875px", ""], pages: ["0px 84.34375px", "0px 84.34375px"] });
});

test("the \"…\"'s menu and the sheet's own moves: a sync's redraw that moves the \"…\" (the sheet sits at the screen's foot, as tall as its workout) closes the menu placed under it, one that moves nothing keeps it; the \"…\" tapped while the sheet springs back opens nothing (its menu would hang below it once home), and once home it opens", () => {
  assert.deepStrictEqual(r.menuMoved, { was: true, same: true, moved: false, open: "a" });
  assert.deepStrictEqual(r.moreSpring, { springing: true, menu: false, home: true });
});
