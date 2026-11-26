// Saving and syncing: the device copy, the debounced save queue, the cloud backend (coach), the client backend (RPCs),
// the paged read of the server and the merge back into the local maps. Screens are reached only through `ui`.
import { lsGet, lsSet, norm, clamp, today, uid, laToday } from "./util.js";
import { isTemplateClient, planActive, repairTimed, timedPlan, cmpLabel, groupKey, tidyLabels, stampUnit, profileGet, profilePut, setsOf, loggedSets, zoneOf, hereZone, zoneState, applyChoice, healthEditable, birthdayOpen, heldLive } from "./model.js";
import { mergeNotes } from "./notes.js";
import { winLost } from "./win.js";   // v316 (one window at a time): a page whose Fiala went to another window writes, sends and reads nothing more
import { ALIASES } from "./catalog.js";
import { S, ui, clients, trainings, dirty, deleting, deletedHere, heldBack, timers, chains, pendingWeightRows, pendingDoneRows, pendingEarlyRows, pendingFinish, pendingSkip, trainerState, pendingMove, pendingMiss, pendingSwap, pendingOrder, seenAt, trainerTouched, trainerNamed, trainerNoted, planTouched, confirmedAt, deletedNotes, deletedPackages, folderTouched, deletedFolders, fromFile, pendingNoteRows, pendingProfile, pendingChoices, heldAgree, settledAnswers, profileTouched, profileUnder, carriedFrom, withdrawnAt, typedHere, deliv } from "./state.js";

// ---------- persistence ----------
const isNetwork = (error) => /load failed|failed to fetch|network|fetch/i.test((error && error.message) || "");
const isOffline = (error) => !navigator.onLine || isNetwork(error);
const reasonOf = (e) => {
  const m = String((e && e.message) || "");
  if ((e && e.code === "PGRST202") || /Could not find the function/i.test(m)) return "database rule missing";
  if (e && e.code === "P0001" && m && m.length < 40) return m;
  if (e && e.code === "23505") return "that email is already on another client";
  return "";
};

