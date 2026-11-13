// Fiala Trainings — the app. Loaded by index.html as an ES module; boot() starts it.
import { NAMES, VIDEOS, ALIASES } from "./catalog.js";
import { S, resetState, clients, trainings, dirty, timers, chains, pendingWeightRows, pendingDoneRows, pendingEarlyRows, pendingFinish, pendingSkip, trainerState, pendingMove, pendingMiss, pendingSwap, pendingOrder, seenAt, trainerTouched, trainerNamed, trainerNoted, confirmedAt, deletedNotes, deletedPackages, folderTouched, deletedFolders, fromFile, pendingNoteRows, ui, planTouched } from "./state.js";
import { uid, now, today, localIso, fmtDate, fmtDay, fmtDayLong, clamp, norm, squash, lsGet, lsSet, daysLater } from "./util.js";
import { TEMPLATES_ID, isTemplateClient, effDate, freshRow, isEmptyWorkout, setsOf, groupKey, labelKey, cmpLabel, validateBackup, doneCount, timedPlan, measurePlan, convertWeight, stampUnit, toUnit, toTimeUnit, timeAsWeight, repairTimed, planNumber, followFrom, autoSubtitle, splitName, composeName, perHand, betterSet, topSet, sameSet, setCounts, correctFrom, planProgress, sessionNo, planActive } from "./model.js";
import { noteEntries, packNotes, mergeNotes } from "./notes.js";
import { seenDoc, moveOut, isNetwork, isOffline, reasonOf, key, markDirty, persistPending, restorePending, scheduleSave, flushAll, flushOne, localBackend, touchState, TABLE, cloudBackend, clientBackend, syncDown, mergeDown, syncDownNow, scheduleSync, withTimeout, fetchAll } from "./sync.js";
import { parseTtf, pdfDoc } from "./pdf.js";
import { initials, paintAvatar, photoFor, setPhoto, loadPhoto, squarePhoto, cropPhoto, crop, flushPhotos, resetPhotos, forgetPhoto, loadPhotoQueue, photoQueue } from "./photos.js";
import { reportRange, buildReport } from "./report.js";

  // ---------- helpers ----------
  const $ = (id) => document.getElementById(id);
  // "W", "Wa", "Wb" … = warm-up: groups like a number and sorts before 1
  const isWarmLabel = (l) => /^w\s*[a-z]?$/i.test(String(l || "").trim());
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
  const catalogDigest = new Map(), catalogBump = (name, m) => { const d = JSON.stringify([...m]); if (catalogDigest.get(name) !== d) { catalogDigest.set(name, d); S.renderedTraining = null; } };   // names, videos, subtitles or hidden entries changed: the cards on screen are built again once
  const catalogSeq = {};                                               // per catalog: the number of the latest load, so a late answer from an earlier one is dropped
  async function loadHidden() {
    if (!S.sb || !S.signedIn) return;
    const seq = (catalogSeq.loadHidden = (catalogSeq.loadHidden || 0) + 1);
    const { data, error } = await S.sb.from("ft_exercise_hidden").select("name_key");
    if (error || !data || seq !== catalogSeq.loadHidden) return;   // a fresher load answered meanwhile: this older answer must not roll it back
    hiddenKeys.clear(); for (const r of data) hiddenKeys.add(r.name_key); refreshNames(); catalogBump("hidden", hiddenKeys);
  }
  async function hideBuiltin(k) { const { error } = await S.sb.from("ft_exercise_hidden").upsert({ name_key: k }); if (error) { lastDbError = error.message || ""; return false; } hiddenKeys.add(k); refreshNames(); return true; }
  async function unhideBuiltin(k) { if (!hiddenKeys.has(k)) return true; const { error } = await S.sb.from("ft_exercise_hidden").delete().eq("name_key", k); if (error) { lastDbError = error.message || ""; return false; } hiddenKeys.delete(k); refreshNames(); return true; }
  const nearName = (n) => { const k = squash(n); if (!k) return null; const cands = [k.replace(/(es|s)$/, ""), k + "s", k + "es"].filter((c) => c && c !== k); for (const c of cands) { const i = ALL_KEYS.indexOf(c); if (i >= 0) return ALL_NAMES[i]; } return null; };
  const tidyName = (n) => { n = String(n || "").replace(/\s+/g, " ").trim(); return n ? n[0].toUpperCase() + n.slice(1) : ""; };
  async function loadCustomNames() {
    if (!S.sb || !S.signedIn) return;
    const seq = (catalogSeq.loadCustomNames = (catalogSeq.loadCustomNames || 0) + 1);
    const { data, error } = await S.sb.from("ft_exercises").select("name_key,name");
    if (error || !data || seq !== catalogSeq.loadCustomNames) return;   // a fresher load answered meanwhile: this older answer must not roll it back
    customNames.clear(); for (const r of data) customNames.set(r.name_key, r.name); refreshNames(); catalogBump("names", customNames);
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
    if (!S.templateDraft || S.templateDraft.id !== t.id) { normalizeLabels(t); for (const r of t.rows || []) if (ALIASES[r.name]) r.name = ALIASES[r.name]; S.templateDraft = { id: t.id, snapshot: JSON.stringify(t), dirty: false, saving: false }; }   // the tidying the build does is not an edit
    return S.templateDraft;
  }
  const tidySave = (t) => { const d = S.templateDraft; if (isTemplateClient(t.clientId) && d && d.id === t.id && !d.dirty) { d.saving = true; scheduleSave("trainings", t.id); d.saving = false; d.snapshot = JSON.stringify(t); } else scheduleSave("trainings", t.id); };   // a label or a name tidied by the build: saved, never an "unsaved change"
  function paintDraftBar() {
    const d = S.templateDraft; const show = !!(d && d.dirty && S.view.name === "training" && S.view.id === d.id);
    $("draftBar").hidden = !show; document.body.classList.toggle("draft", show);
  }
  function saveDraft() {
    const d = S.templateDraft; if (!d) return;
    const t = trainings.get(d.id); if (!t) { S.templateDraft = null; lsSet("fiala.trainings.draft", null); paintDraftBar(); return; }
    d.dirty = false; d.saving = true; scheduleSave("trainings", d.id, 0); d.saving = false; d.snapshot = JSON.stringify(t); lsSet("fiala.trainings.draft", null);
    paintDraftBar(); const n = S.pendingGo; S.pendingGo = null; if (n) go(n.next, n.back);
  }
  function discardDraft() {
    const d = S.templateDraft; if (!d) return;
    if (trainings.has(d.id)) trainings.set(d.id, JSON.parse(d.snapshot));
    d.dirty = false; lsSet("fiala.trainings.draft", null); localBackend.save(); S.renderedTraining = null; paintDraftBar();
    const n = S.pendingGo; S.pendingGo = null; if (n) go(n.next, n.back); else render();
  }
  $("draftSave").addEventListener("click", saveDraft);
  $("draftDiscard").addEventListener("click", async () => { if (await askFirst({ title: "Discard the unsaved changes?", text: "The template stays as it was.", yes: "Discard" })) discardDraft(); });


  function setStatus() {
    const el = $("status");
    const pending = timers.size + S.inflight;
    if (S.deviceFull) { el.className = "err"; el.textContent = "Not saved on this device \u00b7 free up space"; return; }
    if (S.backend && S.backend !== localBackend && (S.offline || !navigator.onLine)) { el.className = ""; el.textContent = (dirty.size || pending) ? "Offline \u00b7 will sync" : "Offline"; return; }   // short enough for the bar beside its Messages circle (his pick, 10 Nov: "Offline")
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
    const seq = (catalogSeq.loadCustomSubs = (catalogSeq.loadCustomSubs || 0) + 1);
    const { data, error } = await S.sb.from("ft_exercise_subtitles").select("name_key,subtitle");
    if (error || !data || seq !== catalogSeq.loadCustomSubs) return;   // a fresher load answered meanwhile: this older answer must not roll it back
    customSubs.clear(); for (const r of data) customSubs.set(r.name_key, String(r.subtitle || "")); catalogBump("subs", customSubs);
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
    const seq = (catalogSeq.loadCustomVideos = (catalogSeq.loadCustomVideos || 0) + 1);
    const { data, error } = await S.sb.from("ft_exercise_videos").select("name_key,video_id");
    if (error || !data || seq !== catalogSeq.loadCustomVideos) return;   // a fresher load answered meanwhile: this older answer must not roll it back
    customVideos.clear(); videoRawKeys.clear();
    for (const r of data) { const k = ALIAS_LOOSE[r.name_key] || r.name_key; customVideos.set(k, r.video_id); if (!videoRawKeys.has(k)) videoRawKeys.set(k, new Set()); videoRawKeys.get(k).add(r.name_key); } // links saved under an old spelling follow the rename
    catalogBump("videos", customVideos);
  }

  // ---- no signal: the device copy (saved after every successful sync) stands in until the server answers again
  function offlineFromMirror() {
    const me = [...clients.values()].find((c) => !isTemplateClient(c.id) && norm(c.email) === norm(S.sessionEmail));
    if (!me) return false;
    S.myClientId = me.id; S.offline = true;
    if (!(S.view.name === "training" && trainings.has(S.view.id))) S.view = { name: "client", id: S.myClientId };
    renderUnlessSwiping(); setStatus(); return true;   // (never the page or row under a finger rebuilt mid-swipe)
  }
  function paintRemembered(remembered, away) {   // what the device knows, on screen at once: the pages of the account that used it last; the server refreshes them in place (away: no signal, with the offline status)
    S.signedIn = true; S.sessionEmail = remembered.email || ""; S.clientMode = remembered.role !== "trainer";
    applyLook(); S.backend = S.clientMode ? clientBackend : cloudBackend;
    if (away) { S.offlineEntry = "remembered"; S.offline = true; }
    if (S.clientMode) {
      const me = [...clients.values()].find((c) => !isTemplateClient(c.id) && norm(c.email) === norm(S.sessionEmail));
      if (!me) { if (away) { hideAllViews(); showLogin("You\u2019re offline. Connect once to sign in."); } return false; }
      S.myClientId = me.id;
      if (!(S.view.name === "training" && trainings.has(S.view.id))) S.view = { name: "client", id: S.myClientId };
      render(); setStatus(); return true;
    }
    $("dataNote").textContent = "Synced to the cloud"; $("myExercises").hidden = false; $("packagesBtn").hidden = false; $("settingsBtn").hidden = false; $("catalogBtn").hidden = false; $("dataBtn").hidden = false; $("localFoot").hidden = false;
    render(); setStatus(); return true;
  }
  const onScreenAs = (email) => S.signedIn && norm(S.sessionEmail) === norm(email || "") && (!S.clientMode || !!S.myClientId);   // this account's pages are already up: whatever comes next refreshes them in place, never a blank in between
  function enterOffline(remembered) {     // no session could be read (token expired, no signal): use what the device knows
    if (onScreenAs(remembered.email)) { S.offline = true; S.offlineEntry = "remembered"; setStatus(); return; }   // painted at boot already: only the status changes
    paintRemembered(remembered, true);
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
    const dy = calFold(); if (dy && backScroll != null) backScroll = Math.max(0, backScroll + dy);   // the card, History or Settings opened over a client's month: the week comes back under it, and Back's place moves with the list
    navWillChange(); $("meDisc").hidden = true; $("tMore").hidden = true; $("tAdd").hidden = true; $("barMsg").hidden = true; closeMoreMenu();
    rememberPage();                                                   // every page change passes here: the device remembers which settings page is up
    $("tabbar").hidden = true; $("addBtn").hidden = true; document.body.classList.remove("tabs", "tplus"); $("dock").classList.remove("tp");
    $("viewSeg").hidden = true; $("addExBtn").hidden = true; document.body.classList.remove("wsdock"); $("dock").classList.remove("ws");   // the workout page's bar too: Coach | Client and its +
    for (const id of ["vLogin", "vSignup", "vPassword", "vExercises", "vExercise", "vPackages", "vSettings", "vClientCard", "vHistory", "vCatalog", "vData", "vNumber", "vRecovery", "vWaiting", "vCelebrate", "vClients", "vClient", "vTraining"]) $(id).hidden = true;
    $("navDone").hidden = true;
  }
  function showLogin(msg) {
    dropWake();
    S.signedIn = false; S.clientMode = false; S.myClientId = null; reordering = false; tplOrdering = null; document.body.classList.remove("client");
    $("localFoot").hidden = true; $("myExercises").hidden = true; $("packagesBtn").hidden = true; $("settingsBtn").hidden = true; $("catalogBtn").hidden = true; $("dataBtn").hidden = true; settingsOpen = false; fromSettings = false;
    hideAllViews(); $("vLogin").hidden = false;
    $("back").hidden = true; $("brand").hidden = false; $("status").textContent = "";
    $("loginMsg").textContent = msg || "";
  }
  function showSignup() {
    hideAllViews(); $("vSignup").hidden = false; $("suForm").hidden = false; $("suDone").hidden = true; $("back").hidden = true; $("brand").hidden = false; $("status").textContent = "";
    $("suMsg").textContent = ""; $("suEmail").value = $("loginEmail").value.trim(); setTimeout(() => $("suName").focus(), 50);
  }
  const scrollMemo = new Map();          // page key -> how far it was scrolled when it was left: Back lands there (his rule: never at the top)
  const viewKey = (v) => [v.name, v.id || "", v.program || "", v.phase || "", v.stage || "", v.folder || "", (v.folder ? shownSlide(v) : v.slide) || ""].join("/");   // (his template folders and their slides too, 12 Nov: each its own page for Back, its place and its picture; a folder's page by the slide it shows, named or not, so the key it is left under is the key Back and the swipe look for)
  const setTab = (v) => { S.tab = v; lsSet("fiala.trainings.tab", v); };   // the client page's tab, remembered across a reload
  let dragging = false;                  // a client row is under the finger: no redraw of the list until it is put down
  let kbSwitching = false;               // the keyboard bar's Aa/123 switch is re-focusing the box: that blur is not a leave
  let exPainted = null;                  // { name, sub, video } the exercise page was painted with: edits are measured against these, not against data that may arrive later
  let backScroll = null;                 // where the Clients page (or the client's profile) was scrolled when Settings, Catalog or Data was opened: Back returns there, not to the top
  let settingsOpen = false;              // false | "settings" | "password" | "exercises" | "packages" | "number"
  let fromSettings = false;              // false | "settings" | "catalog": the list page a sub-page (number, password, exercises, packages) was opened from; Back returns there
  let pendingPage = null;                // the settings page that was open when the page was last refreshed: it comes back after sign-in
  let exStale = false;                   // the exercise pages came back before the first sync: painted once more when the custom names, videos and subtitles are in
  const leaveSettings = () => { settingsOpen = false; fromSettings = false; exCurrent = null; exPainted = null; hideAllViews(); };   // off the settings pages (tests use it; Back does the same with a render)
  const rememberPage = () => lsSet("fiala.trainings.page", settingsOpen ? { open: settingsOpen, from: fromSettings || false, ...(settingsOpen === "exercise" && exCurrent ? { name: exCurrent.name, key: exCurrent.key } : {}) } : null);
  // ---- appearance: auto (follow the phone) | light | dark. Saved on this device only.
  const THEME_KEY = "fiala.theme";
  // theme-color: the page's own colour, always. The strip under the clock is not ours to paint: iOS leaves it see-through (the page scrolls
  // under the time, as in Apple's apps) as long as no pinned box spans the screen's width (index.html, header)
  const themeColours = { light: "#f5f5f5", dark: "#000000" };
  let themeChoice = "auto";
  // ---- the top bar, as Apple's: none at the top of a page; the frosted bar and its hairline fade in over the first 12 points the page scrolls under it
  const BAR_FADE = 12;
  let barLevel = -1;
  function paintStrip() {
    for (const m of document.querySelectorAll('meta[name="theme-color"]')) {
      if (m.dataset.media === undefined) m.dataset.media = m.getAttribute("media") || "";
      const isDark = /dark/.test(m.dataset.media);
      if (themeChoice === "auto") { m.setAttribute("media", m.dataset.media); m.content = themeColours[isDark ? "dark" : "light"]; }
      else { m.removeAttribute("media"); m.content = themeColours[themeChoice]; }
    }
  }
  function setBar(v) {                                              // the bar's level on the header (its look fades with it: index.html, header::before); the header itself never changes size or colour
    const h = document.querySelector("header"); if (!h || !h.style) return;
    h.style.setProperty("--bar", String(v));
  }
  function nudgeEdge() {                                            // a pinned element appearing or going: WebKit reads the strip under the clock again on the next frame (index.html, #edgeNudge); the strip itself
    const nudge = document.getElementById("edgeNudge"); if (nudge) nudge.hidden = !nudge.hidden;   // is always the page's colour, so this is needed only when that colour changes (the theme)
  }
  function paintBar() {
    const y = Number(window.scrollY) || 0;                          // a pull past the top (Safari's bounce) reads below 0: no bar, as Apple's
    const v = Math.round(Math.min(1, Math.max(0, y / BAR_FADE)) * 100) / 100;
    if (v !== barLevel) { barLevel = v; setBar(v); }
  }
  window.addEventListener("scroll", paintBar, { passive: true });
  window.addEventListener("resize", paintBar);
  function applyTheme(v) {
    v = v === "light" || v === "dark" ? v : "auto";
    themeChoice = v;
    if (v === "auto") document.documentElement.removeAttribute("data-theme"); else document.documentElement.setAttribute("data-theme", v);
    paintStrip(); nudgeEdge();                                      // the strip under the clock takes the new page colour at once
    for (const b of $("themeSeg").querySelectorAll("button")) { b.classList.toggle("on", b.dataset.theme === v); b.setAttribute("aria-checked", b.dataset.theme === v ? "true" : "false"); }
  }
  applyTheme(lsGet(THEME_KEY));
  paintBar();
  try { const mq = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)"); if (mq && mq.addEventListener) mq.addEventListener("change", nudgeEdge); } catch (_) {}   // the phone switching light/dark: the strip follows at once
  $("themeSeg").addEventListener("click", (e) => { const b = e.target.closest("button"); if (!b) return; lsSet(THEME_KEY, b.dataset.theme); applyTheme(b.dataset.theme); });
  // ---- open workouts in: Coach | Client (his ask, 12 Nov: "a toggle where I can switch in what view workouts open automatically ... even from
  // coaches profile when I open a workout it automatically opens in clients view ... that obviously doesnt apply when I am creating a brand new
  // workout"; his picks: the Coach | Client control, as Appearance's, saved per device). The workout page's own Coach | Client still flips it.
  const OPEN_KEY = "fiala.openAs";
  const openAs = () => (lsGet(OPEN_KEY) === "client" ? "client" : "coach");
  function paintOpenAs() { const v = openAs(); for (const b of $("openSeg").querySelectorAll("button")) { b.classList.toggle("on", b.dataset.open === v); b.setAttribute("aria-checked", b.dataset.open === v ? "true" : "false"); } }
  const setOpenAs = (v) => { lsSet(OPEN_KEY, v === "client" ? "client" : "coach"); paintOpenAs(); };
  paintOpenAs();
  $("openSeg").addEventListener("click", (e) => { const b = e.target.closest("button[data-open]"); if (b) setOpenAs(b.dataset.open); });
  let freshWorkout = null;                                           // a workout just made (the +, a day tapped, a copy, a template used or filled in): it opens as the coach, to be filled in
  function showSettings() {
    settingsOpen = "settings"; fromSettings = false; hideAllViews(); $("vSettings").hidden = false; $("back").hidden = false; $("backLabel").textContent = "Back"; $("brand").hidden = true; $("status").textContent = "";
    const p = trainerPhone(); $("setNumberVal").textContent = p || "Not set"; $("setEmail").textContent = S.sessionEmail || "";
    paintHeroes();
  }
  function showClientCard() {                                       // the coach's card for this client: everything about the person on one page, like a contact's card
    const c = clients.get(S.view.id); if (!c || S.clientMode || isTemplateClient(c.id)) return;
    settingsOpen = "card"; fromSettings = false; hideAllViews(); $("vClientCard").hidden = false; $("back").hidden = false; $("backLabel").textContent = "Back"; $("brand").hidden = true; $("status").textContent = "";
    paintCard();
  }
  const syncRadios = () => { for (const g of document.querySelectorAll('[role="radiogroup"]')) for (const b of g.querySelectorAll("button")) b.setAttribute("aria-checked", String(b.classList.contains("on"))); };   // the segmented controls: what the eye sees as chosen, a screen reader hears
  function paintCard() {                                            // the card's fields from the record; a field being typed in is left alone
    const c = clients.get(S.view.id); if (!c) return;
    $("cardName").textContent = c.name || "Client"; paintHeroes();
    if (document.activeElement !== $("cNameField")) $("cNameField").value = c.name || "";
    if (document.activeElement !== $("cEmail")) $("cEmail").value = c.email || "";
    if (document.activeElement !== $("cPhone")) $("cPhone").value = c.phone || "";
    if (document.activeElement !== $("cBirthday")) $("cBirthday").value = c.birthday || "";
    for (const b of $("chatSeg").querySelectorAll("button")) b.classList.toggle("on", (c.chat || "sms") === b.dataset.chat);
    for (const b of $("unitSeg").querySelectorAll("button")) b.classList.toggle("on", (c.unit || "lb") === b.dataset.unit);
    for (const b of $("accessSeg").querySelectorAll("button")) b.classList.toggle("on", (c.paused ? "paused" : "active") === b.dataset.access);
    paintPlanDetails(c); syncRadios();
    $("delClientConfirm").hidden = true; $("delClient").hidden = false;
  }
  const openGroups = new Map();                                     // "<client>/<group>" -> opened or folded by hand this session
  let histMemo = null;                                              // a workout opened from History: { client, id, y: where History was scrolled, under: where the client's page under it was }
  const fromHistory = (t) => !!t && S.view.name === "training" && S.view.id === t.id && S.view.from === "history" && !isTemplateClient(t.clientId) && clients.has(t.clientId);   // this workout was opened from its client's History (the view says so, a reload included): Back goes there
  function openFromHistory(id) {                                    // a past workout tapped on History: it opens; Back comes back to History, where it was
    const t = trainings.get(id); if (!t || settingsOpen !== "history") return;
    histMemo = { client: S.view.id, id, y: Number(window.scrollY) || 0, under: backScroll };
    settingsOpen = false; fromSettings = false; hideAllViews();     // off History (its picture is taken first, for the swipe back to it); the device no longer remembers it as the page that is up
    go({ name: "training", id, from: "history" });
    if (histMemo.under != null) scrollMemo.set(viewKey({ name: "client", id: histMemo.client }), histMemo.under);   // the client's page was left where History was opened from it
  }
  function backToHistory(t) {                                       // Back from a workout opened from History (the Back circle, the swipe, Delete): History again, as it was
    const m = histMemo && histMemo.client === t.clientId && histMemo.id === t.id ? histMemo : null; histMemo = null;
    go({ name: "client", id: t.clientId }, true);
    if (!(S.view.name === "client" && S.view.id === t.clientId)) return;
    backScroll = m ? m.under : null;                                // its own Back still lands on the client's page where it was
    const e = effDate(t) || "";                                     // after a reload (iOS reopens an app it closed in the background) no place is known: the workout's own row, its group opened, in the middle
    if (!m && e) for (const k of e >= weekStart() ? ["week"] : [e.slice(0, 4), e.slice(0, 7)]) openGroups.set(t.clientId + "/" + k, true);
    showHistory();
    if (m) { window.scrollTo(0, m.y); return; }
    const row = $("histList").querySelector('[data-tid="' + String(t.id).replace(/["\\]/g, "") + '"]');
    if (row && typeof row.getClientRects === "function" && row.getClientRects().length) row.scrollIntoView({ block: "center" }); else window.scrollTo(0, 0);
  }
  const weekStart = () => { const base = new Date(today() + "T12:00:00"), monday = new Date(base); monday.setDate(base.getDate() - ((base.getDay() + 6) % 7)); return localIso(monday); };   // this week's Monday: History's "This week" starts there
  function showHistory() {                                          // the client's past workouts on their own page, by week, month and year, each group folding
    const c = clients.get(S.view.id); if (!c || isTemplateClient(c.id)) return;
    settingsOpen = "history"; fromSettings = false; hideAllViews(); $("vHistory").hidden = false; $("back").hidden = false; $("backLabel").textContent = "Back"; $("brand").hidden = true; $("status").textContent = "";
    paintHistory();
  }
  function paintHistory() {
    const c = clients.get(S.view.id); if (!c) return;
    const rest = clientTrainings(c.id).filter((t) => t.completedAt || t.skippedAt).sort((a, b) => effDate(b).localeCompare(effDate(a)));
    const hist = $("histList"); hist.replaceChildren(); $("histEmpty").hidden = rest.length > 0;
    const t0 = today(), mondayIso = weekStart();
    const word = (n) => n + (n === 1 ? " workout" : " workouts");
    const rows = (items) => { const ul = document.createElement("ul"); ul.className = "list"; ul.replaceChildren(...items.map((t) => workoutRow(t, "past"))); return ul; };
    const group = (key, title, items, open, build) => {              // a folding group: title · count ›; opened or closed by hand, it stays so for the session
      const wrap = document.createElement("div");
      const head = document.createElement("button"); head.type = "button"; head.innerHTML = "<span></span><span class=\"sub\"><span></span><svg viewBox=\"0 0 14 14\" aria-hidden=\"true\"><path d=\"M5 3l4 4-4 4\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></svg></span>"; head.firstChild.textContent = title; head.lastChild.firstChild.textContent = word(items.length);
      const k = c.id + "/" + key, isOpen = openGroups.has(k) ? openGroups.get(k) : open;
      const inner = build(items); inner.hidden = !isOpen;
      wrap.className = "month " + (build === rows ? "flat" : "nest") + (isOpen ? " open" : "");   // flat: the rows join the title's card; nest: a year, its months as cards within
      head.setAttribute("aria-expanded", String(isOpen));
      head.addEventListener("click", () => { inner.hidden = !inner.hidden; wrap.classList.toggle("open", !inner.hidden); head.setAttribute("aria-expanded", String(!inner.hidden)); openGroups.set(k, !inner.hidden); });
      wrap.append(head, inner); return wrap;
    };
    const monthsOf = (items, firstOpen) => {                          // the months in a year, newest first
      const m = new Map(); for (const t of items) { const k = effDate(t).slice(0, 7); if (!m.has(k)) m.set(k, []); m.get(k).push(t); }
      const box = document.createElement("div"); let first = true;
      for (const [k, its] of m) { box.appendChild(group(k, new Date(k + "-15T12:00:00").toLocaleDateString(undefined, { month: "long" }), its, first && firstOpen, rows)); first = false; }
      return box;
    };
    const week = rest.filter((t) => effDate(t) >= mondayIso), older = rest.filter((t) => effDate(t) < mondayIso);
    if (week.length) hist.appendChild(group("week", "This week", week, true, rows));
    const byYear = new Map(); for (const t of older) { const y = effDate(t).slice(0, 4); if (!byYear.has(y)) byYear.set(y, []); byYear.get(y).push(t); }
    for (const [y, items] of byYear) {
      if (y === t0.slice(0, 4)) hist.appendChild(monthsOf(items, !week.length));            // this year: its months; the latest open when there is nothing from this week
      else hist.appendChild(group(y, y, items, false, (its) => monthsOf(its, true)));       // an earlier year: folded, its months inside
    }
  }
  function showCatalog() {                                          // what he coaches with and what he sells: the exercises and the packages
    settingsOpen = "catalog"; fromSettings = false; hideAllViews(); $("vCatalog").hidden = false; $("back").hidden = false; $("backLabel").textContent = "Back"; $("brand").hidden = true; $("status").textContent = "";
  }
  function showData() {                                             // the backup and the restore
    settingsOpen = "data"; fromSettings = false; hideAllViews(); $("vData").hidden = false; $("back").hidden = false; $("backLabel").textContent = "Back"; $("brand").hidden = true; $("status").textContent = "";
  }
  const parentLabel = () => (fromSettings === "catalog" ? "Catalog" : fromSettings ? "Settings" : "Back");
  const showParent = () => (fromSettings === "catalog" ? showCatalog : showSettings)();
  function showNumber() {
    settingsOpen = "number"; hideAllViews(); $("vNumber").hidden = false; $("back").hidden = false; $("backLabel").textContent = parentLabel(); $("brand").hidden = true; $("status").textContent = "";
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
    settingsOpen = "packages"; hideAllViews(); $("vPackages").hidden = false; $("back").hidden = false; $("backLabel").textContent = parentLabel(); $("brand").hidden = true; $("status").textContent = "";
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
      del.addEventListener("click", async (e) => { e.stopPropagation(); if (!(await askFirst({ title: "Delete \u201c" + pk.name + "\u201d?", text: "Clients already on it keep their package. It just cannot be picked again." }))) return; const tc = tplClient(); tc.packages = packagesList().filter((x) => x.id !== pk.id); deletedPackages.set(pk.id, tc.id); planTouched.add(tc.id); scheduleSave("clients", tc.id); if (packEdit === pk.id) packFormReset(); renderPackages(); });
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
  $("packagesBtn").addEventListener("click", () => { fromSettings = "catalog"; showPackages(); window.scrollTo(0, 0); });   // from the Settings list: Back returns there
  $("packKind").addEventListener("click", (e) => { const b = e.target.closest("button"); if (!b) return; packKind = b.dataset.kind; renderPackages(); });
  $("packInPerson").addEventListener("click", (e) => { const b = e.target.closest("button"); if (!b) return; packInPerson = b.dataset.on === "1"; renderPackages(); });
  $("packCancel").addEventListener("click", () => { packFormReset(); renderPackages(); });
  $("packAdd").addEventListener("click", () => {
    const size = clamp(parseInt($("packSize").value, 10) || 0, 0, 200);
    if (packKind === "sessions" && !size) { $("packSize").focus(); return; }
    const name = String($("packName").value || "").trim() || (packKind === "monthly" ? "4-week plan" : size + " sessions");
    if (packagesList().some((pk) => pk.id !== packEdit && String(pk.name || "").toLowerCase() === name.toLowerCase())) { $("packName").value = name; $("packName").focus(); $("packName").select(); return; }   // one of each name
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
    backScroll = window.scrollY; showClientCard(); window.scrollTo(0, 0);   // the plan lives on the client's card
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
  function showExercises(keep) {
    settingsOpen = "exercises"; hideAllViews(); $("vExercises").hidden = false; $("back").hidden = false; $("backLabel").textContent = parentLabel(); $("brand").hidden = true; $("status").textContent = "";
    if (!keep) exShown = 80; renderExercises(); $("exPlayer").replaceChildren();   // a video playing on the exercise page stops when the list comes back
    if (keep && exListY != null) window.scrollTo(0, exListY);       // back from an exercise opened from the list: exactly where the list was (as iPhone, and as the swipe's copy shows it)
    else if (keep && exCurrent) { const li = $("exList").querySelector('li[data-key="' + CSS.escape(exCurrent.key) + '"]'); if (li) li.scrollIntoView({ block: "center" }); }   // opened some other way (or the app reopened on it): the list with the exercise in view
    exListY = null;
  }
  const videoForName = (name) => { const s = String(name || "").trim(); if (!s) return null; const l = looseKey(ALIASES[s] || s); if (customVideos.has(looseKey(s))) return customVideos.get(looseKey(s)); if (customVideos.has(l)) return customVideos.get(l); return VIDEOS[s] || VIDEO_LOOSE.get(l) || null; };
  let exShown = 80, exListY = null;                                 // exListY: where the exercise list was scrolled when a row was opened
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
    if (near) { $("exEmpty").innerHTML = ""; const b = document.createElement("button"); b.type = "button"; b.className = "btn tint"; b.textContent = "Did you mean “" + near + "”?"; b.addEventListener("click", () => { $("exSearch").value = near; exShown = 80; renderExercises(); }); $("exEmpty").appendChild(b); }
    else if (canAdd) { $("exEmpty").innerHTML = ""; const b = document.createElement("button"); b.type = "button"; b.className = "btn tint"; b.textContent = "Add “" + tidyName(q) + "” to the database"; b.addEventListener("click", async () => { b.disabled = true; const ok = await addCustomName(q); if (!ok) { b.disabled = false; $("status").textContent = "Couldn’t add · run supabase/exercises.sql, or try again online"; return; } $("exSearch").value = tidyName(q); renderExercises(); }); $("exEmpty").appendChild(b); }
  }
  function exerciseRow(name, key) {
    const li = document.createElement("li"); li.dataset.key = key;
    const b = document.createElement("button"); b.type = "button";
    const mine = customNames.has(key); const vid = videoForName(name);
    const pri = document.createElement("span"); pri.className = "pri"; const parts = splitName(name, subtitleFor(name)); pri.textContent = parts.title;
    if (parts.sub) { const st = document.createElement("span"); st.className = "subt"; st.textContent = parts.sub; pri.appendChild(st); }
    const sec = document.createElement("span"); sec.className = "sec"; sec.innerHTML = (vid ? '<span class="dot">\u25b6 video</span>' : "") + (vid && mine ? " \u00b7 " : "") + (mine ? "yours" : "");
    const left = document.createElement("span"); left.style.minWidth = "0"; left.append(pri); if (sec.innerHTML) left.append(sec);
    const chev = document.createElement("span"); chev.className = "chev"; chev.textContent = "\u203a";
    b.append(left, chev);
    b.addEventListener("click", () => { exListY = window.scrollY; showExercise(name, key); window.scrollTo(0, 0); });   // a row opens its own page, the way a list does on iPhone (Back returns to the list where it was)
    li.append(b); return li;
  }
  const mkBtn = (text, cls, fn) => { const x = document.createElement("button"); x.type = "button"; x.className = cls; x.textContent = text; x.addEventListener("click", fn); return x; };
  // ---- one exercise, on its own page: the video on top, a form (Name, Subtitle, Video), Delete below; Done in the bar saves, Back leaves
  let exCurrent = null;                                                       // { name, key } of the exercise the page shows
  const exDirty = () => { if (!exCurrent || !exPainted) return false; return $("exName").value.trim() !== exPainted.title || $("exSub").value.trim() !== exPainted.sub || $("exVideo").value.trim() !== exPainted.video; };   // changed by him, not by data that arrived after the page was painted
  const paintExHint = () => { const title = $("exName").value.trim(), sub = $("exSub").value.trim(); $("exHint").textContent = sub ? "Clients see \u201c" + title + "\u201d with \u201c" + sub + "\u201d under it." : "Clients see the name on one line."; };   // the two fields are the two lines; nothing to get wrong
  function showExercise(name, key) {
    exCurrent = { name, key }; settingsOpen = "exercise"; hideAllViews(); $("vExercise").hidden = false; $("back").hidden = false; $("backLabel").textContent = "Exercises"; $("brand").hidden = true; $("status").textContent = ""; $("navDone").hidden = false;
    const vid = videoForName(name), chosen = customSubs.has(key) ? customSubs.get(key) : null, parts = splitName(name, chosen);   // the page shows the two lines clients see
    $("exName").value = parts.title; $("exSub").value = parts.sub; $("exVideo").value = vid ? "https://youtu.be/" + vid : "";
    exPainted = { title: parts.title, sub: parts.sub, video: $("exVideo").value.trim() };
    const player = $("exPlayer"); player.replaceChildren(); player.hidden = !vid;
    if (vid) { const f = document.createElement("iframe"); f.src = "https://www.youtube-nocookie.com/embed/" + vid + "?playsinline=1&rel=0&modestbranding=1"; f.allow = "accelerometer; encrypted-media; picture-in-picture"; f.allowFullscreen = true; player.appendChild(f); }
    paintExHint(); rememberPage();
  }
  for (const id of ["exName", "exSub"]) $(id).addEventListener("input", paintExHint);
  for (const id of ["exName", "exSub", "exVideo"]) $(id).addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); $(id).blur(); } });
  async function saveExercise() {                                             // Done: everything on the page that changed is written, then back to the list
    if (!exCurrent) return; const { name, key } = exCurrent;
    const title = tidyName(properName($("exName").value)), link = $("exVideo").value.trim(), wantSub = $("exSub").value.trim();   // an old spelling means the exercise it names
    if (!title || !squash(title)) { $("status").textContent = "Give it a name"; return; }
    const nn = exDirty() ? composeName(title, wantSub, name) : name;                                 // the name is the two lines together; untouched, it stays as it was written
    if (link && !youtubeId(link)) { $("status").textContent = "That doesn\u2019t look like a YouTube link"; return; }
    if (nn !== name && squash(nn) !== key && knownName(nn)) { $("status").textContent = "There is already an exercise called \u201c" + nn + "\u201d"; return; }
    if (!exDirty()) { navWillChange("back"); showExercises(true); return; }
    $("navDone").disabled = true;
    let cur = name;
    if (nn !== name) { const ok = await renameExercise(key, name, nn); if (!ok) { $("navDone").disabled = false; $("status").textContent = missingTable() ? "Run the Supabase script first (it is on your clipboard)" : "Couldn\u2019t rename \u00b7 try again online"; return; } cur = nn; }
    const vkey = looseKey(cur), had = videoForName(cur), id = link ? youtubeId(link) : null;
    let videoError = null;
    if (!link && had) videoError = await saveVideo(vkey, "", "");                                   // an empty link stored = no video, the built-in one included
    else if (id && id !== had) videoError = await saveVideo(vkey, link, id);
    const nk2 = squash(cur); let subError = null;                                                   // the subtitle: his choice stored only when it differs from the automatic split
    if (wantSub === autoSubtitle(cur)) { const gone = [nk2, key].filter((k, i, arr) => customSubs.has(k) && arr.indexOf(k) === i); if (gone.length) subError = await deleteSub(gone); }
    else subError = await saveSub(nk2, wantSub, key);
    $("navDone").disabled = false;
    const problem = subError && /ft_exercise_subtitles/.test(subError.message || "") ? "Run the Supabase script first (it is on your clipboard)" : subError ? "Couldn\u2019t save the subtitle" : videoError && /ft_exercise_videos/.test(videoError.message || "") ? "Run the Supabase script first (it is on your clipboard)" : videoError ? "Couldn\u2019t save the video" : "";
    if (problem) { exCurrent = { name: cur, key: nk2 }; $("status").textContent = problem; return; }   // the rename stood: the page now shows the new name, the complaint stays in the bar
    exCurrent = { name: cur, key: nk2 }; navWillChange("back"); showExercises(true); setStatus();
  }
  $("navDone").addEventListener("click", () => { if (settingsOpen === "exercise") saveExercise(); else if (tplOrderOn()) doneTplOrder(); });   // (and Done after Reorder folders)
  $("exDelete").addEventListener("click", async () => {
    if (!exCurrent) return; const { name, key } = exCurrent;
    if (!(await askFirst({ title: "Delete \u201c" + name + "\u201d from the database?", text: (videoForName(name) ? "Its video goes with it. " : "") + "Workouts that use it keep the name.", yes: "Delete" }))) return;
    const ok = await deleteExercise(key, name); if (!ok) { $("status").textContent = missingTable() ? "Run the Supabase script first (it is on your clipboard)" : "Couldn\u2019t delete \u00b7 try again online"; return; }
    setStatus(); navWillChange("back"); showExercises(); window.scrollTo(0, 0);
  });
  $("exSearch").addEventListener("input", () => { exShown = 80; renderExercises(); });
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
    clearTimeout(pwTimer); settingsOpen = "password"; hideAllViews(); $("vPassword").hidden = false; $("back").hidden = false; $("backLabel").textContent = parentLabel(); $("brand").hidden = true;
    $("pwMsg").textContent = ""; $("pwNew").value = ""; $("pwNew2").value = ""; $("pwBtn").disabled = false; $("pwUser").value = S.sessionEmail; $("status").textContent = "";
  }
  function showRecovery() {
    hideAllViews(); $("vRecovery").hidden = false; $("recoveryBtn").disabled = false;
    if (S.sb) S.sb.auth.getUser().then(({ data }) => { $("recoveryUser").value = (data && data.user && data.user.email) || ""; }).catch(() => {}); $("back").hidden = true; $("brand").hidden = false; $("status").textContent = "";
  }
  function showProblem(text) {
    dropWake();
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
    let quiet = onScreenAs(session.user.email) && $("vRecovery").hidden && $("vLogin").hidden && $("vWaiting").hidden;                   // the device copy is already on screen for this account: live data swaps in without a blank "Loading…"
    settingsOpen = quiet ? settingsOpen : false;
    S.signedIn = true; S.sessionEmail = session.user.email || "";
    let trainer = await isTrainerAccount();
    const remembered = lsGet("fiala.trainings.role");
    if (trainer === null) {
      if (remembered && remembered.email === S.sessionEmail) trainer = remembered.role === "trainer";
      else { S.offline = true; S.offlineEntry = "remembered"; showProblem("Couldn\u2019t reach the server \u00b7 check your signal and tap Try again"); return; }   // resumeOnline retries the entry
    } else lsSet("fiala.trainings.role", { email: S.sessionEmail, role: trainer ? "trainer" : "client" });
    S.offlineEntry = null;
    if (quiet && S.clientMode !== (trainer !== true)) { quiet = false; settingsOpen = false; }   // painted as the other role: start the pages over
    if (S.pendingOwner && S.pendingOwner !== S.sessionEmail) {       // the queue belongs to whoever signed in last; another account starts clean
      resetPhotos();                                                 // the photos queued and kept by the last account go too
      dirty.clear(); pendingWeightRows.clear(); pendingDoneRows.clear(); pendingEarlyRows.clear(); pendingFinish.clear(); pendingSkip.clear(); pendingMove.clear(); pendingMiss.clear(); pendingSwap.clear(); pendingOrder.clear(); trainerTouched.clear(); trainerNamed.clear(); trainerNoted.clear(); planTouched.clear(); deletedNotes.clear(); deletedPackages.clear(); folderTouched.clear(); deletedFolders.clear(); fromFile.clear();
    }
    S.pendingOwner = S.sessionEmail; persistPending();
    S.clientMode = trainer !== true;
    applyLook();
    S.backend = S.clientMode ? clientBackend : cloudBackend;
    if (!quiet) hideAllViews();
    if (S.clientMode) {
      for (const id of [...clients.keys()]) if (isTemplateClient(id) || norm(clients.get(id).email) !== norm(S.sessionEmail)) clients.delete(id);   // the device copy may belong to someone else
      const mineIds = new Set(clients.keys()); for (const id of [...trainings.keys()]) if (!mineIds.has(trainings.get(id).clientId)) trainings.delete(id);
      if (!quiet) $("status").textContent = "Loading\u2026";
      await syncDown();                                       // a success flushes the queue itself
      setStatus();
      return;
    }
    $("dataNote").textContent = "Synced to the cloud";
    $("myExercises").hidden = false; $("packagesBtn").hidden = false; $("settingsBtn").hidden = false; $("catalogBtn").hidden = false; $("dataBtn").hidden = false; $("localFoot").hidden = false;
    if (!quiet) render(); setStatus();
    const synced = await syncDown();                          // a success flushes the queue itself
    if (synced && !S.offline) seedTemplates().catch(() => {});   // the built-in templates only once the server's copy is in: a failed first sync must never push fresh copies over edited ones
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
    pwTimer = setTimeout(() => { if (settingsOpen === "password") { navWillChange("back"); if (fromSettings) showParent(); else { settingsOpen = false; hideAllViews(); render(); } } }, 1200);
  });
  $("settingsBtn").addEventListener("click", () => { backScroll = window.scrollY; showSettings(); window.scrollTo(0, 0); });   // the pills sit at the bottom of a long list: each page opens at its top, and Back lands where the list was
  $("catalogBtn").addEventListener("click", () => { backScroll = window.scrollY; showCatalog(); window.scrollTo(0, 0); });
  $("dataBtn").addEventListener("click", () => { backScroll = window.scrollY; showData(); window.scrollTo(0, 0); });
  $("changePw").addEventListener("click", () => { fromSettings = "settings"; showPassword(); window.scrollTo(0, 0); });
  $("myExercises").addEventListener("click", () => { fromSettings = "catalog"; showExercises(); window.scrollTo(0, 0); });
  $("setNumber").addEventListener("click", () => { fromSettings = "settings"; showNumber(); window.scrollTo(0, 0); });
  $("myPhone").addEventListener("change", () => { setTrainerPhone($("myPhone").value); $("myPhoneMsg").textContent = phoneDigits($("myPhone").value) ? "Saved. Clients now see Message Michal." : "Saved. Without a number clients see no button."; });
  const openHistoryPage = () => { backScroll = window.scrollY; showHistory(); window.scrollTo(0, 0); };
  $("histBtn").addEventListener("click", openHistoryPage);
  $("meDisc").addEventListener("click", () => { backScroll = window.scrollY; if (S.clientMode) showSettings(); else showClientCard(); window.scrollTo(0, 0); });   // the client's person disc in the bar: Settings, where Apple keeps the person
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
      timers.clear(); chains.clear(); dirty.clear(); pendingWeightRows.clear(); pendingDoneRows.clear(); pendingEarlyRows.clear(); pendingFinish.clear(); pendingSkip.clear(); pendingMove.clear(); pendingMiss.clear(); pendingSwap.clear(); pendingOrder.clear(); S.failed = false;
      clients.clear(); trainings.clear(); localBackend.save();
      try { localStorage.removeItem("fiala.trainings.role"); localStorage.removeItem("fiala.pending.v1"); } catch {}
      S.offline = false; S.offlineEntry = null; S.pendingOwner = "";
      resetPhotos();                                                 // no one else's photos stay on this phone
      S.view = { name: "clients" }; showLogin("");
    };
    const who = S.sessionEmail;
    if (!S.signingOut) S.signingOut = (S.sb ? S.sb.auth.signOut() : Promise.resolve({ error: null })).catch((e) => ({ error: e })).finally(() => { S.signingOut = null; });
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
      timers.clear(); chains.clear(); dirty.clear(); trainerTouched.clear(); trainerNamed.clear(); trainerNoted.clear(); planTouched.clear(); deletedNotes.clear(); deletedPackages.clear(); folderTouched.clear(); deletedFolders.clear(); fromFile.clear(); S.failed = false;
      clients.clear(); trainings.clear(); localBackend.save();
      try { localStorage.removeItem("fiala.trainings.migrated"); localStorage.removeItem("fiala.trainings.role"); localStorage.removeItem("fiala.pending.v1"); } catch {}
      S.templateDraft = null; S.pendingGo = null; lsSet("fiala.trainings.draft", null); paintDraftBar();
      S.offline = false; S.offlineEntry = null; S.pendingOwner = "";
      resetPhotos();                                                 // no one else's photos stay on this phone
      S.view = { name: "clients" }; showLogin("");
    };
    const who = S.sessionEmail;
    if (!S.signingOut) S.signingOut = (S.sb ? S.sb.auth.signOut() : Promise.resolve({ error: null })).catch((e) => ({ error: e })).finally(() => { S.signingOut = null; });
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
  function newRow(label) { return { id: uid(), label, name: "", sets: 4, reps: "", tempo: "", rest: "", weights: [], repsDone: [], setsDone: 0, note: "" }; }
  function nextLabel(t) { let max = 0; for (const r of t.rows) { const n = labelKey(r.label)[0]; if (Number.isFinite(n)) max = Math.max(max, n); } return String(max + 1); }
  function addTraining(clientId, from, date, stay) {
    const t = {
      id: uid(), clientId, date: date || today(), createdAt: now(),
      title: from ? from.title : "", completedAt: null, skippedAt: null,
      rows: from ? from.rows.map((r) => freshRow(r)) : [],
    };
    if (from && from.fromTemplate) t.fromTemplate = from.fromTemplate;
    if (from && from.inPerson) t.inPerson = true;
    const pk = packageOf(clients.get(clientId)); if (pk && pk.inPerson && !isTemplateClient(clientId)) t.inPerson = true;   // the package's default
    trainings.set(t.id, t); scheduleSave("trainings", t.id, 0);
    if (!stay) { freshWorkout = t.id; go({ name: "training", id: t.id }); }                   // stay: one of a week added at once (useWeek), the page stays where it is
  }
  function newWorkoutHere() { if (S.view.name === "client" && isTemplateClient(S.view.id)) { newTemplateHere(); return; } setTab("workouts"); addTraining(S.view.id, null, today()); }   // the round + beside the bar, on any tab: a new workout for this client, today — and Back lands on Workouts, where it shows
  function deleteTraining(id) {
    const t = trainings.get(id); if (!t) return;
    if (S.templateDraft && S.templateDraft.id === id) { S.templateDraft = null; S.pendingGo = null; lsSet("fiala.trainings.draft", null); paintDraftBar(); }
    const toHistory = fromHistory(t);
    trainings.delete(id); scheduleSave("trainings", id, 0);
    if (toHistory) backToHistory(t); else go(isTemplateClient(t.clientId) ? templateHome(t) : { name: "client", id: t.clientId }, true);   // up to where Back goes (the client, or History it was opened from; a template: its folder, slide or phase page): its step goes
  }
  function deleteClient(id) {
    if (!clients.has(id)) return;                                      // a second tap on Delete finds nobody
    forgetPhoto(id);                                                   // her photo goes from the phone and the server too
    for (const t of clientTrainings(id)) { trainings.delete(t.id); scheduleSave("trainings", t.id, 0); }
    clients.delete(id); scheduleSave("clients", id, 0);
    leaveSettings(); go({ name: "clients" });                         // off her card first: the card would otherwise stay up with her details
  }
  // Weights from the most recent earlier training of this client with the same exercise.
  function lastWeights(t, row) {
    const canon = (x) => squash(ALIASES[String(x || "").trim()] || x); // "Push-ups" logged last month still counts for "Push-up"
    const name = canon(row.name); if (!name) return null;
    for (const other of clientTrainings(t.clientId)) {
      if (other.id === t.id) continue;
      if (effDate(other) > effDate(t)) continue;
      if (effDate(other) === effDate(t) && (other.createdAt || "") >= (t.createdAt || "")) continue;
      const r = other.rows.find((x) => canon(x.name) === name && ((x.weights || []).some((w, i) => setCounts(x, i) && String(w || "").trim() !== "") || (x.repsDone || []).some((v, i) => setCounts(x, i) && String(v || "").trim() !== "")));   // a session where a set of it really happened (a plank has no weight: its time counts)
      if (r) {
        const cu = (clients.get(t.clientId) || {}).unit || "lb"; const only = (arr) => (arr || []).map((v, i) => (setCounts(r, i) ? v : ""));
        const was = measurePlan(r.reps), is = measurePlan(row.reps);                       // the plan's measure then and now: seconds suggested into a minutes box, or into a meters box, would be logged as they stand
        const reps = (was ? was.unit : "") === (is ? is.unit : "") ? only(r.repsDone) : (!was || !is || was.unit === "m" || is.unit === "m") ? [] : only(r.repsDone).map((v) => { const n = parseFloat(String(v || "").replace(",", ".")); if (!Number.isFinite(n)) return ""; const c = was.unit === "min" ? n * 60 : n / 60; return Number.isInteger(c) ? String(c) : ""; });
        return { date: effDate(other) || other.date, weights: only(r.weights).map((v) => (r.unit && r.unit !== cu ? String(convertWeight(v, r.unit, cu)) : v)), reps };
      }   // read in the client's unit today   // a weight typed into a set that never happened does not carry forward
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
  const fitText = () => {                                            // the phone's Text Size setting (Settings > Accessibility > Display & Text Size), the way a native app follows it: the hidden probe in the system font tells the factor, the root size carries it to every rem
    try { const probe = $("typeProbe"); if (!probe) return; const px = parseFloat(getComputedStyle(probe).fontSize) || 17; const f = Math.min(1.5, Math.max(1, px / 17)); const want = f > 1.001 ? (16 * f).toFixed(2) + "px" : ""; if (document.documentElement.style.fontSize !== want) { document.documentElement.style.fontSize = want; setTimeout(() => regrowNames(), 0); } } catch (_) {}   // the name boxes re-measure once the module is whole
  };
  fitText(); window.addEventListener("resize", fitText);
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") { holdWake(false); fitText(); } });
  document.addEventListener("pointerdown", () => { if (S.view.name === "training") holdWake(true); }, { passive: true });
  function go(next, back) {
    if (S.templateDraft && S.templateDraft.dirty && S.view.name === "training" && S.view.id === S.templateDraft.id) {
      S.pendingGo = { next, back }; const b = $("draftBar"); b.classList.remove("nudge"); void b.offsetWidth; b.classList.add("nudge"); return;
    }
    const filling = next.name === "training" && !!fillFor && next.id === fillFor;   // back from choosing a template for it: still being made (the v284 review)
    if (!(next.name === "client" && isTemplateClient(next.id))) { pickFor = null; fillFor = null; }
    if (next.name === "training" && !S.clientMode && !(S.view.name === "training" && S.view.id === next.id)) { const t = trainings.get(next.id), fresh = next.id === freshWorkout || filling; freshWorkout = null; previewClient = !fresh && !!t && !isTemplateClient(t.clientId) && openAs() === "client"; rememberPreview(); }   // a workout opened: in the view set in Settings, a brand-new one always as the coach (his ask, 12 Nov); the same workout drawn again keeps the one he switched to
    if (viewKey(next) !== viewKey(S.view)) calFold();               // a client's page being left: its month folds back into the week before the page's picture and place are taken
    navWillChange(back ? "back" : "");                               // the screen as it was: Safari's (and the edge swipe's) page to come back to
    if (S.view.name === "client" && isTemplateClient(S.view.id) && S.view.folder) lastSlide.set(S.view.folder, shownSlide(S.view));   // a folder of his left for a folder inside it (or anything): Back finds the slide it was on
    scrollMemo.set(viewKey(S.view), window.scrollY);                                              // the page being left: Back brings it back here
    if (S.view.name === "training" && !(next.name === "training" && next.id === S.view.id)) for (const k of [...cardNoteDraft.keys()]) if (k.startsWith(S.view.id + "/")) cardNoteDraft.delete(k);   // a card note left half-written goes with the page
    if (!S.clientMode && (!S.sb || S.syncedOnce) && S.view.name === "training" && !(next.name === "training" && next.id === S.view.id) && fillFor !== S.view.id) {   // leaving an empty workout behind discards it, like an empty note (not while it waits for a template, not before the first sync)
      const t = trainings.get(S.view.id), fresh = !!t && t.id === tplFresh && !(t.rows || []).length && !String(t.title || "").trim(); if (fresh) tplFresh = null;
      if (isEmptyWorkout(t) || fresh) { if (S.templateDraft && S.templateDraft.id === t.id) { S.templateDraft = null; S.pendingGo = null; lsSet("fiala.trainings.draft", null); paintDraftBar(); } trainings.delete(t.id); scheduleSave("trainings", t.id, 0); }   // (and a template the round + made, left with no name and no exercise: back out of it, or Discard it, and it goes)
    }
    notesFresh = null;
    if (newsShown && !(next.name === "client" && next.id === newsShown)) { const c = clients.get(newsShown); newsShown = null; if (c) markWorkoutsSeen(c); }   // leaving the client: the New list he saw counts as looked at
    for (const f of document.querySelectorAll("#rows .player iframe, #exPlayer iframe")) f.remove();   // a video left playing does not follow to the next page
    reordering = false; tplOrdering = null; S.view = next; lsSet("fiala.trainings.view", S.view); render(); setStatus(); window.scrollTo(0, back ? (scrollMemo.get(viewKey(next)) || 0) : 0);   // forward: the top; back: where that page was (the header shows this page's save state, not the last page's complaint)
    if (next.name === "training") holdWake(true); else dropWake(); }
  async function runBack() {                                       // where Back goes, from every page: the Back circle, Safari's swipe and the edge swipe all come here
    if (settingsOpen === "exercise") { if (exDirty() && !(await askFirst({ title: "Discard the changes?", text: "The exercise stays as it was.", yes: "Discard" }))) return; showExercises(true); return; }
    if (settingsOpen) {
      if (fromSettings) { showParent(); window.scrollTo(0, 0); return; }
      settingsOpen = false; fromSettings = false; $("exPlayer").replaceChildren(); hideAllViews(); render();
      if (backScroll != null) window.scrollTo(0, backScroll); else { const foot = $("localFoot"); if (!S.clientMode && !foot.hidden) foot.scrollIntoView({ block: "end" }); else window.scrollTo(0, 0); }   // back where the page was; after a refresh, at the pills it was opened from
      backScroll = null; return;
    }
    if (S.view.name === "training") { const t = trainings.get(S.view.id); if (fromHistory(t)) { backToHistory(t); return; } go(t ? (isTemplateClient(t.clientId) ? templateHome(t) : { name: "client", id: t.clientId }) : { name: "clients" }, true); }
    else if (S.view.name === "client" && isTemplateClient(S.view.id) && S.view.folder) { const f = tplNode(S.view.folder); go(tplUp(f && f.parent), true); }   // a folder of his: up to its folder (on the slide it was left on), or the Templates page
    else if (S.view.name === "client" && isTemplateClient(S.view.id) && !S.view.program && pickFor) go(fillFor ? { name: "training", id: fillFor } : { name: "client", id: pickFor }, true);   // choosing a template for someone: Back is back to them
    else if (S.view.name === "client" && isTemplateClient(S.view.id) && S.view.phase) go({ name: "client", id: TEMPLATES_ID, program: S.view.program }, true);
    else if (S.view.name === "client" && isTemplateClient(S.view.id) && S.view.program) go({ name: "client", id: TEMPLATES_ID }, true);
    else go({ name: "clients" }, true);
  }

  // ---------- going back: the Back circle, Safari's own swipe, and the app's own swipe in the home-screen app all do the same thing ----------
  // In a Safari tab (and an Android install, for its back button) each screen the app moves forward to is a step in the browser's history,
  // recorded the moment before the screen changes, so Safari's swipe from the left edge previews the page it goes back to and lands on it; its
  // popstate runs runBack(), exactly as the Back circle does. A Back that is refused (an unsaved template, changes to discard and Cancel) keeps its
  // step. With no Back on the screen there are no steps behind it. Steps the app takes out itself go one at a time, each known by where it lands,
  // so the count never drifts (a drift would let a later Back leave the app).
  // The iOS home-screen app keeps NO steps: there iOS has its own back and forward swipes from the screen's edges, live whenever there is a step behind or
  // ahead, which no page code can stop (WebKit ViewGestureController; research 7 Nov). With steps, every Back left one ahead (a forward swipe that slid a
  // page in and back) and iOS's back swipe raced the app's own. With none, a forward swipe does nothing and only the app's swipe goes back (below).
  // Versions before v237 kept steps there too, and the update reloads an open app in place, which keeps them: the app then goes straight back to the
  // first of them (nothing behind it for iOS's back swipe), and a forward swipe onto an old one is sent back there. Only closing the app clears the
  // ones ahead (no page code can).
  const iosHome = (() => { try { return typeof navigator !== "undefined" && navigator.standalone === true; } catch (_) { return false; } })();
  const hasState = () => !iosHome && typeof history !== "undefined" && history && typeof history.pushState === "function";
  const nav = { depth: 0, backing: false, sig: "", pending: null, travel: null, waits: [], curKey: "" };   // curKey: the screen as last shown (a page's own settings flag changes before it hides the old one)   // waits: steps out of the history still under way, by the depth they land on
  // Back puts the page where it was itself, so the browser must not move it afterwards; but a reload (the app's own after a release
  // included) still gets the browser's put-back, so that is switched on only once the page has loaded, and back on as the page goes
  const scrollMode = (m) => { try { if (hasState() && "scrollRestoration" in history) history.scrollRestoration = m; } catch (_) {} };
  const armScroll = () => setTimeout(() => scrollMode("manual"));
  if (typeof document !== "undefined" && document.readyState === "complete") armScroll(); else if (typeof window !== "undefined" && window.addEventListener) window.addEventListener("load", armScroll, { once: true });
  if (typeof window !== "undefined" && window.addEventListener) {
    window.addEventListener("pagehide", () => scrollMode("auto"));
    window.addEventListener("pageshow", (e) => { if (e && e.persisted) scrollMode("manual"); });
  }
  let popClose = null, popAnchor = null, popRows = "";              // the frosted bubble or menu that is open, if one is: its own close, the button it hangs from, and the rows it opened with (a menu)
  const menuRows = (items) => items.map((it) => (it.danger ? "!" : "") + it.label).join("|");
  let liftClick = null, liftLate = 0;                               // a touch and hold's menu: what the dimmed page's click does, and the close that comes if that click never does
  let rs = null, rsT = null, wg = null, rsEat = 0, lpHoldAt = 0;    // a workout row swiped to its actions (below the swipe back): the row out or open, the finger or mouse on one, the trackpad's swipe under way, a tap's click to drop; when a touch and hold's menu came under a finger not yet let go (see lpOpen)
  const closeMoreMenu = () => { if (popClose && popAnchor === $("tMore") && ($("tMore").hidden || menuRows(pageMoreItems()) !== popRows)) popClose(); if (popClose && popAnchor === $("tAdd") && ($("tAdd").hidden || menuRows(tplAddItems()) !== popRows)) popClose(); };   // a redraw that takes the workout's "…" away (a sync brought a client's finish, skip or delete), or changes what it offers (the coach's: a finish or skip takes Reschedule out), takes its menu with it
  const stateDepth = () => { try { const st = hasState() && history.state; return st && typeof st.fiala === "number" ? st.fiala : 0; } catch (_) { return 0; } };
  nav.depth = stateDepth();
  try { if (hasState() && !(history.state && typeof history.state.fiala === "number")) history.replaceState({ fiala: nav.depth }, ""); } catch (_) {}   // the page's own first step carries its number, so going back to it is never mistaken for anything else
  const homeFirst = (st) => { const d = st && typeof st.fiala === "number" ? st.fiala : 0; if (d > 0 && typeof history.go === "function") { try { history.go(-d); } catch (_) {} } };   // the home-screen app on an older version's step: straight back to the first one (above)
  if (iosHome) { try { homeFirst(history.state); } catch (_) {} }
  const canBack = () => !$("back").hidden;
  const held = () => { const wb = $("whenBg"); return S.asking || !!(wb && !wb.hidden) || !!document.querySelector(".crop-view") || !!document.querySelector(".sheet-bg:not([hidden])"); };   // a question, a menu or bubble, a date picker or the photo framing is up: Back waits for it (the Back circle's tap only closes a menu, too)
  const screenKey = () => viewKey(S.view) + "|" + (settingsOpen || "") + "|" + (settingsOpen === "exercise" && exCurrent ? exCurrent.key : "");
  const navSig = () => [...document.querySelectorAll("main > section")].filter((s) => !s.hidden).map((s) => s.id).join(",") + "|" + screenKey();
  const histPush = () => {                                          // one step to come back to; after a step back still under way, never before it (the browser would put it in the wrong place)
    if (!hasState()) return; const d = ++nav.depth, put = () => { try { history.pushState({ fiala: d }, ""); } catch (_) {} };
    if (nav.travel) nav.travel.then(put); else put();
  };
  const histQuiet = (n) => {                                        // n steps out of the browser's history without the app moving; one at a time, done when the browser is there
    if (!hasState() || typeof history.go !== "function" || n <= 0) return nav.travel || Promise.resolve();
    const step = () => new Promise((res) => {
      const w = { target: Math.max(0, stateDepth() - n), res }; nav.waits.push(w);
      let tries = 0;
      const look = () => {                                          // the popstate normally answers; this only covers a browser that says nothing
        if (!nav.waits.includes(w)) return;
        if (stateDepth() === w.target) { nav.waits.splice(nav.waits.indexOf(w), 1); res(); return; }
        if (++tries > 12) { res(); setTimeout(() => { const i = nav.waits.indexOf(w); if (i >= 0) nav.waits.splice(i, 1); }, 10000); return; }   // gave up waiting, but a late arrival is still not taken for a swipe
        setTimeout(look, 250);
      };
      setTimeout(look, 250);
      try { history.go(-n); } catch (_) { const i = nav.waits.indexOf(w); if (i >= 0) nav.waits.splice(i, 1); res(); }
    });
    const tr = nav.travel = (nav.travel || Promise.resolve()).then(step);
    tr.then(() => { if (nav.travel === tr) nav.travel = null; });
    return tr;
  };
  // the picture under the edge swipe: the last look of each screen, found by where Back is going
  const shotByKey = new Map();
  let seenTouch = false;                                            // pictures are only taken once the person has touched the app: every change before that is the app opening (it draws an empty Clients page as the script loads, and reopens a settings page over it), never a page they saw
  if (typeof document !== "undefined" && document.addEventListener) for (const t of ["pointerdown", "touchstart", "keydown"]) document.addEventListener(t, () => { seenTouch = true; }, { capture: true, passive: true });
  function navWillChange(kind) {                                    // a screen is about to change: what it was, and (for the edge swipe) a picture of it; kind: "back" or "land" (no new step)
    rsForget();                                                     // a row out or closing goes back first: the picture shows it as the page will be
    if (nav.pending) { if (kind) nav.pending.kind = nav.pending.kind || kind; return; }
    if ((swipeOn || deskOn) && seenTouch && !nav.backing && kind !== "back") { const k = nav.curKey || screenKey(), shot = captureScreen(); if (shot) { shotByKey.delete(k); shotByKey.set(k, shot); if (shotByKey.size > 14) shotByKey.delete(shotByKey.keys().next().value); } }   // the first call of a change: the screen is still the old one
    nav.pending = { sig: navSig(), kind: kind || "" };
    queueMicrotask(navDidChange);                                   // before the new screen is painted: Safari keeps the old one as the page to go back to
  }
  function navDidChange() {
    const p = nav.pending; nav.pending = null; if (!p) return;
    const now = navSig();
    if (now !== p.sig && !nav.backing && p.kind !== "land") {
      if (p.kind === "back") { if (nav.depth > 0) { nav.depth--; histQuiet(1); } }   // a step back taken some other way (Done on an exercise, a held template draft released): its step goes too
      else if (canBack()) histPush();                               // forward: one step to come back to
    }
    nav.sig = now; nav.curKey = screenKey(); navTrim();
  }
  function navTrim() {                                              // no Back on this screen: no steps behind it; a Back with no step (opened straight on a deep page): one
    if (!canBack() && nav.depth > 0) { const n = nav.depth; nav.depth = 0; histQuiet(n); }
    else if (canBack() && nav.depth === 0) histPush();
  }
  function navLandAt(d) {                                           // the next move replaces the steps above d (a template filled in: back on the workout's own step, not one more)
    if (nav.depth > d) { const n = nav.depth - d; nav.depth = d; histQuiet(n); }
    navWillChange("land");
  }
  async function backOnce() {                                       // one Back, from whatever asked for it
    const before = navSig(); nav.backing = true;
    try { await runBack(); } finally { nav.backing = false; }
    const after = navSig(); nav.sig = after; nav.curKey = screenKey();
    if (after === before && canBack()) histPush();                 // refused: the step stays
    navTrim();
  }
  let backChain = Promise.resolve();
  // the screen moves at once; the browser's step comes out behind it (while the app is still starting the browser can hold a step for
  // a second or more, and the Back circle must never wait for that). A step it has to put back waits its turn (histPush follows nav.travel)
  const goBackStep = async () => { if (nav.depth > 0) { nav.depth--; histQuiet(1); } await backOnce(); };
  const goBackNow = () => (backChain = backChain.then(goBackStep, goBackStep));   // two quick taps: two Backs, one after the other
  $("back").addEventListener("click", () => { goBackNow(); });
  window.addEventListener("popstate", (e) => {                      // Safari's swipe (or Android's back): one step back, as the Back circle
    if (iosHome) { homeFirst(e.state); return; }                    // the home-screen app keeps no steps (above): nothing here is the app's to follow; a forward swipe onto an older version's step goes back to the first
    const st = e.state;
    if (!(st && typeof st.fiala === "number")) { try { history.replaceState({ fiala: ++nav.depth }, ""); } catch (_) {} navTrim(); return; }   // a step with no number (a link to "#"): a new step forward, given its number
    const d = st.fiala;
    const wi = nav.waits.findIndex((w) => w.target === d);
    if (wi >= 0) { nav.waits.splice(0, wi + 1).forEach((w) => w.res()); return; }   // a step the app took out itself
    if (d > nav.depth) { histQuiet(d - nav.depth); return; }       // a swipe forward: there is no forward in the app
    if (held()) { if (popClose) popClose(); const keep = nav.depth; nav.depth = d; while (nav.depth < keep) histPush(); return; }   // the step goes back where it was
    const steps = nav.depth - d; nav.depth = d;
    for (let i = 0; i < steps; i++) backChain = backChain.then(backOnce, backOnce);
  });
  if (typeof MutationObserver !== "undefined") new MutationObserver(() => queueMicrotask(navTrim)).observe($("back"), { attributes: true, attributeFilter: ["hidden"] });
  function backKey() {                                              // the screen runBack() would go to, without going (keep in step with runBack)
    const k = (v, s) => viewKey(v) + "|" + (s || "") + "|";
    if (settingsOpen === "exercise") return k(S.view, "exercises");
    if (settingsOpen) return fromSettings ? k(S.view, fromSettings === "catalog" ? "catalog" : "settings") : k(S.view, "");
    if (S.view.name === "training") { const t = trainings.get(S.view.id); if (fromHistory(t)) return k({ name: "client", id: t.clientId }, "history"); return k(t ? (isTemplateClient(t.clientId) ? templateHome(t) : { name: "client", id: t.clientId }) : { name: "clients" }, ""); }
    if (S.view.name === "client" && isTemplateClient(S.view.id) && S.view.folder) { const f = tplNode(S.view.folder); return k(tplUp(f && f.parent), ""); }
    if (S.view.name === "client" && isTemplateClient(S.view.id) && !S.view.program && pickFor) return k(fillFor ? { name: "training", id: fillFor } : { name: "client", id: pickFor }, "");
    if (S.view.name === "client" && isTemplateClient(S.view.id) && S.view.phase) return k({ name: "client", id: TEMPLATES_ID, program: S.view.program }, "");
    if (S.view.name === "client" && isTemplateClient(S.view.id) && S.view.program) return k({ name: "client", id: TEMPLATES_ID }, "");
    return k({ name: "clients" }, "");
  }

  // ---------- the swipe back in the home-screen app, built to Apple's (iOS 26 UIKit, as measured and reverse-engineered; research 7 Nov) ----------
  // From the left edge, or from anywhere on the page when the finger clearly goes right (iOS 26), the page follows the finger 1:1; the page
  // Back goes to waits underneath, 30% to the left, under a 10% shade that lifts as it comes. On release UIKit's rule decides: where the page would be
  // 0.35 s ahead at the finger's speed must pass the smaller of 187.5 points and half the screen. Either way the pages settle on UIKit's spring
  // (damping 0.85, response 0.3 s) from the finger's own speed. The bar's buttons stay put while the finger moves and change only once it lets go:
  // one the page underneath does not have grows a little, blurs and fades (response 0.416 s, bounce 0.25); the logo of the page underneath comes in with it.
  // Nothing is held until the finger has gone 8 points to the right (inside the direction rule): on iPhone a held touchmove also cancels the
  // tap (WebKit's touch recognizer begins and fails the tap's; review 7 Nov), so a tap that rolls a little must stay the page's. WebKit still
  // lets that later hold stop the scroll: touch events stay preventable until scrollViewWillStartPanOrPinchGesture, and UIScrollView on a page
  // that only scrolls up and down starts after 10 points up or down (UIKitCore's _defaultHysteresis), which the rule keeps the finger under.
  // The move that holds does nothing else, so its answer reaches WebKit at once; should the page scroll anyway, the swipe settles back.
  let swipeOn = (() => { try { return (typeof matchMedia === "function" && matchMedia("(display-mode: standalone)").matches) || (typeof navigator !== "undefined" && navigator.standalone === true); } catch (_) { return false; } })();
  const deskOn = (() => { try { return typeof matchMedia === "function" && matchMedia("(hover: hover) and (pointer: fine)").matches; } catch (_) { return false; } })();   // a computer (mouse or trackpad): two fingers swipe the page back there too, in a browser tab as in the Dock's web app (the web app's own swipe has no page behind it, and Chrome's is off under overscroll-behavior-x: none)
  const SWIPE_EDGE = 24, SWIPE_GO = 8, NO_SWIPE = "#calView, #week, #weekView, #dpGrid, .tr-chips, .kb-chips, .grip, .alt-menu, .sugg, input, textarea, select, [contenteditable], li.swipe-row.swiped";   // things that drag sideways or scroll themselves keep the touch (Apple's rule for its swipe from anywhere)
  const GLASS_RES = 0.416, GLASS_DAMP = 0.75, GLASS = ["back", "meDisc", "navDone", "tMore", "tAdd", "barMsg"];   // the bar's buttons, and their change on release
  const easeMemo = new Map();
  const springEase = (v0, response, damping) => {                   // a spring (from rest at 0 to 1, starting at speed v0 in "whole distances per second") as a CSS easing and its length,
    const key = v0.toFixed(2) + "|" + response + "|" + damping; if (easeMemo.has(key)) return easeMemo.get(key);   // ending where it first arrives: past that it only overshoots (0.6% at rest, 1.2% at the fastest start allowed, 2.8% for the buttons) and comes back, which a page underneath shows as a bounce past its place
    const w0 = 2 * Math.PI / response, wd = w0 * Math.sqrt(Math.max(1e-6, 1 - damping * damping)), a = damping * w0, b = (a - v0) / wd;
    const y = (t) => Math.exp(-a * t) * (Math.cos(wd * t) + b * Math.sin(wd * t)), dy = (t) => Math.exp(-a * t) * ((b * wd - a) * Math.cos(wd * t) - (a * b + wd) * Math.sin(wd * t));
    let T = 0.02; while (T < 1.5 && y(T) > (damping < 1 ? 0.001 : 0.005)) T += 0.004;   // a spring with no bounce never crosses: it ends with half a percent to go
    // As a cubic-bezier, never linear(): WebKit hands a cubic-bezier transition to Core Animation, which runs it at the screen's own rate (120 Hz on
    // ProMotion) whatever the page is doing, while a linear() one runs on the page itself at 60 and stops whenever the page is busy (measured on
    // iOS 27.2, 8 Nov: a page held busy for 250 ms just after the release froze the linear() settle; the cubic-bezier one carried on). Both ends'
    // speeds are the spring's own, the two control points are fitted: within 1.3% of the spring from rest, 2.6% at the hardest cancel.
    const s0 = v0 * T, s1 = -dy(T) * T, f = (u) => 1 - y(u * T);
    const err = (x1, x2) => { const y1 = s0 * x1, y2 = 1 - s1 * (1 - x2); let m = 0; for (let i = 1; i < 16; i++) { const t = i / 16, mt = 1 - t, X = 3 * mt * mt * t * x1 + 3 * mt * t * t * x2 + t * t * t, Y = 3 * mt * mt * t * y1 + 3 * mt * t * t * y2 + t * t * t; m = Math.max(m, Math.abs(Y - f(X))); } return m; };
    let best = [0.25, 0.3], be = err(0.25, 0.3);
    for (let i = 1; i < 10; i++) for (let j = 0; j < 10; j++) { const e = err(i / 10, j / 10); if (e < be) { be = e; best = [i / 10, j / 10]; } }
    for (const step of [0.025, 0.006]) { const [c1, c2] = best; for (let i = -3; i <= 3; i++) for (let j = -3; j <= 3; j++) { const x1 = Math.min(1, Math.max(0.01, c1 + i * step)), x2 = Math.min(0.99, Math.max(0, c2 + j * step)), e = err(x1, x2); if (e < be) { be = e; best = [x1, x2]; } } }
    const [x1, x2] = best, n = (q) => +q.toFixed(4);
    const out = { css: "cubic-bezier(" + n(x1) + ", " + n(s0 * x1) + ", " + n(x2) + ", " + n(1 - s1 * (1 - x2)) + ")", ms: Math.round(T * 1000) };
    if (easeMemo.size > 200) easeMemo.clear(); easeMemo.set(key, out); return out;
  };
  const calmMotion = () => { try { return typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (_) { return false; } };
  if ((swipeOn || deskOn) && !iosHome && typeof document !== "undefined" && document.body && document.body.classList) document.body.classList.add("clip-x");   // Android's installed app and a computer: the sliding page must not widen the page (index.html)
  const dockSig = (dock) => [...dock.children].filter((k) => !k.hidden).map((k) => k.id).join(",");   // which bar the page shows at its foot: a client page's tabs and +, a workout's Coach | Client and +
  const dockShows = (dock) => !!dock && [...dock.children].some((k) => !k.hidden) && !document.body.classList.contains("typing") && !document.body.classList.contains("kb");   // the bar at the foot is on screen (the keyboard, or its bar of keys, has the bottom: index.html)
  const dockGoes = (dockOn, shot, dock) => !!dockOn && !(shot && shot._dock && shot._dockSig === dockSig(dock));   // the swipe back: this page's bar goes with this page; the same bar on both pages stays (the copy's then stays hidden); a different one (the workout's Coach | Client and +, the client page's tabs and +) goes with its page while the other comes in with its own
  function captureScreen() {                                        // a still copy of the page as it is, to sit under the swipe later
    const secs = [...document.querySelectorAll("main > section")].filter((s) => !s.hidden && s.getClientRects().length);
    if (!secs.length) return null;
    const box = document.createElement("div"); box.className = "nav-shot"; box.setAttribute("aria-hidden", "true");
    box.dataset.bar = String(Math.min(1, Math.max(0, (Number(window.scrollY) || 0) / BAR_FADE)));   // how the top bar looked over this page: the swipe brings it back
    box.dataset.look = lookNow();                                   // the coach's look or the client's: a copy is only shown in the look it was taken in, and at the width (the phone turned since: laid out for the other one)
    for (const s of secs) {
      const r = s.getBoundingClientRect(), c = s.cloneNode(true), from = s.querySelectorAll("input, textarea, select"), to = c.querySelectorAll("input, textarea, select");
      from.forEach((el, i) => { if (to[i]) to[i].value = el.value; });   // what was typed shows, not just the empty fields
      c.style.position = "absolute"; c.style.left = r.left + "px"; c.style.top = r.top + "px"; c.style.width = r.width + "px"; c.style.margin = "0";   // the copy's content exactly where the page's was (a section is flow-root, index.html, so its first child's margin stays inside it)
      box.appendChild(c);
    }
    const dock = $("dock"); box._dock = dockShows(dock); box._dockSig = box._dock ? dockSig(dock) : "";
    if (box._dock) { const d = dock.cloneNode(true); d.classList.add("shot-dock"); box.appendChild(d); }   // the page's tab bar too, styled as itself (fixed inside the copy, which holds it in place: will-change): it comes in with the page
    return box;
  }
  const lookNow = () => (document.body.classList.contains("client") ? "client" : "coach") + "@" + (Number(window.innerWidth) || 0);
  function barFor(key) {                                            // the bar's buttons on the screen with this key (keep in step with render() and the settings pages)
    const [vk, sub] = String(key).split("|"), [name, id, prog] = vk.split("/"), home = !sub && (name === "clients" || (S.clientMode && name === "client"));
    const tplMore = !sub && name === "client" && isTemplateClient(id) && !prog && !S.clientMode && !pickFor;   // the Templates page and his folders: his "…" (keep in step with tplPageOn)
    return { back: !home, brand: home, meDisc: !sub && name === "client" && !isTemplateClient(id), navDone: sub === "exercise", tMore: (!sub && name === "training" && moreOn(trainings.get(id))) || tplMore, tAdd: tplMore, barMsg: !sub && (name === "client" || name === "training") && !!msgTarget(name, id), id };
  }
  function barCopy(key) {                                           // the bar as the screen Back goes to will show it, when there is no copy of that screen
    const live = document.querySelector("header .bar"); if (!live) return null;
    const f = barFor(key), b = live.cloneNode(true), q = (id) => b.querySelector("#" + id);
    for (const id of ["back", "brand", ...GLASS.slice(1)]) if (q(id)) q(id).hidden = !f[id];
    const md = q("meDisc"), c = f.meDisc ? clients.get(f.id) : null;
    if (md) { md.classList.toggle("has-av", !!c); if (c) paintAvatar(md.querySelector(".avatar"), f.id, c.name); md.classList.toggle("needs", !!c && !S.clientMode && !c.email); }   // that client's photo or initials, and the red dot of no sign-in email, as the client page shows them
    return b;
  }
  function freshHomeShot() {                                        // no copy of the home in this session (the app reopened on a deeper page): one drawn now, where Back will put it
    if (S.clientMode || typeof renderClients !== "function") return null;
    const cur = [...document.querySelectorAll("main > section")].find((s) => !s.hidden && s.getClientRects().length); if (!cur) return null;
    try { renderClients(); } catch (_) { return null; }
    let y = scrollMemo.get(viewKey({ name: "clients" })) || 0, toFoot = false;   // where Back will put the home (runBack): its own place, or from a settings page where that was opened from, else the pills at the foot
    if (settingsOpen) { if (backScroll != null) y = backScroll; else if (!$("localFoot").hidden) { y = 0; toFoot = true; } else y = 0; }
    const cr = cur.getBoundingClientRect(), docTop = cr.top + (Number(window.scrollY) || 0), px = (st, k) => parseFloat(st[k]) || 0, ms = getComputedStyle(cur.parentElement), bs = getComputedStyle(document.body);
    const below = px(ms, "paddingBottom") + px(ms, "borderBottomWidth") + px(ms, "marginBottom") + px(bs, "paddingBottom");   // what the page has under its section (main's and body's), the same under the home
    const box = document.createElement("div"); box.className = "nav-shot"; box.setAttribute("aria-hidden", "true"); box.dataset.look = lookNow();
    const c = $("vClients").cloneNode(true); c.hidden = false; c.style.position = "absolute"; c.style.left = cr.left + "px"; c.style.width = cr.width + "px"; c.style.margin = "0"; box.appendChild(c);
    const put = (at) => { c.style.top = (docTop - at) + "px"; box.dataset.bar = String(Math.min(1, Math.max(0, at / BAR_FADE))); };
    put(y);
    box._land = () => {                                             // once the copy is laid out: where the browser will really put the home (the foot's bottom at the screen's bottom, as scrollIntoView({ block: "end" }) does; never past the page's end)
      const h = Number(window.innerHeight) || 0, max = Math.max(0, docTop + c.getBoundingClientRect().height + below - h);
      let at = y; if (toFoot) { const f = c.querySelector("#localFoot"); if (f && f.getClientRects().length) at = f.getBoundingClientRect().bottom - h; }
      put(Math.max(0, Math.min(at, max)));
    };
    box._dock = false;
    return box;
  }
  let sw = null, renderAfterSwipe = false;
  const renderUnlessSwiping = () => { if ((sw && (sw.on || sw.busy)) || rowHolds()) { renderAfterSwipe = true; return; } render(); };   // a sync's redraw waits while the pages slide or a row moves (never the page or row under the finger rebuilt mid-swipe); clearSwipe and the row's settle draw it
  const swipeHolds = () => !!sw && !S.asking && (sw.on || sw.busy) && !(sw.busy && Date.now() - sw.busyAt > 3000);   // the pages are sliding: no taps (a question Back asks always takes them; a release that never finished lets go after 3 s)
  document.addEventListener("click", (e) => { if (swipeHolds()) { e.preventDefault(); e.stopImmediatePropagation(); } }, true);   // nothing is tapped while the pages slide (a second Back, the card, the + would land mid-transition)
  const backReady = () => canBack() && !held() && !(document.activeElement && /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName));
  const swipeReady = () => swipeOn && backReady();
  const swipeSpeed = () => { const a = sw.pts[0], b = sw.pts[sw.pts.length - 1]; return b[0] > a[0] ? (b[1] - a[1]) / (b[0] - a[0]) : 0; };   // px per ms, the average over the last three samples
  const dropSw = () => { if (sw && sw.ac) sw.ac.abort(); sw = null; };   // this touch is not a swipe (its listeners on the touched element go too)
  document.addEventListener("touchstart", (e) => {
    if (sw && sw.busy) { if (S.asking || Date.now() - sw.busyAt <= 3000) return; clearSwipe(); }   // a release that never finished is let go, never left holding the page
    if (sw && sw.on) { endSwipe(true); return; }                    // a second finger: the page settles back, as on iPhone
    dropSw(); if (e.touches.length !== 1 || !swipeReady()) return;
    const t = e.touches[0], tgt = e.target; if (tgt && tgt.closest && tgt.closest(NO_SWIPE)) return;
    sw = { x0: t.clientX, y0: t.clientY, sy: Number(window.scrollY) || 0, dx: 0, on: false, held: false, edge: t.clientX <= SWIPE_EDGE, pts: [[e.timeStamp, t.clientX]], flick: true };
    if (tgt && tgt.addEventListener && typeof AbortController === "function") {   // a touch's events stay aimed at the element it began on: one the page redraws meanwhile (a sync) is out of the document and they no longer reach it, so they are heard on the element too
      const ac = sw.ac = new AbortController(), on = (type, fn) => tgt.addEventListener(type, (ev) => { if (!tgt.isConnected) fn(ev); }, { passive: type !== "touchmove", signal: ac.signal });
      on("touchmove", swipeMove); on("touchend", swipeEnd); on("touchcancel", swipeCancel);
    }
  }, { passive: true });
  const scrolledSince = () => iosHome && Math.abs((Number(window.scrollY) || 0) - sw.sy) > 1;   // the page itself has scrolled under this touch (iPhone; Android keeps its swipe as it was)
  const swipeSample = (e, x) => { const last = sw.pts[sw.pts.length - 1]; if (e.timeStamp - last[0] >= 10) { sw.pts.push([e.timeStamp, x]); if (sw.pts.length > 3) sw.pts.shift(); } };
  function swipeMove(e) {
    if (!sw || sw.busy) return;
    const t = e.touches && e.touches[0]; if (!t) return;
    const dx = t.clientX - sw.x0, dy = t.clientY - sw.y0;
    if (!sw.held) {                                                 // nothing held yet: a tap that rolls a little and a scroll stay the page's
      if (scrolledSince() || (Math.abs(dy) > 12 && Math.abs(dy) > dx)) { dropSw(); return; }   // a scroll
      if (dx < SWIPE_GO) return;
      if (dx < Math.abs(dy) * (sw.edge ? 1 : 2)) { dropSw(); return; }   // from the edge: anything not more up or down than right; from the page: clearly to the right
      e.preventDefault(); sw.held = true; lpYield(); sw.hx = t.clientX; swipeSample(e, t.clientX); return;   // held from here; this move only holds, so WebKit has the answer at once (the page moves from the next); a touch and hold under way is let go at once
    }
    e.preventDefault(); swipeSample(e, t.clientX);
    if (!sw.on) { if (scrolledSince()) { dropSw(); return; } sw.x0 = t.clientX; startSwipe(); }   // the page moves by the finger's travel from here, no jump (a page the browser scrolled anyway keeps the touch)
    else if (scrolledSince()) { endSwipe(true); return; }           // it scrolled after all (the hold came too late): the page settles back rather than slide and scroll at once
    if (sw.pts.length >= 3 && swipeSpeed() * 1000 / sw.w < 1.5) sw.flick = false;   // a flick: never under 1.5 screens per second since it began
    sw.dx = Math.max(0, t.clientX - sw.x0); paintSwipe(null);
  }
  function swipeEnd(e) {
    if (!sw || sw.busy) return;
    if (sw.held && !sw.on) {                                        // let go right after it was held (a quick flick): it starts and is judged at once
      const t = e.changedTouches && e.changedTouches[0]; sw.x0 = sw.hx; startSwipe();
      sw.dx = Math.max(0, (t ? t.clientX : sw.hx) - sw.x0); paintSwipe(null); void sw.main.offsetWidth;   // its place before the release springs from it
    }
    if (sw.on) endSwipe(false, e.timeStamp); else dropSw();
  }
  function swipeCancel() { if (!sw || sw.busy) return; if (sw.on) endSwipe(true); else dropSw(); }
  document.addEventListener("touchmove", swipeMove, { passive: false });
  document.addEventListener("touchend", swipeEnd);
  document.addEventListener("touchcancel", swipeCancel);
  document.addEventListener("pointercancel", (e) => { if (iosHome && e.pointerType === "touch") swipeCancel(); }, { capture: true, passive: true });   // iPhone: WebKit took the touch for its own scroll (it cancels the pointer then): never slide while it scrolls
  function startSwipe() {
    for (const old of document.querySelectorAll(".swipe-under")) old.remove();   // nothing left over from an earlier swipe
    sw.on = true; sw.w = window.innerWidth; sw.main = document.querySelector("main");
    const layer = document.createElement("div"); layer.className = "swipe-under"; layer.setAttribute("aria-hidden", "true");
    const bk = backKey(); let shot = shotByKey.get(bk) || null;
    if (shot && shot.dataset.look !== lookNow()) shot = null;       // taken in the other look (the coach previewing a workout as the client) or at another width: not the page Back will show
    if (!shot && bk === viewKey({ name: "clients" }) + "||") shot = freshHomeShot();   // the home has no copy yet (after a relaunch): one drawn now, never the plain page colour
    if (shot) layer.appendChild(shot);                              // none known: the plain page colour, never a wrong page
    const dim = document.createElement("div"); dim.className = "swipe-dim"; layer.appendChild(dim);
    document.body.appendChild(layer); sw.layer = layer; sw.dim = dim; sw.shot = shot;
    if (shot && shot._land) shot._land();                           // a fresh copy placed by its own layout
    document.body.classList.add("swipe-busy");                      // no taps on the bar or the tab bar until the pages have settled (UIKit takes none during its transition)
    const dock = $("dock"), dockOn = dockShows(dock);
    sw.dock = dock; sw.dockSlides = dockGoes(dockOn, shot, dock);
    if (shot) for (const d of shot.querySelectorAll(".shot-dock")) d.style.visibility = dockOn && !sw.dockSlides ? "hidden" : "";
    // the bar: its buttons stay as they are while the finger moves; the logo of the page underneath comes in with that page
    const live = document.querySelector("header .bar"); sw.glassOut = []; sw.glassIn = []; sw.anims = [];
    if (live) {
      const nb = barCopy(bk), vis = (b, id) => { const el = b && b.querySelector("#" + id); return !!el && !el.hidden; };   // the page underneath's bar as render() will show it now (never its picture's own: a number added on her card since, or a sync, would pop in after the slide)
      const slot = (b, id) => { const ks = [...((b && b.children) || [])], i = ks.findIndex((k) => k.id === id), st = ks.findIndex((k) => k.id === "status"); return i < st ? "L" + ks.slice(0, i).filter((k) => !k.hidden).length : "R" + ks.slice(i + 1).filter((k) => !k.hidden).length; };   // a button's place, counted from its own edge (every circle 44, the bar's 12 between)
      const stays = (id) => vis(live, id) && vis(nb, id) && slot(live, id) === slot(nb, id) && (id !== "tMore" || vis(live, "tAdd") === vis(nb, "tAdd"));   // (the … alone is a circle, beside the + the capsule's half: in another shape it goes and comes, as the v280 review caught)   // the same button in the same place on both bars stays put (the Messages circle from a workout to her page); in another place it goes and comes, as UIKit cross-fades bar items (a finished workout has no "…": its Messages circle is at the edge, on her page it is beside her photo)
      for (const id of GLASS) if (vis(live, id) && !stays(id)) sw.glassOut.push($(id));   // a button only this page has, or in another place: it goes when the finger lets go
      if (nb) {
        sw.barRect = live.getBoundingClientRect();
        const put = (b) => { b.setAttribute("aria-hidden", "true"); b.style.position = "absolute"; b.style.top = "0"; b.style.left = "0"; b.style.pointerEvents = "none"; live.after(b); return b; };
        // the page underneath's logo, moving with that page and only where the leaving page has uncovered it: a window as wide as the screen whose right
        // edge rides the leaving page's left edge, the logo inside it moving with the page underneath; both by transform alone, so Core Animation runs
        // them with the pages on release (a clip-path would stay on the page at 60 and lag the edge)
        const hr = live.parentElement.getBoundingClientRect(), r = sw.barRect, win = document.createElement("div");
        win.setAttribute("aria-hidden", "true"); win.style.cssText = "position:absolute;top:" + (r.top - hr.top) + "px;left:" + (-hr.left) + "px;width:" + sw.w + "px;height:" + r.height + "px;overflow:hidden;pointer-events:none;transform:translate3d(" + (-sw.w) + "px,0,0)";
        const tb = nb.cloneNode(true); tb.setAttribute("aria-hidden", "true"); tb.style.position = "absolute"; tb.style.top = "0"; tb.style.left = r.left + "px"; tb.style.margin = "0"; tb.style.width = r.width + "px"; tb.style.pointerEvents = "none";
        for (const k of tb.children) if (!(k.id === "brand" && !k.hidden && $("brand").hidden)) k.style.visibility = "hidden";
        win.appendChild(tb); live.after(win); sw.textWin = win; sw.textBar = tb;
        const gb = put(nb.cloneNode(true));                         // the page underneath's buttons this page does not have: they come when the finger lets go
        for (const k of gb.children) { const g = GLASS.includes(k.id) && !k.hidden && !stays(k.id); k.style.visibility = "hidden"; if (g) sw.glassIn.push(k); }
        sw.glassBar = gb;
      }
    }
    sw.hdr = document.querySelector("header"); sw.barFrom = Math.max(0, barLevel); sw.barTo = Math.min(1, Math.max(0, shot ? Number(shot.dataset.bar) || 0 : settingsOpen ? sw.barFrom : (scrollMemo.get(String(bk).split("|")[0]) || 0) / BAR_FADE));   // the bar goes from this page's look to the one underneath as the finger moves (no copy of it: where Back will put that page, its top after a relaunch)
    sw.main.classList.add("swiping");
  }
  function paintSwipe(ease) {                                       // ease: the release's spring (null while the finger is on the screen)
    const p = Math.min(1, sw.dx / sw.w), tr = (prop) => ease ? prop + " " + ease.ms + "ms " + ease.css : "none", move = "translate3d(" + sw.dx + "px,0,0)", under = -0.3 * sw.w * (1 - p);
    sw.main.style.transition = tr("transform"); sw.main.style.transform = move;
    if (sw.dockSlides && sw.dock) { sw.dock.style.transition = tr("transform"); sw.dock.style.transform = move; }
    if (sw.shot) { sw.shot.style.transition = tr("transform"); sw.shot.style.transform = "translate3d(" + under + "px,0,0)"; }   // the page underneath comes in from 30% to the left
    sw.dim.style.transition = tr("opacity"); sw.dim.style.opacity = String(1 - p);
    if (sw.textWin && sw.textBar) { const at = sw.dx - sw.w; sw.textWin.style.transition = tr("transform"); sw.textWin.style.transform = "translate3d(" + at + "px,0,0)"; sw.textBar.style.transition = tr("transform"); sw.textBar.style.transform = "translate3d(" + (under - at) + "px,0,0)"; }   // the window's right edge on the leaving page's edge; the logo where the page underneath is
    if (sw.hdr && sw.hdr.style) {
      if (ease) { sw.hdr.style.setProperty("--swipe-ms", ease.ms + "ms"); sw.hdr.style.setProperty("--swipe-ease", ease.css); }
      sw.hdr.classList.toggle("bar-anim", !!ease); setBar(Math.round((sw.barFrom + (sw.barTo - sw.barFrom) * p) * 100) / 100);
    }
  }
  function clearSwipe() {
    if (!sw) return; const m = sw.main;
    m.classList.remove("swiping"); m.style.transition = ""; m.style.transform = "";
    if (sw.dock) { sw.dock.style.transition = ""; sw.dock.style.transform = ""; }
    if (sw.shot) { sw.shot.style.transition = ""; sw.shot.style.transform = ""; for (const d of sw.shot.querySelectorAll(".shot-dock")) d.style.visibility = ""; if (sw.shot.parentNode) sw.shot.parentNode.removeChild(sw.shot); }   // the copy is kept for a later swipe to the same page
    if (sw.layer) sw.layer.remove();
    for (const a of sw.anims || []) { try { a.cancel(); } catch (_) {} }
    if (sw.textWin) sw.textWin.remove(); if (sw.glassBar) sw.glassBar.remove();
    if (sw.hdr) { sw.hdr.classList.remove("bar-anim"); sw.hdr.style.removeProperty("--swipe-ms"); sw.hdr.style.removeProperty("--swipe-ease"); }
    document.body.classList.remove("swipe-busy");
    if (sw.ac) sw.ac.abort();
    sw = null; barLevel = -1; paintBar();                            // the bar as the page now under it really is (written even when it matches the old level)
    rsFlush();                                                      // what a sync brought meanwhile (unless a row is still moving: it draws it then)
  }
  async function endSwipe(cancelled, at) {
    const mine = sw; mine.busy = true; mine.busyAt = Date.now();
    try { await settleSwipe(mine, cancelled, at); }
    catch (_) { if (sw === mine) clearSwipe(); }                    // whatever went wrong, the page is left as the Back circle leaves it, never held
  }
  async function settleSwipe(s, cancelled, at) {
    const clear = () => { if (sw === s) clearSwipe(); }, w = s.w, p = Math.min(1, s.dx / w);
    const lastT = s.pts[s.pts.length - 1][0], rested = at != null && at - lastT > 60;   // a finger that stopped before it lifted has no speed
    const v = rested ? 0 : swipeSpeed();                            // px per ms
    const go = !cancelled && (s.pts.length < 3 ? v > 0 && p > 0 : p + (v * 1000 / w) * 0.35 > Math.min(187.5 / w, 0.5));   // UIKit's rule: 0.35 s ahead past the smaller of 187.5 points and half the screen
    const left = go ? w - s.dx : s.dx, vTo = go ? v * 1000 * (s.edge && s.flick ? 4.25 : 1) : -v * 1000;   // the finger's speed toward where the pages now go (a flick from the edge flies off faster, as UIKit's)
    const ease = springEase(left > 1 ? Math.max(-15, Math.min(15, vTo / left)) : 0, 0.3, 0.85);   // held to 15 distances a second: faster only overshoots, and the page underneath would show it
    if (!go) { s.dx = 0; paintSwipe(ease); setTimeout(clear, ease.ms + 20); return; }
    s.dx = w; paintSwipe(ease);
    const glass = springEase(0, GLASS_RES, GLASS_DAMP);             // the bar's buttons change now, while the page settles
    const out = calmMotion() ? [{ opacity: 1 }, { opacity: 0 }] : [{ transform: "scale(1)", filter: "blur(0px)", opacity: 1 }, { transform: "scale(1.2)", filter: "blur(10px)", opacity: 0 }];   // Reduce Motion: a plain fade
    for (const el of s.glassOut) if (el && el.animate) s.anims.push(el.animate(out, { duration: glass.ms, easing: glass.css, fill: "forwards" }));
    for (const el of s.glassIn) if (el && el.animate) { el.style.visibility = ""; s.anims.push(el.animate([...out].reverse(), { duration: glass.ms, easing: glass.css, fill: "forwards" })); }
    await new Promise((r) => setTimeout(r, Math.max(ease.ms, s.glassOut.length || s.glassIn.length ? glass.ms : 0) + 20));
    if (sw !== s) return;                                           // let go of meanwhile (the safety release below)
    // the swap, all in one go, nothing in between painted: the copy covers the screen, the page underneath becomes the real one at its own
    // scroll (with no slide or swipe style left on it, as the Back circle leaves it), then the copy goes
    const m = s.main; s.layer.style.zIndex = "3"; m.style.transition = "none"; m.style.transform = ""; m.classList.remove("swiping");
    if (s.dock) { s.dock.style.transition = "none"; s.dock.style.transform = ""; }
    const before = navSig(); await goBackNow();                     // may ask first (changes to an exercise): taps then reach the question (the guard above lets them through)
    if (sw !== s) return;
    if (navSig() === before) {                                       // Back was refused: the page comes back in, as the Back circle leaves it
      for (const a of s.anims) { try { a.cancel(); } catch (_) {} } s.anims = [];
      for (const el of s.glassIn) if (el) el.style.visibility = "hidden";   // and what was coming in with the page underneath (the Templates page's + capsule) goes again
      m.classList.add("swiping"); m.style.transform = "translate3d(" + w + "px,0,0)"; s.layer.style.zIndex = "";
      if (s.dockSlides && s.dock) { s.dock.style.transition = "none"; s.dock.style.transform = "translate3d(" + w + "px,0,0)"; }   // its bar went with it and comes back in with it (a template's +, its Unsaved changes asked about)
      void m.offsetWidth;
      const back = springEase(0, 0.3, 1); s.dx = 0; paintSwipe(back); setTimeout(clear, back.ms + 20); return;
    }
    clear();                                                        // same moment: the next frame shows the real page where the copy was
  }
  // ---------- a workout's row on Today and Up next: swiped to the left, Skip and Reschedule behind it, as Apple's rows show their actions ----------
  // Measured on iOS 27.2 (Reminders, 8 Nov: one action, then its two, Details and Delete, frame by frame, portrait and landscape). The row
  // follows the finger 1:1, held after 8 points sideways (and twice as sideways as up or down, the swipe back's rule). Behind it, on the
  // page's own colour, two actions wait at the right, each a 61 x 37 capsule with its icon and its title under it (13 points, secondary
  // grey, measured 138,138,142 / dark 141,141,147): Skip (systemGray3, #c7c7cc / dark #48484a, as Details) and, outermost, Reschedule.
  // Open, they sit 11.67 points from the row, 10.33 apart and 10.67 from the card's edge. Each grows in (size and opacity together) as the
  // row uncovers it: from the moment half its capsule is uncovered to the moment its whole slot is, so the outer one comes first. The
  // swiped row turns systemGray5 (#e5e5ea, dark #2c2c2e), keeps the card's corners where it has them, and the hairlines beside it go. Let go
  // past half the actions (or flicked that way) and it stays open; else it closes. Past the actions the inner one rides along with the row
  // and fades (to 66% within 30 points, then 0.19% a point, never under 30%), and the outer one stretches into the room (its right edge
  // stays). The swipe is armed once the row's edge comes within 81 points of its own start (measured: portrait at 80% of a 402-point row,
  // landscape at 89% of 748): the outer icon goes to its capsule's leading edge, its title goes, the inner one drops to 30%, and letting go
  // reschedules. It settles on the app's UIKit spring (response 0.3 s, damping 0.85; Apple's row settles in the same 0.3 s with the same
  // small overshoot) and the grey fades as it closes. An open row closes on any other touch on the page: that tap does nothing else, as
  // on iPhone, while the bars above and below act at once (measured: Reminders' Back with a row open goes back on that tap). It also closes
  // on a scroll, Escape or another page. A mouse drags the row the same way; a click elsewhere closes the open row and still goes through
  // (a Mac's way). Two fingers on a Mac's trackpad open and close it but stop there (below): the actions are clicked. Skip asks first, with
  // the workout page's own sheet; the workout page holds both too (its "…" and its Skip workout): Apple, never a gesture only. The trainer's
  // view of a client's page swipes the same (his pick, 9 Nov): his Reschedule takes any day, as his date on the workout page ("Move to") does.
  const RS_GAP = 11.67, RS_BETWEEN = 10.33, RS_END = 10.67, RS_HOLD = 8, RS_ARM_EDGE = 81, RS_FLICK = 0.3, RS_ARM_PAST = 50;   // RS_FLICK: px per ms; a let-go faster than this goes its own way. RS_ARM_PAST: never armed while merely open (a 320-point phone or a large Text Size with a missed workout's three actions): 50 past the open width at least, the room a row of two already has on the narrowest phone (205 - 154.67)
  const SA_CALENDAR = '<svg class="mi" viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" fill-rule="evenodd" d="M4.2 2.9h7.6c1.2 0 2.2 1 2.2 2.2v7c0 1.2-1 2.2-2.2 2.2H4.2C3 14.3 2 13.3 2 12.1v-7c0-1.2 1-2.2 2.2-2.2zM3.5 6.6v5.5c0 .4.3.7.7.7h7.6c.4 0 .7-.3.7-.7V6.6z"/><path fill="currentColor" d="M5 8h1.6v1.6H5zM7.2 8h1.6v1.6H7.2zM9.4 8H11v1.6H9.4zM5 10.2h1.6v1.6H5zM7.2 10.2h1.6v1.6H7.2z"/><path d="M5.2 1.5v2.2M10.8 1.5v2.2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>';   // the calendar filled, as Apple's swipe actions use the fill variants (HIG, SF Symbols)
  const SA_SKIP = '<svg class="mi" viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M3 3.4v9.2c0 .6.6.9 1.1.6l7-4.6c.4-.3.4-.9 0-1.2l-7-4.6C3.6 2.5 3 2.8 3 3.4z"/><rect x="11.6" y="2.6" width="2" height="10.8" rx="1" fill="currentColor"/></svg>';   // forward.end.fill: skip, as media controls draw it
  const REPS_DEFAULT = "10";                                          // blank reps read as 10: the reps field's grey, the client's filled-in value, the preview
  const SA_EYE = '<svg class="mi" viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" fill-rule="evenodd" d="M8 3.6c3.1 0 5.6 2.1 6.7 4.1a.6.6 0 0 1 0 .6C13.6 10.3 11.1 12.4 8 12.4S2.4 10.3 1.3 8.3a.6.6 0 0 1 0-.6C2.4 5.7 4.9 3.6 8 3.6zm0 2.1a2.3 2.3 0 1 0 0 4.6 2.3 2.3 0 0 0 0-4.6z"/></svg>';   // eye.fill: Preview, as Apple's Quick Look
  const SA_FOLDER = '<svg class="mi" viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M1.6 4.1C1.6 3.3 2.2 2.7 3 2.7H6.05C6.47 2.7 6.87 2.89 7.13 3.22L7.9 4.2H13C13.8 4.2 14.4 4.8 14.4 5.6V11.9C14.4 12.7 13.8 13.3 13 13.3H3C2.2 13.3 1.6 12.7 1.6 11.9Z"/></svg>';   // folder.fill: Move to, the folder New folder draws without its plus (Notes moves a note with a folder)
  const SA_TRASH = '<svg class="mi" viewBox="-7.3 -3.3 62.6 62.6" aria-hidden="true"><path fill="currentColor" fill-rule="evenodd" d="M17.75 0.5H30.25A4.5 4.5 0 0 1 34.75 5V10.25H31V6.5A2.5 2.5 0 0 0 28.5 4H19.5A2.5 2.5 0 0 0 17 6.5V10.25H13.25V5A4.5 4.5 0 0 1 17.75 0.5ZM1.45 10.25H46.55A1.45 1.45 0 0 1 48 11.7V12.2A1.45 1.45 0 0 1 46.55 13.65H1.45A1.45 1.45 0 0 1 0 12.2V11.7A1.45 1.45 0 0 1 1.45 10.25ZM5 13.65H43L41.25 50.5A5 5 0 0 1 36.25 55.5H11.75A5 5 0 0 1 6.75 50.5ZM14.5 19.78L15 46.28A1.5 1.5 0 0 0 18 46.22L17.5 19.72A1.5 1.5 0 0 0 14.5 19.78ZM22.5 19.75L22.5 46.25A1.5 1.5 0 0 0 25.5 46.25L25.5 19.75A1.5 1.5 0 0 0 22.5 19.75ZM30.5 19.72L30 46.22A1.5 1.5 0 0 0 33 46.28L33.5 19.78A1.5 1.5 0 0 0 30.5 19.72Z"/></svg>';   // trash.fill: Delete, the menu's own trash (MI.trash) filled, its three slits cut through, as Apple's swiped rows show it
  const DOTS = '<svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true" fill="currentColor"><circle cx="3.8" cy="10" r="1.75"/><circle cx="10" cy="10" r="1.75"/><circle cx="16.2" cy="10" r="1.75"/></svg>';   // a "…" disc's three dots, as the coach's exercise "…"
  const rowArmed = (x, w, row) => x >= Math.max(row - RS_ARM_EDGE, w + RS_ARM_PAST);   // the full swipe: the row's edge within 81 points of its own start, and never before 50 points past the open actions (a row let go open stays open; where that is past the row's end there is no full swipe, the actions are tapped)
  const rowDecide = (x, v, w, row) => (rowArmed(x, w, row) ? "fire" : Math.abs(v) > RS_FLICK ? (v > 0 ? "open" : "close") : x > w / 2 ? "open" : "close");   // where a let-go row goes; v: px per ms to the left
  const fingerX = (e) => (e && e.webkitDirectionInvertedFromDevice === false ? e.deltaX : -e.deltaX);   // a trackpad's sideways scroll as the fingers moved, + to the right (macOS scrolls naturally by default: the page's delta is the other way)
  const rsSample = (g, ts, x) => { const last = g.pts[g.pts.length - 1]; if (!last || ts - last[0] >= 8) { g.pts.push([ts, x]); while (g.pts.length > 2 && ts - g.pts[0][0] > 100) g.pts.shift(); } else last[1] = x; };
  const rsSpeed = (g, at) => { const a = g.pts[0], b = g.pts[g.pts.length - 1]; if (!a || !b || b[0] <= a[0] || (at != null && at - b[0] > 60)) return 0; return (b[1] - a[1]) / (b[0] - a[0]); };   // px per ms to the left over the last 100 ms; a finger that rested before it lifted has none
  const lpSettling = () => { const b = $("ctxLift"); return !!(b && !b.hidden && b.classList.contains("lp-back")); };   // a held item's copy settling back into its place (0.26 s): the row under it is not rebuilt meanwhile, or the copy would slide back over a row that is no longer there
  const rowHolds = () => lpSettling() || !!(lpHoldAt && performance.now() - lpHoldAt < 10000) || !!(rsT && (rsT.held || performance.now() - rsT.at < 10000)) || !!(rs && rs.busy) || !!(wg && wg.r && !wg.done) || pvHolds() || cdHolds();   // a finger still down from a touch and hold, a finger or the mouse on a row (a press that never came up holds nothing after 10 s), a row settling, two fingers moving one, a finger on the workout preview or its spring: a sync's redraw waits (renderUnlessSwiping), never the item under them rebuilt (its release would then reach no listener, and iOS would click what lies under it)
  const rsFlush = () => { if (renderAfterSwipe && !(sw && (sw.on || sw.busy)) && !rowHolds()) { renderAfterSwipe = false; render(); } };
  const rsDrop = () => { rsT = null; rsFlush(); };                   // the finger or mouse is off the rows: what a sync brought meanwhile is drawn
  const rsFree = () => !!rs && !(rsT && rsT.held) && !(wg && wg.r === rs && !wg.done);   // the row out is in no finger's, mouse's or two fingers' hands (it may still be settling)
  const rsGrow = (x, a, b) => Math.max(0, Math.min(1, (x - a) / (b - a)));   // an action's growth: from half its capsule uncovered (a) to its whole slot (b)
  function rsPaint(r, x, ease) {                                    // the row at x points to the left of its place; ease: a settle's spring (none while it follows a finger)
    r.x = x;
    const sp = ease ? ease.ms + "ms " + ease.css : "", mv = x ? "translate3d(" + (-x) + "px,0,0)" : "";
    for (const p of r.parts) { p.style.transition = (ease ? "transform " + sp + ", " : "") + "background-color 200ms ease"; p.style.transform = mv; }
    const extra = Math.max(0, x - r.w), armed = rowArmed(x, r.w, r.row), look = armed || !!r.fired, oSlot = RS_END + r.ow + (r.inners.length ? RS_BETWEEN : RS_GAP);   // look: a full swipe let go keeps its armed look while the row closes (its title stays gone, Skip's insides at their share of 30% while Skip itself fades with the row)
    const tr = (props) => (ease ? props.map((k) => k + " " + sp).join(", ") : "none");
    const grow = (el, q, fade) => {                                // size and opacity together, as Apple's actions come in
      el.style.opacity = String(fade != null ? fade : q); el.style.transform = q < 1 ? "scale(" + q.toFixed(3) + ")" : "";
    };
    r.outer.style.transition = tr(["opacity", "transform", "width"]); r.cap.style.transition = tr(["width"]);
    r.outer.style.width = (r.ow + extra) + "px"; r.cap.style.width = (r.capW + extra) + "px";   // past the actions the outer one stretches into the room, its right edge where it was (its title centred under it)
    grow(r.outer, rsGrow(x, RS_END + r.ow / 2, oSlot));            // (its capsule sits centred in it: half of it is uncovered at half the action, a title wider than the capsule at a larger Text Size included)
    const dim = extra <= 0 ? null : extra < 30 ? 1 - 0.337 * extra / 30 : Math.max(0.3, 0.72 - 0.0019 * extra);   // measured: 66% at 30 points past, then 0.19% a point
    let start = oSlot;                                               // the inner actions, from the outer one's side in (a missed workout's Reschedule, then Skip): each grows as its own slot is uncovered, the last one's slot ending at the row's edge, and all dim alike past the actions
    r.inners.forEach((el, j) => {
      const iw = r.iws[j], end = start + iw + (j === r.inners.length - 1 ? RS_GAP : RS_BETWEEN), q = rsGrow(x, start + iw / 2, end), own = dim == null ? q : dim;
      if (armed && !r.armed) r.dimArm[j] = own;                     // armed, it holds at 30%: the action keeps the look it had there and its insides take it the rest of the way, easing over 150 ms both ways, while the action itself follows the row
      el.style.transition = tr(["opacity", "transform"]);
      grow(el, q, armed ? r.dimArm[j] : own);
      const k = look ? 0.3 / r.dimArm[j] : 1;
      for (const c of el.children) { c.style.transition = "opacity 150ms ease"; c.style.opacity = k < 1 ? k.toFixed(4) : ""; }
      start = end;
    });
    if (look !== r.armed) { r.armed = look; r.li.classList.toggle("armed", look); }
  }
  function rsBegin(li, quiet) {                                     // a row starts to move: it and its actions, measured as they are now (quiet: put back open by a redraw, no grey fading in)
    const prev = li._rs && li._rs.busy ? li._rs : null;              // a row still closing after a finger moved on to another one: the same row, taken up again as it is (never a second state whose close would take its actions from under the finger)
    if (prev && rs !== prev) { if (rs) rsSettle(rs, 0, 0); rs = prev; }
    if (rs && rs.li === li) {                                       // the open or settling row, taken up again where it is on the screen (a settle has already set its x to where it was going)
      clearTimeout(rs.timer); rs.fired = false;
      if (rs.busy) { let x = rs.x; try { const m = new DOMMatrixReadOnly(getComputedStyle(rs.parts[0]).transform); x = Math.max(0, Math.min(rs.row, -m.m41)); } catch (_) {} rs.busy = false; rsPaint(rs, x, null); }
      return rs;
    }
    if (rs) rsSettle(rs, 0, 0);                                     // another one was open: it closes as this one moves
    const layer = [...li.children].find((c) => c.classList && c.classList.contains("swipe-acts")), acts = layer ? [...layer.children].filter((c) => c.classList && c.classList.contains("swipe-act")) : [];
    const outer = acts[acts.length - 1], inners = acts.slice(0, -1).reverse(), cap = outer && outer.firstElementChild;   // inners: from the outer one's side in
    if (!layer || !outer || !cap || li.isConnected === false) return null;   // a row a redraw has already replaced moves nothing
    const row = li.getBoundingClientRect().width; if (!row) return null;   // nor one with no width (its page hidden)
    const parts = [...li.children].filter((c) => c !== layer);
    for (const p of parts) p.style.transition = quiet ? "none" : "background-color 200ms ease";   // the grey comes in (put back by a redraw: it is simply there)
    li.classList.add("swiped");                                     // its actions laid out from here, to be measured
    const r = { li, layer, outer, inners, cap, parts, row, x: 0, open: false, busy: false, armed: false, timer: null, dimArm: [] };
    r.capW = cap.offsetWidth || 61; r.ow = outer.offsetWidth || r.capW; r.iws = inners.map((a) => a.offsetWidth || r.capW);
    r.w = RS_GAP + r.iws.reduce((s, iw) => s + iw + RS_BETWEEN, 0) + r.ow + RS_END;   // the row's edge, each action and the gaps between them, the outer one's end
    li._rs = r; rs = r; return r;
  }
  function rsSettle(r, to, v) {                                     // to: 0 (closed) or r.w (open), on the spring from the finger's speed (px per ms to the left)
    clearTimeout(r.timer);
    const dist = to - r.x, ease = springEase(Math.abs(dist) > 1 ? Math.max(-15, Math.min(15, v * 1000 / dist)) : 0, 0.3, 0.85);
    r.busy = true; r.open = to > 0; rsPaint(r, to, ease);
    r.timer = setTimeout(() => { r.busy = false; if (to === 0) rsDone(r); else rsFlush(); }, ease.ms + 20);
  }
  function rsDone(r, quiet) {                                       // closed: the row as it was drawn (quiet: at once, for a redraw or another page; else the grey fades)
    clearTimeout(r.timer); r.busy = false; r.open = false;
    for (const p of r.parts) { p.style.transition = quiet ? "" : "background-color 200ms ease"; p.style.transform = ""; }
    for (const el of [r.outer, ...r.inners, r.cap]) if (el) { el.style.transition = ""; el.style.width = ""; el.style.opacity = ""; el.style.transform = ""; }
    for (const el of r.inners) for (const c of el.children) { c.style.transition = ""; c.style.opacity = ""; }
    r.li.classList.remove("swiped", "armed");
    if (!quiet) setTimeout(() => { if (!r.li.classList.contains("swiped")) for (const p of r.parts) p.style.transition = ""; }, 220);   // no fade left at rest: a light/dark switch changes the row with its card
    if (rs === r) rs = null;
    if (!quiet) rsFlush();
  }
  function rsForget() { if (rs) rsDone(rs, true); rsT = null; if (typeof document !== "undefined" && document.body && document.body.classList) document.body.classList.remove("rs-drag"); }   // a redraw or another page: the row goes back at once (no flush: the caller is drawing)
  function rsFire(r) { const id = r.li.dataset.tid, full = r.li._full; r.fired = !!r.armed; rsSettle(r, 0, 0); if (full) full(); else if (id) rowReschedule(id); }   // the row closes as its outermost action runs (in its armed look, as it was let go): Reschedule's days open, on every row
  function rowReschedule(id) {                                      // the day picker for this row's workout: the client's from today on, as the workout page's "…" opens it; the trainer's any day, as his date on the workout page
    const t = trainings.get(id); if (!canSwipeRow(t)) return false;
    const cid = t.clientId, asClient = canReschedule(t), still = () => S.view.name === "client" && S.view.id === cid && !settingsOpen && canSwipeRow(trainings.get(id));   // still the Workouts page, the workout still to do
    openDatePicker({ clientId: cid, moving: t.id, title: "Reschedule", selected: t.date || today(), min: asClient ? today : null, ok: still, onPick: (date) => (asClient ? applyReschedule(id, date) : moveWorkout(id, date)) });
    return true;
  }
  function rowSkip(id) {                                            // the workout page's own "Skip this workout?" (its reasons, then Skip workout or Cancel), for this row's workout
    const t = trainings.get(id); if (!canSwipeRow(t)) return false;
    openSkip(id); return true;
  }
  function rsLetGo(g, at, cancelled, noFire) {                      // the finger, mouse or trackpad let the row go (noFire: never the action itself)
    const r = rs; if (!r || r.li !== g.li) return;
    if (cancelled) { rsSettle(r, r.x > r.w / 2 ? r.w : 0, 0); return; }
    const v = g.v != null ? g.v : rsSpeed(g, at); let d = rowDecide(r.x, v, r.w, r.row);
    if (d === "fire" && noFire) d = "open";
    if (d === "fire") rsFire(r); else rsSettle(r, d === "open" ? r.w : 0, v);
  }
  // a tap on the page while a row is open only closes it: its touchend is cancelled (WebKit then sends no click), its click, should one come
  // anyway, goes nowhere in the 400 ms after the touch (a long press clicks on release), and what it touched loses the look of a press that
  // iOS would leave on it until the next tap (rs-ate: measured, History stayed at 85% with the touchend cancelled). A new touch, a second finger or a cancelled touch ends that; a touch that scrolls or takes a row brings
  // no click. A tap on a bar (the top bar, the tab bar) closes the row and acts at once, as Apple's do.
  let rsEatEl = null, rsAte = null;                                  // the control the closing tap is on, and the one it left (iOS keeps a tap's hover on it until the next tap: measured, History stayed at 85%)
  const rsEatOff = () => { rsEat = 0; rsEatEl = null; };
  const rsAteOff = () => { if (rsAte) { rsAte.classList.remove("rs-ate"); rsAte = null; } };
  const rsEatSoon = () => { rsEat = performance.now() + 400; };     // a mouse: its click follows its release at once
  document.addEventListener("click", (e) => { if (rsEat && performance.now() <= rsEat) { rsEatOff(); e.preventDefault(); e.stopImmediatePropagation(); } else rsEatOff(); }, true);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && rs && !(rsT && rsT.held)) { if (wg && wg.r === rs) wg.done = true; rsSettle(rs, 0, 0); } });
  window.addEventListener("resize", () => { if (rs && !(rsT && rsT.held)) { if (wg && wg.r === rs) wg.done = true; rsDone(rs); } });   // (two fingers on it let go: the row is laid out anew)
  // a finger
  document.addEventListener("touchstart", (e) => {
    const g = rsT; rsT = null; rsEatOff(); rsAteOff();
    if (e.touches.length !== 1) { if (g && g.held) rsLetGo(g, e.timeStamp, true); rsFlush(); return; }   // a second finger: a row on the move settles where it is, as the swipe back does
    const t = e.touches[0], tgt = e.target, li = tgt && tgt.closest ? tgt.closest("li.swipe-row") : null;
    const onAct = !!(rs && rs.open && li === rs.li && tgt.closest(".swipe-act"));   // the open row's actions: a tap runs them
    if (rs && rs.open && !onAct) {
      if (!tgt.closest("header, #dock")) { rsEat = Infinity; rsEatEl = tgt.closest("button, a, label, [role='button']"); }   // on the page the tap only closes the row (on the row itself at the tap's end, unless the finger moves it); a bar's tap acts
      if (li !== rs.li) rsSettle(rs, 0, 0);
    }
    if (li && !li.closest(".swiping")) rsT = { kind: "touch", at: performance.now(), x0: t.clientX, y0: t.clientY, sy: Number(window.scrollY) || 0, li, held: false, act: onAct, pts: [] };
  }, { passive: true });
  document.addEventListener("touchmove", (e) => {
    const g = rsT; if (!g || g.kind !== "touch") return;
    const t = e.touches && e.touches[0]; if (!t) return;
    const closeOwn = () => { if (rs && rs.open && rs.li === g.li) rsSettle(rs, 0, 0); };   // the open row this touch began on closes (a scroll)
    if (Math.abs((Number(window.scrollY) || 0) - g.sy) > 1) { rsT = null; rsEatOff(); if (g.held) rsLetGo(g, e.timeStamp, true); else closeOwn(); rsFlush(); return; }   // the page itself scrolled under this touch (WebKit took it): never slide and scroll at once (settled first, then a waiting redraw)
    const dx = t.clientX - g.x0, dy = t.clientY - g.y0;
    if (!g.held) {
      if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) { rsT = null; rsEatOff(); closeOwn(); rsFlush(); return; }   // a scroll
      if (Math.abs(dx) < RS_HOLD) return;
      if (Math.abs(dx) < Math.abs(dy) * 2 || (dx > 0 && !(rs && rs.li === g.li))) { if (g.act) return; rsT = null; closeOwn(); rsFlush(); return; }   // not clearly sideways (the page scrolls), or to the right on a closed row: the page's swipe back has it, where there is one (a tap on an action that rolls a little stays that tap)
      e.preventDefault(); if (sw && !sw.on && !sw.busy) dropSw();   // held: from here the page neither scrolls nor swipes back
      const r = rsBegin(g.li); if (!r) { rsDrop(); return; }
      g.held = true; lpYield(); rsEatOff(); g.x0 = t.clientX; g.sx = r.x; rsSample(g, e.timeStamp, r.x); return;   // it moves from the next move, by the finger's travel from here: no jump (and a touch and hold under way is let go at once)
    }
    e.preventDefault(); if (!rs || rs.li !== g.li) { rsDrop(); return; }
    const x = Math.max(0, Math.min(rs.row, g.sx - (t.clientX - g.x0))); rsSample(g, e.timeStamp, x); rsPaint(rs, x, null);
  }, { passive: false });
  const rsTouchUp = (e, cancelled) => {
    if (cancelled) rsEatOff();
    else if (rsEat === Infinity && !(e.touches && e.touches.length)) { rsEat = performance.now() + 400; if (e.cancelable) e.preventDefault(); if (rsEatEl) { rsAte = rsEatEl; rsAte.classList.add("rs-ate"); } rsEatEl = null; }   // the closing tap: no click, and no look of a press left on what it touched
    const g = rsT; if (!g || g.kind !== "touch") { setTimeout(rsFlush, 400); return; } rsT = null;   // (a touch off the rows: a sync's redraw that waited is drawn once its click has come)
    if (!g.held) { if (!g.act && rs && rs.open && rs.li === g.li && !cancelled) rsSettle(rs, 0, 0); setTimeout(rsFlush, 400); return; }   // a tap on the open row: it only closes (a tap elsewhere: a sync's redraw waits for its click)
    rsLetGo(g, e.timeStamp, cancelled); rsFlush();
  };
  document.addEventListener("touchend", (e) => rsTouchUp(e, false), { passive: false });
  document.addEventListener("touchcancel", (e) => rsTouchUp(e, true));
  // a mouse
  document.addEventListener("pointerdown", (e) => {
    if (e.pointerType !== "mouse" || e.button !== 0 || e.ctrlKey) return;   // (a Control-click is the Mac's secondary click: its menu takes the release, so it never starts a drag)
    rsEatOff(); rsAteOff();
    const tgt = e.target, li = tgt && tgt.closest ? tgt.closest("li.swipe-row") : null;
    if (rs && rs.open && li !== rs.li) rsSettle(rs, 0, 0);          // a click elsewhere closes the open row, and still goes through (a Mac's way)
    if (!li || tgt.closest(".swipe-act")) return;
    rsT = { kind: "mouse", at: performance.now(), id: e.pointerId, x0: e.clientX, y0: e.clientY, li, held: false, pts: [] };
  }, true);
  document.addEventListener("pointermove", (e) => {
    const g = rsT; if (!g || g.kind !== "mouse" || e.pointerId !== g.id) return;
    if (e.buttons === 0) {                                          // no button down: no drag ever follows a bare pointer. Safari reads the button as it is at that moment, so a drag's last move can come after it is up:
      if (g.held) { if (!g.upT) g.upT = setTimeout(() => { if (rsT === g) { rsEatSoon(); rsMouseUp(e, true); } }, 100); return; }   // the drag stops where the button left it and its pointerup decides; none within 100 ms: the release was lost (a menu took it), so the drag is cancelled where it is, as a touch the system took
      rsMouseUp(e, false); return;                                  // a press not yet a drag: that move is its release (on the open row: it only closes)
    }
    if (g.upT) { clearTimeout(g.upT); g.upT = 0; }
    const dx = e.clientX - g.x0, dy = e.clientY - g.y0;
    if (!g.held) {
      if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
      if (Math.abs(dx) < Math.abs(dy) * 2 || (dx > 0 && !(rs && rs.li === g.li))) { if (rs && rs.open && rs.li === g.li) return; rsDrop(); return; }   // (a press on the open row stays the click that only closes it, however it wobbles; a clearly sideways move still takes the row)
      const r = rsBegin(g.li); if (!r) { rsDrop(); return; }
      g.held = true; g.x0 = e.clientX; g.sx = r.x; rsSample(g, e.timeStamp, r.x);
      try { g.li.setPointerCapture(e.pointerId); } catch (_) {}
      document.body.classList.add("rs-drag"); return;
    }
    if (!rs || rs.li !== g.li) { rsDrop(); return; }
    const x = Math.max(0, Math.min(rs.row, g.sx - (e.clientX - g.x0))); rsSample(g, e.timeStamp, x); rsPaint(rs, x, null);
  }, true);
  const rsMouseUp = (e, cancelled) => {
    const g = rsT; if (!g || g.kind !== "mouse" || e.pointerId !== g.id) return; rsT = null;
    document.body.classList.remove("rs-drag");
    if (!g.held) { if (rs && rs.open && rs.li === g.li && !cancelled) { rsEatSoon(); rsSettle(rs, 0, 0); } setTimeout(rsFlush, 400); return; }   // a click on the open row: it closes, nothing opens
    if (!cancelled) rsEatSoon(); rsLetGo(g, e.timeStamp, cancelled); rsFlush();   // the click that ends a drag opens nothing
  };
  document.addEventListener("pointerup", (e) => rsMouseUp(e, false), true);
  document.addEventListener("pointercancel", (e) => {
    if (e.pointerType === "mouse") { rsMouseUp(e, true); return; }
    if (e.pointerType === "touch" && rsT && rsT.kind === "touch") { const g = rsT; rsT = null; rsEatOff(); if (g.held) rsLetGo(g, e.timeStamp, true); else if (rs && rs.open && rs.li === g.li) rsSettle(rs, 0, 0); rsFlush(); }   // WebKit took the touch for its own scroll (it cancels the pointer then): an open row closes, one on the move settles
  }, true);
  // two fingers on a Mac's trackpad: the page's sideways wheel. A gesture is the run of events with no gap of 120 ms; its way is decided over
  // its first 8 px, sideways only when twice as sideways as up or down (the finger's rule). The page is never told when the fingers lift:
  // Safari carries the scroll on after them (WebKit's MomentumEventDispatcher, read 8 Nov, with this Mac's own trackpad curve: about a tenth
  // of a second at the lifting speed, then slowing much as fingers slow), and nothing in the events tells the two apart. So nothing that
  // must not follow that coasting does: a row moves between closed and its open width and stops there, open (or closed), and the rest of
  // the gesture moves nothing (the full swipe that reschedules is a finger's or a mouse drag's; here the actions are clicked). The page
  // swiped back follows the coasting as it follows the fingers (a flick carries it on, as far as Safari's coasting goes): let go once past
  // its point of no return and slowed to 70% of its top speed, else when the events stop for 90 ms, by UIKit's rule from where it is (a
  // slowing flick and slowing fingers look alike, so nothing is judged by a speed that might be the coasting's). It starts over a field or
  // with one focused, as Safari's own does (the field is let go first, as a click elsewhere lets it go). Once let go, the rest of the gesture
  // goes nowhere until a new one begins: a gap of 120 ms, a turn up or down or back the other way, or a speed that grows again (fingers back
  // on the trackpad: coasting only slows and never turns), each judged by the travel of the latest events, never one event's size. Anything
  // that scrolls sideways itself keeps the fingers, and so does the browser where nothing of the app's is.
  const WG_GAP = 120, WG_END = 90;
  const NO_WHEEL_BACK = "#calView, #weekView, #dpGrid, .kb-chips, .alt-menu, .sugg, li.swipe-row.swiped";   // the swipe back's own list, less what only a finger drags (a set track, the week strip: where one really scrolls, its scroll keeps the fingers) and the fields (two fingers select nothing)
  let wgNatural = true;                                             // natural scrolling (the Mac's default: the page moves with the fingers), from the latest wheel event
  let calWheel = null, dpWheel = null, calPage = null, calBusy = () => false, calForget = () => {};                              // the client page's month and the day picker's months, for two fingers: { begin, move, end }, set where each pager lives
  let weekWheel = null, weekPage = null, weekBusy = () => false, weekForget = () => {}, weekLand = () => false;   // the client page's week strip, as its month: two fingers, a turn, a slide under way, a press let go of, a slide still landing landed at once (true if one was)
  function monthLetGo(kind, x, w) {                                  // a month let go x px from where it rests (+ = toward the month before): -1 the month before, 1 the next, 0 back. The client page's month goes on past 48 px, as it always has under a finger; the day picker's to the nearer month, as UIKit's pager does (a flick, a finger's speed or two fingers' coasting, has carried it on by then)
    const past = kind === "cal" ? Math.abs(x) > 48 : Math.abs(x) > Math.max(1, w) / 2;
    return past ? (x > 0 ? -1 : 1) : 0;
  }
  const monthWheel = (el) => (!el || !el.closest ? null : el.closest("#pvBox") ? (pv && !pvNested() ? pvWheel : null) : el.closest("#dpGrid") ? (dp ? dpWheel : null) : el.closest("#calView") && !held() ? calWheel : el.closest("#weekView") && !held() && !calOpen ? weekWheel : null);   // two fingers over a month: they page it (his pick, 9 Nov, "do what Apple would do": as a finger does on the phone, as two fingers page Calendar's days and weeks on the Mac)
  const canScrollX = (n, ax) => ((wgNatural ? ax < 0 : ax > 0) ? n.scrollLeft + n.clientWidth < n.scrollWidth - 1 : n.scrollLeft > 0);   // fingers this way (ax) scroll n toward its end, or toward its start: can it still go?
  const sideScroller = (el, ax) => { for (let n = el; n && n !== document.body && n.nodeType === 1; n = n.parentElement) { const cs = getComputedStyle(n); if (/(auto|scroll)/.test(cs.overflowX) && n.scrollWidth > n.clientWidth + 1 && canScrollX(n, ax)) return true; } return false; };
  const wheelBack = (el, ax) => (wgNatural ? ax > 0 : ax < 0) && (swipeOn || deskOn) && canBack() && !held() && !el.closest(NO_WHEEL_BACK) && !sideScroller(el, ax) && !(document.activeElement && el.closest("input, textarea") === document.activeElement && canScrollX(document.activeElement, ax));   // (the field being typed in keeps the fingers while its text can still scroll that way, as Safari's own swipe leaves it)
  const wgMine = (el, ax) => !!rs || !!(el && el.closest && (el.closest("li.swipe-row") || wheelBack(el, ax) || monthWheel(el)));   // a sideways start the app may take: kept from the browser while undecided
  function wheelKind(el, ax) {                                      // what this sideways swipe moves: "row", "back", "month" or nothing of the app's
    if (!el || !el.closest || sideScroller(el, ax)) return null;
    if (monthWheel(el)) { if (rs) rsSettle(rs, 0, 0); return "month"; }   // a month under the fingers (the day picker's too: its sheet holds all the rest)
    if (held()) return null;
    const li = el.closest("li.swipe-row");
    if (rs && li === rs.li) return "row";
    if (rs) rsSettle(rs, 0, 0);                                     // an open row elsewhere closes
    if (li && ax < 0) return "row";
    if (wheelBack(el, ax)) return "back";
    return null;
  }
  const wgSpeed = (g) => { const a = g.ev, n = a.length; if (n < 3) return null; const span = a[n - 1][0] - a[0][0]; let s = 0; for (let i = 1; i < n; i++) s += a[i][1]; return span > 0 ? s / span : null; };   // px per ms over the last events (up to four intervals: one event's speed jumps with Safari's whole pixels and its frames)
  function wgFresh(g, now, fx, ax, ay) {                            // within the gap: is this new fingers, a gesture of its own?
    const run = (ok) => { let s = 0; for (let i = g.ev.length - 1; i >= 0 && ok(g.ev[i]); i--) s += g.ev[i][1]; return s; };   // the sideways travel of the latest events that all pass ok
    if (g.axis === "y") { const k = Math.max(2, 2 * g.sx / g.sy); let n = 0; for (let i = g.ev.length - 1; i >= 0 && g.ev[i][1] > k * g.ev[i][2]; i--) n++; return n >= 3 && run((v) => v[1] > k * v[2]) >= 2; }   // new fingers on a scroll: three events in a row, each twice as sideways as the scroll began (never under 2:1). WebKit speeds up each axis of the coasting on its own (MomentumEventDispatcher), so a slanted scroll's own events lean further sideways: they stay that scroll
    if (g.axis === "none") return (ay > ax && ay >= 2) || (fx * g.dir < 0 && run((v) => v[3] * g.dir < 0) >= 2);   // up or down, or back the other way
    if (!g.done) return false;                                      // fingers still on the app's swipe: whichever way they go, it follows
    if (ay > ax && ay >= 2) return true;                            // up or down: a scroll
    if (fx * g.dir < 0 && run((v) => v[3] * g.dir < 0) >= 2) return true;   // the other way: coasting never turns
    const s = wgSpeed(g); if (s == null) return false;
    if (g.spent != null && !g.slowed) { g.spent = Math.max(g.spent, s); if (s < g.spent * 0.7) g.slowed = true; else return false; }   // spent while its own fingers were still speeding up: judged once it has slowed, as a let-go one always has (fingers that speed up are its own until then, never new ones)
    if (now - g.doneAt > 30 && run(() => true) >= 3 && s > g.minS * 1.6) return true;   // speeding up again
    g.minS = Math.min(g.minS, s); return false;
  }
  function wheelLetGo(g, how) {                                     // how: "rest" (the events stopped), "coast" (the page slowed past its point), "edge" (all the way over, or the row at its stop)
    if (g.done) return; g.done = true; g.doneAt = g.last; clearTimeout(g.timer);
    if (g.kind === "row") { if (how === "rest" && g.r && rs === g.r) rsLetGo(g, g.last + WG_END, false, true); }   // by where it is (it rested): open past half the actions, else closed
    else if (g.kind === "month") { if (g.m) g.m.end(); }             // by a finger's rule from where it is (the coasting carried it on, as a flick would)
    else if (g.kind === "back" && sw && sw.wheel && sw.on && !sw.busy) endSwipe(false, how === "rest" ? g.last + WG_END : g.last);
    if (how === "rest" && wg === g) wg = null;                      // movement after a rest is a new gesture
    rsFlush();
  }
  function wheelStep(g, now, step) {                                // the fingers' (or the coasting's) travel since the last event, + to the right
    if (step) g.dir = Math.sign(step);
    if (g.kind === "month") {
      const sp = wgSpeed(g); if (sp != null && sp > g.peak) g.peak = sp;   // its top speed so far
      if (!g.m || g.m.move(wgNatural ? step : -step)) { if (sp == null || sp >= g.peak * 0.7) g.spent = 0; wheelLetGo(g, "edge"); return; }   // a whole month over at speed (the fingers, not yet their coasting): spent, so those same fingers are never taken for new ones that would page a second month; once slowed, a new flick is new   // the months go the page's way (natural scrolling or not, as Safari's own swipe goes); a whole month over: it settles there, and the rest of the gesture moves nothing
    } else if (g.kind === "row") {
      const r = g.r; if (!r || rs !== r) { g.done = true; return; }
      const x = Math.max(0, Math.min(r.w, r.x - step)); rsSample(g, now, x);
      if (x >= r.w || (x <= 0 && step > 0)) {                       // at its open width (or closed): it stays there, and nothing more moves it
        const v = rsSpeed(g, now);
        if (x <= 0 || !(r.x === x && !r.busy && r.open)) rsSettle(r, x > 0 ? r.w : 0, v);   // (a row brought to closed always settles: its grey goes)
        wheelLetGo(g, "edge"); return;
      }
      rsPaint(r, x, null);
    } else {
      if (!sw || !sw.wheel || !sw.on || sw.busy) { g.done = true; return; }
      const ps = wgNatural ? step : -step;                           // the page's own way: Safari's back follows the page, natural scrolling or not (fingers to the left with it off)
      sw.dx = Math.max(0, sw.dx + ps); sw.pts.push([now, sw.dx]); if (sw.pts.length > 3) sw.pts.shift(); paintSwipe(null);
      if (sw.dx >= sw.w) { wheelLetGo(g, "edge"); return; }        // all the way over: no need to wait
      const s = ps > 0 ? wgSpeed(g) : null;
      if (s != null) {
        if (s > g.peak) { g.peak = s; g.peakAt = now; }
        else if (now - g.peakAt >= 50 && s < g.peak * 0.7 && sw.dx > Math.min(187.5, sw.w / 2)) { wheelLetGo(g, "coast"); return; }   // past its point of no return and slowing: it goes
      }
    }
    clearTimeout(g.timer); g.timer = setTimeout(() => wheelLetGo(g, "rest"), WG_END);
  }
  document.addEventListener("wheel", (e) => {
    if (e.ctrlKey) return;                                           // a pinch
    if (e.deltaMode !== 0 || (e.shiftKey && !e.deltaY)) { if (rsFree() && rs.open) rsSettle(rs, 0, 0); return; }   // a mouse wheel: never a swipe (Safari's own swipe never takes one); it scrolls, so an open row closes. Safari sends a wheel in pixels too (lines x 40), sideways with Shift
    const now = e.timeStamp, fx = fingerX(e), ax = Math.abs(e.deltaX), ay = Math.abs(e.deltaY); wgNatural = e.webkitDirectionInvertedFromDevice !== false;
    let g = wg;
    if (g && g.axis && now - g.last <= WG_GAP) {
      g.ev.push([now, ax, ay, fx]); if (g.ev.length > 5) g.ev.shift();
      if (!wgFresh(g, now, fx, ax, ay)) {                            // the same gesture
        g.last = now;
        if (g.axis !== "x") { if ((g.axis === "y" ? ax > Math.max(2, 2 * g.sx / g.sy) * ay : fx * g.dir < 0) && wgMine(e.target, fx)) e.preventDefault(); return; }   // up or down, or sideways but not the app's: the browser's. A move that may be new fingers the app would take is kept from Safari meanwhile: Safari starts its own swipe only on a gesture's first event, and lets the page cancel none of the rest once that one went through
        e.preventDefault();
        if (!g.done) wheelStep(g, now, fx);                         // once let go, the rest of it (its coasting) is spent, never the next page's
        return;
      }
    }
    if (g && !g.done && g.axis === "x") wheelLetGo(g, "rest");
    if (!g || g.axis || now - g.last > WG_GAP) g = wg = { last: now, sx: 0, sy: 0, ax: 0, axis: null, kind: null, dir: 0, done: false, doneAt: 0, timer: null, r: null, li: null, pts: [], ev: [], peak: 0, peakAt: now, minS: Infinity };
    g.last = now; g.ev.push([now, ax, ay, fx]); if (g.ev.length > 5) g.ev.shift();
    g.sx += ax; g.sy += ay; g.ax += fx;
    if (g.sx + g.sy < RS_HOLD) { if (g.sx > g.sy && wgMine(e.target, g.ax)) e.preventDefault(); else if (ay >= 4 && ay > 2 * ax && rsFree() && rs.open) rsSettle(rs, 0, 0); return; }   // not decided yet: a sideways start the app may take is kept from the browser meanwhile (a clear step up or down, a mouse wheel's notch, closes an open row at once)
    g.axis = g.sx > g.sy * 2 ? "x" : "y";
    if (g.axis === "y") { if (rsFree() && rs.open) rsSettle(rs, 0, 0); return; }   // a scroll: the page's (an open row closes, settled or still settling)
    const el = e.target; g.dir = Math.sign(g.ax); g.kind = wheelKind(el, g.ax); if (!g.kind) { g.axis = "none"; return; }
    if (g.kind === "row") {
      const li = (rs && rs.li.contains(el)) ? rs.li : el.closest("li.swipe-row"), r = li && rsBegin(li);   // the row under the event that decided (one a redraw replaced since the first is gone)
      if (!r) { g.axis = "none"; return; }
      g.r = r; g.li = li; rsSample(g, now, r.x);
    } else if (g.kind === "month") {
      const m = monthWheel(el); if (!m || !m.begin()) { g.axis = "none"; return; }   // (a finger or the mouse already on it: theirs)
      g.m = m;
    } else {
      if (sw && (sw.on || sw.busy)) { g.axis = "x"; g.done = true; g.doneAt = now; g.spent = 0; e.preventDefault(); return; }   // the page still settling from the last one: this swipe back is spent (as UIKit takes none mid-transition), its rest kept from Safari, and the next one is new fingers by the let-go rules
      { const a = document.activeElement; if (a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) && a.blur) { a.blur(); document.body.classList.remove("typing"); if (kbTarget) hideKb(); } }   // the field typed in is let go first, its value kept, as a click elsewhere does (and the typing look with it, and the keyboard's bar of keys: this page's tab bar slides with the page)
      sw = { x0: 0, y0: 0, sy: Number(window.scrollY) || 0, dx: 0, on: false, held: true, edge: false, pts: [[now, 0]], flick: false, wheel: true };
      startSwipe();
    }
    e.preventDefault();
    wheelStep(g, now, g.ax);                                         // the event that decided carries all the travel so far
  }, { passive: false });
  // ---------- render ----------
  // ---- keyboard bar (above the phone keyboard): 123/ABC switch, quick entries, Next/Done. The number keypad on iPhone has no Return key.
  const kbbar = $("kbbar"), kbMode = kbbar.querySelector(".kb-mode"), kbChips = kbbar.querySelector(".kb-chips"), kbNextBtn = kbbar.querySelector(".kb-next"), kbDone = kbbar.querySelector(".kb-done");
  let kbTarget = null;
  const kbKind = (el) => {
    if (!el || el.tagName !== "INPUT" || el.readOnly) return "";
    if (el.closest(".boxes")) return "weights";
    if (el.closest(".setlog")) return el.classList.contains("w") ? "weights" : "repsdone";
    if (el.classList.contains("sum-w")) return "weights"; if (el.classList.contains("sum-r")) return "repsdone";   // the opened finished card's set lines
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
    const ins = [...block.querySelectorAll(".setlog")].filter((sl) => !sl.hidden && sl.offsetParent !== null).flatMap((sl) => sl.classList.contains("timed") ? [sl.querySelector(".rp"), sl.querySelector(".w")] : [sl.querySelector(".w"), sl.querySelector(".rp")]);   // the order on screen: a hold shows Time first
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
    const unitChip = (u) => chip(u, () => { const v = kbTarget.value.trim().replace(/\s*(sec|s|min|m)$/i, ""); if (v) kbSet(v + " " + u, true); }); // 60 → 60 sec, 4 min → 4 sec, 40 → 40 m
    if (kind === "weights") { chip("Bodyweight", () => kbSet("BW")); if (!t.closest(".setlog") && !t.classList.contains("sum-w")) unitChip("sec"); }   // the key says the word the box will show   // the set log has its own Time box: seconds never go in the weight
    const sideChip = (w) => chip(w, () => { const v = kbTarget.value.trim().replace(/\s*(\/|each|per)\s*(side|leg|arm)$/i, ""); if (v) kbSet(v + " " + w, true); });   // 7 → "7 / side"
    if (kind === "reps") { sideChip("/ side"); unitChip("sec"); unitChip("m"); }
    if (kind === "tempo") { chip("X", () => kbInsert("X")); for (const w of ["Normal", "Controlled", "Slow"]) chip(w, () => kbSet(w, true)); for (const c of ["3010", "4010", "10X0", "41X0"]) chip(c, () => kbSet(c, true)); }
    if (kind === "rest") { unitChip("sec"); unitChip("min"); }
    kbNextBtn.hidden = !kbSibling(t);                                                      // Next only while another box of this exercise, superset or giant set is left; the check is always there
  }
  function showKb(el) {
    kbTarget = el; paintKb(); kbbar.hidden = false; placeKb(); $("draftBar").classList.add("kb"); document.body.classList.add("kb");   // (the bar at the foot gives it the bottom, on a computer too: index.html)
    if (window.visualViewport) { window.visualViewport.addEventListener("resize", placeKb); window.visualViewport.addEventListener("scroll", placeKb); }
  }
  function hideKb() {
    kbTarget = null; kbbar.hidden = true; $("draftBar").classList.remove("kb"); document.body.classList.remove("kb");
    if (window.visualViewport) { window.visualViewport.removeEventListener("resize", placeKb); window.visualViewport.removeEventListener("scroll", placeKb); }
  }
  kbbar.addEventListener("pointerdown", (e) => e.preventDefault()); // taps on the bar must not take focus (and the keyboard) away from the box
  kbbar.addEventListener("mousedown", (e) => e.preventDefault());
  kbMode.addEventListener("click", () => {
    const t = kbTarget; if (!t) return;
    const text = t.inputMode !== "text";
    const group = t.closest(".boxes") ? [...t.closest(".boxes").children] : [t];
    for (const b of group) b.inputMode = text ? "text" : "decimal";
    kbSwitching = true; t.blur(); setTimeout(() => { t.focus(); setTimeout(() => { kbSwitching = false; }, 60); }, 50);   // the phone reads the keyboard type when the box takes focus; that blur is not a leave
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
    if (tc && (tc.templatesVersion || 0) >= TEMPLATES_VERSION) { adoptBuiltins(); return; }   // the built-in programs as his folders (v281), once per account
    S.seeding = true; let added = [];
    try { added = (await seedTemplatesNow(tc)) || []; } finally { S.seeding = false; }
    const now2 = clients.get(TEMPLATES_ID); if (now2 && now2.builtinsAdopted && added.length) adoptBuiltins(new Set(added));   // after it: only the templates a reseed has just added, into their weeks
  }
  async function seedTemplatesNow(tc) {
    let list;
    try { const res = await fetch("templates.json", { cache: "no-store" }); if (!res.ok) return; list = await res.json(); } catch { return; }
    if (!tc) { tc = { id: TEMPLATES_ID, name: "Templates", notes: "", email: "", unit: "lb", createdAt: now(), kind: "templates" }; clients.set(tc.id, tc); }
    const fresh = [], added = [];
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
      trainings.set(t.id, t); fresh.push(t); added.push(t.id);
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
    return added;                                               // the templates it added: adoptBuiltins files them in their weeks
  }
  function templateMeta(t) { return t.template || { program: MY_TEMPLATES, phase: 0, stage: 0, n: 0, phaseName: "" }; }
  function templateTitle(t) { const m = templateMeta(t); return (m.n ? "Workout " + m.n : "") + (t.title ? (m.n ? " \u00b7 " : "") + t.title : "") || "Template"; }
  function templatePath(T) { const m = templateMeta(T), h = tplHome(T); if (h) { const names = []; for (let x = h, i = 0; x && i < 3; x = tplNode(x.parent), i++) names.unshift(x.name); return [...names, m.n ? "Workout " + m.n : (T.title || "")].filter(Boolean).join(" \u00b7 "); } return [m.program, m.phase ? "Phase " + m.phase : "", m.stage ? "Week " + m.stage : "", m.n ? "Workout " + m.n : (T.title || "")].filter(Boolean).join(" \u00b7 "); }   // a phase's stages read as weeks (his ask, 12 Nov: "rename every stage to week"); the data keeps its "stage"; one in his own folders reads its folder, subfolder and slide names, as a program's path reads its phase and week (12 Nov)
  // ---- his own template folders (his ask, 12 Nov: "folders and subfolders and the week slider ... how I can create those myself", "should
  // look exactly like templates I already have"): one list of nodes on the Templates record. A folder sits at the top, or inside a top folder
  // (two deep at most, as a program and its phases); a slide, named by him ("instead of automatically new week"), belongs to a folder, as a
  // week to a phase. A template lives in a folder or a slide by its template.folder; one whose folder or slide is gone is loose again.
  let nodesMemo = null;                                              // the list read once per change of it (a new list, or a longer one): every row of the Templates pages asks for its folder
  const tplNodes = () => {
    const raw = (clients.get(TEMPLATES_ID) || {}).folders || [];
    if (nodesMemo && nodesMemo.raw === raw && nodesMemo.len === raw.length) return nodesMemo.list;
    const list = readNodes(raw); nodesMemo = { raw, len: raw.length, list, byId: new Map(list.map((f) => [f.id, f])) }; return list;
  };
  const readNodes = (raw) => {
    const all = raw.filter((f) => f && f.id && typeof f.name === "string" && (f.kind === "folder" || f.kind === "slide"));
    const folders = new Map(all.filter((f) => f.kind === "folder").map((f) => [f.id, f])), top = (f) => !f.parent || f.parent === f.id || !folders.has(f.parent);
    return all.filter((f) => f.kind === "folder" || folders.has(f.parent)).map((f) => (f.kind === "folder" && f.parent && (top(f) || !top(folders.get(f.parent))) ? { ...f, parent: null } : f));   // a folder whose folder went (deleted on another device), or one that would sit deeper than two (or in a ring, two devices' moves crossing), stands at the top; a slide whose folder went goes with it
  };
  const tplNode = (id) => { if (!id) return null; tplNodes(); return nodesMemo.byId.get(id) || null; };
  const ordOf = (f) => (typeof f.sort === "number" && isFinite(f.sort) ? f.sort : Infinity);
  const tplKids = (pid, kind) => tplNodes().filter((f) => (f.parent || null) === (pid || null) && f.kind === kind).sort((x, y) => (ordOf(x) === ordOf(y) ? 0 : ordOf(x) < ordOf(y) ? -1 : 1) || String(x.at || "").localeCompare(String(y.at || "")) || String(x.id).localeCompare(String(y.id)));   // in the order he put them in (Reorder folders: sort), then the order made (a new one last), the same on every device (a merge may list another device's new one first)
  const tplHome = (t) => { const m = templateMeta(t); return tplNode(m.folder) || (m.program && m.program !== MY_TEMPLATES ? tplNode("b:" + m.program + "/" + m.phase + "/" + m.stage) : null); };   // the folder or slide a template is in: the one it names, else, for a built-in program's template, its week's slide once the programs are folders (adoptBuiltins: his ask, 12 Nov, "all the functions need to work on every single template including the ones I already have")
  const tplTree = (fid) => { const ids = new Set([fid]); for (const f of tplNodes()) if (f.kind === "folder" && f.parent === fid) ids.add(f.id); for (const f of tplNodes()) if (f.kind === "slide" && ids.has(f.parent)) ids.add(f.id); return ids; };   // a folder, its folders and their slides
  const tplIn = (ids) => [...trainings.values()].filter((t) => isTemplateClient(t.clientId) && ids.has((tplHome(t) || {}).id));
  const byN = (x, y) => (Number(templateMeta(x).n) || 0) - (Number(templateMeta(y).n) || 0) || byMade(x, y);   // a place's templates in their order: Workout 1, 2 …
  const tplPlaces = (fid) => [fid, ...tplKids(fid, "slide").map((x) => x.id), ...tplKids(fid, "folder").flatMap((x) => tplPlaces(x.id))];   // a folder's own, its slides, then its folders', in the order shown
  const shownSlide = (v) => { const sl = tplKids(v.folder, "slide"); return ((sl.find((x) => x.id === v.slide) || sl[0]) || {}).id || ""; };   // the slide a folder's page shows: the one named, else its first
  const lastSlide = new Map();                                         // folder id -> the slide its page was left on: Back from a folder inside it lands there again
  const tplUp = (fid) => { const p = tplPage(fid), s = p.folder && lastSlide.get(p.folder); return s && tplKids(p.folder, "slide").some((x) => x.id === s) ? { ...p, slide: s } : p; };   // up to a folder, on the slide it was left on (keep runBack and backKey in step)
  const tplSlide = (f) => { const sl = tplKids(f.id, "slide"); return sl.find((x) => x.id === S.view.slide) || sl[0] || null; };   // the slide shown on a folder's page
  const tplHere = (f) => { const sl = tplKids(f.id, "slide"), cur = tplSlide(f); return (cur ? [...tplIn(new Set([cur.id])), ...(cur === sl[0] ? tplIn(new Set([f.id])) : [])] : tplIn(new Set([f.id]))).sort(byN); };   // the templates a folder's page shows: the slide shown (the first also has what is in the folder itself), or the folder's own, in their order
  const weekName = (f) => (tplSlide(f) || f).name;                   // what "Use all" adds, by its name: the slide shown ("Week 1"), or the folder
  const nextN = (place) => 1 + Math.max(0, ...[...trainings.values()].filter((t) => isTemplateClient(t.clientId) && ((tplHome(t) || {}).id || null) === (place || null) && (place || templateMeta(t).program === MY_TEMPLATES)).map((t) => Number(templateMeta(t).n) || 0));   // the next "Workout N" in a place (loose: among My templates)
  const saveFolders = () => { tplClient(); scheduleSave("clients", TEMPLATES_ID); };
  const placeTemplate = (t, place) => {                                // a template into a folder or a slide, or loose again (place null), numbered next there; saved past a clean template draft, never into it
    const m = { ...templateMeta(t) }; if (place) m.folder = place; else delete m.folder;
    if (!place && m.program !== MY_TEMPLATES) { m.program = MY_TEMPLATES; m.phase = 0; m.stage = 0; delete m.phaseName; }
    m.n = nextN(place); t.template = m; tidySave(t);
  };
  async function newFolder(parent) {
    const name = await askName("New folder"); if (!name) return;
    const tc = tplClient(), f = { id: uid(), name, parent: parent || null, kind: "folder", at: now() };
    tc.folders = [...(tc.folders || []), f]; folderTouched.set(f.id, TEMPLATES_ID); saveFolders(); render();
  }
  async function newSlide(fid) {
    const name = await askName("New slide"); if (!name || !tplNode(fid)) return;
    const tc = tplClient(), sl = { id: uid(), name, parent: fid, kind: "slide", at: now() }, first = !tplKids(fid, "slide").length;
    tc.folders = [...(tc.folders || []), sl]; folderTouched.set(sl.id, TEMPLATES_ID);
    if (first) for (const t of tplIn(new Set([fid])).sort(byN)) placeTemplate(t, sl.id);   // the folder's first slide takes the templates that were in the folder itself, in their order
    saveFolders();
    if (S.view.name === "client" && isTemplateClient(S.view.id) && S.view.folder === fid) { S.view = { ...S.view, slide: sl.id }; lsSet("fiala.trainings.view", S.view); nav.curKey = screenKey(); }   // the new slide is the one shown
    render();
  }
  async function renameNode(id) {
    const f = tplNode(id); if (!f) return;
    const name = await askName(f.kind === "slide" ? "Rename slide" : "Rename folder", f.name, "Save"); if (!name || name === f.name || !tplNode(id)) return;
    const tc = tplClient(); tc.folders = (tc.folders || []).map((x) => (x && x.id === id ? { ...x, name } : x)); folderTouched.set(id, TEMPLATES_ID); saveFolders(); render();
  }
  async function deleteNode(id) {                                     // asked first; what was in it goes loose to My templates (his pick, 12 Nov), nothing is lost
    const f = tplNode(id); if (!f) return;
    let gone = f.kind === "slide" ? new Set([id]) : tplTree(id); const inside = tplIn(gone).length, what = f.kind === "slide" ? "slide" : "folder";
    const within = [...gone].map(tplNode).filter((x) => x && x.id !== id), subs = within.filter((x) => x.kind === "folder").length, sls = within.length - subs;
    const kinds = [subs && (subs === 1 ? "folder" : "folders"), sls && (sls === 1 ? "slide" : "slides")].filter(Boolean).join(" and "), too = kinds ? "Its " + kinds + (within.length === 1 ? " goes" : " go") + " too" : "";
    const moves = inside ? (inside === 1 ? "its template moves to My templates" : "its " + inside + " templates move to My templates") : "";
    const text = too && moves ? too + ", and " + moves + "." : too ? too + "." : moves ? "I" + moves.slice(1) + "." : "The " + what + " is empty.";   // what goes with it, and where its templates go
    if (!(await askFirst({ title: "Delete \u201c" + f.name + "\u201d?", text }))) return;
    if (!tplNode(id)) return;                                         // a sync took it away while the question was up
    gone = f.kind === "slide" ? new Set([id]) : tplTree(id); const up = tplNode(id).parent || null;   // read again: a sync may have brought a folder or a slide into it while the question was up
    for (const pl of f.kind === "slide" ? [id] : tplPlaces(id)) for (const t of tplIn(new Set([pl])).sort(byN)) placeTemplate(t, null);   // after the loose ones, in the order they were shown
    const tc = tplClient(); tc.folders = (tc.folders || []).filter((x) => !(x && gone.has(x.id))); for (const g of gone) { deletedFolders.set(g, TEMPLATES_ID); folderTouched.delete(g); }
    saveFolders();
    if (S.view.name === "client" && isTemplateClient(S.view.id) && S.view.folder && gone.has(S.view.folder)) { go(tplUp(up), true); return; }   // its own page went: up to where it was
    if (S.view.slide && gone.has(S.view.slide)) { S.view = { ...S.view, slide: null }; lsSet("fiala.trainings.view", S.view); nav.curKey = screenKey(); }
    render();
  }
  const tplPage = (fid) => (fid && tplNode(fid) ? { name: "client", id: TEMPLATES_ID, folder: fid } : { name: "client", id: TEMPLATES_ID });
  const tplPageOn = () => S.view.name === "client" && isTemplateClient(S.view.id) && !S.clientMode && !pickFor && !S.view.program;   // the Templates page or a folder of his: his "…" and his +
  function tplMoreItems() {                                           // the "…" on the Templates pages: what changes what is there (his ask, 12 Nov: "split it in 2 buttons ... one 3 dots that will have for now just reorder"): Reorder; in a folder, its folders' Reorder, the slide shown's Rename and Delete, the folder's Rename and, last and red, Delete
    if (!tplPageOn()) return [];
    const f = tplNode(S.view.folder), items = [];
    if (!f) { if (tplRootList().length > 1) items.push({ label: "Reorder", icon: MI.reorder, onPick: () => { tplOrdering = ""; render(); } }); return items; }   // the Templates page: the whole Programs list, the built-in programs too (his ask, 12 Nov: "in this slide I should have already been able to see reorder")
    if (tplHere(f).length > 1) items.push({ label: "Use for a client", icon: MI.calendar, onPick: () => useWeekFor(f.id) });   // the whole slide shown into a client's calendar (his ask, 12 Nov: "add the whole folder / slide to the calendar")
    if (tplKids(f.id, "folder").length > 1) items.push({ label: "Reorder folders", icon: MI.reorder, onPick: () => { tplOrdering = f.id; render(); } });   // two folders or more in this folder
    const sl = tplSlide(f);
    if (sl) items.push({ label: "Rename slide", icon: MI.pencil, onPick: () => renameNode(sl.id) });
    items.push({ label: "Rename folder", icon: MI.pencil, onPick: () => renameNode(f.id) });
    if (folderPlaces(f).length) items.push({ label: "Move folder", icon: MI.folder, onPick: () => moveFolder(f.id) });   // as its row's Move to, which only a gesture or a right-click reaches (the v283 review)
    if (sl) items.push({ label: "Delete slide", icon: MI.trash, danger: true, onPick: () => deleteNode(sl.id) });
    items.push({ label: "Delete folder", icon: MI.trash, danger: true, onPick: () => deleteNode(f.id) });
    return items;
  }
  function tplAddItems() {                                            // the "+" beside it: everything he can add there (his ask, 12 Nov: "another one with + and that one will have all the things I can add ... it will also have add template"): a template where he is (as the round + at the foot), a folder (at the top and inside a top folder), a slide in a folder
    if (!tplPageOn()) return [];
    const f = tplNode(S.view.folder), items = [{ label: "New template", icon: MI.docPlus, onPick: () => newTemplateHere() }];
    if (!f || !f.parent) items.push({ label: "New folder", icon: MI.folderPlus, onPick: () => newFolder(f ? f.id : null) });
    if (f) items.push({ label: "New slide", icon: MI.slidePlus, onPick: () => newSlide(f.id) });
    return items;
  }
  let tplOrdering = null;                                             // the page whose folders he is putting in order: "" the Templates page, else the folder's id (Reorder folders, his pick 12 Nov: like the Clients list's Reorder, his folders only)
  const tplOrderOn = () => tplOrdering !== null && tplPageOn() && tplOrdering === (S.view.folder || "");   // grips on his folders, Done at the top right, no "…" and no +
  const doneTplOrder = () => { tplOrdering = null; render(); };      // Done: the page as it was, in the new order
  function adoptBuiltins(which) {                                     // which: none = the account's one adoption (on a copy the sync refreshed, claiming nothing: another device's renames, reorders and deletes win a merge; the v281 review's catch); a Set of template ids = those a reseed just added; "all" = every built-in template with no week (after a restore). The built-in programs as folders like his own (his ask, 12 Nov: "all the functions need to work on every single template including the ones I already have"): a folder for each program, one in it for each phase, a slide for each week. Their ids are made from their names ("b:Fat Burn/1/2"), so every device makes the very same folders; the templates are not touched (each finds its week: tplHome). Run once the server's copy is in (seedTemplates)
    if (S.clientMode) return false;
    const tc = clients.get(TEMPLATES_ID); if (!tc) return false;
    if (!which && (tc.builtinsAdopted || dirty.has(key("clients", TEMPLATES_ID)))) return false;   // once per account, and only on a copy with nothing of this device's waiting (the merge first brings in what another device did)
    const need = clientTrainings(TEMPLATES_ID).filter((t) => { const m = templateMeta(t); return m.program && m.program !== MY_TEMPLATES && !tplHome(t) && (!which || which === "all" || which.has(t.id)); });
    if (!need.length) { if (!which && !tc.builtinsAdopted) { tc.builtinsAdopted = 1; scheduleSave("clients", TEMPLATES_ID); } return false; }
    const have = new Set((tc.folders || []).filter((x) => x && x.id).map((x) => x.id)), add = [];
    const stamp = (k) => new Date(Date.UTC(2000, 0, 1) + k * 1000).toISOString();   // made, by the clock of no device: the programs in their usual order, phases and weeks by their numbers
    const put = (n) => { if (!have.has(n.id) && !deletedFolders.has(n.id)) { have.add(n.id); add.push(n); } };
    for (const t of need) {
      const m = templateMeta(t), P = "b:" + m.program, F = P + "/" + m.phase;
      const pn = (need.find((x) => templateMeta(x).program === m.program && templateMeta(x).phase === m.phase && templateMeta(x).phaseName) || { template: {} }).template.phaseName || "";
      put({ id: P, name: String(m.program), parent: null, kind: "folder", at: stamp(progRank(m.program)) });
      put({ id: F, name: "Phase " + m.phase + (pn ? " \u00b7 " + pn : ""), parent: P, kind: "folder", at: stamp(1000 + (Number(m.phase) || 0)) });
      put({ id: F + "/" + m.stage, name: "Week " + m.stage, parent: F, kind: "slide", at: stamp(2000 + (Number(m.stage) || 0)) });
    }
    if (!add.length) return false;
    tc.folders = [...(tc.folders || []), ...add]; tc.builtinsAdopted = 1;
    if (which) for (const n of add) folderTouched.set(n.id, TEMPLATES_ID);   // a reseed's or a restore's: new here, kept by a merge (the account's one adoption claims nothing)
    saveFolders(); renderUnlessSwiping(); return true;                   // (from inside a sync: never the row under a finger rebuilt)
  }
  const tplRootList = () => {                                        // the Programs list on the Templates page: his top folders and the built-in programs, in the order he put them (Reorder: rootOrder on the Templates record), else his folders first, then the programs; one not in that order yet (a folder made since, a new program) after those that are
    const progs = [...new Set(clientTrainings(TEMPLATES_ID).filter((t) => !tplHome(t)).map((t) => templateMeta(t).program))].filter((p) => p !== MY_TEMPLATES).sort((x, y) => progRank(x) - progRank(y) || String(x).localeCompare(String(y)));
    const tops = tplKids(null, "folder"), isB = (x) => String(x.id).startsWith("b:");
    const all = [...tops.filter((x) => !isB(x)).map((x) => ({ key: x.id, folder: x })), ...tops.filter(isB).map((x) => ({ key: x.id, folder: x })), ...progs.map((p) => ({ key: "p:" + p, prog: p }))];   // his own folders, then the programs (made folders: their fixed times keep the usual order), then any not yet
    const ord = (clients.get(TEMPLATES_ID) || {}).rootOrder; if (!Array.isArray(ord)) return all;
    const at = new Map(ord.map((k, i) => [k, i])); for (const [k, i] of [...at]) if (String(k).startsWith("p:") && !at.has("b:" + String(k).slice(2))) at.set("b:" + String(k).slice(2), i);   // an order from before the programs were folders names each "p:": the same place as a folder
    return all.map((e, i) => [e, at.has(e.key) ? at.get(e.key) : ord.length + i]).sort((a, b) => a[1] - b[1]).map((x) => x[0]);
  };
  function moveRootTo(key, j) {                                       // a program or a folder of his let go in a new place in the Programs list: the whole order kept on the Templates record (a field of it, merged as its other fields are)
    const list = tplRootList(), i = list.findIndex((e) => e.key === key);
    if (i >= 0 && j >= 0 && j < list.length && i !== j) { const [m] = list.splice(i, 1); list.splice(j, 0, m); tplClient().rootOrder = list.map((e) => e.key); folderTouched.set(":rootOrder", TEMPLATES_ID); scheduleSave("clients", TEMPLATES_ID); }   // marked as this device's (the key ":rootOrder" beside the folders' ids): a merge keeps the server's order unless this device changed it
    render();
  }
  function moveFolderTo(id, j) {                                      // a folder of his let go in a new place among its own: the order kept on the folders, each one that moved marked as this device's for a merge
    const n = tplNode(id), list = n ? tplKids(n.parent, "folder") : [], i = list.findIndex((x) => x.id === id);
    if (i >= 0 && j >= 0 && j < list.length && i !== j) {
      const [m] = list.splice(i, 1); list.splice(j, 0, m);
      const pos = new Map(list.map((x, k) => [x.id, k])), tc = tplClient();
      tc.folders = (tc.folders || []).map((x) => { if (!x || !pos.has(x.id) || x.sort === pos.get(x.id)) return x; folderTouched.set(x.id, TEMPLATES_ID); return { ...x, sort: pos.get(x.id) }; });
      saveFolders();
    }
    render();
  }
  const pageMoreItems = () => (S.view.name === "training" ? moreItems(trainings.get(S.view.id)) : tplMoreItems());   // the "…" at the top right, whichever page has one
  function newTemplateHere() {                                        // the round glass + on the Templates pages (his ask, 12 Nov: "for the actual workout keep the plus button as we have for adding workouts in clients view"): a new template where he is, opened
    const f = tplNode(S.view.folder), place = f ? (tplSlide(f) || f).id : null;
    const t = { id: uid(), clientId: TEMPLATES_ID, date: "2026-01-01", createdAt: now(), title: "", completedAt: null, skippedAt: null, template: { program: MY_TEMPLATES, phase: 0, stage: 0, n: nextN(place), ...(place ? { folder: place } : {}) }, rows: [] };
    tplClient(); trainings.set(t.id, t); scheduleSave("trainings", t.id, 0); tplFresh = t.id; go({ name: "training", id: t.id });
  }
  let tplFresh = null;                                                // the template the round + just made: left empty, it goes (go())
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
  const growBox = (ta) => { ta.style.height = "auto"; ta.style.height = Math.max(96, ta.scrollHeight) + "px"; };
  const regrowNames = () => { for (const el of document.querySelectorAll("#rows textarea.name, #tTitle")) { if (el.offsetParent === null) continue; el.style.height = "auto"; el.style.height = Math.max(el.id === "tTitle" ? 32 : 44, el.scrollHeight) + "px"; } };   // every name box measured again: a long name never clips to one line
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => requestAnimationFrame(regrowNames));   // the first paint can come before the font: measured in the fallback, measured again in Inter
  let regrowTimer = null; window.addEventListener("resize", () => { clearTimeout(regrowTimer); regrowTimer = setTimeout(regrowNames, 120); });   // rotation, a split view, the keyboard
  const armedNotes = new Set();
  const allNotesOpen = new Set();                                // clients whose notes page is unfolded past the ten newest (this session)
  const openNoteIds = new Set();                                 // long notes opened in full (this session)
  // notes stay inside c.notes, the one key the server strips before a client's phone gets the record:
  // a string is the old single note (shown as "Earlier"), an object { log: [{ id, at, text }] } is the dated list
  const writeNotes = (c, list) => { c.notes = packNotes(list); scheduleSave("clients", c.id); };   // only ever from Save / Delete: a redraw never writes
  function renderNotes(c, unseen = new Set()) {                      // unseen: card notes the coach has not read yet, marked with a dot
    const wrap = $("noteList"); wrap.replaceChildren(); if (S.clientMode) return;
    const onCards = [];                                                          // notes written on the exercise cards (by the client or by him), shown here with his own
    for (const tr of clientTrainings(c.id)) for (const r of tr.rows || []) if (r.clientNote) onCards.push({ id: "row/" + tr.id + "/" + r.id, at: r.clientNoteAt || (tr.date ? tr.date + "T12:00:00" : null), text: r.clientNote, by: r.clientNoteBy || "client", exercise: String(r.name || ""), workout: { id: tr.id, title: String(tr.title || ""), date: effDate(tr) || String(tr.date || "") }, row: r, training: tr });
    const entries = [...noteEntries(c).map((n) => ({ ...n, by: "coach" })), ...onCards].sort((a, b) => String(b.at || "").localeCompare(String(a.at || "")));
    const firstName = String(c.name || "").trim().split(/\s+/)[0] || "Client";
    const dropCardNote = (n) => { delete n.row.clientNote; delete n.row.clientNoteBy; delete n.row.clientNoteAt; if (!trainerNoted.has(n.training.id)) trainerNoted.set(n.training.id, new Set()); trainerNoted.get(n.training.id).add(n.row.id); scheduleSave("trainings", n.training.id); };
    const t = today(), base = new Date(t + "T12:00:00"), monday = new Date(base); monday.setDate(base.getDate() - ((base.getDay() + 6) % 7));
    const mondayIso = localIso(monday), yIso = localIso(new Date(base.getTime() - 86400000));
    const when = (n) => {
      if (!n.at) return "Earlier";
      const d = new Date(n.at), day = localIso(d);
      const dd = day === t ? "Today" : day === yIso ? "Yesterday" : d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
      return dd + " \u00b7 " + d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
    };
    const entryEl = (n) => {
      const row = document.createElement("div"); row.className = "entry"; row.classList.toggle("unseen", unseen.has(n.id));
      const top = document.createElement("div"); top.className = "when";
      const stamp = document.createElement("span"); stamp.innerHTML = "<b></b> \u00b7 "; stamp.firstChild.textContent = n.by === "coach" ? "You" : firstName; stamp.append(when(n));   // who wrote it, then when
      const ask = document.createElement("span"); ask.className = "ask";
      if (armedNotes.has(n.id)) {
        const q = document.createElement("span"); q.textContent = "Delete this note?";
        const go = document.createElement("button"); go.type = "button"; go.className = "go"; go.textContent = "Delete";
        go.addEventListener("click", () => { armedNotes.delete(n.id); if (n.row) dropCardNote(n); else { deletedNotes.set(n.id, c.id); writeNotes(c, noteEntries(c).filter((x) => x.id !== n.id)); } renderNotes(c); });
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
      row.append(top); if (ref) row.append(ref); row.append(text, more); return row;
    };
    const listOf = (items) => { const card = document.createElement("div"); card.className = "list notes"; for (const n of items) card.appendChild(entryEl(n)); return card; };
    const moreRow = (label, sub, onTap) => { const d = document.createElement("div"); d.className = "note-more"; const b = document.createElement("button"); b.type = "button"; b.append(label); if (sub) { const sp = document.createElement("span"); sp.className = "sub"; sp.textContent = sub; b.appendChild(sp); } b.addEventListener("click", onTap); d.appendChild(b); return d; };
    const LIMIT = 10, showAll = allNotesOpen.has(c.id);
    if (!showAll) {                                                              // the ten newest, flat, like Notes: every note on the page, newest first
      if (entries.length) wrap.appendChild(listOf(entries.slice(0, LIMIT)));
      if (entries.length > LIMIT) wrap.appendChild(moreRow("Show all", (entries.length - LIMIT) + " more", () => { allNotesOpen.add(c.id); renderNotes(c); }));
    } else {                                                                     // all of them, under week, month and year headings
      const groups = new Map();
      for (const n of entries) {
        const day = n.at ? localIso(new Date(n.at)) : "";
        let key, title;
        if (!day) { key = "earlier"; title = "Earlier"; }
        else if (day >= mondayIso) { key = "week"; title = "This week"; }
        else if (day.slice(0, 4) === t.slice(0, 4)) { key = day.slice(0, 7); title = new Date(day + "T12:00:00").toLocaleDateString(undefined, { month: "long" }); }
        else { key = day.slice(0, 7); title = new Date(day + "T12:00:00").toLocaleDateString(undefined, { month: "long", year: "numeric" }); }
        if (!groups.has(key)) groups.set(key, { title, items: [] }); groups.get(key).items.push(n);
      }
      for (const [, g] of groups) { const h = document.createElement("h2"); h.className = "note-head"; h.textContent = g.title; wrap.append(h, listOf(g.items)); }
      if (entries.length > LIMIT) wrap.appendChild(moreRow("Show less", "", () => { allNotesOpen.delete(c.id); renderNotes(c); }));
    }
    setTimeout(() => fitNotes(wrap), 0);
  }
  function fitNotes(root) {                                      // show "More" only under notes that really run past three lines
    for (const el of root.querySelectorAll(".entry .text.clamp")) { const more = el.nextElementSibling; if (more && more.classList.contains("more")) more.hidden = !(el.scrollHeight > el.clientHeight + 1); }
  }
  const groupCaption = (g) => ({ main: g.key === "w" ? "Warmup" : ("Exercise " + (/^\d+$/.test(String(g.key)) ? String(g.key) : "")).trim(), kind: g.rows.length < 2 ? "" : g.rows.length === 2 ? "Superset" : g.rows.length === 3 ? "Tri-set" : "Giant set" });   // a card's caption, the client's workout page's and the preview's: "Exercise 1", "Exercise 2" · "Superset", "Warmup" · "Superset"
  const groupWord = (g) => g.key === "w" ? "warmup" : g.rows.length === 2 ? "superset" : g.rows.length === 3 ? "tri-set" : g.rows.length > 3 ? "giant set" : "exercise";
  function openFinishEarly(t, g, selKey, skip) {   // skip: an exercise still to come, nothing logged — the same sheet, worded as a skip
    const total = Math.max(...g.rows.map(setsOf));
    const did = Math.min(...g.rows.map((r) => { const n = Math.min(doneCount(r), setsOf(r)); return n >= setsOf(r) ? total : n; }));   // a shorter row that is finished does not hold the others back
    const left = total - did, word = (n) => n + (n === 1 ? " set" : " sets");
    es = { t, g, selKey, reason: "" }; S.asking = true;                                      // a sync must not swap the record under the sheet
    $("esTitle").textContent = (skip ? "Skip this " : "Finish this ") + groupWord(g) + "?";
    $("esLead").textContent = did > 0 ? did + " of " + word(total) + " completed." : "No sets completed yet.";
    $("esFine").textContent = skip ? "Its " + word(left) + " will stay incomplete." : (did > 0 ? "What you logged stays saved. " : "") + "The remaining " + word(left) + " will stay incomplete.";
    $("esGo").textContent = skip ? "Skip" : "Finish & move on";
    for (const b of $("esReasons").querySelectorAll("button")) { b.classList.remove("on"); b.setAttribute("aria-pressed", "false"); }
    $("earlySheet").hidden = false;
    setTimeout(() => { if (es) $("esGo").focus({ preventScroll: true }); }, 0);
  }
  function closeFinishEarly() { $("earlySheet").hidden = true; es = null; S.asking = false; }
  let askOpen = null;                                               // the sheet that is up, if any: a second ask closes it as "no" first
  function askFirst({ title, text, yes = "Delete", red = true, input = null }) {   // nothing is deleted or discarded by accident: a sheet asks, and only its red button does it; red: false for an act that loses nothing (Finish early, his ask, 12 Nov), its button then the sheets' purple
    return new Promise((resolve) => {                                // input: { value, placeholder, max }: a name typed in the sheet (New folder, New slide, Rename: his ask, 12 Nov, "let me name it"); it resolves with the name, or false
      if (askOpen) askOpen(false);
      const bg = $("askSheet"), y = $("askYes"), n = $("askNo"), f = $("askInput"), behind = [...document.body.children].filter((el) => el !== bg && !el.inert);   // (what was inert already, as #ctxLift in the markup, stays so: only what the sheet held is given back)
      $("askTitle").textContent = title; $("askText").textContent = text || ""; $("askText").hidden = !text; y.textContent = yes; y.classList.toggle("danger", red);
      f.hidden = !input; if (input) { f.value = input.value || ""; f.placeholder = input.placeholder || ""; f.maxLength = input.max || 40; }
      const named = () => String(f.value || "").replace(/\s+/g, " ").trim();
      let armed = false; y.disabled = true;                                                  // the second tap of a double tap must not land on the red button
      const settle = setTimeout(() => { armed = true; y.disabled = !!input && !named(); }, 350);   // a name to type: its button waits for one
      const vv = window.visualViewport, sh = bg.firstElementChild, lift = () => { const kb = vv ? Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop)) : 0; sh.style.paddingBottom = kb ? kb + 16 + "px" : ""; };   // the phone's keyboard up: what the sheet holds sits above it, and the sheet itself runs on down behind it, as an iPhone sheet does (measured on the simulator, iOS 27: the keyboard's bar of arrows floats over the page, which showed round it while the sheet stopped at the keys)
      const onInput = () => { if (armed) y.disabled = !named(); };
      const done = (v) => { clearTimeout(settle); askOpen = null; S.asking = !!pv; bg.hidden = true; y.disabled = false; for (const el of behind) el.inert = false; y.removeEventListener("click", onYes); n.removeEventListener("click", onNo); bg.removeEventListener("click", onBg); document.removeEventListener("keydown", onKey); f.removeEventListener("input", onInput); if (vv) { vv.removeEventListener("resize", lift); vv.removeEventListener("scroll", lift); } sh.style.paddingBottom = ""; if (input && document.activeElement === f) f.blur(); resolve(input ? (v && named()) || false : v); };
      const onYes = () => { if (armed && (!input || named())) done(true); }, onNo = () => done(false), onBg = (e) => { if (armed && e.target === bg) done(false); }, onKey = (e) => { if (e.key === "Escape") done(false); else if (input && e.key === "Enter" && e.target === f) { e.preventDefault(); onYes(); } };
      askOpen = done; S.asking = true;
      y.addEventListener("click", onYes); n.addEventListener("click", onNo); bg.addEventListener("click", onBg); document.addEventListener("keydown", onKey);
      if (input) { f.addEventListener("input", onInput); if (vv) { vv.addEventListener("resize", lift); vv.addEventListener("scroll", lift); } }
      for (const el of behind) el.inert = true;                                              // the page behind is out of reach until the question is answered
      bg.hidden = false; if (input) f.focus({ preventScroll: true }); else n.focus({ preventScroll: true });   // (the name field takes the focus in the tap that opened the sheet, so the phone gives the keyboard)
    });
  }
  const askName = (title, value, yes) => askFirst({ title, yes: yes || "Add", red: false, input: { value: value || "", placeholder: "Name", max: 40 } });
  // a list in a sheet, in the same language as askFirst: rows are <li> with a button[data-id]; resolves with the tapped id, or null for Cancel / tap outside / Escape
  function sheetList({ title, rows, up }) {                            // up: a step back over the title ("\u2039 Fat Burn"), answering ".." (Move to's steps)
    return new Promise((resolve) => {
      if (askOpen) askOpen(false);
      const bg = $("pickSheet"), ul = $("pickList"), n = $("pickNo"), ub = $("pickUp"), behind = [...document.body.children].filter((el) => el !== bg && !el.inert);
      $("pickTitle").textContent = title; ub.hidden = !up; ub.textContent = up ? "\u2039 " + up : "";
      ul.replaceChildren(...rows);
      let armed = false;                                                                      // the second tap of a double tap must not pick a row
      const settle = setTimeout(() => { armed = true; }, 350);
      const done = (v) => { clearTimeout(settle); askOpen = null; S.asking = !!pv; bg.hidden = true; for (const el of behind) el.inert = false; n.removeEventListener("click", onNo); ub.removeEventListener("click", onUp); bg.removeEventListener("click", onBg); ul.removeEventListener("click", onRow); document.removeEventListener("keydown", onKey); resolve(v); };
      const onNo = () => done(null), onUp = () => { if (armed) done(".."); }, onBg = (e) => { if (armed && e.target === bg) done(null); }, onKey = (e) => { if (e.key === "Escape") done(null); };
      const onRow = (e) => { const b = e.target.closest("button[data-id]"); if (b && armed) done(b.dataset.id); };
      askOpen = done; S.asking = true;
      n.addEventListener("click", onNo); ub.addEventListener("click", onUp); bg.addEventListener("click", onBg); ul.addEventListener("click", onRow); document.addEventListener("keydown", onKey);
      for (const el of behind) el.inert = true;
      bg.hidden = false; ul.scrollTop = 0; n.focus({ preventScroll: true });
    });
  }
  function pickOne({ title, items }) {                                                        // a list to choose from: label, a quiet sub, a chevron
    return sheetList({ title, rows: items.map((it) => {
      const li = document.createElement("li"), b = document.createElement("button"); b.type = "button"; b.dataset.id = it.id;
      b.innerHTML = "<span></span><span class=\"sub\"></span>"; b.firstChild.textContent = it.label; b.lastChild.textContent = it.sub || "";
      b.lastChild.insertAdjacentHTML("beforeend", '<span class="chev">\u203a</span>');
      li.appendChild(b); return li;
    }) });
  }
  const dayList = (clientId, key) => clientTrainings(clientId).filter((t) => effDate(t) === key && !(t.skippedAt && !t.completedAt));   // a day's workouts: planned or finished, not the skipped ones
  function missedOf(cid) {                                           // a client's missed workouts: still to do, their day gone, the newest first (the Missed card's order, as a stack of notifications puts the newest on top)
    return clientTrainings(cid).filter((t) => canSwipeRow(t) && !!effDate(t) && effDate(t) < today()).sort((a, b) => effDate(b).localeCompare(effDate(a)) || byMade(b, a));
  }
  async function showDay(c, key, preview) {                                                  // a day with more than one workout: the day's rows, each its own workout; the coach can add another (preview: from the calendar, a row opens the workout's preview first)
    const d = new Date(key + "T12:00:00"), list = dayList(c.id, key).sort(byMade);
    const rows = list.map((t) => {
      const li = workoutRow(t, t.completedAt || t.skippedAt ? "past" : key === today() ? "today" : "next");
      const b = li.querySelector("button"), nb = b.cloneNode(true); nb.dataset.id = t.id; b.replaceWith(nb);      // the row's own tap is replaced by the sheet's (a past day's workout still to do says Missed, its choices on the Missed card)
      return li;
    });
    if (!S.clientMode) { const li = document.createElement("li"); li.className = "more"; const box = document.createElement("div"); const b = document.createElement("button"); b.type = "button"; b.dataset.id = "+"; b.textContent = "Add a workout"; box.appendChild(b); li.appendChild(box); rows.push(li); }
    const id = await sheetList({ title: d.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" }), rows });
    if (preview && preview.isConnected && $("pickSheet").contains(document.activeElement)) preview.focus({ preventScroll: true });   // a keyboard's or VoiceOver's place, left in the list that has gone: back on the day, so the preview gives it back there
    if (id === "+") addTraining(c.id, null, key); else if (id) { if (preview) openPreview(id); else go({ name: "training", id }); }
  }
  function finishEarlyNow() {
    if (!es) return;
    const { t, g, selKey, reason } = es; closeFinishEarly();
    for (const r of g.rows) { r.setsDone = clamp(parseInt(r.setsDone, 10) || 0, 0, 20); r.done = true; markEarly(t, r, reason); const track = S.clientMode ? pendingWeightRows : trainerTouched; if (!track.has(t.id)) track.set(t.id, new Set()); track.get(t.id).add(r.id); }
    openBlocks.delete(selKey); setSel.delete(selKey); scheduleSave("trainings", t.id);
    haptic(); S.renderedTraining = null; render(); scrollToCard(g.key);
  }
  function openDatePicker(opts) {                                    // opts: { clientId, title, selected, min ("YYYY-MM-DD", or a function giving it: nothing earlier can be picked), onPick }
    const selected = opts.selected || today(), min = (typeof opts.min === "function" ? opts.min() : opts.min) || null, tm = today().slice(0, 7), sm = selected.slice(0, 7);
    const lo = min ? min.slice(0, 7) : [monthAdd(sm, -12), monthAdd(tm, -12)].sort()[0], hi = [monthAdd(sm, 12), monthAdd(tm, 12)].sort()[1];
    const start = min ? lo : [lo, monthAdd([sm, tm].sort()[1], -60)].sort()[1];   // at most five years of months: the window keeps the later of the day's month and this one, and so both whenever they are within five years
    const months = []; for (let mk = start; mk <= hi && months.length < 61; mk = monthAdd(mk, 1)) months.push(mk);   // a year either side of the day and of today
    const month = months.includes(sm) ? sm : months.includes(tm) ? tm : months[0];   // the day's month; one before the first allowed (an overdue workout), or beyond the five years, opens on this month
    dp = { clientId: opts.clientId, moving: opts.moving || null, title: opts.title || "Pick a day", selected, min: opts.min || null, months, month, aim: null, onPick: opts.onPick, ok: opts.ok || null, back: document.activeElement, at: performance.now() };   // ok: asked on every redraw; false closes the days (the workout was finished, skipped or left). min as a function is asked at every redraw: Reschedule's "from today on" moves on at midnight
    dpIdx = Math.max(0, months.indexOf(month)); dpTouching = false; dpStale = false; dpRestAt = 0; clearTimeout(dpLater); renderDatePicker(); $("datePick").hidden = false;
    dpShow(dp.month, false);                                         // opens on the day's month, without a slide (now that the sheet has its width)
    fitChips($("dpGrid"));                                           // the names that run past their chip fade, measured now the sheet is up (its first draw came before it showed)
    for (const el of document.querySelectorAll("main, header")) el.inert = true; if (pv) $("pvSheet").inert = true;   // (over the preview, the preview waits)
    setTimeout(() => { const page = dpTrack() && dpTrack().children[dpIdx], f = (page && page.querySelector("button.sel:not(:disabled)")) || $("dpCancel"); if (f && dp) f.focus({ preventScroll: true }); }, 0);   // the chosen day when it is on the month shown
  }
  const dpSettled = (e) => !!dp && (performance.now() - dp.at >= 350 || (!!e && e.detail === 0));   // the second tap of a double tap (on a row's Reschedule, on the "…" menu's) lands on the days as they come up: in their first 350 ms it picks no day and closes nothing, as the skip sheet's skSettled; a keyboard's Enter or VoiceOver (detail 0) always goes through
  function closeDatePicker() {
    const back = dp && dp.back; $("datePick").hidden = true; dp = null; clearTimeout(dpLater);
    if (pv) $("pvSheet").inert = false; else for (const el of document.querySelectorAll("main, header")) el.inert = false;   // (over the preview: back to it; the page behind stays out of reach until it goes)
    const to = back && pv && back === $("pvMore") && back.hidden ? pvFocusTo() : back;   // the preview's "…" it came from gone meanwhile (a sync made the workout History): an arrow, else the sheet, never the page
    if (to && typeof to.focus === "function" && document.contains(to)) to.focus({ preventScroll: true });
  }
  // The months sit side by side on a track (index.html .dp-pager): it follows the finger and, let go, settles on a month on UIKit's own spring,
  // as Apple's calendar does (measured 8 Nov in its picker, iOS 27.2: 1:1 under the finger; let go past half, or flicked, it goes on to the
  // next month, under half it comes back; it settles in a third of a second, a spring without bounce, response 0.3 s). The settle is a
  // cubic-bezier transition, so Core Animation runs it at the screen's own rate. (The browser's own scroll snapping followed the finger the
  // same, but crawled for 0.8 s into place.) The arrows slide a month as Apple's do: a quarter of a second, easing in and out.
  let dpTouching = false, dpStale = false, dpIdx = 0, dpRestAt = 0, dpLater = null;   // dpTouching: a finger is on the days; dpRestAt: when the months' slide or settle lands
  const dpTrack = () => $("dpGrid").firstElementChild;
  const dpW = () => { const g = $("dpGrid"), w = parseFloat(getComputedStyle(g).width); return w > 0 ? w : g.clientWidth || 0; };   // a month's exact width: CSS pixels can be fractional, and a rounded width walks the months off their letters, a little more each month
  const dpMin = () => (dp && (typeof dp.min === "function" ? dp.min() : dp.min)) || null;   // the first day that can be picked, as of now
  function renderDatePicker() {
    if (!dp) return;
    if (dpTouching) { dpStale = true; return; }                      // a sync's redraw never pulls the days from under a finger: it waits for the finger to lift
    const wait = dpRestAt - Date.now(); if (wait > 0) { clearTimeout(dpLater); dpLater = setTimeout(renderDatePicker, wait + 20); return; }   // nor cuts a slide or a settle short: it waits for the months to land (as the client page's calendar waits for its slide)
    if (dp.ok && !dp.ok()) { closeDatePicker(); return; }            // what the days were for is gone (a Reschedule whose workout was finished or skipped meanwhile)
    const g = $("dpGrid"), list = clientTrainings(dp.clientId), t0 = today(), min = dpMin();
    const byDay = new Map(); for (const t of list) { if (t.skippedAt && !t.completedAt) continue; const k = effDate(t); if (!byDay.has(k)) byDay.set(k, []); byDay.get(k).push(t); }   // each workout's day worked out once, not once for every day of every month
    const fmt = new Intl.DateTimeFormat(undefined, { weekday: "long", month: "long", day: "numeric" });
    $("dpTitle").textContent = dp.title;
    const track = document.createElement("div"); track.className = "dp-track";
    track.replaceChildren(...dp.months.map((mk) => {
      const [y, m] = mk.split("-").map(Number), first = new Date(y, m - 1, 1, 12), page = document.createElement("div"); page.className = "cal"; page.dataset.month = mk;
      const lead = (first.getDay() + 6) % 7;
      for (let i = 0; i < lead; i++) { const b = document.createElement("button"); b.type = "button"; b.className = "out"; b.tabIndex = -1; b.setAttribute("aria-hidden", "true"); page.appendChild(b); }
      const days = new Date(y, m, 0).getDate();
      for (let day = 1; day <= days; day++) {
        const d = new Date(y, m - 1, day, 12); const key = localIso(d);
        const dayWorkouts = byDay.get(key) || [];
        const b = document.createElement("button"); b.type = "button";
        if (key === t0) { b.classList.add("today"); b.setAttribute("aria-current", "date"); }
        if (key === dp.selected) b.classList.add("sel");
        const dn = document.createElement("span"); dn.className = "dn"; dn.textContent = String(day);
        b.append(dn, dayChips(dayWorkouts, dp.moving));                  // as the month's day (his ask, 12 Nov: every calendar as the new one): each workout's name in its chip, the one being moved outlined
        b.setAttribute("aria-label", fmt.format(d) + (dayWorkouts.length ? ": " + dayNames(dayWorkouts) : ""));
        if (min && key < min) { b.classList.add("off"); b.disabled = true; }   // before the first day allowed: shown, not pickable
        else b.addEventListener("click", (e) => {
          if (!dp || !dpSettled(e)) return; const now = dpMin(); if (now && key < now) { renderDatePicker(); return; }   // the days were drawn before midnight: yesterday is not picked, it greys out
          const pick = dp.onPick; closeDatePicker(); if (pick) pick(key);
        });
        page.appendChild(b);
      }
      return page;
    }));
    g.replaceChildren(track);
    dpPlace(-dpIdx * dpW(), null); dpSync(); fitChips(g);
  }
  function dpPlace(x, ease) {                                        // the track at x (the months to the left are off screen); on a curve, or at once
    const t = dpTrack(); if (!t) return;
    $("dpGrid").scrollLeft = 0;                                      // the pager itself never scrolls: only the track moves (a focus or a find could scroll it, and the months would sit off their letters)
    t.style.transition = ease ? "transform " + ease.ms + "ms " + ease.css : "none"; t.style.transform = "translate3d(" + x + "px,0,0)";
    dpRestAt = ease ? Date.now() + ease.ms : 0;
  }
  function dpShow(month, slide) {                                    // to a month: slid as Apple's arrows slide it, or put there at once
    if (!dp) return; const i = dp.months.indexOf(month); if (i < 0) return;
    dpIdx = i; dp.month = month;
    dpPlace(-i * dpW(), slide && !calmMotion() ? { ms: 250, css: "cubic-bezier(0.45, 0, 0.55, 1)" } : null);
    dpSync();
  }
  function dpSync() {                                                // the month shown (or being settled on): its name, the arrows, Today
    if (!dp) return; dp.month = dp.months[dpIdx] || dp.month;
    $("dpMonth").textContent = monthTitle(dp.month);
    const tm = today().slice(0, 7); $("dpToday").hidden = dp.month === tm || !dp.months.includes(tm);
    $("dpPrev").disabled = dpIdx <= 0; $("dpNext").disabled = dpIdx >= dp.months.length - 1;
    const t = dpTrack(); if (t) [...t.children].forEach((p, i) => { p.inert = i !== dpIdx; });   // only the month shown takes focus, a tap or VoiceOver: Tab never lands on a day off screen
  }
  // ---- a week into a client's calendar (his ask, 12 Nov: "I want to be able to add the whole folder / slide to the calendar ... I pick Monday
  // then Monday through Friday will have all the workouts"; his picks: from both places, "Use all" while choosing a template for a client
  // and "Use for a client" in a folder's "…"; every day in a row; "one week at the time ... I will have to add each week separately")
  const canFill = (t, cid) => !!t && t.clientId === cid && !t.completedAt && !t.skippedAt && !(t.rows || []).length;   // the empty workout From template was tapped on, still empty and still to do (a sync may have filled, finished or skipped it meanwhile: then the week goes in beside it)
  function useWeek(list, cid, start, fillId) {                         // the templates, in their order, one a day from the day picked; fillId: the empty workout From template was tapped on, which takes the first where it is (its name and In person kept; a stamped save, so a skip the client made meanwhile survives the merge: the v282 review found a new workout in its place lost it. A skip that reached the server after this device's last read goes with it to the first day picked, as with Reschedule; Undo brings it back)
    const day = (i) => { const d = new Date(start + "T12:00:00"); d.setDate(d.getDate() + i); return localIso(d); };
    const target = fillId ? trainings.get(fillId) : null, fill = canFill(target, cid);
    list.forEach((T, i) => {
      const title = T.title || (templateMeta(T).n ? "Workout " + templateMeta(T).n : "");
      if (i === 0 && fill) {
        if (!String(target.title || "").trim()) target.title = title;
        target.rows = (T.rows || []).map((r) => freshRow(r)); target.fromTemplate = T.id;
        target.date = day(0); touchState(target.id, "date");             // on the first day picked, claimed even when it was there already: a move made on another device meanwhile must not pull Workout 1 out of the week (the v282 review)
        scheduleSave("trainings", target.id, 0);
      } else addTraining(cid, { ...T, title, fromTemplate: T.id }, day(i), true);
    });
    lastUse.template = list[0].id; lastUse.client = cid; lsSet("fiala.templates.last", lastUse);
  }
  function useAllBar(f, n) {                                           // above the list while a template is chosen for a client: how many, and Use all (the purple as text, var(--brand-text), as the pick note's Cancel above it: the fill purple reads 4.2:1 on the dark page, the v282 review; each row's Use still has the fill purple, var(--brand), until the coach decides)
    const bar = document.createElement("div"), count = document.createElement("span"), b = document.createElement("button");
    bar.className = "listbar"; count.className = "muted"; count.textContent = n + " workouts";
    b.type = "button"; b.className = "btn quiet use-all"; b.textContent = "Use all"; b.style.color = "var(--brand-text)"; b.addEventListener("click", () => useAll(f.id));
    bar.append(count, b); return bar;
  }
  function useAll(fid) {                                               // Use all: the first day, in the client's calendar opened on the workout's own day (its chip outlined), then the week, and their page
    const f = tplNode(fid), cid = pickFor, fillId = fillFor; if (!f || !cid || !clients.has(cid)) return;
    const ids = tplHere(f).map((t) => t.id), target = fillId ? trainings.get(fillId) : null, fillable = canFill(target, cid), who = clients.get(cid);
    openDatePicker({ clientId: cid, moving: fillable ? fillId : null, title: "Add " + weekName(f) + " to " + (who.name || "client"), selected: (fillable && effDate(target)) || today(), ok: () => clients.has(cid), onPick: (date) => {   // (one skipped, or filed as missed, stays as it is: nothing outlined, the days from today)
      const list = ids.map((id) => trainings.get(id)).filter((t) => t && isTemplateClient(t.clientId)); if (!list.length || !clients.has(cid) || pickFor !== cid) return;   // read again: a sync may have taken a template or the client meanwhile
      const home = nav.pickHome; nav.pickDepth = null; nav.pickHome = null; fillFor = null; pickFor = null;
      useWeek(list, cid, date, fillId);
      if (typeof home === "number") navLandAt(Math.max(0, home));   // back on the client's own step: Back from their page goes where it went before, not through the templates
      setTab("workouts"); go({ name: "client", id: cid });
    } });
  }
  async function useWeekFor(fid) {                                     // Use for a client, in a folder's "…": which client (the last one used first), the first day in their calendar, then the week and their page
    const f = tplNode(fid); if (!f) return;
    const ids = tplHere(f).map((t) => t.id), name = weekName(f); if (ids.length < 2) return;
    const people = peopleList(); if (lastUse.client) { const i = people.findIndex((c) => c.id === lastUse.client); if (i > 0) people.unshift(people.splice(i, 1)[0]); }
    const none = () => { const li = document.createElement("li"); li.className = "empty"; li.style.padding = "12px 16px"; li.textContent = "Add a client first."; return li; };
    const cid = await (people.length ? pickOne({ title: "Add " + name + " to", items: people.map((c) => ({ id: c.id, label: c.name || "Unnamed", sub: c.id === lastUse.client ? "last used" : c.paused ? "Paused" : "" })) }) : sheetList({ title: "Add " + name + " to", rows: [none()] }));
    if ($("pickSheet").contains(document.activeElement) && !$("tMore").hidden) $("tMore").focus({ preventScroll: true });   // a keyboard's or VoiceOver's place, left on a row of the sheet that has gone: back on the "…" (and the days give it back there), as showDay's
    if (!cid || !clients.has(cid) || !tplPageOn() || S.view.folder !== fid) return;   // still this folder's page: Back, or a sync that took the folder away, adds nothing
    const who = clients.get(cid);
    openDatePicker({ clientId: cid, title: "Add " + name + " to " + (who.name || "client"), ok: () => clients.has(cid), onPick: (date) => {
      const list = ids.map((id) => trainings.get(id)).filter((t) => t && isTemplateClient(t.clientId)); if (!list.length || !clients.has(cid)) return;
      useWeek(list, cid, date, null); setTab("workouts"); go({ name: "client", id: cid });
    } });
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
    scheduleSave("trainings", target.id, 0); S.renderedTraining = null;
    if (typeof nav.pickDepth === "number") { navLandAt(nav.pickDepth); nav.pickDepth = null; }   // back on the workout's own step: Back from it goes to the client, not through the templates
    freshWorkout = id; go({ name: "training", id });                   // still being made: as the coach
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
    const t = { id: uid(), clientId: TEMPLATES_ID, date: "2026-01-01", createdAt: now(), title: src.title || "", completedAt: null, skippedAt: null,
      template: { program: MY_TEMPLATES, phase: 0, stage: 0, n: nextN(null) },   // the next number among My templates (those in his folders count in theirs, 12 Nov)
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
    const chev = document.createElement("span"); chev.className = "chev"; chev.textContent = pick ? "Use" : "›"; if (pick) chev.style.color = "var(--brand-text)";   // the purple as text, as every other text button of his (his pick, 13 Nov: "keep it consistent"; the fill purple read 3.4:1 on the dark card)
    b.append(left, chev);
    b.addEventListener("click", () => { if (pick) { if (fillFor) { fillFromTemplate(trainings.get(t.id) || t); return; } const cid = pickFor; const who = clients.get(cid); openDatePicker({ clientId: cid, title: "Add to " + ((who && who.name) || "client"), onPick: (date) => { pickFor = null; applyTemplate(trainings.get(t.id) || t, cid, date); } }); } else go({ name: "training", id: t.id }); });
    li.appendChild(b);
    if (!pick && tplPageOn()) tplSwipe(li, { move: () => moveTemplate(t.id), del: () => deleteTemplateRow(t.id), ok: () => isTemplateClient((trainings.get(t.id) || {}).clientId) && tplPageOn(), open: () => go({ name: "training", id: t.id }) });
    return li;
  }
  function navRow(title, sub, onClick) {
    const li = document.createElement("li"); const b = document.createElement("button"); b.type = "button";
    b.innerHTML = "<span></span><span class=\"sub\"></span>"; b.firstChild.textContent = title; b.lastChild.textContent = sub; b.lastChild.insertAdjacentHTML("beforeend", '<span class="chev">&rsaquo;</span>');
    b.addEventListener("click", onClick); li.appendChild(b); return li;
  }
  // ---- Move to and Delete on the Templates pages' rows (his picks, 12 Nov: "Swipe the row" — "slide a template or folder row left: purple
  // Move to and red Delete appear ... a long press (or right-click on the Mac) shows the same two in a menu"; Move to "Purple, like
  // Reschedule"; "Everything is movable and editable", the built-in programs too; the places "Step by step", as the pages are browsed)
  function tplSwipe(li, { move, del, ok, open }) {                    // a template's or a folder's row: Delete (red; it asks first) and, outermost, Move to (purple, as Reschedule, and like it the full swipe's: his ask, 12 Nov, "make sure the delete is the second option so move to sits on the right of delete"); the same two on a touch and hold and a right-click, Delete last and red as every menu ends (move: none for a folder with nowhere to go, Delete then alone)
    li.classList.add("swipe-row");
    const layer = document.createElement("div"); layer.className = "swipe-acts"; layer.setAttribute("aria-hidden", "true");
    const act = (cls, icon, label, run) => { const b = document.createElement("button"); b.type = "button"; b.className = "swipe-act " + cls; b.tabIndex = -1; b.innerHTML = '<span class="sa-cap">' + icon + '</span><span class="sa-lbl">' + label + '</span>'; b.addEventListener("click", (e) => { e.stopPropagation(); run(); }); return b; };
    const outer = move || del;                                        // the full swipe's: Move to, or Delete where it is alone
    if (move) layer.appendChild(act("sa-del", SA_TRASH, "Delete", () => { if (rs && rs.li === li) rsSettle(rs, 0, 0); del(); }));
    layer.appendChild(move ? act("sa-move", SA_FOLDER, "Move to", () => { if (rs && rs.li === li) rsFire(rs); else move(); }) : act("sa-del", SA_TRASH, "Delete", () => { if (rs && rs.li === li) rsFire(rs); else del(); }));
    li._full = outer; li.appendChild(layer);                          // last, under the row's own parts: they slide off it
    li._ctx = () => [...(move ? [{ label: "Move to", icon: MI.folder, onPick: move }] : []), { label: "Delete", icon: MI.trash, danger: true, onPick: del }]; li._ctx.ok = ok; li._ctx.open = open;
  }
  const tplName = (t) => { const m = templateMeta(t); return m.n ? "Workout " + m.n : (t.title || "Template"); };   // a template as its row names it
  const draftOpen = (id) => !!(S.templateDraft && S.templateDraft.id === id && S.templateDraft.dirty);   // a template with unsaved changes: a move would join them (Discard would take it back)
  const sheetFocusBack = () => { if (!$("pickSheet").contains(document.activeElement)) return; const m = $("tMore"); if (m && !m.hidden) m.focus({ preventScroll: true }); };   // a keyboard's or VoiceOver's place, left in a sheet that has gone (the row it came from may have moved away): the page's "…"
  const placeRow = (key, label, sub, more, cur) => {                  // a row of Move to's list: a place, or a folder to open (its chevron); where it is now shown, not picked (as Files greys the folder an item is in)
    const li = document.createElement("li"), b = document.createElement("button"); b.type = "button"; b.dataset.id = key; if (cur) b.disabled = true;
    b.innerHTML = "<span></span><span class=\"sub\"></span>"; b.firstChild.textContent = label; b.lastChild.textContent = sub || "";
    if (more) b.lastChild.insertAdjacentHTML("beforeend", '<span class="chev">\u203a</span>');
    li.appendChild(b); return li;
  };
  async function moveTemplate(id) {                                   // Move to, step by step (his pick, 12 Nov): My templates and his top folders; a folder with weeks or folders opens to them; a week, or a folder with neither, is where it goes; a step back over the title
    let at = null;                                                    // the folder open in the sheet (null: the top)
    for (;;) {
      const T = trainings.get(id); if (!T || !isTemplateClient(T.clientId) || draftOpen(id)) { sheetFocusBack(); return false; }   // read again at every step: a sync may have taken it
      if (at && !tplNode(at)) at = null;                              // the folder open was deleted on another device: back to the top
      const home = (tplHome(T) || {}).id || null, loose = !home && templateMeta(T).program === MY_TEMPLATES, f = at ? tplNode(at) : null, rows = [];
      const leaf = (key, label, cur, sub) => rows.push(placeRow(key, label, cur ? "Current" : sub || "", false, cur));
      const place = (x) => { if (tplKids(x.id, "slide").length || tplKids(x.id, "folder").length) rows.push(placeRow("in:" + x.id, x.name, "", true, false)); else leaf("to:" + x.id, x.name, home === x.id); };   // a folder with weeks or folders opens; one with neither takes it as it is
      if (!f) { leaf("to:", MY_TEMPLATES, loose); for (const e of tplRootList()) if (e.folder) place(e.folder); }
      else {
        const sl = tplKids(f.id, "slide"), subs = tplKids(f.id, "folder");
        if (!sl.length) leaf("to:" + f.id, f.name, home === f.id, "This folder");   // a folder with folders and no weeks holds templates of its own too (its page's Templates), named so beside its title
        for (const x of sl) leaf("to:" + x.id, x.name, home === x.id);
        for (const x of subs) place(x);
      }
      const pick = await sheetList({ title: f ? f.name : "Move \u201c" + tplName(T) + "\u201d to", rows, up: f ? (tplNode(f.parent) || { name: "Templates" }).name : null });
      if (typeof pick !== "string") { sheetFocusBack(); return false; }   // Cancel, or another sheet put over it
      if (pick === "..") { at = (f && f.parent) || null; continue; }
      if (pick.startsWith("in:")) { at = pick.slice(3); continue; }
      const to = pick.slice(3) || null, cur = trainings.get(id);
      if (!cur || !isTemplateClient(cur.clientId) || draftOpen(id) || (to && !tplNode(to))) { sheetFocusBack(); return false; }   // gone while the sheet was up, or the place
      placeTemplate(cur, to); render(); sheetFocusBack(); return true;
    }
  }
  function folderPlaces(f) {                                          // where a folder of his can go, two deep at most: the top, or into another top folder; one with folders inside stays at the top
    if (!f || tplKids(f.id, "folder").length) return [];
    return [...(f.parent ? [{ id: "", name: "Templates" }] : []), ...tplRootList().filter((e) => e.folder && e.folder.id !== f.id && e.folder.id !== f.parent).map((e) => ({ id: e.folder.id, name: e.folder.name }))];
  }
  async function moveFolder(fid) {                                    // Move to on a folder's row: the top (the Templates page) or another top folder, in one list; at its new place it comes after those he put in order
    const f = tplNode(fid), places = folderPlaces(f); if (!places.length) return false;
    const pick = await sheetList({ title: "Move \u201c" + f.name + "\u201d to", rows: places.map((p) => placeRow("to:" + p.id, p.name, p.id ? "" : "Top level", false, false)) });
    if (typeof pick !== "string") { sheetFocusBack(); return false; }   // Cancel, or another sheet put over it
    const to = pick.slice(3) || null, now = tplNode(fid);
    if (!now || !folderPlaces(now).some((p) => (p.id || null) === to)) { sheetFocusBack(); return false; }   // read again: a sync may have moved or deleted it, or the folder it was going into
    const tc = tplClient(); tc.folders = (tc.folders || []).map((x) => { if (!x || x.id !== fid) return x; const y = { ...x, parent: to }; delete y.sort; return y; });
    folderTouched.set(fid, TEMPLATES_ID); saveFolders(); render(); sheetFocusBack(); return true;
  }
  async function deleteTemplateRow(id) {                              // Delete on a template's row: asked first, as on its page ("Workouts already made from it stay"), then gone from the page it was on
    const t = trainings.get(id); if (!t || !isTemplateClient(t.clientId)) return false;
    if (!(await askFirst({ title: "Delete \u201c" + tplName(t) + "\u201d?", text: "Workouts already made from it stay.", yes: "Delete" }))) return false;
    if (!trainings.has(id)) return false;                             // a sync took it away while the question was up
    if (S.templateDraft && S.templateDraft.id === id) { S.templateDraft = null; S.pendingGo = null; lsSet("fiala.trainings.draft", null); paintDraftBar(); }
    trainings.delete(id); scheduleSave("trainings", id, 0); render(); return true;
  }
  const folderRow = (x, sub) => {                                     // a folder's row: opens it; swiped, Move to (where it can go) and Delete (its own question: its folders and weeks go, its templates to My templates)
    const li = navRow(x.name, sub, () => go(tplPage(x.id))); li.dataset.fid = x.id;
    if (tplPageOn()) tplSwipe(li, { move: folderPlaces(x).length ? () => moveFolder(x.id) : null, del: () => deleteNode(x.id), ok: () => !!tplNode(x.id) && tplPageOn(), open: () => go(tplPage(x.id)) });
    return li;
  };
  const h2 = (text) => { const e = document.createElement("h2"); e.textContent = text; e.style.marginTop = "24px"; return e; };
  function renderTemplates(c) {                                       // the Templates pages, a row swiped open kept open across a sync's redraw, as the client page's rows
    const mine = !!(rs && rs.li && rs.li.closest && rs.li.closest("#tplList")), keep = mine && rs.open && !rs.busy && !(rsT && rsT.held) ? rs.li.dataset.tid || rs.li.dataset.fid || "" : "";
    if (mine) rsForget();
    drawTemplates(c);
    if (keep) { const li = [...$("tplList").querySelectorAll("li.swipe-row")].find((x) => (x.dataset.tid || x.dataset.fid) === keep), r = li && rsBegin(li, true); if (r) { rsPaint(r, r.w, null); r.open = true; } }
  }
  function drawTemplates(c) {
    if (dragging) return;                                    // a folder of his under the finger (Reorder folders): the list is drawn again once it is put down
    const all = clientTrainings(c.id);
    const wrap = $("tplList"); wrap.replaceChildren(); wrap.hidden = false;
    const prog = S.view.program || null, ph = S.view.phase || null;
    $("pickNote").hidden = !pickFor;
    if (pickFor) { const pc = clients.get(pickFor); $("pickNote").innerHTML = "Choose a workout for <b></b> · <button class=\"btn quiet\" type=\"button\" id=\"pickCancel\">Cancel</button>"; $("pickNote").querySelector("b").textContent = pc ? pc.name : "the client"; $("pickCancel").addEventListener("click", () => { pickFor = null; fillFor = null; render(); }); }
    $("newTraining").hidden = true;                          // a new template comes from the round glass + at the bar's foot now, where he is (his ask, 12 Nov)
    const byProg = new Map();
    for (const t of all) { if (tplHome(t)) continue; const m = templateMeta(t); if (!byProg.has(m.program)) byProg.set(m.program, []); byProg.get(m.program).push(t); }   // (a template in a folder of his counts there, not under its program)
    const wn = (n) => n + (n === 1 ? " workout" : " workouts");
    const f = !prog && tplNode(S.view.folder);
    if (tplOrderOn()) {                                      // Reorder: only the list being put in order, as the Clients list's: on the Templates page the whole Programs list, the built-in programs too (his ask, 12 Nov), in a folder its folders; each row dragged by its grip
      const rowOf = (name, key, drop) => {                  // a row with its name and the grip (the three lines)
        const li = document.createElement("li"), row = document.createElement("div"), nm = document.createElement("span"), g = document.createElement("span"); row.className = "rowline"; nm.className = "pn"; nm.textContent = name;
        g.className = "grip"; g.textContent = "\u2261"; g.setAttribute("aria-hidden", "true"); row.append(nm, g); li.className = "drag-row"; dragRow(li, key, drop); li.appendChild(row); return li;
      };
      $("tplKicker").textContent = f ? (tplNode(f.parent) || {}).name || "Templates" : "Workout library"; $("cName").textContent = f ? f.name : "Templates";
      wrap.appendChild(h2(f ? "Folders" : "Programs")); const ul = document.createElement("ul"); ul.className = "list"; ul.replaceChildren(...(f ? tplKids(f.id, "folder").map((x) => rowOf(x.name, x.id, moveFolderTo)) : tplRootList().map((e) => rowOf(e.folder ? e.folder.name : e.prog, e.key, moveRootTo)))); wrap.appendChild(ul);
      return;
    }
    if (f) {                                                 // a folder of his, drawn as a program is (his ask: "should look exactly like templates I already have"): its folders as phases, its slides as the week slider
      const up = tplNode(f.parent), subs = tplKids(f.id, "folder"), slides = tplKids(f.id, "slide"), cur = tplSlide(f);
      $("tplKicker").textContent = up ? up.name : "Templates"; $("cName").textContent = f.name;
      if (subs.length) { wrap.appendChild(h2(!f.parent && String(f.id).startsWith("b:") ? "Phases" : "Folders")); const ul = document.createElement("ul"); ul.className = "list"; ul.replaceChildren(...subs.map((x) => folderRow(x, wn(tplIn(tplTree(x.id)).length)))); wrap.appendChild(ul); }   // (a built-in program keeps its word for them: Phases)
      if (slides.length) {
        const seg = document.createElement("div"); seg.className = "seg stages"; seg.setAttribute("role", "tablist"); if (subs.length) seg.style.marginTop = "24px";
        for (const x of slides) { const b = document.createElement("button"); b.type = "button"; const nm = document.createElement("span"); nm.textContent = x.name; b.appendChild(nm); b.classList.toggle("on", x === cur); b.addEventListener("click", () => { S.view = { ...S.view, slide: x.id }; lsSet("fiala.trainings.view", S.view); renderTemplates(c); nav.curKey = screenKey(); }); seg.appendChild(b); }   // (in place, as a week tab: the screen's picture is filed under this slide)
        wrap.appendChild(seg);
      }
      const here = tplHere(f);                                // the slide shown (the first also has what is in the folder itself), or the folder's own, in their order
      const whole = !!pickFor && here.length > 1;            // choosing a template for a client: the whole slide at once too ("Use all")
      if (here.length) { const bar = whole ? useAllBar(f, here.length) : null; if (subs.length && !slides.length) { if (bar) bar.style.marginTop = "24px"; else wrap.appendChild(h2("Templates")); } if (bar) wrap.appendChild(bar); const ul = document.createElement("ul"); ul.className = "list"; if (slides.length && !whole) ul.style.marginTop = "16px"; ul.replaceChildren(...here.map((t) => tplRow(t, !!pickFor))); wrap.appendChild(ul); }
      if (!subs.length && !slides.length && !here.length) { const e = document.createElement("div"); e.className = "empty"; e.textContent = !tplPageOn() ? "Nothing here yet." : f.parent ? "Nothing here yet. Tap + for a template or a slide." : "Nothing here yet. Tap + for a template, a folder or a slide."; wrap.appendChild(e); }   // (choosing a template for a client: no + and no \u2026 on screen, so no word of them)
      else if (slides.length && !here.length) { const e = document.createElement("div"); e.className = "empty"; e.textContent = !tplPageOn() ? "Nothing here yet." : "Nothing here yet. Tap + for a template."; wrap.appendChild(e); }   // a new slide of his, still empty (a built-in week never is)
      return;
    }
    if (!prog) {                                             // level 1: programs
      $("tplKicker").textContent = "Workout library"; $("cName").textContent = "Templates";
      const mine = (byProg.get(MY_TEMPLATES) || []).sort((x, y) => templateMeta(x).n - templateMeta(y).n);
      if (mine.length) { wrap.appendChild(h2("My templates")); const ul = document.createElement("ul"); ul.className = "list"; ul.replaceChildren(...mine.map((t) => tplRow(t, !!pickFor))); wrap.appendChild(ul); }
      const list = tplRootList();                            // his folders and the built-in programs, in the order he put them (Reorder)
      if (list.length) { wrap.appendChild(h2("Programs")); const ul = document.createElement("ul"); ul.className = "list"; ul.replaceChildren(...list.map((e) => (e.folder ? folderRow(e.folder, wn(tplIn(tplTree(e.folder.id)).length)) : navRow(e.prog, wn((byProg.get(e.prog) || []).length), () => go({ ...S.view, program: e.prog, phase: null, stage: null }))))); wrap.appendChild(ul); }
      if (!all.length && !list.length) { const e = document.createElement("div"); e.className = "empty"; e.textContent = "No templates yet. Open a workout and tap Save as template."; wrap.appendChild(e); }
      return;
    }
    const items = byProg.get(prog) || [];
    if (!ph) {                                               // level 2: phases of a program
      $("tplKicker").textContent = "Templates"; $("cName").textContent = prog;
      const phases = new Map();
      for (const t of items) { const m = templateMeta(t); if (!phases.has(m.phase)) phases.set(m.phase, []); phases.get(m.phase).push(t); }
      wrap.appendChild(h2("Phases")); const ul = document.createElement("ul"); ul.className = "list";
      for (const [n, pitems] of [...phases.entries()].sort((x, y) => x[0] - y[0])) {
        const pn = (pitems.find((t) => templateMeta(t).phaseName) || { template: {} }).template.phaseName || "";
        ul.appendChild(navRow("Phase " + n + (pn ? " · " + pn : ""), wn(pitems.length), () => go({ ...S.view, phase: n, stage: 1 })));
      }
      wrap.appendChild(ul); return;
    }
    const pitems = items.filter((t) => templateMeta(t).phase === ph);   // level 3: stage tabs + workouts (each tab says Week N: his ask, 12 Nov, "rename every stage to week"; the data keeps "stage")
    const pn = (pitems.find((t) => templateMeta(t).phaseName) || { template: {} }).template.phaseName || "";
    $("tplKicker").textContent = prog; $("cName").textContent = "Phase " + ph + (pn ? " · " + pn : "");
    const stages = [...new Set(pitems.map((t) => templateMeta(t).stage))].sort((x, y) => x - y);
    const cur = stages.includes(S.view.stage) ? S.view.stage : stages[0];
    const seg = document.createElement("div"); seg.className = "seg stages"; seg.setAttribute("role", "tablist");
    for (const s of stages) { const b = document.createElement("button"); b.type = "button"; b.textContent = "Week " + s; b.classList.toggle("on", s === cur); b.addEventListener("click", () => { S.view.stage = s; lsSet("fiala.trainings.view", S.view); renderTemplates(c); nav.curKey = screenKey(); /* the screen changed in place: its picture is filed under this stage */ }); seg.appendChild(b); }
    wrap.appendChild(seg);
    const ul = document.createElement("ul"); ul.className = "list"; ul.style.marginTop = "16px";
    ul.replaceChildren(...pitems.filter((t) => templateMeta(t).stage === cur).sort((x, y) => templateMeta(x).n - templateMeta(y).n).map((t) => tplRow(t, !!pickFor)));
    wrap.appendChild(ul);
  }
  const templateHome = (t) => { const h = tplHome(t); if (h) return h.kind === "slide" ? { name: "client", id: TEMPLATES_ID, folder: h.parent, slide: h.id } : { name: "client", id: TEMPLATES_ID, folder: h.id }; const m = templateMeta(t); return m.program === MY_TEMPLATES ? { name: "client", id: TEMPLATES_ID } : { name: "client", id: TEMPLATES_ID, program: m.program, phase: m.phase, stage: m.stage }; };   // a template in a folder or slide of his: back to that folder, on that slide
  function render() {
    if (S.recovering) { showRecovery(); return; }
    if (pendingPage && S.signedIn && !(S.clientMode && !S.myClientId)) {   // a refresh on a settings page lands back on it at the first paint: no glimpse of the Clients page on the way
      const p = pendingPage; pendingPage = null; exStale = !!S.sb && !S.syncedOnce && (p.open === "exercises" || p.open === "exercise");
      const open = { settings: showSettings, card: showClientCard, history: showHistory, catalog: showCatalog, data: showData, number: showNumber, packages: showPackages, exercises: showExercises, password: showPassword }[p.open];
      const from = p.from === true ? "settings" : (p.from || false);   // older devices wrote a yes/no
      if (p.open === "exercise" && p.name) { fromSettings = from; showExercise(p.name, p.key || squash(p.name)); return; }
      if (open) { fromSettings = from; open(); return; }
    }
    if (settingsOpen === "settings" || settingsOpen === "card") paintHeroes();   // a photo that went up meanwhile shows on the page that is open
    if (settingsOpen) { if (S.signedIn) { hideAllViews(); $("navDone").hidden = settingsOpen !== "exercise"; $(settingsOpen === "exercises" ? "vExercises" : settingsOpen === "exercise" ? "vExercise" : settingsOpen === "packages" ? "vPackages" : settingsOpen === "number" ? "vNumber" : settingsOpen === "settings" ? "vSettings" : settingsOpen === "card" ? "vClientCard" : settingsOpen === "history" ? "vHistory" : settingsOpen === "catalog" ? "vCatalog" : settingsOpen === "data" ? "vData" : "vPassword").hidden = false; if (settingsOpen === "packages") renderPackages(); if (settingsOpen === "card") paintCard(); if (settingsOpen === "history") paintHistory(); if (exStale && S.syncedOnce) { exStale = false; if (settingsOpen === "exercises") renderExercises(); else if (settingsOpen === "exercise" && exCurrent && !exDirty()) showExercise(exCurrent.name, exCurrent.key); } $("back").hidden = false; $("brand").hidden = true; } return; }
    if (S.sb && !S.signedIn) { showLogin($("loginMsg").textContent); return; }
    if (S.clientMode && !S.myClientId) { showWaiting(); return; }
    if (celebrating) { hideAllViews(); $("vCelebrate").hidden = false; $("back").hidden = true; $("brand").hidden = false; return; }   // "Nice work" stays up until it hands over to the client page, whatever refreshes meanwhile
    $("vLogin").hidden = true; $("vRecovery").hidden = true; $("vWaiting").hidden = true; $("vCelebrate").hidden = true;
    if (S.clientMode && (S.view.name === "clients" || (S.view.name === "client" && S.view.id !== S.myClientId))) S.view = { name: "client", id: S.myClientId };
    if (S.clientMode && effPaused(clients.get(S.myClientId))) S.view = { name: "client", id: S.myClientId };
    if (S.view.name === "client" && !clients.has(S.view.id)) S.view = S.clientMode ? { name: "client", id: S.myClientId } : { name: "clients" };
    if (S.view.name === "training" && !trainings.has(S.view.id)) S.view = S.clientMode ? { name: "client", id: S.myClientId } : { name: "clients" };
    if (S.view.name === "client" && isTemplateClient(S.view.id) && S.view.program && tplNode("b:" + S.view.program)) { const P = "b:" + S.view.program, F = S.view.phase ? P + "/" + S.view.phase : null, W = F && S.view.stage ? F + "/" + S.view.stage : null; S.view = F && tplNode(F) ? { name: "client", id: TEMPLATES_ID, folder: F, ...(W && tplNode(W) ? { slide: W } : {}) } : { name: "client", id: TEMPLATES_ID, folder: P }; }   // a built-in program's page kept from before the programs became folders (v281): the same place, as a folder
    if (S.view.name === "client" && isTemplateClient(S.view.id) && S.view.folder && !tplNode(S.view.folder)) S.view = { name: "client", id: TEMPLATES_ID };   // a folder of his deleted on another device: the Templates page
    if (S.view.name !== "training" && previewClient) { previewClient = false; rememberPreview(); }
    if (!S.clientMode) document.body.classList.toggle("client", previewing());
    $("vClients").hidden = S.view.name !== "clients";
    $("vClient").hidden = S.view.name !== "client";
    const tabs = S.view.name === "client" && !isTemplateClient(S.view.id); $("tabbar").hidden = !tabs; $("addBtn").hidden = !tabs || S.clientMode; document.body.classList.toggle("tabs", tabs);   // the coach's +: beside the bar on a client's page, on every tab
    const tplPlus = tplPageOn() && !tplOrderOn(); if (tplPlus) $("addBtn").hidden = false; $("addBtn").setAttribute("aria-label", tplPlus ? "New template" : "New workout"); document.body.classList.toggle("tplus", tplPlus); $("dock").classList.toggle("tp", tplPlus);   // the Templates page and his folders: the same glass + alone at the bar's trailing edge, a new template where he is (his ask, 12 Nov)
    const wsDock = S.view.name === "training" && !S.clientMode;     // the coach's workout page: Coach | Client and the + in the bar at the foot, as Photos' (his pick, 10 Nov); the + is not in the client's look
    $("addExBtn").hidden = !wsDock || previewing(); if (!wsDock) $("viewSeg").hidden = true; document.body.classList.toggle("wsdock", wsDock); $("dock").classList.toggle("ws", wsDock);   // its layout marked on the bar itself: a picture's copy of the bar keeps it
    for (const b of $("tabbar").querySelectorAll("button")) { const on = b.dataset.tab === S.tab; b.classList.toggle("on", on); if (on) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current"); }
    $("vTraining").hidden = S.view.name !== "training";
    $("back").hidden = S.view.name === "clients" || (S.clientMode && S.view.name === "client");
    $("brand").hidden = !(S.view.name === "clients" || (S.clientMode && S.view.name === "client"));
    $("meDisc").hidden = !(S.view.name === "client" && !isTemplateClient(S.view.id));   // the person disc: on a client's page, every tab, nowhere else — Settings for the client, the card for the coach
    $("tMore").hidden = !((S.view.name === "training" && moreOn(trainings.get(S.view.id))) || (tplPageOn() && !tplOrderOn())); $("navDone").hidden = !tplOrderOn(); $("tAdd").hidden = !(tplPageOn() && !tplOrderOn()); closeMoreMenu();   // the workout's "…": the client's view (and the coach's Client view) of a workout still to do, Reschedule; the coach's own view of any workout or template, Delete (and Reschedule while it is still to do)
    $("meDisc").setAttribute("aria-label", S.clientMode ? "Settings" : "Client card");
    paintMeDisc(); paintBarMsg();
    if (S.clientMode && S.tab === "notes") setTab("workouts");   // Notes is the coach's tab
    if (!(S.view.name === "client" && S.tab === "workouts" && !isTemplateClient(S.view.id))) { calOpen = false; weekLand(true); if (!(cd && cd.lifted)) weekOff = 0; }   // the month, and a week paged to, last only while their page is up: another page or tab and it is this week's strip again (go() and the settings pages fold them already, before their picture)
    if (S.view.name === "clients") { S.renderedTraining = null; renderClients(); }
    else if (S.view.name === "client") { S.renderedTraining = null; const tf = isTemplateClient(S.view.id) ? tplNode(S.view.folder) : null, up = tf && tplNode(tf.parent); $("backLabel").textContent = tf ? (up ? up.name : "Templates") : isTemplateClient(S.view.id) && S.view.phase ? S.view.program : (isTemplateClient(S.view.id) && S.view.program ? "Templates" : "Clients"); renderClient(); }
    else { const t = trainings.get(S.view.id); $("backLabel").textContent = fromHistory(t) ? "History" : S.clientMode ? "Workouts" : (isTemplateClient(t.clientId) ? "Templates" : (clients.get(t.clientId)?.name || "Client")); renderTraining(t); }
    syncRadios();
    paintDraftBar();
    if (dp) renderDatePicker();
    nav.curKey = screenKey();                                       // the screen just painted, the first one after launch included
  }

  // clients keep the order he sets (c.sort); unsorted ones follow alphabetically
  const clientOrder = (a, b) => ((a.sort ?? Infinity) - (b.sort ?? Infinity)) || String(a.name || "").localeCompare(String(b.name || ""));
  const peopleList = () => [...clients.values()].filter((c) => !isTemplateClient(c.id)).sort(clientOrder);
  const activeList = () => peopleList().filter((c) => !c.paused);
  let reordering = false;
  function moveClientTo(id, j) {
    const list = activeList(); const i = list.findIndex((c) => c.id === id);
    if (i < 0 || j < 0 || j >= list.length || i === j) { render(); return; }
    const [c] = list.splice(i, 1); list.splice(j, 0, c);
    list.forEach((x, k) => { if (x.sort !== k) { x.sort = k; scheduleSave("clients", x.id); } });
    render();                                                          // whatever page is up now (a page that came up mid-drag waited for the drop: renderTemplates holds while a row is under the finger)
  }
  // drag a row by its grip (the three lines, like Apple's reorder handle); the others slide out of the way; the order is saved on release.
  // Only the grip starts a drag, so a finger anywhere else on the card still scrolls the list.
  function dragRow(li, id, drop = moveClientTo) {                    // (drop: where the row's new place goes: a client's order, or his template folders' (v279))
    li.addEventListener("pointerdown", (e) => {
      if (e.button !== 0 && e.pointerType === "mouse") return;
      if (!e.target.closest(".grip")) return;
      dragging = true;
      const ul = li.parentElement, rows = [...ul.children].filter((r) => r.classList.contains("drag-row")), i = rows.indexOf(li);   // (only the rows that move: his folders above the built-in programs, which stay)
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
        dragging = false;
        li.removeEventListener("pointermove", move); li.removeEventListener("pointerup", end); li.removeEventListener("pointercancel", end);
        li.classList.remove("dragging"); rows.forEach((r) => { r.style.transform = ""; });
        drop(id, target);
      };
      li.addEventListener("pointermove", move); li.addEventListener("pointerup", end); li.addEventListener("pointercancel", end);
    });
  }
  function renderClients() {
    if (dragging) return;                                            // a row is under the finger: the list is redrawn once it is put down
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
        const av = document.createElement("span"); av.className = "avatar"; av.setAttribute("aria-hidden", "true");
        const name = document.createElement("span"); name.className = "pn"; name.textContent = c.name;
        const grip = document.createElement("span"); grip.className = "grip"; grip.textContent = "\u2261"; grip.setAttribute("aria-hidden", "true");
        row.append(av, name, grip); li.appendChild(row); dragRow(li, c.id); li._paint = () => paintAvatar(av, c.id, c.name, true);
      } else {
        const b = document.createElement("button"); b.type = "button";
        const words = packWords(c);                                       // "3 of 10", "20 days left" on the right, where the workout count used to be; the purple dot alone says something new happened
        b.innerHTML = `<span class="avatar" aria-hidden="true"></span><span class="nm"><span></span></span><span class="sub"></span>`;   // the photo (or initials), the name, the package words
        const av = b.firstChild; av.nextSibling.firstChild.textContent = c.name; b.lastChild.textContent = words;   // no chevron: the row itself is the way in (his call)
        li._paint = () => paintAvatar(av, c.id, c.name, true);
        b.classList.toggle("news", !!newsWords(clientNews(c)));
        b.addEventListener("click", () => { setTab("workouts"); go({ name: "client", id: c.id }); });
        li.appendChild(b);
      }
      ul.appendChild(li); if (li._paint) li._paint();                  // painted once in the list, so a long list fetches only what scrolls into view
    });
    $("clientEmpty").hidden = list.length > 0 || inactive.length > 0;
    $("clientBar").hidden = !list.length && inactive.length > 0; $("clientList").hidden = !list.length;
    $("inactiveBar").hidden = !inactive.length; $("inactiveList").hidden = !inactive.length;
    $("inactiveList").replaceChildren(...inactive.map((c) => {
      const li = document.createElement("li"); const b = document.createElement("button"); b.type = "button";
      b.innerHTML = `<span class="avatar" aria-hidden="true"></span><span class="pn"></span><span class="sub">Paused</span>`; b.firstChild.nextSibling.textContent = c.name;
      b.addEventListener("click", () => { setTab("workouts"); go({ name: "client", id: c.id }); }); li.appendChild(b); li._paint = () => paintAvatar(b.firstChild, c.id, c.name, true); return li;
    }));
    for (const li of $("inactiveList").children || []) if (li._paint) li._paint();
  }
  $("tplCard").addEventListener("click", () => go({ name: "client", id: TEMPLATES_ID, program: null, phase: null, stage: null }));
  $("reorderBtn").addEventListener("click", () => { reordering = !reordering; renderClients(); });
  // month calendar under the week strip: Week | Month switch, arrows, Today, finger-follow swipe
  let calOpen = false, calMonth = today().slice(0, 7), calFor = null, calAnchor = calMonth, calSliding = false, calMissed = false;   // calMissed: a redraw came while the months were moving (it runs when they land)   // calOpen: the month, only while its page is up (his ask, 10 Nov: back to the week "every time I leave the page"; a reload opens on the week too)
  let wkSliding = false, wkSide = null, wkDraw = null, wkAnchor = null;   // the week strip under a finger or two (or settling: a redraw meanwhile leaves the strip as it is, drawn anew as it lands); how a week is drawn (either side, as a picture) and the strip itself (set by renderClient); this week's Monday when weekOff was last read
  let cd = null, cdEatUntil = 0, weekOff = 0, cdWeekSlide = 0, cdSpent = null, cdSlideTok = 0;   // a workout held or dragged in the calendar ("drag a workout to another day", below the month's pager); the end of the window in which its release's click goes nowhere; the week strip's weeks from this one while a drag turns it; the side its week comes in from
  const NEXT_DAYS = 3, NEXT_STEP = 5;      // "Up next" shows this many days ahead (the very next workout always); each "Show more" adds this many workouts
  let nextExtra = 0, nextFor = null;
  let missOpen = false, missFor = null;   // the Missed card: folded to its newest workout and "2 more", or open (Up next's fold, his pick B, 10 Nov); folded again on another client's page
  const monthAdd = (ym, n) => { const [y, m] = ym.split("-").map(Number); const d = new Date(y, m - 1 + n, 1, 12); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0"); };
  const monthTitle = (ym) => { const [y, m] = ym.split("-").map(Number); return new Date(y, m - 1, 1, 12).toLocaleDateString(undefined, { month: "long", year: "numeric" }); };
  const paintCalMode = () => {                                       // the week strip or the month, and the toggle that says which
    $("weekHead").hidden = calOpen; $("weekView").hidden = calOpen; $("calWrap").hidden = !calOpen; if (!wkSliding) $("weekToday").hidden = calOpen || !weekOff;   // (while the weeks slide, Today is the week coming in's, set as it set off)
    $("calToggleText").textContent = calOpen ? "Week" : "Month"; $("calToggle").classList.toggle("open", calOpen); $("calToggle").setAttribute("aria-expanded", String(calOpen));
    if (!calOpen) fitChips($("week"));                                // the strip just drawn, or shown again as the month folds: which names fade
  };
  function calFold() {                                               // the page is being left: the month folds back into the week, and a week paged to comes back to this one (his pick, 13 Nov: "Leaving the client's page brings it back to this week"), first, so the picture the swipe back slides in and the place Back comes back to are this week's; returns how far the page scrolled
    const landed = weekLand(true);                                   // a slide still landing lands where it was going (nothing else redrawn: the page is being left)
    const paged = !!weekOff && !(cd && cd.lifted);
    if (paged) weekOff = 0;
    if (!calOpen && !paged && !landed) return 0;
    calOpen = false;
    if (S.view.name !== "client" || $("vClient").hidden || S.tab !== "workouts" || !clients.has(S.view.id)) return 0;   // not on the screen: its next draw is this week's strip
    const de = document.documentElement, y0 = Number(window.scrollY) || 0, h0 = Number(de.scrollHeight);
    if ((paged || landed) && wkDraw) wkDraw();                       // this week's strip, drawn alone (a whole redraw here would sweep away the empty workout being opened)
    paintCalMode();
    const d = Number(de.scrollHeight) - h0;                          // the week is shorter than the month, and one week's strip may be taller than another's: everything under it moved by as much
    if (!y0 || !Number.isFinite(d) || !d) return 0;
    window.scrollTo(0, Math.max(0, y0 + d));                         // so the list stays where it was on the screen (scrolled into the month: the top)
    return (Number(window.scrollY) || 0) - y0;
  }
  $("calToggle").addEventListener("click", () => {
    weekLand(true); wkRoll();                                        // a week still sliding in lands first: Month opens on its month
    calOpen = !calOpen; if (calOpen) { calAnchor = today().slice(0, 7); calMonth = weekOff ? wkMonth() : calAnchor; if (S.view.name === "client") calFor = S.view.id; }   // the month of the week shown (its Thursday's, as weeks are counted), this month for this week; anchored here for this client (else its first draw would take it back to this month)
    if (S.view.name === "client") renderClient();
  });
  $("dpCancel").addEventListener("click", (e) => { if (dpSettled(e)) closeDatePicker(); });
  $("esKeep").addEventListener("click", closeFinishEarly);
  $("esGo").addEventListener("click", finishEarlyNow);
  $("earlySheet").addEventListener("click", (e) => { if (e.target === $("earlySheet")) closeFinishEarly(); });
  $("esReasons").addEventListener("click", (e) => {
    const b = e.target.closest("button"); if (!b || !es) return;
    const on = !b.classList.contains("on");                          // tap again to clear
    for (const x of $("esReasons").querySelectorAll("button")) { x.classList.toggle("on", on && x === b); x.setAttribute("aria-pressed", String(on && x === b)); }
    es.reason = on ? b.dataset.reason : "";
  });
  $("datePick").addEventListener("click", (e) => { if (e.target === $("datePick") && dpSettled(e)) closeDatePicker(); });
  $("dpPrev").addEventListener("click", () => { if (dp && dpIdx > 0) dpShow(dp.months[dpIdx - 1], true); });   // two quick taps: two months (the index is already the first slide's end)
  $("dpNext").addEventListener("click", () => { if (dp && dpIdx < dp.months.length - 1) dpShow(dp.months[dpIdx + 1], true); });
  $("dpToday").addEventListener("click", () => { if (dp) dpShow(today().slice(0, 7), true); });
  { const g = $("dpGrid"); let sx = null, sy = null, base = 0, drag = null, pts = [], swallow = false, gw = 1, pid = null, ptype = "";
    const at = () => { const t = dpTrack(), m = t && getComputedStyle(t).transform, w = dpW() || 1; if (!m || m === "none") return -dpIdx * w; const v = /matrix(3d)?\(([^)]+)\)/.exec(m); if (!v) return -dpIdx * w; const n = v[2].split(",").map(Number); return v[1] ? n[12] : n[4]; };   // where the track is, mid-settle too
    g.addEventListener("pointerdown", (e) => {
      if (!e.isPrimary || wx !== null) return;                       // a second finger is not a new touch: the first one's slide goes on (and two fingers holding the months keep them)
      if (e.pointerType === "mouse" && (e.button !== 0 || e.ctrlKey)) return;   // a right-click or a Control-click: its menu takes the release, so it never starts a drag
      g.classList.remove("dragged"); swallow = false;                // a new touch: the day under it may show its press again
      if (!dp) return; pid = e.pointerId; ptype = e.pointerType || ""; sx = e.clientX; sy = e.clientY; drag = null; pts = [[e.timeStamp, e.clientX]]; gw = dpW() || 1; dpTouching = true;
      if (Math.abs(at() + dpIdx * gw) > 1) { swallow = true; if (e.pointerType !== "mouse") g.classList.add("dragged"); }   // the months still settling: this touch only catches them, and its tap picks no day (as in UIKit)
    });
    g.addEventListener("pointermove", (e) => {
      if (sx === null || !dp || e.pointerId !== pid) return; const dx = e.clientX - sx, dy = e.clientY - sy;
      if (drag === null) {
        if (Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy)) {      // caught where it is, a settling month too, and moved from there 1:1
          drag = true; base = at(); sx = e.clientX; try { g.setPointerCapture(e.pointerId); } catch (_) {}
          const lo = -(dp.months.length - 1) * gw; if (base > 0) base *= 3; else if (base < lo) base = lo + (base - lo) * 3;   // caught bouncing back from past the first or the last month: where it is on screen is already a third of the pull, so the pull is put back and nothing jumps
        }
        else if (Math.abs(dy) > 8) drag = false;
        if (drag !== null && e.pointerType !== "mouse") g.classList.add("dragged");   // not a tap: the day the finger landed on lets go of its grey
      }
      if (!drag) return;                                             // not decided yet, or the finger went up or down first: the months stay where they are
      if (e.timeStamp - pts[pts.length - 1][0] >= 10) { pts.push([e.timeStamp, e.clientX]); if (pts.length > 4) pts.shift(); }
      const w = gw, lo = -(dp.months.length - 1) * w; let x = base + (e.clientX - sx);
      if (x > 0) x /= 3; else if (x < lo) x = lo + (x - lo) / 3;     // past the first or the last month it gives a little, as a scroll view does
      dpPlace(x, null);
    });
    const release = (e, cancel) => {
      if (sx === null || (e && e.pointerId !== pid)) return; const was = drag; sx = sy = null; drag = null; pid = null;   // only the finger that began it ends it
      if (!was || !dp) { dpTouching = false; if (dpStale) { dpStale = false; setTimeout(renderDatePicker, 400); } return; }   // a tap: a redraw that waited goes once its click has picked the day (iPhone sends the click a moment after the lift)
      swallow = true;                                                // the click a slide can still bring (iPhone sends it a moment later, not in this task) picks no day; the next touch clears this
      const w = gw, x = at(), last = pts[pts.length - 1], rested = e && e.timeStamp - last[0] > 60;
      const recent = pts.filter((p) => last[0] - p[0] <= 100), first = recent[0];   // the speed over the last tenth of a second, as UIKit measures it: a rest before a flick does not water the flick down
      const v = rested || recent.length < 2 ? 0 : (last[1] - first[1]) / (last[0] - first[0]);   // px per ms; a finger that stopped has none
      let i = Math.round(-x / w);
      if (!cancel && Math.abs(v) > 0.3) i = v < 0 ? Math.floor(-x / w) + 1 : Math.ceil(-x / w) - 1;   // a flick goes on a month the way it went
      i = Math.max(0, Math.min(dp.months.length - 1, i));
      const to = -i * w, left = to - x, v0 = Math.abs(left) > 1 ? v * 1000 / left : 0;   // the finger's speed toward the month, in whole distances a second
      dpIdx = i; dpSync(); dpTouching = false;
      dpPlace(to, calmMotion() ? null : springEase(Math.max(-15, Math.min(15, v0)), 0.3, 1));
      if (dpStale) { dpStale = false; setTimeout(renderDatePicker, 400); }   // a redraw that waited: once the month has settled
    };
    g.addEventListener("pointerup", (e) => release(e, false)); g.addEventListener("pointercancel", (e) => release(e, true));
    document.addEventListener("pointerup", (e) => { if (sx !== null && !g.contains(e.target)) release(e, false); }, true);   // let go outside the months (a press that went up or down first, never captured): it ends there too, or the months would wait on it
    document.addEventListener("pointercancel", (e) => { if (sx !== null && !g.contains(e.target)) release(e, true); }, true);
    let wx = null, wbase = 0;                                        // two fingers' travel, and where the months were when they took them
    dpWheel = {                                                      // two fingers on a Mac's trackpad: the months follow them, a month at most either way of the one shown, and settle by the finger's rule (the nearer month; the coasting carries a flick on, as a flick goes on)
      begin() {                                                      // caught where they are, still settling too
        if (!dp || sx !== null) return false; gw = dpW() || 1; wbase = at(); wx = 0; dpTouching = true;
        const lo = -(dp.months.length - 1) * gw; if (wbase > 0) wbase *= 3; else if (wbase < lo) wbase = lo + (wbase - lo) * 3;   // caught bouncing back from past the first or the last month: on screen it is a third of the pull, so the pull is put back and nothing jumps (as under a finger)
        return true;
      },
      move(d) {
        if (wx === null || !dp) return true;
        const w = gw, lo = -(dp.months.length - 1) * w, min = -(dpIdx + 1) * w - wbase, max = -(dpIdx - 1) * w - wbase;
        wx = Math.max(min, Math.min(max, wx + d)); let x = wbase + wx;
        if (x > 0) x /= 3; else if (x < lo) x = lo + (x - lo) / 3;   // past the first or the last month it gives a little, as under a finger
        dpPlace(x, null); return wx <= min || wx >= max;             // true: a whole month over
      },
      end() {
        if (wx === null) return; const x = wbase + wx; wx = null;
        if (dp) { const i = Math.max(0, Math.min(dp.months.length - 1, dpIdx + monthLetGo("dp", x + dpIdx * gw, gw))); dpIdx = i; dpSync(); dpPlace(-i * gw, calmMotion() ? null : springEase(0, 0.3, 1)); }
        dpTouching = false; if (dpStale) { dpStale = false; setTimeout(renderDatePicker, 400); }   // a redraw that waited: once the month has settled
      },
    };
    g.addEventListener("click", (e) => { if (swallow && e.detail !== 0) { swallow = false; e.stopPropagation(); e.preventDefault(); } else if (!dpSettled(e) && ptype !== "mouse") g.classList.add("dragged"); }, true);   // a keyboard's Enter (detail 0) is never a slide's click; a tap the days take no notice of yet (their first 350 ms) lets go of its day's grey, as a catch does
    if (typeof window !== "undefined" && window.addEventListener) window.addEventListener("resize", () => { if (dp) dpShow(dp.month, false); });   // turned: the month stays the one shown
  }
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && dp) closeDatePicker(); if (e.key === "Escape" && es) closeFinishEarly(); });
  $("calToday").addEventListener("click", () => { calMonth = today().slice(0, 7); calAnchor = calMonth; if (S.view.name === "client") renderClient(); });
  {
    const view_ = $("calView"), track = $("calTrack");
    const reduced = () => window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let busy = false, sx = null, sy = null, dragging = null, dx = 0, swallow = false, finishNow = null, cpid = null, lostT = null, at = 0;   // at: where a finger or two fingers left the months (px)
    const settle = (dir) => {                      // slide to the neighbour panel, then re-render around the new month
      if (busy) { if (finishNow) finishNow(); else return; }
      busy = true; calSliding = true;
      if (dir) { calMonth = monthAdd(calMonth, dir); $("calTitle").textContent = monthTitle(calMonth); $("calToday").hidden = calMonth === today().slice(0, 7); }
      const target = track.children[1 + (dir || 0)];
      void view_.offsetHeight; view_.style.transition = "";
      if (target) view_.style.height = target.offsetHeight + "px";
      let done = false;
      const finish = () => { if (done) return; done = true; finishNow = null; track.removeEventListener("transitionend", finish); busy = false; calSliding = false; view_.style.transition = ""; if ((dir || calMissed) && S.view.name === "client") { calMissed = false; renderClient(); } else view_.style.height = track.children[1].offsetHeight + "px"; };
      finishNow = finish;
      const still = Math.abs(-(dir || 0) * Math.max(1, view_.clientWidth) - at) < 1; at = 0;   // the fingers carried it all the way (a whole month's flick): nothing left to move, nothing to wait for (v285, as the week's)
      if (reduced() || still) { track.style.transition = "none"; track.style.transform = "translateX(" + (-100 - (dir || 0) * 100) + "%)"; finish(); return; }
      track.addEventListener("transitionend", finish);
      track.style.transition = "transform 280ms cubic-bezier(0.22, 1, 0.36, 1)";
      track.style.transform = "translateX(" + (-100 - (dir || 0) * 100) + "%)";
      setTimeout(finish, 360);
    };
    $("calPrev").addEventListener("click", () => settle(-1));
    $("calNext").addEventListener("click", () => settle(1));
    const follow = (x) => {                        // the months x px from where they rest, the height easing toward the month coming in
      at = x; track.style.transition = "none"; track.style.transform = "translateX(calc(-100% + " + x + "px))";
      const centre = track.children[1], side = track.children[x < 0 ? 2 : 0];
      if (centre && side) { const f = Math.min(1, Math.abs(x) / Math.max(1, view_.clientWidth)); view_.style.transition = "none"; view_.style.height = Math.round(centre.offsetHeight + (side.offsetHeight - centre.offsetHeight) * f) + "px"; }
    };
    let wx = null;                                 // two fingers' travel, while they hold the months
    calWheel = {                                   // two fingers on a Mac's trackpad (the wheel's rules make the gesture): the months follow them, a month at most, and settle by the finger's rule
      begin() { if (busy && finishNow) finishNow(); if (busy || sx !== null || cdHolds()) return false; wx = 0; calSliding = true; return true; },   // (a slide still landing lands at once, as a touch catches it; a finger or the mouse on it keeps it)
      move(d) { if (wx === null) return true; const w = Math.max(1, view_.clientWidth); wx = Math.max(-w, Math.min(w, wx + d)); follow(wx); return Math.abs(wx) >= w; },   // true: a whole month over
      end() { if (wx === null) return; const x = wx; wx = null; calSliding = false; settle(monthLetGo("cal", x, view_.clientWidth)); },
    };
    calPage = (dir) => settle(dir); calBusy = () => busy || dragging === true || wx !== null; calForget = () => { sx = sy = null; dragging = null; dx = 0; };   // (calForget: a press that lifted a workout is the drag's to the end, never a swipe of the months, even once the drag is called off with the finger still down)   // a workout held at the month's edge turns it, as an arrow does; a press on a chip while the months move under a finger or slide lifts nothing
    view_.addEventListener("pointerdown", (e) => { if (!e.isPrimary || wx !== null) return; view_.classList.remove("dragged"); if (e.pointerType === "mouse" && (e.button !== 0 || e.ctrlKey)) return; if (sx !== null) release(true); if (busy && finishNow) finishNow(); if (busy) return; sx = e.clientX; sy = e.clientY; dragging = null; dx = 0; cpid = e.pointerId; });   // (two fingers holding the months keep them; a right-click or a Control-click never starts a drag: its menu takes the release)
    view_.addEventListener("pointermove", (e) => {
      if (sx === null || busy || !e.isPrimary || cdHolds()) return;
      if (e.pointerType === "mouse" && e.buttons === 0) { if (!lostT) lostT = setTimeout(() => { lostT = null; release(true); }, 150); return; }   // the button already up and no release yet (a Mac's lost to the window, or a menu took it): back where it was, as the drag's (v285, as the week's)
      dx = e.clientX - sx; const dy = e.clientY - sy;
      if (dragging === null) { if (Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy)) { dragging = true; try { view_.setPointerCapture(e.pointerId); } catch {} } else if (Math.abs(dy) > 8) dragging = false; if (dragging !== null && e.pointerType !== "mouse") view_.classList.add("dragged"); }   // not a tap: the day the finger landed on lets go of its grey
      if (dragging) follow(dx);
    });
    const release = (cancel) => {
      clearTimeout(lostT); lostT = null;
      if (sx === null) return; const was = dragging; const moved = dx; sx = sy = null; dragging = null; dx = 0;
      if (!was) return;
      swallow = true; setTimeout(() => { swallow = false; }, 0);
      settle(cancel ? 0 : monthLetGo("cal", moved, view_.clientWidth));
    };
    view_.addEventListener("pointerup", (e) => { if (e.pointerId === cpid) release(false); });   // only the finger that took the months lets them go (a second one lifted is no release; v285, as the week's)
    view_.addEventListener("pointercancel", (e) => { if (e.pointerId === cpid) release(true); });
    document.addEventListener("pointerup", (e) => { if (sx !== null && e.pointerId === cpid && !view_.contains(e.target)) release(false); }, true);   // its own press let go outside the month (one that went up or down first, never captured): it ends there too, or two fingers would wait on it for good
    document.addEventListener("pointercancel", (e) => { if (sx !== null && e.pointerId === cpid && !view_.contains(e.target)) release(true); }, true);
    view_.addEventListener("click", (e) => { if (swallow) { e.stopPropagation(); e.preventDefault(); } }, true);
  }
  // ---------- the week strip pages week by week (his ask, 13 Nov: "we should add the ability to slide between weeks as well right and left
  // swipe between weeks"; his pick: as the month does). Last week, this one and the next sit side by side on a track (index.html .week-track):
  // the weeks either side are drawn as a finger takes the strip, it follows the finger 1:1 (held after 8 points sideways, as the month's) with
  // its height easing toward the week coming in, and let go it settles on that week (past 48 points, or flicked) or back, in the month's 280 ms;
  // the strip is then drawn anew for that week. Two fingers on a Mac's trackpad do the same, a week at most. Today (beside Month) comes back to
  // this week; leaving the page does too (calFold). A workout held on the strip is the drag's (cd*), never a swipe of the weeks.
  const wkMonday = (off) => { const m = new Date(); m.setHours(12, 0, 0, 0); m.setDate(m.getDate() - ((m.getDay() + 6) % 7) + off * 7); return m; };   // the Monday of the week off weeks from this one
  const wkRoll = (redraw) => {                                       // a new week begun (Sunday's midnight) since the strip was drawn: the week on screen stays the one weekOff counts to (from the new week), as a browsed month stays, so a touch on it pages from what it shows; a redraw shows this week if this week was shown. True if a week had begun.
    const m = localIso(wkMonday(0)), rolled = !!wkAnchor && wkAnchor !== m;
    if (rolled && (weekOff || !redraw)) weekOff -= Math.round((Date.parse(m) - Date.parse(wkAnchor)) / 6048e5);
    wkAnchor = m; return rolled;
  };
  const wkMonth = () => { const m = wkMonday(weekOff); m.setDate(m.getDate() + 3); return localIso(m).slice(0, 7); };   // the month of the week shown: its Thursday's
  const wkHead = (off) => { const mo = wkMonday(off), su = new Date(mo); su.setDate(mo.getDate() + 6); return mo.getMonth() === su.getMonth() ? mo.toLocaleDateString(undefined, { month: "long" }) : mo.toLocaleDateString(undefined, { month: "short" }) + " \u2013 " + su.toLocaleDateString(undefined, { month: "short" }); };   // the strip's title: the month it is in, as Calendar's ("November", or "Nov \u2013 Dec" when it straddles)
  {
    const view_ = $("weekView"), track = $("weekTrack");
    let busy = false, sx = null, sy = null, dragging = null, dx = 0, swallow = false, finishNow = null, cpid = null, drawn = false, wx = null, lostT = null, at = 0;   // at: where a finger or two fingers left the weeks (px)
    const sides = () => { if (drawn || !wkSide) return; drawn = true; wkRoll(); wkSide($("weekPrev"), weekOff - 1); wkSide($("weekNext"), weekOff + 1); };   // the weeks either side, drawn as the strip is taken
    const settle = (dir) => {                      // slide to the week that way (0: back), then draw the strip anew for it
      if (busy) { if (finishNow) finishNow(); else return; }
      if (!view_.style.height) { view_.style.transition = "none"; view_.style.height = view_.offsetHeight + "px"; }   // at rest its height is auto, from which nothing eases: this week's height now, first (once the weeks either side are drawn it would be the tallest of the three)
      busy = true; wkSliding = true; sides(); const page = viewKey(S.view);   // the page it began on: one left meanwhile keeps this week (calFold)
      if (dir) { $("weekHead").textContent = wkHead(weekOff + dir); $("weekToday").hidden = calOpen || !(weekOff + dir); }   // the month's name and Today as it sets off, as the month's title
      const target = track.children[1 + (dir || 0)];
      void view_.offsetHeight; view_.style.transition = "";
      if (target) view_.style.height = target.offsetHeight + "px";
      let done = false;
      const finish = (e, quiet) => {
        if (done || (e && e.type === "transitionend" && (e.target !== track || e.propertyName !== "transform"))) return;   // (a day's own fade ending under it bubbles up here too: not the slide's end)
        done = true; finishNow = null; track.removeEventListener("transitionend", finish);
        busy = false; wkSliding = false; drawn = false; if (viewKey(S.view) === page) weekOff += dir || 0;
        track.style.transition = "none"; track.style.transform = ""; view_.style.transition = ""; view_.style.height = "";
        $("weekPrev").replaceChildren(); $("weekNext").replaceChildren();
        if (!quiet && S.view.name === "client" && clients.has(S.view.id)) renderClient();   // the strip for the week it landed on (and anything a sync brought meanwhile); quiet: the caller draws (Month) or the page is being left (calFold)
      };
      finishNow = (quiet) => finish(null, quiet);
      const still = Math.abs(-(dir || 0) * Math.max(1, view_.clientWidth) - at) < 1; at = 0;   // the fingers carried it all the way (a whole week's flick): nothing left to move, nothing to wait for
      if (calmMotion() || still) { finish(); return; }
      track.addEventListener("transitionend", finish);
      track.style.transition = "transform 280ms cubic-bezier(0.22, 1, 0.36, 1)";
      track.style.transform = "translateX(" + (-100 - (dir || 0) * 100) + "%)";
      setTimeout(finish, 360);
    };
    const follow = (x) => {                        // the weeks x px from where they rest, the height easing toward the week coming in
      sides(); at = x; track.style.transition = "none"; track.style.transform = "translateX(calc(-100% + " + x + "px))";
      const centre = track.children[1], side = track.children[x < 0 ? 2 : 0];
      if (centre && side) { const f = Math.min(1, Math.abs(x) / Math.max(1, view_.clientWidth)); view_.style.transition = "none"; view_.style.height = Math.round(centre.offsetHeight + (side.offsetHeight - centre.offsetHeight) * f) + "px"; }
    };
    weekWheel = {                                  // two fingers on a Mac's trackpad: the weeks follow them, a week at most, and settle by the finger's rule
      begin() { if (busy && finishNow) finishNow(); if (busy || sx !== null || cdHolds()) return false; wx = 0; wkSliding = true; return true; },
      move(d) { if (wx === null) return true; const w = Math.max(1, view_.clientWidth); wx = Math.max(-w, Math.min(w, wx + d)); follow(wx); return Math.abs(wx) >= w; },   // true: a whole week over
      end() { if (wx === null) return; const x = wx; wx = null; settle(monthLetGo("cal", x, view_.clientWidth)); },
    };
    weekPage = (dir) => settle(dir); weekLand = (quiet) => { if (!(busy && finishNow)) return false; finishNow(quiet); return true; }; weekBusy = () => busy || dragging === true || wx !== null; weekForget = () => { if (dragging === true) { drawn = false; wkSliding = false; at = 0; track.style.transition = "none"; track.style.transform = ""; view_.style.height = ""; } sx = sy = null; dragging = null; dx = 0; };   // (weekForget: a press that lifted a workout is the drag's to the end)
    view_.addEventListener("pointerdown", (e) => { if (!e.isPrimary || wx !== null) return; view_.classList.remove("dragged"); if (e.pointerType === "mouse" && (e.button !== 0 || e.ctrlKey)) return; if (sx !== null) release(true); if (busy && finishNow) finishNow(); if (busy) return; sx = e.clientX; sy = e.clientY; dragging = null; dx = 0; cpid = e.pointerId; });   // (a press that never ended, its release lost: back where it was first)
    view_.addEventListener("pointermove", (e) => {
      if (sx === null || busy || !e.isPrimary || cdHolds()) return;
      if (e.pointerType === "mouse" && e.buttons === 0) { if (!lostT) lostT = setTimeout(() => { lostT = null; release(true); }, 150); return; }   // the button already up and no release yet (a Mac's lost to the window, or a menu took it): back where it was, as the drag's
      dx = e.clientX - sx; const dy = e.clientY - sy;
      if (dragging === null) { if (Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy)) { dragging = true; wkSliding = true; try { view_.setPointerCapture(e.pointerId); } catch {} } else if (Math.abs(dy) > 8) dragging = false; if (dragging !== null && e.pointerType !== "mouse") view_.classList.add("dragged"); }   // not a tap: the day the finger landed on lets go of its grey
      if (dragging) follow(dx);
    });
    const release = (cancel) => {
      clearTimeout(lostT); lostT = null;
      if (sx === null) return; const was = dragging, moved = dx; sx = sy = null; dragging = null; dx = 0;
      if (!was) return;
      swallow = true; setTimeout(() => { swallow = false; }, 0);
      settle(cancel ? 0 : monthLetGo("cal", moved, view_.clientWidth));
    };
    view_.addEventListener("pointerup", (e) => { if (e.pointerId === cpid) release(false); });   // only the finger that took the strip lets it go (a second one lifted is no release)
    view_.addEventListener("pointercancel", (e) => { if (e.pointerId === cpid) release(true); });
    document.addEventListener("pointerup", (e) => { if (sx !== null && e.pointerId === cpid && !view_.contains(e.target)) release(false); }, true);   // its own press let go outside the strip (one that went up or down first, never captured): it ends there too
    document.addEventListener("pointercancel", (e) => { if (sx !== null && e.pointerId === cpid && !view_.contains(e.target)) release(true); }, true);
    view_.addEventListener("click", (e) => { if (swallow) { e.stopPropagation(); e.preventDefault(); } }, true);
    $("weekToday").addEventListener("click", () => {                   // back to this week: slid from the next or last one, else coming in from that side
      if (busy && finishNow) finishNow();                              // a week still sliding in lands first (Today shows as it sets off)
      const rolled = wkRoll();
      if (!weekOff || calOpen || busy) { if (rolled && !calOpen && !busy && S.view.name === "client" && clients.has(S.view.id)) renderClient(); return; }   // (a new week begun since: the week shown is this one now, drawn anew with today on it and no Today)
      if (Math.abs(weekOff) === 1) { settle(-weekOff); return; }
      cdWeekSlide = weekOff > 0 ? -1 : 1; weekOff = 0; if (S.view.name === "client" && clients.has(S.view.id)) renderClient();
    });
  }

  // ---------- drag a workout to another day (his ask, 11 Nov: "when you press and hold on the workout only in calendar view .. both week and
  // month you feel the little apple vibration, the name enlarges and I can hold and drag to a different day to reschedule the workout … every
  // day behind today that has passed gets obviously gray so it's obvious I can't move the workout there … if I drag it all the way to the
  // corner it slides to the next month. It's obviously click and hold on Mac"; his picks: workouts still to do and missed ones inside their
  // week, in the coach's view and the client's, by Reschedule's own rules; a hold let go where it was settles back; held at the left or right
  // edge, the month turns (in the week strip, the week) after half a second, and on while it stays there). Measured on Apple Calendar's month
  // view (iOS 27, the test iPhone and his screenshot): nothing shows for the first moment of the hold; then a copy of the event lifts, 1.6 of
  // the day's width (92 of 57) and 20 tall, its words a size up (a cap of 9.7 for 7.0), in its colour with white words, centred over the
  // finger with its middle 28 above it; the event itself stays in its day until the drop; the day under the finger is filled (#191919 on
  // black, #f2f2f2 on white). A day gone by takes nothing, in the coach's view too (his rule for the drag: his Reschedule still reaches back).
  const CD_MS = 400, CD_SLOP = 8, CD_MSLOP = 4, CD_EDGE = 28, CD_DWELL = 500, CD_REPEAT = 900, CD_RISE = 28, CD_WIDE = 1.6, CD_H = 20;   // the hold (as every touch and hold here), the drift that lets go of it (a finger: the month's own 8 to start its slide; a mouse: 4), the edge, the wait there, then each next turn, and the copy's place and size
  function cdHolds() { return !!(cd && cd.lifted); }                  // a workout lifted: a sync's redraw waits, and the months stand still under it
  const cdLive = (n) => !!n && n.isConnected !== false;
  const cdUp = (n, test) => { for (let e = n, i = 0; e && i < 40; e = e.parentElement, i++) if (test(e)) return e; return null; };   // (a page is never 40 deep under its chips)
  const cdHas = (n, c) => typeof (n && n.className) === "string" && (" " + n.className + " ").includes(" " + c + " ");
  const cdDayOf = (n) => cdUp(n, (e) => !!(e.dataset && e.dataset.day) && e.tagName === "BUTTON");
  const cdWeekAgo = () => { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() - 7); return localIso(d); };
  const cdCan = (t) => !!t && canSwipeRow(t) && S.view.name === "client" && !!effDate(t) && effDate(t) >= cdWeekAgo();   // still to do (a missed one within its week, as the Missed card keeps it), on the client's page
  const cdHost = () => (calOpen ? ($("calTrack").children || [])[1] || null : $("week"));   // the days on screen: the month's middle panel, or the strip
  const cdDays = () => { const h = cdHost(), grid = calOpen ? ((h && h.children) || [])[0] : h; return [...((grid && grid.children) || [])].filter((b) => b.dataset && b.dataset.day); };
  function cdItem(target) {                                           // the chip a press is on, if its workout can move: on the days on screen
    const chip = cdUp(target, (e) => cdHas(e, "day-ev") && !!(e.dataset && e.dataset.tid)), host = cdHost();
    if (!chip || !host || !cdUp(chip, (e) => e === host)) return null;
    return cdCan(trainings.get(chip.dataset.tid)) ? chip : null;
  }
  const cdTick = () => haptic();                                    // as a moved workout lands: Android's buzz; an iPhone gives a web page no tick in a drag (his phone stayed silent at the lift, at the landing, and under iOS's own drag and drop; his word, 12 Nov: "let's not worry about the tick at all")
  function cdStart(chip, x, y, id, mouse) {
    const day = cdDayOf(chip);
    cd = { tid: chip.dataset.tid, chip, from: day ? day.dataset.day : "", x0: x, y0: y, x, y, id, mouse, lifted: false, timer: setTimeout(cdLift, CD_MS), ac: null, box: null, w: 0, on: null, key: null, edge: 0, edgeT: null, raf: 0, follow: false, lost: null, wr: null };
  }
  function cdQuiet(g) {                                                // its timers and its listeners on the element it began on
    clearTimeout(g.timer); g.timer = null; clearTimeout(g.edgeT); g.edgeT = null; clearTimeout(g.lost); g.lost = null; if (g.raf && typeof cancelAnimationFrame === "function") cancelAnimationFrame(g.raf); g.raf = 0;
    if (g.ac) { g.ac.abort(); g.ac = null; }
  }
  function cdOff() { const g = cd; if (!g) return; cdQuiet(g); cd = null; }   // let go before the lift: a tap (its click opens the preview, as ever), a scroll, the months' slide
  function cdLift() {                                                  // 0.4 s: the copy lifts out of the chip and grows over the finger, the day under it filled, the days gone by grey
    const g = cd; if (!g) return; g.timer = null;
    const t = trainings.get(g.tid);
    if (!cdLive(g.chip)) { const c = cdChip(g.tid), d = c && cdDayOf(c); if (d && d.dataset.day === g.from) g.chip = c; }   // a redraw during the hold (a sync's) drew the chip anew: the same workout in the same day is the one held
    if (!cdLive(g.chip) || !cdCan(t) || held() || calSliding || calBusy() || wkSliding || weekBusy() || (S.view.name !== "client")) { cdOff(); return; }
    g.lifted = true; if (calOpen) calForget(); else weekForget();
    const r = g.chip.getBoundingClientRect(), day = cdDayOf(g.chip), dr = day ? day.getBoundingClientRect() : r;
    const w = Math.round(Math.max(r.width || 0, (dr.width || r.width || 0) * CD_WIDE)), box = document.createElement("div"), n = document.createElement("span");
    box.id = "calDrag"; box.className = cdHas(g.chip, "miss") ? "miss" : "plan"; box.setAttribute("aria-hidden", "true");
    n.textContent = String(t.title || "").trim() || "Workout"; box.appendChild(n); box.style.width = w + "px";
    const old = document.getElementById ? document.getElementById("calDrag") : null; if (old && old.remove) old.remove();
    document.body.appendChild(box); g.box = box; g.w = w;
    box.style.transition = "none"; box.style.transform = "translate3d(" + (r.left || 0) + "px," + (r.top || 0) + "px,0) scale(" + ((r.width || w) / w) + "," + ((r.height || CD_H) / CD_H) + ")";   // from the chip's own place and size
    void box.offsetWidth;
    if (!calmMotion()) box.style.transition = "transform 200ms cubic-bezier(0.25, 0.1, 0.25, 1)";
    cdPlace(g.x, g.y);
    if (!calOpen) { const wk = $("week"); g.wr = wk.getBoundingClientRect(); if (g.wr.height > 0) wk.style.minHeight = g.wr.height + "px"; }   // the strip's place, measured once: its days are its seven columns (a week turned in has fewer names, and a shorter strip, under the same finger), and it keeps its height meanwhile
    document.body.classList.add("cal-drag");
    try { const sel = window.getSelection && window.getSelection(); if (sel && sel.removeAllRanges) sel.removeAllRanges(); } catch (_) {}   // (a Mac's press may have begun a selection)
    cdHover(g.x, g.y);
  }
  function cdPlace(x, y) {                                             // the copy centred over the finger, its middle 28 above it, kept on the screen
    const g = cd; if (!g || !g.box) return;
    const vw = (document.documentElement && document.documentElement.clientWidth) || window.innerWidth || 0;
    const left = Math.max(4, Math.min((vw || x + g.w) - 4 - g.w, x - g.w / 2)), top = y - CD_RISE - CD_H / 2;
    g.box.style.transform = "translate3d(" + Math.round(left) + "px," + Math.round(top) + "px,0)";
  }
  function cdHover(x, y) {                                             // the day under the finger: filled where the workout can land (today on), nothing on a day gone by
    const g = cd; if (!g || !g.lifted) return;
    let on = null;
    if (!calOpen) { const wr = g.wr; if (wr && wr.width > 0 && x >= wr.left && x < wr.right && y >= wr.top - 40 && y < wr.bottom + 60) on = cdDays()[Math.min(6, Math.floor((x - wr.left) / (wr.width / 7)))] || null; }   // the strip: the column under the finger (a little above or below it too)
    else if (!calSliding) for (const b of cdDays()) { const q = b.getBoundingClientRect(); if (x >= q.left && x < q.right && y >= q.top && y < q.bottom) { on = b; break; } }   // the month: the day under the finger (none while the months slide: found again as they land)
    const key = on && on.dataset.day >= today() ? on.dataset.day : null;
    if (g.on && (g.on !== on || !key)) g.on.classList.remove("drop-on");
    g.on = key ? on : null; g.key = key; if (g.on) g.on.classList.add("drop-on");
    const host = calOpen ? $("calView") : null, hr = host ? host.getBoundingClientRect() : g.wr;
    const level = !!hr && y >= hr.top - (calOpen ? 0 : 40) && y < hr.bottom + (calOpen ? 0 : 60), ez = hr ? Math.min(CD_EDGE, (hr.right - hr.left) / 28) : 0;   // the edge: the calendar's rim (a quarter of a day at most, so never a day's middle: a phone's Sunday is 53 wide) and the margin beyond it, level with the calendar
    const dir = !hr || !(hr.right > hr.left) || !level ? 0 : x < hr.left + ez ? -1 : x > hr.right - ez ? 1 : 0;
    if (dir !== g.edge) { clearTimeout(g.edgeT); g.edgeT = null; g.edge = dir; if (dir && cdCanTurn(dir)) g.edgeT = setTimeout(cdTurn, CD_DWELL); }
  }
  const cdCanTurn = (dir) => dir > 0 || (calOpen ? calMonth > today().slice(0, 7) : weekOff > 0);   // never back past this month (or week): every day there is gone by
  function cdTurn() {                                                  // held at the edge: the next month (or week) that way, again while it stays there
    const g = cd; if (!g || !g.lifted || !g.edge) return; g.edgeT = null;
    if (S.view.name !== "client" || !clients.has(S.view.id)) { cdBack(); return; }   // the page or its client went meanwhile: nothing to turn
    if (!cdCanTurn(g.edge)) return;
    if (g.on) { g.on.classList.remove("drop-on"); g.on = null; g.key = null; }
    if (calOpen) { if (calPage) calPage(g.edge); }
    else { weekOff += g.edge; cdWeekSlide = g.edge; renderClient(); }
    setTimeout(() => { if (cd === g) cdHover(g.x, g.y); }, calOpen ? 380 : 0);   // the day under the finger once the month has landed (its slide 280 ms, its last word 360)
    g.edgeT = setTimeout(cdTurn, CD_REPEAT);
  }
  function cdMove(x, y) {                                              // the copy follows the finger (from its first move, at once: no easing behind it), the day under it found once a frame
    const g = cd; if (!g || !g.lifted) return;
    g.x = x; g.y = y;
    if (!g.follow && g.box) { g.follow = true; g.box.style.transition = "none"; }
    cdPlace(x, y);
    if (!g.raf) g.raf = requestAnimationFrame(() => { g.raf = 0; if (cd === g) cdHover(g.x, g.y); });
  }
  function cdChip(tid) { for (const b of cdDays()) for (const box of b.children || []) if (cdHas(box, "day-evs")) for (const c of box.children || []) if (c.dataset && c.dataset.tid === tid) return c; return null; }
  function cdLand(g, to) {                                             // the copy goes down into a chip (the moved one in its new day, or the one it came from) and the calendar is itself again
    if (cd === g) cd = null;
    cdQuiet(g);
    if (g.on) g.on.classList.remove("drop-on");
    document.body.classList.remove("cal-drag");
    const box = g.box, r = to && cdLive(to) ? to.getBoundingClientRect() : null;
    const done = () => { if (box && box.remove) box.remove(); };
    if (box && r && r.width > 0 && !calmMotion()) {
      box.style.transition = "transform 200ms cubic-bezier(0.25, 0.1, 0.25, 1), opacity 200ms ease";
      box.style.transform = "translate3d(" + r.left + "px," + r.top + "px,0) scale(" + (r.width / g.w) + "," + (r.height / CD_H) + ")";
      setTimeout(done, 220);
    } else if (box && !calmMotion()) { box.style.transition = "opacity 150ms ease"; box.style.opacity = "0"; setTimeout(done, 170); }
    else done();
    const wk = $("week"), free = () => { if (!(cd && cd.lifted) && wk) wk.style.minHeight = ""; };
    free();                                                            // at its own height again; it stays on the week it was let go in, as Calendar's (the strip pages week by week since v285: Today brings it back)
    setTimeout(rsFlush, 240);                                          // a sync's redraw that waited
  }
  function cdDrop() {                                                  // let go: on a day from today on, other than its own, the workout moves there by Reschedule's own rule (the client's by the server's rule, the coach's an ordinary save); anywhere else it settles back
    const g = cd; if (!g) return;
    const key = g.key, t = trainings.get(g.tid);
    let moved = false;
    if (key && key !== g.from && key >= today() && cdCan(t)) moved = canReschedule(t) ? applyReschedule(g.tid, key) : moveWorkout(g.tid, key);
    if (moved) cdTick();                                               // it has landed in its new day: the tick (inside the release's own event, as iOS asks)
    cdLand(g, moved ? cdChip(g.tid) : g.chip);
  }
  const cdBack = (down) => { const g = cd; if (!g) return; if (down) cdSpent = { mouse: g.mouse, id: g.id }; cdLand(g, g.chip); };   // a cancelled drag (Escape, a second finger, the system's own gesture): back into its chip; down: the finger or the button is still on it, and its release will click nothing
  function cdListen(tgt) {                                             // a touch's events stay aimed at the element it began on: a turned month or week takes that element out of the page, and then only it hears them
    const g = cd; if (!g || !tgt || typeof tgt.addEventListener !== "function" || typeof AbortController === "undefined") return;
    const ac = new AbortController(), lost = (fn) => (e) => { if (tgt.isConnected === false) fn(e); };
    tgt.addEventListener("touchmove", lost(cdTouchMove), { signal: ac.signal, passive: false });
    tgt.addEventListener("touchend", lost(cdTouchEnd), { signal: ac.signal, passive: false });
    tgt.addEventListener("touchcancel", lost(cdTouchEnd), { signal: ac.signal, passive: true });
    g.ac = ac;
  }
  const cdTouch = (e) => { const g = cd; if (!g || g.mouse) return null; for (const p of [...(e.changedTouches || []), ...(e.touches || [])]) if (p && p.identifier === g.id) return p; return null; };
  function cdTouchMove(e) {
    const g = cd; if (!g || g.mouse) return; const p = cdTouch(e); if (!p) return;
    if (!g.lifted) { if ((e.touches && e.touches.length > 1) || Math.hypot(p.clientX - g.x0, p.clientY - g.y0) > CD_SLOP) cdOff(); else { g.x = p.clientX; g.y = p.clientY; } return; }   // before the lift a move is a scroll or the months' slide
    if (e.cancelable) e.preventDefault();                              // lifted: the page holds still under the drag
    cdMove(p.clientX, p.clientY);
  }
  function cdTouchEnd(e) {
    if (!cd && cdSpent && !cdSpent.mouse && [...(e.changedTouches || [])].some((p) => p && p.identifier === cdSpent.id)) { cdSpent = null; if (e.cancelable) e.preventDefault(); cdEatUntil = performance.now() + 400; return; }   // the finger of a drag called off under it: its release clicks nothing either
    const g = cd; if (!g || g.mouse || !cdTouch(e)) return;
    if (!g.lifted) { cdOff(); return; }                                // a tap: its click opens the preview, as ever
    if (e.cancelable) e.preventDefault(); cdEatUntil = performance.now() + 400;   // the release clicks nothing (iOS clicks after a long press)
    if (e.type === "touchcancel") cdBack(); else cdDrop();
  }
  document.addEventListener("touchstart", (e) => {
    if (e.touches && e.touches.length === 1) { cdEatUntil = 0; cdSpent = null; }   // a new touch: the last release's window is over, and this one's click is its own
    if (cd) { const two = !!(e.touches && e.touches.length > 1); if (cd.lifted) cdBack(two); else cdOff(); if (two) return; }   // a second finger: the drag goes back (a hold, let go); a lone finger here means the last one's end never came, and it starts afresh
    if (!e.touches || e.touches.length !== 1 || held() || swipeHolds() || (rs && rs.open) || typingIn(document.activeElement)) return;
    const chip = cdItem(e.target); if (!chip) return;
    const p = e.touches[0]; cdStart(chip, p.clientX, p.clientY, p.identifier, false); cdListen(e.target);
  }, { capture: true, passive: true });
  document.addEventListener("touchmove", cdTouchMove, { capture: true, passive: false });
  document.addEventListener("touchend", cdTouchEnd, { capture: true, passive: false });
  document.addEventListener("touchcancel", cdTouchEnd, { capture: true, passive: true });
  document.addEventListener("pointerdown", (e) => {                     // a Mac: click and hold
    if (e.pointerType !== "mouse" || e.button !== 0 || e.ctrlKey) return;
    cdEatUntil = 0; cdSpent = null;                                    // a new press: its own click goes through
    if (cd && cd.mouse) { if (cd.lifted) cdBack(); else cdOff(); }   // (its release never came: let go outside the window)
    if (cd || held() || typingIn(document.activeElement)) return;
    const chip = cdItem(e.target); if (chip) cdStart(chip, e.clientX, e.clientY, e.pointerId, true);
  }, true);
  document.addEventListener("pointermove", (e) => {
    const g = cd; if (!g || !g.mouse || e.pointerId !== g.id) return;
    if (!g.lifted) { if (Math.hypot(e.clientX - g.x0, e.clientY - g.y0) > CD_MSLOP) cdOff(); else { g.x = e.clientX; g.y = e.clientY; } return; }   // moved before the lift: the month's own mouse slide, as before
    if (e.buttons === 0) { if (!g.lost) g.lost = setTimeout(() => { if (cd === g) cdBack(); }, 150); return; }   // Safari's last move can come with the button already up: a release lost to the window (no pointerup within 150 ms) takes it back
    cdMove(e.clientX, e.clientY);
  }, true);
  document.addEventListener("pointerup", (e) => {
    if (!cd && cdSpent && cdSpent.mouse && e.pointerId === cdSpent.id) { cdSpent = null; cdEatUntil = performance.now() + 400; return; }   // the button of a drag called off (Escape) under it: its click goes nowhere
    const g = cd; if (!g || !g.mouse || e.pointerId !== g.id) return;
    if (!g.lifted) { cdOff(); return; }
    cdEatUntil = performance.now() + 400; cdDrop();                    // a mouse's click follows its release at once
  }, true);
  document.addEventListener("pointercancel", (e) => { const g = cd; if (g && g.mouse && e.pointerId === g.id) { if (g.lifted) cdBack(); else cdOff(); } }, true);
  document.addEventListener("click", (e) => { if (performance.now() < cdEatUntil) { cdEatUntil = 0; e.preventDefault(); e.stopImmediatePropagation(); } }, true);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && cd && cd.lifted) { e.preventDefault(); e.stopImmediatePropagation(); cdBack(true); } }, true);
  window.addEventListener("scroll", () => { if (!cd) return; if (!cd.lifted) { cdOff(); return; } if (!calOpen && cd.wr) { const q = $("week").getBoundingClientRect(); cd.wr = { left: cd.wr.left, right: cd.wr.right, width: cd.wr.width, top: q.top, bottom: q.top + cd.wr.height, height: cd.wr.height }; } cdHover(cd.x, cd.y); }, { capture: true, passive: true });   // a scroll before the lift was the finger's; after it (a Mac's wheel) the day under the pointer is found again

  // ---------- the client page overview: workouts done, and the heaviest set ever on any exercise they have logged ----------
  const overviewCounts = (list, month) => { const done = list.filter((t) => t.completedAt); return { total: done.length, month: done.filter((t) => effDate(t).slice(0, 7) === month).length }; };
  function loggedExercises(c) {                                      // canon key -> { name, count, best, timed }, from every session of this client
    const canon = (x) => squash(ALIASES[String(x || "").trim()] || x); const map = new Map();
    for (const t of clientTrainings(c.id)) for (const r of t.rows || []) {   // newest first: the name keeps its latest spelling
      const k = canon(r.name); if (!k) continue;
      const e = map.get(k) || { name: String(r.name || "").trim(), count: 0, best: null, measure: measurePlan(r.reps), timed: !!measurePlan(r.reps) };
      let st = topSet(r, e.timed); if (!st) continue;
      st = toUnit(st, r.unit, c.unit || "lb"); const mu = measurePlan(r.reps); if ((mu && mu.unit === "m") !== (e.measure && e.measure.unit === "m")) continue; if (e.measure && mu) st = toTimeUnit(st, mu.unit, e.measure.unit);   // a carry and a hold are not the same measure: the best of one is not the best of the other   // every session read in the client's unit, holds in the unit of the latest plan
      st.date = effDate(t); st.title = String(t.title || "").trim(); e.count++; if (betterSet(st, e.best, e.timed)) e.best = st; map.set(k, e);
    }
    return map;
  }
  let ovFor = null, ovPick = "";                                     // the exercise looked up, kept while the page stays open
  const fmtSetFor = (c, e) => { const u = c.unit || "lb", st = e.best; return e.timed ? (st.w != null ? st.w + " " + u + " \u00d7 " : "") + st.rp + " " + (e.measure ? e.measure.unit : "sec") : st.w != null ? st.w + " " + u + (st.rp != null ? " \u00d7 " + st.rp : "") : st.rp + (st.rp === 1 ? " rep" : " reps"); };
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
    const since = Date.parse(c.seenDoneAt || "") || 0, seen = new Set(Array.isArray(c.seenNotes) ? c.seenNotes : []);
    const seenDone = Array.isArray(c.seenFinished) ? new Set(c.seenFinished) : null;   // by id since v166; a record from before carries only the time it was last looked at
    let done = 0; const notes = [], workouts = [];
    for (const t of clientTrainings(c.id)) {
      const fresh = seenDone ? !seenDone.has(t.id) : (Date.parse(t.completedAt) || 0) > since;   // a finish uploaded days after the fact (the phone's own time now travels with it) is still news
      if (t.completedBy === "client" && t.completedAt && fresh) { done++; workouts.push(t); }
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
  function markWorkoutsSeen(c) {                                       // looked at: those ids are seen; the time stamp stays for an older coach device
    const n = clientNews(c); if (!n.done) return;
    const live = new Set(); for (const t of clientTrainings(c.id)) if (t.completedBy === "client" && t.completedAt) live.add(t.id);
    const seen = (Array.isArray(c.seenFinished) ? c.seenFinished : clientTrainings(c.id).filter((t) => t.completedBy === "client" && t.completedAt && !n.workouts.includes(t)).map((t) => t.id)).filter((id) => live.has(id));   // first time by id: everything not news now counts as seen
    for (const t of n.workouts) if (!seen.includes(t.id)) seen.push(t.id);
    c.seenFinished = seen; c.seenDoneAt = now(); scheduleSave("clients", c.id);
  }
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
    go({ name: "training", id: t.id }); followRow(x.r.id, null, true);   // a note opened from the Notes tab: the whole card, its note unfolded
  }
  let notesFresh = null;                                                  // { id, ids }: the notes that were unread when the Notes tab was opened, dotted until he leaves
  let newsShown = null;                                                   // the client whose "New" list was on screen: leaving the page counts as having looked
  function renderNotif(c) {                                               // the Workouts tab: workouts the client finished on their own and the coach has not looked at, a short "New" list at the top
    const wrap = $("notifWrap"), ul = $("notifList"), n = clientNews(c);
    wrap.hidden = !n.workouts.length; ul.hidden = !n.workouts.length; if (!n.workouts.length) { ul.replaceChildren(); return; }
    let head = wrap.querySelector("h2"); if (!head) { head = document.createElement("h2"); wrap.prepend(head); } head.textContent = "New";
    ul.replaceChildren(...n.workouts.map((t) => {
      const li = document.createElement("li"), b = document.createElement("button"); b.type = "button";
      b.innerHTML = '<span class="nm"><span></span><span class="n2"></span></span><span class="sub"><span class="chev">&rsaquo;</span></span>';
      b.firstChild.firstChild.textContent = "Finished " + (String(t.title || "").trim() || "a workout"); b.firstChild.lastChild.textContent = whenDay(effDate(t) || String(t.date || ""), true);
      b.addEventListener("click", () => go({ name: "training", id: t.id })); li.appendChild(b); return li;
    }));
    let clear = wrap.querySelector(".news-clear");                        // Clear: looked at, without opening any of them — Apple's word in Notification Center
    if (!clear) { clear = document.createElement("button"); clear.type = "button"; clear.className = "btn tint wide soft news-clear"; clear.textContent = "Clear"; clear.addEventListener("click", () => { const cc = clients.get(S.view.id); if (!cc) return; newsShown = null; markWorkoutsSeen(cc); renderClient(); }); wrap.appendChild(clear); }
    if (S.tab === "workouts") newsShown = c.id;
  }
  function markNotesSeen(c, ids) {                                         // the Notes tab was on screen: what it showed counts as read
    const all = new Set(); for (const t of clientTrainings(c.id)) for (const r of t.rows || []) if (r.clientNote && r.clientNoteBy === "client") all.add(noteId(t, r));
    const seen = (c.seenNotes || []).filter((x) => all.has(x)); let changed = false;
    for (const id of ids) if (!seen.includes(id)) { seen.push(id); changed = true; }
    if (changed) { c.seenNotes = seen; scheduleSave("clients", c.id); }
  }
  const byMade = (x, y) => String(x.createdAt || "").localeCompare(String(y.createdAt || ""));   // same-day workouts: in the order they were made, the morning one first
  const dayChips = (ws, moving) => {                                          // moving: the workout the day picker moves, its chip outlined in purple (his pick, 12 Nov). Under a day, in the week, the month and the day picker alike: each workout's name in a chip, as Apple Calendar's month view writes its events (his ask, 11 Nov: "bigger Apple like shape", "words in there", Apple grey while it waits, green once finished, "Workout" when it has no name; red once missed, his pick the same day); three at most, else two and "+N", as Calendar keeps its last slot for the count
    const box = document.createElement("span"); box.className = "day-evs";
    const all = ws.slice().sort(byMade); let shown = all.length > 3 ? all.slice(0, 2) : all;
    if (moving && !shown.some((t) => t.id === moving)) { const mv = all.find((t) => t.id === moving); if (mv) shown = [shown[0], mv]; }   // the day picker's workout being moved never hides in the "+N"
    for (const t of shown) { const c = document.createElement("span"); c.className = "day-ev " + (t.completedAt ? "done" : pvMissed(t) ? "miss" : "plan") + (moving && t.id === moving ? " moving" : ""); c.dataset.tid = t.id; const n = document.createElement("span"); n.className = "day-ev-t"; n.textContent = String(t.title || "").trim() || "Workout"; c.appendChild(n); box.appendChild(c); }
    if (all.length > shown.length) { const m = document.createElement("span"); m.className = "day-ev-more"; m.textContent = "+" + (all.length - shown.length); box.appendChild(m); }
    return box;
  };
  const fitChips = (root) => {                                                // only words wider than their chip fade (.over), as Calendar's: a name that fits stays whole. Measured to the fraction (a Range), a point's grace: a word a point over (the plain "Workout" on a 402-point phone, 0.38 over) is clipped unseen, where the fade would take its last letter. Chips on the screen only (a hidden one has no width: measured once it shows)
    if (!root || typeof document.createRange !== "function") return;
    const ns = [...root.querySelectorAll(".day-ev-t")].filter((n) => n.offsetWidth), over = ns.map((n) => { const r = document.createRange(); r.selectNodeContents(n); return r.getBoundingClientRect().width > n.getBoundingClientRect().width + 1; });
    ns.forEach((n, i) => n.classList.toggle("over", over[i]));
    if (document.fonts && document.fonts.status === "loading" && document.fonts.ready) document.fonts.ready.then(() => fitChips(root));   // measured in the system font while Inter loads (a little wider): again once it is in
  };
  window.addEventListener("resize", () => fitChips(document));            // the phone turned, or the window changed: the chips' room changed
  const dayNames = (ws) => ws.slice().sort(byMade).map((t) => (String(t.title || "").trim() || "Workout") + (t.completedAt ? ", finished" : pvMissed(t) ? ", missed" : "")).join("; ");   // what VoiceOver hears of a day's chips
  const relDay = (iso) => {                                            // "Today", "Tomorrow", "In 4 days", "Yesterday", "3 days ago"
    const n = Math.round((new Date(iso + "T12:00:00") - new Date(today() + "T12:00:00")) / 86400000);
    if (!Number.isFinite(n)) return "";                                  // no date on the record: no caption
    if (n === 0) return "Today"; if (n === 1) return "Tomorrow"; if (n === -1) return "Yesterday";
    if (n > 1) return n < 14 ? "In " + n + " days" : "In " + Math.round(n / 7) + " weeks";
    return n > -14 ? (-n) + " days ago" : Math.round(-n / 7) + " weeks ago";
  };
  const liftGlyph = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor" stroke="currentColor" stroke-linejoin="round" stroke-linecap="round"><circle cx="12" cy="2.65" r="1.95" stroke="none"/><path stroke-width=".25" d="M10.1 5.5Q12 5.1 13.9 5.5L15 6.6 15.5 7.4 15.8 8.3 16.3 9.1 16.7 9.97 17.1 10.8 17.5 11.7 18 12.5 18.7 14.1Q18.6 15 17.8 15 17 15 16.9 14.2L16 12.5 15.6 11.7 15.2 10.8 14.8 9.97 14.2 9.6 14 9.6 14 11.4 10 11.4 10 9.6 9.8 9.6 9.2 9.97 8.8 10.8 8.4 11.7 8 12.5 7.1 14.2Q7 15 6.2 15 5.4 15 5.3 14.1L6 12.5 6.5 11.7 6.9 10.8 7.3 9.97 7.7 9.1 8.2 8.3 8.5 7.4 9 6.6Z"/><path stroke-width=".25" d="M9.5 14.9h5l1.6 7.3q.2 1-.8 1.1-.8.1-1-.7L12 15.1l-2.3 7.5q-.2.8-1 .7-1-.1-.8-1.1z"/><rect x="1.3" y="12.95" width="21.4" height=".95" rx=".45" stroke="none"/><rect x="2.1" y="9.6" width="1.9" height="6.5" rx=".9" stroke="none"/><rect x="20" y="9.6" width="1.9" height="6.5" rx=".9" stroke="none"/></svg>';   // the lifter at the bar, traced from the proportions of Apple's: head, rounded shoulders, arms down to the bar, legs set
  function workoutRow(t, mode, swipe) {                                 // one workout as Fitness lays a row out: the day in a column, a disc with the lifter, the title over a quiet line, a chevron. mode: "today" | "next" | "missed" | "past"; swipe: Missed, Today and Up next, where a workout still to do swipes to its actions
    const li = document.createElement("li"); const b = document.createElement("button"); b.type = "button";
    const n = t.rows.length, done = t.rows.filter((r) => r.done).length;      // exercises are rows: a superset counts each of its lifts
    const skipped = !t.completedAt && !!t.skippedAt;
    const overdue = mode === "next" && !skipped && !t.completedAt && !!effDate(t) && effDate(t) < today();   // a past day's own sheet: the red word Missed (the Missed card's rows say how long ago, under its title)
    const missed = mode === "missed";
    li.className = "w" + (t.completedAt ? " done" : "") + (skipped ? " off" : "") + (missed ? " miss" : "");
    const d = effDate(t) ? new Date(effDate(t) + "T12:00:00") : null;
    const wd = document.createElement("span"); wd.className = "wd"; wd.innerHTML = '<span class="dow"></span><span class="dn"></span>';
    const otherMonth = mode === "next" && d && effDate(t).slice(0, 7) !== today().slice(0, 7);   // weeks ahead in another month: the month over the day, not the weekday
    wd.firstChild.textContent = d ? d.toLocaleDateString(undefined, otherMonth ? { month: "short" } : { weekday: "short" }) : ""; wd.lastChild.textContent = d ? String(d.getDate()) : "";
    const wi = document.createElement("span"); wi.className = "wi"; wi.innerHTML = liftGlyph;
    const wt = document.createElement("span"); wt.className = "wt";
    const pri = document.createElement("span"); pri.className = "pri"; pri.textContent = String(t.title || "").trim() || "Workout";
    const count = n ? n + (n === 1 ? " exercise" : " exercises") : "Nothing added yet";
    const sec = document.createElement("span"); sec.className = "sec";                 // the quiet line: when, and how much
    if (overdue || missed) { const miss = document.createElement("span"); miss.className = "missed"; miss.textContent = missed ? relDay(effDate(t)) : "Missed"; sec.append(miss, " \u00b7 " + count); }   // the one red word: Missed, or under the Missed card's title how long ago ("Yesterday", "3 days ago"), as Reminders reddens an overdue date
    else if (mode === "next") sec.textContent = [relDay(effDate(t)), count].filter(Boolean).join(" \u00b7 ");
    else if (mode === "today") sec.textContent = done ? done + " of " + n + " done" : count;
    else if (skipped) sec.textContent = (t.missed === true ? "Missed" : "Skipped") + (t.skipReason ? " \u00b7 " + t.skipReason : "");
    else sec.textContent = count;
    wt.append(pri, sec);
    const chev = document.createElement("span"); chev.className = "chev"; chev.textContent = "\u203a"; chev.setAttribute("aria-hidden", "true");
    b.append(wd, wi, wt); if (!missed) b.appendChild(chev);              // a missed workout's "\u2026" sits where the chevron would
    const open = () => { if (settingsOpen === "history") openFromHistory(t.id); else go({ name: "training", id: t.id }); };   // on History the page is a settings page over the client's: it has to come off first
    b.addEventListener("click", open);
    li.dataset.tid = t.id; li.appendChild(b);
    if (missed) {                                                        // the missed workout's choices (his pick B, 10 Nov): a "…" where the chevron would be, opening Do it today, Reschedule, Skip and Preview, as Apple keeps an overdue row plain and its choices in a menu; the touch and hold gives the same four, its swipe every row's three (his ask, 10 Nov: Do it today only here)
      const more = document.createElement("button"); more.type = "button"; more.className = "miss-more"; more.setAttribute("aria-label", "More");
      more.innerHTML = DOTS;
      more.addEventListener("click", (e) => { e.stopPropagation(); const items = missItems(t.id); if (items.length) showMenu(more, items, { align: "right", focus: e.detail === 0 }); });   // a keyboard's Enter or VoiceOver's activation (detail 0) goes into the menu
      li.appendChild(more);                                              // after the row's button: read after it, and its own tap
    }
    if (swipe && (mode === "today" || mode === "next" || missed) && canSwipeRow(t)) {   // swiped to the left: Preview, Skip and Reschedule behind the row (the workout page holds the last two: its Skip workout and its "…"); a missed workout's the same three, its Do it today in its "…" and touch and hold (his ask, 10 Nov: "keep do it today … the sliding menu can only have reschedule skip and preview to keep it clean")
      li.classList.add("swipe-row");
      const layer = document.createElement("div"); layer.className = "swipe-acts"; layer.setAttribute("aria-hidden", "true");
      const act = (cls, icon, label, run) => { const b = document.createElement("button"); b.type = "button"; b.className = "swipe-act " + cls; b.tabIndex = -1; b.innerHTML = '<span class="sa-cap">' + icon + '</span><span class="sa-lbl">' + label + '</span>'; b.addEventListener("click", (e) => { e.stopPropagation(); run(); }); return b; };
      const skip = act("sa-skip", SA_SKIP, "Skip", () => { if (rs && rs.li === li) rsSettle(rs, 0, 0); rowSkip(t.id); });   // asks first, as the workout page does
      const prev = act("sa-prev", SA_EYE, "Preview", () => { if (rs && rs.li === li) rsSettle(rs, 0, 0); openPreview(t.id); });   // innermost, on the same swipe as Skip and Reschedule (his pick, 10 Nov): a look at the workout, the row closing as it opens
      layer.append(prev, skip, act("sa-resched", SA_CALENDAR, "Reschedule", () => { if (rs && rs.li === li) rsFire(rs); else rowReschedule(t.id); }));   // outermost: the full swipe's
      li._full = () => rowReschedule(t.id);
      li.appendChild(layer);                                             // last, under the row's own parts: they slide off it
      li._ctx = () => (missed ? missItems(t.id) : rowMenu(t.id)); li._ctx.ok = () => canSwipeRow(trainings.get(t.id)); li._ctx.open = open;   // a right-click: the same actions, at the pointer; a touch and hold: the same under the lifted row, a tap on which opens it
    }
    return li;
  }
  function renderClient() {
    const c = clients.get(S.view.id);
    const isTpl = isTemplateClient(c.id);
    $("vClient").classList.toggle("tpl", isTpl); $("vClient").dataset.tab = S.tab;
    $("newTraining").textContent = isTpl ? "+ Template" : "+ Workout";
    if (!isTpl) { $("tplList").hidden = true; $("pickNote").hidden = true; $("newTraining").hidden = false; }   // a program page hid it; a client's page always has it
    $("tplKicker").hidden = !isTpl; $("pausedKicker").hidden = isTpl || !effPaused(c); $("pausedKicker").textContent = c.paused ? "Access paused" : "Plan ended";
    if (isTpl) { $("notifWrap").hidden = true; $("overview").hidden = true; $("planCard").hidden = true; renderTemplates(c); $("delClientConfirm").hidden = true; return; }   // the library has no notifications row: a client's count must not linger here
    $("cName").textContent = c.name; renderPlanCard(c); renderOverview(c);
    $("meDisc").classList.toggle("needs", !S.clientMode && !c.email);   // no sign-in email yet: the red dot on the card disc
    if (!S.clientMode) renderNotif(c); else $("notifWrap").hidden = true;
    $("pausedCard").hidden = !(effPaused(c) && S.clientMode);
    $("pausedText").textContent = phoneDigits(c.trainerPhone) ? "Your workouts are on hold for now. Message Michal when you’re ready to pick up again." : "Your workouts are on hold for now. Michal will switch them back on when you’re ready to pick up again.";
    $("pausedCard").firstElementChild.textContent = !c.paused && effPaused(c) ? "Plan ended" : "Access paused";
    if (!c.paused && effPaused(c)) $("pausedText").textContent = "Your plan ended " + fmtDay(c.plan.until) + ". Message Michal to pick it up again.";
    document.body.classList.toggle("paused", !!(effPaused(c) && S.clientMode));
    if (document.activeElement !== $("cNotes")) $("cNotes").value = noteDraft.get(c.id) || "";
    $("noteActions").hidden = !String($("cNotes").value).trim(); growNotesBox();
    const news = clientNews(c), unseen = new Set(news.notes.map((x) => x.id));
    if (S.clientMode || S.tab !== "notes") notesFresh = null;
    else if (!notesFresh || notesFresh.id !== c.id) { notesFresh = { id: c.id, ids: new Set(unseen) }; if (unseen.size) markNotesSeen(c, unseen); }   // the tab just opened: what was unread keeps its dot for this visit, and counts as read from now
    renderNotes(c, notesFresh ? notesFresh.ids : unseen);
    const badge = $("notesBadge"); badge.hidden = S.clientMode || !unseen.size || S.tab === "notes"; badge.textContent = String(unseen.size);
    if (!S.clientMode) {                                                        // the report row: the last two years of months to pick from
      const sel = $("reportMonth"), base = new Date(today() + "T12:00:00"); sel.replaceChildren(new Option("Pick a month", ""));
      for (let i = 1; i <= 24; i++) { const d = new Date(base.getFullYear(), base.getMonth() - i, 1, 12); sel.appendChild(new Option(d.toLocaleDateString(undefined, { month: "long", year: "numeric" }), localIso(d).slice(0, 7))); }
      loadReportFonts();
    }
    if (!S.clientMode && (!S.sb || S.syncedOnce)) for (const t of clientTrainings(c.id)) if (isEmptyWorkout(t)) { trainings.delete(t.id); scheduleSave("trainings", t.id, 0); }   // empty workouts left behind (an accidental tap on a day) go away, once the server's copy has been seen
    const list = clientTrainings(c.id);

    const base = new Date(); base.setHours(12, 0, 0, 0);
    if (!(cd && cd.lifted)) $("week").style.minHeight = "";            // the strip at its own height, unless a workout is held over it (weekOff: the week paged to, kept across a redraw, this week again once the page is left)
    wkRoll(true);
    const iso = (d) => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
    // missed by more than a week: it files itself under History as "Missed" (his rule, 10 Nov: the Missed card keeps a week), what was logged on it kept there;
    // filed before the week and the month are drawn, so the redraw that files it never leaves its red chip on the month after the Missed card has let it go
    const stale = (() => { const d = new Date(base); d.setDate(base.getDate() - 7); return iso(d); })();
    if (!S.sb || (S.syncedOnce && S.syncedOn === today())) for (const t of list) {   // only once this device has seen the server's copy today: a copy days old (an iPad woken offline) never files what another device moved since
      if (t.completedAt || t.skippedAt || t.missed !== undefined || !effDate(t) || effDate(t) >= stale) continue;   // missed: true = filed before, false = a person brought it back (Undo on its page) or decided before Do it today stopped deciding
      t.skippedAt = now(); t.missed = true; if (S.clientMode) pendingMiss.add(t.id); scheduleSave("trainings", t.id);
    }
    const weekEl = $("week");
    const dayButton = (d, withWeekday, live = true) => {
      const key = iso(d);
      const dayWorkouts = list.filter((t) => effDate(t) === key && !(t.skippedAt && !t.completedAt));
      const b = document.createElement("button"); b.type = "button"; b.dataset.day = key;   // (its day: a preview opened from it gives a keyboard's place back to it, drawn anew)
      if (key === today()) { b.classList.add("today"); b.setAttribute("aria-current", "date"); }
      if (key < today()) b.classList.add("past");   // a day gone by: grey while a workout is dragged over the calendar, and nothing lands on it
      if (withWeekday) { const wd = document.createElement("span"); wd.className = "wd"; wd.textContent = d.toLocaleDateString(undefined, { weekday: "short" }).slice(0, 3); b.appendChild(wd); }
      const dn = document.createElement("span"); dn.className = "dn"; dn.textContent = String(d.getDate());
      b.append(dn, dayChips(dayWorkouts));
      b.setAttribute("aria-label", d.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" }) + (dayWorkouts.length ? ": " + dayNames(dayWorkouts) : ""));
      if (!live) { b.tabIndex = -1; return b; }                        // a week either side, drawn as the finger takes the strip: a picture of it (the strip drawn once it lands is the real one)
      b.addEventListener("click", (e) => {                                                    // a workout in the calendar opens its preview first (his ask, 11 Nov: "only from calendar view both week and month if I click on a workout it opens preview first instead of the actual workout"), as Calendar opens an event's sheet; its rows below still open the workout itself
        const chip = e && e.target && e.target.closest ? e.target.closest(".day-ev") : null, tid = chip && chip.dataset ? chip.dataset.tid : "";
        if (tid && dayWorkouts.some((t) => t.id === tid)) { openPreview(tid); return; }       // the chip tapped: that workout's
        if (dayWorkouts.length > 1) showDay(c, key, b);                                        // two or more, the day itself (or its "+N"): the day's own list, each row opening its preview (b: the day, where a keyboard's place comes back)
        else if (dayWorkouts.length) openPreview(dayWorkouts[0].id);
        else if (!S.clientMode) addTraining(c.id, null, key);
      });
      return b;
    };
    wkSide = (el, off, live = false) => { const m0 = wkMonday(off), days = []; for (let i = 0; i < 7; i++) { const d = new Date(m0); d.setDate(m0.getDate() + i); days.push(dayButton(d, true, live)); } el.replaceChildren(...days); if (!live) fitChips(el); };   // a week either side (a picture), or the strip itself (live)
    wkDraw = () => { wkSide(weekEl, weekOff, true); $("weekHead").textContent = wkHead(weekOff); wkAnchor = localIso(wkMonday(0)); };   // the strip for the week shown (calFold draws it alone as the page is left)
    if (!wkSliding) wkDraw();                                          // the weeks sliding: this strip stays as it is, drawn again once they land
    if (cdWeekSlide && !wkSliding) { const side = cdWeekSlide; cdWeekSlide = 0; weekEl.classList.remove("wk-in-r", "wk-in-l"); if (!calmMotion()) { void weekEl.offsetWidth; weekEl.classList.add(side > 0 ? "wk-in-r" : "wk-in-l"); const tok = ++cdSlideTok, off = () => { if (tok === cdSlideTok) weekEl.classList.remove("wk-in-r", "wk-in-l"); }; weekEl.onanimationend = weekEl.onanimationcancel = off; setTimeout(off, 320); } }   // a drag turned the strip, or it comes back: the new week slides in from that side, and the class goes once it has played (or the strip would slide in again each time it is shown)
    paintCalMode();
    // month view: three months on a sliding track (previous, shown, next) so a swipe follows the finger
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
      if (calSliding) { calMissed = true; return; }   // a slide is in flight, or two fingers hold the months: finish() re-renders when it lands
      track.style.transition = "none"; track.style.transform = "translateX(-100%)";
      track.replaceChildren(panel(monthAdd(calMonth, -1)), panel(calMonth), panel(monthAdd(calMonth, 1)));
      for (const p of [track.children[0], track.children[2]]) p.setAttribute("aria-hidden", "true");
      for (const b of track.children[1].querySelectorAll("button")) { if (!b.classList.contains("out")) b.tabIndex = 0; }
      for (const p of [track.children[0], track.children[2]]) for (const b of p.querySelectorAll("button")) b.tabIndex = -1;
      $("calTitle").textContent = monthTitle(calMonth);
      $("calToday").hidden = calMonth === cur;
      $("calView").style.height = track.children[1].offsetHeight + "px";
      fitChips(track);
    }

    const missed = missedOf(c.id);                                                   // its day gone, still to do: the Missed card, the newest first
    const next = list.filter((t) => !t.completedAt && !t.skippedAt && !missed.includes(t)).sort((a, b) => effDate(a).localeCompare(effDate(b)) || byMade(a, b));   // by day, and within a day in the order they were made
    // keep it short: anything due within the next few days (the very next workout always shows);
    // "Show more" adds the next few workouts each tap, "Show less" folds back to the short list
    if (nextFor !== c.id) { nextFor = c.id; nextExtra = 0; }
    const edge = new Date(base); edge.setDate(base.getDate() + NEXT_DAYS); const horizon = iso(edge);
    const firstLater = next.find((t) => effDate(t) !== iso(base));             // the next workout after today's always shows, however far off
    const soon = next.filter((t, i) => i === 0 || t === firstLater || effDate(t) <= horizon);
    nextExtra = Math.max(0, Math.min(nextExtra, next.length - soon.length));
    const shown = next.slice(0, soon.length + nextExtra), left = next.length - shown.length;
    const todays = shown.filter((t) => effDate(t) === iso(base)), later = shown.filter((t) => effDate(t) !== iso(base));   // today's workout on its own card, the days after it under "Up next"
    const keepOpen = rs && rs.open && !rs.busy && !(rsT && rsT.held) && rs.li.dataset ? rs.li.dataset.tid : ""; rsForget();   // a row left open stays open across the redraw (the rows are new)
    // the Missed card, above Today (his picks, 10 Nov): one card, its newest workout, and with more a row "2 more" that opens them all (Up
    // next's own fold, as Apple's lists show more), its up chevron folding them back; Skip all on its title whenever there are two or more
    if (missFor !== c.id || missed.length < 2) { missFor = c.id; missOpen = false; }   // another client's page, or nothing left to fold: folded again
    const open2 = missOpen && missed.length > 1;
    $("missHead").hidden = !missed.length; $("missList").hidden = !missed.length; $("skipAll").hidden = missed.length < 2;
    $("missList").replaceChildren(...(open2 ? missed : missed.slice(0, 1)).map((t) => workoutRow(t, "missed", true)));
    if (missed.length > 1) {
      const li = document.createElement("li"); li.className = "more only"; const bar = document.createElement("div");
      const fold = document.createElement("button"); fold.type = "button"; fold.className = "fold" + (open2 ? " open" : " wide");
      fold.setAttribute("aria-label", open2 ? "Show less" : "Show more"); fold.setAttribute("aria-expanded", String(open2));
      fold.innerHTML = (open2 ? "" : '<span class="cnt"></span>') + '<svg viewBox="0 0 14 14" aria-hidden="true"><path d="M3 5.5l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
      if (!open2) fold.firstChild.textContent = (missed.length - 1) + " more";   // folded: "2 more" at the left in the rows' own type, the chevron at the right
      fold.addEventListener("click", () => { missOpen = !open2; renderClient(); });
      bar.appendChild(fold); li.appendChild(bar); $("missList").appendChild(li);
    }
    $("todayHead").hidden = !todays.length; $("todayList").hidden = !todays.length; $("todayList").replaceChildren(...todays.map((t) => workoutRow(t, "today", true)));
    $("nextHead").hidden = !later.length && left === 0; $("nextList").hidden = !later.length && left === 0;
    $("nextList").replaceChildren(...later.map((t) => workoutRow(t, "next", true)));
    if (left > 0 || nextExtra > 0) {                                        // the card's last row: a chevron at the right opens the list (down) and folds it back (up); once open, "Show more · 7 more" on the left while there is still more
      const li = document.createElement("li"); li.className = "more" + (left > 0 && nextExtra > 0 ? "" : " only"); const bar = document.createElement("div");
      if (left > 0 && nextExtra > 0) {
        const b = document.createElement("button"); b.type = "button";
        const sub = document.createElement("span"); sub.className = "sub"; sub.textContent = left + " more";
        b.append("Show more", sub); b.addEventListener("click", () => { nextExtra += NEXT_STEP; renderClient(); });
        bar.appendChild(b);
      }
      const open = nextExtra > 0;
      const fold = document.createElement("button"); fold.type = "button"; fold.className = "fold" + (open ? " open" : " wide");
      fold.setAttribute("aria-label", open ? "Show less" : "Show more"); fold.setAttribute("aria-expanded", String(open));
      fold.innerHTML = (open ? "" : '<span class="cnt"></span>') + '<svg viewBox="0 0 14 14" aria-hidden="true"><path d="M3 5.5l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
      if (!open) fold.firstChild.textContent = left + " more";                    // folded: "12 more" at the left in the rows' own type, the chevron at the right — a row that opens
      fold.addEventListener("click", () => { nextExtra = open ? 0 : nextExtra + NEXT_STEP; renderClient(); });
      bar.appendChild(fold); li.appendChild(bar); $("nextList").appendChild(li);
    }

    if (keepOpen) { const li = [...$("missList").children, ...$("todayList").children, ...$("nextList").children].find((x) => x.dataset && x.dataset.tid === keepOpen && x.classList.contains("swipe-row")), r = li && rsBegin(li, true); if (r) { rsPaint(r, r.w, null); r.open = true; } }
    const rest = list.filter((t) => t.completedAt || t.skippedAt);           // History: a card under Up next; its page lays the past out by week, month and year
    $("histCard").hidden = !rest.length; $("histSub").textContent = rest.length + (rest.length === 1 ? " workout" : " workouts");
    $("trainingEmpty").hidden = list.length > 0;
    if (pv && !pg) { const pt = trainings.get(pv.id); if (pt && pt.clientId === c.id) { const more = $("pvMore"), y0 = popClose && popAnchor === more ? more.getBoundingClientRect().top : null; paintPreview(pt); if (popClose && popAnchor === more && (menuRows(pvItems(pt)) !== popRows || more.getBoundingClientRect().top !== y0)) popClose(); } else closePreview(); } else if (pv) pvArrows();   // a sync's redraw: the preview shows the workout as it is now (its "…" menu closes if what it offers changed, or if the "…" moved: the sheet sits at the screen's foot as tall as its workout, and the menu stays where it was placed), or goes with it; a slide under way paints where it lands, its arrows and its "…" at once (Skip's and Delete's own redraw as the slide to the next workout begins: the one skipped or deleted is no longer either side of it)
    $("delClientConfirm").hidden = true; $("delClient").hidden = false;
  }

  function paintFinish(t) {
    $("finishWrap").hidden = t.rows.length === 0 && !t.skippedAt && !t.completedAt && !canSwipeRow(t);   // nothing added yet: nothing to finish, yet a workout its row can skip offers Skip workout here too, and a skipped or finished one shows its line with Undo
    if (S.view.name === "training" && S.view.id === t.id) { $("tMore").hidden = !moreOn(t); closeMoreMenu(); }   // Undo on a finish (which redraws only this) brings the client's "…" back (the coach's stays: Delete)
    const done = !!t.completedAt, skipped = !done && !!t.skippedAt;
    $("finishBtn").hidden = done || skipped || t.rows.length === 0; $("finishedLine").hidden = !done;
    const left = t.rows.some((r) => !r.done);   // an exercise still open, in either view (his ask, 12 Nov: "now in both views coach and client"): finishing is finishing early, a quiet pill like Skip workout, not the purple act, and it asks first (finishTap)
    const fb = $("finishBtn"); fb.textContent = left ? "Finish early" : "Finish workout"; fb.classList.toggle("tint", left); fb.classList.toggle("soft", left);
    $("finishWrap").classList.toggle("split", left && !done && !skipped);   // Finish early and Skip workout side by side, half and half, until every exercise is done (his ask: "split half and half"); then Finish workout across the whole width, Skip under it
    $("skipLine").hidden = done || skipped; $("skippedLine").hidden = !skipped;
    if (skipped) $("skippedText").textContent = (t.missed === true ? "Missed" : "Skipped") + (t.skipReason ? " \u00b7 " + t.skipReason : "");
    if (done) { const d = new Date(t.completedAt); $("finishedText").textContent = "\u2713 Finished \u00b7 " + d.toLocaleDateString(undefined, { month: "short", day: "numeric" }) + ", " + d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }); }
    paintUndo(t);
  }
  const UNDO_FOR = 24 * 3600 * 1000;                                   // his rule (11 Nov): "clients don't have the option to press undo in history for workouts older than 24 hours"
  let undoTimer = null;
  function undoLeft(t) {                                               // how long a workout's Undo still stays (ms): the coach's own view, always; the client's (and the coach looking as the client) for 24 hours from the finish or the skip, never on one the app filed as missed after a week
    if (!(S.clientMode || previewing())) return Infinity;
    if (!t.completedAt && t.missed === true) return 0;
    const at = Date.parse(t.completedAt || t.skippedAt || "");
    return isNaN(at) ? 0 : Math.max(0, at + UNDO_FOR - Date.now());
  }
  function paintUndo(t) {                                              // the Undo beside "\u2713 Finished" or "Skipped": taken away, never dimmed, once its 24 hours are over, at that moment if the page is open
    clearTimeout(undoTimer); undoTimer = null;
    const ms = t.completedAt || t.skippedAt ? undoLeft(t) : 0;
    $("unfinishBtn").hidden = $("unskipBtn").hidden = !(ms > 0);
    if (ms > 0 && ms < Infinity) undoTimer = setTimeout(() => { const x = trainings.get(t.id); if (x && S.view.name === "training" && S.view.id === x.id) paintUndo(x); }, Math.min(ms + 50, 2147483647));   // (a timer holds 24.8 days at most: a stamp further ahead of this clock waits in turns, never looping at once: a review's catch)
  }
  const undoTap = (act) => () => { const t = trainings.get(S.view.id); if (!t) return; if (undoLeft(t) > 0) act(); else paintUndo(t); };   // a tap that comes after the 24 hours (a phone asleep past the moment) only takes the Undo away
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
    if (!finished) { S.renderedTraining = null; render(); }           // Undo: the cards come out of a finished workout's lock at once (its exercises open again, Resume back), not at the next sync
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
    const asClient = S.clientMode || previewClient; paintSessionPill(t, asClient);
    $("tDate").textContent = (asClient ? fmtDayLong : fmtDay)(t.date || today());
    $("tTitle").readOnly = asClient; $("tDate").disabled = asClient;
    const isTpl = isTemplateClient(t.clientId);
    if (isTpl) draftFor(t);
    const src = !asClient && !isTpl && t.fromTemplate ? trainings.get(t.fromTemplate) : null;
    $("fromTpl").hidden = !src; if (src) $("fromTplText").textContent = templatePath(src);
    $("tplFill").hidden = asClient || isTpl || (t.rows || []).length > 0 || !!t.completedAt;   // only an empty workout offers a template
    $("addRow").hidden = S.clientMode || (previewClient && !isTpl);   // the coach's white + Add exercise under the last exercise, wherever the bar's + is (his ask, 12 Nov: "back where it was right bellow the last exercise with full width"); on an empty workout beside From template, half and half
    $("startRow").hidden = $("addRow").hidden && $("tplFill").hidden;
    const others = isTpl || !effDate(t) ? [] : dayList(t.clientId, effDate(t)).filter((x) => x.id !== t.id);   // the day's other workouts: a quiet pill to the day's list
    $("dayMore").hidden = !others.length;
    if (others.length) { const d = effDate(t), when = d === today() ? "today" : "on " + whenDay(d); $("dayMoreText").textContent = others.length === 1 ? "Also " + when + ": " + (String(others[0].title || "").trim() || "Workout") : others.length + " more " + when; }   // "Also today: Core", "2 more on Nov 5"
    $("vTraining").classList.toggle("tpl", isTpl); $("useWrap").hidden = !isTpl || S.clientMode;
    $("viewSeg").hidden = S.clientMode || isTpl; for (const b of $("viewSeg").querySelectorAll("button")) { const on = (b.dataset.view === "client") === previewClient; b.classList.toggle("on", on); b.setAttribute("aria-checked", String(on)); } if (!isTpl || S.renderedTraining !== t.id) $("usePick").hidden = true;   // the client list built for another template must not survive onto this one
    $("tTitle").placeholder = isTpl ? "Template name, e.g. Upper body A" : "Focus, e.g. Bench-press and back";
    paintFinish(t);
    const rowsEl = $("rows");
    const active = document.activeElement;
    if (S.renderedTraining === t.id && (S.asking || (rowsEl.contains(active) && (active.tagName === "INPUT" || active.tagName === "TEXTAREA" || active.tagName === "IFRAME")))) return; // never rebuild under a typing finger, a playing video, nor under a confirm sheet
    const sigOf = () => JSON.stringify([t.rows, t.completedAt, t.skippedAt, t.date, t.inPerson, t.missed, (clients.get(t.clientId) || {}).unit, asClient, [...openBlocks], [...fullBlocks], [...peekBlocks], [...setSel], [...openExNotes], [...openNotes]]);
    if (S.renderedTraining === t.id && sigOf() === paintedSig) return;   // a sync that changed nothing here: the cards stay as they are, open video, menus and half-typed notes included
    S.renderedTraining = t.id;
    const sc = document.scrollingElement || document.documentElement, keepScroll = sc.scrollTop;   // the cards are rebuilt in place (every sync does it): the page must not move while it is empty
    if (!S.clientMode && normalizeLabels(t)) tidySave(t);
    t.rows.sort((a, b) => cmpLabel(a.label, b.label));
    if (closeOpenAlt) closeOpenAlt();
    rowsEl.replaceChildren();
    const groups = groupsOf(t.rows);
    let numbered = 0;
    const unfinished = groups.filter((g) => !g.rows.every((r) => r.done));
    const locked = asClient && !isTpl && !!t.completedAt;   // a finished workout, as the client sees it (his rule, 11 Nov: "They can only click the weight and rep and change that"): a set's weight and reps fixed, notes written, nothing else; Undo (24 hours) opens it all again; the coach's own view keeps everything
    rowsEl.classList.toggle("locked", locked);
    const currentKey = asClient && !isTpl ? (locked ? "" : (unfinished[0] || {}).key) : null;   // client: the first card not yet finished is the one open (a finished workout has none: its cards not done stay folded, a look and no more)
    groups.forEach((g) => {
      const block = document.createElement("div");
      const warm = g.key === "w";
      block.className = "block"; block.dataset.key = g.key;
      if (g.rows.length >= 2 || warm || asClient) {
        const cap = document.createElement("div"); cap.className = "group-cap";
        const gc = groupCaption(g), kind = gc.kind;
        if (asClient) {                                        // client: a big numeral up here does the work the badge used to do
          const big = document.createElement("b"); big.className = "num"; big.textContent = gc.main;   // "Exercise 1", "Exercise 2 · Superset", "Warmup · Superset": always "Exercise N" first, so the numbers run in order
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
      const card = document.createElement("div"); card.className = "group" + (g.rows.length > 1 ? " multi" : "");   // a superset: each exercise on its own inset panel inside the one card
      const total = Math.max(...g.rows.map(setsOf));
      if (!asClient && g.rows.length > 1) { const started = g.rows.filter((r) => doneCount(r) > 0); if (started.length && started.length < g.rows.length && !started.every((r) => doneCount(r) >= setsOf(r))) { const lead = Math.min(...started.map((r) => doneCount(r))); for (const r of g.rows) if (doneCount(r) === 0 && !(r.repsDone || []).some((v) => String(v || "").trim()) && !(r.weights || []).some((v) => String(v || "").trim())) { r.setsDone = Math.max(0, Math.min(lead, setsOf(r) - 1)); scheduleSave("trainings", t.id); } } }   // an exercise added to a card mid-way joins at the card's set, not at set 1
      const doneSets = Math.min(...g.rows.map((r) => { const n = Math.min(doneCount(r), setsOf(r)); return n >= setsOf(r) ? total : n; }));   // doneCount: a row finished before the counter existed counts as all done   // a shorter row that is finished does not hold the others back
      const selKey = t.id + "/" + g.key;
      let tracker = null;
      {
        let sel = null;
        if (!isTpl) { sel = setSel.has(selKey) ? setSel.get(selKey) : doneSets; sel = clamp(sel, 0, total - 1); g.sel = sel; }
        const tr = document.createElement("div"); tr.className = "tracker"; tr.setAttribute("aria-label", "Sets");
        const chips = document.createElement("div"); chips.className = "tr-chips"; tr.appendChild(chips);   // one track: the set you are on says "Set 2 of 12", the ones ahead are numbers, the ones done are fern discs with their number
        for (let i = 0; i < total; i++) {
          const b = document.createElement("button"); b.type = "button";
          if (isTpl) { b.textContent = String(i + 1); b.classList.add("static"); b.tabIndex = -1; }
          else {
            const done = i < doneSets, cur = i === sel;
            if (done) b.classList.add("done");
            if (cur) b.classList.add("cur");
            b.textContent = cur ? "Set " + (i + 1) + " of " + total : String(i + 1);
            b.setAttribute("aria-label", "Set " + (i + 1) + " of " + total + (done ? ", done" : cur ? ", current" : ""));
            b.addEventListener("click", () => { setSel.set(selKey, i); S.renderedTraining = null; render(); });
          }
          chips.appendChild(b);
        }
        const fades = () => { const more = chips.scrollWidth - chips.clientWidth - chips.scrollLeft; chips.style.setProperty("--fr", more > 2 ? "20px" : "0px"); };   // more to the right: the capsule's last 20px dissolve, the next segment a shape under them, as iOS fades a title at a bar's edge
        chips.addEventListener("scroll", fades, { passive: true });
        requestAnimationFrame(() => {
          if (chips.scrollWidth > chips.clientWidth) {
            const starts = [...chips.children].map((b) => b.offsetLeft - 4), max = chips.scrollWidth - chips.clientWidth;
            const rest = starts.find((x) => x >= max); if (rest != null && rest > max) chips.style.paddingRight = (4 + rest - max) + "px";   // room at the end so that scrolled to the end, the left edge still rests on a whole segment
            if (sel != null) { const from = starts[Math.max(0, sel - 2)]; if (from != null) chips.scrollLeft = from; }                      // open two sets before the one you are on
          }
          fades();
        });
        if (isTpl) { const pos = document.createElement("span"); pos.className = "tr-pos"; pos.textContent = total + (total === 1 ? " set" : " sets"); tr.appendChild(pos); }   // a template: the numbers, and how many
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
          const steps = document.createElement("div"); steps.className = "tr-steps"; steps.append(minus, plus); tr.appendChild(steps);   // the coach's − / + sit at the end of the same row
        }
        tracker = tr;
      }
      const rowEls = g.rows.map((r) => rowEl(t, r, isTpl ? null : g));
      if (tracker) card.appendChild(tracker);
      rowEls.forEach((e) => card.appendChild(e));
      const foot = document.createElement("div"); foot.className = "card-foot";
      let resume = null, openFull = null, sumRow = null, placeFootRows = null, waitFoot = null;   // waitFoot: a card still to come, opened for a look — no logging until the one in progress is finished; undo for "Finish early": shown on the opened card while it is finished early; openFull: from the summary to the working card; sumRow: the summary's one-line foot
      if (total > 0 && !isTpl) {
        const sel = g.sel, current = sel === doneSets && doneSets < total;
        const complete = document.createElement("label"); complete.htmlFor = "hapticSwitch"; complete.className = "btn complete"; complete.setAttribute("role", "button"); complete.tabIndex = 0;   // a label for the hidden switch: the tap itself gives the haptic on iPhone
        complete.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); complete.click(); } });
        complete.textContent = current ? (sel + 1 === total ? "Complete last set \u2192" : "Complete set \u2192") : "Back to set " + (Math.min(doneSets, total - 1) + 1);
        if (!current) { complete.classList.add("quiet-back"); if (doneSets >= total) complete.hidden = true; }
        const undo = document.createElement("button"); undo.type = "button"; undo.className = "finish-early undo-set"; undo.textContent = "Mark set " + (sel + 1) + " as not done";
        undo.hidden = !(sel < doneSets);
        undo.addEventListener("click", () => {                // this set and anything after it go back to not done
          for (const r of g.rows) { if (sel < setsOf(r)) { r.setsDone = Math.min(clamp(parseInt(r.setsDone, 10) || 0, 0, 20), sel); r.done = false; markEarly(t, r, ""); for (let j = sel; j < (r.repsDone || []).length; j++) r.repsDone[j] = ""; } /* the reps go too: a set marked not done is not a lift */ const track = S.clientMode ? pendingWeightRows : trainerTouched; if (!track.has(t.id)) track.set(t.id, new Set()); track.get(t.id).add(r.id); }
          fullBlocks.delete(selKey); setSel.set(selKey, sel); scheduleSave("trainings", t.id); S.renderedTraining = null; render();
        });
        complete.addEventListener("click", () => {
          if (performance.now() - completeAt < 350) return; completeAt = performance.now();   // the second tap of a double tap lands on the next card's button: it must not log a second set
          haptic();
          if (!current) { setSel.delete(selKey); setTimeout(() => { S.renderedTraining = null; render(); }, 0); return; }   // just go back to the current set
          const prevDone = doneSets;
          for (const r of g.rows) {
            if (sel >= setsOf(r)) continue;                                               // this exercise has fewer sets than the card
            r.weights = r.weights || []; r.repsDone = r.repsDone || [];
            while (r.weights.length <= sel) r.weights.push(""); while (r.repsDone.length <= sel) r.repsDone.push("");
            const last = lastWeights(t, r), carry = carried(r, sel), asW = (v) => (timedPlan(r.reps) && timeAsWeight(v) ? "" : v);   // a hold: "45 sec" from the old app is not a weight to copy
            if (!String(r.weights[sel] || "").trim()) r.weights[sel] = asW(carry.w) || asW(last && last.weights[sel] ? String(last.weights[sel]) : "");   // untouched box = same as the set before, else same as last time
            if (!r.unit && (r.weights || []).some((w) => /^\d/.test(String(w || "").trim()))) r.unit = (clients.get(t.clientId) || {}).unit || "lb";   // the unit this was logged in
            if (!String(r.repsDone[sel] || "").trim()) r.repsDone[sel] = carry.rp || (last && last.reps && last.reps[sel] ? String(last.reps[sel]) : "") || planNumber(r.reps);   // the grey number is what gets written: the set before, last time, else the plan's number (the highest of a range)
            if (current) r.setsDone = Math.max(clamp(parseInt(r.setsDone, 10) || 0, 0, 20), Math.min(prevDone + 1, setsOf(r)));
            if ((r.setsDone || 0) >= setsOf(r)) r.done = true;
            const track = S.clientMode ? pendingWeightRows : trainerTouched; if (!track.has(t.id)) track.set(t.id, new Set()); track.get(t.id).add(r.id);
          }
          if (g.rows.every((r) => r.done)) { openBlocks.delete(selKey); fullBlocks.delete(selKey); }
          setSel.delete(selKey); scheduleSave("trainings", t.id);
          setTimeout(() => { S.renderedTraining = null; render(); scrollToCard(g.key); }, 0);   // after the tap has flipped the switch (the iPhone tick), then redraw and glide
        });
        const skipping = doneSets === 0;                            // nothing completed on this card yet: finishing it is skipping it, and the word says so
        const early = document.createElement("button"); early.type = "button"; early.className = "finish-early"; early.textContent = skipping ? "Skip " + groupWord(g) : "Finish early";
        early.addEventListener("click", () => openFinishEarly(t, g, selKey, skipping));
        waitFoot = (curName, onStart) => {                          // still to come, opened for a look: the one line that says why there is no button, and the one way round it — this one now
          const wait = document.createElement("div"); wait.className = "foot-wait"; wait.textContent = "Finish " + curName + " first";
          foot.prepend(wait); early.hidden = true;
          if (onStart) { const go = document.createElement("button"); go.type = "button"; go.className = "start-now"; go.textContent = "Start this exercise"; go.addEventListener("click", (e) => { e.stopPropagation(); onStart(); }); wait.after(go); }
        };
        resume = document.createElement("button"); resume.type = "button"; resume.className = "resume"; resume.hidden = true; resume.textContent = "Resume this " + groupWord(g);
        resume.addEventListener("click", () => {              // the remaining sets open again; what was logged stays, the reason goes
          for (const r of g.rows) { r.done = clamp(parseInt(r.setsDone, 10) || 0, 0, 20) >= setsOf(r); markEarly(t, r, ""); const track = S.clientMode ? pendingWeightRows : trainerTouched; if (!track.has(t.id)) track.set(t.id, new Set()); track.get(t.id).add(r.id); }
          openBlocks.delete(selKey); fullBlocks.delete(selKey); setSel.delete(selKey); scheduleSave("trainings", t.id); S.renderedTraining = null; render(); scrollToCard(g.key);
        });
        const first = g.rows[0], noteKey = selKey;
        const addNote = document.createElement("button"); addNote.type = "button"; addNote.className = "add-note";
        const noteIcon = '<svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h13a2 2 0 0 0 2-2v-6"/><path d="M18.4 2.6a2.1 2.1 0 0 1 3 3L12 15l-4 1 1-4z"/></svg>';   // Apple's square-and-pencil, the Notes glyph
        early.insertAdjacentHTML("afterbegin", skipping ? '<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 3.5l6.5 4.5-6.5 4.5z"/><path d="M12.5 3.5v9"/></svg>' : '<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 14V2.5"/><path d="M3.5 3h8l-2 2.5 2 2.5h-8"/></svg>');   // skip: Apple's forward-to-end glyph; finish early: the flag
        const noteBox = document.createElement("div"); noteBox.className = "exnote"; noteBox.hidden = true;
        const ta = document.createElement("textarea"); ta.rows = 1; ta.maxLength = 500; ta.placeholder = "Something noticed on this exercise";
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
          else { if (!trainerNoted.has(t.id)) trainerNoted.set(t.id, new Set()); trainerNoted.get(t.id).add(first.id); }   // the coach's note on this row stands on a conflict — the note only, never the weights with it
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
        addNote.addEventListener("click", () => { if (!first.clientNote) { if (noteBox.hidden) openComposer(); else dropN.click(); return; } if (openExNotes.has(noteKey)) openExNotes.delete(noteKey); else openExNotes.add(noteKey); paintNote(); });
        edit.addEventListener("click", openComposer);
        del.addEventListener("click", async () => { if (!(await askFirst({ title: "Delete this note?", text: S.clientMode ? "" : "It goes from this exercise and from the notes list." }))) return; writeNote(""); openExNotes.delete(noteKey); paintNote(); });
        ta.addEventListener("input", () => { if (ta.value.trim()) cardNoteDraft.set(noteKey, ta.value); else cardNoteDraft.delete(noteKey); ta.style.height = "auto"; ta.style.height = Math.max(44, ta.scrollHeight) + "px"; });
        dropN.addEventListener("click", async () => { const typed = ta.value.trim(); if (typed && typed !== String(first.clientNote || "").trim() && !(await askFirst({ title: "Discard what you wrote?", yes: "Discard" }))) return; cardNoteDraft.delete(noteKey); noteBox.hidden = true; ta.value = ""; });
        saveN.addEventListener("click", async () => { const text = ta.value.trim(); if (!text && first.clientNote && !(await askFirst({ title: "Delete this note?", text: S.clientMode ? "" : "It goes from this exercise and from the notes list." }))) return; cardNoteDraft.delete(noteKey); noteBox.hidden = true; writeNote(text); openExNotes.delete(noteKey); paintNote(); });   // saved and folded away: the dot says it is there; an emptied box is a delete and asks like one
        paintNote();
        if (cardNoteDraft.has(noteKey)) { ta.value = cardNoteDraft.get(noteKey); noteBox.hidden = false; requestAnimationFrame(() => { ta.style.height = "auto"; ta.style.height = Math.max(44, ta.scrollHeight) + "px"; }); }   // a note half written when the cards were rebuilt: back where it was
        openFull = document.createElement("button"); openFull.type = "button"; openFull.className = "resume resume-full"; openFull.hidden = true; openFull.textContent = "Resume this " + groupWord(g);   // from the summary to the working card
        openFull.addEventListener("click", () => { if (resume && !resume.hidden) { resume.click(); return; } fullBlocks.add(selKey); S.renderedTraining = null; render(); });   // rebuilt from the data: the summary and the working card never hold two different numbers   // finished early: resume for real; otherwise just the working card
        const actsRow = document.createElement("div"); actsRow.className = "foot-row"; actsRow.append(early, addNote);
        const moreRow = document.createElement("div"); moreRow.className = "foot-row center"; moreRow.append(undo, resume, openFull);
        sumRow = document.createElement("div"); sumRow.className = "foot-row sum-row"; sumRow.hidden = true;   // the opened finished card: note disc · Resume · (the chevron disc in the corner) on one line
        placeFootRows = (summary) => { if (summary) { sumRow.append(openFull, addNote); sumRow.hidden = false; } else { actsRow.append(addNote); moreRow.append(openFull); sumRow.hidden = true; } };
        foot.append(shown, complete, moreRow, actsRow, noteBox, sumRow);     // undo / resume first, then Finish early + Add note (his order)
      }
      const btn = document.createElement("button"); btn.type = "button"; btn.className = "done-btn";
      const fold = document.createElement("button"); fold.type = "button"; fold.className = "fold-btn";
      const sum = document.createElement("div"); sum.className = "card-sum";
      const paintSum = (all) => {
        sum.replaceChildren(); if (resume) resume.hidden = true; if (!all) { block.classList.remove("skipped"); return; }
        const st = groupSummary(g);
        if (resume) resume.hidden = !st.early;
        if (st.early) block.classList.toggle("skipped", st.skipped);   // nothing logged: skipped, and the card stays grey, not fern
        for (const text of st.lines) { const d = document.createElement("div"); d.textContent = text; sum.appendChild(d); }
      };
      const chev = document.createElement("button"); chev.type = "button"; chev.className = "card-chev";   // finished card: a chevron on the status line (folded) or in the corner (open)
      chev.innerHTML = '<svg class="i-down" viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6l4 4 4-4"/></svg><svg class="i-up" viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 10l4-4 4 4"/></svg>';
      const paintFold = () => {
        const done = block.classList.contains("done"), open = block.classList.contains("open");
        fold.hidden = true; chev.hidden = !done; chev.classList.toggle("up", open);
        chev.setAttribute("aria-label", open ? "Hide sets" : "Show sets");
      };
      const paintSummary = () => {                                      // a finished card opened: the sets in rows, unless opened all the way
        const summary = block.classList.contains("done") && block.classList.contains("open") && (locked || !fullBlocks.has(selKey)); block.classList.toggle("summary", summary); if (openFull) openFull.hidden = !summary || locked; if (placeFootRows) placeFootRows(summary);   // a finished workout (the client's): no "Resume this exercise" (its note disc stays), and a card resumed before the finish opens as its sets
        const regrow = () => { for (const n of block.querySelectorAll("textarea.name")) { n.style.height = "auto"; n.style.height = Math.max(44, n.scrollHeight) + "px"; } };   // the name field re-wraps when the card changes shape: show the whole name
        if (block.isConnected) regrow(); else setTimeout(regrow, 0);    // in the page already: at once, so the page does not change height a moment after it was drawn (the glide would chase it)
      };
      const paint = () => { const all = g.rows.every((r) => r.done); block.classList.toggle("done", all); if (all && openBlocks.has(selKey)) block.classList.add("open"); if (!all) { openBlocks.delete(selKey); fullBlocks.delete(selKey); } btn.textContent = all ? "\u2713 Done" : "Done"; paintSum(all); paintFold(); paintSummary(); };
      const toggleOpen = () => { block.classList.toggle("open"); if (block.classList.contains("open")) openBlocks.add(selKey); else { openBlocks.delete(selKey); fullBlocks.delete(selKey); } paintFold(); paintSummary(); };
      fold.addEventListener("click", toggleOpen); chev.addEventListener("click", toggleOpen);
      card.addEventListener("click", (e) => { if (block.classList.contains("done") && !block.classList.contains("open") && !e.composedPath().some((n) => n.tagName === "BUTTON")) { block.classList.add("open"); openBlocks.add(selKey); paintFold(); paintSummary(); } });
      btn.addEventListener("click", () => {
        const next = !g.rows.every((r) => r.done);
        const track = S.clientMode ? pendingWeightRows : trainerTouched;   // the client's Done goes with the row's log and its number, so a late older request cannot undo it
        if (!track.has(t.id)) track.set(t.id, new Set());
        for (const r of g.rows) { r.done = next; if (!next) markEarly(t, r, ""); track.get(t.id).add(r.id); }
        scheduleSave("trainings", t.id); paint();
      });
      paint(); foot.append(btn, fold); card.append(sum, foot, chev);
      if (currentKey != null && g.key !== currentKey && !g.rows.every((r) => r.done)) {   // client: still to come
        const peeking = peekBlocks.has(selKey);
        const chev = document.createElement("button"); chev.type = "button"; chev.className = "card-chev"; chev.setAttribute("aria-label", peeking ? "Fold" : "Open");
        chev.innerHTML = '<svg viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="' + (peeking ? "M4 10l4-4 4 4" : "M4 6l4 4 4-4") + '"/></svg>';
        if (peeking) { const cap = block.querySelector(".group-cap"); (cap || card).appendChild(chev); } else card.appendChild(chev);   // opened for a look: the fold chevron moves up onto the "Exercise N" heading, and the card keeps its whole width
        const unpeek = () => { peekBlocks.delete(selKey); S.renderedTraining = null; render(); };
        if (peeking && waitFoot && !locked) {                                     // "Finish Exercise 1 first" when one unfinished card comes before this one, by the name on its card; "the previous exercises" when more do
          const gi = groups.indexOf(g), before = groups.filter((x, xi) => xi < gi && !x.rows.every((r) => r.done));
          const one = before.length === 1 ? before[0] : null;
          const canStart = /^\d+$/.test(String(g.key)) && unfinished[0] && unfinished[0].key !== "w";   // an exercise can go ahead of the exercises; the warmup stays a warmup, so with it unfinished there is nothing to offer
          waitFoot(!one ? "the previous exercises" : one.key === "w" ? "the warmup" : /^\d+$/.test(String(one.key)) ? "Exercise " + one.key : "the previous " + groupWord(one),
            canStart ? () => { const moved = startExerciseNow(t, g.key); if (!moved) return; peekBlocks.delete(t.id + "/" + moved.key); S.renderedTraining = null; render(); scrollToCard(moved.key); } : null);   // the machine is taken: this exercise now, ahead of the ones not yet done; they slide down behind it and keep what was logged
        }
        if (peeking) { block.classList.add("peek"); chev.addEventListener("click", unpeek); for (const top of card.querySelectorAll(".row .top")) top.addEventListener("click", (e) => { if (e.target.closest(".ex-icons")) return; unpeek(); }); }
        else { block.classList.add("ahead"); card.addEventListener("click", () => { peekBlocks.add(selKey); S.renderedTraining = null; render(); }); }
      } else peekBlocks.delete(selKey);
      block.appendChild(card); rowsEl.appendChild(block);
    });
    const back = Math.min(keepScroll, Math.max(0, sc.scrollHeight - sc.clientHeight)); if (Math.abs(sc.scrollTop - back) > 1) sc.scrollTop = back;   // a box measured mid-rebuild made the browser clamp the scroll to a page with no cards yet: put it back where he was
    paintedSig = sigOf();
    requestAnimationFrame(regrowNames);                               // once the cards are in the page, every name box at its true height                                         // what the cards now show, tidied rows included
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

  // "Start this exercise" (client, a card still to come): the machine is taken, so this exercise goes ahead of the ones not yet done.
  // It takes the first open slot; the unfinished exercises before it slide down behind it in their order; the finished ones stay where
  // they are; the numbers run 1, 2, 3 again (a superset keeps its letters). The change is the workout's own — saved, so the coach sees
  // the order it was done in — and the per-card state (the set being looked at, cards opened) follows each exercise to its new number.
  function startExerciseNow(t, key) {
    const rows = [...(t.rows || [])].sort((a, b) => cmpLabel(a.label, b.label)), groups = [];
    rows.forEach((r, i) => { const k = groupKey(r.label, i); if (!groups.length || groups[groups.length - 1].key !== k) groups.push({ key: k, rows: [] }); groups[groups.length - 1].rows.push(r); });
    const nums = groups.filter((g) => /^\d+$/.test(String(g.key)));
    const gi = nums.findIndex((g) => String(g.key) === String(key)), at = nums.findIndex((g) => !g.rows.every((r) => r.done));
    if (gi < 0 || at < 0 || at >= gi) return null;                   // not an exercise, or nothing unfinished before it: it is next already
    const open = (g) => !g.rows.every((r) => r.done), slots = nums.map((g, i) => i).filter((i) => open(nums[i]));   // the open slots, where they are: a finished exercise between them does not move
    const fill = [nums[gi], ...nums.filter((g, i) => i !== gi && open(g))];                                         // the started one first, then the open ones in their order
    slots.forEach((i, j) => { nums[i] = fill[j]; });
    const map = new Map(); let changed = false;
    nums.forEach((g, j) => {
      const n = String(j + 1); map.set(String(g.key), n);
      for (const r of g.rows) { const letter = ((String(r.label || "").trim().match(/^\d+\s*([a-z]*)/i) || [])[1] || "").toLowerCase(); const want = n + letter; if (r.label !== want) { r.label = want; changed = true; } }
    });
    if (changed) {
      t.rows.sort((a, b) => cmpLabel(a.label, b.label));
      remapCardKeys(t.id, map);
      if (S.clientMode) pendingOrder.add(t.id);
      scheduleSave("trainings", t.id);
    }
    return { key: String(at + 1), changed };
  }
  // An exercise deleted while building (his ask, 12 Nov: "if 3rd one deleted the 4th one becomes 3rd etc"): the numbers after it close up,
  // each keeping its letters as typed (4a 4b become 3a 3b); the superset it left closes up its letters (2a 2c become 2a 2b) and one left
  // alone loses its letter (2b becomes 2); a warm-up stays W; a label of the coach's own words stays as typed. The per-card state (cards
  // opened, the set looked at) follows each exercise to its number, and the deleted one's goes with it.
  function renumber(t, gone) {
    const gk = String(groupKey(gone && gone.label, -1)), rows = [...(t.rows || [])].sort((a, b) => cmpLabel(a.label, b.label)), groups = [];
    rows.forEach((r, i) => { const k = String(groupKey(r.label, i)); if (!groups.length || groups[groups.length - 1].key !== k) groups.push({ key: k, rows: [] }); groups[groups.length - 1].rows.push(r); });
    if (!groups.some((g) => g.key === gk)) dropCardKeys(t.id, gk);   // its whole card went: nothing of it carries over to the one that takes its number
    const map = new Map(); let n = 0, changed = false;
    for (const g of groups) {
      const num = /^\d+$/.test(g.key); if (!num && g.key !== "w") continue;
      const base = num ? String(++n) : "W"; if (num && base !== g.key) map.set(g.key, base);
      g.rows.forEach((r, j) => {
        const want = g.key === gk ? base + (g.rows.length > 1 ? String.fromCharCode(97 + j) : "") : num ? String(r.label).replace(/^(\s*)\d+/, "$1" + base) : r.label;
        if (r.label !== want) { r.label = want; changed = true; }
      });
    }
    if (changed) { t.rows.sort((a, b) => cmpLabel(a.label, b.label)); remapCardKeys(t.id, map); }
    return changed;
  }
  function dropCardKeys(tid, key) {
    const k = tid + "/" + key;
    for (const s of [openBlocks, fullBlocks, peekBlocks, openExNotes]) s.delete(k);
    for (const m of [setSel, cardNoteDraft]) m.delete(k);
  }
  function remapCardKeys(tid, map) {
    const re = (k) => { const p = tid + "/"; if (!k.startsWith(p)) return k; const g = k.slice(p.length); return map.has(g) ? p + map.get(g) : k; };
    for (const s of [openBlocks, fullBlocks, peekBlocks, openExNotes]) { const next = [...s].map(re); s.clear(); for (const k of next) s.add(k); }
    for (const m of [setSel, cardNoteDraft]) { const next = [...m].map(([k, v]) => [re(k), v]); m.clear(); for (const [k, v] of next) m.set(k, v); }
  }
  function relabeled(id, cur, rec) {                                // a sync brought this workout with its exercises renumbered (she started one ahead): the per-card state here follows each exercise to its new number too
    const keyOf = (rows, rid) => { const i = (rows || []).findIndex((x) => x.id === rid); return i < 0 ? null : String(groupKey(rows[i].label, i)); };
    const map = new Map();
    for (const x of rec.rows || []) { const a = keyOf(cur.rows, x.id), b = keyOf(rec.rows, x.id); if (a != null && b != null && a !== b && !map.has(a)) map.set(a, b); }
    if (map.size) remapCardKeys(id, map);
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
  function showMenu(anchor, items, opts) {                           // the same frosted bubble with rows to tap: [{ label, icon?, onPick }]; opts.align "right" hangs it from the anchor's right edge (a disc at the edge of a card)
    const pop = $("whenPop"); pop.classList.remove("plain"); pop.classList.add("menu");
    let close = null;
    pop.replaceChildren(...items.map((it) => {
      const b = document.createElement("button"); b.type = "button"; b.className = "wopt" + (it.danger ? " danger" : "");
      if (it.icon) b.innerHTML = it.icon;
      const s = document.createElement("span"); s.textContent = it.label; b.appendChild(s);
      b.addEventListener("mousedown", (e) => e.preventDefault());   // pressing a row moves no focus: a field typed in keeps it (and its redraw waits) until the row is picked
      b.addEventListener("click", (e) => { e.stopPropagation(); if (close) close(); if (opts && opts.lift && opts.lift.drop) opts.lift.drop(); it.onPick(); });   // close() first: a keyboard's focus is back on the anchor, so a sheet the row opens returns there (a held item's copy goes at once: what the pick opens, or the page it glides, is not under a copy of the item as it was)
      return b;
    }));
    close = openPop(anchor, opts); popRows = menuRows(items);         // (after openPop: it closes the menu before)
    if (opts && opts.focus) { const f = pop.querySelector(".wopt"); if (f) f.focus({ preventScroll: true }); }   // opened from the keyboard or VoiceOver: into the menu, as a system menu takes focus (a tap leaves focus where it is)
  }
  const MI = {                                                         // the menu's leading glyphs, in a 1.25 em box (see #whenPop.menu .mi); swap, pencil and trash traced from Apple's and filled like theirs
    calendar: '<svg class="mi" viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2.9" width="12" height="11.2" rx="2.2"/><path d="M2 6.5h12M5.2 1.6v2.6M10.8 1.6v2.6"/></svg>',
    skip: '<svg class="mi" viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 3.7v8.6c0 .5.5.8.9.5l6.3-4.3c.4-.2.4-.8 0-1L4.4 3.2c-.4-.3-.9 0-.9.5z"/><path d="M13 3.2v9.6"/></svg>',   // Skip in a menu: the swipe's skip glyph in outline, as Apple's menus take the outline of what a swipe shows filled (Mail's flag, its trash), drawn like the calendar beside it
    swap: '<svg class="mi" viewBox="-10.16 -22.04 64.08 64.08" aria-hidden="true" fill="currentColor"><path d="M0 2.12L43.75 2.12A2.12 2.12 0 0 0 43.75 -2.12L0 -2.12A2.12 2.12 0 0 0 0 2.12ZM45.25 -1.5L32.52 -14.23A2.12 2.12 0 0 0 29.52 -11.23L42.25 1.5A2.12 2.12 0 0 0 45.25 -1.5ZM42.25 -1.5L29.52 11.23A2.12 2.12 0 0 0 32.52 14.23L45.25 1.5A2.12 2.12 0 0 0 42.25 -1.5ZM43.75 17.88L0 17.88A2.12 2.12 0 0 0 0 22.12L43.75 22.12A2.12 2.12 0 0 0 43.75 17.88ZM1.5 21.5L14.23 8.77A2.12 2.12 0 0 0 11.23 5.77L-1.5 18.5A2.12 2.12 0 0 0 1.5 21.5ZM-1.5 21.5L11.23 34.23A2.12 2.12 0 0 0 14.23 31.23L1.5 18.5A2.12 2.12 0 0 0 -1.5 21.5Z"/></svg>',   // Alternate exercise: two arrows the opposite ways, a swap, built from Apple's Sort By arrow in Reminders (its weight, head and length; 94% overlap with Apple's); his pick A, 9 Nov
    pencil: '<svg class="mi" viewBox="-8.38 -9.09 64.73 64.73" aria-hidden="true" fill="currentColor"><path d="M4.18 42.43L8.35 34.58L33.81 9.13L38.12 13.44L12.67 38.9L4.82 43.07ZM3.92 42.43A0.9 0.9 0 1 0 5.72 42.43A0.9 0.9 0 1 0 3.92 42.43ZM35.93 7.01L39.47 3.47A1.25 1.25 0 0 1 41.23 3.47L43.78 6.02A1.25 1.25 0 0 1 43.78 7.78L40.24 11.32Z"/></svg>',   // Edit instructions: Apple's pencil, traced from Rename in the Files menu (iOS 27.2; 96% overlap), 0.76 em as Apple's
    camera: '<svg class="mi" viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><path d="M2.25 5.6c0-.8.65-1.45 1.45-1.45h1.7l1.05-1.4h3.1l1.05 1.4h1.7c.8 0 1.45.65 1.45 1.45v5.95c0 .8-.65 1.45-1.45 1.45H3.7c-.8 0-1.45-.65-1.45-1.45z"/><circle cx="8" cy="8.55" r="2.35"/></svg>',
    photo: '<svg class="mi" viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"><rect x="1.9" y="2.9" width="12.2" height="10.2" rx="2.2"/><circle cx="5.7" cy="6.3" r="1.15"/><path d="M2.3 11.7l3.5-3.3 2.4 2.2 1.9-1.7 3.6 3.1"/></svg>',
    copy: '<svg class="mi" viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"><rect x="5.4" y="5.4" width="8.8" height="8.8" rx="2.1"/><path d="M10.6 5.4V3.9c0-1.15-.95-2.1-2.1-2.1H3.9c-1.15 0-2.1.95-2.1 2.1v4.6c0 1.15.95 2.1 2.1 2.1h1.5"/></svg>',   // Copy workout: a page over a page
    save: '<svg class="mi" viewBox="0 0 16 16" aria-hidden="true" fill="currentColor"><path d="M7.25 1.9A.75.75 0 0 1 8.75 1.9V7.59L10.17 6.17A.75.75 0 0 1 11.23 7.23L8.53 9.93A.75.75 0 0 1 7.47 9.93L4.77 7.23A.75.75 0 0 1 5.83 6.17L7.25 7.59Z"/><path d="M5.6 3.95H4.5A2.85 2.85 0 0 0 1.65 6.8V12.3A2.85 2.85 0 0 0 4.5 15.15H11.5A2.85 2.85 0 0 0 14.35 12.3V6.8A2.85 2.85 0 0 0 11.5 3.95H10.4A.75.75 0 0 0 10.4 5.45H11.5A1.35 1.35 0 0 1 12.85 6.8V12.3A1.35 1.35 0 0 1 11.5 13.65H4.5A1.35 1.35 0 0 1 3.15 12.3V6.8A1.35 1.35 0 0 1 4.5 5.45H5.6A.75.75 0 0 0 5.6 3.95Z"/></svg>',   // Save as template: an arrow down into a tray, Apple's sign for saving, drawn as filled shapes at the menu's weight (12 Nov)
    eye: '<svg class="mi" viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><path d="M1.6 8C2.9 5.6 5.2 3.9 8 3.9s5.1 1.7 6.4 4.1C13.1 10.4 10.8 12.1 8 12.1S2.9 10.4 1.6 8z"/><circle cx="8" cy="8" r="2.1"/></svg>',   // Preview in a menu: the swipe's eye in outline, as the menus take the outline of what a swipe shows filled
    trash: '<svg class="mi" viewBox="-7.3 -3.3 62.6 62.6" aria-hidden="true" fill="currentColor"><path d="M5 13.5H43L41.25 50.5A5 5 0 0 1 36.25 55.5H11.75A5 5 0 0 1 6.75 50.5ZM8.6 13.5L10.35 50.5A1.4 1.4 0 0 0 11.75 51.9H36.25A1.4 1.4 0 0 0 37.65 50.5L39.4 13.5ZM17.75 0.5H30.25A4.5 4.5 0 0 1 34.75 5V6.25A4.5 4.5 0 0 1 30.25 10.75H17.75A4.5 4.5 0 0 1 13.25 6.25V5A4.5 4.5 0 0 1 17.75 0.5ZM19.5 4A2.5 2.5 0 0 0 17 6.5V10.25A2.5 2.5 0 0 0 19.5 12.75H28.5A2.5 2.5 0 0 0 31 10.25V6.5A2.5 2.5 0 0 0 28.5 4ZM1.45 10.25H46.55A1.45 1.45 0 0 1 48 11.7V12.2A1.45 1.45 0 0 1 46.55 13.65H1.45A1.45 1.45 0 0 1 0 12.2V11.7A1.45 1.45 0 0 1 1.45 10.25ZM14.5 19.78L15 46.28A1.5 1.5 0 0 0 18 46.22L17.5 19.72A1.5 1.5 0 0 0 14.5 19.78ZM22.5 19.75L22.5 46.25A1.5 1.5 0 0 0 25.5 46.25L25.5 19.75A1.5 1.5 0 0 0 22.5 19.75ZM30.5 19.72L30 46.22A1.5 1.5 0 0 0 33 46.28L33.5 19.78A1.5 1.5 0 0 0 30.5 19.72Z"/></svg>',   // Apple's trash, traced from its Delete in the Files and Reminders menus (iOS 27.2, 3x): lid, handle, a can narrowing to rounded corners, three lines leaning in; filled shapes, 93% overlap; 1.10 em tall as Apple's at 17 pt
    folderPlus: '<svg class="mi" viewBox="0 0 16 16" aria-hidden="true" fill="currentColor" fill-rule="evenodd"><path d="M1.6 4.1C1.6 3.3 2.2 2.7 3 2.7H6.05C6.47 2.7 6.87 2.89 7.13 3.22L7.9 4.2H13C13.8 4.2 14.4 4.8 14.4 5.6V11.9C14.4 12.7 13.8 13.3 13 13.3H3C2.2 13.3 1.6 12.7 1.6 11.9ZM7.4 6.6H8.6V8.3H10.3V9.5H8.6V11.2H7.4V9.5H5.7V8.3H7.4Z"/></svg>',   // New folder (his template folders, 12 Nov): our own, a filled folder with its tab, a plus cut through it
    slidePlus: '<svg class="mi" viewBox="0 0 16 16" aria-hidden="true" fill="currentColor" fill-rule="evenodd"><path d="M4.2 3.6H11.8C13.24 3.6 14.4 4.76 14.4 6.2V9.8C14.4 11.24 13.24 12.4 11.8 12.4H4.2C2.76 12.4 1.6 11.24 1.6 9.8V6.2C1.6 4.76 2.76 3.6 4.2 3.6ZM7.4 5.7H8.6V7.4H10.3V8.6H8.6V10.3H7.4V8.6H5.7V7.4H7.4Z"/></svg>',   // New slide: our own, a filled rounded tab (a slide of the week slider) with a plus cut through it
    docPlus: '<svg class="mi" viewBox="0 0 16 16" aria-hidden="true" fill="currentColor" fill-rule="evenodd"><path d="M5 1.6H11C12.22 1.6 13.2 2.58 13.2 3.8V12.2C13.2 13.42 12.22 14.4 11 14.4H5C3.78 14.4 2.8 13.42 2.8 12.2V3.8C2.8 2.58 3.78 1.6 5 1.6ZM7.4 5.3H8.6V7.4H10.7V8.6H8.6V10.7H7.4V8.6H5.3V7.4H7.4Z"/></svg>',   // New template (12 Nov): our own, a filled page standing up with a plus cut through it, beside the folder and the slide
  };
  MI.folder = SA_FOLDER;                                               // Move to in a menu: the swipe's folder
  MI.reorder = MI.swap.replace("<path ", '<path transform="rotate(90 21.88 10)" ');   // Reorder folders (his ask, 12 Nov): the swap arrows a quarter turn round, up beside down, as Apple's arrow.up.arrow.down
  function exerciseMenu(r, on) {                                    // the coach's "…" on an exercise: swap it, its instructions, and last and red, delete it, as Apple ends a menu with its destructive row (his ask, 9 Nov: Delete was hidden in Alternate exercise); the video is the play disc's own business
    return [
      { label: "Alternate exercise", icon: MI.swap, onPick: on.swap },   // no ellipsis on any menu row (his pick, 10 Nov: "I don't see the … in any apples design so drop it")
      { label: (r.note || "").trim() ? "Edit instructions" : "Add instructions", icon: MI.pencil, onPick: on.note },
      { label: "Delete exercise", icon: MI.trash, danger: true, onPick: on.remove },
    ];
  }
  function exerciseCtx(moreBtn, items, first) {                      // an exercise's right-click: the menu of its "…" (items), only where its "…" is shown (the coach's view: a client's card has none, a folded card shows none)
    const f = () => { if (first) first(); return items(); };
    f.ok = () => !!moreBtn && moreBtn.offsetParent !== null;
    return f;
  }
  function ctxPlace(x, y, pw, ph, vw, vh) {                         // a right-click's menu, as the Mac opens one: its corner at the pointer, down and to the right; turned to the left or upward where the window's edge would cut it, and never past a margin of 8
    const left = x + pw > vw - 8 ? x - pw : x, top = y + ph > vh - 8 ? y - ph : y;
    return { left: Math.max(8, Math.min(left, vw - pw - 8)), top: Math.max(8, Math.min(top, vh - ph - 8)) };
  }
  function openPop(anchor, opts) {                                   // places the bubble under (or above) its anchor and wires the ways it closes; returns close
    if (popClose) popClose();                                        // one bubble at a time: a second Enter on its button replaces it, and leaves no closer of the first one waiting to eat a tap
    const bg = $("whenBg"), pop = $("whenPop");
    const at = opts && opts.at;                                       // a right-click's menu: from the pointer itself, no pointer drawn (opts.at { x, y })
    const lift = opts && opts.lift;                                   // a touch and hold's: under the item it lifted (opts.lift { box, rect, grow, open })
    bg.hidden = false; pop.classList.remove("above"); pop.classList.toggle("hung", !!(opts && (opts.align === "right" || at || lift))); pop.classList.toggle("lift", !!lift);
    pop.style.left = "0px"; pop.style.top = "0px";                   // measured at its own size: where the last bubble was, a menu would be squeezed by the screen's edge (taller, its rows wrapped) and placed by that
    const r = anchor.getBoundingClientRect(), vw = document.documentElement.clientWidth, vh = window.innerHeight, pw = pop.offsetWidth, ph = pop.offsetHeight;
    const box = anchor.closest(".group, .card, .plan-card, .overview"), bb = box ? box.getBoundingClientRect() : null;   // the bubble stays inside the card it belongs to, as Apple keeps a popover inside its content's margins, never out at the screen's edge
    let minL = 8, maxL = vw - pw - 8; if (bb && bb.right - bb.left >= pw) { minL = Math.max(minL, bb.left); maxL = Math.min(maxL, bb.right - pw); }
    const want = opts && opts.align === "right" ? r.right - pw : opts && opts.align === "center" ? r.left + r.width / 2 - pw / 2 : r.left;   // hung from the right edge, centred under the anchor, or from its left
    let left = Math.max(minL, Math.min(want, maxL)), top = r.bottom + 8;
    if (lift) {                                                       // the margins: the screen's safe areas (the dim layer is padded with them) and 16 more, as iOS keeps its menu off the home indicator (measured: 17)
      const dcs = getComputedStyle($("ctxDim")), L = liftPlace(lift.rect, pw, ph, vw, vh, (parseFloat(dcs.paddingTop) || 0) + 16, (parseFloat(dcs.paddingBottom) || 0) + 16, lift.grow);
      const b0 = typeof lift.box.getBoundingClientRect === "function" ? lift.box.getBoundingClientRect().bottom : NaN;   // the item's foot now, still growing
      ({ left, top } = L); lift.vis = L.vis; lift.box.style.transform = "translateY(" + L.dy + "px) scale(" + L.s + ")";   // the item moves up with its menu where it must, and shrinks only if it is too tall to fit
      pop.style.setProperty("--lift-off", (b0 > L.vis.bottom ? b0 - L.vis.bottom : 0) + "px");   // the menu starts that far lower and rises with it on the item's own curve (liftRise): 16 under it all the way, never over it
    } else if (at) ({ left, top } = ctxPlace(at.x, at.y, pw, ph, vw, vh));
    else if (top + ph > vh - 8) { top = r.top - 8 - ph; pop.classList.add("above"); }
    pop.style.left = left + "px"; pop.style.top = top + "px"; pop.style.setProperty("--caret", Math.max(12, Math.min(r.left + r.width / 2 - left, pw - 12)) + "px");
    const close = () => {
      if (popClose === close) { popClose = null; popAnchor = null; } const inPop = pop.contains(document.activeElement);
      if (lift) { liftClick = null; clearTimeout(liftLate); }
      bg.hidden = true; document.removeEventListener("pointerdown", onDown, true); document.removeEventListener("pointerup", onUp, true); document.removeEventListener("keydown", onKey); document.removeEventListener("contextmenu", onCtx, true); window.removeEventListener("scroll", close, true); window.removeEventListener("resize", close);
      const back = opts && opts.back && document.contains(opts.back) ? opts.back : anchor;
      if (inPop && document.contains(back)) back.focus({ preventScroll: true });   // focus was in the bubble (a keyboard, VoiceOver): back on the button it hangs from (a right-click's: what had it), never lost to the page
      if (opts && opts.onClose) opts.onClose();                       // (a right-click's ring comes off its item)
    };
    const isMenu = pop.classList.contains("menu");                  // (showMenu sets it before it opens; a bubble of numbers has none)
    const onCtx = (e) => { if (lift && /^(touch|pen)$/.test(ctxBy(e))) { e.preventDefault(); return; } if (!pop.contains(e.target)) close(); else if (isMenu) e.preventDefault(); };   // (a touch and hold's own long press, Android's contextmenu coming after its menu: it keeps the menu, and its browser's own never shows)   // a right-click anywhere else closes the bubble (the browser's own menu, or the next item's, opens there); in a menu it does nothing; in a bubble of numbers the browser's own stays (Copy, Look Up)
    const onKey = (e) => { if (e.key === "Escape") close(); };
    let down = null, eat = null;                                     // a tap outside closes the bubble and goes no further (as a system menu's dismissing tap): nothing under it is pressed or given focus; a finger that drags the page does not close it
    const uneat = () => { if (eat) { document.removeEventListener("mousedown", eat, true); eat = null; } };
    const onDown = (e) => {
      if (pop.contains(e.target)) { down = null; return; }
      if (lift) { down = { x: e.clientX, y: e.clientY }; return; }   // over the dimmed page nothing under the tap can take focus or a press, and a cancelled press makes iOS hold the tap's click (see onUp)
      e.preventDefault(); down = { x: e.clientX, y: e.clientY };     // no mouse events follow a cancelled pointerdown, so a field under the tap is not focused (focus is mousedown's doing); on the phone that mousedown comes after pointerup, so it is eaten there too
      uneat(); eat = (ev) => { ev.preventDefault(); uneat(); }; document.addEventListener("mousedown", eat, true); setTimeout(uneat, 400);
    };
    const onUp = (e) => {
      if (!down) return; const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y); down = null; if (moved > 10) { uneat(); return; }
      if (lift) { clearTimeout(liftLate); liftLate = setTimeout(close, 600); return; }   // a touch and hold's menu: the dimmed page's own click closes it (liftClick). Closing here changed the page under the tap, and iOS then held that tap's click 0.4 s and gave it to what was under the dim (measured: the calendar day); the click comes at once when nothing changes (measured: 35 ms)
      if (e.button === 0 && e.isPrimary) {                            // only a primary tap is followed by a click; a right or middle button, or a second finger, is not, and must not leave the swallower waiting for someone else's click
        const swallow = (ev) => { ev.stopPropagation(); ev.preventDefault(); disarm(); }, disarm = () => { document.removeEventListener("click", swallow, true); document.removeEventListener("pointerdown", disarm, true); uneat(); };
        document.addEventListener("click", swallow, true); document.addEventListener("pointerdown", disarm, true); setTimeout(disarm, 400);   // the click that follows this tap is the dismissal, not a press on what lies under
      }
      close();
    };
    if (lift) liftClick = (e) => {                                    // the dimmed page's click: the menu closes; on the lifted workout it opens it, as Apple's open what they lift (measured: Contacts opens the contact)
      const v = lift.vis, onItem = !!(v && e.clientX >= v.left && e.clientX <= v.right && e.clientY >= v.top && e.clientY <= v.bottom);
      close(); if (onItem && lift.open) { if (lift.hide) lift.hide(); lift.open(); }   // (the copy and the dim go at once, not over the workout that opens)
    };
    document.addEventListener("pointerdown", onDown, true); document.addEventListener("pointerup", onUp, true); document.addEventListener("keydown", onKey); document.addEventListener("contextmenu", onCtx, true); window.addEventListener("scroll", close, true);
    if (lift) window.addEventListener("resize", close);              // (the lifted item would no longer sit over its place)
    popClose = close; popAnchor = anchor;
    return close;
  }
  // a right-click (a trackpad's two-finger click, a Control-click): the item's own menu at the pointer, as the Mac gives its items one (his pick,
  // 9 Nov: "do what Apple would do"). A workout row on Today and Up next: its swipe's two actions; an exercise in the coach's view: the menu of
  // its "…". While the menu is open the item wears a ring, as the Mac rings what was right-clicked. In the field being typed in a right-click
  // stays the browser's (Cut, Copy, Paste), as on the Mac. A finger's long press is the touch and hold below, never this.
  const CTX_NOT = ".alt-menu, .note-pop, .numpick, .vid-form, .player, .sugg, .swipe-acts";   // a panel open in the item, or the swipe's own buttons: not the item itself
  const MAC = typeof navigator !== "undefined" && /Mac/.test(navigator.platform || navigator.userAgent || "");
  let ctxDown = null, ctxArmed = false;                              // the latest press not yet answered by a menu ({ type, down, upAt }): a right-click comes with a mouse's (or a trackpad's), a long press with a finger's, the keyboard or VoiceOver (VO-Shift-M) with none; armed: a right press on an item is under way
  function ctxItemOf(el) {                                           // the item a right-click on el is about (it carries its menu as _ctx), or null
    if (!el || !el.closest || el.closest(CTX_NOT)) return null;
    const a = document.activeElement; if (a && a !== document.body && el.closest("input, textarea") === a) return null;   // the field being typed in: the browser's own menu
    const it = el.closest("li.swipe-row, .row");
    return it && typeof it._ctx === "function" && it._ctx.ok() ? it : null;
  }
  const ctxPress = (e) => e.pointerType === "mouse" && (e.button === 2 || (e.button === 0 && !!e.ctrlKey && MAC));   // the press a right-click begins with (a Control-click is the Mac's)
  document.addEventListener("pointerdown", (e) => { ctxDown = { type: e.pointerType || "", down: true, upAt: 0 }; ctxArmed = false; if (ctxPress(e) && ctxItemOf(e.target)) { e.preventDefault(); ctxArmed = true; } }, true);   // a right press focuses nothing (an exercise's number would open its picker): what opens is the item's menu
  const ctxUp = () => { if (ctxDown && ctxDown.down) { ctxDown.down = false; ctxDown.upAt = performance.now(); } ctxArmed = false; };
  document.addEventListener("pointerup", ctxUp, true); document.addEventListener("pointercancel", ctxUp, true);
  document.addEventListener("selectstart", (e) => { if (ctxArmed) e.preventDefault(); }, true);   // nor selects anything: the word the Mac selects under a right-click, or a typed-in field's caret moved, never happens (the menu is the item's, not the text's)
  const ctxBy = (e) => {                                              // what opened it: Chrome says so itself ("" for the keyboard); otherwise the press still down (Safari and Android fire during it) or just let go (Windows fires after it), and none means the keyboard or VoiceOver
    if (typeof e.pointerType === "string") return e.pointerType || "keyboard";
    const p = ctxDown; return p && (p.down || performance.now() - p.upAt < 300) ? p.type || "mouse" : "keyboard";
  };
  document.addEventListener("contextmenu", (e) => {
    const by = ctxBy(e); ctxDown = null; ctxArmed = false;              // (the press is answered: a later keyboard menu is the keyboard's)
    if (by === "touch" || by === "pen") { if (lp) e.preventDefault(); return; }   // a finger's or a pen's long press: the touch and hold's (Android's own menu never comes over it), never this one
    const it = ctxItemOf(e.target); if (!it) return;                   // anywhere else, the browser's own
    const items = it._ctx(); if (!items || !items.length) return;
    e.preventDefault(); if (rsFree() && rs.open) rsSettle(rs, 0, 0);  // an open row closes, as a click elsewhere closes it
    const pressed = by !== "keyboard", ir = it.getBoundingClientRect();
    const at = pressed ? { x: e.clientX, y: e.clientY } : { x: ir.left + Math.min(24, ir.width / 2), y: ir.top + Math.min(24, ir.height / 2) };   // the keyboard's or VoiceOver's: at the item itself
    const own = (n) => (n && n !== document.body && it.contains(n) ? n : null), tf = e.target && e.target.closest ? e.target.closest("button, a[href], input, textarea, select, [tabindex]") : null;
    const back = pressed ? null : own(tf) || own(document.activeElement) || it.querySelector(".more-btn") || [...it.children].find((c) => c.tagName === "BUTTON") || null;   // where a keyboard's focus comes back to: what had it, else the exercise's "…" or the row's own button
    it.classList.add("ctx-on");
    showMenu(it, items, { at, focus: !pressed, back, onClose: () => it.classList.remove("ctx-on") });   // (with no press, focus goes into the menu, as a system menu takes it)
  });
  const rowMenu = (id) => [                                          // a workout row's right-click and touch and hold: its swipe's actions, outermost first: Reschedule (the full swipe's), Skip, then Preview; Reschedule and Skip ask before they act (the days, the reasons); no ellipsis (his pick, 10 Nov)
    { label: "Reschedule", icon: MI.calendar, onPick: () => rowReschedule(id) },
    { label: "Skip", icon: MI.skip, onPick: () => rowSkip(id) },
    { label: "Preview", icon: MI.eye, onPick: () => openPreview(id) },
  ];
  const miToday = () => MI.calendar.replace("</svg>", '<text x="8" y="12.3" text-anchor="middle" font-size="5.6" font-weight="600" fill="currentColor" stroke="none">' + Number(today().slice(8)) + "</text></svg>");   // Do it today: the calendar with today's date on it, as Reminders marks its Today
  const missItems = (id) => [                                        // a missed workout's "…", touch and hold and right-click (his pick B, 10 Nov): Do it today (the likeliest; only here, not on its swipe), then the swipe's own, outermost first: Reschedule (the days), Skip (its reasons), Preview
    { label: "Do it today", icon: miToday(), onPick: () => doToday(id) },
    { label: "Reschedule", icon: MI.calendar, onPick: () => rowReschedule(id) },
    { label: "Skip", icon: MI.skip, onPick: () => rowSkip(id) },
    { label: "Preview", icon: MI.eye, onPick: () => openPreview(id) },   // last, as on its swipe: the innermost
  ];
  // touch and hold: the phone's right-click (his pick, 10 Nov: "do 4"), with the same menus, opened the way iOS 27.2 opens them (measured on
  // its Contacts and Home Screen). A finger held still on a workout row, or on an exercise in the coach's view, lifts it a little where it is,
  // with a shadow; at 0.4 s the page dims (20%; 48% in the dark) and the menu opens 16 under the item on its leading edge, the two moving up
  // together where the menu would not fit. A release before then is a tap, as ever, and a finger that wanders 10 points is a scroll or a swipe.
  // The finger can slide onto a row and let go there to pick it; a tap on the lifted workout opens it, as Apple's open what they lift; a tap
  // anywhere else closes. A field is never held (a finger held there is its own loupe and caret), nor anything while a menu, a sheet or the
  // keyboard is up, or a row is swiped open (a tap then only closes it).
  const LP_LIFT = 100, LP_MS = 400, LP_SLOP = 10, LP_GROW = 1.035, LP_RISE = 470;   // measured: a row starts growing 0.07-0.08 s after it lights up; a hold of 0.35 s is a tap, of 0.40 s the menu; 8 points of drift keep it and 16 lose it; 3.6% bigger by the menu. LP_RISE: the menu moving into its place (liftRise, 450 ms) and a frame
  let lp = null, lpEatUntil = 0, lpBackT = 0, lpGone = null, lpAc = null;   // the hold under way or answered ({ it, id, x, y, lx, ly, lift, timer, box, rect, open, openAt, down, ox, oy, slid, over, fx, fy, track }); the end of the window in which its release's click goes nowhere; the lifted copy's way back; the finger of a hold whose menu went while it was still down; its finger's listeners on the element it began on
  const lpUnlisten = () => { if (lpAc) { lpAc.abort(); lpAc = null; } };
  const lpField = (el) => !!(el && el.closest && el.closest("input, textarea, select, [contenteditable], .chip, .tempo-tiles"));   // a field, or a box that is one (Reps, Rest, a set's Weight: its words, then its field on a tap; the tempo's tiles)
  const lpItemOf = (el) => (lpField(el) ? null : ctxItemOf(el));
  function liftPlace(r, pw, ph, vw, vh, top0, bot0, grow) {          // where a held item and its menu go: r its place, pw x ph the menu, top0 / bot0 the margins; returns the item's move and scale and its rect on screen, and the menu's corner
    const GAP = 16, s = Math.max(0.05, Math.min(grow, (vh - top0 - bot0 - GAP - ph) / r.height));   // grown a little, or shrunk to fit over its menu (a tall card), as iOS scales a preview
    const h = r.height * s, w = r.width * s, y0 = r.top + (r.height - h) / 2;   // scaled about its centre
    const y = Math.max(top0, Math.min(y0, vh - bot0 - ph - GAP - h)), x = r.left + (r.width - w) / 2;   // up with its menu until the menu fits under it, never above the top margin
    return { dy: y - y0, s, vis: { left: x, top: y, right: x + w, bottom: y + h }, left: Math.max(8, Math.min(x, vw - pw - 8)), top: Math.min(y + h + GAP, vh - bot0 - ph) };   // (the menu never past the bottom margin, even over a card too tall to shrink enough)
  }
  function lpClone(it) {                                             // a copy of the item over the item, to lift: in copies of its card and list, for the styles it takes from them
    clearTimeout(lpBackT); lpUnwatch();
    const box = $("ctxLift"), r = it.getBoundingClientRect();
    box.replaceChildren(); let host = box;
    for (const w of it.tagName === "LI" ? [it.parentElement] : [it.closest(".block"), it.closest(".group")]) {
      if (!w) continue; const d = document.createElement(/^(UL|OL)$/.test(w.tagName) ? w.tagName : "div"); d.className = w.className; d.classList.add("lp-wrap"); host.appendChild(d); host = d;
    }
    const c = it.cloneNode(true), from = it.querySelectorAll("input, textarea, select"), to = c.querySelectorAll("input, textarea, select");
    to.forEach((f, i) => { if (from[i]) f.value = from[i].value; f.disabled = true; f.tabIndex = -1; });   // what is typed, not what was first drawn; and never a field (it slides under the finger, and iOS took it for one: its magnifier came up, measured)
    const os = [it, ...it.querySelectorAll("*")], ks = [c, ...c.querySelectorAll("*")];   // what the item's page hides, the copy hides too (rules its copy's ancestors cannot carry: a template's set log, say)
    os.forEach((o, i) => { if (ks[i] && o.getClientRects && !o.getClientRects().length && getComputedStyle(o).display === "none") ks[i].style.display = "none"; });
    c.querySelectorAll(".alt-menu, .note-pop, .numpick, .sugg").forEach((n) => { n.hidden = true; });   // an open panel is no part of the lifted item (its menu closes the alternatives as it opens)
    const vids = it.querySelectorAll("iframe, video");
    c.querySelectorAll("iframe, video").forEach((f, i) => { const o = vids[i], ph = document.createElement("div"); ph.style.width = (o ? o.offsetWidth : 0) + "px"; ph.style.height = (o ? o.offsetHeight : 0) + "px"; ph.style.background = "#000000"; f.replaceWith(ph); });   // a playing video is not loaded again
    for (const n of [c, ...c.querySelectorAll("[id]")]) n.removeAttribute("id");
    c.classList.remove("ctx-on", "rs-ate", "swiped"); c.style.margin = "0"; c.style.width = r.width + "px"; c.style.boxSizing = "border-box";
    const cs = getComputedStyle(it), rad = parseFloat(cs.borderTopLeftRadius) || 0, bt = parseFloat(cs.borderTopWidth) || 0;
    if (bt > 0) c.style.borderTop = bt + "px solid transparent";      // the hairline above a row that is not its list's first (li + li): kept as room, so its words do not jump up a point as it lifts
    host.appendChild(c);
    box.style.borderRadius = rad > 0 ? cs.borderTopLeftRadius : "";   // a superset's exercise keeps its own panel's corners; a row or a card has the card's
    const card = it.tagName === "LI" ? null : it.closest(".group"), tint = card ? getComputedStyle(card).backgroundColor : "";
    box.style.background = tint && tint !== "transparent" && !/^rgba\(\d+, \d+, \d+, 0\)$/.test(tint) ? "linear-gradient(" + tint + ", " + tint + "), var(--surface)" : "";   // its card's own colour, over the page as the card lies on it (a finished card's fern wash), not a white card
    box.style.left = r.left + "px"; box.style.top = r.top + "px"; box.style.width = r.width + "px"; box.style.height = r.height + "px"; box.style.transform = "";
    box.classList.remove("up", "lp-back"); box.hidden = false;
    return { box, rect: { left: r.left, top: r.top, width: r.width, height: r.height } };
  }
  function lpLift() {                                                // 0.1 s into the hold: the item starts to lift
    const p = lp; if (!p || p.box) return;
    if (!p.it.isConnected || !p.it._ctx.ok()) { lpDrop(); return; }
    const c = lpClone(p.it); p.box = c.box; p.rect = c.rect;
    void p.box.offsetWidth; p.box.style.transform = "scale(" + LP_GROW + ")"; p.box.classList.add("up");   // from its place (laid out first), growing with its shadow
  }
  function lpHide() { clearTimeout(lpBackT); lpUnwatch(); const box = $("ctxLift"), dim = $("ctxDim"); box.hidden = true; box.classList.remove("up", "lp-back"); box.style.transform = ""; box.replaceChildren(); dim.hidden = true; dim.classList.remove("on"); }
  function lpUnwatch() { window.removeEventListener("scroll", lpCopyOff, true); window.removeEventListener("resize", lpCopyOff); }
  function lpCopyOff() { lpUnwatch(); const box = $("ctxLift"); box.hidden = true; box.classList.remove("up", "lp-back"); box.style.transform = ""; box.replaceChildren(); }   // only the copy, at once (a pick, the page moving under it, a new touch): the dim fades on, taking no touch, and lpHide ends it
  function lpDrop() {                                                // the hold is let go before its menu (a tap, a scroll, a swipe, a second finger): the item is down at once
    const p = lp; if (!p) return; lp = null; lpUnlisten();
    clearTimeout(p.lift); clearTimeout(p.timer);
    if (p.box && !p.open) lpHide();
  }
  function lpYield() { if (lp && !lp.open) lpDrop(); }               // the row's swipe or the swipe back took the finger, on this very move: the hold is let go at once (its copy too, lifted or not)
  function lpOpen() {                                                // 0.4 s: the menu
    const p = lp; if (!p || p.open) return;
    const it = p.it;
    if (!it.isConnected || !it._ctx.ok() || held() || typingIn(document.activeElement)) { lpDrop(); return; }   // (a row's swipe or the swipe back that takes the finger lets the hold go on that move: lpYield)
    const items = it._ctx(); if (!items || !items.length) { lpDrop(); return; }
    clearTimeout(p.lift); if (!p.box) lpLift(); if (lp !== p) return;
    p.open = true; p.ox = p.lx; p.oy = p.ly; p.slid = false; rsT = null; dropSw();   // the finger is the menu's now: no row slides and the page does not swipe back under it (ox, oy: where it was as the menu came)
    lpHoldAt = p.openAt = performance.now();                          // and until it lets go, a sync's redraw waits (rowHolds): the item under it is not rebuilt, so its release stays the hold's
    const dim = $("ctxDim"); dim.hidden = false; void dim.offsetWidth; dim.classList.add("on");
    showMenu(it, items, { lift: { box: p.box, rect: p.rect, grow: LP_GROW, open: it._ctx.open, hide: lpHide, drop: lpCopyOff }, onClose: lpClosed });
  }
  function lpClosed() {                                              // the menu went (a tap, Escape; a pick takes the copy at once): the page brightens and the item settles back into its place, then is itself again
    const p = lp; if (p) { lp = null; clearTimeout(p.lift); clearTimeout(p.timer); if (p.over) p.over.classList.remove("lp-over"); if (p.down) lpGone = p.id; }   // (a finger still down: its release is still the hold's)
    const box = $("ctxLift"), dim = $("ctxDim");
    dim.classList.remove("on"); box.classList.remove("up"); box.classList.add("lp-back"); box.style.transform = "";
    clearTimeout(lpBackT); lpBackT = setTimeout(() => { lpHide(); rsFlush(); }, 260);   // (a sync's redraw that waited for the settle comes as the copy goes)
    const r = p && p.rect && p.it.isConnected ? p.it.getBoundingClientRect() : null;
    if (!r || Math.abs(r.top - p.rect.top) > 1 || Math.abs(r.left - p.rect.left) > 1 || Math.abs(r.width - p.rect.width) > 1) { lpCopyOff(); return; }   // the item is no longer where its copy would settle (a scroll or a turn of the phone closed the menu, a redraw took it): the copy goes at once
    window.addEventListener("scroll", lpCopyOff, { capture: true, passive: true }); window.addEventListener("resize", lpCopyOff);   // and it goes as soon as the page moves under it
  }
  const lpRowAt = (x, y) => { const el = typeof document.elementFromPoint === "function" ? document.elementFromPoint(x, y) : null; return el && el.closest ? el.closest("#whenPop .wopt") : null; };
  const lpOver = (b) => { const p = lp; if (!p || p.over === (b || null)) return; if (p.over) p.over.classList.remove("lp-over"); p.over = b || null; if (b) b.classList.add("lp-over"); };   // the row under the sliding finger lights, as Apple's
  document.addEventListener("touchstart", (e) => {
    lpEatUntil = 0; if (e.touches.length === 1) { lpGone = null; lpHoldAt = 0; lpUnlisten(); }   // a new touch: its own click goes through (one finger alone: no earlier one is still down)
    if (lp && lp.open) return;                                        // a menu up: a tap is its own (a row, or anywhere else to close it)
    lpDrop(); if (!$("ctxLift").hidden) lpCopyOff();                 // (a copy still settling from a closed menu goes at once: not over what this touch opens or scrolls)
    if (e.touches.length !== 1 || held() || (rs && rs.open) || swipeHolds() || typingIn(document.activeElement)) return;   // (held: a menu, a bubble, a sheet or a question is up; this touch is theirs)
    const it = lpItemOf(e.target); if (!it) return;
    const t = e.touches[0], tgt = e.target;
    lp = { it, id: t.identifier, x: t.clientX, y: t.clientY, lx: t.clientX, ly: t.clientY, open: false, down: true, box: null, rect: null, slid: false, over: null, track: false };
    lp.lift = setTimeout(lpLift, LP_LIFT); lp.timer = setTimeout(lpOpen, LP_MS);
    if (tgt && tgt.addEventListener && typeof AbortController === "function") {   // a touch's events stay aimed at the element it began on: one a redraw takes out of the document no longer passes them on, so they are heard on it too (as the swipe back hears its own)
      const ac = lpAc = new AbortController(), on = (type, fn) => tgt.addEventListener(type, (ev) => { if (!tgt.isConnected) fn(ev); }, { passive: type === "touchcancel", signal: ac.signal });
      on("touchmove", (ev) => lpMove(ev)); on("touchend", (ev) => lpUp(ev, false)); on("touchcancel", (ev) => lpUp(ev, true));
    }
  }, { capture: true, passive: true });
  const lpMove = (e) => {
    const p = lp; if (!p) return;
    const t = [...(e.touches || [])].find((x) => x.identifier === p.id);
    if (!p.open) { if (!t || e.touches.length > 1 || Math.hypot(t.clientX - p.x, t.clientY - p.y) > LP_SLOP) lpDrop(); else { p.lx = t.clientX; p.ly = t.clientY; } return; }   // it wandered: a scroll, a row's swipe, the swipe back
    if (!p.down) return;
    if (e.cancelable) e.preventDefault();                             // the page under the menu never scrolls
    if (!t) return;
    if (!p.slid && Math.hypot(t.clientX - p.ox, t.clientY - p.oy) > LP_SLOP) p.slid = true;   // a slide, not the menu coming to lie under a still finger (measured: Apple's picks only what the finger moves onto)
    if (!p.slid) return;
    p.fx = t.clientX; p.fy = t.clientY; lpOver(lpRowAt(t.clientX, t.clientY));
    if (!p.track && performance.now() - p.openAt < LP_RISE) { p.track = true; requestAnimationFrame(() => lpTrack(p)); }   // the menu still moving into its place: the row under the finger is found again every frame, as the rows pass under it
  };
  const lpTrack = (p) => { if (lp !== p || !p.down) return; lpOver(lpRowAt(p.fx, p.fy)); if (performance.now() - p.openAt < LP_RISE) requestAnimationFrame(() => lpTrack(p)); else p.track = false; };
  document.addEventListener("touchmove", lpMove, { capture: true, passive: false });
  const lpLetGo = () => { lpHoldAt = 0; lpUnlisten(); setTimeout(rsFlush, 400); };   // the hold's finger is up: a sync's redraw that waited comes once its click would have
  const lpUp = (e, cancelled) => {
    const p = lp;
    if (!p) {                                                         // the menu went while this finger was still down (Escape, a turn of the phone): its release is still the hold's, no click
      if (lpGone === null || ![...(e.changedTouches || [])].some((x) => x.identifier === lpGone)) return;
      lpGone = null; lpLetGo(); if (!cancelled && e.cancelable) e.preventDefault(); lpEatUntil = performance.now() + 400; return;
    }
    const t = [...(e.changedTouches || [])].find((x) => x.identifier === p.id); if (!t) return;
    if (!p.open) { lpDrop(); return; }                                // let go before the menu: a tap, as ever
    if (!p.down) return; p.down = false; lpLetGo();
    const b = cancelled || !p.slid ? null : p.over; lpOver(null);   // the row that is lit, and no other: never found again here, where the moving menu may have brought the next one under the finger since it was lit
    if (!cancelled && e.cancelable) e.preventDefault();               // no click on what the hold began on (WebKit sends none for a cancelled touchend)
    if (b) b.click();                                                 // slid onto a row and let go there: that row (measured on the Home Screen)
    lpEatUntil = performance.now() + 400;                             // and a click that comes anyway (a long press clicks on release) goes nowhere
  };
  document.addEventListener("touchend", (e) => lpUp(e, false), { capture: true, passive: false });
  document.addEventListener("touchcancel", (e) => lpUp(e, true), { capture: true, passive: true });
  document.addEventListener("click", (e) => { if (lpEatUntil && performance.now() <= lpEatUntil) { lpEatUntil = 0; e.preventDefault(); e.stopImmediatePropagation(); } }, true);
  window.addEventListener("scroll", () => { if (lp && !lp.open) lpDrop(); }, { capture: true, passive: true });   // the page moved under the finger: a scroll, never a hold
  { const dim = $("ctxDim"); if (dim && dim.addEventListener) dim.addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); if (liftClick) liftClick(e); }); }   // the dimmed page takes the closing tap itself (see openPop)
  const followEl = (row, card) => (card && row.closest && row.closest(".block")) || row;   // the exercise itself (3c, not the top of its card at 3a); the whole card only when asked
  function followRow(id, field, card, now) {                             // an exercise that just moved (a new number): the page goes to that exercise, not to the top of its card (his ask, 9 Nov: "if I just added 3c it jumps to 3c and not 3a"), and the keyboard on the field he was heading for
    const row = $("rows").querySelector('.row[data-id="' + id + '"]'); if (!row) return;
    const to = () => {
      const el = followEl(row, card), head = document.querySelector("header"), hb = head ? head.getBoundingClientRect() : null, off = (hb ? Math.max(hb.bottom, hb.height) : 0) + 12, sc = document.scrollingElement || document.documentElement;   // room for the header even while the keyboard has slid it off the top (measured on the iPhone: 147-208 pt above the screen, 57 tall): when the keyboard goes, the header comes back over the top 57 pt and must not cover the exercise
      return Math.max(0, Math.min(sc.scrollTop + el.getBoundingClientRect().top - off, sc.scrollHeight - sc.clientHeight));
    };
    if (now) (document.scrollingElement || document.documentElement).scrollTop = to();   // a field far down the page and no keyboard yet: the page is there at once, so the phone finds the field on screen and has no reason to slide the whole page (header and all) when its keyboard comes (measured: focused 3000 below, iOS slid it 396 up)
    const inp = field && row.querySelector("." + field); if (inp) inp.focus({ preventScroll: true });
    glide(to);
  }
  function scrollToCard(key) {
    if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur();   // the keyboard leaves first; the glide follows the page as it settles
    const target = () => {
      let el = document.querySelector('.block[data-key="' + CSS.escape(String(key)) + '"]'); if (!el) return null;
      const sc = document.scrollingElement || document.documentElement;
      if (el.classList.contains("done")) {
        let n = el.nextElementSibling; while (n && !(n.classList.contains("block") && !n.classList.contains("done"))) n = n.nextElementSibling;
        if (n) el = n;
        else {                                                        // the last exercise is done: bring the Finish workout area into view, never scrolling back up for it (a short page used to be sent to the top)
          const fin = $("finishBtn"), wrap = $("finishWrap");
          if (fin && !fin.hidden && fin.offsetParent) { const r = (wrap && !wrap.hidden ? wrap : fin).getBoundingClientRect(); const want = sc.scrollTop + r.bottom - sc.clientHeight + 24; return Math.max(0, Math.min(Math.max(sc.scrollTop, want), sc.scrollHeight - sc.clientHeight)); }
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
  let paintedSig = "";              // what the cards on screen were built from: a redraw with the same picture is skipped
  const cardNoteDraft = new Map();  // selKey -> a card note being written: it survives a rebuild of the cards (a sync, a set logged elsewhere)
  let completeAt = 0;               // when Complete set last fired: the second tap of a double tap must not log a second set
  const PREVIEW_KEY = "fiala.preview";
  const previewing = () => previewClient && S.view.name === "training" && trainings.has(S.view.id) && !isTemplateClient(trainings.get(S.view.id).clientId);   // the coach looking at a workout as the client: the page wears the client look
  const applyLook = () => document.body.classList.toggle("client", S.clientMode || previewing());   // one place decides the look, so no entry step can strip it from cards built for the client
  let previewClient = (() => { try { return sessionStorage.getItem(PREVIEW_KEY) === "1"; } catch (_) { return false; } })();   // trainer: showing the workout as the client sees it (display only; saving stays the trainer's). A refresh keeps the view; a fresh open starts as the coach
  const rememberPreview = () => { try { sessionStorage.setItem(PREVIEW_KEY, previewClient ? "1" : "0"); } catch (_) {} };   // "0" too: his own Coach tap survives a reload, and only a new session has none
  const firstPreview = (stored, pg) => (stored === "1" || stored === "0" ? stored === "1" : pg.name === "training" && trainings.has(pg.id) && !isTemplateClient(trainings.get(pg.id).clientId) && openAs() === "client");   // the view a workout page opened anew comes up in: this tab's own on a reload, else (a new session: iOS closed the home-screen app, a new tab) the one set in Settings (the v284 review)
  function rowEl(t, r, group) {
    const el = document.createElement("div"); el.className = "row"; el.dataset.id = r.id;
    el.innerHTML = `
      <div class="top">
        <div class="labwrap"><input class="label tab" placeholder="#" autocomplete="off" autocapitalize="none" aria-label="Number"><div class="numpick" hidden></div></div>
        <div class="exwrap"><textarea class="name" rows="1" maxlength="120" placeholder="Exercise" autocomplete="off" autocapitalize="sentences" aria-label="Exercise"></textarea><div class="ex-icons"><button class="vid-btn" type="button" hidden aria-label="Video" title="Watch video"><svg class="i-play" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M5 3.2v9.6a.5.5 0 0 0 .76.43l7.6-4.8a.5.5 0 0 0 0-.86l-7.6-4.8A.5.5 0 0 0 5 3.2z" fill="currentColor"/></svg><svg class="i-up" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 10l4-4 4 4"/></svg></button><button class="note-btn trainer-only" type="button" aria-label="Note" title="Note"><svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M3.5 4.5h9M3.5 8h9M3.5 11.5h5.5"/></svg></button><button class="alt-btn" type="button" hidden aria-label="Swap exercise" title="Swap exercise"><svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 5.5h10M10 3l2.5 2.5L10 8"/><path d="M13.5 10.5h-10M6 8l-2.5 2.5L6 13"/></svg></button><button class="more-btn trainer-only" type="button" aria-label="More" title="More"><svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true" fill="currentColor"><circle cx="3.8" cy="10" r="1.75"/><circle cx="10" cy="10" r="1.75"/><circle cx="16.2" cy="10" r="1.75"/></svg></button></div><ul class="sugg" hidden></ul><div class="alt-menu" hidden></div><div class="alt-menu note-pop trainer-only" hidden></div></div>
      </div>
      <div class="sum"></div>
      <div class="newname trainer-only" hidden><span>New exercise</span><button class="btn tint addname" type="button">Add to database</button></div>
      <div class="player" hidden></div>
      <div class="vidrow trainer-only" hidden><button class="vid-edit" type="button">Change video</button></div>
      <div class="vid-form" hidden><input class="vid-url" type="url" placeholder="Paste a YouTube link" autocomplete="off" autocapitalize="none" inputmode="url"><div class="vid-actions"><button class="btn sm vid-save" type="button">Save</button><button class="btn danger vid-remove" type="button" hidden>Remove</button><button class="btn quiet vid-cancel" type="button">Cancel</button></div></div>
      <div class="specs">
        <div class="chip"><span class="val"></span><input class="reps tab" inputmode="decimal" placeholder="${REPS_DEFAULT}" aria-label="Reps"><span class="suffix">reps</span></div>
        <div class="chip"><span class="val"></span><input class="rest tab" inputmode="decimal" placeholder="60 sec" aria-label="Rest"><span class="suffix rest-suffix">rest</span></div>
      </div>
      <div class="tempo-wrap"><input class="tempo tab" inputmode="decimal" placeholder="Normal" autocapitalize="characters"><div class="tempo-tiles" hidden></div></div>
      <div class="cnote" hidden><button class="cnote-btn" type="button" aria-expanded="false"><span class="cnote-lab">Instructions</span><svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6l4 4 4-4"/></svg></button><div class="cnote-text" hidden></div></div>
      <div class="weights"><div class="cap"><span class="wunit">Weights &middot; lb</span><span class="last"></span></div><div class="boxes"></div></div>
      <div class="setlog"><div class="pair"><div class="chip stack"><span class="lab">Weight</span><span class="valrow"><span class="val"></span><input class="w tab" inputmode="decimal" autocapitalize="none" aria-label="Weight"><span class="suffix unit">lb</span></span></div><div class="chip stack"><span class="lab">Reps</span><span class="valrow"><span class="val"></span><input class="rp tab" inputmode="numeric" autocapitalize="none" aria-label="Reps"><span class="suffix">reps</span></span></div></div></div>
      <div class="lifts" hidden><button type="button" class="lift last"><span class="vh">Last time </span><svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.25" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 7.6V12l3.1 2.1" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg><b></b></button><button type="button" class="lift best"><span class="vh">Personal best </span><svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M4.2 17.2 2.5 7.4l4.8 3.3L12 4.6l4.7 6.1 4.8-3.3-1.7 9.8z" fill="currentColor"/><path d="M4.6 18.8h14.8v1.9H4.6z" fill="currentColor"/></svg><b></b></button></div>
`;
    const q = (s) => el.querySelector(s);
    if (!(S.clientMode || previewClient)) q(".top").appendChild(q(".ex-icons"));   // the coach's card: the discs (play and "…") are a row under the name (grid row 2), not overlays in the field
    let wText = false;                       // a row that already holds BW / 60 sec opens on the full keyboard (the bar above the keyboard switches it)
    const nonNum = (w) => !!w && !/^[\d.,\s]*$/.test(String(w));
    q(".wunit").textContent = "Weights \u00b7 " + ((clients.get(t.clientId) || {}).unit || "lb");
    const growName = () => { const n = q(".name"); n.style.height = "auto"; n.style.height = Math.max(44, n.scrollHeight) + "px"; };
    const asClient = S.clientMode || previewClient;        // what to show; what to save still follows clientMode
    const locked = asClient && !!t.completedAt && !isTemplateClient(t.clientId);   // a finished workout, as the client sees it (renderTraining's lock): no swap disc, its room given back to the name
    const layoutIcons = () => { const w = asClient ? (q(".vid-btn").hidden ? 0 : 38) + (q(".alt-btn").hidden ? 0 : 46) : 0; /* the coach's name has the whole field: the discs are a row under it, and the stylesheet pins its padding */ for (const el of q(".exwrap").querySelectorAll(".name")) { const px = (w ? 4 + w + 8 : 16) + "px"; el.style.paddingRight = px; el.style.setProperty("--iconpad", px); } growName(); };   // the name wraps before the icons: their real footprint (the client's swap disc is 36px with a 10px gap, the others 38px, all 4px in from the edge) plus a breath
    const loose = (x) => String(x || "").toLowerCase().replace(/-/g, " ").replace(/\s+/g, " ").trim();
    const videoFor = (name) => { const s = String(name || "").trim(); if (!s) return null; const l = loose(ALIASES[s] || s); if (customVideos.has(loose(s))) return customVideos.get(loose(s)); if (customVideos.has(l)) return customVideos.get(l); return VIDEOS[s] || VIDEO_LOOSE.get(l) || null; };
    const markNamed = () => { if (S.clientMode) return; if (!trainerNamed.has(t.id)) trainerNamed.set(t.id, new Set()); trainerNamed.get(t.id).add(r.id); };
    const exwrap = q(".top .exwrap"), altBtn = q(".alt-btn"), altMenu = q(".alt-menu");
    const letter = (String(r.label || "").match(/^(?:\d+|w)([a-z])$/i) || [])[1] || "";   // superset rows read "A  Bench press" (warm-up Wa / Wb too)
    exwrap.dataset.letter = letter.toUpperCase(); el.style.setProperty("--letw", letter ? "42px" : "0px");
    let altMode = "list";
    const altList = () => (r.alts || []).filter(Boolean);
    const paintAltBtn = () => { const n = altList().length; const show = (!asClient || n > 0) && !locked; altBtn.hidden = !show; exwrap.classList.toggle("has-alt", show); altBtn.classList.toggle("some", n > 0); layoutIcons(); };   // the client sees the disc whenever the coach gave alternatives, logged sets or not (a swap keeps the sets)
    let downAt = null;                                                                                 // a tap outside closes the menu; a scroll that starts outside (a finger dragging the page) does not
    const outsideDown = (e) => { downAt = exwrap.contains(e.target) ? null : { x: e.clientX, y: e.clientY }; };
    const outsideUp = (e) => { if (downAt && Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) < 10) closeAlt(); downAt = null; };
    const unwatchKb = () => { if (altMenu._kb && window.visualViewport) { window.visualViewport.removeEventListener("resize", altMenu._kb); altMenu._kb = null; } };
    const closeAlt = () => { altMenu.hidden = true; altMenu.replaceChildren(); altMenu.classList.remove("add"); altMode = "list"; unwatchKb(); document.removeEventListener("pointerdown", outsideDown, true); document.removeEventListener("pointerup", outsideUp, true); if (closeOpenAlt === closeAlt) closeOpenAlt = null; };
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
      altMode = "list"; altMenu.replaceChildren(); altMenu.classList.remove("add"); unwatchKb();
      const alts = altList().filter((a) => a !== r.name);
      if (String(r.name || "").trim()) { const c = mk("div", "cur"); c.appendChild(mk("span", "ck", "\u2713")); c.appendChild(mk("span", null, r.name)); altMenu.appendChild(c); }
      for (const a of alts) altMenu.appendChild(menuItem(a, "", () => { closeAlt(); swapTo(a); }, asClient ? null : () => removeAlt(a)));
      if (!asClient && alts.length < 2) altMenu.appendChild(menuItem("+ Add alternative", "add", paintAltAdd));
      if (!asClient) {                                                                                   // a clear way out, like a sheet: Done on the right (deleting the exercise is in its "…" menu)
        const foot = mk("div", "alt-foot");
        const ok = mk("button", "done", "Done"); ok.type = "button"; ok.addEventListener("mousedown", (ev) => ev.preventDefault()); ok.addEventListener("click", closeAlt);
        foot.append(ok); altMenu.appendChild(foot);
      }
      altMenu.hidden = false;
    }
    function paintAltAdd() {
      altMode = "add"; altMenu.replaceChildren(); altMenu.classList.add("add");                      // solid while a field is being typed in: the glass flickers under a caret on iPhone
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
      const vv = window.visualViewport;                                                              // the keyboard: the field is brought up under the bar and the hits get the room above the keys, so a pick is never hidden under them
      const kb = () => {
        if (!vv || altMode !== "add") return; const r = inp.getBoundingClientRect(), top = vv.offsetTop, want = top + 76;
        if (vv.height < window.innerHeight - 120 && r.top > want + 8) window.scrollBy({ top: r.top - want, behavior: "smooth" });
        const room = top + vv.height - Math.min(r.bottom, want + r.height) - 72; hits.style.maxHeight = Math.max(120, Math.min(room, Math.round(window.innerHeight * 0.32))) + "px";
      };
      if (vv) { altMenu._kb = kb; vv.addEventListener("resize", kb); }
      inp.focus();
    }
    altBtn.addEventListener("mousedown", (ev) => ev.preventDefault());
    altBtn.addEventListener("click", (e) => {
      if (asClient) {                                                                                   // the client picks from the frosted bubble under the disc: consistent with the other pop-ups, and it always fits
        const alts = altList().filter((a) => a !== r.name); if (!alts.length) return;
        showMenu(altBtn, alts.map((a) => ({ label: a, onPick: () => swapTo(a) })), { focus: e.detail === 0 });   // the frosted bubble, like last/best: tap an alternative to swap it in (from the keyboard: focus into it)
        return;
      }
      if (!altMenu.hidden) { closeAlt(); return; }
      q(".sugg").hidden = true; q(".numpick").hidden = true;
      paintAltList(); document.addEventListener("pointerdown", outsideDown, true); document.addEventListener("pointerup", outsideUp, true); closeOpenAlt = closeAlt;
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
    if (ALIASES[r.name]) { r.name = ALIASES[r.name]; if (!S.clientMode) tidySave(t); }
    if (!S.clientMode && Array.isArray(r.alts) && r.alts.some((a) => ALIASES[a])) { r.alts = r.alts.map((a) => ALIASES[a] || a); tidySave(t); }
    q(".label").value = r.label || ""; q(".name").value = r.name || "";
    if (S.clientMode || previewClient) {                                                             // the client reads the name as one run of text, its subtitle in the grey of the superset letter; the coach keeps the one editable line
      const parts = splitName(r.name, subtitleFor(r.name));
      if (parts.sub) {
        const v = document.createElement("div"); v.className = "name name-view"; v.setAttribute("aria-hidden", "true");
        v.append(parts.title); const sub = document.createElement("span"); sub.className = "sub"; sub.textContent = parts.sub; v.appendChild(sub);   // the subtitle on its own line under the name
        q(".name").classList.add("has-sub"); q(".name").insertAdjacentElement("afterend", v); v.style.paddingRight = q(".name").style.paddingRight;   // the box keeps the whole name for the reader; the eye gets the view, with the same room for the discs
      }
    }
    requestAnimationFrame(growName);
    q(".name").addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); e.currentTarget.blur(); } });
    q(".reps").value = r.reps || ""; q(".tempo").value = r.tempo || ""; q(".rest").value = r.rest || "";

    const save = () => scheduleSave("trainings", t.id);
    if (asClient) { for (const s of [".label", ".name", ".reps", ".tempo", ".rest"]) q(s).readOnly = true; for (const s of [".reps", ".tempo", ".rest"]) { const el = q(s); if (!el.value) el.value = el.placeholder; } }   // the trainer's grey defaults read as filled in for the client
    const bind = (sel, field, transform) => { if (asClient) return; q(sel).addEventListener("input", (e) => { r[field] = transform ? transform(e.target.value) : e.target.value; save(); }); };
    if (!asClient) q(".label").addEventListener("input", (e) => { r.label = e.target.value; lastEditedId = r.id; save(); });
    bind(".reps", "reps"); bind(".tempo", "tempo", (v) => { setTimeout(paintTempo, 0); return v; });
    const timedAtPaint = JSON.stringify(measurePlan(r.reps));           // reps turned into "30 sec" (or back): the set log, its labels and the summary follow as soon as he leaves the box
    if (!asClient) q(".reps").addEventListener("blur", (e) => {
      if (kbSwitching || JSON.stringify(measurePlan(r.reps)) === timedAtPaint) return;
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
      q(".label").addEventListener("focus", (e) => { labelAtFocus = e.target.value; if (el.closest && el.closest(".block.done:not(.open)")) return; showNumbers(); });   // a folded finished card takes no clicks: no picker there
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
    const noteBtn = q(".note-btn"), notePop = q(".note-pop");       // instructions for the client: the same panel as Add alternative (solid while typing, a field, Clear and Done), under the name
    const showNote = () => { const v = (r.note || "").trim(); noteBtn.classList.toggle("has", !!v); noteBtn.title = v ? "Instructions" : "Add instructions"; noteBtn.setAttribute("aria-label", noteBtn.title); };
    let noteDownAt = null;
    function noteDown(e) { noteDownAt = notePop.contains(e.target) ? null : { x: e.clientX, y: e.clientY }; }
    function noteUp(e) { if (noteDownAt && Math.hypot(e.clientX - noteDownAt.x, e.clientY - noteDownAt.y) < 10) closeNote(); noteDownAt = null; }   // a tap outside closes it; a drag of the page does not
    function closeNote() {
      if (notePop.hidden) return;
      notePop.hidden = true; notePop.replaceChildren();
      document.removeEventListener("pointerdown", noteDown, true); document.removeEventListener("pointerup", noteUp, true);
      if (closeOpenAlt === closeNote) closeOpenAlt = null;
      showNote();
    }
    function openNote() {
      closeAlt(); if (closeOpenAlt) closeOpenAlt();
      notePop.replaceChildren(); notePop.classList.add("add");
      const ta = mk("textarea", "note-field"); ta.rows = 2; ta.maxLength = 500; ta.placeholder = "Instructions for the client"; ta.value = r.note || ""; ta.setAttribute("autocapitalize", "sentences"); ta.setAttribute("enterkeyhint", "done"); ta.setAttribute("aria-label", "Instructions for the client");
      const grow = () => { ta.style.height = "auto"; ta.style.height = Math.min(ta.scrollHeight, Math.round(window.innerHeight * 0.3)) + "px"; };
      ta.addEventListener("input", () => { r.note = ta.value; grow(); save(); });
      ta.addEventListener("keydown", (e) => { if (e.key === "Escape") { e.preventDefault(); closeNote(); } });
      const foot = mk("div", "alt-foot");
      const clear = mk("button", "remove", "Clear"); clear.type = "button"; clear.addEventListener("mousedown", (ev) => ev.preventDefault()); clear.addEventListener("click", () => { ta.value = ""; r.note = ""; save(); grow(); ta.focus(); });
      const ok = mk("button", "done", "Done"); ok.type = "button"; ok.addEventListener("mousedown", (ev) => ev.preventDefault()); ok.addEventListener("click", closeNote);
      foot.append(clear, ok); notePop.append(ta, foot); notePop.hidden = false; grow();
      document.addEventListener("pointerdown", noteDown, true); document.addEventListener("pointerup", noteUp, true); closeOpenAlt = closeNote;
      const head = document.querySelector("header"), topRow = q(".top") || el;                        // one move, made by us: this exercise's name row glides up under the header, so the panel and its field sit on screen above the keyboard; the phone is given no reason to scroll on its own
      glide(() => { const sc = document.scrollingElement || document.documentElement, off = Math.max(0, head ? head.getBoundingClientRect().bottom : 0) + 12; return Math.max(0, Math.min(sc.scrollTop + topRow.getBoundingClientRect().top - off, sc.scrollHeight - sc.clientHeight)); });
      ta.focus({ preventScroll: true }); const n = ta.value.length; try { ta.setSelectionRange(n, n); } catch (_) {}   // ready to type, the cursor at the end of what is there
    }
    noteBtn.addEventListener("click", openNote);
    showNote();
    const deleteRow = async () => {                                  // asked first, as Apple asks before deleting; a template's change waits for Save template
      closeAlt(); const nm = String(r.name || "").trim() || "this exercise", tpl = isTemplateClient(t.clientId);
      if (!(await askFirst({ title: tpl ? "Delete " + nm + " from this template?" : "Delete " + nm + "?", text: tpl ? "Nothing changes until you tap Save template." : "It comes off this workout, with anything logged on it.", yes: "Delete" }))) return;
      t.rows = t.rows.filter((x) => x.id !== r.id); renumber(t, r); save(); S.renderedTraining = null; render();
    };
    const moreBtn = q(".more-btn");                                  // the coach's "…" disc: the card's other actions, in a menu under it
    const live = (sel, own) => () => {                                // a pick from the menu: a field still typed in is let go first (its redraw may draw this exercise again), then the button of the exercise as it is now
      const a = document.activeElement; if (a && a !== document.body && /^(INPUT|TEXTAREA)$/.test(a.tagName) && a.blur) { a.blur(); document.body.classList.remove("typing"); }   // (and the typing look with it: a field its own redraw took off the page never tells the page it let go)
      const now = $("rows").querySelector('.row[data-id="' + CSS.escape(r.id) + '"]'), b = (now && now.querySelector(sel)) || own; if (b) b.click();
    };
    const moreItems = () => exerciseMenu(r, { swap: live(".alt-btn", altBtn), note: live(".note-btn", noteBtn), remove: deleteRow });
    if (moreBtn) moreBtn.addEventListener("click", (e) => {
      e.stopPropagation(); closeAlt();
      showMenu(moreBtn, moreItems(), { align: "right", focus: e.detail === 0 });
    });
    el._ctx = exerciseCtx(moreBtn, moreItems, closeAlt);             // a right-click on the exercise: the same menu, at the pointer (its open panel closes first)

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
      const timed = !!measurePlan(r.reps), tmNow = measurePlan(r.reps), cu = (clients.get(t.clientId) || {}).unit || "lb";
      let best = null, last = null;
      for (const other of clientTrainings(t.clientId)) {              // newest first
        if (other.id === t.id) continue;                               // today is what the line is compared against, never part of it
        const earlier = effDate(other) < effDate(t) || (effDate(other) === effDate(t) && (other.createdAt || "") < (t.createdAt || ""));
        if (!earlier) continue;
        for (const x of other.rows || []) {
          if (canon(x.name) !== name) continue; let st = topSet(x, timed); if (!st) continue;
          const xu = measurePlan(x.reps), kindOf = (u) => (!u ? "reps" : u.unit === "m" ? "m" : "time"); if (kindOf(xu) !== kindOf(tmNow)) continue;   // reps, a hold and a carry are three different measures: never compared number for number
          st = toUnit(st, x.unit, cu); if (timed && xu && tmNow) st = toTimeUnit(st, xu.unit, tmNow.unit); st.date = effDate(other); st.title = String(other.title || "").trim();
          if (betterSet(st, best, timed)) best = st;                   // equal numbers: the newest session keeps the title
          if (!last) last = st;
        }
      }
      return best ? { best, last, timed } : null;
    };
    const paintLifts = () => {                                       // LAST 215 lb × 4   BEST 230 lb × 3  ·  one entry when the best was the last session  ·  NEW BEST in gold while today beats it  ·  a tap on a number tells when
      const box = q(".lifts"), h = isTemplateClient(t.clientId) ? null : liftHistory();
      box.hidden = !h; if (!h) return;
      const unit = (clients.get(t.clientId) || {}).unit || "lb", tm = measurePlan(r.reps);
      const fmt = tm ? (st) => (st.w != null ? st.w + " " + unit + " \u00d7 " : "") + (tm.unit === "min" && !Number.isInteger(st.rp) ? Math.round(st.rp * 60) + " sec" : st.rp + " " + tm.unit) : (st) => st.w != null ? st.w + " " + unit + (st.rp != null ? " \u00d7 " + st.rp : "") : st.rp + (st.rp === 1 ? " rep" : " reps");
      const now = toUnit(topSet(r, h.timed, (group.sel | 0) + 1), r.unit, unit), newBest = !!(now && betterSet(now, h.best, h.timed)), same = sameSet(h.last, h.best);   // the set under the finger counts for the gold preview as it is typed
      q(".lift.best").classList.toggle("new", newBest); q(".lift.best b").textContent = fmt(newBest ? now : h.best); q(".lift.best .vh").textContent = newBest ? "New best " : "Personal best ";   // the read-out word follows the state
      q(".lift.last").hidden = !h.last; if (h.last) q(".lift.last b").textContent = fmt(h.last);   // both halves always, even when the best was the last session (his call)
      box._info = { last: h.last, best: h.best, now, newBest, same, fmt };
      box.classList.remove("tight");
      requestAnimationFrame(() => { if ([...box.querySelectorAll(".lift b")].some((b) => b.scrollWidth > b.clientWidth + 1)) box.classList.add("tight"); });   // a long number: a step smaller, never cut
    };
    const liftRows = (i) => {                                          // the bubble, in words: every line that applies, best first
      const rows = [];
      if (i.newBest) rows.push({ k: "New best", v: i.fmt(i.now), d: whenDay(effDate(t), true) || "Today" });
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
      const timed = measurePlan(r.reps); q(".setlog").classList.toggle("timed", !!timed);   // a plank: the box says Time and comes first, Weight waits beside it
      const asW = (v) => (timed && timeAsWeight(v) ? "" : v);                              // a hold never borrows "45 sec" as its weight (the old app typed seconds there)
      const lw = asW(last && last.weights[sel] ? String(last.weights[sel]) : ""), lr = last && last.reps && last.reps[sel] ? String(last.reps[sel]) : "";
      const carry = carried(r, sel);   // the set before (else last time) shows in grey: type over it, or leave it and Complete set writes it down
      w.value = r.weights[sel] || ""; w.placeholder = asW(carry.w) || lw || "";           // nothing to suggest: the chip just says "lb"
      rp.value = r.repsDone[sel] || ""; rp.placeholder = carry.rp || lr || planNumber(r.reps);   // the set before, last time, else the plan's number (8–10 shows 10): what shows grey is what Complete set writes
      w.inputMode = (wText || nonNum(r.weights[sel] || carry.w || "")) ? "text" : "decimal";
      const mark = () => { const track = S.clientMode ? pendingWeightRows : trainerTouched; if (!track.has(t.id)) track.set(t.id, new Set()); track.get(t.id).add(r.id); save(); };
      let wWas = null, rpWas = null, wFollow = [], rpFollow = []; w.addEventListener("focus", () => { wWas = String(r.weights[sel] || ""); wFollow = followFrom(r.weights, sel, wWas); }); rp.addEventListener("focus", () => { rpWas = String(r.repsDone[sel] || ""); rpFollow = followFrom(r.repsDone, sel, rpWas); });   // what the box held when editing began, and which later sets copied it: the whole correction reaches them, keystroke by keystroke
      w.addEventListener("input", (e) => { r.weights = correctFrom(r.weights, sel, e.target.value, wWas, wFollow); if (!r.unit) r.unit = unit; mark(); paintLifts(); });   // NEW BEST lights up as it is typed; later sets that copied this number follow the correction
      rp.addEventListener("input", (e) => { const v = e.target.value.replace(/[^0-9]/g, "").slice(0, 4); r.repsDone = correctFrom(r.repsDone, sel, v, rpWas, rpFollow); e.target.value = v; mark(); paintLifts(); });
      w.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); kbNext(); } });
      rp.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); kbNext(); } });   // on to the next exercise of the superset, else the keyboard goes
      const hand = perHand(r.name); q(".setlog .chip.stack:nth-child(1) .lab").textContent = hand ? "Weight / " + hand : "Weight";   // one dumbbell, one kettlebell: the label says what the number is per
      w.maxLength = 16; rp.maxLength = 16;
      wireChip(w, { empty: timed ? "Bodyweight" : "Log weight", hint: true, suffix: (v) => weightWord(v, r.unit || unit), show: showWeight });   // a hold with no weight is bodyweight; BW can still be typed or picked   // after the handlers above, so the words follow the tidied value; never logged before = the box asks
      const perSide = /(\/|each|per)\s*(side|leg|arm)/i.test(String(r.reps || ""));             // "10 / side": the label says so, the box holds the number
      q(".setlog .chip.stack:nth-child(2) .lab").textContent = (timed ? (timed.unit === "m" ? "Distance" : "Time") : "Reps") + (perSide ? " / side" : "");
      if (timed) wireChip(rp, { empty: timed.unit === "m" ? "Log distance" : "Log time", hint: true, suffix: () => timed.unit, show: (v) => v });
      else wireChip(rp, { empty: "\u2013", suffix: () => "", show: (v) => String(v || "").replace(/\s*(\/|each|per)\s*(side|leg|arm)\s*$/i, "").replace(/\s*reps?\s*$/i, "") });   // the label above already says Reps: the box holds the number alone (lbs and sec are units, "reps" would only repeat the label)
    }
    const chipText = (c) => c.querySelector(".val").textContent + (c.querySelector(".suffix").hidden ? "" : " " + c.querySelector(".suffix").textContent);
    const nSets = setsOf(r), sumEl = q(".sum"); sumEl.replaceChildren();   // "3 sets · 8–10 reps · 60 sec transition" (the open card hides the sets part: the chips above say it)
    const chips = [...el.querySelectorAll(".specs .chip")];
    for (const [text, cls] of [[nSets + (nSets === 1 ? " set" : " sets"), "si sum-sets"], [chipText(chips[0]), "si sum-reps"], [chipText(chips[1]), "si sum-rest"]]) { if (!text) continue; const e = document.createElement("span"); e.className = cls; e.textContent = text; sumEl.appendChild(e); }
    {                                                                  // the finished card, opened: every set in a cell — number, weight × reps (editable in place for a typo), a check
      const unitS = (clients.get(t.clientId) || {}).unit || "lb", tmS = measurePlan(r.reps), sumEl = document.createElement("div"); sumEl.className = "row-sum";
      const runitWord = tmS ? tmS.unit : /(\/|each|per)\s*(side|leg|arm)/i.test(String(r.reps || "")) ? "reps / side" : "reps";   // "× 5 reps", "× 8 reps / side", "× 45 sec"
      const mark = () => { const track = S.clientMode ? pendingWeightRows : trainerTouched; if (!track.has(t.id)) track.set(t.id, new Set()); track.get(t.id).add(r.id); scheduleSave("trainings", t.id); };
      const fit = (inp) => { inp.style.width = Math.ceil(textWidth(inp.value || inp.placeholder || "", !inp.value) + 7) + "px"; };   // as wide as its text, measured in the real font ("BW" is wide letters, not two digits)
      const refresh = () => { for (const line of sumEl.children) { const i = +line.dataset.i, wi = line.querySelector(".sum-w"), ri = line.querySelector(".sum-r"); if (!wi) continue; if (document.activeElement !== wi) { wi.value = String((r.weights || [])[i] || ""); fit(wi); } if (document.activeElement !== ri) { ri.value = String((r.repsDone || [])[i] || ""); fit(ri); } line.querySelector(".sum-unit").textContent = wi.value.trim() ? weightWord(wi.value, r.unit || unitS) : ""; line.querySelector(".runit").textContent = ri.value.trim() ? runitWord : ""; } };   // an empty box shows its grey word alone
      for (let i = 0; i < setsOf(r); i++) {
        const line = document.createElement("div"); line.className = "sum-set"; line.dataset.i = i; const counted = setCounts(r, i); line.classList.toggle("skip", !counted);
        const n = document.createElement("span"); n.className = "sum-n"; n.textContent = i + 1; line.appendChild(n);
        if (!counted) { const v = document.createElement("span"); v.className = "sum-val"; v.textContent = "Not done"; line.appendChild(v); }
        else {
          const val = document.createElement("span"); val.className = "sum-val";
          const wi = document.createElement("input"); wi.className = "sum-w"; wi.maxLength = 16; wi.inputMode = "decimal"; wi.placeholder = "Bodyweight"; wi.setAttribute("aria-label", "Weight, set " + (i + 1)); wi.autocomplete = "off";
          const unit = document.createElement("span"); unit.className = "sum-unit";
          const x = document.createElement("span"); x.className = "sum-x"; x.textContent = "\u00d7";
          const ri = document.createElement("input"); ri.className = "sum-r"; ri.maxLength = 16; ri.inputMode = "numeric"; ri.placeholder = tmS ? tmS.unit : "reps"; ri.setAttribute("aria-label", (tmS ? (tmS.unit === "m" ? "Meters" : "Seconds") : "Reps") + ", set " + (i + 1)); ri.autocomplete = "off";
          const runit = document.createElement("span"); runit.className = "sum-unit runit"; runit.textContent = runitWord;
          val.append(wi, unit, x, ri, runit); line.appendChild(val);
          let wiWas = null, riWas = null, wiFollow = [], riFollow = []; wi.addEventListener("focus", () => { wiWas = String((r.weights || [])[i] || ""); wiFollow = followFrom(r.weights, i, wiWas); }); ri.addEventListener("focus", () => { riWas = String((r.repsDone || [])[i] || ""); riFollow = followFrom(r.repsDone, i, riWas); });
          wi.addEventListener("input", () => { r.weights = correctFrom(r.weights, i, wi.value, wiWas, wiFollow); if (!r.unit) r.unit = unitS; fit(wi); mark(); refresh(); });
          ri.addEventListener("input", () => { const v = ri.value.replace(/[^0-9]/g, "").slice(0, 4); ri.value = v; r.repsDone = correctFrom(r.repsDone, i, v, riWas, riFollow); fit(ri); mark(); refresh(); });
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
  $("viewSeg").addEventListener("click", (e) => { const b = e.target.closest("button[data-view]"); if (!b) return; previewClient = b.dataset.view === "client"; rememberPreview(); S.renderedTraining = null; render(); });
  $("clientForm").addEventListener("submit", (e) => { e.preventDefault(); const n = $("clientName").value.trim(); if (!n) return; $("clientName").value = ""; addClient(n); });
  $("cNameField").addEventListener("input", (e) => { const c = clients.get(S.view.id); if (!c) return; c.name = e.target.value; $("cName").textContent = c.name; paintHeroes(); paintMeDisc(); $("cardName").textContent = c.name || "Client"; scheduleSave("clients", c.id); });
  // the photo at the top of a client's page: the coach on any client, the client on her own (on her Profile tab). Last change wins.
  let photoTarget = null;
  function pickPhoto(id, camera) {                                  // the phone's own camera, or its photo library; a tap inside the menu row is the gesture that opens it
    const inp = $("photoInput"); photoTarget = id;
    if (camera) inp.setAttribute("capture", S.clientMode ? "user" : "environment"); else inp.removeAttribute("capture");   // the client takes a selfie; the coach photographs her
    inp.value = ""; inp.click();
  }
  $("photoInput").addEventListener("change", async () => {
    const inp = $("photoInput"), f = inp.files && inp.files[0], id = photoTarget; photoTarget = null; inp.value = "";
    if (!f || !id || !clients.get(id)) return;
    let blob = null;
    try { blob = await cropPhoto(f); }                                // Move and Scale: pinch to zoom, drag to frame the face, then Choose
    catch (_) { $("status").textContent = "Couldn\u2019t read that photo \u00b7 try another"; return; }
    if (!blob || !clients.get(id)) return;                            // Cancel: nothing changes
    await setPhoto(id, blob);
    paintHeroes(); paintMeDisc(); render();
  });
  function photoMenu(anchor, id) {                                 // Take photo, Choose photo, and Remove photo once there is one; the coach on any client, the client on her own
    const c = clients.get(id);
    if (!c || isTemplateClient(id) || (S.clientMode && id !== S.myClientId)) return;
    const items = [
      { label: "Take photo", icon: MI.camera, onPick: () => pickPhoto(id, true) },
      { label: "Choose photo", icon: MI.photo, onPick: () => pickPhoto(id, false) },
    ];
    if (photoFor(id)) items.push({ label: "Remove photo", icon: MI.trash, danger: true, onPick: async () => { if (!(await askFirst({ title: "Remove this photo?", yes: "Remove" }))) return; await setPhoto(id, null); paintHeroes(); paintMeDisc(); render(); } });
    showMenu(anchor, items, { align: "center" });
  }
  function heroId(which) { return which === "me" ? (S.clientMode ? S.myClientId : null) : (S.clientMode ? null : S.view.id); }   // Settings: the client's own; the card: the client the coach is looking at
  function paintHeroes() {                                          // the big photo at the top of the client's Settings and of the coach's client card
    for (const which of ["me", "card"]) {
      const id = heroId(which), c = id && clients.get(id), hero = $(which === "me" ? "meHero" : "cardHero");
      if (!c || isTemplateClient(id)) { if (which === "card") hero.hidden = true; continue; }
      hero.hidden = false;
      paintAvatar($(which + "PhotoBtn").firstElementChild, id, c.name);
      $(which + "PhotoEdit").textContent = photoFor(id) ? "Edit" : "Add photo"; $(which + "PhotoEdit").setAttribute("aria-label", photoFor(id) ? "Edit photo" : "Add photo");   // one stop for VoiceOver, saying what it does
      if (which === "me") $("meHeroName").textContent = c.name || "";
    }
  }
  function paintMeDisc() {                                          // the person in the bar: on a client's page, her photo or her initials
    const d = $("meDisc"), id = S.view.id, c = clients.get(id), on = !d.hidden && !!c && !isTemplateClient(id);
    d.classList.toggle("has-av", on); if (on) paintAvatar(d.querySelector(".avatar"), id, c.name);
  }
  for (const which of ["me", "card"]) for (const part of ["PhotoBtn", "PhotoEdit"]) $(which + part).addEventListener("click", () => { const id = heroId(which); if (id) photoMenu($(which + "PhotoBtn"), id); });
  const growNotesBox = () => growBox($("cNotes"));
  $("cNotes").addEventListener("input", (e) => { const c = clients.get(S.view.id); if (!c) return; if (e.target.value.trim()) noteDraft.set(c.id, e.target.value); else noteDraft.delete(c.id); $("noteActions").hidden = !e.target.value.trim(); growNotesBox(); });
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
    const was = c.unit || "lb"; c.unit = b.dataset.unit; scheduleSave("clients", c.id);
    if (was !== c.unit) for (const t of clientTrainings(c.id)) if (stampUnit(t, was)) scheduleSave("trainings", t.id);   // what was logged stays what it was: 100 lb does not become 100 kg
    for (const x of $("unitSeg").querySelectorAll("button")) x.classList.toggle("on", x === b);
  });
  $("cEmail").addEventListener("input", (e) => {
    const c = clients.get(S.view.id); if (!c) return; const v = e.target.value.trim().toLowerCase();
    const dup = v && [...clients.values()].find((o) => o.id !== c.id && !isTemplateClient(o.id) && norm(o.email) === norm(v));   // one email, one client: the server refuses a second, so the box does too
    e.target.classList.toggle("bad", !!dup); if (dup) { $("status").textContent = "That email is on " + (dup.name || "another client"); return; }
    if (/That email is on/.test($("status").textContent)) $("status").textContent = "";
    c.email = v; scheduleSave("clients", c.id);
  });
  $("cEmail").addEventListener("blur", () => { const c = clients.get(S.view.id); if (c) $("meDisc").classList.toggle("needs", !c.email); });
  $("cPhone").addEventListener("input", (e) => { const c = clients.get(S.view.id); if (!c) return; c.phone = e.target.value.trim(); scheduleSave("clients", c.id); });
  $("cBirthday").addEventListener("change", (e) => { const c = clients.get(S.view.id); if (!c) return; c.birthday = e.target.value || ""; scheduleSave("clients", c.id); });
  // phone -> international digits for sms: and wa.me (US numbers without a country code get +1)
  const phoneDigits = (p) => { let d = String(p || "").replace(/\D/g, ""); if (!d) return ""; if (String(p).trim().startsWith("+")) return d; if (d.length === 10) return "1" + d; if (d.length === 11 && d[0] === "1") return d; return d.length >= 7 ? d : ""; };

  // the coach's "Message <first name>" link: sms: or WhatsApp, by the client's chat setting. Returns false when there is no number to reach.
  function fillMsg(a, textEl, c) {
    const tel = c ? phoneDigits(c.phone) : ""; if (!tel) return false;
    const wa = (c.chat || "sms") === "whatsapp";
    textEl.textContent = "Message " + ((c.name || "").trim().split(/\s+/)[0] || "client");
    a.href = wa ? "https://wa.me/" + tel : "sms:+" + tel;
    if (wa) { a.target = "_blank"; a.rel = "noopener"; } else { a.removeAttribute("target"); a.removeAttribute("rel"); }
    return true;
  }  function msgTarget(name, id) {                                     // the bar's Messages disc on a client's page and on a workout: the coach messages the client (her number), a client the trainer (his number on her record), by her chat setting (sms: or WhatsApp); none on a template or without a number
    const t = name === "training" ? trainings.get(id) : null, c = name === "client" ? clients.get(id) : t ? clients.get(t.clientId) : null;
    if (!c || isTemplateClient(c.id)) return null;
    const tel = phoneDigits(S.clientMode ? c.trainerPhone : c.phone); if (!tel) return null;
    const wa = (c.chat || "sms") === "whatsapp";
    return { href: wa ? "https://wa.me/" + tel : "sms:+" + tel, wa, label: S.clientMode ? "Message Michal" : "Message " + ((c.name || "").trim().split(/\s+/)[0] || "client") };
  }
  function paintBarMsg() {                                           // up in the bar beside the photo, and beside the workout's "…" (his pick, 10 Nov: as Apple's Fitness, two separate circles); the client's view the same
    const a = $("barMsg"), m = S.view.name === "client" || S.view.name === "training" ? msgTarget(S.view.name, S.view.id) : null;
    a.hidden = !m; if (!m) return;
    a.href = m.href; $("barMsgText").textContent = m.label;
    if (m.wa) { a.target = "_blank"; a.rel = "noopener"; } else { a.removeAttribute("target"); a.removeAttribute("rel"); }
  }



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
  });
  $("tabbar").addEventListener("click", (e) => { const b = e.target.closest("button"); if (!b || b.dataset.tab === S.tab) return; setTab(b.dataset.tab); render(); window.scrollTo(0, 0); });
  const typingIn = (el) => !!el && /^(INPUT|TEXTAREA)$/.test(el.tagName) && !/^(date|month|checkbox|radio|file|range)$/.test(el.type || "");   // a keyboard is coming: a select or a date wheel is not typing
  document.addEventListener("focusin", (e) => { if (typingIn(e.target) && !deskOn) document.body.classList.add("typing"); });   // a phone's keyboard comes up over the bottom (the bar at the foot gives way: index.html); a computer's is on the desk, so its bar stays (the + under the pointer for the next exercise)
  const typingOff = () => { setTimeout(() => { if (!typingIn(document.activeElement)) document.body.classList.remove("typing"); }, 80); };
  document.addEventListener("focusout", typingOff);
  document.addEventListener("blur", typingOff, true);                // a field whose own blur redraws the page (an exercise's new number) is off the page before its focusout, which then never reaches here: the tab bar stayed hidden after it. Its blur is heard on the way down, while it is still on the page
  $("newTraining").addEventListener("click", () => addTraining(S.view.id, null, today()));
  $("addBtn").addEventListener("click", newWorkoutHere);
  $("dayMore").addEventListener("click", () => { const t = trainings.get(S.view.id); const c = t && clients.get(t.clientId); if (c && effDate(t)) showDay(c, effDate(t)); });
  $("delClient").addEventListener("click", () => { $("delClient").hidden = true; $("delClientConfirm").hidden = false; });
  $("delClientNo").addEventListener("click", () => { $("delClientConfirm").hidden = true; $("delClient").hidden = false; });
  $("delClientYes").addEventListener("click", () => deleteClient(S.view.id));

  $("tTitle").addEventListener("input", (e) => { const t = trainings.get(S.view.id); if (!t) return; t.title = e.target.value.replace(/\n/g, " "); e.target.style.height = "auto"; e.target.style.height = Math.max(32, e.target.scrollHeight) + "px"; scheduleSave("trainings", t.id); });
  $("tTitle").addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); e.currentTarget.blur(); } });
  for (const ev of ["focus", "blur"]) $("tTitle").addEventListener(ev, (e) => { const el = e.currentTarget; requestAnimationFrame(() => { el.style.height = "auto"; el.style.height = Math.max(32, el.scrollHeight) + "px"; }); });   // the box changes its padding on focus: measured again so the letters are never clipped and no gap is left behind
  // the client's "…" on the workout page: Reschedule, in the same frosted menu as every other; the day picker then moves the workout
  // (from today on). A client's move reaches the server by its own rule (client_move_training, as Do it today); the coach's is an ordinary save.
  function canReschedule(t) { return !!t && !isTemplateClient(t.clientId) && !t.completedAt && !t.skippedAt && (S.clientMode || previewClient); }   // a declaration: render() and the swipe's bar ask before this line has run
  function coachMore(t) { return !!t && !S.clientMode && !(previewClient && !isTemplateClient(t.clientId)); }   // the coach's own view of a workout or a template (not his Client view of it): his "…", with Delete (his ask, 10 Nov)
  function moreOn(t) { return canReschedule(t) || coachMore(t); }   // the workout page's "…" in the bar
  function canSwipeRow(t) { return !!t && !isTemplateClient(t.clientId) && !t.completedAt && !t.skippedAt; }   // a workout still to do swipes to Skip and Reschedule on Today and Up next, in the client's view and in the trainer's (his pick); its page offers both too
  function moveWorkout(id, date) {                                  // the trainer's Reschedule from a row: any day, an ordinary save, as his date on the workout page ("Move to") moves it
    const t = trainings.get(id); if (!canSwipeRow(t) || !/^\d{4}-\d{2}-\d{2}$/.test(date) || date === t.date) return false;   // asked again at the pick: a sync may have brought in a finish or a skip while the days were open
    touchState(id, "date"); t.date = date; scheduleSave("trainings", id); S.renderedTraining = null; render(); return true;
  }
  // ---------- the workout preview (his ask, 10 Nov: "I want to be able to see preview of the workout cleanly … at the bottom … go to workout and
  // cancel"; "it can look like my closed cards in actual workout", "not exactly like that but aesthetically pleasing and simple", "no green
  // lines", "it can say start workout … whatever Apple would say"). A row's swipe (Preview, beside Skip and Reschedule), its touch and hold
  // and a missed workout's "…" open a sheet on the page's grey: the workout's title and day, then its cards as Apple draws an inset grouped
  // list, one card per number (a superset together): each exercise's number (quiet), its name, and "4 sets · 10 reps" under it, a hairline
  // from the name to the card's edge between them; a finished card says so in a quiet line, nothing green; Start workout (Apple's Fitness
  // says Start Workout on a planned one) at the foot, Apple's close cross in the corner (no Cancel, his ask, from Calendar's event sheet). Both
  // views. It asks nothing: a look, then the page or back.
  let pv = null, pvDrag = null, pvAnim = null;                         // the sheet up: { id, at, back, behind }; a finger pulling it; its spring after the finger
  function groupsOf(rows) {                                            // a workout's cards: rows next to each other under one number are one card (a superset)
    const groups = [];
    (rows || []).forEach((r, i) => { const k = groupKey(r.label, i); if (!groups.length || groups[groups.length - 1].key !== k) groups.push({ key: k, rows: [] }); groups[groups.length - 1].rows.push(r); });
    return groups;
  }
  function groupSummary(g) {                                           // a finished card's status lines (its folded card's and the preview's): finished, finished early, or skipped
    const total = Math.max(...g.rows.map(setsOf));
    const did = Math.min(...g.rows.map((r) => { const n = Math.min(doneCount(r), setsOf(r)); return n >= setsOf(r) ? total : n; }));
    const early = g.rows.some((r) => r.done && Math.min(doneCount(r), setsOf(r)) < setsOf(r));   // doneCount: a row finished before the counter existed is simply finished
    const sets = (n) => n + " of " + total + (total === 1 ? " set" : " sets"), why = (g.rows.find((r) => r.earlyReason) || {}).earlyReason || "";
    if (!early) return { early: false, skipped: false, lines: ["Finished \u00b7 " + sets(total)] };
    if (did === 0) return { early: true, skipped: true, lines: ["Skipped" + (why ? " \u00b7 " + why : "")] };   // nothing logged: skipped, not "finished early · 0 of 4"
    const left = total - did;
    return { early: true, skipped: false, lines: ["Finished early \u00b7 " + sets(did), left + (left === 1 ? " set" : " sets") + " not completed" + (why ? " \u00b7 " + why : "")] };
  }
  const pvReps = (v) => { const t = String(v == null ? "" : v).trim() || REPS_DEFAULT; const w = repsWord(t); return showReps(t) + (w ? " " + w : ""); };   // blank: the page's own grey "10"   // "10, 8, 6 reps", "30 sec", "8 reps / side": as the workout's cards write them
  const pvName = (t) => String((t && t.title) || "").trim() || "Workout";
  const pvMissed = (t) => canSwipeRow(t) && !!effDate(t) && effDate(t) < today();   // its day gone, still to do (the Missed card's)
  const pvState = (t) => (t.completedAt ? "done" : t.skippedAt ? (t.missed ? "miss" : "skip") : pvMissed(t) ? "miss" : "todo");   // what the preview marks (his picks, 11 Nov): finished green, skipped grey, missed red (this week's, or filed to History after a week), still to do plain
  function pvFill(t, titleEl, dayEl, cardsEl) {                        // a workout's page: its title, its day, its cards (the list's own, or the one sliding in beside it)
    const span = (cls, text) => { const s = document.createElement("span"); s.className = cls; s.textContent = text; return s; };
    titleEl.textContent = pvName(t);
    const day = fmtDayLong(effDate(t) || "");
    const state = pvState(t), word = { done: "\u2713 Finished", skip: "Skipped", miss: "Missed" }[state];
    dayEl.className = "pv-day" + (word ? " st-" + state : ""); cardsEl.className = "pv-cards" + (word ? " st-" + state : "");   // History's and the missed ones in their colour (his picks, 11 Nov): the day line and the cards, as History's own page draws a finished one; one still to do plain
    if (word) dayEl.replaceChildren(span(state === "done" ? "finished" : state === "skip" ? "skipped" : "missed", word), document.createTextNode(day ? " \u00b7 " + day : ""));   // it says what it is first (a missed one in red, as its row does)
    else dayEl.textContent = day;
    const cards = groupsOf(t.rows).map((g) => {
      const st = g.rows.every((r) => r.done) ? groupSummary(g) : null;
      const card = document.createElement("div"); card.className = "pv-card" + (st && !st.skipped ? " done" : "");   // done as its page marks a card (.block.done): finished, or finished early with sets logged; skipped with nothing logged, or never started, plain (the review's catch: a finished workout's preview had made every card green)
      for (const r of g.rows) {
        const row = document.createElement("div"); row.className = "pv-row";
        const body = document.createElement("div"); body.className = "pv-b";
        const parts = splitName(r.name, subtitleFor(r.name));
        body.appendChild(span("pv-n", parts.title || "Exercise")); if (parts.sub) body.appendChild(span("pv-sub", parts.sub));
        const sum = document.createElement("div"); sum.className = "pv-sum"; const n = setsOf(r);
        for (const text of [n + (n === 1 ? " set" : " sets"), pvReps(r.reps)]) if (text) sum.appendChild(span("si", text));
        body.appendChild(sum); row.append(span("pv-l", String(r.label || "").trim()), body); card.appendChild(row);
      }
      if (st) { const foot = document.createElement("div"); foot.className = "pv-foot"; for (const line of st.lines) foot.appendChild(span("pv-line", line)); card.appendChild(foot); }   // finished: a line, as its folded card says it (green on a finished workout's cards)
      const gc = groupCaption(g), cap = document.createElement("div"); cap.className = "pv-cap"; cap.textContent = gc.main;   // its caption over it, as the client's workout page captions its cards (his pick B, 10 Nov): "EXERCISE 2 · SUPERSET"
      if (gc.kind) { const k = document.createElement("i"); k.textContent = " \u00b7 " + gc.kind; cap.appendChild(k); }
      const grp = document.createElement("div"); grp.className = "pv-grp"; grp.append(cap, card);
      return grp;
    });
    if (!cards.length) { const none = document.createElement("p"); none.className = "pv-none"; none.textContent = "Nothing added yet"; cards.push(none); }
    cardsEl.replaceChildren(...cards);
  }
  function paintPreview(t) {
    const gb = $("pvGo"), hist = !canSwipeRow(t); gb.textContent = hist ? "Show in History" : "Start workout";   // Start workout is a planned one's (Apple's Fitness word); a finished one, from its green chip in the calendar (v262), is shown in History (his pick, 11 Nov)
    for (const k of ["tint", "wide", "soft"]) gb.classList.toggle(k, hist);   // Show in History goes somewhere, it does nothing: the grey capsule (Skip workout's, Undo's), never the purple of an act (his ask, 11 Nov: "not purple but our Apple transparent because it's not an action")
    pvFill(t, $("pvTitle"), $("pvDay"), $("pvCards")); $("pvBarTitle").textContent = pvName(t);
    const say = $("pvSay"); if (say.textContent && say.textContent !== pvLine(t)) say.textContent = "";   // VoiceOver's line never tells of another workout or an old day
    pvFit(); pvArrows(); pvTitleRoom();                               // (a sync's redraw: it may scroll now, or no longer; the workouts either side may have changed)
  }
  function openPreview(id) {                                           // its swipe's Preview, its touch and hold, a missed workout's "…"
    const t = trainings.get(id); if (!t || isTemplateClient(t.clientId) || pv || S.asking) return false;   // (another question up: it waits for that one)
    paintPreview(t);
    const bg = $("pvSheet"); pv = { id, at: performance.now(), back: document.activeElement, behind: [...document.body.children].filter((el) => el !== bg && !el.inert && !(el.hidden && (el.id === "whenBg" || (el.classList && el.classList.contains("sheet-bg"))))) };   // (what was inert already, as #ctxLift, stays so; the menu layer and the other sheets, hidden, stay usable: the preview's "…" opens them over it)
    for (const el of pv.behind) el.inert = true;                       // the page behind is out of reach until the sheet goes, as every sheet's
    S.asking = true; pvReset(); pvSlideReset(); bg.hidden = false; document.body.classList.add("pv-up"); $("pvScroll").scrollTop = 0; pvFingers = 0; pvTop(true); pvFit(); pvHeader(); pvArrows(); pvTitleRoom();
    setTimeout(() => { if (pv) $("pvBox").focus({ preventScroll: true }); }, 0);   // into the sheet (a keyboard or VoiceOver reads it from its title), no ring on a button nobody chose
    return true;
  }
  function closePreview(refocus) {                                    // refocus: closed by a keyboard or VoiceOver (Escape, the cross's Enter): its place goes back where it was (the "…" it came from, else the row), as the menus and the day picker give it back; a tap leaves focus where WebKit put it (no ring on a row nobody chose)
    if (!pv) return false; const p = pv; pv = null; if (askOpen) askOpen(false); if (sk) closeSkip(); if (dp) closeDatePicker(); pvReset(); pvSlideReset(); $("pvSay").textContent = ""; if (popClose && popAnchor === $("pvMore")) popClose(); $("pvSheet").hidden = true; $("pvSheet").inert = false; document.body.classList.remove("pv-up"); pvBarReset(); for (const el of p.behind) el.inert = false; S.asking = false;   // (a question up over it goes with it, as UIKit dismisses what is above a sheet it takes away)
    if (refocus) { const drawn = (el) => typeof el.getClientRects !== "function" || el.getClientRects().length > 0, b = p.back, ok = b && b !== document.body && b.isConnected !== false && drawn(b) && !(b.closest && b.closest(".swipe-acts")); const day = !ok && b && b.dataset && b.dataset.day ? [...$("vClient").querySelectorAll('button[data-day="' + b.dataset.day + '"]')].find((x) => x.tabIndex >= 0 && drawn(x)) : null; const to = ok ? b : day || $("vClient").querySelector('li[data-tid="' + CSS.escape(p.id) + '"] > button'); if (to && typeof to.focus === "function") to.focus({ preventScroll: true }); }   // (gone: off the page, or not drawn, as a row of a list that went with it; a calendar day a redraw drew anew: the same day, the week's or the month's shown, never a side month's; else the row)
    rsFlush();                                                        // what a sync brought while it was pulled or springing
    return true;
  }
  const pvSettled = (e) => !!pv && (performance.now() - pv.at >= 350 || (!!e && e.detail === 0));   // the second tap of a double tap (on Preview in a menu or on the row) lands on nothing in its first 350 ms, as askFirst's buttons; a keyboard's Enter (detail 0) acts at once
  $("pvGo").addEventListener("click", (e) => { if (!pvSettled(e)) return; if (pg && pg.finish) pg.finish(); if (!pv || pg) return; const id = pv.id, t = trainings.get(id); closePreview(); if (t && !canSwipeRow(t) && !isTemplateClient(t.clientId)) showInHistory(t); else if (t) go({ name: "training", id }); });   // (a slide still landing lands first: a Mac's click or a key has no touch to land it); a finished one (its green chip in the calendar, v262): its place in History
  function showInHistory(t) {                                        // a finished (or skipped) workout's place in History, as Apple's "Show in …" (his pick, 11 Nov: "show in history or same thing apple would say"): History opens as its card opens it, the workout's group open and its row in the middle, lit a moment as a template's row is when Back to templates finds it
    const e = effDate(t) || "";
    if (e) for (const k of e >= weekStart() ? ["week"] : [e.slice(0, 4), e.slice(0, 7)]) openGroups.set(t.clientId + "/" + k, true);
    openHistoryPage();
    const row = $("histList").querySelector('[data-tid="' + String(t.id).replace(/["\\]/g, "") + '"]');
    if (row && typeof row.getClientRects === "function" && row.getClientRects().length) { row.scrollIntoView({ block: "center" }); row.classList.add("flash"); setTimeout(() => row.classList.remove("flash"), 1300); }
  }
  $("pvX").addEventListener("click", (e) => { if (pvSettled(e)) closePreview(e.detail === 0); });   // the close cross (his ask, 10 Nov: no Cancel, Apple's cross as in Calendar's event sheet); its Enter or VoiceOver (detail 0) gives the keyboard its place back
  $("pvSheet").addEventListener("click", (e) => { if (e.target === $("pvSheet") && pvSettled(e)) closePreview(); });
  document.addEventListener("keydown", (e) => {                     // Escape closes, as the other sheets take it; the left and right arrow keys go to the workout before or after, as Quick Look steps through files (heard first, so a menu or a sheet up over the preview takes its own keys: one Escape closes one thing)
    if (!pv || pvNested()) return;
    if (e.key === "Escape") { closePreview(true); return; }
    if ((e.key === "ArrowLeft" || e.key === "ArrowRight") && !e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey) { e.preventDefault(); pvGo(e.key === "ArrowLeft" ? -1 : 1); }
  }, true);
  // ---------- its header and its swipe down (his asks, 11 Nov, with Calendar's event sheet beside them: "the header … transparent just like
  // apples in the calendar … in both light and dark view", "if I swipe from top of the card down it closes the card … exactly like apple").
  // Measured on the test iPhone (iOS 27.2, Calendar's event sheet, 11 Nov). The header: 70 points from the sheet's top (the cross 16 in); at
  // rest it is the sheet itself, and once anything scrolls under it (fully by 10 points) it shows it blurred and veiled to a hard edge; the
  // event's name comes into it, 17 semibold, at once (no fade), as the big title's letters start going under that edge (at 33 to 34 points of
  // scroll there, its letters 2 to 4 points under). The pull: a finger pulls the sheet down from its header (or anywhere outside the list), and
  // from the list when that is at its top (a scrolled list scrolls back first and the sheet stays); two fingers pull it as one; it follows
  // after 10 points, and the dim lightens with the share of the sheet pulled away. The let-go: it closes when where it would coast to (the
  // pull plus 0.099 s of its speed, UIKit's fast deceleration) is past half its height, or past a quarter for a fast flick down (1,000 points
  // a second or more, in a touch of 50 ms or more); else it comes back. That rule fits all 26 releases played there with fingers at known
  // speeds and timed by the page's own touch clock (each one is a case in tests/preview-swipe.test.js; a fixed distance, a speed line or a
  // projection alone fails some): at 1,034 points a second 125, 155 and 185 pulled closed and 95 came back, 1,517 from 50 came back, flicks of
  // 44 ms from touch to lift came back however fast, 793 from 327 came back and from 373 closed; past half, flicked back up at 897 to 2,070
  // it came back, drifting up at 517 it closed. Either way a critically damped spring of 0.357 s from the finger's own speed (fitted to three
  // releases within 1.3 points).
  // The list scrolls itself (iOS's own scroll, with its own momentum and bounce), and nothing on it is ever refused: WebKit lets a list scroll
  // for the whole touch, or never, by the page's answer to the first move it hands over, and a later answer can come after iOS has begun
  // scrolling it (a quick flick from a still finger: the list would slide down inside the sheet as the sheet moved). Instead, at its top and
  // still, the list does not bounce there (overscroll-behavior-y: none, a class iOS has had 100 ms to take up), so a pull from it moves the
  // sheet alone, as Calendar's; once it scrolls it bounces at both ends again, until it is back at its top and still. A list with nothing to
  // scroll is the sheet's, as the header (WebKit would hand its pan to the page behind).
  const PV_BAR = 70, PV_SLOP = 10, PV_SPRING = 0.357, PV_DIM = 0.45, PV_PROJECT = 0.099, PV_FLICK = 1000, PV_FLICK_MS = 50, PV_TOP_MS = 100, PV_TOP_WAIT = 1000;
  function pvHeader() {                                               // the header's see-through and its title, from where the list is
    if (!pv || (pg && pg.out)) return; const bar = $("pvBar"), s = Math.max(0, $("pvScroll").scrollTop || 0);   // (while the page going out slides away the header is its: the list's own scroll event, from being put at its top at the let-go, comes a frame later; pvLand puts the header as the list is)
    bar.style.setProperty("--pv-on", String(Math.min(1, s / 10)));
    const t = $("pvTitle").getBoundingClientRect(), b = $("pvBox").getBoundingClientRect();
    bar.classList.toggle("pv-titled", s > 0 && t.top - b.top < PV_BAR - 10);   // the big title's letters going under the edge (its box 10 under, its letters 2 to 4: Calendar's moment)
  }
  let pvTopAt = 0, pvTopT = null, pvFingers = 0;
  function pvTop(on) {                                                // the list at its top and still: no bounce there (a pull from it moves the sheet alone); scrolled, it bounces at both ends
    const sc = $("pvScroll"); clearTimeout(pvTopT); pvTopT = null;
    if (sc.classList.contains("pv-top") !== on) { sc.classList.toggle("pv-top", on); pvTopAt = on ? performance.now() : 0; }
  }
  const pvAtTop = () => ($("pvScroll").scrollTop || 0) < 1;
  function pvSettle() { if (pv && !pvFingers && pvAtTop()) pvTop(true); }   // back at its top, no finger on the sheet, its scroll over (scrollend; or a second after it last moved, its bounce long done)
  const pvSettleLater = () => { if (!pv || $("pvScroll").classList.contains("pv-top")) return; clearTimeout(pvTopT); pvTopT = setTimeout(() => { pvTopT = null; pvSettle(); }, PV_TOP_WAIT); };
  function pvScrolled() {
    pvHeader();
    if (pvAtTop()) { pvSettleLater(); return; }
    pvTop(false); const d = pvDrag;                                   // the list moved: it bounces at both ends again, and a touch on it is its own scroll
    if (d && d.slide) { if (pg && !pg.settling) pvLetGo(0); pvDrop(); return; }   // never a slide and a scroll at once: the slide goes back
    if (d && d.inList) { if (d.on && d.off > 0) pvRelease(d.off, Math.min(0, pvSpeed(d, performance.now())), d.h, 0, true); pvDrop(); }   // (a sheet that touch pulled goes home by the spring, from the finger's speed: iOS took the list from where its own scroll began, a few points short of the sheet's place)
  }
  $("pvScroll").addEventListener("scroll", pvScrolled, { passive: true });
  $("pvScroll").addEventListener("scrollend", pvSettle, { passive: true });
  const pvCount = (e) => { pvFingers = ((e && e.touches) || []).length; if (!pvFingers && pvAtTop()) pvSettleLater(); };   // the fingers on the sheet (touches: every finger still down)
  for (const type of ["touchstart", "touchend", "touchcancel"]) $("pvSheet").addEventListener(type, (e) => {
    pvCount(e); const tgt = e && e.target;
    if (type !== "touchstart" || !tgt || !tgt.addEventListener || !tgt.closest || !tgt.closest("#pvScroll") || typeof AbortController !== "function") return;
    const ids = [...((e && e.changedTouches) || [])].map((t) => t.identifier), ac = new AbortController();   // a card a sync's redraw takes out of the page passes its finger's lift to nothing else: heard on it too (as pvHear hears a pull's)
    const up = (ev) => { if (![...((ev && ev.changedTouches) || [])].some((t) => ids.includes(t.identifier))) return; ac.abort(); if (!tgt.isConnected) pvCount(ev); };
    tgt.addEventListener("touchend", up, { passive: true, signal: ac.signal }); tgt.addEventListener("touchcancel", up, { passive: true, signal: ac.signal });
  }, { capture: true, passive: true });
  function pvFit() { if (!pv) return; const sc = $("pvScroll"); sc.classList.toggle("pv-fits", (sc.scrollHeight || 0) <= (sc.clientHeight || 0) + 1); }   // nothing to scroll: a touch on the list is the sheet's, as the header's (measured once the sheet is up, and again after a sync's redraw or a turn)
  if (typeof window !== "undefined" && window.addEventListener) window.addEventListener("resize", () => { if (pv) { pvFit(); pvTitleRoom(); } });
  function pvBarReset() { const bar = $("pvBar"); bar.classList.remove("pv-titled"); bar.style.setProperty("--pv-on", "0"); }   // the header at rest while the sheet is away: the next one opens at its list's top, with no name or veil left from this one
  const pvDecide = (off, v, h, ms) => { const to = off + v * PV_PROJECT; return to > h / 2 || (v >= PV_FLICK && ms >= PV_FLICK_MS && to > h / 4) ? "close" : "back"; };   // off: points pulled down; v: the finger's points a second, down; ms: from its touch to its lift; to: where it would coast to
  function pvPlace(off, h, dim) {                                     // the sheet pulled down by off, the dim lightened by the share pulled away (or set: dim)
    const box = $("pvBox"), bg = $("pvSheet"); box.style.transform = off ? "translate3d(0," + off + "px,0)" : "";
    bg.style.backgroundColor = dim != null ? "rgba(0,0,0," + dim + ")" : off ? "rgba(0,0,0," + (PV_DIM * Math.max(0, 1 - off / h)).toFixed(4) + ")" : "";
  }
  function pvReset() { clearTimeout(pvAnim); pvAnim = null; pvUnhear(pvDrag); pvDrag = null; const box = $("pvBox"), bg = $("pvSheet"); box.style.transition = bg.style.transition = ""; box.style.transform = ""; bg.style.backgroundColor = ""; }
  function pvRelease(off, v, h, ms, back) {                           // let go: closed, or back, by the measured spring from the finger's speed (back: home whatever the rule says)
    const close = !back && pvDecide(off, v, h, ms) === "close", to = close ? h + 30 : 0;
    if (calmMotion()) { if (close) closePreview(); else { pvReset(); rsFlush(); } return close; }
    const e = springEase(Math.max(-40, Math.min(15, (close ? v : -v) / (Math.abs(to - off) || 1))), PV_SPRING, 1), box = $("pvBox"), bg = $("pvSheet");   // the finger's own speed, in sheet-distances a second: away from where it goes up to 40, toward it up to 15 (so it never passes its place)
    box.style.transition = "transform " + e.ms + "ms " + e.css; bg.style.transition = "background-color " + e.ms + "ms " + e.css;
    pvPlace(to, h, close ? 0 : PV_DIM);
    pvAnim = setTimeout(() => { pvAnim = null; if (close) closePreview(); else { pvReset(); rsFlush(); } }, e.ms);   // (then a sync's redraw that waited is drawn)
    return close;
  }
  // The pull's fingers: every finger that lands on the sheet, followed through their middle, as UIKit's pan follows them; one that comes or
  // goes moves the middle, so the pull carries on from where it is, never a jump.
  const pvMine = (e, d) => [...((e && e.touches) || [])].filter((t) => d.ids.has(t.identifier));
  const pvMid = (ts) => { let x = 0, y = 0; for (const t of ts) { x += t.clientX; y += t.clientY; } return { x: x / ts.length, y: y / ts.length }; };
  const pvBank = (d, ts) => { if (!ts.length) return; const m = pvMid(ts); d.bx += m.x - d.cx; d.by += m.y - d.cy; };   // the way they have gone so far, kept
  const pvAnchor = (d, ts) => { if (!ts.length) return; const m = pvMid(ts); d.cx = m.x; d.cy = m.y; };
  const pvSample = (d, e, dy) => { d.s.push([e.timeStamp, dy]); if (d.s.length > 12) d.s.shift(); };
  const pvHolds = () => !!pvAnim || !!pg || !!(pvDrag && performance.now() - pvDrag.at < 10000);   // a finger on the sheet, or its spring: a sync's redraw waits (rowHolds), never a card rebuilt under the finger mid-pull (a touch that never came up holds nothing after 10 s)
  const pvUnhear = (d) => { if (d && d.ac) { d.ac.abort(); d.ac = null; } };
  function pvHear(d, tgt, onList) {                                  // a touch's events stay aimed at the element it began on: anything in the list a redraw takes out of the page (a card, a missed day's red word) no longer passes them on, so they are heard on it too (as the swipe back and the hold hear theirs); onList: where it began, read before anything could repaint it
    if (!tgt || !tgt.addEventListener || !(onList != null ? onList : !!(tgt.closest && tgt.closest("#pvScroll"))) || typeof AbortController !== "function") return;
    const ac = d.ac || (d.ac = new AbortController()), on = (type, fn) => tgt.addEventListener(type, (ev) => { if (!tgt.isConnected) fn(ev); }, { passive: type !== "touchmove", signal: ac.signal });
    on("touchmove", pvMove); on("touchend", pvUp); on("touchcancel", pvUp);
  }
  const pvDrop = () => { const d = pvDrag; pvDrag = null; pvUnhear(d); rsFlush(); };   // this touch is not the sheet's (then a sync's redraw that waited is drawn)
  $("pvBox").addEventListener("touchstart", (e) => {
    pvEatUntil = 0;                                                   // a new touch: its own click goes through (a slide's own click, if iOS sends one, came at its lift)
    const d = pvDrag, fresh = [...((e.changedTouches && e.changedTouches.length ? e.changedTouches : e.touches) || [])];
    if (d) { pvBank(d, pvMine(e, d)); for (const t of fresh) d.ids.add(t.identifier); pvAnchor(d, pvMine(e, d)); pvHear(d, e.target); return; }   // another finger on the sheet joins the pull (Calendar's sheet follows two, measured), from where they are now
    if (!pv || pvAnim || !fresh.length || (pg && !(pg.settling && pg.finish))) return;   // while it springs, a new finger does not catch it; nor a slide still under the fingers (two on a trackpad)
    const tgt = e.target, onList = !!(tgt && tgt.closest && tgt.closest("#pvScroll"));   // where it landed, read before a slide still landing lands
    const nd = pvDrag = { ids: new Set(fresh.map((t) => t.identifier)), t0: e.timeStamp, at: performance.now(), inList: false, top: true, on: false, off: 0, bx: 0, by: 0, cx: 0, cy: 0, h: 1, s: [[e.timeStamp, 0]], ac: null };   // s: the fingers' way down [moment, points], for their speed as they let go
    pvHear(nd, tgt, onList);                                          // held from here: a sync's redraw a landing lets through waits for this finger
    if (pg) pg.finish();                                              // a slide still landing lands at once under a new finger, as the month view's (the list already holds the workout it went to: nothing is repainted under the finger)
    if (!pv || pvDrag !== nd) return;                                 // (it landed on a workout a sync took away: the preview closed)
    const sc = $("pvScroll"), inList = onList && !sc.classList.contains("pv-fits");   // (a list with nothing to scroll is the sheet's, as the header)
    nd.inList = inList; nd.top = !inList || (sc.classList.contains("pv-top") && pvAtTop() && performance.now() - pvTopAt >= PV_TOP_MS); nd.h = $("pvBox").offsetHeight || 1;   // the list at its top, still, and iOS has taken up that it does not bounce there
    pvAnchor(nd, pvMine(e, nd));
  }, { passive: true });
  function pvMove(e) {
    const d = pvDrag; if (!d || !pv) return; const ts = pvMine(e, d); if (!ts.length) return;
    const m = pvMid(ts), dx = d.bx + m.x - d.cx, dy = d.by + m.y - d.cy;
    if (d.slide) { if (e.cancelable) e.preventDefault(); pvFollow(dx - d.slide); return; }   // the workouts slide under the fingers; nothing else moves (every move refused: the list never scrolls in a slide)
    if (!d.on) {
      const ax = Math.abs(dx), ay = Math.abs(dy);
      if (ax >= PV_SIDE && ax >= PV_CONE * ay && e.cancelable && !pg) { e.preventDefault(); d.slide = dx > 0 ? PV_SIDE : -PV_SIDE; pvSlideStart(); return; }   // sideways, within 30 degrees of level: a slide to the workout before or after (refused at once, so iOS starts no scroll of the list; it follows from the next move, never a jump)
      if (!d.top) { if (ay >= PV_SLOP) pvDrop(); return; }            // a scrolled list: up or down is its own scroll, and the sheet stays for that touch (measured)
      if ((d.inList && dy <= -PV_SLOP) || (ax > PV_SLOP && ax > ay)) { pvDrop(); return; }   // up, the list scrolls; between 30 and 45 degrees nobody's
      if (dy >= PV_SLOP) { d.on = true; if (popClose && popAnchor === $("pvMore")) popClose(); }   // (its "…" menu goes as the sheet starts to move, as a slide takes it)
    }
    if (d.on && !d.inList && e.cancelable) e.preventDefault();       // the header's pull is ours (nothing is refused until the pull itself, so a tap on the cross that rolls a point stays a tap); on the list nothing ever is, and iOS scrolls it as its own
    pvSample(d, e, dy);
    if (!d.on) return;
    d.off = Math.max(0, dy - PV_SLOP); pvPlace(d.off, d.h);
  }
  $("pvBox").addEventListener("touchmove", pvMove, { passive: false });
  function pvSpeed(d, now) {                                          // the fingers' speed as they let go, points a second: from where they were 40 ms before the last move, never back across a rest of more than 40 ms (a still finger sends no moves); none if they rested more than 60 ms before lifting (as the rows' swipe)
    const s = d.s, b = s[s.length - 1]; let a = s.length > 1 ? s[s.length - 2] : b;
    for (let i = s.length - 3; i >= 0 && b[0] - a[0] < 40; i--) { if (s[i + 1][0] - s[i][0] > 40) break; a = s[i]; }
    return b[0] > a[0] && now - b[0] <= 60 ? ((b[1] - a[1]) / (b[0] - a[0])) * 1000 : 0;
  }
  function pvUp(e) {
    const d = pvDrag; if (!d) return;
    const gone = [...((e && e.changedTouches) || [])].filter((t) => d.ids.has(t.identifier)); if (!gone.length) return;   // another finger, not the pull's
    const left = pvMine(e, d).filter((t) => !gone.some((g) => g.identifier === t.identifier));
    if (left.length) { pvBank(d, [...left, ...gone]); for (const g of gone) d.ids.delete(g.identifier); pvAnchor(d, left); return; }   // one of its fingers lifted and another is still on: the pull goes on with it, from where it is
    pvDrag = null; pvUnhear(d);
    if (d.slide) { pvEatUntil = performance.now() + 400; if (pg && !pg.settling) pvLetGo(e && e.type === "touchcancel" ? 0 : monthLetGo("cal", pg.x, pvW())); return; }   // let go: past 48 points on to that workout, else back (the month view's rule); a cancelled touch, back
    if (!d.on || !pv) { rsFlush(); return; }
    pvRelease(d.off, pvSpeed(d, e.timeStamp), d.h, e.timeStamp - d.t0);
  }
  $("pvBox").addEventListener("touchend", pvUp); $("pvBox").addEventListener("touchcancel", pvUp);
  // ---------- its arrows, its slide and its "…" (his asks, 11 Nov: "arrow buttons in shared pills like Apple does it to go to the next workout
  // and previous", "you will also be able to slide finger to the next workout and it will have the same sliding effect like calendar in month
  // view", "the arrows will be on top right corner and then to them there will be our typical … button … when client clicks on it they will
  // see reschedule and skip … coach will see one more option and that is delete workout", "another tab in … button for coach will be copy
  // workout"; his picks the same day: the "…" left of the arrows; every preview walks the missed workouts too, each clearly marked missed;
  // after Skip or Delete the next workout; after Reschedule the same workout on its new day; Do it today first on a missed one). The walk:
  // every workout of the client still to do, by its day and then as made (the missed ones, today's, the scheduled ones); finished and skipped
  // ones (History) are not in it. The slide is the client page's month view's: the page follows the finger, past 48 points it goes on (else
  // back), a 280 ms settle on the month's curve, at once with Reduce Motion; past the first or the last workout a third of the way, and back.
  // Only the workout moves: the header and Start workout stay, as Apple keeps a pager's bars and the month view its title.
  const PV_SIDE = 8, PV_CONE = 1.732;                                // a slide: 8 points sideways within 30 degrees of level (iOS 27 lets a list scroll only past that: no touch is both)
  const pvOrder = (a, b) => effDate(a).localeCompare(effDate(b)) || byMade(a, b) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  const pvWalk = (cid) => clientTrainings(cid).filter((t) => canSwipeRow(t) || !!effDate(t)).sort(pvOrder);   // every workout of the client by its day, then as made: History's too (his ask, 11 Nov: "let the slider go even to the history"), the missed, today's, the ones to come
  function pvNear(id) {                                              // the workouts either side of this one in the walk (it may have left it, finished or skipped meanwhile: where it would sort)
    const t = trainings.get(id); if (!t) return { prev: null, next: null };
    const w = pvWalk(t.clientId).filter((x) => x.id !== id), i = w.findIndex((x) => pvOrder(x, t) > 0), k = i < 0 ? w.length : i;
    return { prev: k > 0 ? w[k - 1].id : null, next: k < w.length ? w[k].id : null };
  }
  const pvNested = () => { const wb = $("whenBg"); return !!(wb && !wb.hidden) || [...document.querySelectorAll(".sheet-bg:not([hidden])")].some((el) => el.id !== "pvSheet"); };   // a menu, or a sheet, up over the preview
  function pvArrows() {                                              // an arrow with nowhere to go is dimmed (a keyboard on it moves to the other, else to the sheet); the "…" with nothing to offer is not there (History's workouts, his rule 11 Nov), the name in the header given its room
    if (!pv) return; const n = pvNear(pv.id), p = $("pvPrev"), x = $("pvNext"), m = $("pvMore"), was = !!m.hidden; let f = document.activeElement;
    p.disabled = !n.prev; x.disabled = !n.next; m.hidden = !pvItems(trainings.get(pv.id)).length;
    if (m.hidden && popClose && popAnchor === m) { const wp = $("whenPop"), inMenu = !!f && typeof wp.contains === "function" && wp.contains(f); popClose(); if (inMenu) f = m; }   // its menu open as it goes (a sync made the workout History): the menu goes with it, and a keyboard in it lands where one on the "…" does (a review's catch: it fell to the page)
    if ((f === p && p.disabled) || (f === x && x.disabled) || (f === m && m.hidden)) { const to = pvFocusTo(); if (to && typeof to.focus === "function") to.focus({ preventScroll: true }); }
    if (!!m.hidden !== was) pvTitleRoom();
  }
  const pvFocusTo = () => { const p = $("pvPrev"), x = $("pvNext"); return !p.disabled ? p : !x.disabled ? x : $("pvBox"); };   // where a keyboard goes when its control in the preview's bar goes: an arrow that can go, else the sheet
  function pvTitleRoom() {                                           // the name in the header: centred on the bar where it fits between the cross and the buttons on the right, as UIKit centres a title; else in the room between them, cut short
    const bar = $("pvBar"), el = $("pvBarTitle"), tools = bar && bar.querySelector(".pv-tools"), W = bar ? pvNum(bar.clientWidth) : 0;
    if (!pv || !W || !tools || typeof document.createRange !== "function") return;
    const L = 16 + 44 + 8, R = W - 16 - pvNum(tools.offsetWidth) - 8, half = Math.min(W / 2 - L, R - W / 2), rg = document.createRange(); rg.selectNodeContents(el);
    const w = Math.ceil(pvNum(rg.getBoundingClientRect().width));
    if (w / 2 <= half) { el.style.left = el.style.right = Math.round(W / 2 - half) + "px"; } else { el.style.left = L + "px"; el.style.right = Math.round(W - R) + "px"; }
  }
  const pvLine = (t) => { const day = fmtDayLong(effDate(t) || ""), w = { done: ", finished", skip: ", skipped", miss: ", missed" }[pvState(t)] || ""; return pvName(t) + w + (day ? ", " + day : ""); };   // what VoiceOver hears of a workout
  const pvSay = () => { const t = pv && trainings.get(pv.id); if (t) $("pvSay").textContent = pvLine(t); };   // VoiceOver hears the workout it went to
  let pg = null, pvEatUntil = 0;                                     // a slide under way: { dir: the side it shows (-1 the workout before, 1 the next), to: that workout, x: where it is, peek: that workout's page, out: a copy of the page going out (once let go on), top/foot: the list's place in the sheet as the slide began, settling, finish }
  const PV_CURVE = "280ms cubic-bezier(0.22, 1, 0.36, 1)";           // the month view's own settle
  const pvNum = (v) => +v || 0;                                       // a size read off the page (0 where there is none)
  const pvW = () => pvNum($("pvBox").clientWidth) || 1;
  function pvPage(t) {                                               // a workout's page as the list shows it, for sliding (out of reach of taps and VoiceOver), placed where the list is
    const p = document.createElement("div"); p.className = "pv-scroll pv-peek"; p.setAttribute("aria-hidden", "true"); p.inert = true;
    const h = document.createElement("h3"), d = document.createElement("p"), c = document.createElement("div"); d.className = "pv-day"; c.className = "pv-cards"; p.append(h, d, c); pvFill(t, h, d, c);
    p.style.top = pg.top + "px"; p.style.bottom = pg.foot + "px"; return p;
  }
  function pvPeek(dir) {                                             // the workout on that side, painted beside the list, from its top (built when a slide shows it, gone when it lands)
    if (!pg || !pv) return null; const n = pvNear(pv.id), to = dir < 0 ? n.prev : n.next;
    if (pg.dir === dir && pg.to === to && (pg.peek || !to)) return pg.peek;
    if (pg.peek) { pg.peek.remove(); pg.peek = null; }
    pg.dir = dir; pg.to = to; const t = to && trainings.get(to); if (!t) return null;
    const sc = $("pvScroll"), box = $("pvBox");
    if (pg.top == null) {                                            // the list's place in the sheet as the slide began, measured once, in fractions of a point as laid out (the sheet keeps its one height: his ask, 11 Nov, "make sure the card is always the same height")
      const br = box.getBoundingClientRect(), sr = sc.getBoundingClientRect(), bs = getComputedStyle(box) || {};
      pg.top = pvNum(sr.top - br.top - (parseFloat(bs.borderTopWidth) || 0)); pg.foot = Math.max(0, pvNum(br.bottom - (parseFloat(bs.borderBottomWidth) || 0) - sr.bottom));   // the list's place in the sheet, from its padding edge (where a page placed beside it goes)
    }
    const p = pvPage(t); p.style.transform = "translate3d(" + (dir < 0 ? -pvW() : pvW()) + "px,0,0)";
    sc.after(p); pg.peek = p; void p.offsetWidth;                    // placed at its side before anything moves it
    return p;
  }
  function pvSlideTo(x, settle) {                                    // the page going out x points from its place (+: to the right, the one before coming in from the left), the one coming in beside it, the header's veil with the page it is over (settle: there on the slide's own curve); the sheet keeps its height
    const W = pvW(), out = (pg && pg.out) || $("pvScroll"), bar = $("pvBar"); out.style.transform = x ? "translate3d(" + x + "px,0,0)" : "";   // (the width read before anything moves: a read between the two pages' moves starts the page going out, and the veil, a frame before the one coming in, and the list shows between them: measured in WebKit)
    bar.style.setProperty("--pv-veil-x", x + "px"); bar.style.setProperty("--pv-veil-tr", settle ? "transform " + settle : "none");
    if (pg && pg.peek) {
      pg.peek.style.transform = "translate3d(" + (x + (pg.dir < 0 ? -W : W)) + "px,0,0)";
    }
  }
  function pvFollow(raw) {                                           // the fingers raw points from where they took the slide: the workout that way comes in; with none that way, a third of the way (the day picker's months at their ends)
    if (!pg || pg.settling) return; const dir = raw < 0 ? 1 : raw > 0 ? -1 : pg.dir;
    if (dir) pvPeek(dir);
    pg.x = raw && !pg.to ? raw / 3 : raw; pvSlideTo(pg.x);
  }
  function pvLetGo(go) {                                             // let go, or an arrow: on to the workout that way (go -1 / 1), or back (0), on the month view's 280 ms curve; at once with Reduce Motion
    if (!pg || pg.settling) return; const g = pg, to = go && go === g.dir && g.to && trainings.has(g.to) ? g.to : null, sc = $("pvScroll"), bar = $("pvBar"), calm = calmMotion() || !!(to && pv && !trainings.has(pv.id));   // (the workout going out gone, a sync's while the fingers held it: nothing left to slide away, it lands at once, as with Reduce Motion)
    g.settling = true; let done = false, timer = null;
    if (to && pv) {                                                  // on: from this moment it is the preview's workout (a click, a key or a finger acts on it), as the month view takes its month at the let-go. The list takes it at once and stays still; a copy of the page going out (as the finger left it, scrolled or not) slides away over it, so nothing is repainted under a finger that lands meanwhile
      const from = trainings.get(pv.id), was = pvNum(sc.scrollTop);
      if (from && !calm) { const o = pvPage(from); o.style.transform = sc.style.transform; if (pvNum(sc.offsetWidth) > pvNum(sc.clientWidth) && pvNum(sc.scrollHeight) > pvNum(sc.clientHeight) + 1) o.style.overflowY = "scroll"; sc.after(o); o.scrollTop = was; g.out = o; void o.offsetWidth; }
      sc.style.transition = ""; sc.style.transform = ""; pv.id = to; paintPreview(trainings.get(to)); sc.scrollTop = 0; pvTop(true); pvSay();
      bar.classList.remove("pv-titled"); bar.style.setProperty("--pv-on", String(Math.min(1, Math.max(0, was) / 10)));   // the header: the incoming workout's name at once, as the month's title; its veil leaves with the page under it
    }
    const mv = g.out || sc;
    const finish = () => { if (done) return; done = true; clearTimeout(timer); mv.removeEventListener("transitionend", onEnd); pvLand(g, to); };
    const onEnd = (e) => { if (!e || e.target === mv) finish(); };
    g.finish = finish;
    if (calm) { finish(); return; }
    const tr = "transform " + PV_CURVE; mv.style.transition = tr; if (g.peek) g.peek.style.transition = tr;
    mv.addEventListener("transitionend", onEnd); timer = setTimeout(finish, 360);
    pvSlideTo(to ? -g.dir * pvW() : 0, PV_CURVE);
  }
  function pvLand(g, to) {                                           // the slide over: the pages that slid gone, the header as its list is
    if (pg !== g) return; pg = null;                                  // (a slide reset meanwhile, by a close or a reopen: its leftover end changes nothing)
    const sc = $("pvScroll"), bar = $("pvBar");
    if (to && sc.scrollTop) sc.scrollTop = 0;                         // (a Mac trackpad's coasting, begun before the let-go, carried on scrolling the list under the copies: it lands at its top, as the page that slid in showed it)
    sc.style.transition = ""; sc.style.transform = ""; if (g.peek) g.peek.remove(); if (g.out) g.out.remove();
    bar.style.removeProperty("--pv-veil-x"); bar.style.removeProperty("--pv-veil-tr");
    if (to && pv && !trainings.has(to)) closePreview();               // (a sync took it away meanwhile)
    else if (pv) { pvFit(); pvHeader(); }
    rsFlush();                                                        // a sync's redraw that waited for it
  }
  function pvSlideReset() { const g = pg; pg = null; if (g && g.peek) g.peek.remove(); if (g && g.out) g.out.remove(); const sc = $("pvScroll"), bar = $("pvBar"); sc.style.transition = ""; sc.style.transform = ""; bar.style.removeProperty("--pv-veil-x"); bar.style.removeProperty("--pv-veil-tr"); }
  const pvSlideStart = () => { pg = { dir: 0, to: null, x: 0, peek: null, settling: false, finish: null }; if (popClose && popAnchor === $("pvMore")) popClose(); return pg; };
  function pvGo(dir) {                                               // an arrow, a key, or after Skip or Delete: the same slide on its own; a slide still landing lands at once first (two quick taps: two workouts, as the month's arrows)
    if (!pv || pvDrag || pvAnim) return false;
    if (pg && pg.finish) pg.finish(); if (pg || !pv) return false;
    const n = pvNear(pv.id); if (!(dir < 0 ? n.prev : n.next)) return false;
    pvSlideStart(); pvPeek(dir); pvLetGo(dir); return true;
  }
  $("pvPrev").addEventListener("click", (e) => { if (pvSettled(e)) pvGo(-1); });
  $("pvNext").addEventListener("click", (e) => { if (pvSettled(e)) pvGo(1); });
  $("pvBox").addEventListener("click", (e) => { if (performance.now() < pvEatUntil) { e.stopPropagation(); e.preventDefault(); } }, true);   // a slide that began on a button presses nothing
  let pvWx = null;                                                   // two fingers' travel on a Mac's trackpad, while they hold the workouts
  const pvWheel = {                                                  // two fingers sideways: the workouts follow them, one at most, and settle by the finger's rule (the month view's own way)
    begin() { if (!pv || pvDrag || pvAnim || pvNested()) return false; if (pg && pg.finish) pg.finish(); if (pg || !pv) return false; pvWx = 0; pvSlideStart(); return true; },
    move(d) { if (pvWx === null || !pg || pg.settling) return true; const W = pvW(); pvWx = Math.max(-W, Math.min(W, pvWx + d)); pvFollow(pvWx); return Math.abs(pvWx) >= W; },
    end() { if (pvWx === null) return; pvWx = null; if (pg && !pg.settling) pvLetGo(monthLetGo("cal", pg.x, pvW())); },
  };
  function pvItems(t) {                                              // the "…": Do it today on a missed one (first, as its row's), Reschedule and Skip on any still to do; the coach's own view adds Copy workout, Save as template and, last and red, Delete workout. History's workouts (finished, skipped, missed after a week) have none: no "…" at all (his rule, 11 Nov), their page has the rest; except the coach's own view of a finished one: Copy workout and Save as template (his ask, 12 Nov: "in finished workouts preview for coaches view ... bring the 3 dot button and give me option to save as template and copy workout")
    if (!t || isTemplateClient(t.clientId)) return [];
    const id = t.id, todo = canSwipeRow(t), mine = coachMore(t), items = [];
    if (!todo && !(mine && t.completedAt)) return [];
    if (pvMissed(t)) items.push({ label: "Do it today", icon: miToday(), onPick: () => doToday(id) });
    if (todo) items.push({ label: "Reschedule", icon: MI.calendar, onPick: () => rowReschedule(id) }, { label: "Skip", icon: MI.skip, onPick: () => pvSkip(id) });
    if (mine) {
      items.push({ label: "Copy workout", icon: MI.copy, onPick: () => pvCopy(id) }, { label: "Save as template", icon: MI.save, onPick: () => pvSave(id) });   // as the workout page's "…" (his pick, 12 Nov: on a workout still to do too)
      if (todo) items.push({ label: "Delete workout", icon: MI.trash, danger: true, onPick: () => pvDelete(id) });
    }
    return items;
  }
  $("pvMore").addEventListener("click", (e) => { if (!pv || !pvSettled(e) || pvAnim) return; if (pg && pg.finish) pg.finish(); if (!pv || pg) return; const items = pvItems(trainings.get(pv.id)); if (items.length) showMenu($("pvMore"), items, { align: "right", focus: e.detail === 0 }); });   // (a slide still landing lands first; one still under the fingers opens nothing)
  function pvOn(id) {                                                // after Skip or Delete (his pick, 11 Nov): the next workout, else the one before, as Mail goes on to the next message; the last one closes the preview
    if (!pv || pv.id !== id) return; const n = pvNear(id);
    if (!(n.next && pvGo(1)) && !(n.prev && pvGo(-1))) closePreview();
    if (pv && !$("pvBox").contains(document.activeElement)) $("pvBox").focus({ preventScroll: true });   // focus not in the sheet (a pointer's: the body; a keyboard's: the closed question's button) comes back into it
  }
  function pvSkip(id) { if (canSwipeRow(trainings.get(id))) openSkip(id, () => pvOn(id)); }   // Skip's own question (its reasons), then on to the next
  async function pvDelete(id) {                                      // the coach's Delete workout: asked first (the workout page's question), then on to the next
    if (!coachMore(trainings.get(id))) return;
    if (!(await askFirst({ title: "Delete this workout?", text: "It goes for good, with everything logged on it.", yes: "Delete" }))) return;
    if (!pv || pv.id !== id || !trainings.has(id)) return;
    pvOn(id); trainings.delete(id); scheduleSave("trainings", id, 0); S.renderedTraining = null; render();   // (the page behind redraws now; the preview paints where its slide lands)
  }
  async function pvCopy(id) {                                        // the coach's Copy workout: which client gets it (this one first), then the day, then the copy opens, as the workout page's Copy workout does
    const t = trainings.get(id); if (!coachMore(t)) return;
    const to = await copyTarget(t);
    if ($("pickSheet").contains(document.activeElement) && !$("pvMore").hidden) $("pvMore").focus({ preventScroll: true });   // a keyboard's or VoiceOver's place, left on the sheet that has gone: back on the "…" (and the days give it back there)
    if (!to || !clients.has(to) || !trainings.has(id)) return;
    copyDay(id, to, () => !!pv && pv.id === id, closePreview);        // then the day, over the preview; the preview closes once it is picked
  }
  function pvSave(id) {                                              // the coach's Save as template: the preview closes and the new template opens, as the workout page's Save as template does
    const t = trainings.get(id); if (!coachMore(t) || !pv || pv.id !== id) return;
    closePreview(); saveAsTemplate(t);
  }
  function doToday(id) {                                             // a missed workout comes to today (its "…" and its touch and hold): the client's by the server's own rule (client_move_training), the coach's an ordinary save. Not marked as decided: missed again, it files itself after a week like any other (his rule, 10 Nov)
    const t = trainings.get(id); if (!canSwipeRow(t) || !effDate(t) || effDate(t) >= today()) return false;   // asked again at the pick: a sync may have finished, skipped or moved it meanwhile
    t.date = today(); t.skippedAt = null; delete t.missed; touchState(id, "date", "skippedAt", "missed"); if (S.clientMode) pendingMove.add(id);   // (the coach's save then carries all three over a filing another device sent meanwhile)
    scheduleSave("trainings", id); S.renderedTraining = null; render(); return true;
  }
  async function skipAllMissed() {                                    // the Missed card's Skip all (his ask, 10 Nov): asked first, then every workout still missed goes to History as skipped, as each one's own Skip files it (without a reason)
    const cid = S.view.name === "client" && !settingsOpen ? S.view.id : null, ids = cid ? missedOf(cid).map((t) => t.id) : [];
    if (ids.length < 2) return false;
    if (!(await askFirst({ title: "Skip " + ids.length + " missed workouts?", text: "They move to History as skipped.", yes: "Skip all" }))) return false;
    if (!(S.view.name === "client" && S.view.id === cid && !settingsOpen)) return false;   // still her page: Back or a settings page while the question was up takes nothing
    let n = 0;
    for (const id of ids) {
      const t = trainings.get(id); if (!canSwipeRow(t) || !effDate(t) || effDate(t) >= today()) continue;   // still missed: a sync may have finished or moved one meanwhile
      t.skippedAt = now(); t.missed = false; delete t.skipReason; touchState(id, "skippedAt", "missed", "skipReason");   // a person decided, as setSkipped records it
      if (S.clientMode) { pendingSkip.add(id); pendingMiss.add(id); }
      scheduleSave("trainings", id); n++;
    }
    if (n) { S.renderedTraining = null; render(); }
    return n > 0;
  }
  function applyReschedule(id, date) {
    const t = trainings.get(id); if (!canReschedule(t) || !/^\d{4}-\d{2}-\d{2}$/.test(date) || date === t.date || date < today()) return false;   // asked again at the pick: a sync may have brought in a finish or a skip while the days were open, or midnight made the day picked yesterday
    t.date = date; touchState(id, "date"); if (S.clientMode) pendingMove.add(id);
    scheduleSave("trainings", id); S.renderedTraining = null; render(); return true;
  }
  function moreItems(t) {                                             // the workout page's "…": the client's Reschedule (from today on); the coach's Reschedule (any day, as his row's and his date, while it is still to do) and, last and red, Delete, as Apple ends a menu with its destructive row
    if (!moreOn(t)) return [];
    const id = t.id, cid = t.clientId, page = () => S.view.name === "training" && S.view.id === id;
    if (canReschedule(t)) {
      const still = () => page() && canReschedule(trainings.get(id));   // the page is still this workout, still to do
      return [{ label: "Reschedule", icon: MI.calendar, onPick: () => { const cur = trainings.get(id); if (cur && still()) openDatePicker({ clientId: cid, moving: id, title: "Reschedule", selected: cur.date || today(), min: today, ok: still, onPick: (date) => applyReschedule(id, date) }); } }];   // min: today itself, asked at each redraw (days left open past midnight grey yesterday)
    }
    const items = [];
    if (canSwipeRow(t)) { const still = () => page() && coachMore(trainings.get(id)) && canSwipeRow(trainings.get(id)); items.push({ label: "Reschedule", icon: MI.calendar, onPick: () => { const cur = trainings.get(id); if (cur && still()) openDatePicker({ clientId: cid, moving: id, title: "Reschedule", selected: cur.date || today(), min: null, ok: still, onPick: (date) => moveWorkout(id, date) }); } }); }
    if (!isTemplateClient(cid)) items.push({ label: "Copy workout", icon: MI.copy, onPick: () => copyWorkout(id) }, { label: "Save as template", icon: MI.save, onPick: () => { const cur = trainings.get(id); if (cur && page() && coachMore(cur)) saveAsTemplate(cur); } });   // moved here from the page's foot, the coach's own view only (his ask, 12 Nov: "copy workout and save as template will go to '...' button only for coaches view")
    if (isTemplateClient(cid) && !draftOpen(id)) items.push({ label: "Move to", icon: MI.folder, onPick: () => { if (page()) moveTemplate(id); } });   // a template's place, as its row's swipe moves it (Apple never keeps an action in a gesture only); not while it has unsaved changes, which Discard would take the move back with (the v283 review)
    items.push({ label: isTemplateClient(cid) ? "Delete template" : "Delete workout", icon: MI.trash, danger: true, onPick: () => askDelete(id) });
    return items;
  }
  async function askDelete(id) {                                       // Delete workout (the "…" and the page's foot): asked first, then gone for good; a template's workouts already made from it stay
    const t = trainings.get(id); if (!t) return false; const tpl = isTemplateClient(t.clientId);
    if (!(await askFirst({ title: tpl ? "Delete this template?" : "Delete this workout?", text: tpl ? "Workouts already made from it stay." : "It goes for good, with everything logged on it.", yes: "Delete" }))) return false;
    if (!(S.view.name === "training" && S.view.id === id && trainings.has(id))) return false;   // still this page (a sync took nothing away while the question was up)
    deleteTraining(id); return true;
  }
  $("skipAll").addEventListener("click", () => { skipAllMissed(); });
  $("tMore").addEventListener("click", (e) => {
    e.stopPropagation(); const items = pageMoreItems(); if (!items.length) return;
    showMenu($("tMore"), items, { align: "right", focus: e.detail === 0 });   // a keyboard's Enter or VoiceOver's activation (detail 0) goes into the menu
  });
  $("tAdd").addEventListener("click", (e) => {                         // the Templates pages' "+": New template, New folder, New slide (his ask, 12 Nov)
    e.stopPropagation(); const items = tplAddItems(); if (!items.length) return;
    showMenu($("tAdd"), items, { align: "right", focus: e.detail === 0 });
  });
  $("tDate").addEventListener("click", () => {
    const t = trainings.get(S.view.id); if (!t || S.clientMode || isTemplateClient(t.clientId)) return;
    const id = t.id;
    openDatePicker({ clientId: t.clientId, moving: id, title: "Move to", selected: t.date || today(), onPick: (date) => { const cur = trainings.get(id); if (!cur) return; touchState(id, "date"); cur.date = date; scheduleSave("trainings", id); S.renderedTraining = null; render(); } });
  });
  let addEatUntil = 0;                                                 // a double click on + Add exercise under the exercises: the new card takes the button's place, so its second click would land on the card; eaten (a review's catch, 12 Nov)
  document.addEventListener("click", (e) => { if (e.detail > 1 && performance.now() < addEatUntil) { e.preventDefault(); e.stopImmediatePropagation(); } }, true);
  function addExercise(e) {                                            // the round + in the bar at the foot (his pick, 10 Nov; as Reminders' +): a new exercise at the end, the page glides to it once and the keyboard is on its name
    if (e && e.detail > 1) return;                                     // a double click is one exercise (on a computer the + stays under the pointer while he types)
    addEatUntil = performance.now() + 500;
    const t = S.view.name === "training" && !S.clientMode ? trainings.get(S.view.id) : null; if (!t) return;
    const r = newRow(nextLabel(t)); t.rows.push(r); scheduleSave("trainings", t.id);
    S.renderedTraining = null; render();
    followRow(r.id, "name", false, !deskOn);                         // a phone: the page under the header at once, then the focus (in the tap, so the phone gives the keyboard; the glide only keeps it there while the keyboard comes); a computer has no keyboard to come: the page glides there, as every other follow
  }
  $("addExBtn").addEventListener("click", addExercise);
  $("addRow").addEventListener("click", addExercise);                // the white + Add exercise under the last exercise does the same (his ask, 12 Nov)
  function setSkipped(skipped, reason, id = S.view.id) {              // asked first (the sheet); the workout stays on screen, marked Skipped, with Undo (from a row on Workouts: it goes to History, Undo on its page)
    const t = trainings.get(id); if (!t) return;
    t.skippedAt = skipped ? now() : null; t.missed = false; touchState(t.id, "skippedAt", "missed", "skipReason");   // a person decided: never filed by itself again
    if (skipped && reason) t.skipReason = reason; else delete t.skipReason;
    if (S.clientMode) { pendingSkip.add(t.id); pendingMiss.add(t.id); }
    scheduleSave("trainings", t.id); if (S.view.name === "training" && S.view.id === t.id) paintFinish(t); S.renderedTraining = null; render();
  }
  let sk = null;                                                       // the skip sheet: { t, reason }
  function openSkip(id, after) {                                       // the workout page's, or a row's on Workouts (id), or the preview's (after: what follows the skip there)
    const t = trainings.get(id || S.view.id); if (!t) return; sk = { t, reason: "", at: performance.now(), after: after || null }; S.asking = true; if (pv) $("pvSheet").inert = true;   // (over the preview, the preview waits)
    for (const b of $("skReasons").querySelectorAll("button")) { b.classList.remove("on"); b.setAttribute("aria-pressed", "false"); }
    $("skFor").hidden = !(S.clientMode || previewing());               // the client's Undo lasts 24 hours (the coach's, always), and the question says so
    $("skipSheet").hidden = false; setTimeout(() => { if (sk) $("skGo").focus({ preventScroll: true }); }, 0);
  }
  function closeSkip() { $("skipSheet").hidden = true; sk = null; S.asking = !!pv; if (pv) $("pvSheet").inert = false; }   // (over the preview: back to it, still a question up)
  const skSettled = (e) => !!sk && (performance.now() - sk.at >= 350 || (!!e && e.detail === 0));   // the second tap of a double tap (on Skip, on a row low on the screen) must not land on Skip workout, as askFirst's red button, nor pick a reason or close the question (a keyboard's Enter or VoiceOver, detail 0, acts at once on those)
  $("skGo").addEventListener("click", () => { if (!skSettled()) return; const reason = sk.reason, id = sk.t.id, after = sk.after; closeSkip(); if (after) after(); setSkipped(true, reason, id); });   // (the preview's: on to the next workout first, then the skip, as its Delete does)
  $("skKeep").addEventListener("click", (e) => { if (skSettled(e)) closeSkip(); });
  $("skipSheet").addEventListener("click", (e) => { if (e.target === $("skipSheet") && skSettled()) closeSkip(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && sk) closeSkip(); });   // Escape is Cancel, as the other sheets take it
  $("skReasons").addEventListener("click", (e) => {
    const b = e.target.closest("button"); if (!b || !sk || !skSettled(e)) return;
    const on = !b.classList.contains("on");                          // tap again to clear
    for (const x of $("skReasons").querySelectorAll("button")) { x.classList.toggle("on", on && x === b); x.setAttribute("aria-pressed", String(on && x === b)); }
    sk.reason = on ? b.dataset.reason : "";
  });
  $("skipBtn").addEventListener("click", () => openSkip());
  $("unskipBtn").addEventListener("click", undoTap(() => setSkipped(false)));
  async function finishTap() {                                         // Finish workout; with an exercise still open it is Finish early, which asks first in either view (his ask, 12 Nov: "finish early will ask for are you sure"), worded as the exercise's own question (his pick)
    const t = trainings.get(S.view.id); if (!t || t.completedAt || t.skippedAt) return;
    const cards = groupsOf(t.rows), total = cards.length, did = cards.filter((g) => g.rows.every((r) => r.done)).length, left = total - did;   // counted as the page shows them: a superset is one card, its "Exercise 2 · Superset" (a review's catch)
    if (left > 0) {
      const id = t.id, text = (did > 0 ? did + " of " + total + " exercises completed." : "No exercises completed yet.") + " The remaining " + (left === 1 ? "one" : left) + " will stay incomplete.";
      if (!(await askFirst({ title: "Finish this workout early?", text, yes: "Finish early", red: false }))) return;
      const cur = trainings.get(id); if (!(S.view.name === "training" && S.view.id === id) || !cur || cur.completedAt || cur.skippedAt) return;   // still this page, still open: the answer finishes nothing else (setFinished takes the page's workout) and nothing finished or skipped meanwhile
    }
    setFinished(true);
  }
  $("finishBtn").addEventListener("click", finishTap);
  $("unfinishBtn").addEventListener("click", undoTap(() => setFinished(false)));
  function copyDay(id, to, still, before) {                          // Copy workout's second step (his ask, 12 Nov: "I first pic a client and now I also want to pick a day"): the day in that client's calendar, then the copy (the workout as it is now, a sync's newer copy included) on it, opened as new
    const who = clients.get(to), ok = () => clients.has(to) && trainings.has(id) && still();   // asked at each redraw: the workout, the client and the page it came from still there
    openDatePicker({ clientId: to, title: "Copy to " + ((who && who.name) || "client"), ok, onPick: (date) => { if (!ok()) return; before(); addTraining(to, trainings.get(id), date); } });
  }
  function copyTarget(t) {                                            // "Copy workout" asks which client gets the copy; this client is the first row
    const me = clients.get(t.clientId), others = peopleList().filter((c) => c.id !== t.clientId);
    const items = [me, ...others].filter(Boolean).map((c) => ({ id: c.id, label: c.name || "Unnamed", sub: c.id === t.clientId ? "this client" : (c.paused ? "Paused" : "") }));
    return pickOne({ title: "Copy workout to", items });
  }
  async function copyWorkout(id) {                                    // Copy workout, from the page's "…" (his ask, 12 Nov; it was a button at the page's foot): which client gets it (this one first), then the day, then the copy opens
    const t = trainings.get(id); if (!coachMore(t)) return;
    const to = await copyTarget(t);
    if ($("pickSheet").contains(document.activeElement) && !$("tMore").hidden) $("tMore").focus({ preventScroll: true });   // a keyboard's or VoiceOver's place, left on the sheet that has gone: back on the "…" (and the days give it back there)
    if (!to || !clients.has(to) || !trainings.has(id) || !(S.view.name === "training" && S.view.id === id)) return;   // still this workout's page: a sync that took it away, or Back, copies nothing
    copyDay(id, to, () => S.view.name === "training" && S.view.id === id, () => {});   // then the day; the copy opens once it is picked
  }
  function fromTemplate(t) {                                          // From template on an empty workout: the Templates pages, choosing one for it (pickHome, where Use all lands: the client's own step, the one under the workout's, or under History's when the workout was opened from there)
    fillFor = t.id; pickFor = t.clientId; nav.pickDepth = nav.depth; nav.pickHome = nav.depth - (fromHistory(t) ? 2 : 1);
    if (!clients.has(TEMPLATES_ID)) { clients.set(TEMPLATES_ID, { id: TEMPLATES_ID, name: "Templates", notes: "", email: "", unit: "lb", createdAt: now(), kind: "templates" }); scheduleSave("clients", TEMPLATES_ID, 0); }
    go({ name: "client", id: TEMPLATES_ID, program: null, phase: null, stage: null });
  }
  $("tplFill").addEventListener("click", () => { const t = trainings.get(S.view.id); if (t) fromTemplate(t); });
  $("useBtn").addEventListener("click", () => {
    const t = trainings.get(S.view.id); if (!t) return;
    const ul = $("usePick"); if (!ul.hidden) { ul.hidden = true; return; }
    const people = peopleList(); if (lastUse.client) { const i = people.findIndex((c) => c.id === lastUse.client); if (i > 0) people.unshift(people.splice(i, 1)[0]); }
    ul.replaceChildren(...people.map((c) => { const li = document.createElement("li"); const b = document.createElement("button"); b.type = "button"; b.innerHTML = "<span></span><span class=\"sub\"></span>"; b.firstChild.textContent = c.name || "Unnamed"; b.lastChild.textContent = c.id === lastUse.client ? "last used" : ""; b.lastChild.insertAdjacentHTML("beforeend", '<span class="chev">\u203a</span>'); b.addEventListener("click", () => openDatePicker({ clientId: c.id, title: "Add to " + (c.name || "client"), onPick: (date) => applyTemplate(trainings.get(t.id) || t, c.id, date) })); li.appendChild(b); return li; }));
    if (!people.length) { const li = document.createElement("li"); li.className = "empty"; li.style.padding = "12px 16px"; li.textContent = "Add a client first."; ul.appendChild(li); }
    ul.hidden = false;
  });
  $("delTraining").addEventListener("click", () => { askDelete(S.view.id); });

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
    if (S.clientMode) return;                                                               // the coach's data only (the buttons are hidden for a client; the handler must not rely on that)
    const data = { app: "fiala-trainings", format: 1, exported: now(), clients: Object.fromEntries(clients), trainings: Object.fromEntries(trainings) };   // format: bumped when a later app writes something an older one must not read
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "fiala-trainings-" + today() + ".json";
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  });
  $("restore").addEventListener("click", () => $("restoreFile").click());
  const canon = (v) => JSON.stringify(v, (_, x) => (x && typeof x === "object" && !Array.isArray(x) ? Object.fromEntries(Object.keys(x).sort().map((k) => [k, x[k]])) : x));   // the same record in another key order is the same record
  function planRestore(d) {                                          // the file checked whole, then held against what is here: what the sheet says is exactly what applyRestore does
    const { cs, ts } = validateBackup(d, (id) => clients.has(id));
    for (const c of cs) { const here = clients.get(c.id); if (isTemplateClient(c.id) && !Array.isArray(c.folders) && here && Array.isArray(here.folders)) c.folders = JSON.parse(JSON.stringify(here.folders)); if (isTemplateClient(c.id) && !Array.isArray(c.rootOrder) && here && Array.isArray(here.rootOrder)) c.rootOrder = [...here.rootOrder]; }   // a backup from before his template folders (12 Nov) knows nothing of them: they stay as they are here, never wiped by a restore
    for (const t of ts) repairTimed(t);                                // compared, and later written, in the shape the app keeps: a backup from before the Time box carries a hold's seconds as a weight
    const changed = (map, kind, r) => { const here = map.get(r.id); return !here || dirty.has(key(kind, r.id)) || !seenAt.has(key(kind, r.id)) || canon(here) !== canon(r); };   // already here, the same, and known to the server: nothing to do, nothing to send
    const cs2 = cs.filter((c) => changed(clients, "clients", c)), ts2 = ts.filter((t) => changed(trainings, "trainings", t));
    const nC = cs2.filter((c) => !isTemplateClient(c.id)).length, nT = ts2.filter((t) => !isTemplateClient(t.clientId)).length, nTpl = ts2.length - nT, packs = cs2.some((c) => isTemplateClient(c.id));
    const parts = []; if (nC) parts.push(nC + (nC === 1 ? " client" : " clients")); if (nT) parts.push(nT + (nT === 1 ? " workout" : " workouts")); if (nTpl) parts.push(nTpl + (nTpl === 1 ? " template" : " templates")); if (packs) { const tc = cs2.find((c) => isTemplateClient(c.id)), th = clients.get(tc.id) || {}, fo = canon(tc.folders || []) !== canon(th.folders || []), ro = canon(tc.rootOrder || null) !== canon(th.rootOrder || null); parts.push("the packages list" + (fo && ro ? ", the template folders and the order of the programs" : fo ? " and the template folders" : ro ? " and the order of the programs" : "")); }
    const rC = cs2.filter((c) => clients.has(c.id) && !isTemplateClient(c.id)).length, rT = ts2.filter((t) => trainings.has(t.id)).length, rP = cs2.some((c) => clients.has(c.id) && isTemplateClient(c.id)) ? 1 : 0;
    const total = cs2.length + ts2.length, replaces = rC + rT + rP;
    const what = parts.length > 1 ? parts.slice(0, -1).join(", ") + " and " + parts[parts.length - 1] : parts[0] || "";
    const who = replaces === total ? (total === 1 ? "It replaces" : "They replace") : replaces === 1 ? "1 of them replaces" : replaces + " of them replace";
    const incl = rT && rC ? ", logged sets, notes and plans included" : rT ? ", logged sets and all" : rC ? (rC === 1 ? ", notes and plan included" : ", notes and plans included") : "";   // what a replaced copy loses, by kind
    const text = total ? what + " from the file " + (total === 1 && !what.includes(" and ") ? "goes" : "go") + " into the app." + (replaces ? " " + who + " a copy already here" + incl + "." : "") + " Everything else stays as it is." : "";
    return { cs: cs2, ts: ts2, text };
  }
  function applyRestore({ cs, ts }) {                               // the file's copy, as it is: a record already here is replaced whole (the save carries a marker so nothing of the server's is merged in); one this device never had joins the usual way, keeping what a client logged on the server meanwhile
    const put = (map, kind, r) => {
      const had = map.has(r.id);
      if (kind === "trainings" && S.templateDraft && S.templateDraft.id === r.id) { S.templateDraft = null; lsSet("fiala.trainings.draft", null); paintDraftBar(); }   // the template open as a draft: its save must be a real save
      map.set(r.id, r); const k = key(kind, r.id);
      if (had) fromFile.set(k, (dirty.get(k) || 0) + 1);            // the version the next save gets: that write carries the file's copy
      scheduleSave(kind, r.id, 0);
    };
    for (const c of cs) put(clients, "clients", c);                 // the Templates record included, version number and all: a file from an older set makes the next launch repair and complete the built-in templates
    for (const t of ts) put(trainings, "trainings", t);
    localBackend.save();                                             // the file's copy is on the device before the marker can matter: a relaunch before the flush must not carry the old record verbatim
  }
  $("restoreFile").addEventListener("change", async (e) => {
    const f = e.target.files && e.target.files[0]; if (!f || S.clientMode) { e.target.value = ""; return; }
    let plan = null;
    try { plan = planRestore(JSON.parse(await f.text())); }         // the whole file first; nothing is touched if any part is wrong
    catch (err) { $("status").textContent = err && err.message === "newer backup" ? "That backup is from a newer version of the app" : "That file is not a Fiala backup"; }
    e.target.value = "";
    if (!plan) return;
    if (!plan.cs.length && !plan.ts.length) { $("status").textContent = "Everything in that backup is already here"; return; }
    if (!(await askFirst({ title: "Restore this backup?", text: plan.text, yes: "Restore" }))) return;
    applyRestore(plan); adoptBuiltins("all"); render();   // (built-in templates the file brings back, into their weeks)
  });

  // ---------- boot ----------
  Object.assign(ui, { $, setStatus, render: renderUnlessSwiping, relabeled, photosSynced: () => flushPhotos(), showProblem, showWaiting, loadCustomVideos, loadCustomNames, loadCustomSubs, loadHidden, offlineFromMirror, resumeOnline, paintDraftBar, seedTemplates });   // what the sync layer may call on the screens
  function watchReleases(mine) {               // a page iOS keeps alive for days still gets the next release: on coming back to the app, never mid-tap, mid-sheet or mid-typing
    const sw = navigator.serviceWorker; if (!mine || !sw || !sw.addEventListener) return;
    let newest = 0;
    let resumedAt = 0;
    const busy = () => S.asking || /^(INPUT|TEXTAREA)$/.test((document.activeElement || {}).tagName || "") || !!(S.templateDraft && S.templateDraft.dirty && S.view.name === "training" && S.view.id === S.templateDraft.id) || (settingsOpen === "exercise" && exDirty()) || !!(S.view.name === "client" && noteDraft.get(S.view.id)) || [...cardNoteDraft.keys()].some((k) => k.startsWith(String(S.renderedTraining) + "/")) || !!(document.querySelector(".sheet-bg:not([hidden])"));   // a sheet, typing, or something unsaved on the page on screen: no reload now
    const settle = () => { if (newest > mine && !busy()) { calFold(); location.reload(); } };   // a client's month folds first: the reload opens on the week, and the place the browser keeps for it must be the week's (the list where it was)
    const ask = () => { if (sw.controller) sw.controller.postMessage({ type: "check" }); };
    sw.addEventListener("message", (e) => { if (e.data && e.data.type === "release") { newest = Math.max(newest, Number(e.data.current) || 0); if (performance.now() - resumedAt < 800 && document.visibilityState === "visible") settle(); } });   // an answer right after coming back lands before the first tap; a later one waits for the next quiet moment
    let had = !!sw.controller;
    sw.addEventListener("controllerchange", () => { if (had) ask(); had = true; });   // a newer worker took this page over: ask it what the newest release is (a worker change alone is no reason to reload)
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState !== "visible") { settle(); return; }                   // leaving the screen with a newer release known: the page comes back new
      resumedAt = performance.now();
      if (newest > mine) { settle(); return; }                                           // known from last time: now, before the first tap
      sw.getRegistration().then((reg) => reg && reg.update()).catch(() => {});   // a new worker, if one was deployed while the app slept
      ask();                                                                         // and a new release: the worker answers with the newest on the device
    });
  }
  const pageRelease = () => { for (const s of document.querySelectorAll("script[type=module]")) { const m = /main\.js\?v=(\d+)/.exec(s.textContent || ""); if (m) return Number(m[1]); } return 0; };   // the release this page runs, off its own import line (import.meta.url loses the ?v= when the worker serves the script from a release cache)
  async function boot() {
    try { const v = pageRelease(); if (v) { $("appVersion").textContent = "Version " + v; watchReleases(v); } } catch (_) {}   // the build this phone runs, at the bottom of Settings
    const saved = lsGet("fiala.trainings.view"); if (saved && saved.name) S.view = saved;
    const page = lsGet("fiala.trainings.page"); if (page && page.open) pendingPage = page;   // read before any screen change clears it
    const savedTab = lsGet("fiala.trainings.tab"); if (["profile", "workouts", "notes"].includes(savedTab)) S.tab = savedTab;
    localBackend.load();                       // instant start from the device copy
    try { const dr = lsGet("fiala.trainings.draft"); if (dr && dr.id && dr.doc && trainings.has(dr.id)) { S.templateDraft = { id: dr.id, snapshot: JSON.stringify(trainings.get(dr.id)), dirty: true, saving: false }; trainings.set(dr.id, dr.doc); } } catch (_) {}   // a template left with unsaved changes: back as it was, still unsaved
    restorePending();                          // and whatever was still waiting to reach the server
    try { previewClient = firstPreview(sessionStorage.getItem(PREVIEW_KEY), S.view); } catch (_) {}   // the workout page it opens on, in the view he set
    holdWake(true);                            // opened straight onto a workout: keep the screen on from the first moment
    if (window.supabase && window.supabase.createClient) {
      S.sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: "implicit" } });
      try { const known = lsGet("fiala.trainings.role"); if (known && known.email && (clients.size || trainings.size)) paintRemembered(known, false); } catch (_) {}   // the last account's pages at once, from the device copy: no empty Clients page, no "Loading…" on the way
      $("status").textContent = "Loading\u2026";
      const fromRecoveryLink = /type=recovery/.test(location.hash);
      S.sb.auth.onAuthStateChange((event) => {
        if (event === "PASSWORD_RECOVERY") { S.recovering = true; showRecovery(); }
        if (event === "SIGNED_OUT" && S.signedIn) { resetPhotos(); S.backend = null; S.offline = false; S.offlineEntry = null; S.pendingOwner = ""; S.templateDraft = null; S.pendingGo = null; lsSet("fiala.trainings.draft", null); paintDraftBar(); try { localStorage.removeItem("fiala.trainings.role"); } catch {} showLogin("Signed out. Sign in again to keep syncing."); }
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
      const hp = new URLSearchParams(location.hash.replace(/^#/, "")), linkErr = hp.get("error") || hp.get("error_code") ? (/expired|otp_expired/i.test((hp.get("error_description") || "") + (hp.get("error_code") || "")) ? "That link has expired. Ask for a new one." : "That link did not work. Ask for a new one.") : "";
      if (location.hash && /access_token|error/.test(location.hash)) history.replaceState(history.state, "", location.pathname);
      if (fromRecoveryLink && data && data.session) { S.recovering = true; showRecovery(); return; }
      if (data && data.session) { await enterCloud(data.session); }
      else if ((!navigator.onLine || isNetwork(sessionError)) && remembered && remembered.email) enterOffline(remembered);
      else showLogin(linkErr);
      return;
    }
    // no library (a first open with the network blocked): the remembered account's pages from the device copy, offline, every change kept for the cloud; a device that never signed in works locally
    const known = lsGet("fiala.trainings.role");
    if (known && known.email) { const shown = paintRemembered(known, true); $("catalogBtn").hidden = true; $("myExercises").hidden = true; if (shown !== false) setStatus(); return; }   // the catalog is edited in the cloud only; a client with no record here sees the login, with a quiet header
    S.backend = localBackend; $("localFoot").hidden = false; render(); setStatus();
    seedTemplates().catch(() => {});
  }
  if (!(window.supabase && window.supabase.createClient)) render();

  // ---------- exports: the page calls boot(); the test run (tests/) reaches the internals ----------
  export function internals() {
    return {
      fns: { boot, clientNews, markWorkoutsSeen, addTraining, newWorkoutHere, dayList, dayNames, byMade, showExercise, saveExercise, leaveSettings, msgTarget, paintBarMsg, go, showClientCard, showSettings, glass: () => GLASS.slice(), startExerciseNow, followEl, exerciseMenu, menuIcons: () => MI, rowMenu, ctxPlace, ctxItemOf, monthLetGo, exerciseCtx, showWhen, liftPlace, calDragState: () => ({ on: !!cd, lifted: !!(cd && cd.lifted), tid: cd ? cd.tid : null, key: cd ? cd.key : null, edge: cd ? cd.edge : 0, weekOff, x: cd ? cd.x : null, y: cd ? cd.y : null }), calState: () => ({ open: calOpen, month: calMonth }), moreOn, moreItems, askDelete, renumber, templatePath, cardSets: () => ({ openBlocks, setSel }), finishTap, copyWorkout, paintFinish, askFirst, barFor, addExercise, followRow, dockGoes, setPreview: (on) => { previewClient = !!on; }, holdState: () => (lp ? { open: lp.open, down: lp.down, lifted: !!lp.box, over: lp.over ? lp.over.textContent : null } : null), navState: () => ({ key: nav.curKey, depth: nav.depth, waits: nav.waits.length, shots: shotByKey.size, state: stateDepth() }), forceSwipe: (on) => { swipeOn = !!on; }, dropShots: () => shotByKey.clear(), shotKeys: () => [...shotByKey.keys()], swipeState: () => (sw ? { on: sw.on, busy: !!sw.busy, held: !!sw.held, shot: !!sw.shot, glassOut: (sw.glassOut || []).map((e) => e && e.id), glassIn: (sw.glassIn || []).map((e) => e && e.id) } : null), goBackNow, backKey, openHistoryPage, openFromHistory, deleteTraining, springEase, canReschedule, applyReschedule, showMenu, openDatePicker, rowDecide, rowArmed, rowReschedule, rowSkip, canSwipeRow, moveWorkout, doToday, missItems, missedOf, skipAllMissed, openPreview, closePreview, previewState: () => (pv ? { id: pv.id } : null), groupsOf, groupSummary, groupCaption, sheetList, pvDecide, previewDrag: () => (pvDrag ? { on: pvDrag.on, off: pvDrag.off, top: pvDrag.top } : null), previewWalk: (cid) => pvWalk(cid).map((t) => t.id), previewNear: pvNear, previewItems: (id) => pvItems(trainings.get(id)).map((it) => (it.danger ? "!" : "") + it.label), previewItemsRaw: (id) => pvItems(trainings.get(id)), previewSlide: () => (pg ? { dir: pg.dir, to: pg.to, x: pg.x, settling: pg.settling } : null), previewGo: pvGo, monthWheel, missState: () => ({ open: missOpen, for: missFor }), missReset: () => { missOpen = false; missFor = null; }, skipSheet: () => (sk ? { id: sk.t.id, reason: sk.reason } : null), closeSkip, openSkip, undoLeft, paintUndo, fingerX, workoutRow, rowSwipe: () => (rs ? { open: rs.open, busy: rs.busy, x: rs.x, w: rs.w, tid: rs.li.dataset ? rs.li.dataset.tid : "" } : null), closeDatePicker, datePicker: () => dp, initials, photoFor, setPhoto, loadPhoto, crop, flushPhotos, resetPhotos, forgetPhoto, loadPhotoQueue, photoQueue, packageOf, renameExercise, deleteExercise, addCustomName, loadHidden, loadCustomSubs, saveSub, deleteSub, subtitleFor, refreshNames, allNames: () => ALL_NAMES.slice(), knownName, videoForName, exerciseMatches, properName, overviewCounts, loggedExercises, syncDownNow, fetchAll, mergeDown, cloudBackend, clientBackend, localBackend, flushOne, scheduleSave, markDirty, persistPending, restorePending, freshRow, isEmptyWorkout, effDate, clientTrainings, lastWeights, setsOf, groupKey, noteEntries, packNotes, mergeNotes: (a, b) => mergeNotes(a, b, deletedNotes), planRestore, applyRestore, validateBackup: (d) => validateBackup(d, (id) => clients.has(id)), buildReport: (kind, fonts, c) => buildReport(kind, fonts, c, clientTrainings(c.id)), reportRange, parseTtf, pdfDoc, today, localIso, uid, key, setFinished, setSkipped, touchState, isTemplateClient, addTraining, render, setStatus, tplNodes, tplNode, tplKids, tplTree, tplIn, tplSlide, nextN, placeTemplate, newFolder, newSlide, renameNode, deleteNode, tplPage, tplPageOn, tplMoreItems, pageMoreItems, newTemplateHere, templateHome, templateMeta, saveAsTemplate, viewKey, setPickFor: (v) => { pickFor = v; }, setFillFor: (v) => { fillFor = v; }, choosing: () => ({ pickFor, fillFor, pickHome: nav.pickHome }), fromTemplate, canFill, useWeek, weekName, useWeekFor, openAs, setOpenAs, firstPreview, previewOn: () => previewClient, weekOffNow: () => weekOff, setWeekOff: (v) => { weekOff = v; }, weekWheelNow: () => weekWheel, weekPageNow: () => weekPage, wkMonth, calFold, moveTemplate, moveFolder, folderPlaces, deleteTemplateRow, tplSwipe, tplOrderOn, moveFolderTo, doneTplOrder, tplAddItems, tplRootList, moveRootTo, adoptBuiltins, seedTemplates },
      maps: { hiddenKeys, customNames, customVideos, customSubs, clients, trainings, dirty, seenAt, seenDoc, confirmedAt, timers, chains, trainerState, trainerTouched, trainerNamed, trainerNoted, folderTouched, deletedFolders, pendingWeightRows, pendingDoneRows, pendingEarlyRows, pendingFinish, pendingSkip, pendingMove, pendingMiss, pendingSwap, pendingOrder, pendingNoteRows, planTouched, deletedNotes, deletedPackages, fromFile },
      get: () => ({ ...S }),
      set: (o) => { Object.assign(S, o); },
      reset: () => { resetState(); seenDoc.clear(); moveOut.clear(); localStorage.clear(); },
      wake: () => ({ held: !!wake, timer: !!wakeTimer }),
    };
  }
  export { boot };
