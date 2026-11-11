// Bóc khối từ mặt bằng AutoCAD (DATAEXTRACTION): đọc file, quy đổi block, áp vào mạch, báo block lạ, BOQ nhóm E.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import XLSX from "xlsx";

import { taoBoBanVe } from "../../bo-ban-ve.mjs";
import { apDungBocKhoi, docBocKhoi, docQuyDoi, xuatBaoCaoBocKhoi } from "../boc-khoi.mjs";
import { DB_T1 } from "./du-lieu-db-t1.mjs";

const mau = (f) => readFileSync(new URL(`../../mau/vi-du-boc-khoi/${f}`, import.meta.url));
const canHo = () => JSON.parse(readFileSync(new URL("../../du-an/can-ho-3pn-3-pha/du-an.json", import.meta.url), "utf8"));
const csv = (s) => new TextEncoder().encode(s);

test("đọc file: BOM, chấm phẩy, ngoặc kép, tiêu đề tiếng Việt có/không dấu, dòng tiêu đề bảng ở trên, xlsx", () => {
  const a = docBocKhoi(XLSX, csv('﻿BẢNG BÓC KHỐI\nSố lượng;Tên block;Mạch;Công suất\n3;"DEN_DL; LOẠI 1";L1;"12"\n'));
  assert.deepEqual(a.dong, [{ ten: "DEN_DL; LOẠI 1", sl: 3, tu: "", mach: "L1", w: 12, phong: "", layer: "" }]);
  const b = docBocKhoi(XLSX, csv("SO LUONG,TEN BLOCK,TU\n2,OCAM_DOI,DB-T1\n"));
  assert.equal(b.dong[0].tu, "DB-T1");
  // Excel: cùng cách nhận cột
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["Count", "Name", "Layer"], [5, "OCAM_DOI", "E-OCAM"]]), "Summary");
  const c = docBocKhoi(XLSX, XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
  assert.deepEqual(c.dong[0], { ten: "OCAM_DOI", sl: 5, tu: "", mach: "", w: null, phong: "", layer: "E-OCAM" });
  assert.throws(() => docBocKhoi(XLSX, csv("Layer,X\nA,1\n")), /thiếu cột tên block .* và số lượng/);
});

test("kiểu thuộc tính: P mạch = Σ số lượng × W, CS trên block thắng bảng quy đổi, công tắc không tính W, mạch mới có cảnh báo", () => {
  const { dong } = docBocKhoi(XLSX, mau("boc-khoi-thuoc-tinh.csv"));
  const goc = canHo();
  const { duAn, baoCao } = apDungBocKhoi(goc, dong, { tenFile: "tt.csv" });
  const mach = (ma) => duAn.circuits.find((c) => c.tu === "CH" && c.ma === ma);
  assert.equal(mach("L1").congSuat, 14 * 9 + 12 * 10);          // downlight 9 W + hắt LED 10 W/m; 6 công tắc = 0 W
  assert.equal(mach("L3").congSuat, 4 * 9 + 2 * 12 + 2 * 30);
  assert.equal(mach("S5").congSuat, 4 * 750, "CS = 750 W trên block thắng 200 W của bảng quy đổi");
  assert.match(mach("L1").ghiChu, /^bóc khối \(tt\.csv\): 14 × Đèn downlight/);
  assert.doesNotMatch(mach("L1").ghiChu, /giả định/, "bỏ ghi chú giả định cũ");
  assert.equal(mach("L1").soLuong, 1);
  // Mạch chưa có trong dữ liệu → tạo mới, loại mạch theo block chiếm công suất lớn nhất
  const l4 = mach("L4");
  assert.equal(l4.loai, "Chiếu sáng ngoài nhà");
  assert.equal(l4.congSuat, 30);
  assert.ok(baoCao.canhBao.some((c) => c.mach === "L4" && /tạo mạch mới L4/.test(c.noiDung)));
  assert.deepEqual(baoCao.theoMach.find((m) => m.mach === "L1"), { tu: "CH", mach: "L1", moi: false, pCu: 660, pMoi: 246,
    thanhPhan: "14 × Đèn downlight LED âm trần 9 W + 12 × Đèn hắt LED dây 10 W + 6 × Công tắc" });
  // Dữ liệu gốc không bị sửa
  assert.equal(goc.circuits.find((c) => c.ma === "L1").congSuat, 660);
});

test("block lạ được liệt kê, không cộng công suất; có CS thì vẫn tính", () => {
  const dong = [
    { ten: "LOA_TRAN", sl: 4, tu: "CH", mach: "S1", w: null, phong: "", layer: "E-AM" },
    { ten: "BEP_DIEN_X", sl: 1, tu: "CH", mach: "S5", w: 2000, phong: "", layer: "" },
    { ten: "OCAM_DOI_3C", sl: 2, tu: "CH", mach: "S5", w: null, phong: "", layer: "" },
  ];
  const { duAn, baoCao } = apDungBocKhoi(canHo(), dong);
  assert.deepEqual(baoCao.khongNhanDien.map((k) => [k.ten, k.sl, k.coCs]), [["LOA_TRAN", 4, false], ["BEP_DIEN_X", 1, true]]);
  const s1 = duAn.circuits.find((c) => c.ma === "S1");
  assert.equal((s1.soLuong || 1) * s1.congSuat, 1200, "S1 chỉ có block lạ không CS → giữ nguyên (6 ổ × 200 W)");
  assert.equal(duAn.circuits.find((c) => c.ma === "S5").congSuat, 2000 + 2 * 200);
  assert.ok(baoCao.canhBao.some((c) => c.muc === "canhbao" && /LOA_TRAN/.test(c.noiDung)));
});

