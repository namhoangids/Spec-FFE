// Chạy: node --test dien/engine/tests
import assert from "node:assert/strict";
import { test } from "node:test";

import { canPha, chonCap, chonOng, docThietBi, docTietDien, dongLamViec, QUY_TAC, sutAp, tinhDuAn } from "../index.mjs";
import { DB_T1 } from "./du-lieu-db-t1.mjs";

const gan = (a, b, sai = 0.01) => assert.ok(Math.abs(a - b) <= sai, `${a} ≠ ${b} (±${sai})`);
const chay = (duAn = DB_T1) => tinhDuAn(structuredClone(duAn));
const tu = (kq, ma) => kq.tu.find((t) => t.ma === ma);
const mach = (t, ma) => t.mach.find((m) => m.ma === ma);
const tim = (kq, muc, chu, tuMa) => kq.canhBao.filter((c) => c.muc === muc && c.noiDung.includes(chu) && (!tuMa || c.tu === tuMa));

// --- Ví dụ DB-T1 (mục 7 của phương án) ---------------------------------------

test("DB-T1: dòng làm việc, thiết bị, cáp và sụt áp từng mạch", () => {
  const t = tu(chay(), "DB-T1");
  const mong = {
    // ma: [Ib, thiết bị, In, tiết diện, ΔU cộng dồn]
    C01: [2.3, "MCB", 10, 1.5, 1.79], C02: [1.8, "MCB", 10, 1.5, 1.74], C03: [3.0, "RCBO", 10, 1.5, 2.58],
    C04: [9.6, "RCBO", 16, 2.5, 2.77], C05: [15.2, "RCBO", 20, 2.5, 2.77], C06: [19.1, "RCBO", 25, 4, 2.21],
    C07: [11.4, "RCBO", 16, 2.5, 2.95], C08: [6.7, "RCBO", 16, 2.5, 2.13], C09: [12.1, "MCB", 16, 2.5, 2.70],
    C10: [8.6, "MCB", 16, 2.5, 2.04], C11: [2.8, "MCB", 10, 2.5, 1.28],
  };
  for (const [ma, [ib, loai, In, s, du]] of Object.entries(mong)) {
    const m = mach(t, ma);
    gan(m.Ib, ib, 0.06);
    assert.equal(m.thietBi.loai, loai, ma);
    assert.equal(m.thietBi.in, In, ma);
    assert.equal(m.cap.s, s, ma);
    gan(m.cap.duCongDon, du, 0.006);
    if (loai === "RCBO") { assert.equal(m.thietBi.soCuc, "1P+N"); assert.equal(m.thietBi.idn, 30); }
  }
  assert.equal(mach(t, "C11").thietBi.soCuc, "3P");
  assert.equal(mach(t, "C11").cap.soDay, 3, "động cơ 3 pha không kéo dây N");
  assert.equal(mach(t, "DP1").thietBi.in, 16);
  assert.equal(mach(t, "DP2").thietBi.in, 20);
  assert.equal(mach(t, "DP1").cap, null);
});

test("DB-T1: cân pha giống bảng ví dụ, lệch 1,8%", () => {
  const t = tu(chay(), "DB-T1");
  const pha = Object.fromEntries(t.mach.filter((m) => /^C/.test(m.ma)).map((m) => [m.ma, m.pha]));
  assert.deepEqual(pha, { C01: "A", C02: "B", C03: "B", C04: "B", C05: "B", C06: "A", C07: "C", C08: "C", C09: "C", C10: "A", C11: "ABC" });
  gan(t.iPha.A, 23.0, 0.05); gan(t.iPha.B, 22.7, 0.05); gan(t.iPha.C, 23.1, 0.05);
  gan(t.lechPha, 1.8, 0.05);
});

