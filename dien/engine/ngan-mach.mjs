// Ngắn mạch theo phương pháp tổng trở (IEC 60909-0 rút gọn; Schneider Electrical Installation Guide, chương G).
//
//   1. Ik3 max tại thanh cái từng tủ (sự cố pha–pha–pha; tủ 1 pha: pha–trung tính) → chọn và kiểm Icu.
//      Thay cho cách cũ "tủ con lấy Ik của tủ trên": Ik giảm dần theo tổng trở cáp cấp.
//   2. Ik1 min cuối mỗi mạch (chạm vỏ, vòng pha – PE, dây nóng ρ = 1,25 ρ20) → kiểm tự cắt nguồn theo
//      IEC 60364-4-41 cho sơ đồ TN: Ik1 min ≥ ngưỡng cắt từ của CB (cận trên). Không đạt mà mạch có RCD thì RCD đảm nhận;
//      không có RCD thì cảnh báo kèm đề xuất (tiết diện đạt, MCB đường cong B, RCBO). Sơ đồ TT: mạch phải có RCD.
//   3. Chọn lọc vùng ngắn mạch: Ik tại thanh cái tủ < ngưỡng cắt từ (cận dưới) của CB phía trên → chọn lọc toàn phần;
//      ngược lại chọn lọc một phần tới Is ≈ ngưỡng đó (theo dòng). Giới hạn thực tra bảng phối hợp của hãng.
//
// Tổng trở là số phức { r, x } (Ω). Ik (kA) = c · Uf / |Z| / 1000.

import { tietDienPE } from "./quy-tac.mjs";

const cong = (...ds) => ds.reduce((a, b) => ({ r: a.r + b.r, x: a.x + b.x }), { r: 0, x: 0 });
const nhan = (z, k) => ({ r: z.r * k, x: z.x * k });
const doLon = (z) => Math.hypot(z.r, z.x);
const ikTheoZ = (c, uf, z) => (c * uf) / doLon(z) / 1000;
/** Tổng trở lưới phía trước suy từ Ik (kA): R = 0,1 X (X ≈ 0,995 Z — Schneider EIG chương G), |Z| = c·Uf/Ik đúng bằng. */
const zTuIk = (c, uf, ik) => { const z = (c * uf) / (ik * 1000); const x = z / Math.sqrt(1.01); return { r: 0.1 * x, x }; };
const so = (x, d = 1) => (x == null || Number.isNaN(x) ? "?" : Number(x).toFixed(d).replace(".", ","));
const laRcd = (tb) => tb && (tb.loai === "RCBO" || tb.loai === "RCCB" || tb.idn);
export const laTN = (noiDat) => !/^TT/i.test(String(noiDat || "TN-S").trim());

/**
 * Tổng trở phía nguồn, tới điểm đấu (đầu cáp nguồn của tủ gốc).
 * Có máy biến áp riêng (info.mbaKva) thì tính từ MBA + lưới trung thế; không thì suy từ Ik tại điểm đấu.
 * @returns {{ pha, vong, moTa, ikDiemDau, macDinh }}
 */
export function tongTroNguon(info, rule, soPha = 3) {
  const nm = rule.nganMach;
  const kva = Number(info.mbaKva) || 0;
  if (kva > 0) {
    const ud = rule.ud;
    const uk = Number(info.mbaUk) || nm.ukMba.find(([s]) => kva <= s)[1];
    const zt = ((uk / 100) * ud * ud) / (kva * 1000);
    const rt = nm.rtZt * zt;
    const za = (ud * ud) / (nm.sscTrungThe * 1e6);
    const pha = { r: (0.1 * za) / Math.sqrt(1.01) + rt, x: za / Math.sqrt(1.01) + Math.sqrt(zt * zt - rt * rt) };
    // MBA Dyn: Z0 ≈ Z1 nên tổng trở vòng pha – PE tại đầu cực MBA ≈ tổng trở pha
    return { pha, vong: pha, moTa: `MBA ${kva} kVA, Uk = ${so(uk, 1)}%`, ikDiemDau: ikTheoZ(nm.cMax, rule.uf, pha), macDinh: false, kva, uk };
  }
  const macDinh = !(Number(info.ikNguon) > 0);
  const ik = macDinh ? rule.ikMacDinh : Number(info.ikNguon);
  const pha = zTuIk(nm.cMax, rule.uf, ik);
  // Ik điểm đấu của nguồn 3 pha là Ik3 → vòng pha – PE (qua PEN/PE phía lưới) ≈ k × tổng trở pha; nguồn 1 pha: Ik đã là pha – trung tính
  return { pha, vong: nhan(pha, soPha === 3 ? nm.kVongNguon : 1), moTa: `Ik tại điểm đấu ${so(ik)} kA${macDinh ? " (mặc định)" : ""}`, ikDiemDau: ik, macDinh };
}