function key(kind, id) { return kind + "/" + id; }
const forgetDraft = (id, mine = false) => { const dr = lsGet("fiala.trainings.draft"); if (!dr || dr.id !== id || (mine && dr.tab && dr.tab !== TAB)) return; lsSet("fiala.trainings.draft", null); };   // v316 (the twenty-second check round): the unsaved draft kept on the device for that template goes; mine: unless another page of the browser typed it last (a Save in one window cleared the typing of the other, lost if that window was closed before its own Save)
const dropDraft = (id) => { if (S.templateDraft && S.templateDraft.id === id) { if (ui.draftGone) ui.draftGone(id); S.templateDraft = null; S.pendingGo = null; if (ui.paintDraftBar) ui.paintDraftBar(); } forgetDraft(id); };   // v316 (the twenty-second check round): a template deleted on another device takes its unsaved draft with it, the one kept on the device too (kept, it came back as unsaved changes once a backup restored the template)
const keepRows = (live, rows) => { const had = new Map((Array.isArray(live) ? live : []).filter((x) => x && typeof x === "object" && x.id).map((x) => [x.id, x])); return rows.map((sr) => { const c = sr === undefined ? null : JSON.parse(JSON.stringify(sr)), o = c && typeof c === "object" && c.id ? had.get(c.id) : null; if (!o) return c; for (const kk of Object.keys(o)) delete o[kk]; return Object.assign(o, c); }); };   // v316 (the twenty-second check round): a template's exercises as another copy has them, each in the object the cards drawn hold (by id): a reps typed under a finger that held the redraw off went into an exercise the template no longer held
const adoptDoc = (id, doc) => { const live = trainings.get(id); if (!live || !doc || typeof doc !== "object") { if (doc && typeof doc === "object") trainings.set(id, doc); return; } const rows = Array.isArray(doc.rows) ? keepRows(live.rows, doc.rows) : undefined; for (const kk of Object.keys(live)) delete live[kk]; Object.assign(live, doc); if (rows) live.rows = rows; };   // the open template becomes another copy in place (the page holds its object)
const seenDoc = new Map();                                        // "kind/id" -> the server copy the stamp belongs to: the base a two-device merge measures changes against
function markDirty(kind, id) { const k = key(kind, id); dirty.set(k, (dirty.get(k) || 0) + 1); }
const recMap = (k) => { const kind = String(k).slice(0, String(k).indexOf("/")); return kind === "clients" ? clients : kind === "trainings" ? trainings : null; };
const recOf = (k) => { const m = recMap(k), id = String(k).slice(String(k).indexOf("/") + 1), d = S.templateDraft; if (!m) return null; if (m === trainings && d && d.dirty && d.snapshot && d.id === id) return JSON.parse(d.snapshot); return m.get(id) || null; };   // a record still to send, as it stands now (a template's open draft as last saved, as the device copy keeps it)
const trimEnd = (a) => { if (!Array.isArray(a)) return a; let n = a.length; while (n && (a[n - 1] == null || a[n - 1] === "")) n--; return n === a.length ? a : a.slice(0, n); };
const normRow = (x) => { if (!x || typeof x !== "object") return x; const y = { ...x, weights: trimEnd(x.weights), repsDone: trimEnd(x.repsDone), ...(typeof x.name === "string" && ALIASES[x.name] ? { name: ALIASES[x.name] } : {}) }; for (const g of ["weights", "repsDone", "alts"]) if (Array.isArray(y[g]) && !y[g].length) delete y[g]; if (!y.done) delete y.done; return y; };   // what a row says, not how this device holds it: the boxes drawn add empty sets at the end, and a client's phone shows an old name by its new one; v316 (the twenty-second check round): an empty list says the same as none (a merge writes an empty one where the server's copy had none: an exercise there read as changed here at the next merge)
const canon = (v) => JSON.stringify(v, (k, x) => (x && typeof x === "object" && !Array.isArray(x) ? Object.fromEntries(Object.keys(x).sort().map((kk) => [kk, x[kk]])) : x));   // keys in one order: the server keeps them in its own (shortest first), this device in the order they were written
const sameRec = (a, b) => JSON.stringify(a) === JSON.stringify(b) || (!!a && !!b && canon(Array.isArray(a.rows) ? { ...a, rows: a.rows.map(normRow) } : a) === canon(Array.isArray(b.rows) ? { ...b, rows: b.rows.map(normRow) } : b));   // (15 Nov 2026, the audit's #11) a copy that says the same is the same: the open workout is not swapped and drawn anew at every sync
const mergeSets = (lr, br, sr) => {                                // (15 Nov 2026, the audit's #2) one exercise's log, set by set, three ways: what this device changed since it read br stands, the server's (the client's sets) fills the rest
  const pick = (mine, base, srv) => { const a = mine || [], b = base || [], s = srv || [], out = []; for (let i = 0; i < Math.max(a.length, s.length); i++) { const m = a[i] == null ? "" : String(a[i]); out.push(m !== (b[i] == null ? "" : String(b[i])) ? m : s[i] == null ? "" : String(s[i])); } return trimEnd(out); };
  const n = clamp(parseInt(lr.sets, 10) || 0, 0, 20);
  lr.weights = pick(lr.weights, br.weights, sr.weights); lr.repsDone = pick(lr.repsDone, br.repsDone, sr.repsDone);
  if (n) { lr.weights = lr.weights.slice(0, n); lr.repsDone = lr.repsDone.slice(0, n); }
  if ((parseInt(lr.setsDone, 10) || 0) === (parseInt(br.setsDone, 10) || 0)) { if (sr.setsDone != null) lr.setsDone = sr.setsDone; else delete lr.setsDone; }
  if (!!lr.done === !!br.done) lr.done = !!sr.done;
  if (String(lr.unit || "") === String(br.unit || "") && (sr.unit === "kg" || sr.unit === "lb")) lr.unit = sr.unit;
  if (String(lr.earlyReason || "") === String(br.earlyReason || "")) { if (sr.earlyReason) lr.earlyReason = String(sr.earlyReason); else delete lr.earlyReason; }
};
const isWithdrawal = (a) => !!a && (a.answer === "decline" || a.answer === "deny");
const undoGuess = (id, k, a) => { const rec = clients.get(id), now = rec && rec.choices && rec.choices[k]; if (now && now.at === a.at) { const ch = { ...rec.choices }; if (a.prev) ch[k] = a.prev; else delete ch[k]; rec.choices = ch; } };   // off the phone's copy at once, the answer it replaced back: a detail saved before the sync never takes it for agreed (the check rounds)
const settleFrom = (list) => { for (const e of list || []) { const [sid, o] = Array.isArray(e) ? e : [e, "ok"]; if (typeof sid === "string" && sid && !settledAnswers.has(sid)) settledAnswers.set(sid, o === "stale" || o === "refused" ? o : "ok"); } };   // another page's (or an earlier launch's) replies
const markLive = heldLive;
const zoneSent = new Map();                                       // client mode: clientId -> { zone, t }: this phone's last time-zone report that landed, by its own clock (v316, the check rounds)                                         // a parent's wait still stands: no newer answer on record (a Don't Allow, a paper form, the parent's own answer)
function foldAnswers(mine, theirs) {                               // v316 (the check round): two pages' answers for one client, kind by kind: the newer stands, and a withdrawal given before an Allow or Agree goes first (a.before), so neither page drops the other's Don't Allow
  const out = new Map(mine || []);
  for (const [k, b0] of theirs || []) {
    if (!b0 || (b0.id && settledAnswers.has(b0.id))) continue;     // the server replied to it already (this page sent it): never again
    const b = b0.before && b0.before.id && settledAnswers.has(b0.before.id) ? (({ before, ...rest }) => rest)(b0) : b0;
    const a = out.get(k); if (!a) { out.set(k, b); continue; }
    if (a.answer === b.answer && a.at === b.at) { out.set(k, a.before && !b.before ? b : a); continue; }   // the same answer on both pages: the copy that no longer carries a withdrawal already sent (the check round: it went again after the Agree)
    const [old, neu] = (Date.parse(a.at) || 0) <= (Date.parse(b.at) || 0) ? [a, b] : [b, a];
    if (isWithdrawal(neu)) { out.set(k, neu); continue; }
    const before = neu.before || old.before || (isWithdrawal(old) ? { answer: old.answer, parent: old.parent || null, at: old.at, by: old.by || "client", ...(old.id ? { id: old.id } : {}) } : null);
    out.set(k, before ? { ...neu, before } : neu);
  }
  return out;
}
const TAB = uid(), TAB_KEY = "fiala.pending.tab", SIDE = "fiala.pending.answers.v1", takenFrom = new Map(), gaveUpAt = new Map();   // takenFrom (v316, the eighteenth check round): "kind/id" -> the page whose copy this page took and has not changed since (page-local); (15 Nov 2026, the audit's #19) this page's own name, and the device's note of which page wrote the queue last; SIDE (v316): the answers also kept where no v315 page writes
const noteWithdrawn = (cid, at) => { if (typeof cid === "string" && at && (Date.parse(at) || 0) > (Date.parse(withdrawnAt.get(cid)) || 0)) { withdrawnAt.set(cid, at); return true; } return false; };   // v316 (the check rounds): the newest health withdrawal given on this phone, per client (kept with the queue as `wd`)
const dropBefore = (cid, at) => { const q = pendingProfile.get(cid), um = profileUnder.get(cid) || new Map(); let n = 0; if (q) for (const f of [...q]) if (f !== "unit" && !((((u) => Date.parse(u[2] || u[0]))(String(um.get(f) || "").split("|")) || 0) > (Date.parse(at) || 0))) { q.delete(f); um.delete(f); n++; } if (q && !q.size) pendingProfile.delete(cid); return n; };   // this page's waiting details typed before that withdrawal go, as a Don't Allow's do
const ownTyped = (cid, k) => { typedHere.add(cid + "\n" + k); return carriedFrom.delete(cid + "\n" + k); };   // a detail typed on this page is its own: no other page's value replaces it (two pages typing the same detail: a known limit); any other copy takes a correction
function adoptQueue(p) {                                           // another page of the app (a second tab or window of the same browser; never Safari beside the Dock app or the Home Screen app, which share no storage with it: the research of 19 Nov 2026; since v316 only one window runs Fiala, app/win.js, and this stays for the pages that know no lock: a v315 page on release day, a browser without Web Locks) wrote the queue: what it still has to send that this page knows nothing of is taken on here, record, queues and the coach's marks with it, so neither page's write ever drops the other's (a tab iOS discards before it sends loses nothing)
  if (!p || typeof p !== "object" || p.tab === TAB) return false;
  const me = S.sessionEmail || S.pendingOwner || ""; if (p.owner && me && p.owner !== me) return false;   // another account's: never taken on
  const recs = new Map((p.recs || []).filter((e) => Array.isArray(e) && typeof e[0] === "string" && e[1] && typeof e[1] === "object" && e[1].id === e[0].slice(e[0].indexOf("/") + 1))), gone = new Set(p.gone || []), took = new Set();
  let answers = false; const stampOf = new Map((p.stamps || []).filter((e) => Array.isArray(e) && typeof e[0] === "string"));   // the other page's read of each record: an equal copy read later than this page's may be a put-back still to send (the check round: the coach's two tabs)
  for (const e of p.wd || []) if (Array.isArray(e) && noteWithdrawn(e[0], e[1]) && dropBefore(e[0], e[1])) answers = true;
  for (const e of p.deliv || []) if (Array.isArray(e) && typeof e[0] === "string" && (Date.parse(e[1]) || 0) > (Date.parse(deliv.get(e[0])) || 0)) { deliv.delete(e[0]); deliv.set(e[0], e[1]); }   // v316 (the check rounds): details another page delivered (by their typing time); a carried copy as old or older goes below
  if (S.clientMode) for (const [ck, t] of [...deliv]) { if (typedHere.has(ck)) continue; const i = ck.indexOf("\n"), cid = ck.slice(0, i), f = ck.slice(i + 1), q = pendingProfile.get(cid), um = profileUnder.get(cid); if (!q || !q.has(f)) continue; const mt = Date.parse(String((um && um.get(f)) || "").split("|")[2]) || 0; if (mt && mt <= (Date.parse(t) || 0)) { q.delete(f); if (um) um.delete(f); carriedFrom.delete(ck); if (!q.size) pendingProfile.delete(cid); answers = true; } }
  settleFrom(p.settled);                                           // (v316, the check rounds) first: an answer the other page has had a reply to is never taken, and this page's own copy of it goes (a guess refused or set aside comes off: its details never go on it)
  for (const [cid, cm] of [...pendingChoices]) { for (const [k, a] of [...cm]) if (a && a.id && settledAnswers.has(a.id)) { cm.delete(k); if (settledAnswers.get(a.id) !== "ok") { undoGuess(cid, k, a); answers = true; } } if (!cm.size) pendingChoices.delete(cid); }
  // (v316, the check rounds) a copy the same as this page's own holds nothing to send: not taken. Two pages took each other's copy without end
  // (each sent, clean, then took the other's back: "Saving…" all the time, and the coach's changes never showed). On the client's phone a copy is never
  // taken whole (nothing on it is sent but the details and answers queued; an older copy put the coach's changes back, and an Agree refused on the other
  // page spread inside its copy as agreed): only the details the other page still has to send, with their values, unless this page has its own waiting;
  // its answers come folded below.
                                                                   // v316 (the check round): another page's answers are taken on even for a record this page has changed (a Don't Allow must never be dropped), folded with this page's own
  for (const [id, xs] of p.choices || []) {
    if (!Array.isArray(xs) || !xs.length || !clients.has(id)) continue;
    const was = pendingChoices.get(id), now = foldAnswers(was, xs); if (JSON.stringify([...(was || [])]) === JSON.stringify([...now])) continue;
    pendingChoices.set(id, now); answers = true; const rec = clients.get(id);
    for (const [k, a] of now) if (!was || was.get(k) !== a) { const pv = was && was.get(k), prevAt = Date.parse(pv ? pv.at : rec.choices && rec.choices[k] && rec.choices[k].at) || 0, wb = k === "health" && !!a.before && isWithdrawal(a.before) && (Date.parse(a.before.at) || 0) > prevAt; if (wb) applyChoice(rec, k, a.before.answer, a.before.parent, a.before.at, [today(), laToday()], a.before.by, a.before.id); applyChoice(rec, k, a.answer, a.parent, a.at, [today(), laToday()], a.by, a.id); if (k === "health" && (a.answer === "decline" || wb)) dropBefore(id, a.answer === "decline" ? a.at : a.before.at); }
    if (heldAgree.has(id) && !markLive(rec, heldAgree.get(id))) heldAgree.delete(id);   // a newer answer taken from the other page (a parent's Disagree, a Don't Allow) ends the parent's wait here too
    markDirty("clients", id); { const kk = key("clients", id); if (!timers.has(kk)) timers.set(kk, setTimeout(() => flushOne("clients", id), 400)); }   // sent from here too, soon, as a record taken is (twice is harmless: the server knows each answer's id); a mark left with nothing sent kept the older copy over the server's
  }
  if (S.clientMode && p.tab && Array.isArray(p.profile) && Array.isArray(p.dirty)) for (const [ck, from] of [...carriedFrom]) if (from === p.tab) { const i = ck.indexOf("\n"), cid = ck.slice(0, i), f = ck.slice(i + 1), theirs = ((p.profile || []).find((e) => Array.isArray(e) && e[0] === cid) || [null, []])[1] || []; if (!theirs.includes(f)) { const q = pendingProfile.get(cid); if (q && q.has(f) && !typedHere.has(ck)) { q.delete(f); if (!q.size) pendingProfile.delete(cid); answers = true; } carriedFrom.delete(ck); } }
  for (const k of new Set([...(p.dirty || []), ...(S.clientMode ? (p.profile || []).filter((e) => Array.isArray(e) && typeof e[0] === "string").map((e) => key("clients", e[0])) : [])])) {
    if (typeof k !== "string") continue;
    const m = recMap(k), id = k.slice(k.indexOf("/") + 1); const dr = m === trainings && S.templateDraft && S.templateDraft.id === id ? S.templateDraft : null; if (!m || (dr && dr.dirty && !dr.taken && !gone.has(k) && !(recs.has(k) && sameRec(m.get(id), recs.get(k))))) continue;   // v316 (the twenty-third check round): a template this page holds as a draft it typed in keeps its own (two windows typing one template: a known limit); one only looked at, or only taken from the other page, takes the other page's waiting save or Delete (left out, this page's next write of the queue dropped it: his Save template never reached the server)
    if (!(p.dirty || []).includes(k) && !(m === clients && S.clientMode)) continue;
    if (m === clients && S.clientMode) {                          // the client's phone: never the copy, only the details the other page still has to send, with their values (this page's own waiting stand), even over this page's own changes, so neither page's write drops the other's
      const d = recs.get(k), mine = clients.get(id); if (!d || !mine) continue;
      const q = pendingProfile.get(id) || new Set(), theirs = ((p.profile || []).find((e) => Array.isArray(e) && e[0] === id) || [null, []])[1] || [];
      const hAt = (r) => Date.parse(r && r.choices && r.choices.health && r.choices.health.at) || 0, pa = (pendingChoices.get(id) || new Map()).get("health"), wPh = Math.max(Date.parse(withdrawnAt.get(id)) || 0, pa && isWithdrawal(pa) ? Date.parse(pa.at) || 0 : 0, pa && pa.before && isWithdrawal(pa.before) ? Date.parse(pa.before.at) || 0 : 0), wCp = ["declined", "off"].includes(mine.choices && mine.choices.health && mine.choices.health.state) ? hAt(mine) : 0, tuF = new Map((((p.under || []).find((e) => Array.isArray(e) && e[0] === id) || [null, []])[1] || []).filter((e) => Array.isArray(e))), wNewer = (f) => { const t = Date.parse(String(tuF.get(f) || "").split("|")[2]) || 0; return (t ? wPh > t : wPh > hAt(d)) || wCp > hAt(d); };   // a withdrawal this page knows of, newer than the health answer the other page's copy holds: the details it still has waiting were typed before it (the check round: a Don't Allow deleted them, then a relaunch or a second page brought them back)
      const take = theirs.filter((f) => typeof f === "string" && (!q.has(f) || !typedHere.has(id + "\n" + f)) && JSON.stringify(profileGet(mine, f)) !== JSON.stringify(profileGet(d, f)) && (f === "unit" || !wNewer(f))); if (!take.length) continue;   // a value this page already holds is nothing new to send (the check round: two pages handed one detail back and forth on reconnecting)
      for (const f of take) { profilePut(mine, f, profileGet(d, f)); carriedFrom.set(id + "\n" + f, p.tab); typedHere.delete(id + "\n" + f); } if (!pendingProfile.has(id)) pendingProfile.set(id, new Set()); for (const f of take) pendingProfile.get(id).add(f); { const tu = new Map((((p.under || []).find((e) => Array.isArray(e) && e[0] === id) || [null, []])[1] || []).filter((e) => Array.isArray(e))); if (!profileUnder.has(id)) profileUnder.set(id, new Map()); for (const f of take) profileUnder.get(id).set(f, tu.get(f) || (d.choices && d.choices.health && d.choices.health.at) || ""); }
      markDirty("clients", id); if (!timers.has(k)) timers.set(k, setTimeout(() => flushOne("clients", id), 400)); answers = true; continue;
    }
    if (dirty.has(k) && takenFrom.get(k) !== p.tab) continue;     // this page's own edit of it stands; v316 (the eighteenth check round): a copy this page only took from that page gives way to that page's newer one (a tab behind took the first keystroke of a rename typed in the other, refused the rest, and wrote it over the finished name)
    if (recs.has(k)) { const d = recs.get(k); if (m === trainings) repairTimed(d); if (m === clients) { const mine = clients.get(id), q = pendingProfile.get(id); if (mine && q) for (const f of q) profilePut(d, f, profileGet(mine, f)); for (const [ck, a] of pendingChoices.get(id) || []) applyChoice(d, ck, a.answer, a.parent, a.at, [today(), laToday()], a.by, a.id); } { const ts = stampOf.get(k), ms = seenAt.get(k), newer = !!ts && (!ms || (Date.parse(ts) || 0) > (Date.parse(ms) || 0)); if (m.has(id) && sameRec(dr && dr.dirty ? JSON.parse(dr.snapshot) : m.get(id), d) && !newer) continue; } if (dr) { dr.snapshot = JSON.stringify(d); if (!dr.dirty) adoptDoc(id, d); else if (!dr.taken && sameRec(m.get(id), d)) { dr.dirty = false; forgetDraft(id, true); if (ui.paintDraftBar) ui.paintDraftBar(); } } else if (m === trainings && m.has(id)) { const lv = m.get(id), was = { rows: (Array.isArray(lv.rows) ? lv.rows : []).map((x) => (x && typeof x === "object" ? { id: x.id, label: x.label, clientNote: x.clientNote } : x)) }; adoptDoc(id, d); if (ui.relabeled) ui.relabeled(id, was, m.get(id), true); } else { if (m === trainings && ui.forgetCards) ui.forgetCards(id); m.set(id, d); } } else if (gone.has(k)) { if (!m.has(id) && deletedHere.has(k) && (stampOf.get(k) || null) === deletedHere.get(k)) continue; m.delete(id); deleting.add(k); if (dr) dropDraft(id); } else continue;   // v316 (the check round): this page's own queued fields and answers ride on the copy taken, as mergeDown lays them (a detail waiting here was overwritten by the other page's older copy, then sent empty)   // a queue from before v303 holds no record: that page sends its own
    dirty.set(k, (dirty.get(k) || 0) + 1); took.add(k); takenFrom.set(k, p.tab); if (m === trainings) heldBack.add(id);   // a newer copy taken while this page's save of the older one is out goes after it (the version moves on); v316 (the eighteenth check round): a copy taken from another page is that page's, not the server's: no tidying trusts it until its save lands (a frozen window's old empty copy, taken after a sync, was tidied away with the iPad's exercises and the client's set)
  }
  for (const [id, h] of p.held || []) if (typeof id === "string" && h && typeof h === "object" && !heldAgree.has(id) && clients.has(id) && markLive(clients.get(id), h)) { heldAgree.set(id, h); answers = true; }
  if (!took.size) return answers;
  const tid = (id) => took.has("trainings/" + id), cid = (id) => took.has("clients/" + id);
  const sets = (list, map, ok) => { for (const [id, xs] of list || []) if (ok(id) && Array.isArray(xs)) map.set(id, new Set([...(map.get(id) || []), ...xs])); };
  sets(p.weights, pendingWeightRows, tid); sets(p.done, pendingDoneRows, tid); sets(p.early, pendingEarlyRows, tid); sets(p.rownotes, pendingNoteRows, tid);
  sets(p.touched, trainerTouched, tid); sets(p.named, trainerNamed, tid); sets(p.noted, trainerNoted, tid); sets(p.state, trainerState, tid);
  sets(p.profile, pendingProfile, cid); sets(p.profTouched, profileTouched, cid);
  /* v316: the client's answers another page still had to send are folded in above */
  for (const [list, set] of [[p.finish, pendingFinish], [p.skip, pendingSkip], [p.move, pendingMove], [p.miss, pendingMiss], [p.order, pendingOrder]]) for (const id of list || []) if (tid(id)) set.add(id);
  for (const [id, picks] of p.swap || []) if (tid(id) && Array.isArray(picks)) pendingSwap.set(id, new Map([...(pendingSwap.get(id) || []), ...picks]));
  for (const id of p.plans || []) if (cid(id)) planTouched.add(id);
  for (const [list, map] of [[p.notesGone, deletedNotes], [p.packagesGone, deletedPackages], [p.foldersGone, deletedFolders], [p.foldersTouched, folderTouched]]) for (const [n, c] of list || []) if (cid(c)) map.set(n, c);
  for (const [k, stamp] of p.stamps || []) if (took.has(k)) { if (stamp) seenAt.set(k, stamp); else seenAt.delete(k); }   // its record goes with the copy that page read it against
  for (const [k, doc] of p.docs || []) if (took.has(k) && doc) seenDoc.set(k, doc);
  for (const k of took) if (!timers.has(k)) { const kind = k.slice(0, k.indexOf("/")), id = k.slice(k.indexOf("/") + 1); timers.set(k, setTimeout(() => flushOne(kind, id), 400)); }   // sent from here too: twice is harmless, every write is whole
  setTimeout(() => { if (ui.render) ui.render(); }, 0);
  return true;
}
// what still has to reach the server is written to the device too, so closing the app with no signal loses nothing
let slimDue = false, slimMore = false, copySafe = false, slimOn = false;   // v324: the queue did not fit and waits for the device copy's write; something changed while that write was out; that write has just landed; the queue on the device is the short one (persistPending, below)
const queueKept = (ok) => { const was = S.queueFull; S.queueFull = !ok; if (was !== S.queueFull && ui.setStatus) ui.setStatus(); };   // the bar says when the device keeps no queue at all
const queueFresh = () => { slimDue = false; slimMore = false; copySafe = false; slimOn = false; };   // the tests' reset: a launch starts so
const slimAfter = (ok) => { if (!slimDue) return; slimDue = false; const more = slimMore; slimMore = false; if (winLost()) return; if (!ok) { queueKept(false); return; } copySafe = true; try { persistPending(); } finally { copySafe = false; } if (more && idbDb && slimOn) { slimDue = true; localBackend.flushDb(); } };   // the device copy's write has answered: the queue as it is now, without what the copy holds; a copy that could not be written leaves the queue as it was (a waiting key beside an older record could send that record over a newer one)
function persistPending() {
  if (winLost()) return;
  try { if (localStorage.getItem(TAB_KEY) !== TAB) adoptQueue(lsGet("fiala.pending.v1")); } catch (_) {}
  try { const sx = lsGet(SIDE); if (sx && typeof sx === "object" && sx.tab !== TAB) adoptQueue({ wd: sx.wd, choices: sx.choices, settled: sx.settled, held: sx.held, owner: sx.owner, tab: sx.tab }); } catch (_) {}   // the last write was another page's (or an earlier launch's): what it holds is taken on before this one writes over it
  for (const [cid, m] of pendingChoices) { const a = m.get("health"); if (a && isWithdrawal(a)) noteWithdrawn(cid, a.at); if (a && a.before && isWithdrawal(a.before)) noteWithdrawn(cid, a.before.at); }
  const q = { deliv: [...deliv].slice(-100), wd: [...withdrawnAt], dirty: [...dirty.keys()].filter((k) => !(recMap(k) && !recOf(k) && !deleting.has(k))), weights: [...pendingWeightRows].map(([id, r]) => [id, [...r]]), done: [...pendingDoneRows].map(([id, r]) => [id, [...r]]), early: [...pendingEarlyRows].filter(([, r]) => r.size).map(([id, r]) => [id, [...r]]), rownotes: [...pendingNoteRows].filter(([, r]) => r.size).map(([id, r]) => [id, [...r]]), profile: [...pendingProfile].filter(([, f]) => f.size).map(([id, f]) => [id, [...f]]), under: [...profileUnder].filter(([id, m]) => m.size && pendingProfile.has(id)).map(([id, m]) => [id, [...m]]), held: [...heldAgree], settled: [...settledAnswers].slice(-100), choices: [...pendingChoices].filter(([, m]) => m.size).map(([id, m]) => [id, [...m]]),
    finish: [...pendingFinish], skip: [...pendingSkip], move: [...pendingMove], miss: [...pendingMiss], swap: [...pendingSwap].map(([id, m]) => [id, [...m]]), order: [...pendingOrder],
    touched: [...trainerTouched].map(([id, r]) => [id, [...r]]), named: [...trainerNamed].map(([id, r]) => [id, [...r]]), noted: [...trainerNoted].map(([id, r]) => [id, [...r]]), state: [...trainerState].map(([id, f]) => [id, [...f]]),
    plans: [...planTouched], profTouched: [...profileTouched].filter(([, f]) => f.size).map(([id, f]) => [id, [...f]]), notesGone: [...deletedNotes], packagesGone: [...deletedPackages], foldersGone: [...deletedFolders], foldersTouched: [...folderTouched], fromFile: [...fromFile],   // the coach's intent about a client record: a plan changed, a note or package removed, a backup restored
    stamps: [...dirty.keys()].map((k) => [k, seenAt.get(k) || null]), docs: [...dirty.keys()].filter((k) => seenDoc.has(k)).map((k) => [k, seenDoc.get(k)]),   // the stamp and the copy it describes: a save sent after a relaunch still merges against what this device last read
    recs: [...new Set([...dirty.keys(), ...(S.clientMode ? [...pendingProfile].filter(([, f]) => f.size).map(([id]) => key("clients", id)) : [])])].map((k) => [k, recOf(k)]).filter(([, d]) => d), gone: [...dirty.keys()].filter((k) => recMap(k) && !recOf(k) && deleting.has(k)),   // (15 Nov 2026, the audit's #1) each record still to send as it is now, and each one deleted here: a device copy that stopped saving (a full device) can never send an older copy over the server's, nor make a record it lost look deleted
    owner: S.pendingOwner || S.sessionEmail || "", tab: TAB };
  // v324 (the outside audit of 20 Nov 2026, its #5): the queue may not fit the browser's small store (about 2.6 million characters: hundreds of records waiting at once, after a
  // big restore, an exercise renamed everywhere or a long stretch with no signal). Its write failed with no word, the device copy (the database) held the edits, and after a
  // relaunch none of them was waiting: the next sync put the server's older copies back. Now the heavy parts give way: the queue is kept short (slim: which records wait,
  // and every mark), and each record as it is now, the stamp it was read under and the copy last read are the device copy's own (copyOf: `seen`, `bases`), written first and
  // in one write, so a waiting record, its stamp and its copy read are always of one moment (a stamp newer than its record would write that record over a newer one, and a
  // copy read newer than its record would undo the other device's changes in a merge). With no database, or when even the short queue does not fit, the bar says the device
  // is not saving (S.queueFull), as for the device copy.
  let kept = lsSet("fiala.pending.v1", q);
  if (kept) { slimDue = false; slimMore = false; slimOn = false; }
  else if (copySafe) { kept = lsSet("fiala.pending.v1", { ...q, recs: [], docs: [], stamps: [], slim: true }); slimOn = kept; }   // called from the device copy's own write (slimAfter): every record is on the device as it is now
  else if (idbDb && slimDue) slimMore = true;                       // a change made while the device copy's write is out: that write does not hold it, so another follows (slimAfter)
  else if (idbDb) { slimDue = true; localBackend.flushDb(); }       // the device copy first, at once; its answer writes the short queue
  if (kept || copySafe || !idbDb) queueKept(kept);
  lsSet(SIDE, { wd: [...withdrawnAt], held: [...heldAgree], settled: [...settledAnswers].slice(-100), choices: [...pendingChoices].filter(([, m]) => m.size).map(([id, m]) => [id, [...m]]), owner: S.pendingOwner || S.sessionEmail || "", tab: TAB });
  try { localStorage.setItem(TAB_KEY, TAB); } catch (_) {}
  if (S.sessionEmail && !S.pendingOwner) S.pendingOwner = S.sessionEmail;
}
function restorePending() {
  const p = lsGet("fiala.pending.v1"); if (!p || typeof p !== "object") { try { localStorage.removeItem(SIDE); } catch (_) {} return; }
  { const sx = lsGet(SIDE); if (sx && typeof sx === "object" && (!sx.owner || !p.owner || sx.owner === p.owner)) { p.settled = [...(p.settled || []), ...(sx.settled || [])]; p.choices = [...(sx.choices || []), ...(p.choices || [])]; p.held = [...(p.held || []), ...(sx.held || [])]; p.wd = [...(p.wd || []), ...(sx.wd || [])]; } }   // v316 (the check rounds): the answers also kept under a key no v315 page writes, folded with the queue's own (a v315 page still open on release day rewrites the queue without them)
  for (const k of p.dirty || []) if (!dirty.has(k)) dirty.set(k, 1);
  for (const [id, rows] of p.weights || []) pendingWeightRows.set(id, new Set([...(pendingWeightRows.get(id) || []), ...rows]));
  for (const [id, rows] of p.done || []) pendingDoneRows.set(id, new Set([...(pendingDoneRows.get(id) || []), ...rows]));
  for (const [id, rows] of p.early || []) pendingEarlyRows.set(id, new Set([...(pendingEarlyRows.get(id) || []), ...rows]));
  for (const [id, rows] of p.rownotes || []) pendingNoteRows.set(id, new Set([...(pendingNoteRows.get(id) || []), ...rows]));
  for (const id of p.finish || []) pendingFinish.add(id);
  for (const id of p.skip || []) pendingSkip.add(id);
  for (const id of p.move || []) pendingMove.add(id);
  for (const id of p.miss || []) pendingMiss.add(id);
  for (const id of p.order || []) pendingOrder.add(id);
  for (const [id, ks] of p.profile || []) { pendingProfile.set(id, new Set([...(pendingProfile.get(id) || []), ...ks])); markDirty("clients", id); }   // the client's own profile fields (v299): sent again on this launch (the rule may have been missing last time)
  for (const [id, xs] of p.under || []) if (typeof id === "string" && Array.isArray(xs)) { if (!profileUnder.has(id)) profileUnder.set(id, new Map()); const m = profileUnder.get(id); for (const e of xs) if (Array.isArray(e) && !m.has(e[0])) m.set(e[0], e[1]); }
  for (const e of p.wd || []) if (Array.isArray(e) && noteWithdrawn(e[0], e[1])) dropBefore(e[0], e[1]);
  for (const e of p.deliv || []) if (Array.isArray(e) && typeof e[0] === "string") { deliv.delete(e[0]); deliv.set(e[0], e[1]); }
  settleFrom(p.settled);                                           // v316: the answers already replied to, first: never sent again
  for (const [id, xs] of p.choices || []) if (Array.isArray(xs)) { pendingChoices.set(id, foldAnswers(pendingChoices.get(id), xs)); markDirty("clients", id); }   // v316: the client's own answers (Share time zone with coach, Store health details): sent again on this launch
  for (const [id, h] of p.held || []) if (typeof id === "string" && h && typeof h === "object" && markLive(clients.get(id), h)) heldAgree.set(id, h);   // v316: an Agree refused for a parent: its details still wait, and the parent is asked again (a mark outlived by a newer answer on record stays gone)
  for (const id of new Set([...pendingMove, ...pendingMiss, ...pendingOrder, ...[...pendingNoteRows].filter(([, r]) => r.size).map(([id]) => id), ...[...pendingEarlyRows].filter(([, r]) => r.size).map(([id]) => id)])) markDirty("trainings", id);   // sent again on this launch (the rule may have been missing last time)
  { const recs = new Map((p.recs || []).filter((e) => Array.isArray(e) && typeof e[0] === "string" && e[1] && typeof e[1] === "object" && e[1].id === e[0].slice(e[0].indexOf("/") + 1))), gone = new Set(p.gone || []);   // (15 Nov 2026, the audit's #1) the records the queue holds win over the device copy, which may have stopped saving before them (a full device); a queued record the device lost and never deleted here is the server's again: nothing is deleted there for it
    for (const k of [...dirty.keys()]) { const m = recMap(k), id = k.slice(k.indexOf("/") + 1); if (!m) continue; if (S.templateDraft && S.templateDraft.id === id) { if (recs.has(k)) { const d = recs.get(k); repairTimed(d); S.templateDraft.snapshot = JSON.stringify(d); continue; } if (!gone.has(k)) continue; dropDraft(id); } if (recs.has(k)) { const d = recs.get(k); if (m === trainings) repairTimed(d); m.set(id, d); } else if (gone.has(k)) { m.delete(id); deleting.add(k); } else if (!m.has(id)) dirty.delete(k); } }   // v316 (the twenty-second check round): a template taken back as a draft: the copy its waiting save sends is the template as saved (it went back to the device copy, older than that save's merge, and the send after the signal came back dropped the iPad's move and exercise)
  for (const [id, picks] of p.swap || []) pendingSwap.set(id, new Map([...(pendingSwap.get(id) || []), ...picks]));
  for (const [id, rows] of p.touched || []) trainerTouched.set(id, new Set([...(trainerTouched.get(id) || []), ...rows]));
  for (const [id, fields] of p.state || []) trainerState.set(id, new Set([...(trainerState.get(id) || []), ...fields]));
  for (const [id, rows] of p.named || []) trainerNamed.set(id, new Set([...(trainerNamed.get(id) || []), ...rows]));
  for (const [id, rows] of p.noted || []) trainerNoted.set(id, new Set([...(trainerNoted.get(id) || []), ...rows]));
  for (const [k, stamp] of p.stamps || []) if (stamp && !seenAt.has(k)) seenAt.set(k, stamp);
  for (const [k, doc] of p.docs || []) if (doc && !seenDoc.has(k)) seenDoc.set(k, doc);
  if (p.slim === true) for (const k of p.dirty || []) { if (!dirty.has(k)) continue; const st = copySeen.get(k), b = copyBases.get(k); if (st && !seenAt.has(k)) seenAt.set(k, st); if (b && !seenDoc.has(k)) seenDoc.set(k, b); }   // v324: the short queue (persistPending) holds no stamps and no copies read: each waiting record takes the device copy's own, written with the record in one write
  for (const id of p.plans || []) planTouched.add(id);
  for (const [id, ks] of p.profTouched || []) profileTouched.set(id, new Set([...(profileTouched.get(id) || []), ...ks]));   // v299: the coach's own changes to the client's profile fields, so a save after a relaunch keeps the client's for the rest
  for (const [n, cid] of p.notesGone || []) deletedNotes.set(n, cid);
  for (const [pk, cid] of p.packagesGone || []) deletedPackages.set(pk, cid);
  for (const [n, cid] of p.foldersGone || []) deletedFolders.set(n, cid);
  for (const [n, cid] of p.foldersTouched || []) folderTouched.set(n, cid);
  for (const e of p.fromFile || []) { if (Array.isArray(e)) fromFile.set(e[0], Number(e[1]) || 0); else if (typeof e === "string") fromFile.set(e, 0); }   // older devices wrote the key alone
  for (const [k, v] of [...fromFile]) { if (!dirty.has(k)) fromFile.delete(k); else if (v > dirty.get(k)) fromFile.set(k, dirty.get(k)); }   // a relaunch numbers a pending edit 1 again: the marker follows it, so the save that carries the file's copy clears it; a marker with no edit behind it would hand a later edit the restore's rights — dropped
  S.pendingOwner = p.owner || "";
}
function scheduleSave(kind, id, delay = 500) {
  if (winLost()) return;
  if (kind === "trainings" && S.templateDraft && S.templateDraft.id === id && !S.templateDraft.saving) { S.templateDraft.dirty = true; S.templateDraft.taken = false; lsSet("fiala.trainings.draft", { id, doc: trainings.get(id), at: seenAt.get(key(kind, id)) || null, tab: TAB }); persistPending(); ui.paintDraftBar(); return; }   // the draft lives on its own: a relaunch brings it back unsaved; v316 (the twenty-second check round): with the server's stamp it was typed under (a template deleted on the iPad meanwhile came back with its Save), and typed on this page (onStorage)
  markDirty(kind, id); takenFrom.delete(key(kind, id)); persistPending();   // (an edit made on this page: its own from now on)
  const k = key(kind, id);
  clearTimeout(timers.get(k));
  timers.set(k, setTimeout(() => flushOne(kind, id), delay));
  ui.setStatus();
}

