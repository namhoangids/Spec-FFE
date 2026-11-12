// Xuất bảng tính kết quả: sheet Tong hop, mỗi tủ một sheet, Canh bao, Quy tac.
// Chỉ ghi giá trị (không có công thức) — số liệu lấy thẳng từ lõi tính toán.

import { chuCap, soBanVe } from "./sang-ban-ve.mjs";
import { chuoiOng, chuoiTietDien, dt, r, tb, v } from "./dien-giai.mjs";
import { laTN } from "./ngan-mach.mjs";

const MUC = { loi: "LỖI", canhbao: "CẢNH BÁO", ghichu: "GHI CHÚ" };
/** Kết quả kiểm tự cắt nguồn khi chạm vỏ của một mạch (ngan-mach.mjs) */
export const TU_CAT = { dat: "Đạt (CB cắt từ)", rcd: "Nhờ RCD 30 mA", khong: "KHÔNG ĐẠT" };
const tuCatChu = (m, tn) => (!m.nganMach?.tuCat ? "" : !tn && m.nganMach.tuCat === "khong" ? "Cần RCD (TT)" : TU_CAT[m.nganMach.tuCat]);
const tenSheet = (s, dung) => {
  let base = String(s).replace(/[[\]:*?/\\]/g, "-").slice(0, 28) || "Tu";
  let ten = base, k = 2;
  while (dung.has(ten)) ten = `${base}~${k++}`;
  dung.add(ten);
  return ten;
};

/**
 * @param {object} XLSX — SheetJS
 * @param {object} kq — kết quả tinhDuAn
 * @param {object} info — duAn.info
 * @returns workbook SheetJS (ghi bằng XLSX.write / XLSX.writeFile)
 */
