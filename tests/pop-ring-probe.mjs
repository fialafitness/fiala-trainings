// Run by pop-ring.test.js in its own process, once as a phone ("touch") and once as a computer ("desk", main.js's deskOn): the Plan and
// Month pop-ups (the coach's card for a client, the Monthly report sheet) take the app's ring for a keyboard's move only (v309). This loads
// the real app/main.js with each select, its box (.pop-sel) and its row (label.srow, with its name) as stand-ins that keep their listeners,
// the focus (document.activeElement), the document's key and press listeners with their phase, and the window's blur (the page losing the focus).
import { byId, el } from "./env.js";
const desk = process.argv[2] === "desk";
if (desk) globalThis.matchMedia = (q) => ({ matches: q === "(hover: hover) and (pointer: fine)", addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });   // main.js reads deskOn once, as it loads
const L = {}, WIN = {};
globalThis.addEventListener = (t, fn) => { (WIN[t] ||= []).push(fn); }; globalThis.removeEventListener = () => {};
document.addEventListener = (t, fn, o) => { (L[t] ||= []).push({ fn, capture: o === true || !!(o && o.capture) }); };
const doc = (type, ev = {}) => { for (const l of L[type] || []) l.fn({ type, isTrusted: true, target: el("div"), ...ev }); };
const listens = (e) => { const H = {}; e.addEventListener = (t, fn) => { (H[t] ||= []).push(fn); }; e.fire = (t) => { for (const fn of [...(H[t] || [])]) fn({ type: t, target: e, isTrusted: true }); }; return e; };
const parts = {};
for (const id of ["planSel", "repMonth"]) {
  const row = listens(el("label")), name = el("span"), box = el("span"), sel = listens(el("select"));
  row.className = "srow"; box.className = "pop-sel"; sel.id = id;
  box.parentElement = row; sel.parentElement = box; name.parentElement = row;
  sel.closest = (q) => (q === ".srow" ? row : null);
  row.contains = (x) => x === row || x === name || x === box || x === sel;
  byId.set(id, sel); parts[id] = { row, name, box, sel };
}
await import("../app/main.js");
const elsewhere = el("input");                                        // a field of the page outside the row (the Phone field)
const ring = (id) => parts[id].box.classList.contains("keys");
const press = (id, on = "sel") => { doc("pointerdown", { pointerType: desk ? "mouse" : "touch", target: on === "page" ? elsewhere : parts[id][on] }); if (on !== "page") parts[id].row.fire("pointerdown"); };   // the document's capture first, then the row (the press bubbles up to it)
const focus = (id) => { document.activeElement = parts[id].sel; parts[id].sel.fire("focus"); };
const leave = (id) => { document.activeElement = document.body; parts[id].sel.fire("blur"); };   // the focus goes elsewhere in the page: during its blur the page has none
const away = (id) => parts[id].sel.fire("blur");                     // the window or the app goes (Cmd-Tab, the home screen), the focus staying on it
const back = (id) => parts[id].sel.fire("focus");                    // and comes back to it
const winBlur = () => { for (const fn of WIN.blur || []) fn({ type: "blur", target: globalThis }); };   // the page loses the focus: the window goes, or the address bar takes it
const winFocus = () => { for (const fn of WIN.focus || []) if (fn.name !== "scheduleSync") fn({ type: "focus", target: globalThis }); };   // the page gets it back (the sync's own listener left out: it starts a sync)
const silentMove = () => { document.activeElement = elsewhere; };   // WebKit's Tab from the address bar: the focus moves to the page's first field with no blur and no focus while the page is not yet focused
const key = (k, mods = {}) => doc("keydown", { key: k, metaKey: false, ctrlKey: false, altKey: false, shiftKey: false, ...mods });
const out = { desk };
for (const id of ["planSel", "repMonth"]) {
  const r = {};
  press(id); focus(id); r.tapped = ring(id); parts[id].sel.fire("change"); r.picked = ring(id); leave(id); r.closed = ring(id);
  press(id, "name"); focus(id); r.namePressed = ring(id); leave(id);
  key("Tab"); focus(id); r.tabbed = ring(id); leave(id); r.tabbedAway = ring(id);
  key("Tab", { shiftKey: true }); focus(id); r.shiftTabbed = ring(id); leave(id);
  press(id, "page"); key("Meta", { metaKey: true }); key("Tab", { metaKey: true }); focus(id); r.cmdTab = ring(id); leave(id);
  press(id, "page"); key("Control", { ctrlKey: true }); key("Tab", { ctrlKey: true }); focus(id); r.ctrlTab = ring(id); leave(id);
  press(id, "page"); key("Alt", { altKey: true }); key("Tab", { altKey: true }); focus(id); r.optionTab = ring(id); leave(id);   // Safari's Option-Tab, to every item
  key("Tab"); focus(id); press(id); r.pressedAfterTab = ring(id); leave(id);
  key("Tab"); focus(id); press(id, "name"); r.namePressedAfterTab = ring(id); leave(id);
  press(id, "page"); key("5"); press(id); focus(id); r.typedThenTapped = ring(id); leave(id);
  press(id, "page"); key("3"); key("1"); focus(id); r.typedThenArrow = ring(id); leave(id);   // the phone's next-field arrow: the focus moves with no Tab and no press
  press(id, "page"); focus(id); r.noKeyNoPress = ring(id); leave(id);   // a focus no press on the row brought, with no key in the page (Tab from the address bar)
  press(id); focus(id); parts[id].sel.fire("change"); key("Meta", { metaKey: true }); away(id); winBlur(); r.pickedAway = ring(id); back(id); r.pickedBack = ring(id); back(id); r.pickedBackTwice = ring(id); leave(id);
  key("Tab"); focus(id); key("Meta", { metaKey: true }); away(id); winBlur(); r.tabbedAway2 = ring(id); back(id); r.tabbedBack = ring(id); back(id); r.tabbedBackTwice = ring(id); leave(id); r.tabbedBackLeft = ring(id);   // Safari sends the focus twice as a window comes back
  key("Tab"); focus(id); away(id); winBlur(); press(id, "page"); press(id); back(id); r.awayThenPressed = ring(id); leave(id);   // gone with the ring, back by a press on its row: no ring
  press(id); focus(id); leave(id); focus(id); r.focusAfterOldPress = ring(id); leave(id);   // clicked, left, and then a focus no press brought (VoiceOver, a script): the old press brought the first focus only (the v309 review)
  press(id); focus(id); parts[id].sel.fire("change"); leave(id); key("Enter"); winBlur(); focus(id); r.addressBarAfterRowPress = ring(id); leave(id);   // the review's steps: Month clicked and picked, Escape, Enter opens the sheet again, the address bar, Tab in
  press(id); focus(id); press(id); parts[id].sel.fire("change"); leave(id); winBlur(); focus(id); r.reclickedThenAddressBar = ring(id); leave(id);   // a second click while it has the focus brings no focus, so only the page losing the focus forgets it
  press(id); focus(id); press(id, "name"); leave(id); focus(id); r.namePressRefocus = ring(id); leave(id);
  press(id, "name"); winBlur(); focus(id); r.cancelledPressThenAddressBar = ring(id); leave(id);   // a press on its name dragged away (no click, so no focus), the address bar, Tab in: only the page losing the focus forgets that press
  press(id); focus(id); press(id); leave(id); focus(id); r.reclickedThenVO = ring(id); leave(id);   // a second click while it has the focus brings none, so it is no press for VoiceOver's later focus (the review's third round)
  key("Tab"); focus(id); away(id); winBlur(); silentMove(); winFocus(); r.tabOutFromAddressBar = ring(id); press(id, "page"); r.tabOutThenClickElsewhere = ring(id);   // Tab onto it, the address bar, Tab back in: the focus went to the first field, so its ring goes
  press(id); focus(id); away(id); winBlur(); silentMove(); winFocus(); key("Tab"); focus(id); r.clickedThenTabAlong = ring(id); leave(id);   // clicked, the address bar, Tab in and along onto it: the ring
  key("Tab"); focus(id); away(id); winBlur(); winFocus(); back(id); back(id); r.tabbedBackWinFocusFirst = ring(id); leave(id);   // the window back with the focus still on it: the window's focus first, then its own, twice
  press(id); focus(id); away(id); winBlur(); winFocus(); back(id); back(id); r.pickedBackWinFocusFirst = ring(id); leave(id);   // a press on its name while it has the focus: Chrome takes the focus at the press and the label gives it back at the click
  out[id] = r;
}
// the document's listeners that tell a Tab from a press, found by what each one alone does to the ring (as a phone, where nothing else gives it), with their phase
const tells = (type, before) => (L[type] || []).filter((l) => { before(); l.fn({ type, isTrusted: true, target: parts.planSel.sel, key: "Tab", metaKey: false, ctrlKey: false, altKey: false, pointerType: "touch" }); focus("planSel"); const on = ring("planSel"); leave("planSel"); return type === "keydown" ? on : !on; }).map((l) => l.capture);
if (!desk) out.capture = { keydown: tells("keydown", () => press("planSel", "page")), pointerdown: tells("pointerdown", () => key("Tab")) };
console.log(JSON.stringify(out));
