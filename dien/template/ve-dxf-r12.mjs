// Bộ vẽ DXF R12 (AC1009) tự viết — không phụ thuộc thư viện.
//
// Dùng khi cần file gọn (ít hơn khoảng 3 lần số dòng so với bản AutoCAD 2007) hoặc khi bản
// AutoCAD 2007 tạo bằng thư viện gặp lỗi trên máy của team. Khác biệt so với bản 2007:
//  - Màu theo layer dùng màu AutoCAD chuẩn (ACI) gần nhất, không có màu RGB.
//  - Nền tô (ô xám, mũi tên, chấm tròn) dùng SOLID / POLYLINE có bề rộng thay cho HATCH.
//  - Ghi chú nhiều dòng (MTEXT) được tách thành các dòng TEXT.
//  - Chữ tiếng Việt ghi dạng \U+XXXX (AutoCAD tự hiển thị đúng).
// Đơn vị mm, trục y hướng lên.

import { FONT, LAYERS } from "./mau-indust.mjs";

const HA = { left: 0, center: 1, right: 2 };
const VA = { baseline: 0, bottom: 1, middle: 2, top: 3 };
const STYLE = { normal: "IND-ARIAL", bold: "IND-ARIAL-DAM" };
const EM = 1 / 0.716;

const r3 = (v) => Math.round(v * 1000) / 1000;
const num = (v) => { const x = r3(v); return Number.isInteger(x) ? x.toFixed(1) : String(x); };
const enc = (s) => [...String(s)].map((ch) => {
  const cp = ch.codePointAt(0);
  return cp < 128 ? ch : "\\U+" + cp.toString(16).toUpperCase().padStart(4, "0");
}).join("");

