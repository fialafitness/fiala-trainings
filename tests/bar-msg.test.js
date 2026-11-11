// His ask, 10 Nov: "move the message button on the top row next to profile picture and in workout next to the … button … make sure it looks
// like Apple would do it". His picks: A, separate circles (44, the bar's 12 apart, as Apple's Fitness keeps its two), the profile picture at
// the far edge alone (as Apple keeps an account picture); the client's own view the same. One Messages disc in the bar: on a client's page
// beside her photo and on a workout beside its "…"; the coach messages the client (her number), a client the trainer (his number on her
// record), by her chat setting; none on a template, the Clients page or a settings page, nor without a number. The discs beside the titles
// are gone.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { test, assert } from "./assert.js";
import { load } from "./load.js";
import { TEMPLATES_ID } from "../app/model.js";
const app = await load();
const { fns, maps } = app;
const $ = (id) => document.getElementById(id);
const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const here = path.dirname(fileURLToPath(import.meta.url));
const swipes = JSON.parse(execFileSync(process.execPath, [path.join(here, "bar-msg-probe.mjs")], { encoding: "utf8", timeout: 60000 }).trim().split("\n").pop());
const page = (view, opts = {}) => {
  for (const t of maps.timers.values()) clearTimeout(t); maps.timers.clear();
  app.reset(); fns.setPreview(!!opts.preview);
  app.set({ signedIn: true, clientMode: !!opts.client, myClientId: opts.client ? "c1" : null, tab: "workouts" });
  maps.clients.set("c1", { id: "c1", name: "Jane Doe", unit: "lb", phone: opts.phone === undefined ? "(310) 555-0100" : opts.phone, trainerPhone: "3105550199", chat: opts.chat });
  maps.clients.set(TEMPLATES_ID, { id: TEMPLATES_ID, name: "Templates", phone: "3105550111", trainerPhone: "3105550199" });   // (numbers even here: no disc on a template for its own sake)
  maps.trainings.set("w1", { id: "w1", clientId: "c1", title: "Legs", date: fns.today(), createdAt: "2026-11-01T10:00:00.000Z", completedAt: null, skippedAt: null, rows: [] });
  maps.trainings.set("tp", { id: "tp", clientId: TEMPLATES_ID, title: "Push", date: null, createdAt: "2026-11-01T10:00:00.000Z", completedAt: null, skippedAt: null, rows: [] });
  const d = $("barMsg"); d.hidden = false; d.href = "stale";
  app.set({ view, renderedTraining: null }); fns.render();
};
const disc = () => { const d = $("barMsg"); return d.hidden ? null : { href: d.href, label: $("barMsgText").textContent }; };
const quiet = () => { for (const t of maps.timers.values()) clearTimeout(t); maps.timers.clear(); fns.setPreview(false); };

test("the coach's view: on a client's page and on her workout the bar's Messages disc texts her, named for VoiceOver", () => {
  const her = { href: "sms:+13105550100", label: "Message Jane" };
  page({ name: "client", id: "c1" }); assert.deepStrictEqual(disc(), her, "her page, beside her photo");
  assert.strictEqual($("meDisc").hidden, false, "her photo still at the far edge");
  page({ name: "training", id: "w1" }); assert.deepStrictEqual(disc(), her, "her workout, beside its …");
  page({ name: "training", id: "w1" }, { preview: true }); assert.deepStrictEqual(disc(), her, "his Client view of it too: the bar keeps its disc");
  page({ name: "client", id: "c1" }, { chat: "whatsapp" }); assert.deepStrictEqual([disc(), $("barMsg").target], [{ href: "https://wa.me/13105550100", label: "Message Jane" }, "_blank"], "WhatsApp when she chose it");
  page({ name: "client", id: "c1" }, { phone: "" }); assert.strictEqual(disc(), null, "no number: no disc");
  quiet();
});

test("the client's own view: her page and her workout text the trainer", () => {
  const him = { href: "sms:+13105550199", label: "Message Michal" };
  page({ name: "client", id: "c1" }, { client: true }); assert.deepStrictEqual(disc(), him, "her Workouts page, beside her photo (her Settings)");
  page({ name: "training", id: "w1" }, { client: true }); assert.deepStrictEqual(disc(), him, "her workout, beside its …");
  quiet();
});

test("no disc where there is no one to text: a template, the library, the Clients page", () => {
  page({ name: "training", id: "tp" }); assert.strictEqual(disc(), null, "a template");
  page({ name: "client", id: TEMPLATES_ID }); assert.strictEqual(disc(), null, "the library");
  page({ name: "clients" }); assert.strictEqual(disc(), null, "the Clients page");
  quiet();
});