test("DB-T1: tổng hợp tủ, CB tổng, cáp cấp, vỏ tủ", () => {
  const kq = chay();
  const t = tu(kq, "DB-T1");
  gan(t.pd, 19.7); gan(t.ks, 0.7); gan(t.ptt, 13.79); gan(t.cosTb, 0.91, 0.005); gan(t.itt, 23.0, 0.05);
  assert.deepEqual([t.cbTong.loai, t.cbTong.soCuc, t.cbTong.in, t.cbTong.icu], ["MCB", "3P", 40, 10]);
  assert.equal(t.capNguon.s, 6);
  assert.equal(t.capNguon.pe, 6);
  gan(t.capNguon.izp, 46.1, 0.05);
  gan(t.capNguon.du, 1.09, 0.006);
  assert.equal(t.module.tong, 27);
  gan(t.module.can, 32.4);
  assert.equal(t.module.voTu, 36);
  const duMax = Math.max(...t.mach.filter((m) => m.cap).map((m) => m.cap.duCongDon));
  gan(duMax, 2.95, 0.006);
  assert.equal(tim(kq, "loi", "").length, 0, JSON.stringify(tim(kq, "loi", "")));
  assert.equal(tim(kq, "canhbao", "nâng từ 32 A lên 40 A", "DB-T1").length, 1);
});

test("DB-T1: mạch cấp ở tủ trên lấy theo tủ con", () => {
  const kq = chay();
  const mdb = tu(kq, "MDB");
  assert.deepEqual(kq.tu.map((t) => t.ma), ["MDB", "DB-T1"]);
  const s1 = mach(mdb, "S1");
  assert.ok(s1.laCapTuCon);
  assert.equal(s1.phuTai, "CẤP ĐIỆN DB-T1");
  assert.ok(s1.thietBi.in >= tu(kq, "DB-T1").cbTong.in);
  gan(mdb.ptt, 13.79); // 1 tủ con: hệ số đồng thời 1
  assert.equal(mdb.cbTong.soCuc, "4P");
  assert.ok(mdb.coSpd);
});

// --- Hàm cơ bản -----------------------------------------------------------------

test("công thức Ib và sụt áp", () => {
  gan(dongLamViec(2500, 1, 1, QUY_TAC), 11.36);
  gan(dongLamViec(1500, 0.8, 3, QUY_TAC), 2.85);
  gan(sutAp(11.36, 20, 2.5, 1, 1, QUY_TAC), 1.86);
  assert.equal(sutAp(0, 20, 2.5, 1, 1, QUY_TAC), 0);
});

test("chọn cáp: tăng tiết diện khi sụt áp vượt", () => {
  const c = chonCap({ In: 16, Ib: 12, cos: 0.85, L: 120, soPha: 1, gioiHan: 5, sMin: 2.5 }, QUY_TAC);
  assert.ok(c.s > 2.5 && c.dat);
  assert.ok(c.duCongDon <= 5);
});

test("chọn ống theo hệ số lấp đầy, tối thiểu Ø20", () => {
  assert.equal(chonOng({ dayDon: [1.5, 1.5, 1.5] }, QUY_TAC), 20);
  assert.equal(chonOng({ capNhieuLoi: [6], dayDon: [6] }, QUY_TAC), 32);
});

test("đọc thiết bị và cáp ghi đè", () => {
  assert.deepEqual(
    (({ loai, soCuc, in: In, idn, module }) => ({ loai, soCuc, In, idn, module }))(docThietBi("RCBO 1P+N 32A 30mA", QUY_TAC)),
    { loai: "RCBO", soCuc: "1P+N", In: 32, idn: 30, module: 2 },
  );
  assert.equal(docThietBi("MCB 3P 32A C 6kA", QUY_TAC).icu, 6);
  assert.equal(docThietBi("abc", QUY_TAC), null);
  assert.equal(docTietDien("Cu/PVC 2(1x2,5)mm2 + E(1x2,5)mm2"), 2.5);
  assert.equal(docTietDien("Cu/XLPE/PVC (4x10)mm2"), 10);
  assert.equal(docTietDien("3x4"), 4);
});

