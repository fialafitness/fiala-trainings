// Saving and syncing: the device copy, the debounced save queue, the cloud backend (coach), the client backend (RPCs),
// the paged read of the server and the merge back into the local maps. Screens are reached only through `ui`.
import { lsGet, lsSet, norm, clamp } from "./util.js";
import { isTemplateClient } from "./model.js";
import { mergeNotes } from "./notes.js";
import { S, ui, clients, trainings, dirty, timers, chains, pendingWeightRows, pendingDoneRows, pendingEarlyRows, pendingFinish, pendingSkip, trainerState, pendingMove, pendingMiss, pendingSwap, seenAt, trainerTouched, trainerNamed, confirmedAt, deletedNotes, pendingNoteRows } from "./state.js";

// ---------- persistence ----------
const isNetwork = (error) => /load failed|failed to fetch|network|fetch/i.test((error && error.message) || "");
const isOffline = (error) => !navigator.onLine || isNetwork(error);
const reasonOf = (e) => {
  const m = String((e && e.message) || "");
  if ((e && e.code === "PGRST202") || /Could not find the function/i.test(m)) return "database rule missing";
  if (e && e.code === "P0001" && m && m.length < 40) return m;
  return "";
};

function key(kind, id) { return kind + "/" + id; }
function markDirty(kind, id) { const k = key(kind, id); dirty.set(k, (dirty.get(k) || 0) + 1); }
// what still has to reach the server is written to the device too, so closing the app with no signal loses nothing
function persistPending() {
  lsSet("fiala.pending.v1", { dirty: [...dirty.keys()], weights: [...pendingWeightRows].map(([id, r]) => [id, [...r]]), done: [...pendingDoneRows].map(([id, r]) => [id, [...r]]), early: [...pendingEarlyRows].map(([id, r]) => [id, [...r]]), rownotes: [...pendingNoteRows].map(([id, r]) => [id, [...r]]),
    finish: [...pendingFinish], skip: [...pendingSkip], move: [...pendingMove], miss: [...pendingMiss], swap: [...pendingSwap].map(([id, m]) => [id, [...m]]),
    touched: [...trainerTouched].map(([id, r]) => [id, [...r]]), named: [...trainerNamed].map(([id, r]) => [id, [...r]]), state: [...trainerState].map(([id, f]) => [id, [...f]]),
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
  for (const [k, stamp] of p.stamps || []) if (stamp && !seenAt.has(k)) seenAt.set(k, stamp);
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
        if (dirty.get(k) === version) { dirty.delete(k); if (kind === "trainings") trainerState.delete(id); }   // the coach's state changes went with this save; a later touch keeps its flag
        confirmedAt.set(k, Date.now());
        return;
      } catch (e) {
        attempt++;
        S.failReason = reasonOf(e);
        if (isOffline(e)) { S.offline = true; return; }           // no signal: keep it queued, no red status
        if (e && e.fatal) { S.failed = true; if (dirty.get(k) === version) dirty.delete(k); return; }   // the server said no for good: don't carry it forever
        if (attempt > 3) { S.failed = true; return; }
        await new Promise((r) => setTimeout(r, 700 * attempt + Math.random() * 400));
      }
    }
  }).finally(() => { S.inflight--; persistPending(); ui.setStatus(); });
  chains.set(k, run.catch(() => {}));
  return run;
}
const localBackend = {
  load() { const d = lsGet("fiala.trainings.v1") || { clients: {}, trainings: {} }; for (const c of Object.values(d.clients)) clients.set(c.id, c); for (const t of Object.values(d.trainings)) trainings.set(t.id, t); },
  save() { const ok = lsSet("fiala.trainings.v1", { clients: Object.fromEntries(clients), trainings: Object.fromEntries(trainings) });  S.deviceFull = !ok; },
  async set() { this.save(); },
  async del() { this.save(); },
};
const touchState = (id, ...fields) => { if (S.clientMode) return; if (!trainerState.has(id)) trainerState.set(id, new Set()); for (const f of fields) trainerState.get(id).add(f); };
const TABLE = { clients: "ft_clients", trainings: "ft_trainings" };

