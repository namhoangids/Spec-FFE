// Đọc file Excel mẫu (dien/mau) → tinhDuAn. Chạy: npm test (trong dien/)
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import XLSX from "xlsx";

import { docExcel, docSo, tinhDuAn } from "../index.mjs";

const doc = (ten) => docExcel(XLSX, readFileSync(new URL(`../../mau/${ten}`, import.meta.url)));

test("docSo đọc số kiểu Việt Nam", () => {
  assert.equal(docSo("0,85"), 0.85);
  assert.equal(docSo(12), 12);
  assert.equal(docSo(""), null);
  assert.equal(docSo("abc"), null);
});

test("file mẫu DB-T1: đọc đủ và ra đúng kết quả mục 7", () => {
  const duAn = doc("nhap-lieu-tu-dien.xlsx");
  assert.deepEqual(duAn.loiDoc, []);
  assert.equal(duAn.info.soBanVeDau, "E.601");
  assert.deepEqual(duAn.panels.map((p) => [p.ma, p.capTu ?? null, p.soPha, p.lCap ?? null]), [["MDB", null, 3, null], ["DB-T1", "MDB", 3, 30]]);
  assert.equal(duAn.circuits.length, 13);
  assert.equal(duAn.quyTac.loaiMach["Ổ cắm thông thường"].rcd, "30mA");
  assert.equal(duAn.quyTac.loaiMach["Chiếu sáng trong nhà"].rcd, "khong");
  assert.equal(duAn.quyTac.lambda, 0.00008);
  const kq = tinhDuAn(duAn);
  const t = kq.tu.find((x) => x.ma === "DB-T1");
  assert.equal(t.cbTong.in, 40);
  assert.equal(t.capNguon.s, 6);
  assert.equal(t.module.voTu, 36);
  assert.equal(kq.canhBao.filter((c) => c.muc === "loi").length, 0);
  assert.ok(kq.canhBao.some((c) => c.muc === "ghichu" && c.noiDung.includes("Dự phòng cho ổ cắm bếp")));
});

test("ví dụ HDMON: 6 tủ, lộ cấp đặt sau TM theo thứ tự S5…S9, không có lỗi", () => {
  const duAn = doc("vi-du-HDMON.xlsx");
  assert.deepEqual(duAn.loiDoc, []);
  const kq = tinhDuAn(duAn);
  assert.deepEqual(kq.tu.map((t) => t.ma), ["T1", "T2", "T3", "T4", "T5", "T6"]);
  const t1 = kq.tu[0];
  const ma = t1.mach.map((m) => m.ma);
  assert.deepEqual(ma.slice(ma.indexOf("TM"), ma.indexOf("TM") + 6), ["TM", "S5", "S6", "S7", "S8", "S9"]);
  assert.equal(kq.canhBao.filter((c) => c.muc === "loi").length, 0, JSON.stringify(kq.canhBao.filter((c) => c.muc === "loi")));
  for (const t of kq.tu) assert.ok(t.duBus <= 2 + 1e-9, `${t.ma} ${t.duBus}`);
});
