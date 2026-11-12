// Ngắn mạch theo tổng trở: Ik3 max thanh cái, Ik1 min cuối mạch, tự cắt nguồn (TN/TT), chọn lọc, MBA, 2 lượt chọn Icu.
import assert from "node:assert/strict";
import { test } from "node:test";

import XLSX from "xlsx";

import { taoBoBanVe } from "../../bo-ban-ve.mjs";
import { tinhDuAn } from "../cay-tu.mjs";
import { xuatExcel } from "../xuat-excel.mjs";
import { docThietBi } from "../mach.mjs";
import { nguongTu, tongTroNguon } from "../ngan-mach.mjs";
import { QUY_TAC, taoQuyTac, tietDienPE } from "../quy-tac.mjs";

const NM = QUY_TAC.nganMach;
const UF = QUY_TAC.uf, LAM = QUY_TAC.lambda;
const gan = (a, b, tol = 1e-9) => assert.ok(Math.abs(a - b) <= tol * Math.max(1, Math.abs(b)), `${a} ≉ ${b}`);
const zNguon = (ik) => { const z = (NM.cMax * UF) / (ik * 1000); const x = z / Math.sqrt(1.01); return { r: 0.1 * x, x }; };
const ik = (c, z) => (c * UF) / Math.hypot(z.r, z.x) / 1000;
const tim = (kq, muc, chu) => kq.canhBao.filter((c) => c.muc === muc && c.noiDung.includes(chu));

test("Ik3 max tại thanh cái tủ gốc = Ik điểm đấu qua cáp nguồn; tủ con 1 pha cộng 2 lần cáp (pha + trung tính)", () => {
  const kq = tinhDuAn({
    info: { ikNguon: 6 },
    panels: [{ ma: "T1", soPha: 3, lCap: 30 }, { ma: "T2", capTu: "T1", maLoCap: "S1", soPha: 1, lCap: 20 }],
    circuits: [{ tu: "T2", ma: "S2", loai: "Ổ cắm thông thường", congSuat: 3000, L: 20 }],
  });
  const [t1, t2] = kq.tu;
  const s1 = t1.capNguon.s;
  const zBus1 = { r: zNguon(6).r + (NM.rho20 * 30) / s1, x: zNguon(6).x + LAM * 30 };
  gan(t1.nganMach.ikMax, ik(NM.cMax, zBus1));
  assert.equal(t1.ikNguon, "tính theo tổng trở");
  assert.ok(t1.ikTinh < 6, "Ik giảm theo cáp nguồn");
  const lo = t1.mach.find((m) => m.tuCon === "T2");
  const s2 = lo.cap.s;
  const zBus2 = { r: zBus1.r + (2 * NM.rho20 * 20) / s2, x: zBus1.x + 2 * LAM * 20 };
  gan(t2.nganMach.ikMax, ik(NM.cMax, zBus2));
  // Ik1 min cuối mạch S2: vòng pha – PE với ρ nóng = 1,25 ρ20; nguồn 3 pha → vòng phía nguồn = 2 × Zs
  const rhoMin = NM.rho20 * NM.kRhoMin;
  const m = t2.mach.find((x) => x.ma === "S2");
  const zV = {
    r: 2 * zNguon(6).r + rhoMin * 30 * (1 / s1 + 1 / t1.capNguon.pe) + rhoMin * 20 * (1 / s2 + 1 / lo.cap.pe) + rhoMin * 20 * (1 / m.cap.s + 1 / m.cap.pe),
    x: 2 * zNguon(6).x + 2 * LAM * (30 + 20 + 20),
  };
  gan(m.nganMach.ik1Cuoi, ik(NM.cMin, zV));
  assert.equal(m.nganMach.ikDau, t2.nganMach.ikMax);
});

test("máy biến áp riêng: Zt = Uk·Ud²/Sn, Uk mặc định 4% (≤ 630 kVA) / 6%; tủ có Ik nhập thì dùng Ik nhập", () => {
  const rule = taoQuyTac();
  const n400 = tongTroNguon({ mbaKva: 400 }, rule);
  assert.equal(n400.uk, 4);
  assert.ok(n400.ikDiemDau > 15.5 && n400.ikDiemDau < 16.2, `Ik đầu cực MBA 400 kVA ≈ 15,7 kA, được ${n400.ikDiemDau}`);
  assert.equal(tongTroNguon({ mbaKva: 1000 }, rule).uk, 6);
  assert.ok(tongTroNguon({ mbaKva: 400, mbaUk: 6 }, rule).ikDiemDau < n400.ikDiemDau);
  const kq = tinhDuAn({ info: { mbaKva: 400 }, panels: [{ ma: "MSB", soPha: 3 }, { ma: "T2", capTu: "MSB", soPha: 3, lCap: 15, ik: 3 }],
    circuits: [{ tu: "T2", ma: "L1", loai: "Chiếu sáng trong nhà", congSuat: 500, L: 10 }] });
  gan(kq.tu[0].nganMach.ikMax, n400.ikDiemDau);
  assert.match(kq.nganMach.nguon.moTa, /MBA 400 kVA/);
  assert.equal(kq.tu[1].ikTinh, 3);
  assert.equal(kq.tu[1].ikNguon, "nhập");
  gan(kq.tu[1].nganMach.ikMax, 3);
});

