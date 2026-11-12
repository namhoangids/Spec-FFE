// Bóc khối điện nhẹ: block ổ data / TV / AP / camera / chuông / đầu đọc ACS / loa / phím KNX trên mặt bằng
// → bảng điện nhẹ theo phòng (duAn.dienNhe.phong), không sửa mạch điện, BOQ không đếm hai lần.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import XLSX from "xlsx";

import { taoBoBanVe } from "../../bo-ban-ve.mjs";
import { apDungBocKhoi, docBocKhoi, docQuyDoi, xuatBaoCaoBocKhoi } from "../boc-khoi.mjs";
import { QUY_DOI_BLOCK } from "../quy-doi-block.mjs";

const mau = (f) => readFileSync(new URL(`../../mau/vi-du-boc-khoi/${f}`, import.meta.url));
const canHo = () => JSON.parse(readFileSync(new URL("../../du-an/can-ho-3pn-3-pha/du-an.json", import.meta.url), "utf8"));
const b = (ten, sl, o = {}) => ({ ten, sl, tu: "", mach: "", w: null, phong: "", layer: "", ...o });
const tim = (ds, chu) => ds.filter((c) => c.noiDung.includes(chu));

test("bảng quy đổi: tên block → trường điện nhẹ; mẫu cụ thể thắng mẫu chung", () => {
  const { duAn } = apDungBocKhoi(canHo(), [
    b("CAM_NGOAI_BULLET", 1, { phong: "SÂN" }), b("CAM_DOME", 2, { phong: "SÂN" }), b("NUT_GOI", 1, { phong: "SÂN" }),
    b("CHUONG_MH", 1, { phong: "SÂN" }), b("ACS_KHOA", 1, { phong: "SÂN" }), b("DAU_DOC", 1, { phong: "SÂN" }),
    b("O_DATA", 3, { phong: "SÂN" }), b("TV_OUTLET", 1, { phong: "SÂN" }), b("WIFI_AP", 1, { phong: "SÂN" }),
    b("SPEAKER_6W", 2, { phong: "SÂN" }), b("PHIM_KNX", 1, { phong: "SÂN" }),
  ]);
  const p = duAn.dienNhe.phong[0];
  assert.deepEqual([p.camNgoai, p.camTrong, p.chuongNgoai, p.chuongTrong, p.acs, p.data, p.tv, p.ap, p.loa, p.knx], [1, 2, 1, 1, 1, 3, 1, 1, 2, 1]);
  assert.ok(QUY_DOI_BLOCK.filter((q) => q.nhom === "Điện nhẹ").every((q) => q.tinhCongSuat === false));
});

test("căn hộ chưa có điện nhẹ: tạo bảng theo phòng, loa lấy tap từ CS, block có MACH không sửa mạch, ra đủ tờ E.7xx", () => {
  const goc = canHo();
  const { dong } = docBocKhoi(XLSX, mau("boc-khoi-dien-nhe.csv"));
  assert.equal(dong.find((d) => d.ten === "LOA_TRAN_6W").vung, "Vùng khách - bếp");
  const { duAn, baoCao } = apDungBocKhoi(goc, dong, { tenFile: "dn.csv" });
  assert.deepEqual(duAn.circuits, goc.circuits, "không sửa mạch điện (CAM_DOME có MACH L9 vẫn bỏ qua)");
  const ph = (ten) => duAn.dienNhe.phong.find((p) => p.phong === ten);
  assert.equal(duAn.dienNhe.phong.length, 7);
  assert.deepEqual([ph("P.KHÁCH").data, ph("P.KHÁCH").tv, ph("P.KHÁCH").ap, ph("P.KHÁCH").loa, ph("P.KHÁCH").knx, ph("P.KHÁCH").chuongTrong], [2, 1, 1, 4, 2, 1]);
  assert.equal(ph("P.NGỦ MASTER").loaW, 3);
  assert.equal(ph("BẾP").vungAm, "Vùng khách - bếp");
  assert.deepEqual([ph("SẢNH CĂN HỘ").acs, ph("SẢNH CĂN HỘ").camNgoai, ph("SẢNH CĂN HỘ").chuongNgoai], [1, 1, 1]);
  assert.match(ph("BẾP").ghiChu, /^bóc khối \(dn\.csv\)/);
  assert.equal(baoCao.cheDo, "tên block + điện nhẹ");
  assert.equal(baoCao.dienNhe.soMoi, 7);
  assert.equal(tim(baoCao.canhBao, "cần nhập chiều dài cáp ngang L").length, 7);
  assert.deepEqual(baoCao.khongNhanDien.map((k) => k.ten), ["HOP_KY_THUAT_DN"]);

  const bo = taoBoBanVe(duAn);
  assert.equal(bo.kq.canhBao.filter((c) => c.muc === "loi").length, 0);
  assert.deepEqual(bo.to.filter((t) => t.loai === "dn").map((t) => t.ma), ["DN-TRUC", "DN-MANG", "RACK-R1", "DN-AM", "DN-ACS", "DN-KNX"]);
  assert.equal(bo.dienNhe.tong.data, 2 + 1 + 1 + 1 + 1);
  // BOQ: thiết bị điện nhẹ chỉ ở nhóm F, không ở nhóm E
  const boq = bo.boq();
  assert.equal(boq.dong.filter((d) => d.nhom === "thietBiDien").length, 0);
  assert.equal(boq.dong.find((d) => d.nhom === "dienNhe" && d.khoa === "Mặt + nhân ổ data RJ45 Cat6").kl, 6);
  assert.equal(boq.dong.find((d) => d.nhom === "dienNhe" && d.khoa === "Phím bấm / cảm biến KNX").kl, 6);
  const wb = xuatBaoCaoBocKhoi(XLSX, baoCao);
  assert.ok(wb.SheetNames.includes("Dien nhe"));
});

