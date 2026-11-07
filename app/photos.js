// Profile photos: one per client, set by the coach or by the client herself; whoever changes it last, that is the photo.
// The picture lives in Supabase Storage (the private bucket "photos", at "<clientId>/<version>.jpg"); the client record
// carries only the version (data.photo), so the once-a-minute sync stays as light as before. A photo is cut to a square and
// shrunk on the phone to 256 pixels (about 20 KB) before it is saved. Seen once, it is kept in the browser's Cache Storage,
// so it is not fetched again. A photo taken without signal waits in a small queue on the phone and goes up when the signal
// returns: the file first, the marker after, so nobody is ever pointed at a file that is not there yet.
import { lsGet, lsSet } from "./util.js";
import { S, ui, clients, confirmedAt } from "./state.js";
import { scheduleSave, localBackend, withTimeout, isOffline } from "./sync.js";

const BUCKET = "photos", QKEY = "fiala.photos.pending", CACHE = "fiala-photos";
const queue = new Map();                  // clientId -> { v, data: data URL | null (removed), old, up, gone: [versions uploaded and replaced] }
let qOwner = "";                          // whose queue this is: another account signing in on the phone starts clean
let trash = [];                           // file paths still to remove from the server (a removal that met no signal is tried again)
let purge = [];                           // deleted clients whose whole folder still has to go
let epoch = 0;                            // bumped at sign-out: a download or a save still on its way then lands nowhere
const urls = new Map();                   // "clientId/version" -> an address the <img> can show (object URL or data URL)
const loading = new Map();                // "clientId/version" -> the download in flight
const failedAt = new Map();               // "clientId/version" -> when it last could not be had (not asked again for a minute)

export function loadPhotoQueue() {        // what is still waiting on this phone (a relaunch keeps it)
  queue.clear(); const p = lsGet(QKEY);
  if (p && p.items && typeof p.items === "object") for (const [k, e] of Object.entries(p.items)) if (e && typeof e === "object" && (e.v === null || typeof e.v === "string")) queue.set(k, e);
  qOwner = (p && typeof p.owner === "string") ? p.owner : "";
  trash = Array.isArray(p && p.trash) ? p.trash.filter((x) => typeof x === "string") : [];
  purge = Array.isArray(p && p.purge) ? p.purge.filter((x) => typeof x === "string") : [];
}
const saveQueue = () => lsSet(QKEY, { owner: qOwner, items: Object.fromEntries(queue), trash, purge });
const toTrash = (cid, vs) => { for (const v of vs) if (typeof v === "string" && v) { const p = pathOf(cid, v); if (!trash.includes(p)) trash.push(p); } };
export const photoQueue = () => queue;
loadPhotoQueue();

export function initials(name) {          // Apple Contacts' monogram: the first letters of the first and the last word
  const w = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (!w.length) return "";
  const first = [...w[0]][0] || "", last = w.length > 1 ? ([...w[w.length - 1]][0] || "") : "";
  return (first + last).toUpperCase();
}
const newVersion = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const pathOf = (cid, v) => cid + "/" + v + ".jpg";
const isMissing = (e) => /bucket not found|row-level security|not authorized|unauthorized/i.test(String((e && (e.message || e.error)) || "")) || String(e && e.statusCode) === "403";   // the script has not been run yet

async function toDataUrl(blob) {
  const b = new Uint8Array(await blob.arrayBuffer()); let s = "";
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000));
  return "data:" + (blob.type || "image/jpeg") + ";base64," + btoa(s);
}
function fromDataUrl(u) {
  const [head, b64] = String(u).split(","); const type = (head.match(/^data:([^;,]+)/) || [])[1] || "image/jpeg";
  const bin = atob(b64 || ""), a = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i);
  return new Blob([a], { type });
}

