// Chế độ "Nhập liệu" của web app: sửa khung tên, bảng tủ, bảng mạch ngay trên web.
// Phần THAO TÁC DỮ LIỆU (thuần, không đụng DOM — có test trong engine/tests/nhap-lieu.test.mjs) và phần DỰNG BẢNG (HTML).
// Dữ liệu là đúng dạng docExcel trả về: { info, panels, circuits, quyTac }. Mạch xác định bằng chỉ số trong duAn.circuits.

// --- Cột ------------------------------------------------------------------------------------------
export const LOAI_CONG_TRINH = ["Nhà ở / biệt thự", "Căn hộ"];
export const LOAI_KHU_VUC = ["Khô", "Ướt (WC, tắm)", "Ngoài nhà", "Bếp"];
const KIEU_DI = ["Ống", "Máng cáp"];
const CO_KHONG = ["Theo quy tắc", "Có", "Không"];

export const COT_INFO = [
  ["project", "Tên dự án"], ["client", "Chủ đầu tư"], ["address", "Địa chỉ"], ["loaiCongTrinh", "Loại công trình", LOAI_CONG_TRINH],
  ["projectNo", "Mã dự án"], ["date", "Ngày"], ["design", "Thiết kế / chủ trì"], ["checkBy", "Kiểm tra"], ["madeBy", "Người vẽ"],
  ["director", "Giám đốc"], ["ikNguon", "Ik nguồn (kA)", null, true], ["soBanVeDau", "Số bản vẽ tờ tủ đầu"], ["soBanVeTong", "Số bản vẽ tờ tổng"],
];
// [khóa, tiêu đề, độ rộng (ch), danh sách chọn | null, là số]
export const COT_TU = [
  ["ma", "Mã tủ", 7], ["ten", "Tên trên bản vẽ", 16], ["viTri", "Vị trí", 10], ["capTu", "Cấp từ tủ", 8, "TU"], ["maLoCap", "Mã lộ cấp", 7],
  ["datSauLo", "Đặt sau lộ", 7], ["soPha", "Số pha", 5, [1, 3], true], ["lCap", "L cáp cấp (m)", 7, null, true], ["kieuDi", "Kiểu đi", 8, KIEU_DI],
  ["ik", "Ik (kA)", 6, null, true], ["ks", "Kđt", 5, null, true], ["spd", "SPD", 9, CO_KHONG], ["ghiChu", "Ghi chú", 14],
];
export const COT_MACH = [
  ["ma", "Mã lộ", 8], ["loai", "Loại mạch", 16, "LOAI"], ["phuTai", "Phụ tải", 22], ["khuVuc", "Khu vực", 10, LOAI_KHU_VUC],
  ["soLuong", "SL", 4, null, true], ["congSuat", "P/đv (W)", 7, null, true], ["cos", "cosφ", 5, null, true], ["soPha", "Số pha", 5, [1, 3], true],
  ["pha", "Pha", 4, ["", "A", "B", "C"]], ["L", "L (m)", 5, null, true], ["nhomOng", "Chung ống", 5, null, true], ["nhomRcd", "Nhóm RCD", 6],
  ["ghiDeThietBi", "Ghi đè thiết bị", 14], ["ghiDeCap", "Ghi đè cáp", 14], ["ghiDeOng", "Ghi đè ống", 10], ["lyDo", "Lý do ghi đè", 16], ["ghiChu", "Ghi chú", 16],
];

// --- Thao tác dữ liệu (trả về dự án MỚI, không sửa bản cũ) -------------------------------------------
const sao = (x) => structuredClone(x);

