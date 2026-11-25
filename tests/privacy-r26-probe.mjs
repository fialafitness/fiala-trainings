// Run by privacy-r26.test.js in its own process (v316, the twenty-sixth check round, R26-WAP-5): the device remembers the coach and keeps his words
// half typed (fiala.kept), nothing queued; the app opens with the session slow to come (over 4 s), so it carries on offline as the coach and takes
// his words; then the session that lands is Jane's (a sign-in link opened on one bar). Her page must hold none of his words, and nothing of his is
// kept under her name. Prints one JSON line. Made-up people only.
await import("./env.js");
const { load } = await import("./load.js");
const { makeSupabase } = await import("./fake-supabase.js");
const app = await load(); const { fns, maps } = app;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const COACH = "coach@x.com", JANE = "jane@x.com", C = "c1", W = "w1";
const sb = makeSupabase(); sb.tables.trainers = new Map();
sb.seed("ft_clients", C, { id: C, name: "Jane Testperson", unit: "lb", email: JANE });
sb.seed("ft_trainings", W, { id: W, clientId: C, title: "Legs", date: "2026-11-27", createdAt: "2026-11-10T16:00:00.000Z", completedAt: null, skippedAt: null, rows: [{ id: "sq", label: "1", name: "Back squat", sets: 4, reps: "8", weights: [], repsDone: [], setsDone: 0, done: false, note: "", alts: [], unit: "lb" }] }, { client_id: C });
sb.rpcs.client_my_data = async () => ({ clients: [{ id: C, data: { id: C, name: "Jane Testperson", unit: "lb", email: JANE } }], trainings: [{ id: W, data: JSON.parse(JSON.stringify(sb.tables.ft_trainings.get(W).data)), updated_at: sb.tables.ft_trainings.get(W).updated_at }] });
sb.auth.onAuthStateChange = () => ({ data: { subscription: { unsubscribe() {} } } });
let release = null; sb.auth.getSession = () => new Promise((r) => { release = () => r({ data: { session: { user: { email: JANE } } }, error: null }); });
localStorage.setItem("fiala.trainings.role", JSON.stringify({ email: COACH, role: "trainer" }));
localStorage.setItem("fiala.trainings.v1", JSON.stringify({ clients: [{ id: C, name: "Jane Testperson", unit: "lb", email: JANE }], trainings: [JSON.parse(JSON.stringify(sb.tables.ft_trainings.get(W).data))], savedAt: Date.now() }));
localStorage.setItem("fiala.kept", JSON.stringify({ owner: COACH, tab: "x", at: 1, text: { "safety:c1/limits": "typed by the coach" }, cards: [[W + "/1", "his card note"]], bases: [], notes: [[C, "Private: knee surgery in March"]] }));
globalThis.supabase = { createClient: () => sb };
await fns.boot();                                                          // the session slow: after 4 s the app carries on offline as the coach
const k = fns.keptMaps(), drafts = () => ({ cards: [...k.cardNoteDraft.values()], notes: [...k.noteDraft.values()], text: [...k.keptText.values()] });
const out = { offline: { ...drafts(), offlineEntry: app.get().offlineEntry || null } };
release(); for (let i = 0; i < 100 && !(app.get().signedIn && app.get().clientMode); i++) await wait(50);   // Jane's session lands on that page
await wait(300);
out.jane = { ...drafts(), client: !!app.get().clientMode, session: app.get().sessionEmail };
fns.keepTyping(); out.kept = JSON.parse(localStorage.getItem("fiala.kept") || "null");   // the page going out of sight: nothing of his is kept under her name
console.log(JSON.stringify(out));
process.exit(0);