test("cân pha giữ mạch đã khóa pha", () => {
  const m = [{ soPha: 1, va: 1000, pha: "C" }, { soPha: 1, va: 900 }, { soPha: 1, va: 800 }, { soPha: 3, va: 3000 }];
  const tai = canPha(m);
  assert.equal(m[0].pha, "C");
  assert.deepEqual(new Set(m.slice(0, 3).map((x) => x.pha)), new Set(["A", "B", "C"]));
  assert.deepEqual(tai, { A: 1900, B: 1800, C: 2000 });
});

// --- Bộ kiểm tra ------------------------------------------------------------

const motTu = (circuits, panel = {}) => ({
  info: { loaiCongTrinh: "Nhà ở / biệt thự", ikNguon: 6 },
  panels: [{ ma: "T", soPha: 3, ik: 6, ...panel }],
  circuits: circuits.map((c) => ({ tu: "T", L: 15, ...c })),
});

test("mạch chiếu sáng trong WC tự có RCBO; ghi đè MCB thì báo lỗi thiếu RCD", () => {
  const kq1 = chay(motTu([{ ma: "L1", loai: "Chiếu sáng trong nhà", khuVuc: "Ướt (WC, tắm)", congSuat: 200 }]));
  assert.equal(mach(tu(kq1, "T"), "L1").thietBi.loai, "RCBO");
  const kq2 = chay(motTu([{ ma: "L1", loai: "Chiếu sáng trong nhà", khuVuc: "Ướt (WC, tắm)", congSuat: 200, ghiDeThietBi: "MCB 1P 10A" }]));
  assert.equal(tim(kq2, "loi", "Thiếu RCD").length, 1);
  assert.equal(tim(kq2, "canhbao", "chưa ghi lý do").length, 1);
});

test("ghi đè CB nhỏ hơn Ib → lỗi; cáp ghi đè quá nhỏ → lỗi Iz′ và sụt áp", () => {
  const kq = chay(motTu([
    { ma: "S1", loai: "Ổ cắm thông thường", congSuat: 3000, ghiDeThietBi: "RCBO 1P+N 10A 30mA", lyDo: "thử" },
    { ma: "S2", loai: "Ổ cắm thông thường", congSuat: 3000, L: 80, ghiDeCap: "Cu/PVC 2(1x2,5)mm2", lyDo: "thử" },
  ]));
  assert.equal(tim(kq, "loi", "lớn hơn In = 10 A").length, 1);
  assert.equal(tim(kq, "loi", "lớn hơn Iz′").length, 1);
  assert.equal(tim(kq, "loi", "Sụt áp cộng dồn").length, 1);
  assert.equal(tim(kq, "canhbao", "Mạch dài 80 m").length, 1);
  assert.equal(tim(kq, "ghichu", "Lý do: thử").length, 2);
});

test("Ik lớn hơn Icu của MCB → CB tổng chuyển MCCB, mạch nhánh báo lỗi Icu", () => {
  const kq = chay(motTu([{ ma: "L1", loai: "Chiếu sáng trong nhà", congSuat: 300 }], { ik: 15 }));
  const t = tu(kq, "T");
  assert.equal(t.cbTong.loai, "MCCB");
  assert.ok(t.cbTong.icu >= 15);
  assert.equal(tim(kq, "loi", "Icu = 10 kA nhỏ hơn Ik").length, 1);
});

test("thiếu chiều dài và loại mạch lạ → cảnh báo", () => {
  const kq = chay(motTu([{ ma: "X1", loai: "Không rõ", congSuat: 500, L: null }]));
  assert.equal(tim(kq, "canhbao", "Thiếu chiều dài").length, 1);
  assert.equal(tim(kq, "canhbao", "không có trong danh mục").length, 1);
});

