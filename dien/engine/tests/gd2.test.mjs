// GĐ2 đợt 1: tự ngắt tờ, đánh số tờ, sơ đồ cấp điện tổng, nhãn tủ / nhãn cáp.
import assert from "node:assert/strict";
import { test } from "node:test";

import { tinhDuAn } from "../index.mjs";
import { danhMucMach, nhanCap, nhanHtml } from "../nhan.mjs";
import { chiaTo, sangBoBanVe, sangSoDoTong, soBanVeTong } from "../sang-ban-ve.mjs";
import { DB_T1 } from "./du-lieu-db-t1.mjs";

const mach = (n) => Array.from({ length: n }, (_, i) => ({ ma: `C${i + 1}` }));
const nhom = (ma, tu, den) => ({ ma, mach: Array.from({ length: den - tu + 1 }, (_, k) => `C${tu + k}`) });

test("chiaTo: 25 mạch → 18 + 7, giữ thứ tự", () => {
  const { phan, canhBao } = chiaTo(mach(25), [], 18);
  assert.deepEqual(phan.map((p) => p.length), [18, 7]);
  assert.deepEqual(phan.flat(), [...Array(25).keys()]);
  assert.deepEqual(canhBao, []);
  assert.equal(chiaTo(mach(18), [], 18).phan.length, 1);
});

test("chiaTo: nhóm RCBO vắt qua ranh giới tờ → cả nhóm sang tờ sau", () => {
  const { phan } = chiaTo(mach(25), [nhom("R1", 16, 20)], 18);
  assert.deepEqual(phan.map((p) => p.length), [15, 10]);
  assert.equal(phan[1][0], 15);   // C16 mở đầu tờ 2
});

test("chiaTo: nhóm dài hơn 18 lộ → giữ trên một tờ và cảnh báo", () => {
  const { phan, canhBao } = chiaTo(mach(30), [nhom("R1", 2, 22)], 18);
  assert.deepEqual(phan.map((p) => p.length), [1, 21, 8]);
  assert.equal(canhBao.length, 1);
  assert.match(canhBao[0], /R1/);
});

test("đánh số: tờ tổng E.600, tủ bị ngắt làm tủ sau lùi số, tờ nối tiếp ghi số tờ trước/sau", () => {
  const circuits = [];
  for (let i = 1; i <= 25; i++) circuits.push({ tu: "T1", ma: `L${i}`, loai: "Chiếu sáng trong nhà", congSuat: 200, L: 10 });
  circuits.push({ tu: "T2", ma: "L1", loai: "Chiếu sáng trong nhà", congSuat: 200, L: 10 });
  const kq = tinhDuAn({ info: { ikNguon: 6 }, panels: [{ ma: "T1", soPha: 3 }, { ma: "T2", capTu: "T1", maLoCap: "S1", soPha: 1, lCap: 10 }], circuits });
  const bo = sangBoBanVe(kq, { soBanVeDau: "E.601" }, { toiDa: 18 });
  assert.deepEqual(bo.to.map((x) => [x.loai, x.ma, x.du.sheet.drawingNo]),
    [["tong", "TONG", "E.600"], ["tu", "T1", "E.601"], ["tu", "T1", "E.602"], ["tu", "T2", "E.603"]]);
  assert.deepEqual(bo.soTheoTu.get("T1"), ["E.601", "E.602"]);
  const [, a, b] = bo.to;
  assert.equal(a.du.sheet.title, "SƠ ĐỒ NGUYÊN LÝ ĐIỆN T1 (1/2)");
  assert.deepEqual(a.du.noiTiep, { truoc: null, sau: "E.602" });
  assert.deepEqual(b.du.noiTiep, { truoc: "E.601", sau: null });
  assert.ok(a.du.panel.incomer && !b.du.panel.incomer, "chỉ tờ đầu có CB tổng");
  assert.equal(a.du.circuits.length + b.du.circuits.length, 26);   // 25 mạch + lộ cấp T2
  assert.equal(soBanVeTong({ soBanVeTong: "E.599" }), "E.599");
});

test("sơ đồ tổng: cây 3 cấp, lộ cấp mang đúng CB và cáp như tờ tủ cha, bảng đủ dòng", () => {
  const tai = (tu) => [{ tu, ma: "L1", loai: "Chiếu sáng trong nhà", congSuat: 600, L: 20 }];
  const kq = tinhDuAn({
    info: { ikNguon: 6 },
    panels: [
      { ma: "MDB", soPha: 3, lCap: 25 }, { ma: "T1", capTu: "MDB", maLoCap: "S1", soPha: 3, lCap: 15 },
      { ma: "T1-B", capTu: "T1", maLoCap: "B1", soPha: 1, lCap: 8 }, { ma: "T2", capTu: "MDB", maLoCap: "S2", soPha: 1, lCap: 12 },
    ],
    circuits: [...tai("MDB"), ...tai("T1"), ...tai("T1-B"), ...tai("T2")],
  });
  const d = sangSoDoTong(kq, { soBanVeDau: "E.601" });
  assert.equal(d.sheet.drawingNo, "E.600");
  assert.equal(d.nodes.length, 1);
  const [mdb] = d.nodes;
  assert.deepEqual(mdb.children.map((c) => c.ma), ["T1", "T2"]);
  assert.deepEqual(mdb.children[0].children.map((c) => c.ma), ["T1-B"]);
  const s1 = kq.tu.find((t) => t.ma === "MDB").mach.find((m) => m.ma === "S1");
  const f = mdb.children[0].feeder;
  assert.equal(f.code, "S1");
  assert.equal(f.device.rating, `${s1.thietBi.in}A`);
  assert.match(f.cable, /^Cu\/XLPE\/PVC \(4x/);
  assert.match(f.cableNgan, /^4x[\d,]+ \+ E[\d,]+$/);
  assert.equal(d.bang.length, 4);
  assert.equal(d.bang[0].capTu, "NGUỒN");
});

test("nhãn: số nhãn cáp = mạch có cáp + lộ cấp + cáp nguồn; dự phòng có trong danh mục, không có nhãn cáp", () => {
  const kq = tinhDuAn(structuredClone(DB_T1));
  const dm = danhMucMach(kq);
  assert.deepEqual(dm.map((t) => t.ten), ["MDB", "DB-T1"]);
  assert.equal(dm[1].capTu, "MDB / S1");
  const dp = dm[1].dong.filter((x) => x.phuTai === "DỰ PHÒNG");
  assert.equal(dp.length, 2);
  assert.ok(dp.every((x) => x.cap === ""));
  const nc = nhanCap(kq);
  const coCap = kq.tu.flatMap((t) => t.mach).filter((m) => m.cap?.s).length;   // 11 mạch DB-T1 + lộ cấp S1
  assert.equal(nc.length, coCap + 1);
  assert.equal(nc[0].ma, "NGUON-MDB");
  assert.ok(nc.some((n) => n.ma === "MDB-S1" && n.den === "TỦ DB-T1"));
  assert.ok(!nc.some((n) => /DP\d/.test(n.ma)));
  const html = nhanHtml(kq, { project: "VD" });
  assert.equal((html.match(/class="trang"/g) || []).length, 2);
  assert.equal((html.match(/class="nhan"/g) || []).length, nc.length * 2);
});
