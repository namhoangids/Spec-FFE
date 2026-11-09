// Template "Sơ đồ nguyên lý tủ điện — Indust" v1
//
// Bố cục, màu, cỡ chữ đo từ bản vẽ mẫu E.601 (SƠ ĐỒ NGUYÊN LÝ ĐIỆN T1, dự án MR. TUẤN - HDMON).
// Toạ độ trong bảng dưới đây ghi theo PIXEL của ảnh mẫu (1156 × 807 px) để dễ đối chiếu,
// rồi đổi sang mm trên khổ A3 ngang (420 × 297): 1 px = 420 / 1156 ≈ 0,3633 mm.
// Khi có DWG khung tên và chuẩn layer của công ty, chỉ cần sửa các hằng số trong file này.
//
// Bộ dựng chỉ gọi giao diện vẽ trừu tượng `g` (line, rect, fill, circle, text, mtext,
// defineBlock, insert) — cùng một bố cục xuất ra DXF (AutoCAD) và SVG (xem trước).

import { doRongChu } from "./do-rong-chu.mjs";

export const PX = 420 / 1156;            // mm / px
const TOP_PAD = 1.9;                      // mm: ảnh mẫu thấp hơn khổ A3 một chút
export const SHEET = { w: 420, h: 297 };

/** Đổi toạ độ ảnh mẫu (px, gốc trên-trái) sang mm (gốc dưới-trái, trục y hướng lên). */
export const X = (px) => px * PX;
export const Y = (py) => SHEET.h - (py * PX + TOP_PAD);
export const L = (px) => px * PX;        // độ dài

// ---------------------------------------------------------------------------
// Layer & màu (tạm — sẽ thay bằng chuẩn layer công ty). [tên, màu ACI dùng cho bản R12, RGB đúng mẫu]
// ---------------------------------------------------------------------------
export const LAYERS = {
  FRAME:    ["IND-KHUNG",      254,   [190, 190, 190]],  // viền giấy
  LINE:     ["IND-SLD-NET",    154,   [40, 79, 128]],    // đường dây, thanh cái, ký hiệu, khung bảng
  TEXT:     ["IND-SLD-CHU",    20,  [232, 86, 42]],    // chữ thông số (đỏ cam)
  CELL:     ["IND-SLD-O",      254, [238, 238, 238]],  // nền xám ô pha / phụ tải
  ARROW:    ["IND-SLD-MUITEN", 1,   [255, 0, 0]],      // mũi tên pha
  TITLE:    ["IND-TIEUDE",     7,   [0, 0, 0]],        // tiêu đề bản vẽ
  ICON:     ["IND-TIEUDE-ICON",132,   [0, 179, 179]],    // dấu + xanh ngọc cạnh tiêu đề
  TB_LINE:  ["IND-KT-NET",     8,   [124, 124, 124]],  // khung tên: đường kẻ
  TB_LABEL: ["IND-KT-NHAN",    253,   [149, 149, 149]],  // khung tên: nhãn (Client:, Date:…)
  TB_VALUE: ["IND-KT-GIATRI",  250, [51, 51, 51]],     // khung tên: giá trị
  TB_HI:    ["IND-KT-NOIBAT",  40,  [255, 163, 31]],   // khung tên: Client / Project (cam đậm)
  TB_BOX:   ["IND-KT-SOBV",    8,   [127, 127, 127]],  // ô số bản vẽ (nền xám)
  TB_BOXTX: ["IND-KT-SOBV-CHU",255, [229, 229, 229]],  // chữ số bản vẽ
};

export const FONT = { normal: "arial.ttf", bold: "arialbd.ttf" };

