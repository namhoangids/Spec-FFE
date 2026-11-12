// Danh mục bộ quy tắc — MỘT nguồn cho sheet "Quy tac" (Excel nhập liệu, mau/bo-quy-tac.xlsx) và cho bộ đọc
// engine/doc-excel.mjs. Mỗi thông số trong engine/quy-tac.mjs có một dòng ở đây (test kiểm phủ đủ).
//
//   THAM_SO  — thông số đơn (A1 chung, A2 ngắn mạch, A3 điện nhẹ, A4 KNX) và dãy cỡ chuẩn (C1)
//   BANG     — bảng tra (C2): mỗi bảng một khối dòng trong sheet
//   TRONG_CODE — quy tắc còn nằm trong code, chưa tách thành thông số (D) — chỉ để kỹ sư biết và ghi ý kiến
//
// nguon: mức tin cậy của giá trị đề xuất, để người duyệt biết chỗ nào cần soát trước.
// uuTien: có trong danh sách "nên soát trước" ở sheet Huong dan của bo-quy-tac.xlsx.

export const NGUON = {
  TC: "Tiêu chuẩn",
  TL: "Thông lệ / catalogue điển hình",
  GD: "Em giả định — cần xem kỹ",
};

export const NHOM = {
  A1: "A1. Thông số chung — chọn CB, cáp, ống, vỏ tủ",
  A2: "A2. Ngắn mạch, tự cắt nguồn, chọn lọc",
  A3: "A3. Điện nhẹ — mạng, camera, rack, UPS, chuông, ACS, âm thanh",
  A4: "A4. KNX",
  C1: "C1. Dãy cỡ chuẩn (ghi cách nhau bằng dấu ;)",
};

const t = (nhom, ma, ten, khoa, donVi, canCu, nguon, o = {}) => ({ nhom, ma, ten, khoa, donVi, canCu, nguon, ...o });
const mOhm = { ra: (v) => +(v * 1000).toFixed(6), vao: (v) => v / 1000 };

