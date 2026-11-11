// Điện nhẹ đợt 1 (mục 8 của phương án): mạng LAN / Wi-Fi, camera (CCTV) và tủ rack.
//
// Đầu vào duAn.dienNhe = {
//   phong: [{ tang, phong, data, ap, camTrong, camNgoai, rack, L, …(tv, acs, chuong…, loa, knx: giữ, chưa tính) }],
//   rack:  [{ ma, tang, viTri, capTu, maMach, lNguon, lTruc, trungTam }]   — thiếu thì tự dựng từ cột "rack" của phòng
// }
// Mỗi rack: liên kết ngang (mã cổng TIA-606 <Tầng rack>-<Rack>-PP<n>-<cổng>), switch thường cho ổ data, switch PoE cho
// AP + camera (ngân sách PoE), patch panel, thanh quản lý cáp; rack trung tâm thêm router, kệ modem ISP, switch lõi
// (khi có nhiều switch / nhiều rack), NVR + ổ cứng. Cộng U → chọn cỡ tủ; cộng W → chọn UPS; nguồn cho rack tự thêm
// thành một mạch trong tủ điện cấp (tham chiếu chéo hai bên). Trục giữa các rack: Cat6 nếu ≤ 90 m, dài hơn dùng quang.
//
// Thiết bị ghi theo chủng loại (chưa gắn hãng); mã hàng, đơn giá điền ở sheet Bang gia của BOQ.

import { chuCap, khungTen, soBanVe } from "./sang-ban-ve.mjs";
import { tb as chuTb } from "./dien-giai.mjs";

const n0 = (x) => (Number.isFinite(+x) && +x > 0 ? Math.round(+x) : 0);
const tron10 = (x) => Math.ceil(x / 10 - 1e-9) * 10;
const pad2 = (i) => String(i).padStart(2, "0");
const so = (x, d = 1) => Number(x).toFixed(d).replace(".", ",");
const LOAI_LK = [["data", "DATA", "Ổ data"], ["ap", "AP", "AP Wi-Fi"], ["camTrong", "CAM", "Camera trong nhà"], ["camNgoai", "CAM", "Camera ngoài trời"]];
/** Các cột của bảng phòng thuộc hệ đợt sau (đọc và giữ, chưa tính) */
export const CHUA_TINH = [["tv", "ổ TV"], ["acs", "cửa ACS"], ["chuongNgoai", "nút gọi chuông cửa"], ["chuongTrong", "màn hình chuông cửa"], ["loa", "loa"], ["knx", "thiết bị KNX"]];

/** Có dữ liệu LAN / camera không */
export const coDienNhe = (dn) => (dn?.phong || []).some((p) => LOAI_LK.some(([k]) => n0(p[k]) > 0));

/** Số cổng cần (kèm dự phòng) → các switch. Một model đủ thì lấy model nhỏ nhất; không thì ghép nhiều switch cỡ lớn nhất. */
function chonSwitch(n, R, poeCan = 0) {
  if (!n) return [];
  const can = Math.ceil(n * (1 + R.duPhongCong / 100) - 1e-9);
  if (poeCan > 0 || poeCan === -1) {
    const ds = R.switchPoe;
    const m = ds.find(([c, poe]) => c >= can && poe >= poeCan);
    if (m) return [{ loai: "poe", cong: m[0], poe: m[1], w: m[2] }];
    const [c, poe, w] = ds.at(-1);
    const k = Math.max(Math.ceil(can / c), Math.ceil(poeCan / poe));
    return Array.from({ length: k }, () => ({ loai: "poe", cong: c, poe, w }));
  }
  const ds = R.switchThuong;
  const m = ds.find(([c]) => c >= can);
  if (m) return [{ loai: "thuong", cong: m[0], poe: 0, w: m[1] }];
  const [c, w] = ds.at(-1);
  return Array.from({ length: Math.ceil(can / c) }, () => ({ loai: "thuong", cong: c, poe: 0, w }));
}
export const tenSwitch = (s) => (s.loai === "poe" ? `Switch PoE ${s.cong} cổng (ngân sách PoE ${s.poe} W)` : s.loai === "loi" ? `Switch lõi ${s.cong} cổng` : `Switch ${s.cong} cổng`);

