import assert from "node:assert/strict";
import { test } from "node:test";

import { tinhDuAn } from "../index.mjs";
import { chuCap, chuThietBi, sangBanVe, soBanVe } from "../sang-ban-ve.mjs";
import { DB_T1 } from "./du-lieu-db-t1.mjs";

test("chữ cáp theo kiểu bản vẽ mẫu", () => {
  assert.equal(chuCap({ s: 2.5, pe: 2.5 }), "Cu/PVC 2(1x2,5)mm2 + E(1x2,5)mm2");
  assert.equal(chuCap({ s: 6, pe: 6 }, { soPha: 3 }), "Cu/PVC 4(1x6)mm2 + E(1x6)mm2");
  assert.equal(chuCap({ s: 2.5, pe: 2.5 }, { soPha: 3, dongCo: true }), "Cu/PVC 3(1x2,5)mm2 + E(1x2,5)mm2");
  assert.equal(chuCap({ s: 25, pe: 16, kieu: "nhieuLoi", soLoi: 4 }), "Cu/XLPE/PVC (4x25)mm2 + E(1x16)mm2");
  assert.equal(chuCap(null), "");
});

test("nhãn thiết bị: RCBO ghi dòng rò ở dòng 4", () => {
  assert.deepEqual(chuThietBi({ loai: "RCBO", soCuc: "1P+N", in: 25, icu: 6, idn: 30 }),
    { type: "RCBO", poles: "1P+N", rating: "25A", breaking: "30mA" });
  assert.deepEqual(chuThietBi({ loai: "MCB", soCuc: "3P", in: 40, icu: 10 }),
    { type: "MCB", poles: "3P", rating: "40A", breaking: "10kA" });
});

test("số bản vẽ tăng theo thứ tự tờ", () => {
  assert.equal(soBanVe("E.601", 0), "E.601");
  assert.equal(soBanVe("E.601", 5), "E.606");
  assert.equal(soBanVe("E-09", 1), "E-10");
});

test("tờ DB-T1 đủ dữ liệu cho template", () => {
  const kq = tinhDuAn(structuredClone(DB_T1));
  const d = sangBanVe(kq.tu[1], { soBanVeDau: "E.601", project: "VD" }, 1);
  assert.equal(d.sheet.drawingNo, "E.602");
  assert.equal(d.sheet.title, "SƠ ĐỒ NGUYÊN LÝ ĐIỆN DB-T1");
  assert.equal(d.panel.name, "TỦ ĐIỆN 36 MODULE");
  assert.deepEqual(d.panel.loadText, ["Pđ=19,70 kW, Kđt=0,70", "Ptt=13,79 kW"]);
  assert.deepEqual(d.panel.supplyCable, ["Cu/XLPE/PVC (4x6)mm2 + E(1x6)mm2", "ỐNG PVC  Ø 32"]);
  assert.equal(d.circuits.length, 13);
  const c07 = d.circuits.find((c) => c.code === "C07");
  assert.equal(c07.cable, "Cu/PVC 2(1x2,5)mm2 + E(1x2,5)mm2");
  assert.equal(c07.conduit, "ỐNG PVC  Ø 20");
  assert.equal(c07.phase, "C");
  assert.equal(d.circuits.find((c) => c.code === "C11").phase, "ABC");
  assert.equal(d.circuits.find((c) => c.code === "DP1").cable, "");
});