/** Thông số đơn. kieu: "so" (mặc định) | "chu" | "co" (Có/Không) | "ds" (dãy số) | "dsChu" (dãy chữ) */
export const THAM_SO = [
  // --- A1 -------------------------------------------------------------------------------------------
  t("A1", "UF", "Điện áp pha Uf", "uf", "V", "Lưới hạ áp Việt Nam (có thể chọn 230)", "TC"),
  t("A1", "UD", "Điện áp dây Ud", "ud", "V", "Có thể chọn 400", "TC"),
  t("A1", "RHO", "Điện trở suất đồng ρ (ở nhiệt độ làm việc)", "rho", "Ω·mm²/m", "Dùng tính sụt áp", "TL"),
  t("A1", "LAMBDA", "Điện kháng đơn vị dây λ", "lambda", "mΩ/m", "Dùng tính sụt áp và tổng trở ngắn mạch", "TL", mOhm),
  t("A1", "K1_PVC", "Hệ số nhiệt độ k1 — cách điện PVC", "k1.PVC", "", "IEC 60364-5-52, bảng B.52.14, 35 °C", "TC"),
  t("A1", "K1_XLPE", "Hệ số nhiệt độ k1 — cách điện XLPE", "k1.XLPE", "", "IEC 60364-5-52, bảng B.52.14, 35 °C", "TC"),
  t("A1", "DU_MAX", "Sụt áp cộng dồn tối đa (từ nguồn)", "duMax", "%", "IEC 60364-5-52 phụ lục G (khuyến nghị); dự án ghi đè ở sheet Du an", "TL"),
  t("A1", "DU_CS", "Sụt áp tối đa — mạch chiếu sáng", "duChieuSang", "%", "IEC 60364-5-52 phụ lục G", "TL"),
  t("A1", "DU_TU", "Sụt áp cộng dồn tối đa tới thanh cái mỗi tủ", "duThanhCai", "%", "Dùng chọn cáp cấp tủ, chừa phần cho mạch nhánh", "GD", { uuTien: true }),
  t("A1", "KS_NHA", "Kđt mạch cuối — hồ sơ nhà ở / biệt thự", "ks.Nhà ở / biệt thự", "", "Hoặc dùng bảng Ks theo số mạch (mục 6.3 phương án)", "TL", { uuTien: true }),
  t("A1", "KS_CANHO", "Kđt mạch cuối — hồ sơ căn hộ", "ks.Căn hộ", "", "Kỹ sư chốt", "TL"),
  t("A1", "K_IN", "Hệ số chọn In (In ≥ k·Ib)", "kIn", "", "Thông lệ thiết kế", "TL"),
  t("A1", "K_CHONLOC", "Tỷ số chọn lọc sơ bộ (In tổng ≥ k·In mạch ra lớn nhất)", "kChonLoc", "", "Sơ bộ; kiểm lại theo bảng phối hợp Schneider", "TL", { uuTien: true }),
  t("A1", "IN_MCB_MAX", "In lớn nhất dùng MCB (lớn hơn dùng MCCB)", "inMaxMcb", "A", "Dải MCB Schneider đến 63 A", "TL"),
  t("A1", "LECH_PHA", "Độ lệch pha tối đa (Smax − Smin)/Smax", "lechPha", "%", "Vượt thì cảnh báo", "TL"),
  t("A1", "DP_VO", "Chỗ trống dự phòng trong vỏ tủ", "duPhongVo", "%", "Tính trên tổng module", "TL"),
  t("A1", "DP_CB", "Số CB dự phòng tối thiểu mỗi tủ", "cbDuPhong", "cái", "Thiếu thì ghi chú", "TL"),
  t("A1", "CT_NGUONG", "Ngưỡng In tổng dùng đồng hồ đa năng + CT", "ctNguong", "A", "Đề xuất nội bộ", "GD"),
  t("A1", "IK_MD", "Ik mặc định khi chưa có số liệu", "ikMacDinh", "kA", "Giá trị gắn cờ, phải xác nhận với điện lực / tòa nhà", "GD", { uuTien: true }),
  t("A1", "L_MD", "Chiều dài mạch dùng khi thiếu số liệu", "lMacDinh", "m", "Gắn cờ cảnh báo", "GD"),
  t("A1", "L_CANHBAO", "Chiều dài mạch cần kiểm tra lại", "lCanhBao", "m", "Cảnh báo", "GD"),
  t("A1", "IB_IN", "Ngưỡng cảnh báo Ib/In", "ibIn", "%", "Cảnh báo", "GD"),
  t("A1", "LAP_DAY", "Hệ số lấp đầy ống tối đa", "lapDay", "%", "Thông lệ thi công (NEC chương 9: ≤ 40 % khi ≥ 3 dây)", "TL"),
  t("A1", "ONG_MIN", "Đường kính ống nhỏ nhất", "ongToiThieu", "mm", "Bản vẽ mẫu E.601 dùng Ø20 cho mạch nhánh", "TL"),
  t("A1", "SO_CUC_GOC3P", "Số cực CB tổng — tủ gốc 3 pha", "soCucTong.goc3P", "", "Tủ gốc cắt cả N", "TL", { kieu: "chu" }),
  t("A1", "SO_CUC_CON3P", "Số cực CB tổng — tủ con 3 pha", "soCucTong.con3P", "", "", "TL", { kieu: "chu" }),
  t("A1", "SO_CUC_TU1P", "Số cực CB tổng — tủ 1 pha", "soCucTong.tu1P", "", "", "TL", { kieu: "chu" }),
  t("A1", "SPD_TU_GOC", "Đặt SPD loại 2 tại tủ gốc", "spdTuGoc", "Có/Không", "IEC 61643-11, IEC 60364-4-44", "TL", { kieu: "co" }),
  t("A1", "DEN_BAO_PHA", "Đèn báo pha cho tủ 3 pha", "denBaoPha", "Có/Không", "", "TL", { kieu: "co" }),
  t("A1", "KV_RCD", "Loại khu vực bắt buộc RCD 30 mA cho mọi mạch", "khuVucRcd", "", "IEC 60364-7-701 (khu ướt), IEC 60364-4-41 (ngoài nhà)", "TC", { kieu: "dsChu" }),

  // --- A2 -------------------------------------------------------------------------------------------
  t("A2", "NOI_DAT_MD", "Sơ đồ nối đất mặc định (dự án không khai)", "noiDat", "", "TN-S | TN-C-S | TT", "TL", { kieu: "chu" }),
  t("A2", "NM_CMAX", "Hệ số điện áp c max (tính Ik max)", "nganMach.cMax", "", "IEC 60909-0 bảng 1, lưới hạ áp", "TC"),
  t("A2", "NM_CMIN", "Hệ số điện áp c min (tính Ik min)", "nganMach.cMin", "", "IEC 60909-0 bảng 1", "TC"),
  t("A2", "NM_RHO20", "Điện trở suất đồng ở 20 °C (Ik max)", "nganMach.rho20", "Ω·mm²/m", "IEC 60909-0", "TC"),
  t("A2", "NM_K_RHO_MIN", "Hệ số ρ khi tính Ik min (ρ = k · ρ20)", "nganMach.kRhoMin", "", "Schneider EIG chương G (dây nóng lên khi sự cố)", "TL"),
  t("A2", "NM_SSC_TT", "Công suất ngắn mạch lưới trung thế trước MBA", "nganMach.sscTrungThe", "MVA", "Chỉ dùng khi dự án khai MBA riêng", "GD"),
  t("A2", "NM_RT_ZT", "Tỷ số Rt / Zt của MBA (khi chưa có tổn hao ngắn mạch)", "nganMach.rtZt", "", "Ước lượng; thay bằng số liệu catalogue MBA", "GD", { uuTien: true }),
  t("A2", "NM_K_VONG", "Tổng trở vòng pha–PE phía nguồn = k × tổng trở pha (nguồn lấy từ Ik điểm đấu)", "nganMach.kVongNguon", "", "Ước lượng khi chỉ biết Ik điểm đấu", "GD", { uuTien: true }),
  t("A2", "IM_MCCB", "Ngưỡng cắt từ MCCB (Im = k·In)", "nganMach.imMccb", "×In", "MCCB nhiệt–từ; MCCB chỉnh định thì ghi đè thiết bị \"Im=…A\"", "TL", { uuTien: true }),
  t("A2", "NM_SAI_SO_MCCB", "Sai số ngưỡng cắt từ MCCB", "nganMach.saiSoMccb", "", "IEC 60947-2 (±20 %)", "TC", { ra: (v) => +(v * 100).toFixed(6), vao: (v) => v / 100, donVi: "%" }),

  // --- A3 -------------------------------------------------------------------------------------------
  t("A3", "ELV_DP_CONG", "Dự phòng cổng switch, kênh NVR", "dienNhe.duPhongCong", "%", "", "TL"),
  t("A3", "ELV_POE_AP", "Công suất PoE mỗi AP Wi-Fi", "dienNhe.poeAp", "W", "Thường 15–25 W, theo thiết bị chọn", "TL", { uuTien: true }),
  t("A3", "ELV_POE_CAM", "Công suất PoE mỗi camera", "dienNhe.poeCam", "W", "Thường 5–13 W, theo thiết bị chọn", "TL", { uuTien: true }),
  t("A3", "ELV_POE_CHUONG_NGOAI", "Công suất PoE nút gọi chuông cửa (ngoài trời)", "dienNhe.poeChuongNgoai", "W", "Theo thiết bị chọn", "GD"),
  t("A3", "ELV_POE_CHUONG_TRONG", "Công suất PoE màn hình chuông cửa (trong nhà)", "dienNhe.poeChuongTrong", "W", "Theo thiết bị chọn", "GD"),
  t("A3", "ELV_POE_K", "Hệ số dự trữ ngân sách PoE", "dienNhe.kPoe", "", "", "TL"),
  t("A3", "ELV_CAT6", "Chiều dài tối đa cáp Cat6 (link cố định)", "dienNhe.cat6Max", "m", "ANSI/TIA-568", "TC"),
  t("A3", "ELV_L_MD", "Chiều dài cáp ngang khi thiếu số liệu", "dienNhe.lMacDinh", "m", "Gắn cờ", "GD"),
  t("A3", "ELV_BITRATE", "CCTV — bitrate mỗi camera", "dienNhe.bitrate", "Mbps", "4 MP, H.265", "TL"),
  t("A3", "ELV_NGAY_LUU", "CCTV — số ngày lưu", "dienNhe.ngayLuu", "ngày", "Theo yêu cầu chủ đầu tư", "TL"),
  t("A3", "ELV_HDD_TB", "CCTV — dung lượng mỗi ổ cứng NVR", "dienNhe.hddTB", "TB", "", "TL"),
  t("A3", "ELV_PP_CONG", "Số cổng mỗi patch panel", "dienNhe.ppCong", "cổng", "", "TL"),
  t("A3", "ELV_RACK_K", "Tủ rack — hệ số dự phòng U", "dienNhe.kRack", "", "", "TL"),
  t("A3", "ELV_RACK_TREO", "Tủ rack treo tường đến", "dienNhe.rackTreoMax", "U", "Lớn hơn thì tủ đứng", "TL"),
  t("A3", "ELV_UPS_K", "UPS — hệ số dự phòng", "dienNhe.kUps", "", "VA ≥ ΣW / PF · k; cũng là hệ số công suất mạch nguồn rack", "TL"),
  t("A3", "ELV_UPS_PF", "UPS — hệ số công suất", "dienNhe.pfUps", "", "", "TL"),
  t("A3", "ELV_W_ROUTER", "Công suất router / tường lửa", "dienNhe.congSuat.router", "W", "", "GD"),
  t("A3", "ELV_W_MODEM", "Công suất modem ISP", "dienNhe.congSuat.modem", "W", "", "GD"),
  t("A3", "ELV_W_NVR", "Công suất đầu ghi NVR (chưa gồm ổ cứng)", "dienNhe.congSuat.nvr", "W", "", "GD"),
  t("A3", "ELV_W_HDD", "Công suất mỗi ổ cứng NVR", "dienNhe.congSuat.hdd", "W", "", "GD"),
  t("A3", "ELV_ACS_W", "Công suất mỗi bộ điều khiển ACS + nguồn 12 V ắc quy", "dienNhe.acsW", "W", "Tính vào tải UPS", "GD", { uuTien: true }),
  t("A3", "ELV_LOA_W", "Công suất tap mỗi loa khi chưa có số liệu", "dienNhe.loaWMacDinh", "W", "Loa trần 100 V thường 3–6 W", "GD"),
  t("A3", "ELV_AMPLI_K", "Âm thanh — hệ số công suất ampli", "dienNhe.kAmpli", "", "Ampli ≥ k · Σ công suất tap loa", "TL"),
  t("A3", "ELV_AMPLI_VUNG", "Số vùng tối đa dùng 1 ampli mixer chọn vùng", "dienNhe.ampliVungMax", "vùng", "", "TL"),
  t("A3", "ELV_AMPLI_TIEU_THU", "Công suất điện ampli = k × công suất ra", "dienNhe.kTieuThuAmpli", "", "Dùng tính mạch nguồn ampli (không qua UPS)", "GD", { uuTien: true }),
  t("A3", "ELV_NGUON_NHAC_W", "Công suất nguồn nhạc (streamer / tuner)", "dienNhe.nguonNhacW", "W", "", "GD"),

  // --- A4 -------------------------------------------------------------------------------------------
  t("A4", "KNX_MAX", "Số thiết bị tối đa mỗi line", "dienNhe.knx.thietBiLine", "thiết bị", "KNX (64 thiết bị / đoạn line)", "TC"),
  t("A4", "KNX_MA", "Dòng bus mỗi thiết bị", "dienNhe.knx.maThietBi", "mA", "Thiết bị KNX thường 5–10 mA", "GD", { uuTien: true }),
  t("A4", "KNX_K_NGUON", "Nguồn bus ≥ k × Σ dòng bus", "dienNhe.knx.kNguon", "", "", "GD"),
  t("A4", "KNX_DP_KENH", "Dự phòng kênh actuator", "dienNhe.knx.duPhongKenh", "%", "", "TL"),
  t("A4", "KNX_BUS_MAX", "Chiều dài dây bus tối đa mỗi line", "dienNhe.knx.busMax", "m", "KNX", "TC"),
  t("A4", "KNX_IP_MODULE", "Số module giao diện IP / IP router", "dienNhe.knx.ip", "module", "Theo catalogue", "TL"),

  // --- C1: dãy cỡ chuẩn -----------------------------------------------------------------------------
  t("C1", "DS_DINH_MUC", "Dòng định mức CB chuẩn", "dinhMuc", "A", "IEC 60898-1 / 60947-2", "TC", { kieu: "ds" }),
  t("C1", "DS_TIET_DIEN", "Tiết diện dây đồng chuẩn (thứ tự cột bảng Iz)", "tietDien", "mm²", "IEC 60228", "TC", { kieu: "ds" }),
  t("C1", "DS_ICU_MACH", "Icu chọn được — MCB/RCBO mạch nhánh", "icu.mach", "kA", "Dải Schneider", "TL", { kieu: "ds" }),
  t("C1", "DS_ICU_TONG", "Icu chọn được — MCB tổng", "icu.tongMcb", "kA", "", "TL", { kieu: "ds" }),
  t("C1", "DS_ICU_MCCB", "Icu chọn được — MCCB", "icu.mccb", "kA", "", "TL", { kieu: "ds" }),
  t("C1", "DS_VO_TU", "Cỡ vỏ tủ (số module 18 mm)", "voTu", "module", "Dải vỏ tủ nhựa / sắt thông dụng", "TL", { kieu: "ds" }),
  t("C1", "DS_RACK_U", "Cỡ tủ rack", "dienNhe.rackU", "U", "", "TL", { kieu: "ds" }),
  t("C1", "DS_UPS_VA", "Cỡ UPS", "dienNhe.upsVA", "VA", "", "TL", { kieu: "ds" }),
  t("C1", "DS_AMPLI_W", "Cỡ ampli 100 V", "dienNhe.ampliW", "W", "", "TL", { kieu: "ds" }),
  t("C1", "DS_ACS_CUA", "Cỡ bộ điều khiển ACS", "dienNhe.acsBoDieuKhien", "cửa", "", "TL", { kieu: "ds" }),
];

