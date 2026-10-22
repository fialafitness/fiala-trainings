// Saving and syncing: the device copy, the debounced save queue, the cloud backend (coach), the client backend (RPCs),
// the paged read of the server and the merge back into the local maps. Screens are reached only through `ui`.
import { lsGet, lsSet, norm, clamp, today } from "./util.js";
import { isTemplateClient, planActive, repairTimed, timedPlan } from "./model.js";
import { mergeNotes } from "./notes.js";
import { S, ui, clients, trainings, dirty, timers, chains, pendingWeightRows, pendingDoneRows, pendingEarlyRows, pendingFinish, pendingSkip, trainerState, pendingMove, pendingMiss, pendingSwap, seenAt, trainerTouched, trainerNamed, trainerNoted, planTouched, confirmedAt, deletedNotes, deletedPackages, fromFile, pendingNoteRows } from "./state.js";

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
function markDirty(kind, id) { const k = key(kind, id); dirty.set(k, (dirty.get(k) || 0) + 1); }
// what still has to reach the server is written to the device too, so closing the app with no signal loses nothing
function persistPending() {
  lsSet("fiala.pending.v1", { dirty: [...dirty.keys()], weights: [...pendingWeightRows].map(([id, r]) => [id, [...r]]), done: [...pendingDoneRows].map(([id, r]) => [id, [...r]]), early: [...pendingEarlyRows].map(([id, r]) => [id, [...r]]), rownotes: [...pendingNoteRows].map(([id, r]) => [id, [...r]]),
    finish: [...pendingFinish], skip: [...pendingSkip], move: [...pendingMove], miss: [...pendingMiss], swap: [...pendingSwap].map(([id, m]) => [id, [...m]]),
    touched: [...trainerTouched].map(([id, r]) => [id, [...r]]), named: [...trainerNamed].map(([id, r]) => [id, [...r]]), noted: [...trainerNoted].map(([id, r]) => [id, [...r]]), state: [...trainerState].map(([id, f]) => [id, [...f]]),
    plans: [...planTouched], notesGone: [...deletedNotes], packagesGone: [...deletedPackages], fromFile: [...fromFile],   // the coach's intent about a client record: a plan changed, a note or package removed, a backup restored
    stamps: [...dirty.keys()].map((k) => [k, seenAt.get(k) || null]), owner: S.sessionEmail || S.pendingOwner || "" });
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
  for (const id of new Set([...pendingMove, ...pendingMiss])) markDirty("trainings", id);   // sent again on this launch (the rule may have been missing last time)
  for (const [id, picks] of p.swap || []) pendingSwap.set(id, new Map([...(pendingSwap.get(id) || []), ...picks]));
  for (const [id, rows] of p.touched || []) trainerTouched.set(id, new Set([...(trainerTouched.get(id) || []), ...rows]));
  for (const [id, fields] of p.state || []) trainerState.set(id, new Set([...(trainerState.get(id) || []), ...fields]));
  for (const [id, rows] of p.named || []) trainerNamed.set(id, new Set([...(trainerNamed.get(id) || []), ...rows]));
  for (const [id, rows] of p.noted || []) trainerNoted.set(id, new Set([...(trainerNoted.get(id) || []), ...rows]));
  for (const [k, stamp] of p.stamps || []) if (stamp && !seenAt.has(k)) seenAt.set(k, stamp);
  for (const id of p.plans || []) planTouched.add(id);
  for (const [n, cid] of p.notesGone || []) deletedNotes.set(n, cid);
  for (const [pk, cid] of p.packagesGone || []) deletedPackages.set(pk, cid);
  for (const e of p.fromFile || []) { if (Array.isArray(e)) fromFile.set(e[0], Number(e[1]) || 0); else if (typeof e === "string") fromFile.set(e, 0); }   // older devices wrote the key alone
  S.pendingOwner = p.owner || "";
}
function scheduleSave(kind, id, delay = 500) {
  if (kind === "trainings" && S.templateDraft && S.templateDraft.id === id && !S.templateDraft.saving) { S.templateDraft.dirty = true; ui.paintDraftBar(); return; }
  markDirty(kind, id); persistPending();
  const k = key(kind, id);
  clearTimeout(timers.get(k));
  timers.set(k, setTimeout(() => flushOne(kind, id), delay));
  ui.setStatus();
}