// ---------- kept on the phone ----------
const hasCaches = () => typeof caches !== "undefined" && caches && typeof caches.open === "function";
const cacheKey = (cid, v) => new URL("./__photos/" + pathOf(cid, v), location.href).href;   // a name in the cache only; nothing ever fetches it
async function cacheGet(cid, v) { try { if (!hasCaches()) return null; const r = await (await caches.open(CACHE)).match(cacheKey(cid, v)); return r ? await r.blob() : null; } catch { return null; } }
async function cachePut(cid, v, blob, ep = epoch) {
  try {
    if (!hasCaches() || ep !== epoch) return; const c = await caches.open(CACHE), folder = new URL("./__photos/" + cid + "/", location.href).href;
    if (ep !== epoch) return;                                                       // signed out while the cache opened: nothing goes in
    for (const req of await c.keys()) if (req.url.startsWith(folder) && req.url !== cacheKey(cid, v)) await c.delete(req);   // the version it replaces goes
    if (ep !== epoch) return;
    await c.put(cacheKey(cid, v), new Response(blob, { headers: { "content-type": "image/jpeg" } }));
  } catch {}
}
const objectUrl = async (blob) => (typeof URL !== "undefined" && typeof URL.createObjectURL === "function" ? URL.createObjectURL(blob) : toDataUrl(blob));
function remember(cid, v, src) {          // one address per client in memory: the version it replaces is let go
  for (const k of [...urls.keys()]) if (k.startsWith(cid + "/") && k !== cid + "/" + v) { const u = urls.get(k); urls.delete(k); if (typeof u === "string" && u.startsWith("blob:") && typeof URL !== "undefined" && URL.revokeObjectURL) URL.revokeObjectURL(u); }
  urls.set(cid + "/" + v, src);
}

// ---------- what to show ----------
export function photoFor(cid) {           // { v, src } when this client has a photo (src null while it still has to be fetched), or null
  const q = queue.get(cid);
  if (q) return q.v && q.data ? { v: q.v, src: q.data } : null;   // waiting to go up: shown already; a removal: the initials
  const c = clients.get(cid), v = c && typeof c.photo === "string" && c.photo ? c.photo : "";
  return v ? { v, src: urls.get(cid + "/" + v) || null } : null;
}
export function loadPhoto(cid, v) {        // the photo's address on this phone: from memory, from the phone's cache, or from the server once
  const k = cid + "/" + v;
  if (urls.has(k)) return Promise.resolve(urls.get(k));
  if (loading.has(k)) return loading.get(k);
  if (Date.now() - (failedAt.get(k) || 0) < 60000) return Promise.resolve(null);
  const ep = epoch;
  const p = (async () => {
    let blob = await cacheGet(cid, v);
    if (!blob && S.sb && S.sb.storage && S.signedIn) {
      try { const { data, error } = await withTimeout(S.sb.storage.from(BUCKET).download(pathOf(cid, v)), 15000); if (!error && data) { blob = data; cachePut(cid, v, blob, ep); } } catch {}
    }
    if (ep !== epoch) return null;                                      // signed out meanwhile: the photo is not kept
    if (!blob) { failedAt.set(k, Date.now()); return null; }
    const src = await objectUrl(blob); if (ep !== epoch) return null; remember(cid, v, src); return src;
  })().finally(() => { if (loading.get(k) === p) loading.delete(k); });
  loading.set(k, p); return p;
}

let io = null; const waiting = new WeakMap();
function whenSeen(el, go) {               // a long list fetches only what scrolls into view
  if (typeof IntersectionObserver === "undefined") { go(); return; }
  if (!io) io = new IntersectionObserver((es) => { for (const e of es) { if (!e.target.isConnected) { io.unobserve(e.target); waiting.delete(e.target); continue; } if (!e.isIntersecting) continue; io.unobserve(e.target); const f = waiting.get(e.target); waiting.delete(e.target); if (f) f(); } }, { rootMargin: "200px 0px" });
  waiting.set(el, go); io.observe(el);
}
export function paintAvatar(el, cid, name, lazy) {   // the circle: initials at once, the photo fading in over them when it is here
  if (!el) return;
  const ini = initials(name), shown = photoFor(cid), want = shown ? shown.v : "";
  if (el.dataset.cid === String(cid) && el.dataset.v === want && el.dataset.ini === ini) return;   // already showing this
  el.dataset.cid = String(cid); el.dataset.v = want; el.dataset.ini = ini;
  el.classList.remove("has"); el.replaceChildren(); el.textContent = ini;
  if (!shown) return;
  const put = (src, now) => {
    if (el.dataset.cid !== String(cid) || el.dataset.v !== want) return;   // the circle moved on meanwhile
    if (!src) { el.dataset.v = ""; return; }                               // not here this time: the next paint asks again (no sooner than a minute)
    const img = document.createElement("img"); img.alt = ""; img.decoding = "async"; img.draggable = false;
    if (now) el.classList.add("has"); else img.addEventListener("load", () => el.classList.add("has"));   // a photo already on the phone is simply there; only one arriving fades in
    img.src = src; el.appendChild(img);
  };
  if (shown.src) { put(shown.src, true); return; }
  const go = () => { loadPhoto(cid, want).then((s) => put(s, false)); };
  if (lazy) whenSeen(el, go); else go();
}

