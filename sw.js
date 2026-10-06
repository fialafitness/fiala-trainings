// Fiala Trainings — offline shell.
// The app page is fetched from the network when there is one (so updates land on the next open)
// and served from this cache when there is not. Fonts, icons, the templates and the Supabase
// library are kept on the device and refreshed quietly in the background. API calls are never cached.
const VERSION = "fiala-shell-v1";
const SHELL = ["./", "./index.html", "./manifest.webmanifest", "./icon-192.png", "./icon-512.png", "./apple-touch-icon.png", "./favicon.ico", "./templates.json"];
// keep LIB identical to the <script src> in index.html
const LIB = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.2/dist/umd/supabase.min.js";
const FONTS = "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap";

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(VERSION);
    await Promise.allSettled([...SHELL, LIB, FONTS].map((url) => cache.add(new Request(url, { cache: "reload" }))));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    for (const name of await caches.keys()) if (name !== VERSION) await caches.delete(name);
    await self.clients.claim();
  })());
});

const isApi = (url) => /\.supabase\.co$/.test(url.hostname);
const isShellPage = (url) => url.origin === self.location.origin && (url.pathname.endsWith("/") || url.pathname.endsWith("/index.html"));
const isAsset = (url) => url.origin === self.location.origin || url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com" || url.href === LIB;

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (isApi(url)) return;                                   // live data only, never from cache

  if (req.mode === "navigate" && !isShellPage(url)) return;  // other pages on this origin: plain network
  if (isShellPage(url)) {                                   // the app page: network first, but never wait long for it
    event.respondWith((async () => {
      const cache = await caches.open(VERSION);
      const net = fetch(req).then((fresh) => { if (fresh && fresh.ok) { cache.put("./index.html", fresh.clone()); cache.put("./", fresh.clone()); } return fresh; });
      const fresh = await Promise.race([net.catch(() => null), new Promise((r) => setTimeout(() => r(null), 3500))]);
      if (fresh && fresh.ok) return fresh;
      event.waitUntil(net.catch(() => {}));                 // let a slow fetch finish and refresh the cache in the background
      return (await cache.match("./index.html")) || (await cache.match("./")) || (fresh || net.catch(() => Response.error()));
    })());
    return;
  }

  if (isAsset(url)) {                                       // fonts, icons, templates, the library: cached copy now, refreshed in the background
    event.respondWith((async () => {
      const cache = await caches.open(VERSION);
      const cached = await cache.match(req);
      const refresh = fetch(req).then((res) => { if (res && (res.ok || res.type === "opaque")) return cache.put(req, res.clone()).then(() => res); return res; }).catch(() => null);
      event.waitUntil(refresh);
      return cached || (await refresh) || Response.error();
    })());
  }
});
