// Thư viện phụ tải điển hình cho bộ gợi ý đầu vào (goi-y-dau-vao.mjs).
// Đây là số GIẢ ĐỊNH để lập bản nháp — mọi giá trị lấy từ đây đều được ghi "giả định" trên kết quả.
// Kỹ sư sửa trực tiếp các bảng dưới đây; không cần sửa code.

/**
 * Loại phòng → thông số mặc định.
 *  dienTich  m² dùng khi không biết diện tích
 *  den       W/m² chiếu sáng (LED)
 *  oCam      số ổ cắm đôi (mỗi ổ tính PO_O_CAM W)
 *  dieuHoa   có điều hòa không
 *  khuVuc    loại khu vực của mạch trong phòng (theo engine/quy-tac.mjs)
 *  nhom      cách gom mạch: "kho" (khô) | "uot" (WC) | "ngoai" (ngoài nhà)
 *  tuKhoa    các cách gọi khác để nhận ra loại phòng từ mô tả
 */
export const LOAI_PHONG = {
  "phòng khách": { dienTich: 25, den: 10, oCam: 6, dieuHoa: true, nhom: "kho", tuKhoa: ["khách", "living", "sinh hoạt chung", "shc"] },
  "phòng ngủ": { dienTich: 16, den: 8, oCam: 5, dieuHoa: true, nhom: "kho", tuKhoa: ["ngủ", "bed", "master"] },
  "phòng ăn": { dienTich: 15, den: 8, oCam: 3, dieuHoa: true, nhom: "kho", tuKhoa: ["ăn", "dining"] },
  "bếp": { dienTich: 15, den: 10, oCam: 0, dieuHoa: false, nhom: "kho", bep: true, tuKhoa: ["bếp", "kitchen", "pantry"] },
  "wc": { dienTich: 5, den: 10, oCam: 1, dieuHoa: false, nhom: "uot", tam: true, tuKhoa: ["wc", "vệ sinh", "tắm", "toilet", "bath"] },
  "sảnh, hành lang": { dienTich: 12, den: 5, oCam: 1, dieuHoa: false, nhom: "kho", tuKhoa: ["sảnh", "hành lang", "cầu thang", "lobby", "hall", "thang bộ"] },
  "phòng làm việc": { dienTich: 12, den: 10, oCam: 6, dieuHoa: true, nhom: "kho", tuKhoa: ["làm việc", "đọc sách", "office", "study"] },
  "phòng thờ": { dienTich: 10, den: 6, oCam: 2, dieuHoa: false, nhom: "kho", tuKhoa: ["thờ"] },
  "phòng giải trí": { dienTich: 20, den: 10, oCam: 6, dieuHoa: true, nhom: "kho", tuKhoa: ["giải trí", "karaoke", "gym", "tập", "chiếu phim", "cinema"] },
  "giặt phơi": { dienTich: 6, den: 6, oCam: 1, dieuHoa: false, nhom: "kho", mayGiat: true, tuKhoa: ["giặt", "phơi", "laundry"] },
  "kho": { dienTich: 6, den: 5, oCam: 1, dieuHoa: false, nhom: "kho", tuKhoa: ["kho", "store"] },
  "gara": { dienTich: 30, den: 6, oCam: 2, dieuHoa: false, nhom: "kho", tuKhoa: ["gara", "garage", "để xe"] },
  "phòng kỹ thuật": { dienTich: 6, den: 6, oCam: 2, dieuHoa: false, nhom: "kho", tuKhoa: ["kỹ thuật", "technical", "điện nhẹ", "rack"] },
  "ban công": { dienTich: 6, den: 6, oCam: 1, dieuHoa: false, nhom: "ngoai", tuKhoa: ["ban công", "lô gia", "logia", "loggia"] },
  "ngoài nhà": { dienTich: 40, den: 6, oCam: 2, dieuHoa: false, nhom: "ngoai", tuKhoa: ["sân", "vườn", "ngoài", "ban công", "sân thượng", "terrace", "cổng"] },
};

export const PO_O_CAM = 200;          // W mỗi ổ cắm đôi (đã tính hệ số sử dụng)

// Gom mạch
export const GOM = {
  denMax: 800,        // W tối đa mỗi mạch chiếu sáng khô
  denPhongMax: 4,     // số phòng tối đa mỗi mạch chiếu sáng
  oCamMax: 2000,      // W tối đa mỗi mạch ổ cắm
  oCamPhongMax: 3,    // số phòng tối đa mỗi mạch ổ cắm
  tenMax: 40,         // ký tự tối đa của tên phụ tải trước khi rút gọn
};

// Điều hòa cục bộ: diện tích phòng (m²) → BTU và công suất điện (W)
export const DIEU_HOA = [
  { dienTichMax: 15, btu: 9000, w: 800 },
  { dienTichMax: 22, btu: 12000, w: 1100 },
  { dienTichMax: 32, btu: 18000, w: 1700 },
  { dienTichMax: Infinity, btu: 24000, w: 2400 },
];
// Điều hòa VRV: dàn lạnh nhỏ, dàn nóng 3 pha ở tủ tổng
export const VRV = { danLanhW: 100, heSoDanNong: 3.5 };   // kW điện dàn nóng = Σ kW lạnh / hệ số

// Thiết bị trong phòng
export const THIET_BI_PHONG = {
  binhNongLanh: { w: 2500, ten: "BÌNH NÓNG LẠNH" },
  bepTu: { w: 4000, ten: "BẾP TỪ" },
  oCamBep: { w: 3000, cos: 0.9, ten: "Ổ CẮM BẾP" },
  mayGiat: { w: 2000, ten: "MÁY GIẶT" },
  remTang: { w: 200, ten: "RÈM" },
};

