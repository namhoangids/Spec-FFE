// Nhập liệu trên web: các thao tác dữ liệu (thêm / xóa / nhân bản / di chuyển mạch, đổi mã tủ…) không đụng DOM.
import assert from "node:assert/strict";
import { test } from "node:test";

import { taoBoBanVe } from "../../bo-ban-ve.mjs";
import * as NL from "../../app/nhap-lieu.mjs";
import { DB_T1 } from "./du-lieu-db-t1.mjs";

const mau = () => ({ loiDoc: [], quyTac: {}, ...structuredClone(DB_T1) });
const maCuaTu = (d, tu) => d.circuits.filter((c) => c.tu === tu).map((c) => c.ma);

test("đọc số kiểu Việt Nam; mã kế tiếp theo tiền tố", () => {
  assert.equal(NL.docSo("1.250,5"), 1250.5);
  assert.equal(NL.docSo("12,5"), 12.5);
  assert.equal(NL.docSo(""), null);
  assert.equal(NL.docSo("abc"), null);
  assert.equal(NL.maKeTiep(["L1", "L2", "S1"], "L1"), "L3");
  assert.equal(NL.maKeTiep(["AC2-1"], "AC"), "AC1");
  assert.equal(NL.maKeTiep([], "S"), "S1");
});

test("thêm mạch sau một dòng / cuối tủ, nhân bản, di chuyển trong cùng tủ; dữ liệu cũ không bị sửa", () => {
  const d0 = mau();
  const i5 = d0.circuits.findIndex((c) => c.tu === "DB-T1" && c.ma === "C05");
  const { duAn: d1, i } = NL.themMach(d0, "DB-T1", i5);
  assert.equal(i, i5 + 1);
  assert.equal(d1.circuits[i].tu, "DB-T1");
  assert.equal(d1.circuits[i].ma, "C12");                  // C01…C11 đã có
  assert.equal(d0.circuits.length + 1, d1.circuits.length);
  assert.equal(d0.circuits.length, DB_T1.circuits.length, "bản cũ giữ nguyên");
  const { duAn: d2, i: j } = NL.nhanBanMach(d1, i5);
  assert.equal(d2.circuits[j].ma, "C13");
  assert.equal(d2.circuits[j].congSuat, d1.circuits[i5].congSuat);
  // Di chuyển: C05 lên một bậc → đứng trước C04
  const { duAn: d3 } = NL.diChuyenMach(d2, i5, -1);
  const ma = maCuaTu(d3, "DB-T1");
  assert.ok(ma.indexOf("C05") < ma.indexOf("C04"));
  // Mạch đầu tủ không lên được nữa
  const dau = d3.circuits.findIndex((c) => c.tu === "DB-T1");
  assert.equal(NL.diChuyenMach(d3, dau, -1).i, dau);
  // Xóa
  assert.equal(NL.xoaMach(d3, dau).circuits.length, d3.circuits.length - 1);
});

test("đổi mã tủ: mạch và tủ con đi theo; xóa tủ còn tủ con bị chặn; thêm tủ kèm 1 mạch mẫu", () => {
  const d0 = mau();
  const iMdb = d0.panels.findIndex((p) => p.ma === "MDB");
  const d1 = NL.suaTu(d0, iMdb, "ma", "TONG");
  assert.equal(d1.panels.find((p) => p.ma === "DB-T1").capTu, "TONG");
  assert.ok(!d1.circuits.some((c) => c.tu === "MDB"));
  assert.match(NL.xoaTu(d1, iMdb).loi, /đang cấp cho DB-T1/);
  const { duAn: d2, ma } = NL.themTu(d1, "TONG");
  assert.equal(ma, "T1");
  assert.deepEqual(maCuaTu(d2, "T1"), ["L1"]);
  const r = NL.xoaTu(d2, d2.panels.findIndex((p) => p.ma === "T1"));
  assert.ok(!r.duAn.circuits.some((c) => c.tu === "T1"));
});

test("dự án trống và dự án sau khi sửa đều tính được cả bộ; bảng nhập liệu có đủ cột và đánh dấu lỗi", () => {
  const trong = NL.duAnTrong();
  const bo = taoBoBanVe(trong);
  assert.equal(bo.kq.canhBao.filter((c) => c.muc === "loi").length, 0);
  // Ghi đè CB nhỏ hơn Ib → dòng mạch có lỗi, bảng nhập liệu tô "loi"
  const sua = NL.suaMach(NL.suaMach(trong, 1, "ghiDeThietBi", "MCB 1P 6A"), 1, "lyDo", "thử");
  const kq = taoBoBanVe(sua).kq;
  const html = NL.veNhapLieu(sua, "T1", kq);
  assert.match(html, /<tr class="loi"/);
  for (const [, ten] of NL.COT_MACH) assert.ok(html.includes(`<th>${ten}</th>`), ten);
  assert.match(html, /data-dong="mach" data-i="1" data-k="congSuat"/);
});