/**
 * @param {object} dn — duAn.dienNhe
 * @param {object} rule — bộ quy tắc (taoQuyTac) — dùng rule.dienNhe, rule.lMacDinh
 * @param {{ panels?: object[], circuits?: object[] }} o — dữ liệu tủ điện để gắn mạch nguồn cho rack
 * @returns {{ rack: object[], lienKet: object[], tong: object, nvr: object|null, machThem: object[], canhBao: object[], chuaTinh: object }}
 */
export function tinhDienNhe(dn, rule, { panels = [], circuits = [] } = {}) {
  const R = rule.dienNhe;
  const canhBao = [];
  const ghi = (muc, rack, phong, noiDung) => canhBao.push({ muc, tu: rack ?? "", mach: phong ?? "", noiDung, dienNhe: true });

  const phong = (dn?.phong || []).filter((p) => p && (p.phong || p.tang));
  // --- Rack: khai báo + tự dựng từ cột "rack" của phòng ---------------------------------------------
  const rackMap = new Map();
  for (const r of dn?.rack || []) if (r?.ma) rackMap.set(String(r.ma).trim(), { ...r, ma: String(r.ma).trim() });
  const rackMacDinh = rackMap.keys().next().value || "R1";
  for (const p of phong) {
    p.rack = String(p.rack || rackMacDinh).trim();
    if (!rackMap.has(p.rack)) {
      rackMap.set(p.rack, { ma: p.rack, tang: p.tang, tuDong: true });
      ghi("canhbao", p.rack, "", `Rack ${p.rack} chưa khai ở sheet "Tu rack" — tạm đặt ở tầng ${p.tang ?? "?"}, cấp nguồn từ tủ gốc`);
    }
  }
  const racks = [...rackMap.values()];
  if (!racks.length) return { rack: [], lienKet: [], tong: { data: 0, ap: 0, cam: 0, lienKet: 0 }, nvr: null, machThem: [], canhBao, chuaTinh: {} };
  const tt = racks.find((r) => r.trungTam === true || /^(có|x|1|✔|yes|trung tâm)/i.test(String(r.trungTam ?? ""))) || racks[0];
  for (const r of racks) r.laTrungTam = r === tt;

  // --- Liên kết ngang từng rack, đánh số cổng ------------------------------------------------------
  const lienKet = [];
  const dem = { DATA: 0, AP: 0, CAM: 0 };
  const thieuL = new Map();
  for (const r of racks) {
    r.lienKet = [];
    for (const p of phong.filter((x) => x.rack === r.ma)) {
      const L = p.L > 0 ? p.L : R.lMacDinh;
      if (!(p.L > 0) && LOAI_LK.some(([k]) => n0(p[k]))) (thieuL.get(r.ma) || thieuL.set(r.ma, []).get(r.ma)).push(p.phong || p.tang);
      if (L > R.cat6Max) ghi("canhbao", r.ma, p.phong, `Cáp Cat6 tới ${p.tang ? `${p.tang} – ` : ""}${p.phong} dài ${so(L, 0)} m > ${R.cat6Max} m (link cố định TIA-568) — đặt thêm rack/switch tầng gần hơn hoặc dùng cáp quang`);
      for (const [k, loai, moTa] of LOAI_LK) {
        for (let i = 0; i < n0(p[k]); i++) {
          dem[loai]++;
          const lk = { rack: r.ma, tang: p.tang ?? "", phong: p.phong ?? "", loai, moTa, ngoaiTroi: k === "camNgoai", L, thietBi: loai === "DATA" ? "" : `${loai}-${pad2(dem[loai])}` };
          r.lienKet.push(lk);
          lienKet.push(lk);
        }
      }
    }
    r.lienKet.forEach((lk, i) => {
      lk.pp = Math.floor(i / R.ppCong) + 1;
      lk.cong = (i % R.ppCong) + 1;
      lk.ma = `${r.tang ?? ""}-${r.ma}-PP${lk.pp}-${pad2(lk.cong)}`.replace(/^-/, "");
    });
  }
  for (const [ma, ds] of thieuL) ghi("ghichu", ma, "", `Chưa có chiều dài cáp ngang (${ds.join(", ")}) — tạm tính ${R.lMacDinh} m/link cho BOQ`);

  // --- NVR (đặt ở rack trung tâm) --------------------------------------------------------------------
  let nvr = null;
  if (dem.CAM) {
    const kenhCan = Math.ceil(dem.CAM * (1 + R.duPhongCong / 100) - 1e-9);
    const tb = (dem.CAM * R.bitrate * 86400 * R.ngayLuu) / 8 / 1e6;          // TB (Mb → TB)
    const soHdd = Math.max(1, Math.ceil(tb / R.hddTB - 1e-9));
    const m = R.nvr.find(([k, khay]) => k >= kenhCan && khay >= soHdd) || R.nvr.find(([k]) => k >= kenhCan) || R.nvr.at(-1);
    nvr = { kenh: m[0], khay: m[1], u: m[2], soCam: dem.CAM, tb, soHdd, hddTB: R.hddTB, w: R.congSuat.nvr + R.congSuat.hdd * soHdd, rack: tt.ma };
    if (m[0] < kenhCan) ghi("canhbao", tt.ma, "", `${dem.CAM} camera vượt NVR lớn nhất ${m[0]} kênh — dùng nhiều NVR`);
    if (soHdd > m[1]) ghi("canhbao", tt.ma, "", `Cần ${soHdd} ổ ${R.hddTB} TB (${so(tb)} TB) nhưng NVR ${m[0]} kênh chỉ có ${m[1]} khay — chọn ổ dung lượng lớn hơn hoặc giảm số ngày lưu`);
  }

  // --- Thiết bị từng rack ---------------------------------------------------------------------------
  const soSwitchTruyCap = [];
  for (const r of racks) {
    const nData = r.lienKet.filter((x) => x.loai === "DATA").length;
    const nAp = r.lienKet.filter((x) => x.loai === "AP").length;
    const nCam = r.lienKet.filter((x) => x.loai === "CAM").length;
    const poeTai = nAp * R.poeAp + nCam * R.poeCam;
    r.dem = { data: nData, ap: nAp, cam: nCam, lienKet: r.lienKet.length };
    r.poe = { tai: poeTai, can: poeTai * R.kPoe };
    r.switch = [...chonSwitch(nData, R), ...chonSwitch(nAp + nCam, R, nAp + nCam ? Math.max(r.poe.can, 1e-9) : 0)];
    r.poe.nganSach = r.switch.reduce((a, s) => a + s.poe, 0);
    r.soPP = Math.ceil(r.lienKet.length / R.ppCong);
    soSwitchTruyCap.push(r.switch.length);
  }
  const tongSwitch = soSwitchTruyCap.reduce((a, b) => a + b, 0);
  for (const r of racks) {
    const tb = [];   // từ trên xuống: [ten, u, w, loai]
    for (let i = 1; i <= r.soPP; i++) {
      tb.push({ ten: `Patch panel Cat6 ${R.ppCong} cổng (PP${i})`, u: 1, w: 0, loai: "pp" });
      tb.push({ ten: "Thanh quản lý cáp", u: 1, w: 0, loai: "quanLy" });
    }
    for (const s of r.switch) tb.push({ ten: tenSwitch(s), u: 1, w: s.w, loai: s.loai === "poe" ? "switchPoe" : "switch", sw: s });
    if (r.laTrungTam) {
      if (tongSwitch > 1 || racks.length > 1) {
        const can = Math.ceil((tongSwitch + (nvr ? 1 : 0) + 1) * (1 + R.duPhongCong / 100) - 1e-9);
        const m = R.switchThuong.find(([c]) => c >= can) || R.switchThuong.at(-1);
        r.switchLoi = { loai: "loi", cong: m[0], poe: 0, w: m[1] };
        tb.push({ ten: tenSwitch(r.switchLoi), u: 1, w: m[1], loai: "switchLoi", sw: r.switchLoi });
      }
      tb.push({ ten: "Router / tường lửa", u: 1, w: R.congSuat.router, loai: "router" });
      tb.push({ ten: "Kệ đặt modem ISP", u: 1, w: R.congSuat.modem, loai: "ke" });
      if (nvr) tb.push({ ten: `Đầu ghi NVR ${nvr.kenh} kênh + ${nvr.soHdd} ổ ${nvr.hddTB} TB`, u: nvr.u, w: nvr.w, loai: "nvr" });
    }
    tb.push({ ten: "Thanh nguồn PDU", u: 1, w: 0, loai: "pdu" });
    r.w = tb.reduce((a, x) => a + x.w, 0) + r.poe.tai;
    const va = (r.w / R.pfUps) * R.kUps;
    r.ups = { va: R.upsVA.find((x) => x >= va - 1e-9) ?? R.upsVA.at(-1), vaCan: va, u: 2 };
    if (va > R.upsVA.at(-1)) ghi("canhbao", r.ma, "", `UPS cần ${Math.ceil(va)} VA, lớn hơn cỡ ${R.upsVA.at(-1)} VA — chia tải hoặc dùng UPS ngoài tủ`);
    tb.push({ ten: `UPS ${r.ups.va} VA (online, rack-mount)`, u: 2, w: 0, loai: "ups" });
    r.thietBi = tb;
    r.uTong = tb.reduce((a, x) => a + x.u, 0);
    r.uCan = r.uTong * R.kRack;
    r.uRack = R.rackU.find((u) => u >= r.uCan - 1e-9) ?? R.rackU.at(-1);
    r.kieuRack = r.uRack <= R.rackTreoMax ? "treo tường" : "đứng";
    if (r.uCan > R.rackU.at(-1)) ghi("canhbao", r.ma, "", `Cần ${Math.ceil(r.uCan)}U, vượt tủ ${R.rackU.at(-1)}U — tách thành 2 tủ`);
    if (r.poe.can > r.poe.nganSach + 1e-9) ghi("loi", r.ma, "", `Ngân sách PoE ${r.poe.nganSach} W < cần ${Math.ceil(r.poe.can)} W`);

    // Trục về rack trung tâm
    if (!r.laTrungTam) {
      const L = r.lTruc > 0 ? r.lTruc : null;
      r.truc = !L || L <= R.cat6Max
        ? { loai: "cat6", moTa: "2 × Cat6 (1 dùng + 1 dự phòng)", L }
        : { loai: "quang", moTa: "Cáp quang single-mode 4 lõi + 2 module SFP", L };
      if (!L) ghi("canhbao", r.ma, "", `Chưa có chiều dài trục từ rack ${r.ma} về rack trung tâm ${tt.ma} — tạm dùng Cat6, kiểm lại ≤ ${R.cat6Max} m`);
    }
  }

  // --- Nguồn cho rack: mạch trong tủ điện ------------------------------------------------------------
  const goc = panels.find((p) => !p.capTu || !panels.some((x) => x.ma === p.capTu)) || panels[0];
  const machThem = [];
  for (const r of racks) {
    const tu = r.capTu && panels.some((p) => p.ma === r.capTu) ? r.capTu : goc?.ma;
    if (r.capTu && tu !== r.capTu) ghi("canhbao", r.ma, "", `Tủ cấp nguồn "${r.capTu}" không có trong danh sách tủ — dùng tủ ${tu}`);
    else if (!r.capTu && !r.tuDong && tu) ghi("ghichu", r.ma, "", `Rack ${r.ma} chưa khai tủ cấp nguồn — dùng tủ gốc ${tu}`);
    const P = tron10(r.w * R.kUps);
    if (!tu) { r.nguon = null; continue; }
    const coSan = r.maMach ? circuits.find((c) => c.tu === tu && c.ma === r.maMach) : null;
    if (coSan) {
      r.nguon = { tu, ma: coSan.ma, P, coSan: true };
      const pCo = (coSan.soLuong || 1) * (coSan.congSuat || 0);
      if (pCo < P) ghi("canhbao", r.ma, "", `Mạch ${tu}/${coSan.ma} cấp rack ${r.ma} có ${pCo} W < cần ${P} W (tải ${Math.round(r.w)} W × ${R.kUps})`);
      continue;
    }
    if (r.maMach) ghi("canhbao", r.ma, "", `Không thấy mạch ${tu}/${r.maMach} — tự thêm mạch nguồn cho rack`);
    const daDung = new Set([...circuits, ...machThem].filter((c) => c.tu === tu).map((c) => c.ma));
    let k = 1;
    while (daDung.has(`DN${k}`)) k++;
    const ma = `DN${k}`;
    machThem.push({
      tu, ma, loai: "Thiết bị điện nhẹ (rack, NVR, KNX)", phuTai: `CẤP NGUỒN TỦ RACK ${r.ma}`, khuVuc: "Khô",
      soLuong: 1, congSuat: P, soPha: 1, L: r.lNguon > 0 ? r.lNguon : undefined,
      ghiChu: `tự thêm từ điện nhẹ: tải rack ${Math.round(r.w)} W × ${R.kUps} (UPS sạc + dự phòng)`, tuDienNhe: r.ma,
    });
    r.nguon = { tu, ma, P, coSan: false };
  }

  // Các hệ đợt sau: chỉ đếm để báo
  const chuaTinh = Object.fromEntries(CHUA_TINH.map(([k]) => [k, phong.reduce((a, p) => a + n0(p[k]), 0)]).filter(([, v]) => v > 0));
  if (Object.keys(chuaTinh).length) {
    ghi("ghichu", "", "", `Bảng điện nhẹ có ${CHUA_TINH.filter(([k]) => chuaTinh[k]).map(([k, t]) => `${chuaTinh[k]} ${t}`).join(", ")} — các hệ này làm ở đợt sau (chưa có trong sơ đồ và BOQ)`);
  }

  const tong = { data: dem.DATA, ap: dem.AP, cam: dem.CAM, lienKet: lienKet.length };
  return { rack: racks, lienKet, tong, nvr, machThem, canhBao, chuaTinh, trungTam: tt.ma, phong };
}

