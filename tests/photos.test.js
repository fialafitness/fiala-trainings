import { test, assert, tick } from "./assert.js";
import { makeSupabase } from "./fake-supabase.js";
import { load } from "./load.js";
const app = await load();
const { fns, maps } = app;
const jpeg = (n) => new Blob([new Uint8Array([0xff, 0xd8, n || 1, 2, 3, 0xff, 0xd9])], { type: "image/jpeg" });
const files = (sb) => [...sb.storage.files.keys()].sort();
const settle = async () => { await fns.flushPhotos(); await tick(5); await fns.flushPhotos(); };
const coachOn = async (sb, extra) => { app.reset(); await fns.resetPhotos(); app.set({ sb, signedIn: true, clientMode: false, backend: fns.cloudBackend, sessionEmail: "coach@test", ...(extra || {}) }); maps.clients.set("c1", { id: "c1", name: "Jane Doe", unit: "lb" }); };
const clientOn = async (sb) => { app.reset(); await fns.resetPhotos(); app.set({ sb, signedIn: true, clientMode: true, myClientId: "c1", backend: fns.clientBackend, sessionEmail: "jane@x.com" }); maps.clients.set("c1", { id: "c1", name: "Jane Doe", unit: "lb" }); };
const stopSave = (id) => { clearTimeout(maps.timers.get("clients/" + id)); maps.timers.delete("clients/" + id); };