test("thiếu TU: tự tìm tủ duy nhất có mạch; mã mạch trùng ở nhiều tủ thì báo lỗi; tủ ghi sai thì báo lỗi", () => {
  const duAn = structuredClone(DB_T1);
  duAn.circuits.push({ tu: "MDB", ma: "C01", loai: "Chiếu sáng trong nhà", congSuat: 100, L: 10 });
  const { duAn: ra, baoCao } = apDungBocKhoi(duAn, [
    { ten: "DEN_DL", sl: 10, tu: "", mach: "C02", w: null, phong: "", layer: "" },
    { ten: "DEN_DL", sl: 10, tu: "", mach: "C01", w: null, phong: "", layer: "" },
    { ten: "DEN_DL", sl: 1, tu: "T9", mach: "C03", w: null, phong: "", layer: "" },
  ]);
  assert.equal(ra.circuits.find((c) => c.tu === "DB-T1" && c.ma === "C02").congSuat, 90);
  assert.ok(baoCao.canhBao.some((c) => c.muc === "loi" && /C01 có ở nhiều tủ \(DB-T1, MDB\)/.test(c.noiDung)));
  assert.ok(baoCao.canhBao.some((c) => c.muc === "loi" && /tủ "T9" không có/.test(c.noiDung)));
});

test("kiểu tên block: không sửa mạch, đếm theo loại / layer; bảng quy đổi riêng đặt trước bảng mẫu và khớp ký tự *", () => {
  const { dong } = docBocKhoi(XLSX, mau("boc-khoi-ten-block.csv"));
  const goc = canHo();
  const { duAn, baoCao } = apDungBocKhoi(goc, dong);
  assert.deepEqual(duAn.circuits, goc.circuits, "không sửa mạch nào");
  assert.equal(baoCao.cheDo, "tên block");
  assert.equal(baoCao.theoLoai.find((t) => t.moTa === "Ổ cắm đôi 3 chấu 16A").sl, 6 + 4 + 5 + 10);
  assert.equal(baoCao.theoNoi.filter((n) => n.layer === "E-WC").reduce((a, n) => a + n.sl, 0), 4 + 2 + 2 + 2);
  assert.deepEqual(baoCao.khongNhanDien.map((k) => k.ten), ["HOP_NOI"]);
  // Bảng riêng: HOP_* là hộp nối, chỉ đếm; DEN_DL* đổi thành 12 W
  const qdWb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(qdWb, XLSX.utils.aoa_to_sheet([
    ["Mẫu tên block", "Nhóm", "Mô tả", "Loại mạch", "W", "Tính công suất", "ĐVT"],
    ["HOP_*", "Thiết bị", "Hộp nối âm tường", "", 0, "Không", ""],
    ["den_dl*", "Đèn", "Đèn downlight 12W", "Chiếu sáng trong nhà", 12, "Có", ""],
  ]), "Quy doi block");
  const rieng = docQuyDoi(XLSX, XLSX.write(qdWb, { type: "buffer", bookType: "xlsx" }));
  assert.equal(rieng[0].tinhCongSuat, false);
  const r2 = apDungBocKhoi(goc, [...dong, { ten: "DEN_DL_9W", sl: 2, tu: "CH", mach: "L2", w: null, phong: "", layer: "" }], { quyDoi: rieng.concat([]) });
  assert.deepEqual(r2.baoCao.khongNhanDien.map((k) => k.ten).sort(), ["CT_DOI", "DEN_GUONG", "DEN_HAT_LED", "DEN_OP_24W", "OCAM_DOI", "OCAM_NUOC", "QUAT_HUT_WC"].sort(),
    "chỉ dùng bảng riêng thì các block khác thành lạ");
  assert.equal(r2.duAn.circuits.find((c) => c.ma === "L2").congSuat, 24);
});

test("cả bộ: áp bóc khối căn hộ 3PN → 0 lỗi, BOQ có nhóm E, báo cáo Excel đủ sheet", () => {
  const { dong } = docBocKhoi(XLSX, mau("boc-khoi-thuoc-tinh.csv"));
  const { duAn, baoCao } = apDungBocKhoi({ loiDoc: [], quyTac: {}, ...canHo() }, dong, { tenFile: "tt.csv" });
  const bo = taoBoBanVe(duAn);
  assert.equal(bo.kq.canhBao.filter((c) => c.muc === "loi").length, 0);
  const boq = bo.boq();
  const e = boq.dong.filter((d) => d.nhom === "thietBiDien");
  assert.equal(e.find((d) => d.khoa === "Đèn downlight LED âm trần").kl, 22);
  assert.equal(e.find((d) => d.khoa === "Đèn hắt LED dây").dvt, "m");
  assert.equal(e.find((d) => d.khoa === "Đèn hắt LED dây").kl, Math.ceil(12 * 1.05));
  const wb = xuatBaoCaoBocKhoi(XLSX, baoCao);
  assert.deepEqual(wb.SheetNames, ["Theo mach", "Theo loai", "Khong nhan dien", "Canh bao"]);
});
