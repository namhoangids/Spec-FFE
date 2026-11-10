// Nhãn tủ (danh mục mạch dán cánh tủ) và nhãn cáp — từ kết quả tinhDuAn().
// Xuất Excel (cho máy in nhãn) và trang HTML in thẳng từ trình duyệt.

import { chuCap } from "./sang-ban-ve.mjs";

const hoa = (s) => String(s ?? "").toLocaleUpperCase("vi");
const so = (x, d = 0) => (x == null || Number.isNaN(x) ? "" : Number(x).toFixed(d).replace(".", ","));
const thietBi = (t) => (t ? `${t.loai} ${t.soCuc} ${t.in}A${t.idn ? ` ${t.idn}mA` : ""}` : "");
const capMach = (m) => (m.ghiDe?.cap && m.cap?.ghiDe ? m.ghiDe.cap : chuCap(m.cap, { soPha: m.soPha, dongCo: m.kieu?.dongCo }));

/** Danh mục mạch dán cánh tủ: mỗi tủ một bảng. */
export function danhMucMach(kq) {
  const loCap = new Map();
  for (const t of kq.tu) for (const m of t.mach) if (m.laCapTuCon) loCap.set(m.tuCon, { tu: t, m });
  return kq.tu.map((t) => {
    const lc = loCap.get(t.ma);
    const nhomCua = new Map();
    for (const g of t.nhomRcd || []) for (const ma of g.mach) nhomCua.set(ma, g.ma);
    const dong = t.mach.map((m) => ({
      lo: m.ma,
      phuTai: m.kieu?.duPhong ? "DỰ PHÒNG" : hoa(m.phuTai),
      thietBi: thietBi(m.thietBi) + (nhomCua.has(m.ma) ? ` (RCD nhóm ${nhomCua.get(m.ma)})` : ""),
      pha: m.soPha === 3 ? "ABC" : m.pha || "",
      cap: m.cap ? capMach(m) : "",
    }));
    for (const g of t.nhomRcd || []) {
      dong.push({ lo: g.ma, phuTai: `RCD NHÓM CHO ${g.mach.join(", ")}`, thietBi: thietBi(g.thietBi), pha: "", cap: "" });
    }
    return {
      ma: t.ma,
      ten: hoa(t.ten),
      capTu: lc ? `${hoa(lc.tu.ten)} / ${lc.m.ma}` : "NGUỒN",
      cbTong: thietBi(t.cbTong),
      soPha: t.soPha === 3 ? "3P+N+PE" : "1P+N+PE",
      dong,
    };
  });
}

/** Nhãn cáp: mỗi sợi cáp một mã, in 2 bản cho 2 đầu cáp. */
export function nhanCap(kq) {
  const theoMa = new Map(kq.tu.map((t) => [t.ma, t]));
  const ds = [];
  for (const t of kq.tu) {
    if (!t.cha && t.capNguon) {
      ds.push({
        ma: `NGUON-${t.ma}`, cap: chuCap(t.capNguon, { soPha: t.soPha }), tu: "NGUỒN", den: `TỦ ${hoa(t.ten)}`,
        L: t.capNguon.chuaCoL ? "" : so(t.lCap), soBan: 2,
      });
    }
    for (const m of t.mach) {
      if (!m.cap?.s && !m.cap?.ghiDe) continue;
      const con = m.laCapTuCon ? theoMa.get(m.tuCon) : null;
      ds.push({
        ma: `${t.ma}-${m.ma}`,
        cap: m.laCapTuCon ? chuCap(m.cap, { soPha: m.soPha }) : capMach(m),
        tu: `TỦ ${hoa(t.ten)} / ${m.ma}`,
        den: con ? `TỦ ${hoa(con.ten)}` : hoa(m.phuTai),
        L: m.lThieu ? "" : so(m.L),
        soBan: 2,
      });
    }
  }
  return ds;
}