// ---------- cutting the picture ----------
export async function squarePhoto(file, size = 256) {   // a square from the middle (a little high on a portrait, where a face is), 256 px, JPEG
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error("unreadable")); i.src = url; });
    const w = img.naturalWidth, h = img.naturalHeight; if (!w || !h) throw new Error("unreadable");
    const side = Math.min(w, h), sx = (w - side) / 2, sy = h > w ? (h - side) * 0.3 : 0;
    let cv = document.createElement("canvas"), cur = Math.min(side, size * 4);   // first a square at most four times the size, then halved: no grain from one big jump
    cv.width = cv.height = cur; let ctx = cv.getContext("2d"); ctx.imageSmoothingQuality = "high"; ctx.drawImage(img, sx, sy, side, side, 0, 0, cur, cur);
    while (cur / 2 >= size) { const nx = document.createElement("canvas"); nx.width = nx.height = Math.round(cur / 2); const c2 = nx.getContext("2d"); c2.imageSmoothingQuality = "high"; c2.drawImage(cv, 0, 0, nx.width, nx.height); cv = nx; cur = nx.width; }
    const out = document.createElement("canvas"); out.width = out.height = size; ctx = out.getContext("2d"); ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, size, size); ctx.imageSmoothingQuality = "high"; ctx.drawImage(cv, 0, 0, size, size);
    const blob = await new Promise((res) => out.toBlob(res, "image/jpeg", 0.82));
    if (!blob) throw new Error("unreadable");
    return blob;
  } finally { URL.revokeObjectURL(url); }
}

// ---------- changing it ----------
export async function setPhoto(cid, blob) {   // blob: the new square JPEG, or null to remove the photo
  const c = clients.get(cid); if (!c) return;
  const ep = epoch, prev = queue.get(cid);
  const old = prev ? prev.old : (typeof c.photo === "string" && c.photo ? c.photo : null);   // the file the record points at on the server now
  const gone = [...((prev && prev.gone) || []), ...(prev && prev.up && prev.v ? [prev.v] : [])];   // a newer pick replaces one already sent: that file goes too
  const v = blob ? newVersion() : null, data = blob ? await toDataUrl(blob) : null;
  if (ep !== epoch) return;                                            // signed out while the picture was being read
  queue.set(cid, { v, data, old, up: false, gone: [...gone, ...((queue.get(cid) || {}).gone || [])].filter((x, i, a) => a.indexOf(x) === i) });
  if (!qOwner) qOwner = S.sessionEmail || ""; saveQueue();
  if (blob && v) { remember(cid, v, data); cachePut(cid, v, blob, ep); }
  flushPhotos();
}
export function forgetPhoto(cid) {        // the client is deleted: her whole photo folder goes from the server (tried again until it is gone) and from the phone
  queue.delete(cid); if (!purge.includes(cid)) purge.push(cid); trash = trash.filter((p) => !p.startsWith(cid + "/")); saveQueue();
  flushPhotos();
}
export async function resetPhotos() {     // signed out: nothing of this account's photos stays on the phone
  epoch++; loading.clear();                                              // a download or a pick still on its way lands nowhere
  queue.clear(); qOwner = ""; trash = []; purge = []; saveQueue();
  for (const u of urls.values()) if (typeof u === "string" && u.startsWith("blob:") && typeof URL !== "undefined" && URL.revokeObjectURL) URL.revokeObjectURL(u);
  urls.clear(); failedAt.clear();
  try { if (hasCaches()) await caches.delete(CACHE); } catch {}
}