test("2 lượt: Ik nguồn 15 kA nhưng tủ con xa có Ik nhỏ → thiết bị tủ con chọn lại Icu 6 kA, không báo lỗi Icu", () => {
  const kq = tinhDuAn({
    info: { ikNguon: 15 },
    panels: [{ ma: "T1", soPha: 3, lCap: 10 }, { ma: "T2", capTu: "T1", soPha: 1, lCap: 60 }],
    circuits: [{ tu: "T2", ma: "S1", loai: "Ổ cắm thông thường", congSuat: 2000, L: 15 }, { tu: "T1", ma: "L1", loai: "Chiếu sáng trong nhà", congSuat: 300, L: 10 }],
  });
  const t2 = kq.tu[1];
  assert.ok(t2.ikTinh < 6, `Ik tủ con ${t2.ikTinh}`);
  assert.equal(t2.mach[0].thietBi.icu, 6);
  assert.equal(t2.cbTong.icu, 10);
  assert.equal(tim(kq, "loi", "Icu").length, 0);
  // Tủ gốc: Ik giảm theo 10 m cáp nguồn nhưng vẫn > 6 kA → MCB mạch nhánh chọn 10 kA
  assert.ok(kq.tu[0].ikTinh > 6 && kq.tu[0].ikTinh < 15);
  assert.equal(kq.tu[0].mach.find((m) => m.ma === "L1").thietBi.icu, 10);
});

test("tự cắt nguồn (TN): mạch dài không đạt → cảnh báo + đề xuất; có RCD → ghi chú nhờ RCD; mạch ngắn đạt", () => {
  const kq = tinhDuAn({
    info: { ikNguon: 6 },
    panels: [{ ma: "T1", soPha: 1, lCap: 10 }],
    circuits: [
      { tu: "T1", ma: "L1", loai: "Chiếu sáng trong nhà", congSuat: 400, L: 120 },
      { tu: "T1", ma: "L2", loai: "Chiếu sáng trong nhà", khuVuc: "Ướt (WC, tắm)", congSuat: 400, L: 120 },
      { tu: "T1", ma: "L3", loai: "Chiếu sáng trong nhà", congSuat: 400, L: 15 },
    ],
  });
  const m = (ma) => kq.tu[0].mach.find((x) => x.ma === ma);
  assert.equal(m("L1").nganMach.tuCat, "khong");
  assert.equal(m("L2").nganMach.tuCat, "rcd");
  assert.equal(m("L3").nganMach.tuCat, "dat");
  const cb = tim(kq, "canhbao", "Ik1 min cuối mạch");
  assert.deepEqual(cb.map((c) => c.mach), ["L1"]);
  assert.match(cb[0].noiDung, /đường cong C: 10×In = 100 A/);
  assert.match(cb[0].noiDung, /Đề xuất: tăng dây lên \d+ mm².*đường cong B.*RCBO 30 mA/);
  // Tiết diện đề xuất đạt ngưỡng, tiết diện nhỏ hơn liền trước thì không
  const sDx = Number(cb[0].noiDung.match(/lên (\d+(?:,\d)?) mm²/)[1].replace(",", "."));
  const vongCuoi = (s) => {
    const n = kq.tu[0].nganMach.zVong;
    const rhoMin = NM.rho20 * NM.kRhoMin;
    return ik(NM.cMin, { r: n.r + rhoMin * 120 * (1 / s + 1 / tietDienPE(s)), x: n.x + 2 * LAM * 120 }) * 1000;
  };
  const ds = QUY_TAC.tietDien;
  assert.ok(vongCuoi(sDx) >= 100 && vongCuoi(ds[ds.indexOf(sDx) - 1]) < 100);
  assert.equal(tim(kq, "ghichu", "nhờ RCD 30 mA").map((c) => c.mach).join(), "L2");
  assert.ok(m("L1").kiemTra.some((k) => /Ik1 min/.test(k.noiDung)), "gắn vào mạch");
});

