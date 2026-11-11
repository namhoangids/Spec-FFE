// Web app: Excel → lõi tính toán → bộ bản vẽ (sơ đồ tổng + các tờ tủ) → xem SVG, tải DXF/SVG/ZIP,
// bảng tính, nhãn tủ / nhãn cáp, thuyết minh tính toán (Word + trang in), JSON.
// Toàn bộ chạy trong trình duyệt; SheetJS và JSZip nạp từ cdnjs, thư viện DXF và docx qua import map.

import { MUC, taoBoBanVe, vanBanCanhBao } from "../bo-ban-ve.mjs";
import { docExcel } from "../engine/doc-excel.mjs";
import { chuCap } from "../engine/sang-ban-ve.mjs";
import { xuatExcel } from "../engine/xuat-excel.mjs";

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const so = (x, d = 1) => (x == null || Number.isNaN(x) ? "—" : Number(x).toFixed(d).replace(".", ","));
const tb = (t) => (t ? `${t.loai} ${t.soCuc} ${t.in}A${t.idn ? ` ${t.idn}mA` : t.icu != null ? ` ${t.icu}kA` : ""}` : "—");

const S = { ten: "", duAn: null, kq: null, bo: null, to: [], chon: 0, view: "ve" };

// --- Nạp file -------------------------------------------------------------------
async function napFile(buf, ten) {
  try {
    loi("");
    if (!window.XLSX) throw new Error("Chưa tải được thư viện đọc Excel (SheetJS) — kiểm tra kết nối mạng.");
    const duAn = docExcel(window.XLSX, new Uint8Array(buf));
    if (!duAn.panels.length) throw new Error(`Không đọc được tủ nào từ "${ten}". ${duAn.loiDoc.join("; ")}`);
    const bo = taoBoBanVe(duAn);
    const { kq, to } = bo;
    for (const s of duAn.loiDoc) kq.canhBao.unshift({ muc: "canhbao", tu: "", mach: "", noiDung: `Đọc file: ${s}` });
    Object.assign(S, { ten: ten.replace(/\.[^.]+$/, ""), duAn, kq, bo, to, chon: 0 });
    $("empty").classList.add("hide");
    $("result").classList.remove("hide");
    for (const id of ["zip", "xlsx", "json", "nhan", "nhanxlsx", "tmword", "tmxem"]) $(id).disabled = false;
    veTatCa();
  } catch (e) {
    console.error(e);
    loi(e.message || String(e));
  }
}
function loi(s) {
  $("err").textContent = s;
  $("err").classList.toggle("hide", !s);
}

$("file").addEventListener("change", async (e) => {
  const f = e.target.files[0];
  if (f) await napFile(await f.arrayBuffer(), f.name);
  e.target.value = "";
});
for (const id of ["vidu", "vidu2"]) {
  $(id).addEventListener("click", async () => {
    try {
      const r = await fetch("../mau/vi-du-HDMON.xlsx");
      if (!r.ok) throw new Error(`Không tải được file ví dụ (${r.status})`);
      await napFile(await r.arrayBuffer(), "vi-du-HDMON.xlsx");
    } catch (e) { loi(e.message); }
  });
}
const drop = $("drop");
drop.addEventListener("dragover", (e) => { e.preventDefault(); drop.classList.add("over"); });
drop.addEventListener("dragleave", () => drop.classList.remove("over"));
drop.addEventListener("drop", async (e) => {
  e.preventDefault(); drop.classList.remove("over");
  const f = e.dataTransfer.files[0];
  if (f) await napFile(await f.arrayBuffer(), f.name);
});

// --- Vẽ giao diện ----------------------------------------------------------------
const dem = (ma, muc) => S.kq.canhBao.filter((c) => (ma == null || c.tu === ma) && c.muc === muc).length;

