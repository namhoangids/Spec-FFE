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
  ["director", "Giám đốc"], ["soBanVeDau", "Số bản vẽ tờ tủ đầu"], ["soBanVeTong", "Số bản vẽ tờ tổng"],
  ["noiDat", "Sơ đồ nối đất", ["TN-S", "TN-C-S", "TT"]], ["ikNguon", "Ik tại điểm đấu (kA)", null, true],
  ["mbaKva", "MBA riêng (kVA)", null, true], ["mbaUk", "Uk MBA (%)", null, true],
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
  ["ghiDeThietBi", "Ghi đè thiết bị", 14], ["ghiDeCap", "Ghi đè cáp", 14], ["ghiDeOng", "Ghi đè ống", 10], ["lyDo", "Lý do ghi đè", 16],
  ["knx", "KNX", 7, ["", "Bật/tắt", "Dimmer", "Rèm"]], ["ghiChu", "Ghi chú", 16],
];
// Điện nhẹ: bảng thiết bị theo phòng và bảng tủ rack (cột "rack" chọn trong danh sách rack)
export const COT_DN = [
  ["tang", "Tầng", 5], ["phong", "Phòng / khu vực", 18], ["data", "Ổ data", 4, null, true], ["tv", "Ổ TV", 4, null, true],
  ["ap", "AP", 3, null, true], ["camTrong", "Cam trong", 4, null, true], ["camNgoai", "Cam ngoài", 4, null, true],
  ["acs", "Cửa ACS", 4, null, true], ["chuongNgoai", "Nút gọi", 4, null, true], ["chuongTrong", "MH chuông", 4, null, true],
  ["loa", "Loa", 3, null, true], ["loaW", "W/loa", 4, null, true], ["vungAm", "Vùng âm thanh", 12], ["knx", "KNX", 3, null, true],
  ["rack", "Rack", 5, "RACK"], ["L", "L (m)", 4, null, true], ["ghiChu", "Ghi chú", 14],
];
export const COT_RACK = [
  ["ma", "Mã rack", 5], ["tang", "Tầng", 5], ["viTri", "Vị trí", 14], ["capTu", "Cấp nguồn từ tủ", 7, "TU"], ["maMach", "Mã lộ có sẵn", 6],
  ["lNguon", "L cáp nguồn (m)", 5, null, true], ["lTruc", "L trục (m)", 5, null, true], ["trungTam", "Trung tâm", 5, ["", "Có"]], ["ghiChu", "Ghi chú", 14],
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

// --- Điện nhẹ ---------------------------------------------------------------------------------------------
const tuGoc = (d) => d.panels.find((p) => !p.capTu || !d.panels.some((x) => x.ma === p.capTu))?.ma ?? d.panels[0]?.ma ?? "";

/** Thêm khung điện nhẹ cho dự án chưa có: 1 rack trung tâm ở tủ gốc, 1 phòng mẫu */
export function themDienNhe(duAn) {
  const d = sao(duAn);
  d.dienNhe = {
    phong: [{ tang: "T1", phong: "P.khách", data: 2, tv: 1, ap: 1, rack: "R1", L: 15 }],
    rack: [{ ma: "R1", tang: "T1", capTu: tuGoc(d), trungTam: true }],
  };
  return d;
}
export function suaPhongDn(duAn, i, k, v) {
  const d = sao(duAn);
  d.dienNhe.phong[i] = { ...d.dienNhe.phong[i], [k]: v };
  return d;
}
export function themPhongDn(duAn, sauI = null) {
  const d = sao(duAn);
  d.dienNhe ||= { phong: [], rack: [] };
  const ds = d.dienNhe.phong;
  const mau = sauI != null ? ds[sauI] : ds.at(-1);
  ds.splice(sauI != null ? sauI + 1 : ds.length, 0, { tang: mau?.tang ?? "T1", phong: "", rack: mau?.rack ?? d.dienNhe.rack[0]?.ma ?? "R1", L: mau?.L ?? null });
  return d;
}
export function xoaPhongDn(duAn, i) {
  const d = sao(duAn);
  d.dienNhe.phong.splice(i, 1);
  return d;
}
/** Sửa rack: đổi mã thì các phòng đi theo; chọn "Có" ở cột trung tâm thì bỏ trung tâm ở rack khác */
export function suaRack(duAn, i, k, v) {
  const d = sao(duAn);
  const ds = d.dienNhe.rack;
  if (k === "trungTam") {
    ds.forEach((r, j) => { r.trungTam = j === i ? v === "Có" : v === "Có" ? false : !!r.trungTam; });
    return d;
  }
  const cu = ds[i].ma;
  ds[i] = { ...ds[i], [k]: v };
  if (k === "ma" && v && v !== cu) for (const p of d.dienNhe.phong) if (p.rack === cu) p.rack = v;
  return d;
}
export function themRack(duAn) {
  const d = sao(duAn);
  d.dienNhe ||= { phong: [], rack: [] };
  const ma = maKeTiep(d.dienNhe.rack.map((r) => r.ma), "R");
  d.dienNhe.rack.push({ ma, tang: "", capTu: tuGoc(d), trungTam: !d.dienNhe.rack.length });
  return { duAn: d, ma };
}
/** Xóa rack: chặn nếu còn phòng dùng rack này */
export function xoaRack(duAn, i) {
  const ma = duAn.dienNhe.rack[i].ma;
  const dung = duAn.dienNhe.phong.filter((p) => p.rack === ma).map((p) => p.phong || p.tang);
  if (dung.length) return { duAn, loi: `Rack ${ma} còn phục vụ ${dung.length} phòng (${dung.slice(0, 3).join(", ")}${dung.length > 3 ? "…" : ""}) — chuyển các phòng sang rack khác trước` };
  const d = sao(duAn);
  d.dienNhe.rack.splice(i, 1);
  if (d.dienNhe.rack.length && !d.dienNhe.rack.some((r) => r.trungTam)) d.dienNhe.rack[0].trungTam = true;
  return { duAn: d };
}

// --- Dựng bảng (HTML) --------------------------------------------------------------------------------
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const hienSo = (v) => (v == null || v === "" ? "" : String(v).replace(".", ","));

function o(loaiDong, i, [k, , rong, chon, laSo], v, dsTu, dsLoai, dsRack = []) {
  const attr = `data-dong="${loaiDong}" data-i="${i}" data-k="${k}" aria-label="${esc(k)}"`;
  const ds = chon === "TU" ? ["", ...dsTu] : chon === "LOAI" ? dsLoai : chon === "RACK" ? dsRack : chon;
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
  const dienNhe = duAn.dienNhe?.phong?.length || duAn.dienNhe?.rack?.length
    ? `<div class="nl-dau"><h3>Điện nhẹ</h3><button class="btn btn-sm btn-primary" data-lenh="moDienNhe">Nhập liệu điện nhẹ →</button></div>
      <p class="crumb">Mạng, camera, TV, chuông cửa, ACS, âm thanh, KNX: bảng thiết bị theo phòng và bảng tủ rack (nhánh Điện nhẹ, các tờ E.7xx). Cột KNX của bảng mạch đánh dấu mạch điều khiển bằng actuator KNX.</p>`
    : `<div class="nl-dau"><h3>Điện nhẹ</h3><button class="btn btn-sm" data-lenh="themDienNhe">+ Thêm điện nhẹ</button></div>
      <p class="crumb">Dự án chưa có điện nhẹ. Bấm để thêm một tủ rack và một phòng mẫu; bảng nhập liệu điện nhẹ mở ra ngay.</p>`;
  return `<div class="nhaplieu">${info}${bangTu}${bangMach}${dienNhe}</div>`;
}

/** Nhập liệu điện nhẹ: bảng thiết bị theo phòng + bảng tủ rack (dùng ở các tờ E.7xx) */
export function veNhapLieuDn(duAn, kq) {
  const dn = duAn.dienNhe || { phong: [], rack: [] };
  const dsTu = duAn.panels.map((p) => p.ma);
  const dsRack = dn.rack.map((r) => r.ma);
  const canhBao = (kq?.canhBao ?? []).filter((c) => c.dienNhe);
  const lop = (ds) => (ds.some((c) => c.muc === "loi") ? "loi" : ds.some((c) => c.muc === "canhbao") ? "canhbao" : "");
  const bangPhong = `<div class="nl-dau"><h3>Thiết bị điện nhẹ theo phòng</h3><button class="btn btn-sm btn-primary" data-lenh="themPhongDn">+ Thêm phòng</button></div>
  <div class="tblwrap"><table class="nl"><thead><tr>${COT_DN.map(([, t]) => `<th>${esc(t)}</th>`).join("")}<th></th></tr></thead><tbody>
  ${dn.phong.map((p, i) => {
    const kt = canhBao.filter((c) => c.mach && c.mach === p.phong);
    return `<tr class="${lop(kt)}" title="${esc(kt.map((c) => c.noiDung).join("\n"))}">${COT_DN.map((c) => `<td>${o("dn", i, c, p[c[0]], dsTu, [], dsRack)}</td>`).join("")}
      <td class="nw"><button class="btn btn-sm" data-lenh="themPhongDn" data-i="${i}" title="Thêm phòng ngay sau">+</button><button class="btn btn-sm" data-lenh="xoaPhongDn" data-i="${i}" title="Xóa phòng">×</button></td></tr>`;
  }).join("")}</tbody></table></div>`;
  const bangRack = `<div class="nl-dau"><h3>Tủ rack</h3><button class="btn btn-sm" data-lenh="themRack">+ Thêm rack</button></div>
  <div class="tblwrap"><table class="nl"><thead><tr>${COT_RACK.map(([, t]) => `<th>${esc(t)}</th>`).join("")}<th></th></tr></thead><tbody>
  ${dn.rack.map((r, i) => {
    const kt = canhBao.filter((c) => c.tu === r.ma);
    return `<tr class="${lop(kt)}" title="${esc(kt.map((c) => c.noiDung).join("\n"))}">${COT_RACK.map((c) => `<td>${o("rack", i, c, c[0] === "trungTam" ? (r.trungTam ? "Có" : "") : r[c[0]], dsTu.filter(Boolean), [])}</td>`).join("")}
      <td class="nw"><button class="btn btn-sm" data-lenh="xoaRack" data-i="${i}" title="Xóa rack">Xóa</button></td></tr>`;
  }).join("")}</tbody></table></div>`;
  return `<div class="nhaplieu">${bangPhong}${bangRack}
    <p class="crumb">Số lượng theo phòng: ổ data, ổ TV (IPTV), AP Wi-Fi, camera, cửa kiểm soát ra vào, nút gọi / màn hình chuông cửa IP, loa 100 V (W/loa, vùng), phím / cảm biến KNX. L: chiều dài cáp trung bình từ rack tới phòng. Nguồn cho rack và ampli tự thêm thành mạch DNn trong tủ "Cấp nguồn từ tủ".</p></div>`;
}

/** Đọc giá trị một ô theo kiểu cột */
export function giaTriO(el) {
  if (el.dataset.so) return docSo(el.value);
  return el.value.trim() === "" ? (el.tagName === "SELECT" ? "" : null) : el.value.trim();
}
