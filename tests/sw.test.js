// The service worker, driven in Node with a stand-in for the browser: a fake server, fake caches that read
// bodies like the real ones, fake clients. Every open must leave the phone with a page and scripts from ONE
// deploy, whatever the network does.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test, assert } from "./assert.js";
const src = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "sw.js"), "utf8");
const ORIGIN = "https://app.test", SW_URL = ORIGIN + "/sw.js", LIVE = "fiala-shell-v14", NEXT = LIVE + "-next";
const FILES = ["/index.html", "/app/main.js", "/app/catalog.js", "/app/util.js", "/app/model.js", "/app/notes.js", "/app/pdf.js", "/app/report.js", "/app/state.js", "/app/sync.js", "/templates.json", "/manifest.webmanifest", "/icon-192.png", "/icon-512.png", "/apple-touch-icon.png", "/favicon.ico", "/fonts/Inter-Regular.ttf", "/fonts/Inter-Bold.ttf"];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function makeWorker() {
  const server = { version: 1, delay: 0, bodyDelay: 0, down: false, missing: new Set(), dieBody: null, etag: false, hits: [] };   // what app.test answers
  const device = { failPut: null, writes: 0 };                                                                                   // what the phone's storage does
  class Req extends Request { constructor(input, init) { super(typeof input === "string" ? new URL(input, SW_URL).href : input, init); } }
  const keyOf = (k) => new URL(typeof k === "string" ? k : k.url, SW_URL).href;          // exact, like the real Cache API: a query is another key
  const stores = new Map();
  const keep = async (m, key, r) => { const body = await r.arrayBuffer(); if (device.failPut && key.endsWith(device.failPut)) throw new Error("QuotaExceededError"); device.writes++; m.set(key, new Response(body, { status: r.status, headers: r.headers })); };
  const cacheFor = (name) => { if (!stores.has(name)) stores.set(name, new Map()); const m = stores.get(name); return {
    put: (k, r) => keep(m, keyOf(k), r), match: async (k) => { const r = m.get(keyOf(k)); return r ? r.clone() : undefined; }, delete: async (k) => m.delete(keyOf(k)),
    add: async (req) => { const r = await fetchImpl(req); if (!r.ok) throw new Error("add failed " + keyOf(req)); await keep(m, keyOf(req), r); }, keys: async () => [...m.keys()] }; };
  const caches = { open: async (n) => cacheFor(n), has: async (n) => stores.has(n), keys: async () => [...stores.keys()], delete: async (n) => stores.delete(n) };
  const body = (text, delay, die) => new ReadableStream({ start(c) { setTimeout(() => { const enc = new TextEncoder(); if (die) { c.enqueue(enc.encode(text.slice(0, 3))); c.error(new TypeError("network dropped")); } else { c.enqueue(enc.encode(text)); c.close(); } }, delay); } });
  async function fetchImpl(input) {
    const url = new URL(typeof input === "string" ? input : input.url); server.hits.push(url.pathname);
    const { version, delay, bodyDelay, down, dieBody, etag } = server;                   // what the server was when the request left
    if (url.origin !== ORIGIN) return new Response("lib " + url.hostname, { status: 200 });
    if (delay) await sleep(delay);
    if (down) throw new TypeError("Failed to fetch");
    if (server.missing.has(url.pathname) || !FILES.includes(url.pathname)) return new Response("nope", { status: 404 });
    const text = url.pathname + " v" + version;
    return new Response(body(text, bodyDelay, dieBody === url.pathname), { status: 200, headers: etag ? { etag: 'W/"' + version + "-" + url.pathname + '"' } : {} });
  }
  const clientsById = { page: { url: ORIGIN + "/" }, copy: { url: ORIGIN + "/_test.html" } }; const listeners = {};
  const self = { addEventListener: (t, fn) => { listeners[t] = fn; }, skipWaiting: async () => {}, clients: { claim: async () => {}, get: async (id) => clientsById[id] }, location: { origin: ORIGIN, href: SW_URL } };
  const timer = (fn, ms) => setTimeout(fn, ms >= 1000 ? 60 : ms);        // the open's patience, shortened for the test
  new Function("self", "caches", "fetch", "Request", "Response", "URL", "setTimeout", src)(self, caches, fetchImpl, Req, Response, URL, timer);
  const run = async (type) => { const w = []; listeners[type]({ waitUntil: (p) => w.push(p) }); await Promise.all(w); };
  async function request(url, opts = {}) {
    const w = []; let out = null;
    const req = new Req(url, { method: opts.method || "GET" }); Object.defineProperty(req, "mode", { value: opts.mode || "cors" });
    listeners.fetch({ request: req, clientId: opts.clientId || "", respondWith: (p) => { out = p; }, waitUntil: (p) => w.push(p) });
    const res = out ? await out : null;
    return { text: res && res.ok ? await res.text() : null, ok: !!(res && res.ok), handled: !!out, settle: () => Promise.allSettled(w) };
  }
  const live = () => stores.get(LIVE);
  const liveText = async (p) => { const r = live() && live().get(ORIGIN + p); return r ? r.clone().text() : null; };
  return { server, device, stores, live, liveText, install: () => run("install"), activate: () => run("activate"), request,
    open: () => request("./", { mode: "navigate" }), script: (clientId = "page") => request("./app/main.js?v=99", { clientId }), templates: () => request("./templates.json", { clientId: "page" }),
    hits: (p) => server.hits.filter((x) => x === p).length };
}

