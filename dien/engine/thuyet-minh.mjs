// Thuyết minh tính toán hệ thống điện — dựng nội dung MỘT lần từ kết quả tinhDuAn,
// rồi xuất ra HTML (thuyetMinhHtml, ở file này) hoặc Word (thuyet-minh-docx.mjs).
//
// Nội dung là danh sách khối:
//   { loai: "muc", cap: 1|2, text }                     đề mục
//   { loai: "doan", noi }                                đoạn văn; noi = [chuỗi | { b: "chữ đậm" }]
//   { loai: "danhSach", muc: [noi] }                     danh sách gạch đầu dòng
//   { loai: "bang", cot: [{ ten, rong, so }], dong: [[ô]], nho } bảng (rong: tỷ lệ độ rộng, so: căn phải)
//   { loai: "thongTin", dong: [[nhãn, giá trị]] }        bảng thông tin không viền (đầu tài liệu)
//   { loai: "khung", noi }                               khung nhắc (CHƯA DUYỆT)
//   { loai: "trang", huong: "doc"|"ngang" }              sang trang mới với hướng giấy này
//   { loai: "ngatTrang" }                                sang trang mới, giữ hướng
//   { loai: "kyTen", o: [[chức danh, tên]] }             ô ký

import { chuCap, soBanVe } from "./sang-ban-ve.mjs";
import { chuoiTietDien, tb, v } from "./dien-giai.mjs";

