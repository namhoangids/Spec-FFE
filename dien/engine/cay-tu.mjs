// Tính cả dự án theo cây tủ (mục 6.1 bước 6): tủ lá → tủ gốc (phụ tải, thiết bị, CB tổng),
// rồi tủ gốc → tủ lá (cáp, sụt áp cộng dồn từ nguồn).

import { canPha } from "./can-pha.mjs";
import { kiemTra } from "./kiem-tra.mjs";
import {
  canRcd, chonCap, chonIcu, chonOng, chonThietBi, docThietBi, docTietDien, dongLamViec, kiemCap,
} from "./mach.mjs";
import { dinhMucToiThieu, heSoTuCon, taoQuyTac } from "./quy-tac.mjs";
import { chonCbTong, demModule, tongHopTu } from "./tu.mjs";

/**
 * @param {object} duAn — { info, panels, circuits } (xem doc-excel.mjs)
 * @param {object} [ghiDeQuyTac] — ghi đè thông số quy tắc
 * @returns {{ quyTac, tu: object[], canhBao: object[] }}
 */
export function tinhDuAn(duAn, ghiDeQuyTac = duAn.quyTac || {}) {
  const info = duAn.info || {};
  const rule = taoQuyTac({
    ...ghiDeQuyTac,
    ...(info.uf ? { uf: info.uf } : {}),
    ...(info.ud ? { ud: info.ud } : {}),
    ...(info.duMax ? { duMax: info.duMax } : {}),
  });
  const canhBao = [];
  const ghi = (muc, tu, mach, noiDung) => canhBao.push({ muc, tu: tu ?? "", mach: mach ?? "", noiDung });

  // --- Dựng cây tủ ---------------------------------------------------------
  const tuMap = new Map();
  for (const p of duAn.panels) {
    if (!p.ma) continue;
    if (tuMap.has(p.ma)) { ghi("loi", p.ma, "", "Trùng mã tủ"); continue; }
    tuMap.set(p.ma, { ...p, soPha: p.soPha === 1 ? 1 : 3, ten: p.ten || p.ma, ksNhap: p.ks ?? null, con: [], mach: [], cha: null });
  }
  for (const t of tuMap.values()) {
    if (t.capTu && tuMap.has(t.capTu)) {
      if (t.capTu === t.ma) { ghi("loi", t.ma, "", "Tủ tự cấp cho chính nó"); continue; }
      t.cha = t.capTu;
      tuMap.get(t.capTu).con.push(t.ma);
    }
  }
  const goc = [...tuMap.values()].filter((t) => !t.cha);
  if (!goc.length && tuMap.size) ghi("loi", "", "", "Không tìm thấy tủ gốc (cây tủ bị vòng)");

  const ksMacDinh = rule.ks[info.loaiCongTrinh] ?? rule.ks["Nhà ở / biệt thự"];

  // Ik tại từng tủ (dữ liệu nhập): tủ không ghi lấy theo tủ trên (an toàn), tủ gốc lấy Ik nguồn
  const ganIk = (t, ikCha) => {
    if (t.ik) { t.ikTinh = t.ik; t.ikNguon = "nhập"; }
    else if (ikCha != null) { t.ikTinh = ikCha; t.ikNguon = "theo tủ trên"; }
    else if (info.ikNguon) { t.ikTinh = info.ikNguon; t.ikNguon = "Ik nguồn"; }
    else { t.ikTinh = rule.ikMacDinh; t.ikNguon = "mặc định"; ghi("canhbao", t.ma, "", `Thiếu Ik — dùng mặc định ${rule.ikMacDinh} kA`); }
    for (const c of t.con) ganIk(tuMap.get(c), t.ikTinh);
  };
  for (const g of goc) ganIk(g, null);

  // --- Mạch nhập từ Excel ----------------------------------------------------
  for (const c of duAn.circuits) {
    const t = tuMap.get(c.tu);
    if (!t) { ghi("loi", c.tu, c.ma, "Mạch thuộc tủ không có trong sheet Tu dien"); continue; }
    t.mach.push(taoMach(c, t));
  }

  // --- Tính từ tủ lá lên tủ gốc --------------------------------------------
  const sauCung = [];
  const duyetSau = (t) => { for (const c of t.con) duyetSau(tuMap.get(c)); sauCung.push(t); };
  for (const g of goc) duyetSau(g);
  for (const t of sauCung) tinhTu(t);

  // --- Tính cáp từ tủ gốc xuống tủ lá ----------------------------------------
  for (const g of goc) {
    const cap = chonCapCap(g, g.cbTong.in, g.iMax, g.cosTb, g.lCap > 0 ? g.lCap : 0, 0);
    if (!(g.lCap > 0)) {
      cap.chuaCoL = true;
      ghi("ghichu", g.ma, "", "Tủ gốc không có chiều dài cáp cấp — cáp nguồn chọn theo Iz′, chưa kiểm sụt áp; sụt áp tính từ thanh cái tủ này");
    }
    g.capNguon = cap;
    g.ongNguon = cap.mang ? "MÁNG CÁP" : `ỐNG PVC  Ø ${cap.ong}`;
    tinhCapTu(g, cap.duCongDon);
  }

  // --- Thứ tự tờ vẽ: tủ gốc trước, rồi lần lượt tủ con -----------------------
  const thuTu = [];
  const duyetTruoc = (t) => { thuTu.push(t); for (const c of t.con) duyetTruoc(tuMap.get(c)); };
  for (const g of goc) duyetTruoc(g);

  kiemTra(thuTu, tuMap, rule, ghi);
  return { quyTac: rule, tu: thuTu, canhBao };

  // =========================================================================
  function taoMach(c, t) {
    const loai = rule.loaiMach[c.loai] ? c.loai : null;
    if (!loai) ghi("canhbao", t.ma, c.ma, `Loại mạch "${c.loai ?? ""}" không có trong danh mục — tạm tính như ổ cắm`);
    const kieu = rule.loaiMach[loai || "Ổ cắm thông thường"];
    const P = kieu.duPhong ? 0 : (c.soLuong || 1) * (c.congSuat || 0);
    const cos = c.cos || kieu.cos;
    const soPha = c.soPha === 3 ? 3 : 1;
    if (soPha === 3 && t.soPha === 1) ghi("loi", t.ma, c.ma, "Mạch 3 pha trong tủ 1 pha");
    const lThieu = !kieu.duPhong && !(c.L > 0);
    const L = c.L > 0 ? c.L : rule.lMacDinh;
    const pha = c.pha ? String(c.pha).trim().toUpperCase() : null;
    return {
      nguon: c, ma: c.ma || "", loai: loai || "Ổ cắm thông thường", kieu, phuTai: c.phuTai || "",
      khuVuc: c.khuVuc || "Khô", P, cos, soPha, va: P / cos, pha: pha && "ABC".includes(pha) ? pha : null,
      L, lThieu, Ib: dongLamViec(P, cos, soPha, rule), nhomOng: c.nhomOng || 1,
      nhomRcd: c.nhomRcd ? String(c.nhomRcd).trim() : null,
      ghiDe: { thietBi: c.ghiDeThietBi || null, cap: c.ghiDeCap || null, ong: c.ghiDeOng || null, lyDo: c.lyDo || null },
    };
  }

  function tinhTu(t) {
    // Mạch cấp tủ con (đã tính xong vì duyệt từ lá lên)
    for (const ma of t.con) {
      const con = tuMap.get(ma);
      const m = {
        ma: con.maLoCap || `C-${con.ma}`, loai: "Cấp tủ con", kieu: { cos: con.cosTb, sMin: 1.5 },
        phuTai: `CẤP ĐIỆN ${con.ten}`, khuVuc: "Khô", P: con.ptt * 1000, cos: con.cosTb,
        soPha: con.soPha, va: (con.ptt * 1000) / (con.cosTb || 0.9), L: con.lCap > 0 ? con.lCap : rule.lMacDinh,
        lThieu: !(con.lCap > 0), Ib: con.iMax, nhomOng: 1, nhomRcd: null, tuCon: con.ma,
        vaPha: con.soPha === 3 ? { A: con.iPha.A * rule.uf, B: con.iPha.B * rule.uf, C: con.iPha.C * rule.uf } : null,
        ghiDe: {}, laCapTuCon: true,
      };
      const i = con.datSauLo ? t.mach.findIndex((x) => x.ma === con.datSauLo) : -1;
      if (i >= 0) t.mach.splice(i + 1, 0, m); else t.mach.push(m);
    }

    // Cân pha
    if (t.soPha === 3) {
      // Cân theo đúng hệ số sẽ dùng khi tính dòng pha (tongHopTu): Kđt cho mạch cuối, hệ số đồng thời cho lộ cấp tủ con
      const kRieng = t.ksNhap ?? ksMacDinh;
      const kCon = t.ksNhap ?? heSoTuCon(t.con.length, rule);
      canPha(t.mach, (m) => (m.laCapTuCon ? kCon : kRieng));
    }
    else for (const m of t.mach) m.pha = "A";

    // Thiết bị bảo vệ từng mạch
    const ik = t.ikTinh;
    for (const m of t.mach) {
      m.rcdBatBuoc = !m.laCapTuCon && canRcd(m.loai, m.khuVuc, rule);
      if (m.laCapTuCon) {
        const con = tuMap.get(m.tuCon);
        const In = Math.max(con.cbTong.in, dinhMucToiThieu(rule.kIn * m.Ib, rule) ?? 0);
        const soCuc = con.soPha === 3 ? "3P" : "2P";
        m.thietBi = In <= rule.inMaxMcb && ik <= Math.max(...rule.icu.mach)
          ? { loai: "MCB", soCuc, in: In, curve: "C", icu: chonIcu(rule.icu.mach, ik), idn: null, module: rule.module[`MCB-${soCuc}`] }
          : { loai: "MCCB", soCuc, in: In, curve: "", icu: chonIcu(rule.icu.mccb, ik), idn: null, module: rule.module.MCCB };
        continue;
      }
      const ghiDe = m.ghiDe.thietBi ? docThietBi(m.ghiDe.thietBi, rule) : null;
      if (m.ghiDe.thietBi && !ghiDe) ghi("canhbao", t.ma, m.ma, `Không đọc được thiết bị ghi đè "${m.ghiDe.thietBi}" — dùng thiết bị tự chọn`);
      m.thietBi = ghiDe
        ? { ...ghiDe, icu: ghiDe.icu ?? chonIcu(rule.icu.mach, ik), ghiDe: true }
        : chonThietBi({ Ib: m.Ib, soPha: m.soPha, loai: m.loai, rcd: m.rcdBatBuoc, ik, trongNhom: !!m.nhomRcd }, rule);
    }

    // Nhóm chống dòng rò (ghi đè theo cách làm của mẫu: 1 RCBO cho nhiều mạch)
    const nhom = [];
    for (const ma of [...new Set(t.mach.map((m) => m.nhomRcd).filter(Boolean))]) {
      const tv = t.mach.filter((m) => m.nhomRcd === ma);
      const ib = tv.reduce((a, m) => a + m.Ib, 0);
      const In = Math.max(dinhMucToiThieu(rule.kIn * ib, rule) ?? 0, ...tv.map((m) => m.thietBi.in));
      const ba = tv.some((m) => m.soPha === 3);
      const soCuc = ba ? "3P+N" : "1P+N";
      let thietBi = { loai: "RCBO", soCuc, in: In, curve: "C", icu: chonIcu(rule.icu.mach, ik), idn: 30, module: rule.module[`RCBO-${soCuc}`] };
      // Ghi đè thiết bị nhóm ở tủ: t.ghiDeNhomRcd = { RC1: { thietBi: "RCBO 1P+N 40A 30mA", lyDo } }
      const gdn = (t.ghiDeNhomRcd || {})[ma];
      if (gdn?.thietBi) {
        const tb = docThietBi(gdn.thietBi, rule);
        if (!tb) ghi("canhbao", t.ma, ma, `Không đọc được thiết bị ghi đè nhóm "${gdn.thietBi}" — dùng thiết bị tự chọn`);
        else {
          thietBi = { ...tb, icu: tb.icu ?? chonIcu(rule.icu.mach, ik), ghiDe: true };
          const ks = t.ksNhap ?? ksMacDinh;
          const ibKs = ib * ks;
          ghi(ibKs > tb.in + 1e-9 ? "loi" : "canhbao", t.ma, ma,
            `RCBO nhóm ${ma} ghi đè ${tb.in}A (tự chọn ${In}A): ΣIb = ${ib.toFixed(1)} A, ΣIb×Kđt(${ks}) = ${ibKs.toFixed(1)} A` +
            `${ib > tb.in ? " — ΣIb vượt In, dựa vào hệ số đồng thời" : ""}. Lý do: ${gdn.lyDo || "chưa ghi lý do"}`);
          const lon = tv.filter((m) => m.thietBi.in > tb.in);
          if (lon.length) ghi("loi", t.ma, lon.map((m) => m.ma).join(", "), `MCB trong nhóm ${ma} lớn hơn RCBO nhóm ${tb.in}A`);
        }
      }
      nhom.push({ ma, mach: tv.map((m) => m.ma), thietBi });
      const lyDo = tv.map((m) => m.ghiDe.lyDo).find(Boolean);
      ghi("canhbao", t.ma, tv.map((m) => m.ma).join(", "),
        `Nhóm RCD ${ma}: dùng chung 1 RCBO ${thietBi.in}A 30mA cho ${tv.length} mạch — quy tắc yêu cầu RCBO riêng cho từng mạch ổ cắm/khu ướt/ngoài nhà.${lyDo ? ` Lý do: ${lyDo}` : " Chưa ghi lý do."}`);
    }
    t.nhomRcd = nhom;

    // Tổng hợp tủ, CB tổng, vỏ tủ
    Object.assign(t, tongHopTu(t, t.mach, rule, ksMacDinh));
    t.laGoc = !t.cha;
    t.cbTong = chonCbTong(t, t, t.mach, rule, { laGoc: t.laGoc, ik });
    // Ghi đè CB tổng ở tủ: t.ghiDeCbTong = { thietBi: "MCB 4P 63A C", lyDo }
    if (t.ghiDeCbTong?.thietBi) {
      const tb = docThietBi(t.ghiDeCbTong.thietBi, rule);
      if (!tb) ghi("canhbao", t.ma, "", `Không đọc được CB tổng ghi đè "${t.ghiDeCbTong.thietBi}" — dùng CB tự chọn`);
      else {
        const tuChon = t.cbTong;
        const dsIcu = tb.loai === "MCCB" ? rule.icu.mccb : rule.icu.tongMcb;
        t.cbTong = { ...tb, icu: tb.icu ?? chonIcu(dsIcu, ik), maxRa: tuChon.maxRa, ghiDe: true };
        ghi("canhbao", t.ma, "", `CB tổng ghi đè ${tb.loai} ${tb.soCuc} ${tb.in}A (tự chọn ${tuChon.loai} ${tuChon.in}A). Lý do: ${t.ghiDeCbTong.lyDo || "chưa ghi lý do"}`);
      }
    }
    t.coSpd = t.spd === "Có" || (t.spd !== "Không" && t.laGoc && rule.spdTuGoc);
    t.module = demModule(t, t.mach, nhom, t.cbTong, rule, { coSpd: t.coSpd });
  }

  function chonCapCap(con, In, Ib, cos, L, duTruoc) {
    let pp = con.phuongPhap ? String(con.phuongPhap).trim().toUpperCase() : "B1";
    if (!rule.iz.XLPE[pp]) {
      ghi("canhbao", con.ma, "", `Không có bảng Iz cho phương pháp lắp đặt "${con.phuongPhap}" — tính theo B1`);
      pp = "B1";
    }
    const cap = chonCap({
      In, Ib, cos, L, soPha: con.soPha, duTruoc, gioiHan: rule.duThanhCai, sMin: 1.5,
      cachDien: "XLPE", phuongPhap: pp, nhom: 1,
    }, rule);
    const mang = /máng/i.test(con.kieuDi || "");
    return { ...cap, kieu: "nhieuLoi", soLoi: con.soPha === 3 ? 4 : 2, ong: mang ? null : chonOng({ capNhieuLoi: [cap.s], dayDon: [cap.pe] }, rule), mang };
  }

  function tinhCapTu(t, duBus) {
    t.duBus = duBus;
    for (const m of t.mach) {
      if (m.laCapTuCon) {
        const con = tuMap.get(m.tuCon);
        m.cap = chonCapCap(con, m.thietBi.in, m.Ib, m.cos, m.L, duBus);
        m.ong = m.cap.mang ? "MÁNG CÁP" : `ỐNG PVC  Ø ${m.cap.ong}`;
        con.capNguon = m.cap;
        con.ongNguon = m.ong;
        if (con.soPha === 1) for (const x of con.mach) x.pha = m.pha;
        tinhCapTu(con, m.cap.duCongDon);
        continue;
      }
      if (m.kieu.duPhong && !m.ghiDe.cap) { m.cap = null; m.ong = m.ghiDe.ong || ""; continue; }
      const gioiHan = m.kieu.chieuSang ? rule.duChieuSang : rule.duMax;
      const o = { In: m.thietBi.in, Ib: m.Ib, cos: m.cos, L: m.L, soPha: m.soPha, duTruoc: duBus, gioiHan, sMin: m.kieu.sMin, cachDien: "PVC", phuongPhap: "B1", nhom: m.nhomOng };
      if (m.ghiDe.cap) {
        const s = docTietDien(m.ghiDe.cap);
        m.cap = s ? { ...kiemCap(s, o, rule), ghiDe: true } : { s: null, ghiDe: true, khongDoc: true, duCongDon: duBus };
      } else {
        m.cap = chonCap(o, rule);
      }
      m.cap.gioiHan = gioiHan;
      m.cap.kieu = "don";
      m.cap.soDay = m.soPha === 3 ? (m.kieu.dongCo ? 3 : 4) : 2;
      if (m.ghiDe.ong) m.ong = m.ghiDe.ong;
      else if (m.cap.s) m.ong = `ỐNG PVC  Ø ${chonOng({ dayDon: [...Array(m.cap.soDay).fill(m.cap.s), m.cap.pe] }, rule)}`;
      else m.ong = "";
    }
  }
}