export function taoDxfR12() {
  const model = [];
  const blocks = new Map();            // tên → { attdefs, body: [] }
  let out = model;
  const g = (code, v) => out.push(String(code), String(v));
  const lay = (k) => LAYERS[k][0];
  const pt = (base, x, y) => { g(base, num(x)); g(base + 10, num(y)); g(base + 20, "0.0"); };

  const solid = (layer, a, b, c, d) => {           // SOLID: thứ tự đỉnh 1-2-4-3 cho tứ giác
    g(0, "SOLID"); g(8, lay(layer));
    pt(10, ...a); pt(11, ...b); pt(12, ...(d || c)); pt(13, ...c);
  };

  const gg = {
    line(layer, x1, y1, x2, y2) {
      g(0, "LINE"); g(8, lay(layer)); pt(10, x1, y1); pt(11, x2, y2);
    },
    rect(layer, x0, y0, x1, y1) {
      gg.poly(layer, [[x0, y0], [x1, y0], [x1, y1], [x0, y1]], true);
    },
    poly(layer, pts, closed) {
      const n = closed ? pts.length : pts.length - 1;
      for (let i = 0; i < n; i++) gg.line(layer, ...pts[i], ...pts[(i + 1) % pts.length]);
    },
    fill(layer, pts) {
      if (pts.length === 4 && isConvex(pts)) { solid(layer, pts[0], pts[1], pts[2], pts[3]); return; }
      for (const [a, b, c] of triangulate(pts)) solid(layer, a, b, c);
    },
    circle(layer, x, y, r, opt = {}) {
      if (opt.fill) {                                // chấm tròn đặc = POLYLINE 2 đỉnh cung, bề rộng = r
        g(0, "POLYLINE"); g(8, lay(layer)); g(66, 1); pt(10, 0, 0); g(70, 1); g(40, num(r)); g(41, num(r));
        for (const sx of [-1, 1]) { g(0, "VERTEX"); g(8, lay(layer)); pt(10, x + (sx * r) / 2, y); g(42, "1.0"); }
        g(0, "SEQEND"); g(8, lay(layer));
      }
      g(0, "CIRCLE"); g(8, lay(layer)); pt(10, x, y); g(40, num(r));
    },
    text(layer, x, y, h, s, opt = {}) {
      if (s == null || s === "") return;
      const ha = HA[opt.ha || "left"], va = VA[opt.va || "baseline"];
      g(0, "TEXT"); g(8, lay(layer)); pt(10, x, y); g(40, num(h)); g(1, enc(s));
      if (opt.rot) g(50, num(opt.rot));
      if (opt.wf && opt.wf !== 1) g(41, num(opt.wf));
      g(7, opt.bold ? STYLE.bold : STYLE.normal);
      if (ha || va) { g(72, ha); pt(11, x, y); g(73, va); }
    },
    mtext(layer, x, y, h, s, width) {
      // tách dòng theo độ rộng ước lượng (giống bản xem trước SVG)
      const charW = 0.5 * h * EM;
      const maxChars = Math.max(8, Math.floor(width / charW));
      const lines = [];
      for (const para of String(s).split("\n")) {
        if (!para) { lines.push(""); continue; }
        let cur = "";
        for (const w of para.split(" ")) {
          if ((cur + " " + w).trim().length > maxChars) { lines.push(cur); cur = w; } else cur = (cur + " " + w).trim();
        }
        lines.push(cur);
      }
      lines.forEach((ln, i) => gg.text(layer, x, y - h - (i * h * 5) / 3, h, ln));
    },
    defineBlock(name, build, attdefs = []) {
      if (blocks.has(name)) return;
      const body = [];
      const prev = out;
      out = body;
      build(gg);
      for (const a of attdefs) {
        const p = attrPos(a, a.dx, a.dy);
        g(0, "ATTDEF"); g(8, lay(a.layer)); pt(10, ...p.pos); g(40, num(a.h)); g(1, "");
        if (a.rot) g(50, num(a.rot));
        g(7, a.bold ? STYLE.bold : STYLE.normal);
        if (p.ha) { g(72, p.ha); pt(11, ...p.pos); }
        g(3, a.tag); g(2, a.tag); g(70, 0);
      }
      out = prev;
      blocks.set(name, { attdefs, body });
    },
    insert(name, x, y, values = {}) {
      const b = blocks.get(name);
      if (!b) throw new Error(`Chưa định nghĩa block ${name}`);
      g(0, "INSERT"); g(8, lay("LINE"));
      if (b.attdefs.length) g(66, 1);
      g(2, name); pt(10, x, y);
      if (!b.attdefs.length) return;
      for (const a of b.attdefs) {
        const p = attrPos(a, x + a.dx, y + a.dy);
        const v = values[a.tag];
        g(0, "ATTRIB"); g(8, lay(a.layer)); pt(10, ...p.pos); g(40, num(a.h)); g(1, enc(v == null ? "" : v));
        if (a.rot) g(50, num(a.rot));
        g(7, a.bold ? STYLE.bold : STYLE.normal);
        if (p.ha) { g(72, p.ha); pt(11, ...p.pos); }
        g(2, a.tag); g(70, 0);
      }
      g(0, "SEQEND"); g(8, lay("LINE"));
    },
    toString() {
      const all = [];
      out = all;
      g(0, "SECTION"); g(2, "HEADER");
      g(9, "$ACADVER"); g(1, "AC1009");
      g(9, "$DWGCODEPAGE"); g(3, "ANSI_1258");
      g(9, "$INSBASE"); pt(10, 0, 0);
      g(9, "$EXTMIN"); pt(10, 0, 0);
      g(9, "$EXTMAX"); pt(10, 420, 297);
      g(9, "$LIMMIN"); g(10, "0.0"); g(20, "0.0");
      g(9, "$LIMMAX"); g(10, "420.0"); g(20, "297.0");
      g(9, "$TEXTSTYLE"); g(7, STYLE.normal);
      g(9, "$CLAYER"); g(8, "0");
      g(0, "ENDSEC");

      g(0, "SECTION"); g(2, "TABLES");
      g(0, "TABLE"); g(2, "LTYPE"); g(70, 1);
      g(0, "LTYPE"); g(2, "CONTINUOUS"); g(70, 0); g(3, "Solid line"); g(72, 65); g(73, 0); g(40, "0.0");
      g(0, "ENDTAB");
      const layers = [["0", 7], ...Object.values(LAYERS).map(([n, aci]) => [n, aci])];
      g(0, "TABLE"); g(2, "LAYER"); g(70, layers.length);
      for (const [n, c] of layers) { g(0, "LAYER"); g(2, n); g(70, 0); g(62, c); g(6, "CONTINUOUS"); }
      g(0, "ENDTAB");
      const styles = [["STANDARD", "txt"], [STYLE.normal, FONT.normal], [STYLE.bold, FONT.bold]];
      g(0, "TABLE"); g(2, "STYLE"); g(70, styles.length);
      for (const [n, f] of styles) {
        g(0, "STYLE"); g(2, n); g(70, 0); g(40, "0.0"); g(41, "1.0"); g(50, "0.0"); g(71, 0); g(42, "2.5"); g(3, f); g(4, "");
      }
      g(0, "ENDTAB");
      g(0, "ENDSEC");

      g(0, "SECTION"); g(2, "BLOCKS");
      for (const [name, b] of blocks) {
        g(0, "BLOCK"); g(8, "0"); g(2, name); g(70, b.attdefs.length ? 2 : 0); pt(10, 0, 0); g(3, name);
        all.push(...b.body);
        g(0, "ENDBLK"); g(8, "0");
      }
      g(0, "ENDSEC");

      g(0, "SECTION"); g(2, "ENTITIES");
      all.push(...model);
      g(0, "ENDSEC");
      g(0, "EOF");
      out = model;
      return all.join("\n") + "\n";
    },
  };
  return gg;
}