const dropIntent = (id) => { planTouched.delete(id); for (const [n, cid] of [...deletedNotes]) if (cid === id) deletedNotes.delete(n); for (const [pk, cid] of [...deletedPackages]) if (cid === id) deletedPackages.delete(pk); };   // the save that carried them is on the server: the markers have done their work
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
    if (S.backend !== localBackend && S.sb) {
      const sess = await S.sb.auth.getSession().catch(() => null);
      if (!(sess && sess.data && sess.data.session)) { S.offline = true; return; }   // token not usable right now: keep it queued
    }
    for (;;) {
      try {
        if (data) await S.backend.set(kind, id, data); else await S.backend.del(kind, id);
        S.failed = false;
        if (fromFile.has(k) && version >= fromFile.get(k)) fromFile.delete(k);   // the write that carried the backup's copy landed: every later save merges as usual, even one queued meanwhile
        if (dirty.get(k) === version) { dirty.delete(k); if (kind === "trainings") { trainerState.delete(id); trainerTouched.delete(id); trainerNamed.delete(id); trainerNoted.delete(id); } if (kind === "clients") dropIntent(id); }   // the coach's state changes went with this save; a later touch keeps its flag
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
const localBackend = {
  load() { const d = lsGet("fiala.trainings.v1") || { clients: {}, trainings: {} }; for (const c of Object.values(d.clients)) clients.set(c.id, c); for (const t of Object.values(d.trainings)) { repairTimed(t); trainings.set(t.id, t); } },
  save() { const ok = lsSet("fiala.trainings.v1", { clients: Object.fromEntries(clients), trainings: Object.fromEntries(trainings) });  S.deviceFull = !ok; },
  async set() { this.save(); },
  async del() { this.save(); },
};
const touchState = (id, ...fields) => { if (S.clientMode) return; if (!trainerState.has(id)) trainerState.set(id, new Set()); for (const f of fields) trainerState.get(id).add(f); };
const TABLE = { clients: "ft_clients", trainings: "ft_trainings" };
const withTimeout = (p, ms) => Promise.race([p, new Promise((r) => setTimeout(() => r({ data: null, error: { message: "network timeout" } }), ms))]);
const SAVE_WAIT = 15000;                                           // a save that never answers must not block every later save of the record: it times out like a read, and is retried
const rpc = (name, args) => withTimeout(S.sb.rpc(name, args), SAVE_WAIT);

const cloudBackend = {
  async set(kind, id, data) {
    const k = key(kind, id);
    const row = { id, data };
    if (kind === "trainings") row.client_id = data.clientId;
    const verbatim = () => fromFile.has(k);                    // restored from a backup: the file's copy replaces what the server holds, nothing of the server's is merged in (asked at merge time: a save already out when Restore was tapped must not merge into the restored record either)
    const mergeServerRows = (serverData) => {                 // take the client's weights/done/swaps for rows the trainer did not touch
      const touched = trainerTouched.get(id) || new Set(), named = trainerNamed.get(id) || new Set(), noted = trainerNoted.get(id) || new Set();   // three separate claims per row: the log, the name, the note — a coach who only wrote a note keeps nothing else
      const live = trainings.get(id);
      for (const sr of (serverData && serverData.rows) || []) {
        for (const target of [data, live]) {
          const lr = target && (target.rows || []).find((x) => x.id === sr.id); if (!lr) continue;
          if (!touched.has(sr.id)) { lr.weights = sr.weights || []; lr.done = !!sr.done; lr.repsDone = sr.repsDone || []; if (sr.setsDone != null) lr.setsDone = sr.setsDone; else delete lr.setsDone; if (sr.earlyReason) lr.earlyReason = String(sr.earlyReason); else delete lr.earlyReason; }
          if (!noted.has(sr.id)) { if (sr.clientNote) { lr.clientNote = String(sr.clientNote); if (sr.clientNoteBy) lr.clientNoteBy = String(sr.clientNoteBy); else delete lr.clientNoteBy; if (sr.clientNoteAt) lr.clientNoteAt = String(sr.clientNoteAt); else delete lr.clientNoteAt; } else { delete lr.clientNote; delete lr.clientNoteBy; delete lr.clientNoteAt; } }
          if (!named.has(sr.id) && typeof sr.name === "string") { lr.name = sr.name; lr.alts = Array.isArray(sr.alts) ? sr.alts : []; } // the client swapped in an alternative
        }
      }
      repairTimed(data); if (live) repairTimed(live);              // seconds the client's old app typed as a weight go to the time column before this write
    };
    for (let attempt = 0; attempt < 4; attempt++) {
      let seen = seenAt.get(k);
      const takeState = (serverData) => {                      // the client may have finished, skipped or moved it meanwhile: keep that, field by field, unless the coach changed that field
        if (kind !== "trainings" || !serverData) return;
        const mine = trainerState.get(id) || new Set();
        for (const f of ["completedAt", "completedBy", "skippedAt", "skipReason", "missed", "date", "inPerson"]) { if (mine.has(f)) continue; for (const target of [data, trainings.get(id)]) { if (!target) continue; if (serverData[f] === undefined) delete target[f]; else target[f] = serverData[f]; } }
      };
      const takeNotes = (serverData) => {                      // another device may have written notes: keep both
        if (kind !== "clients" || !serverData) return;
        const merged = mergeNotes(data.notes, serverData.notes, deletedNotes); data.notes = merged; const live = clients.get(id); if (live) live.notes = merged;
        if (Array.isArray(serverData.packages) || Array.isArray(data.packages)) {                  // packages added on two devices: keep both
          const have = new Set((data.packages || []).map((x) => x && x.id)), union = [...(data.packages || []), ...(serverData.packages || []).filter((x) => x && x.id && !have.has(x.id) && !deletedPackages.has(x.id))];   // one removed here stays removed
          data.packages = union; if (live) live.packages = union;
        }
        if (!planTouched.has(id)) for (const f of ["plan", "planHistory"]) for (const target of [data, live]) { if (!target) continue; if (serverData[f] === undefined) delete target[f]; else target[f] = serverData[f]; }   // a plan set on another device stands, unless this one changed it
      };
      if (!seen && attempt === 0) {                               // no stamp (edited offline, app relaunched): read first, never write over the other side blind
        const existing = await withTimeout(S.sb.from(TABLE[kind]).select("data,updated_at").eq("id", id).maybeSingle(), SAVE_WAIT);
        if (existing.error) throw existing.error;
        if (existing.data) { if (!verbatim()) { if (kind === "trainings") { mergeServerRows(existing.data.data); takeState(existing.data.data); } takeNotes(existing.data.data); } seen = existing.data.updated_at; seenAt.set(k, seen); }
      }
      let res;
      if (seen) res = await withTimeout(S.sb.from(TABLE[kind]).update(row).eq("id", id).eq("updated_at", seen).select("updated_at"), SAVE_WAIT);
      else res = await withTimeout(S.sb.from(TABLE[kind]).upsert(row).select("updated_at"), SAVE_WAIT);
      if (res.error) {
        if (res.error.code === "23505" || res.error.code === "22P02") res.error.fatal = true;   // another client has that email; an id the table cannot hold: no retry will change the answer
        if (/^22/.test(String(res.error.code || ""))) seenAt.delete(k);   // a bad stamp must not poison every retry
        throw res.error;
      }
      if (res.data && res.data.length) { seenAt.set(k, res.data[0].updated_at); localBackend.save(); return; }
      // someone else (a client logging weights) saved first: take their weights, keep everything else, retry
      const fresh = await withTimeout(S.sb.from(TABLE[kind]).select("data,updated_at").eq("id", id).maybeSingle(), SAVE_WAIT);
      if (fresh.error) throw fresh.error;
      if (!fresh.data) { seenAt.delete(k); continue; }
      seenAt.set(k, fresh.data.updated_at);
      if (verbatim()) continue;                                        // the file's copy, written again over the newer stamp
      if (kind === "trainings") { mergeServerRows(fresh.data.data); takeState(fresh.data.data); }
      takeNotes(fresh.data.data);
    }
    throw new Error("save conflict");
  },
  async del(kind, id) {
    const { error } = await withTimeout(S.sb.from(TABLE[kind]).delete().eq("id", id), SAVE_WAIT);
    if (error) throw error;
    localBackend.save();
  },
};

const clientBackend = {
  // Every queue is an outbox: an item stays in it until the server holds what the record says NOW. Nothing is cleared before the answer
  // comes back (a persist mid-flight, or the app being killed, loses nothing), and an answer never acknowledges a newer action — a set
  // logged, or Undo tapped, while the request was out stays queued and goes with the next flush. P0001 means the server refused for good
  // (row or workout gone): the item is dropped and the server's version comes back on the next sync. Sending twice is harmless: every rule
  // writes the whole value it is given.
  async set(kind, id, data) {
    if (kind !== "trainings") return;
    const live = () => trainings.get(id) || data;
    const rowOf = (t, rid) => ((t && t.rows) || []).find((x) => x.id === rid);
    const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
    const clean = (a) => (a || []).map((w) => String(w == null ? "" : w).slice(0, 16));
    const oldWay = (r) => { const tm = timedPlan(r.reps); if (!tm) return r.weights; const ws = [...(r.weights || [])], rs = r.repsDone || []; for (let j = 0; j < Math.max(ws.length, rs.length); j++) if (!String(ws[j] == null ? "" : ws[j]).trim() && String(rs[j] == null ? "" : rs[j]).trim()) ws[j] = String(rs[j]).trim() + " " + tm.unit; return ws; };   // the old rule carries weights only: a hold's seconds travel as "45 sec" and the coach's app moves them back into the time column
    const logOf = (r) => (r ? { w: clean(r.weights), rp: clean(r.repsDone), sd: clamp(parseInt(r.setsDone, 10) || 0, 0, 20), d: !!r.done } : null);
    const rows = pendingWeightRows.get(id);
    if (rows) for (const rid of [...rows]) {
      const r = rowOf(data, rid); if (!r) { rows.delete(rid); continue; }
      const sent = logOf(r); let error = null;
      if (!S.logSetMissing) ({ error } = await rpc("client_log_set", { p_training: id, p_row: rid, p_weights: sent.w, p_reps: sent.rp, p_sets_done: sent.sd, p_done: sent.d }));
      if (S.logSetMissing || (error && (error.code === "PGRST202" || /client_log_set/.test(error.message || "")))) {   // rule not installed yet: weights still get through the old way
        S.logSetMissing = true;
        ({ error } = await rpc("client_set_weights", { p_training: id, p_row: rid, p_weights: clean(oldWay(r)) }));
        if (!error && r.done) { const d = await rpc("client_set_done", { p_training: id, p_row: rid, p_done: true }); error = d.error; }
      }
      if (error && error.code === "P0001") { rows.delete(rid); scheduleSync(); continue; }
      if (error) throw error;
      if (same(logOf(rowOf(live(), rid)), sent)) rows.delete(rid);
    }
    const swaps = pendingSwap.get(id);
    if (swaps && swaps.size) for (const [rid, name] of [...swaps.entries()]) {
      const { error } = await rpc("client_swap_exercise", { p_training: id, p_row: rid, p_name: name });
      if (error && error.code === "P0001") { swaps.delete(rid); scheduleSync(); continue; }   // the server said no (alternative or row gone): its version comes back on the next sync
      if (error) throw error;
      if (swaps.get(rid) === name) swaps.delete(rid);
    }
    if (pendingFinish.has(id)) {
      const finished = !!data.completedAt;
      const { error } = await rpc("client_finish_training", { p_training: id, p_finished: finished });
      if (error && error.code !== "P0001") throw error;
      if (error || !!live().completedAt === finished) pendingFinish.delete(id);              // Undo tapped while Finish was out: still queued, goes next
    }
    if (pendingSkip.has(id)) {
      const skipped = !!data.skippedAt, reason = String(data.skipReason || "");
      let { error } = await rpc("client_skip_training", { p_training: id, p_skipped: skipped, p_reason: reason });
      if (error && error.code === "PGRST202") ({ error } = await rpc("client_skip_training", { p_training: id, p_skipped: skipped }));   // the rule without the reason (not updated yet): the skip still lands
      if (error && error.code !== "P0001") throw error;
      const now = live(); if (error || (!!now.skippedAt === skipped && String(now.skipReason || "") === reason)) pendingSkip.delete(id);
    }
    if (pendingMove.has(id) && !S.moveMissing) {
      const date = String(data.date || "").slice(0, 10);
      const { error } = await rpc("client_move_training", { p_training: id, p_date: date });
      if (error && (error.code === "PGRST202" || /client_move_training/.test(error.message || ""))) S.moveMissing = true;   // rule not installed yet: stays on the device until it is
      else { if (error && error.code !== "P0001") throw error; if (error || String(live().date || "").slice(0, 10) === date) pendingMove.delete(id); }
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
function mergeDown(map, kind, rows, complete, startedAt) {        // the server's answer into the local map, keeping what this device still has to send
  const seen = new Set();
  for (const r of rows) {
    seen.add(r.id); if (dirty.has(key(kind, r.id))) continue;
    if (kind === "trainings" && (pendingMove.has(r.id) || pendingMiss.has(r.id))) continue;   // the client's decision still has to reach the server: keep ours
    if ((confirmedAt.get(key(kind, r.id)) || 0) > startedAt) continue;   // written after this read began: keep ours
    if (kind === "trainings" && S.templateDraft && S.templateDraft.dirty && S.templateDraft.id === r.id) continue;   // unsaved template edits
    if (kind === "trainings" && S.renderedTraining === r.id && (S.asking || ui.$("rows").contains(document.activeElement))) continue; // being edited right now, or a confirm sheet is up over it: next sync, stamp and all
    const rec = { ...r.data, id: r.id }; if (kind === "trainings") repairTimed(rec); map.set(r.id, rec);
    if (!S.clientMode && r.updated_at) seenAt.set(key(kind, r.id), r.updated_at);   // the stamp travels with the record it describes
    if (kind === "trainings") trainerState.delete(r.id);
  }
  if (complete) for (const id of [...map.keys()]) if (!seen.has(id) && !dirty.has(key(kind, id)) && !((confirmedAt.get(key(kind, id)) || 0) > startedAt)) map.delete(id);   // only a full answer can say something is gone, and not about a record written after this read began
}
async function syncDownNow() {
  if (!S.sb || !S.signedIn || !S.backend || S.seeding) return false;
  const startedAt = Date.now();
  const sess = await S.sb.auth.getSession().catch(() => null);           // no usable token (refresh failed, cooldown): don't sync as a stranger
  if (!(sess && sess.data && sess.data.session)) { S.offline = true; ui.setStatus(); return false; }
  await Promise.all([ui.loadCustomVideos(), ui.loadHidden(), ui.loadCustomNames(), ui.loadCustomSubs()].map((p) => p.catch(() => {})));   // the exercise list and page paint from loaded names, videos and subtitles
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
    const me = c.data[0], authoritative = !!me && !(me.data && me.data.paused) && planActive(me.data && me.data.plan, today());   // paused, or a monthly plan past its day: the server hides the workouts, it has not deleted them, so nothing queued is dropped
    if (authoritative) {                                                   // a training the trainer deleted: nothing queued for it can land
      const serverIds = new Set(t.data.map((r) => r.id));
      for (const k of [...dirty.keys()]) { const [kind, id] = k.split("/"); if (kind === "trainings" && !serverIds.has(id)) { dirty.delete(k); pendingWeightRows.delete(id); pendingDoneRows.delete(id); pendingEarlyRows.delete(id); pendingNoteRows.delete(id); pendingFinish.delete(id); pendingSkip.delete(id); pendingMove.delete(id); pendingMiss.delete(id); pendingSwap.delete(id); } }
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
  }
  const migrated = lsGet("fiala.trainings.migrated");
  if (!S.clientMode && !migrated && c.data.length === 0 && t.data.length === 0 && (clients.size || trainings.size)) {
    for (const id of clients.keys()) scheduleSave("clients", id, 0);
    for (const id of trainings.keys()) scheduleSave("trainings", id, 0);
  } else {
    mergeDown(clients, "clients", c.data, c.complete !== false, startedAt); mergeDown(trainings, "trainings", t.data, t.complete !== false, startedAt);
  }
  lsSet("fiala.trainings.migrated", true); S.syncedOnce = true;
  localBackend.save();
  if (S.clientMode) {
    S.myClientId = clients.size ? [...clients.keys()][0] : null;
    if (!S.myClientId) { ui.showWaiting(); return; }
    if (S.view.name === "clients" || (S.view.name === "client" && S.view.id !== S.myClientId)) S.view = { name: "client", id: S.myClientId };
  }
  S.offline = false;
  ui.render(); ui.setStatus();
  for (const k of dirty.keys()) if (!timers.has(k)) { const [kind, id] = k.split("/"); flushOne(kind, id); }
  return true;
}
function scheduleSync() { clearTimeout(S.syncTimer); S.syncTimer = setTimeout(() => { (S.offline ? ui.resumeOnline() : syncDown()).catch(() => {}); }, 300); }
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") scheduleSync(); });
window.addEventListener("focus", scheduleSync);
window.addEventListener("online", () => { S.failed = false; if (S.offline && S.signedIn) { ui.resumeOnline().catch(() => {}); return; } for (const k of dirty.keys()) { const [kind, id] = k.split("/"); flushOne(kind, id); } scheduleSync(); });
setInterval(() => { if (document.visibilityState === "visible") scheduleSync(); }, 60000);
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

export { isNetwork, isOffline, reasonOf, key, markDirty, persistPending, restorePending, scheduleSave, flushAll, flushOne, localBackend, touchState, TABLE, cloudBackend, clientBackend, syncDown, mergeDown, syncDownNow, scheduleSync, withTimeout, fetchAll };
