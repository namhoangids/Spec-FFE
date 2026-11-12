// Tạo cả bộ sơ đồ nguyên lý từ file Excel nhập liệu.
//
//   cd dien && npm install
//   node tao-bo-ban-ve.mjs mau/vi-du-HDMON.xlsx [thư-mục-ra]
//   node tao-bo-ban-ve.mjs du-an.json [thư-mục-ra]          (dữ liệu dự án dạng JSON)
//   Tùy chọn: --bang-gia <file.xlsx>  nạp bảng giá cho BOQ (sheet "Bang gia": Khóa | Mã hàng | Đơn giá | Chiết khấu)
//             --hao-hut <số %>        hao hụt dây, cáp, ống trong BOQ (mặc định 5)
//             --boc-khoi <file>       bảng DATAEXTRACTION từ mặt bằng AutoCAD (.csv / .xlsx / .xls): block có thuộc tính
//                                     TU/MACH/CS thì cập nhật công suất mạch; block chỉ có tên thì đếm số lượng; block điện nhẹ
//                                     (ổ data, TV, AP, camera, chuông, đầu đọc, loa, phím KNX) điền bảng điện nhẹ theo TANG/PHONG
//             --quy-doi <file.xlsx>   bảng quy đổi tên block riêng (sheet "Quy doi block"), đặt trước bảng mẫu
//
// Thư mục ra (mặc định out/<tên file>):
//   E.601-T1.dxf      AutoCAD 2007 (màu RGB, block có thuộc tính); tủ quá 18 lộ tự ngắt thêm tờ
//   E.601-T1-R12.dxf  bản R12 gọn (màu AutoCAD chuẩn)
//   E.601-T1.svg      xem trước
//   E.600-TONG.*      sơ đồ nguyên lý cấp điện tổng (cây tủ + bảng tổng hợp phụ tải)
//   bang-tinh.xlsx    kết quả tính từng tủ + danh sách lỗi/cảnh báo/ghi chú
//   nhan.xlsx         danh mục mạch dán cánh tủ + nhãn cáp (cho máy in nhãn)
//   nhan-tu.html      trang in nhãn từ trình duyệt
//   thuyet-minh.docx  thuyết minh tính toán (Word, sửa được) — cùng nội dung với thuyet-minh.html
//   thuyet-minh.html  thuyết minh tính toán, mở trình duyệt để xem / in PDF
//   boq.xlsx          BOQ điện: khối lượng thiết bị, phụ kiện, dây/cáp, ống + khung đơn giá (sheet Bang gia)
//   boc-khoi.xlsx     báo cáo bóc khối (khi có --boc-khoi): công suất mạch cũ → mới, số lượng theo loại, block lạ
//   du-an.json        dữ liệu đã đọc từ Excel, đã áp bóc khối nếu có (tính lại được bằng engine/tinhDuAn;
//                     python3 mau/tao_mau_nhap_lieu.py --tu-json du-an.json ra.xlsx để ra Excel nhập liệu mới)
//   canh-bao.txt      danh sách lỗi/cảnh báo/ghi chú

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as docx from "docx";
import XLSX from "xlsx";

import { MUC, taoBoBanVe, vanBanCanhBao } from "./bo-ban-ve.mjs";
import { apDungBocKhoi, docBocKhoi, docQuyDoi, xuatBaoCaoBocKhoi } from "./engine/boc-khoi.mjs";
import { docBangGia } from "./engine/boq.mjs";
import { docExcel } from "./engine/doc-excel.mjs";
import { xuatExcel } from "./engine/xuat-excel.mjs";
import { QUY_DOI_BLOCK } from "./engine/quy-doi-block.mjs";