// Thuộc tính: chỉ căn ngang; căn dọc quy về đường chân chữ (giống ve-dxf.mjs)
function attrPos(a, x, y) {
  const shift = { middle: -a.h / 2, top: -a.h, bottom: 0.21 * a.h, baseline: 0 }[a.va || "baseline"];
  const rad = ((a.rot || 0) * Math.PI) / 180;
  return { pos: [x - Math.sin(rad) * shift, y + Math.cos(rad) * shift], ha: HA[a.ha || "left"] };
}

// --- Hình học phụ trợ cho tô nền --------------------------------------------
const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
const area = (pts) => pts.reduce((s, p, i) => s + cross([0, 0], p, pts[(i + 1) % pts.length]), 0) / 2;

function isConvex(pts) {
  let sign = 0;
  for (let i = 0; i < pts.length; i++) {
    const c = cross(pts[i], pts[(i + 1) % pts.length], pts[(i + 2) % pts.length]);
    if (Math.abs(c) < 1e-9) continue;
    if (sign && Math.sign(c) !== sign) return false;
    sign = Math.sign(c);
  }
  return true;
}

// Cắt tai (ear clipping) cho đa giác đơn — đủ dùng cho mũi tên, dấu +, chấm tròn
function triangulate(input) {
  const pts = area(input) < 0 ? [...input].reverse() : [...input];
  const idx = pts.map((_, i) => i);
  const tris = [];
  const inside = (p, a, b, c) => cross(a, b, p) > 0 && cross(b, c, p) > 0 && cross(c, a, p) > 0;
  let guard = 0;
  while (idx.length > 3 && guard++ < 1000) {
    let cut = false;
    for (let k = 0; k < idx.length; k++) {
      const ia = idx[(k + idx.length - 1) % idx.length], ib = idx[k], ic = idx[(k + 1) % idx.length];
      const [a, b, c] = [pts[ia], pts[ib], pts[ic]];
      if (cross(a, b, c) <= 1e-12) continue;
      if (idx.some((j) => j !== ia && j !== ib && j !== ic && inside(pts[j], a, b, c))) continue;
      tris.push([a, b, c]);
      idx.splice(k, 1);
      cut = true;
      break;
    }
    if (!cut) break;
  }
  if (idx.length === 3) tris.push(idx.map((i) => pts[i]));
  return tris;
}