const dropIntent = (id) => { planTouched.delete(id); profileTouched.delete(id); for (const [n, cid] of [...deletedNotes]) if (cid === id) deletedNotes.delete(n); for (const [pk, cid] of [...deletedPackages]) if (cid === id) deletedPackages.delete(pk); for (const [n, cid] of [...deletedFolders]) if (cid === id) deletedFolders.delete(n); for (const [n, cid] of [...folderTouched]) if (cid === id) folderTouched.delete(n); };   // the save that carried them is on the server: the markers have done their work
const dropMarks = (kind, id) => { if (kind === "trainings") { trainerState.delete(id); trainerTouched.delete(id); trainerNamed.delete(id); trainerNoted.delete(id); } if (kind === "clients") dropIntent(id); };   // the coach's marks on a record (a workout's state, rows, names and notes; a client's plan, profile and deletion intents): gone once a save carried them, or once a restore replaced the copy they were made on (v315)
const deleteRec = (kind, id) => { (kind === "clients" ? clients : trainings).delete(id); deleting.add(key(kind, id)); scheduleSave(kind, id, 0); };   // v316 (the check rounds): a Delete (a person's, or an empty workout tidied away): the only way a record is ever sent as a deletion
function seedBases() {                                            // v316 (the twenty-second check round): at a launch, after the queue and a template's draft: a record not waiting to send is, as the device copy holds it, the copy this device last read, with the stamp it was read under; its first save before the first sync (or with no signal) merges the server's copy against it, never writing the whole record over it (an exercise deleted on the iPad came back, her Start this exercise was undone, a workout deleted elsewhere was written again)
  let coach = true; try { const known = lsGet("fiala.trainings.role"); coach = !known || known.role === "trainer"; } catch (_) {}
  if (coach) for (const [m, kind] of [[clients, "clients"], [trainings, "trainings"]]) for (const [id, r] of m) {
    const k = key(kind, id); if (!r || typeof r !== "object" || dirty.has(k) || deleting.has(k) || seenDoc.has(k) || (kind === "trainings" && S.templateDraft && S.templateDraft.id === id)) continue;
    seenDoc.set(k, JSON.stringify(r)); const st = copySeen.get(k); if (st && !seenAt.has(k)) seenAt.set(k, st);
  }
  copySeen.clear(); copyBases.clear();
}
function flushAll() { for (const k of [...timers.keys()]) { const [kind, id] = k.split("/"); clearTimeout(timers.get(k)); flushOne(kind, id); } }
function flushOne(kind, id) {
  if (winLost()) return Promise.resolve();
  const k = key(kind, id);
  timers.delete(k);
  localBackend.save();
  const map = kind === "clients" ? clients : trainings;
  const prev = chains.get(k) || Promise.resolve();
  S.inflight++; ui.setStatus();
  const run = prev.then(async () => {
    if (!S.backend || !dirty.has(k)) return;                    // already confirmed by an earlier run in this chain
    const doc = recOf(k);                                         // v316 (the twenty-first check round): a template's open draft as last saved (a Save template that waited for the signal sent the changes typed after it, never saved)
    const version = dirty.get(k) || 0;
    if (takenFrom.has(k)) { const q = lsGet("fiala.pending.v1"); let last = null; try { last = localStorage.getItem(TAB_KEY); } catch (_) {} if (last && last !== TAB && q && typeof q === "object" && q.tab === last && !(q.dirty || []).includes(k)) { if (dirty.get(k) === version) { dirty.delete(k); dropMarks(kind, id); if (kind === "trainings") { for (const m of [pendingWeightRows, pendingDoneRows, pendingEarlyRows, pendingNoteRows, pendingSwap]) m.delete(id); for (const s of [pendingFinish, pendingSkip, pendingMove, pendingMiss, pendingOrder]) s.delete(id); } if (!S.clientMode && doc) seenDoc.set(k, JSON.stringify(doc)); } takenFrom.delete(k); deleting.delete(k); gaveUpAt.set(k, Date.now()); scheduleSync(); return; } }   // v316 (the nineteenth check round): a copy this page only took from another page, which the queue's last writer (another page) no longer lists, was sent (or given up) by then: never sent from here (a window frozen or suspended after taking it wrote the old copy over the later change as it woke: a rename, a phone number, a client's second set); the next sync brings the server's copy, and an edit here before it merges against the copy taken (its fields are that page's, not this one's changes)
    const data = doc ? JSON.parse(JSON.stringify(doc)) : null, was = seenAt.get(k) || null; if (data) { deleting.delete(k); deletedHere.delete(k); }   // taken now, after any merge the previous run did; v316 (the check rounds): the record is here, so an earlier Delete's mark goes (a Delete tapped while this run is out marks it again and goes next)
    let attempt = 0; const as = S.sessionEmail;
    if (S.backend !== localBackend && !S.sb) { S.offline = true; return; }   // the cloud library never loaded (a first open with the network blocked): keep it queued, the next open with signal sends it
    if (S.backend !== localBackend && S.sb) {
      const sess = await withTimeout(S.sb.auth.getSession(), saveDeadline()).catch(() => null);   // a token refresh that never answers is no token
      if (!(sess && sess.data && sess.data.session)) { S.offline = true; return; }   // token not usable right now: keep it queued
    }
    for (;;) {
      if (!S.backend || S.sessionEmail !== as || winLost()) return;   // signed out, or another account signed in, while this save was out or waiting to try again: never sent through the next session (it stays queued for its own account)
      try {
        if (data) await S.backend.set(kind, id, data, version); else if (deleting.has(k)) await S.backend.del(kind, id); else { if (dirty.get(k) === version) { dirty.delete(k); dropMarks(kind, id); } return; }   // v316 (the check rounds): only a record deleted here on purpose (deleteRec) is sent as a deletion; a save for any other record not in the map (a wipe under an open page, a deletion elsewhere) sends nothing, as a relaunch already did (restorePending)
        S.failed = false; if (!data) { deleting.delete(k); deletedHere.set(k, was); }   // the stamp of the copy it deleted (cloudBackend.del drops seenAt): the same deletion re-listed by another page carries it
        if (fromFile.has(k) && version >= fromFile.get(k)) fromFile.delete(k);   // the write that carried the backup's copy landed: every later save merges as usual, even one queued meanwhile
        if (dirty.get(k) === version) { dirty.delete(k); dropMarks(kind, id); }   // the coach's state changes went with this save; a later touch keeps its flag
        if (kind === "trainings") { heldBack.delete(id); const d = S.templateDraft; if (d && d.id === id && data) { d.snapshot = JSON.stringify(data); if (S.renderedTraining === id) ui.render(); } }   // v316 (the seventeenth check round): what this save wrote is the server's copy now (merged with the server's on a conflict); the twenty-first: and a template's draft goes back to it (Discard, Back up, the device copy), the iPad's changes merged in, its page drawn again if they changed it (a template's exercises merge as one list: the cards drawn before held the old ones, the iPad's new exercise missing until the next sync and a set typed into one lost)
        confirmedAt.set(k, Date.now());
        return;
      } catch (e) {
        attempt++;
        S.failReason = reasonOf(e);
        if (isOffline(e)) { S.offline = true; return; }           // no signal: keep it queued, no red status
        if (e && e.fatal) { S.failed = true; if (fromFile.has(k) && version >= fromFile.get(k)) fromFile.delete(k); if (dirty.get(k) === version) dirty.delete(k); if (!data) deleting.delete(k); return; }   // the server said no for good: don't carry it forever
        if (attempt > 3) { S.failed = true; return; }
        await new Promise((r) => setTimeout(r, 700 * attempt + Math.random() * 400));
      }
    }
  }).finally(() => { S.inflight--; persistPending(); ui.setStatus(); });
  chains.set(k, run.catch(() => {}));
  return run;
}
// ---------- the device copy in the browser's database (v306, the audit's #1: localStorage holds about 2.6 million characters once a copy holds a "–" or a curly quote, and a coach's copy outgrew it in months) ----------
const COPY = "fiala.trainings.v1", IDB_NAME = "fiala", IDB_STORE = "kv", copySeen = new Map(), copyBases = new Map();   // copySeen: the server's stamps the device copy last kept (seedBases); copyBases (v324): the copies last read of the records waiting, which the device copy keeps while the queue is the short one (persistPending)
let idbDb = null, idbTried = false, idbTimer = 0;
function idbOpen() {                                               // the database, or null where there is none (an older or a locked-down browser): the copy then stays in localStorage, as before
  if (idbTried) return Promise.resolve(idbDb); idbTried = true;
  if (typeof indexedDB === "undefined" || !indexedDB) return Promise.resolve(null);
  return new Promise((done) => {
    let over = false; const end = (db) => { if (over) return; over = true; idbDb = db; done(db); };
    const late = setTimeout(() => end(null), 2000);                // a browser that never answers the open: this launch goes on with localStorage
    try {
      const r = indexedDB.open(IDB_NAME, 1);
      r.onupgradeneeded = () => { try { r.result.createObjectStore(IDB_STORE); } catch (_) {} };
      r.onsuccess = () => { clearTimeout(late); const db = r.result; try { db.onversionchange = () => { try { db.close(); } catch (_) {} if (idbDb === db) idbDb = null; }; } catch (_) {} end(db); };
      r.onerror = () => { clearTimeout(late); end(null); };
    } catch (_) { clearTimeout(late); end(null); }
  });
}
const idbTx = (mode, fn) => new Promise((ok) => { try { const tx = idbDb.transaction(IDB_STORE, mode), r = fn(tx.objectStore(IDB_STORE)); if (mode === "readonly") { r.onsuccess = () => ok(r.result); r.onerror = () => ok(undefined); } else { tx.oncomplete = () => ok(true); tx.onerror = () => ok(false); tx.onabort = () => ok(false); } } catch (_) { ok(mode === "readonly" ? undefined : false); } });
const copyOf = () => { const ts = Object.fromEntries(trainings), d = S.templateDraft; if (d && d.dirty && d.snapshot && ts[d.id]) ts[d.id] = JSON.parse(d.snapshot); return { clients: Object.fromEntries(clients), trainings: ts, seen: { ...Object.fromEntries(copySeen), ...Object.fromEntries(seenAt) }, ...(slimDue || slimOn ? { bases: Object.fromEntries([...dirty.keys()].filter((k) => seenDoc.has(k)).map((k) => [k, seenDoc.get(k)])) } : {}), savedAt: Date.now() }; };   // the device copy holds the template as saved, never the draft; v316 (the twenty-second check round): and the server's stamp of each record as last read (seen), for its first save after a relaunch
const takeCopy = (d) => { if (!d || typeof d !== "object" || !d.clients || !d.trainings || typeof d.clients !== "object" || typeof d.trainings !== "object") return false; for (const c of Object.values(d.clients)) if (c && c.id) clients.set(c.id, c); for (const t of Object.values(d.trainings)) if (t && t.id) { repairTimed(t); trainings.set(t.id, t); } copySeen.clear(); if (d.seen && typeof d.seen === "object" && !Array.isArray(d.seen)) for (const [k, v] of Object.entries(d.seen)) if (typeof v === "string" && v && recMap(k)) copySeen.set(k, v); copyBases.clear(); if (d.bases && typeof d.bases === "object" && !Array.isArray(d.bases)) for (const [k, v] of Object.entries(d.bases)) if (typeof v === "string" && v && recMap(k)) copyBases.set(k, v); return true; };   // a copy of the wrong shape (damaged) is passed over: the app starts empty and the queue and the server fill it, never a blank app at every launch (the audit's #20)
const localBackend = {
  load() { takeCopy(lsGet(COPY)); },                                // at once, from localStorage (the copy of a release before v306, or of a browser with no database)
  async loadDb() {                                                  // (v306) then the copy in the browser's database: newer than any in localStorage, it replaces what load() put in; one found only in localStorage moves over, and leaves localStorage its room
    if (!(await idbOpen())) return false;
    const got = await idbTx("readonly", (st) => st.get(COPY)), ls = lsGet(COPY);
    if (got && typeof got === "object" && (!ls || (Number(got.savedAt) || 0) >= (Number(ls && ls.savedAt) || 0))) { clients.clear(); trainings.clear(); takeCopy(got); }
    if (ls && (await idbTx("readwrite", (st) => st.put(copyOf(), COPY)))) { try { localStorage.removeItem(COPY); } catch (_) {} }
    return true;
  },
  save() {
    if (winLost()) return;
    if (idbDb) { clearTimeout(idbTimer); idbTimer = setTimeout(() => localBackend.flushDb(), 120); return; }   // the database: one write for a burst of saves (a sync, a restore)
    const ok = lsSet(COPY, copyOf()); S.deviceFull = !ok;
  },
  flushDb() { clearTimeout(idbTimer); idbTimer = 0; if (!idbDb || winLost()) return Promise.resolve(false); return idbTx("readwrite", (st) => st.put(copyOf(), COPY)).then((ok) => { const was = S.deviceFull; S.deviceFull = !ok; if (was !== S.deviceFull && ui.setStatus) ui.setStatus(); slimAfter(ok); return ok; }); },
  async wipe() { clearTimeout(idbTimer); idbTimer = 0; if (winLost()) return; if (idbDb) { try { localStorage.removeItem(COPY); } catch (_) {} await idbTx("readwrite", (st) => st.delete(COPY)); } else lsSet(COPY, { clients: {}, trainings: {} }); },   // a sign-out: nothing of the account stays on the device
  async set() { this.save(); },
  async del() { this.save(); },
};
// v314 (the final check): his Reorder crossing her phone, merged card by card as Reorder itself places them (roCards). A card begun (done, or a set
// logged, in the merged copy: hers or his) keeps the server's number, its rows the server's labels; his cards not begun fill the other numbers in his
// order, letters by place; rows the merge brought in from the server keep their numbers unless taken, then the next ones free. Never two cards on
// one number, and her begun card never moved: a plain "his numbering wins" moved a card she had just begun, and "hers wins" dropped his whole move.
const settleNum = (label) => { const m = /^\s*(\d+)/.exec(String(label == null ? "" : label)); return m ? parseInt(m[1], 10) : null; };
function settleOrder(target, serverData, incoming) {
  const srv = new Map(((serverData && serverData.rows) || []).filter((x) => x && x.id).map((x) => [x.id, x]));
  const begun = (r) => !!r && (!!r.done || loggedSets(r) > 0), letter = (j) => String.fromCharCode(97 + Math.min(j, 25));
  const mine = (target.rows || []).filter((r) => r && !incoming.has(r.id)).sort((a, b) => cmpLabel(a.label, b.label)), cards = [];
  mine.forEach((r, i) => { const k = String(groupKey(r.label, i)); if (!cards.length || cards[cards.length - 1].key !== k) cards.push({ key: k, rows: [] }); cards[cards.length - 1].rows.push(r); });
  const nums = cards.filter((c) => /^\d+$/.test(c.key)), taken = new Set(), free = []; let fl = 0;   // fl: the highest number a begun card before this one in his order keeps
  for (const c of nums) {
    const n = c.rows.some(begun) ? (srv.has(c.rows[0].id) ? settleNum(srv.get(c.rows[0].id).label) : Number(c.key)) : null;
    if (n == null || taken.has(n)) { c.floor = fl; free.push(c); continue; }   // (two begun cards on one server number cannot be: the later is placed as one not begun)
    taken.add(n); c.to = n; fl = Math.max(fl, n);
    c.rows.forEach((r, j) => { const s = srv.get(r.id); r.label = s && settleNum(s.label) === n ? s.label : String(n) + (c.rows.length > 1 ? letter(j) : ""); });
  }
  for (const r of (target.rows || []).filter((x) => x && incoming.has(x.id) && begun(x))) { const n = settleNum(r.label); if (n != null && !taken.has(n)) taken.add(n); }   // a row come in from the server and begun there keeps its number too: none of his cards takes it (the final check)
  const pool = [...new Set([...nums.map((c) => Number(c.key)), ...taken])].filter((n) => !taken.has(n)).sort((a, b) => a - b);
  let top = Math.max(0, ...nums.map((c) => Number(c.key)), ...taken);
  let lo = 0; for (const c of free) { lo = Math.max(lo, c.floor || 0); const i = pool.findIndex((v) => v > lo); c.to = i >= 0 ? pool.splice(i, 1)[0] : ++top; lo = c.to; c.rows.forEach((r, j) => { r.label = String(c.to) + (c.rows.length > 1 ? letter(j) : ""); }); }   // r27 review (fix F): never on a number below a begun card that comes before it in his order (the Delete of a card before hers freed a lower one: the next card took it and her phone opened it); a number left over is closed up with the rest when both copies had none left out   // (free keeps his order: nums is sorted by his labels)
  top = Math.max(top, ...nums.map((c) => c.to)); const used = new Set(nums.map((c) => c.to)), moved = new Map();
  for (const r of (target.rows || []).filter((x) => x && incoming.has(x.id)).sort((a, b) => cmpLabel(a.label, b.label))) {
    const n = settleNum(r.label); if (n == null) continue;
    if (!moved.has(n)) moved.set(n, used.has(n) ? ++top : n);
    used.add(moved.get(n)); if (moved.get(n) !== n) r.label = String(r.label).replace(/^(\s*)\d+/, "$1" + moved.get(n));
  }
}
const touchState = (id, ...fields) => { if (S.clientMode) return; if (!trainerState.has(id)) trainerState.set(id, new Set()); for (const f of fields) trainerState.get(id).add(f); };
const TABLE = { clients: "ft_clients", trainings: "ft_trainings" };
const withTimeout = (p, ms) => Promise.race([p, new Promise((r) => setTimeout(() => r({ data: null, error: { message: "network timeout" } }), ms))]);
const saveDeadline = () => S.saveWait || 15000;                       // a save that never answers must not block every later save of the record: it times out like a read, and is retried
const rpc = (name, args) => (winLost() ? Promise.resolve({ data: null, error: { message: "Failed to fetch: Fiala is in another window" } }) : withTimeout(S.sb.rpc(name, args), saveDeadline()));   // v316 (the twenty-sixth check round, R26-WAP-1): a window that lost Fiala sends no client rule (a retry put her older set back over the one corrected in the window now in use)
const coachSetPaper = async (cid, on, parent) => { if (!S.sb || S.clientMode) return { error: { message: "not signed in" } }; try { return (await rpc("coach_set_paper", { p_client: cid, p_on: !!on, p_parent: !!parent })) || {}; } catch (e) { return { error: e }; } };   // v316: the coach's "signed a paper form" (client-consent.sql): a rule, not a whole-record save, because only the server writes a client's choices
const coachWithdraw = async (cid, kind) => { if (!S.sb || S.clientMode) return { error: { message: "not signed in" } }; try { return (await rpc("coach_withdraw", { p_client: cid, p_kind: kind })) || {}; } catch (e) { return { error: e }; } };   // v316 (the check round: the policies promise a withdrawal by email or in person is carried out): the coach records it with the client's own rule's effect (client-consent.sql coach_withdraw), at once and with a signal, never through a whole-record save

