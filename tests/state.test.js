import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test, assert } from "./assert.js";
import { load } from "./load.js";
import { initial } from "../app/state.js";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = await load();

// Every value that changes lives in S (app/state.js). A bare use of one of those names in main.js or sync.js
// is a leftover from before the split and would throw at the moment it runs. This check reads the source.
test("no bare use of a shared state name survives in main.js or sync.js", () => {
  const names = Object.keys(initial());
  for (const file of ["main.js", "sync.js"]) {
    let code = fs.readFileSync(path.join(__dirname, "..", "app", file), "utf8");
    code = code.replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`|\/\/[^\n]*|\/\*[\s\S]*?\*\//g, " ");   // strings and comments out
    code = code.replace(/(?<=[(,=:[!&|?{};+\-*%<>~^]\s*)\/(?:\\.|[^\/\\\n])+\/[gimsuy]*/g, " ");                      // regex literals out
    const bad = [];
    for (const n of names) {
      const bare = new RegExp("(?<![\\w$.])" + n + "(?![\\w$:])", "g");          // not S.name, not a property key
      const spread = new RegExp("\\.\\.\\." + n + "(?![\\w$])", "g");             // ...name is a bare use too
      for (const m of code.matchAll(bare)) bad.push(file + ": " + n + " @" + m.index);
      for (const m of code.matchAll(spread)) bad.push(file + ": ..." + n + " @" + m.index);
    }
    assert.deepStrictEqual(bad, [], "bare state names");
  }
});
test("internals reset restores every default", () => {
  app.set({ signedIn: true, clientMode: true, syncedOnce: true }); app.reset();
  const s = app.get(); assert.strictEqual(s.signedIn, false); assert.strictEqual(s.clientMode, false); assert.strictEqual(s.syncedOnce, false); assert.deepStrictEqual(s.view, { name: "clients" });
});
