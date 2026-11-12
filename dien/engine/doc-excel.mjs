// Đọc file Excel nhập liệu (dien/mau/tao_mau_nhap_lieu.py) ra dữ liệu dự án cho tinhDuAn().
// Đọc theo TÊN SHEET và TIÊU ĐỀ CỘT (không theo vị trí), chấp nhận cả tên cột của bản v1.
// Thư viện SheetJS được truyền vào (Node: gói `xlsx`; trình duyệt: window.XLSX) để file chạy được ở cả hai nơi.

import { BANG_THEO_MA, THEO_MA, TRONG_CODE, datKhoa, docGiaTri } from "./danh-muc-quy-tac.mjs";

const chuanHoa = (s) => String(s ?? "").toLowerCase().replace(/\(.*?\)/g, "").replace(/\s+/g, " ").trim();

const COT_TU = {
  "mã tủ": "ma",
  "tên trên bản vẽ": "ten", "tên / vị trí": "ten",
  "vị trí": "viTri",
  "cấp từ tủ": "capTu",
  "mã lộ cấp": "maLoCap", "mạch cấp ở tủ trên": "maLoCap",
  "đặt sau lộ": "datSauLo",
  "số pha": "soPha",
  "chiều dài cáp cấp": "lCap",
  "kiểu đi cáp cấp": "kieuDi",
  "phương pháp lắp đặt": "phuongPhap",
  "ik tại tủ": "ik",
  "kđt": "ks", "ks": "ks",
  "spd": "spd",
  "ghi chú": "ghiChu",
};
const COT_MACH = {
  "mã tủ": "tu",
  "mã lộ": "ma", "mã mạch": "ma",
  "loại mạch": "loai",
  "phụ tải": "phuTai", "mô tả phụ tải": "phuTai",
  "loại khu vực": "khuVuc",
  "phòng / khu vực": "phong",
  "số lượng": "soLuong",
  "công suất / đv": "congSuat",
  "cosφ": "cos",
  "số pha": "soPha",
  "pha": "pha",
  "chiều dài": "L",
  "số mạch chung ống": "nhomOng",
  "nhóm rcd": "nhomRcd",
  "ghi đè thiết bị": "ghiDeThietBi",
  "ghi đè cáp": "ghiDeCap",
  "ghi đè ống": "ghiDeOng",
  "lý do ghi đè": "lyDo",
  "điều khiển knx": "knx",
  "ghi chú": "ghiChu",
};
const SO_TU = new Set(["lCap", "ik", "ks"]);
// Điện nhẹ: bảng thiết bị theo phòng (sheet Dien nhe) và danh sách tủ rack (sheet Tu rack)
const COT_DN = {
  "tầng": "tang", "phòng / khu vực": "phong", "ổ data": "data", "ổ tv": "tv", "ap wi-fi": "ap",
  "camera trong nhà": "camTrong", "camera ngoài trời": "camNgoai", "cửa kiểm soát": "acs",
  "nút gọi chuông cửa": "chuongNgoai", "màn hình chuông cửa": "chuongTrong", "loa": "loa",
  "công suất tap mỗi loa": "loaW", "vùng âm thanh": "vungAm", "thiết bị knx": "knx", "tủ rack phục vụ": "rack",
  "chiều dài cáp tb": "L", "ghi chú": "ghiChu",
};
const SO_DN = new Set(["data", "tv", "ap", "camTrong", "camNgoai", "acs", "chuongNgoai", "chuongTrong", "loa", "loaW", "knx", "L"]);
const COT_RACK = {
  "mã rack": "ma", "tầng": "tang", "vị trí": "viTri", "cấp nguồn từ tủ": "capTu", "mã lộ cấp nguồn": "maMach",
  "chiều dài cáp nguồn": "lNguon", "chiều dài trục tới rack trung tâm": "lTruc", "rack trung tâm": "trungTam", "ghi chú": "ghiChu",
};
const SO_RACK = new Set(["lNguon", "lTruc"]);
const SO_MACH = new Set(["soLuong", "congSuat", "cos", "L", "nhomOng"]);

