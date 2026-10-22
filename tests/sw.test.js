// The service worker, driven in Node with a stand-in for the browser: a fake server, fake caches that read
// bodies like the real ones, fake clients. Every open must leave the phone with a page and scripts from ONE
// deploy, whatever the network does.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test, assert } from "./assert.js";
const src = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "sw.js"), "utf8");
const ORIGIN = "https://app.test", SW_URL = ORIGIN + "/sw.js", META = "fiala-meta", ASSETS = "fiala-assets", REL = "fiala-rel-";
const FILES = ["/index.html", "/app/main.js", "/app/catalog.js", "/app/util.js", "/app/model.js", "/app/notes.js", "/app/pdf.js", "/app/report.js", "/app/state.js", "/app/sync.js", "/templates.json", "/manifest.webmanifest", "/icon-192.png", "/icon-512.png", "/apple-touch-icon.png", "/favicon.ico", "/fonts/Inter-Regular.ttf", "/fonts/Inter-Bold.ttf"];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function makeWorker() {
  const server = { version: 1, delay: 0, bodyDelay: 0, down: false, missing: new Set(), dieBody: null, etag: false, hits: [] };   // what app.test answers
  const device = { failPut: null, writes: 0 };                                                                                   // what the phone's storage does
  class Req extends Request { constructor(input, init) { super(typeof input === "string" ? new URL(input, SW_URL).href : input, init); } }
  const keyOf = (k) => new URL(typeof k === "string" ? k : k.url, SW_URL).href;          // exact, like the real Cache API: a query is another key
  const stores = new Map();
  const keep = async (m, key, r, name) => { const body = await r.arrayBuffer(); if (device.failPut && key.endsWith(device.failPut)) throw new Error("QuotaExceededError"); if (String(name).startsWith(REL)) device.writes++; m.set(key, new Response(body, { status: r.status, headers: r.headers })); };   // writes: release files only
  const cacheFor = (name) => { if (!stores.has(name)) stores.set(name, new Map()); const m = stores.get(name); return {
    put: (k, r) => keep(m, keyOf(k), r, name), match: async (k) => { const r = m.get(keyOf(k)); return r ? r.clone() : undefined; }, delete: async (k) => m.delete(keyOf(k)),
    add: async (req) => { const r = await fetchImpl(req); if (!r.ok) throw new Error("add failed " + keyOf(req)); await keep(m, keyOf(req), r, name); }, keys: async () => [...m.keys()] }; };
  const caches = { open: async (n) => cacheFor(n), has: async (n) => stores.has(n), keys: async () => [...stores.keys()], delete: async (n) => stores.delete(n) };
  const body = (text, delay, die) => new ReadableStream({ start(c) { setTimeout(() => { const enc = new TextEncoder(); if (die) { c.enqueue(enc.encode(text.slice(0, 3))); c.error(new TypeError("network dropped")); } else { c.enqueue(enc.encode(text)); c.close(); } }, delay); } });
  async function fetchImpl(input) {
    const url = new URL(typeof input === "string" ? input : input.url); server.hits.push(url.pathname);
    const { version, delay, bodyDelay, down, dieBody, etag } = server;                   // what the server was when the request left
    if (url.origin !== ORIGIN) return new Response("lib " + url.hostname, { status: 200 });
    if (delay) await sleep(delay);
    if (down) throw new TypeError("Failed to fetch");
    if (server.missing.has(url.pathname) || !FILES.includes(url.pathname)) return new Response("nope", { status: 404 });
    const text = url.pathname + " v" + version + (url.pathname === "/index.html" ? " main.js?v=" + version : "");   // the page names its release, like the real one
    return new Response(body(text, bodyDelay, dieBody === url.pathname), { status: 200, headers: etag ? { etag: 'W/"' + version + "-" + url.pathname + '"' } : {} });
  }
  const clientsById = { page: { url: ORIGIN + "/" }, pageA: { url: ORIGIN + "/" }, pageB: { url: ORIGIN + "/" }, copy: { url: ORIGIN + "/_test.html" } }; const listeners = {};
  const self = { addEventListener: (t, fn) => { listeners[t] = fn; }, skipWaiting: async () => {}, clients: { claim: async () => {}, get: async (id) => clientsById[id] }, location: { origin: ORIGIN, href: SW_URL } };
  const timer = (fn, ms) => setTimeout(fn, ms >= 1000 ? 60 : ms);        // the open's patience, shortened for the test
  new Function("self", "caches", "fetch", "Request", "Response", "URL", "setTimeout", src)(self, caches, fetchImpl, Req, Response, URL, timer);
  const run = async (type) => { const w = []; listeners[type]({ waitUntil: (p) => w.push(p) }); await Promise.all(w); };
  async function request(url, opts = {}) {
    const w = []; let out = null;
    const req = new Req(url, { method: opts.method || "GET" }); Object.defineProperty(req, "mode", { value: opts.mode || "cors" });
    listeners.fetch({ request: req, clientId: opts.clientId || "", resultingClientId: opts.mode === "navigate" ? (opts.resultingClientId || "page") : "", respondWith: (p) => { out = p; }, waitUntil: (p) => w.push(p) });
    const res = out ? await out : null;
    return { text: res && res.ok ? await res.text() : null, ok: !!(res && res.ok), handled: !!out, settle: () => Promise.allSettled(w) };
  }
  const rel = (n) => stores.get(REL + n);
  const relText = async (n, p) => { const r = rel(n) && rel(n).get(ORIGIN + p); return r ? r.clone().text() : null; };
  const current = async () => { const m = stores.get(META); const r = m && m.get(ORIGIN + "/current"); return r ? Number(await r.clone().text()) : 0; };
  const releases = () => [...stores.keys()].filter((k) => k.startsWith(REL)).map((k) => Number(k.slice(REL.length))).sort();
  return { server, device, stores, rel, relText, current, releases, install: () => run("install"), activate: () => run("activate"), request,
    open: (resultingClientId = "page") => request("./", { mode: "navigate", resultingClientId }), script: (clientId = "page") => request("./app/main.js?v=99", { clientId }), templates: () => request("./templates.json", { clientId: "page" }),
    hits: (p) => server.hits.filter((x) => x === p).length,
    check: async (clientId = "page") => { const replies = [], w = []; listeners.message({ data: { type: "check" }, source: { id: clientId, postMessage: (m) => replies.push(m) }, waitUntil: (p) => w.push(p) }); await Promise.allSettled(w); return replies; } };   // a page, back on screen, asking for news
}

