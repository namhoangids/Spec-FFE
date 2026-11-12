// Web app: Excel → lõi tính toán → bộ bản vẽ (sơ đồ tổng + các tờ tủ) → xem SVG, tải DXF/SVG/ZIP,
// bảng tính, nhãn tủ / nhãn cáp, thuyết minh tính toán (Word + trang in), BOQ điện, JSON.
// Toàn bộ chạy trong trình duyệt; SheetJS và JSZip nạp từ cdnjs, thư viện DXF và docx qua import map.

import { MUC, taoBoBanVe, vanBanCanhBao } from "../bo-ban-ve.mjs";
import { apDungBocKhoi, docBocKhoi, xuatBaoCaoBocKhoi } from "../engine/boc-khoi.mjs";
import { docExcel } from "../engine/doc-excel.mjs";
import { chuCap } from "../engine/sang-ban-ve.mjs";
import { xuatExcel } from "../engine/xuat-excel.mjs";
import * as CT from "./cong-trinh.mjs";
import { FFE_URL } from "./firebase-config.mjs";
import { LoiXungDot, loiDangNhap, taoKho } from "./kho.mjs";
import * as NL from "./nhap-lieu.mjs";

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const so = (x, d = 1) => (x == null || Number.isNaN(x) ? "—" : Number(x).toFixed(d).replace(".", ","));
const tb = (t) => (t ? `${t.loai} ${t.soCuc} ${t.in}A${t.idn ? ` ${t.idn}mA` : t.icu != null ? ` ${t.icu}kA` : ""}` : "—");

// duAnGoc: dữ liệu NGUỒN đang sửa (từ Excel / server / nhập liệu trên web; bóc khối áp xong cũng ghi vào đây).
// Dự án chung trên server: kho (Firebase hoặc bộ nhớ khi ?kho=thu), duAnId + phienBan của bản đang mở, chuaLuu.
const S = {
  ten: "", duAnGoc: null, duAn: null, kq: null, bo: null, to: [], chon: 0, view: "ve", bocKhoi: null,
  kho: null, khoLoi: "", nguoiDung: null, ds: [], tim: "", duAnId: null, phienBan: null, chuaLuu: false, ngheDs: null,
  // Công trình dùng chung với app Dự toán / FF&E (chỉ đọc); ?congTrinh=<mã hoặc tên> mở thẳng dự án điện của công trình
  congTrinh: [], ngheCt: null, ctLoi: "", ctSan: false, dsSan: false,
  linkCt: new URLSearchParams(location.search).get("congTrinh") || "",
};

// --- Nạp file -------------------------------------------------------------------
async function napFile(buf, ten) {
  try {
    loi("");
    let duAn;
    if (/\.json$/i.test(ten)) {                              // du-an.json của agent / lệnh tạo bộ / nút "JSON dự án"
      try { duAn = JSON.parse(new TextDecoder().decode(buf)); } catch (e) { throw new Error(`"${ten}" không phải JSON hợp lệ: ${e.message}`); }
      if (!Array.isArray(duAn?.panels) || !Array.isArray(duAn?.circuits)) throw new Error(`"${ten}" không phải dữ liệu dự án (thiếu panels / circuits).`);
      duAn = { info: {}, quyTac: {}, ...duAn, loiDoc: [] };
    } else {
      if (!window.XLSX) throw new Error("Chưa tải được thư viện đọc Excel (SheetJS) — kiểm tra kết nối mạng.");
      duAn = docExcel(window.XLSX, new Uint8Array(buf));
    }
    if (!duAn.panels.length) throw new Error(`Không đọc được tủ nào từ "${ten}". ${duAn.loiDoc.join("; ")}`);
    if (S.duAnId && !confirm(`Thay dữ liệu dự án "${S.ten}" bằng nội dung file "${ten}"? Bấm Lưu để ghi lên server.`)) return;
    if (!S.duAnId) S.ten = ten.replace(/\.[^.]+$/, "");
    Object.assign(S, { duAnGoc: duAn, bocKhoi: null, chuaLuu: !!S.duAnId });
    tinhVaVe(duAn);
  } catch (e) {
    console.error(e);
    loi(e.message || String(e));
  }
}
/** Tính cả bộ từ dữ liệu dự án rồi vẽ lại; thêm cảnh báo đọc file và cảnh báo bóc khối (nếu có) vào danh sách kiểm tra. */
function tinhVaVe(duAn, { giuChon = false } = {}) {
  const bo = taoBoBanVe(duAn);
  const { kq, to } = bo;
  for (const s of duAn.loiDoc || []) kq.canhBao.unshift({ muc: "canhbao", tu: "", mach: "", noiDung: `Đọc file: ${s}` });
  if (S.bocKhoi) kq.canhBao.push(...S.bocKhoi.canhBao);
  // Giữ tờ đang xem khi tính lại do sửa dữ liệu (tìm lại theo mã tủ + thứ tự tờ)
  const cu = giuChon ? S.to[S.chon] : null;
  const chon = cu ? Math.max(0, to.findIndex((x) => x.loai === cu.loai && x.ma === cu.ma && x.thu === cu.thu)) : 0;
  Object.assign(S, { duAn, kq, bo, to, chon });
  $("empty").classList.add("hide");
  $("result").classList.remove("hide");
  for (const id of ["zip", "xlsx", "json", "nhan", "nhanxlsx", "tmword", "tmxem", "boq", "bk"]) $(id).disabled = false;
  $("bkxlsx").classList.toggle("hide", !S.bocKhoi);
  veTatCa();
  veDuAn();
}