const DU_AN = {
  MA_DA: "projectNo", TEN_DA: "project", CHU_DAU_TU: "client", DIA_CHI: "address", CONG_TY: "companyInfo",
  LOAI_CT: "loaiCongTrinh", GIAM_DOC: "director", THIET_KE: "design", CHU_TRI: "design", KIEM_TRA: "checkBy",
  NGUOI_VE: "madeBy", NGAY: "date", TY_LE: "scale", SO_BV_DAU: "soBanVeDau", SO_BV_TONG: "soBanVeTong", SO_BV_DN: "soBanVeDienNhe", REV: "rev",
  UF: "uf", UD: "ud", NOI_DAT: "noiDat", IK_NGUON: "ikNguon", MBA_KVA: "mbaKva", MBA_UK: "mbaUk", DU_MAX: "duMax", BANG_GIA: "bangGia", CHIET_KHAU: "chietKhau",
};
const SO_DU_AN = new Set(["uf", "ud", "ikNguon", "mbaKva", "mbaUk", "duMax", "chietKhau"]);

// Sheet Quy tac: mã tham số, bảng tra và quy tắc trong code lấy từ danh mục engine/danh-muc-quy-tac.mjs.
// Mã cũ không còn trong danh mục nhưng vẫn đọc cho file nhập liệu bản trước.
const MA_CU = { IK_CANHO: "IK_MD" };

/** Số từ ô Excel: số giữ nguyên; chuỗi "0,85" → 0.85; trống/không đọc được → null. */
export function docSo(v) {
  if (v == null || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const x = parseFloat(String(v).replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(x) ? x : null;
}
const docChu = (v) => (v == null ? null : String(v).trim() || null);
const daChot = (v) => /^(✔|✓|x|có|ok|chốt|đã chốt|yes|1)$/i.test(String(v ?? "").trim());

function bangTheoTieuDe(rows, map, laSo, sheet, loi) {
  const head = rows[0] || [];
  const cot = head.map((h) => map[chuanHoa(h)] ?? null);
  for (const need of new Set(Object.values(map).filter((k) => ["ma", "tu", "loai"].includes(k)))) {
    if (!cot.includes(need)) loi.push(`Sheet ${sheet}: thiếu cột bắt buộc (${need})`);
  }
  const out = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r] || [];
    const o = { dong: r + 1 };
    let co = false;
    cot.forEach((k, i) => {
      if (!k || o[k] != null) return;
      const v = laSo.has(k) ? docSo(row[i]) : docChu(row[i]);
      if (v != null) { o[k] = v; co = true; }
    });
    if (co) out.push(o);
  }
  return out;
}

const soPha = (v) => (/3/.test(String(v ?? "")) ? 3 : /1/.test(String(v ?? "")) ? 1 : null);
const PHA_V1 = { L1: "A", L2: "B", L3: "C" };

/**
 * @param {object} XLSX — thư viện SheetJS
 * @param {ArrayBuffer|Uint8Array|Buffer|object} data — nội dung file hoặc workbook đã đọc
 * @returns {{ info, panels, circuits, quyTac, loiDoc: string[] }}
 */
