// Bộ gợi ý đầu vào cho agent (dien/agent/goi-y-dau-vao.mjs).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { goiYDauVao, nhanLoaiPhong, nhanThietBi } from "../../agent/goi-y-dau-vao.mjs";
import { tinhDuAn } from "../index.mjs";

const moTa = JSON.parse(readFileSync(new URL("../../agent/vi-du/mo-ta-biet-thu.json", import.meta.url), "utf8"));

test("nhận loại phòng và thiết bị từ cách gọi tự do", () => {
  assert.equal(nhanLoaiPhong("P. ngủ master"), "phòng ngủ");
  assert.equal(nhanLoaiPhong("WC chung"), "wc");
  assert.equal(nhanLoaiPhong("Sân thượng"), "ngoài nhà");
  assert.equal(nhanLoaiPhong("Ban công"), "ban công");
  assert.equal(nhanLoaiPhong("hành lang"), "sảnh, hành lang");
  assert.equal(nhanLoaiPhong("abc"), null);
  assert.equal(nhanThietBi("Thang máy gia đình"), "thang máy");
  assert.equal(nhanThietBi("bơm hồ bơi"), "bơm bể bơi");
});

test("biệt thự 4 tầng: đủ tủ, lộ cấp đặt sau mạch cuối, mỗi WC có bình nóng lạnh và chiếu sáng khu ướt", () => {
  const { duAn, giaDinh, canhBao } = goiYDauVao(structuredClone(moTa));
  assert.deepEqual(duAn.panels.map((p) => [p.ma, p.capTu ?? null, p.soPha]), [["T1", null, 3], ["T2", "T1", 1], ["T3", "T1", 1], ["T4", "T1", 1]]);
  const t1 = duAn.circuits.filter((c) => c.tu === "T1").map((c) => c.ma);
  const [t2, t3, t4] = duAn.panels.slice(1);
  assert.equal(t2.datSauLo, t1.filter((m) => !/^DP/.test(m)).at(-1));
  assert.equal(t3.datSauLo, t2.maLoCap);
  assert.equal(t4.datSauLo, t3.maLoCap);
  // 6 WC: 5 có tắm → 5 bình nóng lạnh; WC CHUNG không tắm
  const wh = duAn.circuits.filter((c) => /^WH/.test(c.ma));
  assert.equal(wh.length, 5);
  assert.ok(wh.every((c) => c.khuVuc === "Ướt (WC, tắm)"));
  for (const tu of ["T1", "T2", "T3", "T4"]) {
    assert.ok(duAn.circuits.some((c) => c.tu === tu && c.loai === "Chiếu sáng trong nhà" && c.khuVuc === "Ướt (WC, tắm)"), `chiếu sáng WC ở ${tu}`);
    assert.equal(duAn.circuits.filter((c) => c.tu === tu && c.loai === "Dự phòng").length, 2);
  }
  // Mọi mạch có công suất do công cụ tự suy ra đều ghi "giả định"
  for (const c of duAn.circuits.filter((x) => x.loai !== "Dự phòng")) assert.match(c.ghiChu ?? "", /giả định/, `${c.tu}/${c.ma}`);
  assert.ok(giaDinh.some((s) => /Cáp cấp tủ T2/.test(s)));
  assert.ok(canhBao.some((s) => /T3 1 pha .*cân nhắc tủ 3 pha/.test(s)));
  // Tính được ngay, không có lỗi đỏ
  const kq = tinhDuAn(structuredClone(duAn));
  assert.deepEqual(kq.canhBao.filter((c) => c.muc === "loi"), []);
});

test("điều hòa VRV: dàn lạnh gom theo tầng, tự thêm dàn nóng 3 pha ở tủ tổng", () => {
  const m = structuredClone(moTa);
  m.dieuHoa = "VRV";
  const { duAn, giaDinh } = goiYDauVao(m);
  const dn = duAn.circuits.find((c) => c.ma === "ACT");
  assert.ok(dn && dn.tu === "T1" && dn.soPha === 3 && dn.congSuat > 0);
  assert.equal(duAn.circuits.filter((c) => c.tu === "T3" && /^AC/.test(c.ma)).length, 1);
  assert.ok(giaDinh.some((s) => /Dàn nóng VRV/.test(s)));
});

test("căn hộ 1 pha: một tủ, thiết bị 3 pha bị báo", () => {
  const { duAn, canhBao } = goiYDauVao({
    duAn: { ten: "CĂN HỘ", loaiCongTrinh: "Căn hộ" }, nguon: { soPha: 1, ik: 4.5 },
    tang: [{ ten: "CH", phong: [{ loai: "phòng khách" }, { loai: "bếp" }, { loai: "wc" }, { loai: "phòng ngủ" }] }],
    thietBi: [{ loai: "thang máy" }],
  });
  assert.equal(duAn.panels.length, 1);
  assert.equal(duAn.panels[0].soPha, 1);
  assert.ok(canhBao.some((s) => /3 pha nhưng nguồn 1 pha/.test(s)));
  assert.equal(duAn.info.ikNguon, 4.5);
  // Tên tầng "CH" không phải số tầng → mã lộ không kèm số tầng
  assert.ok(duAn.circuits.some((c) => c.ma === "WH"));
  assert.ok(!duAn.circuits.some((c) => /CH/.test(c.ma)));
});
