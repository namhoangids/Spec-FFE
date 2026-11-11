// Thuyết minh tính toán hệ thống điện — dựng nội dung MỘT lần từ kết quả tinhDuAn,
// rồi xuất ra HTML (thuyetMinhHtml, ở file này) hoặc Word (thuyet-minh-docx.mjs).
//
// Nội dung là danh sách khối:
//   { loai: "tieuDe", text, phu }                       tiêu đề tài liệu + dòng phụ
//   { loai: "thongTin", o: [[NHÃN, giá trị] × 6] }      khối thông tin dự án 3 cột × 2 dòng (theo mẫu Indust Design)
//   { loai: "cachDung", noi }                            dòng "Cách dùng — …" ngay dưới khối thông tin
//   { loai: "muc", cap: 1, so: "01", text } | { loai: "muc", cap: 2, text }   đề mục
//   { loai: "doan", noi }                                đoạn văn; noi = [chuỗi | { b: "chữ đậm" }]
//   { loai: "danhSach", muc: [noi] }                     danh sách gạch đầu dòng
//   { loai: "bang", cot: [{ ten, rong, so }], dong: [[ô]], nho } bảng (rong: tỷ lệ độ rộng, so: căn phải)
//   { loai: "trang", huong: "doc"|"ngang" }              sang trang mới với hướng giấy này
//   { loai: "ngatTrang" }                                sang trang mới, giữ hướng
//   { loai: "kyTen", o: [[chức danh, tên]] }             ô ký

import { chuCap, soBanVe } from "./sang-ban-ve.mjs";
import { chuoiTietDien, tb, v } from "./dien-giai.mjs";
import { laTN } from "./ngan-mach.mjs";

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
 * @returns {{ tieuDe: string, tenDuAn: string, chanTrang: string, khoi: object[] }}
 */
