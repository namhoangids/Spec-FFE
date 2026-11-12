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
  [/docx@9\.15\.0\/\+esm$/, join(dien, "node_modules/docx/dist/index.mjs")],
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

  // ?kho=thu: kho dự án chung trong bộ nhớ (môi trường test không vào được Firebase)
  page.on("dialog", (d) => d.accept());                    // confirm() khi xóa mạch / khôi phục
  await page.goto(`http://localhost:${port}/dien/app/?kho=thu`);
  await page.waitForSelector("#tk button");
  await page.click("#vidu");
  await page.waitForSelector("#tree .node");
  const nodes = await page.locator("#tree .node").allInnerTexts();
  assert.equal(nodes.length, 13, "đủ 13 tờ: sơ đồ tổng + 6 tủ + 6 tờ điện nhẹ");
  assert.match(nodes.slice(7).join(" "), /E\.700[\s\S]*E\.701[\s\S]*E\.702[\s\S]*E\.703[\s\S]*Âm thanh[\s\S]*E\.704[\s\S]*E\.705[\s\S]*KNX/, "tờ điện nhẹ E.700–E.705");
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

  // Xem thuyết minh: tab mới, đủ 6 mục, mỗi tủ một mục 5.x
  const [tm] = await Promise.all([page.waitForEvent("popup"), page.click("#tmxem")]);
  await tm.waitForLoadState();
  const h2 = await tm.locator("h2").allInnerTexts();
  assert.deepEqual(h2.map((x) => x.match(/^\d+/)?.[0]), ["01", "02", "03", "04", "05", "06", "07"], "thuyết minh đủ mục 01–07 (06 điện nhẹ)");
  assert.equal(await tm.locator("h3", { hasText: /^5\.\d+\. Tủ/ }).count(), 6, "mỗi tủ một mục");
  await tm.close();
  const [dlTm] = await Promise.all([page.waitForEvent("download"), page.click("#tmword")]);
  assert.match(dlTm.suggestedFilename(), /thuyet-minh\.docx$/);

  await page.click("#tree .node >> nth=3");
  assert.match(await page.locator("#phead").innerText(), /SƠ ĐỒ NGUYÊN LÝ ĐIỆN T3/);
  await page.click("[data-view=bang]");
  assert.equal(await page.locator("#pane tbody tr").count(), 10, "T3 có 10 lộ ra");
  if (anh) await page.screenshot({ path: join(anh, "app-bang-tinh.png") });
  await page.click("[data-view=tatca]");
  assert.ok(await page.locator("#pane .msg").count() > 0);

  // Tờ tủ rack (điện nhẹ): bản vẽ, bảng thiết bị, thông số nguồn cấp
  await page.click("#tree .node >> nth=9");
  assert.match(await page.locator("#phead").innerText(), /SƠ ĐỒ TỦ RACK R1/);
  assert.match(await page.locator("#facts").innerText(), /27U[\s\S]*T1 \/ DN1/);
  await page.click("[data-view=bang]");
  assert.match(await page.locator("#pane").innerText(), /UPS 1000 VA[\s\S]*Tổng/);
  if (anh) { await page.click("[data-view=ve]"); await page.screenshot({ path: join(anh, "app-tu-rack.png") }); }
  await page.click("[data-view=ve]");

  // Nhập liệu điện nhẹ trên web (tờ E.700): sửa số ổ data, thêm phòng, xóa rack còn phòng → báo lỗi
  await page.click("#tree .node >> nth=7");
  await page.click("[data-view=nl]");
  const oData = page.locator('#pane [data-dong="dn"][data-k="data"]').first();
  await oData.fill("5");
  await oData.press("Tab");
  await page.waitForFunction(() => /15 ổ data/.test(document.querySelector("#facts")?.innerText || ""));
  const soPhong = await page.locator('#pane [data-dong="dn"][data-k="phong"]').count();
  await page.locator('#pane [data-lenh="themPhongDn"]').first().click();
  assert.equal(await page.locator('#pane [data-dong="dn"][data-k="phong"]').count(), soPhong + 1, "thêm phòng điện nhẹ");
  await page.locator('#pane [data-lenh="xoaRack"]').first().click();
  assert.match(await page.locator("#err").innerText(), /còn phục vụ/);
  await page.locator('#pane [data-lenh="xoaPhongDn"]').last().click();
  assert.equal(await page.locator('#pane [data-dong="dn"][data-k="phong"]').count(), soPhong, "xóa phòng điện nhẹ");
  await oData.fill("2");
  await oData.press("Tab");
  await page.waitForFunction(() => /12 ổ data/.test(document.querySelector("#facts")?.innerText || ""));
  if (anh) await page.screenshot({ path: join(anh, "app-nhap-lieu-dien-nhe.png"), fullPage: true });
  await page.click("[data-view=ve]");

  // Nạp bóc khối (file mẫu chỉ có tên block): tính lại cả bộ, có ghi chú bóc khối, nút báo cáo hiện ra
  await page.setInputFiles("#bkfile", join(dien, "mau/vi-du-boc-khoi/boc-khoi-ten-block.csv"));
  await page.waitForSelector("#bkxlsx:not(.hide)");
  await page.click("[data-view=tatca]");
  assert.match(await page.locator("#pane").innerText(), /Bóc khối: block "HOP_NOI"/, "báo block lạ");
  await page.click("#tree .node >> nth=3");

  const [dl] = await Promise.all([page.waitForEvent("download"), page.click("#zip")]);
  const zip = await JSZip.loadAsync(readFileSync(await dl.path()));
  const ten = Object.keys(zip.files).sort();
  assert.equal(ten.filter((f) => f.endsWith(".dxf")).length, 26);
  assert.equal(ten.filter((f) => f.endsWith(".svg")).length, 13);
  const dnx = XLSX.read(await zip.file("dien-nhe.xlsx").async("uint8array"));
  assert.deepEqual(dnx.SheetNames, ["Tong hop", "Thiet bi rack", "Dau noi", "Am thanh", "ACS chuong", "KNX", "Canh bao"]);
  assert.equal(XLSX.utils.sheet_to_json(dnx.Sheets["Dau noi"], { header: 1 }).length - 1, 40, "40 link Cat6");
  for (const f of ["E.600-TONG-R12.dxf", "bang-tinh.xlsx", "nhan.xlsx", "nhan-tu.html", "thuyet-minh.docx", "thuyet-minh.html", "boq.xlsx", "du-an.json", "canh-bao.txt"]) assert.ok(ten.includes(f), f);
  assert.ok(ten.includes("boc-khoi.xlsx"), "ZIP có báo cáo bóc khối");
  const boq = XLSX.read(await zip.file("boq.xlsx").async("uint8array"));
  assert.ok(XLSX.utils.sheet_to_json(boq.Sheets.BOQ, { header: 1 }).some((r) => /ĐIỆN NHẸ/.test(r[1] ?? "")), "BOQ có nhóm F điện nhẹ");
  assert.ok(XLSX.utils.sheet_to_json(boq.Sheets.BOQ, { header: 1 }).some((r) => /THIẾT BỊ ĐIỆN/.test(r[1] ?? "")), "BOQ có nhóm thiết bị điện theo bóc khối");
  assert.deepEqual(boq.SheetNames, ["BOQ", "Bang gia", "Chi tiet"]);
  assert.match(String(boq.Sheets.BOQ.H8?.f ?? ""), /^ROUND\(D8\*F8/, "thành tiền là công thức");
  const tmXml = await (await JSZip.loadAsync(await zip.file("thuyet-minh.docx").async("uint8array"))).file("word/document.xml").async("string");
  assert.match(tmXml, /THUYẾT MINH TÍNH TOÁN/);
  assert.match(tmXml, /w:orient="landscape"/, "có trang ngang cho bảng từng mạch");
  const r12 = await zip.file("E.603-T3-R12.dxf").async("string");
  assert.match(r12, /AC1009/);
  const wb = XLSX.read(await zip.file("bang-tinh.xlsx").async("uint8array"));
  assert.deepEqual(wb.SheetNames, ["Tong hop", "T1", "T2", "T3", "T4", "T5", "T6", "Cap va ong", "Ngan mach", "Canh bao", "Quy tac"]);

  const [dl2] = await Promise.all([page.waitForEvent("download"), page.click("#dl-dxf")]);
  assert.equal(dl2.suggestedFilename(), "E.603-T3.dxf");

  // Bóc khối điện nhẹ: block ổ data / TV / AP / camera / loa / KNX trên mặt bằng → bảng điện nhẹ theo phòng
  await page.setInputFiles("#bkfile", join(dien, "mau/vi-du-boc-khoi/boc-khoi-dien-nhe.csv"));
  await page.click("[data-view=tatca]");
  await page.waitForFunction(() => /thêm phòng SẢNH CĂN HỘ/.test(document.querySelector("#pane")?.innerText || ""));
  assert.match(await page.locator("#pane").innerText(), /Bóc khối: điện nhẹ: thêm phòng P\.KHÁCH \(tầng CH\)/);
  const [dlBk] = await Promise.all([page.waitForEvent("download"), page.click("#bkxlsx")]);
  assert.ok(XLSX.read(readFileSync(await dlBk.path())).SheetNames.includes("Dien nhe"), "báo cáo bóc khối có sheet Dien nhe");
  await page.click("[data-view=ve]");

  // --- Dự án chung trên server (kho bộ nhớ) -----------------------------------------------------
  const nut = (re) => page.locator("#hop button", { hasText: re });
  await page.click("#tk button");                                         // Đăng nhập
  await page.fill("#hop input[name=email]", "ky.su@vi.du");
  await page.fill("#hop input[name=pass]", "sai");
  await nut(/^Đăng nhập$/).click();
  assert.match(await page.locator("#hopLoi").innerText(), /Sai email hoặc mật khẩu/);
  await page.fill("#hop input[name=pass]", "thu");
  await nut(/^Đăng nhập$/).click();
  await page.waitForSelector("#tk >> text=ky.su@vi.du");
  assert.match(await page.locator("#duan").innerText(), /chưa có trên server/);
  await page.click("#luu");                                               // Lưu lên server (tạo mới)
  await page.fill("#hop input[name=ten]", "HDMON thử");
  await nut(/^Lưu$/).click();
  await page.waitForSelector("#duan >> text=bản 1");

  // Nhập liệu: sửa công suất mạch đầu của T3 → tính lại, đánh dấu chưa lưu
  await page.click("#tree .node >> nth=3");
  await page.click("[data-view=nl]");
  const oP = page.locator('#pane [data-dong="mach"][data-k="congSuat"]').first();
  await oP.fill("1234");
  await oP.press("Tab");
  await page.waitForSelector("#duan .chuaLuu");
  const soMach = await page.locator("#pane table.nl >> nth=1").locator("tbody tr").count();
  await page.click('[data-lenh="themMach"]');
  assert.equal(await page.locator("#pane table.nl >> nth=1").locator("tbody tr").count(), soMach + 1, "thêm mạch");
  await page.locator('[data-lenh="xoaMach"]').last().click();
  assert.equal(await page.locator("#pane table.nl >> nth=1").locator("tbody tr").count(), soMach, "xóa mạch");
  await page.click("[data-view=bang]");
  assert.match(await page.locator("#pane tbody tr").first().innerText(), /1\.234/, "bảng tính theo công suất mới");
  await page.click("#luu");
  await page.fill("#hop input[name=gc]", "sửa công suất");
  await nut(/^Lưu$/).click();
  await page.waitForSelector("#duan >> text=bản 2");

  // Xung đột: người khác lưu trước → app không ghi đè, mở bản mới
  await page.evaluate(() => window.__khoThu.luuThay("p1", (d) => { d.info.client = "NGƯỜI KHÁC SỬA"; return d; }));
  await page.click("[data-view=nl]");
  await oP.fill("1500");
  await oP.press("Tab");
  await page.click("#luu");
  await nut(/^Lưu$/).click();
  await page.waitForSelector("#hop >> text=Có người vừa lưu dự án này");
  await nut(/Mở bản mới/).click();
  await page.waitForSelector("#duan >> text=bản 3");
  assert.equal(await oP.inputValue(), "1234", "mở lại bản trên server");

  // Lịch sử: khôi phục bản 1 → công suất cũ
  await page.click("#lichSu");
  await page.locator("#hop .ls .dong", { hasText: "Bản 1" }).locator("button").click();
  await page.waitForSelector("#duan >> text=bản 4");
  assert.notEqual(await page.locator('#pane [data-dong="mach"][data-k="congSuat"]').first().inputValue(), "1234", "về bản 1");
  if (anh) {
    await page.screenshot({ path: join(anh, "app-nhap-lieu.png"), fullPage: true });
    await page.emulateMedia({ colorScheme: "dark" });
    await page.screenshot({ path: join(anh, "app-nhap-lieu-toi.png") });
    await page.emulateMedia({ colorScheme: "light" });
  }
  await page.click("#dong");                                             // Đóng → danh sách
  assert.match(await page.locator("#dsServer").innerText(), /HDMON thử[\s\S]*bản 4/);
  if (anh) await page.screenshot({ path: join(anh, "app-ds-du-an.png") });

  // Màn hình điện thoại: không cuộn ngang trang
  await page.click("#dsServer [data-mo]");
  await page.click("[data-view=nl]");
  await page.setViewportSize({ width: 390, height: 844 });
  const tran = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  assert.ok(tran <= 1, `cuộn ngang ${tran}px`);
  if (anh) await page.screenshot({ path: join(anh, "app-dien-thoai.png") });

  // Nạp du-an.json (đầu ra của agent / lệnh tạo bộ) → dự án mới, chưa có trên server
  await page.click("#dong");
  await page.setInputFiles("#file", join(goc, "dien/du-an/can-ho-3pn-3-pha/du-an.json"));
  await page.waitForSelector("#duan >> text=chưa có trên server");
  assert.match(await page.locator("#tree").innerText(), /TỦ CĂN HỘ/, "đọc được tủ từ JSON");

  assert.deepEqual(loiTrang, [], "không có lỗi JavaScript");
  console.log(`✔ Web app: 13 tờ (sơ đồ tổng, 6 tủ, 6 tờ điện nhẹ), nhập liệu điện nhẹ, in nhãn 6 tủ, thuyết minh 7 mục (Word + trang in), BOQ ${boq.SheetNames.length} sheet, bóc khối (điện + điện nhẹ), dự án chung (lưu / sửa / xung đột / lịch sử / nạp JSON), ZIP ${ten.length} file, bảng tính ${wb.SheetNames.length} sheet, không lỗi JS`);
} finally {
  await browser.close();
  server.close();
}