// --- C2: bảng tra -------------------------------------------------------------------------------------
// Mỗi bảng: cot (tiêu đề cột giá trị), dong(rule) → [[nhãn, ...giá trị]], doc(dòng[]) → giá trị gán vào khoa.
// Dòng đọc lại có dạng { nhan, gt: number[] } (ô trống = null).
const bMang = (ma, ten, khoa, cot, canCu, nguon, o = {}) => ({
  ma, ten, khoa, cot, nhanCot: "", canCu, nguon, ...o,
  dong: (rule) => layKhoa(rule, khoa).map((r) => ["", ...r.map((x) => (x === Infinity ? null : x))]),
  doc: (ds) => ds.map((d) => d.gt.map((x, i) => (x == null && o.trongLa?.[i] != null ? o.trongLa[i] : x))).filter((r) => r.some((x) => x != null)),
});
const bDoiTuong = (ma, ten, khoa, nhanCot, cot, canCu, nguon, o = {}) => ({
  ma, ten, khoa, cot, nhanCot, canCu, nguon, ...o,
  dong: (rule) => Object.entries(layKhoa(rule, khoa))
    .map(([k, v]) => [o.khoaSo ? Number(k) : k, ...(Array.isArray(v) ? v : [v])])
    .sort((x, y) => (o.khoaSo ? x[0] - y[0] : 0)),
  doc: (ds) => Object.fromEntries(ds.filter((d) => d.nhan != null && d.nhan !== "")
    .map((d) => [o.khoaSo ? Number(String(d.nhan).replace(",", ".")) : String(d.nhan).trim(), cot.length > 1 ? d.gt.slice(0, cot.length) : d.gt[0]])),
});
const CACH_DIEN = ["PVC", "XLPE"], PHUONG_PHAP = ["A1", "A2", "B1", "B2", "C", "E"];