test("sơ đồ TT: không kiểm Ik1 theo ngưỡng cắt từ, báo các mạch thiếu RCD", () => {
  const kq = tinhDuAn({
    info: { ikNguon: 6, noiDat: "TT" },
    panels: [{ ma: "T1", soPha: 1, lCap: 10 }],
    circuits: [
      { tu: "T1", ma: "L1", loai: "Chiếu sáng trong nhà", congSuat: 400, L: 120 },
      { tu: "T1", ma: "S1", loai: "Ổ cắm thông thường", congSuat: 2000, L: 20 },
      { tu: "T1", ma: "AC1", loai: "Điều hòa", congSuat: 1500, L: 20 },
    ],
  });
  assert.equal(kq.quyTac.noiDat, "TT");
  assert.equal(tim(kq, "canhbao", "Ik1 min").length, 0);
  const tt = tim(kq, "canhbao", "Sơ đồ TT");
  assert.equal(tt.length, 1);
  assert.match(tt[0].noiDung, /các mạch L1, AC1 không có RCD/);
});

test("ngưỡng cắt từ: MCB theo đường cong, MCCB 10×In ±20% hoặc Im ghi đè; chọn lọc toàn phần / một phần", () => {
  const rule = taoQuyTac();
  assert.deepEqual([nguongTu(docThietBi("MCB 1P 16A C", rule), rule).duoi, nguongTu(docThietBi("MCB 1P 16A C", rule), rule).tren], [80, 160]);
  assert.equal(nguongTu(docThietBi("MCB 1P 16A B", rule), rule).tren, 80);
  assert.equal(nguongTu(docThietBi("MCB 3P 32A D", rule), rule).tren, 640);
  const mccb = nguongTu(docThietBi("MCCB 3P 100A 25kA", rule), rule);
  gan(mccb.duoi, 800); gan(mccb.tren, 1200);
  assert.equal(docThietBi("MCCB 3P 160A 25kA Im=1000A", rule).im, 1000);
  assert.equal(docThietBi("MCCB 3P 100A Im 8xIn", rule).im, 800);
  assert.equal(docThietBi("MCB 1P 16A C", rule).im, undefined);

  // Tủ con xa (Ik nhỏ) sau lộ cấp lớn → toàn phần; tủ gốc Ik lớn → một phần tới Is = 5·In CB tổng
  const kq = tinhDuAn({
    info: { ikNguon: 6 },
    panels: [{ ma: "T1", soPha: 3, lCap: 5 }, { ma: "T2", capTu: "T1", soPha: 1, lCap: 80 }],
    circuits: [{ tu: "T2", ma: "L1", loai: "Chiếu sáng trong nhà", congSuat: 300, L: 10 }, { tu: "T1", ma: "S1", loai: "Ổ cắm thông thường", congSuat: 2000, L: 10 }],
  });
  const [t1, t2] = kq.tu;
  const cl1 = t1.nganMach.chonLoc.find((c) => c.tren.startsWith("CB tổng"));
  assert.equal(cl1.toanPhan, false);
  gan(cl1.is, nguongTu(t1.cbTong, rule).duoi);
  const lo = t2.nganMach.chonLoc.find((c) => c.tren.startsWith("Lộ"));
  assert.equal(lo.toanPhan, t2.nganMach.ikMax * 1000 < nguongTu(t1.mach.find((m) => m.tuCon === "T2").thietBi, rule).duoi);
  assert.ok(tim(kq, "ghichu", "Chọn lọc ngắn mạch").length >= 2);
});

test("thiếu Ik điểm đấu: tính từ mặc định, cảnh báo một lần; bảng tính có sheet Ngan mach; thuyết minh có mục 3.4", () => {
  const b = taoBoBanVe({ info: {}, panels: [{ ma: "T1", soPha: 1 }], circuits: [{ tu: "T1", ma: "L1", loai: "Chiếu sáng trong nhà", congSuat: 300, L: 10 }] });
  assert.equal(tim(b.kq, "canhbao", "Thiếu Ik").length, 1);
  assert.equal(b.kq.nganMach.nguon.macDinh, true);
  gan(b.kq.tu[0].nganMach.ikMax, QUY_TAC.ikMacDinh);
  const wb = xuatExcel(XLSX, b.kq, {});
  assert.deepEqual(wb.SheetNames, ["Tong hop", "T1", "Cap va ong", "Ngan mach", "Canh bao", "Quy tac"]);
  const nmRows = XLSX.utils.sheet_to_json(wb.Sheets["Ngan mach"], { header: 1 });
  assert.ok(nmRows.some((r) => r[0] === "T1" && r[1] === "L1" && r[11] === "Đạt (CB cắt từ)"), "dòng mạch L1 đạt");
  const nd = b.thuyetMinh();
  const muc = (nd.khoi || []).filter((k) => k.loai === "muc").map((k) => k.text);
  assert.ok(muc.includes("3.4. Ngắn mạch, tự cắt nguồn và chọn lọc"), muc.join(" | "));
});
