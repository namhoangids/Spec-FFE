// Bộ quy tắc mặc định cho lõi tính toán — lấy theo mục 6 của phương án
// (docs/phuong-an-so-do-nguyen-ly-tu-dien-dien-nhe.md) và sheet "Quy tac" của file Excel mẫu.
//
// TRẠNG THÁI: CHƯA DUYỆT — kỹ sư điện nội bộ cần kiểm tra và chốt từng giá trị.
// Mọi giá trị ở đây chỉnh được; file Excel nhập liệu có thể ghi đè các thông số chung.

export const QUY_TAC = {
  trangThai: "CHƯA DUYỆT",
  phienBan: "0.1 (09/11/2026)",

  // --- Thông số chung -----------------------------------------------------
  uf: 220,                 // V — điện áp pha
  ud: 380,                 // V — điện áp dây
  rho: 0.0225,             // Ω·mm²/m — điện trở suất đồng ở nhiệt độ làm việc
  lambda: 0.00008,         // Ω/m — điện kháng đơn vị dây (0,08 mΩ/m)
  k1: { PVC: 0.94, XLPE: 0.96 },   // hệ số nhiệt độ ở 35 °C (IEC 60364-5-52 B.52.14)
  duMax: 5,                // % — sụt áp cộng dồn tối đa
  duChieuSang: 3,          // % — sụt áp cộng dồn tối đa cho mạch chiếu sáng
  duThanhCai: 2,           // % — sụt áp cộng dồn tối đa tới thanh cái mỗi tủ (chọn cáp cấp tủ, chừa phần cho mạch nhánh)
  ks: { "Nhà ở / biệt thự": 0.7, "Căn hộ": 0.7 },
  // Hệ số đồng thời giữa các tủ con cấp từ một tủ, theo số tủ con (bảng hệ số đồng thời cho tủ phân phối,
  // IEC 61439 / Schneider Electrical Installation Guide): 1 → 1; 2–3 → 0,9; 4–5 → 0,8; 6–9 → 0,7; ≥ 10 → 0,6
  ksTuCon: { 1: 1, 2: 0.9, 4: 0.8, 6: 0.7, 10: 0.6 },
  kIn: 1.25,               // In ≥ kIn · Ib
  kChonLoc: 1.6,           // In tổng ≥ kChonLoc · In mạch ra lớn nhất (sơ bộ chọn lọc)
  lechPha: 15,             // % — độ lệch pha cho phép
  duPhongVo: 20,           // % — chỗ trống dự phòng trong vỏ tủ
  cbDuPhong: 2,            // số CB dự phòng tối thiểu (ghi chú nếu thiếu)
  ctNguong: 63,            // A — In tổng từ ngưỡng này cần đồng hồ đa năng + CT
  lCanhBao: 50,            // m — mạch dài hơn thì cảnh báo
  ibIn: 90,                // % — Ib/In vượt thì cảnh báo
  lMacDinh: 20,            // m — chiều dài dùng khi thiếu số liệu (có gắn cờ)
  ikMacDinh: 6,            // kA — Ik tại tủ khi thiếu số liệu (có gắn cờ)
  icu: { mach: [6, 10], tongMcb: [10], mccb: [15, 25, 36, 50] },  // kA — khả năng cắt chọn được
  inMaxMcb: 63,            // A — lớn hơn thì dùng MCCB
  soCucTong: { goc3P: "4P", con3P: "3P", tu1P: "2P" },
  spdTuGoc: true,          // SPD loại 2 tại tủ gốc (tủ tổng)
  denBaoPha: true,         // đèn báo pha cho tủ 3 pha

  // --- Ngắn mạch: phương pháp tổng trở (IEC 60909-0 rút gọn, Schneider Electrical Installation Guide chương G) ---
  noiDat: "TN-S",          // sơ đồ nối đất mặc định khi dự án không khai (TN-S | TN-C-S | TT)
  nganMach: {
    cMax: 1.05, cMin: 0.95,     // hệ số điện áp IEC 60909 cho lưới hạ áp (Ik max / Ik min)
    rho20: 0.01851,             // Ω·mm²/m — đồng ở 20 °C, dùng tính Ik max
    kRhoMin: 1.25,              // ρ khi tính Ik min = 1,25 · ρ20 (dây nóng lên lúc sự cố)
    sscTrungThe: 500,           // MVA — công suất ngắn mạch lưới trung thế trước máy biến áp
    ukMba: [[630, 4], [Infinity, 6]],   // % — Uk mặc định theo cỡ MBA (kVA): ≤ 630 → 4 %, lớn hơn → 6 %
    rtZt: 0.3,                  // Rt / Zt của MBA (thay cho tổn hao ngắn mạch khi chưa có catalogue)
    kVongNguon: 2,              // nguồn lấy từ Ik điểm đấu hạ áp: tổng trở vòng pha–PE phía nguồn = 2 × tổng trở pha
    imMccb: 10,                 // ngưỡng cắt từ MCCB nhiệt–từ = 10 × In (ghi đè từng thiết bị bằng "Im=…A")
    saiSoMccb: 0.2,             // sai số ngưỡng cắt từ MCCB ±20 %
    duongCong: { B: [3, 5], C: [5, 10], D: [10, 20] },   // ngưỡng cắt từ MCB/RCBO (× In) [dưới, trên] — IEC 60898-1
  },

  // --- Theo loại mạch (mục 6.3) ------------------------------------------
  // rcd: "30mA" bắt buộc · "khong" không cần · "tuy_chon" không đặt mặc định
  loaiMach: {
    "Chiếu sáng trong nhà": { cos: 0.9, inMin: 10, curve: "C", rcd: "khong", sMin: 1.5, chieuSang: true },
    "Chiếu sáng ngoài nhà": { cos: 0.9, inMin: 10, curve: "C", rcd: "30mA", sMin: 1.5, chieuSang: true },
    "Ổ cắm thông thường": { cos: 0.85, inMin: 16, curve: "C", rcd: "30mA", sMin: 2.5 },
    "Khu ướt (WC, bình nóng lạnh)": { cos: 1.0, inMin: 16, curve: "C", rcd: "30mA", sMin: 2.5 },
    "Bếp từ, lò nướng": { cos: 0.95, inMin: 16, curve: "C", rcd: "30mA", sMin: 2.5 },
    "Điều hòa": { cos: 0.9, inMin: 16, curve: "C", rcd: "tuy_chon", sMin: 2.5 },
    "Động cơ (bơm, quạt)": { cos: 0.8, inMin: 10, curve: "C", rcd: "khong", sMin: 2.5, dongCo: true },
    "Thiết bị điện nhẹ (rack, NVR, KNX)": { cos: 0.9, inMin: 10, curve: "C", rcd: "tuy_chon", sMin: 1.5 },
    "Dự phòng": { cos: 0.9, inMin: 16, curve: "C", rcd: "khong", sMin: 2.5, duPhong: true },
  },
  // Loại khu vực bắt buộc RCD 30 mA cho mọi mạch (IEC 60364-7-701 khu ướt; IEC 60364-4-41 ngoài nhà)
  khuVucRcd: ["Ướt (WC, tắm)", "Ngoài nhà"],

  dinhMuc: [6, 10, 16, 20, 25, 32, 40, 50, 63, 80, 100, 125, 160, 200, 250],
  tietDien: [1.5, 2.5, 4, 6, 10, 16, 25, 35, 50, 70, 95],

  // --- Dòng cho phép Iz (A), cáp đồng — IEC 60364-5-52 phụ lục B ------------
  // Iz[cách điện][phương pháp][số dây mang tải] theo thứ tự tietDien
  iz: {
    PVC: {
      A1: { 2: [14.5, 19.5, 26, 34, 46, 61, 80, 99, 119, 151, 182], 3: [13.5, 18, 24, 31, 42, 56, 73, 89, 108, 136, 164] },
      A2: { 2: [14, 18.5, 25, 32, 43, 57, 75, 92, 110, 139, 167], 3: [13, 17.5, 23, 29, 39, 52, 68, 83, 99, 125, 150] },
      B1: { 2: [17.5, 24, 32, 41, 57, 76, 101, 125, 151, 192, 232], 3: [15.5, 21, 28, 36, 50, 68, 89, 110, 134, 171, 207] },
      B2: { 2: [16.5, 23, 30, 38, 52, 69, 90, 111, 133, 168, 201], 3: [15, 20, 27, 34, 46, 62, 80, 99, 118, 149, 179] },
      C: { 2: [19.5, 27, 36, 46, 63, 85, 112, 138, 168, 213, 258], 3: [17.5, 24, 32, 41, 57, 76, 96, 119, 144, 184, 223] },
      E: { 2: [22, 30, 40, 51, 70, 94, 119, 148, 180, 232, 282], 3: [18.5, 25, 34, 43, 60, 80, 101, 126, 153, 196, 238] },
    },
    XLPE: {
      A1: { 2: [19, 26, 35, 45, 61, 81, 106, 131, 158, 200, 241], 3: [17, 23, 31, 40, 54, 73, 95, 117, 141, 179, 216] },
      A2: { 2: [18.5, 25, 33, 42, 57, 76, 99, 121, 145, 183, 220], 3: [16.5, 22, 30, 38, 51, 68, 89, 109, 130, 164, 197] },
      B1: { 2: [23, 31, 42, 54, 75, 100, 133, 164, 198, 253, 306], 3: [20, 28, 37, 48, 66, 88, 117, 144, 175, 222, 269] },
      B2: { 2: [22, 30, 40, 51, 69, 91, 119, 146, 175, 221, 265], 3: [19.5, 26, 35, 44, 60, 80, 105, 128, 154, 194, 233] },
      C: { 2: [24, 33, 45, 58, 80, 107, 138, 171, 209, 269, 328], 3: [22, 30, 40, 52, 71, 96, 119, 147, 179, 229, 278] },
      E: { 2: [26, 36, 49, 63, 86, 115, 149, 185, 225, 289, 352], 3: [23, 32, 42, 54, 75, 100, 127, 158, 192, 246, 298] },
    },
  },
  // Hệ số nhóm mạch k2 (mạch đi chung ống/bó) — IEC 60364-5-52 bảng B.52.17
  k2: { 1: 1, 2: 0.8, 3: 0.7, 4: 0.65, 5: 0.6, 6: 0.57, 7: 0.54, 8: 0.52, 9: 0.5, 12: 0.45, 16: 0.41, 20: 0.38 },

  // --- Số module (18 mm) của thiết bị và cỡ vỏ tủ --------------------------
  module: { "MCB-1P": 1, "MCB-2P": 2, "MCB-3P": 3, "MCB-4P": 4, "RCBO-1P+N": 2, "RCBO-3P+N": 4, "RCCB-2P": 2, "RCCB-4P": 4, MCCB: 0, SPD1: 2, SPD3: 4, DEN_BAO: 3 },
  voTu: [12, 18, 24, 36, 48, 54, 72],

  // --- Ống luồn dây PVC (đường kính ngoài → đường kính trong, mm) và đường kính cáp ---
  lapDay: 40,              // % — hệ số lấp đầy ống tối đa
  ongToiThieu: 20,         // mm — ống nhỏ nhất dùng cho mạch (bản vẽ mẫu E.601 dùng Ø20 cho mọi mạch nhánh)
  ong: [[16, 12.2], [20, 15.8], [25, 20.6], [32, 26.6], [40, 34.4], [50, 43.2]],
  dkDayDon: { 1.5: 3.0, 2.5: 3.6, 4: 4.2, 6: 4.8, 10: 6.1, 16: 7.2, 25: 8.9, 35: 10.1, 50: 11.8, 70: 13.7, 95: 15.9 },
  dkCap4Loi: { 1.5: 10.5, 2.5: 11.5, 4: 12.8, 6: 14.0, 10: 16.6, 16: 19.6, 25: 23.8, 35: 26.5, 50: 30.4, 70: 35.0, 95: 40.0 },
};