export function docExcel(XLSX, data) {
  const wb = data?.SheetNames ? data : XLSX.read(data, {
    type: typeof Buffer !== "undefined" && Buffer.isBuffer(data) ? "buffer" : "array",
  });
  const loiDoc = [];
  const sheet = (ten) => {
    const name = wb.SheetNames.find((n) => chuanHoa(n) === chuanHoa(ten));
    if (!name) return null;
    return XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: null, raw: true, blankrows: true });
  };

  // --- Du an ---------------------------------------------------------------
  const info = {};
  const da = sheet("Du an");
  if (!da) loiDoc.push("Thiếu sheet Du an");
  for (const row of da || []) {
    const key = DU_AN[String(row?.[0] ?? "").trim()];
    if (!key) continue;
    const v = SO_DU_AN.has(key) ? docSo(row[2]) : docChu(row[2]);
    if (v != null) info[key] = v;
  }

  // --- Tu dien -------------------------------------------------------------
  const td = sheet("Tu dien");
  if (!td) loiDoc.push("Thiếu sheet Tu dien");
  const panels = td ? bangTheoTieuDe(td, COT_TU, SO_TU, "Tu dien", loiDoc).filter((p) => p.ma) : [];
  for (const p of panels) {
    p.soPha = soPha(p.soPha) ?? 3;
    if (p.ten === p.ma) delete p.ten;
  }

  // --- Mach ----------------------------------------------------------------
  const mc = sheet("Mach");
  if (!mc) loiDoc.push("Thiếu sheet Mach");
  const circuits = mc ? bangTheoTieuDe(mc, COT_MACH, SO_MACH, "Mach", loiDoc).filter((c) => c.tu || c.loai || c.ma) : [];
  for (const c of circuits) {
    c.soPha = soPha(c.soPha) ?? 1;
    if (c.pha) c.pha = PHA_V1[c.pha.toUpperCase()] ?? c.pha.toUpperCase();
    if (!c.tu) loiDoc.push(`Sheet Mach dòng ${c.dong}: thiếu Mã tủ`);
  }

  // --- Quy tac -------------------------------------------------------------
  const quyTac = {};
  let soDong = 0, soChot = 0;
  const qt = sheet("Quy tac");
  if (qt) {
    const dat = (path, v) => datKhoa(quyTac, path, v);
    const maD = new Set(TRONG_CODE.map((x) => x.ma));
    let bangB = null, cotChot = 6, bangC = null;
    const xongBang = () => {
      if (bangC?.dong.length) dat(bangC.def.khoa, bangC.def.doc(bangC.dong));
      bangC = null;
    };
    for (const row of qt) {
      const a = String(row?.[0] ?? "").trim();
      // Bảng tra (C2): dòng tiêu đề có mã bảng ở cột A, dòng kế là tiêu đề cột, các dòng sau (cột A trống) là số liệu
      if (bangC) {
        const trong = !row || row.every((x) => x == null || x === "");
        if (!a && !trong) {
          if (!bangC.daQuaTieuDe) { bangC.daQuaTieuDe = true; continue; }
          bangC.dong.push({ nhan: row[1], gt: row.slice(2, 2 + bangC.soCot).map((x) => docSo(x)) });
          continue;
        }
        xongBang();
      }
      if (BANG_THEO_MA.has(a)) {
        const def = BANG_THEO_MA.get(a);
        bangC = { def, dong: [], daQuaTieuDe: false, soCot: Array.isArray(def.cot) ? def.cot.length : 40 };
        soDong++; if (daChot(row[cotChot])) soChot++;
        continue;
      }
      if (chuanHoa(a) === "mã") { const i = row.findIndex((h) => chuanHoa(h).startsWith("chốt")); if (i >= 0) cotChot = i; continue; }
      if (maD.has(a)) { soDong++; if (daChot(row[cotChot])) soChot++; continue; }
      if (chuanHoa(a) === "loại mạch") { bangB = row.map(chuanHoa); continue; }
      if (bangB) {
        if (!a) { bangB = null; continue; }
        const cell = (ten) => row[bangB.findIndex((h) => h.startsWith(ten))];
        const t = {};
        const cos = docSo(cell("cosφ")); if (cos) t.cos = cos;
        const inMin = docSo(cell("in tối thiểu")); if (inMin != null) t.inMin = inMin;
        const cv = String(cell("đường cong") ?? "").trim().toUpperCase().match(/[BCD]/); if (cv) t.curve = cv[0];
        const rcd = chuanHoa(cell("rcd"));
        if (rcd) t.rcd = rcd.startsWith("30") ? "30mA" : rcd.startsWith("tùy") ? "tuy_chon" : "khong";
        const s = docSo(cell("tiết diện tối thiểu")); if (s) t.sMin = s;
        (quyTac.loaiMach ||= {})[a] = t;
        soDong++; if (daChot(row[bangB.findIndex((h) => h.startsWith("chốt"))])) soChot++;
        continue;
      }
      const ts = THEO_MA.get(MA_CU[a] ?? a);
      if (!ts) continue;
      const v = docGiaTri(ts, row[2], docSo);
      if (v == null) continue;
      dat(ts.khoa, v);
      soDong++; if (daChot(row[cotChot])) soChot++;
    }
    xongBang();
    if (soDong && soChot === soDong) quyTac.trangThai = "ĐÃ DUYỆT";
  } else {
    loiDoc.push("Không có sheet Quy tac — dùng bộ quy tắc mặc định của công cụ");
  }

  // --- Dien nhe, Tu rack (điện nhẹ) -----------------------------------------------------------
  const dnRows = sheet("Dien nhe");
  const phongDn = dnRows ? bangTheoTieuDe(dnRows, COT_DN, SO_DN, "Dien nhe", loiDoc)
    .filter((p) => !/^tổng/i.test(String(p.tang ?? "")) && (p.phong || p.tang)) : [];
  const rkRows = sheet("Tu rack");
  const rack = rkRows ? bangTheoTieuDe(rkRows, COT_RACK, SO_RACK, "Tu rack", loiDoc).filter((r) => r.ma) : [];
  for (const r of rack) r.trungTam = daChot(r.trungTam) || /trung tâm/i.test(String(r.trungTam ?? ""));
  const kq = { info, panels, circuits, quyTac, loiDoc };
  if (phongDn.length || rack.length) kq.dienNhe = { phong: phongDn.map(({ dong, ...p }) => p), rack: rack.map(({ dong, ...r }) => r) };
  return kq;
}
