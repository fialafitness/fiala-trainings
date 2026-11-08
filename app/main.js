// Fiala Trainings — the app. Loaded by index.html as an ES module; boot() starts it.
import { NAMES, VIDEOS, ALIASES } from "./catalog.js";
import { S, resetState, clients, trainings, dirty, timers, chains, pendingWeightRows, pendingDoneRows, pendingEarlyRows, pendingFinish, pendingSkip, trainerState, pendingMove, pendingMiss, pendingSwap, pendingOrder, seenAt, trainerTouched, trainerNamed, trainerNoted, confirmedAt, deletedNotes, deletedPackages, fromFile, pendingNoteRows, ui, planTouched } from "./state.js";
import { uid, now, today, localIso, fmtDate, fmtDay, fmtDayLong, clamp, norm, squash, lsGet, lsSet, daysLater } from "./util.js";
import { TEMPLATES_ID, isTemplateClient, effDate, freshRow, isEmptyWorkout, setsOf, groupKey, labelKey, cmpLabel, validateBackup, doneCount, timedPlan, measurePlan, convertWeight, stampUnit, toUnit, toTimeUnit, timeAsWeight, repairTimed, planNumber, followFrom, autoSubtitle, splitName, composeName, perHand, betterSet, topSet, sameSet, setCounts, correctFrom, planProgress, sessionNo, planActive } from "./model.js";
import { noteEntries, packNotes, mergeNotes } from "./notes.js";
import { seenDoc, isNetwork, isOffline, reasonOf, key, markDirty, persistPending, restorePending, scheduleSave, flushAll, flushOne, localBackend, touchState, TABLE, cloudBackend, clientBackend, syncDown, mergeDown, syncDownNow, scheduleSync, withTimeout, fetchAll } from "./sync.js";
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
    render(); setStatus(); return true;
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

  function hideAllViews() { navWillChange(); $("meDisc").hidden = true;
    rememberPage();                                                   // every page change passes here: the device remembers which settings page is up
    $("tabbar").hidden = true; $("addBtn").hidden = true; document.body.classList.remove("tabs");
    for (const id of ["vLogin", "vSignup", "vPassword", "vExercises", "vExercise", "vPackages", "vSettings", "vClientCard", "vHistory", "vCatalog", "vData", "vNumber", "vRecovery", "vWaiting", "vCelebrate", "vClients", "vClient", "vTraining"]) $(id).hidden = true;
    $("navDone").hidden = true;
  }
  function showLogin(msg) {
    dropWake();
    S.signedIn = false; S.clientMode = false; S.myClientId = null; reordering = false; document.body.classList.remove("client");
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
  const viewKey = (v) => [v.name, v.id || "", v.program || "", v.phase || "", v.stage || ""].join("/");
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
  $("navDone").addEventListener("click", () => { if (settingsOpen === "exercise") saveExercise(); });
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
      dirty.clear(); pendingWeightRows.clear(); pendingDoneRows.clear(); pendingEarlyRows.clear(); pendingFinish.clear(); pendingSkip.clear(); pendingMove.clear(); pendingMiss.clear(); pendingSwap.clear(); pendingOrder.clear(); trainerTouched.clear(); trainerNamed.clear(); trainerNoted.clear(); planTouched.clear(); deletedNotes.clear(); deletedPackages.clear(); fromFile.clear();
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
      timers.clear(); chains.clear(); dirty.clear(); trainerTouched.clear(); trainerNamed.clear(); trainerNoted.clear(); planTouched.clear(); deletedNotes.clear(); deletedPackages.clear(); fromFile.clear(); S.failed = false;
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
  function newWorkoutHere() { setTab("workouts"); addTraining(S.view.id, null, today()); }   // the round + beside the bar, on any tab: a new workout for this client, today — and Back lands on Workouts, where it shows
  function deleteTraining(id) {
    const t = trainings.get(id); if (!t) return;
    if (S.templateDraft && S.templateDraft.id === id) { S.templateDraft = null; S.pendingGo = null; lsSet("fiala.trainings.draft", null); paintDraftBar(); }
    const toHistory = fromHistory(t);
    trainings.delete(id); scheduleSave("trainings", id, 0);
    if (toHistory) backToHistory(t); else go({ name: "client", id: t.clientId }, true);   // up to where Back goes (the client, or History it was opened from): its step goes
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
    if (!(next.name === "client" && isTemplateClient(next.id))) { pickFor = null; fillFor = null; }
    navWillChange(back ? "back" : "");                               // the screen as it was: Safari's (and the edge swipe's) page to come back to
    scrollMemo.set(viewKey(S.view), window.scrollY);                                              // the page being left: Back brings it back here
    if (S.view.name === "training" && !(next.name === "training" && next.id === S.view.id)) for (const k of [...cardNoteDraft.keys()]) if (k.startsWith(S.view.id + "/")) cardNoteDraft.delete(k);   // a card note left half-written goes with the page
    if (!S.clientMode && (!S.sb || S.syncedOnce) && S.view.name === "training" && !(next.name === "training" && next.id === S.view.id) && fillFor !== S.view.id) {   // leaving an empty workout behind discards it, like an empty note (not while it waits for a template, not before the first sync)
      const t = trainings.get(S.view.id); if (isEmptyWorkout(t)) { trainings.delete(t.id); scheduleSave("trainings", t.id, 0); }
    }
    notesFresh = null;
    if (newsShown && !(next.name === "client" && next.id === newsShown)) { const c = clients.get(newsShown); newsShown = null; if (c) markWorkoutsSeen(c); }   // leaving the client: the New list he saw counts as looked at
    for (const f of document.querySelectorAll("#rows .player iframe, #exPlayer iframe")) f.remove();   // a video left playing does not follow to the next page
    reordering = false; S.view = next; lsSet("fiala.trainings.view", S.view); render(); setStatus(); window.scrollTo(0, back ? (scrollMemo.get(viewKey(next)) || 0) : 0);   // forward: the top; back: where that page was (the header shows this page's save state, not the last page's complaint)
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
  let popClose = null;                                              // the frosted bubble or menu that is open, if one is: its own close
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
    if (nav.pending) { if (kind) nav.pending.kind = nav.pending.kind || kind; return; }
    if (swipeOn && seenTouch && !nav.backing && kind !== "back") { const k = nav.curKey || screenKey(), shot = captureScreen(); if (shot) { shotByKey.delete(k); shotByKey.set(k, shot); if (shotByKey.size > 14) shotByKey.delete(shotByKey.keys().next().value); } }   // the first call of a change: the screen is still the old one
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
  const SWIPE_EDGE = 24, SWIPE_GO = 8, NO_SWIPE = "#calView, #week, #dpGrid, .tr-chips, .kb-chips, .grip, .alt-menu, .sugg, input, textarea, select, [contenteditable]";   // things that drag sideways or scroll themselves keep the touch (Apple's rule for its swipe from anywhere)
  const GLASS_RES = 0.416, GLASS_DAMP = 0.75, GLASS = ["back", "meDisc", "navDone"];   // the bar's buttons, and their change on release
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
  if (swipeOn && !iosHome && typeof document !== "undefined" && document.body && document.body.classList) document.body.classList.add("clip-x");   // Android's installed app: the sliding page must not widen the page (index.html)
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
    const dock = $("dock"); box._dock = !!dock && [...dock.children].some((k) => !k.hidden) && !document.body.classList.contains("typing");
    if (box._dock) { const d = dock.cloneNode(true); d.classList.add("shot-dock"); box.appendChild(d); }   // the page's tab bar too, styled as itself (fixed inside the copy, which holds it in place: will-change): it comes in with the page
    const bar = document.querySelector("header .bar"); if (bar) box._bar = bar.cloneNode(true);   // the bar's buttons and logo as they were over this page
    return box;
  }
  const lookNow = () => (document.body.classList.contains("client") ? "client" : "coach") + "@" + (Number(window.innerWidth) || 0);
  function barFor(key) {                                            // the bar's buttons on the screen with this key (keep in step with render() and the settings pages)
    const [vk, sub] = String(key).split("|"), [name, id] = vk.split("/"), home = !sub && (name === "clients" || (S.clientMode && name === "client"));
    return { back: !home, brand: home, meDisc: !sub && name === "client" && !isTemplateClient(id), navDone: sub === "exercise", id };
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
    box._bar = barCopy(viewKey({ name: "clients" }) + "||");
    return box;
  }
  let sw = null, renderAfterSwipe = false;
  const renderUnlessSwiping = () => { if (sw && (sw.on || sw.busy)) { renderAfterSwipe = true; return; } render(); };   // a sync's redraw waits while the pages slide (never the page under the finger rebuilt mid-swipe); clearSwipe draws it
  const swipeHolds = () => !!sw && !S.asking && (sw.on || sw.busy) && !(sw.busy && Date.now() - sw.busyAt > 3000);   // the pages are sliding: no taps (a question Back asks always takes them; a release that never finished lets go after 3 s)
  document.addEventListener("click", (e) => { if (swipeHolds()) { e.preventDefault(); e.stopImmediatePropagation(); } }, true);   // nothing is tapped while the pages slide (a second Back, the card, the + would land mid-transition)
  const swipeReady = () => swipeOn && canBack() && !held() && !(document.activeElement && /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName));
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
      e.preventDefault(); sw.held = true; sw.hx = t.clientX; swipeSample(e, t.clientX); return;   // held from here; this move only holds, so WebKit has the answer at once (the page moves from the next)
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
    const dock = $("dock"), dockOn = !!dock && [...dock.children].some((k) => !k.hidden) && !document.body.classList.contains("typing");
    sw.dock = dock; sw.dockSlides = dockOn && !(shot && shot._dock);   // this page's tab bar goes with this page; one both pages have stays (the copy's then stays hidden)
    if (shot) for (const d of shot.querySelectorAll(".shot-dock")) d.style.visibility = dockOn ? "hidden" : "";
    // the bar: its buttons stay as they are while the finger moves; the logo of the page underneath comes in with that page
    const live = document.querySelector("header .bar"); sw.glassOut = []; sw.glassIn = []; sw.anims = [];
    if (live) {
      const nb = (shot && shot._bar) || barCopy(bk), vis = (b, id) => { const el = b && b.querySelector("#" + id); return !!el && !el.hidden; };   // no copy of the page underneath: its bar as render() will show it
      for (const id of GLASS) if (vis(live, id) && !vis(nb, id)) sw.glassOut.push($(id));   // a button only this page has: it goes when the finger lets go
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
        for (const k of gb.children) { const g = GLASS.includes(k.id) && !k.hidden && !vis(live, k.id); k.style.visibility = "hidden"; if (g) sw.glassIn.push(k); }
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
    if (renderAfterSwipe) { renderAfterSwipe = false; render(); }   // what a sync brought meanwhile
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
      m.classList.add("swiping"); m.style.transform = "translate3d(" + w + "px,0,0)"; s.layer.style.zIndex = ""; void m.offsetWidth;
      const back = springEase(0, 0.3, 1); s.dx = 0; paintSwipe(back); setTimeout(clear, back.ms + 20); return;
    }
    clear();                                                        // same moment: the next frame shows the real page where the copy was
  }
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
  // a list in a sheet, in the same language as askFirst: rows are <li> with a button[data-id]; resolves with the tapped id, or null for Cancel / tap outside / Escape
  function sheetList({ title, rows }) {
    return new Promise((resolve) => {
      if (askOpen) askOpen(false);
      const bg = $("pickSheet"), ul = $("pickList"), n = $("pickNo"), behind = [...document.body.children].filter((el) => el !== bg);
      $("pickTitle").textContent = title;
      ul.replaceChildren(...rows);
      let armed = false;                                                                      // the second tap of a double tap must not pick a row
      const settle = setTimeout(() => { armed = true; }, 350);
      const done = (v) => { clearTimeout(settle); askOpen = null; S.asking = false; bg.hidden = true; for (const el of behind) el.inert = false; n.removeEventListener("click", onNo); bg.removeEventListener("click", onBg); ul.removeEventListener("click", onRow); document.removeEventListener("keydown", onKey); resolve(v); };
      const onNo = () => done(null), onBg = (e) => { if (armed && e.target === bg) done(null); }, onKey = (e) => { if (e.key === "Escape") done(null); };
      const onRow = (e) => { const b = e.target.closest("button[data-id]"); if (b && armed) done(b.dataset.id); };
      askOpen = done; S.asking = true;
      n.addEventListener("click", onNo); bg.addEventListener("click", onBg); ul.addEventListener("click", onRow); document.addEventListener("keydown", onKey);
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
  async function showDay(c, key) {                                                           // a day with more than one workout: the day's rows, each its own workout; the coach can add another
    const d = new Date(key + "T12:00:00"), list = dayList(c.id, key).sort(byMade);
    const rows = list.map((t) => {
      const li = workoutRow(t, t.completedAt || t.skippedAt ? "past" : key === today() ? "today" : "next");
      const b = li.querySelector("button"), nb = b.cloneNode(true); nb.dataset.id = t.id; b.replaceWith(nb);      // the row's own tap is replaced by the sheet's
      const acts = li.querySelector(".missed-actions"); if (acts) acts.remove();
      return li;
    });
    if (!S.clientMode) { const li = document.createElement("li"); li.className = "more"; const box = document.createElement("div"); const b = document.createElement("button"); b.type = "button"; b.dataset.id = "+"; b.textContent = "Add a workout"; box.appendChild(b); li.appendChild(box); rows.push(li); }
    const id = await sheetList({ title: d.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" }), rows });
    if (id === "+") addTraining(c.id, null, key); else if (id) go({ name: "training", id });
  }
  function finishEarlyNow() {
    if (!es) return;
    const { t, g, selKey, reason } = es; closeFinishEarly();
    for (const r of g.rows) { r.setsDone = clamp(parseInt(r.setsDone, 10) || 0, 0, 20); r.done = true; markEarly(t, r, reason); const track = S.clientMode ? pendingWeightRows : trainerTouched; if (!track.has(t.id)) track.set(t.id, new Set()); track.get(t.id).add(r.id); }
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
      const dn = document.createElement("span"); dn.className = "dn"; dn.textContent = String(day);
      b.append(dn, dayDots(dayWorkouts));
      b.setAttribute("aria-label", d.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" }) + dayWords(dayWorkouts));
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
    scheduleSave("trainings", target.id, 0); S.renderedTraining = null;
    if (typeof nav.pickDepth === "number") { navLandAt(nav.pickDepth); nav.pickDepth = null; }   // back on the workout's own step: Back from it goes to the client, not through the templates
    go({ name: "training", id });
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
      $("tplKicker").textContent = "Workout library"; $("cName").textContent = "Templates";
      const mine = (byProg.get(MY_TEMPLATES) || []).sort((x, y) => templateMeta(x).n - templateMeta(y).n);
      if (mine.length) { wrap.appendChild(h2("My templates")); const ul = document.createElement("ul"); ul.className = "list"; ul.replaceChildren(...mine.map((t) => tplRow(t, !!pickFor))); wrap.appendChild(ul); }
      const progs = [...byProg.keys()].filter((p) => p !== MY_TEMPLATES).sort((x, y) => progRank(x) - progRank(y) || String(x).localeCompare(String(y)));
      if (progs.length) { wrap.appendChild(h2("Programs")); const ul = document.createElement("ul"); ul.className = "list"; ul.replaceChildren(...progs.map((p) => navRow(p, wn(byProg.get(p).length), () => go({ ...S.view, program: p, phase: null, stage: null })))); wrap.appendChild(ul); }
      if (!all.length) { const e = document.createElement("div"); e.className = "empty"; e.textContent = "No templates yet. Open a workout and tap Save as template."; wrap.appendChild(e); }
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
    const pitems = items.filter((t) => templateMeta(t).phase === ph);   // level 3: stage tabs + workouts
    const pn = (pitems.find((t) => templateMeta(t).phaseName) || { template: {} }).template.phaseName || "";
    $("tplKicker").textContent = prog; $("cName").textContent = "Phase " + ph + (pn ? " · " + pn : "");
    const stages = [...new Set(pitems.map((t) => templateMeta(t).stage))].sort((x, y) => x - y);
    const cur = stages.includes(S.view.stage) ? S.view.stage : stages[0];
    const seg = document.createElement("div"); seg.className = "seg stages"; seg.setAttribute("role", "tablist");
    for (const s of stages) { const b = document.createElement("button"); b.type = "button"; b.textContent = "Stage " + s; b.classList.toggle("on", s === cur); b.addEventListener("click", () => { S.view.stage = s; lsSet("fiala.trainings.view", S.view); renderTemplates(c); nav.curKey = screenKey(); /* the screen changed in place: its picture is filed under this stage */ }); seg.appendChild(b); }
    wrap.appendChild(seg);
    const ul = document.createElement("ul"); ul.className = "list"; ul.style.marginTop = "16px";
    ul.replaceChildren(...pitems.filter((t) => templateMeta(t).stage === cur).sort((x, y) => templateMeta(x).n - templateMeta(y).n).map((t) => tplRow(t, !!pickFor)));
    wrap.appendChild(ul);
  }
  const templateHome = (t) => { const m = templateMeta(t); return m.program === MY_TEMPLATES ? { name: "client", id: TEMPLATES_ID } : { name: "client", id: TEMPLATES_ID, program: m.program, phase: m.phase, stage: m.stage }; };
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
    if (S.view.name !== "training" && previewClient) { previewClient = false; rememberPreview(); }
    if (!S.clientMode) document.body.classList.toggle("client", previewing());
    $("vClients").hidden = S.view.name !== "clients";
    $("vClient").hidden = S.view.name !== "client";
    const tabs = S.view.name === "client" && !isTemplateClient(S.view.id); $("tabbar").hidden = !tabs; $("addBtn").hidden = !tabs || S.clientMode; document.body.classList.toggle("tabs", tabs);   // the coach's +: beside the bar on a client's page, on every tab
    for (const b of $("tabbar").querySelectorAll("button")) { const on = b.dataset.tab === S.tab; b.classList.toggle("on", on); if (on) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current"); }
    $("vTraining").hidden = S.view.name !== "training";
    $("back").hidden = S.view.name === "clients" || (S.clientMode && S.view.name === "client");
    $("brand").hidden = !(S.view.name === "clients" || (S.clientMode && S.view.name === "client"));
    $("meDisc").hidden = !(S.view.name === "client" && !isTemplateClient(S.view.id));   // the person disc: on a client's page, every tab, nowhere else — Settings for the client, the card for the coach
    $("meDisc").setAttribute("aria-label", S.clientMode ? "Settings" : "Client card");
    paintMeDisc();
    if (S.clientMode && S.tab === "notes") setTab("workouts");   // Notes is the coach's tab
    if (S.view.name === "clients") { S.renderedTraining = null; renderClients(); }
    else if (S.view.name === "client") { S.renderedTraining = null; $("backLabel").textContent = isTemplateClient(S.view.id) && S.view.phase ? S.view.program : (isTemplateClient(S.view.id) && S.view.program ? "Templates" : "Clients"); renderClient(); }
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
      dragging = true;
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
        dragging = false;
        li.removeEventListener("pointermove", move); li.removeEventListener("pointerup", end); li.removeEventListener("pointercancel", end);
        li.classList.remove("dragging"); rows.forEach((r) => { r.style.transform = ""; });
        moveClientTo(id, target);
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
    go({ name: "training", id: t.id }); followRow(x.r.id);
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
  const dayDots = (ws) => {                                                   // under a day: one bar per workout (up to three), fern when finished, a hairline when planned
    const box = document.createElement("span"); box.className = "dots";
    for (const t of ws.slice().sort(byMade).slice(0, 3)) { const dot = document.createElement("span"); dot.className = "dot " + (t.completedAt ? "finished" : "planned"); box.appendChild(dot); }
    return box;
  };
  const dayWords = (ws) => { if (!ws.length) return ""; const n = ws.length, done = ws.filter((t) => t.completedAt).length; return ", " + n + (n === 1 ? " workout" : " workouts") + (done === n ? ", finished" : done ? ", " + done + " finished" : ""); };
  const relDay = (iso) => {                                            // "Today", "Tomorrow", "In 4 days", "Yesterday", "3 days ago"
    const n = Math.round((new Date(iso + "T12:00:00") - new Date(today() + "T12:00:00")) / 86400000);
    if (!Number.isFinite(n)) return "";                                  // no date on the record: no caption
    if (n === 0) return "Today"; if (n === 1) return "Tomorrow"; if (n === -1) return "Yesterday";
    if (n > 1) return n < 14 ? "In " + n + " days" : "In " + Math.round(n / 7) + " weeks";
    return n > -14 ? (-n) + " days ago" : Math.round(-n / 7) + " weeks ago";
  };
  const liftGlyph = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor" stroke="currentColor" stroke-linejoin="round" stroke-linecap="round"><circle cx="12" cy="2.65" r="1.95" stroke="none"/><path stroke-width=".25" d="M10.1 5.5Q12 5.1 13.9 5.5L15 6.6 15.5 7.4 15.8 8.3 16.3 9.1 16.7 9.97 17.1 10.8 17.5 11.7 18 12.5 18.7 14.1Q18.6 15 17.8 15 17 15 16.9 14.2L16 12.5 15.6 11.7 15.2 10.8 14.8 9.97 14.2 9.6 14 9.6 14 11.4 10 11.4 10 9.6 9.8 9.6 9.2 9.97 8.8 10.8 8.4 11.7 8 12.5 7.1 14.2Q7 15 6.2 15 5.4 15 5.3 14.1L6 12.5 6.5 11.7 6.9 10.8 7.3 9.97 7.7 9.1 8.2 8.3 8.5 7.4 9 6.6Z"/><path stroke-width=".25" d="M9.5 14.9h5l1.6 7.3q.2 1-.8 1.1-.8.1-1-.7L12 15.1l-2.3 7.5q-.2.8-1 .7-1-.1-.8-1.1z"/><rect x="1.3" y="12.95" width="21.4" height=".95" rx=".45" stroke="none"/><rect x="2.1" y="9.6" width="1.9" height="6.5" rx=".9" stroke="none"/><rect x="20" y="9.6" width="1.9" height="6.5" rx=".9" stroke="none"/></svg>';   // the lifter at the bar, traced from the proportions of Apple's: head, rounded shoulders, arms down to the bar, legs set
  function workoutRow(t, mode) {                                        // one workout as Fitness lays a row out: the day in a column, a disc with the lifter, the title over a quiet line, a chevron. mode: "today" | "next" | "past"
    const li = document.createElement("li"); const b = document.createElement("button"); b.type = "button";
    const n = t.rows.length, done = t.rows.filter((r) => r.done).length;      // exercises are rows: a superset counts each of its lifts
    const skipped = !t.completedAt && !!t.skippedAt;
    const overdue = mode === "next" && !skipped && !t.completedAt && !!effDate(t) && effDate(t) < today();
    li.className = "w" + (t.completedAt ? " done" : "") + (skipped ? " off" : "");
    const d = effDate(t) ? new Date(effDate(t) + "T12:00:00") : null;
    const wd = document.createElement("span"); wd.className = "wd"; wd.innerHTML = '<span class="dow"></span><span class="dn"></span>';
    const otherMonth = mode === "next" && d && effDate(t).slice(0, 7) !== today().slice(0, 7);   // weeks ahead in another month: the month over the day, not the weekday
    wd.firstChild.textContent = d ? d.toLocaleDateString(undefined, otherMonth ? { month: "short" } : { weekday: "short" }) : ""; wd.lastChild.textContent = d ? String(d.getDate()) : "";
    const wi = document.createElement("span"); wi.className = "wi"; wi.innerHTML = liftGlyph;
    const wt = document.createElement("span"); wt.className = "wt";
    const pri = document.createElement("span"); pri.className = "pri"; pri.textContent = String(t.title || "").trim() || "Workout";
    const count = n ? n + (n === 1 ? " exercise" : " exercises") : "Nothing added yet";
    const sec = document.createElement("span"); sec.className = "sec";                 // the quiet line: when, and how much
    if (overdue) { const miss = document.createElement("span"); miss.className = "missed"; miss.textContent = "Missed"; sec.append(miss, " \u00b7 " + count); }
    else if (mode === "next") sec.textContent = [relDay(effDate(t)), count].filter(Boolean).join(" \u00b7 ");
    else if (mode === "today") sec.textContent = done ? done + " of " + n + " done" : count;
    else if (skipped) sec.textContent = (t.missed === true ? "Missed" : "Skipped") + (t.skipReason ? " \u00b7 " + t.skipReason : "");
    else sec.textContent = count;
    wt.append(pri, sec);
    const chev = document.createElement("span"); chev.className = "chev"; chev.textContent = "\u203a"; chev.setAttribute("aria-hidden", "true");
    b.append(wd, wi, wt, chev);
    b.addEventListener("click", () => { if (settingsOpen === "history") openFromHistory(t.id); else go({ name: "training", id: t.id }); });   // on History the page is a settings page over the client's: it has to come off first
    li.dataset.tid = t.id; li.appendChild(b);
    if (overdue) {                                                       // the missed workout is the first thing to decide
      const acts = document.createElement("div"); acts.className = "missed-actions";
      const doToday = document.createElement("button"); doToday.type = "button"; doToday.className = "btn tint"; doToday.textContent = "Do it today";
      doToday.addEventListener("click", () => { t.date = today(); t.missed = false; t.skippedAt = null; touchState(t.id, "date", "missed", "skippedAt"); if (S.clientMode) { pendingMove.add(t.id); pendingMiss.add(t.id); } scheduleSave("trainings", t.id); renderClient(); });
      const skip = document.createElement("button"); skip.type = "button"; skip.className = "btn tint"; skip.textContent = "Skip";
      skip.addEventListener("click", () => { t.skippedAt = now(); t.missed = false; touchState(t.id, "skippedAt", "missed"); if (S.clientMode) { pendingSkip.add(t.id); pendingMiss.add(t.id); } scheduleSave("trainings", t.id); renderClient(); });
      acts.append(doToday, skip); li.appendChild(acts);                  // the choices sit under the row
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
    paintMsg(c); paintTrainerMsg(c);
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
      b.append(dn, dayDots(dayWorkouts));
      b.setAttribute("aria-label", d.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" }) + dayWords(dayWorkouts));
      b.addEventListener("click", () => {
        if (dayWorkouts.length > 1) showDay(c, key);                                           // two or more: the day's own list
        else if (dayWorkouts.length) go({ name: "training", id: dayWorkouts[0].id });
        else if (!S.clientMode) addTraining(c.id, null, key);
      });
      return b;
    };
    for (let i = 0; i < 7; i++) { const d = new Date(monday); d.setDate(monday.getDate() + i); weekEl.appendChild(dayButton(d, true)); }
    const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6);   // the strip's title is the month it is in, as Calendar's; the month view carries its own
    $("weekHead").textContent = monday.getMonth() === sunday.getMonth() ? monday.toLocaleDateString(undefined, { month: "long" }) : monday.toLocaleDateString(undefined, { month: "short" }) + " \u2013 " + sunday.toLocaleDateString(undefined, { month: "short" });
    $("weekHead").hidden = calOpen;
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
    const next = list.filter((t) => !t.completedAt && !t.skippedAt).sort((a, b) => effDate(a).localeCompare(effDate(b)) || byMade(a, b));   // by day, and within a day in the order they were made
    // keep it short: anything due within the next few days (the very next workout always shows);
    // "Show more" adds the next few workouts each tap, "Show less" folds back to the short list
    if (nextFor !== c.id) { nextFor = c.id; nextExtra = 0; }
    const edge = new Date(base); edge.setDate(base.getDate() + NEXT_DAYS); const horizon = iso(edge);
    const firstLater = next.find((t) => effDate(t) !== iso(base));             // the next workout after today's always shows, however far off
    const soon = next.filter((t, i) => i === 0 || t === firstLater || effDate(t) <= horizon);
    nextExtra = Math.max(0, Math.min(nextExtra, next.length - soon.length));
    const shown = next.slice(0, soon.length + nextExtra), left = next.length - shown.length;
    const todays = shown.filter((t) => effDate(t) === iso(base)), later = shown.filter((t) => effDate(t) !== iso(base));   // today's workout on its own card, the days after it under "Up next"
    $("todayHead").hidden = !todays.length; $("todayList").hidden = !todays.length; $("todayList").replaceChildren(...todays.map((t) => workoutRow(t, "today")));
    $("nextHead").hidden = !later.length && left === 0; $("nextList").hidden = !later.length && left === 0;
    $("nextList").replaceChildren(...later.map((t) => workoutRow(t, "next")));
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

    const rest = list.filter((t) => t.completedAt || t.skippedAt);           // History: a card under Up next; its page lays the past out by week, month and year
    $("histCard").hidden = !rest.length; $("histSub").textContent = rest.length + (rest.length === 1 ? " workout" : " workouts");
    $("trainingEmpty").hidden = list.length > 0;
    $("delClientConfirm").hidden = true; $("delClient").hidden = false;
  }

  function paintFinish(t) {
    $("finishWrap").hidden = t.rows.length === 0;
    const done = !!t.completedAt, skipped = !done && !!t.skippedAt;
    $("finishBtn").hidden = done || skipped; $("finishedLine").hidden = !done;
    const left = document.body.classList.contains("client") && t.rows.some((r) => !r.done);   // the client's page: with an exercise still open, finishing is finishing early — a quiet pill like Skip workout, not the purple act
    const fb = $("finishBtn"); fb.textContent = left ? "Finish early" : "Finish workout"; fb.classList.toggle("tint", left); fb.classList.toggle("soft", left);
    $("skipLine").hidden = done || skipped; $("skippedLine").hidden = !skipped;
    if (skipped) $("skippedText").textContent = (t.missed === true ? "Missed" : "Skipped") + (t.skipReason ? " \u00b7 " + t.skipReason : "");
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
  // a set track whose sets all fit spreads them evenly across it, as a segmented control's segments; measured without the spread, and
  // never kept on a track that has to scroll (a spread that overflows would push its first sets out of reach); again when the width changes
  const fitsTrack = (chips) => { chips.classList.remove("fits"); if (chips.scrollWidth <= chips.clientWidth + 1) chips.classList.add("fits"); };
  if (typeof window !== "undefined" && window.addEventListener) window.addEventListener("resize", () => { for (const c of document.querySelectorAll(".tracker .tr-chips")) fitsTrack(c); });

  function renderTraining(t) {
    if (document.activeElement !== $("tTitle")) { $("tTitle").value = t.title || ""; requestAnimationFrame(() => { const el = $("tTitle"); el.style.height = "auto"; el.style.height = Math.max(32, el.scrollHeight) + "px"; }); }
    const asClient = S.clientMode || previewClient; paintSessionPill(t, asClient);
    $("tDate").textContent = (asClient ? fmtDayLong : fmtDay)(t.date || today());
    if (S.clientMode && !isTemplateClient(t.clientId)) paintTrainerMsg(clients.get(t.clientId)); else $("trainerBtn2").hidden = true;   // the client's Messages disc beside the title, as on the Workouts page: people message from the workout itself   // the client reads "Wednesday, Nov 4" as a plain line under the title; the coach keeps the date field to tap
    $("tTitle").readOnly = asClient; $("tDate").disabled = asClient;
    const isTpl = isTemplateClient(t.clientId);
    if (isTpl) draftFor(t);
    paintTrainerMsg(clients.get(t.clientId));
    const src = !asClient && !isTpl && t.fromTemplate ? trainings.get(t.fromTemplate) : null;
    $("fromTpl").hidden = !src; if (src) $("fromTplText").textContent = templatePath(src);
    $("tplFill").hidden = asClient || isTpl || (t.rows || []).length > 0 || !!t.completedAt;   // only an empty workout offers a template
    const others = isTpl || !effDate(t) ? [] : dayList(t.clientId, effDate(t)).filter((x) => x.id !== t.id);   // the day's other workouts: a quiet pill to the day's list
    $("dayMore").hidden = !others.length;
    if (others.length) { const d = effDate(t), when = d === today() ? "today" : "on " + whenDay(d); $("dayMoreText").textContent = others.length === 1 ? "Also " + when + ": " + (String(others[0].title || "").trim() || "Workout") : others.length + " more " + when; }   // "Also today: Core", "2 more on Nov 5"
    $("vTraining").classList.toggle("tpl", isTpl); $("useWrap").hidden = !isTpl || S.clientMode;
    $("viewSeg").hidden = S.clientMode || isTpl; for (const b of $("viewSeg").querySelectorAll("button")) b.classList.toggle("on", (b.dataset.view === "client") === previewClient); if (!isTpl || S.renderedTraining !== t.id) $("usePick").hidden = true;   // the client list built for another template must not survive onto this one
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
    const groups = [];
    t.rows.forEach((r, i) => {
      const k = groupKey(r.label, i);
      if (!groups.length || groups[groups.length - 1].key !== k) groups.push({ key: k, rows: [] });
      groups[groups.length - 1].rows.push(r);
    });
    let numbered = 0;
    const unfinished = groups.filter((g) => !g.rows.every((r) => r.done));
    const currentKey = asClient && !isTpl ? (unfinished[0] || {}).key : null;   // client: the first card not yet finished is the one open
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
          fitsTrack(chips);                                  // all of them fit: spread evenly across the track (never while it scrolls: spread is for a track with room to spare)
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
        const did = Math.min(...g.rows.map((r) => { const n = Math.min(doneCount(r), setsOf(r)); return n >= setsOf(r) ? Math.max(...g.rows.map(setsOf)) : n; }));
        const early = g.rows.some((r) => r.done && Math.min(doneCount(r), setsOf(r)) < setsOf(r));   // doneCount: a row finished before the counter existed is simply finished
        if (resume) resume.hidden = !early;
        const sets = (n) => n + " of " + total + (total === 1 ? " set" : " sets");
        const line = (text) => { const d = document.createElement("div"); d.textContent = text; sum.appendChild(d); };
        if (!early) { line("Finished \u00b7 " + sets(total)); return; }
        const why0 = (g.rows.find((r) => r.earlyReason) || {}).earlyReason || "";
        block.classList.toggle("skipped", did === 0);
        if (did === 0) { line("Skipped" + (why0 ? " \u00b7 " + why0 : "")); return; }   // nothing logged: skipped, not "finished early · 0 of 4" — and the card stays grey, not fern
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
        const summary = block.classList.contains("done") && block.classList.contains("open") && !fullBlocks.has(selKey); block.classList.toggle("summary", summary); if (openFull) openFull.hidden = !summary; if (placeFootRows) placeFootRows(summary);
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
        if (peeking && waitFoot) {                                     // "Finish Exercise 1 first" when one unfinished card comes before this one, by the name on its card; "the previous exercises" when more do
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
      b.addEventListener("click", (e) => { e.stopPropagation(); if (close) close(); it.onPick(); });
      return b;
    }));
    close = openPop(anchor, opts);
  }
  const MI = {                                                         // the menu's leading glyphs, 17px, drawn like the discs' own
    swap: '<svg class="mi" viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 5.5h10M10 3l2.5 2.5L10 8"/><path d="M13.5 10.5h-10M6 8l-2.5 2.5L6 13"/></svg>',
    lines: '<svg class="mi" viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M3 4.5h10M3 8h10M3 11.5h6"/></svg>',
    camera: '<svg class="mi" viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><path d="M2.25 5.6c0-.8.65-1.45 1.45-1.45h1.7l1.05-1.4h3.1l1.05 1.4h1.7c.8 0 1.45.65 1.45 1.45v5.95c0 .8-.65 1.45-1.45 1.45H3.7c-.8 0-1.45-.65-1.45-1.45z"/><circle cx="8" cy="8.55" r="2.35"/></svg>',
    photo: '<svg class="mi" viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"><rect x="1.9" y="2.9" width="12.2" height="10.2" rx="2.2"/><circle cx="5.7" cy="6.3" r="1.15"/><path d="M2.3 11.7l3.5-3.3 2.4 2.2 1.9-1.7 3.6 3.1"/></svg>',
    trash: '<svg class="mi" viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"><path d="M2.8 4.4h10.4M6.3 4.4V3.1c0-.35.3-.6.6-.6h2.2c.35 0 .6.25.6.6v1.3M4.2 4.4l.65 8.5c.05.6.55 1.1 1.15 1.1h4c.6 0 1.1-.5 1.15-1.1l.65-8.5"/></svg>',
  };
  function openPop(anchor, opts) {                                   // places the bubble under (or above) its anchor and wires the ways it closes; returns close
    const bg = $("whenBg"), pop = $("whenPop");
    bg.hidden = false; pop.classList.remove("above"); pop.classList.toggle("hung", !!(opts && opts.align === "right"));
    const r = anchor.getBoundingClientRect(), vw = document.documentElement.clientWidth, vh = window.innerHeight, pw = pop.offsetWidth, ph = pop.offsetHeight;
    const box = anchor.closest(".group, .card, .plan-card, .overview"), bb = box ? box.getBoundingClientRect() : null;   // the bubble stays inside the card it belongs to, as Apple keeps a popover inside its content's margins, never out at the screen's edge
    let minL = 8, maxL = vw - pw - 8; if (bb && bb.right - bb.left >= pw) { minL = Math.max(minL, bb.left); maxL = Math.min(maxL, bb.right - pw); }
    const want = opts && opts.align === "right" ? r.right - pw : opts && opts.align === "center" ? r.left + r.width / 2 - pw / 2 : r.left;   // hung from the right edge, centred under the anchor, or from its left
    const left = Math.max(minL, Math.min(want, maxL)); let top = r.bottom + 8;
    if (top + ph > vh - 8) { top = r.top - 8 - ph; pop.classList.add("above"); }
    pop.style.left = left + "px"; pop.style.top = top + "px"; pop.style.setProperty("--caret", Math.max(12, Math.min(r.left + r.width / 2 - left, pw - 12)) + "px");
    const close = () => { if (popClose === close) popClose = null; bg.hidden = true; document.removeEventListener("pointerdown", onDown, true); document.removeEventListener("pointerup", onUp, true); document.removeEventListener("keydown", onKey); window.removeEventListener("scroll", close, true); };
    const onKey = (e) => { if (e.key === "Escape") close(); };
    let down = null, eat = null;                                     // a tap outside closes the bubble and goes no further (as a system menu's dismissing tap): nothing under it is pressed or given focus; a finger that drags the page does not close it
    const uneat = () => { if (eat) { document.removeEventListener("mousedown", eat, true); eat = null; } };
    const onDown = (e) => {
      if (pop.contains(e.target)) { down = null; return; }
      e.preventDefault(); down = { x: e.clientX, y: e.clientY };     // no mouse events follow a cancelled pointerdown, so a field under the tap is not focused (focus is mousedown's doing); on the phone that mousedown comes after pointerup, so it is eaten there too
      uneat(); eat = (ev) => { ev.preventDefault(); uneat(); }; document.addEventListener("mousedown", eat, true); setTimeout(uneat, 400);
    };
    const onUp = (e) => {
      if (!down) return; const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y); down = null; if (moved > 10) { uneat(); return; }
      if (e.button === 0 && e.isPrimary) {                            // only a primary tap is followed by a click; a right or middle button, or a second finger, is not, and must not leave the swallower waiting for someone else's click
        const swallow = (ev) => { ev.stopPropagation(); ev.preventDefault(); disarm(); }, disarm = () => { document.removeEventListener("click", swallow, true); document.removeEventListener("pointerdown", disarm, true); uneat(); };
        document.addEventListener("click", swallow, true); document.addEventListener("pointerdown", disarm, true); setTimeout(disarm, 400);   // the click that follows this tap is the dismissal, not a press on what lies under
      }
      close();
    };
    document.addEventListener("pointerdown", onDown, true); document.addEventListener("pointerup", onUp, true); document.addEventListener("keydown", onKey); window.addEventListener("scroll", close, true);
    popClose = close;
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
  const rememberPreview = () => { try { if (previewClient) sessionStorage.setItem(PREVIEW_KEY, "1"); else sessionStorage.removeItem(PREVIEW_KEY); } catch (_) {} };
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
        <div class="chip"><span class="val"></span><input class="reps tab" inputmode="decimal" placeholder="10" aria-label="Reps"><span class="suffix">reps</span></div>
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
    const layoutIcons = () => { const w = asClient ? (q(".vid-btn").hidden ? 0 : 38) + (q(".alt-btn").hidden ? 0 : 46) : 0; /* the coach's name has the whole field: the discs are a row under it, and the stylesheet pins its padding */ for (const el of q(".exwrap").querySelectorAll(".name")) { const px = (w ? 4 + w + 8 : 16) + "px"; el.style.paddingRight = px; el.style.setProperty("--iconpad", px); } growName(); };   // the name wraps before the icons: their real footprint (the client's swap disc is 36px with a 10px gap, the others 38px, all 4px in from the edge) plus a breath
    const loose = (x) => String(x || "").toLowerCase().replace(/-/g, " ").replace(/\s+/g, " ").trim();
    const videoFor = (name) => { const s = String(name || "").trim(); if (!s) return null; const l = loose(ALIASES[s] || s); if (customVideos.has(loose(s))) return customVideos.get(loose(s)); if (customVideos.has(l)) return customVideos.get(l); return VIDEOS[s] || VIDEO_LOOSE.get(l) || null; };
    const markNamed = () => { if (S.clientMode) return; if (!trainerNamed.has(t.id)) trainerNamed.set(t.id, new Set()); trainerNamed.get(t.id).add(r.id); };
    const exwrap = q(".top .exwrap"), altBtn = q(".alt-btn"), altMenu = q(".alt-menu");
    const letter = (String(r.label || "").match(/^(?:\d+|w)([a-z])$/i) || [])[1] || "";   // superset rows read "A  Bench press" (warm-up Wa / Wb too)
    exwrap.dataset.letter = letter.toUpperCase(); el.style.setProperty("--letw", letter ? "42px" : "0px");
    let altMode = "list";
    const altList = () => (r.alts || []).filter(Boolean);
    const paintAltBtn = () => { const n = altList().length; const show = !asClient || n > 0; altBtn.hidden = !show; exwrap.classList.toggle("has-alt", show); altBtn.classList.toggle("some", n > 0); layoutIcons(); };   // the client sees the disc whenever the coach gave alternatives, logged sets or not (a swap keeps the sets)
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
      if (!asClient) {                                                                                   // a clear way out, like a sheet: Remove exercise on the left, Done on the right
        const foot = mk("div", "alt-foot");
        const rm = mk("button", "remove", "Remove exercise"); rm.type = "button"; rm.addEventListener("mousedown", (ev) => ev.preventDefault()); rm.addEventListener("click", async () => { closeAlt(); const nm = String(r.name || "").trim() || "this exercise", tpl = isTemplateClient(t.clientId); if (!(await askFirst({ title: tpl ? "Remove " + nm + " from this template?" : "Remove " + nm + "?", text: tpl ? "Nothing changes until you tap Save template." : "It comes off this workout, with anything logged on it.", yes: "Remove" }))) return; t.rows = t.rows.filter((x) => x.id !== r.id); save(); S.renderedTraining = null; render(); });
        const ok = mk("button", "done", "Done"); ok.type = "button"; ok.addEventListener("mousedown", (ev) => ev.preventDefault()); ok.addEventListener("click", closeAlt);
        foot.append(rm, ok); altMenu.appendChild(foot);
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
    altBtn.addEventListener("click", () => {
      if (asClient) {                                                                                   // the client picks from the frosted bubble under the disc: consistent with the other pop-ups, and it always fits
        const alts = altList().filter((a) => a !== r.name); if (!alts.length) return;
        showMenu(altBtn, alts.map((a) => ({ label: a, onPick: () => swapTo(a) })));   // the frosted bubble, like last/best: tap an alternative to swap it in
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
    const moreBtn = q(".more-btn");                                  // the coach's "…" disc: the card's other actions, in a menu under it
    if (moreBtn) moreBtn.addEventListener("click", (e) => {
      e.stopPropagation(); closeAlt();
      showMenu(moreBtn, [
        { label: "Alternate exercise", icon: MI.swap, onPick: () => altBtn.click() },   // video is the play disc's own business
        { label: (r.note || "").trim() ? "Edit instructions" : "Add instructions", icon: MI.lines, onPick: () => noteBtn.click() },
      ], { align: "right" });
    });

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
  function paintTrainerMsg(c) {
    const tel = c ? phoneDigits(c.trainerPhone) : ""; const wa = c && (c.chat || "sms") === "whatsapp";
    for (const id of ["trainerBtn", "trainerBtn2"]) { const a = $(id); if (!tel || !S.clientMode) { a.hidden = true; continue; } a.hidden = false; a.href = wa ? "https://wa.me/" + tel : "sms:+" + tel; if (wa) { a.target = "_blank"; a.rel = "noopener"; } else { a.removeAttribute("target"); a.removeAttribute("rel"); } }
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
    const ok = fillMsg($("msgBtn"), $("msgText"), c); $("msgBtn").hidden = !ok || S.clientMode;   // the hidden words "Message Jane" are the disc's name for VoiceOver
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
  $("tabbar").addEventListener("click", (e) => { const b = e.target.closest("button"); if (!b || b.dataset.tab === S.tab) return; setTab(b.dataset.tab); render(); window.scrollTo(0, 0); });
  const typingIn = (el) => !!el && /^(INPUT|TEXTAREA)$/.test(el.tagName) && !/^(date|month|checkbox|radio|file|range)$/.test(el.type || "");   // a keyboard is coming: a select or a date wheel is not typing
  document.addEventListener("focusin", (e) => { if (typingIn(e.target)) document.body.classList.add("typing"); });
  document.addEventListener("focusout", () => { setTimeout(() => { if (!typingIn(document.activeElement)) document.body.classList.remove("typing"); }, 80); });
  $("newTraining").addEventListener("click", () => addTraining(S.view.id, null, today()));
  $("addBtn").addEventListener("click", newWorkoutHere);
  $("dayMore").addEventListener("click", () => { const t = trainings.get(S.view.id); const c = t && clients.get(t.clientId); if (c && effDate(t)) showDay(c, effDate(t)); });
  $("delClient").addEventListener("click", () => { $("delClient").hidden = true; $("delClientConfirm").hidden = false; });
  $("delClientNo").addEventListener("click", () => { $("delClientConfirm").hidden = true; $("delClient").hidden = false; });
  $("delClientYes").addEventListener("click", () => deleteClient(S.view.id));

  $("tTitle").addEventListener("input", (e) => { const t = trainings.get(S.view.id); if (!t) return; t.title = e.target.value.replace(/\n/g, " "); e.target.style.height = "auto"; e.target.style.height = Math.max(32, e.target.scrollHeight) + "px"; scheduleSave("trainings", t.id); });
  $("tTitle").addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); e.currentTarget.blur(); } });
  for (const ev of ["focus", "blur"]) $("tTitle").addEventListener(ev, (e) => { const el = e.currentTarget; requestAnimationFrame(() => { el.style.height = "auto"; el.style.height = Math.max(32, el.scrollHeight) + "px"; }); });   // the box changes its padding on focus: measured again so the letters are never clipped and no gap is left behind
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
  function setSkipped(skipped, reason) {                               // asked first (the sheet); the workout stays on screen, marked Skipped, with Undo
    const t = trainings.get(S.view.id); if (!t) return;
    t.skippedAt = skipped ? now() : null; t.missed = false; touchState(t.id, "skippedAt", "missed", "skipReason");   // a person decided: never filed by itself again
    if (skipped && reason) t.skipReason = reason; else delete t.skipReason;
    if (S.clientMode) { pendingSkip.add(t.id); pendingMiss.add(t.id); }
    scheduleSave("trainings", t.id); paintFinish(t); S.renderedTraining = null; render();
  }
  let sk = null;                                                       // the skip sheet: { t, reason }
  function openSkip() {
    const t = trainings.get(S.view.id); if (!t) return; sk = { t, reason: "" }; S.asking = true;
    for (const b of $("skReasons").querySelectorAll("button")) { b.classList.remove("on"); b.setAttribute("aria-pressed", "false"); }
    $("skipSheet").hidden = false; setTimeout(() => { if (sk) $("skGo").focus({ preventScroll: true }); }, 0);
  }
  function closeSkip() { $("skipSheet").hidden = true; sk = null; S.asking = false; }
  $("skGo").addEventListener("click", () => { if (!sk) return; const reason = sk.reason; closeSkip(); setSkipped(true, reason); });
  $("skKeep").addEventListener("click", closeSkip);
  $("skipSheet").addEventListener("click", (e) => { if (e.target === $("skipSheet")) closeSkip(); });
  $("skReasons").addEventListener("click", (e) => {
    const b = e.target.closest("button"); if (!b || !sk) return;
    const on = !b.classList.contains("on");                          // tap again to clear
    for (const x of $("skReasons").querySelectorAll("button")) { x.classList.toggle("on", on && x === b); x.setAttribute("aria-pressed", String(on && x === b)); }
    sk.reason = on ? b.dataset.reason : "";
  });
  $("skipBtn").addEventListener("click", openSkip);
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
  $("tplFill").addEventListener("click", () => { const t = trainings.get(S.view.id); if (!t) return; fillFor = t.id; pickFor = t.clientId; nav.pickDepth = nav.depth; if (!clients.has(TEMPLATES_ID)) { clients.set(TEMPLATES_ID, { id: TEMPLATES_ID, name: "Templates", notes: "", email: "", unit: "lb", createdAt: now(), kind: "templates" }); scheduleSave("clients", TEMPLATES_ID, 0); } go({ name: "client", id: TEMPLATES_ID, program: null, phase: null, stage: null }); });
  $("useBtn").addEventListener("click", () => {
    const t = trainings.get(S.view.id); if (!t) return;
    const ul = $("usePick"); if (!ul.hidden) { ul.hidden = true; return; }
    const people = peopleList(); if (lastUse.client) { const i = people.findIndex((c) => c.id === lastUse.client); if (i > 0) people.unshift(people.splice(i, 1)[0]); }
    ul.replaceChildren(...people.map((c) => { const li = document.createElement("li"); const b = document.createElement("button"); b.type = "button"; b.innerHTML = "<span></span><span class=\"sub\"></span>"; b.firstChild.textContent = c.name || "Unnamed"; b.lastChild.textContent = c.id === lastUse.client ? "last used" : ""; b.lastChild.insertAdjacentHTML("beforeend", '<span class="chev">\u203a</span>'); b.addEventListener("click", () => openDatePicker({ clientId: c.id, title: "Add to " + (c.name || "client"), onPick: (date) => applyTemplate(trainings.get(t.id) || t, c.id, date) })); li.appendChild(b); return li; }));
    if (!people.length) { const li = document.createElement("li"); li.className = "empty"; li.style.padding = "12px 16px"; li.textContent = "Add a client first."; ul.appendChild(li); }
    ul.hidden = false;
  });
  $("delTraining").addEventListener("click", async () => { const t = trainings.get(S.view.id); if (!t) return; const tpl = isTemplateClient(t.clientId); if (await askFirst({ title: tpl ? "Delete this template?" : "Delete this workout?", text: tpl ? "Workouts already made from it stay." : "It goes for good, with everything logged on it.", yes: "Delete" })) deleteTraining(S.view.id); });

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
    for (const t of ts) repairTimed(t);                                // compared, and later written, in the shape the app keeps: a backup from before the Time box carries a hold's seconds as a weight
    const changed = (map, kind, r) => { const here = map.get(r.id); return !here || dirty.has(key(kind, r.id)) || !seenAt.has(key(kind, r.id)) || canon(here) !== canon(r); };   // already here, the same, and known to the server: nothing to do, nothing to send
    const cs2 = cs.filter((c) => changed(clients, "clients", c)), ts2 = ts.filter((t) => changed(trainings, "trainings", t));
    const nC = cs2.filter((c) => !isTemplateClient(c.id)).length, nT = ts2.filter((t) => !isTemplateClient(t.clientId)).length, nTpl = ts2.length - nT, packs = cs2.some((c) => isTemplateClient(c.id));
    const parts = []; if (nC) parts.push(nC + (nC === 1 ? " client" : " clients")); if (nT) parts.push(nT + (nT === 1 ? " workout" : " workouts")); if (nTpl) parts.push(nTpl + (nTpl === 1 ? " template" : " templates")); if (packs) parts.push("the packages list");
    const rC = cs2.filter((c) => clients.has(c.id) && !isTemplateClient(c.id)).length, rT = ts2.filter((t) => trainings.has(t.id)).length, rP = cs2.some((c) => clients.has(c.id) && isTemplateClient(c.id)) ? 1 : 0;
    const total = cs2.length + ts2.length, replaces = rC + rT + rP;
    const what = parts.length > 1 ? parts.slice(0, -1).join(", ") + " and " + parts[parts.length - 1] : parts[0] || "";
    const who = replaces === total ? (total === 1 ? "It replaces" : "They replace") : replaces === 1 ? "1 of them replaces" : replaces + " of them replace";
    const incl = rT && rC ? ", logged sets, notes and plans included" : rT ? ", logged sets and all" : rC ? (rC === 1 ? ", notes and plan included" : ", notes and plans included") : "";   // what a replaced copy loses, by kind
    const text = total ? what + " from the file " + (total === 1 ? "goes" : "go") + " into the app." + (replaces ? " " + who + " a copy already here" + incl + "." : "") + " Everything else stays as it is." : "";
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
    applyRestore(plan); render();
  });

  // ---------- boot ----------
  Object.assign(ui, { $, setStatus, render: renderUnlessSwiping, relabeled, photosSynced: () => flushPhotos(), showProblem, showWaiting, loadCustomVideos, loadCustomNames, loadCustomSubs, loadHidden, offlineFromMirror, resumeOnline, paintDraftBar, seedTemplates });   // what the sync layer may call on the screens
  function watchReleases(mine) {               // a page iOS keeps alive for days still gets the next release: on coming back to the app, never mid-tap, mid-sheet or mid-typing
    const sw = navigator.serviceWorker; if (!mine || !sw || !sw.addEventListener) return;
    let newest = 0;
    let resumedAt = 0;
    const busy = () => S.asking || /^(INPUT|TEXTAREA)$/.test((document.activeElement || {}).tagName || "") || !!(S.templateDraft && S.templateDraft.dirty && S.view.name === "training" && S.view.id === S.templateDraft.id) || (settingsOpen === "exercise" && exDirty()) || !!(S.view.name === "client" && noteDraft.get(S.view.id)) || [...cardNoteDraft.keys()].some((k) => k.startsWith(String(S.renderedTraining) + "/")) || !!(document.querySelector(".sheet-bg:not([hidden])"));   // a sheet, typing, or something unsaved on the page on screen: no reload now
    const settle = () => { if (newest > mine && !busy()) location.reload(); };
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
      fns: { boot, clientNews, markWorkoutsSeen, addTraining, newWorkoutHere, dayList, dayWords, byMade, showExercise, saveExercise, leaveSettings, paintTrainerMsg, startExerciseNow, navState: () => ({ key: nav.curKey, depth: nav.depth, waits: nav.waits.length, shots: shotByKey.size, state: stateDepth() }), forceSwipe: (on) => { swipeOn = !!on; }, dropShots: () => shotByKey.clear(), shotKeys: () => [...shotByKey.keys()], swipeState: () => (sw ? { on: sw.on, busy: !!sw.busy, held: !!sw.held, shot: !!sw.shot, glassOut: (sw.glassOut || []).map((e) => e && e.id), glassIn: (sw.glassIn || []).map((e) => e && e.id) } : null), goBackNow, backKey, openHistoryPage, openFromHistory, deleteTraining, springEase, initials, photoFor, setPhoto, loadPhoto, crop, flushPhotos, resetPhotos, forgetPhoto, loadPhotoQueue, photoQueue, packageOf, renameExercise, deleteExercise, addCustomName, loadHidden, loadCustomSubs, saveSub, deleteSub, subtitleFor, refreshNames, allNames: () => ALL_NAMES.slice(), knownName, videoForName, exerciseMatches, properName, overviewCounts, loggedExercises, syncDownNow, fetchAll, mergeDown, cloudBackend, clientBackend, localBackend, flushOne, scheduleSave, markDirty, persistPending, restorePending, freshRow, isEmptyWorkout, effDate, clientTrainings, lastWeights, setsOf, groupKey, noteEntries, packNotes, mergeNotes: (a, b) => mergeNotes(a, b, deletedNotes), planRestore, applyRestore, validateBackup: (d) => validateBackup(d, (id) => clients.has(id)), buildReport: (kind, fonts, c) => buildReport(kind, fonts, c, clientTrainings(c.id)), reportRange, parseTtf, pdfDoc, today, localIso, uid, key, setFinished, setSkipped, touchState, isTemplateClient, addTraining, render, setStatus },
      maps: { hiddenKeys, customNames, customVideos, customSubs, clients, trainings, dirty, seenAt, seenDoc, confirmedAt, timers, chains, trainerState, trainerTouched, trainerNamed, trainerNoted, pendingWeightRows, pendingDoneRows, pendingEarlyRows, pendingFinish, pendingSkip, pendingMove, pendingMiss, pendingSwap, pendingOrder, pendingNoteRows, planTouched, deletedNotes, deletedPackages, fromFile },
      get: () => ({ ...S }),
      set: (o) => { Object.assign(S, o); },
      reset: () => { resetState(); seenDoc.clear(); localStorage.clear(); },
      wake: () => ({ held: !!wake, timer: !!wakeTimer }),
    };
  }
  export { boot };
