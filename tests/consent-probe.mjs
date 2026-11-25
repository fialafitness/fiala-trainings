// Run by consent.test.js in its own process: the health question as the client meets it (v316, the owner's decisions of 18 Nov 2026 and the final
// pictures): Apple's tall sheet with the kinds of details, the policy's link and two equal answers; a teen's parent or guardian on the second page,
// typing their name; the parent's page alone when the client agreed before anyone knew they were under 18 (the policy's promise); the dim closing
// it unanswered ("later"); a double tap's second answering nothing. The stand-ins are visible-probe.mjs's, cut to what a sheet made by script needs.
import { byId, el } from "./env.js";
import { makeSupabase } from "./fake-supabase.js";
const Y = new Date().getFullYear();                                    // birthdays counted from this year, so each case keeps the age it needs on any day (the sixteenth check round: fixed dates failed every run from 1 Jan 2027)
let NOW = 10000, SEQ = 0; const Q = [];
globalThis.setTimeout = (fn, ms) => { const id = ++SEQ; Q.push({ id, at: NOW + Math.max(0, ms || 0), fn }); return id; };
globalThis.clearTimeout = (id) => { const i = Q.findIndex((q) => q.id === id); if (i >= 0) Q.splice(i, 1); };
try { performance.now = () => NOW; } catch (_) { Object.defineProperty(globalThis, "performance", { value: { now: () => NOW }, configurable: true }); }
const flush = async () => { for (let i = 0; i < 30; i++) await Promise.resolve(); };
async function advance(ms) { const end = NOW + ms; for (;;) { Q.sort((a, b) => a.at - b.at || a.id - b.id); const q = Q[0]; if (!q || q.at > end) break; Q.shift(); NOW = Math.max(NOW, q.at); q.fn(); await flush(); } NOW = end; await flush(); }
const L = {};
document.addEventListener = (t, fn, o) => { (L[t] ||= []).push({ fn, capture: o === true || !!(o && o.capture) }); };
document.removeEventListener = (t, fn) => { const a = L[t] || []; const i = a.findIndex((x) => x.fn === fn); if (i >= 0) a.splice(i, 1); };
const rejected = []; process.on("unhandledRejection", (e) => { rejected.push(String((e && e.message) || e)); });
// ---------- the stand-in elements: children with their parent, listeners, attributes, focus ----------
const MK = new WeakSet(), classesOf = (n) => new Set(String(n.className || "").split(/\s+/).filter(Boolean));
const kids = (n) => (n && n.nodes ? n.nodes.filter((c) => c && typeof c === "object") : []);
const findAll = (root, test, out = []) => { for (const c of kids(root)) { if (test(c)) out.push(c); findAll(c, test, out); } return out; };
const byClass = (root, c) => findAll(root, (n) => classesOf(n).has(c));
const byTag = (root, t) => findAll(root, (n) => String(n.tagName || "").toLowerCase() === t);
function mk(tag) {
  const e = el(tag);
  e.tagName = String(tag).toUpperCase(); e.nodes = []; e.parent = null; e.H = {}; e.attrs = {}; e.removed = false; e.inert = false; e.disabled = false; e.value = "";
  Object.defineProperty(e, "children", { get: () => kids(e), set: (v) => { e.nodes = [...v]; }, configurable: true });
  let text = ""; Object.defineProperty(e, "textContent", { get: () => text + kids(e).map((c) => c.textContent).join(""), set: (v) => { e.nodes = []; text = String(v); }, configurable: true });
  const cl = { add: (...c) => { const k = classesOf(e); for (const x of c) k.add(x); e.className = [...k].join(" "); }, remove: (...c) => { const k = classesOf(e); for (const x of c) k.delete(x); e.className = [...k].join(" "); }, toggle: (c, f) => { const on = f === undefined ? !classesOf(e).has(c) : !!f; (on ? cl.add : cl.remove)(c); return on; }, contains: (c) => classesOf(e).has(c) }; e.classList = cl;
  const st = {}; st.setProperty = (k, v) => { st[k] = v; }; st.removeProperty = (k) => { delete st[k]; }; e.style = st;
  e.appendChild = (c) => { if (c && typeof c === "object") { if (c.parent) c.parent.nodes = c.parent.nodes.filter((x) => x !== c); c.parent = e; } e.nodes.push(c); return c; };
  e.append = (...k) => { for (const c of k) e.appendChild(c); };
  e.remove = () => { e.removed = true; if (e.parent) { e.parent.nodes = e.parent.nodes.filter((x) => x !== e); e.parent = null; } };
  e.setAttribute = (k, v) => { e.attrs[k] = String(v); }; e.getAttribute = (k) => (k in e.attrs ? e.attrs[k] : null); e.removeAttribute = (k) => { delete e.attrs[k]; };
  e.addEventListener = (t, fn) => { (e.H[t] ||= []).push(fn); }; e.removeEventListener = (t, fn) => { const a = e.H[t] || []; const i = a.indexOf(fn); if (i >= 0) a.splice(i, 1); };
  e.focus = (o) => { document.activeElement = e; e.focusedWith = o || null; };
  e.closest = (sel) => null; e.querySelector = () => null; e.querySelectorAll = () => [];
  MK.add(e); return e;
}
document.createElement = mk;
const body = mk("body"); document.body = body;
const page = mk("main"); body.appendChild(page);
const fire = (e, type, extra = {}) => {                                     // the target and up through its parents, then the document's own
  const ev = { type, target: e, detail: 1, isTrusted: true, key: "", ...extra, stopped: false, defaultPrevented: false, stopPropagation() { this.stopped = true; }, stopImmediatePropagation() { this.stopped = true; }, preventDefault() { this.defaultPrevented = true; } };
  for (const l of [...(L[type] || [])].filter((x) => x.capture)) l.fn(ev);
  for (let n = e; n && MK.has(n) && !ev.stopped; n = n.parent) { ev.currentTarget = n; for (const fn of [...((n.H || {})[type] || [])]) fn(ev); }
  if (!ev.stopped) for (const l of [...(L[type] || [])].filter((x) => !x.capture)) l.fn(ev);
  return ev;
};
const reg = (id, tag = "button") => { const e = mk(tag); e.id = id; byId.set(id, e); return e; };   // the parts the coach's card and Settings wire at import: stand-ins with listeners
for (const id of ["cardPaper", "cardHealthDel", "cardZoneStop", "cardMinor", "meZoneSw", "meHealthSw", "askYes", "askNo"]) reg(id);
for (const id of ["askTitle", "askText", "status", "cardHealthNote", "cardPaperLabel"]) reg(id, "p");
const askSheet = reg("askSheet", "div"), askBox = reg("askBox", "div"); reg("askInput", "input"); askSheet.appendChild(askBox); askSheet.firstElementChild = askBox; askSheet.hidden = true; body.appendChild(askSheet);
const app = (await import("../app/main.js")).internals();
const { fns, maps } = app;
const sheet = () => byClass(body, "hq-ask")[0] || null;
const answers = (s) => byTag(byClass(s, "hq-btns")[0] || s, "button");   // Don't Allow | Agree (the close cross sits apart, at the sheet's top)
const seen = () => { const s = sheet(); if (!s) return null; const ps = byClass(s, "hq-p").map((p) => p.textContent), btn = answers(s), a = byTag(s, "a")[0], inp = byTag(s, "input")[0], x = byClass(s, "hq-x")[0];
  return { title: byClass(s, "hq-title")[0].textContent, sub: (byClass(s, "hq-sub")[0] || {}).textContent || "", paras: ps, kinds: byTag(s, "li").map((li) => li.textContent), link: a ? [a.getAttribute("href") || a.href, a.textContent] : null,
    buttons: btn.map((b) => b.textContent), yesOff: btn[1] ? !!btn[1].disabled : null, x: x ? x.getAttribute("aria-label") : null, field: inp ? inp.placeholder : null, still: classesOf(s).has("hq-still"), role: byClass(s, "hq-sheet")[0].getAttribute("role"), pageInert: page.inert, focus: document.activeElement === byClass(s, "hq-sheet")[0] ? "sheet" : document.activeElement && document.activeElement.tagName }; };