// ---------------------------------------------------------------------------
// Thông số bố cục (px ảnh mẫu)
// ---------------------------------------------------------------------------
const P = {
  frame: { x0: 27, x1: 1148, y0: 28, y1: 795, split: 965 },
  title: { iconX: 78, iconY: 56, iconSize: 26, iconArm: 9, textX: 92, textY: 50, h: 2.7 },

  // Cột nhãn bên trái
  labels: { x0: 143.5, xDiv: 171.5, x1: 255, textX: 151.5, textXSub: 180 },
  rows: {
    top: 129,        // trên "CẤP NGUỒN TỔNG"
    panelTop: 171,   // trên "TỦ ĐIỆN" = cạnh trên vỏ tủ
    sub1: 253.5,     // vạch dưới "APTOMAT TỔNG"
    sub2: 281.5,     // vạch trên "APTOMAT LỘ RA" = thanh cái nhóm
    panelBot: 364,   // dưới vỏ tủ = trên "LỘ RA"
    cable: 392,      // trên "CÁP ĐIỆN/LẮP ĐẶT"
    phase: 530,      // trên "PHA" (đường mạch dừng ở đây)
    load: 557.5,     // trên "PHỤ TẢI"
    bottom: 695.5,
  },

  // Cột mạch
  col: { first: 297.5, pitch: 33.3, maxRight: 870 },   // maxRight: cột cuối không vượt (chừa chỗ tiếp địa)
  panel: { padLeft: 32.5, padRight: 32, nameX: 275, nameY: 185 },

  bus: 237.5,                       // thanh cái chính
  loadText: { x: 297.5, y1: 220, y2: 230.5 },
  incomer: { dot: 190, label0: 180 },
  supply: { y: 148, textX: 383.5, y1: 142, y2: 153 },
  group: { dot: 250, label0: 244 },
  outgoing: { dot: 306, label0: 297.5 },
  code: { dx: 6.5, y: 378 },
  cableText: { bottom: 517, dx1: -1, dx2: 8.5 },
  phaseText: { y: 541 },
  arrow: { y: 551, w: 14, h: 10 },

  earth: { y: 347.5, dx: 33, yBottom: 404, w: 17, tri: 8.5 },
};

// Ký hiệu aptomat (mm), gốc tại chấm tròn đặc (tiếp điểm tĩnh), thân đi xuống
const CB = {
  dotR: L(2.0),
  ocR: L(1.75),
  ocDy: -L(16.5),                       // tâm vòng tròn hở
  blade: [-L(8.25), L(13.5)],           // vector lưỡi dao tính từ vòng tròn hở
  labelDx: L(3.5),
  labelDy: [L(9), 0, -L(11.5), -L(21)], // tâm 4 dòng nhãn so với chấm tròn
  h: 1.9,
};

// Chiều cao chữ (mm) quy đổi về Arial theo độ dài chữ đo trên mẫu (xem README)
const H = { label: 2.0, row: 2.0, cable: 2.0, load: 2.0, code: 2.0, phase: 2.0, min: 1.3 };
const WF = { cable: 0.85 };          // hệ số rộng chữ cáp (chữ cao nhưng hẹp như mẫu)
const FIT = {
  loadAvail: L(695.5 - 557.5) - 2,   // chiều dài dành cho tên phụ tải trong ô (mm)
  shrinkFirst: 0.85,                 // tên phụ tải: thu nhỏ tới 85% trước khi xuống dòng
  cableAvail: L(517 - 395),          // chiều dài dành cho chữ cáp/ống trong hàng cáp (mm)
  gapIncomer: L(10),                 // khoảng hở giữa ghi chú cáp nguồn và đường cấp nguồn
};