test("initials are Apple Contacts' monogram: the first letters of the first and the last word", () => {
  assert.strictEqual(fns.initials("Michal Fiala"), "MF"); assert.strictEqual(fns.initials("Jane"), "J");
  assert.strictEqual(fns.initials("  anna maria   smith "), "AS"); assert.strictEqual(fns.initials(""), ""); assert.strictEqual(fns.initials("élodie durand"), "ÉD");
});
test("the coach's photo: the file goes up first, then the record points at it; the file it replaces is removed", async () => {
  const sb = makeSupabase(); await coachOn(sb); maps.clients.get("c1").photo = "old1"; sb.storage.files.set("photos/c1/old1.jpg", jpeg(9));
  await fns.setPhoto("c1", jpeg(1)); await settle();
  const v = maps.clients.get("c1").photo; assert.ok(v && v !== "old1", "the record has the new version");
  assert.deepStrictEqual(files(sb), ["photos/c1/" + v + ".jpg"], "the new file is there, the old one is gone");
  assert.ok(maps.dirty.has("clients/c1"), "the record is saved like any other edit"); assert.strictEqual(fns.photoQueue().size, 0, "nothing left waiting");
  const ops = sb.log.filter((l) => l.storage).map((l) => l.storage); assert.deepStrictEqual(ops, ["upload", "remove"]);
  stopSave("c1");
});
test("no signal: the photo waits on the phone, is shown already, survives a relaunch, and goes up when the signal returns", async () => {
  const sb = makeSupabase(); await coachOn(sb); sb.storage.fail = { op: "upload", times: 1, message: "Failed to fetch" };
  await fns.setPhoto("c1", jpeg(2)); await fns.flushPhotos();                 // the one try there is, without signal
  assert.ok(!maps.clients.get("c1").photo, "the record does not point at a file that is not there"); assert.strictEqual(fns.photoQueue().size, 1);
  const shown = fns.photoFor("c1"); assert.ok(shown && /^data:image\/jpeg;base64,/.test(shown.src), "shown from the phone meanwhile");
  fns.photoQueue().clear(); fns.loadPhotoQueue(); assert.strictEqual(fns.photoQueue().size, 1, "kept across a relaunch");
  await settle(); const v = maps.clients.get("c1").photo;
  assert.ok(v && files(sb).includes("photos/c1/" + v + ".jpg") && fns.photoQueue().size === 0, "sent once the signal is back");
  stopSave("c1");
});
test("before the script is run the photo waits, and the coach is told which script to run", async () => {
  const sb = makeSupabase(); await coachOn(sb); sb.storage.fail = { op: "upload", times: 5, message: "Bucket not found", statusCode: "404" };
  await fns.setPhoto("c1", jpeg(3)); await settle();
  assert.strictEqual(app.get().photoMissing, true); assert.strictEqual(fns.photoQueue().size, 1, "still waiting on the phone"); assert.ok(!maps.clients.get("c1").photo);
  assert.strictEqual(document.getElementById("status").textContent, "Run supabase/client-photos.sql first");
});
test("the client's own photo goes through her rule; until the rule exists it waits, and the file is not sent twice", async () => {
  const sb = makeSupabase(); await clientOn(sb);
  await fns.setPhoto("c1", jpeg(4)); await settle();
  assert.strictEqual(app.get().photoMissing, true, "rule missing"); assert.strictEqual(fns.photoQueue().size, 1); const v = fns.photoQueue().get("c1").v;
  assert.ok(files(sb).includes("photos/c1/" + v + ".jpg"), "the file is already up");
  const sent = []; sb.rpcs.client_set_photo = async (a) => { sent.push(a); return null; }; app.set({ photoMissing: false });
  const started = Date.now() - 1; await settle();
  assert.deepStrictEqual(sent, [{ p_client: "c1", p_photo: v }]); assert.strictEqual(maps.clients.get("c1").photo, v, "her phone shows it at once");
  assert.strictEqual(sb.log.filter((l) => l.storage === "upload").length, 1, "uploaded once");
  fns.mergeDown(maps.clients, "clients", [{ id: "c1", data: { id: "c1", name: "Jane Doe", unit: "lb" }, updated_at: "S1" }], true, started);
  assert.strictEqual(maps.clients.get("c1").photo, v, "a read that began before her change landed does not bring the old one back");
});
test("removing a photo clears the record and takes the file away; a second pick while the first is going up wins and leaves no stray file", async () => {
  const sb = makeSupabase(); await coachOn(sb); sb.storage.delayMs = 15;
  const first = fns.setPhoto("c1", jpeg(5)); await first; await tick(2);
  await fns.setPhoto("c1", jpeg(6)); await settle(); await tick(40); await settle();
  const v = maps.clients.get("c1").photo; assert.ok(v); assert.deepStrictEqual(files(sb), ["photos/c1/" + v + ".jpg"], "only the photo that won is stored");
  await fns.setPhoto("c1", null); await settle();
  assert.ok(!("photo" in maps.clients.get("c1")), "no photo on the record"); assert.deepStrictEqual(files(sb), [], "and no file left"); assert.strictEqual(fns.photoFor("c1"), null, "the initials show");
  stopSave("c1");
});
test("deleting a client takes her whole photo folder away, even with no signal at the time and files this phone never knew of", async () => {
  const sb = makeSupabase(); await coachOn(sb, { syncedOnce: true });
  maps.clients.get("c1").photo = "known1"; sb.storage.files.set("photos/c1/known1.jpg", jpeg(1)); sb.storage.files.set("photos/c1/other22.jpg", jpeg(2));   // a newer one she set herself, not yet seen here
  sb.storage.fail = { op: "list", times: 1, message: "Failed to fetch" };
  fns.forgetPhoto("c1"); maps.clients.delete("c1"); await fns.flushPhotos();
  assert.strictEqual(files(sb).length, 2, "no signal: nothing removed yet");
  fns.loadPhotoQueue(); await fns.flushPhotos();                                 // a relaunch, with signal
  assert.deepStrictEqual(files(sb), [], "the whole folder is gone");
});
test("a pick made while another is going up is sent by the same flush", async () => {
  const sb = makeSupabase(); await coachOn(sb); sb.storage.delayMs = 10;
  await fns.setPhoto("c1", jpeg(3)); await tick(2); await fns.setPhoto("c1", jpeg(4)); await fns.flushPhotos();
  const v = maps.clients.get("c1").photo; assert.ok(v, "marked"); assert.deepStrictEqual(files(sb), ["photos/c1/" + v + ".jpg"], "the second pick won, the first file is gone"); assert.strictEqual(fns.photoQueue().size, 0);
  stopSave("c1");
});
test("an old file that could not be removed for lack of signal is removed later", async () => {
  const sb = makeSupabase(); await coachOn(sb); maps.clients.get("c1").photo = "old333"; sb.storage.files.set("photos/c1/old333.jpg", jpeg(5));
  sb.storage.fail = { op: "remove", times: 2, message: "Failed to fetch" };      // no signal for the removal, and for its retry in the same flush
  await fns.setPhoto("c1", jpeg(6)); await fns.flushPhotos(); const v = maps.clients.get("c1").photo;
  assert.deepStrictEqual(files(sb), ["photos/c1/old333.jpg", "photos/c1/" + v + ".jpg"].sort(), "the old one is still there");
  fns.loadPhotoQueue(); await fns.flushPhotos();
  assert.deepStrictEqual(files(sb), ["photos/c1/" + v + ".jpg"], "removed on the next pass, after a relaunch too");
  stopSave("c1");
});
test("a photo download that lands after sign-out is not kept", async () => {
  const sb = makeSupabase(); await coachOn(sb); maps.clients.get("c1").photo = "far444"; sb.storage.files.set("photos/c1/far444.jpg", jpeg(7)); sb.storage.delayMs = 15;
  const p = fns.loadPhoto("c1", "far444"); await tick(2); await fns.resetPhotos();
  assert.strictEqual(await p, null, "nothing handed back"); assert.strictEqual(fns.photoFor("c1").src, null, "and nothing remembered");
});
test("Move and Scale: the circle is always covered, a pinch keeps the point under the fingers, and the square saved is the one in the circle", () => {
  const { crop } = fns, box = { left: 16, top: 200, d: 360 }, w = 3024, h = 4032;   // an iPhone portrait
  const st = crop.start(w, h, box);
  assert.ok(Math.abs(st.s - 360 / 3024) < 1e-9, "starts filling the circle edge to edge"); assert.strictEqual(st.x, 16, "centred across");
  const r0 = crop.rect(st, box); assert.ok(Math.abs(r0.side - 3024) < 1e-6 && Math.abs(r0.sy - (4032 - 3024) * 0.3) < 1e-6, "a little high on a portrait, as the automatic square was");
  const far = crop.clamp({ s: st.s, x: 500, y: 900 }, w, h, box); assert.deepStrictEqual([far.x, far.y], [16, 200], "dragged too far: the circle stays covered");
  const tiny = crop.clamp({ s: 0.01, x: 16, y: 200 }, w, h, box); assert.ok(Math.abs(tiny.s - crop.cover(w, h, 360)) < 1e-12, "never smaller than the circle");
  const huge = crop.clamp({ s: 99, x: 0, y: 0 }, w, h, box); assert.ok(Math.abs(huge.s - 360 / 200) < 1e-12, "never closer than 200 picture pixels across");
  const z = crop.zoomAbout(st, 196, 380, st.s * 3);
  const before = [(196 - st.x) / st.s, (380 - st.y) / st.s], after = [(196 - z.x) / z.s, (380 - z.y) / z.s];
  assert.ok(Math.abs(before[0] - after[0]) < 1e-6 && Math.abs(before[1] - after[1]) < 1e-6, "the point under the fingers stays under them");
  const zc = crop.clamp(z, w, h, box), r = crop.rect(zc, box); assert.ok(Math.abs(r.side - 3024 / 3) < 1e-6, "zoomed three times: a third as wide");
  assert.ok(r.sx >= 0 && r.sy >= 0 && r.sx + r.side <= w + 1e-6 && r.sy + r.side <= h + 1e-6, "the square lies inside the picture");
  const land = { d: 236, left: 308, top: 78.5 }, turned = crop.refit(zc, w, h, box, land), r2 = crop.rect(turned, land);   // the phone turns to landscape: a smaller circle elsewhere
  assert.ok(Math.abs(r2.sx - r.sx) < 1e-6 && Math.abs(r2.sy - r.sy) < 1e-6 && Math.abs(r2.side - r.side) < 1e-6, "the same part of the photo stays framed");
});
test("a photo another account queued on this phone is not sent as this one", async () => {
  const sb = makeSupabase(); await coachOn(sb, { sessionEmail: "a@x.com", sb: null });
  await fns.setPhoto("c1", jpeg(7)); assert.strictEqual(fns.photoQueue().size, 1);
  app.set({ sb, sessionEmail: "b@x.com" }); await settle();
  assert.strictEqual(fns.photoQueue().size, 0, "dropped"); assert.deepStrictEqual(files(sb), [], "nothing uploaded");
});
