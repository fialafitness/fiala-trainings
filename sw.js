// Fiala Trainings — offline shell.
// Every deploy is a release, numbered by the page's own main.js?v=N. A release lives whole in its own cache, written
// complete or not at all: a failed write removes only that release and never touches one already on the device.
// A page runs together with the scripts of ITS release for as long as it is open, even if a newer release landed
// meanwhile (another page, a later open). The newest complete release on the device is what an open gets when the
// server is slow or away, and "newest" only ever moves forward: a slow download of an older deploy never replaces
// a newer one. A deploy landing in the middle of a download is caught (the page is checked again at the end) and
// the open falls back to the device. Fonts, icons and the library are kept apart and refreshed quietly. API calls
// are never cached.
const META = "fiala-meta", ASSETS = "fiala-assets", REL = "fiala-rel-";
const PAGE = "./index.html";
const BUNDLE = [PAGE, "./app/main.js", "./app/catalog.js", "./app/util.js", "./app/model.js", "./app/notes.js", "./app/pdf.js", "./app/report.js", "./app/state.js", "./app/sync.js", "./templates.json"];
const EXTRAS = ["./manifest.webmanifest", "./icon-192.png", "./icon-512.png", "./apple-touch-icon.png", "./favicon.ico", "./fonts/Inter-Regular.ttf", "./fonts/Inter-Bold.ttf"];
// keep LIB identical to the <script src> in index.html
const LIB = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.2/dist/umd/supabase.min.js";
const FONTS = "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap";
const WAIT = 3500;                                                // how long an open waits for the whole release before the device copy stands in
const KEEP = 2;                                                   // releases kept on the device: the newest, and the one before it for pages still running on it

const relName = (n) => REL + n;
const releaseOf = async (pageRes) => { const m = /main\.js\?v=(\d+)/.exec(await pageRes.clone().text()); return m ? Number(m[1]) : 0; };
async function metaGet(k) { const c = await caches.open(META); const r = await c.match(k); return r ? Number(await r.text()) || 0 : 0; }
async function metaSet(k, n) { const c = await caches.open(META); await c.put(k, new Response(String(n))); }
const current = () => metaGet("/current");
async function hasRelease(n) {                                      // complete on the device: every file of the bundle
  if (!n || !(await caches.has(relName(n)))) return false;
  const c = await caches.open(relName(n));
  for (const url of BUNDLE) if (!(await c.match(url))) return false;
  return true;
}
async function storeRelease(n, bundle) {                            // whole or nothing: a write the device refuses removes this release only
  const name = relName(n), c = await caches.open(name);
  try { await Promise.all([...bundle].map(([url, res]) => c.put(url, res.clone()))); return true; }
  catch { await caches.delete(name); return false; }
}
async function prune() {                                            // the newest KEEP releases stay; the old single-cache shell goes
  const ns = (await caches.keys()).filter((k) => k.startsWith(REL)).map((k) => Number(k.slice(REL.length)) || 0).sort((a, b) => b - a);
  for (const n of ns.slice(KEEP)) await caches.delete(relName(n));
  if (ns.length) for (const k of await caches.keys()) if (k.startsWith("fiala-shell-")) await caches.delete(k);   // the old single-cache shell goes only once a release of the new kind is on the device
}
async function takeIn(got) {                                        // a complete release onto the device (unless it is there already); the newest pointer moves forward only
  if (!got || !got.n) return false;
  if (!(await hasRelease(got.n)) && !(await storeRelease(got.n, got.bundle))) return false;
  if (got.n > (await current())) await metaSet("/current", got.n);
  await prune();
  return true;
}
async function fetchBundle() {                                      // every file, checked with the server and downloaded in full: all or nothing, and all from ONE deploy
  const res = await Promise.all(BUNDLE.map((url) => fetch(new Request(url, { cache: "no-cache" }))));   // the host lets browsers keep files for 10 minutes: always ask it
  if (!res.every((r) => r && r.ok)) throw new Error("bundle incomplete");
  await Promise.all(res.map((r) => r.clone().arrayBuffer()));      // the whole download: "in time" means ready to use, and a drop half-way fails the bundle, never the open
  const bundle = new Map(BUNDLE.map((url, i) => [url, res[i]]));
  const n = await releaseOf(bundle.get(PAGE)); if (!n) throw new Error("no release number");
  const again = await fetch(new Request(PAGE, { cache: "no-cache" }));   // a deploy may have landed between the first file and the last: the page must still be the same release
  if (!again.ok || (await releaseOf(again)) !== n) throw new Error("deploy in progress");
  return { n, bundle };
}
const pin = (event, n) => (event.resultingClientId ? metaSet("/client/" + event.resultingClientId, n) : Promise.resolve());   // this page runs on release n for as long as it is open
async function check() {                                           // a page asks on resume: the server's page first (cheap, usually unchanged), the whole release only when it is newer than the device's
  const page = await fetch(new Request(PAGE, { cache: "no-cache" }));
  if (page.ok && (await releaseOf(page)) > (await current())) await takeIn(await fetchBundle());
}

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    try { await takeIn(await fetchBundle()); } catch {}               // the app itself, whole, or nothing changes on the device
    const a = await caches.open(ASSETS);
    await Promise.allSettled([...EXTRAS, LIB, FONTS].map(async (url) => { if (!(await a.match(url))) await a.add(new Request(url, { cache: "reload" })); }));   // nice to have offline; what is there already is refreshed quietly at use
    await self.skipWaiting();
  })());
});

