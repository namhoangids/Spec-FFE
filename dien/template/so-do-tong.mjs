// Tờ "SƠ ĐỒ NGUYÊN LÝ CẤP ĐIỆN TỔNG" — cây tủ vẽ từ trên xuống, cùng khung tên và màu với tờ E.601.
//
// Mỗi tủ là một khung chữ nhật (tên tủ, cỡ vỏ, Ptt, số bản vẽ của tủ). Từ tủ cha đi xuống mỗi tủ con:
// thanh cái nhánh → CB lộ cấp (block IND_CB có thuộc tính) kèm mã lộ, pha → chữ cáp và ống dọc
// đường nối → CB tổng của tủ con → khung tủ con. Dưới cây là bảng tổng hợp phụ tải.
//
// Dữ liệu vào: engine/sang-ban-ve.mjs → sangSoDoTong(). Giao diện vẽ `g` giống veSoDoTu, nên ra được
// SVG, DXF 2007 và DXF R12.

import { doRongChu } from "./do-rong-chu.mjs";
import { CB, H, VUNG_VE, WF, cbAttribs, defineBlocks, rectPts, veKhungTen, veKhungTo } from "./mau-indust.mjs";

// Kích thước (mm)
const K = {
  le: 6,                    // lề trong vùng vẽ
  buocMax: 52,              // bước ngang tối đa giữa hai tủ lá
  buocMin: 34,              // nhỏ hơn thì cảnh báo chữ có thể chồng nhau
  hop: { w: 40, h: 18, dong: [5.0, 9.0, 12.6, 16.0] },   // khung tủ: cao 18, toạ độ các dòng chữ tính từ đỉnh
  cbTren: 9,                // chấm tròn CB tổng tủ nằm trên đỉnh khung
  cbThan: -(CB.ocDy - CB.ocR),   // chiều dài thân ký hiệu CB (≈ 6,6 mm)
  nguon: 16,                // đoạn đường nguồn phía trên CB tổng tủ gốc
  ats: { them: 34, w: 36, h: 10, lech: 34 },   // có nguồn dự phòng: thêm chiều cao, khung ATS, khoảng lệch 2 nguồn
  chan: 6,                  // từ đáy khung tủ cha xuống thanh cái nhánh
  cbLo: 6,                  // từ thanh cái nhánh xuống chấm tròn CB lộ cấp (nhãn CB không chạm thanh cái)
  cap: { dai: 52, min: 18 },     // đoạn cáp giữa CB lộ cấp và CB tổng tủ con (tự rút ngắn khi cây sâu)
  bang: { dong: 5.5, h: 1.8, tieuDe: 7 },
};
const COT_BANG = [
  ["TỦ", 18, "ten"], ["CẤP TỪ", 26, "capTu"], ["SỐ PHA", 14, "soPha"], ["Pđ (kW)", 16, "pd"], ["Kđt", 12, "ks"],
  ["Ptt (kW)", 16, "ptt"], ["Itt (A)", 14, "itt"], ["CB TỔNG", 40, "cbTong"], ["CÁP CẤP", 70, "capCap"],
  ["ΔU (%)", 14, "du"], ["Ik (kA)", 14, "ik"], ["BẢN VẼ", 24, "soBanVe"],
];

/**
 * @param {object} g — giao diện vẽ
 * @param {object} d — { sheet, nguon: [{ma, cable, conduit}], nodes: [cây tủ], bang: [dòng] }
 * @returns {string[]} cảnh báo bố cục
 */
