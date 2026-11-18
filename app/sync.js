// Saving and syncing: the device copy, the debounced save queue, the cloud backend (coach), the client backend (RPCs),
// the paged read of the server and the merge back into the local maps. Screens are reached only through `ui`.
import { lsGet, lsSet, norm, clamp, today, uid, laToday } from "./util.js";
import { isTemplateClient, planActive, repairTimed, timedPlan, cmpLabel, groupKey, stampUnit, profileGet, profilePut, setsOf, loggedSets, zoneOf, hereZone } from "./model.js";
import { mergeNotes } from "./notes.js";
import { ALIASES } from "./catalog.js";
import { S, ui, clients, trainings, dirty, timers, chains, pendingWeightRows, pendingDoneRows, pendingEarlyRows, pendingFinish, pendingSkip, trainerState, pendingMove, pendingMiss, pendingSwap, pendingOrder, seenAt, trainerTouched, trainerNamed, trainerNoted, planTouched, confirmedAt, deletedNotes, deletedPackages, folderTouched, deletedFolders, fromFile, pendingNoteRows, pendingProfile, profileTouched } from "./state.js";

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
const seenDoc = new Map();                                        // "kind/id" -> the server copy the stamp belongs to: the base a two-device merge measures changes against
function markDirty(kind, id) { const k = key(kind, id); dirty.set(k, (dirty.get(k) || 0) + 1); }
const recMap = (k) => { const kind = String(k).slice(0, String(k).indexOf("/")); return kind === "clients" ? clients : kind === "trainings" ? trainings : null; };
const recOf = (k) => { const m = recMap(k), id = String(k).slice(String(k).indexOf("/") + 1), d = S.templateDraft; if (!m) return null; if (m === trainings && d && d.dirty && d.snapshot && d.id === id) return JSON.parse(d.snapshot); return m.get(id) || null; };   // a record still to send, as it stands now (a template's open draft as last saved, as the device copy keeps it)
const trimEnd = (a) => { if (!Array.isArray(a)) return a; let n = a.length; while (n && (a[n - 1] == null || a[n - 1] === "")) n--; return n === a.length ? a : a.slice(0, n); };
const normRow = (x) => (x && typeof x === "object" ? { ...x, weights: trimEnd(x.weights), repsDone: trimEnd(x.repsDone), ...(typeof x.name === "string" && ALIASES[x.name] ? { name: ALIASES[x.name] } : {}) } : x);   // what a row says, not how this device holds it: the boxes drawn add empty sets at the end, and a client's phone shows an old name by its new one
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
const TAB = uid(), TAB_KEY = "fiala.pending.tab";                   // (15 Nov 2026, the audit's #19) this page's own name, and the device's note of which page wrote the queue last
function adoptQueue(p) {                                           // another page of the app (a second tab, Safari beside the Dock app) wrote the queue: what it still has to send that this page knows nothing of is taken on here, record, queues and the coach's marks with it, so neither page's write ever drops the other's (a tab iOS discards before it sends loses nothing)
  if (!p || typeof p !== "object" || p.tab === TAB) return false;
  const me = S.sessionEmail || S.pendingOwner || ""; if (p.owner && me && p.owner !== me) return false;   // another account's: never taken on
  const recs = new Map((p.recs || []).filter((e) => Array.isArray(e) && typeof e[0] === "string" && e[1] && typeof e[1] === "object")), gone = new Set(p.gone || []), took = new Set();
  for (const k of p.dirty || []) {
    if (typeof k !== "string" || dirty.has(k)) continue;           // this page's own edit of it stands
    const m = recMap(k), id = k.slice(k.indexOf("/") + 1); if (!m || (S.templateDraft && S.templateDraft.id === id)) continue;
    if (recs.has(k)) { const d = recs.get(k); if (m === trainings) repairTimed(d); m.set(id, d); } else if (gone.has(k)) m.delete(id); else continue;   // a queue from before v303 holds no record: that page sends its own
    dirty.set(k, 1); took.add(k);
  }
  if (!took.size) return false;
  const tid = (id) => took.has("trainings/" + id), cid = (id) => took.has("clients/" + id);
  const sets = (list, map, ok) => { for (const [id, xs] of list || []) if (ok(id) && Array.isArray(xs)) map.set(id, new Set([...(map.get(id) || []), ...xs])); };
  sets(p.weights, pendingWeightRows, tid); sets(p.done, pendingDoneRows, tid); sets(p.early, pendingEarlyRows, tid); sets(p.rownotes, pendingNoteRows, tid);
  sets(p.touched, trainerTouched, tid); sets(p.named, trainerNamed, tid); sets(p.noted, trainerNoted, tid); sets(p.state, trainerState, tid);
  sets(p.profile, pendingProfile, cid); sets(p.profTouched, profileTouched, cid);
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
function persistPending() {
  try { if (localStorage.getItem(TAB_KEY) !== TAB) adoptQueue(lsGet("fiala.pending.v1")); } catch (_) {}   // the last write was another page's (or an earlier launch's): what it holds is taken on before this one writes over it
  lsSet("fiala.pending.v1", { dirty: [...dirty.keys()], weights: [...pendingWeightRows].map(([id, r]) => [id, [...r]]), done: [...pendingDoneRows].map(([id, r]) => [id, [...r]]), early: [...pendingEarlyRows].filter(([, r]) => r.size).map(([id, r]) => [id, [...r]]), rownotes: [...pendingNoteRows].filter(([, r]) => r.size).map(([id, r]) => [id, [...r]]), profile: [...pendingProfile].filter(([, f]) => f.size).map(([id, f]) => [id, [...f]]),
    finish: [...pendingFinish], skip: [...pendingSkip], move: [...pendingMove], miss: [...pendingMiss], swap: [...pendingSwap].map(([id, m]) => [id, [...m]]), order: [...pendingOrder],
    touched: [...trainerTouched].map(([id, r]) => [id, [...r]]), named: [...trainerNamed].map(([id, r]) => [id, [...r]]), noted: [...trainerNoted].map(([id, r]) => [id, [...r]]), state: [...trainerState].map(([id, f]) => [id, [...f]]),
    plans: [...planTouched], profTouched: [...profileTouched].filter(([, f]) => f.size).map(([id, f]) => [id, [...f]]), notesGone: [...deletedNotes], packagesGone: [...deletedPackages], foldersGone: [...deletedFolders], foldersTouched: [...folderTouched], fromFile: [...fromFile],   // the coach's intent about a client record: a plan changed, a note or package removed, a backup restored
    stamps: [...dirty.keys()].map((k) => [k, seenAt.get(k) || null]), docs: [...dirty.keys()].filter((k) => seenDoc.has(k)).map((k) => [k, seenDoc.get(k)]),   // the stamp and the copy it describes: a save sent after a relaunch still merges against what this device last read
    recs: [...dirty.keys()].map((k) => [k, recOf(k)]).filter(([, d]) => d), gone: [...dirty.keys()].filter((k) => recMap(k) && !recOf(k)),   // (15 Nov 2026, the audit's #1) each record still to send as it is now, and each one deleted here: a device copy that stopped saving (a full device) can never send an older copy over the server's, nor make a record it lost look deleted
    owner: S.sessionEmail || S.pendingOwner || "", tab: TAB });
  try { localStorage.setItem(TAB_KEY, TAB); } catch (_) {}
  if (S.sessionEmail) S.pendingOwner = S.sessionEmail;
}
function restorePending() {
  const p = lsGet("fiala.pending.v1"); if (!p || typeof p !== "object") return;
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
  for (const id of new Set([...pendingMove, ...pendingMiss, ...pendingOrder, ...[...pendingNoteRows].filter(([, r]) => r.size).map(([id]) => id), ...[...pendingEarlyRows].filter(([, r]) => r.size).map(([id]) => id)])) markDirty("trainings", id);   // sent again on this launch (the rule may have been missing last time)
  { const recs = new Map((p.recs || []).filter((e) => Array.isArray(e) && typeof e[0] === "string" && e[1] && typeof e[1] === "object")), gone = new Set(p.gone || []);   // (15 Nov 2026, the audit's #1) the records the queue holds win over the device copy, which may have stopped saving before them (a full device); a queued record the device lost and never deleted here is the server's again: nothing is deleted there for it
    for (const k of [...dirty.keys()]) { const m = recMap(k), id = k.slice(k.indexOf("/") + 1); if (!m || (S.templateDraft && S.templateDraft.id === id)) continue; if (recs.has(k)) { const d = recs.get(k); if (m === trainings) repairTimed(d); m.set(id, d); } else if (gone.has(k)) m.delete(id); else if (!m.has(id)) dirty.delete(k); } }
  for (const [id, picks] of p.swap || []) pendingSwap.set(id, new Map([...(pendingSwap.get(id) || []), ...picks]));
  for (const [id, rows] of p.touched || []) trainerTouched.set(id, new Set([...(trainerTouched.get(id) || []), ...rows]));
  for (const [id, fields] of p.state || []) trainerState.set(id, new Set([...(trainerState.get(id) || []), ...fields]));
  for (const [id, rows] of p.named || []) trainerNamed.set(id, new Set([...(trainerNamed.get(id) || []), ...rows]));
  for (const [id, rows] of p.noted || []) trainerNoted.set(id, new Set([...(trainerNoted.get(id) || []), ...rows]));
  for (const [k, stamp] of p.stamps || []) if (stamp && !seenAt.has(k)) seenAt.set(k, stamp);
  for (const [k, doc] of p.docs || []) if (doc && !seenDoc.has(k)) seenDoc.set(k, doc);
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
  if (kind === "trainings" && S.templateDraft && S.templateDraft.id === id && !S.templateDraft.saving) { S.templateDraft.dirty = true; lsSet("fiala.trainings.draft", { id, doc: trainings.get(id) }); persistPending(); ui.paintDraftBar(); return; }   // the draft lives on its own: a relaunch brings it back unsaved
  markDirty(kind, id); persistPending();
  const k = key(kind, id);
  clearTimeout(timers.get(k));
  timers.set(k, setTimeout(() => flushOne(kind, id), delay));
  ui.setStatus();
}

const dropIntent = (id) => { planTouched.delete(id); profileTouched.delete(id); for (const [n, cid] of [...deletedNotes]) if (cid === id) deletedNotes.delete(n); for (const [pk, cid] of [...deletedPackages]) if (cid === id) deletedPackages.delete(pk); for (const [n, cid] of [...deletedFolders]) if (cid === id) deletedFolders.delete(n); for (const [n, cid] of [...folderTouched]) if (cid === id) folderTouched.delete(n); };   // the save that carried them is on the server: the markers have done their work
const dropMarks = (kind, id) => { if (kind === "trainings") { trainerState.delete(id); trainerTouched.delete(id); trainerNamed.delete(id); trainerNoted.delete(id); } if (kind === "clients") dropIntent(id); };   // the coach's marks on a record (a workout's state, rows, names and notes; a client's plan, profile and deletion intents): gone once a save carried them, or once a restore replaced the copy they were made on (v315)
function flushAll() { for (const k of [...timers.keys()]) { const [kind, id] = k.split("/"); clearTimeout(timers.get(k)); flushOne(kind, id); } }
function flushOne(kind, id) {
  const k = key(kind, id);
  timers.delete(k);
  localBackend.save();
  const map = kind === "clients" ? clients : trainings;
  const prev = chains.get(k) || Promise.resolve();
  S.inflight++; ui.setStatus();
  const run = prev.then(async () => {
    if (!S.backend || !dirty.has(k)) return;                    // already confirmed by an earlier run in this chain
    const doc = map.get(id);
    const version = dirty.get(k) || 0;
    const data = doc ? JSON.parse(JSON.stringify(doc)) : null;   // taken now, after any merge the previous run did
    let attempt = 0;
    if (S.backend !== localBackend && !S.sb) { S.offline = true; return; }   // the cloud library never loaded (a first open with the network blocked): keep it queued, the next open with signal sends it
    if (S.backend !== localBackend && S.sb) {
      const sess = await withTimeout(S.sb.auth.getSession(), saveDeadline()).catch(() => null);   // a token refresh that never answers is no token
      if (!(sess && sess.data && sess.data.session)) { S.offline = true; return; }   // token not usable right now: keep it queued
    }
    for (;;) {
      try {
        if (data) await S.backend.set(kind, id, data, version); else await S.backend.del(kind, id);
        S.failed = false;
        if (fromFile.has(k) && version >= fromFile.get(k)) fromFile.delete(k);   // the write that carried the backup's copy landed: every later save merges as usual, even one queued meanwhile
        if (dirty.get(k) === version) { dirty.delete(k); dropMarks(kind, id); }   // the coach's state changes went with this save; a later touch keeps its flag
        confirmedAt.set(k, Date.now());
        return;
      } catch (e) {
        attempt++;
        S.failReason = reasonOf(e);
        if (isOffline(e)) { S.offline = true; return; }           // no signal: keep it queued, no red status
        if (e && e.fatal) { S.failed = true; if (fromFile.has(k) && version >= fromFile.get(k)) fromFile.delete(k); if (dirty.get(k) === version) dirty.delete(k); return; }   // the server said no for good: don't carry it forever
        if (attempt > 3) { S.failed = true; return; }
        await new Promise((r) => setTimeout(r, 700 * attempt + Math.random() * 400));
      }
    }
  }).finally(() => { S.inflight--; persistPending(); ui.setStatus(); });
  chains.set(k, run.catch(() => {}));
  return run;
}
// ---------- the device copy in the browser's database (v306, the audit's #1: localStorage holds about 2.6 million characters once a copy holds a "–" or a curly quote, and a coach's copy outgrew it in months) ----------
const COPY = "fiala.trainings.v1", IDB_NAME = "fiala", IDB_STORE = "kv";
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
const copyOf = () => { const ts = Object.fromEntries(trainings), d = S.templateDraft; if (d && d.dirty && d.snapshot && ts[d.id]) ts[d.id] = JSON.parse(d.snapshot); return { clients: Object.fromEntries(clients), trainings: ts, savedAt: Date.now() }; };   // the device copy holds the template as saved, never the draft
const takeCopy = (d) => { if (!d || typeof d !== "object" || !d.clients || !d.trainings || typeof d.clients !== "object" || typeof d.trainings !== "object") return false; for (const c of Object.values(d.clients)) if (c && c.id) clients.set(c.id, c); for (const t of Object.values(d.trainings)) if (t && t.id) { repairTimed(t); trainings.set(t.id, t); } return true; };   // a copy of the wrong shape (damaged) is passed over: the app starts empty and the queue and the server fill it, never a blank app at every launch (the audit's #20)
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
    if (idbDb) { clearTimeout(idbTimer); idbTimer = setTimeout(() => localBackend.flushDb(), 120); return; }   // the database: one write for a burst of saves (a sync, a restore)
    const ok = lsSet(COPY, copyOf()); S.deviceFull = !ok;
  },
  flushDb() { clearTimeout(idbTimer); idbTimer = 0; if (!idbDb) return Promise.resolve(false); return idbTx("readwrite", (st) => st.put(copyOf(), COPY)).then((ok) => { const was = S.deviceFull; S.deviceFull = !ok; if (was !== S.deviceFull && ui.setStatus) ui.setStatus(); return ok; }); },
  async wipe() { clearTimeout(idbTimer); idbTimer = 0; if (idbDb) { try { localStorage.removeItem(COPY); } catch (_) {} await idbTx("readwrite", (st) => st.delete(COPY)); } else lsSet(COPY, { clients: {}, trainings: {} }); },   // a sign-out: nothing of the account stays on the device
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
  const nums = cards.filter((c) => /^\d+$/.test(c.key)), taken = new Set(), free = [];
  for (const c of nums) {
    const n = c.rows.some(begun) ? (srv.has(c.rows[0].id) ? settleNum(srv.get(c.rows[0].id).label) : Number(c.key)) : null;
    if (n == null || taken.has(n)) { free.push(c); continue; }   // (two begun cards on one server number cannot be: the later is placed as one not begun)
    taken.add(n); c.to = n;
    c.rows.forEach((r, j) => { const s = srv.get(r.id); r.label = s && settleNum(s.label) === n ? s.label : String(n) + (c.rows.length > 1 ? letter(j) : ""); });
  }
  for (const r of (target.rows || []).filter((x) => x && incoming.has(x.id) && begun(x))) { const n = settleNum(r.label); if (n != null && !taken.has(n)) taken.add(n); }   // a row come in from the server and begun there keeps its number too: none of his cards takes it (the final check)
  const pool = [...new Set([...nums.map((c) => Number(c.key)), ...taken])].filter((n) => !taken.has(n)).sort((a, b) => a - b);
  let top = Math.max(0, ...nums.map((c) => Number(c.key)), ...taken);
  for (const c of free) { c.to = pool.length ? pool.shift() : ++top; c.rows.forEach((r, j) => { r.label = String(c.to) + (c.rows.length > 1 ? letter(j) : ""); }); }   // (free keeps his order: nums is sorted by his labels)
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
const rpc = (name, args) => withTimeout(S.sb.rpc(name, args), saveDeadline());