test("a settings page over her page takes the disc away, a sync's redraw does not bring it back over it, and Back brings it again", () => {
  try {
    for (const [name, opts, open] of [["his History of her", {}, fns.openHistoryPage], ["her card", {}, fns.showClientCard], ["her own History", { client: true }, fns.openHistoryPage], ["her own Settings", { client: true }, fns.showSettings]]) {
      page({ name: "client", id: "c1" }, opts); open(); assert.strictEqual(disc(), null, name + " over her page");
      fns.render(); assert.strictEqual(disc(), null, name + ", after a sync's redraw");
      fns.leaveSettings(); fns.render(); assert.notStrictEqual(disc(), null, "Back from " + name + ": the disc again");
    }
  } finally { fns.leaveSettings(); quiet(); }   // (the settings page's state lives in main.js: a reset does not clear it)
});

test("the swipe back's bar for the page underneath agrees with that page, asked from another page", () => {
  const key = (v) => v.name + (v.id ? "/" + v.id : ""), shows = (v, o) => { page(v, o); return !$("barMsg").hidden; };
  const C = { name: "client", id: "c1" }, W = { name: "training", id: "w1" }, T = { name: "training", id: "tp" }, L = { name: "clients" };
  for (const [up, under, o] of [[C, L, {}], [L, C, {}], [W, T, {}], [T, W, {}], [W, C, { client: true }], [C, W, { phone: "" }]]) {
    const want = shows(under, o); page(up, o);
    assert.strictEqual(fns.barFor(key(under)).barMsg, want, key(under) + " seen from " + key(up) + " " + JSON.stringify(o));
  }
  page(W); assert.strictEqual(fns.barFor("training/w1|exercise").barMsg, false, "not over the exercise's page");
  const flags = Object.keys(fns.barFor("training/w1")).filter((k) => k !== "id" && k !== "brand");
  assert.deepStrictEqual(flags.filter((k) => !fns.glass().includes(k)), [], "every bar button the swipe names goes and comes with the bar's glass (the Messages circle too)");
  quiet();
});

test("the swipe back around the Messages circle: in the same place on both bars it stays; in another place it goes and comes (a finished workout has no \u2026, so its circle is at the edge); Back stays where it is; the page underneath's bar is as it is now", () => {
  assert.deepStrictEqual(swipes.clientToDo, { workout: "back barMsg tMore", goesOut: ["back", "tMore"], comesIn: ["meDisc"], landed: "client: brand barMsg meDisc" }, "her workout to do back to her page: the circle stays, the \u2026 goes, her photo comes");
  for (const k of ["clientFinished", "clientSkipped"]) assert.deepStrictEqual(swipes[k], { workout: "back barMsg", goesOut: ["back", "barMsg"], comesIn: ["barMsg", "meDisc"], landed: "client: brand barMsg meDisc" }, k + ": the circle at the edge goes, her page's beside her photo comes (never the photo over it, then a jump)");
  assert.deepStrictEqual(swipes.previewFinished, { workout: "back barMsg", goesOut: ["barMsg"], comesIn: ["barMsg", "meDisc"], landed: "client: back barMsg meDisc" }, "his Client view of a finished workout: the same, Back stays");
  assert.deepStrictEqual(swipes.coachFinished, { workout: "back barMsg tMore", goesOut: ["tMore"], comesIn: ["meDisc"], landed: "client: back barMsg meDisc" }, "his own view: the \u2026 (Delete) keeps the circle in its place");
  assert.deepStrictEqual(swipes.template, { workout: "back tMore", goesOut: ["tMore"], comesIn: [], landed: "client: back" }, "a template back to the library: Back stays");
  assert.deepStrictEqual(swipes.cardNumber, { card: "back", goesOut: [], comesIn: ["barMsg", "meDisc"], landed: "client: back barMsg meDisc" }, "her number typed on her card since her page's picture: the circle comes in with her page");
});

test("the page: the disc in the bar before the … and the photo, the bar's 12 between them; the discs beside the titles are gone", () => {
  assert.match(html, /<div id="status"[^>]*><\/div><a class="disc hdr-disc bar-msg" id="barMsg" href="#" hidden><svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 3C6\.48 3 2 6\.58[^"]*"\/><\/svg><span class="vh" id="barMsgText">Message<\/span><\/a><button class="disc hdr-disc bar-more" id="tMore"/, "first of the bar's discs: the … or the photo stays at the far edge");
  assert.ok(html.includes("#barMsg:not([hidden]) ~ .hdr-disc { margin-left: 0; }"), "the bar's own 12 between the two circles (Apple's, measured on Fitness)");
  assert.ok(html.includes(".bar-msg { background: var(--disc-fill); color: var(--disc-ink); text-decoration: none; }"), "the bar's grey circle, as the …");
  assert.ok(!/id="(msgBtn|trainerBtn|trainerBtn2)"|msg-disc/.test(html), "no Messages disc beside a title any more");
});