/** "1.250,5" / "12,5" / "" → số | null */
export function docSo(s) {
  const t = String(s ?? "").trim().replace(/\s/g, "");
  if (!t) return null;
  const n = Number(/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(t) ? t.replace(/\./g, "").replace(",", ".") : t.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

/** Mã kế tiếp theo tiền tố: L1, L2 → L3 (bỏ qua mã đã có trong tủ) */
export function maKeTiep(maDaCo, goiY = "L") {
  const tienTo = String(goiY).replace(/\d+$/, "") || "L";
  const so = maDaCo.map((m) => String(m).match(new RegExp(`^${tienTo.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(\\d+)$`))?.[1]).filter(Boolean).map(Number);
  return `${tienTo}${so.length ? Math.max(...so) + 1 : 1}`;
}

export function suaInfo(duAn, k, v) {
  const d = sao(duAn);
  d.info = { ...d.info, [k]: v };
  return d;
}

export function suaTu(duAn, i, k, v) {
  const d = sao(duAn);
  const cu = d.panels[i].ma;
  d.panels[i] = { ...d.panels[i], [k]: v };
  if (k === "ma" && v && v !== cu) {
    // Đổi mã tủ: mạch của tủ và tủ con trỏ tới tủ này đi theo
    for (const c of d.circuits) if (c.tu === cu) c.tu = v;
    for (const p of d.panels) if (p.capTu === cu) p.capTu = v;
  }
  return d;
}

export function themTu(duAn, capTu = "") {
  const d = sao(duAn);
  const ma = maKeTiep(d.panels.map((p) => p.ma), "T");
  d.panels.push({ ma, ten: `TỦ ĐIỆN ${ma}`, capTu: capTu || "", soPha: 1, kieuDi: "Ống", spd: "Theo quy tắc", lCap: capTu ? 15 : null });
  d.circuits.push({ tu: ma, ma: "L1", loai: "Chiếu sáng trong nhà", phuTai: "CHIẾU SÁNG", khuVuc: "Khô", congSuat: 300, L: 18 });
  return { duAn: d, ma };
}

/** Xóa tủ cùng các mạch của nó; tủ còn tủ con thì không xóa (trả lỗi). */
export function xoaTu(duAn, i) {
  const ma = duAn.panels[i].ma;
  const con = duAn.panels.filter((p) => p.capTu === ma).map((p) => p.ma);
  if (con.length) return { loi: `Tủ ${ma} đang cấp cho ${con.join(", ")} — đổi "Cấp từ tủ" của các tủ đó trước.` };
  const d = sao(duAn);
  d.panels.splice(i, 1);
  d.circuits = d.circuits.filter((c) => c.tu !== ma);
  return { duAn: d };
}

export function suaMach(duAn, i, k, v) {
  const d = sao(duAn);
  d.circuits[i] = { ...d.circuits[i], [k]: v };
  return d;
}

/** Thêm mạch vào tủ, ngay sau mạch thứ i (hoặc cuối tủ); mã tự đánh theo tiền tố của mạch đứng trước. */
export function themMach(duAn, tu, sauI = null) {
  const d = sao(duAn);
  const cuaTu = d.circuits.map((c, j) => [c, j]).filter(([c]) => c.tu === tu);
  const truoc = sauI != null ? d.circuits[sauI] : cuaTu.at(-1)?.[0];
  const ma = maKeTiep(cuaTu.map(([c]) => c.ma), truoc?.ma || "L");
  const moi = { tu, ma, loai: truoc?.loai || "Chiếu sáng trong nhà", phuTai: "", khuVuc: truoc?.khuVuc || "Khô", congSuat: null, L: null };
  const viTri = sauI != null ? sauI + 1 : (cuaTu.at(-1)?.[1] ?? d.circuits.length - 1) + 1;
  d.circuits.splice(viTri, 0, moi);
  return { duAn: d, i: viTri };
}

export function xoaMach(duAn, i) {
  const d = sao(duAn);
  d.circuits.splice(i, 1);
  return d;
}

/** Nhân bản mạch: bản sao đứng ngay sau, mã mới theo tiền tố, bỏ khóa pha và ghi đè. */
export function nhanBanMach(duAn, i) {
  const d = sao(duAn);
  const c = d.circuits[i];
  const ma = maKeTiep(d.circuits.filter((x) => x.tu === c.tu).map((x) => x.ma), c.ma);
  const { pha, ghiDeThietBi, ghiDeCap, ghiDeOng, lyDo, ...con } = c;
  d.circuits.splice(i + 1, 0, { ...con, ma });
  return { duAn: d, i: i + 1 };
}

/** Đổi chỗ mạch i với mạch liền trước / liền sau CÙNG TỦ (huong = -1 | 1). */
export function diChuyenMach(duAn, i, huong) {
  const tu = duAn.circuits[i].tu;
  const cuaTu = duAn.circuits.map((c, j) => [c, j]).filter(([c]) => c.tu === tu).map(([, j]) => j);
  const vt = cuaTu.indexOf(i);
  const j = cuaTu[vt + huong];
  if (j == null) return { duAn, i };
  const d = sao(duAn);
  [d.circuits[i], d.circuits[j]] = [d.circuits[j], d.circuits[i]];
  return { duAn: d, i: j };
}

/** Dự án trống: 1 tủ 3 pha, 2 mạch mẫu — để bắt đầu nhập thẳng trên web. */
export function duAnTrong() {
  return {
    info: { project: "DỰ ÁN MỚI", loaiCongTrinh: "Nhà ở / biệt thự", soBanVeDau: "E.601", soBanVeTong: "E.600" },
    panels: [{ ma: "T1", ten: "TỦ ĐIỆN T1", viTri: "Tầng 1", soPha: 3, kieuDi: "Ống", spd: "Theo quy tắc" }],
    circuits: [
      { tu: "T1", ma: "L1", loai: "Chiếu sáng trong nhà", phuTai: "CHIẾU SÁNG", khuVuc: "Khô", congSuat: 500, L: 20 },
      { tu: "T1", ma: "S1", loai: "Ổ cắm thông thường", phuTai: "Ổ CẮM", khuVuc: "Khô", congSuat: 2000, L: 20 },
    ],
    quyTac: {}, loiDoc: [],
  };
}

// --- Dựng bảng (HTML) --------------------------------------------------------------------------------
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const hienSo = (v) => (v == null || v === "" ? "" : String(v).replace(".", ","));

function o(loaiDong, i, [k, , rong, chon, laSo], v, dsTu, dsLoai) {
  const attr = `data-dong="${loaiDong}" data-i="${i}" data-k="${k}" aria-label="${esc(k)}"`;
  const ds = chon === "TU" ? ["", ...dsTu] : chon === "LOAI" ? dsLoai : chon;
  if (ds) {
    const cur = v ?? "";
    const opts = (ds.includes(cur) || ds.map(String).includes(String(cur)) ? ds : [cur, ...ds])
      .map((x) => `<option value="${esc(x)}"${String(x) === String(cur) ? " selected" : ""}>${esc(x === "" ? "—" : x)}</option>`).join("");
    return `<select ${attr} data-so="${laSo ? 1 : ""}" style="width:${rong + 2}ch">${opts}</select>`;
  }
  return `<input ${attr} data-so="${laSo ? 1 : ""}" value="${esc(laSo ? hienSo(v) : v)}" style="width:${rong}ch"${laSo ? ' inputmode="decimal"' : ""}>`;
}

/**
 * @param {object} duAn — dữ liệu đang sửa
 * @param {string|null} maTu — tủ đang chọn (null: tờ tổng → chỉ khung tên + bảng tủ)
 * @param {object} kq — kết quả tính lần gần nhất (đánh dấu lỗi/cảnh báo theo dòng)
 */
export function veNhapLieu(duAn, maTu, kq) {
  const dsTu = duAn.panels.map((p) => p.ma);
  const dsLoai = Object.keys(kq?.quyTac?.loaiMach ?? {});
  const kiemTraTu = (ma) => (kq?.canhBao ?? []).filter((c) => c.tu === ma);
  const trangThai = (ds) => (ds.some((c) => c.muc === "loi") ? "loi" : ds.some((c) => c.muc === "canhbao") ? "canhbao" : "");

  const info = `<details class="nl-info"><summary>Khung tên và thông tin dự án</summary><div class="nl-form">${COT_INFO.map(([k, ten, ds, laSo]) =>
    `<label><span class="kick">${esc(ten)}</span>${ds
      ? `<select data-dong="info" data-k="${k}">${ds.map((x) => `<option${x === duAn.info?.[k] ? " selected" : ""}>${esc(x)}</option>`).join("")}</select>`
      : `<input data-dong="info" data-k="${k}" data-so="${laSo ? 1 : ""}" value="${esc(laSo ? hienSo(duAn.info?.[k]) : duAn.info?.[k])}">`}</label>`).join("")}</div></details>`;

  const bangTu = `<div class="nl-dau"><h3>Tủ điện</h3><button class="btn btn-sm" data-lenh="themTu">+ Thêm tủ</button></div>
  <div class="tblwrap"><table class="nl"><thead><tr>${COT_TU.map(([, t]) => `<th>${esc(t)}</th>`).join("")}<th></th></tr></thead><tbody>
  ${duAn.panels.map((p, i) => {
    const tt = trangThai(kiemTraTu(p.ma));
    return `<tr class="${tt}${p.ma === maTu ? " chon" : ""}">${COT_TU.map((c) => `<td>${o("tu", i, c, p[c[0]], dsTu.filter((x) => x !== p.ma), dsLoai)}</td>`).join("")}
      <td class="nw"><button class="btn btn-sm" data-lenh="xoaTu" data-i="${i}" title="Xóa tủ và các mạch của tủ">Xóa</button></td></tr>`;
  }).join("")}</tbody></table></div>`;

  let bangMach = "";
  if (maTu) {
    const kqTu = kq?.tu.find((t) => t.ma === maTu);
    const rows = duAn.circuits.map((c, i) => [c, i]).filter(([c]) => c.tu === maTu);
    bangMach = `<div class="nl-dau"><h3>Mạch của tủ ${esc(maTu)}</h3><button class="btn btn-sm btn-primary" data-lenh="themMach" data-tu="${esc(maTu)}">+ Thêm mạch</button></div>
    <div class="tblwrap"><table class="nl"><thead><tr>${COT_MACH.map(([, t]) => `<th>${esc(t)}</th>`).join("")}<th>Kết quả</th><th></th></tr></thead><tbody>
    ${rows.map(([c, i]) => {
      const m = kqTu?.mach.find((x) => x.ma === c.ma && !x.laCapTuCon);
      const kt = m?.kiemTra ?? [];
      const tt = trangThai(kt);
      const ketQua = m ? `${m.thietBi ? `${m.thietBi.loai} ${m.thietBi.soCuc} ${m.thietBi.in}A` : ""}${m.cap?.s ? ` · ${String(m.cap.s).replace(".", ",")} mm²` : ""}${m.pha ? ` · pha ${m.pha}` : ""}` : "";
      return `<tr class="${tt}" title="${esc(kt.map((k) => k.noiDung).join("\n"))}">${COT_MACH.map((col) => `<td>${o("mach", i, col, c[col[0]], dsTu, dsLoai)}</td>`).join("")}
        <td class="nw kq">${esc(ketQua)}${kt.length ? ` <span class="dot ${tt || "ghichu"}">${kt.length}</span>` : ""}</td>
        <td class="nw"><button class="btn btn-sm" data-lenh="len" data-i="${i}" title="Lên">↑</button><button class="btn btn-sm" data-lenh="xuong" data-i="${i}" title="Xuống">↓</button><button class="btn btn-sm" data-lenh="nhanBan" data-i="${i}" title="Nhân bản">⧉</button><button class="btn btn-sm" data-lenh="themSau" data-i="${i}" title="Thêm mạch ngay sau">+</button><button class="btn btn-sm" data-lenh="xoaMach" data-i="${i}" title="Xóa mạch">×</button></td></tr>`;
    }).join("")}</tbody></table></div>
    <p class="crumb">Sửa ô rồi bấm Tab / Enter hoặc bấm ra ngoài: bản vẽ, bảng tính, thuyết minh, BOQ tính lại ngay. Rê chuột lên dòng tô màu để xem lỗi / cảnh báo. Lộ cấp tủ con do công cụ tự tạo theo bảng tủ.</p>`;
  }
  return `<div class="nhaplieu">${info}${bangTu}${bangMach}</div>`;
}

/** Đọc giá trị một ô theo kiểu cột */
export function giaTriO(el) {
  if (el.dataset.so) return docSo(el.value);
  return el.value.trim() === "" ? (el.tagName === "SELECT" ? "" : null) : el.value.trim();
}