/** Gộp quy tắc mặc định với thông số ghi đè (từ sheet Du an / Quy tac). */
export function taoQuyTac(ghiDe = {}) {
  const loaiMach = { ...QUY_TAC.loaiMach };
  for (const [k, v] of Object.entries(ghiDe.loaiMach || {})) loaiMach[k] = { ...(QUY_TAC.loaiMach[k] || { cos: 0.9, inMin: 16, curve: "C", rcd: "khong", sMin: 2.5 }), ...v };
  return {
    ...QUY_TAC, ...ghiDe, loaiMach,
    k1: { ...QUY_TAC.k1, ...(ghiDe.k1 || {}) },
    ks: { ...QUY_TAC.ks, ...(ghiDe.ks || {}) },
    nganMach: { ...QUY_TAC.nganMach, ...(ghiDe.nganMach || {}) },
  };
}

/** Định mức tiêu chuẩn nhỏ nhất ≥ x. */
export function dinhMucToiThieu(x, rule = QUY_TAC) {
  return rule.dinhMuc.find((r) => r >= x - 1e-9) ?? null;
}

/** Hệ số nhóm mạch k2 cho n mạch đi chung. */
export function heSoNhom(n, rule = QUY_TAC) {
  if (!n || n <= 1) return 1;
  const keys = Object.keys(rule.k2).map(Number).sort((a, b) => a - b);
  let k = 1;
  for (const key of keys) if (n >= key) k = rule.k2[key];
  return k;
}

/** Hệ số đồng thời giữa n tủ con. */
export function heSoTuCon(n, rule = QUY_TAC) {
  let k = 1;
  for (const key of Object.keys(rule.ksTuCon).map(Number).sort((a, b) => a - b)) if (n >= key) k = rule.ksTuCon[key];
  return k;
}

/** Tiết diện PE theo IEC 60364-5-54 (cùng vật liệu với dây pha). */
export function tietDienPE(s, rule = QUY_TAC) {
  if (s <= 16) return s;
  if (s <= 35) return 16;
  return rule.tietDien.find((t) => t >= s / 2) ?? s / 2;
}
