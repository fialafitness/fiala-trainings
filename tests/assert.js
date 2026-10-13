"use strict";
const assert = require("assert");
const tests = [];
function test(name, fn) { tests.push({ name, fn }); }
async function runAll() {
  let pass = 0, fail = 0;
  for (const t of tests) {
    try { await t.fn(); pass++; console.log("  ok  " + t.name); }
    catch (e) { fail++; console.log("  FAIL " + t.name + "\n       " + String(e && e.stack || e).split("\n").slice(0, 4).join("\n       ")); }
  }
  return { pass, fail };
}
const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms));
module.exports = { test, runAll, assert, tick };
