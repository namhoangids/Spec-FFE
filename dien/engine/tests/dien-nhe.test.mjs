// Điện nhẹ đợt 1: switch, PoE, patch panel, NVR, rack, UPS, mã cổng TIA-606, trục, nguồn rack vào tủ điện, BOQ, Excel.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import XLSX from "xlsx";

import { taoBoBanVe } from "../../bo-ban-ve.mjs";
import { tinhBoq } from "../boq.mjs";
import { docExcel } from "../doc-excel.mjs";
import { tinhDienNhe } from "../dien-nhe.mjs";
import { taoQuyTac } from "../quy-tac.mjs";

const rule = taoQuyTac();
const phong = (tang, ten, data, ap, camTrong, camNgoai, L, rack = "R1") => ({ tang, phong: ten, data, ap, camTrong, camNgoai, L, rack });
const tim = (ds, muc, chu) => ds.filter((c) => c.muc === muc && c.noiDung.includes(chu));

test("một rack: switch thường cho ổ data, switch PoE cho AP + camera, patch panel, NVR, U, UPS, mã cổng", () => {
  const dn = {
    phong: [phong("T1", "P.khách", 6, 3, 2, 3, 20), phong("T2", "P.ngủ", 6, 4, 4, 0, 25)],
    rack: [{ ma: "R1", tang: "T1", capTu: "T1", trungTam: true }],
  };
  const kq = tinhDienNhe(dn, rule, { panels: [{ ma: "T1" }] });
  const r = kq.rack[0];
  assert.deepEqual(r.dem, { data: 12, tv: 0, ap: 7, cam: 9, chuong: 0, acs: 0, cua: 0, lienKet: 28 });
  // 12 ổ data × 1,2 = 14,4 → 15 cổng → switch 16; 16 thiết bị PoE → 20 cổng → switch PoE 24
  assert.deepEqual(r.switch.map((s) => [s.loai, s.cong]), [["thuong", 16], ["poe", 24]]);
  // PoE: (7 × 20 + 9 × 10) × 1,2 = 276 W ≤ 370 W
  assert.equal(r.poe.tai, 230);
  assert.ok(Math.abs(r.poe.can - 276) < 1e-9);
  assert.equal(r.poe.nganSach, 370);
  assert.equal(r.soPP, 2);
  // NVR: 9 camera × 4 Mbps × 86 400 s × 30 ngày / 8 = 11,664 TB → 2 ổ 8 TB, 16 kênh (9 × 1,2 = 10,8 → 11)
  assert.equal(kq.nvr.kenh, 16);
  assert.ok(Math.abs(kq.nvr.tb - 11.664) < 1e-9);
  assert.equal(kq.nvr.soHdd, 2);
  // Rack trung tâm có switch lõi (2 switch truy cập), router, kệ modem, NVR
  assert.equal(r.switchLoi.cong, 8);
  assert.ok(["router", "ke", "nvr", "pdu", "ups"].every((l) => r.thietBi.some((x) => x.loai === l)));
  // U: 2 PP + 2 quản lý + 3 switch + router + kệ + NVR + PDU + UPS 2U = 13U × 1,3 = 16,9 → 20U, tủ đứng
  assert.equal(r.uTong, 13);
  assert.equal(r.uRack, 20);
  assert.equal(r.kieuRack, "đứng");
  // UPS: (12 + 35 + 8 + 20 + 10 + 15 + 2 × 8 + 230) W = 346 W / 0,9 × 1,25 = 480,6 VA → 1000 VA
  assert.equal(Math.round(r.w), 346);
  assert.equal(r.ups.va, 1000);
  // Mã cổng: <Tầng rack>-<Rack>-PP<n>-<cổng>; link thứ 25 sang patch panel 2
  assert.equal(r.lienKet[0].ma, "T1-R1-PP1-01");
  assert.equal(r.lienKet[24].ma, "T1-R1-PP2-01");
  assert.equal(r.lienKet.filter((x) => x.loai === "CAM").at(-1).thietBi, "CAM-09");
  // Nguồn: mạch DN1 tự thêm vào tủ T1, P = tải × 1,25 làm tròn 10 W
  assert.deepEqual(kq.machThem.map((m) => [m.tu, m.ma, m.congSuat, m.loai]), [["T1", "DN1", 440, "Thiết bị điện nhẹ (rack, NVR, KNX)"]]);
});

