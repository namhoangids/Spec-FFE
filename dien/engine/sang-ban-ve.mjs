// Đổi kết quả tính (tinhDuAn) sang dữ liệu tờ vẽ của template dien/template (veSoDoTu),
// ghi chữ theo đúng kiểu của bản vẽ mẫu E.601: "Cu/PVC 2(1x2,5)mm2 + E(1x2,5)mm2", "ỐNG PVC  Ø 20"…

const so = (x, d = 2) => Number(x).toFixed(d).replace(".", ",");
const tietDien = (s) => String(s).replace(".", ",");

/** Chữ cáp của một mạch hoặc cáp cấp tủ. */
export function chuCap(cap, { soPha = 1, dongCo = false } = {}) {
  if (!cap?.s) return "";
  const s = tietDien(cap.s), pe = tietDien(cap.pe ?? cap.s);
  if (cap.kieu === "nhieuLoi") {
    return `Cu/XLPE/PVC (${cap.soLoi ?? (soPha === 3 ? 4 : 2)}x${s})mm2 + E(1x${pe})mm2`;
  }
  const n = soPha === 3 ? (dongCo ? 3 : 4) : 2;
  return `Cu/PVC ${n}(1x${s})mm2 + E(1x${pe})mm2`;
}

/** Thiết bị → 4 dòng nhãn của ký hiệu aptomat. RCBO/RCCB ghi dòng rò ở dòng 4 như mẫu. */
export function chuThietBi(tb) {
  if (!tb) return { type: "", poles: "", rating: "", breaking: "" };
  const ro = tb.loai === "RCBO" || tb.loai === "RCCB";
  return {
    type: tb.loai,
    poles: tb.soCuc,
    rating: `${tb.in}A`,
    breaking: ro ? `${tb.idn ?? 30}mA` : tb.icu != null ? `${tb.icu}kA` : "",
  };
}

/** "E.601" + 2 → "E.603" (giữ số chữ số). */
export function soBanVe(dau = "E.601", i = 0) {
  const m = String(dau).match(/^(.*?)(\d+)$/);
  if (!m) return `${dau}-${i + 1}`;
  return m[1] + String(Number(m[2]) + i).padStart(m[2].length, "0");
}

const hoa = (s) => String(s ?? "").toLocaleUpperCase("vi");

/**
 * @param {object} t — một tủ trong kq.tu
 * @param {object} info — duAn.info (khung tên)
 * @param {number} i — thứ tự tờ (0 = tờ đầu)
 */
export function sangBanVe(t, info = {}, i = 0) {
  const sheet = {
    drawingNo: soBanVe(info.soBanVeDau || "E.601", i),
    title: `SƠ ĐỒ NGUYÊN LÝ ĐIỆN ${hoa(t.ten)}`,
    companyInfo: info.companyInfo ?? "",
    client: info.client ?? "",
    address: info.address ?? "",
    project: info.project ?? "",
    date: info.date ?? "",
    scale: info.scale ?? "",
    director: info.director ?? "",
    design: info.design ?? "",
    checkBy: info.checkBy ?? "",
    madeBy: info.madeBy ?? "",
    projectNo: info.projectNo ?? "",
  };
  const panel = {
    name: t.module?.voTu ? `TỦ ĐIỆN ${t.module.voTu} MODULE` : "TỦ ĐIỆN",
    supplyCable: [chuCap(t.capNguon, { soPha: t.soPha }), t.capNguon ? t.ongNguon || "" : ""],
    incomer: chuThietBi(t.cbTong),
    loadText: [`Pđ=${so(t.pd)} kW, Kđt=${so(t.ks)}`, `Ptt=${so(t.ptt)} kW`],
  };
  const circuits = t.mach.map((m) => ({
    code: m.ma,
    device: chuThietBi(m.thietBi),
    cable: m.ghiDe?.cap && m.cap?.ghiDe ? m.ghiDe.cap : chuCap(m.cap, { soPha: m.soPha, dongCo: m.kieu?.dongCo }),
    conduit: m.ong || "",
    phase: m.soPha === 3 ? "ABC" : m.pha || "",
    load: hoa(m.phuTai),
  }));
  const groups = (t.nhomRcd || []).map((g) => ({ device: chuThietBi(g.thietBi), circuits: g.mach }));
  return { sheet, panel, groups, circuits };
}

/** Cả bộ tờ vẽ theo thứ tự tủ (tủ gốc trước). */
export function sangBoBanVe(kq, info = {}) {
  return kq.tu.map((t, i) => ({ ma: t.ma, ten: t.ten, du: sangBanVe(t, info, i) }));
}
