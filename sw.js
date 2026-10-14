// Fiala Trainings — offline shell.
// The page, the app's own scripts and the templates travel as ONE bundle: on every open the worker asks the
// server for all of them together and hands over the page only once the whole bundle is on the device, so a
// phone never runs one deploy's scripts against another deploy's page. When the server is slow or away, the
// open is served from the last complete bundle on the device, and a bundle that arrives too late is kept
// aside for the next open. Fonts, icons and the library are kept on the device and refreshed quietly.
// API calls are never cached.
const VERSION = "fiala-shell-v14";
const NEXT = VERSION + "-next";                                   // a complete bundle that arrived after its open was already served
const PAGE = "./index.html";
const BUNDLE = [PAGE, "./app/main.js", "./app/catalog.js", "./app/util.js", "./app/model.js", "./app/notes.js", "./app/pdf.js", "./app/report.js", "./app/state.js", "./app/sync.js", "./templates.json"];
const SHELL = [...BUNDLE, "./manifest.webmanifest", "./icon-192.png", "./icon-512.png", "./apple-touch-icon.png", "./favicon.ico", "./fonts/Inter-Regular.ttf", "./fonts/Inter-Bold.ttf"];
// keep LIB identical to the <script src> in index.html
const LIB = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.2/dist/umd/supabase.min.js";
const FONTS = "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap";
const WAIT = 3500;                                                // how long an open waits for the whole bundle before the device copy stands in

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(VERSION);
    const add = (url) => cache.add(new Request(url, { cache: "reload" }));
    if (await cache.match(PAGE)) {                                // same version, newer worker: add only what is missing, never touch what the running worker serves
      await Promise.all(SHELL.map(async (url) => { if (!(await cache.match(url))) await add(url); }));
    } else {                                                      // a new version fills its own cache, the page last: the page's presence means the rest is complete
      await Promise.all(SHELL.filter((url) => url !== PAGE).map(add));   // the app itself must be complete, or the old shell stays
      await add(PAGE);
    }
    await Promise.allSettled([LIB, FONTS].map(add));             // nice to have offline
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    for (const name of await caches.keys()) if (name.startsWith("fiala-shell-") && name !== VERSION && name !== NEXT) await caches.delete(name);
    await self.clients.claim();
  })());
});

const BUNDLE_URLS = new Set(BUNDLE.map((rel) => new URL(rel, self.location.href).href));
const isApi = (url) => /\.supabase\.co$/.test(url.hostname);
const isShellPage = (url) => url.origin === self.location.origin && (url.pathname.endsWith("/") || url.pathname.endsWith("/index.html"));
const isBundleFile = (url) => BUNDLE_URLS.has(url.origin + url.pathname);   // whatever ?v= the page asked for: one copy per file
const isAsset = (url) => url.origin === self.location.origin || url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com" || url.href === LIB;

let opens = 0, liveFrom = 0;                                      // which open last put a fresh bundle on the device: a slower open's late bundle must not undo it

async function fetchBundle() {                                     // every file, checked with the server and downloaded in full: all or nothing
  const res = await Promise.all(BUNDLE.map((url) => fetch(new Request(url, { cache: "no-cache" }))));   // the host lets browsers keep files for 10 minutes: always ask it
  if (!res.every((r) => r && r.ok)) throw new Error("bundle incomplete");
  await Promise.all(res.map((r) => r.clone().arrayBuffer()));      // the whole download: "in time" means ready to use, and a drop half-way fails the bundle, never the open
  return new Map(BUNDLE.map((url, i) => [url, res[i]]));
}
const etag = (res) => res.headers.get("etag") || "";
async function unchanged(cache, bundle) {                          // the server said "same as before" for every file: nothing to write
  for (const [url, res] of bundle) { const have = await cache.match(url); if (!etag(res) || !have || etag(have) !== etag(res)) return false; }
  return true;
}
const store = (cache, bundle) => Promise.all([...bundle].map(([url, res]) => cache.put(url, res.clone())));
async function storeLive(bundle) {                                 // onto the device whole, or off it entirely: never a mix
  const live = await caches.open(VERSION);
  try { await store(live, bundle); }
  catch { await Promise.all(BUNDLE.map((url) => live.delete(url).catch(() => {}))); }   // the device refused (full?): the scripts then come from the server, like the page just did
}
async function promote() {                                         // a bundle kept aside for this open becomes the one to serve; a half one is thrown away
  if (!(await caches.has(NEXT))) return;
  const next = await caches.open(NEXT);
  const files = await Promise.all(BUNDLE.map((url) => next.match(url)));
  if (files.every(Boolean)) await storeLive(new Map(BUNDLE.map((url, i) => [url, files[i]])));
  await caches.delete(NEXT);
}
async function openShell(event) {
  const seq = ++opens;
  await promote();
  const live = await caches.open(VERSION);
  const bundle = fetchBundle();
  const fresh = await Promise.race([bundle.catch(() => null), new Promise((r) => setTimeout(() => r(null), WAIT))]);
  if (fresh) {                                                     // the page and everything it loads: one deploy
    liveFrom = seq;
    if (!(await unchanged(live, fresh))) { await storeLive(fresh); await caches.delete(NEXT); }
    return fresh.get(PAGE);
  }
  event.waitUntil(bundle.then(async (b) => { if (liveFrom > seq) return; await store(await caches.open(NEXT), b); }).catch(() => {}));   // too late for this open: kept for the next, unless a later open already brought a fresher one
  return (await live.match(PAGE)) || Response.error();
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (isApi(url)) return;                                   // live data only, never from cache

  if (req.mode === "navigate" && !isShellPage(url)) return;  // other pages on this origin: plain network
  if (isShellPage(url)) { event.respondWith(openShell(event)); return; }
  if (isBundleFile(url)) {                                  // the scripts and the templates: from the bundle this open brought along
    event.respondWith((async () => {
      const client = event.clientId ? await self.clients.get(event.clientId).catch(() => null) : null;
      if (client && !isShellPage(new URL(client.url))) return fetch(new Request(req, { cache: "no-cache" }));   // asked for by another page on this origin (a test copy): the network, checked with the server
      return (await (await caches.open(VERSION)).match(url.origin + url.pathname)) || fetch(req);
    })());
    return;
  }

  if (isAsset(url)) {                                       // fonts, icons, the manifest, the library: cached copy now, refreshed in the background
    event.respondWith((async () => {
      const cache = await caches.open(VERSION);
      const cached = await cache.match(req);
      const refresh = fetch(req).then((res) => { if (res && (res.ok || res.type === "opaque")) return cache.put(req, res.clone()).then(() => res); return res; }).catch(() => null);
      event.waitUntil(refresh);
      return cached || (await refresh) || Response.error();
    })());
  }
});