const MUC = { loi: "Lỗi", canhbao: "Cảnh báo", ghichu: "Ghi chú" };
const so = (x, d = 1) => (x == null || Number.isNaN(x) ? "—" : Number(x).toLocaleString("vi-VN", { minimumFractionDigits: d, maximumFractionDigits: d }));
const pha = (t) => (t.soPha === 3 ? "3 pha" : "1 pha");
const ngayVN = (d = new Date()) => `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;

const TIEU_CHUAN = [
  [{ b: "QCVN 12:2014/BXD" }, " — Hệ thống điện của nhà ở và nhà công cộng."],
  [{ b: "TCVN 9206:2012" }, " — Đặt thiết bị điện trong nhà ở và công trình công cộng."],
  [{ b: "TCVN 9207:2012" }, " — Đặt đường dẫn điện trong nhà ở và công trình công cộng."],
  [{ b: "TCVN 7447 (IEC 60364)" }, " — Hệ thống lắp đặt điện hạ áp: phần 4-41 (bảo vệ chống điện giật), 4-43 (bảo vệ quá dòng), 5-52 (lựa chọn và lắp đặt hệ thống đi dây), 5-54 (nối đất và dây bảo vệ), 7-701 (khu vực có bồn tắm, vòi sen)."],
  [{ b: "IEC 61439-1, IEC 61439-3" }, " — Tủ điện hạ áp."],
  [{ b: "IEC 60898-1, IEC 60947-2, IEC 61009-1, IEC 61008-1" }, " — Áp tô mát MCB, MCCB, RCBO, RCCB."],
];

/** Bảng hệ số theo ngưỡng {1:1, 2:0.9, 4:0.8…} → "1 tủ: 1; 2–3 tủ: 0,9; …; từ 10 tủ: 0,6" */
function bacThang(bang, donVi) {
  const k = Object.keys(bang).map(Number).sort((a, b) => a - b);
  return k.map((a, i) => {
    const b = k[i + 1];
    const khoang = b == null ? `từ ${a}` : b - 1 === a ? `${a}` : `${a}–${b - 1}`;
    return `${khoang} ${donVi}: ${so(bang[a], 2).replace(/,?0+$/, "")}`;
  }).join("; ");
}

/**
 * @param {object} kq — kết quả tinhDuAn
 * @param {object} info — duAn.info
 * @param {{ soTheoTu?: Map<string,string[]>, ngay?: Date }} opt
 * @returns {{ tieuDe: string, tenDuAn: string, khoi: object[] }}
 */
export function noiDungThuyetMinh(kq, info = {}, { soTheoTu = null, ngay = new Date() } = {}) {
  const rule = kq.quyTac;
  const khoi = [];
  const muc = (cap, text) => khoi.push({ loai: "muc", cap, text });
  const doan = (...noi) => khoi.push({ loai: "doan", noi });
  const dan = (...noi) => khoi.push({ loai: "doan", noi, giu: true });   // đoạn dẫn: giữ cùng trang với khối sau
  const ds = (muc) => khoi.push({ loai: "danhSach", muc });
  const bang = (cot, dong, nho = false) => khoi.push({ loai: "bang", cot, dong, nho });

  const soTo = (t) => {
    const i = kq.tu.indexOf(t);
    const s = soTheoTu?.get(t.ma);
    return s?.length ? (s.length > 1 ? `${s[0]}–${s.at(-1)}` : s[0]) : soBanVe(info.soBanVeDau || "E.601", i);
  };
  const tatCaTo = soTheoTu ? [...soTheoTu.values()].flat() : kq.tu.map((t) => soTo(t));
  const soTong = info.soBanVeTong || "E.600";
  const dem = (m) => kq.canhBao.filter((c) => c.muc === m).length;
  const chuaDuyet = /chưa/i.test(rule.trangThai || "");
  // Lộ cấp của tủ con ở tủ trên
  const loCap = (t) => kq.tu.find((x) => x.ma === t.cha)?.mach.find((m) => m.tuCon === t.ma);
  // Tủ gốc chưa có chiều dài cáp nguồn: ΔU tới thanh cái chưa kiểm (không ghi 0%)
  const duBusText = (t, dai = false) => (t.capNguon?.chuaCoL ? (dai ? "chưa kiểm (chưa có chiều dài cáp nguồn)" : "chưa kiểm") : `${so(t.duBus, 2)}${dai ? "%" : ""}`);
  const capTuText = (t) => (t.cha ? `${t.cha} / ${loCap(t)?.ma ?? "?"}` : "Nguồn");

  // --- Đầu tài liệu -------------------------------------------------------------------------
  const tieuDe = "THUYẾT MINH TÍNH TOÁN HỆ THỐNG ĐIỆN";
  khoi.push({ loai: "trang", huong: "doc" });
  khoi.push({ loai: "tieuDe", text: tieuDe, phu: "SƠ ĐỒ NGUYÊN LÝ TỦ ĐIỆN" });
  khoi.push({
    loai: "thongTin",
    dong: [
      ["Dự án", info.project || "—"],
      ["Chủ đầu tư", info.client || "—"],
      ["Địa điểm", info.address || "—"],
      ["Loại công trình", info.loaiCongTrinh || "—"],
      ["Bản vẽ kèm theo", `${soTong} (sơ đồ cấp điện tổng)${tatCaTo.length ? ` và ${tatCaTo[0]}${tatCaTo.length > 1 ? `–${tatCaTo.at(-1)}` : ""} (sơ đồ nguyên lý ${kq.tu.length} tủ)` : ""}`],
      ["Ngày lập", info.date || ngayVN(ngay)],
      ["Bộ quy tắc tính toán", `Phiên bản ${rule.phienBan} — ${rule.trangThai}`],
    ],
  });
  if (chuaDuyet) {
    khoi.push({ loai: "khung", noi: [{ b: "Bộ quy tắc tính toán đang ở trạng thái CHƯA DUYỆT." }, " Thuyết minh này là bản nháp để tham khảo; kỹ sư điện có chứng chỉ phải kiểm tra trước khi phát hành hồ sơ."] });
  }

  // --- 1. Căn cứ ----------------------------------------------------------------------------
  muc(1, "1. CĂN CỨ THIẾT KẾ");
  dan("Thuyết minh được lập theo các quy chuẩn, tiêu chuẩn sau:");
  ds(TIEU_CHUAN);
  const coGiaDinh = kq.tu.some((t) => t.mach.some((m) => /giả định/i.test(m.nguon?.ghiChu || "")));
  doan("Số liệu phụ tải (công suất, chiều dài tuyến, loại khu vực) lấy theo bảng nhập liệu của dự án.",
    coGiaDinh ? " Các giá trị chưa có số liệu được ước theo bảng phụ tải điển hình và ghi rõ \"giả định\" ở cột Ghi chú (xem mục 6.3)." : "");

  // --- 2. Nguồn và giải pháp ----------------------------------------------------------------
  muc(1, "2. NGUỒN ĐIỆN VÀ GIẢI PHÁP CẤP ĐIỆN");
  for (const g of kq.tu.filter((t) => !t.cha)) {
    const ap = g.soPha === 3 ? `3 pha 4 dây, ${rule.ud}/${rule.uf} V` : `1 pha 2 dây, ${rule.uf} V`;
    const ikGhi = g.ikNguon === "mặc định" ? " (giá trị mặc định — cần xác nhận với đơn vị cấp điện / tòa nhà)" : "";
    doan({ b: `Tủ ${g.ma} – ${g.ten}: ` }, `nguồn ${ap}, tần số 50 Hz; dòng ngắn mạch tại tủ Ik = ${so(g.ikTinh)} kA${ikGhi}.`);
    if (g.nguonDuPhong) {
      doan(`Tủ ${g.ma} có nguồn dự phòng: ${g.nguonDuPhong.ten || "nguồn dự phòng"}. Nguồn chính (${g.nguonDuPhong.tenChinh || "nguồn lưới"}) và nguồn dự phòng chuyển đổi qua bộ ATS đặt trước CB tổng (xem bản vẽ ${soTong}).`);
    }
    if (g.capNguon) {
      doan(`Cáp nguồn cấp tủ ${g.ma}: ${chuCap(g.capNguon, { soPha: g.soPha })}`,
        g.capNguon.chuaCoL ? " — chưa có chiều dài tuyến nên mới chọn theo dòng cho phép, chưa kiểm sụt áp." : `, dài ${so(g.lCap)} m, sụt áp tới thanh cái ${so(g.duBus, 2)}%.`);
    }
  }
  doan(kq.tu.length > 1
    ? `Hệ thống phân phối hình tia gồm ${kq.tu.length} tủ: tủ gốc cấp điện cho các tủ con qua các lộ cấp riêng; mỗi mạch nhánh có thiết bị bảo vệ riêng đặt tại tủ.`
    : "Hệ thống gồm một tủ điện; mỗi mạch nhánh có thiết bị bảo vệ riêng đặt tại tủ.");
  bang(
    [{ ten: "Tủ", rong: 7 }, { ten: "Tên tủ", rong: 16 }, { ten: "Cấp từ / lộ", rong: 9 }, { ten: "Số pha", rong: 6 }, { ten: "CB tổng", rong: 18 },
      { ten: "Cáp cấp", rong: 26 }, { ten: "L (m)", rong: 6, so: true }, { ten: "Bản vẽ", rong: 10 }],
    kq.tu.map((t) => [t.ma, t.ten, capTuText(t), pha(t), tb(t.cbTong), chuCap(t.capNguon, { soPha: t.soPha }) || "—",
      t.capNguon?.chuaCoL ? "chưa có" : so(t.lCap), soTo(t)]),
    true,
  );

  // --- 3. Phương pháp ------------------------------------------------------------------------
  muc(1, "3. PHƯƠNG PHÁP TÍNH TOÁN");
  muc(2, "3.1. Dòng làm việc và công suất tính toán");
  ds([
    ["Mạch 1 pha: ", { b: "Ib = P / (Uf · cosφ)" }, `, với Uf = ${rule.uf} V.`],
    ["Mạch 3 pha: ", { b: "Ib = P / (√3 · Ud · cosφ)" }, `, với Ud = ${rule.ud} V.`],
    ["Công suất tính toán của tủ: ", { b: "Ptt = Kđt · ΣP" }, `. Kđt của các mạch cuối theo loại công trình: ${Object.entries(rule.ks).map(([k, x]) => `${k.toLowerCase()} ${so(x, 2)}`).join("; ")} (nếu tủ có Kđt nhập riêng thì dùng Kđt đó).`],
    ["Lộ cấp tủ con mang Ptt của tủ con, nhân thêm hệ số đồng thời theo số tủ con: ", bacThang(rule.ksTuCon, "tủ"), "."],
    ["Dòng từng pha của tủ: ", { b: "I pha = Kđt · ΣS pha / Uf" }, `, với S = P / cosφ. CB tổng chọn theo pha lớn nhất; tủ 3 pha được phân pha để độ lệch pha không quá ${rule.lechPha}%.`],
  ]);
  muc(2, "3.2. Chọn thiết bị bảo vệ");
  const rcdLoai = Object.entries(rule.loaiMach).filter(([, x]) => x.rcd === "30mA").map(([k]) => k.toLowerCase());
  ds([
    ["Điều kiện bảo vệ quá tải (IEC 60364-4-43): ", { b: "Ib ≤ In ≤ Iz′" }, `; chọn In ≥ ${so(rule.kIn, 2)} · Ib theo dãy định mức ${rule.dinhMuc.join(" – ")} A, không nhỏ hơn In tối thiểu của loại mạch.`],
    ["Khả năng cắt ngắn mạch: ", { b: "Icu ≥ Ik" }, " tại tủ đặt thiết bị."],
    ["Bảo vệ chống điện giật bổ sung (IEC 60364-4-41, 7-701): RCD/RCBO 30 mA cho ", rcdLoai.join(", "), `, và mọi mạch đi qua khu vực ${rule.khuVucRcd.map((x) => x.toLowerCase()).join(", ")}.`],
    [`CB tổng: In ≥ ${so(rule.kIn, 2)} · I pha lớn nhất và ≥ ${so(rule.kChonLoc, 1)} · In mạch ra lớn nhất (chọn lọc sơ bộ). Dùng MCB đến ${rule.inMaxMcb} A, lớn hơn dùng MCCB.`],
  ]);
  muc(2, "3.3. Chọn dây dẫn và kiểm tra sụt áp");
  ds([
    ["Dòng cho phép đã hiệu chỉnh: ", { b: "Iz′ = Iz · k1 · k2" }, `. Iz tra bảng IEC 60364-5-52 theo cách điện và cách lắp; k1 = ${so(rule.k1.PVC, 2)} (PVC), ${so(rule.k1.XLPE, 2)} (XLPE) theo nhiệt độ môi trường; k2 theo số mạch đi chung ống/máng.`],
    ["Sụt áp mạch 1 pha: ", { b: "ΔU = 2 · Ib · L · (ρ/S · cosφ + λ · sinφ)" }, `, tính % theo Uf; mạch 3 pha: `, { b: "ΔU = √3 · Ib · L · (ρ/S · cosφ + λ · sinφ)" }, `, tính % theo Ud. ρ = ${so(rule.rho, 4)} Ω·mm²/m (đồng), λ = ${so(rule.lambda * 1000, 2)} mΩ/m.`],
    [`Sụt áp cộng dồn từ nguồn tới thiết bị ≤ ${rule.duMax}% (mạch chiếu sáng ≤ ${rule.duChieuSang}%), trong đó tới thanh cái mỗi tủ ≤ ${rule.duThanhCai}%.`],
    ["Tiết diện chọn là cỡ nhỏ nhất (không nhỏ hơn tiết diện tối thiểu của loại mạch) thỏa đồng thời Iz′ ≥ In và điều kiện sụt áp. Dây PE chọn theo tiết diện dây pha (IEC 60364-5-54)."],
    [`Ống luồn dây: tổng diện tích dây kể cả cách điện ≤ ${rule.lapDay}% diện tích trong của ống; ống nhỏ nhất Ø${rule.ongToiThieu}.`],
    [`Vỏ tủ: tổng số module thiết bị cộng ${rule.duPhongVo}% dự phòng, chọn cỡ vỏ tiêu chuẩn ${rule.voTu.join(", ")} module; mỗi tủ có ít nhất ${rule.cbDuPhong} CB dự phòng.`],
  ]);
  dan("Giá trị mặc định theo loại mạch:");
  bang(
    [{ ten: "Loại mạch", rong: 34 }, { ten: "cosφ", rong: 8, so: true }, { ten: "In tối thiểu (A)", rong: 12, so: true }, { ten: "Đường cong", rong: 10 },
      { ten: "RCD 30 mA", rong: 12 }, { ten: "Tiết diện tối thiểu (mm²)", rong: 14, so: true }],
    Object.entries(rule.loaiMach).filter(([, x]) => !x.duPhong).map(([k, x]) => [k, so(x.cos, 2), String(x.inMin), x.curve,
      x.rcd === "30mA" ? "Bắt buộc" : x.rcd === "tuy_chon" ? "Tùy chọn" : "Theo khu vực", so(x.sMin, 1)]),
    true,
  );

  // --- 4. Tổng hợp phụ tải (trang ngang) -----------------------------------------------------
  khoi.push({ loai: "trang", huong: "ngang" });
  muc(1, "4. TỔNG HỢP PHỤ TẢI");
  bang(
    [{ ten: "Tủ", rong: 6 }, { ten: "Bản vẽ", rong: 8 }, { ten: "Số pha", rong: 5 }, { ten: "Pđ (kW)", rong: 6, so: true }, { ten: "Kđt", rong: 5, so: true },
      { ten: "Ptt (kW)", rong: 6, so: true }, { ten: "cosφ", rong: 5, so: true }, { ten: "IA (A)", rong: 6, so: true }, { ten: "IB (A)", rong: 6, so: true },
      { ten: "IC (A)", rong: 6, so: true }, { ten: "Lệch pha (%)", rong: 6, so: true }, { ten: "Ik (kA)", rong: 5, so: true }, { ten: "CB tổng", rong: 15 },
      { ten: "Cáp cấp", rong: 20 }, { ten: "ΔU thanh cái (%)", rong: 7, so: true }, { ten: "Vỏ tủ (module)", rong: 7, so: true }],
    kq.tu.map((t) => [t.ma, soTo(t), t.soPha === 3 ? "3P" : "1P", so(t.pd, 2), so(t.ks, 2), so(t.ptt, 2), so(t.cosTb, 2),
      so(t.iPha.A), t.soPha === 3 ? so(t.iPha.B) : "—", t.soPha === 3 ? so(t.iPha.C) : "—", t.soPha === 3 ? so(t.lechPha) : "—", so(t.ikTinh),
      tb(t.cbTong), chuCap(t.capNguon, { soPha: t.soPha }) || "—", duBusText(t), t.module.voTu ?? "—"]),
    true,
  );
  for (const g of kq.tu.filter((t) => !t.cha)) {
    doan(`Công suất tính toán toàn hệ tại tủ ${g.ma}: `, { b: `Ptt = ${so(g.ptt, 2)} kW` }, `, dòng pha lớn nhất `, { b: `${so(g.iMax)} A` },
      `; CB tổng ${tb(g.cbTong)}.`);
  }

  // --- 5. Chi tiết từng tủ (trang ngang) -----------------------------------------------------
  muc(1, "5. TÍNH TOÁN CHI TIẾT TỪNG TỦ");
  kq.tu.forEach((t, i) => {
    if (i > 0) khoi.push({ loai: "ngatTrang" });
    muc(2, `5.${i + 1}. Tủ ${t.ma} – ${t.ten} (bản vẽ ${soTo(t)})`);
    const ksTxt = t.soCon ? `Kđt mạch cuối ${so(t.ksRieng, 2)}, hệ số tủ con ${so(t.ksCon, 2)}` : `Kđt ${so(t.ks, 2)}`;
    doan({ b: "Cấp từ: " }, t.cha ? `tủ ${t.cha}, lộ ${loCap(t)?.ma ?? "?"}` : "nguồn", `; ${pha(t)}; Pđ = ${so(t.pd, 2)} kW; ${ksTxt}; Ptt = ${so(t.ptt, 2)} kW; cosφ TB = ${so(t.cosTb, 2)}; `,
      t.soPha === 3 ? `I pha A/B/C = ${so(t.iPha.A)} / ${so(t.iPha.B)} / ${so(t.iPha.C)} A, lệch pha ${so(t.lechPha)}%.` : `Itt = ${so(t.iMax)} A.`);
    doan({ b: "CB tổng: " }, tb(t.cbTong), t.cbTong?.ghiDe ? " (ghi đè, xem mục 6.2)" : "", "; ", { b: "cáp cấp: " }, chuCap(t.capNguon, { soPha: t.soPha }) || "—",
      t.capNguon && !t.capNguon.mang && t.ongNguon ? `, ${t.ongNguon}` : "", t.capNguon?.chuaCoL ? " (chưa có chiều dài)" : `, L = ${so(t.lCap)} m`,
      `; ΔU tới thanh cái ${duBusText(t, true)}; Ik = ${so(t.ikTinh)} kA (${t.ikNguon}); vỏ tủ ${t.module.voTu ?? "—"} module (thiết bị ${t.module.tong} module).`);

    const nhomCua = new Map((t.nhomRcd || []).flatMap((g) => g.mach.map((ma) => [ma, g])));
    bang(
      [{ ten: "Mã lộ", rong: 5 }, { ten: "Phụ tải", rong: 20 }, { ten: "P (kW)", rong: 5, so: true }, { ten: "cosφ", rong: 4, so: true }, { ten: "Pha", rong: 4 },
        { ten: "Ib (A)", rong: 5, so: true }, { ten: "Thiết bị bảo vệ", rong: 14 }, { ten: "Cáp", rong: 15 }, { ten: "Iz′ (A)", rong: 5, so: true },
        { ten: "L (m)", rong: 4, so: true }, { ten: "ΔU (%)", rong: 5, so: true }, { ten: "Ống", rong: 8 }, { ten: "Ghi chú", rong: 18 }],
      t.mach.map((m) => {
        const gd = m.ghiDe || {};
        const ghi = [];
        if (m.laCapTuCon) ghi.push(`Cấp tủ ${m.tuCon}`);
        const g = nhomCua.get(m.ma);
        if (g) ghi.push(`Chung ${tb(g.thietBi)} (nhóm ${g.ma})`);
        const daGhiDe = [gd.thietBi && "thiết bị", gd.cap && "cáp", gd.ong && "ống"].filter(Boolean);
        if (daGhiDe.length) ghi.push(`Ghi đè ${daGhiDe.join(", ")}`);
        if (m.nguon?.ghiChu) ghi.push(m.nguon.ghiChu);
        for (const k of m.kiemTra || []) if (k.muc !== "ghichu") ghi.push(`${MUC[k.muc]}: ${k.noiDung}`);
        const duPhong = m.kieu?.duPhong;
        return [m.ma, m.phuTai || (duPhong ? "DỰ PHÒNG" : ""), duPhong ? "" : so(m.P / 1000, 2), duPhong ? "" : so(m.cos, 2),
          m.soPha === 3 ? "3P" : (m.pha ?? ""), duPhong ? "" : so(m.Ib), tb(m.thietBi),
          m.cap?.s ? chuCap(m.cap, { soPha: m.soPha, dongCo: m.kieu?.dongCo }) : "", m.cap?.s ? so(m.cap.izp) : "",
          duPhong ? "" : (m.lThieu ? "chưa có" : so(m.L)), m.cap?.s ? so(m.cap.duCongDon, 2) : "", m.ong || "", ghi.join("; ")];
      }),
      true,
    );

    // Lý do chọn tiết diện: chỉ các mạch phải tăng cỡ hoặc có ghi đè cáp
    const lyDo = [];
    for (const m of t.mach) {
      if (!m.cap?.s || m.laCapTuCon || !m.thietBi) continue;
      const { buoc, quyetDinh } = chuoiTietDien(m, m.cap, rule, t.duBus || 0);
      if (/^(Tăng cỡ|Cáp ghi đè)/.test(quyetDinh)) lyDo.push([{ b: `${m.ma}: ` }, `chọn ${v(m.cap.s, m.cap.s % 1 ? 1 : 0)} mm² — ${quyetDinh[0].toLowerCase()}${quyetDinh.slice(1)}`, buoc ? ` (${buoc})` : "", "."]);
    }
    if (lyDo.length) { dan({ b: "Mạch phải tăng tiết diện so với mức tối thiểu:" }); ds(lyDo); }
    if (t.nhomRcd?.length) {
      dan({ b: "Nhóm RCBO dùng chung:" });
      ds(t.nhomRcd.map((g) => [`${g.ma}: ${tb(g.thietBi)} cho các mạch ${g.mach.join(", ")}.`]));
    }
  });

  // --- 6. Kiểm tra và kết luận (trang dọc) ---------------------------------------------------
  khoi.push({ loai: "trang", huong: "doc" });
  muc(1, "6. KIỂM TRA VÀ KẾT LUẬN");
  muc(2, "6.1. Kết quả kiểm tra tự động");
  const nLoi = dem("loi"), nCb = dem("canhbao"), nGc = dem("ghichu");
  doan(`Bộ kiểm tra tự động: `, { b: `${nLoi} lỗi, ${nCb} cảnh báo, ${nGc} ghi chú` }, ".");
  const dongCb = (muc) => kq.canhBao.filter((c) => c.muc === muc).map((c) => [MUC[c.muc], c.tu || "—", c.mach || "—", c.noiDung]);
  const cotCb = [{ ten: "Mức", rong: 9 }, { ten: "Tủ", rong: 7 }, { ten: "Mạch", rong: 10 }, { ten: "Nội dung", rong: 74 }];
  if (nLoi + nCb) bang(cotCb, [...dongCb("loi"), ...dongCb("canhbao")], true);
  if (nGc) { dan("Các ghi chú:"); bang(cotCb, dongCb("ghichu"), true); }

  muc(2, "6.2. Các ghi đè thiết kế");
  const ghiDe = [];
  for (const t of kq.tu) {
    if (t.ghiDeCbTong) ghiDe.push([t.ma, "CB tổng", t.ghiDeCbTong.thietBi || "", t.ghiDeCbTong.lyDo || ""]);
    for (const [ma, g] of Object.entries(t.ghiDeNhomRcd || {})) ghiDe.push([t.ma, `Nhóm ${ma}`, g.thietBi || "", g.lyDo || ""]);
    for (const m of t.mach) {
      const gd = m.ghiDe || {};
      const nd = [gd.thietBi && `Thiết bị: ${gd.thietBi}`, gd.cap && `Cáp: ${gd.cap}`, gd.ong && `Ống: ${gd.ong}`].filter(Boolean).join("; ");
      if (nd) ghiDe.push([t.ma, m.ma, nd, gd.lyDo || ""]);
    }
  }
  if (ghiDe.length) bang([{ ten: "Tủ", rong: 7 }, { ten: "Hạng mục", rong: 11 }, { ten: "Nội dung ghi đè", rong: 30 }, { ten: "Lý do", rong: 52 }], ghiDe, true);
  else doan("Không có ghi đè — mọi thiết bị, cáp và ống do công cụ chọn theo quy tắc.");

  muc(2, "6.3. Các giả định");
  const giaDinh = kq.tu.flatMap((t) => t.mach.filter((m) => /giả định/i.test(m.nguon?.ghiChu || "")).map((m) => [t.ma, m.ma, m.phuTai, m.nguon.ghiChu]));
  if (giaDinh.length) {
    dan("Các số liệu sau được ước theo bảng phụ tải điển hình, cần đối chiếu với thiết bị thực tế:");
    bang([{ ten: "Tủ", rong: 7 }, { ten: "Mạch", rong: 8 }, { ten: "Phụ tải", rong: 30 }, { ten: "Giả định", rong: 55 }], giaDinh, true);
  } else {
    doan("Không có số liệu phụ tải nào ghi là giả định trong bảng nhập liệu.");
  }

  muc(2, "6.4. Kết luận");
  if (nLoi === 0) {
    doan("Với số liệu đầu vào và bộ quy tắc nêu trên, bộ kiểm tra tự động không phát hiện lỗi đối với các điều kiện: Ib ≤ In ≤ Iz′; Icu ≥ Ik; sụt áp cộng dồn trong giới hạn; tiết diện không nhỏ hơn mức tối thiểu của loại mạch; RCD 30 mA cho các mạch bắt buộc; CB cấp tủ con không nhỏ hơn CB tổng của tủ con.");
    if (nCb) doan(`Còn ${nCb} cảnh báo (mục 6.1) cần kỹ sư xem xét và chấp thuận trước khi phát hành.`);
  } else {
    doan({ b: `Còn ${nLoi} lỗi (mục 6.1) phải xử lý trước khi phát hành hồ sơ.` }, nCb ? ` Ngoài ra có ${nCb} cảnh báo cần kỹ sư xem xét.` : "");
  }
  if (chuaDuyet) doan(`Bộ quy tắc tính toán phiên bản ${rule.phienBan} ${rule.trangThai.toLowerCase()}; kết quả chỉ có giá trị tham khảo cho đến khi kỹ sư điện duyệt.`);
  khoi.push({ loai: "kyTen", o: [["NGƯỜI LẬP", info.madeBy || info.design || ""], ["KIỂM TRA", info.checkBy || ""], ["CHỦ TRÌ", info.director || ""]] });

  return { tieuDe, tenDuAn: info.project || "", khoi };
}

// ============================================================================================
// HTML: xem nhanh trên web app, in ra PDF từ trình duyệt (bảng rộng tự sang trang ngang)
// ============================================================================================
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const noiHtml = (noi) => noi.map((x) => (typeof x === "string" ? esc(x) : `<b>${esc(x.b)}</b>`)).join("");

/** @param {ReturnType<typeof noiDungThuyetMinh>} nd */
export function thuyetMinhHtml(nd) {
  let html = "", mo = false;
  for (const k of nd.khoi) {
    switch (k.loai) {
      case "trang":
        if (mo) html += "</section>";
        html += `<section class="${k.huong}">`; mo = true; break;
      case "ngatTrang": html += `<div class="ngat"></div>`; break;
      case "tieuDe": html += `<header><h1>${esc(k.text)}</h1><p class="phu">${esc(k.phu)}</p></header>`; break;
      case "thongTin": html += `<table class="tt">${k.dong.map(([a, b]) => `<tr><th>${esc(a)}</th><td>${esc(b)}</td></tr>`).join("")}</table>`; break;
      case "khung": html += `<p class="khung">${noiHtml(k.noi)}</p>`; break;
      case "muc": html += k.cap === 1 ? `<h2>${esc(k.text)}</h2>` : `<h3>${esc(k.text)}</h3>`; break;
      case "doan": html += `<p${k.giu ? ' class="giu"' : ""}>${noiHtml(k.noi)}</p>`; break;
      case "danhSach": html += `<ul>${k.muc.map((m) => `<li>${noiHtml(m)}</li>`).join("")}</ul>`; break;
      case "bang": {
        const tong = k.cot.reduce((a, c) => a + (c.rong || 1), 0);
        html += `<table class="bang${k.nho ? " nho" : ""}"><colgroup>${k.cot.map((c) => `<col style="width:${(((c.rong || 1) / tong) * 100).toFixed(1)}%">`).join("")}</colgroup>` +
          `<thead><tr>${k.cot.map((c) => `<th>${esc(c.ten)}</th>`).join("")}</tr></thead><tbody>` +
          k.dong.map((d) => `<tr>${d.map((o, i) => `<td${k.cot[i]?.so ? ' class="so"' : ""}>${esc(o)}</td>`).join("")}</tr>`).join("") + "</tbody></table>";
        break;
      }
      case "kyTen": html += `<table class="ky"><tr>${k.o.map(([cd]) => `<th>${esc(cd)}</th>`).join("")}</tr><tr>${k.o.map(([, ten]) => `<td>${esc(ten)}</td>`).join("")}</tr></table>`; break;
    }
  }
  if (mo) html += "</section>";
  return `<!doctype html>