export function veSoDoTong(g, d) {
  const warnings = [];
  defineBlocks(g);
  veKhungTo(g, d.sheet);

  // --- Bảng tổng hợp phụ tải (đáy vùng vẽ) ------------------------------------
  const B = { ...K.bang, dong: d.bang.length > 8 ? 4.6 : K.bang.dong };
  const wBang = COT_BANG.reduce((a, c) => a + c[1], 0);
  const xb0 = (VUNG_VE.x0 + VUNG_VE.x1) / 2 - wBang / 2;
  const yb0 = VUNG_VE.y0 + K.le;                                  // đáy bảng
  const soDong = d.bang.length + 1;
  const ybTop = yb0 + soDong * B.dong;                            // đỉnh bảng
  g.text("TITLE", xb0, ybTop + B.tieuDe / 2, H.label, "BẢNG TỔNG HỢP PHỤ TẢI", { va: "middle", bold: true });
  g.fill("CELL", rectPts(xb0, ybTop - B.dong, xb0 + wBang, ybTop));
  for (let r = 0; r <= soDong; r++) g.line("LINE", xb0, yb0 + r * B.dong, xb0 + wBang, yb0 + r * B.dong);
  let xc = xb0;
  for (const [, w] of COT_BANG) { g.line("LINE", xc, yb0, xc, ybTop); xc += w; }
  g.line("LINE", xc, yb0, xc, ybTop);
  const dongChu = (cells, r, bold) => {
    let x = xb0;
    cells.forEach((s, i) => {
      const w = COT_BANG[i][1];
      const h = vuaChu(String(s ?? ""), B.h, w - 1.5, `bảng tổng hợp cột ${COT_BANG[i][0]}`, { bold });
      g.text("TEXT", x + w / 2, ybTop - (r + 0.5) * B.dong, h, String(s ?? ""), { ha: "center", va: "middle", bold });
      x += w;
    });
  };
  dongChu(COT_BANG.map((c) => c[0]), 0, true);
  d.bang.forEach((row, i) => dongChu(COT_BANG.map((c) => row[c[2]]), i + 1, false));

  // --- Bố cục cây ---------------------------------------------------------------
  const goc = d.nodes || [];
  const sau = (n) => 1 + Math.max(0, ...n.children.map(sau));
  const doSau = Math.max(1, ...goc.map(sau));
  const yTop = VUNG_VE.yDuoiTieuDe - 4;
  const coAts = (d.nguon || []).some((ng) => ng?.duPhong);
  const kNguon = K.nguon + (coAts ? K.ats.them : 0);
  const yDay = ybTop + B.tieuDe + 8;
  const capTang = () => K.hop.h + K.chan + K.cbLo + K.cbThan + capDai + K.cbTren;
  let capDai = K.cap.dai;
  const can = kNguon + K.cbTren + K.hop.h + (doSau - 1) * capTang();
  const co = yTop - yDay;
  if (can > co && doSau > 1) {
    capDai = Math.max(K.cap.min, capDai - (can - co) / (doSau - 1));
    if (kNguon + K.cbTren + K.hop.h + (doSau - 1) * capTang() > co) warnings.push(`Cây tủ sâu ${doSau} cấp — không đủ chỗ trên một tờ A3, các cấp có thể chồng lên bảng tổng hợp.`);
  }

  // Toạ độ ngang: các tủ lá chia đều, tủ cha nằm giữa các con
  const la = [];
  const duyet = (n) => { if (!n.children.length) la.push(n); else n.children.forEach(duyet); };
  goc.forEach(duyet);
  const rong = VUNG_VE.x1 - VUNG_VE.x0 - 2 * K.le;
  const buoc = Math.min(K.buocMax, rong / Math.max(1, la.length));
  if (buoc < K.buocMin) warnings.push(`${la.length} tủ cùng hàng — bước ngang còn ${buoc.toFixed(1)} mm, chữ có thể chồng nhau.`);
  const wHop = Math.min(K.hop.w, buoc - 8);
  const xDau = (VUNG_VE.x0 + VUNG_VE.x1) / 2 - (buoc * la.length) / 2 + buoc / 2;
  la.forEach((n, i) => { n._x = xDau + i * buoc; });
  const ganX = (n) => {
    if (n.children.length) { n.children.forEach(ganX); n._x = (n.children[0]._x + n.children.at(-1)._x) / 2; }
  };
  goc.forEach(ganX);

  // --- Vẽ ---------------------------------------------------------------------------
  const yHopGoc = yTop - kNguon - K.cbTren;       // đỉnh khung tủ gốc
  goc.forEach((n, i) => {
    const x = n._x;
    const ng = (d.nguon || [])[i] || {};
    if (ng.duPhong) veAts(x, ng);
    else {
      // Đường nguồn + mũi tên + chữ cáp nguồn bên phải
      g.line("LINE", x, yTop, x, yHopGoc + K.cbTren);
      g.fill("LINE", [[x, yTop - 5.5], [x - 0.73, yTop - 3], [x + 0.73, yTop - 3]]);   // mũi tên hướng xuống
      g.text("TEXT", x + 2, yTop + 1.2, H.label, "NGUỒN ĐIỆN", { va: "middle", bold: true });
      [ng.cable, ng.conduit].filter(Boolean).forEach((s, k) =>
        g.text("TEXT", x + 2, yTop - 4 - k * 3.6, vuaChu(s, H.label, buoc / 2 + 60, "cáp nguồn"), s, { va: "middle" }));
    }
    veNut(n, yHopGoc);
  });

  veKhungTen(g, d.sheet);
  return warnings;

  // Hai nguồn (lưới bên trái, dự phòng bên phải) → khung ATS → CB tổng tủ gốc
  function veAts(x, ng) {
    const A = K.ats, dp = ng.duPhong;
    const xL = x - A.lech, xR = x + A.lech;
    const yAtsTren = yTop - 22, yAtsDuoi = yAtsTren - A.h;
    const xVaoL = x - A.w / 4, xVaoR = x + A.w / 4;
    const nguonVao = (xs, xVao, ten, caps, phai) => {
      g.line("LINE", xs, yTop, xs, yAtsTren + 5);
      g.line("LINE", xs, yAtsTren + 5, xVao, yAtsTren + 5);
      g.line("LINE", xVao, yAtsTren + 5, xVao, yAtsTren);
      g.fill("LINE", [[xs, yTop - 5.5], [xs - 0.73, yTop - 3], [xs + 0.73, yTop - 3]]);
      const tx = phai ? xs + 2 : xs - 2, ha = phai ? "left" : "right";
      g.text("TEXT", tx, yTop + 1.2, H.label, ten, { ha, va: "middle", bold: true });
      caps.filter(Boolean).forEach((s, k) =>
        g.text("TEXT", tx, yTop - 4 - k * 3.6, vuaChu(s, H.label, 80, "cáp nguồn"), s, { ha, va: "middle" }));
    };
    nguonVao(xL, xVaoL, ng.duPhong.chinh, [ng.cable, ng.conduit], false);
    nguonVao(xR, xVaoR, dp.ten, [dp.cable, ng.conduit], true);
    g.rect("LINE", x - A.w / 2, yAtsDuoi, x + A.w / 2, yAtsTren);
    g.text("TEXT", x, yAtsTren - 3.6, vuaChu(dp.ats, 2.2, A.w - 2, "ATS", { bold: true }), dp.ats, { ha: "center", va: "middle", bold: true });
    g.text("TEXT", x, yAtsTren - 7.4, 1.6, "TỰ ĐỘNG CHUYỂN NGUỒN", { ha: "center", va: "middle" });
    g.line("LINE", x, yAtsDuoi, x, yHopGoc + K.cbTren);
  }

  // Khung tủ có đỉnh ở yHop; CB tổng của tủ nằm ngay trên đỉnh; rồi các nhánh con bên dưới
  function veNut(n, yHop) {
    const x = n._x;
    const yCb = yHop + K.cbTren;
    g.insert("IND_CB", x, yCb, cbAttribs(n.incomer));
    g.line("LINE", x, yCb - K.cbThan, x, yHop);
    g.rect("LINE", x - wHop / 2, yHop - K.hop.h, x + wHop / 2, yHop);
    const dong = [
      [n.ten, 2.5, true], [n.voTu, 1.8, false], [n.ptt, 1.8, false], [n.soBanVe ? `XEM ${n.soBanVe}` : "", 1.6, false],
    ];
    dong.forEach(([s, h, bold], k) => {
      if (!s) return;
      g.text("TEXT", x, yHop - K.hop.dong[k], vuaChu(s, h, wHop - 2, `khung tủ ${n.ten}`, { bold }), s, { ha: "center", va: "middle", bold });
    });
    if (!n.children.length) return;

    const yBus = yHop - K.hop.h - K.chan;
    g.line("LINE", x, yHop - K.hop.h, x, yBus);
    const xs = n.children.map((c) => c._x);
    if (xs.length > 1 || xs[0] !== x) g.line("LINE", Math.min(x, ...xs), yBus, Math.max(x, ...xs), yBus);
    for (const c of n.children) {
      const cx = c._x;
      const yLo = yBus - K.cbLo;
      g.line("LINE", cx, yBus, cx, yLo);
      if (c.feeder) {
        g.insert("IND_CB", cx, yLo, cbAttribs(c.feeder.device));
        g.text("TEXT", cx - 4.2, yLo - 1, H.label, c.feeder.code || "", { ha: "right", va: "middle", bold: true });
        if (c.feeder.phase) g.text("TEXT", cx - 4.2, yLo - 4.4, 1.8, `PHA ${c.feeder.phase}`, { ha: "right", va: "middle" });
      }
      const yCapTren = yLo - K.cbThan;
      const yHopCon = yCapTren - capDai - K.cbTren;
      g.line("LINE", cx, yCapTren, cx, yHopCon + K.cbTren);
      // Chữ cáp (trái đường) và ống (phải đường), viết dọc từ dưới lên như tờ tủ.
      // Bên trái chỉ vướng lưỡi dao của CB tủ con; bên phải còn vướng 4 dòng nhãn của hai CB.
      if (c.feeder) {
        const yDot = yHopCon + K.cbTren;
        const trai = [yDot + 1, yCapTren - 0.5];
        const phai = [yDot + CB.labelDy[0] + CB.h + 0.6, yLo + CB.labelDy[3] - CB.h / 2 - 0.8];
        veChuCap(cx - 0.4, trai, c.feeder.cable, c.feeder.cableNgan, `cáp cấp ${c.ten}`);
        veChuCap(cx + 3.1, phai, c.feeder.conduit, c.feeder.conduitNgan, `ống cấp ${c.ten}`);
      }
      veNut(c, yHopCon);
    }
  }

  // Chữ dọc theo đoạn cáp: đủ chỗ thì ghi đầy đủ; thiếu chỗ thì dùng dạng ghi ngắn (4x10 + E10, Ø 40)
  function veChuCap(x, [y0, y1], day, ngan, what) {
    const s0 = day || ngan;
    if (!s0) return;
    const dai = y1 - y0;
    const s = doRongChu(s0, H.min + 0.3, { wf: WF.cable }) <= dai || !ngan ? s0 : ngan;
    g.text("TEXT", x, y0, vuaChu(s, H.cable, dai, what, { wf: WF.cable }), s, { rot: 90, wf: WF.cable });
  }

  // Chữ dài quá chỗ cho phép → thu nhỏ (không dưới H.min) và ghi cảnh báo
  function vuaChu(s, h, avail, what, opt = {}) {
    const w = doRongChu(s, h, opt);
    if (w <= avail) return h;
    const h2 = Math.max(H.min, (h * avail) / w);
    if (h2 < h * 0.85) warnings.push(`Chữ ${what} dài ${w.toFixed(1)} mm > ${avail.toFixed(1)} mm → thu nhỏ còn ${h2.toFixed(2)} mm.`);
    return h2;
  }
}