function veTatCa() {
  const { kq, to } = S;
  const rule = kq.quyTac;
  const banner = $("banner");
  banner.textContent = rule.trangThai.startsWith("ĐÃ DUYỆT") ? "" :
    `Bộ quy tắc ${rule.trangThai} (phiên bản ${rule.phienBan}) — kết quả để tham khảo, kỹ sư điện cần duyệt sheet Quy tac trước khi phát hành.`;
  banner.classList.toggle("hide", !banner.textContent);
  const info = S.duAn.info;
  $("stats").innerHTML = [
    ["Dự án", esc(info.project || S.ten)],
    ["Số tờ", `${to.length} <span class="crumb">${esc(to[0]?.du.sheet.drawingNo)} – ${esc(to.at(-1)?.du.sheet.drawingNo)}</span>`],
    ["Lỗi", `<span class="v loi">${dem(null, "loi")}</span>`],
    ["Cảnh báo", `<span class="v canhbao">${dem(null, "canhbao")}</span>`],
    ["Ghi chú", dem(null, "ghichu")],
  ].map(([k, v]) => `<div class="stat"><div class="kick">${k}</div><div class="v tnum">${v}</div></div>`).join("");
  veCay();
  veTu();
}

function capDo(t) {
  let n = 0, x = t;
  while (x.cha) { n++; x = S.kq.tu.find((y) => y.ma === x.cha); if (!x) break; }
  return n;
}

const tuCua = (x) => S.kq.tu.find((t) => t.ma === x.ma);

function veCay() {
  $("tree").innerHTML = S.to.map((x, i) => {
    const tong = x.loai === "tong";
    const t = tong ? null : tuCua(x);
    const ten = tong ? "Sơ đồ tổng" : `${t.ten}${x.tong > 1 ? ` (${x.thu + 1}/${x.tong})` : ""}`;
    // Lỗi/cảnh báo ghi ở tờ đầu của tủ; tờ tổng mang các mục chung của dự án
    const ma = tong ? "" : x.thu === 0 ? t.ma : null;
    const l = ma == null ? 0 : dem(ma, "loi"), c = ma == null ? 0 : dem(ma, "canhbao");
    const lui = tong ? 0 : capDo(t) + (x.thu > 0 ? 1 : 0);
    return `<button class="node" data-i="${i}" aria-current="${i === S.chon}" style="padding-left:${16 + lui * 14}px">
      <span class="no">${esc(x.du.sheet.drawingNo)}</span><span class="nm">${esc(ten)}</span>
      ${l ? `<span class="dot loi" title="${l} lỗi">${l}</span>` : ""}${c ? `<span class="dot canhbao" title="${c} cảnh báo">${c}</span>` : ""}
    </button>`;
  }).join("");
}
$("tree").addEventListener("click", (e) => {
  const b = e.target.closest(".node");
  if (!b) return;
  S.chon = +b.dataset.i;
  veCay();
  veTu();
});

for (const b of document.querySelectorAll("[data-view]")) {
  b.addEventListener("click", () => {
    S.view = b.dataset.view;
    for (const x of document.querySelectorAll("[data-view]")) x.setAttribute("aria-pressed", String(x === b));
    veTu();
  });
}

