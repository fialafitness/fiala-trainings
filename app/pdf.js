// A small PDF writer: TrueType parsing for the widths, text in Inter (or Helvetica), pages, columns, footers.

export function parseTtf(buf) {                                          // the little we need from a TrueType file: char -> glyph, widths, metrics
  const dv = new DataView(buf), tables = {}, n = dv.getUint16(4);
  for (let i = 0; i < n; i++) { const o = 12 + i * 16; tables[String.fromCharCode(dv.getUint8(o), dv.getUint8(o + 1), dv.getUint8(o + 2), dv.getUint8(o + 3))] = { off: dv.getUint32(o + 8), len: dv.getUint32(o + 12) }; }
  const head = tables.head.off, hhea = tables.hhea.off, upem = dv.getUint16(head + 18), k = 1000 / upem;
  const bbox = [dv.getInt16(head + 36), dv.getInt16(head + 38), dv.getInt16(head + 40), dv.getInt16(head + 42)].map((v) => Math.round(v * k));
  const ascent = Math.round(dv.getInt16(hhea + 4) * k), descent = Math.round(dv.getInt16(hhea + 6) * k), numH = dv.getUint16(hhea + 34);
  const hmtx = tables.hmtx.off, width = (g) => Math.round(dv.getUint16(hmtx + Math.min(g, numH - 1) * 4) * k);
  const cmap = tables.cmap.off, subs = dv.getUint16(cmap + 2); let best = null;
  for (let i = 0; i < subs; i++) {
    const pid = dv.getUint16(cmap + 4 + i * 8), eid = dv.getUint16(cmap + 6 + i * 8), off = dv.getUint32(cmap + 8 + i * 8);
    if (dv.getUint16(cmap + off) === 4 && ((pid === 3 && (eid === 1 || eid === 0)) || pid === 0)) { best = cmap + off; if (pid === 3 && eid === 1) break; }
  }
  const map = new Map();
  if (best != null) {
    const segX2 = dv.getUint16(best + 6), ends = best + 14, starts = ends + segX2 + 2, deltas = starts + segX2, ranges = deltas + segX2;
    for (let sgi = 0; sgi < segX2 / 2; sgi++) {
      const endC = dv.getUint16(ends + sgi * 2), startC = dv.getUint16(starts + sgi * 2), delta = dv.getInt16(deltas + sgi * 2), ro = dv.getUint16(ranges + sgi * 2);
      if (startC === 0xffff) continue;
      for (let c = startC; c <= endC; c++) {
        let g;
        if (ro === 0) g = (c + delta) & 0xffff;
        else { const gi = ranges + sgi * 2 + ro + (c - startC) * 2; if (gi + 1 >= buf.byteLength) continue; g = dv.getUint16(gi); if (g) g = (g + delta) & 0xffff; }
        if (g) map.set(c, g);
      }
    }
  }
  return { bytes: new Uint8Array(buf), bbox, ascent, descent, gid: (ch) => map.get(ch.codePointAt(0)) || 0, width };
}