// =====================================================================================================
// Kết quả → dữ liệu các tờ vẽ E.7xx (template/dien-nhe.mjs): E.700 sơ đồ trục, E.701 nguyên lý mạng & camera,
// E.702… mặt đứng từng tủ rack. Số tờ đầu: info.soBanVeDienNhe (mặc định E.700).
// =====================================================================================================

const hoa = (s) => String(s ?? "").toLocaleUpperCase("vi");
const soTang = (t) => {
  const m = String(t ?? "").match(/(\d+)/);
  if (!m) return /mái|thượng/i.test(String(t)) ? 999 : -999;
  return /^\s*(b|h)/i.test(String(t)) ? -Number(m[1]) : Number(m[1]);
};

/** Mạch nguồn của rack sau khi tinhDuAn đã chọn thiết bị, cáp */
function machNguon(r, kq) {
  if (!r.nguon) return null;
  const m = kq?.tu.find((t) => t.ma === r.nguon.tu)?.mach.find((x) => x.ma === r.nguon.ma);
  return m ? { tu: r.nguon.tu, ma: m.ma, thietBi: chuTb(m.thietBi), cap: chuCap(m.cap, { soPha: m.soPha }), P: m.P } : { tu: r.nguon.tu, ma: r.nguon.ma };
}

/**
 * @returns {{ to: object[], soTheoRack: Map<string,string> }} to: [{ loai: "dn", ma, ten, du }]
 */
