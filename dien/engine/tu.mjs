// Tổng hợp tủ (mục 6.1 bước 5, 6.6): Pđ, Kđt, Ptt, dòng từng pha → CB tổng → số module → vỏ tủ.

import { PHA, doLechPha } from "./can-pha.mjs";
import { chonIcu } from "./mach.mjs";
import { dinhMucToiThieu, heSoTuCon } from "./quy-tac.mjs";

/**
 * Tổng hợp phụ tải của tủ từ danh sách mạch (đã cân pha).
 * Kđt của tủ áp cho các mạch cuối của tủ; mạch cấp tủ con mang sẵn Ptt của tủ con và nhân thêm
 * hệ số đồng thời giữa các tủ con (theo số tủ con). Nếu người dùng nhập Kđt cho tủ thì dùng cho cả hai.
 * Kđt trả về là hệ số tương đương = Ptt / Pđ.
 */
export function tongHopTu(tu, mach, rule, ksMacDinh) {
  const ksNhap = tu.ksNhap ?? tu.ks ?? null;
  const soCon = mach.filter((m) => m.laCapTuCon).length;
  const kRieng = ksNhap ?? ksMacDinh;
  const kCon = ksNhap ?? heSoTuCon(soCon, rule);
  let P = 0, VA = 0, Ptt = 0;
  const s = { A: 0, B: 0, C: 0 };
  for (const m of mach) {
    const k = m.laCapTuCon ? kCon : kRieng;
    const p = m.P || 0, va = m.va || 0;
    P += p; VA += va; Ptt += k * p;
    if (m.soPha === 3) for (const x of PHA) s[x] += k * (m.vaPha ? m.vaPha[x] : va / 3);
    else s[PHA.includes(m.pha) ? m.pha : "A"] += k * va;
  }
  const cosTb = VA > 0 ? P / VA : 0.9;
  const pd = P / 1000;
  const ptt = Ptt / 1000;
  let iPha, iMax, itt;
  if (tu.soPha === 3) {
    iPha = Object.fromEntries(PHA.map((p) => [p, s[p] / rule.uf]));
    iMax = Math.max(...PHA.map((p) => iPha[p]));
    itt = (ptt * 1000) / (Math.sqrt(3) * rule.ud * cosTb);
  } else {
    iMax = (s.A + s.B + s.C) / rule.uf;
    iPha = { A: iMax, B: 0, C: 0 };
    itt = iMax;
  }
  return {
    pd, ks: P > 0 ? Ptt / P : kRieng, ksRieng: kRieng, ksCon: soCon ? kCon : null, soCon,
    ptt, cosTb, va: VA, vaPha: s, iPha, iMax, itt, lechPha: tu.soPha === 3 ? doLechPha(s) : 0,
  };
}

/** CB tổng: In ≥ kIn·I pha lớn nhất và ≥ kChonLoc·In mạch ra lớn nhất. */
export function chonCbTong(tu, tong, mach, rule, { laGoc, ik }) {
  const maxRa = Math.max(0, ...mach.filter((m) => m.thietBi).map((m) => m.thietBi.in));
  const In = Math.max(
    dinhMucToiThieu(rule.kIn * tong.iMax, rule) ?? 0,
    dinhMucToiThieu(rule.kChonLoc * maxRa, rule) ?? 0,
  ) || rule.dinhMuc.at(-1);
  const soCuc = tu.soPha === 3 ? (laGoc ? rule.soCucTong.goc3P : rule.soCucTong.con3P) : rule.soCucTong.tu1P;
  const mcbDuIcu = ik <= Math.max(...rule.icu.tongMcb) + 1e-9;
  if (In <= rule.inMaxMcb && mcbDuIcu) {
    return { loai: "MCB", soCuc, in: In, curve: "C", icu: chonIcu(rule.icu.tongMcb, ik), idn: null, module: rule.module[`MCB-${soCuc}`] ?? parseInt(soCuc, 10), maxRa };
  }
  return { loai: "MCCB", soCuc, in: In, curve: "", icu: chonIcu(rule.icu.mccb, ik), idn: null, module: rule.module.MCCB, maxRa };
}

/** Đếm module thiết bị lắp thanh DIN, cộng dự phòng, chọn vỏ tủ. */
export function demModule(tu, mach, nhom, cbTong, rule, { coSpd }) {
  const chiTiet = [];
  const them = (ten, n) => { if (n) chiTiet.push([ten, n]); };
  for (const m of mach) if (m.thietBi) them(`${m.ma || m.phuTai}: ${m.thietBi.loai} ${m.thietBi.soCuc}`, m.thietBi.module);
  for (const g of nhom) them(`Nhóm ${g.ma}: ${g.thietBi.loai} ${g.thietBi.soCuc}`, g.thietBi.module);
  them(`CB tổng ${cbTong.loai} ${cbTong.soCuc}`, cbTong.module);
  if (tu.soPha === 3 && rule.denBaoPha) them("Đèn báo pha", rule.module.DEN_BAO);
  if (coSpd) them("SPD loại 2", tu.soPha === 3 ? rule.module.SPD3 : rule.module.SPD1);
  const tong = chiTiet.reduce((a, [, n]) => a + n, 0);
  const can = tong * (1 + rule.duPhongVo / 100);
  const voTu = rule.voTu.find((v) => v >= can - 1e-9) ?? null;
  return { tong, can, voTu, chiTiet };
}
