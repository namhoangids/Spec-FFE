// Kiểm tra nhanh web app bằng Playwright (Chromium):
//   cd dien && npm install && node app/kiem-tra-app.mjs [thư-mục-ảnh]
// Mở dien/app qua máy chủ tĩnh cục bộ, thư viện CDN được phục vụ từ node_modules (chạy được khi không có mạng).

import { createServer } from "node:http";
import { mkdirSync, readFileSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const JSZip = require("jszip");
const XLSX = require("xlsx");

const dien = join(dirname(fileURLToPath(import.meta.url)), "..");
const goc = join(dien, "..");
const anh = process.argv[2];
const MIME = { ".html": "text/html; charset=utf-8", ".mjs": "text/javascript", ".js": "text/javascript", ".xlsx": "application/octet-stream", ".svg": "image/svg+xml" };

const server = createServer((req, res) => {
  const p = normalize(join(goc, decodeURIComponent(new URL(req.url, "http://x").pathname)));
  let f = p;
  try { if (statSync(f).isDirectory()) f = join(f, "index.html"); } catch { /* 404 bên dưới */ }
  try {
    const body = readFileSync(f);
    res.writeHead(200, { "content-type": MIME[extname(f)] || "application/octet-stream" });
    res.end(body);
  } catch { res.writeHead(404); res.end(); }
}).listen(0);
const port = server.address().port;

const CDN = [
  [/xlsx\.full\.min\.js$/, join(dien, "node_modules/xlsx/dist/xlsx.full.min.js")],
  [/jszip\.min\.js$/, join(dien, "node_modules/jszip/dist/jszip.min.js")],
  [/@tarikjabiri\/dxf@2\.10\.0\/\+esm$/, join(dien, "node_modules/@tarikjabiri/dxf/lib/index.mjs")],
];

const browser = await chromium.launch();
try {
  const ctx = await browser.newContext({ viewport: { width: 1360, height: 900 }, acceptDownloads: true });
  const page = await ctx.newPage();
  const loiTrang = [];
  page.on("pageerror", (e) => loiTrang.push(e.message));
  page.on("console", (m) => { if (m.type() === "error") loiTrang.push(m.text()); });
  await page.route(/^https:\/\/(cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net)\//, (route) => {
    const hit = CDN.find(([re]) => re.test(route.request().url()));
    return hit ? route.fulfill({ body: readFileSync(hit[1]), contentType: "text/javascript" }) : route.abort();
  });
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (route) => route.fulfill({ body: "", contentType: "text/css" }));

  await page.goto(`http://localhost:${port}/dien/app/`);
  await page.click("#vidu");
  await page.waitForSelector("#tree .node");
  const nodes = await page.locator("#tree .node").allInnerTexts();
  assert.equal(nodes.length, 7, "đủ 7 tờ: sơ đồ tổng + 6 tủ");
  assert.match(nodes[0], /E\.600\s+Sơ đồ tổng/);
  assert.match(nodes[1], /E\.601\s+T1/);
  assert.match(await page.locator("#stats").innerText(), /lỗi\s+0/i);
  assert.equal(await page.locator("#pane svg").count(), 1, "có bản vẽ SVG");
  assert.match(await page.locator("#phead").innerText(), /SƠ ĐỒ NGUYÊN LÝ CẤP ĐIỆN TỔNG/);
  if (anh) { mkdirSync(anh, { recursive: true }); await page.screenshot({ path: join(anh, "app-so-do-tong.png") }); }
  await page.click("[data-view=bang]");
  assert.equal(await page.locator("#pane tbody tr").count(), 6, "bảng tổng hợp 6 tủ");
  await page.click("[data-view=ve]");

  // In nhãn: mở tab mới có 6 trang danh mục mạch
  const [popup] = await Promise.all([page.waitForEvent("popup"), page.click("#nhan")]);
  await popup.waitForLoadState();
  assert.equal(await popup.locator("section.trang").count(), 6, "6 trang danh mục mạch");
  assert.ok(await popup.locator(".nhan").count() > 0, "có nhãn cáp");
  await popup.close();

  await page.click("#tree .node >> nth=3");
  assert.match(await page.locator("#phead").innerText(), /SƠ ĐỒ NGUYÊN LÝ ĐIỆN T3/);
  await page.click("[data-view=bang]");
  assert.equal(await page.locator("#pane tbody tr").count(), 10, "T3 có 10 lộ ra");
  if (anh) await page.screenshot({ path: join(anh, "app-bang-tinh.png") });
  await page.click("[data-view=tatca]");
  assert.ok(await page.locator("#pane .msg").count() > 0);

  const [dl] = await Promise.all([page.waitForEvent("download"), page.click("#zip")]);
  const zip = await JSZip.loadAsync(readFileSync(await dl.path()));
  const ten = Object.keys(zip.files).sort();
  assert.equal(ten.filter((f) => f.endsWith(".dxf")).length, 14);
  assert.equal(ten.filter((f) => f.endsWith(".svg")).length, 7);
  for (const f of ["E.600-TONG-R12.dxf", "bang-tinh.xlsx", "nhan.xlsx", "nhan-tu.html", "du-an.json", "canh-bao.txt"]) assert.ok(ten.includes(f), f);
  const r12 = await zip.file("E.603-T3-R12.dxf").async("string");
  assert.match(r12, /AC1009/);
  const wb = XLSX.read(await zip.file("bang-tinh.xlsx").async("uint8array"));
  assert.deepEqual(wb.SheetNames, ["Tong hop", "T1", "T2", "T3", "T4", "T5", "T6", "Canh bao", "Quy tac"]);

  const [dl2] = await Promise.all([page.waitForEvent("download"), page.click("#dl-dxf")]);
  assert.equal(dl2.suggestedFilename(), "E.603-T3.dxf");

  // Màn hình điện thoại: không cuộn ngang trang
  await page.setViewportSize({ width: 390, height: 844 });
  await page.click("[data-view=ve]");
  const tran = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  assert.ok(tran <= 1, `cuộn ngang ${tran}px`);
  if (anh) await page.screenshot({ path: join(anh, "app-dien-thoai.png") });

  assert.deepEqual(loiTrang, [], "không có lỗi JavaScript");
  console.log(`✔ Web app: 7 tờ (có sơ đồ tổng), in nhãn 6 tủ, ZIP ${ten.length} file, bảng tính ${wb.SheetNames.length} sheet, không lỗi JS`);
} finally {
  await browser.close();
  server.close();
}