export function xuatExcel(XLSX, kq, info = {}, { soTheoTu = null } = {}) {
  // Số bản vẽ từng tủ: theo cách đánh số của bộ tờ (tủ nhiều tờ ghi "E.602–E.603"); thiếu thì mỗi tủ một tờ
  const soTo = (t, i) => {
    const s = soTheoTu?.get(t.ma);
    return s?.length ? (s.length > 1 ? `${s[0]}–${s.at(-1)}` : s[0]) : soBanVe(info.soBanVeDau || "E.601", i);
  };
  const wb = XLSX.utils.book_new();
  const dung = new Set(["Tong hop", "Cap va ong", "Ngan mach", "Canh bao", "Quy tac"]);
  const tn = laTN(kq.quyTac.noiDat);
  const rule = kq.quyTac;
  const dem = (ma, muc) => kq.canhBao.filter((c) => c.tu === ma && c.muc === muc).length;

  // --- Tong hop --------------------------------------------------------------
  const th = [
    ["BẢNG TÍNH SƠ ĐỒ NGUYÊN LÝ TỦ ĐIỆN"],
    ["Dự án", info.project ?? ""], ["Chủ đầu tư", info.client ?? ""], ["Địa chỉ", info.address ?? ""],
    ["Loại công trình", info.loaiCongTrinh ?? ""],
    ["Bộ quy tắc", `${rule.trangThai} — phiên bản ${rule.phienBan}`],
    ["Số lỗi / cảnh báo / ghi chú", ["loi", "canhbao", "ghichu"].map((m) => kq.canhBao.filter((c) => c.muc === m).length).join(" / ")],
    [],
    ["Số bản vẽ", "Mã tủ", "Tên", "Cấp từ", "Số pha", "Pđ (kW)", "Kđt", "Ptt (kW)", "cosφ TB", "I pha A (A)", "I pha B (A)",
      "I pha C (A)", "Lệch pha (%)", "Ik3 max thanh cái (kA)", "Ik1 min thanh cái (kA)", "CB tổng", "Cáp cấp", "Ống / máng cấp", "L cáp cấp (m)", "ΔU tới thanh cái (%)",
      "Module", "Module cần (+dự phòng)", "Vỏ tủ (module)", "Lỗi", "Cảnh báo"],
  ];
  kq.tu.forEach((t, i) => th.push([
    soTo(t, i), t.ma, t.ten, t.cha ?? "", t.soPha === 3 ? "3P" : "1P", r(t.pd), r(t.ks), r(t.ptt),
    r(t.cosTb), r(t.iPha.A, 1), r(t.iPha.B, 1), r(t.iPha.C, 1), r(t.lechPha, 1), r(t.ikTinh, 2), r(t.nganMach?.ik1Min, 2), tb(t.cbTong),
    chuCap(t.capNguon, { soPha: t.soPha }), t.capNguon ? t.ongNguon ?? "" : "", t.capNguon?.chuaCoL ? "" : r(t.lCap, 1),
    r(t.duBus), t.module.tong, r(t.module.can, 1), t.module.voTu ?? "", dem(t.ma, "loi"), dem(t.ma, "canhbao"),
  ]));
  const wsTh = XLSX.utils.aoa_to_sheet(th);
  wsTh["!cols"] = [10, 8, 12, 8, 6, 8, 6, 8, 7, 8, 8, 8, 8, 9, 9, 22, 34, 16, 9, 9, 7, 9, 9, 6, 8].map((w) => ({ wch: w }));
  XLSX.utils.book_append_sheet(wb, wsTh, "Tong hop");

  // --- Từng tủ ---------------------------------------------------------------
  const head = ["Mã lộ", "Phụ tải", "Loại mạch", "Loại khu vực", "P (W)", "cosφ", "Số pha", "Pha", "Ib (A)", "Thiết bị",
    "In (A)", "Icu (kA)", "IΔn (mA)", "Nhóm RCD", "RCD bắt buộc", "Cáp", "S (mm²)", "PE (mm²)", "Iz′ (A)", "L (m)",
    "ΔU mạch (%)", "ΔU cộng dồn (%)", "Giới hạn ΔU (%)", "Ống", "Ik1 min cuối (kA)", "Ngưỡng cắt từ (A)", "Tự cắt nguồn",
    "Ghi đè", "Kiểm tra"];
  kq.tu.forEach((t, i) => {
    const rows = [
      [`SƠ ĐỒ NGUYÊN LÝ ĐIỆN ${t.ten} — ${soTo(t, i)}`],
      [`CB tổng: ${tb(t.cbTong)} · Cáp cấp: ${chuCap(t.capNguon, { soPha: t.soPha }) || "—"} · Pđ ${v(t.pd)} kW · Kđt ${v(t.ks)} · Ptt ${v(t.ptt)} kW · Itt ${v(t.itt, 1)} A · Ik ${v(t.ikTinh, 1)} kA (${t.ikNguon})`],
      [`Vỏ tủ: ${t.module.voTu ?? "—"} module (thiết bị ${t.module.tong} module, cần ${v(t.module.can, 1)} gồm ${rule.duPhongVo}% dự phòng) · ΔU tới thanh cái ${v(t.duBus)}%`],
      [],
      head,
    ];
    for (const m of t.mach) {
      const gd = m.ghiDe || {};
      rows.push([
        m.ma, m.phuTai, m.laCapTuCon ? "Cấp tủ con" : m.loai, m.khuVuc, r(m.P, 0), r(m.cos), m.soPha === 3 ? "3P" : "1P", m.pha,
        r(m.Ib), tb(m.thietBi), m.thietBi?.in, m.thietBi?.icu, m.thietBi?.idn ?? "", m.nhomRcd ?? "", m.rcdBatBuoc ? "Có" : "",
        chuCap(m.cap, { soPha: m.soPha, dongCo: m.kieu?.dongCo }), m.cap?.s ?? "", m.cap?.pe ?? "", r(m.cap?.izp, 1),
        m.kieu?.duPhong ? "" : r(m.L, 1), r(m.cap?.du), r(m.cap?.duCongDon), m.cap ? r(m.cap.gioiHan ?? rule.duThanhCai, 1) : "",
        m.ong ?? "", r(m.nganMach?.ik1Cuoi, 2), m.nganMach?.nguong ? Math.round(m.nganMach.nguong.tren) : "", tuCatChu(m, tn),
        [gd.thietBi, gd.cap, gd.ong].filter(Boolean).join(" · ") + (gd.lyDo ? ` (lý do: ${gd.lyDo})` : ""),
        (m.kiemTra || []).map((k) => `${MUC[k.muc]}: ${k.noiDung}`).join(" | "),
      ]);
    }
    for (const g of t.nhomRcd || []) rows.push([`Nhóm ${g.ma}`, `RCBO chung cho ${g.mach.join(", ")}`, "", "", "", "", "", "", "", tb(g.thietBi)]);
    const tuKt = (t.kiemTra || []).map((k) => `${MUC[k.muc]}: ${k.noiDung}`);
    if (tuKt.length) { rows.push([]); rows.push(["Kiểm tra tủ"]); for (const s of tuKt) rows.push(["", s]); }
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws["!cols"] = [8, 36, 22, 12, 8, 6, 6, 5, 7, 24, 6, 7, 7, 8, 8, 34, 7, 7, 7, 6, 8, 9, 9, 14, 9, 9, 16, 24, 60].map((w) => ({ wch: w }));
    XLSX.utils.book_append_sheet(wb, ws, tenSheet(t.ma, dung));
  });

  XLSX.utils.book_append_sheet(wb, sheetCapOng(XLSX, kq), "Cap va ong");
  XLSX.utils.book_append_sheet(wb, sheetNganMach(XLSX, kq, tn), "Ngan mach");

  // --- Canh bao ----------------------------------------------------------------
  const cb = [["Mức", "Tủ", "Mạch", "Nội dung"]];
  for (const muc of ["loi", "canhbao", "ghichu"]) for (const c of kq.canhBao.filter((x) => x.muc === muc)) cb.push([MUC[muc], c.tu, c.mach, c.noiDung]);
  const wsCb = XLSX.utils.aoa_to_sheet(cb);
  wsCb["!cols"] = [{ wch: 10 }, { wch: 8 }, { wch: 14 }, { wch: 120 }];
  XLSX.utils.book_append_sheet(wb, wsCb, "Canh bao");

  // --- Quy tac -----------------------------------------------------------------
  const qt = [
    ["Bộ quy tắc", rule.trangThai, rule.phienBan], [],
    ["Tham số", "Giá trị"],
    ["Uf / Ud (V)", `${rule.uf} / ${rule.ud}`], ["ρ (Ω·mm²/m)", rule.rho], ["λ (Ω/m)", rule.lambda],
    ["k1 PVC / XLPE", `${rule.k1.PVC} / ${rule.k1.XLPE}`], ["ΔU tối đa / chiếu sáng / tới thanh cái (%)", `${rule.duMax} / ${rule.duChieuSang} / ${rule.duThanhCai}`],
    ["Kđt theo hồ sơ", JSON.stringify(rule.ks)], ["Hệ số đồng thời theo số tủ con", JSON.stringify(rule.ksTuCon)],
    ["In ≥ k·Ib", rule.kIn], ["Tỷ số chọn lọc", rule.kChonLoc], ["In lớn nhất dùng MCB (A)", rule.inMaxMcb],
    ["Lệch pha cho phép (%)", rule.lechPha], ["Dự phòng vỏ tủ (%)", rule.duPhongVo], ["Ống nhỏ nhất (mm) / lấp đầy (%)", `${rule.ongToiThieu} / ${rule.lapDay}`],
    ["Sơ đồ nối đất", rule.noiDat], ["Ngắn mạch: c max / c min", `${rule.nganMach.cMax} / ${rule.nganMach.cMin}`],
    ["ρ20 (Ω·mm²/m) / hệ số ρ khi tính Ik min", `${rule.nganMach.rho20} / ${rule.nganMach.kRhoMin}`],
    ["Ngưỡng cắt từ MCB B / C / D (× In)", ["B", "C", "D"].map((k) => rule.nganMach.duongCong[k].join("–")).join(" / ")],
    ["Ngưỡng cắt từ MCCB (× In, sai số)", `${rule.nganMach.imMccb} ± ${rule.nganMach.saiSoMccb * 100}%`],
    [], ["Loại mạch", "cosφ", "In tối thiểu (A)", "Đường cong", "RCD", "Tiết diện tối thiểu (mm²)"],
    ...Object.entries(rule.loaiMach).map(([k, v]) => [k, v.cos, v.inMin, v.curve, v.rcd, v.sMin]),
  ];
  const wsQt = XLSX.utils.aoa_to_sheet(qt);
  wsQt["!cols"] = [{ wch: 44 }, { wch: 22 }, { wch: 14 }, { wch: 10 }, { wch: 10 }, { wch: 12 }];
  XLSX.utils.book_append_sheet(wb, wsQt, "Quy tac");
  return wb;
}