test("install keeps the whole shell on the device, and an offline open runs on it", async () => {
  const w = makeWorker(); await w.install(); await w.activate();
  for (const f of FILES) assert.ok(w.live().has(ORIGIN + f), f + " not stored");
  w.server.down = true;
  const page = await w.open(); assert.strictEqual(page.text, "/index.html v1"); await page.settle();
  assert.strictEqual((await w.script()).text, "/app/main.js v1");
});
test("a quick open after a deploy serves the new page and the scripts that came with it, with no second trip for the scripts", async () => {
  const w = makeWorker(); await w.install(); w.server.version = 2; w.server.hits.length = 0;
  assert.strictEqual((await w.open()).text, "/index.html v2");
  assert.strictEqual((await w.script()).text, "/app/main.js v2");
  assert.strictEqual((await w.templates()).text, "/templates.json v2");
  assert.strictEqual(w.hits("/app/main.js"), 1, "the script must come from the bundle the open fetched, not a second request");
  assert.ok(!w.stores.has(NEXT));
});
test("a slow server: the open runs entirely on the device bundle, and the late bundle serves the next open, even offline", async () => {
  const w = makeWorker(); await w.install(); w.server.version = 2; w.server.delay = 150;
  const page = await w.open(); assert.strictEqual(page.text, "/index.html v1", "the old page while the server is slow");
  assert.strictEqual((await w.script()).text, "/app/main.js v1", "and the old scripts with it, never the new ones");
  await page.settle();
  assert.ok(w.stores.has(NEXT), "the late bundle is kept aside");
  assert.strictEqual((await w.script()).text, "/app/main.js v1", "the running page still gets its own deploy after the late bundle lands");
  w.server.delay = 0; w.server.down = true;
  assert.strictEqual((await w.open()).text, "/index.html v2", "next open: the kept bundle, no network needed");
  assert.strictEqual((await w.script()).text, "/app/main.js v2");
  assert.ok(!w.stores.has(NEXT));
});
test("headers arrive in time but one download dies half-way: the open runs on the device bundle, which stays untouched", async () => {
  const w = makeWorker(); await w.install(); w.server.version = 2; w.server.dieBody = "/app/main.js";
  const page = await w.open(); assert.strictEqual(page.text, "/index.html v1");
  assert.strictEqual((await w.script()).text, "/app/main.js v1");
  await page.settle();
  assert.strictEqual(await w.liveText("/index.html"), "/index.html v1", "nothing of the broken bundle reached the device");
  assert.ok(!w.stores.has(NEXT));
});
test("headers arrive in time but the downloads are slow: the open still falls back within the wait", async () => {
  const w = makeWorker(); await w.install(); w.server.version = 2; w.server.bodyDelay = 150;
  const t0 = Date.now(); const page = await w.open();
  assert.strictEqual(page.text, "/index.html v1"); assert.ok(Date.now() - t0 < 140, "served before the bodies could have landed");
  assert.strictEqual((await w.script()).text, "/app/main.js v1");
  await page.settle(); assert.ok(w.stores.has(NEXT));
  w.server.bodyDelay = 0; w.server.down = true;
  assert.strictEqual((await w.open()).text, "/index.html v2");
});
test("nothing changed on the server: the open writes nothing to the device; a deploy writes the whole bundle", async () => {
  const w = makeWorker(); w.server.etag = true; await w.install(); w.device.writes = 0;
  assert.strictEqual((await w.open()).text, "/index.html v1"); assert.strictEqual(w.device.writes, 0);
  w.server.version = 2;
  assert.strictEqual((await w.open()).text, "/index.html v2"); assert.strictEqual(w.device.writes, 11);
});
test("the device refuses a file of the new bundle: the fresh page is served and its scripts come from the server, never a mix", async () => {
  const w = makeWorker(); await w.install(); w.server.version = 2; w.device.failPut = "/app/state.js"; w.server.hits.length = 0;
  assert.strictEqual((await w.open()).text, "/index.html v2");
  assert.strictEqual(await w.liveText("/index.html"), null, "a bundle that could not be stored whole is not stored at all");
  assert.strictEqual((await w.script()).text, "/app/main.js v2"); assert.strictEqual(w.hits("/app/main.js"), 2);
});
test("a deploy caught half-way never mixes: the device bundle is served and nothing is kept", async () => {
  const w = makeWorker(); await w.install(); w.server.version = 2; w.server.missing.add("/app/state.js");
  const page = await w.open(); assert.strictEqual(page.text, "/index.html v1");
  assert.strictEqual((await w.script()).text, "/app/main.js v1");
  await page.settle(); assert.ok(!w.stores.has(NEXT)); assert.strictEqual(await w.liveText("/index.html"), "/index.html v1");
});
test("a half-written bundle kept aside is thrown away, not served", async () => {
  const w = makeWorker(); await w.install();
  w.stores.set(NEXT, new Map([[ORIGIN + "/index.html", new Response("/index.html v9")]])); w.server.version = 2;
  assert.strictEqual((await w.open()).text, "/index.html v2"); assert.ok(!w.stores.has(NEXT));
});
test("a late bundle never undoes a fresher one a later open already brought", async () => {
  const w = makeWorker(); await w.install(); w.server.version = 2; w.server.delay = 150;
  const first = w.open(); await sleep(10);                                   // its requests are out, slow
  w.server.delay = 0; w.server.version = 3;
  assert.strictEqual((await w.open()).text, "/index.html v3", "a second, quick open brings deploy 3");
  const page = await first; assert.strictEqual(page.text, "/index.html v3", "the slow open falls back to what the device holds by then"); await page.settle();
  assert.ok(!w.stores.has(NEXT), "the late deploy-2 bundle is dropped");
  w.server.down = true; assert.strictEqual((await w.open()).text, "/index.html v3");
});
test("a newer worker with the same version only adds what is missing, never touching what the running one serves", async () => {
  const w = makeWorker(); await w.install(); w.server.version = 2; w.live().delete(ORIGIN + "/app/notes.js");
  await w.install();
  assert.strictEqual(await w.liveText("/index.html"), "/index.html v1"); assert.strictEqual(await w.liveText("/app/notes.js"), "/app/notes.js v2");
});
test("activate drops the old shell and keeps a bundle set aside for the next open", async () => {
  const w = makeWorker(); await w.install();
  w.stores.set("fiala-shell-v13", new Map()); w.stores.set(NEXT, new Map()); w.stores.set("other-site", new Map());
  await w.activate();
  assert.deepStrictEqual([...w.stores.keys()].sort(), [LIVE, NEXT, "other-site"].sort());
});
test("scripts asked for by another page on this origin (a test copy) come from the network, and other pages are left alone", async () => {
  const w = makeWorker(); await w.install(); w.server.version = 3;
  assert.strictEqual((await w.script("copy")).text, "/app/main.js v3");
  assert.strictEqual((await w.request("./_test.html", { mode: "navigate" })).handled, false);
});
test("icons and the library come from the device and are refreshed quietly; other sites and the API are left alone", async () => {
  const w = makeWorker(); await w.install(); w.server.version = 2;
  const icon = await w.request("./icon-192.png"); assert.strictEqual(icon.text, "/icon-192.png v1"); await icon.settle();
  assert.strictEqual(await w.liveText("/icon-192.png"), "/icon-192.png v2", "refreshed for the next time");
  assert.strictEqual((await w.request("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.2/dist/umd/supabase.min.js")).handled, true);
  assert.strictEqual((await w.request("https://other.example/x.js")).handled, false);
  assert.strictEqual((await w.request("https://x.supabase.co/rest/v1/ft_trainings")).handled, false);
  assert.strictEqual((await w.request("./index.html", { method: "POST" })).handled, false);
});
