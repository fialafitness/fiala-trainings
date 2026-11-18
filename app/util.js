// Small helpers with no state: ids, dates, text, the device store.
export const uid = () => (crypto.randomUUID ? crypto.randomUUID() : "id-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10));
export const now = () => new Date().toISOString();
export const today = () => { const d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
let laFmt = null;
export const laToday = () => { try { laFmt = laFmt || new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", year: "numeric", month: "2-digit", day: "2-digit" }); const p = laFmt.formatToParts(new Date()), g = (t) => (p.find((x) => x.type === t) || {}).value; return g("year") + "-" + g("month") + "-" + g("day"); } catch (_) { return today(); } };   // the server's day: client_my_data hides a lapsed plan's workouts by the Los Angeles date (the audit's #22: a phone in Hawaii is a day behind it for two hours a night, three in summer); its formatter is made once (v315: the client page reads it for every plan check)
export const localIso = (d) => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
export const fmtDate = (s) => { if (!s) return ""; const [y, m, d] = s.split("-").map(Number); const dt = new Date(y, m - 1, d); const opts = { month: "short", day: "numeric" }; if (y !== new Date().getFullYear()) opts.year = "numeric"; return dt.toLocaleDateString(undefined, opts); };
export const fmtDayLong = (s) => { if (!s) return ""; const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d, 12).toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric", ...(y !== new Date().getFullYear() ? { year: "numeric" } : {}) }); };   // "Wednesday, Nov 4": the client's workout page, the way Apple writes a day under a title
export const fmtDay = (s) => { if (!s) return ""; const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d, 12).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", ...(y !== new Date().getFullYear() ? { year: "numeric" } : {}) }); };
export const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
export const norm = (s) => String(s || "").trim().toLowerCase();
export const squash = (s) => norm(s).replace(/[^a-z0-9]+/g, "");   // "Push-up", "push up" and "pushup" all become "pushup"
export const lsGet = (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } };
export const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } };
export const monthLater = (iso) => { const [y, m, d] = String(iso).split("-").map(Number); const last = new Date(y, m + 1, 0).getDate(); return localIso(new Date(y, m, Math.min(d, last), 12)); };   // the same day next month, or its last day (Jan 31 -> Feb 28)
export const daysLater = (iso, n) => { const [y, m, d] = String(iso).split("-").map(Number); return localIso(new Date(y, m - 1, d + n, 12)); };   // n days on, e.g. a 4-week plan = 28
