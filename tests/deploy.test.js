// Guards on what the server and the service worker hand a phone — things no browser stand-in can exercise.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test, assert } from "./assert.js";
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const sqlDir = path.join(root, "supabase");
const bodyOf = (s) => { const at = s.indexOf("function client_my_data()"); return at < 0 ? null : s.slice(at, s.indexOf("$$;", at)); };
const copies = () => fs.readdirSync(sqlDir).filter((f) => f.endsWith(".sql")).map((f) => [f, bodyOf(fs.readFileSync(path.join(sqlDir, f), "utf8"))]).filter(([, b]) => b);

test("every copy of client_my_data sends the coach's instructions and keeps the private notes list back", () => {
  const found = copies(); assert.ok(found.length >= 2, "client_my_data lives in more than one file");
  for (const [f, body] of found) {
    assert.ok(!/\bnote\b/.test(body), f + " takes the exercise instructions off the client's copy (only the plural 'notes' list is private)");
    assert.ok(/data\s*-\s*'notes'/.test(body), f + " must keep the trainer's private notes off the client's copy");
    assert.ok(/->>\s*'paused'[^)]*\)\s*<>\s*'true'/.test(body), f + " must still hold back a paused client's workouts");
    assert.ok(/'until'[\s\S]*America\/Los_Angeles/.test(body), f + " must hold back a monthly plan past its day, in Los Angeles time");
  }
});
test("the copies of client_my_data are identical, so re-running any file gives the same server", () => {
  const found = copies(); const norm = (b) => b.replace(/\s+/g, " ").trim();
  for (const [f, body] of found) assert.strictEqual(norm(body), norm(found[0][1]), f + " differs from " + found[0][0]);
});
test("the service worker fetches the page, the scripts and the templates as one bundle, checked with the server", () => {
  const sw = fs.readFileSync(path.join(root, "sw.js"), "utf8");
  const bundle = sw.slice(sw.indexOf("async function fetchBundle"), sw.indexOf("async function store"));
  assert.ok(/cache:\s*"no-cache"/.test(bundle), "the bundle must bypass the host's 10-minute HTTP cache");
  const list = JSON.parse(sw.match(/const BUNDLE = (\[[^\]]*\])/)[1].replace(/\bPAGE\b/, '"./index.html"'));
  for (const f of fs.readdirSync(path.join(root, "app")).filter((x) => x.endsWith(".js"))) assert.ok(list.includes("./app/" + f), f + " missing from the BUNDLE list");
  assert.ok(list.includes("./templates.json"), "templates.json must travel with the scripts that know its version");
  assert.ok(sw.includes("isAppScript") === false, "the old per-script network race must not come back");
});
test("every file the service worker installs is on disk, or no phone ever gets the new shell", () => {
  const sw = fs.readFileSync(path.join(root, "sw.js"), "utf8");
  const refs = [...new Set([...sw.matchAll(/"(\.\/[^"]+)"/g)].map((m) => m[1]))];
  assert.ok(refs.length >= 18, "expected the shell list, found " + refs.length);
  for (const u of refs) assert.ok(fs.existsSync(path.join(root, u)), u + " is listed in sw.js but not on disk");
  const lib = sw.match(/const LIB = "([^"]+)"/)[1];
  assert.ok(fs.readFileSync(path.join(root, "index.html"), "utf8").includes(lib), "LIB in sw.js must match the <script src> in index.html");
});
