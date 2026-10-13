// node tests/run.js  — loads the real app code and runs every *.test.js in this folder. No dependencies.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { runAll } from "./assert.js";
const here = path.dirname(fileURLToPath(import.meta.url));
const files = fs.readdirSync(here).filter((f) => f.endsWith(".test.js")).sort();
for (const f of files) { console.log(f); await import(pathToFileURL(path.join(here, f)).href); }
const { pass, fail } = await runAll();
console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