export function sangDienNhe(dn, kq, info = {}) {
  const R = kq.quyTac.dienNhe;
  const dau = info.soBanVeDienNhe || "E.700";
  const so = (i) => soBanVe(dau, i);
  const soTruc = so(0), soMang = so(1);
  const soTheoRack = new Map(dn.rack.map((r, i) => [r.ma, so(2 + i)]));
  const nguonText = (r) => {
    const n = machNguon(r, kq);
    return n ? `${n.tu} / ${n.ma}` : "—";
  };
  // Tầng: từ trên xuống
  const tang = [...new Set([...dn.phong.map((p) => p.tang), ...dn.rack.map((r) => r.tang)].filter(Boolean))]
    .sort((a, b) => soTang(b) - soTang(a));
  const demPhong = (p) => ({ data: n0(p.data), ap: n0(p.ap), cam: n0(p.camTrong) + n0(p.camNgoai) });
  const nhanh = [];
  for (const r of dn.rack) {
    for (const t of tang) {
      const ps = dn.phong.filter((p) => p.rack === r.ma && p.tang === t).map((p) => ({ ten: p.phong || "", ...demPhong(p) })).filter((p) => p.data + p.ap + p.cam);
      if (!ps.length) continue;
      nhanh.push({ rack: r.ma, tang: t, phong: ps, dem: ps.reduce((a, p) => ({ data: a.data + p.data, ap: a.ap + p.ap, cam: a.cam + p.cam }), { data: 0, ap: 0, cam: 0 }) });
    }
  }
  const tongText = `${dn.tong.data} ổ data, ${dn.tong.ap} AP Wi-Fi, ${dn.tong.cam} camera — ${dn.tong.lienKet} link Cat6`;
  const rackNgan = dn.rack.map((r) => ({
    ma: r.ma, tang: r.tang ?? "", viTri: r.viTri ?? "", uRack: r.uRack, kieuRack: r.kieuRack, laTrungTam: r.laTrungTam,
    nguon: nguonText(r), truc: r.truc ? { moTa: r.truc.moTa, L: r.truc.L } : null, soBanVe: soTheoRack.get(r.ma),
  }));
  const to = [];

  // --- E.700 trục -----------------------------------------------------------------------------------
  to.push({ loai: "dn", ma: "DN-TRUC", ten: "Sơ đồ trục điện nhẹ", du: {
    kieu: "truc", sheet: khungTen(info, soTruc, "SƠ ĐỒ TRỤC ĐIỆN NHẸ (MẠNG LAN, WI-FI, CAMERA)"),
    tang, rack: rackNgan, nhanh,
    ghiChu: [
      `Cáp ngang Cat6 U/UTP 4 đôi, link cố định ≤ ${R.cat6Max} m (ANSI/TIA-568). Nhãn cổng <Tầng rack>-<Rack>-PP<n>-<cổng> (TIA-606); bảng đấu nối cổng: file dien-nhe.xlsx, sheet Dau noi.`,
      `Tổng: ${tongText}. AP Wi-Fi và camera cấp nguồn PoE từ switch tại rack.`,
      `Thiết bị ghi theo chủng loại, chưa gắn hãng. Nguyên lý mạng và camera xem ${soMang}; tủ rack xem ${[...soTheoRack.values()].join(", ")}.`,
    ],
  } });

  // --- E.701 nguyên lý mạng & camera -----------------------------------------------------------------
  const tt = dn.rack.find((r) => r.laTrungTam);
  const nhom = dn.rack.map((r) => {
    const muc = [];
    const gom = (loai) => {
      const ds = r.switch.filter((s) => s.loai === loai);
      return ds.length ? { sl: ds.length, s: ds[0] } : null;
    };
    const th = gom("thuong"), poe = gom("poe");
    if (th) muc.push({ loai: "switch", ten: `${th.sl > 1 ? `${th.sl} × ` : ""}SWITCH ${th.s.cong} CỔNG`, phu: `${r.dem.data} ổ data + ${R.duPhongCong}% dự phòng`,
      la: [{ ten: `${r.dem.data} × Ổ DATA`, phu: "Cat6, nhân RJ45" }] });
    if (poe) {
      const la = [];
      if (r.dem.ap) la.push({ ten: `${r.dem.ap} × AP WI-FI`, phu: `PoE ${R.poeAp} W/AP` });
      if (r.dem.cam) {
        const ngoai = r.lienKet.filter((x) => x.ngoaiTroi).length;
        la.push({ ten: `${r.dem.cam} × CAMERA IP`, phu: `${ngoai ? `${ngoai} ngoài trời · ` : ""}PoE ${R.poeCam} W` });
      }
      muc.push({ loai: "poe", ten: `${poe.sl > 1 ? `${poe.sl} × ` : ""}SWITCH PoE ${poe.s.cong} CỔNG`, phu: `ngân sách ${poe.sl * poe.s.poe} W ≥ ${Math.ceil(r.poe.can)} W`, la });
    }
    if (r.laTrungTam && dn.nvr) {
      muc.push({ loai: "nvr", ten: `ĐẦU GHI NVR ${dn.nvr.kenh} KÊNH`, phu: `${dn.nvr.soHdd} × HDD ${dn.nvr.hddTB} TB`,
        la: [{ ten: "MÀN HÌNH GIÁM SÁT", phu: "HDMI" }] });
    }
    return { ma: r.ma, tang: r.tang ?? "", laTrungTam: r.laTrungTam, truc: r.truc ? `${r.truc.moTa}${r.truc.L ? `, ${r.truc.L} m` : ""}` : "", muc };
  });
  const loi = tt?.switchLoi ? { ten: `SWITCH LÕI ${tt.switchLoi.cong} CỔNG`, phu: `rack ${tt.ma}` } : null;
  const bangRack = dn.rack.map((r) => ({
    ma: r.ma, tang: r.tang ?? "", data: r.dem.data, ap: r.dem.ap, cam: r.dem.cam,
    sw: r.switch.map((s) => (s.loai === "poe" ? `PoE ${s.cong}` : `${s.cong}`)).join(" + ") + (r.switchLoi ? ` + lõi ${r.switchLoi.cong}` : ""),
    poe: r.dem.ap + r.dem.cam ? `${Math.ceil(r.poe.can)} / ${r.poe.nganSach}` : "—", pp: r.soPP,
    u: `${so1(r.uCan)}U → ${r.uRack}U`, ups: `${r.ups.va} VA`, nguon: nguonText(r),
  }));
  to.push({ loai: "dn", ma: "DN-MANG", ten: "Nguyên lý mạng & camera", du: {
    kieu: "mang", sheet: khungTen(info, soMang, "SƠ ĐỒ NGUYÊN LÝ MẠNG LAN / WI-FI / CAMERA"),
    loi, nhom, bang: bangRack,
    ghiChu: dn.nvr ? [`NVR: ${dn.nvr.soCam} camera × ${R.bitrate} Mbps × ${R.ngayLuu} ngày = ${so1(dn.nvr.tb)} TB → ${dn.nvr.soHdd} ổ ${dn.nvr.hddTB} TB; ${dn.nvr.kenh} kênh (số camera + ${R.duPhongCong}% dự phòng).`] : [],
  } });

  // --- E.702… mặt đứng tủ rack -------------------------------------------------------------------------
  for (const r of dn.rack) {
    const n = machNguon(r, kq);
    const ghi = [
      `Nguồn cấp: tủ ${n ? `${n.tu}, lộ ${n.ma}${n.thietBi ? ` — ${n.thietBi}` : ""}${n.cap ? `, ${n.cap}` : ""}` : "chưa có"} (công suất mạch ${r.nguon?.P ?? "—"} W = tải ${Math.round(r.w)} W × ${R.kUps}).`,
      `UPS ${r.ups.va} VA ≥ ${Math.round(r.w)} W / ${R.pfUps} × ${R.kUps} = ${Math.ceil(r.ups.vaCan)} VA; thời gian lưu điện theo yêu cầu dự án.`,
      ...(r.dem.data ? [`Ổ data: ${r.dem.data} cổng + ${R.duPhongCong}% dự phòng → ${r.switch.filter((s) => s.loai === "thuong").map((s) => `switch ${s.cong} cổng`).join(" + ")}.`] : []),
      ...(r.dem.ap + r.dem.cam ? [`PoE: ${r.dem.ap} AP × ${R.poeAp} W + ${r.dem.cam} camera × ${R.poeCam} W = ${r.poe.tai} W × ${R.kPoe} = ${Math.ceil(r.poe.can)} W ≤ ngân sách ${r.poe.nganSach} W.`] : []),
      `Patch panel: ${r.dem.lienKet} link → ${r.soPP} × ${R.ppCong} cổng. Tủ: ${r.uTong}U × ${R.kRack} = ${so1(r.uCan)}U → ${r.uRack}U, ${r.kieuRack}.`,
      ...(r.laTrungTam && dn.nvr ? [`NVR: ${dn.nvr.soCam} camera × ${R.bitrate} Mbps × ${R.ngayLuu} ngày = ${so1(dn.nvr.tb)} TB → ${dn.nvr.soHdd} ổ ${dn.nvr.hddTB} TB.`] : []),
      ...(r.truc ? [`Trục về rack trung tâm ${tt?.ma}: ${r.truc.moTa}${r.truc.L ? `, ${r.truc.L} m` : ""}.`] : []),
      "Bảng đấu nối cổng – ổ: dien-nhe.xlsx, sheet Dau noi.",
    ];
    to.push({ loai: "dn", ma: `RACK-${r.ma}`, ten: `Tủ rack ${r.ma}`, du: {
      kieu: "rack", sheet: khungTen(info, soTheoRack.get(r.ma), `SƠ ĐỒ TỦ RACK ${hoa(r.ma)}`),
      rack: { ma: r.ma, tang: r.tang ?? "", viTri: r.viTri ?? "", uRack: r.uRack, kieuRack: r.kieuRack, laTrungTam: r.laTrungTam },
      thietBi: r.thietBi.map((x) => ({ ten: x.ten, u: x.u, w: x.w, loai: x.loai })),
      poeTai: r.poe.tai, w: Math.round(r.w), ghiChu: ghi,
    } });
  }
  return { to, soTheoRack };
}
const so1 = (x) => Number(x).toFixed(1).replace(".", ",");
