// Điện nhẹ đợt 2: IPTV, chuông cửa IP, kiểm soát ra vào, âm thanh 100 V, KNX (actuator vào tủ điện), nhập liệu web, agent.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import XLSX from "xlsx";

import { goiYDauVao } from "../../agent/goi-y-dau-vao.mjs";
import * as NL from "../../app/nhap-lieu.mjs";
import { taoBoBanVe } from "../../bo-ban-ve.mjs";
import { tinhBoq } from "../boq.mjs";
import { docExcel } from "../doc-excel.mjs";
import { loaiKnx, tinhDienNhe } from "../dien-nhe.mjs";
import { taoQuyTac } from "../quy-tac.mjs";

const rule = taoQuyTac();
const R = rule.dienNhe;
const tim = (ds, muc, chu) => ds.filter((c) => c.muc === muc && c.noiDung.includes(chu));
const panels = [{ ma: "T1" }];

test("IPTV và ACS vào switch thường, chuông cửa IP vào switch PoE; bộ điều khiển ACS 4/2/1 cửa lắp cạnh tủ", () => {
  const kq = tinhDienNhe({ phong: [
    { tang: "T1", phong: "P.khách", data: 2, tv: 2, ap: 1, chuongTrong: 1, acs: 0, L: 15 },
    { tang: "T1", phong: "Cổng", chuongNgoai: 1, acs: 5, L: 30 },
  ] }, rule, { panels });
  const r = kq.rack[0];
  assert.deepEqual(r.dem, { data: 2, tv: 2, ap: 1, cam: 0, chuong: 2, acs: 2, cua: 5, lienKet: 9 });
  assert.deepEqual(r.acs.map((b) => b.cua), [4, 1], "5 cửa → bộ 4 cửa + bộ 1 cửa");
  // PoE: AP 20 + màn hình 8 + nút gọi 6 = 34 W
  assert.equal(r.poe.tai, R.poeAp + R.poeChuongTrong + R.poeChuongNgoai);
  // switch thường: 2 data + 2 TV + 2 bộ ACS = 6 × 1,2 → 8 cổng
  assert.deepEqual(r.switch.map((s) => [s.loai, s.cong]), [["thuong", 8], ["poe", 8]]);
  const acsTb = r.thietBi.filter((x) => x.loai === "acs");
  assert.equal(acsTb.length, 2);
  assert.ok(acsTb.every((x) => x.u === 0 && x.w === R.acsW), "lắp cạnh tủ, tính vào tải UPS");
  assert.equal(kq.acs.cua.length, 5);
  assert.equal(tim(kq.canhBao, "ghichu", "liên động với tủ báo cháy").length, 1);
  assert.equal(r.lienKet.find((x) => x.loai === "ACS").ma, "T1-R1-PP1-08");
});

test("âm thanh 100 V: ≤ 6 vùng dùng 1 ampli mixer; vùng lớn tách ampli; nguồn ampli là mạch riêng ngoài UPS", () => {
  const nho = tinhDienNhe({ phong: [
    { tang: "T1", phong: "P.khách", loa: 4, loaW: 6, vungAm: "V1", L: 15 },
    { tang: "T1", phong: "Bếp", loa: 2, vungAm: "V2", L: 15 },
  ] }, rule, { panels });
  const r = nho.rack[0];
  assert.equal(r.ampli.length, 1);
  assert.equal(r.ampli[0].mixer, true);
  assert.equal(r.ampli[0].W, 4 * 6 + 2 * R.loaWMacDinh);
  assert.equal(r.ampli[0].ra, 60, "36 W × 1,25 = 45 W → 60 W");
  assert.equal(tim(nho.canhBao, "ghichu", "Chưa có công suất tap loa").length, 1);
  assert.deepEqual(nho.machThem.map((m) => [m.ma, m.congSuat]), [["DN1", Math.ceil(r.w * R.kUps / 10) * 10], ["DN2", 60 * R.kTieuThuAmpli]]);
  assert.ok(r.thietBi.some((x) => x.loai === "ampli" && x.u === 2 && x.w === 0), "ampli không tính vào tải UPS");
  const lon = tinhDienNhe({ phong: [
    { tang: "T1", phong: "Hội trường", loa: 50, loaW: 10, vungAm: "A", L: 20 },
    { tang: "T1", phong: "Sân", loa: 30, loaW: 10, vungAm: "B", L: 20 },
  ] }, rule, { panels });
  assert.deepEqual(lon.rack[0].ampli.map((a) => [a.ra, a.mixer]), [[650, false], [480, false]], "500 W × 1,25 → 650; 300 W × 1,25 → 480");
});

