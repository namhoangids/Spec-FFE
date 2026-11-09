// Tính cho từng mạch: dòng làm việc, thiết bị bảo vệ, cáp, sụt áp, ống luồn.
// Công thức theo mục 6.2 – 6.4 của phương án.

import { dinhMucToiThieu, heSoNhom, tietDienPE } from "./quy-tac.mjs";

/** Dòng làm việc Ib (A). */
export function dongLamViec(P, cos, soPha, rule) {
  if (!P) return 0;
  return soPha === 3 ? P / (Math.sqrt(3) * rule.ud * cos) : P / (rule.uf * cos);
}

/** Sụt áp (%) của đoạn cáp tiết diện s, dài L, dòng Ib. */
export function sutAp(Ib, L, s, cos, soPha, rule) {
  if (!Ib || !L) return 0;
  const sin = Math.sqrt(Math.max(0, 1 - cos * cos));
  const z = (rule.rho / s) * cos + rule.lambda * sin;
  return soPha === 3
    ? ((Math.sqrt(3) * Ib * L * z) / rule.ud) * 100
    : ((2 * Ib * L * z) / rule.uf) * 100;
}

/** Có bắt buộc RCD 30 mA không (theo loại mạch và loại khu vực). */
export function canRcd(loai, khuVuc, rule) {
  const t = rule.loaiMach[loai];
  return (t && t.rcd === "30mA") || rule.khuVucRcd.includes(khuVuc);
}

/** Chọn khả năng cắt (kA) nhỏ nhất ≥ Ik trong danh sách. */
export function chonIcu(list, ik) {
  return list.find((v) => v >= ik - 1e-9) ?? list[list.length - 1];
}

/**
 * Thiết bị bảo vệ cho mạch nhánh.
 * @returns {{loai, soCuc, in, curve, icu, idn, module}}
 */
export function chonThietBi({ Ib, soPha, loai, rcd, ik, trongNhom }, rule) {
  const t = rule.loaiMach[loai] || { inMin: 16, curve: "C" };
  const In = Math.max(dinhMucToiThieu(rule.kIn * Ib, rule) ?? rule.dinhMuc.at(-1), t.inMin || 0);
  const coRcd = rcd && !trongNhom;
  const icu = chonIcu(rule.icu.mach, ik);
  if (In > rule.inMaxMcb) {
    return { loai: "MCCB", soCuc: soPha === 3 ? "3P" : "2P", in: In, curve: "", icu: chonIcu(rule.icu.mccb, ik), idn: null, module: rule.module.MCCB };
  }
  if (coRcd) {
    const soCuc = soPha === 3 ? "3P+N" : "1P+N";
    return { loai: "RCBO", soCuc, in: In, curve: t.curve, icu, idn: 30, module: rule.module[`RCBO-${soCuc}`] };
  }
  const soCuc = soPha === 3 ? "3P" : "1P";
  return { loai: "MCB", soCuc, in: In, curve: t.curve, icu, idn: null, module: rule.module[`MCB-${soCuc}`] };
}

/**
 * Chọn tiết diện cáp nhỏ nhất thỏa Iz′ ≥ In, sụt áp cộng dồn ≤ giới hạn, ≥ tiết diện tối thiểu.
 * @param o.cachDien "PVC" | "XLPE"; o.phuongPhap "B1"…; o.soDayTai 2|3; o.nhom số mạch chung ống
 */
