// BOQ điện: đếm thiết bị, bóc dây/cáp/ống, không tính trùng cáp cấp tủ con, bảng giá và công thức Excel.
import assert from "node:assert/strict";
import { test } from "node:test";

import XLSX from "xlsx";

import { tinhDuAn } from "../index.mjs";
import { docBangGia, tinhBoq, xuatBoqExcel } from "../boq.mjs";
import { DB_T1 } from "./du-lieu-db-t1.mjs";

const kqMau = () => tinhDuAn(structuredClone(DB_T1));
const tho = (boq, khoa) => boq.dong.find((d) => d.khoa === khoa)?.tho ?? 0;

test("thiết bị: mỗi CB trên sơ đồ (mạch ra, lộ cấp, dự phòng, RCBO nhóm, CB tổng) đếm đúng một lần", () => {
  const kq = kqMau();
  const boq = tinhBoq(kq);
  const soCB = kq.tu.reduce((a, t) => a + t.mach.filter((m) => m.thietBi).length + (t.nhomRcd || []).length + (t.cbTong ? 1 : 0), 0);
  const demBoq = boq.dong.filter((d) => d.nhom === "thietBi").reduce((a, d) => a + d.kl, 0);
  assert.equal(demBoq, soCB);
  // Vỏ tủ: mỗi tủ một vỏ; SPD ở tủ gốc; đèn báo pha cho tủ 3 pha
  assert.equal(boq.dong.filter((d) => d.khoa.startsWith("Vỏ tủ")).reduce((a, d) => a + d.kl, 0), kq.tu.length);
  assert.equal(tho(boq, "Chống sét lan truyền SPD loại 2 3P+N"), kq.tu.filter((t) => t.coSpd).length);
  assert.equal(tho(boq, "Đèn báo pha (bộ 3 đèn)"), kq.tu.filter((t) => t.soPha === 3).length);
});

test("dây/cáp: dây đơn = số dây × L, PE riêng; cáp cấp tủ con chỉ tính một lần ở tủ trên; tủ gốc chưa có L thì ghi thiếu", () => {
  const kq = kqMau();
  const boq = tinhBoq(kq, { haoHut: 0 });
  const db = kq.tu.find((t) => t.ma === "DB-T1");
  // Dây đơn 2,5 mm²: cộng n dây × L của các mạch ra dùng 2,5 mm² dây đơn
  const ky = (m) => m.cap?.s && m.cap.kieu !== "nhieuLoi" && !m.kieu?.duPhong;
  const mong = kq.tu.flatMap((t) => t.mach).filter((m) => ky(m) && m.cap.s === 2.5).reduce((a, m) => a + m.cap.soDay * m.L, 0);
  assert.equal(tho(boq, "Dây Cu/PVC 1x2,5mm2"), mong);
  // Cáp cấp DB-T1 (lộ S1 của MDB): một sợi × 30 m, không cộng thêm lần nữa từ capNguon của DB-T1
  const khoaCap = `Cáp Cu/XLPE/PVC ${db.capNguon.soLoi}x${String(db.capNguon.s).replace(".", ",")}mm2`;
  assert.equal(tho(boq, khoaCap), 30);
  assert.equal(boq.chiTiet.filter((c) => c.khoa === khoaCap).length, 1);
  assert.deepEqual(boq.thieuL, ["MDB/cáp nguồn"]);
  // Ống: mọi đoạn có ống đều được cộng chiều dài
  const ong = boq.dong.filter((d) => d.nhom === "ong").reduce((a, d) => a + d.tho, 0);
  const coOng = kq.tu.flatMap((t) => t.mach).filter((m) => m.cap?.s && !m.kieu?.duPhong && /Ø/.test(m.ghiDe?.ong || m.ong || "")).reduce((a, m) => a + m.L, 0);
  assert.equal(ong, coOng);
});

test("hao hụt cộng vào dây/cáp/ống rồi làm tròn lên mét; không cộng vào thiết bị", () => {
  const kq = kqMau();
  const a = tinhBoq(kq, { haoHut: 0 }), b = tinhBoq(kq, { haoHut: 10 });
  for (const d of b.dong) {
    const goc = a.dong.find((x) => x.khoa === d.khoa);
    assert.equal(d.kl, d.dvt === "m" ? Math.ceil(goc.kl * 1.1 - 1e-9) : goc.kl, d.khoa);
  }
});

test("bảng giá: đọc số kiểu Việt Nam, khớp theo khóa; Excel tra giá bằng công thức và có giá trị tính sẵn", () => {
  const bgWb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(bgWb, XLSX.utils.aoa_to_sheet([
    ["Bảng giá: Schneider thử"], ["Ngày áp dụng: 01/11/2026"],
    ["Khóa", "Mã hàng", "Đơn giá", "Chiết khấu (%)", "Ghi chú"],
    ["Dây Cu/PVC 1x2,5mm2", "CV2.5", "9.500", "10", ""],
    ["Khóa không dùng", "X", 1, 0, ""],
  ]), "Bang gia");
  const bangGia = docBangGia(XLSX, XLSX.write(bgWb, { type: "buffer", bookType: "xlsx" }));
  assert.equal(bangGia.ten, "Schneider thử");
  assert.equal(bangGia.ngay, "01/11/2026");
  assert.deepEqual(bangGia.gia.get("Dây Cu/PVC 1x2,5mm2"), { maHang: "CV2.5", donGia: 9500, chietKhau: 10, ghiChu: "" });

  const boq = tinhBoq(kqMau());
  const wb = xuatBoqExcel(XLSX, boq, { project: "VD" }, { bangGia });
  assert.deepEqual(wb.SheetNames, ["BOQ", "Bang gia", "Chi tiet"]);
  const rows = XLSX.utils.sheet_to_json(wb.Sheets.BOQ, { header: 1, defval: null });
  const i = rows.findIndex((r) => r[1] === "Dây Cu/PVC 1x2,5mm2");
  const ws = wb.Sheets.BOQ;
  const o = (c) => ws[XLSX.utils.encode_cell({ r: i, c })];
  assert.match(o(5).f, /VLOOKUP\(\$B\d+,'Bang gia'!\$A:\$E,3,FALSE\)/);
  assert.equal(o(7).v, Math.round(rows[i][3] * 9500 * 0.9));
  const tong = ws[XLSX.utils.encode_cell({ r: rows.findIndex((r) => r[1] === "TỔNG CỘNG (chưa VAT)"), c: 7 })];
  assert.match(tong.f, /^SUM\(H\d+:H\d+\)$/);
  assert.equal(tong.v, o(7).v, "chỉ một dòng có giá nên tổng bằng dòng đó");
  // Sheet Bang gia: đủ mọi khóa của BOQ, thêm khóa lẻ của bảng giá đã nạp
  const khoaBg = XLSX.utils.sheet_to_json(wb.Sheets["Bang gia"], { header: 1 }).slice(3).map((r) => r[0]);
  assert.deepEqual(khoaBg, [...boq.dong.map((d) => d.khoa), "Khóa không dùng"]);
  // Ghi chú thiếu chiều dài cáp nguồn hiện trên BOQ
  assert.ok(rows.some((r) => /Chưa tính dây\/cáp\/ống cho: MDB\/cáp nguồn/.test(r[1] ?? "")));
});
