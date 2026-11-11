// BOQ điện (E-BOQ): bóc khối lượng thiết bị tủ, phụ kiện, dây/cáp, ống từ kết quả tinhDuAn,
// rồi xuất Excel có sẵn khung đơn giá: sheet "Bang gia" (khóa → mã hàng, đơn giá, chiết khấu)
// và sheet "BOQ" tra giá bằng công thức. Chưa có bảng giá Schneider thì để trống giá — điền vào
// sheet "Bang gia" (hoặc nạp file bảng giá bằng docBangGia) là BOQ tự tính thành tiền.
//
// Mỗi dòng BOQ có "khóa" = mô tả chuẩn hóa (ví dụ "MCB 1P 16A C 6kA", "Dây Cu/PVC 1x2,5mm2",
// "Ống PVC Ø20"); bảng giá khớp theo khóa này.

import { chuCap } from "./sang-ban-ve.mjs";
import { tb } from "./dien-giai.mjs";

const NHOM = [
  ["thietBi", "A", "THIẾT BỊ ĐÓNG CẮT"],
  ["phuKien", "B", "VỎ TỦ VÀ PHỤ KIỆN TỦ"],
  ["day", "C", "DÂY VÀ CÁP ĐIỆN"],
  ["ong", "D", "ỐNG LUỒN DÂY, MÁNG CÁP"],
  ["thietBiDien", "E", "THIẾT BỊ ĐIỆN (THEO BÓC KHỐI MẶT BẰNG)"],
  ["dienNhe", "F", "THIẾT BỊ VÀ CÁP ĐIỆN NHẸ (MẠNG, CAMERA, TỦ RACK)"],
];
const tdText = (s) => String(s).replace(".", ",");          // 2.5 → "2,5"
const ongKhoa = (o) => {
  const d = String(o ?? "").match(/Ø\s*(\d+)/);
  return d ? `Ống PVC Ø${d[1]}` : /máng/i.test(o ?? "") ? "Máng cáp" : null;
};

/**
 * @param {object} kq — kết quả tinhDuAn
 * @param {{ haoHut?: number, bocKhoi?: object }} opt — hao hụt dây, cáp, ống (%), mặc định 5;
 *   bocKhoi: duAn.bocKhoi (engine/boc-khoi.mjs) → thêm nhóm E đèn, ổ cắm, công tắc theo bản vẽ
 * @returns {{ haoHut: number, dong: object[], chiTiet: object[], thieuL: string[] }}
 *   dong: { nhom, khoa, dvt, kl, ghiChu }, gộp theo khóa, đã cộng hao hụt và làm tròn lên;
 *   chiTiet: từng nguồn đóng góp (tủ, mạch, số lượng / chiều dài gốc, cách tính) để kiểm lại.
 */