/**
 * Thiết bị riêng (mục "thietBi" trong mô tả): loại → mặc định.
 * loaiMach theo danh mục engine/quy-tac.mjs; ma: tiền tố mã lộ.
 */
export const THIET_BI_RIENG = {
  "thang máy": { w: 5500, soPha: 3, loaiMach: "Động cơ (bơm, quạt)", ma: "TM", ten: "THANG MÁY", tuKhoa: ["thang máy", "elevator", "lift"] },
  "bơm": { w: 1100, soPha: 1, loaiMach: "Động cơ (bơm, quạt)", ma: "B", ten: "BƠM TĂNG ÁP", tuKhoa: ["bơm", "pump"] },
  "bơm bể bơi": { w: 1500, soPha: 1, loaiMach: "Động cơ (bơm, quạt)", ma: "BB", ten: "BƠM BỂ BƠI", khuVuc: "Ngoài nhà", tuKhoa: ["bể bơi", "hồ bơi", "pool"] },
  "dàn nóng": { w: 9000, soPha: 3, loaiMach: "Điều hòa", ma: "ACT", ten: "DÀN NÓNG ĐIỀU HÒA", tuKhoa: ["dàn nóng", "vrv", "vrf", "điều hòa trung tâm"] },
  "bình nóng lạnh trung tâm": { w: 3000, soPha: 1, loaiMach: "Khu ướt (WC, bình nóng lạnh)", ma: "WHT", ten: "BÌNH NÓNG LẠNH TRUNG TÂM", khuVuc: "Ướt (WC, tắm)", tuKhoa: ["heat pump", "nóng lạnh trung tâm", "năng lượng mặt trời"] },
  "lò nướng": { w: 3000, soPha: 1, loaiMach: "Bếp từ, lò nướng", ma: "LN", ten: "LÒ NƯỚNG", khuVuc: "Bếp", tuKhoa: ["lò nướng", "oven"] },
  "cổng tự động": { w: 500, soPha: 1, loaiMach: "Động cơ (bơm, quạt)", ma: "CG", ten: "CỔNG TỰ ĐỘNG", khuVuc: "Ngoài nhà", tuKhoa: ["cổng"] },
  "tủ điện nhẹ": { w: 500, soPha: 1, loaiMach: "Thiết bị điện nhẹ (rack, NVR, KNX)", ma: "DN", ten: "TỦ ĐIỆN NHẸ (RACK, NVR)", tuKhoa: ["rack", "điện nhẹ", "nvr", "knx", "camera"] },
  "sạc xe điện": { w: 7400, soPha: 1, loaiMach: "Ổ cắm thông thường", ma: "EV", ten: "SẠC XE ĐIỆN", khuVuc: "Ngoài nhà", tuKhoa: ["sạc", "xe điện", "ev"] },
  "quạt hút": { w: 200, soPha: 1, loaiMach: "Động cơ (bơm, quạt)", ma: "QH", ten: "QUẠT HÚT", tuKhoa: ["quạt"] },
};

// Chiều dài (m) dùng khi không có số liệu
export const CHIEU_DAI = {
  den: 18, oCam: 18, dieuHoa: 15, binhNongLanh: 15, bep: 12, mayGiat: 15, rem: 20, ngoaiNha: 30,
  thietBi: 20, themMoiPhong: 4,     // mạch gom nhiều phòng: cộng thêm mỗi phòng sau phòng đầu
  chieuCaoTang: 3.6, ngangToiTu: 10, // cáp cấp tủ tầng = |chênh tầng| × chiều cao tầng + đoạn ngang
};

export const DU_PHONG_MOI_TU = 2;    // số CB dự phòng thêm vào mỗi tủ (quy tắc ≥ 2)

/**
 * Điện nhẹ điển hình theo loại phòng — dùng khi mô tả có "dienNhe": true (và "knx": true cho cột knx).
 *  data, tv (ổ IPTV), ap, camTrong, camNgoai, loa (loa 100 V), knx (phím bấm / cảm biến KNX)
 * Bộ gợi ý còn: bảo đảm mỗi tầng ≥ 1 AP / DIEN_NHE.apM2 m² trong nhà; 1 nút gọi chuông + 1 cửa ACS ở cổng tầng gốc;
 * 1 màn hình chuông ở phòng khách / sảnh mỗi tầng có.
 */
export const DIEN_NHE_PHONG = {
  "phòng khách": { data: 2, tv: 1, ap: 1, loa: 4, knx: 2 },
  "phòng ngủ": { data: 1, tv: 1, knx: 1 },
  "phòng ăn": { loa: 2, knx: 1 },
  "bếp": { data: 1, loa: 2, knx: 1 },
  "wc": {},
  "sảnh, hành lang": { ap: 1, camTrong: 1, knx: 1 },
  "phòng làm việc": { data: 2, knx: 1 },
  "phòng thờ": { knx: 1 },
  "phòng giải trí": { data: 1, tv: 1, ap: 1, loa: 4, knx: 1 },
  "giặt phơi": {},
  "kho": {},
  "gara": { camTrong: 1, knx: 1 },
  "phòng kỹ thuật": { data: 1 },
  "ban công": {},
  "ngoài nhà": { camNgoai: 2, loa: 2, knx: 1 },
};
export const DIEN_NHE = {
  loaW: 6, loaWNgoai: 10,   // W tap mỗi loa trong nhà / ngoài trời
  apM2: 80,                 // m² sàn trong nhà mỗi AP
  lNgang: 12, lNgoai: 25,   // m cáp ngang từ trục tới phòng / ra khu ngoài nhà (cộng chênh tầng × chiều cao tầng)
  lNguonRack: 8,            // m cáp từ tủ điện tới tủ rack (rack đặt cùng tầng tủ tổng)
};
