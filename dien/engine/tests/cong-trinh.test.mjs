// Công trình dùng chung với app Dự toán / FF&E: ghép hai danh sách theo tên, tìm, link FF&E, gắn khung tên.
import assert from "node:assert/strict";
import { test } from "node:test";

import { cungCongTrinh, ganCongTrinh, ghepCongTrinh, linkFfe, slug, timCongTrinh } from "../../app/cong-trinh.mjs";

const MASTER = [
  { id: "hado", name: "Hà Đô Charm Villas", client: "Mr. Tuấn", type: "Biệt thự" },
  { id: "vp-abc", name: "Văn phòng ABC", client: "Công ty ABC" },
  { id: "", name: "Thiếu mã" },
];
const FFE = [
  { id: "hado-charm-villas", name: "HÀ ĐÔ  charm villas", itemCount: 42, rooms: ["WC Tầng 1"] },
  { id: "can-ho-mau", name: "Căn hộ mẫu", itemCount: 7 },
];

test("ghép danh sách Dự toán + FF&E theo tên chuẩn hóa (cùng công trình hai mã khác nhau thành một dòng)", () => {
  assert.equal(slug("Hà Đô  Charm Villas!"), "ha-do-charm-villas");
  const ds = ghepCongTrinh(MASTER, FFE);
  assert.deepEqual(ds.map((c) => [c.ten, c.masterId, c.ffeId]), [
    ["Căn hộ mẫu", null, "can-ho-mau"],
    ["HÀ ĐÔ  charm villas", "hado", "hado-charm-villas"],
    ["Văn phòng ABC", "vp-abc", null],
  ]);
  const hado = ds[1];
  assert.equal(hado.client, "Mr. Tuấn");
  assert.equal(hado.soHangMuc, 42);
  // Tìm theo mã Dự toán, mã FF&E, khóa hoặc tên
  for (const x of ["hado", "hado-charm-villas", "ha-do-charm-villas", "Hà Đô Charm Villas"]) assert.equal(timCongTrinh(ds, x), hado, x);
  assert.equal(timCongTrinh(ds, "không có"), null);
});

test("link FF&E: mã FF&E, không có thì mã Dự toán (FF&E tự tạo bảng kê); chưa cấu hình URL thì không có link", () => {
  const ds = ghepCongTrinh(MASTER, FFE);
  const url = "https://vi.du/ffe-schedule-app.html";
  assert.equal(linkFfe(timCongTrinh(ds, "hado"), url), `${url}#/hado-charm-villas/schedule`);
  assert.equal(linkFfe(timCongTrinh(ds, "vp-abc"), url), `${url}#/vp-abc/schedule`);
  assert.equal(linkFfe(timCongTrinh(ds, "hado"), ""), null);
  assert.equal(linkFfe(null, url), null);
});

test("gắn công trình: chỉ điền ô khung tên đang trống, không sửa bản gốc; bỏ gắn xóa liên kết", () => {
  const ds = ghepCongTrinh(MASTER, FFE);
  const hado = timCongTrinh(ds, "hado");
  const goc = { info: { project: "", client: "Chủ nhà riêng" }, panels: [], circuits: [] };
  const { duAn, daDien } = ganCongTrinh(goc, hado);
  assert.deepEqual(duAn.congTrinh, { key: "ha-do-charm-villas", ten: "HÀ ĐÔ  charm villas", client: "Mr. Tuấn", masterId: "hado", ffeId: "hado-charm-villas" });
  assert.equal(duAn.info.project, "HÀ ĐÔ  charm villas");
  assert.equal(duAn.info.client, "Chủ nhà riêng", "ô đã có chữ thì giữ");
  assert.deepEqual(daDien, ["tên dự án"]);
  assert.equal(goc.info.project, "");
  assert.ok(cungCongTrinh(duAn.congTrinh, hado));
  assert.ok(cungCongTrinh({ key: "khac", masterId: "hado" }, hado), "khớp theo mã Dự toán dù tên đổi");
  assert.ok(!cungCongTrinh(duAn.congTrinh, timCongTrinh(ds, "vp-abc")));
  assert.equal(ganCongTrinh(duAn, null).duAn.congTrinh, undefined);
});