let flushing = null, again = false;
export function flushPhotos() {           // one pass at a time; a pick made during a pass gets a pass of its own right after
  if (flushing) { again = true; return flushing; }
  flushing = (async () => { let ok; do { again = false; ok = await sendAll().catch(() => false); } while (again && ok && !S.photoMissing); })().finally(() => { flushing = null; });   // a pass stopped by no signal is not repeated at once
  return flushing;
}
async function mark(cid, v) {             // the record learns the new version (or that there is none)
  const c = clients.get(cid);
  if (!S.clientMode) {                    // the coach writes the record himself: a save like any other edit (queued, merged, retried)
    if (!c) return "gone";
    if (v) c.photo = v; else delete c.photo;
    localBackend.save(); scheduleSave("clients", cid);                // the device copy knows the new photo before the old file is removed
    return true;
  }
  const { error } = await withTimeout(S.sb.rpc("client_set_photo", { p_client: cid, p_photo: v || null }), 15000);
  if (error) {
    if (error.code === "PGRST202" || /client_set_photo/.test(error.message || "")) return "missing";
    if (error.code === "P0001") return "gone";
    return false;
  }
  if (c) { if (v) c.photo = v; else delete c.photo; localBackend.save(); }
  confirmedAt.set("clients/" + cid, Date.now());   // a read that began before this landed must not bring the old photo back
  return true;
}
async function sendAll() {
  if (qOwner && S.sessionEmail && qOwner !== S.sessionEmail) { queue.clear(); trash = []; purge = []; qOwner = ""; saveQueue(); return true; }   // another account's leftovers are not sent as this one
  if (!S.sb || !S.sb.storage || !S.signedIn) return false;
  const store = S.sb.storage.from(BUCKET);
  if (!S.clientMode) for (const cid of [...purge]) {                   // deleted clients: everything in the folder, whatever this phone knew of it
    let res; try { res = await withTimeout(store.list(cid, { limit: 1000 }), 15000); } catch (err) { res = { error: err }; }
    if (res.error) { if (isOffline(res.error)) return false; purge = purge.filter((x) => x !== cid); saveQueue(); continue; }
    const names = (res.data || []).map((o) => o && o.name).filter(Boolean);
    if (names.length) { let r; try { r = await withTimeout(store.remove(names.map((n) => cid + "/" + n)), 15000); } catch (err) { r = { error: err }; } if (r.error && isOffline(r.error)) return false; }
    purge = purge.filter((x) => x !== cid); saveQueue();
  }
  if (trash.length) {                                                   // files no record points at any more
    const batch = trash.slice(); let r; try { r = await withTimeout(store.remove(batch), 15000); } catch (err) { r = { error: err }; }
    if (r.error && isOffline(r.error)) return false;
    trash = trash.filter((p) => !batch.includes(p)); saveQueue();       // done, or refused for good (a client may not remove what is not hers)
  }
  for (const cid of [...queue.keys()]) {
    if (!S.sb || !S.sb.storage || !S.signedIn || S.photoMissing) return false;
    const e = queue.get(cid); if (!e) continue;
    if (!S.clientMode && S.syncedOnce && !clients.has(cid)) { queue.delete(cid); toTrash(cid, [e.up && e.v, ...(e.gone || [])]); saveQueue(); continue; }   // the client was deleted meanwhile
    if (e.v && e.data && !e.up) {
      let res; try { res = await withTimeout(store.upload(pathOf(cid, e.v), fromDataUrl(e.data), { upsert: true, contentType: "image/jpeg", cacheControl: "31536000" }), 20000); } catch (err) { res = { error: err }; }
      if (res && res.error) {
        if (!isOffline(res.error) && isMissing(res.error)) { S.photoMissing = true; if (!S.clientMode && ui.$) ui.$("status").textContent = "Run supabase/client-photos.sql first"; }
        return false;                           // no signal, or no photo folder yet: it waits on the phone
      }
      const now = queue.get(cid);
      if (now !== e) { if (now) now.gone = [...(now.gone || []), e.v]; else toTrash(cid, [e.v]); saveQueue(); continue; }   // replaced (or the client deleted) while it was going up: this file goes too
      e.up = true; saveQueue();
    }
    const ok = await mark(cid, e.v);
    if (ok === "missing") { S.photoMissing = true; return false; }
    if (ok === "gone") { if (queue.get(cid) === e) queue.delete(cid); toTrash(cid, [e.v, ...(e.gone || [])]); saveQueue(); continue; }   // refused for good: the server's photo comes back with the next sync; what was sent goes
    if (!ok) return false;
    if (queue.get(cid) === e) { queue.delete(cid); saveQueue(); }
    const tidy = [e.old, ...(e.gone || [])].filter((x) => typeof x === "string" && x && x !== e.v);
    if (tidy.length) {                                                   // the files no record points at any more; tried again later when there is no signal
      let r; try { r = await withTimeout(store.remove(tidy.map((v) => pathOf(cid, v))), 15000); } catch (err) { r = { error: err }; }
      if (r.error && isOffline(r.error)) { toTrash(cid, tidy); saveQueue(); }
    }
    if (ui.render) ui.render();
  }
  return true;
}

if (typeof window !== "undefined" && window.addEventListener) window.addEventListener("online", () => { S.photoMissing = false; flushPhotos(); });