export function pdfDoc(fonts) {
  const W = 612, H = 792, M = 54, BOTTOM = 64;                     // US Letter, 3/4 inch margins
  const pages = []; let cur = null, y = 0;
  const used = { regular: new Map(), bold: new Map() };            // glyph -> character, for the widths table and copy-paste text
  const latin = (str) => Array.from(String(str)).map((ch) => ch.charCodeAt(0) <= 0xff ? ch : ch.normalize("NFD").replace(/[̀-ͯ]/g, "")).join("").replace(/[^\x20-\x7e\xa0-\xff]/g, "?");
  const measure = (str, size, bold) => {
    if (!fonts) return String(str).length * size * 0.5;
    const f = bold ? fonts.bold : fonts.regular; let w = 0;
    for (const ch of String(str)) w += f.width(f.gid(ch) || f.gid("?"));
    return w * size / 1000;
  };
  const show = (str, bold) => {                                   // the text operand: glyph ids with Inter, Latin-1 with Helvetica
    if (!fonts) return "(" + latin(str).replace(/[\\()]/g, (m) => "\\" + m) + ")";
    const f = bold ? fonts.bold : fonts.regular, u = bold ? used.bold : used.regular; let hex = "";
    for (const ch of String(str)) { let g = f.gid(ch), cp = ch.codePointAt(0); if (!g) { g = f.gid("?"); cp = 63; } u.set(g, cp); hex += g.toString(16).padStart(4, "0"); }
    return "<" + hex + ">";
  };
  const wrap = (str, size, bold, maxW) => { const lines = []; let line = ""; for (const w of String(str).split(/\s+/)) { const t = line ? line + " " + w : w; if (measure(t, size, bold) > maxW && line) { lines.push(line); line = w; } else line = t; } lines.push(line); return lines; };
  const clip = (str, size, bold, maxW) => { let t = String(str); if (measure(t, size, bold) <= maxW) return t; while (t.length && measure(t + "…", size, bold) > maxW) t = t.slice(0, -1); return t.trimEnd() + "…"; };
  const newPage = () => { cur = []; pages.push(cur); y = H - M; };
  const need = (h) => { if (!cur || y - h < BOTTOM) newPage(); };
  const op = (x, yy, str, size, bold, color) => cur.push(color + " rg BT /" + (bold ? "F2" : "F1") + " " + size + " Tf " + x.toFixed(1) + " " + yy.toFixed(1) + " Td " + show(str, bold) + " Tj ET");
  const text = (str, { size = 11, bold = false, indent = 0, color = "0 0 0", gap = 3, maxW = W - 2 * M - indent } = {}) => {
    for (const para of String(str).split("\n")) for (const line of wrap(para, size, bold, maxW)) { need(size + gap); y -= size; op(M + indent, y, line, size, bold, color); y -= gap; }
  };
  const row = (cells, { size = 10.5, gap = 5 } = {}) => {        // one baseline, several columns; a cell: { x | right, text, size, bold, color, maxW }
    need(size + gap); y -= size;
    for (const c of cells) { const sz = c.size || size, bold = !!c.bold, str = c.maxW ? clip(c.text, sz, bold, c.maxW) : String(c.text); op(c.right != null ? c.right - measure(str, sz, bold) : c.x, y, str, sz, bold, c.color || "0 0 0"); }
    y -= gap;
  };
  const space = (h) => { y -= h; };
  const rule = (color = "0.88 0.88 0.9") => { need(10); y -= 3; cur.push(color + " RG 0.6 w " + M + " " + y.toFixed(1) + " m " + (W - M) + " " + y.toFixed(1) + " l S"); y -= 7; };
  const section = (title) => { need(72); y -= 16; y -= 13; op(M, y, title, 13, true, "0 0 0"); y -= 4; rule("0.80 0.80 0.83"); };   // a heading never sits alone at the foot of a page
  const footer = (left) => {                                      // on every page: who and which month, and "1 of 2"
    pages.forEach((pg, i) => { const keep = cur; cur = pg; const yy = 36, sz = 8.5, c = "0.55 0.55 0.58"; op(M, yy, left, sz, false, c); const r = (i + 1) + " of " + pages.length; op(W - M - measure(r, sz, false), yy, r, sz, false, c); cur = keep; });
  };
  const bytes = () => {
    const parts = []; let len = 0; const offs = [];
    const put = (x) => { const u = typeof x === "string" ? Uint8Array.from(x, (ch) => ch.charCodeAt(0) & 0xff) : x; parts.push(u); len += u.length; };
    const objs = []; const add = (o) => { objs.push(o); return objs.length; };
    add("<< /Type /Catalog /Pages 2 0 R >>"); add(""); add("");    // 2: pages, 3: resources, filled below
    let f1, f2;
    if (fonts) {
      const embed = (f, u, name) => {
        const ff = add({ pre: "<< /Length " + f.bytes.length + " /Length1 " + f.bytes.length + " >>\nstream\n", bin: f.bytes, post: "\nendstream" });
        const fd = add("<< /Type /FontDescriptor /FontName /" + name + " /Flags 32 /FontBBox [" + f.bbox.join(" ") + "] /ItalicAngle 0 /Ascent " + f.ascent + " /Descent " + f.descent + " /CapHeight 700 /StemV 80 /FontFile2 " + ff + " 0 R >>");
        const gids = [...u.keys()].sort((a, b) => a - b);
        const cid = add("<< /Type /Font /Subtype /CIDFontType2 /BaseFont /" + name + " /CIDSystemInfo << /Registry (Adobe) /Ordering (Identity) /Supplement 0 >> /FontDescriptor " + fd + " 0 R /DW 1000 /W [" + gids.map((g) => g + " [" + f.width(g) + "]").join(" ") + "] /CIDToGIDMap /Identity >>");
        let cm = "/CIDInit /ProcSet findresource begin\n12 dict begin\nbegincmap\n/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def\n/CMapName /Adobe-Identity-UCS def\n/CMapType 2 def\n1 begincodespacerange\n<0000> <FFFF>\nendcodespacerange\n";
        for (let i = 0; i < gids.length; i += 100) { const chunk = gids.slice(i, i + 100); cm += chunk.length + " beginbfchar\n" + chunk.map((g) => "<" + g.toString(16).padStart(4, "0") + "> <" + u.get(g).toString(16).padStart(4, "0") + ">").join("\n") + "\nendbfchar\n"; }
        cm += "endcmap\nCMapName currentdict /CMap defineresource pop\nend\nend";
        const tu = add("<< /Length " + cm.length + " >>\nstream\n" + cm + "\nendstream");
        return add("<< /Type /Font /Subtype /Type0 /BaseFont /" + name + " /Encoding /Identity-H /DescendantFonts [" + cid + " 0 R] /ToUnicode " + tu + " 0 R >>");
      };
      f1 = embed(fonts.regular, used.regular, "Inter-Regular"); f2 = embed(fonts.bold, used.bold, "Inter-Bold");
    } else {
      f1 = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>"); f2 = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");
    }
    objs[2] = "<< /Font << /F1 " + f1 + " 0 R /F2 " + f2 + " 0 R >> >>";
    const kids = [];
    for (const pg of pages) {
      const stream = pg.join("\n");
      const c = add("<< /Length " + stream.length + " >>\nstream\n" + stream + "\nendstream");
      kids.push(add("<< /Type /Page /Parent 2 0 R /MediaBox [0 0 " + W + " " + H + "] /Resources 3 0 R /Contents " + c + " 0 R >>") + " 0 R");
    }
    objs[1] = "<< /Type /Pages /Kids [" + kids.join(" ") + "] /Count " + kids.length + " >>";
    put("%PDF-1.4\n%\xe2\xe3\xcf\xd3\n");
    objs.forEach((o, i) => { offs.push(len); put((i + 1) + " 0 obj\n"); if (typeof o === "string") put(o); else { put(o.pre); put(o.bin); put(o.post); } put("\nendobj\n"); });
    const xref = len;
    put("xref\n0 " + (objs.length + 1) + "\n0000000000 65535 f \n" + offs.map((o) => String(o).padStart(10, "0") + " 00000 n \n").join(""));
    put("trailer\n<< /Size " + (objs.length + 1) + " /Root 1 0 R >>\nstartxref\n" + xref + "\n%%EOF");
    const out = new Uint8Array(len); let at = 0; for (const u of parts) { out.set(u, at); at += u.length; }
    return out;
  };
  newPage();
  return { text, row, space, rule, section, footer, bytes, wrap, keep: need, M, W };
}