const cloudBackend = {
  async set(kind, id, data) {
    const k = key(kind, id);
    const row = { id, data };
    if (kind === "trainings") row.client_id = data.clientId;
    const mergeServerRows = (serverData) => {                 // take the client's weights/done/swaps for rows the trainer did not touch
      const touched = trainerTouched.get(id) || new Set(), named = trainerNamed.get(id) || new Set();
      const live = trainings.get(id);
      for (const sr of (serverData && serverData.rows) || []) {
        for (const target of [data, live]) {
          const lr = target && (target.rows || []).find((x) => x.id === sr.id); if (!lr) continue;
          if (!touched.has(sr.id)) { lr.weights = sr.weights || []; lr.done = !!sr.done; lr.repsDone = sr.repsDone || []; lr.setsDone = sr.setsDone || 0; if (sr.earlyReason) lr.earlyReason = String(sr.earlyReason); else delete lr.earlyReason; if (sr.clientNote) { lr.clientNote = String(sr.clientNote); if (sr.clientNoteBy) lr.clientNoteBy = String(sr.clientNoteBy); else delete lr.clientNoteBy; if (sr.clientNoteAt) lr.clientNoteAt = String(sr.clientNoteAt); else delete lr.clientNoteAt; } else { delete lr.clientNote; delete lr.clientNoteBy; delete lr.clientNoteAt; } }
          if (!named.has(sr.id) && typeof sr.name === "string") { lr.name = sr.name; lr.alts = Array.isArray(sr.alts) ? sr.alts : []; } // the client swapped in an alternative
        }
      }
    };
    for (let attempt = 0; attempt < 4; attempt++) {
      let seen = seenAt.get(k);
      const takeState = (serverData) => {                      // the client may have finished, skipped or moved it meanwhile: keep that, field by field, unless the coach changed that field
        if (kind !== "trainings" || !serverData) return;
        const mine = trainerState.get(id) || new Set();
        for (const f of ["completedAt", "skippedAt", "missed", "date"]) { if (mine.has(f)) continue; for (const target of [data, trainings.get(id)]) { if (!target) continue; if (serverData[f] === undefined) delete target[f]; else target[f] = serverData[f]; } }
      };
      const takeNotes = (serverData) => {                      // another device may have written notes: keep both
        if (kind !== "clients" || !serverData) return;
        const merged = mergeNotes(data.notes, serverData.notes, deletedNotes); data.notes = merged; const live = clients.get(id); if (live) live.notes = merged;
      };
      if (!seen && attempt === 0) {                               // no stamp (edited offline, app relaunched): read first, never write over the other side blind
        const existing = await S.sb.from(TABLE[kind]).select("data,updated_at").eq("id", id).maybeSingle();
        if (existing.error) throw existing.error;
        if (existing.data) { if (kind === "trainings") { mergeServerRows(existing.data.data); takeState(existing.data.data); } takeNotes(existing.data.data); seen = existing.data.updated_at; seenAt.set(k, seen); }
      }
      let res;
      if (seen) res = await S.sb.from(TABLE[kind]).update(row).eq("id", id).eq("updated_at", seen).select("updated_at");
      else res = await S.sb.from(TABLE[kind]).upsert(row).select("updated_at");
      if (res.error) {
        if (res.error.code === "23505") { res.error.fatal = true; ui.$("status").textContent = "That email is already on another client"; }
        if (/^22/.test(String(res.error.code || ""))) seenAt.delete(k);   // a bad stamp must not poison every retry
        throw res.error;
      }
      if (res.data && res.data.length) { seenAt.set(k, res.data[0].updated_at); localBackend.save(); return; }
      // someone else (a client logging weights) saved first: take their weights, keep everything else, retry
      const fresh = await S.sb.from(TABLE[kind]).select("data,updated_at").eq("id", id).maybeSingle();
      if (fresh.error) throw fresh.error;
      if (!fresh.data) { seenAt.delete(k); continue; }
      seenAt.set(k, fresh.data.updated_at);
      if (kind === "trainings") { mergeServerRows(fresh.data.data); takeState(fresh.data.data); }
      takeNotes(fresh.data.data);
    }
    throw new Error("save conflict");
  },
  async del(kind, id) {
    const { error } = await S.sb.from(TABLE[kind]).delete().eq("id", id);
    if (error) throw error;
    localBackend.save();
  },
};