const PAGE = (n) => "/index.html v" + n + " main.js?v=" + n;

test("install keeps the whole release on the device, and an offline open runs on it", async () => {
  const w = makeWorker(); await w.install(); await w.activate();
  for (const f of FILES.slice(0, 11)) assert.ok(w.rel(1).has(ORIGIN + f), f + " not stored"); assert.strictEqual(await w.current(), 1);
  for (const f of FILES.slice(11)) assert.ok(w.stores.get(ASSETS).has(ORIGIN + f), f + " not kept");
  w.server.down = true;
  const page = await w.open(); assert.strictEqual(page.text, PAGE(1)); await page.settle();
  assert.strictEqual((await w.script()).text, "/app/main.js v1");
});
test("a quick open after a deploy serves the new page and the scripts that came with it, with no second trip for the scripts", async () => {
  const w = makeWorker(); await w.install(); w.server.version = 2; w.server.hits.length = 0;
  assert.strictEqual((await w.open()).text, PAGE(2));
  assert.strictEqual((await w.script()).text, "/app/main.js v2");
  assert.strictEqual((await w.templates()).text, "/templates.json v2");
  assert.strictEqual(w.hits("/app/main.js"), 1, "the script must come from the release the open fetched, not a second request");
  assert.strictEqual(await w.current(), 2); assert.deepStrictEqual(w.releases(), [1, 2], "the release before stays for pages still running on it");
});
test("a slow server: the open runs on the device release, and the late release serves the next open, even offline", async () => {
  const w = makeWorker(); await w.install(); w.server.version = 2; w.server.delay = 150;
  const page = await w.open(); assert.strictEqual(page.text, PAGE(1), "the old page while the server is slow");
  assert.strictEqual((await w.script()).text, "/app/main.js v1", "and the old scripts with it, never the new ones");
  await page.settle();
  assert.strictEqual(await w.current(), 2, "the late release is on the device for the next open");
  assert.strictEqual((await w.script()).text, "/app/main.js v1", "the running page still gets its own release after the late one lands");
  w.server.delay = 0; w.server.down = true;
  assert.strictEqual((await w.open()).text, PAGE(2), "next open: the kept release, no network needed");
  assert.strictEqual((await w.script()).text, "/app/main.js v2");
});
test("a page keeps its own release for as long as it runs, even after another page brought a newer one", async () => {
  const w = makeWorker(); await w.install();
  assert.strictEqual((await w.open("pageA")).text, PAGE(1));
  w.server.version = 2; assert.strictEqual((await w.open("pageB")).text, PAGE(2));
  assert.strictEqual((await w.script("pageA")).text, "/app/main.js v1", "page A: still release 1");
  assert.strictEqual((await w.script("pageB")).text, "/app/main.js v2", "page B: release 2");
  assert.strictEqual((await w.request("./templates.json", { clientId: "pageA" })).text, "/templates.json v1");
});
test("headers arrive in time but one download dies half-way: the open runs on the device release, which stays untouched", async () => {
  const w = makeWorker(); await w.install(); w.server.version = 2; w.server.dieBody = "/app/main.js";
  const page = await w.open(); assert.strictEqual(page.text, PAGE(1));
  assert.strictEqual((await w.script()).text, "/app/main.js v1");
  await page.settle();
  assert.strictEqual(await w.relText(1, "/index.html"), PAGE(1), "nothing of the broken bundle reached the device"); assert.ok(!w.rel(2)); assert.strictEqual(await w.current(), 1);
});
test("headers arrive in time but the downloads are slow: the open still falls back within the wait", async () => {
  const w = makeWorker(); await w.install(); w.server.version = 2; w.server.bodyDelay = 150;
  const t0 = Date.now(); const page = await w.open();
  assert.strictEqual(page.text, PAGE(1)); assert.ok(Date.now() - t0 < 140, "served before the bodies could have landed");
  assert.strictEqual((await w.script()).text, "/app/main.js v1");
  await page.settle(); assert.strictEqual(await w.current(), 2);
  w.server.bodyDelay = 0; w.server.down = true;
  assert.strictEqual((await w.open()).text, PAGE(2));
});
test("the same release again: the open writes nothing to the device; a deploy writes the whole release", async () => {
  const w = makeWorker(); await w.install(); w.device.writes = 0;
  assert.strictEqual((await w.open()).text, PAGE(1)); assert.strictEqual(w.device.writes, 0);
  w.server.version = 2;
  assert.strictEqual((await w.open()).text, PAGE(2)); assert.strictEqual(w.device.writes, 11);
});
test("the device refuses a file of the new release: the fresh page is served with its scripts from the server, and the release before is still whole for an offline open", async () => {
  const w = makeWorker(); await w.install(); w.server.version = 2; w.device.failPut = "/app/state.js"; w.server.hits.length = 0;
  assert.strictEqual((await w.open()).text, PAGE(2));
  assert.ok(!w.rel(2), "a release that could not be stored whole is not stored at all"); assert.strictEqual(await w.current(), 1, "the newest pointer does not move to a release the device does not hold");
  assert.strictEqual((await w.script()).text, "/app/main.js v2"); assert.strictEqual(w.hits("/app/main.js"), 2, "from the server, never a mix");
  w.device.failPut = null; w.server.down = true;
  assert.strictEqual((await w.open()).text, PAGE(1), "offline: the release before, untouched"); assert.strictEqual((await w.script()).text, "/app/main.js v1");
});
test("a deploy landing in the middle of a download never mixes: the device release is served and nothing is kept", async () => {
  const w = makeWorker(); await w.install(); w.server.version = 2; w.server.missing.add("/app/state.js");
  const page = await w.open(); assert.strictEqual(page.text, PAGE(1));
  assert.strictEqual((await w.script()).text, "/app/main.js v1");
  await page.settle(); assert.ok(!w.rel(2)); assert.strictEqual(await w.relText(1, "/index.html"), PAGE(1));
  // the page changes release between the first file and the final check
  const w2 = makeWorker(); await w2.install(); w2.server.version = 2; w2.server.delay = 20;
  const page2 = w2.open(); await sleep(5); w2.server.version = 3;   // deploy 3 lands while the release-2 files are on their way: the final check of the page sees it
  const got = await page2; assert.strictEqual(got.text, PAGE(1), "never release 2's page with release 3's scripts: the device release instead"); await got.settle();
  assert.ok(!w2.rel(2), "the half-and-half download is not kept");
});
test("a half-stored release on the device is not served; the newest whole one is", async () => {
  const w = makeWorker(); await w.install();
  w.stores.set(REL + "9", new Map([[ORIGIN + "/index.html", new Response(PAGE(9))]])); w.server.down = true;
  assert.strictEqual((await w.open()).text, PAGE(1));
});
test("a late release never undoes a fresher one a later open already brought", async () => {
  const w = makeWorker(); await w.install(); w.server.version = 2; w.server.delay = 150;
  const first = w.open(); await sleep(10);                                   // its requests are out, slow
  w.server.delay = 0; w.server.version = 3;
  assert.strictEqual((await w.open()).text, PAGE(3), "a second, quick open brings deploy 3");
  const page = await first; assert.strictEqual(page.text, PAGE(3), "the slow open falls back to what the device holds by then"); await page.settle();
  assert.strictEqual(await w.current(), 3, "the late deploy-2 release does not move the pointer back");
  w.server.down = true; assert.strictEqual((await w.open()).text, PAGE(3));
});
test("a newer worker with the same release writes nothing; activate keeps the two newest releases and drops the old single-cache shell", async () => {
  const w = makeWorker(); await w.install(); w.device.writes = 0; await w.install(); assert.strictEqual(w.device.writes, 0);
  w.server.version = 2; await w.install(); w.server.version = 3; await w.install();
  w.stores.set("fiala-shell-v14", new Map()); w.stores.set("other-site", new Map());
  await w.activate();
  assert.deepStrictEqual(w.releases(), [2, 3]); assert.ok(!w.stores.has("fiala-shell-v14")); assert.ok(w.stores.has("other-site")); assert.strictEqual(await w.current(), 3);
});
test("scripts asked for by another page on this origin (a test copy) come from the network, and other pages are left alone", async () => {
  const w = makeWorker(); await w.install(); w.server.version = 3;
  assert.strictEqual((await w.script("copy")).text, "/app/main.js v3");
  assert.strictEqual((await w.request("./_test.html", { mode: "navigate" })).handled, false);
});
test("icons and the library come from the device and are refreshed quietly; other sites and the API are left alone", async () => {
  const w = makeWorker(); await w.install(); w.server.version = 2;
  const icon = await w.request("./icon-192.png"); assert.strictEqual(icon.text, "/icon-192.png v1"); await icon.settle();
  const a = w.stores.get(ASSETS); assert.strictEqual(await a.get(ORIGIN + "/icon-192.png").clone().text(), "/icon-192.png v2", "refreshed for the next time");
  assert.strictEqual((await w.request("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.2/dist/umd/supabase.min.js")).handled, true);
  assert.strictEqual((await w.request("https://other.example/x.js")).handled, false);
  assert.strictEqual((await w.request("https://x.supabase.co/rest/v1/ft_trainings")).handled, false);
  assert.strictEqual((await w.request("./index.html", { method: "POST" })).handled, false);
});