function veTu() {
  const x = S.to[S.chon];
  if (x.loai === "tong") return veTong(x);
  const t = tuCua(x);
  const cha = t.cha ? S.kq.tu.find((y) => y.ma === t.cha) : null;
  $("phead").innerHTML = `<div><div class="kick">${esc(x.du.sheet.drawingNo)}${x.tong > 1 ? ` · tờ ${x.thu + 1}/${x.tong}` : ""} · ${t.soPha === 3 ? "3 pha" : "1 pha"}${cha ? ` · cấp từ ${esc(cha.ten)}` : " · tủ gốc"}</div>
    <h2>${esc(x.du.sheet.title)}</h2></div><span class="sp"></span>
    <span class="crumb">${esc(x.du.panel.name)}</span>`;
  const cap = chuCap(t.capNguon, { soPha: t.soPha });
  const facts = [
    ["CB tổng", tb(t.cbTong)],
    ["Cáp cấp", cap ? `${cap} · ${t.ongNguon ?? ""}${t.capNguon?.chuaCoL ? " (chưa có chiều dài)" : ""}` : "—"],
    ["Pđ · Kđt · Ptt", `${so(t.pd, 2)} kW · ${so(t.ks, 2)} · ${so(t.ptt, 2)} kW`],
    [t.soPha === 3 ? "I pha A / B / C" : "Dòng tính toán", t.soPha === 3 ? `${so(t.iPha.A)} / ${so(t.iPha.B)} / ${so(t.iPha.C)} A · lệch ${so(t.lechPha)}%` : `${so(t.iMax)} A`],
    ["ΔU tới thanh cái", `${so(t.duBus, 2)}%`],
    ["Ik tại tủ", `${so(t.ikTinh)} kA (${t.ikNguon})`],
    ["Vỏ tủ", `${t.module.voTu ?? "—"} module · thiết bị ${t.module.tong}, cần ${so(t.module.can)}`],
  ];
  $("facts").innerHTML = facts.map(([k, v]) => `<div class="fact"><div class="kick">${k}</div><div class="v tnum">${esc(v)}</div></div>`).join("");
  const pane = $("pane");
  if (S.view === "ve") pane.innerHTML = `<div class="sheet">${x.svg.replace(/^<\?xml[^>]*>\s*/, "")}</div>`;
  else if (S.view === "bang") pane.innerHTML = bangMach(t);
  else if (S.view === "kt") pane.innerHTML = dsCanhBao(S.kq.canhBao.filter((c) => c.tu === t.ma), false);
  else pane.innerHTML = dsCanhBao(S.kq.canhBao, true);
}

// Tờ sơ đồ cấp điện tổng: thông số cả dự án, bảng tổng hợp phụ tải, các mục chung
function veTong(x) {
  const goc = S.kq.tu.filter((t) => !t.cha);
  const g = goc[0];
  $("phead").innerHTML = `<div><div class="kick">${esc(x.du.sheet.drawingNo)} · cả dự án</div>
    <h2>${esc(x.du.sheet.title)}</h2></div><span class="sp"></span>
    <span class="crumb">${S.kq.tu.length} tủ · ${S.to.length - 1} tờ tủ</span>`;
  const facts = [
    ["Tủ gốc", goc.map((t) => t.ten).join(", ")],
    ["CB tổng tủ gốc", tb(g.cbTong)],
    ["Cáp nguồn", `${chuCap(g.capNguon, { soPha: g.soPha }) || "—"}${g.capNguon?.chuaCoL ? " (chưa có chiều dài)" : ""}`],
    ["Ptt tủ gốc", `${so(g.ptt, 2)} kW · Itt ${so(g.itt)} A`],
    ["Số lộ ra", String(S.kq.tu.reduce((a, t) => a + t.mach.length, 0))],
  ];
  $("facts").innerHTML = facts.map(([k, v]) => `<div class="fact"><div class="kick">${k}</div><div class="v tnum">${esc(v)}</div></div>`).join("");
  const pane = $("pane");
  if (S.view === "ve") pane.innerHTML = `<div class="sheet">${x.svg.replace(/^<\?xml[^>]*>\s*/, "")}</div>`;
  else if (S.view === "bang") pane.innerHTML = bangTong(x.du.bang);
  else if (S.view === "kt") pane.innerHTML = dsCanhBao(S.kq.canhBao.filter((c) => !c.tu), false);
  else pane.innerHTML = dsCanhBao(S.kq.canhBao, true);
}

