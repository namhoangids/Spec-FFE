// Bộ quy tắc: danh mục phủ đủ mọi thông số, sheet "Quy tac" đọc lại đúng, sửa ô được nhận, chốt hết thì ĐÃ DUYỆT.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import XLSX from "xlsx";

import { BANG, THAM_SO, TRONG_CODE, layKhoa } from "../danh-muc-quy-tac.mjs";
import { docExcel } from "../doc-excel.mjs";
import { QUY_TAC, taoQuyTac } from "../quy-tac.mjs";

const FILE = new URL("../../mau/bo-quy-tac.xlsx", import.meta.url);
const moFile = () => XLSX.read(readFileSync(FILE), { type: "buffer" });
const khoaDanhMuc = [...THAM_SO, ...BANG].map((x) => x.khoa);

/** Các khóa lá của bộ quy tắc (dừng ở mảng) */
function khoaLa(o, goc = "") {
  return Object.entries(o).flatMap(([k, v]) => {
    const p = goc ? `${goc}.${k}` : k;
    return v && typeof v === "object" && !Array.isArray(v) ? khoaLa(v, p) : [p];
  });
}

/** Sửa ô giá trị của dòng có mã `ma` ở cột A (cột C), hoặc dòng thứ `i` của bảng (cột 2 + cot) */
function suaO(wb, ma, giaTri, { dongBang, cot = 0 } = {}) {
  const ws = wb.Sheets["Quy tac"];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, blankrows: true });
  let r = rows.findIndex((x) => x?.[0] === ma);
  assert.ok(r >= 0, `không thấy ${ma}`);
  if (dongBang != null) r += 2 + dongBang;   // dòng tên bảng → dòng tiêu đề cột → số liệu
  ws[XLSX.utils.encode_cell({ r, c: 2 + cot })] = typeof giaTri === "number" ? { t: "n", v: giaTri } : { t: "s", v: giaTri };
}

test("danh mục phủ đủ mọi thông số của quy-tac.mjs; mã không trùng", () => {
  const thieu = khoaLa(QUY_TAC)
    .filter((p) => !["trangThai", "phienBan"].includes(p) && !p.startsWith("loaiMach."))
    .filter((p) => !khoaDanhMuc.some((k) => p === k || p.startsWith(`${k}.`)));
  assert.deepEqual(thieu, [], "thông số chưa có trong engine/danh-muc-quy-tac.mjs");
  const ma = [...THAM_SO, ...BANG, ...TRONG_CODE].map((x) => x.ma);
  assert.equal(new Set(ma).size, ma.length);
});

test("đọc lại bo-quy-tac.xlsx: mọi dòng đều được đọc và trùng bộ mặc định; trạng thái vẫn CHƯA DUYỆT", () => {
  const d = docExcel(XLSX, moFile());
  for (const k of khoaDanhMuc) assert.notEqual(layKhoa(d.quyTac, k), undefined, `không đọc được ${k}`);
  assert.equal(Object.keys(d.quyTac.loaiMach).length, Object.keys(QUY_TAC.loaiMach).length);
  const { trangThai, phienBan, ...a } = taoQuyTac(d.quyTac);
  const { trangThai: t0, phienBan: p0, ...b } = QUY_TAC;
  assert.deepEqual(a, b);
  assert.equal(d.quyTac.trangThai, undefined);
});