/** Workbook nhãn: sheet "Danh muc mach" và "Nhan cap". */
export function xuatNhanExcel(XLSX, kq, info = {}) {
  const wb = XLSX.utils.book_new();
  const dm = [[`DANH MỤC MẠCH DÁN CÁNH TỦ — ${info.project ?? ""}`], []];
  for (const t of danhMucMach(kq)) {
    dm.push([`TỦ ĐIỆN ${t.ten}`, `Cấp từ: ${t.capTu}`, `CB tổng: ${t.cbTong}`, t.soPha]);
    dm.push(["Lộ", "Phụ tải", "Thiết bị", "Pha", "Cáp"]);
    for (const d of t.dong) dm.push([d.lo, d.phuTai, d.thietBi, d.pha, d.cap]);
    dm.push([]);
  }
  const ws1 = XLSX.utils.aoa_to_sheet(dm);
  ws1["!cols"] = [{ wch: 12 }, { wch: 44 }, { wch: 30 }, { wch: 6 }, { wch: 36 }];
  XLSX.utils.book_append_sheet(wb, ws1, "Danh muc mach");
  const nc = [["Mã nhãn", "Cáp", "Từ", "Đến", "L (m)", "Số bản in"]];
  for (const n of nhanCap(kq)) nc.push([n.ma, n.cap, n.tu, n.den, n.L, n.soBan]);
  const ws2 = XLSX.utils.aoa_to_sheet(nc);
  ws2["!cols"] = [{ wch: 14 }, { wch: 36 }, { wch: 20 }, { wch: 44 }, { wch: 7 }, { wch: 9 }];
  XLSX.utils.book_append_sheet(wb, ws2, "Nhan cap");
  return wb;
}

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

/** Trang HTML in nhãn: mỗi tủ một trang A4 danh mục mạch, sau đó là lưới nhãn cáp (mỗi nhãn 2 bản). */
export function nhanHtml(kq, info = {}) {
  const tuHtml = danhMucMach(kq).map((t) => `
<section class="trang">
  <header><h1>TỦ ĐIỆN ${esc(t.ten)}</h1>
    <p>Cấp từ: <b>${esc(t.capTu)}</b> · CB tổng: <b>${esc(t.cbTong)}</b> · ${esc(t.soPha)}</p></header>
  <table><thead><tr><th>Lộ</th><th>Phụ tải</th><th>Thiết bị</th><th>Pha</th><th>Cáp</th></tr></thead>
  <tbody>${t.dong.map((d) => `<tr><td class="lo">${esc(d.lo)}</td><td>${esc(d.phuTai)}</td><td>${esc(d.thietBi)}</td><td>${esc(d.pha)}</td><td>${esc(d.cap)}</td></tr>`).join("")}</tbody></table>
  <footer>${esc(info.project ?? "")}</footer>
</section>`).join("");
  const nhan = nhanCap(kq).flatMap((n) => Array(n.soBan).fill(n)).map((n) => `
  <div class="nhan"><b>${esc(n.ma)}</b><span>${esc(n.cap)}</span><small>${esc(n.tu)} → ${esc(n.den)}${n.L ? ` · ${esc(n.L)} m` : ""}</small></div>`).join("");
  return `<!doctype html>
<html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Nhãn tủ điện — ${esc(info.project ?? "")}</title>
<style>
  @page { size: A4; margin: 12mm; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: Arial, Helvetica, sans-serif; color: #1d1f20; background: #ececed; }
  .in { position: sticky; top: 0; padding: 10px 16px; background: #33506c; color: #fff; display: flex; gap: 12px; align-items: center; }
  .in button { font: inherit; padding: 6px 14px; border: 0; cursor: pointer; }
  .trang, .luoi { background: #fff; max-width: 186mm; margin: 16px auto; padding: 10mm; }
  .trang { page-break-after: always; break-after: page; }
  h1 { font-size: 20pt; margin: 0 0 4px; } h2 { font-size: 14pt; margin: 0 0 8px; }
  header p { margin: 0 0 10px; font-size: 10pt; }
  table { width: 100%; border-collapse: collapse; font-size: 9.5pt; }
  th, td { border: 0.3mm solid #444; padding: 1.6mm 2mm; text-align: left; vertical-align: top; }
  th { background: #eee; } td.lo { font-weight: bold; white-space: nowrap; }
  footer { margin-top: 6px; font-size: 8pt; color: #777; }
  .luoi { display: grid; grid-template-columns: repeat(3, 1fr); gap: 3mm; }
  .luoi h2 { grid-column: 1 / -1; }
  .nhan { border: 0.3mm dashed #444; padding: 2mm; min-height: 20mm; display: flex; flex-direction: column; gap: 1mm; break-inside: avoid; }
  .nhan b { font-size: 13pt; } .nhan span { font-size: 8.5pt; } .nhan small { font-size: 7.5pt; color: #444; }
  @media (max-width: 720px) { .trang, .luoi { margin: 8px; padding: 12px; } .luoi { grid-template-columns: repeat(2, 1fr); } table { font-size: 8.5pt; } }
  @media print { body { background: #fff; } .in { display: none; } .trang, .luoi { margin: 0; padding: 0; max-width: none; } }
</style></head>
<body>
<div class="in"><b>Nhãn tủ điện — ${esc(info.project ?? "")}</b><button onclick="print()">In</button></div>
${tuHtml}
<section class="luoi"><h2>NHÃN CÁP (mỗi nhãn 2 bản, dán hai đầu cáp)</h2>${nhan}
</section>
</body></html>
`;
}