test("ngân sách PoE quyết định số switch; NVR chọn theo số khay ổ cứng", () => {
  const vua = tinhDienNhe({ phong: [phong("T1", "Sảnh", 0, 20, 20, 0, 30)] }, rule, { panels: [{ ma: "T1" }] });
  // 40 × 1,2 = 48 cổng; (20 × 20 + 20 × 10) × 1,2 = 720 W ≤ 740 W → 1 switch PoE 48
  assert.deepEqual(vua.rack[0].switch.map((s) => [s.cong, s.poe]), [[48, 740]]);
  const vuot = tinhDienNhe({ phong: [phong("T1", "Sảnh", 0, 30, 10, 0, 30)] }, rule, { panels: [{ ma: "T1" }] });
  // (30 × 20 + 10 × 10) × 1,2 = 840 W > 740 W → 2 switch PoE 48
  assert.deepEqual(vuot.rack[0].switch.map((s) => s.cong), [48, 48]);
  assert.equal(vuot.rack[0].poe.nganSach, 1480);
  // 30 camera: 38,9 TB → 5 ổ 8 TB; NVR 32 kênh chỉ 4 khay → chọn 64 kênh (8 khay)
  const cam = tinhDienNhe({ phong: [phong("T1", "Bãi xe", 0, 0, 0, 30, 40)] }, rule, { panels: [{ ma: "T1" }] });
  assert.equal(cam.nvr.soHdd, 5);
  assert.equal(cam.nvr.kenh, 64);
});

test("cảnh báo: Cat6 > 90 m, thiếu chiều dài, rack chưa khai; trục về rack trung tâm: Cat6 hoặc cáp quang", () => {
  const kq = tinhDienNhe({
    phong: [phong("T1", "Sảnh", 2, 1, 0, 0, 20), phong("T3", "Kho xa", 1, 0, 0, 0, 120, "R2"), phong("T2", "P.ngủ", 2, 0, 0, 0, undefined, "R3"), phong("B1", "Hầm", 0, 0, 2, 0, 30, "R4")],
    rack: [{ ma: "R1", tang: "T1", trungTam: true }, { ma: "R2", tang: "T3", lTruc: 120 }, { ma: "R3", tang: "T2", lTruc: 40 }],
  }, rule, { panels: [{ ma: "MDB" }, { ma: "T2", capTu: "MDB" }] });
  assert.equal(tim(kq.canhBao, "canhbao", "dài 120 m > 90 m").length, 1);
  assert.equal(tim(kq.canhBao, "ghichu", "Chưa có chiều dài cáp ngang (P.ngủ)").length, 1);
  assert.equal(kq.rack.find((r) => r.ma === "R3").lienKet[0].L, rule.dienNhe.lMacDinh);
  assert.equal(tim(kq.canhBao, "canhbao", "Rack R4 chưa khai").length, 1);
  const r = (ma) => kq.rack.find((x) => x.ma === ma);
  assert.equal(r("R2").truc.loai, "quang");
  assert.equal(r("R3").truc.loai, "cat6");
  assert.equal(r("R1").truc, undefined);
  assert.equal(tim(kq.canhBao, "canhbao", "Chưa có chiều dài trục từ rack R4").length, 1);
  // NVR đặt ở rack trung tâm dù camera ở rack R4; nguồn rack chưa khai tủ → tủ gốc MDB
  assert.ok(r("R1").thietBi.some((x) => x.loai === "nvr"));
  assert.ok(kq.machThem.every((m) => m.tu === "MDB"));
  assert.deepEqual(kq.machThem.map((m) => m.ma), ["DN1", "DN2", "DN3", "DN4"]);
});