// --- Cap va ong: diễn giải từng bước chọn tiết diện rồi suy ra đường kính ống (hàm ở dien-giai.mjs) ---
function sheetCapOng(XLSX, kq) {
  const rule = kq.quyTac;
  const rows = [
    ["TÍNH TIẾT DIỆN DÂY → ĐƯỜNG KÍNH ỐNG LUỒN"],
    [`B1: Ib = P/(U·cosφ) (1 pha U=${rule.uf} V; 3 pha √3·${rule.ud} V). B2: In ≥ ${rule.kIn}·Ib. ` +
      `B3: chọn S nhỏ nhất ≥ S tối thiểu của loại mạch, có Iz′ = Iz(bảng IEC 60364-5-52, ${"PVC B1"} cho mạch nhánh) × k1(${rule.k1.PVC}, 35 °C) × k2(nhóm) ≥ In ` +
      `và ΔU cộng dồn ≤ ${rule.duMax}% (chiếu sáng ${rule.duChieuSang}%). B4: PE theo S. ` +
      `B5: tổng diện tích dây (gồm cách điện) ≤ ${rule.lapDay}% diện tích trong ống; ống nhỏ nhất Ø${rule.ongToiThieu}.`],
    [],
    ["Tủ", "Mã", "Phụ tải", "Pha", "P (kW)", "cosφ", "Ib (A)", "In (A)", "Cách điện / PP lắp", "Số dây mang tải", "S tối thiểu (mm²)",
      "k1×k2", "Các cỡ đã thử", "S chọn (mm²)", "PE (mm²)", "Iz′ (A)", "L (m)", "ΔU cộng dồn (%)", "Lý do chọn",
      "Dây trong ống", "Tổng diện tích dây (mm²)", "Các cỡ ống đã thử (lấp đầy)", "Ống chọn", "Ø trong (mm)", "Lấp đầy (%)"],
  ];
  for (const t of kq.tu) {
    if (t.capNguon) {
      const c = t.capNguon;
      const o = c.mang ? null : chuoiOng([c.pe], [c.s], rule);
      rows.push([t.ma, "Nguồn", `CÁP CẤP ${t.ten}`, t.soPha === 3 ? "3P" : "1P", r(t.ptt), r(t.cosTb), r(t.iMax, 1), t.cbTong?.in,
        `${c.cachDien} / ${c.phuongPhap}`, c.soDayTai, "", r(c.k, 2), "", c.s, c.pe, r(c.izp, 1), c.chuaCoL ? "chưa có" : r(t.lCap, 1),
        c.chuaCoL ? "chưa kiểm" : r(c.duCongDon), "Iz′ ≥ In CB tổng" + (c.chuaCoL ? "; chưa có L nên chưa kiểm ΔU" : ""),
        o?.moTa ?? "MÁNG CÁP", o ? r(o.tong, 1) : "", o?.thu ?? "", o ? `Ø${o.d}` : "MÁNG CÁP", o ? o.dTrong : "", o ? r(o.pct, 1) : ""]);
    }
    for (const m of t.mach) {
      if (!m.cap?.s || m.laCapTuCon) continue;
      const c = m.cap;
      const { buoc, quyetDinh } = chuoiTietDien(m, c, rule, t.duBus || 0);
      const o = chuoiOng([...Array(c.soDay).fill(c.s), c.pe], [], rule);
      // Ống ghi đè: ghi cỡ ghi đè và lấp đầy theo cỡ đó
      const dGhiDe = m.ghiDe?.ong ? Number(String(m.ghiDe.ong).match(/(\d+)\s*$/)?.[1]) : null;
      const oGd = dGhiDe ? rule.ong.find(([d]) => d === dGhiDe) : null;
      if (oGd) Object.assign(o, { d: `${oGd[0]} (ghi đè)`, dTrong: oGd[1], pct: (o.tong / dt(oGd[1])) * 100 });
      else if (m.ghiDe?.ong) Object.assign(o, { d: `${m.ghiDe.ong} (ghi đè)`, dTrong: "", pct: null });
      rows.push([t.ma, m.ma, m.phuTai, m.soPha === 3 ? "3P" : m.pha ?? "1P", r(m.P / 1000), r(m.cos), r(m.Ib, 1), m.thietBi?.in,
        `${c.cachDien} / ${c.phuongPhap}`, c.soDayTai, m.kieu?.sMin ?? "", r(c.k ?? rule.k1[c.cachDien], 2), buoc, c.s, c.pe, r(c.izp, 1),
        r(m.L, 1), r(c.duCongDon), quyetDinh, o.moTa, r(o.tong, 1), o.thu, `Ø${o.d}`, o.dTrong, r(o.pct, 1)]);
    }
  }
  rows.push([], ["Đường kính ngoài dây đơn Cu/PVC (mm)", ...Object.entries(rule.dkDayDon).map(([s, d]) => `${s}: ${d}`)]);
  rows.push(["Ống PVC Ø ngoài: Ø trong (mm)", ...rule.ong.map(([d, i]) => `Ø${d}: ${i}`)]);
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = [6, 7, 34, 5, 7, 6, 7, 6, 12, 8, 9, 7, 70, 8, 8, 8, 6, 9, 30, 40, 10, 44, 8, 8, 8].map((w) => ({ wch: w }));
  return ws;
}

