// Tạo cả bộ sơ đồ nguyên lý từ file Excel nhập liệu.
//
//   cd dien && npm install
//   node tao-bo-ban-ve.mjs mau/vi-du-HDMON.xlsx [thư-mục-ra]
//
// Thư mục ra (mặc định out/<tên file>):
//   E.601-T1.dxf      AutoCAD 2007 (màu RGB, block có thuộc tính); tủ quá 18 lộ tự ngắt thêm tờ
//   E.601-T1-R12.dxf  bản R12 gọn (màu AutoCAD chuẩn)
//   E.601-T1.svg      xem trước
//   E.600-TONG.*      sơ đồ nguyên lý cấp điện tổng (cây tủ + bảng tổng hợp phụ tải)
//   bang-tinh.xlsx    kết quả tính từng tủ + danh sách lỗi/cảnh báo/ghi chú
//   nhan.xlsx         danh mục mạch dán cánh tủ + nhãn cáp (cho máy in nhãn)
//   nhan-tu.html      trang in nhãn từ trình duyệt
//   du-an.json        dữ liệu đã đọc từ Excel (tính lại được bằng engine/tinhDuAn)
//   canh-bao.txt      danh sách lỗi/cảnh báo/ghi chú

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import XLSX from "xlsx";

import { MUC, taoBoBanVe, vanBanCanhBao } from "./bo-ban-ve.mjs";
import { docExcel } from "./engine/doc-excel.mjs";
import { xuatExcel } from "./engine/xuat-excel.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const [input, outArg] = process.argv.slice(2);
if (!input) {
  console.error("Cách dùng: node tao-bo-ban-ve.mjs <file nhập liệu.xlsx> [thư mục ra]");
  process.exit(1);
}
const outDir = outArg || join(here, "out", basename(input, extname(input)));
mkdirSync(outDir, { recursive: true });

const duAn = docExcel(XLSX, readFileSync(input));
for (const s of duAn.loiDoc) console.log(`⚠ Đọc file: ${s}`);
const bo = taoBoBanVe(duAn);
const { kq, to } = bo;

for (const t of to) {
  writeFileSync(join(outDir, `${t.tenFile}.svg`), t.svg, "utf8");
  writeFileSync(join(outDir, `${t.tenFile}.dxf`), t.dxf(), "utf8");
  writeFileSync(join(outDir, `${t.tenFile}-R12.dxf`), t.r12(), "ascii");
  if (t.loai === "tong") {
    console.log(`✔ ${t.tenFile}: sơ đồ cấp điện tổng, ${t.du.bang.length} tủ`);
  } else {
    const cb = t.du.panel.incomer;
    console.log(`✔ ${t.tenFile}: ${t.du.circuits.length} lộ ra${cb ? `, ${cb.type} ${cb.poles} ${cb.rating}` : ""}, ${t.du.panel.name}${t.tong > 1 ? ` (tờ ${t.thu + 1}/${t.tong})` : ""}`);
  }
}

writeFileSync(join(outDir, "bang-tinh.xlsx"), XLSX.write(xuatExcel(XLSX, kq, duAn.info, { soTheoTu: bo.soTheoTu }), { type: "buffer", bookType: "xlsx" }));
writeFileSync(join(outDir, "nhan.xlsx"), XLSX.write(bo.nhanExcel(XLSX), { type: "buffer", bookType: "xlsx" }));
writeFileSync(join(outDir, "nhan-tu.html"), bo.nhanHtml(), "utf8");
writeFileSync(join(outDir, "du-an.json"), JSON.stringify(duAn, null, 2), "utf8");
writeFileSync(join(outDir, "canh-bao.txt"), vanBanCanhBao(kq), "utf8");

const dem = (m) => kq.canhBao.filter((c) => c.muc === m).length;
console.log(`\n${to.length} tờ → ${outDir}`);
console.log(`Lỗi ${dem("loi")} · Cảnh báo ${dem("canhbao")} · Ghi chú ${dem("ghichu")} (xem canh-bao.txt / bang-tinh.xlsx)`);
for (const c of kq.canhBao.filter((x) => x.muc !== "ghichu")) console.log(`  ${MUC[c.muc]} ${c.tu} ${c.mach}: ${c.noiDung}`);