function bangTong(bang) {
  const cot = [["Tủ", "ten"], ["Cấp từ", "capTu"], ["Số pha", "soPha"], ["Pđ (kW)", "pd", 1], ["Kđt", "ks", 1], ["Ptt (kW)", "ptt", 1],
    ["Itt (A)", "itt", 1], ["CB tổng", "cbTong"], ["Cáp cấp", "capCap"], ["ΔU (%)", "du", 1], ["Bản vẽ", "soBanVe"]];
  return `<div class="tblwrap"><table><thead><tr>${cot.map(([h]) => `<th>${h}</th>`).join("")}</tr></thead>
    <tbody>${bang.map((r) => `<tr>${cot.map(([, k, n]) => `<td class="${n ? "n" : ""}">${esc(r[k])}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
}

function bangMach(t) {
  const rows = t.mach.map((m) => {
    const kt = m.kiemTra || [];
    const cls = kt.some((k) => k.muc === "loi") ? "loi" : kt.some((k) => k.muc === "canhbao") ? "canhbao" : "";
    return `<tr class="${cls}">
      <td><b>${esc(m.ma)}</b></td><td>${esc(m.phuTai)}</td><td>${m.soPha === 3 ? "ABC" : esc(m.pha)}</td>
      <td class="n">${m.P ? Math.round(m.P).toLocaleString("vi") : "—"}</td><td class="n">${so(m.Ib, 1)}</td>
      <td>${esc(tb(m.thietBi))}${m.nhomRcd ? ` <span class="tag ghichu">nhóm ${esc(m.nhomRcd)}</span>` : ""}</td>
      <td>${esc(chuCap(m.cap, { soPha: m.soPha, dongCo: m.kieu?.dongCo }) || "—")}</td>
      <td class="n">${m.cap?.izp != null ? so(m.cap.izp) : "—"}</td><td class="n">${m.kieu?.duPhong ? "—" : so(m.L, 0)}</td>
      <td class="n">${m.cap?.duCongDon != null ? so(m.cap.duCongDon, 2) + "%" : "—"}</td><td class="nw">${esc(m.ong || "—")}</td>
      <td>${kt.map((k) => `<div><span class="tag ${k.muc}">${MUC[k.muc]}</span> ${esc(k.noiDung)}</div>`).join("")}</td>
    </tr>`;
  }).join("");
  const nhom = (t.nhomRcd || []).map((g) => `<tr><td><b>${esc(g.ma)}</b></td><td colspan="4">RCBO chung cho ${esc(g.mach.join(", "))}</td><td colspan="7">${esc(tb(g.thietBi))}</td></tr>`).join("");
  return `<div class="tblwrap"><table>
    <thead><tr><th>Mã lộ</th><th>Phụ tải</th><th>Pha</th><th>P (W)</th><th>Ib (A)</th><th>Thiết bị</th><th>Cáp</th><th>Iz′ (A)</th><th>L (m)</th><th>ΔU cộng dồn</th><th>Ống</th><th>Kiểm tra</th></tr></thead>
    <tbody>${rows}${nhom}</tbody></table></div>`;
}

function dsCanhBao(ds, coTu) {
  if (!ds.length) return `<p class="crumb">Không có lỗi, cảnh báo hay ghi chú.</p>`;
  return ["loi", "canhbao", "ghichu"].flatMap((m) => ds.filter((c) => c.muc === m)).map((c) =>
    `<div class="msg"><span class="w"><span class="tag ${c.muc}">${MUC[c.muc]}</span></span>
      <span class="src">${esc([coTu ? c.tu : "", c.mach].filter(Boolean).join(" · ") || "—")}</span><span>${esc(c.noiDung)}</span></div>`).join("");
}

// --- Tải xuống --------------------------------------------------------------------
function tai(ten, data, type) {
  const url = URL.createObjectURL(data instanceof Blob ? data : new Blob([data], { type }));
  const a = Object.assign(document.createElement("a"), { href: url, download: ten });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const DXF = "application/dxf", SVG = "image/svg+xml";
const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const bangTinh = () => window.XLSX.write(xuatExcel(window.XLSX, S.kq, S.duAn.info, { soTheoTu: S.bo.soTheoTu }), { type: "array", bookType: "xlsx" });
const nhanExcel = () => window.XLSX.write(S.bo.nhanExcel(window.XLSX), { type: "array", bookType: "xlsx" });

$("dl-dxf").addEventListener("click", () => { const x = S.to[S.chon]; tai(`${x.tenFile}.dxf`, x.dxf(), DXF); });
$("dl-r12").addEventListener("click", () => { const x = S.to[S.chon]; tai(`${x.tenFile}-R12.dxf`, x.r12(), DXF); });
$("dl-svg").addEventListener("click", () => { const x = S.to[S.chon]; tai(`${x.tenFile}.svg`, x.svg, SVG); });
$("xlsx").addEventListener("click", () => tai(`${S.ten}-bang-tinh.xlsx`, bangTinh(), XLSX_MIME));
$("nhanxlsx").addEventListener("click", () => tai(`${S.ten}-nhan.xlsx`, nhanExcel(), XLSX_MIME));
// Trang in nhãn mở ở tab mới (trang HTML tự chứa, có nút In)
$("nhan").addEventListener("click", () => {
  const url = URL.createObjectURL(new Blob([S.bo.nhanHtml()], { type: "text/html" }));
  if (!window.open(url, "_blank")) tai(`${S.ten}-nhan-tu.html`, S.bo.nhanHtml(), "text/html");
  setTimeout(() => URL.revokeObjectURL(url), 60000);
});
// Thuyết minh: thư viện docx nạp khi cần (import map) để lỗi mạng không làm hỏng phần còn lại của app
const thuyetMinhWord = async () => {
  let docx;
  try { docx = await import("docx"); } catch { throw new Error("Chưa tải được thư viện Word (docx) — kiểm tra kết nối mạng."); }
  return docx.Packer.toBlob(S.bo.thuyetMinhDocx(docx));
};
$("tmword").addEventListener("click", async () => {
  try { tai(`${S.ten}-thuyet-minh.docx`, await thuyetMinhWord()); } catch (e) { loi(e.message); }
});
$("tmxem").addEventListener("click", () => {
  const html = S.bo.thuyetMinhHtml();
  const url = URL.createObjectURL(new Blob([html], { type: "text/html" }));
  if (!window.open(url, "_blank")) tai(`${S.ten}-thuyet-minh.html`, html, "text/html");
  setTimeout(() => URL.revokeObjectURL(url), 60000);
});
$("json").addEventListener("click", () => tai(`${S.ten}-du-an.json`, JSON.stringify(S.duAn, null, 2), "application/json"));
$("zip").addEventListener("click", async () => {
  try {
    if (!window.JSZip) throw new Error("Chưa tải được thư viện nén ZIP (JSZip) — kiểm tra kết nối mạng.");
    const btn = $("zip"); btn.disabled = true; btn.textContent = "Đang nén…";
    const zip = new window.JSZip();
    for (const x of S.to) {
      zip.file(`${x.tenFile}.dxf`, x.dxf());
      zip.file(`${x.tenFile}-R12.dxf`, x.r12());
      zip.file(`${x.tenFile}.svg`, x.svg);
    }
    zip.file("bang-tinh.xlsx", bangTinh());
    zip.file("nhan.xlsx", nhanExcel());
    zip.file("nhan-tu.html", S.bo.nhanHtml());
    zip.file("thuyet-minh.docx", await thuyetMinhWord());
    zip.file("thuyet-minh.html", S.bo.thuyetMinhHtml());
    zip.file("du-an.json", JSON.stringify(S.duAn, null, 2));
    zip.file("canh-bao.txt", vanBanCanhBao(S.kq));
    tai(`${S.ten}-bo-ban-ve.zip`, await zip.generateAsync({ type: "blob", compression: "DEFLATE" }));
    btn.disabled = false; btn.textContent = "Tải cả bộ (ZIP)";
  } catch (e) { loi(e.message); $("zip").disabled = false; $("zip").textContent = "Tải cả bộ (ZIP)"; }
});