// ---------------------------------------------------------------------------
// Khung tên (px ảnh mẫu) — tạm, chờ DWG khung tên công ty
// ---------------------------------------------------------------------------
const TB = {
  x0: 994, x1: 1131.5, labelH: 1.8, valueH: 2.0, hiH: 3.0, titleH: 2.4,
  logo: { x: 1062.5, y: 66, h: 6.2, subY: 77, subH: 1.5 },
  // [tag, nhãn, yNhãn, yGiáTrị, yVạch, kiểu]
  fields: [
    ["CONG_TY", "Company info:", 97.5, 109, 115, "value"],
    ["GIAM_DOC", "Director:", 119, 131, 137, "value"],
    ["THIET_KE", "Design:", 141, 153, 159, "value"],
    ["KIEM_TRA", "Check by:", 163, 175, 181, "value"],
    ["TEN_BAN_VE", "Drawing title:", 185, 198.5, 203.5, "value"],
    ["", "Key plan:", 207.5, null, 308.5, "none"],
    ["", "Project notes:", 312.5, null, null, "none"],
    ["CHU_DAU_TU", "Client:", 573, 583.5, 590.5, "hi"],
    ["DIA_CHI", "Address:", 595, 605, 614, "value"],
    ["DU_AN", "Project:", 617, 627.5, 635.5, "hi"],
    ["NGUOI_VE", "Made by:", 640, 652, 658, "value"],
    ["NGAY", "Date:", 661.5, 671, 680, "value"],
    ["TY_LE", "Scale:", 685, 694, 702, "value"],
    ["SO_DU_AN", "Project no:", 707, 719, null, "value"],
  ],
  notes: { y: 321, h: 2.0, width: 122 },
  box: { y0: 737.5, y1: 792.5, h: 8.5 },
};

export const GHI_CHU_MAC_DINH = [
  "1. All measurements must be verified on-site before construction begins.",
  "2. Do not scale this drawing. Dimensions to be read in conjunction with corresponding architectural and structural drawings. This drawing is copyright or used with the express authority of Indust Design.",
  "2. Ensure all foundations are level and stable—verify soil conditions for adequate support.",
  "3. Coordinate electrical and plumbing work with off-grid solutions (if applicable, such as solar power or composting toilets)",
];

// ---------------------------------------------------------------------------
// Block dùng chung
// ---------------------------------------------------------------------------
function defineBlocks(g) {
  // Aptomat: chấm tròn đặc + lưỡi dao + vòng tròn hở, 4 thuộc tính nhãn bên phải
  g.defineBlock("IND_CB", (b) => {
    b.circle("LINE", 0, 0, CB.dotR, { fill: true });
    b.circle("LINE", 0, CB.ocDy, CB.ocR);
    const [bx, by] = CB.blade, len = Math.hypot(bx, by);
    b.line("LINE", (bx / len) * CB.ocR, CB.ocDy + (by / len) * CB.ocR, bx, CB.ocDy + by);
  }, ["LOAI", "SO_CUC", "DONG_DM", "DONG_CAT"].map((tag, i) => ({
    tag, layer: "TEXT", dx: CB.labelDx, dy: CB.labelDy[i], h: CB.h, ha: "left", va: "middle",
  })));

  // Mũi tên pha (đỏ, hướng sang phải), gốc tại tâm
  g.defineBlock("IND_PHA_MUITEN", (b) => {
    const w = L(P.arrow.w), h = L(P.arrow.h), shaft = h * 0.42, head = w * 0.45;
    b.fill("ARROW", [
      [-w / 2, -shaft / 2], [w / 2 - head, -shaft / 2], [w / 2 - head, -h / 2], [w / 2, 0],
      [w / 2 - head, h / 2], [w / 2 - head, shaft / 2], [-w / 2, shaft / 2],
    ]);
  });

  // Tiếp địa, gốc tại điểm nối phía trên thanh ngang
  g.defineBlock("IND_TIEP_DIA", (b) => {
    const w = L(P.earth.w), t = L(P.earth.tri);
    b.line("LINE", -w / 2, 0, w / 2, 0);
    b.line("LINE", -w / 2, 0, 0, -t);
    b.line("LINE", w / 2, 0, 0, -t);
    b.line("LINE", -w * 0.28, -t * 0.45, w * 0.28, -t * 0.45);
  });
}

// ---------------------------------------------------------------------------
// Bố cục chính
// ---------------------------------------------------------------------------
/**
 * Vẽ một tờ sơ đồ nguyên lý tủ điện theo template Indust.
 * @param {object} g  giao diện vẽ (xem ve-svg.mjs / ve-dxf.mjs)
 * @param {object} d  dữ liệu tờ vẽ (xem du-lieu/*.json)
 * @returns {string[]} cảnh báo bố cục
 */
