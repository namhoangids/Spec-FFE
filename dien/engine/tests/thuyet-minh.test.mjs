// Thuyết minh tính toán: nội dung (mục, bảng, kết luận) và hai bộ xuất Word / HTML.
import assert from "node:assert/strict";
import { test } from "node:test";

import * as docx from "docx";
import JSZip from "jszip";

import { taoBoBanVe } from "../../bo-ban-ve.mjs";
import { noiDungThuyetMinh, thuyetMinhHtml } from "../thuyet-minh.mjs";
import { thuyetMinhDocx } from "../thuyet-minh-docx.mjs";
import { DB_T1 } from "./du-lieu-db-t1.mjs";

const chu = (noi = []) => noi.map((x) => (typeof x === "string" ? x : x.b)).join("");
const vanBan = (nd) => nd.khoi.flatMap((k) => [k.text, k.phu, chu(k.noi), ...(k.muc || []).map(chu), ...(k.dong || []).flat(), ...(k.o || []).flat()]).filter(Boolean).join("\n");
const bo = (duAn) => taoBoBanVe(structuredClone(duAn));

test("đủ mục 1–6 đúng thứ tự; mỗi tủ một mục 5.x; mạch nào có cáp đều có dòng trong bảng của tủ đó", () => {
  const b = bo(DB_T1);
  const nd = b.thuyetMinh();
  const muc1 = nd.khoi.filter((k) => k.loai === "muc" && k.cap === 1).map((k) => k.so);
  assert.deepEqual(muc1, ["01", "02", "03", "04", "05", "06"]);
  // Đầu tài liệu theo mẫu Indust Design: khối thông tin 3 × 2, dòng "Cách dùng", chân trang
  const tt = nd.khoi.find((k) => k.loai === "thongTin");
  assert.deepEqual(tt.o.map((x) => x[0]), ["DỰ ÁN", "CHỦ ĐẦU TƯ", "NGÀY LẬP", "BẢN VẼ KÈM THEO", "NGƯỜI LẬP", "TRẠNG THÁI"]);
  assert.ok(nd.khoi.some((k) => k.loai === "cachDung"));
  assert.match(nd.chanTrang, /^Indust Design \| .+ \| Thuyết minh tính toán hệ thống điện \| Working Document$/);
  const muc5 = nd.khoi.filter((k) => k.loai === "muc" && /^5\.\d+\. Tủ /.test(k.text));
  assert.deepEqual(muc5.map((k) => k.text.match(/Tủ (\S+)/)[1]), b.kq.tu.map((t) => t.ma));
  for (const t of b.kq.tu) {
    const i = nd.khoi.findIndex((k) => k.loai === "muc" && k.text.includes(`Tủ ${t.ma} `));
    const bang = nd.khoi.slice(i).find((k) => k.loai === "bang");
    const maTrongBang = bang.dong.map((d) => d[0]);
    for (const m of t.mach) assert.ok(maTrongBang.includes(m.ma), `${t.ma}/${m.ma} có trong bảng`);
  }
  // Có trang ngang cho bảng rộng, và quay lại trang dọc ở mục 6
  assert.deepEqual(nd.khoi.filter((k) => k.loai === "trang").map((k) => k.huong), ["doc", "ngang", "doc"]);
});

test("mục 3 ghi đúng tham số của bộ quy tắc; khung CHƯA DUYỆT; kết luận khi 0 lỗi", () => {
  const b = bo(DB_T1);
  const r = b.kq.quyTac;
  const nd = b.thuyetMinh();
  const s = vanBan(nd);
  assert.match(s, new RegExp(`Uf = ${r.uf} V`));
  assert.match(s, new RegExp(`Ud = ${r.ud} V`));
  assert.ok(s.includes(`≤ ${r.duMax}% (mạch chiếu sáng ≤ ${r.duChieuSang}%)`));
  assert.ok(s.includes(`≤ ${r.lapDay}% diện tích trong của ống`));
  assert.ok(nd.khoi.some((k) => k.loai === "cachDung" && /CHƯA DUYỆT/.test(chu(k.noi))));
  assert.equal(b.kq.canhBao.filter((c) => c.muc === "loi").length, 0);
  assert.match(s, /không phát hiện lỗi/);
  assert.doesNotMatch(s, /phải xử lý trước khi phát hành/);
});