// Bóc khối: bảng DATAEXTRACTION từ mặt bằng AutoCAD → công suất mạch (block có TU/MACH/CS), số lượng thiết bị cho BOQ
$("bk").addEventListener("click", () => $("bkfile").click());
$("bkfile").addEventListener("change", async (e) => {
  const f = e.target.files[0];
  e.target.value = "";
  if (!f || !S.duAnGoc) return;
  try {
    loi("");
    const { dong } = docBocKhoi(window.XLSX, new Uint8Array(await f.arrayBuffer()));
    const r = apDungBocKhoi(S.duAnGoc, dong, { tenFile: f.name });
    // Áp lại bóc khối lên dữ liệu đã áp vẫn cho cùng kết quả (ghi công suất, không cộng dồn) nên ghi thẳng vào dữ liệu nguồn
    Object.assign(S, { bocKhoi: r.baoCao, duAnGoc: r.duAn, chuaLuu: S.chuaLuu || !!S.duAnId });
    tinhVaVe(r.duAn, { giuChon: true });
  } catch (err) { console.error(err); loi(err.message || String(err)); }
});

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
const dem = (ma, muc) => S.kq.canhBao.filter((c) => (ma == null || c.tu === ma) && !c.dienNhe && c.muc === muc).length;
const demDn = (ma, muc) => S.kq.canhBao.filter((c) => c.dienNhe && c.tu === ma && c.muc === muc).length;

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
    if (x.loai === "dn") {
      // Tờ điện nhẹ: lỗi / cảnh báo của rack ghi ở tờ rack đó
      const ma = x.ma.startsWith("RACK-") ? x.ma.slice(5) : null;
      const l = ma ? demDn(ma, "loi") : 0, c = ma ? demDn(ma, "canhbao") : 0;
      return `<button class="node" data-i="${i}" aria-current="${i === S.chon}" style="padding-left:16px">
        <span class="no">${esc(x.du.sheet.drawingNo)}</span><span class="nm">${esc(x.ten)}</span>
        ${l ? `<span class="dot loi" title="${l} lỗi">${l}</span>` : ""}${c ? `<span class="dot canhbao" title="${c} cảnh báo">${c}</span>` : ""}
      </button>`;
    }
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
  if (x.loai === "dn") return veDienNhe(x);
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
    ["Ik3 max / Ik1 min tại thanh cái", `${so(t.ikTinh, 2)} / ${so(t.nganMach?.ik1Min, 2)} kA (${t.ikNguon})`],
    ["Vỏ tủ", `${t.module.voTu ?? "—"} module · thiết bị ${t.module.tong}, cần ${so(t.module.can)}`],
  ];
  $("facts").innerHTML = facts.map(([k, v]) => `<div class="fact"><div class="kick">${k}</div><div class="v tnum">${esc(v)}</div></div>`).join("");
  const pane = $("pane");
  if (S.view === "nl") return veNhapLieu(t.ma);
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
  if (S.view === "nl") return veNhapLieu(null);
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

