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
test("the service worker fetches the page and the scripts as one bundle, checked with the server", () => {
  const sw = fs.readFileSync(path.join(root, "sw.js"), "utf8");
  const start = sw.indexOf("async function fetchBundle"); const bundle = sw.slice(start, sw.indexOf("\n}", start));
  assert.ok(/cache:\s*"no-cache"/.test(bundle), "the bundle must bypass the host's 10-minute HTTP cache");
  const list = JSON.parse(sw.match(/const BUNDLE = (\[[^\]]*\])/)[1].replace(/\bPAGE\b/, '"./index.html"'));
  for (const f of fs.readdirSync(path.join(root, "app")).filter((x) => x.endsWith(".js"))) assert.ok(list.includes("./app/" + f), f + " missing from the BUNDLE list");
  assert.ok(!list.includes("./templates.json"), "the built-in templates are no longer published (15 Nov 2026): they live in the coach's account and his backups");
  assert.ok(sw.includes("isAppScript") === false, "the old per-script network race must not come back");
});
test("the purchased programs' files stay out of the public repo (the owner's ask, 15 Nov 2026): they live in his private folder beside it", () => {
  const gone = ["templates.json", "tools/odboj-raw.json", "tools/odboj-unmapped.json", "tools/bodytype-raw.json", "tools/bodytype-unmapped.json", "tools/bodytype-cues-cz.json", "tools/bodytype-cues-en.json", "tools/bodytype-manual.json", "tools/import_odboj.py", "tools/import_bodytype.py", "tools/merge_templates.py", "tools/pdfstr.swift"];
  for (const f of gone) assert.ok(!fs.existsSync(path.join(root, f)), f + " is back in the repo: everything in it is published on GitHub and the website");
  const ignore = fs.readFileSync(path.join(root, ".gitignore"), "utf8");
  for (const line of ["templates.json", "tools/odboj-*", "tools/bodytype-*"]) assert.ok(ignore.split("\n").includes(line), ".gitignore must keep " + line + " out of a commit");
});
test("every file the service worker installs is on disk, or no phone ever gets the new shell", () => {
  const sw = fs.readFileSync(path.join(root, "sw.js"), "utf8");
  const refs = [...new Set([...sw.matchAll(/"(\.\/[^"]+)"/g)].map((m) => m[1]))];
  assert.ok(refs.length >= 18, "expected the shell list, found " + refs.length);
  for (const u of refs) assert.ok(fs.existsSync(path.join(root, u)), u + " is listed in sw.js but not on disk");
  const lib = sw.match(/const LIB = "([^"]+)"/)[1];
  assert.ok(fs.readFileSync(path.join(root, "index.html"), "utf8").includes(lib), "LIB in sw.js must match the <script src> in index.html");
});

test("no IF or ELSIF in the server's rules has a CASE in its condition outside brackets: PL/pgSQL reads the condition up to its first THEN, the CASE's own, and the file then fails in Supabase's SQL editor with \"syntax error at end of input\" (v316: client-consent.sql did, on release day, though every test passed: the stand-in server never runs the SQL)", () => {
  const bad = [];
  for (const f of fs.readdirSync(sqlDir).filter((x) => x.endsWith(".sql"))) {
    const lines = fs.readFileSync(path.join(sqlDir, f), "utf8").split("\n");
    lines.forEach((l, i) => {
      const code = l.replace(/--.*$/, ""), m = /^\s*(?:if|elsif)\b([\s\S]*)$/i.exec(code); if (!m) return;
      let cond = m[1], j = i; while (!/\bthen\b/i.test(cond) && j + 1 < lines.length && j < i + 8) { j++; cond += " " + lines[j].replace(/--.*$/, ""); }
      cond = cond.slice(0, cond.search(/\bthen\b/i) < 0 ? cond.length : cond.search(/\bthen\b/i));
      let depth = 0; for (const tok of cond.match(/\(|\)|\bcase\b/gi) || []) { if (tok === "(") depth++; else if (tok === ")") depth--; else if (depth <= 0) bad.push(f + ":" + (i + 1)); }
    });
  }
  assert.deepStrictEqual(bad, [], "a CASE in an IF's condition outside brackets (wrap it: `if x = (case … end) then`)");
});
