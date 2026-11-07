// An in-memory stand-in for the parts of supabase-js the app uses: from().select/update/upsert/delete chains, rpc(), auth.getSession().
function makeSupabase() {
  const tables = { ft_clients: new Map(), ft_trainings: new Map(), ft_exercises: new Map(), ft_exercise_videos: new Map(), ft_exercise_hidden: new Map(), ft_exercise_subtitles: new Map() };   // the exercise tables key rows by name_key
  let stamp = 0; const nextStamp = () => "2026-10-13T00:00:" + String(++stamp).padStart(2, "0") + "Z";
  const log = []; const rpcs = {}; let fail = null;                      // fail: { table?, op?, times } to make calls error
  const clone = (x) => JSON.parse(JSON.stringify(x));
  const seed = (table, id, data, extra) => { tables[table].set(id, { id, data: clone(data), updated_at: nextStamp(), ...(extra || {}) }); return tables[table].get(id).updated_at; };
  function from(table) {
    const q = { table, op: "select", filters: [], order: null, limit: null, range: null, single: false, payload: null, wantSelect: false };
    const b = {
      select(cols) { if (q.op === "select") q.cols = cols; else q.wantSelect = true; return b; },
      update(row) { q.op = "update"; q.payload = row; return b; }, upsert(row) { q.op = "upsert"; q.payload = row; return b; },
      delete() { q.op = "delete"; return b; }, insert(row) { q.op = "insert"; q.payload = row; return b; },
      eq(col, v) { q.filters.push(["eq", col, v]); return b; }, gt(col, v) { q.filters.push(["gt", col, v]); return b; }, in(col, vs) { q.filters.push(["in", col, vs]); return b; },
      order(col) { q.order = col; return b; }, limit(n) { q.limit = n; return b; }, range(a, z) { q.range = [a, z]; return b; }, maybeSingle() { q.single = true; return b; },
      then(res, rej) { const go = () => run(q); const p = sb.delayMs ? new Promise((r) => setTimeout(r, sb.delayMs)).then(go) : Promise.resolve().then(go); return p.then(res, rej); },
    };
    return b;
  }
  function run(q) {
    log.push({ table: q.table, op: q.op, filters: q.filters.slice(), payload: q.payload && clone(q.payload) });
    if (fail && (!fail.table || fail.table === q.table) && (!fail.op || fail.op === q.op) && fail.times > 0) { fail.times--; return { data: null, error: { message: fail.message || "boom", code: fail.code || "XX000" } }; }
    const rows = [...tables[q.table].values()];
    const match = (r) => q.filters.every(([f, col, v]) => f === "eq" ? String(r[col]) === String(v) : f === "gt" ? String(r[col]) > String(v) : f === "in" ? v.map(String).includes(String(r[col])) : true);
    const keyOf = (p) => p.id != null ? p.id : p.name_key;
    if (q.op === "select") {
      let out = rows.filter(match); if (q.order) out.sort((a, b) => String(a[q.order]).localeCompare(String(b[q.order])));
      if (q.range) out = out.slice(q.range[0], q.range[1] + 1); if (q.limit != null) out = out.slice(0, q.limit);
      out = clone(out); return q.single ? { data: out[0] || null, error: null } : { data: out, error: null };
    }
    if (q.op === "update") {
      const hit = rows.filter(match); for (const r of hit) { Object.assign(r, clone(q.payload)); r.updated_at = nextStamp(); }
      return { data: q.wantSelect ? hit.map((r) => ({ updated_at: r.updated_at })) : null, error: null };
    }
    if (q.op === "upsert") { const p = clone(q.payload); const k = keyOf(p); const r = tables[q.table].get(k) || { id: k }; Object.assign(r, p); r.updated_at = nextStamp(); tables[q.table].set(k, r); return { data: q.wantSelect ? [{ updated_at: r.updated_at }] : null, error: null }; }
    if (q.op === "delete") { for (const r of rows.filter(match)) tables[q.table].delete(r.id); return { data: null, error: null }; }
    return { data: null, error: { message: "unsupported " + q.op } };
  }
  const sb = {
    from, tables, log, rpcs, seed, clone, delayMs: 0,
    setFail(f) { fail = f; },
    rpc: async (name, args) => { log.push({ rpc: name, args: clone(args || {}) }); if (!rpcs[name]) return { data: null, error: { code: "PGRST202", message: "Could not find the function public." + name } }; try { return { data: await rpcs[name](args || {}), error: null }; } catch (e) { return { data: null, error: { code: e.code || "P0001", message: e.message } }; } },
    auth: { getSession: async () => ({ data: { session: { user: { email: "coach@test" } } } }), onAuthStateChange() {} },
    storage: {                                                          // Supabase Storage: files by "bucket/path"; fail: { op?, times, message, statusCode } to make calls error
      files: new Map(), fail: null, delayMs: 0,
      from(bucket) {
        const st = sb.storage, wait = () => (st.delayMs ? new Promise((r) => setTimeout(r, st.delayMs)) : Promise.resolve());
        const failing = (op) => { const f = st.fail; if (f && (!f.op || f.op === op) && f.times > 0) { f.times--; return { data: null, error: { message: f.message || "Failed to fetch", statusCode: f.statusCode } }; } return null; };
        return {
          upload: async (path, body, opts) => { log.push({ storage: "upload", bucket, path }); await wait(); const f = failing("upload"); if (f) return f; const k = bucket + "/" + path; if (st.files.has(k) && !(opts && opts.upsert)) return { data: null, error: { message: "The resource already exists" } }; st.files.set(k, body); return { data: { path }, error: null }; },
          download: async (path) => { log.push({ storage: "download", bucket, path }); await wait(); const f = failing("download"); if (f) return f; const b = st.files.get(bucket + "/" + path); return b ? { data: b, error: null } : { data: null, error: { message: "Object not found", statusCode: "404" } }; },
          list: async (prefix) => { log.push({ storage: "list", bucket, prefix }); await wait(); const f = failing("list"); if (f) return f; const head = bucket + "/" + prefix + "/"; return { data: [...st.files.keys()].filter((k) => k.startsWith(head)).map((k) => ({ name: k.slice(head.length) })), error: null }; },
          remove: async (paths) => { log.push({ storage: "remove", bucket, paths: [...paths] }); const f = failing("remove"); if (f) return f; for (const x of paths) st.files.delete(bucket + "/" + x); return { data: [], error: null }; },
        };
      },
    },
  };
  return sb;
}
export { makeSupabase };
