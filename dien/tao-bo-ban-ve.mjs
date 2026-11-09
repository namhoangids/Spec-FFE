// Tạo cả bộ sơ đồ nguyên lý từ file Excel nhập liệu.
//
//   cd dien && npm install
//   node tao-bo-ban-ve.mjs mau/vi-du-HDMON.xlsx [thư-mục-ra]
//
// Thư mục ra (mặc định out/<tên file>):
//   E.601-T1.dxf      AutoCAD 2007 (màu RGB, block có thuộc tính)
//   E.601-T1-R12.dxf  bản R12 gọn (màu AutoCAD chuẩn)
//   E.601-T1.svg      xem trước
//   bang-tinh.xlsx    kết quả tính từng tủ + danh sách lỗi/cảnh báo/ghi chú
//   du-an.json        dữ liệu đã đọc từ Excel (tính lại được bằng engine/tinhDuAn)
//   canh-bao.txt      danh sách lỗi/cảnh báo/ghi chú

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import XLSX from "xlsx";

import { docExcel, tinhDuAn } from "./engine/index.mjs";
import { sangBoBanVe } from "./engine/sang-ban-ve.mjs";
import { xuatExcel } from "./engine/xuat-excel.mjs";
import { veSoDoTu } from "./template/mau-indust.mjs";
import { taoDxf } from "./template/ve-dxf.mjs";
import { taoDxfR12 } from "./template/ve-dxf-r12.mjs";
import { taoSvg } from "./template/ve-svg.mjs";

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
const kq = tinhDuAn(structuredClone(duAn));
const bo = sangBoBanVe(kq, duAn.info);

const MUC = { loi: "LỖI", canhbao: "CẢNH BÁO", ghichu: "GHI CHÚ" };
for (const { ma, du } of bo) {
  const ten = `${du.sheet.drawingNo}-${ma}`.replace(/[\\/:*?"<>|]/g, "-");
  const svg = taoSvg();
  const boCuc = veSoDoTu(svg, du);
  const dxf = taoDxf();
  veSoDoTu(dxf, du);
  const r12 = taoDxfR12();
  veSoDoTu(r12, du);
  writeFileSync(join(outDir, `${ten}.svg`), svg.toString(), "utf8");
  writeFileSync(join(outDir, `${ten}.dxf`), dxf.toString(), "utf8");
  writeFileSync(join(outDir, `${ten}-R12.dxf`), r12.toString(), "ascii");
  for (const w of boCuc) kq.canhBao.push({ muc: "ghichu", tu: ma, mach: "", noiDung: `Bố cục: ${w}` });
  console.log(`✔ ${ten}: ${du.circuits.length} lộ ra, ${du.panel.incomer.type} ${du.panel.incomer.poles} ${du.panel.incomer.rating}, ${du.panel.name}`);
}

writeFileSync(join(outDir, "bang-tinh.xlsx"), XLSX.write(xuatExcel(XLSX, kq, duAn.info), { type: "buffer", bookType: "xlsx" }));
writeFileSync(join(outDir, "du-an.json"), JSON.stringify(duAn, null, 2), "utf8");
const dong = ["loi", "canhbao", "ghichu"].flatMap((m) => kq.canhBao.filter((c) => c.muc === m)
  .map((c) => `${MUC[m]}\t${c.tu}\t${c.mach}\t${c.noiDung}`));
writeFileSync(join(outDir, "canh-bao.txt"), dong.join("\n") + "\n", "utf8");

const dem = (m) => kq.canhBao.filter((c) => c.muc === m).length;
console.log(`\n${bo.length} tờ → ${outDir}`);
console.log(`Lỗi ${dem("loi")} · Cảnh báo ${dem("canhbao")} · Ghi chú ${dem("ghichu")} (xem canh-bao.txt / bang-tinh.xlsx)`);
for (const c of kq.canhBao.filter((x) => x.muc !== "ghichu")) console.log(`  ${MUC[c.muc]} ${c.tu} ${c.mach}: ${c.noiDung}`);