const clientBackend = {
  async set(kind, id, data) {
    if (kind !== "trainings") return;
    const rows = pendingWeightRows.get(id);
    if (rows) {
      const ids = [...rows]; rows.clear();
      for (let i = 0; i < ids.length; i++) {
        const r = (data.rows || []).find((x) => x.id === ids[i]); if (!r) continue;
        const clean = (a) => (a || []).map((w) => String(w == null ? "" : w).slice(0, 16));
        let error = null;
        if (!S.logSetMissing) ({ error } = await S.sb.rpc("client_log_set", { p_training: id, p_row: ids[i], p_weights: clean(r.weights), p_reps: clean(r.repsDone), p_sets_done: clamp(parseInt(r.setsDone, 10) || 0, 0, 20), p_done: !!r.done }));
        if (S.logSetMissing || (error && (error.code === "PGRST202" || /client_log_set/.test(error.message || "")))) {   // rule not installed yet: weights still get through the old way
          S.logSetMissing = true;
          ({ error } = await S.sb.rpc("client_set_weights", { p_training: id, p_row: ids[i], p_weights: clean(r.weights) }));
          if (!error && r.done) { const d = await S.sb.rpc("client_set_done", { p_training: id, p_row: ids[i], p_done: true }); error = d.error; }
        }
        if (error) { if (error.code === "P0001") { scheduleSync(); continue; } for (const rest of ids.slice(i)) rows.add(rest); throw error; }   // P0001: the server refused for good (row or training gone)
      }
    }
    const swaps = pendingSwap.get(id);
    if (swaps && swaps.size) {
      const picks = [...swaps.entries()]; swaps.clear();
      for (let i = 0; i < picks.length; i++) {
        const { error } = await S.sb.rpc("client_swap_exercise", { p_training: id, p_row: picks[i][0], p_name: picks[i][1] });
        if (error) {
          if (error.code === "P0001") { scheduleSync(); continue; } // the server said no (alternative or row gone): its version comes back on the next sync
          for (const rest of picks.slice(i)) swaps.set(rest[0], rest[1]); throw error;
        }
      }
    }
    if (pendingFinish.has(id)) {
      const { error } = await S.sb.rpc("client_finish_training", { p_training: id, p_finished: !!data.completedAt });
      if (error && error.code !== "P0001") throw error;
      pendingFinish.delete(id);
    }
    if (pendingSkip.has(id)) {
      const { error } = await S.sb.rpc("client_skip_training", { p_training: id, p_skipped: !!data.skippedAt });
      if (error && error.code !== "P0001") throw error;
      pendingSkip.delete(id);
    }
    if (pendingMove.has(id) && !S.moveMissing) {
      const { error } = await S.sb.rpc("client_move_training", { p_training: id, p_date: String(data.date || "").slice(0, 10) });
      if (error && (error.code === "PGRST202" || /client_move_training/.test(error.message || ""))) S.moveMissing = true;   // rule not installed yet: stays on the device until it is
      else { if (error && error.code !== "P0001") throw error; pendingMove.delete(id); }
    }
    if (pendingMiss.has(id) && !S.missMissing) {
      const { error } = await S.sb.rpc("client_miss_training", { p_training: id, p_missed: data.missed === true });
      if (error && (error.code === "PGRST202" || /client_miss_training/.test(error.message || ""))) S.missMissing = true;
      else { if (error && error.code !== "P0001") throw error; pendingMiss.delete(id); }
    }
    const dones = pendingDoneRows.get(id);
    if (dones) {
      const dids = [...dones]; dones.clear();
      for (let i = 0; i < dids.length; i++) {
        const r = (data.rows || []).find((x) => x.id === dids[i]); if (!r) continue;
        const { error } = await S.sb.rpc("client_set_done", { p_training: id, p_row: dids[i], p_done: !!r.done });
        if (error) { if (error.code === "P0001") { scheduleSync(); continue; } for (const rest of dids.slice(i)) dones.add(rest); throw error; }
      }
    }
    const notesQ = pendingNoteRows.get(id);
    if (notesQ && !S.noteMissing) {
      const nids = [...notesQ]; notesQ.clear();
      for (let i = 0; i < nids.length; i++) {
        const r = (data.rows || []).find((x) => x.id === nids[i]); if (!r) continue;
        const { error } = await S.sb.rpc("client_row_note", { p_training: id, p_row: nids[i], p_note: String(r.clientNote || "").slice(0, 500) || null });
        if (error && (error.code === "PGRST202" || /client_row_note/.test(error.message || ""))) { S.noteMissing = true; for (const rest of nids.slice(i)) notesQ.add(rest); break; }   // rule not installed yet: kept for a later launch
        if (error) { if (error.code === "P0001") { scheduleSync(); continue; } for (const rest of nids.slice(i)) notesQ.add(rest); throw error; }
      }
    }
    const earlies = pendingEarlyRows.get(id);
    if (earlies && !S.earlyMissing) {
      const eids = [...earlies]; earlies.clear();
      for (let i = 0; i < eids.length; i++) {
        const r = (data.rows || []).find((x) => x.id === eids[i]); if (!r) continue;
        const { error } = await S.sb.rpc("client_finish_early", { p_training: id, p_row: eids[i], p_reason: String(r.earlyReason || "").slice(0, 40) || null });
        if (error && (error.code === "PGRST202" || /client_finish_early/.test(error.message || ""))) { S.earlyMissing = true; break; }   // rule not installed yet: the reason stays on the device, everything else still syncs
        if (error) { if (error.code === "P0001") { scheduleSync(); continue; } for (const rest of eids.slice(i)) earlies.add(rest); throw error; }
      }
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
    if (kind === "trainings" && S.renderedTraining === r.id && ui.$("rows").contains(document.activeElement)) continue; // being edited right now: next sync, stamp and all
    map.set(r.id, { ...r.data, id: r.id });
    if (!S.clientMode && r.updated_at) seenAt.set(key(kind, r.id), r.updated_at);   // the stamp travels with the record it describes
    if (kind === "trainings") trainerState.delete(r.id);
  }
  if (complete) for (const id of [...map.keys()]) if (!seen.has(id) && !dirty.has(key(kind, id))) map.delete(id);   // only a full answer can say something is gone
}
async function syncDownNow() {
  if (!S.sb || !S.signedIn || !S.backend || S.seeding) return false;
  const startedAt = Date.now();
  const sess = await S.sb.auth.getSession().catch(() => null);           // no usable token (refresh failed, cooldown): don't sync as a stranger
  if (!(sess && sess.data && sess.data.session)) { S.offline = true; ui.setStatus(); return false; }
  ui.loadCustomVideos().catch(() => {}); ui.loadCustomNames().catch(() => {});
  let c, t;
  if (S.clientMode) {
    const res = await withTimeout(S.sb.rpc("client_my_data"), 8000);
    if (res.error) {
      if (isOffline(res.error)) {
        if (ui.offlineFromMirror()) return false;               // no signal: the last synced copy stands in
        ui.showProblem("Couldn\u2019t load your workouts \u00b7 check your signal and tap Try again"); return false;
      }
      ui.showProblem("Couldn\u2019t load your workouts \u00b7 " + (res.error.message || "server error") + " \u00b7 tap Try again"); return false;
    }
    c = { data: res.data.clients || [] }; t = { data: res.data.trainings || [] };
    const me = c.data[0], authoritative = !!me && !(me.data && me.data.paused);
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
const withTimeout = (p, ms) => Promise.race([p, new Promise((r) => setTimeout(() => r({ data: null, error: { message: "network timeout" } }), ms))]);
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