export function tinhBoq(kq, { haoHut = 5, bocKhoi = null } = {}) {
  const map = new Map();
  const chiTiet = [];
  const thieuL = [];
  const cong = (nhom, khoa, dvt, sl, nguon, ghiChu = "") => {
    if (!khoa || !(sl > 0)) return;
    const d = map.get(khoa) ?? { nhom, khoa, dvt, tho: 0, ghiChu };
    d.tho += sl;
    if (ghiChu && !d.ghiChu.includes(ghiChu)) d.ghiChu = d.ghiChu ? `${d.ghiChu}; ${ghiChu}` : ghiChu;
    map.set(khoa, d);
    chiTiet.push({ nhom, khoa, dvt, ...nguon, sl });
  };
  const thietBi = (t, ma, x, ghi) => x && cong("thietBi", tb(x), "cái", 1, { tu: t.ma, mach: ma, cach: ghi || "" });

  // Dây đơn: n dây pha/trung tính + 1 dây PE; cáp nhiều lõi: 1 sợi cáp + dây PE riêng
  const capVaOng = (t, ma, cap, L, ong, soPha, dongCo) => {
    if (!cap?.s) return;
    const chu = chuCap(cap, { soPha, dongCo });
    if (!(L > 0)) { thieuL.push(`${t.ma}/${ma}`); return; }
    const pe = cap.pe ?? cap.s;
    if (cap.kieu === "nhieuLoi") {
      const loi = cap.soLoi ?? (soPha === 3 ? 4 : 2);
      cong("day", `Cáp Cu/XLPE/PVC ${loi}x${tdText(cap.s)}mm2`, "m", L, { tu: t.ma, mach: ma, cach: `1 sợi × ${L} m (${chu})` });
    } else {
      const n = cap.soDay ?? (soPha === 3 ? (dongCo ? 3 : 4) : 2);
      cong("day", `Dây Cu/PVC 1x${tdText(cap.s)}mm2`, "m", n * L, { tu: t.ma, mach: ma, cach: `${n} dây × ${L} m (${chu})` });
    }
    cong("day", `Dây tiếp địa Cu/PVC 1x${tdText(pe)}mm2 (vàng xanh)`, "m", L, { tu: t.ma, mach: ma, cach: `1 dây × ${L} m` });
    const ko = ongKhoa(ong);
    if (ko) cong("ong", ko, "m", L, { tu: t.ma, mach: ma, cach: `${L} m` });
  };

  for (const t of kq.tu) {
    // Thiết bị đóng cắt: mạch ra (kể cả lộ cấp tủ con và CB dự phòng), RCBO nhóm, CB tổng
    for (const m of t.mach) thietBi(t, m.ma, m.thietBi, m.kieu?.duPhong ? "CB dự phòng" : m.laCapTuCon ? `lộ cấp ${m.tuCon}` : "");
    for (const g of t.nhomRcd || []) thietBi(t, `Nhóm ${g.ma}`, g.thietBi, `RCBO chung ${g.mach.join(", ")}`);
    thietBi(t, "CB tổng", t.cbTong, "");

    // Vỏ tủ và phụ kiện
    if (t.module?.voTu) cong("phuKien", `Vỏ tủ điện ${t.module.voTu} module`, "cái", 1, { tu: t.ma, mach: "", cach: `${t.module.tong} module thiết bị + dự phòng` });
    else cong("phuKien", `Vỏ tủ điện (lớn hơn ${kq.quyTac.voTu.at(-1)} module — chọn theo hãng)`, "cái", 1, { tu: t.ma, mach: "", cach: `${t.module?.tong} module thiết bị` });
    if (t.coSpd) cong("phuKien", `Chống sét lan truyền SPD loại 2 ${t.soPha === 3 ? "3P+N" : "1P+N"}`, "bộ", 1, { tu: t.ma, mach: "", cach: "" });
    if (t.soPha === 3 && kq.quyTac.denBaoPha) cong("phuKien", "Đèn báo pha (bộ 3 đèn)", "bộ", 1, { tu: t.ma, mach: "", cach: "" });
    if (t.cbTong && t.cbTong.in >= kq.quyTac.ctNguong) {
      cong("phuKien", `Đồng hồ đa năng + ${t.soPha === 3 ? "3" : "1"} CT ${t.cbTong.in}/5A`, "bộ", 1, { tu: t.ma, mach: "", cach: `In tổng ${t.cbTong.in} A ≥ ${kq.quyTac.ctNguong} A` },
        "tỷ số CT chọn theo CB tổng — xác nhận khi đặt hàng");
    }
    if (t.nguonDuPhong && t.cbTong) {
      cong("phuKien", `Bộ chuyển nguồn tự động ATS ${t.cbTong.soCuc} ${t.cbTong.in}A`, "bộ", 1, { tu: t.ma, mach: "", cach: t.nguonDuPhong.ten || "nguồn dự phòng" },
        "định mức theo CB tổng — xác nhận với nhà cung cấp");
    }

    // Dây, cáp, ống: mạch ra (lộ cấp tủ con tính ở đây, không tính lại ở tủ con); cáp nguồn chỉ tính cho tủ gốc
    for (const m of t.mach) {
      if (m.kieu?.duPhong) continue;
      capVaOng(t, m.ma, m.cap, m.L, m.ghiDe?.ong || m.ong, m.soPha, m.kieu?.dongCo);
    }
    if (!t.cha && t.capNguon) {
      if (t.capNguon.chuaCoL || !(t.lCap > 0)) thieuL.push(`${t.ma}/cáp nguồn`);
      else capVaOng(t, "Cáp nguồn", t.capNguon, t.lCap, t.capNguon.mang ? "MÁNG CÁP" : t.ongNguon, t.soPha, false);
    }
  }

  // Thiết bị điện theo bóc khối mặt bằng (đèn, ổ cắm, công tắc…)
  for (const t of bocKhoi?.theoLoai ?? []) {
    cong("thietBiDien", t.moTa, t.dvt || "cái", t.sl, { tu: "", mach: "", cach: `bóc khối${bocKhoi.nguon ? ` ${bocKhoi.nguon}` : ""} (${t.nhom})` });
  }

  // Điện nhẹ (kq.dienNhe — engine/dien-nhe.mjs): thiết bị tủ rack, thiết bị đầu cuối, cáp Cat6, trục
  const dn = kq.dienNhe;
  if (dn) {
    const R = kq.quyTac.dienNhe;
    const F = (khoa, dvt, sl, rack, cach, ghi) => cong("dienNhe", khoa, dvt, sl, { tu: rack, mach: "", cach }, ghi);
    for (const r of dn.rack) {
      F(`Tủ rack ${r.uRack}U ${r.kieuRack}`, "cái", 1, r.ma, `${r.uTong}U thiết bị × ${R.kRack}`);
      for (const x of r.thietBi) {
        if (x.loai === "pp") F(`Patch panel Cat6 ${R.ppCong} cổng`, "cái", 1, r.ma, `${r.dem.lienKet} link`);
        else if (x.loai === "nvr" && dn.nvr) {
          F(`Đầu ghi NVR ${dn.nvr.kenh} kênh`, "cái", 1, r.ma, `${dn.nvr.soCam} camera + dự phòng`);
          F(`Ổ cứng NVR ${dn.nvr.hddTB} TB`, "cái", dn.nvr.soHdd, r.ma, `${dn.nvr.soCam} × ${R.bitrate} Mbps × ${R.ngayLuu} ngày`);
        } else if (x.loai === "ups") F(`UPS online ${r.ups.va} VA rack-mount`, "bộ", 1, r.ma, `${Math.round(r.w)} W / ${R.pfUps} × ${R.kUps}`, "thời gian lưu điện theo yêu cầu");
        else F(x.ten, "cái", 1, r.ma, "");
      }
      if (r.truc?.loai === "quang") {
        F("Cáp quang single-mode 4 lõi", "m", r.truc.L, r.ma, "trục về rack trung tâm");
        F("Module SFP single-mode", "cái", 2, r.ma, "2 đầu trục quang");
      } else if (r.truc) {
        if (r.truc.L > 0) F("Cáp Cat6 U/UTP 4 đôi", "m", 2 * r.truc.L, r.ma, `trục 2 sợi × ${r.truc.L} m`);
        else thieuL.push(`${r.ma}/trục điện nhẹ`);
      }
    }
    const dem = (loai, ngoai) => dn.lienKet.filter((x) => x.loai === loai && (ngoai == null || x.ngoaiTroi === ngoai)).length;
    F("Mặt + nhân ổ data RJ45 Cat6", "bộ", dem("DATA"), "", "1 bộ / ổ data");
    F(`Bộ phát Wi-Fi (AP) PoE`, "cái", dem("AP"), "", `PoE ${R.poeAp} W`);
    F("Camera IP trong nhà PoE", "cái", dem("CAM", false), "", `${R.bitrate} Mbps`);
    F("Camera IP ngoài trời PoE (IP66)", "cái", dem("CAM", true), "", `${R.bitrate} Mbps`);
    F("Cáp Cat6 U/UTP 4 đôi", "m", dn.lienKet.reduce((a, x) => a + x.L, 0), "", `${dn.lienKet.length} link cáp ngang`);
    F("Dây nhảy Cat6 (patch cord)", "sợi", 2 * dn.lienKet.length, "", "2 sợi / link (rack + đầu cuối)");
  }

  const he = 1 + haoHut / 100;
  const thuTu = (d) => NHOM.findIndex(([k]) => k === d.nhom);
  const dong = [...map.values()]
    .map((d) => ({ nhom: d.nhom, khoa: d.khoa, dvt: d.dvt, kl: d.dvt === "m" ? Math.ceil(d.tho * he - 1e-9) : d.tho, tho: d.tho, ghiChu: d.ghiChu }))
    .sort((a, b) => thuTu(a) - thuTu(b) || a.khoa.localeCompare(b.khoa, "vi", { numeric: true }));
  return { haoHut, dong, chiTiet, thieuL };
}

