// Bộ kiểm tra tự động (mục 6.8): lỗi chặn phát hành / cảnh báo / ghi chú.
// Mỗi mục được ghi vào danh sách chung của dự án và gắn vào mạch hoặc tủ liên quan (thuộc tính `kiemTra`).

import { dinhMucToiThieu } from "./quy-tac.mjs";

const so = (x, d = 1) => (x == null || Number.isNaN(x) ? "?" : Number(x).toFixed(d).replace(".", ","));
const laRcd = (tb) => tb && (tb.loai === "RCBO" || tb.loai === "RCCB" || tb.idn);

/**
 * @param {object[]} thuTu — các tủ theo thứ tự tờ vẽ (đã tính xong)
 * @param {Map} tuMap
 * @param {object} rule
 * @param {(muc, tu, mach, noiDung) => void} ghi
 */
export function kiemTra(thuTu, tuMap, rule, ghi) {
  const bao = (muc, t, m, noiDung) => {
    ghi(muc, t?.ma, m?.ma, noiDung);
    const dich = m || t;
    if (dich) (dich.kiemTra ||= []).push({ muc, noiDung });
  };

  if (rule.trangThai && rule.trangThai !== "ĐÃ DUYỆT") {
    ghi("ghichu", "", "", `Bộ quy tắc ${rule.trangThai} (phiên bản ${rule.phienBan}) — kỹ sư điện cần kiểm tra trước khi phát hành`);
  }

  for (const t of thuTu) {
    const ik = t.ikTinh;

    // --- Từng mạch ---------------------------------------------------------
    for (const m of t.mach) {
      const tb = m.thietBi;
      const duPhong = m.kieu?.duPhong;
      if (tb) {
        if (m.Ib > tb.in + 1e-9) bao("loi", t, m, `Ib = ${so(m.Ib)} A lớn hơn In = ${tb.in} A`);
        if (tb.icu != null && tb.icu + 1e-9 < ik) bao("loi", t, m, `Icu = ${tb.icu} kA nhỏ hơn Ik tại tủ = ${so(ik)} kA`);
        if (!duPhong && m.Ib > (rule.ibIn / 100) * tb.in + 1e-9) {
          bao("canhbao", t, m, `Ib/In = ${so((m.Ib / tb.in) * 100, 0)}% (> ${rule.ibIn}%) — CB làm việc sát định mức`);
        }
      }

      if (m.laCapTuCon) {
        const con = tuMap.get(m.tuCon);
        if (tb && con?.cbTong && tb.in + 1e-9 < con.cbTong.in) {
          bao("loi", t, m, `CB cấp ${con.ma} (${tb.in} A) nhỏ hơn CB tổng của ${con.ma} (${con.cbTong.in} A)`);
        }
      } else if (m.rcdBatBuoc && !laRcd(tb) && !m.nhomRcd) {
        const vi = rule.khuVucRcd.includes(m.khuVuc) ? `khu vực "${m.khuVuc}"` : `loại mạch "${m.loai}"`;
        bao("loi", t, m, `Thiếu RCD 30 mA — bắt buộc với ${vi} (IEC 60364-4-41 / 60364-7-701)`);
      }

      // Cáp
      const cap = m.cap;
      if (cap) {
        if (cap.khongDoc) {
          bao("canhbao", t, m, `Không đọc được tiết diện từ cáp ghi đè "${m.ghiDe?.cap}" — chưa kiểm tra Iz′ và sụt áp`);
        } else if (cap.s) {
          if (cap.izp == null) bao("canhbao", t, m, `Tiết diện ${so(cap.s, 1)} mm² không có trong bảng Iz — chưa kiểm tra dòng cho phép`);
          else if (tb && tb.in > cap.izp + 1e-9) bao("loi", t, m, `In = ${tb.in} A lớn hơn Iz′ = ${so(cap.izp)} A của cáp ${so(cap.s, 1)} mm²`);
          const gioiHan = cap.gioiHan ?? rule.duMax;
          if (cap.duCongDon > gioiHan + 1e-9) {
            bao("loi", t, m, `Sụt áp cộng dồn ${so(cap.duCongDon, 2)}% vượt giới hạn ${so(gioiHan, 0)}%`);
          }
          const sMin = m.kieu?.sMin ?? 1.5;
          if (cap.s + 1e-9 < sMin) bao("loi", t, m, `Tiết diện ${so(cap.s, 1)} mm² nhỏ hơn tối thiểu ${so(sMin, 1)} mm² của loại mạch`);
        }
      }
      if (!duPhong && m.L > rule.lCanhBao) bao("canhbao", t, m, `Mạch dài ${so(m.L, 0)} m (> ${rule.lCanhBao} m) — kiểm tra lại sụt áp và Ik cuối đường dây`);
      if (m.lThieu) bao("canhbao", t, m, `Thiếu chiều dài — đang dùng mặc định ${rule.lMacDinh} m`);

      // Ghi đè
      const gd = m.ghiDe || {};
      const daGhiDe = [gd.thietBi && `thiết bị "${gd.thietBi}"`, gd.cap && `cáp "${gd.cap}"`, gd.ong && `ống "${gd.ong}"`].filter(Boolean);
      if (daGhiDe.length) {
        if (gd.lyDo) bao("ghichu", t, m, `Ghi đè ${daGhiDe.join(", ")}. Lý do: ${gd.lyDo}`);
        else bao("canhbao", t, m, `Ghi đè ${daGhiDe.join(", ")} nhưng chưa ghi lý do`);
      }
    }

    // --- Nhóm RCD --------------------------------------------------------
    for (const g of t.nhomRcd || []) {
      if (g.thietBi.icu + 1e-9 < ik) bao("loi", t, { ma: g.ma }, `RCBO nhóm ${g.ma}: Icu = ${g.thietBi.icu} kA nhỏ hơn Ik = ${so(ik)} kA`);
    }

    // --- Tủ ------------------------------------------------------------------
    const cb = t.cbTong;
    if (cb) {
      if (cb.icu + 1e-9 < ik) bao("loi", t, null, `CB tổng: Icu = ${cb.icu} kA nhỏ hơn Ik = ${so(ik)} kA`);
      if (t.iMax > cb.in + 1e-9) bao("loi", t, null, `Dòng pha lớn nhất ${so(t.iMax)} A lớn hơn In CB tổng ${cb.in} A`);
      const inTheoTai = dinhMucToiThieu(rule.kIn * t.iMax, rule);
      const maxRa = cb.maxRa || 0;
      if (cb.in + 1e-9 < rule.kChonLoc * maxRa) {
        bao("canhbao", t, null, `In tổng ${cb.in} A < ${rule.kChonLoc} × In mạch ra lớn nhất (${maxRa} A) — rủi ro mất chọn lọc`);
      } else if (inTheoTai != null && cb.in > inTheoTai) {
        bao("canhbao", t, null, `CB tổng được nâng từ ${inTheoTai} A lên ${cb.in} A để giữ tỷ số chọn lọc ${so(rule.kChonLoc, 1)} với mạch ra ${maxRa} A — kỹ sư xác nhận theo bảng phối hợp của hãng`);
      }
      if (cb.in >= 63) bao("ghichu", t, null, `In tổng ${cb.in} A ≥ 63 A — theo quy tắc cần đồng hồ đa năng + CT (chưa vẽ trên sơ đồ)`);
    }
    if (t.soPha === 3 && t.lechPha > rule.lechPha + 1e-9) {
      bao("canhbao", t, null, `Lệch pha ${so(t.lechPha)}% (> ${rule.lechPha}%) — I pha A/B/C = ${so(t.iPha.A)}/${so(t.iPha.B)}/${so(t.iPha.C)} A; nên đổi pha một số mạch`);
    }
    if (t.module) {
      const coMccb = cb?.loai === "MCCB" || t.mach.some((m) => m.thietBi?.loai === "MCCB");
      if (coMccb) bao("ghichu", t, null, "Tủ có MCCB — chọn tủ sắt theo mẫu bố trí (MCCB không tính vào số module)");
      if (t.module.voTu == null) {
        bao("canhbao", t, null, `Cần ${so(t.module.can, 1)} module (đã gồm ${rule.duPhongVo}% dự phòng) — vượt vỏ lớn nhất ${rule.voTu.at(-1)} module`);
      }
    }
    const soDuPhong = t.mach.filter((m) => m.kieu?.duPhong).length;
    if (soDuPhong < rule.cbDuPhong) bao("ghichu", t, null, `Tủ có ${soDuPhong} CB dự phòng (quy tắc ≥ ${rule.cbDuPhong})`);
    if (t.coSpd) bao("ghichu", t, null, "SPD loại 2 đã tính vào số module nhưng chưa vẽ trên sơ đồ (template chưa có ký hiệu SPD)");
    if (t.ksNhap == null) {
      const coRieng = t.mach.some((m) => !m.laCapTuCon && !m.kieu?.duPhong);
      const phan = [];
      if (coRieng) phan.push(`Kđt mạch cuối = ${so(t.ksRieng, 2)} theo hồ sơ quy tắc`);
      if (t.ksCon != null) phan.push(`hệ số đồng thời ${t.soCon} tủ con = ${so(t.ksCon, 2)}`);
      if (phan.length) bao("ghichu", t, null, `${phan.join("; ")} — chưa chốt`);
    }

    // Cáp cấp tủ gốc (nếu có chiều dài)
    if (!t.cha && t.capNguon && cb) {
      const c = t.capNguon;
      if (c.izp != null && cb.in > c.izp + 1e-9) bao("loi", t, null, `Cáp cấp: In tổng ${cb.in} A lớn hơn Iz′ = ${so(c.izp)} A`);
      if (c.duCongDon > rule.duMax + 1e-9) bao("loi", t, null, `Cáp cấp: sụt áp ${so(c.duCongDon, 2)}% vượt giới hạn ${rule.duMax}%`);
    }
  }
}
