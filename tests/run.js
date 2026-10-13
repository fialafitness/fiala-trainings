// node tests/run.js  — loads the real app code and runs every *.test.js in this folder. No dependencies.
"use strict";
const fs = require("fs"), path = require("path");
const { runAll } = require("./assert");
(async () => {
  const files = fs.readdirSync(__dirname).filter((f) => f.endsWith(".test.js")).sort();
  for (const f of files) { console.log(f); require(path.join(__dirname, f)); }
  const { pass, fail } = await runAll();
  console.log("\n" + pass + " passed, " + fail + " failed");
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