// --- Ngan mach: Ik3 max tại thanh cái từng tủ, Ik1 min cuối mạch, tự cắt nguồn, chọn lọc (ngan-mach.mjs) ---
function sheetNganMach(XLSX, kq, tn) {
  const rule = kq.quyTac;
  const nm = rule.nganMach;
  const mO = (x) => r(x * 1000, 1);   // Ω → mΩ
  const nguon = kq.nganMach?.nguon;
  const rows = [
    ["TÍNH NGẮN MẠCH THEO TỔNG TRỞ — TỰ CẮT NGUỒN — CHỌN LỌC"],
    [`Nguồn: ${nguon?.moTa ?? "—"}. Sơ đồ nối đất ${rule.noiDat}. Ik3 max = c max·Uf/|Z| (c = ${nm.cMax}, ρ20 = ${nm.rho20} Ω·mm²/m); ` +
      `Ik1 min = c min·Uf/|Z vòng pha–PE| (c = ${nm.cMin}, ρ = ${nm.kRhoMin}·ρ20). Cáp: R = ρ·L/S, X = ${r(rule.lambda * 1000, 2)} mΩ/m.`],
    [tn ? "Tự cắt nguồn (TN, IEC 60364-4-41): Ik1 min cuối mạch ≥ ngưỡng cắt từ cận trên của CB (MCB B 5·In, C 10·In, D 20·In; MCCB Im +20%); không đạt thì RCD 30 mA đảm nhận, không có RCD thì cảnh báo."
      : "Sơ đồ TT: dòng chạm vỏ bị giới hạn bởi điện trở tiếp địa — tự cắt nguồn nhờ RCD (RA·IΔn ≤ 50 V); Ik1 min chỉ để tham khảo."],
    [],
    ["Tủ", "Cấp từ", "Số pha", "Nguồn Ik", "R max (mΩ)", "X max (mΩ)", "Ik3 max thanh cái (kA)", "CB tổng", "Icu CB tổng (kA)",
      "R vòng (mΩ)", "X vòng (mΩ)", "Ik1 min thanh cái (kA)", "Chọn lọc ngắn mạch"],
  ];
  for (const t of kq.tu) {
    const n = t.nganMach;
    if (!n) continue;
    rows.push([t.ma, t.cha ?? "Nguồn", t.soPha === 3 ? "3P" : "1P", n.nguon === "nhập" ? "Ik nhập ở tủ" : "Tính", mO(n.zMax.r), mO(n.zMax.x),
      r(n.ikMax, 2), tb(t.cbTong), t.cbTong?.icu ?? "", mO(n.zVong.r), mO(n.zVong.x), r(n.ik1Min, 2),
      (n.chonLoc || []).map((c) => `${c.tren}: ${c.toanPhan ? "toàn phần" : `một phần tới Is ≈ ${r(c.is / 1000, 2)} kA`}`).join("; ")]);
  }
  rows.push([], ["Tủ", "Mã", "Phụ tải", "Thiết bị", "Icu (kA)", "Ik3 max đầu mạch (kA)", "S / PE (mm²)", "L (m)", "Ik1 min cuối (kA)",
    "Ngưỡng cắt từ (A)", "Cách tính ngưỡng", "Tự cắt nguồn", "Đề xuất"]);
  for (const t of kq.tu) {
    for (const m of t.mach) {
      const n = m.nganMach;
      if (!n || n.ik1Cuoi == null) continue;
      rows.push([t.ma, m.ma, m.laCapTuCon ? `CẤP TỦ ${m.tuCon} (Ik1 tại thanh cái tủ con)` : m.phuTai, tb(m.thietBi), m.thietBi?.icu ?? "", r(n.ikDau, 2),
        m.cap?.s ? `${m.cap.s} / ${m.cap.pe}` : "", r(m.L, 1), r(n.ik1Cuoi, 3), n.nguong ? Math.round(n.nguong.tren) : "", n.nguong?.moTa ?? "",
        tuCatChu(m, tn), n.deXuat ?? ""]);
    }
  }
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = [7, 8, 34, 22, 9, 10, 10, 22, 9, 10, 26, 16, 60].map((w) => ({ wch: w }));
  return ws;
}