export function noiDungThuyetMinh(kq, info = {}, { soTheoTu = null, ngay = new Date() } = {}) {
  const rule = kq.quyTac;
  const nm = rule.nganMach;
  const tn = laTN(rule.noiDat);
  const nguonNm = kq.nganMach?.nguon;
  const TU_CAT = { dat: "Đạt", rcd: "Nhờ RCD", khong: tn ? "Không đạt" : "Cần RCD" };
  const chonLocText = (t) => (t.nganMach?.chonLoc || []).map((c) => `${c.tren}: ${c.toanPhan ? "toàn phần" : `một phần, tới Is ≈ ${so(c.is / 1000, 2)} kA`}`).join("; ");
  const khoi = [];
  // Đề mục cấp 1 viết "1. TÊN" trong code; tách số thành "01" để trình bày như mẫu Indust Design
  const muc = (cap, text) => {
    const m = cap === 1 && text.match(/^(\d+)\.\s+(.*)$/);
    khoi.push(m ? { loai: "muc", cap, so: m[1].padStart(2, "0"), text: m[2] } : { loai: "muc", cap, text });
  };
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
  const dsTo = `${soTong}${tatCaTo.length ? `, ${tatCaTo[0]}${tatCaTo.length > 1 ? `–${tatCaTo.at(-1)}` : ""}` : ""}`;
  khoi.push({ loai: "tieuDe", text: tieuDe, phu: "ELECTRICAL CALCULATION REPORT · SƠ ĐỒ NGUYÊN LÝ TỦ ĐIỆN" });
  // Khối thông tin 3 × 2 như mẫu "Yêu cầu bàn giao mặt bằng" của Indust Design
  khoi.push({
    loai: "thongTin",
    o: [
      ["DỰ ÁN", info.project || "—"],
      ["CHỦ ĐẦU TƯ", info.client || "—"],
      ["NGÀY LẬP", info.date || ngayVN(ngay)],
      ["BẢN VẼ KÈM THEO", `${dsTo} (${kq.tu.length} tủ)`],
      ["NGƯỜI LẬP", info.madeBy || info.design || "Indust Design"],
      ["TRẠNG THÁI", chuaDuyet ? "Working Document — quy tắc chưa duyệt" : "Working Document"],
    ],
  });
  khoi.push({
    loai: "cachDung",
    noi: [`thuyết minh tự sinh từ dữ liệu dự án${info.loaiCongTrinh ? ` (${info.loaiCongTrinh.toLowerCase()}${info.address ? `, ${info.address}` : ""})` : ""} và bộ quy tắc tính toán phiên bản ${rule.phienBan}. Số liệu khớp với bảng tính và bộ bản vẽ ${dsTo}: muốn đổi số liệu thì sửa đầu vào rồi xuất lại, chỉ sửa tay phần lời văn. `,
      ...(chuaDuyet ? [{ b: "Bộ quy tắc đang ở trạng thái CHƯA DUYỆT" }, " — kỹ sư điện có chứng chỉ phải kiểm tra trước khi phát hành hồ sơ."] : [])],
  });

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
    const ng = g.nguonNganMach;
    const nguonText = !ng ? "" : ng.kva
      ? `nguồn từ máy biến áp riêng ${ng.moTa.replace(/^MBA /, "")} (Ik tại đầu cực ≈ ${so(ng.ikDiemDau, 1)} kA)`
      : `dòng ngắn mạch tại điểm đấu Ik = ${so(ng.ikDiemDau)} kA${ng.macDinh ? " (giá trị mặc định — cần xác nhận với đơn vị cấp điện / tòa nhà)" : ""}`;
    doan({ b: `Tủ ${g.ma} – ${g.ten}: ` }, `nguồn ${ap}, tần số 50 Hz; sơ đồ nối đất ${rule.noiDat}; ${nguonText}; `,
      g.nganMach?.nguon === "nhập" ? `Ik tại tủ nhập theo số liệu: ${so(g.ikTinh)} kA.` : `Ik3 max tại thanh cái tủ (tính theo tổng trở) = ${so(g.ikTinh, 2)} kA.`);
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
    ["Khả năng cắt ngắn mạch: ", { b: "Icu ≥ Ik3 max" }, " tại thanh cái tủ đặt thiết bị (mục 3.4)."],
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
  muc(2, "3.4. Ngắn mạch, tự cắt nguồn và chọn lọc");
  ds([
    ["Phương pháp tổng trở (IEC 60909-0 rút gọn): tổng trở từ nguồn tới điểm sự cố bằng tổng trở nguồn cộng tổng trở các đoạn cáp; ",
      { b: "Ik3 max = c max · Uf / |Z|" }, ` (c max = ${so(nm.cMax, 2)}) tại thanh cái từng tủ — tủ 1 pha tính sự cố pha – trung tính.`],
    ["Nguồn: suy từ Ik tại điểm đấu, ", { b: "Zs = c max · Uf / Ik" }, " (Xs = 0,995 Zs, Rs = 0,1 Xs); công trình có máy biến áp riêng thì ",
      { b: "Zt = Uk · Ud² / Sn" }, ` (Rt = ${so(nm.rtZt, 1)} Zt khi chưa có tổn hao ngắn mạch), lưới trung thế ${nm.sscTrungThe} MVA.`],
    ["Cáp: ", { b: "R = ρ · L / S, X = λ · L" }, `; Ik max dùng ρ20 = ${so(nm.rho20, 5)} Ω·mm²/m, Ik min dùng ${so(nm.kRhoMin, 2)} · ρ20 (dây nóng lên khi sự cố); λ = ${so(rule.lambda * 1000, 2)} mΩ/m.`],
    ["Dòng chạm vỏ nhỏ nhất cuối mạch: ", { b: "Ik1 min = c min · Uf / |Z vòng pha – PE|" }, ` (c min = ${so(nm.cMin, 2)}), vòng gồm dây pha và dây PE của mọi đoạn cáp từ nguồn.`],
    tn
      ? ["Tự cắt nguồn khi chạm vỏ (IEC 60364-4-41, sơ đồ TN): ", { b: "Ik1 min ≥ Ia" }, ` — Ia là ngưỡng cắt từ cận trên của CB: MCB/RCBO đường cong B ${nm.duongCong.B[1]}·In, C ${nm.duongCong.C[1]}·In, D ${nm.duongCong.D[1]}·In; MCCB Im (mặc định ${nm.imMccb}·In) cộng ${Math.round(nm.saiSoMccb * 100)}% sai số. Đạt thì CB cắt tức thời, trong giới hạn 0,4 s. Không đạt mà mạch có RCD 30 mA thì RCD đảm nhận; mạch không có RCD thì đề xuất tăng tiết diện, dùng đường cong B hoặc RCBO.`]
      : ["Sơ đồ TT: dòng chạm vỏ bị giới hạn bởi điện trở tiếp địa, CB không tự cắt được — mọi mạch phải có RCD với ", { b: "RA · IΔn ≤ 50 V" }, " (IEC 60364-4-41 411.5)."],
    [`Chọn lọc: vùng quá tải theo tỷ số In CB trên ≥ ${so(rule.kChonLoc, 1)} · In CB dưới; vùng ngắn mạch: `, { b: "Ik3 max tại thanh cái tủ < ngưỡng cắt từ cận dưới của CB phía trên" },
      ` → chọn lọc toàn phần, ngược lại chọn lọc một phần tới Is ≈ ngưỡng đó (MCB đường cong C ${nm.duongCong.C[0]}·In; MCCB Im − ${Math.round(nm.saiSoMccb * 100)}%). Đây là chọn lọc theo dòng; giới hạn thực (thường cao hơn) tra bảng phối hợp của hãng.`],
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
      { ten: "IC (A)", rong: 6, so: true }, { ten: "Lệch pha (%)", rong: 6, so: true }, { ten: "Ik3 max (kA)", rong: 5, so: true }, { ten: "Ik1 min (kA)", rong: 5, so: true },
      { ten: "CB tổng", rong: 15 }, { ten: "Cáp cấp", rong: 18 }, { ten: "ΔU thanh cái (%)", rong: 7, so: true }, { ten: "Vỏ tủ (module)", rong: 7, so: true }],
    kq.tu.map((t) => [t.ma, soTo(t), t.soPha === 3 ? "3P" : "1P", so(t.pd, 2), so(t.ks, 2), so(t.ptt, 2), so(t.cosTb, 2),
      so(t.iPha.A), t.soPha === 3 ? so(t.iPha.B) : "—", t.soPha === 3 ? so(t.iPha.C) : "—", t.soPha === 3 ? so(t.lechPha) : "—", so(t.ikTinh, 2),
      so(t.nganMach?.ik1Min, 2), tb(t.cbTong), chuCap(t.capNguon, { soPha: t.soPha }) || "—", duBusText(t), t.module.voTu ?? "—"]),
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
      `; ΔU tới thanh cái ${duBusText(t, true)}; vỏ tủ ${t.module.voTu ?? "—"} module (thiết bị ${t.module.tong} module).`);
    doan({ b: "Ngắn mạch: " }, `Ik3 max tại thanh cái ${so(t.ikTinh, 2)} kA (${t.ikNguon}), Ik1 min tại thanh cái ${so(t.nganMach?.ik1Min, 2)} kA`,
      chonLocText(t) ? `; chọn lọc ngắn mạch — ${chonLocText(t)}.` : ".");

    const nhomCua = new Map((t.nhomRcd || []).flatMap((g) => g.mach.map((ma) => [ma, g])));
    bang(
      [{ ten: "Mã lộ", rong: 5 }, { ten: "Phụ tải", rong: 17 }, { ten: "P (kW)", rong: 5, so: true }, { ten: "cosφ", rong: 4, so: true }, { ten: "Pha", rong: 4 },
        { ten: "Ib (A)", rong: 5, so: true }, { ten: "Thiết bị bảo vệ", rong: 14 }, { ten: "Cáp", rong: 15 }, { ten: "Iz′ (A)", rong: 5, so: true },
        { ten: "L (m)", rong: 4, so: true }, { ten: "ΔU (%)", rong: 5, so: true }, { ten: "Ống", rong: 8 }, { ten: "Ik1 min (kA)", rong: 5, so: true },
        { ten: "Tự cắt", rong: 5 }, { ten: "Ghi chú", rong: 15 }],
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
          duPhong ? "" : (m.lThieu ? "chưa có" : so(m.L)), m.cap?.s ? so(m.cap.duCongDon, 2) : "", m.ong || "",
          m.nganMach?.ik1Cuoi != null ? so(m.nganMach.ik1Cuoi, 2) : "", TU_CAT[m.nganMach?.tuCat] ?? "", ghi.join("; ")];
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
  const cotCb = [{ ten: "Mức", rong: 11 }, { ten: "Tủ", rong: 7 }, { ten: "Mạch", rong: 10 }, { ten: "Nội dung", rong: 72 }];
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
    doan("Với số liệu đầu vào và bộ quy tắc nêu trên, bộ kiểm tra tự động không phát hiện lỗi đối với các điều kiện: Ib ≤ In ≤ Iz′; Icu ≥ Ik3 max tại thanh cái; sụt áp cộng dồn trong giới hạn; tiết diện không nhỏ hơn mức tối thiểu của loại mạch; RCD 30 mA cho các mạch bắt buộc; CB cấp tủ con không nhỏ hơn CB tổng của tủ con.");
    if (nCb) doan(`Còn ${nCb} cảnh báo (mục 6.1) cần kỹ sư xem xét và chấp thuận trước khi phát hành.`);
  } else {
    doan({ b: `Còn ${nLoi} lỗi (mục 6.1) phải xử lý trước khi phát hành hồ sơ.` }, nCb ? ` Ngoài ra có ${nCb} cảnh báo cần kỹ sư xem xét.` : "");
  }
  const demTuCat = (k) => kq.tu.reduce((a, t) => a + t.mach.filter((m) => !m.laCapTuCon && m.nganMach?.tuCat === k).length, 0);
  if (demTuCat("dat") + demTuCat("rcd") + demTuCat("khong")) {
    doan({ b: "Tự cắt nguồn khi chạm vỏ: " }, tn
      ? `${demTuCat("dat")} mạch đạt bằng ngưỡng cắt từ của CB, ${demTuCat("rcd")} mạch nhờ RCD 30 mA${demTuCat("khong") ? `, ${demTuCat("khong")} mạch chưa đạt — xem cảnh báo và đề xuất ở mục 6.1` : ""}.`
      : `sơ đồ TT — ${demTuCat("rcd")} mạch có RCD${demTuCat("khong") ? `, ${demTuCat("khong")} mạch chưa có RCD — xem cảnh báo ở mục 6.1` : ""}.`);
  }
  if (chuaDuyet) doan(`Bộ quy tắc tính toán phiên bản ${rule.phienBan} ${rule.trangThai.toLowerCase()}; kết quả chỉ có giá trị tham khảo cho đến khi kỹ sư điện duyệt.`);
  khoi.push({ loai: "kyTen", o: [["NGƯỜI LẬP", info.madeBy || info.design || ""], ["KIỂM TRA", info.checkBy || ""], ["CHỦ TRÌ", info.director || ""]] });

  const chanTrang = `Indust Design | ${info.client || info.project || "—"} | Thuyết minh tính toán hệ thống điện | Working Document`;
  return { tieuDe, tenDuAn: info.project || "", chanTrang, khoi };
}

