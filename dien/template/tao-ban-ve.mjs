// Tạo bản vẽ sơ đồ nguyên lý tủ điện theo template Indust từ file dữ liệu JSON.
//
//   cd dien/template && npm install
//   node tao-ban-ve.mjs du-lieu/E601-T1.json [du-lieu/E602-T2.json ...]
//
// Kết quả nằm trong thư mục out/: <tên>.dxf (mở bằng AutoCAD) và <tên>.svg (xem trước).

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { veSoDoTu } from "./mau-indust.mjs";
import { taoDxf } from "./ve-dxf.mjs";
import { taoSvg } from "./ve-svg.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, "out");
mkdirSync(outDir, { recursive: true });

const files = process.argv.slice(2);
if (!files.length) {
  console.error("Cách dùng: node tao-ban-ve.mjs du-lieu/<file>.json ...");
  process.exit(1);
}

for (const file of files) {
  const data = JSON.parse(readFileSync(file, "utf8"));
  const name = basename(file, ".json");
  const svg = taoSvg();
  const warnings = veSoDoTu(svg, data);
  const dxf = taoDxf();
  veSoDoTu(dxf, data);
  writeFileSync(join(outDir, `${name}.svg`), svg.toString(), "utf8");
  writeFileSync(join(outDir, `${name}.dxf`), dxf.toString(), "utf8");
  console.log(`✔ ${name}: ${data.circuits.length} mạch → out/${name}.dxf, out/${name}.svg`);
  for (const w of warnings) console.log(`  ⚠ ${w}`);
}