/**
 * Đọc bảng giá từ file Excel (sheet "Bang gia", hoặc sheet đầu tiên): cột Khóa | Mã hàng | Đơn giá | Chiết khấu (%) | Ghi chú.
 * Dòng tiêu đề nhận theo chữ "Khóa"; các dòng trên đó có thể ghi "Bảng giá: …", "Ngày áp dụng: …".
 * @returns {{ ten: string, ngay: string, gia: Map<string, { maHang, donGia, chietKhau, ghiChu }> }}
 */
export function docBangGia(XLSX, data) {
  const wb = XLSX.read(data, { type: data instanceof ArrayBuffer || ArrayBuffer.isView(data) ? "array" : "buffer" });
  const ws = wb.Sheets["Bang gia"] ?? wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
  const dau = rows.findIndex((r) => /^kh[oó]a/i.test(String(r[0]).trim()));
  const meta = rows.slice(0, Math.max(dau, 0)).map((r) => r.map(String).join(" "));
  const lay = (re) => meta.map((s) => s.match(re)?.[1]?.trim()).find(Boolean) ?? "";
  const gia = new Map();
  for (const r of rows.slice(dau + 1)) {
    const khoa = String(r[0]).trim();
    if (!khoa) continue;
    // Số có thể là số thật hoặc chữ "1.250.000" / "1,250,000" / "12,5"
    const so = (x) => {
      if (x === "" || x == null) return null;
      if (typeof x === "number") return x;
      const t = String(x).replace(/[^\d.,-]/g, "");
      return /^\d{1,3}([.,]\d{3})+$/.test(t) ? Number(t.replace(/[.,]/g, "")) : Number(t.replace(",", "."));
    };
    gia.set(khoa, { maHang: String(r[1] ?? "").trim(), donGia: so(r[2]), chietKhau: so(r[3]) ?? 0, ghiChu: String(r[4] ?? "").trim() });
  }
  return { ten: lay(/bảng giá[^:]*:\s*(.+)/i), ngay: lay(/ngày áp dụng[^:]*:\s*(.+)/i), gia };
}