const here = dirname(fileURLToPath(import.meta.url));
// Tham số: <đầu vào> [thư mục ra] [--bang-gia file.xlsx] [--hao-hut 5] [--boc-khoi file] [--quy-doi file.xlsx]
const args = process.argv.slice(2);
const tuyChon = (ten) => { const i = args.indexOf(ten); return i < 0 ? null : args.splice(i, 2)[1]; };
const fileGia = tuyChon("--bang-gia");
const haoHut = tuyChon("--hao-hut");
const fileBk = tuyChon("--boc-khoi");
const fileQd = tuyChon("--quy-doi");
const [input, outArg] = args;
if (!input) {
  console.error("Cách dùng: node tao-bo-ban-ve.mjs <file nhập liệu.xlsx | du-an.json> [thư mục ra] [--bang-gia file.xlsx] [--hao-hut 5] [--boc-khoi file.csv] [--quy-doi file.xlsx]");
  process.exit(1);
}
const outDir = outArg || join(here, "out", basename(input, extname(input)));
mkdirSync(outDir, { recursive: true });

// Đầu vào: file Excel nhập liệu, hoặc file JSON dữ liệu dự án (dạng docExcel trả về, ví dụ do agent/goi-y-dau-vao.mjs tạo)
let duAn = extname(input).toLowerCase() === ".json"
  ? { loiDoc: [], quyTac: {}, ...JSON.parse(readFileSync(input, "utf8")) }
  : docExcel(XLSX, readFileSync(input));
for (const s of duAn.loiDoc) console.log(`⚠ Đọc file: ${s}`);

// Bóc khối từ mặt bằng AutoCAD: áp vào dữ liệu trước khi tính
let bocKhoi = null;
if (fileBk) {
  const quyDoi = fileQd ? [...docQuyDoi(XLSX, readFileSync(fileQd)), ...QUY_DOI_BLOCK] : QUY_DOI_BLOCK;
  bocKhoi = apDungBocKhoi(duAn, docBocKhoi(XLSX, readFileSync(fileBk)).dong, { quyDoi, tenFile: basename(fileBk) });
  duAn = bocKhoi.duAn;
}
const bo = taoBoBanVe(duAn);
const { kq, to } = bo;
if (bocKhoi) kq.canhBao.push(...bocKhoi.baoCao.canhBao);

for (const t of to) {
  writeFileSync(join(outDir, `${t.tenFile}.svg`), t.svg, "utf8");
  writeFileSync(join(outDir, `${t.tenFile}.dxf`), t.dxf(), "utf8");
  writeFileSync(join(outDir, `${t.tenFile}-R12.dxf`), t.r12(), "ascii");
  if (t.loai === "tong") {
    console.log(`✔ ${t.tenFile}: sơ đồ cấp điện tổng, ${t.du.bang.length} tủ`);
  } else if (t.loai === "dn") {
    console.log(`✔ ${t.tenFile}: ${t.ten.toLowerCase()}`);
  } else {
    const cb = t.du.panel.incomer;
    console.log(`✔ ${t.tenFile}: ${t.du.circuits.length} lộ ra${cb ? `, ${cb.type} ${cb.poles} ${cb.rating}` : ""}, ${t.du.panel.name}${t.tong > 1 ? ` (tờ ${t.thu + 1}/${t.tong})` : ""}`);
  }
}