test("dự án còn lỗi → kết luận ghi số lỗi phải xử lý; ghi đè có lý do vào mục 6.2", () => {
  const duAn = structuredClone(DB_T1);
  const c06 = duAn.circuits.find((c) => c.ma === "C06");
  Object.assign(c06, { ghiDeThietBi: "MCB 1P 10A", lyDo: "thử lỗi" });   // bếp từ 4 kW: Ib ≈ 19 A > 10 A
  const b = bo(duAn);
  const nLoi = b.kq.canhBao.filter((c) => c.muc === "loi").length;
  assert.ok(nLoi > 0);
  const s = vanBan(b.thuyetMinh());
  assert.match(s, new RegExp(`Còn ${nLoi} lỗi \\(mục 6\\.1\\) phải xử lý trước khi phát hành`));
  assert.match(s, /thử lỗi/);
  assert.doesNotMatch(s, /không phát hiện lỗi/);
});

test("Word: đóng gói được, có tên tủ, CB tổng, trang ngang và tiêu đề cột lặp lại; HTML có trang ngang", async () => {
  const b = bo(DB_T1);
  const buf = await docx.Packer.toBuffer(b.thuyetMinhDocx(docx));
  const xml = await (await JSZip.loadAsync(buf)).file("word/document.xml").async("string");
  assert.match(xml, /THUYẾT MINH TÍNH TOÁN HỆ THỐNG ĐIỆN/);
  for (const t of b.kq.tu) assert.ok(xml.includes(`Tủ ${t.ma} – ${t.ten}`), t.ma);
  const mdb = b.kq.tu.find((t) => t.ma === "MDB");
  assert.ok(xml.includes(`${mdb.cbTong.loai} ${mdb.cbTong.soCuc} ${mdb.cbTong.in}A`));
  assert.match(xml, /w:orient="landscape"/);
  assert.match(xml, /<w:tblHeader\/>/);
  assert.match(xml, /<w:tblStyle w:val="IndustBang"\/>/, "bảng dùng Table Style băng màu");
  const zip = await JSZip.loadAsync(buf);
  const styles = await zip.file("word/styles.xml").async("string");
  assert.match(styles, /w:styleId="IndustBang"/);
  assert.match(styles, /w:ascii="Arial"/, "font Arial như mẫu Indust Design");
  const footer = (await Promise.all(Object.keys(zip.files).filter((f) => /word\/footer\d*\.xml$/.test(f)).map((f) => zip.file(f).async("string")))).join("");
  assert.match(footer, /Indust Design \|/);
  const html = b.thuyetMinhHtml();
  assert.match(html, /@page ngang \{ size: A4 landscape/);
  assert.match(html, /<section class="ngang">/);
  assert.match(html, /@bottom-center \{ content: "Indust Design \|/);
});

test("nội dung dùng số bản vẽ của bộ tờ (tủ bị ngắt 2 tờ ghi dải số)", () => {
  const circuits = Array.from({ length: 25 }, (_, i) => ({ tu: "T1", ma: `L${i + 1}`, loai: "Chiếu sáng trong nhà", congSuat: 200, L: 10 }));
  const b = bo({ info: { ikNguon: 6 }, panels: [{ ma: "T1", soPha: 3 }], circuits });
  const nd = noiDungThuyetMinh(b.kq, {}, { soTheoTu: b.soTheoTu });
  assert.ok(nd.khoi.some((k) => k.loai === "muc" && k.text === "5.1. Tủ T1 – T1 (bản vẽ E.601–E.602)"));
  assert.match(thuyetMinhHtml(nd), /E\.601–E\.602/);
});