const cloudBackend = {
  async set(kind, id, data, version) {
    const k = key(kind, id);
    const row = { id, data };
    if (kind === "trainings") row.client_id = data.clientId;
    let base = seenDoc.get(k) ? JSON.parse(seenDoc.get(k)) : null; const map = kind === "clients" ? clients : trainings;
    const takeZone = (serverData) => { if (kind === "clients" && serverData) for (const target of [data, map.get(id)]) { if (!target) continue; if (serverData.zone === undefined) delete target.zone; else target.zone = serverData.zone; } };   // v315: the time zone the client's phone reported is never the coach's to change: always the server's copy, a restore's write included (the check round: a backup's old report went over the phone's newer one)
    const takeFields = (serverData) => {                      // two of his own devices: a field this one did not change since it last read the record takes the other device's value
      takeZone(serverData);
      if (kind === "clients" && serverData && !base) { takeProfile(serverData); return; }   // v299: nothing read to measure against (a save made before this session's first sync, after a relaunch with no signal): the fields the client writes themselves stay the server's unless this device changed them (the v299 review's catch: the client's Health & safety was overwritten by the coach's device copy)
      if (!base || !serverData) return;
      const skip = kind === "clients" ? ["id", "notes", "packages", "folders", "rootOrder", "plan", "planHistory", "health", "zone"] : ["id", ...(isTemplateClient(data.clientId) ? [] : ["rows"]), "completedAt", "completedBy", "completedZone", "skippedAt", "skipReason", "missed", "date", "inPerson"];   // the fields with their own merge rules (a template's exercises have none: no client logs on one, so rows this copy did not change take the other device's, as a field does; else Move to on a stale copy undid an edit made there, the v283 review)
      for (const target of [data, map.get(id)]) {
        if (!target) continue;
        for (const f of new Set([...Object.keys(serverData), ...Object.keys(base)])) {
          if (skip.includes(f) || JSON.stringify(target[f]) !== JSON.stringify(base[f]) || JSON.stringify(serverData[f]) === JSON.stringify(target[f])) continue;   // changed here (in this copy): ours stands
          if (serverData[f] === undefined) delete target[f]; else target[f] = serverData[f];
        }
      }
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
        for (const f of ["birthday", "sex", "height", "bodyWeight", "heightUnit", "bodyUnit", "unit"]) { if (mine.has(f)) continue; if (serverData[f] === undefined) delete target[f]; else target[f] = serverData[f]; }
        const th = { ...o(target.health) }, sh = o(serverData.health); let moved = false;
        for (const f of new Set([...Object.keys(sh), ...Object.keys(th)])) { if (mine.has("health." + f) || JSON.stringify(sh[f]) === JSON.stringify(th[f])) continue; if (sh[f] === undefined) delete th[f]; else th[f] = sh[f]; moved = true; }
        if (moved) target.health = th;
      }
    };
    const verbatim = () => fromFile.has(k);                    // restored from a backup: the file's copy replaces what the server holds, nothing of the server's is merged in (asked at merge time: a save already out when Restore was tapped must not merge into the restored record either)
    const noCopy = () => { if (verbatim() && version >= fromFile.get(k)) { seenAt.delete(k); seenDoc.delete(k); fromFile.delete(k); persistPending(); } };   // v315 (the fifth and sixth rounds): the restore's own write finds no copy on the server, on its first read or after a conflict (a deletion here that landed with its answer lost; one made on another device that this one has not synced since): nothing is left to keep out, so it goes as a join of a record this device never had (no marker, no stamp, no copy read), and a send again after its own answer is lost merges what the client logged on it since; the stamp goes before the queue is saved (a queue with the old stamp and no marker made a relaunch take the restored record for a deletion made elsewhere); only the restore's own write, never an older save still out when Restore was tapped
    const mergeServerRows = (serverData, against) => {        // take the client's weights/done/swaps for rows the trainer did not touch; `against`: the copy this device last read, to tell her new numbers from his
      const touched = trainerTouched.get(id) || new Set(), named = trainerNamed.get(id) || new Set(), noted = trainerNoted.get(id) || new Set(), claimed = (trainerState.get(id) || new Set()).has("order");   // three separate claims per row: the log, the name, the note — a coach who only wrote a note keeps nothing else
      const live = trainings.get(id), incoming = new Map();             // per copy: the rows the three-way merge brought in from the server (v314's settleOrder places them last)
      if (against && Array.isArray(against.rows) && serverData && Array.isArray(serverData.rows)) {   // (15 Nov 2026, the audit's #4) the exercise list three ways, by row id: one the other device removed (read here, gone from the server's copy, not changed here since) goes here too, and one it added (on the server's copy, never read here) comes in; one removed or added here stays so
        const was = new Map(against.rows.filter((x) => x && x.id).map((x) => [x.id, canon(normRow(x))])), there = new Set(serverData.rows.map((x) => x && x.id));
        for (const target of [data, live]) {
          if (!target || !Array.isArray(target.rows)) continue;
          const have = new Set(target.rows.map((x) => x && x.id));
          target.rows = target.rows.filter((x) => !(x && was.has(x.id) && !there.has(x.id) && was.get(x.id) === canon(normRow(x))));
          for (const sr of serverData.rows) if (sr && sr.id && !was.has(sr.id) && !have.has(sr.id)) { target.rows.push(JSON.parse(JSON.stringify(sr))); if (!incoming.has(target)) incoming.set(target, new Set()); incoming.get(target).add(sr.id); }
        }
      }
      const renumbered = (target) => claimed && !!target && (!against || !Array.isArray(against.rows) || (target.rows || []).some((x) => { const b = against.rows.find((y) => y.id === x.id); return !!b && String(b.label || "") !== String(x.label || ""); }));   // (only rows in that copy: one added since, here or by the merge just above, is no renumbering of his)   // v314: his Reorder's claim holds only while his numbers still differ from the copy he last read (the v314 review: kept past the save that carried them, it undid her later Start this exercise)
      const keepAll = new Map([data, live].map((x) => [x, renumbered(x)]));   // his Reorder's numbering: no row takes the server's number one by one; settleOrder places the cards once the rows are merged
      for (const sr of (serverData && serverData.rows) || []) {
        for (const target of [data, live]) {
          const lr = target && (target.rows || []).find((x) => x.id === sr.id); if (!lr) continue;
          if (sr.sets != null && String(sr.sets) !== String(lr.sets)) { const br = against && (against.rows || []).find((x) => x.id === sr.id); if (br && String(br.sets) === String(lr.sets)) lr.sets = sr.sets; }
          { const held = loggedSets(sr); if (held > setsOf(lr)) { const br = against && (against.rows || []).find((x) => x.id === sr.id); if (br ? held > loggedSets(br) : !touched.has(sr.id)) lr.sets = held; } }   // v313 (the second review): sets the client logged after this copy was read are never cut by a count lowered here (a join, the "…" Sets, the sets button on a copy a set behind, or no copy read); a drop asked for over sets this copy had still drops; with no copy read, only a row whose log is taken whole from the server is raised (the final check: a drop confirmed before the first sync came back as unfinished sets)   // v313: a row's number of sets merges as its number does: changed on another of the coach's devices (a join into a superset, the sets button, the "…" Sets) and not here since this copy was read, the server's count stands, before the log is cut to it (the v313 review: a stale save kept the old count beside the new number, and cut the client's sets past it)
          if (!touched.has(sr.id)) { lr.weights = sr.weights || []; lr.done = !!sr.done; lr.repsDone = sr.repsDone || []; if (sr.unit === "kg" || sr.unit === "lb") lr.unit = sr.unit; if (sr.setsDone != null) lr.setsDone = sr.setsDone; else delete lr.setsDone; if (sr.earlyReason) lr.earlyReason = String(sr.earlyReason); else delete lr.earlyReason; } else { const br = against && (against.rows || []).find((x) => x.id === sr.id); if (br) mergeSets(lr, br, sr); }   // (15 Nov 2026, the audit's #2) a row the coach changed: set by set, his value where he changed that set since he last read it, the client's everywhere else (with no copy read, his row stands whole, as before)
          if (!noted.has(sr.id)) { if (sr.clientNote) { lr.clientNote = String(sr.clientNote); if (sr.clientNoteBy) lr.clientNoteBy = String(sr.clientNoteBy); else delete lr.clientNoteBy; if (sr.clientNoteAt) lr.clientNoteAt = String(sr.clientNoteAt); else delete lr.clientNoteAt; } else { delete lr.clientNote; delete lr.clientNoteBy; delete lr.clientNoteAt; } }
          if (!named.has(sr.id) && typeof sr.name === "string") { lr.name = sr.name; lr.alts = Array.isArray(sr.alts) ? sr.alts : []; } // the client swapped in an alternative
          if (!keepAll.get(target) && typeof sr.label === "string" && sr.label !== lr.label) { const br = against && (against.rows || []).find((x) => x.id === sr.id); if (br && String(br.label || "") === String(lr.label || "")) lr.label = sr.label; }   // the client put an exercise ahead ("Start this exercise"): her number stands wherever the coach did not renumber that row himself since he last read it; none at all while his Reorder's numbers still differ from that copy (v314, "order" in trainerState, keepAll): his whole numbering stands, so a cross never leaves two cards on one number
        }
      }
      for (const target of [data, live]) if (target && Array.isArray(target.rows) && keepAll.get(target)) settleOrder(target, serverData, incoming.get(target) || new Set());
      liftSeq(serverData);
      repairTimed(data); if (live) repairTimed(live);              // seconds the client's old app typed as a weight go to the time column before this write
    };
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
          const wasP = new Map(((against && against.packages) || []).filter((x) => x && x.id).map((x) => [x.id, canon(x)])), thereP = new Set((serverData.packages || []).map((x) => x && x.id));   // (15 Nov 2026, the audit's #9) one the other device deleted (read here, gone from its copy, unchanged here) goes here too
          const union = (mine) => { const keep = (mine || []).filter((x) => !(x && x.id && wasP.has(x.id) && !thereP.has(x.id) && wasP.get(x.id) === canon(x))), have = new Set(keep.map((x) => x && x.id)); return [...keep, ...(serverData.packages || []).filter((x) => x && x.id && !have.has(x.id) && !deletedPackages.has(x.id))]; };   // one removed here stays removed
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
        if (!planTouched.has(id)) for (const f of ["plan", "planHistory"]) for (const target of [data, live]) { if (!target) continue; if (serverData[f] === undefined) delete target[f]; else target[f] = serverData[f]; }   // a plan set on another device stands, unless this one changed it
      };
      if (!seen && attempt === 0) {                               // no stamp (edited offline, app relaunched): read first, never write over the other side blind
        const existing = await withTimeout(S.sb.from(TABLE[kind]).select("data,updated_at").eq("id", id).maybeSingle(), saveDeadline());
        if (existing.error) throw existing.error;
        if (existing.data) { if (!verbatim()) { takeFields(existing.data.data); if (kind === "trainings" && !isTemplateClient(data.clientId)) { mergeServerRows(existing.data.data, base); takeState(existing.data.data); } takeNotes(existing.data.data); } else { if (kind === "trainings") liftSeq(existing.data.data); takeZone(existing.data.data); } seen = existing.data.updated_at; seenAt.set(k, seen); }
        else noCopy();
      }
      let res;
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
        if (seen && seenDoc.has(k) && !fromFile.has(k)) { map.delete(id); dirty.delete(k); seenAt.delete(k); seenDoc.delete(k); localBackend.save(); return; }   // a record this device had seen is gone from the server: deleted on another device; it is not brought back
        noCopy(); seenAt.delete(k); continue;
      }
      seenAt.set(k, fresh.data.updated_at);
      if (verbatim()) { if (kind === "trainings") liftSeq(fresh.data.data); takeZone(fresh.data.data); continue; }
      takeFields(fresh.data.data); const against = base; base = JSON.parse(JSON.stringify(fresh.data.data)); seenDoc.set(k, JSON.stringify(fresh.data.data));   // the next conflict measures against this copy
      if (kind === "trainings" && !isTemplateClient(data.clientId)) { mergeServerRows(fresh.data.data, against); takeState(fresh.data.data); }
      takeNotes(fresh.data.data, against);
    }
    throw new Error("save conflict");
  },
  async del(kind, id) {
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
      const q = pendingProfile.get(id); if (!q || !q.size || S.profileMissing) return;
      for (const k of [...q]) {
        const sent = profileGet(data, k);                           // null clears the field: always sent, so the rule's three arguments are always there
        const { error } = await rpc("client_set_profile", { p_client: id, p_key: k, p_value: sent });
        if (error && (error.code === "PGRST202" || /client_set_profile/.test(error.message || ""))) { S.profileMissing = true; break; }   // rule not installed yet (supabase/client-profile.sql): kept on the phone and shown there, sent on a later launch
        if (error && error.code === "P0001") { q.delete(k); scheduleSync(); continue; }   // refused for good: the server's value comes back with the next sync
        if (error) throw error;
        confirmedAt.set(key("clients", id), Date.now());            // a read that began before this landed must not bring the old value back
        if (JSON.stringify(profileGet(clients.get(id) || data, k)) === JSON.stringify(sent)) q.delete(k);   // changed again while this was out: it goes again
      }
      if (!q.size) pendingProfile.delete(id);
      persistPending(); return;
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
        const call = Promise.resolve(S.sb.rpc("client_move_training", { p_training: id, p_date: date }));
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
  for (const r of rows) {
    seen.add(r.id); if (dirty.has(key(kind, r.id))) continue;
    if (kind === "trainings" && map.has(r.id) && (pendingMove.has(r.id) || pendingMiss.has(r.id) || (pendingNoteRows.get(r.id) || new Set()).size || (pendingEarlyRows.get(r.id) || new Set()).size)) continue;   // the client's decision, note or reason still has to reach the server: keep ours (when there is an ours: a workout hidden and shown again is taken back)
    if ((confirmedAt.get(key(kind, r.id)) || 0) > startedAt) continue;   // written after this read began: keep ours
    if (kind === "trainings" && S.templateDraft && S.templateDraft.dirty && S.templateDraft.id === r.id) continue;   // unsaved template edits
    if (kind === "trainings" && viewedId === r.id && (S.asking || ui.$("rows").contains(document.activeElement))) continue; // being edited right now, or a confirm sheet is up over it: next sync, stamp and all
    const rec = { ...r.data, id: r.id }, cur = map.get(r.id);
    if (kind === "clients" && cur && (pendingProfile.get(r.id) || new Set()).size) for (const k of pendingProfile.get(r.id)) profilePut(rec, k, profileGet(cur, k));   // the client's own profile fields still on their way ride on the server's copy (the coach's edits land, the client's stand)
    if (kind === "trainings") { repairTimed(rec); if (cur && pendingOrder.has(r.id)) carryOrder(cur, rec); if (Array.isArray(rec.rows)) rec.rows.sort((a, b) => cmpLabel(a.label, b.label)); }   // her new order still on its way rides on the server's copy (his edits land, her numbers stand); rows in the order the cards show, so a copy that changed nothing reads as the same
    if (!(cur && sameRec(cur, rec))) { if (kind === "trainings" && cur && ui.relabeled) ui.relabeled(r.id, cur, rec); map.set(r.id, rec); if (kind === "trainings" && viewedClient && rec.clientId === viewedClient && r.id !== viewedId) S.histVer++; }   // the same record stays the same object (the cards on screen hold it); another workout of the viewed client changed: its last/best lines are read again (by S.histVer, never by forgetting which workout is on screen: that let a sync rebuild the cards under a typing finger, the audit's #11)
    if (!S.clientMode && r.updated_at) { seenAt.set(key(kind, r.id), r.updated_at); seenDoc.set(key(kind, r.id), JSON.stringify(r.data)); }   // the stamp, and the copy it describes, travel with the record
    if (kind === "trainings") trainerState.delete(r.id);
  }
  if (complete) for (const id of [...map.keys()]) if (!seen.has(id) && !dirty.has(key(kind, id)) && !((confirmedAt.get(key(kind, id)) || 0) > startedAt)) { map.delete(id); seenAt.delete(key(kind, id)); seenDoc.delete(key(kind, id)); }   // only a full answer can say something is gone, and not about a record written after this read began
}
async function syncDownNow() {
  if (!S.sb || !S.signedIn || !S.backend || S.seeding) return false;
  const startedAt = Date.now();
  const sess = await withTimeout(S.sb.auth.getSession(), 8000).catch(() => null);   // no usable token (refresh failed, cooldown, or a refresh that never answers): don't sync as a stranger
  if (!(sess && sess.data && sess.data.session)) { S.offline = true; ui.setStatus(); return false; }
  await Promise.all([ui.loadCustomVideos(), ui.loadHidden(), ui.loadCustomNames(), ui.loadCustomSubs()].map((p) => withTimeout(p.catch(() => {}), S.catalogWait || 8000)));   // each catalog gets a deadline: one that never answers cannot hold the workouts back (its data still lands when it does)   // the exercise list and page paint from loaded names, videos and subtitles
  let c, t;
  if (S.clientMode) {
    const res = await withTimeout(S.sb.rpc("client_my_data"), 8000);
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
    if (me && !S.zoneSetMissing) {                                      // v315: the phone's time zone, for the line under the client's name on the coach's page: sent when it changed, or every 30 minutes so the coach can tell how fresh it is
      const here = hereZone(), z = me.data && me.data.zone, fresh = !!z && z.zone === here && Date.now() - Date.parse(z.at) < 30 * 60e3;
      if (here && !fresh && me.id) rpc("client_set_zone", { p_client: me.id, p_zone: here }).then((res) => { const error = res && res.error; if (error && (error.code === "PGRST202" || /client_set_zone/.test(error.message || ""))) S.zoneSetMissing = true; }).catch(() => {});   // client-zone.sql not run yet: asked no more until a reload; offline: next sync
    }
    const authoritative = !!me && !(me.data && me.data.paused) && planActive(me.data && me.data.plan, today()) && planActive(me.data && me.data.plan, laToday());   // paused, or a monthly plan past its day: the server hides the workouts, it has not deleted them, so nothing queued is dropped
    if (authoritative) {                                                   // a training the trainer deleted: nothing queued for it can land
      const serverIds = new Set(t.data.map((r) => r.id));
      for (const k of [...dirty.keys()]) { const [kind, id] = k.split("/"); if (kind === "trainings" && !serverIds.has(id)) { dirty.delete(k); pendingWeightRows.delete(id); pendingDoneRows.delete(id); pendingEarlyRows.delete(id); pendingNoteRows.delete(id); pendingFinish.delete(id); pendingSkip.delete(id); pendingMove.delete(id); pendingMiss.delete(id); pendingSwap.delete(id); pendingOrder.delete(id); } }
      persistPending();
    }
  } else {
    [c, t] = await Promise.all([fetchAll("ft_clients"), fetchAll("ft_trainings")]);
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
    mergeDown(clients, "clients", c.data, c.complete !== false, startedAt); mergeDown(trainings, "trainings", t.data, t.complete !== false, startedAt);
    if (S.clientMode && c.data.length) {                          // the client's own profile queue (v299): a record the server no longer sends the client can take nothing
      const mine = new Set(c.data.map((r) => r.id)); for (const id of [...pendingProfile.keys()]) if (!mine.has(id)) pendingProfile.delete(id);
    }
  }
  lsSet("fiala.trainings.migrated", true); S.syncedOnce = true; S.syncedOn = today();
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
function scheduleSync() { clearTimeout(S.syncTimer); S.syncTimer = setTimeout(() => { (S.offline ? ui.resumeOnline() : syncDown()).catch(() => {}); }, 300); }
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") scheduleSync(); });
window.addEventListener("focus", scheduleSync);
window.addEventListener("storage", (e) => { if (!e || e.key !== "fiala.pending.v1" || !e.newValue) return; try { if (adoptQueue(JSON.parse(e.newValue))) persistPending(); } catch (_) {} });   // another page of the app saved its queue: taken on here at once (the audit's #19)
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

export { adoptQueue, dropMarks, seenDoc, moveOut, isNetwork, isOffline, reasonOf, key, markDirty, persistPending, restorePending, scheduleSave, flushAll, flushOne, localBackend, touchState, TABLE, cloudBackend, clientBackend, syncDown, mergeDown, syncDownNow, scheduleSync, withTimeout, fetchAll };