test("nhóm RCD ghi đè theo kiểu bản mẫu → 1 RCBO chung, cảnh báo kèm lý do", () => {
  const kq = chay(motTu([
    { ma: "S1", loai: "Ổ cắm thông thường", congSuat: 2000, nhomRcd: "R1", lyDo: "theo bản vẽ mẫu" },
    { ma: "S2", loai: "Ổ cắm thông thường", congSuat: 1500, nhomRcd: "R1" },
  ]));
  const t = tu(kq, "T");
  assert.equal(t.nhomRcd.length, 1);
  const g = t.nhomRcd[0];
  assert.deepEqual(g.mach, ["S1", "S2"]);
  assert.equal(g.thietBi.loai, "RCBO");
  assert.ok(g.thietBi.in >= 1.25 * (mach(t, "S1").Ib + mach(t, "S2").Ib));
  assert.equal(mach(t, "S1").thietBi.loai, "MCB");
  assert.equal(tim(kq, "loi", "Thiếu RCD").length, 0);
  assert.equal(tim(kq, "canhbao", "Lý do: theo bản vẽ mẫu").length, 1);
});

test("cây 3 cấp: CB cấp ≥ CB tổng tủ con, sụt áp cộng dồn qua từng cấp, hệ số đồng thời giữa tủ con", () => {
  const tai = (tuMa) => [
    { tu: tuMa, ma: "L1", loai: "Chiếu sáng trong nhà", congSuat: 600, L: 20 },
    { tu: tuMa, ma: "S1", loai: "Ổ cắm thông thường", congSuat: 2500, L: 20 },
    { tu: tuMa, ma: "AC1", loai: "Điều hòa", congSuat: 2000, L: 20 },
  ];
  const kq = chay({
    info: { loaiCongTrinh: "Nhà ở / biệt thự", ikNguon: 6 },
    panels: [
      { ma: "T1", soPha: 3, lCap: 25 },
      { ma: "T2", capTu: "T1", maLoCap: "S5", soPha: 3, lCap: 15 },
      { ma: "T3", capTu: "T1", maLoCap: "S6", soPha: 1, lCap: 20 },
      { ma: "T4", capTu: "T2", soPha: 1, lCap: 10 },
    ],
    circuits: [...tai("T1"), ...tai("T2"), ...tai("T3"), ...tai("T4")],
  });
  assert.deepEqual(kq.tu.map((t) => t.ma), ["T1", "T2", "T4", "T3"]);
  for (const t of kq.tu) {
    for (const m of t.mach.filter((x) => x.laCapTuCon)) {
      const con = tu(kq, m.tuCon);
      assert.ok(m.thietBi.in >= con.cbTong.in, `${t.ma}/${m.ma}`);
      gan(con.duBus, m.cap.duCongDon, 1e-9);
      assert.ok(con.duBus > t.duBus);
    }
  }
  const t1 = tu(kq, "T1");
  assert.equal(t1.ksCon, 0.9); // 2 tủ con
  assert.equal(mach(t1, "S6").thietBi.soCuc, "2P");
  assert.ok(t1.capNguon && t1.duBus > 0);
  assert.equal(tu(kq, "T4").cbTong.soCuc, "2P");
  // tủ con 1 pha: mọi mạch theo pha của lộ cấp
  const s6 = mach(t1, "S6");
  assert.ok(tu(kq, "T3").mach.every((m) => m.pha === s6.pha));
  assert.equal(tim(kq, "loi", "").length, 0, JSON.stringify(tim(kq, "loi", "")));
});

test("trùng mã tủ, mạch thuộc tủ không tồn tại → lỗi", () => {
  const kq = chay({
    info: {}, panels: [{ ma: "T1", soPha: 3 }, { ma: "T1", soPha: 3 }],
    circuits: [{ tu: "TX", ma: "L1", loai: "Chiếu sáng trong nhà", congSuat: 100, L: 10 }],
  });
  assert.equal(tim(kq, "loi", "Trùng mã tủ").length, 1);
  assert.equal(tim(kq, "loi", "không có trong sheet").length, 1);
  assert.equal(tim(kq, "canhbao", "Thiếu Ik").length, 1);
});