test("KNX: kênh actuator theo mạch đánh dấu, + 20% dự phòng; module vào vỏ tủ; nguồn bus, giao diện IP ở tủ gốc; nhiều line", () => {
  assert.deepEqual(["Bật/tắt", "Dimmer", "Rèm", "", "Không"].map(loaiKnx), ["batTat", "dimmer", "rem", null, null]);
  const circuits = [
    ...[1, 2, 3, 4, 5].map((i) => ({ tu: "T2", ma: `L${i}`, loai: "Chiếu sáng trong nhà", congSuat: 200, L: 10, knx: "Bật/tắt" })),
    ...[6, 7, 8].map((i) => ({ tu: "T2", ma: `L${i}`, loai: "Chiếu sáng trong nhà", congSuat: 200, L: 10, knx: "Dimmer" })),
    { tu: "T2", ma: "R2", loai: "Động cơ (bơm, quạt)", phuTai: "RÈM", soLuong: 3, congSuat: 100, L: 10, knx: "Rèm" },
  ];
  const duAn = {
    info: { ikNguon: 6 }, panels: [{ ma: "T1", soPha: 3, lCap: 10 }, { ma: "T2", capTu: "T1", soPha: 1, lCap: 15 }], circuits,
    dienNhe: { phong: [{ tang: "T2", phong: "P.ngủ", knx: 4, L: 20 }] },
  };
  const bo = taoBoBanVe(duAn);
  const K = bo.dienNhe.knx;
  const t2 = K.tu.find((t) => t.tu === "T2");
  assert.deepEqual(t2.kenh, { batTat: 5, dimmer: 3, rem: 3 });
  // 5 × 1,2 = 6 → 8 kênh; 3 × 1,2 = 3,6 → 4 kênh dimmer; rèm 3 kênh × 1,2 → 4 kênh
  assert.deepEqual(t2.act.map((a) => [a.kieu, a.kenh, a.module]), [["batTat", 8, 8], ["dimmer", 4, 8], ["rem", 4, 4]]);
  assert.equal(bo.dienNhe.rack.length, 0, "chỉ KNX thì không cần rack");
  const tuT2 = bo.kq.tu.find((t) => t.ma === "T2");
  assert.ok(tuT2.module.chiTiet.some(([ten, n]) => /Actuator KNX dimmer 4 kênh/.test(ten) && n === 8), "actuator tính vào module tủ T2");
  const tuT1 = bo.kq.tu.find((t) => t.ma === "T1");
  assert.ok(tuT1.module.chiTiet.some(([ten]) => /Nguồn bus KNX/.test(ten)) && tuT1.module.chiTiet.some(([ten]) => /Giao diện IP KNX/.test(ten)));
  assert.equal(K.line, 1);
  assert.equal(K.nAct + K.nPhong + 1, 3 + 4 + 1);
  assert.deepEqual(bo.to.filter((x) => x.loai === "dn").map((x) => x.ma), ["DN-KNX"]);
  const boq = tinhBoq(bo.kq).dong.filter((d) => d.nhom === "dienNhe");
  assert.equal(boq.find((d) => d.khoa === "Phím bấm / cảm biến KNX").kl, 4);
  assert.equal(boq.find((d) => d.khoa === "Actuator KNX bật/tắt 8 kênh").kl, 1);

  // Mỗi line ≤ ⌊640 / (10 × 1,2)⌋ = 53 thiết bị: 100 phím + 2 router = 102 → 2 line, mỗi line nguồn 640 mA + IP router
  const nhieu = tinhDienNhe({ phong: [{ tang: "T1", phong: "Khu A", knx: 100, L: 800 }] }, rule, { panels, circuits: [] });
  assert.equal(nhieu.knx.line, 2);
  assert.ok(nhieu.knx.maLine <= 640);
  assert.equal(nhieu.knx.he.filter((x) => /IP router/.test(x.ten)).length, 2);
  assert.deepEqual(nhieu.knx.he.filter((x) => /Nguồn bus/.test(x.ten)).map((x) => x.ten), ["Nguồn bus KNX 640 mA (line 1)", "Nguồn bus KNX 640 mA (line 2)"]);
  assert.equal(tim(nhieu.canhBao, "ghichu", "chưa có mạch nào đánh dấu").length, 1);
  // Dây bus 2 500 m > 1 000 m/line → 3 line dù chỉ 30 thiết bị
  const dai = tinhDienNhe({ phong: [{ tang: "T1", phong: "Khu B", knx: 30, L: 2500 }] }, rule, { panels, circuits: [] });
  assert.equal(dai.knx.line, 3);
  assert.equal(tim(dai.canhBao, "ghichu", "chia 3 line").length, 1);
});

