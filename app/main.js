// Fiala Trainings — the app. Loaded by index.html as an ES module; boot() starts it.
import { NAMES, VIDEOS, ALIASES } from "./catalog.js";
import { S, resetState, clients, trainings, dirty, timers, chains, pendingWeightRows, pendingDoneRows, pendingEarlyRows, pendingFinish, pendingSkip, trainerState, pendingMove, pendingMiss, pendingSwap, seenAt, trainerTouched, trainerNamed, confirmedAt, deletedNotes, pendingNoteRows, ui, planTouched } from "./state.js";
import { uid, now, today, localIso, fmtDate, fmtDay, clamp, norm, squash, lsGet, lsSet, daysLater } from "./util.js";
import { TEMPLATES_ID, isTemplateClient, effDate, freshRow, isEmptyWorkout, setsOf, groupKey, validateBackup, timedPlan, timeAsWeight, repairTimed, planNumber, autoSubtitle, splitName, perHand, betterSet, topSet, sameSet, setCounts, correctFrom, planProgress, sessionNo, planActive } from "./model.js";
import { noteEntries, packNotes, mergeNotes } from "./notes.js";
import { isNetwork, isOffline, reasonOf, key, markDirty, persistPending, restorePending, scheduleSave, flushAll, flushOne, localBackend, touchState, TABLE, cloudBackend, clientBackend, syncDown, mergeDown, syncDownNow, scheduleSync, withTimeout, fetchAll } from "./sync.js";
import { parseTtf, pdfDoc } from "./pdf.js";
import { reportRange, buildReport } from "./report.js";

  // ---------- helpers ----------
  const $ = (id) => document.getElementById(id);
  // "W", "Wa", "Wb" … = warm-up: groups like a number and sorts before 1
  const isWarmLabel = (l) => /^w\s*[a-z]?$/i.test(String(l || "").trim());
  const labelKey = (l) => { const s = String(l || "").trim(); const m = s.match(/^(\d+)\s*([a-z]*)/i); if (m) return [parseInt(m[1], 10), m[2].toLowerCase()]; const w = s.match(/^w\s*([a-z]?)$/i); return w ? [-1, w[1].toLowerCase()] : [Infinity, s.toLowerCase()]; };
  const cmpLabel = (a, b) => { const [an, as] = labelKey(a), [bn, bs] = labelKey(b); return an - bn || (as < bs ? -1 : as > bs ? 1 : 0); };
  const NAME_KEYS = NAMES.map(squash);
  const customNames = new Map();          // key -> name (his own exercises, table ft_exercises)
  let ALL_NAMES = NAMES, ALL_KEYS = NAME_KEYS;
  const builtinKeys = new Set(NAME_KEYS);
  const ALIAS_PAIRS = Object.entries(ALIASES).map(([a, b]) => [squash(a), b]);
  const aliasFinds = (s, have) => { const out = []; if (!s) return out; const seen = new Set(have); for (const [k, n] of ALIAS_PAIRS) { if (!k.includes(s)) continue; const i = ALL_KEYS.indexOf(squash(n)); if (i < 0) continue; const shown = ALL_NAMES[i]; if (seen.has(shown)) continue; seen.add(shown); out.push(shown); } return out; };   // "triceps" still finds the tricep exercises: old spellings are aliases (and his own spelling of a built-in is what gets listed)
  const hiddenKeys = new Set();           // built-in exercises he removed or renamed away (table ft_exercise_hidden)
  function refreshNames() {
    const names = [], keys = [];
    for (let i = 0; i < NAMES.length; i++) { const k = NAME_KEYS[i]; if (hiddenKeys.has(k) || customNames.has(k)) continue; names.push(NAMES[i]); keys.push(k); }   // a custom entry with the same key is his spelling of it
    for (const [k, n] of [...customNames.entries()].sort((a, b) => a[1].localeCompare(b[1]))) { names.push(n); keys.push(k); }
    ALL_NAMES = names; ALL_KEYS = keys;
  }
  const ALIAS_BY_KEY = new Map(Object.entries(ALIASES).map(([a, b]) => [squash(a), b]));
  const properName = (n) => { const t = String(n || "").replace(/\s+/g, " ").trim(), k = squash(t); if (!k || builtinKeys.has(k) || customNames.has(k)) return t; return ALIAS_BY_KEY.get(k) || t; };   // an old spelling, however typed, resolves to the exercise it names
  const knownName = (n) => { const k = squash(properName(n)); return !!k && ((builtinKeys.has(k) && !hiddenKeys.has(k)) || customNames.has(k)); };
  let lastDbError = "";                   // the last Supabase message, so a screen can say "run the script" instead of "try again"
  const missingTable = () => /ft_exercise_hidden|ft_exercises|ft_exercise_videos|ft_exercise_subtitles/.test(lastDbError) && /not find|does not exist|schema cache/i.test(lastDbError);
  async function loadHidden() {
    if (!S.sb || !S.signedIn) return;
    const { data, error } = await S.sb.from("ft_exercise_hidden").select("name_key");
    if (error || !data) return;
    hiddenKeys.clear(); for (const r of data) hiddenKeys.add(r.name_key); refreshNames();
  }
  async function hideBuiltin(k) { const { error } = await S.sb.from("ft_exercise_hidden").upsert({ name_key: k }); if (error) { lastDbError = error.message || ""; return false; } hiddenKeys.add(k); refreshNames(); return true; }
  async function unhideBuiltin(k) { if (!hiddenKeys.has(k)) return true; const { error } = await S.sb.from("ft_exercise_hidden").delete().eq("name_key", k); if (error) { lastDbError = error.message || ""; return false; } hiddenKeys.delete(k); refreshNames(); return true; }
  const nearName = (n) => { const k = squash(n); if (!k) return null; const cands = [k.replace(/(es|s)$/, ""), k + "s", k + "es"].filter((c) => c && c !== k); for (const c of cands) { const i = ALL_KEYS.indexOf(c); if (i >= 0) return ALL_NAMES[i]; } return null; };
  const tidyName = (n) => { n = String(n || "").replace(/\s+/g, " ").trim(); return n ? n[0].toUpperCase() + n.slice(1) : ""; };
  async function loadCustomNames() {
    if (!S.sb || !S.signedIn) return;
    const { data, error } = await S.sb.from("ft_exercises").select("name_key,name");
    if (error || !data) return;
    customNames.clear(); for (const r of data) customNames.set(r.name_key, r.name); refreshNames();
  }
  async function addCustomName(name) {
    name = tidyName(properName(name)); const k = squash(name); if (!k || knownName(name)) return true;   // "Triceps pushdown" is "Tricep pushdown": nothing to add
    if (!S.sb || !S.signedIn) return false;
    if (builtinKeys.has(k)) return unhideBuiltin(k);                 // a removed built-in added back
    const { error } = await S.sb.from("ft_exercises").upsert({ name_key: k, name });
    if (error) return false;
    customNames.set(k, name); refreshNames(); return true;
  }
  const looseKey = (x) => String(x || "").toLowerCase().replace(/-/g, " ").replace(/\s+/g, " ").trim();
  const ALIAS_LOOSE = {}; for (const o in ALIASES) ALIAS_LOOSE[looseKey(o)] = looseKey(ALIASES[o]);
  const VIDEO_LOOSE = new Map(); for (const k in VIDEOS) VIDEO_LOOSE.set(looseKey(k), VIDEOS[k]);

  // ---------- state ----------


  // ---- template drafts: editing a template changes nothing until "Save template"; a client's copy is always separate
  function draftFor(t) {
    if (S.clientMode || !isTemplateClient(t.clientId)) return null;
    if (!S.templateDraft || S.templateDraft.id !== t.id) S.templateDraft = { id: t.id, snapshot: JSON.stringify(t), dirty: false, saving: false };
    return S.templateDraft;
  }
  function paintDraftBar() {
    const d = S.templateDraft; const show = !!(d && d.dirty && S.view.name === "training" && S.view.id === d.id);
    $("draftBar").hidden = !show; document.body.classList.toggle("draft", show);
  }
  function saveDraft() {
    const d = S.templateDraft; if (!d) return;
    const t = trainings.get(d.id); if (!t) { S.templateDraft = null; paintDraftBar(); return; }
    d.dirty = false; d.saving = true; scheduleSave("trainings", d.id, 0); d.saving = false; d.snapshot = JSON.stringify(t);
    paintDraftBar(); const n = S.pendingGo; S.pendingGo = null; if (n) go(n);
  }
  function discardDraft() {
    const d = S.templateDraft; if (!d) return;
    if (trainings.has(d.id)) trainings.set(d.id, JSON.parse(d.snapshot));
    d.dirty = false; localBackend.save(); S.renderedTraining = null; paintDraftBar();
    const n = S.pendingGo; S.pendingGo = null; if (n) go(n); else render();
  }
  $("draftSave").addEventListener("click", saveDraft);
  $("draftDiscard").addEventListener("click", async () => { if (await askFirst({ title: "Discard the unsaved changes?", text: "The template stays as it was.", yes: "Discard" })) discardDraft(); });


  function setStatus() {
    const el = $("status");
    const pending = timers.size + S.inflight;
    if (S.deviceFull) { el.className = "err"; el.textContent = "Not saved on this device \u00b7 free up space"; return; }
    if (S.backend && S.backend !== localBackend && (S.offline || !navigator.onLine)) { el.className = ""; el.textContent = (dirty.size || pending) ? "Offline \u00b7 will sync" : "Offline \u00b7 showing your last sync"; return; }
    if (S.failed && pending === 0) { el.textContent = "Couldn't save" + (S.failReason ? " \u00b7 " + S.failReason : "") + (dirty.size ? " \u00b7 tap to retry" : ""); el.className = "err"; return; }
    el.className = "";
    el.textContent = pending > 0 ? "Saving\u2026" : (S.backend ? "Saved" : "");
  }
  $("status").addEventListener("click", () => { if (S.failed) { S.failed = false; for (const k of dirty.keys()) { const [kind, id] = k.split("/"); flushOne(kind, id); } setStatus(); } });


  // ---------- cloud (Supabase) ----------
  const SUPABASE_URL = "https://umurkxqswcjmubeucrzw.supabase.co";
  const SUPABASE_KEY = "sb_publishable__OG8G0RdJkERDqwV8xKN2Q_uwL1zY4p";
  const customVideos = new Map();        // loose exercise name -> YouTube id (trainer's own links)
  const customSubs = new Map();          // exercise key -> the subtitle he chose ("" = the whole name is the title); absent = the automatic split
  const subtitleFor = (name) => { const k = squash(name); return customSubs.has(k) ? customSubs.get(k) : null; };
  async function loadCustomSubs() {
    if (!S.sb || !S.signedIn) return;
    const { data, error } = await S.sb.from("ft_exercise_subtitles").select("name_key,subtitle");
    if (error || !data) return;
    customSubs.clear(); for (const r of data) customSubs.set(r.name_key, String(r.subtitle || ""));
  }
  async function saveSub(k, sub, oldKey) { const { error } = await S.sb.from("ft_exercise_subtitles").upsert({ name_key: k, subtitle: sub }); if (error) { lastDbError = error.message || ""; return error; } customSubs.set(k, sub); if (oldKey && oldKey !== k) await deleteSub([oldKey]); return null; }
  async function deleteSub(keys) { const { error } = await S.sb.from("ft_exercise_subtitles").delete().in("name_key", keys); if (error) { lastDbError = error.message || ""; return error; } for (const k of keys) customSubs.delete(k); return null; }
  const videoRawKeys = new Map();        // loose key -> Set of name_key values actually stored (old spellings included)
  const videoKeysFor = (k) => [...new Set([k, ...(videoRawKeys.get(k) || [])])];
  async function saveVideo(k, url, id) { const { error } = await S.sb.from("ft_exercise_videos").upsert({ name_key: k, url, video_id: id }); if (error) return error; const stale = videoKeysFor(k).filter((x) => x !== k); if (stale.length) await S.sb.from("ft_exercise_videos").delete().in("name_key", stale); customVideos.set(k, id); videoRawKeys.set(k, new Set([k])); return null; }
  async function deleteVideo(k) { const { error } = await S.sb.from("ft_exercise_videos").delete().in("name_key", videoKeysFor(k)); if (error) return error; customVideos.delete(k); videoRawKeys.delete(k); return null; }
  const looseName = (x) => String(x || "").toLowerCase().replace(/-/g, " ").replace(/\s+/g, " ").trim();
  const youtubeId = (url) => { const m = String(url || "").match(/(?:v=|youtu\.be\/|shorts\/|embed\/)([A-Za-z0-9_-]{11})/); return m ? m[1] : null; };
  async function loadCustomVideos() {
    if (!S.sb || !S.signedIn) return;
    const { data, error } = await S.sb.from("ft_exercise_videos").select("name_key,video_id");
    if (error || !data) return;
    customVideos.clear(); videoRawKeys.clear();
    for (const r of data) { const k = ALIAS_LOOSE[r.name_key] || r.name_key; customVideos.set(k, r.video_id); if (!videoRawKeys.has(k)) videoRawKeys.set(k, new Set()); videoRawKeys.get(k).add(r.name_key); } // links saved under an old spelling follow the rename
  }

  // ---- no signal: the device copy (saved after every successful sync) stands in until the server answers again
  function offlineFromMirror() {
    const me = [...clients.values()].find((c) => !isTemplateClient(c.id) && norm(c.email) === norm(S.sessionEmail));
    if (!me) return false;
    S.myClientId = me.id; S.offline = true;
    if (!(S.view.name === "training" && trainings.has(S.view.id))) S.view = { name: "client", id: S.myClientId };
    render(); setStatus(); return true;
  }
  function enterOffline(remembered) {     // no session could be read (token expired, no signal): use what the device knows
    S.offlineEntry = "remembered"; settingsOpen = false; S.signedIn = true; S.sessionEmail = remembered.email || ""; S.clientMode = remembered.role !== "trainer";
    document.body.classList.toggle("client", S.clientMode); S.backend = S.clientMode ? clientBackend : cloudBackend; hideAllViews();
    if (S.clientMode) { $("clientFoot").hidden = false; if (!offlineFromMirror()) showLogin("You\u2019re offline. Connect once to sign in."); return; }
    $("dataNote").textContent = "Synced to the cloud"; $("myExercises").hidden = false; $("packagesBtn").hidden = false; $("settingsBtn").hidden = false; $("localFoot").hidden = false;
    S.offline = true; render(); setStatus();
  }
  async function resumeOnline() {
    if (!S.sb || !S.signedIn || S.resuming) return; S.resuming = true;
    try {
      if (S.offlineEntry === "remembered") {                  // no session yet: get one, then enter normally (enterCloud flushes what is queued)
        const { data } = await S.sb.auth.getSession().catch(() => ({ data: null }));
        if (!(data && data.session) || S.offlineEntry !== "remembered" || S.entering) return;
        await enterCloud(data.session); return;
      }
      await syncDown();                                      // a quiet retry: the screen stays as it is; a success flushes the queue itself
    } finally { S.resuming = false; }
  }


  async function isTrainerAccount() {
    try {
      const { data, error } = await withTimeout(S.sb.from("trainers").select("email").limit(1), 4000);
      if (error) return null;              // unknown (offline, hiccup): let RLS decide
      return data.length > 0;
    } catch { return null; }
  }

  function hideAllViews() {
    rememberPage();                                                   // every page change passes here: the device remembers which settings page is up
    $("tabbar").hidden = true; document.body.classList.remove("tabs");
    for (const id of ["vLogin", "vSignup", "vPassword", "vExercises", "vPackages", "vSettings", "vNumber", "vRecovery", "vWaiting", "vCelebrate", "vClients", "vClient", "vTraining"]) $(id).hidden = true;
  }
  function showLogin(msg) {
    S.signedIn = false; S.clientMode = false; S.myClientId = null; document.body.classList.remove("client");
    $("clientFoot").hidden = true; $("localFoot").hidden = true; $("myExercises").hidden = true; $("packagesBtn").hidden = true; $("settingsBtn").hidden = true; settingsOpen = false; fromSettings = false;
    hideAllViews(); $("vLogin").hidden = false;
    $("back").hidden = true; $("brand").hidden = false; $("status").textContent = "";
    $("loginMsg").textContent = msg || "";
  }
  function showSignup() {
    hideAllViews(); $("vSignup").hidden = false; $("suForm").hidden = false; $("suDone").hidden = true; $("back").hidden = true; $("brand").hidden = false; $("status").textContent = "";
    $("suMsg").textContent = ""; $("suEmail").value = $("loginEmail").value.trim(); setTimeout(() => $("suName").focus(), 50);
  }
  let settingsOpen = false;              // false | "settings" | "password" | "exercises" | "packages" | "number"
  let fromSettings = false;              // number/password opened from the Settings list: Back returns there
  let pendingPage = null;                // the settings page that was open when the page was last refreshed: it comes back after sign-in
  const rememberPage = () => lsSet("fiala.trainings.page", settingsOpen ? { open: settingsOpen, from: !!fromSettings } : null);
  // ---- appearance: auto (follow the phone) | light | dark. Saved on this device only.
  const THEME_KEY = "fiala.theme";
  const themeColours = { light: "#f5f5f7", dark: "#000000" };
  function applyTheme(v) {
    v = v === "light" || v === "dark" ? v : "auto";
    if (v === "auto") document.documentElement.removeAttribute("data-theme"); else document.documentElement.setAttribute("data-theme", v);
    for (const m of document.querySelectorAll('meta[name="theme-color"]')) {
      if (m.dataset.media === undefined) m.dataset.media = m.getAttribute("media") || "";
      const isDark = /dark/.test(m.dataset.media);
      if (v === "auto") { m.setAttribute("media", m.dataset.media); m.content = isDark ? themeColours.dark : themeColours.light; }
      else { m.removeAttribute("media"); m.content = themeColours[v]; }
    }
    for (const b of $("themeSeg").querySelectorAll("button")) { b.classList.toggle("on", b.dataset.theme === v); b.setAttribute("aria-checked", b.dataset.theme === v ? "true" : "false"); }
  }
  applyTheme(lsGet(THEME_KEY));
  $("themeSeg").addEventListener("click", (e) => { const b = e.target.closest("button"); if (!b) return; lsSet(THEME_KEY, b.dataset.theme); applyTheme(b.dataset.theme); });
  function showSettings() {
    settingsOpen = "settings"; fromSettings = false; hideAllViews(); $("vSettings").hidden = false; $("back").hidden = false; $("backLabel").textContent = "Back"; $("brand").hidden = true; $("status").textContent = "";
    const p = trainerPhone(); $("setNumberVal").textContent = p || "Not set"; $("setEmail").textContent = S.sessionEmail || "";
  }
  function showNumber() {
    settingsOpen = "number"; hideAllViews(); $("vNumber").hidden = false; $("back").hidden = false; $("backLabel").textContent = fromSettings ? "Settings" : "Back"; $("brand").hidden = true; $("status").textContent = "";
    $("myPhone").value = trainerPhone(); $("myPhoneMsg").textContent = "";
  }
  // the trainer's number is copied onto every client row (that is what a client can read)
  const trainerPhone = () => { for (const c of clients.values()) if (!isTemplateClient(c.id) && c.trainerPhone) return c.trainerPhone; return lsGet("fiala.trainer.phone") || ""; };
  function setTrainerPhone(v) {
    v = String(v || "").trim(); lsSet("fiala.trainer.phone", v);
    for (const c of clients.values()) { if (isTemplateClient(c.id)) continue; if ((c.trainerPhone || "") !== v) { c.trainerPhone = v; scheduleSave("clients", c.id); } }
  }
  // ---------- packages: what he sells, kept on his own Templates record ----------
  const tplClient = () => { if (!clients.has(TEMPLATES_ID)) clients.set(TEMPLATES_ID, { id: TEMPLATES_ID, name: "Templates", notes: "", email: "", unit: "lb", createdAt: now(), kind: "templates" }); return clients.get(TEMPLATES_ID); };
  const packagesList = () => ((clients.get(TEMPLATES_ID) || {}).packages || []).filter((pk) => pk && pk.id);
  let packKind = "sessions", packInPerson = false, packEdit = null;   // the form: a new package, or (packEdit = id) one being edited
  const packageOf = (c) => (c && c.plan && c.plan.id ? packagesList().find((pk) => pk.id === c.plan.id) : null) || null;
  function showPackages() {
    settingsOpen = "packages"; hideAllViews(); $("vPackages").hidden = false; $("back").hidden = false; $("backLabel").textContent = fromSettings ? "Settings" : "Back"; $("brand").hidden = true; $("status").textContent = "";
    renderPackages();
  }
  function renderPackages() {
    const ul = $("packList"); ul.replaceChildren();
    for (const pk of packagesList()) {
      const li = document.createElement("li"); li.className = "pack-row"; li.classList.toggle("editing", packEdit === pk.id);
      const left = document.createElement("div"); const name = document.createElement("div"); name.textContent = pk.name;
      const sub = document.createElement("div"); sub.className = "sub";
      const what = pk.kind === "monthly" ? "4-week plan" : pk.size + (pk.size === 1 ? " session" : " sessions");
      sub.textContent = [what.toLowerCase() === String(pk.name || "").toLowerCase() ? "" : what, pk.inPerson ? "In person" : ""].filter(Boolean).join(" \u00b7 "); sub.hidden = !sub.textContent;
      left.append(name, sub);
      const del = document.createElement("button"); del.type = "button"; del.className = "del"; del.textContent = "Delete";
      del.addEventListener("click", async (e) => { e.stopPropagation(); if (!(await askFirst({ title: "Delete \u201c" + pk.name + "\u201d?", text: "Clients already on it keep their package. It just cannot be picked again." }))) return; const tc = tplClient(); tc.packages = packagesList().filter((x) => x.id !== pk.id); planTouched.add(tc.id); scheduleSave("clients", tc.id); if (packEdit === pk.id) packFormReset(); renderPackages(); });
      li.addEventListener("click", () => { packEdit = pk.id; packKind = pk.kind === "monthly" ? "monthly" : "sessions"; packInPerson = !!pk.inPerson; $("packName").value = pk.name || ""; $("packSize").value = pk.size || ""; renderPackages(); $("packForm").scrollIntoView({ block: "nearest", behavior: "smooth" }); });   // tap a package: the form edits it
      li.append(left, del); ul.appendChild(li);
    }
    const editing = packEdit ? packagesList().find((pk) => pk.id === packEdit) : null; if (packEdit && !editing) packEdit = null;
    $("packFormCap").textContent = editing ? "Editing \u201c" + editing.name + "\u201d" : "New package";
    $("packAdd").textContent = editing ? "Save changes" : "Add package"; $("packCancel").hidden = !editing;
    $("packSizeRow").hidden = packKind !== "sessions";
    for (const b of $("packKind").querySelectorAll("button")) b.classList.toggle("on", b.dataset.kind === packKind);
    for (const b of $("packInPerson").querySelectorAll("button")) b.classList.toggle("on", (b.dataset.on === "1") === packInPerson);
  }
  const packFormReset = () => { packEdit = null; packKind = "sessions"; packInPerson = false; $("packName").value = ""; $("packSize").value = ""; };
  $("packagesBtn").addEventListener("click", () => { fromSettings = true; showPackages(); });   // from the Settings list: Back returns there
  $("packKind").addEventListener("click", (e) => { const b = e.target.closest("button"); if (!b) return; packKind = b.dataset.kind; renderPackages(); });
  $("packInPerson").addEventListener("click", (e) => { const b = e.target.closest("button"); if (!b) return; packInPerson = b.dataset.on === "1"; renderPackages(); });
  $("packCancel").addEventListener("click", () => { packFormReset(); renderPackages(); });
  $("packAdd").addEventListener("click", () => {
    const size = clamp(parseInt($("packSize").value, 10) || 0, 0, 200);
    if (packKind === "sessions" && !size) { $("packSize").focus(); return; }
    const name = String($("packName").value || "").trim() || (packKind === "monthly" ? "4-week plan" : size + " sessions");
    if (packagesList().some((pk) => pk.id !== packEdit && pk.name.toLowerCase() === name.toLowerCase())) { $("packName").value = name; $("packName").focus(); $("packName").select(); return; }   // one of each name
    const tc = tplClient(); const next = { name, kind: packKind, size: packKind === "sessions" ? size : null, inPerson: packInPerson };
    if (packEdit) {
      tc.packages = packagesList().map((pk) => (pk.id === packEdit ? { ...pk, ...next } : pk));
      for (const c of clients.values()) {                                              // clients on it see the new name and size on their card
        if (!c.plan || c.plan.id !== packEdit || isTemplateClient(c.id)) continue;
        c.plan = { ...c.plan, name, kind: next.kind, size: next.size }; planTouched.add(c.id); scheduleSave("clients", c.id);
      }
    } else tc.packages = [...packagesList(), { id: uid(), ...next }];
    planTouched.add(tc.id); scheduleSave("clients", tc.id);
    packFormReset(); renderPackages();
  });
  // a client's plan: picked in Details; the card on the page shows where it stands
  const effPaused = (c) => !!c && (!!c.paused || !planActive(c.plan, today()));            // paused by hand, or a monthly plan past its day
  function paintPlanDetails(c) {
    const sel = $("planSel"), cur = c.plan && c.plan.id ? c.plan.id : "";
    const opts = [["", "None"], ...packagesList().map((pk) => [pk.id, pk.name])];
    if (cur && !opts.some(([id]) => id === cur)) opts.push([cur, c.plan.name || "Package"]);      // a package deleted since: still named
    sel.replaceChildren(...opts.map(([v, label]) => { const o = document.createElement("option"); o.value = v; o.textContent = label; return o; })); sel.value = cur;
    const monthly = !!(c.plan && c.plan.kind === "monthly"); $("planUntilRow").hidden = !monthly;
    if (monthly && document.activeElement !== $("planUntil")) $("planUntil").value = c.plan.until || "";
  }
  let planEdit = null;                                               // { clientId, adjust }: the correction being tried on the card, until Save
  function renderPlanCard(c) {
    const card = $("planCard"), plan0 = c.plan && c.plan.id ? c.plan : null; card.hidden = !plan0; if (!plan0) { planEdit = null; return; }
    if (planEdit && planEdit.clientId !== c.id) planEdit = null;
    const plan = planEdit ? { ...plan0, adjust: planEdit.adjust } : plan0;
    $("planChange").hidden = !!planEdit; $("planSteps").hidden = !planEdit; $("planActions").hidden = !planEdit || S.clientMode;
    const bar = $("planBar"), big = $("planBig"), small = $("planSmall"), adj = $("planAdjust"); big.classList.remove("over");
    if (plan.kind === "monthly") {
      const active = planActive(plan, today());
      $("planName").textContent = plan.name || "4-week plan"; $("planRight").textContent = ""; bar.hidden = true; adj.hidden = true;
      big.textContent = plan.until ? (active ? "Until " + fmtDay(plan.until) : "Ended " + fmtDay(plan.until)) : "Active"; big.classList.toggle("over", !active);
      small.textContent = active ? (S.clientMode ? "Your plan is active." : "Tap to change the date") : (S.clientMode ? "" : "Their workouts are on hold until you extend it");
      return;
    }
    const pr = planProgress(plan, clientTrainings(c.id)); if (!pr) { card.hidden = true; return; }
    $("planName").textContent = plan.name || pr.size + " sessions"; $("planRight").textContent = pr.packNo > 1 ? "Package " + pr.packNo : "";
    bar.hidden = false; bar.classList.toggle("cont", pr.size > 24); bar.replaceChildren();
    if (pr.size > 24) { const i = document.createElement("i"); i.style.width = Math.round(100 * pr.inPack / pr.size) + "%"; bar.appendChild(i); }
    else for (let k = 1; k <= pr.size; k++) { const i = document.createElement("i"); if (k <= pr.inPack) i.className = "on"; else if (k === pr.inPack + 1) i.className = "next"; bar.appendChild(i); }
    big.textContent = pr.inPack + " of " + pr.size;
    small.textContent = pr.complete ? "Package complete \u00b7 the next session starts a new one" : pr.left + (pr.left === 1 ? " session left" : " sessions left");
    adj.hidden = S.clientMode;
  }
  $("planCard").addEventListener("keydown", (e) => { if ((e.key === "Enter" || e.key === " ") && e.target === e.currentTarget) { e.preventDefault(); e.currentTarget.click(); } });
  $("planCard").addEventListener("click", (e) => {
    const c = clients.get(S.view.id); if (!c || S.clientMode || !c.plan) return;
    if (e.target.closest("#planChange")) { planEdit = { clientId: c.id, adjust: parseInt(c.plan.adjust, 10) || 0 }; renderClient(); return; }           // the one knob for mistakes: shown on request, kept only on Save
    const step = e.target.closest(".step"); if (step && planEdit) { planEdit.adjust += step.id === "planPlus" ? 1 : -1; renderClient(); return; }
    if (e.target.closest("#planCancel")) { planEdit = null; renderClient(); return; }
    if (e.target.closest("#planSave")) { c.plan.adjust = planEdit ? planEdit.adjust : c.plan.adjust; planEdit = null; planTouched.add(c.id); scheduleSave("clients", c.id); renderClient(); return; }
    if (e.target.closest(".plan-adjust, .plan-actions")) return;
    detailsOpen = true; S.tab = "profile"; render(); $("detailsBody").scrollIntoView({ block: "nearest", behavior: "smooth" });
  });
  $("planSel").addEventListener("change", (e) => {
    const c = clients.get(S.view.id); if (!c || isTemplateClient(c.id)) return;
    const id = e.target.value; if ((c.plan && c.plan.id ? c.plan.id : "") === id) return;
    const pk = packagesList().find((x) => x.id === id), carry = !!(pk && c.plan && c.plan.kind === "sessions" && pk.kind === "sessions");   // 10 -> 20, or a mis-pick put right: the sessions already used carry over
    if (c.plan && c.plan.id && !carry) c.planHistory = [...(c.planHistory || []), { ...c.plan, endedOn: today() }].slice(-20);   // what they were on before stays on record
    c.plan = pk ? { id: pk.id, name: pk.name, kind: pk.kind, size: pk.size || null, startedOn: carry ? c.plan.startedOn : today(), adjust: carry ? (parseInt(c.plan.adjust, 10) || 0) : 0, ...(pk.kind === "monthly" ? { until: daysLater(today(), 28) } : {}) } : null;
    planTouched.add(c.id); scheduleSave("clients", c.id); renderClient();
  });
  $("planUntil").addEventListener("change", (e) => { const c = clients.get(S.view.id); if (!c || !c.plan || c.plan.kind !== "monthly" || !/^\d{4}-\d{2}-\d{2}$/.test(e.target.value)) return; c.plan.until = e.target.value; planTouched.add(c.id); scheduleSave("clients", c.id); renderClient(); });
  $("planMonth").addEventListener("click", () => { const c = clients.get(S.view.id); if (!c || !c.plan || c.plan.kind !== "monthly") return; c.plan.until = daysLater(c.plan.until && c.plan.until > today() ? c.plan.until : today(), 28); planTouched.add(c.id); scheduleSave("clients", c.id); renderClient(); });
  // the workout: "In person" counts toward the package; the client reads "Session 3 of 10"
  function paintSessionPill(t, asClient) {
    const pill = $("sessionPill"), c = clients.get(t.clientId);
    const row = $("sessionRow"); const show = (v) => { pill.hidden = !v; row.hidden = !v; };
    if (isTemplateClient(t.clientId)) { show(false); return; }
    const plan = c && c.plan && c.plan.kind === "sessions" ? c.plan : null, sn = plan ? sessionNo(plan, clientTrainings(t.clientId), t) : null;
    if (asClient) {                                                     // the client reads it: words on the left, the package as a thin bar on the right
      show(!!sn); pill.classList.add("on"); if (!sn) return;
      const bar = sn.size <= 24 ? '<span class="mini-bar">' + Array.from({ length: sn.size }, (_, i) => "<i" + (i < sn.n ? ' class="on"' : "") + "></i>").join("") + "</span>" : "";
      pill.innerHTML = "<span></span>" + bar; pill.firstChild.textContent = "Session " + sn.n + " of " + sn.size; return;
    }
    show(true); pill.classList.toggle("on", !!t.inPerson);
    pill.innerHTML = "<i>\u2713</i><span></span>"; pill.lastChild.textContent = t.inPerson && sn ? "In person \u00b7 " + sn.n + " of " + sn.size : "In person";
  }
  $("sessionPill").addEventListener("click", () => { const t = trainings.get(S.view.id); if (!t || S.clientMode || isTemplateClient(t.clientId)) return; t.inPerson = !t.inPerson; if (!t.inPerson) delete t.inPerson; touchState(t.id, "inPerson"); scheduleSave("trainings", t.id); S.renderedTraining = null; render(); });
  function showExercises() {
    settingsOpen = "exercises"; hideAllViews(); $("vExercises").hidden = false; $("back").hidden = false; $("backLabel").textContent = fromSettings ? "Settings" : "Back"; $("brand").hidden = true; $("status").textContent = "";
    exShown = 80; exOpenKey = null; renderExercises();
  }
  const videoForName = (name) => { const s = String(name || "").trim(); if (!s) return null; const l = looseKey(ALIASES[s] || s); if (customVideos.has(looseKey(s))) return customVideos.get(looseKey(s)); if (customVideos.has(l)) return customVideos.get(l); return VIDEOS[s] || VIDEO_LOOSE.get(l) || null; };
  let exShown = 80, exOpenKey = null;
  function exerciseMatches(q) {
    const s = squash(q);
    const all = ALL_NAMES.map((n, i) => [n, ALL_KEYS[i]]);
    if (!s) return all.sort((x, y) => x[0].localeCompare(y[0]));
    const exact = [], starts = [], contains = [];
    for (const [n, k] of all) { if (k === s) exact.push([n, k]); else if (k.startsWith(s)) starts.push([n, k]); else if (k.includes(s)) contains.push([n, k]); }
    starts.sort((x, y) => x[0].length - y[0].length || x[0].localeCompare(y[0])); contains.sort((x, y) => x[0].localeCompare(y[0]));
    const extra = aliasFinds(s, [...exact, ...starts, ...contains].map((x) => x[0])).map((n) => [n, squash(n)]);
    return exact.concat(starts, contains, extra);
  }
  function renderExercises() {
    const q = $("exSearch").value; const hits = exerciseMatches(q); const s = squash(q);
    const ul = $("exList"); ul.replaceChildren();
    $("exCount").textContent = s ? (hits.length ? hits.length + (hits.length === 1 ? " match" : " matches") : "No matches") : ALL_NAMES.length.toLocaleString() + " exercises";
    for (const [name, key] of hits.slice(0, exShown)) ul.appendChild(exerciseRow(name, key));
    $("exMore").hidden = hits.length <= exShown;
    const canAdd = s.length >= 2 && !hits.some(([, k]) => k === s) && !knownName(q) && (hits.length === 0 || q.trim().split(/\s+/).length >= 2);   // an old spelling of a listed exercise is not a new exercise
    $("exEmpty").hidden = !canAdd;
    const near = canAdd ? nearName(q) : null;
    if (near) { $("exEmpty").innerHTML = ""; const b = document.createElement("button"); b.type = "button"; b.className = "btn tint"; b.textContent = "Did you mean “" + near + "”?"; b.addEventListener("click", () => { $("exSearch").value = near; exShown = 80; exOpenKey = null; renderExercises(); }); $("exEmpty").appendChild(b); }
    else if (canAdd) { $("exEmpty").innerHTML = ""; const b = document.createElement("button"); b.type = "button"; b.className = "btn tint"; b.textContent = "Add “" + tidyName(q) + "” to the database"; b.addEventListener("click", async () => { b.disabled = true; const ok = await addCustomName(q); if (!ok) { b.disabled = false; $("status").textContent = "Couldn’t add · run supabase/exercises.sql, or try again online"; return; } $("exSearch").value = tidyName(q); renderExercises(); }); $("exEmpty").appendChild(b); }
  }
  function exerciseRow(name, key) {
    const li = document.createElement("li"); li.dataset.key = key;
    const b = document.createElement("button"); b.type = "button";
    const mine = customNames.has(key); const vid = videoForName(name);
    const pri = document.createElement("span"); pri.className = "pri"; const parts = splitName(name, subtitleFor(name)); pri.textContent = parts.title;
    if (parts.sub) { const st = document.createElement("span"); st.className = "subt"; st.textContent = parts.sub; pri.appendChild(st); }
    const sec = document.createElement("span"); sec.className = "sec"; sec.innerHTML = (vid ? '<span class="dot">▶ video</span>' : "") + (vid && mine ? " · " : "") + (mine ? "yours" : "");
    const left = document.createElement("span"); left.style.minWidth = "0"; left.append(pri); if (sec.innerHTML) left.append(sec);
    const chev = document.createElement("span"); chev.className = "chev"; chev.textContent = "›";
    b.append(left, chev);
    const detail = document.createElement("div"); detail.className = "exdetail"; detail.hidden = key !== exOpenKey;
    li.classList.toggle("open", key === exOpenKey);
    if (!detail.hidden) buildExerciseDetail(detail, name, key);
    b.addEventListener("click", () => {
      const was = exOpenKey === key; const ul = $("exList");
      const prev = ul.querySelector("li.open"); if (prev) { prev.classList.remove("open"); const d = prev.querySelector(".exdetail"); d.hidden = true; d.replaceChildren(); }
      exOpenKey = was ? null : key;
      if (!was) { li.classList.add("open"); buildExerciseDetail(detail, name, key); detail.hidden = false; li.scrollIntoView({ block: "nearest" }); }
    });
    li.append(b, detail); return li;
  }
  const mkBtn = (text, cls, fn) => { const x = document.createElement("button"); x.type = "button"; x.className = cls; x.textContent = text; x.addEventListener("click", fn); return x; };
  function buildExerciseDetail(box, name, key) {                               // tapped open: watch the video, or Edit
    box.replaceChildren(); box.classList.remove("editing");
    const vid = videoForName(name);
    const player = document.createElement("div"); player.className = "player"; player.hidden = true;
    const actions = document.createElement("div"); actions.className = "row-actions";
    if (vid) actions.appendChild(mkBtn("\u25b6 Watch video", "btn tint", () => { if (!player.hidden) { player.hidden = true; player.replaceChildren(); return; } player.replaceChildren(); const f = document.createElement("iframe"); f.src = "https://www.youtube-nocookie.com/embed/" + vid + "?playsinline=1&rel=0&modestbranding=1"; f.allow = "accelerometer; encrypted-media; picture-in-picture"; f.allowFullscreen = true; player.appendChild(f); player.hidden = false; }));
    actions.appendChild(mkBtn("Edit", "btn tint", () => buildExerciseEditor(box, name, key)));
    box.append(player, actions);
  }
  function buildExerciseEditor(box, name, key) {                               // everything about one exercise, then Save changes or Discard
    box.replaceChildren(); box.classList.add("editing");
    const vid = videoForName(name);
    const field = (label, inp) => { const w = document.createElement("div"); w.className = "edit-field"; const c = document.createElement("span"); c.className = "cap"; c.textContent = label; w.append(c, inp); return w; };
    const nameInp = document.createElement("input"); nameInp.value = name; nameInp.placeholder = "Name"; nameInp.setAttribute("autocapitalize", "sentences"); nameInp.setAttribute("autocomplete", "off");
    const url = document.createElement("input"); url.type = "url"; url.placeholder = "Paste a YouTube link"; url.value = vid ? "https://youtu.be/" + vid : ""; url.setAttribute("autocomplete", "off"); url.setAttribute("autocapitalize", "none"); url.inputMode = "url";
    const subInp = document.createElement("input"); subInp.placeholder = "None"; subInp.setAttribute("autocapitalize", "none"); subInp.setAttribute("autocomplete", "off");   // the ending of the name the client sees as a second, smaller line
    const chosenSub = customSubs.has(key) ? customSubs.get(key) : null; subInp.value = chosenSub == null ? autoSubtitle(name) : chosenSub;
    const subHint = document.createElement("span"); subHint.className = "hint";
    const paintSubHint = () => { const nm = nameInp.value.trim(), want = subInp.value.trim(), { title, sub } = splitName(nm, want); subHint.textContent = sub ? "Clients see \u201c" + title + "\u201d with \u201c" + sub + "\u201d under it" : want ? "The subtitle has to be the end of the name" : "Clients see the whole name on one line"; };
    for (const i of [nameInp, subInp]) i.addEventListener("input", paintSubHint); paintSubHint();
    for (const i of [nameInp, subInp, url]) i.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); i.blur(); } });
    const vidRow = document.createElement("div"); vidRow.className = "row-actions";
    const rmVid = mkBtn("Remove video", "btn tint danger", () => { url.value = ""; rmVid.hidden = true; }); rmVid.hidden = !vid;
    url.addEventListener("input", () => { rmVid.hidden = !url.value.trim(); });
    vidRow.appendChild(rmVid);
    const del = mkBtn("Delete exercise", "btn tint danger", async () => {
      if (!(await askFirst({ title: "Delete \u201c" + name + "\u201d from the database?", text: (videoForName(name) ? "Its video goes with it. " : "") + "Workouts that use it keep the name.", yes: "Delete" }))) return;
      const ok = await deleteExercise(key, name); if (!ok) { $("status").textContent = missingTable() ? "Run the Supabase script first (it is on your clipboard)" : "Couldn\u2019t delete \u00b7 try again online"; return; }
      exOpenKey = null; setStatus(); renderExercises();
    });
    const delRow = document.createElement("div"); delRow.className = "row-actions"; delRow.appendChild(del);
    const foot = document.createElement("div"); foot.className = "edit-foot";
    const save = mkBtn("Save changes", "btn sm", async () => {
      const nn = tidyName(properName(nameInp.value)), link = url.value.trim();   // an old spelling means the exercise it names
      if (!nn || !squash(nn)) { $("status").textContent = "Give it a name"; return; }
      if (link && !youtubeId(link)) { $("status").textContent = "That doesn\u2019t look like a YouTube link"; return; }
      if (nn !== name && squash(nn) !== key && knownName(nn)) { $("status").textContent = "There is already an exercise called \u201c" + nn + "\u201d"; return; }
      const wantSub = subInp.value.trim(); if (wantSub && !splitName(nn, wantSub).sub) { $("status").textContent = "The subtitle has to be the end of the name"; return; }
      save.disabled = true;
      let cur = name;
      if (nn !== name) { const ok = await renameExercise(key, name, nn); if (!ok) { save.disabled = false; $("status").textContent = missingTable() ? "Run the Supabase script first (it is on your clipboard)" : "Couldn\u2019t rename \u00b7 try again online"; return; } cur = nn; }
      const vkey = looseKey(cur), had = videoForName(cur), id = link ? youtubeId(link) : null;
      let videoError = null;
      if (!link && had) videoError = await saveVideo(vkey, "", "");                                   // an empty link stored = no video, the built-in one included
      else if (id && id !== had) videoError = await saveVideo(vkey, link, id);
      const nk2 = squash(cur); let subError = null;                                                   // the subtitle: his choice stored only when it differs from the automatic split
      if (wantSub === autoSubtitle(cur)) { const gone = [nk2, key].filter((k, i, arr) => customSubs.has(k) && arr.indexOf(k) === i); if (gone.length) subError = await deleteSub(gone); }
      else subError = await saveSub(nk2, wantSub, key);
      exOpenKey = nk2; renderExercises();                                                              // the list shows what stands, rename included, before any complaint
      if (subError) { $("status").textContent = /ft_exercise_subtitles/.test(subError.message || "") ? "Run the Supabase script first (it is on your clipboard)" : "Couldn\u2019t save the subtitle"; return; }
      if (videoError) { $("status").textContent = /ft_exercise_videos/.test(videoError.message || "") ? "Run the Supabase script first (it is on your clipboard)" : "Couldn\u2019t save the video"; return; }
      setStatus();
    });
    foot.append(save, mkBtn("Discard", "btn quiet", () => buildExerciseDetail(box, name, key)));
    const subField = field("Subtitle", subInp); subField.appendChild(subHint);
    box.append(field("Name", nameInp), subField, field("Video", url), vidRow, delRow, foot);
    nameInp.focus({ preventScroll: true });
  }
  $("exSearch").addEventListener("input", () => { exShown = 80; exOpenKey = null; renderExercises(); });
  $("exMore").addEventListener("click", () => { const hits = exerciseMatches($("exSearch").value); const ul = $("exList"); for (const [name, key] of hits.slice(exShown, exShown + 80)) ul.appendChild(exerciseRow(name, key)); exShown += 80; $("exMore").hidden = hits.length <= exShown; });
  $("exSearch").addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); e.target.blur(); } });
  async function removeCustom(k) {
    if (!S.sb || !S.signedIn) return false;
    const old = customNames.get(k);
    const { error } = await S.sb.from("ft_exercises").delete().eq("name_key", k); if (error) return false;
    customNames.delete(k); refreshNames();
    if (old && customVideos.has(looseKey(old))) await deleteVideo(looseKey(old));
    return true;
  }
  const renameInWorkouts = (old, newName) => {                                 // workouts and templates that use the old name, in any of its spellings, follow the rename
    const canon = (x) => squash(properName(x)), ok = canon(old);
    for (const t of trainings.values()) {
      let touched = false;
      for (const r of t.rows || []) { if (canon(r.name) === ok && r.name !== newName) { r.name = newName; touched = true; } if (Array.isArray(r.alts) && r.alts.some((a) => canon(a) === ok)) { r.alts = r.alts.map((a) => (canon(a) === ok ? newName : a)); touched = true; } }
      if (touched) scheduleSave("trainings", t.id);
    }
  };
  async function moveVideo(oldName, newName) {                                 // the video follows the name: his link, or the built-in one (a "no video" marker stays behind)
    const ov = looseKey(oldName), nv = looseKey(newName); if (ov === nv) return null;
    const id = customVideos.has(ov) ? customVideos.get(ov) : (VIDEOS[oldName] || VIDEO_LOOSE.get(looseKey(ALIASES[oldName] || oldName)) || null);
    if (!id) { if (customVideos.has(ov)) await deleteVideo(ov); return null; }
    const e = await saveVideo(nv, "https://youtu.be/" + id, id); if (e) return e;
    if (customVideos.has(ov)) await deleteVideo(ov);
    return null;
  }
  async function renameExercise(key, oldName, newName) {
    const nk = squash(newName); if (!nk || !S.sb || !S.signedIn) return false;
    if (customNames.has(key)) {                                                // his own exercise, or his spelling of a built-in
      const ok = await renameCustom(key, newName); if (!ok) return false;
      if (nk !== key && builtinKeys.has(key) && !(await hideBuiltin(key))) return false;   // the built-in under his old spelling must not come back
      if (nk !== key && builtinKeys.has(nk) && !(await unhideBuiltin(nk))) return false;
      renameInWorkouts(oldName, newName); return true;
    }
    if (nk !== key && !(await hideBuiltin(key))) return false;                 // the name first: nothing else moves until the built-in spelling has stepped aside
    if (nk !== key && builtinKeys.has(nk)) { if (!(await unhideBuiltin(nk))) return false; }   // onto another built-in's spelling: merge into it
    else { const { error } = await S.sb.from("ft_exercises").upsert({ name_key: nk, name: newName }); if (error) { lastDbError = error.message || ""; return false; } customNames.set(nk, newName); refreshNames(); }   // his spelling (same key or a new one) is a custom row
    const e = await moveVideo(oldName, newName); if (e) lastDbError = e.message || "";   // the video follows; if it cannot, the rename still stands
    renameInWorkouts(oldName, newName); return true;
  }
  async function deleteExercise(key, name) {
    if (!S.sb || !S.signedIn) return false;
    if (customNames.has(key)) { const ok = await removeCustom(key); return ok && (!builtinKeys.has(key) || await hideBuiltin(key)); }
    if (!(await hideBuiltin(key))) return false;
    if (customVideos.has(looseKey(name))) await deleteVideo(looseKey(name));
    return true;
  }
  async function renameCustom(k, newName) {
    const old = customNames.get(k); const nk = squash(newName);
    if (!nk || !S.sb || !S.signedIn) return false;
    const ov = looseKey(old), nv = looseKey(newName);
    if (ov !== nv && customVideos.has(ov)) { const id = customVideos.get(ov); const e1 = await saveVideo(nv, "https://youtu.be/" + id, id); if (e1) return false; await deleteVideo(ov); }   // the video follows the name
    if (nk !== k && !builtinKeys.has(nk) && !customNames.has(nk)) { const { error } = await S.sb.from("ft_exercises").upsert({ name_key: nk, name: newName }); if (error) return false; customNames.set(nk, newName); }
    else if (nk === k) { const { error } = await S.sb.from("ft_exercises").update({ name: newName }).eq("name_key", k); if (error) return false; customNames.set(k, newName); }
    if (nk !== k) { const ok = await removeCustom(k); if (!ok) return false; }
    refreshNames(); renameInWorkouts(old, newName);
    return true;
  }
  let pwTimer = 0;
  function showPassword() {
    clearTimeout(pwTimer); settingsOpen = "password"; hideAllViews(); $("vPassword").hidden = false; $("back").hidden = false; $("backLabel").textContent = fromSettings ? "Settings" : "Back"; $("brand").hidden = true;
    $("pwMsg").textContent = ""; $("pwNew").value = ""; $("pwNew2").value = ""; $("pwBtn").disabled = false; $("pwUser").value = S.sessionEmail; $("status").textContent = "";
  }
  function showRecovery() {
    hideAllViews(); $("vRecovery").hidden = false; $("recoveryBtn").disabled = false;
    if (S.sb) S.sb.auth.getUser().then(({ data }) => { $("recoveryUser").value = (data && data.user && data.user.email) || ""; }).catch(() => {}); $("back").hidden = true; $("brand").hidden = false; $("status").textContent = "";
  }
  function showProblem(text) {
    settingsOpen = false; hideAllViews(); $("vWaiting").hidden = false; $("back").hidden = true; $("brand").hidden = false; $("status").textContent = "";
    $("waitingText").textContent = text;
  }
  function showWaiting() {
    showProblem("Your account is ready, but " + (S.sessionEmail || "your email") + " is not linked to a client profile yet. Ask Michal to add this email to your profile, then tap Try again.");
  }

  async function enterCloud(session) {
    if (S.entering) return; S.entering = true;
    try { await enterCloudNow(session); } finally { S.entering = false; }
  }
  async function enterCloudNow(session) {
    const quiet = S.clientMode && S.offline && !!S.myClientId;    // the device copy is already on screen: swap in live data without a blank "Loading…"
    settingsOpen = quiet ? settingsOpen : false;
    S.signedIn = true; S.sessionEmail = session.user.email || "";
    let trainer = await isTrainerAccount();
    const remembered = lsGet("fiala.trainings.role");
    if (trainer === null) {
      if (remembered && remembered.email === S.sessionEmail) trainer = remembered.role === "trainer";
      else { S.offline = true; S.offlineEntry = "remembered"; showProblem("Couldn\u2019t reach the server \u00b7 check your signal and tap Try again"); return; }   // resumeOnline retries the entry
    } else lsSet("fiala.trainings.role", { email: S.sessionEmail, role: trainer ? "trainer" : "client" });
    S.offlineEntry = null;
    if (S.pendingOwner && S.pendingOwner !== S.sessionEmail) {       // the queue belongs to whoever signed in last; another account starts clean
      dirty.clear(); pendingWeightRows.clear(); pendingDoneRows.clear(); pendingEarlyRows.clear(); pendingFinish.clear(); pendingSkip.clear(); pendingMove.clear(); pendingMiss.clear(); pendingSwap.clear(); trainerTouched.clear(); trainerNamed.clear();
    }
    S.pendingOwner = S.sessionEmail; persistPending();
    S.clientMode = trainer !== true;
    document.body.classList.toggle("client", S.clientMode);
    S.backend = S.clientMode ? clientBackend : cloudBackend;
    if (!quiet) hideAllViews();
    if (S.clientMode) {
      for (const id of [...clients.keys()]) if (isTemplateClient(id) || norm(clients.get(id).email) !== norm(S.sessionEmail)) clients.delete(id);   // the device copy may belong to someone else
      const mineIds = new Set(clients.keys()); for (const id of [...trainings.keys()]) if (!mineIds.has(trainings.get(id).clientId)) trainings.delete(id);
      $("clientFoot").hidden = false;
      if (!quiet) $("status").textContent = "Loading\u2026";
      await syncDown();                                       // a success flushes the queue itself
      setStatus();
      return;
    }
    $("dataNote").textContent = "Synced to the cloud";
    $("myExercises").hidden = false; $("packagesBtn").hidden = false; $("settingsBtn").hidden = false; $("localFoot").hidden = false; $("clientFoot").hidden = true;
    render(); setStatus();
    await syncDown();                                         // a success flushes the queue itself
    seedTemplates().catch(() => {});
  }

  const hasAuthToken = () => { try { return !!localStorage.getItem("sb-umurkxqswcjmubeucrzw-auth-token"); } catch { return false; } };
  // flaky phone connections: retry a request that never reached the server (up to 3 tries)
  async function withRetry(task) {
    let last;
    for (let i = 0; i < 3; i++) {
      try { const res = await task(); if (!res.error || !isNetwork(res.error)) return res; last = res; }
      catch (e) { last = { data: null, error: e }; if (!isNetwork(e)) return last; }
      await new Promise((r) => setTimeout(r, 900 * (i + 1)));
    }
    return last;
  }
  const friendly = (error) => {
    if (isNetwork(error)) return "Couldn\u2019t reach the server. Check your connection \u2014 try turning Wi-Fi off \u2014 and tap again.";
    const m = (error && error.message) || "";
    if (/email not confirmed/i.test(m)) return "Tap the link in the email we sent you first, then sign in.";
    if (/invalid login credentials/i.test(m)) return "Wrong email or password.";
    if (/different from the old/i.test(m)) return "That\u2019s already your password \u2014 choose a new one.";
    if (/security purposes|rate limit|after \d+ seconds/i.test(m)) return "Please wait a minute and try again.";
    return m || "Something went wrong. Please try again.";
  };
  $("loginForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    $("loginMsg").textContent = "Signing in…"; $("loginBtn").disabled = true;
    const { data, error } = await withRetry(() => S.sb.auth.signInWithPassword({ email: $("loginEmail").value.trim(), password: $("loginPassword").value }));
    $("loginBtn").disabled = false;
    if (error) { $("loginMsg").textContent = friendly(error); return; }
    $("loginMsg").textContent = "";
    await enterCloud(data.session);
  });
  $("createBtn").addEventListener("click", showSignup);
  $("suBack").addEventListener("click", () => showLogin(""));
  $("suDoneBtn").addEventListener("click", () => showLogin(""));
  $("signupForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = $("suName").value.trim(), email = $("suEmail").value.trim().toLowerCase(), phone = $("suPhone").value.trim();
    const password = $("suPassword").value, again = $("suPassword2").value; const msg = $("suMsg");
    if (!name) { msg.textContent = "Please enter your name."; $("suName").focus(); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { msg.textContent = "That email doesn\u2019t look right."; $("suEmail").focus(); return; }
    if (phone.replace(/\D/g, "").length < 7) { msg.textContent = "Please enter your phone number."; $("suPhone").focus(); return; }
    if (password.length < 8) { msg.textContent = "Use a password of at least 8 characters."; $("suPassword").focus(); return; }
    if (password !== again) { msg.textContent = "The two passwords don\u2019t match."; $("suPassword2").focus(); $("suPassword2").select(); return; }
    msg.textContent = "Creating your account\u2026"; $("suBtn").disabled = true;
    let res; try { res = await S.sb.auth.signUp({ email, password, options: { data: { name, phone }, emailRedirectTo: location.origin + location.pathname } }); } catch (err) { res = { data: {}, error: err }; }
    const { data, error } = res;
    $("suBtn").disabled = false;
    const sent = () => { $("loginEmail").value = email; $("suForm").hidden = true; $("suDone").hidden = false; $("suDoneText").textContent = "We sent a confirmation link to " + email + ". Open it on this phone, then come back here and sign in with your new password. Not there after a minute? Check Spam."; };
    if (error && /security purposes|rate limit/i.test(error.message || "")) { sent(); return; }
    if (error) { msg.textContent = friendly(error); return; }
    if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) { $("loginEmail").value = email; msg.textContent = "This email already has an account. Sign in instead, or use Forgot password."; return; }
    if (data.session) { msg.textContent = ""; await enterCloud(data.session); return; }
    sent();
  });
  $("passwordForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const password = $("pwNew").value, again = $("pwNew2").value; const msg = $("pwMsg");
    if (password.length < 8) { msg.textContent = "Use a password of at least 8 characters."; $("pwNew").focus(); return; }
    if (password !== again) { msg.textContent = "The two passwords don\u2019t match."; $("pwNew2").focus(); $("pwNew2").select(); return; }
    msg.textContent = "Saving\u2026"; $("pwBtn").disabled = true;
    const { error } = await withRetry(() => S.sb.auth.updateUser({ password }));
    $("pwBtn").disabled = false;
    if (error) { msg.textContent = friendly(error); return; }
    msg.textContent = "Password changed."; $("pwNew").value = ""; $("pwNew2").value = "";
    pwTimer = setTimeout(() => { if (settingsOpen === "password") { if (fromSettings) showSettings(); else { settingsOpen = false; hideAllViews(); render(); } } }, 1200);
  });
  $("settingsBtn").addEventListener("click", showSettings);
  $("changePw").addEventListener("click", () => { fromSettings = true; showPassword(); });
  $("myExercises").addEventListener("click", () => { fromSettings = true; showExercises(); });
  $("setNumber").addEventListener("click", () => { fromSettings = true; showNumber(); });
  $("myPhone").addEventListener("change", () => { setTrainerPhone($("myPhone").value); $("myPhoneMsg").textContent = phoneDigits($("myPhone").value) ? "Saved. Clients now see Message Michal." : "Saved. Without a number clients see no button."; });
  $("settingsBtn2").addEventListener("click", showSettings);
  $("forgotBtn").addEventListener("click", async () => {
    const email = $("loginEmail").value.trim();
    if (!email) { $("loginMsg").textContent = "Type your email first, then tap Forgot password."; return; }
    const { error } = await withRetry(() => S.sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname }));
    $("loginMsg").textContent = error ? friendly(error) : "Check your email for a link to set a new password.";
  });
  $("recoveryForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const password = $("recoveryPassword").value;
    if (password.length < 8) { $("recoveryMsg").textContent = "At least 8 characters."; return; }
    if (password !== $("recoveryPassword2").value) { $("recoveryMsg").textContent = "The two passwords don\u2019t match."; return; }
    $("recoveryMsg").textContent = "Saving\u2026"; $("recoveryBtn").disabled = true;
    const { error } = await withRetry(() => S.sb.auth.updateUser({ password }));
    $("recoveryBtn").disabled = false;
    if (error) { $("recoveryMsg").textContent = friendly(error); return; }
    S.recovering = false; $("recoveryPassword").value = ""; $("recoveryPassword2").value = "";
    const { data: s } = await S.sb.auth.getSession();
    if (s && s.session) await enterCloud(s.session); else showLogin("Password saved. Sign in.");
  });
  const signOutClient = async () => {
    await flushNow();
    if (dirty.size) { $("status").textContent = "Some weights are not saved yet \u00b7 try again when online"; return; }
    const finish = () => {
      for (const tm of timers.values()) clearTimeout(tm);
      timers.clear(); chains.clear(); dirty.clear(); pendingWeightRows.clear(); pendingDoneRows.clear(); pendingEarlyRows.clear(); pendingFinish.clear(); pendingSkip.clear(); pendingMove.clear(); pendingMiss.clear(); pendingSwap.clear(); S.failed = false;
      clients.clear(); trainings.clear(); localBackend.save();
      try { localStorage.removeItem("fiala.trainings.role"); localStorage.removeItem("fiala.pending.v1"); } catch {}
      S.offline = false; S.offlineEntry = null; S.pendingOwner = "";
      S.view = { name: "clients" }; showLogin("");
    };
    const who = S.sessionEmail;
    if (!S.signingOut) S.signingOut = S.sb.auth.signOut().catch((e) => ({ error: e })).finally(() => { S.signingOut = null; });
    const out = await withTimeout(S.signingOut, 8000);
    if (out && out.error && hasAuthToken()) { $("status").textContent = "Sign out needs a connection \u00b7 try again later"; (S.signingOut || Promise.resolve()).then(() => { if (!hasAuthToken() && S.signedIn && S.sessionEmail === who) finish(); }); return; }
    finish();
  };
  $("signout3").addEventListener("click", signOutClient);
  $("retryBtn").addEventListener("click", async () => {
    $("retryBtn").disabled = true;
    try {
      const { data, error } = await S.sb.auth.getSession().catch((e) => ({ data: null, error: e }));
      const remembered = lsGet("fiala.trainings.role");
      if (data && data.session) await enterCloud(data.session);
      else if (remembered && remembered.email && (!navigator.onLine || isNetwork(error))) enterOffline(remembered);
      else showLogin("");
    } finally { $("retryBtn").disabled = false; }
  });
  const signOutTrainer = async () => {
    await flushNow();
    if (dirty.size) { $("status").textContent = "Some changes are not saved yet \u00b7 try again when online"; return; }
    const finish = () => {
      for (const tm of timers.values()) clearTimeout(tm);
      timers.clear(); chains.clear(); dirty.clear(); trainerTouched.clear(); trainerNamed.clear(); S.failed = false;
      clients.clear(); trainings.clear(); localBackend.save();
      try { localStorage.removeItem("fiala.trainings.migrated"); localStorage.removeItem("fiala.trainings.role"); localStorage.removeItem("fiala.pending.v1"); } catch {}
      S.offline = false; S.offlineEntry = null; S.pendingOwner = "";
      S.view = { name: "clients" }; showLogin("");
    };
    const who = S.sessionEmail;
    if (!S.signingOut) S.signingOut = S.sb.auth.signOut().catch((e) => ({ error: e })).finally(() => { S.signingOut = null; });
    const out = await withTimeout(S.signingOut, 8000);
    if (out && out.error && hasAuthToken()) { $("status").textContent = "Sign out needs a connection \u00b7 try again later"; (S.signingOut || Promise.resolve()).then(() => { if (!hasAuthToken() && S.signedIn && S.sessionEmail === who) finish(); }); return; }
    finish();
  };
  $("signout").addEventListener("click", () => (S.clientMode ? signOutClient() : signOutTrainer()));
  async function flushNow() { for (const k of [...timers.keys()]) { const [kind, id] = k.split("/"); clearTimeout(timers.get(k)); await flushOne(kind, id).catch(() => {}); } }

  // ---------- data ops ----------
  function addClient(name) {
    const c = { id: uid(), name, notes: "", createdAt: now(), trainerPhone: trainerPhone() };
    clients.set(c.id, c); scheduleSave("clients", c.id, 0);
    go({ name: "client", id: c.id });
  }
  function clientTrainings(clientId) {
    return [...trainings.values()].filter((t) => t.clientId === clientId)
      .sort((a, b) => effDate(b).localeCompare(effDate(a)) || (b.createdAt || "").localeCompare(a.createdAt || ""));
  }
  function newRow(label) { return { id: uid(), label, name: "", sets: 4, reps: "", tempo: "", rest: "", weights: [], note: "" }; }
  function nextLabel(t) { let max = 0; for (const r of t.rows) { const n = labelKey(r.label)[0]; if (Number.isFinite(n)) max = Math.max(max, n); } return String(max + 1); }
  function addTraining(clientId, from, date) {
    const t = {
      id: uid(), clientId, date: date || today(), createdAt: now(),
      title: from ? from.title : "", completedAt: null, skippedAt: null,
      rows: from ? from.rows.map((r) => freshRow(r)) : [],
    };
    if (from && from.fromTemplate) t.fromTemplate = from.fromTemplate;
    if (from && from.inPerson) t.inPerson = true;
    const pk = packageOf(clients.get(clientId)); if (pk && pk.inPerson && !isTemplateClient(clientId)) t.inPerson = true;   // the package's default
    trainings.set(t.id, t); scheduleSave("trainings", t.id, 0);
    go({ name: "training", id: t.id });
  }
  function deleteTraining(id) {
    const t = trainings.get(id); if (!t) return;
    if (S.templateDraft && S.templateDraft.id === id) { S.templateDraft = null; S.pendingGo = null; paintDraftBar(); }
    trainings.delete(id); scheduleSave("trainings", id, 0);
    go({ name: "client", id: t.clientId });
  }
  function deleteClient(id) {
    for (const t of clientTrainings(id)) { trainings.delete(t.id); scheduleSave("trainings", t.id, 0); }
    clients.delete(id); scheduleSave("clients", id, 0);
    go({ name: "clients" });
  }
  // Weights from the most recent earlier training of this client with the same exercise.
  function lastWeights(t, row) {
    const canon = (x) => squash(ALIASES[String(x || "").trim()] || x); // "Push-ups" logged last month still counts for "Push-up"
    const name = canon(row.name); if (!name) return null;
    for (const other of clientTrainings(t.clientId)) {
      if (other.id === t.id) continue;
      if (effDate(other) > effDate(t)) continue;
      if (effDate(other) === effDate(t) && (other.createdAt || "") >= (t.createdAt || "")) continue;
      const r = other.rows.find((x) => canon(x.name) === name && [...(x.weights || []), ...(x.repsDone || [])].some((w) => String(w || "").trim() !== ""));   // a plank has no weight: its time counts
      if (r) { const only = (arr) => (arr || []).map((v, i) => (setCounts(r, i) ? v : "")); return { date: other.date, weights: only(r.weights), reps: only(r.repsDone) }; }   // a weight typed into a set that never happened does not carry forward
    }
    return null;
  }

  // ---------- navigation ----------
  // ---- the screen stays on during a workout (Screen Wake Lock: iPhone/iPad from iOS 16.4, Android). Held while a workout page is open
  // and on screen; the system lets it go when the app leaves the screen, and we ask for it again on return. Leaving the workout drops it,
  // and so does WAKE_MINUTES without a touch, so a phone left on a workout page still locks eventually.
  const WAKE_MINUTES = 5;
  let wake = null, wakePending = false, wakeTimer = null;
  const wakeWanted = () => { if (S.view.name !== "training" || document.visibilityState !== "visible") return false; const t = trainings.get(S.view.id); return !!t && !isTemplateClient(t.clientId); };
  async function holdWake(renew = true) {
    if (typeof navigator === "undefined" || !("wakeLock" in navigator) || !wakeWanted()) return;
    if (renew) { clearTimeout(wakeTimer); wakeTimer = setTimeout(dropWake, WAKE_MINUTES * 60000); }
    else if (!wakeTimer) return;                                    // the budget ran out: only a touch starts it again
    if (wake || wakePending) return;
    wakePending = true;
    try {
      const w = await navigator.wakeLock.request("screen");
      if (!wakeWanted() || !wakeTimer) { w.release().catch(() => {}); return; }   // the page moved on while we waited
      wake = w; w.addEventListener("release", () => { if (wake === w) wake = null; });
    } catch { wake = null; }                                        // refused (low power mode, old browser): the workout works the same, the screen just locks as usual
    finally { wakePending = false; }
  }
  function dropWake() { clearTimeout(wakeTimer); wakeTimer = null; const w = wake; wake = null; if (w) w.release().catch(() => {}); }
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") holdWake(false); });
  document.addEventListener("pointerdown", () => { if (S.view.name === "training") holdWake(true); }, { passive: true });
  function go(next) {
    if (S.templateDraft && S.templateDraft.dirty && S.view.name === "training" && S.view.id === S.templateDraft.id) {
      S.pendingGo = next; const b = $("draftBar"); b.classList.remove("nudge"); void b.offsetWidth; b.classList.add("nudge"); return;
    }
    if (!(next.name === "client" && isTemplateClient(next.id))) { pickFor = null; fillFor = null; }
    if (!S.clientMode && (!S.sb || S.syncedOnce) && S.view.name === "training" && !(next.name === "training" && next.id === S.view.id) && fillFor !== S.view.id) {   // leaving an empty workout behind discards it, like an empty note (not while it waits for a template, not before the first sync)
      const t = trainings.get(S.view.id); if (isEmptyWorkout(t)) { trainings.delete(t.id); scheduleSave("trainings", t.id, 0); }
    }
    if (notifOpen && !(next.name === "client" && next.id === notifOpen)) closeNotif();   // leaving the client: what was shown counts as seen
    reordering = false; S.view = next; lsSet("fiala.trainings.view", S.view); render(); window.scrollTo(0, 0);
    if (next.name === "training") holdWake(true); else dropWake(); }
  $("back").addEventListener("click", () => {
    if (settingsOpen) {
      if (fromSettings && settingsOpen !== "settings") { showSettings(); window.scrollTo(0, 0); return; }
      settingsOpen = false; fromSettings = false; $("exList").querySelectorAll(".player iframe").forEach((f) => f.remove()); hideAllViews(); render(); window.scrollTo(0, 0); return;
    }
    if (S.view.name === "training") { const t = trainings.get(S.view.id); go(t ? (isTemplateClient(t.clientId) ? templateHome(t) : { name: "client", id: t.clientId }) : { name: "clients" }); }
    else if (S.view.name === "client" && isTemplateClient(S.view.id) && S.view.phase) go({ name: "client", id: TEMPLATES_ID, program: S.view.program });
    else if (S.view.name === "client" && isTemplateClient(S.view.id) && S.view.program) go({ name: "client", id: TEMPLATES_ID });
    else go({ name: "clients" });
  });

  // ---------- render ----------
  // ---- keyboard bar (above the phone keyboard): 123/ABC switch, quick entries, Next/Done. The number keypad on iPhone has no Return key.
  const kbbar = $("kbbar"), kbMode = kbbar.querySelector(".kb-mode"), kbChips = kbbar.querySelector(".kb-chips"), kbNextBtn = kbbar.querySelector(".kb-next"), kbDone = kbbar.querySelector(".kb-done");
  let kbTarget = null;
  const kbKind = (el) => {
    if (!el || el.tagName !== "INPUT" || el.readOnly) return "";
    if (el.closest(".boxes")) return "weights";
    if (el.closest(".setlog")) return el.classList.contains("w") ? "weights" : "repsdone";
    if (el.classList.contains("reps")) return "reps";
    if (el.classList.contains("tempo")) return "tempo";
    if (el.classList.contains("rest")) return "rest";
    return "";
  };
  function placeKb() {
    const vv = window.visualViewport;
    if (vv) kbbar.style.top = Math.round(vv.offsetTop + vv.height - kbbar.offsetHeight) + "px";
    else { kbbar.style.top = "auto"; kbbar.style.bottom = "0"; }
  }
  const kbFire = (t) => t.dispatchEvent(new Event("input", { bubbles: true }));
  const kbSibling = (t) => {                                        // the box after this one: weight → reps → the next exercise of the superset or giant set → … ; nothing left = Done
    if (t.closest(".boxes")) return t.nextElementSibling;
    const block = t.closest(".block"); if (!block || !t.closest(".setlog")) return null;
    const ins = [...block.querySelectorAll(".setlog input")].filter((i) => !i.closest(".setlog").hidden && i.offsetParent !== null);
    return ins[ins.indexOf(t) + 1] || null;
  };
  function kbNext() { const t = kbTarget; if (!t) return; const nx = kbSibling(t); if (nx) nx.focus(); else t.blur(); }
  const kbSet = (v, stay) => { const t = kbTarget; if (!t) return; t.value = v; kbFire(t); if (!stay) kbNext(); };
  const kbInsert = (s) => { const t = kbTarget; if (!t) return; const a = t.selectionStart == null ? t.value.length : t.selectionStart, b = t.selectionEnd == null ? a : t.selectionEnd; t.value = t.value.slice(0, a) + s + t.value.slice(b); try { t.setSelectionRange(a + s.length, a + s.length); } catch (_) {} kbFire(t); };
  function paintKb() {
    const t = kbTarget; if (!t) return;
    const kind = kbKind(t);
    kbMode.textContent = t.inputMode === "text" ? "123" : "Aa";
    kbChips.replaceChildren();
    const chip = (label, fn) => { const b = document.createElement("button"); b.type = "button"; b.tabIndex = -1; b.textContent = label; b.addEventListener("click", fn); kbChips.appendChild(b); };
    const unitChip = (u) => chip(u, () => { const v = kbTarget.value.trim().replace(/\s*(sec|s|min)$/i, ""); if (v) kbSet(v + " " + u, true); }); // 60 → 60 sec, 4 min → 4 sec
    if (kind === "weights") { chip("Bodyweight", () => kbSet("BW")); if (!t.closest(".setlog")) unitChip("sec"); }   // the key says the word the box will show   // the set log has its own Time box: seconds never go in the weight
    const sideChip = (w) => chip(w, () => { const v = kbTarget.value.trim().replace(/\s*(\/|each|per)\s*(side|leg|arm)$/i, ""); if (v) kbSet(v + " " + w, true); });   // 7 → "7 / side"
    if (kind === "reps") { chip("\u2013", () => kbInsert("\u2013")); sideChip("/ side"); unitChip("sec"); }
    if (kind === "tempo") { chip("X", () => kbInsert("X")); for (const w of ["Normal", "Controlled", "Slow"]) chip(w, () => kbSet(w, true)); for (const c of ["3010", "4010", "10X0", "41X0"]) chip(c, () => kbSet(c, true)); }
    if (kind === "rest") { unitChip("sec"); unitChip("min"); }
    kbNextBtn.hidden = !kbSibling(t);                                                      // Next only while another box of this exercise, superset or giant set is left; the check is always there
  }
  function showKb(el) {
    kbTarget = el; paintKb(); kbbar.hidden = false; placeKb(); $("draftBar").classList.add("kb");
    if (window.visualViewport) { window.visualViewport.addEventListener("resize", placeKb); window.visualViewport.addEventListener("scroll", placeKb); }
  }
  function hideKb() {
    kbTarget = null; kbbar.hidden = true; $("draftBar").classList.remove("kb");
    if (window.visualViewport) { window.visualViewport.removeEventListener("resize", placeKb); window.visualViewport.removeEventListener("scroll", placeKb); }
  }
  kbbar.addEventListener("pointerdown", (e) => e.preventDefault()); // taps on the bar must not take focus (and the keyboard) away from the box
  kbbar.addEventListener("mousedown", (e) => e.preventDefault());
  kbMode.addEventListener("click", () => {
    const t = kbTarget; if (!t) return;
    const text = t.inputMode !== "text";
    const group = t.closest(".boxes") ? [...t.closest(".boxes").children] : [t];
    for (const b of group) b.inputMode = text ? "text" : "decimal";
    t.blur(); setTimeout(() => t.focus(), 50);   // the phone reads the keyboard type when the box takes focus
  });
  kbNextBtn.addEventListener("click", kbNext);
  kbDone.addEventListener("click", () => { const t = kbTarget; if (t) t.blur(); else hideKb(); });   // the check: done with this box, the keyboard goes
  document.addEventListener("focusin", (e) => { if (kbKind(e.target)) showKb(e.target); else if (kbTarget) hideKb(); });
  document.addEventListener("focusout", () => { setTimeout(() => { if (!kbKind(document.activeElement)) hideKb(); }, 80); });

  let closeOpenAlt = null;
  // ---- templates: workouts filed under a built-in "Templates" entry; clients never receive them (their data is read per client id)
  const TEMPLATES_VERSION = 3;           // 2: Lean Type + Muscle Type added; 3: reps repaired
  const MY_TEMPLATES = "My templates";
  let pickFor = null;                      // client id while choosing a template for them
  let fillFor = null;                      // training id: an empty workout waiting to be filled from a template
  const lastUse = lsGet("fiala.templates.last") || { template: null, client: null };   // where he was when he last used a template
  let flashTemplate = null;                // template id to scroll to and flash on the Templates page
  async function seedTemplates() {
    if (S.clientMode || S.seeding) return;
    let tc = clients.get(TEMPLATES_ID);
    if (tc && (tc.templatesVersion || 0) >= TEMPLATES_VERSION) return;
    S.seeding = true;
    try { await seedTemplatesNow(tc); } finally { S.seeding = false; }
  }
  async function seedTemplatesNow(tc) {
    let list;
    try { const res = await fetch("templates.json", { cache: "no-store" }); if (!res.ok) return; list = await res.json(); } catch { return; }
    if (!tc) { tc = { id: TEMPLATES_ID, name: "Templates", notes: "", email: "", unit: "lb", createdAt: now(), kind: "templates" }; clients.set(tc.id, tc); }
    const fresh = [];
    for (const T of list) {
      const have = trainings.get(T.id);
      if (have) {                                   // version 3 repair: reps that were wrongly given a "sec" unit
        let fixed = false;
        for (const r of have.rows || []) { const src = T.rows.find((x) => x.label === r.label && x.name === r.name); if (src && r.reps === src.reps + " sec") { r.reps = src.reps; fixed = true; } }
        if (fixed) fresh.push(have);
        continue;
      }
      const t = { id: T.id, clientId: TEMPLATES_ID, date: "2026-01-01", createdAt: now(), title: T.sub || "", completedAt: null, skippedAt: null,
        template: { program: T.program, phase: T.phase, stage: T.stage, n: T.n, phaseName: T.phaseName || "" },
        rows: T.rows.map((r) => ({ id: uid(), label: r.label, name: r.name, sets: r.sets, reps: r.reps || "", tempo: r.tempo || "", rest: r.rest || "", weights: [], note: r.note || "", done: false, alts: r.alts || [] })) };
      trainings.set(t.id, t); fresh.push(t);
    }
    tc.templatesVersion = TEMPLATES_VERSION;
    localBackend.save();
    if (S.sb && S.signedIn && fresh.length) {
      $("status").textContent = "Adding templates\u2026";
      for (let i = 0; i < fresh.length; i += 60) {
        const chunk = fresh.slice(i, i + 60).map((t) => ({ id: t.id, client_id: TEMPLATES_ID, data: t }));
        const { data, error } = await S.sb.from("ft_trainings").upsert(chunk).select("id,updated_at");
        if (error) { for (const t of fresh.slice(i)) scheduleSave("trainings", t.id, 0); break; }   // the queue finishes the job later
        for (const r of data || []) seenAt.set(key("trainings", r.id), r.updated_at);
      }
    } else { for (const t of fresh) scheduleSave("trainings", t.id, 0); }
    scheduleSave("clients", TEMPLATES_ID, 0);
    render(); setStatus();
  }
  function templateMeta(t) { return t.template || { program: MY_TEMPLATES, phase: 0, stage: 0, n: 0, phaseName: "" }; }
  function templateTitle(t) { const m = templateMeta(t); return (m.n ? "Workout " + m.n : "") + (t.title ? (m.n ? " \u00b7 " : "") + t.title : "") || "Template"; }
  function templatePath(T) { const m = templateMeta(T); return [m.program, m.phase ? "Phase " + m.phase : "", m.stage ? "Stage " + m.stage : "", m.n ? "Workout " + m.n : (T.title || "")].filter(Boolean).join(" \u00b7 "); }
  // ---- our own day picker (Monday first, the client's workouts marked), used wherever a date is chosen
  let dp = null;                          // { clientId, title, selected, month, onPick }
  // "Finish early" asks first. What's logged stays, the remaining sets stay open, and the reason (if any) lands on the card.
  let es = null;                                                   // { t, g, selKey, reason } while the sheet is up
  function markEarly(t, r, reason) {                               // the note on why; "" clears it
    if (reason) r.earlyReason = reason; else delete r.earlyReason;
    if (S.clientMode) { if (!pendingEarlyRows.has(t.id)) pendingEarlyRows.set(t.id, new Set()); pendingEarlyRows.get(t.id).add(r.id); }
  }
  const openNotes = new Set();                                   // exercise rows whose instructions the client opened (this session)
  const openExNotes = new Set();                                 // cards whose session note is unfolded (this session)
  const noteDraft = new Map();                                   // clientId -> what is typed in the notes box and not saved yet
  const tNoteDraft = new Map(); let tNoteOpenFor = null;          // the same for the note box on a workout page
  const growBox = (ta) => { ta.style.height = "auto"; ta.style.height = Math.max(96, ta.scrollHeight) + "px"; };
  const openNoteGroups = new Set(), armedNotes = new Set();
  const openNoteIds = new Set();                                 // long notes opened in full (this session)
  // notes stay inside c.notes, the one key the server strips before a client's phone gets the record:
  // a string is the old single note (shown as "Earlier"), an object { log: [{ id, at, text }] } is the dated list
  const writeNotes = (c, list) => { c.notes = packNotes(list); scheduleSave("clients", c.id); };   // only ever from Save / Delete: a redraw never writes
  function renderNotes(c) {
    const wrap = $("noteList"); wrap.replaceChildren(); if (S.clientMode) return;
    const onCards = [];                                                          // notes written on the exercise cards (by the client or by him), shown here with his own
    for (const tr of clientTrainings(c.id)) for (const r of tr.rows || []) if (r.clientNote) onCards.push({ id: "row/" + tr.id + "/" + r.id, at: r.clientNoteAt || (tr.date ? tr.date + "T12:00:00" : null), text: r.clientNote, by: r.clientNoteBy || "client", exercise: String(r.name || ""), workout: { id: tr.id, title: String(tr.title || ""), date: effDate(tr) || String(tr.date || "") }, row: r, training: tr });
    const entries = [...noteEntries(c).map((n) => ({ ...n, by: "coach" })), ...onCards].sort((a, b) => String(b.at || "").localeCompare(String(a.at || "")));
    const firstName = String(c.name || "").trim().split(/\s+/)[0] || "Client";
    const dropCardNote = (n) => { delete n.row.clientNote; delete n.row.clientNoteBy; delete n.row.clientNoteAt; if (!trainerTouched.has(n.training.id)) trainerTouched.set(n.training.id, new Set()); trainerTouched.get(n.training.id).add(n.row.id); scheduleSave("trainings", n.training.id); };
    const t = today(), base = new Date(t + "T12:00:00"), monday = new Date(base); monday.setDate(base.getDate() - ((base.getDay() + 6) % 7));
    const mondayIso = localIso(monday), yIso = localIso(new Date(base.getTime() - 86400000));
    const groups = new Map();                                                    // "This week", then this year's months, then years, then "Earlier"
    for (const n of entries) {
      const day = n.at ? localIso(new Date(n.at)) : "";
      let key, title;
      if (!day) { key = "earlier"; title = "Earlier"; }
      else if (day >= mondayIso) { key = "week"; title = "This week"; }
      else if (day.slice(0, 4) === t.slice(0, 4)) { key = day.slice(0, 7); title = new Date(day + "T12:00:00").toLocaleDateString(undefined, { month: "long" }); }
      else { key = day.slice(0, 4); title = day.slice(0, 4); }
      if (!groups.has(key)) groups.set(key, { title, items: [] }); groups.get(key).items.push(n);
    }
    // every group starts folded; what he opens stays open for the session
    const when = (n) => {
      if (!n.at) return "Earlier";
      const d = new Date(n.at), day = localIso(d);
      const dd = day === t ? "Today" : day === yIso ? "Yesterday" : d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
      return dd + " \u00b7 " + d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
    };
    for (const [key, g] of groups) {
      const sec = document.createElement("div"); sec.className = "month";
      const head = document.createElement("button"); head.type = "button";
      head.innerHTML = "<span></span><span class=\"sub\"></span>";
      head.firstChild.textContent = g.title; head.lastChild.textContent = g.items.length + (g.items.length === 1 ? " note" : " notes") + " \u203a";
      const gk = c.id + "/" + key;
      const card = document.createElement("div"); card.className = "list notes"; card.hidden = !openNoteGroups.has(gk);
      for (const n of g.items) {
        const row = document.createElement("div"); row.className = "entry";
        const top = document.createElement("div"); top.className = "when";
        const stamp = document.createElement("span"); stamp.innerHTML = "<b></b> \u00b7 "; stamp.firstChild.textContent = n.by === "coach" ? "Coach" : firstName; stamp.append(when(n));   // who wrote it, then when
        const ask = document.createElement("span"); ask.className = "ask";
        if (armedNotes.has(n.id)) {
          const q = document.createElement("span"); q.textContent = "Delete this note?";
          const go = document.createElement("button"); go.type = "button"; go.className = "go"; go.textContent = "Delete";
          go.addEventListener("click", () => { armedNotes.delete(n.id); if (n.row) dropCardNote(n); else { deletedNotes.add(n.id); writeNotes(c, noteEntries(c).filter((x) => x.id !== n.id)); } renderNotes(c); });
          const keep = document.createElement("button"); keep.type = "button"; keep.className = "keep"; keep.textContent = "Keep";
          keep.addEventListener("click", () => { armedNotes.delete(n.id); renderNotes(c); });
          ask.append(q, go, keep);
        } else {
          const del = document.createElement("button"); del.type = "button"; del.textContent = "Delete";
          del.addEventListener("click", () => { armedNotes.clear(); armedNotes.add(n.id); renderNotes(c); const k = wrap.querySelector(".entry .keep"); if (k) k.focus({ preventScroll: true }); });
          ask.appendChild(del);
        }
        top.append(stamp, ask);
        let ref = null;
        if (n.workout) {                                                       // written with a session: say which, and open it on a tap
          ref = document.createElement("button"); ref.type = "button"; ref.className = "ref";
          const d = /^\d{4}-\d{2}-\d{2}$/.test(n.workout.date) ? new Date(n.workout.date + "T12:00:00").toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }) : "";
          ref.textContent = [n.exercise, n.workout.title || "Workout", d].filter(Boolean).join(" \u00b7 ") + " \u203a";   // a card note names its exercise too
          ref.addEventListener("click", () => { if (trainings.has(n.workout.id)) go({ name: "training", id: n.workout.id }); });
        }
        const text = document.createElement("div"); text.className = "text"; text.textContent = n.text;
        const opened = openNoteIds.has(n.id); text.classList.toggle("clamp", !opened);
        const more = document.createElement("button"); more.type = "button"; more.className = "more"; more.textContent = opened ? "Less" : "More"; more.hidden = !opened;   // "More" appears once we know the note overflows
        const toggle = () => { if (openNoteIds.has(n.id)) openNoteIds.delete(n.id); else openNoteIds.add(n.id); renderNotes(c); };
        more.addEventListener("click", toggle);
        text.addEventListener("click", () => { if (!more.hidden) toggle(); });
        row.append(top); if (ref) row.append(ref); row.append(text, more); card.appendChild(row);
      }
      head.addEventListener("click", () => { if (card.hidden) openNoteGroups.add(gk); else openNoteGroups.delete(gk); card.hidden = !card.hidden; fitNotes(card); });
      sec.append(head, card); wrap.appendChild(sec);
    }
    setTimeout(() => fitNotes(wrap), 0);
  }
  function fitNotes(root) {                                      // show "More" only under notes that really run past three lines
    for (const el of root.querySelectorAll(".entry .text.clamp")) { const more = el.nextElementSibling; if (more && more.classList.contains("more")) more.hidden = !(el.scrollHeight > el.clientHeight + 1); }
  }
  const groupWord = (g) => g.key === "w" ? "warmup" : g.rows.length === 2 ? "superset" : g.rows.length === 3 ? "tri-set" : g.rows.length > 3 ? "giant set" : "exercise";
  function openFinishEarly(t, g, selKey) {
    const total = Math.max(...g.rows.map(setsOf));
    const did = Math.min(...g.rows.map((r) => clamp(parseInt(r.setsDone, 10) || 0, 0, 20)));
    const left = total - did, word = (n) => n + (n === 1 ? " set" : " sets");
    es = { t, g, selKey, reason: "" };
    $("esTitle").textContent = "Finish this " + groupWord(g) + "?";
    $("esLead").textContent = did > 0 ? did + " of " + word(total) + " completed." : "No sets completed yet.";
    $("esFine").textContent = (did > 0 ? "What you logged stays saved. " : "") + "The remaining " + word(left) + " will stay incomplete.";
    for (const b of $("esReasons").querySelectorAll("button")) { b.classList.remove("on"); b.setAttribute("aria-pressed", "false"); }
    $("earlySheet").hidden = false;
    setTimeout(() => { if (es) $("esGo").focus({ preventScroll: true }); }, 0);
  }
  function closeFinishEarly() { $("earlySheet").hidden = true; es = null; }
  let askOpen = null;                                               // the sheet that is up, if any: a second ask closes it as "no" first
  function askFirst({ title, text, yes = "Delete" }) {               // nothing is deleted or discarded by accident: a sheet asks, and only its red button does it
    return new Promise((resolve) => {
      if (askOpen) askOpen(false);
      const bg = $("askSheet"), y = $("askYes"), n = $("askNo"), behind = [...document.body.children].filter((el) => el !== bg);
      $("askTitle").textContent = title; $("askText").textContent = text || ""; $("askText").hidden = !text; y.textContent = yes;
      let armed = false; y.disabled = true;                                                  // the second tap of a double tap must not land on the red button
      const settle = setTimeout(() => { armed = true; y.disabled = false; }, 350);
      const done = (v) => { clearTimeout(settle); askOpen = null; S.asking = false; bg.hidden = true; y.disabled = false; for (const el of behind) el.inert = false; y.removeEventListener("click", onYes); n.removeEventListener("click", onNo); bg.removeEventListener("click", onBg); document.removeEventListener("keydown", onKey); resolve(v); };
      const onYes = () => { if (armed) done(true); }, onNo = () => done(false), onBg = (e) => { if (armed && e.target === bg) done(false); }, onKey = (e) => { if (e.key === "Escape") done(false); };
      askOpen = done; S.asking = true;
      y.addEventListener("click", onYes); n.addEventListener("click", onNo); bg.addEventListener("click", onBg); document.addEventListener("keydown", onKey);
      for (const el of behind) el.inert = true;                                              // the page behind is out of reach until the question is answered
      bg.hidden = false; n.focus({ preventScroll: true });
    });
  }
  // a list to choose from, in the same sheet language as askFirst; resolves with the chosen id, or null for Cancel / tap outside / Escape
  function pickOne({ title, items }) {
    return new Promise((resolve) => {
      if (askOpen) askOpen(false);
      const bg = $("pickSheet"), ul = $("pickList"), n = $("pickNo"), behind = [...document.body.children].filter((el) => el !== bg);
      $("pickTitle").textContent = title;
      ul.replaceChildren(...items.map((it) => {
        const li = document.createElement("li"), b = document.createElement("button"); b.type = "button";
        b.innerHTML = "<span></span><span class=\"sub\"></span>"; b.firstChild.textContent = it.label; b.lastChild.textContent = it.sub || "";
        b.lastChild.insertAdjacentHTML("beforeend", '<span class="chev">\u203a</span>');
        b.addEventListener("click", () => { if (armed) done(it.id); }); li.appendChild(b); return li;
      }));
      let armed = false;                                                                      // the second tap of a double tap must not pick a row
      const settle = setTimeout(() => { armed = true; }, 350);
      const done = (v) => { clearTimeout(settle); askOpen = null; S.asking = false; bg.hidden = true; for (const el of behind) el.inert = false; n.removeEventListener("click", onNo); bg.removeEventListener("click", onBg); document.removeEventListener("keydown", onKey); resolve(v); };
      const onNo = () => done(null), onBg = (e) => { if (armed && e.target === bg) done(null); }, onKey = (e) => { if (e.key === "Escape") done(null); };
      askOpen = done; S.asking = true;
      n.addEventListener("click", onNo); bg.addEventListener("click", onBg); document.addEventListener("keydown", onKey);
      for (const el of behind) el.inert = true;
      bg.hidden = false; ul.scrollTop = 0; n.focus({ preventScroll: true });
    });
  }
  function finishEarlyNow() {
    if (!es) return;
    const { t, g, selKey, reason } = es; closeFinishEarly();
    for (const r of g.rows) { r.done = true; markEarly(t, r, reason); const track = S.clientMode ? pendingWeightRows : trainerTouched; if (!track.has(t.id)) track.set(t.id, new Set()); track.get(t.id).add(r.id); }
    openBlocks.delete(selKey); setSel.delete(selKey); scheduleSave("trainings", t.id);
    haptic(); S.renderedTraining = null; render(); scrollToCard(g.key);
  }
  function openDatePicker(opts) {
    const selected = opts.selected || today();
    dp = { clientId: opts.clientId, title: opts.title || "Pick a day", selected, month: selected.slice(0, 7), onPick: opts.onPick, back: document.activeElement };
    renderDatePicker(); $("datePick").hidden = false;
    for (const el of document.querySelectorAll("main, header")) el.inert = true;
    setTimeout(() => { const f = $("dpGrid").querySelector("button.sel") || $("dpCancel"); if (f && dp) f.focus({ preventScroll: true }); }, 0);
  }
  function closeDatePicker() {
    const back = dp && dp.back; $("datePick").hidden = true; dp = null;
    for (const el of document.querySelectorAll("main, header")) el.inert = false;
    if (back && typeof back.focus === "function" && document.contains(back)) back.focus({ preventScroll: true });
  }
  function renderDatePicker() {
    if (!dp) return;
    const list = clientTrainings(dp.clientId);
    const [y, m] = dp.month.split("-").map(Number); const first = new Date(y, m - 1, 1, 12);
    $("dpTitle").textContent = dp.title; $("dpMonth").textContent = monthTitle(dp.month); $("dpToday").hidden = dp.month === today().slice(0, 7);
    const grid = $("dpGrid"); grid.replaceChildren();
    const lead = (first.getDay() + 6) % 7;
    for (let i = 0; i < lead; i++) { const b = document.createElement("button"); b.type = "button"; b.className = "out"; b.tabIndex = -1; b.setAttribute("aria-hidden", "true"); grid.appendChild(b); }
    const days = new Date(y, m, 0).getDate();
    for (let day = 1; day <= days; day++) {
      const d = new Date(y, m - 1, day, 12); const key = localIso(d);
      const dayWorkouts = list.filter((t) => effDate(t) === key && !(t.skippedAt && !t.completedAt));
      const b = document.createElement("button"); b.type = "button";
      if (key === today()) { b.classList.add("today"); b.setAttribute("aria-current", "date"); }
      if (key === dp.selected) b.classList.add("sel");
      if (dayWorkouts.length) b.classList.add(dayWorkouts.every((t) => t.completedAt) ? "finished" : "planned");
      const dn = document.createElement("span"); dn.className = "dn"; dn.textContent = String(day);
      const dot = document.createElement("span"); dot.className = "dot";
      b.append(dn, dot);
      b.setAttribute("aria-label", d.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" }) + (dayWorkouts.length ? ", " + dayWorkouts.length + (dayWorkouts.length === 1 ? " workout" : " workouts") : ""));
      b.addEventListener("click", () => { const pick = dp && dp.onPick; closeDatePicker(); if (pick) pick(key); });
      grid.appendChild(b);
    }
  }
  function applyTemplate(T, clientId, date) {
    lastUse.template = T.id; lastUse.client = clientId; lsSet("fiala.templates.last", lastUse);
    addTraining(clientId, { ...T, title: T.title || (templateMeta(T).n ? "Workout " + templateMeta(T).n : ""), fromTemplate: T.id }, date || today());
  }
  function fillFromTemplate(T) {                                        // an empty workout takes the template's exercises and name, and stays on its day
    const id = fillFor, target = trainings.get(id); fillFor = null; pickFor = null;
    if (!target) { render(); return; }
    lastUse.template = T.id; lastUse.client = target.clientId; lsSet("fiala.templates.last", lastUse);
    if (!String(target.title || "").trim()) target.title = T.title || (templateMeta(T).n ? "Workout " + templateMeta(T).n : "");
    target.rows = (T.rows || []).map((r) => freshRow(r));
    target.fromTemplate = T.id;
    scheduleSave("trainings", target.id, 0); S.renderedTraining = null; go({ name: "training", id });
  }
  function backToTemplates(tid) {
    const T = trainings.get(tid);
    flashTemplate = tid; pickFor = null;
    if (!clients.has(TEMPLATES_ID)) return;
    go(T ? templateHome(T) : { name: "client", id: TEMPLATES_ID });
    requestAnimationFrame(() => { const li = document.querySelector('#tplList li[data-tid="' + tid + '"]'); if (li) { li.scrollIntoView({ block: "center" }); li.classList.add("flash"); setTimeout(() => li.classList.remove("flash"), 1300); } });
  }
  $("fromTpl").addEventListener("click", () => { const t = trainings.get(S.view.id); if (t && t.fromTemplate) backToTemplates(t.fromTemplate); });
  function saveAsTemplate(src) {
    const mine = [...trainings.values()].filter((t) => isTemplateClient(t.clientId) && templateMeta(t).program === MY_TEMPLATES);
    const t = { id: uid(), clientId: TEMPLATES_ID, date: "2026-01-01", createdAt: now(), title: src.title || "", completedAt: null, skippedAt: null,
      template: { program: MY_TEMPLATES, phase: 0, stage: 0, n: mine.length + 1 },
      rows: src.rows.map((r) => freshRow(r)) };
    if (!clients.has(TEMPLATES_ID)) { clients.set(TEMPLATES_ID, { id: TEMPLATES_ID, name: "Templates", notes: "", email: "", unit: "lb", createdAt: now(), kind: "templates" }); scheduleSave("clients", TEMPLATES_ID, 0); }
    trainings.set(t.id, t); scheduleSave("trainings", t.id, 0);
    go({ name: "training", id: t.id });
  }
  const PROG_ORDER = [MY_TEMPLATES, "Fat Burn", "Hypertrophy", "Strength", "Lean Type", "Muscle Type"];
  const progRank = (p) => (PROG_ORDER.indexOf(p) + 1 || 99);
  function tplRow(t, pick) {
    const li = document.createElement("li"); li.dataset.tid = t.id; if (t.id === lastUse.template) li.classList.add("last-used");
    const b = document.createElement("button"); b.type = "button";
    const m = templateMeta(t);
    const pri = document.createElement("span"); pri.className = "pri"; pri.textContent = m.n ? "Workout " + m.n : (t.title || "Template");
    const sec = document.createElement("span"); sec.className = "sec"; sec.textContent = m.n ? (t.title || "") : (t.rows.length + (t.rows.length === 1 ? " exercise" : " exercises"));
    const left = document.createElement("span"); left.style.minWidth = "0"; left.append(pri); if (sec.textContent) left.append(sec);
    const chev = document.createElement("span"); chev.className = "chev"; chev.textContent = pick ? "Use" : "›"; if (pick) chev.style.color = "var(--brand)";
    b.append(left, chev);
    b.addEventListener("click", () => { if (pick) { if (fillFor) { fillFromTemplate(trainings.get(t.id) || t); return; } const cid = pickFor; const who = clients.get(cid); openDatePicker({ clientId: cid, title: "Add to " + ((who && who.name) || "client"), onPick: (date) => { pickFor = null; applyTemplate(trainings.get(t.id) || t, cid, date); } }); } else go({ name: "training", id: t.id }); });
    li.appendChild(b); return li;
  }
  function navRow(title, sub, onClick) {
    const li = document.createElement("li"); const b = document.createElement("button"); b.type = "button";
    b.innerHTML = "<span></span><span class=\"sub\"></span>"; b.firstChild.textContent = title; b.lastChild.textContent = sub; b.lastChild.insertAdjacentHTML("beforeend", '<span class="chev">&rsaquo;</span>');
    b.addEventListener("click", onClick); li.appendChild(b); return li;
  }
  const h2 = (text) => { const e = document.createElement("h2"); e.textContent = text; e.style.marginTop = "24px"; return e; };
  function renderTemplates(c) {
    const all = clientTrainings(c.id);
    const wrap = $("tplList"); wrap.replaceChildren(); wrap.hidden = false;
    const prog = S.view.program || null, ph = S.view.phase || null;
    $("pickNote").hidden = !pickFor;
    if (pickFor) { const pc = clients.get(pickFor); $("pickNote").innerHTML = "Choose a workout for <b></b> · <button class=\"btn quiet\" type=\"button\" id=\"pickCancel\">Cancel</button>"; $("pickNote").querySelector("b").textContent = pc ? pc.name : "the client"; $("pickCancel").addEventListener("click", () => { pickFor = null; fillFor = null; render(); }); }
    $("newTraining").hidden = !!prog;
    const byProg = new Map();
    for (const t of all) { const m = templateMeta(t); if (!byProg.has(m.program)) byProg.set(m.program, []); byProg.get(m.program).push(t); }
    const wn = (n) => n + (n === 1 ? " workout" : " workouts");
    if (!prog) {                                             // level 1: programs
      $("tplKicker").textContent = "Workout library"; $("cName").value = "Templates";
      const mine = (byProg.get(MY_TEMPLATES) || []).sort((x, y) => templateMeta(x).n - templateMeta(y).n);
      if (mine.length) { wrap.appendChild(h2("My templates")); const ul = document.createElement("ul"); ul.className = "list"; ul.replaceChildren(...mine.map((t) => tplRow(t, !!pickFor))); wrap.appendChild(ul); }
      const progs = [...byProg.keys()].filter((p) => p !== MY_TEMPLATES).sort((x, y) => progRank(x) - progRank(y) || x.localeCompare(y));
      if (progs.length) { wrap.appendChild(h2("Programs")); const ul = document.createElement("ul"); ul.className = "list"; ul.replaceChildren(...progs.map((p) => navRow(p, wn(byProg.get(p).length), () => go({ ...S.view, program: p, phase: null, stage: null })))); wrap.appendChild(ul); }
      if (!all.length) { const e = document.createElement("div"); e.className = "empty"; e.textContent = "No templates yet. Open a workout and tap Save as template."; wrap.appendChild(e); }
      return;
    }
    const items = byProg.get(prog) || [];
    if (!ph) {                                               // level 2: phases of a program
      $("tplKicker").textContent = "Templates"; $("cName").value = prog;
      const phases = new Map();
      for (const t of items) { const m = templateMeta(t); if (!phases.has(m.phase)) phases.set(m.phase, []); phases.get(m.phase).push(t); }
      wrap.appendChild(h2("Phases")); const ul = document.createElement("ul"); ul.className = "list";
      for (const [n, pitems] of [...phases.entries()].sort((x, y) => x[0] - y[0])) {
        const pn = (pitems.find((t) => templateMeta(t).phaseName) || { template: {} }).template.phaseName || "";
        ul.appendChild(navRow("Phase " + n + (pn ? " · " + pn : ""), wn(pitems.length), () => go({ ...S.view, phase: n, stage: 1 })));
      }
      wrap.appendChild(ul); return;
    }
    const pitems = items.filter((t) => templateMeta(t).phase === ph);   // level 3: stage tabs + workouts
    const pn = (pitems.find((t) => templateMeta(t).phaseName) || { template: {} }).template.phaseName || "";
    $("tplKicker").textContent = prog; $("cName").value = "Phase " + ph + (pn ? " · " + pn : "");
    const stages = [...new Set(pitems.map((t) => templateMeta(t).stage))].sort((x, y) => x - y);
    const cur = stages.includes(S.view.stage) ? S.view.stage : stages[0];
    const seg = document.createElement("div"); seg.className = "seg stages"; seg.setAttribute("role", "tablist");
    for (const s of stages) { const b = document.createElement("button"); b.type = "button"; b.textContent = "Stage " + s; b.classList.toggle("on", s === cur); b.addEventListener("click", () => { S.view.stage = s; lsSet("fiala.trainings.view", S.view); renderTemplates(c); }); seg.appendChild(b); }
    wrap.appendChild(seg);
    const ul = document.createElement("ul"); ul.className = "list"; ul.style.marginTop = "16px";
    ul.replaceChildren(...pitems.filter((t) => templateMeta(t).stage === cur).sort((x, y) => templateMeta(x).n - templateMeta(y).n).map((t) => tplRow(t, !!pickFor)));
    wrap.appendChild(ul);
  }
  const templateHome = (t) => { const m = templateMeta(t); return m.program === MY_TEMPLATES ? { name: "client", id: TEMPLATES_ID } : { name: "client", id: TEMPLATES_ID, program: m.program, phase: m.phase, stage: m.stage }; };
  function render() {
    if (S.recovering) { showRecovery(); return; }
    if (pendingPage && S.signedIn && !(S.clientMode && !S.myClientId)) {   // a refresh on a settings page lands back on it
      const p = pendingPage; pendingPage = null;
      const open = { settings: showSettings, number: showNumber, packages: showPackages, exercises: showExercises, password: showPassword }[p.open];
      if (open) { fromSettings = !!p.from; open(); return; }
    }
    if (settingsOpen) { if (S.signedIn) { hideAllViews(); $(settingsOpen === "exercises" ? "vExercises" : settingsOpen === "packages" ? "vPackages" : settingsOpen === "number" ? "vNumber" : settingsOpen === "settings" ? "vSettings" : "vPassword").hidden = false; if (settingsOpen === "packages") renderPackages(); $("back").hidden = false; $("brand").hidden = true; } return; }
    if (S.sb && !S.signedIn) { showLogin($("loginMsg").textContent); return; }
    if (S.clientMode && !S.myClientId) { showWaiting(); return; }
    if (celebrating) { hideAllViews(); $("vCelebrate").hidden = false; $("back").hidden = true; $("brand").hidden = false; return; }   // "Nice work" stays up until it hands over to the client page, whatever refreshes meanwhile
    $("vLogin").hidden = true; $("vRecovery").hidden = true; $("vWaiting").hidden = true; $("vCelebrate").hidden = true;
    if (S.clientMode && (S.view.name === "clients" || (S.view.name === "client" && S.view.id !== S.myClientId))) S.view = { name: "client", id: S.myClientId };
    if (S.clientMode && effPaused(clients.get(S.myClientId))) S.view = { name: "client", id: S.myClientId };
    if (S.view.name === "client" && !clients.has(S.view.id)) S.view = S.clientMode ? { name: "client", id: S.myClientId } : { name: "clients" };
    if (S.view.name === "training" && !trainings.has(S.view.id)) S.view = S.clientMode ? { name: "client", id: S.myClientId } : { name: "clients" };
    if (S.view.name !== "training") previewClient = false;
    if (!S.clientMode) document.body.classList.toggle("client", previewClient && S.view.name === "training" && !isTemplateClient(trainings.get(S.view.id).clientId));
    $("vClients").hidden = S.view.name !== "clients";
    $("vClient").hidden = S.view.name !== "client";
    const tabs = S.view.name === "client" && !isTemplateClient(S.view.id); $("tabbar").hidden = !tabs; document.body.classList.toggle("tabs", tabs);
    for (const b of $("tabbar").querySelectorAll("button")) b.classList.toggle("on", b.dataset.tab === S.tab);
    $("vTraining").hidden = S.view.name !== "training";
    $("back").hidden = S.view.name === "clients" || (S.clientMode && S.view.name === "client");
    $("brand").hidden = !(S.view.name === "clients" || (S.clientMode && S.view.name === "client"));
    if (S.view.name === "clients") { S.renderedTraining = null; renderClients(); }
    else if (S.view.name === "client") { S.renderedTraining = null; $("backLabel").textContent = isTemplateClient(S.view.id) && S.view.phase ? S.view.program : (isTemplateClient(S.view.id) && S.view.program ? "Templates" : "Clients"); renderClient(); }
    else { const t = trainings.get(S.view.id); $("backLabel").textContent = S.clientMode ? "Workouts" : (isTemplateClient(t.clientId) ? "Templates" : (clients.get(t.clientId)?.name || "Client")); renderTraining(t); }
    paintDraftBar();
    if (dp) renderDatePicker();
  }

  // clients keep the order he sets (c.sort); unsorted ones follow alphabetically
  const clientOrder = (a, b) => ((a.sort ?? Infinity) - (b.sort ?? Infinity)) || a.name.localeCompare(b.name);
  const peopleList = () => [...clients.values()].filter((c) => !isTemplateClient(c.id)).sort(clientOrder);
  const activeList = () => peopleList().filter((c) => !c.paused);
  let reordering = false;
  function moveClientTo(id, j) {
    const list = activeList(); const i = list.findIndex((c) => c.id === id);
    if (i < 0 || j < 0 || j >= list.length || i === j) { renderClients(); return; }
    const [c] = list.splice(i, 1); list.splice(j, 0, c);
    list.forEach((x, k) => { if (x.sort !== k) { x.sort = k; scheduleSave("clients", x.id); } });
    renderClients();
  }
  // drag a row by its grip (the three lines, like Apple's reorder handle); the others slide out of the way; the order is saved on release.
  // Only the grip starts a drag, so a finger anywhere else on the card still scrolls the list.
  function dragRow(li, id) {
    li.addEventListener("pointerdown", (e) => {
      if (e.button !== 0 && e.pointerType === "mouse") return;
      if (!e.target.closest(".grip")) return;
      const ul = li.parentElement, rows = [...ul.children], i = rows.indexOf(li);
      const rect = rows.map((r) => r.getBoundingClientRect()), h0 = rect[i].height, c0 = rect[i].top + h0 / 2;
      const minDy = rect[0].top - rect[i].top, maxDy = rect[rows.length - 1].bottom - rect[i].bottom;
      let dy = 0, target = i;
      li.setPointerCapture(e.pointerId); li.classList.add("dragging");
      const move = (ev) => {
        dy = Math.max(minDy, Math.min(maxDy, ev.clientY - e.clientY));
        const c = c0 + dy; let up = 0, down = 0;
        rows.forEach((r, k) => {
          if (k === i) return;
          const ck = rect[k].top + rect[k].height / 2;
          // past a row once the dragged centre crosses its centre; at either clamped end of the list every row on that side counts,
          // so a drag to the very top or bottom always takes (row heights differ by fractions of a pixel, exact compares missed the last one)
          if (k > i && (c >= ck || dy >= maxDy)) { r.style.transform = "translateY(" + (-h0) + "px)"; up++; }
          else if (k < i && (c <= ck || dy <= minDy)) { r.style.transform = "translateY(" + h0 + "px)"; down++; }
          else r.style.transform = "";
        });
        target = i + up - down;
        li.style.transform = "translateY(" + dy + "px)";
      };
      const end = () => {
        li.removeEventListener("pointermove", move); li.removeEventListener("pointerup", end); li.removeEventListener("pointercancel", end);
        li.classList.remove("dragging"); rows.forEach((r) => { r.style.transform = ""; });
        moveClientTo(id, target);
      };
      li.addEventListener("pointermove", move); li.addEventListener("pointerup", end); li.addEventListener("pointercancel", end);
    });
  }
  function renderClients() {
    const list = activeList(), inactive = peopleList().filter((c) => c.paused);
    const tpl = clients.get(TEMPLATES_ID);
    $("tplCard").hidden = !tpl || S.clientMode;
    $("clientCount").textContent = list.length ? list.length + (list.length === 1 ? " client" : " clients") : "";
    $("reorderBtn").hidden = S.clientMode || list.length < 2; $("reorderBtn").textContent = reordering ? "Done" : "Reorder";
    const ul = $("clientList"); ul.replaceChildren();
    list.forEach((c, i) => {
      const li = document.createElement("li");
      if (reordering) {
        li.className = "drag-row";
        const row = document.createElement("div"); row.className = "rowline";
        const name = document.createElement("span"); name.textContent = c.name;
        const grip = document.createElement("span"); grip.className = "grip"; grip.textContent = "\u2261"; grip.setAttribute("aria-hidden", "true");
        row.append(name, grip); li.appendChild(row); dragRow(li, c.id);
      } else {
        const b = document.createElement("button"); b.type = "button";
        const words = packWords(c);                                       // "3 of 10", "20 days left" on the right, where the workout count used to be; the purple dot alone says something new happened
        b.innerHTML = `<span class="nm"><span></span></span><span class="sub"></span>`;
        b.firstChild.firstChild.textContent = c.name; b.lastChild.textContent = words;   // no chevron: the row itself is the way in (his call)
        b.classList.toggle("news", !!newsWords(clientNews(c)));
        b.addEventListener("click", () => { S.tab = "workouts"; go({ name: "client", id: c.id }); });
        li.appendChild(b);
      }
      ul.appendChild(li);
    });
    $("clientEmpty").hidden = list.length > 0 || inactive.length > 0;
    $("clientBar").hidden = !list.length && inactive.length > 0; $("clientList").hidden = !list.length;
    $("inactiveBar").hidden = !inactive.length; $("inactiveList").hidden = !inactive.length;
    $("inactiveList").replaceChildren(...inactive.map((c) => {
      const li = document.createElement("li"); const b = document.createElement("button"); b.type = "button";
      b.innerHTML = `<span></span><span class="sub">Paused</span>`; b.firstChild.textContent = c.name;
      b.addEventListener("click", () => { S.tab = "workouts"; go({ name: "client", id: c.id }); }); li.appendChild(b); return li;
    }));
  }
  $("tplCard").addEventListener("click", () => go({ name: "client", id: TEMPLATES_ID, program: null, phase: null, stage: null }));
  $("reorderBtn").addEventListener("click", () => { reordering = !reordering; renderClients(); });
  // month calendar under the week strip: Week | Month switch, arrows, Today, finger-follow swipe
  let calOpen = lsGet("fiala.cal.open") === true, calMonth = today().slice(0, 7), calFor = null, calAnchor = calMonth, calSliding = false;
  const NEXT_DAYS = 3, NEXT_STEP = 5;      // "Up next" shows this many days ahead (the very next workout always); each "Show more" adds this many workouts
  let nextExtra = 0, nextFor = null;
  const monthAdd = (ym, n) => { const [y, m] = ym.split("-").map(Number); const d = new Date(y, m - 1 + n, 1, 12); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0"); };
  const monthTitle = (ym) => { const [y, m] = ym.split("-").map(Number); return new Date(y, m - 1, 1, 12).toLocaleDateString(undefined, { month: "long", year: "numeric" }); };
  $("calToggle").addEventListener("click", () => {
    calOpen = !calOpen; lsSet("fiala.cal.open", calOpen); if (calOpen) { calMonth = today().slice(0, 7); calAnchor = calMonth; }
    if (S.view.name === "client") renderClient();
  });
  $("dpCancel").addEventListener("click", closeDatePicker);
  $("esKeep").addEventListener("click", closeFinishEarly);
  $("esGo").addEventListener("click", finishEarlyNow);
  $("earlySheet").addEventListener("click", (e) => { if (e.target === $("earlySheet")) closeFinishEarly(); });
  $("esReasons").addEventListener("click", (e) => {
    const b = e.target.closest("button"); if (!b || !es) return;
    const on = !b.classList.contains("on");                          // tap again to clear
    for (const x of $("esReasons").querySelectorAll("button")) { x.classList.toggle("on", on && x === b); x.setAttribute("aria-pressed", String(on && x === b)); }
    es.reason = on ? b.dataset.reason : "";
  });
  $("datePick").addEventListener("click", (e) => { if (e.target === $("datePick")) closeDatePicker(); });
  $("dpPrev").addEventListener("click", () => { if (dp) { dp.month = monthAdd(dp.month, -1); renderDatePicker(); } });
  $("dpNext").addEventListener("click", () => { if (dp) { dp.month = monthAdd(dp.month, 1); renderDatePicker(); } });
  $("dpToday").addEventListener("click", () => { if (dp) { dp.month = today().slice(0, 7); renderDatePicker(); } });
  { const g = $("dpGrid"); let sx = null, sy = null, swiped = false;
    g.addEventListener("pointerdown", (e) => { if (!e.isPrimary) return; sx = e.clientX; sy = e.clientY; swiped = false; });
    g.addEventListener("pointermove", (e) => { if (sx === null || !e.isPrimary) return; const dx = e.clientX - sx, dy = e.clientY - sy; if (Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy)) { try { g.setPointerCapture(e.pointerId); } catch {} } });
    g.addEventListener("pointerup", (e) => { if (sx === null || !dp) return; const dx = e.clientX - sx, dy = e.clientY - sy; sx = sy = null; if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.5) { swiped = true; dp.month = monthAdd(dp.month, dx < 0 ? 1 : -1); renderDatePicker(); setTimeout(() => { swiped = false; }, 0); } });
    g.addEventListener("pointercancel", () => { sx = sy = null; });
    g.addEventListener("click", (e) => { if (swiped) { e.stopPropagation(); e.preventDefault(); } }, true);
  }
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && dp) closeDatePicker(); if (e.key === "Escape" && es) closeFinishEarly(); });
  $("calToday").addEventListener("click", () => { calMonth = today().slice(0, 7); calAnchor = calMonth; if (S.view.name === "client") renderClient(); });
  {
    const view_ = $("calView"), track = $("calTrack");
    const reduced = () => window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let busy = false, sx = null, sy = null, dragging = null, dx = 0, swallow = false, finishNow = null;
    const settle = (dir) => {                      // slide to the neighbour panel, then re-render around the new month
      if (busy) { if (finishNow) finishNow(); else return; }
      busy = true; calSliding = true;
      if (dir) { calMonth = monthAdd(calMonth, dir); $("calTitle").textContent = monthTitle(calMonth); $("calToday").hidden = calMonth === today().slice(0, 7); }
      const target = track.children[1 + (dir || 0)];
      void view_.offsetHeight; view_.style.transition = "";
      if (target) view_.style.height = target.offsetHeight + "px";
      let done = false;
      const finish = () => { if (done) return; done = true; finishNow = null; track.removeEventListener("transitionend", finish); busy = false; calSliding = false; view_.style.transition = ""; if (dir && S.view.name === "client") renderClient(); else view_.style.height = track.children[1].offsetHeight + "px"; };
      finishNow = finish;
      if (reduced()) { track.style.transition = "none"; track.style.transform = "translateX(" + (-100 - (dir || 0) * 100) + "%)"; finish(); return; }
      track.addEventListener("transitionend", finish);
      track.style.transition = "transform 280ms cubic-bezier(0.22, 1, 0.36, 1)";
      track.style.transform = "translateX(" + (-100 - (dir || 0) * 100) + "%)";
      setTimeout(finish, 360);
    };
    $("calPrev").addEventListener("click", () => settle(-1));
    $("calNext").addEventListener("click", () => settle(1));
    view_.addEventListener("pointerdown", (e) => { if (!e.isPrimary) return; if (busy && finishNow) finishNow(); if (busy) return; sx = e.clientX; sy = e.clientY; dragging = null; dx = 0; });
    view_.addEventListener("pointermove", (e) => {
      if (sx === null || busy || !e.isPrimary) return;
      dx = e.clientX - sx; const dy = e.clientY - sy;
      if (dragging === null) { if (Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy)) { dragging = true; try { view_.setPointerCapture(e.pointerId); } catch {} } else if (Math.abs(dy) > 8) dragging = false; }
      if (dragging) {
        track.style.transition = "none"; track.style.transform = "translateX(calc(-100% + " + dx + "px))";
        const centre = track.children[1], side = track.children[dx < 0 ? 2 : 0];
        if (centre && side) { const f = Math.min(1, Math.abs(dx) / Math.max(1, view_.clientWidth)); view_.style.transition = "none"; view_.style.height = Math.round(centre.offsetHeight + (side.offsetHeight - centre.offsetHeight) * f) + "px"; }
      }
    });
    const release = (cancel) => {
      if (sx === null) return; const was = dragging; const moved = dx; sx = sy = null; dragging = null; dx = 0;
      if (!was) return;
      swallow = true; setTimeout(() => { swallow = false; }, 0);
      if (!cancel && Math.abs(moved) > 48) settle(moved < 0 ? 1 : -1); else settle(0);
    };
    view_.addEventListener("pointerup", () => release(false));
    view_.addEventListener("pointercancel", () => release(true));
    view_.addEventListener("click", (e) => { if (swallow) { e.stopPropagation(); e.preventDefault(); } }, true);
  }

  // ---------- the client page overview: workouts done, and the heaviest set ever on any exercise they have logged ----------
  const overviewCounts = (list, month) => { const done = list.filter((t) => t.completedAt); return { total: done.length, month: done.filter((t) => effDate(t).slice(0, 7) === month).length }; };
  function loggedExercises(c) {                                      // canon key -> { name, count, best, timed }, from every session of this client
    const canon = (x) => squash(ALIASES[String(x || "").trim()] || x); const map = new Map();
    for (const t of clientTrainings(c.id)) for (const r of t.rows || []) {   // newest first: the name keeps its latest spelling
      const k = canon(r.name); if (!k) continue;
      const e = map.get(k) || { name: String(r.name || "").trim(), count: 0, best: null, timed: !!timedPlan(r.reps) };
      const st = topSet(r, e.timed); if (!st) continue;
      st.date = effDate(t); st.title = String(t.title || "").trim(); e.count++; if (betterSet(st, e.best, e.timed)) e.best = st; map.set(k, e);
    }
    return map;
  }
  let ovFor = null, ovPick = "";                                     // the exercise looked up, kept while the page stays open
  const fmtSetFor = (c, e) => { const u = c.unit || "lb", st = e.best; return e.timed ? (st.w != null ? st.w + " " + u + " \u00d7 " : "") + st.rp + " sec" : st.w != null ? st.w + " " + u + (st.rp != null ? " \u00d7 " + st.rp : "") : st.rp + (st.rp === 1 ? " rep" : " reps"); };
  function paintOvBest() {
    const c = clients.get(S.view.id); const box = $("ovBest"); if (!c || !ovPick) { box.hidden = true; return; }
    const e = loggedExercises(c).get(ovPick); box.hidden = false;
    $("ovBestBtn").hidden = !e; $("ovNone").hidden = !!e; if (!e) { $("ovNone").textContent = "Nothing logged yet"; return; }
    $("ovBestVal").textContent = fmtSetFor(c, e); box._e = e;
  }
  function suggestOv(v) {
    const c = clients.get(S.view.id), ul = $("ovSugg"); if (!c) { ul.hidden = true; return; }
    const s = squash(v), all = [...loggedExercises(c).entries()];
    const hits = (s ? all.filter(([k]) => k.includes(s)).sort((a, b) => (b[0].startsWith(s) - a[0].startsWith(s)) || b[1].count - a[1].count) : all.sort((a, b) => b[1].count - a[1].count)).slice(0, 8);   // nothing typed: what they do most
    ul.replaceChildren(...hits.map(([k, e]) => { const li = document.createElement("li"); const b = document.createElement("button"); b.type = "button"; b.textContent = e.name; b.addEventListener("mousedown", (ev) => ev.preventDefault()); b.addEventListener("click", () => { ovPick = k; $("ovEx").value = e.name; $("ovClear").hidden = false; ul.hidden = true; $("ovEx").blur(); paintOvBest(); }); li.appendChild(b); return li; }));
    ul.hidden = hits.length === 0;
  }
  function renderOverview(c) {
    const n = overviewCounts(clientTrainings(c.id), today().slice(0, 7));
    $("ovTotal").textContent = String(n.total); $("ovMonth").textContent = String(n.month);
    if (ovFor !== c.id) { ovFor = c.id; ovPick = ""; $("ovEx").value = ""; $("ovClear").hidden = true; $("ovSugg").hidden = true; }
    $("overview").hidden = false; paintOvBest();
  }
  // ---- what a client did on their own that the coach has not seen: finished workouts (cleared when the profile opens) and notes (each cleared when tapped).
  // "Seen" lives on the client's record (seenDoneAt, seenNotes), so every device of the coach agrees.
  const noteId = (t, r) => "row/" + t.id + "/" + r.id;
  function clientNews(c) {
    if (!c || isTemplateClient(c.id)) return { done: 0, notes: [], workouts: [] };
    const since = Date.parse(c.seenDoneAt || "") || 0, seen = new Set(c.seenNotes || []);
    let done = 0; const notes = [], workouts = [];
    for (const t of clientTrainings(c.id)) {
      if (t.completedBy === "client" && t.completedAt && (Date.parse(t.completedAt) || 0) > since) { done++; workouts.push(t); }
      for (const r of t.rows || []) if (r.clientNote && r.clientNoteBy === "client" && !seen.has(noteId(t, r))) notes.push({ id: noteId(t, r), t, r, at: r.clientNoteAt || "" });
    }
    notes.sort((a, b) => (b.at > a.at ? 1 : b.at < a.at ? -1 : 0));   // newest first
    workouts.sort((a, b) => (b.completedAt > a.completedAt ? 1 : b.completedAt < a.completedAt ? -1 : 0));
    return { done, notes, workouts };
  }
  function packWords(c) {                                                  // the Clients list: where the client stands on their package
    const pk = c && c.plan && c.plan.id ? c.plan : null; if (!pk) return "";
    if (pk.kind === "monthly") {
      if (!pk.until) return "";
      const days = Math.round((Date.parse(pk.until) - Date.parse(today())) / 86400000);
      return days < 0 ? "Plan ended" : days === 0 ? "Ends today" : days + (days === 1 ? " day left" : " days left");
    }
    const pr = planProgress(pk, clientTrainings(c.id)); return pr ? pr.inPack + " of " + pr.size : "";
  }
  function newsWords(n) {
    const parts = [];
    if (n.done) parts.push(n.done === 1 ? "Finished a workout" : "Finished " + n.done + " workouts");
    if (n.notes.length) parts.push(n.notes.length === 1 ? "1 note" : n.notes.length + " notes");
    return parts.join(" \u00b7 ");
  }
  function markWorkoutsSeen(c) { if (!clientNews(c).done) return; c.seenDoneAt = now(); scheduleSave("clients", c.id); }
  function markNoteSeen(c, id) {
    const all = new Set(); for (const t of clientTrainings(c.id)) for (const r of t.rows || []) if (r.clientNote && r.clientNoteBy === "client") all.add(noteId(t, r));
    const seen = (c.seenNotes || []).filter((x) => all.has(x));           // forget notes that are gone
    if (!seen.includes(id)) seen.push(id);
    c.seenNotes = seen; scheduleSave("clients", c.id);
  }
  function openClientNote(c, x) {                                          // the tap on a new note: it counts as seen, and the workout opens on that card with the note unfolded
    markNoteSeen(c, x.id);
    const t = x.t, rows = [...(t.rows || [])].sort((a, b) => cmpLabel(a.label, b.label)), i = rows.indexOf(x.r);
    if (i >= 0) { const selKey = t.id + "/" + groupKey(x.r.label, i); openBlocks.add(selKey); openExNotes.add(selKey); }
    go({ name: "training", id: t.id }); followRow(x.r.id);
  }
  let notifOpen = null;                                                   // the client whose Notifications panel is open; closing it (or leaving the page) marks the workouts seen
  function closeNotif() { if (!notifOpen) return; const c = clients.get(notifOpen); notifOpen = null; if (c) markWorkoutsSeen(c); }
  function renderNotif(c) {
    const wrap = $("notifWrap"), ul = $("notifList"), n = clientNews(c), total = n.done + n.notes.length, open = notifOpen === c.id;
    wrap.hidden = false; $("notifCount").hidden = !total; $("notifCount").textContent = total; $("notifNone").hidden = !!total || open;
    $("notifBtn").setAttribute("aria-expanded", String(open)); ul.hidden = !open; if (!open) { ul.replaceChildren(); return; }
    const items = [];
    for (const t of n.workouts) {
      const li = document.createElement("li"), b = document.createElement("button"); b.type = "button";
      b.innerHTML = '<span class="nm"><span></span><span class="n2"></span></span><span class="sub"><span class="chev">&rsaquo;</span></span>';
      b.firstChild.firstChild.textContent = "Finished " + (String(t.title || "").trim() || "a workout"); b.firstChild.lastChild.textContent = whenDay(effDate(t) || String(t.date || ""), true);
      b.addEventListener("click", () => go({ name: "training", id: t.id })); li.appendChild(b); items.push(li);
    }
    for (const x of n.notes) {
      const li = document.createElement("li"), b = document.createElement("button"); b.type = "button"; b.className = "nn";
      b.innerHTML = '<span class="nn-top"><span class="nn-ex"></span><span class="sub"></span></span><span class="nn-text"></span>';
      b.querySelector(".nn-ex").textContent = "Note on " + (String(x.r.name || "").trim() || "an exercise");
      const day = whenDay(effDate(x.t) || String(x.t.date || ""), true); b.querySelector(".sub").textContent = [day, String(x.t.title || "").trim()].filter(Boolean).join(" \u00b7 ");
      b.querySelector(".sub").insertAdjacentHTML("beforeend", '<span class="chev">&rsaquo;</span>');
      b.querySelector(".nn-text").textContent = x.r.clientNote;
      b.addEventListener("click", () => openClientNote(c, x)); li.appendChild(b); items.push(li);
    }
    if (!items.length) { const li = document.createElement("li"); li.className = "empty"; li.style.padding = "12px 16px"; li.textContent = "Nothing new"; items.push(li); }
    ul.replaceChildren(...items);
  }
  $("notifBtn").addEventListener("click", () => { const c = clients.get(S.view.id); if (!c) return; if (notifOpen === c.id) closeNotif(); else notifOpen = c.id; renderClient(); });
  function renderClient() {
    const c = clients.get(S.view.id);
    const isTpl = isTemplateClient(c.id);
    $("vClient").classList.toggle("tpl", isTpl); $("vClient").dataset.tab = S.tab;
    $("newTraining").textContent = isTpl ? "+ New template" : "+ New workout";
    if (!isTpl) { $("tplList").hidden = true; $("pickNote").hidden = true; }
    $("tplKicker").hidden = !isTpl; $("pausedKicker").hidden = isTpl || !effPaused(c); $("pausedKicker").textContent = c.paused ? "Access paused" : "Plan ended";
    if (isTpl) { $("cName").readOnly = true; $("overview").hidden = true; $("planCard").hidden = true; renderTemplates(c); $("delClientConfirm").hidden = true; return; }
    $("cName").value = c.name; $("cName").readOnly = true; renderPlanCard(c); renderOverview(c); paintPlanDetails(c);
    if (!S.clientMode) renderNotif(c); else $("notifWrap").hidden = true;
    if (document.activeElement !== $("cNameField")) $("cNameField").value = c.name || "";
    if (document.activeElement !== $("cEmail")) $("cEmail").value = c.email || "";
    if (document.activeElement !== $("cPhone")) $("cPhone").value = c.phone || "";
    if (document.activeElement !== $("cBirthday")) $("cBirthday").value = c.birthday || "";
    if (detailsFor !== c.id) { detailsFor = c.id; detailsOpen = false; }
    $("detailsBody").hidden = !detailsOpen; $("detailsBtn").classList.toggle("open", detailsOpen); $("detailsBtn").setAttribute("aria-expanded", String(detailsOpen));
    $("detailsBtn").classList.toggle("needs", !c.email);
    for (const b of $("chatSeg").querySelectorAll("button")) b.classList.toggle("on", (c.chat || "sms") === b.dataset.chat);
    paintMsg(c); paintTrainerMsg(c);
    for (const b of $("unitSeg").querySelectorAll("button")) b.classList.toggle("on", (c.unit || "lb") === b.dataset.unit);
    for (const b of $("accessSeg").querySelectorAll("button")) b.classList.toggle("on", (c.paused ? "paused" : "active") === b.dataset.access);
    $("pausedCard").hidden = !(effPaused(c) && S.clientMode);
    $("pausedText").textContent = phoneDigits(c.trainerPhone) ? "Your workouts are on hold for now. Message Michal when you’re ready to pick up again." : "Your workouts are on hold for now. Michal will switch them back on when you’re ready to pick up again.";
    $("pausedCard").firstElementChild.textContent = !c.paused && effPaused(c) ? "Plan ended" : "Access paused";
    if (!c.paused && effPaused(c)) $("pausedText").textContent = "Your plan ended " + fmtDay(c.plan.until) + ". Message Michal to pick it up again.";
    document.body.classList.toggle("paused", !!(effPaused(c) && S.clientMode));
    if (document.activeElement !== $("cNotes")) $("cNotes").value = noteDraft.get(c.id) || "";
    $("noteActions").hidden = !String($("cNotes").value).trim(); growNotesBox();
    renderNotes(c);
    if (!S.clientMode) {                                                        // the report row: the last two years of months to pick from
      const sel = $("reportMonth"), base = new Date(today() + "T12:00:00"); sel.replaceChildren(new Option("Pick a month", ""));
      for (let i = 1; i <= 24; i++) { const d = new Date(base.getFullYear(), base.getMonth() - i, 1, 12); sel.appendChild(new Option(d.toLocaleDateString(undefined, { month: "long", year: "numeric" }), localIso(d).slice(0, 7))); }
      loadReportFonts();
    }
    if (!S.clientMode && (!S.sb || S.syncedOnce)) for (const t of clientTrainings(c.id)) if (isEmptyWorkout(t)) { trainings.delete(t.id); scheduleSave("trainings", t.id, 0); }   // empty workouts left behind (an accidental tap on a day) go away, once the server's copy has been seen
    const list = clientTrainings(c.id);
    const relDay = (iso) => {                                            // "Today", "Tomorrow", "In 4 days", "Yesterday", "3 days ago"
      const n = Math.round((new Date(iso + "T12:00:00") - new Date(today() + "T12:00:00")) / 86400000);
      if (!Number.isFinite(n)) return "";                                  // no date on the record: no caption
      if (n === 0) return "Today"; if (n === 1) return "Tomorrow"; if (n === -1) return "Yesterday";
      if (n > 1) return n < 14 ? "In " + n + " days" : "In " + Math.round(n / 7) + " weeks";
      return n > -14 ? (-n) + " days ago" : Math.round(-n / 7) + " weeks ago";
    };
    const rowOf = (t, next) => {
      const li = document.createElement("li"); const b = document.createElement("button"); b.type = "button";
      if (next) li.className = "next";
      const cards = new Map();
      t.rows.forEach((r, i) => { const k = groupKey(r.label, i); if (!cards.has(k)) cards.set(k, true); if (!r.done) cards.set(k, false); });
      const total = cards.size, done = [...cards.values()].filter(Boolean).length;
      const d = new Date(effDate(t) + "T12:00:00");
      const pri = document.createElement("span"); pri.className = "pri";
      const skipped = !t.completedAt && !!t.skippedAt;
      pri.textContent = (t.completedAt ? "\u2713 " : skipped ? (t.missed === true ? "Missed \u00b7 " : "Skipped \u00b7 ") : "") + d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
      if (skipped) pri.style.color = "var(--text-tertiary)";
      const sec = document.createElement("span"); sec.className = "sec";
      sec.textContent = [t.title, !t.completedAt && done ? done + " of " + total + " done" : ""].filter(Boolean).join(" \u00b7 ");
      const left = document.createElement("span"); left.style.minWidth = "0";
      const overdue = next && !skipped && !t.completedAt && !!effDate(t) && effDate(t) < today();
      const whenText = next ? (overdue ? "Missed \u00b7 " : "") + relDay(effDate(t)) : "";
      if (whenText) { const when = document.createElement("span"); when.className = "when" + (overdue ? " missed" : ""); when.textContent = whenText; left.append(when); }
      let acts = null;
      if (overdue) {                                                       // the missed workout is the first thing to decide
        acts = document.createElement("div"); acts.className = "missed-actions";
        const doToday = document.createElement("button"); doToday.type = "button"; doToday.className = "btn tint"; doToday.textContent = "Do it today";
        doToday.addEventListener("click", () => { t.date = today(); t.missed = false; t.skippedAt = null; touchState(t.id, "date", "missed", "skippedAt"); if (S.clientMode) { pendingMove.add(t.id); pendingMiss.add(t.id); } scheduleSave("trainings", t.id); renderClient(); });
        const skip = document.createElement("button"); skip.type = "button"; skip.className = "btn tint"; skip.textContent = "Skip";
        skip.addEventListener("click", () => { t.skippedAt = now(); t.missed = false; touchState(t.id, "skippedAt", "missed"); if (S.clientMode) { pendingSkip.add(t.id); pendingMiss.add(t.id); } scheduleSave("trainings", t.id); renderClient(); });
        acts.append(doToday, skip);
      }
      left.append(pri); if (sec.textContent) left.append(sec);
      const chev = document.createElement("span"); chev.className = "chev"; chev.textContent = "\u203a";
      b.append(left, chev);
      b.addEventListener("click", () => go({ name: "training", id: t.id }));
      li.appendChild(b); if (acts) li.appendChild(acts); return li;       // the choices sit under the row
    };

    const base = new Date(); base.setHours(12, 0, 0, 0);
    const monday = new Date(base); monday.setDate(base.getDate() - ((base.getDay() + 6) % 7));
    const iso = (d) => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
    const weekEl = $("week"); weekEl.replaceChildren();
    const weekStart = iso(monday);
    const dayButton = (d, withWeekday) => {
      const key = iso(d);
      const dayWorkouts = list.filter((t) => effDate(t) === key && !(t.skippedAt && !t.completedAt));
      const b = document.createElement("button"); b.type = "button";
      if (key === today()) { b.classList.add("today"); b.setAttribute("aria-current", "date"); }
      if (withWeekday) { const wd = document.createElement("span"); wd.className = "wd"; wd.textContent = d.toLocaleDateString(undefined, { weekday: "short" }).slice(0, 3); b.appendChild(wd); }
      const dn = document.createElement("span"); dn.className = "dn"; dn.textContent = String(d.getDate());
      if (dayWorkouts.length) b.classList.add(dayWorkouts.every((t) => t.completedAt) ? "finished" : "planned");
      const dot = document.createElement("span"); dot.className = "dot";
      b.append(dn, dot);
      b.setAttribute("aria-label", d.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" }) + (dayWorkouts.length ? (dayWorkouts.every((t) => t.completedAt) ? ", finished" : ", planned") : ""));
      b.addEventListener("click", () => {
        if (dayWorkouts.length) go({ name: "training", id: dayWorkouts[0].id });
        else if (!S.clientMode) addTraining(c.id, null, key);
      });
      return b;
    };
    for (let i = 0; i < 7; i++) { const d = new Date(monday); d.setDate(monday.getDate() + i); weekEl.appendChild(dayButton(d, true)); }
    // month view: three months on a sliding track (previous, shown, next) so a swipe follows the finger
    $("calToggleText").textContent = calOpen ? "Week" : "Month"; $("calToggle").classList.toggle("open", calOpen); $("calToggle").setAttribute("aria-expanded", String(calOpen));
    weekEl.hidden = calOpen; $("calWrap").hidden = !calOpen;
    if (calOpen) {
      // a new client, or the month rolling over while "this month" is shown, re-anchors to today; a browsed month stays
      const cur = today().slice(0, 7);
      if (calFor !== c.id || (cur !== calAnchor && calMonth === calAnchor)) calMonth = cur;
      calFor = c.id; calAnchor = cur;
      const panel = (ym) => {
        const [y, m] = ym.split("-").map(Number);
        const first = new Date(y, m - 1, 1, 12, 0, 0, 0);
        const wrap = document.createElement("div"); wrap.className = "cal-panel"; wrap.dataset.ym = ym;
        const cal = document.createElement("div"); cal.className = "cal";
        const lead = (first.getDay() + 6) % 7;
        for (let i = 0; i < lead; i++) { const b = document.createElement("button"); b.type = "button"; b.className = "out"; b.tabIndex = -1; b.setAttribute("aria-hidden", "true"); cal.appendChild(b); }
        const days = new Date(y, m, 0).getDate();
        for (let day = 1; day <= days; day++) cal.appendChild(dayButton(new Date(y, m - 1, day, 12, 0, 0, 0), false));
        wrap.appendChild(cal); return wrap;
      };
      const track = $("calTrack");
      if (calSliding) return;                      // a slide is in flight: finish() re-renders when it lands
      track.style.transition = "none"; track.style.transform = "translateX(-100%)";
      track.replaceChildren(panel(monthAdd(calMonth, -1)), panel(calMonth), panel(monthAdd(calMonth, 1)));
      for (const p of [track.children[0], track.children[2]]) p.setAttribute("aria-hidden", "true");
      for (const b of track.children[1].querySelectorAll("button")) { if (!b.classList.contains("out")) b.tabIndex = 0; }
      for (const p of [track.children[0], track.children[2]]) for (const b of p.querySelectorAll("button")) b.tabIndex = -1;
      $("calTitle").textContent = monthTitle(calMonth);
      $("calToday").hidden = calMonth === cur;
      $("calView").style.height = track.children[1].offsetHeight + "px";
    }

    // missed by more than a week with nothing logged: it files itself under History as "Missed"
    const stale = (() => { const d = new Date(base); d.setDate(base.getDate() - 7); return iso(d); })();
    const nothingLogged = (t) => (t.rows || []).every((r) => !r.done && !(parseInt(r.setsDone, 10) > 0) && !(r.weights || []).some((w) => String(w == null ? "" : w).trim()) && !(r.repsDone || []).some((x) => String(x == null ? "" : x).trim()));
    if (!S.sb || S.syncedOnce) for (const t of list) {                              // only once this device has seen the server's copy
      if (t.completedAt || t.skippedAt || t.missed !== undefined || !effDate(t) || effDate(t) >= stale || !nothingLogged(t)) continue;   // missed: true = filed before, false = a person decided
      t.skippedAt = now(); t.missed = true; if (S.clientMode) pendingMiss.add(t.id); scheduleSave("trainings", t.id);
    }
    const next = list.filter((t) => !t.completedAt && !t.skippedAt).sort((a, b) => effDate(a).localeCompare(effDate(b)));
    // keep it short: anything due within the next few days (the very next workout always shows);
    // "Show more" adds the next few workouts each tap, "Show less" folds back to the short list
    if (nextFor !== c.id) { nextFor = c.id; nextExtra = 0; }
    const edge = new Date(base); edge.setDate(base.getDate() + NEXT_DAYS); const horizon = iso(edge);
    const soon = next.filter((t, i) => i === 0 || effDate(t) <= horizon);
    nextExtra = Math.max(0, Math.min(nextExtra, next.length - soon.length));
    const shown = next.slice(0, soon.length + nextExtra), left = next.length - shown.length;
    $("nextHead").hidden = next.length === 0; $("nextList").hidden = next.length === 0;
    $("nextList").replaceChildren(...shown.map((t, i) => rowOf(t, i === 0)));
    if (left > 0 || nextExtra > 0) {
      const li = document.createElement("li"); li.className = "more"; const bar = document.createElement("div");
      if (left > 0) {
        const b = document.createElement("button"); b.type = "button";
        const sub = document.createElement("span"); sub.className = "sub"; sub.textContent = left + " more";
        b.append("Show more", sub); b.addEventListener("click", () => { nextExtra += NEXT_STEP; renderClient(); });
        bar.appendChild(b);
      }
      if (nextExtra > 0) {
        const b = document.createElement("button"); b.type = "button"; b.textContent = "Show less";
        b.addEventListener("click", () => { nextExtra = 0; renderClient(); });
        bar.appendChild(b);
      }
      li.appendChild(bar); $("nextList").appendChild(li);
    }

    const rest = list.filter((t) => !next.includes(t));
    const months = new Map();
    for (const t of rest) { const k = effDate(t).slice(0, 7); if (!months.has(k)) months.set(k, []); months.get(k).push(t); }
    const hist = $("histList"); hist.replaceChildren();
    $("histHead").hidden = rest.length === 0;
    for (const [k, items] of months) {
      const wrap = document.createElement("div"); wrap.className = "month";
      const head = document.createElement("button"); head.type = "button";
      const md = new Date(k + "-15T12:00:00");
      head.innerHTML = "<span></span><span class=\"sub\"></span>";
      head.firstChild.textContent = md.toLocaleDateString(undefined, { month: "long", year: "numeric" });
      head.lastChild.textContent = items.length + (items.length === 1 ? " workout" : " workouts") + " \u203a";
      const ul = document.createElement("ul"); ul.className = "list"; ul.hidden = true;       // every month starts folded; a tap opens it
      ul.replaceChildren(...items.map((t) => rowOf(t)));
      head.addEventListener("click", () => { ul.hidden = !ul.hidden; });
      wrap.append(head, ul); hist.appendChild(wrap);
    }
    $("trainingEmpty").hidden = list.length > 0;
    $("delClientConfirm").hidden = true; $("delClient").hidden = false;
  }

  function paintFinish(t) {
    $("finishWrap").hidden = t.rows.length === 0;
    const done = !!t.completedAt, skipped = !done && !!t.skippedAt;
    $("finishBtn").hidden = done || skipped; $("finishedLine").hidden = !done;
    $("skipLine").hidden = done || skipped; $("skippedLine").hidden = !skipped;
    if (skipped) $("skippedText").textContent = t.missed === true ? "Missed" : "Skipped";
    if (done) { const d = new Date(t.completedAt); $("finishedText").textContent = "\u2713 Finished \u00b7 " + d.toLocaleDateString(undefined, { month: "short", day: "numeric" }) + ", " + d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }); }
  }
  const ordinal = (n) => { const s = ["th", "st", "nd", "rd"], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); };
  function setFinished(finished) {
    const t = trainings.get(S.view.id); if (!t) return;
    if (!finished && t.completedAt) {                                     // undo keeps it on the day it was done, and no sweep files it by itself
      const day = localIso(new Date(t.completedAt));
      if (/^\d{4}-\d{2}-\d{2}$/.test(day) && day !== t.date) { t.date = day; touchState(t.id, "date"); if (S.clientMode) pendingMove.add(t.id); }
      t.missed = false; touchState(t.id, "missed"); if (S.clientMode) pendingMiss.add(t.id);
    }
    t.completedAt = finished ? now() : null; touchState(t.id, "completedAt");
    if (finished && S.clientMode) t.completedBy = "client"; else delete t.completedBy; touchState(t.id, "completedBy");   // a client's own finish is news for the coach; one the coach logs is not
    if (finished && t.skippedAt) { t.skippedAt = null; t.missed = false; touchState(t.id, "skippedAt", "missed"); if (S.clientMode) { pendingSkip.add(t.id); pendingMiss.add(t.id); } }   // finished beats skipped
    if (finished && !S.clientMode && /^\d{4}-\d{2}-\d{2}$/.test(t.date || "") && t.date < today()) {   // the coach logging a past session: it was done on that day
      const d = new Date(); const [y, m, dd] = t.date.split("-").map(Number); d.setFullYear(y, m - 1, dd);
      if (!isNaN(d)) t.completedAt = d.toISOString();
    }
    if (S.clientMode) pendingFinish.add(t.id);
    scheduleSave("trainings", t.id); paintFinish(t);
    if (finished) {
      const count = clientTrainings(t.clientId).filter((x) => x.completedAt).length;
      const pc = clients.get(t.clientId), sn = pc && pc.plan ? sessionNo(pc.plan, clientTrainings(t.clientId), t) : null;
      $("celeText").textContent = (sn ? "Session " + sn.n + " of " + sn.size + ". " : "") + "That\u2019s your " + ordinal(count) + " workout. Nice work.";
      const canMsg = !S.clientMode && fillMsg($("celeMsg"), $("celeMsgText"), pc); $("celeMsg").hidden = !canMsg;   // the coach can text the client right from here, from either view; a real client never sees it
      celebrating = true; render();
      window.scrollTo(0, 0);
      clearTimeout(celeTimer);
      celeTimer = setTimeout(() => { if (celebrating) $("celeBack").click(); }, 4000);   // 4 s, then back to the client page by itself (his call: the timer stays even with Message up)
    }
  }
  let celeTimer = null, celebrating = false;   // the "Nice work" screen is a state, not just a visible panel: a sync's redraw can't knock it off
  $("celeBack").addEventListener("click", () => { clearTimeout(celeTimer); celebrating = false; const t = trainings.get(S.view.id); go({ name: "client", id: t ? t.clientId : S.myClientId }); });

  function renderTraining(t) {
    if (document.activeElement !== $("tTitle")) { $("tTitle").value = t.title || ""; requestAnimationFrame(() => { const el = $("tTitle"); el.style.height = "auto"; el.style.height = Math.max(32, el.scrollHeight) + "px"; }); }
    $("tDate").textContent = fmtDay(t.date || today());
    const asClient = S.clientMode || previewClient; paintSessionPill(t, asClient);
    $("tTitle").readOnly = asClient; $("tDate").disabled = asClient;
    const isTpl = isTemplateClient(t.clientId);
    if (isTpl) draftFor(t);
    paintTrainerMsg(clients.get(t.clientId));
    const src = !asClient && !isTpl && t.fromTemplate ? trainings.get(t.fromTemplate) : null;
    $("fromTpl").hidden = !src; if (src) $("fromTplText").textContent = templatePath(src);
    $("tplFill").hidden = asClient || isTpl || (t.rows || []).length > 0 || !!t.completedAt;   // only an empty workout offers a template
    $("tNoteWrap").hidden = S.clientMode || isTpl;                                                // the coach's session note, in either view, never for a client
    paintWorkoutNotes(t);
    const open = tNoteOpenFor === t.id;
    $("tNoteBox").hidden = !open; $("tNoteOpen").hidden = open;
    if (document.activeElement !== $("tNote")) { $("tNote").value = tNoteDraft.get(t.id) || ""; growBox($("tNote")); }
    $("vTraining").classList.toggle("tpl", isTpl); $("useWrap").hidden = !isTpl || S.clientMode;
    $("viewSeg").hidden = S.clientMode || isTpl; for (const b of $("viewSeg").querySelectorAll("button")) b.classList.toggle("on", (b.dataset.view === "client") === previewClient); if (!isTpl) $("usePick").hidden = true;
    $("tTitle").placeholder = isTpl ? "Template name, e.g. Upper body A" : "Focus, e.g. Bench-press and back";
    paintFinish(t);
    const rowsEl = $("rows");
    const active = document.activeElement;
    if (S.renderedTraining === t.id && (S.asking || (rowsEl.contains(active) && (active.tagName === "INPUT" || active.tagName === "TEXTAREA")))) return; // never rebuild under a typing finger, nor under a confirm sheet
    S.renderedTraining = t.id;
    const sc = document.scrollingElement || document.documentElement, keepScroll = sc.scrollTop;   // the cards are rebuilt in place (every sync does it): the page must not move while it is empty
    if (!S.clientMode && normalizeLabels(t)) scheduleSave("trainings", t.id);
    t.rows.sort((a, b) => cmpLabel(a.label, b.label));
    if (closeOpenAlt) closeOpenAlt();
    rowsEl.replaceChildren();
    const groups = [];
    t.rows.forEach((r, i) => {
      const k = groupKey(r.label, i);
      if (!groups.length || groups[groups.length - 1].key !== k) groups.push({ key: k, rows: [] });
      groups[groups.length - 1].rows.push(r);
    });
    let numbered = 0;
    const currentKey = asClient && !isTpl ? (groups.find((g) => !g.rows.every((r) => r.done)) || {}).key : null;   // client: the first card not yet finished is the one open
    groups.forEach((g) => {
      const block = document.createElement("div");
      const warm = g.key === "w";
      block.className = "block"; block.dataset.key = g.key;
      if (g.rows.length >= 2 || warm || asClient) {
        const cap = document.createElement("div"); cap.className = "group-cap";
        const kind = g.rows.length < 2 ? "" : g.rows.length === 2 ? "Superset" : g.rows.length === 3 ? "Tri-set" : "Giant set";
        if (asClient) {                                        // client: a big numeral up here does the work the badge used to do
          const num = /^\d+$/.test(String(g.key)) ? String(g.key) : "";
          const big = document.createElement("b"); big.className = "num"; big.textContent = warm ? "Warmup" : "Exercise " + num;   // "Exercise 1", "Exercise 2 · Superset", "Warmup · Superset": always "Exercise N" first, so the numbers run in order
          if (kind) { const k = document.createElement("i"); k.className = "kind"; k.textContent = " \u00b7 " + kind; big.appendChild(k); }
          cap.appendChild(big);
        } else {
          const b = document.createElement("b"); b.textContent = warm ? (kind ? "Warmup \u00b7 " + kind : "Warmup") : kind;
          cap.appendChild(b);
        }
        if (kind) {                                            // the word stays; what it means is one tap away, in the frosted bubble (his call: cleaner)
          const after = g.rows.length === 2 ? "rest after both" : "rest after all " + g.rows.length;
          const name = (r) => asClient ? ((String(r.label || "").match(/^(?:\d+|w)([a-z])$/i) || [])[1] || r.label || "").toUpperCase() : r.label;
          const info = document.createElement("button"); info.type = "button"; info.className = "info"; info.textContent = "i"; info.setAttribute("aria-label", "What is a " + kind.toLowerCase() + "?");
          info.addEventListener("click", (e) => { e.stopPropagation(); showWhen(info, kind, g.rows.map(name).join(" + ") + " back to back \u00b7 " + after); });
          cap.appendChild(info);
        }
        block.appendChild(cap);
      }
      const card = document.createElement("div"); card.className = "group";
      const total = Math.max(...g.rows.map(setsOf));
      const doneSets = Math.min(...g.rows.map((r) => { const n = clamp(parseInt(r.setsDone, 10) || 0, 0, 20); return n >= setsOf(r) ? total : n; }));   // a shorter row that is finished does not hold the others back
      const selKey = t.id + "/" + g.key;
      let tracker = null;
      {
        let sel = null;
        if (!isTpl) { sel = setSel.has(selKey) ? setSel.get(selKey) : doneSets; sel = clamp(sel, 0, total - 1); g.sel = sel; }
        const tr = document.createElement("div"); tr.className = "tracker"; tr.setAttribute("aria-label", "Sets");
        const head = document.createElement("div"); head.className = "tr-head"; const chips = document.createElement("div"); chips.className = "tr-chips"; tr.append(head, chips);
        const lab = document.createElement("span"); lab.className = "tr-label"; lab.textContent = total + (total === 1 ? " set" : " sets"); head.appendChild(lab);   // "4 sets", then the chips
        for (let i = 0; i < total; i++) {
          const b = document.createElement("button"); b.type = "button"; b.textContent = String(i + 1);
          if (isTpl) { b.classList.add("static"); b.tabIndex = -1; }
          else {
            if (i < doneSets) b.classList.add("done");
            if (i === sel) b.classList.add("cur");
            b.setAttribute("aria-label", "Set " + (i + 1) + (i < doneSets ? ", done" : i === sel ? ", current" : ""));
            b.addEventListener("click", () => { setSel.set(selKey, i); S.renderedTraining = null; render(); });
          }
          chips.appendChild(b);
        }
        if (!asClient) {                                     // the trainer changes the number of sets right here, for every exercise in the card
          const setCount = async (n) => {
            n = clamp(n, 1, 20); if (n === total) return;
            const logged = n < total && g.rows.some((r) => [r.weights, r.repsDone].some((a) => String((a || [])[n] || "").trim()) || (parseInt(r.setsDone, 10) || 0) > n);
            if (logged && !(await askFirst({ title: "Drop set " + total + "?", text: "What was logged on it goes with it.", yes: "Drop" }))) return;
            for (const r of g.rows) {
              const was = setsOf(r), sd = clamp(parseInt(r.setsDone, 10) || 0, 0, 20), wasDone = !!r.done;
              r.sets = n;
              if (sd > n) r.setsDone = n;
              if (sd >= n) r.done = true; else if (r.done && sd >= was) { r.done = false; markEarly(t, r, ""); }   // a set added to a finished exercise reopens it; "finished early" stays finished
              if (!isTpl && (r.done !== wasDone || sd > n)) { if (!trainerTouched.has(t.id)) trainerTouched.set(t.id, new Set()); trainerTouched.get(t.id).add(r.id); }
            }
            setSel.delete(selKey); scheduleSave("trainings", t.id); S.renderedTraining = null; render();
          };
          const minus = document.createElement("button"); minus.type = "button"; minus.className = "step minus"; minus.textContent = "\u2212"; minus.setAttribute("aria-label", "One set fewer"); minus.disabled = total <= 1;
          const plus = document.createElement("button"); plus.type = "button"; plus.className = "step plus"; plus.textContent = "+"; plus.setAttribute("aria-label", "One set more"); plus.disabled = total >= 20;
          minus.addEventListener("click", () => setCount(total - 1)); plus.addEventListener("click", () => setCount(total + 1));
          const steps = document.createElement("div"); steps.className = "tr-steps"; steps.append(minus, plus); head.appendChild(steps);
        }
        tracker = tr;
      }
      const rowEls = g.rows.map((r) => rowEl(t, r, isTpl ? null : g));
      if (tracker) card.appendChild(tracker);
      rowEls.forEach((e) => card.appendChild(e));
      const foot = document.createElement("div"); foot.className = "card-foot";
      let resume = null, openFull = null;                  // undo for "Finish early": shown on the opened card while it is finished early; openFull: from the summary to the working card
      if (total > 0 && !isTpl) {
        const sel = g.sel, current = sel === doneSets && doneSets < total;
        const complete = document.createElement("label"); complete.htmlFor = "hapticSwitch"; complete.className = "btn complete"; complete.setAttribute("role", "button"); complete.tabIndex = 0;   // a label for the hidden switch: the tap itself gives the haptic on iPhone
        complete.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); complete.click(); } });
        complete.textContent = current ? (sel + 1 === total ? "Complete last set \u2192" : "Complete set \u2192") : "Back to set " + (Math.min(doneSets, total - 1) + 1);
        if (!current) { complete.classList.add("quiet-back"); if (doneSets >= total) complete.hidden = true; }
        const undo = document.createElement("button"); undo.type = "button"; undo.className = "finish-early undo-set"; undo.textContent = "Mark set " + (sel + 1) + " as not done";
        undo.hidden = !(sel < doneSets);
        undo.addEventListener("click", () => {                // this set and anything after it go back to not done
          for (const r of g.rows) { if (sel < setsOf(r)) { r.setsDone = Math.min(clamp(parseInt(r.setsDone, 10) || 0, 0, 20), sel); r.done = false; markEarly(t, r, ""); } const track = S.clientMode ? pendingWeightRows : trainerTouched; if (!track.has(t.id)) track.set(t.id, new Set()); track.get(t.id).add(r.id); }
          fullBlocks.delete(selKey); setSel.set(selKey, sel); scheduleSave("trainings", t.id); S.renderedTraining = null; render();
        });
        complete.addEventListener("click", () => {
          haptic();
          if (!current) { setSel.delete(selKey); setTimeout(() => { S.renderedTraining = null; render(); }, 0); return; }   // just go back to the current set
          const prevDone = doneSets;
          for (const r of g.rows) {
            if (sel >= setsOf(r)) continue;                                               // this exercise has fewer sets than the card
            r.weights = r.weights || []; r.repsDone = r.repsDone || [];
            while (r.weights.length <= sel) r.weights.push(""); while (r.repsDone.length <= sel) r.repsDone.push("");
            const last = lastWeights(t, r), carry = carried(r, sel), asW = (v) => (timedPlan(r.reps) && timeAsWeight(v) ? "" : v);   // a hold: "45 sec" from the old app is not a weight to copy
            if (!String(r.weights[sel] || "").trim()) r.weights[sel] = asW(carry.w) || asW(last && last.weights[sel] ? String(last.weights[sel]) : "");   // untouched box = same as the set before, else same as last time
            if (!String(r.repsDone[sel] || "").trim()) r.repsDone[sel] = carry.rp || (last && last.reps && last.reps[sel] ? String(last.reps[sel]) : "") || planNumber(r.reps);   // the grey number is what gets written: the set before, last time, else the plan's number (the highest of a range)
            if (current) r.setsDone = Math.max(clamp(parseInt(r.setsDone, 10) || 0, 0, 20), Math.min(prevDone + 1, setsOf(r)));
            if ((r.setsDone || 0) >= setsOf(r)) r.done = true;
            const track = S.clientMode ? pendingWeightRows : trainerTouched; if (!track.has(t.id)) track.set(t.id, new Set()); track.get(t.id).add(r.id);
          }
          if (g.rows.every((r) => r.done)) { openBlocks.delete(selKey); fullBlocks.delete(selKey); }
          setSel.delete(selKey); scheduleSave("trainings", t.id);
          setTimeout(() => { S.renderedTraining = null; render(); scrollToCard(g.key); }, 0);   // after the tap has flipped the switch (the iPhone tick), then redraw and glide
        });
        const early = document.createElement("button"); early.type = "button"; early.className = "finish-early"; early.textContent = "Finish early";
        early.addEventListener("click", () => openFinishEarly(t, g, selKey));
        resume = document.createElement("button"); resume.type = "button"; resume.className = "resume"; resume.hidden = true; resume.textContent = "Resume this " + groupWord(g);
        resume.addEventListener("click", () => {              // the remaining sets open again; what was logged stays, the reason goes
          for (const r of g.rows) { r.done = clamp(parseInt(r.setsDone, 10) || 0, 0, 20) >= setsOf(r); markEarly(t, r, ""); const track = S.clientMode ? pendingWeightRows : trainerTouched; if (!track.has(t.id)) track.set(t.id, new Set()); track.get(t.id).add(r.id); }
          openBlocks.delete(selKey); fullBlocks.delete(selKey); setSel.delete(selKey); scheduleSave("trainings", t.id); S.renderedTraining = null; render(); scrollToCard(g.key);
        });
        const first = g.rows[0], noteKey = selKey;
        const addNote = document.createElement("button"); addNote.type = "button"; addNote.className = "add-note";
        const noteIcon = '<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 2.5h6l2.5 2.5v8.5a.5.5 0 0 1-.5.5H4a.5.5 0 0 1-.5-.5v-10a.5.5 0 0 1 .5-.5z"/><path d="M6 8h4M6 10.5h4"/></svg>';
        early.insertAdjacentHTML("afterbegin", '<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 14V2.5"/><path d="M3.5 3h8l-2 2.5 2 2.5h-8"/></svg>');
        const noteBox = document.createElement("div"); noteBox.className = "exnote"; noteBox.hidden = true;
        const ta = document.createElement("textarea"); ta.rows = 1; ta.placeholder = "Something noticed on this exercise";
        const acts = document.createElement("div"); acts.className = "note-actions";
        const saveN = document.createElement("button"); saveN.type = "button"; saveN.className = "btn sm"; saveN.textContent = "Save note";
        const dropN = document.createElement("button"); dropN.type = "button"; dropN.className = "btn quiet"; dropN.textContent = "Discard";
        acts.append(saveN, dropN); noteBox.append(ta, acts);
        const shown = document.createElement("div"); shown.className = "client-note"; shown.hidden = true;
        const cap = document.createElement("div"); cap.className = "cap";
        const capText = document.createElement("span"); capText.textContent = "Note";
        const edit = document.createElement("button"); edit.type = "button"; edit.textContent = "Edit";
        const del = document.createElement("button"); del.type = "button"; del.className = "del"; del.textContent = "Delete";
        cap.append(capText, edit, del);
        const txt = document.createElement("div"); txt.className = "text";
        shown.append(cap, txt);
        const writeNote = (text) => {                                          // the client's or the coach's note on this exercise, this session
          if (text) { first.clientNote = text; first.clientNoteBy = S.clientMode ? "client" : "coach"; first.clientNoteAt = new Date().toISOString(); }   // who wrote it, and when (the server stamps a client's the same way)
          else { delete first.clientNote; delete first.clientNoteBy; delete first.clientNoteAt; }
          if (S.clientMode) { if (!pendingNoteRows.has(t.id)) pendingNoteRows.set(t.id, new Set()); pendingNoteRows.get(t.id).add(first.id); }
          else { if (!trainerTouched.has(t.id)) trainerTouched.set(t.id, new Set()); trainerTouched.get(t.id).add(first.id); }   // the coach's word on this row stands on a conflict
          scheduleSave("trainings", t.id);
        };
        const whose = () => {                                                  // the caption says who wrote it
          const by = first.clientNoteBy || "client", c = clients.get(t.clientId), name = String((c && c.name) || "").trim().split(/\s+/)[0];
          if (by === "coach") return "Coach note";
          return S.clientMode ? "Your note" : (name ? name + "\u2019s note" : "Client note");
        };
        const paintNote = () => {
          const has = !!first.clientNote, open = has && openExNotes.has(noteKey);
          addNote.innerHTML = '<span class="ico">' + noteIcon + (has ? '<i class="badge"></i>' : "") + "</span><span>" + (!has ? "Add note" : open ? "Hide note" : "See note") + "</span>";   // a red dot: there is a note here
          addNote.classList.toggle("has", has);
          shown.hidden = !open; txt.textContent = first.clientNote || ""; capText.textContent = whose();
        };
        const openComposer = () => { ta.value = String(first.clientNote || ""); noteBox.hidden = false; ta.style.height = "auto"; ta.style.height = Math.max(44, ta.scrollHeight) + "px"; ta.focus(); };
        addNote.addEventListener("click", () => { if (!first.clientNote) { if (noteBox.hidden) openComposer(); else noteBox.hidden = true; return; } if (openExNotes.has(noteKey)) openExNotes.delete(noteKey); else openExNotes.add(noteKey); paintNote(); });
        edit.addEventListener("click", openComposer);
        del.addEventListener("click", async () => { if (!(await askFirst({ title: "Delete this note?", text: S.clientMode ? "" : "It goes from this exercise and from the notes list." }))) return; writeNote(""); openExNotes.delete(noteKey); paintNote(); });
        ta.addEventListener("input", () => { ta.style.height = "auto"; ta.style.height = Math.max(44, ta.scrollHeight) + "px"; });
        dropN.addEventListener("click", async () => { const typed = ta.value.trim(); if (typed && typed !== String(first.clientNote || "").trim() && !(await askFirst({ title: "Discard what you wrote?", yes: "Discard" }))) return; noteBox.hidden = true; ta.value = ""; });
        saveN.addEventListener("click", async () => { const text = ta.value.trim(); if (!text && first.clientNote && !(await askFirst({ title: "Delete this note?", text: S.clientMode ? "" : "It goes from this exercise and from the notes list." }))) return; noteBox.hidden = true; writeNote(text); openExNotes.delete(noteKey); paintNote(); });   // saved and folded away: the dot says it is there; an emptied box is a delete and asks like one
        paintNote();
        openFull = document.createElement("button"); openFull.type = "button"; openFull.className = "resume resume-full"; openFull.hidden = true; openFull.textContent = "Resume this " + groupWord(g);   // from the summary to the working card
        openFull.addEventListener("click", () => { fullBlocks.add(selKey); paintSummary(); });
        const actsRow = document.createElement("div"); actsRow.className = "foot-row"; actsRow.append(early, addNote);
        const moreRow = document.createElement("div"); moreRow.className = "foot-row center"; moreRow.append(undo, resume, openFull);
        foot.append(shown, complete, moreRow, actsRow, noteBox);     // undo / resume first, then Finish early + Add note (his order)
      }
      const btn = document.createElement("button"); btn.type = "button"; btn.className = "done-btn";
      const fold = document.createElement("button"); fold.type = "button"; fold.className = "fold-btn";
      const sum = document.createElement("div"); sum.className = "card-sum";
      const paintSum = (all) => {
        sum.replaceChildren(); if (resume) resume.hidden = true; if (!all) return;
        const did = Math.min(...g.rows.map((r) => clamp(parseInt(r.setsDone, 10) || 0, 0, 20)));
        const early = g.rows.some((r) => r.done && clamp(parseInt(r.setsDone, 10) || 0, 0, 20) < setsOf(r));
        if (resume) resume.hidden = !early;
        const sets = (n) => n + " of " + total + (total === 1 ? " set" : " sets");
        const line = (text) => { const d = document.createElement("div"); d.textContent = text; sum.appendChild(d); };
        if (!early) { line("Finished \u00b7 " + sets(total)); return; }
        line("Finished early \u00b7 " + sets(did));
        const left = total - did, why = (g.rows.find((r) => r.earlyReason) || {}).earlyReason || "";
        line(left + (left === 1 ? " set" : " sets") + " not completed" + (why ? " \u00b7 " + why : ""));
      };
      const chev = document.createElement("button"); chev.type = "button"; chev.className = "card-chev";   // finished card: a chevron on the status line (folded) or in the corner (open)
      chev.innerHTML = '<svg class="i-down" viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6l4 4 4-4"/></svg><svg class="i-up" viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 10l4-4 4 4"/></svg>';
      const paintFold = () => {
        const done = block.classList.contains("done"), open = block.classList.contains("open");
        fold.hidden = true; chev.hidden = !done; chev.classList.toggle("up", open);
        chev.setAttribute("aria-label", open ? "Hide sets" : "Show sets");
      };
      const paintSummary = () => {                                      // a finished card opened: the sets in rows, unless opened all the way
        const summary = block.classList.contains("done") && block.classList.contains("open") && !fullBlocks.has(selKey); block.classList.toggle("summary", summary); if (openFull) openFull.hidden = !summary;
        const regrow = () => { for (const n of block.querySelectorAll("textarea.name")) { n.style.height = "auto"; n.style.height = Math.max(44, n.scrollHeight) + "px"; } };   // the name field re-wraps when the card changes shape: show the whole name
        if (block.isConnected) regrow(); else setTimeout(regrow, 0);    // in the page already: at once, so the page does not change height a moment after it was drawn (the glide would chase it)
      };
      const paint = () => { const all = g.rows.every((r) => r.done); block.classList.toggle("done", all); if (all && openBlocks.has(selKey)) block.classList.add("open"); if (!all) { openBlocks.delete(selKey); fullBlocks.delete(selKey); } btn.textContent = all ? "\u2713 Done" : "Done"; paintSum(all); paintFold(); paintSummary(); };
      const toggleOpen = () => { block.classList.toggle("open"); if (block.classList.contains("open")) openBlocks.add(selKey); else { openBlocks.delete(selKey); fullBlocks.delete(selKey); } paintFold(); paintSummary(); };
      fold.addEventListener("click", toggleOpen); chev.addEventListener("click", toggleOpen);
      card.addEventListener("click", (e) => { if (block.classList.contains("done") && !block.classList.contains("open") && !e.composedPath().some((n) => n.tagName === "BUTTON")) { block.classList.add("open"); openBlocks.add(selKey); paintFold(); paintSummary(); } });
      btn.addEventListener("click", () => {
        const next = !g.rows.every((r) => r.done);
        const track = S.clientMode ? pendingDoneRows : trainerTouched;
        if (!track.has(t.id)) track.set(t.id, new Set());
        for (const r of g.rows) { r.done = next; if (!next) markEarly(t, r, ""); track.get(t.id).add(r.id); }
        scheduleSave("trainings", t.id); paint();
      });
      paint(); foot.append(btn, fold); card.append(sum, foot, chev);
      if (currentKey != null && g.key !== currentKey && !g.rows.every((r) => r.done)) {   // client: still to come
        const peeking = peekBlocks.has(selKey);
        const chev = document.createElement("button"); chev.type = "button"; chev.className = "card-chev"; chev.setAttribute("aria-label", peeking ? "Fold" : "Open");
        chev.innerHTML = '<svg viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="' + (peeking ? "M4 10l4-4 4 4" : "M4 6l4 4 4-4") + '"/></svg>';
        card.appendChild(chev);
        const unpeek = () => { peekBlocks.delete(selKey); S.renderedTraining = null; render(); };
        if (peeking) { block.classList.add("peek"); chev.addEventListener("click", unpeek); for (const top of card.querySelectorAll(".row .top")) top.addEventListener("click", (e) => { if (e.target.closest(".ex-icons")) return; unpeek(); }); }
        else { block.classList.add("ahead"); card.addEventListener("click", () => { peekBlocks.add(selKey); S.renderedTraining = null; render(); }); }
      } else peekBlocks.delete(selKey);
      block.appendChild(card); rowsEl.appendChild(block);
    });
    $("delTrainingConfirm").hidden = true; $("delTraining").hidden = false;
    const back = Math.min(keepScroll, Math.max(0, sc.scrollHeight - sc.clientHeight)); if (Math.abs(sc.scrollTop - back) > 1) sc.scrollTop = back;   // a box measured mid-rebuild made the browser clamp the scroll to a page with no cards yet: put it back where he was
  }

  // Numbering rule: one exercise on a number is plain (2); two or more share letters (1a, 1b …).
  // The letter you type is a position: 1a moves that exercise to the top of its card,
  // 1c to third place; the others shift to fill.
  let lastEditedId = null;
  function normalizeLabels(t) {
    const groups = new Map();
    t.rows.forEach((r, i) => { const k = groupKey(r.label, i); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(r); });
    let changed = false;
    for (const [k, members] of groups) {
      if (!/^(\d+|w)$/.test(k)) continue;
      const base = k === "w" ? "W" : k;
      if (members.length === 1) {
        if (members[0].label !== base) { members[0].label = base; changed = true; }
        continue;
      }
      const letter = (r) => ((String(r.label || "").trim().match(/^(?:\d+|w)\s*([a-z]*)/i) || [])[1] || "").toLowerCase();
      const edited = members.find((r) => r.id === lastEditedId) || null;
      const ordered = members.filter((r) => r !== edited)
        .sort((a, b) => { const la = letter(a) || "~", lb = letter(b) || "~"; return la < lb ? -1 : la > lb ? 1 : 0; });
      if (edited) {
        const L = letter(edited);
        const at = L ? Math.max(0, Math.min(L.charCodeAt(0) - 97, ordered.length)) : ordered.length;
        ordered.splice(at, 0, edited);
      }
      ordered.forEach((r, j) => { const want = base + String.fromCharCode(97 + Math.min(j, 25)); if (r.label !== want) { r.label = want; changed = true; } });
    }
    lastEditedId = null;
    return changed;
  }

  // what the set before (in this workout) was logged at: the next set starts from it, so nothing is retyped unless something changed
  // after Complete set: bring the card's Sets line back under the header (or on to the next card once this one is finished)
  const haptic = () => { try { if (navigator.vibrate) navigator.vibrate(10); } catch (_) {} };   // Android; iPhone ticks on its own through the switch the button is a label for
  const whenDay = (iso, long) => { if (!/^\d{4}-\d{2}-\d{2}$/.test(iso || "")) return ""; const d = new Date(iso + "T12:00:00"), thisYear = d.getFullYear() === new Date().getFullYear(); return d.toLocaleDateString(undefined, { ...(long ? { weekday: "short" } : {}), month: "short", day: "numeric", ...(thisYear ? {} : { year: "numeric" }) }); };   // "Tue, Oct 6", "Jul 2, 2025"
  function showWhen(anchor, title, sub) {                            // a small frosted bubble under a tapped chip: in words. Any tap, a scroll or Escape closes it
    const pop = $("whenPop"), rows = Array.isArray(title) ? title : [{ v: title, d: sub }];   // rows: [{ k: "Best", v: "225 lb × 8", d: "Wed, Oct 8" }]
    const words = rows.some((row) => row.k); pop.classList.toggle("plain", !words); pop.classList.remove("menu");   // no words at all (the overview tile): two columns
    pop.replaceChildren(...rows.map((row) => {                                                                  // every row fills every column, empty or not: the grid rows are display:contents
      const div = document.createElement("div"); div.className = "wrow";
      if (words) { const k = document.createElement("span"); k.className = "wk"; k.textContent = row.k || ""; div.appendChild(k); }
      const b = document.createElement("b"); b.textContent = row.v; div.appendChild(b);
      const d = document.createElement("span"); d.className = "wd"; d.textContent = row.d || ""; div.appendChild(d);
      return div;
    }));
    openPop(anchor);
  }
  function showMenu(anchor, items) {                                 // the same frosted bubble with rows to tap: [{ label, onPick }]
    const pop = $("whenPop"); pop.classList.remove("plain"); pop.classList.add("menu");
    let close = null;
    pop.replaceChildren(...items.map((it) => {
      const b = document.createElement("button"); b.type = "button"; b.className = "wopt"; b.textContent = it.label;
      b.addEventListener("click", (e) => { e.stopPropagation(); if (close) close(); it.onPick(); });
      return b;
    }));
    close = openPop(anchor);
  }
  function openPop(anchor) {                                         // places the bubble under (or above) its anchor and wires the ways it closes; returns close
    const bg = $("whenBg"), pop = $("whenPop");
    bg.hidden = false; pop.classList.remove("above");
    const r = anchor.getBoundingClientRect(), vw = document.documentElement.clientWidth, vh = window.innerHeight, pw = pop.offsetWidth, ph = pop.offsetHeight;
    const left = Math.max(8, Math.min(r.left, vw - pw - 8)); let top = r.bottom + 8;
    if (top + ph > vh - 8) { top = r.top - 8 - ph; pop.classList.add("above"); }
    pop.style.left = left + "px"; pop.style.top = top + "px"; pop.style.setProperty("--caret", Math.max(12, Math.min(r.left + r.width / 2 - left, pw - 12)) + "px");
    const close = () => { bg.hidden = true; bg.removeEventListener("click", close); document.removeEventListener("keydown", onKey); window.removeEventListener("scroll", close, true); };
    const onKey = (e) => { if (e.key === "Escape") close(); };
    bg.addEventListener("click", close); document.addEventListener("keydown", onKey); window.addEventListener("scroll", close, true);
    return close;
  }
  function followRow(id, field) {                                   // a card that just moved (a new label): keep it under the finger, and the keyboard on the field he was heading for
    const row = $("rows").querySelector('.row[data-id="' + id + '"]'); if (!row) return;
    const inp = field && row.querySelector("." + field); if (inp) inp.focus({ preventScroll: true });
    glide(() => {
      const el = row.closest(".block") || row, head = document.querySelector("header"), off = Math.max(0, head ? head.getBoundingClientRect().bottom : 0) + 12, sc = document.scrollingElement || document.documentElement;   // the header may be scrolled away: never a negative offset
      return Math.max(0, Math.min(sc.scrollTop + el.getBoundingClientRect().top - off, sc.scrollHeight - sc.clientHeight));
    });
  }
  function scrollToCard(key) {
    if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur();   // the keyboard leaves first; the glide follows the page as it settles
    const target = () => {
      let el = document.querySelector('.block[data-key="' + CSS.escape(String(key)) + '"]'); if (!el) return null;
      const sc = document.scrollingElement || document.documentElement;
      if (el.classList.contains("done")) {
        let n = el.nextElementSibling; while (n && !(n.classList.contains("block") && !n.classList.contains("done"))) n = n.nextElementSibling;
        if (n) el = n;
        else {                                                        // the last exercise is done: bring Finish workout into view instead of chasing the folded card at the page's end
          const fin = $("finishBtn"); if (fin && !fin.hidden && fin.offsetParent) { const r = fin.getBoundingClientRect(); return Math.max(0, Math.min(sc.scrollTop + r.bottom - sc.clientHeight + 24, sc.scrollHeight - sc.clientHeight)); }
        }
      }
      const head = document.querySelector("header"); const off = Math.max(0, head ? head.getBoundingClientRect().bottom : 0) + 12;   // never a negative offset: a header that is not on screen must not push the target past the card
      return Math.max(0, Math.min(sc.scrollTop + el.getBoundingClientRect().top - off, sc.scrollHeight - sc.clientHeight));
    };
    glide(target);
  }
  // our own glide: it re-reads where the card is on every step (names settling, the keyboard closing), eases towards it, and lands exactly.
  // It does not call itself landed while the keyboard is still moving, and for a moment after landing it watches: the phone may put the page
  // back where the typed box was once the keyboard has gone (the bottom of the card just finished) — that nudge is eased away again.
  // A moving finger or a wheel takes over at once.
  function glide(target) {
    const sc = document.scrollingElement || document.documentElement, vv = window.visualViewport;
    const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) { const to = target(); if (to != null) sc.scrollTop = to; return; }
    const start = performance.now(); let t0 = start, last = null, resets = 0, quiet = start, landedAt = 0, nudges = 0, taken = false; const dur = 380, cap = 1100, watch = 900;
    const onVV = () => { quiet = performance.now(); };                                       // the keyboard is still on its way out
    const onUser = () => { taken = true; };
    if (vv) vv.addEventListener("resize", onVV);
    for (const ev of ["touchmove", "wheel"]) window.addEventListener(ev, onUser, { passive: true });   // a moving finger or a wheel, not a tap: a tap on the next box is on its way to the keyboard anyway
    const stop = () => { if (vv) vv.removeEventListener("resize", onVV); for (const ev of ["touchmove", "wheel"]) window.removeEventListener(ev, onUser); };
    const step = () => {
      if (taken) { stop(); return; }
      const to = target(); if (to == null) { stop(); return; }
      const now = performance.now();
      if (landedAt) {                                                                        // landed: watch, and only move again if something moved the page
        if (now - landedAt > watch || nudges >= 2) { stop(); return; }
        if (Math.abs(to - sc.scrollTop) <= 8) { setTimeout(step, 50); return; }
        landedAt = 0; t0 = now; nudges++; last = to;                                          // the phone nudged the page (the keyboard's parting shot): ease back, gently
      }
      if (last != null && Math.abs(to - last) > 40 && resets < 3) { t0 = now; resets++; }   // the page changed shape under us (a card folded, the keyboard left): ease again rather than snap — at most three times
      last = to;
      const t = now - t0, p = Math.min(1, t / dur), gap = to - sc.scrollTop, settled = now - quiet > 150;
      if ((p >= 1 && Math.abs(gap) <= 1 && settled) || now - start > cap + 600 + nudges * dur) { sc.scrollTop = to; landedAt = now; setTimeout(step, 50); return; }   // the cap is absolute: the glide always ends
      sc.scrollTop = sc.scrollTop + gap * (p >= 1 ? 0.5 : 0.22);
      setTimeout(step, 16);
    };
    setTimeout(step, 40);
  }
  // the word after a number: "10 reps" but "1 rep", nothing after "30 sec" or "12 each leg"
  const repsWord = (v) => { const t = String(v || "").trim(); if (/[a-z]/i.test(t)) return ""; return t === "1" ? "rep" : "reps"; };
  // "30 lbs", "1 lb", "20 kg"; nothing after "Bodyweight", "band" or "60 sec"
  const weightWord = (v, unit) => { const t = String(v || "").trim(); if (t && !/^[\d.,\s]+$/.test(t)) return ""; const n = parseFloat(t.replace(",", ".")); return unit === "kg" ? "kg" : (n === 1 ? "lb" : "lbs"); };
  const showWeight = (v) => /^bw$/i.test(String(v || "").trim()) ? "Bodyweight" : v;   // typed or picked as BW, read as a word
  const showReps = (v) => String(v || "").replace(/^(\d+(?:\s*[\u2013-]\s*\d+)?)\s*(\/|each|per)\s*(side|leg|arm)$/i, (m, n, e, w) => n + (n === "1" ? " rep " : " reps ") + (e === "/" ? "/ " : e + " ") + w);   // "7 / side" reads "7 reps / side"
  // a chip shows its words as text ("8–10 reps", "30 lbs"); the box only appears while someone types in it
  // o.readOnly: text only (client) · o.empty: the grey label when there is nothing at all ("Weight") · o.suffix: text, or fn(shown) → text ("" hides it) · o.show: fn(shown) → what to display
  function wireChip(inp, o = {}) {
    const chip = inp.closest(".chip"), val = chip.querySelector(".val"), sfx = chip.querySelector(".suffix");
    const fit = () => {
      const raw = inp.value || inp.placeholder || "", nothing = !raw, editing = chip.classList.contains("editing");
      val.textContent = nothing ? (o.empty || "") : (o.show ? o.show(raw) : raw);
      val.classList.toggle("ph", !inp.value); val.classList.toggle("hint", nothing && !!o.hint); chip.classList.toggle("filled", !!inp.value);   // "Log weight": an ask, not a number
      if (o.suffix !== undefined) sfx.textContent = typeof o.suffix === "function" ? o.suffix(raw) : o.suffix;
      sfx.hidden = !sfx.textContent || (nothing && !editing);               // "Weight" alone until the box is tapped, then "lbs" waits for the number
    };
    fit(); inp.addEventListener("input", fit);
    if (o.readOnly) { inp.tabIndex = -1; return fit; }
    chip.addEventListener("click", (e) => { if (e.target !== inp) { inp.focus(); try { inp.setSelectionRange(inp.value.length, inp.value.length); } catch (_) {} } });
    inp.addEventListener("focus", () => { chip.classList.add("editing"); fit(); });
    inp.addEventListener("blur", () => { chip.classList.remove("editing"); fit(); });
    return fit;
  }
  let ruler = null;                        // the same text in the same font, off to the side of the page: its width is the summary box's width (a canvas measures with another font on the iPhone, and a hidden card has no width at all)
  const textWidth = (text, ph) => { if (!ruler) { ruler = document.createElement("span"); ruler.className = "sum-measure"; ruler.setAttribute("aria-hidden", "true"); document.body.appendChild(ruler); } ruler.textContent = text; ruler.classList.toggle("ph", !!ph); return ruler.getBoundingClientRect().width; };
  const carried = (r, sel) => { const pick = (arr) => { for (let i = sel - 1; i >= 0; i--) { const v = String((arr || [])[i] || "").trim(); if (v) return v; } return ""; }; return { w: pick(r.weights), rp: pick(r.repsDone) }; };
  const setSel = new Map();               // "<training>/<group>" -> set the client is looking at (0-based)
  const openBlocks = new Set();           // finished cards the user opened with "Show sets"
  const fullBlocks = new Set();           // of those, the ones opened all the way ("Resume this exercise"): the working card instead of the summary
  const peekBlocks = new Set();   // client: exercises still to come that were tapped open to have a look
  let previewClient = false;       // trainer: showing the workout as the client sees it (display only; saving stays the trainer's)
  function rowEl(t, r, group) {
    const el = document.createElement("div"); el.className = "row"; el.dataset.id = r.id;
    el.innerHTML = `
      <div class="top">
        <div class="labwrap"><input class="label tab" placeholder="#" autocomplete="off" autocapitalize="none" aria-label="Number"><div class="numpick" hidden></div></div>
        <div class="exwrap"><textarea class="name" rows="1" maxlength="120" placeholder="Exercise" autocomplete="off" autocapitalize="sentences" aria-label="Exercise"></textarea><div class="ex-icons"><button class="vid-btn" type="button" hidden aria-label="Video" title="Watch video"><svg class="i-play" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M5 3.2v9.6a.5.5 0 0 0 .76.43l7.6-4.8a.5.5 0 0 0 0-.86l-7.6-4.8A.5.5 0 0 0 5 3.2z" fill="currentColor"/></svg><svg class="i-up" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 10l4-4 4 4"/></svg></button><button class="note-btn trainer-only" type="button" aria-label="Note" title="Note"><svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M3.5 4.5h9M3.5 8h9M3.5 11.5h5.5"/></svg></button><button class="alt-btn" type="button" hidden aria-label="Swap exercise" title="Swap exercise"><svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 5.5h10M10 3l2.5 2.5L10 8"/><path d="M13.5 10.5h-10M6 8l-2.5 2.5L6 13"/></svg></button></div><ul class="sugg" hidden></ul><div class="alt-menu" hidden></div></div>
      </div>
      <div class="sum"></div>
      <div class="newname trainer-only" hidden><span>New exercise</span><button class="btn tint addname" type="button">Add to database</button></div>
      <div class="player" hidden></div>
      <div class="vidrow trainer-only" hidden><button class="vid-edit" type="button">Change video</button></div>
      <div class="vid-form" hidden><input class="vid-url" type="url" placeholder="Paste a YouTube link" autocomplete="off" autocapitalize="none" inputmode="url"><div class="vid-actions"><button class="btn sm vid-save" type="button">Save</button><button class="btn danger vid-remove" type="button" hidden>Remove</button><button class="btn quiet vid-cancel" type="button">Cancel</button></div></div>
      <div class="specs">
        <div class="chip"><span class="val"></span><input class="reps tab" inputmode="decimal" placeholder="10" aria-label="Reps"><span class="suffix">reps</span></div>
        <div class="chip"><span class="val"></span><input class="rest tab" inputmode="decimal" placeholder="60 sec" aria-label="Rest"><span class="suffix rest-suffix">rest</span></div>
      </div>
      <div class="tempo-wrap"><input class="tempo tab" inputmode="decimal" placeholder="Normal" autocapitalize="characters"><div class="tempo-tiles" hidden></div></div>
      <div class="cnote" hidden><button class="cnote-btn" type="button" aria-expanded="false"><span class="cnote-lab">Instructions</span><svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6l4 4 4-4"/></svg></button><div class="cnote-text" hidden></div></div>
      <div class="weights"><div class="cap"><span class="wunit">Weights &middot; lb</span><span class="last"></span></div><div class="boxes"></div></div>
      <div class="setlog"><div class="pair"><div class="chip stack"><span class="lab">Weight</span><span class="valrow"><span class="val"></span><input class="w tab" inputmode="decimal" autocapitalize="none" aria-label="Weight"><span class="suffix unit">lb</span></span></div><div class="chip stack"><span class="lab">Reps</span><span class="valrow"><span class="val"></span><input class="rp tab" inputmode="numeric" autocapitalize="none" aria-label="Reps"><span class="suffix">reps</span></span></div></div></div>
      <div class="lifts" hidden><button type="button" class="lift last"><span class="vh">Last time </span><svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.25" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 7.6V12l3.1 2.1" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg><b></b></button><button type="button" class="lift best"><span class="vh">Personal best </span><svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M4.2 17.2 2.5 7.4l4.8 3.3L12 4.6l4.7 6.1 4.8-3.3-1.7 9.8z" fill="currentColor"/><path d="M4.6 18.8h14.8v1.9H4.6z" fill="currentColor"/></svg><b></b></button></div>
      <div class="note" hidden><textarea class="note-field" rows="1" placeholder="Instructions for the client"></textarea></div>`;
    const q = (s) => el.querySelector(s);
    if (!(S.clientMode || previewClient)) q(".top").appendChild(q(".ex-icons"));   // the coach's card: the three icons are a row of discs under the name (grid row 2), not overlays in the field
    let wText = false;                       // a row that already holds BW / 60 sec opens on the full keyboard (the bar above the keyboard switches it)
    const nonNum = (w) => !!w && !/^[\d.,\s]*$/.test(String(w));
    q(".wunit").textContent = "Weights \u00b7 " + ((clients.get(t.clientId) || {}).unit || "lb");
    const growName = () => { const n = q(".name"); n.style.height = "auto"; n.style.height = Math.max(44, n.scrollHeight) + "px"; };
    const asClient = S.clientMode || previewClient;        // what to show; what to save still follows clientMode
    const layoutIcons = () => { const n = (q(".vid-btn").hidden ? 0 : 1) + (asClient ? 0 : 1) + (q(".alt-btn").hidden ? 0 : 1); q(".name").style.paddingRight = (n ? 10 + n * 38 : 16) + "px"; growName(); };   // the name wraps before the icons
    const loose = (x) => String(x || "").toLowerCase().replace(/-/g, " ").replace(/\s+/g, " ").trim();
    const videoFor = (name) => { const s = String(name || "").trim(); if (!s) return null; const l = loose(ALIASES[s] || s); if (customVideos.has(loose(s))) return customVideos.get(loose(s)); if (customVideos.has(l)) return customVideos.get(l); return VIDEOS[s] || VIDEO_LOOSE.get(l) || null; };
    const markNamed = () => { if (S.clientMode) return; if (!trainerNamed.has(t.id)) trainerNamed.set(t.id, new Set()); trainerNamed.get(t.id).add(r.id); };
    const exwrap = q(".top .exwrap"), altBtn = q(".alt-btn"), altMenu = q(".alt-menu");
    const letter = (String(r.label || "").match(/^(?:\d+|w)([a-z])$/i) || [])[1] || "";   // superset rows read "A  Bench press" (warm-up Wa / Wb too)
    exwrap.dataset.letter = letter.toUpperCase(); el.style.setProperty("--letw", letter ? "42px" : "0px");
    let altMode = "list";
    const altList = () => (r.alts || []).filter(Boolean);
    const paintAltBtn = () => { const n = altList().length; const show = !asClient || n > 0; altBtn.hidden = !show; exwrap.classList.toggle("has-alt", show); altBtn.classList.toggle("some", n > 0); layoutIcons(); };
    const outside = (e) => { if (!exwrap.contains(e.target)) closeAlt(); };
    const closeAlt = () => { altMenu.hidden = true; altMenu.replaceChildren(); altMode = "list"; document.removeEventListener("pointerdown", outside, true); if (closeOpenAlt === closeAlt) closeOpenAlt = null; };
    function swapTo(a) {
      const old = r.name; r.name = a; r.alts = altList().map((v) => (v === a ? old : v)).filter(Boolean);
      if (S.clientMode) { if (!pendingSwap.has(t.id)) pendingSwap.set(t.id, new Map()); pendingSwap.get(t.id).set(r.id, a); } else markNamed();
      save(); S.renderedTraining = null; render();
      const n = $("rows").querySelector('.row[data-id="' + r.id + '"]'); const b = n && n.closest(".block");
      if (b && b.classList.contains("done")) { b.classList.add("open"); const f = b.querySelector(".fold-btn"); if (f) f.textContent = "Hide weights"; } // a folded card stays open to show the swap
    }
    const addAlt = (name) => { name = String(name || "").trim(); name = ALIASES[name] || name; if (!name) return; if (name === r.name || altList().includes(name)) { paintAltList(); return; } r.alts = [...altList(), name].slice(0, 2); markNamed(); save(); paintAltBtn(); paintAltList(); };
    const dropAltNamed = () => { if (altList().includes(r.name)) { r.alts = altList().filter((v) => v !== r.name); paintAltBtn(); } };
    const removeAlt = async (a) => { closeAlt(); if (!(await askFirst({ title: "Remove \u201c" + a + "\u201d as an alternative?", yes: "Remove" }))) return; r.alts = altList().filter((v) => v !== a); markNamed(); save(); paintAltBtn(); };
    const mk = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
    const menuItem = (text, cls, onPick, onRemove) => {
      const d = mk("div", "item"); const b = mk("button", "pick" + (cls ? " " + cls : ""), text); b.type = "button";
      b.addEventListener("mousedown", (ev) => ev.preventDefault()); b.addEventListener("click", onPick); d.appendChild(b);
      if (onRemove) { const x = mk("button", "rm", "\u00d7"); x.type = "button"; x.setAttribute("aria-label", "Remove alternative"); x.addEventListener("mousedown", (ev) => ev.preventDefault()); x.addEventListener("click", onRemove); d.appendChild(x); }
      return d;
    };
    function paintAltList() {
      altMode = "list"; altMenu.replaceChildren();
      const alts = altList().filter((a) => a !== r.name);
      if (String(r.name || "").trim()) { const c = mk("div", "cur"); c.appendChild(mk("span", "ck", "\u2713")); c.appendChild(mk("span", null, r.name)); altMenu.appendChild(c); }
      for (const a of alts) altMenu.appendChild(menuItem(a, "", () => { closeAlt(); swapTo(a); }, asClient ? null : () => removeAlt(a)));
      if (!asClient && alts.length < 2) altMenu.appendChild(menuItem("+ Add alternative", "add", paintAltAdd));
      if (!asClient) {                                                                                   // a clear way out, like a sheet: Remove exercise on the left, Done on the right
        const foot = mk("div", "alt-foot");
        const rm = mk("button", "remove", "Remove exercise"); rm.type = "button"; rm.addEventListener("mousedown", (ev) => ev.preventDefault()); rm.addEventListener("click", async () => { closeAlt(); const nm = String(r.name || "").trim() || "this exercise", tpl = isTemplateClient(t.clientId); if (!(await askFirst({ title: tpl ? "Remove " + nm + " from this template?" : "Remove " + nm + "?", text: tpl ? "Nothing changes until you tap Save template." : "It comes off this workout, with anything logged on it.", yes: "Remove" }))) return; t.rows = t.rows.filter((x) => x.id !== r.id); save(); S.renderedTraining = null; render(); });
        const ok = mk("button", "done", "Done"); ok.type = "button"; ok.addEventListener("mousedown", (ev) => ev.preventDefault()); ok.addEventListener("click", closeAlt);
        foot.append(rm, ok); altMenu.appendChild(foot);
      }
      altMenu.hidden = false;
    }
    function paintAltAdd() {
      altMode = "add"; altMenu.replaceChildren();
      const inp = mk("input", "alt-input"); inp.maxLength = 120; inp.placeholder = "Alternative exercise"; inp.autocomplete = "off"; inp.setAttribute("autocapitalize", "sentences"); inp.setAttribute("enterkeyhint", "done");
      const hits = mk("div", "alt-hits"); altMenu.append(inp, hits);
      const foot = mk("div", "alt-foot"); const back = mk("button", "cancel", "Cancel"); back.type = "button"; back.addEventListener("mousedown", (ev) => ev.preventDefault()); back.addEventListener("click", paintAltList); foot.appendChild(back); altMenu.appendChild(foot);   // back to the list without adding
      const paintHits = () => {
        const s = squash(inp.value); hits.replaceChildren(); if (s.length < 2) return;
        const taken = new Set([squash(r.name), ...altList().map(squash)]); const starts = [], contains = [];
        ALL_NAMES.forEach((n, i) => { const k = ALL_KEYS[i]; if (taken.has(k)) return; if (k.startsWith(s)) starts.push(n); else if (k.includes(s)) contains.push(n); });
        starts.sort((a, b) => a.length - b.length || a.localeCompare(b));
        for (const n of [...starts, ...contains, ...aliasFinds(s, [...starts, ...contains]).filter((n) => !taken.has(squash(n)))]) hits.appendChild(menuItem(n, "", () => addAlt(n)));
      };
      inp.addEventListener("input", paintHits);
      inp.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); if (inp.value.trim()) addAlt(inp.value); else paintAltList(); } else if (e.key === "Escape") paintAltList(); });
      inp.addEventListener("blur", () => setTimeout(() => { if (altMode === "add" && !altMenu.hidden && !inp.value.trim()) paintAltList(); }, 200));
      inp.focus();
    }
    altBtn.addEventListener("mousedown", (ev) => ev.preventDefault());
    altBtn.addEventListener("click", () => {
      if (asClient) {                                                                                   // the client picks from the frosted bubble under the disc: consistent with the other pop-ups, and it always fits
        const alts = altList().filter((a) => a !== r.name); if (!alts.length) return;
        showMenu(altBtn, alts.map((a) => ({ label: a, onPick: () => swapTo(a) })));   // the frosted bubble, like last/best: tap an alternative to swap it in
        return;
      }
      if (!altMenu.hidden) { closeAlt(); return; }
      q(".sugg").hidden = true; q(".numpick").hidden = true;
      paintAltList(); document.addEventListener("pointerdown", outside, true); closeOpenAlt = closeAlt;
    });
    paintAltBtn();
    const newName = q(".newname");
    const paintNewName = () => { const n = String(r.name || "").trim(); const near = !knownName(n) && n ? nearName(n) : null; newName.hidden = asClient || !n || knownName(n); newName.firstElementChild.textContent = near ? "Did you mean “" + near + "”? · Or" : "New exercise"; };
    q(".addname").addEventListener("click", async () => {
      const b = q(".addname"); b.disabled = true; b.textContent = "Adding\u2026";
      const ok = await addCustomName(r.name); b.disabled = false; b.textContent = "Add to database";
      if (ok) { const t2 = tidyName(r.name); if (t2 !== r.name) { r.name = t2; q(".name").value = t2; save(); } paintNewName(); $("status").textContent = "Added to your exercises"; setTimeout(setStatus, 1500); }
      else { $("status").textContent = "Couldn\u2019t add \u00b7 run supabase/exercises.sql, or try again online"; $("status").className = "err"; setTimeout(setStatus, 4000); }
    });
    paintNewName();
    let videoId = null;
    const vidBtn = q(".vid-btn"), vidRow = q(".vidrow");
    const paintVideo = () => {
      const id = videoFor(r.name); const pl = q(".player");
      if (id !== videoId) { videoId = id; pl.replaceChildren(); pl.hidden = true; vidRow.hidden = true; vidBtn.classList.remove("open"); }
      vidBtn.hidden = asClient && !id;                                  // the trainer always has it: with no video it opens the link box
      vidBtn.classList.toggle("has", !!id); vidBtn.title = id ? "Watch video" : "Add video"; vidBtn.setAttribute("aria-label", vidBtn.title);
      q(".vid-remove").hidden = !customVideos.get(loose(r.name));   // a stored "no video" marker is not a link to remove
      layoutIcons();
    };
    const openVidForm = () => { const f = q(".vid-form"); f.hidden = !f.hidden; if (!f.hidden) { q(".vid-url").value = ""; q(".vid-url").focus(); } };
    q(".vid-edit").addEventListener("click", openVidForm);
    q(".vid-cancel").addEventListener("click", () => { q(".vid-form").hidden = true; });
    q(".vid-save").addEventListener("click", async () => {
      const url = q(".vid-url").value.trim(), id = youtubeId(url), keyName = loose(r.name);
      if (!keyName) { $("status").textContent = "Name the exercise first"; return; }
      if (!id) { $("status").textContent = "That doesn\u2019t look like a YouTube link"; return; }
      const error = await saveVideo(keyName, url, id);
      if (error) { $("status").textContent = /ft_exercise_videos/.test(error.message) ? "Run supabase/exercise-videos.sql first" : "Couldn\u2019t save the video"; return; }
      q(".vid-form").hidden = true; paintVideo(); setStatus();
    });
    q(".vid-remove").addEventListener("click", async () => {
      if (!(await askFirst({ title: "Remove the video for " + (String(r.name || "").trim() || "this exercise") + "?", text: "Every workout with this exercise loses it.", yes: "Remove" }))) return;
      const keyName = loose(r.name);
      const error = await deleteVideo(keyName);
      if (error) { $("status").textContent = "Couldn\u2019t remove the video"; return; }
      q(".vid-form").hidden = true; paintVideo(); setStatus();
    });
    vidBtn.addEventListener("click", () => {
      closeAlt();
      if (!videoId) { if (!asClient) openVidForm(); return; }
      const pl = q(".player");
      if (!pl.hidden) { pl.replaceChildren(); pl.hidden = true; vidRow.hidden = true; vidBtn.classList.remove("open"); vidBtn.title = "Watch video"; vidBtn.setAttribute("aria-pressed", "false"); return; }
      const f = document.createElement("iframe");
      f.src = "https://www.youtube-nocookie.com/embed/" + videoId + "?playsinline=1&rel=0&modestbranding=1";
      f.allow = "accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen"; f.setAttribute("allowfullscreen", "");
      f.setAttribute("playsinline", ""); f.title = r.name || "Exercise video"; f.loading = "lazy";
      pl.replaceChildren(f); pl.hidden = false; vidRow.hidden = false; vidBtn.classList.add("open"); vidBtn.title = "Hide video"; vidBtn.setAttribute("aria-pressed", "true");   // "Change video" sits under the open player (trainer)
    });
    paintVideo();
    if (ALIASES[r.name]) { r.name = ALIASES[r.name]; if (!S.clientMode) scheduleSave("trainings", t.id); }
    if (!S.clientMode && Array.isArray(r.alts) && r.alts.some((a) => ALIASES[a])) { r.alts = r.alts.map((a) => ALIASES[a] || a); scheduleSave("trainings", t.id); }
    q(".label").value = r.label || ""; q(".name").value = r.name || "";
    if (S.clientMode || previewClient) {                                                             // the client reads a long name as a title with its subtitle under it; the coach keeps the one editable line
      const parts = splitName(r.name, subtitleFor(r.name));
      if (parts.sub) { q(".name").value = parts.title; const d = document.createElement("div"); d.className = "name-sub"; d.textContent = parts.sub; q(".name").insertAdjacentElement("afterend", d); }
    }
    requestAnimationFrame(growName);
    q(".name").addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); e.currentTarget.blur(); } });
    q(".reps").value = r.reps || ""; q(".tempo").value = r.tempo || ""; q(".rest").value = r.rest || "";

    const save = () => scheduleSave("trainings", t.id);
    if (asClient) { for (const s of [".label", ".name", ".reps", ".tempo", ".rest"]) q(s).readOnly = true; for (const s of [".reps", ".tempo", ".rest"]) { const el = q(s); if (!el.value) el.value = el.placeholder; } }   // the trainer's grey defaults read as filled in for the client
    const bind = (sel, field, transform) => { if (asClient) return; q(sel).addEventListener("input", (e) => { r[field] = transform ? transform(e.target.value) : e.target.value; save(); }); };
    if (!asClient) q(".label").addEventListener("input", (e) => { r.label = e.target.value; lastEditedId = r.id; save(); });
    bind(".reps", "reps"); bind(".tempo", "tempo", (v) => { setTimeout(paintTempo, 0); return v; });
    const timedAtPaint = JSON.stringify(timedPlan(r.reps));           // reps turned into "30 sec" (or back): the set log, its labels and the summary follow as soon as he leaves the box
    if (!asClient) q(".reps").addEventListener("blur", (e) => {
      if (JSON.stringify(timedPlan(r.reps)) === timedAtPaint) return;
      const nx = e.relatedTarget, field = nx && nx.closest && nx.closest('.row[data-id="' + r.id + '"]') ? ["name", "reps", "tempo", "rest", "label"].find((c) => nx.classList.contains(c)) : null;
      S.renderedTraining = null; render();
      if (field) { const row = $("rows").querySelector('.row[data-id="' + r.id + '"]'), inp = row && row.querySelector("." + field); if (inp) inp.focus({ preventScroll: true }); }   // he tapped the next box: it keeps the keyboard, no jump
    });
    bind(".rest", "rest");
    wireChip(q(".reps"), { readOnly: asClient, suffix: repsWord, show: showReps }); const fitRest = wireChip(q(".rest"), { readOnly: asClient });
    if (!asClient) q(".rest").addEventListener("blur", (e) => { const v = e.target.value.trim(); if (/^\d+([.,]\d+)?$/.test(v)) { r.rest = v + " sec"; e.target.value = r.rest; fitRest(); save(); } });
    const numpick = q(".numpick");
    function showNumbers() {
      let max = 0;
      for (const x of t.rows) { const m = String(x.label || "").match(/^(\d+)/); if (m) max = Math.max(max, Number(m[1])); }
      const cur = (String(r.label || "").match(/^(\d+)/) || [])[1] || (isWarmLabel(r.label) ? "W" : "");
      const choices = ["W", ...Array.from({ length: Math.max(max + 1, 1) }, (_, i) => String(i + 1))];
      numpick.replaceChildren(...choices.map((n) => {
        const b = document.createElement("button"); b.type = "button"; b.textContent = n; if (n === "W") b.title = "Warmup";
        if (n === cur) b.classList.add("cur");
        b.addEventListener("mousedown", (ev) => ev.preventDefault());
        b.addEventListener("click", () => { r.label = n; lastEditedId = r.id; q(".label").value = n; numpick.hidden = true; save(); S.renderedTraining = null; render(); followRow(r.id, String(r.name || "").trim() ? null : "name"); });   // the card moves to its place; he goes with it, straight into the name if it is still empty
        return b;
      }));
      numpick.hidden = false;
    }
    if (!asClient) {
      let labelAtFocus = "";
      q(".label").addEventListener("focus", (e) => { labelAtFocus = e.target.value; showNumbers(); });
      q(".label").addEventListener("blur", (e) => { numpick.hidden = true; if (q(".label").value !== labelAtFocus) { const to = e.relatedTarget, field = to && el.contains(to) && /^(INPUT|TEXTAREA)$/.test(to.tagName) ? [...to.classList].find((c) => /^(name|reps|rest|tempo|w|rp)$/.test(c)) : null; S.renderedTraining = null; render(); followRow(r.id, field || null); } });   // the card moves to its place; the field he tapped next is focused again in the moved card
      q(".name").addEventListener("input", (e) => { closeAlt(); r.name = e.target.value.replace(/\n/g, " "); markNamed(); dropAltNamed(); growName(); save(); suggest(e.target.value); renderWeights(); paintVideo(); paintNewName(); });
      q(".name").addEventListener("blur", () => setTimeout(() => { q(".sugg").hidden = true; }, 120));
      q(".name").addEventListener("focus", (e) => { closeAlt(); suggest(e.target.value); });
    }

    const tempoTiles = q(".tempo-tiles"), tempoInp = q(".tempo");
    const paintTempo = () => {
      const raw = String(r.tempo || "").trim();
      const m = /^([0-9X])([0-9X])([0-9X])([0-9X])$/i.exec(raw);
      const word = !m && /[a-wyz]/i.test(raw) && !/^normal$/i.test(raw) ? raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase() : "";   // "Controlled", "Slow" … (not a half-typed code)
      tempoTiles.replaceChildren();
      const normal = !m && !word;
      q(".tempo-wrap").hidden = asClient && normal;                       // Normal (or blank) is nothing to show a client
      const show = document.activeElement !== tempoInp;                    // one cell: the card stands in for the box, except while the trainer is typing
      tempoTiles.hidden = !show; tempoInp.hidden = show;
      if (!show) return;
      if (!m) { const w = document.createElement("div"); w.className = "word"; if (normal) { w.classList.add("normal"); w.textContent = "Normal tempo"; } else w.textContent = word.charAt(0).toUpperCase() + word.slice(1) + (/tempo/i.test(word) ? "" : " tempo"); tempoTiles.append(w); return; }
      if (asClient) {                                                       // the client reads it as words: "3 sec down │ 1 sec pause │ fast up"
        const fast = (x) => /x/i.test(x) || x === "0";
        const ico = { down: "M8 3v10M4.5 9.5 8 13l3.5-3.5", up: "M8 13V3M4.5 6.5 8 3l3.5 3.5", bottom: "M5.5 3.5v9M10.5 3.5v9", top: "M5.5 3.5v9M10.5 3.5v9" };   // down, up, and the plain pause for both holds: the row reads like one rep (down, hold, up, hold), so the arrow before a pause says where it is
        const tok = (kind, text, label) => { const e = document.createElement("span"); e.className = "si tempo-" + kind; e.setAttribute("aria-label", label); e.innerHTML = '<svg viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="' + ico[kind] + '"/></svg><span>' + text + "</span>"; return e; };
        const parts = [tok("down", fast(m[1]) ? "fast" : m[1] + "s", (fast(m[1]) ? "fast" : m[1] + " seconds") + " down"), fast(m[2]) ? null : tok("bottom", m[2] + "s", m[2] + " second pause at the bottom"), tok("up", fast(m[3]) ? "fast" : m[3] + "s", (fast(m[3]) ? "fast" : m[3] + " seconds") + " up"), fast(m[4]) ? null : tok("top", m[4] + "s", m[4] + " second pause at the top")].filter(Boolean);
        tempoTiles.classList.add("words");
        for (const e of parts) tempoTiles.appendChild(e);
        return;
      }
      const v = (x) => /x/i.test(x) ? "X" : x + "s";
      const tile = (d, text) => { const e = document.createElement("div"); const b = document.createElement("b"); b.textContent = v(d); const s = document.createElement("span"); s.textContent = text; e.append(b, s); return e; };
      tempoTiles.append(
        tile(m[1], /x/i.test(m[1]) ? "Lower · fast" : "Lower"),
        tile(m[2], "Bottom pause"),
        tile(m[3], /x/i.test(m[3]) ? "Lift · fast" : "Lift"),
        tile(m[4], "Top pause"));
    };
    paintTempo();
    if (!asClient) {
      tempoTiles.setAttribute("role", "button"); tempoTiles.tabIndex = 0; tempoTiles.setAttribute("aria-label", "Tempo, tap to change");
      const editTempo = () => { tempoTiles.hidden = true; tempoInp.hidden = false; tempoInp.focus(); try { tempoInp.setSelectionRange(tempoInp.value.length, tempoInp.value.length); } catch (_) {} };
      tempoTiles.addEventListener("click", editTempo);
      tempoTiles.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); editTempo(); } });
      tempoInp.addEventListener("blur", () => setTimeout(paintTempo, 100));   // after the keyboard bar's ABC/123 switch (blur, refocus at 50 ms) so the box is not swapped out mid-switch
    }
    const cnote = q(".cnote"), cnoteBtn = q(".cnote-btn"), cnoteLab = q(".cnote-lab"), cnoteText = q(".cnote-text");
    const paintClientNote = () => {
      const v = String(r.note || "").trim(), open = openNotes.has(r.id);
      cnote.hidden = !asClient || !v; cnoteText.textContent = v; cnoteText.hidden = !open;
      cnoteLab.textContent = "Instructions"; cnoteBtn.classList.toggle("open", open); cnoteBtn.setAttribute("aria-expanded", String(open));   // one word; the chevron says open or closed
    };
    cnoteBtn.addEventListener("click", () => { if (openNotes.has(r.id)) openNotes.delete(r.id); else openNotes.add(r.id); paintClientNote(); });
    paintClientNote();
    const noteBtn = q(".note-btn"), noteBox = q(".note"), noteField = q(".note-field");
    const growNote = () => { noteField.style.height = "auto"; noteField.style.height = noteField.scrollHeight + "px"; };
    const showNote = () => { const v = (r.note || "").trim(); noteBtn.classList.toggle("has", !!v); noteBtn.title = v ? "Instructions" : "Add instructions"; noteBtn.setAttribute("aria-label", noteBtn.title); };
    noteBtn.addEventListener("click", () => { closeAlt(); noteBox.hidden = false; noteField.value = r.note || ""; growNote(); noteField.focus(); });
    noteField.addEventListener("input", (e) => { r.note = e.target.value; growNote(); save(); });
    noteField.addEventListener("blur", () => { noteBox.hidden = true; showNote(); });
    showNote();

    function suggest(v) {
      const ul = q(".sugg"); const s = squash(v);
      if (s.length < 2) { ul.hidden = true; return; }
      const exact = [], starts = [], contains = [], typed = norm(v);
      ALL_NAMES.forEach((n, i) => { const k = ALL_KEYS[i]; if (k === s) { if (n.toLowerCase() !== typed) exact.push(n); } else if (k.startsWith(s)) starts.push(n); else if (k.includes(s)) contains.push(n); }); // "push up" offers "Push-up" first
      starts.sort((a, b) => a.length - b.length || a.localeCompare(b));
      const hits = [...exact, ...starts, ...contains, ...aliasFinds(s, [...exact, ...starts, ...contains])].slice(0, 20);   // enough to pick from; the library page lists everything
      ul.replaceChildren(...hits.map((n) => { const li = document.createElement("li"); const b = document.createElement("button"); b.type = "button"; b.textContent = n; b.addEventListener("mousedown", (ev) => ev.preventDefault()); b.addEventListener("click", () => { r.name = n; markNamed(); dropAltNamed(); q(".name").value = n; growName(); ul.hidden = true; save(); renderWeights(); paintVideo(); paintNewName(); }); li.appendChild(b); return li; }));
      ul.hidden = hits.length === 0;
    }

    const liftHistory = () => {                                      // this exercise, this client, EARLIER sessions only: the last session's top set and the best ever
      const canon = (x) => squash(ALIASES[String(x || "").trim()] || x); const name = canon(r.name); if (!name) return null;
      const timed = !!timedPlan(r.reps);
      let best = null, last = null;
      for (const other of clientTrainings(t.clientId)) {              // newest first
        if (other.id === t.id) continue;                               // today is what the line is compared against, never part of it
        const earlier = effDate(other) < effDate(t) || (effDate(other) === effDate(t) && (other.createdAt || "") < (t.createdAt || ""));
        if (!earlier) continue;
        for (const x of other.rows || []) {
          if (canon(x.name) !== name) continue; const st = topSet(x, timed); if (!st) continue; st.date = effDate(other); st.title = String(other.title || "").trim();
          if (betterSet(st, best, timed)) best = st;                   // equal numbers: the newest session keeps the title
          if (!last) last = st;
        }
      }
      return best ? { best, last, timed } : null;
    };
    const paintLifts = () => {                                       // LAST 215 lb × 4   BEST 230 lb × 3  ·  one entry when the best was the last session  ·  NEW BEST in gold while today beats it  ·  a tap on a number tells when
      const box = q(".lifts"), h = isTemplateClient(t.clientId) ? null : liftHistory();
      box.hidden = !h; if (!h) return;
      const unit = (clients.get(t.clientId) || {}).unit || "lb", tm = timedPlan(r.reps);
      const fmt = tm ? (st) => (st.w != null ? st.w + " " + unit + " \u00d7 " : "") + st.rp + " " + tm.unit : (st) => st.w != null ? st.w + " " + unit + (st.rp != null ? " \u00d7 " + st.rp : "") : st.rp + (st.rp === 1 ? " rep" : " reps");
      const now = topSet(r, h.timed, (group.sel | 0) + 1), newBest = !!(now && betterSet(now, h.best, h.timed)), same = sameSet(h.last, h.best);   // the set under the finger counts for the gold preview as it is typed
      q(".lift.best").classList.toggle("new", newBest); q(".lift.best b").textContent = fmt(newBest ? now : h.best); q(".lift.best .vh").textContent = newBest ? "New best " : "Personal best ";   // the read-out word follows the state
      q(".lift.last").hidden = !h.last; if (h.last) q(".lift.last b").textContent = fmt(h.last);   // both halves always, even when the best was the last session (his call)
      box._info = { last: h.last, best: h.best, now, newBest, same, fmt };
      box.classList.remove("tight", "stack");
      requestAnimationFrame(() => {                                     // the numbers are never cut: smaller type first, then the two halves stack
        const cut = () => [...box.querySelectorAll(".lift b")].some((b) => b.scrollWidth > b.clientWidth + 1);
        if (cut()) box.classList.add("tight");
        if (cut()) box.classList.add("stack");
      });
    };
    const liftRows = (i) => {                                          // the bubble, in words: every line that applies, best first
      const rows = [];
      if (i.newBest) rows.push({ k: "New best", v: i.fmt(i.now), d: "Today" });
      rows.push({ k: i.newBest ? "Previous best" : "Personal best", v: i.fmt(i.best), d: whenDay(i.best.date, true) || "Earlier" });   // plain words (his ask); a session without a date still gets one
      if (i.last) rows.push({ k: "Last time", v: i.fmt(i.last), d: whenDay(i.last.date, true) || "Earlier" });                       // the same numbers twice when the best was the last session: honest
      return rows;
    };
    for (const sel of [".lift.last", ".lift.best"]) q(sel).addEventListener("click", (e) => { e.stopPropagation(); const i = q(".lifts")._info; if (i && i.best) showWhen(q(".lifts"), liftRows(i)); });   // the bubble hangs under the cell, whichever half was tapped
    function renderWeights() {
      const n = setsOf(r);
      const boxes = q(".boxes"); const last = lastWeights(t, r);
      q(".last").textContent = last ? "last time \u00b7 " + fmtDate(last.date) : "";
      paintLifts();
      r.weights = (r.weights || []).slice(0, n); while (r.weights.length < n) r.weights.push("");
      r.repsDone = (r.repsDone || []).slice(0, n);
      if (!wText && r.weights.some(nonNum)) wText = true;
      boxes.replaceChildren(...Array.from({ length: n }, (_, i) => {
        const inp = document.createElement("input"); inp.className = "tab"; inp.inputMode = wText ? "text" : "decimal"; inp.setAttribute("autocapitalize", "none"); inp.setAttribute("aria-label", "Set " + (i + 1) + " weight");
        inp.value = r.weights[i] || ""; const hint = !!(last && last.weights[i]); inp.placeholder = hint ? last.weights[i] : "\u2013"; inp.classList.toggle("hint", hint);
        inp.addEventListener("input", (e) => {
          r.weights[i] = e.target.value;
          const track = S.clientMode ? pendingWeightRows : trainerTouched;
          if (!track.has(t.id)) track.set(t.id, new Set());
          track.get(t.id).add(r.id);
          save();
        });
        inp.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); const nx = boxes.children[i + 1]; if (nx) nx.focus(); else inp.blur(); } });
        return inp;
      }));
      el.querySelector(".weights").hidden = n === 0;
    }
    renderWeights();
    if (group && group.rows.length > 1 && group.rows[group.rows.length - 1] !== r) q(".rest-suffix").textContent = "transition";
    if (group && group.sel != null && group.sel >= setsOf(r)) q(".setlog").hidden = true;   // no such set for this exercise
    else if (group && group.sel != null) {      // one set at a time: the boxes show the set the tracker points at
      const sel = group.sel; const unit = (clients.get(t.clientId) || {}).unit || "lb";
      const last = lastWeights(t, r);
      r.weights = r.weights || []; r.repsDone = r.repsDone || [];
      const w = q(".setlog .w"), rp = q(".setlog .rp");
      const timed = timedPlan(r.reps); q(".setlog").classList.toggle("timed", !!timed);   // a plank: the box says Time and comes first, Weight waits beside it
      const asW = (v) => (timed && timeAsWeight(v) ? "" : v);                              // a hold never borrows "45 sec" as its weight (the old app typed seconds there)
      const lw = asW(last && last.weights[sel] ? String(last.weights[sel]) : ""), lr = last && last.reps && last.reps[sel] ? String(last.reps[sel]) : "";
      const carry = carried(r, sel);   // the set before (else last time) shows in grey: type over it, or leave it and Complete set writes it down
      w.value = r.weights[sel] || ""; w.placeholder = asW(carry.w) || lw || "";           // nothing to suggest: the chip just says "lb"
      rp.value = r.repsDone[sel] || ""; rp.placeholder = carry.rp || lr || planNumber(r.reps);   // the set before, last time, else the plan's number (8–10 shows 10): what shows grey is what Complete set writes
      w.inputMode = (wText || nonNum(r.weights[sel] || carry.w || "")) ? "text" : "decimal";
      const mark = () => { const track = S.clientMode ? pendingWeightRows : trainerTouched; if (!track.has(t.id)) track.set(t.id, new Set()); track.get(t.id).add(r.id); save(); };
      w.addEventListener("input", (e) => { r.weights = correctFrom(r.weights, sel, e.target.value); mark(); paintLifts(); });   // NEW BEST lights up as it is typed; later sets that copied this number follow the correction
      rp.addEventListener("input", (e) => { const v = e.target.value.replace(/[^0-9]/g, "").slice(0, 4); r.repsDone = correctFrom(r.repsDone, sel, v); e.target.value = v; mark(); paintLifts(); });
      w.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); rp.focus(); } });
      rp.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); kbNext(); } });   // on to the next exercise of the superset, else the keyboard goes
      const hand = perHand(r.name); q(".setlog .chip.stack:nth-child(1) .lab").textContent = hand ? "Weight / " + hand : "Weight";   // one dumbbell, one kettlebell: the label says what the number is per
      wireChip(w, { empty: timed ? "Bodyweight" : "Log weight", hint: true, suffix: (v) => weightWord(v, unit), show: showWeight });   // a hold with no weight is bodyweight; BW can still be typed or picked   // after the handlers above, so the words follow the tidied value; never logged before = the box asks
      const perSide = /(\/|each|per)\s*(side|leg|arm)/i.test(String(r.reps || ""));             // "10 / side": the label says so, the box holds the number
      q(".setlog .chip.stack:nth-child(2) .lab").textContent = (timed ? "Time" : "Reps") + (perSide ? " / side" : "");
      if (timed) wireChip(rp, { empty: "Log time", hint: true, suffix: () => timed.unit, show: (v) => v });
      else wireChip(rp, { empty: "\u2013", suffix: () => "", show: (v) => String(v || "").replace(/\s*(\/|each|per)\s*(side|leg|arm)\s*$/i, "").replace(/\s*reps?\s*$/i, "") });   // the label above already says Reps: the box holds the number alone (lbs and sec are units, "reps" would only repeat the label)
    }
    const chipText = (c) => c.querySelector(".val").textContent + (c.querySelector(".suffix").hidden ? "" : " " + c.querySelector(".suffix").textContent);
    const nSets = setsOf(r), sumEl = q(".sum"); sumEl.replaceChildren();   // "3 sets · 8–10 reps · 60 sec transition" (the open card hides the sets part: the chips above say it)
    const chips = [...el.querySelectorAll(".specs .chip")];
    for (const [text, cls] of [[nSets + (nSets === 1 ? " set" : " sets"), "si sum-sets"], [chipText(chips[0]), "si sum-reps"], [chipText(chips[1]), "si sum-rest"]]) { if (!text) continue; const e = document.createElement("span"); e.className = cls; e.textContent = text; sumEl.appendChild(e); }
    {                                                                  // the finished card, opened: every set in a cell — number, weight × reps (editable in place for a typo), a check
      const unitS = (clients.get(t.clientId) || {}).unit || "lb", tmS = timedPlan(r.reps), sumEl = document.createElement("div"); sumEl.className = "row-sum";
      const runitWord = tmS ? tmS.unit : /(\/|each|per)\s*(side|leg|arm)/i.test(String(r.reps || "")) ? "reps / side" : "reps";   // "× 5 reps", "× 8 reps / side", "× 45 sec"
      const mark = () => { const track = S.clientMode ? pendingWeightRows : trainerTouched; if (!track.has(t.id)) track.set(t.id, new Set()); track.get(t.id).add(r.id); scheduleSave("trainings", t.id); };
      const fit = (inp) => { inp.style.width = Math.ceil(textWidth(inp.value || inp.placeholder || "", !inp.value) + 7) + "px"; };   // as wide as its text, measured in the real font ("BW" is wide letters, not two digits)
      const refresh = () => { for (const line of sumEl.children) { const i = +line.dataset.i, wi = line.querySelector(".sum-w"), ri = line.querySelector(".sum-r"); if (!wi) continue; if (document.activeElement !== wi) { wi.value = String((r.weights || [])[i] || ""); fit(wi); } if (document.activeElement !== ri) { ri.value = String((r.repsDone || [])[i] || ""); fit(ri); } line.querySelector(".sum-unit").textContent = wi.value.trim() ? weightWord(wi.value, unitS) : ""; line.querySelector(".runit").textContent = ri.value.trim() ? runitWord : ""; } };   // an empty box shows its grey word alone
      for (let i = 0; i < setsOf(r); i++) {
        const line = document.createElement("div"); line.className = "sum-set"; line.dataset.i = i; const counted = setCounts(r, i); line.classList.toggle("skip", !counted);
        const n = document.createElement("span"); n.className = "sum-n"; n.textContent = i + 1; line.appendChild(n);
        if (!counted) { const v = document.createElement("span"); v.className = "sum-val"; v.textContent = "Not done"; line.appendChild(v); }
        else {
          const val = document.createElement("span"); val.className = "sum-val";
          const wi = document.createElement("input"); wi.className = "sum-w"; wi.inputMode = "decimal"; wi.placeholder = "Bodyweight"; wi.setAttribute("aria-label", "Weight, set " + (i + 1)); wi.autocomplete = "off";
          const unit = document.createElement("span"); unit.className = "sum-unit";
          const x = document.createElement("span"); x.className = "sum-x"; x.textContent = "\u00d7";
          const ri = document.createElement("input"); ri.className = "sum-r"; ri.inputMode = "numeric"; ri.placeholder = tmS ? "sec" : "reps"; ri.setAttribute("aria-label", (tmS ? "Seconds" : "Reps") + ", set " + (i + 1)); ri.autocomplete = "off";
          const runit = document.createElement("span"); runit.className = "sum-unit runit"; runit.textContent = runitWord;
          val.append(wi, unit, x, ri, runit); line.appendChild(val);
          wi.addEventListener("input", () => { r.weights = correctFrom(r.weights, i, wi.value); fit(wi); mark(); refresh(); });
          ri.addEventListener("input", () => { const v = ri.value.replace(/[^0-9]/g, "").slice(0, 4); ri.value = v; r.repsDone = correctFrom(r.repsDone, i, v); fit(ri); mark(); refresh(); });
          for (const inp of [wi, ri]) inp.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); inp.blur(); } });
        }
        const ok = document.createElement("span"); ok.className = "sum-ok"; ok.textContent = "\u2713"; line.appendChild(ok);
        sumEl.appendChild(line);
      }
      refresh(); el.appendChild(sumEl);
    }
    return el;
  }

  // ---------- events ----------
  $("viewSeg").addEventListener("click", (e) => { const b = e.target.closest("button[data-view]"); if (!b) return; previewClient = b.dataset.view === "client"; S.renderedTraining = null; render(); });
  $("clientForm").addEventListener("submit", (e) => { e.preventDefault(); const n = $("clientName").value.trim(); if (!n) return; $("clientName").value = ""; addClient(n); });
  $("cNameField").addEventListener("input", (e) => { const c = clients.get(S.view.id); if (!c) return; c.name = e.target.value; $("cName").value = c.name; scheduleSave("clients", c.id); });
  const growNotesBox = () => growBox($("cNotes"));
  const wNoteOpen = new Set();                                   // workouts whose notes are unfolded (this session)
  function paintWorkoutNotes(t) {
    const c = clients.get(t.clientId), wrap = $("wNote");
    const mine = c && !S.clientMode && !isTemplateClient(t.clientId) ? noteEntries(c).filter((n) => n.workout && n.workout.id === t.id).sort((a, b) => String(a.at || "").localeCompare(String(b.at || ""))) : [];
    wrap.hidden = !mine.length; if (!mine.length) return;
    const open = wNoteOpen.has(t.id), word = mine.length === 1 ? "note" : "notes";
    $("wNoteLab").textContent = open ? "Hide " + word : "Read " + (mine.length === 1 ? "note" : mine.length + " notes");
    $("wNoteBtn").classList.toggle("open", open); $("wNoteBtn").setAttribute("aria-expanded", String(open));
    const list = $("wNoteList"); list.hidden = !open; list.replaceChildren();
    for (const n of mine) {
      const row = document.createElement("div"); row.className = "entry";
      const when = document.createElement("div"); when.className = "when"; const d = new Date(n.at);
      when.textContent = n.at ? d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }) + ", " + d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }) : "Earlier";
      const text = document.createElement("div"); text.className = "text"; text.textContent = n.text;
      row.append(when, text); list.appendChild(row);
    }
  }
  $("wNoteBtn").addEventListener("click", () => { const t = trainings.get(S.view.id); if (!t) return; if (wNoteOpen.has(t.id)) wNoteOpen.delete(t.id); else wNoteOpen.add(t.id); paintWorkoutNotes(t); });
  $("tNoteOpen").addEventListener("click", () => { const t = trainings.get(S.view.id); if (!t) return; tNoteOpenFor = t.id; $("tNoteBox").hidden = false; $("tNoteOpen").hidden = true; $("tNote").focus(); });
  $("tNote").addEventListener("input", (e) => { tNoteDraft.set(S.view.id, e.target.value); growBox(e.target); });
  $("tNoteDiscard").addEventListener("click", async () => { if ($("tNote").value.trim() && !(await askFirst({ title: "Discard what you wrote?", yes: "Discard" }))) return; tNoteDraft.delete(S.view.id); tNoteOpenFor = null; $("tNote").value = ""; $("tNoteBox").hidden = true; $("tNoteOpen").hidden = false; });
  $("tNoteSave").addEventListener("click", () => {
    const t = trainings.get(S.view.id), c = t && clients.get(t.clientId); if (!t || !c) return;
    const text = String($("tNote").value || "").trim(); if (!text) return;
    tNoteDraft.delete(t.id); tNoteOpenFor = null; $("tNote").value = ""; $("tNoteBox").hidden = true; $("tNoteOpen").hidden = false;
    writeNotes(c, [...noteEntries(c), { id: uid(), at: now(), text, workout: { id: t.id, title: String(t.title || ""), date: effDate(t) || String(t.date || "") } }]);
    wNoteOpen.add(t.id); paintWorkoutNotes(t);
  });
  $("cNotes").addEventListener("input", (e) => { const c = clients.get(S.view.id); if (!c) return; noteDraft.set(c.id, e.target.value); $("noteActions").hidden = !e.target.value.trim(); growNotesBox(); });
  $("noteSave").addEventListener("click", () => {
    const c = clients.get(S.view.id); if (!c) return;
    const text = String($("cNotes").value || "").trim(); if (!text) return;
    noteDraft.delete(c.id); $("cNotes").value = ""; $("noteActions").hidden = true; growNotesBox();
    writeNotes(c, [...noteEntries(c), { id: uid(), at: now(), text }]); renderNotes(c);
  });
  $("ovEx").addEventListener("input", (e) => { ovPick = ""; $("ovClear").hidden = !e.target.value; suggestOv(e.target.value); paintOvBest(); });
  $("ovEx").addEventListener("focus", (e) => suggestOv(e.target.value));
  $("ovEx").addEventListener("blur", () => setTimeout(() => { $("ovSugg").hidden = true; }, 120));
  $("ovClear").addEventListener("click", () => { ovPick = ""; $("ovEx").value = ""; $("ovClear").hidden = true; $("ovSugg").hidden = true; paintOvBest(); });
  $("ovBestBtn").addEventListener("click", (e) => { const x = $("ovBest")._e; if (x && x.best) showWhen(e.currentTarget, whenDay(x.best.date, true), x.best.title || "Workout"); });
  $("noteDiscard").addEventListener("click", async () => { if ($("cNotes").value.trim() && !(await askFirst({ title: "Discard what you wrote?", yes: "Discard" }))) return; const c = clients.get(S.view.id); if (c) noteDraft.delete(c.id); $("cNotes").value = ""; $("noteActions").hidden = true; growNotesBox(); });
  $("unitSeg").addEventListener("click", (e) => {
    const b = e.target.closest("button[data-unit]"); const c = clients.get(S.view.id); if (!b || !c) return;
    c.unit = b.dataset.unit; scheduleSave("clients", c.id);
    for (const x of $("unitSeg").querySelectorAll("button")) x.classList.toggle("on", x === b);
  });
  $("cEmail").addEventListener("input", (e) => { const c = clients.get(S.view.id); if (!c) return; c.email = e.target.value.trim().toLowerCase(); scheduleSave("clients", c.id); });
  $("cEmail").addEventListener("blur", () => { const c = clients.get(S.view.id); if (c) $("detailsBtn").classList.toggle("needs", !c.email); });
  $("cPhone").addEventListener("input", (e) => { const c = clients.get(S.view.id); if (!c) return; c.phone = e.target.value.trim(); scheduleSave("clients", c.id); });
  $("cBirthday").addEventListener("change", (e) => { const c = clients.get(S.view.id); if (!c) return; c.birthday = e.target.value || ""; scheduleSave("clients", c.id); });
  // phone -> international digits for sms: and wa.me (US numbers without a country code get +1)
  const phoneDigits = (p) => { let d = String(p || "").replace(/\D/g, ""); if (!d) return ""; if (String(p).trim().startsWith("+")) return d; if (d.length === 10) return "1" + d; if (d.length === 11 && d[0] === "1") return d; return d.length >= 7 ? d : ""; };
  function paintTrainerMsg(c) {
    const tel = c ? phoneDigits(c.trainerPhone) : ""; const wa = c && (c.chat || "sms") === "whatsapp";
    for (const id of ["trainerBtn", "trainerBtn2"]) { const a = $(id); if (!tel || !S.clientMode) { a.hidden = true; if (id === "trainerBtn") $("trainerRow").hidden = true; continue; } a.hidden = false; if (id === "trainerBtn") $("trainerRow").hidden = false; a.href = wa ? "https://wa.me/" + tel : "sms:+" + tel; if (wa) { a.target = "_blank"; a.rel = "noopener"; } else { a.removeAttribute("target"); a.removeAttribute("rel"); } }
  }
  // the coach's "Message <first name>" link: sms: or WhatsApp, by the client's chat setting. Returns false when there is no number to reach.
  function fillMsg(a, textEl, c) {
    const tel = c ? phoneDigits(c.phone) : ""; if (!tel) return false;
    const wa = (c.chat || "sms") === "whatsapp";
    textEl.textContent = "Message " + ((c.name || "").trim().split(/\s+/)[0] || "client");
    a.href = wa ? "https://wa.me/" + tel : "sms:+" + tel;
    if (wa) { a.target = "_blank"; a.rel = "noopener"; } else { a.removeAttribute("target"); a.removeAttribute("rel"); }
    return true;
  }
  function paintMsg(c) {
    const ok = fillMsg($("msgBtn"), $("msgText"), c); $("contactRow").hidden = !ok || S.clientMode;
  }
  $("cPhone").addEventListener("blur", () => { const c = clients.get(S.view.id); if (c) paintMsg(c); });
  $("accessSeg").addEventListener("click", (e) => {
    const b = e.target.closest("button"); if (!b) return;
    const c = clients.get(S.view.id); if (!c || isTemplateClient(c.id)) return;
    const paused = b.dataset.access === "paused"; if (!!c.paused === paused) return;
    c.paused = paused; if (!paused) c.sort = activeList().length; scheduleSave("clients", c.id); renderClient();
  });
  $("chatSeg").addEventListener("click", (e) => {
    const b = e.target.closest("button[data-chat]"); const c = clients.get(S.view.id); if (!b || !c) return;
    c.chat = b.dataset.chat; scheduleSave("clients", c.id);
    for (const x of $("chatSeg").querySelectorAll("button")) x.classList.toggle("on", x === b);
    paintMsg(c);
  });
  let detailsOpen = false, detailsFor = null;
  $("tabbar").addEventListener("click", (e) => { const b = e.target.closest("button"); if (!b || b.dataset.tab === S.tab) return; S.tab = b.dataset.tab; render(); window.scrollTo(0, 0); });
  document.addEventListener("focusin", (e) => { if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) document.body.classList.add("typing"); });
  document.addEventListener("focusout", () => { setTimeout(() => { const a = document.activeElement; if (!a || !/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)) document.body.classList.remove("typing"); }, 80); });
  $("detailsBtn").addEventListener("click", () => { detailsOpen = !detailsOpen; $("detailsBody").hidden = !detailsOpen; $("detailsBtn").classList.toggle("open", detailsOpen); $("detailsBtn").setAttribute("aria-expanded", String(detailsOpen)); });
  $("newTraining").addEventListener("click", () => addTraining(S.view.id, null, today()));
  $("delClient").addEventListener("click", () => { $("delClient").hidden = true; $("delClientConfirm").hidden = false; });
  $("delClientNo").addEventListener("click", () => { $("delClientConfirm").hidden = true; $("delClient").hidden = false; });
  $("delClientYes").addEventListener("click", () => deleteClient(S.view.id));

  $("tTitle").addEventListener("input", (e) => { const t = trainings.get(S.view.id); if (!t) return; t.title = e.target.value.replace(/\n/g, " "); e.target.style.height = "auto"; e.target.style.height = Math.max(32, e.target.scrollHeight) + "px"; scheduleSave("trainings", t.id); });
  $("tTitle").addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); e.currentTarget.blur(); } });
  $("tDate").addEventListener("click", () => {
    const t = trainings.get(S.view.id); if (!t || S.clientMode || isTemplateClient(t.clientId)) return;
    const id = t.id;
    openDatePicker({ clientId: t.clientId, title: "Move to", selected: t.date || today(), onPick: (date) => { const cur = trainings.get(id); if (!cur) return; touchState(id, "date"); cur.date = date; scheduleSave("trainings", id); S.renderedTraining = null; render(); } });
  });
  $("addRow").addEventListener("click", () => {
    const t = trainings.get(S.view.id); if (!t) return;
    const r = newRow(nextLabel(t)); t.rows.push(r); scheduleSave("trainings", t.id);
    S.renderedTraining = null; render();
    const el = document.querySelector('.row[data-id="' + r.id + '"]'); if (el) el.querySelector(".name").focus();
  });
  function setSkipped(skipped) {
    const t = trainings.get(S.view.id); if (!t) return;
    t.skippedAt = skipped ? now() : null; t.missed = false; touchState(t.id, "skippedAt", "missed");   // a person decided: never filed by itself again
    if (S.clientMode) { pendingSkip.add(t.id); pendingMiss.add(t.id); }
    scheduleSave("trainings", t.id); paintFinish(t);
    if (skipped) go({ name: "client", id: t.clientId });
  }
  $("skipBtn").addEventListener("click", () => setSkipped(true));
  $("unskipBtn").addEventListener("click", () => setSkipped(false));
  $("finishBtn").addEventListener("click", () => setFinished(true));
  $("unfinishBtn").addEventListener("click", () => setFinished(false));
  $("copyTraining").addEventListener("click", async () => {                 // "Copy workout" asks which client gets the copy; this client is the first row
    const t = trainings.get(S.view.id); if (!t) return;
    const me = clients.get(t.clientId), others = peopleList().filter((c) => c.id !== t.clientId);
    const items = [me, ...others].filter(Boolean).map((c) => ({ id: c.id, label: c.name || "Unnamed", sub: c.id === t.clientId ? "this client" : (c.paused ? "Paused" : "") }));
    const id = await pickOne({ title: "Copy workout to", items });
    if (id && clients.has(id)) addTraining(id, t);
  });
  $("saveTemplate").addEventListener("click", () => { const t = trainings.get(S.view.id); if (t) saveAsTemplate(t); });
  $("tplFill").addEventListener("click", () => { const t = trainings.get(S.view.id); if (!t) return; fillFor = t.id; pickFor = t.clientId; if (!clients.has(TEMPLATES_ID)) { clients.set(TEMPLATES_ID, { id: TEMPLATES_ID, name: "Templates", notes: "", email: "", unit: "lb", createdAt: now(), kind: "templates" }); scheduleSave("clients", TEMPLATES_ID, 0); } go({ name: "client", id: TEMPLATES_ID, program: null, phase: null, stage: null }); });
  $("fromTemplate").addEventListener("click", () => { pickFor = S.view.id; if (!clients.has(TEMPLATES_ID)) { clients.set(TEMPLATES_ID, { id: TEMPLATES_ID, name: "Templates", notes: "", email: "", unit: "lb", createdAt: now(), kind: "templates" }); scheduleSave("clients", TEMPLATES_ID, 0); } go({ name: "client", id: TEMPLATES_ID, program: null, phase: null, stage: null }); });
  $("useBtn").addEventListener("click", () => {
    const t = trainings.get(S.view.id); if (!t) return;
    const ul = $("usePick"); if (!ul.hidden) { ul.hidden = true; return; }
    const people = peopleList(); if (lastUse.client) { const i = people.findIndex((c) => c.id === lastUse.client); if (i > 0) people.unshift(people.splice(i, 1)[0]); }
    ul.replaceChildren(...people.map((c) => { const li = document.createElement("li"); const b = document.createElement("button"); b.type = "button"; b.innerHTML = "<span></span><span class=\"sub\"></span>"; b.firstChild.textContent = c.name || "Unnamed"; b.lastChild.textContent = c.id === lastUse.client ? "last used" : ""; b.lastChild.insertAdjacentHTML("beforeend", '<span class="chev">\u203a</span>'); b.addEventListener("click", () => openDatePicker({ clientId: c.id, title: "Add to " + (c.name || "client"), onPick: (date) => applyTemplate(trainings.get(t.id) || t, c.id, date) })); li.appendChild(b); return li; }));
    if (!people.length) { const li = document.createElement("li"); li.className = "empty"; li.style.padding = "12px 16px"; li.textContent = "Add a client first."; ul.appendChild(li); }
    ul.hidden = false;
  });
  $("delTraining").addEventListener("click", () => { $("delTraining").hidden = true; $("delTrainingConfirm").hidden = false; });
  $("delTrainingNo").addEventListener("click", () => { $("delTrainingConfirm").hidden = true; $("delTraining").hidden = false; });
  $("delTrainingYes").addEventListener("click", () => deleteTraining(S.view.id));

  window.addEventListener("pagehide", flushAll);
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") flushAll(); });
  for (const type of ["gesturestart", "gesturechange"]) document.addEventListener(type, (e) => e.preventDefault(), { passive: false });   // Safari: an accidental two-finger pinch leaves the page slightly zoomed in and drifting sideways; an app does not zoom

  // ---------- report PDF: one client's month (sessions, logged sets, your notes), set in Inter, to mail yourself ----------
  let reportFonts = null, reportFontsP = null;
  function loadReportFonts() {                                      // Inter Regular + Bold from the app's own folder (the offline shell keeps them)
    if (reportFonts) return Promise.resolve(reportFonts);
    if (!reportFontsP) reportFontsP = Promise.all(["fonts/Inter-Regular.ttf", "fonts/Inter-Bold.ttf"].map((u) => fetch(u).then((r) => { if (!r.ok) throw new Error(u); return r.arrayBuffer(); })))
      .then(([a, b]) => (reportFonts = { regular: parseTtf(a), bold: parseTtf(b) }))
      .catch(() => { reportFontsP = null; return null; });
    return reportFontsP;
  }
  async function shareReport(kind, clientId) {                     // the phone's share sheet (Mail is one tap away); elsewhere a download
    const c = clients.get(clientId); if (!c) return;
    const fonts = await loadReportFonts();
    const { bytes, name } = buildReport(kind, fonts, c, clientTrainings(c.id));
    const file = new File([bytes], name, { type: "application/pdf" });
    if (navigator.canShare && navigator.canShare({ files: [file] })) { try { await navigator.share({ files: [file], title: name }); return; } catch (e) { if (e && e.name === "AbortError") return; } }
    const a = document.createElement("a"); a.href = URL.createObjectURL(file); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }
  $("reportNow").addEventListener("click", () => shareReport("month", S.view.id));
  $("reportMonth").addEventListener("change", (e) => { const v = e.target.value; e.target.value = ""; if (v) shareReport(v, S.view.id); });
  $("backup").addEventListener("click", () => {
    const data = { app: "fiala-trainings", exported: now(), clients: Object.fromEntries(clients), trainings: Object.fromEntries(trainings) };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "fiala-trainings-" + today() + ".json";
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  });
  $("restore").addEventListener("click", () => $("restoreFile").click());
  $("restoreFile").addEventListener("change", async (e) => {
    const f = e.target.files && e.target.files[0]; if (!f) return;
    try {
      const { cs, ts } = validateBackup(JSON.parse(await f.text()), (id) => clients.has(id));        // the whole file first; nothing is touched if any part is wrong
      const nC = cs.filter((c) => !isTemplateClient(c.id)).length, nT = ts.filter((t) => !isTemplateClient(t.clientId)).length, nTpl = ts.length - nT;
      const whats = [nC + (nC === 1 ? " client" : " clients"), nT + (nT === 1 ? " workout" : " workouts")]; if (nTpl) whats.push(nTpl + (nTpl === 1 ? " template" : " templates"));
      if (!(await askFirst({ title: "Restore this backup?", text: whats.join(", ") + " from the file go into the app. Where the app already has one of them, the file\u2019s copy wins; everything else stays.", yes: "Restore" }))) { e.target.value = ""; return; }
      for (const c of cs) { clients.set(c.id, c); scheduleSave("clients", c.id, 0); }
      for (const t of ts) { repairTimed(t); trainings.set(t.id, t); scheduleSave("trainings", t.id, 0); }   // a backup from before the Time box: a hold's seconds leave the weight column here too
      render();
    } catch { $("status").textContent = "That file is not a Fiala backup"; }
    e.target.value = "";
  });

  // ---------- boot ----------
  Object.assign(ui, { $, setStatus, render, showProblem, showWaiting, loadCustomVideos, loadCustomNames, loadCustomSubs, loadHidden, offlineFromMirror, resumeOnline, paintDraftBar });   // what the sync layer may call on the screens
  async function boot() {
    try { const v = new URL(import.meta.url).searchParams.get("v"); if (v) $("appVersion").textContent = "Version " + v; } catch (_) {}   // the build this phone runs, read off the script's own ?v=
    const saved = lsGet("fiala.trainings.view"); if (saved && saved.name) S.view = saved;
    const page = lsGet("fiala.trainings.page"); if (page && page.open) pendingPage = page;   // read before any screen change clears it
    localBackend.load();                       // instant start from the device copy
    restorePending();                          // and whatever was still waiting to reach the server
    holdWake(true);                            // opened straight onto a workout: keep the screen on from the first moment
    if (window.supabase && window.supabase.createClient) {
      S.sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: "implicit" } });
      $("status").textContent = "Loading\u2026";
      const fromRecoveryLink = /type=recovery/.test(location.hash);
      S.sb.auth.onAuthStateChange((event) => {
        if (event === "PASSWORD_RECOVERY") { S.recovering = true; showRecovery(); }
        if (event === "SIGNED_OUT" && S.signedIn) { S.backend = null; S.offline = false; S.offlineEntry = null; S.pendingOwner = ""; try { localStorage.removeItem("fiala.trainings.role"); } catch {} showLogin("Signed out. Sign in again to keep syncing."); }
      });
      // no signal: the library retries the token refresh for up to 30 s before answering. Don't make anyone wait for that:
      // after 4 s show what the device knows, and switch to live data if the session comes through later.
      const remembered = lsGet("fiala.trainings.role");
      const sessionP = S.sb.auth.getSession();
      const first = await Promise.race([sessionP, new Promise((r) => setTimeout(() => r("slow"), 4000))]);
      if (first === "slow") {
        if (remembered && remembered.email && !fromRecoveryLink) enterOffline(remembered); else showLogin("");
        sessionP.then(({ data }) => { if (data && data.session) { if (fromRecoveryLink) { S.recovering = true; showRecovery(); return; } if (S.entering || S.resuming || (S.signedIn && S.offlineEntry !== "remembered")) return; enterCloud(data.session); } else if (!S.signedIn) showLogin($("loginMsg").textContent); }).catch(() => {});
        return;
      }
      const { data, error: sessionError } = first;
      if (location.hash && /access_token|error/.test(location.hash)) history.replaceState(null, "", location.pathname);
      if (fromRecoveryLink && data && data.session) { S.recovering = true; showRecovery(); return; }
      if (data && data.session) { await enterCloud(data.session); }
      else if ((!navigator.onLine || isNetwork(sessionError)) && remembered && remembered.email) enterOffline(remembered);
      else showLogin("");
      return;
    }
    // no library (blocked network): work from the device copy
    S.backend = localBackend; $("localFoot").hidden = false; render(); setStatus();
    seedTemplates().catch(() => {});
  }
  if (!(window.supabase && window.supabase.createClient)) render();

  // ---------- exports: the page calls boot(); the test run (tests/) reaches the internals ----------
  export function internals() {
    return {
      fns: { addTraining, packageOf, renameExercise, deleteExercise, addCustomName, loadHidden, loadCustomSubs, saveSub, deleteSub, subtitleFor, refreshNames, allNames: () => ALL_NAMES.slice(), knownName, videoForName, exerciseMatches, properName, overviewCounts, loggedExercises, syncDownNow, fetchAll, mergeDown, cloudBackend, clientBackend, localBackend, flushOne, scheduleSave, markDirty, persistPending, restorePending, freshRow, isEmptyWorkout, effDate, clientTrainings, lastWeights, setsOf, groupKey, noteEntries, packNotes, mergeNotes: (a, b) => mergeNotes(a, b, deletedNotes), validateBackup: (d) => validateBackup(d, (id) => clients.has(id)), buildReport: (kind, fonts, c) => buildReport(kind, fonts, c, clientTrainings(c.id)), reportRange, parseTtf, pdfDoc, today, localIso, uid, key, setFinished, setSkipped, touchState, isTemplateClient, addTraining, render, setStatus },
      maps: { hiddenKeys, customNames, customVideos, customSubs, clients, trainings, dirty, seenAt, confirmedAt, timers, chains, trainerState, trainerTouched, trainerNamed, pendingWeightRows, pendingDoneRows, pendingEarlyRows, pendingFinish, pendingSkip, pendingMove, pendingMiss, pendingSwap },
      get: () => ({ ...S }),
      set: (o) => { Object.assign(S, o); },
      reset: () => { resetState(); localStorage.clear(); },
      wake: () => ({ held: !!wake, timer: !!wakeTimer }),
    };
  }
  export { boot };