export const BANG = [
  bDoiTuong("T_DUONG_CONG", "Ngưỡng cắt từ MCB / RCBO theo đường cong", "nganMach.duongCong", "Đường cong",
    ["Ngưỡng dưới (× In)", "Ngưỡng trên (× In)"], "IEC 60898-1", "TC"),
  bMang("T_UK_MBA", "Uk mặc định của MBA theo công suất", "nganMach.ukMba", ["S MBA đến (kVA) — trống = lớn hơn", "Uk (%)"],
    "IEC 60076-5 (giá trị điển hình)", "TL", { trongLa: [Infinity, null] }),
  bDoiTuong("T_KS_TU_CON", "Hệ số đồng thời giữa các tủ con", "ksTuCon", "Từ số tủ con", ["Ks"],
    "IEC 61439 / Schneider EIG (bảng hệ số đồng thời tủ phân phối)", "TL", { khoaSo: true, uuTien: true }),
  bDoiTuong("T_K2", "Hệ số nhóm mạch k2 (nhiều mạch chung ống / bó)", "k2", "Từ số mạch", ["k2"], "IEC 60364-5-52 bảng B.52.17", "TC", { khoaSo: true }),
  {
    ma: "T_IZ", ten: "Dòng cho phép Iz (A), cáp đồng — theo cách điện, phương pháp lắp đặt, số dây mang tải", khoa: "iz",
    nhanCot: "Cách điện · phương pháp · số dây", canCu: "IEC 60364-5-52 phụ lục B (bảng B.52.2–B.52.5), 30 °C", nguon: "TC",
    cot: (rule) => rule.tietDien.map((s) => `${String(s).replace(".", ",")} mm²`),
    dong: (rule) => CACH_DIEN.flatMap((c) => PHUONG_PHAP.flatMap((p) => [2, 3].map((n) => [`${c} · ${p} · ${n}`, ...rule.iz[c][p][n]]))),
    doc: (ds) => {
      const iz = {};
      for (const d of ds) {
        const m = String(d.nhan ?? "").match(/^\s*(PVC|XLPE)\W+([A-Z]\d?)\W+(\d)/i);
        if (!m) continue;
        ((iz[m[1].toUpperCase()] ||= {})[m[2].toUpperCase()] ||= {})[m[3]] = d.gt.filter((x) => x != null);
      }
      return iz;
    },
  },
  bDoiTuong("T_MODULE", "Số module (18 mm) của thiết bị trong tủ", "module", "Thiết bị", ["Số module"], "Catalogue Schneider (Acti9)", "TL"),
  bMang("T_ONG", "Ống luồn dây PVC: đường kính ngoài → trong", "ong", ["Ø ngoài (mm)", "Ø trong (mm)"], "Catalogue ống PVC (Sino / Vega)", "TL"),
  bDoiTuong("T_DK_DAY", "Đường kính ngoài dây đơn Cu/PVC", "dkDayDon", "Tiết diện (mm²)", ["Ø ngoài (mm)"], "Catalogue Cadivi / LS Vina", "TL", { khoaSo: true }),
  bDoiTuong("T_DK_CAP", "Đường kính ngoài cáp 4 lõi Cu/XLPE/PVC", "dkCap4Loi", "Tiết diện (mm²)", ["Ø ngoài (mm)"], "Catalogue Cadivi / LS Vina", "TL", { khoaSo: true }),
  bMang("T_SWITCH", "Switch thường", "dienNhe.switchThuong", ["Số cổng", "Công suất (W)"], "Catalogue điển hình", "TL"),
  bMang("T_SWITCH_POE", "Switch PoE", "dienNhe.switchPoe", ["Số cổng", "Ngân sách PoE (W)", "Công suất tự dùng (W)"], "Catalogue điển hình", "TL", { uuTien: true }),
  bMang("T_NVR", "Đầu ghi NVR", "dienNhe.nvr", ["Số kênh", "Số khay ổ cứng", "Số U"], "Catalogue điển hình", "TL"),
  bMang("T_KNX_BAT_TAT", "Actuator KNX bật/tắt", "dienNhe.knx.batTat", ["Số kênh", "Số module"], "Catalogue điển hình", "TL"),
  bMang("T_KNX_DIMMER", "Actuator KNX dimmer", "dienNhe.knx.dimmer", ["Số kênh", "Số module"], "Catalogue điển hình", "TL"),
  bMang("T_KNX_REM", "Actuator KNX rèm", "dienNhe.knx.rem", ["Số kênh", "Số module"], "Catalogue điển hình", "TL"),
  bMang("T_KNX_NGUON", "Nguồn bus KNX", "dienNhe.knx.nguon", ["Dòng (mA)", "Số module"], "Catalogue điển hình", "TL"),
];