test("sửa ô trong sheet Quy tac: thông số, dãy cỡ, bảng tra, Iz được nhận; ghi đè sâu không làm mất khóa khác", () => {
  const wb = moFile();
  suaO(wb, "NM_CMAX", 1.1);
  suaO(wb, "KNX_MA", 12);
  suaO(wb, "LAMBDA", 0.1);                       // mΩ/m → Ω/m
  suaO(wb, "SPD_TU_GOC", "Không");
  suaO(wb, "DS_DINH_MUC", "6; 10; 13; 16; 20");
  suaO(wb, "T_SWITCH_POE", 130, { dongBang: 0, cot: 1 });   // switch PoE 8 cổng: ngân sách 120 → 130 W
  suaO(wb, "T_IZ", 18, { dongBang: 4, cot: 0 });            // dòng thứ 5: PVC · B1 · 2, cỡ 1,5 mm²
  suaO(wb, "T_UK_MBA", 1000, { dongBang: 0, cot: 0 });
  const r = taoQuyTac(docExcel(XLSX, wb).quyTac);
  assert.equal(r.nganMach.cMax, 1.1);
  assert.equal(r.nganMach.cMin, QUY_TAC.nganMach.cMin);
  assert.equal(r.dienNhe.knx.maThietBi, 12);
  assert.equal(r.dienNhe.knx.thietBiLine, 64);
  assert.deepEqual(r.dienNhe.knx.batTat, QUY_TAC.dienNhe.knx.batTat);
  assert.ok(Math.abs(r.lambda - 0.0001) < 1e-12);
  assert.equal(r.spdTuGoc, false);
  assert.deepEqual(r.dinhMuc, [6, 10, 13, 16, 20]);
  assert.deepEqual(r.dienNhe.switchPoe[0], [8, 130, 15]);
  assert.equal(r.iz.PVC.B1[2][0], 18);
  assert.deepEqual(r.iz.PVC.B1[3], QUY_TAC.iz.PVC.B1[3]);
  assert.deepEqual(r.nganMach.ukMba, [[1000, 4], [Infinity, 6]]);
  // ghi đè từ JSON dự án cũng gộp sâu
  const r2 = taoQuyTac({ dienNhe: { knx: { busMax: 700 } }, nganMach: { duongCong: { B: [3, 4] } } });
  assert.equal(r2.dienNhe.knx.busMax, 700);
  assert.equal(r2.dienNhe.knx.maThietBi, 10);
  assert.equal(r2.dienNhe.poeAp, 20);
  assert.deepEqual(r2.nganMach.duongCong, { B: [3, 4], C: [5, 10], D: [10, 20] });
});

test("chốt hết mọi dòng (A, B, C, D) thì ĐÃ DUYỆT; thiếu một dòng thì chưa", () => {
  const wb = moFile();
  const ws = wb.Sheets["Quy tac"];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, blankrows: true });
  const ma = new Set([...THAM_SO, ...BANG, ...TRONG_CODE].map((x) => x.ma));
  const loai = new Set(Object.keys(QUY_TAC.loaiMach));
  const can = [];
  rows.forEach((x, r) => {
    if (ma.has(x?.[0])) can.push(XLSX.utils.encode_cell({ r, c: 7 }));
    else if (loai.has(x?.[0])) can.push(XLSX.utils.encode_cell({ r, c: 8 }));
  });
  assert.equal(can.length, THAM_SO.length + BANG.length + TRONG_CODE.length + loai.size);
  for (const a of can.slice(1)) ws[a] = { t: "s", v: "✔" };
  assert.equal(docExcel(XLSX, wb).quyTac.trangThai, undefined);
  ws[can[0]] = { t: "s", v: "✔" };
  assert.equal(docExcel(XLSX, wb).quyTac.trangThai, "ĐÃ DUYỆT");
});

test("file bo-quy-tac.xlsx có hướng dẫn và giả định của agent", () => {
  const wb = moFile();
  assert.deepEqual(wb.SheetNames, ["Huong dan", "Quy tac", "Gia dinh agent"]);
  const hd = XLSX.utils.sheet_to_json(wb.Sheets["Huong dan"], { header: 1, defval: "" }).flat().join("\n");
  assert.match(hd, /Nên soát trước/);
  assert.match(hd, /K_CHONLOC/);
  const ga = XLSX.utils.sheet_to_json(wb.Sheets["Gia dinh agent"], { header: 1, defval: "" }).flat().join("\n");
  assert.match(ga, /thang máy/);
  assert.match(ga, /Điện nhẹ theo loại phòng/);
});