writeFileSync(join(outDir, "bang-tinh.xlsx"), XLSX.write(xuatExcel(XLSX, kq, duAn.info, { soTheoTu: bo.soTheoTu }), { type: "buffer", bookType: "xlsx" }));
writeFileSync(join(outDir, "nhan.xlsx"), XLSX.write(bo.nhanExcel(XLSX), { type: "buffer", bookType: "xlsx" }));
writeFileSync(join(outDir, "nhan-tu.html"), bo.nhanHtml(), "utf8");
writeFileSync(join(outDir, "thuyet-minh.docx"), await docx.Packer.toBuffer(bo.thuyetMinhDocx(docx)));
writeFileSync(join(outDir, "thuyet-minh.html"), bo.thuyetMinhHtml(), "utf8");
const bangGia = fileGia ? docBangGia(XLSX, readFileSync(fileGia)) : null;
const boqOpt = { bangGia, haoHut: haoHut == null ? undefined : Number(haoHut) };
writeFileSync(join(outDir, "boq.xlsx"), XLSX.write(bo.boqExcel(XLSX, boqOpt), { type: "buffer", bookType: "xlsx" }));
writeFileSync(join(outDir, "du-an.json"), JSON.stringify(duAn, null, 2), "utf8");
if (bo.dienNhe) {
  writeFileSync(join(outDir, "dien-nhe.xlsx"), XLSX.write(bo.dienNheExcel(XLSX), { type: "buffer", bookType: "xlsx" }));
  const t = bo.dienNhe.tong;
  console.log(`Điện nhẹ: ${[t.data && `${t.data} ổ data`, t.tv && `${t.tv} ổ TV`, t.ap && `${t.ap} AP`, t.cam && `${t.cam} camera`, t.chuong && `${t.chuong} chuông IP`,
    t.cua && `${t.cua} cửa ACS`, t.loa && `${t.loa} loa`, bo.dienNhe.knx && `KNX ${bo.dienNhe.knx.nAct} actuator`].filter(Boolean).join(", ")} — ${t.lienKet} link; ` +
    bo.dienNhe.rack.map((r) => `rack ${r.ma} ${r.uRack}U, UPS ${r.ups.va} VA, nguồn ${r.nguon ? `${r.nguon.tu}/${r.nguon.ma}` : "—"}`).join("; ") + " (dien-nhe.xlsx)");
}
if (bocKhoi) writeFileSync(join(outDir, "boc-khoi.xlsx"), XLSX.write(xuatBaoCaoBocKhoi(XLSX, bocKhoi.baoCao), { type: "buffer", bookType: "xlsx" }));
writeFileSync(join(outDir, "canh-bao.txt"), vanBanCanhBao(kq), "utf8");

const dem = (m) => kq.canhBao.filter((c) => c.muc === m).length;
console.log(`\n${to.length} tờ → ${outDir}`);
console.log(`Lỗi ${dem("loi")} · Cảnh báo ${dem("canhbao")} · Ghi chú ${dem("ghichu")} (xem canh-bao.txt / bang-tinh.xlsx)`);
if (bocKhoi) {
  const b = bocKhoi.baoCao;
  console.log(`Bóc khối ${b.tenFile}: ${b.soDong} dòng (kiểu ${b.cheDo}) · ${b.theoMach.length} mạch cập nhật công suất` +
    `${b.theoMach.some((m) => m.moi) ? ` (mới: ${b.theoMach.filter((m) => m.moi).map((m) => m.mach).join(", ")})` : ""}` +
    `${b.dienNhe ? ` · điện nhẹ: ${b.dienNhe.soCapNhat} phòng cập nhật, ${b.dienNhe.soMoi} phòng mới (${b.dienNhe.truong.join(", ")})` : ""}` +
    `${b.khongNhanDien.length ? ` · block lạ: ${b.khongNhanDien.map((k) => `${k.ten} ×${k.sl}`).join(", ")}` : ""} — xem boc-khoi.xlsx`);
}
const boq = bo.boq(boqOpt);
const coGia = bangGia ? boq.dong.filter((d) => bangGia.gia.get(d.khoa)?.donGia > 0).length : 0;
console.log(`BOQ: ${boq.dong.length} dòng${bangGia ? ` · bảng giá "${bangGia.ten || fileGia}": ${coGia}/${boq.dong.length} dòng có giá` : " · chưa nạp bảng giá (điền ở sheet Bang gia của boq.xlsx)"}${boq.thieuL.length ? ` · chưa có chiều dài: ${boq.thieuL.join(", ")}` : ""}`);
for (const c of kq.canhBao.filter((x) => x.muc !== "ghichu")) console.log(`  ${MUC[c.muc]} ${c.tu} ${c.mach}: ${c.noiDung}`);
