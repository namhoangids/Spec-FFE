// Tờ điện nhẹ E.7xx — cùng khung, khung tên, màu và cỡ chữ với tờ E.601 (mau-indust.mjs).
//
//   kieu "truc"  E.700  Sơ đồ trục: dải tầng từ trên xuống, tủ rack ở tầng của nó, mỗi tầng một nhánh cáp ghi
//                       "n×Cat6 ổ data · AP · camera", mỗi phòng một ô; trục đứng; ISP vào rack trung tâm; nguồn rack.
//   kieu "mang"  E.701  Sơ đồ nguyên lý mạng & camera: INTERNET → modem → router → (switch lõi) → switch từng rack →
//                       nhóm thiết bị; NVR → màn hình; bảng tổng hợp tính toán từng rack.
//   kieu "rack"  E.702… Mặt đứng tủ rack theo U + bảng thiết bị (U, công suất) + diễn giải tính toán.
//
// Dữ liệu vào: engine/dien-nhe.mjs → sangDienNhe(). Giao diện vẽ `g` giống veSoDoTu (SVG, DXF 2007, DXF R12).

import { doRongChu } from "./do-rong-chu.mjs";
import { H, VUNG_VE, rectPts, veKhungTen, veKhungTo } from "./mau-indust.mjs";

const LE = 6;                       // lề trong vùng vẽ (mm)
const HC = 2.0, HN = 1.7, HT = 2.5; // cỡ chữ: thường, nhỏ, đề mục

/**
 * @param {object} g — giao diện vẽ
 * @param {object} d — dữ liệu tờ (sangDienNhe)
 * @returns {string[]} cảnh báo bố cục
 */
