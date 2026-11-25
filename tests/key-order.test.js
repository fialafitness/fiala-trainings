// v316, the twenty-second check round: the server (Postgres jsonb) keeps an object's keys shortest first, then byte by byte, never in the order a
// device wrote them, and the stand-in answers the same way (fake-supabase.js). A field this device wrote itself and read back saying the same, its
// keys in the server's order, is no change of this device's: at its next save the other side's newer value of that field stands. The coach's wheels
// write a client's body weight and height as { v, u }; the server keeps { u, v }; his next save of her card (a new phone number) wrote his older
// weight and height over the ones she had just set on her phone, with no word. Made-up people only.
import { test, assert, tick } from "./assert.js";
import { makeSupabase } from "./fake-supabase.js";
import { load } from "./load.js";
const app = await load();
const { fns, maps } = app;
const settle = async () => { const until = Date.now() + 15000; do await tick(5); while ((app.get().inflight > 0 || maps.timers.size) && Date.now() < until); };
const C = "4a6c8e0b-1111-4d5f-8a7c-9e1b3d5f7a92";
let n = 0; const bump = (s) => { s.updated_at = "2026-11-24T15:" + String(10 + Math.floor(n / 50) % 50).padStart(2, "0") + ":" + String(10 + (n++ % 50)).padStart(2, "0") + ".000Z"; };   // her phone's write
const coach = (sb) => { app.reset(); fns.leaveSettings(); app.set({ sb, signedIn: true, clientMode: false, backend: fns.cloudBackend, sessionEmail: "coach@x.com", view: { name: "clients" } }); };
const sync = async () => { await fns.syncDownNow(); await settle(); };

test("Jane's body weight and height, set by the coach's wheels on her card and then changed on her phone, stay hers when he saves her card again before his next sync (a new phone number): the server keeps the wheels' { v, u } as { u, v }, which is no change of his (the twenty-second check round: his save wrote his older weight and height over hers)", async () => {
  const sb = makeSupabase(); coach(sb); let got;
  try {
    sb.seed("ft_clients", C, { id: C, name: "Jane Sample", unit: "lb", phone: "3105550100", choices: { health: { state: "agreed", at: "2026-11-01T08:00:00.000Z", by: "client" } } });
    await sync();
    assert.ok(fns.setProfile(C, "bodyWeight", { v: 152, u: "lb" }) && fns.setProfile(C, "height", { v: 66, u: "in" }), "the coach's wheels set her body weight and height");   // as the wheels write them
    await settle(); await sync();                                          // read back the same, the server's keys in its own order: his copy stays as it is
    { const { data } = await sb.from("ft_clients").select("data").eq("id", C).maybeSingle(); assert.deepStrictEqual([Object.keys(data.data.bodyWeight), Object.keys(data.data.height)], [["u", "v"], ["u", "v"]], "(the stand-in answers an object as Postgres keeps it, its keys shortest first, then byte by byte)"); }
    { const s = sb.tables.ft_clients.get(C); s.data.bodyWeight = { u: "lb", v: 149 }; s.data.height = { u: "in", v: 67 }; bump(s); }   // her phone: client_set_profile, 'bodyWeight' and 'height'
    maps.clients.get(C).phone = "3105550199"; fns.scheduleSave("clients", C); await settle();   // the coach types her new phone number on her card, before his next sync
    const d = sb.tables.ft_clients.get(C).data, here = maps.clients.get(C);
    got = { server: [d.phone, d.bodyWeight && d.bodyWeight.v, d.height && d.height.v], here: [here.phone, here.bodyWeight && here.bodyWeight.v, here.height && here.height.v] };
  } finally { app.reset(); localStorage.clear(); }
  assert.deepStrictEqual(got, { server: ["3105550199", 149, 67], here: ["3105550199", 149, 67] }, "his save of her new phone number put back his older body weight (152) and height (66) over the ones she set on her phone, on the server or on his card: " + JSON.stringify(got));
});
