// Điện nhẹ ra Excel (dien-nhe.xlsx): Tong hop (tính toán từng rack), Thiet bi rack, Dau noi (cổng patch panel ↔ ổ /
// thiết bị, mã nhãn TIA-606 để in và dán), Canh bao. Chỉ ghi giá trị — số liệu lấy từ engine/dien-nhe.mjs.

import { tenSwitch } from "./dien-nhe.mjs";

const MUC = { loi: "LỖI", canhbao: "CẢNH BÁO", ghichu: "GHI CHÚ" };
const vn = (x) => String(x).replace(".", ",");
const r1 = (x) => (x == null || Number.isNaN(x) ? "" : Math.round(x * 10) / 10);

/**
 * @param {object} XLSX — SheetJS
 * @param {object} dn — kết quả tinhDienNhe (đã có soTheoRack sau taoBoBanVe)
 * @param {object} kq — kết quả tinhDuAn (để ghi thiết bị, cáp của mạch nguồn rack)
 */
export function xuatDienNheExcel(XLSX, dn, kq, info = {}) {
  const R = kq.quyTac.dienNhe;
  const wb = XLSX.utils.book_new();
  const machNguon = (r) => r.nguon && kq.tu.find((t) => t.ma === r.nguon.tu)?.mach.find((m) => m.ma === r.nguon.ma);

  // --- Tong hop ----------------------------------------------------------------------------------
  const th = [
    ["ĐIỆN NHẸ — MẠNG LAN / WI-FI / CAMERA / TỦ RACK"],
    ["Dự án", info.project ?? ""], ["Chủ đầu tư", info.client ?? ""],
    ["Tổng", `${dn.tong.data} ổ data · ${dn.tong.tv} ổ TV (IPTV) · ${dn.tong.ap} AP Wi-Fi · ${dn.tong.cam} camera · ${dn.tong.chuong} chuông cửa IP · ` +
      `${dn.tong.cua} cửa ACS (${dn.tong.acs} bộ điều khiển) · ${dn.tong.loa} loa · ${dn.tong.lienKet} link Cat6`],
    ["Quy tắc", `dự phòng cổng ${R.duPhongCong}% · PoE AP ${R.poeAp} W, camera ${R.poeCam} W, × ${vn(R.kPoe)} · Cat6 ≤ ${R.cat6Max} m · ` +
      `NVR ${R.bitrate} Mbps × ${R.ngayLuu} ngày, ổ ${R.hddTB} TB · U × ${vn(R.kRack)} · UPS ΣW / ${vn(R.pfUps)} × ${vn(R.kUps)}`],
    [],
    ["Rack", "Số bản vẽ", "Tầng", "Vị trí", "Trung tâm", "Ổ data", "Ổ TV", "AP", "Camera", "Chuông IP", "Bộ ĐK ACS", "Link", "Switch", "PoE tải (W)", "PoE cần (W)",
      "Ngân sách PoE (W)", "Patch panel", "U thiết bị", "U cần (× hệ số)", "Tủ (U)", "Loại tủ", "Tổng W", "UPS (VA)",
      "Nguồn: tủ / lộ", "Thiết bị lộ nguồn", "Công suất lộ (W)", "Trục về rack trung tâm", "Ampli", "Nguồn ampli: tủ / lộ (W)"],
  ];
  for (const r of dn.rack) {
    const m = machNguon(r);
    th.push([r.ma, dn.soTheoRack?.get(r.ma) ?? "", r.tang ?? "", r.viTri ?? "", r.laTrungTam ? "Có" : "", r.dem.data, r.dem.tv, r.dem.ap, r.dem.cam, r.dem.chuong, r.dem.acs, r.dem.lienKet,
      [...r.switch, ...(r.switchLoi ? [r.switchLoi] : [])].map(tenSwitch).join(" + "), r.poe.tai, Math.ceil(r.poe.can), r.poe.nganSach, r.soPP,
      r.uTong, r1(r.uCan), r.uRack, r.kieuRack, Math.round(r.w), r.ups.va,
      r.nguon ? `${r.nguon.tu} / ${r.nguon.ma}${r.nguon.coSan ? "" : " (tự thêm)"}` : "", m?.thietBi ? `${m.thietBi.loai} ${m.thietBi.soCuc} ${m.thietBi.in}A` : "",
      r.nguon?.P ?? "", r.truc ? `${r.truc.moTa}${r.truc.L ? `, ${r.truc.L} m` : ""}` : "",
      r.ampli.map((a) => `${a.ra} W (${a.vung.join(", ")})`).join("; "), r.nguonAmpli ? `${r.nguonAmpli.tu} / ${r.nguonAmpli.ma} (${r.nguonAmpli.P} W)` : ""]);
  }
  if (dn.nvr) {
    th.push([], ["NVR", `${dn.nvr.kenh} kênh (rack ${dn.nvr.rack})`, "Camera", dn.nvr.soCam, "Dung lượng (TB)", r1(dn.nvr.tb),
      "Ổ cứng", `${dn.nvr.soHdd} × ${dn.nvr.hddTB} TB`, "Khay", dn.nvr.khay]);
  }
  const wsTh = XLSX.utils.aoa_to_sheet(th);
  wsTh["!cols"] = [8, 10, 6, 18, 8, 7, 6, 5, 7, 8, 8, 6, 46, 9, 9, 10, 9, 8, 10, 7, 10, 7, 8, 14, 16, 10, 34, 30, 20].map((w) => ({ wch: w }));
  XLSX.utils.book_append_sheet(wb, wsTh, "Tong hop");

  // --- Thiet bi rack ---------------------------------------------------------------------------------
  const tb = [["Rack", "Thiết bị", "Số U", "Công suất (W)"]];
  for (const r of dn.rack) {
    for (const x of r.thietBi) tb.push([r.ma, x.ten, x.u, x.w || ""]);
    tb.push([r.ma, "Tải PoE (AP, camera, chuông cửa)", "", r.poe.tai || ""], [r.ma, "TỔNG", r.uTong, Math.round(r.w)], []);
  }
  const wsTb = XLSX.utils.aoa_to_sheet(tb);
  wsTb["!cols"] = [{ wch: 8 }, { wch: 46 }, { wch: 8 }, { wch: 12 }];
  XLSX.utils.book_append_sheet(wb, wsTb, "Thiet bi rack");

  // --- Dau noi -------------------------------------------------------------------------------------------
  const dau = [["Mã nhãn (TIA-606)", "Rack", "Patch panel", "Cổng", "Tầng", "Phòng / khu vực", "Loại", "Thiết bị", "Chiều dài (m)", "Ghi chú"]];
  for (const lk of dn.lienKet) {
    dau.push([lk.ma, lk.rack, `PP${lk.pp}`, lk.cong, lk.tang, lk.phong, lk.moTa, lk.thietBi, lk.L,
      lk.L > R.cat6Max ? `Vượt ${R.cat6Max} m — xem cảnh báo` : ""]);
  }
  const wsDau = XLSX.utils.aoa_to_sheet(dau);
  wsDau["!cols"] = [18, 7, 10, 6, 6, 24, 18, 10, 12, 28].map((w) => ({ wch: w }));
  XLSX.utils.book_append_sheet(wb, wsDau, "Dau noi");

  // --- Am thanh, ACS chuong, KNX ------------------------------------------------------------------------------
  if (dn.amThanh.vung.length) {
    const am = [["Vùng", "Rack", "Tầng", "Phòng", "Số loa", "W / loa", "W phòng", "ΣW vùng", "Ampli (W)", "Cáp loa 2×1,5 (m)"]];
    for (const v of dn.amThanh.vung) v.phong.forEach((p, i) => am.push([v.ten, v.rack, p.tang, p.phong, p.loa, p.w, p.loa * p.w, i ? "" : v.W, i ? "" : v.ampli?.ra ?? "", p.L + 4 * p.loa]));
    const ws = XLSX.utils.aoa_to_sheet(am);
    ws["!cols"] = [22, 7, 6, 26, 7, 7, 8, 8, 9, 14].map((w) => ({ wch: w }));
    XLSX.utils.book_append_sheet(wb, ws, "Am thanh");
  }
  if (dn.tong.cua || dn.tong.chuong) {
    const ac = [["Loại", "Mã", "Rack", "Tầng", "Phòng / cửa", "Chiều dài (m)", "Thiết bị"]];
    for (const r of dn.rack) for (const b of r.acs) {
      ac.push(["Bộ điều khiển ACS", b.ma, r.ma, r.tang ?? "", `${b.cua} cửa`, "", "Bộ điều khiển + nguồn 12 V ắc quy, cạnh tủ rack"]);
      for (const c of b.dsCua) ac.push(["Cửa", b.ma, r.ma, c.tang, c.phong, c.L, "Đầu đọc · khóa điện · nút exit · công tắc cửa · nút khẩn"]);
    }
    for (const lk of dn.lienKet.filter((x) => x.loai === "CHUONG")) ac.push(["Chuông cửa IP", lk.thietBi, lk.rack, lk.tang, lk.phong, lk.L, lk.moTa]);
    const ws = XLSX.utils.aoa_to_sheet(ac);
    ws["!cols"] = [18, 12, 7, 6, 26, 12, 50].map((w) => ({ wch: w }));
    XLSX.utils.book_append_sheet(wb, ws, "ACS chuong");
  }
  if (dn.knx) {
    const K = dn.knx;
    const kx = [["KNX", `${K.line} line · nguồn bus ${K.nguon.ma} mA/line · ${Math.round(K.maLine)} mA/line cần · bus ≈ ${Math.round(K.busL)} m · thiết bị hệ thống ở tủ ${K.tuHe}`], [],
      ["Tủ", "Mạch", "Phụ tải", "Kiểu", "Kênh"]];
    for (const t of K.tu) for (const m of t.mach) kx.push([t.tu, m.ma, m.phuTai, m.kieu, m.kenh]);
    kx.push([], ["Tủ", "Actuator / thiết bị", "Module"]);
    for (const [tu, ds] of K.thietBiTu) for (const x of ds) kx.push([tu, x.ten, x.module]);
    kx.push([], ["Tầng", "Phòng", "Phím / cảm biến"]);
    for (const p of K.phong) kx.push([p.tang, p.phong, p.n]);
    const ws = XLSX.utils.aoa_to_sheet(kx);
    ws["!cols"] = [8, 36, 40, 10, 8].map((w) => ({ wch: w }));
    XLSX.utils.book_append_sheet(wb, ws, "KNX");
  }

  // --- Canh bao --------------------------------------------------------------------------------------------
  const cb = [["Mức", "Rack", "Phòng", "Nội dung"]];
  for (const muc of ["loi", "canhbao", "ghichu"]) for (const c of dn.canhBao.filter((x) => x.muc === muc)) cb.push([MUC[muc], c.tu, c.mach, c.noiDung]);
  const wsCb = XLSX.utils.aoa_to_sheet(cb);
  wsCb["!cols"] = [{ wch: 10 }, { wch: 8 }, { wch: 18 }, { wch: 110 }];
  XLSX.utils.book_append_sheet(wb, wsCb, "Canh bao");
  return wb;
}