test("gộp với bảng điện nhẹ có sẵn: loại có trên mặt bằng thay số, loại khác và L / rack giữ nguyên; phòng thiếu / mới có cảnh báo", () => {
  const goc = canHo();
  goc.dienNhe = {
    phong: [
      { tang: "CH", phong: "P.KHÁCH", data: 4, tv: 2, ap: 1, loa: 6, loaW: 6, L: 18, rack: "R1", ghiChu: "giả định" },
      { tang: "CH", phong: "P.NGỦ 2", data: 2, tv: 1, L: 22, rack: "R1" },
      { tang: "CH", phong: "KHO", data: 1, L: 9, rack: "R1" },
    ],
    rack: [{ ma: "R1", tang: "CH", capTu: "CH", lNguon: 5, trungTam: true }],
  };
  // Mặt bằng chỉ có ổ data và AP (không có block TV / loa)
  const { duAn, baoCao } = apDungBocKhoi(goc, [
    b("O_DATA", 3, { phong: "p.khách" }), b("AP_TRAN", 2, { phong: "P.KHÁCH" }),
    b("O_DATA", 1, { phong: "P.NGỦ 2" }),
    b("O_DATA", 2, { phong: "P.LÀM VIỆC" }),
  ], { tenFile: "mb.csv" });
  assert.deepEqual(baoCao.dienNhe.truong, ["data", "ap"]);
  const ph = (ten) => duAn.dienNhe.phong.find((p) => p.phong === ten);
  assert.deepEqual([ph("P.KHÁCH").data, ph("P.KHÁCH").ap, ph("P.KHÁCH").tv, ph("P.KHÁCH").loa, ph("P.KHÁCH").L], [3, 2, 2, 6, 18]);
  assert.equal(ph("P.KHÁCH").ghiChu, "bóc khối (mb.csv)", "bỏ ghi chú giả định");
  assert.deepEqual([ph("P.NGỦ 2").data, ph("P.NGỦ 2").ap, ph("P.NGỦ 2").tv], [1, 0, 1]);
  assert.equal(ph("KHO").data, 1, "phòng không có trên mặt bằng: giữ số cũ");
  assert.equal(tim(baoCao.canhBao, "phòng KHO (tầng CH) có 1 data nhưng không có block nào").length, 1);
  assert.equal(ph("P.LÀM VIỆC").tang, "CH", "thiếu TANG: lấy tầng duy nhất của bảng điện nhẹ");
  assert.equal(tim(baoCao.canhBao, "thêm phòng P.LÀM VIỆC").length, 1);
  assert.equal(tim(baoCao.canhBao, "thiếu thuộc tính TANG").length, 1);
  assert.deepEqual(baoCao.dienNhe.phong.find((p) => p.phong === "P.KHÁCH"), { tang: "CH", phong: "P.KHÁCH", moi: false, truoc: { data: 4, ap: 1 }, sau: { data: 3, ap: 2 } });
  assert.equal(goc.dienNhe.phong[0].data, 4, "dữ liệu gốc không bị sửa");
});

test("tầng: thuộc tính TANG thắng; nhiều tầng thì theo phòng cùng tên đã có; bảng quy đổi riêng có cột Trường điện nhẹ", () => {
  const goc = { info: {}, panels: [{ ma: "T1" }, { ma: "T2", capTu: "T1" }], circuits: [],
    dienNhe: { phong: [{ tang: "T2", phong: "P.NGỦ 1", data: 1 }, { tang: "T1", phong: "SẢNH", ap: 1 }] } };
  const { duAn } = apDungBocKhoi(goc, [b("O_DATA", 2, { phong: "P.NGỦ 1" }), b("O_DATA", 1, { phong: "P.NGỦ 1", tang: "T3" }), b("O_DATA", 1, { phong: "GARA" })]);
  assert.deepEqual(duAn.dienNhe.phong.map((p) => [p.tang, p.phong, p.data ?? 0]), [["T2", "P.NGỦ 1", 2], ["T1", "SẢNH", 0], ["T3", "P.NGỦ 1", 1], ["T1", "GARA", 1]]);

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
    ["Mẫu tên block", "Nhóm", "Mô tả", "Loại mạch", "W", "Tính công suất", "ĐVT", "Trường điện nhẹ"],
    ["IDS_LAN*", "Điện nhẹ", "Ổ mạng công ty", "", 0, "Không", "", "data"],
  ]), "Quy doi block");
  const rieng = docQuyDoi(XLSX, XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
  assert.deepEqual([rieng[0].dn, rieng[0].nhom, rieng[0].tinhCongSuat], ["data", "Điện nhẹ", false]);
  const r = apDungBocKhoi({ info: {}, panels: [{ ma: "T1" }], circuits: [] }, [b("IDS_LAN_02", 5, { phong: "VP" })], { quyDoi: rieng });
  assert.deepEqual([r.duAn.dienNhe.phong[0].tang, r.duAn.dienNhe.phong[0].data], ["T1", 5]);
});