export function veSoDoTu(g, d) {
  const warnings = [];
  defineBlocks(g);
  const R = P.rows;
  const circuits = d.circuits;
  const n = circuits.length;

  // Bước cột: giữ bước của mẫu; nếu quá nhiều mạch thì co lại cho vừa (tối thiểu 24 px)
  let pitch = P.col.pitch;
  if (n > 1 && P.col.first + pitch * (n - 1) > P.col.maxRight) {
    pitch = (P.col.maxRight - P.col.first) / (n - 1);
    warnings.push(`${n} mạch: bước cột co từ ${P.col.pitch} px xuống ${pitch.toFixed(1)} px để vừa tờ A3.`);
    if (pitch < 24) warnings.push("Bước cột quá hẹp — nên tách sang tờ thứ hai.");
  }
  const colX = (i) => P.col.first + pitch * i;
  const firstX = colX(0), lastX = colX(n - 1);
  const byCode = new Map(circuits.map((c, i) => [c.code || `#${i}`, i]));

  // --- Khung giấy & tiêu đề -------------------------------------------------
  g.rect("FRAME", X(P.frame.x0), Y(P.frame.y1), X(P.frame.x1), Y(P.frame.y0));
  g.line("FRAME", X(P.frame.split), Y(P.frame.y0), X(P.frame.split), Y(P.frame.y1));
  drawIcon(g);
  g.text("TITLE", X(P.title.textX), Y(P.title.textY), P.title.h, d.sheet.title, { bold: true });

  // --- Cột nhãn bên trái ----------------------------------------------------
  const lx0 = X(P.labels.x0), lxd = X(P.labels.xDiv), lx1 = X(P.labels.x1);
  g.line("LINE", lx0, Y(R.top), lx0, Y(R.bottom));
  for (const r of [R.top, R.panelTop, R.panelBot, R.cable, R.phase, R.load, R.bottom]) {
    g.line("LINE", lx0, Y(r), lx1, Y(r));
  }
  g.line("LINE", lxd, Y(R.panelTop), lxd, Y(R.panelBot));
  g.line("LINE", lxd, Y(R.sub1), lx1, Y(R.sub1));
  g.line("LINE", lxd, Y(R.sub2), lx1, Y(R.sub2));
  g.line("LINE", lx1, Y(R.panelBot), lx1, Y(R.cable));

  const lab = (s, x, y, opt = {}) => g.text("TEXT", x, y, H.row, s, { va: "middle", ...opt });
  lab("CẤP NGUỒN TỔNG", X(P.labels.textX), Y((R.top + R.panelTop) / 2));
  lab("TỦ ĐIỆN", (lx0 + lxd) / 2, Y((R.panelTop + R.panelBot) / 2), { rot: 90, ha: "center" });
  lab("APTOMAT TỔNG", X(P.labels.textXSub), Y(185));
  lab("APTOMAT LỘ RA", X(P.labels.textXSub), Y(296));
  lab("LỘ RA", X(P.labels.textX), Y((R.panelBot + R.cable) / 2));
  lab("CÁP ĐIỆN/LẮP ĐẶT", X(P.labels.textX), Y(405));
  lab("PHA", X(P.labels.textX), Y((R.phase + R.load) / 2));
  lab("PHỤ TẢI", X(P.labels.textX), Y(571.5));

  // --- Vỏ tủ ----------------------------------------------------------------
  const px0 = firstX - P.panel.padLeft, px1 = lastX + P.panel.padRight;
  g.rect("LINE", X(px0), Y(R.panelBot), X(px1), Y(R.panelTop));
  g.text("TEXT", X(P.panel.nameX), Y(P.panel.nameY), H.label, d.panel.name, { va: "middle" });
  (d.panel.loadText || []).forEach((s, i) =>
    g.text("TEXT", X(P.loadText.x), Y([P.loadText.y1, P.loadText.y2][i]), H.label, s, { va: "middle" }));

  // --- Nhóm chống dòng rò (RCBO/RCCB cấp cho một nhóm mạch) — tính trước -----
  const groups = (d.groups || []).map((grp) => {
    const idx = grp.circuits.map(resolveCol).sort((a, b) => a - b);
    return { grp, idx, at: grp.atColumn != null ? resolveCol(grp.atColumn) : idx[idx.length - 1] };
  });
  const groupCols = new Set(groups.map((x) => x.at));

  // --- Nguồn cấp + CB tổng ---------------------------------------------------
  // Mặc định đặt ở cột giữa (như mẫu E.601); tránh cột đang đặt RCBO nhóm.
  let inIdx;
  if (d.panel.incomerColumn != null) {
    inIdx = resolveCol(d.panel.incomerColumn);
  } else {
    const mid = Math.floor(n / 2);
    const order = [...Array(n).keys()].sort((a, b) => Math.abs(a - mid) - Math.abs(b - mid) || b - a);
    inIdx = order.find((i) => !groupCols.has(i)) ?? mid;
  }
  if (groupCols.has(inIdx)) warnings.push("CB tổng trùng cột với RCBO nhóm — nên chọn cột khác (panel.incomerColumn).");
  const ix = colX(inIdx);
  g.line("LINE", X(ix), Y(R.top), X(ix), Y(P.incomer.dot));
  g.insert("IND_CB", X(ix), Y(P.incomer.dot), cbAttribs(d.panel.incomer));
  g.line("LINE", X(ix), Y(P.incomer.dot) + CB.ocDy - CB.ocR, X(ix), Y(P.bus));

  // Ghi chú cáp nguồn + mũi tên: đặt bên trái đường cấp nguồn như mẫu; thiếu chỗ thì sang phải
  const sups = (d.panel.supplyCable || []).filter(Boolean);
  if (sups.length) {
    const tw = Math.max(...sups.map((s) => doRongChu(s, H.label)));
    let tx = X(ix) - FIT.gapIncomer - tw;
    const right = tx < X(firstX - P.panel.padLeft) + 2;
    if (right) tx = X(ix) + FIT.gapIncomer;
    g.line("LINE", right ? X(ix) : tx, Y(P.supply.y), right ? tx + tw : X(ix), Y(P.supply.y));
    g.fill("LINE", arrowHead(X(ix), Y(P.supply.y), right ? -1 : 1));
    sups.slice(0, 2).forEach((s, i) =>
      g.text("TEXT", tx, Y([P.supply.y1, P.supply.y2][i]), H.label, s, { va: "middle" }));
  }

  // --- Thanh cái chính ------------------------------------------------------
  g.line("LINE", X(firstX), Y(P.bus), X(lastX), Y(P.bus));

  const groupOf = new Map();
  for (const { grp, idx, at } of groups) {
    const gx = colX(at);
    g.line("LINE", X(gx), Y(P.bus), X(gx), Y(P.group.dot));
    g.insert("IND_CB", X(gx), Y(P.group.dot), cbAttribs(grp.device));
    g.line("LINE", X(gx), Y(P.group.dot) + CB.ocDy - CB.ocR, X(gx), Y(R.sub2));
    g.line("LINE", X(colX(idx[0])), Y(R.sub2), X(colX(idx[idx.length - 1])), Y(R.sub2));
    for (const i of idx) groupOf.set(i, grp);
  }

  // --- Hàng PHA + PHỤ TẢI: nền xám chung + lưới kẻ dùng chung (không vẽ trùng nét) ---
  const gx0 = X(firstX - pitch / 2), gx1 = X(lastX + pitch / 2);
  g.fill("CELL", rectPts(gx0, Y(R.load), gx1, Y(R.phase)));
  g.fill("CELL", rectPts(gx0, Y(R.bottom), gx1, Y(R.load)));
  for (const r of [R.phase, R.load, R.bottom]) g.line("LINE", gx0, Y(r), gx1, Y(r));
  for (let k = 0; k <= n; k++) {
    const xk = X(firstX - pitch / 2 + pitch * k);
    g.line("LINE", xk, Y(R.bottom), xk, Y(R.phase));
  }

  // --- Các mạch ra ----------------------------------------------------------
  circuits.forEach((c, i) => {
    const x = colX(i);
    const yStart = groupOf.has(i) ? Y(R.sub2) : Y(P.bus);
    g.line("LINE", X(x), yStart, X(x), Y(P.outgoing.dot));
    g.insert("IND_CB", X(x), Y(P.outgoing.dot), cbAttribs(c.device));
    g.line("LINE", X(x), Y(P.outgoing.dot) + CB.ocDy - CB.ocR, X(x), Y(R.phase));
    const codeAvail = L(pitch - P.code.dx) - 0.5;
    if (c.code) g.text("TEXT", X(x + P.code.dx), Y(P.code.y), fitH(c.code, H.code, codeAvail, `mã mạch ${c.code}`), c.code, { va: "middle" });
    for (const [s, dx] of [[c.cable, P.cableText.dx1], [c.conduit, P.cableText.dx2]]) {
      if (s) g.text("TEXT", X(x + dx), Y(P.cableText.bottom), fitH(s, H.cable, FIT.cableAvail, `cáp mạch ${c.code || i + 1}`, WF.cable), s, { rot: 90, wf: WF.cable });
    }

    // Chữ pha, mũi tên, tên phụ tải
    if (c.phase) g.text("TEXT", X(x), Y(P.phaseText.y), H.phase, c.phase, { ha: "center", va: "middle" });
    g.insert("IND_PHA_MUITEN", X(x), Y(P.arrow.y));
    if (c.load) veTenPhuTai(X(x), Y((R.load + R.bottom) / 2), L(pitch), c.load, c.code || i + 1);
  });

  // --- Tiếp địa -------------------------------------------------------------
  const ex = px1 + P.earth.dx;
  g.circle("LINE", X(px1), Y(P.earth.y), L(2.5));
  g.line("LINE", X(px1) + L(2.5), Y(P.earth.y), X(ex), Y(P.earth.y));
  g.line("LINE", X(ex), Y(P.earth.y), X(ex), Y(P.earth.yBottom));
  g.insert("IND_TIEP_DIA", X(ex), Y(P.earth.yBottom));
  g.text("TEXT", X(ex + 15), Y(P.earth.yBottom + 1), H.label, "TIẾP ĐỊA", { va: "middle", bold: true });

  // --- Khung tên ------------------------------------------------------------
  drawTitleBlock(g, d.sheet);

  return warnings;

  // Chữ dài quá chỗ cho phép → thu nhỏ (không dưới H.min) và ghi cảnh báo
  function fitH(s, h, avail, what, wf = 1) {
    const w = doRongChu(s, h, { wf });
    if (w <= avail) return h;
    const h2 = Math.max(H.min, (h * avail) / w);
    warnings.push(`Chữ ${what} dài ${w.toFixed(1)} mm > ${avail.toFixed(1)} mm → thu nhỏ còn ${h2.toFixed(2)} mm.`);
    return h2;
  }

  // Tên phụ tải (chữ dọc trong ô): 1 dòng; dài quá thì xuống 2 dòng; vẫn dài thì thu nhỏ
  function veTenPhuTai(x, y, cellW, s, code) {
    const h = H.load, avail = FIT.loadAvail;
    let lines = [s];
    const w1 = doRongChu(s, h);
    if (w1 > avail && avail / w1 < FIT.shrinkFirst) {
      const words = s.split(" ");
      let best = null;
      for (let k = 1; k < words.length; k++) {
        const a = words.slice(0, k).join(" "), b = words.slice(k).join(" ");
        const m = Math.max(doRongChu(a, h), doRongChu(b, h));
        if (!best || m < best.m) best = { a, b, m };
      }
      if (best && cellW >= h * 2 * 1.5 + 1) lines = [best.a, best.b];
    }
    const longest = Math.max(...lines.map((t) => doRongChu(t, h)));
    let hh = h;
    if (longest > avail) {
      hh = Math.max(H.min, (h * avail) / longest);
      if (hh < h * FIT.shrinkFirst) warnings.push(`Tên phụ tải mạch ${code} dài → thu nhỏ chữ còn ${hh.toFixed(2)} mm.`);
    }
    const gap = hh * 1.5;
    lines.forEach((t, k) => {
      const off = (k - (lines.length - 1) / 2) * gap;     // dòng đầu nằm bên trái (phía "trên" của chữ dọc)
      g.text("TEXT", x + off, y, hh, t, { rot: 90, ha: "center", va: "middle" });
    });
  }

  function resolveCol(ref) {
    if (typeof ref === "number") return ref;
    if (!byCode.has(ref)) throw new Error(`Không tìm thấy mạch "${ref}"`);
    return byCode.get(ref);
  }
}