// --- D: quy tắc còn nằm trong code -----------------------------------------------------------------------
const d = (ma, ten, giaTri, canCu, nguon) => ({ ma, ten, giaTri, canCu, nguon });
export const TRONG_CODE = [
  d("D01", "Tiết diện dây PE", "S ≤ 16 mm² → bằng dây pha; 16 < S ≤ 35 → 16 mm²; S > 35 → S/2 (lấy cỡ chuẩn ≥)", "IEC 60364-5-54 bảng 54.2", "TC"),
  d("D02", "Kiểu dây mặc định", "Mạch nhánh: dây đơn Cu/PVC luồn ống, phương pháp B1. Cáp cấp tủ: Cu/XLPE/PVC nhiều lõi, B1 nếu tủ không khai phương pháp", "IEC 60364-5-52", "TL"),
  d("D03", "Số dây mang tải khi tra Iz", "1 pha: 2 dây; 3 pha: 3 dây (N không tính)", "IEC 60364-5-52", "TC"),
  d("D04", "Dòng làm việc", "Ib = P / (Uf·cosφ) (1 pha); Ib = P / (√3·Ud·cosφ) (3 pha). Lộ cấp tủ con dùng Ptt và cosφ trung bình của tủ con (0,9 nếu chưa có)", "", "TC"),
  d("D05", "Hệ số đồng thời tủ con", "Ptt tủ = Σ P mạch riêng × Kđt (theo loại công trình) + Σ Ptt tủ con × Ks (bảng T_KS_TU_CON, theo số tủ con). Tủ có nhập Kđt thì dùng số đó cho cả hai", "", "TL"),
  d("D06", "Tổng trở nguồn từ Ik điểm đấu", "Z = c·Uf / Ik; X = Z/√1,01; R = 0,1·X (tỷ số R/X nguồn 0,1)", "Ước lượng IEC 60909-0", "GD"),
  d("D07", "Kiểm tự cắt nguồn (sơ đồ TN)", "Ik1 min cuối mạch ≥ ngưỡng cắt từ cận trên: MCB/RCBO theo bảng T_DUONG_CONG; MCCB Im × (1 + sai số). Không đạt mà có RCD 30 mA thì RCD đảm nhận", "IEC 60364-4-41", "TC"),
  d("D08", "Chọn lọc vùng ngắn mạch", "Ik3 max tại tủ dưới < ngưỡng cắt từ cận dưới của CB trên → toàn phần; ngược lại một phần, tới Is ≈ ngưỡng đó", "Chọn lọc theo dòng; giới hạn thực tra bảng phối hợp hãng", "TL"),
  d("D09", "BOQ — hao hụt", "Dây, cáp, ống cộng 5 % (đổi bằng --hao-hut)", "", "TL"),
  d("D10", "BOQ điện nhẹ — cáp mạng", "Cat6 = Σ chiều dài link; dây nhảy 2 sợi / link; trục Cat6 2 sợi; trục quang single-mode 4 lõi + 2 module SFP", "", "GD"),
  d("D11", "BOQ ACS — cáp mỗi cửa", "Cáp 6 lõi có lưới (đầu đọc) L; cáp nguồn khóa 2×1,0 mm² L; cáp 2 lõi (nút exit, công tắc cửa) 2L", "", "GD"),
  d("D12", "BOQ âm thanh — cáp loa", "Cáp chống cháy 2×1,5 mm² mỗi phòng = L + 4 m × số loa", "", "GD"),
  d("D13", "Số U thiết bị trong rack", "Patch panel 1U + thanh quản lý cáp 1U mỗi PP; switch 1U; router 1U; kệ modem 1U; nguồn nhạc 1U; ampli 2U; PDU 1U; UPS 2U; NVR theo bảng T_NVR; bộ ĐK ACS 0U (lắp cạnh tủ)", "Catalogue điển hình", "TL"),
  d("D14", "Tải UPS", "Gồm switch, router, modem, NVR + ổ cứng, tải PoE, bộ ĐK ACS. Ampli không qua UPS (mạch nguồn riêng)", "", "GD"),
  d("D15", "Switch lõi", "Đặt ở rack trung tâm khi cả dự án có ≥ 2 switch truy cập hoặc ≥ 2 rack; số cổng = (số switch + NVR + 1 cổng lên router) × (1 + dự phòng cổng)", "", "GD"),
  d("D16", "NVR", "Số kênh ≥ số camera × (1 + dự phòng cổng); dung lượng = bitrate × 86 400 × ngày / 8; đặt ở rack trung tâm", "", "TL"),
  d("D17", "Trục giữa các rack", "L ≤ chiều dài Cat6 tối đa → Cat6; dài hơn → cáp quang + SFP", "ANSI/TIA-568", "TC"),
  d("D18", "Số line KNX", "Mỗi line có 1 giao diện / IP router (tính là 1 thiết bị). Thiết bị mỗi line ≤ min(64, ⌊nguồn lớn nhất / (mA × k nguồn)⌋) = 53 với số mặc định; dây bus dài hơn giới hạn thì chia thêm line", "", "GD"),
  d("D19", "Kênh KNX theo mạch", "Mạch Bật/tắt, Dimmer: 1 kênh; Rèm: số kênh = số lượng của mạch. Actuator đặt trong tủ điện của mạch, module cộng vào vỏ tủ", "", "GD"),
  d("D20", "Chiều dài dây bus KNX (ước tính)", "Σ chiều dài cáp các phòng có thiết bị KNX + Σ chiều dài cáp cấp các tủ có actuator (trừ tủ gốc)", "", "GD"),
  d("D21", "Vùng âm thanh", "Phòng không khai vùng thì mỗi phòng một vùng; loa không khai công suất thì dùng công suất tap mặc định", "", "TL"),
];

