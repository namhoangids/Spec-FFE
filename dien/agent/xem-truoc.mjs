// Chụp các tờ SVG thành PNG để xem nhanh (agent tự soát bố cục, hoặc gửi ảnh cho người dùng).
//
//   node agent/xem-truoc.mjs <thư mục bộ bản vẽ> [--chi E.600,E.601] [--ty-le 2]
//
// Ảnh ghi vào <thư mục>/xem-truoc/<tên tờ>.png. Dùng Chromium/Playwright có sẵn trong môi trường;
// máy khác thì cài `npm i -D playwright && npx playwright install chromium`.

import { mkdirSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const args = process.argv.slice(2);
const thuMuc = args.find((a) => !a.startsWith("--"));
if (!thuMuc) {
  console.error("Cách dùng: node agent/xem-truoc.mjs <thư mục bộ bản vẽ> [--chi E.600,E.601] [--ty-le 2]");
  process.exit(1);
}
const lay = (ten) => { const i = args.indexOf(ten); return i >= 0 ? args[i + 1] : null; };
const chi = lay("--chi")?.split(",").map((s) => s.trim()).filter(Boolean);
const tyLe = Number(lay("--ty-le") || 1);

const svg = readdirSync(thuMuc).filter((f) => f.endsWith(".svg"))
  .filter((f) => !chi || chi.some((c) => f.startsWith(c))).sort();
if (!svg.length) { console.error(`Không có file SVG nào trong ${thuMuc}`); process.exit(1); }

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require("playwright")); } catch {
  console.error("Chưa có Playwright — cài: npm i -D playwright && npx playwright install chromium");
  process.exit(1);
}

const ra = join(thuMuc, "xem-truoc");
mkdirSync(ra, { recursive: true });
const browser = await chromium.launch();
try {
  // Khổ A3 ngang (420 × 297) → 1680 × 1188 px ở tỷ lệ 1
  const page = await browser.newPage({ viewport: { width: 1680, height: 1188 }, deviceScaleFactor: tyLe });
  for (const f of svg) {
    await page.goto(pathToFileURL(resolve(thuMuc, f)).href);
    const anh = join(ra, f.replace(/\.svg$/, ".png"));
    await page.screenshot({ path: anh });
    console.log(`✔ ${anh}`);
  }
} finally {
  await browser.close();
}