test("cả bộ: mạch nguồn rack vào tủ điện (có CB, cáp, ngắn mạch), tờ E.700–E.702, BOQ nhóm F, mạch nguồn có sẵn thì chỉ kiểm", () => {
  const duAn = {
    info: { ikNguon: 6, project: "THỬ" },
    panels: [{ ma: "T1", soPha: 1, lCap: 10 }],
    circuits: [{ tu: "T1", ma: "L1", loai: "Chiếu sáng trong nhà", congSuat: 300, L: 10 }],
    dienNhe: { phong: [phong("T1", "P.khách", 4, 2, 2, 1, 25)], rack: [{ ma: "R1", tang: "T1", capTu: "T1", lNguon: 6, trungTam: true }] },
  };
  const bo = taoBoBanVe(duAn);
  const dn1 = bo.kq.tu[0].mach.find((m) => m.ma === "DN1");
  assert.ok(dn1?.thietBi && dn1.cap?.s, "mạch DN1 có thiết bị và cáp");
  assert.equal(dn1.L, 6);
  assert.ok(dn1.nganMach?.ik1Cuoi > 0, "mạch nguồn rack cũng được tính ngắn mạch");
  assert.match(dn1.nguon.ghiChu, /xem E\.702/);
  assert.deepEqual(bo.to.filter((x) => x.loai === "dn").map((x) => x.du.sheet.drawingNo), ["E.700", "E.701", "E.702"]);
  assert.ok(bo.to.filter((x) => x.loai === "dn").every((x) => x.svg.includes("<svg") && x.dxf().includes("SECTION")));
  const boq = tinhBoq(bo.kq);
  const f = boq.dong.filter((d) => d.nhom === "dienNhe");
  assert.equal(f.find((d) => d.khoa === "Cáp Cat6 U/UTP 4 đôi").kl, Math.ceil(9 * 25 * 1.05));
  assert.equal(f.find((d) => d.khoa === "Camera IP ngoài trời PoE (IP66)").kl, 1);
  assert.equal(f.find((d) => d.khoa === "Mặt + nhân ổ data RJ45 Cat6").kl, 4);
  const wb = bo.dienNheExcel(XLSX);
  assert.deepEqual(wb.SheetNames, ["Tong hop", "Thiet bi rack", "Dau noi", "Canh bao"]);
  assert.match(bo.thuyetMinhHtml(), /06<\/span>[\s\S]*HỆ THỐNG ĐIỆN NHẸ[\s\S]*07<\/span>[\s\S]*KIỂM TRA VÀ KẾT LUẬN/);

  // Rack khai mã lộ có sẵn: không thêm mạch, cảnh báo nếu công suất mạch nhỏ hơn cần
  const coSan = structuredClone(duAn);
  coSan.circuits.push({ tu: "T1", ma: "S9", loai: "Ổ cắm thông thường", congSuat: 100, L: 6 });   // tải rack 154 W × 1,25 = 200 W
  coSan.dienNhe.rack[0].maMach = "S9";
  const bo2 = taoBoBanVe(coSan);
  assert.equal(bo2.kq.tu[0].mach.filter((m) => /^DN/.test(m.ma)).length, 0);
  assert.equal(tim(bo2.kq.canhBao, "canhbao", "Mạch T1/S9 cấp rack R1 có 100 W < cần 200 W").length, 1);
});

test("đọc Excel: sheet Dien nhe (có chiều dài), Tu rack, tham số ELV ở sheet Quy tac", () => {
  const d = docExcel(XLSX, readFileSync(new URL("../../mau/nhap-lieu-tu-dien.xlsx", import.meta.url)));
  assert.equal(d.dienNhe.phong.length, 4);
  assert.equal(d.dienNhe.phong[3].L, 35);
  assert.equal(d.dienNhe.phong[3].camNgoai, 4);
  assert.deepEqual(d.dienNhe.rack.map((r) => [r.ma, r.capTu, r.trungTam]), [["R1", "DB-T1", true]]);
  assert.equal(d.quyTac.dienNhe.poeAp, 20);
  // Dự án không có điện nhẹ: không có tờ E.7xx, không có dien-nhe.xlsx
  const bo = taoBoBanVe({ info: {}, panels: [{ ma: "T1", soPha: 1 }], circuits: [{ tu: "T1", ma: "L1", loai: "Chiếu sáng trong nhà", congSuat: 300, L: 10 }] });
  assert.equal(bo.to.filter((x) => x.loai === "dn").length, 0);
  assert.equal(bo.dienNheExcel(XLSX), null);
});