function cbAttribs(dev) {
  return { LOAI: dev.type, SO_CUC: dev.poles, DONG_DM: dev.rating, DONG_CAT: dev.breaking };
}

function rectPts(x0, y0, x1, y1) {
  return [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
}

function arrowHead(x, y, dir = 1) {
  const len = L(7) * dir, half = L(2);
  return [[x, y], [x - len, y + half], [x - len, y - half]];
}

function drawIcon(g) {
  const { iconX, iconY, iconSize, iconArm } = P.title;
  const cx = X(iconX), cy = Y(iconY), s = L(iconSize) / 2, a = L(iconArm) / 2;
  const pts = [
    [cx - a, cy + s], [cx + a, cy + s], [cx + a, cy + a], [cx + s, cy + a], [cx + s, cy - a],
    [cx + a, cy - a], [cx + a, cy - s], [cx - a, cy - s], [cx - a, cy - a], [cx - s, cy - a],
    [cx - s, cy + a], [cx - a, cy + a],
  ];
  g.fill("ICON", pts);
  g.poly("TITLE", pts, true);
}

function drawTitleBlock(g, s) {
  const x0 = X(TB.x0), x1 = X(TB.x1), xm = (x0 + x1) / 2;
  // Logo tạm bằng chữ — sẽ thay bằng block logo trong khung tên DWG của công ty
  g.text("TITLE", X(TB.logo.x), Y(TB.logo.y), TB.logo.h, "Indust", { ha: "center" });
  g.text("TITLE", X(TB.logo.x), Y(TB.logo.subY), TB.logo.subH, "i n t e r i o r", { ha: "center" });

  const attdefs = [];
  for (const [tag, label, yl, yv, yline, kind] of TB.fields) {
    g.text("TB_LABEL", x0, Y(yl), TB.labelH, label, { va: "middle" });
    if (yline != null) g.line("TB_LINE", x0, Y(yline), x1, Y(yline));
    if (tag && kind !== "none") {
      attdefs.push({
        tag, layer: kind === "hi" ? "TB_HI" : "TB_VALUE", dx: xm, dy: Y(yv),
        h: kind === "hi" ? TB.hiH : tag === "TEN_BAN_VE" ? TB.titleH : TB.valueH,
        ha: "center", va: "middle", bold: kind === "hi",
      });
    }
  }
  g.mtext("TB_VALUE", x0, Y(TB.notes.y), TB.notes.h, (s.notes || GHI_CHU_MAC_DINH).join("\n\n"), L(TB.notes.width));
  g.fill("TB_BOX", rectPts(x0, Y(TB.box.y1), x1, Y(TB.box.y0)));
  attdefs.push({
    tag: "SO_BAN_VE", layer: "TB_BOXTX", dx: xm, dy: Y((TB.box.y0 + TB.box.y1) / 2),
    h: TB.box.h, ha: "center", va: "middle",
  });

  // Các trường thay đổi theo từng tờ được gom thành block có thuộc tính để sửa nhanh trong AutoCAD
  g.defineBlock("IND_KHUNG_TEN_GIATRI", () => {}, attdefs);
  g.insert("IND_KHUNG_TEN_GIATRI", 0, 0, {
    CONG_TY: s.companyInfo, GIAM_DOC: s.director, THIET_KE: s.design, KIEM_TRA: s.checkBy,
    TEN_BAN_VE: s.title, CHU_DAU_TU: s.client, DIA_CHI: s.address, DU_AN: s.project,
    NGUOI_VE: s.madeBy, NGAY: s.date, TY_LE: s.scale, SO_DU_AN: s.projectNo, SO_BAN_VE: s.drawingNo,
  });
}