<html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Thuyết minh tính toán — ${esc(nd.tenDuAn)}</title>
<style>
  /* Chữ đen, đề mục xanh than #22333B (bộ nhận diện measure&make); font giống bản Word */
  @page { size: A4; margin: 20mm 15mm 18mm 25mm; }
  @page ngang { size: A4 landscape; margin: 15mm 15mm 15mm 18mm; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: "Times New Roman", Times, serif; font-size: 13pt; line-height: 1.4; color: #000; background: #F4F3F0; }
  .in { position: sticky; top: 0; z-index: 2; padding: 10px 16px; background: #22333B; color: #fff; display: flex; gap: 12px; align-items: center; font-family: Arial, Helvetica, sans-serif; font-size: 14px; }
  .in button { font: inherit; padding: 6px 14px; border: 0; cursor: pointer; background: #F15A22; color: #fff; }
  section { background: #fff; max-width: 210mm; margin: 16px auto; padding: 18mm 15mm 16mm 22mm; }
  section.ngang { max-width: 297mm; padding: 14mm 14mm; page: ngang; }
  section + section { break-before: page; }
  .ngat { break-before: page; height: 0; }
  header { text-align: center; margin: 4mm 0 8mm; }
  h1 { font-size: 17pt; margin: 0; color: #22333B; } .phu { margin: 2mm 0 0; font-weight: bold; font-size: 14pt; color: #22333B; }
  h2 { font-size: 13.5pt; margin: 7mm 0 3mm; color: #22333B; break-after: avoid; }
  h3 { font-size: 13pt; margin: 5mm 0 2mm; color: #22333B; font-style: italic; break-after: avoid; }
  p { margin: 0 0 2.5mm; text-align: justify; } p.giu { break-after: avoid; } header p { text-align: center; }
  ul { margin: 0 0 3mm; padding-left: 7mm; } li { margin-bottom: 1.2mm; }
  .khung { border: 0.4mm solid #a5514b; background: #f8eceb; padding: 3mm 4mm; margin: 6mm 0; }
  table { border-collapse: collapse; width: 100%; }
  .tt { margin: 0 0 4mm; } .tt th { text-align: left; font-weight: normal; width: 34%; padding: 1mm 2mm 1mm 0; vertical-align: top; } .tt td { font-weight: bold; padding: 1mm 0; }
  .bang { font-size: 10pt; margin: 2mm 0 4mm; } .bang.nho { font-size: 9pt; }
  .bang th, .bang td { border: 0.25mm solid #444; padding: 1mm 1.4mm; vertical-align: top; text-align: left; }
  .bang th { background: #eceae6; font-weight: bold; } .bang td.so { text-align: right; white-space: nowrap; }
  .bang thead { display: table-header-group; } .bang tr { break-inside: avoid; }
  .ky { margin-top: 12mm; text-align: center; } .ky th { font-weight: bold; padding-bottom: 22mm; } .ky td { font-weight: bold; }
  @media (max-width: 760px) { section, section.ngang { margin: 8px; padding: 14px; } .bang { display: block; overflow-x: auto; } }
  @media print { body { background: #fff; } .in { display: none; } section, section.ngang { margin: 0; padding: 0; max-width: none; } }
</style></head><body>
<div class="in"><b>${esc(nd.tieuDe)}${nd.tenDuAn ? ` — ${esc(nd.tenDuAn)}` : ""}</b><button onclick="print()">In / Lưu PDF</button></div>
${html}
</body></html>`;
}