export function veDienNhe(g, d) {
  const canhBao = [];
  veKhungTo(g, d.sheet);
  const x0 = VUNG_VE.x0 + LE, x1 = VUNG_VE.x1 - LE;
  const yTren = VUNG_VE.yDuoiTieuDe - 2, yDuoi = VUNG_VE.y0 + LE;

  // Chữ dài quá chỗ → thu nhỏ (không dưới H.min), ghi cảnh báo nếu phải thu nhiều
  const vua = (s, h, avail, what, opt = {}) => {
    const w = doRongChu(s, h, opt);
    if (w <= avail) return h;
    const h2 = Math.max(H.min, (h * avail) / w);
    if (h2 < h * 0.8) canhBao.push(`Chữ "${String(s).slice(0, 30)}" (${what}) dài ${w.toFixed(1)} mm > ${avail.toFixed(1)} mm → thu nhỏ còn ${h2.toFixed(2)} mm.`);
    return h2;
  };
  const chu = (layer, x, y, h, s, opt = {}) => {
    if (s == null || s === "") return;
    const str = String(s);
    const hh = opt.max ? vua(str, h, opt.max, opt.what || "", opt) : h;
    g.text(layer, x, y, hh, str, opt);
  };
  /** Hộp có 1–2 dòng chữ căn giữa */
  const hop = (xc, yc, w, h, dong1, dong2, { nen = false, dam = true } = {}) => {
    const a = [xc - w / 2, yc - h / 2, xc + w / 2, yc + h / 2];
    if (nen) g.fill("CELL", rectPts(...a));
    g.rect("LINE", ...a);
    if (dong2) {
      chu("TITLE", xc, yc + h * 0.18, HC, dong1, { ha: "center", va: "middle", bold: dam, max: w - 2, what: "hộp" });
      chu("TEXT", xc, yc - h * 0.24, HN, dong2, { ha: "center", va: "middle", max: w - 2, what: "hộp" });
    } else {
      chu("TITLE", xc, yc, HC, dong1, { ha: "center", va: "middle", bold: dam, max: w - 2, what: "hộp" });
    }
    return { x0: a[0], y0: a[1], x1: a[2], y1: a[3], xc, yc };
  };
  /** Bảng: cột [[tiêu đề, độ rộng, căn ("l"|"c"|"r")]], trả về y đáy bảng */
  const bang = (bx0, yTop, cot, dong, { hDong = 5, h = HN, tieuDe } = {}) => {
    const w = cot.reduce((a, c) => a + c[1], 0);
    if (tieuDe) chu("TITLE", bx0, yTop + 3, HC, tieuDe, { va: "middle", bold: true });
    const n = dong.length + 1;
    const yBot = yTop - n * hDong;
    g.fill("CELL", rectPts(bx0, yTop - hDong, bx0 + w, yTop));
    for (let r = 0; r <= n; r++) g.line("LINE", bx0, yTop - r * hDong, bx0 + w, yTop - r * hDong);
    let xc = bx0;
    for (const [, cw] of cot) { g.line("LINE", xc, yBot, xc, yTop); xc += cw; }
    g.line("LINE", xc, yBot, xc, yTop);
    const viet = (cells, r, dam) => {
      let x = bx0;
      cells.forEach((s, i) => {
        const [, cw, can = "c"] = cot[i];
        const ha = dam ? "center" : can === "l" ? "left" : can === "r" ? "right" : "center";
        const xt = ha === "left" ? x + 1 : ha === "right" ? x + cw - 1 : x + cw / 2;
        chu(dam ? "TITLE" : "TEXT", xt, yTop - (r + 0.5) * hDong, h, s, { ha, va: "middle", bold: dam, max: cw - 1.5, what: `bảng cột ${cot[i][0]}` });
        x += cw;
      });
    };
    viet(cot.map((c) => c[0]), 0, true);
    dong.forEach((row, i) => viet(row, i + 1, false));
    return yBot;
  };
  /** Các dòng ghi chú, tự thu nhỏ cho vừa bề rộng */
  const ghiChu = (gx0, gy, rong, ds, tieuDe = "GHI CHÚ:") => {
    if (!ds?.length) return gy;
    chu("TITLE", gx0, gy, HC, tieuDe, { va: "middle", bold: true });
    ds.forEach((s, i) => chu("TEXT", gx0, gy - (i + 1) * 4, HN, `${i + 1}. ${s}`, { va: "middle", max: rong, what: "ghi chú" }));
    return gy - (ds.length + 1) * 4;
  };

  if (d.kieu === "truc") veTruc();
  else if (d.kieu === "mang") veMang();
  else veRack();
  veKhungTen(g, d.sheet);
  return canhBao;

  // ===================================================================================================
  function veTruc() {
    const hGhiChu = 4 * ((d.ghiChu?.length || 0) + 1) + 4;
    const yNen = yDuoi + hGhiChu;
    ghiChu(x0, yDuoi + hGhiChu - 4, x1 - x0 - 4, d.ghiChu);
    const nT = Math.max(1, d.tang.length);
    const nR = d.rack.length;
    const xNhan1 = x0 + 18;                                     // cột tên tầng
    const xRack = (i) => xNhan1 + 32 + i * 26;                 // cột từng rack
    const xPhong0 = xRack(nR - 1) + 22;
    const canBand = 12 + nR * 4.5 + 10;
    const hBand = Math.min(48, (yTren - yNen) / nT);
    if (hBand < canBand) canBao.push(`Sơ đồ trục: ${nT} tầng, mỗi dải cao ${hBand.toFixed(1)} mm < cần ${canBand.toFixed(1)} mm — chữ có thể chồng`);
    const dinh = (k) => yTren - k * hBand;                      // đỉnh dải tầng thứ k (từ trên)
    const kTang = new Map(d.tang.map((t, k) => [t, k]));

    // Dải tầng
    for (let k = 0; k <= nT; k++) g.line("TB_LINE", x0, dinh(k), x1, dinh(k));
    g.line("TB_LINE", xNhan1, dinh(0), xNhan1, dinh(nT));
    d.tang.forEach((t, k) => chu("TITLE", (x0 + xNhan1) / 2, dinh(k) - hBand / 2, HT, t, { ha: "center", va: "middle", bold: true, max: xNhan1 - x0 - 2, what: "tên tầng" }));

    // Phòng: mỗi tầng một hàng ô, chia đều bề ngang còn lại
    const soPhongMax = Math.max(1, ...d.tang.map((t) => d.nhanh.filter((n) => n.tang === t).reduce((a, n) => a + n.phong.length, 0)));
    const buoc = Math.min(48, (x1 - xPhong0) / soPhongMax);
    if (buoc < 30) canBao.push(`Sơ đồ trục: tầng nhiều phòng (${soPhongMax}) — ô phòng hẹp ${buoc.toFixed(1)} mm`);
    const viTriO = new Map();                                   // tầng → số ô đã dùng
    const hopRack = new Map();

    // Tủ rack
    d.rack.forEach((r, i) => {
      const k = kTang.get(r.tang) ?? nT - 1;
      const yc = dinh(k + 1) + 4 + 6;
      const b = hop(xRack(i), yc, 18, 12, r.ma, `${r.uRack}U ${r.kieuRack === "treo tường" ? "TREO" : "ĐỨNG"}`, { nen: true });
      hopRack.set(r.ma, b);
      chu("TEXT", xRack(i), b.y0 - 2.2, 1.5, `NGUỒN ${r.nguon}`, { ha: "center", va: "middle", max: 24, what: "nguồn rack" });
      if (r.laTrungTam) {
        const xa = xNhan1 + 2;
        g.line("LINE", xa, b.yc, b.x0, b.yc);
        g.fill("LINE", [[b.x0, b.yc], [b.x0 - 2.2, b.yc + 0.9], [b.x0 - 2.2, b.yc - 0.9]]);
        chu("TEXT", xa, b.yc + 2, HN, "INTERNET (ISP)", { va: "middle", max: b.x0 - xa - 1, what: "ISP" });
      }
    });

    // Nhánh cáp từng rack trên từng tầng
    d.rack.forEach((r, i) => {
      const b = hopRack.get(r.ma);
      const ns = d.nhanh.filter((n) => n.rack === r.ma);
      if (!ns.length) return;
      const yBus = (t) => dinh(kTang.get(t)) - 4 - i * 4.5;
      const ys = ns.map((n) => yBus(n.tang));
      const yMax = Math.max(...ys), yMin = Math.min(...ys);
      if (yMax > b.y1) g.line("LINE", b.xc, b.y1, b.xc, yMax);
      if (yMin < b.y0) g.line("LINE", b.xc, yMin, b.xc, b.y0);
      for (const n of ns) {
        const y = yBus(n.tang);
        const dau = viTriO.get(n.tang) ?? 0;
        const xs = n.phong.map((_, j) => xPhong0 + (dau + j + 0.5) * buoc);
        viTriO.set(n.tang, dau + n.phong.length);
        g.line("LINE", b.xc, y, xs.at(-1), y);
        g.circle("LINE", b.xc, y, 0.6, { fill: true });
        const phan = [n.dem.data && `${n.dem.data}×Cat6 ổ data`, n.dem.ap && `${n.dem.ap}×Cat6 AP`, n.dem.cam && `${n.dem.cam}×Cat6 camera`].filter(Boolean).join(" · ");
        chu("TEXT", b.xc + 2, y + 1.6, HN, phan, { va: "middle", max: Math.max(20, x1 - b.xc - 4), what: "nhánh cáp" });
        const yHop = dinh(kTang.get(n.tang)) - 4 - d.rack.length * 4.5 - 6.5;
        n.phong.forEach((p, j) => {
          g.line("LINE", xs[j], y, xs[j], yHop + 4.5);
          const dem = [p.data && `${p.data} DATA`, p.ap && `${p.ap} AP`, p.cam && `${p.cam} CAM`].filter(Boolean).join(" · ");
          hop(xs[j], yHop, buoc - 4, 9, p.ten, dem, { dam: true });
        });
      }
    });

    // Trục giữa các rack về rack trung tâm
    const tt = d.rack.find((r) => r.laTrungTam);
    const bTT = tt && hopRack.get(tt.ma);
    d.rack.filter((r) => r.truc && bTT).forEach((r, i) => {
      const b = hopRack.get(r.ma);
      const xg = bTT.x1 + 3 + i * 2;
      g.poly("LINE", [[b.x0, b.yc], [xg, b.yc], [xg, bTT.yc], [bTT.x1, bTT.yc]], false);
      chu("TEXT", xg + 1, b.yc + 1.8, 1.5, `TRỤC: ${r.truc.moTa}${r.truc.L ? `, ${r.truc.L} m` : ""}`, { va: "middle", max: b.x0 - xg - 2, what: "trục" });
    });
  }

  // ===================================================================================================
  function veMang() {
    // Bảng tổng hợp ở đáy
    const cot = [["RACK", 14], ["TẦNG", 12], ["Ổ DATA", 14], ["AP", 10], ["CAMERA", 14], ["SWITCH (CỔNG)", 40], ["PoE CẦN / CÓ (W)", 26],
      ["PATCH PANEL", 18], ["U CẦN → TỦ", 26], ["UPS", 18], ["NGUỒN", 22]];
    const wBang = cot.reduce((a, c) => a + c[1], 0);
    const xb = (x0 + x1) / 2 - wBang / 2;
    const hDong = 5;
    const yBangTop = yDuoi + (d.ghiChu?.length ? 4 * (d.ghiChu.length + 1) + 2 : 0) + (d.bang.length + 1) * hDong;
    bang(xb, yBangTop, cot, d.bang.map((b) => [b.ma, b.tang, b.data, b.ap, b.cam, b.sw, b.poe, b.pp, b.u, b.ups, b.nguon]),
      { hDong, tieuDe: "BẢNG TÍNH TOÁN TỦ RACK" });
    ghiChu(xb, yDuoi + 4 * d.ghiChu.length, wBang, d.ghiChu);

    // Lá (nhóm thiết bị) → x
    const la = [];
    for (const n of d.nhom) for (const m of n.muc) for (const l of m.la.length ? m.la : [null]) la.push({ n, m, l });
    const buoc = Math.min(50, (x1 - x0 - 8) / Math.max(1, la.length));
    if (buoc < 34) canBao.push(`Sơ đồ nguyên lý mạng: ${la.length} nhóm thiết bị — bước ${buoc.toFixed(1)} mm hơi hẹp`);
    const xla0 = (x0 + x1) / 2 - (la.length * buoc) / 2;
    la.forEach((x, i) => { x.x = xla0 + (i + 0.5) * buoc; });
    for (const n of d.nhom) for (const m of n.muc) {
      const xs = la.filter((x) => x.m === m).map((x) => x.x);
      m.x = (Math.min(...xs) + Math.max(...xs)) / 2;
    }
    const wH = Math.min(42, buoc - 5), hH = 10;
    const xc = (x0 + x1) / 2;
    // Hàng (y tâm hộp)
    const y = { net: yTren - 8, modem: yTren - 24, router: yTren - 40 };
    y.loi = y.router - 16;
    y.muc = (d.loi ? y.loi : y.router) - 30;
    y.la = y.muc - 28;
    if (y.la - hH / 2 < yBangTop + 12) canBao.push("Sơ đồ nguyên lý mạng: thiếu chỗ giữa cây và bảng");

    const noi = (tren, duoi, ymCho) => {             // nối 1 hộp trên với các hộp dưới (đường gấp khúc)
      if (!duoi.length) return;
      const ym = ymCho ?? (tren.y0 + Math.max(...duoi.map((b) => b.y1))) / 2;
      g.line("LINE", tren.xc, tren.y0, tren.xc, ym);
      const xs = duoi.map((b) => b.xc);
      if (xs.length > 1 || xs[0] !== tren.xc) g.line("LINE", Math.min(tren.xc, ...xs), ym, Math.max(tren.xc, ...xs), ym);
      for (const b of duoi) g.line("LINE", b.xc, ym, b.xc, b.y1);
    };
    const bNet = hop(xc, y.net, 44, hH, "INTERNET", "nhà cung cấp dịch vụ (ISP)");
    const bModem = hop(xc, y.modem, wH, hH, "MODEM ISP", "quang / FTTH");
    const bRouter = hop(xc, y.router, wH, hH, "ROUTER / TƯỜNG LỬA", "rack trung tâm");
    noi(bNet, [bModem]);
    noi(bModem, [bRouter]);
    const bLoi = d.loi ? hop(xc, y.loi, wH, hH, d.loi.ten, d.loi.phu, { nen: true }) : null;
    if (bLoi) noi(bRouter, [bLoi]);
    const cha = bLoi || bRouter;

    // Nhóm từng rack
    const hopMuc = [];
    for (const n of d.nhom) {
      const bs = [];
      for (const m of n.muc) {
        const b = hop(m.x, y.muc, wH, hH, m.ten, m.phu, { nen: true });
        m.b = b;
        bs.push(b);
        const dsLa = la.filter((x) => x.m === m && x.l).map((x) => hop(x.x, y.la, wH, hH, x.l.ten, x.l.phu, { dam: false }));
        noi(b, dsLa);
      }
      if (!bs.length) continue;
      // Khung rack
      const fx0 = Math.min(...bs.map((b) => b.x0)) - 3, fx1 = Math.max(...bs.map((b) => b.x1)) + 3;
      g.rect("TB_LINE", fx0, y.muc - hH / 2 - 3, fx1, y.muc + hH / 2 + 7);
      chu("TITLE", fx0 + 1.5, y.muc + hH / 2 + 4, HN, `TỦ RACK ${n.ma}${n.tang ? ` (${n.tang})` : ""}${n.laTrungTam ? " — TRUNG TÂM" : ""}`, { va: "middle", bold: true, max: fx1 - fx0 - 3, what: "tên rack" });
      hopMuc.push(...n.muc.filter((m) => m.loai !== "nvr" || bLoi).map((m) => m.b));
      if (n.truc) chu("TEXT", (fx0 + fx1) / 2 + 1, y.muc + hH / 2 + 11, 1.5, `TRỤC: ${n.truc}`, { va: "middle", max: fx1 - fx0, what: "trục" });
      // Không có switch lõi: NVR nối ngang vào switch PoE cùng rack
      const nvr = n.muc.find((m) => m.loai === "nvr"), poe = n.muc.find((m) => m.loai === "poe") || n.muc.find((m) => m.loai === "switch");
      if (nvr && poe && !bLoi) g.line("LINE", poe.b.x1, poe.b.yc, nvr.b.x0, nvr.b.yc);
    }
    noi(cha, hopMuc, cha.y0 - 4);   // thanh nối nằm trên khung rack, không cắt dòng tên rack
  }

  // ===================================================================================================
  function veRack() {
    const r = d.rack;
    const uH = Math.min(5.6, (yTren - yDuoi - 28) / r.uRack);
    const wR = 62;
    const xR = x0 + 12;
    const yR0 = yDuoi + 10;
    const yR1 = yR0 + r.uRack * uH;
    chu("TITLE", xR - 8, yR1 + 15, HT, `TỦ RACK ${r.ma} — ${r.uRack}U, ${r.kieuRack.toLocaleUpperCase("vi")}`, { va: "middle", bold: true });
    chu("TEXT", xR - 8, yR1 + 9.5, HC, [r.tang && `Tầng ${r.tang}`, r.viTri, r.laTrungTam && "rack trung tâm"].filter(Boolean).join(" · "), { va: "middle", max: 120, what: "vị trí rack" });
    g.rect("LINE", xR - 4, yR0 - 4, xR + wR + 4, yR1 + 4);   // vỏ tủ
    g.rect("LINE", xR, yR0, xR + wR, yR1);                   // khung 19"
    const buocSo = uH >= 3.5 ? 1 : 2;
    for (let u = 1; u <= r.uRack; u += buocSo) chu("TEXT", xR - 1, yR0 + (u - 0.5) * uH, Math.min(1.5, uH * 0.55), String(u), { ha: "right", va: "middle" });
    // Thiết bị: UPS ở đáy, PDU trên UPS; còn lại xếp từ đỉnh xuống
    const day = [...d.thietBi.filter((x) => x.loai === "ups"), ...d.thietBi.filter((x) => x.loai === "pdu")];
    const tren = d.thietBi.filter((x) => x.loai !== "ups" && x.loai !== "pdu");
    const vt = [];
    let u = r.uRack;
    for (const x of tren) { vt.push({ x, uTu: u - x.u + 1, uDen: u }); u -= x.u; }
    let ud = 1;
    for (const x of day) { vt.push({ x, uTu: ud, uDen: ud + x.u - 1 }); ud += x.u; }
    if (ud - 1 > u) canBao.push(`Tủ ${r.ma}: thiết bị (${d.thietBi.reduce((a, x) => a + x.u, 0)}U) vượt ${r.uRack}U`);
    for (const { x, uTu, uDen } of vt) {
      const a = [xR + 1, yR0 + (uTu - 1) * uH + 0.25, xR + wR - 1, yR0 + uDen * uH - 0.25];
      g.fill("CELL", rectPts(...a));
      g.rect("LINE", ...a);
      chu("TITLE", xR + wR / 2, (a[1] + a[3]) / 2, Math.min(1.6, uH * 0.5), x.ten, { ha: "center", va: "middle", max: wR - 4, what: "thiết bị rack" });
    }

    // Bảng thiết bị + ghi chú bên phải
    const bx = xR + wR + 22;
    const rong = x1 - bx;
    const cot = [["STT", 10], ["THIẾT BỊ", rong - 10 - 22 - 12 - 22, "l"], ["VỊ TRÍ (U)", 22], ["SỐ U", 12], ["CÔNG SUẤT (W)", 22]];
    const dong = vt.sort((a, b) => b.uDen - a.uDen).map((v, i) => [i + 1, v.x.ten, v.uTu === v.uDen ? `U${v.uTu}` : `U${v.uTu}–U${v.uDen}`, v.x.u, v.x.w || "—"]);
    if (d.poeTai) dong.push(["", "Tải PoE cấp cho AP, camera (qua switch PoE)", "", "", d.poeTai]);
    dong.push(["", "TỔNG CÔNG SUẤT", "", d.thietBi.reduce((a, x) => a + x.u, 0), d.w]);
    const yB = bang(bx, yTren - 8, cot, dong, { hDong: 5, tieuDe: "DANH MỤC THIẾT BỊ TỦ RACK" });
    ghiChu(bx, yB - 8, rong, d.ghiChu, "DIỄN GIẢI TÍNH TOÁN:");
  }
}