const tap = (i) => fire(answers(sheet())[i], "click");
const pending = () => { const m = maps.pendingChoices.get("c1"); const a = m && m.get("health"); return a ? { answer: a.answer, parent: a.parent } : null; };
function seed(rec) {
  for (const s of byClass(body, "hq-ask")) s.remove(); fire(body, "keydown", { key: "Escape" });
  app.reset(); maps.pendingChoices.clear(); maps.pendingProfile.clear();
  app.set({ signedIn: true, clientMode: true, myClientId: "c1", sessionEmail: "jane@x.com", view: { name: "client", id: "c1" } });
  maps.clients.set("c1", { id: "c1", name: "Jane Moreno", email: "jane@x.com", unit: "lb", ...rec }); page.inert = false;
}
const out = { year: Y };                                              // the year the birthdays were counted from (the seventeenth check round: a run crossing midnight on 31 Dec read the next year in the test)
{ seed({}); fns.askHealth(); await flush(); out.adult = seen();   // never asked: the question, its kinds of details, the link, two equal answers
  tap(1); await flush(); out.adultEarly = { open: !!sheet(), pending: pending() };   // a double tap's second (within 350 ms) answers nothing
  await advance(400); tap(1); await flush(); out.adultAgreed = { open: !!sheet(), pending: pending(), state: maps.clients.get("c1").choices.health.state, pageInert: page.inert };
}
{ seed({ birthday: (Y - 15) + "-05-01" }); fns.askHealth(); await flush(); await advance(400); tap(1); await flush();   // a teen by the birthday: Agree, then the parent's page, still
  out.teen2 = seen(); out.teen2Pending = pending();
  const s = sheet(), inp = byTag(s, "input")[0]; inp.value = "  Sam   Rivera "; fire(inp, "input"); out.typed = answers(s)[1].disabled;
  await advance(400); fire(document, "keydown", { key: "Enter", target: inp }); fire(inp, "keydown", { key: "Enter" }); await flush(); out.enter = { open: !!sheet(), pending: pending() };   // the keyboard's Return or done key: the keyboard goes, nothing is answered (the check round)
  await advance(400); tap(1); await flush(); out.teenAgreed = { open: !!sheet(), pending: pending(), parent: maps.clients.get("c1").choices.health.parent && maps.clients.get("c1").choices.health.parent.name };
}
{ seed({ birthday: (Y - 15) + "-05-01" }); fns.askHealth(); await flush(); await advance(400); tap(1); await flush(); await advance(400);   // the parent isn't there: the dim closes it, nothing recorded
  const s = sheet(); fire(s, "pointerdown"); fire(s, "click"); await flush(); out.later = { open: !!sheet(), pending: pending(), state: (maps.clients.get("c1").choices || {}).health || null, pageInert: page.inert };
}
{ seed({ birthday: (Y - 15) + "-05-01" }); fns.askHealth(); await flush(); await advance(400); tap(1); await flush(); await advance(400);   // or the close cross, as on a phone (the check round: a phone had no way to put it off)
  fire(byClass(sheet(), "hq-x")[0], "click"); await flush(); out.cross = { open: !!sheet(), pending: pending() };
}
{ seed({ birthday: (Y - 15) + "-05-01", sex: "female" }); fns.askHealth(); await flush(); await advance(400); tap(1); await flush(); await advance(400); tap(0); await flush();   // the parent's Disagree: a no
  const c = maps.clients.get("c1"); out.parentNo = { open: !!sheet(), pending: pending(), birthday: c.birthday, sex: c.sex, minorUntil: c.minorUntil, by: c.choices.health.by };
}
{ seed({ minor: true, choices: { health: { state: "agreed", at: "2026-11-18T08:00:00.000Z" } }, sex: "female" }); fns.askHealth(); await flush();   // agreed alone, then marked under 18: the parent's page alone
  out.lateParent = seen(); await advance(400); const s = sheet(), inp = byTag(s, "input")[0]; inp.value = "Sam Rivera"; fire(inp, "input"); tap(1); await flush();   // the details are saved already: the page says a Disagree deletes them
  out.lateAgreed = { pending: pending(), editable: fns.healthLockLine(maps.clients.get("c1")) === "" };
}
{ seed({ birthday: (Y - 12) + "-07-01", sex: "female", choices: { health: { state: "legacy", at: "2026-11-18T08:00:00.000Z" } } }); fns.askHealth(); await flush();   // under 13 (saved before v316): never asked, the app is for 13 and up (the check round)
  const alert = byClass(body, "pa-ask")[0]; out.young = { sheet: !!sheet(), alert: alert ? byClass(alert, "pa-title")[0].textContent : null }; if (alert) alert.remove(); fire(body, "keydown", { key: "Escape" }); await flush();
}
{ seed({ sex: "female", choices: { health: { state: "legacy", at: "2026-11-18T08:00:00.000Z" } } }); fns.askHealth(); await flush(); out.keep = seen();   // saved before v316: "Keep your health details?"
  fire(body, "keydown", { key: "Escape" }); await flush(); out.escape = { open: !!sheet(), pending: pending() };
}
{ // the coach records a withdrawal told by email or in person (the check round): asks first, then the rule; the card follows the server's answer
  app.reset(); const sb = makeSupabase(), calls = [];
  const rec = { id: "c1", name: "Jane Moreno", email: "jane@x.com", unit: "lb", sex: "female", birthday: (Y - 16) + "-01-01", zone: { zone: "Asia/Tokyo", at: "2026-11-18T19:00:00.000Z" }, choices: { health: { state: "agreed", at: "2026-11-18T08:00:00.000Z", parent: { name: "Sam Rivera", at: "2026-11-18T08:00:00.000Z" } }, zone: { state: "allow", at: "2026-11-18T08:00:00.000Z" } } };
  sb.seed("ft_clients", "c1", JSON.parse(JSON.stringify(rec)));
  sb.rpcs.coach_withdraw = async (a) => { calls.push("withdraw:" + a.p_kind); const d = sb.tables.ft_clients.get("c1").data;   // as client-consent.sql's rule writes it
    if (a.p_kind === "zone") { d.choices.zone = { state: "deny", at: "2026-11-18T20:00:00.000Z", by: "coach" }; delete d.zone; } else { d.choices.health = { state: "declined", at: "2026-11-18T20:00:00.000Z", by: "coach" }; d.minorUntil = 2028; for (const k of ["birthday", "sex", "height", "bodyWeight", "heightUnit", "bodyUnit", "health"]) delete d[k]; }
    return JSON.parse(JSON.stringify({ choices: d.choices, minor: d.minor, minorUntil: d.minorUntil })); };   // the rule answers { choices, minor, minorUntil }
  app.set({ sb, signedIn: true, clientMode: false, myClientId: null, sessionEmail: "coach@x.com", view: { name: "client", id: "c1" }, backend: fns.cloudBackend });
  maps.clients.set("c1", JSON.parse(JSON.stringify(rec)));
  await advance(400); fire(byId.get("cardHealthDel"), "click"); await flush(); out.askedDel = { title: byId.get("askTitle").textContent, yes: byId.get("askYes").textContent, open: !askSheet.hidden };
  fire(byId.get("askYes"), "click"); await flush(); out.delEarly = { open: !askSheet.hidden, calls: calls.slice() };   // a double tap's second answers nothing
  await advance(400); fire(byId.get("askYes"), "click"); await flush(); await flush();
  const c = maps.clients.get("c1"); out.withdrawn = { calls: calls.slice(), state: c.choices.health.state, by: c.choices.health.by, sex: c.sex, birthday: c.birthday, minorUntil: c.minorUntil, note: fns.cardHealthNote(c) };
  await advance(400); fire(byId.get("cardZoneStop"), "click"); await flush(); await advance(400); fire(byId.get("askYes"), "click"); await flush(); await flush();
  out.zoneStopped = { calls: calls.slice(), zone: maps.clients.get("c1").zone || null, state: maps.clients.get("c1").choices.zone.state };
  app.reset(); await flush();
}
{ // a teen's paper form: the switch asks the rule with the parent's signature; Under 18 by the date of birth can't be switched off
  app.reset(); const sb = makeSupabase(), got = []; sb.rpcs.coach_set_paper = async (a) => { got.push([a.p_on, a.p_parent]); return { choices: { health: { state: "paper", at: "2026-11-18T20:00:00.000Z", by: "coach", ...(a.p_parent ? { parent: { paper: true, at: "2026-11-18T20:00:00.000Z" } } : {}) } } }; };
  app.set({ sb, signedIn: true, clientMode: false, myClientId: null, sessionEmail: "coach@x.com", view: { name: "client", id: "c1" }, backend: fns.cloudBackend });
  maps.clients.set("c1", { id: "c1", name: "Jane Moreno", email: "jane@x.com", unit: "lb", birthday: (Y - 15) + "-03-01" });
  await advance(400); fire(byId.get("cardMinor"), "click"); await flush(); const minorAfter = maps.clients.get("c1").minor;
  fire(byId.get("cardPaper"), "click"); await flush(); await flush();
  await advance(100); const ch = ((maps.clients.get("c1") || {}).choices || {}).health || {};
  out.teenPaper = { sent: got, state: ch.state || null, parent: !!ch.parent, minorSwitched: minorAfter === undefined, status: byId.get("status").textContent };
  app.reset(); await flush();
}
{ // the client's switch from what the person sees: one a sync left behind records nothing opposite (the check round)
  seed({ choices: { zone: { state: "deny", at: "2026-11-18T08:00:00.000Z" } } }); byId.get("meZoneSw").setAttribute("aria-checked", "false");
  await advance(400); maps.clients.get("c1").choices = { zone: { state: "allow", at: "2026-11-18T09:00:00.000Z" } };   // a sync brought Allow from the client's laptop; the switch still shows off
  fire(byId.get("meZoneSw"), "click"); await flush(); out.staleSwitch = { pending: (maps.pendingChoices.get("c1") || new Map()).get("zone") || null, shown: byId.get("meZoneSw").getAttribute("aria-checked") };
}
{ // a child (under 13) turning on Share time zone in Settings is told why, and nothing is queued (the check round: it flipped back off with no word)
  seed({ birthday: (Y - 11) + "-01-01" }); await advance(400); byId.get("meZoneSw").setAttribute("aria-checked", "false");
  fire(byId.get("meZoneSw"), "click"); await flush(); const alert = byClass(body, "pa-ask")[0];
  out.youngSwitch = { alert: alert ? byClass(alert, "pa-title")[0].textContent : null, pending: (maps.pendingChoices.get("c1") || new Map()).get("zone") || null };
  if (alert) { await advance(400); fire(byTag(alert, "button")[0], "click"); await flush(); }
}
{ // the parent's wait (an Agree refused for one, marked on the phone): asked once when it comes; "Not now" holds until a new mark or the next open; a newer answer on record ends it (the check rounds: it came back at every sync)
  seed({ choices: { zone: { state: "deny", at: "2026-11-18T08:00:00.000Z" } } }); app.set({ sb: makeSupabase() }); document.activeElement = null; const qs = document.querySelector; document.querySelector = () => null; document.getElementById("whenBg").hidden = true;   // no menu, date picker or crop view up (the stand-in document answers every selector)
  maps.heldAgree.set("c1", { at: "2026-11-18T09:00:00.000Z", why: "parent" });
  fns.maybeAsk(); await advance(1000); const first = !!sheet();
  await advance(400); if (sheet()) fire(byClass(sheet(), "hq-x")[0], "click"); await flush(); document.activeElement = null;
  fns.maybeAsk(); await advance(1000); const again = !!sheet();
  maps.heldAgree.set("c1", { at: "2026-11-18T09:05:00.000Z", why: "parent" }); fns.maybeAsk(); await advance(1000); const newMark = !!sheet();
  await advance(400); if (sheet()) fire(byClass(sheet(), "hq-x")[0], "click"); await flush(); document.activeElement = null;
  maps.clients.get("c1").choices.health = { state: "declined", at: "2026-11-18T09:10:00.000Z", by: "parent" }; fns.askHealth(); await flush();
  out.heldOnce = { first, again, newMark, outlived: maps.heldAgree.has("c1"), asked: !!sheet() };
  const typing = mk("input"); document.activeElement = typing; maps.heldAgree.set("c1", { at: "2026-11-18T09:20:00.000Z", why: "parent" }); maps.clients.get("c1").choices = { zone: { state: "deny", at: "2026-11-18T08:00:00.000Z" } };
  fns.maybeAsk(); await advance(2000); const whileTyping = !!sheet(); document.activeElement = null; await advance(1000);
  out.heldTyping = { whileTyping, after: !!sheet() };
  if (sheet()) { await advance(400); fire(byClass(sheet(), "hq-x")[0], "click"); await flush(); }
  document.querySelector = qs;
}
out.rejected = rejected;
console.log(JSON.stringify(out));
process.exit(0);