const cloudBackend = {
  async set(kind, id, data, version) {
    const k = key(kind, id);
    const row = { id, data };
    if (kind === "trainings") row.client_id = data.clientId;
    let base = seenDoc.get(k) ? JSON.parse(seenDoc.get(k)) : null; const map = kind === "clients" ? clients : trainings;
    const takeZone = (serverData) => { if (kind === "clients" && serverData) for (const target of [data, map.get(id)]) { if (!target) continue; { const mine = profileTouched.get(id) || new Set(); if (!mine.has("minor") && serverData.minor === true) target.minor = true; if (!mine.has("minorUntil") && Number.isInteger(serverData.minorUntil) && !(Number.isInteger(target.minorUntil) && target.minorUntil >= serverData.minorUntil)) target.minorUntil = serverData.minorUntil; }   /* v316 (the check round): the under-18 note the server keeps (a teen's Don't Allow leaves the year) is never dropped by a copy that had not seen it, a save with nothing read or a restore's own write; only the coach's Under 18 switch on this device clears it */ for (const f of ["zone", "choices"]) { if (serverData[f] === undefined) delete target[f]; else target[f] = serverData[f]; } } };   // v315: the time zone the client's phone reported is never the coach's to change: always the server's copy, a restore's write included (the check round: a backup's old report went over the phone's newer one); v316: so are the client's own choices (choices: Share time zone with coach, Store health details), which only the client's and the paper-form rules write (client-consent.sql)
    const liveKeys = () => { const lv = kind === "trainings" ? map.get(id) : null; return lv && Array.isArray(lv.rows) ? { rows: lv.rows.map((x) => (x && typeof x === "object" ? { id: x.id, label: x.label, clientNote: x.clientNote } : x)) } : null; }, relabelLive = (was) => { const lv = map.get(id); if (was && lv && ui.relabeled) { ui.relabeled(id, was, lv, true); if (S.renderedTraining === id && ui.render) ui.render(); } };   // v316 (the twenty-second check round): the card state here follows each card's first exercise through a save's merge, as through a sync's (her Start this exercise, or an exercise deleted on the iPad, came in with the coach's own save: an open card and a set picked stayed on the old numbers)
    const draftFollows = () => { const dr = S.templateDraft; if (kind !== "trainings" || !dr || dr.id !== id) return; dr.snapshot = JSON.stringify(data); if (dr.dirty && map.get(id)) { const was = dr.taken ? lsGet("fiala.trainings.draft") : null; lsSet("fiala.trainings.draft", { id, doc: map.get(id), at: seenAt.get(k) || null, tab: was && was.id === id && was.tab ? was.tab : TAB }); } };   // v316 (the twenty-second check round): once a save of a template has taken in the other device's copy, the draft follows the copy this save now sends (Discard, the device copy, and the queue's send after a lost signal: it sent the copy from before the merge, the iPad's move and exercise gone), and a typed draft is kept with the merge in it (a relaunch brought back the copy from before)
    const takeFields = (serverData) => {                      // two of his own devices: a field this one did not change since it last read the record takes the other device's value
      takeZone(serverData);
      if (kind === "clients" && serverData && !base) { takeProfile(serverData); return; }   // v299: nothing read to measure against (a save made before this session's first sync, after a relaunch with no signal): the fields the client writes themselves stay the server's unless this device changed them (the v299 review's catch: the client's Health & safety was overwritten by the coach's device copy)
      if (!base || !serverData) return;
      const skip = kind === "clients" ? ["id", "notes", "packages", "folders", "rootOrder", "plan", "planHistory", "health", "zone", "choices"] : ["id", ...(isTemplateClient(data.clientId) ? [] : ["rows"]), "completedAt", "completedBy", "completedZone", "skippedAt", "skipReason", "missed", "date", "inPerson"];   // the fields with their own merge rules (a template's exercises have none: no client logs on one, so rows this copy did not change take the other device's, as a field does; else Move to on a stale copy undid an edit made there, the v283 review)
      const bareRows = (rows, edited = null) => { if (!Array.isArray(rows)) return canon(rows); const ys = rows.map((x) => { const y = normRow(x); if (y && typeof y === "object") { for (const g of ["weights", "repsDone"]) if (!Array.isArray(y[g]) || !y[g].length) delete y[g]; if (Array.isArray(y.alts)) y.alts = y.alts.map((a) => (typeof a === "string" && ALIASES[a]) || a); } return y; }); tidyLabels(ys, edited); return canon(ys.sort((a, b) => cmpLabel(a && a.label, b && b.label))); }, sameField = (f, a, b, edited = null) => (f === "rows" && kind === "trainings" && isTemplateClient(data.clientId) ? bareRows(a, edited) === bareRows(b) : canon(a) === canon(b));   // v316 (the twenty-first check round): a template's rows as they say, not as a drawn page holds them (the drawing adds empty sets, an empty list and the new name of an old one): opening a template is no change to them (its first Save after the iPad's took the iPad's new exercise away); the twenty-second: nor the numbers the page tidies (a lone "2a" shown as "2": two built-in programs are saved so) or an alternative's old name; and every field by what it says, never its keys' order (the server keeps an object's keys shortest first: a template moved on the iPad went back to its old folder, a client's weight typed on her phone to the coach's older one)
      for (const target of [data, map.get(id)]) {
        if (!target) continue;
        for (const f of new Set([...Object.keys(serverData), ...Object.keys(base)])) {
          if (skip.includes(f) || !sameField(f, target[f], base[f], target !== data && ui.editedRow ? ui.editedRow() : null) || JSON.stringify(serverData[f]) === JSON.stringify(target[f])) continue;   // changed here (in this copy): ours stands (v316, the twenty-third check round: the copy on screen read with the exercise just typed into, as the page will tidy it: a superset's order typed while a merging Save was out read as no change, and the server's order came back)
          if (serverData[f] === undefined) delete target[f]; else if (f === "rows" && target !== data && Array.isArray(serverData.rows) && Array.isArray(target.rows)) target.rows = keepRows(target.rows, serverData.rows); else target[f] = serverData[f];   // v316 (the twenty-second check round): the copy on screen keeps its exercises' objects (keepRows)
        }
      }
      if (kind === "clients") for (const target of [data, map.get(id)]) { if (!target) continue; for (const f of ["seenNotes", "seenFinished"]) if (Array.isArray(target[f]) && Array.isArray(serverData[f])) { const str = (xs) => (Array.isArray(xs) ? xs : []).filter((x) => typeof x === "string"), was = new Set(str(base[f])), there = new Set(str(serverData[f])); target[f] = [...new Set([...str(target[f]).filter((x) => there.has(x) || !was.has(x)), ...str(serverData[f]).filter((x) => !was.has(x))])]; } }   // v316 (the twenty-third check round): a note or a finished workout marked read on the other device since this one last read the record stays read (one list replaced the other: the iPad's read note came back as news); the twenty-fourth: an id either device let go (a note deleted, a finish taken back) stays gone, and only ids join (an odd entry doubled at every merge)
      if (kind === "clients") {                                 // Health & safety (v299) field by field: the client writes one of its fields with the client's own rule while the coach edits another on the client's card, and neither may undo the other
        const o = (x) => (x && typeof x === "object" && !Array.isArray(x) ? x : {}), bh = o(base.health), sh = o(serverData.health);
        for (const target of [data, map.get(id)]) {
          if (!target) continue;
          const th = { ...o(target.health) }; let moved = false;
          for (const f of new Set([...Object.keys(sh), ...Object.keys(bh)])) {
            if (JSON.stringify(th[f]) !== JSON.stringify(bh[f]) || JSON.stringify(sh[f]) === JSON.stringify(th[f])) continue;   // changed here: ours stands
            if (sh[f] === undefined) delete th[f]; else th[f] = sh[f]; moved = true;
          }
          if (moved) target.health = th;
        }
      }
    };
    const takeProfile = (serverData) => {                     // the client's own fields (Health details, Health & safety, the units): the server's, field by field, except those this device changed (profileTouched, marked by setProfile)
      const mine = profileTouched.get(id) || new Set(), o = (x) => (x && typeof x === "object" && !Array.isArray(x) ? x : {});
      for (const target of [data, map.get(id)]) {
        if (!target) continue;
        for (const f of ["birthday", "sex", "height", "bodyWeight", "heightUnit", "bodyUnit", "unit", "minor", "minorUntil"]) { if (mine.has(f)) continue; if (serverData[f] === undefined) delete target[f]; else target[f] = serverData[f]; }
        const th = { ...o(target.health) }, sh = o(serverData.health); let moved = false;
        for (const f of new Set([...Object.keys(sh), ...Object.keys(th)])) { if (mine.has("health." + f) || JSON.stringify(sh[f]) === JSON.stringify(th[f])) continue; if (sh[f] === undefined) delete th[f]; else th[f] = sh[f]; moved = true; }
        if (moved) target.health = th;
      }
    };
    const verbatim = () => fromFile.has(k);                    // restored from a backup: the file's copy replaces what the server holds, nothing of the server's is merged in (asked at merge time: a save already out when Restore was tapped must not merge into the restored record either)
    const noCopy = () => { if (verbatim() && version >= fromFile.get(k)) { seenAt.delete(k); seenDoc.delete(k); fromFile.delete(k); persistPending(); } };   // v315 (the fifth and sixth rounds): the restore's own write finds no copy on the server, on its first read or after a conflict (a deletion here that landed with its answer lost; one made on another device that this one has not synced since): nothing is left to keep out, so it goes as a join of a record this device never had (no marker, no stamp, no copy read), and a send again after its own answer is lost merges what the client logged on it since; the stamp goes before the queue is saved (a queue with the old stamp and no marker made a relaunch take the restored record for a deletion made elsewhere); only the restore's own write, never an older save still out when Restore was tapped
    const mergeServerRows = (serverData, against) => {        // take the client's weights/done/swaps for rows the trainer did not touch; `against`: the copy this device last read, to tell her new numbers from his
      const touched = trainerTouched.get(id) || new Set(), named = trainerNamed.get(id) || new Set(), noted = trainerNoted.get(id) || new Set(), st0 = trainerState.get(id) || new Set(), cardSig = (rows, ids) => { const g = new Map(); (Array.isArray(rows) ? rows : []).forEach((x) => { if (!x || !ids.has(x.id)) return; const k = String(groupKey(x.label, 0)); if (!g.has(k)) g.set(k, []); g.get(k).push(String(x.id)); }); return JSON.stringify([...g].map(([k, v]) => (/^\d+$/.test(k) ? "#" : k) + ":" + v.sort().join(",")).sort()); }, sameCards = () => { if (!against || !Array.isArray(against.rows) || !serverData || !Array.isArray(serverData.rows)) return true; const srv = new Set(serverData.rows.map((x) => x && x.id)), ids = new Set(against.rows.filter((x) => x && x.id && srv.has(x.id)).map((x) => x.id)); return cardSig(against.rows, ids) === cardSig(serverData.rows, ids); }, claimed = st0.has("order") || (st0.has("orderDel") && sameCards());   /* r27 review (fix E's reach): the card's Delete exercise claims the order only while the other copy put no exercise in another card or under a word (W, Finisher): a pure renumbering there (her Start, a Reorder) gives way as before; a join, a split or a warm-up made there merges row by row */   // three separate claims per row: the log, the name, the note — a coach who only wrote a note keeps nothing else
      const revived = new Set(), live = trainings.get(id), incoming = new Map(), tight = (rows) => { const ns = [...new Set((Array.isArray(rows) ? rows : []).map((x) => settleNum(x && x.label)).filter((v) => v != null))].sort((a, b) => a - b); return ns.every((v, i) => v === i + 1); }, pre = new Map([data, live].filter(Boolean).map((x) => [x, { tight: tight(x.rows), num: new Map((Array.isArray(x.rows) ? x.rows : []).filter((y) => y && y.id).map((y) => [y.id, settleNum(y.label)])) }])), followed = new Set();             // per copy: the rows the three-way merge brought in from the server (v314's settleOrder places them last); v321 (the twenty-sixth check round, R26-MRG-4, R26-MRG-5): each copy as it was before this merge (pre: whether its cards had every number from 1 on, and each exercise's number), and the exercises that followed their card (followed)
      if (against && Array.isArray(against.rows) && serverData && Array.isArray(serverData.rows)) {   // (15 Nov 2026, the audit's #4) the exercise list three ways, by row id: one the other device removed (read here, gone from the server's copy, not changed here since) goes here too, and one it added (on the server's copy, never read here) comes in; one removed or added here stays so
        const bare = (x) => { const y = normRow(x); if (y && typeof y === "object") { const l = String(y.label == null ? "" : y.label).trim(); if (/^\d+\s*[a-z]*$/i.test(l)) delete y.label; else if (/^w\s*[a-z]?$/i.test(l)) y.label = "W"; } return canon(y); }, was = new Map(against.rows.filter((x) => x && x.id).map((x) => [x.id, bare(x)])), there = new Set(serverData.rows.map((x) => x && x.id));   // v321 (the twenty-sixth check round, R26-MRG-1): an exercise as it says, its number aside: a number changed here is no change of the exercise (this device's own Delete exercise, Reorder or the page's tidy renumbers the rest: an exercise the other device deleted came back, with what was logged on it)
        for (const target of [data, live]) {
          if (!target || !Array.isArray(target.rows)) continue;
          const have = new Set(target.rows.map((x) => x && x.id));
          target.rows = target.rows.filter((x) => !(x && was.has(x.id) && !there.has(x.id) && was.get(x.id) === bare(x)));
          for (const sr of serverData.rows) if (sr && sr.id && !was.has(sr.id) && !have.has(sr.id)) { target.rows.push(JSON.parse(JSON.stringify(sr))); if (!incoming.has(target)) incoming.set(target, new Set()); incoming.get(target).add(sr.id); }
          for (const sr of serverData.rows) { const br = sr && sr.id && was.has(sr.id) && !have.has(sr.id) ? against.rows.find((x) => x && x.id === sr.id) : null; if (br && (loggedSets(sr) > loggedSets(br) || (!!sr.done && !br.done))) { revived.add(sr.id); target.rows.push(JSON.parse(JSON.stringify(sr))); if (!incoming.has(target)) incoming.set(target, new Set()); incoming.get(target).add(sr.id); } }   // v321 (the twenty-seventh check round, R27-MRG-7, the owner's pick B after the pictures, 25 Nov 2026): an exercise deleted here that the client logged a set on, or finished or skipped, since this copy was read comes back, with what she logged (the question promised "with anything logged on it" over a copy that showed nothing: her sets went from the server, her phone and her History); it is closed below
        }
      }
      const renumbered = (target) => claimed && !!target && (!against || !Array.isArray(against.rows) || (target.rows || []).some((x) => { const b = against.rows.find((y) => y.id === x.id); return !!b && String(b.label || "") !== String(x.label || ""); }));   // (only rows in that copy: one added since, here or by the merge just above, is no renumbering of his)   // v314: his Reorder's claim holds only while his numbers still differ from the copy he last read (the v314 review: kept past the save that carried them, it undid her later Start this exercise)
      const keepAll = new Map([data, live].map((x) => [x, renumbered(x)])); const follow = () => { if (!against || !Array.isArray(against.rows) || !serverData || !Array.isArray(serverData.rows)) return; const there = new Set(serverData.rows.map((x) => x && x.id)), srvNum = new Map(serverData.rows.filter((x) => x && x.id).map((x) => [x.id, settleNum(x.label)])), based = new Set(against.rows.map((x) => x && x.id)), atN = new Map(against.rows.filter((x) => x && x.id).map((x) => [x.id, settleNum(x.label)])); for (const target of [data, live]) { if (!target || !Array.isArray(target.rows) || keepAll.get(target) || !pre.has(target)) continue; const mine = pre.get(target).num, both = target.rows.filter((y) => y && there.has(y.id) && mine.has(y.id) && based.has(y.id)); for (const r of target.rows) { if (!r) continue; const here = !there.has(r.id), joined = !here && mine.has(r.id) && based.has(r.id) && mine.get(r.id) !== atN.get(r.id), n = here || joined ? mine.get(r.id) : !mine.has(r.id) && !based.has(r.id) ? srvNum.get(r.id) : null; if (n == null || settleNum(r.label) !== n) continue; const mates = both.filter((y) => y !== r && (here || joined ? mine.get(y.id) : srvNum.get(y.id)) === n && (!joined || atN.get(y.id) === n)), to = [...new Set(mates.map((y) => settleNum(y.label)))]; if (to.length !== 1 || to[0] == null || to[0] === n) continue; r.label = String(r.label).replace(/^(\s*)\d+/, "$1" + to[0]); followed.add(r); } } };   // his Reorder's numbering: no row takes the server's number one by one; settleOrder places the cards once the rows are merged; v321 (the twenty-sixth check round, R26-MRG-4): an exercise only one side has (added or joined there, or here) follows the exercises it shared a card with on that side to the number the merge gave them (follow: a join crossing a renumber on the other device split his superset, or made one nobody made)
      const preRow = new Map([data, live].filter(Boolean).map((x) => [x, new Map((Array.isArray(x.rows) ? x.rows : []).filter((y) => y && y.id).map((y) => [y.id, { label: String(y.label == null ? "" : y.label).trim(), rest: y.rest }]))])), placeRest = (target, sr, lr, br) => { const sv = (v) => (v != null ? String(v) : ""), lab = (x) => String(x && x.label != null ? x.label : "").trim(), nl = (l) => { const m = /^(\d+)([a-z])$/i.exec(l); return m ? [m[1], m[2].toLowerCase()] : null; }, pr = preRow.get(target); if (!pr || !pr.has(lr.id)) return undefined; const B = nl(lab(br)), L = nl(pr.get(lr.id).label), R = nl(lab(sr)); if (!B || !L || !R || (L[1] === B[1]) === (R[1] === B[1])) return undefined; const mates = (ids, num, get) => new Set(ids.filter((i) => (nl(get(i)) || [])[0] === num)), bl = new Map((against.rows || []).filter((z) => z && z.id).map((z) => [z.id, lab(z)])), sl = new Map((serverData.rows || []).filter((z) => z && z.id).map((z) => [z.id, lab(z)])), bc = mates([...bl.keys()], B[0], (i) => bl.get(i)), sc = mates([...sl.keys()], R[0], (i) => sl.get(i)), hc = mates([...pr.keys()], L[0], (i) => pr.get(i).label), same = (a, b) => a.size === b.size && [...a].every((v) => b.has(v)); if (bc.size < 2 || !same(bc, sc) || !same(bc, hc)) return undefined; const atB = (letter) => (against.rows || []).find((z) => z && bc.has(z.id) && (nl(lab(z)) || [])[1] === letter); if (L[1] === B[1]) { const yb = atB(R[1]), yl = yb && pr.get(yb.id); if (!yb || !yl || (nl(yl.label) || [])[1] !== R[1]) return undefined; return sv(yl.rest) !== sv(yb.rest) ? sv(yl.rest) : sv(sr.rest); } const yb = atB(L[1]), ys = yb && (serverData.rows || []).find((z) => z && z.id === yb.id); if (!yb || !ys || (nl(lab(ys)) || [])[1] !== L[1]) return undefined; return sv(ys.rest) !== sv(yb.rest) && sv(pr.get(lr.id).rest) === sv(yb.rest) ? sv(ys.rest) : null; };   // r27 review: a superset's rests belong to its places (Reorder moves them so, v314): an exercise moved inside its card on one side only takes the rest of its new place, merged three ways by place (the Mac's new round rest became the transition when the iPad had swapped the superset's exercises, and the iPad's went when the Mac had)
      const closed = new Map([data, live].filter(Boolean).map((x) => { if (!against || !Array.isArray(against.rows) || !pre.has(x)) return [x, new Map()]; const mine = pre.get(x).num, ys = JSON.parse(JSON.stringify(against.rows.filter((y) => y && y.id))), gone = ys.filter((y) => !mine.has(y.id)).sort((a, b) => cmpLabel(a.label, b.label)); let rows = ys; for (const g0 of gone) { rows = rows.filter((y) => y.id !== g0.id); const gk = String(groupKey(g0.label, -1)), groups = []; [...rows].sort((a, b) => cmpLabel(a.label, b.label)).forEach((r, i) => { const k = String(groupKey(r.label, i)); if (!groups.length || groups[groups.length - 1].key !== k) groups.push({ key: k, rows: [] }); groups[groups.length - 1].rows.push(r); }); let n = 0; for (const g of groups) { const num = /^\d+$/.test(g.key); if (!num && g.key !== "w") continue; const b0 = num ? String(++n) : "W"; g.rows.forEach((r, j) => { r.label = g.key === gk ? b0 + (g.rows.length > 1 ? String.fromCharCode(97 + j) : "") : num ? String(r.label).replace(/^(\s*)\d+/, "$1" + b0) : r.label; }); } } return [x, new Map(rows.map((y) => [y.id, String(y.label == null ? "" : y.label)]))]; }));   // v321 (the twenty-eighth check round, R28-DAT-1, R28-DAT-2): each exercise's number as this device's own Delete exercise left it (the copy last read, the exercises deleted here taken out and the numbers closed up as renumber does): a number his Delete only closed up is no number of his (read so, the other device's warm-up, join or word after the exercise he deleted went back to his numbers once round 27's claim gave way, and her Start this exercise crossing it made a superset nobody made: 1a Back squat + 1b Calf raise, a set marked done on Back squat that nobody did)
      for (const sr of (serverData && serverData.rows) || []) {
        for (const target of [data, live]) {
          const lr = target && (target.rows || []).find((x) => x.id === sr.id); if (!lr) continue;
          if (sr.sets != null && String(sr.sets) !== String(lr.sets)) { const br = against && (against.rows || []).find((x) => x.id === sr.id); if (br && String(br.sets) === String(lr.sets)) lr.sets = sr.sets; }
          { const br = against && (against.rows || []).find((x) => x.id === sr.id); if (br) { const str = (x, f) => (x && x[f] != null ? String(x[f]) : ""), sign = (x) => (x && x.ramp ? "ramp" : x && x.pyramid ? "pyramid" : ""); const slot = placeRest(target, sr, lr, br); for (const f of ["reps", "tempo", "rest", "note"]) { if (f === "rest" && slot !== undefined) { if (slot !== null) lr.rest = slot; continue; } if (str(sr, f) !== str(lr, f) && str(br, f) === str(lr, f)) lr[f] = str(sr, f); } if (sign(sr) !== sign(lr) && sign(br) === sign(lr)) { delete lr.ramp; delete lr.pyramid; if (sign(sr)) lr[sign(sr)] = true; } } }   // v321 (the twenty-seventh check round): what the coach plans on an exercise (its reps, tempo, rest, instructions, and its sign, the arrow or the pyramid, one at a time) merges three ways as its number of sets does: changed on another of his devices and not here since this copy was read, the server's stands (his iPad's 5 reps went back to the Mac's 10 when the Mac, not synced since, saved any change to that workout); with no copy read his row stands, as before
          { const held = loggedSets(sr); if (held > setsOf(lr)) { const br = against && (against.rows || []).find((x) => x.id === sr.id); if (br ? held > loggedSets(br) : !touched.has(sr.id)) lr.sets = held; } }   // v313 (the second review): sets the client logged after this copy was read are never cut by a count lowered here (a join, the "…" Sets, the sets button on a copy a set behind, or no copy read); a drop asked for over sets this copy had still drops; with no copy read, only a row whose log is taken whole from the server is raised (the final check: a drop confirmed before the first sync came back as unfinished sets)   // v313: a row's number of sets merges as its number does: changed on another of the coach's devices (a join into a superset, the sets button, the "…" Sets) and not here since this copy was read, the server's count stands, before the log is cut to it (the v313 review: a stale save kept the old count beside the new number, and cut the client's sets past it)
          if (!touched.has(sr.id)) { lr.weights = sr.weights || []; lr.done = !!sr.done; lr.repsDone = sr.repsDone || []; if (sr.unit === "kg" || sr.unit === "lb") lr.unit = sr.unit; if (sr.setsDone != null) lr.setsDone = sr.setsDone; else delete lr.setsDone; if (sr.earlyReason) lr.earlyReason = String(sr.earlyReason); else delete lr.earlyReason; } else { const br = against && (against.rows || []).find((x) => x.id === sr.id); if (br) mergeSets(lr, br, sr); }   // (15 Nov 2026, the audit's #2) a row the coach changed: set by set, his value where he changed that set since he last read it, the client's everywhere else (with no copy read, his row stands whole, as before)
          if (!noted.has(sr.id)) { if (sr.clientNote) { lr.clientNote = String(sr.clientNote); if (sr.clientNoteBy) lr.clientNoteBy = String(sr.clientNoteBy); else delete lr.clientNoteBy; if (sr.clientNoteAt) lr.clientNoteAt = String(sr.clientNoteAt); else delete lr.clientNoteAt; } else { delete lr.clientNote; delete lr.clientNoteBy; delete lr.clientNoteAt; } }
          if (!named.has(sr.id) && typeof sr.name === "string") { lr.name = sr.name; lr.alts = Array.isArray(sr.alts) ? sr.alts : []; } // the client swapped in an alternative
          if (!keepAll.get(target) && typeof sr.label === "string" && sr.label !== lr.label) { const br = against && (against.rows || []).find((x) => x.id === sr.id), cz = closed.get(target), bz = br && cz && cz.get(sr.id) === String(lr.label == null ? "" : lr.label) ? cz.get(sr.id) : br && br.label, nx = (l) => { const m = /^\s*(\d+)([a-z]?)$/i.exec(String(l == null ? "" : l)); return m ? [m[1], m[2].toLowerCase()] : null; }, B = br && nx(bz), L = nx(lr.label), R = nx(sr.label); if (B && L && R) { const num = L[0] === B[0] ? R[0] : L[0], mate = !R[1] && L[1] === B[1] && !!L[1] && (target.rows || []).some((y) => y && y !== lr && settleNum(y.label) === +num && !serverData.rows.some((z) => z && z.id === y.id)); lr.label = num + (L[1] === B[1] && !mate ? R[1] : L[1]); } else if (br && String(bz || "") === String(lr.label || "")) lr.label = sr.label; }   // the client put an exercise ahead ("Start this exercise"): her number stands wherever the coach did not renumber that row himself since he last read it; none at all while his Reorder's numbers still differ from that copy (v314, "order" in trainerState, keepAll): his whole numbering stands, so a cross never leaves two cards on one number; v321 (the twenty-sixth check round, R26-MRG-2): a number and its letter merge each on its own, three ways (taken whole, the iPad's new number beside the Mac's dropped letter made a superset nobody made); the twenty-seventh (R27-TW-11): a letter the other device dropped (that exercise left alone on its card there) stays while an exercise only this device has is on that card here (a number with no letter sorts last in its card: the Mac's 2b Leg curl, 2c Step-up came back 2a Step-up, 2b Leg curl)
        }
      }
      follow();                                                     // v321 (the twenty-sixth check round, R26-MRG-4): before the rule below, which leaves an exercise that followed its card where it went
      if (against && Array.isArray(against.rows) && serverData && Array.isArray(serverData.rows)) { const there = new Set(serverData.rows.map((x) => x && x.id)), at = new Map(against.rows.filter((x) => x && x.id).map((x) => [x.id, settleNum(x.label)])); for (const target of [data, live]) { if (!target || !Array.isArray(target.rows) || keepAll.get(target)) continue; const moved = new Set(); const kept = (n) => target.rows.some((y) => y && there.has(y.id) && at.get(y.id) === n && settleNum(y.label) === n); for (const r of target.rows) { if (!r || there.has(r.id) || followed.has(r)) continue; const n = settleNum(r.label); if (n == null || !(moved.has(n) || (!kept(n) && target.rows.some((x) => x && x !== r && there.has(x.id) && settleNum(x.label) === n && at.get(x.id) !== n)))) continue; moved.add(n); } const srvMax = Math.max(0, ...target.rows.filter((x) => x && there.has(x.id)).map((x) => settleNum(x.label) || 0)), mine = [...new Set(target.rows.filter((x) => x && !there.has(x.id) && (settleNum(x.label) > srvMax || moved.has(settleNum(x.label)))).map((x) => settleNum(x.label)))].sort((a, b) => a - b), to = new Map(mine.map((v, i) => [v, srvMax + 1 + i])); for (const r of target.rows) if (r && !there.has(r.id) && to.has(settleNum(r.label)) && to.get(settleNum(r.label)) !== settleNum(r.label)) r.label = String(r.label).replace(/^(\s*)\d+/, "$1" + to.get(settleNum(r.label))); } }   // v316 (the twenty-fourth check round): an exercise deleted on the other device and changed here stays (#4), after the others, never on the number the other device just gave the next card (it made a superset nobody made); v321 (the twenty-sixth check round, R26-MRG-6, R26-TW-1): such a card is marked (moved), not moved past everything at once: the closing-up numbers it after the other device's exercises, among this device's own in its order (the Mac's two new exercises came back in each other's places)
      if (against && Array.isArray(against.rows) && serverData && Array.isArray(serverData.rows)) { const based = new Set(against.rows.map((x) => x && x.id)), at = new Map(against.rows.filter((x) => x && x.id).map((x) => [x.id, settleNum(x.label)])), srvNum = new Map(serverData.rows.filter((x) => x && x.id).map((x) => [x.id, settleNum(x.label)])); for (const target of [data, live]) { if (!target || !Array.isArray(target.rows) || keepAll.get(target) || !pre.has(target) || !incoming.has(target)) continue; const mine = pre.get(target).num, inc = incoming.get(target), to = new Map(); let top = Math.max(0, ...target.rows.map((x) => settleNum(x && x.label) || 0)); for (const s of target.rows) { if (!s || !inc.has(s.id) || followed.has(s)) continue; const n = settleNum(s.label); if (n == null || n !== srvNum.get(s.id) || serverData.rows.some((y) => y && y.id !== s.id && based.has(y.id) && srvNum.get(y.id) === n)) continue; if (!target.rows.some((r) => r && based.has(r.id) && settleNum(r.label) === n && mine.get(r.id) === n && at.get(r.id) !== n)) continue; if (!to.has(n)) to.set(n, ++top); s.label = String(s.label).replace(/^(\s*)\d+/, "$1" + to.get(n)); } } }   // r27 review: a card the other device added (none of its exercises read here) on the number this device just gave one of its own cards (a move or a split with the number picker) goes after the others, never into that card (a superset nobody made)
      for (const target of [data, live]) if (target && Array.isArray(target.rows) && keepAll.get(target)) settleOrder(target, serverData, incoming.get(target) || new Set());
      if (st0.has("orderDel") && !claimed && against && Array.isArray(against.rows) && serverData && Array.isArray(serverData.rows)) for (const target of [data, live]) { if (!target || !Array.isArray(target.rows) || keepAll.get(target) || !pre.has(target)) continue; const mine = pre.get(target).num, sn = new Map(serverData.rows.filter((x) => x && x.id).map((x) => [x.id, settleNum(x.label)])), holes = [...new Set(against.rows.filter((x) => x && x.id && !mine.has(x.id) && sn.get(x.id) != null).map((x) => sn.get(x.id)))].sort((a, b) => b - a); for (const h of holes) { if (target.rows.some((x) => x && settleNum(x.label) === h)) continue; for (const x of target.rows) { const v = x ? settleNum(x.label) : null; if (v != null && v > h) x.label = String(x.label).replace(/^(\s*)\d+/, "$1" + (v - 1)); } } }   // v321 (the twenty-eighth check round): with the numbers his Delete only closed up left to the other device (closed, above), the place each exercise he deleted held there closes up too, as his Delete closed it here (the iPad's join of Calf raise into Plank's card, crossing his Delete of Back squat, began at 2: 2 Leg curl, 4a Plank, 4b Calf raise)
      if (serverData && tight(serverData.rows)) for (const target of [data, live]) { if (!target || !Array.isArray(target.rows) || !pre.has(target) || !pre.get(target).tight || tight(target.rows)) continue; const ns = [...new Set(target.rows.map((x) => settleNum(x && x.label)).filter((v) => v != null))].sort((a, b) => a - b), to = new Map(ns.map((v, i) => [v, i + 1])); for (const r of target.rows) { const v = r ? settleNum(r.label) : null; if (v != null && to.get(v) !== v) r.label = String(r.label).replace(/^(\s*)\d+/, "$1" + to.get(v)); } }   // v321 (the twenty-sixth check round, R26-MRG-5): both copies had every number from 1 on, so has the merged one: its cards close up in their order, as Delete exercise closes them up on one device (a deletion here and an addition there, or one on each, left a number out: 1, 2, 4)
      for (const target of [data, live]) for (const r of (target && Array.isArray(target.rows) ? target.rows : [])) if (r && revived.has(r.id) && !r.done) { r.setsDone = loggedSets(r); r.done = true; }   // v321 (R27-MRG-7): the exercise brought back is finished early at the sets she logged (no reason given): nothing of it is left to do, as the coach asked
      liftSeq(serverData);
      repairTimed(data); if (live) repairTimed(live);              // seconds the client's old app typed as a weight go to the time column before this write
    };
    const keepGone = (serverData) => { if (serverData && ui.keepGone) for (const target of [data, map.get(id)]) if (target) ui.keepGone(kind, target, serverData); };   // v316 (the check rounds): a restore's own write, once it has read the server's copy (its first read, or after a conflict), keeps what the client deleted or changed in the app since this device last read the record (main.js's keepGone: the owner's pick of 19 Nov 2026, what a client deleted never comes back): the deletions a sync would have brought before the tap
    const liftSeq = (serverData) => {                            // a row's number only ever goes up: the server's, when higher, is carried on even by a coach's edit of that row or a verbatim restore, so a request that timed out on the phone can never be accepted later
      const live = trainings.get(id);
      for (const sr of (serverData && serverData.rows) || []) { if (sr.logSeq == null) continue; for (const target of [data, live]) { const lr = target && (target.rows || []).find((x) => x.id === sr.id); if (lr) lr.logSeq = Math.max(parseInt(sr.logSeq, 10) || 0, parseInt(lr.logSeq, 10) || 0); } }
    };
    for (let attempt = 0; attempt < 4; attempt++) {
      let seen = seenAt.get(k);
      const takeState = (serverData) => {                      // the client may have finished, skipped or moved it meanwhile: keep that, field by field, unless the coach changed that field
        if (kind !== "trainings" || !serverData) return;
        const mine = trainerState.get(id) || new Set();
        for (const f of ["completedAt", "completedBy", "completedZone", "skippedAt", "skipReason", "missed", "date", "inPerson"]) { if (mine.has(f)) continue; for (const target of [data, trainings.get(id)]) { if (!target) continue; if (serverData[f] === undefined) delete target[f]; else target[f] = serverData[f]; } }
        for (const target of [data, trainings.get(id)]) if (target && target.completedAt && (target.skippedAt || target.missed === true)) { delete target.skippedAt; delete target.skipReason; target.missed = false; }   // finished on one side, skipped on the other: finished stands, and the card and the session pill count the same workouts
      };
      const takeNotes = (serverData, against = base) => {      // another device may have written notes: keep both (against: the copy this device last read, for the folders)
        if (kind !== "clients" || !serverData) return;
        data.notes = mergeNotes(data.notes, serverData.notes, deletedNotes, against && against.notes); const live = clients.get(id); if (live) live.notes = mergeNotes(live.notes, serverData.notes, deletedNotes, against && against.notes);   // each copy merged from its own list: a note written while this save was out is not undone
        if (Array.isArray(serverData.packages) || Array.isArray(data.packages)) {                  // packages added on two devices: keep both
          const pc = (x) => canon(x && typeof x === "object" && !Array.isArray(x) ? { ...x, inPerson: !!x.inPerson } : x), wasP = new Map(((against && against.packages) || []).filter((x) => x && x.id).map((x) => [x.id, pc(x)])), thereP = new Set((serverData.packages || []).map((x) => x && x.id));   // (15 Nov 2026, the audit's #9) one the other device deleted (read here, gone from its copy, unchanged here) goes here too
          const srvP = new Map((serverData.packages || []).filter((x) => x && x.id).map((x) => [x.id, x])), oldP = new Map(((against && against.packages) || []).filter((x) => x && x.id).map((x) => [x.id, x])), union = (mine) => { const keep = (mine || []).filter((x) => !(x && x.id && wasP.has(x.id) && !thereP.has(x.id) && wasP.get(x.id) === pc(x))).map((x) => { if (!(x && x.id && srvP.has(x.id) && oldP.has(x.id))) return x; const b = oldP.get(x.id), o = JSON.parse(JSON.stringify(srvP.get(x.id))), v = (y, f) => (f === "inPerson" ? !!y[f] : y[f]), one = (f) => (f === "kind" || f === "size" ? ["kind", "size"] : [f]); for (const f of new Set([...Object.keys(x), ...Object.keys(b)])) if (one(f).some((g) => canon(v(x, g)) !== canon(v(b, g)))) { if (x[f] === undefined) delete o[f]; else o[f] = x[f]; } return o; }), have = new Set(keep.map((x) => x && x.id)); return [...keep, ...(serverData.packages || []).filter((x) => x && x.id && !have.has(x.id) && !deletedPackages.has(x.id))]; };   // one removed here stays removed; v316 (the twenty-third check round): and one this device did not change since it last read the record takes the other device's copy (an edit made on the iPad went back to the older copy here: name, size, In person); the twenty-fourth (the owner's pick): one both changed, field by field (this device's whole package stood)
          data.packages = union(data.packages); if (live) live.packages = union(live.packages);
        }
        if (Array.isArray(serverData.folders) || Array.isArray(data.folders)) {                    // his template folders and slides (12 Nov), changed on two devices: each kept by its id; the server's copy of one wins unless this device changed that one; one removed here stays removed; one removed on the other device (in the copy last read, gone from the server's, not changed here) goes here too
          const old = new Map(((against && against.folders) || []).filter((x) => x && x.id).map((x) => [x.id, x])), was = new Set(old.keys()), theirs = new Map((serverData.folders || []).filter((x) => x && x.id).map((x) => [x.id, x]));
          const delta = (x) => { const b = old.get(x.id); if (!b) return null; const d = {}; for (const f of new Set([...Object.keys(x), ...Object.keys(b)])) if (JSON.stringify(x[f]) !== JSON.stringify(b[f])) d[f] = x[f]; return d; };   // what this device changed on a folder since it last read it, field by field (null: never read)
          const ours = (x) => { const d = delta(x), t = theirs.get(x.id); if (!d || !t) return x; const o = { ...t, ...d }; for (const f of Object.keys(d)) if (d[f] === undefined) delete o[f]; return o; };   // the server's copy with this device's own changes on it: a Reorder here (its place) beside a rename there keeps both (the v279 review's catch)
          const adoptedThere = [...theirs.keys()].some((k) => String(k).startsWith("b:")), gone = (x) => adoptedThere && String(x.id).startsWith("b:") && !folderTouched.has(x.id);   // a built-in program's folder (made the same on every device, v281) missing from a copy that has them: deleted there, never "new here"
          const kept = (x) => theirs.has(x.id) || (!was.has(x.id) && !gone(x)) || (folderTouched.has(x.id) && Object.keys(delta(x) || { whole: 1 }).some((f) => f !== "sort"));   // gone from the server (deleted there): back only if this device changed more than its place
          const merge = (mine) => { const have = new Set((mine || []).map((x) => x && x.id)); return [...(mine || []).filter((x) => x && x.id && kept(x)).map((x) => (folderTouched.has(x.id) ? ours(x) : theirs.has(x.id) ? theirs.get(x.id) : x)), ...[...theirs.values()].filter((x) => !have.has(x.id) && !deletedFolders.has(x.id))]; };
          data.folders = merge(data.folders); if (live) live.folders = merge(live.folders);
        }
        if (isTemplateClient(id) && !folderTouched.has(":rootOrder")) for (const target of [data, live]) { if (!target) continue; if (serverData.rootOrder === undefined) delete target.rootOrder; else target.rootOrder = serverData.rootOrder; }   // the Templates page's Programs order (Reorder, v280): the server's, unless this device changed it (marked ":rootOrder"; a save with no copy read before must not wipe another device's order: the v280 review's catch)
        const planWas0 = live ? canon(live.plan) : null; if (!planTouched.has(id)) for (const f of ["plan", "planHistory"]) for (const target of [data, live]) { if (!target) continue; if (serverData[f] === undefined) delete target[f]; else target[f] = serverData[f]; } else if (against) for (const target of [data, live]) { if (!target) continue; const o = (x) => (x && typeof x === "object" && !Array.isArray(x) ? x : null), b = o(against.plan), sp = o(serverData.plan), m = o(target.plan), all = () => { for (const f of ["plan", "planHistory"]) { if (serverData[f] === undefined) delete target[f]; else target[f] = JSON.parse(JSON.stringify(serverData[f])); } }; if (canon(target.plan) === canon(against.plan) && canon(target.planHistory) === canon(against.planHistory)) { all(); continue; } const from = (x) => String(x.startedOn || ""); if (!b || !m || m.id !== b.id || from(m) !== from(b)) continue; if (!sp || sp.id !== b.id || from(sp) !== from(b)) { all(); continue; } const p = { ...m }, one = (f) => (f === "adjust" || f === "carried" ? ["adjust", "carried"] : f === "kind" || f === "size" ? ["kind", "size"] : [f]); for (const f of new Set([...Object.keys(sp), ...Object.keys(b), ...Object.keys(m)])) if (one(f).every((g) => canon(m[g]) === canon(b[g]))) { if (sp[f] === undefined) delete p[f]; else p[f] = sp[f]; } target.plan = p; if (canon(target.planHistory) === canon(against.planHistory)) { if (serverData.planHistory === undefined) delete target.planHistory; else target.planHistory = JSON.parse(JSON.stringify(serverData.planHistory)); } } if (live && planWas0 !== canon(live.plan) && ui.planMerged) ui.planMerged(id);   // a plan set on another device stands, unless this one changed it; v316 (the twenty-fourth check round, the owner's pick "Each detail separately", 25 Nov 2026): and when both changed it, field by field against the copy last read, a switch (or None) on the other device beating a field changed here (a package edited on the Mac rewrote every client on it from its old copy: the iPad's +4 weeks went)
      };
      if (!seen && attempt === 0) {                               // no stamp (edited offline, app relaunched): read first, never write over the other side blind
        const existing = await withTimeout(S.sb.from(TABLE[kind]).select("data,updated_at").eq("id", id).maybeSingle(), saveDeadline());
        if (existing.error) throw existing.error;
        if (existing.data) { if (!verbatim()) { const was = liveKeys(); takeFields(existing.data.data); if (kind === "trainings" && !isTemplateClient(data.clientId)) { mergeServerRows(existing.data.data, base); takeState(existing.data.data); } takeNotes(existing.data.data); relabelLive(was); base = JSON.parse(JSON.stringify(existing.data.data)); seenDoc.set(k, JSON.stringify(existing.data.data)); } else { if (kind === "trainings") liftSeq(existing.data.data); takeZone(existing.data.data); keepGone(existing.data.data); } seen = existing.data.updated_at; seenAt.set(k, seen); if (!verbatim()) draftFollows(); }
        else noCopy();
      }
      let res; if (winLost()) throw new Error("Failed to fetch: Fiala is in another window");   // v316 (the twenty-sixth check round, R26-WAP-1): a slow save's merge, written after the move, put the older set back
      if (seen) res = await withTimeout(S.sb.from(TABLE[kind]).update(row).eq("id", id).eq("updated_at", seen).select("updated_at"), saveDeadline());
      else res = await withTimeout(S.sb.from(TABLE[kind]).upsert(row).select("updated_at"), saveDeadline());
      if (res.error) {
        if (res.error.code === "23505" && kind === "clients") {   // that email is on another client: the email goes back to what the server holds, the rest of the edit still lands
          const srv = await withTimeout(S.sb.from(TABLE[kind]).select("data").eq("id", id).maybeSingle(), saveDeadline());
          if (srv.error) throw srv.error;
          const back = srv.data && srv.data.data ? srv.data.data.email || "" : ""; data.email = back; const live = clients.get(id); if (live) live.email = back;
          const box = ui.$ && ui.$("cEmail"); if (box && document.activeElement !== box && live && S.view.id === id) box.value = back;
          S.failReason = "that email is already on another client"; if (ui.$) ui.$("status").textContent = "That email is on another client \u00b7 not saved"; if (attempt < 3) continue;
        }
        if (res.error.code === "23505" || res.error.code === "22P02") res.error.fatal = true;   // another client has that email; an id the table cannot hold: no retry will change the answer
        if (/^22/.test(String(res.error.code || ""))) seenAt.delete(k);   // a bad stamp must not poison every retry
        throw res.error;
      }
      if (res.data && res.data.length) { seenAt.set(k, res.data[0].updated_at); seenDoc.set(k, JSON.stringify(data)); localBackend.save(); return; }
      // someone else (a client logging weights) saved first: take their weights, keep everything else, retry
      const fresh = await withTimeout(S.sb.from(TABLE[kind]).select("data,updated_at").eq("id", id).maybeSingle(), saveDeadline());
      if (fresh.error) throw fresh.error;
      if (!fresh.data) {
        if (seen && seenDoc.has(k) && !fromFile.has(k)) { map.delete(id); dirty.delete(k); deleting.delete(k); seenAt.delete(k); seenDoc.delete(k); localBackend.save(); if (kind === "trainings") { dropDraft(id); if (S.renderedTraining === id && ui.render) ui.render(); } return; }   // a record this device had seen is gone from the server: deleted on another device; it is not brought back (v316, the twenty-second check round: nor a template's unsaved draft, and its page leaves it)
        noCopy(); seenAt.delete(k); continue;
      }
      seenAt.set(k, fresh.data.updated_at);
      if (verbatim()) { if (kind === "trainings") liftSeq(fresh.data.data); takeZone(fresh.data.data); keepGone(fresh.data.data); continue; }
      const was = liveKeys(); takeFields(fresh.data.data); draftFollows(); const against = base; base = JSON.parse(JSON.stringify(fresh.data.data)); seenDoc.set(k, JSON.stringify(fresh.data.data));   // the next conflict measures against this copy
      if (kind === "trainings" && !isTemplateClient(data.clientId)) { mergeServerRows(fresh.data.data, against); takeState(fresh.data.data); }
      takeNotes(fresh.data.data, against); relabelLive(was);
    }
    throw new Error("save conflict");
  },
  async del(kind, id) {
    if (winLost()) throw new Error("Failed to fetch: Fiala is in another window");
    const { error } = await withTimeout(S.sb.from(TABLE[kind]).delete().eq("id", id), saveDeadline());
    if (error) throw error;
    seenAt.delete(key(kind, id)); seenDoc.delete(key(kind, id)); localBackend.save();   // gone: no stamp to mistake a later restore for a deletion elsewhere
  },
};

