// Điện nhẹ (mục 8 của phương án): mạng LAN / Wi-Fi, camera, truyền hình IPTV, chuông cửa IP, kiểm soát ra vào (ACS),
// âm thanh nền 100 V, nhà thông minh KNX, tủ rack.
//
// Đầu vào duAn.dienNhe = {
//   phong: [{ tang, phong, data, tv, ap, camTrong, camNgoai, chuongNgoai, chuongTrong, acs, loa, loaW, vungAm, knx, rack, L }],
//   rack:  [{ ma, tang, viTri, capTu, maMach, lNguon, lTruc, trungTam }]   — thiếu thì tự dựng từ cột "rack" của phòng
// }
// và các mạch điện có trường knx ("Bật/tắt" | "Dimmer" | "Rèm") → kênh actuator KNX trong tủ điện của mạch.
//
// Mỗi rack: liên kết ngang Cat6 (mã cổng TIA-606 <Tầng rack>-<Rack>-PP<n>-<cổng>) cho ổ data, ổ TV (IPTV), bộ điều khiển
// ACS (switch thường) và AP, camera, chuông cửa IP (switch PoE, ngân sách PoE); patch panel; rack trung tâm thêm router,
// kệ modem, switch lõi, NVR; ampli âm thanh; bộ điều khiển ACS lắp cạnh tủ. Cộng U → cỡ tủ; cộng W → UPS. Nguồn cho rack
// và cho ampli tự thêm thành mạch trong tủ điện cấp (tham chiếu chéo). Trục giữa các rack: Cat6 ≤ 90 m, dài hơn dùng quang.
// KNX: actuator (module vào vỏ tủ), nguồn bus + giao diện IP ở tủ gốc, số line, chiều dài bus.
//
// Thiết bị ghi theo chủng loại (chưa gắn hãng); mã hàng, đơn giá điền ở sheet Bang gia của BOQ.

import { chuCap, khungTen, soBanVe } from "./sang-ban-ve.mjs";
import { tb as chuTb } from "./dien-giai.mjs";

const n0 = (x) => (Number.isFinite(+x) && +x > 0 ? Math.round(+x) : 0);
const tron10 = (x) => Math.ceil(x / 10 - 1e-9) * 10;
const pad2 = (i) => String(i).padStart(2, "0");
const so = (x, d = 1) => Number(x).toFixed(d).replace(".", ",");
const vn = (x) => String(x).replace(".", ",");   // hệ số ghi kiểu Việt Nam: 1,25
// [trường của phòng, loại link, mô tả, switch, khóa công suất PoE trong rule.dienNhe]
export const LOAI_LK = [
  ["data", "DATA", "Ổ data", "thuong", null],
  ["tv", "TV", "Ổ TV (IPTV)", "thuong", null],
  ["ap", "AP", "AP Wi-Fi", "poe", "poeAp"],
  ["camTrong", "CAM", "Camera trong nhà", "poe", "poeCam"],
  ["camNgoai", "CAM", "Camera ngoài trời", "poe", "poeCam"],
  ["chuongNgoai", "CHUONG", "Nút gọi chuông cửa IP", "poe", "poeChuongNgoai"],
  ["chuongTrong", "CHUONG", "Màn hình chuông cửa IP", "poe", "poeChuongTrong"],
];
const TRUONG_RACK = [...LOAI_LK.map((x) => x[0]), "acs", "loa"];   // các trường cần rack phục vụ
/** Không còn hệ nào để đợt sau (giữ để tương thích) */
export const CHUA_TINH = [];

/** Kiểu điều khiển KNX của một mạch: "batTat" | "dimmer" | "rem" | null */
export function loaiKnx(v) {
  const s = String(v ?? "").trim().toLowerCase();
  if (!s || /^(không|khong|no|0|-)$/.test(s)) return null;
  if (/dim/.test(s)) return "dimmer";
  if (/rèm|rem|blind|curtain|mành/.test(s)) return "rem";
  return "batTat";
}
const TEN_KNX = { batTat: "bật/tắt", dimmer: "dimmer", rem: "rèm" };

/** Có dữ liệu điện nhẹ không (bảng phòng có số lượng, hoặc mạch điện có đánh dấu KNX) */
export const coDienNhe = (dn, circuits = []) =>
  (dn?.phong || []).some((p) => [...TRUONG_RACK, "knx"].some((k) => n0(p[k]) > 0)) || circuits.some((c) => loaiKnx(c.knx));