/**
 * Xuất BOQ ra Excel (SheetJS): sheet BOQ (tra giá bằng công thức), Bang gia, Chi tiet.
 * @param {object} XLSX
 * @param {ReturnType<typeof tinhBoq>} boq
 * @param {object} info — duAn.info
 * @param {{ bangGia?: ReturnType<typeof docBangGia> }} opt
 */
export function xuatBoqExcel(XLSX, boq, info = {}, { bangGia = null } = {}) {
  const wb = XLSX.utils.book_new();
  const gia = bangGia?.gia ?? new Map();

  // --- Bang gia: mọi khóa của BOQ (giá lấy từ bảng giá đã nạp nếu có), cộng các khóa khác của bảng giá
  const khoaBoq = boq.dong.map((d) => d.khoa);
  const bg = [
    [`Bảng giá: ${bangGia?.ten || "(chưa nạp — điền mã hàng, đơn giá Schneider vào các cột bên dưới)"}`],
    [`Ngày áp dụng: ${bangGia?.ngay || ""}`],
    ["Khóa", "Mã hàng", "Đơn giá (VNĐ, chưa VAT)", "Chiết khấu (%)", "Ghi chú"],
  ];
  for (const k of [...khoaBoq, ...[...gia.keys()].filter((k) => !khoaBoq.includes(k))]) {
    const g = gia.get(k);
    bg.push([k, g?.maHang ?? "", g?.donGia ?? "", g?.chietKhau ?? "", g?.ghiChu ?? ""]);
  }
  const wsBg = XLSX.utils.aoa_to_sheet(bg);
  wsBg["!cols"] = [{ wch: 52 }, { wch: 18 }, { wch: 20 }, { wch: 14 }, { wch: 40 }];

  // --- BOQ: khối lượng là số, mã hàng / đơn giá / chiết khấu tra từ "Bang gia", thành tiền là công thức
  const rows = [
    ["BẢNG KHỐI LƯỢNG VẬT TƯ ĐIỆN (E-BOQ)"],
    [`Dự án: ${info.project || "—"}${info.client ? ` · Chủ đầu tư: ${info.client}` : ""}`],
    [`Bảng giá: ${bangGia?.ten || "chưa nạp"}${bangGia?.ngay ? ` · ngày áp dụng ${bangGia.ngay}` : ""} · Dây, cáp, ống đã cộng hao hụt ${boq.haoHut}%; thiết bị gồm cả CB dự phòng`],
    [],
    ["STT", "Hạng mục (khóa tra giá)", "ĐVT", "Khối lượng", "Mã hàng", "Đơn giá (VNĐ)", "Chiết khấu (%)", "Thành tiền (VNĐ)", "Ghi chú"],
  ];
  const ws = XLSX.utils.aoa_to_sheet(rows);
  let r = rows.length;                       // chỉ số dòng 0-based kế tiếp
  const dongTien = [];
  let tong = 0;                              // giá trị tính sẵn của dòng tổng (Excel tự tính lại khi mở)
  const ghi = (c, v) => { ws[XLSX.utils.encode_cell({ r, c })] = v; };
  const vl = (row, cot) => `IFERROR(VLOOKUP($B${row},'Bang gia'!$A:$E,${cot},FALSE),"")`;
  for (const [k, chu, ten] of NHOM) {
    const ds = boq.dong.filter((d) => d.nhom === k);
    if (!ds.length) continue;
    ghi(0, { t: "s", v: chu }); ghi(1, { t: "s", v: ten }); r++;
    ds.forEach((d, i) => {
      const row = r + 1;                     // số dòng Excel (1-based)
      ghi(0, { t: "n", v: i + 1 });
      ghi(1, { t: "s", v: d.khoa });
      ghi(2, { t: "s", v: d.dvt });
      ghi(3, { t: "n", v: d.kl });
      ghi(4, { t: "s", f: `${vl(row, 2)}&""`, v: gia.get(d.khoa)?.maHang ?? "" });
      ghi(5, { t: "n", f: `N(${vl(row, 3)})`, v: gia.get(d.khoa)?.donGia ?? 0 });
      ghi(6, { t: "n", f: `N(${vl(row, 4)})`, v: gia.get(d.khoa)?.chietKhau ?? 0 });
      const g = gia.get(d.khoa);
      const tien = Math.round(d.kl * (g?.donGia ?? 0) * (1 - (g?.chietKhau ?? 0) / 100));
      tong += tien;
      ghi(7, { t: "n", f: `ROUND(D${row}*F${row}*(1-G${row}/100),0)`, v: tien });
      ghi(8, { t: "s", v: d.ghiChu || "" });
      dongTien.push(row);
      r++;
    });
  }
  ghi(1, { t: "s", v: "TỔNG CỘNG (chưa VAT)" });
  ghi(7, { t: "n", f: dongTien.length ? `SUM(H${dongTien[0]}:H${dongTien.at(-1)})` : "0", v: tong });
  r++;
  if (boq.thieuL.length) { r++; ghi(1, { t: "s", v: `Chưa tính dây/cáp/ống cho: ${boq.thieuL.join(", ")} (chưa có chiều dài)` }); r++; }
  ws["!ref"] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: r - 1, c: 8 } });
  ws["!cols"] = [{ wch: 5 }, { wch: 52 }, { wch: 6 }, { wch: 11 }, { wch: 16 }, { wch: 15 }, { wch: 13 }, { wch: 17 }, { wch: 44 }];
  XLSX.utils.book_append_sheet(wb, ws, "BOQ");
  XLSX.utils.book_append_sheet(wb, wsBg, "Bang gia");

  // --- Chi tiet: từng nguồn đóng góp vào mỗi dòng BOQ (để kiểm khối lượng)
  const ct = [["Nhóm", "Khóa", "Tủ", "Mạch", "Số lượng / chiều dài gốc", "ĐVT", "Cách tính"]];
  const tenNhom = Object.fromEntries(NHOM.map(([k, chu, ten]) => [k, `${chu}. ${ten}`]));
  for (const c of boq.chiTiet) ct.push([tenNhom[c.nhom], c.khoa, c.tu, c.mach, c.sl, c.dvt, c.cach]);
  const wsCt = XLSX.utils.aoa_to_sheet(ct);
  wsCt["!cols"] = [{ wch: 26 }, { wch: 46 }, { wch: 8 }, { wch: 12 }, { wch: 12 }, { wch: 6 }, { wch: 50 }];
  XLSX.utils.book_append_sheet(wb, wsCt, "Chi tiet");
  return wb;
}