/** Tổng trở một đoạn cáp: zMax (đường sự cố lớn nhất: 3 pha → 1 dây pha; 1 pha → pha + trung tính) và zVong (pha + PE, ρ nóng). */
export function tongTroCap({ s, pe, L, soPha }, rule) {
  const nm = rule.nganMach;
  if (!(s > 0) || !(L > 0)) return { zMax: { r: 0, x: 0 }, zVong: { r: 0, x: 0 } };
  const pha = { r: (nm.rho20 * L) / s, x: rule.lambda * L };
  const rhoMin = nm.rho20 * nm.kRhoMin;
  return {
    zMax: nhan(pha, soPha === 3 ? 1 : 2),
    zVong: { r: rhoMin * L * (1 / s + 1 / (pe || tietDienPE(s, rule))), x: 2 * rule.lambda * L },
  };
}

/** Ngưỡng cắt từ của thiết bị (A): cận dưới (có thể cắt từ đây — dùng cho chọn lọc) và cận trên (chắc chắn cắt — dùng kiểm tự cắt nguồn). */
export function nguongTu(tb, rule) {
  if (!tb?.in) return null;
  const nm = rule.nganMach;
  if (tb.loai === "MCCB") {
    const im = tb.im ?? nm.imMccb * tb.in;
    return { duoi: im * (1 - nm.saiSoMccb), tren: im * (1 + nm.saiSoMccb), moTa: `Im = ${Math.round(im)} A${tb.im ? "" : ` (${nm.imMccb}×In)`} ±${Math.round(nm.saiSoMccb * 100)}%` };
  }
  const cv = nm.duongCong[tb.curve] ? tb.curve : "C";
  const [d, t] = nm.duongCong[cv];
  return { duoi: d * tb.in, tren: t * tb.in, moTa: `đường cong ${cv}: ${t}×In = ${Math.round(t * tb.in)} A` };
}

/**
 * Tính ngắn mạch cho kết quả tinhDuAn (các tủ đã có thiết bị và cáp). Ghi t.nganMach, m.nganMach.
 * @returns {{ nguon: object, ikTheoTu: Map<string, number> }} Ik max (kA) tại thanh cái từng tủ — cho lượt tính lại Icu
 */
export function tinhNganMach(kq, info = {}) {
  const rule = kq.quyTac;
  const nm = rule.nganMach;
  const theoMa = new Map(kq.tu.map((t) => [t.ma, t]));
  const ikTheoTu = new Map();
  let nguonGoc = null;

  const ganTu = (t, zMax, zVong, nguon) => {
    t.nganMach = { zMax, zVong, ikMax: ikTheoZ(nm.cMax, rule.uf, zMax), ik1Min: ikTheoZ(nm.cMin, rule.uf, zVong), nguon };
    ikTheoTu.set(t.ma, t.nganMach.ikMax);
    const tuNhap = (x) => {   // tủ có Ik nhập: coi thanh cái tủ là điểm nguồn mới
      const z = zTuIk(nm.cMax, rule.uf, x.ik);
      return { zMax: z, zVong: nhan(z, x.soPha === 3 ? nm.kVongNguon : 1) };
    };
    for (const m of t.mach) {
      const n = (m.nganMach = { ikDau: t.nganMach.ikMax });
      if (m.laCapTuCon) {
        const con = theoMa.get(m.tuCon);
        if (!con) continue;
        if (con.ik) { const z = tuNhap(con); ganTu(con, z.zMax, z.zVong, "nhập"); continue; }
        const c = tongTroCap({ s: m.cap?.s, pe: m.cap?.pe, L: m.L, soPha: con.soPha }, rule);
        ganTu(con, cong(zMax, c.zMax), cong(zVong, c.zVong), "tính");
        n.ik1Cuoi = con.nganMach.ik1Min;
        continue;
      }
      if (!m.cap?.s || m.kieu?.duPhong) continue;
      const c = tongTroCap({ s: m.cap.s, pe: m.cap.pe, L: m.L, soPha: m.soPha }, rule);
      n.zVong = cong(zVong, c.zVong);
      n.ik1Cuoi = ikTheoZ(nm.cMin, rule.uf, n.zVong);
    }
  };

  for (const g of kq.tu.filter((t) => !t.cha)) {
    const ng = tongTroNguon(info, rule, g.soPha);
    nguonGoc ||= ng;
    g.nguonNganMach = ng;
    if (g.ik) {
      const z = zTuIk(nm.cMax, rule.uf, g.ik);
      ganTu(g, z, nhan(z, g.soPha === 3 ? nm.kVongNguon : 1), "nhập");
    } else {
      const c = g.capNguon && g.lCap > 0 ? tongTroCap({ s: g.capNguon.s, pe: g.capNguon.pe, L: g.lCap, soPha: g.soPha }, rule) : null;
      ganTu(g, c ? cong(ng.pha, c.zMax) : ng.pha, c ? cong(ng.vong, c.zVong) : ng.vong, "tính");
    }
  }
  return { nguon: nguonGoc, ikTheoTu };
}