self.addEventListener("message", (event) => {                   // a page kept alive for days (iOS keeps the app open) asks whether a newer release is in: the answer is the newest on the device
  if (!event.data || event.data.type !== "check" || !event.source) return;
  event.waitUntil((async () => { try { await check(); } catch {} event.source.postMessage({ type: "release", current: await current() }); })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => { await prune(); await self.clients.claim(); })());
});

const BUNDLE_URLS = new Set(BUNDLE.map((rel) => new URL(rel, self.location.href).href));
const isApi = (url) => /\.supabase\.co$/.test(url.hostname);
const isShellPage = (url) => url.origin === self.location.origin && (url.pathname.endsWith("/") || url.pathname.endsWith("/index.html"));
const isBundleFile = (url) => BUNDLE_URLS.has(url.origin + url.pathname);   // whatever ?v= the page asked for: one copy per file per release
const isAsset = (url) => url.origin === self.location.origin || url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com" || url.href === LIB;

async function openShell(event) {
  const got = fetchBundle();
  const fresh = await Promise.race([got.catch(() => null), new Promise((r) => setTimeout(() => r(null), WAIT))]);
  if (fresh && fresh.n >= (await current())) {                       // the server's release, at least as new as the device's: the page and everything it loads, one deploy
    await takeIn(fresh); await pin(event, fresh.n);
    return fresh.bundle.get(PAGE);
  }
  event.waitUntil(got.then(takeIn).catch(() => {}));                 // too late for this open (or older than what the device holds): kept for the next, never moving the newest pointer back
  const n = await current();
  if (n) { const page = await (await caches.open(relName(n))).match(PAGE); if (page) { await pin(event, n); return page; } }
  return Response.error();
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (isApi(url)) return;                                   // live data only, never from cache

  if (req.mode === "navigate" && !isShellPage(url)) return;  // other pages on this origin: plain network
  if (isShellPage(url)) { event.respondWith(openShell(event)); return; }
  if (isBundleFile(url)) {                                  // the scripts and the templates: from the release the asking page runs on
    event.respondWith((async () => {
      const client = event.clientId ? await self.clients.get(event.clientId).catch(() => null) : null;
      if (client && !isShellPage(new URL(client.url))) return fetch(new Request(req, { cache: "no-cache" }));   // asked for by another page on this origin (a test copy): the network, checked with the server
      const n = (event.clientId ? await metaGet("/client/" + event.clientId) : 0) || (await current());
      const hit = n ? await (await caches.open(relName(n))).match(url.origin + url.pathname) : null;
      return hit || fetch(new Request(req, { cache: "no-cache" }));   // not on the device (a release pruned, a write refused): the server, which serves the newest deploy
    })());
    return;
  }

  if (isAsset(url)) {                                       // fonts, icons, the manifest, the library: cached copy now, refreshed in the background
    event.respondWith((async () => {
      const cache = await caches.open(ASSETS);
      const cached = await cache.match(req);
      const refresh = fetch(req).then((res) => { if (res && (res.ok || res.type === "opaque")) return cache.put(req, res.clone()).then(() => res); return res; }).catch(() => null);
      event.waitUntil(refresh);
      return cached || (await refresh) || Response.error();
    })());
  }
});