test("nhập liệu web: thêm điện nhẹ, đổi mã rack thì phòng đi theo, trung tâm chỉ một rack, xóa rack còn phòng bị chặn", () => {
  let d = NL.themDienNhe({ info: {}, panels: [{ ma: "MDB" }, { ma: "T2", capTu: "MDB" }], circuits: [] });
  assert.equal(d.dienNhe.rack[0].capTu, "MDB");
  d = NL.themPhongDn(d, 0);
  assert.equal(d.dienNhe.phong.length, 2);
  assert.equal(d.dienNhe.phong[1].rack, "R1");
  d = NL.suaPhongDn(d, 1, "acs", 2);
  d = NL.themRack(d).duAn;
  d = NL.suaRack(d, 0, "ma", "RACK-A");
  assert.ok(d.dienNhe.phong.every((p) => p.rack === "RACK-A"));
  d = NL.suaRack(d, 1, "trungTam", "Có");
  assert.deepEqual(d.dienNhe.rack.map((r) => r.trungTam), [false, true]);
  assert.match(NL.xoaRack(d, 0).loi, /còn phục vụ 2 phòng/);
  const xoa = NL.xoaRack(d, 1);
  assert.equal(xoa.loi, undefined);
  assert.equal(xoa.duAn.dienNhe.rack[0].trungTam, true, "rack còn lại thành trung tâm");
  assert.ok(NL.veNhapLieuDn(d, null).includes('data-dong="rack"'));
  assert.ok(NL.COT_MACH.some(([k]) => k === "knx"));
});

test("agent: dienNhe / knx trong mô tả → bảng phòng, rack, mạch KNX; không bật thì không có điện nhẹ", () => {
  const moTa = JSON.parse(readFileSync(new URL("../../agent/vi-du/mo-ta-biet-thu.json", import.meta.url), "utf8"));
  assert.equal(goiYDauVao(moTa).duAn.dienNhe, undefined);
  const { duAn, giaDinh } = goiYDauVao({ ...moTa, dienNhe: true, knx: true });
  const dn = duAn.dienNhe;
  assert.equal(dn.rack.length, 1);
  assert.equal(dn.rack[0].trungTam, true);
  assert.ok(dn.phong.some((p) => p.chuongNgoai === 1 && p.acs === 1), "cổng có nút gọi chuông và cửa ACS");
  assert.ok(dn.phong.every((p) => p.ghiChu === "giả định"));
  assert.ok(duAn.circuits.filter((c) => /^Chiếu sáng/.test(c.loai)).every((c) => c.knx === "Bật/tắt"));
  assert.ok(giaDinh.some((s) => /Điện nhẹ theo bảng điển hình/.test(s)));
  const bo = taoBoBanVe(duAn);
  assert.equal(bo.kq.canhBao.filter((c) => c.muc === "loi").length, 0);
  assert.ok(bo.to.some((x) => x.ma === "DN-AM") && bo.to.some((x) => x.ma === "DN-ACS") && bo.to.some((x) => x.ma === "DN-KNX"));
});

test("Excel: cột Điều khiển KNX ở sheet Mach; ví dụ HDMON có đủ 6 tờ điện nhẹ", () => {
  const d = docExcel(XLSX, readFileSync(new URL("../../mau/vi-du-HDMON.xlsx", import.meta.url)));
  assert.equal(d.circuits.find((c) => c.tu === "T1" && c.ma === "L2").knx, "Dimmer");
  assert.equal(d.circuits.find((c) => c.tu === "T3" && c.ma === "R3").knx, "Rèm");
  const bo = taoBoBanVe(d);
  assert.deepEqual(bo.to.filter((x) => x.loai === "dn").map((x) => x.du.sheet.drawingNo), ["E.700", "E.701", "E.702", "E.703", "E.704", "E.705"]);
  assert.equal(bo.kq.canhBao.filter((c) => c.muc === "loi").length, 0);
  assert.deepEqual(bo.dienNheExcel(XLSX).SheetNames, ["Tong hop", "Thiet bi rack", "Dau noi", "Am thanh", "ACS chuong", "KNX", "Canh bao"]);
});