export function chonCap(o, rule) {
  const { In, Ib, cos, L, soPha, duTruoc = 0, gioiHan, sMin = 1.5, cachDien = "PVC", phuongPhap = "B1", nhom = 1 } = o;
  const soDayTai = soPha === 3 ? 3 : 2;
  const bang = rule.iz[cachDien]?.[phuongPhap]?.[soDayTai];
  if (!bang) throw new Error(`Không có bảng Iz cho ${cachDien} / ${phuongPhap} / ${soDayTai} dây`);
  const k = rule.k1[cachDien] * heSoNhom(nhom, rule);
  let chon = null;
  for (let i = 0; i < rule.tietDien.length; i++) {
    const s = rule.tietDien[i];
    if (s < sMin) continue;
    const izp = bang[i] * k;
    const du = sutAp(Ib, L, s, cos, soPha, rule);
    chon = { s, izp, du, duCongDon: duTruoc + du, dat: izp >= In - 1e-9 && duTruoc + du <= gioiHan + 1e-9 };
    if (chon.dat) break;
  }
  return { ...chon, pe: tietDienPE(chon.s, rule), cachDien, phuongPhap, soDayTai, k };
}

/** Kiểm tra lại một tiết diện cho sẵn (khi ghi đè cáp). */
export function kiemCap(s, o, rule) {
  const { Ib, cos, L, soPha, duTruoc = 0, cachDien = "PVC", phuongPhap = "B1", nhom = 1 } = o;
  const soDayTai = soPha === 3 ? 3 : 2;
  const i = rule.tietDien.indexOf(s);
  const izp = i >= 0 ? rule.iz[cachDien][phuongPhap][soDayTai][i] * rule.k1[cachDien] * heSoNhom(nhom, rule) : null;
  const du = sutAp(Ib, L, s, cos, soPha, rule);
  return { s, izp, du, duCongDon: duTruoc + du, pe: tietDienPE(s, rule), cachDien, phuongPhap, soDayTai };
}

/** Chọn ống PVC theo hệ số lấp đầy. dayDon: danh sách tiết diện dây đơn; capNhieuLoi: tiết diện cáp nhiều lõi. */
export function chonOng({ dayDon = [], capNhieuLoi = [] }, rule) {
  const dt = (d) => (Math.PI * d * d) / 4;
  const tong = dayDon.reduce((a, s) => a + dt(rule.dkDayDon[s] ?? 4), 0)
    + capNhieuLoi.reduce((a, s) => a + dt(rule.dkCap4Loi[s] ?? 15), 0);
  for (const [d, dTrong] of rule.ong) {
    if (d < (rule.ongToiThieu || 0)) continue;
    if (tong <= (rule.lapDay / 100) * dt(dTrong)) return d;
  }
  return rule.ong.at(-1)[0];
}

// --- Đọc giá trị ghi đè ----------------------------------------------------

/** "RCBO 1P+N 25A 30mA", "MCB 3P 32A C 6kA" → thiết bị; null nếu không đọc được. */
export function docThietBi(s, rule) {
  if (!s) return null;
  const m = String(s).toUpperCase().replace(/,/g, ".").match(/(MCB|RCBO|RCCB|MCCB)\s+(\d)P(\+N)?\s+(\d+)\s*A(?:\s+([BCD])\b)?(?:\s+(\d+(?:\.\d+)?)\s*KA)?(?:\s+(\d+)\s*MA)?/);
  if (!m) return null;
  const [, loai, cuc, n, In, curve, icu, idn] = m;
  const soCuc = `${cuc}P${n ? "+N" : ""}`;
  const key = loai === "MCCB" ? "MCCB" : `${loai}-${soCuc}`;
  return {
    loai, soCuc, in: +In, curve: curve || (loai === "MCCB" ? "" : "C"), icu: icu ? +icu : null,
    idn: idn ? +idn : loai === "RCBO" || loai === "RCCB" ? 30 : null,
    module: rule.module[key] ?? (+cuc + (n ? 1 : 0)),
  };
}

/** Tiết diện dây pha đọc từ chuỗi cáp ghi đè: "2(1x2,5)", "(4x10)", "3x2.5" … */
export function docTietDien(s) {
  if (!s) return null;
  const t = String(s).replace(/,/g, ".");
  const m = t.match(/\d\s*\(\s*1\s*x\s*([\d.]+)\s*\)/i) || t.match(/\(\s*\d\s*x\s*([\d.]+)\s*\)/i) || t.match(/\d\s*x\s*([\d.]+)/i);
  return m ? +m[1] : null;
}