/** Tiết diện nhỏ nhất (≥ s hiện tại) để Ik1 min cuối đoạn ≥ ngưỡng (A); null nếu cỡ lớn nhất vẫn không đạt. */
function tietDienDat(zTruoc, L, soPha, sHienTai, nguongA, rule) {
  for (const s of rule.tietDien) {
    if (s <= sHienTai) continue;
    const c = tongTroCap({ s, pe: tietDienPE(s, rule), L, soPha }, rule);
    const ik = ikTheoZ(rule.nganMach.cMin, rule.uf, cong(zTruoc, c.zVong)) * 1000;
    if (ik >= nguongA) return { s, ik };
  }
  return null;
}

/**
 * Kiểm tra sau khi tính ngắn mạch: tự cắt nguồn (TN), RCD (TT), chọn lọc vùng ngắn mạch. Ghi vào kq.canhBao và kiemTra của mạch/tủ.
 */
export function kiemTraNganMach(kq, { nguon } = {}) {
  const rule = kq.quyTac;
  const nm = rule.nganMach;
  const tn = laTN(rule.noiDat);
  const theoMa = new Map(kq.tu.map((t) => [t.ma, t]));
  const bao = (muc, t, m, noiDung) => {
    kq.canhBao.push({ muc, tu: t?.ma ?? "", mach: m?.ma ?? "", noiDung });
    const dich = m || t;
    if (dich) (dich.kiemTra ||= []).push({ muc, noiDung });
  };
  const kA = (x) => `${so(x, 2)} kA`;

  if (nguon?.macDinh) bao("canhbao", kq.tu.find((t) => !t.cha), null, `Thiếu Ik tại điểm đấu — tính ngắn mạch từ giá trị mặc định ${rule.ikMacDinh} kA; cần số liệu của điện lực / tòa nhà`);

  for (const t of kq.tu) {
    const n = t.nganMach;
    if (!n) continue;
    const ikBusA = n.ikMax * 1000;

    // --- Tự cắt nguồn khi chạm vỏ ------------------------------------------------------------------
    const khongRcdTT = [];
    for (const m of t.mach) {
      const mn = m.nganMach;
      if (!mn || mn.ik1Cuoi == null || !m.thietBi) continue;
      const ng = nguongTu(m.thietBi, rule);
      mn.nguong = ng;
      const coRcd = !m.laCapTuCon && (laRcd(m.thietBi) || !!m.nhomRcd);
      if (!tn) {
        mn.tuCat = coRcd ? "rcd" : m.laCapTuCon ? null : "khong";
        if (!coRcd && !m.laCapTuCon) khongRcdTT.push(m.ma);
        continue;
      }
      const ik1A = mn.ik1Cuoi * 1000;
      if (ik1A >= ng.tren - 1e-6) { mn.tuCat = "dat"; continue; }
      const truoc = t.nganMach.zVong;   // vòng pha – PE tới thanh cái tủ đặt CB
      const conTu = m.laCapTuCon ? theoMa.get(m.tuCon) : null;
      if (coRcd) {
        mn.tuCat = "rcd";
        bao("ghichu", t, m, `Ik1 min cuối mạch ${kA(mn.ik1Cuoi)} < ngưỡng cắt từ (${ng.moTa}) — tự cắt nguồn khi chạm vỏ nhờ RCD 30 mA (IEC 60364-4-41 411.4.5)`);
        continue;
      }
      mn.tuCat = "khong";
      const dx = [];
      const sDat = tietDienDat(truoc, m.L, conTu ? conTu.soPha : m.soPha, m.cap?.s ?? 0, ng.tren, rule);
      if (sDat) dx.push(`tăng ${conTu ? "cáp" : "dây"} lên ${so(sDat.s, sDat.s % 1 ? 1 : 0)} mm² (Ik1 min ≈ ${kA(sDat.ik / 1000)})`);
      if (!conTu && m.thietBi.loai !== "MCCB" && (m.thietBi.curve || "C") !== "B" && ik1A >= nm.duongCong.B[1] * m.thietBi.in) {
        dx.push(`dùng MCB đường cong B (${nm.duongCong.B[1]}×In = ${Math.round(nm.duongCong.B[1] * m.thietBi.in)} A) nếu tải không có dòng khởi động lớn`);
      }
      if (m.thietBi.loai === "MCCB") {
        const imMax = Math.floor(ik1A / (1 + nm.saiSoMccb) / 10) * 10;
        dx.push(`dùng MCCB chỉnh định được với Im ≤ ${imMax} A${conTu ? "" : ` (ghi đè "MCCB … Im=${imMax}A")`}`);
      }
      if (!conTu) dx.push("dùng RCBO 30 mA");
      mn.deXuat = dx.join("; ");
      bao("canhbao", t, m, `Ik1 min ${conTu ? `tại thanh cái tủ ${conTu.ma}` : "cuối mạch"} ${kA(mn.ik1Cuoi)} < ngưỡng cắt từ (${ng.moTa}) — CB có thể không tự cắt nguồn kịp khi chạm vỏ (IEC 60364-4-41). Đề xuất: ${dx.join("; hoặc ") || "kiểm lại tuyến cáp"}`);
    }
    if (khongRcdTT.length) {
      bao("canhbao", t, null, `Sơ đồ TT: các mạch ${khongRcdTT.join(", ")} không có RCD — dòng chạm vỏ bị giới hạn bởi điện trở tiếp địa nên CB không tự cắt được; cần RCD (RCBO từng mạch, hoặc RCD đầu tủ) với RA · IΔn ≤ 50 V (IEC 60364-4-41 411.5)`);
    }

    // --- Chọn lọc vùng ngắn mạch -----------------------------------------------------------------
    const chonLoc = [];
    const xet = (tren, thietBi) => {
      const ng = nguongTu(thietBi, rule);
      if (!ng) return;
      const toanPhan = ikBusA < ng.duoi - 1e-6;
      chonLoc.push({ tren, thietBi, imDuoi: ng.duoi, toanPhan, is: toanPhan ? null : ng.duoi });
    };
    if (t.cbTong && t.mach.some((m) => m.thietBi)) xet("CB tổng ↔ các lộ ra", t.cbTong);
    if (t.cha) {
      const lo = theoMa.get(t.cha)?.mach.find((m) => m.tuCon === t.ma);
      if (lo?.thietBi) xet(`Lộ ${lo.ma} tủ ${t.cha} ↔ tủ ${t.ma}`, lo.thietBi);
    }
    n.chonLoc = chonLoc;
    if (chonLoc.length) {
      const phan = chonLoc.map((c) => `${c.tren}: ${c.toanPhan ? "toàn phần" : `một phần, tới Is ≈ ${kA(c.is / 1000)}`} (ngưỡng cắt từ dưới ${Math.round(c.imDuoi)} A)`);
      bao("ghichu", t, null, `Chọn lọc ngắn mạch — Ik3 max tại thanh cái ${kA(n.ikMax)}. ${phan.join("; ")}. Tính theo dòng; giới hạn thực tra bảng phối hợp của hãng`);
    }
  }
}
