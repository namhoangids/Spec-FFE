// Định dạng số và diễn giải cách chọn cáp / ống — dùng chung cho bảng tính (xuat-excel.mjs) và thuyết minh (thuyet-minh.mjs).

import { sutAp } from "./mach.mjs";
import { heSoNhom } from "./quy-tac.mjs";

// Làm tròn giống chữ trên bản vẽ (toFixed) để bảng tính, thuyết minh và bản vẽ ghi cùng một số
export const r = (x, d = 2) => (x == null || Number.isNaN(x) ? null : Number(Number(x).toFixed(d)));
export const v = (x, d = 2) => (x == null || Number.isNaN(x) ? "—" : Number(x).toFixed(d).replace(".", ","));
/** Thiết bị đóng cắt dạng chữ: "RCBO 1P+N 16A C 6kA 30mA" */
export const tb = (t) => (t ? `${t.loai} ${t.soCuc} ${t.in}A${t.curve ? ` ${t.curve}` : ""}${t.icu != null ? ` ${t.icu}kA` : ""}${t.idn ? ` ${t.idn}mA` : ""}` : "");
export const vn = (x, d = 1) => (x == null ? "—" : Number(x).toFixed(d).replace(".", ","));
export const dt = (d) => (Math.PI * d * d) / 4;

/** Các tiết diện đã thử: Iz′ và ΔU từng cỡ, dừng ở cỡ được chọn. */
export function chuoiTietDien(m, cap, rule, duTruoc) {
  const bang = rule.iz[cap.cachDien]?.[cap.phuongPhap]?.[cap.soDayTai];
  if (!bang) return { buoc: "", quyetDinh: "" };
  const k = rule.k1[cap.cachDien] * heSoNhom(m.nhomOng || 1, rule);
  const sMin = m.kieu?.sMin ?? 1.5;
  const buoc = [];
  let truotIz = false, truotDu = false;
  for (let i = 0; i < rule.tietDien.length; i++) {
    const s = rule.tietDien[i];
    if (s > cap.s) break;
    if (s < sMin) continue;
    const izp = bang[i] * k, du = duTruoc + sutAp(m.Ib, m.L, s, m.cos, m.soPha, rule);
    const okIz = izp >= m.thietBi.in - 1e-9, okDu = du <= (cap.gioiHan ?? rule.duMax) + 1e-9;
    buoc.push(`${vn(s, s % 1 ? 1 : 0)}: Iz′ ${vn(izp)} ${okIz ? "≥" : "<"} In ${m.thietBi.in}; ΔU ${vn(du, 2)}% ${okDu ? "✓" : "✗"}`);
    if (s < cap.s) { truotIz ||= !okIz; truotDu ||= !okDu; }
  }
  const quyetDinh = cap.ghiDe ? "Cáp ghi đè"
    : truotIz ? `Tăng cỡ vì cỡ nhỏ hơn có Iz′ < In ${m.thietBi.in} A`
    : truotDu ? "Tăng cỡ vì sụt áp vượt giới hạn"
    : `Tiết diện tối thiểu loại mạch (${vn(sMin, sMin % 1 ? 1 : 0)} mm²) đã đạt Iz′ và ΔU`;
  return { buoc: buoc.join(" | "), quyetDinh };
}

/** Ống: các cỡ thử và hệ số lấp đầy. */
export function chuoiOng(dayDon, capNhieuLoi, rule) {
  const cacDay = [
    ...dayDon.map((s) => ({ s, d: rule.dkDayDon[s] ?? 4, ten: `dây đơn ${vn(s, s % 1 ? 1 : 0)} mm²` })),
    ...capNhieuLoi.map((s) => ({ s, d: rule.dkCap4Loi[s] ?? 15, ten: `cáp nhiều lõi ${vn(s, s % 1 ? 1 : 0)} mm²` })),
  ];
  const tong = cacDay.reduce((a, x) => a + dt(x.d), 0);
  const thu = [];
  let chon = rule.ong.at(-1);
  for (const o of rule.ong) {
    if (o[0] < (rule.ongToiThieu || 0)) continue;
    const pct = (tong / dt(o[1])) * 100;
    thu.push(`Ø${o[0]} (trong ${vn(o[1])}): ${vn(pct)}%`);
    if (pct <= rule.lapDay + 1e-9) { chon = o; break; }
  }
  const nhom = {};
  for (const x of cacDay) nhom[x.ten] = { n: (nhom[x.ten]?.n || 0) + 1, d: x.d };
  return {
    moTa: Object.entries(nhom).map(([t, x]) => `${x.n}×${t} (Ø${vn(x.d)})`).join(" + "),
    tong, thu: thu.join(" | "), d: chon[0], dTrong: chon[1], pct: (tong / dt(chon[1])) * 100,
  };
}
