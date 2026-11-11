// Bộ vẽ SVG — xem trước bản vẽ trên trình duyệt / để so với bản mẫu.
// Đơn vị mm, trục y hướng lên (giống DXF); khi ghi SVG mới lật trục.

import { LAYERS, SHEET } from "./mau-indust.mjs";

const rgb = (k) => `rgb(${LAYERS[k][2].join(",")})`;
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const f = (n) => +n.toFixed(3);
// AutoCAD: chiều cao chữ TrueType ≈ chiều cao chữ hoa → cỡ chữ SVG ≈ h / 0,716 (Arial)
const EM = 1 / 0.716;
const STROKE = 0.25;

export function taoSvg() {
  const parts = [];
  const blocks = new Map();
  let ox = 0, oy = 0;                         // gốc hiện hành (khi đang vẽ block)
  const sx = (x) => f(x + ox);
  const sy = (y) => f(SHEET.h - (y + oy));

  const baselineDy = (va, h) => ({ middle: -h / 2, top: -h, bottom: 0.21 * h, baseline: 0 }[va || "baseline"]);

  const g = {
    line(layer, x1, y1, x2, y2) {
      parts.push(`<line x1="${sx(x1)}" y1="${sy(y1)}" x2="${sx(x2)}" y2="${sy(y2)}" stroke="${rgb(layer)}" stroke-width="${STROKE}"/>`);
    },
    rect(layer, x0, y0, x1, y1) {
      g.poly(layer, [[x0, y0], [x1, y0], [x1, y1], [x0, y1]], true);
    },
    poly(layer, pts, closed) {
      const d = pts.map(([x, y]) => `${sx(x)},${sy(y)}`).join(" ");
      parts.push(`<${closed ? "polygon" : "polyline"} points="${d}" fill="none" stroke="${rgb(layer)}" stroke-width="${STROKE}"/>`);
    },
    fill(layer, pts) {
      const d = pts.map(([x, y]) => `${sx(x)},${sy(y)}`).join(" ");
      parts.push(`<polygon points="${d}" fill="${rgb(layer)}" stroke="none"/>`);
    },
    circle(layer, x, y, r, opt = {}) {
      parts.push(`<circle cx="${sx(x)}" cy="${sy(y)}" r="${f(r)}" fill="${opt.fill ? rgb(layer) : "none"}" stroke="${rgb(layer)}" stroke-width="${STROKE}"/>`);
    },
    text(layer, x, y, h, s, opt = {}) {
      if (s == null || s === "") return;
      const rot = opt.rot || 0;
      const anchor = { left: "start", center: "middle", right: "end" }[opt.ha || "left"];
      // dịch theo hướng "lên" của chữ, (-sin a, cos a), để đưa điểm căn về đường chân chữ
      const dy = baselineDy(opt.va, h);
      const a = (rot * Math.PI) / 180;
      const bx = x - Math.sin(a) * dy;
      const by = y + Math.cos(a) * dy;
      const tx = sx(bx), ty = sy(by);
      const wf = opt.wf && opt.wf !== 1 ? opt.wf : 0;
      const tr = rot || wf
        ? ` transform="translate(${tx} ${ty})${rot ? ` rotate(${-rot})` : ""}${wf ? ` scale(${wf} 1)` : ""}"` : "";
      const [ax, ay] = tr ? [0, 0] : [tx, ty];
      parts.push(`<text x="${ax}" y="${ay}" font-family="Arial, Helvetica, sans-serif" font-size="${f(h * EM)}"${opt.bold ? ' font-weight="bold"' : ""} text-anchor="${anchor}" fill="${rgb(layer)}"${tr}>${esc(s)}</text>`);
    },
    mtext(layer, x, y, h, s, width) {
      // ngắt dòng đơn giản theo độ rộng ước lượng (Arial ≈ 0,5 em mỗi ký tự)
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
      lines.forEach((ln, i) => g.text(layer, x, y - h - i * h * 5 / 3, h, ln));
    },
    defineBlock(name, build, attdefs = []) {
      blocks.set(name, { build, attdefs });
    },
    insert(name, x, y, values = {}) {
      const b = blocks.get(name);
      if (!b) throw new Error(`Chưa định nghĩa block ${name}`);
      const [px, py] = [ox, oy];
      ox += x; oy += y;
      b.build(g);
      ox = px; oy = py;
      for (const a of b.attdefs) {
        const v = values[a.tag];
        if (v == null || v === "") continue;
        g.text(a.layer, x + a.dx, y + a.dy, a.h, v, { ha: a.ha, va: a.va, rot: a.rot, bold: a.bold });
      }
    },
    toString() {
      return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${SHEET.w}mm" height="${SHEET.h}mm" viewBox="0 0 ${SHEET.w} ${SHEET.h}">\n<rect width="100%" height="100%" fill="#fff"/>\n${parts.join("\n")}\n</svg>\n`;
    },
  };
  return g;
}