const TU_CAT_KY = { dat: " ✓", rcd: " RCD", khong: " ✗" };
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
      <td class="n" title="${esc(m.nganMach?.nguong ? `Ngưỡng cắt từ: ${m.nganMach.nguong.moTa}` : "")}">${m.nganMach?.ik1Cuoi != null ? `${so(m.nganMach.ik1Cuoi, 2)}${TU_CAT_KY[m.nganMach.tuCat] ?? ""}` : "—"}</td>
      <td>${kt.map((k) => `<div><span class="tag ${k.muc}">${MUC[k.muc]}</span> ${esc(k.noiDung)}</div>`).join("")}</td>
    </tr>`;
  }).join("");
  const nhom = (t.nhomRcd || []).map((g) => `<tr><td><b>${esc(g.ma)}</b></td><td colspan="4">RCBO chung cho ${esc(g.mach.join(", "))}</td><td colspan="8">${esc(tb(g.thietBi))}</td></tr>`).join("");
  return `<div class="tblwrap"><table>
    <thead><tr><th>Mã lộ</th><th>Phụ tải</th><th>Pha</th><th>P (W)</th><th>Ib (A)</th><th>Thiết bị</th><th>Cáp</th><th>Iz′ (A)</th><th>L (m)</th><th>ΔU cộng dồn</th><th>Ống</th><th title="Dòng chạm vỏ nhỏ nhất cuối mạch (kA) — ✓ CB tự cắt; RCD: nhờ RCD 30 mA; ✗ chưa đạt">Ik1 cuối (kA)</th><th>Kiểm tra</th></tr></thead>
    <tbody>${rows}${nhom}</tbody></table></div>`;
}

// Tờ điện nhẹ (E.7xx): thông số, bản vẽ, bảng (thiết bị rack / đấu nối cổng / tính toán rack), kiểm tra
function veDienNhe(x) {
  const dn = S.kq.dienNhe;
  const ma = x.ma.startsWith("RACK-") ? x.ma.slice(5) : null;
  const r = ma ? dn.rack.find((y) => y.ma === ma) : null;
  $("phead").innerHTML = `<div><div class="kick">${esc(x.du.sheet.drawingNo)} · điện nhẹ</div><h2>${esc(x.du.sheet.title)}</h2></div>`;
  const facts = r ? [
    ["Tủ rack", `${r.uRack}U ${r.kieuRack} · ${r.uTong}U thiết bị`],
    ["Liên kết", `${r.dem.data} data · ${r.dem.ap} AP · ${r.dem.cam} camera · ${r.soPP} patch panel`],
    ["PoE cần / ngân sách", r.dem.ap + r.dem.cam ? `${Math.ceil(r.poe.can)} / ${r.poe.nganSach} W` : "—"],
    ["Tải · UPS", `${Math.round(r.w)} W · ${r.ups.va} VA`],
    ["Nguồn cấp", r.nguon ? `${r.nguon.tu} / ${r.nguon.ma} · ${r.nguon.P} W${r.nguon.coSan ? "" : " (tự thêm)"}` : "—"],
  ] : [
    ["Tổng", `${dn.tong.data} ổ data · ${dn.tong.ap} AP · ${dn.tong.cam} camera`],
    ["Link Cat6", `${dn.tong.lienKet}`],
    ["Tủ rack", dn.rack.map((y) => `${y.ma} ${y.uRack}U`).join(", ")],
    ["NVR", dn.nvr ? `${dn.nvr.kenh} kênh · ${dn.nvr.soHdd} × ${dn.nvr.hddTB} TB` : "—"],
  ];
  $("facts").innerHTML = facts.map(([k, v]) => `<div class="fact"><div class="kick">${k}</div><div class="v tnum">${esc(v)}</div></div>`).join("");
  const pane = $("pane");
  const dsKt = S.kq.canhBao.filter((c) => c.dienNhe && (!ma || c.tu === ma || !c.tu));
  if (S.view === "ve") pane.innerHTML = `<div class="sheet">${S.to[S.chon].svg.replace(/^<\?xml[^>]*>\s*/, "")}</div>`;
  else if (S.view === "bang") {
    pane.innerHTML = r
      ? `<div class="tblwrap"><table><thead><tr><th>Thiết bị</th><th>Số U</th><th>Công suất (W)</th></tr></thead><tbody>
        ${r.thietBi.map((y) => `<tr><td>${esc(y.ten)}</td><td class="n">${y.u}</td><td class="n">${y.w || "—"}</td></tr>`).join("")}
        <tr><td>Tải PoE (AP, camera, chuông cửa)</td><td></td><td class="n">${r.poe.tai || "—"}</td></tr>
        <tr><td><b>Tổng</b></td><td class="n"><b>${r.uTong}</b></td><td class="n"><b>${Math.round(r.w)}</b></td></tr></tbody></table></div>`
      : `<div class="tblwrap"><table><thead><tr><th>Mã nhãn</th><th>Rack</th><th>Tầng</th><th>Phòng</th><th>Loại</th><th>Thiết bị</th><th>L (m)</th></tr></thead><tbody>
        ${dn.lienKet.map((y) => `<tr class="${y.L > S.kq.quyTac.dienNhe.cat6Max ? "canhbao" : ""}"><td class="nw"><b>${esc(y.ma)}</b></td><td>${esc(y.rack)}</td><td>${esc(y.tang)}</td><td>${esc(y.phong)}</td><td>${esc(y.moTa)}</td><td>${esc(y.thietBi)}</td><td class="n">${y.L}</td></tr>`).join("")}
        </tbody></table></div>`;
  } else if (S.view === "nl") {
    const a = document.activeElement;
    const giu = a?.dataset?.dong ? { dong: a.dataset.dong, i: a.dataset.i, k: a.dataset.k } : null;
    pane.innerHTML = NL.veNhapLieuDn(S.duAnGoc, S.kq);
    if (giu) pane.querySelector(`[data-dong="${giu.dong}"][data-k="${giu.k}"]${giu.i != null ? `[data-i="${giu.i}"]` : ""}`)?.focus();
  } else if (S.view === "kt") pane.innerHTML = dsCanhBao(dsKt, false);
  else pane.innerHTML = dsCanhBao(S.kq.canhBao, true);
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
// BOQ điện: khối lượng + khung đơn giá (điền giá ở sheet "Bang gia", thành tiền tự tính)
const bocKhoiExcel = () => window.XLSX.write(xuatBaoCaoBocKhoi(window.XLSX, S.bocKhoi), { type: "array", bookType: "xlsx" });
$("bkxlsx").addEventListener("click", () => tai(`${S.ten}-boc-khoi.xlsx`, bocKhoiExcel(), XLSX_MIME));
const boqExcel = () => window.XLSX.write(S.bo.boqExcel(window.XLSX), { type: "array", bookType: "xlsx" });
$("boq").addEventListener("click", () => tai(`${S.ten}-boq.xlsx`, boqExcel(), XLSX_MIME));
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
    zip.file("boq.xlsx", boqExcel());
    if (S.bocKhoi) zip.file("boc-khoi.xlsx", bocKhoiExcel());
    if (S.bo.dienNhe) zip.file("dien-nhe.xlsx", window.XLSX.write(S.bo.dienNheExcel(window.XLSX), { type: "array", bookType: "xlsx" }));
    zip.file("nhan-tu.html", S.bo.nhanHtml());
    zip.file("thuyet-minh.docx", await thuyetMinhWord());
    zip.file("thuyet-minh.html", S.bo.thuyetMinhHtml());
    zip.file("du-an.json", JSON.stringify(S.duAn, null, 2));
    zip.file("canh-bao.txt", vanBanCanhBao(S.kq));
    tai(`${S.ten}-bo-ban-ve.zip`, await zip.generateAsync({ type: "blob", compression: "DEFLATE" }));
    btn.disabled = false; btn.textContent = "Tải cả bộ (ZIP)";
  } catch (e) { loi(e.message); $("zip").disabled = false; $("zip").textContent = "Tải cả bộ (ZIP)"; }
});

// =====================================================================================================
// Nhập liệu trên web: sửa khung tên, bảng tủ, bảng mạch → tính lại cả bộ ngay
// =====================================================================================================
function veNhapLieu(maTu) {
  const pane = $("pane");
  // Giữ ô đang gõ / đang chọn sau khi vẽ lại bảng
  const a = document.activeElement;
  const giu = a?.dataset?.dong ? { dong: a.dataset.dong, i: a.dataset.i, k: a.dataset.k } : null;
  pane.innerHTML = NL.veNhapLieu(S.duAnGoc, maTu, S.kq);
  if (giu) pane.querySelector(`[data-dong="${giu.dong}"][data-k="${giu.k}"]${giu.i != null ? `[data-i="${giu.i}"]` : ""}`)?.focus();
}

/** Áp một thay đổi dữ liệu nguồn: đánh dấu chưa lưu, tính lại cả bộ, giữ tờ đang xem (chọn sang tủ chiTu nếu có). */
function apSua(duAnMoi, { chonTu = null } = {}) {
  S.duAnGoc = duAnMoi;
  S.chuaLuu = true;
  try {
    loi("");
    tinhVaVe(duAnMoi, { giuChon: true });
    if (chonTu) {
      const i = S.to.findIndex((x) => x.loai === "tu" && x.ma === chonTu);
      if (i >= 0) { S.chon = i; veCay(); veTu(); }
    }
  } catch (e) { console.error(e); loi(`Dữ liệu chưa tính được: ${e.message}`); veDuAn(); }
}

$("pane").addEventListener("change", (e) => {
  const el = e.target.closest("[data-dong]");
  if (!el || S.view !== "nl") return;
  const v = NL.giaTriO(el);
  const i = Number(el.dataset.i);
  if (el.dataset.dong === "info") apSua(NL.suaInfo(S.duAnGoc, el.dataset.k, v));
  else if (el.dataset.dong === "tu") apSua(NL.suaTu(S.duAnGoc, i, el.dataset.k, v), { chonTu: el.dataset.k === "ma" ? v : null });
  else if (el.dataset.dong === "mach") apSua(NL.suaMach(S.duAnGoc, i, el.dataset.k, v));
  else if (el.dataset.dong === "dn") apSua(NL.suaPhongDn(S.duAnGoc, i, el.dataset.k, v));
  else if (el.dataset.dong === "rack") apSua(NL.suaRack(S.duAnGoc, i, el.dataset.k, v));
});
$("pane").addEventListener("click", (e) => {
  const b = e.target.closest("[data-lenh]");
  if (!b || S.view !== "nl") return;
  const i = Number(b.dataset.i);
  const x = S.to[S.chon];
  const maTu = x?.loai === "tu" ? x.ma : null;
  switch (b.dataset.lenh) {
    case "themTu": { const r = NL.themTu(S.duAnGoc, maTu || S.duAnGoc.panels[0]?.ma || ""); apSua(r.duAn, { chonTu: r.ma }); break; }
    case "xoaTu": {
      const ma = S.duAnGoc.panels[i].ma;
      if (S.duAnGoc.panels.length === 1) return loi("Dự án cần ít nhất một tủ.");
      if (!confirm(`Xóa tủ ${ma} và toàn bộ mạch của tủ này?`)) return;
      const r = NL.xoaTu(S.duAnGoc, i);
      if (r.loi) return loi(r.loi);
      apSua(r.duAn);
      break;
    }
    case "themMach": apSua(NL.themMach(S.duAnGoc, b.dataset.tu).duAn); break;
    case "themSau": apSua(NL.themMach(S.duAnGoc, S.duAnGoc.circuits[i].tu, i).duAn); break;
    case "nhanBan": apSua(NL.nhanBanMach(S.duAnGoc, i).duAn); break;
    case "xoaMach": if (confirm(`Xóa mạch ${S.duAnGoc.circuits[i].ma || ""}?`)) apSua(NL.xoaMach(S.duAnGoc, i)); break;
    case "len": apSua(NL.diChuyenMach(S.duAnGoc, i, -1).duAn); break;
    case "xuong": apSua(NL.diChuyenMach(S.duAnGoc, i, 1).duAn); break;
    case "themDienNhe": apSua(NL.themDienNhe(S.duAnGoc)); break;
    case "themPhongDn": apSua(NL.themPhongDn(S.duAnGoc, Number.isFinite(i) ? i : null)); break;
    case "xoaPhongDn": if (confirm(`Xóa dòng "${S.duAnGoc.dienNhe.phong[i].phong || ""}"?`)) apSua(NL.xoaPhongDn(S.duAnGoc, i)); break;
    case "themRack": apSua(NL.themRack(S.duAnGoc).duAn); break;
    case "xoaRack": {
      const r = NL.xoaRack(S.duAnGoc, i);
      if (r.loi) return loi(r.loi);
      apSua(r.duAn);
      break;
    }
  }
});
$("trong").addEventListener("click", () => {
  Object.assign(S, { ten: "DỰ ÁN MỚI", duAnGoc: NL.duAnTrong(), bocKhoi: null, duAnId: null, phienBan: null, chuaLuu: false });
  tinhVaVe(S.duAnGoc);
  chonView("nl");
});
function chonView(v) {
  S.view = v;
  for (const x of document.querySelectorAll("[data-view]")) x.setAttribute("aria-pressed", String(x.dataset.view === v));
  veTu();
}

// =====================================================================================================
// Dự án chung trên server (Firestore measure-and-make): đăng nhập, danh sách, mở, lưu, lịch sử, xung đột
// =====================================================================================================
const fmtLuc = (d) => (d ? `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}` : "");

/** Hộp thoại: nội dung HTML + các nút [giá trị, nhãn, chính?]; trả về giá trị nút bấm (Esc → ""). onSubmit trả false để giữ hộp mở. */
function hop(html, nut, { onSubmit } = {}) {
  const dlg = $("hop"), form = $("hopND");
  form.innerHTML = `${html}<div class="loi-hop" id="hopLoi"></div><div class="nut">${nut.map(([v, t, chinh]) =>
    `<button class="btn${chinh ? " btn-primary" : ""}" value="${v}">${esc(t)}</button>`).join("")}</div>`;
  return new Promise((ok) => {
    let daXong = false;
    form.onsubmit = async (e) => {
      const v = e.submitter?.value ?? "";
      if (onSubmit && v && v !== "huy") {
        e.preventDefault();
        try { if ((await onSubmit(v, form)) === false) return; } catch (err) { $("hopLoi").textContent = err.message; return; }
        daXong = true; dlg.close(v); ok(v);
      }
    };
    // Sự kiện close được gửi trễ (một task sau dlg.close()): nếu hộp này mở ngay sau hộp trước thì close của hộp trước
    // tới khi hộp này đang mở → bỏ qua.
    dlg.onclose = () => { if (!daXong && !dlg.open) ok(dlg.returnValue || ""); };
    dlg.returnValue = "";
    dlg.showModal();
    form.querySelector("input,textarea")?.focus();
  });
}

function veTaiKhoan() {
  const tk = $("tk");
  if (!S.kho) {
    tk.innerHTML = S.khoLoi ? `<span class="crumb" title="${esc(S.khoLoi)}">Máy chủ: chưa kết nối</span><button class="btn btn-sm" id="khoLai">Thử lại</button>` : `<span class="crumb">Đang kết nối máy chủ…</span>`;
    $("khoLai")?.addEventListener("click", ketNoiKho);
  } else if (!S.nguoiDung) {
    tk.innerHTML = `<button class="btn btn-sm" id="dangNhap">Đăng nhập</button>`;
    $("dangNhap").addEventListener("click", () => dangNhap());
  } else {
    tk.innerHTML = `<span class="trangthai" title="Tài khoản dùng chung với app M&M">${esc(S.nguoiDung.email)}</span><button class="btn btn-sm" id="dangXuat">Đăng xuất</button>`;
    $("dangXuat").addEventListener("click", async () => {
      if (S.chuaLuu && !confirm("Dự án có thay đổi chưa lưu. Vẫn đăng xuất?")) return;
      await S.kho.dangXuat();
    });
  }
  veDsServer();
}

async function dangNhap() {
  if (!S.kho) { loi(S.khoLoi || "Chưa kết nối được máy chủ."); return false; }
  const v = await hop(`<h2>Đăng nhập</h2><p class="crumb" style="margin:0">Dùng tài khoản app M&amp;M Báo giá / FF&amp;E.</p>
    <label>Email<input name="email" type="email" autocomplete="username" required></label>
    <label>Mật khẩu<input name="pass" type="password" autocomplete="current-password" required></label>`,
  [["huy", "Hủy"], ["ok", "Đăng nhập", true]], {
    onSubmit: async (_, f) => {
      try { await S.kho.dangNhap(f.email.value.trim(), f.pass.value); } catch (e) { throw new Error(loiDangNhap(e)); }
    },
  });
  return v === "ok";
}

function veDsServer() {
  const box = $("dsServer");
  if (!S.kho) { box.innerHTML = `<div class="rong">${S.khoLoi ? `Chưa kết nối được máy chủ dự án chung (${esc(S.khoLoi)}). Vẫn dùng được Excel bên dưới.` : "Đang kết nối máy chủ dự án chung…"}</div>`; return; }
  if (!S.nguoiDung) {
    box.innerHTML = `<div class="dau"><h2>Dự án chung của team</h2></div><div class="rong">Đăng nhập (tài khoản app M&amp;M) để mở và lưu dự án chung. <button class="btn btn-sm" id="dnDs">Đăng nhập</button></div>`;
    $("dnDs").addEventListener("click", () => dangNhap());
    return;
  }
  const t = S.tim.trim().toLowerCase();
  const ds = S.ds.filter((d) => !t || [d.ten, d.project, d.client, d.updatedBy, d.congTrinh?.ten].join(" ").toLowerCase().includes(t));
  box.innerHTML = `<div class="dau"><h2>Dự án chung của team</h2><span class="sp"></span>
    ${S.congTrinh.length ? '<button class="btn btn-sm" id="tuCt" title="Mở hoặc tạo sơ đồ điện của một công trình trong danh sách chung (Dự toán / FF&amp;E)">Theo công trình…</button>' : ""}
    <input type="search" id="timDa" placeholder="Tìm dự án / công trình…" value="${esc(S.tim)}"></div>
    ${S.ctLoi ? `<div class="rong">${esc(S.ctLoi)}</div>` : ""}
    ${ds.length ? ds.map((d) => `<button class="dong" data-mo="${esc(d.id)}"><span class="ten"><b>${esc(d.ten)}</b><span class="crumb">${esc([d.congTrinh ? `Công trình: ${d.congTrinh.ten}` : "", d.client, `${d.soTu} tủ · ${d.soMach} mạch`].filter(Boolean).join(" · "))}</span></span>
      <span class="crumb">bản ${d.phienBan} · ${fmtLuc(d.updatedAt)}${d.updatedBy ? ` · ${esc(d.updatedBy)}` : ""}</span></button>`).join("")
      : `<div class="rong">${S.ds.length ? "Không có dự án khớp." : "Chưa có dự án nào. Mở file Excel / ví dụ / dự án trống rồi bấm \"Lưu lên server\"."}</div>`}`;
  $("timDa").addEventListener("input", (e) => { S.tim = e.target.value; veDsServer(); $("timDa").focus(); $("timDa").setSelectionRange(S.tim.length, S.tim.length); });
  $("tuCt")?.addEventListener("click", theoCongTrinh);
}

// --- Công trình dùng chung (app Dự toán / FF&E) ------------------------------------------------------------
function chonCongTrinhHtml(chon) {
  if (!S.congTrinh.length) return S.ctLoi ? `<p class="crumb" style="margin:0">${esc(S.ctLoi)}</p>` : "";
  return `<label>Công trình (dùng chung với app Dự toán / FF&amp;E)<select name="ct"><option value="">— Không gắn —</option>
    ${S.congTrinh.map((c) => `<option value="${esc(c.key)}"${c.key === chon ? " selected" : ""}>${esc(c.ten)}${c.client ? ` — ${esc(c.client)}` : ""}${c.ffeId ? ` · FF&E ${c.soHangMuc} hạng mục` : ""}</option>`).join("")}
  </select></label><p class="crumb" style="margin:0">Khung tên chỉ điền ô đang trống (tên dự án, chủ đầu tư).</p>`;
}

/** Gắn / bỏ gắn công trình vào dữ liệu nguồn, điền khung tên ô trống, tính lại */
function apCongTrinh(ct) {
  const cu = S.duAnGoc.congTrinh?.key || "";
  const r = CT.ganCongTrinh(S.duAnGoc, ct);
  if ((ct?.key || "") === cu && !r.daDien.length) return;
  S.duAnGoc = r.duAn;
  if (S.duAnId) S.chuaLuu = true;
  tinhVaVe(S.duAnGoc, { giuChon: true });
}

async function doiCongTrinh() {
  if (!S.congTrinh.length) return loi(S.ctLoi || "Chưa tải được danh sách công trình chung.");
  let ct = null;
  const v = await hop(`<h2>Gắn công trình</h2>${chonCongTrinhHtml(S.duAnGoc.congTrinh?.key)}`, [["huy", "Hủy"], ["ok", "Gắn", true]],
    { onSubmit: (_, f) => { ct = S.congTrinh.find((c) => c.key === f.ct.value) || null; } });
  if (v === "ok") apCongTrinh(ct);
}

/** Mở sơ đồ điện của công trình đã có trên server; chưa có thì tạo dự án trống gắn công trình đó */
async function moTheoCongTrinh(ct) {
  const coSan = S.ds.find((d) => CT.cungCongTrinh(d.congTrinh, ct));
  if (coSan) return moDuAn(coSan.id);
  if (S.chuaLuu && !confirm("Dự án đang mở có thay đổi chưa lưu. Bỏ thay đổi để tạo dự án mới?")) return;
  const duAn = CT.ganCongTrinh(NL.duAnTrong(), ct).duAn;
  Object.assign(S, { ten: ct.ten, duAnGoc: duAn, bocKhoi: null, duAnId: null, phienBan: null, chuaLuu: false });
  tinhVaVe(duAn);
  chonView("nl");
}

async function theoCongTrinh() {
  let ct = null;
  const v = await hop(`<h2>Sơ đồ điện theo công trình</h2>${chonCongTrinhHtml("")}
    <p class="crumb" style="margin:0">Công trình đã có sơ đồ điện thì mở bản trên server; chưa có thì tạo dự án trống gắn công trình đó.</p>`,
  [["huy", "Hủy"], ["ok", "Mở", true]], { onSubmit: (_, f) => { ct = S.congTrinh.find((c) => c.key === f.ct.value) || null; if (!ct) throw new Error("Chọn một công trình."); } });
  if (v === "ok") moTheoCongTrinh(ct);
}

/** ?congTrinh=<mã Dự toán / mã FF&E / tên>: chạy một lần khi đã đăng nhập và có cả hai danh sách */
function xuLyLinkCongTrinh() {
  if (!S.linkCt || !S.ctSan || !S.dsSan) return;
  const x = S.linkCt;
  S.linkCt = "";
  const ct = CT.timCongTrinh(S.congTrinh, x);
  if (!ct) return loi(`Không tìm thấy công trình "${x}" trong danh sách chung (app Dự toán / FF&E).`);
  moTheoCongTrinh(ct);
}
$("dsServer").addEventListener("click", (e) => { const b = e.target.closest("[data-mo]"); if (b) moDuAn(b.dataset.mo); });

async function moDuAn(id) {
  if (S.chuaLuu && !confirm("Dự án đang mở có thay đổi chưa lưu. Bỏ thay đổi để mở dự án khác?")) return;
  try {
    loi("");
    const d = await S.kho.mo(id);
    const cungDuAn = id === S.duAnId && S.duAn;              // mở lại cùng dự án (bản mới / khôi phục) → giữ tờ đang xem
    Object.assign(S, { ten: d.ten, duAnGoc: d.duAn, bocKhoi: null, duAnId: id, phienBan: d.phienBan, chuaLuu: false });
    tinhVaVe(d.duAn, { giuChon: !!cungDuAn });
  } catch (e) { console.error(e); loi(`Không mở được dự án: ${e.message}`); }
}

/** Thanh dự án trên đầu trang: tên, phiên bản, trạng thái lưu, các nút server */
function veDuAn() {
  const box = $("duan");
  if (!S.duAnGoc) { box.innerHTML = ""; return; }
  const trangThai = S.duAnId ? `bản ${S.phienBan}${S.chuaLuu ? ' · <span class="chuaLuu">chưa lưu</span>' : " · đã lưu"}` : "chưa có trên server";
  const ct = S.duAnGoc.congTrinh, ffe = CT.linkFfe(ct, FFE_URL);
  box.innerHTML = `<b>${esc(S.ten)}</b><span class="trangthai">${trangThai}</span>
    ${ct ? `<span class="trangthai" id="ctDangGan" title="Công trình dùng chung với app Dự toán / FF&amp;E">Công trình: <b>${esc(ct.ten)}</b></span>` : ""}
    ${ffe ? `<a class="btn btn-sm" id="moFfe" href="${esc(ffe)}" target="_blank" rel="noopener" title="Mở bảng kê FF&amp;E của công trình (tab mới)">Mở FF&amp;E ↗</a>` : ""}
    ${S.nguoiDung ? `<button class="btn btn-sm" id="ganCt">${ct ? "Đổi công trình" : "Gắn công trình"}</button>` : ""}
    <button class="btn btn-sm${S.chuaLuu || !S.duAnId ? " btn-primary" : ""}" id="luu" ${S.duAnId && !S.chuaLuu ? "disabled" : ""} title="Ctrl+S">${S.duAnId ? "Lưu" : "Lưu lên server"}</button>
    ${S.duAnId ? `<button class="btn btn-sm" id="lichSu">Lịch sử</button><button class="btn btn-sm" id="doiTen">Đổi tên</button>` : ""}
    <button class="btn btn-sm" id="dong" title="Đóng dự án, về danh sách">Đóng</button>`;
  $("luu").addEventListener("click", luu);
  $("ganCt")?.addEventListener("click", doiCongTrinh);
  $("lichSu")?.addEventListener("click", xemLichSu);
  $("doiTen")?.addEventListener("click", doiTen);
  $("dong").addEventListener("click", dongDuAn);
}

async function luu() {
  if (!S.duAnGoc) return;
  if (!S.kho) return loi(S.khoLoi || "Chưa kết nối được máy chủ.");
  if (!S.nguoiDung && !(await dangNhap())) return;
  try {
    loi("");
    if (!S.duAnId) {
      let ten = S.duAnGoc.info?.project || S.ten, ct = null;
      const goiY = S.duAnGoc.congTrinh || CT.timCongTrinh(S.congTrinh, ten) || CT.timCongTrinh(S.congTrinh, S.ten);
      const v = await hop(`<h2>Lưu lên server</h2><label>Tên dự án<input name="ten" value="${esc(ten)}" required></label>
        ${chonCongTrinhHtml(goiY?.key)}
        <p class="crumb" style="margin:0">Cả team (tài khoản M&amp;M) sẽ thấy và sửa được dự án này. Mỗi lần lưu giữ lại bản cũ trong Lịch sử.</p>`,
      [["huy", "Hủy"], ["ok", "Lưu", true]], { onSubmit: (_, f) => {
        ten = f.ten.value.trim(); if (!ten) throw new Error("Nhập tên dự án.");
        ct = f.ct ? S.congTrinh.find((c) => c.key === f.ct.value) || null : S.duAnGoc.congTrinh || null;
      } });
      if (v !== "ok") return;
      if (S.congTrinh.length || !ct) apCongTrinh(ct);
      const r = await S.kho.taoMoi(ten, S.duAnGoc);
      Object.assign(S, { duAnId: r.id, phienBan: r.phienBan, ten, chuaLuu: false });
    } else {
      let ghiChu = "";
      const v = await hop(`<h2>Lưu "${esc(S.ten)}"</h2><label>Ghi chú lần lưu (không bắt buộc)<input name="gc" placeholder="Ví dụ: thêm điều hòa P.ngủ 3"></label>`,
        [["huy", "Hủy"], ["ok", "Lưu", true]], { onSubmit: (_, f) => { ghiChu = f.gc.value.trim(); } });
      if (v !== "ok") return;
      await luuBan(ghiChu, false);
    }
  } catch (e) { console.error(e); loi(`Không lưu được: ${e.message}`); }
  veDuAn();
}

async function luuBan(ghiChu, ep) {
  try {
    const r = await S.kho.luu(S.duAnId, S.duAnGoc, { ghiChu, phienBanDangMo: S.phienBan, ep });
    Object.assign(S, { phienBan: r.phienBan, chuaLuu: false });
  } catch (e) {
    if (!(e instanceof LoiXungDot)) throw e;
    const v = await hop(`<h2>Có người vừa lưu dự án này</h2><p style="margin:0">${esc(e.message)}</p>
      <p class="crumb" style="margin:0">Mở bản mới: bỏ thay đổi của anh, tải bản trên server về. Vẫn lưu đè: bản của người kia được giữ trong Lịch sử.</p>`,
    [["huy", "Hủy"], ["moi", "Mở bản mới"], ["de", "Vẫn lưu đè", true]]);
    if (v === "de") return luuBan(ghiChu, true);
    if (v === "moi") { S.chuaLuu = false; return moDuAn(S.duAnId); }
  }
}

async function xemLichSu() {
  try {
    const ds = await S.kho.lichSu(S.duAnId);
    const v = await hop(`<h2>Lịch sử "${esc(S.ten)}"</h2><p class="crumb" style="margin:0">Bản hiện tại: ${S.phienBan}. Khôi phục một bản cũ sẽ lưu bản hiện tại vào lịch sử trước.</p>
      <div class="ls">${ds.length ? ds.map((h) => `<div class="dong"><span><b>Bản ${h.phienBan}</b> · ${fmtLuc(h.luc)}${h.boi ? ` · ${esc(h.boi)}` : ""}${h.ghiChu ? ` — ${esc(h.ghiChu)}` : ""}</span>
        <button class="btn btn-sm" value="kp:${esc(h.hid)}">Khôi phục</button></div>`).join("") : '<div class="dong"><span>Chưa có bản cũ — lịch sử bắt đầu từ lần lưu tiếp theo.</span></div>'}</div>`,
    [["huy", "Đóng"]]);
    if (!v.startsWith("kp:")) return;
    if (S.chuaLuu && !confirm("Dự án có thay đổi chưa lưu — khôi phục sẽ bỏ các thay đổi đó. Tiếp tục?")) return;
    await S.kho.khoiPhuc(S.duAnId, v.slice(3));
    S.chuaLuu = false;
    await moDuAn(S.duAnId);
  } catch (e) { console.error(e); loi(`Không xem được lịch sử: ${e.message}`); }
}

async function doiTen() {
  let ten = S.ten;
  const v = await hop(`<h2>Đổi tên dự án</h2><label>Tên mới<input name="ten" value="${esc(ten)}" required></label>`, [["huy", "Hủy"], ["ok", "Đổi tên", true]],
    { onSubmit: async (_, f) => { ten = f.ten.value.trim(); if (!ten) throw new Error("Nhập tên dự án."); await S.kho.doiTen(S.duAnId, ten); } });
  if (v === "ok") { S.ten = ten; veDuAn(); }
}

function dongDuAn() {
  if (S.chuaLuu && !confirm("Dự án có thay đổi chưa lưu. Đóng và bỏ thay đổi?")) return;
  Object.assign(S, { ten: "", duAnGoc: null, duAn: null, kq: null, bo: null, to: [], bocKhoi: null, duAnId: null, phienBan: null, chuaLuu: false });
  $("result").classList.add("hide");
  $("empty").classList.remove("hide");
  for (const id of ["zip", "xlsx", "json", "nhan", "nhanxlsx", "tmword", "tmxem", "boq", "bk"]) $(id).disabled = true;
  $("bkxlsx").classList.add("hide");
  veDuAn();
  veDsServer();
}

// Ctrl+S lưu; rời trang khi chưa lưu thì trình duyệt hỏi lại
document.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s" && S.duAnGoc) { e.preventDefault(); luu(); }
});
window.addEventListener("beforeunload", (e) => { if (S.chuaLuu) { e.preventDefault(); e.returnValue = ""; } });

async function ketNoiKho() {
  S.khoLoi = "";
  veTaiKhoan();
  try {
    S.kho = await taoKho();
    S.kho.ngheNguoiDung((u) => {
      S.nguoiDung = u;
      S.ngheDs?.(); S.ngheDs = null; S.ds = [];
      S.ngheCt?.(); S.ngheCt = null; Object.assign(S, { congTrinh: [], ctLoi: "", ctSan: false, dsSan: false });
      if (u) {
        S.ngheDs = S.kho.ngheDanhSach((ds) => { S.ds = ds; S.dsSan = true; veDsServer(); xuLyLinkCongTrinh(); }, (e) => { S.khoLoi = e.message; veDsServer(); });
        S.ngheCt = S.kho.ngheCongTrinh?.((ds) => { S.congTrinh = ds; S.ctSan = true; S.ctLoi = ""; veDsServer(); veDuAn(); xuLyLinkCongTrinh(); },
          (e) => { S.ctLoi = String(e); veDsServer(); }) ?? null;
      }
      veTaiKhoan();
      veDuAn();
    });
  } catch (e) {
    console.warn(e);
    S.kho = null;
    S.khoLoi = e.message || String(e);
    veTaiKhoan();
  }
}
ketNoiKho();