/** Số cổng cần (kèm dự phòng) → các switch. Một model đủ thì lấy model nhỏ nhất; không thì ghép nhiều switch cỡ lớn nhất. */
function chonSwitch(n, R, poeCan = null) {
  if (!n) return [];
  const can = Math.ceil(n * (1 + R.duPhongCong / 100) - 1e-9);
  if (poeCan != null) {
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

/** Chia n thành các cỡ (giảm dần): lấy cỡ lớn nhất cho phần chẵn, phần dư lấy cỡ nhỏ nhất đủ */
function chiaCo(n, coGiam) {
  const ds = [];
  let con = n;
  const max = coGiam[0];
  while (con >= max) { ds.push(max); con -= max; }
  if (con > 0) ds.push([...coGiam].reverse().find((c) => c >= con) ?? max);
  return ds;
}

/**
 * @param {object} dn — duAn.dienNhe
 * @param {object} rule — bộ quy tắc (taoQuyTac) — dùng rule.dienNhe
 * @param {{ panels?: object[], circuits?: object[] }} o — dữ liệu tủ điện: gắn mạch nguồn rack / ampli, kênh KNX
 * @returns {{ rack, lienKet, tong, nvr, acs, amThanh, knx, machThem, thietBiTu: Map, canhBao, trungTam, phong }}
 */
export function tinhDienNhe(dn, rule, { panels = [], circuits = [] } = {}) {
  const R = rule.dienNhe;
  const canhBao = [];
  const ghi = (muc, rack, phong, noiDung) => canhBao.push({ muc, tu: rack ?? "", mach: phong ?? "", noiDung, dienNhe: true });
  const goc = panels.find((p) => !p.capTu || !panels.some((x) => x.ma === p.capTu)) || panels[0];

  const phong = (dn?.phong || []).filter((p) => p && (p.phong || p.tang));
  const canRack = (p) => TRUONG_RACK.some((k) => n0(p[k]) > 0);
  // --- Rack: khai báo + tự dựng từ cột "rack" của phòng ---------------------------------------------
  const rackMap = new Map();
  for (const r of dn?.rack || []) if (r?.ma) rackMap.set(String(r.ma).trim(), { ...r, ma: String(r.ma).trim() });
  const rackMacDinh = rackMap.keys().next().value || "R1";
  for (const p of phong) {
    p.rack = String(p.rack || rackMacDinh).trim();
    if (canRack(p) && !rackMap.has(p.rack)) {
      rackMap.set(p.rack, { ma: p.rack, tang: p.tang, tuDong: true });
      ghi("canhbao", p.rack, "", `Rack ${p.rack} chưa khai ở sheet "Tu rack" — tạm đặt ở tầng ${p.tang ?? "?"}, cấp nguồn từ tủ gốc`);
    }
  }
  const racks = [...rackMap.values()];
  const tt = racks.find((r) => r.trungTam === true || /^(có|x|1|✔|yes|trung tâm)/i.test(String(r.trungTam ?? ""))) || racks[0];
  for (const r of racks) r.laTrungTam = r === tt;

  // --- Liên kết ngang từng rack ----------------------------------------------------------------------------
  const lienKet = [];
  const dem = { DATA: 0, TV: 0, AP: 0, CAM: 0, CHUONG: 0, ACS: 0 };
  const thieuL = new Map();
  const cua = [];          // cửa ACS
  let thieuLoaW = false;
  const vung = new Map();  // vùng âm thanh
  for (const r of racks) {
    r.lienKet = [];
    r.cua = [];
    for (const p of phong.filter((x) => x.rack === r.ma && canRack(x))) {
      const L = p.L > 0 ? p.L : R.lMacDinh;
      if (!(p.L > 0)) (thieuL.get(r.ma) || thieuL.set(r.ma, []).get(r.ma)).push(p.phong || p.tang);
      if (L > R.cat6Max && LOAI_LK.some(([k]) => n0(p[k]))) {
        ghi("canhbao", r.ma, p.phong, `Cáp Cat6 tới ${p.tang ? `${p.tang} – ` : ""}${p.phong} dài ${so(L, 0)} m > ${R.cat6Max} m (link cố định TIA-568) — đặt thêm rack/switch tầng gần hơn hoặc dùng cáp quang`);
      }
      for (const [k, loai, moTa, sw, khoaPoe] of LOAI_LK) {
        for (let i = 0; i < n0(p[k]); i++) {
          dem[loai]++;
          const lk = { rack: r.ma, tang: p.tang ?? "", phong: p.phong ?? "", loai, moTa, sw, poe: khoaPoe ? R[khoaPoe] : 0, ngoaiTroi: k === "camNgoai", L,
            thietBi: loai === "DATA" || loai === "TV" ? "" : `${loai}-${pad2(dem[loai])}` };
          r.lienKet.push(lk);
        }
      }
      for (let i = 0; i < n0(p.acs); i++) r.cua.push({ rack: r.ma, tang: p.tang ?? "", phong: p.phong ?? "", L });
      if (n0(p.loa)) {
        if (!(p.loaW > 0)) thieuLoaW = true;
        const ten = String(p.vungAm || p.phong || "Vùng").trim();
        const v = vung.get(ten) || vung.set(ten, { ten, rack: r.ma, phong: [], W: 0 }).get(ten);
        const w = p.loaW > 0 ? p.loaW : R.loaWMacDinh;
        v.phong.push({ tang: p.tang ?? "", phong: p.phong ?? "", loa: n0(p.loa), w, L });
        v.W += n0(p.loa) * w;
      }
    }
    // ACS: bộ điều khiển 4/2/1 cửa, mỗi bộ 1 link Cat6 về switch thường
    r.acs = chiaCo(r.cua.length, R.acsBoDieuKhien).map((k, i) => ({ ma: `ACS-${r.ma}-${i + 1}`, cua: k }));
    let j = 0;
    for (const b of r.acs) {
      b.dsCua = r.cua.slice(j, j + b.cua);
      j += b.cua;
      dem.ACS++;
      r.lienKet.push({ rack: r.ma, tang: r.tang ?? "", phong: `Bộ điều khiển ${b.ma}`, loai: "ACS", moTa: "Bộ điều khiển ACS", sw: "thuong", poe: 0, ngoaiTroi: false, L: 3, thietBi: b.ma });
    }
    cua.push(...r.cua);
    r.lienKet.forEach((lk, i) => {
      lk.pp = Math.floor(i / R.ppCong) + 1;
      lk.cong = (i % R.ppCong) + 1;
      lk.ma = `${r.tang ?? ""}-${r.ma}-PP${lk.pp}-${pad2(lk.cong)}`.replace(/^-/, "");
    });
    lienKet.push(...r.lienKet);
  }
  for (const [ma, ds] of thieuL) ghi("ghichu", ma, "", `Chưa có chiều dài cáp ngang (${ds.join(", ")}) — tạm tính ${R.lMacDinh} m/link cho BOQ`);
  if (thieuLoaW) ghi("ghichu", "", "", `Chưa có công suất tap loa ở một số phòng — tạm tính ${R.loaWMacDinh} W/loa`);
  if (cua.length) ghi("ghichu", "", "", `Kiểm soát ra vào: liên động với tủ báo cháy để mở khóa cửa thoát nạn khi có cháy (điểm giao tiếp — hệ báo cháy ngoài phạm vi)`);

  // --- NVR (đặt ở rack trung tâm) --------------------------------------------------------------------
  let nvr = null;
  if (dem.CAM && tt) {
    const kenhCan = Math.ceil(dem.CAM * (1 + R.duPhongCong / 100) - 1e-9);
    const tb = (dem.CAM * R.bitrate * 86400 * R.ngayLuu) / 8 / 1e6;          // TB (Mb → TB)
    const soHdd = Math.max(1, Math.ceil(tb / R.hddTB - 1e-9));
    const m = R.nvr.find(([k, khay]) => k >= kenhCan && khay >= soHdd) || R.nvr.find(([k]) => k >= kenhCan) || R.nvr.at(-1);
    nvr = { kenh: m[0], khay: m[1], u: m[2], soCam: dem.CAM, tb, soHdd, hddTB: R.hddTB, w: R.congSuat.nvr + R.congSuat.hdd * soHdd, rack: tt.ma };
    if (m[0] < kenhCan) ghi("canhbao", tt.ma, "", `${dem.CAM} camera vượt NVR lớn nhất ${m[0]} kênh — dùng nhiều NVR`);
    if (soHdd > m[1]) ghi("canhbao", tt.ma, "", `Cần ${soHdd} ổ ${R.hddTB} TB (${so(tb)} TB) nhưng NVR ${m[0]} kênh chỉ có ${m[1]} khay — chọn ổ dung lượng lớn hơn hoặc giảm số ngày lưu`);
  }

  // --- Âm thanh: ampli theo rack ---------------------------------------------------------------------------
  const dsVung = [...vung.values()];
  for (const r of racks) {
    const vs = dsVung.filter((v) => v.rack === r.ma);
    r.ampli = [];
    if (!vs.length) continue;
    const tongW = vs.reduce((a, v) => a + v.W, 0);
    const maxA = R.ampliW.at(-1);
    if (vs.length <= R.ampliVungMax && tongW * R.kAmpli <= maxA) {
      const ra = R.ampliW.find((x) => x >= tongW * R.kAmpli - 1e-9);
      r.ampli.push({ ra, mixer: vs.length > 1, vung: vs.map((v) => v.ten), W: tongW });
    } else {
      for (const v of vs) {
        const ra = R.ampliW.find((x) => x >= v.W * R.kAmpli - 1e-9);
        if (!ra) ghi("canhbao", r.ma, v.ten, `Vùng ${v.ten}: ${v.W} W × ${vn(R.kAmpli)} vượt ampli lớn nhất ${maxA} W — chia vùng`);
        r.ampli.push({ ra: ra ?? maxA, mixer: false, vung: [v.ten], W: v.W });
      }
    }
    for (const a of r.ampli) for (const t of a.vung) vung.get(t).ampli = a;
  }

  // --- Thiết bị từng rack ---------------------------------------------------------------------------
  const soSwitchTruyCap = [];
  for (const r of racks) {
    const lk = r.lienKet;
    const c = (loai) => lk.filter((x) => x.loai === loai).length;
    r.dem = { data: c("DATA"), tv: c("TV"), ap: c("AP"), cam: c("CAM"), chuong: c("CHUONG"), acs: c("ACS"), cua: r.cua.length, lienKet: lk.length };
    const thuong = lk.filter((x) => x.sw === "thuong").length;
    const poeLk = lk.filter((x) => x.sw === "poe");
    const poeTai = poeLk.reduce((a, x) => a + x.poe, 0);
    r.poe = { tai: poeTai, can: poeTai * R.kPoe };
    r.switch = [...chonSwitch(thuong, R), ...chonSwitch(poeLk.length, R, poeLk.length ? r.poe.can : null)];
    r.poe.nganSach = r.switch.reduce((a, s) => a + s.poe, 0);
    r.soPP = Math.ceil(lk.length / R.ppCong);
    soSwitchTruyCap.push(r.switch.length);
  }
  const tongSwitch = soSwitchTruyCap.reduce((a, b) => a + b, 0);
  for (const r of racks) {
    const tb = [];   // từ trên xuống: { ten, u, w, loai }; u = 0: lắp cạnh tủ
    for (let i = 1; i <= r.soPP; i++) {
      tb.push({ ten: `Patch panel Cat6 ${R.ppCong} cổng (PP${i})`, u: 1, w: 0, loai: "pp" });
      tb.push({ ten: "Thanh quản lý cáp", u: 1, w: 0, loai: "quanLy" });
    }
    for (const s of r.switch) tb.push({ ten: tenSwitch(s), u: 1, w: s.w, loai: s.loai === "poe" ? "switchPoe" : "switch", sw: s });
    if (r.laTrungTam) {
      if (tongSwitch > 1 || racks.length > 1) {
        const can = Math.ceil((tongSwitch + (nvr ? 1 : 0) + 1) * (1 + R.duPhongCong / 100) - 1e-9);
        const m = R.switchThuong.find(([cg]) => cg >= can) || R.switchThuong.at(-1);
        r.switchLoi = { loai: "loi", cong: m[0], poe: 0, w: m[1] };
        tb.push({ ten: tenSwitch(r.switchLoi), u: 1, w: m[1], loai: "switchLoi", sw: r.switchLoi });
      }
      tb.push({ ten: "Router / tường lửa", u: 1, w: R.congSuat.router, loai: "router" });
      tb.push({ ten: "Kệ đặt modem ISP", u: 1, w: R.congSuat.modem, loai: "ke" });
      if (nvr) tb.push({ ten: `Đầu ghi NVR ${nvr.kenh} kênh + ${nvr.soHdd} ổ ${nvr.hddTB} TB`, u: nvr.u, w: nvr.w, loai: "nvr" });
    }
    if (r.ampli.length) {
      tb.push({ ten: "Nguồn nhạc (streamer / tuner)", u: 1, w: R.nguonNhacW, loai: "nguonNhac" });
      for (const a of r.ampli) tb.push({ ten: `Ampli ${a.mixer ? `mixer ${a.vung.length} vùng ` : ""}100 V ${a.ra} W`, u: 2, w: 0, loai: "ampli", ampli: a });
    }
    tb.push({ ten: "Thanh nguồn PDU", u: 1, w: 0, loai: "pdu" });
    for (const b of r.acs) tb.push({ ten: `Bộ điều khiển ACS ${b.cua} cửa + nguồn 12 V ắc quy (${b.ma})`, u: 0, w: R.acsW, loai: "acs" });
    r.w = tb.reduce((a, x) => a + x.w, 0) + r.poe.tai;
    const va = (r.w / R.pfUps) * R.kUps;
    r.ups = { va: R.upsVA.find((x) => x >= va - 1e-9) ?? R.upsVA.at(-1), vaCan: va, u: 2 };
    if (va > R.upsVA.at(-1)) ghi("canhbao", r.ma, "", `UPS cần ${Math.ceil(va)} VA, lớn hơn cỡ ${R.upsVA.at(-1)} VA — chia tải hoặc dùng UPS ngoài tủ`);
    tb.splice(tb.findIndex((x) => x.loai === "pdu") + 1, 0, { ten: `UPS ${r.ups.va} VA (online, rack-mount)`, u: 2, w: 0, loai: "ups" });
    r.thietBi = tb;
    r.uTong = tb.reduce((a, x) => a + x.u, 0);
    r.uCan = r.uTong * R.kRack;
    r.uRack = R.rackU.find((u) => u >= r.uCan - 1e-9) ?? R.rackU.at(-1);
    r.kieuRack = r.uRack <= R.rackTreoMax ? "treo tường" : "đứng";
    r.wAmpli = r.ampli.reduce((a, x) => a + x.ra, 0) * R.kTieuThuAmpli;
    if (r.uCan > R.rackU.at(-1)) ghi("canhbao", r.ma, "", `Cần ${Math.ceil(r.uCan)}U, vượt tủ ${R.rackU.at(-1)}U — tách thành 2 tủ`);
    if (r.poe.can > r.poe.nganSach + 1e-9) ghi("loi", r.ma, "", `Ngân sách PoE ${r.poe.nganSach} W < cần ${Math.ceil(r.poe.can)} W`);
    if (!r.laTrungTam) {
      const L = r.lTruc > 0 ? r.lTruc : null;
      r.truc = !L || L <= R.cat6Max
        ? { loai: "cat6", moTa: "2 × Cat6 (1 dùng + 1 dự phòng)", L }
        : { loai: "quang", moTa: "Cáp quang single-mode 4 lõi + 2 module SFP", L };
      if (!L) ghi("canhbao", r.ma, "", `Chưa có chiều dài trục từ rack ${r.ma} về rack trung tâm ${tt.ma} — tạm dùng Cat6, kiểm lại ≤ ${R.cat6Max} m`);
    }
  }

  // --- Nguồn cho rack và ampli: mạch trong tủ điện ----------------------------------------------------------
  const machThem = [];
  const themMach = (tu, phuTai, P, L, ghiChu, tuDienNhe) => {
    const daDung = new Set([...circuits, ...machThem].filter((c) => c.tu === tu).map((c) => c.ma));
    let k = 1;
    while (daDung.has(`DN${k}`)) k++;
    const ma = `DN${k}`;
    machThem.push({ tu, ma, loai: "Thiết bị điện nhẹ (rack, NVR, KNX)", phuTai, khuVuc: "Khô", soLuong: 1, congSuat: P, soPha: 1, L: L > 0 ? L : undefined, ghiChu, tuDienNhe });
    return ma;
  };
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
      if (pCo < P) ghi("canhbao", r.ma, "", `Mạch ${tu}/${coSan.ma} cấp rack ${r.ma} có ${pCo} W < cần ${P} W (tải ${Math.round(r.w)} W × ${vn(R.kUps)})`);
    } else {
      if (r.maMach) ghi("canhbao", r.ma, "", `Không thấy mạch ${tu}/${r.maMach} — tự thêm mạch nguồn cho rack`);
      r.nguon = { tu, P, coSan: false, ma: themMach(tu, `CẤP NGUỒN TỦ RACK ${r.ma}`, P, r.lNguon, `tự thêm từ điện nhẹ: tải rack ${Math.round(r.w)} W × ${vn(R.kUps)} (UPS sạc + dự phòng)`, r.ma) };
    }
    if (r.ampli.length) {
      const Pa = tron10(r.wAmpli);
      r.nguonAmpli = { tu, ma: themMach(tu, `CẤP NGUỒN AMPLI ÂM THANH (RACK ${r.ma})`, Pa, r.lNguon, `tự thêm từ điện nhẹ: ampli ${r.ampli.map((a) => `${a.ra} W`).join(" + ")} × ${vn(R.kTieuThuAmpli)}, không qua UPS`, r.ma), P: Pa };
    }
  }

  // --- KNX ------------------------------------------------------------------------------------------------
  const knx = tinhKnx(R.knx, phong, panels, circuits, goc, ghi);

  const tong = { data: dem.DATA, tv: dem.TV, ap: dem.AP, cam: dem.CAM, chuong: dem.CHUONG, acs: dem.ACS, cua: cua.length,
    loa: dsVung.reduce((a, v) => a + v.phong.reduce((b, p) => b + p.loa, 0), 0), lienKet: lienKet.length };
  return {
    rack: racks, lienKet, tong, nvr, acs: { cua }, amThanh: { vung: dsVung }, knx, machThem, thietBiTu: knx?.thietBiTu ?? new Map(),
    canhBao, chuaTinh: {}, trungTam: tt?.ma ?? "", phong,
  };
}