// ============================================================================================
// HTML: xem nhanh trên web app, in ra PDF từ trình duyệt — trình bày theo mẫu văn bản Indust Design
// (Arial; cam #F15A22, xanh than #22333B, xám nâu #6E6156; khối thông tin 3×2; đề mục có vạch cam;
//  bảng băng màu xen kẽ, không viền dọc; chân trang "Indust Design | … | Working Document")
// ============================================================================================
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const noiHtml = (noi) => noi.map((x) => (typeof x === "string" ? esc(x) : `<b>${esc(x.b)}</b>`)).join("");
const cssStr = (s) => `"${String(s).replace(/["\\]/g, "\\$&")}"`;

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
      case "thongTin": {
        const o = (x) => `<td><span class="nhan">${esc(x[0])}</span>${esc(x[1])}</td>`;
        html += `<table class="tt"><tr>${k.o.slice(0, 3).map(o).join("")}</tr><tr class="nen">${k.o.slice(3).map(o).join("")}</tr></table>`;
        break;
      }
      case "cachDung": html += `<p class="cach"><b>Cách dùng — </b><i>${noiHtml(k.noi)}</i></p>`; break;
      case "muc": html += k.cap === 1 ? `<h2><span class="so">${esc(k.so ?? "")}</span>${esc(k.text)}</h2>` : `<h3>${esc(k.text)}</h3>`; break;
      case "doan": html += `<p${k.giu ? ' class="giu"' : ""}>${noiHtml(k.noi)}</p>`; break;
      case "danhSach": html += `<ul>${k.muc.map((m) => `<li>${noiHtml(m)}</li>`).join("")}</ul>`; break;
      case "bang": {
        const tong = k.cot.reduce((a, c) => a + (c.rong || 1), 0);
        html += `<table class="bang"><colgroup>${k.cot.map((c) => `<col style="width:${(((c.rong || 1) / tong) * 100).toFixed(1)}%">`).join("")}</colgroup>` +
          `<thead><tr>${k.cot.map((c) => `<th${c.so ? ' class="so"' : ""}>${esc(c.ten)}</th>`).join("")}</tr></thead><tbody>` +
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
  :root { --cam: #F15A22; --than: #22333B; --xam: #6E6156; --nen: #F5F4F1; --bang: #F7F7F5; }
  @page { size: A4; margin: 18mm 16mm 18mm 20mm;
    @bottom-center { content: ${cssStr(nd.chanTrang || "")} "  ·  Trang " counter(page) "/" counter(pages); font: 7.5pt Arial, Helvetica, sans-serif; color: #6E6156; border-top: 0.2mm solid #D5D0C8; } }
  @page ngang { size: A4 landscape; margin: 14mm 14mm 16mm 16mm; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: Arial, Helvetica, sans-serif; font-size: 10pt; line-height: 1.45; color: var(--than); background: #ECEAE6; }
  .in { position: sticky; top: 0; z-index: 2; padding: 10px 16px; background: var(--than); color: #fff; display: flex; gap: 12px; align-items: center; font-size: 14px; }
  .in button { font: inherit; padding: 6px 14px; border: 0; cursor: pointer; background: var(--cam); color: #fff; }
  section { background: #fff; max-width: 210mm; margin: 16px auto; padding: 16mm 16mm 14mm 20mm; }
  section.ngang { max-width: 297mm; padding: 14mm; page: ngang; }
  section + section { break-before: page; }
  .ngat { break-before: page; height: 0; }
  header { text-align: center; margin: 2mm 0 6mm; }
  h1 { font-size: 16.5pt; margin: 0; font-weight: bold; letter-spacing: .01em; }
  header .phu { margin: 1.5mm 0 0; font-size: 9.5pt; color: var(--xam); letter-spacing: .06em; text-align: center; }
  .tt { width: 100%; border-collapse: collapse; margin: 0 0 3mm; border-bottom: 0.35mm solid var(--cam); }
  .tt td { width: 33.33%; padding: 2.2mm 3mm; vertical-align: top; font-size: 9.5pt; }
  .tt tr.nen td { background: var(--nen); }
  .tt .nhan { display: block; font-size: 7.5pt; font-weight: bold; color: var(--xam); letter-spacing: .05em; margin-bottom: .6mm; }
  p.cach { margin: 3mm 0 5mm; font-size: 9pt; color: var(--xam); } p.cach b { color: var(--cam); font-style: normal; }
  h2 { font-size: 13pt; margin: 7mm 0 3mm; padding: .6mm 0 .6mm 3mm; border-left: 1.4mm solid var(--cam); color: var(--than); break-after: avoid; }
  h2 .so { color: var(--cam); margin-right: 3mm; }
  h3 { font-size: 10.5pt; margin: 5mm 0 2mm; color: var(--than); break-after: avoid; }
  p { margin: 0 0 2.2mm; text-align: justify; } p.giu { break-after: avoid; }
  ul { margin: 0 0 3mm; padding-left: 6mm; list-style: none; } li { margin-bottom: 1.2mm; position: relative; }
  li::before { content: "•"; color: var(--cam); position: absolute; left: -4.5mm; }
  table { border-collapse: collapse; width: 100%; }
  .bang { font-size: 8.5pt; margin: 2mm 0 4mm; }
  .bang th, .bang td { padding: 1.3mm 1.6mm; vertical-align: top; text-align: left; border: 0; }
  .bang th { font-weight: bold; color: var(--than); border-bottom: 0.35mm solid var(--cam); background: #fff; }
  .bang tbody tr:nth-child(odd) td { background: var(--bang); }
  .bang .so { text-align: right; white-space: nowrap; }
  .bang thead { display: table-header-group; } .bang tr { break-inside: avoid; }
  .ky { margin-top: 12mm; text-align: center; } .ky th { font-size: 8pt; color: var(--xam); letter-spacing: .05em; padding-bottom: 20mm; } .ky td { font-weight: bold; }
  @media (max-width: 760px) { section, section.ngang { margin: 8px; padding: 14px; } .bang { display: block; overflow-x: auto; } .tt td { display: block; width: auto; } }
  @media print { body { background: #fff; } .in { display: none; } section, section.ngang { margin: 0; padding: 0; max-width: none; }
    .bang tbody tr:nth-child(odd) td, .tt tr.nen td { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
</style></head><body>
<div class="in"><b>${esc(nd.tieuDe)}${nd.tenDuAn ? ` — ${esc(nd.tenDuAn)}` : ""}</b><button onclick="print()">In / Lưu PDF</button></div>
${html}
</body></html>`;
}