test("a page back on screen after a deploy: its check puts the new release on the device and hears the newest, while it keeps running on its own", async () => {
  const w = makeWorker(); await w.install(); await w.activate();
  const page = await w.open(); assert.strictEqual(page.text, PAGE(1)); await page.settle();
  w.server.version = 2; w.server.hits.length = 0;
  assert.deepStrictEqual(await w.check(), [{ type: "release", current: 2 }]);
  assert.deepStrictEqual(w.releases(), [1, 2]); assert.strictEqual(await w.relText(2, "/app/main.js"), "/app/main.js v2");
  assert.strictEqual((await w.script()).text, "/app/main.js v1", "the open page still gets the scripts of its own release");
  assert.strictEqual((await w.open("page2")).text, PAGE(2), "the next open runs on the new one");
});
test("a check with nothing new fetches the page only, and a check with the server away still answers with the device's newest", async () => {
  const w = makeWorker(); await w.install(); await w.activate(); w.server.hits.length = 0;
  assert.deepStrictEqual(await w.check(), [{ type: "release", current: 1 }]);
  assert.strictEqual(w.hits("/index.html"), 1); assert.strictEqual(w.hits("/app/main.js"), 0, "no release download when the server's page is the one on the device");
  w.server.down = true;
  assert.deepStrictEqual(await w.check(), [{ type: "release", current: 1 }]);
  assert.deepStrictEqual(w.releases(), [1]);
});
test("a check during a deploy (the page says one release, a script another) keeps the device as it was and says so", async () => {
  const w = makeWorker(); await w.install(); await w.activate();
  let calls = 0; const real = w.server; const orig = Object.getOwnPropertyDescriptor(real, "version");
  Object.defineProperty(real, "version", { get: () => (++calls <= 12 ? 2 : 3), configurable: true });   // call 1: the page says 2; calls 2-12: the eleven files of release 2; call 13: the page again, and 3 has landed
  assert.deepStrictEqual(await w.check(), [{ type: "release", current: 1 }]);
  assert.deepStrictEqual(w.releases(), [1], "nothing half-way lands");
  Object.defineProperty(real, "version", orig || { value: 3, writable: true, configurable: true });
});