// --- Tiện ích ---------------------------------------------------------------------------------------
export function layKhoa(o, khoa) {
  return khoa.split(".").reduce((x, k) => (x == null ? undefined : x[k]), o);
}
export function datKhoa(o, khoa, v) {
  const ds = khoa.split(".");
  let x = o;
  for (const k of ds.slice(0, -1)) x = x[k] && typeof x[k] === "object" ? x[k] : (x[k] = {});
  x[ds.at(-1)] = v;
  return o;
}

/** Giá trị hiển thị trong ô Excel */
export function giaTriHienThi(ts, rule) {
  const v = layKhoa(rule, ts.khoa);
  if (v == null) return null;
  if (ts.kieu === "co") return v ? "Có" : "Không";
  if (ts.kieu === "ds" || ts.kieu === "dsChu") return v.map((x) => (typeof x === "number" ? String(x).replace(".", ",") : x)).join("; ");
  return ts.ra ? ts.ra(v) : v;
}

/** Đọc giá trị ô Excel về giá trị quy tắc; null nếu ô trống / không đọc được. */
export function docGiaTri(ts, o, docSo) {
  if (o == null || o === "") return null;
  if (ts.kieu === "chu") return String(o).trim() || null;
  if (ts.kieu === "co") return /^(có|co|x|✔|✓|1|true|yes)$/i.test(String(o).trim());
  if (ts.kieu === "dsChu") return String(o).split(/[;\n]/).map((s) => s.trim()).filter(Boolean);
  if (ts.kieu === "ds") {
    if (typeof o === "number") return [o];
    const ds = String(o).split(/[;\n]/).map((s) => docSo(s)).filter((x) => x != null);
    return ds.length ? ds : null;
  }
  const v = docSo(o);
  if (v == null) return null;
  return ts.vao ? ts.vao(v) : v;
}

export const THEO_MA = new Map(THAM_SO.map((x) => [x.ma, x]));
export const BANG_THEO_MA = new Map(BANG.map((x) => [x.ma, x]));