/** KNX: kênh actuator theo mạch (từng tủ), thiết bị tại phòng, line, nguồn bus, giao diện IP, chiều dài bus */
function tinhKnx(K, phong, panels, circuits, goc, ghi) {
  const theoTu = new Map();
  for (const c of circuits) {
    const k = loaiKnx(c.knx);
    if (!k) continue;
    if (!panels.some((p) => p.ma === c.tu)) { ghi("canhbao", "KNX", c.ma, `Mạch ${c.tu}/${c.ma} đánh dấu KNX nhưng tủ "${c.tu}" không có`); continue; }
    const t = theoTu.get(c.tu) || theoTu.set(c.tu, { tu: c.tu, kenh: { batTat: 0, dimmer: 0, rem: 0 }, mach: [] }).get(c.tu);
    const n = k === "rem" ? Math.max(1, n0(c.soLuong)) : 1;
    t.kenh[k] += n;
    t.mach.push({ ma: c.ma, kieu: k, kenh: n, phuTai: c.phuTai || "" });
  }
  const phongKnx = phong.filter((p) => n0(p.knx) > 0).map((p) => ({ tang: p.tang ?? "", phong: p.phong ?? "", n: n0(p.knx), L: p.L > 0 ? p.L : 0 }));
  if (!theoTu.size && !phongKnx.length) return null;
  const thietBiTu = new Map();
  const them = (tu, x) => (thietBiTu.get(tu) || thietBiTu.set(tu, []).get(tu)).push(x);
  let nAct = 0;
  for (const t of theoTu.values()) {
    t.act = [];
    for (const kieu of ["batTat", "dimmer", "rem"]) {
      if (!t.kenh[kieu]) continue;
      const can = Math.ceil(t.kenh[kieu] * (1 + K.duPhongKenh / 100) - 1e-9);
      const co = [...K[kieu]].sort((a, b) => b[0] - a[0]);
      for (const kenh of chiaCo(can, co.map((x) => x[0]))) {
        const module = co.find((x) => x[0] === kenh)[1];
        const ten = `Actuator KNX ${TEN_KNX[kieu]} ${kenh} kênh`;
        t.act.push({ kieu, kenh, module, ten });
        them(t.tu, { ten, module });
        nAct++;
      }
    }
  }
  if (!theoTu.size) ghi("ghichu", "KNX", "", "Có thiết bị KNX tại phòng nhưng chưa có mạch nào đánh dấu điều khiển KNX (cột \"Điều khiển KNX\" ở sheet Mach)");
  const nPhong = phongKnx.reduce((a, p) => a + p.n, 0);
  // Số line: mỗi line ≤ 64 thiết bị và dòng bus (× hệ số) không vượt nguồn lớn nhất; mỗi line có 1 giao diện / router IP;
  // dây bus mỗi line ≤ busMax.
  const capLine = Math.min(K.thietBiLine, Math.floor(K.nguon.at(-1)[0] / (K.maThietBi * K.kNguon)));
  let line = 1;
  while (Math.ceil((nAct + nPhong + line) / capLine) > line) line++;
  const busL = phongKnx.reduce((a, p) => a + p.L, 0) + [...theoTu.keys()].reduce((a, ma) => a + (panels.find((p) => p.ma === ma && ma !== goc?.ma)?.lCap || 0), 0);
  const lineBus = Math.ceil(busL / K.busMax);
  if (lineBus > line) {
    ghi("ghichu", "KNX", "", `Dây bus KNX ước tính ${Math.round(busL)} m > ${K.busMax} m/line — chia ${lineBus} line (thay vì ${line} line theo số thiết bị)`);
    line = lineBus;
  }
  const tongTb = nAct + nPhong + line;
  const maLine = (tongTb / line) * K.maThietBi * K.kNguon;
  const nguon = K.nguon.find(([ma]) => ma >= maLine - 1e-9) || K.nguon.at(-1);
  if (maLine > K.nguon.at(-1)[0]) ghi("canhbao", "KNX", "", `Dòng bus mỗi line ${Math.ceil(maLine)} mA vượt nguồn ${K.nguon.at(-1)[0]} mA — chia thêm line`);
  const he = [];
  const tuHe = goc?.ma ?? panels[0]?.ma;
  for (let i = 0; i < line; i++) he.push({ ten: `Nguồn bus KNX ${nguon[0]} mA (line ${i + 1})`, module: nguon[1] });
  if (line > 1) for (let i = 0; i < line; i++) he.push({ ten: `IP router KNX (line ${i + 1})`, module: K.ip });
  else he.push({ ten: "Giao diện IP KNX", module: K.ip });
  if (tuHe) for (const x of he) them(tuHe, x);
  if (phongKnx.some((p) => !p.L)) ghi("ghichu", "KNX", "", "Một số phòng có thiết bị KNX chưa có chiều dài cáp — chiều dài bus KNX tính thiếu");
  return { tu: [...theoTu.values()], phong: phongKnx, nAct, nPhong, line, nguon: { ma: nguon[0], module: nguon[1] }, maLine, he, tuHe, busL, thietBiTu };
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
  let k = 0;
  const soTo = () => soBanVe(dau, k++);
  const coRack = dn.rack.length > 0;
  const soTruc = coRack ? soTo() : null, soMang = coRack ? soTo() : null;
  const soTheoRack = new Map(dn.rack.map((r) => [r.ma, soTo()]));
  const coAm = dn.amThanh.vung.length > 0, coAcs = dn.tong.cua > 0 || dn.tong.chuong > 0, coKnx = !!dn.knx;
  const soAm = coAm ? soTo() : null, soAcs = coAcs ? soTo() : null, soKnx = coKnx ? soTo() : null;
  const nguonText = (r) => {
    const n = machNguon(r, kq);
    return n ? `${n.tu} / ${n.ma}` : "—";
  };
  const to = [];
  // Tầng: từ trên xuống
  const tang = [...new Set([...dn.phong.map((p) => p.tang), ...dn.rack.map((r) => r.tang)].filter(Boolean))]
    .sort((a, b) => soTang(b) - soTang(a));
  // Cửa ACS không phải link Cat6 (cáp riêng về bộ điều khiển cạnh rack) nhưng vẫn ghi để biết vị trí.
  const LOAI = [["data", "DATA", "ổ data"], ["tv", "TV", "TV"], ["ap", "AP", "AP"], ["cam", "CAM", "camera"], ["chuong", "CHUÔNG", "chuông"], ["acs", "CỬA ACS", "cửa ACS"]];
  const demPhong = (p) => ({ data: n0(p.data), tv: n0(p.tv), ap: n0(p.ap), cam: n0(p.camTrong) + n0(p.camNgoai), chuong: n0(p.chuongNgoai) + n0(p.chuongTrong), acs: n0(p.acs) });
  const tongDem = (ds) => Object.fromEntries(LOAI.map(([x]) => [x, ds.reduce((a, p) => a + p[x], 0)]));
  const chuDem = (d, cat6) => LOAI.filter(([x]) => d[x]).map(([x, ky, ten]) => (!cat6 ? `${d[x]} ${ky}` : x === "acs" ? `${d[x]} ${ten} (cáp riêng)` : `${d[x]}×Cat6 ${ten}`)).join(" · ");
  const tongText = [dn.tong.data && `${dn.tong.data} ổ data`, dn.tong.tv && `${dn.tong.tv} ổ TV (IPTV)`, dn.tong.ap && `${dn.tong.ap} AP Wi-Fi`,
    dn.tong.cam && `${dn.tong.cam} camera`, dn.tong.chuong && `${dn.tong.chuong} thiết bị chuông cửa IP`, dn.tong.acs && `${dn.tong.acs} bộ điều khiển ACS`]
    .filter(Boolean).join(", ") + ` — ${dn.tong.lienKet} link Cat6`;

  if (coRack) {
    const nhanh = [];
    for (const r of dn.rack) {
      for (const t of tang) {
        const ps = dn.phong.filter((p) => p.rack === r.ma && p.tang === t).map((p) => ({ ten: p.phong || "", ...demPhong(p) }))
          .filter((p) => LOAI.some(([x]) => p[x]));
        if (!ps.length) continue;
        const d = tongDem(ps);
        nhanh.push({ rack: r.ma, tang: t, phong: ps.map((p) => ({ ten: p.ten, dem: chuDem(p, false) })), chu: chuDem(d, true) });
      }
    }
    const rackNgan = dn.rack.map((r) => ({
      ma: r.ma, tang: r.tang ?? "", viTri: r.viTri ?? "", uRack: r.uRack, kieuRack: r.kieuRack, laTrungTam: r.laTrungTam,
      nguon: nguonText(r), truc: r.truc ? { moTa: r.truc.moTa, L: r.truc.L } : null, soBanVe: soTheoRack.get(r.ma),
    }));

    // --- E.700 trục ---------------------------------------------------------------------------------
    to.push({ loai: "dn", ma: "DN-TRUC", ten: "Sơ đồ trục điện nhẹ", du: {
      kieu: "truc", sheet: khungTen(info, soTruc, "SƠ ĐỒ TRỤC ĐIỆN NHẸ (CÁP MẠNG Cat6)"),
      tang, rack: rackNgan, nhanh,
      ghiChu: [
        `Cáp ngang Cat6 U/UTP 4 đôi, link cố định ≤ ${R.cat6Max} m (ANSI/TIA-568). Nhãn cổng <Tầng rack>-<Rack>-PP<n>-<cổng> (TIA-606); bảng đấu nối cổng: file dien-nhe.xlsx, sheet Dau noi.`,
        `Tổng: ${tongText}. AP, camera, chuông cửa IP cấp nguồn PoE từ switch tại rack; ổ TV là ổ mạng (IPTV).`,
        `Thiết bị ghi theo chủng loại, chưa gắn hãng. Nguyên lý mạng xem ${soMang}; tủ rack xem ${[...soTheoRack.values()].join(", ")}` +
          `${soAm ? `; âm thanh ${soAm}` : ""}${soAcs ? `; kiểm soát ra vào, chuông cửa ${soAcs}` : ""}${soKnx ? `; KNX ${soKnx}` : ""}.`,
      ],
    } });

    // --- E.701 nguyên lý mạng -------------------------------------------------------------------------
    const tt = dn.rack.find((r) => r.laTrungTam);
    const nhom = dn.rack.map((r) => {
      const muc = [];
      const gom = (loai) => {
        const ds = r.switch.filter((x) => x.loai === loai);
        return ds.length ? { sl: ds.length, s: ds[0] } : null;
      };
      const th = gom("thuong"), poe = gom("poe");
      const nThuong = r.dem.data + r.dem.tv + r.dem.acs;
      if (th) {
        const la = [];
        if (r.dem.data) la.push({ ten: `${r.dem.data} × Ổ DATA`, phu: "Cat6, nhân RJ45" });
        if (r.dem.tv) la.push({ ten: `${r.dem.tv} × Ổ TV (IPTV)`, phu: "Cat6, nhân RJ45" });
        if (r.dem.acs) la.push({ ten: `${r.dem.acs} × BỘ ĐK ACS`, phu: `${r.dem.cua} cửa${soAcs ? ` — xem ${soAcs}` : ""}` });
        muc.push({ loai: "switch", ten: `${th.sl > 1 ? `${th.sl} × ` : ""}SWITCH ${th.s.cong} CỔNG`, phu: `${nThuong} link + ${R.duPhongCong}% dự phòng`, la });
      }
      if (poe) {
        const la = [];
        if (r.dem.ap) la.push({ ten: `${r.dem.ap} × AP WI-FI`, phu: `PoE ${R.poeAp} W/AP` });
        if (r.dem.cam) {
          const ngoai = r.lienKet.filter((x) => x.ngoaiTroi).length;
          la.push({ ten: `${r.dem.cam} × CAMERA IP`, phu: `${ngoai ? `${ngoai} ngoài trời · ` : ""}PoE ${R.poeCam} W` });
        }
        if (r.dem.chuong) la.push({ ten: `${r.dem.chuong} × CHUÔNG CỬA IP`, phu: `nút gọi ${R.poeChuongNgoai} W · màn hình ${R.poeChuongTrong} W` });
        muc.push({ loai: "poe", ten: `${poe.sl > 1 ? `${poe.sl} × ` : ""}SWITCH PoE ${poe.s.cong} CỔNG`, phu: `ngân sách ${poe.sl * poe.s.poe} W ≥ ${Math.ceil(r.poe.can)} W`, la });
      }
      if (r.laTrungTam && dn.nvr) {
        muc.push({ loai: "nvr", ten: `ĐẦU GHI NVR ${dn.nvr.kenh} KÊNH`, phu: `${dn.nvr.soHdd} × HDD ${dn.nvr.hddTB} TB`, la: [{ ten: "MÀN HÌNH GIÁM SÁT", phu: "HDMI" }] });
      }
      return { ma: r.ma, tang: r.tang ?? "", laTrungTam: r.laTrungTam, truc: r.truc ? `${r.truc.moTa}${r.truc.L ? `, ${r.truc.L} m` : ""}` : "", muc };
    });
    const loi = tt?.switchLoi ? { ten: `SWITCH LÕI ${tt.switchLoi.cong} CỔNG`, phu: `rack ${tt.ma}` } : null;
    const bangRack = dn.rack.map((r) => ({
      ma: r.ma, tang: r.tang ?? "", data: r.dem.data + r.dem.tv, ap: r.dem.ap, cam: r.dem.cam, chuong: r.dem.chuong,
      sw: r.switch.map((x) => (x.loai === "poe" ? `PoE ${x.cong}` : `${x.cong}`)).join(" + ") + (r.switchLoi ? ` + lõi ${r.switchLoi.cong}` : ""),
      poe: r.poe.tai ? `${Math.ceil(r.poe.can)} / ${r.poe.nganSach}` : "—", pp: r.soPP,
      u: `${so1(r.uCan)}U → ${r.uRack}U`, ups: `${r.ups.va} VA`, nguon: nguonText(r),
    }));
    to.push({ loai: "dn", ma: "DN-MANG", ten: "Nguyên lý mạng", du: {
      kieu: "mang", sheet: khungTen(info, soMang, "SƠ ĐỒ NGUYÊN LÝ MẠNG LAN / WI-FI / CAMERA / IPTV"),
      loi, nhom, bang: bangRack,
      ghiChu: [
        ...(dn.nvr ? [`NVR: ${dn.nvr.soCam} camera × ${R.bitrate} Mbps × ${R.ngayLuu} ngày = ${so1(dn.nvr.tb)} TB → ${dn.nvr.soHdd} ổ ${dn.nvr.hddTB} TB; ${dn.nvr.kenh} kênh (số camera + ${R.duPhongCong}% dự phòng).`] : []),
        ...(dn.tong.tv ? ["Truyền hình IPTV: ổ TV là ổ mạng Cat6 về switch; đầu thu IPTV / Smart TV theo nhà cung cấp dịch vụ."] : []),
      ],
    } });

    // --- Mặt đứng tủ rack -----------------------------------------------------------------------------
    for (const r of dn.rack) {
      const n = machNguon(r, kq);
      const poeChu = [r.dem.ap && `${r.dem.ap} AP × ${R.poeAp} W`, r.dem.cam && `${r.dem.cam} camera × ${R.poeCam} W`,
        r.dem.chuong && `${r.dem.chuong} chuông cửa`].filter(Boolean).join(" + ");
      const ghi = [
        `Nguồn cấp: tủ ${n ? `${n.tu}, lộ ${n.ma}${n.thietBi ? ` — ${n.thietBi}` : ""}${n.cap ? `, ${n.cap}` : ""}` : "chưa có"} (công suất mạch ${r.nguon?.P ?? "—"} W = tải ${Math.round(r.w)} W × ${vn(R.kUps)}).`,
        `UPS ${r.ups.va} VA ≥ ${Math.round(r.w)} W / ${vn(R.pfUps)} × ${vn(R.kUps)} = ${Math.ceil(r.ups.vaCan)} VA; thời gian lưu điện theo yêu cầu dự án.`,
        ...(r.dem.data + r.dem.tv + r.dem.acs ? [`Switch thường: ${r.dem.data} ổ data + ${r.dem.tv} ổ TV + ${r.dem.acs} bộ điều khiển ACS, + ${R.duPhongCong}% dự phòng → ${r.switch.filter((x) => x.loai === "thuong").map((x) => `switch ${x.cong} cổng`).join(" + ")}.`] : []),
        ...(r.poe.tai ? [`PoE: ${poeChu} = ${r.poe.tai} W × ${vn(R.kPoe)} = ${Math.ceil(r.poe.can)} W ≤ ngân sách ${r.poe.nganSach} W.`] : []),
        `Patch panel: ${r.dem.lienKet} link → ${r.soPP} × ${R.ppCong} cổng. Tủ: ${r.uTong}U × ${vn(R.kRack)} = ${so1(r.uCan)}U → ${r.uRack}U, ${r.kieuRack}.`,
        ...(r.laTrungTam && dn.nvr ? [`NVR: ${dn.nvr.soCam} camera × ${R.bitrate} Mbps × ${R.ngayLuu} ngày = ${so1(dn.nvr.tb)} TB → ${dn.nvr.soHdd} ổ ${dn.nvr.hddTB} TB.`] : []),
        ...(r.ampli.length ? [`Ampli 100 V: ${r.ampli.map((a) => `${a.ra} W ≥ ${vn(R.kAmpli)} × ${a.W} W (${a.vung.join(", ")})`).join("; ")}. Nguồn ampli: lộ riêng ${r.nguonAmpli ? `${r.nguonAmpli.tu}/${r.nguonAmpli.ma} (${r.nguonAmpli.P} W)` : "—"}, không qua UPS.`] : []),
        ...(r.acs.length ? [`Bộ điều khiển ACS (${r.acs.map((b) => `${b.cua} cửa`).join(", ")}) lắp cạnh tủ rack, nguồn 12 V có ắc quy; cấp điện từ ổ trong tủ (tính vào tải UPS).`] : []),
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
  }

  // --- Âm thanh 100 V ------------------------------------------------------------------------------------------
  if (coAm) {
    const nhomAm = dn.rack.filter((r) => r.ampli.length).map((r) => ({
      ma: r.ma, tang: r.tang ?? "", laTrungTam: r.laTrungTam, truc: "",
      muc: r.ampli.map((a) => ({
        loai: "ampli", ten: `AMPLI ${a.mixer ? "MIXER " : ""}100 V ${a.ra} W`, phu: `${a.vung.length} vùng · ≥ ${vn(R.kAmpli)} × ${a.W} W`,
        la: a.vung.map((t) => {
          const v = dn.amThanh.vung.find((x) => x.ten === t);
          const nLoa = v.phong.reduce((b, p) => b + p.loa, 0);
          return { ten: `${hoa(t)}: ${nLoa} LOA`, phu: `${v.W} W · ${v.phong.map((p) => p.phong).join(", ")}` };
        }),
      })),
    }));
    const bang = dn.amThanh.vung.flatMap((v) => v.phong.map((p, i) => [i ? "" : v.ten, p.tang, p.phong, p.loa, p.w, p.loa * p.w, i ? "" : `${v.W} W → ${v.ampli?.ra ?? "—"} W`]));
    to.push({ loai: "dn", ma: "DN-AM", ten: "Âm thanh 100 V", du: {
      kieu: "cay", sheet: khungTen(info, soAm, "SƠ ĐỒ NGUYÊN LÝ ÂM THANH NỀN 100 V"),
      dinh: [{ ten: "NGUỒN NHẠC", phu: "streamer / tuner tại rack" }], nhom: nhomAm,
      bang: { tieuDe: "BẢNG CÔNG SUẤT LOA THEO VÙNG", cot: [["VÙNG", 30], ["TẦNG", 14], ["PHÒNG", 50, "l"], ["SỐ LOA", 16], ["W / LOA", 16], ["ΣW", 16], ["VÙNG → AMPLI", 40]], dong: bang },
      ghiChu: [
        `Loa treo trần / gắn tường 100 V, chọn tap ${R.loaWMacDinh} W khi chưa có số liệu. Ampli ≥ ${vn(R.kAmpli)} × Σ công suất tap loa; ≤ ${R.ampliVungMax} vùng dùng ampli mixer chọn vùng.`,
        "Cáp loa chống cháy 2 × 1,5 mm², đi riêng ống với cáp điện; loa trong một vùng đấu song song trên đường 100 V.",
        `Ampli cấp nguồn từ lộ riêng trong tủ điện (không qua UPS), công suất ≈ ${vn(R.kTieuThuAmpli)} × công suất ra.`,
      ],
    } });
  }

  // --- Kiểm soát ra vào + chuông cửa IP -----------------------------------------------------------------------
  if (coAcs) {
    const nhomAcs = dn.rack.filter((r) => r.acs.length || r.dem.chuong).map((r) => {
      const muc = r.acs.map((b) => ({ loai: "acs", ten: `BỘ ĐIỀU KHIỂN ${b.cua} CỬA`, phu: `${b.ma} · nguồn 12 V ắc quy`,
        la: [{ ten: `${b.dsCua.length} CỬA`, phu: b.dsCua.map((c) => c.phong).join(", ") }] }));
      const ch = r.lienKet.filter((x) => x.loai === "CHUONG");
      if (ch.length) {
        const ngoai = ch.filter((x) => /Nút gọi/.test(x.moTa)), trong = ch.filter((x) => /Màn hình/.test(x.moTa));
        muc.push({ loai: "poe", ten: "SWITCH PoE (MẠNG)", phu: `rack ${r.ma}`, la: [
          ...(ngoai.length ? [{ ten: `${ngoai.length} × NÚT GỌI CỬA IP`, phu: [...new Set(ngoai.map((x) => x.phong))].join(", ") }] : []),
          ...(trong.length ? [{ ten: `${trong.length} × MÀN HÌNH CHUÔNG IP`, phu: [...new Set(trong.map((x) => x.phong))].join(", ") }] : []),
        ] });
      }
      return { ma: r.ma, tang: r.tang ?? "", laTrungTam: r.laTrungTam, truc: "", muc };
    });
    const bang = dn.acs.cua.map((c, i) => [i + 1, c.tang, c.phong, c.rack, `${so(c.L, 0)} m`, "Đầu đọc thẻ · khóa điện · nút exit · công tắc cửa · nút khẩn"]);
    to.push({ loai: "dn", ma: "DN-ACS", ten: "Kiểm soát ra vào & chuông cửa", du: {
      kieu: "cay", sheet: khungTen(info, soAcs, "SƠ ĐỒ NGUYÊN LÝ KIỂM SOÁT RA VÀO & CHUÔNG CỬA IP"),
      dinh: [{ ten: "MẠNG LAN / PHẦN MỀM QUẢN LÝ", phu: "switch lõi tại rack trung tâm" }], nhom: nhomAcs,
      bang: bang.length ? { tieuDe: "DANH SÁCH CỬA KIỂM SOÁT", cot: [["STT", 12], ["TẦNG", 14], ["PHÒNG / CỬA", 52, "l"], ["RACK", 16], ["L CÁP", 16], ["THIẾT BỊ TẠI CỬA", 92, "l"]], dong: bang } : null,
      ghiChu: [
        ...(dn.tong.cua ? ["Mỗi cửa: đầu đọc (cáp 6 lõi có lưới), khóa điện (cáp 2 × 1,0), nút exit và công tắc cửa (cáp 2 lõi), nút khẩn mở cửa.",
          "Liên động báo cháy: tín hiệu từ tủ báo cháy mở khóa các cửa thoát nạn (điểm giao tiếp, hệ báo cháy ngoài phạm vi)."] : []),
        ...(dn.tong.chuong ? [`Chuông cửa IP: nút gọi ngoài trời (PoE ${R.poeChuongNgoai} W) và màn hình trong nhà (PoE ${R.poeChuongTrong} W) nối switch PoE bằng Cat6.`] : []),
      ],
    } });
  }

  // --- KNX ------------------------------------------------------------------------------------------------------
  if (coKnx) {
    const K = dn.knx;
    const NGAN = { batTat: "BT", dimmer: "DIM", rem: "RÈM" };
    const mucTu = K.tu.map((t) => ({ loai: "knx", ten: `TỦ ${hoa(t.tu)}`, phu: t.act.map((a) => `${NGAN[a.kieu]}${a.kenh}`).join(" · "), la: [] }));
    const theoTang = new Map();
    for (const p of K.phong) theoTang.set(p.tang, (theoTang.get(p.tang) || 0) + p.n);
    const mucPhong = [...theoTang].map(([t, n]) => ({ loai: "knxPhong", ten: `${hoa(t) || "—"}: ${n} THIẾT BỊ`, phu: "phím bấm, cảm biến", la: [] }));
    const bang = [
      ...K.tu.map((t) => [t.tu, `${t.kenh.batTat} · ${t.kenh.dimmer} · ${t.kenh.rem}`, t.act.map((a) => `${TEN_KNX[a.kieu]} ${a.kenh} kênh`).join(", "), t.act.reduce((a, x) => a + x.module, 0)]),
      [K.tuHe, "hệ thống", K.he.map((x) => x.ten).join(", "), K.he.reduce((a, x) => a + x.module, 0)],
      ...[...theoTang].map(([t, n]) => [t || "—", "", `${n} phím bấm / cảm biến (${K.phong.filter((p) => p.tang === t).map((p) => p.phong).join(", ")})`, ""]),
    ];
    to.push({ loai: "dn", ma: "DN-KNX", ten: "KNX", du: {
      kieu: "cay", sheet: khungTen(info, soKnx, "SƠ ĐỒ TOPOLOGY KNX"),
      dinh: [{ ten: K.line > 1 ? `${K.line} × IP ROUTER KNX` : "GIAO DIỆN IP KNX", phu: `tủ ${K.tuHe}` },
        { ten: `${K.line} LINE · NGUỒN BUS ${K.nguon.ma} mA`, phu: `${K.nAct + K.nPhong + 1} thiết bị · ${Math.round(K.maLine)} mA/line` }],
      nhom: [
        ...(mucTu.length ? [{ ma: "BUS KNX — ACTUATOR TRONG TỦ ĐIỆN", tang: "", laTrungTam: false, truc: "", muc: mucTu }] : []),
        ...(mucPhong.length ? [{ ma: "BUS KNX — THIẾT BỊ TẠI PHÒNG", tang: "", laTrungTam: false, truc: "", muc: mucPhong }] : []),
      ],
      bang: { tieuDe: "THIẾT BỊ KNX THEO TỦ VÀ THEO TẦNG", cot: [["TỦ / TẦNG", 22], ["KÊNH BT · DIM · RÈM", 34], ["ACTUATOR / THIẾT BỊ", 130, "l"], ["MODULE", 18]], dong: bang },
      ghiChu: [
        `Mỗi mạch chiếu sáng / rèm đánh dấu KNX là 1 kênh actuator (rèm: số kênh = số lượng); số kênh + ${kq.quyTac.dienNhe.knx.duPhongKenh}% dự phòng. Actuator đặt trong tủ điện của mạch, đã tính vào số module và cỡ vỏ tủ.`,
        `Line ≤ ${kq.quyTac.dienNhe.knx.thietBiLine} thiết bị, dây bus ≤ ${kq.quyTac.dienNhe.knx.busMax} m/line; nguồn bus ≥ ${vn(kq.quyTac.dienNhe.knx.kNguon)} × Σ dòng (${kq.quyTac.dienNhe.knx.maThietBi} mA/thiết bị). Nguồn bus và giao diện IP đặt ở tủ ${K.tuHe}.`,
        `Dây bus KNX J-Y(St)Y 2×2×0,8 đi riêng ống với cáp điện; chiều dài ước tính ≈ ${Math.round(K.busL)} m (Σ chiều dài phòng + cáp cấp tủ).`,
      ],
    } });
  }
  return { to, soTheoRack };
}
const so1 = (x) => Number(x).toFixed(1).replace(".", ",");
