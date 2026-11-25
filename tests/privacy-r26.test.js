// v316 (the twenty-sixth check round, R26-PRV-1 and R26-WAP-5), written while the round's tests were made: a session ended elsewhere with nothing
// waiting wipes the device, and the sign-in page then holds neither the email nor the password (the wipe emptied no sign-in box); and words taken
// for the account the device remembered, as a start carried on offline, never stay for another account whose session lands on that page.
// Made-up people only.
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { test, assert } from "./assert.js";
const probeAt = path.join(path.dirname(fileURLToPath(import.meta.url)), "account-switch-probe.mjs");
let probed = null;
const probe = () => { if (!probed) probed = JSON.parse(execFileSync(process.execPath, [probeAt], { encoding: "utf8", timeout: 120000 }).trim().split("\n").pop()); return probed; };
test("the coach signs in on the gym iPad with the Sign in form and his session ends elsewhere (his password changed on his phone) with nothing else waiting, so the iPad is wiped: the sign-in page that comes up holds neither his email nor his password (the twenty-sixth check round, R26-PRV-1: the wipe emptied no sign-in box, and his email stayed on the iPad)", () => {
  const o = probe().r26.signInEnded["nothing else waiting"];
  assert.ok(o && !o.error, "the case did not run: " + (o && o.error));
  assert.deepStrictEqual([o.launched, o.signedIn, o.ended.kept], [true, true, false], "(the setup: signed in with the form, the iPad wiped): " + JSON.stringify(o));
  assert.deepStrictEqual([o.ended.email, o.ended.password], ["", false], "after the wipe the sign-in page still holds the coach's email or password: " + JSON.stringify(o.ended));
});

const probe2At = path.join(path.dirname(fileURLToPath(import.meta.url)), "privacy-r26-probe.mjs");
test("the device remembers the coach and keeps his half-typed words; the app opens with the session slow to come, carries on offline as him and takes his words, then Jane's session lands on that page: her page holds none of his words, and nothing of his is kept under her name (the twenty-sixth check round, R26-WAP-5: with nothing queued there was no account switch, his private note stayed in her page and was kept under her email)", () => {
  const r = JSON.parse(execFileSync(process.execPath, [probe2At], { encoding: "utf8", timeout: 120000 }).trim().split("\n").pop());
  assert.deepStrictEqual(r.offline, { cards: ["his card note"], notes: ["Private: knee surgery in March"], text: ["typed by the coach"], offlineEntry: "remembered" }, "(the setup: carried on offline as the coach, his words taken): " + JSON.stringify(r.offline));
  assert.deepStrictEqual([r.jane.client, r.jane.session], [true, "jane@x.com"], "(the setup: Jane's session landed): " + JSON.stringify(r.jane));
  assert.deepStrictEqual({ cards: r.jane.cards, notes: r.jane.notes, text: r.jane.text }, { cards: [], notes: [], text: [] }, "his words stayed in her page: " + JSON.stringify(r.jane));
  assert.ok(!(r.kept && r.kept.owner === "jane@x.com" && ((r.kept.notes || []).length || (r.kept.cards || []).length || Object.keys(r.kept.text || {}).length)), "his words were kept under her name: " + JSON.stringify(r.kept));
});