const moveOut = new Map();                                          // per workout: the client's move request still out (one the phone gave up on after its deadline can still land)
const clientBackend = {
  // Every queue is an outbox: an item stays in it until the server holds what the record says NOW. Nothing is cleared before the answer
  // comes back (a persist mid-flight, or the app being killed, loses nothing), and an answer never acknowledges a newer action — a set
  // logged, or Undo tapped, while the request was out stays queued and goes with the next flush. P0001 means the server refused for good
  // (row or workout gone): the item is dropped and the server's version comes back on the next sync. Sending twice is harmless: every rule
  // writes the whole value it is given.
  async set(kind, id, data) {
    if (kind === "clients") {                                     // the client's own profile (v299: Health details, Health & safety, the units the client lifts in), one field per request through client_set_profile
      const cq = pendingChoices.get(id); let refused = false;    // v316: the client's own answers go first (the server refuses health details until it has the Agree)
      if (cq && cq.size && !S.consentMissing) {
        const sent = (k, a) => { const lv = pendingChoices.get(id) || cq; if (lv.get(k) === a) lv.delete(k); };   // off the queue as it is now: an answer folded in from another page while this send was out stays (the check round: it was dropped with the old Map)
        const send = (k, a, takenBack = false) => rpc("client_set_choice", { p_client: id, p_kind: k, p_answer: a.answer, p_parent: a.parent || null, p_age: Math.max(0, Math.round((Date.now() - (Date.parse(a.at) || Date.now())) / 1000)), p_by: a.by || "client", p_id: a.id || null, p_taken_back: takenBack });   // p_age: how long ago the person answered, by this phone's own clock, so an older answer landing late never overrides a newer one and a clock set wrong never decides (the check round)
        let gone = false;
        for (const [k, a] of [...cq]) {
          if (a.id && settledAnswers.has(a.id)) { sent(k, a); if (settledAnswers.get(a.id) !== "ok") { undoGuess(id, k, a); if (k === "health" && a.answer === "agree") refused = true; scheduleSync(); } continue; }   // replied to already (another page sent it): never again; refused or set aside there, its guess comes off here too
          if (a.before && !(a.before.id && settledAnswers.has(a.before.id))) {   // a withdrawal given before this answer, still to go: first, marked as taken back (the check rounds: offline Don't Allow then Agree)
            const r0 = await send(k, a.before, true);
            if (r0.error && (r0.error.code === "PGRST202" || /client_set_choice/.test(r0.error.message || ""))) { S.consentMissing = true; gone = true; break; }
            if (r0.error && r0.error.code !== "P0001") throw r0.error;
            if (a.before.id) settledAnswers.set(a.before.id, r0.error ? "refused" : r0.data === "stale" ? "stale" : "ok");
          }
          delete a.before;
          const { data: said, error } = await send(k, a);
          if (error && (error.code === "PGRST202" || /client_set_choice/.test(error.message || ""))) { S.consentMissing = true; break; }   // rule not installed yet (supabase/client-consent.sql): kept on the phone, sent on a later launch
          if (a.id && (!error || error.code === "P0001")) settledAnswers.set(a.id, error ? "refused" : said === "stale" ? "stale" : "ok");   // replied to: settled for every page, with how it went
          if ((error && error.code === "P0001") || said === "stale") {   // refused for good, or set aside as older than the answer on record: the server's copy comes back with the next sync
            sent(k, a);
            undoGuess(id, k, a);                                     // off the phone's copy at once, the answer it replaced back: a detail saved before the sync never takes it for agreed (the check round)
            if (k === "health" && a.answer === "agree") { refused = true; if (/parent needed/.test((error && error.message) || "")) heldAgree.set(id, { at: a.at, why: "parent" }); }   // the details typed meanwhile wait (never sent to be refused and lost); asked again when the answer can still land (a parent to agree, or a newer Don't Allow elsewhere) (the check round)
            scheduleSync(); continue;
          }
          if (error) throw error;
          confirmedAt.set(key("clients", id), Date.now());
          sent(k, a);                                                // answered again while this was out: it goes again
        }
        { const live = pendingChoices.get(id); if (live && !live.size) pendingChoices.delete(id); }
        if (gone) return;                                            // the queue is saved once the send is over (flushOne): a save mid-send let a second page take this record without end
      }
      const q = pendingProfile.get(id); if (!q || !q.size || S.profileMissing || (pendingChoices.get(id) || new Map()).has("health")) return;   // health details wait for their Agree to land (the queue is saved once the send is over)
      const rec = clients.get(id) || data, days = [today(), laToday()]; let heldOff = false;
      for (const k of [...q]) {
        if (!q.has(k)) continue;                                     // v316 (the check rounds): taken off the phone while this pass was out (a withdrawal made elsewhere): never sent
        if (k !== "unit" && S.offline) { heldOff = true; scheduleSync(); continue; }
        const now = clients.get(id) || data;                         // v316 (the check rounds): the record as it stands now, not as the pass began
        if (k !== "unit" && (refused || (profileGet(now, k) != null && (now.paused || !(k === "birthday" ? birthdayOpen(now, days) : healthEditable(now, days)))))) continue;   // a detail cleared still goes (you can remove what you entered, a parent awaited or paused: the check round)   // a health detail goes only while the record may change it (agreed, nothing waiting for a parent): otherwise it waits on the phone for the Agree, never sent to be refused and lost (the check round)
        const sent = profileGet(now, k), tA = String((profileUnder.get(id) || new Map()).get(k) || "").split("|")[2];   // the value and its typing time read together, just before the request (the check rounds: a newer pick's time was noted as delivered)
        const { error } = await rpc("client_set_profile", { p_client: id, p_key: k, p_value: sent });
        if (error && (error.code === "PGRST202" || /client_set_profile/.test(error.message || ""))) { S.profileMissing = true; break; }   // rule not installed yet (supabase/client-profile.sql): kept on the phone and shown there, sent on a later launch
        if (error && error.code === "P0001" && /parent needed/.test(error.message || "")) { heldAgree.set(id, { at: new Date().toISOString(), why: "parent" }); scheduleSync(); continue; }   // v316 (the check round): a parent to agree first (the coach's Under 18 had not reached this phone): kept, and the parent is asked
        if (error && error.code === "P0001" && /paused/.test(error.message || "")) { scheduleSync(); continue; }   // v316 (the check round): paused: kept on the phone until Access is active again
        if (error && error.code === "P0001" && /no agreement/.test(error.message || "")) { refused = true; scheduleSync(); continue; }   // v316 (the check rounds): no agreement on record after all (an Agree refused on another page, set aside, or withdrawn since): kept, sent once the record can take it, gone once a withdrawal stands
        if (error && error.code === "P0001") { q.delete(k); scheduleSync(); continue; }   // refused for good: the server's value comes back with the next sync
        if (error) throw error;
        confirmedAt.set(key("clients", id), Date.now());            // a read that began before this landed must not bring the old value back
        if (tA && (Date.parse(tA) || 0) > (Date.parse(deliv.get(id + "\n" + k)) || 0)) { deliv.delete(id + "\n" + k); deliv.set(id + "\n" + k, tA); }   // delivered: noted by its typing time for every page (the newest last, so the 100 kept are the newest)
        if (JSON.stringify(profileGet(clients.get(id) || data, k)) === JSON.stringify(sent)) q.delete(k);   // changed again while this was out: it goes again
      }
      if (!q.size) pendingProfile.delete(id);
      persistPending(); if (heldOff) throw new Error("Failed to fetch (held for no signal)"); return;
    }
    if (kind !== "trainings") return;
    const live = () => trainings.get(id) || data;
    const rowOf = (t, rid) => ((t && t.rows) || []).find((x) => x.id === rid);
    const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
    const clean = (a) => (a || []).map((w) => String(w == null ? "" : w).slice(0, 16));
    const oldWay = (r) => { const tm = timedPlan(r.reps); if (!tm) return r.weights; const ws = [...(r.weights || [])], rs = r.repsDone || []; for (let j = 0; j < Math.max(ws.length, rs.length); j++) if (!String(ws[j] == null ? "" : ws[j]).trim() && String(rs[j] == null ? "" : rs[j]).trim()) ws[j] = String(rs[j]).trim() + " " + tm.unit; return ws; };   // the old rule carries weights only: a hold's seconds travel as "45 sec" and the coach's app moves them back into the time column
    const logOf = (r) => (r ? { w: clean(r.weights), rp: clean(r.repsDone), sd: clamp(parseInt(r.setsDone, 10) || 0, 0, 20), d: !!r.done } : null);
    const rows = pendingWeightRows.get(id), seqOf = new Map();
    if (rows) {                                                   // every row's next number first, one device write, then the requests: the server keeps the highest number it has applied and refuses an older one, so a request that timed out here and lands late cannot undo a newer result
      for (const rid of [...rows]) { const r = rowOf(data, rid), lr = rowOf(live(), rid); if (!r) continue; const seq = Math.max(parseInt(r.logSeq, 10) || 0, parseInt(lr && lr.logSeq, 10) || 0) + 1; r.logSeq = seq; if (lr) lr.logSeq = seq; seqOf.set(rid, seq); }
      if (seqOf.size) localBackend.save();
    }
    let behind = false;                                           // a request refused because the server already holds a higher number: the row stays queued and goes again from that number
    if (rows) for (const rid of [...rows]) {
      const r = rowOf(data, rid); if (!r) { rows.delete(rid); continue; }
      const sent = logOf(r), seq = seqOf.get(rid); let error = null, answer = null;
      if (!S.logSetMissing) {
        const args = { p_training: id, p_row: rid, p_weights: sent.w, p_reps: sent.rp, p_sets_done: sent.sd, p_done: sent.d, p_unit: r.unit === "kg" || r.unit === "lb" ? r.unit : null };   // the unit the set was logged in
        ({ data: answer, error } = await rpc("client_log_set", { ...args, p_seq: seq }));
        if (error && error.code === "PGRST202") ({ error } = await rpc("client_log_set", args));   // the rule from before the number: still fine
        if (error && error.code === "PGRST202") ({ error } = await rpc("client_log_set", { p_training: id, p_row: rid, p_weights: sent.w, p_reps: sent.rp, p_sets_done: sent.sd, p_done: sent.d }));   // the rule from before the unit: still fine
      }
      if (S.logSetMissing || (error && (error.code === "PGRST202" || /client_log_set/.test(error.message || "")))) {   // rule not installed yet: weights still get through the old way
        S.logSetMissing = true;
        ({ error } = await rpc("client_set_weights", { p_training: id, p_row: rid, p_weights: clean(oldWay(r)) }));
        if (!error) { const d = await rpc("client_set_done", { p_training: id, p_row: rid, p_done: !!r.done }); error = d.error; }   // a re-opened exercise lands as not done, the old way too
      }
      if (error && error.code === "P0001") { rows.delete(rid); scheduleSync(); continue; }
      if (error) throw error;
      const held = typeof answer === "number" ? answer : null;    // the rule answers with the row's number: ours when applied, a higher one when it refused
      if (held != null && held > seq) { const lr = rowOf(live(), rid); if (lr) lr.logSeq = Math.max(parseInt(lr.logSeq, 10) || 0, held); behind = true; continue; }   // not applied: this phone's latest values go again, numbered past the server's
      if (same(logOf(rowOf(live(), rid)), sent)) rows.delete(rid);
    }
    if (behind) scheduleSave("trainings", id, 0);                  // at once: the server has answered, there is nothing to wait for
    const swaps = pendingSwap.get(id);
    if (swaps && swaps.size) for (const [rid, name] of [...swaps.entries()]) {
      const { error } = await rpc("client_swap_exercise", { p_training: id, p_row: rid, p_name: name });
      if (error && error.code === "P0001") { swaps.delete(rid); scheduleSync(); continue; }   // the server said no (alternative or row gone): its version comes back on the next sync
      if (error) throw error;
      if (swaps.get(rid) === name) swaps.delete(rid);
    }
    if (pendingOrder.has(id) && !S.orderMissing) {                 // "Start this exercise": the numbers of the exercises, as the phone has them now (only the numbered rows; the warmup keeps its W)
      const labelsOf = (t) => Object.fromEntries(((t && t.rows) || []).filter((r) => /^\d+[a-z]?$/i.test(String(r.label || "").trim())).map((r) => [r.id, String(r.label).trim()]));
      const labels = labelsOf(data);
      const { error } = await rpc("client_order_rows", { p_training: id, p_labels: labels });
      if (error && (error.code === "PGRST202" || /client_order_rows/.test(error.message || ""))) S.orderMissing = true;   // rule not installed yet: the order stays on the phone until it is
      else { if (error && error.code !== "P0001") throw error; if (error || same(labelsOf(live()), labels)) pendingOrder.delete(id); }   // moved again while this was out: still queued, goes next
    }
    if (pendingFinish.has(id)) {
      const finished = !!data.completedAt, zone = finished && !S.zoneMissing ? zoneOf(data) : "";   // v315: the zone stamped with this very finish (one left from an earlier finish is never sent)
      let { error } = await rpc("client_finish_training", { p_training: id, p_finished: finished, p_at: finished ? data.completedAt || null : null, ...(zone ? { p_zone: zone } : {}) });   // finished at the time the phone says, not when the upload got through; v315: and in the time zone it was finished in
      if (error && error.code === "PGRST202" && zone) { S.zoneMissing = true; ({ error } = await rpc("client_finish_training", { p_training: id, p_finished: finished, p_at: finished ? data.completedAt || null : null })); }   // v315: the rule without the zone (client-finish.sql not run yet): the finish still lands, read on each device's own clock as before, and no later finish asks again until the next launch
      if (error && error.code === "PGRST202") ({ error } = await rpc("client_finish_training", { p_training: id, p_finished: finished }));   // the rule not updated yet: the old shape
      if (error && error.code !== "P0001") throw error;
      if (error || (!!live().completedAt === finished && (!finished || live().completedAt === data.completedAt))) pendingFinish.delete(id);   // Undo tapped while Finish was out, or finished again at a later time: still queued, goes next
    }
    if (pendingSkip.has(id)) {
      const skipped = !!data.skippedAt, reason = String(data.skipReason || "");
      let { error } = await rpc("client_skip_training", { p_training: id, p_skipped: skipped, p_reason: reason, p_at: skipped ? data.skippedAt || null : null });   // skipped at the time the phone says, as a finish (a skip made offline on Monday and uploaded on Wednesday is Monday's: her 24-hour Undo counts from it)
      if (error && error.code === "PGRST202") ({ error } = await rpc("client_skip_training", { p_training: id, p_skipped: skipped, p_reason: reason }));   // the rule without the time (not updated yet): the skip still lands, stamped when it arrives
      if (error && error.code === "PGRST202") ({ error } = await rpc("client_skip_training", { p_training: id, p_skipped: skipped }));   // the rule without the reason (not updated yet): the skip still lands
      if (error && error.code !== "P0001") throw error;
      const now = live(); if (error || (!!now.skippedAt === skipped && String(now.skipReason || "") === reason)) pendingSkip.delete(id);
    }
    if (pendingMove.has(id) && !S.moveMissing) {
      const out = moveOut.get(id);
      if (out) { if (!out.again) { out.again = true; out.back.then(() => scheduleSave("trainings", id, 0)); } }   // the move before this one timed out here but can still reach the server (the rule writes any day it is given): this one goes once that one is back, so the server takes the two in the order they were picked
      else {
        const date = String(data.date || "").slice(0, 10);
        if (winLost()) throw new Error("Failed to fetch: Fiala is in another window"); const call = Promise.resolve(S.sb.rpc("client_move_training", { p_training: id, p_date: date }));
        const entry = { again: false }; let stop = null;
        entry.back = new Promise((r) => { stop = setTimeout(r, 60000); call.then(r, r); }).then(() => { clearTimeout(stop); if (moveOut.get(id) === entry) moveOut.delete(id); });   // back with an answer or an error, or a minute gone (a request that old is taken as lost)
        moveOut.set(id, entry);
        const { error } = await withTimeout(call, saveDeadline());
        if (error && (error.code === "PGRST202" || /client_move_training/.test(error.message || ""))) S.moveMissing = true;   // rule not installed yet: stays on the device until it is
        else { if (error && error.code !== "P0001") throw error; if (error || String(live().date || "").slice(0, 10) === date) pendingMove.delete(id); }
      }
    }
    if (pendingMiss.has(id) && !S.missMissing) {
      const missed = data.missed === true;
      const { error } = await rpc("client_miss_training", { p_training: id, p_missed: missed });
      if (error && (error.code === "PGRST202" || /client_miss_training/.test(error.message || ""))) S.missMissing = true;
      else { if (error && error.code !== "P0001") throw error; if (error || (live().missed === true) === missed) pendingMiss.delete(id); }
    }
    const dones = pendingDoneRows.get(id);
    if (dones) for (const rid of [...dones]) {
      const r = rowOf(data, rid); if (!r) { dones.delete(rid); continue; }
      const d = !!r.done; const { error } = await rpc("client_set_done", { p_training: id, p_row: rid, p_done: d });
      if (error && error.code === "P0001") { dones.delete(rid); scheduleSync(); continue; }
      if (error) throw error;
      const lr = rowOf(live(), rid); if (!lr || !!lr.done === d) dones.delete(rid);
    }
    const notesQ = pendingNoteRows.get(id);
    if (notesQ && !S.noteMissing) for (const rid of [...notesQ]) {
      const r = rowOf(data, rid); if (!r) { notesQ.delete(rid); continue; }
      const note = String(r.clientNote || "").slice(0, 500); const { error } = await rpc("client_row_note", { p_training: id, p_row: rid, p_note: note || null });
      if (error && (error.code === "PGRST202" || /client_row_note/.test(error.message || ""))) { S.noteMissing = true; break; }   // rule not installed yet: kept for a later launch
      if (error && error.code === "P0001") { notesQ.delete(rid); scheduleSync(); continue; }
      if (error) throw error;
      const lr = rowOf(live(), rid); if (!lr || String(lr.clientNote || "").slice(0, 500) === note) notesQ.delete(rid);
    }
    const earlies = pendingEarlyRows.get(id);
    if (earlies && !S.earlyMissing) for (const rid of [...earlies]) {
      const r = rowOf(data, rid); if (!r) { earlies.delete(rid); continue; }
      const reason = String(r.earlyReason || "").slice(0, 40); const { error } = await rpc("client_finish_early", { p_training: id, p_row: rid, p_reason: reason || null });
      if (error && (error.code === "PGRST202" || /client_finish_early/.test(error.message || ""))) { S.earlyMissing = true; break; }   // rule not installed yet: the reasons wait on the device for a later launch, everything else still syncs
      if (error && error.code === "P0001") { earlies.delete(rid); scheduleSync(); continue; }
      if (error) throw error;
      const lr = rowOf(live(), rid); if (!lr || String(lr.earlyReason || "").slice(0, 40) === reason) earlies.delete(rid);
    }
    localBackend.save();
  },
  async del() {},
};
function syncDown() { if (S.syncing) return S.syncing; S.syncing = syncDownNow().finally(() => { S.syncing = null; }); return S.syncing; }
const carryOrder = (cur, rec) => { const mine = new Map((cur.rows || []).map((x) => [x.id, String(x.label || "").trim()])); for (const x of rec.rows || []) { const l = mine.get(x.id); if (l != null && /^\d+[a-z]?$/i.test(l) && l !== x.label) x.label = l; } };   // the phone's exercise numbers onto the server's rows, by row id
function mergeDown(map, kind, rows, complete, startedAt) {        // the server's answer into the local map, keeping what this device still has to send
  const seen = new Set(), viewedId = S.renderedTraining, viewed = trainings.get(viewedId), viewedClient = viewed ? viewed.clientId : null;   // (15 Nov 2026, the audit's #11) the workout on screen as this answer began: a sibling changed earlier in the answer must not lift the guard below
  const passOver = (r) => { if (kind !== "trainings") return; const rec = JSON.parse(JSON.stringify({ ...r.data, id: r.id })); repairTimed(rec); if (Array.isArray(rec.rows)) rec.rows.sort((a, b) => cmpLabel(a.label, b.label)); if (sameRec(map.get(r.id), rec)) heldBack.delete(r.id); else heldBack.add(r.id); return rec; };   // v316 (the seventeenth check round): a workout passed over while the server's copy differs from this page's is held back (heldBack): this page's copy of it is not the server's, however fresh the sync (a question left up over the coach's new empty workout while he filled it on the iPad: Back deleted it)
  for (const r of rows) {
    seen.add(r.id); if (dirty.has(key(kind, r.id))) { passOver(r); continue; }
    if (kind === "trainings" && map.has(r.id) && (pendingMove.has(r.id) || pendingMiss.has(r.id) || (pendingNoteRows.get(r.id) || new Set()).size || (pendingEarlyRows.get(r.id) || new Set()).size)) { passOver(r); continue; }   // the client's decision, note or reason still has to reach the server: keep ours (when there is an ours: a workout hidden and shown again is taken back)
    if ((confirmedAt.get(key(kind, r.id)) || 0) > startedAt) { if (kind === "trainings") heldBack.delete(r.id); continue; } if ((gaveUpAt.get(key(kind, r.id)) || 0) > startedAt) continue;   // written after this read began: keep ours (the server's, as of that write); v316 (the twenty-fourth check round): nor one this page gave up to another page after this read began (its answer, read before the other page's Delete landed, brought the template back)
    if (kind === "trainings" && S.templateDraft && S.templateDraft.dirty && S.templateDraft.id === r.id) { S.templateDraft.server = { of: S.templateDraft.snapshot, doc: JSON.stringify(passOver(r)) }; continue; }   // unsaved template edits; v316 (the twentieth check round): the server's copy kept beside them for Back up, with the snapshot it is newer than (a move or an exercise the iPad saved meanwhile was missing from the backup)
    if (kind === "trainings" && viewedId === r.id && (S.asking || ui.$("rows").contains(document.activeElement))) { passOver(r); continue; } // being edited right now, or a confirm sheet is up over it: next sync, stamp and all
    const rec = { ...r.data, id: r.id }, cur = map.get(r.id);
    if (kind === "clients" && cur && (pendingProfile.get(r.id) || new Set()).size) for (const k of pendingProfile.get(r.id)) profilePut(rec, k, profileGet(cur, k));   // the client's own profile fields still on their way ride on the server's copy (the coach's edits land, the client's stand)
    if (kind === "clients" && (pendingChoices.get(r.id) || new Map()).size) for (const [k, a] of pendingChoices.get(r.id)) applyChoice(rec, k, a.answer, a.parent, a.at, [today(), laToday()], a.by, a.id);   // v316: the client's answers still on their way ride on the server's copy
    if (kind === "trainings") { repairTimed(rec); if (cur && pendingOrder.has(r.id)) carryOrder(cur, rec); if (Array.isArray(rec.rows)) rec.rows.sort((a, b) => cmpLabel(a.label, b.label)); }   // her new order still on its way rides on the server's copy (his edits land, her numbers stand); rows in the order the cards show, so a copy that changed nothing reads as the same
    if (!(cur && sameRec(cur, rec))) { if (kind === "trainings" && cur && ui.relabeled) ui.relabeled(r.id, cur, rec, true); else if (kind === "trainings" && !cur && ui.forgetCards) ui.forgetCards(r.id); map.set(r.id, rec); if (kind === "trainings" && viewedClient && rec.clientId === viewedClient && r.id !== viewedId) S.histVer++; }   // the same record stays the same object (the cards on screen hold it); another workout of the viewed client changed: its last/best lines are read again (by S.histVer, never by forgetting which workout is on screen: that let a sync rebuild the cards under a typing finger, the audit's #11)
    if (!S.clientMode && r.updated_at) { seenAt.set(key(kind, r.id), r.updated_at); seenDoc.set(key(kind, r.id), JSON.stringify(r.data)); }   // the stamp, and the copy it describes, travel with the record
    if (kind === "trainings") { trainerState.delete(r.id); heldBack.delete(r.id); const d = S.templateDraft; if (d && d.id === r.id && !d.dirty && map.get(r.id)) d.snapshot = JSON.stringify(map.get(r.id)); }   // v316 (the twenty-first check round): a template open with nothing typed: what Discard goes back to (and Back up and the device copy write) follows the copy the sync took (it stayed as the page was first drawn: Discard, then Save, wrote that older copy over the iPad's move and exercise)
  }
  if (complete) for (const id of [...map.keys()]) if (!seen.has(id) && !dirty.has(key(kind, id)) && !((confirmedAt.get(key(kind, id)) || 0) > startedAt) && !((gaveUpAt.get(key(kind, id)) || 0) > startedAt)) { map.delete(id); seenAt.delete(key(kind, id)); seenDoc.delete(key(kind, id)); if (kind === "trainings") { heldBack.delete(id); dropDraft(id); } }   // only a full answer can say something is gone, and not about a record written after this read began
}
async function syncDownNow() {
  if (winLost() || !S.sb || !S.signedIn || !S.backend || S.seeding) return false;
  const startedAt = Date.now(), startedPerf = performance.now(), as = S.sessionEmail, left = () => !S.signedIn || S.sessionEmail !== as;   // v316 (the check rounds): a sign-out (or another account) while this read was out: its answer lands nowhere
  const sess = await withTimeout(S.sb.auth.getSession(), 8000).catch(() => null); if (left()) return false;   // no usable token (refresh failed, cooldown, or a refresh that never answers): don't sync as a stranger
  if (!(sess && sess.data && sess.data.session)) { S.offline = true; ui.setStatus(); return false; }
  await Promise.all([ui.loadCustomVideos(), ui.loadHidden(), ui.loadCustomNames(), ui.loadCustomSubs()].map((p) => withTimeout(p.catch(() => {}), S.catalogWait || 8000))); if (left()) return false;   // each catalog gets a deadline: one that never answers cannot hold the workouts back (its data still lands when it does)   // the exercise list and page paint from loaded names, videos and subtitles
  let c, t;
  if (S.clientMode) {
    const res = await withTimeout(S.sb.rpc("client_my_data"), 8000); if (left()) return false;
    if (res.error) {
      if (isOffline(res.error)) {
        if (ui.offlineFromMirror()) return false;               // no signal: the last synced copy stands in
        ui.showProblem("Couldn\u2019t load your workouts \u00b7 check your signal and tap Try again"); return false;
      }
      if (S.myClientId) { ui.$("status").textContent = "Couldn\u2019t sync \u00b7 " + (res.error.message || "server error"); return false; }   // the workouts are on the screen already: a failed refresh is a line in the header, not a page
      ui.showProblem("Couldn\u2019t load your workouts \u00b7 " + (res.error.message || "server error") + " \u00b7 tap Try again"); return false;
    }
    c = { data: res.data.clients || [] }; t = { data: res.data.trainings || [] };
    const me = c.data[0]; { const was = (me && me.data && me.data.unit) || "lb"; for (const r of t.data) if (r && r.data) stampUnit(r.data, was); }   // v299: each answer read in its own unit: an exercise logged with no unit of its own was logged in the unit the client's record had when this was read (the client's rule stamps them so before the client's unit changes), so a read from before the client's switch never shows lb as kg, and a copy that did not change compares the same (no redraw under the client's finger: the v299 review's catches)
    if (me && !S.zoneSetMissing && document.visibilityState === "visible" && zoneState(me.data) === "allow" && !(me.data && me.data.paused) && !(pendingChoices.get(me.id) || new Map()).has("zone")) {   // only from a page on screen (the policy: "while the app is open on your screen"; a hidden tab syncs when the network comes back: the check round)   // v316: only once the server holds the client's Allow (client_set_zone refuses otherwise)   // v315: the phone's time zone, for the line under the client's name on the coach's page: sent when it changed, or every 30 minutes so the coach can tell how fresh it is
      const here = hereZone(), z = me.data && me.data.zone, mine = zoneSent.get(me.id), age = z ? Date.now() - Date.parse(z.at) : NaN;   // v316 (the check rounds): the 30 minutes run on this phone's own clock, from its own last send; the server's stamp only until then, and never one in this phone's future (a clock set by hand)
      const fresh = !!z && z.zone === here && (mine && mine.zone === here ? Date.now() - mine.t >= 0 && Date.now() - mine.t < 30 * 60e3 : age >= -60e3 && age < 30 * 60e3);
      if (here && !fresh && me.id) { const t0 = Date.now(); rpc("client_set_zone", { p_client: me.id, p_zone: here }).then((res) => { const error = res && res.error; if (!error) zoneSent.set(me.id, { zone: here, t: t0 }); if (error && (error.code === "PGRST202" || /client_set_zone/.test(error.message || ""))) S.zoneSetMissing = true; }).catch(() => {}); }   // client-zone.sql not run yet: asked no more until a reload; offline: next sync
    }
    const authoritative = !!me && !(me.data && me.data.paused) && planActive(me.data && me.data.plan, today()) && planActive(me.data && me.data.plan, laToday());   // paused, or a monthly plan past its day: the server hides the workouts, it has not deleted them, so nothing queued is dropped
    if (authoritative) {                                                   // a training the trainer deleted: nothing queued for it can land
      const serverIds = new Set(t.data.map((r) => r.id));
      for (const k of [...dirty.keys()]) { const [kind, id] = k.split("/"); if (kind === "trainings" && !serverIds.has(id)) { dirty.delete(k); pendingWeightRows.delete(id); pendingDoneRows.delete(id); pendingEarlyRows.delete(id); pendingNoteRows.delete(id); pendingFinish.delete(id); pendingSkip.delete(id); pendingMove.delete(id); pendingMiss.delete(id); pendingSwap.delete(id); pendingOrder.delete(id); } }
      persistPending();
    }
  } else {
    [c, t] = await Promise.all([fetchAll("ft_clients"), fetchAll("ft_trainings")]); if (left()) return false;
    if (c.error || t.error) {
      const err = c.error || t.error;
      if (/ft_clients|ft_trainings|relation/i.test(err.message)) { ui.$("status").textContent = "Run supabase/cloud.sql first"; return false; }
      if (isOffline(err)) { S.offline = true; ui.setStatus(); } else { ui.$("status").textContent = "Couldn\u2019t sync \u00b7 " + (err.message || "server error"); }
      return false;                                           // the device copy stays on screen
    }
    for (const id of [...trainerTouched.keys()]) if (!dirty.has(key("trainings", id))) trainerTouched.delete(id);
    for (const id of [...trainerNamed.keys()]) if (!dirty.has(key("trainings", id))) trainerNamed.delete(id);
    for (const id of [...trainerNoted.keys()]) if (!dirty.has(key("trainings", id))) trainerNoted.delete(id);
    for (const id of [...planTouched]) if (!dirty.has(key("clients", id))) planTouched.delete(id);
    for (const id of [...profileTouched.keys()]) if (!dirty.has(key("clients", id))) profileTouched.delete(id);
    for (const [n, cid] of [...folderTouched]) if (!dirty.has(key("clients", cid))) folderTouched.delete(n);
  }
  const migrated = lsGet("fiala.trainings.migrated");
  if (!S.clientMode && !migrated && c.data.length === 0 && t.data.length === 0 && (clients.size || trainings.size)) {
    for (const id of clients.keys()) scheduleSave("clients", id, 0);
    for (const id of trainings.keys()) scheduleSave("trainings", id, 0);
  } else {
    if (S.clientMode) for (const r of c.data) { const q = pendingProfile.get(r.id); if (!q || !q.size) continue; const ch = (r.data && r.data.choices) || {}, own = new Set(settledAnswers.keys()); for (const a of (pendingChoices.get(r.id) || new Map()).values()) { if (a && a.id) own.add(a.id); if (a && a.before && a.before.id) own.add(a.before.id); } let w = 0; for (const e of Array.isArray(ch.log) ? ch.log : []) if (e && e.kind === "health" && !e.stale && (e.answer === "decline" || e.answer === "paper-off") && !(e.id && own.has(e.id))) w = Math.max(w, Date.parse(e.at) || 0);   /* a withdrawal made elsewhere (another device, the coach, the form turned off): this phone's own answers are handled where they are given */ if (!w) continue; const cur = clients.get(r.id), um = profileUnder.get(r.id) || new Map(), base = Date.parse(cur && cur.choices && cur.choices.health && cur.choices.health.at) || 0; let gone = false; const lg = Array.isArray(ch.log) ? ch.log : [], pend = new Set([...(pendingChoices.get(r.id) || new Map()).values()].flatMap((a) => [a && a.id, a && a.before && a.before.id]).filter(Boolean)), tOf = (u0) => { const [ua, ui] = String(u0 || "").split("|"); if (!ui) return Date.parse(ua) || base; const e = lg.find((x) => x && x.id === ui); return e ? Date.parse(e.at) || 0 : pend.has(ui) ? Infinity : Date.parse(ua) || base; };   /* a detail typed under this phone's own answer is timed by that answer's server time in the log (a phone clock set wrong never decides); while the answer has not landed it waits */ for (const f of [...q]) if (f !== "unit" && w > tOf(um.get(f))) { q.delete(f); um.delete(f); if (cur) profilePut(cur, f, profileGet(r.data, f)); gone = true; } if (gone) { if (!q.size) pendingProfile.delete(r.id); if (!(pendingChoices.get(r.id) || new Map()).size && !pendingProfile.has(r.id)) dirty.delete(key("clients", r.id)); persistPending(); } }   // v316 (the check rounds): a detail waiting on the phone, typed under an agreement withdrawn since on another device or by the coach, goes, as a Don't Allow's details do (it would otherwise go under a later Agree or paper form)
    mergeDown(clients, "clients", c.data, c.complete !== false, startedAt); mergeDown(trainings, "trainings", t.data, t.complete !== false, startedAt);
    if (S.clientMode && c.data.length) {                          // the client's own profile queue (v299): a record the server no longer sends the client can take nothing
      const mine = new Set(c.data.map((r) => r.id)); for (const id of [...pendingProfile.keys()]) if (!mine.has(id)) pendingProfile.delete(id); for (const id of [...pendingChoices.keys()]) if (!mine.has(id)) pendingChoices.delete(id); for (const id of [...heldAgree.keys()]) if (!mine.has(id)) heldAgree.delete(id);
      for (const [id, h] of [...heldAgree]) if (!markLive(clients.get(id), h)) heldAgree.delete(id);   // v316 (the check rounds): a newer health answer on record (a Don't Allow, a parent's Disagree, the coach's withdrawal or paper form) ends the parent's wait, details parked or not
      for (const [id, q] of pendingProfile) {                      // v316 (the check round): health details parked on the phone (a parent awaited, an Agree set aside): sent as soon as the record can take them; gone when a withdrawal stands (the details typed before it go too, as a Don't Allow's do)
        const rec = clients.get(id), st = rec && rec.choices && rec.choices.health && rec.choices.health.state, days = [today(), laToday()], waits = (pendingChoices.get(id) || new Map()).has("health");
        if (!rec || waits || !q.size || rec.paused) continue;          // paused: they wait for Access to come back
        const hk = [...q].filter((f) => f !== "unit"); if (q.has("unit")) scheduleSave("clients", id);   // Weights in always goes
        if (!hk.length) continue;
        if (hk.some((f) => (f === "birthday" ? birthdayOpen(rec, days) : healthEditable(rec, days)))) { if (healthEditable(rec, days)) heldAgree.delete(id); scheduleSave("clients", id); continue; }   // the record can take them now (a parent agreed, a paper form recorded): they go
        if ((st === "declined" || st === "off") && !heldAgree.has(id)) { for (const f of hk) q.delete(f); persistPending(); }   // a withdrawal stands and no parent is to be asked: they go from the phone too
      }
    }
  }
  lsSet("fiala.trainings.migrated", true); S.syncedOnce = true; S.syncedOn = today(); S.syncedAt = startedAt; S.syncedPerf = startedPerf;   // v316 (the seventeenth check round): as old as its read (an answer read before the Mac slept, landing as it woke three hours later, made a three-hour-old copy fresh)
  localBackend.save();
  if (S.clientMode) {
    S.myClientId = clients.size ? [...clients.keys()][0] : null;
    if (!S.myClientId) { ui.showWaiting(); return; }
    if (S.view.name === "clients" || (S.view.name === "client" && S.view.id !== S.myClientId)) S.view = { name: "client", id: S.myClientId };
  }
  S.offline = false;
  ui.render(); ui.setStatus();
  if (ui.photosSynced) ui.photosSynced();                           // a photo taken without signal goes up now
  for (const k of dirty.keys()) if (!timers.has(k)) { const [kind, id] = k.split("/"); flushOne(kind, id); }
  if (!S.clientMode && ui.seedTemplates) ui.seedTemplates().catch(() => {});   // the built-in templates, once the server's copy is in (a first sync that failed gets its turn later)
  return true;
}
function scheduleSync() { clearTimeout(S.syncTimer); if (winLost()) return; S.syncTimer = setTimeout(() => { (S.offline ? ui.resumeOnline() : syncDown()).catch(() => {}); }, 300); }
const shownAgain = () => { if (winLost()) return; try { if (localStorage.getItem(TAB_KEY) !== TAB && adoptQueue(lsGet("fiala.pending.v1"))) persistPending(); } catch (_) {} };   // v316 (the check rounds): a page back from the back/forward cache (Back from a policy page) or a frozen tab heard none of the other page's writes meanwhile: taken on before any edit
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") { shownAgain(); scheduleSync(); } });
window.addEventListener("pageshow", (e) => { if (e && e.persisted) shownAgain(); });
window.addEventListener("focus", scheduleSync);
const onStorage = (e) => { if (winLost()) return; if (e && e.key === "fiala.trainings.draft") { const d = S.templateDraft; if (!d || !d.taken || !d.dirty) return; const nv = lsGet("fiala.trainings.draft"); if (nv && nv.id === d.id && nv.doc && typeof nv.doc === "object") adoptDoc(d.id, nv.doc); else { if (trainings.has(d.id)) adoptDoc(d.id, JSON.parse(d.snapshot)); d.dirty = false; d.taken = false; S.pendingGo = null; if (ui.paintDraftBar) ui.paintDraftBar(); scheduleSync(); } S.renderedTraining = null; if (ui.render) ui.render(); return; }   /* v316 (the twenty-second check round): a template's draft this page only took at its launch from another page (never typed in here) follows that page, read as it is now: typed on there, and gone with its Save or Discard there (a second window kept it, and its Save wrote the older typing over the template saved there) */ if (e && e.key === SIDE && e.newValue) { try { const sx = lsGet(SIDE); if (sx && sx.tab !== TAB && adoptQueue({ wd: sx.wd, choices: sx.choices, settled: sx.settled, held: sx.held, owner: sx.owner, tab: sx.tab })) persistPending(); } catch (_) {} return; } if (!e || e.key !== "fiala.pending.v1" || !e.newValue) return; try { if (adoptQueue(lsGet("fiala.pending.v1"))) persistPending(); } catch (_) {} };
window.addEventListener("storage", onStorage);   // another page of the app saved its queue: taken on here at once (the audit's #19); v316 (the seventeenth check round): read as it is now, never the event's own copy (a tab Chrome froze gets every event it missed as it wakes, each with the queue as it was then: it took an old empty copy of a workout filled since, and wrote it back)
window.addEventListener("online", () => { S.failed = false; if (S.offline && S.signedIn) { ui.resumeOnline().catch(() => {}); return; } for (const k of dirty.keys()) { const [kind, id] = k.split("/"); flushOne(kind, id); } scheduleSync(); });
setInterval(() => { if (document.visibilityState === "visible") scheduleSync(); }, 60000);
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden" && idbTimer) localBackend.flushDb(); });   // leaving the app: the copy waiting to be written goes now
window.addEventListener("pagehide", () => { if (idbTimer) localBackend.flushDb(); });
// a request that gets no answer within `ms` counts as a network failure (a phone with one bar can hang for a long time)
async function fetchAll(table) {                                 // every row, page by page: the server answers at most 1,000 at a time
  const PAGE = 1000, out = []; let after = null;
  for (;;) {
    let q = S.sb.from(table).select("id,data,updated_at").order("id").limit(PAGE); if (after) q = q.gt("id", after);   // keyed on id, so a row deleted meanwhile shifts nothing
    const res = await withTimeout(q, 12000);
    if (res.error) return { data: out, error: res.error, complete: false };
    out.push(...(res.data || []));
    if (!res.data || res.data.length < PAGE) return { data: out, error: null, complete: true };
    after = res.data[res.data.length - 1].id;
  }
}

export { sameRec, onStorage, forgetDraft, seedBases, gaveUpAt, deleteRec, shownAgain, ownTyped, adoptQueue, dropMarks, coachSetPaper, coachWithdraw, seenDoc, moveOut, takenFrom, isNetwork, isOffline, reasonOf, key, markDirty, persistPending, restorePending, queueFresh, scheduleSave, flushAll, flushOne, localBackend, touchState, TABLE, cloudBackend, clientBackend, syncDown, mergeDown, syncDownNow, scheduleSync, withTimeout, fetchAll };
